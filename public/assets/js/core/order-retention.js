import { downloadJsonFile, localArchiveDbSave } from './local-archive-utils.js?v=0f0cdae475';

/* Order retention: keep Firestore from growing without bound as fulfilled
   requests age past 6 months, without silently breaking historical
   analytics/reports (which read request rows going back years).
   - Full raw detail of the aged-out requests is exported as a JSON file the
     master must download and confirm they saved externally — the ONLY
     copy of that full detail once this runs, since it is no longer kept in
     Firestore at all (the prior design copied it into another growing
     Firestore document, request_analytics_archive, which only relocated the
     size problem instead of solving it and itself risked hitting Firestore's
     1MiB per-document limit over years of accumulation).
   - A compact monthly aggregate (one synthetic row per month×department,
     dispensed[] already summed per medicine) replaces it in Firestore under
     request_analytics_summary_v1 — small and bounded (one row added per
     department per month, not one row per request) — and is shaped exactly
     like a real request row so analytics-engine.js's allRows() and every
     report built on it (computeStats, rowsForPeriod, the drug-comparison/
     department-trend reports) need no special-casing to keep working for
     historical periods, just coarser resolution (monthly totals, not
     individual requests) for anything old enough to have been archived.
   - Deletion from Firestore only happens after the master explicitly
     confirms the downloaded file is saved — this used to run unattended via
     scheduleAutomaticOrderCleanup(true); that path is now a safe no-op
     (build+save the aggregate/local copy automatically is NOT done either,
     since the file download itself cannot be automated — it stays a
     manual, confirmed action only). */
function orderRetentionCutoff(){var d=new Date();d.setMonth(d.getMonth()-6);return d}
function requestArchiveRecord(r){return {id:r.id,deptId:r.deptId||'',deptName:r.deptName||'',created:r.created||r.fulfilledAt||globalThis.nowISO(),fulfilledAt:r.fulfilledAt||'',status:r.status||'fulfilled',dispensed:(r.dispensed||[]).map(function(x){return {medId:x.medId,qty:Number(x.qty)||0}})}}

function monthKey(dateValue){var d=new Date(dateValue||0);if(isNaN(d))return null;return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function monthStartIso(key){var parts=key.split('-');return new Date(Number(parts[0]),Number(parts[1])-1,1).toISOString()}

// Groups old requests by month+department, sums dispensed qty per medicine.
// Output rows are shaped like a real request row (deptId, fulfilledAt,
// status, dispensed[{medId,qty}]) plus medName on each dispensed line so
// medicine-name resolution stays readable even if the catalog changes
// later — on purpose, so nothing downstream needs to know these are
// aggregates rather than individual requests.
function buildMonthlyAggregates(oldRequests){
  var groups={};
  oldRequests.forEach(function(r){
    var key=monthKey(r.fulfilledAt||r.created);
    if(!key)return;
    var groupKey=key+'|'+String(r.deptId||'');
    if(!groups[groupKey])groups[groupKey]={month:key,deptId:r.deptId||'',deptName:r.deptName||'',requestCount:0,byMed:{}};
    var g=groups[groupKey];
    g.requestCount++;
    (r.dispensed||[]).forEach(function(line){
      var qty=Number(line.qty)||0;
      if(qty<=0)return;
      var medId=String(line.medId||'');
      if(!g.byMed[medId])g.byMed[medId]={medId:medId,medName:line.medName||line.name||'',qty:0};
      g.byMed[medId].qty+=qty;
    });
  });
  return Object.keys(groups).map(function(groupKey){
    var g=groups[groupKey];
    return {
      id:'agg_'+groupKey.replace(/[^a-z0-9_-]/gi,'_'),
      deptId:g.deptId,
      deptName:g.deptName,
      status:'fulfilled',
      fulfilledAt:monthStartIso(g.month),
      created:monthStartIso(g.month),
      requestCount:g.requestCount,
      dispensed:Object.values(g.byMed),
      __aggregated:true
    };
  });
}

async function cleanupOldOrders(autoMode){
  var user=globalThis.CU;if(!user||user.role!=='pharmacy')return;
  if(autoMode){
    // Deletion now requires a human to confirm the downloaded file is safe
    // — that cannot happen unattended, so the scheduled automatic path is a
    // deliberate no-op rather than silently deleting without a real backup.
    return;
  }
  if(user.master!==true)return globalThis.toast('Only Master can delete old orders manually.','err');

  var cutoff=orderRetentionCutoff(),all=globalThis.gr();
  var old=all.filter(function(r){var dt=new Date(r.created||r.fulfilledAt||0);return !isNaN(dt)&&dt<cutoff&&r.status!=='pending'});
  if(!old.length){globalThis.toast('No orders older than 6 months.','info');return}

  var fullDetail=old.map(requestArchiveRecord);
  var stamp=new Date().toISOString().replace(/[:.]/g,'-');
  var fileName='ASDHealth_Orders_Archive_'+stamp+'.json';
  var exportPayload={format:'ASDHealth-Orders-Archive',version:1,exportedAt:new Date().toISOString(),count:fullDetail.length,orders:fullDetail};

  downloadJsonFile(exportPayload,fileName);
  await localArchiveDbSave('orders',{id:stamp,createdAt:exportPayload.exportedAt,count:fullDetail.length,payload:exportPayload});

  var confirmed=await globalThis.uiConfirm(
    'A file with the full detail of '+old.length+' order(s) older than 6 months has been downloaded ('+fileName+').\n\n'+
    'Save this file somewhere safe outside the browser (external drive, cloud storage) — it is the ONLY full-detail copy once you continue; only a compact monthly summary stays in the system afterward.\n\n'+
    'Confirm you saved the file and want to permanently remove these orders from Firestore now?',
    {danger:true,okText:'I saved the file — delete now'}
  );
  if(!confirmed){globalThis.toast('Archive file downloaded; orders were NOT deleted. Re-run this action when ready.','info');return}

  var summary=(globalThis.S.g('request_analytics_summary_v1')||[]).slice();
  var byId={};summary.forEach(function(x){byId[x.id]=x});
  buildMonthlyAggregates(old).forEach(function(row){
    if(byId[row.id]){
      // Merge into an existing month×department aggregate instead of
      // duplicating it, in case cleanup runs more than once for overlapping
      // months (e.g. requests that aged past the cutoff between runs).
      var existing=byId[row.id];
      existing.requestCount=(existing.requestCount||0)+row.requestCount;
      var byMed={};(existing.dispensed||[]).forEach(function(m){byMed[m.medId]=m});
      row.dispensed.forEach(function(m){
        if(byMed[m.medId])byMed[m.medId].qty+=m.qty;
        else{byMed[m.medId]=m;existing.dispensed.push(m)}
      });
    }else{
      byId[row.id]=row;summary.push(row);
    }
  });

  await globalThis.S.s('request_analytics_summary_v1',summary);
  await globalThis.S.s('requests',all.filter(function(r){return old.indexOf(r)<0}));
  globalThis.toast(old.length+' old orders archived locally and removed from Firestore; monthly totals preserved for reports.','succ');
  if(document.querySelector('#pg-print.on'))globalThis.renderPrint();
}

globalThis._orderCleanupStarted=false;
function scheduleAutomaticOrderCleanup(){
  // Intentionally left as a no-op trigger guard only — see the autoMode
  // early-return in cleanupOldOrders for why nothing destructive runs
  // unattended anymore.
  if(globalThis._orderCleanupStarted||!globalThis.CU||globalThis.CU.role!=='pharmacy')return;
  globalThis._orderCleanupStarted=true;
}
Object.assign(globalThis,{orderRetentionCutoff,requestArchiveRecord,cleanupOldOrders,scheduleAutomaticOrderCleanup});
export {orderRetentionCutoff,requestArchiveRecord,cleanupOldOrders,scheduleAutomaticOrderCleanup};

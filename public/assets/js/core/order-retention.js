import { downloadJsonFile, localArchiveDbSave } from './local-archive-utils.js?v=0f0cdae475';
import { registerStorageCleanup } from './storage-cleanup.js?v=efb839c9e4';
import { buildArchiveManifest, archiveFileName, describeArchive, localArchiveEntry } from './archive-manifest.js?v=6bf6b393b9';
import { uploadArchive } from './archive-storage.js?v=2e7d4b5e6f';

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
// The downloaded file is the only full-detail copy that survives, so it carries
// items[] (what the ward asked for) alongside dispensed[] (what it received).
// Dropping items[] made the archive unable to answer the one question the
// shortfall report exists for.
function requestArchiveRecord(r){return {id:r.id,deptId:r.deptId||'',deptName:r.deptName||'',created:r.created||r.fulfilledAt||globalThis.nowISO(),fulfilledAt:r.fulfilledAt||'',scheduledFor:r.scheduledFor||'',status:r.status||'fulfilled',items:(r.items||[]).map(function(x){return {medId:x.medId,medName:x.medName||x.name||'',qty:Number(x.qty)||0}}),dispensed:(r.dispensed||[]).map(function(x){return {medId:x.medId,medName:x.medName||x.name||'',qty:Number(x.qty)||0}})}}

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
    if(!groups[groupKey])groups[groupKey]={month:key,deptId:r.deptId||'',deptName:r.deptName||'',requestCount:0,zeroDispenseCount:0,
      serviceCounts:{withItems:0,full:0,partial:0,unfilled:0},byMed:{},byRequestedMed:{}};
    var g=groups[groupKey];
    g.requestCount++;

    var dispensedTotal=0;
    (r.dispensed||[]).forEach(function(line){
      var qty=Number(line.qty)||0;
      if(qty<=0)return;
      dispensedTotal+=qty;
      var medId=String(line.medId||'');
      if(!g.byMed[medId])g.byMed[medId]={medId:medId,medName:line.medName||line.name||'',qty:0};
      g.byMed[medId].qty+=qty;
    });
    if(dispensedTotal===0)g.zeroDispenseCount++;

    /* What was ASKED for, not only what was sent. Without items[] the aggregate
       loses fill rate and the per-medicine shortfall report for every archived
       month, which is the measure that shows a ward being under-served. The fill
       outcome of each order is tallied here too, because once orders are merged
       into one row their individual outcomes can no longer be recovered from the
       row's own totals. */
    var requestedTotal=0;
    (r.items||[]).forEach(function(line){
      var qty=Number(line.qty)||0;
      if(qty<=0)return;
      requestedTotal+=qty;
      var medId=String(line.medId||'');
      if(!g.byRequestedMed[medId])g.byRequestedMed[medId]={medId:medId,medName:line.medName||line.name||'',qty:0};
      g.byRequestedMed[medId].qty+=qty;
    });
    if(requestedTotal>0){
      g.serviceCounts.withItems++;
      if(dispensedTotal<=0)g.serviceCounts.unfilled++;
      else if(dispensedTotal<requestedTotal)g.serviceCounts.partial++;
      else g.serviceCounts.full++;
    }
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
      zeroDispenseCount:g.zeroDispenseCount,
      serviceCounts:g.serviceCounts,
      items:Object.values(g.byRequestedMed),
      dispensed:Object.values(g.byMed),
      __aggregated:true
    };
  });
}

/* Merging two aggregate sets for the same month+department. Cleanup runs more than
   once over the years and the legacy-archive migration folds a second set in, so
   rows must combine rather than overwrite — otherwise the second run silently
   replaces the first month's totals instead of adding to them. */
function mergeAggregateRows(existing,incoming){
  var byId={};
  (existing||[]).forEach(function(row){if(row&&row.id)byId[row.id]=row});
  (incoming||[]).forEach(function(row){
    if(!row||!row.id)return;
    var current=byId[row.id];
    if(!current){byId[row.id]=row;return}
    var merged=Object.assign({},current,{
      requestCount:(Number(current.requestCount)||0)+(Number(row.requestCount)||0),
      zeroDispenseCount:(Number(current.zeroDispenseCount)||0)+(Number(row.zeroDispenseCount)||0),
      serviceCounts:{
        withItems:(Number((current.serviceCounts||{}).withItems)||0)+(Number((row.serviceCounts||{}).withItems)||0),
        full:(Number((current.serviceCounts||{}).full)||0)+(Number((row.serviceCounts||{}).full)||0),
        partial:(Number((current.serviceCounts||{}).partial)||0)+(Number((row.serviceCounts||{}).partial)||0),
        unfilled:(Number((current.serviceCounts||{}).unfilled)||0)+(Number((row.serviceCounts||{}).unfilled)||0)
      },
      items:sumMedLines(current.items,row.items),
      dispensed:sumMedLines(current.dispensed,row.dispensed)
    });
    byId[row.id]=merged;
  });
  return Object.values(byId);
}

function sumMedLines(a,b){
  var byMed={};
  [].concat(a||[],b||[]).forEach(function(line){
    if(!line)return;
    var medId=String(line.medId||'');
    if(!byMed[medId])byMed[medId]={medId:medId,medName:line.medName||line.name||'',qty:0};
    if(!byMed[medId].medName&&line.medName)byMed[medId].medName=line.medName;
    byMed[medId].qty+=Number(line.qty)||0;
  });
  return Object.values(byMed);
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
  /* The name and the manifest state what this holds, the period it really covers
     and the day it was saved, so the file can be identified months later on a
     shared computer without opening it. */
  var manifest=buildArchiveManifest({kind:'Orders',rows:fullDetail,dateFields:['fulfilledAt','created'],note:'Orders older than 6 months, removed from Firestore after this export.'});
  var fileName=archiveFileName(manifest,'json');
  var exportPayload={format:'ASDHealth-Orders-Archive',version:2,manifest:manifest,exportedAt:manifest.savedAt,count:fullDetail.length,orders:fullDetail};

  downloadJsonFile(exportPayload,fileName);
  await localArchiveDbSave('orders',localArchiveEntry(manifest,exportPayload));
  var upload=await uploadArchive(manifest,exportPayload);

  var confirmed=await globalThis.uiConfirm(
    'A file with the full detail of '+old.length+' order(s) older than 6 months has been downloaded.\n\n'+
    describeArchive(manifest,fileName)+'\n\n'+
    (upload.ok
      ? 'A copy is also kept in this project, readable only by Master — you can download it again later from System Health.\nونسخة محفوظة في المشروع نفسه، يقرأها الماستر فقط، ويمكن تنزيلها لاحقًا من صحة النظام.\n\n'
      : 'The project copy could NOT be saved ('+upload.reason+'), so the downloaded file is the only copy. Save it somewhere safe before continuing.\nتعذّر حفظ النسخة في المشروع، فالملف المنزَّل هو النسخة الوحيدة.\n\n')+
    'Confirm you saved the file and want to permanently remove these orders from Firestore now?',
    {danger:true,okText:'I saved the file — delete now'}
  );
  if(!confirmed){globalThis.toast('Archive file downloaded; orders were NOT deleted. Re-run this action when ready.','info');return}

  var summary=mergeAggregateRows(globalThis.S.g('request_analytics_summary_v1')||[],buildMonthlyAggregates(old));

  /* Two documents, no transaction between them. The aggregate merge ADDS to any
     existing row for the same month and department, so if the trim below failed
     after the summary was written, re-running would aggregate the same orders a
     second time and inflate the totals permanently. Restoring the previous
     summary on failure keeps a retry correct; the trim itself is a filter and is
     safe to repeat. */
  var previousSummary=globalThis.S.g('request_analytics_summary_v1')||[];
  await globalThis.S.s('request_analytics_summary_v1',summary);
  try{
    await globalThis.S.s('requests',all.filter(function(r){return old.indexOf(r)<0}));
  }catch(trimError){
    try{await globalThis.S.s('request_analytics_summary_v1',previousSummary)}
    catch(rollbackError){console.error('Could not restore the previous analytics summary; re-running cleanup would double-count these months.',rollbackError)}
    throw trimError;
  }
  globalThis.toast(old.length+' old orders archived locally and removed from Firestore; monthly totals preserved for reports.','succ');
  if(document.querySelector('#pg-print.on'))globalThis.renderPrint();
}

/* One-time migration: retire request_analytics_archive.

   Two archives of the same orders ran side by side for months. The legacy key
   held full-detail rows in a single Firestore document that grew without bound —
   the exact problem the monthly summary was introduced to solve — and both were
   concatenated into every report, so the same period was served through two
   different code paths. This folds the legacy rows through the same aggregator
   the live path uses and deletes the old document.

   Nothing is lost from the statistics: buildMonthlyAggregates carries the order
   count, the zero-dispense count, the fill outcomes and both medicine line sets,
   and analytics-engine weighs each aggregate by rowWeight(), so a month reads
   with the same totals afterwards at coarser resolution. The legacy rows are
   downloaded first regardless, because they are full detail and this deletes them. */
async function migrateLegacyRequestArchive(){
  var user=globalThis.CU;
  if(!user||user.master!==true)return globalThis.toast('Only Master can run the archive migration.','err');

  var legacy=globalThis.S.g('request_analytics_archive')||[];
  if(!legacy.length){
    // Present but empty: still remove the key so the document stops existing.
    if(globalThis.S.g('request_analytics_archive')!==null){
      await globalThis.S.rm('request_analytics_archive');
      globalThis.toast('Legacy order archive was already empty and has been removed.','succ');
    }else{
      globalThis.toast('No legacy order archive found — nothing to migrate.','info');
    }
    return;
  }

  var manifest=buildArchiveManifest({kind:'Orders-Legacy-Archive',rows:legacy,dateFields:['fulfilledAt','created'],note:'The retired request_analytics_archive, folded into the monthly summary after this export.'});
  var fileName=archiveFileName(manifest,'json');
  var payload={format:'ASDHealth-Orders-Archive',version:2,manifest:manifest,exportedAt:manifest.savedAt,
    source:'request_analytics_archive',count:legacy.length,orders:legacy};
  downloadJsonFile(payload,fileName);
  await localArchiveDbSave('orders',localArchiveEntry(manifest,payload));
  var legacyUpload=await uploadArchive(manifest,payload);

  var confirmed=await globalThis.uiConfirm(
    'A file with the full detail of '+legacy.length+' legacy archived order(s) has been downloaded.\n\n'+
    describeArchive(manifest,fileName)+'\n\n'+
    (legacyUpload.ok?'A copy is also kept in this project.\nونسخة محفوظة في المشروع.\n\n':'The project copy could NOT be saved ('+legacyUpload.reason+').\n\n')+
    'These records will be folded into the monthly analytics summary — every report keeps the same order counts and quantities, at monthly rather than per-order resolution — and the old record will then be deleted.\n\n'+
    'Save the file somewhere safe outside the browser, then confirm to continue.',
    {danger:true,okText:'I saved the file — migrate now'}
  );
  if(!confirmed){globalThis.toast('File downloaded; nothing was migrated. Re-run when ready.','info');return}

  var previousSummary=globalThis.S.g('request_analytics_summary_v1')||[];
  var merged=mergeAggregateRows(previousSummary,buildMonthlyAggregates(legacy));
  await globalThis.S.s('request_analytics_summary_v1',merged);
  try{
    await globalThis.S.rm('request_analytics_archive');
  }catch(removeError){
    // The summary now contains these months; leaving the legacy key in place
    // would double-count them on the next report, so put the summary back.
    try{await globalThis.S.s('request_analytics_summary_v1',previousSummary)}
    catch(rollbackError){console.error('Could not restore the previous analytics summary after a failed migration.',rollbackError)}
    throw removeError;
  }
  globalThis.toast(legacy.length+' legacy archived order(s) folded into the monthly summary; the old record has been removed. Report totals are unchanged.','succ');
}

globalThis._orderCleanupStarted=false;
function scheduleAutomaticOrderCleanup(){
  // Intentionally left as a no-op trigger guard only — see the autoMode
  // early-return in cleanupOldOrders for why nothing destructive runs
  // unattended anymore.
  if(globalThis._orderCleanupStarted||!globalThis.CU||globalThis.CU.role!=='pharmacy')return;
  globalThis._orderCleanupStarted=true;
}
Object.assign(globalThis,{orderRetentionCutoff,requestArchiveRecord,buildMonthlyAggregates,mergeAggregateRows,cleanupOldOrders,scheduleAutomaticOrderCleanup,migrateLegacyRequestArchive});
export {orderRetentionCutoff,requestArchiveRecord,buildMonthlyAggregates,mergeAggregateRows,cleanupOldOrders,scheduleAutomaticOrderCleanup,migrateLegacyRequestArchive};

/* The System Health storage panel needs to know which action shrinks `requests`.
   Registering here keeps that knowledge with the module that owns the action
   instead of hard-coding a key->function table in the panel. */
/* The legacy archive is only visible while it still exists, so it registers under
   its own key: once the migration has run the document is gone, the gauge stops
   listing it, and the entry disappears on its own. */
registerStorageCleanup({
  key:'request_analytics_archive',
  label:'Migrate legacy archive / ترحيل الأرشيف القديم',
  hint:'Folds the retired second archive into the monthly summary. Report totals are unchanged.',
  run:function(){return migrateLegacyRequestArchive()},
  canRun:function(){return !!(globalThis.CU&&globalThis.CU.master===true)}
});

/* Registered under the partitioned ledger's synthetic panel row, not under the
   legacy `requests` document: that document only exists until the monthly
   migration runs, and the migration owns that key's entry. */
registerStorageCleanup({
  key:'requests_ledger',
  label:'Archive orders > 6 months / أرشفة الطلبات',
  hint:'Downloads full detail as JSON, keeps monthly totals for reports, then removes the old rows.',
  run:function(){return cleanupOldOrders(false)},
  canRun:function(){return !!(globalThis.CU&&globalThis.CU.master===true)}
});

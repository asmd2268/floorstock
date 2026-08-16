import { downloadJsonFile, downloadExcelFile, localArchiveDbSave } from './local-archive-utils.js';

/* Controlled/narcotic movement log retention: controlled_moves is a single
   ever-growing Firestore array — the exact same unbounded-document risk
   requests had before order-retention.js's redesign — but narcotic/
   controlled-substance records typically carry longer regulatory retention
   expectations than general order history, so this defaults to 1 year
   (not the 6 months used for orders), per explicit instruction rather than
   assumed parity.

   Same safety shape as order-retention.js: full raw detail is exported
   (both JSON and Excel, since narcotic records are the kind an
   administrator plausibly needs to review/compare/hand to an auditor) and
   the master must explicitly confirm the file is saved before anything is
   deleted from Firestore. A compact monthly aggregate — grouped by
   month × type × medicine × dispenseType, matching exactly the fields
   narcoticStatsForYear() in the analytics report reads — replaces the
   detail in Firestore under controlled_moves_summary_v1, so year-over-year
   narcotic reports keep working for archived periods at monthly
   resolution instead of losing that history outright. */

function controlledMovesRetentionCutoff(){var d=new Date();d.setFullYear(d.getFullYear()-1);return d}

function monthKey(dateValue){var d=new Date(dateValue||0);if(isNaN(d))return null;return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function monthStartIso(key){var parts=key.split('-');return new Date(Number(parts[0]),Number(parts[1])-1,1).toISOString()}

function buildControlledMovesAggregates(oldMoves){
  var groups={};
  oldMoves.forEach(function(m){
    var key=monthKey(m.at);
    if(!key)return;
    var groupKey=[key,m.type||'',m.medId||'',m.dispenseType||''].join('|');
    if(!groups[groupKey]){
      groups[groupKey]={month:key,type:m.type||'',medId:m.medId||'',dispenseType:m.dispenseType||'',dept:m.dept||'',deptName:m.deptName||'',eventCount:0,qty:0};
    }
    groups[groupKey].eventCount++;
    groups[groupKey].qty+=Number(m.qty)||0;
  });
  return Object.keys(groups).map(function(groupKey){
    var g=groups[groupKey];
    return {
      id:'ctlagg_'+groupKey.replace(/[^a-z0-9_-]/gi,'_'),
      type:g.type,
      medId:g.medId,
      qty:g.qty,
      at:monthStartIso(g.month),
      dispenseType:g.dispenseType,
      dept:g.dept,
      deptName:g.deptName,
      by:'Archived monthly summary / ملخص شهري مؤرشف',
      note:g.eventCount+' event(s) archived',
      eventCount:g.eventCount,
      __aggregated:true
    };
  });
}

async function exportControlledMovesArchive(oldMoves,stamp){
  var jsonPayload={format:'ASDHealth-Controlled-Moves-Archive',version:1,exportedAt:new Date().toISOString(),count:oldMoves.length,moves:oldMoves};
  downloadJsonFile(jsonPayload,'ASDHealth_Controlled_Moves_Archive_'+stamp+'.json');
  try{
    var catalog=(typeof window.ctlCatalog==='function'?window.ctlCatalog():[])||[];
    var byId={};catalog.forEach(function(m){byId[m.id]=m});
    await downloadExcelFile(oldMoves,[
      {label:'Date',value:function(r){return r.at?new Date(r.at).toLocaleString():''}},
      {label:'Type',value:function(r){return r.type||''}},
      {label:'Medicine',value:function(r){return (byId[r.medId]&&byId[r.medId].name)||r.medId||''}},
      {label:'Qty',value:function(r){return Number(r.qty)||0}},
      {label:'Dispense type',value:function(r){return r.dispenseType||''}},
      {label:'Department',value:function(r){return r.deptName||r.dept||''}},
      {label:'Recipient',value:function(r){return r.recipient||''}},
      {label:'By',value:function(r){return r.by||''}},
      {label:'Note',value:function(r){return r.note||''}}
    ],'ASDHealth_Controlled_Moves_Archive_'+stamp+'.xlsx');
  }catch(excelError){
    console.warn('Excel export failed; the JSON file (already downloaded) remains the full-detail copy.',excelError);
    if(window.toast)toast('JSON archive downloaded; Excel export failed: '+(excelError&&excelError.message||excelError),'info');
  }
}

window.archiveOldControlledMoves=async function(){
  var user=globalThis.CU;
  if(!user||user.master!==true)return globalThis.toast('Only Master can archive controlled/narcotic movement records.','err');

  var cutoff=controlledMovesRetentionCutoff();
  var all=(typeof window.ctlMoves==='function'?window.ctlMoves():[])||[];
  var old=all.filter(function(m){var dt=new Date(m.at||0);return !isNaN(dt)&&dt<cutoff});
  if(!old.length){globalThis.toast('No controlled/narcotic movement records older than 1 year.','info');return}

  var stamp=new Date().toISOString().replace(/[:.]/g,'-');
  await exportControlledMovesArchive(old,stamp);
  await localArchiveDbSave('controlled_moves',{id:stamp,createdAt:new Date().toISOString(),count:old.length,payload:old});

  var confirmed=await globalThis.uiConfirm(
    'Files with the full detail of '+old.length+' controlled/narcotic movement record(s) older than 1 year have been downloaded (JSON + Excel).\n\n'+
    'Save these files somewhere safe outside the browser — they are the ONLY full-detail copy once you continue; only a compact monthly summary stays in the system afterward.\n\n'+
    'Confirm you saved the files and want to permanently remove these records from Firestore now?',
    {danger:true,okText:'I saved the files — delete now'}
  );
  if(!confirmed){globalThis.toast('Archive files downloaded; records were NOT deleted. Re-run this action when ready.','info');return}

  var summary=(globalThis.S.g('controlled_moves_summary_v1')||[]).slice();
  var byId={};summary.forEach(function(x){byId[x.id]=x});
  buildControlledMovesAggregates(old).forEach(function(row){
    if(byId[row.id]){
      var existing=byId[row.id];
      existing.qty=(Number(existing.qty)||0)+row.qty;
      existing.eventCount=(existing.eventCount||0)+row.eventCount;
      existing.note=existing.eventCount+' event(s) archived';
    }else{
      byId[row.id]=row;summary.push(row);
    }
  });

  await globalThis.S.s('controlled_moves_summary_v1',summary);
  await globalThis.S.s('controlled_moves',all.filter(function(m){return old.indexOf(m)<0}));
  globalThis.toast(old.length+' old controlled/narcotic movement record(s) archived locally and removed from Firestore; monthly totals preserved for reports.','succ');
  if(typeof window.renderCtlLog==='function'&&document.getElementById('mcustody-log')&&document.getElementById('mcustody-log').classList.contains('on')){
    window.renderCtlLog(typeof window.ctlCustodyLogFilters==='function'?window.ctlCustodyLogFilters():{});
  }
};

export {controlledMovesRetentionCutoff,buildControlledMovesAggregates};

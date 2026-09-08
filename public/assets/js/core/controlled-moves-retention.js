import { downloadJsonFile, downloadExcelFile, localArchiveDbSave } from './local-archive-utils.js?v=0f0cdae475';
import { registerStorageCleanup } from './storage-cleanup.js?v=15650a41cb';
import { buildArchiveManifest, archiveFileName, describeArchive, localArchiveEntry } from './archive-manifest.js?v=813f523ca6';
import { uploadArchive } from './archive-storage.js?v=a4e3b69c50';

/* Controlled/narcotic movement log retention.

   This used to archive at 1 YEAR and delete the detail, because controlled_moves
   was one array in one Firestore document capped at 1 MiB and deleting was the
   only way to keep the ledger writable. That is not compatible with the custody
   officer's requirement of at least five years of individual movements: five
   years of narcotic movements does not fit in one 1 MiB document at any
   retention setting, so the shape had to change rather than the number.

   controlled_moves is now one document per movement (see
   core/collection-backed-keys.js and core/controlled-moves-store.js). There is no
   ceiling to relieve, so nothing has to be deleted to keep the ledger working,
   and archiving is no longer a maintenance requirement — it is an export.

   What remains here: a manual, master-confirmed export of movements older than
   the five-year floor, for an administrator who wants them out of the live view.
   It writes the same monthly aggregate into controlled_moves_summary_v1 that the
   year-over-year narcotic reports already read, so archived periods keep
   reporting at monthly resolution. Nothing older than five years can be removed,
   and the action refuses rather than silently narrowing the window. */

// The regulatory floor. Movements newer than this are never removable by this path.
const CONTROLLED_MOVES_MIN_RETENTION_YEARS = 5;

function controlledMovesRetentionCutoff(){
  var d=new Date();
  d.setFullYear(d.getFullYear()-CONTROLLED_MOVES_MIN_RETENTION_YEARS);
  return d;
}

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

async function exportControlledMovesArchive(oldMoves,manifest){
  var jsonName=archiveFileName(manifest,'json');
  var jsonPayload={format:'ASDHealth-Controlled-Moves-Archive',version:2,manifest:manifest,exportedAt:manifest.savedAt,count:oldMoves.length,moves:oldMoves};
  downloadJsonFile(jsonPayload,jsonName);
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
    ],archiveFileName(manifest,'xlsx'));
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
  if(!old.length){globalThis.toast('No controlled/narcotic movement records older than '+CONTROLLED_MOVES_MIN_RETENTION_YEARS+' years. The ledger has no size limit, so nothing needs archiving.','info');return}

  var manifest=buildArchiveManifest({kind:'Controlled-Movements',rows:old,dateFields:['at'],note:'Controlled/narcotic movements past the '+CONTROLLED_MOVES_MIN_RETENTION_YEARS+'-year retention floor.'});
  await exportControlledMovesArchive(old,manifest);
  await localArchiveDbSave('controlled_moves',localArchiveEntry(manifest,old));
  var upload=await uploadArchive(manifest,{format:'ASDHealth-Controlled-Moves-Archive',version:2,manifest:manifest,count:old.length,moves:old});

  var confirmed=await globalThis.uiConfirm(
    'Files with the full detail of '+old.length+' controlled/narcotic movement record(s) older than '+CONTROLLED_MOVES_MIN_RETENTION_YEARS+' years have been downloaded (JSON + Excel).\n\n'+
    describeArchive(manifest,archiveFileName(manifest,'json'))+'\n\n'+
    (upload.ok
      ? 'A copy is also kept in this project, readable only by Master.\nونسخة محفوظة في المشروع نفسه، يقرأها الماستر فقط.\n\n'
      : 'The project copy could NOT be saved ('+upload.reason+'), so the downloaded files are the only copies.\n\n')+
    'The ledger is no longer size-limited, so this is optional housekeeping, not maintenance — movements can be left in place indefinitely.\n\n'+
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

  /* Same shape as order-retention: the aggregate merge ADDS to an existing row for
     the same month, so a trim that failed after the summary was written would make
     a retry count these movements twice and permanently inflate the narcotic
     totals. Restoring the previous summary keeps a retry correct; the trim is a
     filter and is safe to repeat. */
  var previousSummary=globalThis.S.g('controlled_moves_summary_v1')||[];
  await globalThis.S.s('controlled_moves_summary_v1',summary);
  try{
    // Removes each archived movement from the Hijri-month record that holds it.
    // It used to rewrite the entire ledger array into one document, which is both
    // the write pattern this conversion removed and the reason a failure here
    // could lose live movements.
    for(var i=0;i<old.length;i++)await globalThis.deleteControlledMove(old[i].id);
  }catch(trimError){
    try{await globalThis.S.s('controlled_moves_summary_v1',previousSummary)}
    catch(rollbackError){console.error('Could not restore the previous controlled-movement summary; re-running cleanup would double-count these months.',rollbackError)}
    throw trimError;
  }
  globalThis.toast(old.length+' old controlled/narcotic movement record(s) archived locally and removed from Firestore; monthly totals preserved for reports.','succ');
  if(typeof window.renderCtlLog==='function'&&document.getElementById('mcustody-log')&&document.getElementById('mcustody-log').classList.contains('on')){
    window.renderCtlLog(typeof window.ctlCustodyLogFilters==='function'?window.ctlCustodyLogFilters():{});
  }
};

export {CONTROLLED_MOVES_MIN_RETENTION_YEARS,controlledMovesRetentionCutoff,buildControlledMovesAggregates};

/* Registered under the ledger's synthetic panel row, not under the legacy
   controlled_moves document: that document only exists until the Hijri-month
   migration runs, and the migration owns that key's entry. Two actions on one key
   would silently replace each other — registerStorageCleanup now refuses it. */
registerStorageCleanup({
  key:'controlled_moves_ledger',
  label:'Export movements > 5 years / تصدير الحركات',
  hint:'Optional. The ledger has no size limit; this exports movements past the 5-year regulatory floor and keeps monthly totals for reports.',
  run:function(){return window.archiveOldControlledMoves()},
  canRun:function(){return !!(globalThis.CU&&globalThis.CU.master===true)}
});

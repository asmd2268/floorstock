(function(){
'use strict';
var VERSION='R6.64',SNAPSHOT_LIMIT=10,saving={},bulkDepth=0,startFingerprint=null,lastSafetyError='';
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v))}
function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function actor(){return (window.CU&&(CU.username||CU.email))||'Unknown'}
function now(){return new Date().toISOString()}
function hash(value){var text=JSON.stringify(value),h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function medsRaw(deptId){var value=window.S&&S.g?S.g('meds_'+deptId):null;return Array.isArray(value)?value:[]}
function expiryRaw(deptId){var value=window.S&&S.g?S.g('expiry_'+deptId):null;return Array.isArray(value)?value:[]}
function deptName(deptId){var d=(typeof gd==='function'?(gd()||[]):[]).find(function(x){return String(x.id)===String(deptId)});return d?d.name:String(deptId)}
function totalAndHash(){
  var rows=[];(typeof gd==='function'?(gd()||[]):[]).forEach(function(d){medsRaw(d.id).forEach(function(m){rows.push([String(d.id),String(m.id||m.medId||''),String(m.name||'')])})});
  rows.sort(function(a,b){return a.join('|').localeCompare(b.join('|'))});return {count:rows.length,hash:hash(rows)}
}
function setSafety(message,error){
  var bar=document.getElementById('r661-inventory-safety');
  if(!bar){if(error&&message!==lastSafetyError){lastSafetyError=message;if(typeof toast==='function')toast(message,'err')}else if(!error)console.info(message);return}
  var text=bar.querySelector('.r661-text');if(text)text.textContent=message;
  bar.classList.toggle('is-error',!!error)
}
function validateInventoryRows(rows){
  if(!Array.isArray(rows))throw new Error('Inventory write rejected: medication list must be an array.');
  var ids={},names={};
  rows.forEach(function(m,index){
    if(!m||!String(m.name||'').trim())throw new Error('Inventory write rejected: missing medication name at row '+(index+1)+'.');
    var id=String(m.id||m.medId||'');if(!id)throw new Error('Inventory write rejected: missing permanent medication ID for “'+m.name+'”.');
    if(ids[id])throw new Error('Inventory write rejected: duplicate medication ID '+id+'.');ids[id]=1;
    var name=norm(m.name);if(names[name])throw new Error('Inventory write rejected: duplicate exact name “'+m.name+'”.');names[name]=1
  });
}
async function snapshot(deptId,before,reason){
  if(!window.S||!S.ready)return null;
  var stamp=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),base='inventory_snapshot_'+String(deptId)+'_'+stamp;
  var meta={id:base,at:now(),deptId:String(deptId),deptName:deptName(deptId),actor:actor(),reason:reason||'inventory_change',medCount:before.length,expiryCount:expiryRaw(deptId).length,medHash:hash(before),medsKey:base+'_meds',expiryKey:base+'_expiry'};
  await S.s(meta.medsKey,clone(before));
  await S.s(meta.expiryKey,clone(expiryRaw(deptId)));
  var indexKey='inventory_snapshot_index_'+String(deptId),index=clone(S.g(indexKey)||[]);index.unshift(meta);
  var expired=index.slice(SNAPSHOT_LIMIT);index=index.slice(0,SNAPSHOT_LIMIT);await S.s(indexKey,index);
  expired.forEach(function(old){[old.medsKey,old.expiryKey].forEach(function(key){if(key)S.rm(key).catch(function(e){console.warn('Old inventory snapshot cleanup skipped',key,e)})})});
  return meta
}
function normalizeExplicit(rows){
  return typeof fsR17NormalizeMeds==='function'?fsR17NormalizeMeds(rows).rows:clone(rows)
}
/* Reads are pure. Opening a page or logging in never writes medication data. */
window.getMeds=getMeds=function(deptId){return clone(medsRaw(deptId))};
/* One authoritative write gateway for every inventory mutation. */
window.setMeds=setMeds=async function(deptId,rows){
  deptId=String(deptId||'');if(!deptId)throw new Error('Inventory write rejected: department is required.');
  if(saving[deptId])throw new Error('Another inventory save is already running for '+deptName(deptId)+'.');
  var before=clone(medsRaw(deptId)),next=normalizeExplicit(rows);validateInventoryRows(next);
  var delta=Math.abs(next.length-before.length),limit=Math.max(1,Math.ceil(Math.max(before.length,1)*0.05));
  if(delta>limit&&bulkDepth<=0)throw new Error('Safety block: this operation changes '+delta+' records in '+deptName(deptId)+' (limit '+limit+'). Use an approved exact bulk operation.');
  saving[deptId]=true;
  try{
    var reason=bulkDepth>0?'approved_exact_bulk_change':'explicit_inventory_change',snap=await snapshot(deptId,before,reason);
    await S.s('meds_'+deptId,next);
    var integrity={at:now(),deptId:deptId,count:next.length,hash:hash(next),actor:actor(),snapshotId:snap&&snap.id||''};
    try{await S.s('inventory_integrity_'+deptId,integrity)}catch(metadataError){console.warn('Inventory data was saved, but integrity metadata could not be updated.',metadataError);if(typeof toast==='function')toast('Inventory saved; protection metadata will retry on the next change.','info')}
    if(typeof auditAction==='function')auditAction('inventory_write_committed',{deptId:deptId,department:deptName(deptId),beforeCount:before.length,afterCount:next.length,beforeHash:hash(before),afterHash:integrity.hash,snapshotId:integrity.snapshotId,reason:reason});
    setSafety(VERSION+' protected · '+totalAndHash().count+' medications · last save: '+deptName(deptId),false);
    return true
  }catch(error){
    setSafety(VERSION+' BLOCKED/FAILED · '+deptName(deptId)+' · '+String(error&&error.message||error),true);throw error
  }finally{delete saving[deptId]}
};
window.inventorySafetyApprovedBulk=async function(label,fn){
  if(typeof fn!=='function')throw new Error('Approved bulk operation is invalid.');
  bulkDepth++;try{return await fn()}finally{bulkDepth=Math.max(0,bulkDepth-1)}
};
function wrapApproved(name){
  var original=window[name];if(typeof original!=='function'||original.__r661)return;
  var wrapped=async function(){var self=this,args=arguments;return window.inventorySafetyApprovedBulk(name,function(){return original.apply(self,args)})};wrapped.__r661=true;window[name]=wrapped
}
['confirmMergeInventoryNames','deleteSelected'].forEach(wrapApproved);
function escSafe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function masterAllowed(){
  if(window.MASTER_EFFECTIVE)return false;
  var profile=window.MASTER_ACTUAL||window.CU,role=String(profile&&profile.role||'');
  return !!(profile&&profile.master===true&&(role==='pharmacy'||role==='pharmacy_director'))
}
function removeSnapshotManager(){
  ['r662-snapshot-card','r663-dashboard-snapshot-card','r662-snapshot-modal'].forEach(function(id){var node=document.getElementById(id);if(node)node.remove()})
}
function ensureSnapshotManager(){
  if(!masterAllowed()){removeSnapshotManager();return}
  var backupPage=document.getElementById('pg-backup-restore'),dashboard=document.getElementById('pg-dash');
  if(backupPage&&!document.getElementById('r662-snapshot-card')){
    var card=document.createElement('div');card.className='card';card.id='r662-snapshot-card';
    card.innerHTML='<div class="ch"><div><span class="ct">🛡 Inventory Safety Snapshots / لقطات حماية المخزون</span><div class="fhint">Firebase snapshots created automatically before each explicit inventory change. Last '+SNAPSHOT_LIMIT+' snapshots are retained per department.</div></div><button type="button" class="btn bp r663-open-snapshots">Open snapshots / فتح اللقطات</button></div>';
    backupPage.appendChild(card)
  }
  if(dashboard&&!document.getElementById('r663-dashboard-snapshot-card')){
    var dashCard=document.createElement('div');dashCard.className='card';dashCard.id='r663-dashboard-snapshot-card';
    dashCard.innerHTML='<div class="ch"><div><span class="ct">🛡 Inventory Protection / حماية المخزون</span><div class="fhint">Master-only access to the last '+SNAPSHOT_LIMIT+' pre-change snapshots for every department.</div></div><button type="button" class="btn bp r663-open-snapshots">Inventory Safety Snapshots</button></div>';
    dashboard.insertBefore(dashCard,dashboard.firstChild)
  }
  document.querySelectorAll('.r663-open-snapshots').forEach(function(button){button.onclick=window.openInventorySafetySnapshots})
}
function snapshotDepartments(){
  return (typeof gd==='function'?(gd()||[]):[]).map(function(d){var list=clone(S.g('inventory_snapshot_index_'+d.id)||[]);return {id:String(d.id),name:d.name||d.id,list:list}}).filter(function(d){return d.list.length})
}
function renderSnapshotChoices(){
  var deptId=String((document.getElementById('r662-snapshot-dept')||{}).value||''),host=document.getElementById('r662-snapshot-list'),dept=snapshotDepartments().find(function(d){return d.id===deptId});
  if(!host)return;
  host.innerHTML=dept&&dept.list.length?dept.list.map(function(item,index){
    return '<label style="display:flex;align-items:flex-start;gap:9px;border:1px solid var(--bd);border-radius:8px;padding:9px;margin-bottom:7px"><input type="radio" name="r662-snapshot-choice" value="'+escSafe(item.id)+'" '+(index===0?'checked':'')+' style="width:auto;margin-top:3px"><span><b>'+escSafe(new Date(item.at).toLocaleString())+'</b><small style="display:block;color:var(--tx2);margin-top:3px">'+escSafe(item.medCount)+' medications · '+escSafe(item.expiryCount)+' expiry records · '+escSafe(item.actor||'Unknown')+'</small><small style="display:block;color:var(--tx2)">'+escSafe(item.reason||'inventory change')+'</small></span></label>'
  }).join(''):'<div class="fhint">No snapshots for this department.</div>'
}
window.openInventorySafetySnapshots=function(){
  if(!masterAllowed())return typeof toast==='function'?toast('Master permission required.','err'):false;
  var depts=snapshotDepartments(),old=document.getElementById('r662-snapshot-modal');if(old)old.remove();
  var html='<div class="modal-bg on" id="r662-snapshot-modal"><div class="modal" style="width:min(720px,96vw)"><div class="mh"><div><div class="mt">Inventory Safety Snapshots</div><div class="fhint">Choose a department and an exact pre-change snapshot. Restoring also creates a new snapshot of the current state.</div></div><button type="button" class="xbtn" data-close>×</button></div>';
  if(!depts.length)html+='<div class="alert-banner-y">No inventory snapshots exist yet. A snapshot is created automatically before the next inventory change.</div>';
  else html+='<label>Department / القسم<select id="r662-snapshot-dept">'+depts.map(function(d){return '<option value="'+escSafe(d.id)+'">'+escSafe(d.name)+' — '+d.list.length+' snapshot(s)</option>'}).join('')+'</select></label><div id="r662-snapshot-list" style="max-height:360px;overflow:auto;margin-top:10px"></div>';
  html+='<div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn bg" data-close>Close</button>'+(depts.length?'<button type="button" class="btn bd2c" id="r662-restore-snapshot">Restore selected snapshot</button>':'')+'</div></div></div>';
  document.body.insertAdjacentHTML('beforeend',html);var modal=document.getElementById('r662-snapshot-modal');
  modal.addEventListener('click',function(e){if(e.target===modal||e.target.closest('[data-close]'))modal.remove()});
  var select=document.getElementById('r662-snapshot-dept');if(select){select.onchange=renderSnapshotChoices;renderSnapshotChoices()}
  var restore=document.getElementById('r662-restore-snapshot');if(restore)restore.onclick=window.restoreSelectedInventorySafetySnapshot;
  return true
};
window.restoreSelectedInventorySafetySnapshot=async function(){
  if(!masterAllowed())return false;
  var deptId=String((document.getElementById('r662-snapshot-dept')||{}).value||''),choice=document.querySelector('input[name="r662-snapshot-choice"]:checked'),list=clone(S.g('inventory_snapshot_index_'+deptId)||[]),item=choice&&list.find(function(x){return String(x.id)===String(choice.value)});
  if(!item)return typeof toast==='function'?toast('Choose a snapshot first.','err'):false;
  var meds=clone(S.g(item.medsKey)||[]),expiry=clone(S.g(item.expiryKey)||[]);
  var yes=typeof uiConfirm==='function'?await uiConfirm('Restore '+deptName(deptId)+' to '+new Date(item.at).toLocaleString()+'?\\n\\nCurrent medications: '+medsRaw(deptId).length+'\\nSnapshot medications: '+meds.length+'\\n\\nA safety snapshot of the current state will be created first.'):window.confirm('Restore selected inventory snapshot?');
  if(!yes)return false;
  var button=document.getElementById('r662-restore-snapshot');if(button){button.disabled=true;button.textContent='Restoring…'}
  try{
    await window.inventorySafetyApprovedBulk('master_snapshot_restore',function(){return setMeds(deptId,meds)});
    if(typeof setExpiry==='function')await setExpiry(deptId,expiry);
    if(typeof auditAction==='function')auditAction('inventory_snapshot_restored',{deptId:deptId,snapshotId:item.id,snapshotAt:item.at,medCount:meds.length,expiryCount:expiry.length});
    var modal=document.getElementById('r662-snapshot-modal');if(modal)modal.remove();
    if(typeof renderInv==='function')renderInv();if(typeof toast==='function')toast('Inventory snapshot restored ✓','succ');return true
  }catch(error){console.error(error);if(typeof toast==='function')toast('Snapshot restore failed: '+String(error&&error.message||error),'err');return false}
  finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Restore selected snapshot'}}
};
window.undoLatestInventorySafetySnapshot=async function(){
  if(!masterAllowed())return typeof toast==='function'?toast('Master permission required.','err'):false;
  var deptId=typeof getInvDept==='function'?String(getInvDept()||''):'',index=deptId?clone(S.g('inventory_snapshot_index_'+deptId)||[]):[];
  if(!deptId||!index.length)return typeof toast==='function'?toast('No inventory safety snapshot is available for this department.','info'):false;
  var item=index[0],meds=clone(S.g(item.medsKey)||[]),expiry=clone(S.g(item.expiryKey)||[]);
  var yes=typeof uiConfirm==='function'?await uiConfirm('Restore '+deptName(deptId)+' to '+new Date(item.at).toLocaleString()+'?\\nMedication records: '+meds.length):window.confirm('Restore latest inventory snapshot?');
  if(!yes)return false;
  await window.inventorySafetyApprovedBulk('undo_snapshot',function(){return setMeds(deptId,meds)});
  if(typeof setExpiry==='function')await setExpiry(deptId,expiry);
  if(typeof renderInv==='function')renderInv();
  if(typeof toast==='function')toast('Department inventory snapshot restored ✓','succ');return true
};
/* No login-time inventory mutation is permitted. */
window.seed=async function(){return {status:'disabled-on-login'}};
window.repairImportedDepartmentAliases=async function(){return {status:'disabled-on-login'}};
window.fsR17MigrateMedicationIdentity=async function(){return {status:'disabled-on-login'}};
window.repairLatestInventoryMergeCollateral=async function(){return {status:'removed-in-r661'}};
function disableUnsafeMergeButtons(){
  document.querySelectorAll('.sim-manual-merge-btn,.sim-merge-btn').forEach(function(b){b.disabled=true;b.classList.add('r661-merge-disabled');b.title='Disabled by R6.64 inventory safety. Use exact selected-name merge with preview.'})
}
function showSafety(){
  if(!window.CU)return;
  var f=totalAndHash();console.info(VERSION+' protected · '+f.count+' medications · fingerprint '+f.hash);disableUnsafeMergeButtons();ensureSnapshotManager()
}
function verifyStartup(){
  var current=totalAndHash();
  if(startFingerprint&&(current.count!==startFingerprint.count||current.hash!==startFingerprint.hash)){
    setSafety(VERSION+' ALERT: inventory changed during startup ('+startFingerprint.count+' → '+current.count+'). No automatic save was authorized.',true);
    if(typeof auditAction==='function')auditAction('inventory_startup_integrity_alert',{before:startFingerprint,after:current})
  }
}
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){
  startFingerprint=totalAndHash();var result=previousStart.apply(this,arguments);
  setTimeout(showSafety,500);setTimeout(verifyStartup,2600);return result
};
new MutationObserver(function(mutations){
  var relevant=mutations.some(function(m){return Array.from(m.addedNodes||[]).some(function(node){return node.nodeType===1&&(node.matches&&node.matches('.sim-manual-merge-btn,.sim-merge-btn,#similar-medicines-modal-v2')||node.querySelector&&node.querySelector('.sim-manual-merge-btn,.sim-merge-btn'))})});
  if(relevant)disableUnsafeMergeButtons()
}).observe(document.body,{childList:true,subtree:true});
document.title='ASDHealth FloorStock R6.65 Modular Protected';
})();

export {};

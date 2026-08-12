(function(){
'use strict';
const E=globalThis.E;
function escF(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nF(v){var n=Number(v);return isFinite(n)?n:0}
function normF(v){return String(v==null?'':v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim().replace(/\s+/g,' ')}
function roleF(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function deptNameF(id){var d=(typeof window.gd==='function'?(gd()||[]):[]).find(function(x){return String(x.id)===String(id)});return d&&d.name?d.name:String(id||'')}
function currentDeptF(){return roleF()==='department'?String((CU&&CU.deptId)||''):(typeof window.ctlCurrentDept==='function'?String(ctlCurrentDept()||''):'')}

/* Stop the old workbook seed from creating duplicate departments such as MMW. */
window.seed=async function(){
  var depts=typeof window.gd==='function'?(gd()||[]):[];
  if(!depts.length){depts=[{id:'icu',name:'ICU',created:typeof nowISO==='function'?nowISO():new Date().toISOString()},{id:'ed',name:'Emergency Dept',created:typeof nowISO==='function'?nowISO():new Date().toISOString()}];await S.s('departments',depts)}
  var jobs=[];depts.forEach(function(d){var key='controlled_settings_'+d.id;if(!S.g(key))jobs.push(S.s(key,{custodyOfficer:'',departmentSupervisor:'',pharmacyManager:'صيدلي / عظيمان غنام القحطاني'}))});
  if(jobs.length)await Promise.all(jobs);return true
};

var SEED_ALIASES={
  'NICU':['nicu','neonatal intensive care unit','neonatal icu','newborn intensive care unit','العناية المركزة لحديثي الولادة','العناية المركزة للمواليد'],
 'Emergency':['emergency','emergency dept','emergency department','ed','er'],
 'ICU':['icu','intensive care','intensive care unit'],
 'ANESTHESIA':['anesthesia','anaesthesia','anesthesiology','operating room anesthesia'],
 'MMW':['male medical','male medical ward','mmw'],
 'MSW':['male surgical','male surgical ward','msw'],
 'FMW':['female medical','female medical ward','fmw'],
 'CCU':['ccu','coronary care','coronary care unit','cardiac care','cardiac care unit'],
 'FSW':['female surgical','female surgical ward','fsw'],
 'OBW':['obw','obstetric ward','obstetrics ward','maternity ward','ob gyn ward'],
 'PEDIA':['pedia','pediatric','pediatrics','pediatric ward','paediatric','paediatrics'],
 'Nursery':['nursery','neonatal nursery'],
 'ENDOSCOPY UNIT':['endoscopy','endoscopy unit'],
 'AKU':['aku','artificial kidney unit','dialysis unit','hemodialysis unit'],
 'HOME CARE':['home care','homecare']
};
function resolveSeedDeptF(label,depts,excludeId){
  var aliases=(SEED_ALIASES[label]||[label]).map(normF),candidates=(depts||[]).filter(function(d){return String(d.id)!==String(excludeId||'')&&aliases.indexOf(normF(d.name))>=0});
  if(candidates.length===1)return candidates[0];
  if(candidates.length>1){
    candidates.sort(function(a,b){return deptDataScoreF(b.id)-deptDataScoreF(a.id)});return candidates[0]
  }
  return null
}
function deptDataScoreF(id){
  var score=0;
  try{score+=(S.g('meds_'+id)||[]).length*4}catch(e){}
  try{score+=(S.g('expiry_'+id)||[]).length*2}catch(e){}
  try{score+=(S.g('shelves_'+id)||[]).length}catch(e){}
  try{score+=(typeof crashCarts==='function'?(crashCarts()||[]):[]).filter(function(c){return String(c.deptId)===String(id)}).length*12}catch(e){}
  try{score+=(S.g('requests')||[]).filter(function(r){return String(r.deptId)===String(id)}).length*3}catch(e){}
  try{score+=(S.g('users')||[]).filter(function(u){return String(u.deptId)===String(id)}).length*15}catch(e){}
  return score
}
function mergeUniqueF(a,b,keyFn){var out=(Array.isArray(a)?a:[]).slice(),seen={};out.forEach(function(x){seen[keyFn(x)]=1});(Array.isArray(b)?b:[]).forEach(function(x){var k=keyFn(x);if(!seen[k]){seen[k]=1;out.push(x)}});return out}
async function moveStateKeyF(prefix,fromId,toId,kind){
  var fromKey=prefix+fromId,toKey=prefix+toId,from=S.g(fromKey),to=S.g(toKey);
  if(from==null)return;
  var merged=to;
  if(Array.isArray(from)){
    if(kind==='meds')merged=mergeUniqueF(to,from,function(x){return normF((x&&x.name)||'')+'|'+String((x&&x.id)||'')});
    else if(kind==='controlled')merged=mergeUniqueF(to,from,function(x){return String((x&&x.medId)||'')});
    else merged=mergeUniqueF(to,from,function(x){return String((x&&x.id)||'')+'|'+normF((x&&x.name)||'')});
  }else if(typeof from==='object')merged=Object.assign({},from,to||{});
  else if(to==null)merged=from;
  if(merged!=null)await S.s(toKey,merged);
  try{await S.rm(fromKey)}catch(e){}
}
async function repairImportedDepartmentAliasesF(){
  if(!window.S||!S.ready||typeof window.gd!=='function')return false;
  var depts=(gd()||[]).slice(),changed=false;
  for(var label in SEED_ALIASES){
    var synthetic=depts.find(function(d){return normF(d.name)===normF(label)});
    if(!synthetic)continue;
    var canonical=resolveSeedDeptF(label,depts,synthetic.id);
    if(!canonical)continue;
    /* Keep the human department record and migrate any accidental data from the abbreviation. */
    await moveStateKeyF('meds_',synthetic.id,canonical.id,'meds');
    await moveStateKeyF('expiry_',synthetic.id,canonical.id,'generic');
    await moveStateKeyF('shelves_',synthetic.id,canonical.id,'generic');
    await moveStateKeyF('alerts_',synthetic.id,canonical.id,'generic');
    await moveStateKeyF('controlled_dept_list_',synthetic.id,canonical.id,'controlled');
    await moveStateKeyF('controlled_settings_',synthetic.id,canonical.id,'settings');
    var carts=typeof crashCarts==='function'?(crashCarts()||[]).slice():[],cartChanged=false;
    carts.forEach(function(c){if(String(c.deptId)===String(synthetic.id)){c.deptId=canonical.id;cartChanged=true}});if(cartChanged&&typeof setCrashCarts==='function')await setCrashCarts(carts);
    var requests=(S.g('requests')||[]).slice(),reqChanged=false;requests.forEach(function(r){if(String(r.deptId)===String(synthetic.id)){r.deptId=canonical.id;reqChanged=true}});if(reqChanged)await S.s('requests',requests);
    var notes=(S.g('notes')||[]).slice(),noteChanged=false;notes.forEach(function(r){if(String(r.deptId)===String(synthetic.id)){r.deptId=canonical.id;noteChanged=true}});if(noteChanged)await S.s('notes',notes);
    depts=depts.filter(function(d){return String(d.id)!==String(synthetic.id)});changed=true
  }
  if(changed){await S.s('departments',depts);S.cache.departments=depts}
  return changed
}

/* Ensure the controlled workbook maps into existing hospital departments and never creates new abbreviations. */
var ctlSeedStartedF=false;
window.ctlEnsureDepartmentSeed=async function(){
  if(ctlSeedStartedF||!window.S||!S.ready||!window.CU)return;
  if(S.g('controlled_department_seed_v2'))return;
  var canSeed=(typeof ctlIsMaster==='function'&&ctlIsMaster())||(typeof ctlIsOfficer==='function'&&ctlIsOfficer());if(!canSeed)return;
  ctlSeedStartedF=true;
  try{
    var depts=(gd()||[]).slice(),cat=typeof ctlCatalog==='function'?(ctlCatalog()||[]).map(function(m){return Object.assign({},m)}):[],jobs=[],catChanged=false;
    [].forEach(function(label){
      var dept=resolveSeedDeptF(label,depts,'');if(!dept)return;
      if(typeof ctlDeptList==='function'&&ctlDeptList(dept.id).length)return;
      var list=[];[].forEach(function(r){
        var med=cat.find(function(m){return (r.moh&&m.moh===r.moh)||normF(m.name)===normF(r.name)});
        if(!med){med={id:(typeof ctlKey==='function'?ctlKey(r.moh,'',r.name):('ctl_'+Date.now()+'_'+Math.random().toString(36).slice(2,6))),moh:r.moh||'',nupco:'',name:r.name,classification:'narcotic',highAlert:false,lasa:false,refrigerated:false,min:r.min||0,max:r.max||0};cat.push(med);catChanged=true}
        list.push({medId:med.id,min:r.min||0,max:r.max||0,requiredQty:r.max||0,qty:r.qty||0,actualQty:r.qty||0,batches:(r.expiries||[]).map(function(d){return {qty:0,expiry:d,lot:''}})})
      });
      if(typeof ctlSetDeptList==='function')jobs.push(ctlSetDeptList(dept.id,list))
    });
    if(catChanged&&typeof ctlSetCatalog==='function')jobs.push(ctlSetCatalog(cat));
    if(jobs.length)await Promise.all(jobs);
    await S.s('controlled_department_seed_v2',true);return true
  }catch(e){console.error('Controlled department seed failed:',e);ctlSeedStartedF=false;return false}
};

/* Run once after the canonical state load; the login flow invokes this explicitly. */
window.repairImportedDepartmentAliases=repairImportedDepartmentAliasesF;

/* One exact custody print generator shared by the officer and the department employee. */
function fmtDateF(v){if(!v)return '—';try{if(typeof ctlFmtDMY==='function')return ctlFmtDMY(v);var d=new Date(String(v).slice(0,10)+'T00:00:00');return isNaN(d.getTime())?String(v):String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()}catch(e){return String(v)}}
function batchLinesF(batches){var a=Array.isArray(batches)?batches:[];return a.length?a.map(function(b){return (b.qty!=null&&b.qty!==''?escF(nF(b.qty))+' → ':'')+escF(fmtDateF(b.expiry))+(b.lot?' — '+escF(b.lot):'')}).join('<br>'):'—'}
function codeModeF(dept,override){var s=typeof ctlPrintSettings==='function'?(ctlPrintSettings(dept)||{}):{},m=String(override||s.printCodeMode||'nupco');return ['none','moh','nupco','both'].indexOf(m)>=0?m:'nupco'}


function cleanupDepartmentPrintUiF(){
  var host=E('ctl-departments-view');if(!host)return;var old=E('ctl-dept-authoritative-print-btn');
  if(roleF()!=='department'){if(old)old.remove();return}
  ['aa-final-rules-btn-dept'].forEach(function(id){var x=E(id);if(x)x.remove()});
  host.querySelectorAll('button').forEach(function(b){var t=(b.textContent||'').toLowerCase(),oc=String(b.getAttribute('onclick')||'');if(b.id==='ctl-dept-authoritative-print-btn')return;if(t.indexOf('print')>=0||t.indexOf('طباعة')>=0||/PrintNames|OpenPublic|ctlChooseLogo/.test(oc))b.remove()});
  var bar=host.querySelector('.ch .fl')||host.querySelector('.ch');if(!bar)return;var btn=E('ctl-dept-authoritative-print-btn');if(!btn){btn=document.createElement('button');btn.id='ctl-dept-authoritative-print-btn';btn.type='button';btn.className='btn bp bsm';btn.textContent='🖨 Print department custody / طباعة عهدة القسم';btn.onclick=function(ev){return window.ctlConfirmDepartmentPrint(ev)};bar.appendChild(btn)}
}

/* Correct the expiry editor: read the actual .v13x-batch rows shown in the modal. */
function readBatchesFinalF(){var h=E('v13x-stock-batches');if(!h)return [];return Array.from(h.querySelectorAll('.v13x-batch,.v13x-batch-row,.batch-editor-row')).map(function(r){var q=r.querySelector('.v13x-bqty,.v13x-bq,.be-qty,input[type="number"]'),d=r.querySelector('.v13x-bdate,.v13x-be,.be-exp,input[type="date"]'),l=r.querySelector('.v13x-blot,.v13x-bl,.be-lot,input[placeholder*="lot" i],input[placeholder*="batch" i]');return {qty:nF(q&&q.value),expiry:String((d&&d.value)||'').trim(),lot:String((l&&l.value)||'').trim()}}).filter(function(b){return b.qty||b.expiry||b.lot})}
function validateBatchesFinalF(actual,batches){if(actual<0)return {error:'Actual quantity cannot be negative / الكمية الفعلية لا يمكن أن تكون سالبة'};if(actual===0)return {batches:[]};if(!batches.length)return {error:'At least one expiry date is required when quantity is positive. Batch/Lot is optional / تاريخ الانتهاء مطلوب للكمية الموجبة، ورقم التشغيلة اختياري'};if(batches.length===1&&batches[0].expiry&&!(batches[0].qty>0))batches[0].qty=actual;for(var i=0;i<batches.length;i++){if(!(batches[i].qty>0))return {error:'Every expiry row requires a quantity greater than zero / كل تاريخ يحتاج كمية أكبر من صفر'};if(!batches[i].expiry)return {error:'Expiry date is required for every entered quantity; Batch/Lot remains optional / التاريخ مطلوب لكل كمية ورقم التشغيلة اختياري'}}var total=batches.reduce(function(a,b){return a+nF(b.qty)},0);if(total!==actual)return {error:'Expiry quantities must equal the actual quantity. Total: '+total+' / Actual: '+actual};return {batches:batches}}
window.v13XSaveStock=async function(){var status=E('v13x-stock-save-status');function state(m,c){if(status){status.textContent=m||'';status.className=c||''}}var id=(E('v13x-stock-id')||{}).value||'',scope=(E('v13x-stock-scope')||{}).value||'',qty=nF((E('v13x-stock-qty')||{}).value),required=nF((E('v13x-stock-required')||{}).value),check=validateBatchesFinalF(qty,readBatchesFinalF());if(check.error){state(check.error,'err');if(window.toast)toast(check.error,'err');return false}state('Saving… / جاري الحفظ','saving');try{if(scope==='pharmacy'){var ph=Object.assign({},ctlPharmacy()),px=Object.assign({},ph[id]||{});px.qty=qty;px.actualQty=qty;px.batches=check.batches;ph[id]=px;await ctlSetPharmacy(ph)}else{var dept=typeof ctlCurrentDept==='function'?ctlCurrentDept():'';if(!dept)throw new Error('Select a department first / اختر القسم أولاً');var list=(ctlDeptList(dept)||[]).slice(),ix=list.findIndex(function(x){return String(x.medId)===String(id)});if(ix<0)throw new Error('Medicine not found in department custody / العلاج غير موجود في عهدة القسم');list[ix]=Object.assign({},list[ix],{qty:qty,actualQty:qty,requiredQty:required,batches:check.batches});await ctlSetDeptList(dept,list);}state('Saved ✓ / تم الحفظ','succ');if(typeof v13XClose==='function')v13XClose('v13x-stock-modal');else if(typeof CM==='function')CM('v13x-stock-modal');if(typeof renderControlled==='function')renderControlled();return true}catch(e){console.error(e);state(String(e&&e.message||e),'err');if(window.toast)toast(String(e&&e.message||e),'err');return false}};
function prepareStockModalF(){var modal=E('v13x-stock-modal');if(!modal)return;modal.querySelectorAll('.v13x-batch input,.v13x-batch-row input,.batch-editor-row input').forEach(function(x){x.required=false});var host=E('v13x-stock-batches'),note=E('v13aq-expiry-summary');if(!note&&host){note=document.createElement('div');note.id='v13aq-expiry-summary';note.className='alert-banner-y';host.parentNode.insertBefore(note,host)}if(note)note.innerHTML='<b>Lot/Batch is optional.</b> Expiry is required only when actual quantity is greater than zero.';var st=E('v13x-stock-save-status');if(!st){st=document.createElement('div');st.id='v13x-stock-save-status';var actions=modal.querySelector('.modal .fl.g8');if(actions)actions.parentNode.insertBefore(st,actions)}}
window.ctlEditDeptMedicine=function(id){
  if(typeof ctlCanEditDept==='function'&&!ctlCanEditDept()){
    return toast('No permission to edit inpatient controlled custody.','err');
  }
  if(typeof window.openControlledDepartmentStockEditor!=='function'){
    console.error('Controlled department stock editor is unavailable.');
    return toast('The department medicine editor could not be opened.','err');
  }
  window.openControlledDepartmentStockEditor(id);
  prepareStockModalF();
  return true;
};

/* Clear every old role class before rebuilding the application. */
var ROLE_CLASSES_F=['role-pharmacy','role-inpatient_supervisor','role-pharmacy_staff','role-controlled_pharmacy','role-warehouse','role-department'];
function clearRoleUiF(){ROLE_CLASSES_F.forEach(function(c){document.body.classList.remove(c)});document.querySelectorAll('.pg').forEach(function(p){p.style.removeProperty('display')});document.querySelectorAll('.modal-bg.on').forEach(function(m){m.classList.remove('on')})}
window.prepareRoleUiStart=function(){clearRoleUiF();window.CTL_VIEW=roleF()==='department'?'departments':'overview'};
window.finalizeRoleUiStart=function(){cleanupDepartmentPrintUiF()};


window.cleanupDepartmentPrintUi=cleanupDepartmentPrintUiF;

/* Clear stale department filters after the repaired list is loaded. */
function resetInvalidDeptSelectorsF(){var ids=(gd()||[]).map(function(d){return String(d.id)});['inv-dept-sel','ccx-dept','ctl-dept'].forEach(function(id){var s=E(id);if(s&&s.value&&ids.indexOf(String(s.value))<0)s.value=''})}
window.floorstockResetInvalidDepartmentSelectors=resetInvalidDeptSelectorsF;
window.floorstockDepartmentAliases=SEED_ALIASES;
})();

export {};

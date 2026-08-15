(function(){
'use strict';
const E=globalThis.E;
function escH(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v){var x=Number(v);return isFinite(x)?x:0}
function openM(id){var m=E(id);if(m)m.classList.add('on')}
function closeM(id){var m=E(id);if(m)m.classList.remove('on')}
function toast2(msg,type){if(typeof window.toast==='function')window.toast(msg,type||'info');else alert(msg)}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function currentDept(){return typeof window.ctlCurrentDept==='function'?ctlCurrentDept():((window.CU&&CU.deptId)||'')}
function settingsFor(dept){return (window.S&&S.g)?(S.g('controlled_settings_'+dept)||{}):{}}
function createModals(){
 if(!E('v13-final-sign-modal')){
  var a=document.createElement('div');a.id='v13-final-sign-modal';a.className='modal-bg v13-final-modal';a.innerHTML='<div class="modal"><div class="mh"><span class="mt">Edit custody print details / تعديل بيانات طباعة العهدة</span><button class="xbtn" type="button" data-close="v13-final-sign-modal">✕</button></div><div class="v13-final-grid"><div class="fg"><label>Head nurse / رئيس تمريض القسم</label><input id="v13-final-head-nurse"></div><div class="fg"><label>Controlled Medicines Officer / مسؤول الأدوية المخدرة والمقيدة</label><input id="v13-final-controlled-officer"></div><div class="fg"><label>Pharmacy manager / مدير الصيدلية</label><input id="v13-final-pharmacy-manager"></div><div class="fg"><label>Print code mode / أكواد الطباعة</label><select id="v13-final-code-mode"><option value="none">No codes / بدون أكواد</option><option value="moh">MOH only / الوزاري فقط</option><option value="nupco">NUPCO only / نوبكو فقط</option><option value="both">MOH + NUPCO / الوزاري + نوبكو</option></select></div></div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bg" type="button" data-close="v13-final-sign-modal">Cancel</button><button class="btn bp" type="button" id="v13-final-save-sign">Save</button></div></div>';document.body.appendChild(a)
 }
 if(!E('v13-final-bulk-modal')){
  var b=document.createElement('div');b.id='v13-final-bulk-modal';b.className='modal-bg v13-final-modal';b.innerHTML='<div class="modal"><div class="mh"><span class="mt">Bulk edit one medication across departments</span><button class="xbtn" type="button" data-close="v13-final-bulk-modal">✕</button></div><div class="v13-final-grid"><div class="fg"><label>Medication</label><select id="v13-final-bulk-med"></select></div><div class="fg"><label>Quantity operation</label><select id="v13-final-bulk-qty-op"><option value="keep">Keep current quantity</option><option value="unavailable">Mark unavailable (0)</option><option value="set">Set exact quantity</option><option value="adjust">Add / deduct quantity</option></select></div><div class="fg"><label>Quantity / adjustment</label><input id="v13-final-bulk-qty" type="number" value="0"><div class="fhint">Use -1 to deduct one unit.</div></div><div class="fg"><label>Expiry operation</label><select id="v13-final-bulk-exp-op"><option value="keep">Keep current expiry</option><option value="add">Add expiry batch</option><option value="replace">Replace all expiry batches</option></select></div><div class="fg"><label>Expiry date</label><input id="v13-final-bulk-expiry" type="date"></div><div class="fg"><label>Quantity linked to this expiry</label><input id="v13-final-bulk-exp-qty" type="number" min="0" value="0"></div></div><div class="fl g8 ic" style="margin:8px 0"><button class="btn bg bsm" type="button" id="v13-final-select-all">Select all departments</button><span id="v13-final-selected-count" class="fhint"></span></div><div id="v13-final-bulk-scope" class="v13-final-scope"></div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bg" type="button" data-close="v13-final-bulk-modal">Cancel</button><button class="btn bp" type="button" id="v13-final-apply-bulk">Apply to selected departments</button></div></div>';document.body.appendChild(b)
 }
 document.querySelectorAll('[data-close]').forEach(function(x){x.onclick=function(){closeM(x.dataset.close)}})
 E('v13-final-save-sign').onclick=saveSignatures;
 E('v13-final-bulk-med').onchange=renderBulkDepartments;
 E('v13-final-select-all').onclick=toggleAllBulk;
 E('v13-final-apply-bulk').onclick=applyBulk;
 if(typeof window.extendControlledBulkUi==='function')window.extendControlledBulkUi();
}
window.ctlEditSignatures=function(){
  createModals();
  var dept=currentDept();
  if(!dept)return toast2('Choose an inpatient department first.','err');
  var settings=settingsFor(dept);
  E('v13-final-head-nurse').value=settings.nursingHead||'';
  E('v13-final-controlled-officer').value=settings.controlledOfficer||settings.controlledPharmacyOfficer||'';
  E('v13-final-pharmacy-manager').value=settings.pharmacyManager||'';
  E('v13-final-code-mode').value=settings.printCodeMode||'both';
  openM('v13-final-sign-modal');
  var focus=E('v13-final-head-nurse');
  if(focus)focus.focus();
};
async function saveSignatures(){
  var dept=currentDept();
  if(!dept)return toast2('Choose an inpatient department first.','err');
  var settings=Object.assign({},settingsFor(dept));
  settings.nursingHead=E('v13-final-head-nurse').value.trim();
  settings.controlledOfficer=E('v13-final-controlled-officer').value.trim();
  settings.controlledPharmacyOfficer=settings.controlledOfficer;
  settings.pharmacyManager=E('v13-final-pharmacy-manager').value.trim();
  settings.printCodeMode=E('v13-final-code-mode').value||'both';
  try{
    await S.s('controlled_settings_'+dept,settings);
    closeM('v13-final-sign-modal');
    toast2('Signatures saved for this department ✓','succ');
    if(typeof renderControlled==='function')renderControlled();
  }catch(error){
    toast2(error&&error.message||'Could not save signatures.','err');
  }
}

function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
function renderBulkDepartments(){
 var med=E('v13-final-bulk-med').value,host=E('v13-final-bulk-scope');if(!med){host.innerHTML='<div class="fhint" style="padding:12px">Choose a medication.</div>';return}var depts=typeof gd==='function'?(gd()||[]):[];var rows=[];depts.forEach(function(d){var list=typeof ctlDeptList==='function'?(ctlDeptList(d.id)||[]):[];var item=list.find(function(x){return String(x.medId)===String(med)});if(item)rows.push({dept:d,item:item})});host.innerHTML=rows.length?rows.map(function(r){return '<label><input type="checkbox" class="v13-final-dept-check" data-dept="'+escH(r.dept.id)+'"><span><b>'+escH(r.dept.name)+'</b><br><small>Current qty: '+n(r.item.qty)+' · Expiry batches: '+((r.item.batches||[]).length)+'</small></span></label>'}).join(''):'<div class="fhint" style="padding:12px">This medication is not assigned to any inpatient department.</div>';host.querySelectorAll('input').forEach(function(x){x.onchange=updateBulkCount});updateBulkCount()
}
function updateBulkCount(){var c=document.querySelectorAll('.v13-final-dept-check:checked').length;E('v13-final-selected-count').textContent=c+' department(s) selected'}
function toggleAllBulk(){var boxes=Array.from(document.querySelectorAll('.v13-final-dept-check'));var on=boxes.some(function(x){return !x.checked});boxes.forEach(function(x){x.checked=on});E('v13-final-select-all').textContent=on?'Clear selection':'Select all departments';updateBulkCount()}
async function applyBulk(){
 var med=E('v13-final-bulk-med').value;var selected=Array.from(document.querySelectorAll('.v13-final-dept-check:checked'));if(!med)return toast2('Select a medication.','err');if(!selected.length)return toast2('Select at least one department.','err');var qop=E('v13-final-bulk-qty-op').value,qv=n(E('v13-final-bulk-qty').value),eop=E('v13-final-bulk-exp-op').value,date=E('v13-final-bulk-expiry').value,eq=Math.max(0,n(E('v13-final-bulk-exp-qty').value));if(eop!=='keep'&&!date)return toast2('Choose an expiry date.','err');var changed=0;
 try{for(var i=0;i<selected.length;i++){var dept=selected[i].dataset.dept;var list=(ctlDeptList(dept)||[]).map(function(x){return Object.assign({},x,{batches:(x.batches||[]).map(function(b){return Object.assign({},b)})})});var item=list.find(function(x){return String(x.medId)===String(med)});if(!item)continue;var cur=n(item.qty);if(qop==='unavailable')item.qty=0;else if(qop==='set')item.qty=Math.max(0,qv);else if(qop==='adjust')item.qty=Math.max(0,cur+qv);if(eop==='replace')item.batches=[];if(eop==='add'||eop==='replace'){item.batches=item.batches||[];item.batches.push({expiry:date,qty:eq,lot:''})}await ctlSetDeptList(dept,list);changed++}closeM('v13-final-bulk-modal');toast2(changed+' department(s) updated ✓','succ');if(typeof auditAction==='function')auditAction('controlled_bulk_department_medication_edit',{medId:med,departments:changed,quantityOperation:qop,expiryOperation:eop});if(typeof renderControlled==='function')renderControlled()}catch(e){toast2(e&&e.message||'Bulk update failed.','err')}
}
async function persistPrintOrdersMeta(ids){
  var requests=typeof gr==='function'?(gr()||[]):[];
  var actor=typeof actualActorName==='function'?actualActorName():'';
  var actorUser=typeof actualUser==='function'?actualUser():null;
  var when=typeof nowISO==='function'?nowISO():new Date().toISOString();
  if(window.S&&S.upd){
    await Promise.all(ids.map(function(id){
      var r=requests.find(function(x){return String(x.id)===String(id)});
      if(!r)return Promise.resolve();
      return S.upd('requests',id,{printCount:(r.printCount||0)+1,lastPrintedAt:when,lastPrintedBy:actor,lastPrintedById:(actorUser&&actorUser.id)||'',lastPrintedEffectiveRole:(window.CU&&CU.role)||''});
    }));
  }
  if(typeof auditAction==='function')await Promise.resolve(auditAction('requests_printed',{requestIds:ids}));
}
window.persistPrintOrdersMeta=persistPrintOrdersMeta;


})();
export {};

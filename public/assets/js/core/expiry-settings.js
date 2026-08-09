function renderShelfAlertSettings(){
  var user=globalThis.CU;if(!user||user.role!=='department')return;
  var cfg=globalThis.getAlertSettings(user.deptId);
  if(globalThis.el('alert-days1'))globalThis.el('alert-days1').value=cfg.d1||30;
  if(globalThis.el('alert-days2'))globalThis.el('alert-days2').value=cfg.d2||7;
}
function openAddExpiry(){
  globalThis.el('mexpiry-title').textContent='Add Expiry / إضافة تاريخ صلاحية';
  var meds=globalThis.getMeds(globalThis.CU.deptId);
  globalThis.el('exp-med-sel').innerHTML=meds.map(function(m){return '<option value="'+globalThis.esc(m.id)+'">'+globalThis.esc(m.name)+'</option>'}).join('');
  globalThis.el('exp-batch-inp').value='';globalThis.el('exp-date-inp').value='';globalThis.el('exp-edit-id').value='';globalThis.OM('mexpiry');
}
function openEditExpiry(button){
  globalThis.el('mexpiry-title').textContent='Edit Expiry / تعديل تاريخ الصلاحية';
  var meds=globalThis.getMeds(globalThis.CU.deptId);
  globalThis.el('exp-med-sel').innerHTML=meds.map(function(m){return '<option value="'+globalThis.esc(m.id)+'"'+(m.id===button.dataset.mid?' selected':'')+'>'+globalThis.esc(m.name)+'</option>'}).join('');
  globalThis.el('exp-batch-inp').value=button.dataset.batch||'';globalThis.el('exp-date-inp').value=button.dataset.date||'';globalThis.el('exp-edit-id').value=button.dataset.bid||'';globalThis.OM('mexpiry');
}
Object.assign(globalThis,{renderShelfAlertSettings,openAddExpiry,openEditExpiry});
export { renderShelfAlertSettings, openAddExpiry, openEditExpiry };

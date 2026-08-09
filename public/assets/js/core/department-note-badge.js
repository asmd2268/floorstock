function updateNotesBadge(){
  var role=globalThis.fsEffectiveRole?globalThis.fsEffectiveRole():String((globalThis.CU&&globalThis.CU.role)||'');
  var dept=role==='outpatient_pharmacy_supervisor'&&globalThis.fsOutpatientDeptId?globalThis.fsOutpatientDeptId():'';
  var notes=globalThis.asdhDepartmentNoteStore.getNotes();
  var open=notes.filter(function(n){return (n.status==='open'||n.status==='urgent')&&(!dept||String(n.deptId)===String(dept))}).length;
  document.querySelectorAll('.nb').forEach(function(btn){
    if(btn.getAttribute('data-pg')==='pg-notes-ph')btn.innerHTML='📝 Notes'+(open>0?' <span style="background:var(--rd);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">'+open+'</span>':'');
  });
  var ownDept=globalThis.CU&&globalThis.CU.deptId;
  if(ownDept){
    var replies=notes.filter(function(n){return n.deptId===ownDept&&n.reply&&!n._replyRead}).length;
    document.querySelectorAll('.nb').forEach(function(btn){
      if(btn.getAttribute('data-pg')==='pg-notes-dept')btn.innerHTML='📝 Notes / ملاحظات'+(replies>0?' <span style="background:var(--gn);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">'+replies+'</span>':'');
    });
  }
}
globalThis.asdhUpdateNotesBadge=updateNotesBadge;
export { updateNotesBadge };

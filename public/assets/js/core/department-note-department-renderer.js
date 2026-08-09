function renderDeptNotes(){
  var user=globalThis.CU;
  if(!user||user.role!=='department')return;
  globalThis.el('notes-dept-sub').textContent=user.deptName+' — Notes & Feedback to Pharmacy';
  var notes=globalThis.asdhDepartmentNoteStore.getNotes().filter(function(n){return n.deptId===user.deptId}).slice().reverse();
  var list=globalThis.el('my-notes-list');
  if(!notes.length){list.innerHTML='<div style="text-align:center;padding:24px;color:var(--tx2)">No notes submitted yet</div>';return;}
  list.innerHTML=notes.map(function(n){
    var safeType=globalThis.asdhDepartmentNoteUtils.noteType(n.type),safeStatus=globalThis.asdhDepartmentNoteUtils.noteStatus(n.status),label=globalThis.NOTE_TYPE_LABELS[safeType]||safeType;
    var cls=safeStatus==='resolved'?'note-resolved':safeStatus==='urgent'?'note-urgent':'note-open';
    return '<div class="note-card '+cls+'"><div class="fl jb ic" style="flex-wrap:wrap;gap:6px"><div style="font-weight:600">'+globalThis.asdhDepartmentNoteUtils.noteEsc(n.medName)+(n.medName?' — ':'')+globalThis.asdhDepartmentNoteUtils.noteEsc(label)+'</div><span class="badge note-badge-'+safeStatus+'">'+globalThis.asdhDepartmentNoteUtils.noteEsc(safeStatus)+'</span></div><div style="margin-top:6px;color:var(--tx)">'+globalThis.asdhDepartmentNoteUtils.noteEsc(n.body)+'</div>'+(n.reply?'<div style="margin-top:8px;padding:8px 10px;background:rgba(46,160,67,.08);border-left:2px solid var(--gn);border-radius:4px;font-size:12px"><b>Pharmacy reply:</b> '+globalThis.asdhDepartmentNoteUtils.noteEsc(n.reply)+'</div>':'')+'<div class="note-meta"><span>'+globalThis.asdhDepartmentNoteUtils.noteEsc(globalThis.fmtDate(n.created))+'</span><span class="note-tag ntag-'+safeType+'">'+globalThis.asdhDepartmentNoteUtils.noteEsc(label)+'</span>'+(n.priority==='urgent'?'<span class="badge brd">🚨 Urgent</span>':'')+'</div></div>';
  }).join('');
}
globalThis.asdhRenderDeptNotes=renderDeptNotes;
export { renderDeptNotes };

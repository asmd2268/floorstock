function openNoteReply(id){
  var note=globalThis.asdhDepartmentNoteStore.getNotes().find(function(n){return n.id===id});
  if(!note)return;
  var status=globalThis.asdhDepartmentNoteUtils.noteStatus(note.status),esc=globalThis.asdhDepartmentNoteUtils.noteEsc;
  globalThis.el('mnote-content').innerHTML='<div style="font-weight:600;margin-bottom:4px">'+esc(note.deptName)+(note.medName?' — <span style="color:var(--tx2)">'+esc(note.medName)+'</span>':'')+' <span class="badge note-badge-'+status+'">'+esc(status)+'</span></div><div>'+esc(note.body)+'</div>'+(note.reply?'<div style="margin-top:6px;font-size:11px;color:var(--tx2)">Previous reply: '+esc(note.reply)+'</div>':'');
  globalThis.el('note-reply-txt').value=note.reply||'';
  globalThis.el('note-reply-status').value=note.status||'open';
  globalThis.el('note-reply-id').value=id;
  globalThis.OM('mnote-reply');
}
globalThis.asdhOpenNoteReply=openNoteReply;
export { openNoteReply };

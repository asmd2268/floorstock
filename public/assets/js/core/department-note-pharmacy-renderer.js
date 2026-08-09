function renderPharmNotes(){
  var el=globalThis.el, notesStore=globalThis.asdhDepartmentNoteStore, utils=globalThis.asdhDepartmentNoteUtils;
  var role=globalThis.fsEffectiveRole?globalThis.fsEffectiveRole():String((globalThis.CU&&globalThis.CU.role)||'');
  var filter=el('notes-filter-dept'), type=el('notes-filter-type'), status=el('notes-filter-status');
  var scope=role==='outpatient_pharmacy_supervisor'&&globalThis.fsOutpatientDeptId?globalThis.fsOutpatientDeptId():'';
  if(filter&&filter.options.length<=1){
    var departments=(globalThis.gd?globalThis.gd():[]).filter(function(d){return !scope||String(d.id)===String(scope)});
    departments.forEach(function(d){filter.innerHTML+='<option value="'+utils.noteEsc(d.id)+'">'+utils.noteEsc(d.name)+'</option>'});
  }
  if(filter&&scope){filter.value=scope;filter.disabled=true}
  var dept=filter?filter.value:'' , typ=type?type.value:'', stat=status?status.value:'';
  var notes=notesStore.getNotes().slice().reverse().filter(function(n){return (!scope||String(n.deptId)===String(scope))&&(!dept||n.deptId===dept)&&(!typ||n.type===typ)&&(!stat||n.status===stat)});
  var all=notesStore.getNotes(), summary=el('notes-summary');
  if(summary)summary.innerHTML='Total: <b>'+all.length+'</b> &nbsp;|&nbsp; Open: <b style="color:var(--yll)">'+all.filter(function(n){return n.status==='open'||n.status==='urgent'}).length+'</b>&nbsp;|&nbsp; Urgent: <b style="color:var(--rdl)">'+all.filter(function(n){return n.status==='urgent'}).length+'</b>';
  var list=el('pharm-notes-list'); if(!list)return;
  if(!notes.length){list.innerHTML='<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📝</div><div style="margin-top:10px">No notes matching filters</div></div>';return;}
  list.innerHTML=notes.map(function(n){
    var t=utils.noteType(n.type),s=utils.noteStatus(n.status),label=globalThis.NOTE_TYPE_LABELS[t]||t,id=utils.noteEsc(n.id),cls=s==='resolved'?'note-resolved':s==='urgent'?'note-urgent':'note-open';
    return '<div class="note-card '+cls+'" style="margin-bottom:10px"><div class="fl jb ic" style="flex-wrap:wrap;gap:8px"><div><span style="font-weight:700">'+utils.noteEsc(n.deptName)+'</span>'+(n.medName?'<span style="color:var(--tx2);font-size:12px"> &mdash; '+utils.noteEsc(n.medName)+'</span>':'')+'</div><div class="fl ic g8"><span class="badge note-badge-'+s+'">'+utils.noteEsc(s)+'</span>'+(n.priority==='urgent'?'<span class="badge brd">🚨 Urgent</span>':'')+'<button class="btn bp bxs" data-nid="'+id+'" data-note-action="reply">✏ Reply</button>'+(s!=='resolved'?'<button class="btn bs bxs" data-nid="'+id+'" data-note-action="resolve">✓ Resolve</button>':'')+'</div></div><div style="margin-top:8px;color:var(--tx)">'+utils.noteEsc(String(n.body||'').length>200?String(n.body||'').slice(0,200)+'...':n.body)+'</div>'+(n.reply?'<div style="margin-top:8px;padding:8px 10px;background:rgba(46,160,67,.08);border-left:2px solid var(--gn);border-radius:4px;font-size:12px"><b>Reply:</b> '+utils.noteEsc(n.reply)+'</div>':'')+'<div class="note-meta"><span>'+utils.noteEsc(globalThis.fmtDate(n.created))+'</span><span style="font-family:var(--mono);font-size:10px">'+utils.noteEsc(n.username)+'</span><span class="note-tag ntag-'+t+'">'+utils.noteEsc(label)+'</span></div></div>';
  }).join('');
  list.querySelectorAll('[data-note-action]').forEach(function(button){button.addEventListener('click',function(){var id=button.dataset.nid;if(button.dataset.noteAction==='reply')globalThis.asdhOpenNoteReply(id);else if(typeof globalThis.quickResolve==='function')globalThis.quickResolve(id)})});
}
globalThis.asdhRenderPharmNotes=renderPharmNotes;
export { renderPharmNotes };

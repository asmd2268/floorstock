function noteEsc(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
}
function noteStatus(value){return ['open','urgent','resolved'].indexOf(String(value))>=0?String(value):'open'}
function noteType(value){return Object.prototype.hasOwnProperty.call(globalThis.NOTE_TYPE_LABELS,String(value))?String(value):'other'}
globalThis.asdhDepartmentNoteUtils=Object.freeze({noteEsc,noteStatus,noteType});
export { noteEsc, noteStatus, noteType };

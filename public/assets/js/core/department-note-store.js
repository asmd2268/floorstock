function getNotes(){return globalThis.S?.g('dept_notes')||[]}
function setNotes(items){return globalThis.S?.s('dept_notes',items)}
globalThis.asdhDepartmentNoteStore=Object.freeze({getNotes,setNotes});
export { getNotes, setNotes };

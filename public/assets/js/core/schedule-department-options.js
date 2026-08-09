/* Shared department selector options for schedule forms. */
function scheduleDepartmentOptions(){
  var departments=typeof globalThis.gd==='function'?globalThis.gd():[];
  var escape=typeof globalThis.esc==='function'?globalThis.esc:function(v){return String(v??'')};
  return '<option value="all">All Departments</option>'+departments.map(function(d){return '<option value="'+escape(d.id)+'">'+escape(d.name)+'</option>'}).join('');
}
globalThis.scheduleDepartmentOptions=scheduleDepartmentOptions;
export {scheduleDepartmentOptions};

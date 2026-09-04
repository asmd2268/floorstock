/* Shared department selector options for schedule forms. */
function scheduleDepartmentOptions(){
  var departments=typeof globalThis.gd==='function'?globalThis.gd():[];
  var escape=typeof globalThis.esc==='function'?globalThis.esc:function(v){return String(v??'')};
  return '<option value="all">All Departments</option>'+departments.map(function(d){return '<option value="'+escape(d.id)+'">'+escape(d.name)+'</option>'}).join('');
}
function scheduleDepartmentName(id){
  if(!id||id==='all') return 'All Departments';
  var departments=typeof globalThis.gd==='function'?globalThis.gd():[];
  if(Array.isArray(id)){
    if(!id.length) return 'All Departments';
    return id.map(function(i){return (departments.find(function(d){return d.id===i})||{name:i}).name}).join(', ');
  }
  return (departments.find(function(d){return d.id===id})||{name:id}).name;
}
globalThis.scheduleDepartmentOptions=scheduleDepartmentOptions;
globalThis.scheduleDepartmentName=scheduleDepartmentName;
export {scheduleDepartmentOptions,scheduleDepartmentName};

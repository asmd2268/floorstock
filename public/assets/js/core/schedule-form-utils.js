/* Shared form initialization helpers for schedule dialogs. */
function setScheduleDepartmentSelect(select,value){if(!select)return;select.innerHTML=globalThis.scheduleDepartmentOptions();select.value=value||'all'}

/* Multi-select dept UI for dispense slots (populates #dslot-dept-list + #dslot-dept-all). */
function setScheduleDeptMulti(value){
  var allCb=document.getElementById('dslot-dept-all');
  var list=document.getElementById('dslot-dept-list');
  if(!allCb||!list)return;
  var departments=typeof globalThis.gd==='function'?globalThis.gd():[];
  var escape=typeof globalThis.esc==='function'?globalThis.esc:function(v){return String(v??'')};
  list.innerHTML=departments.map(function(d){return '<label style="display:flex;align-items:center;gap:8px;padding:4px 10px;cursor:pointer;margin:0"><input type="checkbox" value="'+escape(d.id)+'"/> '+escape(d.name)+'</label>';}).join('');
  var isAll=!value||value==='all';
  var selected=isAll?[]:Array.isArray(value)?value:[value];
  allCb.checked=isAll;
  list.querySelectorAll('input[type=checkbox]').forEach(function(c){c.checked=selected.indexOf(c.value)>-1;c.disabled=isAll;});
  list.style.opacity=isAll?'0.45':'1';
}

/* Read current selection from the multi-select UI. */
function getScheduleDeptSelection(){
  var allCb=document.getElementById('dslot-dept-all');
  if(!allCb||allCb.checked)return 'all';
  var selected=Array.from(document.querySelectorAll('#dslot-dept-list input[type=checkbox]:checked')).map(function(c){return c.value});
  return selected.length?selected:'all';
}

/* Toggle handler for "All Departments" checkbox. */
function dispSlotAllToggle(cb){
  var list=document.getElementById('dslot-dept-list');
  if(!list)return;
  list.querySelectorAll('input[type=checkbox]').forEach(function(c){c.checked=false;c.disabled=cb.checked;});
  list.style.opacity=cb.checked?'0.45':'1';
}

function setScheduleDays(container,days){if(!container)return;var selected=days||[];container.querySelectorAll('input').forEach(function(c){c.checked=selected.indexOf(+c.value)>-1})}

globalThis.setScheduleDepartmentSelect=setScheduleDepartmentSelect;
globalThis.setScheduleDeptMulti=setScheduleDeptMulti;
globalThis.getScheduleDeptSelection=getScheduleDeptSelection;
globalThis.dispSlotAllToggle=dispSlotAllToggle;
globalThis.setScheduleDays=setScheduleDays;
export {setScheduleDepartmentSelect,setScheduleDeptMulti,getScheduleDeptSelection,dispSlotAllToggle,setScheduleDays};

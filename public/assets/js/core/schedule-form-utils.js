/* Shared form initialization helpers for schedule dialogs. */
function setScheduleDepartmentSelect(select,value){if(!select)return;select.innerHTML=globalThis.scheduleDepartmentOptions();select.value=value||'all'}
function setScheduleDays(container,days){if(!container)return;var selected=days||[];container.querySelectorAll('input').forEach(function(c){c.checked=selected.indexOf(+c.value)>-1})}
globalThis.setScheduleDepartmentSelect=setScheduleDepartmentSelect;
globalThis.setScheduleDays=setScheduleDays;
export {setScheduleDepartmentSelect,setScheduleDays};

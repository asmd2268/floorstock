/* ASDHealth R6.65 Modular
 * Original script position: 27
 * Original id: inventory-name-merge-feature
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
  function normMerge(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
  function canMergeNames(){return !!(window.CU&&(CU.master===true||['pharmacy','pharmacy_director','inpatient_supervisor'].indexOf(CU.role)>-1))}
  function selectedMergeNames(){
    var names=[];document.querySelectorAll('#all-inv-body .all-inv-name-check:checked').forEach(function(c){var n=c.dataset.name||'';if(n&&!names.some(function(x){return normMerge(x)===normMerge(n)}))names.push(n)});return names;
  }
  window.updateAllInventoryMergeCount=function(){var n=selectedMergeNames().length,el=document.getElementById('all-inv-merge-count');if(el)el.textContent=n+' name(s) selected'};
    
  
  window.undoLatestInventoryNameMerge=async function(){
    if(!canMergeNames())return;var history=(S.g('inventory_name_merge_history')||[]).slice();if(!history.length)return toast('No merge history available.','info');var h=history[0];if(!(await uiConfirm('Undo latest merge into “'+h.canonical+'”?')))return;
    var ids=Object.keys(h.departments||{});for(var i=0;i<ids.length;i++){await setMeds(ids[i],h.departments[ids[i]]||[]);await setExpiry(ids[i],(h.expiry||{})[ids[i]]||[])}history.shift();await S.s('inventory_name_merge_history',history);if(typeof auditAction==='function')auditAction('inventory_names_merge_undone',{mergeId:h.id,canonical:h.canonical});var am=document.getElementById('all-inv-modal');if(am)am.remove();toast('Latest name merge undone.','succ');openAllDepartmentsInventory();
  };
  
})();

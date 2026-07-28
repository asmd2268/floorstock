(function(){
 function norm(v){return String(v==null?'':v).trim().replace(/[\s\-]/g,'').toLowerCase()}
 function catalog(){try{return ctlCatalog()||[]}catch(e){return []}}
 function byCode(code){var n=norm(code);if(!n)return null;return catalog().find(function(m){return norm(m.nupco)===n||norm(m.moh)===n})||null}
 function rowHtml(kind){
  var reqExp=kind==='dispense'?' required':'';
  return '<tr class="wh-bulk-row" data-kind="'+kind+'"><td><input class="wh-code" placeholder="NUPCO / MOH" oninput="whBulkResolveRow(this)"></td><td class="wh-match"><span class="wh-match-pending">Enter code</span></td><td><input class="wh-qty-input" type="number" min="1" step="1" placeholder="0"></td><td><input class="wh-exp-input" type="date"'+reqExp+'></td><td><input class="wh-lot-input" placeholder="Optional"></td><td><button class="btn bd2c bxs" type="button" onclick="this.closest(\'tr\').remove()">✕</button></td></tr>'
 }
 function add(kind){var box=document.getElementById(kind==='receive'?'wh-bulk-receive-rows':'wh-bulk-dispense-rows');if(box)box.insertAdjacentHTML('beforeend',rowHtml(kind))}
 window.whBulkAddReceiveRow=function(){add('receive')};
 window.whBulkAddDispenseRow=function(){add('dispense')};
 window.whBulkResolveRow=function(input){
  var row=input.closest('tr'),m=byCode(input.value),cell=row.querySelector('.wh-match');row.dataset.medId=m?m.id:'';
  if(!m){cell.innerHTML=input.value.trim()?'<span class="wh-match-bad">No matching NUPCO/MOH code</span>':'<span class="wh-match-pending">Enter code</span>';return}
  var extra='';if(row.dataset.kind==='dispense'){var w=(ctlWarehouse()||{})[m.id]||{},available=ctlWarehouseQtyForFilter(w);row.dataset.available=available;extra=' · Available: <b>'+available+'</b>'}
  cell.innerHTML='<span class="wh-match-ok">'+esc(m.name||'')+'</span><div class="fhint">MOH: '+esc(m.moh||'—')+' · NUPCO: '+esc(m.nupco||'—')+extra+'</div>';
 };
 window.whBulkReceiveOpen=function(){
  if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
  var box=document.getElementById('wh-bulk-receive-rows');box.innerHTML='';for(var i=0;i<5;i++)add('receive');OM('mwh-bulk-receive');
 };
 window.whBulkDispenseOpen=function(){
  if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
  var box=document.getElementById('wh-bulk-dispense-rows');box.innerHTML='';for(var i=0;i<5;i++)add('dispense');OM('mwh-bulk-dispense');
 };
 function collect(id,kind){
  var rows=Array.from(document.querySelectorAll('#'+id+' .wh-bulk-row')),valid=[],errors=[];
  rows.forEach(function(r,i){var code=r.querySelector('.wh-code').value.trim(),medId=r.dataset.medId,qty=Number(r.querySelector('.wh-qty-input').value||0),expiry=r.querySelector('.wh-exp-input').value||'',lot=r.querySelector('.wh-lot-input').value.trim();if(!code&&!qty&&!expiry&&!lot)return;if(!medId)errors.push('Row '+(i+1)+': code not matched');else if(!(qty>0))errors.push('Row '+(i+1)+': quantity required');else if(kind==='dispense'&&!expiry)errors.push('Row '+(i+1)+': expiry required');else if(kind==='dispense'&&qty>Number(r.dataset.available||0))errors.push('Row '+(i+1)+': insufficient warehouse balance');else valid.push({medId:medId,code:code,qty:qty,expiry:expiry,lot:lot});});
  return {valid:valid,errors:errors};
 }
 window.whBulkReceiveSave=async function(){
  var c=collect('mwh-bulk-receive','receive');if(c.errors.length)return toast(c.errors.slice(0,3).join(' · '),'err');if(!c.valid.length)return toast('Add at least one valid row','err');
  var all=Object.assign({},ctlWarehouse()),moves=[];
  c.valid.forEach(function(it){var x=Object.assign({system:0,outside:0,batches:[]},all[it.medId]||{});x.system=ctlNum(x.system)+it.qty;x.outside=ctlNum(x.outside);x.batches=(x.batches||[]).map(function(b){return Object.assign({},b)});if(it.expiry){var same=x.batches.find(function(b){return String(b.expiry||'')===it.expiry&&String(b.lot||'')===it.lot});if(same)same.qty=ctlNum(same.qty)+it.qty;else x.batches.push({qty:it.qty,expiry:it.expiry,lot:it.lot,source:'system'})}all[it.medId]=x;moves.push({type:'warehouse_receive',medId:it.medId,qty:it.qty,source:'system',expiry:it.expiry||'',lot:it.lot||'',note:'Bulk warehouse receiving'})});
  try{await ctlSetWarehouse(all)}catch(e){console.error('Bulk warehouse receiving save failed',e);return toast('Warehouse balances were not updated.','err')}
  var movementSaved=await ctlSaveMovementLog(moves,'Bulk warehouse receiving');
  CM('mwh-bulk-receive');renderControlled();toast(movementSaved?c.valid.length+' medicine(s) received ✓':'Warehouse balances were updated, but the movement log could not be saved.',movementSaved?'succ':'info');return true
 };
 window.whBulkDispenseSave=async function(){
  var c=collect('mwh-bulk-dispense','dispense');if(c.errors.length)return toast(c.errors.slice(0,3).join(' · '),'err');if(!c.valid.length)return toast('Add at least one valid row','err');
  var original=ctlWarehouse()||{},next=Object.assign({},original),moves=[],requested={};c.valid.forEach(function(it){requested[it.medId]=ctlNum(requested[it.medId])+it.qty});
  var over=Object.keys(requested).find(function(id){return requested[id]>ctlWarehouseQtyForFilter(original[id]||{})});if(over){var med=(typeof ctlMedicine==='function'?ctlMedicine(over):null)||{};return toast('Combined quantity exceeds the available warehouse balance for '+(med.name||over)+'.','err')}
  c.valid.forEach(function(it){var x=Object.assign({system:0,outside:0,batches:[]},next[it.medId]||{}),fromSystem=Math.min(it.qty,ctlNum(x.system)),fromOutside=it.qty-fromSystem;x.system=ctlNum(x.system)-fromSystem;x.outside=ctlNum(x.outside)-fromOutside;next[it.medId]=x;moves.push({type:'warehouse_send',medId:it.medId,qty:it.qty,expiry:it.expiry,lot:it.lot,fromSystem:fromSystem,fromOutside:fromOutside,status:'pending',note:'Bulk sent to pharmacy; awaiting accept/reject'})});
  try{await ctlSetWarehouse(next);await ctlMove(moves)}catch(e){console.error('Bulk warehouse transfer failed',e);var rollbackFailed=false;try{await ctlSetWarehouse(original)}catch(err){rollbackFailed=true;console.error('Bulk warehouse rollback failed',err)}return toast(rollbackFailed?'Bulk transfer failed and rollback could not be confirmed. Review warehouse balances.':'Bulk transfer failed. Warehouse balances were restored.','err')}
  CM('mwh-bulk-dispense');renderControlled();toast(c.valid.length+' pending transfer(s) created ✓','succ');return true
 };
 function addButtons(){
  var card=document.getElementById('wh-receive-card');if(!card)return;var head=card.querySelector('.ch');if(!head||head.querySelector('.wh-bulk-buttons'))return;
  var wrap=document.createElement('div');wrap.className='fl g8 wh-bulk-buttons';wrap.innerHTML='<button class="btn bs" onclick="whBulkReceiveOpen()">+ Bulk receive / استلام متعدد</button><button class="btn bp" onclick="whBulkDispenseOpen()">⇢ Bulk dispense / صرف متعدد</button>';var old=head.querySelector('button[onclick="whReceiveOpen()"]');if(old)old.replaceWith(wrap);else head.appendChild(wrap);
 }
 
 window.addWarehouseControlledBulkButtons=addButtons;
})();








export {};

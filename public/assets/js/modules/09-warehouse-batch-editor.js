(function(){
  window.whAddBatchRow=function(b){
    var row=document.createElement('div');row.className='wh-batch-row';b=b||{};
    row.innerHTML='<div><label>Expiry date</label><input class="wh-exp" type="date" value="'+esc(b.expiry||'')+'"></div><div><label>Linked qty (optional)</label><input class="wh-qty" type="number" min="0" value="'+(b.qty==null?'':esc(b.qty))+'"></div><div><label>Batch / Lot (optional)</label><input class="wh-lot" value="'+esc(b.lot||'')+'"></div><button class="btn bd2c bxs" type="button" onclick="this.parentElement.remove()">✕</button>';
    document.getElementById('mwh-batches').appendChild(row);
  };
  window.ctlEditWarehouseStock=function(id){
    if(!ctlCanEditWarehouse())return;
    var m=ctlMedicine(id)||{},x=(ctlWarehouse()||{})[id]||{};
    document.getElementById('mwh-stock-med-id').value=id;document.getElementById('mwh-stock-title').textContent='Warehouse custody — '+(m.name||'');
    document.getElementById('mwh-system').value=ctlNum(x.system);document.getElementById('mwh-outside').value=ctlNum(x.outside);
    var box=document.getElementById('mwh-batches');box.innerHTML='';(x.batches||[]).forEach(whAddBatchRow);if(!(x.batches||[]).length)whAddBatchRow({});OM('mwh-stock-pro');
  };
  window.whSaveStockPro=async function(){
    var id=document.getElementById('mwh-stock-med-id').value;if(!id)return;
    var batches=Array.from(document.querySelectorAll('#mwh-batches .wh-batch-row')).map(function(r){var q=r.querySelector('.wh-qty').value;return {expiry:r.querySelector('.wh-exp').value,qty:q===''?null:ctlNum(q),lot:r.querySelector('.wh-lot').value.trim()};}).filter(function(b){return b.expiry||b.qty||b.lot});
    var all=Object.assign({},ctlWarehouse()),x=Object.assign({},all[id]||{});x.system=ctlNum(document.getElementById('mwh-system').value);x.outside=ctlNum(document.getElementById('mwh-outside').value);x.batches=batches;all[id]=x;
    try{await ctlSetWarehouse(all)}catch(e){console.error('Warehouse custody save failed',e);return toast('Warehouse custody was not saved.','err')}
    var movementSaved=await ctlSaveMovementLog({type:'warehouse_stock_edit',medId:id,note:'Warehouse balances and expiry batches updated'},'Warehouse custody edit');
    CM('mwh-stock-pro');renderControlled();toast(movementSaved?'Warehouse custody saved ✓':'Warehouse custody was saved, but the movement log was not saved.',movementSaved?'succ':'info');return true
  };

  window.crashAddCart=function(){
    if(!requireCrashCartConfigurationPermission())return false;
    document.getElementById('ccp-name').value='';document.getElementById('ccp-number').value='';document.getElementById('ccp-location').value='';document.getElementById('ccp-seal').value='';
    document.getElementById('ccp-dept').innerHTML=(gd()||[]).map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name||d.id)+'</option>';}).join('');OM('mcrash-cart-pro');
  };
  window.crashSaveCartPro=async function(){
    if(!requireCrashCartConfigurationPermission())return false;
    var name=document.getElementById('ccp-name').value.trim(),deptId=document.getElementById('ccp-dept').value;if(!name||!deptId)return toast('Enter cart name and department','err');
    var cart={id:'cc_'+Date.now().toString(36),name:name,number:document.getElementById('ccp-number').value.trim(),location:document.getElementById('ccp-location').value.trim(),seal:document.getElementById('ccp-seal').value.trim(),deptId:deptId,items:[],createdAt:nowISO(),createdBy:actualActorName()};
    var arr=crashCarts().slice();arr.push(cart);await setCrashCarts(arr);auditAction('crash_cart_add',{cartId:cart.id,deptId:deptId});CM('mcrash-cart-pro');renderCrashCarts();toast('Crash cart created ✓','succ');
  };
})();

export {};

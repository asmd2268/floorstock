(function(){
  var whSelectedReceiveId='';
  function medList(){try{return ctlCatalog()||[]}catch(e){return []}}
  window.whReceiveOpen=function(){
    if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
    whSelectedReceiveId='';
    var ids=['wh-receive-search','wh-receive-med-id','wh-receive-expiry','wh-receive-lot'];
    ids.forEach(function(id){var x=document.getElementById(id);if(x)x.value=''});
    var q=document.getElementById('wh-receive-qty');if(q)q.value='1';
    var sel=document.getElementById('wh-receive-selected');if(sel){sel.style.display='none';sel.innerHTML=''}
    whReceiveRenderSearch();OM('mwh-receive');
  };
  window.whReceiveRenderSearch=function(){
    var q=((document.getElementById('wh-receive-search')||{}).value||'').toLowerCase().trim();
    var rows=medList().filter(function(m){return !q||[m.name,m.moh,m.nupco].join(' ').toLowerCase().includes(q)}).slice(0,100);
    var box=document.getElementById('wh-receive-results');if(!box)return;
    box.innerHTML=rows.length?rows.map(function(m){var on=String(m.id)===String(whSelectedReceiveId)?' on':'';return '<div class="wh-receive-result'+on+'" data-id="'+esc(m.id)+'" onclick="whReceiveSelect(this.dataset.id)"><div><b>'+esc(m.name||'')+'</b><div class="wh-receive-meta">MOH: '+esc(m.moh||'—')+' · NUPCO: '+esc(m.nupco||'—')+'</div></div><span class="chip">Select</span></div>'}).join(''):'<div style="padding:18px;text-align:center;color:var(--tx2)">No matching medicine</div>';
  };
  window.whReceiveSelect=function(id){
    whSelectedReceiveId=id;var m=medList().find(function(x){return String(x.id)===String(id)});var hid=document.getElementById('wh-receive-med-id');if(hid)hid.value=id;
    var sel=document.getElementById('wh-receive-selected');if(sel&&m){sel.style.display='block';sel.innerHTML='<b>Selected:</b> '+esc(m.name||'')+'<div class="fhint">Current warehouse balance: '+ctlWarehouseQtyForFilter((ctlWarehouse()||{})[id]||{})+'</div>'}
    whReceiveRenderSearch();
  };
  window.whReceiveSave=async function(){
    if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
    var id=(document.getElementById('wh-receive-med-id')||{}).value||whSelectedReceiveId,qty=Math.max(0,Number((document.getElementById('wh-receive-qty')||{}).value||0)),source=(document.getElementById('wh-receive-source')||{}).value||'system',expiry=(document.getElementById('wh-receive-expiry')||{}).value||'',lot=((document.getElementById('wh-receive-lot')||{}).value||'').trim();
    if(!id)return toast('Select a medicine first','err');if(!(qty>0))return toast('Enter received quantity','err');
    var all=Object.assign({},ctlWarehouse()),x=Object.assign({system:0,outside:0,batches:[]},all[id]||{});x.system=ctlNum(x.system);x.outside=ctlNum(x.outside);x.batches=(x.batches||[]).map(function(b){return Object.assign({},b)});
    if(source==='outside')x.outside+=qty;else x.system+=qty;
    if(expiry){var same=x.batches.find(function(b){return String(b.expiry||'')===expiry&&String(b.lot||'')===lot});if(same)same.qty=ctlNum(same.qty)+qty;else x.batches.push({qty:qty,expiry:expiry,lot:lot,source:source})}
    all[id]=x;
    try{await ctlSetWarehouse(all)}catch(e){console.error('Warehouse receiving save failed',e);return toast('Warehouse balance was not updated.','err')}
    var movementSaved=await ctlSaveMovementLog({type:'warehouse_receive',medId:id,qty:qty,source:source,expiry:expiry,lot:lot,note:'Warehouse received stock'+(expiry?' exp '+expiry:'')},'Warehouse receiving');
    CM('mwh-receive');renderControlled();toast(movementSaved?'Medicine received and warehouse balance updated ✓':'Warehouse balance was updated, but the movement log could not be saved.',movementSaved?'succ':'info');return true
  };

  function applyWarehouseUI(){
    var isWh=false;try{isWh=ctlIsWarehouse()}catch(e){}
    if(!isWh)return;
    var pg=document.getElementById('pg-controlled');if(!pg||document.getElementById('wh-receive-card'))return;
    var anchor=document.getElementById('ctl-tabs')||pg.firstElementChild;
    var card=document.createElement('div');card.id='wh-receive-card';card.className='card';
    card.innerHTML='<div class="ch"><div><span class="ct">Warehouse receiving / استلام أدوية المستودع</span><div class="fhint">Search the shared list, enter received quantity, and optionally link it to an expiry date and batch.</div></div><button class="btn bs" onclick="whReceiveOpen()">+ Receive medicine</button></div><div class="cb"><div class="alert-banner-y" style="margin:0">Warehouse print controls are limited to warehouse stock reports. Inpatient department printing is not available for this role.</div></div>';
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(card,anchor.nextSibling);else pg.insertBefore(card,pg.firstChild);
  }
  window.applyWarehouseControlledUi=applyWarehouseUI;
})();

// --- Merged from 09-warehouse-batch-editor.js (Phase 6 consolidation) ---
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

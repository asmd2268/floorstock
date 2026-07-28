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








export {};

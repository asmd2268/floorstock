(function(){
'use strict';
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v){v=Number(v);return isFinite(v)?v:0}
function now(){return typeof nowISO==='function'?nowISO():new Date().toISOString()}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function master(){try{return !!(window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true)||!!(window.CU&&CU.master===true)}catch(e){return false}}
function permission(name,roles){var p=window.CU&&CU.permissions;if(p&&typeof p[name]==='boolean')return p[name];return master()||roles.indexOf(role())>=0}
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v))}
function uid(prefix){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function norm(v){return window.fsMedNorm?window.fsMedNorm(v):String(v||'').toLowerCase().trim()}
function depts(){return typeof gd==='function'?(gd()||[]):[]}
function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
function actor(){return window.fsActor?window.fsActor():{name:'Unknown',user:'Unknown',id:''}}

/* ---------- Crash Cart details and bulk opening/replacement ---------- */
function canCrashAdmin(){return window.fsHasCapability?window.fsHasCapability('crashCart.configure'):permission('crashCartAdmin',['pharmacy','inpatient_supervisor'])}
function canCrashOperate(){return window.fsHasCapability?window.fsHasCapability('crashCart.operate'):permission('crashCartOperations',['pharmacy','inpatient_supervisor','pharmacy_staff'])}
function canMasterDirectCrashCorrection(){return !!(window.CU&&CU.master===true&&!window.MASTER_EFFECTIVE)}
function cartList(){return typeof crashCarts==='function'?(crashCarts()||[]):[]}
function reportList(){return typeof crashReports==='function'?(crashReports()||[]):[]}
function itemKey(it){return it&&it.medId?'id:'+it.medId:'name:'+norm((it&&it.name)||'')+'|'+norm((it&&it.concentration)||(it&&it.strength)||'')}
function uniqueCrashItems(){var map={};cartList().forEach(function(c){(c.items||[]).forEach(function(it){var k=itemKey(it);if(!map[k])map[k]={key:k,name:it.name||it.genericName||'',concentration:it.concentration||it.strength||'',medId:it.medId||''}})});return Object.keys(map).map(function(k){return map[k]}).sort(function(a,b){return a.name.localeCompare(b.name)})}
function findCartItem(cart,key){return (cart.items||[]).find(function(it){return itemKey(it)===key})||null}
function usedSeals(carts,reports){var set={};(carts||[]).forEach(function(c){if(c.seal)set[String(c.seal).trim().toLowerCase()]=1});(reports||[]).forEach(function(r){[r.oldSeal,r.newSeal].forEach(function(s){if(s)set[String(s).trim().toLowerCase()]=1})});return set}
function removeFromItem(item,date,qty){var available=n(item.present==null?item.qty:item.present),batches=(item.batches||[]).map(function(b){return Object.assign({},b)}),wanted=qty;if(date){var matching=batches.filter(function(b){return String(b.expiry||'').slice(0,10)===date}),total=matching.reduce(function(s,b){return s+n(b.qty)},0);if(wanted<=0)wanted=total;if(wanted>total+1e-9)throw new Error('Selected expiry has insufficient quantity.');var left=wanted;batches.forEach(function(b){if(left<=0||String(b.expiry||'').slice(0,10)!==date)return;var take=Math.min(left,n(b.qty));b.qty=n(b.qty)-take;left-=take});batches=batches.filter(function(b){return n(b.qty)>0||b.expiry||b.lot})}else{if(wanted<=0)wanted=available;if(wanted>available+1e-9)throw new Error('Cart has insufficient available quantity.')}item.present=Math.max(0,available-wanted);item.stockStatus=item.present<=0?'out_of_stock':(item.present<n(item.qty)?'partial':'available');item.batches=batches;return wanted}
function addReplacement(item,rep,expiry){var q=n(rep.qty),standard=n(item.qty),current=n(item.present==null?item.qty:item.present),next=current+q;if(next>standard+1e-9)throw new Error((item.name||'Medicine')+': replacement would exceed the approved Crash Cart standard quantity '+standard+'.');item.present=next;item.stockStatus=next<=0?'out_of_stock':next<standard?'partial':'available';item.batches=Array.isArray(item.batches)?item.batches:[];if(q>0&&!expiry)throw new Error((item.name||'Medicine')+': every replacement quantity requires an expiry date.');if(expiry||rep.lot){item.batches.push({batchId:uid('ccb'),expiry:expiry||'',qty:q,lot:rep.lot||''})}}
function buildCrashBulkResult(carts,reports,plan){var nextCarts=clone(carts),nextReports=clone(reports),sealSet=usedSeals(carts,reports),newSeals={};plan.cartPlans.forEach(function(cp){var seal=String(cp.newSeal||'').trim(),sk=seal.toLowerCase();if(!seal)throw new Error('A unique new seal is required for every cart.');if(newSeals[sk]||sealSet[sk])throw new Error('Seal "'+seal+'" is already used. Every new seal must be unique.');newSeals[sk]=1});plan.cartPlans.forEach(function(cp){var cart=nextCarts.find(function(c){return String(c.id)===String(cp.cartId)});if(!cart)throw new Error('Cart not found.');if(nextReports.some(function(r){return String(r.cartId)===String(cart.id)&&r.status==='open'}))throw new Error((cart.name||'Cart')+' already has an open report. Close it first.');var source=findCartItem(cart,plan.sourceKey);if(!source)throw new Error('Source medicine not found in '+(cart.name||'cart'));var removed=removeFromItem(source,plan.sourceExpiry,n(cp.removeQty));(plan.replacements||[]).forEach(function(rep){var per=(cp.replacements||{})[rep.id];if(!per||per.include===false)return;var expiry=per.expiryOverride||rep.expiry||'';var target=(cart.items||[]).find(function(it){return norm(it.name)===norm(rep.name)&&norm(it.concentration||it.strength)===norm(rep.concentration||'')});if(!target){target={id:uid('cci'),medId:rep.medId||'',name:rep.name,genericName:rep.name,concentration:rep.concentration||'',strength:rep.concentration||'',qty:0,present:0,batches:[]};cart.items.push(target)}addReplacement(target,rep,expiry)});var oldSeal=cart.seal||'';cart.seal=cp.newSeal;cart.updatedAt=now();cart.updatedBy=actor().name;cart.lastClosedAt=cart.updatedAt;cart.lastClosedByName=actor().name;cart.lastClosedByUser=actor().user;nextReports.push({id:uid('ccbulk'),cartId:cart.id,deptId:cart.deptId,status:'closed',type:'pharmacy_bulk_open_replace',operation:'open',openingLog:true,bulkOpen:true,pharmacyInitiated:true,reason:'Bulk opening and replacement / فتح واستبدال جماعي',oldSeal:oldSeal,newSeal:cp.newSeal,sourceMedicine:plan.sourceKey,sourceExpiry:plan.sourceExpiry,removedQty:removed,replacements:(plan.replacements||[]).filter(function(rep){var per=(cp.replacements||{})[rep.id];return per&&per.include!==false}).map(function(rep){var per=cp.replacements[rep.id]||{};return {name:rep.name,concentration:rep.concentration,qty:n(rep.qty),expiry:per.expiryOverride||rep.expiry||'',lot:rep.lot||''}}),pharmacyNote:plan.note||'',openedAt:now(),closedAt:now(),openedBy:actor().name,closedBy:actor().name,bulk:true})});return {carts:nextCarts,reports:nextReports}}
window.R17Core=Object.assign(window.R17Core||{},{buildCrashBulkResult:buildCrashBulkResult,removeFromItem:removeFromItem});
window.renderCrashOperations=function(){
  var page=E('pg-crash-ops');if(!page)return;
  if(!canCrashOperate()){
    page.innerHTML='<div class="alert-banner">Not authorized / غير مصرح</div>';
    return;
  }
  var externalScope=role()==='outpatient_pharmacy_supervisor'?(window.fsOutpatientDeptId?window.fsOutpatientDeptId():String(CU&&CU.deptId||'')):'';
  var options=uniqueCrashItems();
  E('r17-cr-source-med').innerHTML='<option value="">Select medicine...</option>'+options.map(function(item){
    return '<option value="'+esc(item.key)+'">'+esc(item.name+(item.concentration?' — '+item.concentration:''))+'</option>';
  }).join('');
  var allowCorrection=canMasterDirectCrashCorrection();
  var list=E('r17-crash-admin-list');
  list.innerHTML=cartList().filter(function(cart){return !externalScope||String(cart.deptId)===externalScope}).map(function(cart){
    return '<div class="r17-admin-row" data-cart="'+esc(cart.id)+'">'+
      '<div class="fg"><label>Name</label><input class="r17-ca-name" value="'+esc(cart.name||'')+'"></div>'+
      '<div class="fg"><label>Number</label><input class="r17-ca-number" value="'+esc(cart.number||'')+'"></div>'+
      '<div class="fg"><label>Department</label><select class="r17-ca-dept">'+depts().map(function(department){
        return '<option value="'+esc(department.id)+'" '+(String(department.id)===String(cart.deptId)?'selected':'')+'>'+esc(department.name)+'</option>';
      }).join('')+'</select></div>'+
      '<div class="fg"><label>Location</label><input class="r17-ca-location" value="'+esc(cart.location||'')+'"></div>'+
      '<div class="fl g8" style="align-items:flex-end"><button class="btn bs bsm" onclick="r17CrashSaveDetails(\''+esc(cart.id)+'\')">Save details</button>'+
      (allowCorrection?'<button class="btn bg bsm r18-master-correction-btn" onclick="r18OpenCrashCorrection(\''+esc(cart.id)+'\')">Master correction</button>':'')+
      '</div></div>';
  }).join('')||'<div class="fhint">No carts.</div>';
  if(!canCrashAdmin()){
    list.querySelectorAll('input,select').forEach(function(control){control.disabled=true});
    list.querySelectorAll('button').forEach(function(button){button.remove()});
    list.insertAdjacentHTML('afterbegin','<div class="alert-banner-y">Crash Cart details are view-only for Pharmacy Staff. Individual and bulk opening/replacement remain available. / بيانات العربات للعرض فقط لموظف الصيدلية، بينما الفتح والاستبدال الفردي والجماعي متاحان.</div>');
  }
  E('r17-cr-replacements').innerHTML='';
  E('r17-cr-match-carts').innerHTML='';
  E('r17-cr-cart-matrix').innerHTML='';
  window.r17CrashAddReplacement();
}
window.r17CrashSaveDetails=async function(id){if(!canCrashAdmin())return;var row=document.querySelector('[data-cart="'+CSS.escape(String(id))+'"]'),carts=clone(cartList()),cart=carts.find(function(c){return String(c.id)===String(id)});if(!row||!cart)return;var newDept=row.querySelector('.r17-ca-dept').value;if(String(newDept)!==String(cart.deptId)&&reportList().some(function(r){return String(r.cartId)===String(id)&&r.status==='open'}))return toast('Close the open report before moving this cart.','err');var old={name:cart.name,deptId:cart.deptId,number:cart.number,location:cart.location};cart.name=row.querySelector('.r17-ca-name').value.trim()||cart.name;cart.number=row.querySelector('.r17-ca-number').value.trim();cart.location=row.querySelector('.r17-ca-location').value.trim();cart.deptId=newDept;cart.updatedAt=now();try{await setCrashCarts(carts);if(typeof auditAction==='function')auditAction('crash_cart_details_update',{cartId:id,old:old,new:{name:cart.name,deptId:cart.deptId,number:cart.number,location:cart.location}});toast('Cart details saved without changing its identity or history ✓','succ');renderCrashOperations();if(typeof renderCrashCarts==='function')renderCrashCarts()}catch(e){toast(String(e&&e.message||e),'err')}};
function r18CrashBatchRow(batch){
  batch=batch||{};
  return '<div class="r18-cc-batch" data-batch-id="'+esc(batch.batchId||batch.id||uid('ccb'))+'">'+
    '<div class="fg"><label>Expiry date</label><input class="r18-cc-expiry" type="date" value="'+esc(String(batch.expiry||'').slice(0,10))+'"></div>'+
    '<div class="fg"><label>Quantity</label><input class="r18-cc-batch-qty" type="number" min="0" step="any" value="'+esc(batch.qty==null?'':batch.qty)+'"></div>'+
    '<div class="fg"><label>Lot / Batch (optional)</label><input class="r18-cc-lot" value="'+esc(batch.lot||batch.batch||'')+'" placeholder="Optional"></div>'+
    '<button class="btn bd2c bsm" type="button" onclick="this.closest(\'.r18-cc-batch\').remove()">Remove date</button>'+
  '</div>';
}
function r18CrashItemRow(item){
  item=item||{};
  var batches=(item.batches||[]).map(r18CrashBatchRow).join('');
  return '<div class="r18-cc-item" data-item-id="'+esc(item.id||uid('cci'))+'" data-med-id="'+esc(item.medId||'')+'">'+
    '<div class="r18-cc-item-head">'+
      '<div class="fg"><label>Medicine name</label><input class="r18-cc-name" value="'+esc(item.name||item.genericName||'')+'"></div>'+
      '<div class="fg"><label>Concentration</label><input class="r18-cc-concentration" value="'+esc(item.concentration||item.strength||'')+'"></div>'+
      '<div class="fg"><label>Standard qty</label><input class="r18-cc-standard" type="number" min="0" step="any" value="'+n(item.qty)+'"></div>'+
      '<div class="fg"><label>Present qty</label><input class="r18-cc-present" type="number" min="0" step="any" value="'+n(item.present==null?item.qty:item.present)+'"></div>'+
      '<button class="btn bd2c bsm" type="button" onclick="this.closest(\'.r18-cc-item\').remove()">Delete medicine</button>'+
    '</div>'+
    '<div class="r18-cc-batches">'+batches+'</div>'+
    '<button class="btn bg bsm" type="button" onclick="r18CrashCorrectionAddBatch(this)">+ Expiry / Batch</button>'+
  '</div>';
}
window.r18OpenCrashCorrection=function(cartId){
  if(!canMasterDirectCrashCorrection())return toast('Only the actual Master can use direct cart correction.','err');
  var cart=cartList().find(function(item){return String(item.id)===String(cartId)});
  if(!cart)return toast('Crash Cart not found.','err');
  if(reportList().some(function(report){return String(report.cartId)===String(cartId)&&report.status==='open'})){
    return toast('Close the active opening report before direct correction.','err');
  }
  E('r18-cc-cart-id').value=cart.id;
  E('r18-cc-seal').textContent=cart.seal||'—';
  E('r18-cc-reason').value='';
  E('r18-cc-items').innerHTML=(cart.items||[]).map(r18CrashItemRow).join('');
  OM('r18-crash-correction-modal');
};
window.r18CrashCorrectionAddItem=function(){
  E('r18-cc-items').insertAdjacentHTML('beforeend',r18CrashItemRow({id:uid('cci'),qty:0,present:0,batches:[]}));
};
window.r18CrashCorrectionAddBatch=function(button){
  var item=button.closest('.r18-cc-item');
  item.querySelector('.r18-cc-batches').insertAdjacentHTML('beforeend',r18CrashBatchRow({batchId:uid('ccb'),expiry:'',qty:'',lot:''}));
};
window.r18SaveCrashCorrection=async function(){
  if(!canMasterDirectCrashCorrection())return toast('Only the actual Master can save direct corrections.','err');
  var cartId=E('r18-cc-cart-id').value;
  var reason=E('r18-cc-reason').value.trim();
  if(!reason)return toast('Correction reason is required.','err');
  if(reportList().some(function(report){return String(report.cartId)===String(cartId)&&report.status==='open'})){
    return toast('Close the active opening report before direct correction.','err');
  }
  var originalCarts=clone(cartList());
  var carts=clone(originalCarts);
  var cart=carts.find(function(item){return String(item.id)===String(cartId)});
  if(!cart)return toast('Crash Cart not found.','err');
  var before=clone(cart),sealBefore=String(cart.seal||'');
  var itemRows=Array.from(E('r18-cc-items').querySelectorAll('.r18-cc-item'));
  var corrected=[];
  for(var i=0;i<itemRows.length;i++){
    var row=itemRows[i];
    var name=row.querySelector('.r18-cc-name').value.trim();
    if(!name)return toast('Every retained medicine needs a name.','err');
    var standard=n(row.querySelector('.r18-cc-standard').value);
    var present=n(row.querySelector('.r18-cc-present').value);
    if(standard<0||present<0)return toast('Quantities cannot be negative.','err');
    if(present>standard+1e-9)return toast(name+': present quantity cannot exceed the approved standard quantity '+standard+'.','err');
    var batches=[],batchError='',batchTotal=0;
    Array.from(row.querySelectorAll('.r18-cc-batch')).forEach(function(batchRow){
      var expiry=batchRow.querySelector('.r18-cc-expiry').value;
      var lot=batchRow.querySelector('.r18-cc-lot').value.trim();
      var qtyValue=batchRow.querySelector('.r18-cc-batch-qty').value.trim();
      if(!expiry&&!lot&&!qtyValue)return;
      var qty=qtyValue===''?0:n(qtyValue);
      if(qty<0){batchError='Batch quantities cannot be negative.';return}
      if(qty>0&&!expiry){batchError='Every dated Crash Cart quantity requires an expiry date.';return}
      batchTotal+=qty;
      batches.push({
        batchId:batchRow.dataset.batchId||uid('ccb'),
        expiry:expiry,
        qty:qty,
        lot:lot
      });
    });
    if(batchError)return toast(batchError,'err');
    if(batchTotal>present+1e-9)return toast(name+': dated batch quantities cannot exceed the present quantity.','err');
    corrected.push({
      id:row.dataset.itemId||uid('cci'),
      medId:row.dataset.medId||'',
      name:name,
      genericName:name,
      concentration:row.querySelector('.r18-cc-concentration').value.trim(),
      strength:row.querySelector('.r18-cc-concentration').value.trim(),
      qty:standard,
      present:present,
      stockStatus:present<=0?'out_of_stock':(present<standard?'partial':'available'),
      batches:batches
    });
  }
  cart.items=corrected;
  cart.seal=sealBefore;
  cart.updatedAt=now();
  cart.updatedBy=actor().name;
  cart.lastMasterCorrectionAt=cart.updatedAt;
  cart.lastMasterCorrectionBy=actor().name;
  cart.lastMasterCorrectionReason=reason;
  var save=E('r18-cc-save');if(save)save.disabled=true;
  try{
    await setCrashCarts(carts);
    var verified=cartList().find(function(item){return String(item.id)===String(cartId)});
    if(!verified)throw new Error('Corrected cart was not found after save.');
    if(String(verified.seal||'')!==sealBefore)throw new Error('Seal verification failed; the seal changed unexpectedly.');
    if((verified.items||[]).length!==corrected.length)throw new Error('Corrected medicine list did not persist completely.');
    if(typeof auditAction==='function')await auditAction('crash_cart_master_direct_correction',{
      cartId:cartId,
      reason:reason,
      sealBefore:sealBefore,
      sealAfter:String(verified.seal||''),
      sealUnchanged:true,
      before:before,
      after:verified
    });
    CM('r18-crash-correction-modal');
    toast('Crash Cart corrected and verified; seal unchanged ✓','succ');
    renderCrashOperations();
    if(typeof renderCrashCarts==='function')renderCrashCarts();
  }catch(error){
    console.error(error);
    try{await setCrashCarts(originalCarts)}catch(rollbackError){console.error('Crash correction rollback failed',rollbackError)}
    toast(String(error&&error.message||error),'err');
  }finally{
    if(save)save.disabled=false;
  }
};

window.r17CrashSourceChanged=function(){var key=E('r17-cr-source-med').value,dates={};cartList().forEach(function(c){var it=findCartItem(c,key);(it&&it.batches||[]).forEach(function(b){if(b.expiry)dates[String(b.expiry).slice(0,10)]=1})});E('r17-cr-source-expiry').innerHTML='<option value="">Any/no expiry</option>'+Object.keys(dates).sort().map(function(d){return '<option value="'+d+'">'+d+'</option>'}).join('');r17CrashScanMatches()};
window.r17CrashScanMatches=function(){var key=E('r17-cr-source-med').value,date=E('r17-cr-source-expiry').value,matched=cartList().filter(function(c){var it=findCartItem(c,key);if(!it)return false;if(!date)return true;return (it.batches||[]).some(function(b){return String(b.expiry||'').slice(0,10)===date&&n(b.qty)>0})});var alert=E('r17-cr-match-alert');alert.style.display=matched.length?'block':'none';alert.textContent=matched.length?'The selected medicine'+(date?' with the same expiry '+date:'')+' exists in '+matched.length+' cart(s). Select all or only the carts required. / العلاج والتاريخ موجودان في '+matched.length+' عربة.':'No matching carts.';E('r17-cr-match-carts').innerHTML=matched.map(function(c){var it=findCartItem(c,key),q=date?(it.batches||[]).filter(function(b){return String(b.expiry||'').slice(0,10)===date}).reduce(function(s,b){return s+n(b.qty)},0):n(it.present==null?it.qty:it.present);return '<label class="r17-check"><input class="r17-cr-cart-check" type="checkbox" value="'+esc(c.id)+'" onchange="r17CrashRenderMatrix()"><span><b>'+esc(c.name||c.number||c.id)+'</b><div class="fhint">'+esc(deptName(c.deptId))+' · Matching qty: '+q+' · Current seal: '+esc(c.seal||'—')+'</div></span></label>'}).join('');r17CrashRenderMatrix()};
window.r17CrashSelectAllMatches=function(on){document.querySelectorAll('.r17-cr-cart-check').forEach(function(x){x.checked=!!on});r17CrashRenderMatrix()};
window.r17CrashAddReplacement=function(){var id=uid('rep'),host=E('r17-cr-replacements');host.insertAdjacentHTML('beforeend','<div class="r17-replacement" data-rep="'+id+'"><div class="r17-grid4"><div class="fg"><label>Medicine</label><input class="r17-rep-name" list="r17-cr-med-names" placeholder="Medicine name"></div><div class="fg"><label>Concentration</label><input class="r17-rep-conc"></div><div class="fg"><label>Qty per selected cart</label><input class="r17-rep-qty" type="number" min="0" step="any" value="1" oninput="r17CrashRenderMatrix()"></div><div class="fg"><label>Unified replacement expiry</label><input class="r17-rep-exp" type="date" onchange="r17CrashRenderMatrix()"></div></div><div class="fl jb ic"><div class="fg" style="flex:1;margin:0"><label>Lot / Batch (optional)</label><input class="r17-rep-lot" placeholder="Optional"></div><button class="btn bd2c bsm" onclick="this.closest(\'.r17-replacement\').remove();r17CrashRenderMatrix()">Remove</button></div></div>');if(!E('r17-cr-med-names')){var dl=document.createElement('datalist');dl.id='r17-cr-med-names';var names={};depts().forEach(function(d){getMeds(d.id).forEach(function(m){names[m.name]=1})});dl.innerHTML=Object.keys(names).sort().map(function(x){return '<option value="'+esc(x)+'">'}).join('');document.body.appendChild(dl)}r17CrashRenderMatrix()};
function replacementRows(){return Array.from(document.querySelectorAll('#r17-cr-replacements .r17-replacement')).map(function(r){return {id:r.dataset.rep,name:r.querySelector('.r17-rep-name').value.trim(),concentration:r.querySelector('.r17-rep-conc').value.trim(),qty:n(r.querySelector('.r17-rep-qty').value),expiry:r.querySelector('.r17-rep-exp').value,lot:r.querySelector('.r17-rep-lot').value.trim()}})}
window.r17CrashRenderMatrix=function(){var ids=Array.from(document.querySelectorAll('.r17-cr-cart-check:checked')).map(function(x){return x.value}),reps=replacementRows(),host=E('r17-cr-cart-matrix');if(!ids.length){host.innerHTML='';return}host.innerHTML=ids.map(function(id){var c=cartList().find(function(x){return String(x.id)===String(id)});return '<div class="r17-cart-matrix" data-plan-cart="'+esc(id)+'"><b>'+esc(c&&c.name||id)+' — '+esc(deptName(c&&c.deptId))+'</b><div class="r17-grid4" style="margin-top:7px"><div class="fg"><label>Remove quantity</label><input class="r17-plan-remove" type="number" min="0" step="any" value="'+esc(E('r17-cr-source-qty').value||0)+'"></div><div class="fg"><label>New unique seal</label><input class="r17-plan-seal" placeholder="Required and unique"></div></div><div class="r17-cart-matrix-grid">'+reps.map(function(rep){return '<label class="r17-check"><input class="r17-plan-include" data-rep="'+rep.id+'" type="checkbox" checked><span><b>'+esc(rep.name||'Replacement line')+'</b><div class="fhint">Unified expiry: '+esc(rep.expiry||'not set')+'</div><input class="r17-plan-exp" data-rep="'+rep.id+'" type="date" placeholder="Exception date"><div class="fhint">Leave blank to use unified date; set only for an exception cart.</div></span></label>'}).join('')+'</div></div>'}).join('')};
window.r17CrashExecuteBulk=async function(){if(!canCrashOperate())return;var sourceKey=E('r17-cr-source-med').value;if(!sourceKey)return toast('Choose a source medicine.','err');var reps=replacementRows();if(!reps.length||reps.some(function(r){return !r.name||!(r.qty>0)||!r.expiry}))return toast('Every replacement medicine needs a name, quantity and unified expiry. Lot/Batch stays optional.','err');var plans=Array.from(document.querySelectorAll('[data-plan-cart]')).map(function(box){var map={};reps.forEach(function(rep){var include=box.querySelector('.r17-plan-include[data-rep="'+rep.id+'"]'),exp=box.querySelector('.r17-plan-exp[data-rep="'+rep.id+'"]');map[rep.id]={include:!!(include&&include.checked),expiryOverride:exp&&exp.value||''}});return {cartId:box.dataset.planCart,removeQty:n(box.querySelector('.r17-plan-remove').value),newSeal:box.querySelector('.r17-plan-seal').value.trim(),replacements:map}});if(!plans.length)return toast('Select one or more matching carts.','err');var originalCarts=clone(cartList()),originalReports=clone(reportList());try{var result=buildCrashBulkResult(originalCarts,originalReports,{sourceKey:sourceKey,sourceExpiry:E('r17-cr-source-expiry').value,replacements:reps,cartPlans:plans,note:E('r17-cr-note').value.trim()});await setCrashCarts(result.carts);try{await setCrashReports(result.reports)}catch(reportError){await setCrashCarts(originalCarts);throw reportError}if(typeof auditAction==='function'){var addedReports=result.reports.slice(originalReports.length);await Promise.all(addedReports.map(function(r){return Promise.resolve(auditAction('crash_cart_open_report',{reportId:r.id,cartId:r.cartId,deptId:r.deptId,oldSeal:r.oldSeal,newSeal:r.newSeal,reason:r.reason,bulk:true,openedAt:r.openedAt})).catch(function(err){console.warn('Bulk opening audit warning',err)})}));await Promise.resolve(auditAction('crash_cart_bulk_open_replace_close',{cartIds:plans.map(function(x){return x.cartId}),sourceKey:sourceKey,sourceExpiry:E('r17-cr-source-expiry').value,replacementCount:reps.length,uniqueSeals:plans.map(function(x){return x.newSeal}),openingLogRecords:addedReports.length})).catch(function(err){console.warn('Bulk completion audit warning',err)})}toast('Bulk replacement completed; every cart received a different unique seal ✓','succ');renderCrashOperations()}catch(e){console.error(e);toast(String(e&&e.message||e),'err')}};

/* ---------- Medication accountability: independent department custody v2 ---------- */
var ACC2_ASSIGNMENTS_KEY='accountability_assignments_v2';
var ACC2_USAGE_KEY='accountability_usage_v2';
var ACC2_RECEIPTS_KEY='accountability_receipts_v2';
var ACC2_REGIMENS_KEY='accountability_regimens_v2';
var ACC2_UI={adminTab:'custody',filters:{dept:'',status:'',medicine:''},receiptDept:'',regimenDept:'',editAssignmentId:'',editRegimenId:''};

function acc2Array(key){var value=S.g(key);return Array.isArray(value)?value:[]}
function acc2ScopeDept(){return role()==='outpatient_pharmacy_supervisor'?(window.fsOutpatientDeptId?window.fsOutpatientDeptId():String(CU&&CU.deptId||'')):''}
function acc2LockOutpatientSelectors(){var d=acc2ScopeDept();if(!d)return;['acc2-assignment-dept','acc2-regimen-dept'].forEach(function(id){var s=E(id);if(s){s.innerHTML='<option value="'+esc(d)+'">'+esc(deptName(d))+'</option>';s.value=d;s.disabled=true}});document.querySelectorAll('#r17-accountability-root select').forEach(function(s){if(s.id==='acc2-assignment-dept'||s.id==='acc2-regimen-dept')return;var opts=Array.from(s.options);if(opts.some(function(o){return o.value===d})){s.innerHTML='<option value="'+esc(d)+'">'+esc(deptName(d))+'</option>';s.value=d;s.disabled=true}})}
function acc2Assignments(){var a=acc2Array(ACC2_ASSIGNMENTS_KEY),d=acc2ScopeDept();return d?a.filter(function(x){return String(x.deptId)===d}):a}
function acc2Usage(){var a=acc2Array(ACC2_USAGE_KEY),d=acc2ScopeDept();return d?a.filter(function(x){return String(x.deptId)===d}):a}
function acc2Receipts(){return acc2Array(ACC2_RECEIPTS_KEY)}
function acc2Regimens(){return acc2Array(ACC2_REGIMENS_KEY)}
function acc2EffectiveMaster(){return master()&&!window.MASTER_EFFECTIVE}
function canAccManage(){return role()==='outpatient_pharmacy_supervisor'||(window.fsHasCapability?window.fsHasCapability('accountability.manage'):(acc2EffectiveMaster()||['pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(role())>=0))}
function acc2DepartmentRole(){return role()==='department'}
function acc2StatusLabel(status){return {pending_pharmacy:'Pending pharmacy review / بانتظار مراجعة الصيدلية',approved_waiting_receipt:'Approved — waiting nursing receipt / معتمد وبانتظار الاستلام',received_locked:'Received and locked / تم الاستلام والإقفال',rejected:'Rejected / مرفوض'}[status]||status}
function acc2StatusClass(status){return status==='received_locked'?'bgn':status==='approved_waiting_receipt'?'bbl':status==='rejected'?'brd':'byl'}
function acc2Assignment(id,list){return (list||acc2Assignments()).find(function(x){return String(x.id)===String(id)})||null}
function acc2RegimenVersion(regimen){return regimen&&((regimen.versions||[]).find(function(v){return String(v.id)===String(regimen.activeVersionId)})||(regimen.versions||[])[0])||null}
function acc2DeptAssignments(deptId,includeInactive){return acc2Assignments().filter(function(a){return String(a.deptId)===String(deptId)&&(includeInactive||a.active!==false)})}
function acc2RegimenForAssignment(deptId,assignmentId){return acc2Regimens().filter(function(r){if(r.active===false||String(r.deptId)!==String(deptId))return false;var version=acc2RegimenVersion(r);return !!(version&&(version.items||[]).some(function(i){return String(i.assignmentId)===String(assignmentId)}))})}
function acc2SubmissionBlocked(deptId,assignmentId){return acc2RegimenForAssignment(deptId,assignmentId).find(function(r){return r.paused===true})||null}
function acc2MedicationNames(deptId){var map={};try{(getMeds(deptId)||[]).forEach(function(m){var name=String(m.name||'').trim();if(name)map[name]=1})}catch(e){}acc2DeptAssignments(deptId,true).forEach(function(a){if(a.medName)map[a.medName]=1});return Object.keys(map).sort(function(a,b){return a.localeCompare(b)})}
function acc2Date(v){return String(v||'').slice(0,10)}
function acc2Today(){return new Date().toISOString().slice(0,10)}
function acc2Number(v){return Math.max(0,n(v))}
function acc2UniqueLines(value){var seen={};return String(value||'').split(/\r?\n/).map(function(x){return x.trim()}).filter(function(x){var k=norm(x);if(!k||seen[k])return false;seen[k]=1;return true})}
function acc2FilterRows(rows){var f=ACC2_UI.filters||{};return rows.filter(function(u){var a=acc2Assignment(u.assignmentId)||{};return (!f.dept||String(u.deptId)===String(f.dept))&&(!f.status||u.status===f.status)&&(!f.medicine||norm(a.medName||u.medName).indexOf(norm(f.medicine))>=0)})}
function acc2Sum(rows,field){return (rows||[]).reduce(function(total,row){return total+acc2Number(row[field||'units'])},0)}
function acc2ActorMeta(){var a=actor();return {name:a.name,user:a.user,at:now()}}
function acc2RegimenNotice(deptId){return acc2Regimens().filter(function(r){return r.active!==false&&String(r.deptId)===String(deptId)}).map(function(r){var version=acc2RegimenVersion(r),items=(version&&version.items)||[];return '<div class="acc2-regimen-notice '+(r.paused?'paused':'')+'"><div><b>'+esc(r.name||'Regimen')+' — '+esc((version&&version.label)||'—')+'</b><div class="fhint">'+items.map(function(i){var a=acc2Assignment(i.assignmentId)||{};return esc(a.medName||i.medName||'Medicine')+' × '+acc2Number(i.qty)}).join(' · ')+'</div></div><span class="badge '+(r.paused?'brd':'bgn')+'">'+(r.paused?'Entry paused / الإدخال متوقف':'Active regimen / الخطة المعتمدة')+'</span></div>'}).join('')}

window.acc2SetAdminTab=function(tab){ACC2_UI.adminTab=tab;renderMedicationAccountability()};
window.acc2SetFilter=function(key,value){ACC2_UI.filters[key]=value;r17AccRenderVerify()};
window.acc2SetReceiptDept=function(value){ACC2_UI.receiptDept=value;renderMedicationAccountability()};
window.acc2RegimenDeptChanged=function(value){ACC2_UI.regimenDept=value;ACC2_UI.editRegimenId='';renderMedicationAccountability()};

function acc2AdminStats(){var assignments=acc2Assignments(),usage=acc2Usage(),waiting=usage.filter(function(u){return u.status==='approved_waiting_receipt'});return '<div class="acc2-stats"><div class="sc"><div class="sl">Active custody lines / العهد</div><div class="sv">'+assignments.filter(function(a){return a.active!==false}).length+'</div></div><div class="sc"><div class="sl">Pending pharmacy review</div><div class="sv">'+usage.filter(function(u){return u.status==='pending_pharmacy'}).length+'</div></div><div class="sc"><div class="sl">Approved waiting receipt</div><div class="sv">'+waiting.length+'</div><div class="ss">'+acc2Sum(waiting)+' units</div></div><div class="sc"><div class="sl">Rejected</div><div class="sv">'+usage.filter(function(u){return u.status==='rejected'}).length+'</div></div></div>'}
function acc2AdminTabs(){var tabs=[['custody','Custody setup / إعداد العهدة'],['review','Review / المراجعة'],['handover','Receipt & handover / الاستلام والتسليم'],['regimens','Regimens / الخطط العلاجية']];return '<div class="acc2-tabs">'+tabs.map(function(t){return '<button class="acc2-tab '+(ACC2_UI.adminTab===t[0]?'on':'')+'" type="button" onclick="acc2SetAdminTab(\''+t[0]+'\')">'+t[1]+'</button>'}).join('')+'</div>'}

function acc2CustodyTab(){var assignments=acc2Assignments(),edit=acc2Assignment(ACC2_UI.editAssignmentId,assignments),deptId=edit?edit.deptId:'',names=acc2MedicationNames(deptId);return '<div class="card acc2-hero"><div class="ch"><div><span class="ct">Independent department custody / عهدة القسم المستقلة</span><div class="fhint">This custody is independent from department Inventory. You may type a new medicine name that does not exist in Inventory; saving here never adds it to meds_&lt;department&gt;.<br>هذه العهدة مستقلة عن مخزون القسم. يمكنك كتابة اسم علاج غير موجود في Inventory ولن تتم إضافته إلى قائمة مخزون القسم.</div></div></div><div class="cb"><input id="acc2-assignment-id" type="hidden" value="'+esc(edit&&edit.id||'')+'"><div class="acc2-form-grid"><div class="fg"><label>Department / القسم *</label><select id="acc2-assignment-dept" onchange="acc2RefreshMedicationList()"><option value="">Select department...</option>'+depts().map(function(d){return '<option value="'+esc(d.id)+'" '+(String(deptId)===String(d.id)?'selected':'')+'>'+esc(d.name)+'</option>'}).join('')+'</select></div><div class="fg"><label>Medicine / العلاج *</label><input id="acc2-assignment-med" list="acc2-medication-list" value="'+esc(edit&&edit.medName||'')+'" placeholder="Medicine name"><datalist id="acc2-medication-list">'+names.map(function(x){return '<option value="'+esc(x)+'">'}).join('')+'</datalist></div><div class="fg"><label>Approved custody quantity / كمية العهدة *</label><input id="acc2-assignment-quota" type="number" min="0.001" step="any" value="'+esc(edit&&edit.quota!=null?edit.quota:'')+'"></div><div class="fg acc2-check-field"><label><input id="acc2-assignment-active" type="checkbox" '+(!edit||edit.active!==false?'checked':'')+'> Active / مفعّلة</label></div></div><div class="fg"><label>Allowed usage reasons — one reason per line / أسباب الاستهلاك *</label><textarea id="acc2-assignment-reasons" rows="4" placeholder="Emergency dose\nProcedure\nProtocol dose">'+esc(edit&&(edit.reasons||[]).join('\n')||'')+'</textarea></div><div class="fl g8"><button class="btn bp" type="button" onclick="acc2SaveAssignment()">'+(edit?'Save custody changes / حفظ التعديل':'Create custody / إنشاء العهدة')+'</button>'+(edit?'<button class="btn bg" type="button" onclick="acc2CancelAssignmentEdit()">Cancel</button>':'')+'</div></div></div><div class="card"><div class="ch"><span class="ct">Department custody register / سجل العهد</span></div><div class="tw"><table class="acc2-table"><thead><tr><th>Department</th><th>Medicine</th><th>Approved custody</th><th>Current balance</th><th>Reasons</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+assignments.map(function(a){return '<tr><td>'+esc(deptName(a.deptId))+'</td><td><b>'+esc(a.medName)+'</b></td><td>'+acc2Number(a.quota)+'</td><td><b>'+acc2Number(a.balance)+'</b></td><td>'+esc((a.reasons||[]).join('، ')||'—')+'</td><td><span class="badge '+(a.active===false?'bgr':'bgn')+'">'+(a.active===false?'Inactive':'Active')+'</span></td><td><button class="btn bg bxs" onclick="acc2EditAssignment(\''+esc(a.id)+'\')">Edit</button> <button class="btn '+(a.active===false?'bs':'bd2c')+' bxs" onclick="acc2ToggleAssignment(\''+esc(a.id)+'\')">'+(a.active===false?'Activate':'Deactivate')+'</button> <button class="btn bd2c bxs" onclick="acc2DeleteAssignment(\''+esc(a.id)+'\')">Delete</button></td></tr>'}).join('')+'</tbody></table></div></div>'}

window.acc2RefreshMedicationList=function(){var dept=(E('acc2-assignment-dept')||{}).value||'',list=E('acc2-medication-list');if(list)list.innerHTML=acc2MedicationNames(dept).map(function(x){return '<option value="'+esc(x)+'">'}).join('')};
window.acc2EditAssignment=function(id){ACC2_UI.editAssignmentId=id;ACC2_UI.adminTab='custody';renderMedicationAccountability()};
window.acc2CancelAssignmentEdit=function(){ACC2_UI.editAssignmentId='';renderMedicationAccountability()};
window.acc2SaveAssignment=async function(){if(!canAccManage())return toast('Not authorized.','err');var id=(E('acc2-assignment-id')||{}).value||'',deptId=(E('acc2-assignment-dept')||{}).value||'',medName=String((E('acc2-assignment-med')||{}).value||'').trim(),quota=acc2Number((E('acc2-assignment-quota')||{}).value),reasons=acc2UniqueLines((E('acc2-assignment-reasons')||{}).value),active=!!(E('acc2-assignment-active')&&E('acc2-assignment-active').checked);if(!deptId||!medName||!(quota>0)||!reasons.length)return toast('Department, medicine, positive custody quantity and at least one reason are required.','err');var list=acc2Assignments().map(function(x){return Object.assign({},x)}),duplicate=list.find(function(x){return String(x.deptId)===String(deptId)&&norm(x.medName)===norm(medName)&&String(x.id)!==String(id)});if(duplicate)return toast('This medicine already has a custody record for the selected department.','err');var meta=acc2ActorMeta(),row=list.find(function(x){return String(x.id)===String(id)});if(row){var deficit=Math.max(0,acc2Number(row.quota)-acc2Number(row.balance));row.deptId=deptId;row.medName=medName;row.quota=quota;row.balance=Math.max(0,Math.min(quota,quota-deficit));row.reasons=reasons;row.active=active;row.updatedAt=meta.at;row.updatedBy=meta.name}else{list.push({id:uid('acc2a'),deptId:deptId,medName:medName,quota:quota,balance:quota,reasons:reasons,active:active,createdAt:meta.at,createdBy:meta.name,updatedAt:meta.at,updatedBy:meta.name})}await S.s(ACC2_ASSIGNMENTS_KEY,list);ACC2_UI.editAssignmentId='';toast('Department custody saved ✓','succ');renderMedicationAccountability()};
window.acc2ToggleAssignment=async function(id){if(!canAccManage())return toast('Not authorized.','err');var list=acc2Assignments().map(function(x){return Object.assign({},x)}),row=acc2Assignment(id,list);if(!row)return;row.active=row.active===false;row.updatedAt=now();row.updatedBy=actor().name;await S.s(ACC2_ASSIGNMENTS_KEY,list);renderMedicationAccountability()};
window.acc2DeleteAssignment=async function(id){if(!canAccManage())return toast('Not authorized.','err');var history=acc2Usage().some(function(u){return String(u.assignmentId)===String(id)});if(history)return toast('This custody has transaction history and cannot be deleted. Deactivate it instead.','err');var ok=typeof uiConfirm==='function'?await uiConfirm('Delete this custody permanently? / حذف هذه العهدة نهائيًا؟'):window.confirm('Delete this custody permanently?');if(!ok)return;await S.s(ACC2_ASSIGNMENTS_KEY,acc2Assignments().filter(function(a){return String(a.id)!==String(id)}));renderMedicationAccountability()};

function acc2ReviewTab(){var f=ACC2_UI.filters||{},rows=acc2FilterRows(acc2Usage().slice().sort(function(a,b){return String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))}));return '<div class="card"><div class="ch"><div><span class="ct">Pharmacy review / مراجعة الصيدلية</span><div class="fhint">Approving does not replenish the department balance. Replenishment occurs only after nursing receipt is recorded.</div></div></div><div class="cb"><div class="acc2-filter-grid"><div class="fg"><label>Department</label><select onchange="acc2SetFilter(\'dept\',this.value)"><option value="">All departments</option>'+depts().map(function(d){return '<option value="'+esc(d.id)+'" '+(String(f.dept)===String(d.id)?'selected':'')+'>'+esc(d.name)+'</option>'}).join('')+'</select></div><div class="fg"><label>Status</label><select onchange="acc2SetFilter(\'status\',this.value)"><option value="">All statuses</option>'+['pending_pharmacy','approved_waiting_receipt','received_locked','rejected'].map(function(s){return '<option value="'+s+'" '+(f.status===s?'selected':'')+'>'+acc2StatusLabel(s)+'</option>'}).join('')+'</select></div><div class="fg"><label>Medicine</label><input value="'+esc(f.medicine||'')+'" oninput="ACC2_UI.filters.medicine=this.value;clearTimeout(window.acc2FilterTimer);window.acc2FilterTimer=setTimeout(r17AccRenderVerify,140)" placeholder="Search medicine"></div></div><div id="r17-acc-verify"></div></div></div>'}
window.r17AccRenderVerify=function(){var host=E('r17-acc-verify');if(!host){renderMedicationAccountability();return}var rows=acc2FilterRows(acc2Usage().slice().sort(function(a,b){return String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))}));if(!rows.length){host.innerHTML='<div class="acc2-empty">No records match the selected filters.</div>';return}host.innerHTML='<div class="tw"><table class="acc2-table"><thead><tr><th>Date</th><th>Department</th><th>Medicine</th><th>Used</th><th>Patient file</th><th>Doctor</th><th>Reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>'+rows.map(function(u){var locked=u.status!=='pending_pharmacy';return '<tr><td>'+esc(u.consumptionDate||'—')+'</td><td>'+esc(deptName(u.deptId))+'</td><td><b>'+esc(u.medName||((acc2Assignment(u.assignmentId)||{}).medName)||'—')+'</b></td><td>'+acc2Number(u.units)+'</td><td>'+esc(u.patientFile||'—')+'</td><td>'+esc(u.doctor||'—')+'</td><td>'+esc(u.reasonLabel||'—')+'</td><td><span class="badge '+acc2StatusClass(u.status)+'">'+acc2StatusLabel(u.status)+'</span><div class="fhint">'+esc(u.pharmacyNote||u.rejectionReason||'')+'</div></td><td>'+(locked?'<span class="fhint">Decision completed</span>':'<input id="acc2-decision-note-'+esc(u.id)+'" placeholder="Optional note / ملاحظة اختيارية"><div class="fl g8"><button class="btn bs bxs" onclick="acc2Decision(\''+esc(u.id)+'\',\'approve\')">Approve</button><button class="btn bd2c bxs" onclick="acc2Decision(\''+esc(u.id)+'\',\'reject\')">Reject</button></div>')+'</td></tr>'}).join('')+'</tbody></table></div>'};
window.acc2Decision=async function(id,decision){if(!canAccManage())return toast('Not authorized.','err');var rows=acc2Usage().map(function(x){return Object.assign({},x)}),u=rows.find(function(x){return String(x.id)===String(id)});if(!u||u.status!=='pending_pharmacy')return toast('This request is no longer pending.','err');var note=String((E('acc2-decision-note-'+id)||{}).value||'').trim(),meta=acc2ActorMeta();if(decision==='approve'){u.status='approved_waiting_receipt';u.approvedAt=meta.at;u.approvedBy=meta.name;u.approvedByUser=meta.user;u.pharmacyNote=note}else{u.status='rejected';u.rejectedAt=meta.at;u.rejectedBy=meta.name;u.rejectedByUser=meta.user;u.rejectionReason=note;u.pharmacyNote=note}await S.s(ACC2_USAGE_KEY,rows);toast(decision==='approve'?'Request approved; balance will change only after nursing receipt ✓':'Request rejected. The consumed units remain deducted from custody.','succ');r17AccRenderVerify()};

function acc2HandoverTab(){var deptFilter=ACC2_UI.receiptDept||'',usage=acc2Usage(),waiting=usage.filter(function(u){return u.status==='approved_waiting_receipt'&&(!deptFilter||String(u.deptId)===String(deptFilter))}),receipts=acc2Receipts().filter(function(r){return !deptFilter||String(r.deptId)===String(deptFilter)}).sort(function(a,b){return String(b.receivedAt||b.createdAt||'').localeCompare(String(a.receivedAt||a.createdAt||''))}),byDept={};waiting.forEach(function(u){var key=String(u.deptId||'');if(!byDept[key])byDept[key]=[];byDept[key].push(u)});var cards=Object.keys(byDept).map(function(deptId){var rows=byDept[deptId],total=acc2Sum(rows);return '<div class="card acc2-qr-dept-card" data-acc2-qr-dept="'+esc(deptId)+'"><div class="ch"><div><span class="ct">'+esc(deptName(deptId))+'</span><div class="fhint">Select approved records, then create two temporary QR codes: pharmacy delivery and department receipt. The balance is replenished only after both confirmations.<br>حدد السجلات المعتمدة ثم أنشئ رمزين مؤقتين: تسليم الصيدلية واستلام القسم. لا يُعوض الرصيد إلا بعد تأكيد الطرفين.</div></div><span class="badge bbl">'+rows.length+' request(s) · '+total+' units</span></div><div class="tw"><table class="acc2-table"><thead><tr><th></th><th>Medicine / العلاج</th><th>Units / الوحدات</th><th>Consumption date</th><th>Patient file</th><th>QR status</th></tr></thead><tbody>'+rows.map(function(u){var activeQr=!!(u.handoverSessionId&&u.handoverExpiresAt&&new Date(u.handoverExpiresAt).getTime()>Date.now());return '<tr><td><input class="acc2-qr-usage" data-dept="'+esc(deptId)+'" type="checkbox" value="'+esc(u.id)+'" '+(activeQr?'disabled':'')+'></td><td><b>'+esc(u.medName||'—')+'</b></td><td>'+acc2Number(u.units)+'</td><td>'+esc(u.consumptionDate||'—')+'</td><td>'+esc(u.patientFile||'—')+'</td><td>'+(activeQr?'<span class="badge byl">Active QR session</span>':u.handoverSessionId?'<span class="badge brd">Expired — may reissue</span>':'<span class="badge bgr">Not created</span>')+'</td></tr>'}).join('')+'</tbody></table></div><div class="fl g8" style="margin-top:12px"><button class="btn bg bsm" type="button" data-acc2-qr-action="select" data-dept="'+esc(deptId)+'">Select available / تحديد المتاح</button><button class="btn bs" type="button" data-acc2-qr-action="create" data-dept="'+esc(deptId)+'">Create temporary dual QR / إنشاء رمزي QR مؤقتين</button></div></div>'}).join('');return '<div class="card"><div class="ch"><div><span class="ct">Temporary dual-QR handover / الاستلام والتسليم برمزي QR مؤقتين</span><div class="fhint">Each QR expires after 30 minutes and can confirm only its assigned party. No login or OTP is required; employee name and number are recorded.<br>تنتهي صلاحية كل رمز بعد 30 دقيقة ويؤكد الطرف المخصص له فقط. لا يلزم تسجيل دخول أو رمز OTP، ويُسجل اسم الموظف ورقمه.</div></div></div><div class="cb"><div class="fg" style="max-width:320px"><label>Department filter</label><select onchange="acc2SetReceiptDept(this.value)"><option value="">All departments</option>'+depts().map(function(d){return '<option value="'+esc(d.id)+'" '+(String(deptFilter)===String(d.id)?'selected':'')+'>'+esc(d.name)+'</option>'}).join('')+'</select></div></div></div>'+(cards||'<div class="card"><div class="cb"><div class="acc2-empty">No approved requests are waiting for QR handover.</div></div></div>')+'<div class="card"><div class="ch"><span class="ct">Receipt and handover history / سجل الاستلام والتسليم</span></div><div class="tw"><table class="acc2-table"><thead><tr><th>Receipt date</th><th>Department</th><th>Pharmacy delivered by</th><th>Department received by</th><th>Requests</th><th>Units</th><th>Medicines</th><th>Method</th></tr></thead><tbody>'+receipts.map(function(r){return '<tr><td>'+esc(r.receivedDate||acc2Date(r.receivedAt))+'</td><td>'+esc(deptName(r.deptId))+'</td><td><b>'+esc(r.pharmacyName||'—')+'</b>'+(r.pharmacyEmployeeId?'<div class="fhint">'+esc(r.pharmacyEmployeeId)+'</div>':'')+'</td><td><b>'+esc(r.nurseName||'—')+'</b>'+(r.departmentEmployeeId?'<div class="fhint">'+esc(r.departmentEmployeeId)+'</div>':'')+'</td><td>'+((r.usageIds||[]).length)+'</td><td>'+acc2Number(r.totalUnits)+'</td><td>'+esc((r.medicineTotals||[]).map(function(x){return x.medName+' × '+x.units}).join('، '))+'</td><td>'+esc(r.confirmationMethod==='temporary_dual_qr'?'Dual QR / رمزان QR':'Legacy / سابق')+'</td></tr>'}).join('')+'</tbody></table></div></div>'}

function acc2RegimenBuilder(){var edit=acc2Regimens().find(function(r){return String(r.id)===String(ACC2_UI.editRegimenId)})||null,deptId=edit?edit.deptId:(ACC2_UI.regimenDept||''),assignments=acc2DeptAssignments(deptId),activeVersion=edit&&acc2RegimenVersion(edit);return '<div class="card"><div class="ch"><div><span class="ct">'+(edit?'Add a new regimen version / إضافة نسخة جديدة':'Create regimen / إنشاء خطة علاجية')+'</span><div class="fhint">Each regimen belongs to one department and can contain several medicines with approved quantities.</div></div></div><div class="cb"><div class="acc2-form-grid"><div class="fg"><label>Department *</label><select id="acc2-regimen-dept" '+(edit?'disabled':'')+' onchange="acc2RegimenDeptChanged(this.value)"><option value="">Select department...</option>'+depts().map(function(d){return '<option value="'+esc(d.id)+'" '+(String(deptId)===String(d.id)?'selected':'')+'>'+esc(d.name)+'</option>'}).join('')+'</select></div><div class="fg"><label>Regimen name *</label><input id="acc2-regimen-name" value="'+esc(edit&&edit.name||'')+'" '+(edit?'readonly':'')+' placeholder="Sepsis"></div><div class="fg"><label>Infection source / indication *</label><input id="acc2-regimen-source" value="'+esc(edit&&edit.infectionSource||'')+'" placeholder="Pneumonia, UTI, abdominal..."></div><div class="fg"><label>Treatment line *</label><select id="acc2-regimen-line"><option value="first_line">First-line</option><option value="second_line">Second-line</option><option value="third_line">Third-line</option></select></div><div class="fg"><label>Version label *</label><input id="acc2-regimen-version" placeholder="Regimen A"></div></div><div class="acc2-regimen-items">'+(assignments.length?assignments.map(function(a){var defaultQty=(activeVersion&&((activeVersion.items||[]).find(function(i){return String(i.assignmentId)===String(a.id)})||{}).qty)||'';return '<label class="acc2-regimen-item"><input type="checkbox" data-acc2-regimen-assignment="'+esc(a.id)+'" '+(defaultQty?'checked':'')+'><span><b>'+esc(a.medName)+'</b><small>Custody '+acc2Number(a.quota)+' · balance '+acc2Number(a.balance)+'</small></span><input class="acc2-regimen-qty" data-assignment="'+esc(a.id)+'" type="number" min="0.001" step="any" value="'+esc(defaultQty)+'" placeholder="Qty"></label>'}).join(''):'<div class="acc2-empty">Select a department with active custody medicines first.</div>')+'</div><div class="fl g8"><button class="btn bp" onclick="acc2SaveRegimenVersion()">'+(edit?'Add version':'Create regimen')+'</button>'+(edit?'<button class="btn bg" onclick="acc2CancelRegimenEdit()">Cancel</button>':'')+'</div></div></div>'}
function acc2RegimensTab(){var regimens=acc2Regimens();return acc2RegimenBuilder()+'<div class="card"><div class="ch"><span class="ct">Configured regimens / الخطط المعرّفة</span></div><div class="cb">'+(regimens.length?regimens.map(function(r){var version=acc2RegimenVersion(r),items=(version&&version.items)||[];return '<div class="acc2-regimen-admin '+(r.paused?'paused':'')+'"><div class="acc2-regimen-head"><div><b>'+esc(r.name)+'</b><div class="fhint">'+esc(r.infectionSource||'Indication not set')+' · '+esc(deptName(r.deptId))+'</div></div><div class="fl g8"><select onchange="acc2ActivateRegimen(\''+esc(r.id)+'\',this.value)">'+(r.versions||[]).map(function(v){return '<option value="'+esc(v.id)+'" '+(String(v.id)===String(r.activeVersionId)?'selected':'')+'>'+esc(v.label)+'</option>'}).join('')+'</select><button class="btn '+(r.paused?'bs':'bd2c')+' bsm" onclick="acc2ToggleRegimenPause(\''+esc(r.id)+'\')">'+(r.paused?'Resume entry / استئناف':'Pause for replacement / إيقاف للاستبدال')+'</button><button class="btn bg bsm" onclick="acc2StartRegimenVersion(\''+esc(r.id)+'\')">+ Version</button><button class="btn bd2c bsm" onclick="acc2DeleteRegimen(\''+esc(r.id)+'\')">Delete</button></div></div><div class="acc2-regimen-lines">'+items.map(function(i){var a=acc2Assignment(i.assignmentId)||{};return '<span>'+esc(a.medName||i.medName||'Medicine')+' × '+acc2Number(i.qty)+'</span>'}).join('')+'</div><div class="fhint">'+(r.paused?'Department entry is currently blocked for medicines in this regimen.':'Department sees this as the currently approved regimen.')+'</div></div>'}).join(''):'<div class="acc2-empty">No regimens configured.</div>')+'</div></div>'}
window.acc2StartRegimenVersion=function(id){ACC2_UI.editRegimenId=id;ACC2_UI.adminTab='regimens';renderMedicationAccountability()};
window.acc2CancelRegimenEdit=function(){ACC2_UI.editRegimenId='';renderMedicationAccountability()};
window.acc2SaveRegimenVersion=async function(){if(!canAccManage())return toast('Not authorized.','err');var list=acc2Regimens().map(function(x){return clone(x)}),edit=list.find(function(r){return String(r.id)===String(ACC2_UI.editRegimenId)})||null,deptId=edit?edit.deptId:((E('acc2-regimen-dept')||{}).value||''),name=edit?edit.name:String((E('acc2-regimen-name')||{}).value||'').trim(),label=String((E('acc2-regimen-version')||{}).value||'').trim(),infectionSource=String((E('acc2-regimen-source')||{}).value||'').trim(),lineType=String((E('acc2-regimen-line')||{}).value||'first_line'),items=[];document.querySelectorAll('[data-acc2-regimen-assignment]:checked').forEach(function(chk){var assignmentId=chk.getAttribute('data-acc2-regimen-assignment'),qty=acc2Number((document.querySelector('.acc2-regimen-qty[data-assignment="'+CSS.escape(assignmentId)+'"]')||{}).value);if(qty>0)items.push({assignmentId:assignmentId,medName:(acc2Assignment(assignmentId)||{}).medName||'',qty:qty})});if(!deptId||!name||!infectionSource||!label||!items.length)return toast('Department, regimen name, infection source, version label and at least one medicine quantity are required.','err');if(!edit){list.forEach(function(existing){if(String(existing.deptId)===String(deptId)&&String(existing.infectionSource||'').toLowerCase()===infectionSource.toLowerCase()){existing.active=false;existing.paused=true;}})}var duplicate={};for(var i=0;i<items.length;i++){if(duplicate[items[i].assignmentId])return toast('A medicine can appear only once in a regimen version.','err');duplicate[items[i].assignmentId]=1}var version={id:uid('acc2v'),label:label,lineType:lineType,items:items,createdAt:now(),createdBy:actor().name};if(edit){edit.infectionSource=infectionSource;edit.versions=Array.isArray(edit.versions)?edit.versions:[];edit.versions.push(version);edit.activeVersionId=version.id;edit.updatedAt=now();edit.updatedBy=actor().name}else{list.push({id:uid('acc2r'),name:name,infectionSource:infectionSource,deptId:deptId,versions:[version],activeVersionId:version.id,paused:false,active:true,createdAt:now(),createdBy:actor().name})}await S.s(ACC2_REGIMENS_KEY,list);ACC2_UI.editRegimenId='';toast('Regimen version saved and activated ✓','succ');renderMedicationAccountability()};
window.acc2ActivateRegimen=async function(id,versionId){if(!canAccManage())return toast('Not authorized.','err');var list=acc2Regimens().map(function(x){return clone(x)}),r=list.find(function(x){return String(x.id)===String(id)});if(!r||!(r.versions||[]).some(function(v){return String(v.id)===String(versionId)}))return;r.activeVersionId=versionId;r.updatedAt=now();r.updatedBy=actor().name;await S.s(ACC2_REGIMENS_KEY,list);toast('Active regimen changed ✓','succ');renderMedicationAccountability()};
window.acc2ToggleRegimenPause=async function(id){if(!canAccManage())return toast('Not authorized.','err');var list=acc2Regimens().map(function(x){return clone(x)}),r=list.find(function(x){return String(x.id)===String(id)});if(!r)return;r.paused=!r.paused;r.pausedAt=r.paused?now():'';r.pausedBy=r.paused?actor().name:'';await S.s(ACC2_REGIMENS_KEY,list);toast(r.paused?'Department entry paused for regimen replacement.':'Department entry resumed.','succ');renderMedicationAccountability()};
window.acc2DeleteRegimen=async function(id){if(!canAccManage())return toast('Not authorized.','err');var ok=typeof uiConfirm==='function'?await uiConfirm('Delete this regimen and all its versions? / حذف الخطة وجميع نسخها؟'):window.confirm('Delete regimen?');if(!ok)return;await S.s(ACC2_REGIMENS_KEY,acc2Regimens().filter(function(r){return String(r.id)!==String(id)}));renderMedicationAccountability()};

function acc2DepartmentCards(deptId){var assignments=acc2DeptAssignments(deptId),usage=acc2Usage().filter(function(u){return String(u.deptId)===String(deptId)}),waiting=usage.filter(function(u){return u.status==='approved_waiting_receipt'});return '<div class="acc2-stats"><div class="sc"><div class="sl">Assigned medicines</div><div class="sv">'+assignments.length+'</div></div><div class="sc"><div class="sl">Approved custody</div><div class="sv">'+acc2Sum(assignments,'quota')+'</div></div><div class="sc"><div class="sl">Current balance</div><div class="sv">'+acc2Sum(assignments,'balance')+'</div></div><div class="sc"><div class="sl">Waiting receipt</div><div class="sv">'+acc2Sum(waiting)+'</div><div class="ss">'+waiting.length+' requests</div></div></div>'+acc2RegimenNotice(deptId)+'<div class="acc2-med-grid">'+assignments.map(function(a){var blocked=acc2SubmissionBlocked(deptId,a.id),remaining=acc2Number(a.balance);return '<div class="card acc2-med-card '+(blocked?'blocked':'')+'"><div class="ch"><div><span class="ct">'+esc(a.medName)+' — عهدتهم '+acc2Number(a.quota)+'</span><div class="fhint">Current available balance / الرصيد المتاح: <b>'+remaining+'</b></div></div><span class="badge '+(remaining>0?'bgn':'brd')+'">'+remaining+' / '+acc2Number(a.quota)+'</span></div><div class="cb">'+(blocked?'<div class="alert-banner">Entry is paused because '+esc(blocked.name)+' is being replaced by pharmacy. / الإدخال متوقف مؤقتًا لاستبدال الخطة.</div>':'')+'<div class="acc2-form-grid"><div class="fg"><label>Units used / الوحدات المستعملة *</label><input data-acc2="units" data-assignment="'+esc(a.id)+'" type="number" min="0.001" max="'+remaining+'" step="any"></div><div class="fg"><label>Consumption date / تاريخ الاستهلاك *</label><input data-acc2="date" data-assignment="'+esc(a.id)+'" type="date" max="'+acc2Today()+'"></div><div class="fg"><label>Patient file number / رقم الملف *</label><input data-acc2="file" data-assignment="'+esc(a.id)+'"></div><div class="fg"><label>Doctor recorded in system / الطبيب المسجل *</label><input data-acc2="doctor" data-assignment="'+esc(a.id)+'"></div><div class="fg"><label>Usage reason / سبب الاستهلاك *</label><select data-acc2="reason" data-assignment="'+esc(a.id)+'"><option value="">Select reason...</option>'+(a.reasons||[]).map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>'}).join('')+'</select></div><div class="fg"><label>Notes / ملاحظات</label><input data-acc2="note" data-assignment="'+esc(a.id)+'"></div></div><button class="btn bp" '+(blocked||remaining<=0?'disabled':'')+' onclick="acc2SubmitUsage(\''+esc(a.id)+'\')">Submit to pharmacy / رفع للصيدلية</button></div></div>'}).join('')+'</div>'}
function acc2DepartmentReceipt(deptId){var rows=acc2Usage().filter(function(u){return String(u.deptId)===String(deptId)&&u.status==='approved_waiting_receipt'}),totals={};rows.forEach(function(u){if(!totals[u.assignmentId])totals[u.assignmentId]={medName:u.medName,count:0,units:0};totals[u.assignmentId].count++;totals[u.assignmentId].units+=acc2Number(u.units)});return '<div class="card"><div class="ch"><div><span class="ct">Nursing receipt and handover / استلام وتسليم التمريض</span><div class="fhint">Receipt is completed through the temporary Department QR generated by pharmacy. The balance is replenished only after pharmacy delivery and department receipt are both confirmed.<br>يتم الاستلام عبر رمز QR المؤقت الخاص بالقسم الذي تنشئه الصيدلية. لا يُعوض الرصيد إلا بعد تأكيد تسليم الصيدلية واستلام القسم.</div></div></div><div class="cb">'+(rows.length?'<div class="acc2-receipt-summary">'+Object.keys(totals).map(function(k){var t=totals[k];return '<span><b>'+esc(t.medName)+'</b>: '+t.units+' units in '+t.count+' request(s)</span>'}).join('')+'</div><div class="alert-banner-y">Ask pharmacy for the temporary Department Receipt QR. Direct in-system receipt is disabled to preserve two-party confirmation.<br>اطلب من الصيدلية رمز QR المؤقت لاستلام القسم. تم تعطيل الاستلام المباشر داخل النظام لضمان تأكيد الطرفين.</div>':'<div class="acc2-empty">No pharmacy-approved requests are waiting for receipt.</div>')+'</div></div>'}
function acc2DepartmentHistory(deptId){var rows=acc2Usage().filter(function(u){return String(u.deptId)===String(deptId)}).sort(function(a,b){return String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))});return '<div class="card"><div class="ch"><span class="ct">Medication accountability history / سجل الاستخدام</span></div><div class="tw"><table class="acc2-table"><thead><tr><th>Consumption date</th><th>Medicine</th><th>Units</th><th>Patient file</th><th>Doctor</th><th>Reason</th><th>Status</th><th>Pharmacy note</th></tr></thead><tbody>'+rows.map(function(u){return '<tr><td>'+esc(u.consumptionDate||'—')+'</td><td><b>'+esc(u.medName||'—')+'</b></td><td>'+acc2Number(u.units)+'</td><td>'+esc(u.patientFile||'—')+'</td><td>'+esc(u.doctor||'—')+'</td><td>'+esc(u.reasonLabel||'—')+'</td><td><span class="badge '+acc2StatusClass(u.status)+'">'+acc2StatusLabel(u.status)+'</span></td><td>'+esc(u.pharmacyNote||u.rejectionReason||'—')+'</td></tr>'}).join('')+'</tbody></table></div></div>'}
window.acc2SubmitUsage=async function(assignmentId){if(!acc2DepartmentRole())return toast('Department access required.','err');var original=acc2Assignments(),list=original.map(function(x){return Object.assign({},x)}),a=acc2Assignment(assignmentId,list);if(!a||a.active===false||String(a.deptId)!==String(CU.deptId))return toast('Custody is not available for this department.','err');var blocked=acc2SubmissionBlocked(a.deptId,a.id);if(blocked)return toast('Entry is paused while '+blocked.name+' is being replaced.','err');function read(kind){var el=document.querySelector('[data-acc2="'+kind+'"][data-assignment="'+CSS.escape(String(assignmentId))+'"]');return el?String(el.value||'').trim():''}var units=acc2Number(read('units')),date=read('date'),file=read('file'),doctor=read('doctor'),reasonLabel=read('reason'),note=read('note');if(!(units>0)||!date||!file||!doctor||!reasonLabel)return toast('Units, consumption date, patient file, doctor and reason are required.','err');if(date>acc2Today())return toast('Consumption date cannot be in the future.','err');if(units>acc2Number(a.balance))return toast('Used units exceed the current custody balance.','err');a.balance=acc2Number(a.balance)-units;a.updatedAt=now();a.updatedBy=actor().name;var meta=acc2ActorMeta(),row={id:uid('acc2u'),assignmentId:a.id,deptId:a.deptId,medName:a.medName,units:units,consumptionDate:date,patientFile:file,doctor:doctor,reasonLabel:reasonLabel,note:note,status:'pending_pharmacy',submittedAt:meta.at,submittedBy:meta.name,submittedByUser:meta.user,locked:false},usage=acc2Usage().concat([row]);try{await S.s(ACC2_ASSIGNMENTS_KEY,list);try{await S.s(ACC2_USAGE_KEY,usage)}catch(error){await S.s(ACC2_ASSIGNMENTS_KEY,original);throw error}toast('Usage submitted and '+units+' unit(s) deducted from department custody ✓','succ');renderMedicationAccountability()}catch(error){console.error(error);toast(String(error&&error.message||error),'err')}};
window.acc2ToggleAllReceipt=function(on){document.querySelectorAll('.acc2-receipt-check').forEach(function(x){x.checked=!!on})};
window.acc2CreateReceipt=async function(){
  if(!acc2DepartmentRole())return toast('Department access required.','err');
  var ids=Array.from(document.querySelectorAll('.acc2-receipt-check:checked')).map(function(x){return x.value}),nurse=String((E('acc2-receipt-nurse')||{}).value||'').trim(),receivedDate=String((E('acc2-receipt-date')||{}).value||'').trim();
  if(!ids.length||!nurse||!receivedDate)return toast('Select approved requests and enter nurse name and receipt date.','err');
  if(receivedDate>acc2Today())return toast('Receipt date cannot be in the future.','err');
  var originalAssignments=acc2Assignments(),assignments=originalAssignments.map(function(x){return Object.assign({},x)}),originalUsage=acc2Usage(),usage=originalUsage.map(function(x){return Object.assign({},x)}),selected=usage.filter(function(u){return ids.indexOf(String(u.id))>=0});
  if(selected.length!==ids.length||selected.some(function(u){return u.status!=='approved_waiting_receipt'||String(u.deptId)!==String(CU.deptId)}))return toast('One or more selected requests are no longer eligible for receipt.','err');
  try{
    var totals={};selected.forEach(function(u){totals[u.assignmentId]=(totals[u.assignmentId]||0)+acc2Number(u.units)});
    Object.keys(totals).forEach(function(assignmentId){var a=acc2Assignment(assignmentId,assignments);if(!a)throw new Error('Custody assignment was not found.');var next=acc2Number(a.balance)+totals[assignmentId];if(next>acc2Number(a.quota)+1e-9)throw new Error(a.medName+': receipt would exceed the approved custody quantity.');a.balance=next;a.updatedAt=now();a.updatedBy=actor().name});
    var receiptId=uid('acc2receipt'),meta=acc2ActorMeta();selected.forEach(function(u){u.status='received_locked';u.receiptId=receiptId;u.receivedAt=meta.at;u.receivedDate=receivedDate;u.receivedByNurse=nurse;u.locked=true;u.lockedAt=meta.at});
    var medTotals=Object.keys(totals).map(function(assignmentId){var a=acc2Assignment(assignmentId,assignments)||{};return {assignmentId:assignmentId,medName:a.medName||'',units:totals[assignmentId]}}),receipt={id:receiptId,deptId:CU.deptId,nurseName:nurse,receivedDate:receivedDate,receivedAt:meta.at,usageIds:ids,totalUnits:acc2Sum(selected),medicineTotals:medTotals,createdAt:meta.at,createdBy:meta.name,createdByUser:meta.user,locked:true};
    await S.s(ACC2_ASSIGNMENTS_KEY,assignments);
    try{
      await S.s(ACC2_USAGE_KEY,usage);
      try{await S.s(ACC2_RECEIPTS_KEY,acc2Receipts().concat([receipt]))}
      catch(error3){await S.s(ACC2_USAGE_KEY,originalUsage);throw error3}
    }catch(error2){await S.s(ACC2_ASSIGNMENTS_KEY,originalAssignments);throw error2}
    toast('Nursing receipt recorded; balance replenished and selected rows locked ✓','succ');renderMedicationAccountability();
  }catch(error){console.error(error);toast(String(error&&error.message||error),'err')}
};

window.renderMedicationAccountability=function(){var root=E('r17-accountability-root');if(!root)return;if(acc2DepartmentRole()&&!acc2EffectiveMaster()){var deptId=String((window.CU&&CU.deptId)||'');if(!deptId){root.innerHTML='<div class="alert-banner">Department account is not linked to a department.</div>';return}root.innerHTML=acc2DepartmentCards(deptId)+acc2DepartmentReceipt(deptId)+acc2DepartmentHistory(deptId);return}if(!canAccManage()){root.innerHTML='<div class="alert-banner">Medication Accountability is available only to the Master, Pharmacy Director, Inpatient Pharmacy Supervisor, Pharmacy Staff, and department employees. / الصفحة غير متاحة لهذا الدور.</div>';return}var content=ACC2_UI.adminTab==='review'?acc2ReviewTab():ACC2_UI.adminTab==='handover'?acc2HandoverTab():ACC2_UI.adminTab==='regimens'?acc2RegimensTab():acc2CustodyTab();root.innerHTML=acc2AdminStats()+acc2AdminTabs()+content;if(ACC2_UI.adminTab==='review')r17AccRenderVerify()};

/* ---------- Controlled-pharmacy cabinets and safes ---------- */
var CONTROLLED_STORAGE_KEY='controlled_pharmacy_storage_v1';
var CONTROLLED_STORAGE_UI={editingUnitId:'',draftCounts:[7,5,4,9,2]};

function storageState(){
  var value=clone(S.g(CONTROLLED_STORAGE_KEY)||{mode:'map',units:[]});
  if(!value||typeof value!=='object')value={mode:'map',units:[]};
  if(!Array.isArray(value.units))value.units=[];
  if(value.mode!=='list')value.mode='map';
  return value;
}

function normalizeControlledStorageClassification(value){
  value=String(value||'').trim().toLowerCase();
  return value==='psychotropic'?'psychotropic':'narcotic';
}

function controlledMeds(){
  var catalog=typeof ctlCatalog==='function'?(ctlCatalog()||[]):[];
  var pharmacy=typeof ctlPharmacy==='function'?(ctlPharmacy()||{}):{};
  var medicinesById={};

  catalog.forEach(function(medicine){
    if(!medicine||medicine.id==null||String(medicine.id).trim()==='')return;
    var id=String(medicine.id);
    var stock=pharmacy[id]||{};
    medicinesById[id]={
      id:id,
      name:medicine.name||stock.name||id,
      moh:medicine.moh||medicine.mohCode||stock.moh||stock.mohCode||'',
      nupco:medicine.nupco||medicine.nupcoCode||stock.nupco||stock.nupcoCode||'',
      classification:normalizeControlledStorageClassification(
        medicine.classification||stock.classification
      ),
      batches:Array.isArray(stock.batches)?stock.batches:[],
      qty:stock.qty!=null
        ?stock.qty
        :(stock.actualQty!=null?stock.actualQty:0),
      hasPharmacyStock:Object.prototype.hasOwnProperty.call(pharmacy,id)
    };
  });

  Object.keys(pharmacy).forEach(function(id){
    if(medicinesById[id])return;
    var stock=pharmacy[id]||{};
    medicinesById[id]={
      id:String(id),
      name:stock.name||id,
      moh:stock.moh||stock.mohCode||'',
      nupco:stock.nupco||stock.nupcoCode||'',
      classification:normalizeControlledStorageClassification(
        stock.classification
      ),
      batches:Array.isArray(stock.batches)?stock.batches:[],
      qty:stock.qty!=null
        ?stock.qty
        :(stock.actualQty!=null?stock.actualQty:0),
      hasPharmacyStock:true
    };
  });

  return Object.keys(medicinesById).map(function(id){
    return medicinesById[id];
  }).sort(function(a,b){
    var classOrder=
      (a.classification==='psychotropic'?1:0)-
      (b.classification==='psychotropic'?1:0);
    return classOrder||
      String(a.name).localeCompare(String(b.name));
  });
}

function rowLetter(index){
  var output='',number=index+1;
  while(number>0){number--;output=String.fromCharCode(65+(number%26))+output;number=Math.floor(number/26);}
  return output;
}
function normalizedCellCount(value){
  value=Math.floor(Number(value));
  return isFinite(value)?Math.max(1,Math.min(50,value)):1;
}
function normalizeStorageCounts(values){
  return (Array.isArray(values)?values:[]).slice(0,26).map(normalizedCellCount);
}
function createStorageUnit(name,type,counts,existing){
  existing=existing||{};
  var previousByCode={};
  (existing.rows||[]).forEach(function(row){
    (row.cells||[]).forEach(function(cell){previousByCode[String(cell.code||'')]=cell.medId||'';});
  });
  return {
    id:existing.id||uid('storage'),
    name:String(name||'').trim(),
    type:['cabinet','safe','refrigerator'].indexOf(type)>=0?type:'cabinet',
    createdAt:existing.createdAt||now(),updatedAt:now(),
    rows:normalizeStorageCounts(counts).map(function(count,rowIndex){
      var label=rowLetter(rowIndex);
      return {
        id:(existing.rows&&existing.rows[rowIndex]&&existing.rows[rowIndex].id)||uid('row'),
        label:label,
        cells:Array.from({length:count},function(_,cellIndex){
          var code=label+(cellIndex+1);
          return {
            id:(existing.rows&&existing.rows[rowIndex]&&existing.rows[rowIndex].cells&&existing.rows[rowIndex].cells[cellIndex]&&existing.rows[rowIndex].cells[cellIndex].id)||uid('cell'),
            code:code,medId:previousByCode[code]||''
          };
        })
      };
    })
  };
}
function storageBuilderError(message){
  var box=E('controlled-storage-builder-error');if(!box)return;
  box.textContent=message||'';box.style.display=message?'block':'none';
}
function storageReadCounts(){
  return Array.from(document.querySelectorAll('#controlled-storage-shelf-rows [data-storage-cell-count]')).map(function(input){return normalizedCellCount(input.value);});
}
function storagePreviewHtml(counts){
  return normalizeStorageCounts(counts).map(function(count,index){
    var label=rowLetter(index);
    return '<div class="r21-storage-preview-row"><b>'+esc(label)+'</b>'+Array.from({length:count},function(_,cellIndex){return '<span class="r21-storage-code">'+esc(label+(cellIndex+1))+'</span>';}).join('')+'</div>';
  }).join('');
}
function renderStorageBuilder(counts){
  counts=normalizeStorageCounts(counts&&counts.length?counts:CONTROLLED_STORAGE_UI.draftCounts);
  if(!counts.length)counts=[7,5,4,9,2];
  CONTROLLED_STORAGE_UI.draftCounts=counts.slice();
  var countInput=E('controlled-storage-shelf-count');if(countInput)countInput.value=String(counts.length);
  var rows=E('controlled-storage-shelf-rows');
  if(rows){rows.innerHTML=counts.map(function(count,index){
    var label=rowLetter(index);
    return '<div class="r21-storage-shelf-config"><div class="r21-storage-shelf-label">Shelf '+esc(label)+'<br><small>الرف '+(index+1)+'</small></div><div class="fg"><label>Cells on this shelf / عدد الخانات</label><input type="number" min="1" max="50" value="'+count+'" data-storage-cell-count="'+index+'" oninput="controlledStorageCountsChanged()"></div><div class="r21-storage-shelf-codes">'+Array.from({length:count},function(_,cellIndex){return '<span class="r21-storage-code">'+esc(label+(cellIndex+1))+'</span>';}).join('')+'</div></div>';
  }).join('');}
  var preview=E('controlled-storage-code-preview');if(preview)preview.innerHTML=storagePreviewHtml(counts);
}
window.controlledStorageCountsChanged=function(){
  var counts=storageReadCounts();CONTROLLED_STORAGE_UI.draftCounts=counts;
  var preview=E('controlled-storage-code-preview');if(preview)preview.innerHTML=storagePreviewHtml(counts);
};
window.controlledStorageShelfCountChanged=function(){
  var requested=Math.floor(Number((E('controlled-storage-shelf-count')||{}).value));
  requested=isFinite(requested)?Math.max(1,Math.min(26,requested)):1;
  var current=storageReadCounts(),defaults=[7,5,4,9,2];
  while(current.length<requested)current.push(defaults[current.length]||1);
  renderStorageBuilder(current.slice(0,requested));
};
function resetStorageBuilder(){
  CONTROLLED_STORAGE_UI.editingUnitId='';CONTROLLED_STORAGE_UI.draftCounts=[7,5,4,9,2];
  var edit=E('controlled-storage-edit-id'),name=E('controlled-storage-name'),type=E('controlled-storage-type'),title=E('controlled-storage-builder-title'),cancel=E('controlled-storage-cancel-edit'),save=E('controlled-storage-save');
  if(edit)edit.value='';if(name)name.value='';if(type)type.value='cabinet';
  if(title)title.textContent='Create cabinet or safe / إنشاء دولاب أو خزنة';
  if(cancel)cancel.style.display='none';if(save)save.textContent='Save storage unit / حفظ الوحدة';
  storageBuilderError('');renderStorageBuilder(CONTROLLED_STORAGE_UI.draftCounts);
}
window.controlledStorageOpenCreate=function(){
  resetStorageBuilder();
  OM('mcontrolled-storage-unit');
  setTimeout(function(){var input=E('controlled-storage-name');if(input)input.focus();},40);
};
window.controlledStorageCloseUnitModal=function(){
  CM('mcontrolled-storage-unit');
  resetStorageBuilder();
};
window.controlledStorageCancelEdit=function(){controlledStorageCloseUnitModal();};
window.controlledStorageEditUnit=function(unitId){
  var data=storageState();
  var unit=data.units.find(function(item){return String(item.id)===String(unitId);});
  if(!unit)return;
  CONTROLLED_STORAGE_UI.editingUnitId=unit.id;
  CONTROLLED_STORAGE_UI.draftCounts=(unit.rows||[]).map(function(row){return (row.cells||[]).length||1;});
  E('controlled-storage-edit-id').value=unit.id;E('controlled-storage-name').value=unit.name||'';E('controlled-storage-type').value=unit.type||'cabinet';
  E('controlled-storage-builder-title').textContent='Edit storage unit / تعديل الوحدة';
  E('controlled-storage-cancel-edit').style.display='inline-flex';E('controlled-storage-save').textContent='Save changes / حفظ التعديلات';
  storageBuilderError('');renderStorageBuilder(CONTROLLED_STORAGE_UI.draftCounts);
  OM('mcontrolled-storage-unit');
  setTimeout(function(){var input=E('controlled-storage-name');if(input)input.focus();},40);
};
window.controlledStorageSaveUnit=async function(){
  if(!(typeof window.canControlledPharmacyStorage==='function'&&window.canControlledPharmacyStorage()))return toast('You are not authorized to manage controlled-pharmacy storage.','err');
  var name=String((E('controlled-storage-name')||{}).value||'').trim();
  var type=String((E('controlled-storage-type')||{}).value||'cabinet');
  var counts=storageReadCounts();var editId=String((E('controlled-storage-edit-id')||{}).value||'');var button=E('controlled-storage-save');
  storageBuilderError('');
  if(!name){storageBuilderError('Enter a cabinet, safe, or refrigerator name.');return;}
  if(!counts.length){storageBuilderError('Add at least one shelf.');return;}
  var data=storageState();var existing=editId?data.units.find(function(unit){return String(unit.id)===editId;}):null;
  if(editId&&!existing){storageBuilderError('The storage unit no longer exists. Refresh and try again.');return;}
  if(existing){
    var keptCodes={};counts.forEach(function(count,rowIndex){var label=rowLetter(rowIndex);for(var cellIndex=0;cellIndex<count;cellIndex++)keptCodes[label+(cellIndex+1)]=true;});
    var removed=[];(existing.rows||[]).forEach(function(row){(row.cells||[]).forEach(function(cell){if(cell.medId&&!keptCodes[cell.code])removed.push(cell.code);});});
    if(removed.length){storageBuilderError('Move medicines out of these cells before reducing the layout: '+removed.join(', '));return;}
  }
  var duplicate=data.units.find(function(unit){return String(unit.id)!==editId&&String(unit.name||'').trim().toLowerCase()===name.toLowerCase();});
  if(duplicate){storageBuilderError('A storage unit with this name already exists.');return;}
  var next=createStorageUnit(name,type,counts,existing);
  data.units=existing?data.units.map(function(unit){return String(unit.id)===editId?next:unit;}):data.units.concat([next]);
  if(button)button.disabled=true;
  try{
    await S.s(CONTROLLED_STORAGE_KEY,data);
    var saved=storageState().units.find(function(unit){return String(unit.id)===String(next.id);});
    if(!saved)throw new Error('Storage unit read-back verification failed.');
    CM('mcontrolled-storage-unit');resetStorageBuilder();renderControlledStorage();toast(existing?'Storage unit updated and verified ✓':'Storage unit created and verified ✓','succ');
  }catch(error){console.error(error);storageBuilderError(String(error&&error.message||'Storage unit was not saved.'));}
  finally{if(button)button.disabled=false;}
};
function storageMedicineOptions(medicines,selectedId){
  function groupOptions(list){
    return list.map(function(medicine){
      return '<option value="'+esc(medicine.id)+'"'+
        (String(medicine.id)===String(selectedId)?' selected':'')+
        '>'+esc(medicine.name)+'</option>';
    }).join('');
  }

  var narcotic=medicines.filter(function(medicine){
    return medicine.classification!=='psychotropic';
  });
  var psychotropic=medicines.filter(function(medicine){
    return medicine.classification==='psychotropic';
  });

  return '<option value="">Empty / فارغة</option>'+
    '<optgroup label="Narcotic & restricted / مخدر ومقيد ('+
      narcotic.length+')">'+groupOptions(narcotic)+'</optgroup>'+
    '<optgroup label="Psychotropic / نفسي ('+
      psychotropic.length+')">'+groupOptions(psychotropic)+'</optgroup>';
}
function storageAssignedMap(data){
  var assigned={};data.units.forEach(function(unit){(unit.rows||[]).forEach(function(row){(row.cells||[]).forEach(function(cell){if(cell.medId)assigned[String(cell.medId)]={unitId:unit.id,unitName:unit.name,code:cell.code};});});});return assigned;
}
function storageBatchText(medicine){
  var text=(medicine.batches||[]).map(function(batch){var expiry=batch.expiry||batch.date||'—',lot=batch.lot||batch.batch||'';return expiry+(lot?' · '+lot:'');}).join(' | ');
  return text||'No expiry dates';
}
window.renderControlledStorage=async function(){
  var panel=E('ctl-storage-view'),notice=E('controlled-storage-auth-message'),workspace=E('controlled-storage-workspace');
  if(!panel||!notice||!workspace)return;
  var createButton=E('controlled-storage-create-btn');
  if(!(typeof window.canControlledPharmacyStorage==='function'&&window.canControlledPharmacyStorage())){
    notice.style.display='block';notice.textContent='Not authorized. This tab is available to the actual Master, the Controlled Medicines Pharmacy Officer, or a user with the controlledStorage permission.';workspace.style.display='none';if(createButton)createButton.style.display='none';return;
  }
  notice.style.display='none';workspace.style.display='block';if(createButton)createButton.style.display='inline-flex';
  var data=storageState();var mode=E('controlled-storage-mode');if(mode)mode.value=data.mode||'map';
  var filter=E('controlled-storage-filter'),oldFilter=filter.value;
  filter.innerHTML='<option value="all">All controlled & psychotropic medicines / كل الأدوية المخدرة والنفسية</option><option value="unassigned">Not assigned / غير مضافة لخانة</option>'+data.units.map(function(unit){return '<option value="unit:'+esc(unit.id)+'">'+esc(unit.name)+'</option>';}).join('');
  if(Array.from(filter.options).some(function(option){return option.value===oldFilter;}))filter.value=oldFilter;
  var medicines=controlledMeds(),assigned=storageAssignedMap(data),unitFilter=filter.value;
  var oldList=E('controlled-storage-medicine-list');if(oldList)oldList.remove();
  var medicineList=document.createElement('datalist');medicineList.id='controlled-storage-medicine-list';
  medicineList.innerHTML=medicines.map(function(medicine){return '<option value="'+esc(medicine.name)+'">'+esc(medicine.classification==='psychotropic'?'Psychotropic':'Narcotic & restricted')+'</option>';}).join('');
  document.body.appendChild(medicineList);
  var units=data.units.filter(function(unit){return unitFilter.indexOf('unit:')===0?String(unit.id)===unitFilter.slice(5):true;});
  var narcoticStorageCount=medicines.filter(function(medicine){
    return medicine.classification!=='psychotropic';
  }).length;
  var psychotropicStorageCount=medicines.filter(function(medicine){
    return medicine.classification==='psychotropic';
  }).length;
  var summary=E('controlled-storage-summary');
  if(summary)summary.innerHTML=
    '<span>Controlled & psychotropic pharmacy storage / تخزين الأدوية المخدرة والنفسية</span>'+
    '<span class="chip" style="margin-inline-start:auto">Total '+medicines.length+'</span>'+
    '<span class="chip">Narcotic & restricted '+narcoticStorageCount+'</span>'+
    '<span class="chip">Psychotropic '+psychotropicStorageCount+'</span>'+
    '<span class="chip">'+data.units.length+' unit(s)</span>';
  if(!E('controlled-storage-shelf-rows').children.length)renderStorageBuilder(CONTROLLED_STORAGE_UI.draftCounts);
  if(unitFilter==='unassigned'){
    var unassigned=medicines.filter(function(medicine){return !assigned[String(medicine.id)];});
    E('controlled-storage-root').innerHTML=
      '<div class="card"><div class="ch"><span class="ct">'+
      'Controlled & psychotropic medicines not assigned to a cell / '+
      'الأدوية المخدرة والنفسية غير المضافة لخانة</span></div>'+
      '<div class="cb"><div class="r21-storage-unassigned-list">'+
      (unassigned.length?unassigned.map(function(medicine){
        return '<span class="chip">'+
          (medicine.classification==='psychotropic'?'Psychotropic · ':'Narcotic · ')+
          esc(medicine.name)+'</span>';
      }).join(''):
      '<span class="fhint">Every controlled and psychotropic medicine is assigned to a cell.</span>')+
      '</div></div></div>';
    return;
  }
  if(!data.units.length){E('controlled-storage-root').innerHTML='<div class="r21-storage-empty"><b>No cabinets or safes yet / لا توجد دواليب أو خزائن</b><div style="margin-top:6px">Use the form above to define the first unit for the controlled-pharmacy custody.</div></div>';return;}
  E('controlled-storage-root').innerHTML=units.map(function(unit){
    var actions='<div class="r21-storage-unit-actions"><button class="btn bg bxs" type="button" onclick="controlledStorageEditUnit(\''+unit.id+'\')">Edit layout</button><button class="btn bg bxs" type="button" onclick="controlledStoragePrint(\''+unit.id+'\',\'list\')">Print list</button><button class="btn bg bxs" type="button" onclick="controlledStoragePrint(\''+unit.id+'\',\'map\')">Print map</button><button class="btn bd2c bxs" type="button" onclick="controlledStorageDeleteUnit(\''+unit.id+'\')">Delete</button></div>';
    var head='<div class="r17-unit-head"><div class="r21-storage-unit-meta"><b>'+esc(unit.name)+'</b><span class="chip">'+esc(unit.type)+'</span><span class="chip">'+(unit.rows||[]).length+' shelf/shelves</span></div>'+actions+'</div>';
    if(data.mode==='list'){
      var listRows=[];(unit.rows||[]).forEach(function(row){(row.cells||[]).forEach(function(cell){var medicine=medicines.find(function(item){return String(item.id)===String(cell.medId);});if(medicine)listRows.push('<tr><td><b>'+esc(cell.code)+'</b></td><td>'+esc(medicine.name)+'</td><td>'+esc(storageBatchText(medicine))+'</td></tr>');});});
      return '<div class="r17-unit">'+head+'<div class="tw"><table><thead><tr><th>Cell</th><th>Medicine</th><th>Batch/Lot (optional) &amp; Expiry</th></tr></thead><tbody>'+(listRows.length?listRows.join(''):'<tr><td colspan="3">No medicines assigned to this unit.</td></tr>')+'</tbody></table></div></div>';
    }
    var optionsCache={};function options(selected){var key=String(selected||'');if(!optionsCache[key])optionsCache[key]=storageMedicineOptions(medicines,key);return optionsCache[key];}
    var map=(unit.rows||[]).map(function(row,rowIndex){return '<div class="r17-storage-row" style="grid-template-columns:repeat('+Math.max(1,(row.cells||[]).length)+',minmax(120px,1fr))">'+(row.cells||[]).map(function(cell,cellIndex){var medicine=medicines.find(function(item){return String(item.id)===String(cell.medId);});var stale=cell.medId&&!medicine;return '<div class="r17-cell'+(medicine?' r21-storage-cell-assigned':'')+'"><div class="r17-cell-code">'+esc(cell.code)+'</div><input class="controlled-storage-med-search" list="controlled-storage-medicine-list" data-unit="'+esc(unit.id)+'" data-row="'+rowIndex+'" data-cell="'+cellIndex+'" value="'+(medicine?esc(medicine.name):'')+'" placeholder="Type medicine name / اكتب اسم العلاج" onchange="controlledStorageAssignByName(this)" oninput="controlledStorageValidateSearch(this)">'+(medicine?'<div class="fhint" style="margin-top:5px">'+esc(storageBatchText(medicine))+'</div>':(stale?'<div class="r21-storage-inline-error" style="display:block;margin-top:5px">Medicine is no longer in pharmacy custody. Clear this cell.</div>':''))+'</div>';}).join('')+'</div>';}).join('');
    return '<div class="r17-unit">'+head+map+'</div>';
  }).join('');
};
window.controlledStorageModeChanged=async function(){
  var data=storageState();data.mode=E('controlled-storage-mode').value==='list'?'list':'map';await S.s(CONTROLLED_STORAGE_KEY,data);renderControlledStorage();
};
window.controlledStorageValidateSearch=function(input){
  input.setCustomValidity('');
  var value=String(input.value||'').trim().toLowerCase();if(!value)return;
  var match=controlledMeds().some(function(medicine){return String(medicine.name||'').trim().toLowerCase()===value;});
  if(!match)input.setCustomValidity('Choose a medicine from the shared list / اختر علاجًا من القائمة المشتركة');
};
window.controlledStorageAssignByName=async function(input){
  var value=String(input.value||'').trim();
  var medicine=controlledMeds().find(function(item){return String(item.name||'').trim().toLowerCase()===value.toLowerCase();});
  if(value&&!medicine){input.setCustomValidity('Choose a medicine from the shared list / اختر علاجًا من القائمة المشتركة');input.reportValidity();return false;}
  input.setCustomValidity('');
  return controlledStorageAssign(input.dataset.unit,Number(input.dataset.row),Number(input.dataset.cell),medicine?medicine.id:'');
};
window.controlledStorageAssign=async function(unitId,rowIndex,cellIndex,medId){
  var data=storageState();var unit=data.units.find(function(item){return String(item.id)===String(unitId);});
  if(!unit||!unit.rows[rowIndex]||!unit.rows[rowIndex].cells[cellIndex])return;
  var valid=controlledMeds().some(function(medicine){return String(medicine.id)===String(medId);});
  if(medId&&!valid)return toast('This medicine is not in current controlled-pharmacy custody.','err');
  var movedFrom='';data.units.forEach(function(candidate){(candidate.rows||[]).forEach(function(row){(row.cells||[]).forEach(function(cell){if(medId&&String(cell.medId)===String(medId)){movedFrom=candidate.name+' '+cell.code;cell.medId='';}});});});
  unit.rows[rowIndex].cells[cellIndex].medId=medId||'';
  try{await S.s(CONTROLLED_STORAGE_KEY,data);renderControlledStorage();if(medId&&movedFrom)toast('Medicine moved from '+movedFrom+' ✓','info');}
  catch(error){console.error(error);toast('Cell assignment was not saved.','err');renderControlledStorage();}
};
window.controlledStorageDeleteUnit=async function(unitId){
  var data=storageState();var unit=data.units.find(function(item){return String(item.id)===String(unitId);});if(!unit)return;
  if(!await uiConfirm('Delete "'+unit.name+'"?\n\nAssigned medicines will return to the unassigned filter.'))return;
  data.units=data.units.filter(function(item){return String(item.id)!==String(unitId);});
  try{await S.s(CONTROLLED_STORAGE_KEY,data);if(String(CONTROLLED_STORAGE_UI.editingUnitId)===String(unitId))resetStorageBuilder();renderControlledStorage();toast('Storage unit deleted ✓','info');}
  catch(error){console.error(error);toast('Storage unit deletion was not saved.','err');}
};
function near30(batches){
  var today=new Date();today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  return (batches||[]).some(function(batch){if(!batch.expiry)return false;var date=new Date(String(batch.expiry).slice(0,10)+'T00:00:00'),days=Math.round((date-today)/86400000);return days>=0&&days<=30;});
}
async function publishStorage(unit,medicines){
  if(!window.FB_DB)return false;
  var rows=[];
  (unit.rows||[]).forEach(function(row){
    (row.cells||[]).forEach(function(cell){
      var medicine=medicines.find(function(item){
        return String(item.id)===String(cell.medId);
      });
      if(medicine)rows.push({
        cell:cell.code,
        name:medicine.name,
        batches:(medicine.batches||[]).map(function(batch){return {expiry:batch.expiry||batch.date||'',qty:batch.qty==null?'':batch.qty}})
      });
    });
  });
  var updatedAt=window.firebase&&firebase.firestore&&firebase.firestore.FieldValue
    ?firebase.firestore.FieldValue.serverTimestamp()
    :new Date().toISOString();
  var collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');
  await collection
    .doc('storage_pharmacy_'+unit.id)
    .set({
      scope:'controlled_pharmacy',
      department:'Controlled Pharmacy / صيدلية الأدوية المقيدة',
      unit:unit.name,
      type:unit.type,
      updatedAt:updatedAt,
      rows:rows
    },{merge:false});
  return true;
}
window.controlledStoragePrint=async function(id,mode){
  var data=storageState();
  var unit=data.units.find(function(item){
    return String(item.id)===String(id);
  });
  var medicines=controlledMeds();
  mode=mode==='map'?'map':'list';

  if(!unit){
    toast('Storage unit was not found. Refresh and try again.','err');
    return false;
  }

  var popup=window.open(
    'about:blank',
    'controlled_storage_'+String(id)+'_'+mode,
    'width=1180,height=820'
  );
  if(!popup){
    toast('Allow pop-ups to print the controlled storage list or map.','err');
    return false;
  }

  try{
    var base=new URL(location.href);
    base.search='';
    base.hash='';
    base.searchParams.set('view','controlled-storage-public');
    base.searchParams.set('scope','pharmacy');
    base.searchParams.set('unit',id);
    var tenant=window.fsTenantId&&fsTenantId();if(tenant)base.searchParams.set('tenant',tenant);
    var publicUrl=base.toString();
    var qr=window.makeReadableQR(publicUrl);
    var qrPrintRuntime=window.ASD_QR&&ASD_QR.printRuntimeScript?ASD_QR.printRuntimeScript():'';
    var date=new Date().toLocaleDateString('en-GB');
    var content='';

    function assignedMedicine(cell){
      return medicines.find(function(item){
        return String(item.id)===String(cell.medId);
      });
    }
    function batchLines(medicine){
      var batches=(medicine&&medicine.batches)||[];
      if(!batches.length)return '—';
      return batches.map(function(batch,index){
        return '<div class="batch-line">'+
          esc(batch.lot||batch.batch||('Batch '+(index+1)))+
          '</div>';
      }).join('');
    }
    function expiryLines(medicine){
      var batches=(medicine&&medicine.batches)||[];
      if(!batches.length)return '—';
      return batches.map(function(batch){
        return '<div class="expiry-line">'+
          esc(batch.expiry||batch.date||'—')+
          '</div>';
      }).join('');
    }

    if(mode==='list'){
      var listRows=[];
      (unit.rows||[]).forEach(function(row){
        (row.cells||[]).forEach(function(cell){
          var medicine=assignedMedicine(cell);
          if(!medicine)return;
          listRows.push(
            '<tr class="'+(near30(medicine.batches)?'near':'')+'">'+
            '<td class="code-col">'+esc(medicine.moh||'—')+'</td>'+
            '<td class="code-col">'+esc(medicine.nupco||'—')+'</td>'+
            '<td class="medicine-col">'+esc(medicine.name)+'</td>'+
            '<td class="expiry-col">'+expiryLines(medicine)+'</td>'+
            '</tr>'
          );
        });
      });
      content=
        '<table class="storage-list">'+
        '<thead><tr>'+
        '<th>MOH</th>'+
        '<th>NUPCO</th>'+
        '<th>Medicine / العلاج</th>'+
        '<th>Expiry date / تاريخ الانتهاء</th>'+
        '</tr></thead>'+
        '<tbody>'+
        (listRows.length
          ?listRows.join('')
          :'<tr><td colspan="4" class="empty">No medicines assigned.</td></tr>')+
        '</tbody></table>';
    }else{
      content=
        '<div class="map" style="grid-template-rows:repeat('+Math.max(1,(unit.rows||[]).length)+',minmax(0,1fr))">'+
        (unit.rows||[]).map(function(row){
          return '<div class="prow" style="grid-template-columns:repeat('+
            Math.max(1,(row.cells||[]).length)+',1fr)">'+
            (row.cells||[]).map(function(cell){
              var medicine=assignedMedicine(cell);
              return '<div class="pcell '+
                (medicine&&near30(medicine.batches)?'near':'')+'">'+
                '<b class="map-code">'+esc(cell.code)+'</b>'+
                '<span>'+esc(medicine?medicine.name:'Empty')+'</span>'+
                (medicine
                  ?'<small class="map-codes">MOH: '+
                    esc(medicine.moh||'—')+
                    '<br>NUPCO: '+esc(medicine.nupco||'—')+'</small>'+
                    '<small class="map-expiry">'+
                    expiryLines(medicine)+
                    '</small>'
                  :'')+
                '</div>';
            }).join('')+
            '</div>';
        }).join('')+
        '</div>';
    }

    var printHtml=
      '<!doctype html><html><head><meta charset="utf-8">'+
      '<title>'+esc(unit.name)+' — Controlled storage '+esc(mode)+'</title>'+
      '<style>'+
      '@page{size:A4 portrait;margin:4mm}'+
      'html,body{width:100%;margin:0}'+
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      'body{font-family:Arial,Tahoma,sans-serif;color:#000}'+
      'body.print-map{height:289mm;overflow:hidden;display:flex;flex-direction:column}'+
      'body.print-list{min-height:100%;overflow:visible}'+
      '.head{display:grid;grid-template-columns:1fr 25mm;gap:4mm;align-items:center;border-bottom:2px solid #000;padding-bottom:3px;margin-bottom:3px;flex:0 0 auto}'+
      '.title{text-align:center}.title h2{font-size:16px;margin:0 0 2px}.title div{font-size:9px}'+
      '.qrbox{text-align:center;border:1px solid #000;padding:1px}.qrbox img{display:block;width:22mm;height:22mm;margin:auto}.qrbox b{display:block;font-size:6.5px;margin-top:1px}'+
      '.sync{font-size:6.5px;text-align:center;padding:2px 4px;margin:2px 0;border:1px solid #777;background:#eee;flex:0 0 auto}'+
      '.sync.ok{background:#d9ead3}.sync.warn{background:#f4cccc}'+
      '.legend{font-size:7.5px;margin:3px 0 4px;display:flex;justify-content:space-between;gap:8px;flex:0 0 auto}'+
      '.sw{display:inline-block;width:10px;height:8px;background:#000;margin-right:4px}'+
      'table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}'+
      'thead{display:table-header-group}'+
      'th,td{border:1px solid #000;padding:4px 5px;vertical-align:top;overflow-wrap:anywhere}'+
      'th{background:#444;color:#fff;text-align:center;font-weight:700}'+
      '.code-col{width:17%;text-align:center}.medicine-col{width:39%;font-weight:800;font-size:10px}.expiry-col{width:27%;font-weight:700}'+
      '.expiry-line{padding:2px 0;border-bottom:1px dotted #777}.expiry-line:last-child{border-bottom:0}'+
      '.near td,.pcell.near{background:#000!important;color:#fff!important}'+
      '.empty{text-align:center;padding:20px}'+
      '.map{display:grid;gap:3px;flex:1 1 auto;min-height:0;width:100%}.prow{display:grid;gap:3px;min-height:0}.pcell{border:1.2px solid #000;min-height:0;height:100%;padding:5px;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden}'+
      '.map-code{font-size:11px;line-height:1}.pcell span{font-weight:900;margin-top:5px;font-size:14px;line-height:1.08;overflow-wrap:anywhere}.pcell small{font-size:7.5px;line-height:1.2}.map-codes{margin-top:5px}.map-expiry{margin-top:auto;padding-top:3px}'+
      '.cert{text-align:center;font-size:7px;margin-top:4px;border-top:1px solid #000;padding-top:3px;flex:0 0 auto}'+
      '.public-url{text-align:center;font-size:6px;margin-top:1px;overflow-wrap:anywhere;flex:0 0 auto}'+
      '</style></head><body class="print-'+mode+'">'+
      '<div class="head">'+
      '<div class="title">'+
      '<h2>'+esc(unit.name)+' — Controlled Pharmacy Custody</h2>'+
      '<div>'+(mode==='list'
        ?'Controlled storage list / قائمة عهدة الدواليب والأرفف'
        :'Controlled storage map / خريطة الدواليب والأرفف')+'</div>'+
      '</div>'+
      '<div class="qrbox">'+
      '<img class="asd-qr-image" id="controlled-expiry-qr" src="'+qr+'" alt="Live expiry QR">'+
      '<b>Live expiry / متابعة الصلاحية</b>'+
      '</div></div>'+
      '<div id="controlled-sync-status" class="sync">'+
      'QR expiry data is syncing in the background. Printing is ready. / '+
      'تجري مزامنة بيانات الصلاحية في الخلفية والطباعة جاهزة.'+
      '</div>'+
      '<div class="legend">'+
      '<span><span class="sw"></span> Expiry within 30 days / قريب الانتهاء خلال 30 يومًا</span>'+
      '<span>Print date / تاريخ الطباعة: '+esc(date)+'</span>'+
      '</div>'+
      content+
      '<div class="cert">'+
      'هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم<br>'+
      'This list is electronically approved and certified and does not require a stamp.'+
      '</div>'+
      '<div class="public-url">'+esc(publicUrl)+'</div>'+
      '<script>'+qrPrintRuntime+'<\/script>'+
      '</body></html>';

    popup.document.open();
    popup.document.write(printHtml);
    popup.document.close();

    /*
      Public QR publication is deliberately detached from printing.
      A slow, denied, offline, or permanently pending Firestore write must never
      leave the print window on a preparation screen.
    */
    var syncFinished=false;
    var syncTimer=setTimeout(function(){
      if(syncFinished)return;
      try{
        if(popup.closed)return;
        var node=popup.document.getElementById('controlled-sync-status');
        if(node){
          node.className='sync warn';
          node.textContent=
            'QR expiry sync is taking longer than expected. The printed list is still valid. / '+
            'تأخرت مزامنة رابط الصلاحية، ويمكن طباعة القائمة بشكل طبيعي.';
        }
      }catch(ignore){}
    },8000);

    Promise.resolve()
      .then(function(){
        return publishStorage(unit,medicines);
      })
      .then(function(published){
        syncFinished=true;
        clearTimeout(syncTimer);
        try{
          if(popup.closed)return;
          var node=popup.document.getElementById('controlled-sync-status');
          if(node){
            node.className=published?'sync ok':'sync warn';
            node.textContent=published
              ?'Live expiry QR data synchronized. / تمت مزامنة بيانات QR للصلاحية.'
              :'Printing is ready, but QR expiry data could not be synchronized. / الطباعة جاهزة، وتعذرت مزامنة بيانات QR.';
          }
        }catch(ignore){}
        if(!published&&typeof warnPublicSync==='function'){
          warnPublicSync(
            'Controlled storage QR',
            new Error('Firebase is unavailable.')
          );
        }
      })
      .catch(function(syncError){
        syncFinished=true;
        clearTimeout(syncTimer);
        try{
          if(!popup.closed){
            var node=popup.document.getElementById('controlled-sync-status');
            if(node){
              node.className='sync warn';
              node.textContent=
                'Printing is ready, but QR expiry data could not be synchronized. / '+
                'الطباعة جاهزة، وتعذرت مزامنة بيانات QR.';
            }
          }
        }catch(ignore){}
        if(typeof warnPublicSync==='function'){
          warnPublicSync('Controlled storage QR',syncError);
        }else{
          console.error('Controlled storage QR publication failed',syncError);
        }
      });

    return true;
  }catch(error){
    console.error('Controlled storage print failed',error);
    try{
      popup.document.open();
      popup.document.write(
        '<!doctype html><html><meta charset="utf-8">'+
        '<body style="font-family:Arial,Tahoma,sans-serif;padding:24px">'+
        '<h2>Print preparation failed / تعذر تجهيز الطباعة</h2>'+
        '<p>'+esc(error&&error.message||error)+'</p>'+
        '</body></html>'
      );
      popup.document.close();
    }catch(ignore){}
    toast('Could not prepare the controlled storage print.','err');
    return false;
  }
};
async function publicStorageView(){
  var query=new URLSearchParams(location.search);if(query.get('view')!=='controlled-storage-public')return;
  var auth=E('auth'),app=E('app');if(auth)auth.style.display='none';if(app)app.style.display='none';
  var host=document.createElement('div');host.style.cssText='font-family:Arial;padding:20px;max-width:1100px;margin:auto';host.innerHTML='<h2>Loading controlled-pharmacy storage…</h2>';document.body.appendChild(host);
  try{
    initFirebase();
    var collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');
    var doc=await collection.doc('storage_pharmacy_'+query.get('unit')).get();
    if(!doc.exists)throw new Error('Public controlled-pharmacy storage record not found');
    var data=doc.data(),rows=data.rows||[];
    host.innerHTML=
      '<h1>'+esc(data.unit||'Controlled pharmacy storage')+'</h1>'+
      '<h3>'+esc(data.department||'Controlled Pharmacy')+'</h3>'+
      '<table style="width:100%;border-collapse:collapse">'+
      '<thead><tr>'+
      '<th style="border:1px solid #444;padding:6px">Cell</th>'+
      '<th style="border:1px solid #444;padding:6px">Medicine</th>'+
      '<th style="border:1px solid #444;padding:6px">Expiry date</th>'+
      '<th style="border:1px solid #444;padding:6px">Qty</th>'+
      '</tr></thead><tbody>'+
      rows.map(function(row){
        var batches=row.batches||[];
        var expiries=batches.map(function(batch){return batch.expiry||batch.date||'—'}).join(' | ')||'—';
        var quantities=batches.map(function(batch){return batch.qty==null||batch.qty===''?'—':batch.qty}).join(' | ')||'—';
        return '<tr>'+
          '<td style="border:1px solid #444;padding:6px">'+esc(row.cell)+'</td>'+
          '<td style="border:1px solid #444;padding:6px">'+esc(row.name)+'</td>'+
          '<td style="border:1px solid #444;padding:6px">'+esc(expiries)+'</td>'+
          '<td style="border:1px solid #444;padding:6px">'+esc(quantities)+'</td>'+
          '</tr>';
      }).join('')+
      '</tbody></table>';
  }catch(error){host.innerHTML='<div style="color:#b00">'+esc(error&&error.message||error)+'</div>';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',publicStorageView);else publicStorageView();
})();

/* Receipt method choice: departments may complete the same audited receipt
   manually, while the existing temporary dual-QR workflow remains available. */
function ensureManualReceiptOption(){var checks=document.querySelectorAll('.acc2-receipt-check');if(!checks.length||document.getElementById('acc2-manual-receipt-btn'))return;var host=checks[0].closest('.card');if(!host)return;var b=document.createElement('button');b.id='acc2-manual-receipt-btn';b.type='button';b.className='btn bp bsm';b.textContent='✍ Manual receipt / استلام يدوي';b.onclick=function(){if(typeof acc2CreateReceipt==='function')acc2CreateReceipt()};var row=host.querySelector('.fl')||host.querySelector('.ch');if(row)row.appendChild(b)}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',function(){setInterval(ensureManualReceiptOption,1000)});
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',function(){setInterval(acc2LockOutpatientSelectors,700)});
export {};

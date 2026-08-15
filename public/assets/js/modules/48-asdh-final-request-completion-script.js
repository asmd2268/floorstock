(function(){
'use strict';
var E=window.fsE;
var esc=window.fsEsc;
function num(v){v=Number(v);return isFinite(v)?v:0}
function normalText(v){
  return typeof window.fsMedNorm==='function'
    ?window.fsMedNorm(v)
    :String(v==null?'':v).trim().toLowerCase().replace(/\s+/g,' ');
}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function canEdit(){return typeof canConfigureCrashCart==='function'&&canConfigureCrashCart()}
function actor(){return window.fsActor?window.fsActor():{name:'Unknown',user:'Unknown',id:''}}
function now(){return typeof nowISO==='function'?nowISO():new Date().toISOString()}
function rules(){var x={};try{x=(window.S&&S.g)?(S.g('pharmacy_department_expiry_rules')||{}):{}}catch(e){}var u=Math.max(1,num(x.urgentDays||7)),n=Math.max(u+1,num(x.nearDays||30));return {urgentDays:u,nearDays:n}}
function canonical(nameOrItem,strength){if(typeof window.fsCrashCanonicalMedication==='function')return window.fsCrashCanonicalMedication(nameOrItem,strength);var it=(nameOrItem&&typeof nameOrItem==='object')?nameOrItem:{name:nameOrItem,strength:strength,concentration:strength};return {generic:String(it.name||it.genericName||'').trim(),concentration:String(it.strength||it.concentration||strength||'').trim()}}
function medicationIdentity(itemOrName){return normalText(canonical(itemOrName).generic)}
function cartHasMedication(cart,source){var wanted=medicationIdentity(source);return !!wanted&&(cart.items||[]).some(function(item){return medicationIdentity(item)===wanted})}
function cleanRequestedGeneric(name,strength){var resolved=canonical({name:name,strength:strength,concentration:strength});return resolved.generic||String(name||'').trim()}
function normalizedMedication(name,concentration){var m=canonical(name,concentration);return {name:m.generic,concentration:m.concentration}}
function id(){return 'cci_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)}
function closeEditor(){var m=E('cc-final-editor');if(m)m.remove()}
function batchHtml(b){b=b||{};return '<div class="ccfe-batch"><input class="ccfe-exp" type="date" value="'+esc(b.expiry||'')+'"><input class="ccfe-bqty" type="number" min="0" step="any" value="'+esc(b.qty==null?'':b.qty)+'" placeholder="Qty"><input class="ccfe-lot" value="'+esc(b.lot||'')+'" placeholder="Lot / Batch"><button class="btn bd2c bxs ccfe-remove-batch" type="button">×</button></div>'}
function itemHtml(it){it=it||{};var med=canonical(it),req=Math.max(0,num(it.qty)),av=Math.max(0,num(it.present==null?it.qty:it.present)),status=av<=0?'out':(av<req?'partial':'available');return '<tr class="ccfe-item" data-id="'+esc(it.id||id())+'"><td><input class="ccfe-item-name" value="'+esc(med.generic)+'" placeholder="Generic name / الاسم العلمي"></td><td><input class="ccfe-item-conc" value="'+esc(med.concentration)+'" placeholder="Strength"></td><td><input class="ccfe-item-required" type="number" min="0" step="any" value="'+req+'"></td><td><input class="ccfe-item-available" type="number" min="0" step="any" value="'+av+'"></td><td><select class="ccfe-item-status"><option value="available" '+(status==='available'?'selected':'')+'>Available / متوفر</option><option value="partial" '+(status==='partial'?'selected':'')+'>Partially available / متوفر جزئياً</option><option value="out" '+(status==='out'?'selected':'')+'>Out of Stock / غير متوفر</option></select></td><td><div class="ccfe-batch-list">'+((it.batches||[]).map(batchHtml).join(''))+'</div><button class="btn bg bxs ccfe-add-batch" type="button">+ Add expiry / إضافة انتهاء</button></td><td><button class="btn bd2c bxs ccfe-delete-item" type="button">Delete</button></td></tr>'}
function ensureEditor(cart,addBlank){closeEditor();var html='<div class="modal-bg on" id="cc-final-editor" role="dialog" aria-modal="true"><div class="modal"><div class="ccfe-head"><div><div class="mt">Manage Crash Cart contents / تعديل محتويات العربة</div><div class="fhint">'+esc(cart.name||'Crash Cart')+'</div></div><button class="xbtn" id="ccfe-close" type="button">×</button></div><div class="ccfe-body"><div class="ccfe-help"><b>Authorized roles:</b> Pharmacy Director and Inpatient Pharmacy Supervisor only. Every available quantity must be allocated to expiry dates. Lot/Batch is always optional. Available quantity cannot exceed required quantity.</div><input id="ccfe-cart-id" type="hidden" value="'+esc(cart.id)+'"><div class="tw"><table class="ccfe-table"><thead><tr><th class="ccfe-name">Medication</th><th class="ccfe-conc">Strength</th><th class="ccfe-required">Required</th><th class="ccfe-available">Available</th><th class="ccfe-status">Status</th><th class="ccfe-batches">Expiry date → Qty → Lot</th><th class="ccfe-delete"></th></tr></thead><tbody id="ccfe-rows">'+((cart.items||[]).map(itemHtml).join(''))+(addBlank?itemHtml({id:id(),qty:1,present:1,batches:[]}):'')+'</tbody></table></div><button class="btn bg bsm" id="ccfe-add-item" type="button" style="margin-top:10px">+ Add medication / إضافة علاج</button></div><div class="ccfe-footer"><div id="ccfe-error" class="ccfe-error"></div><div class="fl g8"><button class="btn bg" id="ccfe-cancel" type="button">Cancel</button><button class="btn bs" id="ccfe-save" type="button">Save contents / حفظ المحتويات</button></div></div></div></div>';document.body.insertAdjacentHTML('beforeend',html);var m=E('cc-final-editor');E('ccfe-close').onclick=closeEditor;E('ccfe-cancel').onclick=closeEditor;E('ccfe-save').onclick=saveEditor;E('ccfe-add-item').onclick=function(){E('ccfe-rows').insertAdjacentHTML('beforeend',itemHtml({id:id(),qty:1,present:1,batches:[]}))};m.onclick=function(ev){if(ev.target===m)closeEditor();var add=ev.target.closest&&ev.target.closest('.ccfe-add-batch');if(add){add.parentElement.querySelector('.ccfe-batch-list').insertAdjacentHTML('beforeend',batchHtml({}));return}var rem=ev.target.closest&&ev.target.closest('.ccfe-remove-batch');if(rem){rem.closest('.ccfe-batch').remove();return}var del=ev.target.closest&&ev.target.closest('.ccfe-delete-item');if(del){del.closest('.ccfe-item').remove();return}};m.onchange=function(ev){var row=ev.target.closest&&ev.target.closest('.ccfe-item');if(!row)return;var st=row.querySelector('.ccfe-item-status'),req=row.querySelector('.ccfe-item-required'),av=row.querySelector('.ccfe-item-available');if(ev.target===st){if(st.value==='out')av.value='0';else if(st.value==='available')av.value=String(Math.max(0,num(req.value)))}};var firstName=E('ccfe-rows').querySelector('.ccfe-item-name');if(firstName)firstName.focus()}
function openEditor(cartId,addBlank){if(!canEdit()){if(typeof toast==='function')toast('Only the Pharmacy Director or Inpatient Pharmacy Supervisor can edit Crash Cart contents.','err');return false}var c=typeof crashCart==='function'?crashCart(cartId):null;if(!c)return false;ensureEditor(c,!!addBlank);return true}
async function saveEditor(){if(!canEdit())return;var cartId=(E('ccfe-cart-id')||{}).value,carts=typeof crashCarts==='function'?(crashCarts()||[]):[],cart=carts.find(function(c){return String(c.id)===String(cartId)}),err=E('ccfe-error'),save=E('ccfe-save');if(!cart)return;function fail(m){if(err)err.textContent=m;if(typeof toast==='function')toast(m,'err');return false}var items=[],names={};var rows=Array.from(E('ccfe-rows').querySelectorAll('.ccfe-item'));for(var i=0;i<rows.length;i++){var row=rows[i],rawName=row.querySelector('.ccfe-item-name').value,rawConc=row.querySelector('.ccfe-item-conc').value,med=normalizedMedication(rawName,rawConc),required=num(row.querySelector('.ccfe-item-required').value),available=num(row.querySelector('.ccfe-item-available').value),status=row.querySelector('.ccfe-item-status').value;if(!med.name)return fail('Medication name is required in row '+(i+1)+'.');var nk=(med.name+'|'+med.concentration).toLowerCase();if(names[nk])return fail('Duplicate medication in row '+(i+1)+'.');names[nk]=1;if(required<0||available<0)return fail('Quantities cannot be negative in row '+(i+1)+'.');if(status==='out')available=0;else if(status==='available')available=required;else if(!(available>0&&available<required))return fail('Partially available quantity must be above 0 and below required in row '+(i+1)+'.');if(available>required)return fail('Available quantity cannot exceed required quantity in row '+(i+1)+'.');var batches=[];Array.from(row.querySelectorAll('.ccfe-batch')).forEach(function(b){var expiry=b.querySelector('.ccfe-exp').value,qty=num(b.querySelector('.ccfe-bqty').value),lot=b.querySelector('.ccfe-lot').value.trim();if(expiry||qty||lot)batches.push({expiry:expiry,qty:qty,lot:lot})});if(available===0)batches=[];else{if(!batches.length)return fail('At least one expiry date is required for every available medication in row '+(i+1)+'.');for(var j=0;j<batches.length;j++){if(!batches[j].expiry||!(batches[j].qty>0))return fail('Every expiry row requires a date and quantity greater than zero in medication row '+(i+1)+'.')}var total=batches.reduce(function(s,b){return s+num(b.qty)},0);if(Math.abs(total-available)>0.000001)return fail('Expiry quantities ('+total+') must equal available quantity ('+available+') in row '+(i+1)+'.')}items.push({id:row.dataset.id||id(),name:med.name,genericName:med.name,strength:med.concentration,concentration:med.concentration,qty:required,present:available,batches:batches,stockStatus:available<=0?'out_of_stock':(available<required?'partial':'available'),stockUpdatedAt:now(),stockUpdatedBy:actor().name})}if(save){save.disabled=true;save.textContent='Saving... / جاري الحفظ'}try{cart.items=items;cart.updatedAt=now();cart.updatedBy=actor().name;cart.updatedByUser=actor().user;await setCrashCarts(carts);if(typeof auditAction==='function')auditAction('crash_cart_contents_update',{cartId:cart.id,itemCount:items.length,updatedBy:actor().user,authorizedRole:role()});closeEditor();if(typeof renderCrashCarts==='function')renderCrashCarts();if(typeof toast==='function')toast('Crash Cart contents saved ✓','succ')}catch(ex){fail(String((ex&&ex.message)||ex))}finally{if(save&&document.body.contains(save)){save.disabled=false;save.textContent='Save contents / حفظ المحتويات'}}}
window.crashAddItem=function(id){return openEditor(id,true)};
function closeBulkMedicationModal(){var m=E('cc-bulk-med-modal');if(m)m.remove()}
function cartMedicationNames(cart){return (cart.items||[]).map(function(it){return canonical(it).generic}).filter(Boolean)}
window.openCrashBulkMedicationModal=function(){
 if(!canEdit()){if(typeof toast==='function')toast('Only authorized pharmacy roles can update Crash Cart medication names.','err');return false}
 closeBulkMedicationModal();
 var carts=typeof crashCarts==='function'?(crashCarts()||[]):[];
 var names={};carts.forEach(function(c){cartMedicationNames(c).forEach(function(n){names[n]=1})});
 var options=Object.keys(names).sort().map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('');
 var cartRows=carts.map(function(c){return '<label class="ccbm-cart"><input type="checkbox" class="ccbm-cart-check" value="'+esc(c.id)+'"><span><b>'+esc(c.name||'Crash Cart')+'</b><br><small>'+esc(deptName(c.deptId))+'</small><small class="ccbm-availability" style="display:block"></small></span></label>'}).join('');
 var html='<div class="modal-bg on" id="cc-bulk-med-modal"><div class="modal"><div class="mh"><div class="mt">Apply medication identity to selected Crash Carts / تطبيق اسم علاج على عربات محددة</div><button class="xbtn" id="ccbm-x" type="button">×</button></div><div class="ccfe-help">This changes only the Generic Name and Strength for the matching medication. Quantities, expiry dates, lots, IDs and history remain unchanged.</div><label>Medication to replace / العلاج المراد استبدال اسمه</label><select id="ccbm-source"><option value="">Select medication...</option>'+options+'</select><div class="ccbm-grid"><div><label>Generic Name / الاسم العلمي</label><input id="ccbm-generic" placeholder="Example: Calcium Chloride 10%"></div><div><label>Strength / التركيز</label><input id="ccbm-strength" placeholder="Example: 1g/10ml"></div></div><div class="fl jb ic" style="margin:4px 0 8px"><b>Select Crash Carts / اختر العربات</b><button class="btn bg bxs" id="ccbm-all" type="button">Select all</button></div><div class="ccbm-carts">'+cartRows+'</div><div class="ccbm-error" id="ccbm-error"></div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" id="ccbm-cancel" type="button">Cancel</button><button class="btn bs" id="ccbm-save" type="button">Apply to selected carts</button></div></div></div>';
 document.body.insertAdjacentHTML('beforeend',html);
 E('ccbm-x').onclick=closeBulkMedicationModal;E('ccbm-cancel').onclick=closeBulkMedicationModal;
 function refreshCartEligibility(showMessage){
   var source=String((E('ccbm-source')||{}).value||''),missing=[];
   Array.from(document.querySelectorAll('.ccbm-cart-check')).forEach(function(input){
     var cart=carts.find(function(row){return String(row.id)===String(input.value)}),available=!!(source&&cart&&cartHasMedication(cart,source)),note=input.closest('label').querySelector('.ccbm-availability');
     input.disabled=!available;
     if(!available){input.checked=false;if(source&&cart)missing.push(cart.name||cart.id)}
     if(note){note.textContent=!source?'Choose a medication first':(available?'Available / العلاج موجود':'Not present — selection removed / العلاج غير موجود وتم إلغاء التحديد');note.style.color=available?'var(--gnl)':'var(--rdl)'}
   });
   if(showMessage&&missing.length){var message='Medication is not present in: '+missing.join(', ')+'. Selection was removed from those carts. / العلاج غير موجود في العربات المذكورة وتم إلغاء تحديدها.';var box=E('ccbm-error');if(box)box.textContent=message;if(typeof toast==='function')toast(message,'info')}
 }
 E('ccbm-all').onclick=function(){var xs=Array.from(document.querySelectorAll('.ccbm-cart-check:not(:disabled)')),all=xs.length&&xs.every(function(x){return x.checked});xs.forEach(function(x){x.checked=!all})};
 E('ccbm-source').onchange=function(){var source=this.value;if(!source){refreshCartEligibility(false);return}var found=null;carts.some(function(c){return (c.items||[]).some(function(it){var m=canonical(it);if(medicationIdentity(m.generic)===medicationIdentity(source)){found=m;return true}return false})});if(found){E('ccbm-generic').value=found.generic;E('ccbm-strength').value=found.concentration||''}refreshCartEligibility(true)};
 refreshCartEligibility(false);
 E('ccbm-save').onclick=saveCrashBulkMedication;
 return true
};
async function saveCrashBulkMedication(){
 var source=String((E('ccbm-source')||{}).value||'').trim(),generic=String((E('ccbm-generic')||{}).value||'').trim(),strength=String((E('ccbm-strength')||{}).value||'').trim(),ids=Array.from(document.querySelectorAll('.ccbm-cart-check:checked')).map(function(x){return String(x.value)}),err=E('ccbm-error'),btn=E('ccbm-save');
 function fail(m){if(err)err.textContent=m;if(typeof toast==='function')toast(m,'err');return false}
 if(!source)return fail('Select the medication to replace.');if(!generic)return fail('Generic Name is required.');if(!strength)return fail('Strength is required.');if(!ids.length)return fail('Select at least one Crash Cart.');
 var carts=typeof crashCarts==='function'?(crashCarts()||[]):[],changedItems=0,changedCarts=0,missing=[],sourceIdentity=medicationIdentity(source);
 ids=ids.filter(function(cartId){var cart=carts.find(function(row){return String(row.id)===String(cartId)});if(cart&&cartHasMedication(cart,source))return true;if(cart)missing.push(cart.name||cart.id);var checkbox=document.querySelector('.ccbm-cart-check[value="'+String(cartId).replace(/["\\]/g,'\\$&')+'"]');if(checkbox)checkbox.checked=false;return false});
 if(missing.length){var missingMessage='Medication is not present in: '+missing.join(', ')+'. Selection was removed from those carts. / العلاج غير موجود في هذه العربات وتم إلغاء تحديدها.';if(err)err.textContent=missingMessage;if(typeof toast==='function')toast(missingMessage,'info')}
 if(!ids.length)return fail('The medication is not present in any selected Crash Cart. / العلاج غير موجود في أي عربة محددة.');
 generic=cleanRequestedGeneric(generic,strength);
 var next=carts.map(function(c){if(ids.indexOf(String(c.id))<0)return c;var local=0,items=(c.items||[]).map(function(it){if(medicationIdentity(it)!==sourceIdentity)return it;local++;changedItems++;return Object.assign({},it,{name:generic,genericName:generic,strength:strength,concentration:strength,identityLocked:true,updatedAt:now(),updatedBy:actor().name})});if(local){changedCarts++;return Object.assign({},c,{items:items,updatedAt:now(),updatedBy:actor().name,updatedByUser:actor().user})}return c});
 if(!changedItems)return fail('The selected medication was not found in the selected carts.');
 if(btn){btn.disabled=true;btn.textContent='Applying...'}
 try{await setCrashCarts(next);if(typeof auditAction==='function')auditAction('crash_cart_bulk_medication_identity_update',{source:source,genericName:generic,strength:strength,cartIds:ids,changedCarts:changedCarts,changedItems:changedItems});closeBulkMedicationModal();if(typeof renderCrashCarts==='function')renderCrashCarts();if(typeof toast==='function')toast('Updated '+changedItems+' medication record(s) in '+changedCarts+' Crash Cart(s) ✓','succ')}catch(ex){fail(String((ex&&ex.message)||ex))}finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='Apply to selected carts'}}
}
function enhanceButtons(){var pg=E('pg-crashcart');if(!pg)return;var head=pg.querySelector('.fl.ic.jb.mb14');if(canEdit()&&head&&!E('cc-bulk-medication-btn')){var bb=document.createElement('button');bb.id='cc-bulk-medication-btn';bb.type='button';bb.className='btn bp';bb.textContent='↔ Apply medication to selected carts';bb.onclick=window.openCrashBulkMedicationModal;var actions=head.querySelector('.fl.g8.ic')||head;actions.appendChild(bb)}document.querySelectorAll('#pg-crashcart .ccx-cart').forEach(function(card){var cartId=String(card.id||'').replace(/^ccx-cart-/,'');if(!cartId)return;var bar=card.querySelector('.ccx-toolbar-actions')||card.querySelector('.ch .fl')||card.querySelector('.ch');if(!bar)return;/* Legacy decorators used to append a second report action. Keep the canonical action rendered by module 44 and remove every duplicate. */Array.prototype.slice.call(card.querySelectorAll('button[onclick*="crashReportOpen"]')).slice(1).forEach(function(button){button.remove()});var old=card.querySelector('.cc-final-manage-btn');if(!canEdit()){if(old)old.remove();return}if(!old){var b=document.createElement('button');b.type='button';b.className='btn bg bsm cc-final-manage-btn';b.textContent='✎ Manage contents / تعديل المحتويات';b.onclick=function(){openEditor(cartId,false)};bar.appendChild(b)}})}
window.enhanceCrashButtons=enhanceButtons;


/* Keep the public no-login snapshot aligned with printing, including Expiry Track rules. */
async function publishPublic(carts){if(!window.FB_DB||!Array.isArray(carts))return;var r=rules(),depts=typeof gd==='function'?(gd()||[]):[],collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');await Promise.all(carts.map(function(c){var d=depts.find(function(x){return String(x.id)===String(c.deptId)})||{},items=(c.items||[]).map(function(it){var med=normalizedMedication(it.name,it.concentration||it.strength),required=num(it.qty),available=num(it.present==null?it.qty:it.present);return {name:med.name,concentration:med.concentration,strength:med.concentration,required:required,available:available,status:available<=0?'Out of stock':(available<required?'Less than required':'Available'),batches:(it.batches||[]).map(function(b){return {expiry:b.expiry||'',qty:b.qty==null?'':num(b.qty)}})}});return collection.doc('crash_'+String(c.id)).set({cartId:c.id,name:c.name||'',department:d.name||c.deptId||'',lastClosedAt:c.lastClosedAt||null,expiryRules:r,expiryTrackRules:{urgent:'0–'+r.urgentDays+' days',near:(r.urgentDays+1)+'–'+r.nearDays+' days',expired:'Before today'},updatedAt:firebase.firestore.FieldValue.serverTimestamp(),items:items},{merge:false})}))}
function reconcileCrashCartData(carts){
 var changed=false;
 var output=(Array.isArray(carts)?carts:[]).map(function(cart){
   var groups={},order=[];
   (cart.items||[]).forEach(function(original){
     var med=canonical(original),key=normalText(med.generic)+'|'+normalText(med.concentration),it=Object.assign({},original,{name:med.generic,genericName:med.generic,strength:med.concentration,concentration:med.concentration});
     if(it.name!==original.name||it.strength!==original.strength||it.concentration!==original.concentration||it.genericName!==original.genericName)changed=true;
     it.batches=(original.batches||[]).filter(function(b){return b&&(b.expiry||Number(b.qty)>0||b.lot)}).map(function(b){return {expiry:b.expiry||'',qty:num(b.qty),lot:b.lot||''}});
     if(!groups[key]){groups[key]=it;order.push(key);return}
     changed=true;var target=groups[key],batchMap={};
     (target.batches||[]).concat(it.batches||[]).forEach(function(b){var bk=String(b.expiry||'')+'|'+String(b.lot||'');if(!batchMap[bk]||num(b.qty)>num(batchMap[bk].qty))batchMap[bk]=b});
     target.batches=Object.keys(batchMap).map(function(k){return batchMap[k]});
     target.qty=Math.max(num(target.qty),num(it.qty));
     target.present=Math.max(num(target.present==null?target.qty:target.present),num(it.present==null?it.qty:it.present),target.batches.reduce(function(sum,b){return sum+num(b.qty)},0));
     if((it.batches||[]).length>(target.batches||[]).length&&it.id)target.id=it.id;
   });
   var items=order.map(function(k){return groups[k]});
   if(items.length!==(cart.items||[]).length)changed=true;
   return Object.assign({},cart,{items:items});
 });
 return {carts:output,changed:changed};
}
window.setCrashCarts=async function(v){var repaired=reconcileCrashCartData(v),out=await S.s('crash_carts',repaired.carts);try{await publishPublic(repaired.carts)}catch(e){warnPublicSync('Crash Cart data',e)}return out};
window.fsReconcileCrashCartData=async function(){var current=typeof crashCarts==='function'?(crashCarts()||[]):[],fixed=reconcileCrashCartData(current);if(fixed.changed){await window.setCrashCarts(fixed.carts);if(typeof renderCrashCarts==='function')renderCrashCarts()}return fixed};

function daysUntil(v){return window.fsDaysUntil?window.fsDaysUntil(v):null}
function expClass(exp){var d=daysUntil(exp),r=rules();if(d===null)return'missing';if(d<0)return'expired';if(d<=r.urgentDays)return'urgent';if(d<=r.nearDays)return'near';return'normal'}
function fmtDateFinal(v){try{return typeof fmtDate==='function'?fmtDate(v):String(v||'—')}catch(e){return String(v||'—')}}
function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
window.crashPrint=function(id){
  var c=typeof crashCart==='function'?crashCart(id):null;
  if(!c){if(typeof toast==='function')toast('Crash Cart not found.','err');return false}
  var w=window.open('','_blank');
  if(!w){if(typeof toast==='function')toast('Allow pop-ups to print.','err');return false}
  function e(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function q(v){var x=Number(v);return isFinite(x)?x:0}
  function near30(item){return (item.batches||[]).some(function(batch){var days=daysUntil(batch&&batch.expiry);return days!==null&&days>=0&&days<=30})}
  function status(item){var required=q(item.qty),available=q(item.present==null?item.qty:item.present);return available<=0?'Out of stock':(available<required?'Less than required':'Available')}
  var reports=typeof crashReports==='function'?(crashReports()||[]):[],closed=reports.filter(function(r){return String(r.cartId)===String(c.id)&&r.status==='closed'}).sort(function(a,b){return String(b.closedAt||b.lastEditedAt||b.openedAt||'').localeCompare(String(a.closedAt||a.lastEditedAt||a.openedAt||''))})[0]||{};
  var actorInfo=typeof window.fsActor==='function'?window.fsActor():{},printUser=actorInfo.name||actorInfo.user||(window.CU&&(CU.username||CU.email))||'Unknown user';
  var publicUrl=new URL(typeof getAppUrl==='function'?getAppUrl():location.href);publicUrl.searchParams.set('view','crash-cart-public');publicUrl.searchParams.set('id',String(c.id));var tenant=window.fsTenantId&&fsTenantId();if(tenant)publicUrl.searchParams.set('tenant',tenant);
  var qr=window.makeReadableQR(publicUrl.toString());
  var qrPrintRuntime=window.ASD_QR&&ASD_QR.printRuntimeScript?ASD_QR.printRuntimeScript():'';
  var official=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var nowDate=new Date(),printDate=String(nowDate.getDate()).padStart(2,'0')+'/'+String(nowDate.getMonth()+1).padStart(2,'0')+'/'+nowDate.getFullYear();
  var rows=(c.items||[]).map(function(it,i){
    var m=canonical(it),b=(it.batches||[]).filter(function(x){return x&&x.expiry}).map(function(x){return '<div>'+e(fmtDateFinal(x.expiry))+' → '+e(x.qty==null?'—':x.qty)+'</div>'}).join('')||'No expiry';
    return '<tr class="'+(near30(it)?'near-30':'')+' '+(q(it.present==null?it.qty:it.present)<=0?'out-row':'')+'"><td class="number">'+(i+1)+'</td><td class="medicine"><b>'+e(m.generic)+'</b></td><td>'+e(m.concentration||'—')+'</td><td>'+q(it.qty)+'</td><td>'+q(it.present==null?it.qty:it.present)+'</td><td>'+e(status(it))+'</td><td class="expiry">'+b+'</td></tr>';
  }).join('');
  if(!rows)rows='<tr><td colspan="7" style="text-align:center;padding:20px">No Crash Cart medications found.</td></tr>';
  var dn=deptName(c.deptId);
  var h='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(c.name||'Crash Cart')+'</title><style>'+
  '@page{size:A4 portrait;margin:7mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{background:#fff!important;color:#111!important;margin:0}body{font-family:Arial,Tahoma,sans-serif}.page{width:100%}.official-print-header{margin-bottom:4mm!important}.title-grid{display:grid;grid-template-columns:1fr 27mm;gap:4mm;align-items:center;border-bottom:2px solid #222;padding:1mm 0 3mm}.titles{text-align:center}.titles h1{font-size:18pt;margin:0 0 1mm}.titles h2{font-size:11pt;margin:0;text-transform:uppercase}.qr{text-align:center}.qr img{width:24mm;height:24mm;border:1px solid #111;padding:1mm}.qr small{display:block;font-size:5.5pt}.meta{width:100%;border-collapse:collapse;margin-top:2mm;font-size:7.5pt}.meta td{border:1px solid #555;padding:1.2mm 2mm}.track{display:flex;justify-content:space-between;gap:3mm;border:1px solid #555;border-top:0;padding:1.2mm 2mm;font-size:7pt}.legend{font-size:6.5pt;border:1px solid #555;border-top:0;padding:1mm 2mm}.swatch{display:inline-block;width:5mm;height:3mm;background:#000;vertical-align:middle;margin-right:1.5mm}table.list{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5pt}table.list th,table.list td{border:1px solid #444;padding:1.25mm;vertical-align:middle;overflow-wrap:anywhere}table.list th{background:#e8e8e8;text-align:left;font-weight:800}table.list .number{width:2.5%;text-align:center;padding-left:.5mm;padding-right:.5mm}table.list .medicine{font-weight:800}.expiry{background:#d9ead3}.near-30 td,.near-30 td *{background:#000!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.out-row:not(.near-30) td{background:#f4cccc!important}.footer{text-align:center;font-size:5.5pt;margin-top:1.3mm;color:#333}.byline{text-align:center;font-size:5pt;margin-top:.6mm}.toolbar{text-align:center;margin:10px}.toolbar button{font:600 14px Arial;padding:9px 18px}@media print{.toolbar{display:none}}'+
  '</style></head><body><div class="toolbar"><button type="button" data-qr-print-button disabled>Print / طباعة</button></div><div class="page">'+official+
  '<div class="title-grid"><div class="titles"><h1>'+e(c.name||'Crash Cart')+'</h1><h2>'+e(dn)+'</h2></div><div class="qr"><img class="asd-qr-image" id="crash-live-qr" src="'+e(qr)+'" alt="Live Crash Cart QR"><small>Live check — no login</small></div></div>'+
  '<table class="meta"><tr><td><b>Cart:</b> '+e(c.number||c.name||'—')+'</td><td><b>Seal number:</b> '+e(c.seal||closed.newSeal||'—')+'</td><td><b>Location:</b> '+e(c.location||dn||'—')+'</td></tr><tr><td><b>Last closure:</b> '+e(fmtDateFinal(closed.closedAt||c.lastClosedAt||'—'))+'</td><td><b>Closed by:</b> '+e(closed.closedByName||c.lastClosedByName||'—')+'</td><td><b>System user:</b> '+e(closed.closedByUser||c.lastClosedByUser||'—')+'</td></tr></table>'+
  '<div class="track"><span><b>Expiry Track:</b> Expired before today · Urgent 0–7 days · Near expiry 8–30 days</span><span><b>Print date / تاريخ الطباعة:</b> '+e(printDate)+'</span></div>'+
  '<div class="legend"><span class="swatch"></span> Expiry within 30 days / قريب الانتهاء خلال 30 يومًا</div>'+
  '<table class="list"><colgroup><col style="width:2.5%"><col style="width:31.5%"><col style="width:13%"><col style="width:9%"><col style="width:9%"><col style="width:14%"><col style="width:21%"></colgroup><thead><tr><th>#</th><th>Generic name</th><th>Concentration</th><th>Standard quantity</th><th>Available</th><th>Stock status</th><th>Expiry date → Quantity</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  '<div class="footer">Printed by: '+e(printUser)+' · '+e(actorInfo.user||window.CU&&CU.email||printUser)+'</div><div class="byline">By Ali Abudahash</div></div>'+
  '<script>'+qrPrintRuntime+'<\/script></body></html>';
  try{w.document.open();w.document.write(h);w.document.close()}catch(err){console.error(err);w.close();if(typeof toast==='function')toast('Print preview could not be created.','err');return false}
  try{Promise.resolve(publishPublic([c])).catch(function(err){console.warn('Crash Cart public sync deferred',err)})}catch(err){}
  return true
};


})();


// --- Merged from 47-asdh-authoritative-final-fixes-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
var PREVIEW_KEY='asdh_master_role_preview_v3';
const E=globalThis.E;
function previewRead(){try{return JSON.parse(sessionStorage.getItem(PREVIEW_KEY)||'null')}catch(e){return null}}
function previewWrite(v){try{sessionStorage.setItem(PREVIEW_KEY,JSON.stringify(v));return true}catch(e){console.error(e);return false}}
function previewClear(){try{sessionStorage.removeItem(PREVIEW_KEY)}catch(e){}}
function deptZ(id){try{return ((typeof gd==='function'?gd():[])||[]).find(function(d){return String(d.id)===String(id)})||null}catch(e){return null}}
function toastZ(m,t){if(typeof toast==='function')toast(m,t||'info')}
var departmentLinksRepairBusyZ=false,departmentLinksRepairedZ=false;
async function repairDepartmentLinksZ(){
  if(departmentLinksRepairBusyZ||departmentLinksRepairedZ||!window.S||typeof S.g!=='function')return false;
  var deps=S.g('departments')||[];if(!Array.isArray(deps)||!deps.length)return false;
  var norm=function(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]/g,'')},byName={};
  deps.forEach(function(d){[d&&d.id,d&&d.name,d&&d.departmentName,d&&d.code,d&&d.shortName].forEach(function(k){if(k)byName[norm(k)]=String(d.id)})});
  departmentLinksRepairBusyZ=true;
  try{
    var carts=(S.g('crash_carts')||[]).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),cartChanged=false;
    carts.forEach(function(x){if(!x||x.departmentId||x.deptId)return;var id=byName[norm(x.departmentName||x.department||x.dept||x.deptName)];if(id){x.departmentId=id;x.deptId=id;cartChanged=true}});
    var requests=(S.g('requests')||[]).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),requestChanged=false;
    requests.forEach(function(x){if(!x||x.departmentId||x.deptId)return;var id=byName[norm(x.departmentName||x.department||x.dept||x.deptName)];if(id){x.departmentId=id;x.deptId=id;requestChanged=true}});
    var jobs=[];
    /* Department sessions are read-only for cart stock. They may submit a
       report, but must never run a background migration against crash_carts. */
    var canWriteCart=typeof window.fsCanWriteStateKey!=='function'||window.fsCanWriteStateKey('crash_carts');
    if(cartChanged&&canWriteCart&&typeof setCrashCarts==='function')jobs.push(setCrashCarts(carts));
    if(requestChanged)jobs.push(S.s('requests',requests));
    if(jobs.length)await Promise.all(jobs);
    departmentLinksRepairedZ=true;
    if(jobs.length&&typeof refreshCurrentPage==='function')refreshCurrentPage();
    return jobs.length>0;
  }catch(e){console.error('Department link repair failed',e);return false}
  finally{departmentLinksRepairBusyZ=false}
}

/* A full reload is the authoritative role transition. It clears every stale page, modal,
   body class and delayed render callback left by Department preview mode. */
var previewStartSavedZ=null;
window.preparePreviewStart=function(){
  var saved=previewStartSavedZ=previewRead();
  var validPreviewRoles=['department','pharmacy','pharmacy_director','inpatient_supervisor','controlled_pharmacy','warehouse','pharmacy_staff'];
  if(saved&&validPreviewRoles.indexOf(String(saved.role||''))<0){previewClear();previewStartSavedZ=null;saved=null}
  if(saved&&window.CU&&CU.master===true){
    var actual=Object.assign({},CU),d=saved.deptId?deptZ(saved.deptId):null;
    window.MASTER_ACTUAL=actual;
    window.MASTER_EFFECTIVE={userId:'master-preview-'+saved.role,email:actual.email||actual.username||'Master',role:saved.role,deptId:saved.deptId||null,deptName:d?d.name:(saved.deptName||'')};
    window.CU={id:actual.id,username:actual.username||actual.email||'Master',email:actual.email||'',role:saved.role,master:false,deptId:saved.deptId||null,deptName:d?d.name:(saved.deptName||''),controlledCustodian:saved.role==='department'?true:!!actual.controlledCustodian};
  }else if(saved&&window.CU&&CU.master!==true){
    previewClear();previewStartSavedZ=null;
  }
};
window.finalizePreviewStart=function(){
  previewStartSavedZ=null;
  /* Data migrations are explicit maintenance actions, never page-load work.
     Running them during Crash Cart boot caused a valid read-only page to show
     a misleading Firebase save failure when a tenant was read-only or a role
     lacked the corresponding write permission. */
};


/* Keep every officer print option. Department employees retain only the one exact print action
   installed by asdh-final-department-controlled-fix-script. */
/* Crash Cart configuration permission is enforced by the canonical functions and renderer. */

/* Correct the wrongly labelled 4mg/ml Adrenaline entry in every Crash Cart.
   This is a persistent Firestore migration. The migration marker prevents the success
   message from appearing on every sign-in, while a silent scan still fixes any newly
   imported legacy record. */
var NOREPI_MIGRATION_KEY_Z='migration_crash_cart_norepinephrine_v3';
var repairBusyZ=false,repairDoneZ=false;
function norepiWordZ(v){return /(^|[^a-z])norepinephrine(?=$|[^a-z])/i.test(String(v||''))}
function adrenalineWordZ(v){return /(^|[^a-z])(adrenaline|epinephrine)(?=$|[^a-z])/i.test(String(v||''))}
function fourMgMlZ(v){return /(^|[^0-9])4\s*mg\s*(?:\/|per)?\s*ml(?=$|[^a-z0-9])/i.test(String(v||''))||/(^|[^a-z0-9])4mgml(?=$|[^a-z0-9])/i.test(String(v||''))}
function isWrongNorepiZ(it){
  var name=String((it&&it.name)||''),generic=String((it&&it.genericName)||''),strength=String((it&&it.strength)||''),concentration=String((it&&it.concentration)||'');
  var all=[name,generic,strength,concentration].join(' ');
  /* Word-boundary matching is intentional: "epinephrine" inside "norepinephrine"
     must never be treated as a separate Epinephrine medicine. */
  if(adrenalineWordZ(name+' '+generic)&&fourMgMlZ(all))return true;
  /* Canonicalize legacy Norepinephrine labels that still carry 4 mg/ml as the displayed strength. */
  if(norepiWordZ(name+' '+generic)){
    var canonicalName=name.trim().toLowerCase()==='norepinephrine';
    var canonicalGeneric=!generic||generic.trim().toLowerCase()==='norepinephrine';
    var canonicalStrength=strength.trim()==='1:1,000'&&concentration.trim()==='1:1,000';
    return !(canonicalName&&canonicalGeneric&&canonicalStrength);
  }
  return false;
}
async function repairNorepinephrineZ(force,silent){
  if(repairBusyZ||repairDoneZ||typeof crashCarts!=='function'||typeof setCrashCarts!=='function'||!window.S||typeof S.g!=='function'||typeof S.s!=='function')return;
  /* This is a database migration, not a login task for operational roles. */
  if(typeof window.fsCanWriteStateKey==='function'&&!window.fsCanWriteStateKey('crash_carts')){repairDoneZ=true;return}
  if(typeof window.fsCanWriteStateKey==='function'&&!window.fsCanWriteStateKey(NOREPI_MIGRATION_KEY_Z)){repairDoneZ=true;return}
  var previous=S.g(NOREPI_MIGRATION_KEY_Z)||null;
  var carts=(crashCarts()||[]).slice(),changed=0;repairBusyZ=true;
  carts.forEach(function(c){(c.items||[]).forEach(function(it){if(!isWrongNorepiZ(it))return;it.name='Norepinephrine';it.genericName='Norepinephrine';it.strength='1:1,000';it.concentration='1:1,000';it.updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();changed++})});
  try{
    if(changed){
      await setCrashCarts(carts);
      if(typeof auditAction==='function')auditAction('crash_cart_norepinephrine_name_correction',{items:changed,from:'Adrenaline/Epinephrine 4mg/ml',to:'Noradrenaline 1:1,000',migration:'v3'});
      if(typeof renderCrashCarts==='function')renderCrashCarts();
    }
    var stamp=typeof nowISO==='function'?nowISO():new Date().toISOString();
    if(!previous||previous.version!==3||changed){
      await S.s(NOREPI_MIGRATION_KEY_Z,{completed:true,version:3,completedAt:(previous&&previous.completedAt)||stamp,lastCheckedAt:stamp,lastChanged:changed,updatedBy:String((window.CU&&(CU.email||CU.username||CU.id))||'system')});
    }
    /* Show the confirmation only on the first database migration, never on every login. */
    /* Automatic sign-in repair is intentionally silent. Show confirmation only when the master runs the repair manually. */
    if(changed&&force===true&&silent!==true)toastZ('Corrected Noradrenaline 1:1,000 in '+changed+' Crash Cart item(s) ✓','succ');
    repairDoneZ=true;
  }catch(e){console.error('Crash Cart Norepinephrine correction failed',e)}finally{repairBusyZ=false}
}

/* Publish the closure identity and latest stock/expiry state to the existing public no-login record. */

})();

export {};

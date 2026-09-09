/* Crash Cart smart cross-cart replacement: choosing expiring items across
   several trolleys and replacing them in one guided pass.

   Moved out of modules/51 as the fourth slice. It is the largest single
   responsibility in that file and, once the shared helpers had been extracted,
   the only thing it still needed from its neighbours was the stylesheet for its
   own screen — which came with it, because those rules style nothing else.

   The boot at the bottom belongs to this screen too: it injects the styles,
   clears two modals left by earlier versions, and watches the crash list so the
   selection bar follows what the page renders. */

import { fsE, fsEsc } from './dom-utils.js?v=b2909b7f46';
import { fsText, fsNum } from './text-normalize.js?v=aa16ae9ac0';
import { uiToast, uiNow, uiActor, uiAudit, uiCloseModal, uiOpenModal, uiEnsureStyles } from './module-ui-helpers.js?v=4dc31675ec';

function fsR6EnsureStyles(){
  uiEnsureStyles('asdhealth-r6-canonical-style',
    '#pg-crashcart .fsr6-select-col{width:38px;text-align:center}'+
    '#pg-crashcart .fsr6-select-col input{width:16px;height:16px;margin:0}'+
    '#pg-crashcart tr.fsr6-selected td{box-shadow:inset 0 0 0 1px var(--ac);background:rgba(31,111,235,.10)!important}'+
    '#fsr6-crash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-inline-start:auto}'+
    '#fsr6-crash-actions .btn{margin:0}.fsr6-dialog{width:min(1380px,98vw)!important;max-width:98vw!important;height:min(96vh,980px);max-height:96vh;display:flex;flex-direction:column;padding:0!important;overflow:hidden!important}'+
    '.fsr6-head{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}'+
    '.fsr6-body{padding:14px 20px;overflow:auto;flex:1;min-height:0}.fsr6-seeds{font-size:12px;color:var(--tx2);margin-bottom:12px}'+
    '.fsr6-workflow-note{padding:10px 12px;border:1px solid var(--ac);border-radius:10px;background:rgba(31,111,235,.08);margin-bottom:12px;font-size:12px;line-height:1.6}'+
    '.fsr6-plan{border:1px solid var(--bd);border-radius:12px;margin-bottom:14px;overflow:hidden;background:var(--s1)}'+
    '.fsr6-plan.off{opacity:.62}.fsr6-plan-head{display:grid;grid-template-columns:auto minmax(260px,1fr) auto;gap:10px;align-items:center;padding:12px 14px;background:var(--s2);border-bottom:1px solid var(--bd)}'+
    '.fsr6-plan-title{font-weight:800}.fsr6-plan-meta{font-size:11px;color:var(--tx2);margin-top:3px}.fsr6-plan-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}'+
    '.fsr6-plan-body{padding:12px}.fsr6-alloc-box{border:1px solid var(--bd);border-radius:10px;padding:10px;background:var(--s2);margin-bottom:10px}'+
    '.fsr6-alloc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.fsr6-alloc-list{display:grid;gap:7px}'+
    '.fsr6-alloc-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(100px,.55fr) minmax(140px,.8fr) auto;gap:8px;align-items:end}.fsr6-alloc-row input{margin:0}'+
    '.fsr6-cart-plan{border:1px solid var(--bd);border-radius:10px;margin-top:9px;overflow:hidden}.fsr6-cart-plan-head{display:grid;grid-template-columns:auto minmax(220px,1fr) 130px 180px;gap:8px;align-items:end;padding:9px 10px;background:var(--s2)}'+
    '.fsr6-cart-plan-head input,.fsr6-cart-plan-head select{margin:0}.fsr6-cart-custom{padding:10px;border-top:1px dashed var(--bd);background:var(--s1)}'+
    '.fsr6-review-title{margin:20px 0 8px;padding-top:12px;border-top:2px solid var(--bd);font-size:16px;font-weight:900}'+
    '.fsr6-review-card{border:1px solid var(--bd);border-radius:12px;margin-bottom:12px;overflow:hidden}.fsr6-review-head{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(230px,320px);gap:10px;align-items:center;padding:11px 13px;background:var(--s2)}'+
    '.fsr6-review-card.pending{border-color:var(--yl)}.fsr6-review-card.ready{border-color:var(--gn)}.fsr6-review-lines{padding:0 12px 10px}.fsr6-review-line{padding:9px 0;border-bottom:1px dashed var(--bd);font-size:12px;line-height:1.55}.fsr6-review-line:last-child{border-bottom:0}'+
    '.fsr6-review-seal input{margin:0}.fsr6-confirm-label{display:flex;gap:7px;align-items:center;font-weight:800}.fsr6-confirm-label input{width:17px;height:17px;margin:0}'+
    '.fsr6-footer{padding:12px 20px;border-top:1px solid var(--bd);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.fsr6-footer textarea{margin:0;min-height:58px}.fsr6-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.fsr6-status{font-size:11px;color:var(--tx2);max-width:440px}.fsr6-status.err{color:var(--rdl)}'+
    '.fsr6-invalid{border-color:var(--rdl)!important;box-shadow:0 0 0 1px var(--rdl)}.fsr6-empty{padding:12px;border:1px dashed var(--bd);border-radius:9px;color:var(--tx2);font-size:12px}'+
    '.master-test-banner{font-size:10px;line-height:1.2;padding:4px 8px;border:1px solid var(--yl);border-radius:8px;color:var(--yll);white-space:nowrap}.master-test-exit{border-color:var(--rd)!important;color:var(--rdl)!important}'+
    '.fsr6-master-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fsr6-master-preview{padding:10px;border:1px solid var(--bd);border-radius:8px;background:var(--s2);font-size:12px;line-height:1.7}'+
    '@media(max-width:860px){.fsr6-plan-head,.fsr6-cart-plan-head,.fsr6-review-head,.fsr6-footer,.fsr6-master-grid{grid-template-columns:1fr}.fsr6-plan-actions,.fsr6-actions{justify-content:stretch}.fsr6-plan-actions .btn,.fsr6-actions .btn{flex:1}.fsr6-alloc-row{grid-template-columns:1fr 1fr}.fsr6-alloc-row .fsr6-remove-alloc{grid-column:1/-1}}');
}


globalThis.FS_R6_CRASH_SELECTED = new Map();
globalThis.FS_R6_CRASH_WORKFLOW = null;
globalThis.FS_R6_CRASH_FILTER = '';
globalThis.FS_R6_ORDER_NAMES = ['Adrenaline (Epinephrine)','Amiodarone','Atropine','Calcium Chloride','Calcium Gluconate','Dextrose','Dobutamine','Dopamine','Lidocaine','Magnesium Sulfate','Naloxone','Norepinephrine','Sodium Bicarbonate'];

function fsR6CrashCanBulk(){
  if(window.fsHasCapability)return window.fsHasCapability('crashCart.operate');
  var role=String((window.CU&&CU.role)||'');
  return !!(window.CU&&(CU.master===true||['pharmacy','pharmacy_director','inpatient_supervisor','pharmacy_staff'].indexOf(role)>=0));
}
function fsR6CrashCarts(){return typeof window.crashCarts==='function'?(window.crashCarts()||[]):[]}
function fsR6CrashFilter(){return String((fsE('ccx-expiry')||{}).value||'')}
function fsR6CrashRules(){
  var x={};try{x=window.S&&S.g?S.g('pharmacy_department_expiry_rules')||{}:{}}catch(e){}
  var urgent=Math.max(1,fsNum(x.urgentDays||7)),near=Math.max(urgent+1,fsNum(x.nearDays||30));
  return {urgentDays:urgent,nearDays:near};
}
function fsR6CrashDays(expiry){
  if(!expiry)return null;
  var d=new Date(String(expiry).slice(0,10)+'T00:00:00');
  if(isNaN(d.getTime()))return null;
  var z=new Date(),today=new Date(z.getFullYear(),z.getMonth(),z.getDate());
  return Math.floor((d-today)/86400000);
}
function fsR6CrashBatchLevel(batch){
  var d=fsR6CrashDays(batch&&batch.expiry),r=fsR6CrashRules();
  if(d===null)return'missing';
  if(d<0)return'expired';
  if(d<=r.urgentDays)return'urgent';
  if(d<=r.nearDays)return'near';
  return'normal';
}
function fsR6CrashItemLevel(item){
  var rank={expired:5,urgent:4,near:3,missing:2,normal:1},level='normal',batches=(item&&item.batches)||[];
  if(!batches.length)return'missing';
  batches.forEach(function(b){var l=fsR6CrashBatchLevel(b);if(rank[l]>rank[level])level=l});
  return level;
}
function fsR6CrashItemName(item){
  var raw=fsNorm(item&&item.name),found='';
  FS_R6_ORDER_NAMES.some(function(x){
    var base=fsNorm(x.replace(/\s*\([^)]*\)\s*/g,' '));
    if(raw.indexOf(base)>=0||(base==='adrenalineepinephrine'&&(raw.indexOf('adrenaline')>=0||raw.indexOf('epinephrine')>=0))){found=x;return true}
    return false;
  });
  return found||fsText(item&&item.name,'Medication');
}
function fsR6CrashMedicineKey(item){
  return fsNorm(fsR6CrashItemName(item))+'|'+fsNorm(item&&(item.strength||item.concentration||''));
}
function fsR6CrashSort(items){
  return items.slice().sort(function(a,b){
    var ai=FS_R6_ORDER_NAMES.indexOf(fsR6CrashItemName(a)),bi=FS_R6_ORDER_NAMES.indexOf(fsR6CrashItemName(b));
    if(ai<0)ai=999;if(bi<0)bi=999;
    return ai-bi||fsR6CrashItemName(a).localeCompare(fsR6CrashItemName(b));
  });
}
function fsR6CrashSelectionAllowed(level){return ['expired','urgent','near'].indexOf(level)>=0}
function fsR6CrashKey(cartId,itemId){return String(cartId)+'::'+String(itemId)}
function fsR6CrashVisibleItems(cart,level){
  return fsR6CrashSort((cart.items||[]).filter(function(item){return fsR6CrashItemLevel(item)===level}));
}
function fsR6CrashExactInfo(item,oldDate){
  var present=fsNum(item&&item.present!=null?item.present:item&&item.qty),required=fsNum(item&&item.qty);
  var matching=[],matchingExplicit=0,nonMatchingExplicit=0,unknown=false;
  ((item&&item.batches)||[]).forEach(function(batch){
    var q=batch&&batch.qty==null?null:fsNum(batch.qty);
    if(String(batch&&batch.expiry||'')===String(oldDate||'')){
      matching.push(batch);
      if(q===null)unknown=true;else matchingExplicit+=q;
    }else if(q!==null)nonMatchingExplicit+=q;
  });
  var capacity=Math.max(0,present-nonMatchingExplicit);
  var maxQty=matchingExplicit>0?Math.min(matchingExplicit,capacity,required||matchingExplicit):Math.min(capacity,required||capacity);
  if(unknown&&maxQty<=0&&present>0&&nonMatchingExplicit===0)maxQty=Math.min(present,required||present);
  return {matching:matching,maxQty:Math.max(0,maxQty),present:present,required:required};
}
function fsR6CrashSeedTemplates(){
  var filter=fsR6CrashFilter(),carts=fsR6CrashCarts(),map={};
  FS_R6_CRASH_SELECTED.forEach(function(value,key){
    var parts=key.split('::'),cart=carts.find(function(c){return String(c.id)===parts[0]});
    if(!cart)return;
    var item=(cart.items||[]).find(function(x){return String(x.id)===parts.slice(1).join('::')});
    if(!item)return;
    ((item.batches)||[]).forEach(function(batch){
      if(fsR6CrashBatchLevel(batch)!==filter||!batch.expiry)return;
      var medKey=fsR6CrashMedicineKey(item),templateKey=medKey+'|'+String(batch.expiry);
      if(!map[templateKey])map[templateKey]={key:templateKey,medicineKey:medKey,name:fsR6CrashItemName(item),strength:item.strength||item.concentration||'',oldDate:String(batch.expiry)};
    });
  });
  return Object.keys(map).map(function(k){return map[k]});
}
function fsR6CrashEligibleGroups(templates){
  var groups=[];
  fsR6CrashCarts().forEach(function(cart){
    var rows=[],seen={};
    (cart.items||[]).forEach(function(item){
      var medKey=fsR6CrashMedicineKey(item);
      templates.forEach(function(t){
        if(t.medicineKey!==medKey)return;
        var info=fsR6CrashExactInfo(item,t.oldDate);
        var rowKey=String(item.id)+'|'+t.oldDate;
        if(info.matching.length&&info.maxQty>0&&!seen[rowKey]){
          seen[rowKey]=true;
          rows.push({item:item,template:t,info:info});
        }
      });
    });
    if(rows.length)groups.push({cart:cart,rows:rows});
  });
  return groups;
}
function fsR6CrashUpdateButton(){
  var btn=fsE('fsr6-crash-open'),count=fsE('fsr6-crash-count'),allowed=fsR6CrashSelectionAllowed(fsR6CrashFilter())&&fsR6CrashCanBulk();
  if(btn){btn.disabled=!allowed||FS_R6_CRASH_SELECTED.size===0;btn.style.display=allowed?'inline-flex':'none'}
  if(count)count.textContent=FS_R6_CRASH_SELECTED.size?FS_R6_CRASH_SELECTED.size+' selected / محدد':'0 selected';
}
function fsR6CrashSelectAllFiltered(){
  var filter=fsR6CrashFilter();
  if(!fsR6CrashSelectionAllowed(filter))return uiToast('Choose Expired, Urgent, or Near-expiry first.','info');
  fsR6CrashCarts().forEach(function(cart){
    fsR6CrashVisibleItems(cart,filter).forEach(function(item){
      if((item.batches||[]).some(function(b){return fsR6CrashBatchLevel(b)===filter&&b.expiry}))FS_R6_CRASH_SELECTED.set(fsR6CrashKey(cart.id,item.id),true);
    });
  });
  window.refreshCrashBulkUi();
}
function fsR6CrashClearSelection(){FS_R6_CRASH_SELECTED.clear();window.refreshCrashBulkUi()}
window.refreshCrashBulkUi=function(){
  fsR6EnsureStyles();
  var filter=fsR6CrashFilter();
  if(filter!==FS_R6_CRASH_FILTER){FS_R6_CRASH_SELECTED.clear();FS_R6_CRASH_FILTER=filter}
  var toolbar=fsE('ccx-filters')||fsE('v13-crash-filters');
  if(toolbar&&fsR6CrashCanBulk()){
    var actions=fsE('fsr6-crash-actions');
    if(!actions){
      actions=document.createElement('div');actions.id='fsr6-crash-actions';
      actions.innerHTML='<button type="button" class="btn bg bsm" id="fsr6-crash-select-all">Select all filtered medicines / تحديد كل أدوية الفلتر</button>'+
        '<button type="button" class="btn bg bsm" id="fsr6-crash-clear">Clear selection / إلغاء التحديد</button>'+
        '<span class="chip" id="fsr6-crash-count">0 selected</span>'+
        '<button type="button" class="btn bs bsm" id="fsr6-crash-open">↻ Open selected & bulk replacement / فتح واستبدال جماعي</button>';
      toolbar.appendChild(actions);
      fsE('fsr6-crash-select-all').onclick=fsR6CrashSelectAllFiltered;
      fsE('fsr6-crash-clear').onclick=fsR6CrashClearSelection;
      fsE('fsr6-crash-open').onclick=window.openCrashCartSmartBulkReplacement;
    }
  }
  if(!fsR6CrashSelectionAllowed(filter)||!fsR6CrashCanBulk()){fsR6CrashUpdateButton();return}
  fsR6CrashCarts().forEach(function(cart){
    var card=fsE('ccx-cart-'+cart.id),table=card&&card.querySelector('.ccx-table');
    if(!table)return;
    var items=fsR6CrashVisibleItems(cart,filter),head=table.querySelector('thead tr'),rows=Array.from(table.querySelectorAll('tbody tr'));
    if(!head||rows.length!==items.length)return;
    var th=head.querySelector('.fsr6-select-col');
    if(!th){
      th=document.createElement('th');th.className='fsr6-select-col';
      th.innerHTML='<input type="checkbox" class="fsr6-cart-all" title="Select all filtered medicines in this cart">';
      head.insertBefore(th,head.firstChild);
    }
    var all=th.querySelector('input');
    all.onchange=function(){
      items.forEach(function(item){
        var k=fsR6CrashKey(cart.id,item.id);
        if(all.checked)FS_R6_CRASH_SELECTED.set(k,true);else FS_R6_CRASH_SELECTED.delete(k);
      });
      window.refreshCrashBulkUi();
    };
    rows.forEach(function(row,index){
      var item=items[index],k=fsR6CrashKey(cart.id,item.id),cell=row.querySelector('.fsr6-select-col');
      if(!cell){cell=document.createElement('td');cell.className='fsr6-select-col';cell.innerHTML='<input type="checkbox" class="fsr6-row-check">';row.insertBefore(cell,row.firstChild)}
      var cb=cell.querySelector('input');
      cb.checked=FS_R6_CRASH_SELECTED.has(k);
      row.classList.toggle('fsr6-selected',cb.checked);
      cb.onchange=function(){
        if(cb.checked)FS_R6_CRASH_SELECTED.set(k,true);else FS_R6_CRASH_SELECTED.delete(k);
        row.classList.toggle('fsr6-selected',cb.checked);
        all.checked=items.length>0&&items.every(function(x){return FS_R6_CRASH_SELECTED.has(fsR6CrashKey(cart.id,x.id))});
        fsR6CrashUpdateButton();
      };
    });
    all.checked=items.length>0&&items.every(function(x){return FS_R6_CRASH_SELECTED.has(fsR6CrashKey(cart.id,x.id))});
  });
  fsR6CrashUpdateButton();
};
function fsR6CrashCloseModal(){
  var m=fsE('fsr6-crash-modal');if(m)m.remove();
  FS_R6_CRASH_WORKFLOW=null;
}
function fsR6CrashStatus(message,kind){
  var x=fsE('fsr6-status');if(x){x.textContent=message||'';x.className='fsr6-status '+(kind||'')}
}
function fsR6CrashUid(prefix){
  return String(prefix||'id')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
}
function fsR6CrashClone(value){return JSON.parse(JSON.stringify(value))}
function fsR6CrashFutureDate(value){
  var d=new Date(String(value||'')+'T00:00:00'),today=new Date();today.setHours(0,0,0,0);
  return !!value&&!isNaN(d.getTime())&&d>today;
}
function fsR6CrashCreateAllocation(qty){
  return {id:fsR6CrashUid('alloc'),expiry:'',qty:qty==null?'':qty,lot:''};
}
function fsR6CrashCreateWorkflow(templates,groups){
  var plans=templates.map(function(template){
    var carts=[];
    groups.forEach(function(group){
      group.rows.forEach(function(row){
        if(row.template.key!==template.key)return;
        carts.push({
          cartId:String(group.cart.id),itemId:String(row.item.id),selected:true,
          maxQty:fsNum(row.info.maxQty),removeQty:fsNum(row.info.maxQty),
          allocationMode:'common',customAllocations:[]
        });
      });
    });
    var quantities=carts.map(function(x){return x.removeQty}),same=quantities.length&&quantities.every(function(x){return x===quantities[0]});
    return {
      id:fsR6CrashUid('plan'),enabled:true,template:fsR6CrashClone(template),
      commonAllocations:[fsR6CrashCreateAllocation(same?quantities[0]:'')],carts:carts
    };
  });
  return {id:fsR6CrashUid('workflow'),plans:plans,review:{},note:''};
}
function fsR6CrashFindPlan(planId){
  return FS_R6_CRASH_WORKFLOW&&(FS_R6_CRASH_WORKFLOW.plans||[]).find(function(x){return x.id===planId});
}
function fsR6CrashFindCartPlan(plan,cartId){
  return plan&&(plan.carts||[]).find(function(x){return String(x.cartId)===String(cartId)});
}
function fsR6CrashActiveAllocations(plan,cartPlan){
  return cartPlan&&cartPlan.allocationMode==='custom'?cartPlan.customAllocations:plan.commonAllocations;
}
function fsR6CrashAllocationTotal(allocations){
  return (allocations||[]).reduce(function(sum,x){return sum+fsNum(x.qty)},0);
}
function fsR6CrashEnsureCustomAllocations(plan,cartPlan){
  if((cartPlan.customAllocations||[]).length)return;
  cartPlan.customAllocations=(plan.commonAllocations||[]).map(function(x){
    return {id:fsR6CrashUid('alloc'),expiry:x.expiry||'',qty:x.qty,lot:x.lot||''};
  });
  if(!cartPlan.customAllocations.length)cartPlan.customAllocations=[fsR6CrashCreateAllocation(cartPlan.removeQty)];
}
function fsR6CrashAllocationRows(planId,cartId,allocations){
  var scope=cartId?'custom':'common';
  return (allocations||[]).map(function(a,index){
    return '<div class="fsr6-alloc-row" data-plan="'+fsEsc(planId)+'" data-cart="'+fsEsc(cartId||'')+'" data-allocation="'+fsEsc(a.id)+'">'+
      '<div class="fg"><label>New expiry '+(index+1)+' / تاريخ الصلاحية الجديد</label><input class="fsr6-alloc-expiry" type="date" value="'+fsEsc(a.expiry||'')+'"></div>'+
      '<div class="fg"><label>Quantity / الكمية</label><input class="fsr6-alloc-qty" type="number" min="0.01" step="any" value="'+fsEsc(a.qty)+'"></div>'+
      '<div class="fg"><label>Batch/Lot optional / التشغيلة اختيارية</label><input class="fsr6-alloc-lot" value="'+fsEsc(a.lot||'')+'" placeholder="Optional"></div>'+
      '<button class="btn bd2c bsm fsr6-remove-alloc" type="button" data-action="remove-allocation" data-scope="'+scope+'">Remove / حذف</button></div>';
  }).join('');
}
function fsR6CrashPlanHtml(plan){
  var t=plan.template;
  var carts=(plan.carts||[]).map(function(cp){
    var cart=fsR6CrashCarts().find(function(c){return String(c.id)===String(cp.cartId)})||{};
    var custom=cp.allocationMode==='custom';
    return '<div class="fsr6-cart-plan" data-plan="'+fsEsc(plan.id)+'" data-cart="'+fsEsc(cp.cartId)+'">'+
      '<div class="fsr6-cart-plan-head">'+
      '<label class="fsr6-confirm-label"><input class="fsr6-plan-cart-check" type="checkbox" '+(cp.selected?'checked':'')+'>Include / تضمين</label>'+
      '<div><b>'+fsEsc(cart.name||cart.number||cp.cartId)+'</b><div class="fhint">'+fsEsc(window.floorstockDepartmentName?window.floorstockDepartmentName(cart.deptId):cart.deptId)+' · Current seal: '+fsEsc(cart.seal||'—')+' · Exact available: '+cp.maxQty+'</div></div>'+
      '<div class="fg"><label>Replace qty / كمية الاستبدال</label><input class="fsr6-remove-qty" type="number" min="0.01" max="'+cp.maxQty+'" step="any" value="'+fsEsc(cp.removeQty)+'" '+(cp.selected?'':'disabled')+'></div>'+
      '<div class="fg"><label>Date rule / قاعدة التواريخ</label><select class="fsr6-allocation-mode" '+(cp.selected?'':'disabled')+'><option value="common" '+(!custom?'selected':'')+'>Use this medicine dates / تواريخ هذا العلاج</option><option value="custom" '+(custom?'selected':'')+'>Cart exception / استثناء للعربة</option></select></div></div>'+
      (custom?'<div class="fsr6-cart-custom"><div class="fsr6-alloc-head"><b>Dates only for this cart / تواريخ خاصة بهذه العربة</b><button class="btn bg bsm" type="button" data-action="add-custom-allocation" data-plan="'+fsEsc(plan.id)+'" data-cart="'+fsEsc(cp.cartId)+'">+ Add date / إضافة تاريخ</button></div><div class="fsr6-alloc-list">'+fsR6CrashAllocationRows(plan.id,cp.cartId,cp.customAllocations)+'</div></div>':'')+
      '</div>';
  }).join('');
  return '<section class="fsr6-plan '+(plan.enabled?'':'off')+'" data-plan="'+fsEsc(plan.id)+'">'+
    '<div class="fsr6-plan-head"><label class="fsr6-confirm-label"><input class="fsr6-plan-enabled" type="checkbox" '+(plan.enabled?'checked':'')+'>Include medicine / تضمين العلاج</label>'+
    '<div><div class="fsr6-plan-title">'+fsEsc(t.name)+(t.strength?' · '+fsEsc(t.strength):'')+'</div><div class="fsr6-plan-meta">Old expiry / التاريخ القديم: '+fsEsc(t.oldDate)+' · '+plan.carts.length+' eligible cart(s)</div></div>'+
    '<div class="fsr6-plan-actions"><button class="btn bg bsm" type="button" data-action="select-plan-carts">Select all carts</button><button class="btn bg bsm" type="button" data-action="clear-plan-carts">Clear carts</button></div></div>'+
    '<div class="fsr6-plan-body"><div class="fsr6-alloc-box"><div class="fsr6-alloc-head"><div><b>Replacement dates for this medicine only / تواريخ الاستبدال لهذا العلاج فقط</b><div class="fhint">These dates apply to selected carts using “medicine dates”. Add more than one date to split the quantity.</div></div><button class="btn bg bsm" type="button" data-action="add-common-allocation">+ Add date / إضافة تاريخ</button></div><div class="fsr6-alloc-list">'+fsR6CrashAllocationRows(plan.id,'',plan.commonAllocations)+'</div></div>'+carts+'</div></section>';
}
function fsR6CrashRenderPlans(){
  var host=fsE('fsr6-plan-host');if(!host||!FS_R6_CRASH_WORKFLOW)return;
  host.innerHTML=(FS_R6_CRASH_WORKFLOW.plans||[]).map(fsR6CrashPlanHtml).join('')||'<div class="fsr6-empty">No medication plans.</div>';
}
function fsR6CrashReviewData(){
  var map={};if(!FS_R6_CRASH_WORKFLOW)return [];
  (FS_R6_CRASH_WORKFLOW.plans||[]).forEach(function(plan){
    if(!plan.enabled)return;
    (plan.carts||[]).forEach(function(cp){
      if(!cp.selected)return;
      var cart=fsR6CrashCarts().find(function(c){return String(c.id)===String(cp.cartId)})||{};
      if(!map[cp.cartId])map[cp.cartId]={cartId:cp.cartId,cart:cart,lines:[]};
      map[cp.cartId].lines.push({
        planId:plan.id,itemId:cp.itemId,name:plan.template.name,strength:plan.template.strength||'',
        oldDate:plan.template.oldDate,removeQty:fsNum(cp.removeQty),
        allocations:fsR6CrashClone(fsR6CrashActiveAllocations(plan,cp)||[])
      });
    });
  });
  return Object.keys(map).map(function(k){
    if(!FS_R6_CRASH_WORKFLOW.review[k])FS_R6_CRASH_WORKFLOW.review[k]={confirmed:true,newSeal:''};
    map[k].review=FS_R6_CRASH_WORKFLOW.review[k];return map[k];
  });
}
function fsR6CrashRenderReview(){
  var host=fsE('fsr6-review-host');if(!host)return;
  var data=fsR6CrashReviewData();
  if(!data.length){host.innerHTML='<div class="fsr6-empty">Select at least one cart under a medicine plan to build the final review.</div>';return}
  host.innerHTML=data.map(function(entry){
    var cart=entry.cart||{},review=entry.review||{},lines=entry.lines.map(function(line){
      var dates=(line.allocations||[]).map(function(a){return fsEsc(a.expiry||'No date')+' × '+fsNum(a.qty)+(a.lot?' · '+fsEsc(a.lot):'')}).join(' + ');
      return '<div class="fsr6-review-line"><b>'+fsEsc(line.name)+(line.strength?' · '+fsEsc(line.strength):'')+'</b><br>Remove: '+line.removeQty+' from '+fsEsc(line.oldDate)+' → Replace: '+dates+'</div>';
    }).join('');
    return '<section class="fsr6-review-card '+(review.newSeal?'ready':'pending')+'" data-cart="'+fsEsc(entry.cartId)+'"><div class="fsr6-review-head">'+
      '<span class="chip">Seal review / مراجعة القفل</span>'+
      '<div><b>'+fsEsc(cart.name||cart.number||entry.cartId)+'</b><div class="fhint">'+fsEsc(window.floorstockDepartmentName?window.floorstockDepartmentName(cart.deptId):cart.deptId)+' · '+entry.lines.length+' medicine plan(s)<br>Current seal: <b>'+fsEsc(cart.seal||'—')+'</b></div></div>'+
      '<div class="fsr6-review-seal"><label>New unique seal / القفل الجديد الفريد</label><input class="fsr6-seal-input" value="'+fsEsc(review.newSeal||'')+'" data-old="'+fsEsc(cart.seal||'')+'" placeholder="Required and never used"></div></div><div class="fsr6-review-lines">'+lines+'</div></section>';
  }).join('');
  fsR6CrashValidateReview(false);
}
function fsR6CrashRenderWorkflow(){fsR6CrashRenderPlans();fsR6CrashRenderReview()}
function fsR6CrashAllocationByInput(input){
  var row=input.closest('.fsr6-alloc-row');if(!row)return null;
  var plan=fsR6CrashFindPlan(row.dataset.plan);if(!plan)return null;
  var cp=row.dataset.cart?fsR6CrashFindCartPlan(plan,row.dataset.cart):null;
  var list=cp?cp.customAllocations:plan.commonAllocations;
  return {plan:plan,cartPlan:cp,list:list,allocation:(list||[]).find(function(x){return x.id===row.dataset.allocation})};
}
function fsR6CrashHandlePlanInput(input){
  var planNode=input.closest('[data-plan]'),plan=planNode&&fsR6CrashFindPlan(planNode.dataset.plan);if(!plan)return;
  var cartNode=input.closest('[data-cart]'),cp=cartNode&&cartNode.dataset.cart?fsR6CrashFindCartPlan(plan,cartNode.dataset.cart):null;
  if(input.classList.contains('fsr6-plan-enabled')){plan.enabled=input.checked;fsR6CrashRenderWorkflow();return}
  if(input.classList.contains('fsr6-plan-cart-check')&&cp){cp.selected=input.checked;fsR6CrashRenderWorkflow();return}
  if(input.classList.contains('fsr6-remove-qty')&&cp){cp.removeQty=input.value;fsR6CrashRenderReview();return}
  if(input.classList.contains('fsr6-allocation-mode')&&cp){cp.allocationMode=input.value;if(cp.allocationMode==='custom')fsR6CrashEnsureCustomAllocations(plan,cp);fsR6CrashRenderWorkflow();return}
  var ref=fsR6CrashAllocationByInput(input);if(!ref||!ref.allocation)return;
  if(input.classList.contains('fsr6-alloc-expiry'))ref.allocation.expiry=input.value;
  if(input.classList.contains('fsr6-alloc-qty'))ref.allocation.qty=input.value;
  if(input.classList.contains('fsr6-alloc-lot'))ref.allocation.lot=input.value;
  fsR6CrashRenderReview();
}
function fsR6CrashHandlePlanAction(button){
  var action=button.dataset.action,planNode=button.closest('[data-plan]'),plan=planNode&&fsR6CrashFindPlan(planNode.dataset.plan);if(!plan)return;
  if(action==='select-plan-carts'){plan.carts.forEach(function(x){x.selected=true})}
  else if(action==='clear-plan-carts'){plan.carts.forEach(function(x){x.selected=false})}
  else if(action==='add-common-allocation'){plan.commonAllocations.push(fsR6CrashCreateAllocation(''))}
  else if(action==='add-custom-allocation'){
    var cp=fsR6CrashFindCartPlan(plan,button.dataset.cart);if(cp){fsR6CrashEnsureCustomAllocations(plan,cp);cp.customAllocations.push(fsR6CrashCreateAllocation(''))}
  }else if(action==='remove-allocation'){
    var row=button.closest('.fsr6-alloc-row'),cp=row.dataset.cart?fsR6CrashFindCartPlan(plan,row.dataset.cart):null,list=cp?cp.customAllocations:plan.commonAllocations;
    if(list.length<=1)return fsR6CrashStatus('Each date plan must keep at least one row.','err');
    var index=list.findIndex(function(x){return x.id===row.dataset.allocation});if(index>=0)list.splice(index,1);
  }
  fsR6CrashRenderWorkflow();
}
function fsR6CrashUsedSeals(){
  var used={};
  fsR6CrashCarts().forEach(function(c){var s=String(c.seal||'').trim();if(s)used[s.toLowerCase()]=true});
  if(typeof window.crashReports==='function')(window.crashReports()||[]).forEach(function(r){[r.oldSeal,r.newSeal].forEach(function(v){v=String(v||'').trim();if(v)used[v.toLowerCase()]=true})});
  return used;
}
function fsR6CrashValidateReview(showMessage){
  if(!FS_R6_CRASH_WORKFLOW)return false;
  var seen={},used=fsR6CrashUsedSeals(),ok=true,first='',firstCard=null;
  fsR6CrashReviewData().forEach(function(entry){
    var review=entry.review||{},seal=String(review.newSeal||'').trim(),key=seal.toLowerCase(),old=String(entry.cart&&entry.cart.seal||'').trim().toLowerCase(),reason='';
    if(!seal)reason='enter a new seal';
    else if(key===old)reason='the new seal must be different from the current seal';
    else if(seen[key])reason='this seal is duplicated within the selected carts';
    else if(used[key])reason='this seal is already used in a cart or an earlier opening record';
    if(key)seen[key]=true;
    var badSeal=!!reason;
    review.confirmed=!badSeal;
    var card=document.querySelector('#fsr6-review-host [data-cart="'+CSS.escape(String(entry.cartId))+'"]');
    if(card){
      var input=card.querySelector('.fsr6-seal-input');
      if(input)input.classList.toggle('fsr6-invalid',badSeal);
      card.classList.toggle('ready',!badSeal);
      card.classList.toggle('pending',badSeal);
    }
    if(badSeal){
      ok=false;
      if(!first){
        var cartName=(entry.cart&&(entry.cart.name||entry.cart.number))||entry.cartId;
        first='Cart "'+cartName+'": '+reason+'. / العربة "'+cartName+'": أدخل رقم قفل جديداً وفريداً وغير مستخدم.';
        firstCard=card;
      }
    }
  });
  FS_R6_CRASH_WORKFLOW.reviewError=first;
  if(showMessage&&!ok){
    fsR6CrashStatus(first,'err');
    if(firstCard){
      try{firstCard.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){firstCard.scrollIntoView()}
      var firstInput=firstCard.querySelector('.fsr6-seal-input');if(firstInput)firstInput.focus();
    }
  }
  return ok;
}
function fsR6CrashCompileWorkflow(){
  var errors=[],cartMap={},enabledPlans=0;
  if(!FS_R6_CRASH_WORKFLOW)return {ok:false,errors:['Replacement workflow is not available.'],carts:[]};
  (FS_R6_CRASH_WORKFLOW.plans||[]).forEach(function(plan){
    if(!plan.enabled)return;enabledPlans++;
    var selected=(plan.carts||[]).filter(function(x){return x.selected});
    if(!selected.length){errors.push(plan.template.name+': select at least one cart.');return}
    selected.forEach(function(cp){
      var removeQty=fsNum(cp.removeQty),allocations=fsR6CrashActiveAllocations(plan,cp)||[];
      if(!(removeQty>0)||removeQty>fsNum(cp.maxQty))errors.push(plan.template.name+': invalid quantity for a selected cart.');
      if(!allocations.length)errors.push(plan.template.name+': add at least one replacement date.');
      allocations.forEach(function(a){if(!(fsNum(a.qty)>0))errors.push(plan.template.name+': every replacement date needs a positive quantity.');if(!fsR6CrashFutureDate(a.expiry))errors.push(plan.template.name+': every replacement date must be after today.')});
      if(Math.abs(fsR6CrashAllocationTotal(allocations)-removeQty)>.0001)errors.push(plan.template.name+': replacement-date quantities must total '+removeQty+'.');
      if(!cartMap[cp.cartId])cartMap[cp.cartId]={cartId:cp.cartId,lines:[]};
      cartMap[cp.cartId].lines.push({planId:plan.id,itemId:cp.itemId,medicineKey:plan.template.medicineKey,name:plan.template.name,strength:plan.template.strength||'',oldDate:plan.template.oldDate,removeQty:removeQty,allocations:fsR6CrashClone(allocations)});
    });
  });
  if(!enabledPlans)errors.push('Include at least one medicine plan.');
  var carts=Object.keys(cartMap).map(function(cartId){var review=FS_R6_CRASH_WORKFLOW.review[cartId]||{};cartMap[cartId].newSeal=String(review.newSeal||'').trim();cartMap[cartId].confirmed=true;return cartMap[cartId]});
  if(!carts.length)errors.push('Select at least one cart.');
  if(!fsR6CrashValidateReview(false))errors.push(FS_R6_CRASH_WORKFLOW.reviewError||'Enter a new unique seal for every selected cart.');
  return {ok:errors.length===0,errors:errors,carts:carts,note:String(FS_R6_CRASH_WORKFLOW.note||'').trim()};
}
function fsR6CrashNormalizeAllocations(allocations){
  var map={};(allocations||[]).forEach(function(a){var expiry=String(a.expiry||''),lot=String(a.lot||'').trim(),key=expiry+'|'+lot.toLowerCase();if(!map[key])map[key]={expiry:expiry,lot:lot,qty:0};map[key].qty+=fsNum(a.qty)});return Object.keys(map).map(function(k){return map[k]});
}
function fsR6ApplyExactReplacementAllocations(item,oldDate,removeQty,allocations,reportId,stamp,actorUser){
  removeQty=Math.max(0,fsNum(removeQty));
  var info=fsR6CrashExactInfo(item,oldDate);
  if(!(removeQty>0)||removeQty>info.maxQty)throw new Error('Replacement quantity is outside the allowed range.');
  var normalized=fsR6CrashNormalizeAllocations(allocations);
  if(Math.abs(fsR6CrashAllocationTotal(normalized)-removeQty)>.0001)throw new Error('Replacement allocations do not equal the removed quantity.');
  var remaining=removeQty,next=[],old=[];
  ((item.batches)||[]).forEach(function(batch){
    if(String(batch.expiry||'')!==String(oldDate)){next.push(Object.assign({},batch));return}
    old.push(Object.assign({},batch));if(remaining<=0){next.push(Object.assign({},batch));return}
    if(batch.qty==null){remaining=0;return}
    var q=fsNum(batch.qty),take=Math.min(q,remaining),left=q-take;remaining-=take;if(left>0)next.push(Object.assign({},batch,{qty:left}));
  });
  if(remaining>.0001)throw new Error('The exact selected expiry quantity could not be matched.');
  normalized.forEach(function(a){var batchId=fsR6CrashUid('ccb');next.push({id:batchId,batchId:batchId,qty:a.qty,expiry:a.expiry,lot:a.lot||'',source:'pharmacy_smart_cross_cart_replacement',sourceReportId:reportId,replacedExpiry:oldDate,updatedAt:stamp,updatedBy:actorUser})});
  next.sort(function(a,b){return String(a.expiry||'').localeCompare(String(b.expiry||''))});item.batches=next;
  return {itemId:item.id||'',name:fsR6CrashItemName(item),strength:item.strength||item.concentration||'',oldExpiry:oldDate,oldBatches:old,removedQty:removeQty,allocations:normalized};
}
function fsR6CrashBuildBulkResult(originalCarts,originalReports,compiled){
  var carts=fsR6CrashClone(originalCarts),reports=fsR6CrashClone(originalReports),actor=uiActor(),stamp=uiNow(),bulkId='ccsmart_'+Date.now().toString(36),verification=[],createdReports=[];
  compiled.carts.forEach(function(cartPlan,index){
    var cart=carts.find(function(c){return String(c.id)===String(cartPlan.cartId)});if(!cart)throw new Error('Crash Cart not found: '+cartPlan.cartId);
    if(reports.some(function(r){return String(r.cartId)===String(cart.id)&&(r.status==='open'||r.status==='pending')}))throw new Error((cart.name||'Crash Cart')+' has an open report. Close it first.');
    var oldSeal=String(cart.seal||''),reportId='ccr_smart_'+Date.now().toString(36)+'_'+index+'_'+Math.random().toString(36).slice(2,7),replacements=[];
    cartPlan.lines.forEach(function(line){
      var item=(cart.items||[]).find(function(x){return String(x.id)===String(line.itemId)});if(!item)throw new Error('Medicine no longer exists in '+(cart.name||cart.id));
      if(fsR6CrashMedicineKey(item)!==line.medicineKey)throw new Error('Medicine identity changed in '+(cart.name||cart.id)+'. Reopen the workflow.');
      var detail=fsR6ApplyExactReplacementAllocations(item,line.oldDate,line.removeQty,line.allocations,reportId,stamp,actor.user);replacements.push(detail);
      verification.push({cartId:cart.id,itemId:item.id,reportId:reportId,allocations:detail.allocations});
    });
    cart.seal=cartPlan.newSeal;cart.updatedAt=stamp;cart.updatedBy=actor.name;cart.lastOpenedAt=stamp;cart.lastOpenedByName=actor.name;cart.lastOpenedByUser=actor.user;cart.lastOpenedByRole=actor.role;cart.lastOpenReason='Smart cross-cart expiry replacement initiated by pharmacy';cart.lastClosedAt=stamp;cart.lastClosedByName=actor.name;cart.lastClosedByUser=actor.user;
    var openingReport={id:reportId,cartId:cart.id,deptId:cart.deptId,status:'closed',type:'pharmacy_smart_cross_cart_replacement',operation:'open',openingLog:true,bulkOpen:true,pharmacyInitiated:true,bulkActionId:bulkId,reason:'Bulk opening and smart replacement / فتح جماعي واستبدال ذكي',openedAt:stamp,openedBy:actor.name,openedByName:actor.name,openedByUser:actor.user,openedById:actor.id,openedByRole:actor.role,closedAt:stamp,closedBy:actor.name,closedByName:actor.name,closedByUser:actor.user,closedById:actor.id,oldSeal:oldSeal,newSeal:cartPlan.newSeal,replacements:replacements,pharmacyNote:compiled.note,lastEditedAt:stamp,lastEditedByName:actor.name,lastEditedByUser:actor.user};reports.push(openingReport);createdReports.push(openingReport);
  });
  return {carts:carts,reports:reports,bulkId:bulkId,verification:verification,createdReports:createdReports};
}
function fsR6CrashVerifyPersisted(result,compiled){
  var carts=fsR6CrashCarts(),reports=typeof window.crashReports==='function'?(window.crashReports()||[]):[];
  for(var i=0;i<compiled.carts.length;i++){
    var cp=compiled.carts[i],cart=carts.find(function(c){return String(c.id)===String(cp.cartId)});if(!cart||String(cart.seal||'')!==String(cp.newSeal))return false;
  }
  for(var j=0;j<result.verification.length;j++){
    var v=result.verification[j],cart2=carts.find(function(c){return String(c.id)===String(v.cartId)}),item=cart2&&(cart2.items||[]).find(function(x){return String(x.id)===String(v.itemId)});if(!item)return false;
    var added=(item.batches||[]).filter(function(b){return String(b.sourceReportId||'')===String(v.reportId)}),expected=fsR6CrashAllocationTotal(v.allocations),actual=added.reduce(function(s,b){return s+fsNum(b.qty)},0);if(Math.abs(expected-actual)>.0001)return false;
    if(!reports.some(function(r){return String(r.id)===String(v.reportId)}))return false;
  }
  return true;
}
window.openCrashCartSmartBulkReplacement=function(){
  if(!fsR6CrashCanBulk())return;
  var level=fsR6CrashFilter();if(!fsR6CrashSelectionAllowed(level))return uiToast('Choose Expired, Urgent, or Near-expiry filter first.','info');
  var templates=fsR6CrashSeedTemplates();if(!templates.length)return uiToast('Select one or more medicines with a dated batch.','err');
  var groups=fsR6CrashEligibleGroups(templates);if(!groups.length)return uiToast('No carts have the same selected medicine, strength, and expiry date.','err');
  fsR6CrashCloseModal();FS_R6_CRASH_WORKFLOW=fsR6CrashCreateWorkflow(templates,groups);
  var seeds=templates.map(function(t){return '<span class="chip">'+fsEsc(t.name)+(t.strength?' · '+fsEsc(t.strength):'')+' · '+fsEsc(t.oldDate)+'</span>'}).join(' ');
  var html='<div class="modal-bg on" id="fsr6-crash-modal" role="dialog" aria-modal="true"><div class="modal fsr6-dialog">'+
    '<div class="fsr6-head"><div><div class="mt">Smart cross-cart replacement / الاستبدال الذكي بين العربات</div><div class="fhint">Each medicine, strength and old expiry has an independent plan. Dates never spill into another medicine plan.</div></div><button class="xbtn" id="fsr6-close" type="button">×</button></div>'+
    '<div class="fsr6-body"><div class="fsr6-seeds">'+seeds+'</div><div class="fsr6-workflow-note"><b>Workflow:</b> configure replacement dates under each medicine; select carts and any cart-specific exceptions; then enter one new unique seal for each cart below. A valid seal completes the review automatically.</div><div id="fsr6-plan-host"></div><div class="fsr6-review-title">Final cart review / المراجعة النهائية للعربات</div><div class="fhint" style="margin-bottom:8px">Read-only medicine summary. Enter a new unique seal for every cart; the window closes automatically only after the save and read-back verification succeed.</div><div id="fsr6-review-host"></div></div>'+
    '<div class="fsr6-footer"><div><label>Pharmacy note / ملاحظة الصيدلية</label><textarea id="fsr6-note" placeholder="Optional note"></textarea></div><div class="fsr6-actions"><span class="fsr6-status" id="fsr6-status"></span><button class="btn bg" id="fsr6-cancel" type="button">Cancel</button><button class="btn bs" id="fsr6-save" type="button">Validate and save / تحقق وحفظ</button></div></div></div></div>';
  document.body.insertAdjacentHTML('beforeend',html);fsR6EnsureStyles();fsR6CrashRenderWorkflow();
  fsE('fsr6-close').onclick=fsR6CrashCloseModal;fsE('fsr6-cancel').onclick=fsR6CrashCloseModal;fsE('fsr6-save').onclick=window.saveCrashCartSmartBulkReplacement;
  fsE('fsr6-note').oninput=function(){if(FS_R6_CRASH_WORKFLOW)FS_R6_CRASH_WORKFLOW.note=this.value};
  fsE('fsr6-plan-host').addEventListener('click',function(ev){var b=ev.target.closest('[data-action]');if(b)fsR6CrashHandlePlanAction(b)});
  fsE('fsr6-plan-host').addEventListener('change',function(ev){if(ev.target.matches('input,select'))fsR6CrashHandlePlanInput(ev.target)});
  fsE('fsr6-plan-host').addEventListener('input',function(ev){if(ev.target.matches('.fsr6-remove-qty,.fsr6-alloc-qty,.fsr6-alloc-lot'))fsR6CrashHandlePlanInput(ev.target)});
  fsE('fsr6-review-host').addEventListener('input',function(ev){var card=ev.target.closest('[data-cart]');if(!card||!FS_R6_CRASH_WORKFLOW)return;var review=FS_R6_CRASH_WORKFLOW.review[card.dataset.cart]||(FS_R6_CRASH_WORKFLOW.review[card.dataset.cart]={confirmed:true,newSeal:''});if(ev.target.classList.contains('fsr6-seal-input'))review.newSeal=ev.target.value;fsR6CrashValidateReview(false)});
  fsE('fsr6-crash-modal').onclick=function(ev){if(ev.target===this)fsR6CrashCloseModal()};
};
window.saveCrashCartSmartBulkReplacement=async function(){
  var save=fsE('fsr6-save'),compiled=fsR6CrashCompileWorkflow();
  if(!compiled.ok)return fsR6CrashStatus(compiled.errors[0]||'The replacement plan is incomplete.','err');
  if(save){save.disabled=true;save.textContent='Saving… / جاري الحفظ'}fsR6CrashStatus('Validating exact dates, replacing, resealing and verifying persistence…','');
  var originalCarts=fsR6CrashClone(fsR6CrashCarts()),originalReports=fsR6CrashClone(typeof window.crashReports==='function'?(window.crashReports()||[]):[]),cartsSaved=false,reportsSaved=false;
  try{
    var result=fsR6CrashBuildBulkResult(originalCarts,originalReports,compiled);
    if(typeof window.setCrashCarts==='function'){await window.setCrashCarts(result.carts);cartsSaved=true}
    /* The bulk flow only ADDS reports, so only the new ones are written — one
       document each — instead of rewriting every report in the collection. */
    if(typeof window.saveCrashReport==='function'){await window.saveCrashReport(result.createdReports||[]);reportsSaved=true}
    if(!fsR6CrashVerifyPersisted(result,compiled))throw new Error('Read-back verification failed. No completion was accepted.');
    await Promise.all((result.createdReports||[]).map(function(r){return uiAudit('crash_cart_open_report',{reportId:r.id,cartId:r.cartId,deptId:r.deptId,oldSeal:r.oldSeal,newSeal:r.newSeal,reason:r.reason,bulk:true,bulkActionId:result.bulkId,openedAt:r.openedAt})}));
    await uiAudit('crash_cart_smart_bulk_complete',{bulkActionId:result.bulkId,carts:compiled.carts.length,medicinePlans:(FS_R6_CRASH_WORKFLOW.plans||[]).filter(function(x){return x.enabled}).length,sourceSelection:FS_R6_CRASH_SELECTED.size,uniqueSeals:compiled.carts.map(function(x){return x.newSeal}),openingLogRecords:(result.createdReports||[]).length});
    FS_R6_CRASH_SELECTED.clear();fsR6CrashCloseModal();if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();uiToast(compiled.carts.length+' Crash Cart(s) replaced, reviewed and resealed ✓ · '+result.bulkId,'succ');
  }catch(e){
    console.error(e);
    // Rollback removes exactly what this run created; the reports that existed
    // before it are untouched and need no rewrite.
    try{if(reportsSaved&&typeof window.deleteCrashReport==='function')await window.deleteCrashReport((result&&result.createdReports||[]).map(function(r){return r.id}))}catch(rollbackReportError){console.error('Crash report rollback failed',rollbackReportError)}
    try{if(cartsSaved&&typeof window.setCrashCarts==='function')await window.setCrashCarts(originalCarts)}catch(rollbackCartError){console.error('Crash Cart rollback failed',rollbackCartError)}
    fsR6CrashStatus('Save failed and rollback was attempted: '+String(e&&e.message||e),'err');if(save){save.disabled=false;save.textContent='Validate and save / تحقق وحفظ'}
  }
};

function fsR6InitializeCanonical(){
  fsR6EnsureStyles();
  var oldModal=fsE('ccbx-bulk-modal');if(oldModal)oldModal.remove();
  var oldMaster=fsE('mmaster-role');if(oldMaster)oldMaster.remove();
  window.floorstockEnforceMasterSystemHealth();
  window.addMasterSwitchButton();
  window.refreshCrashBulkUi();
  var crashList=fsE('crash-list');
  if(crashList&&!window.__FS_R6_CRASH_OBSERVER__){
    var observerOptions={childList:true,subtree:true},observerQueued=false;
    function observeCrashList(){
      if(crashList&&document.documentElement.contains(crashList)){
        window.__FS_R6_CRASH_OBSERVER__.observe(crashList,observerOptions);
      }
    }
    window.__FS_R6_CRASH_OBSERVER__=new MutationObserver(function(){
      if(observerQueued)return;
      observerQueued=true;
      setTimeout(function(){
        window.__FS_R6_CRASH_OBSERVER__.disconnect();
        try{
          var page=fsE('pg-crashcart');
          if(page&&page.classList.contains('on'))window.refreshCrashBulkUi();
        }finally{
          observerQueued=false;
          observeCrashList();
        }
      },0);
    });
    observeCrashList();
  }
  if(!window.__FS_R6_CRASH_EVENTS__){
    window.__FS_R6_CRASH_EVENTS__=true;
    document.addEventListener('click',function(ev){
      var target=ev.target&&ev.target.closest?ev.target.closest('[data-pg="pg-crashcart"]'):null;
      if(target)setTimeout(function(){window.refreshCrashBulkUi()},0);
    },false);
    document.addEventListener('change',function(ev){
      var target=ev.target;
      if(target&&target.id==='ccx-expiry')setTimeout(function(){window.refreshCrashBulkUi()},0);
    },false);
  }
  if(!window.__FS_R6_EXIT_CAPTURE__){
    window.__FS_R6_EXIT_CAPTURE__=true;
    document.addEventListener('click',function(ev){
      var target=ev.target&&ev.target.closest?ev.target.closest('#master-test-exit,.master-test-exit,#fsr6-master-exit'):null;
      if(!target)return;
      ev.preventDefault();ev.stopImmediatePropagation();window.masterResetRole();
    },true);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fsR6InitializeCanonical,{once:true});
else setTimeout(fsR6InitializeCanonical,0);

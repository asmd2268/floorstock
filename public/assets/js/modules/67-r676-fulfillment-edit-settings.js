import {
  FULFILLMENT_EDIT_SETTINGS_KEY,
  DEFAULT_FULFILLMENT_EDIT_HOURS,
  MAX_FULFILLMENT_EDIT_HOURS,
  normalizeFulfillmentEditHours,
} from '../core/fulfillment-edit-policy.js?v=8342cad0ce';

(function(){
'use strict';

function masterMayConfigure(){
  var actual=typeof window.fsActualUser==='function'?window.fsActualUser():(window.MASTER_ACTUAL||window.CU||{});
  return actual.master===true&&!window.MASTER_EFFECTIVE;
}

function ensureCard(){
  var list=document.getElementById('rlist'),card=document.getElementById('fulfillment-edit-settings-card');
  if(!list)return null;
  if(!masterMayConfigure()){if(card)card.remove();return null}
  if(card){
    // Re-attach if parent was rebuilt and card is now detached
    if(!list.parentNode.contains(card))list.parentNode.insertBefore(card,list);
    return card;
  }
  card=document.createElement('div');
  card.id='fulfillment-edit-settings-card';
  card.className='card';
  card.style.marginBottom='14px';
  card.innerHTML='<div class="ch"><div><span class="ct">Fulfillment edit window / مدة تعديل الصرف</span><div class="fhint">Master setting stored permanently. The default is 24 hours from fulfilledAt. Master access itself does not expire.<br>إعداد دائم للـMaster؛ الافتراضي 24 ساعة من وقت fulfilledAt، ولا تنتهي صلاحية الـMaster نفسه.</div></div></div><div class="cb"><div class="fl ic g8" style="flex-wrap:wrap"><label for="fulfillment-edit-hours" style="margin:0;font-weight:700">Allowed hours / الساعات المسموحة</label><input id="fulfillment-edit-hours" type="number" min="0" max="'+MAX_FULFILLMENT_EDIT_HOURS+'" step="0.5" style="width:130px;margin:0"><button class="btn bp bsm" type="button" data-save-fulfillment-window>Save setting / حفظ</button><span id="fulfillment-edit-settings-status" class="fhint"></span></div></div>';
  list.parentNode.insertBefore(card,list);
  card.querySelector('[data-save-fulfillment-window]').addEventListener('click',save);
  return card;
}

window.renderFulfillmentEditSettings=function(){
  var card=ensureCard();if(!card)return;
  var hours=normalizeFulfillmentEditHours(window.S&&S.g(FULFILLMENT_EDIT_SETTINGS_KEY));
  var input=document.getElementById('fulfillment-edit-hours');if(input)input.value=String(hours);
  var status=document.getElementById('fulfillment-edit-settings-status');if(status)status.textContent=hours===DEFAULT_FULFILLMENT_EDIT_HOURS?'Default active: 24 hours / الافتراضي مفعل':'Current: '+hours+' hours / الحالي: '+hours+' ساعة';
};

async function save(){
  if(!masterMayConfigure())return window.toast&&toast('Only the active Master account may change this setting.','err');
  var input=document.getElementById('fulfillment-edit-hours'),raw=Number(input&&input.value);
  if(!Number.isFinite(raw)||raw<0||raw>MAX_FULFILLMENT_EDIT_HOURS)return window.toast&&toast('Enter a number from 0 to '+MAX_FULFILLMENT_EDIT_HOURS+' hours.','err');
  var hours=normalizeFulfillmentEditHours(raw),button=document.querySelector('[data-save-fulfillment-window]');if(button)button.disabled=true;
  try{
    var actor=typeof window.fsActualUser==='function'?window.fsActualUser():(window.MASTER_ACTUAL||window.CU||{}),previous=normalizeFulfillmentEditHours(S.g(FULFILLMENT_EDIT_SETTINGS_KEY)),stamp=new Date().toISOString();
    await S.s(FULFILLMENT_EDIT_SETTINGS_KEY,{hours:hours,updatedAt:stamp,updatedBy:actor.username||actor.email||'',updatedById:actor.id||actor.uid||''});
    if(typeof window.auditAction==='function')await auditAction('fulfillment_edit_window_changed',{previousHours:previous,hours:hours});
    window.renderFulfillmentEditSettings();
    if(typeof window.renderReqs==='function')setTimeout(window.renderReqs,0);
    if(window.toast)toast('Fulfillment editing window saved permanently ✓','succ');
  }catch(error){console.error('Fulfillment edit setting save failed',error);if(window.toast)toast('The setting was not saved. Please retry.','err')}
  finally{if(button)button.disabled=false}
}

})();

export {};

import { formatOrderingUnavailable } from '../core/bilingual-ordering-message.js';

(function(){
'use strict';

var crashReportSaving=false;
var noteBadgeTimer=null;
var scheduleFixBusy=false;

var E=window.fsE;
function numberValue(value){var parsed=Number(value);return isFinite(parsed)?parsed:0}
function dateKey(value){return String(value||'').slice(0,10)}
function crashItems(){return typeof window.crashCarts==='function'?(window.crashCarts()||[]):[]}
function crashReportsList(){return typeof window.crashReports==='function'?(window.crashReports()||[]):[]}
function errorMessage(error){return String(error&&error.message||error||'Unknown error').replace(/^FirebaseError:\s*/,'')}
function callToast(ar,en,type){if(typeof window.toast==='function')window.toast(String(ar||'')+'\n'+String(en||''),type||'info')}

function loadFunctionsSdk(){
  if(window.firebase&&typeof firebase.functions==='function')return Promise.resolve(firebase.functions());
  return new Promise(function(resolve,reject){
    var existing=document.querySelector('script[data-r676-functions-sdk]');
    if(existing){
      existing.addEventListener('load',function(){resolve(firebase.functions())},{once:true});
      existing.addEventListener('error',function(){reject(new Error('Firebase Functions library failed to load.'))},{once:true});
      return;
    }
    var script=document.createElement('script');
    script.src='https://www.gstatic.com/firebasejs/12.15.0/firebase-functions-compat.js';
    script.async=true;script.dataset.r676FunctionsSdk='1';
    script.onload=function(){try{resolve(firebase.functions())}catch(error){reject(error)}};
    script.onerror=function(){reject(new Error('Firebase Functions library failed to load.'))};
    document.head.appendChild(script);
  });
}
async function functionsClient(){
  if(typeof window.ensureFirebaseFunctions==='function'){
    try{return await window.ensureFirebaseFunctions()}catch(error){console.warn('Existing Firebase Functions loader failed; retrying directly.',error)}
  }
  return loadFunctionsSdk();
}
function replaceCachedCrashState(cart,report){
  if(!window.S||!S.cache)throw new Error('Crash Cart state cache is unavailable.');
  var carts=crashItems().map(function(entry){return String(entry&&entry.id||'')===String(cart&&cart.id||'')?cart:entry});
  if(!carts.some(function(entry){return String(entry&&entry.id||'')===String(cart&&cart.id||'')}))carts.push(cart);
  var reports=crashReportsList().slice(),index=reports.findIndex(function(entry){return String(entry&&entry.id||'')===String(report&&report.id||'')||(String(entry&&entry.cartId||'')===String(report&&report.cartId||'')&&String(entry&&entry.status||'')==='open')});
  if(index>=0)reports[index]=report;else reports.push(report);
  S.cache.crash_carts=carts;
  S.cache.crash_cart_reports=reports;
}
function collectCrashReport(){
  var id=String((E('ccr-cart-id')||{}).value||'').trim(),cart=crashItems().find(function(entry){return String(entry&&entry.id||'')===id});
  if(!cart)throw new Error('Crash Cart not found.');
  var reason=String((E('ccr-reason')||{}).value||'').trim();
  if(!reason)throw new Error('Select a reason for opening the Crash Cart.');
  if(reason.toLowerCase()==='other'){
    var other=String((E('v16-crash-other')||{}).value||'').trim();
    if(!other)throw new Error('Enter the other reason.');
    reason='Other / سبب آخر: '+other;
  }
  var consumed=[];
  document.querySelectorAll('#ccr-items .cc-med-choice').forEach(function(row){
    var checkbox=row.querySelector('input[type="checkbox"]');if(!checkbox||!checkbox.checked)return;
    var item=(cart.items||[]).find(function(entry){return String(entry&&entry.id||'')===String(row.dataset.id||'')});
    if(!item)throw new Error('A selected medicine no longer exists in the Crash Cart.');
    var quantity=numberValue((row.querySelector('.ccr-qty')||{}).value),available=numberValue(item.present==null?item.qty:item.present);
    if(!(quantity>0)||quantity>available)throw new Error(String(item.name||'Medicine')+': quantity exceeds available stock.');
    consumed.push({itemId:String(item.id),qty:quantity,reportedExpiry:dateKey((row.querySelector('.ccr-expiry')||{}).value)});
  });
  if(!consumed.length)throw new Error('Select at least one medication and enter its quantity.');
  var oldSeal=String((E('ccr-old-seal')||{}).value||'').trim();
  if(!oldSeal)throw new Error('Enter the old seal number before submitting the report.');
  return {cartId:id,reason:reason,oldSeal:oldSeal,consumed:consumed};
}

function nowISO(){return new Date().toISOString()}
function actorName(){var u=window.CU||{};return typeof window.actualActorName==='function'?window.actualActorName():(u.name||u.username||u.email||'Unknown')}
function setReports(rs){
  if(typeof window.setCrashReports==='function')return window.setCrashReports(rs);
  if(window.S&&typeof S.s==='function')return S.s('crash_cart_reports',rs);
  throw new Error('Crash reports writer is unavailable.');
}
window.ccSubmitReport=async function(){
  if(crashReportSaving)return false;
  var button=document.querySelector('#mcc-report .fl.g8 .btn.bd2c'),oldText=button&&button.textContent;
  crashReportSaving=true;if(button){button.disabled=true;button.textContent='جاري الحفظ… / Saving…'}
  try{
    var effectiveRole=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(CU&&CU.role||'');
    var canReport=typeof window.fsHasCapability==='function'?window.fsHasCapability('crashCart.report'):['department','department_employee'].indexOf(String(effectiveRole))>=0;
    if(!window.CU||!canReport)throw new Error('Only a department employee can submit this report.');
    var payload=collectCrashReport();
    var originalCarts=JSON.parse(JSON.stringify(crashItems()));
    var originalReports=JSON.parse(JSON.stringify(crashReportsList()));
    var carts=JSON.parse(JSON.stringify(originalCarts));
    var reports=JSON.parse(JSON.stringify(originalReports));
    var cart=carts.find(function(c){return String(c.id)===String(payload.cartId)});
    if(!cart)throw new Error('Crash Cart not found.');
    var actor=window.CU||{},stamp=nowISO(),name=actorName(),login=actor.username||actor.email||actor.id||'Unknown',actorId=actor.id||actor.uid||'';
    var reportId='ccr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    var report={
      id:reportId,cartId:payload.cartId,
      deptId:cart.deptId||(actor&&actor.deptId)||'',
      status:'open',reason:payload.reason,oldSeal:payload.oldSeal,
      consumed:payload.consumed.map(function(row){
        var it=(cart.items||[]).find(function(x){return String(x.id)===String(row.itemId)})||{};
        return Object.assign({},row,{name:it.name||''});
      }),
      inventoryDeductedAtReport:false,
      openedAt:stamp,openedBy:name,openedByUser:login,openedById:actorId,
      updatedAt:stamp,updatedBy:name
    };
    var existingIdx=reports.findIndex(function(r){return String(r.cartId)===String(payload.cartId)&&r.status==='open'});
    if(existingIdx>=0)reports[existingIdx]=report;else reports.push(report);
    if(typeof window.setCrashCarts==='function')await window.setCrashCarts(carts);
    try{await setReports(reports)}catch(reportError){
      if(typeof window.setCrashCarts==='function')await window.setCrashCarts(originalCarts);
      throw reportError;
    }
    replaceCachedCrashState(cart,report);
    if(typeof window.CM==='function')window.CM('mcc-report');
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
    if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();
    callToast('تم إرسال البلاغ بنجاح، وستقوم الصيدلية باستكمال الإجراء ✓','Report submitted. The pharmacist will complete the response and update the cart ✓','succ');
    return true;
  }catch(error){
    console.error('Crash Cart report save failed',error);
    callToast('لم يتم حفظ البلاغ. حاول مرة أخرى.','Report was not saved. Please retry.\n'+errorMessage(error),'err');
    return false;
  }finally{
    crashReportSaving=false;if(button){button.disabled=false;button.textContent=oldText||'Submit report / إرسال البلاغ'}
  }
};

// Seal-must-match policy (master-only toggle)
function getSealPolicy(){return !!(window.S&&typeof S.g==='function'&&S.g('crash_cart_seal_must_match'))}
window.getCrashSealPolicy=getSealPolicy;
window.setCrashSealPolicy=async function(enabled){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(window.CU&&CU.role||'');
  if(role!=='master')return callToast('الصلاحية فقط للماستر','Only master can change this setting','err');
  if(window.S&&typeof S.s==='function')await S.s('crash_cart_seal_must_match',!!enabled);
  renderSealPolicyToggle();
};
function renderSealPolicyToggle(){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(window.CU&&CU.role||'');
  if(role!=='master')return;
  var container=document.getElementById('ccx-seal-policy-toggle');
  if(!container){
    var pg=document.getElementById('pg-crash-ops');if(!pg)return;
    container=document.createElement('div');container.id='ccx-seal-policy-toggle';
    container.style.cssText='margin:8px 0;padding:8px 12px;background:var(--bg2);border-radius:6px;display:flex;align-items:center;gap:10px;font-size:13px';
    pg.insertBefore(container,pg.firstChild);
  }
  var on=getSealPolicy();
  container.innerHTML='<b>⚙️ إعداد ماستر / Master Setting:</b><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" '+(on?'checked':'')+' onchange="window.setCrashSealPolicy(this.checked)"><span>'+(on?'✅ رقم القفل الجديد يجب أن يطابق القفل السابق / New seal must match the old seal':'☐ رقم القفل الجديد حر / New seal can be any unique number')+'</span></label>';
}

// Enforce seal policy on pharmacy close response
var _origSavePharmacy=window.ccSavePharmacyResponse;
window.ccSavePharmacyResponse=async function(){
  if(getSealPolicy()){
    var reportId=String((document.getElementById('ccc-report-id')||{}).value||'');
    var reports=crashReportsList();
    var r=reports.find(function(x){return String(x.id)===String(reportId)});
    if(r&&r.oldSeal){
      var newSeal=String((document.getElementById('ccc-new-seal')||{}).value||'').trim();
      if(newSeal!==String(r.oldSeal).trim()){
        callToast('رقم القفل الجديد يجب أن يطابق رقم القفل السابق: '+r.oldSeal,'New seal must match the previous seal: '+r.oldSeal,'err');
        return false;
      }
    }
  }
  return typeof _origSavePharmacy==='function'?_origSavePharmacy.apply(this,arguments):undefined;
};

function unresolvedNote(note){var status=String(note&&note.status||'').toLowerCase();return status==='open'||status==='urgent'}
function notes(){try{return typeof window.getNotes==='function'?(window.getNotes()||[]):[]}catch(error){return[]}}
function badgeMarkup(count,color){return count>0?' <span style="background:'+color+';color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">'+count+'</span>':''}
function refreshNotesBadge(){
  if(!window.CU)return;
  var list=notes(),pharmacyCount=list.filter(unresolvedNote).length;
  document.querySelectorAll('.nb[data-pg="pg-notes-ph"]').forEach(function(button){
    var html='📝 Notes'+badgeMarkup(pharmacyCount,'var(--rd)');if(button.innerHTML!==html)button.innerHTML=html;
  });
  var departmentId=String(CU.deptId||CU.departmentId||'');
  if(!departmentId)return;
  var departmentCount=list.filter(function(note){return String(note&&note.deptId||'')===departmentId&&unresolvedNote(note)&&!!note.reply&&!note._replyRead}).length;
  document.querySelectorAll('.nb[data-pg="pg-notes-dept"]').forEach(function(button){
    var html='📝 Notes / ملاحظات'+badgeMarkup(departmentCount,'var(--gn)');if(button.innerHTML!==html)button.innerHTML=html;
  });
}
window.updateNotesBadge=refreshNotesBadge;
function wrapNotesRender(name){var original=window[name];if(typeof original!=='function'||original.__r676Notes)return;var wrapped=function(){var result=original.apply(this,arguments);setTimeout(refreshNotesBadge,0);return result};wrapped.__r676Notes=true;window[name]=wrapped}
['renderDeptNotes','renderPharmNotes','buildNav'].forEach(wrapNotesRender);
function startNotesBadgeRefresh(){if(noteBadgeTimer)return;refreshNotesBadge();noteBadgeTimer=setInterval(function(){if(document.visibilityState==='visible')refreshNotesBadge()},1000)}

function fixOrderingBanner(){
  if(scheduleFixBusy)return;scheduleFixBusy=true;
  try{
    var banner=document.querySelector('#req-sched-info .schedule-lock-banner');if(!banner||!window.CU||typeof window.isRequestAllowed!=='function')return;
    var lines=formatOrderingUnavailable(window.isRequestAllowed(CU.deptId||CU.departmentId));if(!lines)return;
    var title=banner.querySelector('.title');if(!title)return;
    var html='<span dir="rtl" style="display:block;text-align:right">'+String(lines.ar)+'</span><span dir="ltr" style="display:block;text-align:left;margin-top:4px">'+String(lines.en)+'</span>';
    if(title.innerHTML!==html)title.innerHTML=html;
    var mixed=banner.querySelector('.times');if(mixed)mixed.remove();
    title.dataset.r676Bilingual='separate-lines';
  }finally{scheduleFixBusy=false}
}
function wrapScheduleRender(name){var original=window[name];if(typeof original!=='function'||original.__r676Schedule)return;var wrapped=function(){var result=original.apply(this,arguments);setTimeout(fixOrderingBanner,0);return result};wrapped.__r676Schedule=true;window[name]=wrapped}
['renderReqForm','refreshNewRequestGate','showPg'].forEach(wrapScheduleRender);

function wrapCrashRender(name){var original=window[name];if(typeof original!=='function'||original.__r676SealPolicy)return;var wrapped=function(){var result=original.apply(this,arguments);setTimeout(renderSealPolicyToggle,0);return result};wrapped.__r676SealPolicy=true;window[name]=wrapped}
['renderCrashCarts','renderCrashOperations','showPg'].forEach(wrapCrashRender);

function install(){
  startNotesBadgeRefresh();fixOrderingBanner();renderSealPolicyToggle();
  var nav=E('mnav');if(nav)new MutationObserver(function(){setTimeout(refreshNotesBadge,0)}).observe(nav,{childList:true,subtree:true});
  var requestPage=E('pg-newreq');if(requestPage)new MutationObserver(function(){setTimeout(fixOrderingBanner,0)}).observe(requestPage,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){refreshNotesBadge();fixOrderingBanner()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

export {};

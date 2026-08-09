import { formatOrderingUnavailable } from '../core/bilingual-ordering-message.js?v=R6.76.7';

(function(){
'use strict';

var crashReportSaving=false;
var noteBadgeTimer=null;
var scheduleFixBusy=false;

function E(id){return document.getElementById(id)}
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

window.ccSubmitReport=async function(){
  if(crashReportSaving)return false;
  var button=document.querySelector('#mcc-report .fl.g8 .btn.bd2c'),oldText=button&&button.textContent;
  crashReportSaving=true;if(button){button.disabled=true;button.textContent='جاري الحفظ… / Saving…'}
  try{
    if(!window.CU||String(CU.role||'')!=='department')throw new Error('Only a department employee can submit this report.');
    var payload=collectCrashReport(),functions=await functionsClient(),call=functions.httpsCallable('submitCrashCartReport'),response=await call(payload),data=response&&response.data||{};
    if(!data.ok||!data.cart||!data.report)throw new Error('The server did not confirm the Crash Cart report save.');
    replaceCachedCrashState(data.cart,data.report);
    if(typeof window.CM==='function')window.CM('mcc-report');
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
    if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();
    callToast('تم إرسال البلاغ وخصم الكميات وتحديث عرض QR بنجاح ✓','Report saved, quantities deducted, and the public QR view refreshed ✓','succ');
    return true;
  }catch(error){
    console.error('Secure Crash Cart report save failed',error);
    callToast('لم يتم حفظ البلاغ، ولم تتغير كميات العربة. حاول مرة أخرى.','Report was not saved, and no cart quantity was changed. Please retry.\n'+errorMessage(error),'err');
    return false;
  }finally{
    crashReportSaving=false;if(button){button.disabled=false;button.textContent=oldText||'Submit report / إرسال البلاغ'}
  }
};
window.ccSubmitReport.__r676SecureCallable=true;

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

function install(){
  startNotesBadgeRefresh();fixOrderingBanner();
  var nav=E('mnav');if(nav)new MutationObserver(function(){setTimeout(refreshNotesBadge,0)}).observe(nav,{childList:true,subtree:true});
  var requestPage=E('pg-newreq');if(requestPage)new MutationObserver(function(){setTimeout(fixOrderingBanner,0)}).observe(requestPage,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){refreshNotesBadge();fixOrderingBanner()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

export {};

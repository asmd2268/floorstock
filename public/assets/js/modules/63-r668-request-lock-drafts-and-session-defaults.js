import { deriveNewRequestGateState } from '../core/new-request-gate-policy.js';

(function(){
'use strict';
var VERSION='R6.75.0';
const E=globalThis.E;
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function isDepartment(){return !!(window.CU&&role()==='department')}
function setValue(id,value){var node=E(id);if(!node)return;node.value=value;if(node.type==='checkbox'||node.type==='radio')node.checked=!!value}
function resetCrashView(){
  var tabs=E('v13as-crash-tabs');if(tabs)tabs.querySelectorAll('[data-view]').forEach(function(button){button.classList.toggle('active',button.dataset.view==='carts')});
  var list=E('crash-list');if(list)list.style.display='';
  var filters=E('ccx-filters')||E('v13-crash-filters');if(filters)filters.style.display='';
  var alerts=E('crash-open-alerts');if(alerts)alerts.style.display='';
  var log=E('v13as-opening-log');if(log)log.classList.remove('on');
}
var DEFAULTS={
  'ccx-dept':'','ccx-state':'','ccx-expiry':'','ccx-search':'',
  'v13as-log-dept':'all','v13as-log-month':'',
  'isrch':'','icatf':'','iclsf':'','inv-dept-sel':'','adept':'','aperiod':'month',
  'shelf-med-filter':'all','shelf-med-search':'','print-shelf-sel':'all','print-shelf-cls':'all',
  'notes-filter-dept':'','notes-filter-type':'','notes-filter-status':'',
  'controlled-storage-mode':'map','controlled-storage-filter':'all',
  'ctl-an-dept':'','ctl-clean-search':'','ctl-clean-class':'','ctl-clean-status':'all',
  'v16-r-status':'all','v16-r-age':'all','v16-r-search':'',
  'v16-inv-status-filter':'all','sim-mode-filter':'similar','sim-search':'',
  'all-inv-search':'','wh-receive-search':'','ph-expiry-top-filter':'all',
  'rsrch':''
};
window.resetFloorstockSessionFilters=function(){
  window.RFS='all';
  Object.keys(DEFAULTS).forEach(function(id){setValue(id,DEFAULTS[id])});
  document.querySelectorAll('select[id*="filter"]').forEach(function(select){if(Object.prototype.hasOwnProperty.call(DEFAULTS,select.id))return;select.selectedIndex=0});
  document.querySelectorAll('input[id*="search"]').forEach(function(input){input.value=''});
  ['all-inv-variants','all-inv-class-mismatch'].forEach(function(id){var node=E(id);if(node)node.checked=false});
  var identical=E('all-inv-hide-identical');if(identical)identical.checked=true;
  var requestTabs=document.querySelectorAll('#pg-reqs .tbtn');requestTabs.forEach(function(button,index){button.classList.toggle('on',index===0)});
  resetCrashView();
};
function requestRows(){return typeof window.gr==='function'?(window.gr()||[]):[]}
function currentGateState(){
  var departmentId=window.CU&&CU.deptId||'';
  var schedule=typeof window.isRequestAllowed==='function'?window.isRequestAllowed(departmentId):{allowed:true};
  var rolling=typeof window.checkRequestCountLimits==='function'?window.checkRequestCountLimits(departmentId):{blocked:false};
  var monthly=typeof window.getMonthlyLimit==='function'?window.getMonthlyLimit(departmentId):null;
  var used=monthly!==null&&typeof window.getMonthlyReqCount==='function'?window.getMonthlyReqCount(departmentId):0;
  return deriveNewRequestGateState({
    isDepartment:isDepartment(),
    departmentId:departmentId,
    requests:requestRows(),
    schedule:schedule,
    rollingLimit:rolling,
    monthlyLimit:monthly,
    monthlyUsed:used
  });
}
window.getNewRequestGateState=function(){return currentGateState()};
function removeLegacyBlockingWarnings(){
  ['r18-request-limit-warning','r668-monthly-limit-warning'].forEach(function(id){var old=E(id);if(old)old.remove()});
}
function renderGateWarning(state){
  var old=E('r670-new-request-gate-warning');if(old)old.remove();
  var scheduleInfo=E('req-sched-info');
  if(scheduleInfo)scheduleInfo.hidden=!!(state.blocked&&state.kind!=='schedule');
  if(!state.blocked||state.kind==='schedule'||state.kind==='department'||state.kind==='role')return;
  removeLegacyBlockingWarnings();
  var host=E('rfbody');if(!host)return;
  var warning=document.createElement('div');
  warning.id='r670-new-request-gate-warning';
  warning.className='r18-request-limit-warn blocked';
  warning.style.whiteSpace='normal';
  var ar=document.createElement('div');ar.dir='rtl';ar.textContent=(state.kind==='pending'?'⏳ ':'🚫 ')+(state.reasonAr||'');
  var en=document.createElement('div');en.dir='ltr';en.style.marginTop='5px';en.textContent=state.reasonEn||'';
  warning.appendChild(ar);warning.appendChild(en);
  host.insertAdjacentElement('beforebegin',warning);
}
function applyNewRequestGate(){
  if(!isDepartment())return {blocked:false,kind:'role'};
  var pg=E('pg-newreq');if(!pg)return currentGateState();
  var state=currentGateState(),blocked=!!state.blocked;
  pg.classList.toggle('new-request-gate-locked',blocked);
  pg.classList.toggle('pending-request-locked',state.kind==='pending');
  pg.querySelectorAll('.rqi').forEach(function(input){
    if(blocked){
      if(!input.disabled)input.dataset.newRequestGateLocked='1';
      input.disabled=true;
    }else if(input.dataset.newRequestGateLocked==='1'){
      delete input.dataset.newRequestGateLocked;
      if((+input.dataset.max||0)>0&&!input.dataset.editLocked)input.disabled=false;
    }
  });
  var submit=pg.querySelector('button[data-asdh-binding="b047"]');
  if(submit){
    submit.disabled=blocked;
    submit.setAttribute('aria-disabled',blocked?'true':'false');
    submit.title=blocked?((state.reasonEn||state.reasonAr||'New request is unavailable.')):'';
  }
  renderGateWarning(state);
  return state;
}
window.refreshNewRequestGate=applyNewRequestGate;
window.refreshRequestLimitPageLock=applyNewRequestGate;
function positionR18Banner(){
  var r18=document.getElementById('r18-request-limit-warning');
  var schedInfo=document.getElementById('req-sched-info');
  if(r18&&schedInfo&&schedInfo.nextSibling!==r18){
    schedInfo.parentNode&&schedInfo.parentNode.insertBefore(r18,schedInfo.nextSibling);
  }
}
var previousCountWarning=window.refreshRequestCountLimitWarning;
window.refreshRequestCountLimitWarning=function(){
  removeLegacyBlockingWarnings();
  var result=typeof previousCountWarning==='function'?previousCountWarning.apply(this,arguments):undefined;
  positionR18Banner();
  setTimeout(positionR18Banner,0);
  applyNewRequestGate();
  return result;
};
var previousScheduleMessage=window.refreshRequestScheduleMessage;
window.refreshRequestScheduleMessage=function(){
  var result=typeof previousScheduleMessage==='function'?previousScheduleMessage.apply(this,arguments):undefined;
  positionR18Banner();
  applyNewRequestGate();
  return result;
};
function preserveDraftAround(name,pageId){
  var previous=window[name];if(typeof previous!=='function'||previous.__r668DraftWrapped)return;
  function wrapped(){
    var page=E(pageId),active=page&&page.classList.contains('on');
    if(active&&typeof window.persistTransientUiState==='function')window.persistTransientUiState();
    var result=previous.apply(this,arguments);
    if(active&&typeof window.restorePageTransientUi==='function')setTimeout(function(){window.restorePageTransientUi(pageId);if(pageId==='pg-newreq')applyNewRequestGate()},0);
    return result;
  }
  wrapped.__r668DraftWrapped=true;window[name]=wrapped;
}
preserveDraftAround('renderCrashOperations','pg-crash-ops');
// renderReqFormDebounced is owned by the canonical request renderer.  Do not
// replace it here: replacing it bypasses draft protection and creates a second
// render path that can erase quantities during realtime updates.
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){window.resetFloorstockSessionFilters();var result=previousStart.apply(this,arguments);setTimeout(function(){window.resetFloorstockSessionFilters();var active=document.querySelector('.pg.on');if(active&&typeof window.restorePageTransientUi==='function')window.restorePageTransientUi(active.id);setTimeout(function(){setValue('rsrch','');applyNewRequestGate()},0)},0);return result};
// The canonical authentication module owns logout and invokes the reset helper.
// A second global wrapper can be wrapped again by compatibility modules and
// recurse until the browser reports “Maximum call stack size exceeded”.
document.documentElement.dataset.asdhSessionDefaults=VERSION;
})();

// Merged from 61-r666-form-draft-and-crash-report-protection.js (Phase 6).
(function(){
'use strict';
if(window.__asdhR666DraftProtectionInstalled)return;
window.__asdhR666DraftProtectionInstalled=true;
var restoring=false,dirty={newreq:false,bulk:false},timer=null;
var E=window.fsE;
function uid(){var u=window.FB_AUTH&&FB_AUTH.currentUser;return String(u&&u.uid||(window.CU&&(CU.id||CU.uid||CU.username))||'anonymous')}
function key(type){return 'asdh_r666_draft_'+uid()+'_'+type}
function read(type){try{var raw=sessionStorage.getItem(key(type))||localStorage.getItem(key(type))||'null';return JSON.parse(raw)}catch(e){return null}}
function write(type,value){var raw=JSON.stringify(value);try{sessionStorage.setItem(key(type),raw)}catch(e){console.warn('Session draft could not be stored.',e)}try{localStorage.setItem(key(type),raw)}catch(e){console.warn('Durable draft could not be stored.',e)}}
function clear(type){try{sessionStorage.removeItem(key(type))}catch(e){}try{localStorage.removeItem(key(type))}catch(e){}dirty[type]=false;notice('')}
function notice(text){var id='r666-draft-notice',node=E(id),page=document.querySelector('.pg.on');if(!text){if(node)node.remove();return}if(!node){node=document.createElement('div');node.id=id;node.className='alert-banner-y';node.style.margin='8px 0';if(page)page.insertBefore(node,page.firstChild)}if(node)node.textContent=text}
function captureNewRequest(){var host=E('pg-newreq');if(!host)return null;var quantities={};host.querySelectorAll('.rqi[data-mid]').forEach(function(input){if(String(input.value||'').trim())quantities[input.dataset.mid]=input.value});return {search:(E('rsrch')||{}).value||'',quantities:quantities,at:new Date().toISOString()}}
function restoreNewRequest(draft){if(!draft||!E('pg-newreq'))return;restoring=true;try{var search=E('rsrch');if(search)search.value=draft.search||'';Object.keys(draft.quantities||{}).forEach(function(id){var input=document.querySelector('#pg-newreq .rqi[data-mid="'+CSS.escape(String(id))+'"]');if(input)input.value=draft.quantities[id]});if(typeof window.cntItems==='function')window.cntItems()}finally{restoring=false}}
function replacementDraft(){return Array.from(document.querySelectorAll('#r17-cr-replacements .r17-replacement')).map(function(row){return {name:(row.querySelector('.r17-rep-name')||{}).value||'',concentration:(row.querySelector('.r17-rep-conc')||{}).value||'',qty:(row.querySelector('.r17-rep-qty')||{}).value||'',expiry:(row.querySelector('.r17-rep-exp')||{}).value||'',lot:(row.querySelector('.r17-rep-lot')||{}).value||''}})}
function captureBulk(){if(!E('pg-crash-ops'))return null;var carts={};document.querySelectorAll('[data-plan-cart]').forEach(function(box){var reps={};box.querySelectorAll('.r17-plan-include').forEach(function(input){var exp=box.querySelector('.r17-plan-exp[data-rep="'+CSS.escape(String(input.dataset.rep))+'"]');reps[input.dataset.rep]={include:input.checked,expiry:exp&&exp.value||''}});carts[box.dataset.planCart]={remove:(box.querySelector('.r17-plan-remove')||{}).value||'',seal:(box.querySelector('.r17-plan-seal')||{}).value||'',replacements:reps}});return {source:(E('r17-cr-source-med')||{}).value||'',expiry:(E('r17-cr-source-expiry')||{}).value||'',qty:(E('r17-cr-source-qty')||{}).value||'',note:(E('r17-cr-note')||{}).value||'',selected:Array.from(document.querySelectorAll('.r17-cr-cart-check:checked')).map(function(x){return x.value}),replacements:replacementDraft(),carts:carts,at:new Date().toISOString()}}
function setValue(selector,value){var node=document.querySelector(selector);if(node)node.value=value==null?'':value}
function restoreBulk(draft){if(!draft||!E('r17-cr-source-med'))return;restoring=true;try{
  E('r17-cr-source-med').value=draft.source||'';
  if(typeof window.r17CrashSourceChanged==='function')window.r17CrashSourceChanged();
  if(E('r17-cr-source-expiry'))E('r17-cr-source-expiry').value=draft.expiry||'';
  if(E('r17-cr-source-qty'))E('r17-cr-source-qty').value=draft.qty||'';
  if(E('r17-cr-note'))E('r17-cr-note').value=draft.note||'';
  var host=E('r17-cr-replacements');if(host){host.innerHTML='';(draft.replacements||[]).forEach(function(rep){window.r17CrashAddReplacement();var row=host.lastElementChild;if(!row)return;setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-name',rep.name);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-conc',rep.concentration);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-qty',rep.qty);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-exp',rep.expiry);setValue('#r17-cr-replacements .r17-replacement:last-child .r17-rep-lot',rep.lot)});if(!host.children.length&&typeof window.r17CrashAddReplacement==='function')window.r17CrashAddReplacement()}
  if(typeof window.r17CrashScanMatches==='function')window.r17CrashScanMatches();
  (draft.selected||[]).forEach(function(id){var box=document.querySelector('.r17-cr-cart-check[value="'+CSS.escape(String(id))+'"]');if(box)box.checked=true});
  if(typeof window.r17CrashRenderMatrix==='function')window.r17CrashRenderMatrix();
  Object.keys(draft.carts||{}).forEach(function(id){var box=document.querySelector('[data-plan-cart="'+CSS.escape(String(id))+'"]'),saved=draft.carts[id];if(!box)return;var remove=box.querySelector('.r17-plan-remove'),seal=box.querySelector('.r17-plan-seal');if(remove)remove.value=saved.remove||'';if(seal)seal.value=saved.seal||'';var savedReps=Object.values(saved.replacements||{}),includes=box.querySelectorAll('.r17-plan-include'),exps=box.querySelectorAll('.r17-plan-exp');includes.forEach(function(input,index){if(savedReps[index])input.checked=savedReps[index].include!==false});exps.forEach(function(input,index){if(savedReps[index])input.value=savedReps[index].expiry||''})})
 }finally{restoring=false}}
function hasNewRequestData(draft){return !!(draft&&(draft.search||Object.keys(draft.quantities||{}).length))}
function hasBulkData(draft){return !!(draft&&(draft.source||draft.expiry||draft.qty||draft.note||(draft.selected||[]).length||(draft.replacements||[]).some(function(r){return r.name||r.concentration||r.expiry||r.lot||Number(r.qty)!==1})))}
function persist(){var active=document.querySelector('.pg.on'),id=active&&active.id;if(id==='pg-newreq'){var d=captureNewRequest();if(hasNewRequestData(d)){write('newreq',d);dirty.newreq=true}else if(dirty.newreq)clear('newreq')}else if(id==='pg-crash-ops'){var b=captureBulk();if(hasBulkData(b)){write('bulk',b);dirty.bulk=true}else if(dirty.bulk)clear('bulk')}}
var previousPersist=window.persistTransientUiState,previousRestore=window.restorePageTransientUi;
window.persistTransientUiState=function(){if(typeof previousPersist==='function')previousPersist();persist()};
window.restorePageTransientUi=function(id){if(typeof previousRestore==='function')previousRestore(id);setTimeout(function(){if(id==='pg-newreq')restoreNewRequest(read('newreq'));if(id==='pg-crash-ops')restoreBulk(read('bulk'))},0)};
document.addEventListener('input',function(event){if(restoring)return;var page=event.target.closest&&event.target.closest('.pg');if(!page)return;if(page.id==='pg-newreq'){dirty.newreq=true}else if(page.id==='pg-crash-ops'){dirty.bulk=true}else return;clearTimeout(timer);timer=setTimeout(persist,120)});
document.addEventListener('change',function(event){if(restoring)return;var page=event.target.closest&&event.target.closest('.pg');if(page&&(page.id==='pg-newreq'||page.id==='pg-crash-ops')){dirty[page.id==='pg-newreq'?'newreq':'bulk']=true;persist()}});
window.addEventListener('beforeunload',persist);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')persist()});
window.floorstockShouldProtectAutoRefresh=function(pageId){var type=pageId==='pg-newreq'?'newreq':pageId==='pg-crash-ops'?'bulk':'';if(!type||!dirty[type])return false;persist();notice('Unsaved form protected from automatic refresh / تم حماية البيانات غير المرسلة من التحديث التلقائي');return true};
var originalRefresh=window.refreshCurrentPage;
if(typeof originalRefresh==='function')window.refreshCurrentPage=function(){var active=document.querySelector('.pg.on'),type=active&&active.id==='pg-newreq'?'newreq':active&&active.id==='pg-crash-ops'?'bulk':'';if(type&&dirty[type]){persist();notice('Unsaved form protected from automatic refresh / تم حماية البيانات غير المرسلة من التحديث التلقائي');return}return originalRefresh.apply(this,arguments)};
var originalSubmit=window.submitReq;if(typeof originalSubmit==='function')window.submitReq=async function(){var before=(typeof gr==='function'?(gr()||[]):[]).length,result=await originalSubmit.apply(this,arguments),after=(typeof gr==='function'?(gr()||[]):[]).length;if(after>before)clear('newreq');return result};
var originalBulk=window.r17CrashExecuteBulk;if(typeof originalBulk==='function')window.r17CrashExecuteBulk=async function(){var before=(typeof crashReports==='function'?(crashReports()||[]):[]).length,result=await originalBulk.apply(this,arguments),after=(typeof crashReports==='function'?(crashReports()||[]):[]).length;if(after>before)clear('bulk');return result};
var originalClose=window.crashCloseReport;if(typeof originalClose==='function')window.crashCloseReport=function(reportId){var result=originalClose.apply(this,arguments);setTimeout(function(){var report=(typeof crashReports==='function'?(crashReports()||[]):[]).find(function(r){return String(r.id)===String(reportId)});if(!report||!report.inventoryDeductedAtReport)return;document.querySelectorAll('#ccc-items tr').forEach(function(row){var action=row.querySelector('.ccc-action'),source=row.querySelector('.ccc-source-exp');if(action){action.value='add';action.disabled=true}if(source){source.value='';source.disabled=true}});var box=E('ccc-validation');if(box)box.insertAdjacentHTML('beforebegin','<div class="alert-banner-y">Reported quantities were already deducted when the department submitted the report. This step adds replacements only. / تم خصم الكميات عند إرسال البلاغ، وهذه الخطوة للتعويض فقط.</div>');if(typeof window.ccCrashResponsePreview==='function')window.ccCrashResponsePreview()},0);return result};
window.clearFloorstockFormDraft=function(type){clear(type)};
})();

export {};

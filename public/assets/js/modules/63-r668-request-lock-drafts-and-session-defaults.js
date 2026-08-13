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
var previousCountWarning=window.refreshRequestCountLimitWarning;
window.refreshRequestCountLimitWarning=function(){
  // Always remove legacy warning first to prevent position drift between
  // two separate insertions before #rfbody.
  removeLegacyBlockingWarnings();
  var result=typeof previousCountWarning==='function'?previousCountWarning.apply(this,arguments):undefined;
  applyNewRequestGate();
  return result;
};
var previousScheduleMessage=window.refreshRequestScheduleMessage;
window.refreshRequestScheduleMessage=function(){
  var result=typeof previousScheduleMessage==='function'?previousScheduleMessage.apply(this,arguments):undefined;
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

export {};

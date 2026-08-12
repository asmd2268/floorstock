(function(){
'use strict';
var E=window.fsE;
var esc=window.fsEsc;
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function nowISO(){return window.fsNowISO?window.fsNowISO():new Date().toISOString()}

/* ══════════════════════════════════════════════════════════════
   2. New Request: idle timer 15 دقيقة
   - يبدأ العد عند أول تعامل مع الصفحة
   - يُعاد العد عند أي إدخال في الصفحة (input / change / click داخل rfbody)
   - لا يُمسح عند تحريك الماوس فقط
   - عند مرور 15 دقيقة تُحفظ المسودة تلقائيًا ولا تُمسح البيانات
══════════════════════════════════════════════════════════════ */
var IDLE_MS = 15 * 60 * 1000;   /* 15 دقيقة */
var _idleTimer=null, _warnEl=null;

function clearIdleTimers(){
  clearTimeout(_idleTimer);
  if(_warnEl){_warnEl.remove();_warnEl=null;}
}
function resetIdleTimer(){
  if(role()!=='department')return;
  clearIdleTimers();
  _idleTimer=setTimeout(function(){showIdleSavedNotice()}, IDLE_MS);
}
function showIdleSavedNotice(){
  var host=E('rfbody');if(!host)return;
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
  if(_warnEl){_warnEl.remove();}
  _warnEl=document.createElement('div');
  _warnEl.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:20000;background:#1d4ed8;color:#fff;padding:14px 24px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 4px 20px #0006;text-align:center';
  _warnEl.innerHTML='<div dir="rtl">💾 تم حفظ مسودة الطلب تلقائيًا، ولن تُمسح بسبب عدم التفاعل.</div><div dir="ltr">The request draft was saved automatically and will not be cleared because of inactivity.</div>';
  document.body.appendChild(_warnEl);
  setTimeout(function(){if(_warnEl){_warnEl.remove();_warnEl=null}resetIdleTimer()},5000);
}

/* ربط الأحداث بصفحة الطلب فقط */
function attachIdleListeners(){
  var host=E('rfbody');if(!host||host._v14IdleAttached)return;
  host._v14IdleAttached=true;
  ['input','change','click'].forEach(function(ev){
    host.addEventListener(ev,function(){resetIdleTimer()},{passive:true});
  });
  resetIdleTimer();
}
window.refreshRequestIdleTimer=function(){clearIdleTimers();attachIdleListeners()};
window.clearRequestIdleTimer=clearIdleTimers;

/* ══════════════════════════════════════════════════════════════
   Request Count Limits — rolling 24 hours and rolling 7 days
══════════════════════════════════════════════════════════════ */
var REQUEST_COUNT_LIMITS_KEY='request_count_limits_v1';
function requestLimitNumber(value){value=Number(value);return isFinite(value)&&value>0?Math.floor(value):null}
function getRequestCountLimits(){
  var current=(window.S&&S.g?S.g(REQUEST_COUNT_LIMITS_KEY):null)||{};
  var weekly=(window.S&&S.g?S.g('weekly_limits_v2'):null)||{};
  var daily=(window.S&&S.g?S.g('daily_limits_v2'):null)||{};
  var result={};
  Object.keys(current).forEach(function(id){
    var row=current[id]||{};
    result[id]={per24Hours:requestLimitNumber(row.per24Hours),per7Days:requestLimitNumber(row.per7Days)};
  });
  Object.keys(daily).forEach(function(id){
    result[id]=result[id]||{};
    if(!result[id].per24Hours)result[id].per24Hours=requestLimitNumber(daily[id]);
  });
  Object.keys(weekly).forEach(function(id){
    result[id]=result[id]||{};
    if(!result[id].per7Days)result[id].per7Days=requestLimitNumber(weekly[id]);
  });
  return result;
}
async function migrateRequestCountLimits(){
  if(!window.S||typeof S.s!=='function')return getRequestCountLimits();
  var merged=getRequestCountLimits();
  await S.s(REQUEST_COUNT_LIMITS_KEY,merged);
  if(typeof S.rm==='function'){
    await Promise.all([
      S.rm('weekly_limits_v2'),
      S.rm('daily_limits_v2'),
      S.rm('rate_limits_v2')
    ]);
  }
  return merged;
}
function requestCreatedTime(request){
  var value=request&&(request.created||request.createdAt||request.submittedAt);
  var time=new Date(value||0).getTime();
  return isFinite(time)?time:0;
}
function getRollingRequestCount(deptId,milliseconds){
  var threshold=Date.now()-milliseconds;
  return (typeof gr==='function'?(gr()||[]):[]).filter(function(request){
    return String(request.deptId)===String(deptId)&&requestCreatedTime(request)>=threshold;
  }).length;
}
window.getRequestCountLimits=getRequestCountLimits;
window.getRollingRequestCount=getRollingRequestCount;
window.checkRequestCountLimits=function(deptId){
  var limits=getRequestCountLimits()[deptId]||{};
  var used24=getRollingRequestCount(deptId,24*60*60*1000);
  var used7=getRollingRequestCount(deptId,7*24*60*60*1000);
  var limit24=requestLimitNumber(limits.per24Hours);
  var limit7=requestLimitNumber(limits.per7Days);
  if(limit24&&used24>=limit24){
    return {blocked:true,period:'24h',used:used24,limit:limit24,reason:'وصلت إلى الحد الأعلى المسموح للطلبات خلال 24 ساعة. إذا كنت قد رفعت طلبًا سابقًا، يمكنك تعديله قبل إغلاق نافذة الطلب.\nYou have reached the maximum number of requests allowed within 24 hours. If you previously submitted a request, you can edit it before the request window closes.'};
  }
  if(limit7&&used7>=limit7){
    return {blocked:true,period:'7d',used:used7,limit:limit7,reason:'وصلت إلى الحد الأعلى المسموح للطلبات خلال آخر 7 أيام. إذا كنت قد رفعت طلبًا سابقًا، يمكنك تعديله قبل إغلاق نافذة الطلب.\nYou have reached the maximum number of requests allowed during the last 7 days. If you previously submitted a request, you can edit it before the request window closes.'};
  }
  return {
    blocked:false,
    used24:used24,limit24:limit24,remaining24:limit24?Math.max(0,limit24-used24):null,
    used7:used7,limit7:limit7,remaining7:limit7?Math.max(0,limit7-used7):null
  };
};
window.renderRequestCountLimitsSection=function(){
  var host=E('pg-schedule');if(!host)return;
  ['v14-weekly-limits-section','v14-daily-limits-section','r18-request-count-limits-section'].forEach(function(id){var old=E(id);if(old)old.remove()});
  var limits=getRequestCountLimits();
  var rows=(typeof gd==='function'?(gd()||[]):[]).map(function(department){
    var row=limits[department.id]||{};
    var used24=getRollingRequestCount(department.id,24*60*60*1000);
    var used7=getRollingRequestCount(department.id,7*24*60*60*1000);
    var max24=requestLimitNumber(row.per24Hours),max7=requestLimitNumber(row.per7Days);
    return '<tr>'+ 
      '<td style="font-weight:600">'+esc(department.name||department.id)+'</td>'+ 
      '<td><input type="number" class="r18-limit-24" data-dept="'+esc(department.id)+'" min="1" value="'+(max24||'')+'" placeholder="∞" style="width:95px;margin:0;padding:5px 7px"></td>'+ 
      '<td style="font-family:var(--mono)">'+used24+'</td>'+ 
      '<td style="font-family:var(--mono);font-weight:700">'+(max24?Math.max(0,max24-used24):'∞')+'</td>'+ 
      '<td><input type="number" class="r18-limit-7" data-dept="'+esc(department.id)+'" min="1" value="'+(max7||'')+'" placeholder="∞" style="width:95px;margin:0;padding:5px 7px"></td>'+ 
      '<td style="font-family:var(--mono)">'+used7+'</td>'+ 
      '<td style="font-family:var(--mono);font-weight:700">'+(max7?Math.max(0,max7-used7):'∞')+'</td>'+ 
    '</tr>';
  }).join('');
  var section=document.createElement('div');
  section.id='r18-request-count-limits-section';
  section.innerHTML='<div class="card" style="margin-top:18px">'+
    '<div class="ch"><div><span class="ct">Request Count Limits / حدود عدد الطلبيات</span><div class="fhint">Rolling windows: the previous 24 hours and previous 7 × 24 hours. Leave blank for unlimited.</div></div><button class="btn bs bsm" type="button" onclick="saveRequestCountLimits()">Save / حفظ</button></div>'+ 
    '<div class="cb"><div class="tw"><table><thead><tr>'+ 
      '<th>Department</th><th>Max / 24h</th><th>Used / 24h</th><th>Remaining</th>'+ 
      '<th>Max / 7 days</th><th>Used / 7d</th><th>Remaining</th>'+ 
    '</tr></thead><tbody>'+rows+'</tbody></table></div></div></div>';
  host.appendChild(section);
  /* Rendering Schedule is read-only; legacy values are merged in memory without permission-triggering writes. */
};
window.saveRequestCountLimits=async function(){
  var result={};
  document.querySelectorAll('.r18-limit-24,.r18-limit-7').forEach(function(input){
    var id=input.dataset.dept;
    result[id]=result[id]||{};
    var value=requestLimitNumber(input.value);
    if(input.classList.contains('r18-limit-24')&&value)result[id].per24Hours=value;
    if(input.classList.contains('r18-limit-7')&&value)result[id].per7Days=value;
  });
  Object.keys(result).forEach(function(id){if(!result[id].per24Hours&&!result[id].per7Days)delete result[id]});
  try{
    await S.s(REQUEST_COUNT_LIMITS_KEY,result);
    if(typeof toast==='function')toast('24-hour and 7-day limits saved ✓','succ');
    if(typeof renderSchedule==='function')renderSchedule();
  }catch(error){
    console.error(error);
    if(typeof toast==='function')toast('Request count limits were not saved.','err');
  }
};
window.refreshRequestCountLimitWarning=function(){
  if(!window.CU||role()!=='department')return;
  var old=E('r18-request-limit-warning');if(old)old.remove();
  var host=E('rfbody');if(!host)return;
  var check=window.checkRequestCountLimits(CU.deptId);
  if(!check.blocked&&!check.limit24&&!check.limit7)return;
  var warning=document.createElement('div');
  warning.id='r18-request-limit-warning';
  warning.className='r18-request-limit-warn'+(check.blocked?' blocked':'');
  if(check.blocked)warning.textContent='🚫 '+check.reason;
  else{
    var parts=[];
    if(check.limit24)parts.push('24h: '+check.used24+'/'+check.limit24+' · remaining '+check.remaining24);
    if(check.limit7)parts.push('7d: '+check.used7+'/'+check.limit7+' · remaining '+check.remaining7);
    var arParts=[];
    if(check.limit24)arParts.push('خلال 24 ساعة: '+check.used24+' من '+check.limit24+' · المتبقي '+check.remaining24);
    if(check.limit7)arParts.push('خلال 7 أيام: '+check.used7+' من '+check.limit7+' · المتبقي '+check.remaining7);
    warning.textContent='📋 '+arParts.join(' | ')+'\n'+parts.join(' | ');
  }
  host.insertAdjacentElement('beforebegin',warning);
};

/* Compatibility entry point: request editing now has one authoritative policy.
   Pending requests are editable only while the department ordering window is open. */
window.opsEditRequest=function(id){
  if(typeof window.v16EditRequest==='function')return window.v16EditRequest(id);
  return typeof toast==='function'?toast('Request editing is not available yet. Please reopen My Requests.','err'):null;
};
window.v14SaveEditReq2=function(){
  return typeof toast==='function'?toast('This legacy editor has been retired. Reopen the request from My Requests.','err'):null;
};



})();

export {};

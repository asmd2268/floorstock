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

// --- Merged from 04-v13-complete-clean-fix-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function classIcons(m){var h='<span class="v13-class-icons">';if(m&&m.high_alert)h+='<span class="v13-ci v13-ha" title="High Alert">HA</span>';if(m&&m.lasa)h+='<span class="v13-ci v13-lasa" title="LASA">LASA</span>';if(m&&m.refrigerated)h+='<span class="v13-ci v13-ref" title="Refrigerator">❄</span>';if(m&&m.hazard)h+='<span class="v13-ci v13-haz" title="Hazard">⚠</span>';return h+'</span>'}

window.receiveFulfilledRequest=function(id){var req=(typeof gr==='function'?gr():[]).find(function(x){return x.id===id});if(!req||!window.CU||req.deptId!==CU.deptId)return toast('Request not available','err');E('v13-receive-modal').dataset.requestId=String(id);var meds=getMeds(CU.deptId),rows=(req.dispensed||[]).filter(function(x){return Number(x.qty)>0}).map(function(d,i){var m=meds.find(function(x){return x.id===d.medId})||{};return '<tr data-med="'+d.medId+'" data-qty="'+Number(d.qty||0)+'"><td>'+(i+1)+'</td><td><b>'+esc(m.name||d.medId)+'</b>'+classIcons(m)+'</td><td>'+Number(d.qty||0)+'</td><td><input class="v13-r-exp" type="date"></td><td><input class="v13-r-lot" placeholder="Optional"></td></tr>'}).join('');E('v13-receive-meta').textContent='Request '+id+' — enter all expiry dates and batch numbers, then confirm once.';E('v13-receive-body').innerHTML=rows||'<tr><td colspan="5">No dispensed items</td></tr>';OM('v13-receive-modal')};
})();


// --- Merged from 36-v14dp-main.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
const esc=globalThis.esc;
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}

/* ══════════════════════════════════════════════════════════════
   2. صفحة الطباعة: عزل Fulfilled
   - الطلبات المكتملة (fulfilled) تعلو الجدول بتمييز أخضر
   - زر فلتر: الكل / Fulfilled فقط / اليوم
   - نسخ renderPrint
══════════════════════════════════════════════════════════════ */
var _v14PrintFilter='today'; /* default for all print users: fulfilled today */

window.renderPrint=function(){
  /* أصل renderPrint */
  var purgeBtn=E('purge-old-orders-btn');
  if(purgeBtn)purgeBtn.style.display=(window.CU&&CU.master===true)?'inline-flex':'none';

  var allReqs=(typeof gr==='function'?gr():[]).slice().reverse();
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();allReqs=allReqs.filter(function(r){return String(r.deptId)===String(opd)})}
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();allReqs=allReqs.filter(function(r){return String(r.deptId)===String(opd)})}
  var fulfilled=allReqs.filter(function(r){return r.status==='fulfilled'||r.status==='partial'}).sort(function(a,b){return new Date(b.fulfilledAt||b.created||0)-new Date(a.fulfilledAt||a.created||0)});
  var pending=allReqs.filter(function(r){return r.status==='pending'}).sort(function(a,b){return new Date(b.created||0)-new Date(a.created||0)});

  var today=new Date().toISOString().slice(0,10);

  /* بناء صفوف الجدول */
  function buildRow(r,cls){
    var dept=(typeof gd==='function'?gd():[]).find(function(x){return x.id===r.deptId});
    var nn=(r.dispensed||[]).filter(function(x){return x.qty>0}).length;
    var date=typeof fmtDateTime==='function'?fmtDateTime(r.created):r.created;
    var ful=r.fulfilledAt?(typeof fmtDate==='function'?fmtDate(r.fulfilledAt):r.fulfilledAt):'—';
    return '<tr class="'+cls+'">'
      +'<td><input type="checkbox" class="pchk" data-id="'+esc(r.id)+'"></td>'
      +'<td>'+esc((dept&&dept.name)||r.deptId)+'</td>'
      +'<td>'+esc(date)+'</td>'
      +'<td>'+esc(ful)+'</td>'
      +'<td>'+nn+' items</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(r.printCount||0)+'</td>'
      +'</tr>';
  }

  var fRows='',pRows='';
  var todayFulfilled=fulfilled.filter(function(r){return (r.fulfilledAt||r.created||'').slice(0,10)===today});

  if(_v14PrintFilter==='today'){
    fRows=todayFulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else if(_v14PrintFilter==='fulfilled'){
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else {
    /* all: fulfilled أولاً ثم pending */
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
    pRows=pending.map(function(r){return buildRow(r,'v14-ptbl-pending')}).join('');
  }

  var tbl=E('ptbl');
  if(!tbl)return;

  /* إضافة شريط الفلتر فوق الجدول */
  var card=tbl.closest('.card');
  if(card){
    var existFilter=E('v14-print-filter');
    if(!existFilter){
      var filterBar=document.createElement('div');filterBar.id='v14-print-filter';
      filterBar.innerHTML=
        '<span style="font-size:12px;font-weight:700;color:var(--tx2)">Show:</span>'
        +'<button class="btn bg bsm" id="v14-pf-fulfilled" onclick="v14SetPrintFilter(\'fulfilled\')">✅ Fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-today" onclick="v14SetPrintFilter(\'today\')">📅 Today\'s fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-all" onclick="v14SetPrintFilter(\'all\')">All requests</button>'
        +'<span style="font-size:11px;color:var(--tx2);margin-inline-start:8px">'
        +'✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length
        +'</span>';
      card.querySelector('.ch').insertAdjacentElement('afterend',filterBar);
    } else {
      /* حدّث الأرقام */
      var stat=existFilter.querySelector('span:last-child');
      if(stat)stat.textContent='✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length;
    }
    /* أضء الزر النشط */
    ['fulfilled','today','all'].forEach(function(f){
      var btn=E('v14-pf-'+f);if(!btn)return;
      btn.classList.toggle('on',f===_v14PrintFilter);
    });
  }

  /* بناء الـ tbody */
  if(fRows||pRows){
    tbl.innerHTML=
      (fRows?'<tr id="v14-ptbl-fulfilled-head"><td colspan="6">✅ Fulfilled Requests</td></tr>'+fRows:'')
      +(pRows?'<tr id="v14-ptbl-pending-head" style="background:var(--s2)"><td colspan="6" style="padding:6px 10px;font-weight:800;font-size:12px;color:var(--tx2)">⏳ Pending Requests</td></tr>'+pRows:'');
  } else {
    tbl.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx2);padding:18px">No requests found</td></tr>';
  }
};

window.v14SetPrintFilter=function(f){
  _v14PrintFilter=f;
  if(typeof window.renderPrint==='function')window.renderPrint();
};


})();

export {};

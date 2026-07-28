(function(){
'use strict';
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function nowISO(){return window.fsNowISO?window.fsNowISO():new Date().toISOString()}

/* ══════════════════════════════════════════════════════════════
   2. New Request: idle timer 15 دقيقة
   - يبدأ العد عند أول تعامل مع الصفحة
   - يُعاد العد عند أي إدخال في الصفحة (input / change / click داخل rfbody)
   - لا يُمسح عند تحريك الماوس فقط
   - عند انتهاء 15 دقيقة تظهر رسالة تحذير 60 ثانية ثم تُمسح القائمة
══════════════════════════════════════════════════════════════ */
var IDLE_MS = 15 * 60 * 1000;   /* 15 دقيقة */
var WARN_MS = 60 * 1000;        /* 60 ثانية تحذير */
var _idleTimer=null, _warnTimer=null, _warnEl=null;

function clearIdleTimers(){
  clearTimeout(_idleTimer);clearTimeout(_warnTimer);
  if(_warnEl){_warnEl.remove();_warnEl=null;}
}
function resetIdleTimer(){
  if(role()!=='department')return;
  clearIdleTimers();
  _idleTimer=setTimeout(function(){showIdleWarning()}, IDLE_MS - WARN_MS);
}
function showIdleWarning(){
  var host=E('rfbody');if(!host)return;
  if(_warnEl){_warnEl.remove();}
  _warnEl=document.createElement('div');
  _warnEl.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:20000;background:#dc2626;color:#fff;padding:14px 24px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 4px 20px #0006;text-align:center';
  var secs=60;
  function tick(){_warnEl.innerHTML='⚠ سيُمسح الطلب خلال <b>'+secs+'</b> ثانية بسبب عدم التفاعل<br><button style="margin-top:8px;padding:5px 18px;border-radius:8px;border:2px solid #fff;background:transparent;color:#fff;font-weight:700;cursor:pointer;font-size:13px" id="v14-idle-keep">إبقاء الطلب</button>';var btn=document.getElementById('v14-idle-keep');if(btn)btn.onclick=function(){resetIdleTimer()}}
  tick();
  document.body.appendChild(_warnEl);
  _warnTimer=setInterval(function(){
    secs--;
    if(secs<=0){
      clearIdleTimers();
      /* مسح الحقول */
      document.querySelectorAll('#rfbody .rqi').forEach(function(i){i.value='';});
      if(typeof cntItems==='function')cntItems();
      if(typeof toast==='function')toast('تم مسح الطلب بسبب عدم التفاعل لمدة 15 دقيقة','info');
    } else tick();
  },1000);
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
    return {blocked:true,period:'24h',used:used24,limit:limit24,reason:'تم الوصول إلى الحد المسموح خلال 24 ساعة: '+used24+' من '+limit24+' طلبات.'};
  }
  if(limit7&&used7>=limit7){
    return {blocked:true,period:'7d',used:used7,limit:limit7,reason:'تم الوصول إلى الحد الأسبوعي: '+used7+' من '+limit7+' طلبات خلال آخر 7 أيام.'};
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
  migrateRequestCountLimits().catch(function(error){console.warn('Request-limit migration failed',error)});
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
    if(typeof S.rm==='function')await Promise.all([S.rm('weekly_limits_v2'),S.rm('daily_limits_v2'),S.rm('rate_limits_v2')]);
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
    warning.textContent='📋 '+parts.join(' | ');
  }
  host.insertAdjacentElement('beforebegin',warning);
};

/* ══════════════════════════════════════════════════════════════
   5. تعديل الطلب: إضافة بنود جديدة + تصفير كمية
   - opsEditRequest يُظهر كل أدوية القسم (موجودة + جديدة)
   - الأدوية اللي لم تُطلب تظهر بكمية 0 (يمكن إضافتها)
   - يقدر يضع كمية = 0 لإلغاء بند (يُحذف من الطلب)
══════════════════════════════════════════════════════════════ */
window.opsEditRequest=function(id){
  var reqs=typeof gr==='function'?(gr()||[]):[];
  var req=reqs.find(function(x){return String(x.id)===String(id)});
  if(!req)return typeof toast==='function'?toast('Request not found','err'):null;
  var t=new Date(req.created||req.createdAt||0).getTime();
  var editable=req.status==='pending'&&isFinite(t)&&(Date.now()-t<=7200000);
  if(!editable)return typeof toast==='function'?toast('Edit window closed (2 hours) or request already fulfilled.','err'):null;

  var meds=typeof getMeds==='function'?(getMeds(req.deptId)||[]):[];
  var dispensed=req.items||req.dispensed||[];
  var dispMap={};dispensed.forEach(function(x){dispMap[x.medId]=n(x.qty)});

  var minsLeft=Math.ceil((7200000-(Date.now()-t))/60000);

  /* جميع أدوية القسم */
  var rows=meds.map(function(m){
    var cur=dispMap[m.id]!=null?dispMap[m.id]:0;
    var max=Math.max(0,n(m.max));
    var isNew=dispMap[m.id]==null;
    return '<tr class="'+(isNew?'v14-add-med-row':'')+'">'
      +'<td><b>'+esc(m.name)+'</b>'+(isNew?' <span style="font-size:10px;background:var(--pri);color:#fff;padding:1px 5px;border-radius:8px">new</span>':'')+'</td>'
      +'<td style="text-align:center;color:var(--tx2)">'+n(m.min)+' – '+max+'</td>'
      +'<td><div class="qwrap"><input type="number" class="rqi ops-edit-qty" data-med="'+esc(m.id)+'" data-max="'+max+'" min="0" max="'+max+'" value="'+cur+'" style="margin:0" oninput="this.value=Math.min(Math.max(0,+this.value||0),+this.dataset.max)">'
      +'<span class="qlim">/'+max+'</span></div></td>'
      +'</tr>';
  }).join('');

  var old=E('ops-edit-request');if(old)old.remove();
  var m=document.createElement('div');m.id='ops-edit-request';m.className='modal-bg on';
  m.innerHTML='<div class="modal" style="width:min(820px,97vw)">'
    +'<div class="mh"><span class="mt">Edit Request — '+minsLeft+' min left</span>'
    +'<button class="xbtn" onclick="document.getElementById(\'ops-edit-request\').remove()">✕</button></div>'
    +'<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">كمية = 0 تلغي البند من الطلب. الصفوف الخضراء خفيفة = أدوية جديدة يمكن إضافتها.</div>'
    +'<div class="tw" style="overflow:auto;max-height:60vh"><table>'
    +'<thead><tr><th>Medication</th><th>Min – Max</th><th>Qty</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div>'
    +'<input type="hidden" id="v14-er2-reqid" value="'+esc(id)+'">'
    +'<div class="fl g8" style="justify-content:flex-end;margin-top:14px">'
    +'<button class="btn bg" onclick="document.getElementById(\'ops-edit-request\').remove()">Cancel</button>'
    +'<button class="btn bs" onclick="v14SaveEditReq2()">Save changes / حفظ التعديلات</button>'
    +'</div></div>';
  document.body.appendChild(m);
};

window.v14SaveEditReq2=async function(){
  var reqId=(E('v14-er2-reqid')||{}).value;
  var all=typeof gr==='function'?(gr()||[]).slice():[];
  var idx=all.findIndex(function(x){return String(x.id)===String(reqId)});
  if(idx<0)return typeof toast==='function'?toast('Request not found','err'):null;
  var req=all[idx];
  var t=new Date(req.created||req.createdAt||0).getTime();
  if(req.status!=='pending'||Date.now()-t>7200000)
    return typeof toast==='function'?toast('Edit window closed.','err'):null;

  var items=Array.from(document.querySelectorAll('.ops-edit-qty')).map(function(inp){
    return {medId:inp.dataset.med,qty:n(inp.value)};
  }).filter(function(x){return x.qty>0}); /* 0 يُحذف */

  if(!items.length)return typeof toast==='function'?toast('At least one item with qty > 0 is required.','err'):null;
  all[idx]=Object.assign({},req,{items:items,dispensed:items,editedAt:nowISO(),editedBy:(window.CU&&CU.username)||''});
  await (window.S&&S.s?S.s('requests',all):Promise.resolve());
  if(typeof auditAction==='function')auditAction('request_edited_within_two_hours',{requestId:reqId,itemCount:items.length});
  E('ops-edit-request').remove();
  if(typeof toast==='function')toast('Request updated ✓','succ');
  if(typeof renderMyReqs==='function')renderMyReqs();
  if(typeof renderReqs==='function')renderReqs();
};


})();

export {};

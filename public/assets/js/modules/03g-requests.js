import { publishLegacy } from '../core/legacy-registry.js';
import {
  FULFILLMENT_EDIT_SETTINGS_KEY,
  canEditFulfillment,
  fulfillmentEditReason,
} from '../core/fulfillment-edit-policy.js';

// ── REQUESTS / DEPT REQUEST FORM / MY REQUESTS ──────────────────────────
// Split out of 03-core-application-firebase-state-auth.js (Phase 3 module
// split). Everything else referenced here that isn't declared in this file
// (S, CU, esc, gd, toast, el, fmtDateTime, uiDialog helpers, OM,
// getNextDispSlot, window.fsEffectiveUser) is already published to
// globalThis by its owning module.
globalThis.RFS = 'all';
function filterR(s,btn){
  RFS=s;document.querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('on')});btn.classList.add('on');renderReqs();
}
function renderReqs(){
  var purgeReqBtn=el('purge-old-requests-btn');if(purgeReqBtn)purgeReqBtn.style.display=(CU&&CU.master===true)?'inline-flex':'none';
  var rs=gr().slice().reverse();
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();rs=rs.filter(function(r){return String(r.deptId)===String(opd)})}
  if(typeof window.fsCanAccessDepartment==='function')rs=rs.filter(function(r){return window.fsCanAccessDepartment(r.deptId)})
  if(RFS!=='all')rs=rs.filter(function(r){return r.status===RFS});
  el('rlist').innerHTML=rs.length?rs.map(function(r){return rcard(r,true)}).join('')
    :'<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📋</div><div style="margin-top:10px">No requests</div></div>';

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
  if(typeof window.renderFulfillmentEditSettings==='function')window.renderFulfillmentEditSettings();
  injectReqTabBar('pg-reqs');
}
function injectReqTabBar(activePg){
  var pg=document.getElementById(activePg);
  if(!pg||pg.querySelector('.req-tab-bar'))return;
  var role=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
  var canSeeSchedule=['pharmacy','inpatient_supervisor'].indexOf(role)>=0;
  if(!canSeeSchedule&&activePg==='pg-reqs')return;
  var bar=document.createElement('div');bar.className='req-tab-bar';
  bar.style.cssText='display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap';
  var tabs=[['pg-reqs','📋 Requests']];
  if(canSeeSchedule)tabs.push(['pg-schedule','⏰ Schedule']);
  tabs.forEach(function(t){
    var on=t[0]===activePg;
    var b=document.createElement('button');b.className='btn '+(on?'bp':'bg')+' bsm';if(on)b.disabled=true;
    b.innerHTML=on?'<b>'+t[1]+'</b>':t[1];
    if(!on)b.onclick=function(){showPg(t[0])};
    bar.appendChild(b);
  });
  pg.insertBefore(bar,pg.firstChild);
}
window.injectReqTabBar=injectReqTabBar;
function installRequestActionBindings(){
  if(globalThis._requestActionBindingsInstalled)return;
  globalThis._requestActionBindingsInstalled=true;
  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest?event.target.closest('[data-request-action]'):null;
    if(!button)return;
    var action=button.dataset.requestAction||'',id=button.dataset.id||'';
    event.preventDefault();
    if(action==='fulfill'||action==='edit-fulfillment')return openFulfill(id);
    if(action==='view')return viewReq(id);
    if(action==='master-delete'&&typeof window.masterDeleteRequestNow==='function')return window.masterDeleteRequestNow(id);
    if(action==='receive'&&typeof window.receiveFulfilledRequest==='function')return window.receiveFulfilledRequest(id);
    if(action==='v16-edit'&&typeof window.v16EditRequest==='function')return window.v16EditRequest(id);
    if(action==='v16-delete'&&typeof window.v16DeleteRequest==='function')return window.v16DeleteRequest(id);
    if(action==='v16-confirm-delete'&&typeof window.v16ConfirmDelete==='function')return window.v16ConfirmDelete(id);
    if(action==='v16-save-edit'&&typeof window.v16SaveEdit==='function')return window.v16SaveEdit(id);
    if(action==='close-request-modal'){
      var modal=button.closest('.modal-bg');
      if(modal)modal.remove();
      return;
    }
    console.warn('Request action is unavailable:',action);
  });
}
installRequestActionBindings();
function rcard(r,isp){
  var d=gd().find(function(x){return x.id===r.deptId});
  var sm={pending:'byl',fulfilled:'bgn',partial:'bbl'};
  var mayEditFulfillment=typeof window.canEditFulfillmentRequest==='function'&&window.canEditFulfillmentRequest(r);
  var dName=(d&&d.name)||r.deptId;
  if(!isp){
    var dispInfo=r.status==='pending'?((r.items||[]).length+' items · Pending'):((r.items||[]).length+' items · '+(r.dispensed||[]).filter(function(i){return i.qty>0}).length+' dispensed');
    return '<div class="card" style="padding:8px 14px;display:flex;align-items:center;gap:8px;flex-wrap:nowrap;min-height:0">'
      +'<span class="badge '+(sm[r.status]||'bgr')+'" style="flex-shrink:0">'+r.status+'</span>'
      +'<span style="font-size:12px;color:var(--tx2);white-space:nowrap;flex-shrink:0">'+fmtDateTime(r.created)+'</span>'
      +'<span style="font-size:12px;color:var(--tx2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+dispInfo+'</span>'
      +'<div style="display:flex;gap:5px;flex-shrink:0">'
      +(r.status==='fulfilled'&&!r.receivedAt?'<button class="btn bs bsm" data-request-action="receive" data-id="'+r.id+'">Receive</button>':'')
      +'<button class="btn bg bsm" data-request-action="view" data-id="'+r.id+'">View</button></div>'
      +'</div>';
  }
  return '<div class="card" data-request-id="'+esc(r.id)+'"><div class="ch"><div class="fl ic g8"><span style="font-weight:600">'+dName+'</span><span class="badge '+(sm[r.status]||'bgr')+'">'+r.status+'</span></div>'
    +'<div class="fl g8 ic" data-request-actions><span style="font-size:12px;color:var(--tx2)">'+fmtDateTime(r.created)+'</span>'
    +(r.status==='pending'?'<button class="btn bp bsm" data-request-action="fulfill" data-id="'+r.id+'">Fulfill</button>':'')
    +(mayEditFulfillment?'<button class="btn bg bsm" data-request-action="edit-fulfillment" data-id="'+r.id+'">✏ Edit Fulfillment</button>':'')
    +(window.CU&&CU.master===true?'<button class="btn bd2c bsm" data-request-action="master-delete" data-id="'+r.id+'">Delete</button>':'')
    +'<button class="btn bg bsm" data-request-action="view" data-id="'+r.id+'">View</button></div></div>'
    +'<div style="padding:9px 18px;font-size:12px;color:var(--tx2)">'+(r.items||[]).length+' items'
    +(r.status!=='pending'?' &middot; '+(r.dispensed||[]).filter(function(i){return i.qty>0}).length+' dispensed on '+fmtDateTime(r.fulfilledAt):' &middot; Awaiting fulfillment')
    +(function(){var eff=effectiveRequestSchedule(r);return eff.scheduledFor?'<div style="margin-top:6px;color:var(--acl);font-weight:600">📅 Scheduled dispense: '+fmtDateTime(eff.scheduledFor)+(eff.scheduledLabel?' &middot; '+eff.scheduledLabel:'')+'</div>':'<div style="margin-top:6px">📅 Dispense time: Not scheduled yet</div>'})()
    +'</div></div>';
}
function viewReq(id){
  var r=gr().find(function(x){return x.id===id});if(!r)return;
  var d=gd().find(function(x){return x.id===r.deptId});
  el('vdname').textContent=(d&&d.name)||r.deptId;
  var ms=getMeds(r.deptId||'');
  el('vbody').innerHTML='<p style="font-size:12px;color:var(--tx2);margin-bottom:11px">Submitted: '+fmtDateTime(r.created)+'</p>'
    +'<div class="tw"><table><thead><tr><th style="text-align:center">#</th><th>Medication</th><th style="text-align:center">Requested</th><th style="text-align:center">Dispensed</th></tr></thead><tbody>'
    +(r.items||[]).map(function(it,index){
      var m=ms.find(function(x){return x.id===it.medId});
      var dsp=(r.dispensed||[]).find(function(x){return x.medId===it.medId});
      return '<tr><td style="text-align:center;font-family:var(--mono);font-weight:600">'+(index+1)+'</td><td>'+(m?m.name:it.medId)+'</td><td style="text-align:center;font-family:var(--mono)">'+it.qty+'</td><td style="text-align:center;font-family:var(--mono)">'+(dsp?dsp.qty:'&mdash;')+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  OM('mview');
}
function openFulfill(id){
  FRID=id;
  var r=gr().find(function(x){return x.id===id});if(!r)return;
  var isEdit=r.status==='fulfilled';
  if(isEdit){
    var profile=typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():(window.CU||{});
    var settings=S.g(FULFILLMENT_EDIT_SETTINGS_KEY);
    var reason=fulfillmentEditReason(r,profile,settings,Date.now());
    if(reason)return toast(reason,'err');
  }else{
    if(!canManageRequests())return toast('No request edit permission','err');
    var scheduleBlock=requestScheduledDispenseBlocked(r);
    if(scheduleBlock)return toast(scheduleBlock,'err');
  }
  var d=gd().find(function(x){return x.id===r.deptId});
  el('fulfill-title').textContent=(isEdit?'Edit Fulfillment':'Fulfill Request')+' — '+((d&&d.name)||r.deptId);
  el('fulfill-hint').textContent=isEdit?'Previous dispensed quantities are loaded. Change only the item you need, then save.':'Enter the dispensed quantity for every item. Enter 0 if not dispensed. Quantities may exceed Requested and departmental Max.';
  el('fulfill-btn').textContent=isEdit?'Update ✓':'Confirm ✓';
  var ms=getMeds(r.deptId||'');
  var thirtyDayCutoff=Date.now()-(30*24*60*60*1000);
  function dispensedLast30Days(medId){
    var result=gr().reduce(function(total,req){
      if(!req||req.id===r.id||req.deptId!==r.deptId)return total;
      if(req.status!=='fulfilled'&&req.status!=='partial')return total;
      var dt=new Date(req.fulfilledAt||req.updatedAt||req.created||0).getTime();
      if(!isFinite(dt)||dt<thirtyDayCutoff||dt>Date.now())return total;
      var line=(req.dispensed||[]).find(function(x){return x.medId===medId});
      if(line&&Number(line.qty)>0){total.qty+=Number(line.qty)||0;total.orders+=1}
      return total;
    },{qty:0,orders:0});
    result.average=result.orders?result.qty/result.orders:0;return result;
  }
  var previousDispensed={};
  if(isEdit)(r.dispensed||[]).forEach(function(x){previousDispensed[String(x.medId)]=x.qty});
  el('ftbl').innerHTML=(r.items||[]).map(function(it,index){
    var m=ms.find(function(x){return x.id===it.medId});
    var last30=dispensedLast30Days(it.medId);
    var rowBg=m&&m.high_alert?'background:rgba(218,54,51,.07)':m&&m.hazard?'background:rgba(210,153,34,.06)':'background:rgba(31,111,235,.04)';
    return '<tr style="'+rowBg+'"><td style="text-align:center;font-family:var(--mono);font-weight:600">'+(index+1)+'</td><td style="font-weight:500">'+(m?m.name:it.medId)+'</td><td>'+bdg(m)+'</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(m&&m.min!=null?m.min:'&mdash;')+'</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(m&&m.max!=null?m.max:'&mdash;')+'</td>'
      +'<td style="text-align:center"><span class="badge bbl" style="font-family:var(--mono);font-size:11px">'+last30.qty+' / '+last30.orders+' orders<br><small>avg '+(Math.round(last30.average*100)/100)+'/order</small></span></td>'
      +'<td style="text-align:center;font-family:var(--mono);font-weight:700">'+it.qty+'</td>'
      +'<td><input type="number" min="0" value="'+(Object.prototype.hasOwnProperty.call(previousDispensed,String(it.medId))?previousDispensed[String(it.medId)]:'')+'" placeholder="Enter qty" required data-med="'+it.medId+'" data-requested="'+it.qty+'" title="Any non-negative quantity is allowed, including more than Requested or departmental Max." style="width:100%;min-width:72px;padding:5px 7px;text-align:center;margin:0"></td></tr>';
  }).join('');
  Array.from(el('ftbl').querySelectorAll('input[data-med]')).forEach(function(inp){
    inp.addEventListener('input',function(){this.style.borderColor='';this.style.boxShadow=''});
  });
  OM('mfulfill');
}
// ── DEPT REQUEST FORM ────────────────────────────────────

function valQ(inp){
  var mx=+inp.dataset.max;
  if(+inp.value>mx){inp.value=mx;inp.style.borderColor='var(--rd)';toast('Max: '+mx,'err');setTimeout(function(){inp.style.borderColor=''},1400);}
  cntItems();
}
function cntItems(){
  var n=Array.from(document.querySelectorAll('.rqi')).filter(function(i){return +i.value>0}).length;
  var e=el('rcnt');if(e)e.textContent=n;
}
// ── MY REQUESTS ──────────────────────────────────────────
globalThis.MR_PERIOD='month';globalThis.MR_SEARCH='';
function mrPeriodCutoff(p){var n=new Date();if(p==='month')return new Date(n.getFullYear(),n.getMonth(),1).getTime();if(p==='quarter')return new Date(n.getFullYear(),Math.floor(n.getMonth()/3)*3,1).getTime();if(p==='year')return new Date(n.getFullYear(),0,1).getTime();return 0;}
window.mrSetPeriod=function(p,btn){MR_PERIOD=p;document.querySelectorAll('.mr-fbtn').forEach(function(b){b.classList.remove('on')});if(btn)btn.classList.add('on');renderMyReqs();};
window.mrSetSearch=function(v){MR_SEARCH=v;renderMyReqs();};
function renderMyReqs(){
  var scoped=typeof globalThis.scopeRequestsToDepartment==='function'?globalThis.scopeRequestsToDepartment(gr(),CU.deptId):gr().filter(function(r){return r.deptId===CU.deptId});
  var rs=scoped.slice().reverse();
  var cut=mrPeriodCutoff(MR_PERIOD);if(cut>0)rs=rs.filter(function(r){return new Date(r.created||0).getTime()>=cut;});
  if(MR_SEARCH){var q=MR_SEARCH.toLowerCase();rs=rs.filter(function(r){return r.status.toLowerCase().includes(q)||(r.items||[]).some(function(it){return String(it.medId||'').toLowerCase().includes(q);})});}
  var periods=[['month','📅 هذا الشهر / This Month'],['quarter','📊 هذا الربع / This Quarter'],['year','🗓 هذه السنة / This Year'],['all','📋 الكل / All']];
  var filterBar='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px">'
    +'<span style="font-size:12px;color:var(--tx2);white-space:nowrap">Show:</span>'
    +periods.map(function(pv){return '<button class="tbtn mr-fbtn'+(MR_PERIOD===pv[0]?' on':'')+'" onclick="mrSetPeriod(\''+pv[0]+'\',this)">'+pv[1]+'</button>';}).join('')
    +'</div>';
  var listHtml=rs.length?rs.map(function(r){return rcard(r,false)}).join('')
    :'<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📋</div><div style="margin:10px 0 4px;font-size:15px;font-weight:600;color:var(--tx)">No requests / لا توجد طلبات</div></div>';
  // Same reason as renderReqForm: a department session's state refreshes fire for
  // keys this page never reads, and a full innerHTML rebuild would drop focus and
  // the caret out of the search box mid-typing. Write only when the markup differs.
  var mrHost=el('mrlst'),mrHtml=filterBar+listHtml;
  if(mrHost&&mrHost.innerHTML!==mrHtml)mrHost.innerHTML=mrHtml;

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
  if(typeof window.enhanceRequests==='function')window.enhanceRequests();
}

window.canEditFulfillmentRequest=function(request,now){
  var profile=typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():(window.CU||{});
  return canEditFulfillment(request,profile,S.g(FULFILLMENT_EDIT_SETTINGS_KEY),now==null?Date.now():now);
};
// scheduledFor/scheduledLabel are frozen on the request at submission time.
// If the department's dispense-slot schedule changes afterward, a pending
// request must not keep pointing at a slot that no longer exists — recompute
// live from the CURRENT schedule for any request still pending; once it is
// no longer pending, the frozen value is the historical record and is
// returned unchanged.
function effectiveRequestSchedule(r){
  if(!r)return {scheduledFor:null,scheduledLabel:''};
  if(r.status!=='pending')return {scheduledFor:r.scheduledFor||null,scheduledLabel:r.scheduledLabel||''};
  var next=typeof getNextDispSlot==='function'?getNextDispSlot(r.deptId):null;
  return {scheduledFor:next?next.scheduledAt:null,scheduledLabel:next&&next.slot?next.slot.label:''};
}
window.effectiveRequestSchedule=effectiveRequestSchedule;
// A request with a computed dispensing slot may not be dispensed before that
// slot arrives, for anyone. Requests with no scheduledFor (ordering not
// scheduled for this department) are unaffected.
function requestScheduledDispenseBlocked(r,now){
  var effective=effectiveRequestSchedule(r);
  if(!effective.scheduledFor)return '';
  var scheduled=new Date(effective.scheduledFor).getTime();
  if(!isFinite(scheduled))return '';
  if((now==null?Date.now():now)>=scheduled)return '';
  var label=fmtDateTime(effective.scheduledFor)+(effective.scheduledLabel?' · '+effective.scheduledLabel:'');
  return 'لا يمكن صرف هذا الطلب قبل موعده المجدول: '+label+'\nThis request cannot be dispensed before its scheduled time: '+label;
}
window.requestScheduledDispenseBlocked=requestScheduledDispenseBlocked;





publishLegacy("03g-requests.js", {
  filterR,
  renderReqs,
  installRequestActionBindings,
  rcard,
  viewReq,
  openFulfill,
  valQ,
  cntItems,
  renderMyReqs,
});

export {};

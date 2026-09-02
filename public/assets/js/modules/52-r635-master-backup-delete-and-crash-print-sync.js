(function(){
'use strict';
function master(){try{return !!((window.CU&&CU.master===true)||(typeof isMasterActual==='function'&&isMasterActual())||(typeof masterOnly==='function'&&masterOnly()))}catch(e){return false}}
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v))}
function norm(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'')}
function uid(){return 'del_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
async function mandatoryBackup(kind,target){
  if(!master()){toast('Master permission required / الصلاحية للماستر فقط','err');throw new Error('Master permission required')}
  var ok=await uiConfirm('A complete backup must be created and downloaded before deleting this '+kind+'.\n\nيجب إنشاء وتنزيل نسخة احتياطية كاملة قبل الحذف.\n\nContinue?');
  if(!ok)throw new Error('Deletion cancelled');
  if(typeof window.masterCreateLocalBackup!=='function'||typeof window.masterDownloadLatestLocalBackup!=='function')throw new Error('Backup service is unavailable');
  var saved=await window.masterCreateLocalBackup(true);
  if(!saved)throw new Error('Backup creation failed');
  var downloaded=await window.masterDownloadLatestLocalBackup();
  if(!downloaded)throw new Error('Backup download failed');
  var token={id:uid(),kind:kind,target:String(target||''),createdAt:new Date().toISOString()};
  sessionStorage.setItem('r635_delete_backup_token',JSON.stringify(token));
  return token;
}
function consumeBackup(token,kind,target){
  var raw=sessionStorage.getItem('r635_delete_backup_token'),saved=null;try{saved=JSON.parse(raw||'null')}catch(e){}
  var valid=saved&&token&&saved.id===token.id&&saved.kind===kind&&saved.target===String(target||'')&&(Date.now()-new Date(saved.createdAt).getTime()<10*60*1000);
  sessionStorage.removeItem('r635_delete_backup_token');
  if(!valid)throw new Error('A new backup is required before deletion');
}
async function typedConfirm(label){
  var value=window.prompt('Permanent deletion / حذف نهائي\n\nType DELETE to permanently delete:\n'+label+'\n\nاكتب DELETE للتأكيد');
  return value==='DELETE';
}
async function removePublicCart(id){
  if(!window.FB_DB)return;
  var jobs=[
    (window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry')).doc('crash_'+id).delete(),
    FB_DB.collection('public_crash_carts').doc(String(id)).delete()
  ];
  await Promise.allSettled(jobs);
}
async function hardDeleteCrashCart(id,opts){
  opts=opts||{};
  var cart=(typeof crashCarts==='function'?crashCarts():[]).find(function(c){return String(c.id)===String(id)});
  if(!cart)throw new Error('Crash Cart was not found');
  var token=opts.backupToken||await mandatoryBackup('Crash Cart',id);
  if(!opts.skipTypedConfirm&&!(await typedConfirm(cart.name||id)))throw new Error('Deletion cancelled');
  consumeBackup(token,'Crash Cart',id);
  var carts=(crashCarts()||[]).filter(function(c){return String(c.id)!==String(id)});
  var reports=(typeof crashReports==='function'?crashReports():S.g('crash_cart_reports')||[]).filter(function(r){return String(r.cartId)!==String(id)});
  await setCrashCarts(carts);
  await (typeof setCrashReports==='function'?setCrashReports(reports):S.s('crash_cart_reports',reports));
  var nameMap=Object.assign({},S.g('crash_cart_medication_names_v1')||{});delete nameMap[id];await S.s('crash_cart_medication_names_v1',nameMap);
  await removePublicCart(id);
  if(typeof auditAction==='function')await auditAction('master_hard_delete_crash_cart',{cartId:id,cartName:cart.name||'',departmentId:cart.deptId||'',backupId:token.id,backupAt:token.createdAt});
  if(typeof renderCrashCarts==='function')renderCrashCarts();
  if(typeof renderCrashOperations==='function')renderCrashOperations();
  toast('Crash Cart deleted permanently from all active records ✓','succ');
  return true;
}
window.masterDeleteCrashCart=async function(id){try{return await hardDeleteCrashCart(id)}catch(e){if(String(e.message)!=='Deletion cancelled')toast(String(e.message||e),'err');return false}};

async function hardDeleteDepartment(id){
  if(!master())return toast('Master permission required / الصلاحية للماستر فقط','err');
  var dept=(typeof gd==='function'?gd():[]).find(function(d){return String(d.id)===String(id)});if(!dept)return toast('Department not found','err');
  var linkedUsers=(typeof gu==='function'?(gu()||[]):[]).filter(function(user){return [user&&user.deptId,user&&user.departmentId,user&&user.department].some(function(value){return String(value||'')===String(id)})});
  if(linkedUsers.length){
    toast('Reassign or delete '+linkedUsers.length+' linked user account(s) before deleting this department.','err');
    if(typeof showPg==='function')showPg('pg-users');
    return false
  }
  var token;try{token=await mandatoryBackup('department',id)}catch(e){if(String(e.message)!=='Deletion cancelled')toast(String(e.message||e),'err');return false}
  if(!(await typedConfirm(dept.name||id)))return false;
  try{
    consumeBackup(token,'department',id);
    var carts=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return String(c.deptId)===String(id)});
    var allCarts=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return String(c.deptId)!==String(id)});
    var cartIds=new Set(carts.map(function(c){return String(c.id)}));
    var reports=(typeof crashReports==='function'?crashReports():S.g('crash_cart_reports')||[]).filter(function(r){return String(r.deptId)!==String(id)&&!cartIds.has(String(r.cartId))});
    await setCrashCarts(allCarts);await (typeof setCrashReports==='function'?setCrashReports(reports):S.s('crash_cart_reports',reports));
    for(var i=0;i<carts.length;i++)await removePublicCart(carts[i].id);
    await S.s('requests',(S.g('requests')||[]).filter(function(x){return String(x.deptId||x.departmentId||x.dept)!==String(id)}));
    await S.s('request_analytics_archive',(S.g('request_analytics_archive')||[]).filter(function(x){return String(x.deptId||x.departmentId||x.dept)!==String(id)}));
    if(typeof window.floorstockPurgeDepartmentState==='function')await window.floorstockPurgeDepartmentState(id,[id,dept.name,dept.code].filter(Boolean),true);
    else await S.s('departments',(S.g('departments')||[]).filter(function(d){return String(d.id)!==String(id)}));
    if(typeof auditAction==='function')await auditAction('master_hard_delete_department',{departmentId:id,departmentName:dept.name||'',deletedCrashCarts:carts.map(function(c){return c.id}),backupId:token.id,backupAt:token.createdAt});
    if(typeof floorstockDeleteUiRefresh==='function')floorstockDeleteUiRefresh();
    if(typeof renderCrashCarts==='function')renderCrashCarts();
    toast('Department and all linked active records were deleted permanently ✓','succ');return true;
  }catch(e){console.error(e);toast('Deletion failed: '+String(e.message||e),'err');return false}
}
window.delDept=hardDeleteDepartment;

function decorate(){
  document.body.classList.toggle('master-mode',master());
  document.querySelectorAll('[onclick^="delDept("],[onclick*=" delDept("]').forEach(function(b){b.style.display=master()?'':'none';b.disabled=!master()});
  document.querySelectorAll('[id^="ccx-cart-"]').forEach(function(card){var id=card.id.replace('ccx-cart-',''),bar=card.querySelector('.ccx-toolbar-actions');if(!bar||bar.querySelector('.r635-delete-cart'))return;var b=document.createElement('button');b.type='button';b.className='btn bd2c bsm master-delete-only r635-delete-cart';b.textContent='🗑 Delete cart';b.addEventListener('click',function(){window.masterDeleteCrashCart(id)});bar.appendChild(b)});
}
// The canonical Crash Cart renderer calls this hook after every render.
// It replaces the former render wrapper and mutation observers, both of
// which could multiply decorations when modules were loaded more than once.
window.refreshCrashDeletionControls=decorate;
window.addEventListener('load',decorate);
})();


// --- Merged from 34-v13-as-crash-opening-log.js (Phase 6 consolidation) ---
(function(){
'use strict';
var E=window.fsE;
var esc=window.fsEsc;
function allowed(){return window.fsHasCapability?window.fsHasCapability('crashCart.operate'):!!(window.CU&&['pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(CU.role)>-1)}
function departments(){return typeof window.gd==='function'?(gd()||[]):[]}
function reports(){return typeof window.crashReports==='function'?(crashReports()||[]):[]}
function carts(){return typeof window.crashCarts==='function'?(crashCarts()||[]):[]}
function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
function cartName(id){var c=carts().find(function(x){return String(x.id)===String(id)});return c?(c.name||id):(id||'—')}
function fmtDate(v){if(!v)return '—';var d=new Date(v);if(isNaN(d.getTime()))return String(v);return d.toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function monthKey(v){if(!v)return '';var d=new Date(v);if(isNaN(d.getTime()))return '';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function visibleReports(){var dep=(E('v13as-log-dept')||{}).value||'all',month=(E('v13as-log-month')||{}).value||'';return reports().filter(function(r){return r&&r.openingLog!==false&&String(r.operation||'open')!=='seal_correction'&&(dep==='all'||String(r.deptId)===String(dep))&&(!month||monthKey(r.openedAt)===month)}).sort(function(a,b){return String(b.openedAt||'').localeCompare(String(a.openedAt||''))})}
function ensureUI(){
 if(!allowed())return removeUI();
 var page=E('pg-crashcart'),list=E('crash-list');if(!page||!list)return;
 var tabs=E('v13as-crash-tabs');if(!tabs){tabs=document.createElement('div');tabs.id='v13as-crash-tabs';tabs.innerHTML='<button type="button" class="v13as-tab active" data-view="carts">Crash Carts / عربات الطوارئ</button><button type="button" class="v13as-tab" data-view="log">Opening Log / سجل فتح العربات</button>';list.parentNode.insertBefore(tabs,list);tabs.querySelectorAll('.v13as-tab').forEach(function(b){b.onclick=function(){switchView(this.dataset.view)}})}
 var host=E('v13as-opening-log');if(!host){host=document.createElement('section');host.id='v13as-opening-log';host.className='card';host.innerHTML='<div class="v13as-head"><div><div class="v13as-title">Crash Cart Opening Log / سجل فتح عربات الطوارئ</div><div class="v13as-sub">Pharmacy-only record of openings, reasons, and seal changes.</div></div><button type="button" class="btn bs v13as-print-btn" id="v13as-log-print">Print filtered log / طباعة السجل المفلتر</button></div><div class="v13as-filters"><div><label>Department / القسم</label><select id="v13as-log-dept"><option value="all">All Departments / جميع الأقسام</option></select></div><div><label>Month / الشهر</label><input id="v13as-log-month" type="month"></div><button type="button" class="btn bg" id="v13as-log-clear">Clear filters</button></div><div class="v13as-summary"><span class="chip" id="v13as-log-count">0 records</span></div><div class="v13as-table-wrap"><table><thead><tr><th>Date opened<br>تاريخ الفتح</th><th>Department<br>القسم</th><th>Crash Cart<br>عربة الطوارئ</th><th>Reason<br>سبب الفتح</th><th>Opened seal<br>رقم القفل المفتوح</th><th>New seal<br>رقم القفل الجديد</th><th></th></tr></thead><tbody id="v13as-log-body"></tbody></table></div>';list.parentNode.insertBefore(host,list.nextSibling);E('v13as-log-dept').onchange=renderLog;E('v13as-log-month').onchange=renderLog;E('v13as-log-clear').onclick=function(){E('v13as-log-dept').value='all';E('v13as-log-month').value='';renderLog()};E('v13as-log-print').onclick=printLog}
 fillDepartments();renderLog();
}
function removeUI(){var a=E('v13as-crash-tabs'),b=E('v13as-opening-log');if(a)a.remove();if(b)b.remove();var list=E('crash-list');if(list)list.style.display=''}
function fillDepartments(){var s=E('v13as-log-dept');if(!s)return;var cur=s.value||'all',html='<option value="all">All Departments / جميع الأقسام</option>'+departments().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name||d.id)+'</option>'}).join('');if(s.innerHTML!==html)s.innerHTML=html;s.value=Array.from(s.options).some(function(o){return o.value===cur})?cur:'all'}
function switchView(view){var list=E('crash-list'),filters=E('v13-crash-filters'),alerts=E('crash-open-alerts'),add=E('crash-add-btn'),log=E('v13as-opening-log');document.querySelectorAll('#v13as-crash-tabs .v13as-tab').forEach(function(b){b.classList.toggle('active',b.dataset.view===view)});var showLog=view==='log';if(list)list.style.display=showLog?'none':'';if(filters)filters.style.display=showLog?'none':'';if(alerts)alerts.style.display=showLog?'none':'';if(add&&add.parentElement)add.parentElement.style.display=showLog?'none':'';if(log)log.classList.toggle('on',showLog);if(showLog)renderLog()}
function renderLog(){if(!allowed())return;fillDepartments();var rows=visibleReports(),body=E('v13as-log-body'),count=E('v13as-log-count');if(count)count.textContent=rows.length+' record(s)';if(!body)return;if(!rows.length){body.innerHTML='<tr><td colspan="7"><div class="v13as-empty">No opening records match the selected filters.<br>لا توجد سجلات فتح مطابقة للفلاتر.</div></td></tr>';return}body.innerHTML=rows.map(function(r,i){return '<tr><td>'+esc(fmtDate(r.openedAt))+'</td><td><b>'+esc(deptName(r.deptId))+'</b></td><td>'+esc(cartName(r.cartId))+'</td><td>'+esc(r.reason||'—')+'</td><td>'+esc(r.oldSeal||'—')+'</td><td>'+esc(r.newSeal||'—')+'</td><td><button class="btn bg bxs" data-log-id="'+esc(r.id||String(i))+'" onclick="v13asViewReport(this.dataset.logId)">👁 View</button></td></tr>'}).join('')}
window.v13asViewReport=function(id){
  var r=visibleReports().find(function(x){return String(x.id)===String(id)});
  if(!r)return;
  var consumed=Array.isArray(r.consumed)?r.consumed:[];
  var replacements=Array.isArray(r.replacements)?r.replacements:[];
  var consumedHtml=consumed.length?'<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px"><thead><tr style="background:var(--cl2)"><th style="padding:5px 8px;text-align:left;border:1px solid var(--brd)">Medicine</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">Qty used</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">Reported expiry</th></tr></thead><tbody>'+consumed.map(function(x){return '<tr><td style="padding:5px 8px;border:1px solid var(--brd)"><b>'+esc(x.name||x.itemId||'—')+'</b></td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center">'+esc(String(x.qty||'—'))+'</td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center">'+esc(x.reportedExpiry||'—')+'</td></tr>'}).join('')+'</tbody></table>':'<div style="color:var(--tx2);font-size:12px;margin-top:6px">No consumed items recorded.</div>';
  var replHtml=replacements.length?'<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px"><thead><tr style="background:var(--cl2)"><th style="padding:5px 8px;text-align:left;border:1px solid var(--brd)">Medicine</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">Action</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">Old expiry</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">Qty replaced</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">New expiry</th><th style="padding:5px 8px;text-align:center;border:1px solid var(--brd)">Final qty</th></tr></thead><tbody>'+replacements.map(function(x){return '<tr><td style="padding:5px 8px;border:1px solid var(--brd)"><b>'+esc(x.name||'—')+'</b></td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center">'+esc(x.action||'—')+'</td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center">'+esc(x.sourceExpiry||'—')+'</td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center">'+esc(String(x.qty||'0'))+'</td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center">'+esc(x.expiry||'—')+'</td><td style="padding:5px 8px;border:1px solid var(--brd);text-align:center;font-weight:700">'+esc(String(x.resultingPresent!=null?x.resultingPresent:'—'))+'</td></tr>'}).join('')+'</tbody></table>':'<div style="color:var(--tx2);font-size:12px;margin-top:6px">No replacements recorded.</div>';
  var row=function(label,val){return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--brd)"><span style="font-size:12px;color:var(--tx2);min-width:130px;flex-shrink:0">'+label+'</span><span style="font-size:13px;font-weight:600">'+val+'</span></div>'};
  var statusBadge=r.status==='closed'?'<span class="badge bgn">Closed / مغلق</span>':'<span class="badge brd">Open / مفتوح</span>';
  var html='<div style="padding:18px 20px 20px"><div style="font-size:16px;font-weight:700;margin-bottom:14px">📋 Opening Report Details / تفاصيل بلاغ الفتح</div>'+
    row('Status / الحالة',statusBadge)+
    row('Date opened / تاريخ الفتح',esc(fmtDate(r.openedAt)))+
    row('Department / القسم','<b>'+esc(deptName(r.deptId))+'</b>')+
    row('Crash Cart / عربة الطوارئ',esc(cartName(r.cartId)))+
    row('Reason / سبب الفتح',esc(r.reason||'—'))+
    row('Opened by / فُتح بواسطة',esc(r.openedByName||r.openedBy||'—')+(r.openedByUser?' <span style="font-size:11px;color:var(--tx2)">('+esc(r.openedByUser)+')</span>':''))+
    row('Old seal broken / القفل المكسور',esc(r.oldSeal||'—'))+
    row('New seal / القفل الجديد','<b>'+esc(r.newSeal||'—')+'</b>')+
    (r.status==='closed'?row('Closed at / وقت الإغلاق',esc(fmtDate(r.closedAt)))+row('Closed by / أُغلق بواسطة',esc(r.closedByName||r.closedBy||'—')+(r.closedByUser?' <span style="font-size:11px;color:var(--tx2)">('+esc(r.closedByUser)+')</span>':'')):'')+
    (r.pharmacyNote?row('Pharmacy note / ملاحظة الصيدلية',esc(r.pharmacyNote)):'')+
    '<div style="margin-top:16px"><div style="font-size:13px;font-weight:700;margin-bottom:4px">🩺 Consumed items / الأدوية المستخدمة</div>'+consumedHtml+'</div>'+
    '<div style="margin-top:16px"><div style="font-size:13px;font-weight:700;margin-bottom:4px">🔄 Replacements / الأدوية المستبدلة</div>'+replHtml+'</div>'+
    '</div>';
  var old=E('v13as-view-modal');if(old)old.remove();
  var modal=document.createElement('div');
  modal.id='v13as-view-modal';
  modal.className='modal-bg on';
  modal.style.cssText='z-index:9999';
  modal.innerHTML='<div class="modal" style="max-width:740px;max-height:85vh;overflow-y:auto"><div class="mh"><div class="mt">Crash Cart Report / بلاغ فتح العربة</div><button type="button" class="xbtn" onclick="document.getElementById(\'v13as-view-modal\').remove()">×</button></div>'+html+'</div>';
  modal.addEventListener('click',function(ev){if(ev.target===modal)modal.remove()});
  document.body.appendChild(modal);
};
function printLog(){var rows=visibleReports();if(!rows.length)return window.toast&&toast('No opening records match the selected filters.','err');var dep=(E('v13as-log-dept')||{}).value||'all',month=(E('v13as-log-month')||{}).value||'';var titleDep=dep==='all'?'All Departments / جميع الأقسام':deptName(dep);var html='<!doctype html><html><head><meta charset="utf-8"><title>Crash Cart Opening Log</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}html,body{height:auto!important;max-height:none!important;overflow:visible!important}body{font-family:Arial,sans-serif;margin:0;color:#111}.page{width:100%;height:auto!important;max-height:none!important;overflow:visible!important;transform:none!important}.head{text-align:center;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid}.head h1{font-size:18px;margin:0 0 4px}.meta{font-size:10px;color:#444}.summary{display:flex;gap:8px;justify-content:center;margin:7px 0;font-size:10px;page-break-inside:avoid;break-inside:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;page-break-inside:auto;break-inside:auto}thead{display:table-header-group}tbody{display:table-row-group}tr{page-break-inside:avoid!important;break-inside:avoid!important}th,td{border:1px solid #444;padding:4px;vertical-align:top;word-break:break-word}th{background:#eee}.foot{margin-top:6px;text-align:center;font-size:8px;color:#555;page-break-inside:avoid;break-inside:avoid}.brand{text-align:right;font-size:7px;color:#94a3b8;margin-top:4px}@media print{html,body,.page{height:auto!important;max-height:none!important;overflow:visible!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}thead{display:table-header-group!important}tr{page-break-inside:avoid!important;break-inside:avoid!important}}</style></head><body><div class="page" id="p"><div class="head"><h1>Crash Cart Opening Log / سجل فتح عربات الطوارئ</h1><div class="meta">Department: '+esc(titleDep)+' &nbsp; | &nbsp; Month: '+esc(month||'All months / جميع الأشهر')+'</div></div><div class="summary">Total records: '+rows.length+'</div><table><thead><tr><th>Date opened<br>تاريخ الفتح</th><th>Department<br>القسم</th><th>Crash Cart<br>العربة</th><th>Reason<br>السبب</th><th>Opened seal<br>القفل المفتوح</th><th>New seal<br>القفل الجديد</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(fmtDate(r.openedAt))+'</td><td>'+esc(deptName(r.deptId))+'</td><td>'+esc(cartName(r.cartId))+'</td><td>'+esc(r.reason||'—')+'</td><td>'+esc(r.oldSeal||'—')+'</td><td>'+esc(r.newSeal||'—')+'</td></tr>'}).join('')+'</tbody></table><div class="foot">Printed '+esc(fmtDate(new Date().toISOString()))+'</div><div class="brand">By Ali Abudahash</div></div><script>(function(){var fired=false;function go(){if(fired)return;fired=true;try{window.focus()}catch(e){}window.print()}window.addEventListener("load",function(){setTimeout(go,200)},{once:true});setTimeout(go,1600)})();<\/script></body></html>';var w=window.open('','_blank');if(!w)return window.toast&&toast('Allow pop-ups to print the log.','err');w.document.open();w.document.write(html);w.document.close()}
window.refreshCrashOpeningLogUi=ensureUI;
})();

// Merged from 46-r664-private-crash-cart-source-only.js (Phase 6).
(function(){
  'use strict';
  window.recoverCrashCartsFromPublicSnapshots=async function(){
    throw new Error('Public Crash Cart recovery is disabled. Restore from an authenticated Master backup instead.');
  };
  window.ensureCrashRecoveryButton=function(){
    var button=document.getElementById('crash-restore-public-btn');
    if(button)button.remove();
  };
})();


// --- Merged from 66-r676-crash-report-ordering-notes-fixes.js (Phase 6 consolidation) ---
import { formatOrderingUnavailable } from '../core/bilingual-ordering-message.js';

(function(){
'use strict';

var crashReportSaving=false;
var noteBadgeTimer=null;
var scheduleFixBusy=false;

var E=window.fsE;
function numberValue(value){var parsed=Number(value);return isFinite(parsed)?parsed:0}
function dateKey(value){return String(value||'').slice(0,10)}
// Crash Cart data must never be changed merely by opening the page. Boot is read-only — data flows
// in from Firestore realtime snapshots only; no reconcile or setCrashCarts call on login.
function crashItems(){return typeof window.crashCarts==='function'?(window.crashCarts()||[]):[]}
function crashReportsList(){return typeof window.crashReports==='function'?(window.crashReports()||[]):[]}
function errorMessage(error){return String(error&&error.message||error||'Unknown error').replace(/^FirebaseError:\s*/,'')}
function callToast(ar,en,type){if(typeof window.toast==='function')window.toast(String(ar||'')+'\n'+String(en||''),type||'info')}
function replaceCachedCrashState(cart,report){
  if(!window.S||!S.cache)throw new Error('Crash Cart state cache is unavailable.');
  var carts=crashItems().map(function(entry){return String(entry&&entry.id||'')===String(cart&&cart.id||'')?cart:entry});
  if(!carts.some(function(entry){return String(entry&&entry.id||'')===String(cart&&cart.id||'')}))carts.push(cart);
  var reports=crashReportsList().slice(),index=reports.findIndex(function(entry){return String(entry&&entry.id||'')===String(report&&report.id||'')||(String(entry&&entry.cartId||'')===String(report&&report.cartId||'')&&(String(entry&&entry.status||'')==='open'||String(entry&&entry.status||'')==='pending'))});
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
  var noConsumption=!!(document.getElementById('ccr-no-consumption')&&document.getElementById('ccr-no-consumption').checked);
  var consumed=[];
  if(!noConsumption){
    document.querySelectorAll('#ccr-items .cc-med-choice').forEach(function(row){
      var checkbox=row.querySelector('input[type="checkbox"]');if(!checkbox||!checkbox.checked)return;
      var item=(cart.items||[]).find(function(entry){return String(entry&&entry.id||'')===String(row.dataset.id||'')});
      if(!item)throw new Error('A selected medicine no longer exists in the Crash Cart.');
      var quantity=numberValue((row.querySelector('.ccr-qty')||{}).value),available=(item.stockStatus==='out_of_stock'&&item.present==null)?0:numberValue(item.present==null?item.qty:item.present);
      if(!(quantity>0)||quantity>available)throw new Error(String(item.name||'Medicine')+': quantity exceeds available stock.');
      consumed.push({itemId:String(item.id),qty:quantity,reportedExpiry:dateKey((row.querySelector('.ccr-expiry')||{}).value)});
    });
    if(!consumed.length)throw new Error('Select at least one medicine, or check "No medications consumed".\nاختر دواءً واحداً على الأقل، أو ضع علامة "لا يوجد استهلاك".');
  } else {
    var ncLimit=ccNCLimitForCart(id);
    var ncCount=ccNCCountThisMonth(id);
    if(ncCount>=ncLimit)throw new Error('Monthly no-consumption report limit reached for this cart ('+ncLimit+'x/month).\nتم استنفاد الحد الشهري لبلاغات عدم الاستهلاك لهذه العربة ('+ncLimit+' مرة/شهر).');
  }
  var ncNote=noConsumption?String((document.getElementById('ccr-note')||{}).value||'').trim():'';
  var oldSeal=String((E('ccr-old-seal')||{}).value||'').trim();
  if(!oldSeal)throw new Error('Enter the old seal number before submitting the report.');
  return {cartId:id,reason:reason,oldSeal:oldSeal,consumed:consumed,noConsumption:noConsumption,noConsumptionNote:ncNote};
}

window.ccSubmitReport=async function(){
  if(crashReportSaving)return false;
  var confirmed=await uiConfirm(
    'تأكيد إرسال البلاغ / Confirm Report Submission\n\n'+
    '⚠ تنبيه: البلاغ بعد إرساله لا يمكن تعديله أو حذفه بدون موافقة الصيدلية.\n'+
    'أنت مسؤول عن صحة المعلومات المدخلة.\n\n'+
    '⚠ Warning: Once submitted, this report cannot be modified or deleted without pharmacy approval.\n'+
    'You are responsible for the accuracy of the information provided.'
  );
  if(!confirmed)return false;
  var button=document.querySelector('#mcc-report .fl.g8 .btn.bd2c'),oldText=button&&button.textContent;
  crashReportSaving=true;if(button){button.disabled=true;button.textContent='جاري الحفظ… / Saving…'}
  try{
    var effectiveRole=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(CU&&CU.role||'');
    var canReport=typeof window.fsHasCapability==='function'?window.fsHasCapability('crashCart.report'):['department','department_employee'].indexOf(String(effectiveRole))>=0;
    if(!window.CU||!canReport)throw new Error('Only a department employee can submit this report.');
    if(typeof window.fsCallFunction!=='function')throw new Error('Secure Crash Cart service is still loading. Please retry.');
    var payload=collectCrashReport(),data=await window.fsCallFunction('submitCrashCartReport',payload)||{};
    if(!data.ok||!data.cart||!data.report)throw new Error('The server did not confirm the Crash Cart report save.');
    replaceCachedCrashState(data.cart,data.report);
    if(typeof window.CM==='function')window.CM('mcc-report');
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
    if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();
    callToast('تم إرسال البلاغ وهو بانتظار موافقة الصيدلية ✓','Report submitted — awaiting pharmacy approval ✓','succ');
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

// Phase 7a: Pharmacy accepts a pending crash cart report — triggers deduction.
var crashAccepting=false;
window.ccAcceptReport=async function(reportId){
  if(crashAccepting)return false;
  var canAct=typeof window.fsHasCapability==='function'?window.fsHasCapability('crashCart.operate'):(function(){var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(window.CU&&CU.role||'');return ['master','pharmacy','pharmacy_supervisor','inpatient_supervisor','inpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(role)>=0})();
  if(!canAct)return callToast('هذه الصلاحية للصيدلية فقط','Only pharmacy staff can accept reports','err');
  if(!reportId)return callToast('معرّف البلاغ مطلوب','Report ID is required','err');
  if(!confirm('تأكيد قبول البلاغ وخصم الكميات من العربة؟\nConfirm accept and deduct quantities from the cart?'))return false;
  crashAccepting=true;
  try{
    if(typeof window.fsCallFunction!=='function')throw new Error('Secure service is still loading. Please retry.');
    var data=await window.fsCallFunction('acceptCrashCartReport',{reportId:reportId})||{};
    if(!data.ok||!data.report)throw new Error('Server did not confirm acceptance.');
    var reports=crashReportsList().slice(),idx=reports.findIndex(function(e){return String(e&&e.id||'')===String(reportId)});
    if(idx>=0)reports[idx]=data.report;
    if(window.S&&S.cache){S.cache.crash_cart_reports=reports;if(data.cart){var carts=crashItems().map(function(e){return String(e&&e.id||'')===String(data.cart.id)?data.cart:e});S.cache.crash_carts=carts}}
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
    if(typeof window.ccxRenderDashboardAlerts==='function')window.ccxRenderDashboardAlerts();
    if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();
    callToast('تم قبول البلاغ وخصم الكميات من العربة ✓','Report accepted — quantities deducted from cart ✓','succ');
    return true;
  }catch(error){
    callToast('لم يتم القبول. حاول مرة أخرى.','Could not accept report. Please retry.\n'+errorMessage(error),'err');
    return false;
  }finally{crashAccepting=false}
};
window.ccAcceptReport.__r676SecureCallable=true;

// Phase 7a: Pharmacy rejects a pending crash cart report — no inventory change.
var crashRejecting=false;
window.ccRejectReport=async function(reportId){
  if(crashRejecting)return false;
  var canAct=typeof window.fsHasCapability==='function'?window.fsHasCapability('crashCart.operate'):(function(){var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(window.CU&&CU.role||'');return ['master','pharmacy','pharmacy_supervisor','inpatient_supervisor','inpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(role)>=0})();
  if(!canAct)return callToast('هذه الصلاحية للصيدلية فقط','Only pharmacy staff can reject reports','err');
  if(!reportId)return callToast('معرّف البلاغ مطلوب','Report ID is required','err');
  var note=window.prompt('ملاحظة الرفض (اختياري) / Rejection note (optional):','');
  if(note===null)return false;
  crashRejecting=true;
  try{
    if(typeof window.fsCallFunction!=='function')throw new Error('Secure service is still loading. Please retry.');
    var data=await window.fsCallFunction('rejectCrashCartReport',{reportId:reportId,rejectionNote:note||''})||{};
    if(!data.ok||!data.report)throw new Error('Server did not confirm rejection.');
    var reports=crashReportsList().slice(),idx=reports.findIndex(function(e){return String(e&&e.id||'')===String(reportId)});
    if(idx>=0)reports[idx]=data.report;
    if(window.S&&S.cache)S.cache.crash_cart_reports=reports;
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
    if(typeof window.ccxRenderDashboardAlerts==='function')window.ccxRenderDashboardAlerts();
    if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();
    callToast('تم رفض البلاغ — لم تتغير كميات العربة','Report rejected — no inventory was changed','info');
    return true;
  }catch(error){
    callToast('لم يتم الرفض. حاول مرة أخرى.','Could not reject report. Please retry.\n'+errorMessage(error),'err');
    return false;
  }finally{crashRejecting=false}
};
window.ccRejectReport.__r676SecureCallable=true;

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

// Module 52 loads before module 80, which owns the real ccSavePharmacyResponse
// and overwrites window.ccSavePharmacyResponse unconditionally — this wrapper's
// seal-match-policy enforcement never ran at runtime (confirmed live: module 80's
// raw implementation is what's active, with no seal-policy check inside it).
// Left removed rather than kept dead; see docs/window-conflicts-classification.md
// for the still-open question of whether that enforcement should be reimplemented.

function unresolvedNote(note){var status=String(note&&note.status||'').toLowerCase();return status==='open'||status==='urgent'}
function notes(){try{return typeof window.getNotes==='function'?(window.getNotes()||[]):[]}catch(error){return[]}}
function badgeMarkup(count,color){return count>0?' <span style="background:'+color+';color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">'+count+'</span>':''}
function refreshNotesBadge(){
  if(!window.CU)return;
  var list=notes();
  var noteRole=window.fsEffectiveRole?window.fsEffectiveRole():String(CU.role||'');
  var outpatientScope=(noteRole==='outpatient_pharmacy_supervisor'&&typeof window.fsOutpatientDeptId==='function')?String(window.fsOutpatientDeptId()||''):'';
  var scopedList=outpatientScope?list.filter(function(n){return String(n&&n.deptId||'')===outpatientScope}):list;
  if(typeof window.fsCanAccessDepartment==='function')scopedList=scopedList.filter(function(n){return window.fsCanAccessDepartment(n&&n.deptId)});
  var pharmacyCount=scopedList.filter(unresolvedNote).length;
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

window.__renderCrashCartsAfterExtensions=window.__renderCrashCartsAfterExtensions||[];
window.__renderCrashCartsAfterExtensions.push(function(){setTimeout(renderSealPolicyToggle,0)});
window.__renderCrashOperationsAfterExtensions=window.__renderCrashOperationsAfterExtensions||[];
window.__renderCrashOperationsAfterExtensions.push(function(){setTimeout(renderSealPolicyToggle,0)});
window.__showPgAfterExtensions=window.__showPgAfterExtensions||[];
window.__showPgAfterExtensions.push(function(){setTimeout(renderSealPolicyToggle,0)});

function install(){
  startNotesBadgeRefresh();fixOrderingBanner();renderSealPolicyToggle();
  var nav=E('mnav');if(nav)new MutationObserver(function(){setTimeout(refreshNotesBadge,0)}).observe(nav,{childList:true,subtree:true});
  var requestPage=E('pg-newreq');if(requestPage)new MutationObserver(function(){setTimeout(fixOrderingBanner,0)}).observe(requestPage,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){refreshNotesBadge();fixOrderingBanner()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* ===== No-Consumption crash cart report support ===== */
var CC_NC_SETTINGS_KEY='crash_cart_nc_settings_v1';
function ccNCSettings(){var s={};try{s=(window.S&&S.g?S.g(CC_NC_SETTINGS_KEY):null)||{}}catch(e){}return {defaultLimit:Math.max(1,Number(s.defaultLimit||s.monthlyLimit)||2),cartLimits:s.cartLimits&&typeof s.cartLimits==='object'?s.cartLimits:{}}}
function ccNCLimitForCart(cartId){var s=ccNCSettings();var perCart=s.cartLimits[String(cartId)];return perCart!=null?Math.max(1,Number(perCart)):s.defaultLimit}
function ccNCCountThisMonth(cartId){
  var ym=new Date().toISOString().slice(0,7);
  var reports=typeof crashReports==='function'?(crashReports()||[]):[];
  return reports.filter(function(r){return String(r.cartId)===String(cartId)&&r.noConsumption===true&&String(r.openedAt||'').slice(0,7)===ym}).length;
}

window.ccToggleNoConsumption=function(checked){
  var card=document.getElementById('ccr-items-card');
  var noteRow=document.getElementById('ccr-note-row');
  if(card)card.style.display=checked?'none':'';
  if(noteRow)noteRow.style.display=checked?'':'none';
  if(!checked&&document.getElementById('ccr-note'))document.getElementById('ccr-note').value='';
};

/* Master settings for no-consumption monthly limit — per cart */
window.renderCCNoConsumptionSettings=function(){
  var el=document.getElementById('cc-nc-settings-panel');if(!el)return;
  var s=ccNCSettings();
  var allCarts=typeof window.crashCarts==='function'?(window.crashCarts()||[]):[];
  var cartRows=allCarts.map(function(c){
    var cartLimit=s.cartLimits[String(c.id)]!=null?s.cartLimits[String(c.id)]:'';
    return '<tr><td style="padding:4px 8px"><b>'+esc(c.name||c.id)+'</b><div class="fhint">'+esc(typeof deptName==='function'?deptName(c.deptId):c.deptId)+'</div></td><td style="padding:4px 8px"><input class="cc-nc-cart-limit" data-cart-id="'+esc(String(c.id))+'" type="number" min="1" max="20" placeholder="'+s.defaultLimit+'" value="'+esc(String(cartLimit))+'" style="width:70px"></td></tr>';
  }).join('');
  el.innerHTML='<div class="card"><div class="ch"><span class="ct">No-Consumption Report Limits / حدود بلاغات عدم الاستهلاك</span></div><div class="cb"><div class="fg" style="max-width:320px;margin-bottom:12px"><label>Default monthly limit (applies to all carts without a specific limit) / الحد الشهري الافتراضي</label><input id="cc-nc-default-limit" type="number" min="1" max="20" value="'+s.defaultLimit+'"></div>'+(cartRows?'<table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:4px 8px;text-align:left">Cart / العربة</th><th style="padding:4px 8px;text-align:left">Monthly limit (blank = default) / الحد الشهري</th></tr></thead><tbody>'+cartRows+'</tbody></table>':'<div class="fhint">No carts configured yet.</div>')+'<button class="btn bp bsm" style="margin-top:12px" onclick="ccSaveNCSettings()">Save / حفظ</button></div></div>';
};
window.ccSaveNCSettings=async function(){
  if(!window.CU||!CU.master)return;
  var defaultLimit=Math.max(1,parseInt((document.getElementById('cc-nc-default-limit')||{}).value||'2',10));
  var cartLimits={};
  document.querySelectorAll('.cc-nc-cart-limit').forEach(function(inp){
    var val=inp.value.trim();
    if(val){var n=Math.max(1,parseInt(val,10));if(n)cartLimits[inp.dataset.cartId]=n}
  });
  try{await S.s(CC_NC_SETTINGS_KEY,{defaultLimit:defaultLimit,cartLimits:cartLimits});if(typeof toast==='function')toast('No-consumption limits saved ✓','succ')}catch(e){if(typeof toast==='function')toast(String(e&&e.message||e),'err')}
};

export {};

(function(){
'use strict';
function esc(value){return window.fsEsc?window.fsEsc(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function norm(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'')}
function state(key){return window.S&&typeof window.S.g==='function'&&Array.isArray(window.S.g(key))?window.S.g(key):[]}
function depts(){return state('departments')}
function deptName(id){var exact=depts().find(function(row){return String(row.id)===String(id)});if(exact)return exact.name||exact.id;var target=norm(id),match=depts().find(function(row){return norm(row.id)===target||norm(row.name)===target});return match?(match.name||match.id):id||'—'}
function assignments(){return state('accountability_assignments_v2').filter(function(row){return row&&row.active!==false&&row.medName})}
function matchingDept(value){var target=norm(value);return assignments().find(function(row){return norm(row.deptId)===target||norm(deptName(row.deptId))===target})}
function selectedDept(){var select=document.getElementById('acc2-regimen-dept');return select&&select.value||''}
function renderRegimenRoster(){
  // The new independent-regimens tab (module 79) also contains .acc2-regimen-items
  // but uses acc3-regimen-dept. If acc2-regimen-dept does not exist we are on the
  // new tab — bail out to avoid an infinite renderMedicationAccountability() loop.
  if(!document.getElementById('acc2-regimen-dept'))return;
  var host=document.querySelector('#r17-accountability-root .acc2-regimen-items');
  if(!host||host.dataset.r676Roster==='1'||host.querySelector('[data-acc2-regimen-assignment]')||host.querySelector('[data-acc3-regimen-catalog]'))return;
  var selected=selectedDept(),candidate=matchingDept(selected)||assignments()[0];
  if(!candidate){
    host.dataset.r676Roster='1';
    host.innerHTML='<div class="acc2-empty">No active custody medicines are available for this department. Add them first in <b>Custody setup / إعداد العهدة</b>, then return to this plan.<br>لا توجد أدوية عهدة مفعّلة لهذا القسم. أضفها أولًا من إعداد العهدة ثم ارجع للخطة.</div><div class="fl g8" style="margin-top:12px"><button class="btn bp bsm" type="button" data-acc2-open-custody>Add custody medicine / إضافة دواء للعهدة</button></div>';
    return;
  }
  var selectedMatches=assignments().filter(function(row){return norm(row.deptId)===norm(selected)||norm(deptName(row.deptId))===norm(selected)});
  if(!selectedMatches.length){
    var select=document.getElementById('acc2-regimen-dept');
    if(select){
      var option=Array.from(select.options).find(function(row){return String(row.value)===String(candidate.deptId)});
      if(!option){option=document.createElement('option');option.value=candidate.deptId;option.textContent=deptName(candidate.deptId);select.appendChild(option)}
      select.value=candidate.deptId;
    }
    if(typeof window.acc2RegimenDeptChanged==='function')window.acc2RegimenDeptChanged(candidate.deptId);
    return;
  }
  host.dataset.r676Roster='1';
  host.innerHTML='<div class="fhint" style="margin-bottom:8px">Select two or more approved custody medicines and set the planned units for each. / اختر علاجين أو أكثر من أدوية العهدة المعتمدة وحدد الكمية المخططة لكل علاج.</div>'+selectedMatches.map(function(row){return '<label class="acc2-regimen-item"><input type="checkbox" data-acc2-regimen-assignment="'+esc(row.id)+'"><span><b>'+esc(row.medName)+'</b><small>Custody '+esc(row.quota)+' · balance '+esc(row.balance)+'</small></span><input class="acc2-regimen-qty" data-assignment="'+esc(row.id)+'" type="number" min="0.001" step="any" placeholder="Planned units / الوحدات المخططة"></label>'}).join('');
}
/* The activity log is rendered by the dedicated, filterable log view in
   module 72. Keep this module focused on the regimen roster. */
function enhance(){renderRegimenRoster()}
document.addEventListener('change',function(event){if(event.target&&event.target.id==='acc2-regimen-dept')setTimeout(enhance,0)},true);
document.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('[data-acc2-open-custody]');if(button&&typeof window.acc2SetAdminTab==='function'){window.acc2SetAdminTab('custody')}},true);
var previous=window.renderMedicationAccountability;
if(typeof previous==='function'&&!previous.__r676RosterLog){var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(enhance,0);return result};wrapped.__r676RosterLog=true;window.renderMedicationAccountability=wrapped}
setTimeout(enhance,0);
})();

// --- Merged from 71-r676-accountability-review-and-retention.js (Phase 6 consolidation) ---
(function(){
'use strict';
function isActualMaster(){return !!((window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)||(window.CU&&window.CU.master===true))&&!window.MASTER_EFFECTIVE}
function appState(key){return window.S&&typeof window.S.g==='function'&&Array.isArray(window.S.g(key))?window.S.g(key):[]}
function sixMonthCutoff(){var date=new Date();date.setMonth(date.getMonth()-6);return date.getTime()}
function olderThanSixMonths(value){var time=new Date(value||0).getTime();return Number.isFinite(time)&&time>0&&time<sixMonthCutoff()}
function decorateReview(){
  var root=document.getElementById('r17-accountability-root');if(!root)return;
  var review=root.querySelector('#r17-acc-verify');if(!review||root.dataset.r676ReviewDefault==='1')return;
  root.dataset.r676ReviewDefault='1';
  var selects=root.querySelectorAll('.acc2-filter-grid select');if(selects[1]&&selects[1].value===''&&typeof window.acc2SetFilter==='function')window.acc2SetFilter('status','pending_pharmacy');
}
function retentionPanel(){
  var root=document.getElementById('r17-accountability-root');if(!root||!isActualMaster()||root.querySelector('#r676-accountability-retention'))return;
  var log=root.querySelector('#r676-accountability-handover-log, #r676-accountability-handover-log-view');if(!log)return;
  var oldUsage=appState('accountability_usage_v2').filter(function(row){return olderThanSixMonths(row.submittedAt||row.consumptionDate)}).length;
  var oldReceipts=appState('accountability_receipts_v2').filter(function(row){return olderThanSixMonths(row.receivedAt||row.createdAt||row.receivedDate)}).length;
  var panel=document.createElement('div');panel.id='r676-accountability-retention';panel.className='alert-banner-y';panel.innerHTML='<b>Master retention controls / إدارة الاحتفاظ للماستر</b><br>Historical accountability activity older than six months: '+oldUsage+' usage record(s), '+oldReceipts+' receipt/handover record(s). Active custody lines and regimens are never deleted. A full-detail JSON+Excel file is downloaded and must be confirmed saved before deletion.<br><button class="btn bd2c bsm" type="button" data-acc2-purge-history style="margin-top:8px">Archive &amp; delete accountability history older than 6 months / أرشفة وحذف سجل العهد الأقدم من 6 أشهر</button>';
  log.parentNode.insertBefore(panel,log);
}
window.acc2PurgeHistoricalHistory=async function(){
  if(!isActualMaster())return window.toast&&window.toast('Actual Master access is required. / يتطلب صلاحية الماستر الفعلية.','err');
  var usage=appState('accountability_usage_v2'),receipts=appState('accountability_receipts_v2'),keptUsage=usage.filter(function(row){return !olderThanSixMonths(row.submittedAt||row.consumptionDate)}),keptReceipts=receipts.filter(function(row){return !olderThanSixMonths(row.receivedAt||row.createdAt||row.receivedDate)}),removedUsage=usage.filter(function(row){return olderThanSixMonths(row.submittedAt||row.consumptionDate)}),removedReceipts=receipts.filter(function(row){return olderThanSixMonths(row.receivedAt||row.createdAt||row.receivedDate)});
  if(!removedUsage.length&&!removedReceipts.length)return window.toast&&window.toast('No accountability history is older than six months. / لا توجد سجلات أقدم من ستة أشهر.','info');

  if(typeof window.downloadJsonFile!=='function')return window.toast&&window.toast('Archive utilities are not loaded. / أدوات الأرشفة غير محمّلة.','err');
  var stamp=new Date().toISOString().replace(/[:.]/g,'-');
  var exportPayload={format:'ASDHealth-Accountability-History-Archive',version:1,exportedAt:new Date().toISOString(),usageCount:removedUsage.length,receiptCount:removedReceipts.length,usage:removedUsage,receipts:removedReceipts};
  var fileName='ASDHealth_Accountability_History_Archive_'+stamp+'.json';
  window.downloadJsonFile(exportPayload,fileName);
  if(typeof window.downloadExcelFile==='function'){
    try{
      await window.downloadExcelFile(removedUsage.concat(removedReceipts.map(function(row){return Object.assign({__kind:'receipt'},row)})),[
        {label:'Kind',value:function(r){return r.__kind==='receipt'?'Receipt/Handover':'Usage'}},
        {label:'Date',value:function(r){var d=r.submittedAt||r.consumptionDate||r.receivedAt||r.createdAt||r.receivedDate;return d?new Date(d).toLocaleString():''}},
        {label:'Department',value:function(r){return r.deptName||r.deptId||''}},
        {label:'Medicine',value:function(r){return r.medName||''}},
        {label:'Qty',value:function(r){return r.qty!=null?Number(r.qty):''}},
        {label:'By',value:function(r){return r.by||r.submittedBy||r.receivedBy||''}}
      ],'ASDHealth_Accountability_History_Archive_'+stamp+'.xlsx');
    }catch(excelError){console.warn('Accountability history Excel export failed; JSON archive (already downloaded) remains the full-detail copy.',excelError)}
  }
  if(typeof window.localArchiveDbSave==='function')await window.localArchiveDbSave('accountability',{id:stamp,createdAt:exportPayload.exportedAt,usageCount:removedUsage.length,receiptCount:removedReceipts.length,payload:exportPayload});

  var question='Files with the full detail of '+removedUsage.length+' usage record(s) and '+removedReceipts.length+' receipt/handover record(s) older than six months have been downloaded ('+fileName+' + Excel).\n\nSave these files somewhere safe outside the browser — they are the ONLY full-detail copy once you continue. Active custody and regimens will remain unchanged.\n\nConfirm you saved the files and want to permanently delete these history records now? / تم تنزيل ملفات بالتفاصيل الكاملة لسجلات العهد الأقدم من 6 أشهر. أكّد أنك حفظت الملفات وتريد حذف هذه السجلات نهائيًا الآن؟';
  var ok=typeof window.uiConfirm==='function'?await window.uiConfirm(question,{danger:true,okText:'I saved the files — delete now'}):window.confirm(question);
  if(!ok){window.toast&&window.toast('Archive files downloaded; records were NOT deleted. Re-run this action when ready.','info');return}
  var store=window.S&&window.S.s;if(typeof store!=='function')return window.toast&&window.toast('State storage is not ready.','err');
  try{await store('accountability_usage_v2',keptUsage);try{await store('accountability_receipts_v2',keptReceipts)}catch(error){await store('accountability_usage_v2',usage);throw error}if(typeof window.auditAction==='function')await Promise.resolve(window.auditAction('accountability_history_retention_purge',{olderThanMonths:6,removedUsage:removedUsage.length,removedReceipts:removedReceipts.length})).catch(function(error){console.warn('Accountability retention audit warning',error)});window.toast&&window.toast('Historical accountability records archived and deleted: '+(removedUsage.length+removedReceipts.length)+' ✓','succ');window.renderMedicationAccountability&&window.renderMedicationAccountability()}catch(error){console.error(error);window.toast&&window.toast(String(error&&error.message||error),'err')}
};
document.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('[data-acc2-purge-history]');if(button){window.acc2PurgeHistoricalHistory()}},true);
function decorate(){decorateReview();retentionPanel()}
var previous=window.renderMedicationAccountability;
if(typeof previous==='function'&&!previous.__r676RetentionWrap){var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(decorate,0);return result};wrapped.__r676RetentionWrap=true;window.renderMedicationAccountability=wrapped}
setTimeout(decorate,0);
})();

// --- Merged from 72-r676-accountability-handover-log-view.js (Phase 6 consolidation) ---
(function(){
'use strict';
function esc(value){return window.fsEsc?window.fsEsc(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(key){return window.S&&typeof window.S.g==='function'&&Array.isArray(window.S.g(key))?window.S.g(key):[]}
function departments(){return state('departments')}
function deptName(id){var row=departments().find(function(item){return String(item.id)===String(id)});return row?(row.name||row.id):(id||'—')}
function dateKey(value){var date=new Date(value||0);return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):''}
function logRows(){
  var rows=[];
  state('accountability_usage_v2').forEach(function(row){if(!row)return;rows.push({at:row.submittedAt||row.consumptionDate,kind:'submitted',label:'Submitted to pharmacy / رُفع للصيدلية',dept:row.deptId,medicine:row.medName||'—',units:row.units,actor:row.submittedBy||'—',method:'recorded',status:row.status||'pending_pharmacy'});if(row.approvedAt)rows.push({at:row.approvedAt,kind:'approved',label:'Approved for handover / اعتماد للتسليم',dept:row.deptId,medicine:row.medName||'—',units:row.units,actor:row.approvedBy||'—',method:'recorded',status:row.status||'approved_waiting_receipt'})});
  state('accountability_receipts_v2').forEach(function(row){if(!row)return;rows.push({at:row.receivedAt||row.createdAt||row.receivedDate,kind:'completed',label:'Completed handover / استلام وتسليم مكتمل',dept:row.deptId,medicine:(row.medicineTotals||[]).map(function(item){return (item.medName||'Medicine')+' × '+(item.units||0)}).join('، ')||'—',units:row.totalUnits,actor:(row.pharmacyName||'—')+' → '+(row.nurseName||'—'),method:row.confirmationMethod==='temporary_dual_qr'?'temporary_dual_qr':row.confirmationMethod==='manual'?'manual':'recorded',status:'received_locked'})});
  return rows.sort(function(a,b){return String(b.at||'').localeCompare(String(a.at||''))});
}
function filters(){return window.__acc2HandoverLogFilters||(window.__acc2HandoverLogFilters={department:'',from:'',to:'',method:'',kind:'',search:''})}
function filteredRows(){var f=filters(),needle=String(f.search||'').trim().toLowerCase();return logRows().filter(function(row){var day=dateKey(row.at);return (!f.department||String(row.dept)===String(f.department))&&(!f.from||day>=f.from)&&(!f.to||day<=f.to)&&(!f.method||row.method===f.method)&&(!f.kind||row.kind===f.kind)&&(!needle||[row.medicine,row.actor,row.label,deptName(row.dept)].join(' ').toLowerCase().indexOf(needle)>=0)})}
function methodLabel(value){return value==='temporary_dual_qr'?'Dual QR / رمزان QR':value==='manual'?'Manual / يدوي':'Recorded / مسجل'}
function printRows(){var rows=filteredRows(),body=rows.map(function(row){return '<tr><td>'+esc(row.at||'—')+'</td><td>'+esc(row.label)+'</td><td>'+esc(deptName(row.dept))+'</td><td>'+esc(row.medicine)+'</td><td>'+esc(row.units==null?'—':row.units)+'</td><td>'+esc(row.actor)+'</td><td>'+esc(methodLabel(row.method))+'</td><td>'+esc(row.status||'—')+'</td></tr>'}).join('')||'<tr><td colspan="8">No matching activity.</td></tr>',html='<h1>Handover activity log / سجل نشاط الاستلام والتسليم</h1><p>Filtered records: '+rows.length+' · Generated '+esc(new Date().toLocaleString())+'</p><table><thead><tr><th>Time</th><th>Activity</th><th>Department</th><th>Medicines</th><th>Units</th><th>Performed by</th><th>Method</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table>',css='table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #777;padding:6px;text-align:left}th{background:#eee}';if(typeof window.fsOfficialPrint==='function')return window.fsOfficialPrint({title:'Handover activity log',html:html,css:css});window.toast&&window.toast('Official printing is not ready. Reload the page and try again.','err')}
function hideBase(root,hide){Array.from(root.children).forEach(function(child){if(child.classList.contains('acc2-stats')||child.classList.contains('acc2-tabs')||child.id==='r676-accountability-handover-log-view')return;child.style.display=hide?'none':''})}
function ensureButton(root){var tabs=root.querySelector('.acc2-tabs');if(!tabs||tabs.querySelector('[data-acc2-handover-log]'))return;var button=document.createElement('button');button.type='button';button.className='acc2-tab';button.dataset.acc2HandoverLog='1';button.textContent='Handover activity log / سجل الاستلام والتسليم';tabs.appendChild(button)}
function renderLog(){
  var root=document.getElementById('r17-accountability-root');if(!root)return;ensureButton(root);if(!window.__acc2HandoverLogOpen)return;
  root.querySelectorAll('#r676-accountability-handover-log, #r676-accountability-retention').forEach(function(node){node.remove()});hideBase(root,true);
  var tabs=root.querySelector('.acc2-tabs');tabs&&tabs.querySelectorAll('.acc2-tab').forEach(function(button){button.classList.toggle('on',!!button.dataset.acc2HandoverLog)});
  var host=root.querySelector('#r676-accountability-handover-log-view');if(!host){host=document.createElement('section');host.id='r676-accountability-handover-log-view';host.className='card';root.appendChild(host)}
  var f=filters(),rows=filteredRows(),depOptions='<option value="">All departments / كل الأقسام</option>'+departments().map(function(row){return '<option value="'+esc(row.id)+'" '+(String(f.department)===String(row.id)?'selected':'')+'>'+esc(row.name||row.id)+'</option>'}).join('');
  host.innerHTML='<div class="ch"><div><span class="ct">Handover activity log / سجل نشاط الاستلام والتسليم</span><div class="fhint">Separate, filterable audit trail for approvals, manual handovers, and temporary dual QR handovers.</div></div><button type="button" class="btn bg bsm" data-acc2-log-print>🖨 Print filtered log / طباعة السجل</button></div><div class="cb"><div class="acc2-filter-grid"><div class="fg"><label>Department / القسم</label><select data-acc2-log-filter="department">'+depOptions+'</select></div><div class="fg"><label>From date / من تاريخ</label><input type="date" value="'+esc(f.from)+'" data-acc2-log-filter="from"></div><div class="fg"><label>To date / إلى تاريخ</label><input type="date" value="'+esc(f.to)+'" data-acc2-log-filter="to"></div><div class="fg"><label>Method / الطريقة</label><select data-acc2-log-filter="method"><option value="">All methods / كل الطرق</option><option value="temporary_dual_qr" '+(f.method==='temporary_dual_qr'?'selected':'')+'>Dual QR / رمزان QR</option><option value="manual" '+(f.method==='manual'?'selected':'')+'>Manual / يدوي</option><option value="recorded" '+(f.method==='recorded'?'selected':'')+'>Recorded / مسجل</option></select></div><div class="fg"><label>Activity / النشاط</label><select data-acc2-log-filter="kind"><option value="">All activity / كل النشاط</option><option value="submitted" '+(f.kind==='submitted'?'selected':'')+'>Submitted / مرفوع</option><option value="approved" '+(f.kind==='approved'?'selected':'')+'>Approved / معتمد</option><option value="completed" '+(f.kind==='completed'?'selected':'')+'>Completed / مكتمل</option></select></div><div class="fg"><label>Search / بحث</label><input value="'+esc(f.search)+'" placeholder="Medicine, user, or department" data-acc2-log-filter="search"></div></div><div class="fl g8" style="margin:8px 0 12px"><span class="chip">'+rows.length+' matching record(s) / سجل مطابق</span><button type="button" class="btn bg bsm" data-acc2-log-clear>Clear filters / إلغاء الفلاتر</button></div><div class="tw"><table class="acc2-table"><thead><tr><th>Time / الوقت</th><th>Activity / النشاط</th><th>Department / القسم</th><th>Medicines / الأدوية</th><th>Units</th><th>Performed by / المنفذ</th><th>Method / الطريقة</th><th>Status</th></tr></thead><tbody>'+(rows.length?rows.map(function(row){return '<tr><td>'+esc(row.at||'—')+'</td><td><b>'+esc(row.label)+'</b></td><td>'+esc(deptName(row.dept))+'</td><td>'+esc(row.medicine)+'</td><td>'+esc(row.units==null?'—':row.units)+'</td><td>'+esc(row.actor)+'</td><td>'+esc(methodLabel(row.method))+'</td><td>'+esc(row.status||'—')+'</td></tr>'}).join(''):'<tr><td colspan="8" class="acc2-empty">No handover activity matches these filters. / لا توجد سجلات مطابقة للفلاتر.</td></tr>')+'</tbody></table></div></div>';
}
function showLog(){window.__acc2HandoverLogOpen=true;if(typeof window.acc2SetAdminTab==='function')window.acc2SetAdminTab('handover');setTimeout(renderLog,0)}
document.addEventListener('click',function(event){var target=event.target&&event.target.closest&&event.target.closest('[data-acc2-handover-log],[data-acc2-log-clear],[data-acc2-log-print]');if(!target)return;if(target.dataset.acc2HandoverLog){showLog();return}if(target.hasAttribute('data-acc2-log-clear')){window.__acc2HandoverLogFilters={department:'',from:'',to:'',method:'',kind:'',search:''};renderLog();return}if(target.hasAttribute('data-acc2-log-print'))printRows()},true);
document.addEventListener('input',function(event){var field=event.target&&event.target.dataset&&event.target.dataset.acc2LogFilter;if(field){filters()[field]=event.target.value;renderLog()}},true);
document.addEventListener('change',function(event){var field=event.target&&event.target.dataset&&event.target.dataset.acc2LogFilter;if(field){filters()[field]=event.target.value;renderLog()}},true);
var previous=window.renderMedicationAccountability;
if(typeof previous==='function'&&!previous.__r676HandoverLogView){var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(function(){var root=document.getElementById('r17-accountability-root');if(!root)return;root.querySelectorAll('#r676-accountability-handover-log').forEach(function(node){node.remove()});if(!window.__acc2HandoverLogOpen){hideBase(root,false);ensureButton(root)}else renderLog()},0);return result};wrapped.__r676HandoverLogView=true;window.renderMedicationAccountability=wrapped}
document.addEventListener('click',function(event){var tab=event.target&&event.target.closest&&event.target.closest('.acc2-tab');if(tab&&!tab.dataset.acc2HandoverLog)window.__acc2HandoverLogOpen=false},true);
setTimeout(function(){var root=document.getElementById('r17-accountability-root');if(root){ensureButton(root);root.querySelectorAll('#r676-accountability-handover-log').forEach(function(node){node.remove()})}},0);
})();

// --- Merged from 79-r676-independent-regimen-database.js (Phase 6 consolidation) ---
(function(){
'use strict';
var CATALOG='accountability_regimen_catalog_v1',REGIMENS='accountability_regimens_v3',UI={dept:'',edit:''};
function esc(v){return window.fsEsc?window.fsEsc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rows(key){var value=window.S&&S.g&&S.g(key);return Array.isArray(value)?value:[]}
function save(key,value){return window.S&&S.s?S.s(key,value):Promise.reject(new Error('Medication Accountability data store is unavailable.'))}
function user(){return window.CU||{}}
function role(){return String(user().role||'').trim().toLowerCase()}
function canManage(){return !!(user().master||['pharmacy','pharmacy_director','pharmacy_staff','inpatient_supervisor','inpatient_pharmacy_supervisor','inpatient pharmacy supervisor','outpatient_pharmacy_supervisor'].indexOf(role())>=0)}
function scopedDept(){return ['outpatient_pharmacy_supervisor','inpatient_supervisor','inpatient_pharmacy_supervisor','inpatient pharmacy supervisor'].indexOf(role())>=0?String(user().deptId||user().departmentId||'').trim():''}
function depts(){return rows('departments').filter(function(d){return d&&d.id&&d.deleted!==true})}
function deptName(id){var row=depts().find(function(d){return String(d.id)===String(id)});return row?(row.name||row.id):id||'—'}
function id(prefix){return prefix+'_'+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2))}
function now(){return new Date().toISOString()}
function actor(){return String(user().email||user().name||'Pharmacy')}
function toast(message,kind){if(window.toast)window.toast(message,kind||'succ')}
function validDept(value){var scope=scopedDept();return !!value&&(!scope||String(scope)===String(value))}
function catalog(dept){return rows(CATALOG).filter(function(row){return row&&String(row.deptId)===String(dept)})}
function activeCatalog(dept){return catalog(dept).filter(function(row){return row.active!==false})}
function activeVersion(regimen){return (regimen.versions||[]).find(function(v){return String(v.id)===String(regimen.activeVersionId)})||(regimen.versions||[])[0]||{}}
function severity(value){return ({low:'Low / منخفضة',moderate:'Moderate / متوسطة',high:'High / عالية',critical:'Critical / حرجة'})[value]||String(value||'—')}
function currentDept(){return UI.dept||scopedDept()||String((depts()[0]||{}).id||'')}
function departmentOptions(selected){var scope=scopedDept(),list=scope?depts().filter(function(d){return String(d.id)===scope}):depts();return list.map(function(d){return '<option value="'+esc(d.id)+'" '+(String(d.id)===String(selected)?'selected':'')+'>'+esc(d.name||d.id)+'</option>'}).join('')}
function planQR(regimen){var version=activeVersion(regimen),text=['ASDHealth approved regimen',regimen.name,regimen.infectionSource,version.lineType,severity(version.severity),(version.items||[]).map(function(item){return item.medName+' x '+item.qty}).join('; ')].join(' | ');return window.ASD_QR&&window.ASD_QR.imageMarkup?window.ASD_QR.imageMarkup(text,{width:108,height:108,alt:'Approved regimen QR',errorCorrection:'H'}):'<span class="fhint">QR unavailable</span>'}
function catalogPanel(dept){var list=catalog(dept);return '<div class="card"><div class="ch"><div><span class="ct">Medication Accountability medicine database / قاعدة أدوية العهدة والاستهلاك</span><div class="fhint">One independent database for custody setup and treatment plans. Adding a medicine here never creates a custody record or a regimen automatically.</div></div></div><div class="cb"><div class="grid g3"><div class="fg"><label>Department / القسم *</label><select id="acc3-catalog-dept" onchange="acc3SetDept(this.value)">'+departmentOptions(dept)+'</select></div><div class="fg"><label>Medicine name / اسم العلاج *</label><input id="acc3-catalog-name" placeholder="e.g. Piperacillin/tazobactam"></div><div class="fg"><label>Strength or note / التركيز أو ملاحظة</label><input id="acc3-catalog-note" placeholder="e.g. 4.5 g vial"></div></div><button class="btn bp" type="button" onclick="acc3AddMedicine()">+ Add accountability medicine / إضافة دواء للعهدة والخطط</button><div class="tw" style="margin-top:14px"><table class="acc2-table"><thead><tr><th>Medicine</th><th>Details</th><th>Use</th><th>Status</th><th>Action</th></tr></thead><tbody>'+(list.length?list.map(function(row){return '<tr><td><b>'+esc(row.name)+'</b></td><td>'+esc(row.note||'—')+'</td><td>Custody setup + treatment plans</td><td>'+esc(row.active===false?'Inactive / غير فعال':'Active / فعال')+'</td><td><button class="btn bsm '+(row.active===false?'bs':'bd2c')+'" type="button" onclick="acc3ToggleMedicine(\''+esc(row.id)+'\')">'+(row.active===false?'Activate / تفعيل':'Deactivate / إيقاف')+'</button></td></tr>'}).join(''):'<tr><td colspan="5" class="acc2-empty">No accountability medicines yet. Add one here, then use it for custody or a treatment plan.</td></tr>')+'</tbody></table></div></div></div>'}
function itemPicker(dept,selected){var picked=selected||{};var list=activeCatalog(dept);return '<div class="acc2-regimen-items">'+(list.length?list.map(function(row){var item=picked[row.id]||{};return '<label class="acc2-regimen-item"><input type="checkbox" data-acc3-regimen-catalog="'+esc(row.id)+'" '+(picked[row.id]?'checked':'')+'><span><b>'+esc(row.name)+'</b><small>'+esc(row.note||'Independent regimen database')+'</small></span><input class="acc2-regimen-qty" data-acc3-qty="'+esc(row.id)+'" type="number" min="0.001" step="any" value="'+esc(item.qty||'')+'" placeholder="Planned units / الوحدات المحددة"></label>'}).join(''):'<div class="acc2-empty">Add medicines above to the independent regimen database first. Custody setup is not required.</div>')+'</div>'}
function builder(dept){var existing=UI.edit?rows(REGIMENS).find(function(r){return String(r.id)===String(UI.edit)}):null,version=existing?activeVersion(existing):{},picked={};(version.items||[]).forEach(function(item){picked[item.catalogId]={qty:item.qty}});return '<div class="card" id="acc2-independent-regimens"><div class="ch"><div><span class="ct">Create regimen / إنشاء خطة علاجية</span><div class="fhint">Select medicines only from the independent regimen medicine database. Each plan needs one or more medicines and planned quantities.</div></div></div><div class="cb"><div class="grid g4"><div class="fg"><label>Department / القسم *</label><select id="acc3-regimen-dept" onchange="acc3SetDept(this.value)" '+(existing?'disabled':'')+'>'+departmentOptions(existing?existing.deptId:dept)+'</select></div><div class="fg"><label>Regimen name / اسم الخطة *</label><input id="acc3-name" value="'+esc(existing?existing.name:'')+'" '+(existing?'readonly':'')+'></div><div class="fg"><label>Infection source / indication *</label><input id="acc3-source" value="'+esc(existing?existing.infectionSource:'')+'"></div><div class="fg"><label>Treatment line *</label><select id="acc3-line"><option value="first_line" '+(version.lineType==='first_line'?'selected':'')+'>First-line</option><option value="second_line" '+(version.lineType==='second_line'?'selected':'')+'>Second-line</option><option value="third_line" '+(version.lineType==='third_line'?'selected':'')+'>Third-line</option></select></div><div class="fg"><label>Severity / درجة الشدة *</label><input id="acc3-severity" list="acc3-severity-opts" value="'+esc(version.severity||'moderate')+'" placeholder="e.g. moderate, high…"><datalist id="acc3-severity-opts"><option value="low">Low / منخفضة</option><option value="moderate">Moderate / متوسطة</option><option value="high">High / عالية</option><option value="critical">Critical / حرجة</option></datalist></div><div class="fg"><label>Version label *</label><input id="acc3-label" value="'+esc(version.label||'A')+'"></div></div>'+itemPicker(existing?existing.deptId:dept,picked)+'<div class="fl g8" style="margin-top:12px"><button class="btn bp" type="button" onclick="acc3SaveRegimen()">'+(existing?'Save new version / حفظ نسخة جديدة':'Create regimen / إنشاء خطة')+'</button>'+(existing?'<button class="btn bs" type="button" onclick="acc3CancelEdit()">Cancel / إلغاء</button>':'')+'</div></div></div>'}
function regimenTable(){var list=rows(REGIMENS);return '<div class="card"><div class="ch"><span class="ct">Configured regimens / الخطط المعرّفة</span></div><div class="cb">'+(list.length?'<div class="tw"><table class="acc2-table"><thead><tr><th>Plan</th><th>Department</th><th>Indication</th><th>Line & severity</th><th>Medicines / quantities</th><th>Active QR</th><th>Actions</th></tr></thead><tbody>'+list.map(function(row){var v=activeVersion(row),items=(v.items||[]).map(function(i){return '<li>'+esc(i.medName)+' × '+esc(i.qty)+'</li>'}).join('');return '<tr><td><b>'+esc(row.name)+'</b><div class="fhint">'+esc(v.label||'—')+'</div></td><td>'+esc(deptName(row.deptId))+'</td><td>'+esc(row.infectionSource||'—')+'</td><td>'+esc(v.lineType||'—')+'<br><span class="badge '+(/^(high|critical)/i.test(String(v.severity||''))?'brd':'bbl')+'">'+esc(severity(v.severity))+'</span></td><td><ul style="margin:0;padding-inline-start:18px">'+items+'</ul></td><td>'+planQR(row)+'</td><td><div class="fl g8"><button class="btn bs bsm" type="button" onclick="acc3EditRegimen(\''+esc(row.id)+'\')">+ Version</button><button class="btn bp bsm" type="button" onclick="acc3PrintRegimen(\''+esc(row.id)+'\')">Print / طباعة</button><button class="btn '+(row.paused?'bs':'bd2c')+' bsm" type="button" onclick="acc3ToggleRegimen(\''+esc(row.id)+'\')">'+(row.paused?'Resume':'Pause')+'</button></div></td></tr>'}).join('')+'</tbody></table></div>':'<div class="acc2-empty">No regimens configured. Existing legacy plans are retained separately and are not changed by this database.</div>')+'</div></div>'}
window.acc2IndependentRegimensTab=function(){if(!canManage())return '<div class="alert-banner">This role cannot manage regimens.</div>';var dept=currentDept();return catalogPanel(dept)+builder(dept)+regimenTable()};
window.acc3SetDept=function(value){
  if(!validDept(value))return toast('This account is limited to its assigned department.','err');
  // Switching department here re-renders the whole Regimens tab immediately
  // (the medicine/item picker below is scoped to the selected department),
  // which used to silently wipe any text already typed into the sibling
  // "add medicine" / "create regimen" fields since they're plain rebuilt
  // inputs with no value tracked in UI state. Snapshot them across the
  // rebuild so an in-progress entry survives a department switch.
  var draft={
    catalogName:(document.getElementById('acc3-catalog-name')||{}).value||'',
    catalogNote:(document.getElementById('acc3-catalog-note')||{}).value||'',
    regimenName:(document.getElementById('acc3-name')||{}).value||'',
    regimenSource:(document.getElementById('acc3-source')||{}).value||''
  };
  UI.dept=value;UI.edit='';
  window.renderMedicationAccountability();
  if(draft.catalogName){var cn=document.getElementById('acc3-catalog-name');if(cn)cn.value=draft.catalogName}
  if(draft.catalogNote){var ct=document.getElementById('acc3-catalog-note');if(ct)ct.value=draft.catalogNote}
  if(draft.regimenName){var rn=document.getElementById('acc3-name');if(rn)rn.value=draft.regimenName}
  if(draft.regimenSource){var rs=document.getElementById('acc3-source');if(rs)rs.value=draft.regimenSource}
};
window.acc3AddMedicine=async function(){if(!canManage())return toast('Not authorized.','err');var dept=(document.getElementById('acc3-catalog-dept')||{}).value||currentDept(),name=String((document.getElementById('acc3-catalog-name')||{}).value||'').trim(),note=String((document.getElementById('acc3-catalog-note')||{}).value||'').trim();if(!validDept(dept)||!name)return toast('Department and medicine name are required.','err');var all=rows(CATALOG).slice();if(all.some(function(row){return String(row.deptId)===String(dept)&&String(row.name||'').trim().toLowerCase()===name.toLowerCase()}))return toast('This regimen medicine already exists for the department.','err');all.push({id:id('acc3m'),deptId:dept,name:name,note:note,active:true,createdAt:now(),createdBy:actor()});await save(CATALOG,all);toast('Regimen medicine added ✓');window.renderMedicationAccountability()};
window.acc3ToggleMedicine=async function(rowId){if(!canManage())return toast('Not authorized.','err');var all=rows(CATALOG).map(function(row){return Object.assign({},row)}),row=all.find(function(x){return String(x.id)===String(rowId)});if(!row)return;row.active=row.active===false;row.updatedAt=now();row.updatedBy=actor();await save(CATALOG,all);window.renderMedicationAccountability()};
window.acc3SaveRegimen=async function(){if(!canManage())return toast('Not authorized.','err');var edit=UI.edit?rows(REGIMENS).find(function(r){return String(r.id)===String(UI.edit)}):null,dept=edit?edit.deptId:((document.getElementById('acc3-regimen-dept')||{}).value||''),name=edit?edit.name:String((document.getElementById('acc3-name')||{}).value||'').trim(),source=String((document.getElementById('acc3-source')||{}).value||'').trim(),label=String((document.getElementById('acc3-label')||{}).value||'').trim(),items=[];if(!validDept(dept)||!name||!source||!label)return toast('Department, plan name, indication and version label are required.','err');document.querySelectorAll('[data-acc3-regimen-catalog]:checked').forEach(function(box){var catalogId=box.getAttribute('data-acc3-regimen-catalog'),entry=rows(CATALOG).find(function(x){return String(x.id)===String(catalogId)}),input=document.querySelector('[data-acc3-qty="'+CSS.escape(catalogId)+'"]'),qty=Number(input&&input.value||0);if(entry&&qty>0)items.push({catalogId:catalogId,medName:entry.name,qty:qty})});if(!items.length)return toast('Select at least one medicine with a planned quantity.','err');var version={id:id('acc3v'),label:label,lineType:(document.getElementById('acc3-line')||{}).value||'first_line',severity:(document.getElementById('acc3-severity')||{}).value||'moderate',items:items,createdAt:now(),createdBy:actor()},all=rows(REGIMENS).map(function(r){return Object.assign({},r)});if(edit){var row=all.find(function(r){return String(r.id)===String(edit.id)});row.infectionSource=source;row.versions=(row.versions||[]).concat([version]);row.activeVersionId=version.id;row.updatedAt=now();row.updatedBy=actor()}else all.push({id:id('acc3r'),deptId:dept,name:name,infectionSource:source,versions:[version],activeVersionId:version.id,paused:false,createdAt:now(),createdBy:actor()});await save(REGIMENS,all);UI.edit='';toast('Regimen saved and activated ✓');window.renderMedicationAccountability()};
window.acc3EditRegimen=function(rowId){UI.edit=rowId;window.renderMedicationAccountability()};
window.acc3CancelEdit=function(){UI.edit='';window.renderMedicationAccountability()};
window.acc3ToggleRegimen=async function(rowId){if(!canManage())return toast('Not authorized.','err');var all=rows(REGIMENS).map(function(r){return Object.assign({},r)}),row=all.find(function(r){return String(r.id)===String(rowId)});if(!row)return;row.paused=!row.paused;row.updatedAt=now();row.updatedBy=actor();await save(REGIMENS,all);window.renderMedicationAccountability()};
window.acc3PrintRegimen=function(rowId){var row=rows(REGIMENS).find(function(r){return String(r.id)===String(rowId)});if(!row)return;var v=activeVersion(row),items=(v.items||[]).map(function(i,n){return '<tr><td>'+String(n+1)+'</td><td>'+esc(i.medName)+'</td><td>'+esc(i.qty)+'</td></tr>'}).join('');if(typeof window.fsOfficialPrint!=='function')return toast('Official printing is not ready. Reload the page and try again.','err');window.fsOfficialPrint({title:row.name||'Approved regimen',css:'body{font:14px Arial;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #555;padding:8px;text-align:left}th{background:#e8f5e9}',html:'<h1>'+esc(row.name)+'</h1><p><b>Department:</b> '+esc(deptName(row.deptId))+'<br><b>Indication:</b> '+esc(row.infectionSource)+'<br><b>Line:</b> '+esc(v.lineType)+' · <b>Severity:</b> '+esc(severity(v.severity))+'</p><table><thead><tr><th>#</th><th>Medicine</th><th>Planned units</th></tr></thead><tbody>'+items+'</tbody></table>'})};
(function(){var original=window.acc2SaveAssignment;if(typeof original!=='function'||original.__acc3CatalogWrap)return;var wrapped=async function(){var dept=String((document.getElementById('acc2-assignment-dept')||{}).value||''),name=String((document.getElementById('acc2-assignment-med')||{}).value||'').trim(),result=await original.apply(this,arguments);if(!canManage()||!validDept(dept)||!name)return result;var saved=rows('accountability_assignments_v2').some(function(row){return row&&String(row.deptId)===dept&&String(row.medName||'').trim().toLowerCase()===name.toLowerCase()});if(!saved)return result;var all=rows(CATALOG).slice(),row=all.find(function(item){return item&&String(item.deptId)===dept&&String(item.name||'').trim().toLowerCase()===name.toLowerCase()});if(!row){all.push({id:id('acc3m'),deptId:dept,name:name,note:'Added from custody setup',active:true,createdAt:now(),createdBy:actor(),sources:['custody']});try{await save(CATALOG,all)}catch(error){console.warn('Custody saved but Accountability medicine database sync failed.',error)}}return result};wrapped.__acc3CatalogWrap=true;window.acc2SaveAssignment=wrapped})();
})();

// --- Merged from 64-r671-permissions-and-accountability-qr.js (Phase 6 consolidation) ---
(function(){
'use strict';
var esc=window.fsEsc;
function qrPanel(url,alt){
  if(window.ASD_QR&&typeof window.ASD_QR.imageMarkup==='function'){
    return window.ASD_QR.imageMarkup(url,{width:260,height:260,alt:alt,errorCorrection:'H'});
  }
  return '<div class="alert-banner-y">QR rendering is unavailable. Use the secure link below.<br>تعذر رسم رمز QR. استخدم الرابط الآمن أدناه.</div>';
}
function handoverUrl(data,party,token){
  var url=new URL('/accountability-handover.html',window.location.origin);
  url.hash=new URLSearchParams({session:data.sessionId,party:party,token:token}).toString();
  return url.toString();
}

function canManageSchedule(){return !!(window.fsHasCapability&&window.fsHasCapability('schedule.manage'))}
function enforceScheduleReadOnly(){
  var page=document.getElementById('pg-schedule');if(!page)return;
  var allowed=canManageSchedule();
  page.querySelectorAll('.schedule-manage-only').forEach(function(node){node.style.display=allowed?'':'none'});
  page.querySelectorAll('#req-windows-list button,#disp-slots-list button,.monthly-lim-inp,.r18-limit-24,.r18-limit-7,#request-hour-grid input,#request-hour-grid button,#request-grid-targets input,#request-grid-source').forEach(function(node){
    if(node.matches('button'))node.style.display=allowed?'':'none';else node.disabled=!allowed;
  });
  var card=page.querySelector('.stitle'),notice=document.getElementById('r671-schedule-readonly');
  if(!allowed&&!notice&&card){notice=document.createElement('div');notice.id='r671-schedule-readonly';notice.className='alert-banner-y';notice.innerHTML='<div dir="rtl">هذه الصفحة للعرض فقط لمشرف صيدلية التنويم. تعديل أوقات وحدود الطلب مخصص لمدير الصيدلية.</div><div dir="ltr">Schedule is read-only for the Inpatient Pharmacy Supervisor. Only the Pharmacy Director may change ordering windows and limits.</div>';card.insertAdjacentElement('afterend',notice)}
  if(allowed&&notice)notice.remove();
}
function installPermissionUi(){
  enforceScheduleReadOnly();
  var previous=window.schedulePagePostRender;
  if(previous&&!previous.__r671PermissionWrap){
    var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(enforceScheduleReadOnly,0);return result};
    wrapped.__r671PermissionWrap=true;window.schedulePagePostRender=wrapped;
  }
}
function closeModal(){var modal=document.getElementById('r671-handover-modal');if(modal)modal.remove()}
function showModal(data){closeModal();var pharmacyUrl=handoverUrl(data,'pharmacy',data.pharmacyToken),departmentUrl=handoverUrl(data,'department',data.departmentToken),modal=document.createElement('div');modal.id='r671-handover-modal';modal.className='modal-bg on';modal.innerHTML='<div class="modal" style="max-width:980px"><div class="mh"><div><span class="mt">Temporary dual QR handover / الاستلام والتسليم برمزي QR مؤقتين</span><div class="fhint">'+esc(data.departmentName)+' · expires '+esc(new Date(data.expiresAt).toLocaleString())+'</div></div><button class="xbtn" type="button" data-r671-close>✕</button></div><div class="alert-banner-y">Keep the two QR codes separate. The pharmacy scans the delivery QR and the department scans the receipt QR. Balance replenishment occurs only after both confirmations.<br>احتفظ بالرمزين منفصلين. تمسح الصيدلية رمز التسليم ويمسح القسم رمز الاستلام، ولا يُعوض الرصيد إلا بعد التأكيدين.</div><div class="r671-qr-grid"><section><h3>1. Pharmacy delivery<br>تسليم الصيدلية</h3>'+qrPanel(pharmacyUrl,'Pharmacy delivery QR')+'<textarea readonly>'+esc(pharmacyUrl)+'</textarea><button class="btn bg" type="button" data-r671-copy="'+esc(pharmacyUrl)+'">Copy pharmacy link / نسخ رابط الصيدلية</button></section><section><h3>2. Department receipt<br>استلام القسم</h3>'+qrPanel(departmentUrl,'Department receipt QR')+'<textarea readonly>'+esc(departmentUrl)+'</textarea><button class="btn bg" type="button" data-r671-copy="'+esc(departmentUrl)+'">Copy department link / نسخ رابط القسم</button></section></div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bp" type="button" data-r671-close>Done / تم</button></div></div>';document.body.appendChild(modal)}
async function createHandover(deptId,button){var ids=Array.from(document.querySelectorAll('.acc2-qr-usage[data-dept="'+CSS.escape(String(deptId))+'"]:checked:not(:disabled)')).map(function(x){return x.value});if(!ids.length)return window.toast&&toast('Select one or more approved records first. / اختر سجلًا معتمدًا واحدًا على الأقل.','err');if(button){button.disabled=true;button.textContent='Creating QR… / جاري إنشاء الرموز'}try{if(!(window.fsHasCapability&&window.fsHasCapability('accountability.handover.create')))throw new Error('This role cannot create accountability handovers.');if(typeof window.fsCallFunction!=='function')throw new Error('Secure service is still loading. Please retry.');var data=await window.fsCallFunction('createAccountabilityHandover',{usageIds:ids,expiresInMinutes:30});if(!data||!data.sessionId)throw new Error('The QR handover service returned an incomplete response.');showModal(data);if(window.toast)toast('Temporary pharmacy and department QR codes created ✓','succ');if(typeof window.renderMedicationAccountability==='function')setTimeout(window.renderMedicationAccountability,700)}catch(error){console.error('QR handover creation failed',error);var message=String(error&&error.message||error).replace(/^FirebaseError:\s*/,'');if(window.toast)toast(message,'err')}finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Create temporary dual QR / إنشاء رمزي QR مؤقتين'}}}
setTimeout(installPermissionUi,0);
window.__startAppExtensions=window.__startAppExtensions||[];
window.__startAppExtensions.push(function(){setTimeout(installPermissionUi,500)});
document.addEventListener('click',function(event){var action=event.target.closest('[data-acc2-qr-action]');if(action){var dept=action.getAttribute('data-dept'),kind=action.getAttribute('data-acc2-qr-action');if(kind==='select'){document.querySelectorAll('.acc2-qr-usage[data-dept="'+CSS.escape(String(dept))+'"]:not(:disabled)').forEach(function(x){x.checked=true})}else if(kind==='create')createHandover(dept,action);return}if(event.target.closest('[data-r671-close]')){closeModal();return}var copy=event.target.closest('[data-r671-copy]');if(copy){var value=copy.getAttribute('data-r671-copy')||'';navigator.clipboard&&navigator.clipboard.writeText(value).then(function(){window.toast&&toast('Link copied ✓','succ')}).catch(function(){window.prompt('Copy link',value)})}},true);
})();

export {};

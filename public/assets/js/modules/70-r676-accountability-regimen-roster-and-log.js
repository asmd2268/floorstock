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
function ensureButton(root){if(window.acc2DepartmentRole&&window.acc2DepartmentRole()&&!window.acc2EffectiveMaster())return;var tabs=root.querySelector('.acc2-tabs');if(!tabs||tabs.dataset.acc2DeptTabs||tabs.querySelector('[data-acc2-handover-log]'))return;var button=document.createElement('button');button.type='button';button.className='acc2-tab';button.dataset.acc2HandoverLog='1';button.textContent='Handover activity log / سجل الاستلام والتسليم';tabs.appendChild(button)}
function renderLog(){
  if(window.acc2DepartmentRole&&window.acc2DepartmentRole()&&!window.acc2EffectiveMaster())return;
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
if(typeof previous==='function'&&!previous.__r676HandoverLogView){var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(function(){var root=document.getElementById('r17-accountability-root');if(!root)return;root.querySelectorAll('#r676-accountability-handover-log').forEach(function(node){node.remove()});if(window.acc2DepartmentRole&&window.acc2DepartmentRole()&&!window.acc2EffectiveMaster())return;if(!window.__acc2HandoverLogOpen){hideBase(root,false);ensureButton(root)}else renderLog()},0);return result};wrapped.__r676HandoverLogView=true;window.renderMedicationAccountability=wrapped}
document.addEventListener('click',function(event){var tab=event.target&&event.target.closest&&event.target.closest('.acc2-tab');if(tab&&!tab.dataset.acc2HandoverLog)window.__acc2HandoverLogOpen=false},true);
setTimeout(function(){var root=document.getElementById('r17-accountability-root');if(!root)return;root.querySelectorAll('#r676-accountability-handover-log').forEach(function(node){node.remove()});if(!(window.acc2DepartmentRole&&window.acc2DepartmentRole()&&!window.acc2EffectiveMaster()))ensureButton(root)},0);
})();

// --- Merged from 79-r676-independent-regimen-database.js (Phase 6 consolidation) ---
(function(){
'use strict';
var CATALOG='accountability_regimen_catalog_v1',REGIMENS='accountability_regimens_v3',PLAN_USAGE_KEY='accountability_plan_usage_v1',UI={dept:'',edit:''};
function esc(v){return window.fsEsc?window.fsEsc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rows(key){var value=window.S&&S.g&&S.g(key);return Array.isArray(value)?value:[]}
function norm(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,'')}
function sameDept(a,b){if(!a&&!b)return true;if(!a||!b)return false;if(norm(a)===norm(b))return true;var da=depts().find(function(d){return norm(d.id)===norm(a)||norm(d.name||'')===norm(a)});var db=depts().find(function(d){return norm(d.id)===norm(b)||norm(d.name||'')===norm(b)});return !!(da&&db&&String(da.id)===String(db.id))}
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
function doseUnitSelect(cls,val){var opts=['mg','g','mcg','mL','IU','unit'];return '<select class="'+cls+'" style="width:62px" title="Dose unit / وحدة الجرعة">'+opts.map(function(o){return '<option value="'+o+'" '+(val===o?'selected':'')+'>'+o+'</option>'}).join('')+'</select>'}
function formSelect(cls,val){var opts=[['tab','tablet / قرص'],['cap','capsule / كبسولة'],['vial','vial / فايل'],['amp','ampule / امبيول'],['syr','syringe / حقنة'],['sac','sachet / ظرف'],['patch','patch / لصقة'],['other','other / أخرى']];return '<select class="'+cls+'" style="width:120px" title="Form / الشكل الدوائي">'+opts.map(function(o){return '<option value="'+o[0]+'" '+(val===o[0]?'selected':'')+'>'+o[1]+'</option>'}).join('')+'</select>'}
function routeSelect(cls,val){var opts=[['','— Route / الطريق —'],['IV','IV (وريدي)'],['IM','IM (عضلي)'],['IV_IM','IV أو IM'],['oral','Oral / فموي'],['SQ','SQ (تحت الجلد)'],['inh','Inhalation / استنشاق'],['top','Topical / موضعي'],['rec','Rectal / شرجي'],['other','Other / أخرى']];return '<select class="'+cls+'" style="width:130px">'+opts.map(function(o){return '<option value="'+o[0]+'" '+(val===o[0]?'selected':'')+'>'+o[1]+'</option>'}).join('')+'</select>'}
function doseTypeSelect(cls,val,rateId){return '<select class="'+cls+'" style="width:150px" onchange="acc3UpdateDoseRate(this,\''+rateId+'\')"><option value="fixed" '+((!val||val==="fixed")?"selected":"")+'>Fixed dose / جرعة ثابتة</option><option value="per_kg" '+(val==="per_kg"?"selected":"")+'>Per kg / حسب الوزن (mg/kg)</option></select>'}
window.acc3UpdateDoseRate=function(select,rateId){var inp=document.getElementById(rateId);if(!inp)return;var isPerKg=select.value==='per_kg';inp.disabled=!isPerKg;inp.style.opacity=isPerKg?'1':'0.35';if(!isPerKg)inp.value=''};
function itemRows(existingItems){var items=existingItems&&existingItems.length?existingItems:[{medName:'',dose:'',doseUnit:'mg',form:'vial',custodyQty:'',route:'',doseType:'fixed',doseRate:'',note:''}];var allNames=rows(CATALOG).filter(function(r){return r.active!==false}).map(function(r){return r.name});return '<div id="acc3-items-container" style="margin:8px 0">'+items.map(function(item,idx){var rateId='acc3-rate-'+idx+'-'+Date.now();var isFixed=!item.doseType||item.doseType==='fixed';return '<div class="acc3-item-row" style="border:1px solid var(--br);border-radius:6px;padding:8px 10px;margin-bottom:8px"><div class="fl g6 ic" style="flex-wrap:wrap;margin-bottom:6px"><input class="acc3-item-name" list="acc3-med-suggestions" value="'+esc(item.medName||'')+'" placeholder="Medicine name / اسم الدواء" style="flex:1;min-width:140px"><input class="acc3-item-dose" type="number" min="0" step="any" value="'+esc(item.dose!=null?item.dose:(item.qty||''))+'" placeholder="Dose / الجرعة" style="width:75px" title="Dose per administration / الجرعة لكل مرة">'+doseUnitSelect('acc3-item-doseunit',item.doseUnit||item.unitLabel||'mg')+formSelect('acc3-item-form',item.form||'vial')+'<div class="fl g4 ic"><input class="acc3-item-custodyqty" type="number" min="0" step="1" value="'+esc(item.custodyQty!=null?item.custodyQty:'')+'" placeholder="#" style="width:55px" title="Number of units in plan / العدد بالخطة"><span style="opacity:.6;font-size:11px;white-space:nowrap">in plan</span></div><button class="btn bd2c bxs" type="button" onclick="acc3RemoveItemRow(this)">✕</button></div><div class="fl g6 ic" style="flex-wrap:wrap">'+routeSelect('acc3-item-route',item.route||'')+doseTypeSelect('acc3-item-dosetype',item.doseType||'fixed',rateId)+'<div class="fl g4 ic"><input id="'+rateId+'" class="acc3-item-doserate" type="number" min="0" step="any" placeholder="Rate" style="width:65px;opacity:'+(isFixed?'0.35':'1')+'" value="'+esc(item.doseRate||'')+'" '+(isFixed?'disabled':'')+' title="Dose rate in mg/kg"><span style="opacity:.6;font-size:12px;white-space:nowrap">/ kg</span></div><input class="acc3-item-note" placeholder="⚠ Note (optional) / تنبيه اختياري" style="flex:1;min-width:120px" value="'+esc(item.note||'')+'"></div></div>'}).join('')+'</div><button class="btn bg bsm" type="button" onclick="acc3AddItemRow()">+ Add medicine / إضافة دواء</button><datalist id="acc3-med-suggestions">'+allNames.map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist>'}
function builder(dept){var existing=UI.edit?rows(REGIMENS).find(function(r){return String(r.id)===String(UI.edit)}):null,version=existing?activeVersion(existing):{};return '<div class="card" id="acc2-independent-regimens"><div class="ch"><div><span class="ct">'+(existing?'Edit regimen / تعديل الخطة العلاجية':'New treatment plan / إنشاء خطة علاجية')+'</span><div class="fhint">Type medicine names directly — one row per drug, enter name and planned quantity.</div></div></div><div class="cb"><div class="grid g3"><div class="fg"><label>Department / القسم *</label><select id="acc3-regimen-dept" onchange="acc3SetDept(this.value)" '+(existing?'disabled':'')+'>'+departmentOptions(existing?existing.deptId:dept)+'</select></div><div class="fg"><label>Plan name / اسم الخطة *</label><input id="acc3-name" value="'+esc(existing?existing.name:'')+'"></div><div class="fg"><label>Indication / السبب *</label><input id="acc3-source" value="'+esc(existing?existing.infectionSource:'')+'"></div><div class="fg"><label>Treatment line / خط العلاج *</label><select id="acc3-line"><option value="first_line" '+(version.lineType==='first_line'||!version.lineType?'selected':'')+'>First-line / الخط الأول</option><option value="second_line" '+(version.lineType==='second_line'?'selected':'')+'>Second-line / الخط الثاني</option><option value="third_line" '+(version.lineType==='third_line'?'selected':'')+'>Third-line / الخط الثالث</option></select></div><div class="fg"><label>Severity / درجة الشدة</label><input id="acc3-severity" list="acc3-severity-opts" value="'+esc(version.severity||'moderate')+'" placeholder="moderate, high, custom…"><datalist id="acc3-severity-opts"><option value="low">Low / منخفضة</option><option value="moderate">Moderate / متوسطة</option><option value="high">High / عالية</option><option value="critical">Critical / حرجة</option></datalist></div><div class="fg"><label>Version label / رمز النسخة *</label><input id="acc3-label" value="'+esc(version.label||'v1')+'"></div><div class="fg"><label>Age restriction / تقييد العمر <small style="font-weight:400;opacity:.65">(optional)</small></label><div class="fl g8"><div style="flex:1"><small style="opacity:.65">Min age (yrs) / الأدنى</small><br><input id="acc3-min-age" type="number" min="0" max="120" step="1" placeholder="—" value="'+esc(existing&&existing.minAge!=null?existing.minAge:'')+'" style="width:100%;margin-top:2px"></div><div style="flex:1"><small style="opacity:.65">Max age (yrs) / الأقصى</small><br><input id="acc3-max-age" type="number" min="0" max="120" step="1" placeholder="—" value="'+esc(existing&&existing.maxAge!=null?existing.maxAge:'')+'" style="width:100%;margin-top:2px"></div></div></div></div><div style="margin:14px 0 4px;font-weight:600">Medicines / الأدوية *</div>'+itemRows(version.items||[])+(existing?'<div class="fg acc2-check-field" style="margin-top:10px"><label><input type="checkbox" id="acc3-new-version" checked> Save as new version / حفظ كنسخة جديدة (uncheck to edit current version in-place)</label></div>':'')+'<div class="fl g8" style="margin-top:12px"><button class="btn bp" type="button" onclick="acc3SaveRegimen()">'+(existing?'Save / حفظ':'Create plan / إنشاء الخطة')+'</button>'+(existing?'<button class="btn bs" type="button" onclick="acc3CancelEdit()">Cancel / إلغاء</button>':'')+'</div></div></div>'}
// one-time migration: move any data from v2 to v3 (runs only when v3 is empty and v2 has data)
window.__acc3MigrateV2=async function(){if(!canManage())return;var v3=rows(REGIMENS);if(v3.length)return;var v2=rows('accountability_regimens_v2');if(!v2.length)return;try{await save(REGIMENS,v2);toast('Migrated '+v2.length+' treatment plan(s) from v2 to v3 ✓');window.renderMedicationAccountability&&window.renderMedicationAccountability()}catch(e){toast('Migration failed: '+String(e&&e.message||e),'err')}};
(function(){var _t=setInterval(function(){if(window.S&&typeof S.g==='function'){clearInterval(_t);if(rows(REGIMENS).length===0&&rows('accountability_regimens_v2').length>0)window.__acc3MigrateV2()}},3000)})();
var ROUTE_LABEL={'IV':'IV','IM':'IM','IV_IM':'IV/IM','oral':'Oral','SQ':'SQ','inh':'Inhal.','top':'Topical','rec':'Rectal','other':'Other'};
function regimenTable(){var list=rows(REGIMENS),manage=canManage();return '<div class="card"><div class="ch"><span class="ct">Treatment plans / الخطط العلاجية</span></div><div class="cb">'+(list.length?list.map(function(row){var v=activeVersion(row);var itemsHtml=(v.items||[]).map(function(i){var routeBadge=i.route?'<span class="badge bbl" style="font-size:10px;padding:1px 5px;margin:0 3px">'+esc(ROUTE_LABEL[i.route]||i.route)+'</span>':'';var doseInfo=i.doseType==='per_kg'&&i.doseRate?'<span style="font-size:11px;opacity:.75">'+esc(String(i.doseRate))+' '+(i.doseUnit||i.unitLabel||'mg')+'/kg</span>':i.dose?'<span style="font-size:11px;opacity:.75">'+esc(String(i.dose))+' '+esc(i.doseUnit||i.unitLabel||'')+'</span>':'';var countInfo=i.custodyQty?'<span style="font-size:11px;opacity:.55;margin-left:4px">× '+esc(String(i.custodyQty))+(i.form?' '+esc(i.form):'')+'</span>':'';var noteHtml=i.note?'<div style="font-size:11px;color:#e67e22;margin-top:2px">⚠ '+esc(i.note)+'</div>':'';return '<div style="border:1px solid var(--br);border-radius:4px;padding:5px 8px;margin-bottom:5px"><div class="fl g6 ic"><b style="flex:1">'+esc(i.medName)+'</b>'+routeBadge+doseInfo+countInfo+'</div>'+noteHtml+'</div>'}).join('');var statusBadge=row.paused?'<span class="badge bgr" style="margin-left:6px">Paused</span>':'';return '<div style="border:1px solid var(--br);border-radius:8px;padding:14px;margin-bottom:14px"><div class="fl g8 ic" style="margin-bottom:8px;flex-wrap:wrap"><div style="flex:1"><b style="font-size:15px">'+esc(row.name)+'</b>'+statusBadge+'<div class="fhint" style="margin-top:2px">'+esc(deptName(row.deptId))+' · '+esc(row.infectionSource||'—')+' · '+esc(({first_line:'1st-line',second_line:'2nd-line',third_line:'3rd-line'})[v.lineType]||v.lineType||'—')+'<span class="badge '+(/^(high|critical)/i.test(String(v.severity||''))?'brd':'bbl')+'" style="margin:0 6px">'+esc(severity(v.severity))+'</span>'+esc(v.label||'')+(row.minAge||row.maxAge?' · Age '+((row.minAge||'0')+'–'+(row.maxAge||'∞'))+' yrs':'')+'</div></div><div class="fl g6">'+planQR(row)+'</div></div><div>'+itemsHtml+'</div>'+(manage?'<div class="fl g6" style="margin-top:8px"><button class="btn bg bsm" type="button" onclick="acc3EditRegimen(\''+esc(row.id)+'\')">Edit / تعديل</button><button class="btn bp bsm" type="button" onclick="acc3PrintRegimen(\''+esc(row.id)+'\')">Print / طباعة</button><button class="btn '+(row.paused?'bs':'bd2c')+' bsm" type="button" onclick="acc3ToggleRegimen(\''+esc(row.id)+'\')">'+(row.paused?'Resume / استئناف':'Pause / إيقاف')+'</button></div>':'<div class="fl g6" style="margin-top:8px"><button class="btn bp bsm" type="button" onclick="acc3PrintRegimen(\''+esc(row.id)+'\')">Print / طباعة</button></div>')+'</div>'}).join(''):'<div class="acc2-empty">No treatment plans yet. / لا توجد خطط علاجية بعد.</div>')+'</div></div>'}
function todayStr(){return new Date().toISOString().slice(0,10)}
function puStatusLabel(s){return {pending_pharmacy:'Pending / قيد المراجعة',approved_waiting_receipt:'Approved — awaiting receipt / معتمد وبانتظار الاستلام',received_locked:'Received / تم الاستلام',rejected:'Rejected / مرفوض'}[s]||'Pending'}
function puStatusClass(s){return {approved_waiting_receipt:'bbl',received_locked:'bgn',rejected:'brd',pending_pharmacy:'bgr'}[s]||'bgr'}
function acc3ExpiryAlertBanner(deptId){
  var today=todayStr();
  var soon=new Date();soon.setDate(soon.getDate()+30);var soonStr=soon.toISOString().slice(0,10);
  var assignments=rows('accountability_assignments_v2').filter(function(a){return a&&sameDept(a.deptId,deptId)&&a.active!==false});
  var expired=[],expiringSoon=[];
  assignments.forEach(function(a){
    var dates=[];
    if(a.expiryDate)dates.push({med:a.medName,date:a.expiryDate});
    var deptExpiryRec=(rows('accountability_expiry_batches_v1')||[]).find(function(x){return String(x.assignmentId)===String(a.id)});
    (a.expiryBatches||[]).concat(deptExpiryRec?deptExpiryRec.batches||[]:[]).forEach(function(b){if(b&&b.date)dates.push({med:a.medName,date:b.date})});
    dates.forEach(function(d){if(d.date<=today)expired.push(d);else if(d.date<=soonStr)expiringSoon.push(d)});
  });
  var html='';
  if(expired.length)html+='<div class="alert-banner" style="margin-bottom:8px">🔴 Expired batches / دفعات منتهية الصلاحية: '+expired.map(function(d){return '<b>'+esc(d.med)+'</b> ('+esc(d.date)+')'}).join(' · ')+'</div>';
  if(expiringSoon.length)html+='<div class="alert-banner-y" style="margin-bottom:8px">⚠ Expiring within 30 days / تنتهي خلال 30 يوم: '+expiringSoon.map(function(d){return '<b>'+esc(d.med)+'</b> ('+esc(d.date)+')'}).join(' · ')+'</div>';
  return html;
}
function acc3PlanExpiryBanner(planList){var today=todayStr(),soon=new Date(today);soon.setDate(soon.getDate()+30);var soonStr=soon.toISOString().slice(0,10),expired=[],expiringSoon=[];planList.forEach(function(r){var d=getPlanExpiry(r.id);if(!d)return;if(d<today)expired.push(r.name+' ('+d+')');else if(d<=soonStr)expiringSoon.push(r.name+' ('+d+')')});var html='';if(expired.length)html+='<div class="alert-banner" style="margin-bottom:8px">🔴 Expired treatment plans / خطط علاجية منتهية: '+expired.map(function(n){return '<b>'+esc(n)+'</b>'}).join(' · ')+'</div>';if(expiringSoon.length)html+='<div class="alert-banner-y" style="margin-bottom:8px">⚠ Plans expiring within 30 days / خطط تنتهي خلال 30 يوم: '+expiringSoon.map(function(n){return '<b>'+esc(n)+'</b>'}).join(' · ')+'</div>';return html}
function acc3DeptPlanView(deptId){
  var planList=rows(REGIMENS).filter(function(r){return !r.paused&&sameDept(r.deptId,deptId)});
  var allUsages=rows(PLAN_USAGE_KEY);
  var assignments=rows('accountability_assignments_v2');
  function getAssignment(medName){return assignments.find(function(a){return a&&sameDept(a.deptId,deptId)&&norm(a.medName||'')===norm(medName||'')&&a.active!==false})}
  var pendingReceipts=allUsages.filter(function(u){return u&&sameDept(u.deptId,deptId)&&u.status==='approved_waiting_receipt'});
  var pendingReceiptHtml='';
  if(pendingReceipts.length){
    pendingReceiptHtml='<div class="card" style="border-left:4px solid var(--blue,#2196f3);margin-bottom:14px"><div class="ch"><span class="ct">🔔 Awaiting receipt / بانتظار استلام أدوية</span><div class="fhint">Pharmacy approved the following plan usages — confirm receipt after collecting the medicines.</div></div><div class="cb">'+
      pendingReceipts.map(function(u){
        var medsHtml=(u.medicines||[]).map(function(m){return '<span class="chip">'+esc(m.medName)+' × '+esc(m.actualQty)+'</span>'}).join(' ');
        return '<div style="border:1px solid var(--br);border-radius:6px;padding:10px;margin-bottom:8px">'+
          '<div class="fl g8 ic" style="flex-wrap:wrap;margin-bottom:4px">'+
            '<b>'+esc(u.planName||'—')+'</b>'+
            '<span class="fhint">'+esc(u.consumptionDate||'—')+'</span>'+
            '<span class="fhint">File: '+esc(u.patientFile||'—')+'</span>'+
            '<span class="fhint">Dr: '+esc(u.doctor||'—')+'</span>'+
          '</div>'+
          '<div style="margin:6px 0">'+medsHtml+'</div>'+
          '<button class="btn bs" type="button" onclick="acc3RecordPlanReceipt(\''+esc(u.id)+'\')">✓ Confirm receipt / تأكيد الاستلام</button>'+
        '</div>';
      }).join('')+
    '</div></div>';
  }
  var planExpiryHtml=acc3PlanExpiryBanner(planList);
  if(!planList.length)return acc3ExpiryAlertBanner(deptId)+pendingReceiptHtml+'<div class="acc2-empty">No treatment plans available for this department. / لا توجد خطط علاجية. تواصل مع الصيدلية.</div>';
  return acc3ExpiryAlertBanner(deptId)+planExpiryHtml+pendingReceiptHtml+
    '<div class="fhint" style="margin-bottom:12px">Select a plan, enter quantities used for each medicine, fill in patient details, then submit to pharmacy. / اختر خطة، أدخل كميات كل دواء، أضف بيانات المريض، ثم أرفع للصيدلية.</div>'+
    planList.map(function(plan){
      var v=activeVersion(plan);
      var deptUsages=allUsages.filter(function(u){return u&&String(u.planId)===String(plan.id)&&sameDept(u.deptId,deptId)}).sort(function(a,b){return String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))}).slice(0,8);
      var pid=esc(plan.id);
      var medicineInputs=(v.items||[]).map(function(item){
        var doseLabel=item.doseType==='per_kg'&&item.doseRate?String(item.doseRate)+' '+(item.doseUnit||item.unitLabel||'mg')+'/kg':(item.dose?String(item.dose)+' '+(item.doseUnit||item.unitLabel||''):'');
        var routeLabel=ROUTE_LABEL[item.route]||item.route||'';
        var noteHtml=item.note?'<div style="font-size:11px;color:#e67e22">⚠ '+esc(item.note)+'</div>':'';
        var asgn=getAssignment(item.medName);
        var expiryHtml='';
        var deptExRec=(rows('accountability_expiry_batches_v1')||[]).find(function(x){return asgn&&String(x.assignmentId)===String(asgn.id)});
        var allBatches=(asgn?asgn.expiryBatches||[]:[]).concat(deptExRec?deptExRec.batches||[]:[]);
        if(asgn&&allBatches.length){
          var today=todayStr();
          var hasExpired=allBatches.some(function(b){return b.date&&b.date<=today});
          expiryHtml='<div style="font-size:11px;margin-top:2px;opacity:.75">'+(hasExpired?'🔴':'📅')+' Exp: '+allBatches.map(function(b){return esc(b.date||'—')+(b.qty?'('+b.qty+')':'')}).join(', ')+'</div>';
        }
        return '<div style="border:1px solid var(--br);border-radius:4px;padding:7px 10px;margin-bottom:5px">'+
          '<div class="fl g6 ic"><b style="flex:1">'+esc(item.medName)+'</b>'+
          (doseLabel?'<span style="opacity:.65;font-size:11px">'+esc(doseLabel)+'</span>':'')+
          (routeLabel?'<span class="badge bbl" style="font-size:10px;padding:1px 5px">'+esc(routeLabel)+'</span>':'')+
          '<input class="acc3-pu-qty" data-plan-id="'+pid+'" data-med="'+esc(item.medName)+'" type="number" min="0" step="any" placeholder="Qty used / الكمية" style="width:100px">'+
          '<span style="opacity:.6;font-size:12px">'+esc(item.doseUnit||item.unitLabel||item.form||'unit')+'</span>'+
          '</div>'+noteHtml+expiryHtml+'</div>';
      }).join('');
      var histHtml=deptUsages.length?
        '<div style="margin-top:12px"><div class="fhint" style="margin-bottom:5px">Submission history / سجل الاستخدام</div><div class="tw"><table class="acc2-table" style="font-size:12px"><thead><tr><th>Date / التاريخ</th><th>Patient file / رقم الملف</th><th>Doctor / الطبيب</th><th>Medicines / الأدوية</th><th>Status / الحالة</th><th></th></tr></thead><tbody>'+
        deptUsages.map(function(u){return '<tr><td>'+esc(u.consumptionDate||'—')+'</td><td>'+esc(u.patientFile||'—')+'</td><td>'+esc(u.doctor||'—')+'</td><td style="font-size:11px">'+esc((u.medicines||[]).map(function(m){return m.medName+'×'+m.actualQty}).join(', ')||'—')+'</td><td><span class="badge '+puStatusClass(u.status)+'">'+puStatusLabel(u.status)+'</span></td><td>'+(u.status==='pending_pharmacy'?'<button class="btn bd2c bxs" type="button" onclick="acc3CancelPlanUsage(\''+esc(u.id)+'\')">✕ Cancel / إلغاء</button>':'')+'</td></tr>'}).join('')+
        '</tbody></table></div></div>':'';
      var ageNote=plan.minAge||plan.maxAge?'<div class="fhint" style="margin-top:2px">Age / العمر: '+(plan.minAge||'0')+'–'+(plan.maxAge||'∞')+' yrs</div>':'';var _planExp=getPlanExpiry(plan.id);var expiryNote=_planExp?'<div class="fhint" style="margin-top:2px">'+(_planExp<todayStr()?'🔴':'📅')+' Exp: '+esc(_planExp)+'</div>':'';
      return '<div style="border:1px solid var(--br);border-radius:8px;padding:14px;margin-bottom:14px">'+
        '<div class="fl g8 ic" style="margin-bottom:10px;flex-wrap:wrap">'+
          '<div style="flex:1"><b style="font-size:15px">'+esc(plan.name)+'</b>'+
            '<div class="fhint" style="margin-top:2px">'+esc(plan.infectionSource||'—')+' · '+esc(({first_line:'1st-line',second_line:'2nd-line',third_line:'3rd-line'})[v.lineType]||'')+
            ' <span class="badge '+(/^(high|critical)/i.test(String(v.severity||''))?'brd':'bbl')+'">'+esc(severity(v.severity))+'</span></div>'+ageNote+expiryNote+'</div>'+
          planQR(plan)+
        '</div>'+
        '<details><summary style="cursor:pointer;padding:6px 0;font-weight:600;list-style:none;user-select:none">▶ Submit plan usage / تسجيل استهلاك الخطة</summary>'+
          '<div style="margin-top:10px">'+
            '<div style="font-size:12px;opacity:.7;margin-bottom:8px">Enter actual quantity used for each medicine / أدخل الكمية المستهلكة فعلياً لكل دواء:</div>'+
            medicineInputs+
            '<div class="acc2-form-grid" style="margin-top:10px">'+
              '<div class="fg"><label>Consumption date / تاريخ الاستهلاك *</label><input class="acc3-pu-date" data-plan-id="'+pid+'" type="date" value="'+todayStr()+'" max="'+todayStr()+'"></div>'+
              '<div class="fg"><label>Patient file / رقم الملف *</label><input class="acc3-pu-file" data-plan-id="'+pid+'" placeholder="File number / رقم الملف"></div>'+
              '<div class="fg"><label>Doctor / الطبيب *</label><input class="acc3-pu-doctor" data-plan-id="'+pid+'" placeholder="Doctor name / اسم الطبيب"></div>'+
              '<div class="fg"><label>Notes / ملاحظات</label><input class="acc3-pu-note" data-plan-id="'+pid+'" placeholder="Optional / اختياري"></div>'+
            '</div>'+
            '<button class="btn bp" style="margin-top:10px" type="button" onclick="acc3SubmitPlanUsage(\''+pid+'\')">Submit to pharmacy / رفع للصيدلية</button>'+
          '</div>'+
        '</details>'+
        histHtml+
        '<details style="margin-top:10px;border-top:1px solid var(--br);padding-top:10px"><summary style="cursor:pointer;font-size:12px;opacity:.7;list-style:none;user-select:none">📅 Plan expiry reminder / تاريخ انتهاء الخطة</summary><div style="margin-top:8px;display:flex;gap:8px;align-items:center"><input class="acc3-plan-expiry-input" data-plan-id="'+pid+'" type="date" value="'+esc(getPlanExpiry(plan.id))+'" style="flex:1"><button class="btn bp bxs" type="button" onclick="acc3SavePlanExpiry(\''+pid+'\')">Save / حفظ</button></div><div class="fhint" style="margin-top:4px">An alert will appear when this date approaches. / تنبيه يظهر عند اقتراب هذا التاريخ.</div></details>'+
      '</div>';
    }).join('');
}
function planUsageReview(){
  var pending=rows(PLAN_USAGE_KEY).filter(function(u){return u.status==='pending_pharmacy'}).sort(function(a,b){return String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))});
  var waitingReceipt=rows(PLAN_USAGE_KEY).filter(function(u){return u.status==='approved_waiting_receipt'}).sort(function(a,b){return String(b.submittedAt||'').localeCompare(String(a.submittedAt||''))});
  var waitHtml=waitingReceipt.length?'<div class="card" style="margin-top:10px;border-left:4px solid var(--blue,#2196f3)"><div class="ch"><span class="ct">⏳ Awaiting dept receipt / بانتظار استلام الأقسام</span></div><div class="cb">'+waitingReceipt.map(function(u){var meds=(u.medicines||[]).map(function(m){return '<span class="chip">'+esc(m.medName)+' × '+esc(m.actualQty)+'</span>'}).join(' ');return '<div style="border:1px solid var(--br);border-radius:6px;padding:8px;margin-bottom:8px"><div class="fl g8 ic" style="flex-wrap:wrap;margin-bottom:4px"><b>'+esc(u.planName||'—')+'</b><span class="fhint">'+esc(deptName(u.deptId))+'</span><span class="fhint">'+esc(u.consumptionDate||'—')+'</span></div><div style="margin:4px 0">'+meds+'</div></div>'}).join('')+'</div></div>':'';
  if(!pending.length)return waitHtml+'<div class="alert-banner-y" style="margin-top:14px">No pending plan usage submissions. / لا توجد طلبات استهلاك معلقة.</div>';
  return waitHtml+'<div class="card" style="margin-top:16px"><div class="ch"><span class="ct">Plan usage review / مراجعة استهلاك الخطط</span><div class="fhint">Submitted by nursing staff — approve to deduct balances and send for receipt.</div></div><div class="cb">'+
    pending.map(function(u){
      var medsHtml=(u.medicines||[]).map(function(m){return '<span class="chip">'+esc(m.medName)+' × '+esc(m.actualQty)+'</span>'}).join(' ');
      return '<div style="border:1px solid var(--br);border-radius:6px;padding:10px;margin-bottom:10px">'+
        '<div class="fl g8 ic" style="margin-bottom:6px;flex-wrap:wrap">'+
          '<b>'+esc(u.planName||'—')+'</b>'+
          '<span class="fhint">'+esc(deptName(u.deptId))+'</span>'+
          '<span class="fhint">'+esc(u.consumptionDate||'—')+'</span>'+
          '<span class="badge bgr">Pending / معلق</span>'+
        '</div>'+
        '<div style="margin-bottom:4px"><span class="fhint">Patient: </span>'+esc(u.patientFile||'—')+' &nbsp;·&nbsp; <span class="fhint">Doctor: </span>'+esc(u.doctor||'—')+'</div>'+
        (u.note?'<div class="fhint" style="margin-bottom:4px">Note: '+esc(u.note)+'</div>':'')+
        '<div style="margin:6px 0">'+medsHtml+'</div>'+
        '<div class="fl g6"><button class="btn bs bsm" type="button" onclick="acc3ApprovePlanUsage(\''+esc(u.id)+'\')">✓ Approve / اعتماد</button><button class="btn bd2c bsm" type="button" onclick="acc3RejectPlanUsage(\''+esc(u.id)+'\')">✕ Reject / رفض</button></div>'+
      '</div>';
    }).join('')+
  '</div></div>';
}
function getPlanExpiry(planId){var rec=(rows('accountability_expiry_batches_v1')||[]).find(function(x){return x.type==='plan_expiry'&&String(x.planId)===String(planId)});return rec?rec.expiryDate||'':''}
window.acc3SavePlanExpiry=async function(planId){if(!window.S||typeof window.S.s!=='function')return toast('Data store not ready.','err');var input=document.querySelector('.acc3-plan-expiry-input[data-plan-id="'+CSS.escape(String(planId))+'"]');var date=input?String(input.value||'').trim():'';var all=(rows('accountability_expiry_batches_v1')||[]).filter(function(x){return !(x.type==='plan_expiry'&&String(x.planId)===String(planId))});if(date)all.push({type:'plan_expiry',planId:planId,expiryDate:date,deptId:String((window.CU&&window.CU.deptId)||''),updatedAt:new Date().toISOString(),updatedBy:actor()});try{await window.S.s('accountability_expiry_batches_v1',all);toast('Expiry date saved ✓ / تم حفظ تاريخ الانتهاء ✓','succ');window.renderMedicationAccountability&&window.renderMedicationAccountability()}catch(e){toast(String(e&&e.message||e),'err')}};
window.acc3SubmitPlanUsage=async function(planId){
  if(!window.S||typeof window.S.s!=='function')return toast('Data store is not ready. Please wait a moment and try again. / البيانات غير جاهزة، انتظر لحظة وحاول مجدداً.','err');
  var plan=rows(REGIMENS).find(function(r){return String(r.id)===String(planId)});
  if(!plan||plan.paused)return toast('Plan not available.','err');
  var v=activeVersion(plan);
  var sel=function(cls){return document.querySelector('.'+cls+'[data-plan-id="'+CSS.escape(String(planId))+'"]')};
  var dateVal=String((sel('acc3-pu-date')||{}).value||'').trim();
  var fileVal=String((sel('acc3-pu-file')||{}).value||'').trim();
  var doctorVal=String((sel('acc3-pu-doctor')||{}).value||'').trim();
  var noteVal=String((sel('acc3-pu-note')||{}).value||'').trim();
  if(!dateVal||!fileVal||!doctorVal)return toast('Date, patient file and doctor are required. / التاريخ ورقم الملف والطبيب مطلوبة.','err');
  if(dateVal>todayStr())return toast('Date cannot be in the future. / لا يمكن تاريخ مستقبلي.','err');
  var medicines=[];
  document.querySelectorAll('.acc3-pu-qty[data-plan-id="'+CSS.escape(String(planId))+'"]').forEach(function(inp){
    var medName=String(inp.dataset.med||'').trim();
    var actualQty=parseFloat(inp.value)||0;
    if(medName&&actualQty>0)medicines.push({medName:medName,actualQty:actualQty});
  });
  if(!medicines.length)return toast('Enter at least one medicine quantity. / أدخل كمية علاج واحد على الأقل.','err');
  var record={id:id('acc3pu'),planId:plan.id,planName:plan.name,deptId:String((window.CU&&CU.deptId)||''),deptName:deptName(String((window.CU&&CU.deptId)||'')),medicines:medicines,consumptionDate:dateVal,patientFile:fileVal,doctor:doctorVal,note:noteVal,status:'pending_pharmacy',submittedAt:now(),submittedBy:actor()};
  var balanceErrors=[];
  medicines.forEach(function(m){
    var a=rows('accountability_assignments_v2').find(function(x){return sameDept(x.deptId,record.deptId)&&norm(x.medName||'')===norm(m.medName||'')&&x.active!==false});
    if(!a)balanceErrors.push(m.medName+' (no active custody / لا توجد عهدة)');
    else if(m.actualQty>(a.balance||0))balanceErrors.push(m.medName+' (available: '+(a.balance||0)+', requested: '+m.actualQty+')');
  });
  if(balanceErrors.length)return toast('Insufficient balance for: '+balanceErrors.join('; ')+' / رصيد غير كافٍ.','err');
  var all=rows(PLAN_USAGE_KEY).concat([record]);
  try{
    var assignList=rows('accountability_assignments_v2').map(function(x){return Object.assign({},x)});
    medicines.forEach(function(m){
      var a=assignList.find(function(x){return sameDept(x.deptId,record.deptId)&&norm(x.medName||'')===norm(m.medName||'')&&x.active!==false});
      if(a){a.balance=Math.max(0,(a.balance||0)-m.actualQty);a.updatedAt=record.submittedAt}
    });
    await save('accountability_assignments_v2',assignList);
    await save(PLAN_USAGE_KEY,all);
    toast('Submitted to pharmacy ✓ / تم الرفع للصيدلية ✓');
    window.renderMedicationAccountability();
  }catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}
};
window.acc3CancelPlanUsage=async function(usageId,redirectTab){
  if(canManage())return toast('Use pharmacy controls to manage submissions.','err');
  var all=rows(PLAN_USAGE_KEY),u=all.find(function(x){return String(x.id)===String(usageId)});
  if(!u||!(u.status==='pending_pharmacy'||u.status==='rejected'))return toast('This submission can no longer be modified. / لا يمكن تعديل هذا الطلب.','err');
  var deptId=String((window.CU&&window.CU.deptId)||'');
  if(!sameDept(u.deptId,deptId))return toast('Access denied.','err');
  var ok=window.confirm('Delete this plan submission? / حذف طلب الخطة هذا؟');
  if(!ok)return;
  var newList=all.filter(function(x){return String(x.id)!==String(usageId)});
  try{
    if(u.status==='pending_pharmacy'){
      var assignList=rows('accountability_assignments_v2').map(function(x){return Object.assign({},x)});
      (u.medicines||[]).forEach(function(m){
        var a=assignList.find(function(x){return sameDept(x.deptId,u.deptId)&&norm(x.medName||'')===norm(m.medName||'')&&x.active!==false});
        if(a){a.balance=Math.min(a.quota||0,((a.balance||0)+(m.actualQty||0)));a.updatedAt=now()}
      });
      await save('accountability_assignments_v2',assignList);
    }
    await save(PLAN_USAGE_KEY,newList);
    toast('Deleted ✓ / تم الحذف ✓','succ');
    if(redirectTab&&window.ACC2_UI)window.ACC2_UI.deptTab=redirectTab;
    window.renderMedicationAccountability&&window.renderMedicationAccountability()
  }catch(e){toast(String(e&&e.message||e),'err')}
};
window.acc3ApprovePlanUsage=async function(usageId){
  if(!canManage())return toast('Not authorized.','err');
  var all=rows(PLAN_USAGE_KEY).map(function(u){return Object.assign({},u)});
  var rec=all.find(function(u){return String(u.id)===String(usageId)});
  if(!rec)return;
  rec.status='approved_waiting_receipt';rec.approvedAt=now();rec.approvedBy=actor();
  try{await save(PLAN_USAGE_KEY,all);toast('Plan usage approved ✓');window.renderMedicationAccountability()}catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}
};
window.acc3RejectPlanUsage=async function(usageId){
  if(!canManage())return toast('Not authorized.','err');
  var all=rows(PLAN_USAGE_KEY).map(function(u){return Object.assign({},u)});
  var rec=all.find(function(u){return String(u.id)===String(usageId)});
  if(!rec)return;
  rec.status='rejected';rec.rejectedAt=now();rec.rejectedBy=actor();
  try{
    var assignList=rows('accountability_assignments_v2').map(function(x){return Object.assign({},x)});
    (rec.medicines||[]).forEach(function(m){
      var a=assignList.find(function(x){return sameDept(x.deptId,rec.deptId)&&norm(x.medName||'')===norm(m.medName||'')&&x.active!==false});
      if(a){a.balance=Math.min(a.quota||0,((a.balance||0)+(m.actualQty||0)));a.updatedAt=rec.rejectedAt}
    });
    await save('accountability_assignments_v2',assignList);
    await save(PLAN_USAGE_KEY,all);toast('Plan usage rejected.');window.renderMedicationAccountability()
  }catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}
};
window.acc3RecordPlanReceipt=async function(usageId){
  if(!window.S||typeof window.S.s!=='function')return toast('Data store not ready.','err');
  var allUsages=rows(PLAN_USAGE_KEY).map(function(u){return Object.assign({},u)});
  var rec=allUsages.find(function(u){return String(u.id)===String(usageId)});
  if(!rec||rec.status!=='approved_waiting_receipt')return toast('This record is no longer awaiting receipt. / السجل ليس بانتظار الاستلام.','err');
  var recAt=now();
  rec.status='received_locked';rec.receivedAt=recAt;rec.receivedBy=actor();rec.locked=true;
  try{
    var assignList=rows('accountability_assignments_v2').map(function(x){return Object.assign({},x)});
    (rec.medicines||[]).forEach(function(m){
      var a=assignList.find(function(x){return sameDept(x.deptId,rec.deptId)&&norm(x.medName||'')===norm(m.medName||'')&&x.active!==false});
      if(a){a.balance=Math.min(a.quota||0,((a.balance||0)+(m.actualQty||0)));a.updatedAt=recAt}
    });
    await save('accountability_assignments_v2',assignList);
    await save(PLAN_USAGE_KEY,allUsages);
    toast('Receipt confirmed ✓ / تم تأكيد الاستلام ✓');
    window.renderMedicationAccountability();
  }catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}
};
window.acc2IndependentRegimensTab=function(){
  var manage=canManage();
  if(!manage){var deptId=String((window.CU&&CU.deptId)||'');return acc3DeptPlanView(deptId)}
  return builder(currentDept())+regimenTable()+planUsageReview();
};
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
window.acc3AddMedicine=async function(){if(!canManage())return toast('Not authorized.','err');var dept=(document.getElementById('acc3-catalog-dept')||{}).value||currentDept(),name=String((document.getElementById('acc3-catalog-name')||{}).value||'').trim(),note=String((document.getElementById('acc3-catalog-note')||{}).value||'').trim();if(!validDept(dept)||!name)return toast('Department and medicine name are required.','err');var all=rows(CATALOG).slice();if(all.some(function(row){return String(row.deptId)===String(dept)&&String(row.name||'').trim().toLowerCase()===name.toLowerCase()}))return toast('This regimen medicine already exists for the department.','err');all.push({id:id('acc3m'),deptId:dept,name:name,note:note,active:true,createdAt:now(),createdBy:actor()});try{await save(CATALOG,all);toast('Regimen medicine added ✓');window.renderMedicationAccountability()}catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}};
window.acc3ToggleMedicine=async function(rowId){if(!canManage())return toast('Not authorized.','err');var all=rows(CATALOG).map(function(row){return Object.assign({},row)}),row=all.find(function(x){return String(x.id)===String(rowId)});if(!row)return;row.active=row.active===false;row.updatedAt=now();row.updatedBy=actor();try{await save(CATALOG,all);window.renderMedicationAccountability()}catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}};
window.acc3AddItemRow=function(){var c=document.getElementById('acc3-items-container');if(!c)return;var rateId='acc3-rate-new-'+Date.now()+'-'+Math.floor(Math.random()*9999);var div=document.createElement('div');div.className='acc3-item-row';div.style.cssText='border:1px solid var(--br);border-radius:6px;padding:8px 10px;margin-bottom:8px';div.innerHTML='<div class="fl g6 ic" style="flex-wrap:wrap;margin-bottom:6px"><input class="acc3-item-name" list="acc3-med-suggestions" placeholder="Medicine name / اسم الدواء" style="flex:1;min-width:140px"><input class="acc3-item-dose" type="number" min="0" step="any" placeholder="Dose / الجرعة" style="width:75px">'+doseUnitSelect('acc3-item-doseunit','mg')+formSelect('acc3-item-form','vial')+'<div class="fl g4 ic"><input class="acc3-item-custodyqty" type="number" min="0" step="1" placeholder="#" style="width:55px" title="Number of units in plan / العدد بالخطة"><span style="opacity:.6;font-size:11px;white-space:nowrap">in plan</span></div><button class="btn bd2c bxs" type="button" onclick="acc3RemoveItemRow(this)">✕</button></div><div class="fl g6 ic" style="flex-wrap:wrap">'+routeSelect('acc3-item-route','')+doseTypeSelect('acc3-item-dosetype','fixed',rateId)+'<div class="fl g4 ic"><input id="'+rateId+'" class="acc3-item-doserate" type="number" min="0" step="any" placeholder="Rate" style="width:65px;opacity:0.35" disabled title="Dose rate mg/kg"><span style="opacity:.6;font-size:12px;white-space:nowrap">/ kg</span></div><input class="acc3-item-note" placeholder="⚠ Note (optional) / تنبيه اختياري" style="flex:1;min-width:120px"></div>';c.appendChild(div);div.querySelector('.acc3-item-name').focus()};
window.acc3RemoveItemRow=function(btn){var row=btn&&btn.closest('.acc3-item-row');if(row)row.remove()};
window.acc3SaveRegimen=async function(){if(!canManage())return toast('Not authorized.','err');var edit=UI.edit?rows(REGIMENS).find(function(r){return String(r.id)===String(UI.edit)}):null,dept=edit?edit.deptId:((document.getElementById('acc3-regimen-dept')||{}).value||''),name=String((document.getElementById('acc3-name')||{}).value||'').trim(),source=String((document.getElementById('acc3-source')||{}).value||'').trim(),label=String((document.getElementById('acc3-label')||{}).value||'').trim(),items=[];if(!validDept(dept)||!name||!source||!label)return toast('Department, plan name, indication and version label are required.','err');document.querySelectorAll('#acc3-items-container .acc3-item-row').forEach(function(row){var medName=String((row.querySelector('.acc3-item-name')||{}).value||'').trim(),dose=parseFloat((row.querySelector('.acc3-item-dose')||{}).value)||null,doseUnit=String((row.querySelector('.acc3-item-doseunit')||{}).value||'mg').trim(),form=String((row.querySelector('.acc3-item-form')||{}).value||'vial').trim(),custodyQty=parseInt((row.querySelector('.acc3-item-custodyqty')||{}).value)||null,route=String((row.querySelector('.acc3-item-route')||{}).value||'').trim(),doseType=String((row.querySelector('.acc3-item-dosetype')||{}).value||'fixed').trim(),doseRate=parseFloat((row.querySelector('.acc3-item-doserate')||{}).value)||null,note=String((row.querySelector('.acc3-item-note')||{}).value||'').trim();if(medName)items.push({medName:medName,dose:dose,doseUnit:doseUnit,form:form,custodyQty:custodyQty,route:route,doseType:doseType,doseRate:doseType==='per_kg'?doseRate:null,note:note})});if(!items.length)return toast('Add at least one medicine.','err');var lineType=((document.getElementById('acc3-line')||{}).value||'first_line'),severity=String(((document.getElementById('acc3-severity')||{}).value)||'moderate').trim()||'moderate',planMinAge=Number((document.getElementById('acc3-min-age')||{}).value)||null,planMaxAge=Number((document.getElementById('acc3-max-age')||{}).value)||null,all=rows(REGIMENS).map(function(r){return Object.assign({},r)});if(!edit){var _conflicts=all.filter(function(r){var _v=activeVersion(r);return !r.paused&&String(r.deptId)===String(dept)&&norm(r.infectionSource||'')===norm(source)&&norm(_v.severity||'')===norm(severity||'')});if(_conflicts.length){var _ll={first_line:'1st-line',second_line:'2nd-line',third_line:'3rd-line'};var _msg='⚠ A plan for "'+source+'" already exists for this department with the same severity:\n'+_conflicts.map(function(r){var _v=activeVersion(r);return '• '+r.name+' ('+(_ll[_v.lineType]||_v.lineType||'?')+')'}).join('\n')+'\n\nMultiple active lines for the same indication and severity is unusual. Are you sure?\nخطة لنفس المرض ونفس الشدة موجودة بالقسم. هل تريد إضافة خط علاج آخر؟';var _ok=typeof uiConfirm==='function'?await uiConfirm(_msg):window.confirm(_msg);if(!_ok)return}}if(edit){var row=all.find(function(r){return String(r.id)===String(edit.id)});row.name=name;row.infectionSource=source;row.minAge=planMinAge;row.maxAge=planMaxAge;row.updatedAt=now();row.updatedBy=actor();var newVer=!!(document.getElementById('acc3-new-version')&&document.getElementById('acc3-new-version').checked);if(newVer){var version={id:id('acc3v'),label:label,lineType:lineType,severity:severity,items:items,createdAt:now(),createdBy:actor()};row.versions=(row.versions||[]).concat([version]);row.activeVersionId=version.id}else{var av=activeVersion(row);av.label=label;av.lineType=lineType;av.severity=severity;av.items=items;av.updatedAt=now();av.updatedBy=actor()}}else all.push({id:id('acc3r'),deptId:dept,name:name,infectionSource:source,minAge:planMinAge,maxAge:planMaxAge,versions:[{id:id('acc3v'),label:label,lineType:lineType,severity:severity,items:items,createdAt:now(),createdBy:actor()}],activeVersionId:null,paused:false,createdAt:now(),createdBy:actor()});if(!edit)all[all.length-1].activeVersionId=all[all.length-1].versions[0].id;try{await save(REGIMENS,all);UI.edit='';toast('Regimen saved ✓');window.renderMedicationAccountability()}catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}};
window.acc3EditRegimen=function(rowId){UI.edit=rowId;window.renderMedicationAccountability()};
window.acc3CancelEdit=function(){UI.edit='';window.renderMedicationAccountability()};
window.acc3ToggleRegimen=async function(rowId){if(!canManage())return toast('Not authorized.','err');var all=rows(REGIMENS).map(function(r){return Object.assign({},r)}),row=all.find(function(r){return String(r.id)===String(rowId)});if(!row)return;row.paused=!row.paused;row.updatedAt=now();row.updatedBy=actor();try{await save(REGIMENS,all);window.renderMedicationAccountability()}catch(e){toast(String(e&&e.message||e).replace(/^FirebaseError:\s*/,''),'err')}};
window.acc3PrintRegimen=function(rowId){var row=rows(REGIMENS).find(function(r){return String(r.id)===String(rowId)});if(!row)return;var v=activeVersion(row),items=(v.items||[]).map(function(i,n){var dose=i.doseType==='per_kg'&&i.doseRate?i.doseRate+' '+(i.doseUnit||i.unitLabel||'mg')+'/kg':(i.dose?i.dose+' '+(i.doseUnit||i.unitLabel||''):'—');var inPlan=i.custodyQty?' × '+i.custodyQty+(i.form?' '+i.form:''):'('+dose+')'.replace(/\(—\)/,'');var route=ROUTE_LABEL[i.route]||i.route||'—';return '<tr><td>'+String(n+1)+'</td><td><b>'+esc(i.medName)+'</b>'+(i.note?'<br><span style="color:#c0392b;font-size:11px">⚠ '+esc(i.note)+'</span>':'')+'</td><td>'+esc(dose)+'</td><td>'+esc(route)+'</td></tr>'}).join('');if(typeof window.fsOfficialPrint!=='function')return toast('Official printing is not ready. Reload the page and try again.','err');window.fsOfficialPrint({title:row.name||'Approved regimen',css:'body{font:14px Arial;color:#111}h1{font-size:18px;margin-bottom:4px}p{margin:4px 0}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #555;padding:8px;text-align:left}th{background:#e8f5e9}',html:'<h1>'+esc(row.name)+'</h1><p><b>Department / القسم:</b> '+esc(deptName(row.deptId))+'</p><p><b>Indication / السبب:</b> '+esc(row.infectionSource)+'</p><p><b>Line / الخط:</b> '+esc(({first_line:'First-line',second_line:'Second-line',third_line:'Third-line'})[v.lineType]||v.lineType)+' &nbsp;·&nbsp; <b>Severity / الشدة:</b> '+esc(severity(v.severity))+(row.minAge||row.maxAge?' &nbsp;·&nbsp; <b>Age / العمر:</b> '+(row.minAge||'0')+'–'+(row.maxAge||'∞')+' yrs':'')+'</p><table><thead><tr><th>#</th><th>Medicine / الدواء</th><th>Dose / الجرعة</th><th>Route / طريقة الإعطاء</th></tr></thead><tbody>'+items+'</tbody></table>'})};
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
function showModal(data){closeModal();var pharmacyUrl=handoverUrl(data,'pharmacy',data.pharmacyToken),departmentUrl=handoverUrl(data,'department',data.departmentToken),modal=document.createElement('div');modal.id='r671-handover-modal';modal.className='modal-bg on';modal.innerHTML='<div class="modal" style="max-width:980px"><div class="mh"><div><span class="mt">Temporary dual QR handover / الاستلام والتسليم برمزي QR مؤقتين</span><div class="fhint">'+esc(data.departmentName)+' · expires '+esc(new Date(data.expiresAt).toLocaleString())+'</div></div><button class="xbtn" type="button" data-r671-close>✕</button></div><div class="alert-banner-y">Keep the two QR codes separate. The pharmacy scans the delivery QR and the department scans the receipt QR. Balance replenishment occurs only after both confirmations.<br>احتفظ بالرمزين منفصلين. تمسح الصيدلية رمز التسليم ويمسح القسم رمز الاستلام، ولا يُعوض الرصيد إلا بعد التأكيدين.</div><div class="r671-qr-grid"><section><h3>1. Pharmacy delivery<br>تسليم الصيدلية</h3>'+qrPanel(pharmacyUrl,'Pharmacy delivery QR')+'<textarea readonly>'+esc(pharmacyUrl)+'</textarea><a class="btn bg" href="'+esc(pharmacyUrl)+'" target="_blank" rel="noopener">Open pharmacy link / فتح رابط الصيدلية</a></section><section><h3>2. Department receipt<br>استلام القسم</h3>'+qrPanel(departmentUrl,'Department receipt QR')+'<textarea readonly>'+esc(departmentUrl)+'</textarea><a class="btn bg" href="'+esc(departmentUrl)+'" target="_blank" rel="noopener">Open department link / فتح رابط القسم</a></section></div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bp" type="button" data-r671-close>Done / تم</button></div></div>';document.body.appendChild(modal)}
async function reissueHandoverOne(usageId,deptId,button){if(button){button.disabled=true;button.textContent='…'}try{if(typeof window.fsCallFunction!=='function')throw new Error('Secure service is still loading. Please retry.');var data=await window.fsCallFunction('reissueAccountabilityHandover',{usageIds:[usageId],expiresInMinutes:30});if(!data||!data.sessionId)throw new Error('Incomplete response from service.');showModal(data);if(window.toast)toast('QR codes reissued ✓ / تم إعادة إصدار الرموز ✓','succ');if(typeof window.renderMedicationAccountability==='function')setTimeout(window.renderMedicationAccountability,700)}catch(error){var message=String(error&&error.message||error).replace(/^FirebaseError:\s*/,'');if(window.toast)toast(message,'err')}finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Reissue / إعادة إصدار'}}}
async function createHandover(deptId,button){var ids=Array.from(document.querySelectorAll('.acc2-qr-usage[data-dept="'+CSS.escape(String(deptId))+'"]:checked:not(:disabled)')).map(function(x){return x.value});if(!ids.length)return window.toast&&toast('Select one or more approved records first. / اختر سجلًا معتمدًا واحدًا على الأقل.','err');if(button){button.disabled=true;button.textContent='Creating QR… / جاري إنشاء الرموز'}try{if(!(window.fsHasCapability&&window.fsHasCapability('accountability.handover.create')))throw new Error('This role cannot create accountability handovers.');if(typeof window.fsCallFunction!=='function')throw new Error('Secure service is still loading. Please retry.');var data=await window.fsCallFunction('createAccountabilityHandover',{usageIds:ids,expiresInMinutes:30});if(!data||!data.sessionId)throw new Error('The QR handover service returned an incomplete response.');showModal(data);if(window.toast)toast('Temporary pharmacy and department QR codes created ✓','succ');if(typeof window.renderMedicationAccountability==='function')setTimeout(window.renderMedicationAccountability,700)}catch(error){console.error('QR handover creation failed',error);var message=String(error&&error.message||error).replace(/^FirebaseError:\s*/,'');if(window.toast)toast(message,'err')}finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Create temporary dual QR / إنشاء رمزي QR مؤقتين'}}}
setTimeout(installPermissionUi,0);
window.__startAppExtensions=window.__startAppExtensions||[];
window.__startAppExtensions.push(function(){setTimeout(installPermissionUi,500)});
document.addEventListener('click',function(event){var action=event.target.closest('[data-acc2-qr-action]');if(action){var dept=action.getAttribute('data-dept'),kind=action.getAttribute('data-acc2-qr-action');if(kind==='select'){document.querySelectorAll('.acc2-qr-usage[data-dept="'+CSS.escape(String(dept))+'"]:not(:disabled)').forEach(function(x){x.checked=true})}else if(kind==='create')createHandover(dept,action);else if(kind==='reissue-one'){var usageId=action.getAttribute('data-usage-id');if(usageId)reissueHandoverOne(usageId,dept,action)}return}if(event.target.closest('[data-r671-close]')){closeModal();return}},true);
})();

export {};

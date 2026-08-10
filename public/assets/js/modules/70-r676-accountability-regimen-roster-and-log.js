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
function handoverLog(){
  var root=document.getElementById('r17-accountability-root');if(!root||root.querySelector('#r676-accountability-handover-log'))return;
  var tabs=root.querySelector('.acc2-tabs');if(!tabs||String(tabs.textContent||'').indexOf('Receipt & handover')<0)return;
  var usage=state('accountability_usage_v2'),receipts=state('accountability_receipts_v2'),events=[];
  usage.forEach(function(row){if(!row)return;events.push({at:row.submittedAt||'',kind:'Submitted to pharmacy / رُفع للصيدلية',dept:row.deptId,medicine:row.medName,units:row.units,actor:row.submittedBy||'—',method:'—',status:row.status||'pending_pharmacy'});if(row.approvedAt)events.push({at:row.approvedAt,kind:'Approved for handover / اعتماد للتسليم',dept:row.deptId,medicine:row.medName,units:row.units,actor:row.approvedBy||'—',method:'—',status:row.status||''})});
  receipts.forEach(function(row){if(!row)return;events.push({at:row.receivedAt||row.createdAt||'',kind:'Completed handover / استلام وتسليم مكتمل',dept:row.deptId,medicine:(row.medicineTotals||[]).map(function(item){return item.medName+' × '+item.units}).join('، ')||'—',units:row.totalUnits,actor:(row.pharmacyName||'—')+' → '+(row.nurseName||'—'),method:row.confirmationMethod==='temporary_dual_qr'?'Dual QR / رمزان QR':row.confirmationMethod==='manual'?'Manual / يدوي':'Recorded / مسجل',status:'received_locked'})});
  events.sort(function(a,b){return String(b.at).localeCompare(String(a.at))});
  var html='<div class="card" id="r676-accountability-handover-log"><div class="ch"><div><span class="ct">Handover activity log / سجل نشاط الاستلام والتسليم</span><div class="fhint">One chronological audit log for pharmacy approval, delivery, department receipt, QR and documented manual handovers.</div></div></div><div class="tw"><table class="acc2-table"><thead><tr><th>Time / الوقت</th><th>Activity / النشاط</th><th>Department / القسم</th><th>Medicines / الأدوية</th><th>Units</th><th>Performed by / المنفذ</th><th>Method / الطريقة</th><th>Status</th></tr></thead><tbody>'+(events.length?events.map(function(event){return '<tr><td>'+esc(event.at||'—')+'</td><td><b>'+esc(event.kind)+'</b></td><td>'+esc(deptName(event.dept))+'</td><td>'+esc(event.medicine||'—')+'</td><td>'+esc(event.units||'—')+'</td><td>'+esc(event.actor||'—')+'</td><td>'+esc(event.method||'—')+'</td><td><span class="badge '+(event.status==='received_locked'?'bgn':event.status==='pending_pharmacy'?'byl':'bbl')+'>'+esc(event.status||'—')+'</span></td></tr>'}).join(''):'<tr><td colspan="8" class="acc2-empty">No handover activity recorded yet.</td></tr>')+'</tbody></table></div></div>';
  root.insertAdjacentHTML('beforeend',html);
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
export {};

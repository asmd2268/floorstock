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
  var panel=document.createElement('div');panel.id='r676-accountability-retention';panel.className='alert-banner-y';panel.innerHTML='<b>Master retention controls / إدارة الاحتفاظ للماستر</b><br>Historical accountability activity older than six months: '+oldUsage+' usage record(s), '+oldReceipts+' receipt/handover record(s). Active custody lines and regimens are never deleted.<br><button class="btn bd2c bsm" type="button" data-acc2-purge-history style="margin-top:8px">Delete accountability history older than 6 months / حذف سجل العهد الأقدم من 6 أشهر</button>';
  log.parentNode.insertBefore(panel,log);
}
window.acc2PurgeHistoricalHistory=async function(){
  if(!isActualMaster())return window.toast&&window.toast('Actual Master access is required. / يتطلب صلاحية الماستر الفعلية.','err');
  var usage=appState('accountability_usage_v2'),receipts=appState('accountability_receipts_v2'),keptUsage=usage.filter(function(row){return !olderThanSixMonths(row.submittedAt||row.consumptionDate)}),keptReceipts=receipts.filter(function(row){return !olderThanSixMonths(row.receivedAt||row.createdAt||row.receivedDate)}),removedUsage=usage.length-keptUsage.length,removedReceipts=receipts.length-keptReceipts.length;
  if(!removedUsage&&!removedReceipts)return window.toast&&window.toast('No accountability history is older than six months. / لا توجد سجلات أقدم من ستة أشهر.','info');
  var question='Delete '+removedUsage+' usage record(s) and '+removedReceipts+' receipt/handover record(s) older than six months? Active custody and regimens will remain unchanged. / حذف سجلات العهد القديمة فقط دون تغيير العهد النشطة أو الخطط؟',ok=typeof window.uiConfirm==='function'?await window.uiConfirm(question):window.confirm(question);if(!ok)return;
  var store=window.S&&window.S.s;if(typeof store!=='function')return window.toast&&window.toast('State storage is not ready.','err');
  try{await store('accountability_usage_v2',keptUsage);try{await store('accountability_receipts_v2',keptReceipts)}catch(error){await store('accountability_usage_v2',usage);throw error}if(typeof window.auditAction==='function')await Promise.resolve(window.auditAction('accountability_history_retention_purge',{olderThanMonths:6,removedUsage:removedUsage,removedReceipts:removedReceipts})).catch(function(error){console.warn('Accountability retention audit warning',error)});window.toast&&window.toast('Historical accountability records deleted: '+(removedUsage+removedReceipts)+' ✓','succ');window.renderMedicationAccountability&&window.renderMedicationAccountability()}catch(error){console.error(error);window.toast&&window.toast(String(error&&error.message||error),'err')}
};
document.addEventListener('click',function(event){var button=event.target&&event.target.closest&&event.target.closest('[data-acc2-purge-history]');if(button){window.acc2PurgeHistoricalHistory()}},true);
function decorate(){decorateReview();retentionPanel()}
var previous=window.renderMedicationAccountability;
if(typeof previous==='function'&&!previous.__r676RetentionWrap){var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(decorate,0);return result};wrapped.__r676RetentionWrap=true;window.renderMedicationAccountability=wrapped}
setTimeout(decorate,0);
})();

export {};

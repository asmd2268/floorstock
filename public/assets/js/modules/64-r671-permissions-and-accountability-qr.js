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
var previousStart=window.startApp;if(typeof previousStart==='function')window.startApp=function(){var result=previousStart.apply(this,arguments);setTimeout(installPermissionUi,500);return result};
document.addEventListener('click',function(event){var action=event.target.closest('[data-acc2-qr-action]');if(action){var dept=action.getAttribute('data-dept'),kind=action.getAttribute('data-acc2-qr-action');if(kind==='select'){document.querySelectorAll('.acc2-qr-usage[data-dept="'+CSS.escape(String(dept))+'"]:not(:disabled)').forEach(function(x){x.checked=true})}else if(kind==='create')createHandover(dept,action);return}if(event.target.closest('[data-r671-close]')){closeModal();return}var copy=event.target.closest('[data-r671-copy]');if(copy){var value=copy.getAttribute('data-r671-copy')||'';navigator.clipboard&&navigator.clipboard.writeText(value).then(function(){window.toast&&toast('Link copied ✓','succ')}).catch(function(){window.prompt('Copy link',value)})}},true);
})();

export {};

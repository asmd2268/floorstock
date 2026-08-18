(function(){
'use strict';
var API='https://us-central1-floorstock-6ac2d.cloudfunctions.net';
var params=new URLSearchParams(String(location.hash||'').replace(/^#/,'')),session=params.get('session')||'',party=params.get('party')||'',token=params.get('token')||'';
if(location.hash)history.replaceState(null,'',location.pathname);
var statusEl=document.getElementById('handover-status'),details=document.getElementById('handover-details'),form=document.getElementById('handover-form'),submit=document.getElementById('handover-submit');
function text(id,value){var el=document.getElementById(id);if(el)el.textContent=value}
function message(ar,en,type){statusEl.className='handover-status '+(type||'');statusEl.textContent=ar+'\n'+en}
function escapeText(value){return String(value==null?'':value)}

// This page has no Firebase Auth sign-in (it's opened from a QR code by
// whoever is physically handing over/receiving custody) — App Check still
// attests the CLIENT APP itself independent of any user session, so it's
// attached here the same way, monitoring-only for now (the server logs the
// token's validity but does not yet reject requests missing one — see
// functions/index.js). This closes a real, previously-flagged gap: these
// two endpoints were plain unauthenticated HTTP functions with zero bot/
// abuse protection.
var appCheckTokenPromise=(function(){
  try{
    if(!window.firebase||!firebase.initializeApp||!firebase.appCheck)return Promise.resolve('');
    firebase.initializeApp({apiKey:'AIzaSyBlcFhBTaJ9so8MlCLa_JTtUpQxCbEwuzU',authDomain:'floorstock-6ac2d.firebaseapp.com',projectId:'floorstock-6ac2d',storageBucket:'floorstock-6ac2d.firebasestorage.app',messagingSenderId:'920762414422',appId:'1:920762414422:web:8d6dbc7069d4088defd2f7'});
    var appCheck=firebase.appCheck();
    appCheck.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider('6LfYImotAAAAACo50nBNoL7EIb14ipF9NQYzrJfr'),true);
    return appCheck.getToken(false).then(function(result){return result&&result.token||''}).catch(function(error){console.warn('App Check token unavailable on the public handover page.',error);return ''});
  }catch(error){
    console.warn('App Check initialization failed on the public handover page.',error);
    return Promise.resolve('');
  }
})();
async function withAppCheckHeader(options){
  options=options||{};
  var appCheckToken=await appCheckTokenPromise;
  if(appCheckToken){options.headers=Object.assign({},options.headers||{},{'X-Firebase-AppCheck':appCheckToken})}
  return options;
}
async function jsonFetch(url,options){var response=await fetch(url,await withAppCheckHeader(options)),body={};try{body=await response.json()}catch(ignore){}if(!response.ok||body.ok===false)throw new Error(body.error||('Request failed ('+response.status+')'));return body}
function render(data){var item=data.session;details.classList.remove('handover-hidden');text('handover-party',item.partyLabel);text('handover-department',item.departmentName);var tbody=document.getElementById('handover-items');tbody.textContent='';(item.medicineTotals||[]).forEach(function(row){var tr=document.createElement('tr'),name=document.createElement('td'),units=document.createElement('td');name.textContent=escapeText(row.medName||'Medicine');units.textContent=escapeText(row.units||0);tr.append(name,units);tbody.appendChild(tr)});text('handover-expiry',item.expiresAt?'Expires / تنتهي الصلاحية: '+new Date(item.expiresAt).toLocaleString():'');if(item.status==='completed'){form.classList.add('handover-hidden');message('✅ اكتملت العملية وتم تأكيد الطرفين وتعويض الرصيد.','Handover completed. Both parties confirmed and the balance was replenished.','handover-success');return}if(item.expired){form.classList.add('handover-hidden');message('⌛ انتهت صلاحية هذا الرابط. اطلب من الصيدلية إنشاء رمزين جديدين.','This link has expired. Ask pharmacy to create a new QR handover.','handover-warning');return}if(item.alreadyConfirmed){form.classList.add('handover-hidden');message('✅ تم تسجيل تأكيدك مسبقًا. العملية بانتظار تأكيد الطرف الآخر.','Your confirmation was already recorded. The handover is waiting for the other party.','handover-success');return}var other=item.party==='pharmacy'?item.departmentConfirmed:item.pharmacyConfirmed;message(other?'الطرف الآخر أكد العملية. أدخل بياناتك لإكمال الاستلام والتسليم.':'أدخل اسمك ورقمك الوظيفي لتأكيد العملية.','Enter your name and employee number to confirm this handover.','')}
async function load(){if(!session||!party||!token){message('الرابط غير مكتمل أو غير صالح.','The handover link is incomplete or invalid.','handover-error');return}try{var url=API+'/getAccountabilityHandover?session='+encodeURIComponent(session)+'&party='+encodeURIComponent(party)+'&token='+encodeURIComponent(token);render(await jsonFetch(url))}catch(error){message('تعذر فتح العملية: '+error.message,'Could not open the handover: '+error.message,'handover-error')}}
form.addEventListener('submit',async function(event){event.preventDefault();var name=document.getElementById('handover-name').value.trim(),employeeId=document.getElementById('handover-employee').value.trim();if(name.length<2||employeeId.length<2){message('أدخل اسم الموظف ورقمه الوظيفي.','Enter the employee name and employee number.','handover-warning');return}submit.disabled=true;submit.textContent='Confirming… / جاري التأكيد';try{var result=await jsonFetch(API+'/confirmAccountabilityHandover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:session,party:party,token:token,name:name,employeeId:employeeId})});form.classList.add('handover-hidden');if(result.completed)message('✅ اكتملت العملية وتم تأكيد الطرفين وتعويض الرصيد.','Handover completed. Both parties confirmed and the balance was replenished.','handover-success');else message('✅ تم تسجيل تأكيدك. العملية بانتظار تأكيد الطرف الآخر.','Your confirmation was recorded. The handover is waiting for the other party.','handover-success')}catch(error){message('تعذر تسجيل التأكيد: '+error.message,'Confirmation failed: '+error.message,'handover-error');submit.disabled=false;submit.textContent='Confirm / تأكيد'}});
load();
})();

(function(){
'use strict';

function E(id){return document.getElementById(id)}
function safe(v){return window.fsEsc?window.fsEsc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function currentUser(){return window.CU||{}}
function actualMaster(){
  try{if(typeof window.isMasterActual==='function')return !!window.isMasterActual()}catch(ignore){}
  return !!((window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true)||(window.CU&&CU.master===true));
}
function role(){var u=currentUser();return String((window.fsEffectiveRole&&window.fsEffectiveRole())||u.role||'')}
function deptId(){var u=currentUser();return String(u.deptId||u.departmentId||'')}
function active(){return !!(window.FB_AUTH&&FB_AUTH.currentUser&&currentUser().active!==false)}
function director(){return actualMaster()||['pharmacy','pharmacy_director'].indexOf(role())>=0}
function pharmacyOperations(){return director()||['inpatient_supervisor','pharmacy_staff'].indexOf(role())>=0}
function controlledOfficer(){return director()||['controlled_pharmacy'].indexOf(role())>=0}
function warehouseOfficer(){return director()||role()==='warehouse'}
function stateKeyAllowed(key){
  key=String(key||'');
  if(!active())return false;
  if(actualMaster()||director())return true;
  if(key==='theme'||key==='audit_log')return true;
  if(role()==='inpatient_supervisor'){
    return /^(crash_|accountability_|requests$|notes$|dept_notes$|meds_|expiry_|shelves_|req_windows$|disp_slots$|daily_limits_v2$|weekly_limits_v2$|monthly_limits$|rate_limits_v2$|request_|pharmacy_)/.test(key);
  }
  if(role()==='pharmacy_staff'){
    return /^(crash_carts$|crash_cart_reports$|accountability_|requests$|notes$|dept_notes$|request_analytics_archive$)/.test(key);
  }
  if(role()==='controlled_pharmacy'){
    return /^(controlled_|accountability_)/.test(key);
  }
  if(role()==='warehouse'){
    return /^(controlled_warehouse$|controlled_moves$|controlled_pdf_receipts$)/.test(key);
  }
  if(role()==='department'){
    var d=deptId();
    return key==='requests'||key==='dept_notes'||key==='notes'||key==='crash_cart_reports'||
      key==='accountability_usage_v2'||key==='accountability_receipts_v2'||
      (!!d&&(key==='meds_'+d||key==='expiry_'+d||key==='shelves_'+d||key==='controlled_dept_list_'+d||key==='controlled_dept_shelves_'+d||key==='controlled_settings_'+d));
  }
  return false;
}
window.fsCanWriteStateKey=stateKeyAllowed;

function installStateGate(){
  if(!window.S||typeof S.s!=='function'||S.s.__r664SecurityGate)return false;
  var originalSet=S.s.bind(S),originalRemove=typeof S.rm==='function'?S.rm.bind(S):null;
  var gatedSet=function(key,value){
    if(!stateKeyAllowed(key)){
      var error=new Error('This account is not authorized to modify '+String(key)+'.');
      if(typeof window.toast==='function')toast('Not authorized for this operation. / غير مصرح بهذه العملية','err');
      return Promise.reject(error);
    }
    return originalSet(key,value);
  };
  gatedSet.__r664SecurityGate=true;
  S.s=gatedSet;
  if(originalRemove)S.rm=function(key){
    if(!stateKeyAllowed(key)){
      if(typeof window.toast==='function')toast('Not authorized for this deletion. / غير مصرح بالحذف','err');
      return Promise.reject(new Error('Not authorized to delete '+String(key)));
    }
    return originalRemove(key);
  };
  return true;
}
function waitGate(){if(!installStateGate())setTimeout(waitGate,250)}
waitGate();

/* Secure production build intentionally disables localhost Zebra BrowserPrint.
   Standard browser printing and downloadable ZPL remain available. */
window.zebraRefreshPrinters=function(){
  var status=E('zebra-status'),message=E('zebra-message');
  if(status){status.textContent='Local connector disabled';status.className='badge byl'}
  if(message)message.textContent='Zebra BrowserPrint localhost access is disabled in this hardened production build. Use browser printing or downloaded ZPL.';
  if(typeof window.toast==='function')toast('Local Zebra connector is disabled in the secure production build.','info');
};

/* Enforce role checks at public-write entry points. */
function wrapPublicWrite(name,allowed){
  var fn=window[name];if(typeof fn!=='function'||fn.__r664PublicGate)return;
  var wrapped=async function(){
    if(!allowed.apply(null,arguments)){
      if(typeof window.toast==='function')toast('Not authorized to publish public data.','err');
      throw new Error('Public publication is not authorized for this role.');
    }
    return fn.apply(this,arguments);
  };
  wrapped.__r664PublicGate=true;window[name]=wrapped;
}
function installPublicGates(){
  wrapPublicWrite('publishPublic',function(){return pharmacyOperations()});
  wrapPublicWrite('ctlPublishDept',function(id){return controlledOfficer()||(role()==='department'&&String(id)===deptId())});
  wrapPublicWrite('syncPublicExpiry',function(id){return pharmacyOperations()||(role()==='department'&&String(id)===deptId())});
  wrapPublicWrite('publishStorage',function(){return controlledOfficer()||warehouseOfficer()});
}
setTimeout(installPublicGates,0);

/* Master-only correction of a mistakenly recorded current seal.
   It does not open/close the cart and does not alter medicine quantities or dates. */
var SEAL_CART_ID='';
function ensureSealModal(){
  if(E('r664-seal-correction-modal'))return;
  var bg=document.createElement('div');bg.className='modal-bg';bg.id='r664-seal-correction-modal';
  bg.innerHTML='<div class="modal"><div class="mh"><span class="mt">Correct recorded seal / تصحيح رقم القفل المسجل</span><button class="xbtn" type="button" data-close>✕</button></div>'+
    '<div class="r664-security-note">Master only. This corrects a data-entry mistake without recording an opening, without changing cart contents, and without changing opening or closing timestamps.<br>للماستر فقط. تصحيح خطأ إدخال دون تسجيل فتح ودون تعديل المحتويات أو أوقات الفتح والإغلاق.</div>'+
    '<div class="fg"><label>Crash Cart / عربة الطوارئ</label><div id="r664-seal-cart-name" class="scan-field"></div></div>'+
    '<div class="fg"><label>Current recorded seal / القفل المسجل حاليًا</label><div id="r664-seal-current" class="scan-field"></div></div>'+
    '<div class="fg"><label>Correct seal number / رقم القفل الصحيح</label><input id="r664-seal-new" autocomplete="off" maxlength="80" placeholder="Required, unique and not previously used"></div>'+
    '<div class="fg"><label>Correction reason / سبب التصحيح</label><textarea id="r664-seal-reason" rows="3" maxlength="500" placeholder="Example: seal was entered incorrectly by staff / تم إدخال رقم القفل بالخطأ"></textarea></div>'+
    '<div id="r664-seal-error" class="alert-banner" style="display:none"></div>'+
    '<div class="fl g8" style="justify-content:flex-end"><button class="btn bg" type="button" data-close>Cancel</button><button class="btn bs" id="r664-seal-save" type="button">Save correction / حفظ التصحيح</button></div></div>';
  document.body.appendChild(bg);
  bg.querySelectorAll('[data-close]').forEach(function(b){b.onclick=function(){bg.classList.remove('on')}});
  E('r664-seal-save').onclick=saveSealCorrection;
}
function usedSeal(newSeal,cartId){
  var key=String(newSeal||'').trim().toLowerCase(),found='';
  if(!key)return '';
  var carts=typeof window.crashCarts==='function'?(crashCarts()||[]):[];
  carts.forEach(function(c){if(!found&&String(c.id)!==String(cartId)&&String(c.seal||'').trim().toLowerCase()===key)found='another Crash Cart'});
  var reports=typeof window.crashReports==='function'?(crashReports()||[]):[];
  reports.forEach(function(r){if(found)return;[r.oldSeal,r.newSeal].forEach(function(s){if(!found&&String(s||'').trim().toLowerCase()===key)found='the seal history'})});
  return found;
}
window.r664OpenSealCorrection=function(cartId){
  if(!actualMaster())return toast('Only the actual Master can correct a recorded seal.','err');
  var cart=(typeof crashCarts==='function'?(crashCarts()||[]):[]).find(function(c){return String(c.id)===String(cartId)});
  if(!cart)return toast('Crash Cart not found.','err');
  if((typeof crashReports==='function'?(crashReports()||[]):[]).some(function(r){return String(r.cartId)===String(cartId)&&r.status==='open'}))return toast('Close the active opening report before correcting the recorded seal.','err');
  ensureSealModal();SEAL_CART_ID=String(cartId);
  E('r664-seal-cart-name').textContent=String(cart.name||cart.number||cart.id);
  E('r664-seal-current').textContent=String(cart.seal||'—');
  E('r664-seal-new').value='';E('r664-seal-reason').value='';E('r664-seal-error').style.display='none';
  E('r664-seal-correction-modal').classList.add('on');setTimeout(function(){E('r664-seal-new').focus()},30);
};
async function saveSealCorrection(){
  if(!actualMaster())return toast('Only the actual Master can correct a recorded seal.','err');
  var newSeal=String(E('r664-seal-new').value||'').trim(),reason=String(E('r664-seal-reason').value||'').trim(),errorBox=E('r664-seal-error');
  function fail(message){errorBox.textContent=message;errorBox.style.display='block';toast(message,'err');return false}
  if(!newSeal)return fail('Enter the correct seal number. / أدخل رقم القفل الصحيح');
  if(reason.length<5)return fail('Enter a clear correction reason. / اكتب سببًا واضحًا للتصحيح');
  var original=JSON.parse(JSON.stringify(typeof crashCarts==='function'?(crashCarts()||[]):[]));
  var carts=JSON.parse(JSON.stringify(original)),cart=carts.find(function(c){return String(c.id)===SEAL_CART_ID});
  if(!cart)return fail('Crash Cart not found.');
  var oldSeal=String(cart.seal||'').trim();
  if(newSeal.toLowerCase()===oldSeal.toLowerCase())return fail('The corrected seal is the same as the current recorded seal.');
  var conflict=usedSeal(newSeal,cart.id);if(conflict)return fail('This seal is already used in '+conflict+'. Enter a unique seal.');
  if((typeof crashReports==='function'?(crashReports()||[]):[]).some(function(r){return String(r.cartId)===String(cart.id)&&r.status==='open'}))return fail('Close the active opening report first.');
  var stamp=new Date().toISOString(),u=currentUser(),actorName=String((window.actualActorName&&actualActorName())||u.displayName||u.name||u.email||u.username||u.id||'Master');
  cart.seal=newSeal;cart.updatedAt=stamp;cart.updatedBy=actorName;
  cart.lastSealCorrectionAt=stamp;cart.lastSealCorrectionBy=actorName;cart.lastSealCorrectionReason=reason;cart.lastSealCorrectionOldValue=oldSeal;
  var button=E('r664-seal-save');button.disabled=true;button.textContent='Saving… / جاري الحفظ';
  try{
    await setCrashCarts(carts);
    var verified=(crashCarts()||[]).find(function(c){return String(c.id)===String(cart.id)});
    if(!verified||String(verified.seal||'')!==newSeal)throw new Error('The corrected seal did not persist.');
    if(typeof auditAction==='function')await auditAction('crash_cart_master_seal_correction',{
      cartId:cart.id,departmentId:cart.deptId||'',cartName:cart.name||'',oldSeal:oldSeal,newSeal:newSeal,
      reason:reason,operation:'seal_correction',openingLog:false,contentsChanged:false,timestampsChanged:false,correctedAt:stamp
    });
    E('r664-seal-correction-modal').classList.remove('on');
    if(typeof renderCrashOperations==='function')renderCrashOperations();
    if(typeof renderCrashCarts==='function')renderCrashCarts();
    toast('Seal corrected and verified without opening the Crash Cart ✓','succ');
  }catch(error){
    try{await setCrashCarts(original)}catch(ignore){}
    fail(String(error&&error.message||error));
  }finally{button.disabled=false;button.textContent='Save correction / حفظ التصحيح'}
}
function installSealButtons(){
  if(!actualMaster())return;
  document.querySelectorAll('#r17-crash-admin-list [data-cart]').forEach(function(row){
    if(row.querySelector('.r664-seal-correct-btn'))return;
    var cartId=row.getAttribute('data-cart'),actions=row.querySelector('.fl.g8')||row.lastElementChild;
    if(!actions)return;
    var b=document.createElement('button');b.type='button';b.className='btn bg bsm r664-seal-correct-btn';b.textContent='Correct seal / تصحيح القفل';
    b.onclick=function(){window.r664OpenSealCorrection(cartId)};actions.appendChild(b);
  });
}
var originalRenderCrashOperations=window.renderCrashOperations;
if(typeof originalRenderCrashOperations==='function')window.renderCrashOperations=function(){var result=originalRenderCrashOperations.apply(this,arguments);setTimeout(installSealButtons,0);return result};

/* Master cloud backup: authenticated, chunked Firestore snapshots, latest seven retained.
   Local IndexedDB backup remains as a second layer. */
var CLOUD_COLLECTION='floorstock_backups',CLOUD_KEEP=7,CLOUD_CHUNK=420000;
function backupStatus(message,isError){var e=E('r664-cloud-backup-status');if(e){e.textContent=message||'';e.style.color=isError?'var(--rdl)':'var(--tx2)'}}
async function readCollection(name){
  var snapshot=await FB_DB.collection(name).get(),rows=[];
  snapshot.forEach(function(doc){rows.push({id:doc.id,data:doc.data()})});
  return rows;
}
async function buildCloudPayload(){
  var names=['floorstock_state','public_expiry','public_controlled_expiry'],collections={};
  for(var i=0;i<names.length;i++)collections[names[i]]=await readCollection(names[i]);
  return {format:'ASDHealth-Cloud-Backup',version:1,projectId:(window.FIREBASE_CONFIG&&FIREBASE_CONFIG.projectId)||'',createdAt:new Date().toISOString(),createdBy:FB_AUTH.currentUser.uid,collections:collections};
}
async function deleteSnapshot(ref){
  var chunks=await ref.collection('chunks').get(),docs=chunks.docs||[];
  for(var start=0;start<docs.length;start+=400){
    var batch=FB_DB.batch();
    docs.slice(start,start+400).forEach(function(doc){batch.delete(doc.ref)});
    await batch.commit();
  }
  await ref.delete();
}
window.masterCreateCloudBackup=async function(manual){
  if(!actualMaster()||!FB_AUTH||!FB_AUTH.currentUser||!FB_DB){if(manual)toast('Master permission required.','err');return false}
  var button=E('r664-cloud-backup-btn');if(button)button.disabled=true;backupStatus('Creating encrypted-at-rest authenticated cloud backup…');
  try{
    var payload=await buildCloudPayload(),text=JSON.stringify(payload),chunks=[];
    for(var i=0;i<text.length;i+=CLOUD_CHUNK)chunks.push(text.slice(i,i+CLOUD_CHUNK));
    var uid=FB_AUTH.currentUser.uid,id=payload.createdAt.replace(/[:.]/g,'-'),root=FB_DB.collection(CLOUD_COLLECTION).doc(uid).collection('snapshots'),ref=root.doc(id);
    await ref.set({createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdAtText:payload.createdAt,size:text.length,chunkCount:chunks.length,format:payload.format,version:payload.version});
    for(var c=0;c<chunks.length;c++)await ref.collection('chunks').doc(String(c).padStart(4,'0')).set({index:c,data:chunks[c]});
    var all=await root.orderBy('createdAtText','desc').get(),old=[];all.forEach(function(doc,index){if(index>=CLOUD_KEEP)old.push(doc.ref)});
    for(var j=0;j<old.length;j++)await deleteSnapshot(old[j]);
    localStorage.setItem('r664_last_cloud_backup',payload.createdAt);
    backupStatus('Cloud backup saved: '+new Date(payload.createdAt).toLocaleString()+' · '+chunks.length+' chunk(s)');
    if(manual)toast('Cloud backup saved ✓','succ');return true;
  }catch(error){backupStatus('Cloud backup failed: '+String(error&&error.message||error),true);if(manual)toast('Cloud backup failed. Check Firestore rules.','err');return false}
  finally{if(button)button.disabled=false}
};
function ensureCloudBackupUi(){
  if(!actualMaster())return;
  var page=E('pg-backup-restore');if(!page||E('r664-cloud-backup-card'))return;
  var card=document.createElement('div');card.className='card';card.id='r664-cloud-backup-card';
  card.innerHTML='<div class="ch"><span class="ct">☁ Authenticated cloud backup / النسخ السحابي الموثق</span><span class="badge bgn">Master only</span></div>'+
    '<div class="cb"><p style="font-size:13px;color:var(--tx2);margin-bottom:12px">Creates a private chunked Firestore snapshot in addition to the local browser backup. The latest seven cloud snapshots are retained.</p>'+
    '<button class="btn bp" id="r664-cloud-backup-btn" type="button">Create cloud backup now / إنشاء نسخة سحابية الآن</button>'+
    '<div class="r664-cloud-status" id="r664-cloud-backup-status"></div></div>';
  page.appendChild(card);E('r664-cloud-backup-btn').onclick=function(){window.masterCreateCloudBackup(true)};
  var last=localStorage.getItem('r664_last_cloud_backup');if(last)backupStatus('Last cloud backup: '+new Date(last).toLocaleString());
}
async function dailyCloudBackup(){
  if(!actualMaster()||!FB_AUTH||!FB_AUTH.currentUser)return;
  var today=new Date().toISOString().slice(0,10),last=String(localStorage.getItem('r664_last_cloud_backup')||'').slice(0,10);
  if(last!==today)await window.masterCreateCloudBackup(false);
}
function boot(){
  installPublicGates();ensureCloudBackupUi();setTimeout(installSealButtons,100);
  setTimeout(function(){dailyCloudBackup().catch(function(){})},3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){var result=previousStart.apply(this,arguments);setTimeout(boot,900);return result};
})();








export {};

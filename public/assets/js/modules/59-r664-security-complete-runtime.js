import { normalizeRole, resolvePermissionProfile, canWriteStateKey, canDeleteStateKey } from '../core/role-capabilities.js?v=1';
(function(){
'use strict';

const E=globalThis.E;
function safe(v){return window.fsEsc?window.fsEsc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function currentUser(){return window.CU||{}}
function actualUser(){return (window.fsActualUser&&window.fsActualUser())||window.MASTER_ACTUAL||currentUser()}
function effectiveUser(){return (window.fsEffectiveUser&&window.fsEffectiveUser())||currentUser()}
function actualMaster(){
  try{if(typeof window.isMasterActual==='function')return !!window.isMasterActual()}catch(ignore){}
  var u=actualUser();return !!(u&&u.master===true);
}
function permissionProfile(){return resolvePermissionProfile({currentUser:currentUser(),effectiveUser:effectiveUser(),actualUser:actualUser(),previewUser:window.MASTER_EFFECTIVE||null})}
function role(){return permissionProfile().role||''}
function deptId(){return permissionProfile().deptId||''}
function active(){var u=permissionProfile();return !!(u&&(u.id||u.uid||u.email||u.username||u.role)&&u.active!==false)}
window.fsPermissionProfile=permissionProfile;
function director(){return actualMaster()||['pharmacy','pharmacy_director'].indexOf(role())>=0}
function pharmacyOperations(){return director()||['inpatient_supervisor','pharmacy_staff'].indexOf(role())>=0}
function controlledOfficer(){return director()||['controlled_pharmacy'].indexOf(role())>=0}
function warehouseOfficer(){return director()||role()==='warehouse'}
function stateKeyAllowed(key){
  var user=permissionProfile();
  return active()&&canWriteStateKey(user,key);
}
window.fsCanWriteStateKey=stateKeyAllowed;

function installStateGate(){
  if(!window.S||typeof S.s!=='function'||S.s.__r664SecurityGate)return false;
  var originalSet=S.s.bind(S),originalRemove=typeof S.rm==='function'?S.rm.bind(S):null;
  var gatedSet=function(key,value){
    if(!stateKeyAllowed(key)){
      var error=new Error('This account is not authorized to modify '+String(key)+'.');
      if(typeof window.toast==='function')toast('Not authorized to modify '+String(key)+'. / لا يملك هذا الدور صلاحية تعديل '+String(key)+'.','err');
      return Promise.reject(error);
    }
    return originalSet(key,value);
  };
  gatedSet.__r664SecurityGate=true;
  S.s=gatedSet;
  if(originalRemove)S.rm=function(key){
    var user=permissionProfile();
    if(!active()||!canDeleteStateKey(user,key)){
      if(typeof window.toast==='function')toast('Not authorized to delete '+String(key)+'. / لا يملك هذا الدور صلاحية حذف '+String(key)+'.','err');
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
  if(typeof window.crashCartSealMeetsMinLength==='function'&&!window.crashCartSealMeetsMinLength(newSeal))return fail('Seal is shorter than the configured minimum length ('+(window.crashCartMinSealLength?window.crashCartMinSealLength():0)+'). / رقم القفل أقصر من الحد الأدنى المحدد ('+(window.crashCartMinSealLength?window.crashCartMinSealLength():0)+').');
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
window.__renderCrashOperationsAfterExtensions=window.__renderCrashOperationsAfterExtensions||[];
window.__renderCrashOperationsAfterExtensions.push(function(){setTimeout(installSealButtons,0)});

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
    if(typeof window.ensureGeoAllowed==='function')await window.ensureGeoAllowed();
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
window.__startAppExtensions=window.__startAppExtensions||[];
window.__startAppExtensions.push(function(){setTimeout(boot,900)});
})();

// --- Merged from 56-r664-security-idle-timeout.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var WARNING_MS=28*60*1000,LOGOUT_MS=30*60*1000;
  var warningTimer=null,logoutTimer=null,lastActivity=Date.now(),warningOpen=false,lastReset=0;
  function signedIn(){return !!(window.FB_AUTH&&FB_AUTH.currentUser)}
  function clearTimers(){if(warningTimer)clearTimeout(warningTimer);if(logoutTimer)clearTimeout(logoutTimer);warningTimer=logoutTimer=null}
  async function forceLogout(){clearTimers();warningOpen=false;try{if(window.FB_AUTH&&FB_AUTH.currentUser)await FB_AUTH.signOut()}catch(ignore){}try{sessionStorage.clear()}catch(ignore){}location.reload()}
  function showWarning(){
    if(!signedIn()||warningOpen)return;
    warningOpen=true;
    if(typeof window.uiConfirm==='function'){
      // preventBackdropClose: this dialog's "false" branch signs the user out
      // immediately (see forceLogout below) — a stray tap outside the box
      // (very easy on a small mobile screen, especially mid-interaction with
      // a form like expiry entry) must never be read as "sign out". Only the
      // explicit Continue/Sign out buttons should resolve it.
      window.uiConfirm('Your session will close in 2 minutes because no activity was detected.\n\nستنتهي الجلسة خلال دقيقتين بسبب عدم النشاط.\n\nContinue this session?',{title:'Session timeout / انتهاء الجلسة',okText:'Continue / متابعة',cancelText:'Sign out / تسجيل الخروج',preventBackdropClose:true}).then(function(continueSession){warningOpen=false;if(continueSession)reset(true);else forceLogout()});
    }else if(typeof window.toast==='function')window.toast('ستنتهي الجلسة خلال دقيقتين بسبب عدم النشاط.\nThe session will close in 2 minutes because no activity was detected.','info');
  }
  function schedule(){clearTimers();if(!signedIn())return;var elapsed=Date.now()-lastActivity;warningTimer=setTimeout(showWarning,Math.max(0,WARNING_MS-elapsed));logoutTimer=setTimeout(forceLogout,Math.max(0,LOGOUT_MS-elapsed))}
  function reset(force){if(warningOpen&&!force)return;var now=Date.now();if(!force&&now-lastReset<15000)return;lastReset=now;lastActivity=now;schedule()}
  // 'input'/'focus' cover time spent inside a native mobile picker (date/
  // select wheels are OS-level UI, not page DOM — no pointerdown/touchstart
  // reaches the document while one is open) or just typing/selecting in a
  // field without an incidental scroll/tap on the page around it.
  ['pointerdown','keydown','touchstart','scroll','input','focus'].forEach(function(name){document.addEventListener(name,function(){reset(false)},{capture:true,passive:true})});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){if(signedIn()&&Date.now()-lastActivity>=LOGOUT_MS)forceLogout();else schedule()}});
  function attach(){if(window.FB_AUTH&&typeof FB_AUTH.onAuthStateChanged==='function')FB_AUTH.onAuthStateChanged(function(user){if(user)reset(true);else clearTimers()});else setTimeout(attach,500)}
  attach();
})();

// --- Merged from 58-r664-public-privacy-rewrite.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var attempts=0,running=false;
  function allowed(){var u=window.CU||{};return u.active!==false&&(u.master===true||String(u.role||'')==='pharmacy'||String(u.role||'')==='inpatient_supervisor')}
  async function rewrite(){
    if(running||sessionStorage.getItem('r664_public_privacy_rewritten')==='1')return;
    if(!allowed()||!window.S||!S.ready||!window.FB_DB){if(++attempts<40)setTimeout(rewrite,750);return}
    if(typeof publishPublic!=='function'){if(++attempts<40)setTimeout(rewrite,750);return}
    running=true;
    try{
      var carts=typeof crashCarts==='function'?(crashCarts()||[]):[];
      if(Array.isArray(carts)&&carts.length)await publishPublic(carts);
      var departments=typeof gd==='function'?(gd()||[]):[];
      for(var i=0;i<departments.length;i++){
        var id=String(departments[i]&&departments[i].id||'');if(!id)continue;
        if(typeof ctlPublishDept==='function')await ctlPublishDept(id);
        if(typeof syncPublicExpiry==='function'&&typeof getExpiry==='function')await syncPublicExpiry(id,getExpiry(id)||[]);
      }
      if(typeof storageState==='function'&&typeof controlledMeds==='function'&&typeof publishStorage==='function'){
        var state=storageState(),medicines=controlledMeds();
        for(var j=0;j<(state.units||[]).length;j++)await publishStorage(state.units[j],medicines);
      }
      sessionStorage.setItem('r664_public_privacy_rewritten','1');
    }catch(error){console.warn('Public privacy rewrite will retry on the next authorized session.',error)}
    finally{running=false}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(rewrite,1200)},{once:true});else setTimeout(rewrite,1200);
  window.__startAppExtensions=window.__startAppExtensions||[];
  window.__startAppExtensions.push(function(){setTimeout(rewrite,1500)});
})();


// --- Merged from 60-csp-legacy-event-bridge.js (Phase 6 consolidation) ---
(function(){
'use strict';

/*
 * R6.65 is protected by a CSP that intentionally blocks inline event handlers.
 * Older feature modules still create trusted application controls with onclick,
 * onchange, oninput, and onkeydown attributes. This bridge removes those
 * attributes as soon as they enter the DOM and binds their small, known action
 * grammar without eval, Function, or unsafe-inline.
 */
var ALLOWED=new Set((
  'CM OM showPg captureFrame restartScanner openManageCats openAnnouncementEditor toggleAnnouncement deleteAnnouncement saveAnnouncement toggleAnnouncementDepartments '+
  'moveManagedCategory removeManagedCategory renameManagedCategory openEditShelf removeShelf openNoteReply quickResolve '+
  'editReqWindow toggleWindow delWindow editDispSlot delSlot setRequestGridDay saveRequestCountLimits '+
  'openEditDrug moveDrugOrder delDrug onInvCheck openEditExpiry delBatch openAddExpiryForMed toggleShelfMedication '+
  'impToggleRow impEdit ctlPdfSetField ctlSavePendingPdfExpiry ctlAddBatchEditorRow ctlSaveBatchEditor ctlDispTypeChanged ctlConfirmDispense ctlSavePrintLogo ctlToggleDeptMed ctlEditDeptMedicine ctlRemoveDeptMedicine '+
  'ctlAddCatalogMedicine ctlEditCatalogMedicine ctlEditWarehouseStock ctlSendToPharmacy ctlEditPharmacyStock ctlOpenDispense ctlReceiveDelivery ctlImportMasterFile ctlImportMasterText '+
  'ctlDeptFinalApply ctlDeptFinalToggle ctlConfirmDepartmentPrint ctlOpenDepartmentPrintOptions renderDepartmentControlledPanel '+
  'crashPrint crashAddItem crashReportOpen ccxOpenReport ccCrashExpiryChoiceChanged ccCrashUnavailableToggled ccCrashResponsePreview v13asViewReport setCrashSealPolicy ccAcceptReport ccRejectReport ccToggleNoConsumption ccSaveNCSettings '+
  'r17CrashSaveDetails r18OpenCrashCorrection r18CrashCorrectionAddBatch r17CrashRenderMatrix '+
  'acc2SetAdminTab acc2RefreshMedicationList acc2SaveAssignment acc2CancelAssignmentEdit acc2EditAssignment acc2ToggleAssignment acc2DeleteAssignment acc2SetFilter acc2Decision acc2SetReceiptDept acc2RegimenDeptChanged acc2SaveRegimenVersion acc2CancelRegimenEdit acc2ActivateRegimen acc2ToggleRegimenPause acc2StartRegimenVersion acc2DeleteRegimen acc2SubmitUsage acc2ToggleAllReceipt acc2CreateReceipt '+
  'acc3SetDept acc3AddMedicine acc3ToggleMedicine acc3SaveRegimen acc3CancelEdit acc3EditRegimen acc3PrintRegimen acc3ToggleRegimen acc3AddItemRow acc3RemoveItemRow '+
  'controlledStorageCountsChanged controlledStorageEditUnit controlledStoragePrint controlledStorageDeleteUnit controlledStorageAssignByName controlledStorageValidateSearch '+
  'ctlOpenHijriLedger ctlEditLedgerMove ctlOpenCustodyHandover ctlReprintHandover '+
  'ctlAnApply ctlAnPrint ctlCmpApply ctlCmpPrint _r676PrintDept '+
  'bulkReplacementToggleLimits runBulkReplacement aaFinalSaveExpiryRules phExpiryToggleDept phExpirySetView phExpirySelectAllDepartments phExpiryClearDepartments phExpiryEditRules '+
  'v13InventorySelect updateAllInventoryMergeCount v13SelectVisibleInventory v13ApplyBulkClassification openMergeInventoryNames undoLatestInventoryNameMerge v13OpenBulkClassification v13WLoadMore v13ApplyControlledClassification v13BulkReplacementClassOnly '+
  'v13XClose v13XAddBatch v13XSaveCatalogMed v13XSaveStock valQ v14SaveEditReq2 v14SetPrintFilter v16ToggleScope v16ToggleMultiApplicable v16ApplyMultiClean v16ManageHiddenCategories v16SaveHiddenCats '+
  'whBulkResolveRow whBulkReceiveOpen whBulkDispenseOpen whReceiveOpen whReceiveSelect confirmMergeInventoryNames purgeOrphanDepartment print '+
  'clGenerate clCancelReview clConfirmSave clPrint clToggleRole clTogglePerDeptFilter plToggle '+
  'acc2SaveClassColors acc2ResetClassColors '+
  'ccTabCarts ccTabOps clTabLists clTabColors usrTabUsers usrTabPerms ccOpsTab '+
  'acc2AddExpiryRow acc2RemoveExpiryRow acc2SaveExpiryBatches '+
  'parseFloat isNaN'
).split(/\s+/).filter(Boolean));

var ATTRIBUTE_EVENTS={onclick:'click',onchange:'change',oninput:'input',onsubmit:'submit',onkeydown:'keydown',onkeyup:'keyup'};

function report(error,expression){
  console.error('CSP-safe legacy action failed:',expression,error);
  if(typeof window.toast==='function')window.toast('Action could not be completed. / تعذر تنفيذ العملية','err');
}
function splitTop(value,separator){
  var out=[],start=0,quote='',escape=false,depth=0;
  for(var i=0;i<value.length;i++){
    var ch=value[i];
    if(escape){escape=false;continue}
    if(ch==='\\'){escape=true;continue}
    if(quote){if(ch===quote)quote='';continue}
    if(ch==='\''||ch==='"'){quote=ch;continue}
    if(ch==='('||ch==='['||ch==='{')depth++;
    else if(ch===')'||ch===']'||ch==='}')depth=Math.max(0,depth-1);
    else if(ch===separator&&depth===0){out.push(value.slice(start,i));start=i+1}
  }
  out.push(value.slice(start));return out;
}
function stringValue(raw){
  var body=raw.slice(1,-1);
  return body.replace(/\\(['"\\nrt])/g,function(_,ch){return ch==='n'?'\n':ch==='r'?'\r':ch==='t'?'\t':ch});
}
function argument(raw,element,event){
  raw=String(raw||'').trim();
  var numeric=false;if(raw[0]==='+'){numeric=true;raw=raw.slice(1).trim()}
  var value;
  if((raw[0]==='\''&&raw[raw.length-1]==='\'')||(raw[0]==='"'&&raw[raw.length-1]==='"'))value=stringValue(raw);
  else if(raw==='true'||raw==='false')value=raw==='true';
  else if(raw==='null')value=null;
  else if(raw==='this')value=element;
  else if(raw==='event')value=event;
  else if(raw==='this.value')value=element.value;
  else if(raw==='this.checked')value=!!element.checked;
  else if(raw==='this.files[0]')value=element.files&&element.files[0];
  else if(/^this\.dataset\.[A-Za-z_$][\w$]*$/.test(raw))value=element.dataset[raw.split('.').pop()];
  else if(/^this\.getAttribute\((['"]).*\1\)$/.test(raw)){var match=raw.match(/^this\.getAttribute\((['"])(.*)\1\)$/);value=element.getAttribute(match[2])}
  else if(/^-?\d+(?:\.\d+)?$/.test(raw))value=Number(raw);
  else throw new Error('Unsupported legacy action argument: '+raw);
  return numeric?Number(value):value;
}
function runCall(statement,element,event){
  var match=statement.match(/^(?:window\.)?([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if(!match)return false;
  var name=match[1];
  if(!ALLOWED.has(name))throw new Error('Legacy action is not allowlisted: '+name);
  var fn=name==='print'?window.print:window[name];
  if(typeof fn!=='function')throw new Error('Legacy action is unavailable: '+name);
  var rawArgs=match[2].trim(),args=rawArgs?splitTop(rawArgs,',').map(function(raw){return argument(raw,element,event)}):[];
  var result=fn.apply(element,args);
  if(result&&typeof result.catch==='function')result.catch(function(error){report(error,statement)});
  return true;
}
function runStatement(statement,element,event){
  statement=String(statement||'').trim().replace(/^return\s+/,'');
  if(!statement)return true;
  var guarded=statement.match(/^if\(typeof (?:window\.)?([A-Za-z_$][\w$]*)===['"]function['"]\)([\s\S]+)$/);
  if(guarded){if(typeof window[guarded[1]]!=='function')return true;statement=guarded[2].trim()}
  var exists=statement.match(/^if\(window\.([A-Za-z_$][\w$]*)\)([\s\S]+)$/);
  if(exists){if(!window[exists[1]])return true;statement=exists[2].trim()}
  if(/^if\(event\.key===['"]Enter['"]\)\{?this\.blur\(\)\}?$/.test(statement)){if(event.key==='Enter')element.blur();return true}
  if(statement==='this.parentElement.remove()'){if(element.parentElement)element.parentElement.remove();return true}
  var closestRemove=statement.match(/^this\.closest\((['"])(.+)\1\)\.remove\(\)$/);
  if(closestRemove){var closest=element.closest(closestRemove[2]);if(closest)closest.remove();return true}
  var byIdRemove=statement.match(/^document\.getElementById\((['"])(.+)\1\)\.remove\(\)$/);
  if(byIdRemove){var found=document.getElementById(byIdRemove[2]);if(found)found.remove();return true}
  var byIdClick=statement.match(/^document\.getElementById\((['"])(.+)\1\)\.click\(\)$/);
  if(byIdClick){var clickable=document.getElementById(byIdClick[2]);if(clickable)clickable.click();return true}
  var toggle=statement.match(/^this\.closest\((['"])(.+)\1\)\.classList\.toggle\((['"])(.+)\3,this\.checked\)$/);
  if(toggle){var host=element.closest(toggle[2]);if(host)host.classList.toggle(toggle[4],!!element.checked);return true}
  if(statement==='this.value=Math.min(Math.max(0,+this.value||0),+this.dataset.max)'){
    element.value=Math.min(Math.max(0,Number(element.value)||0),Number(element.dataset.max));return true;
  }
  if(statement==='ACC2_UI.filters.medicine=this.value'){
    if(window.ACC2_UI&&window.ACC2_UI.filters)window.ACC2_UI.filters.medicine=element.value;return true;
  }
  if(statement==='clearTimeout(window.acc2FilterTimer)'){clearTimeout(window.acc2FilterTimer);return true}
  if(statement==='window.acc2FilterTimer=setTimeout(r17AccRenderVerify,140)'){
    if(typeof window.r17AccRenderVerify==='function')window.acc2FilterTimer=setTimeout(window.r17AccRenderVerify,140);return true;
  }
  return runCall(statement,element,event);
}
function execute(expression,element,event){
  var statements=splitTop(String(expression||''),';');
  for(var i=0;i<statements.length;i++){
    if(!runStatement(statements[i],element,event))throw new Error('Unsupported legacy action: '+statements[i]);
  }
}
function bindAttribute(element,attribute,eventName){
  var expression=element.getAttribute(attribute);if(!expression)return;
  element.removeAttribute(attribute);
  element.addEventListener(eventName,function(event){
    if(eventName==='click'||eventName==='submit')event.preventDefault();
    try{execute(expression,element,event)}catch(error){report(error,expression)}
  });
}
function bindTree(root){
  if(!root||root.nodeType!==1)return;
  Object.keys(ATTRIBUTE_EVENTS).forEach(function(attribute){
    if(root.hasAttribute&&root.hasAttribute(attribute))bindAttribute(root,attribute,ATTRIBUTE_EVENTS[attribute]);
    root.querySelectorAll('['+attribute+']').forEach(function(element){bindAttribute(element,attribute,ATTRIBUTE_EVENTS[attribute])});
  });
}
function install(){
  bindTree(document.documentElement);
  new MutationObserver(function(records){records.forEach(function(record){
    if(record.type==='attributes')bindTree(record.target);
    else record.addedNodes.forEach(bindTree);
  })}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:Object.keys(ATTRIBUTE_EVENTS)});
  document.documentElement.setAttribute('data-asdh-csp-bridge','ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

(function(){
'use strict';

var FALLBACK_LABEL='QR unavailable / رمز QR غير متاح';
var warned=false;

function escapeXml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(character){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character];
  });
}

function placeholderDataUrl(label){
  var text=String(label||FALLBACK_LABEL);
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">'+
    '<rect width="360" height="360" fill="#fff" stroke="#111" stroke-width="8"/>'+
    '<path d="M42 42h82v82H42zm194 0h82v82h-82zM42 236h82v82H42z" fill="none" stroke="#111" stroke-width="12"/>'+
    '<text x="180" y="178" text-anchor="middle" font-family="Arial,Tahoma,sans-serif" font-size="20" font-weight="700" fill="#111">QR unavailable</text>'+
    '<text x="180" y="210" text-anchor="middle" font-family="Arial,Tahoma,sans-serif" font-size="18" fill="#111">'+escapeXml(text.indexOf('/')>=0?'رمز QR غير متاح':text)+'</text>'+
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

function reportFailure(error){
  if(warned)return;
  warned=true;
  try{console.warn('Local QR generation is unavailable; printing will continue without a scannable QR code.',error)}catch(ignore){}
}

function createCode(text,options){
  options=options||{};
  if(typeof window.qrcode!=='function')throw new Error('The local QR generator did not initialize.');
  var code=window.qrcode(0,String(options.errorCorrection||'H').toUpperCase());
  code.addData(String(text==null?'':text),'Byte');
  code.make();
  return code;
}

function createQrDataUrl(text,options){
  options=options||{};
  try{
    var code=createCode(text,options);
    var cellSize=Math.max(2,Number(options.cellSize)||6);
    var margin=Math.max(2,Number(options.margin)||4);
    return code.createDataURL(cellSize,margin);
  }catch(error){
    reportFailure(error);
    return placeholderDataUrl(options.fallbackLabel||FALLBACK_LABEL);
  }
}

function isPlaceholder(source){
  return /^data:image\/svg\+xml/i.test(String(source||''));
}

function createQrSvg(text,options){
  options=options||{};
  try{
    var code=createCode(text,options);
    return code.createSvgTag({
      cellSize:Math.max(2,Number(options.cellSize)||6),
      margin:Math.max(2,Number(options.margin)||4),
      scalable:true,
      alt:{text:String(options.alt||'QR code')},
      title:{text:String(options.title||'QR code')}
    });
  }catch(error){
    reportFailure(error);
    return '<div class="asd-qr-unavailable" role="img" aria-label="'+escapeXml(options.alt||FALLBACK_LABEL)+'">'+escapeXml(FALLBACK_LABEL)+'</div>';
  }
}

function imageMarkup(text,options){
  options=options||{};
  var source=createQrDataUrl(text,options);
  var width=Math.max(24,Number(options.width)||120);
  var height=Math.max(24,Number(options.height)||width);
  return '<img class="asd-qr-image" data-qr-state="'+(isPlaceholder(source)?'unavailable':'ready')+'" src="'+escapeXml(source)+'" width="'+width+'" height="'+height+'" alt="'+escapeXml(options.alt||'QR code')+'">';
}

function renderQr(target,text,options){
  var element=typeof target==='string'?document.querySelector(target):target;
  if(!element)return false;
  options=options||{};
  if(element.tagName==='IMG'){
    element.classList.add('asd-qr-image');
    element.src=createQrDataUrl(text,options);
    element.dataset.qrState=isPlaceholder(element.src)?'unavailable':'ready';
    element.alt=String(options.alt||'QR code');
    return true;
  }
  element.innerHTML=imageMarkup(text,options);
  return true;
}

function printRuntimeScript(options){
  options=options||{};
  var closeAfter=options.closeAfter===true;
  var timeout=Math.max(1000,Number(options.timeout)||5000);
  return '(function(){var printed=false,timeout='+JSON.stringify(timeout)+',closeAfter='+JSON.stringify(closeAfter)+';'+
    'function unavailable(img){return img.dataset.qrState==="unavailable"||/^data:image\\/svg\\+xml/i.test(img.getAttribute("src")||"")}'+
    'function fail(message){document.body.dataset.qrPrint="failed";var imgs=Array.from(document.querySelectorAll("img.asd-qr-image"));imgs.forEach(function(img){if(unavailable(img))img.style.display="none"});var box=document.getElementById("asd-qr-print-error");if(!box){box=document.createElement("div");box.id="asd-qr-print-error";box.setAttribute("role","alert");box.style.cssText="margin:12px;padding:12px;border:2px solid #b42318;background:#fff1f0;color:#7a271a;font:700 13px Arial;text-align:center";box.innerHTML="QR generation failed; automatic printing was stopped because the code would not be scannable.<br>تعذر إنشاء رمز QR، وتم إيقاف الطباعة التلقائية لأن الرمز لن يكون قابلاً للمسح.<br><button type=\\"button\\" style=\\"margin-top:8px;padding:7px 12px\\">Print without QR / طباعة بدون QR</button>";document.body.insertBefore(box,document.body.firstChild);box.querySelector("button").onclick=function(){window.focus();window.print()}}console.error(message||"Printable QR unavailable")}'+
    'function ready(img){return new Promise(function(resolve,reject){if(unavailable(img))return reject(new Error("QR generator returned a placeholder"));if(img.complete)return img.naturalWidth>0?resolve():reject(new Error("QR image failed to decode"));var done=false,timer=setTimeout(function(){if(done)return;done=true;reject(new Error("QR image load timed out"))},timeout);img.addEventListener("load",function(){if(done)return;done=true;clearTimeout(timer);img.naturalWidth>0?resolve():reject(new Error("QR image failed to decode"))},{once:true});img.addEventListener("error",function(){if(done)return;done=true;clearTimeout(timer);reject(new Error("QR image failed to load"))},{once:true})})}'+
    'function start(){var manual=document.querySelector("[data-qr-print-button]");if(manual){manual.disabled=true;manual.onclick=null}var imgs=Array.from(document.querySelectorAll("img.asd-qr-image"));if(!imgs.length)return fail("No QR image was rendered");Promise.all(imgs.map(ready)).then(function(){document.body.dataset.qrPrint="ready";if(manual){manual.disabled=false;manual.onclick=function(){window.focus();window.print()}}if(printed)return;printed=true;setTimeout(function(){window.focus();window.print();if(closeAfter)setTimeout(function(){window.close()},50)},100)}).catch(function(error){fail(error&&error.message)})}'+
    'if(document.readyState==="complete")start();else window.addEventListener("load",start,{once:true})})();';
}

var api=Object.freeze({
  dataUrl:createQrDataUrl,
  svg:createQrSvg,
  imageMarkup:imageMarkup,
  render:renderQr,
  placeholderDataUrl:placeholderDataUrl,
  isPlaceholder:isPlaceholder,
  printRuntimeScript:printRuntimeScript,
  available:function(){return typeof window.qrcode==='function'}
});

window.ASD_QR=api;
window.makeReadableQR=createQrDataUrl;
})();


// --- Merged from 02-r664-early-production-console-policy.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  if(!window.console||window.__ASDH_DEBUG)return;
  var nativeError=typeof console.error==='function'?console.error.bind(console):function(){};
  var nativeWarn=typeof console.warn==='function'?console.warn.bind(console):function(){};
  ['log','info','debug','trace'].forEach(function(method){try{console[method]=function(){}}catch(ignore){}});
  try{console.warn=function(){nativeWarn('[ASDHealth] A recoverable warning occurred.');}}catch(ignore){}
  try{console.error=function(){nativeError('[ASDHealth] An operation failed. Review the in-app message or Firebase logs.');}}catch(ignore){}
})();

/* Stable architecture boundary shared by legacy-compatible modules.  New code
   should use this facade instead of adding another window-level wrapper. */
(function(){
  'use strict';
  var existing=window.FSArchitecture||{},listeners=existing.listeners||{};
  function norm(value){return String(value==null?'':value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
  function aliases(profile){profile=profile||window.CU||{};return [profile.deptId,profile.departmentId,profile.deptName,profile.departmentName,profile.department,profile.deptCode,profile.departmentCode].map(norm).filter(Boolean)}
  function on(name,handler){if(typeof handler!=='function')return function(){};(listeners[name]||(listeners[name]=[])).push(handler);return function(){var list=listeners[name]||[],i=list.indexOf(handler);if(i>=0)list.splice(i,1)}}
  function emit(name,payload){(listeners[name]||[]).slice().forEach(function(handler){try{handler(payload)}catch(error){if(window.console&&console.warn)console.warn('Architecture listener failed',name,error)}})}
  function session(){var c=window.CU||{};return Object.freeze({id:c.id||'',role:c.role||'',deptId:c.deptId||'',deptName:c.deptName||'',master:c.master===true})}
  window.FSArchitecture=Object.assign(existing,{listeners:listeners,normalize:existing.normalize||norm,departmentAliases:existing.departmentAliases||aliases,on:on,emit:emit,session:session,version:'1.0'});
})();

export {};
export {};

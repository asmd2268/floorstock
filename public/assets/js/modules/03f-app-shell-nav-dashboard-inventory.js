import { publishLegacy } from '../core/legacy-registry.js';
import { normalizeRole } from '../core/role-capabilities.js?v=1';
import { isSupportedLoginRole } from '../core/auth-role-policy.js';
import { withTimeout } from '../core/promise-timeout.js';
import { fsStateRestBase } from '../core/firestore-rest-paths.js';
import { FIREBASE_CONFIG } from '../core/firebase-config.js';

// ── APP SHELL: STATE URLS / THEME / AUTO-CATEGORY / AUTH / NAV / DASHBOARD / INVENTORY ──
// Split out of 03-core-application-firebase-state-auth.js (Phase 3 module
// split). Everything else referenced here that isn't declared in this file
// (S, esc, toast, el, gd, gr, gu, getMeds, setMeds, getExpiry, fmtDate,
// fmtDateTime, uiConfirm, uiPrompt, warnPublicSync, ensureFirebaseFunctions,
// waitForFirebase, fsCallableUrl, fsCallFunction, fsStateLoad*, FB_AUTH,
// FB_DB) is already published to globalThis by its owning module.
globalThis.CU = null;
globalThis.RFS = 'all';
globalThis.EDID = null;
globalThis.FRID = null;
globalThis.IROWS = [];
globalThis.SROLE = 'pharmacy';
function getAppUrl(){
  var url=new URL(window.location.href);
  url.search='';
  url.hash='';
  return url.toString();
}
function getPublicExpiryUrl(deptId){
  var url=new URL(getAppUrl());
  url.searchParams.set('view','expiry');
  url.searchParams.set('dept',deptId);
  var tenant=window.fsTenantId&&fsTenantId();if(tenant)url.searchParams.set('tenant',tenant);
  return url.toString();
}
function getMobileRequestUrl(requestId){
  var url=new URL(getAppUrl());
  url.searchParams.set('view','request');
  url.searchParams.set('request',requestId);
  return url.toString();
}

// ── THEME ────────────────────────────────────────────────
async function toggleTheme(){
  var wasLight=document.body.classList.contains('light'),l=!wasLight,btn=el('themeBtn');
  document.body.classList.toggle('light',l);if(btn)btn.innerHTML=l?'☀️':'🌙';
  try{await S.s('theme',l?'light':'dark');return true}catch(e){document.body.classList.toggle('light',wasLight);if(btn)btn.innerHTML=wasLight?'☀️':'🌙';return false}
}
function applyTheme(){
  var t=S.g('theme')||'dark';
  if(t==='light')document.body.classList.add('light');
  var btn=el('themeBtn');if(btn)btn.innerHTML=t==='light'?'☀️':'🌙';
}

// ── AUTO-DETECT CATEGORY ─────────────────────────────────
function autoDetectCat(name){
  var n=name.toLowerCase();
  if(/ampoule|vial|injection|infusion|syringe/.test(n))return 'Injections';
  if(/tablet|capsule/.test(n))return 'Tablets';
  if(/inhaler|nebuliser|nebulizer/.test(n))return 'Inhalers';
  if(/syrup|suspension|oral drop|drops/.test(n)&&!/eye|ear/.test(n))return 'Syrups';
  if(/supposi|enema/.test(n))return 'Suppositories';
  if(/cream|ointment|gel|eye|ear drop|transdermal/.test(n))return 'Ointments & Drops';
  if(/sodium chloride|dextrose|ringer|lactated/.test(n))return 'Solutions';
  return 'Topical';
}

// ── AUTH ─────────────────────────────────────────────────
function selRole(r){
  SROLE=r;
  el('tph').classList.toggle('on',r==='pharmacy');
  el('tdp').classList.toggle('on',r==='department');
  el('dswrap').style.display=r==='department'?'block':'none';
}
function fillDS(){
  var sel=el('dsel');if(!sel)return;
  var ds=typeof window.fsAllowedDepts==='function'?window.fsAllowedDepts():gd();
  sel.innerHTML=ds.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
}
globalThis.fsLoginTimeout = withTimeout;
function fsLoginRestValue(value){
  if(!value||typeof value!=='object')return null;
  if(Object.prototype.hasOwnProperty.call(value,'nullValue'))return null;
  if(Object.prototype.hasOwnProperty.call(value,'stringValue'))return value.stringValue;
  if(Object.prototype.hasOwnProperty.call(value,'booleanValue'))return !!value.booleanValue;
  if(Object.prototype.hasOwnProperty.call(value,'integerValue'))return Number(value.integerValue);
  if(Object.prototype.hasOwnProperty.call(value,'doubleValue'))return Number(value.doubleValue);
  if(Object.prototype.hasOwnProperty.call(value,'timestampValue'))return value.timestampValue;
  if(Object.prototype.hasOwnProperty.call(value,'referenceValue'))return value.referenceValue;
  if(Object.prototype.hasOwnProperty.call(value,'bytesValue'))return value.bytesValue;
  if(value.geoPointValue)return {latitude:Number(value.geoPointValue.latitude),longitude:Number(value.geoPointValue.longitude)};
  if(value.arrayValue)return (value.arrayValue.values||[]).map(fsLoginRestValue);
  if(value.mapValue){
    var mapped={};
    Object.keys(value.mapValue.fields||{}).forEach(function(key){mapped[key]=fsLoginRestValue(value.mapValue.fields[key]);});
    return mapped;
  }
  return null;
}
function fsLoginDecodeRestDocument(documentValue){
  if(!documentValue||!documentValue.fields)return null;
  var data={};
  Object.keys(documentValue.fields).forEach(function(key){data[key]=fsLoginRestValue(documentValue.fields[key]);});
  return data;
}
function fsLoginSnapshot(data,id,source){
  return {exists:!!data,id:id||'',source:source||'unknown',data:function(){return data||{}}};
}
async function fsLoginFetchJson(url,options,timeoutMs){
  options=options||{};
  var controller=typeof AbortController!=='undefined'?new AbortController():null;
  var timer=setTimeout(function(){if(controller)controller.abort();},timeoutMs);
  if(controller)options.signal=controller.signal;
  try{
    var response=await fetch(url,options);
    var text=await response.text(),payload=null;
    try{payload=text?JSON.parse(text):null}catch(parseError){payload=null}
    if(response.status===404)return {status:404,payload:null};
    if(!response.ok){
      var detail=payload&&payload.error&&(payload.error.message||payload.error.status);
      var err=new Error(detail||('Firestore REST request failed with HTTP '+response.status));
      err.httpStatus=response.status;err.restPayload=payload;throw err;
    }
    return {status:response.status,payload:payload};
  }catch(error){
    if(error&&error.name==='AbortError')throw new Error('Secure profile fallback timed out.');
    throw error;
  }finally{clearTimeout(timer);}
}
async function fsLoadProfileViaRest(user,statusCallback){
  if(typeof fetch!=='function')throw new Error('Secure profile fallback is unavailable in this browser.');
  if(statusCallback)statusCallback('Checking profile through secure fallback…');
  var token=await fsLoginTimeout(user.getIdToken(true),10000,'Firebase ID token refresh timed out.');
  var base=fsStateRestBase();
  var headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'};
  var directUrl=base+'/users/'+encodeURIComponent(user.uid)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
  var direct=await fsLoginFetchJson(directUrl,{method:'GET',headers:headers},10000);
  if(direct.status===200&&direct.payload){
    var directData=fsLoginDecodeRestDocument(direct.payload);
    if(directData)return fsLoginSnapshot(directData,user.uid,'rest-document');
  }
  if(!user.email)return fsLoginSnapshot(null,user.uid,'rest-not-found');
  var queryUrl=base+':runQuery?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
  var queryBody={structuredQuery:{from:[{collectionId:'users'}],where:{fieldFilter:{field:{fieldPath:'email'},op:'EQUAL',value:{stringValue:user.email}}},limit:1}};
  var query=await fsLoginFetchJson(queryUrl,{method:'POST',headers:headers,body:JSON.stringify(queryBody)},8000);
  var rows=Array.isArray(query.payload)?query.payload:[];
  var found=rows.find(function(row){return row&&row.document&&row.document.fields;});
  if(!found)return fsLoginSnapshot(null,user.uid,'rest-not-found');
  var data=fsLoginDecodeRestDocument(found.document);
  var id=String(found.document.name||'').split('/').pop()||user.uid;
  return fsLoginSnapshot(data,id,'rest-email-query');
}
async function fsLoadProfileViaSdk(user,statusCallback){
  if(statusCallback)statusCallback('Loading profile from Firestore…');
  try{
    if(FB_DB&&typeof FB_DB.enableNetwork==='function'){
      fsLoginTimeout(FB_DB.enableNetwork(),4000,'Firestore network recovery timed out.').catch(function(error){
        console.warn('Firestore network recovery did not complete.',error);
      });
    }
  }catch(networkError){console.warn('Firestore network recovery was unavailable.',networkError);}
  var ref=FB_DB.collection('users').doc(user.uid),lastError=null;
  try{
    var server=await fsLoginTimeout(ref.get({source:'server'}),10000,'Firestore profile server request timed out.');
    if(server&&server.exists)return server;
    if(server&&!server.exists)return fsLoginSnapshot(null,user.uid,'sdk-server-not-found');
  }catch(error){lastError=error;console.warn('Firestore server profile request failed.',error);}
  try{
    var cached=await fsLoginTimeout(ref.get({source:'cache'}),2500,'Cached profile request timed out.');
    if(cached&&cached.exists)return cached;
  }catch(cacheError){console.warn('Cached profile request was unavailable.',cacheError);}
  throw lastError||new Error('Firestore profile was not available through the SDK.');
}
async function fsLoadAuthenticatedProfile(user,statusCallback){
  var errors=[],remaining=2,completed=false;
  return new Promise(function(resolve,reject){
    function settle(snapshot){
      if(completed)return;
      if(snapshot&&snapshot.exists){completed=true;resolve(snapshot);return;}
      remaining--;
      if(remaining===0){completed=true;resolve(fsLoginSnapshot(null,user.uid,'not-found'));}
    }
    function fail(error){
      if(completed)return;
      errors.push(error);remaining--;
      if(remaining===0){
        completed=true;
        var messages=errors.map(function(item){return item&&item.message||String(item);}).filter(Boolean);
        reject(new Error('Authentication succeeded, but the user profile could not be reached. '+messages.join(' | ')));
      }
    }
    fsLoadProfileViaSdk(user,statusCallback).then(settle,fail);
    fsLoadProfileViaRest(user,statusCallback).then(settle,fail);
  });
}
async function doLogin(){
  var email=el('lgu').value.trim(),password=el('lgp').value;
  var loginBtn=document.querySelector('#auth button[data-asdh-binding],#auth button.btn.bp.bw');
  var oldLoginText=loginBtn?loginBtn.innerHTML:'',credential=null;
  function setLoginError(message){var box=el('aerr');if(box){box.textContent=message;box.style.display='block';}}
  function setLoginStage(message){if(loginBtn)loginBtn.textContent=message;}
  if(loginBtn){loginBtn.disabled=true;setLoginStage('Signing in…');}
  if(el('aerr'))el('aerr').style.display='none';
  if(!email||!password){
    setLoginError('Enter your Firebase email and password');
    if(loginBtn){loginBtn.disabled=false;loginBtn.innerHTML=oldLoginText||'Sign In / دخول';}
    return;
  }
  try{
    await waitForFirebase(15000);
    if(FB_AUTH.setPersistence)await FB_AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    credential=await fsLoginTimeout(FB_AUTH.signInWithEmailAndPassword(email,password),30000,'Firebase sign-in timed out.');
    window.__fsAuthenticatedUser=credential.user;
    setLoginStage('Verifying profile…');
    var profileSnapshot=await fsLoadAuthenticatedProfile(credential.user,setLoginStage);
    if(!profileSnapshot||!profileSnapshot.exists)throw new Error('Your Firebase account has no Floor Stock role profile.');
    var profile=profileSnapshot.data()||{};
    profile.role=normalizeRole(profile.role);
    if(profile.active===false)throw new Error('This account is inactive.');
    if(!isSupportedLoginRole(profile.role))throw new Error('This account has an invalid role.');
    if(profile.role==='department'){
      setLoginStage('Verifying department…');
      await fsHydrateDepartmentDirectoryForLogin(profile);
    }
    var deptId=profile.deptId||profile.departmentId||null;
    var dept=deptId?gd().find(function(d){return String(d.id)===String(deptId)}):null;
    if(profile.role==='department'&&!dept){
      var wanted=fsR5Norm(profile.deptName||profile.departmentName||deptId||'');
      dept=gd().find(function(d){return fsR5Norm(d.name)===wanted;})||null;
      if(dept)deptId=dept.id;
    }
    if(profile.role==='department'&&!dept)throw new Error('Your department assignment is missing.');
    CU={id:credential.user.uid,email:profile.email||credential.user.email,role:profile.role,master:profile.master===true,username:profile.displayName||profile.email||credential.user.email,deptId:deptId,deptName:dept?dept.name:(profile.deptName||profile.departmentName||''),controlledCustodian:!!profile.controlledCustodian,blockedDepts:Array.isArray(profile.blockedDepts)?profile.blockedDepts:[]};
    var stateProfile=Object.assign({},profile,{uid:credential.user.uid,deptId:deptId});
    if(typeof window.startApp!=='function'){
      throw new Error('Application startup is unavailable. Reload the file and try again.');
    }
    // Keep the login screen visible until the authenticated user's state is ready.
    // Opening the shell before this finishes makes valid pages look empty or broken.
    // Safari can leave a Firestore stream pending indefinitely when a network
    // filter or private relay interrupts the request. Never leave the login
    // button stuck in “Loading data…”; fail cleanly and allow a retry.
    await fsLoginTimeout(S.init(setLoginStage,stateProfile),25000,'Loading Floor Stock data timed out. Check the network and retry.');
    // Load blocked-dept custom claims from the Firebase Auth token.
    // The token is cached locally; forceRefresh=false is enough unless
    // the pharmacy director just updated restrictions in this session.
    try{
      var tokenResult=await credential.user.getIdTokenResult(false);
      var claimedBlocked=tokenResult&&tokenResult.claims&&tokenResult.claims.blockedDepts;
      // If token has no claims yet (user hasn't re-logged since CF set them),
      // fall back to the Firestore profile field written by setDeptRestrictions.
      globalThis.__fsBlockedDepts=Array.isArray(claimedBlocked)?claimedBlocked:(Array.isArray(profile.blockedDepts)?profile.blockedDepts:[]);
    }catch(tokenErr){
      globalThis.__fsBlockedDepts=Array.isArray(profile.blockedDepts)?profile.blockedDepts:[];
      console.warn('Could not read dept restriction claims.',tokenErr);
    }
    window.startApp();
    if(window.FSArchitecture)FSArchitecture.emit('app:started',FSArchitecture.session());

setTimeout(function(){
  Promise.resolve().then(async function(){
    if(CU&&(CU.master===true||CU.role==='pharmacy')){
      if(typeof window.repairImportedDepartmentAliases==='function')await window.repairImportedDepartmentAliases();
      if(typeof window.seed==='function')await window.seed();
    }
  }).catch(function(error){
    console.warn('Background startup maintenance was skipped.',error);
  });
},500);
  }catch(err){
    console.error(err);
    var message=(err&&err.message)||'Unable to sign in';
    if(/profile could not be reached|profile.*timed out|Firestore profile/i.test(message)){
      message+=' Open the file in Chrome or Safari with internet access, and verify that firestore.googleapis.com is not blocked by a firewall or content filter.';
    }
    // Append a short stack-trace hint so the recursive frame is visible in the
    // login UI even when the production console override hides native errors.
    if(err&&err.stack&&/call stack/i.test(message)){
      var frames=String(err.stack).split('\n').slice(1,6).join(' ← ').replace(/\s+/g,' ');
      message+=' | stack: '+frames.slice(0,300);
    }
    setLoginError(message);
    window.__fsAuthenticatedUser=null;
    try{if(credential&&FB_AUTH&&FB_AUTH.currentUser)await FB_AUTH.signOut();}catch(signOutError){console.warn('Could not clear the partial authentication session.',signOutError);}
    if(loginBtn){loginBtn.disabled=false;loginBtn.innerHTML=oldLoginText||'Sign In / دخول';}
  }
}
globalThis.logoutBusy = false;
async function doLogout(){
  if(logoutBusy)return;logoutBusy=true;
  var logoutButtons=Array.from(document.querySelectorAll('[onclick*="doLogout"],#logout-btn,.logout-btn'));logoutButtons.forEach(function(button){button.disabled=true});
  function timeout(promise,ms,label){return Promise.race([Promise.resolve(promise),new Promise(function(_,reject){setTimeout(function(){reject(new Error(label||'Operation timed out'))},ms)})])}
  try{
    // Do not persist page drafts while tearing down the authenticated session.
    // The old persistence chain could re-enter itself during Safari pagehide,
    // producing "Maximum call stack size exceeded" and preventing sign-out.
    try{if(typeof window.resetFloorstockSessionFilters==='function')window.resetFloorstockSessionFilters();}
    catch(filterError){console.warn('Session filter reset failed before logout; continuing sign out.',filterError)}
    // Do not await the page-wide save tracker here.  Its draft/pagehide
    // listeners can synchronously re-enter during Safari sign-out and cause
    // "Maximum call stack size exceeded".  Firestore's pending-write barrier
    // below is the single safe persistence checkpoint for logout.
    if(typeof previewClear==='function')previewClear();
    try{if(FB_DB&&typeof FB_DB.waitForPendingWrites==='function'){if(window.CU&&window.CU.master===true)toast('جاري حفظ البيانات...\nSaving data...','info');await timeout(FB_DB.waitForPendingWrites(),7000,'Pending writes timed out')}}catch(err){console.warn('Pending writes failed before logout; continuing sign out.',err)}
    S.stopRealtime();
    if(FB_AUTH&&FB_AUTH.currentUser)await timeout(FB_AUTH.signOut(),8000,'Sign out timed out');
    window.__fsAuthenticatedUser=null;
    var signedOutSession=window.FSArchitecture&&FSArchitecture.session?FSArchitecture.session():null;CU=null;MASTER_ACTUAL=null;MASTER_EFFECTIVE=null;S.cache={};S.ready=false;if(window.FSArchitecture)FSArchitecture.emit('auth:signed-out',signedOutSession);var app=el('app'),auth=el('auth'),pass=el('lgp');if(app)app.style.display='none';if(auth)auth.style.display='flex';if(pass)pass.value='';var loginButton=el('login-btn')||document.querySelector('#auth button[data-asdh-binding],#auth button.btn.bp.bw');if(loginButton){loginButton.disabled=false;loginButton.innerHTML='Sign In / دخول';}
  }catch(err){console.error(err);if(typeof toast==='function')toast('Sign out failed: '+String(err&&err.message||err),'err')}
  finally{logoutBusy=false;logoutButtons.forEach(function(button){button.disabled=false})}
}
function renderPageById(id){
  var renderer={
    'pg-dash':renderDash,'pg-inv':renderInv,'pg-reqs':renderReqs,
    'pg-analytics':renderAn,'pg-users':renderUsers,'pg-newreq':renderReqForm,
    'pg-myreqs':renderMyReqs,'pg-print':renderPrint,'pg-import':renderImport,
    'pg-shelves':renderShelves,'pg-deptprint':renderDeptPrint,
    'pg-notes-dept':renderDeptNotes,'pg-notes-ph':renderPharmNotes,'pg-schedule':renderSchedule,
    'pg-controlled':renderControlled,'pg-ctl-analytics':renderCtlAnalytics,'pg-crashcart':renderCrashCarts,'pg-crash-ops':renderCrashOperations,'pg-med-accountability':renderMedicationAccountability,
    'pg-zebra-labels':function(){if(typeof window.renderZebraPageUi==='function')window.renderZebraPageUi()}
  }[id];
  if(renderer)renderer();
}
function refreshCurrentPage(){
  if(typeof window.floorstockResetInvalidDepartmentSelectors==='function')window.floorstockResetInvalidDepartmentSelectors();
  var active=document.querySelector('.pg.on');
  if(!active)return;
  if(typeof window.floorstockShouldProtectAutoRefresh==='function'&&window.floorstockShouldProtectAutoRefresh(active.id)){
    if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
    return;
  }
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
  if(active.id==='pg-zebra-labels'){
    if(typeof window.renderZebraPageUi==='function')window.renderZebraPageUi();
    if(typeof window.refreshAnnouncementsUi==='function')window.refreshAnnouncementsUi(active.id);
    return;
  }
  populateInvDeptSel();fillDS();
  renderPageById(active.id);
  updateNotesBadge();
  if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();
  window.refreshAnnouncementsUi(active.id);
  if(typeof window.restorePageTransientUi==='function')window.restorePageTransientUi(active.id);
}

function runBaseShowPg(id){
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on')});
  document.querySelectorAll('.nb').forEach(function(b){b.classList.remove('on')});
  var pg=el(id);if(pg)pg.classList.add('on');
  document.querySelectorAll('.nb').forEach(function(b){if(b.getAttribute('data-pg')===id)b.classList.add('on')});
  renderPageById(id);
}

// ── INV DEPT SELECTOR ────────────────────────────────────
function getInvDept(){
  var sel=el('inv-dept-sel');
  return sel?sel.value:'';
}
window.fsOutpatientDeptId=function(){var ds=typeof gd==='function'?(gd()||[]):[],d=ds.find(function(x){return /outpatient\s+department/i.test(String(x.name||x.nameEn||''))||String(x.id||'').toLowerCase()==='outpatient'});return d?String(d.id):''};
function populateInvDeptSel(){
  var sel=el('inv-dept-sel');if(!sel)return;
  var cur=sel.value;
  var ds=typeof window.fsAllowedDepts==='function'?window.fsAllowedDepts():gd();
  sel.innerHTML='<option value="">Select Dept...</option>'+ds.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  if(cur&&ds.some(function(d){return d.id===cur}))sel.value=cur;else sel.value='';
}

// ── DASHBOARD ────────────────────────────────────────────
function renderDash(){
  var allDs=gd(),ds=typeof window.fsRoleScopedDepts==='function'?window.fsRoleScopedDepts(allDs):allDs;
  if(typeof window.fsCanAccessDepartment==='function')ds=ds.filter(function(d){return window.fsCanAccessDepartment(d.id)});
  var allowedDash={};ds.forEach(function(d){allowedDash[String(d.id)]=true});
  var rs=gr().filter(function(r){return !r.deptId||allowedDash[String(r.deptId)]});
  var pend=rs.filter(function(r){return r.status==='pending'});
  var done=rs.filter(function(r){return r.status!=='pending'});
  var totalMeds=ds.reduce(function(s,d){return s+getMeds(d.id).length},0);
  var tot=done.reduce(function(s,r){return s+(r.dispensed||[]).reduce(function(a,i){return a+(i.qty||0)},0)},0);
  // Per-dept med breakdown
  var deptBreakdown=ds.map(function(d){
    var lim=getMonthlyLimit(d.id);
    var used=lim!==null?getMonthlyReqCount(d.id):null;
    return d.name+': '+getMeds(d.id).length+' meds'+(lim!==null?' ('+used+'/'+lim+' req)':'');
  }).join(' &nbsp;|&nbsp; ');
  el('dstats').innerHTML=
    '<div class="sc"><div class="sl">Total Medications</div><div class="sv">'+totalMeds+'</div><div class="ss" style="font-size:10px">'+deptBreakdown+'</div></div>'+
    '<div class="sc"><div class="sl">Departments</div><div class="sv" style="color:var(--acl)">'+ds.length+'</div><div class="ss">Active</div></div>'+
    '<div class="sc"><div class="sl">Pending Requests</div><div class="sv" style="color:var(--yll)">'+pend.length+'</div><div class="ss">Awaiting fulfillment</div></div>'+
    '<div class="sc"><div class="sl">Fulfilled</div><div class="sv" style="color:var(--gnl)">'+done.length+'</div><div class="ss">Total completed</div></div>';
  // Expiry alerts across all depts
  var expAlerts=[];
  var now=new Date();now.setHours(0,0,0,0);
  ds.forEach(function(dept){
    var exp=getExpiry(dept.id);
    var ms=getMeds(dept.id);
    var cfg=getAlertSettings(dept.id);
    (Array.isArray(exp)?exp:[]).forEach(function(batch){
      var medId=batch&&batch.medId;
      var m=ms.find(function(x){return String(x.id)===String(medId)});
      if(!m)return;
      var days=daysUntil((batch&&batch.date)||(batch&&batch.expiry));
      if(days!==null&&days<=cfg.d1){
        expAlerts.push({dept:dept.name,name:m.name,days:days,cfg:cfg});
      }
    });
  });
  var alertHtml='';
  var expired=expAlerts.filter(function(e){return e.days<=0});
  var urgent=expAlerts.filter(function(e){return e.days>0&&e.days<=7});
  var soon=expAlerts.filter(function(e){return e.days>7});
  function groupedExpiry(items,withDays){var groups={};items.forEach(function(e){(groups[e.dept]||(groups[e.dept]=[])).push(e)});return Object.keys(groups).map(function(dept){var names=groups[dept].map(function(e){return e.name+(withDays?' ('+e.days+'d)':'')});return '<span style="display:block;margin-top:3px"><b>'+dept+':</b> '+names.join(', ')+'</span>'}).join('')}
  if(expired.length)alertHtml+='<div class="alert-banner">🚨 <b>'+expired.length+' medications EXPIRED:</b>'+groupedExpiry(expired,false)+'</div>';
  if(urgent.length)alertHtml+='<div class="alert-banner">⚠ <b>'+urgent.length+' expiring within 7 days:</b>'+groupedExpiry(urgent,true)+'</div>';
  if(soon.length)alertHtml+='<div class="alert-banner-y">🔔 <b>'+soon.length+' expiring soon:</b>'+groupedExpiry(soon,true)+'</div>';
  el('exp-alerts').innerHTML=alertHtml;
  el('dptbl').innerHTML=pend.length
    ?pend.slice(0,10).map(function(r){var d=ds.find(function(x){return x.id===r.deptId});return '<tr><td>'+((d&&d.name)||r.deptId)+'</td><td>'+fmtDateTime(r.created)+'</td><td>'+(r.items||[]).length+'</td><td><span class="badge byl">Pending</span></td><td><button class="btn bp bxs" data-request-action="fulfill" data-id="'+r.id+'">Fulfill</button></td></tr>'}).join('')
    :'<tr><td colspan="5" style="text-align:center;color:var(--tx2);padding:20px">No pending requests ✓</td></tr>';
  // Notes alert on dashboard
var openNotes=getNotes().filter(function(n){return (n.status==='open'||n.status==='urgent')&&(!n.deptId||allowedDash[String(n.deptId)]);});
var urgentNotes=getNotes().filter(function(n){return n.status==='urgent'&&(!n.deptId||allowedDash[String(n.deptId)]);});
var notesHtml='';
if(urgentNotes.length)notesHtml+='<div class="alert-banner" style="cursor:pointer" onclick="showPg(&#x27;pg-notes-ph&#x27;)">🚨 <b>'+urgentNotes.length+' urgent note(s)</b> from departments — click to review</div>';
else if(openNotes.length)notesHtml+='<div class="alert-banner-y" style="cursor:pointer" onclick="showPg(&#x27;pg-notes-ph&#x27;)">📝 <b>'+openNotes.length+' open note(s)</b> from departments — click to review</div>';
el('exp-alerts').innerHTML=alertHtml+notesHtml;
el('dact').innerHTML=rs.slice().reverse().slice(0,20).map(function(r){
    var d=ds.find(function(x){return x.id===r.deptId});
    return '<div style="padding:9px 16px;border-bottom:1px solid var(--bd);font-size:12px"><div style="font-weight:500">'+((d&&d.name)||r.deptId)+' &mdash; '+(r.status==='pending'?'<span style="color:var(--yll)">Pending</span>':'<span style="color:var(--gnl)">Fulfilled</span>')+'</div><div style="color:var(--tx2)">'+fmtDateTime(r.created)+' &middot; '+(r.items||[]).length+' items</div></div>';
  }).join('')||'<div style="padding:18px;color:var(--tx2)">No activity yet</div>';

  if(typeof window.renderCrashDashboardSummary==='function')window.renderCrashDashboardSummary();
  if(typeof window.ccxRenderDashboardAlerts==='function')window.ccxRenderDashboardAlerts();
}

// ── INVENTORY (per dept) ──────────────────────────────────
function renderInv(){
  var specialControl=el('inv-special-filter'),zeroDaysControl=el('inv-zero-days');if(specialControl&&!specialControl.dataset.bound){specialControl.dataset.bound='1';specialControl.addEventListener('change',renderInv)}if(zeroDaysControl&&!zeroDaysControl.dataset.bound){zeroDaysControl.dataset.bound='1';zeroDaysControl.addEventListener('input',renderInv)}if(zeroDaysControl)zeroDaysControl.style.display=specialControl&&specialControl.value==='__zero_duration__'?'inline-block':'none';
  populateInvDeptSel();
  // Auto-select first valid dept
  var sel=el('inv-dept-sel');
  if(sel){
    var existIds=gd().map(function(d){return d.id});
    // If current value is for a deleted dept, clear it
    if(sel.value && existIds.indexOf(sel.value)<0) sel.value='';
    if(!sel.value && sel.options.length>1) sel.value=sel.options[1].value;
    if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){sel.value=window.fsOutpatientDeptId();sel.disabled=true}else sel.disabled=false;
  }
  var deptId=getInvDept();
  var ms=deptId?getMeds(deptId):[];
  ms.sort(function(a,b){return Number(a.sortOrder||0)-Number(b.sortOrder||0)});

  var srch=(el('isrch')||{value:''}).value.toLowerCase();
  var catf=(el('icatf')||{value:''}).value;
  var clsf=(el('iclsf')||{value:''}).value;
  var special=(el('inv-special-filter')||{value:''}).value,zeroDays=Math.max(1,Number((el('inv-zero-days')||{}).value)||183);
  var requests=gr().concat(S.g('request_analytics_archive')||[]),nowMs=Date.now(),zeroCutoff=nowMs-zeroDays*24*60*60*1000;
  function wasRequested(med){return requests.some(function(r){return String(r.deptId)===String(deptId)&&(r.items||[]).some(function(i){return String(i.medId)===String(med.id)})})}
  function hasExpiry(med){return (getExpiry(deptId)||[]).some(function(x){return String(x.medId)===String(med.id)&&String(x.date||x.expiry||'')})}
  function lastDispense(med){var dates=requests.filter(function(r){return String(r.deptId)===String(deptId)&&(r.dispensed||[]).some(function(i){return String(i.medId)===String(med.id)&&Number(i.qty)>0})}).map(function(r){return new Date(r.fulfilledAt||r.updatedAt||r.created||0).getTime()}).filter(isFinite);return dates.length?Math.max.apply(Math,dates):0}

  // Populate category filter from both global cats + meds in dept
  var csel=el('icatf');
  if(csel){
    var allCats=getCategories();
    var medCats=ms.map(function(m){return m.category}).filter(function(v,i,a){return a.indexOf(v)===i});
    // Merge
    medCats.forEach(function(c){if(allCats.indexOf(c)<0)allCats.push(c)});
    allCats=sortDeptInventoryCategories(deptId,allCats);
    var cur=csel.value;
    csel.innerHTML='<option value="">All Categories</option>'+allCats.map(function(c){return '<option value="'+esc(c)+'"'+(c===cur?' selected':'')+'>'+esc(c)+'</option>'}).join('');
  }
  // populate bulk cat selector
  var bcs=el('bulk-cat-sel');
  if(bcs){
    var bc=sortDeptInventoryCategories(deptId,getCategories().concat(ms.map(function(m){return m.category}).filter(function(v,i,a){return a.indexOf(v)===i})).filter(function(v,i,a){return a.indexOf(v)===i}));
    bcs.innerHTML='<option value="">Change category to...</option>'+bc.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
  }
  // Drug modal dept sel (filtered to allowed depts)
  var ddsel=el('ddept-sel');
  if(ddsel){var _dds=typeof window.fsAllowedDepts==='function'?window.fsAllowedDepts():gd();ddsel.disabled=true;ddsel.innerHTML=_dds.map(function(d){return '<option value="'+esc(d.id)+'"'+(d.id===deptId?' selected':'')+'>'+esc(d.name)+'</option>'}).join('');}

  if(!deptId){
    var ds=gd();
    el('itbl').innerHTML=!ds.length
      ?'<tr><td colspan="9" style="text-align:center;padding:32px"><div style="font-size:32px;margin-bottom:12px">🏢</div><div style="font-weight:600;color:var(--tx);margin-bottom:8px">No departments yet</div><button class="btn bp" onclick="showPg(&#x27;pg-users&#x27;)">&#x2B; Add Department</button></td></tr>'
      :'<tr><td colspan="9" style="text-align:center;color:var(--tx2);padding:24px">← Select a department</td></tr>';
    el('dup-banner').style.display='none';
    el('bulk-bar').style.display='none';
    if(typeof window.refreshInventoryRetirementUi==='function')window.refreshInventoryRetirementUi();
    if(typeof window.bindInventoryTools==='function')window.bindInventoryTools();
    if(typeof window.refreshCategoryManagementUi==='function')window.refreshCategoryManagementUi();
    if(typeof window.ensureBulkReplacementButton==='function')window.ensureBulkReplacementButton();
    if(typeof window.restoreInventorySelection==='function')window.restoreInventorySelection();
    return;
  }

  var fil=ms.filter(function(m){
    var stock=Number(m.stockQty!=null?m.stockQty:(m.currentStock!=null?m.currentStock:(m.availableQty!=null?m.availableQty:0)));
    var zeroStock=stock<=0;
    var zero6=zeroStock&&(!lastDispense(m)||lastDispense(m)<=zeroCutoff);
    var neverExpiry=hasExpiry(m)&&!wasRequested(m);
    return(!srch||m.name.toLowerCase().indexOf(srch)>-1)&&(!catf||m.category===catf)&&(!clsf||m[clsf])&&(!special||special==='__zero_stock__'&&zeroStock||special==='__zero_duration__'&&zero6||special==='__expiry_never_requested__'&&neverExpiry);
  });

  // Duplicate detection
  var names=ms.map(function(m){return m.name.toLowerCase().trim()});
  var dups=ms.filter(function(m){var n=m.name.toLowerCase().trim();return names.indexOf(n)!==names.lastIndexOf(n)});
  el('dup-banner').style.display=dups.length?'':'none';
  if(dups.length) el('dup-count-txt').innerHTML='⚠ <b>'+dups.length+'</b> possible duplicates';

  var grp={};
  fil.forEach(function(m){if(!grp[m.category])grp[m.category]=[];grp[m.category].push(m)});
  var html='';
  if(!fil.length) html='<tr><td colspan="9" style="text-align:center;color:var(--tx2);padding:22px">No medications found</td></tr>';
  var medNumber=0;
  sortDeptInventoryCategories(deptId,Object.keys(grp)).forEach(function(cat){
    html+='<tr><td colspan="9" class="cath">📁 '+cat+' <span style="color:var(--tx3);font-size:10px">('+grp[cat].length+')</span></td></tr>';
    var items = grp[cat] || [];
    items.sort(function(a,b){return Number(a.sortOrder||0)-Number(b.sortOrder||0)});
    items.forEach(function(m){
      medNumber++;
      html+='<tr class="'+rowCls(m)+'" id="inv-row-'+m.id+'">'
        +'<td style="padding:4px 8px"><input type="checkbox" class="inv-chk" data-id="'+m.id+'" onchange="onInvCheck()"></td>'
        +'<td style="text-align:center;font-family:var(--mono);font-weight:600">'+medNumber+'</td>'
        +'<td style="font-weight:500">'+m.name+'</td>'
        +'<td><span class="chip">'+m.category+'</span></td>'
        +'<td>'+bdg(m)+'</td>'
        +'<td style="text-align:center;font-family:var(--mono)">'+m.min+'</td>'
        +'<td style="text-align:center;font-family:var(--mono)">'+m.max+'</td>'
        +'<td style="text-align:center;font-family:var(--mono)">'+(m.monthly||'&mdash;')+'</td>'
        +'<td style="white-space:nowrap">'
          +'<button class="btn bg bxs" data-id="'+m.id+'" data-dept="'+deptId+'" onclick="moveDrugOrder(this.getAttribute(&#x27;data-id&#x27;),this.getAttribute(&#x27;data-dept&#x27;),-1)">↑</button> <button class="btn bg bxs" data-id="'+m.id+'" data-dept="'+deptId+'" onclick="moveDrugOrder(this.getAttribute(&#x27;data-id&#x27;),this.getAttribute(&#x27;data-dept&#x27;),1)">↓</button> <button class="btn bg bxs" data-id="'+m.id+'" data-dept="'+deptId+'" onclick="openEditDrug(this.getAttribute(&#x27;data-id&#x27;),this.getAttribute(&#x27;data-dept&#x27;))">Edit</button> '
          +'<button class="btn bd2c bxs" data-id="'+m.id+'" data-dept="'+deptId+'" onclick="delDrug(this.getAttribute(&#x27;data-id&#x27;),this.getAttribute(&#x27;data-dept&#x27;))">Del</button>'
        +'</td></tr>';
    });
  });
  el('itbl').innerHTML=html;
  // Reset select-all checkbox
  var allChk=el('inv-all-chk');if(allChk)allChk.checked=false;
  el('bulk-bar').style.display='none';
  if(typeof window.refreshInventoryRetirementUi==='function')window.refreshInventoryRetirementUi();
  if(typeof window.bindInventoryTools==='function')window.bindInventoryTools();
  if(typeof window.refreshCategoryManagementUi==='function')window.refreshCategoryManagementUi();
  if(typeof window.ensureBulkReplacementButton==='function')window.ensureBulkReplacementButton();
  if(typeof window.restoreInventorySelection==='function')window.restoreInventorySelection();

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
}

function openAddDrug(){
  EDID=null;window.EDDEPT=null;
  el('dmtitle').textContent='Add Medication';
  el('dname').value='';el('dcat').innerHTML=getCatOptions('Injections');
  el('dmin').value='1';el('dmax').value='10';el('dmly').value='';
  el('cha2').checked=false;el('chaz').checked=false;el('chls').checked=false;if(el('chcool'))el('chcool').checked=false;
  var ddsel=el('ddept-sel');
  if(ddsel){var _ads=typeof window.fsAllowedDepts==='function'?window.fsAllowedDepts():gd();ddsel.disabled=false;ddsel.innerHTML=_ads.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');}
  OM('mdrug');
}
function openEditDrug(id,deptId){
  var m=getMeds(deptId).find(function(x){return x.id===id});if(!m)return;
  EDID=id;window.EDDEPT=deptId;
  el('dmtitle').textContent='Edit Medication';
  el('dname').value=m.name;el('dcat').innerHTML=getCatOptions(m.category);
  el('dmin').value=m.min;el('dmax').value=m.max;el('dmly').value=m.monthly||'';
  el('cha2').checked=!!m.high_alert;el('chaz').checked=!!m.hazard;el('chls').checked=!!m.lasa;if(el('chcool'))el('chcool').checked=!!m.refrigerated;
  var ddsel=el('ddept-sel');
  if(ddsel){var _eds=typeof window.fsAllowedDepts==='function'?window.fsAllowedDepts():gd();ddsel.innerHTML=_eds.map(function(d){return '<option value="'+esc(d.id)+'"'+(d.id===deptId?' selected':'')+'>'+esc(d.name)+'</option>'}).join('');}
  OM('mdrug');
}
async function delDrug(id,deptId){
  if(!await uiConfirm('Delete this medication?'))return;
  try{
    await delMed(deptId,id);
    renderInv();
    toast('Deleted and saved ✓','succ');
  }catch(err){
    console.error(err);
    toast('Delete was not saved. Please retry.','err');
  }
}
// Duplicate panel
function showDupPanel(){
  var deptId=getInvDept();if(!deptId)return;
  var ms=getMeds(deptId);
  // Group by lowercase trimmed name
  var nameMap={};
  ms.forEach(function(m){var k=m.name.toLowerCase().trim();if(!nameMap[k])nameMap[k]=[];nameMap[k].push(m)});
  var groups=Object.values(nameMap).filter(function(g){return g.length>1});
  var html='';
  groups.forEach(function(group){
    html+='<tr style="background:var(--s3)"><td colspan="4" style="font-weight:600;font-size:11px;color:var(--tx2);padding:6px 12px">Group: '+group[0].name+'</td></tr>';
    group.forEach(function(m){
      html+='<tr><td><input type="checkbox" class="dup-chk" data-id="'+m.id+'" data-dept="'+deptId+'"></td>'
        +'<td>'+m.name+'</td><td><span class="chip">'+m.category+'</span></td><td>'+bdg(m)+'</td></tr>';
    });
  });
  el('duptbl').innerHTML=html||'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx2)">No duplicates found</td></tr>';
  el('dup-all-chk').checked=false;
  OM('mdup');
}
function toggleDupAll(chk){document.querySelectorAll('.dup-chk').forEach(function(c){c.checked=chk.checked})}
async function deleteSelected(){
  var selected=Array.from(document.querySelectorAll('.dup-chk:checked'));
  if(!selected.length)return toast('Select at least one','err');
  if(!await uiConfirm('Delete '+selected.length+' selected medications?'))return;
  var deptId=selected[0].dataset.dept;
  var ids=new Set(selected.map(function(chk){return chk.dataset.id}));
  try{
    await setMeds(deptId,getMeds(deptId).filter(function(m){return !ids.has(m.id)}));
    toast('Deleted '+selected.length+' medications and saved ✓','succ');
    CM('mdup');renderInv();
  }catch(err){
    console.error(err);
    toast('Delete was not saved. Please retry.','err');
  }
}


publishLegacy("03f-app-shell-nav-dashboard-inventory.js", {
  getAppUrl,
  getPublicExpiryUrl,
  getMobileRequestUrl,
  toggleTheme,
  applyTheme,
  autoDetectCat,
  selRole,
  fillDS,
  fsLoginRestValue,
  fsLoginDecodeRestDocument,
  fsLoginSnapshot,
  fsLoginFetchJson,
  fsLoadProfileViaRest,
  fsLoadProfileViaSdk,
  fsLoadAuthenticatedProfile,
  doLogin,
  doLogout,
  renderPageById,
  refreshCurrentPage,
  runBaseShowPg,
  getInvDept,
  populateInvDeptSel,
  renderDash,
  renderInv,
  openAddDrug,
  openEditDrug,
  delDrug,
  showDupPanel,
  toggleDupAll,
  deleteSelected,
});

export {};

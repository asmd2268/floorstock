import { publishLegacy } from '../core/legacy-registry.js?v=003344116e';

import { normalizeRole, hasCapability, canAccessDepartment } from '../core/role-capabilities.js?v=e9e9d8dd77';
import { isSupportedLoginRole } from '../core/auth-role-policy.js?v=f923470ab5';
import {
  FULFILLMENT_EDIT_SETTINGS_KEY,
  canEditFulfillment,
  fulfillmentEditReason,
} from '../core/fulfillment-edit-policy.js?v=8342cad0ce';
import { loadScriptOnce } from '../core/script-loader.js?v=f15babaf45';
import { debounce } from '../core/timing.js?v=6b9368dd75';
import { ensurePDFJS, ensureZXing } from '../core/media-loaders.js?v=f014fcad89';
import { stateValueEqual, fsStateRestEncode } from '../core/firestore-value-codec.js?v=9da1524dc8';
import { withTimeout } from '../core/promise-timeout.js?v=a17eca6e66';
import { fsStateRestBase, fsRestPath } from '../core/firestore-rest-paths.js?v=7975fe045f';
import { tenantIdFromProfile, stateCollectionPath, collectionBackedPath } from '../core/firestore-scope.js?v=eec5742551';
import { stateCollectionRef, collectionRefForSpec } from '../core/firestore-sdk-scope.js?v=7a75e3ae82';
import { registerStateTransport, setState as portSetState, removeState as portRemoveState, loadState as portLoadState, onTransportFallback, resetWriteTransport, writeTransportName } from '../core/state-transport.js?v=4510baaaca';
import { COLLECTION_BACKED_KEYS, collectionBackedKeyNames, normalizeCollectionRow, sortCollectionRows } from '../core/collection-backed-keys.js?v=9ed94061f1';
import { FIREBASE_CONFIG, isFirebaseEmulatorEnabled } from '../core/firebase-config.js?v=c13c38051a';

// ── FIREBASE / FIRESTORE ─────────────────────────────────
// Firebase configuration is provided by the early Core firebase-config module.
globalThis.FB_APP = window.FB_APP||null;
globalThis.FB_AUTH = window.FB_AUTH||null;
globalThis.FB_DB = window.FB_DB||null;
globalThis.FB_FUNCTIONS = window.FB_FUNCTIONS||null;
globalThis.FB_APPCHECK = window.FB_APPCHECK||null;
// Keep an already-initialized Firebase session intact. Replacing these handles
// during a module reload races Safari's auth restoration and makes protected
// operations look anonymous ("Sign in first").
window.FB_APP=FB_APP;
window.FB_AUTH=FB_AUTH;
window.FB_DB=FB_DB;
window.FB_FUNCTIONS=FB_FUNCTIONS;
window.FB_APPCHECK=FB_APPCHECK;
globalThis._lazyScripts = {};
function ensureFirebaseFunctions(){
  if(FB_FUNCTIONS&&typeof FB_FUNCTIONS.httpsCallable==='function'){
    window.FB_FUNCTIONS=FB_FUNCTIONS;
    return Promise.resolve(FB_FUNCTIONS);
  }
  if(window.FB_FUNCTIONS&&typeof window.FB_FUNCTIONS.httpsCallable==='function'){
    FB_FUNCTIONS=window.FB_FUNCTIONS;
    return Promise.resolve(FB_FUNCTIONS);
  }
  return loadScriptOnce(
    'Firebase Functions',
    'https://www.gstatic.com/firebasejs/12.15.0/firebase-functions-compat.js',
    function(){return !!(window.firebase&&typeof firebase.functions==='function')}
  ).then(function(){
    if(!window.firebase||typeof firebase.functions!=='function'){
      throw new Error('Firebase Functions SDK failed to initialize.');
    }
    FB_FUNCTIONS=firebase.functions();
    window.FB_FUNCTIONS=FB_FUNCTIONS;
    return FB_FUNCTIONS;
  });
}
// Callable Functions must use the same, still-authenticated Firebase session
// as Firestore. Safari can retain the app shell while its auth token has
// expired; in that state callable requests arrive without request.auth and
// are reported as “Sign in first”. Refresh the token before every callable
// operation instead of relying on a stale compat client context.
async function ensureCallableAuth(){
  await waitForFirebase(5000);
  // Always read the live auth handle. Some module loads capture the handle
  // before initFirebase publishes it, which made valid sessions appear signed
  // out when a callable was invoked from the Users page.
  var auth=window.FB_AUTH||FB_AUTH;
  if(!auth)throw new Error('Firebase authentication is unavailable. Reload and try again.');
  var current=auth.currentUser;
  if(!current&&typeof auth.onAuthStateChanged==='function'){
    current=await new Promise(function(resolve){
      var settled=false,timer=setTimeout(function(){if(!settled){settled=true;resolve(null)}},8000);
      var unsub=auth.onAuthStateChanged(function(user){if(!settled){settled=true;clearTimeout(timer);if(unsub)unsub();resolve(user)}});
    });
  }
  // WebKit can briefly expose a null `auth.currentUser` after the profile has
  // loaded.  Reuse only the exact credential that completed this active Floor
  // Stock login; it is cleared during logout and is never used for another CU.
  var remembered=window.__fsAuthenticatedUser;
  // Legacy profiles can have an id unrelated to their Firebase Auth UID.
  // The authenticated email is a stable identity for the active profile, so
  // accept it as a narrowly-scoped fallback until the callable migrates the
  // profile to /users/{uid}.
  var rememberedMatchesCurrentProfile=remembered&&window.CU&&(
    String(remembered.uid||'')===String(CU.id||'') ||
    (String(remembered.email||'').trim().toLowerCase()!==''&&String(remembered.email||'').trim().toLowerCase()===String(CU.email||'').trim().toLowerCase())
  );
  if(!current&&rememberedMatchesCurrentProfile)current=remembered;
  if(!current)throw new Error('Sign in first.');
  await fsLoginTimeout(current.getIdToken(true),10000,'Firebase authentication refresh timed out.');
  return current;
}
window.ensureCallableAuth=ensureCallableAuth;
// Use the callable HTTP protocol with the freshly-issued ID token.  The
// compat Functions client occasionally lost its auth context in Safari and
// reported "Sign in first" despite a valid visible session.  Keeping this
// transport here gives every user-management action one authenticated path.
function fsCallableUrl(name){
  if(isFirebaseEmulatorEnabled())return 'http://127.0.0.1:5001/demo-floorstock-emulator/us-central1/'+encodeURIComponent(name);
  return 'https://us-central1-'+encodeURIComponent(FIREBASE_CONFIG.projectId)+'.cloudfunctions.net/'+encodeURIComponent(name);
}
async function fsCallFunction(name,data){
  var user=await ensureCallableAuth();
  // Use the SDK callable transport whenever the live Auth session is present.
  // It attaches the active Firebase credential using the exact callable
  // protocol.  The former hand-built request intermittently reached the
  // server without request.auth in Safari/Chrome and was rejected as
  // “Sign in first” despite a completed login.
  var liveAuth=window.FB_AUTH||FB_AUTH;
  if(liveAuth&&liveAuth.currentUser&&String(liveAuth.currentUser.uid||'')===String(user.uid||'')){
    try{
      var functions=await ensureFirebaseFunctions();
      var callable=functions.httpsCallable(name);
      var sdkResult=await fsLoginTimeout(callable(data||{}),12000,'User service timed out.');
      return sdkResult&&Object.prototype.hasOwnProperty.call(sdkResult,'data')?sdkResult.data:sdkResult;
    }catch(sdkError){
      var code=String(sdkError&&sdkError.code||'').toLowerCase();
      // Only recover from authentication/transport failures.  Retrying an
      // application error could repeat a successful write such as user create.
      if(code.indexOf('unauthenticated')<0&&code.indexOf('network')<0)throw sdkError;
      console.warn('Firebase callable SDK transport was unavailable; using the authenticated recovery transport.',sdkError);
    }
  }
  var token=await fsLoginTimeout(user.getIdToken(true),10000,'Firebase authentication refresh timed out.');
  var appCheckToken=await fsStateAppCheckToken();
  var callHeaders={'Content-Type':'application/json','Authorization':'Bearer '+token};
  if(appCheckToken)callHeaders['X-Firebase-AppCheck']=appCheckToken;
  var response=await fsLoginTimeout(fetch(fsCallableUrl(name),{
    method:'POST',
    headers:callHeaders,
    body:JSON.stringify({data:data||{}})
  }),12000,'User service timed out.');
  var payload=null;
  try{payload=await response.json()}catch(ignoreJson){}
  if(!response.ok||payload&&payload.error){
    var issue=payload&&payload.error||{};
    throw new Error(issue.message||('User service failed ('+response.status+').'));
  }
  return payload&&Object.prototype.hasOwnProperty.call(payload,'result')?payload.result:payload;
}
window.fsCallFunction=fsCallFunction;
globalThis.renderInvDebounced = globalThis.debounce(function(){renderInv()},220);
function hasPendingRequestDraft(){
  return Array.from(document.querySelectorAll('#rfbody input, #rfbody textarea, #rfbody select')).some(function(field){
    if(field.disabled||field.type==='checkbox'||field.type==='radio')return false;
    return String(field.value||'').trim()!=='';
  });
}
globalThis.renderReqFormDebounced = globalThis.debounce(function(){
  if(hasPendingRequestDraft())return;
  renderReqForm();
},220);
globalThis.renderControlledDebounced = globalThis.debounce(function(){renderControlled()},220);
globalThis._firebasePersistenceAttempted = false;
globalThis._firebaseReadyPromise = null;
function initFirebase(){
  if(!window.firebase)throw new Error('Firebase SDK failed to load. Check the internet connection and reload.');
  FB_APP=firebase.apps.length?firebase.app():firebase.initializeApp(FIREBASE_CONFIG);
if(firebase.appCheck&&typeof firebase.appCheck==='function'){
  try{
    FB_APPCHECK=firebase.appCheck();
    FB_APPCHECK.activate(
      new firebase.appCheck.ReCaptchaEnterpriseProvider('6LfYImotAAAAACo50nBNoL7EIb14ipF9NQYzrJfr'),
      true
    );
    window.FB_APPCHECK=FB_APPCHECK;
    console.info('Firebase App Check activated.');
  }catch(appCheckError){
    console.warn('Firebase App Check unavailable:',appCheckError);
  }
}
  FB_AUTH=firebase.auth();
  FB_DB=firebase.firestore();
  if(isFirebaseEmulatorEnabled()){
    FB_AUTH.useEmulator('http://127.0.0.1:9099');
    FB_DB.useEmulator('127.0.0.1',8080);
    console.info('Firebase Emulator mode enabled.');
  }
  try{
    if(FB_DB&&typeof FB_DB.settings==='function'){
      // merge:true — otherwise this silently replaces the useEmulator() host
      // settings above and reconnects to production Firestore instead of the
      // emulator (confirmed live: the SDK's own console warning says as much,
      // "You are overriding the original host").  Harmless in production,
      // where isFirebaseEmulatorEnabled() is false and useEmulator() never runs.
      FB_DB.settings({
        experimentalAutoDetectLongPolling:true,
        useFetchStreams:false,
        ignoreUndefinedProperties:true,
        merge:true
      });
    }
  }catch(settingsError){
    console.warn('Firestore transport settings could not be applied.',settingsError);
  }
  window.FB_APP=FB_APP;
  window.FB_AUTH=FB_AUTH;
  window.FB_DB=FB_DB;
  // Keep the live Firebase identity in sync with restored browser sessions.
  // Previously this value was assigned only immediately after a password
  // login, so Safari could render an already-loaded profile while callable
  // Functions saw no authenticated user and returned "Sign in first".
  if(!FB_AUTH.__floorstockSessionObserver&&typeof FB_AUTH.onAuthStateChanged==='function'){
    FB_AUTH.__floorstockSessionObserver=true;
    FB_AUTH.onAuthStateChanged(function(user){
      window.__fsAuthenticatedUser=user||null;
    });
  }
  if(!_firebasePersistenceAttempted&&FB_DB&&typeof FB_DB.enablePersistence==='function'){
    _firebasePersistenceAttempted=true;
    var isMobile=/iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent);
    FB_DB.enablePersistence({synchronizeTabs:!isMobile}).catch(function(err){
      var code=err&&err.code||'unknown';
      if(code==='failed-precondition')
        FB_DB.enablePersistence({synchronizeTabs:false}).catch(function(){});
      else if(code!=='unimplemented')
        console.warn('Firestore offline cache could not be enabled. Online operation continues normally.',err);
    });
  }
  FB_FUNCTIONS=null;
  return {app:FB_APP,auth:FB_AUTH,db:FB_DB};
}
function waitForFirebase(timeoutMs){
  timeoutMs=Number(timeoutMs)||12000;
  if(FB_DB&&FB_AUTH)return Promise.resolve({app:FB_APP,auth:FB_AUTH,db:FB_DB});
  if(_firebaseReadyPromise)return _firebaseReadyPromise;
  _firebaseReadyPromise=new Promise(function(resolve,reject){
    var started=Date.now();
    (function check(){
      try{
        if(!FB_DB||!FB_AUTH)initFirebase();
        if(FB_DB&&FB_AUTH){resolve({app:FB_APP,auth:FB_AUTH,db:FB_DB});return}
      }catch(err){
        if(Date.now()-started>=timeoutMs){_firebaseReadyPromise=null;reject(err);return}
      }
      if(Date.now()-started>=timeoutMs){_firebaseReadyPromise=null;reject(new Error('Firebase initialization timed out.'));return}
      setTimeout(check,50);
    })();
  }).finally(function(){_firebaseReadyPromise=null});
  return _firebaseReadyPromise;
}
window.waitForFirebase=waitForFirebase;

// Firestore is the only operational data store. Memory is a short-lived UI cache, never persistent storage.
globalThis._pendingWrites = 0;
globalThis._trackedSaves = new Set();
globalThis._lastSaveFailure = null;
function _trackSave(promise,label){
  var p=(promise&&typeof promise.then==='function')?promise:Promise.resolve(promise);
  _pendingWrites++;_trackedSaves.add(p);
  p.catch(function(err){_lastSaveFailure={label:label||'save',error:err,at:new Date().toISOString()};console.error('Persistent save failed:',label,err)});
  p.finally(function(){_pendingWrites=Math.max(0,_pendingWrites-1);_trackedSaves.delete(p)}).catch(function(){});
  return p;
}
window.asdhWaitForAllSaves=async function(timeoutMs){
  timeoutMs=Number(timeoutMs)||20000;var started=Date.now();
  while(_trackedSaves.size){
    await Promise.allSettled(Array.from(_trackedSaves));
    if(Date.now()-started>timeoutMs)throw new Error('Timed out while waiting for database saves.');
  }
  if(_lastSaveFailure){var f=_lastSaveFailure;_lastSaveFailure=null;throw (f.error||new Error('A database save failed: '+f.label))}
  return true;
};
async function fsStateToken(forceRefresh){
  if(!FB_AUTH||!FB_AUTH.currentUser)throw new Error('The authenticated Firebase session is unavailable.');
  return fsLoginTimeout(
    FB_AUTH.currentUser.getIdToken(!!forceRefresh),
    10000,
    'Firebase data-access token timed out.'
  );
}
globalThis.fsTenantId = tenantIdFromProfile;
function fsStateCollectionPath(profile){return stateCollectionPath(profile||(globalThis.S&&S.scopeProfile))}
function fsStateSdkCollection(profile){return stateCollectionRef(FB_DB,profile||(globalThis.S&&S.scopeProfile))}
window.fsTenantId=function(){var profileId=tenantIdFromProfile(window.CU||(globalThis.S&&S.scopeProfile));if(profileId)return profileId;try{return String(new URLSearchParams(location.search).get('tenant')||'').trim()}catch(e){return ''}};
window.fsTenantCollection=function(name){var tenantId=window.fsTenantId();return tenantId?FB_DB.collection('tenants').doc(tenantId).collection(name):FB_DB.collection(name)};
// Raw REST calls (used by every scoped/department role that cannot use the
// Firestore SDK's .list()/.onSnapshot()) never went through the Firestore
// SDK, so App Check's automatic token attachment never applied to them —
// only Authorization was ever set here. Confirmed live in the Firebase
// Console: Cloud Firestore App Check showed 84% "Unverified requests"
// before this fix, which is exactly the REST-path traffic this function
// serves. Fails open (no header) if App Check isn't active, matching the
// existing defensive activate() pattern in initFirebase — a request
// without this header is unaffected as long as Firestore stays in
// "Monitor" mode; it only starts mattering once Enforce is turned on.
async function fsStateAppCheckToken(){
  var appCheck=globalThis.FB_APPCHECK;
  if(!appCheck||typeof appCheck.getToken!=='function')return null;
  // One retry on failure: a transient reCAPTCHA Enterprise network hiccup
  // (slow hospital wifi, brief connectivity blip) shouldn't permanently mark
  // every REST call for the rest of the session as unverified when a second
  // attempt a moment later would likely succeed. Still fails open — a
  // second failure just returns null like before, never blocks the write.
  for(var attempt=0;attempt<2;attempt++){
    try{
      var result=await appCheck.getToken(false);
      var token=result&&result.token||null;
      if(token)return token;
    }catch(appCheckTokenError){
      if(attempt===1)console.warn('Firebase App Check token unavailable for REST request.',appCheckTokenError);
    }
    if(attempt===0)await new Promise(function(resolve){setTimeout(resolve,300)});
  }
  return null;
}
async function fsStateRestRequest(url,options,timeoutMs){
  var token=await fsStateToken(false);
  var appCheckToken=await fsStateAppCheckToken();
  options=options||{};
  options.headers=Object.assign({},options.headers||{},{
    'Authorization':'Bearer '+token,
    'Content-Type':'application/json'
  });
  if(appCheckToken)options.headers['X-Firebase-AppCheck']=appCheckToken;
  return fsLoginFetchJson(url,options,timeoutMs||12000);
}
async function fsStateRestListCollection(collectionId){
  var documents=[],pageToken='',guard=0;
  do{
    var url=fsStateRestBase()+'/'+fsRestPath(collectionId)+'?pageSize=300&key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    if(pageToken)url+='&pageToken='+encodeURIComponent(pageToken);
    var response=await fsStateRestRequest(url,{method:'GET'},12000);
    var payload=response.payload||{};
    if(Array.isArray(payload.documents))documents=documents.concat(payload.documents);
    pageToken=payload.nextPageToken||'';
    guard++;
    if(guard>20)throw new Error('Firestore REST pagination exceeded the safety limit.');
  }while(pageToken);
  return documents;
}
async function fsStateLoadFloorstockViaRest(){
  var documents=await fsStateRestListCollection(fsStateCollectionPath()),cache={};
  documents.forEach(function(documentValue){
    var data=fsLoginDecodeRestDocument(documentValue)||{};
    var id=String(documentValue.name||'').split('/').pop();
    if(id&&id!=='users')cache[id]=data.value;
  });
  return {cache:cache,source:'rest'};
}
// Every key in COLLECTION_BACKED_KEYS is intentionally omitted from the lists
// below: scoped roles read those from their own collection (one document per
// row, no 1 MiB ceiling) via fsStateLoadCollectionViaRest rather than from a
// legacy state document — see fsStateLoadFloorstockForProfileViaRest. The SDK
// realtime path reads the same collections through
// fsStateInstallCollectionListeners.
globalThis.DEPARTMENT_SHARED_STATE_KEYS = Object.freeze([
  'departments','deleted_departments','custom_categories','daily_limits_v2',
  'weekly_limits_v2','monthly_limits','rate_limits_v2','req_windows','disp_slots',
  'request_count_limits_v1','request_hour_grids_v1','requests','dept_notes','notes',
  'fulfillment_edit_settings_v1',
  'crash_carts',
  'theme','facility_logo','pharmacy_category_config','pharmacy_department_announcements',
  'pharmacy_department_expiry_rules','medication_freeze_rules_v3','medication_visibility_rules_v3',
  'controlled_catalog','user_activity_daily_v1','classification_lists_v1','page_visibility_overrides_v1','classification_colors_v1',
  // user_dept_restrictions_v1 is deliberately absent: canReadDepartmentState in
  // firestore.rules does not grant it to departments, so fetching it only
  // produced a permission-denied on every department session. canAccessDepartment
  // already falls back to __fsBlockedDepts from the login token, which is what has
  // actually been in use all along, so nothing changes but the failed request.
  // Department's own Medication Accountability tab (custody balances, usage
  // history, receipt/handover records) reads these three keys directly —
  // they were readable per firestore.rules but never fetched into a
  // department account's scoped state, so the page always showed zero
  // assigned medicines regardless of pharmacy-created custody records.
  'accountability_assignments_v2','accountability_receipts_v2',
  // Treatment plans and plan usage visible to dept users (read-only).
  'accountability_regimens_v3','accountability_plan_usage_v1','accountability_expiry_batches_v1',
  'accountability_regimen_catalog_v1','department_print_names_v1'
]);
// These roles are deliberately restricted by Firestore Rules to individual
// document reads.  They must never fall back to collection.list()/onSnapshot(),
// otherwise their permitted state appears empty even though each document is
// readable. Keep this list aligned with canReadPharmacyState() in firestore.rules.
globalThis.PHARMACY_SCOPED_STATE_KEYS = Object.freeze([
  'departments','deleted_departments','custom_categories','requests','dept_notes','notes',
  /* Written when a supervisor deletes an order. They were absent here, so the
     session held neither — and the writer saves the whole array it read, which
     for an unloaded key is an array of one. A supervisor's deletion therefore
     replaced the entire deletion audit and every pending department notice with
     its own single row. Loading them is what makes that save a merge again, and
     what lets the month-partition routing see whether the legacy document is
     still the live record. */
  'deleted_request_audit_v4','department_request_notifications_v1',
  'crash_carts','accountability_assignments_v2',
  'accountability_receipts_v2','accountability_regimens_v3','accountability_plan_usage_v1',
  'accountability_expiry_batches_v1','accountability_regimen_catalog_v1','department_print_names_v1',
  'theme','facility_logo','pharmacy_category_config',
  'pharmacy_department_announcements','pharmacy_department_expiry_rules',
  'medication_freeze_rules_v3','medication_visibility_rules_v3','fulfillment_edit_settings_v1',
  'req_windows','disp_slots','daily_limits_v2','weekly_limits_v2','monthly_limits',
  'rate_limits_v2','request_count_limits_v1','request_hour_grids_v1','user_activity_daily_v1',
  'crash_cart_min_seal_length','classification_lists_v1','page_visibility_overrides_v1','user_dept_restrictions_v1','classification_colors_v1'
]);
function fsIsPharmacyScopedProfile(profile){
  return !!profile&&['inpatient_supervisor','inpatient_pharmacy_supervisor','inpatient pharmacy supervisor','pharmacy_staff'].includes(String(profile.role||''));
}
function fsStateKeysForProfile(profile){
  if(!profile)return null;
  if(profile.master===true)return null;
  if(fsIsPharmacyScopedProfile(profile))return PHARMACY_SCOPED_STATE_KEYS.concat(fsRecentLedgerKeys(LEDGER_MONTHS_IN_SESSION));
  /* The audit months and the Hijri ledger months are appended at read time so the
     lists follow the calendar instead of being frozen at deploy. A scoped role
     cannot LIST the collection, so it has to name every document it reads; older
     ledger months are fetched on demand by the export picker rather than being
     loaded into every session. */
  if(String(profile.role||'')==='controlled_pharmacy')return CONTROLLED_PHARMACY_BASE_KEYS.concat(fsRecentAuditLogKeys(1),fsRecentLedgerKeys(LEDGER_MONTHS_IN_SESSION));
  if(String(profile.role||'')==='warehouse')return WAREHOUSE_STATE_KEYS.concat(fsRecentAuditLogKeys(1),fsRecentLedgerKeys(LEDGER_MONTHS_IN_SESSION));
  if(!['department','outpatient_pharmacy_supervisor'].includes(String(profile.role||'')))return null;
  var keys=DEPARTMENT_SHARED_STATE_KEYS.concat(fsRecentLedgerKeys(LEDGER_MONTHS_IN_SESSION)),deptId=String(profile.deptId||profile.departmentId||'').trim();
  if(deptId){
    ['meds_','expiry_','shelves_','alerts_','inventory_integrity_','inventory_snapshot_index_'].forEach(function(prefix){keys.push(prefix+deptId)});
    // Every department may view its own controlled-custody list.  Editing and
    // the shelf configuration remain restricted to the controlled custodian.
    // controlled_settings_ (head nurse / controlled-medicines officer /
    // pharmacy manager print signatures) is readable by every department —
    // not just the custodian — because every department's own "My controlled
    // list" print depends on it; gating it to controlledCustodian left those
    // signature lines blank for any department account without that flag.
    keys.push('controlled_dept_list_'+deptId,'controlled_settings_'+deptId);
    if(profile.controlledCustodian===true){
      keys.push('controlled_dept_shelves_'+deptId);
    }
  }
  return keys;
}
async function fsStateLoadDocumentViaRest(key){
  var url=fsStateRestBase()+'/'+fsRestPath(fsStateCollectionPath()+'/'+key)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
  var response=await fsStateRestRequest(url,{method:'GET'},10000);
  if(response.status===404||!response.payload)return null;
  var data=fsLoginDecodeRestDocument(response.payload)||{};
  return data.value;
}
async function fsStateLoadDocumentViaSdk(key){
  var snapshot=await fsLoginTimeout(
    fsStateSdkCollection().doc(key).get({source:'server'}),
    7000,
    'Firestore SDK state document timed out.'
  );
  return snapshot&&snapshot.exists?snapshot.data().value:null;
}
function fsStateScopeCacheForProfile(cache,profile){
  if(!profile||!['department','outpatient_pharmacy_supervisor'].includes(String(profile.role||'')))return cache;
  var deptId=String(profile.deptId||profile.departmentId||'').trim();
  if(!deptId)return cache;
  function scopeNorm(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
  var departments=Array.isArray(cache.departments)?cache.departments:[],dept=departments.find(function(item){return String(item&&item.id||'')===deptId})||{};
  var candidates=[deptId,profile.deptName,profile.departmentName,profile.department,profile.deptCode,profile.departmentCode,dept.id,dept.name,dept.code,dept.codeName];
  try{if(typeof window.fsR5DepartmentCandidates==='function')candidates=candidates.concat(window.fsR5DepartmentCandidates(deptId,profile.deptName||profile.departmentName||dept.name)||[])}catch(ignoreAliases){}
  var seed=candidates.map(scopeNorm).join(' ');
  if(/(^| )nicu( |$)|neonatal|حديثي الولادة|المواليد/.test(seed))candidates=candidates.concat(['NICU','Neonatal Intensive Care Unit','Neonatal ICU','Newborn Intensive Care Unit','العناية المركزة لحديثي الولادة','العناية المركزة للمواليد']);
  var allowed=new Set(candidates.map(scopeNorm).filter(Boolean));
  function belongs(row){return [row&&row.deptId,row&&row.departmentId,row&&row.deptName,row&&row.departmentName,row&&row.department,row&&row.deptCode,row&&row.departmentCode,row&&row.unit].some(function(value){return allowed.has(scopeNorm(value))})}
  var carts=Array.isArray(cache.crash_carts)?cache.crash_carts:[];
  var ownCarts=carts.filter(belongs).map(function(cart){return Object.assign({},cart,{deptId:deptId,deptName:cart.deptName||dept.name||profile.deptName||''})});
  var ownCartIds=new Set(ownCarts.map(function(cart){return String(cart&&cart.id||'')}));
  cache.crash_carts=ownCarts;
  if(Array.isArray(cache.crash_cart_reports)){
    cache.crash_cart_reports=cache.crash_cart_reports.filter(function(report){return belongs(report)||ownCartIds.has(String(report&&report.cartId||''))}).map(function(report){return Object.assign({},report,{deptId:deptId})});
  }
  return cache;
}
window.fsStateScopeCacheForProfile=fsStateScopeCacheForProfile;
// Enough rounds for a value spread over dozens of documents; each round is one
// batch of reads and stops as soon as a probe comes back empty.
var OVERFLOW_PROBE_ROUNDS=8;
async function fsStateLoadScoped(keys,loader,source,profile){
  // A scoped session may legitimately be denied one optional document. Do not
  // discard every permitted document (especially crash_carts) because of it.
  var results=await Promise.allSettled(keys.map(function(key){return loader(key)})),cache={},failedKeys=[];
  results.forEach(function(result,index){
    if(result.status==='fulfilled'&&result.value!==null&&result.value!==undefined)cache[keys[index]]=result.value;
    else if(result.status==='rejected'){
      failedKeys.push(keys[index]);
      console.warn('Scoped state document was unavailable:',keys[index],result.reason);
    }
  });
  /* A value too large for one document continues into <key>_p2, <key>_p3, …
     A scoped session cannot list the collection, so it has to name what it
     reads — but it only has to ask when a document it just read is large enough
     to have been continued. A session holding nothing large asks for nothing,
     which is the ordinary case and costs no extra read. */
  for(var round=0;round<OVERFLOW_PROBE_ROUNDS;round++){
    var probes=overflowProbeKeys(cache);
    if(!probes.length)break;
    // eslint-disable-next-line no-await-in-loop
    var extra=await Promise.allSettled(probes.map(function(key){return loader(key)}));
    var found=false;
    extra.forEach(function(result,index){
      if(result.status==='fulfilled'&&result.value!==null&&result.value!==undefined){cache[probes[index]]=result.value;found=true;}
    });
    if(!found)break;
  }
  if(profile&&['department','outpatient_pharmacy_supervisor'].includes(String(profile.role||'')))Object.defineProperty(cache,'__scopedDepartmentState',{value:true,enumerable:false,configurable:true});
  return {cache:fsStateScopeCacheForProfile(cache,profile),source:source,failedKeys:failedKeys};
}
// Warehouse role is a scopedStateUser — it cannot LIST the collection.
// It reads only the specific documents permitted by canReadScopedState() in firestore.rules.
/* The audit trail is one document per calendar month now, so a scoped role that
   cannot LIST the collection has to name the months it wants. It reads the current
   and previous month, which is what its screens actually show; the full history is
   available to the roles that can list. */
function fsRecentAuditLogKeys(monthsBack){
  var keys=[],now=new Date();
  for(var i=0;i<=(monthsBack||1);i++){
    var d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));
    keys.push('audit_log_'+d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0'));
  }
  return keys;
}
globalThis.fsRecentAuditLogKeys=fsRecentAuditLogKeys;

/* Thirteen Hijri months: the current one plus a full year back, which covers the
   custody officer's working view and the year-to-date report without loading five
   years into every session. Anything older is read on demand. */
var LEDGER_MONTHS_IN_SESSION=12;
/* How far back each partitioned key is loaded is a property of the key, not of
   this function: orders are read constantly and a department's working view is a
   few weeks, while the custody officer's is a year. Each key states its own
   window in its registration, so adding one never means editing this. */
function fsRecentLedgerKeys(monthsBack){
  var keys=[];
  monthPartitionedKeyNames().forEach(function(key){
    var spec=monthPartitionSpec(key),months=spec&&spec.sessionMonths!=null?spec.sessionMonths:monthsBack;
    keys=keys.concat(recentPartitionKeys(key,months));
  });
  return keys;
}
globalThis.fsRecentLedgerKeys=fsRecentLedgerKeys;
globalThis.WAREHOUSE_STATE_KEYS = Object.freeze([
  'departments','deleted_departments','theme',
  /* controlled_moves is the pre-migration single document. The warehouse appends
     movements straight to the Hijri partitions, so without holding this the
     session cannot tell whether the legacy document is still the live record —
     and the ledger would read from one half while being written to the other
     until a master runs the migration. */
  'controlled_warehouse','controlled_moves','controlled_pdf_receipts','user_activity_daily_v1',
  'classification_lists_v1','page_visibility_overrides_v1'
]);
globalThis.CONTROLLED_PHARMACY_BASE_KEYS = Object.freeze([
  'departments','deleted_departments','custom_categories','theme','facility_logo',
  'controlled_catalog','controlled_pharmacy_stock','controlled_warehouse',
  'controlled_moves','controlled_moves_summary_v1','controlled_pdf_receipts','controlled_pharmacy_storage_v1',
  'psychotropic_pharmacy_stock_import_r664_20260728_v2_safe_psych_only',
  'narcotic_restore_from_backup_20260728_v1',
  'controlled_dept_list_name_enrich_v1',
  'controlled_custody_handover_log_v1','controlled_custody_handover_defaults_v1','user_activity_daily_v1',
  'classification_lists_v1','page_visibility_overrides_v1'
]);
function fsControlledPharmacyDeptKeys(cache){
  var ids=(Array.isArray(cache&&cache.departments)?cache.departments:[])
    .map(function(d){return String(d&&d.id||'').trim();}).filter(Boolean);
  var keys=[];
  // controlled_settings_ (custody print signatures/print-code mode) and
  // controlled_dept_shelves_ (shelf/cabinet layout) are readable+writable by
  // this role for every department (see canReadPharmacyState/canWriteState
  // in firestore.rules, both matched by the controlled_.* wildcard), but were
  // missing from this scoped key list — so a save via ctlEditSignatures
  // succeeded in Firestore yet never came back on the next scoped state
  // load/poll, making edits appear to silently revert and print pull stale
  // per-department data.
  ids.forEach(function(id){
    keys.push('controlled_dept_list_'+id,'controlled_settings_'+id,'controlled_dept_shelves_'+id);
  });
  return keys;
}
async function fsStateLoadControlledPharmacyScoped(profile,loader,source){
  var initial=await fsStateLoadScoped(CONTROLLED_PHARMACY_BASE_KEYS,loader,source,profile);
  var deptKeys=fsControlledPharmacyDeptKeys(initial.cache);
  if(!deptKeys.length)return initial;
  var dynamic=await fsStateLoadScoped(deptKeys,loader,source,profile);
  Object.assign(initial.cache,dynamic.cache);
  initial.failedKeys=(initial.failedKeys||[]).concat(dynamic.failedKeys||[]);
  return initial;
}
function fsPharmacyDepartmentStateKeys(cache,profile){
  var departments=Array.isArray(cache&&cache.departments)?cache.departments:[];
  var role=String(profile&&profile.role||'');
  var isInpatient=false;
  var prefixes=['meds_','expiry_','shelves_','alerts_','inventory_integrity_','inventory_snapshot_index_'];
  var keys=[];
  departments.forEach(function(dept){
    var id=String(dept&&dept.id||'').trim();
    if(!id)return;
    // inpatient_supervisor has no access to outpatient department data
    if(isInpatient){var n=String(dept.name||id).toLowerCase().trim();if(n==='outpatient'||n==='outpatient department'||id.toLowerCase()==='outpatient')return;}
    prefixes.forEach(function(prefix){keys.push(prefix+id)});
  });
  return keys;
}
async function fsStateLoadPharmacyScoped(profile,loader,source){
  // The per-department keys (meds_/expiry_/shelves_/... for every
  // department) can only be listed once `departments` is known, but that
  // never required the OTHER ~24 static keys first — fetching them one big
  // wave, then waiting for it to fully settle before even starting the
  // department wave, cost a full extra sequential round trip on every cold
  // login. Fetch `departments` alone first (one small document), then fire
  // the rest of the static wave and the department wave together.
  var deptOnly=await fsStateLoadScoped(['departments'],loader,source,profile);
  var restKeys=PHARMACY_SCOPED_STATE_KEYS.filter(function(k){return k!=='departments'});
  var dynamicKeys=fsPharmacyDepartmentStateKeys(deptOnly.cache,profile);
  var pair=await Promise.all([
    fsStateLoadScoped(restKeys,loader,source,profile),
    dynamicKeys.length?fsStateLoadScoped(dynamicKeys,loader,source,profile):Promise.resolve({cache:{},failedKeys:[]})
  ]);
  var cache=Object.assign({},deptOnly.cache,pair[0].cache,pair[1].cache);
  var failedKeys=(deptOnly.failedKeys||[]).concat(pair[0].failedKeys||[],pair[1].failedKeys||[]);
  return {cache:cache,source:source,failedKeys:failedKeys};
}
async function fsStateMergeCollectionKeys(resultPromise,profile){
  // Each collection list is independent of the scoped state fetch and of the
  // others, so they all start before the state result is awaited rather than
  // adding a sequential round trip per key to every login and poll.
  var pending=COLLECTION_BACKED_KEYS.map(function(spec){
    return fsStateLoadCollectionViaRest(spec,profile).then(
      function(rows){return {spec:spec,ok:true,rows:rows}},
      function(error){return {spec:spec,ok:false,error:error}}
    );
  });
  var result=await resultPromise;
  var settled=await Promise.all(pending);
  settled.forEach(function(entry){
    if(entry.ok){
      result.cache[entry.spec.key]=entry.rows;
      return;
    }
    // Leave the key out of the returned cache entirely and record it as
    // failed instead — pollRest() already restores a failed key's previous
    // cached value from before this poll (same guard it uses for every
    // other document read), so a transient network/permission hiccup here
    // can't blank out the ledger the way an unconditional [] would.
    console.warn(entry.spec.legacyPath+' REST load failed for this poll.',entry.error);
    result.failedKeys=(result.failedKeys||[]).concat(entry.spec.key);
  });
  return result;
}
function fsStateLoadFloorstockForProfileViaRest(profile){
  if(fsIsPharmacyScopedProfile(profile))return fsStateMergeCollectionKeys(fsStateLoadPharmacyScoped(profile,fsStateLoadDocumentViaRest,'rest-scoped'),profile);
  if(String(profile&&profile.role||'')==='controlled_pharmacy')return fsStateMergeCollectionKeys(fsStateLoadControlledPharmacyScoped(profile,fsStateLoadDocumentViaRest,'rest-scoped'),profile);
  var keys=fsStateKeysForProfile(profile);
  /* A collection-backed key is NOT in the floorstock_state collection, so
     listing that collection returns everything except it. Every scoped role
     merges the collection separately below; master and pharmacy — the roles with
     no key list at all — did not, so on this path they loaded every state
     document and no Crash Cart reports whatsoever.

     They reach this path routinely: a warm boot opens the cached state with
     transport 'rest', and the SDK collection listener is only installed on the
     'sdk' branch. So a master with a warm cache saw an empty alert strip while a
     pharmacy account, which merges here, saw the pending report — which is
     exactly what was reported from the floor. */
  if(!keys)return fsStateMergeCollectionKeys(fsStateLoadFloorstockViaRest(),profile);
  var scoped=fsStateLoadScoped(keys,fsStateLoadDocumentViaRest,'rest-scoped',profile);
  return ['department','outpatient_pharmacy_supervisor'].includes(String(profile&&profile.role||''))
    ? fsStateMergeCollectionKeys(scoped,profile)
    : scoped;
}
function fsStateLoadFloorstockForProfileViaSdk(profile){
  if(fsIsPharmacyScopedProfile(profile))return fsStateLoadPharmacyScoped(profile,fsStateLoadDocumentViaSdk,'sdk-scoped');
  if(String(profile&&profile.role||'')==='controlled_pharmacy')return fsStateLoadControlledPharmacyScoped(profile,fsStateLoadDocumentViaSdk,'sdk-scoped');
  var keys=fsStateKeysForProfile(profile);
  return keys?fsStateLoadScoped(keys,fsStateLoadDocumentViaSdk,'sdk-scoped',profile):fsStateLoadFloorstockViaSdk();
}
// REST-path counterpart of the SDK's collection listener (see
// S.collectionUnsubs in startRealtime): scoped roles never use the SDK realtime
// listener (fsStateKeysForProfile forces transport: 'rest'), so this is the only
// way they pick up a collection-backed key. Every call re-lists the whole
// collection — S.pollRest() already runs this every 30s regardless, the same
// cadence the blob keys these replaced used to be polled at.
async function fsStateLoadCollectionViaRest(spec,profile){
  var documents=await fsStateRestListCollection(collectionBackedPath(spec,profile));
  return sortCollectionRows(spec,documents.map(function(documentValue){
    return normalizeCollectionRow(spec,fsLoginDecodeRestDocument(documentValue)||{});
  }));
}
async function fsStateLoadUsersViaRest(){
  var documents=await fsStateRestListCollection('users');
  return documents.map(function(documentValue){
    var data=fsLoginDecodeRestDocument(documentValue)||{};
    var id=String(documentValue.name||'').split('/').pop();
    return Object.assign({id:id},data);
  });
}
async function fsStateLoadFloorstockViaSdk(){
  var snapshot=await fsLoginTimeout(
    fsStateSdkCollection().get(),
    7000,
    'Firestore SDK state request timed out.'
  );
  var cache={};
  snapshot.forEach(function(doc){if(doc.id!=='users')cache[doc.id]=doc.data().value;});
  return {cache:cache,source:'sdk'};
}
async function fsHydrateDepartmentDirectoryForLogin(profile){
  if(!profile||profile.role!=='department')return;
  var keys=['departments','deleted_departments'];
  var result=await fsLoginTimeout(
    fsStateFirstSuccess([
      fsStateLoadScoped(keys,fsStateLoadDocumentViaSdk,'sdk-login'),
      fsStateLoadScoped(keys,fsStateLoadDocumentViaRest,'rest-login')
    ],'Department directory'),
    8000,
    'Department directory timed out.'
  );
  var directory=result.cache||{};
  S.cache=Object.assign({},S.cache||{},directory,{
    departments:Array.isArray(directory.departments)?directory.departments:[],
    deleted_departments:Array.isArray(directory.deleted_departments)?directory.deleted_departments:[]
  });
}
async function fsStateLoadUsersViaSdk(){
  var usersQuery=FB_DB.collection('users'),tenantId=fsTenantId(globalThis.S&&S.scopeProfile);
  if(tenantId)usersQuery=usersQuery.where('tenantId','==',tenantId);
  var snapshot=await fsLoginTimeout(
    usersQuery.get(),
    7000,
    'Firestore SDK users request timed out.'
  );
  return snapshot.docs.map(function(doc){return Object.assign({id:doc.id},doc.data());});
}
async function fsStateLoadUsersViaCallable(){
  var result=await fsCallFunction('listManagedUsers',{});
  return result&&Array.isArray(result.users)?result.users:[];
}
function fsStateIsLegacyMasterProfile(profile){
  return !!(profile&&profile.master===true&&!fsTenantId(profile));
}
async function fsStateLoadLegacyUserDirectory(){
  // The legacy installation has its canonical directory in /users.  The
  // callable is useful as a final compatibility source, but an empty callable
  // result must never erase real users after an auth-session refresh.
  var loaders=[fsStateLoadUsersViaCallable,fsStateLoadUsersViaSdk,fsStateLoadUsersViaRest],failures=[];
  for(var index=0;index<loaders.length;index++){
    try{
      var rows=await loaders[index]();
      if(Array.isArray(rows)&&rows.length)return rows;
    }catch(error){failures.push(error);}
  }
  if(failures.length===loaders.length){
    throw new Error('Loading legacy users failed. '+failures.map(function(error){return error&&error.message||String(error);}).join(' | '));
  }
  return [];
}
function fsStateFirstSuccess(tasks,label){
  return new Promise(function(resolve,reject){
    var settled=false,remaining=tasks.length,errors=[];
    tasks.forEach(function(task){
      Promise.resolve(task).then(function(value){
        if(settled)return;
        settled=true;resolve(value);
      },function(error){
        if(settled)return;
        errors.push(error);remaining--;
        if(remaining===0){
          var messages=errors.map(function(item){return item&&item.message||String(item);}).filter(Boolean);
          reject(new Error((label||'Firestore request')+' failed. '+messages.join(' | ')));
        }
      });
    });
  });
}
async function fsStateRestSetDocument(key,value){
  var url=fsStateRestBase()+'/'+fsRestPath(fsStateCollectionPath()+'/'+key)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
  var body={fields:{
    value:fsStateRestEncode(value),
    updatedAt:{timestampValue:new Date().toISOString()}
  }};
  await fsStateRestRequest(url,{method:'PATCH',body:JSON.stringify(body)},12000);
  return true;
}
async function fsStateRestDeleteDocument(key){
  var url=fsStateRestBase()+'/'+fsRestPath(fsStateCollectionPath()+'/'+key)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
  await fsStateRestRequest(url,{method:'DELETE'},12000);
  return true;
}
async function fsStateSdkSetDocument(key,value){
  return fsLoginTimeout(
    fsStateSdkCollection().doc(key).set({
      value:value,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }),
    8000,
    'Firestore SDK save timed out.'
  );
}
async function fsStateSdkDeleteDocument(key){
  return fsLoginTimeout(
    fsStateSdkCollection().doc(key).delete(),
    8000,
    'Firestore SDK delete timed out.'
  );
}
// Geo-gate for floorstock_state writes: checked here, BEFORE the SDK/REST
// branch, not inside fsStateSdkSetDocument/fsStateSdkDeleteDocument — those
// two are only reached on the SDK path, and S.writeTransport permanently
// flips to 'rest' after a single transient SDK failure for the rest of the
// session, which would silently bypass a check placed only in the SDK
// helpers. Cached for 30 minutes per session so this doesn't add a Cloud
// Function round-trip to every write.
globalThis._geoWriteCheckCache = {allowed:null,checkedAt:0};
async function ensureGeoAllowed(){
  var now=Date.now(),cache=globalThis._geoWriteCheckCache;
  if(cache.allowed!==null&&now-cache.checkedAt<30*60*1000){
    if(!cache.allowed)throw new Error('Writing is restricted to Saudi Arabia. / الكتابة مقيّدة جغرافياً بالسعودية.');
    return;
  }
  try{
    var result=await fsCallFunction('checkGeoAllowed',{});
    var allowed=!!(result&&result.allowed);
    globalThis._geoWriteCheckCache={allowed:allowed,checkedAt:now};
    if(!allowed)throw new Error('Writing is restricted to Saudi Arabia. / الكتابة مقيّدة جغرافياً بالسعودية.');
  }catch(error){
    if(error&&/restricted to Saudi Arabia/.test(error.message||''))throw error;
    // The geo check itself failing (network hiccup, cold start, callable
    // unreachable) must never brick every write nationwide — fail open and
    // let Firestore Rules + App Check remain the real security boundary.
    console.warn('Geo write check failed; allowing this write. / تعذر فحص الموقع الجغرافي للكتابة؛ سيُسمح بالكتابة.',error);
    globalThis._geoWriteCheckCache={allowed:null,checkedAt:0};
  }
}
window.ensureGeoAllowed=ensureGeoAllowed;
/* The two implementations behind core/state-transport.js. The selection rule —
   which transport, and what happens when one fails — lives there; these are just
   the Firestore plumbing for each side. */
registerStateTransport('rest',{
  load:function(profile){return fsStateLoadFloorstockForProfileViaRest(profile)},
  set:function(key,value){return fsStateRestSetDocument(key,value)},
  remove:function(key){return fsStateRestDeleteDocument(key)}
});
registerStateTransport('sdk',{
  load:function(profile){return fsStateLoadFloorstockForProfileViaSdk(profile)},
  set:function(key,value){return fsStateSdkSetDocument(key,value)},
  remove:function(key){return fsStateSdkDeleteDocument(key)}
});
onTransportFallback(function(operation,error){
  console.warn('Firestore SDK '+operation+' failed; using REST for subsequent writes.',error);
  S.writeTransport='rest';
});

async function fsStateSetSmart(key,value){
  await ensureGeoAllowed();
  return portSetState(key,value);
}
async function fsStateDeleteSmart(key){
  await ensureGeoAllowed();
  return portRemoveState(key);
}
function fsStateApplyCache(nextCache){
  var changed=false,current=S.cache||{};
  Object.keys(current).forEach(function(key){
    if(key==='users')return;
    if(!Object.prototype.hasOwnProperty.call(nextCache,key)){delete current[key];changed=true;}
  });
  Object.keys(nextCache).forEach(function(key){
    if(!stateValueEqual(current[key],nextCache[key]))changed=true;
    current[key]=nextCache[key];
  });
  return changed;
}
function fsStateScheduleManagedUserLoad(profileHint){
  var role=profileHint&&profileHint.role||'';
  var shouldLoadUsers=!!(profileHint&&profileHint.master===true)||role==='pharmacy'||role==='pharmacy_director';
  if(!shouldLoadUsers)return;
  setTimeout(function(){
    if(!S.ready)return;
    S.loadUsers().then(function(users){
      S.cache.users=users||[];
      var active=document.querySelector('.pg.on');
      if(active&&active.id==='pg-users')S.scheduleRefresh();
    }).catch(function(error){
      console.warn('Background user-list load was unavailable.',error);
    });
  },0);
}


/* One realtime listener per collection-backed key, shared by the master path
   (transport 'sdk') and the scoped path. Both used to carry their own copy of
   this block naming crash_cart_reports throughout; a second converted key would
   have meant a third and fourth copy. Returns the unsubscribe functions.

   These collections grant list/get to any active user regardless of role — they
   are not gated the way floorstock_state is — so the same listener works for
   every profile. */
/* A one-off list of each collection-backed key, run alongside the listener.

   A pending Crash Cart report reaches the app only through this listener, and a
   listener that never delivers is indistinguishable from "no reports": its
   failure went to the console, the page rendered an empty alert strip, and a
   master had no way to tell that a department was waiting on them. The initial
   snapshot can also be slow on a cold connection, which is the delay reported
   from the floor.

   So the rows are also fetched once, directly, when the listeners are installed.
   It is one read of a small collection, it cannot make the page later than the
   listener would, and it fills the gap when the listener is late — or never
   arrives at all. */
function fsStateSeedCollectionKeys(profile,force){
  COLLECTION_BACKED_KEYS.forEach(function(spec){
    fsStateLoadCollectionViaRest(spec,profile).then(function(rows){
      if(!Array.isArray(rows)||stateValueEqual(S.cache[spec.key],rows))return;
      var byId=S.__collectionRowsById[spec.key]||(S.__collectionRowsById[spec.key]={});
      /* Once the listener has spoken it owns the rows, so a late seed must not
         reorder or resurrect anything it has already applied. While the listener
         is DOWN there is nothing to defer to, and `force` says so. */
      if(!force&&Object.keys(byId).length)return;
      S.__collectionRowsById[spec.key]=byId;
      if(force)Object.keys(byId).forEach(function(id){delete byId[id]});
      rows.forEach(function(row){if(row&&row.id!=null)byId[String(row.id)]=row});
      S.cache[spec.key]=rows;
      S.scheduleRefresh();
    },function(error){
      console.warn(spec.legacyPath+' initial list failed.',error);
    });
  });
}
function fsStateInstallCollectionListeners(profile,label){
  S.__collectionRowsById=S.__collectionRowsById||{};
  fsStateSeedCollectionKeys(profile);
  return COLLECTION_BACKED_KEYS.map(function(spec){
    S.__collectionRowsById[spec.key]=S.__collectionRowsById[spec.key]||{};
    return collectionRefForSpec(FB_DB,spec,profile).onSnapshot(function(snapshot){
      // A collection listener attached to an empty in-memory SDK cache can fire
      // an initial near-empty snapshot before the server-confirmed one arrives.
      // Skip it rather than let it blank out rows the cold load already fetched.
      if(snapshot.metadata.fromCache)return;
      var byId=S.__collectionRowsById[spec.key];
      snapshot.docChanges().forEach(function(change){
        if(change.type==='removed'){delete byId[change.doc.id];return;}
        byId[change.doc.id]=normalizeCollectionRow(spec,change.doc.data()||{});
      });
      var next=sortCollectionRows(spec,Object.keys(byId).map(function(id){return byId[id]}));
      if(!stateValueEqual(S.cache[spec.key],next)){
        S.cache[spec.key]=next;
        S.scheduleRefresh();
      }
    },function(error){
      /* Console-only was the whole problem: a pending report simply never
         appeared and nothing said why. The rows are re-listed directly so the
         page still shows them, and the failure is stated where the person who
         needs to act will see it. */
      console.error(spec.legacyPath+' realtime error'+(label?' ('+label+')':'')+'.',error);
      fsStateLoadCollectionViaRest(spec,profile).then(function(rows){
        if(!Array.isArray(rows)||stateValueEqual(S.cache[spec.key],rows))return;
        S.__collectionRowsById[spec.key]={};
        rows.forEach(function(row){if(row&&row.id!=null)S.__collectionRowsById[spec.key][String(row.id)]=row});
        S.cache[spec.key]=rows;
        S.scheduleRefresh();
      }).catch(function(restError){
        console.error(spec.legacyPath+' fallback list failed too.',restError);
        if(typeof globalThis.toast==='function'){
          globalThis.toast('Crash Cart reports could not be loaded — a pending report may not be shown. Refresh the page.\nتعذر تحميل بلاغات عربات الطوارئ؛ قد لا يظهر بلاغ منتظر. حدّث الصفحة.','err');
        }
      });
      // Poll while the listener is down, so a report submitted meanwhile lands.
      if(!S.__collectionRestFallbackTimer){
        S.__collectionRestFallbackTimer=setInterval(function(){fsStateSeedCollectionKeys(profile,true)},30000);
      }
    });
  });
}

globalThis.S = {
  cache:{},ready:false,stateUnsub:null,collectionUnsubs:null,__collectionRowsById:{},usersUnsub:null,usersPollTimer:null,refreshTimer:null,pollTimer:null,pollBusy:false,transport:'unknown',writeTransport:'sdk',scopeProfile:null,cacheKey:'',
  persistLocalCache:function(){
    if(!S.cacheKey)return;
    try{
      var snapshot=Object.assign({},S.cache);
      delete snapshot.users;
      localStorage.setItem(S.cacheKey,JSON.stringify(snapshot));
    }catch(e){}
  },
  init:async function(statusCallback,profileHint){
    S.stopRealtime();
    S.scopeProfile=profileHint||null;
    var cacheUid=String(profileHint&&profileHint.uid||FB_AUTH&&FB_AUTH.currentUser&&FB_AUTH.currentUser.uid||'').trim();
    var cacheKey=cacheUid?'floorstock_last_cache_v2_'+cacheUid:'';
    S.cacheKey=cacheKey;
    // The v1 key was shared across accounts and could expose a previous session's state.
    try{
      localStorage.removeItem('floorstock_last_cache_v1');
      Object.keys(localStorage).forEach(function(key){
        if(key.indexOf('floorstock_last_cache_v2_')===0&&key!==cacheKey)localStorage.removeItem(key);
      });
    }catch(removeError){}
    var hasCachedState=false;
    try{
      var cached=cacheKey?localStorage.getItem(cacheKey):null;
      if(cached){
        var parsed=JSON.parse(cached),allowed=fsStateKeysForProfile(profileHint);
        if(allowed){
          if(fsIsPharmacyScopedProfile(profileHint))allowed=allowed.concat(fsPharmacyDepartmentStateKeys(parsed,profileHint));
          var allowedSet=new Set(allowed),scoped={};
          Object.keys(parsed||{}).forEach(function(key){if(allowedSet.has(key))scoped[key]=parsed[key]});
          parsed=scoped;
        }
        S.cache=fsStateScopeCacheForProfile(parsed||{},profileHint);
        S.cache.users=[];
        S.ready=true;
        hasCachedState=Object.keys(S.cache).length>0;
      }
    }catch(e){
      console.warn('Local Floor Stock cache unavailable.',e);
    }
    // A same-account cache is already permission-scoped.  Open it immediately
    // and refresh in the background; Safari otherwise waits for a complete
    // collection read before it paints the application shell.
    if(hasCachedState){
      S.transport='rest';
      resetWriteTransport();S.writeTransport=writeTransportName();
      var selfLoading=S.startRealtime();
      fsStateScheduleManagedUserLoad(profileHint);
      // Scoped roles attach one listener per allowed document and each fires an
      // initial snapshot, so the immediate poll that used to run here re-read
      // every document a second time on each warm boot - roughly 35 redundant
      // reads competing with the listeners for the same connection while the
      // page was still painting. Only transports that do not deliver their own
      // initial state still need it.
      if(!selfLoading)setTimeout(function(){
        if(S.ready)S.pollRest();
      },0);
      if(statusCallback)statusCallback('Opening Floor Stock…');
      return true;
    }

    if(statusCallback)statusCallback('Loading data… / جاري تحميل البيانات…');

    var result=await portLoadState(profileHint,function(promise,message){
      return fsLoginTimeout(promise,9000,message);
    });

    var freshCache=result.cache||{};

S.cache=freshCache;
S.transport=result.source||'rest';
resetWriteTransport();S.writeTransport=writeTransportName();
S.cache.users=S.cache.users||[];
S.ready=true;
if(!window.__ASDH_REAL_LOAD_COMPLETE){
  window.__ASDH_REAL_LOAD_COMPLETE=true;
  document.dispatchEvent(new CustomEvent('asdh:real-load-complete'));
}

    // Save only this authenticated account's already permission-scoped state.
    try{
      if(cacheKey)localStorage.setItem(cacheKey,JSON.stringify(freshCache));
    }catch(e){
      console.warn('Could not save Floor Stock cache.',e);
    }
    S.startRealtime();

    setTimeout(function(){
      if(typeof window.renderRequestHourGridUI==='function'){
        window.renderRequestHourGridUI();
      }
    },0);

    fsStateScheduleManagedUserLoad(profileHint);

    if(statusCallback)statusCallback('Opening Floor Stock…');
    return true;
  },
  loadUsers:async function(){
    // The callable is authoritative: it combines the current /users
    // collection with the legacy directory.  Do not race it against a direct
    // Firestore query, because an empty direct query can otherwise overwrite a
    // valid legacy directory before the callable returns.
    // Keep a known-good directory during a transient network/callable issue.
    // In particular, never replace a populated Users screen with an empty
    // result from a failed fallback path during the 30-second refresh cycle.
    var previousUsers=Array.isArray(S.cache&&S.cache.users)?S.cache.users:[];
    var users;
    try{
      // The server function is the canonical directory for both legacy and
      // tenant installations. It can merge Authentication-backed records with
      // the legacy state directory without depending on client list rules.
      users=await fsStateLoadUsersViaCallable();
    }catch(callableError){
      console.warn('Managed-user directory callable was unavailable; using a read-only fallback.',callableError);
      users=await fsStateLoadLegacyUserDirectory();
    }
    if(Array.isArray(users)&&users.length===0&&previousUsers.length){
      console.warn('Managed-user directory refresh returned no records; retaining the last verified directory.');
      return previousUsers;
    }
    S.cache.users=Array.isArray(users)?users:[];
    return S.cache.users;
  },
  // Token-lag mitigation for the Phase 2b custom-claims scaffolding (see
  // functions/sync-user-claims.js): a signed-in client keeps using whatever
  // permissions it started with until its ID token naturally expires
  // (up to ~1 hour), regardless of what an admin changes server-side in the
  // meantime. Watching the signed-in user's own profile in realtime (allowed
  // for any signed-in user under firestore.rules — request.auth.uid==uid)
  // and force-signing-out the instant it's deactivated or its role/dept/
  // master flag changes closes that gap in practice: it matches how
  // deactivation already behaves today under the current get()-based rules,
  // where a permission change takes effect on the very next Firestore call.
  startSelfProfileWatch:function(){
    if(S.selfProfileUnsub){S.selfProfileUnsub();S.selfProfileUnsub=null;}
    var uid=window.CU&&window.CU.id;
    if(!uid||!FB_DB)return;
    S.selfProfileUnsub=FB_DB.collection('users').doc(uid).onSnapshot(function(snapshot){
      if(!window.CU||window.CU.id!==uid)return;
      if(!snapshot.exists){
        S.forceSignOutForProfileChange('Your account was removed. / تم حذف حسابك، الرجاء التواصل مع الإدارة.');
        return;
      }
      var profile=snapshot.data()||{};
      var deptId=profile.deptId!=null?profile.deptId:profile.departmentId;
      var deactivated=profile.active!==true;
      var changed=deactivated
        || String(profile.role||'')!==String(window.CU.role||'')
        || String(deptId||'')!==String(window.CU.deptId||'')
        || !!profile.master!==!!window.CU.master;
      if(changed){
        S.forceSignOutForProfileChange(deactivated
          ? 'Your account was deactivated by an administrator. / تم إيقاف حسابك من قبل الإدارة، الرجاء التواصل معها.'
          : 'Your account permissions changed. Please sign in again. / تغيّرت صلاحيات حسابك، الرجاء تسجيل الدخول مرة أخرى.');
      }
    },function(error){
      console.warn('Self-profile watch error; will retry on the next realtime start.',error);
    });
  },
  forceSignOutForProfileChange:function(message){
    if(typeof window.toast==='function')window.toast(message,'err');
    Promise.resolve(typeof window.doLogout==='function'?window.doLogout():null)
      .catch(function(error){console.error('Forced sign-out after profile change failed',error)})
      .then(function(){setTimeout(function(){location.reload()},1200)});
  },
  // Returns true when the transport it installed delivers the current state on
  // its own (an onSnapshot fires an initial snapshot; the forced-REST branch
  // polls immediately). init()'s warm-boot path uses that to avoid following a
  // listener attach with a duplicate full read of every document.
  startRealtime:function(){
    S.stopRealtime();
    if(!S.ready)return false;
    S.startSelfProfileWatch();

    // Scoped roles may read their allowed documents but are intentionally not
    // allowed to list the whole state collection (no `list`/collection
    // onSnapshot). A single-document onSnapshot only needs the same `get`
    // permission a one-off read already uses, though — so watch every
    // allowed document individually instead of falling all the way back to
    // 30s full-collection REST polling.
    var scopedKeys=fsStateKeysForProfile(S.scopeProfile);
    if(scopedKeys){
      if(window.__ASDH_FORCE_REST_SCOPED){
        S.transport='rest';
        S.pollRest();
        S.pollTimer=setInterval(function(){S.pollRest();},30000);
        return true;
      }
      S.startScopedListeners(scopedKeys);
      return true;
    }

    if(S.transport==='sdk'){
      try{
        S.stateUnsub=fsStateSdkCollection().onSnapshot(function(snapshot){
          var changed=false;
          snapshot.docChanges().forEach(function(change){
            // crash_cart_reports: read from the crash_cart_reports_v2 (or
            // per-tenant) collection listener below instead of this legacy
            // state-doc array — the Cloud Functions still dual-write both,
            // this just switches which side the client reads from first.
            // Collection-backed keys are read from their own listeners (see
            // fsStateInstallCollectionListeners); the legacy state document for
            // the same key, where one still exists, must not overwrite them.
            if(change.doc.id==='users'||collectionBackedKeyNames().indexOf(change.doc.id)>=0)return;
            var key=change.doc.id;
            if(change.type==='removed'){
              if(Object.prototype.hasOwnProperty.call(S.cache,key)){delete S.cache[key];changed=true;}
              return;
            }
            var next=change.doc.data().value;
            if(!stateValueEqual(S.cache[key],next))changed=true;
            S.cache[key]=next;
          });
          if(changed)S.scheduleRefresh();
        },function(error){
          console.error('floorstock_state realtime error; switching to REST polling.',error);
          S.transport='rest';S.startRealtime();
        });
        S.collectionUnsubs=fsStateInstallCollectionListeners(S.scopeProfile,'');
        var tenantId=fsTenantId(S.scopeProfile),canManageUsers=!!(S.scopeProfile&&(S.scopeProfile.master===true||['pharmacy','pharmacy_director'].indexOf(S.scopeProfile.role)>=0));
        if(canManageUsers){
          // Always refresh through the canonical directory callable.  A direct
          // /users listener cannot include legacy users and caused the Users
          // page to become empty again after the first realtime update.
          S.usersPollTimer=setInterval(function(){
            var before=S.cache.users||[];
            S.loadUsers().then(function(users){
              var active=document.querySelector('.pg.on');
              if(!stateValueEqual(before,users||[])&&active&&active.id==='pg-users')S.scheduleRefresh();
            }).catch(function(error){console.warn('User-list refresh was unavailable.',error)});
          },30000);
        }
        return true;
      }catch(error){
        console.error('Firestore realtime setup failed; switching to REST polling.',error);
        S.transport='rest';
      }
    }

    /* Reached by a warm boot, which opens the cached state on 'rest' before any
       SDK listener exists, and by an SDK listener that failed. The collection
       listener does not depend on that choice — it is its own subscription — so
       a pending Crash Cart report should not have to wait for the next 30s poll
       just because the state documents are being polled. */
    if(globalThis.FB_DB&&!Array.isArray(S.collectionUnsubs)){
      try{S.collectionUnsubs=fsStateInstallCollectionListeners(S.scopeProfile,'rest-state');}
      catch(error){console.warn('Collection listeners unavailable on the REST path.',error);}
    }
    S.pollTimer=setInterval(function(){S.pollRest();},30000);
    return false;
  },
  // Real-time replacement for scoped-role REST polling. One onSnapshot per
  // allowed document (same permission as a single get()), fanned out over
  // one shared Firestore SDK connection, instead of re-fetching every
  // document from scratch every 30 seconds regardless of whether anything
  // changed. Falls back to REST polling automatically if any listener
  // reports a permission/setup error (e.g. Firestore Rules drift).
  startScopedListeners:function(baseKeys){
    var profile=S.scopeProfile;
    var keys=baseKeys.slice();
    if(fsIsPharmacyScopedProfile(profile)){
      // meds_/expiry_/shelves_/... per-department keys can only be computed
      // once `departments` is known — already true here, since S.ready only
      // flips after the initial full load (REST or SDK) has completed.
      keys=keys.concat(fsPharmacyDepartmentStateKeys(S.cache,profile));
    }
    S.transport='sdk-scoped-listen';
    var fellBack=false;
    function fallBackToRest(error){
      if(fellBack)return;
      fellBack=true;
      console.error('Scoped realtime listener failed; falling back to REST polling.',error);
      S.stopRealtime();
      S.transport='rest';
      S.startSelfProfileWatch();
      S.pollRest();
      S.pollTimer=setInterval(function(){S.pollRest();},30000);
    }
    S.scopedUnsubs=keys.map(function(key){
      return fsStateSdkCollection().doc(key).onSnapshot(function(snapshot){
        // A document Firestore has never cached locally can fire an initial
        // "exists: false" snapshot straight from the empty local cache,
        // before the real server response arrives a moment later. Since the
        // cold-load already populated S.cache with real data before any
        // listener attached, never let a from-cache "not found" blank out a
        // key we already have a value for — wait for the server-confirmed
        // snapshot instead. A genuine deletion still lands right after.
        if(snapshot.metadata.fromCache&&!snapshot.exists&&Object.prototype.hasOwnProperty.call(S.cache,key))return;
        var next=snapshot.exists?snapshot.data().value:null;
        if(!stateValueEqual(S.cache[key],next)){
          S.cache[key]=next;
          S.scheduleRefresh();
        }
      },fallBackToRest);
    });
    S.collectionUnsubs=fsStateInstallCollectionListeners(profile,'scoped');
  },
  pollRest:async function(){
    if(S.pollBusy||!S.ready||document.visibilityState==='hidden')return;
    S.pollBusy=true;
    try{
      var state=await fsStateLoadFloorstockForProfileViaRest(S.scopeProfile);
      var incoming=state.cache||{},previousCache=S.cache||{};
      // A scoped poll is an explicit set of document reads. Preserve only a
      // document whose read failed in this poll; a fulfilled null still means
      // the document was deliberately removed. This prevents a transient
      // permission/network failure from blanking every visible crash cart.
      (state.failedKeys||[]).forEach(function(key){
        if(!Object.prototype.hasOwnProperty.call(incoming,key)&&Object.prototype.hasOwnProperty.call(previousCache,key))incoming[key]=previousCache[key];
      });
      if(fsIsPharmacyScopedProfile(S.scopeProfile)&&!Object.prototype.hasOwnProperty.call(incoming,'departments')&&Array.isArray(previousCache.departments)&&previousCache.departments.length){
        fsPharmacyDepartmentStateKeys(previousCache).forEach(function(key){
          if(!Object.prototype.hasOwnProperty.call(incoming,key)&&Object.prototype.hasOwnProperty.call(previousCache,key))incoming[key]=previousCache[key];
        });
      }
      var changed=fsStateApplyCache(incoming);
      if(changed)S.scheduleRefresh();
      if(!window.__ASDH_REAL_LOAD_COMPLETE){
        window.__ASDH_REAL_LOAD_COMPLETE=true;
        document.dispatchEvent(new CustomEvent('asdh:real-load-complete'));
      }
      if(CU&&(CU.master===true||['pharmacy','pharmacy_director'].indexOf(CU.role)>=0)){
        try{
          var previousUsers=S.cache.users||[];
          var users=await S.loadUsers();
          var usersChanged=!stateValueEqual(previousUsers,users||[]);
          var active=document.querySelector('.pg.on');
          if(usersChanged&&active&&active.id==='pg-users')S.scheduleRefresh();
        }catch(usersError){
          console.warn('REST user polling was unavailable.',usersError);
        }
      }
    }catch(error){
      console.warn('REST Floor Stock polling failed.',error);
    }finally{
      S.pollBusy=false;
    }
  },
  stopRealtime:function(){
    if(Array.isArray(S.scopedUnsubs)){S.scopedUnsubs.forEach(function(fn){try{fn()}catch(e){}});S.scopedUnsubs=null;}
    if(S.stateUnsub){S.stateUnsub();S.stateUnsub=null;}
    if(Array.isArray(S.collectionUnsubs)){S.collectionUnsubs.forEach(function(fn){try{fn()}catch(e){}});S.collectionUnsubs=null;S.__collectionRowsById={};}
    if(S.selfProfileUnsub){S.selfProfileUnsub();S.selfProfileUnsub=null;}
    if(S.usersUnsub){S.usersUnsub();S.usersUnsub=null;}
    if(S.usersPollTimer){clearInterval(S.usersPollTimer);S.usersPollTimer=null;}
    if(S.refreshTimer){clearTimeout(S.refreshTimer);S.refreshTimer=null;}
    if(S.pollTimer){clearInterval(S.pollTimer);S.pollTimer=null;}
    // The fallback poll only exists while a collection listener is down; a new
    // session installs its own listeners and must not inherit the old one's.
    if(S.__collectionRestFallbackTimer){clearInterval(S.__collectionRestFallbackTimer);S.__collectionRestFallbackTimer=null;}
    S.pollBusy=false;
  },
  scheduleRefresh:function(){
    if(!S.ready||!CU)return;
    if(S.refreshTimer)clearTimeout(S.refreshTimer);
    S.refreshTimer=setTimeout(function(){
      S.refreshTimer=null;
      // The warm-boot path (see init()) opens the app instantly from a
      // localStorage snapshot taken during a PREVIOUS session, then corrects
      // it once the realtime listener's fresh data arrives. That snapshot was
      // only ever written once, at cold boot, so every later login kept
      // replaying the same stale numbers (e.g. a department count off by
      // however many departments changed since that first cache write) until
      // the realtime listener silently fixed it in memory a moment later.
      // Refresh the on-disk snapshot here too so it stays correct going
      // forward and this flicker doesn't repeat on every subsequent login.
      S.persistLocalCache();
      if(document.visibilityState==='visible')refreshCurrentPage();
    },450);
  },
  /* A month-partitioned key has no single document: its rows live across
     <key>_gYYYY-MM or <key>_hYYYY-MM. Reading and writing are routed here rather
     than at each of the call sites, so everything that already said
     S.g('requests') or S.s('requests', rows) keeps working untouched.

     Routing only switches on once the legacy document is gone, which the
     migration does as its last step — so there is never a half-migrated state
     with some rows in the old document and some in the partitions. */
  g:function(k){
    if(partitionsAreLive(k))return monthPartitionRows(k);
    /* A value too large for one document is written across <key>, <key>_p2, …
       and rejoined here, so no reader knows or cares that it was split. */
    if(hasOverflowParts(k))return joinOverflowParts(k);
    return Object.prototype.hasOwnProperty.call(S.cache,k)?S.cache[k]:null;
  },
  s:function(k,v){
    if(partitionsAreLive(k)){
      // Writes only the months that actually changed, instead of rewriting every
      // row the key has ever held.
      var partitioned=applyPartitionedArray(k,v).catch(function(error){
        console.error('Partitioned save failed for key:',k,error);
        toast('Save failed — '+String(error&&error.message||error),'err');
        throw error;
      });
      return _trackSave(partitioned,'floorstock_state/'+k+' (by month)');
    }
    /* Anything that would not fit in one document is written across numbered
       parts instead of being refused. This is the general form of what month
       partitioning does for dated records: no state key has a ceiling, so
       "the record filled up and everything stopped" cannot happen to a key
       nobody thought to handle in advance. */
    if(v!==null&&typeof v==='object'&&(hasOverflowParts(k)||estimateDocBytes(v)>OVERFLOW_SPLIT_BYTES)){
      var spread=writeWithOverflow(k,v,function(docId,chunk){
        S.cache[docId]=chunk;
        return fsStateSetSmart(docId,chunk);
      }).catch(function(error){
        console.error('Overflow save failed for key:',k,error);
        toast('Save failed — '+String(error&&error.message||error),'err');
        throw error;
      });
      return _trackSave(spread,'floorstock_state/'+k+' (split)');
    }
    var prev=Object.prototype.hasOwnProperty.call(S.cache,k)?S.cache[k]:undefined;
    S.cache[k]=v;
    var write=fsStateSetSmart(k,v).catch(function(error){
      if(prev===undefined)delete S.cache[k];else S.cache[k]=prev;
      console.error('Persistent save failed for key:',k,error);
      /* Each key is one Firestore document, capped at 1MiB, and an array-shaped key
         such as requests grows with use until a write is simply refused. The raw
         rejection says nothing a pharmacist can act on, so a payload at or near the
         cap is reported as what it is, with the action that fixes it. The write is
         never blocked pre-emptively — Firestore decides, this only explains it. */
      var hint='';
      try{
        var bytes=estimateDocBytes(v);
        if(bytes>=0.9*1048576){
          /* Reaching this now means the split above did not run — a value with no
             seam to split on, such as a single oversized field. Naming the record
             and its size is the actionable part; the old text sent every such
             failure to the Requests page whatever the record was. */
          hint=' The '+k+' record is '+(bytes/1048576).toFixed(2)+' MB and cannot be divided into smaller documents.'
            +' Open System Health to see it and what can be archived.'
            +'\nسجل '+k+' تجاوز حد المستند ولا يمكن تقسيمه. افتح System Health لمعرفة ما يمكن أرشفته.';
        }
      }catch(sizeError){}
      toast('Save failed — Firebase rejected the update.'+hint,'err');
      throw error;
    });
    return _trackSave(write,'floorstock_state/'+k);
  },
  rm:function(k){
    var prev=Object.prototype.hasOwnProperty.call(S.cache,k)?S.cache[k]:undefined;
    delete S.cache[k];
    var write=fsStateDeleteSmart(k).catch(function(error){
      if(prev!==undefined)S.cache[k]=prev;
      console.error('Persistent delete failed for key:',k,error);
      toast('Delete failed — Firebase rejected the update.','err');
      throw error;
    });
    return _trackSave(write,'delete floorstock_state/'+k);
  },
  push:function(k,v){
    v=Object.assign({},v||{});v.id=v.id||'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    var a=(S.g(k)||[]).slice();a.push(v);
    return S.s(k,a).then(function(){return v;});
  },
  upd:function(k,id,d){
    var a=(S.g(k)||[]).slice(),i=a.findIndex(function(x){return String(x.id)===String(id);});
    if(i<0)return Promise.resolve(false);
    a[i]=Object.assign({},a[i],d||{});
    return S.s(k,a).then(function(){return true;});
  },
  del:function(k,id){
    var a=(S.g(k)||[]).filter(function(x){return String(x.id)!==String(id);});
    return S.s(k,a).then(function(){return true;});
  }
};
globalThis._publicSyncWarningAt = 0;
function warnPublicSync(scope,error){
  console.error((scope||'Public QR')+' sync failed',error);
  var currentRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  if(currentRole==='department')return;
  var now=Date.now();if(now-_publicSyncWarningAt<12000)return;_publicSyncWarningAt=now;
  if(typeof toast==='function')toast((scope||'Data')+' was saved, but the public QR view could not be refreshed.','info');
}

async function syncPublicExpiry(deptId,rows){
  deptId=String(deptId||'').trim();
  if(!deptId)throw new Error('Department ID is required for public expiry sync.');
  if(!window.FB_DB||!window.FB_AUTH||!FB_AUTH.currentUser)return false;

  var medicines=typeof getMeds==='function'?(getMeds(deptId)||[]):[];
  var medicineById={};
  medicines.forEach(function(medicine){
    if(medicine&&medicine.id!=null){
      medicineById[String(medicine.id)]=medicine;
    }
  });

  var batches=(Array.isArray(rows)?rows:[]).map(function(row){
    row=row||{};
    var medicine=medicineById[String(row.medId||'')]||{};
    return {
      medication:medicine.name||row.medication||row.name||'',
      date:String(row.date||row.expiry||''),
      qty:row.qty==null?'':Number(row.qty),
      // Classification flags travel with the batch so the public Expiry Monitor
      // can colour its rows. It previously received only name/date/qty and had
      // nothing to colour by. Booleans are normalised because the monitor is a
      // no-login reader that cannot look the medicine up.
      highAlert:!!medicine.high_alert,
      lasa:!!medicine.lasa,
      hazard:!!medicine.hazard,
      refrigerated:!!medicine.refrigerated,
      outOfStock:!!medicine.outOfStock,
      // Drawer ids and names travel too, so the public monitor can be opened for
      // one drawer without needing to read the department's private shelf list.
      shelfIds:(typeof window.fsMedShelfIds==='function'?window.fsMedShelfIds(medicine):(medicine.shelfId?[String(medicine.shelfId)]:[])),
      shelfNames:(function(){
        var ids=(typeof window.fsMedShelfIds==='function'?window.fsMedShelfIds(medicine):(medicine.shelfId?[String(medicine.shelfId)]:[]));
        var all=(typeof getShelves==='function'?(getShelves(deptId)||[]):[]);
        return ids.map(function(sid){
          var sh=all.find(function(x){return String(x.id)===String(sid)});
          return sh&&sh.name?String(sh.name):String(sid);
        });
      })()
    };
  });

  var department=(typeof gd==='function'?(gd()||[]):[]).find(function(item){
    return String(item&&item.id)===deptId;
  })||{};

  var updatedAt=window.firebase&&firebase.firestore&&
    firebase.firestore.FieldValue
    ?firebase.firestore.FieldValue.serverTimestamp()
    :new Date().toISOString();

  await (window.fsTenantCollection?fsTenantCollection('public_expiry'):FB_DB.collection('public_expiry')).doc(deptId).set({
    departmentId:deptId,
    departmentName:department.name||
      (window.CU&&String(CU.deptId)===deptId?CU.deptName:'')||
      deptId,
    batches:batches,
    updatedAt:updatedAt
  },{merge:false});

  return true;
}

// ── DATE HELPERS ─────────────────────────────────────────
// Always Gregorian numeric format: DD/MM/YYYY
function fmtDate(iso){
  if(!iso)return '—';
  var d=new Date(iso);
  if(isNaN(d))return iso;
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function fmtDateTime(iso){
  if(!iso)return '—';
  var d=new Date(iso);
  if(isNaN(d))return iso;
  return d.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function daysUntil(iso){return window.fsDaysUntil?window.fsDaysUntil(iso):null}
function todayISO(){return new Date().toISOString().slice(0,10)}
function nowISO(){return window.fsNowISO?window.fsNowISO():new Date().toISOString()}


const __asdhLegacyApi = {
  ensureFirebaseFunctions: ensureFirebaseFunctions,
  ensureCallableAuth: ensureCallableAuth,
  fsCallableUrl: fsCallableUrl,
  fsCallFunction: fsCallFunction,
  hasPendingRequestDraft: hasPendingRequestDraft,
  initFirebase: initFirebase,
  waitForFirebase: waitForFirebase,
  _trackSave: _trackSave,
  fsStateToken: fsStateToken,
  fsStateCollectionPath: fsStateCollectionPath,
  fsStateSdkCollection: fsStateSdkCollection,
  fsStateRestRequest: fsStateRestRequest,
  fsStateRestListCollection: fsStateRestListCollection,
  fsStateLoadFloorstockViaRest: fsStateLoadFloorstockViaRest,
  fsIsPharmacyScopedProfile: fsIsPharmacyScopedProfile,
  fsStateKeysForProfile: fsStateKeysForProfile,
  fsStateLoadDocumentViaRest: fsStateLoadDocumentViaRest,
  fsStateLoadDocumentViaSdk: fsStateLoadDocumentViaSdk,
  fsStateLoadCollectionViaRest: fsStateLoadCollectionViaRest,
  fsStateMergeCollectionKeys: fsStateMergeCollectionKeys,
  fsStateScopeCacheForProfile: fsStateScopeCacheForProfile,
  fsStateLoadScoped: fsStateLoadScoped,
  fsControlledPharmacyDeptKeys: fsControlledPharmacyDeptKeys,
  fsStateLoadControlledPharmacyScoped: fsStateLoadControlledPharmacyScoped,
  fsPharmacyDepartmentStateKeys: fsPharmacyDepartmentStateKeys,
  fsStateLoadPharmacyScoped: fsStateLoadPharmacyScoped,
  fsStateLoadFloorstockForProfileViaRest: fsStateLoadFloorstockForProfileViaRest,
  fsStateLoadFloorstockForProfileViaSdk: fsStateLoadFloorstockForProfileViaSdk,
  fsStateLoadUsersViaRest: fsStateLoadUsersViaRest,
  fsStateLoadFloorstockViaSdk: fsStateLoadFloorstockViaSdk,
  fsHydrateDepartmentDirectoryForLogin: fsHydrateDepartmentDirectoryForLogin,
  fsStateLoadUsersViaSdk: fsStateLoadUsersViaSdk,
  fsStateLoadUsersViaCallable: fsStateLoadUsersViaCallable,
  fsStateIsLegacyMasterProfile: fsStateIsLegacyMasterProfile,
  fsStateLoadLegacyUserDirectory: fsStateLoadLegacyUserDirectory,
  fsStateFirstSuccess: fsStateFirstSuccess,
  fsStateRestSetDocument: fsStateRestSetDocument,
  fsStateRestDeleteDocument: fsStateRestDeleteDocument,
  fsStateSdkSetDocument: fsStateSdkSetDocument,
  fsStateSdkDeleteDocument: fsStateSdkDeleteDocument,
  fsStateSetSmart: fsStateSetSmart,
  fsStateDeleteSmart: fsStateDeleteSmart,
  fsStateApplyCache: fsStateApplyCache,
  fsStateScheduleManagedUserLoad: fsStateScheduleManagedUserLoad,
  warnPublicSync: warnPublicSync,
  syncPublicExpiry: syncPublicExpiry,
  fmtDate: fmtDate,
  fmtDateTime: fmtDateTime,
  daysUntil: daysUntil,
  todayISO: todayISO,
  nowISO: nowISO,
  FB_APP: globalThis.FB_APP,
  FB_AUTH: globalThis.FB_AUTH,
  FB_DB: globalThis.FB_DB,
  FB_FUNCTIONS: globalThis.FB_FUNCTIONS,
  FB_APPCHECK: globalThis.FB_APPCHECK,
  _lazyScripts: globalThis._lazyScripts,
  renderInvDebounced: globalThis.renderInvDebounced,
  renderReqFormDebounced: globalThis.renderReqFormDebounced,
  renderControlledDebounced: globalThis.renderControlledDebounced,
  _firebasePersistenceAttempted: globalThis._firebasePersistenceAttempted,
  _firebaseReadyPromise: globalThis._firebaseReadyPromise,
  _pendingWrites: globalThis._pendingWrites,
  _trackedSaves: globalThis._trackedSaves,
  _lastSaveFailure: globalThis._lastSaveFailure,
  fsTenantId: globalThis.fsTenantId,
  DEPARTMENT_SHARED_STATE_KEYS: globalThis.DEPARTMENT_SHARED_STATE_KEYS,
  PHARMACY_SCOPED_STATE_KEYS: globalThis.PHARMACY_SCOPED_STATE_KEYS,
  CONTROLLED_PHARMACY_BASE_KEYS: globalThis.CONTROLLED_PHARMACY_BASE_KEYS,
  WAREHOUSE_STATE_KEYS: globalThis.WAREHOUSE_STATE_KEYS,
  S: globalThis.S,
  _publicSyncWarningAt: globalThis._publicSyncWarningAt,
  FS_R17_MED_MIGRATION_PENDING: globalThis.FS_R17_MED_MIGRATION_PENDING,
  FS_R18_EXPIRY_MIGRATION_PENDING: globalThis.FS_R18_EXPIRY_MIGRATION_PENDING,
  _gdRawRef: globalThis._gdRawRef,
  _gdDeletedRef: globalThis._gdDeletedRef,
  _gdFiltered: globalThis._gdFiltered,
  _deletedDeptRepairBusy: globalThis._deletedDeptRepairBusy,
  MEDS: globalThis.MEDS,
  esc: globalThis.esc,
  CU: globalThis.CU,
  RFS: globalThis.RFS,
  EDID: globalThis.EDID,
  FRID: globalThis.FRID,
  IROWS: globalThis.IROWS,
  SROLE: globalThis.SROLE,
  fsLoginTimeout: globalThis.fsLoginTimeout,
  logoutBusy: globalThis.logoutBusy,
  CTL_VIEW: globalThis.CTL_VIEW
};
publishLegacy("03-core-application-firebase-state-auth.js", __asdhLegacyApi);
export {
  ensureFirebaseFunctions,
  ensureCallableAuth,
  fsCallableUrl,
  fsCallFunction,
  hasPendingRequestDraft,
  initFirebase,
  waitForFirebase,
  _trackSave,
  fsStateToken,
  fsStateCollectionPath,
  fsStateSdkCollection,
  fsStateRestRequest,
  fsStateRestListCollection,
  fsStateLoadFloorstockViaRest,
  fsIsPharmacyScopedProfile,
  fsStateKeysForProfile,
  fsStateLoadDocumentViaRest,
  fsStateLoadDocumentViaSdk,
  fsStateLoadCollectionViaRest,
  fsStateMergeCollectionKeys,
  fsStateScopeCacheForProfile,
  fsStateLoadScoped,
  fsControlledPharmacyDeptKeys,
  fsStateLoadControlledPharmacyScoped,
  fsPharmacyDepartmentStateKeys,
  fsStateLoadPharmacyScoped,
  fsStateLoadFloorstockForProfileViaRest,
  fsStateLoadFloorstockForProfileViaSdk,
  fsStateLoadUsersViaRest,
  fsStateLoadFloorstockViaSdk,
  fsHydrateDepartmentDirectoryForLogin,
  fsStateLoadUsersViaSdk,
  fsStateLoadUsersViaCallable,
  fsStateIsLegacyMasterProfile,
  fsStateLoadLegacyUserDirectory,
  fsStateFirstSuccess,
  fsStateRestSetDocument,
  fsStateRestDeleteDocument,
  fsStateSdkSetDocument,
  fsStateSdkDeleteDocument,
  fsStateSetSmart,
  fsStateDeleteSmart,
  fsStateApplyCache,
  fsStateScheduleManagedUserLoad,
  warnPublicSync,
  syncPublicExpiry,
  fmtDate,
  fmtDateTime,
  daysUntil,
  todayISO,
  nowISO,
};
export const legacyVariableNames = Object.freeze(["FB_APP", "FB_AUTH", "FB_DB", "FB_FUNCTIONS", "FB_APPCHECK", "_lazyScripts", "renderInvDebounced", "renderReqFormDebounced", "renderControlledDebounced", "_firebasePersistenceAttempted", "_firebaseReadyPromise", "_pendingWrites", "_trackedSaves", "_lastSaveFailure", "fsTenantId", "DEPARTMENT_SHARED_STATE_KEYS", "PHARMACY_SCOPED_STATE_KEYS", "CONTROLLED_PHARMACY_BASE_KEYS", "WAREHOUSE_STATE_KEYS", "S", "_publicSyncWarningAt", "FS_R17_MED_MIGRATION_PENDING", "FS_R18_EXPIRY_MIGRATION_PENDING", "_gdRawRef", "_gdDeletedRef", "_gdFiltered", "_deletedDeptRepairBusy", "MEDS", "esc", "CU", "RFS", "EDID", "FRID", "IROWS", "SROLE", "fsLoginTimeout", "logoutBusy", "CTL_VIEW"]);
export default __asdhLegacyApi;

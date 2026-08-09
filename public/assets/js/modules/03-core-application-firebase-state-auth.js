import { publishLegacy } from '../core/legacy-registry.js';
import { normalizeRole, hasCapability, canAccessDepartment } from '../core/role-capabilities.js?v=R6.76.7';
import {
  FULFILLMENT_EDIT_SETTINGS_KEY,
  canEditFulfillment,
  fulfillmentEditReason,
} from '../core/fulfillment-edit-policy.js?v=R6.76.0';

// ── FIREBASE / FIRESTORE ─────────────────────────────────
// Firebase web configuration is intentionally public; access is protected by Firebase Auth and Firestore rules.
globalThis.FIREBASE_CONFIG = {apiKey:"AIzaSyBlcFhBTaJ9so8MlCLa_JTtUpQxCbEwuzU",authDomain:"floorstock-6ac2d.firebaseapp.com",projectId:"floorstock-6ac2d",storageBucket:"floorstock-6ac2d.firebasestorage.app",messagingSenderId:"920762414422",appId:"1:920762414422:web:8d6dbc7069d4088defd2f7",measurementId:"G-61NRS4WT8Q"};
var FB_APP=window.FB_APP||null;
var FB_AUTH=window.FB_AUTH||null;
var FB_DB=window.FB_DB||null;
var FB_FUNCTIONS=window.FB_FUNCTIONS||null;
var FB_APPCHECK=window.FB_APPCHECK||null;
// Global Firebase handles for injected modules and Safari/WebKit compatibility
window.FB_APP=null;
window.FB_AUTH=null;
window.FB_DB=null;
window.FB_FUNCTIONS=null;
window.FB_APPCHECK=null;
globalThis._lazyScripts = {};
function loadScriptOnce(key,src,test){
  if(test&&test())return Promise.resolve();
  if(_lazyScripts[key])return _lazyScripts[key];
  _lazyScripts[key]=new Promise(function(resolve,reject){
    var sc=document.createElement('script');sc.src=src;sc.async=true;
    sc.onload=function(){resolve()};sc.onerror=function(){delete _lazyScripts[key];reject(new Error(key+' library failed to load'))};
    document.head.appendChild(sc);
  });
  return _lazyScripts[key];
}
function ensurePDFJS(){return loadScriptOnce('PDF','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',function(){return typeof pdfjsLib!=='undefined'}).then(function(){if(pdfjsLib&&pdfjsLib.GlobalWorkerOptions)pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return pdfjsLib})}
function ensureZXing(){return loadScriptOnce('Barcode scanner','https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js',function(){return typeof ZXing!=='undefined'})}
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
function debounce(fn,wait){var t;return function(){var a=arguments,c=this;clearTimeout(t);t=setTimeout(function(){fn.apply(c,a)},wait)}}
globalThis.renderInvDebounced = debounce(function(){renderInv()},220);
globalThis.renderReqFormDebounced = debounce(function(){renderReqForm()},220);
globalThis.renderControlledDebounced = debounce(function(){renderControlled()},220);
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
  try{
    if(FB_DB&&typeof FB_DB.settings==='function'){
      FB_DB.settings({
        experimentalAutoDetectLongPolling:true,
        useFetchStreams:false,
        ignoreUndefinedProperties:true
      });
    }
  }catch(settingsError){
    console.warn('Firestore transport settings could not be applied.',settingsError);
  }
  window.FB_APP=FB_APP;
  window.FB_AUTH=FB_AUTH;
  window.FB_DB=FB_DB;
  if(!_firebasePersistenceAttempted&&FB_DB&&typeof FB_DB.enablePersistence==='function'){
    _firebasePersistenceAttempted=true;
    FB_DB.enablePersistence({synchronizeTabs:true}).then(function(){
    }).catch(function(err){
      var code=err&&err.code||'unknown';
      if(code==='failed-precondition')console.warn('Firestore offline cache is unavailable because another tab owns persistence. Online operation continues normally.');
      else if(code==='unimplemented')console.warn('Firestore offline cache is not supported by this browser. Online operation continues normally.');
      else console.warn('Firestore offline cache could not be enabled. Online operation continues normally.',err);
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
function stateValueEqual(a,b){if(a===b)return true;try{return JSON.stringify(a)===JSON.stringify(b)}catch(e){return false}}
function fsStateRestEncode(value){
  if(value===null||value===undefined)return {nullValue:null};
  if(value instanceof Date)return {timestampValue:value.toISOString()};
  var type=typeof value;
  if(type==='string')return {stringValue:value};
  if(type==='boolean')return {booleanValue:value};
  if(type==='number'){
    if(!isFinite(value))return {nullValue:null};
    return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  }
  if(Array.isArray(value))return {arrayValue:{values:value.map(fsStateRestEncode)}};
  if(type==='object'){
    var fields={};
    Object.keys(value).forEach(function(key){
      if(value[key]!==undefined)fields[key]=fsStateRestEncode(value[key]);
    });
    return {mapValue:{fields:fields}};
  }
  return {stringValue:String(value)};
}
async function fsStateToken(forceRefresh){
  if(!FB_AUTH||!FB_AUTH.currentUser)throw new Error('The authenticated Firebase session is unavailable.');
  return fsLoginTimeout(
    FB_AUTH.currentUser.getIdToken(!!forceRefresh),
    10000,
    'Firebase data-access token timed out.'
  );
}
function fsStateRestBase(){
  return 'https://firestore.googleapis.com/v1/projects/'+
    encodeURIComponent(FIREBASE_CONFIG.projectId)+
    '/databases/(default)/documents';
}
function fsTenantId(profile){return String(profile&&profile.tenantId||'').trim()}
function fsStateCollectionPath(profile){var tenantId=fsTenantId(profile||(globalThis.S&&S.scopeProfile));return tenantId?'tenants/'+tenantId+'/state':'floorstock_state'}
function fsRestPath(path){return String(path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function fsStateSdkCollection(profile){var tenantId=fsTenantId(profile||(globalThis.S&&S.scopeProfile));return tenantId?FB_DB.collection('tenants').doc(tenantId).collection('state'):FB_DB.collection('floorstock_state')}
window.fsTenantId=function(){var profileId=fsTenantId(window.CU||(globalThis.S&&S.scopeProfile));if(profileId)return profileId;try{return String(new URLSearchParams(location.search).get('tenant')||'').trim()}catch(e){return ''}};
window.fsTenantCollection=function(name){var tenantId=window.fsTenantId();return tenantId?FB_DB.collection('tenants').doc(tenantId).collection(name):FB_DB.collection(name)};
async function fsStateRestRequest(url,options,timeoutMs){
  var token=await fsStateToken(false);
  options=options||{};
  options.headers=Object.assign({},options.headers||{},{
    'Authorization':'Bearer '+token,
    'Content-Type':'application/json'
  });
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
var DEPARTMENT_SHARED_STATE_KEYS=Object.freeze([
  'departments','deleted_departments','custom_categories','daily_limits_v2',
  'weekly_limits_v2','monthly_limits','rate_limits_v2','req_windows','disp_slots',
  'request_count_limits_v1','request_hour_grids_v1','requests','dept_notes','notes',
  'fulfillment_edit_settings_v1',
  'crash_carts','crash_cart_reports',
  'theme','facility_logo','pharmacy_category_config','pharmacy_department_announcements',
  'pharmacy_department_expiry_rules','medication_freeze_rules_v3','medication_visibility_rules_v3'
]);
function fsStateKeysForProfile(profile){
  if(!profile||profile.role!=='department')return null;
  var keys=DEPARTMENT_SHARED_STATE_KEYS.slice(),deptId=String(profile.deptId||profile.departmentId||'').trim();
  if(deptId){
    ['meds_','expiry_','shelves_','alerts_','inventory_integrity_','inventory_snapshot_index_'].forEach(function(prefix){keys.push(prefix+deptId)});
    if(profile.controlledCustodian===true){
      ['controlled_dept_list_','controlled_dept_shelves_','controlled_settings_'].forEach(function(prefix){keys.push(prefix+deptId)});
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
  if(!profile||profile.role!=='department')return cache;
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
async function fsStateLoadScoped(keys,loader,source,profile){
  var values=await Promise.all(keys.map(function(key){return loader(key)})),cache={};
  keys.forEach(function(key,index){if(values[index]!==null&&values[index]!==undefined)cache[key]=values[index]});
  if(profile&&profile.role==='department')Object.defineProperty(cache,'__scopedDepartmentState',{value:true,enumerable:false,configurable:true});
  return {cache:fsStateScopeCacheForProfile(cache,profile),source:source};
}
function fsStateLoadFloorstockForProfileViaRest(profile){
  var keys=fsStateKeysForProfile(profile);
  return keys?fsStateLoadScoped(keys,fsStateLoadDocumentViaRest,'rest-scoped',profile):fsStateLoadFloorstockViaRest();
}
function fsStateLoadFloorstockForProfileViaSdk(profile){
  var keys=fsStateKeysForProfile(profile);
  return keys?fsStateLoadScoped(keys,fsStateLoadDocumentViaSdk,'sdk-scoped',profile):fsStateLoadFloorstockViaSdk();
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
  var functionsService=await ensureFirebaseFunctions();
  var result=await fsLoginTimeout(functionsService.httpsCallable('listManagedUsers')({}),10000,'User service timed out.');
  return result&&result.data&&Array.isArray(result.data.users)?result.data.users:[];
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
async function fsStateSetSmart(key,value){
  if(S.writeTransport==='rest'||!window.FB_DB)return fsStateRestSetDocument(key,value);
  try{
    return await fsStateSdkSetDocument(key,value);
  }catch(error){
    console.warn('Firestore SDK save failed; using REST for subsequent writes.',error);
    S.writeTransport='rest';
    return fsStateRestSetDocument(key,value);
  }
}
async function fsStateDeleteSmart(key){
  if(S.writeTransport==='rest'||!window.FB_DB)return fsStateRestDeleteDocument(key);
  try{
    return await fsStateSdkDeleteDocument(key);
  }catch(error){
    console.warn('Firestore SDK delete failed; using REST for subsequent writes.',error);
    S.writeTransport='rest';
    return fsStateRestDeleteDocument(key);
  }
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

globalThis.S = {
  cache:{},ready:false,stateUnsub:null,usersUnsub:null,usersPollTimer:null,refreshTimer:null,pollTimer:null,pollBusy:false,transport:'unknown',writeTransport:'sdk',scopeProfile:null,
  init:async function(statusCallback,profileHint){
    S.stopRealtime();
    S.scopeProfile=profileHint||null;
    var cacheUid=String(profileHint&&profileHint.uid||FB_AUTH&&FB_AUTH.currentUser&&FB_AUTH.currentUser.uid||'').trim();
    var cacheKey=cacheUid?'floorstock_last_cache_v2_'+cacheUid:'';
    // The v1 key was shared across accounts and could expose a previous session's state.
    try{
      localStorage.removeItem('floorstock_last_cache_v1');
      Object.keys(localStorage).forEach(function(key){
        if(key.indexOf('floorstock_last_cache_v2_')===0&&key!==cacheKey)localStorage.removeItem(key);
      });
    }catch(removeError){}
    try{
      var cached=cacheKey?localStorage.getItem(cacheKey):null;
      if(cached){
        var parsed=JSON.parse(cached),allowed=fsStateKeysForProfile(profileHint);
        if(allowed){
          var allowedSet=new Set(allowed),scoped={};
          Object.keys(parsed||{}).forEach(function(key){if(allowedSet.has(key))scoped[key]=parsed[key]});
          parsed=scoped;
        }
        S.cache=fsStateScopeCacheForProfile(parsed||{},profileHint);
        S.cache.users=[];
        S.ready=true;
      }
    }catch(e){
      console.warn('Local Floor Stock cache unavailable.',e);
    }
    if(statusCallback)statusCallback('Loading data… / جاري تحميل البيانات…');

    var result;
    try{
      result=await fsLoginTimeout(
        fsStateLoadFloorstockForProfileViaRest(profileHint),
        9000,
        'Floor Stock REST data request timed out.'
      );
    }catch(restError){
      console.warn('Primary Floor Stock REST load failed; trying Firestore SDK.',restError);
      result=await fsLoginTimeout(
        fsStateLoadFloorstockForProfileViaSdk(profileHint),
        9000,
        'Floor Stock SDK data request timed out.'
      );
    }

    var freshCache=result.cache||{};

S.cache=freshCache;
S.transport=result.source||'rest';
S.writeTransport=window.FB_DB?'sdk':'rest';
S.cache.users=S.cache.users||[];
S.ready=true;

    // Save only this authenticated account's already permission-scoped state.
    try{
      if(cacheKey)localStorage.setItem(cacheKey,JSON.stringify(freshCache));
    }catch(e){
      console.warn('Could not save Floor Stock cache.',e);
    }
    S.startRealtime();setTimeout(function(){
  if(typeof S.pollRest==='function'){
    S.pollRest();
  }
},1000);

    setTimeout(function(){
      if(typeof window.renderRequestHourGridUI==='function'){
        window.renderRequestHourGridUI();
      }
    },0);

    var role=profileHint&&profileHint.role||'';
    var shouldLoadUsers=!!(profileHint&&profileHint.master===true)||role==='pharmacy'||role==='pharmacy_director';
    if(shouldLoadUsers)setTimeout(function(){
      if(!S.ready)return;
      S.loadUsers().then(function(users){
        S.cache.users=users||[];
        var active=document.querySelector('.pg.on');
        if(active&&active.id==='pg-users')S.scheduleRefresh();
      }).catch(function(error){
        console.warn('Background user-list load was unavailable.',error);
      });
    },0);

    if(statusCallback)statusCallback('Opening Floor Stock…');
    return true;
  },
  loadUsers:async function(){
    var users=await fsStateFirstSuccess([
      fsStateLoadUsersViaCallable(),
      fsStateLoadUsersViaRest(),
      fsStateLoadUsersViaSdk()
    ],'Loading users');
    S.cache.users=users||[];
    return S.cache.users;
  },
  startRealtime:function(){
    S.stopRealtime();
    if(!S.ready)return;

    if(S.transport==='sdk'){
      try{
        S.stateUnsub=fsStateSdkCollection().onSnapshot(function(snapshot){
          var changed=false;
          snapshot.docChanges().forEach(function(change){
            if(change.doc.id==='users')return;
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
        var tenantId=fsTenantId(S.scopeProfile),canManageUsers=!!(S.scopeProfile&&(S.scopeProfile.master===true||['pharmacy','pharmacy_director'].indexOf(S.scopeProfile.role)>=0));
        if(canManageUsers&&tenantId){
          S.usersUnsub=FB_DB.collection('users').where('tenantId','==',tenantId).onSnapshot(function(snapshot){
            var nextUsers=snapshot.docs.map(function(doc){return Object.assign({id:doc.id},doc.data());});
            var changed=!stateValueEqual(S.cache.users||[],nextUsers);S.cache.users=nextUsers;
            var active=document.querySelector('.pg.on');if(changed&&active&&active.id==='pg-users')S.scheduleRefresh();
          },function(error){console.warn('users realtime error; the state listener remains active.',error);});
        }else if(canManageUsers){
          S.usersPollTimer=setInterval(function(){S.loadUsers().catch(function(error){console.warn('User-list refresh was unavailable.',error)})},30000);
        }
        return;
      }catch(error){
        console.error('Firestore realtime setup failed; switching to REST polling.',error);
        S.transport='rest';
      }
    }

    S.pollTimer=setInterval(function(){S.pollRest();},30000);
  },
  pollRest:async function(){
    if(S.pollBusy||!S.ready||document.visibilityState==='hidden')return;
    S.pollBusy=true;
    try{
      var state=await fsStateLoadFloorstockForProfileViaRest(S.scopeProfile);
      var changed=fsStateApplyCache(state.cache||{});
      if(changed)S.scheduleRefresh();
      if(CU&&(CU.master===true||['pharmacy','pharmacy_director'].indexOf(CU.role)>=0)){
        try{
          var users=await fsStateLoadUsersViaCallable();
          var usersChanged=!stateValueEqual(S.cache.users||[],users);
          S.cache.users=users;
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
    if(S.stateUnsub){S.stateUnsub();S.stateUnsub=null;}
    if(S.usersUnsub){S.usersUnsub();S.usersUnsub=null;}
    if(S.usersPollTimer){clearInterval(S.usersPollTimer);S.usersPollTimer=null;}
    if(S.refreshTimer){clearTimeout(S.refreshTimer);S.refreshTimer=null;}
    if(S.pollTimer){clearInterval(S.pollTimer);S.pollTimer=null;}
    S.pollBusy=false;
  },
  scheduleRefresh:function(){
    if(!S.ready||!CU)return;
    if(S.refreshTimer)clearTimeout(S.refreshTimer);
    S.refreshTimer=setTimeout(function(){
      S.refreshTimer=null;
      if(document.visibilityState==='visible')refreshCurrentPage();
    },450);
  },
  g:function(k){return Object.prototype.hasOwnProperty.call(S.cache,k)?S.cache[k]:null},
  s:function(k,v){
    var prev=Object.prototype.hasOwnProperty.call(S.cache,k)?S.cache[k]:undefined;
    S.cache[k]=v;
    var write=fsStateSetSmart(k,v).catch(function(error){
      if(prev===undefined)delete S.cache[k];else S.cache[k]=prev;
      console.error('Persistent save failed for key:',k,error);
      toast('Save failed — Firebase rejected the update.','err');
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
      qty:row.qty==null?'':Number(row.qty)
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
// Per-dept keys: medications are stored per dept
globalThis.FS_R17_MED_MIGRATION_PENDING = {};
function fsR17Now(){return typeof nowISO==='function'?nowISO():new Date().toISOString()}
function fsR17MedNorm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function fsR17MedIdentity(v){var stop={mg:1,mcg:1,g:1,gm:1,ml:1,l:1,iu:1,unit:1,units:1,tab:1,tabs:1,tablet:1,tablets:1,cap:1,caps:1,capsule:1,capsules:1,amp:1,amps:1,ampoule:1,ampoules:1,vial:1,vials:1,bottle:1,bottles:1,bag:1,bags:1,syrup:1,solution:1,solutions:1,injection:1,injections:1,cream:1,ointment:1,drops:1,inhaler:1,inhalers:1,suppository:1,suppositories:1,oral:1,iv:1,im:1,sc:1,infusion:1,for:1,of:1};return fsR17MedNorm(v).split(/\s+/).filter(function(x){return x&&!stop[x]}).join(' ')}
function fsR17UniqueNames(values){var out=[],seen={};(values||[]).forEach(function(v){v=String(v||'').trim();var k=fsR17MedNorm(v);if(v&&k&&!seen[k]){seen[k]=1;out.push(v)}});return out}
function fsR17MedId(){return 'med_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function fsR17NormalizeMed(m,index){m=Object.assign({},m||{});m.id=String(m.id||m.medId||fsR17MedId());m.medId=m.id;m.name=String(m.name||m.currentName||'').trim();m.currentName=m.name;m.aliases=fsR17UniqueNames(m.aliases||m.previousNames||[]).filter(function(x){return fsR17MedNorm(x)!==fsR17MedNorm(m.name)});var order=Number(m.sortOrder);m.sortOrder=isFinite(order)?order:(index+1)*100;if(!m.createdAt)m.createdAt=m.created||fsR17Now();return m}
function fsR17NormalizeMeds(arr){var ids={},changed=false;var out=(Array.isArray(arr)?arr:[]).map(function(m,i){var before=JSON.stringify(m||{}),n=fsR17NormalizeMed(m,i);while(ids[n.id])n.id=n.medId=fsR17MedId();ids[n.id]=1;if(JSON.stringify(n)!==before)changed=true;return n});return {rows:out,changed:changed}}
function getMeds(deptId){var raw=S.g('meds_'+deptId)||[],n=fsR17NormalizeMeds(raw);if(n.changed&&!FS_R17_MED_MIGRATION_PENDING[deptId]){FS_R17_MED_MIGRATION_PENDING[deptId]=1;setTimeout(function(){S.s('meds_'+deptId,n.rows).catch(function(e){console.warn('Medication identity migration failed',deptId,e)}).finally(function(){delete FS_R17_MED_MIGRATION_PENDING[deptId]})},0)}return n.rows}
/* Fail closed until the authoritative R6.64 inventory safety gateway is installed. */
function setMeds(deptId,rows){var gateway=globalThis.inventorySafetySetMeds;if(typeof gateway==='function')return gateway(deptId,rows);return Promise.reject(new Error('Inventory safety gateway is not initialized.'))}
function pushMed(deptId,v){var arr=getMeds(deptId).slice(),max=arr.reduce(function(a,m){return Math.max(a,Number(m.sortOrder)||0)},0);v=fsR17NormalizeMed(Object.assign({},v||{},{id:(v&&v.id)||fsR17MedId(),sortOrder:(v&&isFinite(Number(v.sortOrder)))?Number(v.sortOrder):max+100,createdAt:(v&&v.createdAt)||fsR17Now()}),arr.length);arr.push(v);return setMeds(deptId,arr).then(function(){return v})}
function updMed(deptId,id,d){var arr=getMeds(deptId).slice(),i=arr.findIndex(function(x){return String(x.id)===String(id)});if(i<0)return Promise.resolve(false);var old=arr[i],next=Object.assign({},old,d||{},{id:old.id,medId:old.id,sortOrder:old.sortOrder,updatedAt:fsR17Now()});if(d&&d.name&&fsR17MedNorm(d.name)!==fsR17MedNorm(old.name))next.aliases=fsR17UniqueNames((old.aliases||[]).concat([old.name]));arr[i]=fsR17NormalizeMed(next,i);return setMeds(deptId,arr).then(function(){return true})}
function delMed(deptId,id){return setMeds(deptId,getMeds(deptId).filter(function(x){return String(x.id)!==String(id)}))}
function fsR17SameMedicine(a,b){if(!a||!b)return false;if(String(a.id||'')&&String(a.id||'')===String(b.id||''))return true;var namesA=[a.name].concat(a.aliases||[]),namesB=[b.name].concat(b.aliases||[]);for(var i=0;i<namesA.length;i++)for(var j=0;j<namesB.length;j++){var x=fsR17MedIdentity(namesA[i]),y=fsR17MedIdentity(namesB[j]);if(x&&y&&(x===y||(x.length>5&&y.indexOf(x)>=0)||(y.length>5&&x.indexOf(y)>=0)))return true}return false}
window.fsR17FindCorrespondingMedicine=function(source,deptId){return getMeds(deptId).find(function(m){return fsR17SameMedicine(source,m)})||null};
window.fsR17MedicationRuleFor=function(map,med,dept){if(!map||!med)return null;function applies(r){return !!(r&&(r.allDepartments===true||r.deptIds==='all'||(Array.isArray(r.departmentIds)&&r.departmentIds.map(String).indexOf(String(dept))>=0)||(Array.isArray(r.deptIds)&&r.deptIds.map(String).indexOf(String(dept))>=0)))}var direct=map['med:'+String(med.id)]||map[String(med.id)];if(direct&&applies(direct))return direct;var names=[med.name].concat(med.aliases||[]),keys=[];names.forEach(function(name){var n=fsR17MedNorm(name),i=fsR17MedIdentity(name);if(n)keys.push(n);if(i)keys.push('identity:'+i)});for(var k=0;k<keys.length;k++){var r=map[keys[k]];if(r&&applies(r))return r}return null};
window.fsR17RuleScopeLabel=function(rule){if(!rule)return '';if(rule.allDepartments===true||rule.deptIds==='all')return 'All departments';var ids=(rule.departmentIds||rule.deptIds||[]).map(String),names=ids.map(function(id){var d=(typeof gd==='function'?gd():[]).find(function(x){return String(x.id)===id});return d?d.name:id});return names.length?names.join(', '):'No department'};
window.moveDrugOrder=async function(id,deptId,dir){var all=getMeds(deptId).slice().sort(function(a,b){return Number(a.sortOrder)-Number(b.sortOrder)}),idx=all.findIndex(function(m){return String(m.id)===String(id)});if(idx<0)return;var step=dir<0?-1:1,j=idx+step;while(j>=0&&j<all.length&&all[j].category!==all[idx].category)j+=step;if(j<0||j>=all.length)return;var x=all[idx].sortOrder;all[idx].sortOrder=all[j].sortOrder;all[j].sortOrder=x;await setMeds(deptId,all);if(typeof renderInv==='function')renderInv()};
window.fsR17RefreshMedicationReferences=async function(deptId,medId,oldName,newName){var tasks=[];if(typeof getExpiry==='function'&&typeof setExpiry==='function'){var exp=getExpiry(deptId),changed=false,next=exp.map(function(x){if(String(x.medId)===String(medId)){changed=true;return Object.assign({},x,{medName:newName})}return x});if(changed)tasks.push(setExpiry(deptId,next))}if(typeof crashCarts==='function'&&typeof setCrashCarts==='function'){var carts=JSON.parse(JSON.stringify(crashCarts()||[])),cartChanged=false;carts.forEach(function(c){if(String(c.deptId)!==String(deptId))return;(c.items||[]).forEach(function(it){if(String(it.medId||'')===String(medId)||fsR17MedNorm(it.name)===fsR17MedNorm(oldName)){it.medId=medId;it.name=newName;it.genericName=newName;cartChanged=true}})});if(cartChanged)tasks.push(setCrashCarts(carts))}for(var z=0;z<2;z++){var key=z?'medication_freeze_rules_v3':'medication_visibility_rules_v3',map=Object.assign({},S.g(key)||{}),rk='med:'+medId;if(map[rk]){map[rk]=Object.assign({},map[rk],{medId:medId,name:newName,updatedAt:fsR17Now()});tasks.push(S.s(key,map))}}await Promise.all(tasks)};
window.fsR17MigrateMedicationIdentity=async function(){var depts=typeof gd==='function'?(gd()||[]):[];for(var di=0;di<depts.length;di++)await setMeds(depts[di].id,getMeds(depts[di].id));var keys=['medication_visibility_rules_v3','medication_freeze_rules_v3'];for(var ki=0;ki<keys.length;ki++){var key=keys[ki],old=Object.assign({},S.g(key)||{}),next={},changed=false;Object.keys(old).forEach(function(k){if(k.indexOf('med:')===0){next[k]=old[k];return}var rule=old[k]||{},targets=rule.allDepartments===true?depts:depts.filter(function(d){var ids=(rule.departmentIds||rule.deptIds||[]).map(String);return ids.indexOf(String(d.id))>=0});targets.forEach(function(d){getMeds(d.id).forEach(function(m){var names=[m.name].concat(m.aliases||[]),match=names.some(function(n){return fsR17MedNorm(n)===fsR17MedNorm(rule.name||k)||fsR17MedIdentity(n)===String(k).replace(/^identity:/,'')});if(match){next['med:'+m.id]=Object.assign({},rule,{medId:m.id,name:m.name,allDepartments:false,departmentIds:[d.id],deptIds:[d.id]});changed=true}})});if(!targets.length)next[k]=rule});if(changed||Object.keys(next).length!==Object.keys(old).length)await S.s(key,next)}};
function fsR17Hash(v){var h=2166136261,s=String(v||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
globalThis.FS_R18_EXPIRY_MIGRATION_PENDING = {};
function fsR18ExpiryId(){return 'ex_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9)}
function fsR17NormalizeExpiryRow(deptId,row,index,usedIds){
  row=Object.assign({},row||{});
  usedIds=usedIds||{};
  var medId=String(row.medId||row.medicationId||'');
  var date=String(row.date||row.expiry||row.expiryDate||'').slice(0,10);
  var lot=String(row.batch||row.lot||row.batchNo||row.lotNo||'').trim();
  var id=String(row.batchId||row.id||'').trim();
  if(!id||usedIds[id])id=fsR18ExpiryId();
  usedIds[id]=1;
  return Object.assign({},row,{id:id,batchId:id,medId:medId,date:date,expiry:date,batch:lot,lot:lot});
}
function fsR18NormalizeExpiryRows(deptId,rows){
  var used={},changed=false,merged={};
  var normalized=(Array.isArray(rows)?rows:[]).map(function(row,index){
    var before=JSON.stringify(row||{});
    var next=fsR17NormalizeExpiryRow(deptId,row,index,used);
    if(before!==JSON.stringify(next))changed=true;
    var key=next.medId+'|'+next.date+'|'+next.lot;
    if(merged[key]){merged[key].qty=(Number(merged[key].qty)||0)+(Number(next.qty)||0);changed=true;return null}
    merged[key]=next;return next;
  }).filter(Boolean);
  return {rows:normalized,changed:changed};
}
function fsR18ExpiryComparable(rows){
  return (rows||[]).map(function(row){
    return {
      id:String(row.id||row.batchId||''),
      medId:String(row.medId||''),
      date:String(row.date||row.expiry||'').slice(0,10),
      lot:String(row.lot||row.batch||''),
      qty:row.qty==null?'':Number(row.qty)
    };
  });
}
function getExpiry(deptId){
  var raw=S.g('expiry_'+deptId)||[];
  var normalized=fsR18NormalizeExpiryRows(deptId,raw);
  if(normalized.changed&&!FS_R18_EXPIRY_MIGRATION_PENDING[deptId]){
    FS_R18_EXPIRY_MIGRATION_PENDING[deptId]=1;
    setTimeout(function(){
      S.s('expiry_'+deptId,normalized.rows).catch(function(error){
        console.warn('Expiry ID migration failed',deptId,error);
      }).finally(function(){delete FS_R18_EXPIRY_MIGRATION_PENDING[deptId]});
    },0);
  }
  return normalized.rows;
}
async function fsR18ReadExpiry(deptId){
  var normalized=fsR18NormalizeExpiryRows(deptId,S.g('expiry_'+deptId)||[]);
  if(normalized.changed)await S.s('expiry_'+deptId,normalized.rows);
  return normalized.rows;
}
async function setExpiry(deptId,arr){
  var normalized=fsR18NormalizeExpiryRows(deptId,arr).rows;
  await S.s('expiry_'+deptId,normalized);
  var readBack=fsR18NormalizeExpiryRows(deptId,S.g('expiry_'+deptId)||[]).rows;
  if(JSON.stringify(fsR18ExpiryComparable(readBack))!==JSON.stringify(fsR18ExpiryComparable(normalized))){
    throw new Error('Primary expiry save verification failed');
  }
  try{
    if(typeof syncPublicExpiry==='function')await syncPublicExpiry(deptId,readBack);
  }catch(error){
    warnPublicSync('Expiry data',error);
  }
  return readBack;
}
async function addExpBatch(deptId,batch){
  var arr=(await fsR18ReadExpiry(deptId)).slice();
  var id=fsR18ExpiryId();
  var row=fsR17NormalizeExpiryRow(deptId,Object.assign({},batch||{},{id:id,batchId:id}),arr.length,{});
  arr.push(row);
  var savedRows=await setExpiry(deptId,arr);
  var saved=savedRows.find(function(item){return String(item.id)===id});
  if(!saved)throw new Error('Expiry record was not found after save');
  return saved;
}
async function delExpBatch(deptId,id){
  id=String(id||'');
  var before=await fsR18ReadExpiry(deptId);
  var next=before.filter(function(row){return String(row.id||row.batchId)!==id});
  if(next.length===before.length)throw new Error('Expiry record ID not found');
  var savedRows=await setExpiry(deptId,next);
  if(savedRows.some(function(row){return String(row.id||row.batchId)===id})){
    throw new Error('Expiry deletion verification failed');
  }
  return true;
}
async function updExpBatch(deptId,id,changes){
  id=String(id||'');
  var arr=(await fsR18ReadExpiry(deptId)).slice();
  var index=arr.findIndex(function(row){return String(row.id||row.batchId)===id});
  if(index<0)throw new Error('Expiry record ID not found');
  var originalId=String(arr[index].id||arr[index].batchId);
  arr[index]=fsR17NormalizeExpiryRow(
    deptId,
    Object.assign({},arr[index],changes||{},{id:originalId,batchId:originalId}),
    index,
    {}
  );
  var savedRows=await setExpiry(deptId,arr);
  var saved=savedRows.find(function(row){return String(row.id||row.batchId)===originalId});
  if(!saved)throw new Error('Expiry update verification failed');
  var expected=fsR18ExpiryComparable([arr[index]])[0];
  var actual=fsR18ExpiryComparable([saved])[0];
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('Expiry update read-back mismatch');
  return saved;
}
function getShelves(deptId){return S.g('shelves_'+deptId)||[]}
function setShelves(deptId,arr){return S.s('shelves_'+deptId,arr)}
function addShelf(deptId,v){var arr=(getShelves(deptId)||[]).slice();v=Object.assign({},v||{});v.id=v.id||'sh_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);arr.push(v);return setShelves(deptId,arr).then(function(){return v})}
function delShelf(deptId,id){return setShelves(deptId,(getShelves(deptId)||[]).filter(function(x){return String(x.id)!==String(id)}))}
function updShelf(deptId,id,d){var arr=(getShelves(deptId)||[]).slice(),i=arr.findIndex(function(x){return String(x.id)===String(id)});if(i<0)return Promise.resolve(false);arr[i]=Object.assign({},arr[i],d||{});return setShelves(deptId,arr).then(function(){return true})}
function getAlertSettings(deptId){return S.g('alerts_'+deptId)||{d1:30,d2:7}}
function setAlertSettings(deptId,obj){return S.s('alerts_'+deptId,obj)}
globalThis._gdRawRef = null;
globalThis._gdDeletedRef = null;
globalThis._gdFiltered = [];
globalThis._deletedDeptRepairBusy = false;
function gd(){var raw=S.g('departments')||[],deleted=S.g('deleted_departments')||[];if(raw!==_gdRawRef||deleted!==_gdDeletedRef){_gdRawRef=raw;_gdDeletedRef=deleted;var blocked=new Set((Array.isArray(deleted)?deleted:[]).map(function(x){return String(x)}));_gdFiltered=(Array.isArray(raw)?raw:[]).filter(function(d){return !blocked.has(String(d&&d.id))})}return _gdFiltered.slice()}
async function repairDeletedDepartments(){
  if(_deletedDeptRepairBusy)return;
  /* Tombstone cleanup rewrites the global department directory and deletes a state key.
     Only the pharmacy director / actual master may perform it; never attempt it on
     supervisor sign-in and then surface a misleading authorization toast. */
  if(!window.CU||!(CU.master===true||String(CU.role||'')==='pharmacy'))return;
  var tombs=S.g('deleted_departments')||[];
  if(!Array.isArray(tombs)||!tombs.length)return;
  _deletedDeptRepairBusy=true;
  try{
    var blocked=new Set(tombs.map(function(x){return String(x)})),raw=S.g('departments')||[],filtered=raw.filter(function(d){return !blocked.has(String(d&&d.id))});
    if(filtered.length!==raw.length)await S.s('departments',filtered);
    await S.rm('deleted_departments');
    _gdRawRef=_gdDeletedRef=null;
  }catch(e){console.warn('Deleted department migration failed',e)}
  finally{_deletedDeptRepairBusy=false}
}
function gu(){return S.g('users')||[]}
function gr(){return S.g('requests')||[]}

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

// ── SEED ─────────────────────────────────────────────────
globalThis.MEDS = [
  {n:"Acetylcysteine 2g/10ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Actilyse 50mg Syringe",c:"Injections",mn:1,mx:6,ha:1,hz:0,ls:0},
  {n:"Acyclovir 250mg Vial",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Adenosine 6mg/2ml Vial",c:"Injections",mn:5,mx:15,ha:1,hz:0,ls:0},
  {n:"Adrenaline 1mg/ml Ampoule",c:"Injections",mn:1,mx:20,ha:1,hz:0,ls:0},
  {n:"Amino Acids (Amino Plasma) 15% Infusion",c:"Injections",mn:1,mx:1,ha:0,hz:0,ls:0},
  {n:"Amino Caproic Acid 500mg/5ml Vial",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Aminophylline 25mg/1ml Ampule",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Amiodarone 50mg/ml Ampule",c:"Injections",mn:1,mx:1,ha:1,hz:0,ls:0},
  {n:"Atracurium 25mg/ml Vial",c:"Injections",mn:2,mx:10,ha:1,hz:0,ls:0},
  {n:"Atropine Sulphate 0.5mg/ml Vial",c:"Injections",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Atropine Sulphate 0.6mg/ml Vial",c:"Injections",mn:1,mx:20,ha:0,hz:0,ls:1},
  {n:"Calcium Chloride 10% Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Calcium Gluconate 10% Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Chlorpromazine 25mg/2ml Ampoule",c:"Injections",mn:1,mx:10,ha:0,hz:1,ls:0},
  {n:"Cyanocobalamin (Vit B12) 1000mcg/ml",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Dalteparin 5000UI Vial",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Desferrioxamine 500mg Vial",c:"Injections",mn:1,mx:5,ha:0,hz:1,ls:0},
  {n:"Dexamethasone 8mg/2ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Dextrose 50% Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Diazoxide 300mg/20ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Diclofenac Sodium 75mg/amp",c:"Injections",mn:3,mx:10,ha:0,hz:0,ls:0},
  {n:"Digoxin 0.5mg/2ml Ampoule",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Dimercaprol 100mg/2ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:1,ls:0},
  {n:"Dobutamine 250mg/5ml Ampoule",c:"Injections",mn:1,mx:20,ha:1,hz:0,ls:0},
  {n:"Dopamine 40mg/ml Ampoule",c:"Injections",mn:3,mx:20,ha:1,hz:0,ls:0},
  {n:"Enoxaparin 2000IU Syringe",c:"Injections",mn:3,mx:10,ha:1,hz:0,ls:0},
  {n:"Enoxaparin 4000IU Syringe",c:"Injections",mn:2,mx:10,ha:1,hz:0,ls:0},
  {n:"Enoxaparin 8000IU Syringe",c:"Injections",mn:2,mx:10,ha:1,hz:0,ls:0},
  {n:"Flumazenil 0.1mg/ml",c:"Injections",mn:3,mx:10,ha:0,hz:0,ls:0},
  {n:"Furosemide 20mg/2ml Ampoule",c:"Injections",mn:5,mx:20,ha:0,hz:0,ls:0},
  {n:"Haloperidol 50mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:1,ls:1},
  {n:"Haloperidol 5mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:1,ls:1},
  {n:"Heparin Sodium 5000UI Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Human Albumin 20% Vial",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Human Plasma Protein 5% Infusion",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Hydralazine 25mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Hydrocortisone 100mg/vial",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Hyoscine-N-Butylbromide 20mg/ml",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Immunoglobulin G Vial",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Immunoglobulin P Vial",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Insulin Glargine (Lantus) 1000IU/10ml",c:"Injections",mn:1,mx:3,ha:1,hz:0,ls:1},
  {n:"Insulin Human Mixtard 30/70 Vial",c:"Injections",mn:1,mx:3,ha:1,hz:0,ls:1},
  {n:"Insulin Human Isophane 100IU/ml",c:"Injections",mn:1,mx:3,ha:1,hz:0,ls:1},
  {n:"Insulin Human Soluble 100IU/ml",c:"Injections",mn:1,mx:3,ha:1,hz:0,ls:1},
  {n:"Iron 100mg/5ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Isoproterenol 0.2mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Labetalol 5mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:1},
  {n:"Lidocaine 1% Vial",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Lidocaine 2% Syringe",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Magnesium Sulfate 10% Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Magnesium Sulfate 50% Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Mannitol 20% in 250ml",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Methylprednisolone 40mg/ml",c:"Injections",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Methylprednisolone 500mg/vial",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Metoclopramide 10mg/2ml Ampoule",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Metoprolol 1mg/ml Ampoule",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:1},
  {n:"Metronidazole 500mg/100ml Infusion",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Naloxone 0.02mg/ml Ampoule",c:"Injections",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Naloxone 0.4mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Neostigmine 0.5mg/ml Ampoule",c:"Injections",mn:1,mx:2,ha:0,hz:0,ls:0},
  {n:"Nitroglycerin 50mg/50ml Ampoule",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Noradrenaline 2mg/ml Ampoule",c:"Injections",mn:1,mx:20,ha:1,hz:0,ls:0},
  {n:"Omeprazole 40mg Vial",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Ondansetron 4mg/2ml Ampoule",c:"Injections",mn:1,mx:15,ha:0,hz:0,ls:0},
  {n:"Pancuronium 2mg Vial",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Paracetamol 1g Infusion bottle",c:"Injections",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Phenytoin 250mg/5ml Ampoule",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Potassium Chloride 15% Vial",c:"Injections",mn:1,mx:20,ha:1,hz:0,ls:0},
  {n:"Pralidoxime Chloride 1g Vial",c:"Injections",mn:1,mx:5,ha:0,hz:1,ls:0},
  {n:"Promethazine 50mg/2ml Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:1,ls:1},
  {n:"Propofol 1% Vial",c:"Injections",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Propranolol 1mg/ml Ampoule",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:1},
  {n:"Protamine Sulphate 10mg/ml",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Reteplase Injection",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Rocuronium 50mg Vial",c:"Injections",mn:1,mx:50,ha:1,hz:0,ls:0},
  {n:"Salmo-Calcitonin 100 Unit Ampoule",c:"Injections",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Sodium Bicarbonate 8.4% Vial",c:"Injections",mn:1,mx:20,ha:1,hz:0,ls:0},
  {n:"Sodium Chloride 3% Hypertonic Vial",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Suxamethonium 100mg/ml Vial",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Tranexamic Acid 500mg/5ml Ampoule",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Vasopressin 20UI/ml Ampoule",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Verapamil 2.5mg/ml Ampoule",c:"Injections",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Vitamin K (Phytonadione) 10mg/2ml",c:"Injections",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Water for Injection 10ml Vial",c:"Injections",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Budesonide 0.5mg/2ml Nebuliser Vial",c:"Inhalers",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Ipratropium 500mcg/2ml Nebuliser Vial",c:"Inhalers",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Salbutamol 100mcg/dose Inhaler",c:"Inhalers",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Salbutamol 0.5% Solution",c:"Inhalers",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Bisacodyl 10mg Suppositories",c:"Suppositories",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Glycerin 900mg Suppositories",c:"Suppositories",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Paracetamol 500mg Suppositories",c:"Suppositories",mn:1,mx:20,ha:0,hz:0,ls:1},
  {n:"Paracetamol 125mg Suppositories",c:"Suppositories",mn:1,mx:20,ha:0,hz:0,ls:1},
  {n:"Amiodarone 200mg Tablet",c:"Tablets",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Amlodipine 5mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Aspirin 81mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Atorvastatin 20mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Baclofen 10mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Bisoprolol 5mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:1},
  {n:"Calcitriol 0.25mcg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Calcium 600mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Carvedilol 6.25mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Cinnarizine 75mg Capsule",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Clopidogrel 75mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Digoxin 0.125mg Tablet",c:"Tablets",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Furosemide 40mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:1},
  {n:"Hydralazine 25mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Isosorbide Dinitrate 5mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Labetalol 100mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:1},
  {n:"Losartan 50mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Metformin 500mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Methyldopa 250mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Metoprolol 50mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:1},
  {n:"Multivitamin Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Omeprazole 20mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Paracetamol 500mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Phenytoin 100mg Capsule",c:"Tablets",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Promethazine 25mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:1,ls:1},
  {n:"Propranolol 10mg Tablet",c:"Tablets",mn:1,mx:20,ha:0,hz:0,ls:1},
  {n:"Ramipril 2.5mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Spironolactone 25mg Tablet",c:"Tablets",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Verapamil 40mg Tablet",c:"Tablets",mn:1,mx:10,ha:1,hz:0,ls:1},
  {n:"Warfarin 1mg Tablet",c:"Tablets",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Aluminum + Magnesium Hydroxide Suspension",c:"Syrups",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Dextromethorphan 15mg/5ml Syrup",c:"Syrups",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Diphenhydramine 13.5mg/5ml Syrup",c:"Syrups",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Lactulose 10mg/15ml Syrup",c:"Syrups",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Nystatin 100,000IU/ml Oral Drops",c:"Syrups",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Activated Charcoal 100g/container",c:"Topical",mn:1,mx:3,ha:0,hz:0,ls:0},
  {n:"Calcium Polystyrene Sulphate 300g",c:"Topical",mn:1,mx:2,ha:0,hz:0,ls:0},
  {n:"Cetrimide + Chlorhexidine (Hexamide)",c:"Topical",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Chlorhexidine 0.2% Mouth Wash",c:"Topical",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Chlorhexidine + Isopropyl Alcohol (Scrub Stat)",c:"Topical",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Fleet Enema",c:"Topical",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Hydrogen Peroxide 6%",c:"Topical",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Lidocaine 10% Topical",c:"Topical",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Potassium Permanganate",c:"Topical",mn:1,mx:5,ha:0,hz:1,ls:0},
  {n:"Povidone Iodine 10%",c:"Topical",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Acyclovir 0.03% Ointment",c:"Ointments & Drops",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Desmopressin 0.1mg/ml",c:"Ointments & Drops",mn:1,mx:5,ha:1,hz:0,ls:0},
  {n:"Gentamicin 0.3% Eye/Ear Drops",c:"Ointments & Drops",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Gentamicin 0.3% Ointment",c:"Ointments & Drops",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Hydrocortisone 1% Cream",c:"Ointments & Drops",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Lidocaine 2% Gel",c:"Ointments & Drops",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Naphazoline + Chloropheniramine Eye/Nasal Drops",c:"Ointments & Drops",mn:1,mx:5,ha:0,hz:0,ls:0},
  {n:"Nitroglycerin 0.2mg/hr Transdermal Patch",c:"Ointments & Drops",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Pilocarpine 2% Eye Drops",c:"Ointments & Drops",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Proparacaine 0.5% Eye Drops",c:"Ointments & Drops",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Silver Sulfadiazine 1% Cream",c:"Ointments & Drops",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Sodium Fusidate 2% Ointment",c:"Ointments & Drops",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Tropicamide 1% Eye Drops",c:"Ointments & Drops",mn:1,mx:10,ha:0,hz:0,ls:0},
  {n:"Dextrose 10% 500ml",c:"Solutions",mn:1,mx:10,ha:1,hz:0,ls:0},
  {n:"Dextrose 5%",c:"Solutions",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Lactated Ringer's",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride 0.225%",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride 0.45%",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride 0.9%",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride 0.9% 100ml Bag",c:"Solutions",mn:1,mx:20,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride + Dextrose 0.225%+5%",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride + Dextrose 0.45%+5%",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0},
  {n:"Sodium Chloride + Dextrose 0.9%+5%",c:"Solutions",mn:1,mx:30,ha:0,hz:0,ls:0}
];


// ── HELPERS ──────────────────────────────────────────────

// Modern in-app dialogs — replaces all browser prompt/confirm/alert windows.
function uiDialog(opts){
  opts=opts||{};
  return new Promise(function(resolve){
    var bg=document.createElement('div');bg.className='modal-bg on';bg.style.zIndex='3000';
    var box=document.createElement('div');box.className='modal';box.style.width=opts.width||'520px';
    var title=document.createElement('div');title.className='mh';title.innerHTML='<div class="mt">'+esc(opts.title||'ASDHealth')+'</div>';
    var close=document.createElement('button');close.className='xbtn';close.type='button';close.innerHTML='&times;';title.appendChild(close);box.appendChild(title);
    var msg=document.createElement('div');msg.style.cssText='font-size:13px;line-height:1.75;white-space:pre-wrap;unicode-bidi:plaintext;margin-bottom:14px;color:var(--tx2)';var dialogMessage=opts.message||'';if(typeof globalThis.formatBilingualText==='function')dialogMessage=globalThis.formatBilingualText(dialogMessage);msg.textContent=dialogMessage;box.appendChild(msg);
    var input=null;
    if(opts.type==='prompt'){
      input=opts.multiline?document.createElement('textarea'):document.createElement('input');
      if(!opts.multiline)input.type=opts.inputType||'text';
      input.value=opts.value==null?'':String(opts.value);input.placeholder=opts.placeholder||'';input.style.marginBottom='16px';
      if(opts.multiline)input.rows=7;box.appendChild(input);
    }
    var actions=document.createElement('div');actions.className='fl g8';actions.style.justifyContent='flex-end';
    var cancel=document.createElement('button');cancel.className='btn bg';cancel.type='button';cancel.textContent=opts.cancelText||'Cancel';
    var ok=document.createElement('button');ok.className='btn '+(opts.danger?'bd2c':'bp');ok.type='button';ok.textContent=opts.okText||'OK';
    actions.appendChild(cancel);actions.appendChild(ok);box.appendChild(actions);bg.appendChild(box);document.body.appendChild(bg);
    function done(v){bg.remove();resolve(v)}
    close.onclick=function(){done(opts.type==='confirm'?false:null)};cancel.onclick=close.onclick;
    bg.onclick=function(e){if(e.target===bg)close.onclick()};
    ok.onclick=function(){done(opts.type==='confirm'?true:(input?input.value:true))};
    box.onkeydown=function(e){if(e.key==='Escape')close.onclick();if(e.key==='Enter'&&!opts.multiline&&e.target===input){e.preventDefault();ok.click()}};
    setTimeout(function(){(input||ok).focus();if(input&&input.select)input.select()},20);
  });
}
function uiPrompt(message,value,options){options=options||{};return uiDialog(Object.assign({type:'prompt',title:options.title||'Enter information',message:message||'',value:value==null?'':value},options))}
function uiConfirm(message,options){options=options||{};return uiDialog(Object.assign({type:'confirm',title:options.title||'Please confirm',message:message||'',danger:!!options.danger,okText:options.okText||'Confirm'},options))}

function toast(msg,type){
  var t=document.getElementById('toast'),value=String(msg==null?'':msg);
  if(typeof globalThis.formatBilingualText==='function')value=globalThis.formatBilingualText(value);
  t.textContent=value;t.style.whiteSpace='pre-line';t.style.unicodeBidi='plaintext';t.className='on t'+type;
  clearTimeout(window._tt);
  window._tt=setTimeout(function(){t.className=''},3200);
}
function bdg(m){
  if(!m)return '';
  var b='';
  if(m.high_alert)b+='<span class="badge brd">🔴 High Alert</span> ';
  if(m.hazard)b+='<span class="badge byl">⚠ Hazard</span> ';
  if(m.lasa)b+='<span class="badge bpu">🔵 LASA</span> ';
  if(m.refrigerated)b+='<span class="badge bfr">❄ Refrigerated</span> ';
  return b||'<span class="badge bgr">Std</span>';
}
function rowCls(m){
  if(!m)return '';
  var c=[];
  if(m.high_alert)c.push('rha');
  if(m.hazard)c.push('rhz');
  if(m.lasa)c.push('rls');
  if(m.refrigerated)c.push('rrf');
  return c.join(' ');
}
function OM(id){document.getElementById(id).classList.add('on')}
function el(id){return document.getElementById(id)}
function esc(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* R6.38 canonical shared helpers — one source of truth for permissions, names, audit actors and medicine matching. */
window.fsEsc=function(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
window.fsPrepareImageDataUrl=async function(file,options){
  options=options||{};
  var maxInputBytes=Number(options.maxInputBytes)||5*1024*1024;
  var maxOutputBytes=Number(options.maxOutputBytes)||500*1024;
  var maxDimension=Number(options.maxDimension)||1000;
  if(!file)throw new Error('Choose an image first.');
  if(['image/png','image/jpeg'].indexOf(String(file.type||'').toLowerCase())<0)throw new Error('Only PNG and JPEG images are allowed.');
  if(Number(file.size||0)>maxInputBytes)throw new Error('The selected image is too large. Maximum source size is 5 MB.');
  function read(){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result||''))};r.onerror=function(){reject(new Error('The image could not be read.'))};r.readAsDataURL(file)})}
  function load(src){return new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img)};img.onerror=function(){reject(new Error('The selected file is not a readable image.'))};img.src=src})}
  function bytes(data){var comma=data.indexOf(',');return Math.ceil(Math.max(0,data.length-comma-1)*3/4)}
  var source=await read(),image=await load(source),scale=Math.min(1,maxDimension/Math.max(image.naturalWidth||1,image.naturalHeight||1));
  var width=Math.max(1,Math.round((image.naturalWidth||1)*scale)),height=Math.max(1,Math.round((image.naturalHeight||1)*scale));
  var mime=String(file.type).toLowerCase(),quality=.9;
  for(var attempt=0;attempt<8;attempt++){
    var canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    var context=canvas.getContext('2d',{alpha:mime==='image/png'});if(!context)throw new Error('Image processing is not supported by this browser.');
    context.drawImage(image,0,0,width,height);
    var output=canvas.toDataURL(mime,mime==='image/jpeg'?quality:undefined);
    if(bytes(output)<=maxOutputBytes)return output;
    if(mime==='image/jpeg')quality=Math.max(.55,quality-.08);
    width=Math.max(1,Math.round(width*.82));height=Math.max(1,Math.round(height*.82));
  }
  throw new Error('The processed logo is still larger than 500 KB. Choose a smaller image.');
};
window.fsEffectiveUser=function(){return (window.MASTER_EFFECTIVE&&Object.assign({},window.CU||{},window.MASTER_EFFECTIVE))||(window.CU||{})};
window.fsEffectiveRole=function(){var u=window.fsEffectiveUser();return normalizeRole(u.role)};
window.fsActualUser=function(){return (window.MASTER_ACTUAL||window.CU||{})};
window.fsActor=function(){var u=window.fsActualUser(),name=(typeof window.actualActorName==='function'?window.actualActorName():(u.name||u.fullName||u.displayName||u.username||u.email||'Unknown'));return {name:name,user:u.email||u.username||u.id||u.uid||'Unknown',id:u.id||u.uid||''}};
window.fsHasCapability=function(capability){return hasCapability(window.fsEffectiveUser(),capability)};
window.fsCanAccessDepartment=function(departmentId){return canAccessDepartment(window.fsEffectiveUser(),departmentId)};
window.fsCanManage=function(){return window.fsHasCapability('inventory.manage')};
window.fsCanManageCrashCart=function(){return window.fsHasCapability('crashCart.operate')};
window.fsDeptName=function(id){try{var list=typeof window.gd==='function'?(window.gd()||[]):[],d=list.find(function(x){return String(x.id)===String(id)});return d?(d.name||d.nameEn||d.nameAr||String(id||'—')):String(id||'—')}catch(e){return String(id||'—')}};
window.fsDaysUntil=function(value){if(!value)return null;var raw=String(value).slice(0,10),parts=raw.split('-'),d=parts.length===3?new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2])):new Date(value);if(isNaN(d.getTime()))return null;var n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate());return Math.floor((d.getTime()-today.getTime())/86400000)};
window.fsNowISO=function(){return new Date().toISOString()};
window.fsMedNorm=function(value){return String(value==null?'':value).toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g,'').replace(/أ|إ|آ/g,'ا').replace(/&/g,' and ').replace(/(\d)\s*(mg|mcg|gm|g|ml|iu|mmol|meq|%)/gi,'$1 $2').replace(/[^a-z0-9؀-ۿ%]+/g,' ').replace(/\s+/g,' ').trim()};

// ── STATE ────────────────────────────────────────────────
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
  sel.innerHTML=gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
}
function fsLoginTimeout(promise,ms,message){
  var timer=null;
  return new Promise(function(resolve,reject){
    timer=setTimeout(function(){reject(new Error(message));},ms);
    Promise.resolve(promise).then(function(value){
      clearTimeout(timer);resolve(value);
    },function(error){
      clearTimeout(timer);reject(error);
    });
  });
}
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
  var projectId=FIREBASE_CONFIG.projectId;
  var base='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+'/databases/(default)/documents';
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
    credential=await fsLoginTimeout(FB_AUTH.signInWithEmailAndPassword(email,password),30000,'Firebase sign-in timed out.');
    setLoginStage('Verifying profile…');
    var profileSnapshot=await fsLoadAuthenticatedProfile(credential.user,setLoginStage);
    if(!profileSnapshot||!profileSnapshot.exists)throw new Error('Your Firebase account has no Floor Stock role profile.');
    var profile=profileSnapshot.data()||{};
    profile.role=normalizeRole(profile.role);
    if(profile.active===false)throw new Error('This account is inactive.');
    if(['pharmacy','department','warehouse','controlled_pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(profile.role)<0)throw new Error('This account has an invalid role.');
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
    CU={id:credential.user.uid,email:profile.email||credential.user.email,role:profile.role,master:profile.master===true,username:profile.displayName||profile.email||credential.user.email,deptId:deptId,deptName:dept?dept.name:(profile.deptName||profile.departmentName||''),controlledCustodian:!!profile.controlledCustodian};
    var stateProfile=Object.assign({},profile,{uid:credential.user.uid,deptId:deptId});
    if(typeof window.startApp!=='function'){
      throw new Error('Application startup is unavailable. Reload the file and try again.');
    }
    // Keep the login screen visible until the authenticated user's state is ready.
    // Opening the shell before this finishes makes valid pages look empty or broken.
    await S.init(setLoginStage,stateProfile);
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
    setLoginError(message);
    try{if(credential&&FB_AUTH&&FB_AUTH.currentUser)await FB_AUTH.signOut();}catch(signOutError){console.warn('Could not clear the partial authentication session.',signOutError);}
    if(loginBtn){loginBtn.disabled=false;loginBtn.innerHTML=oldLoginText||'Sign In / دخول';}
  }
}
var logoutBusy=false;
async function doLogout(){
  if(logoutBusy)return;logoutBusy=true;
  var logoutButtons=Array.from(document.querySelectorAll('[onclick*="doLogout"],#logout-btn,.logout-btn'));logoutButtons.forEach(function(button){button.disabled=true});
  function timeout(promise,ms,label){return Promise.race([Promise.resolve(promise),new Promise(function(_,reject){setTimeout(function(){reject(new Error(label||'Operation timed out'))},ms)})])}
  try{
    if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
    try{if(typeof window.asdhWaitForAllSaves==='function')await timeout(window.asdhWaitForAllSaves(12000),13000,'Save confirmation timed out')}catch(e){console.warn('Save confirmation failed before logout; continuing sign out.',e)}
    if(typeof previewClear==='function')previewClear();
    try{if(FB_DB&&typeof FB_DB.waitForPendingWrites==='function'){if(window.CU&&window.CU.master===true)toast('جاري حفظ البيانات...\nSaving data...','info');await timeout(FB_DB.waitForPendingWrites(),7000,'Pending writes timed out')}}catch(err){console.warn('Pending writes failed before logout; continuing sign out.',err)}
    S.stopRealtime();
    if(FB_AUTH&&FB_AUTH.currentUser)await timeout(FB_AUTH.signOut(),8000,'Sign out timed out');
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
  sel.innerHTML='<option value="">Select Dept...</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  if(cur&&gd().some(function(d){return d.id===cur}))sel.value=cur;else sel.value='';
}

// ── DASHBOARD ────────────────────────────────────────────
function renderDash(){
  var allDs=gd(),dashRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''),ds=allDs;
  if(dashRole==='inpatient_supervisor')ds=allDs.filter(function(d){return !/outpatient\s+department/i.test(String(d.name||''))&&String(d.id)!=='outpatient'});
  else if(dashRole==='outpatient_pharmacy_supervisor')ds=allDs.filter(function(d){return /outpatient\s+department/i.test(String(d.name||''))||String(d.id)==='outpatient'});
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
  // Drug modal dept sel
  var ddsel=el('ddept-sel');
  if(ddsel){ddsel.disabled=true;ddsel.innerHTML=gd().map(function(d){return '<option value="'+esc(d.id)+'"'+(d.id===deptId?' selected':'')+'>'+esc(d.name)+'</option>'}).join('');}

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
    var zero6=Number(m.stockQty!=null?m.stockQty:(m.currentStock!=null?m.currentStock:(m.availableQty!=null?m.availableQty:0)))<=0&&(!lastDispense(m)||lastDispense(m)<=zeroCutoff);
    var neverExpiry=hasExpiry(m)&&!wasRequested(m);
    return(!srch||m.name.toLowerCase().indexOf(srch)>-1)&&(!catf||m.category===catf)&&(!clsf||m[clsf])&&(!special||special==='__zero_duration__'&&zero6||special==='__expiry_never_requested__'&&neverExpiry);
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
  if(ddsel){ddsel.disabled=false;ddsel.innerHTML=gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');}
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
  if(ddsel){ddsel.innerHTML=gd().map(function(d){return '<option value="'+esc(d.id)+'"'+(d.id===deptId?' selected':'')+'>'+esc(d.name)+'</option>'}).join('');}
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

// ── REQUESTS ─────────────────────────────────────────────
globalThis.RFS = 'all';
function filterR(s,btn){
  RFS=s;document.querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('on')});btn.classList.add('on');renderReqs();
}
function renderReqs(){
  var purgeReqBtn=el('purge-old-requests-btn');if(purgeReqBtn)purgeReqBtn.style.display=(CU&&CU.master===true)?'inline-flex':'none';
  var rs=gr().slice().reverse();
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();rs=rs.filter(function(r){return String(r.deptId)===String(opd)})}
  if(RFS!=='all')rs=rs.filter(function(r){return r.status===RFS});
  el('rlist').innerHTML=rs.length?rs.map(function(r){return rcard(r,true)}).join('')
    :'<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📋</div><div style="margin-top:10px">No requests</div></div>';

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
  if(typeof window.renderFulfillmentEditSettings==='function')window.renderFulfillmentEditSettings();
}
function installRequestActionBindings(){
  if(globalThis._requestActionBindingsInstalled)return;
  globalThis._requestActionBindingsInstalled=true;
  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest?event.target.closest('[data-request-action]'):null;
    if(!button)return;
    var action=button.dataset.requestAction||'',id=button.dataset.id||'';
    event.preventDefault();
    if(action==='fulfill'||action==='edit-fulfillment')return openFulfill(id);
    if(action==='view')return viewReq(id);
    if(action==='master-delete'&&typeof window.masterDeleteRequestNow==='function')return window.masterDeleteRequestNow(id);
    if(action==='receive'&&typeof window.receiveFulfilledRequest==='function')return window.receiveFulfilledRequest(id);
    if(action==='v16-edit'&&typeof window.v16EditRequest==='function')return window.v16EditRequest(id);
    if(action==='v16-delete'&&typeof window.v16DeleteRequest==='function')return window.v16DeleteRequest(id);
    if(action==='v16-confirm-delete'&&typeof window.v16ConfirmDelete==='function')return window.v16ConfirmDelete(id);
    if(action==='v16-save-edit'&&typeof window.v16SaveEdit==='function')return window.v16SaveEdit(id);
    if(action==='close-request-modal'){
      var modal=button.closest('.modal-bg');
      if(modal)modal.remove();
      return;
    }
    console.warn('Request action is unavailable:',action);
  });
}
installRequestActionBindings();
function rcard(r,isp){
  var d=gd().find(function(x){return x.id===r.deptId});
  var sm={pending:'byl',fulfilled:'bgn',partial:'bbl'};
  var mayEditFulfillment=typeof window.canEditFulfillmentRequest==='function'&&window.canEditFulfillmentRequest(r);
  return '<div class="card" data-request-id="'+esc(r.id)+'"><div class="ch"><div class="fl ic g8"><span style="font-weight:600">'+((d&&d.name)||r.deptId)+'</span><span class="badge '+(sm[r.status]||'bgr')+'">'+r.status+'</span></div>'
    +'<div class="fl g8 ic" data-request-actions><span style="font-size:12px;color:var(--tx2)">'+fmtDateTime(r.created)+'</span>'
    +(isp&&r.status==='pending'?'<button class="btn bp bsm" data-request-action="fulfill" data-id="'+r.id+'">Fulfill</button>':'')
    +(mayEditFulfillment?'<button class="btn bg bsm" data-request-action="edit-fulfillment" data-id="'+r.id+'">✏ Edit Fulfillment</button>':'')
    +(isp&&window.CU&&CU.master===true?'<button class="btn bd2c bsm" data-request-action="master-delete" data-id="'+r.id+'">Delete</button>':'')
    +(!isp&&r.status==='fulfilled'&&!r.receivedAt?'<button class="btn bs bsm" data-request-action="receive" data-id="'+r.id+'">Receive & add expiry</button>':'')
    +'<button class="btn bg bsm" data-request-action="view" data-id="'+r.id+'">View</button></div></div>'
    +'<div style="padding:9px 18px;font-size:12px;color:var(--tx2)">'+(r.items||[]).length+' items'
    +(r.status!=='pending'?' &middot; '+(r.dispensed||[]).filter(function(i){return i.qty>0}).length+' dispensed on '+fmtDateTime(r.fulfilledAt):' &middot; Awaiting fulfillment')
    +(r.scheduledFor?'<div style="margin-top:6px;color:var(--acl);font-weight:600">📅 Scheduled dispense: '+fmtDateTime(r.scheduledFor)+(r.scheduledLabel?' &middot; '+r.scheduledLabel:'')+'</div>':'<div style="margin-top:6px">📅 Dispense time: Not scheduled yet</div>')
    +'</div></div>';
}
function viewReq(id){
  var r=gr().find(function(x){return x.id===id});if(!r)return;
  var d=gd().find(function(x){return x.id===r.deptId});
  el('vdname').textContent=(d&&d.name)||r.deptId;
  var ms=getMeds(r.deptId||'');
  el('vbody').innerHTML='<p style="font-size:12px;color:var(--tx2);margin-bottom:11px">Submitted: '+fmtDateTime(r.created)+'</p>'
    +'<div class="tw"><table><thead><tr><th style="text-align:center">#</th><th>Medication</th><th style="text-align:center">Requested</th><th style="text-align:center">Dispensed</th></tr></thead><tbody>'
    +(r.items||[]).map(function(it,index){
      var m=ms.find(function(x){return x.id===it.medId});
      var dsp=(r.dispensed||[]).find(function(x){return x.medId===it.medId});
      return '<tr><td style="text-align:center;font-family:var(--mono);font-weight:600">'+(index+1)+'</td><td>'+(m?m.name:it.medId)+'</td><td style="text-align:center;font-family:var(--mono)">'+it.qty+'</td><td style="text-align:center;font-family:var(--mono)">'+(dsp?dsp.qty:'&mdash;')+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  OM('mview');
}
function openFulfill(id){
  FRID=id;
  var r=gr().find(function(x){return x.id===id});if(!r)return;
  var isEdit=r.status==='fulfilled';
  if(isEdit){
    var profile=typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():(window.CU||{});
    var settings=S.g(FULFILLMENT_EDIT_SETTINGS_KEY);
    var reason=fulfillmentEditReason(r,profile,settings,Date.now());
    if(reason)return toast(reason,'err');
  }else if(!canManageRequests())return toast('No request edit permission','err');
  var d=gd().find(function(x){return x.id===r.deptId});
  el('fulfill-title').textContent=(isEdit?'Edit Fulfillment':'Fulfill Request')+' — '+((d&&d.name)||r.deptId);
  el('fulfill-hint').textContent=isEdit?'Previous dispensed quantities are loaded. Change only the item you need, then save.':'Enter the dispensed quantity for every item. Enter 0 if not dispensed. Quantities may exceed Requested and departmental Max.';
  el('fulfill-btn').textContent=isEdit?'Update ✓':'Confirm ✓';
  var ms=getMeds(r.deptId||'');
  var thirtyDayCutoff=Date.now()-(30*24*60*60*1000);
  function dispensedLast30Days(medId){
    var result=gr().reduce(function(total,req){
      if(!req||req.id===r.id||req.deptId!==r.deptId)return total;
      if(req.status!=='fulfilled'&&req.status!=='partial')return total;
      var dt=new Date(req.fulfilledAt||req.updatedAt||req.created||0).getTime();
      if(!isFinite(dt)||dt<thirtyDayCutoff||dt>Date.now())return total;
      var line=(req.dispensed||[]).find(function(x){return x.medId===medId});
      if(line&&Number(line.qty)>0){total.qty+=Number(line.qty)||0;total.orders+=1}
      return total;
    },{qty:0,orders:0});
    result.average=result.orders?result.qty/result.orders:0;return result;
  }
  var previousDispensed={};
  if(isEdit)(r.dispensed||[]).forEach(function(x){previousDispensed[String(x.medId)]=x.qty});
  el('ftbl').innerHTML=(r.items||[]).map(function(it,index){
    var m=ms.find(function(x){return x.id===it.medId});
    var last30=dispensedLast30Days(it.medId);
    var rowBg=m&&m.high_alert?'background:rgba(218,54,51,.07)':m&&m.hazard?'background:rgba(210,153,34,.06)':'background:rgba(31,111,235,.04)';
    return '<tr style="'+rowBg+'"><td style="text-align:center;font-family:var(--mono);font-weight:600">'+(index+1)+'</td><td style="font-weight:500">'+(m?m.name:it.medId)+'</td><td>'+bdg(m)+'</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(m&&m.min!=null?m.min:'&mdash;')+'</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(m&&m.max!=null?m.max:'&mdash;')+'</td>'
      +'<td style="text-align:center"><span class="badge bbl" style="font-family:var(--mono);font-size:11px">'+last30.qty+' / '+last30.orders+' orders<br><small>avg '+(Math.round(last30.average*100)/100)+'/order</small></span></td>'
      +'<td style="text-align:center;font-family:var(--mono);font-weight:700">'+it.qty+'</td>'
      +'<td><input type="number" min="0" value="'+(Object.prototype.hasOwnProperty.call(previousDispensed,String(it.medId))?previousDispensed[String(it.medId)]:'')+'" placeholder="Enter qty" required data-med="'+it.medId+'" data-requested="'+it.qty+'" title="Any non-negative quantity is allowed, including more than Requested or departmental Max." style="width:100%;min-width:72px;padding:5px 7px;text-align:center;margin:0"></td></tr>';
  }).join('');
  Array.from(el('ftbl').querySelectorAll('input[data-med]')).forEach(function(inp){
    inp.addEventListener('input',function(){this.style.borderColor='';this.style.boxShadow=''});
  });
  OM('mfulfill');
}
// ── DEPT REQUEST FORM ────────────────────────────────────

function valQ(inp){
  var mx=+inp.dataset.max;
  if(+inp.value>mx){inp.value=mx;inp.style.borderColor='var(--rd)';toast('Max: '+mx,'err');setTimeout(function(){inp.style.borderColor=''},1400);}
  cntItems();
}
function cntItems(){
  var n=Array.from(document.querySelectorAll('.rqi')).filter(function(i){return +i.value>0}).length;
  var e=el('rcnt');if(e)e.textContent=n;
}
// ── MY REQUESTS ──────────────────────────────────────────
function renderMyReqs(){
  var rs=gr().filter(function(r){return r.deptId===CU.deptId}).slice().reverse();
  el('mrlst').innerHTML=rs.length?rs.map(function(r){return rcard(r,false)}).join('')
    :'<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📋</div><div style="margin:10px 0 4px;font-size:15px;font-weight:600;color:var(--tx)">No requests yet</div></div>';

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
}

window.canEditFulfillmentRequest=function(request,now){
  var profile=typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():(window.CU||{});
  return canEditFulfillment(request,profile,S.g(FULFILLMENT_EDIT_SETTINGS_KEY),now==null?Date.now():now);
};


// ── CONTROLLED & PSYCHOTROPIC MEDICINES ────────────────────────────────
globalThis.CTL_VIEW = 'overview';
function ctlCatalog(){return S.g('controlled_catalog')||[]}
async function ctlSetCatalog(v){if(typeof window.ctlCanAddCatalog==='function'&&!window.ctlCanAddCatalog())return ctlCatalog();var out=await S.s('controlled_catalog',v);try{if(window.FB_DB&&typeof ctlPublishDept==='function'){var ids=(typeof gd==='function'?(gd()||[]):[]).map(function(d){return d.id});await Promise.all(ids.map(function(id){return ctlPublishDept(id)}))}}catch(e){warnPublicSync('Controlled catalogue',e)}return out}
function ctlWarehouse(){return S.g('controlled_warehouse')||{}}
function ctlSetWarehouse(v){return S.s('controlled_warehouse',v)}
function ctlPharmacy(){return S.g('controlled_pharmacy_stock')||{}}
function ctlSetPharmacy(v){return S.s('controlled_pharmacy_stock',v)}
function ctlDeptList(dept){return S.g('controlled_dept_list_'+dept)||[]}
async function ctlSetDeptList(dept,v){var out=await S.s('controlled_dept_list_'+dept,v);try{if(window.FB_DB&&typeof ctlPublishDept==='function')await ctlPublishDept(dept)}catch(e){warnPublicSync('Controlled custody',e)}return out}
function ctlMoves(){return S.g('controlled_moves')||[]}
async function ctlSaveMovementLog(record,context){
  try{await ctlMove(record);return true}catch(e){console.error((context||'Controlled action')+' movement log failed',e);return false}
}
function ctlIsOfficer(){return CU&&CU.role==='controlled_pharmacy'}
function ctlIsWarehouse(){return CU&&CU.role==='warehouse'}
function ctlDate(v){
  if(!v)return '';
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  var s=String(v).trim().replace(/ 00:00:00$/,'');
  var d=new Date(s);return isNaN(d)?s:d.toISOString().slice(0,10);
}
function ctlNum(v){var n=Number(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:0}
function ctlKey(moh,nupco,name){return 'cm_'+String(moh||nupco||name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,70)}
function ctlMedicine(id){return ctlCatalog().find(function(m){return m.id===id})||null}
function ctlBatchText(batches){return (batches||[]).length?(batches||[]).map(function(b){return '<div><span class="chip">'+(b.qty||0)+'</span> '+esc(fmtDate(b.expiry))+(b.lot?' · '+esc(b.lot):'')+'</div>'}).join(''):'—'}
function ctlCurrentDept(){var s=el('ctl-dept');return s&&s.value?s.value:(CU.deptId||'')}


function renderCtlPending(){
  if(!el('ctl-pending'))return;var pending=ctlMoves().filter(function(x){return x.type==='warehouse_send'&&x.status==='pending'});
  el('ctl-pending').innerHTML=pending.length?pending.map(function(x){var m=ctlMedicine(x.medId)||{};return '<div class="limit-row"><span><b>'+esc(m.name||'')+'</b> — Qty: '+ctlNum(x.qty)+(x.expiry?' · Exp: '+fmtDate(x.expiry):'')+'</span>'+(ctlIsOfficer()?'<span><button class="btn bs bxs" data-id="'+x.id+'" onclick="ctlReceiveDelivery(this.dataset.id,true)">Accept</button> <button class="btn bd2c bxs" data-id="'+x.id+'" onclick="ctlReceiveDelivery(this.dataset.id,false)">Reject</button></span>':'<span class="chip">Awaiting pharmacy officer</span>')+'</div>'}).join(''):'<div style="color:var(--tx2)">No pending deliveries.</div>';
}
function renderCtlLog(){if(!el('ctl-log'))return;var dept=ctlCurrentDept(),rows=ctlMoves().filter(function(x){return !x.dept||x.dept===dept}).slice(-30).reverse();el('ctl-log').innerHTML=rows.length?'<div class="tw"><table><thead><tr><th>Date</th><th>Action</th><th>Medicine</th><th>By</th><th>Details</th></tr></thead><tbody>'+rows.map(function(x){var m=ctlMedicine(x.medId)||{};return '<tr><td>'+fmtDateTime(x.at)+'</td><td>'+esc(x.type||'')+'</td><td>'+esc(m.name||'—')+'</td><td>'+esc(x.by||'')+'</td><td>'+esc(x.note||'')+'</td></tr>'}).join('')+'</tbody></table></div>':'<div style="color:var(--tx2)">No movements yet.</div>'}
async function ctlSendToPharmacy(id){
  if(!ctlIsWarehouse())return;
  var original=ctlWarehouse()||{},next=Object.assign({},original),x=Object.assign({},original[id]||{}),qty=ctlNum(await uiPrompt('Quantity to send to pharmacy','0'));
  if(qty<=0||qty>ctlNum(x.system)+ctlNum(x.outside))return toast('Invalid or insufficient quantity','err');
  var expiry=ctlDate(await uiPrompt('Expiry date for sent batch',''));if(!expiry)return;
  var fromSystem=Math.min(qty,ctlNum(x.system)),fromOutside=qty-fromSystem;x.system=ctlNum(x.system)-fromSystem;x.outside=ctlNum(x.outside)-fromOutside;next[id]=x;
  try{await ctlSetWarehouse(next);await ctlMove({type:'warehouse_send',medId:id,qty:qty,expiry:expiry,fromSystem:fromSystem,fromOutside:fromOutside,status:'pending',note:'Sent to pharmacy; awaiting accept/reject'})}
  catch(e){console.error('Warehouse transfer save failed',e);var rollbackFailed=false;try{await ctlSetWarehouse(original)}catch(err){rollbackFailed=true;console.error('Warehouse transfer rollback failed',err)}return toast(rollbackFailed?'Transfer failed and the warehouse rollback could not be confirmed. Review the balance.':'Transfer failed. Warehouse balance was restored.','err')}
  renderControlled();toast('Transfer sent to pharmacy and marked pending ✓','succ');return true
}

async function ctlReceiveDelivery(moveId,accept){
  if(!ctlIsOfficer())return;
  var originalMoves=(ctlMoves()||[]).map(function(x){return Object.assign({},x)}),index=originalMoves.findIndex(function(x){return String(x.id)===String(moveId)});
  if(index<0||originalMoves[index].status!=='pending')return toast('This transfer is no longer pending.','err');
  var move=Object.assign({},originalMoves[index]),nextMoves=originalMoves.map(function(x){return Object.assign({},x)}),stockOriginal=null,stockNext=null,saveStock=null,rollbackStock=null;
  if(accept){
    stockOriginal=ctlPharmacy()||{};stockNext=Object.assign({},stockOriginal);var px=Object.assign({},stockOriginal[move.medId]||{}),newQty=ctlNum(px.qty!=null?px.qty:px.actualQty)+ctlNum(move.qty);
    px.qty=newQty;px.actualQty=newQty;px.batches=(px.batches||[]).map(function(b){return Object.assign({},b)});
    var same=px.batches.find(function(b){return String(b.expiry||'')===String(move.expiry||'')&&String(b.lot||'')===String(move.lot||'')});
    if(same)same.qty=ctlNum(same.qty)+ctlNum(move.qty);else px.batches.push({qty:ctlNum(move.qty),expiry:move.expiry||'',lot:move.lot||''});
    stockNext[move.medId]=px;saveStock=function(){return ctlSetPharmacy(stockNext)};rollbackStock=function(){return ctlSetPharmacy(stockOriginal)};
    nextMoves[index]=Object.assign({},move,{status:'accepted',type:'receipt_accepted',note:'Accepted by controlled-medicines pharmacy officer',resolvedAt:nowISO()});
  }else{
    var why=await uiPrompt('Reason for rejection');if(!why)return;
    stockOriginal=ctlWarehouse()||{};stockNext=Object.assign({},stockOriginal);var wx=Object.assign({},stockOriginal[move.medId]||{}),backSystem=move.fromSystem==null?ctlNum(move.qty):ctlNum(move.fromSystem),backOutside=move.fromOutside==null?0:ctlNum(move.fromOutside);
    wx.system=ctlNum(wx.system)+backSystem;wx.outside=ctlNum(wx.outside)+backOutside;stockNext[move.medId]=wx;saveStock=function(){return ctlSetWarehouse(stockNext)};rollbackStock=function(){return ctlSetWarehouse(stockOriginal)};
    nextMoves[index]=Object.assign({},move,{status:'rejected',type:'receipt_rejected',note:String(why).trim(),resolvedAt:nowISO()});
  }
  try{await saveStock();await S.s('controlled_moves',nextMoves)}catch(e){
    console.error('Controlled delivery resolution failed',e);var rollbackFailed=false;
    try{await rollbackStock()}catch(err){rollbackFailed=true;console.error('Controlled delivery stock rollback failed',err)}
    try{await S.s('controlled_moves',originalMoves)}catch(err){rollbackFailed=true;console.error('Controlled delivery movement rollback failed',err)}
    return toast(rollbackFailed?'The transfer update failed and rollback could not be confirmed. Review both warehouse and pharmacy balances.':'The transfer update failed. Stock and pending status were restored.','err')
  }
  renderControlled();toast(accept?'Transfer accepted into pharmacy custody ✓':'Transfer rejected and warehouse balance restored ✓','succ');return true
}

async function ctlAssignMedicineToDept(){
  if(!ctlCanEditDept())return;
  var dept=ctlCurrentDept(),cat=ctlCatalog(),term=await uiPrompt('Enter medicine name, MOH code or NUPCO code');if(!term)return;
  var q=term.toLowerCase(),matches=cat.filter(function(m){return [m.name,m.moh,m.nupco].join(' ').toLowerCase().includes(q)});
  if(!matches.length)return toast('Medicine not found in shared catalogue','err');
  var med=matches.length===1?matches[0]:matches[ctlNum(await uiPrompt(matches.map(function(m,i){return (i+1)+'. '+m.name}).join('\n')+'\nChoose number','1'))-1];if(!med)return;
  var list=ctlDeptList(dept).slice();if(list.some(function(x){return x.medId===med.id}))return toast('Already assigned','err');
  list.push({medId:med.id,min:med.min,max:med.max,qty:0,batches:[]});
  try{await ctlSetDeptList(dept,list)}catch(e){console.error('Department medicine assignment failed',e);return toast('Medicine assignment was not saved.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'dept_list_add',dept:dept,medId:med.id,note:'Added to inpatient department list'},'Department medicine assignment');
  renderControlled();if(!movementSaved)toast('Medicine was assigned, but the movement log was not saved.','info');return true
}
async function ctlRemoveDeptMedicine(id){
  if(!ctlCanEditDept()||!await uiConfirm('Remove this medicine from the department list?'))return;
  var dept=ctlCurrentDept(),next=ctlDeptList(dept).filter(function(x){return x.medId!==id});
  try{await ctlSetDeptList(dept,next)}catch(e){console.error('Department medicine removal failed',e);return toast('Medicine removal was not saved.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'dept_list_remove',dept:dept,medId:id,note:'Removed from inpatient department list'},'Department medicine removal');
  renderControlled();if(!movementSaved)toast('Medicine was removed, but the movement log was not saved.','info');return true
}
async function ctlImportRows(rows,source){
  if(!ctlCanEditCatalog())return toast('Only warehouse or controlled-medicines pharmacy officer may import.','err');
  var originalCat=ctlCatalog().map(function(m){return Object.assign({},m)}),originalWh=ctlWarehouse()||{},originalPh=ctlPharmacy()||{};
  var cat=originalCat.map(function(m){return Object.assign({},m)}),wh=Object.assign({},originalWh),ph=Object.assign({},originalPh),added=0,updated=0;
  var start=0;for(var z=0;z<Math.min(rows.length,20);z++){var s=String((rows[z]||[])[0]||'').toLowerCase();if(s.includes('code')){start=z+1;break}}
  for(var i=start;i<rows.length;i++){
    var r=rows[i]||[],moh=String(r[0]||'').trim(),nupco=String(r[1]||'').trim(),name=String(r[2]||r[10]||'').trim();if(!moh&&!nupco&&!name)continue;if(!name)continue;
    var found=cat.find(function(m){return (moh&&m.moh===moh)||(nupco&&m.nupco===nupco)||m.name.toLowerCase()===name.toLowerCase()}),id=found?found.id:ctlKey(moh,nupco,name),med={id:id,moh:moh,nupco:nupco,name:name,classification:found?found.classification:'narcotic',min:ctlNum(r[8]),max:ctlNum(r[9])};
    if(found){Object.assign(found,med);updated++}else{cat.push(med);added++}
    var sys=ctlNum(r[3]),outside=ctlNum(r[4]),q2=ctlNum(r[6]),total=sys+outside,q1=Math.max(total-q2,0),b1=ctlDate(r[5]),b2=ctlDate(r[7]);wh[id]={system:sys,outside:outside,batches:[b1?{qty:q1,expiry:b1,lot:''}:null,b2?{qty:q2,expiry:b2,lot:''}:null].filter(Boolean)};
    var pq=ctlNum(r[11]),pe=ctlDate(r[12]);ph[id]={qty:pq,batches:pe?[{qty:pq,expiry:pe,lot:''}]:[]};
  }
  var saved=[];
  try{await ctlSetCatalog(cat);saved.push('catalog');await ctlSetWarehouse(wh);saved.push('warehouse');await ctlSetPharmacy(ph);saved.push('pharmacy')}
  catch(e){
    console.error('Controlled master import failed',e);var rollbackFailed=false;
    for(var j=saved.length-1;j>=0;j--){try{if(saved[j]==='catalog')await ctlSetCatalog(originalCat);else if(saved[j]==='warehouse')await ctlSetWarehouse(originalWh);else await ctlSetPharmacy(originalPh)}catch(err){rollbackFailed=true;console.error('Controlled import '+saved[j]+' rollback failed',err)}}
    return toast(rollbackFailed?'Import failed and rollback could not be confirmed. Review the controlled catalogue and balances.':'Import was not saved. Previous data was restored.','err')
  }
  var movementSaved=await ctlSaveMovementLog({type:'master_import',note:'Imported '+source+'; added '+added+', updated '+updated},'Controlled master import');
  toast(movementSaved?'Import completed: '+added+' added, '+updated+' updated ✓':'Import completed, but the movement log was not saved.',movementSaved?'succ':'info');renderControlled();return true
}
async function ctlImportMasterFile(file){if(!file)return;try{await ensureXLSX()}catch(e){return toast('Excel library unavailable','err')};var reader=new FileReader();reader.onload=function(e){try{var wb=XLSX.read(e.target.result,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});ctlImportRows(rows,file.name)}catch(err){console.error(err);toast(err.message||'Import failed','err')}el('ctl-import-file').value=''};reader.readAsArrayBuffer(file)}
function ctlImportMasterText(){var t=el('ctl-import-text').value.trim();if(!t)return toast('Paste text first','err');var rows=t.split(/\r?\n/).map(function(line){return line.split('\t')});ctlImportRows(rows,'pasted text')}


const __asdhLegacyApi = {
  loadScriptOnce: loadScriptOnce,
  ensurePDFJS: ensurePDFJS,
  ensureZXing: ensureZXing,
  ensureFirebaseFunctions: ensureFirebaseFunctions,
  debounce: debounce,
  initFirebase: initFirebase,
  waitForFirebase: waitForFirebase,
  _trackSave: _trackSave,
  stateValueEqual: stateValueEqual,
  fsStateRestEncode: fsStateRestEncode,
  fsStateToken: fsStateToken,
  fsStateRestBase: fsStateRestBase,
  fsStateRestRequest: fsStateRestRequest,
  fsStateRestListCollection: fsStateRestListCollection,
  fsStateLoadFloorstockViaRest: fsStateLoadFloorstockViaRest,
  fsStateLoadUsersViaRest: fsStateLoadUsersViaRest,
  fsStateLoadFloorstockViaSdk: fsStateLoadFloorstockViaSdk,
  fsStateLoadUsersViaSdk: fsStateLoadUsersViaSdk,
  fsStateFirstSuccess: fsStateFirstSuccess,
  fsStateRestSetDocument: fsStateRestSetDocument,
  fsStateRestDeleteDocument: fsStateRestDeleteDocument,
  fsStateSdkSetDocument: fsStateSdkSetDocument,
  fsStateSdkDeleteDocument: fsStateSdkDeleteDocument,
  fsStateSetSmart: fsStateSetSmart,
  fsStateDeleteSmart: fsStateDeleteSmart,
  fsStateApplyCache: fsStateApplyCache,
  warnPublicSync: warnPublicSync,
  syncPublicExpiry: syncPublicExpiry,
  fsR17Now: fsR17Now,
  fsR17MedNorm: fsR17MedNorm,
  fsR17MedIdentity: fsR17MedIdentity,
  fsR17UniqueNames: fsR17UniqueNames,
  fsR17MedId: fsR17MedId,
  fsR17NormalizeMed: fsR17NormalizeMed,
  fsR17NormalizeMeds: fsR17NormalizeMeds,
  getMeds: getMeds,
  setMeds: setMeds,
  pushMed: pushMed,
  updMed: updMed,
  delMed: delMed,
  fsR17SameMedicine: fsR17SameMedicine,
  fsR17Hash: fsR17Hash,
  fsR18ExpiryId: fsR18ExpiryId,
  fsR17NormalizeExpiryRow: fsR17NormalizeExpiryRow,
  fsR18NormalizeExpiryRows: fsR18NormalizeExpiryRows,
  fsR18ExpiryComparable: fsR18ExpiryComparable,
  getExpiry: getExpiry,
  fsR18ReadExpiry: fsR18ReadExpiry,
  setExpiry: setExpiry,
  addExpBatch: addExpBatch,
  delExpBatch: delExpBatch,
  updExpBatch: updExpBatch,
  getShelves: getShelves,
  setShelves: setShelves,
  addShelf: addShelf,
  delShelf: delShelf,
  updShelf: updShelf,
  getAlertSettings: getAlertSettings,
  setAlertSettings: setAlertSettings,
  gd: gd,
  repairDeletedDepartments: repairDeletedDepartments,
  gu: gu,
  gr: gr,
  fmtDate: fmtDate,
  fmtDateTime: fmtDateTime,
  daysUntil: daysUntil,
  todayISO: todayISO,
  nowISO: nowISO,
  uiDialog: uiDialog,
  uiPrompt: uiPrompt,
  uiConfirm: uiConfirm,
  toast: toast,
  bdg: bdg,
  rowCls: rowCls,
  OM: OM,
  el: el,
  esc: esc,
  getAppUrl: getAppUrl,
  getPublicExpiryUrl: getPublicExpiryUrl,
  getMobileRequestUrl: getMobileRequestUrl,
  toggleTheme: toggleTheme,
  applyTheme: applyTheme,
  autoDetectCat: autoDetectCat,
  selRole: selRole,
  fillDS: fillDS,
  fsLoginTimeout: fsLoginTimeout,
  fsLoginRestValue: fsLoginRestValue,
  fsLoginDecodeRestDocument: fsLoginDecodeRestDocument,
  fsLoginSnapshot: fsLoginSnapshot,
  fsLoginFetchJson: fsLoginFetchJson,
  fsLoadProfileViaRest: fsLoadProfileViaRest,
  fsLoadProfileViaSdk: fsLoadProfileViaSdk,
  fsLoadAuthenticatedProfile: fsLoadAuthenticatedProfile,
  doLogin: doLogin,
  doLogout: doLogout,
  renderPageById: renderPageById,
  refreshCurrentPage: refreshCurrentPage,
  runBaseShowPg: runBaseShowPg,
  getInvDept: getInvDept,
  populateInvDeptSel: populateInvDeptSel,
  renderDash: renderDash,
  renderInv: renderInv,
  openAddDrug: openAddDrug,
  openEditDrug: openEditDrug,
  delDrug: delDrug,
  showDupPanel: showDupPanel,
  toggleDupAll: toggleDupAll,
  deleteSelected: deleteSelected,
  filterR: filterR,
  renderReqs: renderReqs,
  rcard: rcard,
  viewReq: viewReq,
  openFulfill: openFulfill,
  valQ: valQ,
  cntItems: cntItems,
  renderMyReqs: renderMyReqs,
  ctlCatalog: ctlCatalog,
  ctlSetCatalog: ctlSetCatalog,
  ctlWarehouse: ctlWarehouse,
  ctlSetWarehouse: ctlSetWarehouse,
  ctlPharmacy: ctlPharmacy,
  ctlSetPharmacy: ctlSetPharmacy,
  ctlDeptList: ctlDeptList,
  ctlSetDeptList: ctlSetDeptList,
  ctlMoves: ctlMoves,
  ctlSaveMovementLog: ctlSaveMovementLog,
  ctlIsOfficer: ctlIsOfficer,
  ctlIsWarehouse: ctlIsWarehouse,
  ctlDate: ctlDate,
  ctlNum: ctlNum,
  ctlKey: ctlKey,
  ctlMedicine: ctlMedicine,
  ctlBatchText: ctlBatchText,
  ctlCurrentDept: ctlCurrentDept,
  renderCtlPending: renderCtlPending,
  renderCtlLog: renderCtlLog,
  ctlSendToPharmacy: ctlSendToPharmacy,
  ctlReceiveDelivery: ctlReceiveDelivery,
  ctlAssignMedicineToDept: ctlAssignMedicineToDept,
  ctlRemoveDeptMedicine: ctlRemoveDeptMedicine,
  ctlImportRows: ctlImportRows,
  ctlImportMasterFile: ctlImportMasterFile,
  ctlImportMasterText: ctlImportMasterText,
  FIREBASE_CONFIG: globalThis.FIREBASE_CONFIG,
  _lazyScripts: globalThis._lazyScripts,
  renderInvDebounced: globalThis.renderInvDebounced,
  renderReqFormDebounced: globalThis.renderReqFormDebounced,
  renderControlledDebounced: globalThis.renderControlledDebounced,
  _firebasePersistenceAttempted: globalThis._firebasePersistenceAttempted,
  _firebaseReadyPromise: globalThis._firebaseReadyPromise,
  _pendingWrites: globalThis._pendingWrites,
  _trackedSaves: globalThis._trackedSaves,
  _lastSaveFailure: globalThis._lastSaveFailure,
  S: globalThis.S,
  _publicSyncWarningAt: globalThis._publicSyncWarningAt,
  FS_R17_MED_MIGRATION_PENDING: globalThis.FS_R17_MED_MIGRATION_PENDING,
  FS_R18_EXPIRY_MIGRATION_PENDING: globalThis.FS_R18_EXPIRY_MIGRATION_PENDING,
  _gdRawRef: globalThis._gdRawRef,
  _gdDeletedRef: globalThis._gdDeletedRef,
  _gdFiltered: globalThis._gdFiltered,
  _deletedDeptRepairBusy: globalThis._deletedDeptRepairBusy,
  MEDS: globalThis.MEDS,
  CU: globalThis.CU,
  RFS: globalThis.RFS,
  EDID: globalThis.EDID,
  FRID: globalThis.FRID,
  IROWS: globalThis.IROWS,
  SROLE: globalThis.SROLE,
  CTL_VIEW: globalThis.CTL_VIEW
};
publishLegacy("03-core-application-firebase-state-auth.js", __asdhLegacyApi);
export {
  loadScriptOnce,
  ensurePDFJS,
  ensureZXing,
  ensureFirebaseFunctions,
  debounce,
  initFirebase,
  waitForFirebase,
  _trackSave,
  stateValueEqual,
  fsStateRestEncode,
  fsStateToken,
  fsStateRestBase,
  fsStateRestRequest,
  fsStateRestListCollection,
  fsStateLoadFloorstockViaRest,
  fsStateLoadUsersViaRest,
  fsStateLoadFloorstockViaSdk,
  fsStateLoadUsersViaSdk,
  fsStateFirstSuccess,
  fsStateRestSetDocument,
  fsStateRestDeleteDocument,
  fsStateSdkSetDocument,
  fsStateSdkDeleteDocument,
  fsStateSetSmart,
  fsStateDeleteSmart,
  fsStateApplyCache,
  warnPublicSync,
  syncPublicExpiry,
  fsR17Now,
  fsR17MedNorm,
  fsR17MedIdentity,
  fsR17UniqueNames,
  fsR17MedId,
  fsR17NormalizeMed,
  fsR17NormalizeMeds,
  getMeds,
  setMeds,
  pushMed,
  updMed,
  delMed,
  fsR17SameMedicine,
  fsR17Hash,
  fsR18ExpiryId,
  fsR17NormalizeExpiryRow,
  fsR18NormalizeExpiryRows,
  fsR18ExpiryComparable,
  getExpiry,
  fsR18ReadExpiry,
  setExpiry,
  addExpBatch,
  delExpBatch,
  updExpBatch,
  getShelves,
  setShelves,
  addShelf,
  delShelf,
  updShelf,
  getAlertSettings,
  setAlertSettings,
  gd,
  repairDeletedDepartments,
  gu,
  gr,
  fmtDate,
  fmtDateTime,
  daysUntil,
  todayISO,
  nowISO,
  uiDialog,
  uiPrompt,
  uiConfirm,
  toast,
  bdg,
  rowCls,
  OM,
  el,
  esc,
  getAppUrl,
  getPublicExpiryUrl,
  getMobileRequestUrl,
  toggleTheme,
  applyTheme,
  autoDetectCat,
  selRole,
  fillDS,
  fsLoginTimeout,
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
  filterR,
  renderReqs,
  rcard,
  viewReq,
  openFulfill,
  valQ,
  cntItems,
  renderMyReqs,
  ctlCatalog,
  ctlSetCatalog,
  ctlWarehouse,
  ctlSetWarehouse,
  ctlPharmacy,
  ctlSetPharmacy,
  ctlDeptList,
  ctlSetDeptList,
  ctlMoves,
  ctlSaveMovementLog,
  ctlIsOfficer,
  ctlIsWarehouse,
  ctlDate,
  ctlNum,
  ctlKey,
  ctlMedicine,
  ctlBatchText,
  ctlCurrentDept,
  renderCtlPending,
  renderCtlLog,
  ctlSendToPharmacy,
  ctlReceiveDelivery,
  ctlAssignMedicineToDept,
  ctlRemoveDeptMedicine,
  ctlImportRows,
  ctlImportMasterFile,
  ctlImportMasterText
};
export const legacyVariableNames = Object.freeze(["FIREBASE_CONFIG", "_lazyScripts", "renderInvDebounced", "renderReqFormDebounced", "renderControlledDebounced", "_firebasePersistenceAttempted", "_firebaseReadyPromise", "_pendingWrites", "_trackedSaves", "_lastSaveFailure", "S", "_publicSyncWarningAt", "FS_R17_MED_MIGRATION_PENDING", "FS_R18_EXPIRY_MIGRATION_PENDING", "_gdRawRef", "_gdDeletedRef", "_gdFiltered", "_deletedDeptRepairBusy", "MEDS", "CU", "RFS", "EDID", "FRID", "IROWS", "SROLE", "CTL_VIEW"]);
export default __asdhLegacyApi;

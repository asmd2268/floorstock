import { SUBSCRIPTION_PLANS, planFor, subscriptionIsWritable } from '../core/subscription-plans.js?v=c2e8c1c94f';

(function(){
'use strict';
var E=window.fsE,contextBusy=false,lastUid='',wrapped=false,navigationWrapped=false;
var PAGE_FEATURES={
  'pg-analytics':'analytics','pg-crashcart':'crash_cart','pg-crash-ops':'crash_cart',
  'pg-controlled':'controlled','pg-ctl-analytics':'controlled','pg-med-accountability':'controlled',
  'pg-zebra-labels':'labels','pg-print':'printing','pg-deptprint':'printing'
};
window.FS_SUBSCRIPTION=null;window.FS_PLATFORM_ADMIN=false;window.FS_SAAS_READY=false;window.FS_SUBSCRIPTION_PLANS=SUBSCRIPTION_PLANS;
var esc=window.fsEsc;
function tenantId(){return String(window.CU&&CU.tenantId||'').trim()}
function featureSet(){var sub=window.FS_SUBSCRIPTION||{},plan=planFor(sub.plan),list=Array.isArray(sub.features)&&sub.features.length?sub.features:plan.features;return new Set(list)}
window.fsHasSubscriptionFeature=function(feature){return !tenantId()||featureSet().has(String(feature||''))};
window.fsSubscriptionCanWrite=function(){return !tenantId()||subscriptionIsWritable(window.FS_SUBSCRIPTION)};
window.fsSubscriptionLimit=function(name){if(!tenantId())return null;var plan=planFor((window.FS_SUBSCRIPTION||{}).plan);return plan[name]==null?null:Number(plan[name])};
/* Every other navigation icon is static markup and paints with the shell; this
   one waited on getSaasContext, a Cloud Function round trip, so on a slow link the
   Subscriptions tab appeared seconds after everything else — and so did the
   feature gating that hides pages a plan does not include.

   The answer barely changes between sessions, so the last one is remembered per
   account and applied immediately on boot, then corrected when the live call
   returns. Same warm-boot shape the state layer already uses. The cache is keyed
   by uid so one account can never see another's plan, and it only ever affects
   what is SHOWN — firestore.rules and the callables remain the authority on what
   a plan may actually do. */
var SAAS_CACHE_PREFIX='fs_saas_context_v1_';
function saasCacheKey(uid){return uid?SAAS_CACHE_PREFIX+uid:''}
function readCachedContext(uid){
  var key=saasCacheKey(uid);if(!key)return null;
  try{
    var raw=localStorage.getItem(key);if(!raw)return null;
    var parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch(error){return null}
}
/* The customer list has the same problem the context had, one screen further in:
   opening Subscriptions blanked the list to "Loading…" and waited on
   listTenantSubscriptions — a callable with no warm instance, called from Saudi
   Arabia to us-central1, so a cold start is seconds of an empty page. The list
   barely changes between visits, so the last one is shown immediately and
   replaced when the live answer lands. Cached per account like the context, and
   read-only: every write still goes through the callable. */
function tenantsCacheKey(uid){return uid?SAAS_CACHE_PREFIX+'tenants_'+uid:''}
function readCachedTenants(uid){
  var key=tenantsCacheKey(uid);if(!key)return null;
  try{
    var raw=localStorage.getItem(key);if(!raw)return null;
    var parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed:null;
  }catch(error){return null}
}
function writeCachedTenants(uid,rows){
  var key=tenantsCacheKey(uid);if(!key)return;
  try{localStorage.setItem(key,JSON.stringify(rows||[]))}catch(error){}
}
function currentUid(){return String(window.FB_AUTH&&FB_AUTH.currentUser&&FB_AUTH.currentUser.uid||'')}
function writeCachedContext(uid,data){
  var key=saasCacheKey(uid);if(!key)return;
  try{
    // Drop every other account's cached context, so a shared device cannot show
    // a previous user's plan for the instant before the live call lands.
    Object.keys(localStorage).forEach(function(name){
      if(name.indexOf(SAAS_CACHE_PREFIX)===0&&name!==key&&name!==tenantsCacheKey(uid))localStorage.removeItem(name);
    });
    localStorage.setItem(key,JSON.stringify({platformAdmin:data.platformAdmin===true,subscription:data.subscription||null}));
  }catch(error){}
}

async function callable(name,data){if(typeof window.fsCallFunction!=='function')throw new Error('Subscription service is unavailable.');return window.fsCallFunction(name,data||{})}
function planLabel(sub){var p=planFor(sub&&sub.plan);return p.nameAr+' / '+p.nameEn}
function banner(){var old=E('fs-subscription-banner');if(old)old.remove();if(!window.CU||!tenantId())return;var sub=window.FS_SUBSCRIPTION||{},writable=window.fsSubscriptionCanWrite(),box=document.createElement('div');box.id='fs-subscription-banner';box.className=writable?'fs-subscription-banner':'fs-subscription-banner expired';box.innerHTML='<div><b>'+esc((CU.tenantName||sub.tenantName||tenantId()))+'</b><small>'+esc(planLabel(sub))+' · '+esc(sub.status||'pending')+'</small></div>'+(writable?'':'<strong>انتهى الاشتراك — وضع القراءة فقط<br><small>Subscription expired — read-only mode</small></strong>');var nav=E('mnav');if(nav&&nav.parentNode)nav.parentNode.insertBefore(box,nav.nextSibling)}
/* FS_PLATFORM_ADMIN describes the signed-in account, which stays true while a
   master is previewing another role — so the Subscriptions tab kept appearing in
   every previewed role. The preview is meant to show what that role actually
   sees, so the tab is hidden whenever one is active. MASTER_EFFECTIVE is the
   preview flag used elsewhere for exactly this distinction. */
function platformAdminVisible(){
  return !!window.FS_PLATFORM_ADMIN && !window.MASTER_EFFECTIVE;
}
function applyFeatures(){if(!window.CU)return;Object.keys(PAGE_FEATURES).forEach(function(page){var allowed=window.fsHasSubscriptionFeature(PAGE_FEATURES[page]),node=E(page);if(node)node.dataset.subscriptionLocked=allowed?'0':'1';document.querySelectorAll('#mnav [data-pg="'+page+'"]').forEach(function(button){button.style.display=allowed?'':'none'})});banner();if(platformAdminVisible()){installPlatformPage()}else{document.querySelectorAll('#mnav [data-pg="pg-platform-subscriptions"]').forEach(function(b){b.remove()});var pgEl=document.getElementById('pg-platform-subscriptions');if(pgEl&&pgEl.classList.contains('on')&&typeof window.showPg==='function')window.showPg('pg-dash')}}
function departmentLimitExceeded(method,args){var limit=window.fsSubscriptionLimit('maxDepartments');if(limit===null)return false;var key=String(args[0]||'');if(key!=='departments')return false;var count=Array.isArray(S.g('departments'))?S.g('departments').length:0;if(method==='s'&&Array.isArray(args[1]))count=args[1].length;else if(method==='push')count+=1;return count>limit}
function wrapWrites(){if(wrapped||!window.S)return;wrapped=true;['s','rm','push','upd','del'].forEach(function(name){var original=S[name];if(typeof original!=='function')return;S[name]=function(){if(tenantId()&&!window.FS_SAAS_READY)return Promise.reject(new Error('Subscription status is still loading.'));if(!window.fsSubscriptionCanWrite()){if(typeof window.toast==='function')toast('انتهى الاشتراك. النظام متاح للقراءة فقط.\nSubscription expired. The system is read-only.','err');return Promise.reject(new Error('Subscription is read-only'))}if(departmentLimitExceeded(name,arguments)){var message='وصلت للحد الأعلى للأقسام في هذه الخطة.\nDepartment limit reached for this plan.';if(typeof window.toast==='function')toast(message,'err');return Promise.reject(new Error(message))}return original.apply(S,arguments)}})}
function wrapNavigation(){if(navigationWrapped||typeof window.showPg!=='function')return;window.__showPgGuards=window.__showPgGuards||[];window.__showPgGuards.push(function(id){if(id==='pg-platform-subscriptions'&&!platformAdminVisible())return false;var page=E(id),feature=PAGE_FEATURES[id];if(tenantId()&&feature&&!window.fsHasSubscriptionFeature(feature)){if(typeof window.toast==='function')toast('هذه الميزة غير مشمولة في اشتراكك.\nThis feature is not included in your plan.','err');return false}if(page&&page.dataset.subscriptionLocked==='1')return false;return true});navigationWrapped=true}
async function refreshContext(){var uid=String(window.FB_AUTH&&FB_AUTH.currentUser&&FB_AUTH.currentUser.uid||'');if(!uid||contextBusy)return;if(uid===lastUid&&window.FS_SAAS_READY){applyFeatures();return}
  window.FS_PLATFORM_ADMIN=false;window.FS_SAAS_READY=false;
  // Paint from the last known answer for THIS account so the tab and the feature
  // gating appear with the rest of the shell; the live call below corrects it.
  var cached=readCachedContext(uid);
  if(cached){window.FS_PLATFORM_ADMIN=cached.platformAdmin===true;window.FS_SUBSCRIPTION=cached.subscription||null;applyFeatures()}
  contextBusy=true;try{var data=await callable('getSaasContext');window.FS_PLATFORM_ADMIN=data.platformAdmin===true;window.FS_SUBSCRIPTION=data.subscription||null;window.FS_SAAS_READY=true;lastUid=uid;writeCachedContext(uid,data);applyFeatures()}catch(error){console.error('SaaS context load failed',error);window.FS_SAAS_READY=!tenantId();applyFeatures()}finally{contextBusy=false}}
function platformHtml(){return '<div class="pg" id="pg-platform-subscriptions"><div class="stitle">إدارة الاشتراكات / Subscription Management</div><div class="ssub">إنشاء منشآت وتفعيل الخطط يدويًا</div><div class="card"><div class="ch"><span class="ct">+ عميل جديد / New customer</span></div><div class="cb fs-saas-grid"><div><label>اسم المنشأة</label><input id="fs-tenant-name"></div><div><label>رمز المنشأة</label><input id="fs-tenant-id" placeholder="hospital-name"></div><div><label>بريد المالك</label><input id="fs-owner-email" type="email"></div><div><label>كلمة المرور المؤقتة</label><input id="fs-owner-password" type="password"></div><div><label>الخطة</label><select id="fs-new-plan"><option value="starter">الأساسية / Starter</option><option value="professional">الاحترافية / Professional</option><option value="enterprise">الشاملة / Enterprise</option></select></div><div><label>أيام التجربة</label><input id="fs-trial-days" type="number" min="0" value="14"></div></div><div class="cb"><button class="btn bp" id="fs-create-tenant">إنشاء العميل / Create customer</button><span id="fs-platform-status"></span></div></div><div id="fs-tenant-list"></div></div>'}
function installPlatformPage(){if(!E('pg-platform-subscriptions')){E('app').insertAdjacentHTML('beforeend',platformHtml());E('fs-create-tenant').onclick=createTenant}var nav=E('mnav');if(nav&&!nav.querySelector('[data-pg="pg-platform-subscriptions"]')){var b=document.createElement('button');b.className='nb';b.dataset.pg='pg-platform-subscriptions';b.textContent='💳 الاشتراكات';b.onclick=function(){if(typeof showPg==='function')showPg('pg-platform-subscriptions');loadTenants()};nav.appendChild(b)}}
async function createTenant(){var button=E('fs-create-tenant'),status=E('fs-platform-status');button.disabled=true;status.textContent='جاري الإنشاء…';try{await callable('createTenantSubscription',{tenantId:E('fs-tenant-id').value,name:E('fs-tenant-name').value,ownerEmail:E('fs-owner-email').value,password:E('fs-owner-password').value,plan:E('fs-new-plan').value,trialDays:Number(E('fs-trial-days').value)});status.textContent='تم إنشاء العميل ✓';await loadTenants()}catch(e){status.textContent=String(e&&e.message||e)}finally{button.disabled=false}}
function renderTenants(host,rows,stale){
  host.innerHTML=(stale?'<div class="fhint" style="margin-bottom:8px">Showing the last known list — refreshing… / تُعرض آخر قائمة معروفة، جارٍ التحديث…</div>':'')+rows.map(function(t){return '<div class="card fs-tenant-card" data-tenant="'+esc(t.id)+'"><div><b>'+esc(t.name||t.id)+'</b><small>'+esc(t.ownerEmail||'')+'</small></div><select data-field="plan"><option value="starter" '+(t.plan==='starter'?'selected':'')+'>Starter</option><option value="professional" '+(t.plan==='professional'?'selected':'')+'>Professional</option><option value="enterprise" '+(t.plan==='enterprise'?'selected':'')+'>Enterprise</option></select><select data-field="status"><option value="trialing" '+(t.status==='trialing'?'selected':'')+'>Trial</option><option value="active" '+(t.status==='active'?'selected':'')+'>Active</option><option value="past_due" '+(t.status==='past_due'?'selected':'')+'>Past due</option><option value="canceled" '+(t.status==='canceled'?'selected':'')+'>Canceled</option></select><button class="btn bs bsm" data-save-subscription>حفظ / Save</button></div>'}).join('')||'<div class="card"><div class="cb">No customers yet.</div></div>';host.querySelectorAll('[data-save-subscription]').forEach(function(button){button.onclick=async function(){var card=button.closest('[data-tenant]');button.disabled=true;try{await callable('updateTenantSubscription',{tenantId:card.dataset.tenant,plan:card.querySelector('[data-field="plan"]').value,status:card.querySelector('[data-field="status"]').value});button.textContent='Saved ✓';loadTenants()}catch(e){if(typeof toast==='function')toast(String(e&&e.message||e),'err')}finally{button.disabled=false}}});
}

async function loadTenants(){
  var host=E('fs-tenant-list');if(!host)return;
  var uid=currentUid(),cached=readCachedTenants(uid);
  // Something to read while the callable wakes up, rather than an empty panel.
  if(cached&&cached.length)renderTenants(host,cached,true);
  else host.innerHTML='<div class="card"><div class="cb">Loading…</div></div>';
  try{
    var data=await callable('listTenantSubscriptions'),rows=data.tenants||[];
    writeCachedTenants(uid,rows);
    renderTenants(host,rows,false);
  }catch(e){
    // A cached list stays on screen and says why it may be out of date; without
    // one there is nothing to keep, so the error is all there is to show.
    if(cached&&cached.length)renderTenants(host,cached,true);
    else host.textContent=String(e&&e.message||e);
    if(typeof toast==='function')toast(String(e&&e.message||e),'err');
  }
}
var style=document.createElement('style');style.textContent='.fs-subscription-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 18px;background:rgba(46,160,67,.1);border-bottom:1px solid var(--gn)}.fs-subscription-banner small,.fs-tenant-card small{display:block;color:var(--tx2);font-size:11px}.fs-subscription-banner.expired{background:rgba(218,54,51,.12);border-color:var(--rd)}[data-subscription-locked="1"]{display:none!important}.fs-saas-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px}.fs-tenant-card{display:grid;grid-template-columns:minmax(220px,1fr) 180px 160px auto;gap:10px;align-items:center;padding:12px}.fs-tenant-card select{margin:0}@media(max-width:800px){.fs-saas-grid,.fs-tenant-card{grid-template-columns:1fr}}';document.head.appendChild(style);
/* This ran every 1.2s for the life of the session. wrapWrites and wrapNavigation
   are one-time installs guarded by their own flags — they were polled only because
   S and showPg may not exist yet when this module evaluates. refreshContext
   re-fetches when the signed-in uid changes, and applyFeatures re-applies the
   subscription gating to the nav; both belong to login, role switching and
   navigation, which is exactly when buildNav and showPg run. Each is idempotent,
   so being called from both hooks costs nothing. */
function installAndApply(){wrapWrites();wrapNavigation();refreshContext();applyFeatures()}
installAndApply();
window.__buildNavAfterExtensions=window.__buildNavAfterExtensions||[];
window.__buildNavAfterExtensions.push(installAndApply);
window.__showPgAfterExtensions=window.__showPgAfterExtensions||[];
window.__showPgAfterExtensions.push(installAndApply);
/* The one case neither hook covers: the app boots and signs in before this module
   has a subscription context, and nothing navigates afterwards. A single deferred
   pass closes that without leaving a timer running. */
if(typeof document!=='undefined')document.addEventListener('asdh:real-load-complete',installAndApply);
})();

export {};

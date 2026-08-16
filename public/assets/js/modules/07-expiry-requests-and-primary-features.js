import { publishLegacy } from '../core/legacy-registry.js';

import { getMonthlyReqCount as canonicalMonthlyReqCount } from '../core/schedule-limits.js';

function startApp(){
  if(typeof window.preparePreviewStart==='function')window.preparePreviewStart();
  if(typeof window.prepareRoleUiStart==='function')window.prepareRoleUiStart();
  if(CU&&CU.master===true&&!MASTER_EFFECTIVE&&!MASTER_ACTUAL)MASTER_ACTUAL=Object.assign({},CU);
    el('auth').style.display='none';el('app').style.display='block';
    el('tuser').textContent=['pharmacy','controlled_pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(CU.role)>=0?'👤 '+CU.username:(CU.role==='warehouse'?'📦 '+CU.username:'🏢 '+CU.deptName);
    var rb=el('rbadge');
    rb.innerHTML=CU.role==='pharmacy'?'🏥 Pharmacy'+(CU.master===true?' · Master':'')
      :CU.role==='controlled_pharmacy'?'🔒 Controlled Medicines Pharmacy Officer'
      :CU.role==='warehouse'?'📦 Warehouse Custody Officer'
      :CU.role==='inpatient_supervisor'?'🏥 Inpatient Pharmacy Supervisor / مشرف الصيدلية الداخلية'
      :CU.role==='outpatient_pharmacy_supervisor'?'🏥 Outpatient Pharmacy Supervisor'
      :CU.role==='pharmacy_staff'?'💊 Pharmacy Staff'
      :'🏢 '+CU.deptName;
    rb.className='trole '+(['pharmacy','controlled_pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(CU.role)>=0?'rph':'rdp');
    buildNav();
    var initialPage=CU.role==='department'?'pg-newreq':((CU.role==='warehouse'||CU.role==='controlled_pharmacy')?'pg-controlled':'pg-dash');
    showPg(initialPage);
    updateNotesBadge();
  document.body.classList.remove('role-pharmacy_staff','role-inpatient_supervisor');
  if(CU)document.body.classList.add('role-'+CU.role);
  if(MASTER_EFFECTIVE&&MASTER_ACTUAL){
    el('tuser').textContent='👤 '+(MASTER_ACTUAL.email||MASTER_ACTUAL.username||'Master')+' → testing '+(MASTER_EFFECTIVE.email||'user');
    var rb=el('rbadge');if(rb)rb.innerHTML='🧪 '+masterRoleLabel(MASTER_EFFECTIVE.role)+(MASTER_EFFECTIVE.deptName?' · '+esc(MASTER_EFFECTIVE.deptName):'');
  }
  addMasterSwitchButton();
  scheduleAutomaticOrderCleanup();
  if(!canManageUsers()){
    var ub=document.querySelector('[data-pg="pg-users"]');if(ub)ub.remove();
  }
  if(typeof window.addMasterCleanupButton==='function')window.addMasterCleanupButton();
  if(typeof window.prepareControlledStartup==='function')window.prepareControlledStartup();
  if(typeof window.syncOfficialHeaderButton==='function')window.syncOfficialHeaderButton();
  if(typeof window.runDailyBackup==='function')window.runDailyBackup();
  repairDeletedDepartments();
  setTimeout(function(){if(typeof window.fsR17MigrateMedicationIdentity==='function')window.fsR17MigrateMedicationIdentity().catch(function(e){console.warn('Medication identity migration skipped',e)})},700);
  if(typeof window.runExpiryStartupAlert==='function')window.runExpiryStartupAlert();
  if(typeof window.finalizeRoleUiStart==='function')window.finalizeRoleUiStart();
  if(typeof window.finalizePreviewStart==='function')window.finalizePreviewStart();
}
// Publish the canonical startup entry point explicitly. Inline handlers and
// authentication live in earlier script blocks, so relying only on an implicit
// cross-script global causes intermittent "startApp is not defined" failures
// in stricter WebKit/Safari execution environments.
window.startApp=startApp;
// ── BOOT ─────────────────────────────────────────────────
function boot(){
  try{
    initFirebase();
    var view=new URLSearchParams(window.location.search).get('view');
    if(view==='expiry'||view==='controlled-expiry'||view==='crash-cart-public'){
      var auth=el('auth'),app=el('app');if(auth)auth.style.display='none';if(app)app.style.display='none';
      return;
    }
    if(view==='request'){checkPublicView();return;}
    applyTheme();
  }
  catch(err){console.error(err);el('aerr').textContent='Firebase failed to initialize. Check the connection and Firebase setup.';el('aerr').style.display='block';}
}
boot();
document.addEventListener('visibilitychange',function(){
  if(document.hidden){if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();return}
  if(S.ready&&CU)S.scheduleRefresh();
});
// Expiry check after authenticated app startup.
window.runExpiryStartupAlert=function(){
  if(!S.ready||!CU||document.visibilityState!=='visible')return;
  var alerts=[];
  gd().forEach(function(dept){
    var exp=getExpiry(dept.id);
    var ms=getMeds(dept.id);
    var cfg=getAlertSettings(dept.id);
    (Array.isArray(exp)?exp:[]).forEach(function(batch){
      var medId=batch&&batch.medId;
      var m=ms.find(function(x){return String(x.id)===String(medId)});
      if(!m)return;
      var days=daysUntil((batch&&batch.date)||(batch&&batch.expiry));
      if(days!==null&&days<=cfg.d2){alerts.push(dept.name+': '+m.name+' ('+days+'d)');}
    });
  });
  var alertRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
  if(alerts.length&&['pharmacy','pharmacy_manager','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(alertRole)<0)toast('⚠ Expiry alert: '+alerts.slice(0,3).join(', ')+(alerts.length>3?' +more':''),'info');
};


const __asdhLegacyApi = {
  startApp: startApp,
  boot: boot,
  canonicalRenderShelfAlertSettings: globalThis.canonicalRenderShelfAlertSettings,
  canonicalOpenAddExpiry: globalThis.canonicalOpenAddExpiry,
  canonicalOpenEditExpiry: globalThis.canonicalOpenEditExpiry,
  canonicalOrderRetentionCutoff: globalThis.canonicalOrderRetentionCutoff,
  canonicalRequestArchiveRecord: globalThis.canonicalRequestArchiveRecord,
  canonicalCleanupOldOrders: globalThis.canonicalCleanupOldOrders,
  canonicalScheduleAutomaticOrderCleanup: globalThis.canonicalScheduleAutomaticOrderCleanup,
  canonicalGetNextDispSlot: globalThis.canonicalGetNextDispSlot,
  canonicalFmt12: globalThis.canonicalFmt12,
  canonicalDayBits: globalThis.canonicalDayBits,
  canonicalTimeToMins: globalThis.canonicalTimeToMins,
  canonicalEnsureXLSX: globalThis.canonicalEnsureXLSX,
  canonicalGetCatOptions: globalThis.canonicalGetCatOptions,
  canonicalSetPPP: globalThis.canonicalSetPPP,
  canonicalResetPrintPageState: globalThis.canonicalResetPrintPageState,
  _scanReader: globalThis._scanReader,
  _scanStream: globalThis._scanStream,
  _parsedScan: globalThis._parsedScan,
  _parsedType: globalThis._parsedType,
  DEFAULT_CATS: globalThis.DEFAULT_CATS,
  canonicalGetMonthlyLimit: globalThis.canonicalGetMonthlyLimit,
  CTL_PDF_REVIEW: globalThis.CTL_PDF_REVIEW,
  CTL_BATCH_CTX: globalThis.CTL_BATCH_CTX,
  CTL_DEPT_SELECTED: globalThis.CTL_DEPT_SELECTED,
  MASTER_ACTUAL: globalThis.MASTER_ACTUAL,
  MASTER_EFFECTIVE: globalThis.MASTER_EFFECTIVE,
  SHELF_MED_SELECTED: globalThis.SHELF_MED_SELECTED
};
publishLegacy("07-expiry-requests-and-primary-features.js", __asdhLegacyApi);
// Must run AFTER publishLegacy: __asdhLegacyApi.startApp captured the raw
// named function by reference at object-literal time, and publishLegacy
// reassigns globalThis[name] for every entry — wrapping window.startApp
// before this point would get silently overwritten back to the raw function.
//
// Other modules used to each capture the previous startApp and reassign the
// global with their own wrapper — one such reassignment per extension. That
// pattern grew to 7 nested layers across 5 files, which made the boot
// sequence hard to read and each layer a candidate to silently break the
// chain. Replaced with a single wrapper here plus an explicit registry:
// extensions call window.__startAppExtensions.push(fn) (after core startApp
// runs) or window.__startAppBeforeExtensions.push(fn) (before it runs)
// instead of reassigning window.startApp themselves. Execution order is
// preserved exactly — extensions still run in the same module-load order as
// before, since each module's top-level push() runs at exactly the point
// its old reassignment used to.
window.__startAppBeforeExtensions=window.__startAppBeforeExtensions||[];
window.__startAppExtensions=window.__startAppExtensions||[];
(function(){
  var core=window.startApp;
  window.startApp=function(){
    var self=this,args=arguments;
    window.__startAppBeforeExtensions.forEach(function(fn){try{fn.apply(self,args)}catch(e){console.error('startApp before-extension failed',e)}});
    var result=core.apply(this,arguments);
    window.__startAppExtensions.forEach(function(fn){try{fn.apply(self,args)}catch(e){console.error('startApp extension failed',e)}});
    return result;
  };
})();
export {
  startApp,
  boot
};
export const legacyVariableNames = Object.freeze(["canonicalRenderShelfAlertSettings", "canonicalOpenAddExpiry", "canonicalOpenEditExpiry", "canonicalOrderRetentionCutoff", "canonicalRequestArchiveRecord", "canonicalCleanupOldOrders", "canonicalScheduleAutomaticOrderCleanup", "canonicalGetNextDispSlot", "canonicalFmt12", "canonicalDayBits", "canonicalTimeToMins", "canonicalEnsureXLSX", "canonicalGetCatOptions", "canonicalSetPPP", "canonicalResetPrintPageState", "_scanReader", "_scanStream", "_parsedScan", "_parsedType", "DEFAULT_CATS", "canonicalGetMonthlyLimit", "CTL_PDF_REVIEW", "CTL_BATCH_CTX", "CTL_DEPT_SELECTED", "MASTER_ACTUAL", "MASTER_EFFECTIVE", "SHELF_MED_SELECTED"]);
export default __asdhLegacyApi;

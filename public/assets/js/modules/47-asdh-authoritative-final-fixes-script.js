(function(){
'use strict';
var PREVIEW_KEY='asdh_master_role_preview_v3';
function E(id){return document.getElementById(id)}
function previewRead(){try{return JSON.parse(sessionStorage.getItem(PREVIEW_KEY)||'null')}catch(e){return null}}
function previewWrite(v){try{sessionStorage.setItem(PREVIEW_KEY,JSON.stringify(v));return true}catch(e){console.error(e);return false}}
function previewClear(){try{sessionStorage.removeItem(PREVIEW_KEY)}catch(e){}}
function deptZ(id){try{return ((typeof gd==='function'?gd():[])||[]).find(function(d){return String(d.id)===String(id)})||null}catch(e){return null}}
function toastZ(m,t){if(typeof toast==='function')toast(m,t||'info')}
var departmentLinksRepairBusyZ=false,departmentLinksRepairedZ=false;
async function repairDepartmentLinksZ(){
  if(departmentLinksRepairBusyZ||departmentLinksRepairedZ||!window.S||typeof S.g!=='function')return false;
  var deps=S.g('departments')||[];if(!Array.isArray(deps)||!deps.length)return false;
  var norm=function(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]/g,'')},byName={};
  deps.forEach(function(d){[d&&d.id,d&&d.name,d&&d.departmentName,d&&d.code,d&&d.shortName].forEach(function(k){if(k)byName[norm(k)]=String(d.id)})});
  departmentLinksRepairBusyZ=true;
  try{
    var carts=(S.g('crash_carts')||[]).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),cartChanged=false;
    carts.forEach(function(x){if(!x||x.departmentId||x.deptId)return;var id=byName[norm(x.departmentName||x.department||x.dept||x.deptName)];if(id){x.departmentId=id;x.deptId=id;cartChanged=true}});
    var requests=(S.g('requests')||[]).map(function(x){return x&&typeof x==='object'?Object.assign({},x):x}),requestChanged=false;
    requests.forEach(function(x){if(!x||x.departmentId||x.deptId)return;var id=byName[norm(x.departmentName||x.department||x.dept||x.deptName)];if(id){x.departmentId=id;x.deptId=id;requestChanged=true}});
    var jobs=[];
    /* Department sessions are read-only for cart stock. They may submit a
       report, but must never run a background migration against crash_carts. */
    var canWriteCart=typeof window.fsCanWriteStateKey!=='function'||window.fsCanWriteStateKey('crash_carts');
    if(cartChanged&&canWriteCart&&typeof setCrashCarts==='function')jobs.push(setCrashCarts(carts));
    if(requestChanged)jobs.push(S.s('requests',requests));
    if(jobs.length)await Promise.all(jobs);
    departmentLinksRepairedZ=true;
    if(jobs.length&&typeof refreshCurrentPage==='function')refreshCurrentPage();
    return jobs.length>0;
  }catch(e){console.error('Department link repair failed',e);return false}
  finally{departmentLinksRepairBusyZ=false}
}

/* A full reload is the authoritative role transition. It clears every stale page, modal,
   body class and delayed render callback left by Department preview mode. */
var previewStartSavedZ=null;
window.preparePreviewStart=function(){
  var saved=previewStartSavedZ=previewRead();
  var validPreviewRoles=['department','pharmacy','pharmacy_director','inpatient_supervisor','controlled_pharmacy','warehouse','pharmacy_staff'];
  if(saved&&validPreviewRoles.indexOf(String(saved.role||''))<0){previewClear();previewStartSavedZ=null;saved=null}
  if(saved&&window.CU&&CU.master===true){
    var actual=Object.assign({},CU),d=saved.deptId?deptZ(saved.deptId):null;
    window.MASTER_ACTUAL=actual;
    window.MASTER_EFFECTIVE={userId:'master-preview-'+saved.role,email:actual.email||actual.username||'Master',role:saved.role,deptId:saved.deptId||null,deptName:d?d.name:(saved.deptName||'')};
    window.CU={id:actual.id,username:actual.username||actual.email||'Master',email:actual.email||'',role:saved.role,master:false,deptId:saved.deptId||null,deptName:d?d.name:(saved.deptName||''),controlledCustodian:saved.role==='department'?true:!!actual.controlledCustodian};
  }else if(saved&&window.CU&&CU.master!==true){
    previewClear();previewStartSavedZ=null;
  }
};
window.finalizePreviewStart=function(){
  previewStartSavedZ=null;
  /* Data migrations are explicit maintenance actions, never page-load work.
     Running them during Crash Cart boot caused a valid read-only page to show
     a misleading Firebase save failure when a tenant was read-only or a role
     lacked the corresponding write permission. */
};


/* Keep every officer print option. Department employees retain only the one exact print action
   installed by asdh-final-department-controlled-fix-script. */
/* Crash Cart configuration permission is enforced by the canonical functions and renderer. */

/* Correct the wrongly labelled 4mg/ml Adrenaline entry in every Crash Cart.
   This is a persistent Firestore migration. The migration marker prevents the success
   message from appearing on every sign-in, while a silent scan still fixes any newly
   imported legacy record. */
var NOREPI_MIGRATION_KEY_Z='migration_crash_cart_norepinephrine_v3';
var repairBusyZ=false,repairDoneZ=false;
function norepiWordZ(v){return /(^|[^a-z])norepinephrine(?=$|[^a-z])/i.test(String(v||''))}
function adrenalineWordZ(v){return /(^|[^a-z])(adrenaline|epinephrine)(?=$|[^a-z])/i.test(String(v||''))}
function fourMgMlZ(v){return /(^|[^0-9])4\s*mg\s*(?:\/|per)?\s*ml(?=$|[^a-z0-9])/i.test(String(v||''))||/(^|[^a-z0-9])4mgml(?=$|[^a-z0-9])/i.test(String(v||''))}
function isWrongNorepiZ(it){
  var name=String((it&&it.name)||''),generic=String((it&&it.genericName)||''),strength=String((it&&it.strength)||''),concentration=String((it&&it.concentration)||'');
  var all=[name,generic,strength,concentration].join(' ');
  /* Word-boundary matching is intentional: "epinephrine" inside "norepinephrine"
     must never be treated as a separate Epinephrine medicine. */
  if(adrenalineWordZ(name+' '+generic)&&fourMgMlZ(all))return true;
  /* Canonicalize legacy Norepinephrine labels that still carry 4 mg/ml as the displayed strength. */
  if(norepiWordZ(name+' '+generic)){
    var canonicalName=name.trim().toLowerCase()==='norepinephrine';
    var canonicalGeneric=!generic||generic.trim().toLowerCase()==='norepinephrine';
    var canonicalStrength=strength.trim()==='1:1,000'&&concentration.trim()==='1:1,000';
    return !(canonicalName&&canonicalGeneric&&canonicalStrength);
  }
  return false;
}
async function repairNorepinephrineZ(force,silent){
  if(repairBusyZ||repairDoneZ||typeof crashCarts!=='function'||typeof setCrashCarts!=='function'||!window.S||typeof S.g!=='function'||typeof S.s!=='function')return;
  /* This is a database migration, not a login task for operational roles. */
  if(typeof window.fsCanWriteStateKey==='function'&&!window.fsCanWriteStateKey('crash_carts')){repairDoneZ=true;return}
  if(typeof window.fsCanWriteStateKey==='function'&&!window.fsCanWriteStateKey(NOREPI_MIGRATION_KEY_Z)){repairDoneZ=true;return}
  var previous=S.g(NOREPI_MIGRATION_KEY_Z)||null;
  var carts=(crashCarts()||[]).slice(),changed=0;repairBusyZ=true;
  carts.forEach(function(c){(c.items||[]).forEach(function(it){if(!isWrongNorepiZ(it))return;it.name='Norepinephrine';it.genericName='Norepinephrine';it.strength='1:1,000';it.concentration='1:1,000';it.updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();changed++})});
  try{
    if(changed){
      await setCrashCarts(carts);
      if(typeof auditAction==='function')auditAction('crash_cart_norepinephrine_name_correction',{items:changed,from:'Adrenaline/Epinephrine 4mg/ml',to:'Noradrenaline 1:1,000',migration:'v3'});
      if(typeof renderCrashCarts==='function')renderCrashCarts();
    }
    var stamp=typeof nowISO==='function'?nowISO():new Date().toISOString();
    if(!previous||previous.version!==3||changed){
      await S.s(NOREPI_MIGRATION_KEY_Z,{completed:true,version:3,completedAt:(previous&&previous.completedAt)||stamp,lastCheckedAt:stamp,lastChanged:changed,updatedBy:String((window.CU&&(CU.email||CU.username||CU.id))||'system')});
    }
    /* Show the confirmation only on the first database migration, never on every login. */
    /* Automatic sign-in repair is intentionally silent. Show confirmation only when the master runs the repair manually. */
    if(changed&&force===true&&silent!==true)toastZ('Corrected Noradrenaline 1:1,000 in '+changed+' Crash Cart item(s) ✓','succ');
    repairDoneZ=true;
  }catch(e){console.error('Crash Cart Norepinephrine correction failed',e)}finally{repairBusyZ=false}
}

/* Publish the closure identity and latest stock/expiry state to the existing public no-login record. */

})();

export {};

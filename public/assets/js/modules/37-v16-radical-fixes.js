(function(){
'use strict';

/* ── Helpers ── */
const E=globalThis.E;
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'')}
window.isMaster=function(){
  try{
    return !!(window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)||
           !!(window.CU&&window.CU.master===true&&!window.MASTER_EFFECTIVE)||
           (typeof window.isMasterActual==='function'&&window.isMasterActual());
  }catch(e){return false}
};
function isMaster(){return window.isMaster()}

/* ────────────────────────────────────────────────────────────────
   PERMISSION HELPERS
──────────────────────────────────────────────────────────────── */
var ANN_SEE_ROLES = ['pharmacy','controlled_pharmacy','inpatient_supervisor'];
var ANN_ADD_ROLES = ['pharmacy','controlled_pharmacy','inpatient_supervisor'];

function canSeeAnnV16()  { return isMaster()||ANN_SEE_ROLES.indexOf(role())>=0 }
function canAddAnnV16()  { return isMaster()||ANN_ADD_ROLES.indexOf(role())>=0 }


/* New Request is restricted to inpatient department accounts. */
var refreshQueued=false,refreshPage='';
function scheduleV16Refresh(id){
  refreshPage=id||refreshPage||'';
  if(refreshQueued)return;refreshQueued=true;
  var run=function(){refreshQueued=false;var page=refreshPage;refreshPage='';v16EnsureRequestNav();v16EnsureAnnouncements();if(typeof window.refreshAnnouncementsUi==='function')window.refreshAnnouncementsUi(page);if(typeof window.restorePageTransientUi==='function')window.restorePageTransientUi(page)};
  Promise.resolve().then(run);
}

/* ────────────────────────────────────────────────────────────────
   MASTER showPg — Clean navigation and page isolation
──────────────────────────────────────────────────────────────── */
window.showPg = function(id){
  id=String(id||'');
  window.FS_CURRENT_PAGE=id;
  if(id==='pg-controlled'&&window.CU&&['pharmacy','inpatient_supervisor'].indexOf(CU.role)>-1){if(typeof window.toast==='function')toast('Controlled Custody is not available for this role.','info');id='pg-dash'}
  if(typeof window.resolveAllowedPageTarget==='function')id=window.resolveAllowedPageTarget(id);
  if(id!=='pg-newreq'&&typeof window.clearRequestIdleTimer==='function')window.clearRequestIdleTimer();
  if(typeof window.handleRestrictedPage==='function'&&window.handleRestrictedPage(id))return;
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();

  /* ── pg-newreq: block for non-department roles ── */
  if(id === 'pg-newreq' && role() !== 'department'){
    var fallback = (role()==='controlled_pharmacy'||role()==='warehouse') ? 'pg-controlled' : 'pg-dash';
    v16EnsureRequestNav();
    return runBaseShowPg(fallback);
  }

  /* ── pg-announcements: show clean page without background overlay ── */
  if(id === 'pg-announcements'){
    if(!canSeeAnnV16()){
      id = (role()==='department'||role()==='warehouse'||role()==='controlled_pharmacy')
           ? 'pg-controlled' : 'pg-dash';
      return runBaseShowPg(id);
    }
    document.querySelectorAll('.pg').forEach(function(p){
      p.classList.remove('on');
      p.style.display = 'none';
    });
    document.querySelectorAll('#mnav .nb').forEach(function(b){b.classList.remove('on')});
    var annPage = E('pg-announcements');
    if(annPage){ annPage.style.display = ''; annPage.classList.add('on'); }
    var annBtn = document.querySelector('#mnav [data-pg="pg-announcements"]');
    if(annBtn) annBtn.classList.add('on');
    if(typeof window.renderAnnouncements==='function') window.renderAnnouncements();
    if(typeof window.renderDepartmentAnnouncements==='function') window.renderDepartmentAnnouncements();
    scheduleV16Refresh('pg-announcements');
    return;
  }

  /* Hide all non-active page containers */
  document.querySelectorAll('.pg').forEach(function(p){
    if(p.id !== id){
      p.classList.remove('on');
      p.style.display = 'none';
    }
  });

  /* A previous navigation pass leaves inline display:none on every page it hides.
     Remove that stale inline value before and after the base page renderer,
     otherwise the page receives class=on but remains visually hidden. */
  var targetPage = E(id);
  if(targetPage) targetPage.style.removeProperty('display');

  if(id==='pg-controlled'&&((window.MASTER_EFFECTIVE&&MASTER_EFFECTIVE.role==='department')||(window.CU&&CU.role==='department')))window.CTL_VIEW='departments';
  var res = runBaseShowPg(id);

  var activePage = document.querySelector('.pg.on');
  if(activePage) activePage.style.removeProperty('display');
  scheduleV16Refresh(id);
  if(id==='pg-print')resetPrintPageState();
  if(id==='pg-backup-restore'&&typeof window.refreshBackupRestorePage==='function')window.refreshBackupRestorePage();
  if(id==='pg-zebra-labels'&&typeof window.renderZebraPageUi==='function')window.renderZebraPageUi();
  if(id==='pg-controlled'&&typeof window.renderDepartmentControlledPanel==='function')window.renderDepartmentControlledPanel();
  if(typeof window.enforceRoleUi==='function')window.enforceRoleUi();
  return res;
};

/* ────────────────────────────────────────────────────────────────
   Ensure New Request nav button is ONLY present for department accounts
──────────────────────────────────────────────────────────────── */
function v16EnsureRequestNav(){
  var nav = E('mnav'); if(!nav) return;
  var isDept = role() === 'department';
  if(!isDept){
    Array.from(nav.querySelectorAll('[data-pg="pg-newreq"], button[onclick*="pg-newreq"]')).forEach(function(b){ b.remove(); });
    var page = E('pg-newreq');
    if(page){
      page.classList.remove('on','af-request-enabled','v13-admin-request-enabled');
      page.style.display = 'none';
    }
  }
}

/* Inventory controls are owned by the consolidated V16 operations module. */

/* ────────────────────────────────────────────────────────────────
   FIX 4 — Announcements nav button: definitive, conflict-free
──────────────────────────────────────────────────────────────── */
function v16EnsureAnnouncements(){
  var nav = E('mnav'); if(!nav) return;
  var b = nav.querySelector('[data-pg="pg-announcements"]');
  if(canSeeAnnV16()){
    if(!b){
      b = document.createElement('button');
      b.className = 'nb';
      b.dataset.pg = 'pg-announcements';
      b.innerHTML = '📢 Announcements / الإعلانات';
      nav.appendChild(b);
    }
    /* Replace onclick every time to ensure it points to the V16 showPg */
    b.onclick = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      window.showPg('pg-announcements');
    };
    b.style.display = '';
  } else {
    if(b) b.remove();
  }
  /* Control the Add button inside the announcements page */
  var add = E('ann-add-btn')||document.querySelector('#pg-announcements button[onclick*="openAnnouncementEditor"]');
  if(add) add.style.display = canAddAnnV16() ? 'inline-flex' : 'none';
}

/* ────────────────────────────────────────────────────────────────
   WIRE UP — one current orchestration layer
──────────────────────────────────────────────────────────────── */
window.scheduleNavigationRefresh=scheduleV16Refresh;

})();

export {};

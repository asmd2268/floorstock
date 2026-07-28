/* ASDHealth R6.65 Modular
 * Original script position: 42
 * Original id: final-role-routing-system-health
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
  'use strict';
  var ROLE_CLASSES=['role-pharmacy','role-inpatient_supervisor','role-pharmacy_staff','role-controlled_pharmacy','role-warehouse','role-department'];
  var RESTRICTED={
    controlled_pharmacy:[
      ['pg-controlled','🔒 Controlled & psychotropic medicines'],
      ['pg-ctl-analytics','📊 Controlled analytics'],
      ['pg-announcements','📢 Announcements / الإعلانات']
    ],
    warehouse:[
      ['pg-controlled','🔒 Warehouse controlled custody'],
      ['pg-ctl-analytics','📊 Warehouse analytics']
    ]
  };
  var RENDERERS={'pg-controlled':'renderControlled','pg-ctl-analytics':'renderCtlAnalytics','pg-announcements':'renderAnnouncements'};
  function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
  function realMaster(){
    try{
      if(window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)return true;
      if(typeof window.isMasterActual==='function'&&window.isMasterActual())return true;
      return !!(window.CU&&window.CU.master===true);
    }catch(e){return false}
  }
  function fallbackFor(r){return (r==='controlled_pharmacy'||r==='warehouse')?'pg-controlled':(r==='department'?'pg-newreq':'pg-dash')}
  function specFor(r){return RESTRICTED[r]||null}
  function restrictedPages(r){return (specFor(r)||[]).map(function(x){return x[0]})}
  function setRoleClass(){ROLE_CLASSES.forEach(function(c){document.body.classList.remove(c)});if(role())document.body.classList.add('role-'+role());document.body.classList.toggle('real-master-ui',realMaster())}
  function makeButton(spec){var b=document.createElement('button');b.type='button';b.className='nb';b.dataset.pg=spec[0];b.innerHTML=spec[1];b.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}window.showPg(spec[0])};return b}
  function rebuildRestrictedNav(){var spec=specFor(role()),nav=document.getElementById('mnav');if(!spec||!nav)return false;nav.innerHTML='';spec.forEach(function(x){nav.appendChild(makeButton(x))});return true}
  function removeMasterOnlyForNonMaster(){
    if(realMaster())return;
    ['#nb-system-health','[data-pg="pg-system-health"]','[data-pg="pg-backup-restore"]','#zebra-labels-nav','[data-pg="pg-zebra-labels"]'].forEach(function(sel){document.querySelectorAll(sel).forEach(function(n){n.remove()})});
    ['pg-system-health','pg-backup-restore','pg-zebra-labels'].forEach(function(id){var p=document.getElementById(id);if(p){p.classList.remove('on');p.style.display='none'}})
  }
  function ensureMasterHealth(){
    var nav=document.getElementById('mnav');if(!nav)return;var old=nav.querySelector('#nb-system-health,[data-pg="pg-system-health"]');
    if(!realMaster()){if(old)old.remove();return}
    if(!old){old=document.createElement('button');old.id='nb-system-health';old.type='button';old.className='nb';old.textContent='🩺 System Health';nav.appendChild(old)}
    old.dataset.pg='pg-system-health';old.onclick=function(){window.showPg('pg-system-health')}
  }
  function syncActiveNav(){var active=(document.querySelector('.pg.on')||{}).id||'';document.querySelectorAll('#mnav .nb').forEach(function(b){b.classList.toggle('on',!!(b.dataset&&b.dataset.pg===active))})}
  function activatePage(id,runRenderer){
    var p=document.getElementById(id);if(!p)return false;
    document.querySelectorAll('.pg').forEach(function(x){x.classList.remove('on');x.style.display='none'});p.style.removeProperty('display');p.classList.add('on');syncActiveNav();
    if(runRenderer!==false){var fn=window[RENDERERS[id]];if(typeof fn==='function'){try{fn()}catch(err){console.error('Role page render failed:',id,err);if(window.toast)toast('Unable to load this page.','err')}}if(id==='pg-announcements'&&typeof window.renderDepartmentAnnouncements==='function'){try{window.renderDepartmentAnnouncements()}catch(err){console.error(err)}}}
    return true
  }
  function strictRestrictedShow(id){var allowed=restrictedPages(role());if(allowed.indexOf(id)<0)id=fallbackFor(role());activatePage(id,true);rebuildRestrictedNav();syncActiveNav();removeMasterOnlyForNonMaster()}
  function enforce(){setRoleClass();var restricted=rebuildRestrictedNav();removeMasterOnlyForNonMaster();if(!restricted)ensureMasterHealth();var allowed=restrictedPages(role()),active=document.querySelector('.pg.on');if(allowed.length&&(!active||allowed.indexOf(active.id)<0))activatePage(fallbackFor(role()),true);syncActiveNav()}
  function allowedTarget(id){if((id==='pg-system-health'||id==='pg-backup-restore'||id==='pg-zebra-labels')&&!realMaster())return fallbackFor(role());var allowed=restrictedPages(role());if(allowed.length&&allowed.indexOf(id)<0)return fallbackFor(role());return id}

  window.resolveAllowedPageTarget=allowedTarget;
  window.handleRestrictedPage=function(id){if(specFor(role())){strictRestrictedShow(id);return true}if(id==='pg-system-health'&&realMaster()){activatePage(id,false);return true}return false};
  window.enforceRoleUi=enforce;
  enforce();
})();

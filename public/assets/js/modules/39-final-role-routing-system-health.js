(function(){
  'use strict';
  var ROLE_CLASSES=['role-pharmacy','role-inpatient_supervisor','role-outpatient_pharmacy_supervisor','role-pharmacy_staff','role-controlled_pharmacy','role-warehouse','role-department'];
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

// --- Merged from 26-department-rename-repair.js (Phase 6 consolidation) ---
/* Department rename repair: the Users page button existed but renameDept was missing. */
(function(){
  window.renameDept=async function(deptId,currentName){
    try{
      if(!CU || (CU.role!=='pharmacy' && CU.master!==true)){
        return toast('Only the Pharmacy Manager may rename departments.','err');
      }
      var departments=gd();
      var dept=departments.find(function(d){return String(d.id)===String(deptId);});
      if(!dept)return toast('Department not found. Refresh the page and try again.','err');
      var entered=await uiPrompt(
        'Enter the new department name / أدخل اسم القسم الجديد',
        dept.name||currentName||'',
        {title:'Rename Department / تعديل اسم القسم',okText:'Save / حفظ',cancelText:'Cancel / إلغاء'}
      );
      if(entered===null || entered===undefined)return;
      var newName=String(entered).trim().replace(/\s+/g,' ');
      if(!newName)return toast('Department name cannot be empty.','err');
      if(newName===dept.name)return toast('No changes were made.','info');
      var duplicate=departments.some(function(d){
        return String(d.id)!==String(deptId) && String(d.name||'').trim().toLowerCase()===newName.toLowerCase();
      });
      if(duplicate)return toast('A department with this name already exists.','err');

      var updated=departments.map(function(d){
        return String(d.id)===String(deptId)?Object.assign({},d,{name:newName,updated:nowISO()}):d;
      });
      await S.s('departments',updated);

      /* IDs stay unchanged, so users, medicines, requests, expiry data,
         announcements, and department-specific settings remain linked. */
      renderUsers();
      if(typeof fillDS==='function')fillDS();
      if(typeof populateInvDeptSel==='function')populateInvDeptSel();
      if(typeof refreshCurrentPage==='function')refreshCurrentPage();
      toast('Department renamed successfully ✓','succ');
    }catch(err){
      console.error('renameDept failed:',err);
      toast((err&&err.message)||'Could not rename the department.','err');
    }
  };
})();


// --- Merged from 19-test-data-cleanup-guard.js (Phase 6 consolidation) ---
(function(){
  function hasTestWord(v){return /(^|[^a-z0-9])test([^a-z0-9]|$)/i.test(String(v||''));}
  function masterAllowed(){try{return typeof isMasterActual==='function'&&isMasterActual();}catch(e){return !!(window.CU&&CU.master===true);}}
  function relatedToIds(v,ids){
    if(v==null)return false;
    if(typeof v==='string')return ids.has(v);
    if(Array.isArray(v))return v.some(function(x){return relatedToIds(x,ids)});
    if(typeof v==='object')return Object.keys(v).some(function(k){return relatedToIds(v[k],ids)});
    return false;
  }
  function namedTest(o){
    if(!o||typeof o!=='object')return false;
    return ['name','title','label','displayName','description','note','username'].some(function(k){return hasTestWord(o[k]);});
  }
  function collectTestIds(v,ids){
    if(!v)return;
    if(Array.isArray(v)){v.forEach(function(x){collectTestIds(x,ids)});return;}
    if(typeof v==='object'){
      if(namedTest(v)&&v.id)ids.add(String(v.id));
      Object.keys(v).forEach(function(k){collectTestIds(v[k],ids)});
    }
  }
  function cleanValue(v,ids,key){
    if(Array.isArray(v)){
      return v.filter(function(x){
        if(x&&typeof x==='object'){
          if(namedTest(x))return false;
          if(x.id&&ids.has(String(x.id)))return false;
          if(key==='audit_log'&&(relatedToIds(x,ids)||hasTestWord(JSON.stringify(x))))return false;
          if(relatedToIds(x,ids))return false;
        }
        return true;
      }).map(function(x){return cleanValue(x,ids,key)});
    }
    if(v&&typeof v==='object'){
      var out={};Object.keys(v).forEach(function(k){
        var x=v[k];
        if(x&&typeof x==='object'&&namedTest(x))return;
        if(ids.has(String(k)))return;
        out[k]=cleanValue(x,ids,key);
      });return out;
    }
    return v;
  }
  async function deletePublicCrashDoc(id){
    if(window.FB_DB){var collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');await collection.doc('crash_'+String(id)).delete();}
    return true
  }
  window.masterPurgeAllTestData=async function(){
    if(!masterAllowed())return toast('Master permission required.','err');
    if(!(await uiConfirm('Permanently delete every record whose name contains the standalone word TEST, including linked records and audit traces? This cannot be undone.')))return;
    var ids=new Set();Object.keys(S.cache||{}).forEach(function(k){collectTestIds(S.cache[k],ids)});
    var testCrashIds=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return namedTest(c)}).map(function(c){return String(c.id)});testCrashIds.forEach(function(x){ids.add(x)});
    var changed=0,operations=[];
    Object.keys(S.cache||{}).forEach(function(k){
      if(k==='users')return;
      var old=S.cache[k],clean=cleanValue(old,ids,k);
      try{if(JSON.stringify(old)!==JSON.stringify(clean)){changed++;operations.push({label:k,promise:S.s(k,clean)})}}catch(e){console.warn('TEST cleanup comparison failed for '+k,e)}
    });
    testCrashIds.forEach(function(id){operations.push({label:'public crash '+id,promise:deletePublicCrashDoc(id)})});
    var results=await Promise.allSettled(operations.map(function(x){return x.promise})),failed=[];
    results.forEach(function(r,i){if(r.status==='rejected'){failed.push(operations[i].label);console.error('TEST cleanup failed for '+operations[i].label,r.reason)}});
    if(typeof refreshCurrentPage==='function')refreshCurrentPage();
    if(failed.length){toast('TEST cleanup completed partially. '+failed.length+' area(s) could not be deleted; review the console and retry.','err');return false}
    toast('TEST data purged completely from '+changed+' data area(s).','succ');return true
  };
  function addMasterCleanupButton(){
    var host=document.getElementById('tuser')&&document.getElementById('tuser').parentElement;
    var old=document.getElementById('master-test-clean-btn');if(old)old.remove();
    if(!host||!masterAllowed())return;
    var b=document.createElement('button');b.id='master-test-clean-btn';b.className='btn bg bsm master-test-clean-btn';b.textContent='Delete TEST data';b.title='Permanently remove records named TEST and all linked traces';b.onclick=masterPurgeAllTestData;
    host.insertBefore(b,document.getElementById('themeBtn'));
  }
  window.addMasterCleanupButton=addMasterCleanupButton;
  })();

export {};

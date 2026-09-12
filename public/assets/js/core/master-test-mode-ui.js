/* Master Test Mode: the screen a Master uses to act as another role.

   Moved out of modules/51 (2,147 lines) as the third slice of splitting it. The
   RULES of a test session — who keeps the identity, that master is false, that a
   department role needs a department — already live in master-test-mode.js and
   are tested there; what is here is the part that needs a browser: the modal,
   the user and role pickers, the switch button in the header, and the System
   Health rule that a test session may not see Master-only diagnostics.

   It publishes the same globals it always did, because the buttons in the header
   and the modal reach it by name; nothing else changed. Its only dependencies
   are the shared helpers extracted before it, which is what made the move
   possible without duplicating them. */

import { fsE, fsEsc } from './dom-utils.js?v=b2909b7f46';
import { fsText } from './text-normalize.js?v=aa16ae9ac0';
import { uiToast, uiAudit, uiCloseModal, uiOpenModal } from './module-ui-helpers.js?v=3657403ad7';
import { buildTestSession, restoreActualSession } from './master-test-mode.js?v=a76c1c1ef5';

function fsR6ActualMaster(){
  if(window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true)return MASTER_ACTUAL;
  if(window.CU&&CU.master===true)return CU;
  return null;
}
function fsR6MasterUsers(){
  try{return typeof window.gu==='function'?(window.gu()||[]).filter(function(u){return u&&u.active!==false&&u.master!==true}):[]}catch(e){return []}
}
function fsR6RoleLabel(role){
  var labels={pharmacy:'Pharmacy Director / مدير الصيدلية',inpatient_supervisor:'Inpatient Pharmacy Supervisor / مشرف صيدلية التنويم',outpatient_pharmacy_supervisor:'Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية',pharmacy_staff:'Pharmacy Staff / موظف صيدلية',controlled_pharmacy:'Controlled Medicines Officer / مسؤول الأدوية المخدرة',warehouse:'Warehouse Custody Officer / مسؤول عهدة المستودع',department:'Department Employee / موظف قسم'};
  if(typeof window.masterRoleLabel==='function'){try{return window.masterRoleLabel(role)}catch(e){console.warn('masterRoleLabel was skipped after an error; the rest of this screen still renders.', e);}}
  return labels[role]||role||'Unknown role';
}
function fsR6EnsureMasterModal(){
  var old=fsE('mmaster-role-r6');if(old)return old;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-bg" id="mmaster-role-r6"><div class="modal" style="width:720px;max-width:95vw">'+
    '<div class="mh"><span class="mt">Master Test Mode / وضع اختبار الماستر</span><button class="xbtn" type="button" data-master-test-action="close">×</button></div>'+
    '<div class="fsr6-master-grid"><div class="fg"><label>Test source / مصدر الاختبار</label><select id="fsr6-master-mode"><option value="user">Managed user / مستخدم موجود</option><option value="role">Role only / دور فقط</option></select></div>'+
    '<div class="fg" id="fsr6-master-user-wrap"><label>User / المستخدم</label><select id="fsr6-master-user"></select></div>'+
    '<div class="fg" id="fsr6-master-role-wrap"><label>Role / الدور</label><select id="fsr6-master-role"><option value="pharmacy">Pharmacy Director</option><option value="inpatient_supervisor">Inpatient Supervisor</option><option value="outpatient_pharmacy_supervisor">Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية</option><option value="pharmacy_staff">Pharmacy Staff</option><option value="controlled_pharmacy">Controlled Medicines Officer</option><option value="warehouse">Warehouse Custody Officer</option><option value="department">Department Employee</option></select></div>'+
    '<div class="fg" id="fsr6-master-dept-wrap"><label>Department / القسم</label><select id="fsr6-master-dept"></select></div></div>'+
    '<div class="fsr6-master-preview" id="fsr6-master-preview"></div>'+
    '<div class="fl g8" style="justify-content:flex-end;margin-top:16px"><button class="btn bg" type="button" data-master-test-action="close">Cancel</button>'+
    '<button class="btn bd2c" type="button" id="fsr6-master-exit" data-master-test-action="exit">Exit Test Mode</button>'+
    '<button class="btn bp" type="button" data-master-test-action="apply">Start / Change Test</button></div></div></div>');
  var modal=fsE('mmaster-role-r6');
  modal.addEventListener('click',function(event){
    var button=event.target&&event.target.closest?event.target.closest('[data-master-test-action]'):null;
    if(!button||!modal.contains(button))return;
    event.preventDefault();
    var action=button.dataset.masterTestAction;
    if(action==='close')uiCloseModal('mmaster-role-r6');
    else if(action==='exit')window.masterResetRole();
    else if(action==='apply')window.masterApplyRole();
  });
  fsE('fsr6-master-mode').onchange=window.masterPreviewUser;
  fsE('fsr6-master-user').onchange=window.masterPreviewUser;
  fsE('fsr6-master-role').onchange=window.masterPreviewUser;
  fsE('fsr6-master-dept').onchange=window.masterPreviewUser;
  return fsE('mmaster-role-r6');
}
window.masterPreviewUser=function(){
  fsR6EnsureMasterModal();
  var mode=fsE('fsr6-master-mode').value,userWrap=fsE('fsr6-master-user-wrap'),roleWrap=fsE('fsr6-master-role-wrap');
  userWrap.style.display=mode==='user'?'block':'none';roleWrap.style.display=mode==='role'?'block':'none';
  var profile=null;
  if(mode==='user'){
    var id=fsE('fsr6-master-user').value;profile=fsR6MasterUsers().find(function(u){return String(u.id||u.uid)===String(id)});
  }else{
    profile={role:fsE('fsr6-master-role').value,deptId:fsE('fsr6-master-dept').value,username:'Role preview'};
  }
  var deptWrap=fsE('fsr6-master-dept-wrap'),role=profile&&profile.role||'';
  deptWrap.style.display=(role==='department'||role==='outpatient_pharmacy_supervisor')?'block':'none';
  var actual=fsR6ActualMaster()||{};
  fsE('fsr6-master-preview').innerHTML=profile?
    '<b>Effective role:</b> '+fsEsc(fsR6RoleLabel(role))+
    '<br><b>Tested user:</b> '+fsEsc(profile.email||profile.username||profile.displayName||profile.id||'Role preview')+
    ((role==='department'||role==='outpatient_pharmacy_supervisor')?'<br><b>Department:</b> '+fsEsc(window.floorstockDepartmentName?window.floorstockDepartmentName(profile.deptId||fsE('fsr6-master-dept').value):profile.deptId):'')+
    '<br><b>Actual authenticated master:</b> '+fsEsc(actual.email||actual.username||actual.id||'Master'):
    'No test target is available.';
};
window.openMasterRoleSwitch=function(){
  var actual=fsR6ActualMaster();
  if(!actual)return uiToast('Only the actual signed-in Master can use test mode.','err');
  fsR6EnsureMasterModal();
  var users=fsR6MasterUsers(),userSelect=fsE('fsr6-master-user'),deptSelect=fsE('fsr6-master-dept');
  userSelect.innerHTML=users.length?users.map(function(u){
    return '<option value="'+fsEsc(u.id||u.uid)+'">'+fsEsc(u.email||u.username||u.displayName||u.id)+' — '+fsEsc(fsR6RoleLabel(u.role))+'</option>';
  }).join(''):'<option value="">No active managed users</option>';
  var deps=typeof window.gd==='function'?(window.gd()||[]):[];
  deptSelect.innerHTML=deps.map(function(d){return '<option value="'+fsEsc(d.id)+'">'+fsEsc(window.floorstockDepartmentName?window.floorstockDepartmentName(d):d.name||d.id)+'</option>'}).join('');
  var outpatientDept=deps.find(function(d){return /outpatient\s+department/i.test(String(d.name||d.nameEn||''))||String(d.id||'').toLowerCase()==='outpatient'});
  var roleSelect=fsE('fsr6-master-role');
  function constrainOutpatientDepartment(){
    var outpatient=roleSelect&&roleSelect.value==='outpatient_pharmacy_supervisor';
    if(outpatient&&outpatientDept){deptSelect.innerHTML='<option value="'+fsEsc(outpatientDept.id)+'">'+fsEsc(window.floorstockDepartmentName?window.floorstockDepartmentName(outpatientDept):outpatientDept.name||outpatientDept.id)+'</option>';deptSelect.value=String(outpatientDept.id)}
    else if(!outpatient){deptSelect.innerHTML=deps.map(function(d){return '<option value="'+fsEsc(d.id)+'">'+fsEsc(window.floorstockDepartmentName?window.floorstockDepartmentName(d):d.name||d.id)+'</option>'}).join('')}
    window.masterPreviewUser();
  }
  if(roleSelect&&!roleSelect.dataset.outpatientScopeBound){roleSelect.dataset.outpatientScopeBound='1';roleSelect.addEventListener('change',constrainOutpatientDepartment)}
  constrainOutpatientDepartment();
  fsE('fsr6-master-exit').style.display=window.MASTER_EFFECTIVE?'inline-flex':'none';
  window.masterPreviewUser();uiOpenModal('mmaster-role-r6');
};
window.fsR6ApplyMasterTestProfile=function(profile,meta){
  var actual=fsR6ActualMaster();
  if(!actual)throw new Error('Actual Master profile is unavailable.');
  if(!window.MASTER_ACTUAL)window.MASTER_ACTUAL=Object.assign({},actual);
  var role=fsText(profile.role,''),deptId=fsText(profile.deptId||profile.departmentId,'');
  var masterCrashSnapshot=null;
  if(window.S&&S.cache){var testDeptName=deptId&&window.floorstockDepartmentName?window.floorstockDepartmentName(deptId):'',testNorm=function(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()},testAliases=[deptId,testDeptName].map(testNorm).filter(Boolean),belongsTest=function(row){return [row&&row.deptId,row&&row.departmentId,row&&row.deptName,row&&row.departmentName,row&&row.department,row&&row.deptCode,row&&row.departmentCode,row&&row.unit].map(testNorm).some(function(v){return v&&testAliases.indexOf(v)>-1})},testCarts=(Array.isArray(S.cache.crash_carts)?S.cache.crash_carts:[]).filter(belongsTest),testIds=new Set(testCarts.map(function(c){return String(c.id||'')}));masterCrashSnapshot={carts:testCarts,reports:(Array.isArray(S.cache.crash_cart_reports)?S.cache.crash_cart_reports:[]).filter(function(r){return belongsTest(r)||testIds.has(String(r.cartId||''))})};}
  /* The session's shape belongs to core/master-test-mode.js — who the user still
     is, what they are acting as, and that master is false. It used to be written
     out here, inside a DOM handler, where nothing could reach it to check. */
  var session=buildTestSession({
    actual:actual,
    profile:Object.assign({},profile,{username:profile.username||profile.displayName||profile.email||fsR6RoleLabel(role)}),
    meta:meta,
    deptName:deptId&&window.floorstockDepartmentName?window.floorstockDepartmentName(deptId):''
  });
  window.MASTER_EFFECTIVE=session.testMode;
  window.CU=session.user;
  /* Master Test Mode changes the effective identity without a new auth event.
     Re-apply the same department scope used at login so scoped pages receive
     the selected department's Crash Cart records immediately. */
  /* Keep the authenticated Master's complete read cache in Test Mode. The
     Crash Cart renderer applies the selected test-department scope; mutating
     the Master's cache here made repeated role previews lose carts for the
     remainder of the session. */
  uiAudit('master_test_mode_changed',{mode:MASTER_EFFECTIVE.mode,testedUserId:MASTER_EFFECTIVE.testedUserId,role:role,deptId:deptId||null,actualMasterId:actual.id||actual.uid});
  uiCloseModal('mmaster-role-r6');
  var restoreMasterCrash=function(){
    if(!window.MASTER_EFFECTIVE||!window.S||!S.cache)return;
    S.cache.crash_carts=masterCrashSnapshot.carts.slice();
    S.cache.crash_cart_reports=masterCrashSnapshot.reports.slice();
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
  };
  if(masterCrashSnapshot&&window.FSArchitecture&&typeof FSArchitecture.on==='function'){var offRestore=FSArchitecture.on('app:started',function(){offRestore();restoreMasterCrash()});}
  if(typeof window.startApp==='function')window.startApp();
  if(masterCrashSnapshot&&!window.FSArchitecture)setTimeout(restoreMasterCrash,10000);
  window.floorstockEnforceMasterSystemHealth();
  uiToast('Test mode: '+fsR6RoleLabel(role)+(CU.deptName?' · '+CU.deptName:''),'info');
  return true;
};
window.masterApplyRole=function(){
  fsR6EnsureMasterModal();
  var mode=fsE('fsr6-master-mode').value,profile;
  if(mode==='user'){
    var id=fsE('fsr6-master-user').value;
    profile=fsR6MasterUsers().find(function(u){return String(u.id||u.uid)===String(id)});
    if(!profile)return uiToast('Choose an active managed user.','err');
  }else{
    var role=fsE('fsr6-master-role').value,dept=(role==='department'||role==='outpatient_pharmacy_supervisor')?fsE('fsr6-master-dept').value:'';
    profile={id:'role:'+role,role:role,deptId:dept,username:'Role preview — '+fsR6RoleLabel(role),email:''};
  }
  try{return window.fsR6ApplyMasterTestProfile(profile,{mode:mode})}
  catch(e){return uiToast(e&&e.message||String(e),'err')}
};
window.masterResetRole=function(){
  var actual=window.MASTER_ACTUAL;
  if(!actual){
    if(window.CU&&CU.master===true){window.MASTER_EFFECTIVE=null;uiCloseModal('mmaster-role-r6');window.floorstockEnforceMasterSystemHealth();return true}
    return uiToast('Master profile is unavailable.','err');
  }
  var previous=window.MASTER_EFFECTIVE;
  window.CU=restoreActualSession(actual);window.MASTER_EFFECTIVE=null;
  uiCloseModal('mmaster-role-r6');
  uiAudit('master_test_mode_exited',{previous:previous||null});
  if(typeof window.startApp==='function')window.startApp();
  window.floorstockEnforceMasterSystemHealth();
  uiToast('Exited test mode — Master permissions restored.','succ');
  return true;
};
window.addMasterSwitchButton=function(){
  var actual=fsR6ActualMaster(),userNode=fsE('tuser'),top=userNode&&userNode.parentElement;
  if(typeof window.floorstockEnforceMasterSystemHealth==='function')window.floorstockEnforceMasterSystemHealth();
  if(!top)return false;
  var switchButton=fsE('master-switch-btn'),status=fsE('master-test-status'),exit=fsE('master-test-exit');
  if(!actual){
    if(switchButton)switchButton.remove();
    if(status)status.remove();
    if(exit)exit.remove();
    return false;
  }
  var anchor=fsE('themeBtn')||top.lastElementChild;
  if(window.MASTER_EFFECTIVE){
    var statusHtml='<strong>TEST MODE</strong><br>'+fsEsc(fsR6RoleLabel(MASTER_EFFECTIVE.role))+
      (MASTER_EFFECTIVE.deptName?'<br>'+fsEsc(MASTER_EFFECTIVE.deptName):'');
    if(!status){
      status=document.createElement('span');status.id='master-test-status';status.className='master-test-banner';
      top.insertBefore(status,anchor||null);
    }
    if(status.innerHTML!==statusHtml)status.innerHTML=statusHtml;
    if(!exit){
      exit=document.createElement('button');exit.id='master-test-exit';exit.type='button';exit.className='btn bg bsm master-test-exit';
      top.insertBefore(exit,anchor||null);
    }
    if(exit.textContent!=='Exit Test Mode')exit.textContent='Exit Test Mode';
    exit.onclick=window.masterResetRole;
  }else{
    if(status)status.remove();
    if(exit)exit.remove();
  }
  if(!switchButton){
    switchButton=document.createElement('button');switchButton.id='master-switch-btn';switchButton.type='button';switchButton.className='btn bg bsm';
    top.insertBefore(switchButton,anchor||null);
  }
  var switchText=window.MASTER_EFFECTIVE?'Change Test User / Role':'Test User / Role';
  if(switchButton.textContent!==switchText)switchButton.textContent=switchText;
  switchButton.onclick=window.openMasterRoleSwitch;
  return true;
};

/* ---------- System Health: actual Master only ---------- */

window.floorstockEnforceMasterSystemHealth=function(){
  var allowed=!!(window.CU&&CU.master===true&&!window.MASTER_EFFECTIVE);
  var page=fsE('pg-system-health');
  document.querySelectorAll('[data-pg="pg-system-health"],#system-health-nav,#master-health-nav').forEach(function(node){
    node.style.display=allowed?'':'none';node.setAttribute('aria-hidden',allowed?'false':'true');
  });
  if(page){
    page.style.display=allowed?'':'none';
    if(!allowed&&page.classList.contains('on')){
      page.classList.remove('on');
      if(typeof window.showPg==='function'){
        var fallback=CU&&CU.role==='department'?'pg-newreq':(CU&&['warehouse','controlled_pharmacy'].indexOf(CU.role)>=0?'pg-controlled':'pg-dash');
        try{window.showPg(fallback)}catch(e){console.warn('showPg was skipped after an error; the rest of this screen still renders.', e);}
      }
    }
  }
  return allowed;
};


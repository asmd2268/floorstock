import { publishLegacy } from '../core/legacy-registry.js';

// ── USERS ─────────────────────────────────────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, toast, el, gd, gu, uiConfirm, normalizeRole helpers exposed
// via window.fs*, canAccessDepartment) is already published to globalThis
// by its owning module.
// Only outpatient_pharmacy_supervisor is restricted to its own department.
// Every other role (including inpatient_supervisor and pharmacy_staff) sees
// every department, OUTPATIENT DEPARTMENT included — this must never exclude
// a department by name for any other role.
function fsRoleScopedDepts(allDepts){
  var r=window.fsEffectiveRole?window.fsEffectiveRole():String(window.CU&&window.CU.role||'');
  if(r==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){
    var od=window.fsOutpatientDeptId();
    return allDepts.filter(function(d){return String(d.id)===String(od);});
  }
  return allDepts;
}
function renderUsers(){
  if(typeof canManageUsers==='function'&&!canManageUsers()){el('utbl').innerHTML='<tr><td colspan="4" style="text-align:center;padding:24px">User management is restricted to the Pharmacy Director.</td></tr>';return}
  var us=gu(),ds=fsRoleScopedDepts(gd());
  if(!us.length&&typeof window.S!=='undefined'&&typeof S.loadUsers==='function'&&!window.__usersPageLoadPending){
    window.__usersPageLoadPending=true;
    window.__usersPageLoadError='';
    S.loadUsers().then(function(){window.__usersPageLoadPending=false;renderUsers()}).catch(function(error){
      window.__usersPageLoadPending=false;
      window.__usersPageLoadError=String(error&&error.message||'The user directory could not be loaded.');
      console.warn('User list refresh failed.',error);
      renderUsers();
    });
  }
  el('utbl').innerHTML=us.length
    ?us.map(function(u){
      var d=ds.find(function(x){return x.id===u.deptId});
      var roleLabel=u.role==='pharmacy'?'Pharmacy Director':(u.role==='inpatient_supervisor'?'Inpatient Pharmacy Supervisor':(u.role==='outpatient_pharmacy_supervisor'?'Outpatient Pharmacy Supervisor':(u.role==='pharmacy_staff'?'Pharmacy Employee':(u.role==='controlled_pharmacy'?'Controlled medicines pharmacy officer':(u.role==='warehouse'?'Warehouse':'Department')))));
      var masterBadge=u.master===true?' <span class="badge bpu">Master</span>':'';
      var actions='';
      var canRestrict=canManageUsers()&&['inpatient_supervisor','pharmacy_staff'].includes(u.role)&&u.id!==CU.id;
      if(CU&&CU.master===true&&u.id!==CU.id){
        actions+='<button class="btn bg bxs" data-user-action="toggle-master" data-id="'+esc(u.id)+'" data-master="'+(u.master===true?'1':'0')+'">'+(u.master===true?'Remove Master':'Grant Master')+'</button> ';
        actions+='<button class="btn bd2c bxs" data-user-action="delete" data-id="'+esc(u.id)+'">Delete permanently</button>';
      }else if(u.id===CU.id){actions='<span style="font-size:11px;color:var(--tx2)">Current user</span>';}
      else{actions='<span style="font-size:11px;color:var(--tx2)">Master only</span>';}
      if(canRestrict)actions+=' <button class="btn bs bxs" data-user-action="dept-restrict" data-id="'+esc(u.id)+'" data-email="'+esc(u.email||'')+'">🏥 Dept Restrictions</button>';
      return '<tr><td style="font-family:var(--mono)">'+esc(u.email||'')+'</td>'
        +'<td>'+roleLabel+masterBadge+(d?' — '+esc(d.name):'')+'</td>'
        +'<td><span class="badge '+(u.active===false?'brd':'bgn')+'">'+(u.active===false?'Inactive':'Active')+'</span></td>'
        +'<td>'+actions+'</td></tr>';
    }).join('')
    :'<tr><td colspan="4" style="text-align:center;color:var(--tx2);padding:18px">'
      +(window.__usersPageLoadPending?'Loading managed users…':(window.__usersPageLoadError?'Unable to load managed users: '+esc(window.__usersPageLoadError):'No managed users yet'))
      +'</td></tr>';
  el('dlst').innerHTML=ds.length
    ?ds.map(function(d){
      var medCount=getMeds(d.id).length;
      var userCount=us.filter(function(u){return u.deptId===d.id}).length;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid var(--bd);gap:10px">'
        +'<div style="flex:1"><div style="font-weight:600">'+esc(d.name)+'</div><div style="font-size:11px;color:var(--tx2);margin-top:2px"><span class="chip">'+medCount+' medications</span> <span class="chip">'+userCount+' users</span></div></div>'
        +'<div style="display:flex;gap:6px;flex-shrink:0"><button class="btn bg bxs" data-dept-action="rename" data-id="'+esc(d.id)+'" data-name="'+esc(d.name)+'">✏ Rename</button><button class="btn bp bxs" data-dept-action="view-meds" data-id="'+esc(d.id)+'">📋 View Meds</button><button class="btn bd2c bxs" data-dept-action="delete" data-id="'+esc(d.id)+'">🗑 Delete</button></div></div>';
    }).join(''):'<div style="text-align:center;padding:24px;color:var(--tx2)">No departments yet — add one above</div>';
  var ndcopy=el('ndcopy');
  if(ndcopy){var curVal=ndcopy.value;ndcopy.innerHTML='<option value="empty">Empty list — no medicines copied</option><option value="default">Default list (all medications)</option><optgroup label="Copy from existing dept:">'+ds.map(function(d){return '<option value="'+esc(d.id)+'">Copy from: '+esc(d.name)+' ('+getMeds(d.id).length+' meds)</option>'}).join('')+'</optgroup>';if(curVal)ndcopy.value=curVal;}
  el('nudept').innerHTML=ds.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  bindUserPageActions();
}
function bindUserPageActions(){
  var userTable=el('utbl');
  if(userTable&&!userTable.dataset.actionsBound){
    userTable.dataset.actionsBound='1';
    userTable.addEventListener('click',function(event){
      var button=event.target&&event.target.closest?event.target.closest('[data-user-action]'):null;
      if(!button||!userTable.contains(button))return;
      event.preventDefault();
      var id=button.getAttribute('data-id')||'';
      if(button.dataset.userAction==='delete')delUser(id);
      else if(button.dataset.userAction==='toggle-master')toggleMasterUser(id,button.getAttribute('data-master')==='1');
    });
  }
  var departmentList=el('dlst');
  if(departmentList&&!departmentList.dataset.actionsBound){
    departmentList.dataset.actionsBound='1';
    departmentList.addEventListener('click',function(event){
      var button=event.target&&event.target.closest?event.target.closest('[data-dept-action]'):null;
      if(!button||!departmentList.contains(button))return;
      event.preventDefault();
      var id=button.getAttribute('data-id')||'',action=button.dataset.deptAction;
      if(action==='rename')renameDept(id,button.getAttribute('data-name')||'');
      else if(action==='delete')delDept(id);
      else if(action==='view-meds'){
        showPg('pg-inv');
        var selector=el('inv-dept-sel');if(selector)selector.value=id;
        renderInv();
      }
    });
  }
}
function updateUserRoleFields(){
  var role=el('nurole').value;
  el('nudept-wrap').style.display=(role==='department'||role==='outpatient_pharmacy_supervisor')?'block':'none';
  el('numaster-wrap').style.display=(isMasterActual()&&role==='pharmacy')?'block':'none';
  if(role!=='pharmacy')el('numaster').checked=false;
  var deptSelect=el('nudept');
  if(deptSelect&&role==='outpatient_pharmacy_supervisor'){
    var out=gd().filter(function(d){return /outpatient\s+department/i.test(String(d.name||d.nameEn||''))||String(d.id||'').toLowerCase()==='outpatient'});
    deptSelect.innerHTML=out.length?out.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join(''):'<option value="">OUTPATIENT DEPARTMENT not found</option>';
    deptSelect.disabled=!out.length;
  } else if(deptSelect){var allDepartments=gd();deptSelect.innerHTML=allDepartments.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');deptSelect.disabled=!allDepartments.length;}
}
function openAddUser(){
  try{
    if(!CU||CU.role!=='pharmacy'){
      toast('Only the Pharmacy Manager may create users.','err');
      return;
    }
    var emailInput=el('nuname');
    var passInput=el('nupass');
    var roleSelect=el('nurole');
    var masterInput=el('numaster');
    var modal=el('muser');
    if(!emailInput||!passInput||!roleSelect||!masterInput||!modal){
      throw new Error('Add User form is missing from the current page. Upload the latest index.html and refresh.');
    }
    emailInput.value='';
    passInput.value='';
    roleSelect.value='department';
    masterInput.checked=false;
    var deptSelect=el('nudept');
    var departments=gd();
    if(deptSelect){
      deptSelect.innerHTML=departments.length
        ? departments.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>';}).join('')
        : '<option value="">No departments available — add a department first</option>';
      deptSelect.disabled=!departments.length;
    }
    updateUserRoleFields();
    modal.classList.add('on');
    setTimeout(function(){emailInput.focus();},50);
  }catch(err){
    console.error('openAddUser failed:',err);
    toast(err.message||'Could not open Add User form.','err');
  }
}
async function saveUser(){
  if(!canManageUsers())return toast('Only the Pharmacy Director may create users.','err');
  var email=el('nuname').value.trim(),password=el('nupass').value,did=el('nudept').value,requestedRole=el('nurole').value,grantMaster=el('numaster').checked===true;
  if(grantMaster&&gu().some(function(u){return u.master===true}))return toast('Only one Master user is allowed.','err');
  if(!email||!password)return toast('Fill all fields','err');
  if(password.length<8)return toast('Password must be at least 8 characters','err');
  if((requestedRole==='department'||requestedRole==='outpatient_pharmacy_supervisor')&&!did)return toast('Choose the supervisor department before creating this user.','err');
  if(grantMaster&&(!CU.master||requestedRole!=='pharmacy'))return toast('Only a Master may grant Master access to a pharmacy user.','err');
  try{
    var result=await window.fsCallFunction('createManagedUser',{email:email,password:password,role:requestedRole,deptId:(requestedRole==='department'||requestedRole==='outpatient_pharmacy_supervisor')?did:null,master:grantMaster});
    toast('Firebase user created securely ✓','succ');CM('muser');
    window.__usersPageLoadError='';
    await S.loadUsers();renderUsers();
  }catch(err){console.error(err);toast((err&&err.message)||'Could not create Firebase user','err');}
}
async function delUser(id){
  if(!CU||CU.master!==true)return toast('Only Master can permanently delete users.','err');
  if(id===CU.id)return toast('You cannot delete your own account.','err');
  if(!await uiConfirm('Permanently delete this user from Firebase Authentication and Firestore?\n\nThis cannot be undone.'))return;
  try{await window.fsCallFunction('deleteManagedUser',{uid:id});await S.loadUsers();toast('User permanently deleted','info');renderUsers();}
  catch(err){console.error(err);toast((err&&err.message)||'Could not delete user','err');}
}
async function toggleMasterUser(id,isMaster){
  if(!CU||CU.master!==true)return toast('Only Master can change Master access.','err');
  var action=isMaster?'remove Master access from':'grant Master access to';
  if(!await uiConfirm('Are you sure you want to '+action+' this user?'))return;
  try{await window.fsCallFunction('setMasterAccess',{uid:id,master:!isMaster});await S.loadUsers();toast('Master access updated ✓','succ');renderUsers();}
  catch(err){console.error(err);toast((err&&err.message)||'Could not update Master access','err');}
}

function openDeptRestrictModal(uid, email) {
  var ds = fsRoleScopedDepts(gd());
  var restrictions = (S.g('user_dept_restrictions_v1') || {});
  var blocked = Array.isArray(restrictions[uid]) ? restrictions[uid] : [];
  var existing = document.getElementById('modal-dept-restrict');
  if(existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'modal-dept-restrict';
  modal.className = 'modal-bg on';
  modal.innerHTML = '<div class="modal" style="max-width:480px"><div class="mh"><span class="mt">Department Restrictions — '+esc(email)+'</span><button class="xbtn" id="dept-restrict-close">✕</button></div>'
    +'<div class="cb"><div class="fhint" style="margin-bottom:12px">Tick the departments you want to <b>block</b> from this user. They will not see requests, crash carts, or notes for blocked departments.</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +ds.map(function(d){
      var isBlocked=blocked.some(function(b){return String(b).trim().toLowerCase()===String(d.id).trim().toLowerCase()});
      return '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--bd);border-radius:6px;cursor:pointer">'
        +'<input type="checkbox" data-dept-block="'+esc(d.id)+'" '+(isBlocked?'checked':'')+'>'
        +'<span>'+esc(d.name)+'</span></label>';
    }).join('')
    +'</div></div>'
    +'<div class="mf"><button class="btn bp" id="dept-restrict-save">Save / حفظ</button><button class="btn bg" id="dept-restrict-cancel">Cancel</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#dept-restrict-close').onclick = modal.querySelector('#dept-restrict-cancel').onclick = function(){ modal.remove(); };
  modal.querySelector('#dept-restrict-save').onclick = async function(){
    var checked = Array.from(modal.querySelectorAll('[data-dept-block]:checked')).map(function(el){return el.getAttribute('data-dept-block')});
    var all = Object.assign({}, S.g('user_dept_restrictions_v1') || {});
    if(checked.length) all[uid] = checked; else delete all[uid];
    try{
      await S.s('user_dept_restrictions_v1', all);
      toast('Department restrictions saved ✓', 'succ');
      modal.remove();
      renderUsers();
    }catch(e){ toast((e&&e.message)||'Save failed','err'); }
  };
}

document.addEventListener('click', function(event){
  var btn = event.target && event.target.closest && event.target.closest('[data-user-action="dept-restrict"]');
  if(!btn) return;
  openDeptRestrictModal(btn.getAttribute('data-id'), btn.getAttribute('data-email'));
}, true);

publishLegacy("07c-users.js", {
  fsRoleScopedDepts,
  renderUsers,
  bindUserPageActions,
  updateUserRoleFields,
  openAddUser,
  saveUser,
  delUser,
  toggleMasterUser,
});

export {};

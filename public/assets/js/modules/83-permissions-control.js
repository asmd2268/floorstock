import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

// ── PERMISSIONS CONTROL (page visibility per role) ────────────────────────
// Master-only page listing every existing page × every role that already
// has legitimate Firestore/data access to it (per buildNav's hardcoded
// per-role arrays in module 80). Master can only HIDE a page from a role
// that already has real access to it — this never grants a role access it
// doesn't already have at the rules/data layer, since that would require
// touching Firestore rules and scoped state keys per page, a much bigger
// and riskier change than a visibility toggle.
//
// Two enforcement layers, both required (a hidden nav button alone can be
// bypassed by the many direct showPg('pg-x') calls elsewhere in the app):
// 1. buildNav() filters the nav items themselves (cosmetic).
// 2. A window.__showPgGuards entry blocks actual navigation to a hidden
//    page regardless of how showPg() was invoked (the real enforcement).
// The literal Master account (isMasterActual()) is always exempt from both
// layers so master can never lock itself out by hiding its own role's page.
(function(){
'use strict';
var E=window.fsE||function(id){return document.getElementById(id)};
var esc=window.fsEsc||function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};

var PL_ROLE_LABELS={
  pharmacy:'Pharmacy Director / مدير الصيدلية',
  inpatient_supervisor:'Inpatient Pharmacy Supervisor / مشرف الصيدلية الداخلية',
  outpatient_pharmacy_supervisor:'Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية',
  pharmacy_staff:'Pharmacy Staff / موظف الصيدلية',
  controlled_pharmacy:'Controlled Pharmacy / صيدلية الأدوية المخدرة',
  warehouse:'Warehouse / المستودع',
  department:'Departments / الأقسام'
};

// Page id -> {label, roles: [every role that already has real access]}.
// Mirrors window.buildNav's per-role arrays exactly (module 80). Does NOT
// include pg-classification-lists — that feature already has its own
// dedicated per-list visibility control.
var PL_PAGES={
  'pg-dash':{label:'Dashboard',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']},
  'pg-inv':{label:'Inventory / حالة الأدوية',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']},
  'pg-reqs':{label:'Requests / الطلبات',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']},
  'pg-notes-ph':{label:'Notes (Pharmacy) / ملاحظات',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']},
  'pg-schedule':{label:'Schedule / الجدولة',roles:['pharmacy','inpatient_supervisor']},
  'pg-print':{label:'Print / الطباعة',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']},
  'pg-analytics':{label:'Analytics / التحليلات',roles:['pharmacy','inpatient_supervisor']},
  'pg-import':{label:'Import / الاستيراد',roles:['pharmacy','inpatient_supervisor']},
  'pg-ctl-analytics':{label:'Controlled Analytics / تحليلات الأدوية المخدرة',roles:['pharmacy','controlled_pharmacy','warehouse']},
  'pg-crashcart':{label:'Crash Cart(s) / عربة الطوارئ',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff','department']},
  'pg-crash-ops':{label:'Crash Cart Operations / عمليات عربة الطوارئ',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']},
  'pg-med-accountability':{label:'Medication Accountability / عهدة الأدوية',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff','department']},
  'pg-users':{label:'Users / المستخدمون',roles:['pharmacy']},
  'pg-zebra-labels':{label:'Zebra Labels / ملصقات زيبرا',roles:['pharmacy']},
  'pg-controlled':{label:'Controlled Custody / عهدة الأدوية المخدرة',roles:['controlled_pharmacy','warehouse','department']},
  'pg-newreq':{label:'New Request / طلب جديد',roles:['department']},
  'pg-myreqs':{label:'My Requests / طلباتي',roles:['department']},
  'pg-shelves':{label:'Shelves & Storage / الأرفف والتخزين',roles:['department']},
  'pg-notes-dept':{label:'Notes (Department) / ملاحظات القسم',roles:['department']},
  'pg-deptprint':{label:'Print Drug List / طباعة قائمة الأدوية',roles:['department']},
  'pg-pharm-inv':{label:'Pharmacy Inventory / مخزون الصيدلية',roles:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff']}
};

function plIsMasterActual(){return typeof window.isMasterActual==='function'&&window.isMasterActual()}
function plRole(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'')}
function plData(){return (typeof S!=='undefined'&&S.g&&S.g('page_visibility_overrides_v1'))||{}}
// Hidden-for-role check every enforcement point calls. Master is always
// exempt so it can never lock itself out by hiding its own role's page.
function plIsHiddenForCurrentRole(pageId){
  if(plIsMasterActual())return false;
  var hidden=plData()[pageId];
  return Array.isArray(hidden)&&hidden.indexOf(plRole())>=0;
}
window.plIsHiddenForCurrentRole=plIsHiddenForCurrentRole;

window.plToggle=function(checkbox,pageId,role){
  if(!(typeof window.isMaster==='function'&&window.isMaster()))return;
  var data=Object.assign({},plData());
  var hidden=(data[pageId]||[]).slice();
  var i=hidden.indexOf(role);
  // Checkbox checked = visible (not hidden); unchecked = hidden.
  if(!checkbox.checked&&i<0)hidden.push(role);
  else if(checkbox.checked&&i>=0)hidden.splice(i,1);
  data[pageId]=hidden;
  S.s('page_visibility_overrides_v1',data).then(function(){
    toast&&toast('Updated ✓','succ');
    if(typeof window.buildNav==='function')window.buildNav();
  }).catch(function(err){toast&&toast('Update failed: '+String(err&&err.message||err),'err');checkbox.checked=!checkbox.checked});
};

function plPageCard(pageId){
  var page=PL_PAGES[pageId],hidden=plData()[pageId]||[];
  var rolesHtml=page.roles.map(function(r){
    var visible=hidden.indexOf(r)<0;
    return '<label class="cl-role-chk"><input type="checkbox" onchange="window.plToggle(this,\''+pageId+'\',\''+r+'\')" '+(visible?'checked':'')+'><span>'+esc(PL_ROLE_LABELS[r]||r)+'</span></label>';
  }).join('');
  return '<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">'+esc(page.label)+'</span></div><div class="cb"><div class="cl-roles-grid">'+rolesHtml+'</div></div></div>';
}

// ── Pharmacy Inventory sub-permissions ────────────────────────────────────
var PI_FEAT_PERMS_KEY='pharm_inv_feat_perms_v1';
var PI_ROOM_ASSIGN_KEY='pharm_inv_room_assign_v1';
var PI_FEAT_DEFAULTS={
  editMeds:['pharmacy'],
  editRooms:['pharmacy'],
  viewReorder:['pharmacy','inpatient_supervisor'],
  canPrint:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'],
  editIntCls:['pharmacy']   // who can edit internal classifications on medicines
};
var PI_FEAT_ELIGIBLE={
  editMeds:['pharmacy','inpatient_supervisor'],
  editRooms:['pharmacy','inpatient_supervisor'],
  viewReorder:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor'],
  canPrint:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'],
  editIntCls:['pharmacy','inpatient_supervisor']
};
var PI_FEAT_LABELS={
  editMeds:'Edit / Add / Delete Medicines / تعديل وإضافة وحذف الأدوية',
  editRooms:'Edit / Add / Delete Rooms & Cabinets / تعديل الغرف والدواليب',
  viewReorder:'View Reorder List / عرض قائمة الطلب',
  canPrint:'Print Inventory / طباعة المخزون',
  editIntCls:'Edit Internal Classification (Status / Urgency / Dosage) / تعديل التصنيفات الداخلية'
};
function piGetFeatPerms(){
  try{var p=window.S&&window.S.g&&window.S.g(PI_FEAT_PERMS_KEY);return Object.assign({},PI_FEAT_DEFAULTS,p||{})}catch(e){return Object.assign({},PI_FEAT_DEFAULTS)}
}
function piGetRoomAssign(){
  try{var r=window.S&&window.S.g&&window.S.g(PI_ROOM_ASSIGN_KEY);return (r&&typeof r==='object')?r:{}}catch(e){return {}}
}
window.piGetFeatPerms=piGetFeatPerms;
window.piGetRoomAssign=piGetRoomAssign;

function plPharmInvCard(){
  var perms=piGetFeatPerms();
  var esc2=esc;
  var featHtml=Object.keys(PI_FEAT_LABELS).map(function(feat){
    var eligible=PI_FEAT_ELIGIBLE[feat]||[];
    var current=perms[feat]||[];
    var roleChks=eligible.map(function(r){
      var checked=current.indexOf(r)>=0;
      return '<label class="cl-role-chk"><input type="checkbox" data-pi-feat="'+esc2(feat)+'" data-pi-role="'+esc2(r)+'" '+(checked?'checked':'')+' onchange="plPharmFeatToggle(this)"><span>'+esc2(PL_ROLE_LABELS[r]||r)+'</span></label>';
    }).join('');
    return '<div style="margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:6px">'+esc2(PI_FEAT_LABELS[feat])+'</div><div class="cl-roles-grid">'+roleChks+'</div></div>';
  }).join('<hr style="margin:10px 0;border:0;border-top:1px solid var(--br)">');

  // Room assignments (pharmacy_staff only)
  var assign=piGetRoomAssign();
  var rooms=typeof window.piRooms==='function'?window.piRooms():[];
  var staffList=[];
  try{var users=typeof window.getUsers==='function'?window.getUsers():[];staffList=users.filter(function(u){return u.role==='pharmacy_staff'})}catch(e){}
  var assignHtml='';
  if(!rooms.length){assignHtml='<div style="color:var(--tx2);font-size:13px">No rooms defined yet in Pharmacy Inventory.</div>'}
  else{
    var roomHeader='<div style="display:grid;grid-template-columns:200px '+rooms.map(function(){return '1fr'}).join(' ')+';gap:6px;align-items:center;margin-bottom:6px;font-size:12px;font-weight:600"><div>Email (pharmacy staff)</div>'+rooms.map(function(r){return '<div style="text-align:center">'+esc2(r.name)+'</div>'}).join('')+'</div>';
    var staffRows=staffList.length?staffList.map(function(u){
      var email=String(u.email||u.uid||'');
      var userAssign=assign[email]||[];
      var roomChks=rooms.map(function(r){
        var chk=userAssign.indexOf(r.id)>=0;
        return '<div style="text-align:center"><input type="checkbox" data-pi-email="'+esc2(email)+'" data-pi-room="'+esc2(r.id)+'" '+(chk?'checked':'')+' onchange="plRoomAssignToggle(this)"></div>';
      }).join('');
      return '<div style="display:grid;grid-template-columns:200px '+rooms.map(function(){return '1fr'}).join(' ')+';gap:6px;align-items:center;margin-bottom:4px;font-size:12px"><div style="word-break:break-all">'+esc2(email)+'</div>'+roomChks+'</div>';
    }).join(''):('<div style="color:var(--tx2);font-size:13px">No pharmacy staff users found. / لا يوجد موظفو صيدلية.</div>');
    assignHtml=roomHeader+staffRows;
    assignHtml+='<div class="fhint" style="margin-top:8px">If no rooms are checked for a user, they see all rooms. Check specific rooms to restrict them. / إذا لم تُحدد غرف فالمستخدم يرى الكل — التحديد يعني التقييد.</div>';
  }

  return '<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">🏥 Pharmacy Inventory — Detailed Permissions / صلاحيات مخزون الصيدلية التفصيلية</span></div><div class="cb">'+
    '<div style="margin-bottom:16px">'+featHtml+'</div>'+
    '<div><div style="font-weight:600;font-size:13px;margin-bottom:8px">🏠 Room Access by Staff Email / تخصيص الغرف حسب الموظف</div>'+assignHtml+'</div>'+
    '</div></div>';
}

window.plPharmFeatToggle=async function(cb){
  if(!window.isMaster())return;
  var feat=cb.dataset.piFeat;var role=cb.dataset.piRole;
  var perms=Object.assign({},piGetFeatPerms());
  var arr=(perms[feat]||[]).slice();
  var i=arr.indexOf(role);
  if(cb.checked&&i<0)arr.push(role);
  else if(!cb.checked&&i>=0)arr.splice(i,1);
  perms[feat]=arr;
  try{await window.S.s(PI_FEAT_PERMS_KEY,perms);if(typeof toast==='function')toast('Updated ✓','succ')}
  catch(e){if(typeof toast==='function')toast(String(e&&e.message||e),'err');cb.checked=!cb.checked}
};
window.plRoomAssignToggle=async function(cb){
  if(!window.isMaster())return;
  var email=cb.dataset.piEmail;var roomId=cb.dataset.piRoom;
  var assign=Object.assign({},piGetRoomAssign());
  var arr=(assign[email]||[]).slice();
  var i=arr.indexOf(roomId);
  if(cb.checked&&i<0)arr.push(roomId);
  else if(!cb.checked&&i>=0)arr.splice(i,1);
  assign[email]=arr;
  try{await window.S.s(PI_ROOM_ASSIGN_KEY,assign);if(typeof toast==='function')toast('Updated ✓','succ')}
  catch(e){if(typeof toast==='function')toast(String(e&&e.message||e),'err');cb.checked=!cb.checked}
};

window.renderPermissionsControl=function(){
  var host=E('pg-permissions-control');if(!host)return;
  if(!(typeof window.isMaster==='function'&&window.isMaster())){
    host.innerHTML='<div class="card"><div class="cb" style="text-align:center;color:var(--tx2)">Master only. / للماستر فقط.</div></div>';
    if(typeof window.injectUsersTabBar==='function')window.injectUsersTabBar('pg-permissions-control');
    return;
  }
  var title='<div class="stitle">🔐 Permissions Control / التحكم بالصلاحيات</div><div class="ssub" style="margin:0">Hide an existing page from a role that already has access to it. This never grants a role access it doesn\'t already have. / إخفاء صفحة موجودة عن دور يملك صلاحيتها أصلًا فقط — لا يمنح أي صلاحية جديدة.</div>';
  var body=Object.keys(PL_PAGES).map(plPageCard).join('');
  host.innerHTML='<div class="fl ic jb mb14" style="flex-wrap:wrap;gap:10px"><div>'+title+'</div></div>'+body+plPharmInvCard();
  if(typeof window.injectUsersTabBar==='function')window.injectUsersTabBar('pg-permissions-control');
};

// Layer 1 (cosmetic): filter buildNav's own items array for hidden pages,
// and hide the independently-appended zebra-labels button when hidden for
// the 'pharmacy' role. Registered as a post-processing hook so it runs
// every time buildNav rebuilds the nav, without editing module 80 itself.
window.__buildNavAfterExtensions=window.__buildNavAfterExtensions||[];
window.__buildNavAfterExtensions.push(function(){
  if(!plIsMasterActual()){
    var role=plRole();
    document.querySelectorAll('#mnav .nb[data-pg]').forEach(function(btn){
      var pageId=btn.dataset.pg;
      if(PL_PAGES[pageId]&&PL_PAGES[pageId].roles.indexOf(role)>=0&&plIsHiddenForCurrentRole(pageId))btn.remove();
    });
    return;
  }
});

// Layer 2 (real enforcement): block navigation to a hidden page no matter
// which code path called showPg() — direct calls elsewhere in the app,
// independently-injected nav buttons, etc. all funnel through showPg().
window.__showPgGuards=window.__showPgGuards||[];
window.__showPgGuards.push(function(id){
  if(!PL_PAGES[id])return true;
  if(!plIsHiddenForCurrentRole(id))return true;
  if(typeof toast==='function')toast('This page is not available for your role. / هذه الصفحة غير متاحة لدورك.','err');
  return false;
});

// page_visibility_overrides_v1 is part of the cold-load key set, but the
// warm-cache fast path can render the app shell (and call buildNav() once)
// before this specific key's real value has landed in S.cache — same race
// already hit and fixed for classification_lists_v1. Re-check once real
// (non-cached) data is confirmed loaded.
document.addEventListener('asdh:real-load-complete',function(){
  if(typeof window.buildNav==='function'&&window.CU)window.buildNav();
});

publishLegacy("83-permissions-control.js", {
  plIsHiddenForCurrentRole: window.plIsHiddenForCurrentRole,
  renderPermissionsControl: window.renderPermissionsControl
});
})();

export {};

import { publishLegacy } from '../core/legacy-registry.js';

// ── CLASSIFICATION LISTS (High Alert / Hazard / LASA) ────────────────────
// Master builds one authoritative, printable list per classification by
// auto-aggregating every department's flagged medicines and deduplicating
// name variants down to one canonical entry per drug (reusing the same
// canonical-identity matcher the Crash Cart module already relies on).
// Master alone can generate/edit a list; master alone decides which roles
// get a read-only "Classification Lists" tab to view and print it.
(function(){
'use strict';
var CL_TYPES=['high_alert','hazard','lasa'];
var CL_LABELS={
  high_alert:{en:'High-Alert Medications',ar:'الأدوية عالية التنبيه'},
  hazard:{en:'Hazardous Medications',ar:'الأدوية الخطرة'},
  lasa:{en:'Look-Alike Sound-Alike (LASA) Medications',ar:'الأدوية متشابهة الاسم أو الشكل'}
};
var CL_ROLE_LABELS={
  department:'Departments / الأقسام',
  pharmacy_staff:'Pharmacy Staff / موظف الصيدلية',
  inpatient_supervisor:'Inpatient Pharmacy Supervisor / مشرف الصيدلية الداخلية',
  outpatient_pharmacy_supervisor:'Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية',
  controlled_pharmacy:'Controlled Pharmacy / صيدلية الأدوية المخدرة',
  warehouse:'Warehouse / المستودع'
};
var CL_ALL_ROLES=Object.keys(CL_ROLE_LABELS);
var E=window.fsE||function(id){return document.getElementById(id)};
var esc=window.fsEsc||function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var staged={};

function clIsMaster(){return typeof window.isMaster==='function'&&window.isMaster()}
function clRole(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'')}
function clData(){return (typeof S!=='undefined'&&S.g&&S.g('classification_lists_v1'))||{}}
function clEntry(type){return clData()[type]||null}
async function clSave(type,entry){
  var next=Object.assign({},clData());
  next[type]=entry;
  await S.s('classification_lists_v1',next);
  if(typeof auditAction==='function')auditAction('classification_list_saved',{type:type,referenceName:entry.referenceName,medicineCount:(entry.medicines||[]).length,visibleRoles:entry.visibleRoles});
}
function clVisibleTypesForRole(){
  if(clIsMaster())return CL_TYPES.slice();
  var data=clData(),role=clRole();
  return CL_TYPES.filter(function(t){var e=data[t];return e&&Array.isArray(e.visibleRoles)&&e.visibleRoles.indexOf(role)>=0});
}
window.clHasVisibleLists=function(){return clVisibleTypesForRole().length>0};

function clFlag(type,m){
  if(type==='high_alert')return !!(m.high_alert||m.highAlert);
  if(type==='hazard')return !!(m.hazard||m.hazardous);
  if(type==='lasa')return !!(m.lasa||m.LASA);
  return false;
}
function clCanonical(item){
  return typeof window.fsCrashCanonicalMedication==='function'
    ?window.fsCrashCanonicalMedication(item)
    :{generic:String(item.name||'').trim(),concentration:String(item.concentration||item.strength||'').trim()};
}
function clGroupKey(c){return String(c.generic||'').trim().toLowerCase()+'|'+String(c.concentration||'').trim().toLowerCase()}

// Scan every department's medicines flagged for `type`, group by canonical
// drug identity, and record every distinct raw name spelling found for that
// identity (with a count) — those are the "duplicates" master reviews.
function clScanCandidates(type){
  var depts=typeof window.gd==='function'?(window.gd()||[]):[];
  var groups={};
  depts.forEach(function(d){
    var meds=typeof window.getMeds==='function'?(window.getMeds(d.id)||[]):[];
    meds.forEach(function(m){
      if(!m||!clFlag(type,m))return;
      var c=clCanonical(m),key=clGroupKey(c);
      if(!groups[key])groups[key]={generic:c.generic,concentration:c.concentration,variants:{}};
      var raw=String(m.name||c.generic).trim();
      groups[key].variants[raw]=(groups[key].variants[raw]||0)+1;
    });
  });
  return Object.keys(groups).sort().map(function(k){
    var g=groups[k],names=Object.keys(g.variants).sort(function(a,b){return g.variants[b]-g.variants[a]});
    return {key:k,generic:g.generic,concentration:g.concentration,variants:names,chosenName:names[0]||g.generic};
  });
}
window.clScanCandidates=clScanCandidates;

function clDaysLeft(expiresAt){
  if(!expiresAt)return null;
  var ms=new Date(expiresAt).getTime()-Date.now();
  return Math.ceil(ms/86400000);
}
function clStatusBadge(entry){
  if(!entry||!entry.approvedAt)return '<span class="badge byl">Not generated / لم يُنشأ بعد</span>';
  var days=clDaysLeft(entry.expiresAt);
  if(days===null)return '';
  if(days<0)return '<span class="badge brd">Expired / منتهي الاعتماد</span>';
  if(days<=30)return '<span class="badge byl">Expires in '+days+' day(s) / ينتهي خلال '+days+' يوم</span>';
  return '<span class="badge bgr">Valid until '+esc((entry.expiresAt||'').slice(0,10))+' / صالح حتى</span>';
}

window.clOpenClassificationLists=function(){if(typeof window.showPg==='function')window.showPg('pg-classification-lists')};

function clMasterTypeCard(type){
  var entry=clEntry(type),lbl=CL_LABELS[type];
  var st=staged[type];
  var medCount=entry?(entry.medicines||[]).length:0;
  var visibleRoles=(entry&&entry.visibleRoles)||[];
  var rolesHtml=CL_ALL_ROLES.map(function(r){
    return '<label class="cl-role-chk"><input type="checkbox" onchange="window.clToggleRole(this,\''+type+'\',\''+r+'\')" '+(visibleRoles.indexOf(r)>=0?'checked':'')+'><span>'+esc(CL_ROLE_LABELS[r])+'</span></label>';
  }).join('');
  var reviewHtml='';
  if(st){
    var dupGroups=st.filter(function(g){return g.variants.length>1});
    reviewHtml='<div class="card" style="margin-top:10px"><div class="ch"><span class="ct">Review before saving / مراجعة قبل الحفظ — '+st.length+' medicine(s), '+dupGroups.length+' with name variants to merge</span></div><div class="cb">'+
      (dupGroups.length?dupGroups.map(function(g,i){
        return '<div class="cl-dup-row"><div class="fhint">'+esc(g.concentration||'')+' — found as: '+g.variants.map(esc).join(', ')+'</div>'+
          '<input type="text" class="cl-dup-name" data-cl-key="'+esc(g.key)+'" value="'+esc(g.chosenName)+'" placeholder="Final name / الاسم النهائي"></div>';
      }).join(''):'<div class="fhint">No name variants found — every entry already matches one spelling. / لا توجد اختلافات بالأسماء.</div>')+
      '<div class="fl g8" style="margin-top:10px"><button class="btn bs bsm" onclick="window.clConfirmSave(\''+type+'\')">✔ Confirm &amp; save list / تأكيد وحفظ</button><button class="btn bg bsm" onclick="window.clCancelReview(\''+type+'\')">Cancel / إلغاء</button></div>'+
      '</div></div>';
  }
  return '<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">'+esc(lbl.en)+' / '+esc(lbl.ar)+'</span>'+clStatusBadge(entry)+'</div><div class="cb">'+
    '<div class="fg"><label>Reference relied upon / المرجع المعتمد</label><input type="text" class="cl-ref" id="cl-ref-'+type+'" value="'+esc(entry&&entry.referenceName||'')+'" placeholder="e.g. ISMP List of High-Alert Medications 2024"></div>'+
    '<div class="fhint">'+medCount+' medicine(s) currently on this list'+(entry&&entry.approvedAt?(' · Approved '+esc((entry.approvedAt||'').slice(0,10))+' · Effective '+esc((entry.effectiveAt||'').slice(0,10))):'')+'</div>'+
    '<div class="fl g8" style="margin-top:8px"><button class="btn bp bsm" onclick="window.clGenerate(\''+type+'\')">🔄 Generate / Refresh from all departments</button><button class="btn bg bsm" onclick="window.clPrint(\''+type+'\')" '+(medCount?'':'disabled')+'>🖨 Print</button></div>'+
    '<div class="fhint" style="margin-top:10px"><b>Visible to / تظهر لـ:</b></div><div class="cl-roles-grid">'+rolesHtml+'</div>'+
    reviewHtml+
  '</div></div>';
}

function clReadOnlyTypeCard(type){
  var entry=clEntry(type),lbl=CL_LABELS[type];
  if(!entry)return '';
  return '<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">'+esc(lbl.en)+' / '+esc(lbl.ar)+'</span>'+clStatusBadge(entry)+'</div><div class="cb">'+
    '<div class="fhint"><b>Reference / المرجع:</b> '+esc(entry.referenceName||'—')+'</div>'+
    '<div class="fhint"><b>Approved / الاعتماد:</b> '+esc((entry.approvedAt||'').slice(0,10))+' · <b>Effective / الفعالية:</b> '+esc((entry.effectiveAt||'').slice(0,10))+'</div>'+
    '<div class="fl g8" style="margin:8px 0"><button class="btn bg bsm" onclick="window.clPrint(\''+type+'\')">🖨 Print</button></div>'+
    '<div class="tw"><table class="ccx-table"><thead><tr><th>#</th><th>Generic name / الاسم العلمي</th><th>Concentration / التركيز</th></tr></thead><tbody>'+
    (entry.medicines||[]).map(function(m,i){return '<tr><td>'+(i+1)+'</td><td><b>'+esc(m.name)+'</b></td><td>'+esc(m.concentration||'—')+'</td></tr>'}).join('')+
    '</tbody></table></div></div></div>';
}

function clPrint(type){
  var entry=clEntry(type);if(!entry||!(entry.medicines||[]).length)return toast&&toast('Generate the list first / أنشئ القائمة أولاً','err');
  var lbl=CL_LABELS[type];
  var rows=(entry.medicines||[]).map(function(m,i){return '<tr><td>'+(i+1)+'</td><td><b>'+esc(m.name)+'</b></td><td>'+esc(m.concentration||'—')+'</td></tr>'}).join('');
  var html='<h1 style="font-size:14pt;margin:0 0 2px">'+esc(lbl.en)+'</h1><h2 style="font-size:12pt;margin:0 0 10px;font-weight:600" dir="rtl">'+esc(lbl.ar)+'</h2>'+
    '<div style="font-size:9.5pt;margin-bottom:10px;line-height:1.7">'+
      '<div><b>Reference relied upon / المرجع المعتمد:</b> '+esc(entry.referenceName||'—')+'</div>'+
      '<div><b>Approval date / تاريخ الاعتماد:</b> '+esc((entry.approvedAt||'').slice(0,10))+' &nbsp; <b>Effective date / تاريخ الفعالية:</b> '+esc((entry.effectiveAt||'').slice(0,10))+'</div>'+
      '<div><b>Valid until / صالح حتى:</b> '+esc((entry.expiresAt||'').slice(0,10))+' (1 year from approval / سنة من تاريخ الاعتماد)</div>'+
    '</div>'+
    '<table style="width:100%;border-collapse:collapse" border="1" cellpadding="5"><thead><tr style="background:#eee"><th>#</th><th>Generic name / الاسم العلمي</th><th>Concentration / التركيز</th></tr></thead><tbody>'+rows+'</tbody></table>';
  window.fsOfficialPrint({title:lbl.en,html:html,css:'table{font-size:9.5pt}th,td{border:1px solid #999;padding:5px}'});
}

window.renderClassificationLists=function(){
  var host=E('pg-classification-lists');if(!host)return;
  var master=clIsMaster();
  if(!master&&!window.clHasVisibleLists()){
    host.innerHTML='<div class="card"><div class="cb" style="text-align:center;color:var(--tx2)">No classification lists are available for your role yet. / لا توجد قوائم تصنيف متاحة لدورك حالياً.</div></div>';
    return;
  }
  var title='<div class="stitle">⚠ Classification Lists / قوائم التصنيف</div><div class="ssub" style="margin:0">High Alert, Hazard, and LASA medication lists — master builds and approves them; visibility per role is master-controlled.</div>';
  var body=master
    ?CL_TYPES.map(clMasterTypeCard).join('')
    :clVisibleTypesForRole().map(clReadOnlyTypeCard).join('');
  host.innerHTML='<div class="fl ic jb mb14" style="flex-wrap:wrap;gap:10px"><div>'+title+'</div></div>'+body;
};

window.clGenerate=function(type){
  if(!clIsMaster())return;
  staged[type]=clScanCandidates(type);
  window.renderClassificationLists();
};
window.clCancelReview=function(type){
  delete staged[type];
  window.renderClassificationLists();
};
window.clConfirmSave=function(type){
  if(!clIsMaster())return;
  var host=E('pg-classification-lists');
  var nameInputs=host.querySelectorAll('.cl-dup-name');
  var overrides={};
  nameInputs.forEach(function(inp){overrides[inp.dataset.clKey]=inp.value.trim()});
  var groups=staged[type]||[];
  var medicines=groups.map(function(g){return {name:(overrides[g.key]||g.chosenName||g.generic).trim(),concentration:g.concentration||''}});
  var refInput=E('cl-ref-'+type);
  var referenceName=(refInput&&refInput.value||'').trim();
  if(!referenceName)return toast&&toast('Enter the reference relied upon first / أدخل المرجع المعتمد أولاً','err');
  var now=new Date(),expires=new Date(now.getTime());expires.setFullYear(expires.getFullYear()+1);
  var existing=clEntry(type)||{};
  var entry={
    referenceName:referenceName,
    approvedAt:now.toISOString(),
    effectiveAt:now.toISOString(),
    expiresAt:expires.toISOString(),
    medicines:medicines,
    visibleRoles:existing.visibleRoles||[]
  };
  delete staged[type];
  clSave(type,entry).then(function(){
    toast&&toast('Classification list saved — valid for 1 year ✓','succ');
    window.renderClassificationLists();
  }).catch(function(err){toast&&toast('Save failed: '+String(err&&err.message||err),'err')});
};
window.clPrint=clPrint;
window.clToggleRole=function(checkbox,type,role){
  if(!clIsMaster())return;
  var entry=clEntry(type);if(!entry){checkbox.checked=!checkbox.checked;return toast&&toast('Generate and save the list first / أنشئ واحفظ القائمة أولاً','err')}
  var roles=(entry.visibleRoles||[]).slice(),i=roles.indexOf(role);
  if(checkbox.checked&&i<0)roles.push(role);else if(!checkbox.checked&&i>=0)roles.splice(i,1);
  var next=Object.assign({},entry,{visibleRoles:roles});
  clSave(type,next).then(function(){toast&&toast('Visibility updated ✓','succ')}).catch(function(err){toast&&toast('Update failed: '+String(err&&err.message||err),'err')});
};

// classification_lists_v1 is part of the cold-load key set, but on a scoped
// role's first login the app shell (and its one-time buildNav() nav-item
// list) can render before that specific key's value has actually landed in
// S.cache — buildNav() never re-runs on its own afterward, so the tab stays
// missing even though the data arrives moments later. Re-check once real
// (non-cached) data is confirmed loaded.
document.addEventListener('asdh:real-load-complete',function(){
  if(typeof window.buildNav==='function'&&window.CU)window.buildNav();
});

publishLegacy("82-classification-lists.js", {
  clScanCandidates,
  clHasVisibleLists: window.clHasVisibleLists,
  clOpenClassificationLists: window.clOpenClassificationLists,
  renderClassificationLists: window.renderClassificationLists
});
})();

export {};

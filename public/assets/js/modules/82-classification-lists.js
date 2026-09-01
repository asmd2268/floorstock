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

function clDeptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}

// Scan every department's medicines flagged for `type`, group by canonical
// drug identity, and record every distinct raw name spelling found for that
// identity — together with which department(s) reported each spelling —
// so master can see exactly where a "duplicate" came from before merging.
function clScanCandidates(type){
  var depts=typeof window.gd==='function'?(window.gd()||[]):[];
  var groups={};
  depts.forEach(function(d){
    var meds=typeof window.getMeds==='function'?(window.getMeds(d.id)||[]):[];
    meds.forEach(function(m){
      if(!m||!clFlag(type,m))return;
      var c=clCanonical(m),key=clGroupKey(c);
      if(!groups[key])groups[key]={generic:c.generic,concentration:c.concentration,variants:{},depts:{}};
      var raw=String(m.name||c.generic).trim();
      if(!groups[key].variants[raw])groups[key].variants[raw]={count:0,depts:{}};
      groups[key].variants[raw].count++;
      groups[key].variants[raw].depts[String(d.id)]=1;
      groups[key].depts[String(d.id)]=1;
    });
  });
  return Object.keys(groups).sort().map(function(k){
    var g=groups[k],names=Object.keys(g.variants).sort(function(a,b){return g.variants[b].count-g.variants[a].count});
    return {
      key:k,generic:g.generic,concentration:g.concentration,
      variants:names.map(function(n){return {name:n,departmentIds:Object.keys(g.variants[n].depts)}}),
      departmentIds:Object.keys(g.depts),
      chosenName:names[0]||g.generic
    };
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
      st.map(function(g){
        var isDup=g.variants.length>1;
        var sourceLine=isDup
          ?g.variants.map(function(v){return esc(v.name)+' ('+v.departmentIds.map(clDeptName).map(esc).join(', ')+')'}).join(' &nbsp;·&nbsp; ')
          :'from: '+g.departmentIds.map(clDeptName).map(esc).join(', ');
        return '<div class="cl-dup-row"><label style="display:flex;gap:8px;align-items:flex-start">'+
          '<input type="checkbox" class="cl-dup-include" data-cl-key="'+esc(g.key)+'" checked style="margin-top:3px">'+
          '<div style="flex:1;min-width:0">'+
            '<div class="fhint">'+esc(g.concentration||'')+' — '+sourceLine+'</div>'+
            (isDup
              ?'<input type="text" class="cl-dup-name" data-cl-key="'+esc(g.key)+'" value="'+esc(g.chosenName)+'" placeholder="Final name / الاسم النهائي">'
              :'<div style="font-weight:600;margin-top:4px">'+esc(g.chosenName)+'</div>')+
          '</div></label></div>';
      }).join('')+
      '<div class="fhint" style="margin-top:6px">Uncheck a row to exclude that medicine from the list entirely. / ألغِ التحديد لاستبعاد الدواء من القائمة نهائيًا.</div>'+
      '<div class="fl g8" style="margin-top:10px"><button class="btn bs bsm" onclick="window.clConfirmSave(\''+type+'\')">✔ Confirm &amp; save list / تأكيد وحفظ</button><button class="btn bg bsm" onclick="window.clCancelReview(\''+type+'\')">Cancel / إلغاء</button></div>'+
      '</div></div>';
  }
  var defaultDate=(entry&&entry.approvedAt?entry.approvedAt:new Date().toISOString()).slice(0,10);
  return '<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">'+esc(lbl.en)+' / '+esc(lbl.ar)+'</span>'+clStatusBadge(entry)+'</div><div class="cb">'+
    '<div class="fg"><label>Reference relied upon / المرجع المعتمد</label><input type="text" class="cl-ref" id="cl-ref-'+type+'" value="'+esc(entry&&entry.referenceName||'')+'" placeholder="e.g. ISMP List of High-Alert Medications 2024"></div>'+
    '<div class="fg" style="max-width:220px"><label>Approval date / تاريخ الاعتماد</label><input type="date" id="cl-approval-date-'+type+'" value="'+esc(defaultDate)+'"></div>'+
    '<div class="fhint">'+medCount+' medicine(s) currently on this list'+(entry&&entry.approvedAt?(' · Approved '+esc((entry.approvedAt||'').slice(0,10))+' · Effective '+esc((entry.effectiveAt||'').slice(0,10))):'')+'</div>'+
    '<div class="fl g8" style="margin-top:8px"><button class="btn bp bsm" onclick="window.clGenerate(\''+type+'\')">🔄 Generate / Refresh from all departments</button><button class="btn bg bsm" onclick="window.clPrint(\''+type+'\')" '+(medCount?'':'disabled')+'>🖨 Print</button></div>'+
    '<label class="cl-role-chk" style="margin-top:10px;max-width:420px"><input type="checkbox" onchange="window.clTogglePerDeptFilter(this,\''+type+'\')" '+(entry&&entry.perDepartmentFilter===true?'checked':'')+'><span>Departments each see only their own medicines on this list / كل قسم يشوف أدويته فقط بهذي القائمة</span></label>'+
    '<div class="fhint" style="margin-top:10px"><b>Visible to / تظهر لـ:</b></div><div class="cl-roles-grid">'+rolesHtml+'</div>'+
    reviewHtml+
  '</div></div>';
}

function clReadOnlyTypeCard(type){
  var entry=clEntry(type),lbl=CL_LABELS[type];
  if(!entry)return '';
  var meds=clMedicinesForViewer(entry);
  var scopedNote=(entry.perDepartmentFilter===true&&clRole()==='department')
    ?'<div class="fhint">Showing only medicines found in your department / تُعرض فقط الأدوية الموجودة بقسمك</div>':'';
  return '<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">'+esc(lbl.en)+' / '+esc(lbl.ar)+'</span>'+clStatusBadge(entry)+'</div><div class="cb">'+
    '<div class="fhint"><b>Reference / المرجع:</b> '+esc(entry.referenceName||'—')+'</div>'+
    '<div class="fhint"><b>Approved / الاعتماد:</b> '+esc((entry.approvedAt||'').slice(0,10))+' · <b>Effective / الفعالية:</b> '+esc((entry.effectiveAt||'').slice(0,10))+'</div>'+
    scopedNote+
    '<div class="fl g8" style="margin:8px 0"><button class="btn bg bsm" onclick="window.clPrint(\''+type+'\')">🖨 Print</button></div>'+
    '<div class="tw"><table class="ccx-table"><thead><tr><th>#</th><th>Generic name / الاسم العلمي</th><th>Concentration / التركيز</th></tr></thead><tbody>'+
    meds.map(function(m,i){return '<tr><td>'+(i+1)+'</td><td><b>'+esc(m.name)+'</b></td><td>'+esc(m.concentration||'—')+'</td></tr>'}).join('')+
    '</tbody></table></div></div></div>';
}

function clPrint(type){
  var entry=clEntry(type);if(!entry||!(entry.medicines||[]).length)return toast&&toast('Generate the list first / أنشئ القائمة أولاً','err');
  var meds=clMedicinesForViewer(entry);
  var lbl=CL_LABELS[type];
  var approvedDate=esc((entry.approvedAt||'').slice(0,10));
  var effectiveDate=esc((entry.effectiveAt||'').slice(0,10));
  var expiresDate=esc((entry.expiresAt||'').slice(0,10));
  var rows=meds.map(function(m,i){return '<tr><td style="text-align:center">'+(i+1)+'</td><td><b>'+esc(m.name)+'</b></td><td>'+esc(m.concentration||'—')+'</td></tr>'}).join('');
  var qrUrl='https://chart.googleapis.com/chart?chs=110x110&cht=qr&choe=UTF-8&chl='+encodeURIComponent('https://floorstock-one.vercel.app');
  var html=
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'+
      '<div style="flex:1">'+
        '<h1 style="font-size:15pt;margin:0 0 3px;font-weight:700">'+esc(lbl.en)+'</h1>'+
        '<h2 style="font-size:13pt;margin:0 0 10px;font-weight:700;direction:rtl">'+esc(lbl.ar)+'</h2>'+
        '<div style="font-size:9.5pt;line-height:1.85;border-top:1px solid #ccc;padding-top:8px">'+
          '<div><b>Reference relied upon / المرجع المعتمد:</b> '+esc(entry.referenceName||'—')+'</div>'+
          '<div><b>Approval date / تاريخ الاعتماد:</b> '+approvedDate+'&emsp;<b>Effective date / تاريخ الفعالية:</b> '+effectiveDate+'</div>'+
          '<div><b>Valid until / صالح حتى:</b> '+expiresDate+' &nbsp;<span style="color:#555">(1 year from approval / سنة من تاريخ الاعتماد)</span></div>'+
          '<div style="margin-top:6px;padding:5px 8px;background:#f0f4ff;border-right:3px solid #3a6fd8;font-size:8.5pt;color:#333">'+
            '✔ هذه القائمة معتمدة إلكترونياً ولا تحتاج إلى ختم أو توقيع يدوي. &nbsp;|&nbsp; This list is electronically approved and does not require a stamp or manual signature.'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div style="margin-left:18px;text-align:center">'+
        '<img src="'+qrUrl+'" width="110" height="110" style="display:block;border:1px solid #ddd;padding:3px">'+
        '<div style="font-size:7.5pt;color:#555;margin-top:3px">Scan to open app</div>'+
      '</div>'+
    '</div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:9.5pt" border="1" cellpadding="5">'+
      '<thead><tr style="background:#e8e8e8"><th style="width:36px;text-align:center">#</th><th>Generic name / الاسم العلمي</th><th style="width:160px">Concentration / التركيز</th></tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
    '</table>';
  window.fsOfficialPrint({title:lbl.en,html:html,css:'body{font-family:Arial,sans-serif}table{font-size:9.5pt}th,td{border:1px solid #bbb;padding:5px}thead tr{background:#e8e8e8}tr:nth-child(even){background:#f9f9f9}'});
}

function injectClsListTabBar(){var pg=E('pg-classification-lists');if(!pg||pg.querySelector('.cls-tab-bar'))return;if(!(typeof window.isMasterActual==='function'&&window.isMasterActual()))return;var bar=document.createElement('div');bar.className='cls-tab-bar';bar.style.cssText='display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap';bar.innerHTML='<button class="btn bp bsm" disabled><b>⚠ Classification Lists</b></button><button class="btn bg bsm" onclick="clTabColors()">🎨 Badge Colors</button>';pg.insertBefore(bar,pg.firstChild)}
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
  injectClsListTabBar();
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
  var overrides={},included={};
  host.querySelectorAll('.cl-dup-name').forEach(function(inp){overrides[inp.dataset.clKey]=inp.value.trim()});
  host.querySelectorAll('.cl-dup-include').forEach(function(chk){included[chk.dataset.clKey]=chk.checked});
  var groups=(staged[type]||[]).filter(function(g){return included[g.key]!==false});
  var medicines=groups.map(function(g){return {name:(overrides[g.key]||g.chosenName||g.generic).trim(),concentration:g.concentration||'',departmentIds:g.departmentIds||[]}});
  var refInput=E('cl-ref-'+type);
  var referenceName=(refInput&&refInput.value||'').trim();
  if(!referenceName)return toast&&toast('Enter the reference relied upon first / أدخل المرجع المعتمد أولاً','err');
  var dateInput=E('cl-approval-date-'+type);
  var approvalStr=(dateInput&&dateInput.value)||new Date().toISOString().slice(0,10);
  var approvalDate=new Date(approvalStr+'T00:00:00');
  var expires=new Date(approvalDate);expires.setFullYear(expires.getFullYear()+1);
  var existing=clEntry(type)||{};
  var entry={
    referenceName:referenceName,
    approvedAt:approvalDate.toISOString(),
    effectiveAt:approvalDate.toISOString(),
    expiresAt:expires.toISOString(),
    medicines:medicines,
    visibleRoles:existing.visibleRoles||[],
    perDepartmentFilter:existing.perDepartmentFilter===true
  };
  delete staged[type];
  clSave(type,entry).then(function(){
    toast&&toast('Classification list saved — valid for 1 year ✓','succ');
    window.renderClassificationLists();
  }).catch(function(err){toast&&toast('Save failed: '+String(err&&err.message||err),'err')});
};
window.clTogglePerDeptFilter=function(checkbox,type){
  if(!clIsMaster())return;
  var entry=clEntry(type);if(!entry){checkbox.checked=!checkbox.checked;return toast&&toast('Generate and save the list first / أنشئ واحفظ القائمة أولاً','err')}
  var next=Object.assign({},entry,{perDepartmentFilter:!!checkbox.checked});
  clSave(type,next).then(function(){toast&&toast('Updated ✓','succ');window.renderClassificationLists()}).catch(function(err){toast&&toast('Update failed: '+String(err&&err.message||err),'err')});
};
// Medicines a given viewer should actually see for this list: the full set,
// unless master has turned on the per-department filter and the viewer is a
// department account — then only medicines that were found in THEIR own
// department's inventory during generation.
function clMedicinesForViewer(entry){
  var meds=entry.medicines||[];
  if(entry.perDepartmentFilter===true&&clRole()==='department'&&window.CU&&window.CU.deptId){
    var deptId=String(window.CU.deptId);
    return meds.filter(function(m){return Array.isArray(m.departmentIds)&&m.departmentIds.indexOf(deptId)>=0});
  }
  return meds;
}
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

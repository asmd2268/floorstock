import { publishLegacy } from '../core/legacy-registry.js?v=003344116e';
import { buildTestSession, restoreActualSession } from '../core/master-test-mode.js?v=5c343a4df5';
import { fsNorm, fsText, fsNum } from '../core/text-normalize.js?v=aa16ae9ac0';
import { fsE, fsEsc } from '../core/dom-utils.js?v=b2909b7f46';
import { uiToast, uiNow, uiActor, uiAudit, uiCloseModal, uiOpenModal, uiEnsureStyles } from '../core/module-ui-helpers.js?v=4dc31675ec';
import { fsR5DepartmentRecords, fsR5DepartmentCandidates } from '../core/department-names.js?v=5aa184ebd6';
import { fsR5DMY, fsR12DateOnly, fsR12PrintDate, fsR12ExpiryDays, fsR12HasNearExpiry, fsR12BatchSummaryHtml, fsR5BatchText, fsR5Class, fsR5ExpiryDays, fsR5NearDays } from '../core/controlled-expiry-format.js?v=4fe8aa218d';

/* ASDHealth FloorStock — R6.32 canonical rules.
   Direct top-level definitions only. No wrapper chaining. */

/* My controlled list: department read-only view and one-page A4 print. */

function fsR5ControlledDept(){
  var effective=(typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():window.CU||{}),value='';
  try{if(typeof window.ctlCurrentDept==='function')value=window.ctlCurrentDept()||''}catch(e){}
  if(!value)value=effective.deptId||effective.departmentId||effective.department||'';
  var selector=fsE('ctl-dept');
  if(!value&&selector)value=selector.value||'';
  return fsText(value,'');
}
function fsR5ControlledMedicine(id,row){
  var m={};row=row||{};
  try{if(typeof window.ctlMedicine==='function')m=window.ctlMedicine(id)||{}}catch(e){}
  return {
    name:fsText(m.name||row.name||row.medName||row.medicineName,'Unknown medicine / دواء غير معروف'),
    moh:fsText(m.moh||m.mohCode||row.moh||row.mohCode,''),
    nupco:fsText(m.nupco||m.nupcoCode||row.nupco||row.nupcoCode,''),
    classification:fsText(m.classification||row.classification,'narcotic')
  };
}
function fsR5NormalizeControlled(rows,source){
  return (Array.isArray(rows)?rows:[]).map(function(row,i){
    row=row||{};
    var id=row.medId||row.medicationId||row.id;
    var m=fsR5ControlledMedicine(id,row);
    var rawBatches=[];

    if(Array.isArray(row.batches))rawBatches=row.batches;
    else if(Array.isArray(row.batchList))rawBatches=row.batchList;
    else if(Array.isArray(row.lots))rawBatches=row.lots;
    else if(Array.isArray(row.expiryBatches))rawBatches=row.expiryBatches;
    else if(
      row.expiry||row.expiryDate||row.expDate||row.date||
      row.lot||row.lotNo||row.batch||row.batchNo||row.batchNumber
    ){
      rawBatches=[row];
    }

    var batches=rawBatches.map(function(batch){
      batch=batch||{};
      var lot=batch.lot!=null?batch.lot:
        (batch.lotNo!=null?batch.lotNo:
        (batch.batch!=null?batch.batch:
        (batch.batchNo!=null?batch.batchNo:
        (batch.batchNumber!=null?batch.batchNumber:''))));
      var expiry=batch.expiry||batch.expiryDate||batch.expDate||batch.date||'';
      var qty=batch.qty!=null?batch.qty:
        (batch.quantity!=null?batch.quantity:
        (batch.available!=null?batch.available:
        (batch.actualQty!=null?batch.actualQty:'')));

      return {
        lot:fsText(lot,''),
        expiry:fsText(expiry,''),
        qty:qty===''?'':fsNum(qty)
      };
    }).filter(function(batch){
      return batch.lot||batch.expiry||batch.qty!=='';
    });

    return {
      key:fsText(id,'row_'+i),
      name:m.name,
      moh:m.moh,
      nupco:m.nupco,
      classification:m.classification,
      required:row.requiredQty!=null?fsNum(row.requiredQty):
        (row.required!=null?fsNum(row.required):
        (row.max!=null?fsNum(row.max):'—')),
      actual:row.actualQty!=null?fsNum(row.actualQty):
        (row.available!=null?fsNum(row.available):fsNum(row.qty)),
      batches:batches,
      source:source
    };
  });
}
async function fsR5ControlledRows(dept){
  function addUnique(list,value){
    value=fsText(value,'');
    if(value&&list.indexOf(value)<0)list.push(value);
  }
  function aliasTokens(value){
    var out=[],norm=fsNorm(value);
    addUnique(out,value);
    var aliases=window.floorstockDepartmentAliases||{};
    Object.keys(aliases).forEach(function(label){
      var values=[label].concat(aliases[label]||[]);
      if(values.some(function(v){return fsNorm(v)===norm;})){
        values.forEach(function(v){addUnique(out,v);});
      }
    });
    return out;
  }
  function candidateIds(){
    var out=fsR5DepartmentCandidates(dept,window.CU&&(CU.deptName||CU.departmentName))||[];
    var targets=[];
    [dept,window.CU&&CU.deptId,window.CU&&CU.departmentId,window.CU&&CU.originalDeptId,window.CU&&(CU.deptName||CU.departmentName)].forEach(function(v){
      aliasTokens(v).forEach(function(x){addUnique(targets,x);});
    });
    fsR5DepartmentRecords().forEach(function(d){
      var match=targets.some(function(target){
        return String(d.id)===String(target)||fsNorm(d.name)===fsNorm(target)||fsNorm(d.id)===fsNorm(target);
      });
      if(match)addUnique(out,d.id);
    });
    targets.forEach(function(v){
      var mapped=FS_R5_DEPT_ALIASES[fsNorm(v)];
      addUnique(out,mapped);
      addUnique(out,v);
    });
    if(window.S&&S.cache){
      Object.keys(S.cache).filter(function(key){return key.indexOf('controlled_dept_list_')===0;}).forEach(function(key){
        var suffix=key.slice('controlled_dept_list_'.length);
        var record=fsR5DepartmentRecords().find(function(d){return String(d.id)===String(suffix);});
        var matches=out.some(function(v){return String(v)===String(suffix)||fsNorm(v)===fsNorm(suffix);})||
          targets.some(function(v){return fsNorm(v)===fsNorm(suffix)||(record&&fsNorm(record.name)===fsNorm(v));});
        if(matches)addUnique(out,suffix);
      });
    }
    return out;
  }
  function normalizePrivate(value,source){
    var rows=fsR5NormalizeControlled(Array.isArray(value)?value:[],source);
    return rows.filter(function(row){return row&&row.name&&row.name!=='Unknown medicine / دواء غير معروف'||row.key;});
  }
  async function readStateRest(id){
    if(typeof fsStateRestRequest!=='function'||typeof fsStateRestBase!=='function')return [];
    var tenant=window.fsTenantId&&fsTenantId(),statePath=tenant?'tenants/'+tenant+'/state':'floorstock_state';
    var url=fsStateRestBase()+'/'+statePath.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent('controlled_dept_list_'+id)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    var response=await fsStateRestRequest(url,{method:'GET'},8000);
    if(response.status===404||!response.payload)return [];
    var decoded=fsLoginDecodeRestDocument(response.payload)||{};
    return normalizePrivate(decoded.value,'private-rest');
  }
  async function readPublicRest(id){
    if(typeof fsStateRestRequest!=='function'||typeof fsStateRestBase!=='function')return [];
    var tenant=window.fsTenantId&&fsTenantId(),path=tenant?'tenants/'+tenant+'/public_controlled_expiry':'public_controlled_expiry';
    var url=fsStateRestBase()+'/'+path.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent(id)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    var response=await fsStateRestRequest(url,{method:'GET'},8000);
    if(response.status===404||!response.payload)return [];
    var decoded=fsLoginDecodeRestDocument(response.payload)||{};
    return fsR5NormalizeControlled(decoded.items||decoded.medicines||[],'public-rest');
  }

  var candidates=candidateIds(),errors=[];
  for(var i=0;i<candidates.length;i++){
    var id=candidates[i],cacheRows=[];
    try{
      var key='controlled_dept_list_'+id;
      var raw=window.S&&S.cache&&Object.prototype.hasOwnProperty.call(S.cache,key)?S.cache[key]:
        (typeof window.ctlDeptList==='function'?window.ctlDeptList(id):[]);
      cacheRows=normalizePrivate(raw,'private-cache');
      if(cacheRows.length)return {dept:id,rows:cacheRows,source:'private-cache'};
    }catch(error){errors.push(error);}
  }

  for(var j=0;j<candidates.length;j++){
    try{
      var restRows=await readStateRest(candidates[j]);
      if(restRows.length){
        if(window.S&&S.cache)S.cache['controlled_dept_list_'+candidates[j]]=restRows.map(function(row){return {
          medId:row.key,requiredQty:row.required,actualQty:row.actual,qty:row.actual,batches:row.batches
        };});
        return {dept:candidates[j],rows:restRows,source:'private-rest'};
      }
    }catch(error){errors.push(error);}
  }

  for(var k=0;k<candidates.length;k++){
    try{
      var publicRows=await readPublicRest(candidates[k]);
      if(publicRows.length){
        if(window.S&&S.cache)S.cache['controlled_dept_list_'+candidates[k]]=publicRows.map(function(row){return {medId:row.key,requiredQty:row.required,actualQty:row.actual,qty:row.actual,batches:row.batches}});
        return {dept:candidates[k],rows:publicRows,source:'public-rest'};
      }
    }catch(error){errors.push(error);}
  }

  if(window.FB_DB){
    for(var n=0;n<candidates.length;n++){
      try{
        var ref=(window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry')).doc(String(candidates[n]));
        var snap=await fsLoginTimeout(ref.get({source:'server'}),5000,'Controlled custody SDK request timed out.');
        if(snap&&snap.exists){
          var data=snap.data()||{},sdkRows=fsR5NormalizeControlled(data.items||data.medicines||[],'public-sdk');
          if(sdkRows.length)return {dept:candidates[n],rows:sdkRows,source:'public-sdk'};
        }
      }catch(error){errors.push(error);}
    }
  }

  if(errors.length)console.warn('Controlled custody lookup completed without rows.',errors);
  return {dept:candidates[0]||dept,rows:[],source:'not-found',candidates:candidates};
}
window.ctlDeptFinalApply=function(){
  var dept=fsR5ControlledDept(),input=fsE('ctl-dept-final-days'),days=Math.floor(fsNum(input&&input.value));
  if(days<1)return uiToast('Enter a valid number of days / أدخل عدد أيام صحيحًا','err');
  try{sessionStorage.setItem('asdhealth-controlled-near-days-'+dept,String(days))}catch(e){}
  return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
};
window.ctlDeptFinalToggle=function(){
  window.CTL_DEPT_ONLY_SOON=!window.CTL_DEPT_ONLY_SOON;
  return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
};
window.renderDepartmentControlledPanel=async function(){
  var effective=(typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():window.CU||{});
  if(String(effective.role||'')!=='department')return false;
  var outer=fsE('ctl-departments-view');
  // Render into a dedicated child panel instead of overwriting ctl-departments-view's
  // innerHTML directly: that container also holds the static custodian markup
  // (#ctl-dept, #ctl-dept-table) that renderCtlDepartments() depends on for
  // controlled_pharmacy/warehouse sessions. Clobbering it here permanently destroys
  // those elements for the rest of the SPA session (no page reload between logins),
  // leaving a stale department view visible after a later custodian sign-in.
  var host=fsE('ctl-dept-only-panel');
  if(!outer||!host)return false;
  var custodianPanel=fsE('ctl-departments-custodian-panel');
  if(custodianPanel)custodianPanel.style.display='none';
  if(host.dataset.controlledLoading==='1')return false;
  host.dataset.controlledLoading='1';

  window.CTL_VIEW='departments';
  var overview=fsE('ctl-overview-view');
  if(overview)overview.style.display='none';
  outer.style.display='block';
  host.style.display='block';
  host.innerHTML='<div class="card"><div class="cb">Loading My controlled list… / جاري تحميل عهدتي…</div></div>';

  try{
    var requested=fsR5ControlledDept();
    var result=await fsLoginTimeout(
      fsR5ControlledRows(requested),
      18000,
      'Controlled custody loading timed out.'
    );
    var dept=result.dept||requested;
    var rows=result.rows||[];
    var days=fsR5NearDays(dept);

    var shown=window.CTL_DEPT_ONLY_SOON?rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=days;
    }):rows;

    var soon=rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=days&&remaining>0;
    }).length;

    var expired=rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=0;
    }).length;

    var body=shown.map(function(row,index){
      return '<tr>'+
        '<td>'+(index+1)+'</td>'+
        '<td>'+fsEsc(row.moh||'—')+'</td>'+
        '<td>'+fsEsc(row.nupco||'—')+'</td>'+
        '<td><b>'+fsEsc(row.name)+'</b></td>'+
        '<td>'+fsEsc(fsR5Class(row.classification))+'</td>'+
        '<td>'+fsEsc(row.required)+'</td>'+
        '<td>'+fsEsc(row.actual)+'</td>'+
        '<td class="ctl-batch-number-cell">'+fsR12BatchSummaryHtml(row.batches)+'</td>'+
      '</tr>';
    }).join('');

    if(!body){
      body='<tr><td colspan="8" style="text-align:center;padding:24px">'+
        'No medicines are assigned to this department custody / لا توجد أدوية مسندة لعهدة هذا القسم'+
      '</td></tr>';
    }

    var deptName=effective.deptName||effective.departmentName||
      window.floorstockDepartmentName({id:dept});

    host.innerHTML=
      '<div class="fl ic jb mb14" style="flex-wrap:wrap;gap:10px">'+
        '<div><div class="stitle">My controlled list / عهدتي</div>'+
        '<div class="ssub" style="margin:0">Controlled Custody — '+
          fsEsc(deptName)+' · Read-only</div></div>'+
        '<span class="badge bbl">View only / للاطلاع</span>'+
      '</div>'+
      '<div class="card"><div class="cb"><div class="ctl-rulebar">'+
        '<div class="fg"><label>Near-expiry rule (days)</label>'+
          '<input id="ctl-dept-final-days" type="number" min="1" value="'+days+'"></div>'+
        '<button class="btn bp" onclick="ctlDeptFinalApply()">Apply rule</button>'+
        '<button class="btn bg" onclick="ctlDeptFinalToggle()">'+
          (window.CTL_DEPT_ONLY_SOON?'Show all medicines':'Show near-expiry only')+
        '</button>'+
        '<button class="btn bp" id="ctl-dept-authoritative-print-btn" '+
          'onclick="ctlConfirmDepartmentPrint(event)">🖨 Print My controlled list / طباعة عهدتي</button>'+
      '</div>'+
      '<div class="ctl-summary">'+
        '<div class="sc"><div class="sl">Total medicines</div><div class="sv">'+rows.length+'</div></div>'+
        '<div class="sc"><div class="sl">Near expiry ≤ '+days+' days</div><div class="sv">'+soon+'</div></div>'+
        '<div class="sc"><div class="sl">Expired</div><div class="sv">'+expired+'</div></div>'+
      '</div>'+
      '<div class="fhint" style="margin-top:8px">Data source: '+
        fsEsc(result.source||'unknown')+'</div></div></div>'+
      '<div class="card">'+
        '<div class="ch"><span class="ct">Controlled and Restricted Medicines List / قائمة الأدوية المخدرة والمقيدة</span></div>'+
                '<div class="tw ctl-dept-custody-scroll">'+
          '<table class="ctl-dept-custody-table">'+
            '<colgroup>'+
              '<col style="width:4%"><col style="width:9%"><col style="width:10%">'+
              '<col style="width:24%"><col style="width:11%"><col style="width:8%">'+
              '<col style="width:8%"><col style="width:26%">'+
            '</colgroup>'+
            '<thead><tr>'+
              '<th>#</th><th>MOH Code</th><th>NUPCO Code</th><th>Medicine</th>'+
              '<th>Class</th><th>Required</th><th>Actual</th>'+
              '<th>Batches / الدفعات — Lot · Qty · Expiry</th>'+
            '</tr></thead>'+
            '<tbody>'+body+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>';

    host.style.display='block';
    delete host.dataset.controlledLoading;
    return true;
  }catch(error){
    console.error('Department controlled custody render failed.',error);
    host.style.display='block';
    host.innerHTML='<div class="card"><div class="cb">'+
      '<div class="alert-banner">Controlled custody could not be loaded / تعذر تحميل عهدة القسم</div>'+
      '<p style="margin-top:10px">'+fsEsc(error&&error.message||error)+'</p>'+
      '<button class="btn bp" type="button" onclick="renderDepartmentControlledPanel()">'+
        'Retry / إعادة المحاولة</button></div></div>';
    delete host.dataset.controlledLoading;
    return false;
  }
};
function fsR5PublicUrl(dept){
  try{if(typeof window.ctlPublicUrl==='function')return window.ctlPublicUrl(dept)}catch(e){}
  var url=new URL(location.origin+location.pathname);url.searchParams.set('view','controlled-expiry');url.searchParams.set('dept',dept);var tenant=window.fsTenantId&&fsTenantId();if(tenant)url.searchParams.set('tenant',tenant);return url.toString();
}
function fsR5Logo(){try{if(typeof window.ctlLogo==='function')return window.ctlLogo()||''}catch(e){}return ''}
function fsR5PrintSettings(dept){try{if(typeof window.ctlPrintSettings==='function')return window.ctlPrintSettings(dept)||{}}catch(e){}return {}}
/* Arabic department name for the printed heading.
 *
 * Resolved by module 83, which keeps the mapping as master-editable state keyed by
 * department id and falls back to a seed table for departments that have not been
 * given one yet. A department with no Arabic name prints its English heading only,
 * so adding a department never breaks a printout. */
function fsDeptNameAr(deptId,englishName){
  return typeof window.fsDeptPrintNameAr==='function'
    ? window.fsDeptPrintNameAr(deptId,englishName)
    : '';
}

function fsR5ControlledPrintHtml(dept,rows){
  var effective=(typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():window.CU||{});
  var name=window.floorstockDepartmentName({
    id:dept,
    name:effective.deptName||effective.departmentName
  });
  var settings=fsR5PrintSettings(dept);
  var url=fsR5PublicUrl(dept);
  var official=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var printInfo=fsR12PrintDate();
  var qr=window.makeReadableQR(url);

  var body=rows.map(function(row,index){
    var near=fsR12HasNearExpiry(row.batches,30,printInfo.dayUtc);
    return '<tr class="custody-row'+(near?' near-expiry-30':'')+'">'+
      '<td>'+(index+1)+'</td>'+
      '<td>'+fsEsc(row.moh||'—')+'</td>'+
      '<td>'+fsEsc(row.nupco||'—')+'</td>'+
      '<td class="medicine">'+fsEsc(row.name)+'</td>'+
      '<td>'+fsEsc(fsR5Class(row.classification))+'</td>'+
      '<td>'+fsEsc(row.required)+'</td>'+
      '<td>'+fsEsc(row.actual)+'</td>'+
      '<td class="batch">'+fsR5BatchText(row.batches,true,row.actual)+'</td>'+
    '</tr>';
  }).join('');

  var signatures=[
    ['Head Nurse / رئيس التمريض',settings.nursingHead||''],
    ['Controlled Medicines Officer / مسؤول الأدوية المخدرة والمقيدة',
      settings.controlledOfficer||settings.controlledPharmacyOfficer||''],
    ['Pharmacy Manager / مدير الصيدلية',settings.pharmacyManager||'']
  ].map(function(signature){
    return '<div class="signature"><b>'+fsEsc(signature[0])+'</b>'+
      '<span>'+fsEsc(signature[1]||'')+'</span></div>';
  }).join('');

  var css=`@page{size:A4 landscape;margin:6mm}
*{
  box-sizing:border-box;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
html,body{
  margin:0!important;
  padding:0!important;
  width:100%!important;
  height:100%!important;
  overflow:hidden!important;
  background:#fff!important;
  color:#000!important;
  font-family:Arial,Tahoma,sans-serif;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
body{position:fixed!important;inset:0!important}
.sheet{position:fixed;inset:0;overflow:hidden;background:#fff}
.controlled-layout{
  position:absolute;
  top:0;
  left:0;
  overflow:hidden;
  background:#fff;
  padding:1mm;
  --fs:7.6pt;
  --py:.8mm;
  --qr:22mm
}
.landscape-layout{width:291mm;height:204mm;display:block}
.portrait-layout{width:204mm;height:291mm;display:none}
.fit{width:100%;transform-origin:top left}
.official-print-header{margin-bottom:2mm!important}
.document-head{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--qr);
  gap:2mm;
  align-items:center;
  min-height:20mm;
  border-bottom:1.4px solid #000;
  margin-bottom:.8mm
}
.titles{text-align:center}
.titles h1{font-size:13pt;margin:0}
.titles h2{font-size:10pt;margin:.6mm 0}
.titles h3{font-size:8.2pt;margin:0}.titles h3 .h3-ar{font-weight:700;direction:rtl}.titles h3 .h3-en{font-weight:600;margin-top:1pt}
.qr{width:var(--qr);height:var(--qr);justify-self:end;object-fit:contain}
.print-legend{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:3mm;
  margin:0 0 .8mm;
  padding:.45mm .8mm;
  border:1px solid #000;
  font-size:5.9pt;
  line-height:1.15;
  break-inside:avoid
}
.legend-item{display:flex;align-items:center;gap:1mm}
.legend-swatch{
  display:inline-block;
  width:4mm;
  height:3mm;
  background:#000!important;
  border:1px solid #000;
  flex:0 0 auto
}
.print-date{white-space:nowrap;font-weight:700}
table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:var(--fs)
}
thead{display:table-header-group}
tr{break-inside:avoid}
th,td{
  border:1px solid #000;
  padding:var(--py) .8mm;
  line-height:1.1;
  text-align:center;
  vertical-align:middle;
  overflow-wrap:anywhere
}
th{font-weight:900}
.medicine{text-align:center;font-weight:800}
.batch{text-align:center}
.ctl-batch-print-line{display:block;padding:.18mm 0;text-align:center}
.near-expiry-30 td{
  font-weight:700!important;
  background:#f0f0f0!important;
  background-color:#f0f0f0!important;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
.near-expiry-30 td:first-child{
  border-left:3px solid #000!important
}
.near-expiry-30 .ctl-batch-print-line{
  font-weight:900!important;
  text-decoration:underline
}
.signatures{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:5mm;
  margin-top:2.5mm
}
.signature{
  border-top:1px solid #000;
  text-align:center;
  padding-top:.8mm;
  min-height:8mm;
  font-size:6.2pt
}
.signature b,.signature span{display:block}
.electronic-certification{
  margin-top:1.6mm;
  padding-top:.9mm;
  border-top:.7px solid #777;
  text-align:center;
  font-size:5.7pt;
  line-height:1.35;
  font-weight:700;
  color:#000!important;
  -webkit-text-fill-color:#000!important;
  break-inside:avoid;
  page-break-inside:avoid;
  forced-color-adjust:none!important;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
.electronic-certification .cert-ar{
  display:block;
  direction:rtl;
  unicode-bidi:plaintext
}
.electronic-certification .cert-en{
  display:block;
  direction:ltr;
  unicode-bidi:plaintext
}
.footer{text-align:center;font-size:5.8pt;margin-top:.7mm}
.brand{text-align:right;font-size:5.5pt;color:#94a3b8;margin-top:.5mm}
.print-error{padding:15mm;text-align:center}
@media print and (orientation:landscape){
  .landscape-layout{display:block!important}
  .portrait-layout{display:none!important}
}
@media print and (orientation:portrait){
  .landscape-layout{display:none!important}
  .portrait-layout{display:block!important}
}
@media screen and (orientation:landscape){
  body{background:#d5d5d5!important}
  .landscape-layout{display:block!important;visibility:visible!important}
  .portrait-layout{display:none!important}
}
@media screen and (orientation:portrait){
  body{background:#d5d5d5!important}
  .landscape-layout{display:none!important}
  .portrait-layout{display:block!important;visibility:visible!important}
}`;

  var legend=
    '<div class="print-legend">'+
      '<div class="legend-item"><span class="legend-swatch"></span>'+
        '<span>Expiry within 30 days / قريب الانتهاء خلال 30 يومًا</span></div>'+
      '<div class="print-date">Print date / تاريخ الطباعة: '+
        fsEsc(printInfo.text)+'</div>'+
    '</div>';

  var content='<div class="fit">'+official+
    '<header class="document-head">'+
      '<div class="titles">'+
        '<h1>Controlled and Restricted Medicines List</h1>'+
        '<h2>قائمة الأدوية المخدرة والمقيدة</h2>'+
        '<h3>'+(function(){var ar=fsDeptNameAr(dept,name);return ar?'<div class="h3-ar">عهدة قسم '+fsEsc(ar)+'</div>':''})()+'<div class="h3-en">'+fsEsc(name)+' Department Controlled List</div></h3>'+
      '</div>'+
      '<img class="qr asd-qr-image" src="'+fsEsc(qr)+'" alt="Live controlled list QR">'+
    '</header>'+
    legend+
    '<table>'+
      '<colgroup>'+
        '<col style="width:3%"><col style="width:8%"><col style="width:8%">'+
        '<col style="width:32%"><col style="width:10%"><col style="width:6%">'+
        '<col style="width:6%"><col style="width:27%">'+
      '</colgroup>'+
      '<thead><tr>'+
        '<th>#</th><th>MOH</th><th>NUPCO</th><th>Medicine / الدواء</th>'+
        '<th>Class / التصنيف</th><th>Required / المطلوب</th>'+
        '<th>Actual / الفعلي</th><th>Qty · Expiry / الكمية والانتهاء</th>'+
      '</tr></thead>'+
      '<tbody>'+body+'</tbody>'+
    '</table>'+
    '<div class="signatures">'+signatures+'</div>'+
    '<div class="electronic-certification">'+
      '<span class="cert-ar">هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم</span>'+
      '<span class="cert-en">This list is electronically approved and certified and does not require a stamp.</span>'+
    '</div>'+
    '<div class="footer">Live list: '+fsEsc(url)+'</div>'+
    '<div class="brand">By Ali Abudahash</div>'+
  '</div>';

  var runtime=`(function(){
function imagesReady(){
  return Promise.all(Array.from(document.images).map(function(image){
    var qr=image.classList.contains('asd-qr-image');
    if(qr&&/^data:image\/svg\+xml/i.test(image.getAttribute('src')||''))return Promise.reject(new Error('QR generator returned a placeholder'));
    if(image.complete)return image.naturalWidth>0?Promise.resolve():(qr?Promise.reject(new Error('QR image failed to decode')):Promise.resolve());
    return new Promise(function(resolve,reject){
      image.onload=resolve;
      image.onerror=function(){qr?reject(new Error('QR image failed to load')):resolve()};
      setTimeout(function(){qr?reject(new Error('QR image load timed out')):resolve()},5000);
    });
  }));
}
function showQrFailure(error){
  document.body.dataset.qrPrint='failed';
  document.querySelectorAll('img.asd-qr-image').forEach(function(image){if(/^data:image\/svg\+xml/i.test(image.getAttribute('src')||''))image.style.display='none'});
  var box=document.createElement('div');box.className='print-error';box.innerHTML='<h2>QR generation failed / تعذر إنشاء رمز QR</h2><p>Automatic printing stopped because the QR would not be scannable.<br>تم إيقاف الطباعة التلقائية لأن الرمز لن يكون قابلاً للمسح.</p><button type="button">Print without QR / طباعة بدون QR</button>';box.querySelector('button').onclick=function(){window.focus();window.print()};document.body.insertBefore(box,document.body.firstChild);console.error(error);
}
function over(layout,fit){
  return fit.scrollHeight>layout.clientHeight+1||
    fit.scrollWidth>layout.clientWidth+1;
}
function fitOne(layout){
  var fit=layout.querySelector('.fit');
  var orientation=layout.dataset.orientation;
  var font=orientation==='landscape'?7.6:6.7;
  var padding=orientation==='landscape'?.8:.5;
  var qr=orientation==='landscape'?22:17;
  var fontMax=orientation==='landscape'?15:13;
  var guard=0;

  layout.style.display='block';
  layout.style.visibility='hidden';
  fit.style.transform='none';
  layout.style.setProperty('--fs',font+'pt');
  layout.style.setProperty('--py',padding+'mm');
  layout.style.setProperty('--qr',qr+'mm');
  void fit.offsetHeight;

  while(over(layout,fit)&&guard<100){
    if(font>(orientation==='landscape'?5:4.6)){
      font=Math.max(orientation==='landscape'?5:4.6,font-.18);
      layout.style.setProperty('--fs',font+'pt');
    }else if(padding>.16){
      padding=Math.max(.16,padding-.05);
      layout.style.setProperty('--py',padding+'mm');
    }else if(qr>(orientation==='landscape'?13:10)){
      qr--;
      layout.style.setProperty('--qr',qr+'mm');
    }else{
      break;
    }
    void fit.offsetHeight;
    guard++;
  }

  // Short custody lists (few medicines) used to stay at the small base font even
  // though most of the A4 sheet was empty underneath — the layout only ever
  // shrank to fit, never grew to fill real headroom. Grow the font (and QR/
  // padding to match) step by step while there's still room, so a short list
  // reads clearly at a glance instead of looking unfinished in a corner.
  guard=0;
  while(!over(layout,fit)&&font<fontMax&&guard<100){
    var nextFont=Math.min(fontMax,font+.2);
    layout.style.setProperty('--fs',nextFont+'pt');
    void fit.offsetHeight;
    if(over(layout,fit)){
      layout.style.setProperty('--fs',font+'pt');
      void fit.offsetHeight;
      break;
    }
    font=nextFont;
    guard++;
  }
  guard=0;
  var qrMax=orientation==='landscape'?30:24;
  while(!over(layout,fit)&&qr<qrMax&&guard<60){
    qr++;
    layout.style.setProperty('--qr',qr+'mm');
    void fit.offsetHeight;
    if(over(layout,fit)){
      qr--;
      layout.style.setProperty('--qr',qr+'mm');
      void fit.offsetHeight;
      break;
    }
    guard++;
  }

  var widthRatio=(layout.clientWidth-2)/Math.max(1,fit.scrollWidth);
  var heightRatio=(layout.clientHeight-2)/Math.max(1,fit.scrollHeight);
  var scale=Math.min(widthRatio,heightRatio,1.06);
  if(!isFinite(scale)||scale<=0)scale=1;
  fit.style.transform='scale('+scale+')';

  var expected=Number(layout.dataset.expected||0);
  var actual=layout.querySelectorAll('.custody-row').length;
  if(expected===0||actual!==expected){
    layout.innerHTML='<div class="print-error"><h2>Controlled list integrity check failed</h2>'+
      '<p>Expected '+expected+' rows; rendered '+actual+'.</p></div>';
    layout.dataset.failed='1';
  }else{
    layout.dataset.ready='1';
    layout.dataset.scale=String(scale);
    layout.dataset.font=String(font);
  }

  layout.style.removeProperty('display');
  layout.style.removeProperty('visibility');
}
function fitAll(){
  var layouts=Array.from(document.querySelectorAll('.controlled-layout'));
  layouts.forEach(fitOne);
  if(layouts.some(function(layout){return layout.dataset.failed==='1'})){
    document.body.dataset.failed='1';
    return;
  }
  document.body.dataset.ready='1';
}
function start(){
  imagesReady().then(function(){
    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(function(){
        fitAll();
        if(document.body.dataset.ready==='1'){
          setTimeout(function(){window.focus();window.print()},180);
        }
      },function(){
        fitAll();
        if(document.body.dataset.ready==='1'){
          setTimeout(function(){window.focus();window.print()},180);
        }
      });
    }else{
      fitAll();
      if(document.body.dataset.ready==='1'){
        setTimeout(function(){window.focus();window.print()},180);
      }
    }
  }).catch(showQrFailure);
}
window.addEventListener('load',start,{once:true});
})();`;

  function layoutHtml(orientation){
    var label=orientation==='landscape'?'landscape-layout':'portrait-layout';
    return '<section class="controlled-layout '+label+
      '" data-orientation="'+orientation+
      '" data-expected="'+rows.length+'">'+content+'</section>';
  }

  return '<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+fsEsc(name)+' Department Controlled List</title>'+
    '<style>'+css+'</style></head><body>'+
    '<main class="sheet">'+layoutHtml('landscape')+layoutHtml('portrait')+'</main>'+
    '<script>'+runtime+'<\/script></body></html>';
}
function openBlobPrintR5(html){
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var w=window.open(url,'_blank');
  setTimeout(function(){URL.revokeObjectURL(url);},60000);
  return !!w;
}
window.printDepartmentCustodyExact=async function(dept,options){
  options=options||{};
  dept=fsText(dept||fsR5ControlledDept(),'');
  if(options.printWindow){try{options.printWindow.close();}catch(e){}}
  try{
    var result=await fsLoginTimeout(fsR5ControlledRows(dept),18000,'Controlled custody print data timed out.');
    if(!result.rows||!result.rows.length){
      uiToast('My controlled list is empty / قائمة عهدتي فارغة','err');
      return false;
    }
    openBlobPrintR5(fsR5ControlledPrintHtml(result.dept||dept,result.rows));
    setTimeout(function(){
      try{
        if(typeof window.ctlPublishDept==='function')Promise.resolve(window.ctlPublishDept(result.dept||dept)).catch(function(error){console.warn('Background controlled public publish skipped.',error);});
      }catch(error){}
    },0);
    return true;
  }catch(error){
    console.error('Controlled list print failed',error);
    uiToast('Unable to prepare My controlled list: '+String(error&&error.message||error),'err');
    return false;
  }
};
window.ctlConfirmDepartmentPrint=async function(event){
  if(event&&typeof event.preventDefault==='function')event.preventDefault();
  var dept=fsR5ControlledDept();
  if(!dept)return uiToast('Department is not assigned / لم يتم تحديد القسم','err');
  return window.printDepartmentCustodyExact(dept,{});
};
window.printControlledCurrent=function(){return window.ctlConfirmDepartmentPrint()};
window.finalControlledPrintRun=function(){return window.ctlConfirmDepartmentPrint()};
window.ctlOpenDepartmentPrintOptions=function(){return window.ctlConfirmDepartmentPrint()};

/* ASDHealth FloorStock — R6 crash-cart, master test mode, and master-only health.
   Direct global definitions; no prior-function wrapping. */




const __asdhLegacyApi = {
  fsR5ControlledDept: fsR5ControlledDept,
  fsR5ControlledMedicine: fsR5ControlledMedicine,
  fsR5NormalizeControlled: fsR5NormalizeControlled,
  fsR5ControlledRows: fsR5ControlledRows,
  fsR5PublicUrl: fsR5PublicUrl,
  fsR5Logo: fsR5Logo,
  fsR5PrintSettings: fsR5PrintSettings,
  fsR5ControlledPrintHtml: fsR5ControlledPrintHtml,
};
publishLegacy("51-asdhealth-canonical-r6-32-20260727.js", __asdhLegacyApi);
export {
  fsR5ControlledDept,
  fsR5ControlledMedicine,
  fsR5NormalizeControlled,
  fsR5ControlledRows,
  fsR5PublicUrl,
  fsR5Logo,
  fsR5PrintSettings,
  fsR5ControlledPrintHtml
};
export const legacyVariableNames = Object.freeze(["FS_R5_DEPT_FALLBACKS", "FS_R5_DEPT_ALIASES", "FS_R6_CRASH_SELECTED", "FS_R6_CRASH_WORKFLOW", "FS_R6_CRASH_FILTER", "FS_R6_ORDER_NAMES"]);
export default __asdhLegacyApi;

// --- Merged from 32-aa-final-controlled-stability-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function escA(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function numA(v){v=Number(v);return isFinite(v)?v:0}
function roleA(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function canManageA(){try{return !!(window.CU&&(CU.master===true||['pharmacy','controlled_pharmacy'].indexOf(roleA())>=0)||(typeof isMasterActual==='function'&&isMasterActual()))}catch(e){return false}}
function rulesA(){var s=(typeof ctlSettingsGlobal==='function'?ctlSettingsGlobal():{})||{};return {soon:Math.max(1,numA(s.expirySoonDays||60)),near:Math.max(0,numA(s.expiryUrgentDays||30)),critical:Math.max(0,numA(s.expiryCriticalDays||7))}}

function ensureModalA(){if(E('aa-final-expiry-rules-modal'))return;document.body.insertAdjacentHTML('beforeend',
 '<div class="modal-bg" id="aa-final-expiry-rules-modal"><div class="modal" style="width:680px"><div class="mh"><span class="mt">Expiry tracking rules / قواعد تتبع انتهاء الصلاحية</span><button class="xbtn" onclick="CM(\'aa-final-expiry-rules-modal\')">✕</button></div><div class="aa-final-settings-grid"><div><label>Early warning days / التنبيه المبكر</label><input type="number" min="1" id="aa-final-rule-soon"></div><div><label>Near-expiry days / قريب الانتهاء</label><input type="number" min="0" id="aa-final-rule-near"></div><div><label>Critical days / الحالة الحرجة</label><input type="number" min="0" id="aa-final-rule-critical"></div></div><div class="alert-banner-y">Required order: Critical ≤ Near expiry ≤ Early warning.</div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" onclick="CM(\'aa-final-expiry-rules-modal\')">Cancel</button><button class="btn bp" onclick="aaFinalSaveExpiryRules()">Save rules / حفظ القواعد</button></div></div></div>');}
window.aaFinalOpenExpiryRules=function(){if(!canManageA())return toast('No permission / لا توجد صلاحية','err');ensureModalA();var r=rulesA();E('aa-final-rule-soon').value=r.soon;E('aa-final-rule-near').value=r.near;E('aa-final-rule-critical').value=r.critical;OM('aa-final-expiry-rules-modal')};
window.aaFinalSaveExpiryRules=async function(){if(!canManageA())return;var soon=Math.max(1,numA(E('aa-final-rule-soon').value)),near=Math.max(0,numA(E('aa-final-rule-near').value)),critical=Math.max(0,numA(E('aa-final-rule-critical').value));if(!(critical<=near&&near<=soon))return toast('Critical ≤ Near expiry ≤ Early warning','err');var s=(typeof ctlSettingsGlobal==='function'?ctlSettingsGlobal():{})||{};s.expirySoonDays=soon;s.expiryUrgentDays=near;s.expiryCriticalDays=critical;s.expiryAlertDays=soon;await S.s('controlled_global_settings',s);await S.s('controlled_alert_days',soon);CM('aa-final-expiry-rules-modal');toast('Expiry tracking rules saved ✓','succ');if(typeof renderControlled==='function')renderControlled()};
})();

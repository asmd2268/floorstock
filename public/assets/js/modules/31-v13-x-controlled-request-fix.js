(function(){
'use strict';
var E=window.fsE;
var escX=window.fsEsc;
function numX(v){var n=Number(v);return isFinite(n)?n:0}
function toastX(m,t){if(typeof window.toast==='function')toast(m,t||'info');else alert(m)}
function openX(id){var n=E(id);if(n)n.classList.add('on')}
function closeX(id){var n=E(id);if(n)n.classList.remove('on')}
function roleX(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function officerX(){return roleX()==='controlled_pharmacy'||!!(window.CU&&CU.master)}
function catalogX(){return typeof window.ctlCatalog==='function'?(ctlCatalog()||[]):[]}
function medX(id){return typeof window.ctlMedicine==='function'?ctlMedicine(id):catalogX().find(function(m){return String(m.id)===String(id)})}
function phX(){return typeof window.ctlPharmacy==='function'?(ctlPharmacy()||{}):{}}
function listX(dept){return typeof window.ctlDeptList==='function'?(ctlDeptList(dept)||[]):[]}
function deptX(){return typeof window.ctlCurrentDept==='function'?ctlCurrentDept():((window.CU&&CU.deptId)||'')}
function addBatchRowX(host,b){b=b||{};var row=document.createElement('div');row.className='v13x-batch';row.innerHTML='<input type="number" min="0" step="1" class="v13x-bqty" value="'+escX(b.qty||0)+'" placeholder="Quantity"><input type="date" class="v13x-bdate" value="'+escX(b.expiry||'')+'"><input type="text" class="v13x-blot" value="'+escX(b.lot||'')+'" placeholder="Lot / Batch"><button type="button" class="btn bd2c bxs">×</button>';row.querySelector('button').onclick=function(){row.remove()};host.appendChild(row)}
function readBatchesX(host){return Array.from(host.querySelectorAll('.v13x-batch')).map(function(r){return {qty:numX(r.querySelector('.v13x-bqty').value),expiry:r.querySelector('.v13x-bdate').value,lot:r.querySelector('.v13x-blot').value.trim()}}).filter(function(b){return b.qty||b.expiry||b.lot})}
function ensureModalsX(){
 if(!E('v13x-med-modal')){var m=document.createElement('div');m.id='v13x-med-modal';m.className='modal-bg v13x-modal';m.innerHTML='<div class="modal"><div class="mh"><span class="mt">Edit controlled medicine / تعديل الدواء المقيد</span><button class="xbtn" onclick="v13XClose(\'v13x-med-modal\')">×</button></div><input type="hidden" id="v13x-med-id"><div class="v13x-grid"><div><label>Medicine name</label><input id="v13x-med-name"></div><div><label>Type</label><select id="v13x-med-class"><option value="narcotic">Narcotic</option><option value="psychotropic">Psychotropic</option></select></div><div><label>MOH code</label><input id="v13x-med-moh"></div><div><label>NUPCO code</label><input id="v13x-med-nupco"></div><div><label>Minimum quantity</label><input type="number" id="v13x-med-min"></div><div><label>Maximum quantity</label><input type="number" id="v13x-med-max"></div></div><div class="v13x-toolbar"><label><input type="checkbox" id="v13x-med-ha" style="width:auto;margin:0"> High Alert</label><label><input type="checkbox" id="v13x-med-lasa" style="width:auto;margin:0"> LASA</label><label><input type="checkbox" id="v13x-med-fridge" style="width:auto;margin:0"> Refrigerator</label><label><input type="checkbox" id="v13x-med-hazard" style="width:auto;margin:0"> Hazard</label></div><div style="margin-top:12px"><div class="fl jb ic"><b>Reference expiry dates / تواريخ الانتهاء المرجعية</b><button type="button" class="btn bg bsm" onclick="v13XAddBatch(\'v13x-med-batches\')">+ Add expiry</button></div><div id="v13x-med-batches" class="v13x-batches" style="margin-top:8px"></div></div><div class="fl g8" style="justify-content:flex-end;margin-top:16px"><button class="btn bg" onclick="v13XClose(\'v13x-med-modal\')">Cancel</button><button class="btn bs" onclick="v13XSaveCatalogMed()">Save</button></div></div>';document.body.appendChild(m)}
 if(!E('v13x-stock-modal')){var s=document.createElement('div');s.id='v13x-stock-modal';s.className='modal-bg v13x-modal';s.innerHTML='<div class="modal"><div class="mh"><span class="mt" id="v13x-stock-title">Edit custody</span><button class="xbtn" onclick="v13XClose(\'v13x-stock-modal\')">×</button></div><input type="hidden" id="v13x-stock-id"><input type="hidden" id="v13x-stock-scope"><div class="v13x-qty"><div><label id="v13x-stock-qty-label">Actual quantity</label><input type="number" id="v13x-stock-qty" min="0"></div><div id="v13x-required-wrap"><label>Required quantity / الكمية المفروض توفرها</label><input type="number" id="v13x-stock-required" min="0"></div></div><div class="fl jb ic"><b>Expiry date → quantity / تاريخ الانتهاء ← الكمية</b><button type="button" class="btn bg bsm" onclick="v13XAddBatch(\'v13x-stock-batches\')">+ Add expiry</button></div><div id="v13x-stock-batches" class="v13x-batches" style="margin-top:8px"></div><div class="fl g8" style="justify-content:flex-end;margin-top:16px"><button class="btn bg" onclick="v13XClose(\'v13x-stock-modal\')">Cancel</button><button class="btn bs" onclick="v13XSaveStock()">Save custody</button></div></div>';document.body.appendChild(s)}

 document.addEventListener('keydown',function(e){if(e.key==='Escape'){['v13x-med-modal','v13x-stock-modal'].forEach(closeX)}})
}
window.v13XClose=function(id){closeX(id)};window.v13XAddBatch=function(id){addBatchRowX(E(id),{})};
window.ctlEditCatalogMedicine=function(id){ensureModalsX();var m=medX(id);if(!m)return;E('v13x-med-id').value=id;E('v13x-med-name').value=m.name||'';E('v13x-med-class').value=m.classification||'narcotic';E('v13x-med-moh').value=m.moh||'';E('v13x-med-nupco').value=m.nupco||'';E('v13x-med-min').value=numX(m.min);E('v13x-med-max').value=numX(m.max);E('v13x-med-ha').checked=!!(m.highAlert||m.high_alert);E('v13x-med-lasa').checked=!!m.lasa;E('v13x-med-fridge').checked=!!(m.refrigerated||m.fridge);E('v13x-med-hazard').checked=!!(m.hazard||m.hazardous);var h=E('v13x-med-batches');h.innerHTML='';(m.referenceBatches||m.batches||[]).forEach(function(b){addBatchRowX(h,b)});if(!h.children.length)addBatchRowX(h,{});openX('v13x-med-modal')};
window.v13XSaveCatalogMed=async function(){
  var id=E('v13x-med-id').value,a=catalogX().map(function(m){return Object.assign({},m)}),i=a.findIndex(function(x){return String(x.id)===String(id)});if(i<0)return;
  var old=a[i];a[i]=Object.assign({},old,{name:E('v13x-med-name').value.trim(),classification:E('v13x-med-class').value,moh:E('v13x-med-moh').value.trim(),nupco:E('v13x-med-nupco').value.trim(),min:numX(E('v13x-med-min').value),max:numX(E('v13x-med-max').value),highAlert:E('v13x-med-ha').checked,high_alert:E('v13x-med-ha').checked,lasa:E('v13x-med-lasa').checked,refrigerated:E('v13x-med-fridge').checked,hazard:E('v13x-med-hazard').checked,referenceBatches:readBatchesX(E('v13x-med-batches'))});
  try{if(typeof window.ctlSetCatalog==='function')await ctlSetCatalog(a)}catch(e){console.error('Controlled medicine edit failed',e);return toastX('Medicine was not saved.','err')}
  closeX('v13x-med-modal');toastX('Medicine saved ✓','succ');if(typeof window.renderControlled==='function')renderControlled();return true
};
function openStockX(id,scope){ensureModalsX();var m=medX(id)||{},data={},title='';if(scope==='pharmacy'){data=phX()[id]||{};title='Pharmacy custody — '+(m.name||'');E('v13x-required-wrap').style.display='none'}else{var dept=deptX(),x=listX(dept).find(function(y){return String(y.medId)===String(id)})||{};data=x;title='Department controlled list — '+(m.name||'');E('v13x-required-wrap').style.display='block'}E('v13x-stock-id').value=id;E('v13x-stock-scope').value=scope;E('v13x-stock-title').textContent=title;E('v13x-stock-qty').value=numX(data.actualQty!=null?data.actualQty:data.qty);E('v13x-stock-required').value=numX(data.requiredQty!=null?data.requiredQty:(data.max!=null?data.max:m.max));var h=E('v13x-stock-batches');h.innerHTML='';(data.batches||[]).forEach(function(b){addBatchRowX(h,b)});if(!h.children.length)addBatchRowX(h,{});openX('v13x-stock-modal')}
window.openControlledDepartmentStockEditor=function(id){openStockX(id,'department');return true};
window.ctlEditPharmacyStock=function(id){if(!officerX())return toastX('No permission','err');openStockX(id,'pharmacy');if(typeof window.markControlledStockOptional==='function')window.markControlledStockOptional()};

function resolveDeptX(){var id=(window.CU&&CU.deptId)||(window.MASTER_EFFECTIVE&&MASTER_EFFECTIVE.deptId)||'';var ds=typeof window.gd==='function'?(gd()||[]):[];return ds.find(function(d){return String(d.id)===String(id)})||null}
window.renderReqForm=function(){function after(){if(typeof window.refreshRequestIdleTimer==='function')window.refreshRequestIdleTimer();if(typeof window.refreshRequestCountLimitWarning==='function')window.refreshRequestCountLimitWarning();if(typeof window.cleanRequestFormUi==='function')window.cleanRequestFormUi();if(typeof window.refreshRequestScheduleMessage==='function')window.refreshRequestScheduleMessage()}var root=E('rfbody'),sub=E('dnsub');if(!root){after();return}var d=resolveDeptX();if(!d){root.innerHTML='<div class="alert-banner">No department is linked to this account. Assign a department in User Management.</div>';after();return}if(window.CU){CU.deptId=d.id;CU.deptName=d.name||''}if(sub)sub.textContent=(d.name||'Department')+' — Enter quantities needed';var meds=typeof window.getMeds==='function'?(getMeds(d.id)||[]):[];var q=((E('rsrch')||{}).value||'').toLowerCase().trim();meds=meds.filter(function(m){return m&&m.id&&m.name&&(!q||String(m.name).toLowerCase().indexOf(q)>=0)});if(!meds.length){root.innerHTML='<div class="v13x-empty">No medicines are assigned to this department.</div>';if(E('rcnt'))E('rcnt').textContent='0';after();return}var groups={};meds.forEach(function(m){var c=m.category||'Uncategorized';(groups[c]||(groups[c]=[])).push(m)});var cats=Object.keys(groups);var cfg=typeof getPharmacyCategoryConfig==='function'?getPharmacyCategoryConfig(d.id):{order:[]};var order=cfg.order||[];cats.sort(function(a,b){var ai=order.indexOf(a),bi=order.indexOf(b);if(ai<0)ai=999;if(bi<0)bi=999;return ai-bi||String(a).localeCompare(String(b))});root.innerHTML=cats.map(function(c){var items=groups[c]||[];items.sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base',numeric:true})});return '<div class="cath">'+escX(c)+'</div><div class="tw"><table><thead><tr><th>#</th><th>Medication</th><th>Classification</th><th>Min</th><th>Max</th><th>Qty</th></tr></thead><tbody>'+items.map(function(m,i){var max=Math.max(0,numX(m.max));return '<tr class="'+(typeof window.rowCls==='function'?rowCls(m):'')+'"><td>'+(i+1)+'</td><td><b>'+escX(m.name)+'</b></td><td>'+(typeof window.bdg==='function'?bdg(m):'')+'</td><td>'+numX(m.min)+'</td><td>'+max+'</td><td><div class="qwrap"><input type="number" class="rqi" data-mid="'+escX(m.id)+'" data-max="'+max+'" min="0" max="'+max+'" placeholder="0" oninput="valQ(this)"><span class="qlim">/'+max+'</span></div></td></tr>'}).join('')+'</tbody></table></div>'}).join('');if(typeof window.cntItems==='function')cntItems();after()};

})();

// --- Merged from 13-pilot-controlled-public-expiry-fixes.js (Phase 6 consolidation) ---
(function(){
  function byId(id){return document.getElementById(id)}
  function isMasterUser(){return !!(window.CU&&CU.master===true)}

  function syncOfficialHeaderButton(){
    var b=byId('print-branding-btn');
    if(!b)return;
    b.style.display=isMasterUser()?'inline-flex':'none';
    b.textContent='⚙ Official Print Header';
    b.title='Master only: logo and four official print-header lines';
  }

  window.masterDeleteRequestNow=async function(id){
    if(!isMasterUser())return toast('Master permission required','err');
    var all=gr(),r=all.find(function(x){return x.id===id});
    if(!r)return;
    var dept=(gd().find(function(d){return d.id===r.deptId})||{}).name||r.deptId||'';
    if(!await uiConfirm('Delete this request now?\n\nDepartment: '+dept+'\nDate: '+fmtDate(r.created||r.fulfilledAt)+'\n\nFulfilled quantities will remain in Analytics.'))return;
    if(r.status!=='pending'){
      var archive=(S.g('request_analytics_archive')||[]).slice();
      if(!archive.some(function(x){return x.id===r.id}))archive.push(requestArchiveRecord(r));
      await S.s('request_analytics_archive',archive);
    }
    await S.s('requests',all.filter(function(x){return x.id!==id}));
    toast('Request deleted; analytics preserved ✓','succ');
    if(typeof renderReqs==='function')renderReqs();
    if(typeof renderPrint==='function')renderPrint();
    if(typeof renderDash==='function')renderDash();
  };

  window.syncOfficialHeaderButton=syncOfficialHeaderButton;
})();

// --- Merged from 29-v13-classification-tools.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function escV(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function canManage(){return window.fsCanManage?window.fsCanManage():false}

function extendBulkReplacement(){var modal=E('mbulk-replacement');if(!modal||E('v13q-br-class-only'))return;var preview=E('br-preview');if(!preview)return;var box=document.createElement('div');box.className='card';box.style.marginBottom='12px';box.innerHTML='<div class="cb" style="padding:12px"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="v13q-br-class-only" style="width:auto;margin:0"> Classifications only — keep medication names</label><div class="v13q-flags"><label><input type="checkbox" class="v13q-br-flag" value="high_alert"> High Alert</label><label><input type="checkbox" class="v13q-br-flag" value="lasa"> LASA</label><label><input type="checkbox" class="v13q-br-flag" value="refrigerated"> Refrigerator</label><label><input type="checkbox" class="v13q-br-flag" value="hazard"> Hazard</label></div><button type="button" class="btn bp bsm" onclick="v13BulkReplacementClassOnly()">Apply classifications only</button></div>';preview.parentNode.insertBefore(box,preview)}
window.extendBulkReplacementUi=extendBulkReplacement;
window.v13BulkReplacementClassOnly=async function(){var old=(E('br-old')||{}).value;if(!old)return toast('Choose a medication first.','err');var chosen=Array.from(document.querySelectorAll('.v13q-br-flag:checked')).map(function(x){return x.value});if(!chosen.length)return toast('Select at least one classification.','err');var count=0;for(var d of (gd()||[])){var meds=(getMeds(d.id)||[]).slice(),changed=false;meds=meds.map(function(m){var k=String(m.name||'').trim().toLowerCase()+'|'+String(m.strength||m.dose||'').trim().toLowerCase();if(k!==old)return m;var n=Object.assign({},m);['high_alert','lasa','refrigerated','hazard'].forEach(function(f){n[f]=chosen.indexOf(f)>-1});changed=true;count++;return n});if(changed)await setMeds(d.id,meds)}CM('mbulk-replacement');toast(count+' medication record(s) reclassified; names unchanged.','succ');if(typeof renderInv==='function')renderInv()};

function extendControlledBulk(){var modal=E('v13-final-bulk-modal');if(!modal||E('v13q-ctl-class-op'))return;var scope=E('v13-final-bulk-scope');if(!scope)return;var box=document.createElement('div');box.className='card';box.style.marginTop='10px';box.innerHTML='<div class="cb" style="padding:12px"><label>Classification operation</label><select id="v13q-ctl-class-op"><option value="keep">Keep classification</option><option value="replace">Replace classification</option></select><select id="v13q-ctl-class-value"><option value="narcotic">Narcotic</option><option value="psychotropic">Psychotropic</option></select><button type="button" class="btn bg bsm" onclick="v13ApplyControlledClassification()">Apply classification to selected medication</button></div>';scope.parentNode.insertBefore(box,scope)}
window.extendControlledBulkUi=extendControlledBulk;
window.v13ApplyControlledClassification=async function(){
  var med=(E('v13-final-bulk-med')||{}).value,op=(E('v13q-ctl-class-op')||{}).value,val=(E('v13q-ctl-class-value')||{}).value;
  if(!med)return toast('Select a medication.','err');if(op==='keep')return toast('Choose Replace classification first.','info');
  var cat=(ctlCatalog()||[]).map(function(m){return String(m.id)===String(med)?Object.assign({},m,{classification:val}):m});
  try{await ctlSetCatalog(cat)}catch(e){console.error('Controlled classification save failed',e);return toast('Classification was not saved.','err')}
  toast('Controlled medication classification updated.','succ');if(typeof renderControlled==='function')renderControlled();return true
};
})();

// --- Merged from 33-v13-ap-custodian-bulk-replacement-fix.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function isOfficer(){return !!(window.CU&&CU.role==='controlled_pharmacy')}
function addBulkReplacement(){
  var old=E('v13-ap-bulk-replacement-btn');
  if(!isOfficer()||String(window.CTL_VIEW||'')!=='departments'){
    if(old)old.remove();
    return;
  }
  var table=E('ctl-dept-table');
  var card=table&&table.closest('.card');
  if(!card)return;
  var header=card.querySelector('.ch .fl')||card.querySelector('.ch');
  if(!header)return;
  if(!old){
    old=document.createElement('button');
    old.id='v13-ap-bulk-replacement-btn';
    old.type='button';
    old.className='btn bg bsm';
    old.innerHTML='⇄ Bulk Replacement';
    old.onclick=function(){
      if(typeof window.openBulkReplacement==='function')return window.openBulkReplacement();
      if(typeof window.toast==='function')toast('Bulk Replacement is unavailable.','err');
    };
    header.appendChild(old);
  }
}
window.ensureControlledBulkReplacementButton=addBulkReplacement;
})();


// --- Merged from 27-announcements-selection-persist-fix.js (Phase 6 consolidation) ---
(function(){
  var INV_KEY='asd_inv_selected_by_department_v2';
  var IMP_KEY='asd_import_draft_v2';
  function q(id){return document.getElementById(id)}
  function readJSON(k,f){try{var v=JSON.parse(sessionStorage.getItem(k)||'null');return v==null?f:v}catch(e){return f}}
  function writeJSON(k,v){try{sessionStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function moveAnnouncementHostToTop(){
    var host=q('dept-announcement-host'),app=q('app');if(!host||!app)return;
    var nav=q('mnav');
    if(nav&&host.nextSibling!==nav)app.insertBefore(host,nav);
    else if(!nav&&app.firstChild!==host)app.insertBefore(host,app.firstChild);
  }
  /* Inventory selection is kept per department and survives page changes. */
  function invDept(){var s=q('inv-dept-sel');return s&&s.value||''}
  function invState(){return readJSON(INV_KEY,{})}
  function captureInventorySelection(){
    var d=invDept();if(!d)return;var st=invState(),ids=[];
    document.querySelectorAll('.inv-chk:checked').forEach(function(c){if(c.dataset.id)ids.push(c.dataset.id)});
    st[d]=ids;writeJSON(INV_KEY,st);
  }
  function restoreInventorySelection(){
    var d=invDept();if(!d)return;var ids=(invState()[d]||[]),set={};ids.forEach(function(x){set[x]=1});
    document.querySelectorAll('.inv-chk').forEach(function(c){c.checked=!!set[c.dataset.id]});
    if(typeof window.onInvCheck==='function')window.onInvCheck();
  }
  window.captureInventorySelection=captureInventorySelection;
  window.restoreInventorySelection=restoreInventorySelection;
  window.clearInventorySelectionState=function(){var d=invDept(),st=invState();if(d){st[d]=[];writeJSON(INV_KEY,st)}};
/* Import draft and row selections survive switching to another page. */
  function saveImportDraft(){
    if(!Array.isArray(window.IROWS)||!window.IROWS.length)return;
    var d={rows:window.IROWS,dept:(q('imp-dept')||{}).value||'',text:(q('imp-txt')||{}).value||'',cat:(q('imp-cat')||{}).value||'auto'};
    writeJSON(IMP_KEY,d);
  }
  function restoreImportDraft(){
    var d=readJSON(IMP_KEY,null);if(!d||!Array.isArray(d.rows)||!d.rows.length)return false;
    window.IROWS=d.rows;
    var ds=q('imp-dept');if(ds&&d.dept)ds.value=d.dept;
    var ta=q('imp-txt');if(ta&&d.text!=null)ta.value=d.text;
    var cs=q('imp-cat');if(cs&&d.cat)cs.value=d.cat;
    if(typeof window.renderImportPreview==='function')window.renderImportPreview(false,-1,0,'<div class="alert-banner-y" style="margin-bottom:12px">تم استعادة مسودة الاستيراد والتحديدات المحفوظة / Import draft and selections restored.</div>');
    return true;
  }
  window.saveImportDraft=saveImportDraft;
  window.restoreImportDraft=restoreImportDraft;

  window.clearImportDraftState=function(){try{sessionStorage.removeItem(IMP_KEY)}catch(e){}window.IROWS=[]};

  window.persistTransientUiState=function(){captureInventorySelection();saveImportDraft()};
  window.restorePageTransientUi=function(id){moveAnnouncementHostToTop();if(id==='pg-import')restoreImportDraft()};

})();

// --- Merged from 25-pharmacy-announcements-feature.js (Phase 6 consolidation) ---
(function(){
  var ANN_KEY='pharmacy_department_announcements',ANN_EDIT_ID=null;
  const E=globalThis.E;
  function escA(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function canManage(){return (window.fsCanManage?window.fsCanManage():false)||(window.fsEffectiveRole&&window.fsEffectiveRole()==='outpatient_pharmacy_supervisor'&&window.CU&&window.CU.deptId)}
  function announcements(){var a=S.g(ANN_KEY);return Array.isArray(a)?a:[]}
  function nowMs(){return Date.now()}
  function parseMs(v){var x=Date.parse(v||'');return isNaN(x)?0:x}
  function active(a){var n=nowMs(),st=parseMs(a.startAt),en=parseMs(a.endAt);return a.enabled!==false&&(!st||n>=st)&&(!en||n<=en)}
  function targetsUser(a){if(!window.CU||CU.role!=='department')return false;if(a.allDepartments===true)return true;return Array.isArray(a.departmentIds)&&a.departmentIds.indexOf(CU.deptId)>-1}
  function localValue(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';var p=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}
  function isoFromLocal(v){if(!v)return new Date().toISOString();var d=new Date(v);return isNaN(d)?new Date().toISOString():d.toISOString()}
  function endFromDays(start,days){var d=new Date(start),n=Math.max(1,Number(days)||1);d.setTime(d.getTime()+n*86400000);return d.toISOString()}
  function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
  function ensureHost(){var app=E('app');if(!app)return null;var host=E('dept-announcement-host');if(!host){host=document.createElement('div');host.id='dept-announcement-host';var nav=E('mnav');if(nav&&nav.parentNode)nav.parentNode.insertBefore(host,nav.nextSibling);else app.insertBefore(host,app.firstChild)}return host}
  window.renderDepartmentAnnouncements=function(){var host=ensureHost();if(!host)return;if(!window.CU||CU.role!=='department'){host.innerHTML='';host.style.display='none';return}var list=announcements().filter(function(a){return active(a)&&targetsUser(a)}).sort(function(a,b){return parseMs(b.createdAt)-parseMs(a.createdAt)});host.style.display=list.length?'block':'none';host.innerHTML=list.map(function(a){var until=a.endAt?new Date(a.endAt).toLocaleString('ar-SA'):'';return '<div class="dept-announcement '+(a.level==='urgent'?'urgent':'')+'"><div class="ann-head"><div class="ann-title">'+(a.level==='urgent'?'⚠️ تنبيه عاجل / Urgent alert':'📢 إعلان / Announcement')+'</div><div class="ann-until">حتى / Until: '+escA(until)+'</div></div>'+(a.arabic?'<div class="ann-ar">'+escA(a.arabic)+'</div>':'')+(a.english?'<div class="ann-en">'+escA(a.english)+'</div>':'')+'</div>'}).join('')};
  function ensurePage(){if(E('pg-announcements'))return;var p=document.createElement('div');p.className='pg';p.id='pg-announcements';p.innerHTML='<div class="fl ic jb mb14" style="flex-wrap:wrap;gap:10px"><div><div class="stitle">Announcements / الإعلانات والتنبيهات</div><div class="ssub" style="margin:0">إعلانات مؤقتة لكل الأقسام أو أقسام محددة، بالعربي والإنجليزي.</div></div><button class="btn bp" onclick="openAnnouncementEditor()">+ New announcement / إعلان جديد</button></div><div id="announcements-list"></div>';var app=E('app');if(app)app.appendChild(p)}
  window.renderAnnouncements=function(){ensurePage();var box=E('announcements-list');if(!box)return;var list=announcements().slice().sort(function(a,b){return parseMs(b.createdAt)-parseMs(a.createdAt)});if(!list.length){box.innerHTML='<div class="card"><div class="cb" style="text-align:center;color:var(--tx2)">لا توجد إعلانات حاليًا / No announcements yet</div></div>';return}box.innerHTML=list.map(function(a){var isOn=active(a),targets=a.allDepartments?'All departments / جميع الأقسام':(a.departmentIds||[]).map(deptName).join('، ');return '<div class="ann-card '+(isOn?'':'inactive')+'"><div class="ann-card-head"><div><div class="ann-card-title">'+(a.level==='urgent'?'⚠️ Urgent':'📢 Announcement')+' · '+(isOn?'Active / فعال':'Inactive / غير فعال')+'</div><div class="ann-targets">'+escA(targets)+'</div></div><div class="fl g8"><button class="btn bg bsm" onclick="openAnnouncementEditor(\''+escA(a.id)+'\')">Edit</button><button class="btn bg bsm" onclick="toggleAnnouncement(\''+escA(a.id)+'\')">'+(a.enabled===false?'Enable':'Disable')+'</button><button class="btn bd2c bsm" onclick="deleteAnnouncement(\''+escA(a.id)+'\')">Delete</button></div></div>'+(a.arabic?'<div class="ann-ar" style="margin-top:8px">'+escA(a.arabic)+'</div>':'')+(a.english?'<div class="ann-en">'+escA(a.english)+'</div>':'')+'<div class="ann-targets">Start: '+escA(new Date(a.startAt).toLocaleString())+' · End: '+escA(new Date(a.endAt).toLocaleString())+'</div></div>'}).join('')};
  function selectedDeptIds(){var ids=[];document.querySelectorAll('#ann-dept-list input[type=checkbox]:checked').forEach(function(c){ids.push(c.value)});return ids}
  window.toggleAnnouncementDepartments=function(){var all=E('ann-all-depts').checked;document.querySelectorAll('#ann-dept-list input').forEach(function(c){c.disabled=all;if(all)c.checked=false})};
  window.openAnnouncementEditor=function(id){if(!canManage())return toast('Not authorized.','err');ANN_EDIT_ID=id||null;var a=id?announcements().find(function(x){return x.id===id}):null;var start=a&&a.startAt?a.startAt:new Date().toISOString(),days=a?Math.max(1,Math.ceil((parseMs(a.endAt)-parseMs(a.startAt))/86400000)):14;var selected=(a&&a.departmentIds)||[],all=!a||a.allDepartments===true;var html='<div class="modal-bg on" id="ann-editor"><div class="modal" style="width:760px"><div class="mh"><div><div class="mt">'+(a?'Edit announcement':'New announcement')+' / '+(a?'تعديل الإعلان':'إعلان جديد')+'</div><div class="fhint">يمكن كتابة العربي أو الإنجليزي أو كليهما.</div></div><button class="xbtn" onclick="document.getElementById(\'ann-editor\').remove()">×</button></div><div class="ann-form-grid"><div><label>Arabic / النص العربي</label><textarea id="ann-ar" rows="5" placeholder="اكتب الإعلان بالعربي...">'+escA(a&&a.arabic||'')+'</textarea></div><div><label>English text</label><textarea id="ann-en" rows="5" placeholder="Write the announcement in English...">'+escA(a&&a.english||'')+'</textarea></div><div><label>Type / النوع</label><select id="ann-level"><option value="info" '+(!a||a.level!=='urgent'?'selected':'')+'>Announcement / إعلان</option><option value="urgent" '+(a&&a.level==='urgent'?'selected':'')+'>Urgent alert / تنبيه عاجل</option></select><label>Start date & time / بداية الظهور</label><input type="datetime-local" id="ann-start" value="'+localValue(start)+'"></div><div><label>Duration in days / المدة بالأيام</label><input type="number" min="1" max="365" id="ann-days" value="'+days+'"><label style="display:flex;align-items:center;gap:7px;margin-top:8px"><input type="checkbox" id="ann-enabled" style="width:auto;margin:0" '+(!a||a.enabled!==false?'checked':'')+'> Active / فعال</label></div></div><label style="display:flex;align-items:center;gap:7px;margin-top:4px"><input type="checkbox" id="ann-all-depts" style="width:auto;margin:0" '+(all?'checked':'')+' onchange="toggleAnnouncementDepartments()"> All departments / جميع الأقسام</label><div class="ann-dept-box" id="ann-dept-list">'+(gd()||[]).map(function(d){return '<label class="ann-dept-option"><input type="checkbox" value="'+escA(d.id)+'" '+(selected.indexOf(d.id)>-1?'checked':'')+' '+(all?'disabled':'')+'><span>'+escA(d.name)+'</span></label>'}).join('')+'</div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bg" onclick="document.getElementById(\'ann-editor\').remove()">Cancel</button><button class="btn bp" onclick="saveAnnouncement()">Save announcement</button></div></div></div>';document.body.insertAdjacentHTML('beforeend',html)};
  window.saveAnnouncement=async function(){if(!canManage())return;var ar=E('ann-ar').value.trim(),en=E('ann-en').value.trim();if(!ar&&!en)return toast('Enter Arabic or English announcement text.','err');var outpatient=window.fsEffectiveRole&&window.fsEffectiveRole()==='outpatient_pharmacy_supervisor',all=outpatient?false:E('ann-all-depts').checked,ids=outpatient?[String(CU.deptId)]:selectedDeptIds();if(!all&&!ids.length)return toast('Choose at least one department.','err');var start=isoFromLocal(E('ann-start').value),days=Math.max(1,Number(E('ann-days').value)||14),list=announcements().slice(),old=ANN_EDIT_ID?list.find(function(x){return x.id===ANN_EDIT_ID}):null,rec={id:old?old.id:'ann_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),arabic:ar,english:en,level:E('ann-level').value,allDepartments:all,departmentIds:all?[]:ids,startAt:start,endAt:endFromDays(start,days),enabled:E('ann-enabled').checked,createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:old?old.createdBy:(CU.username||CU.email||'')};if(old)list=list.map(function(x){return x.id===old.id?rec:x});else list.push(rec);await S.s(ANN_KEY,list);if(typeof auditAction==='function')auditAction(old?'announcement_updated':'announcement_created',{id:rec.id,allDepartments:all,departmentIds:rec.departmentIds,endAt:rec.endAt});var m=E('ann-editor');if(m)m.remove();toast('Announcement saved.','succ');renderAnnouncements();renderDepartmentAnnouncements()};
  window.toggleAnnouncement=async function(id){if(!canManage())return;var list=announcements().map(function(a){return a.id===id?Object.assign({},a,{enabled:a.enabled===false,updatedAt:new Date().toISOString()}):a});await S.s(ANN_KEY,list);renderAnnouncements();renderDepartmentAnnouncements()};
  window.deleteAnnouncement=async function(id){if(!canManage())return;if(!(await uiConfirm('Delete this announcement permanently? / حذف الإعلان نهائيًا؟')))return;await S.s(ANN_KEY,announcements().filter(function(a){return a.id!==id}));if(typeof auditAction==='function')auditAction('announcement_deleted',{id:id});toast('Announcement deleted.','succ');renderAnnouncements();renderDepartmentAnnouncements()};
  window.refreshAnnouncementsUi=function(id){
    ensurePage();
    if(id==='pg-announcements')renderAnnouncements();
    renderDepartmentAnnouncements();
  };
})();

export {};

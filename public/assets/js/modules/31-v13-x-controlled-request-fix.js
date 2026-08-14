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

export {};

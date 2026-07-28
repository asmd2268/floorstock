(function(){
'use strict';
function E(id){return document.getElementById(id)}
function escC(v){return typeof window.esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function numC(v){v=Number(v);return isFinite(v)?v:0}
var ctlCleanFilterRoleC='';
function roleC(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function masterC(){try{return !!(window.CU&&CU.master===true&&!(window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true&&roleC()!=='pharmacy'))}catch(e){return false}}
function canCatalogC(){return masterC()||roleC()==='controlled_pharmacy'}
function canWarehouseC(){return masterC()||roleC()==='warehouse'}
function canPharmacyC(){return masterC()||roleC()==='pharmacy'||roleC()==='controlled_pharmacy'}
function canDispenseC(){return masterC()||roleC()==='pharmacy'||roleC()==='controlled_pharmacy'}
window.canControlledDispense=canDispenseC;
window.canControlledPharmacyStorage=function(){
  try{
    var user=window.CU||{};
    var permissions=user.permissions||{};
    return masterC()||
      String(user.role||'')==='controlled_pharmacy'||
      permissions.controlledStorage===true;
  }catch(error){
    console.error('Controlled storage permission check failed:',error);
    return false;
  }
};
function fmtBatchC(list){return (list||[]).length?(list||[]).map(function(b){return '<div><span class="chip">'+numC(b.qty)+'</span> '+escC(typeof ctlFmtDMY==='function'?ctlFmtDMY(b.expiry):(b.expiry||'—'))+(b.lot?' · '+escC(b.lot):'')+'</div>'}).join(''):'—'}
function classC(m){return String((m&&m.classification)||'narcotic')==='psychotropic'?'<span class="badge bpu">Psychotropic / نفسي</span>':'<span class="badge brd">Narcotic / مخدر</span>'}
function statusC(m,w,p){try{return typeof ctlStatus==='function'?ctlStatus(m,w,p):{key:'ok',html:'<span class="badge bgn">OK</span>'}}catch(e){return {key:'ok',html:'<span class="badge bgn">OK</span>'}}}
function normalizeViewC(v){var valid=['overview','storage','departments','pharmacy','warehouse','catalog'];return valid.indexOf(String(v||''))>=0?String(v):'overview'}

/* ── Inventory Hide / Freeze: one modal, reliable close, no orphan overlay. ── */
function invNorm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim()}
function invFamily(v){return invNorm(v).replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|l|iu|unit|units|%|mmol|meq)\b/gi,' ').replace(/\b(?:tab(?:let)?s?|caps?(?:ule)?s?|amp(?:oule)?s?|vials?|bottles?|bags?|syrups?|solution|solutions|injection|injections|cream|ointment|drops?|inhalers?|suppositor(?:y|ies))\b/gi,' ').replace(/\s+/g,' ').trim()}
function invIdentity(v){var stop={mg:1,mcg:1,g:1,gm:1,ml:1,l:1,iu:1,unit:1,units:1,percent:1,mmol:1,meq:1,tab:1,tabs:1,tablet:1,tablets:1,cap:1,caps:1,capsule:1,capsules:1,amp:1,amps:1,ampoule:1,ampoules:1,vial:1,vials:1,bottle:1,bottles:1,bag:1,bags:1,syrup:1,solution:1,solutions:1,soln:1,susp:1,suspension:1,inj:1,injection:1,injections:1,cream:1,ointment:1,drop:1,drops:1,inhaler:1,inhalers:1,suppository:1,suppositories:1,oral:1,iv:1,im:1,sc:1,intravenous:1,intramuscular:1,subcutaneous:1,infusion:1,premix:1,pack:1,packs:1,for:1,of:1,محلول:1,محاليل:1,حقن:1,حقنة:1,امبول:1,امبولات:1,فيال:1,فيالات:1,قرص:1,اقراص:1,كبسول:1,كبسولات:1,مل:1,مجم:1};return invNorm(v).split(/\s+/).filter(function(t){return t&&t.length>1&&!/^\d+$/.test(t)&&!/^\d+(?:mg|mcg|g|gm|ml|l|iu|units?|mmol|meq)$/i.test(t)&&!stop[t]}).join(' ').trim()}
function selectedInvMedsC(){var dep=(E('inv-dept-sel')||{}).value||'';var ids=Array.from(document.querySelectorAll('.inv-chk:checked')).map(function(x){return String(x.dataset.id)});return (typeof getMeds==='function'?(getMeds(dep)||[]):[]).filter(function(m){return ids.indexOf(String(m.id))>-1})}
function closeInvModalC(id){var n=E(id);if(n)n.remove();document.body.style.overflow='';document.documentElement.style.overflow='';document.body.style.pointerEvents='';}
function cleanupInvModalsC(){['v16-hide-modal','v16-freeze-modal'].forEach(closeInvModalC);document.querySelectorAll('.inventory-action-modal').forEach(function(n){n.remove()});document.body.style.overflow='';document.documentElement.style.overflow=''}
function deptOptionsC(prefix){var rows=(typeof gd==='function'?(gd()||[]):[]).map(function(d){return '<label><input class="'+prefix+'-dept" type="checkbox" value="'+escC(d.id)+'"> '+escC(d.name||d.id)+'</label>'}).join('');return '<label class="ops-scope-all"><input id="'+prefix+'-all" type="checkbox"> All departments / جميع الأقسام</label>'+rows}
function openInvModalC(type){cleanupInvModalsC();var meds=selectedInvMedsC();if(!meds.length)return toast('Select one or more medicines first.','err');var hide=type==='hide',id=hide?'v16-hide-modal':'v16-freeze-modal',prefix=hide?'v16-hide':'v16-freeze';var wrap=document.createElement('div');wrap.id=id;wrap.className='modal-bg on inventory-action-modal';wrap.innerHTML='<div class="modal"><div class="mh"><span class="mt">'+(hide?'Hide from New Request only / إخفاء من الطلب فقط':'Freeze requests / تجميد الطلب')+'</span><button type="button" class="xbtn" data-close>×</button></div>'+(hide?'<div class="alert-banner-y">Hidden medicines remain visible in Shelves, receiving, expiry entry and printing.</div>':'')+'<div class="fhint" style="margin-bottom:8px">Selected: '+meds.map(function(m){return escC(m.name)}).join('، ')+'</div><div class="ops-check-grid">'+deptOptionsC(prefix)+'</div><label>'+(hide?'Reason (optional) / السبب اختياري':'Reason shown to departments (optional) / السبب اختياري')+'</label><textarea id="'+prefix+'-reason" rows="2" placeholder="Optional"></textarea><div class="fl jb"><button type="button" class="btn bg" data-remove>'+(hide?'Remove hide':'Remove freeze')+'</button><div class="fl g8"><button type="button" class="btn bg" data-close>Cancel</button><button type="button" class="btn '+(hide?'bp':'bd2c')+'" data-save>Apply</button></div></div></div>';
 document.body.appendChild(wrap);document.body.style.overflow='hidden';
 var all=E(prefix+'-all');if(all)all.addEventListener('change',function(){wrap.querySelectorAll('.'+prefix+'-dept').forEach(function(x){x.checked=all.checked})});
 wrap.addEventListener('click',function(ev){if(ev.target===wrap||ev.target.closest('[data-close]'))closeInvModalC(id)});
 wrap.querySelector('[data-save]').addEventListener('click',function(){saveInvRuleC(type,false)});
 wrap.querySelector('[data-remove]').addEventListener('click',function(){saveInvRuleC(type,true)});
}
async function saveInvRuleC(type,remove){
  var meds=selectedInvMedsC();if(!meds.length)return toast('The selected medicines are no longer available.','err');
  var hide=type==='hide',prefix=hide?'v16-hide':'v16-freeze',key=hide?'medication_visibility_rules_v3':'medication_freeze_rules_v3',all=!!(E(prefix+'-all')&&E(prefix+'-all').checked),ids=Array.from(document.querySelectorAll('.'+prefix+'-dept:checked')).map(function(x){return String(x.value)});
  if(!remove&&!all&&!ids.length)return toast('Choose one or more departments.','err');
  if(typeof window.fsR17MigrateMedicationIdentity==='function')await window.fsR17MigrateMedicationIdentity();
  var map=Object.assign({},(window.S&&S.g?S.g(key):{})||{}),reason=((E(prefix+'-reason')||{}).value||'').trim(),targets=(all?(typeof gd==='function'?(gd()||[]):[]):(typeof gd==='function'?(gd()||[]):[]).filter(function(d){return ids.indexOf(String(d.id))>=0})),changed=0;
  meds.forEach(function(source){
    targets.forEach(function(dept){var target=typeof window.fsR17FindCorrespondingMedicine==='function'?window.fsR17FindCorrespondingMedicine(source,dept.id):null;if(!target)return;var k='med:'+target.id;if(remove){if(map[k]){delete map[k];changed++}}else{map[k]={medId:target.id,name:target.name,allDepartments:false,departmentIds:[dept.id],deptIds:[dept.id],reason:reason,updatedAt:new Date().toISOString(),updatedBy:(window.CU&&(CU.username||CU.email))||''};changed++}});
    var legacy=[source.name].concat(source.aliases||[]).map(invNorm);Object.keys(map).forEach(function(k){if(k.indexOf('med:')===0)return;var r=map[k]||{};if(legacy.indexOf(invNorm(r.name||k.replace(/^(family:|identity:)/,'')))>=0)delete map[k]});
  });
  await S.s(key,map);closeInvModalC(hide?'v16-hide-modal':'v16-freeze-modal');if(typeof renderInv==='function')renderInv();toast((remove?'Removed from ':'Applied to ')+changed+' exact department medicine record(s) ✓','succ')
}
window.openHide=function(){openInvModalC('hide')};window.openFreeze=function(){openInvModalC('freeze')};

document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){if(E('v16-hide-modal'))closeInvModalC('v16-hide-modal');if(E('v16-freeze-modal'))closeInvModalC('v16-freeze-modal')}});

/* ── One controlled-stock page. Separate Shared Catalogue page is removed. ── */
window.ctlOwnerSource=function(){return ctlCanDispense()?'pharmacy':''};
window.ctlTabs=function(){
  var root=E('ctl-tabs');
  if(!root||!window.CU)return;
  var currentRole=roleC();
  var tabs;
  if(currentRole==='department'){
    tabs=[['departments','My controlled list / عهدتي']];
  }else if(currentRole==='warehouse'){
    tabs=[['overview','Controlled stock / المخزون المقيد']];
  }else{
    tabs=[['overview','Controlled stock / المخزون المقيد']];
    if(typeof window.canControlledPharmacyStorage==='function'&&window.canControlledPharmacyStorage()){
      tabs.push(['storage','Cabinets & Shelves / الدواليب والأرفف']);
    }
    tabs.push(['departments','Inpatient departments / أقسام التنويم']);
  }
  window.CTL_VIEW=normalizeViewC(window.CTL_VIEW);
  if(!tabs.some(function(item){return item[0]===window.CTL_VIEW;})){
    window.CTL_VIEW=tabs[0][0];
  }
  root.innerHTML=tabs.map(function(item){
    return '<button type="button" class="tbtn '+
      (window.CTL_VIEW===item[0]?'on':'')+
      '" data-view="'+item[0]+'">'+item[1]+'</button>';
  }).join('');
  root.querySelectorAll('button').forEach(function(button){
    button.onclick=function(){window.ctlSetView(button.dataset.view);};
  });
};
window.ctlSetView=function(v){window.CTL_VIEW=normalizeViewC(v);return window.renderControlled()};
function cleanImportCardC(){if(!canCatalogC())return '';return '<details class="card ctl-clean-import"><summary>Import or paste shared catalogue / استيراد القائمة المشتركة</summary><div class="cb"><div class="g2"><div><label>Excel file (.xlsx, .xls, .csv)</label><input type="file" id="ctl-import-file" accept=".xlsx,.xls,.csv" onchange="ctlImportMasterFile(this.files[0])"><div class="fhint">Imports medicine codes, balances and expiry dates.</div></div><div><label>Paste tab-separated text</label><textarea id="ctl-import-text" rows="4" placeholder="MOH Code    NUPCO Code    Medication ..."></textarea><button type="button" class="btn bp bsm" onclick="ctlImportMasterText()">Import text</button></div></div></div></details>'}
function overviewActionsC(m){var a=[];if(canWarehouseC()){a.push('<button type="button" class="btn bg bxs" data-id="'+escC(m.id)+'" onclick="ctlEditWarehouseStock(this.dataset.id)">Edit warehouse</button>');if(roleC()==='warehouse')a.push('<button type="button" class="btn bs bxs" data-id="'+escC(m.id)+'" onclick="ctlSendToPharmacy(this.dataset.id)">Send to pharmacy</button>')}if(canPharmacyC())a.push('<button type="button" class="btn bp bxs" data-id="'+escC(m.id)+'" onclick="ctlEditPharmacyStock(this.dataset.id)">Edit pharmacy</button>');if(canDispenseC())a.push('<button type="button" class="btn bs bxs" data-id="'+escC(m.id)+'" onclick="ctlOpenDispense(this.dataset.id)">Dispense / صرف</button>');if(canCatalogC())a.push('<button type="button" class="btn bg bxs" data-id="'+escC(m.id)+'" onclick="ctlEditCatalogMedicine(this.dataset.id)">Edit medicine</button>');return a.join(' ')||'<span class="chip">Read only</span>'}
window.renderCtlOverview=function(){
 var root=E('ctl-overview-view');if(!root)return;
 var currentRole=roleC(),roleChanged=ctlCleanFilterRoleC!==currentRole;
 if(roleChanged)ctlCleanFilterRoleC=currentRole;
 var q=roleChanged?'':(((E('ctl-clean-search')||{}).value||'').toLowerCase());
 var cls=roleChanged?'':((E('ctl-clean-class')||{}).value||'');
 var filter=roleChanged?'all':((E('ctl-clean-status')||{}).value||'all');
 var cat=typeof ctlCatalog==='function'?(ctlCatalog()||[]):[],wh=typeof ctlWarehouse==='function'?(ctlWarehouse()||{}):{},ph=typeof ctlPharmacy==='function'?(ctlPharmacy()||{}):{};
 var narcoticCount=cat.filter(function(m){return String(m.classification||'narcotic')!=='psychotropic'}).length;
 var psychotropicCount=cat.filter(function(m){return String(m.classification||'narcotic')==='psychotropic'}).length;
 var rows=cat.map(function(m){var w=wh[m.id]||{},p=ph[m.id]||{},st=statusC(m,w,p);return {m:m,w:w,p:p,st:st}}).filter(function(x){
   if(q&&[x.m.name,x.m.moh,x.m.nupco].join(' ').toLowerCase().indexOf(q)<0)return false;
   if(cls&&String(x.m.classification||'narcotic')!==cls)return false;
   if(filter!=='all'&&x.st.key!==filter)return false;
   return true;
 }).sort(function(a,b){var ac=String(a.m.classification||'narcotic')==='psychotropic'?1:0,bc=String(b.m.classification||'narcotic')==='psychotropic'?1:0;return ac-bc||String(a.m.name||'').localeCompare(String(b.m.name||''));});
 var alerts=cat.filter(function(m){return statusC(m,wh[m.id]||{},ph[m.id]||{}).key!=='ok'}).length;
 root.innerHTML='<div class="stitle">Shared controlled catalogue & stock / القائمة المشتركة ومخزون الأدوية المخدرة والمقيدة</div>'
  +'<div class="ssub">All shared medicines are shown here with warehouse quantities, pharmacy custody and expiry batches. / جميع أدوية القائمة المشتركة مع كميات المستودع وعهدة الصيدلية والتواريخ.</div>'
  +'<div class="fl g8" style="flex-wrap:wrap;margin-bottom:12px"><span class="chip">Narcotic & restricted / مخدر ومقيد: <b>'+narcoticCount+'</b></span><span class="chip">Psychotropic / نفسي: <b>'+psychotropicCount+'</b></span><span class="chip">Total / الإجمالي: <b>'+cat.length+'</b></span></div>'
  +'<div>'+(alerts?'<div class="alert-banner-y"><b>'+alerts+'</b> medicine(s) require review.</div>':'<div class="alert-banner" style="border-color:var(--gn);background:rgba(46,160,67,.08)">✓ No current stock or expiry alerts.</div>')+'</div>'
  +cleanImportCardC()
  +'<div class="card"><div class="ch"><div><span class="ct">Unified shared catalogue and stock / القائمة المشتركة والمخزون الموحد</span><div class="fhint">The duplicate page was merged here without removing any narcotic, restricted or psychotropic medicine.</div></div><div class="ctl-clean-toolbar"><input id="ctl-clean-search" placeholder="Search medicine or code" value="'+escC(q)+'"><select id="ctl-clean-class"><option value="">All classifications / كل التصنيفات</option><option value="narcotic" '+(cls==='narcotic'?'selected':'')+'>Narcotic & restricted / مخدر ومقيد</option><option value="psychotropic" '+(cls==='psychotropic'?'selected':'')+'>Psychotropic / نفسي</option></select><select id="ctl-clean-status"><option value="all">All statuses</option><option value="out" '+(filter==='out'?'selected':'')+'>Out of stock</option><option value="low" '+(filter==='low'?'selected':'')+'>Below minimum</option><option value="expired" '+(filter==='expired'?'selected':'')+'>Expired</option><option value="soon" '+(filter==='soon'?'selected':'')+'>Expiring soon</option></select>'+(canCatalogC()?'<button type="button" class="btn bp bsm" onclick="ctlAddCatalogMedicine()">+ Add medicine</button>':'')+'</div></div><div class="tw"><table><thead><tr><th>#</th><th>Medicine</th><th>Classification</th><th>MOH / NUPCO</th><th>Min / Max</th><th class="ctl-wh-head">Warehouse qty</th><th class="ctl-wh-head">Warehouse expiry</th><th class="ctl-ph-head">Pharmacy qty</th><th class="ctl-ph-head">Pharmacy expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
  +(rows.length?rows.map(function(x,i){var wq=numC(x.w.system)+numC(x.w.outside),pq=numC(x.p.qty!=null?x.p.qty:x.p.actualQty);return '<tr data-classification="'+escC(String(x.m.classification||'narcotic'))+'"><td>'+(i+1)+'</td><td><b>'+escC(x.m.name||'')+'</b></td><td>'+classC(x.m)+'</td><td>'+escC(x.m.moh||'—')+'<div class="fhint">'+escC(x.m.nupco||'—')+'</div></td><td>'+numC(x.m.min)+' / '+numC(x.m.max)+'</td><td class="ctl-wh-cell">'+wq+'<div class="fhint">System '+numC(x.w.system)+' · Outside '+numC(x.w.outside)+'</div></td><td class="ctl-wh-cell">'+fmtBatchC(x.w.batches)+'</td><td class="ctl-ph-cell">'+pq+'</td><td class="ctl-ph-cell">'+fmtBatchC(x.p.batches)+'</td><td>'+x.st.html+'</td><td><div class="ctl-clean-actions">'+overviewActionsC(x.m)+'</div></td></tr>'}).join(''):'<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--tx2)">No matching medicines.</td></tr>')
  +'</tbody></table></div></div><div class="card"><div class="ch"><span class="ct">Pending warehouse deliveries / الاستلامات المعلقة</span></div><div class="cb" id="ctl-pending"></div></div>';
 ['ctl-clean-search','ctl-clean-class','ctl-clean-status'].forEach(function(id){var n=E(id);if(n)n.addEventListener(id==='ctl-clean-search'?'input':'change',function(){window.renderCtlOverview()})});
 if(typeof renderCtlPending==='function')renderCtlPending();
};
function ensureDeptToolsC(){if(window.CTL_VIEW!=='departments'||!E('ctl-departments-view'))return;var allowed=masterC()||roleC()==='pharmacy'||roleC()==='controlled_pharmacy'||roleC()==='inpatient_supervisor';if(!allowed)return;var bar=E('ctl-departments-view').querySelector('.ch .fl')||E('ctl-departments-view').querySelector('.ch');if(!bar)return;if(!E('aa-final-rules-btn-dept')&&typeof window.aaFinalOpenExpiryRules==='function'){var c=document.createElement('button');c.id='aa-final-rules-btn-dept';c.type='button';c.className='btn bg bsm';c.textContent='⚙ Expiry rules';c.onclick=window.aaFinalOpenExpiryRules;bar.appendChild(c)}}
window.renderControlled=function(){
  if(!window.CU)return;
  var effective=window.MASTER_EFFECTIVE||window.CU||{};
  var effectiveRole=String(effective.role||'');
  var overview=E('ctl-overview-view');
  var departments=E('ctl-departments-view');
  var storage=E('ctl-storage-view');

  if(effectiveRole==='department'){
    window.CTL_VIEW='departments';
    if(typeof window.ctlTabs==='function')window.ctlTabs();
    if(overview)overview.style.display='none';
    if(storage)storage.style.display='none';
    if(departments)departments.style.display='block';
    var departmentNote=E('ctl-permission-note');
    if(departmentNote){
      departmentNote.style.display='block';
      departmentNote.textContent='Read-only department custody / عهدة القسم للعرض';
    }
    var departmentPrint=E('ctl-main-print-btn');
    if(departmentPrint)departmentPrint.style.display='none';
    return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
  }

  try{
    if(typeof ctlEnsureDepartmentSeed==='function')ctlEnsureDepartmentSeed();
  }catch(error){}

  window.CTL_VIEW=normalizeViewC(window.CTL_VIEW);
  if(window.CTL_VIEW==='storage'&&!(typeof window.canControlledPharmacyStorage==='function'&&window.canControlledPharmacyStorage())){
    window.CTL_VIEW='overview';
  }
  var displayView=window.CTL_VIEW;
  if(['overview','storage','departments'].indexOf(displayView)<0){
    displayView='overview';
    window.CTL_VIEW='overview';
  }
  window.ctlTabs();

  var mainPrint=E('ctl-main-print-btn');
  if(mainPrint){
    mainPrint.style.display=displayView==='departments'&&effectiveRole!=='warehouse'
      ?'inline-flex'
      :'none';
  }

  if(overview)overview.style.display=displayView==='overview'?'block':'none';
  if(storage)storage.style.display=displayView==='storage'?'block':'none';
  if(departments)departments.style.display=displayView==='departments'?'block':'none';

  var pdf=E('ctl-pdf-receipt-card');
  if(pdf){
    pdf.style.display=effectiveRole==='warehouse'&&displayView==='overview'
      ?'block'
      :'none';
  }

  var note=E('ctl-permission-note');
  if(note){
    note.style.display=effectiveRole==='warehouse'||effectiveRole==='controlled_pharmacy'
      ?'block'
      :'none';
    note.textContent=effectiveRole==='warehouse'
      ?'Warehouse permission: warehouse quantities and deliveries only / صلاحية المستودع للكميات والتوريد فقط'
      :(displayView==='storage'
        ?'Controlled pharmacy storage: cabinets and safes organize the central pharmacy custody only; inpatient-department custody is separate. / تنظيم دواليب وخزائن عهدة الصيدلية المقيدة فقط، ولا يرتبط بعهدة الأقسام.'
        :'Controlled pharmacy permission: pharmacy custody, inpatient dispensing and department lists / صلاحية مسؤول المخدرات للعهدة والصرف للأقسام');
  }

  if(displayView==='overview'){
    window.renderCtlOverview();
  }else if(displayView==='storage'){
    window.renderControlledStorage();
  }else if(typeof renderCtlDepartments==='function'){
    renderCtlDepartments();
    ensureDeptToolsC();
  }

  var signatureButton=E('ctl-sign-btn')||document.querySelector('#ctl-departments-view button[onclick*="ctlEditSignatures"]');
  if(signatureButton){
    var actualMaster=!!(window.CU&&CU.master===true&&!window.MASTER_EFFECTIVE);
    signatureButton.style.display=displayView==='departments'&&
      (effectiveRole==='controlled_pharmacy'||actualMaster)
      ?'inline-flex'
      :'none';
    signatureButton.textContent='Edit Signatures / تعديل التوقيعات';
  }

  if(typeof renderCtlLog==='function'&&displayView==='departments')renderCtlLog();
  if(typeof renderCtlPdfReceiptPanel==='function'&&displayView==='overview'){
    try{renderCtlPdfReceiptPanel();}catch(error){}
  }

  if(displayView!=='storage'){
    [
      window.applyWarehouseControlledUi,
      window.addWarehouseControlledBulkButtons,
      window.ensureControlledBulkReplacementButton,
      window.cleanupDepartmentPrintUi
    ].forEach(function(step){
      if(typeof step==='function'){
        try{step();}catch(error){
          console.error('Controlled post-render step failed',error);
        }
      }
    });
  }
};

/* ── Department controlled custody: batch/lot optional; zero quantity needs no expiry. ── */
function markOptionalC(){var modal=E('v13x-stock-modal');if(!modal)return;modal.querySelectorAll('.v13x-batch-row input,.batch-editor-row input').forEach(function(x){x.required=false});var note=E('v13aq-expiry-summary');if(!note){var host=E('v13x-stock-batches');if(host){note=document.createElement('div');note.id='v13aq-expiry-summary';note.className='alert-banner-y';host.parentNode.insertBefore(note,host)}}if(note)note.innerHTML='<b>Lot/Batch is optional.</b> Expiry rows are required only when actual quantity is greater than zero. When actual quantity is 0, expiry rows are cleared automatically.'}
window.markControlledStockOptional=markOptionalC;

/* ── Controlled pharmacy dispensing updates the inpatient department custody. ── */
function consumeDetailedC(batches,qty){var left=qty,remain=[],used=[];(batches||[]).slice().sort(function(a,b){return String(a.expiry||'9999').localeCompare(String(b.expiry||'9999'))}).forEach(function(b){var n=numC(b.qty),take=Math.min(n,left);if(take>0)used.push({qty:take,expiry:b.expiry||'',lot:b.lot||''});left-=take;n-=take;if(n>0)remain.push(Object.assign({},b,{qty:n}))});return {remaining:remain,used:used,short:left}}
function mergeBatchesC(a,b){var map={};(a||[]).concat(b||[]).forEach(function(x){var k=(x.expiry||'')+'|'+(x.lot||'');if(!map[k])map[k]={qty:0,expiry:x.expiry||'',lot:x.lot||''};map[k].qty+=numC(x.qty)});return Object.keys(map).map(function(k){return map[k]}).filter(function(x){return x.qty>0})}
window.ctlConfirmDispense=async function(){
  if(!canDispenseC())return toast('Only the controlled-pharmacy custodian can dispense to departments.','err');
  var id=(E('ctld-med')||{}).value||'',qty=numC((E('ctld-qty')||{}).value),type=(E('ctld-type')||{}).value||'inpatient',recipient=((E('ctld-recipient')||{}).value||'').trim();
  if(!id||qty<=0||!recipient)return toast('Enter quantity and recipient name.','err');

  var deptFlow=type==='inpatient'||type==='internal',dept='',deptName='',deptOriginal=null,deptNext=null;
  if(deptFlow){
    dept=(E('ctld-dept')||{}).value||'';
    if(!dept)return toast('Choose a hospital department.','err');
    var d=(typeof gd==='function'?(gd()||[]):[]).find(function(x){return String(x.id)===String(dept)});
    if(!d)return toast('The selected department no longer exists.','err');
    deptName=d.name||dept;
  }

  var phOriginal=typeof ctlPharmacy==='function'?(ctlPharmacy()||{}):{},phNext=Object.assign({},phOriginal),stock=Object.assign({},phOriginal[id]||{}),available=numC(stock.qty!=null?stock.qty:stock.actualQty);
  if(qty>available)return toast('Insufficient pharmacy custody quantity.','err');
  var consumed=consumeDetailedC(stock.batches,qty);
  if(consumed.short>0)return toast('Expiry batch quantities do not cover the requested dispense quantity. Complete the pharmacy expiry batches first.','err');
  stock.qty=available-qty;stock.actualQty=stock.qty;stock.batches=consumed.remaining;phNext[id]=stock;

  if(deptFlow){
    deptOriginal=(ctlDeptList(dept)||[]).map(function(x){return Object.assign({},x,{batches:(x.batches||[]).map(function(b){return Object.assign({},b)})})});
    deptNext=deptOriginal.map(function(x){return Object.assign({},x,{batches:(x.batches||[]).map(function(b){return Object.assign({},b)})})});
    var ix=deptNext.findIndex(function(x){return String(x.medId)===String(id)}),entry=ix>=0?Object.assign({},deptNext[ix]):{medId:id,requiredQty:0,actualQty:0,qty:0,batches:[]};
    entry.actualQty=numC(entry.actualQty!=null?entry.actualQty:entry.qty)+qty;entry.qty=entry.actualQty;entry.batches=mergeBatchesC(entry.batches,consumed.used);
    if(ix>=0)deptNext[ix]=entry;else deptNext.push(entry);
  }

  try{
    await ctlSetPharmacy(phNext);
    if(deptFlow)await ctlSetDeptList(dept,deptNext);
  }catch(e){
    console.error('Controlled dispense save failed',e);
    var rollbackFailed=false,rollback=[Promise.resolve(ctlSetPharmacy(phOriginal)).catch(function(err){rollbackFailed=true;console.error('Pharmacy rollback failed',err)})];
    if(deptFlow)rollback.push(Promise.resolve(ctlSetDeptList(dept,deptOriginal)).catch(function(err){rollbackFailed=true;console.error('Department rollback failed',err)}));
    await Promise.all(rollback);
    return toast(rollbackFailed?'Dispensing failed and the rollback could not be confirmed. Review pharmacy and department balances.':'Dispensing was not completed. No stock change was kept.','err');
  }

  var movementSaved=await ctlSaveMovementLog({type:'dispense',medId:id,qty:qty,source:'pharmacy',dispenseType:type,dept:dept,deptName:deptName,recipient:recipient,note:((E('ctld-note')||{}).value||'').trim()},'Controlled dispensing');
  if(typeof CM==='function')CM('mctldisp');window.renderControlled();
  toast(movementSaved?(deptFlow?'Dispensed and added to department custody ✓':'Dispensing recorded ✓'):'Stock was updated, but the movement log could not be saved.',movementSaved?'succ':'info');return true
};


function repairControlledSharedC(){
  if(!window.CU||!window.S||!S.ready)return Promise.resolve(false);
  var results=[];
  return Promise.resolve()
    .then(function(){return typeof window.ensureNarcoticSharedList==='function'?window.ensureNarcoticSharedList():false})
    .then(function(v){results.push(!!v);return typeof window.ensurePsychotropicSharedList==='function'?window.ensurePsychotropicSharedList():false})
    .then(function(v){results.push(!!v);return typeof window.applyPsychotropicPharmacyStockR664==='function'?window.applyPsychotropicPharmacyStockR664():false})
    .then(function(v){results.push(!!v);var changed=results.some(Boolean),active=document.querySelector('.pg.on');if(changed&&active&&active.id==='pg-controlled'&&typeof window.renderControlled==='function')window.renderControlled();return changed})
    .catch(function(e){console.warn('Controlled shared catalogue repair failed',e);return false});
}
function bootC(){cleanupInvModalsC();if(window.CU&&window.S&&S.ready)repairControlledSharedC()}
window.prepareControlledStartup=bootC;

})();

export {};

(function(){
'use strict';
const E=globalThis.E;
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
 var instock=roleChanged?'all':((E('ctl-clean-instock')||{}).value||'all');
 var cat=typeof ctlCatalog==='function'?(ctlCatalog()||[]):[],wh=typeof ctlWarehouse==='function'?(ctlWarehouse()||{}):{},ph=typeof ctlPharmacy==='function'?(ctlPharmacy()||{}):{};
 var narcoticCount=cat.filter(function(m){return String(m.classification||'narcotic')!=='psychotropic'}).length;
 var psychotropicCount=cat.filter(function(m){return String(m.classification||'narcotic')==='psychotropic'}).length;
 var rows=cat.map(function(m){var w=wh[m.id]||{},p=ph[m.id]||{},st=statusC(m,w,p);return {m:m,w:w,p:p,st:st}}).filter(function(x){
   if(q&&[x.m.name,x.m.moh,x.m.nupco].join(' ').toLowerCase().indexOf(q)<0)return false;
   if(cls&&String(x.m.classification||'narcotic')!==cls)return false;
   if(filter!=='all'&&x.st.key!==filter)return false;
   if(instock==='in_my_stock'){var wq2=numC(x.w.system)+numC(x.w.outside),pq2=numC(x.p.qty!=null?x.p.qty:x.p.actualQty),r=roleC();if(r==='warehouse'&&wq2<=0)return false;if((r==='pharmacy'||r==='controlled_pharmacy')&&pq2<=0)return false;}
   return true;
 }).sort(function(a,b){var ac=String(a.m.classification||'narcotic')==='psychotropic'?1:0,bc=String(b.m.classification||'narcotic')==='psychotropic'?1:0;return ac-bc||String(a.m.name||'').localeCompare(String(b.m.name||''));});
 var alerts=cat.filter(function(m){return statusC(m,wh[m.id]||{},ph[m.id]||{}).key!=='ok'}).length;
 root.innerHTML='<div class="stitle">Shared controlled catalogue & stock / القائمة المشتركة ومخزون الأدوية المخدرة والمقيدة</div>'
  +'<div class="ssub">All shared medicines are shown here with warehouse quantities, pharmacy custody and expiry batches. / جميع أدوية القائمة المشتركة مع كميات المستودع وعهدة الصيدلية والتواريخ.</div>'
  +'<div class="fl g8" style="flex-wrap:wrap;margin-bottom:12px"><span class="chip">Narcotic & restricted / مخدر ومقيد: <b>'+narcoticCount+'</b></span><span class="chip">Psychotropic / نفسي: <b>'+psychotropicCount+'</b></span><span class="chip">Total / الإجمالي: <b>'+cat.length+'</b></span></div>'
  +'<div>'+(alerts?'<div class="alert-banner-y"><b>'+alerts+'</b> medicine(s) require review.</div>':'<div class="alert-banner" style="border-color:var(--gn);background:rgba(46,160,67,.08)">✓ No current stock or expiry alerts.</div>')+'</div>'
  +cleanImportCardC()
  +'<div class="card"><div class="ch"><div><span class="ct">Unified shared catalogue and stock / القائمة المشتركة والمخزون الموحد</span><div class="fhint">The duplicate page was merged here without removing any narcotic, restricted or psychotropic medicine.</div></div><div class="ctl-clean-toolbar"><input id="ctl-clean-search" placeholder="Search medicine or code" value="'+escC(q)+'"><select id="ctl-clean-class"><option value="">All classifications / كل التصنيفات</option><option value="narcotic" '+(cls==='narcotic'?'selected':'')+'>Narcotic & restricted / مخدر ومقيد</option><option value="psychotropic" '+(cls==='psychotropic'?'selected':'')+'>Psychotropic / نفسي</option></select><select id="ctl-clean-status"><option value="all">All statuses</option><option value="out" '+(filter==='out'?'selected':'')+'>Out of stock</option><option value="low" '+(filter==='low'?'selected':'')+'>Below minimum</option><option value="expired" '+(filter==='expired'?'selected':'')+'>Expired</option><option value="soon" '+(filter==='soon'?'selected':'')+'>Expiring soon</option></select><select id="ctl-clean-instock"><option value="all">All medicines / كل الأدوية</option><option value="in_my_stock" '+(instock==='in_my_stock'?'selected':'')+'>In my stock only / المتوفرة بمخزوني فقط</option></select>'+(canCatalogC()?'<button type="button" class="btn bp bsm" onclick="ctlAddCatalogMedicine()">+ Add medicine</button>':'')+'</div></div><div class="tw"><table><thead><tr><th>#</th><th>Medicine</th><th>Classification</th><th>MOH / NUPCO</th><th>Min / Max</th><th class="ctl-wh-head">Warehouse qty</th><th class="ctl-wh-head">Warehouse expiry</th><th class="ctl-ph-head">Pharmacy qty</th><th class="ctl-ph-head">Pharmacy expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
  +(rows.length?rows.map(function(x,i){var wq=numC(x.w.system)+numC(x.w.outside),pq=numC(x.p.qty!=null?x.p.qty:x.p.actualQty);return '<tr data-classification="'+escC(String(x.m.classification||'narcotic'))+'"><td>'+(i+1)+'</td><td><b>'+escC(x.m.name||'')+'</b></td><td>'+classC(x.m)+'</td><td>'+escC(x.m.moh||'—')+'<div class="fhint">'+escC(x.m.nupco||'—')+'</div></td><td>'+numC(x.m.min)+' / '+numC(x.m.max)+'</td><td class="ctl-wh-cell">'+wq+'<div class="fhint">System '+numC(x.w.system)+' · Outside '+numC(x.w.outside)+'</div></td><td class="ctl-wh-cell">'+fmtBatchC(x.w.batches)+'</td><td class="ctl-ph-cell">'+pq+'</td><td class="ctl-ph-cell">'+fmtBatchC(x.p.batches)+'</td><td>'+x.st.html+'</td><td><div class="ctl-clean-actions">'+overviewActionsC(x.m)+'</div></td></tr>'}).join(''):'<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--tx2)">No matching medicines.</td></tr>')
  +'</tbody></table></div></div><div class="card"><div class="ch"><span class="ct">Pending warehouse deliveries / الاستلامات المعلقة</span></div><div class="cb" id="ctl-pending"></div></div>';
 ['ctl-clean-search','ctl-clean-class','ctl-clean-status','ctl-clean-instock'].forEach(function(id){var n=E(id);if(n)n.addEventListener(id==='ctl-clean-search'?'input':'change',function(){window.renderCtlOverview()})});
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
  // Custodian/warehouse sessions own the static #ctl-dept / #ctl-dept-table markup.
  // A prior department-role session in this same SPA lifetime may have shown the
  // dept-only panel instead (see renderDepartmentControlledPanel) — restore the
  // custodian panel here so a later non-department render is never left showing
  // stale department content.
  var custodianPanel=E('ctl-departments-custodian-panel'),deptOnlyPanel=E('ctl-dept-only-panel');
  if(custodianPanel)custodianPanel.style.display='';
  if(deptOnlyPanel)deptOnlyPanel.style.display='none';

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
    .then(function(v){results.push(!!v);return typeof window.restoreNarcoticCatalogFromBackup==='function'?window.restoreNarcoticCatalogFromBackup():false})
    .then(function(v){results.push(!!v);return typeof window.enrichAllDeptListNames==='function'?window.enrichAllDeptListNames():false})
    .then(function(v){results.push(!!v);var changed=results.some(Boolean),active=document.querySelector('.pg.on');if(changed&&active&&active.id==='pg-controlled'&&typeof window.renderControlled==='function')window.renderControlled();return changed})
    .catch(function(e){console.warn('Controlled shared catalogue repair failed',e);return false});
}
function bootC(){cleanupInvModalsC();if(window.CU&&window.S&&S.ready)repairControlledSharedC()}
window.prepareControlledStartup=bootC;

})();


// --- Merged from 41-v16-inventory-status-merge-clean-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function R(){return String((window.CU&&CU.role)||'')}
function escV(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function normV(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function familyV(v){return normV(v).replace(/(\d)(mg|mcg|gm|g|ml|iu|mmol|meq)\b/gi,'$1 $2').replace(/\b(?:tab(?:let)?s?|caps?(?:ule)?s?|amp(?:oule)?s?|vials?|bottles?|bags?|syrups?|solutions?|soln|susp(?:ension)?|inj(?:ection)?s?|cream|ointment|drops?|inhalers?|suppositor(?:y|ies))\b/gi,' ').replace(/\s+/g,' ').trim()}
function identityV(v){
 var stop={tab:1,tabs:1,tablet:1,tablets:1,cap:1,caps:1,capsule:1,capsules:1,amp:1,amps:1,ampoule:1,ampoules:1,vial:1,vials:1,bottle:1,bottles:1,bag:1,bags:1,syrup:1,solution:1,solutions:1,soln:1,susp:1,suspension:1,inj:1,injection:1,injections:1,cream:1,ointment:1,drop:1,drops:1,inhaler:1,inhalers:1,suppository:1,suppositories:1,oral:1,iv:1,im:1,sc:1,intravenous:1,intramuscular:1,subcutaneous:1,infusion:1,premix:1,pack:1,packs:1,for:1,of:1,محلول:1,محاليل:1,حقن:1,حقنة:1,امبول:1,امبولات:1,فيال:1,فيالات:1,قرص:1,اقراص:1,كبسول:1,كبسولات:1};
 return normV(v).replace(/(\d)(mg|mcg|gm|g|ml|iu|mmol|meq)\b/gi,'$1 $2').split(/\s+/).filter(function(t){return t&&!stop[t]}).join(' ')
}
function sameV(a,b){a=identityV(a);b=identityV(b);if(!a||!b)return false;if(a===b)return true;var aa=a.split(' '),bb=b.split(' '),common=aa.filter(function(t){return bb.indexOf(t)>-1});return common.length>=2&&common.length/Math.max(aa.length,bb.length)>=.78}
function store(key,def){try{var x=window.S&&S.g?S.g(key):null;return x==null?def:x}catch(e){return def}}
function appliesV(rule,dept){return !!(rule&&(rule.allDepartments===true||rule.deptIds==='all'||(Array.isArray(rule.departmentIds)&&rule.departmentIds.indexOf(dept)>-1)||(Array.isArray(rule.deptIds)&&rule.deptIds.indexOf(dept)>-1)))}
function ruleFor(map,med,dept){return typeof window.fsR17MedicationRuleFor==='function'?window.fsR17MedicationRuleFor(map,med,dept):null}
function statusAllowed(){return window.fsHasCapability?window.fsHasCapability('inventory.read'):!!(window.CU&&(CU.master===true||['pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(R())>-1))}
function manageAllowed(){return window.fsHasCapability?window.fsHasCapability('inventory.manage'):!!(window.CU&&(CU.master===true||['pharmacy','inpatient_supervisor'].indexOf(R())>-1))}
function currentDept(){return String((E('inv-dept-sel')||{}).value||'')}
function currentMeds(){var d=currentDept();return d&&typeof getMeds==='function'?(getMeds(d)||[]):[]}
function ensureStatusFilter(){
 if(!statusAllowed()||!E('pg-inv'))return;
 var host=E('pg-inv').querySelector('.card .ch .fl.g8.ic')||E('pg-inv').querySelector('.card .ch');if(!host)return;
 var f=E('v16-inv-status-filter');if(!f){f=document.createElement('select');f.id='v16-inv-status-filter';f.className='psel v16-status-filter';f.innerHTML='<option value="all">All medicines / كل الأدوية</option><option value="active">Active only / النشطة فقط</option><option value="hidden">Hidden from requests / المخفية من الطلب</option><option value="frozen">Frozen / المجمدة</option><option value="restricted">Hidden or frozen / المخفية أو المجمدة</option>';f.onchange=applyInventoryStatus;host.appendChild(f)}
}
function ensureInventoryHeaderTools(){
 if(!E('pg-inv'))return;var head=E('pg-inv').querySelector('.fl.ic.jb .fl.g8.ic');if(!head)return;
 if(manageAllowed()&&!E('v16-hide-head')){var h=document.createElement('button');h.id='v16-hide-head';h.type='button';h.className='btn bg bsm';h.textContent='🙈 Hide from requests';h.onclick=window.openHide;head.appendChild(h)}
 if(manageAllowed()&&!E('v16-freeze-head')){var f=document.createElement('button');f.id='v16-freeze-head';f.type='button';f.className='btn bd2c bsm';f.textContent='⏸ Freeze requests';f.onclick=window.openFreeze;head.appendChild(f)}
 if(manageAllowed()&&!E('v16-similar-head')){var s=document.createElement('button');s.id='v16-similar-head';s.type='button';s.className='btn bg bsm';s.textContent='≋ Similar medicines / الأدوية المتشابهة';s.onclick=window.openSimilarMedicinesAllDepartments;head.appendChild(s)}
 ['v16-multi-head','v16-multi-btn'].forEach(function(id){var b=E(id);if(b){b.type='button';b.onclick=window.v16OpenMultiDepartments}})
}
function applyInventoryStatus(){
 if(!statusAllowed())return;var dept=currentDept(),meds=currentMeds(),hm=store('medication_visibility_rules_v3',{})||{},fm=store('medication_freeze_rules_v3',{})||{},old=store('global_request_freeze_v2',{})||{};Object.keys(old).forEach(function(k){if(!fm[k])fm[k]=old[k]});var mode=(E('v16-inv-status-filter')||{}).value||'all';
 meds.forEach(function(m){var row=E('inv-row-'+m.id);if(!row)return;var h=!!ruleFor(hm,m,dept),f=!!ruleFor(fm,m,dept);row.classList.toggle('v16-inv-hidden',h);row.classList.toggle('v16-inv-frozen',f);row.dataset.v16Hidden=h?'1':'0';row.dataset.v16Frozen=f?'1':'0';var nameCell=row.cells&&row.cells[2];if(nameCell){var oldBadges=nameCell.querySelector('.v16-inv-state-badges');if(oldBadges)oldBadges.remove();if(h||f){var badges=document.createElement('div');badges.className='v16-inv-state-badges';if(h)badges.innerHTML+='<span class="badge byl">🙈 Hidden</span>';if(f){var scope=window.fsR17RuleScopeLabel?window.fsR17RuleScopeLabel(ruleFor(fm,m,dept)):'';badges.innerHTML+='<span class="badge brd">⏸ Frozen'+(scope?' — '+escV(scope):'')+'</span>'};nameCell.appendChild(badges)}}var show=mode==='all'||(mode==='active'&&!h&&!f)||(mode==='hidden'&&h)||(mode==='frozen'&&f)||(mode==='restricted'&&(h||f));row.style.display=show?'':'none'});
 document.querySelectorAll('#itbl .cath').forEach(function(c){var tr=c.closest('tr'),n=tr&&tr.nextElementSibling,visible=false;while(n&&!n.querySelector('.cath')){if(n.style.display!=='none'){visible=true;break}n=n.nextElementSibling}if(tr)tr.style.display=visible?'':'none'});
}

function selectedSource(){var d=currentDept(),ids=Array.from(document.querySelectorAll('.inv-chk:checked')).map(function(x){return String(x.dataset.id)});return (typeof getMeds==='function'?(getMeds(d)||[]):[]).find(function(m){return ids.indexOf(String(m.id))>-1})||{}}
function matchInDept(dept,name){return (typeof getMeds==='function'?(getMeds(dept)||[]):[]).find(function(m){return normV(m.name)===normV(name)})||null}
function refreshMultiDepartments(){
 var host=E('v16-multi-departments'),action=(E('v16-multi-action')||{}).value||'add',name=((E('v16-multi-name')||{}).value||'').trim(),depts=typeof gd==='function'?(gd()||[]):[];if(!host)return;
 var fields=E('v16-multi-fields');if(fields)fields.classList.toggle('is-delete',action==='delete');
 host.innerHTML=depts.map(function(d){var found=name?matchInDept(d.id,name):null,applicable=action==='add'?!found:!!found,checked=(action!=='add'&&found)?' checked':'',disabled=applicable?'':' disabled';return '<label class="v16-multi-dept-row"><input class="v16-multi-dept" type="checkbox" value="'+escV(d.id)+'"'+checked+disabled+' style="width:auto;margin:0"><span><b>'+escV(d.name||d.id)+'</b><div class="fhint">'+(found?escV(found.name):'Not found / غير موجود')+'</div></span><span class="badge '+(found?'bgn':'bgr')+'">'+(found?'Existing / موجود':'Missing / غير موجود')+'</span></label>'}).join('')||'<div class="fhint">No departments.</div>';
 var all=E('v16-multi-all');if(all)all.checked=false
}
window.v16ToggleMultiApplicable=function(on){document.querySelectorAll('.v16-multi-dept:not(:disabled)').forEach(function(x){x.checked=!!on})};
window.v16OpenMultiDepartments=function(){
 if(!manageAllowed())return;var old=E('v16-multi-modal');if(old)old.remove();var source=selectedSource(),cats=typeof getCategories==='function'?(getCategories()||[]):[],names={};(typeof gd==='function'?(gd()||[]):[]).forEach(function(d){(getMeds(d.id)||[]).forEach(function(m){if(m.name)names[m.name]=1})});
 var html='<div class="modal-bg on" id="v16-multi-modal"><div class="modal" style="width:min(940px,97vw)"><div class="mh"><div><div class="mt">Multi-department medicine / دواء لعدة أقسام</div><div class="fhint">Add to missing departments, edit where it exists, or delete from selected departments.</div></div><button type="button" class="xbtn" data-close>×</button></div><div class="frow"><div><label>Action / العملية</label><select id="v16-multi-action"><option value="add">Add / إضافة</option><option value="edit">Edit / تعديل</option><option value="delete">Delete / حذف</option></select></div><div><label>Medication name / اسم العلاج</label><input id="v16-multi-name" list="v16-multi-names" value="'+escV(source.name||'')+'"><datalist id="v16-multi-names">'+Object.keys(names).sort().map(function(n){return '<option value="'+escV(n)+'">'}).join('')+'</datalist></div></div><div id="v16-multi-fields" class="v16-multi-fields frow"><div><label>Category</label><select id="v16-multi-cat">'+cats.map(function(c){return '<option '+(c===source.category?'selected':'')+'>'+escV(c)+'</option>'}).join('')+'</select></div><div><label>Min</label><input id="v16-multi-min" type="number" min="0" value="'+escV(source.min||0)+'"></div><div><label>Max</label><input id="v16-multi-max" type="number" min="0" value="'+escV(source.max||0)+'"></div></div><label class="ops-scope-all"><input id="v16-multi-all" type="checkbox" onchange="v16ToggleMultiApplicable(this.checked)" style="width:auto;margin:0"> Select all applicable departments / تحديد كل الأقسام المتاحة</label><div id="v16-multi-departments" class="v16-multi-dept-list"></div><div class="fl g8" style="justify-content:flex-end"><button type="button" class="btn bg" data-close>Cancel</button><button type="button" class="btn bs" onclick="v16ApplyMultiClean()">Apply</button></div></div></div>';
 document.body.insertAdjacentHTML('beforeend',html);var modal=E('v16-multi-modal');modal.addEventListener('click',function(ev){if(ev.target===modal||ev.target.closest('[data-close]'))modal.remove()});E('v16-multi-action').onchange=refreshMultiDepartments;var timer;E('v16-multi-name').oninput=function(){clearTimeout(timer);timer=setTimeout(refreshMultiDepartments,120)};refreshMultiDepartments()
};
window.v16ApplyMultiClean=async function(){
 var modal=E('v16-multi-modal'),action=(E('v16-multi-action')||{}).value||'add',name=((E('v16-multi-name')||{}).value||'').trim(),ids=Array.from(document.querySelectorAll('.v16-multi-dept:checked:not(:disabled)')).map(function(x){return x.value});if(!name)return toast('Medication name is required.','err');if(!ids.length)return toast('Choose one or more departments.','err');var changed=0;
 for(var i=0;i<ids.length;i++){var dept=ids[i],meds=(getMeds(dept)||[]).slice(),idx=meds.findIndex(function(m){return normV(m.name)===normV(name)});if(action==='add'){if(idx>=0)continue;meds.push({id:'med_'+Date.now().toString(36)+'_'+i,name:name,category:(E('v16-multi-cat')||{}).value||'',min:Number((E('v16-multi-min')||{}).value)||0,max:Number((E('v16-multi-max')||{}).value)||0,created:typeof nowISO==='function'?nowISO():new Date().toISOString()});changed++}else if(action==='edit'){if(idx<0)continue;var obj=Object.assign({},meds[idx]);obj.name=name;obj.category=(E('v16-multi-cat')||{}).value||obj.category;obj.min=Number((E('v16-multi-min')||{}).value)||0;obj.max=Number((E('v16-multi-max')||{}).value)||0;meds[idx]=obj;changed++}else{if(idx<0)continue;var removed=meds[idx];meds.splice(idx,1);if(typeof getExpiry==='function'&&typeof setExpiry==='function'){var exp=(getExpiry(dept)||[]).filter(function(x){return String(x.medId)!==String(removed.id)});await setExpiry(dept,exp)}changed++}await setMeds(dept,meds)}
 if(modal)modal.remove();if(typeof renderInv==='function')renderInv();toast((action==='add'?'Added to ':action==='edit'?'Edited in ':'Deleted from ')+changed+' department(s) ✓','succ')
};

function mergeRuleScopes(rules,canonical){var all=rules.some(function(r){return r&&r.allDepartments===true}),ids=[];rules.forEach(function(r){(r&&r.departmentIds||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id)})});return {name:canonical,allDepartments:all,departmentIds:all?[]:ids,reason:(rules.find(function(r){return r&&r.reason})||{}).reason||'',updatedAt:new Date().toISOString(),updatedBy:(window.CU&&(CU.username||CU.email))||''}}
async function reconcileMergedRules(names,canonical){for(var ki=0;ki<2;ki++){var key=ki===0?'medication_visibility_rules_v3':'medication_freeze_rules_v3',map=Object.assign({},store(key,{})||{}),rules=[];Object.keys(map).forEach(function(k){var r=map[k];if(r&&r.name&&names.some(function(n){return sameV(r.name,n)})){rules.push(r);delete map[k]}});if(rules.length){var merged=mergeRuleScopes(rules,canonical);[normV(canonical),'family:'+familyV(canonical),'identity:'+identityV(canonical)].forEach(function(k){if(k&&!/:$/.test(k))map[k]=merged});await S.s(key,map)}}}
function selectedSimilarNames(){var names=[];document.querySelectorAll('#all-inv-body .all-inv-name-check:checked').forEach(function(c){var n=c.dataset.name||'';if(n&&!names.some(function(x){return normV(x)===normV(n)}))names.push(n)});return names}
window.openMergeInventoryNames=function(){if(!manageAllowed())return toast('Not authorized to merge inventory names. / غير مصرح بدمج أسماء الأدوية.','err');var names=selectedSimilarNames();if(names.length<2)return toast('Select at least two different medication names.','err');var old=E('merge-names-modal');if(old)old.remove();document.body.insertAdjacentHTML('beforeend','<div class="modal-bg on" id="merge-names-modal"><div class="modal" style="width:650px"><div class="mh"><div><div class="mt">Merge medication names / دمج مسميات الأدوية</div><div class="fhint">Choose the single standard name that will be used in every department.</div></div><button type="button" class="xbtn" data-close>×</button></div><div class="merge-canonical-list">'+names.map(function(n,i){return '<label class="merge-canonical-option"><input type="radio" name="canonical-med-name" value="'+escV(n)+'" '+(i===0?'checked':'')+' style="width:auto;margin:0"><b>'+escV(n)+'</b></label>'}).join('')+'</div><div class="alert-banner-y" style="margin-top:12px">All matching records in every department will use one name. Duplicate records inside the same department will be combined while retaining the highest Min/Max and current classifications.</div><div class="fl g8" style="justify-content:flex-end"><button type="button" class="btn bg" data-close>Cancel</button><button type="button" class="btn bp" onclick="confirmMergeInventoryNames()">Merge names</button></div></div></div>');var m=E('merge-names-modal');m.addEventListener('click',function(ev){if(ev.target===m||ev.target.closest('[data-close]'))m.remove()})};
window.confirmMergeInventoryNames=async function(){if(!manageAllowed())return toast('Not authorized to merge inventory names. / غير مصرح بدمج أسماء الأدوية.','err');var names=selectedSimilarNames(),radio=document.querySelector('input[name="canonical-med-name"]:checked'),canonical=radio&&radio.value;if(names.length<2||!canonical)return toast('Choose at least two names and a standard name.','err');if(!(await uiConfirm('Merge '+names.length+' names into “'+canonical+'” across all departments?')))return;var selectedExact=new Set(names.map(normV)),snapshot={id:'merge_'+Date.now(),at:typeof nowISO==='function'?nowISO():new Date().toISOString(),by:(window.CU&&CU.username)||'',canonical:canonical,names:names,matchMode:'exact-selected-names',departments:{},expiry:{}},changed=0,removed=0,depts=typeof gd==='function'?(gd()||[]):[];for(var di=0;di<depts.length;di++){var dept=depts[di],meds=(getMeds(dept.id)||[]).slice(),matches=meds.filter(function(m){return selectedExact.has(normV(m.name))});if(!matches.length)continue;snapshot.departments[dept.id]=meds;snapshot.expiry[dept.id]=typeof getExpiry==='function'?(getExpiry(dept.id)||[]).slice():[];var survivor=matches.find(function(m){return normV(m.name)===normV(canonical)})||matches[0],merged=Object.assign({},survivor),matchIds={};matches.forEach(function(m){matchIds[String(m.id)]=1});merged.id=survivor.id;merged.name=canonical;merged.min=Math.max.apply(null,matches.map(function(m){return Number(m.min)||0}));merged.max=Math.max.apply(null,matches.map(function(m){return Number(m.max)||0}));if(matches.some(function(m){return m.monthly!=null}))merged.monthly=Math.max.apply(null,matches.map(function(m){return Number(m.monthly)||0}));['high_alert','hazard','lasa','refrigerated'].forEach(function(k){merged[k]=matches.some(function(m){return !!m[k]})});if(matches.some(function(m){return m.currentQty!=null}))merged.currentQty=matches.reduce(function(sum,m){return sum+(Number(m.currentQty)||0)},0);var next=[],inserted=false;meds.forEach(function(m){if(!matchIds[String(m.id)]){next.push(m);return}if(!inserted){next.push(merged);inserted=true}else removed++});await setMeds(dept.id,next);if(typeof getExpiry==='function'&&typeof setExpiry==='function'){var exp=(getExpiry(dept.id)||[]).map(function(e){return matchIds[String(e.medId)]?Object.assign({},e,{medId:survivor.id}):e});await setExpiry(dept.id,exp)}changed++}var history=(store('inventory_name_merge_history',[])||[]).slice();history.unshift(snapshot);if(history.length>20)history.length=20;await S.s('inventory_name_merge_history',history);await reconcileMergedRules(names,canonical);if(typeof auditAction==='function')auditAction('inventory_names_merged',{canonical:canonical,names:names,departments:changed,removedRecords:removed,matchMode:'exact-selected-names'});var mm=E('merge-names-modal');if(mm)mm.remove();var am=E('all-inv-modal');if(am)am.remove();document.body.style.overflow='';toast('Only the selected exact names were merged across '+changed+' department(s) ✓','succ');if(typeof renderInv==='function')renderInv();window.openSimilarMedicinesAllDepartments()};

function bindTools(){ensureStatusFilter();ensureInventoryHeaderTools();['v16-hide-btn','v16-hide-head'].forEach(function(id){var h=E(id);if(h){h.type='button';h.onclick=window.openHide}});['v16-freeze-btn','v16-freeze-head'].forEach(function(id){var f=E(id);if(f){f.type='button';f.onclick=window.openFreeze}});if(R()==='pharmacy_staff'){['inv-dept-sel','isrch','icatf','iclsf','v16-inv-status-filter'].forEach(function(id){var n=E(id);if(n){n.style.setProperty('pointer-events','auto','important');n.style.setProperty('opacity','1','important')}})}applyInventoryStatus();if(typeof window.renderPhExpiryIntegrated==='function')window.renderPhExpiryIntegrated()}
window.bindInventoryTools=bindTools;


})();

// --- Merged from 24-inventory-name-merge-feature.js (Phase 6 consolidation) ---
(function(){
  function normMerge(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[ً-ٰٟ]/g,'').replace(/[^a-z0-9؀-ۿ]+/g,' ').replace(/\s+/g,' ').trim()}
  function canMergeNames(){return window.fsHasCapability?window.fsHasCapability('inventory.manage'):!!(window.CU&&(CU.master===true||['pharmacy','pharmacy_director','inpatient_supervisor'].indexOf(CU.role)>-1))}
  function selectedMergeNames(){
    var names=[];document.querySelectorAll('#all-inv-body .all-inv-name-check:checked').forEach(function(c){var n=c.dataset.name||'';if(n&&!names.some(function(x){return normMerge(x)===normMerge(n)}))names.push(n)});return names;
  }
  window.updateAllInventoryMergeCount=function(){var n=selectedMergeNames().length,el=document.getElementById('all-inv-merge-count');if(el)el.textContent=n+' name(s) selected'};
  window.undoLatestInventoryNameMerge=async function(){
    if(!canMergeNames())return;var history=(S.g('inventory_name_merge_history')||[]).slice();if(!history.length)return toast('No merge history available.','info');var h=history[0];if(!(await uiConfirm('Undo latest merge into "'+h.canonical+'"?')))return;
    var ids=Object.keys(h.departments||{});for(var i=0;i<ids.length;i++){await setMeds(ids[i],h.departments[ids[i]]||[]);await setExpiry(ids[i],(h.expiry||{})[ids[i]]||[])}history.shift();await S.s('inventory_name_merge_history',history);if(typeof auditAction==='function')auditAction('inventory_names_merge_undone',{mergeId:h.id,canonical:h.canonical});var am=document.getElementById('all-inv-modal');if(am)am.remove();toast('Latest name merge undone.','succ');openAllDepartmentsInventory();
  };
})();


// --- Merged from 45-asdh-final-department-controlled-fix-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function escF(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nF(v){var n=Number(v);return isFinite(n)?n:0}
function normF(v){return String(v==null?'':v).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim().replace(/\s+/g,' ')}
function roleF(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function deptNameF(id){var d=(typeof window.gd==='function'?(gd()||[]):[]).find(function(x){return String(x.id)===String(id)});return d&&d.name?d.name:String(id||'')}
function currentDeptF(){return roleF()==='department'?String((CU&&CU.deptId)||''):(typeof window.ctlCurrentDept==='function'?String(ctlCurrentDept()||''):'')}

/* Stop the old workbook seed from creating duplicate departments such as MMW. */
window.seed=async function(){
  var depts=typeof window.gd==='function'?(gd()||[]):[];
  if(!depts.length){depts=[{id:'icu',name:'ICU',created:typeof nowISO==='function'?nowISO():new Date().toISOString()},{id:'ed',name:'Emergency Dept',created:typeof nowISO==='function'?nowISO():new Date().toISOString()}];await S.s('departments',depts)}
  var jobs=[];depts.forEach(function(d){var key='controlled_settings_'+d.id;if(!S.g(key))jobs.push(S.s(key,{custodyOfficer:'',departmentSupervisor:'',pharmacyManager:'صيدلي / عظيمان غنام القحطاني'}))});
  if(jobs.length)await Promise.all(jobs);return true
};

var SEED_ALIASES={
  'NICU':['nicu','neonatal intensive care unit','neonatal icu','newborn intensive care unit','العناية المركزة لحديثي الولادة','العناية المركزة للمواليد'],
 'Emergency':['emergency','emergency dept','emergency department','ed','er'],
 'ICU':['icu','intensive care','intensive care unit'],
 'ANESTHESIA':['anesthesia','anaesthesia','anesthesiology','operating room anesthesia'],
 'MMW':['male medical','male medical ward','mmw'],
 'MSW':['male surgical','male surgical ward','msw'],
 'FMW':['female medical','female medical ward','fmw'],
 'CCU':['ccu','coronary care','coronary care unit','cardiac care','cardiac care unit'],
 'FSW':['female surgical','female surgical ward','fsw'],
 'OBW':['obw','obstetric ward','obstetrics ward','maternity ward','ob gyn ward'],
 'PEDIA':['pedia','pediatric','pediatrics','pediatric ward','paediatric','paediatrics'],
 'Nursery':['nursery','neonatal nursery'],
 'ENDOSCOPY UNIT':['endoscopy','endoscopy unit'],
 'AKU':['aku','artificial kidney unit','dialysis unit','hemodialysis unit'],
 'HOME CARE':['home care','homecare']
};
function resolveSeedDeptF(label,depts,excludeId){
  var aliases=(SEED_ALIASES[label]||[label]).map(normF),candidates=(depts||[]).filter(function(d){return String(d.id)!==String(excludeId||'')&&aliases.indexOf(normF(d.name))>=0});
  if(candidates.length===1)return candidates[0];
  if(candidates.length>1){
    candidates.sort(function(a,b){return deptDataScoreF(b.id)-deptDataScoreF(a.id)});return candidates[0]
  }
  return null
}
function deptDataScoreF(id){
  var score=0;
  try{score+=(S.g('meds_'+id)||[]).length*4}catch(e){}
  try{score+=(S.g('expiry_'+id)||[]).length*2}catch(e){}
  try{score+=(S.g('shelves_'+id)||[]).length}catch(e){}
  try{score+=(typeof crashCarts==='function'?(crashCarts()||[]):[]).filter(function(c){return String(c.deptId)===String(id)}).length*12}catch(e){}
  try{score+=(S.g('requests')||[]).filter(function(r){return String(r.deptId)===String(id)}).length*3}catch(e){}
  try{score+=(S.g('users')||[]).filter(function(u){return String(u.deptId)===String(id)}).length*15}catch(e){}
  return score
}
function mergeUniqueF(a,b,keyFn){var out=(Array.isArray(a)?a:[]).slice(),seen={};out.forEach(function(x){seen[keyFn(x)]=1});(Array.isArray(b)?b:[]).forEach(function(x){var k=keyFn(x);if(!seen[k]){seen[k]=1;out.push(x)}});return out}
async function moveStateKeyF(prefix,fromId,toId,kind){
  var fromKey=prefix+fromId,toKey=prefix+toId,from=S.g(fromKey),to=S.g(toKey);
  if(from==null)return;
  var merged=to;
  if(Array.isArray(from)){
    if(kind==='meds')merged=mergeUniqueF(to,from,function(x){return normF((x&&x.name)||'')+'|'+String((x&&x.id)||'')});
    else if(kind==='controlled')merged=mergeUniqueF(to,from,function(x){return String((x&&x.medId)||'')});
    else merged=mergeUniqueF(to,from,function(x){return String((x&&x.id)||'')+'|'+normF((x&&x.name)||'')});
  }else if(typeof from==='object')merged=Object.assign({},from,to||{});
  else if(to==null)merged=from;
  if(merged!=null)await S.s(toKey,merged);
  try{await S.rm(fromKey)}catch(e){}
}
async function repairImportedDepartmentAliasesF(){
  if(!window.S||!S.ready||typeof window.gd!=='function')return false;
  var depts=(gd()||[]).slice(),changed=false;
  for(var label in SEED_ALIASES){
    var synthetic=depts.find(function(d){return normF(d.name)===normF(label)});
    if(!synthetic)continue;
    var canonical=resolveSeedDeptF(label,depts,synthetic.id);
    if(!canonical)continue;
    /* Keep the human department record and migrate any accidental data from the abbreviation. */
    await moveStateKeyF('meds_',synthetic.id,canonical.id,'meds');
    await moveStateKeyF('expiry_',synthetic.id,canonical.id,'generic');
    await moveStateKeyF('shelves_',synthetic.id,canonical.id,'generic');
    await moveStateKeyF('alerts_',synthetic.id,canonical.id,'generic');
    await moveStateKeyF('controlled_dept_list_',synthetic.id,canonical.id,'controlled');
    await moveStateKeyF('controlled_settings_',synthetic.id,canonical.id,'settings');
    var carts=typeof crashCarts==='function'?(crashCarts()||[]).slice():[],cartChanged=false;
    carts.forEach(function(c){if(String(c.deptId)===String(synthetic.id)){c.deptId=canonical.id;cartChanged=true}});if(cartChanged&&typeof setCrashCarts==='function')await setCrashCarts(carts);
    var requests=(S.g('requests')||[]).slice(),reqChanged=false;requests.forEach(function(r){if(String(r.deptId)===String(synthetic.id)){r.deptId=canonical.id;reqChanged=true}});if(reqChanged)await S.s('requests',requests);
    var notes=(S.g('notes')||[]).slice(),noteChanged=false;notes.forEach(function(r){if(String(r.deptId)===String(synthetic.id)){r.deptId=canonical.id;noteChanged=true}});if(noteChanged)await S.s('notes',notes);
    depts=depts.filter(function(d){return String(d.id)!==String(synthetic.id)});changed=true
  }
  if(changed){await S.s('departments',depts);S.cache.departments=depts}
  return changed
}

/* Ensure the controlled workbook maps into existing hospital departments and never creates new abbreviations. */
var ctlSeedStartedF=false;
window.ctlEnsureDepartmentSeed=async function(){
  if(ctlSeedStartedF||!window.S||!S.ready||!window.CU)return;
  if(S.g('controlled_department_seed_v2'))return;
  var canSeed=(typeof ctlIsMaster==='function'&&ctlIsMaster())||(typeof ctlIsOfficer==='function'&&ctlIsOfficer());if(!canSeed)return;
  ctlSeedStartedF=true;
  try{
    var depts=(gd()||[]).slice(),cat=typeof ctlCatalog==='function'?(ctlCatalog()||[]).map(function(m){return Object.assign({},m)}):[],jobs=[],catChanged=false;
    [].forEach(function(label){
      var dept=resolveSeedDeptF(label,depts,'');if(!dept)return;
      if(typeof ctlDeptList==='function'&&ctlDeptList(dept.id).length)return;
      var list=[];[].forEach(function(r){
        var med=cat.find(function(m){return (r.moh&&m.moh===r.moh)||normF(m.name)===normF(r.name)});
        if(!med){med={id:(typeof ctlKey==='function'?ctlKey(r.moh,'',r.name):('ctl_'+Date.now()+'_'+Math.random().toString(36).slice(2,6))),moh:r.moh||'',nupco:'',name:r.name,classification:'narcotic',highAlert:false,lasa:false,refrigerated:false,min:r.min||0,max:r.max||0};cat.push(med);catChanged=true}
        list.push({medId:med.id,min:r.min||0,max:r.max||0,requiredQty:r.max||0,qty:r.qty||0,actualQty:r.qty||0,batches:(r.expiries||[]).map(function(d){return {qty:0,expiry:d,lot:''}})})
      });
      if(typeof ctlSetDeptList==='function')jobs.push(ctlSetDeptList(dept.id,list))
    });
    if(catChanged&&typeof ctlSetCatalog==='function')jobs.push(ctlSetCatalog(cat));
    if(jobs.length)await Promise.all(jobs);
    await S.s('controlled_department_seed_v2',true);return true
  }catch(e){console.error('Controlled department seed failed:',e);ctlSeedStartedF=false;return false}
};

/* Run once after the canonical state load; the login flow invokes this explicitly. */
window.repairImportedDepartmentAliases=repairImportedDepartmentAliasesF;

/* One exact custody print generator shared by the officer and the department employee. */
function fmtDateF(v){if(!v)return '—';try{if(typeof ctlFmtDMY==='function')return ctlFmtDMY(v);var d=new Date(String(v).slice(0,10)+'T00:00:00');return isNaN(d.getTime())?String(v):String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()}catch(e){return String(v)}}
function batchLinesF(batches){var a=Array.isArray(batches)?batches:[];return a.length?a.map(function(b){return (b.qty!=null&&b.qty!==''?escF(nF(b.qty))+' → ':'')+escF(fmtDateF(b.expiry))+(b.lot?' — '+escF(b.lot):'')}).join('<br>'):'—'}
function codeModeF(dept,override){var s=typeof ctlPrintSettings==='function'?(ctlPrintSettings(dept)||{}):{},m=String(override||s.printCodeMode||'nupco');return ['none','moh','nupco','both'].indexOf(m)>=0?m:'nupco'}


function cleanupDepartmentPrintUiF(){
  var host=E('ctl-departments-view');if(!host)return;var old=E('ctl-dept-authoritative-print-btn');
  if(roleF()!=='department'){if(old)old.remove();return}
  ['aa-final-rules-btn-dept'].forEach(function(id){var x=E(id);if(x)x.remove()});
  host.querySelectorAll('button').forEach(function(b){var t=(b.textContent||'').toLowerCase(),oc=String(b.getAttribute('onclick')||'');if(b.id==='ctl-dept-authoritative-print-btn')return;if(t.indexOf('print')>=0||t.indexOf('طباعة')>=0||/PrintNames|OpenPublic|ctlChooseLogo/.test(oc))b.remove()});
  var bar=host.querySelector('.ch .fl')||host.querySelector('.ch');if(!bar)return;var btn=E('ctl-dept-authoritative-print-btn');if(!btn){btn=document.createElement('button');btn.id='ctl-dept-authoritative-print-btn';btn.type='button';btn.className='btn bp bsm';btn.textContent='🖨 Print department custody / طباعة عهدة القسم';btn.onclick=function(ev){return window.ctlConfirmDepartmentPrint(ev)};bar.appendChild(btn)}
}

/* Correct the expiry editor: read the actual .v13x-batch rows shown in the modal. */
function readBatchesFinalF(){var h=E('v13x-stock-batches');if(!h)return [];return Array.from(h.querySelectorAll('.v13x-batch,.v13x-batch-row,.batch-editor-row')).map(function(r){var q=r.querySelector('.v13x-bqty,.v13x-bq,.be-qty,input[type="number"]'),d=r.querySelector('.v13x-bdate,.v13x-be,.be-exp,input[type="date"]'),l=r.querySelector('.v13x-blot,.v13x-bl,.be-lot,input[placeholder*="lot" i],input[placeholder*="batch" i]');return {qty:nF(q&&q.value),expiry:String((d&&d.value)||'').trim(),lot:String((l&&l.value)||'').trim()}}).filter(function(b){return b.qty||b.expiry||b.lot})}
function validateBatchesFinalF(actual,batches){if(actual<0)return {error:'Actual quantity cannot be negative / الكمية الفعلية لا يمكن أن تكون سالبة'};if(actual===0)return {batches:[]};if(!batches.length)return {error:'At least one expiry date is required when quantity is positive. Batch/Lot is optional / تاريخ الانتهاء مطلوب للكمية الموجبة، ورقم التشغيلة اختياري'};if(batches.length===1&&batches[0].expiry&&!(batches[0].qty>0))batches[0].qty=actual;for(var i=0;i<batches.length;i++){if(!(batches[i].qty>0))return {error:'Every expiry row requires a quantity greater than zero / كل تاريخ يحتاج كمية أكبر من صفر'};if(!batches[i].expiry)return {error:'Expiry date is required for every entered quantity; Batch/Lot remains optional / التاريخ مطلوب لكل كمية ورقم التشغيلة اختياري'}}var total=batches.reduce(function(a,b){return a+nF(b.qty)},0);if(total!==actual)return {error:'Expiry quantities must equal the actual quantity. Total: '+total+' / Actual: '+actual};return {batches:batches}}
window.v13XSaveStock=async function(){var status=E('v13x-stock-save-status');function state(m,c){if(status){status.textContent=m||'';status.className=c||''}}var id=(E('v13x-stock-id')||{}).value||'',scope=(E('v13x-stock-scope')||{}).value||'',qty=nF((E('v13x-stock-qty')||{}).value),required=nF((E('v13x-stock-required')||{}).value),check=validateBatchesFinalF(qty,readBatchesFinalF());if(check.error){state(check.error,'err');if(window.toast)toast(check.error,'err');return false}state('Saving… / جاري الحفظ','saving');try{if(scope==='pharmacy'){var ph=Object.assign({},ctlPharmacy()),px=Object.assign({},ph[id]||{});px.qty=qty;px.actualQty=qty;px.batches=check.batches;ph[id]=px;await ctlSetPharmacy(ph)}else{var dept=typeof ctlCurrentDept==='function'?ctlCurrentDept():'';if(!dept)throw new Error('Select a department first / اختر القسم أولاً');var list=(ctlDeptList(dept)||[]).slice(),ix=list.findIndex(function(x){return String(x.medId)===String(id)});if(ix<0)throw new Error('Medicine not found in department custody / العلاج غير موجود في عهدة القسم');list[ix]=Object.assign({},list[ix],{qty:qty,actualQty:qty,requiredQty:required,batches:check.batches});await ctlSetDeptList(dept,list);}state('Saved ✓ / تم الحفظ','succ');if(typeof v13XClose==='function')v13XClose('v13x-stock-modal');else if(typeof CM==='function')CM('v13x-stock-modal');if(typeof renderControlled==='function')renderControlled();return true}catch(e){console.error(e);state(String(e&&e.message||e),'err');if(window.toast)toast(String(e&&e.message||e),'err');return false}};
function prepareStockModalF(){var modal=E('v13x-stock-modal');if(!modal)return;modal.querySelectorAll('.v13x-batch input,.v13x-batch-row input,.batch-editor-row input').forEach(function(x){x.required=false});var host=E('v13x-stock-batches'),note=E('v13aq-expiry-summary');if(!note&&host){note=document.createElement('div');note.id='v13aq-expiry-summary';note.className='alert-banner-y';host.parentNode.insertBefore(note,host)}if(note)note.innerHTML='<b>Lot/Batch is optional.</b> Expiry is required only when actual quantity is greater than zero.';var st=E('v13x-stock-save-status');if(!st){st=document.createElement('div');st.id='v13x-stock-save-status';var actions=modal.querySelector('.modal .fl.g8');if(actions)actions.parentNode.insertBefore(st,actions)}}
window.ctlEditDeptMedicine=function(id){
  if(typeof ctlCanEditDept==='function'&&!ctlCanEditDept()){
    return toast('No permission to edit inpatient controlled custody.','err');
  }
  if(typeof window.openControlledDepartmentStockEditor!=='function'){
    console.error('Controlled department stock editor is unavailable.');
    return toast('The department medicine editor could not be opened.','err');
  }
  window.openControlledDepartmentStockEditor(id);
  prepareStockModalF();
  return true;
};

/* Clear every old role class before rebuilding the application. */
var ROLE_CLASSES_F=['role-pharmacy','role-inpatient_supervisor','role-pharmacy_staff','role-controlled_pharmacy','role-warehouse','role-department'];
function clearRoleUiF(){ROLE_CLASSES_F.forEach(function(c){document.body.classList.remove(c)});document.querySelectorAll('.pg').forEach(function(p){p.style.removeProperty('display')});document.querySelectorAll('.modal-bg.on').forEach(function(m){m.classList.remove('on')})}
window.prepareRoleUiStart=function(){clearRoleUiF();window.CTL_VIEW=roleF()==='department'?'departments':'overview'};
window.finalizeRoleUiStart=function(){cleanupDepartmentPrintUiF()};


window.cleanupDepartmentPrintUi=cleanupDepartmentPrintUiF;

/* Clear stale department filters after the repaired list is loaded. */
function resetInvalidDeptSelectorsF(){var ids=(gd()||[]).map(function(d){return String(d.id)});['inv-dept-sel','ccx-dept','ctl-dept'].forEach(function(id){var s=E(id);if(s&&s.value&&ids.indexOf(String(s.value))<0)s.value=''})}
window.floorstockResetInvalidDepartmentSelectors=resetInvalidDeptSelectorsF;
window.floorstockDepartmentAliases=SEED_ALIASES;
})();


// --- Merged from 53-r661-authoritative-inventory-safety.js (Phase 6 consolidation) ---
(function(){
'use strict';
var VERSION='R6.76.50',SNAPSHOT_LIMIT=10,saving={},bulkDepth=0,startFingerprint=null,lastSafetyError='';
function clone(v){return JSON.parse(JSON.stringify(v==null?null:v))}
function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function actor(){return (window.CU&&(CU.username||CU.email))||'Unknown'}
function now(){return new Date().toISOString()}
function hash(value){var text=JSON.stringify(value),h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function medsRaw(deptId){var value=window.S&&S.g?S.g('meds_'+deptId):null;return Array.isArray(value)?value:[]}
function expiryRaw(deptId){var value=window.S&&S.g?S.g('expiry_'+deptId):null;return Array.isArray(value)?value:[]}
function deptName(deptId){var d=(typeof gd==='function'?(gd()||[]):[]).find(function(x){return String(x.id)===String(deptId)});return d?d.name:String(deptId)}
function totalAndHash(){
  var rows=[];(typeof gd==='function'?(gd()||[]):[]).forEach(function(d){medsRaw(d.id).forEach(function(m){rows.push([String(d.id),String(m.id||m.medId||''),String(m.name||'')])})});
  rows.sort(function(a,b){return a.join('|').localeCompare(b.join('|'))});return {count:rows.length,hash:hash(rows)}
}
function setSafety(message,error){
  var bar=document.getElementById('r661-inventory-safety');
  if(!bar){if(error&&message!==lastSafetyError){lastSafetyError=message;if(typeof toast==='function')toast(message,'err')}else if(!error)console.info(message);return}
  var text=bar.querySelector('.r661-text');if(text)text.textContent=message;
  bar.classList.toggle('is-error',!!error)
}
function validateInventoryRows(rows){
  if(!Array.isArray(rows))throw new Error('Inventory write rejected: medication list must be an array.');
  var ids={},names={};
  rows.forEach(function(m,index){
    if(!m||!String(m.name||'').trim())throw new Error('Inventory write rejected: missing medication name at row '+(index+1)+'.');
    var id=String(m.id||m.medId||'');if(!id)throw new Error('Inventory write rejected: missing permanent medication ID for “'+m.name+'”.');
    if(ids[id])throw new Error('Inventory write rejected: duplicate medication ID '+id+'.');ids[id]=1;
    var name=norm(m.name);if(names[name])throw new Error('Inventory write rejected: duplicate exact name “'+m.name+'”.');names[name]=1
  });
}
async function snapshot(deptId,before,reason){
  if(!window.S||!S.ready)return null;
  var stamp=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),base='inventory_snapshot_'+String(deptId)+'_'+stamp;
  var meta={id:base,at:now(),deptId:String(deptId),deptName:deptName(deptId),actor:actor(),reason:reason||'inventory_change',medCount:before.length,expiryCount:expiryRaw(deptId).length,medHash:hash(before),medsKey:base+'_meds',expiryKey:base+'_expiry'};
  await S.s(meta.medsKey,clone(before));
  await S.s(meta.expiryKey,clone(expiryRaw(deptId)));
  var indexKey='inventory_snapshot_index_'+String(deptId),index=clone(S.g(indexKey)||[]);index.unshift(meta);
  var expired=index.slice(SNAPSHOT_LIMIT);index=index.slice(0,SNAPSHOT_LIMIT);await S.s(indexKey,index);
  expired.forEach(function(old){[old.medsKey,old.expiryKey].forEach(function(key){if(key)S.rm(key).catch(function(e){console.warn('Old inventory snapshot cleanup skipped',key,e)})})});
  return meta
}
function normalizeExplicit(rows){
  return typeof fsR17NormalizeMeds==='function'?fsR17NormalizeMeds(rows).rows:clone(rows)
}
/* Reads are pure. Opening a page or logging in never writes medication data. */
var getMeds=function(deptId){return clone(medsRaw(deptId))};
window.getMeds=getMeds;
/* One authoritative write gateway for every inventory mutation. */
var authoritativeSetMeds=async function(deptId,rows){
  deptId=String(deptId||'');if(!deptId)throw new Error('Inventory write rejected: department is required.');
  if(saving[deptId])throw new Error('Another inventory save is already running for '+deptName(deptId)+'.');
  var before=clone(medsRaw(deptId)),next=normalizeExplicit(rows);validateInventoryRows(next);
  var delta=Math.abs(next.length-before.length),limit=Math.max(1,Math.ceil(Math.max(before.length,1)*0.05));
  if(delta>limit&&bulkDepth<=0)throw new Error('Safety block: this operation changes '+delta+' records in '+deptName(deptId)+' (limit '+limit+'). Use an approved exact bulk operation.');
  saving[deptId]=true;
  try{
    var reason=bulkDepth>0?'approved_exact_bulk_change':'explicit_inventory_change',snap=await snapshot(deptId,before,reason);
    await S.s('meds_'+deptId,next);
    var integrity={at:now(),deptId:deptId,count:next.length,hash:hash(next),actor:actor(),snapshotId:snap&&snap.id||''};
    try{await S.s('inventory_integrity_'+deptId,integrity)}catch(metadataError){console.warn('Inventory data was saved, but integrity metadata could not be updated.',metadataError);if(typeof toast==='function')toast('Inventory saved; protection metadata will retry on the next change.','info')}
    if(typeof auditAction==='function')auditAction('inventory_write_committed',{deptId:deptId,department:deptName(deptId),beforeCount:before.length,afterCount:next.length,beforeHash:hash(before),afterHash:integrity.hash,snapshotId:integrity.snapshotId,reason:reason});
    setSafety(VERSION+' protected · '+totalAndHash().count+' medications · last save: '+deptName(deptId),false);
    return true
  }catch(error){
    setSafety(VERSION+' BLOCKED/FAILED · '+deptName(deptId)+' · '+String(error&&error.message||error),true);throw error
  }finally{delete saving[deptId]}
};
window.inventorySafetySetMeds=authoritativeSetMeds;
window.setMeds=authoritativeSetMeds;
window.inventorySafetyApprovedBulk=async function(label,fn){
  if(typeof fn!=='function')throw new Error('Approved bulk operation is invalid.');
  bulkDepth++;try{return await fn()}finally{bulkDepth=Math.max(0,bulkDepth-1)}
};
function wrapApproved(name){
  var original=window[name];if(typeof original!=='function'||original.__r661)return;
  var wrapped=async function(){var self=this,args=arguments;return window.inventorySafetyApprovedBulk(name,function(){return original.apply(self,args)})};wrapped.__r661=true;window[name]=wrapped
}
['confirmMergeInventoryNames','deleteSelected'].forEach(wrapApproved);
function escSafe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function masterAllowed(){
  if(window.MASTER_EFFECTIVE)return false;
  var profile=window.MASTER_ACTUAL||window.CU,role=String(profile&&profile.role||'');
  return !!(profile&&profile.master===true&&(role==='pharmacy'||role==='pharmacy_director'))
}
function removeSnapshotManager(){
  ['r662-snapshot-card','r663-dashboard-snapshot-card','r662-snapshot-modal'].forEach(function(id){var node=document.getElementById(id);if(node)node.remove()})
}
function ensureSnapshotManager(){
  if(!masterAllowed()){removeSnapshotManager();return}
  var backupPage=document.getElementById('pg-backup-restore'),dashboard=document.getElementById('pg-dash');
  if(backupPage&&!document.getElementById('r662-snapshot-card')){
    var card=document.createElement('div');card.className='card';card.id='r662-snapshot-card';
    card.innerHTML='<div class="ch"><div><span class="ct">🛡 Inventory Safety Snapshots / لقطات حماية المخزون</span><div class="fhint">Firebase snapshots created automatically before each explicit inventory change. Last '+SNAPSHOT_LIMIT+' snapshots are retained per department.</div></div><button type="button" class="btn bp r663-open-snapshots">Open snapshots / فتح اللقطات</button></div>';
    backupPage.appendChild(card)
  }
  if(dashboard&&!document.getElementById('r663-dashboard-snapshot-card')){
    var dashCard=document.createElement('div');dashCard.className='card';dashCard.id='r663-dashboard-snapshot-card';
    dashCard.innerHTML='<div class="ch"><div><span class="ct">🛡 Inventory Protection / حماية المخزون</span><div class="fhint">Master-only access to the last '+SNAPSHOT_LIMIT+' pre-change snapshots for every department.</div></div><button type="button" class="btn bp r663-open-snapshots">Inventory Safety Snapshots</button></div>';
    dashboard.insertBefore(dashCard,dashboard.firstChild)
  }
  document.querySelectorAll('.r663-open-snapshots').forEach(function(button){button.onclick=window.openInventorySafetySnapshots})
}
function snapshotDepartments(){
  return (typeof gd==='function'?(gd()||[]):[]).map(function(d){var list=clone(S.g('inventory_snapshot_index_'+d.id)||[]);return {id:String(d.id),name:d.name||d.id,list:list}}).filter(function(d){return d.list.length})
}
function renderSnapshotChoices(){
  var deptId=String((document.getElementById('r662-snapshot-dept')||{}).value||''),host=document.getElementById('r662-snapshot-list'),dept=snapshotDepartments().find(function(d){return d.id===deptId});
  if(!host)return;
  host.innerHTML=dept&&dept.list.length?dept.list.map(function(item,index){
    return '<label style="display:flex;align-items:flex-start;gap:9px;border:1px solid var(--bd);border-radius:8px;padding:9px;margin-bottom:7px"><input type="radio" name="r662-snapshot-choice" value="'+escSafe(item.id)+'" '+(index===0?'checked':'')+' style="width:auto;margin-top:3px"><span><b>'+escSafe(new Date(item.at).toLocaleString())+'</b><small style="display:block;color:var(--tx2);margin-top:3px">'+escSafe(item.medCount)+' medications · '+escSafe(item.expiryCount)+' expiry records · '+escSafe(item.actor||'Unknown')+'</small><small style="display:block;color:var(--tx2)">'+escSafe(item.reason||'inventory change')+'</small></span></label>'
  }).join(''):'<div class="fhint">No snapshots for this department.</div>'
}
window.openInventorySafetySnapshots=function(){
  if(!masterAllowed())return typeof toast==='function'?toast('Master permission required.','err'):false;
  var depts=snapshotDepartments(),old=document.getElementById('r662-snapshot-modal');if(old)old.remove();
  var html='<div class="modal-bg on" id="r662-snapshot-modal"><div class="modal" style="width:min(720px,96vw)"><div class="mh"><div><div class="mt">Inventory Safety Snapshots</div><div class="fhint">Choose a department and an exact pre-change snapshot. Restoring also creates a new snapshot of the current state.</div></div><button type="button" class="xbtn" data-close>×</button></div>';
  if(!depts.length)html+='<div class="alert-banner-y">No inventory snapshots exist yet. A snapshot is created automatically before the next inventory change.</div>';
  else html+='<label>Department / القسم<select id="r662-snapshot-dept">'+depts.map(function(d){return '<option value="'+escSafe(d.id)+'">'+escSafe(d.name)+' — '+d.list.length+' snapshot(s)</option>'}).join('')+'</select></label><div id="r662-snapshot-list" style="max-height:360px;overflow:auto;margin-top:10px"></div>';
  html+='<div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn bg" data-close>Close</button>'+(depts.length?'<button type="button" class="btn bd2c" id="r662-restore-snapshot">Restore selected snapshot</button>':'')+'</div></div></div>';
  document.body.insertAdjacentHTML('beforeend',html);var modal=document.getElementById('r662-snapshot-modal');
  modal.addEventListener('click',function(e){if(e.target===modal||e.target.closest('[data-close]'))modal.remove()});
  var select=document.getElementById('r662-snapshot-dept');if(select){select.onchange=renderSnapshotChoices;renderSnapshotChoices()}
  var restore=document.getElementById('r662-restore-snapshot');if(restore)restore.onclick=window.restoreSelectedInventorySafetySnapshot;
  return true
};
window.restoreSelectedInventorySafetySnapshot=async function(){
  if(!masterAllowed())return false;
  var deptId=String((document.getElementById('r662-snapshot-dept')||{}).value||''),choice=document.querySelector('input[name="r662-snapshot-choice"]:checked'),list=clone(S.g('inventory_snapshot_index_'+deptId)||[]),item=choice&&list.find(function(x){return String(x.id)===String(choice.value)});
  if(!item)return typeof toast==='function'?toast('Choose a snapshot first.','err'):false;
  var meds=clone(S.g(item.medsKey)||[]),expiry=clone(S.g(item.expiryKey)||[]);
  var yes=typeof uiConfirm==='function'?await uiConfirm('Restore '+deptName(deptId)+' to '+new Date(item.at).toLocaleString()+'?\\n\\nCurrent medications: '+medsRaw(deptId).length+'\\nSnapshot medications: '+meds.length+'\\n\\nA safety snapshot of the current state will be created first.'):window.confirm('Restore selected inventory snapshot?');
  if(!yes)return false;
  var button=document.getElementById('r662-restore-snapshot');if(button){button.disabled=true;button.textContent='Restoring…'}
  try{
    await window.inventorySafetyApprovedBulk('master_snapshot_restore',function(){return setMeds(deptId,meds)});
    if(typeof setExpiry==='function')await setExpiry(deptId,expiry);
    if(typeof auditAction==='function')auditAction('inventory_snapshot_restored',{deptId:deptId,snapshotId:item.id,snapshotAt:item.at,medCount:meds.length,expiryCount:expiry.length});
    var modal=document.getElementById('r662-snapshot-modal');if(modal)modal.remove();
    if(typeof renderInv==='function')renderInv();if(typeof toast==='function')toast('Inventory snapshot restored ✓','succ');return true
  }catch(error){console.error(error);if(typeof toast==='function')toast('Snapshot restore failed: '+String(error&&error.message||error),'err');return false}
  finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Restore selected snapshot'}}
};
window.undoLatestInventorySafetySnapshot=async function(){
  if(!masterAllowed())return typeof toast==='function'?toast('Master permission required.','err'):false;
  var deptId=typeof getInvDept==='function'?String(getInvDept()||''):'',index=deptId?clone(S.g('inventory_snapshot_index_'+deptId)||[]):[];
  if(!deptId||!index.length)return typeof toast==='function'?toast('No inventory safety snapshot is available for this department.','info'):false;
  var item=index[0],meds=clone(S.g(item.medsKey)||[]),expiry=clone(S.g(item.expiryKey)||[]);
  var yes=typeof uiConfirm==='function'?await uiConfirm('Restore '+deptName(deptId)+' to '+new Date(item.at).toLocaleString()+'?\\nMedication records: '+meds.length):window.confirm('Restore latest inventory snapshot?');
  if(!yes)return false;
  await window.inventorySafetyApprovedBulk('undo_snapshot',function(){return setMeds(deptId,meds)});
  if(typeof setExpiry==='function')await setExpiry(deptId,expiry);
  if(typeof renderInv==='function')renderInv();
  if(typeof toast==='function')toast('Department inventory snapshot restored ✓','succ');return true
};
/* No login-time inventory mutation is permitted. */
window.seed=async function(){return {status:'disabled-on-login'}};
window.repairImportedDepartmentAliases=async function(){return {status:'disabled-on-login'}};
window.fsR17MigrateMedicationIdentity=async function(){return {status:'disabled-on-login'}};
window.repairLatestInventoryMergeCollateral=async function(){return {status:'removed-in-r661'}};
function disableUnsafeMergeButtons(){
  document.querySelectorAll('.sim-manual-merge-btn,.sim-merge-btn').forEach(function(b){b.disabled=true;b.classList.add('r661-merge-disabled');b.title='Disabled by R6.76.50 inventory safety. Use exact selected-name merge with preview.'})
}
function showSafety(){
  if(!window.CU)return;
  var f=totalAndHash();console.info(VERSION+' protected · '+f.count+' medications · fingerprint '+f.hash);disableUnsafeMergeButtons();ensureSnapshotManager()
}
function verifyStartup(){
  var current=totalAndHash();
  if(startFingerprint&&(current.count!==startFingerprint.count||current.hash!==startFingerprint.hash)){
    setSafety(VERSION+' ALERT: inventory changed during startup ('+startFingerprint.count+' → '+current.count+'). No automatic save was authorized.',true);
    if(typeof auditAction==='function')auditAction('inventory_startup_integrity_alert',{before:startFingerprint,after:current})
  }
}
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){
  var result=previousStart.apply(this,arguments);

  setTimeout(function(){
    if(window.S&&S.ready){
      startFingerprint=totalAndHash();
      showSafety();
      setTimeout(verifyStartup,2600);
    }
  },0);

  return result;
};
new MutationObserver(function(mutations){
  var relevant=mutations.some(function(m){return Array.from(m.addedNodes||[]).some(function(node){return node.nodeType===1&&(node.matches&&node.matches('.sim-manual-merge-btn,.sim-merge-btn,#similar-medicines-modal-v2')||node.querySelector&&node.querySelector('.sim-manual-merge-btn,.sim-merge-btn'))})});
  if(relevant)disableUnsafeMergeButtons()
}).observe(document.body,{childList:true,subtree:true});
document.title='ASDHealth FloorStock R6.76.50 SaaS Protected';
})();

export {};

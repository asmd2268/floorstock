(function(){
'use strict';
var ccxSearchTimer=null;
var CCX_CATALOG=[
 {generic:'Adenosine',concentration:'6mg/2ml',aliases:['adenosine']},
 {generic:'Adrenaline (Epinephrine)',concentration:'1mg/1ml',aliases:['adrenaline','epinephrine']},
 {generic:'Amiodarone',concentration:'150mg/3ml',aliases:['amiodarone']},
 {generic:'Atropine',concentration:'0.5mg/ml',aliases:['atropine']},
 {generic:'Calcium Chloride 10%',concentration:'1g/10ml',aliases:['calciumchloride']},
 {generic:'Calcium Gluconate 10%',concentration:'1g/10ml',aliases:['calciumgluconate']},
 {generic:'Dextrose 50%',concentration:'25g/50ml',aliases:['dextrose','glucose50']},
 {generic:'Dobutamine',concentration:'250mg/5ml',aliases:['dobutamine']},
 {generic:'Dopamine',concentration:'200/5ml',aliases:['dopamine']},
 {generic:'Lidocaine 2%',concentration:'100mg/5ml',aliases:['lidocaine','lignocaine']},
 {generic:'Magnesium Sulfate 10%',concentration:'2g/20ml',aliases:['magnesiumsulfate','magnesiumsulphate']},
 {generic:'Naloxone',concentration:'0.4mg/ml',aliases:['naloxone']},
 {generic:'Norepinephrine 1:1,000',concentration:'4mg/ml',aliases:['norepinephrine','noradrenaline','noradranaline']},
 {generic:'Procainamide',concentration:'1 g/10ml',aliases:['procainamide']},
 {generic:'Sodium Bicarbonate 8.4%',concentration:'4.2g/50ml',aliases:['sodiumbicarbonate']},
 {generic:'Sodium Bicarbonate',concentration:'4.2g/10ml',aliases:['sodiumbicarbonate']}
];
var CCX_ORDER={};CCX_CATALOG.forEach(function(x,i){CCX_ORDER[x.generic]=i});
var E=window.fsE;
var escx=window.fsEsc;
function numx(v){var n=Number(v);return isFinite(n)?n:0}
function norm(v){return window.fsMedNorm?window.fsMedNorm(v):String(v||'').toLowerCase().trim()}
function actor(){return window.fsActor?window.fsActor():{name:'Unknown',user:'Unknown',id:''}}
function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
function canonicalMedication(itemOrName,strengthValue){
 var item=(itemOrName&&typeof itemOrName==='object')?itemOrName:{name:itemOrName,strength:strengthValue,concentration:strengthValue};
 var name=String(item.name||item.genericName||'').trim(),strength=String(item.strength||item.concentration||strengthValue||'').trim();
 if(item.identityLocked===true)return {generic:name||'Unknown',concentration:strength};
 var raw=norm(name+' '+strength),nameRaw=norm(name),strengthRaw=norm(strength);
 var compactName=nameRaw.replace(/\s+/g,'');
 if(compactName.indexOf('calciumchloride10%')===0)return {generic:'Calcium Chloride 10%',concentration:strength||'1g/10ml'};
 if(compactName.indexOf('calciumgluconate10%')===0)return {generic:'Calcium Gluconate 10%',concentration:strength||'1g/10ml'};
 if(compactName.indexOf('magnesiumsulfate10%')===0||compactName.indexOf('magnesiumsulphate10%')===0)return {generic:'Magnesium Sulfate 10%',concentration:strength||'2g/20ml'};
 if(/norepinephrine|noradrenaline|noradranaline/.test(raw)||((/adrenaline|epinephrine/.test(raw))&&strengthRaw.indexOf('4mgml')>=0))return {generic:'Norepinephrine 1:1,000',concentration:'4mg/ml'};
 if(nameRaw.indexOf(norm('Sodium Bicarbonate'))>=0){
   if(strengthRaw.indexOf(norm('4.2g/50ml'))>=0||nameRaw.indexOf(norm('8.4%'))>=0)return {generic:'Sodium Bicarbonate 8.4%',concentration:'4.2g/50ml'};
   if(strengthRaw.indexOf(norm('4.2g/10ml'))>=0)return {generic:'Sodium Bicarbonate',concentration:'4.2g/10ml'};
 }
 var found=null;
 CCX_CATALOG.some(function(x){
   var catalogName=norm(x.generic),catalogCompact=catalogName.replace(/\s+/g,'');
   var exact=nameRaw===catalogName||compactName===catalogCompact;
   var alias=x.aliases.some(function(a){var aliasNorm=norm(a),aliasCompact=aliasNorm.replace(/\s+/g,'');return nameRaw===aliasNorm||nameRaw.indexOf(aliasNorm)===0||compactName===aliasCompact||compactName.indexOf(aliasCompact)===0});
   if(exact||alias){found=x;return true}return false
 });
 if(found)return {generic:found.generic,concentration:strength||found.concentration||''};
 return {generic:name||'Unknown',concentration:strength};
}
window.fsCrashCanonicalMedication=canonicalMedication;
function meta(item){return canonicalMedication(item)}
function rules(){var x={};try{x=(typeof S!=='undefined'&&S.g)?(S.g('pharmacy_department_expiry_rules')||{}):{}}catch(e){}var urgent=Math.max(1,numx(x.urgentDays||7)),near=Math.max(urgent+1,numx(x.nearDays||30));return {urgentDays:urgent,nearDays:near}}
function daysUntil(v){return window.fsDaysUntil?window.fsDaysUntil(v):null}
function batchLevel(b){var d=daysUntil(b&&b.expiry),r=rules();if(d===null)return 'missing';if(d<0)return'expired';if(d<=r.urgentDays)return'urgent';if(d<=r.nearDays)return'near';return'normal'}
var RANK={expired:5,urgent:4,near:3,missing:2,normal:1};
function itemLevel(item){var bs=(item&&item.batches)||[];if(!bs.length)return'missing';var level='normal';bs.forEach(function(b){var l=batchLevel(b);if(RANK[l]>RANK[level])level=l});return level}
function cartLevel(cart){var xs=(cart&&cart.items)||[];if(!xs.length)return'missing';var level='normal';xs.forEach(function(it){var l=itemLevel(it);if(RANK[l]>RANK[level])level=l});return level}
function levelLabel(l){return {expired:'Expired / منتهي',urgent:'Urgent / عاجل',near:'Near expiry / قريب',normal:'Normal / طبيعي',missing:'Missing expiry / بدون تاريخ'}[l]||l}
function fmt(v){try{return typeof fmtDate==='function'?fmtDate(v):String(v||'—')}catch(e){return String(v||'—')}}
function canManage(){return window.fsCanManageCrashCart?window.fsCanManageCrashCart():(typeof canManageCrashCart==='function'&&canManageCrashCart())}
function canEditContents(){return typeof window.isMaster==='function'&&window.isMaster()}
function isDepartmentRole(){return !!window.CU&&(['department','department_employee'].indexOf(String(CU.role||''))>=0||typeof window.fsEffectiveRole==='function'&&window.fsEffectiveRole()==='department')}
function isDepartment(){return isDepartmentRole()}
function ensureUI(){var pg=E('pg-crashcart'),alerts=E('crash-open-alerts'),list=E('crash-list');if(!pg||!alerts||!list)return false;
 var head=pg.querySelector('.fl.ic.jb.mb14');
 if(head&&!E('ccx-filters')){var bar=document.createElement('div');bar.id='ccx-filters';bar.className='ccx-toolbar';bar.innerHTML='<select id="ccx-dept"><option value="">All departments / كل الأقسام</option></select><select id="ccx-state"><option value="">All carts / كل العربات</option><option value="open">Open report / يوجد بلاغ</option><option value="closed">No open report / بدون بلاغ مفتوح</option></select><select id="ccx-expiry"><option value="">All expiry levels / جميع حالات الانتهاء</option><option value="expired">Expired / منتهي</option><option value="urgent">Urgent / عاجل</option><option value="near">Near expiry / قريب الانتهاء</option><option value="normal">Normal / طبيعي</option><option value="missing">Missing expiry / بدون تاريخ</option></select><input id="ccx-search" placeholder="Search cart or medicine / بحث..."><button class="btn bg bsm" id="ccx-rules" type="button">⚙ Expiry rules</button>'+((typeof window.isMaster==='function'&&window.isMaster())?'<button class="btn bg bsm" id="ccx-min-seal" type="button">🔒 Min seal length</button>':'');head.insertAdjacentElement('afterend',bar);if(E('ccx-min-seal'))E('ccx-min-seal').onclick=window.ccSetMinSealLength;
 ['ccx-dept','ccx-state','ccx-expiry'].forEach(function(id){E(id).addEventListener('change',function(){window.renderCrashCarts()})});E('ccx-search').addEventListener('input',function(){clearTimeout(ccxSearchTimer);ccxSearchTimer=setTimeout(function(){window.renderCrashCarts()},120)});E('ccx-rules').onclick=window.ccxEditRules;
 }
 var dsel=E('ccx-dept');if(dsel){var current=dsel.value;var opts='<option value="">All departments / كل الأقسام</option>'+((typeof gd==='function'?gd():[])||[]).map(function(d){return '<option value="'+escx(d.id)+'">'+escx(d.name)+'</option>'}).join('');if(dsel.innerHTML!==opts)dsel.innerHTML=opts;if(isDepartment()){dsel.value=CU.deptId||'';dsel.disabled=true}else{dsel.disabled=false;if(current)dsel.value=current}}
 if(E('ccx-rules'))E('ccx-rules').style.display=ccxCanEditRules()?'inline-flex':'none';
 var modal=E('mcc-close');if(modal&&!E('ccx-close-actor')){var host=modal.querySelector('.cc-report-meta');if(host){var a=document.createElement('div');a.id='ccx-close-actor';host.insertAdjacentElement('afterend',a)}}
 return true}
function ccxCanEditRules(){return window.fsHasCapability?window.fsHasCapability('crashCart.configure'):!!(window.CU&&(CU.role==='inpatient_supervisor'||CU.role==='pharmacy'||CU.master===true))}
function ccxCloseRulesModal(){var m=E('ccx-rules-modal');if(m)m.remove()}
function ccxRulePreview(){var u=Math.floor(Number((E('ccx-rule-urgent')||{}).value)),n=Math.floor(Number((E('ccx-rule-near')||{}).value));var a=E('ccx-preview-urgent'),b=E('ccx-preview-near'),e=E('ccx-rules-error');if(a)a.textContent=isFinite(u)&&u>=1?'0–'+u+' days':'—';if(b)b.textContent=isFinite(u)&&isFinite(n)&&n>u?(u+1)+'–'+n+' days':'—';if(e)e.classList.remove('on')}
window.ccxEditRules=function(){if(!ccxCanEditRules())return;ccxCloseRulesModal();var r=rules(),a=actor();var html='<div class="modal-bg on" id="ccx-rules-modal" role="dialog" aria-modal="true" aria-labelledby="ccx-rules-title"><div class="modal ccx-rules-dialog"><div class="ccx-rules-hero"><div class="ccx-rules-hero-top"><div class="ccx-rules-heading"><div class="ccx-rules-icon">⏳</div><div><h3 id="ccx-rules-title">Expiry Rules / قواعد انتهاء الصلاحية</h3><p>حدد الفترات مرة واحدة لتطبيقها على مخزون الأقسام وعربات الطوارئ.</p></div></div><button class="xbtn" type="button" id="ccx-rules-x" aria-label="Close">×</button></div></div><div class="ccx-rules-body"><div class="ccx-rule-grid"><div class="ccx-rule-field urgent"><label for="ccx-rule-urgent">Urgent threshold / حد العاجل</label><input id="ccx-rule-urgent" type="number" min="1" max="3650" step="1" value="'+escx(r.urgentDays)+'"><div class="fhint">من اليوم وحتى هذا العدد من الأيام يظهر باللون البرتقالي.</div></div><div class="ccx-rule-field near"><label for="ccx-rule-near">Near-expiry threshold / حد قريب الانتهاء</label><input id="ccx-rule-near" type="number" min="2" max="3650" step="1" value="'+escx(r.nearDays)+'"><div class="fhint">يجب أن يكون أكبر من حد العاجل، ويظهر باللون الأصفر.</div></div></div><div class="ccx-rules-preview"><div class="ccx-rules-preview-title">Live preview / معاينة القواعد</div><div class="ccx-rules-preview-grid"><div class="ccx-rule-preview expired"><b>Expired / منتهي</b><span>قبل تاريخ اليوم</span></div><div class="ccx-rule-preview urgent"><b>Urgent / عاجل</b><span id="ccx-preview-urgent">0–'+escx(r.urgentDays)+' days</span></div><div class="ccx-rule-preview near"><b>Near / قريب</b><span id="ccx-preview-near">'+escx(r.urgentDays+1)+'–'+escx(r.nearDays)+' days</span></div><div class="ccx-rule-preview normal"><b>Normal / طبيعي</b><span>أكثر من حد القريب</span></div></div></div><div class="ccx-rules-error" id="ccx-rules-error"></div><div class="fhint">Last editor / آخر مستخدم: '+escx(a.name)+' · '+escx(a.user)+'</div></div><div class="ccx-rules-footer"><span class="ccx-rules-status" id="ccx-rules-status"></span><button class="btn bg" type="button" id="ccx-rules-cancel">Cancel / إلغاء</button><button class="btn bp" type="button" id="ccx-rules-save">Save rules / حفظ القواعد</button></div></div></div>';document.body.insertAdjacentHTML('beforeend',html);var m=E('ccx-rules-modal');E('ccx-rules-x').onclick=ccxCloseRulesModal;E('ccx-rules-cancel').onclick=ccxCloseRulesModal;E('ccx-rules-save').onclick=window.ccxSaveRules;['ccx-rule-urgent','ccx-rule-near'].forEach(function(id){E(id).addEventListener('input',ccxRulePreview)});m.addEventListener('click',function(ev){if(ev.target===m)ccxCloseRulesModal()});m.addEventListener('keydown',function(ev){if(ev.key==='Escape')ccxCloseRulesModal()});var x=E('ccx-rule-urgent');if(x){x.focus();x.select()}};
window.ccxSaveRules=async function(){
  if(!ccxCanEditRules())return;
  var u=Math.floor(Number((E('ccx-rule-urgent')||{}).value)),n=Math.floor(Number((E('ccx-rule-near')||{}).value)),err=E('ccx-rules-error'),status=E('ccx-rules-status'),save=E('ccx-rules-save'),cancel=E('ccx-rules-cancel');
  function fail(msg){if(err){err.textContent=msg;err.classList.add('on')}if(status)status.textContent=''}
  if(!isFinite(u)||!isFinite(n)||u<1||n<=u||n>3650)return fail('حد قريب الانتهاء يجب أن يكون أكبر من حد العاجل، والقيم يجب أن تكون أرقامًا صحيحة. / Near-expiry days must be greater than urgent days.');
  if(err)err.classList.remove('on');if(save){save.disabled=true;save.textContent='Saving... / جاري الحفظ'}if(cancel)cancel.disabled=true;if(status)status.textContent='Saving expiry rules securely...';
  try{
    await S.s('pharmacy_department_expiry_rules',{urgentDays:u,nearDays:n,updatedAt:typeof nowISO==='function'?nowISO():new Date().toISOString(),updatedBy:typeof actualActorName==='function'?actualActorName():actor().user});
    if(typeof auditAction==='function')auditAction('pharmacy_department_expiry_rules_edit',{urgentDays:u,nearDays:n});
    ccxCloseRulesModal();
    var active=document.querySelector('.pg.on');
    if(active&&active.id==='pg-crashcart'&&typeof window.renderCrashCarts==='function')window.renderCrashCarts();
    if(active&&active.id==='pg-inv'&&typeof window.renderPhExpiryIntegrated==='function')window.renderPhExpiryIntegrated();
    if(typeof toast==='function')toast('Expiry rules saved ✓','succ')
  }catch(ex){fail('تعذر حفظ القواعد: '+String((ex&&ex.message)||ex||'Unknown error')+'\nExpiry rules could not be saved: '+String((ex&&ex.message)||ex||'Unknown error'));if(save){save.disabled=false;save.textContent='Save rules / حفظ القواعد'}if(cancel)cancel.disabled=false}
};
function isPharmacy(){return typeof window.fsHasCapability==='function'?window.fsHasCapability('crashCart.operate'):(function(){var r=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String(window.CU&&CU.role||'');return ['master','pharmacy','pharmacy_supervisor','inpatient_supervisor','inpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(r)>=0})()}
function reportCard(r,c){
  var isPending=r.status==='pending';
  var badge=isPending?'<span style="background:var(--or,#e67e22);color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;margin-left:6px">بانتظار الموافقة / Pending</span>':'';
  var canOperate=isPharmacy();
  var actions=isPending&&canOperate
    ?'<div style="display:flex;gap:6px;margin-top:8px"><button class="btn bg bsm" onclick="ccAcceptReport(\''+escx(r.id)+'\')">✔ قبول / Accept</button><button class="btn bd2c bsm" onclick="ccRejectReport(\''+escx(r.id)+'\')">✖ رفض / Reject</button></div>'
    :isPending?'':'<div style="margin-top:8px"><span class="btn bd2c bsm" onclick="ccxOpenReport(\''+escx(r.id)+'\')">Open and respond / فتح والرد</span></div>';
  return '<div class="ccx-alert-card"><div class="ccx-alert-title">⚠ '+escx(deptName(r.deptId))+' — '+escx((c&&c.name)||'Crash Cart')+badge+'</div><div class="fhint">'+escx(r.reason||'Opening report')+'</div><div class="fhint">'+escx(r.openedBy||'')+' · '+escx(fmt(r.openedAt))+'</div>'+actions+'</div>'
}
window.ccxOpenReport=function(reportId){var r=(typeof crashReports==='function'?crashReports():[]).find(function(x){return String(x.id)===String(reportId)});if(!r)return;var c=typeof crashCart==='function'?crashCart(r.cartId):null;if(E('ccx-dept')&&!isDepartment())E('ccx-dept').value=r.deptId||'';if(E('ccx-state'))E('ccx-state').value='open';if(E('ccx-search'))E('ccx-search').value='';window.renderCrashCarts();var card=E('ccx-cart-'+r.cartId);if(card)card.scrollIntoView({behavior:'smooth',block:'start'});if(canManage()&&r.status==='open'&&typeof crashCloseReport==='function')crashCloseReport(r.id);/* pending reports are handled via ccAcceptReport/ccRejectReport, not crashCloseReport */};
function latestClosedReport(cartId){return (typeof crashReports==='function'?crashReports():[]).filter(function(r){return String(r.cartId)===String(cartId)&&r.status==='closed'}).sort(function(a,b){return String(b.closedAt||b.lastEditedAt||'').localeCompare(String(a.closedAt||a.lastEditedAt||''))})[0]||null}
function renderSummary(carts,reports){var totalItems=0,expired=0,urgent=0,near=0;carts.forEach(function(c){(c.items||[]).forEach(function(i){totalItems++;var l=itemLevel(i);if(l==='expired')expired++;else if(l==='urgent')urgent++;else if(l==='near')near++})});return '<div class="ccx-summary"><div class="sc"><div class="sl">Carts / العربات</div><div class="sv">'+carts.length+'</div></div><div class="sc"><div class="sl">Open reports / البلاغات</div><div class="sv">'+reports.length+'</div></div><div class="sc"><div class="sl">Expired / منتهي</div><div class="sv">'+expired+'</div></div><div class="sc"><div class="sl">Urgent / عاجل</div><div class="sv">'+urgent+'</div></div><div class="sc"><div class="sl">Near expiry / قريب</div><div class="sv">'+near+'</div></div></div>'}
function itemRow(it,i){var m=meta(it),l=itemLevel(it),standard=numx(it.qty),present=it.present!=null?numx(it.present):numx(it.qty),stockOut=present<=0,short=!stockOut&&standard>0&&present<standard,bs=(it.batches||[]).slice().sort(function(a,b){return String(a.expiry||'').localeCompare(String(b.expiry||''))});var exp=bs.length?bs.map(function(b){var bl=batchLevel(b);return '<span><span class="ccx-level-badge ccx-level-'+bl+'">'+escx(fmt(b.expiry))+'</span> → '+escx(b.qty==null?'—':b.qty)+'</span>'}).join(''):'<span class="ccx-level-badge ccx-level-missing">No expiry / بدون تاريخ</span>';var status=stockOut?'<span class="ccx-level-badge ccx-stock-out">Out of stock / غير متوفر</span><div class="fhint">'+escx(levelLabel(l))+'</div>':short?'<span class="ccx-level-badge ccx-stock-short">Below standard / أقل من المعياري</span><div class="fhint">'+escx(levelLabel(l))+'</div>':'<span class="ccx-level-badge ccx-level-'+l+'">'+escx(levelLabel(l))+'</span>';return '<tr class="ccx-row-'+l+(stockOut?' ccx-row-stock-out':short?' ccx-row-stock-short':'')+'"><td>'+(i+1)+'</td><td><b>'+escx(m.generic)+'</b></td><td>'+escx(m.concentration||'—')+'</td><td>'+standard+'</td><td>'+present+'</td><td><div class="ccx-expiry-list">'+exp+'</div></td><td>'+status+'</td></tr>'}
window.renderCrashCarts=function(){function after(){[window.refreshCrashBulkUi,window.refreshCrashSupervisorBulkButton,window.refreshCrashFilteredBulkUi,window.refreshCrashOpeningLogUi,window.ensureCrashRecoveryButton,window.enhanceCrashButtons,window.refreshCrashDeletionControls].forEach(function(fn){if(typeof fn==='function')fn()});(window.__renderCrashCartsAfterExtensions||[]).forEach(function(fn){try{fn()}catch(e){console.error('renderCrashCarts extension failed',e)}})}if(!ensureUI()){after();return};var all=(typeof crashCarts==='function'?crashCarts():[])||[],reports=(typeof crashReports==='function'?crashReports():[])||[];var departmentScoped=isDepartmentRole()||(CU&&CU.role==='outpatient_pharmacy_supervisor'),scopeDept=departmentScoped?String(CU&&CU.deptId||''):'';if(departmentScoped&&all.length)window.__ccxLastScopedCarts=all.slice();else if(departmentScoped&&!all.length&&Array.isArray(window.__ccxLastScopedCarts))all=window.__ccxLastScopedCarts.slice();if(departmentScoped&&reports.length)window.__ccxLastScopedReports=reports.slice();else if(departmentScoped&&!reports.length&&Array.isArray(window.__ccxLastScopedReports))reports=window.__ccxLastScopedReports.slice();var open=reports.filter(function(r){return (r.status==='open'||r.status==='pending')&&(departmentScoped?String(r.deptId)===scopeDept:true)});var deptFilter=departmentScoped?scopeDept:String((E('ccx-dept')||{}).value||''),state=String((E('ccx-state')||{}).value||''),expiry=String((E('ccx-expiry')||{}).value||''),search=String((E('ccx-search')||{}).value||'').toLowerCase().trim();var stateScoped=departmentScoped&&CU&&CU.role==='department'&&typeof S!=='undefined'&&S.cache&&S.cache.__scopedDepartmentState===true;var carts=all.filter(function(c){if(departmentScoped&&!stateScoped&&String(c.deptId)!==scopeDept)return false;if(deptFilter&&String(c.deptId)!==deptFilter)return false;var rep=open.find(function(r){return String(r.cartId)===String(c.id)});if(state==='open'&&!rep)return false;if(state==='closed'&&rep)return false;var cl=cartLevel(c);if(expiry&&cl!==expiry&&!((c.items||[]).some(function(it){return itemLevel(it)===expiry})))return false;if(search){var hay=[c.name,c.number,c.location,deptName(c.deptId)].concat((c.items||[]).map(function(it){var m=meta(it);return m.generic+' '+m.concentration})).join(' ').toLowerCase();if(hay.indexOf(search)<0)return false}return true});
 var diag=E('pg-crashcart');if(diag){diag.dataset.crashStateSource=String((typeof S!=='undefined'&&S.transport)||'unknown');diag.dataset.crashStateRaw=String((typeof S!=='undefined'&&S.cache&&Array.isArray(S.cache.crash_carts)?S.cache.crash_carts.length:0));diag.dataset.crashStateFunction=String(all.length)}var add=E('crash-add-btn');if(add)add.style.display=canEditContents()?'inline-flex':'none';
 E('crash-open-alerts').innerHTML=open.length?'<div class="ccx-alerts-grid">'+open.map(function(r){return reportCard(r,all.find(function(c){return String(c.id)===String(r.cartId)}))}).join('')+'</div>':'';
 var html=renderSummary(carts,open)+carts.map(function(c){var rep=open.find(function(r){return String(r.cartId)===String(c.id)}),level=cartLevel(c),closed=latestClosedReport(c.id);var allItems=(c.items||[]).slice(),items=(expiry?allItems.filter(function(it){return itemLevel(it)===expiry}):allItems).sort(function(a,b){var ma=meta(a),mb=meta(b);var oa=CCX_ORDER[ma.generic],ob=CCX_ORDER[mb.generic];if(oa==null)oa=999;if(ob==null)ob=999;return oa-ob||ma.generic.localeCompare(mb.generic)});var actions='<button class="btn bg bsm" onclick="crashPrint(\''+escx(c.id)+'\')">🖨 Print</button>';if(canEditContents())actions+='<button class="btn bp bsm" onclick="crashAddItem(\''+escx(c.id)+'\')">+ Add medication</button>';if(isDepartmentRole()&&!rep)actions+='<button class="btn bd2c bsm" onclick="crashReportOpen(\''+escx(c.id)+'\')">Report opened cart</button>';if(canManage()&&rep)actions+='<button class="btn bs bsm" onclick="ccxOpenReport(\''+escx(rep.id)+'\')">Respond to report</button>';var closedMeta=(closed&&!isDepartmentRole())?'<div class="ccx-closed-meta"><b>Last closure / آخر إغلاق:</b> '+escx(closed.closedByName||closed.closedBy||'—')+' · <b>User:</b> '+escx(closed.closedByUser||'—')+' · '+escx(fmt(closed.closedAt||closed.lastEditedAt))+' · <b>Seal:</b> '+escx(closed.newSeal||c.seal||'—')+'</div>':'';return '<div id="ccx-cart-'+escx(c.id)+'" class="card ccx-cart ccx-'+level+' '+(rep?'crash-open':'')+'"><div class="ch"><div><span class="ct">'+escx(c.name||'Crash Cart')+'</span><div class="fhint">'+escx(deptName(c.deptId))+' · '+escx(c.number||'—')+' · '+escx(c.location||'—')+' · Seal '+escx(c.seal||'—')+'</div>'+(expiry?'<div class="ccx-filter-note">Filtered rows: '+escx(levelLabel(expiry))+' · '+items.length+' medication(s)</div>':'')+closedMeta+'</div><div class="ccx-toolbar-actions">'+actions+'</div></div><div class="tw"><table class="ccx-table"><thead><tr><th>#</th><th>Generic name / الاسم العلمي</th><th>Concentration / التركيز</th><th>Standard qty</th><th>Present qty</th><th>Expiry → Qty</th><th>Status</th></tr></thead><tbody>'+items.map(itemRow).join('')+'</tbody></table></div></div>'}).join('');E('crash-list').innerHTML=html||'<div class="card"><div class="cb" style="text-align:center;color:var(--tx2)">No Crash Carts match the selected filters.</div></div>';if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();window.ccxRenderDashboardAlerts();after()
  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
};
window.ccxRenderDashboardAlerts=function(){
  var host=E('exp-alerts');if(!host||!canManage())return;
  var old=E('ccx-dashboard-reports');if(old)old.remove();
  var allActive=(typeof crashReports==='function'?crashReports():[]).filter(function(r){return r.status==='open'||r.status==='pending'});
  if(!allActive.length)return;
  var pending=allActive.filter(function(r){return r.status==='pending'});
  var legacy=allActive.filter(function(r){return r.status==='open'});
  var rows=allActive.map(function(r){
    var c=typeof crashCart==='function'?crashCart(r.cartId):null;
    var isPending=r.status==='pending';
    var badge=isPending?'<span style="background:var(--or,#e67e22);color:#fff;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700;margin-left:4px">بانتظار الموافقة</span>':'';
    var btn=isPending&&isPharmacy()
      ?'<button class="btn bg bsm" onclick="ccAcceptReport(\''+escx(r.id)+'\')">✔ قبول</button> <button class="btn bd2c bsm" onclick="ccRejectReport(\''+escx(r.id)+'\')">✖ رفض</button>'
      :isPending?''
      :'<span class="btn bd2c bsm" onclick="showPg(\'pg-crashcart\');ccxOpenReport(\''+escx(r.id)+'\')">Open</span>';
    return '<div class="ccx-dashboard-report"><div><b>'+escx(deptName(r.deptId))+' — '+escx((c&&c.name)||'Crash Cart')+badge+'</b><div class="fhint">'+escx(r.reason||'Opening report')+'</div></div>'+btn+'</div>';
  }).join('');
  var box=document.createElement('div');box.id='ccx-dashboard-reports';box.className='card';
  box.innerHTML='<div class="ch"><span class="ct">🚑 Crash Cart reports / بلاغات الكراش كارت</span><span class="badge brd">'+allActive.length+(pending.length?' <span style="background:var(--or,#e67e22);color:#fff;border-radius:8px;padding:1px 5px;font-size:10px">'+pending.length+' pending</span>':'')+'</span></div><div class="cb">'+rows+'</div>';
  host.insertAdjacentElement('afterbegin',box);
};

/* The renderer above is the single source of truth.  Earlier releases wrapped
   it five times to compensate for legacy department aliases.  The wrappers
   changed CU.deptId during renders, duplicated report actions, and could make
   carts disappear on the next realtime update.  Alias resolution now happens
   once while scoped state is loaded, so no render-time mutation is needed. */




})();


// --- Merged from 23-category-management-final-v12.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  function uniq(a){return (a||[]).filter(function(v,i,x){return v&&x.indexOf(v)===i});}
  function canManageCategoryNames(){
    try{return window.fsHasCapability?window.fsHasCapability('inventory.manage'):!!(window.CU&&(CU.master===true||CU.role==='pharmacy'||CU.role==='inpatient_supervisor')||(window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true)||(typeof window.isMasterActual==='function'&&window.isMasterActual()));}catch(e){return false;}
  }
  function allCats(){
    var a=typeof getCategories==='function'?getCategories().slice():[];
    (typeof gd==='function'?gd():[]).forEach(function(d){
      (typeof getMeds==='function'?getMeds(d.id):[]).forEach(function(m){if(m&&m.category&&a.indexOf(m.category)<0)a.push(m.category);});
    });
    return uniq(a);
  }
  function isSolutionsCategory(c){return String(c||'').trim().toLowerCase()==='solutions';}
  function normalizeConfig(cfg){
    var all=allCats();cfg=cfg||{};
    var solutionName=all.find(function(c){return isSolutionsCategory(c);})||'Solutions';
    var order=uniq((cfg.order||[]).concat(all)).filter(function(c){return all.indexOf(c)>=0&&!isSolutionsCategory(c);});
    order.push(solutionName);
    /* Category hiding from New Request is managed separately. Solutions is always fixed at the bottom. */
    return {order:order,enabled:order.slice()};
  }
  function saveGlobalConfig(cfg){
    cfg=normalizeConfig(cfg);
    return S.s('pharmacy_category_config',cfg);
  }

  /* One global category order is authoritative for Pharmacy, New Request, shelves and printing. */
  window.getPharmacyCategoryConfig=function(){return normalizeConfig(S.g('pharmacy_category_config')||{});};
  window.sortDeptInventoryCategories=function(id,cats){
    var order=getPharmacyCategoryConfig().order||[];
    return (cats||[]).slice().sort(function(a,b){
      var ai=order.indexOf(a),bi=order.indexOf(b);if(ai<0)ai=999;if(bi<0)bi=999;
      return ai-bi||String(a).localeCompare(String(b));
    });
  };
  window.refreshDeptCategorySelectors=function(){
    var cfg=getPharmacyCategoryConfig(),cats=cfg.order||[];
    ['dcat','bulk-cat-sel'].forEach(function(x){
      var sel=document.getElementById(x);if(!sel)return;
      var cur=sel.value,p=x==='bulk-cat-sel'?'<option value="">Change category to...</option>':'';
      sel.innerHTML=p+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
      if(cats.indexOf(cur)>-1)sel.value=cur;
    });
  };

  function getScopeConfig(){return getPharmacyCategoryConfig();}
  function saveScopeConfig(cfg){saveGlobalConfig(cfg);return true;}
  function updateConfigsRename(oldName,newName){
    var cfg=getPharmacyCategoryConfig();
    cfg.order=cfg.order.map(function(c){return c===oldName?newName:c;});
    saveGlobalConfig(cfg);
  }
  function updateConfigsRemove(name){
    var cfg=getPharmacyCategoryConfig();
    cfg.order=cfg.order.filter(function(c){return c!==name;});
    saveGlobalConfig(cfg);
  }
  window.openManageCats=function(){
    if(!canManageCategoryNames())return toast('Category management is available only to authorized Pharmacy users and Master.','err');
    renderCatList();OM('mcat-mgr');
  };
  window.renderCatList=function(){
    var box=document.getElementById('cat-list');if(!box)return;
    var allowed=canManageCategoryNames(),ordered=getScopeConfig().order||[];
    var ctx=document.getElementById('dept-cat-context');
    if(ctx)ctx.innerHTML='<div><b>Global category order / ترتيب التصنيفات الموحد</b></div><div class="fhint" style="margin-top:6px">This exact order is saved automatically and used for Inventory, New Request, shelves and Pharmacy Print in every department. Solutions is always fixed at the bottom.</div>';
    var addWrap=document.getElementById('new-cat-inp')&&document.getElementById('new-cat-inp').parentElement;if(addWrap)addWrap.style.display=allowed?'flex':'none';
    box.innerHTML=ordered.map(function(c,i){
      var q=String(c).replace(/\\/g,'\\\\').replace(/'/g,"\\'"),locked=isSolutionsCategory(c),lastMovable=ordered.length-(ordered.some(isSolutionsCategory)?2:1);
      return '<div class="category-manage-row" style="display:grid;grid-template-columns:minmax(180px,1fr) auto auto;align-items:center;gap:8px;padding:9px 4px;border-bottom:1px solid var(--bd)" data-cat="'+esc(c)+'">'
       +'<input value="'+esc(c)+'" '+(locked?'disabled title="Solutions is fixed at the bottom"':'')+' style="margin:0;padding:7px 9px;font-weight:600" onchange="renameManagedCategory(\''+q+'\',this.value)" onkeydown="if(event.key===\'Enter\'){this.blur()}">'
       +'<div style="display:flex;gap:5px"><button type="button" class="btn bg bsm" title="Move up" '+(locked||i===0?'disabled':'')+' onclick="moveManagedCategory(\''+q+'\',-1)">↑</button><button type="button" class="btn bg bsm" title="Move down" '+(locked||i>=lastMovable?'disabled':'')+' onclick="moveManagedCategory(\''+q+'\',1)">↓</button></div>'
       +(locked?'<span class="badge bgr" title="Always last">Fixed last</span>':'<button type="button" class="btn bd2c bsm" onclick="removeManagedCategory(\''+q+'\')">Delete</button>')+'</div>';
    }).join('');
  
};
    window.renameManagedCategory=function(oldName,newValue){
    if(!canManageCategoryNames())return;
    if(isSolutionsCategory(oldName))return toast('Solutions is fixed and cannot be renamed.','info');
    var n=String(newValue||'').trim();if(!n)return renderCatList();
    var cats=allCats();if(cats.some(function(c){return c!==oldName&&c.toLowerCase()===n.toLowerCase();})){toast('Category name already exists.','err');return renderCatList();}
    var global=typeof getCategories==='function'?getCategories().slice():cats.slice();
    global=uniq(global.map(function(c){return c===oldName?n:c;}));setCategories(global);
    (typeof gd==='function'?gd():[]).forEach(function(d){
      var ms=getMeds(d.id),changed=false;ms.forEach(function(m){if(m.category===oldName){m.category=n;changed=true;}});if(changed)setMeds(d.id,ms);
    });
    updateConfigsRename(oldName,n);
    if(typeof refreshCatSelectors==='function')refreshCatSelectors();refreshDeptCategorySelectors();renderCatList();if(typeof renderInv==='function')renderInv();toast('Category renamed everywhere.','succ');
  };
  window.moveManagedCategory=function(cat,dir){
    if(isSolutionsCategory(cat))return;
    var cfg=getScopeConfig(),solution=cfg.order.find(function(c){return isSolutionsCategory(c);}),arr=cfg.order.filter(function(c){return !isSolutionsCategory(c);}),i=arr.indexOf(cat),j=i+dir;
    if(i<0||j<0||j>=arr.length)return;
    var t=arr[i];arr[i]=arr[j];arr[j]=t;if(solution)arr.push(solution);cfg.order=arr;saveScopeConfig(cfg);
    renderCatList();refreshDeptCategorySelectors();if(typeof renderInv==='function')renderInv();if(typeof renderReqForm==='function')renderReqForm();
  };
  window.removeManagedCategory=async function(name){
    if(!canManageCategoryNames())return;
    if(isSolutionsCategory(name))return toast('Solutions is fixed at the bottom and cannot be deleted.','info');
    var used=false;
    (typeof gd==='function'?gd():[]).some(function(d){return (getMeds(d.id)||[]).some(function(m){if(m.category===name){used=true;return true;}return false;});});
    if(used)return toast('Reassign medicines in this category before deleting it.','err');
    if(!await uiConfirm('Delete category "'+name+'"?'))return;
    var cats=(typeof getCategories==='function'?getCategories():[]).filter(function(c){return c!==name;});setCategories(cats);updateConfigsRemove(name);
    if(typeof refreshCatSelectors==='function')refreshCatSelectors();refreshDeptCategorySelectors();renderCatList();if(typeof renderInv==='function')renderInv();toast('Category deleted everywhere.','info');
  };
  function enforceButton(){
    var b=document.querySelector('#pg-inv button[onclick="openManageCats()"]');if(b)b.style.display=canManageCategoryNames()?'inline-flex':'none';
  }
  window.refreshCategoryManagementUi=function(){enforceButton();refreshDeptCategorySelectors();};

})();


// --- Merged from 43-similar-medicines-workbench-v2-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
var MODAL_ID='similar-medicines-modal-v2';
var state={groups:[],selected:new Set(),manualSelected:new Set(),query:'',mode:'similar'};
var SEPARATION_KEY='similar_medicine_separations_v1',separationCache=null;
var E=window.fsE;
var esc=window.fsEsc;
function norm(v){return window.fsMedNorm?window.fsMedNorm(v):String(v||'').toLowerCase().trim()}
var FORM_WORDS={tablet:1,tablets:1,tab:1,tabs:1,capsule:1,capsules:1,cap:1,caps:1,injection:1,injections:1,inj:1,ampoule:1,ampoules:1,amp:1,amps:1,vial:1,vials:1,bottle:1,bottles:1,bag:1,bags:1,solution:1,solutions:1,soln:1,suspension:1,susp:1,syrup:1,cream:1,ointment:1,drops:1,drop:1,inhaler:1,inhalers:1,nebuliser:1,nebulisers:1,nebulizer:1,nebulizers:1,nebule:1,nebules:1,suppository:1,suppositories:1,oral:1,iv:1,im:1,sc:1,infusion:1,premix:1,pack:1,packs:1,for:1,of:1,unit:1,units:1,محلول:1,محاليل:1,حقن:1,حقنة:1,امبول:1,امبولات:1,فيال:1,فيالات:1,قرص:1,اقراص:1,كبسول:1,كبسولات:1};
function tokens(v){return norm(v).split(/\s+/).filter(function(t){return t&&!FORM_WORDS[t]})}
function doseTokens(v){return tokens(v).filter(function(t){return /^\d/.test(t)||/^(mg|mcg|g|gm|ml|iu|mmol|meq)$/.test(t)})}
function ingredientTokens(v){return tokens(v).filter(function(t){return !/^\d/.test(t)&&!/^(mg|mcg|g|gm|ml|iu|mmol|meq)$/.test(t)})}
function identity(v){return tokens(v).join(' ')}
function pairKey(a,b){var p=[norm(a),norm(b)].sort();return p[0]+'||'+p[1]}
function getSeparationRules(){
 if(separationCache&&typeof separationCache==='object')return separationCache;
 try{var r=window.S&&S.g?S.g(SEPARATION_KEY):null;if(r&&typeof r==='object'&&!Array.isArray(r)){separationCache=r;return separationCache}}catch(e){}
 try{var x=JSON.parse(localStorage.getItem(SEPARATION_KEY)||'{}');separationCache=x&&typeof x==='object'&&!Array.isArray(x)?x:{};return separationCache}catch(e){separationCache={};return separationCache}
}
async function saveSeparationRules(rules){
 separationCache=rules||{};
 try{localStorage.setItem(SEPARATION_KEY,JSON.stringify(separationCache))}catch(e){}
 if(window.S&&S.s)await S.s(SEPARATION_KEY,separationCache);
}
function isManuallySeparated(a,b){return !!getSeparationRules()[pairKey(a,b)]}
async function addSeparationRules(left,right){
 var rules=copy(getSeparationRules()),actor=typeof actualActorName==='function'?actualActorName():String((window.CU&&(CU.name||CU.email))||'user'),at=new Date().toISOString();
 left.forEach(function(a){right.forEach(function(b){if(norm(a)===norm(b))return;rules[pairKey(a,b)]={a:String(a),b:String(b),createdAt:at,createdBy:actor}})});
 await saveSeparationRules(rules);
}
function sameMedicine(a,b){
 if(isManuallySeparated(a,b))return false;
 var aa=tokens(a),bb=tokens(b);if(!aa.length||!bb.length)return false;
 var da=doseTokens(a).join(' '),db=doseTokens(b).join(' ');if(da&&db&&da!==db)return false;
 if(identity(a)===identity(b))return true;
 var ia=ingredientTokens(a),ib=ingredientTokens(b),IB=new Set(ib),ingredientCommon=ia.filter(function(t){return IB.has(t)}).length;
 /* Matching strength alone is never enough: at least one medicine-name token must match. */
 if(ia.length&&ib.length&&ingredientCommon===0)return false;
 var A=new Set(aa),B=new Set(bb),common=aa.filter(function(t){return B.has(t)}).length;
 var shorter=Math.min(A.size,B.size),longer=Math.max(A.size,B.size);
 return ingredientCommon>=1&&common/shorter>=0.8&&common/longer>=0.55;
}
function getDepartments(){try{return typeof gd==='function'?(gd()||[]):[]}catch(e){return[]}}
function getDeptMeds(id){try{return typeof getMeds==='function'?(getMeds(id)||[]):[]}catch(e){return[]}}
function copy(v){return JSON.parse(JSON.stringify(v==null?null:v))}
function flags(m){return {high_alert:!!(m.high_alert||m.highAlert),hazard:!!(m.hazard||m.hazardous),lasa:!!(m.lasa||m.LASA),refrigerated:!!(m.refrigerated||m.fridge||m.cold_chain)}}
function classLabels(m){var f=flags(m),a=[];if(f.high_alert)a.push('High Alert');if(f.hazard)a.push('Hazard');if(f.lasa)a.push('LASA');if(f.refrigerated)a.push('Refrigerated');return a.length?a.join(', '):'—'}
function classSignature(m){var f=flags(m);return [f.high_alert,f.hazard,f.lasa,f.refrigerated].map(function(v){return v?'1':'0'}).join('')}
function exactNameMembers(g,name){return g.members.filter(function(r){return norm(r.med.name)===norm(name)})}
function conflictNamesFor(names,members){return names.filter(function(name){var sigs=new Set(members.filter(function(r){return norm(r.med.name)===norm(name)}).map(function(r){return classSignature(r.med)}));return sigs.size>1})}
function buildGroups(){
 var rows=[];getDepartments().forEach(function(d){getDeptMeds(d.id).forEach(function(m){if(m&&m.name)rows.push({deptId:String(d.id),deptName:d.name||d.id,med:m})})});
 var unique=Array.from(new Set(rows.map(function(r){return String(r.med.name).trim()}))).filter(Boolean);
 var parent=unique.map(function(_,i){return i});
 function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
 function union(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a}
 for(var i=0;i<unique.length;i++)for(var j=i+1;j<unique.length;j++)if(sameMedicine(unique[i],unique[j]))union(i,j);
 var buckets={};unique.forEach(function(n,i){var k=find(i);(buckets[k]||(buckets[k]=[])).push(n)});
 var groups=Object.keys(buckets).map(function(k){
  var names=buckets[k].sort(function(a,b){return a.localeCompare(b)}),nameSet=new Set(names.map(norm));
  var members=rows.filter(function(r){return nameSet.has(norm(r.med.name))});
  var id='g_'+identity(names[0]).replace(/\s+/g,'_')+'_'+k,conflictNames=conflictNamesFor(names,members);
  return {id:id,names:names,members:members,variant:names.length>1,classConflict:conflictNames.length>0,conflictNames:conflictNames,canonical:names.slice().sort(function(a,b){return b.length-a.length||a.localeCompare(b)})[0]};
 }).sort(function(a,b){return Number(b.variant)-Number(a.variant)||a.canonical.localeCompare(b.canonical)});
 return groups;
}
function allExactNames(){
 var map={};getDepartments().forEach(function(d){getDeptMeds(d.id).forEach(function(m){if(!m||!m.name)return;var k=norm(m.name);if(!k)return;if(!map[k])map[k]={key:k,name:String(m.name).trim(),members:[],departments:new Set(),categories:new Set(),classes:new Set()};var x=map[k];x.members.push({deptId:String(d.id),deptName:d.name||d.id,med:m});x.departments.add(d.name||d.id);x.categories.add(m.category||'—');x.classes.add(classLabels(m))})});
 return Object.keys(map).map(function(k){var x=map[k];return {key:x.key,name:x.name,members:x.members,departments:Array.from(x.departments),categories:Array.from(x.categories),classes:Array.from(x.classes)}}).sort(function(a,b){return a.name.localeCompare(b.name)});
}
function syncManualRecordSelection(){
 state.selected.clear();var chosen=state.manualSelected;allExactNames().forEach(function(x){if(!chosen.has(x.key))return;x.members.forEach(function(r){state.selected.add(r.deptId+'::'+r.med.id)})});
}
function selectedClassifications(){return ['high_alert','hazard','lasa','refrigerated'].filter(function(k){var x=E('sim-class-'+k);return x&&x.checked})}
function selectedRows(){var out=[];state.groups.forEach(function(g){g.members.forEach(function(r){var key=r.deptId+'::'+r.med.id;if(state.selected.has(key))out.push(r)})});return out}
function visibleGroups(){var q=norm(state.query);return state.groups.filter(function(g){var show=state.mode==='classification'?g.classConflict:(state.mode==='both'?(g.variant||g.classConflict):(state.mode==='all'?true:g.variant));if(!show)return false;if(!q)return true;return g.names.some(function(n){return norm(n).indexOf(q)>-1})||g.members.some(function(r){return norm(r.deptName).indexOf(q)>-1||norm(r.med.category).indexOf(q)>-1||norm(classLabels(r.med)).indexOf(q)>-1})})}
function displayNames(g){return state.mode==='classification'?g.conflictNames:g.names}
function displayMembers(g){var names=new Set(displayNames(g).map(norm));return g.members.filter(function(r){return names.has(norm(r.med.name))})}
function setGroupSelected(g,on){displayMembers(g).forEach(function(r){var k=r.deptId+'::'+r.med.id;if(on)state.selected.add(k);else state.selected.delete(k)})}
function updateSelectionCount(){var x=E('sim-selected-count');if(x)x.textContent=(state.mode==='manual'?state.manualSelected.size:state.selected.size)+' selected / محدد'}
function renderManualList(){
 var host=E('sim-groups');if(!host)return;var q=norm(state.query),all=allExactNames(),items=all.filter(function(x){if(!q)return true;return norm(x.name).indexOf(q)>-1||x.departments.some(function(v){return norm(v).indexOf(q)>-1})||x.categories.some(function(v){return norm(v).indexOf(q)>-1})||x.classes.some(function(v){return norm(v).indexOf(q)>-1})});
 var selected=all.filter(function(x){return state.manualSelected.has(x.key)}),canonical=selected.length?(E('sim-manual-canonical')&&E('sim-manual-canonical').value||selected[0].name):'';
 var options=selected.map(function(x){return '<option value="'+esc(x.name)+'">'}).join('');
 var toolbar='<div class="sim-manual-toolbar"><label>Canonical name / الاسم القياسي<input id="sim-manual-canonical" list="sim-manual-canonical-options" value="'+esc(canonical)+'" placeholder="Select or type the final medicine name"><datalist id="sim-manual-canonical-options">'+options+'</datalist></label><button type="button" class="btn bp sim-manual-merge-btn" '+(selected.length>=2?'':'disabled')+'>Merge '+selected.length+' selected names / دمج المحدد</button><button type="button" class="btn bg sim-manual-clear-btn" '+(selected.length?'':'disabled')+'>Clear / إلغاء التحديد</button><span class="chip">'+items.length+' of '+all.length+' names</span><div class="sim-merge-help">راجع القائمة كاملة وحدد أي اسمين أو أكثر حتى لو لم يعتبرهما النظام متشابهين. الدمج يطبّق على جميع الأقسام ويحافظ على كل قسم مستقلًا.</div></div>';
 var rows=items.map(function(x){var on=state.manualSelected.has(x.key);return '<div class="sim-manual-item '+(on?'sim-manual-selected':'')+'"><label class="sim-manual-name"><input type="checkbox" class="sim-manual-name-check" data-key="'+esc(x.key)+'" '+(on?'checked':'')+'><span><b>'+esc(x.name)+'</b><small>'+x.members.length+' record(s) · '+x.departments.length+' department(s)</small></span></label><div><small>Departments / الأقسام</small><b>'+esc(x.departments.join(', '))+'</b></div><div><small>Category / التصنيف</small><b>'+esc(x.categories.join(', '))+'</b></div><div class="sim-manual-summary">'+esc(x.classes.join(' · '))+'</div></div>'}).join('');
 host.innerHTML=toolbar+(rows?'<div class="sim-manual-list">'+rows+'</div>':'<div class="sim-empty">No medicines match the search / لا توجد نتائج</div>');updateSelectionCount();
}
function renderGroups(){
 var host=E('sim-groups');if(!host)return;if(state.mode==='manual'){renderManualList();return}var groups=visibleGroups();
 if(!groups.length){host.innerHTML='<div class="sim-empty">لا توجد مجموعات متشابهة حاليًا.<br>No similar medicine groups remain.</div>';updateSelectionCount();return}
 host.innerHTML=groups.map(function(g){
  var shownNames=displayNames(g),shownMembers=displayMembers(g),allSelected=shownMembers.length&&shownMembers.every(function(r){return state.selected.has(r.deptId+'::'+r.med.id)});
  var variants=shownNames.map(function(n){
   var members=exactNameMembers(g,n),depts=Array.from(new Set(members.map(function(r){return r.deptName}))).join(', '),cats=Array.from(new Set(members.map(function(r){return r.med.category||'—'}))).join(', '),classes=Array.from(new Set(members.map(function(r){return classLabels(r.med)}))),conflict=classes.length>1,all=members.length&&members.every(function(r){return state.selected.has(r.deptId+'::'+r.med.id)}),deptClasses=Array.from(new Set(members.map(function(r){return r.deptName+': '+classLabels(r.med)}))).join(' · ');
   var separated=g.names.some(function(other){return norm(other)!==norm(n)&&isManuallySeparated(n,other)});
   return '<div class="sim-variant-row '+(conflict?'has-class-conflict':'')+'"><label class="sim-variant-select"><input type="checkbox" class="sim-variant-check" data-group="'+esc(g.id)+'" data-name="'+esc(n)+'" '+(all?'checked':'')+'><span><b>'+esc(n)+'</b><small>'+esc(depts)+' · '+esc(cats)+'</small><small>'+esc(deptClasses)+'</small>'+(conflict?'<span class="badge sim-conflict-badge">Classification mismatch / اختلاف التصنيف</span>':'')+(separated?'<span class="sim-manual-rule">✓ Manually kept separate / مفصول يدويًا</span>':'')+'</span></label><button type="button" class="btn bg bxs sim-separate-btn" data-group="'+esc(g.id)+'" data-name="'+esc(n)+'">Not the same / علاج مختلف</button></div>';
  }).join('');
  var merge=g.variant&&state.mode!=='classification'?'<div class="sim-merge-row"><label>Canonical name / الاسم القياسي<select class="sim-canonical" data-group="'+esc(g.id)+'">'+g.names.map(function(n){return '<option value="'+esc(n)+'" '+(n===g.canonical?'selected':'')+'>'+esc(n)+'</option>'}).join('')+'</select></label><button type="button" class="btn bp bsm sim-merge-btn" data-group="'+esc(g.id)+'">Merge selected names / دمج الأسماء المحددة</button><div class="sim-merge-help">حدد فقط الأسماء التي تمثل نفس العلاج. أي اسم غير محدد سيبقى علاجًا مستقلاً، وسيحفظ النظام قرار الفصل حتى لا يجمعه تلقائيًا مرة أخرى.</div></div>':'';
  var badges=(g.variant?'<span class="chip">Name variants / اختلاف الاسم</span>':'')+(g.classConflict?'<span class="badge sim-conflict-badge">Different classifications / تصنيفات مختلفة</span>':'');
  return '<section class="sim-group '+(g.variant?'is-variant ':'')+(g.classConflict?'is-class-conflict':'')+'"><div class="sim-group-head"><label><input type="checkbox" class="sim-group-check" data-group="'+esc(g.id)+'" '+(allSelected?'checked':'')+'><strong>'+esc(g.canonical)+'</strong></label><div class="fl ic g8">'+badges+'<span class="chip">'+shownNames.length+' names · '+shownMembers.length+' records</span></div></div><div class="sim-variants">'+variants+'</div>'+merge+'</section>';
 }).join('');
 updateSelectionCount();
}
function renderModal(){
 var old=E(MODAL_ID);if(old)old.remove();
 separationCache=null;state.groups=buildGroups();state.selected.clear();state.manualSelected.clear();state.query='';state.mode='similar';
 var html='<div class="modal-bg on" id="'+MODAL_ID+'"><div class="modal sim-modal"><div class="mh"><div><div class="mt">Similar medicines across all departments / الأدوية المتشابهة في جميع الأقسام</div><div class="fhint">حدد الأسماء المتطابقة فعليًا فقط. تشابه الجرعة وحده لا يعني أن العلاج واحد، ويمكن فصل أي اسم خاطئ من نفس الصفحة.</div></div><button type="button" class="xbtn" id="sim-close">×</button></div>'+ 
 '<div class="sim-class-toolbar"><div class="sim-class-title">Bulk Classification / تعديل التصنيف بالجملة</div><div class="fhint" style="margin-bottom:7px">التصنيفات المختارة تستبدل التصنيفات الحالية لكل الأدوية المحددة، ثم يتم الحفظ مرة واحدة.</div><div class="sim-class-options"><label><input type="checkbox" id="sim-class-high_alert"> High Alert</label><label><input type="checkbox" id="sim-class-hazard"> Hazard</label><label><input type="checkbox" id="sim-class-lasa"> LASA</label><label><input type="checkbox" id="sim-class-refrigerated"> Refrigerated</label></div><div class="sim-class-actions"><button type="button" class="btn bs" id="sim-save-class">Save classifications / حفظ التصنيفات</button><button type="button" class="btn bg" id="sim-clear-selection">Clear selection</button><span class="chip" id="sim-selected-count">0 selected / محدد</span></div></div>'+ 
 '<div class="sim-filterbar"><div class="sbr"><span class="sic">🔎</span><input id="sim-search" placeholder="Search medicine, department, category or classification..." style="margin:0"></div><select id="sim-mode-filter" class="sim-mode-filter"><option value="similar">Similar names / أسماء متشابهة</option><option value="classification">Same name with different classification / نفس الاسم وتصنيف مختلف</option><option value="both">Both issues / كل التعارضات</option><option value="all">All medicines for classification / جميع الأدوية</option><option value="manual">Full medication list — manual merge / القائمة الكاملة — دمج يدوي</option></select></div><div id="sim-message" class="fhint"></div><div id="sim-groups" class="sim-groups"></div></div></div>';
 document.body.insertAdjacentHTML('beforeend',html);renderGroups();
 E('sim-close').onclick=function(){E(MODAL_ID).remove()};
 E(MODAL_ID).onclick=function(e){if(e.target===this)this.remove()};
 E('sim-search').oninput=function(){state.query=this.value;renderGroups()};
 E('sim-mode-filter').onchange=function(){state.mode=this.value||'similar';state.selected.clear();state.manualSelected.clear();renderGroups()};
 E('sim-clear-selection').onclick=function(){state.selected.clear();state.manualSelected.clear();renderGroups()};
 E('sim-save-class').onclick=saveClassifications;
 E('sim-groups').addEventListener('change',function(e){var t=e.target;if(t.classList.contains('sim-manual-name-check')){if(t.checked)state.manualSelected.add(t.dataset.key);else state.manualSelected.delete(t.dataset.key);syncManualRecordSelection();renderManualList()}else if(t.classList.contains('sim-group-check')){var g=state.groups.find(function(x){return x.id===t.dataset.group});if(g)setGroupSelected(g,t.checked);renderGroups()}else if(t.classList.contains('sim-variant-check')){var g2=state.groups.find(function(x){return x.id===t.dataset.group});if(g2)g2.members.filter(function(r){return norm(r.med.name)===norm(t.dataset.name)}).forEach(function(r){var k=r.deptId+'::'+r.med.id;if(t.checked)state.selected.add(k);else state.selected.delete(k)});renderGroups()}});
 E('sim-groups').addEventListener('click',function(e){var mm=e.target.closest('.sim-manual-merge-btn');if(mm){manualMergeSelected();return}var mc=e.target.closest('.sim-manual-clear-btn');if(mc){state.manualSelected.clear();state.selected.clear();renderManualList();return}var s=e.target.closest('.sim-separate-btn');if(s){separateNameFromGroup(s.dataset.group,s.dataset.name);return}var b=e.target.closest('.sim-merge-btn');if(b)mergeGroup(b.dataset.group)});
}
async function separateNameFromGroup(groupId,name){
 var g=state.groups.find(function(x){return x.id===groupId});if(!g)return;var others=g.names.filter(function(n){return norm(n)!==norm(name)});if(!others.length)return;
 var question='Keep “'+name+'” as a different medicine from the other '+others.length+' name(s)? / هل تريد إبقاء هذا الاسم كعلاج مختلف ومستقل؟';
 var ok=typeof uiConfirm==='function'?await uiConfirm(question):window.confirm(question);if(!ok)return;
 await addSeparationRules([name],others);state.selected.clear();state.groups=buildGroups();renderGroups();var msg=E('sim-message');if(msg)msg.textContent='Kept “'+name+'” as a separate medicine. The system will remember this decision. / تم فصل العلاج وحفظ القرار.';if(typeof toast==='function')toast('Medicine kept separate ✓','succ');
}
async function saveClassifications(){
 var rows=selectedRows();if(!rows.length){return typeof toast==='function'?toast('Select at least one medicine.','err'):null}
 var chosen=selectedClassifications(),byDept={};rows.forEach(function(r){(byDept[r.deptId]||(byDept[r.deptId]=new Set())).add(String(r.med.id))});
 var changed=0;for(var deptId in byDept){var ids=byDept[deptId],meds=getDeptMeds(deptId).map(function(m){if(!ids.has(String(m.id)))return m;var n=Object.assign({},m);['high_alert','hazard','lasa','refrigerated'].forEach(function(k){n[k]=chosen.indexOf(k)>-1});changed++;return n});await setMeds(deptId,meds)}
 state.selected.clear();state.groups=buildGroups();renderGroups();var msg=E('sim-message');if(msg)msg.textContent='Saved '+changed+' record(s) / تم حفظ '+changed+' سجل';if(typeof toast==='function')toast('Classifications saved for '+changed+' record(s).','succ')
}
function mergeRecordSet(records,canonical){
 var preferred=records.find(function(m){return norm(m.name)===norm(canonical)})||records[0],out=Object.assign({},preferred);out.name=canonical;
 ['high_alert','hazard','lasa','refrigerated'].forEach(function(k){out[k]=records.some(function(m){return flags(m)[k]})});
 ['min','max','monthly','currentQty'].forEach(function(k){var vals=records.map(function(m){return Number(m[k])}).filter(isFinite);if(vals.length)out[k]=Math.max.apply(null,vals)});
 if(!out.category){var c=records.find(function(m){return m.category});if(c)out.category=c.category}
 return out;
}
async function migrateRuleMap(key,names,canonical){
 if(!window.S||!S.g||!S.s)return;var map=copy(S.g(key)||{}),selected=names.map(norm),rules=[];
 Object.keys(map).forEach(function(k){var r=map[k],rn=r&&r.name?norm(r.name):'',plain=k.replace(/^(family:|identity:)/,'');if(selected.indexOf(plain)>-1||selected.indexOf(rn)>-1){rules.push(r);delete map[k]}});
 if(rules.length){var all=rules.some(function(r){return r&&(r.allDepartments===true||r.deptIds==='all')}),deps=[];rules.forEach(function(r){if(Array.isArray(r&&r.departmentIds))deps=deps.concat(r.departmentIds);if(Array.isArray(r&&r.deptIds))deps=deps.concat(r.deptIds)});deps=Array.from(new Set(deps.map(String)));var merged=Object.assign({},rules[0]||{},{name:canonical,allDepartments:all,departmentIds:all?[]:deps,deptIds:all?'all':deps});map[norm(canonical)]=merged;map['identity:'+identity(canonical)]=merged}
 await S.s(key,map)
}
async function clearSeparationRulesForNames(names){
 var normalized=new Set((names||[]).map(norm)),rules=copy(getSeparationRules()),changed=false;Object.keys(rules).forEach(function(k){var r=rules[k]||{},a=norm(r.a||k.split('||')[0]),b=norm(r.b||k.split('||')[1]);if(normalized.has(a)&&normalized.has(b)){delete rules[k];changed=true}});if(changed)await saveSeparationRules(rules)
}
async function manualMergeSelected(){
 var catalog=allExactNames(),chosen=catalog.filter(function(x){return state.manualSelected.has(x.key)}),names=chosen.map(function(x){return x.name});if(names.length<2){if(typeof toast==='function')toast('Select at least two different medicine names / حدد اسمين مختلفين على الأقل','err');return}
 var canonical=String((E('sim-manual-canonical')||{}).value||'').trim()||names[0];var msg='Merge '+names.length+' manually selected names into “'+canonical+'” across all departments? / دمج '+names.length+' أسماء محددة يدويًا تحت الاسم القياسي؟';var ok=typeof uiConfirm==='function'?await uiConfirm(msg):window.confirm(msg);if(!ok)return;
 var selectedNames=names.map(norm),changedDepartments=0,renamedRecords=0,removed=0;
 for(var di=0;di<getDepartments().length;di++){var d=getDepartments()[di],meds=getDeptMeds(d.id).slice(),matches=meds.filter(function(m){return selectedNames.indexOf(norm(m.name))>-1});if(!matches.length)continue;var merged=mergeRecordSet(matches,canonical),ids=new Set(matches.map(function(m){return String(m.id)})),survivor=matches.find(function(m){return norm(m.name)===norm(canonical)})||matches[0];merged.id=survivor.id;var inserted=false,next=[];meds.forEach(function(m){if(!ids.has(String(m.id))){next.push(m);return}renamedRecords++;if(!inserted){next.push(merged);inserted=true}else removed++});await setMeds(d.id,next);if(typeof getExpiry==='function'&&typeof setExpiry==='function'){var exp=(getExpiry(d.id)||[]).map(function(x){return ids.has(String(x.medId))?Object.assign({},x,{medId:merged.id,medName:canonical}):x});await setExpiry(d.id,exp)}changedDepartments++}
 await clearSeparationRulesForNames(names);await migrateRuleMap('medication_visibility_rules_v3',names,canonical);await migrateRuleMap('medication_freeze_rules_v3',names,canonical);await migrateRuleMap('global_request_freeze_v2',names,canonical);
 try{if(window.S&&S.s){var hist=copy(S.g('manual_medicine_merge_history_v1')||[]);hist.unshift({id:'manual_merge_'+Date.now().toString(36),names:names,canonical:canonical,departments:changedDepartments,records:renamedRecords,duplicatesRemoved:removed,createdAt:new Date().toISOString(),createdBy:typeof actualActorName==='function'?actualActorName():String((window.CU&&(CU.name||CU.email))||'user')});await S.s('manual_medicine_merge_history_v1',hist.slice(0,100))}}catch(e){console.error('Manual merge history save failed',e)}
 state.manualSelected.clear();state.selected.clear();state.groups=buildGroups();renderManualList();var status=E('sim-message');if(status)status.textContent='Manual merge completed: '+names.length+' names → '+canonical+'. / تم الدمج اليدوي بنجاح.';if(typeof toast==='function')toast('Merged '+names.length+' names across '+changedDepartments+' department(s) ✓','succ')
}
async function mergeGroup(groupId){
 var g=state.groups.find(function(x){return x.id===groupId});if(!g||!g.variant)return;
 var checked=Array.from(E(MODAL_ID).querySelectorAll('.sim-variant-check[data-group="'+groupId+'"]:checked')).map(function(x){return x.dataset.name}).filter(Boolean);
 checked=Array.from(new Set(checked));
 if(checked.length<2){if(typeof toast==='function')toast('Select at least two names to merge / حدد اسمين على الأقل للدمج','err');return}
 var sel=Array.from(E(MODAL_ID).querySelectorAll('.sim-canonical')).find(function(x){return x.dataset.group===groupId}),canonical=sel&&sel.value;
 if(checked.map(norm).indexOf(norm(canonical))<0){canonical=checked[0];if(sel)sel.value=canonical}
 var unselected=g.names.filter(function(n){return checked.map(norm).indexOf(norm(n))<0});
 var ok=typeof uiConfirm==='function'?await uiConfirm('Merge only the '+checked.length+' selected names into “'+canonical+'”? Unselected names will remain separate. / دمج الأسماء المحددة فقط؟'):window.confirm('Merge selected names into '+canonical+'?');if(!ok)return;
 var selectedNames=checked.map(norm),changed=0,removed=0;
 for(var di=0;di<getDepartments().length;di++){var d=getDepartments()[di],meds=getDeptMeds(d.id).slice(),matches=meds.filter(function(m){return selectedNames.indexOf(norm(m.name))>-1});if(!matches.length)continue;var merged=mergeRecordSet(matches,canonical),ids=new Set(matches.map(function(m){return String(m.id)})),survivor=matches.find(function(m){return norm(m.name)===norm(canonical)})||matches[0];merged.id=survivor.id;var inserted=false,next=[];meds.forEach(function(m){if(!ids.has(String(m.id))){next.push(m);return}if(!inserted){next.push(merged);inserted=true}else removed++});await setMeds(d.id,next);if(typeof getExpiry==='function'&&typeof setExpiry==='function'){var exp=(getExpiry(d.id)||[]).map(function(x){return ids.has(String(x.medId))?Object.assign({},x,{medId:merged.id,medName:canonical}):x});await setExpiry(d.id,exp)}changed++}
 if(unselected.length)await addSeparationRules(unselected,[canonical].concat(checked));
 await migrateRuleMap('medication_visibility_rules_v3',checked,canonical);await migrateRuleMap('medication_freeze_rules_v3',checked,canonical);await migrateRuleMap('global_request_freeze_v2',checked,canonical);
 state.selected.clear();state.groups=buildGroups();renderGroups();var msg=E('sim-message');if(msg)msg.textContent='Merged the selected names only. '+unselected.length+' unselected name(s) remain independent and will not be grouped again. / تم دمج المحدد فقط وإبقاء البقية مستقلة.';if(typeof toast==='function')toast('Merged selected names across '+changed+' department(s); '+removed+' duplicate record(s) removed.','succ')
}
window.openSimilarMedicinesAllDepartments=function(){if(!canManage())return typeof toast==='function'?toast('Not authorized.','err'):null;renderModal()};
(window.__showPgAfterExtensions=window.__showPgAfterExtensions||[]).push(function(id){
  if(id!=='pg-crashcart')return;
  if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
  var scoped=isDepartmentRole()||(window.CU&&CU.role==='outpatient_pharmacy_supervisor'),deptId=scoped?String((window.CU&&CU.deptId)||''):'';
  var hasOpen=(typeof crashReports==='function'?crashReports():[]).some(function(r){return (r.status==='open'||r.status==='pending')&&(!scoped||String(r.deptId)===deptId)});
  var sel=E('ccx-state');
  if(sel&&hasOpen&&sel.value!=='open'){sel.value='open';window.renderCrashCarts()}
});
})();

export {};

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
function E(id){return document.getElementById(id)}
function escx(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
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
function canEditContents(){if(window.fsHasCapability)return window.fsHasCapability('crashCart.configure');var r=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');return ['pharmacy','pharmacy_manager','inpatient_supervisor'].indexOf(r)>=0}
function isDepartmentRole(){return !!window.CU&&(['department','department_employee'].indexOf(String(CU.role||''))>=0||typeof window.fsEffectiveRole==='function'&&window.fsEffectiveRole()==='department')}
function isDepartment(){return isDepartmentRole()}
function ensureUI(){var pg=E('pg-crashcart'),alerts=E('crash-open-alerts'),list=E('crash-list');if(!pg||!alerts||!list)return false;
 var head=pg.querySelector('.fl.ic.jb.mb14');
 if(head&&!E('ccx-filters')){var bar=document.createElement('div');bar.id='ccx-filters';bar.className='ccx-toolbar';bar.innerHTML='<select id="ccx-dept"><option value="">All departments / كل الأقسام</option></select><select id="ccx-state"><option value="">All carts / كل العربات</option><option value="open">Open report / يوجد بلاغ</option><option value="closed">No open report / بدون بلاغ مفتوح</option></select><select id="ccx-expiry"><option value="">All expiry levels / جميع حالات الانتهاء</option><option value="expired">Expired / منتهي</option><option value="urgent">Urgent / عاجل</option><option value="near">Near expiry / قريب الانتهاء</option><option value="normal">Normal / طبيعي</option><option value="missing">Missing expiry / بدون تاريخ</option></select><input id="ccx-search" placeholder="Search cart or medicine / بحث..."><button class="btn bg bsm" id="ccx-rules" type="button">⚙ Expiry rules</button>';head.insertAdjacentElement('afterend',bar);
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
function reportCard(r,c){return '<div class="ccx-alert-card" onclick="ccxOpenReport(\''+escx(r.id)+'\')"><div class="ccx-alert-title">⚠ '+escx(deptName(r.deptId))+' — '+escx((c&&c.name)||'Crash Cart')+'</div><div class="fhint">'+escx(r.reason||'Opening report')+'</div><div class="fhint">'+escx(r.openedBy||'')+' · '+escx(fmt(r.openedAt))+'</div><div style="margin-top:8px"><span class="btn bd2c bsm">Open and respond / فتح والرد</span></div></div>'}
window.ccxOpenReport=function(reportId){var r=(typeof crashReports==='function'?crashReports():[]).find(function(x){return String(x.id)===String(reportId)});if(!r)return;var c=typeof crashCart==='function'?crashCart(r.cartId):null;if(E('ccx-dept')&&!isDepartment())E('ccx-dept').value=r.deptId||'';if(E('ccx-state'))E('ccx-state').value='open';if(E('ccx-search'))E('ccx-search').value='';window.renderCrashCarts();var card=E('ccx-cart-'+r.cartId);if(card)card.scrollIntoView({behavior:'smooth',block:'start'});if(canManage()&&r.status==='open'&&typeof crashCloseReport==='function')crashCloseReport(r.id)};
function latestClosedReport(cartId){return (typeof crashReports==='function'?crashReports():[]).filter(function(r){return String(r.cartId)===String(cartId)&&r.status==='closed'}).sort(function(a,b){return String(b.closedAt||b.lastEditedAt||'').localeCompare(String(a.closedAt||a.lastEditedAt||''))})[0]||null}
function renderSummary(carts,reports){var totalItems=0,expired=0,urgent=0,near=0;carts.forEach(function(c){(c.items||[]).forEach(function(i){totalItems++;var l=itemLevel(i);if(l==='expired')expired++;else if(l==='urgent')urgent++;else if(l==='near')near++})});return '<div class="ccx-summary"><div class="sc"><div class="sl">Carts / العربات</div><div class="sv">'+carts.length+'</div></div><div class="sc"><div class="sl">Open reports / البلاغات</div><div class="sv">'+reports.length+'</div></div><div class="sc"><div class="sl">Expired / منتهي</div><div class="sv">'+expired+'</div></div><div class="sc"><div class="sl">Urgent / عاجل</div><div class="sv">'+urgent+'</div></div><div class="sc"><div class="sl">Near expiry / قريب</div><div class="sv">'+near+'</div></div></div>'}
function itemRow(it,i){var m=meta(it),l=itemLevel(it),present=it.present!=null?numx(it.present):numx(it.qty),stockOut=present<=0,bs=(it.batches||[]).slice().sort(function(a,b){return String(a.expiry||'').localeCompare(String(b.expiry||''))});var exp=bs.length?bs.map(function(b){var bl=batchLevel(b);return '<span><span class="ccx-level-badge ccx-level-'+bl+'">'+escx(fmt(b.expiry))+'</span> → '+escx(b.qty==null?'—':b.qty)+'</span>'}).join(''):'<span class="ccx-level-badge ccx-level-missing">No expiry / بدون تاريخ</span>';var status=stockOut?'<span class="ccx-level-badge ccx-stock-out">Out of stock / غير متوفر</span><div class="fhint">'+escx(levelLabel(l))+'</div>':'<span class="ccx-level-badge ccx-level-'+l+'">'+escx(levelLabel(l))+'</span>';return '<tr class="ccx-row-'+l+(stockOut?' ccx-row-stock-out':'')+'"><td>'+(i+1)+'</td><td><b>'+escx(m.generic)+'</b></td><td>'+escx(m.concentration||'—')+'</td><td>'+numx(it.qty)+'</td><td>'+present+'</td><td><div class="ccx-expiry-list">'+exp+'</div></td><td>'+status+'</td></tr>'}
window.renderCrashCarts=function(){function after(){[window.refreshCrashBulkUi,window.refreshCrashSupervisorBulkButton,window.refreshCrashFilteredBulkUi,window.refreshCrashOpeningLogUi,window.ensureCrashRecoveryButton,window.enhanceCrashButtons,window.refreshCrashDeletionControls].forEach(function(fn){if(typeof fn==='function')fn()})}if(!ensureUI()){after();return};var all=(typeof crashCarts==='function'?crashCarts():[])||[],reports=(typeof crashReports==='function'?crashReports():[])||[];var departmentScoped=isDepartmentRole()||(CU&&CU.role==='outpatient_pharmacy_supervisor'),scopeDept=departmentScoped?String(CU&&CU.deptId||''):'';if(departmentScoped&&all.length)window.__ccxLastScopedCarts=all.slice();else if(departmentScoped&&!all.length&&Array.isArray(window.__ccxLastScopedCarts))all=window.__ccxLastScopedCarts.slice();if(departmentScoped&&reports.length)window.__ccxLastScopedReports=reports.slice();else if(departmentScoped&&!reports.length&&Array.isArray(window.__ccxLastScopedReports))reports=window.__ccxLastScopedReports.slice();var open=reports.filter(function(r){return r.status==='open'&&(departmentScoped?String(r.deptId)===scopeDept:true)});var deptFilter=departmentScoped?scopeDept:String((E('ccx-dept')||{}).value||''),state=String((E('ccx-state')||{}).value||''),expiry=String((E('ccx-expiry')||{}).value||''),search=String((E('ccx-search')||{}).value||'').toLowerCase().trim();var carts=all.filter(function(c){if(departmentScoped&&String(c.deptId)!==scopeDept)return false;if(deptFilter&&String(c.deptId)!==deptFilter)return false;var rep=open.find(function(r){return String(r.cartId)===String(c.id)});if(state==='open'&&!rep)return false;if(state==='closed'&&rep)return false;var cl=cartLevel(c);if(expiry&&cl!==expiry&&!((c.items||[]).some(function(it){return itemLevel(it)===expiry})))return false;if(search){var hay=[c.name,c.number,c.location,deptName(c.deptId)].concat((c.items||[]).map(function(it){var m=meta(it);return m.generic+' '+m.concentration})).join(' ').toLowerCase();if(hay.indexOf(search)<0)return false}return true});
 var diag=E('pg-crashcart');if(diag){diag.dataset.crashStateSource=String((typeof S!=='undefined'&&S.transport)||'unknown');diag.dataset.crashStateRaw=String((typeof S!=='undefined'&&S.cache&&Array.isArray(S.cache.crash_carts)?S.cache.crash_carts.length:0));diag.dataset.crashStateFunction=String(all.length)}var add=E('crash-add-btn');if(add)add.style.display=canEditContents()?'inline-flex':'none';
 E('crash-open-alerts').innerHTML=open.length?'<div class="ccx-alerts-grid">'+open.map(function(r){return reportCard(r,all.find(function(c){return String(c.id)===String(r.cartId)}))}).join('')+'</div>':'';
 var html=renderSummary(carts,open)+carts.map(function(c){var rep=open.find(function(r){return String(r.cartId)===String(c.id)}),level=cartLevel(c),closed=latestClosedReport(c.id);var allItems=(c.items||[]).slice(),items=(expiry?allItems.filter(function(it){return itemLevel(it)===expiry}):allItems).sort(function(a,b){var ma=meta(a),mb=meta(b);var oa=CCX_ORDER[ma.generic],ob=CCX_ORDER[mb.generic];if(oa==null)oa=999;if(ob==null)ob=999;return oa-ob||ma.generic.localeCompare(mb.generic)});var actions='<button class="btn bg bsm" onclick="crashPrint(\''+escx(c.id)+'\')">🖨 Print</button>';if(canEditContents())actions+='<button class="btn bp bsm" onclick="crashAddItem(\''+escx(c.id)+'\')">+ Add medication</button>';if(isDepartmentRole()&&!rep)actions+='<button class="btn bd2c bsm" onclick="crashReportOpen(\''+escx(c.id)+'\')">Report opened cart</button>';if(canManage()&&rep)actions+='<button class="btn bs bsm" onclick="ccxOpenReport(\''+escx(rep.id)+'\')">Respond to report</button>';var closedMeta=closed?'<div class="ccx-closed-meta"><b>Last closure / آخر إغلاق:</b> '+escx(closed.closedByName||closed.closedBy||'—')+' · <b>User:</b> '+escx(closed.closedByUser||'—')+' · '+escx(fmt(closed.closedAt||closed.lastEditedAt))+' · <b>Seal:</b> '+escx(closed.newSeal||c.seal||'—')+'</div>':'';return '<div id="ccx-cart-'+escx(c.id)+'" class="card ccx-cart ccx-'+level+' '+(rep?'crash-open':'')+'"><div class="ch"><div><span class="ct">'+escx(c.name||'Crash Cart')+'</span><div class="fhint">'+escx(deptName(c.deptId))+' · '+escx(c.number||'—')+' · '+escx(c.location||'—')+' · Seal '+escx(c.seal||'—')+'</div>'+(expiry?'<div class="ccx-filter-note">Filtered rows: '+escx(levelLabel(expiry))+' · '+items.length+' medication(s)</div>':'')+closedMeta+'</div><div class="ccx-toolbar-actions">'+actions+'</div></div><div class="tw"><table class="ccx-table"><thead><tr><th>#</th><th>Generic name / الاسم العلمي</th><th>Concentration / التركيز</th><th>Standard qty</th><th>Present qty</th><th>Expiry → Qty</th><th>Status</th></tr></thead><tbody>'+items.map(itemRow).join('')+'</tbody></table></div></div>'}).join('');E('crash-list').innerHTML=html||'<div class="card"><div class="cb" style="text-align:center;color:var(--tx2)">No Crash Carts match the selected filters.</div></div>';if(typeof window.ccUpdateBadges==='function')window.ccUpdateBadges();window.ccxRenderDashboardAlerts();after()
  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
};
window.ccxRenderDashboardAlerts=function(){var host=E('exp-alerts');if(!host||!canManage())return;var old=E('ccx-dashboard-reports');if(old)old.remove();var open=(typeof crashReports==='function'?crashReports():[]).filter(function(r){return r.status==='open'});if(!open.length)return;var box=document.createElement('div');box.id='ccx-dashboard-reports';box.className='card';box.innerHTML='<div class="ch"><span class="ct">🚑 Open Crash Cart reports / بلاغات الكراش كارت</span><span class="badge brd">'+open.length+'</span></div><div class="cb">'+open.map(function(r){var c=typeof crashCart==='function'?crashCart(r.cartId):null;return '<div class="ccx-dashboard-report" onclick="showPg(\'pg-crashcart\');ccxOpenReport(\''+escx(r.id)+'\')"><div><b>'+escx(deptName(r.deptId))+' — '+escx((c&&c.name)||'Crash Cart')+'</b><div class="fhint">'+escx(r.reason||'Opening report')+'</div></div><span class="btn bd2c bsm">Open</span></div>'}).join('')+'</div>';host.insertAdjacentElement('afterbegin',box)};

/* The renderer above is the single source of truth.  Earlier releases wrapped
   it five times to compensate for legacy department aliases.  The wrappers
   changed CU.deptId during renders, duplicated report actions, and could make
   carts disappear on the next realtime update.  Alias resolution now happens
   once while scoped state is loaded, so no render-time mutation is needed. */




})();

export {};

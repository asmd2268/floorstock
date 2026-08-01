(function(){
'use strict';
var state={rows:[],filtered:[],shown:0,pageSize:200,selected:new Map()};
function el(id){return document.getElementById(id)}
function escW(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function normW(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function variantW(v){return normW(v).replace(/\b(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|injection|injections|inj|ampoule|ampoules|amp|vial|vials)\b/g,'').replace(/\s+/g,' ').trim()}
function flagsW(m){return {high_alert:!!(m.high_alert||m.highAlert),lasa:!!(m.lasa||m.LASA),refrigerated:!!(m.refrigerated||m.fridge||m.cold_chain),hazard:!!(m.hazard||m.hazardous)}}
function sigW(m){var f=flagsW(m);return ['high_alert','lasa','refrigerated','hazard'].filter(function(k){return f[k]}).join('|')||'none'}
function canManageW(){return window.fsHasCapability?window.fsHasCapability('inventory.manage'):!!(window.CU&&(CU.master===true||['pharmacy','pharmacy_director','inpatient_supervisor'].indexOf(CU.role)>-1))}
function canBulkReplaceW(){return canManageW()}
function rowIdW(x){return String(x.deptId)+'::'+String(x.med.id)}
function buildRowsW(){
 var rows=[];var depts=typeof window.gd==='function'?(gd()||[]):[];
 depts.forEach(function(d){var meds=typeof window.getMeds==='function'?(getMeds(d.id)||[]):[];meds.forEach(function(m){if(!m||!m.id)return;rows.push({deptId:d.id,dept:d.name||d.id,med:m,exact:normW(m.name),variant:variantW(m.name),search:normW((m.name||'')+' '+(d.name||d.id)+' '+(m.category||''))})})});
 var byVariant={},byExact={};rows.forEach(function(x){(byVariant[x.variant]||(byVariant[x.variant]=new Set())).add(x.exact);(byExact[x.exact]||(byExact[x.exact]=[])).push(x)});
 rows.forEach(function(x){x.isVariant=!!(byVariant[x.variant]&&byVariant[x.variant].size>1);var g=byExact[x.exact]||[];x.mismatch=(new Set(g.map(function(y){return sigW(y.med)}))).size>1});
 rows.sort(function(a,b){return String(a.med.name||'').localeCompare(String(b.med.name||''))||String(a.dept).localeCompare(String(b.dept))});return rows
}
window.closeAllDepartmentsInventory=function(){var m=el('all-inv-modal');if(m)m.remove();document.body.style.overflow=''};
function ensureBulkReplacementButtonW(){
 if(!canBulkReplaceW())return;var pg=el('pg-inv');if(!pg)return;var btn=el('bulk-replace-med-btn');
 if(!btn){var tools=pg.querySelector('.fl.ic.jb.mb14 .fl.g8.ic')||pg.querySelector('.fl.g8.ic');if(!tools)return;btn=document.createElement('button');btn.id='bulk-replace-med-btn';btn.type='button';btn.className='btn bg';btn.innerHTML='⇄ Bulk Replacement';tools.appendChild(btn)}
 btn.style.display='inline-flex';btn.disabled=false;btn.onclick=function(){if(typeof window.openBulkReplacement==='function')window.openBulkReplacement();else if(typeof window.toast==='function')toast('Bulk Replacement is unavailable.','err')};
}
function classHtmlW(m){if(typeof window.bdg==='function'){try{return bdg(m)}catch(e){}}return escW(sigW(m))}
function selectedCountW(){var n=el('v13q-selected-count');if(n)n.textContent=state.selected.size+' selected'}
window.v13InventorySelect=function(chk){var k=String(chk.dataset.dept)+'::'+String(chk.dataset.med);if(chk.checked)state.selected.set(k,{dept:chk.dataset.dept,med:chk.dataset.med});else state.selected.delete(k);selectedCountW()};
window.v13SelectVisibleInventory=function(chk){document.querySelectorAll('#all-inv-body .v13q-row-check').forEach(function(c){c.checked=chk.checked;window.v13InventorySelect(c)})};
function filterRowsW(){
 var q=normW((el('all-inv-search')||{}).value||''),variants=!!(el('all-inv-variants')||{}).checked,hide=!!(el('all-inv-hide-identical')||{}).checked,mismatch=!!(el('all-inv-class-mismatch')||{}).checked,seen={};
 state.filtered=state.rows.filter(function(x){if(q&&x.search.indexOf(q)<0)return false;if(variants&&!x.isVariant)return false;if(mismatch&&!x.mismatch)return false;if(hide&&!variants&&!mismatch){if(seen[x.exact])return false;seen[x.exact]=1}return true});state.shown=Math.min(state.pageSize,state.filtered.length);renderRowsW()
}
function renderRowsW(){
 var body=el('all-inv-body');if(!body)return;var slice=state.filtered.slice(0,state.shown);
 body.innerHTML=slice.map(function(x){var k=rowIdW(x),checked=state.selected.has(k)?' checked':'';var cls=typeof rowCls==='function'?rowCls(x.med):'';return '<tr class="'+cls+'"><td><input type="checkbox" class="all-inv-name-check v13q-row-check" data-name="'+escW(x.med.name)+'" data-dept="'+escW(x.deptId)+'" data-med="'+escW(x.med.id)+'" onchange="v13InventorySelect(this);if(window.updateAllInventoryMergeCount)updateAllInventoryMergeCount()"'+checked+'></td><td><b>'+escW(x.med.name)+'</b>'+(x.isVariant?'<div class="fhint">Possible naming variant</div>':'')+(x.mismatch?'<div class="v13q-mismatch">Classification differs across departments</div>':'')+'</td><td>'+escW(x.dept)+'</td><td>'+escW(x.med.category||'')+'</td><td>'+classHtmlW(x.med)+'</td><td>'+escW(x.med.min||0)+'</td><td>'+escW(x.med.max||0)+'</td><td>'+escW(x.med.monthly||'—')+'</td></tr>'}).join('');
 var info=el('v13w-result-info');if(info)info.textContent='Showing '+slice.length+' of '+state.filtered.length+' records';var more=el('v13w-load-more');if(more)more.style.display=state.shown<state.filtered.length?'inline-flex':'none';selectedCountW()
}
window.v13WLoadMore=function(){state.shown=Math.min(state.shown+state.pageSize,state.filtered.length);renderRowsW()};

function ensureBulkModalW(){
  if(el('v13q-bulk-class-modal'))return;
  var m=document.createElement('div');
  m.id='v13q-bulk-class-modal';
  m.className='modal-bg';
  m.innerHTML='<div class="modal v13q-modal"><div class="mh"><span class="mt">Bulk classification / تعديل التصنيف بالجملة</span><button class="xbtn" onclick="if(typeof CM===\'function\')CM(\'v13q-bulk-class-modal\')">✕</button></div><div class="fg"><label>Operation</label><select id="v13q-class-op"><option value="replace">Replace classifications</option><option value="add">Add selected classifications</option><option value="remove">Remove selected classifications</option></select></div><div class="v13q-flags"><label><input type="checkbox" value="high_alert"> High Alert</label><label><input type="checkbox" value="lasa"> LASA</label><label><input type="checkbox" value="refrigerated"> Refrigerator</label><label><input type="checkbox" value="hazard"> Hazard</label></div><div class="fhint">Medication names are not changed.</div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bg" onclick="if(typeof CM===\'function\')CM(\'v13q-bulk-class-modal\')">Cancel</button><button class="btn bp" onclick="v13ApplyBulkClassification()">Save classification</button></div></div>';
  document.body.appendChild(m);
}

window.v13OpenBulkClassification=function(){
  if(!state.selected.size)return toast('Select one or more medications first.','err');
  ensureBulkModalW();
  var modal=el('v13q-bulk-class-modal');
  modal.querySelectorAll('input[type=checkbox]').forEach(function(x){x.checked=false});
  if(!el('v16-bulk-similar-scope')){var box=document.createElement('label');box.id='v16-bulk-similar-scope';box.className='bulk-similar-scope';box.innerHTML='<input id="v16-class-all-similar" type="checkbox" checked style="width:auto;margin:0 7px 0 0"> <b>Apply once to all matching medicine names in every department / تطبيق التصنيف مرة واحدة على كل الأسماء المتشابهة في جميع الأقسام</b><div class="fhint">Useful when the same medicine has different classifications between departments.</div>';var foot=modal.querySelector('.fl.g8');if(foot)foot.parentNode.insertBefore(box,foot)}
  if(typeof OM==='function')OM('v13q-bulk-class-modal');
};


window.openAllDepartmentsInventory=function(){
 if(!canManageW())return typeof window.toast==='function'?toast('Not authorized.','err'):null;window.closeAllDepartmentsInventory();state.selected.clear();state.rows=buildRowsW();state.filtered=state.rows.slice();state.shown=Math.min(state.pageSize,state.filtered.length);
 var html='<div class="modal-bg on" id="all-inv-modal" role="dialog" aria-modal="true"><div class="modal all-inv-modal"><div class="mh"><div><div class="mt">All Departments Inventory / جميع قوائم الأقسام</div><div class="fhint">Naming comparison, classification consistency, merge and bulk classification.</div></div><button type="button" class="xbtn" id="v13w-all-inv-close">×</button></div><div class="all-inv-mergebar"><button class="btn bp bsm" onclick="openMergeInventoryNames()">Merge selected names</button><button class="btn bg bsm" onclick="undoLatestInventoryNameMerge()">Undo latest merge</button><button class="btn bg bsm" onclick="v13OpenBulkClassification()">Bulk classification</button><span class="chip" id="v13q-selected-count">0 selected</span></div><div class="v13q-toolbar"><div class="sbr" style="max-width:420px"><span class="sic">🔎</span><input id="all-inv-search" placeholder="Search medication, department or category..." style="margin:0"></div><label><input type="checkbox" id="all-inv-variants"> Show possible naming variants only</label><label><input type="checkbox" id="all-inv-hide-identical" checked> Hide identical-name repetitions</label><label><input type="checkbox" id="all-inv-class-mismatch"> Classification mismatch only</label><span class="chip">'+state.rows.length+' records</span></div><div class="all-inv-wrap"><table class="all-inv-table"><thead><tr><th><input type="checkbox" style="width:auto;margin:0" onchange="v13SelectVisibleInventory(this)"></th><th>Medication</th><th>Department</th><th>Category</th><th>Classifications</th><th>Min</th><th>Max</th><th>Monthly</th></tr></thead><tbody id="all-inv-body"></tbody></table></div><div class="v13w-footer"><span class="fhint" id="v13w-result-info"></span><div class="fl g8"><button class="btn bg bsm" id="v13w-load-more" onclick="v13WLoadMore()">Load more</button><button class="btn bg bsm" id="v13w-close-bottom">Close</button></div></div></div></div>';
 document.body.insertAdjacentHTML('beforeend',html);document.body.style.overflow='hidden';el('v13w-all-inv-close').onclick=window.closeAllDepartmentsInventory;el('v13w-close-bottom').onclick=window.closeAllDepartmentsInventory;el('all-inv-modal').addEventListener('click',function(ev){if(ev.target===this)window.closeAllDepartmentsInventory()});['all-inv-search','all-inv-variants','all-inv-hide-identical','all-inv-class-mismatch'].forEach(function(id){var x=el(id);x.addEventListener(id==='all-inv-search'?'input':'change',filterRowsW)});renderRowsW()
};
window.ensureBulkReplacementButton=ensureBulkReplacementButtonW;
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&el('all-inv-modal'))window.closeAllDepartmentsInventory()});
})();

export {};

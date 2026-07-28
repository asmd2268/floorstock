(function(){
'use strict';
var MODAL_ID='similar-medicines-modal-v2';
var state={groups:[],selected:new Set(),manualSelected:new Set(),query:'',mode:'similar'};
var SEPARATION_KEY='similar_medicine_separations_v1',separationCache=null;
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
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
function canManage(){return window.fsCanManage?window.fsCanManage():false}
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
})();








export {};

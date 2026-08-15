(function(){
'use strict';
var E=window.fsE;
var esc=window.fsEsc;
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function mgr(){return !!(window.CU&&(CU.master===true||role()==='pharmacy'||role()==='inpatient_supervisor'))}
function supervisor(){return role()==='inpatient_supervisor'}
function deptUser(){return role()==='department'}
function now(){return new Date().toISOString()}
function get(k,d){try{var v=window.S&&S.g?S.g(k):null;return v==null?d:v}catch(e){return d}}
function set(k,v){return window.S&&S.s?S.s(k,v):Promise.resolve()}
function norm(v){return window.fsMedNorm?window.fsMedNorm(v):String(v||'').toLowerCase().trim()}
function medFamily(v){return norm(v).replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|l|iu|unit|units|%|mmol|meq)\b/gi,' ').replace(/\b(?:tab(?:let)?s?|caps?(?:ule)?s?|amp(?:oule)?s?|vials?|bottles?|bags?|syrups?|solution|solutions|injection|injections|cream|ointment|drops?|inhalers?|suppositor(?:y|ies))\b/gi,' ').replace(/\s+/g,' ').trim()}
function medIdentity(v){
 var stop={mg:1,mcg:1,g:1,gm:1,ml:1,l:1,iu:1,unit:1,units:1,percent:1,mmol:1,meq:1,tab:1,tabs:1,tablet:1,tablets:1,cap:1,caps:1,capsule:1,capsules:1,amp:1,amps:1,ampoule:1,ampoules:1,vial:1,vials:1,bottle:1,bottles:1,bag:1,bags:1,syrup:1,solution:1,solutions:1,soln:1,susp:1,suspension:1,inj:1,injection:1,injections:1,cream:1,ointment:1,drop:1,drops:1,inhaler:1,inhalers:1,suppository:1,suppositories:1,oral:1,iv:1,im:1,sc:1,intravenous:1,intramuscular:1,subcutaneous:1,infusion:1,premix:1,pack:1,packs:1,for:1,of:1,محلول:1,محاليل:1,حقن:1,حقنة:1,امبول:1,امبولات:1,فيال:1,فيالات:1,قرص:1,اقراص:1,كبسول:1,كبسولات:1,مل:1,مجم:1};
 return norm(v).split(/\s+/).filter(function(t){return t&&t.length>1&&!/^\d+$/.test(t)&&!/^\d+(?:mg|mcg|g|gm|ml|l|iu|units?|mmol|meq)$/i.test(t)&&!stop[t]}).join(' ').trim();
}
function sameMedicationIdentity(a,b){
 a=medIdentity(a);b=medIdentity(b);if(!a||!b)return false;if(a===b)return true;
 var shorter=a.length<=b.length?a:b,longer=a.length<=b.length?b:a;
 if(shorter.length>=5&&(' '+longer+' ').indexOf(' '+shorter+' ')>-1)return true;
 var at=a.split(' '),bt=b.split(' '),common=at.filter(function(t){return bt.indexOf(t)>-1});
 var score=common.length/Math.max(at.length,bt.length);
 return common.length>=2&&score>=0.72;
}
function hideMap(){return get('medication_visibility_rules_v3',{})||{}}
function freezeMap(){var a=get('medication_freeze_rules_v3',{})||{},b=get('global_request_freeze_v2',{})||{};Object.keys(b).forEach(function(k){if(!a[k])a[k]=b[k]});return a}
function applies(info,dept){return !!(info&&(info.allDepartments===true||info.deptIds==='all'||(Array.isArray(info.departmentIds)&&info.departmentIds.indexOf(dept)>-1)||(Array.isArray(info.deptIds)&&info.deptIds.indexOf(dept)>-1)))}
function findRule(map,m,dept){return typeof window.fsR17MedicationRuleFor==='function'?window.fsR17MedicationRuleFor(map,m,dept):null}
function deptChecks(prefix){return '<label class="ops-scope-all"><input id="'+prefix+'-all" type="checkbox" onchange="window.v16ToggleScope(\''+prefix+'\',this.checked)"> All departments / جميع الأقسام</label>'+(typeof gd==='function'?(gd()||[]):[]).map(function(d){return '<label><input class="'+prefix+'-dept" type="checkbox" value="'+esc(d.id)+'"> '+esc(d.name||d.id)+'</label>'}).join('')}
window.v16ToggleScope=function(prefix,on){document.querySelectorAll('.'+prefix+'-dept').forEach(function(x){x.checked=on})};

/* Inventory permissions and controls */
function ensureInventoryTools(){
 if(!mgr())return;
 var bulk=E('bulk-bar');if(bulk){var bar=bulk.querySelector('.fl.g8.ic')||bulk.querySelector('.fl');if(bar){
  if(!E('v16-hide-btn')){var h=document.createElement('button');h.id='v16-hide-btn';h.className='btn bg bsm';h.textContent='🙈 Hide from requests';h.onclick=function(){if(window.openHide)window.openHide()};bar.appendChild(h)}
  if(!E('v16-freeze-btn')){var f=document.createElement('button');f.id='v16-freeze-btn';f.className='btn bd2c bsm';f.textContent='⏸ Freeze requests';f.onclick=function(){if(window.openFreeze)window.openFreeze()};bar.appendChild(f)}
  if(!E('v16-multi-btn')){var m=document.createElement('button');m.id='v16-multi-btn';m.className='btn bs bsm';m.textContent='⇄ Multi-department';m.onclick=openMulti;bar.appendChild(m)}
 }}
 var head=E('pg-inv')&&E('pg-inv').querySelector('.fl.ic.jb .fl.g8.ic');if(head&&!E('v16-multi-head')){var b=document.createElement('button');b.id='v16-multi-head';b.className='btn bs bsm';b.textContent='⇄ Add/Edit/Delete in departments';b.onclick=openMulti;head.appendChild(b)}
 var catBtn=Array.from(document.querySelectorAll('#pg-inv button')).find(function(x){return /Categories/i.test(x.textContent||'')});if(catBtn)catBtn.style.display='inline-flex';
}
/* Hide whole category from requests */
function enhanceCategories(){var modal=E('mcat-mgr');if(!modal||!mgr())return;var p=modal.querySelector('p');if(p)p.innerHTML='Manage the <b>single global category order for every department</b>. Changes are saved automatically. Hiding a category affects New Request only; shelves and expiry entry remain available.';var ctx=E('dept-cat-context');if(ctx)ctx.innerHTML='<b>Global order / ترتيب موحد:</b> this exact order is used automatically in Inventory, New Request, shelves and Print for every department. No category is forced first or last.<div class="fl g8" style="margin-top:8px"><button class="btn bg bsm" onclick="v16ManageHiddenCategories()">Hide/show categories from requests</button></div>'}
window.v16ManageHiddenCategories=function(){var map=get('hidden_request_categories_v1',{})||{},cats=typeof getCategories==='function'?getCategories():[];document.body.insertAdjacentHTML('beforeend','<div class="modal-bg on" id="v16-cat-hide"><div class="modal"><div class="mh"><span class="mt">Request category visibility</span><button class="xbtn" onclick="document.getElementById(\'v16-cat-hide\').remove()">×</button></div>'+cats.map(function(c){return '<label style="display:flex;align-items:center;gap:8px;padding:7px"><input class="v16-cat-check" type="checkbox" value="'+esc(c)+'" '+(map[norm(c)]?'checked':'')+' style="width:auto;margin:0"> Hide '+esc(c)+' from New Request</label>'}).join('')+'<div class="fl g8" style="justify-content:flex-end"><button class="btn bg" onclick="document.getElementById(\'v16-cat-hide\').remove()">Cancel</button><button class="btn bs" onclick="v16SaveHiddenCats()">Save</button></div></div></div>')};
window.v16SaveHiddenCats=async function(){var map={};document.querySelectorAll('.v16-cat-check:checked').forEach(function(x){map[norm(x.value)]={name:x.value,updatedAt:now(),updatedBy:CU.username||''}});await set('hidden_request_categories_v1',map);E('v16-cat-hide').remove();toast('Category visibility saved ✓','succ');if(typeof renderReqForm==='function')renderReqForm()};

/* Multi-department medicine maintenance */
function openMulti(){if(typeof window.v16OpenMultiDepartments==='function')return window.v16OpenMultiDepartments()}
/* Request form: hide medicine/category only here; freeze; global order */
function cleanRequestForm(){if(!deptUser())return;var dept=CU.deptId,hm=hideMap(),fm=freezeMap(),hc=get('hidden_request_categories_v1',{})||{},meds=getMeds(dept)||[],by={};meds.forEach(function(m){by[String(m.id)]=m});document.querySelectorAll('#rfbody .rqi').forEach(function(inp){var m=by[String(inp.dataset.mid)],tr=inp.closest('tr');if(!m||!tr)return;if(hc[norm(m.category)]||findRule(hm,m,dept)){tr.remove();return}var fr=findRule(fm,m,dept);if(fr){inp.disabled=true;inp.value='';var c=tr.cells&&tr.cells[1];if(c&&!c.querySelector('.v16-freeze-badge'))c.insertAdjacentHTML('beforeend',' <span class="badge brd v16-freeze-badge">⏸ '+esc(fr.reason||'Frozen')+'</span>')}});document.querySelectorAll('#rfbody .cath').forEach(function(h){var n=h.nextElementSibling,hasMedication=!!(n&&n.querySelector('tbody tr .rqi'));if(!hasMedication){if(n)n.remove();h.remove()}});if(typeof cntItems==='function')cntItems()}
window.cleanRequestFormUi=cleanRequestForm;

/* Requests: departments may edit pending requests while their current ordering window is open. */
function reqs(){return typeof gr==='function'?(gr()||[]):[]}
function canEditReq(r){if(!(deptUser()||mgr()))return false;if(!r||r.status!=='pending'||r.fulfilledAt||r.fulfilled)return false;if(typeof window.canEditRequestBySchedule==='function')return window.canEditRequestBySchedule(r);return typeof window.isRequestAllowed==='function'&&!!window.isRequestAllowed(r.deptId).allowed}
function requestCard(r){var selector=deptUser()?'#mrlst .card[data-request-id]':'#rlist .card[data-request-id]';return Array.from(document.querySelectorAll(selector)).find(function(c){return String(c.dataset.requestId)===String(r.id)})}
function requestEditRestriction(m,dept){var hiddenCategory=get('hidden_request_categories_v1',{})||{},hiddenRule=findRule(hideMap(),m,dept),frozenRule=findRule(freezeMap(),m,dept);if(hiddenCategory[norm(m&&m.category)])return{locked:true,type:'hidden',reason:'Hidden category / تصنيف مخفي'};if(hiddenRule)return{locked:true,type:'hidden',reason:hiddenRule.reason||'Hidden from requests / مخفي من الطلب'};if(frozenRule)return{locked:true,type:'frozen',reason:frozenRule.reason||'Frozen / مجمد'};return{locked:false,type:'',reason:''}}
function requestEditDeadlineText(r){var deadline=typeof window.getCurrentRequestEditDeadline==='function'?window.getCurrentRequestEditDeadline(r.deptId,Date.now()):0;if(deadline===null)return 'نافذة الطلب مفتوحة باستمرار، أو حتى تنفيذ الطلب من الصيدلية — أيهما أول.\nEditable until pharmacy fulfillment.';if(Number.isFinite(deadline)&&deadline>0){var value=new Date(deadline).toISOString(),label=typeof fmtDateTime==='function'?fmtDateTime(value):new Date(deadline).toLocaleString();return 'يمكن تعديل الطلب حتى '+label+' أو حتى تنفيذه من الصيدلية — أيهما أول.\nEditable until '+label+' or pharmacy fulfillment, whichever comes first.'}return 'يمكن تعديل الطلب ما دامت نافذة الطلب مفتوحة ولم تنفذه الصيدلية.\nEditable while ordering is open and before fulfillment.'}
function requestEditDeadlineHtml(r){var lines=requestEditDeadlineText(r).split('\n');return '<div dir="rtl"><b>✏ صلاحية التعديل:</b> '+esc(lines[0]||'')+'</div><div dir="ltr"><b>Request editing:</b> '+esc(lines[1]||'')+'</div>'}
function installEditWindowNotice(card,r){if(!deptUser()||!canEditReq(r)||card.querySelector('[data-v16-edit-window]'))return;var note=document.createElement('div');note.dataset.v16EditWindow='1';note.className='alert-banner-y';note.style.cssText='margin:10px 14px 0;padding:9px 12px;font-size:12px';note.innerHTML=requestEditDeadlineHtml(r);var head=card.querySelector('.ch');if(head)head.insertAdjacentElement('afterend',note)}
function enhanceRequests(){
 if(E('pg-reqs')&&mgr()&&!E('v16-req-filter')){var host=E('pg-reqs').querySelector('.tgrp');var f=document.createElement('div');f.id='v16-req-filter';f.className='fl g8';f.style.cssText='flex-wrap:wrap;margin-bottom:12px';f.innerHTML='<select id="v16-r-status" class="psel"><option value="all">All statuses</option><option value="pending">Pending</option><option value="fulfilled">Fulfilled</option></select><select id="v16-r-age" class="psel"><option value="all">All dates</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select><input id="v16-r-search" placeholder="Search department/request" style="margin:0;max-width:260px">';f.querySelectorAll('select,input').forEach(function(control){control.addEventListener(control.tagName==='INPUT'?'input':'change',window.v16FilterRequests)});host.parentNode.insertBefore(f,host.nextSibling)}
 reqs().forEach(function(r){var card=requestCard(r);if(!card)return;card.dataset.v16RequestId=r.id;card.querySelectorAll('[data-delete-request],button').forEach(function(b){if(b.matches('[data-request-action="master-delete"]')||/Delete with reason|Delete request/i.test(b.textContent||''))b.remove()});var bar=card.querySelector('[data-request-actions]');if(!bar)return;if(canEditReq(r)&&!bar.querySelector('[data-v16-edit]')){var e=document.createElement('button');e.className='btn bg bsm';e.dataset.v16Edit=r.id;e.dataset.requestAction='v16-edit';e.dataset.id=r.id;e.textContent='✏ تعديل الطلب / Edit request';bar.appendChild(e)}installEditWindowNotice(card,r);if(mgr()&&!bar.querySelector('[data-v16-delete]')){var d=document.createElement('button');d.className='btn bd2c bsm';d.dataset.v16Delete=r.id;d.dataset.requestAction='v16-delete';d.dataset.id=r.id;d.textContent='🗑 Delete';bar.appendChild(d)}});if(deptUser())document.querySelectorAll('#mrlst button').forEach(function(b){if(/Delete with reason|Delete request/i.test(b.textContent||''))b.remove()});window.v16FilterRequests()}
window.v16FilterRequests=function(){var st=(E('v16-r-status')||{}).value||'all',age=(E('v16-r-age')||{}).value||'all',q=norm((E('v16-r-search')||{}).value||'');document.querySelectorAll('#rlist .card[data-v16-request-id]').forEach(function(c){var r=reqs().find(function(x){return String(x.id)===String(c.dataset.v16RequestId)});if(!r)return;var ok=st==='all'||r.status===st;if(age!=='all'){var t=new Date(r.created||r.createdAt||0),days=(Date.now()-t.getTime())/86400000;ok=ok&&(age==='today'?t.toDateString()===new Date().toDateString():days<=Number(age))}if(q)ok=ok&&norm(c.textContent).indexOf(q)>-1;c.style.display=ok?'':'none'})};
window.v16DeleteRequest=function(id){var r=reqs().find(function(x){return String(x.id)===String(id)});if(!r)return;var meds=getMeds(r.deptId)||[],items=(r.dispensed&&r.dispensed.length?r.dispensed:r.items)||[];document.body.insertAdjacentHTML('beforeend','<div class="modal-bg on" id="v16-delete-request"><div class="modal" style="width:min(760px,96vw)"><div class="mh"><span class="mt">Confirm request deletion / تأكيد حذف الطلب</span><button class="xbtn" data-request-action="close-request-modal">×</button></div><div class="tw"><table><thead><tr><th>Medication</th><th>Qty</th></tr></thead><tbody>'+items.map(function(it){var m=meds.find(function(x){return String(x.id)===String(it.medId)});return '<tr><td>'+esc(m&&m.name||it.medId)+'</td><td>'+esc(it.qty)+'</td></tr>'}).join('')+'</tbody></table></div><label style="margin-top:10px">Deletion reason sent to department / سبب الحذف</label><textarea id="v16-del-reason" rows="3"></textarea><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" data-request-action="close-request-modal">Cancel</button><button class="btn bd2c" data-request-action="v16-confirm-delete" data-id="'+esc(id)+'">Delete request</button></div></div></div>')};
window.v16ConfirmDelete=async function(id){var reason=((E('v16-del-reason')||{}).value||'').trim();if(!reason)return toast('Enter deletion reason.','err');var all=reqs().slice(),r=all.find(function(x){return String(x.id)===String(id)});if(!r)return;await set('requests',all.filter(function(x){return String(x.id)!==String(id)}));var log=get('deleted_request_audit_v4',[])||[];log.push({request:r,reason:reason,deletedAt:now(),deletedBy:CU.username||''});await set('deleted_request_audit_v4',log);var notes=get('department_request_notifications_v1',[])||[];notes.push({id:'rn_'+Date.now(),deptId:r.deptId,requestId:id,type:'deleted',reason:reason,createdAt:now(),read:false});await set('department_request_notifications_v1',notes);E('v16-delete-request').remove();renderReqs();toast('Request deleted; department notified; daily limit reset ✓','succ')};
function renderRequestEditCategory(category,meds,previous,dept){var rows=meds.map(function(m,index){var current=Object.prototype.hasOwnProperty.call(previous,String(m.id))?previous[String(m.id)]:0,restriction=requestEditRestriction(m,dept),locked=restriction.locked,had=current>0,max=Math.max(0,Number(m.max)||0),rowStyle=had?'background:rgba(46,160,67,.12);box-shadow:inset 4px 0 #2da44e':'';return '<tr data-v16-edit-row data-search="'+esc(norm(m.name))+'" style="'+rowStyle+'"><td style="text-align:center;font-family:var(--mono);font-weight:600">'+(index+1)+'</td><td><b>'+esc(m.name)+'</b>'+(had?' <span class="badge bgn">Previous qty / الكمية السابقة</span>':'')+(locked?' <span class="badge '+(restriction.type==='frozen'?'brd':'byl')+'">'+(restriction.type==='frozen'?'⏸ Frozen / مجمد':'🙈 Hidden / مخفي')+'</span>':'')+(locked&&restriction.reason?'<div class="fhint">'+esc(restriction.reason)+'</div>':'')+'</td><td>'+bdg(m)+'</td><td style="text-align:center;font-family:var(--mono)">'+esc(m.min==null?0:m.min)+'</td><td style="text-align:center;font-family:var(--mono)">'+esc(max)+'</td><td><div class="qwrap"><input class="v16-edit-qty" data-med="'+esc(m.id)+'" data-original="'+esc(current)+'" data-max="'+esc(max)+'" type="number" min="0" max="'+esc(max)+'" value="'+esc(current)+'" '+(locked?'disabled data-edit-locked="1"':'')+' style="margin:0;'+(had?'border:2px solid #2da44e;background:rgba(46,160,67,.08);font-weight:700':'')+'"><span class="qlim">/'+esc(max)+'</span></div></td></tr>'}).join('');return '<div class="v16-edit-category" data-v16-edit-category><div class="cath">📁 '+esc(category)+' <span style="font-size:10px;color:var(--tx3)">('+meds.length+')</span></div><div class="tw"><table><thead><tr><th>#</th><th>Medication</th><th>Classification</th><th>Min</th><th>Max</th><th>Qty</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'}
function refreshRequestEditCount(){var count=Array.from(document.querySelectorAll('#v16-edit-request .v16-edit-qty')).filter(function(x){return Number(x.value)>0}).length,node=E('v16-edit-count');if(node)node.textContent=String(count)}
window.v16EditRequest=function(id){var r=reqs().find(function(x){return String(x.id)===String(id)});if(!r||!canEditReq(r))return toast('Editing window closed.','err');var meds=(getMeds(r.deptId)||[]).slice(),previous={},currentIds={};(r.items||[]).forEach(function(x){previous[String(x.medId)]=Number(x.qty)||0});meds.forEach(function(m){currentIds[String(m.id)]=true});meds.sort(function(a,b){return Number(a.sortOrder||0)-Number(b.sortOrder||0)||String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base',numeric:true})});var groups={};meds.forEach(function(m){var restriction=requestEditRestriction(m,r.deptId),had=(previous[String(m.id)]||0)>0;if(restriction.type==='hidden'&&!had)return;var cat=m.category||'Uncategorized';(groups[cat]||(groups[cat]=[])).push(m)});var categories=Object.keys(groups);if(typeof window.sortDeptInventoryCategories==='function')categories=window.sortDeptInventoryCategories(r.deptId,categories);else categories.sort();var orphanItems=(r.items||[]).filter(function(x){return !currentIds[String(x.medId)]&&Number(x.qty)>0});var body=categories.map(function(cat){return renderRequestEditCategory(cat,groups[cat],previous,r.deptId)}).join('');if(orphanItems.length)body+='<div class="v16-edit-category" data-v16-edit-category><div class="cath">⚠ Previously requested — no longer in department list / أدوية سابقة غير موجودة حاليًا</div><div class="tw"><table><thead><tr><th>#</th><th>Medication</th><th>Classification</th><th>Min</th><th>Max</th><th>Qty</th></tr></thead><tbody>'+orphanItems.map(function(it,i){return '<tr data-v16-edit-row data-search="'+esc(norm(it.medId))+'" style="background:rgba(46,160,67,.12);box-shadow:inset 4px 0 #2da44e"><td>'+(i+1)+'</td><td><b>'+esc(it.medName||it.name||it.medId)+'</b> <span class="badge bgr">Locked / مقفل</span></td><td>—</td><td>—</td><td>—</td><td><input class="v16-edit-qty" data-med="'+esc(it.medId)+'" data-original="'+esc(it.qty)+'" data-edit-locked="1" type="number" value="'+esc(it.qty)+'" disabled style="margin:0;font-weight:700"></td></tr>'}).join('')+'</tbody></table></div></div>';var old=E('v16-edit-request');if(old)old.remove();document.body.insertAdjacentHTML('beforeend','<div class="modal-bg on" id="v16-edit-request"><div class="modal" style="width:min(1120px,98vw);max-width:98vw"><div class="mh"><div><span class="mt">Edit Request / تعديل الطلب</span><div class="fhint">نفس قائمة الطلب الجديد. الكميات السابقة مميزة باللون الأخضر. الأدوية المخفية أو المجمدة مقفلة ولا يمكن تغييرها.</div></div><button class="xbtn" data-request-action="close-request-modal">×</button></div><div class="alert-banner-y" style="margin-bottom:10px">'+requestEditDeadlineHtml(r)+'</div><div class="ch" style="margin:0 0 10px"><div class="sbr"><span class="sic">🔍</span><input id="v16-edit-search" placeholder="Search medications... / بحث" style="margin:0"></div><div style="font-size:12px;color:var(--tx2)"><span id="v16-edit-count">0</span> items entered</div></div><div id="v16-edit-form" style="max-height:62vh;overflow:auto">'+body+'</div><div class="fl g8" style="justify-content:flex-end;margin-top:12px"><button class="btn bg" data-request-action="close-request-modal">Cancel / إلغاء</button><button class="btn bs" data-request-action="v16-save-edit" data-id="'+esc(id)+'">Save changes / حفظ التعديلات</button></div></div></div>');var modal=E('v16-edit-request');modal.querySelectorAll('.v16-edit-qty:not([disabled])').forEach(function(input){input.addEventListener('input',function(){var max=Number(this.dataset.max)||0,value=Math.max(0,Number(this.value)||0);if(value>max)value=max;this.value=value;this.style.fontWeight=value>0?'700':'';refreshRequestEditCount()})});var search=E('v16-edit-search');if(search)search.addEventListener('input',function(){var q=norm(this.value);modal.querySelectorAll('[data-v16-edit-category]').forEach(function(group){var visible=0;group.querySelectorAll('[data-v16-edit-row]').forEach(function(row){var show=!q||String(row.dataset.search||'').indexOf(q)>-1;row.style.display=show?'':'none';if(show)visible++});group.style.display=visible?'':'none'})});refreshRequestEditCount()};
window.v16SaveEdit=async function(id){var r=reqs().find(function(x){return String(x.id)===String(id)});if(!r||!canEditReq(r))return toast('Editing window closed or request already fulfilled.','err');var original={},meds=getMeds(r.deptId)||[],medsById={};(r.items||[]).forEach(function(x){original[String(x.medId)]=Number(x.qty)||0});meds.forEach(function(m){medsById[String(m.id)]=m});var rendered={};var arr=Array.from(document.querySelectorAll('#v16-edit-request .v16-edit-qty')).map(function(x){var medId=String(x.dataset.med),med=medsById[medId],locked=x.dataset.editLocked==='1'||(med&&requestEditRestriction(med,r.deptId).locked),qty=locked?(original[medId]||0):(Number(x.value)||0);rendered[medId]=true;return{medId:medId,qty:qty}}).filter(function(x){return x.qty>0});Object.keys(original).forEach(function(medId){if(!rendered[medId]&&original[medId]>0)arr.push({medId:medId,qty:original[medId]})});if(!arr.length)return toast('At least one item is required.','err');var btn=E('v16-edit-request')&&E('v16-edit-request').querySelector('[data-request-action="v16-save-edit"]');if(btn)btn.disabled=true;try{var saved=window.S&&typeof S.upd==='function'?await S.upd('requests',id,{items:arr,editedAt:now(),editedBy:CU.username||''}):false;if(!saved)throw new Error('Request is no longer available');var modal=E('v16-edit-request');if(modal)modal.remove();if(typeof renderReqs==='function')renderReqs();if(typeof renderMyReqs==='function')renderMyReqs();toast('Request updated ✓','succ')}catch(error){console.error('Request edit save failed',error);toast('Request update was not saved. Please retry.','err');if(btn)btn.disabled=false}};

/* Schedule convenience: 24-hour preset per selected days */
function enhanceSchedule(){var m=E('mreq-window');if(m&&!E('v16-24h-btn')){var btn=document.createElement('button');btn.id='v16-24h-btn';btn.className='btn bg bsm';btn.textContent='24 hours / ٢٤ ساعة';btn.onclick=function(){var a=E('rwin-from'),b=E('rwin-to');if(a)a.value='00:00';if(b)b.value='23:59'};var h=m.querySelector('.mh');if(h)h.insertAdjacentElement('afterend',btn)}}

/* Crash Cart medication names: one complete canonical name across departments. */
var crashNameSyncBusy=false;
function crashFullNameCandidate(it){
 var n=String(it&&it.name||'').trim(),st=String(it&&it.strength||'').trim();
 if(st&&norm(n).indexOf(norm(st))<0)n=(n+' '+st).trim();
 return n;
}
function crashNameScore(v){
 v=String(v||'').trim();var score=v.length;
 if(/\d\s*(?:mg|mcg|g|gm|ml|l|iu|unit|units|mmol|meq|%)/i.test(v))score+=35;
 if(/\b(?:injection|solution|tablet|capsule|ampoule|vial|bag|syrup|cream|ointment|drops|inhaler|suppository)\b/i.test(v))score+=18;
 score+=Math.min(20,v.split(/\s+/).length*2);return score;
}
function crashCanonicalNames(carts,reports){
 var groups={},targets={},stored=get('crash_cart_medication_names_v1',{})||{};
 function identity(name){name=String(name||'').trim();return name?(medIdentity(name)||norm(name)):''}
 function add(name){name=String(name||'').trim();var id=identity(name);if(!id)return;(groups[id]||(groups[id]=[])).push(name)}
 function addTarget(name){var id=identity(name);if(!id)return;targets[id]=true;add(name)}
 (carts||[]).forEach(function(c){(c.items||[]).forEach(function(it){addTarget(crashFullNameCandidate(it))})});
 (reports||[]).forEach(function(r){(r.consumed||[]).forEach(function(it){addTarget(it&&it.name)});(r.replacements||[]).forEach(function(it){addTarget(it&&it.name)})});
 Object.keys(stored).forEach(function(k){if(targets[k])add(stored[k])});
 (typeof gd==='function'?(gd()||[]):[]).forEach(function(d){(typeof getMeds==='function'?(getMeds(d.id)||[]):[]).forEach(function(m){var id=identity(m&&m.name);if(targets[id])add(m.name)})});
 var map={};Object.keys(groups).forEach(function(k){map[k]=groups[k].slice().sort(function(a,b){return crashNameScore(b)-crashNameScore(a)||b.length-a.length})[0]});return map;
}
function unifyCrashMedicationNames(){
 if(crashNameSyncBusy||typeof crashCarts!=='function')return;
 var carts=crashCarts()||[],reports=typeof crashReports==='function'?(crashReports()||[]):[],map=crashCanonicalNames(carts,reports),cartChanged=false,reportChanged=false;
 carts.forEach(function(c){(c.items||[]).forEach(function(it){var candidate=crashFullNameCandidate(it),id=medIdentity(candidate)||norm(candidate),canonical=map[id];if(canonical&&it.name!==canonical){it.name=canonical;cartChanged=true}})});
 reports.forEach(function(r){['consumed','replacements'].forEach(function(key){(r[key]||[]).forEach(function(it){var id=medIdentity(it&&it.name)||norm(it&&it.name),canonical=map[id];if(canonical&&it.name!==canonical){it.name=canonical;reportChanged=true}})})});
 if(!cartChanged&&!reportChanged)return;
 crashNameSyncBusy=true;
 var jobs=[];
 /* Managers persist the cleanup. Department users only normalize their in-memory display. */
 if(mgr()){
  jobs.push(setCrashCarts(carts));jobs.push(set('crash_cart_medication_names_v1',map));if(reportChanged)jobs.push(set('crash_cart_reports',reports));
 }
 Promise.all(jobs).catch(function(){}).then(function(){crashNameSyncBusy=false;if(typeof renderCrashCarts==='function')renderCrashCarts()});
}


/* Department-facing polishing */
function polishDepartment(){
 if(!deptUser())return;
 document.querySelectorAll('#crash-list button').forEach(function(b){if(/delete cart/i.test(b.textContent||''))b.remove()});
 var today=new Date();today.setHours(0,0,0,0);
 (typeof crashCarts==='function'?(crashCarts()||[]):[]).filter(function(c){return String(c.deptId)===String(CU.deptId)}).forEach(function(c){
  var card=Array.from(document.querySelectorAll('#crash-list .crash-cart-card')).find(function(x){return (x.textContent||'').indexOf(String(c.name||''))>-1});if(!card)return;
  var ordered=['up','down'].reduce(function(a,sec){return a.concat((c.items||[]).filter(function(it){return String(it.section||'up')===sec}))},[]),rows=Array.from(card.querySelectorAll('tbody tr')).filter(function(tr){return !tr.classList.contains('crash-section-label')});
  rows.forEach(function(tr,i){var it=ordered[i];if(!it)return;var days=(it.batches||[]).map(function(b){var dt=new Date(String(b.expiry||'')+'T00:00:00');return isNaN(dt)?999999:Math.floor((dt-today)/86400000)});tr.classList.remove('v16-exp-soon','v16-exp-expired');if(days.some(function(d){return d<0}))tr.classList.add('v16-exp-expired');else if(days.some(function(d){return d>=0&&d<=30}))tr.classList.add('v16-exp-soon')})
 })
}

/* Crash Cart: bilingual other reason and non-duplicating replacement */
function enhanceCrash(){var reason=E('ccr-reason');if(reason){Array.from(reason.options||[]).forEach(function(o){var v=String(o.value||'').toLowerCase();if(v==='other')o.textContent='Other / سبب آخر'});if(!E('v16-crash-other')){var inp=document.createElement('input');inp.id='v16-crash-other';inp.placeholder='Other reason / السبب الآخر';inp.style.display='none';reason.parentNode.appendChild(inp);reason.addEventListener('change',function(){inp.style.display=String(reason.value).toLowerCase()==='other'?'':'none'})}}
 if(mgr()){var open=(typeof crashReports==='function'?(crashReports()||[]):[]).filter(function(r){return r.status==='open'||r.status==='pending'});var a=E('crash-open-alerts');if(a)a.innerHTML=open.length?'<div class="alert-banner"><b>'+open.length+'</b> open Crash Cart report(s) / بلاغات فتح عربة طوارئ مفتوحة: '+open.map(function(r){var d=(gd()||[]).find(function(x){return String(x.id)===String(r.deptId)}),c=(typeof crashCarts==='function'?(crashCarts()||[]):[]).find(function(x){return String(x.id)===String(r.cartId)});return esc(d&&d.name||(c&&c.name?c.name+' — '+r.deptId:r.deptId))}).join(', ')+'</div>':''}
}
/* Crash response save is handled by the authoritative idempotent path. */

/* Monthly check reminder */
function crashMonthlyReminder(){if(!mgr())return;var parts={};try{new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()).forEach(function(p){if(p.type!=='literal')parts[p.type]=Number(p.value)})}catch(e){}var d=parts.year?new Date(parts.year,parts.month-1,parts.day):new Date(),last=new Date(d.getFullYear(),d.getMonth()+1,0),days=last.getDate()-d.getDate();if(days>7)return;var a=E('crash-open-alerts');if(a&&!E('v16-monthly-check')){var x=document.createElement('div');x.id='v16-monthly-check';x.className='alert-banner-y';x.innerHTML='<div dir="rtl"><b>الفحص الشهري:</b> متبقي '+days+' يوم حتى نهاية الشهر.</div><div dir="ltr"><b>Monthly Check:</b> '+days+' day(s) remaining until month end.</div>';a.prepend(x)}}

function activePageId(){var p=document.querySelector('.pg.on');return p&&p.id||''}
function afterRender(){
 var page=activePageId();
 if(page==='pg-inv'){ensureInventoryTools();enhanceCategories();return}
 if(page==='pg-reqs'||page==='pg-myreqs'){enhanceRequests();return}
 if(page==='pg-schedule'){enhanceSchedule();return}
 // Do not rewrite Crash Cart records during a page render.  Medication-name
 // normalisation is a deliberate manager maintenance operation, not a
 // side-effect of viewing a cart.
 if(page==='pg-crashcart'){polishDepartment();enhanceCrash();crashMonthlyReminder()}
}
var afterRenderScheduled=false;
function scheduleAfterRender(){if(afterRenderScheduled)return;afterRenderScheduled=true;var run=function(){afterRenderScheduled=false;afterRender()};Promise.resolve().then(run)}


window.schedulePagePostRender=scheduleAfterRender;
window.enhanceRequests=enhanceRequests;

})();


// --- Merged from 30-v13-w-supervisor-inventory-main.js (Phase 6 consolidation) ---
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


// --- Merged from 37-v16-radical-fixes.js (Phase 6 consolidation) ---
(function(){
'use strict';

/* ── Helpers ── */
const E=globalThis.E;
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'')}
window.isMaster=function(){
  try{
    return !!(window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)||
           !!(window.CU&&window.CU.master===true&&!window.MASTER_EFFECTIVE)||
           (typeof window.isMasterActual==='function'&&window.isMasterActual());
  }catch(e){return false}
};
function isMaster(){return window.isMaster()}

/* ────────────────────────────────────────────────────────────────
   PERMISSION HELPERS
──────────────────────────────────────────────────────────────── */
var ANN_SEE_ROLES = ['pharmacy','controlled_pharmacy','inpatient_supervisor'];
var ANN_ADD_ROLES = ['pharmacy','controlled_pharmacy','inpatient_supervisor'];

function canSeeAnnV16()  { return isMaster()||ANN_SEE_ROLES.indexOf(role())>=0 }
function canAddAnnV16()  { return isMaster()||ANN_ADD_ROLES.indexOf(role())>=0 }


/* New Request is restricted to inpatient department accounts. */
var refreshQueued=false,refreshPage='';
function scheduleV16Refresh(id){
  refreshPage=id||refreshPage||'';
  if(refreshQueued)return;refreshQueued=true;
  var run=function(){refreshQueued=false;var page=refreshPage;refreshPage='';v16EnsureRequestNav();v16EnsureAnnouncements();if(typeof window.refreshAnnouncementsUi==='function')window.refreshAnnouncementsUi(page);if(typeof window.restorePageTransientUi==='function')window.restorePageTransientUi(page)};
  Promise.resolve().then(run);
}

/* ────────────────────────────────────────────────────────────────
   MASTER showPg — Clean navigation and page isolation
──────────────────────────────────────────────────────────────── */
window.showPg = function(id){
  id=String(id||'');
  window.FS_CURRENT_PAGE=id;
  if(id==='pg-controlled'&&window.CU&&['pharmacy','inpatient_supervisor'].indexOf(CU.role)>-1){if(typeof window.toast==='function')toast('Controlled Custody is not available for this role.','info');id='pg-dash'}
  if(typeof window.resolveAllowedPageTarget==='function')id=window.resolveAllowedPageTarget(id);
  if(id!=='pg-newreq'&&typeof window.clearRequestIdleTimer==='function')window.clearRequestIdleTimer();
  if(typeof window.handleRestrictedPage==='function'&&window.handleRestrictedPage(id))return;
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();

  /* ── pg-newreq: block for non-department roles ── */
  if(id === 'pg-newreq' && role() !== 'department'){
    var fallback = (role()==='controlled_pharmacy'||role()==='warehouse') ? 'pg-controlled' : 'pg-dash';
    v16EnsureRequestNav();
    return runBaseShowPg(fallback);
  }

  /* ── pg-announcements: show clean page without background overlay ── */
  if(id === 'pg-announcements'){
    if(!canSeeAnnV16()){
      id = (role()==='department'||role()==='warehouse'||role()==='controlled_pharmacy')
           ? 'pg-controlled' : 'pg-dash';
      return runBaseShowPg(id);
    }
    document.querySelectorAll('.pg').forEach(function(p){
      p.classList.remove('on');
      p.style.display = 'none';
    });
    document.querySelectorAll('#mnav .nb').forEach(function(b){b.classList.remove('on')});
    var annPage = E('pg-announcements');
    if(annPage){ annPage.style.display = ''; annPage.classList.add('on'); }
    var annBtn = document.querySelector('#mnav [data-pg="pg-announcements"]');
    if(annBtn) annBtn.classList.add('on');
    if(typeof window.renderAnnouncements==='function') window.renderAnnouncements();
    if(typeof window.renderDepartmentAnnouncements==='function') window.renderDepartmentAnnouncements();
    scheduleV16Refresh('pg-announcements');
    return;
  }

  /* Hide all non-active page containers */
  document.querySelectorAll('.pg').forEach(function(p){
    if(p.id !== id){
      p.classList.remove('on');
      p.style.display = 'none';
    }
  });

  /* A previous navigation pass leaves inline display:none on every page it hides.
     Remove that stale inline value before and after the base page renderer,
     otherwise the page receives class=on but remains visually hidden. */
  var targetPage = E(id);
  if(targetPage) targetPage.style.removeProperty('display');

  if(id==='pg-controlled'&&((window.MASTER_EFFECTIVE&&MASTER_EFFECTIVE.role==='department')||(window.CU&&CU.role==='department')))window.CTL_VIEW='departments';
  var res = runBaseShowPg(id);

  var activePage = document.querySelector('.pg.on');
  if(activePage) activePage.style.removeProperty('display');
  scheduleV16Refresh(id);
  if(id==='pg-print')resetPrintPageState();
  if(id==='pg-backup-restore'&&typeof window.refreshBackupRestorePage==='function')window.refreshBackupRestorePage();
  if(id==='pg-zebra-labels'&&typeof window.renderZebraPageUi==='function')window.renderZebraPageUi();
  if(id==='pg-controlled'&&typeof window.renderDepartmentControlledPanel==='function')window.renderDepartmentControlledPanel();
  if(typeof window.enforceRoleUi==='function')window.enforceRoleUi();
  return res;
};

/* ────────────────────────────────────────────────────────────────
   Ensure New Request nav button is ONLY present for department accounts
──────────────────────────────────────────────────────────────── */
function v16EnsureRequestNav(){
  var nav = E('mnav'); if(!nav) return;
  var isDept = role() === 'department';
  if(!isDept){
    Array.from(nav.querySelectorAll('[data-pg="pg-newreq"], button[onclick*="pg-newreq"]')).forEach(function(b){ b.remove(); });
    var page = E('pg-newreq');
    if(page){
      page.classList.remove('on','af-request-enabled','v13-admin-request-enabled');
      page.style.display = 'none';
    }
  }
}

/* Inventory controls are owned by the consolidated V16 operations module. */

/* ────────────────────────────────────────────────────────────────
   FIX 4 — Announcements nav button: definitive, conflict-free
──────────────────────────────────────────────────────────────── */
function v16EnsureAnnouncements(){
  var nav = E('mnav'); if(!nav) return;
  var b = nav.querySelector('[data-pg="pg-announcements"]');
  if(canSeeAnnV16()){
    if(!b){
      b = document.createElement('button');
      b.className = 'nb';
      b.dataset.pg = 'pg-announcements';
      b.innerHTML = '📢 Announcements / الإعلانات';
      nav.appendChild(b);
    }
    /* Replace onclick every time to ensure it points to the V16 showPg */
    b.onclick = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      window.showPg('pg-announcements');
    };
    b.style.display = '';
  } else {
    if(b) b.remove();
  }
  /* Control the Add button inside the announcements page */
  var add = E('ann-add-btn')||document.querySelector('#pg-announcements button[onclick*="openAnnouncementEditor"]');
  if(add) add.style.display = canAddAnnV16() ? 'inline-flex' : 'none';
}

/* ────────────────────────────────────────────────────────────────
   WIRE UP — one current orchestration layer
──────────────────────────────────────────────────────────────── */
window.scheduleNavigationRefresh=scheduleV16Refresh;

})();


// --- Merged from 10-warehouse-receiving-workflow.js (Phase 6 consolidation) ---
(function(){
  var whSelectedReceiveId='';
  function medList(){try{return ctlCatalog()||[]}catch(e){return []}}
  window.whReceiveOpen=function(){
    if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
    whSelectedReceiveId='';
    var ids=['wh-receive-search','wh-receive-med-id','wh-receive-expiry','wh-receive-lot'];
    ids.forEach(function(id){var x=document.getElementById(id);if(x)x.value=''});
    var q=document.getElementById('wh-receive-qty');if(q)q.value='1';
    var sel=document.getElementById('wh-receive-selected');if(sel){sel.style.display='none';sel.innerHTML=''}
    whReceiveRenderSearch();OM('mwh-receive');
  };
  window.whReceiveRenderSearch=function(){
    var q=((document.getElementById('wh-receive-search')||{}).value||'').toLowerCase().trim();
    var rows=medList().filter(function(m){return !q||[m.name,m.moh,m.nupco].join(' ').toLowerCase().includes(q)}).slice(0,100);
    var box=document.getElementById('wh-receive-results');if(!box)return;
    box.innerHTML=rows.length?rows.map(function(m){var on=String(m.id)===String(whSelectedReceiveId)?' on':'';return '<div class="wh-receive-result'+on+'" data-id="'+esc(m.id)+'" onclick="whReceiveSelect(this.dataset.id)"><div><b>'+esc(m.name||'')+'</b><div class="wh-receive-meta">MOH: '+esc(m.moh||'—')+' · NUPCO: '+esc(m.nupco||'—')+'</div></div><span class="chip">Select</span></div>'}).join(''):'<div style="padding:18px;text-align:center;color:var(--tx2)">No matching medicine</div>';
  };
  window.whReceiveSelect=function(id){
    whSelectedReceiveId=id;var m=medList().find(function(x){return String(x.id)===String(id)});var hid=document.getElementById('wh-receive-med-id');if(hid)hid.value=id;
    var sel=document.getElementById('wh-receive-selected');if(sel&&m){sel.style.display='block';sel.innerHTML='<b>Selected:</b> '+esc(m.name||'')+'<div class="fhint">Current warehouse balance: '+ctlWarehouseQtyForFilter((ctlWarehouse()||{})[id]||{})+'</div>'}
    whReceiveRenderSearch();
  };
  window.whReceiveSave=async function(){
    if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
    var id=(document.getElementById('wh-receive-med-id')||{}).value||whSelectedReceiveId,qty=Math.max(0,Number((document.getElementById('wh-receive-qty')||{}).value||0)),source=(document.getElementById('wh-receive-source')||{}).value||'system',expiry=(document.getElementById('wh-receive-expiry')||{}).value||'',lot=((document.getElementById('wh-receive-lot')||{}).value||'').trim();
    if(!id)return toast('Select a medicine first','err');if(!(qty>0))return toast('Enter received quantity','err');
    var all=Object.assign({},ctlWarehouse()),x=Object.assign({system:0,outside:0,batches:[]},all[id]||{});x.system=ctlNum(x.system);x.outside=ctlNum(x.outside);x.batches=(x.batches||[]).map(function(b){return Object.assign({},b)});
    if(source==='outside')x.outside+=qty;else x.system+=qty;
    if(expiry){var same=x.batches.find(function(b){return String(b.expiry||'')===expiry&&String(b.lot||'')===lot});if(same)same.qty=ctlNum(same.qty)+qty;else x.batches.push({qty:qty,expiry:expiry,lot:lot,source:source})}
    all[id]=x;
    try{await ctlSetWarehouse(all)}catch(e){console.error('Warehouse receiving save failed',e);return toast('Warehouse balance was not updated.','err')}
    var movementSaved=await ctlSaveMovementLog({type:'warehouse_receive',medId:id,qty:qty,source:source,expiry:expiry,lot:lot,note:'Warehouse received stock'+(expiry?' exp '+expiry:'')},'Warehouse receiving');
    CM('mwh-receive');renderControlled();toast(movementSaved?'Medicine received and warehouse balance updated ✓':'Warehouse balance was updated, but the movement log could not be saved.',movementSaved?'succ':'info');return true
  };

  function applyWarehouseUI(){
    var isWh=false;try{isWh=ctlIsWarehouse()}catch(e){}
    if(!isWh)return;
    var pg=document.getElementById('pg-controlled');if(!pg||document.getElementById('wh-receive-card'))return;
    var anchor=document.getElementById('ctl-tabs')||pg.firstElementChild;
    var card=document.createElement('div');card.id='wh-receive-card';card.className='card';
    card.innerHTML='<div class="ch"><div><span class="ct">Warehouse receiving / استلام أدوية المستودع</span><div class="fhint">Search the shared list, enter received quantity, and optionally link it to an expiry date and batch.</div></div><button class="btn bs" onclick="whReceiveOpen()">+ Receive medicine</button></div><div class="cb"><div class="alert-banner-y" style="margin:0">Warehouse print controls are limited to warehouse stock reports. Inpatient department printing is not available for this role.</div></div>';
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(card,anchor.nextSibling);else pg.insertBefore(card,pg.firstChild);
  }
  window.applyWarehouseControlledUi=applyWarehouseUI;
})();

// --- Merged from 09-warehouse-batch-editor.js (Phase 6 consolidation) ---
(function(){
  window.whAddBatchRow=function(b){
    var row=document.createElement('div');row.className='wh-batch-row';b=b||{};
    row.innerHTML='<div><label>Expiry date</label><input class="wh-exp" type="date" value="'+esc(b.expiry||'')+'"></div><div><label>Linked qty (optional)</label><input class="wh-qty" type="number" min="0" value="'+(b.qty==null?'':esc(b.qty))+'"></div><div><label>Batch / Lot (optional)</label><input class="wh-lot" value="'+esc(b.lot||'')+'"></div><button class="btn bd2c bxs" type="button" onclick="this.parentElement.remove()">✕</button>';
    document.getElementById('mwh-batches').appendChild(row);
  };
  window.ctlEditWarehouseStock=function(id){
    if(!ctlCanEditWarehouse())return;
    var m=ctlMedicine(id)||{},x=(ctlWarehouse()||{})[id]||{};
    document.getElementById('mwh-stock-med-id').value=id;document.getElementById('mwh-stock-title').textContent='Warehouse custody — '+(m.name||'');
    document.getElementById('mwh-system').value=ctlNum(x.system);document.getElementById('mwh-outside').value=ctlNum(x.outside);
    var box=document.getElementById('mwh-batches');box.innerHTML='';(x.batches||[]).forEach(whAddBatchRow);if(!(x.batches||[]).length)whAddBatchRow({});OM('mwh-stock-pro');
  };
  window.whSaveStockPro=async function(){
    var id=document.getElementById('mwh-stock-med-id').value;if(!id)return;
    var batches=Array.from(document.querySelectorAll('#mwh-batches .wh-batch-row')).map(function(r){var q=r.querySelector('.wh-qty').value;return {expiry:r.querySelector('.wh-exp').value,qty:q===''?null:ctlNum(q),lot:r.querySelector('.wh-lot').value.trim()};}).filter(function(b){return b.expiry||b.qty||b.lot});
    var all=Object.assign({},ctlWarehouse()),x=Object.assign({},all[id]||{});x.system=ctlNum(document.getElementById('mwh-system').value);x.outside=ctlNum(document.getElementById('mwh-outside').value);x.batches=batches;all[id]=x;
    try{await ctlSetWarehouse(all)}catch(e){console.error('Warehouse custody save failed',e);return toast('Warehouse custody was not saved.','err')}
    var movementSaved=await ctlSaveMovementLog({type:'warehouse_stock_edit',medId:id,note:'Warehouse balances and expiry batches updated'},'Warehouse custody edit');
    CM('mwh-stock-pro');renderControlled();toast(movementSaved?'Warehouse custody saved ✓':'Warehouse custody was saved, but the movement log was not saved.',movementSaved?'succ':'info');return true
  };

  window.crashAddCart=function(){
    if(!requireCrashCartConfigurationPermission())return false;
    document.getElementById('ccp-name').value='';document.getElementById('ccp-number').value='';document.getElementById('ccp-location').value='';document.getElementById('ccp-seal').value='';
    document.getElementById('ccp-dept').innerHTML=(gd()||[]).map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name||d.id)+'</option>';}).join('');OM('mcrash-cart-pro');
  };
  window.crashSaveCartPro=async function(){
    if(!requireCrashCartConfigurationPermission())return false;
    var name=document.getElementById('ccp-name').value.trim(),deptId=document.getElementById('ccp-dept').value;if(!name||!deptId)return toast('Enter cart name and department','err');
    var cart={id:'cc_'+Date.now().toString(36),name:name,number:document.getElementById('ccp-number').value.trim(),location:document.getElementById('ccp-location').value.trim(),seal:document.getElementById('ccp-seal').value.trim(),deptId:deptId,items:[],createdAt:nowISO(),createdBy:actualActorName()};
    var arr=crashCarts().slice();arr.push(cart);await setCrashCarts(arr);auditAction('crash_cart_add',{cartId:cart.id,deptId:deptId});CM('mcrash-cart-pro');renderCrashCarts();toast('Crash cart created ✓','succ');
  };
})();

// --- Merged from 18-wh-bulk-rx-dx-script.js (Phase 6 consolidation) ---
(function(){
 function norm(v){return String(v==null?'':v).trim().replace(/[\s\-]/g,'').toLowerCase()}
 function catalog(){try{return ctlCatalog()||[]}catch(e){return []}}
 function byCode(code){var n=norm(code);if(!n)return null;return catalog().find(function(m){return norm(m.nupco)===n||norm(m.moh)===n})||null}
 function rowHtml(kind){
  var reqExp=kind==='dispense'?' required':'';
  return '<tr class="wh-bulk-row" data-kind="'+kind+'"><td><input class="wh-code" placeholder="NUPCO / MOH" oninput="whBulkResolveRow(this)"></td><td class="wh-match"><span class="wh-match-pending">Enter code</span></td><td><input class="wh-qty-input" type="number" min="1" step="1" placeholder="0"></td><td><input class="wh-exp-input" type="date"'+reqExp+'></td><td><input class="wh-lot-input" placeholder="Optional"></td><td><button class="btn bd2c bxs" type="button" onclick="this.closest(\'tr\').remove()">✕</button></td></tr>'
 }
 function add(kind){var box=document.getElementById(kind==='receive'?'wh-bulk-receive-rows':'wh-bulk-dispense-rows');if(box)box.insertAdjacentHTML('beforeend',rowHtml(kind))}
 window.whBulkAddReceiveRow=function(){add('receive')};
 window.whBulkAddDispenseRow=function(){add('dispense')};
 window.whBulkResolveRow=function(input){
  var row=input.closest('tr'),m=byCode(input.value),cell=row.querySelector('.wh-match');row.dataset.medId=m?m.id:'';
  if(!m){cell.innerHTML=input.value.trim()?'<span class="wh-match-bad">No matching NUPCO/MOH code</span>':'<span class="wh-match-pending">Enter code</span>';return}
  var extra='';if(row.dataset.kind==='dispense'){var w=(ctlWarehouse()||{})[m.id]||{},available=ctlWarehouseQtyForFilter(w);row.dataset.available=available;extra=' · Available: <b>'+available+'</b>'}
  cell.innerHTML='<span class="wh-match-ok">'+esc(m.name||'')+'</span><div class="fhint">MOH: '+esc(m.moh||'—')+' · NUPCO: '+esc(m.nupco||'—')+extra+'</div>';
 };
 window.whBulkReceiveOpen=function(){
  if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
  var box=document.getElementById('wh-bulk-receive-rows');box.innerHTML='';for(var i=0;i<5;i++)add('receive');OM('mwh-bulk-receive');
 };
 window.whBulkDispenseOpen=function(){
  if(typeof ctlIsWarehouse==='function'&&!ctlIsWarehouse())return toast('Warehouse permission required','err');
  var box=document.getElementById('wh-bulk-dispense-rows');box.innerHTML='';for(var i=0;i<5;i++)add('dispense');OM('mwh-bulk-dispense');
 };
 function collect(id,kind){
  var rows=Array.from(document.querySelectorAll('#'+id+' .wh-bulk-row')),valid=[],errors=[];
  rows.forEach(function(r,i){var code=r.querySelector('.wh-code').value.trim(),medId=r.dataset.medId,qty=Number(r.querySelector('.wh-qty-input').value||0),expiry=r.querySelector('.wh-exp-input').value||'',lot=r.querySelector('.wh-lot-input').value.trim();if(!code&&!qty&&!expiry&&!lot)return;if(!medId)errors.push('Row '+(i+1)+': code not matched');else if(!(qty>0))errors.push('Row '+(i+1)+': quantity required');else if(kind==='dispense'&&!expiry)errors.push('Row '+(i+1)+': expiry required');else if(kind==='dispense'&&qty>Number(r.dataset.available||0))errors.push('Row '+(i+1)+': insufficient warehouse balance');else valid.push({medId:medId,code:code,qty:qty,expiry:expiry,lot:lot});});
  return {valid:valid,errors:errors};
 }
 window.whBulkReceiveSave=async function(){
  var c=collect('mwh-bulk-receive','receive');if(c.errors.length)return toast(c.errors.slice(0,3).join(' · '),'err');if(!c.valid.length)return toast('Add at least one valid row','err');
  var all=Object.assign({},ctlWarehouse()),moves=[];
  c.valid.forEach(function(it){var x=Object.assign({system:0,outside:0,batches:[]},all[it.medId]||{});x.system=ctlNum(x.system)+it.qty;x.outside=ctlNum(x.outside);x.batches=(x.batches||[]).map(function(b){return Object.assign({},b)});if(it.expiry){var same=x.batches.find(function(b){return String(b.expiry||'')===it.expiry&&String(b.lot||'')===it.lot});if(same)same.qty=ctlNum(same.qty)+it.qty;else x.batches.push({qty:it.qty,expiry:it.expiry,lot:it.lot,source:'system'})}all[it.medId]=x;moves.push({type:'warehouse_receive',medId:it.medId,qty:it.qty,source:'system',expiry:it.expiry||'',lot:it.lot||'',note:'Bulk warehouse receiving'})});
  try{await ctlSetWarehouse(all)}catch(e){console.error('Bulk warehouse receiving save failed',e);return toast('Warehouse balances were not updated.','err')}
  var movementSaved=await ctlSaveMovementLog(moves,'Bulk warehouse receiving');
  CM('mwh-bulk-receive');renderControlled();toast(movementSaved?c.valid.length+' medicine(s) received ✓':'Warehouse balances were updated, but the movement log could not be saved.',movementSaved?'succ':'info');return true
 };
 window.whBulkDispenseSave=async function(){
  var c=collect('mwh-bulk-dispense','dispense');if(c.errors.length)return toast(c.errors.slice(0,3).join(' · '),'err');if(!c.valid.length)return toast('Add at least one valid row','err');
  var original=ctlWarehouse()||{},next=Object.assign({},original),moves=[],requested={};c.valid.forEach(function(it){requested[it.medId]=ctlNum(requested[it.medId])+it.qty});
  var over=Object.keys(requested).find(function(id){return requested[id]>ctlWarehouseQtyForFilter(original[id]||{})});if(over){var med=(typeof ctlMedicine==='function'?ctlMedicine(over):null)||{};return toast('Combined quantity exceeds the available warehouse balance for '+(med.name||over)+'.','err')}
  c.valid.forEach(function(it){var x=Object.assign({system:0,outside:0,batches:[]},next[it.medId]||{}),fromSystem=Math.min(it.qty,ctlNum(x.system)),fromOutside=it.qty-fromSystem;x.system=ctlNum(x.system)-fromSystem;x.outside=ctlNum(x.outside)-fromOutside;next[it.medId]=x;moves.push({type:'warehouse_send',medId:it.medId,qty:it.qty,expiry:it.expiry,lot:it.lot,fromSystem:fromSystem,fromOutside:fromOutside,status:'pending',note:'Bulk sent to pharmacy; awaiting accept/reject'})});
  try{await ctlSetWarehouse(next);await ctlMove(moves)}catch(e){console.error('Bulk warehouse transfer failed',e);var rollbackFailed=false;try{await ctlSetWarehouse(original)}catch(err){rollbackFailed=true;console.error('Bulk warehouse rollback failed',err)}return toast(rollbackFailed?'Bulk transfer failed and rollback could not be confirmed. Review warehouse balances.':'Bulk transfer failed. Warehouse balances were restored.','err')}
  CM('mwh-bulk-dispense');renderControlled();toast(c.valid.length+' pending transfer(s) created ✓','succ');return true
 };
 function addButtons(){
  var card=document.getElementById('wh-receive-card');if(!card)return;var head=card.querySelector('.ch');if(!head||head.querySelector('.wh-bulk-buttons'))return;
  var wrap=document.createElement('div');wrap.className='fl g8 wh-bulk-buttons';wrap.innerHTML='<button class="btn bs" onclick="whBulkReceiveOpen()">+ Bulk receive / استلام متعدد</button><button class="btn bp" onclick="whBulkDispenseOpen()">⇢ Bulk dispense / صرف متعدد</button>';var old=head.querySelector('button[onclick="whReceiveOpen()"]');if(old)old.replaceWith(wrap);else head.appendChild(wrap);
 }
 window.addWarehouseControlledBulkButtons=addButtons;
})();

(function(){
'use strict';
var E=window.fsE;
var esc=window.fsEsc;
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function nowISO(){return window.fsNowISO?window.fsNowISO():new Date().toISOString()}

/* ══════════════════════════════════════════════════════════════
   2. New Request: idle timer 15 دقيقة
   - يبدأ العد عند أول تعامل مع الصفحة
   - يُعاد العد عند أي إدخال في الصفحة (input / change / click داخل rfbody)
   - لا يُمسح عند تحريك الماوس فقط
   - عند مرور 15 دقيقة تُحفظ المسودة تلقائيًا ولا تُمسح البيانات
══════════════════════════════════════════════════════════════ */
var IDLE_MS = 15 * 60 * 1000;   /* 15 دقيقة */
var _idleTimer=null, _warnEl=null;

function clearIdleTimers(){
  clearTimeout(_idleTimer);
  if(_warnEl){_warnEl.remove();_warnEl=null;}
}
function resetIdleTimer(){
  if(role()!=='department')return;
  clearIdleTimers();
  _idleTimer=setTimeout(function(){showIdleSavedNotice()}, IDLE_MS);
}
function showIdleSavedNotice(){
  var host=E('rfbody');if(!host)return;
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
  if(_warnEl){_warnEl.remove();}
  _warnEl=document.createElement('div');
  _warnEl.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:20000;background:#1d4ed8;color:#fff;padding:14px 24px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 4px 20px #0006;text-align:center';
  _warnEl.innerHTML='<div dir="rtl">💾 تم حفظ مسودة الطلب تلقائيًا، ولن تُمسح بسبب عدم التفاعل.</div><div dir="ltr">The request draft was saved automatically and will not be cleared because of inactivity.</div>';
  document.body.appendChild(_warnEl);
  setTimeout(function(){if(_warnEl){_warnEl.remove();_warnEl=null}resetIdleTimer()},5000);
}

/* ربط الأحداث بصفحة الطلب فقط */
function attachIdleListeners(){
  var host=E('rfbody');if(!host||host._v14IdleAttached)return;
  host._v14IdleAttached=true;
  ['input','change','click'].forEach(function(ev){
    host.addEventListener(ev,function(){resetIdleTimer()},{passive:true});
  });
  resetIdleTimer();
}
window.refreshRequestIdleTimer=function(){clearIdleTimers();attachIdleListeners()};
window.clearRequestIdleTimer=clearIdleTimers;

/* ══════════════════════════════════════════════════════════════
   Request Count Limits — rolling 24 hours and rolling 7 days
══════════════════════════════════════════════════════════════ */
var REQUEST_COUNT_LIMITS_KEY='request_count_limits_v1';
function requestLimitNumber(value){value=Number(value);return isFinite(value)&&value>0?Math.floor(value):null}
function getRequestCountLimits(){
  var current=(window.S&&S.g?S.g(REQUEST_COUNT_LIMITS_KEY):null)||{};
  var weekly=(window.S&&S.g?S.g('weekly_limits_v2'):null)||{};
  var daily=(window.S&&S.g?S.g('daily_limits_v2'):null)||{};
  var result={};
  Object.keys(current).forEach(function(id){
    var row=current[id]||{};
    result[id]={per24Hours:requestLimitNumber(row.per24Hours),per7Days:requestLimitNumber(row.per7Days)};
  });
  Object.keys(daily).forEach(function(id){
    result[id]=result[id]||{};
    if(!result[id].per24Hours)result[id].per24Hours=requestLimitNumber(daily[id]);
  });
  Object.keys(weekly).forEach(function(id){
    result[id]=result[id]||{};
    if(!result[id].per7Days)result[id].per7Days=requestLimitNumber(weekly[id]);
  });
  return result;
}
async function migrateRequestCountLimits(){
  if(!window.S||typeof S.s!=='function')return getRequestCountLimits();
  var merged=getRequestCountLimits();
  await S.s(REQUEST_COUNT_LIMITS_KEY,merged);
  if(typeof S.rm==='function'){
    await Promise.all([
      S.rm('weekly_limits_v2'),
      S.rm('daily_limits_v2'),
      S.rm('rate_limits_v2')
    ]);
  }
  return merged;
}
function requestCreatedTime(request){
  var value=request&&(request.created||request.createdAt||request.submittedAt);
  var time=new Date(value||0).getTime();
  return isFinite(time)?time:0;
}
function getRollingRequestCount(deptId,milliseconds){
  var threshold=Date.now()-milliseconds;
  return (typeof gr==='function'?(gr()||[]):[]).filter(function(request){
    return String(request.deptId)===String(deptId)&&requestCreatedTime(request)>=threshold;
  }).length;
}
window.getRequestCountLimits=getRequestCountLimits;
window.getRollingRequestCount=getRollingRequestCount;
window.checkRequestCountLimits=function(deptId){
  var limits=getRequestCountLimits()[deptId]||{};
  var used24=getRollingRequestCount(deptId,24*60*60*1000);
  var used7=getRollingRequestCount(deptId,7*24*60*60*1000);
  var limit24=requestLimitNumber(limits.per24Hours);
  var limit7=requestLimitNumber(limits.per7Days);
  if(limit24&&used24>=limit24){
    return {blocked:true,period:'24h',used:used24,limit:limit24,reason:'وصلت إلى الحد الأعلى المسموح للطلبات خلال 24 ساعة. إذا كنت قد رفعت طلبًا سابقًا، يمكنك تعديله قبل إغلاق نافذة الطلب.\nYou have reached the maximum number of requests allowed within 24 hours. If you previously submitted a request, you can edit it before the request window closes.'};
  }
  if(limit7&&used7>=limit7){
    return {blocked:true,period:'7d',used:used7,limit:limit7,reason:'وصلت إلى الحد الأعلى المسموح للطلبات خلال آخر 7 أيام. إذا كنت قد رفعت طلبًا سابقًا، يمكنك تعديله قبل إغلاق نافذة الطلب.\nYou have reached the maximum number of requests allowed during the last 7 days. If you previously submitted a request, you can edit it before the request window closes.'};
  }
  return {
    blocked:false,
    used24:used24,limit24:limit24,remaining24:limit24?Math.max(0,limit24-used24):null,
    used7:used7,limit7:limit7,remaining7:limit7?Math.max(0,limit7-used7):null
  };
};
window.renderRequestCountLimitsSection=function(){
  var host=E('pg-schedule');if(!host)return;
  ['v14-weekly-limits-section','v14-daily-limits-section','r18-request-count-limits-section'].forEach(function(id){var old=E(id);if(old)old.remove()});
  var limits=getRequestCountLimits();
  var rows=(typeof gd==='function'?(gd()||[]):[]).map(function(department){
    var row=limits[department.id]||{};
    var used24=getRollingRequestCount(department.id,24*60*60*1000);
    var used7=getRollingRequestCount(department.id,7*24*60*60*1000);
    var max24=requestLimitNumber(row.per24Hours),max7=requestLimitNumber(row.per7Days);
    return '<tr>'+ 
      '<td style="font-weight:600">'+esc(department.name||department.id)+'</td>'+ 
      '<td><input type="number" class="r18-limit-24" data-dept="'+esc(department.id)+'" min="1" value="'+(max24||'')+'" placeholder="∞" style="width:95px;margin:0;padding:5px 7px"></td>'+ 
      '<td style="font-family:var(--mono)">'+used24+'</td>'+ 
      '<td style="font-family:var(--mono);font-weight:700">'+(max24?Math.max(0,max24-used24):'∞')+'</td>'+ 
      '<td><input type="number" class="r18-limit-7" data-dept="'+esc(department.id)+'" min="1" value="'+(max7||'')+'" placeholder="∞" style="width:95px;margin:0;padding:5px 7px"></td>'+ 
      '<td style="font-family:var(--mono)">'+used7+'</td>'+ 
      '<td style="font-family:var(--mono);font-weight:700">'+(max7?Math.max(0,max7-used7):'∞')+'</td>'+ 
    '</tr>';
  }).join('');
  var section=document.createElement('div');
  section.id='r18-request-count-limits-section';
  section.innerHTML='<div class="card" style="margin-top:18px">'+
    '<div class="ch"><div><span class="ct">Request Count Limits / حدود عدد الطلبيات</span><div class="fhint">Rolling windows: the previous 24 hours and previous 7 × 24 hours. Leave blank for unlimited.</div></div><button class="btn bs bsm" type="button" onclick="saveRequestCountLimits()">Save / حفظ</button></div>'+ 
    '<div class="cb"><div class="tw"><table><thead><tr>'+ 
      '<th>Department</th><th>Max / 24h</th><th>Used / 24h</th><th>Remaining</th>'+ 
      '<th>Max / 7 days</th><th>Used / 7d</th><th>Remaining</th>'+ 
    '</tr></thead><tbody>'+rows+'</tbody></table></div></div></div>';
  host.appendChild(section);
  /* Rendering Schedule is read-only; legacy values are merged in memory without permission-triggering writes. */
};
window.saveRequestCountLimits=async function(){
  var result={};
  document.querySelectorAll('.r18-limit-24,.r18-limit-7').forEach(function(input){
    var id=input.dataset.dept;
    result[id]=result[id]||{};
    var value=requestLimitNumber(input.value);
    if(input.classList.contains('r18-limit-24')&&value)result[id].per24Hours=value;
    if(input.classList.contains('r18-limit-7')&&value)result[id].per7Days=value;
  });
  Object.keys(result).forEach(function(id){if(!result[id].per24Hours&&!result[id].per7Days)delete result[id]});
  try{
    await S.s(REQUEST_COUNT_LIMITS_KEY,result);
    if(typeof toast==='function')toast('24-hour and 7-day limits saved ✓','succ');
    if(typeof renderSchedule==='function')renderSchedule();
  }catch(error){
    console.error(error);
    if(typeof toast==='function')toast('Request count limits were not saved.','err');
  }
};
window.refreshRequestCountLimitWarning=function(){
  if(!window.CU||role()!=='department')return;
  var old=E('r18-request-limit-warning');if(old)old.remove();
  var host=E('rfbody');if(!host)return;
  var check=window.checkRequestCountLimits(CU.deptId);
  if(!check.blocked&&!check.limit24&&!check.limit7)return;
  var warning=document.createElement('div');
  warning.id='r18-request-limit-warning';
  warning.className='r18-request-limit-warn'+(check.blocked?' blocked':'');
  if(check.blocked)warning.textContent='🚫 '+check.reason;
  else{
    var parts=[];
    if(check.limit24)parts.push('24h: '+check.used24+'/'+check.limit24+' · remaining '+check.remaining24);
    if(check.limit7)parts.push('7d: '+check.used7+'/'+check.limit7+' · remaining '+check.remaining7);
    var arParts=[];
    if(check.limit24)arParts.push('خلال 24 ساعة: '+check.used24+' من '+check.limit24+' · المتبقي '+check.remaining24);
    if(check.limit7)arParts.push('خلال 7 أيام: '+check.used7+' من '+check.limit7+' · المتبقي '+check.remaining7);
    warning.textContent='📋 '+arParts.join(' | ')+'\n'+parts.join(' | ');
  }
  host.insertAdjacentElement('beforebegin',warning);
};

/* Compatibility entry point: request editing now has one authoritative policy.
   Pending requests are editable only while the department ordering window is open. */
window.opsEditRequest=function(id){
  if(typeof window.v16EditRequest==='function')return window.v16EditRequest(id);
  return typeof toast==='function'?toast('Request editing is not available yet. Please reopen My Requests.','err'):null;
};
window.v14SaveEditReq2=function(){
  return typeof toast==='function'?toast('This legacy editor has been retired. Reopen the request from My Requests.','err'):null;
};



})();

// --- Merged from 04-v13-complete-clean-fix-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function classIcons(m){var h='<span class="v13-class-icons">';if(m&&m.high_alert)h+='<span class="v13-ci v13-ha" title="High Alert">HA</span>';if(m&&m.lasa)h+='<span class="v13-ci v13-lasa" title="LASA">LASA</span>';if(m&&m.refrigerated)h+='<span class="v13-ci v13-ref" title="Refrigerator">❄</span>';if(m&&m.hazard)h+='<span class="v13-ci v13-haz" title="Hazard">⚠</span>';return h+'</span>'}

window.receiveFulfilledRequest=function(id){var req=(typeof gr==='function'?gr():[]).find(function(x){return x.id===id});if(!req||!window.CU||req.deptId!==CU.deptId)return toast('Request not available','err');E('v13-receive-modal').dataset.requestId=String(id);var meds=getMeds(CU.deptId),rows=(req.dispensed||[]).filter(function(x){return Number(x.qty)>0}).map(function(d,i){var m=meds.find(function(x){return x.id===d.medId})||{};return '<tr data-med="'+d.medId+'" data-qty="'+Number(d.qty||0)+'"><td>'+(i+1)+'</td><td><b>'+esc(m.name||d.medId)+'</b>'+classIcons(m)+'</td><td>'+Number(d.qty||0)+'</td><td><input class="v13-r-exp" type="date"></td><td><input class="v13-r-lot" placeholder="Optional"></td></tr>'}).join('');E('v13-receive-meta').textContent='Request '+id+' — enter all expiry dates and batch numbers, then confirm once.';E('v13-receive-body').innerHTML=rows||'<tr><td colspan="5">No dispensed items</td></tr>';OM('v13-receive-modal')};
})();


// --- Merged from 36-v14dp-main.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
const esc=globalThis.esc;
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}

/* ══════════════════════════════════════════════════════════════
   2. صفحة الطباعة: عزل Fulfilled
   - الطلبات المكتملة (fulfilled) تعلو الجدول بتمييز أخضر
   - زر فلتر: الكل / Fulfilled فقط / اليوم
   - نسخ renderPrint
══════════════════════════════════════════════════════════════ */
var _v14PrintFilter='today'; /* default for all print users: fulfilled today */

window.renderPrint=function(){
  /* أصل renderPrint */
  var purgeBtn=E('purge-old-orders-btn');
  if(purgeBtn)purgeBtn.style.display=(window.CU&&CU.master===true)?'inline-flex':'none';

  var allReqs=(typeof gr==='function'?gr():[]).slice().reverse();
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();allReqs=allReqs.filter(function(r){return String(r.deptId)===String(opd)})}
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();allReqs=allReqs.filter(function(r){return String(r.deptId)===String(opd)})}
  var fulfilled=allReqs.filter(function(r){return r.status==='fulfilled'||r.status==='partial'}).sort(function(a,b){return new Date(b.fulfilledAt||b.created||0)-new Date(a.fulfilledAt||a.created||0)});
  var pending=allReqs.filter(function(r){return r.status==='pending'}).sort(function(a,b){return new Date(b.created||0)-new Date(a.created||0)});

  var today=new Date().toISOString().slice(0,10);

  /* بناء صفوف الجدول */
  function buildRow(r,cls){
    var dept=(typeof gd==='function'?gd():[]).find(function(x){return x.id===r.deptId});
    var nn=(r.dispensed||[]).filter(function(x){return x.qty>0}).length;
    var date=typeof fmtDateTime==='function'?fmtDateTime(r.created):r.created;
    var ful=r.fulfilledAt?(typeof fmtDate==='function'?fmtDate(r.fulfilledAt):r.fulfilledAt):'—';
    return '<tr class="'+cls+'">'
      +'<td><input type="checkbox" class="pchk" data-id="'+esc(r.id)+'"></td>'
      +'<td>'+esc((dept&&dept.name)||r.deptId)+'</td>'
      +'<td>'+esc(date)+'</td>'
      +'<td>'+esc(ful)+'</td>'
      +'<td>'+nn+' items</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(r.printCount||0)+'</td>'
      +'</tr>';
  }

  var fRows='',pRows='';
  var todayFulfilled=fulfilled.filter(function(r){return (r.fulfilledAt||r.created||'').slice(0,10)===today});

  if(_v14PrintFilter==='today'){
    fRows=todayFulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else if(_v14PrintFilter==='fulfilled'){
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else {
    /* all: fulfilled أولاً ثم pending */
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
    pRows=pending.map(function(r){return buildRow(r,'v14-ptbl-pending')}).join('');
  }

  var tbl=E('ptbl');
  if(!tbl)return;

  /* إضافة شريط الفلتر فوق الجدول */
  var card=tbl.closest('.card');
  if(card){
    var existFilter=E('v14-print-filter');
    if(!existFilter){
      var filterBar=document.createElement('div');filterBar.id='v14-print-filter';
      filterBar.innerHTML=
        '<span style="font-size:12px;font-weight:700;color:var(--tx2)">Show:</span>'
        +'<button class="btn bg bsm" id="v14-pf-fulfilled" onclick="v14SetPrintFilter(\'fulfilled\')">✅ Fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-today" onclick="v14SetPrintFilter(\'today\')">📅 Today\'s fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-all" onclick="v14SetPrintFilter(\'all\')">All requests</button>'
        +'<span style="font-size:11px;color:var(--tx2);margin-inline-start:8px">'
        +'✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length
        +'</span>';
      card.querySelector('.ch').insertAdjacentElement('afterend',filterBar);
    } else {
      /* حدّث الأرقام */
      var stat=existFilter.querySelector('span:last-child');
      if(stat)stat.textContent='✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length;
    }
    /* أضء الزر النشط */
    ['fulfilled','today','all'].forEach(function(f){
      var btn=E('v14-pf-'+f);if(!btn)return;
      btn.classList.toggle('on',f===_v14PrintFilter);
    });
  }

  /* بناء الـ tbody */
  if(fRows||pRows){
    tbl.innerHTML=
      (fRows?'<tr id="v14-ptbl-fulfilled-head"><td colspan="6">✅ Fulfilled Requests</td></tr>'+fRows:'')
      +(pRows?'<tr id="v14-ptbl-pending-head" style="background:var(--s2)"><td colspan="6" style="padding:6px 10px;font-weight:800;font-size:12px;color:var(--tx2)">⏳ Pending Requests</td></tr>'+pRows:'');
  } else {
    tbl.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx2);padding:18px">No requests found</td></tr>';
  }
};

window.v14SetPrintFilter=function(f){
  _v14PrintFilter=f;
  if(typeof window.renderPrint==='function')window.renderPrint();
};


})();

export {};
export {};

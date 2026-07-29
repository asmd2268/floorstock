(function(){
'use strict';
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
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

/* Requests: editable only until the submitting schedule window closes or fulfillment, whichever happens first. */
function reqs(){return typeof gr==='function'?(gr()||[]):[]}
function canEditReq(r){if(!(deptUser()||mgr()))return false;if(typeof window.canEditRequestBySchedule==='function')return window.canEditRequestBySchedule(r,Date.now());if(!r||r.status!=='pending'||r.fulfilledAt||r.fulfilled)return false;return typeof window.isRequestAllowed==='function'&&window.isRequestAllowed(r.deptId).allowed}
function requestCard(r){var selector=deptUser()?'#mrlst .card':'#rlist .card';return Array.from(document.querySelectorAll(selector)).find(function(c){return (c.innerHTML||'').indexOf(String(r.id))>-1})}
function enhanceRequests(){
 if(E('pg-reqs')&&mgr()&&!E('v16-req-filter')){var host=E('pg-reqs').querySelector('.tgrp');var f=document.createElement('div');f.id='v16-req-filter';f.className='fl g8';f.style.cssText='flex-wrap:wrap;margin-bottom:12px';f.innerHTML='<select id="v16-r-status" class="psel"><option value="all">All statuses</option><option value="pending">Pending</option><option value="fulfilled">Fulfilled</option></select><select id="v16-r-age" class="psel"><option value="all">All dates</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select><input id="v16-r-search" placeholder="Search department/request" style="margin:0;max-width:260px">';f.querySelectorAll('select,input').forEach(function(control){control.addEventListener(control.tagName==='INPUT'?'input':'change',window.v16FilterRequests)});host.parentNode.insertBefore(f,host.nextSibling)}
 reqs().forEach(function(r){var card=requestCard(r);if(!card)return;card.dataset.v16RequestId=r.id;card.querySelectorAll('[data-delete-request],button').forEach(function(b){if(b.matches('[data-request-action="master-delete"],[data-request-action="edit-fulfillment"]')||/Delete with reason|Delete request/i.test(b.textContent||''))b.remove()});var bar=card.querySelector('.ch .fl,.ch');if(!bar)return;if(canEditReq(r)&&!bar.querySelector('[data-v16-edit]')){var e=document.createElement('button');e.className='btn bg bsm';e.dataset.v16Edit=r.id;e.dataset.requestAction='v16-edit';e.dataset.id=r.id;e.textContent='✏ Edit until request window closes';bar.appendChild(e)}if(mgr()&&!bar.querySelector('[data-v16-delete]')){var d=document.createElement('button');d.className='btn bd2c bsm';d.dataset.v16Delete=r.id;d.dataset.requestAction='v16-delete';d.dataset.id=r.id;d.textContent='🗑 Delete';bar.appendChild(d)}});if(deptUser())document.querySelectorAll('#mrlst button').forEach(function(b){if(/Delete with reason|Delete request/i.test(b.textContent||''))b.remove()});window.v16FilterRequests()}
window.v16FilterRequests=function(){var st=(E('v16-r-status')||{}).value||'all',age=(E('v16-r-age')||{}).value||'all',q=norm((E('v16-r-search')||{}).value||'');document.querySelectorAll('#rlist .card[data-v16-request-id]').forEach(function(c){var r=reqs().find(function(x){return String(x.id)===String(c.dataset.v16RequestId)});if(!r)return;var ok=st==='all'||r.status===st;if(age!=='all'){var t=new Date(r.created||r.createdAt||0),days=(Date.now()-t.getTime())/86400000;ok=ok&&(age==='today'?t.toDateString()===new Date().toDateString():days<=Number(age))}if(q)ok=ok&&norm(c.textContent).indexOf(q)>-1;c.style.display=ok?'':'none'})};
window.v16DeleteRequest=function(id){var r=reqs().find(function(x){return String(x.id)===String(id)});if(!r)return;var meds=getMeds(r.deptId)||[],items=(r.dispensed&&r.dispensed.length?r.dispensed:r.items)||[];document.body.insertAdjacentHTML('beforeend','<div class="modal-bg on" id="v16-delete-request"><div class="modal" style="width:min(760px,96vw)"><div class="mh"><span class="mt">Confirm request deletion / تأكيد حذف الطلب</span><button class="xbtn" data-request-action="close-request-modal">×</button></div><div class="tw"><table><thead><tr><th>Medication</th><th>Qty</th></tr></thead><tbody>'+items.map(function(it){var m=meds.find(function(x){return String(x.id)===String(it.medId)});return '<tr><td>'+esc(m&&m.name||it.medId)+'</td><td>'+esc(it.qty)+'</td></tr>'}).join('')+'</tbody></table></div><label style="margin-top:10px">Deletion reason sent to department / سبب الحذف</label><textarea id="v16-del-reason" rows="3"></textarea><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" data-request-action="close-request-modal">Cancel</button><button class="btn bd2c" data-request-action="v16-confirm-delete" data-id="'+esc(id)+'">Delete request</button></div></div></div>')};
window.v16ConfirmDelete=async function(id){var reason=((E('v16-del-reason')||{}).value||'').trim();if(!reason)return toast('Enter deletion reason.','err');var all=reqs().slice(),r=all.find(function(x){return String(x.id)===String(id)});if(!r)return;await set('requests',all.filter(function(x){return String(x.id)!==String(id)}));var log=get('deleted_request_audit_v4',[])||[];log.push({request:r,reason:reason,deletedAt:now(),deletedBy:CU.username||''});await set('deleted_request_audit_v4',log);var notes=get('department_request_notifications_v1',[])||[];notes.push({id:'rn_'+Date.now(),deptId:r.deptId,requestId:id,type:'deleted',reason:reason,createdAt:now(),read:false});await set('department_request_notifications_v1',notes);E('v16-delete-request').remove();renderReqs();toast('Request deleted; department notified; daily limit reset ✓','succ')};
window.v16EditRequest=function(id){var r=reqs().find(function(x){return String(x.id)===String(id)});if(!r||!canEditReq(r))return toast('Editing window closed.','err');var meds=getMeds(r.deptId)||[],src=r.status==='fulfilled'?(r.dispensed||[]):(r.items||[]),map={};src.forEach(function(x){map[String(x.medId)]=Number(x.qty)||0});var rows=meds.map(function(m){return '<tr><td>'+esc(m.name)+'</td><td><input class="v16-edit-qty" data-med="'+esc(m.id)+'" type="number" min="0" max="'+esc(m.max||9999)+'" value="'+esc(map[String(m.id)]||0)+'" style="margin:0"></td></tr>'}).join('');document.body.insertAdjacentHTML('beforeend','<div class="modal-bg on" id="v16-edit-request"><div class="modal" style="width:min(820px,97vw)"><div class="mh"><span class="mt">Edit request</span><button class="xbtn" data-request-action="close-request-modal">×</button></div><div class="tw" style="max-height:60vh;overflow:auto"><table><thead><tr><th>Medication</th><th>Qty</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" data-request-action="close-request-modal">Cancel</button><button class="btn bs" data-request-action="v16-save-edit" data-id="'+esc(id)+'">Save</button></div></div></div>')};
window.v16SaveEdit=async function(id){var all=reqs().slice(),i=all.findIndex(function(x){return String(x.id)===String(id)});if(i<0||!canEditReq(all[i]))return toast('Editing window closed.','err');var arr=Array.from(document.querySelectorAll('.v16-edit-qty')).map(function(x){return {medId:x.dataset.med,qty:Number(x.value)||0}}).filter(function(x){return x.qty>0});if(!arr.length)return toast('At least one item is required.','err');if(all[i].status==='fulfilled')all[i].dispensed=arr;else all[i].items=arr;all[i].editedAt=now();all[i].editedBy=CU.username||'';await set('requests',all);E('v16-edit-request').remove();if(typeof renderReqs==='function')renderReqs();if(typeof renderMyReqs==='function')renderMyReqs();toast('Request updated ✓','succ')};

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
 if(mgr()){var open=(typeof crashReports==='function'?(crashReports()||[]):[]).filter(function(r){return r.status==='open'});var a=E('crash-open-alerts');if(a)a.innerHTML=open.length?'<div class="alert-banner"><b>'+open.length+'</b> open Crash Cart report(s) / بلاغات فتح عربة طوارئ مفتوحة: '+open.map(function(r){var d=(gd()||[]).find(function(x){return String(x.id)===String(r.deptId)}),c=(typeof crashCarts==='function'?(crashCarts()||[]):[]).find(function(x){return String(x.id)===String(r.cartId)});return esc(d&&d.name||(c&&c.name?c.name+' — '+r.deptId:r.deptId))}).join(', ')+'</div>':''}
}
/* Crash response save is handled by the authoritative idempotent path. */

/* Monthly check reminder */
function crashMonthlyReminder(){if(!mgr())return;var parts={};try{new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()).forEach(function(p){if(p.type!=='literal')parts[p.type]=Number(p.value)})}catch(e){}var d=parts.year?new Date(parts.year,parts.month-1,parts.day):new Date(),last=new Date(d.getFullYear(),d.getMonth()+1,0),days=last.getDate()-d.getDate();if(days>7)return;var a=E('crash-open-alerts');if(a&&!E('v16-monthly-check')){var x=document.createElement('div');x.id='v16-monthly-check';x.className='alert-banner-y';x.innerHTML='<b>Monthly Check / الفحص الشهري:</b> '+days+' day(s) remaining until month end / متبقي '+days+' يوم حتى نهاية الشهر.';a.prepend(x)}}

function activePageId(){var p=document.querySelector('.pg.on');return p&&p.id||''}
function afterRender(){
 var page=activePageId();
 if(page==='pg-inv'){ensureInventoryTools();enhanceCategories();return}
 if(page==='pg-reqs'||page==='pg-myreqs'){enhanceRequests();return}
 if(page==='pg-schedule'){enhanceSchedule();return}
 if(page==='pg-crashcart'){unifyCrashMedicationNames();polishDepartment();enhanceCrash();crashMonthlyReminder()}
}
var afterRenderScheduled=false;
function scheduleAfterRender(){if(afterRenderScheduled)return;afterRenderScheduled=true;var run=function(){afterRenderScheduled=false;afterRender()};Promise.resolve().then(run)}


window.schedulePagePostRender=scheduleAfterRender;

})();

export {};

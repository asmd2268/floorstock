(function(){
'use strict';
var dirty=false,saving=false,restoring=false,timer=null;
function root(){return document.getElementById('r17-accountability-root')}
function active(){var page=document.getElementById('pg-med-accountability');return !!(page&&page.classList.contains('on'))}
function accountId(){var user=window.FB_AUTH&&window.FB_AUTH.currentUser;return String(user&&user.uid||(window.CU&&(CU.id||CU.uid||CU.username))||'anonymous')}
function storageKey(){return 'asdh_accountability_draft_'+accountId()}
function controls(){var host=root();return host?Array.from(host.querySelectorAll('input,select,textarea')).filter(function(node){return node.type!=='hidden'&&node.type!=='button'&&node.type!=='submit'}):[]}
function keyFor(node,index){return node.id||[node.dataset.acc2||'',node.dataset.assignment||'',node.dataset.acc2RegimenAssignment||'',node.dataset.dept||'',node.name||'',index].join('|')}
function snapshot(){return controls().map(function(node,index){return {key:keyFor(node,index),index:index,type:node.type||node.tagName,value:node.value,checked:!!node.checked}})}
function hasDraft(rows){return rows.some(function(row){return row.type==='checkbox'?row.checked:String(row.value||'').trim()!==''})}
function read(){try{return JSON.parse(sessionStorage.getItem(storageKey())||localStorage.getItem(storageKey())||'null')}catch(error){return null}}
function persist(){if(!dirty||restoring)return;var rows=snapshot();if(!hasDraft(rows)){clear();return}var raw=JSON.stringify({rows:rows,at:new Date().toISOString()});try{sessionStorage.setItem(storageKey(),raw)}catch(error){}try{localStorage.setItem(storageKey(),raw)}catch(error){}}
function clear(){dirty=false;clearTimeout(timer);try{sessionStorage.removeItem(storageKey())}catch(error){}try{localStorage.removeItem(storageKey())}catch(error){}indicator()}
function indicator(){var host=root();if(!host)return;var node=document.getElementById('r662-accountability-draft');if(!node){node=document.createElement('div');node.id='r662-accountability-draft';node.className='alert-banner-y';host.parentNode.insertBefore(node,host)}node.textContent='Draft saved locally — live refresh will not erase what you are entering. / تم حفظ النموذج مؤقتًا ولن يمسح التحديث اللحظي ما تكتبه.';node.style.display=dirty?'':'none'}
function restore(){var draft=read(),host=root();if(!draft||!Array.isArray(draft.rows)||!host)return;var nodes=controls();restoring=true;try{draft.rows.forEach(function(row){var node=nodes.find(function(item,index){return keyFor(item,index)===row.key})||nodes[row.index];if(!node)return;if(row.type==='checkbox')node.checked=!!row.checked;else node.value=row.value==null?'':row.value});dirty=hasDraft(draft.rows);indicator()}finally{restoring=false}}
function markDirty(){if(!active()||saving||restoring)return;dirty=true;clearTimeout(timer);timer=setTimeout(persist,120);indicator()}
document.addEventListener('input',function(event){if(event.target&&event.target.closest&&event.target.closest('#r17-accountability-root'))markDirty()},true);
document.addEventListener('change',function(event){if(event.target&&event.target.closest&&event.target.closest('#r17-accountability-root'))markDirty()},true);
var previousProtect=window.floorstockShouldProtectAutoRefresh;
window.floorstockShouldProtectAutoRefresh=function(pageId){if(pageId==='pg-med-accountability'&&dirty&&!saving){persist();indicator();return true}return typeof previousProtect==='function'?previousProtect(pageId):false};
var previousRestore=window.restorePageTransientUi;
window.restorePageTransientUi=function(pageId){if(typeof previousRestore==='function')previousRestore(pageId);if(pageId==='pg-med-accountability')setTimeout(restore,0)};
function dataHash(){if(!window.S||!S.g)return '';try{return JSON.stringify(['accountability_assignments_v2','accountability_usage_v2','accountability_receipts_v2','accountability_regimens_v2'].map(function(key){return S.g(key)||[]}))}catch(error){return ''}}
function wrapSave(name){var original=window[name];if(typeof original!=='function'||original.__r662)return;var wrapped=async function(){var before=dataHash();saving=true;try{var result=await original.apply(this,arguments);if(dataHash()!==before)clear();return result}finally{saving=false}};wrapped.__r662=true;window[name]=wrapped}
['acc2SaveAssignment','acc2SaveRegimenVersion','acc2SubmitUsage','acc2CreateReceipt','acc2Decision'].forEach(wrapSave);
window.clearAccountabilityDraft=clear;
window.addEventListener('beforeunload',persist);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')persist()});
setTimeout(function(){if(active())restore()},0);
})();

export {};

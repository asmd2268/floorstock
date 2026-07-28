(function(){
'use strict';
var dirty=false,saving=false;
function root(){return document.getElementById('r17-accountability-root')}
function active(){var page=document.getElementById('pg-med-accountability');return !!(page&&page.classList.contains('on'))}
function dataHash(){
  if(!window.S||!S.g)return '';
  var keys=['accountability_assignments_v2','accountability_usage_v2','accountability_receipts_v2','accountability_regimens_v2'];
  try{return JSON.stringify(keys.map(function(k){return S.g(k)||[]}))}catch(e){return ''}
}
function indicator(){
  var r=root();if(!r)return null;var el=document.getElementById('r662-accountability-draft');
  if(!el){el=document.createElement('div');el.id='r662-accountability-draft';el.textContent='Unsaved form protected — background refresh is paused / النموذج غير محفوظ — تم إيقاف التحديث التلقائي';r.parentNode.insertBefore(el,r)}
  el.classList.toggle('on',dirty);return el
}
function markDirty(){if(!active()||saving)return;dirty=true;indicator()}
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('#r17-accountability-root'))markDirty()},true);
document.addEventListener('change',function(e){if(e.target&&e.target.closest&&e.target.closest('#r17-accountability-root'))markDirty()},true);
var originalRefresh=window.refreshCurrentPage;
if(typeof originalRefresh==='function')window.refreshCurrentPage=refreshCurrentPage=function(){
  if(active()&&dirty&&!saving){indicator();return false}
  return originalRefresh.apply(this,arguments)
};
function wrapSave(name){
  var original=window[name];if(typeof original!=='function'||original.__r662)return;
  var wrapped=async function(){
    var before=dataHash();saving=true;
    try{var result=await original.apply(this,arguments),after=dataHash();if(after!==before){dirty=false;setTimeout(indicator,0)}return result}
    finally{saving=false}
  };wrapped.__r662=true;window[name]=wrapped
}
['acc2SaveAssignment','acc2SaveRegimenVersion','acc2SubmitUsage','acc2CreateReceipt','acc2Decision'].forEach(wrapSave);
var previousStart=window.startApp;
if(typeof previousStart==='function')window.startApp=function(){var result=previousStart.apply(this,arguments);setTimeout(indicator,700);return result};
window.addEventListener('beforeunload',function(e){if(!dirty)return;e.preventDefault();e.returnValue=''});
})();








export {};

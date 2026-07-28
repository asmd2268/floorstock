/* ASDHealth R6.65 Modular
 * Original script position: 36
 * Original id: v13-ap-custodian-bulk-replacement-fix
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
'use strict';
function E(id){return document.getElementById(id)}
function isOfficer(){return !!(window.CU&&CU.role==='controlled_pharmacy')}
function addBulkReplacement(){
  var old=E('v13-ap-bulk-replacement-btn');
  if(!isOfficer()||String(window.CTL_VIEW||'')!=='departments'){
    if(old)old.remove();
    return;
  }
  var table=E('ctl-dept-table');
  var card=table&&table.closest('.card');
  if(!card)return;
  var header=card.querySelector('.ch .fl')||card.querySelector('.ch');
  if(!header)return;
  if(!old){
    old=document.createElement('button');
    old.id='v13-ap-bulk-replacement-btn';
    old.type='button';
    old.className='btn bg bsm';
    old.innerHTML='⇄ Bulk Replacement';
    old.onclick=function(){
      if(typeof window.openBulkReplacement==='function')return window.openBulkReplacement();
      if(typeof window.toast==='function')toast('Bulk Replacement is unavailable.','err');
    };
    header.appendChild(old);
  }
}

window.ensureControlledBulkReplacementButton=addBulkReplacement;
})();

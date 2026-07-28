(function(){
'use strict';
function E(id){return document.getElementById(id)}
function escV(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function canManage(){return window.fsCanManage?window.fsCanManage():false}
var selectedRows=new Map();


/* Classification-only option inside Bulk Replacement. */
function extendBulkReplacement(){var modal=E('mbulk-replacement');if(!modal||E('v13q-br-class-only'))return;var preview=E('br-preview');if(!preview)return;var box=document.createElement('div');box.className='card';box.style.marginBottom='12px';box.innerHTML='<div class="cb" style="padding:12px"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="v13q-br-class-only" style="width:auto;margin:0"> Classifications only — keep medication names</label><div class="v13q-flags"><label><input type="checkbox" class="v13q-br-flag" value="high_alert"> High Alert</label><label><input type="checkbox" class="v13q-br-flag" value="lasa"> LASA</label><label><input type="checkbox" class="v13q-br-flag" value="refrigerated"> Refrigerator</label><label><input type="checkbox" class="v13q-br-flag" value="hazard"> Hazard</label></div><button type="button" class="btn bp bsm" onclick="v13BulkReplacementClassOnly()">Apply classifications only</button></div>';preview.parentNode.insertBefore(box,preview)}
window.extendBulkReplacementUi=extendBulkReplacement;
window.v13BulkReplacementClassOnly=async function(){var old=(E('br-old')||{}).value;if(!old)return toast('Choose a medication first.','err');var chosen=Array.from(document.querySelectorAll('.v13q-br-flag:checked')).map(function(x){return x.value});if(!chosen.length)return toast('Select at least one classification.','err');var count=0;for(var d of (gd()||[])){var meds=(getMeds(d.id)||[]).slice(),changed=false;meds=meds.map(function(m){var k=String(m.name||'').trim().toLowerCase()+'|'+String(m.strength||m.dose||'').trim().toLowerCase();if(k!==old)return m;var n=Object.assign({},m);['high_alert','lasa','refrigerated','hazard'].forEach(function(f){n[f]=chosen.indexOf(f)>-1});changed=true;count++;return n});if(changed)await setMeds(d.id,meds)}CM('mbulk-replacement');toast(count+' medication record(s) reclassified; names unchanged.','succ');if(typeof renderInv==='function')renderInv()};


/* Reliable Pharmacy Custody view using the existing stock editor. */

/* Extend controlled bulk edit with classification-only action. */
function extendControlledBulk(){var modal=E('v13-final-bulk-modal');if(!modal||E('v13q-ctl-class-op'))return;var scope=E('v13-final-bulk-scope');if(!scope)return;var box=document.createElement('div');box.className='card';box.style.marginTop='10px';box.innerHTML='<div class="cb" style="padding:12px"><label>Classification operation</label><select id="v13q-ctl-class-op"><option value="keep">Keep classification</option><option value="replace">Replace classification</option></select><select id="v13q-ctl-class-value"><option value="narcotic">Narcotic</option><option value="psychotropic">Psychotropic</option></select><button type="button" class="btn bg bsm" onclick="v13ApplyControlledClassification()">Apply classification to selected medication</button></div>';scope.parentNode.insertBefore(box,scope)}
window.extendControlledBulkUi=extendControlledBulk;
window.v13ApplyControlledClassification=async function(){
  var med=(E('v13-final-bulk-med')||{}).value,op=(E('v13q-ctl-class-op')||{}).value,val=(E('v13q-ctl-class-value')||{}).value;
  if(!med)return toast('Select a medication.','err');if(op==='keep')return toast('Choose Replace classification first.','info');
  var cat=(ctlCatalog()||[]).map(function(m){return String(m.id)===String(med)?Object.assign({},m,{classification:val}):m});
  try{await ctlSetCatalog(cat)}catch(e){console.error('Controlled classification save failed',e);return toast('Classification was not saved.','err')}
  toast('Controlled medication classification updated.','succ');if(typeof renderControlled==='function')renderControlled();return true
};

/* Single live QR and required/available columns for controlled stock print. */


})();

export {};

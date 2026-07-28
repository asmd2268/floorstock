(function(){
'use strict';
function E(id){return document.getElementById(id)}
function escA(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function numA(v){v=Number(v);return isFinite(v)?v:0}
function roleA(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function canManageA(){try{return !!(window.CU&&(CU.master===true||['pharmacy','controlled_pharmacy','inpatient_supervisor'].indexOf(roleA())>=0)||(typeof isMasterActual==='function'&&isMasterActual()))}catch(e){return false}}
function rulesA(){var s=(typeof ctlSettingsGlobal==='function'?ctlSettingsGlobal():{})||{};return {soon:Math.max(1,numA(s.expirySoonDays||60)),near:Math.max(0,numA(s.expiryUrgentDays||30)),critical:Math.max(0,numA(s.expiryCriticalDays||7))}}


function ensureModalA(){if(E('aa-final-expiry-rules-modal'))return;document.body.insertAdjacentHTML('beforeend',
 '<div class="modal-bg" id="aa-final-expiry-rules-modal"><div class="modal" style="width:680px"><div class="mh"><span class="mt">Expiry tracking rules / قواعد تتبع انتهاء الصلاحية</span><button class="xbtn" onclick="CM(\'aa-final-expiry-rules-modal\')">✕</button></div><div class="aa-final-settings-grid"><div><label>Early warning days / التنبيه المبكر</label><input type="number" min="1" id="aa-final-rule-soon"></div><div><label>Near-expiry days / قريب الانتهاء</label><input type="number" min="0" id="aa-final-rule-near"></div><div><label>Critical days / الحالة الحرجة</label><input type="number" min="0" id="aa-final-rule-critical"></div></div><div class="alert-banner-y">Required order: Critical ≤ Near expiry ≤ Early warning.</div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" onclick="CM(\'aa-final-expiry-rules-modal\')">Cancel</button><button class="btn bp" onclick="aaFinalSaveExpiryRules()">Save rules / حفظ القواعد</button></div></div></div>');}
window.aaFinalOpenExpiryRules=function(){if(!canManageA())return toast('No permission / لا توجد صلاحية','err');ensureModalA();var r=rulesA();E('aa-final-rule-soon').value=r.soon;E('aa-final-rule-near').value=r.near;E('aa-final-rule-critical').value=r.critical;OM('aa-final-expiry-rules-modal')};
window.aaFinalSaveExpiryRules=async function(){if(!canManageA())return;var soon=Math.max(1,numA(E('aa-final-rule-soon').value)),near=Math.max(0,numA(E('aa-final-rule-near').value)),critical=Math.max(0,numA(E('aa-final-rule-critical').value));if(!(critical<=near&&near<=soon))return toast('Critical ≤ Near expiry ≤ Early warning','err');var s=(typeof ctlSettingsGlobal==='function'?ctlSettingsGlobal():{})||{};s.expirySoonDays=soon;s.expiryUrgentDays=near;s.expiryCriticalDays=critical;s.expiryAlertDays=soon;await S.s('controlled_global_settings',s);await S.s('controlled_alert_days',soon);CM('aa-final-expiry-rules-modal');toast('Expiry tracking rules saved ✓','succ');if(typeof renderControlled==='function')renderControlled()};


})();

export {};

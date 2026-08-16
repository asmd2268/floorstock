import { publishLegacy } from '../core/legacy-registry.js';
import { getMonthlyReqCount as canonicalMonthlyReqCount } from '../core/schedule-limits.js';

// ── EXPIRY-STUB / ORDER RETENTION / PRINT / PUBLIC VIEW / NOTES /
// CATEGORIES / BULK ACTIONS / SCHEDULE-STUB HELPERS ────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). This consolidates several small, mostly-thin-delegation
// sections that weren't individually large enough to warrant their own
// file (many are just typeof-guarded pass-throughs to canonical
// implementations in module 40 or the department-note-*/schedule-*
// core modules). Everything referenced here that isn't declared in this
// file (S, CU, esc, el, toast, gd, gr, uiConfirm, deptName) is already
// published to globalThis by its owning module.
globalThis.canonicalRenderShelfAlertSettings = globalThis.renderShelfAlertSettings;
globalThis.canonicalOpenAddExpiry = globalThis.openAddExpiry;
globalThis.canonicalOpenEditExpiry = globalThis.openEditExpiry;
function renderShelfAlertSettings(){return typeof canonicalRenderShelfAlertSettings==='function'&&canonicalRenderShelfAlertSettings!==renderShelfAlertSettings?canonicalRenderShelfAlertSettings():undefined}
function openAddExpiry(){return typeof canonicalOpenAddExpiry==='function'&&canonicalOpenAddExpiry!==openAddExpiry?canonicalOpenAddExpiry():undefined}
function openEditExpiry(btn){return typeof canonicalOpenEditExpiry==='function'&&canonicalOpenEditExpiry!==openEditExpiry?canonicalOpenEditExpiry(btn):undefined}
// ── USERS
// ── ORDER RETENTION (6 MONTHS) ───────────────────────────
// Capture canonical references at module evaluation time.  publishLegacy()
// later overwrites globalThis with these wrapper functions; resolving through
// globalThis at call time would point back to the wrapper and recurse forever.
globalThis.canonicalOrderRetentionCutoff = globalThis.orderRetentionCutoff;
globalThis.canonicalRequestArchiveRecord = globalThis.requestArchiveRecord;
globalThis.canonicalCleanupOldOrders = globalThis.cleanupOldOrders;
globalThis.canonicalScheduleAutomaticOrderCleanup = globalThis.scheduleAutomaticOrderCleanup;
globalThis.canonicalGetNextDispSlot = globalThis.getNextDispSlot;
globalThis.canonicalFmt12 = globalThis.fmt12;
globalThis.canonicalDayBits = globalThis.dayBits;
globalThis.canonicalTimeToMins = globalThis.timeToMins;
globalThis.canonicalEnsureXLSX = globalThis.ensureXLSX;
globalThis.canonicalGetCatOptions = globalThis.getCatOptions;
function orderRetentionCutoff(){return typeof canonicalOrderRetentionCutoff==='function'?canonicalOrderRetentionCutoff():undefined}
function requestArchiveRecord(r){return typeof canonicalRequestArchiveRecord==='function'?canonicalRequestArchiveRecord(r):undefined}
async function cleanupOldOrders(autoMode){return typeof canonicalCleanupOldOrders==='function'?canonicalCleanupOldOrders(autoMode):undefined}
function scheduleAutomaticOrderCleanup(){return typeof canonicalScheduleAutomaticOrderCleanup==='function'?canonicalScheduleAutomaticOrderCleanup():undefined}

// ── PRINT (ORDER FORMS) ──────────────────────────────────
// Final Print Orders renderer/engine is installed later in one canonical module.
// Delegate to the canonical print-page state module without resolving through
// globalThis at call time (publishing this legacy API would otherwise point
// globalThis back to these wrappers and recurse forever).
globalThis.canonicalSetPPP = globalThis.setPPP;
globalThis.canonicalResetPrintPageState = globalThis.resetPrintPageState;
function setPPP(n,btn){
  if(typeof canonicalSetPPP==='function'&&canonicalSetPPP!==setPPP)return canonicalSetPPP(n,btn);
  globalThis.PPP=n;
  document.querySelectorAll('.ppp-btn').forEach(function(b){b.classList.remove('on')});
  if(btn)btn.classList.add('on');
}
function resetPrintPageState(){
  if(typeof canonicalResetPrintPageState==='function'&&canonicalResetPrintPageState!==resetPrintPageState)return canonicalResetPrintPageState();
  globalThis.PPP=0;
  document.querySelectorAll('.ppp-btn').forEach(function(b){b.classList.remove('on')});
}

// ── PUBLIC REQUEST VIEW (read-only, no login) ────────────
function checkPublicView(){
  var params=new URLSearchParams(window.location.search);
  if(params.get('view')==='request')return renderMobileRequest(params.get('request'));
  return false;
}

function renderMobileRequest(requestId){
  var request=gr().find(function(r){return r.id===requestId});
  el('auth').style.display='none';
  el('app').style.display='none';
  var publicPage=el('pub-request');
  if(publicPage)publicPage.style.display='block';
  applyTheme();
  var container=el('pub-req');
  if(!request){
    container.innerHTML='<div class="card" style="margin-top:24px"><div class="cb" style="text-align:center">Request not found or is no longer available.</div></div>';
    return;
  }
  var dept=(gd().find(function(d){return d.id===request.deptId})||{}).name||request.deptName||request.deptId;
  var meds=getMeds(request.deptId);
  var mobileUrl=getMobileRequestUrl(request.id);
  var qrUrl=window.makeReadableQR(mobileUrl);
  var rows=(request.items||[]).map(function(item,index){
    var med=meds.find(function(m){return m.id===item.medId});
    var dispensed=(request.dispensed||[]).find(function(itemDispensed){return itemDispensed.medId===item.medId});
    return '<tr><td style="text-align:center;font-family:var(--mono)">'+(index+1)+'</td><td style="font-weight:600">'+(med?med.name:item.medId)+'</td><td style="text-align:center;font-family:var(--mono)">'+item.qty+'</td><td style="text-align:center;font-family:var(--mono)">'+(dispensed?dispensed.qty:'—')+'</td></tr>';
  }).join('');
  container.innerHTML='<div class="card" style="margin-top:8px"><div class="cb"><div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start"><div><div class="stitle">'+dept+' — Request Summary</div><div class="ssub">Read-only mobile view</div></div><img class="asd-qr-image" src="'+qrUrl+'" width="72" height="72" alt="Request barcode"></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0"><div class="chip">Status: '+request.status+'</div><div class="chip">Submitted: '+fmtDateTime(request.created)+'</div>'+(function(){var eff=typeof window.effectiveRequestSchedule==='function'?window.effectiveRequestSchedule(request):{scheduledFor:request.scheduledFor};return eff.scheduledFor?'<div class="chip">Scheduled: '+fmtDateTime(eff.scheduledFor)+'</div>':'<div class="chip">Dispense: Not scheduled</div>'})()+'</div>'
    +'<div class="tw"><table><thead><tr><th>#</th><th>Medication</th><th>Requested</th><th>Dispensed</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="margin-top:16px;font-size:11px;color:var(--tx2);text-align:center">Read-only request view — By Ali Abudahash</div></div></div>';
}


// ── NOTES / FEEDBACK ──────────────────────────────────────
function getNotes(){return globalThis.asdhDepartmentNoteStore.getNotes()}
function setNotes(arr){return globalThis.asdhDepartmentNoteStore.setNotes(arr)}

function noteEsc(v){return globalThis.asdhDepartmentNoteUtils.noteEsc(v)}
function noteStatus(v){return globalThis.asdhDepartmentNoteUtils.noteStatus(v)}
function noteType(v){return globalThis.asdhDepartmentNoteUtils.noteType(v)}

// ── DEPT: Submit note ────────────────────────────────────
function renderDeptNotes(){return globalThis.asdhRenderDeptNotes()}


// ── PHARMACY: View & manage notes ───────────────────────
// Retained only as a migration marker; the live renderer is in the dedicated core module.
function legacyRenderPharmNotes(){
  // Populate dept filter
  var dsel=el('notes-filter-dept');
  if(dsel&&dsel.options.length<=1){
    var noteRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''),noteDeps=fsRoleScopedDepts(gd());
    if(noteRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var od=window.fsOutpatientDeptId();noteDeps=noteDeps.filter(function(d){return String(d.id)===String(od)})}
    noteDeps.forEach(function(d){dsel.innerHTML+='<option value="'+noteEsc(d.id)+'">'+noteEsc(d.name)+'</option>';});
  }
  if(dsel&&window.fsEffectiveRole&&window.fsEffectiveRole()==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){dsel.value=window.fsOutpatientDeptId();dsel.disabled=true}
  var deptF=(el('notes-filter-dept')||{value:''}).value||'';
  var typeF=(el('notes-filter-type')||{value:''}).value||'';
  var statusF=(el('notes-filter-status')||{value:''}).value||'';
  var outpatientScope=window.fsEffectiveRole&&window.fsEffectiveRole()==='outpatient_pharmacy_supervisor'?(window.fsOutpatientDeptId?window.fsOutpatientDeptId():String(CU&&CU.deptId||'')):'';

  var notes=getNotes().slice().reverse().filter(function(n){
    return (!outpatientScope&&(!deptF||n.deptId===deptF)||outpatientScope&&String(n.deptId)===outpatientScope)&&(!typeF||n.type===typeF)&&(!statusF||n.status===statusF);
  });

  // Summary
  var all=getNotes();
  var openCount=all.filter(function(n){return n.status==='open'||n.status==='urgent'}).length;
  var urgentCount=all.filter(function(n){return n.status==='urgent'}).length;
  var smEl=el('notes-summary');
  if(smEl)smEl.innerHTML='Total: <b>'+all.length+'</b> &nbsp;|&nbsp; Open: <b style="color:var(--yll)">'+openCount+'</b>&nbsp;|&nbsp; Urgent: <b style="color:var(--rdl)">'+urgentCount+'</b>';

  var list=el('pharm-notes-list');
  if(!notes.length){
    list.innerHTML='<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📝</div><div style="margin-top:10px">No notes matching filters</div></div>';
    return;
  }
  list.innerHTML=notes.map(function(n){
    var safeType=noteType(n.type),safeStatus=noteStatus(n.status),typeLabel=NOTE_TYPE_LABELS[safeType]||safeType,safeId=noteEsc(n.id);
    var statusCls=safeStatus==='resolved'?'note-resolved':safeStatus==='urgent'?'note-urgent':'note-open';
    var statusBadgeCls='note-badge-'+safeStatus;
    return '<div class="note-card '+statusCls+'" style="margin-bottom:10px">'
      +'<div class="fl jb ic" style="flex-wrap:wrap;gap:8px">'
        +'<div>'
          +'<span style="font-weight:700">'+noteEsc(n.deptName)+'</span>'
          +(n.medName?'<span style="color:var(--tx2);font-size:12px"> &mdash; '+noteEsc(n.medName)+'</span>':'')
        +'</div>'
        +'<div class="fl ic g8">'
          +'<span class="badge '+statusBadgeCls+'">'+noteEsc(safeStatus)+'</span>'
          +(n.priority==='urgent'?'<span class="badge brd">🚨 Urgent</span>':'')
          +'<button class="btn bp bxs" data-nid="'+safeId+'" onclick="openNoteReply(this.getAttribute(&#x27;data-nid&#x27;))">✏ Reply</button>'
          +(safeStatus!=='resolved'?'<button class="btn bs bxs" data-nid="'+safeId+'" onclick="quickResolve(this.getAttribute(&#x27;data-nid&#x27;))">✓ Resolve</button>':'')
        +'</div>'
      +'</div>'
      +'<div style="margin-top:8px;color:var(--tx)">'+noteEsc(String(n.body||'').length>200?String(n.body||'').slice(0,200)+'...':n.body)+'</div>'
      +(n.reply?'<div style="margin-top:8px;padding:8px 10px;background:rgba(46,160,67,.08);border-left:2px solid var(--gn);border-radius:4px;font-size:12px"><b>Reply:</b> '+noteEsc(n.reply)+'</div>':'')
      +'<div class="note-meta">'
        +'<span>'+noteEsc(fmtDate(n.created))+'</span>'
        +'<span style="font-family:var(--mono);font-size:10px">'+noteEsc(n.username)+'</span>'
        +'<span class="note-tag ntag-'+safeType+'">'+noteEsc(typeLabel)+'</span>'
      +'</div>'
      +'</div>';
  }).join('');
}

function renderPharmNotes(){return globalThis.asdhRenderPharmNotes()}

function openNoteReply(id){return globalThis.asdhOpenNoteReply(id)}

// ── Badge on nav button ──────────────────────────────────
function updateNotesBadge(){return globalThis.asdhUpdateNotesBadge()}


// ── CATEGORIES (global custom list) ─────────────────────
globalThis.DEFAULT_CATS = ['Injections','Inhalers','Suppositories','Tablets','Syrups','Topical','Ointments & Drops','Solutions'];
function getCategories(){
  var saved=S.g('custom_categories');
  return saved&&saved.length?saved:DEFAULT_CATS.slice();
}
function setCategories(arr){return S.s('custom_categories',arr)}

async function refreshCatSelectors(){
  // Update all open category dropdowns
  var cats=getCategories();
  var opts=cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('');
  ['dcat','imp-cat'].forEach(function(id){
    var sel=el(id);
    if(!sel)return;
    var cur=sel.value;
    if(id==='imp-cat'){
      sel.innerHTML='<option value="auto">Auto-detect</option>'+cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('');
    } else {
      sel.innerHTML=opts;
    }
    sel.value=cats.indexOf(cur)>-1?cur:cats[0];
  });
  renderInv();
}

// ── INVENTORY BULK ACTIONS ───────────────────────────────
function toggleAllInv(chk){
  document.querySelectorAll('.inv-chk').forEach(function(c){c.checked=chk.checked});
  onInvCheck();
}
function onInvCheck(){
  var checked=document.querySelectorAll('.inv-chk:checked');
  var total=document.querySelectorAll('.inv-chk');
  el('bulk-bar').style.display=checked.length?'':'none';
  el('bulk-count').textContent=checked.length+' selected';
  // Update select-all state
  var allChk=el('inv-all-chk');
  if(allChk){allChk.checked=checked.length>0&&checked.length===total.length;allChk.indeterminate=checked.length>0&&checked.length<total.length;}
  if(typeof window.captureInventorySelection==='function')window.captureInventorySelection();
}
function clearInvSelection(){
  if(typeof window.clearInventorySelectionState==='function')window.clearInventorySelectionState();
  document.querySelectorAll('.inv-chk').forEach(function(c){c.checked=false});
  var allChk=el('inv-all-chk');if(allChk){allChk.checked=false;allChk.indeterminate=false;}
  el('bulk-bar').style.display='none';
}
function getSelectedMedIds(){
  return Array.from(document.querySelectorAll('.inv-chk:checked')).map(function(c){return c.dataset.id});
}
async function bulkDelete(){
  var ids=getSelectedMedIds();
  if(!ids.length)return toast('Select medications first','err');
  var deptId=getInvDept();
  if(!await uiConfirm('Delete '+ids.length+' selected medications from this department?'))return;
  var idSet=new Set(ids);
  try{
    await setMeds(deptId,getMeds(deptId).filter(function(m){return !idSet.has(m.id)}));
    toast(ids.length+' medications deleted and saved ✓','succ');
    clearInvSelection();
    renderInv();
  }catch(err){
    console.error(err);
    toast('Delete was not saved. Please retry.','err');
  }
}

// ── CATEGORY SELECTOR OPTIONS ────────────────────────────
function getCatOptions(selected){return typeof canonicalGetCatOptions==='function'?canonicalGetCatOptions(selected):undefined}

// ════════════════════════════════════════════════════════
// SCHEDULE & LIMITS
// ════════════════════════════════════════════════════════
// ── Storage ──────────────────────────────────────────────
function getReqWindows(){return globalThis.scheduleGetReqWindows()}
function setReqWindows(a){return globalThis.scheduleSetReqWindows(a)}
function getDispSlots(){return globalThis.scheduleGetDispSlots()}
function setDispSlots(a){return globalThis.scheduleSetDispSlots(a)}
function getMonthlyLimits(){return globalThis.scheduleGetMonthlyLimits()}
function setMonthlyLimits(o){return globalThis.scheduleSetMonthlyLimits(o)}

// ── Helpers ───────────────────────────────────────────────
function fmt12(t){return typeof canonicalFmt12==='function'?canonicalFmt12(t):undefined}
function dayBits(days){return typeof canonicalDayBits==='function'?canonicalDayBits(days):undefined}

// ── Check if request is currently allowed ─────────────────
function timeToMins(t){return typeof canonicalTimeToMins==='function'?canonicalTimeToMins(t):undefined}

// ── Check monthly request count ───────────────────────────
function getMonthlyReqCount(deptId){return canonicalMonthlyReqCount(deptId)}
globalThis.canonicalGetMonthlyLimit = globalThis.getMonthlyLimit;
function getMonthlyLimit(deptId){return typeof canonicalGetMonthlyLimit==='function'&&canonicalGetMonthlyLimit!==getMonthlyLimit?canonicalGetMonthlyLimit(deptId):0}

// ── RENDER schedule page ──────────────────────────────────
function renderSchedule(){
  // Populate dept dropdowns in modals
  var deptOpts=globalThis.scheduleDepartmentOptions();
  ['rwin-dept','dslot-dept'].forEach(function(id){var s=el(id);if(s)s.innerHTML=deptOpts;});

  // Request windows
  var wins=getReqWindows();
  el('req-windows-list').innerHTML=wins.length
    ?wins.map(globalThis.renderRequestWindowCard).join('')
    :'<div style="color:var(--tx2);font-size:13px;padding:12px 0">No windows set — requests allowed anytime</div>';

  // Dispense slots
  var slots=getDispSlots();
  el('disp-slots-list').innerHTML=slots.length
    ?slots.map(globalThis.renderDispenseSlotCard).join('')
    :'<div style="color:var(--tx2);font-size:13px;padding:12px 0">No dispense slots defined</div>';

  // Monthly limits
  var lims=getMonthlyLimits();
  el('monthly-limits-list').innerHTML=globalThis.renderMonthlyLimitsTable(gd(),lims);

  if(typeof window.renderRequestCountLimitsSection==='function')window.renderRequestCountLimitsSection();
  if(typeof renderRequestHourGridUI==='function')window.renderRequestHourGridUI();

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
}

// ── Request Window CRUD ───────────────────────────────────

function editReqWindow(i){return globalThis.editReqWindow(i)}
// ── Dispense Slot CRUD ────────────────────────────────────
function addDispSlot(){return globalThis.addDispSlot()}
function editDispSlot(i){return globalThis.editDispSlot(i)}
// ── Monthly Limits ────────────────────────────────────────
function openBulkLimits(){return globalThis.openBulkLimits()}
function applyBulkLimit(){return globalThis.applyBulkLimit()}


// ── DEPT: Show window info + block if outside window ──────
function getNextDispSlot(deptId){return typeof canonicalGetNextDispSlot==='function'?canonicalGetNextDispSlot(deptId):undefined}
// Single global exit lifecycle: persist transient UI state, close public listeners, then warn on pending writes.
window.addEventListener('beforeunload',function(e){
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
  if(typeof window.clearPublicLiveSubscriptions==='function')window.clearPublicLiveSubscriptions();
  if(_pendingWrites>0){
    var msg='البيانات لم تُحفظ بعد. هل أنت متأكد من المغادرة؟';
    e.preventDefault();e.returnValue=msg;return msg;
  }
});



publishLegacy("07i-misc-features.js", {
  renderShelfAlertSettings,
  openAddExpiry,
  openEditExpiry,
  orderRetentionCutoff,
  requestArchiveRecord,
  cleanupOldOrders,
  scheduleAutomaticOrderCleanup,
  setPPP,
  resetPrintPageState,
  checkPublicView,
  renderMobileRequest,
  getNotes,
  setNotes,
  noteEsc,
  noteStatus,
  noteType,
  renderDeptNotes,
  renderPharmNotes,
  openNoteReply,
  updateNotesBadge,
  getCategories,
  setCategories,
  refreshCatSelectors,
  toggleAllInv,
  onInvCheck,
  clearInvSelection,
  getSelectedMedIds,
  bulkDelete,
  getCatOptions,
  getReqWindows,
  setReqWindows,
  getDispSlots,
  setDispSlots,
  getMonthlyLimits,
  setMonthlyLimits,
  fmt12,
  dayBits,
  timeToMins,
  getMonthlyReqCount,
  getMonthlyLimit,
  renderSchedule,
  editReqWindow,
  addDispSlot,
  editDispSlot,
  openBulkLimits,
  applyBulkLimit,
  getNextDispSlot,
});

export {};

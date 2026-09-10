/* Pharmacy Inventory — rooms → cabinets → shelves → medicines */
import { publishLegacy } from '../core/legacy-registry.js?v=003344116e';
import { installActions } from '../core/delegated-actions.js?v=779ca10b8c';
import { printDocument } from '../core/print-window.js?v=7e3e2088a2';
import { pharmacyPrintCss, pharmacyPrintName, pharmacyPrintQr, luma } from '../core/pharmacy-print-style.js?v=be72d2bca8';
import { usePharmacyInventory, piPrintReorder, piPrintCabinet, piPublicCabinetUrl, piPrintCabinetMap, piPrintRoomDoor, piDoPrint } from '../core/pharmacy-inventory-print.js?v=f4d5757a6e';
import {
  piParseShelfLine, piShelfLine, piShelfCells, piCellLabel, piFindShelf,
  piCellOptionsHtml, piShelfCmp, piShelvesOf,
  piDaysToExpiry, piExpiryStatus, piExpiryLabel, medicineExpiryFromLocations, PI_EXPIRY_WARN_DAYS
} from '../core/pharmacy-inventory-model.js?v=77f4ad8cd5';
import { buildTxnRecords, applyNewLocations } from '../core/pharmacy-inventory-transactions.js?v=e2389f9994';
import { visibleMedicines, filterMedicines, medicinesNeedingReorder } from '../core/pharmacy-inventory-filters.js?v=709188b2f5';
import { parseMedicineImport } from '../core/pharmacy-inventory-import.js?v=c5674b7fcb';
import { splitForPurge, validPurgeDays } from '../core/pharmacy-inventory-retention.js?v=a46a0a692a';
import { lastMovementByMedicine, inactiveSince, cutoffDaysAgo, periodSummary } from '../core/pharmacy-inventory-reports.js?v=7ce2ca81f2';
'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
var PI_ROOMS_KEY     = 'pharm_inv_rooms_v1';
var PI_MEDS_KEY      = 'pharm_inv_meds_v1';
var PI_IMPORT_KEY    = 'pharm_inv_import_cols_v1';
var PI_TXN_KEY       = 'pharm_inv_txn_v1';
var PI_SETTINGS_KEY  = 'pharm_inv_settings_v1';

// ── Helpers ────────────────────────────────────────────────────────────────
function piE(id){return document.getElementById(id)}
function piEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function piUid(p){return (p||'pi')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function piNow(){return new Date().toISOString()}
function piClone(x){try{return JSON.parse(JSON.stringify(x))}catch(e){return x}}
function piToast(msg,kind){if(typeof toast==='function')toast(msg,kind||'info')}

function piRooms(){
  try{var r=window.S&&window.S.g&&window.S.g(PI_ROOMS_KEY);return Array.isArray(r)?r:[]}catch(e){return []}
}
function piMeds(){
  try{var m=window.S&&window.S.g&&window.S.g(PI_MEDS_KEY);return Array.isArray(m)?m:[]}catch(e){return []}
}
async function piSaveRooms(rooms){await window.S.s(PI_ROOMS_KEY,rooms)}
async function piSaveMeds(meds){await window.S.s(PI_MEDS_KEY,meds)}
function piTxns(){try{var t=window.S&&window.S.g&&window.S.g(PI_TXN_KEY);return Array.isArray(t)?t:[]}catch(e){return[]}}
async function piSaveTxns(txns){await window.S.s(PI_TXN_KEY,txns)}
function piTxnSettings(){try{var s=window.S&&window.S.g&&window.S.g(PI_SETTINGS_KEY);return Object.assign({purgeDays:365},s||{})}catch(e){return{purgeDays:365}}}
async function piSaveTxnSettings(s){await window.S.s(PI_SETTINGS_KEY,s)}
function piTodayStr(){return new Date().toISOString().slice(0,10)}
function piTxnId(){return 'pitxn_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)}

function piRole(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'')}
function piIsMaster(){return typeof window.isMasterActual==='function'&&window.isMasterActual()}
function piFeatPerms(){return typeof window.piGetFeatPerms==='function'?window.piGetFeatPerms():{editMeds:['pharmacy'],editRooms:['pharmacy'],viewReorder:['pharmacy','inpatient_supervisor'],canPrint:['pharmacy','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'],editIntCls:['pharmacy']}}
function piCanDo(feat){if(piIsMaster())return true;var p=piFeatPerms();return (p[feat]||[]).indexOf(piRole())>=0}
function piCanEdit(){return piCanDo('editMeds')}
function piCanEditRooms(){return piCanDo('editRooms')}
function piCanViewReorder(){return piCanDo('viewReorder')}
function piCanEditIntCls(){return piCanDo('editIntCls')}

// Room restriction for pharmacy_staff: returns array of allowed roomIds (empty = all)
function piAllowedRooms(){
  if(piRole()!=='pharmacy_staff')return [];// non-staff see all
  var email=String((window.CU&&window.CU.email)||'').toLowerCase();
  var assign=typeof window.piGetRoomAssign==='function'?window.piGetRoomAssign():{};
  return assign[email]||[];
}
function piRoomAllowed(roomId){
  var allowed=piAllowedRooms();
  return !allowed.length||allowed.indexOf(roomId)>=0;
}

// Internal classification helpers
function piIntCls(){return typeof window.PI_INT_CLS==='object'?window.PI_INT_CLS:{status:{options:[]},urgency:{options:[]},dosageForm:{options:[]}}}
function piIntColors(){return typeof window.piIntGetColors==='function'?window.piIntGetColors():{}}
function piIntOptionLabel(grp,key){var g=piIntCls()[grp];if(!g)return key;var o=(g.options||[]).find(function(x){return x.key===key});return o?o.label:key}
function piIntBadge(grp,key){
  if(!key||key==='none')return '';
  var colors=piIntColors();
  var hex=colors[key]||'#888';
  var lm=luma(hex);
  var textColor=lm>128?'#111':'#fff';
  var label=piIntOptionLabel(grp,key);
  return '<span class="badge" style="background:'+hex+';color:'+textColor+';font-size:10px;margin-right:3px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+piEsc(label)+'">'+piEsc(label)+'</span>';
}

function piGetColors(){
  var CC_KEY='classification_colors_v1';
  var defs={ha:'#ef4444',haz:'#eab308',lasa:'#0ea5e9',ref:'#9333ea'};
  try{var s=window.S&&window.S.g&&window.S.g(CC_KEY);return Object.assign({},defs,s||{})}catch(e){return defs}
}

// ── State ──────────────────────────────────────────────────────────────────
var PI_UI={
  tab:'rooms',          // rooms | meds | print | import
  editRoomId:'',
  editCabId:'',
  editMedId:'',
  medFilter:'',
  medFilterMultiLoc:false,
  medFilterOOS:false,
  medFilterLoc:'',
  medFilterExpiry:'',     // '' | 'soon' | 'expired' | 'ok'
  medFilterCls:'',        // '' | 'ha' | 'haz' | 'lasa' | 'ref'
  medFilterStatus:'',     // internal status key
  medFilterUrgency:'',    // internal urgency key
  medFilterDosage:'',     // internal dosage key
  printRoomId:'',
  printCabId:'',
  printOpts:{showMoh:true,showNupco:true,showExpiry:true,showQr:false,showRoom:true},
};

// ── Main render ────────────────────────────────────────────────────────────

/* One listener per event for this whole screen, instead of fifty-five global
   function names for the CSP bridge to rebind. The markup carries what to do
   (data-clickact) and what to do it to (data-a1, data-a2…), so the arguments
   travel as data rather than as source code inside an attribute.
   See core/delegated-actions.js. */
function piInstallActions(root){
  if(!root)return;
  installActions(root,{
    piOpenAddRoom:function(el,event){piOpenAddRoom()},
    piOpenAddCabinet:function(el,event){piOpenAddCabinet(el.dataset.a1)},
    piOpenEditRoom:function(el,event){piOpenEditRoom(el.dataset.a1)},
    piDeleteRoom:function(el,event){piDeleteRoom(el.dataset.a1)},
    piOpenEditCabinet:function(el,event){piOpenEditCabinet(el.dataset.a1,el.dataset.a2)},
    piPrintCabinet:function(el,event){piPrintCabinet(el.dataset.a1,el.dataset.a2)},
    piPrintCabinetMap:function(el,event){piPrintCabinetMap(el.dataset.a1,el.dataset.a2)},
    piDeleteCabinet:function(el,event){piDeleteCabinet(el.dataset.a1,el.dataset.a2)},
    piFilterByShelf:function(el,event){piFilterByShelf(el.dataset.a1,el.dataset.a2,el.dataset.a3)},
    piSaveRoom:function(el,event){piSaveRoom()},
    piCloseModal:function(el,event){piCloseModal(el.dataset.a1)},
    piSaveCabinet:function(el,event){piSaveCabinet()},
    piMedClearFilters:function(el,event){piMedClearFilters()},
    piPrintReorder:function(el,event){piPrintReorder()},
    piOpenAddMed:function(el,event){piOpenAddMed()},
    piShowMedDetail:function(el,event){piShowMedDetail(el.dataset.a1)},
    piOpenEditMed:function(el,event){piOpenEditMed(el.dataset.a1)},
    piDeleteMed:function(el,event){piDeleteMed(el.dataset.a1)},
    piAddLocRow:function(el,event){piAddLocRow()},
    piSaveMed:function(el,event){piSaveMed()},
    piDoPrint:function(el,event){piDoPrint()},
    piPrintRoomDoor:function(el,event){piPrintRoomDoor()},
    piPrintSelectedCabinetMap:function(el,event){piPrintSelectedCabinetMap()},
    piDoImport:function(el,event){piDoImport()},
    piDownloadTemplate:function(el,event){piDownloadTemplate()},
    piAddTxnRow:function(el,event){piAddTxnRow(el.dataset.a1)},
    removeClosest:function(el){var row=el.closest(el.dataset.a1);if(row)row.remove()},
    removeById:function(el){var row=document.getElementById(el.dataset.a1);if(row)row.remove()},
    piSubmitTxnRows:function(el,event){piSubmitTxnRows(el.dataset.a1)},
    piHistClear:function(el,event){piHistClear()},
    piDeleteTxn:function(el,event){piDeleteTxn(el.dataset.a1)},
    piPurgeTxns:function(el,event){piPurgeTxns()},
    piSavePurgeDays:function(el,event){piSavePurgeDays()}
  },{event:'click',attribute:'clickact'});
  installActions(root,{
    piMedSearch:function(el,event){piMedSearch(el.value)},
    rerender:function(){window.renderPharmInv()},
    piTxnMedChanged:function(el,event){piTxnMedChanged(el)}
  },{event:'input',attribute:'inputact'});
  installActions(root,{
    piMedLocFilter:function(el,event){piMedLocFilter(el.value)},
    piMedClsFilter:function(el,event){piMedClsFilter(el.value)},
    piMedExpiryFilter:function(el,event){piMedExpiryFilter(el.value)},
    piMedStatusFilter:function(el,event){piMedStatusFilter(el.value)},
    piMedUrgencyFilter:function(el,event){piMedUrgencyFilter(el.value)},
    piMedDosageFilter:function(el,event){piMedDosageFilter(el.value)},
    piMedToggleMulti:function(el,event){piMedToggleMulti(el.checked)},
    piMedToggleOOS:function(el,event){piMedToggleOOS(el.checked)},
    piIntRadioChange:function(el,event){piIntRadioChange(el.dataset.a1,el.dataset.a2,el.dataset.a3,el)},
    piLocShelfChanged:function(el,event){piLocShelfChanged(el)},
    piPrintRoomChange:function(el,event){piPrintRoomChange(el.value)},
    rerender:function(){window.renderPharmInv()},
    piPrintCabChange:function(el,event){piPrintCabChange(el.value)},
    piPrintOptChange:function(el,event){piPrintOptChange(el.dataset.a1,el.checked)},
    piPdfScan:function(el,event){piPdfScan(el,el.dataset.a2)},
    piTxnMedChanged:function(el,event){piTxnMedChanged(el)}
  },{event:'change',attribute:'changeact'});
}

usePharmacyInventory({
  rooms:function(){return piRooms()},
  meds:function(){return piMeds()},
  colors:function(){return piGetColors()},
  ui:function(){return PI_UI},
  toast:function(m,k){return piToast(m,k)},
  allowedRooms:function(){return piAllowedRooms()},
  intCls:function(){return piIntCls()},
  intColors:function(){return piIntColors()},
  syncPublicCabinet:function(room,cab,shelves){return piSyncPublicCabinet(room,cab,shelves)}
});
window.renderPharmInv = function(){
  var host=piE('pg-pharm-inv');if(!host)return;
  /* Installed on <body>: this screen's dialogs are appended there, not inside the page. */
  piInstallActions(document.body);
  var tab=PI_UI.tab;
  host.innerHTML='';
  // Classification Lists and Badge Colors live in the Inventory section — not duplicated here
  // Header
  var hdr=document.createElement('div');
  hdr.className='fl ic jb mb14';hdr.style.cssText='flex-wrap:wrap;gap:10px';
  hdr.innerHTML='<div><div class="stitle">🏥 Pharmacy Inventory / مخزون الصيدلية</div><div class="ssub" style="margin:0">Rooms · Cabinets · Shelves · Medicines</div></div>';
  // Tab bar
  var tbar=document.createElement('div');tbar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px';
  [['rooms','🏠 Rooms'],['meds','💊 Medicines'],['receive','📥 Receive'],['dispense','📤 Dispense'],['history','📋 History'],['reports','📊 Reports'],['print','🖨 Print'],['import','⬇ Import']].forEach(function(t){
    var on=tab===t[0];
    var b=document.createElement('button');b.className='btn '+(on?'bp':'bg')+' bsm';
    b.innerHTML=on?'<b>'+t[1]+'</b>':t[1];
    if(on)b.disabled=true;
    else b.onclick=function(){PI_UI.tab=t[0];window.renderPharmInv()};
    tbar.appendChild(b);
  });
  host.appendChild(hdr);host.appendChild(tbar);
  var body=document.createElement('div');host.appendChild(body);
  if(tab==='rooms')piRenderRoomsTab(body);
  else if(tab==='meds')piRenderMedsTab(body);
  else if(tab==='receive')piRenderTxnEntryTab(body,'receipt');
  else if(tab==='dispense')piRenderTxnEntryTab(body,'dispense');
  else if(tab==='history')piRenderHistoryTab(body);
  else if(tab==='reports')piRenderReportsTab(body);
  else if(tab==='print')piRenderPrintTab(body);
  else if(tab==='import')piRenderImportTab(body);
};

// ══════════════════════════════════════════════════════════
// ROOMS & CABINETS TAB
// ══════════════════════════════════════════════════════════
function piRenderRoomsTab(host){
  var rooms=piRooms().filter(function(r){return piRoomAllowed(r.id)});
  var canEdit=piCanEditRooms();
  var html='';
  if(piAllowedRooms().length){html+='<div class="fhint" style="margin-bottom:10px">Showing your assigned rooms only / تظهر الغرف المخصصة لك فقط</div>'}
  if(canEdit){
    html+='<div style="margin-bottom:14px"><button class="btn bp bsm" data-clickact="piOpenAddRoom">+ Add Room / إضافة غرفة</button></div>';
  }
  if(!rooms.length){
    host.innerHTML=html+'<div class="card"><div class="cb" style="text-align:center;color:var(--tx2);padding:32px">No rooms yet. Add a room to start building your pharmacy map.</div></div>';
    return;
  }
  rooms.forEach(function(room){
    html+='<div class="card" style="margin-bottom:14px">';
    html+='<div class="ch"><span class="ct">🏠 '+piEsc(room.name)+'</span>';
    if(canEdit){
      html+='<div class="fl g8 ic">';
      html+='<button class="btn bg bxs" data-clickact="piOpenAddCabinet" data-a1="'+piEsc(room.id)+'">+ Cabinet</button>';
      html+='<button class="btn bg bxs" data-clickact="piOpenEditRoom" data-a1="'+piEsc(room.id)+'">✏️ Edit</button>';
      html+='<button class="btn bd2c bxs" data-clickact="piDeleteRoom" data-a1="'+piEsc(room.id)+'">🗑</button>';
      html+='</div>';
    }
    html+='</div><div class="cb">';
    var cabs=room.cabinets||[];
    if(!cabs.length){html+='<div style="color:var(--tx2);font-size:13px">No cabinets yet.</div>';}
    cabs.forEach(function(cab){
      var typeLabel=cab.type==='dispensing'?'🔵 Dispensing':'🟤 Storage';
      html+='<div style="border:1px solid var(--br);border-radius:8px;padding:10px 14px;margin-bottom:8px">';
      html+='<div class="fl ic jb"><div>';
      html+='<b>'+piEsc(cab.name)+'</b> <span style="font-size:11px;opacity:.7">'+typeLabel+'</span>';
      html+='<div style="font-size:12px;color:var(--tx2);margin-top:2px">'+((cab.shelves||[]).length)+' shelf/shelves</div>';
      html+='</div>';
      if(canEdit){
        html+='<div class="fl g8 ic">';
        html+='<button class="btn bg bxs" data-clickact="piOpenEditCabinet" data-a1="'+piEsc(room.id)+'" data-a2="'+piEsc(cab.id)+'">✏️</button>';
        html+='<button class="btn bg bxs" data-clickact="piPrintCabinet" data-a1="'+piEsc(room.id)+'" data-a2="'+piEsc(cab.id)+'" title="Print list / طباعة قائمة">🖨</button>';
        html+='<button class="btn bg bxs" data-clickact="piPrintCabinetMap" data-a1="'+piEsc(room.id)+'" data-a2="'+piEsc(cab.id)+'" title="Print cabinet map on one A4 / خريطة الخزانة بورقة A4">🗺</button>';
        html+='<button class="btn bd2c bxs" data-clickact="piDeleteCabinet" data-a1="'+piEsc(room.id)+'" data-a2="'+piEsc(cab.id)+'">🗑</button>';
        html+='</div>';
      }
      html+='</div>';
      // Shelf map preview
      var shelves=piShelvesOf(cab);
      if(shelves.length){
        // direction:ltr so A B C reads left-to-right regardless of page direction.
        html+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;direction:ltr">';
        shelves.forEach(function(sh){
          var meds=piMedsInShelf(room.id,cab.id,sh.id);
          html+='<div style="background:var(--s2);border:1px solid var(--br);border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer" data-clickact="piFilterByShelf" data-a1="'+piEsc(room.id)+'" data-a2="'+piEsc(cab.id)+'" data-a3="'+piEsc(sh.id)+'" title="'+meds.length+' medicine(s)">'+piEsc(sh.name)+' <b>'+meds.length+'</b></div>';
        });
        html+='</div>';
      }
      html+='</div>';
    });
    html+='</div></div>';
  });
  host.innerHTML=html;
}

function piMedsInShelf(roomId,cabId,shelfId){
  return piMeds().filter(function(m){
    return (m.locations||[]).some(function(l){
      return String(l.roomId)===String(roomId)&&String(l.cabId)===String(cabId)&&String(l.shelfId)===String(shelfId);
    });
  });
}

// ── Room modal ─────────────────────────────────────────────────────────────
function piOpenAddRoom(){
  PI_UI.editRoomId='';
  piShowModal('pi-room-modal','<h3>Add Room / إضافة غرفة</h3>'+
    '<div class="fg"><label>Room name</label><input id="pi-room-name" class="inp" placeholder="e.g. Main Room, Cold Room"></div>'+
    '<div style="margin-top:12px"><button class="btn bp" data-clickact="piSaveRoom">Save</button> <button class="btn bg bsm" data-clickact="piCloseModal">Cancel</button></div>');
  setTimeout(function(){var x=piE('pi-room-name');if(x)x.focus()},40);
};
function piOpenEditRoom(roomId){
  var room=(piRooms()||[]).find(function(r){return r.id===roomId});
  if(!room)return;
  PI_UI.editRoomId=roomId;
  piShowModal('pi-room-modal','<h3>Edit Room</h3>'+
    '<div class="fg"><label>Room name</label><input id="pi-room-name" class="inp" value="'+piEsc(room.name)+'"></div>'+
    '<div style="margin-top:12px"><button class="btn bp" data-clickact="piSaveRoom">Save</button> <button class="btn bg bsm" data-clickact="piCloseModal">Cancel</button></div>');
  setTimeout(function(){var x=piE('pi-room-name');if(x)x.focus()},40);
};
async function piSaveRoom(){
  var name=String((piE('pi-room-name')||{}).value||'').trim();
  if(!name)return piToast('Enter a room name','err');
  var rooms=piClone(piRooms());
  if(PI_UI.editRoomId){
    var r=rooms.find(function(x){return x.id===PI_UI.editRoomId});
    if(r)r.name=name;
  }else{
    rooms.push({id:piUid('room'),name:name,cabinets:[]});
  }
  try{await piSaveRooms(rooms);piCloseModal();window.renderPharmInv();piToast('Saved ✓','succ')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};
async function piDeleteRoom(roomId){
  var rooms=piRooms();
  var room=rooms.find(function(r){return r.id===roomId});
  if(!room)return;
  var medCount=piMeds().filter(function(m){return (m.locations||[]).some(function(l){return l.roomId===roomId})}).length;
  if(medCount&&!confirm('This room has '+medCount+' medicine location(s). Delete anyway?'))return;
  if(!confirm('Delete room "'+room.name+'"?'))return;
  var next=rooms.filter(function(r){return r.id!==roomId});
  // Remove locations from meds
  var meds=piClone(piMeds()).map(function(m){m.locations=(m.locations||[]).filter(function(l){return l.roomId!==roomId});return m});
  try{await piSaveRooms(next);await piSaveMeds(meds);window.renderPharmInv();piToast('Deleted','info')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};

// ── Cabinet modal ───────────────────────────────────────────────────────────
function piOpenAddCabinet(roomId){
  PI_UI.editRoomId=roomId;PI_UI.editCabId='';
  piShowCabModal(roomId,'');
};
function piOpenEditCabinet(roomId,cabId){
  PI_UI.editRoomId=roomId;PI_UI.editCabId=cabId;
  piShowCabModal(roomId,cabId);
};
function piShowCabModal(roomId,cabId){
  var rooms=piRooms();
  var room=rooms.find(function(r){return r.id===roomId});if(!room)return;
  var cab=cabId?(room.cabinets||[]).find(function(c){return c.id===cabId}):null;
  var shelves=cab?JSON.stringify(piShelvesOf(cab).map(piShelfLine)):JSON.stringify(['A x 4','B x 4','C x 4']);
  piShowModal('pi-cab-modal',
    '<h3>'+(cab?'Edit Cabinet':'Add Cabinet')+'</h3>'+
    /* The dialog carries the room it belongs to. Reading it back from module-level
       UI state at save time meant a Save could silently target a room that was no
       longer there, and return without saving or explaining. */
    '<input type="hidden" id="pi-cab-room" value="'+piEsc(roomId)+'">'+
    '<input type="hidden" id="pi-cab-id" value="'+piEsc(cabId||'')+'">'+
    '<div class="fg"><label>Cabinet name</label><input id="pi-cab-name" class="inp" value="'+piEsc(cab?cab.name:'')+'" placeholder="e.g. Cabinet A, Fridge 1"></div>'+
    '<div class="fg"><label>Type</label><select id="pi-cab-type" class="psel"><option value="storage" '+((!cab||cab.type==='storage')?'selected':'')+'>🟤 Storage / مستودع</option><option value="dispensing" '+(cab&&cab.type==='dispensing'?'selected':'')+'>🔵 Dispensing / منطقة صرف</option></select></div>'+
    '<div class="fg"><label>Shelves (one per line) / الأرفف (واحد بكل سطر)</label>'+
      '<textarea id="pi-cab-shelves" class="inp" rows="8" style="font-family:monospace;resize:vertical;direction:ltr;text-align:left">'+piEsc(JSON.parse(shelves).join('\n'))+'</textarea>'+
      '<label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-weight:400;cursor:pointer">'+
        '<input type="checkbox" id="pi-cab-autosort" '+((!cab||cab.autoSort!==false)?'checked':'')+'>'+
        '<span>Keep shelves in A→Z order / رتّب الأرفف أبجديًا تلقائيًا</span>'+
      '</label>'+
      /* rows="5" is the visible height, not a cap -- with three default lines
         showing, the box reads as though five shelves were the maximum. */
      '<div class="fhint" style="margin-top:4px">One shelf per line, no limit. Add <b>x N</b> to split a shelf into N cells — shelves need not match: <code>A x 4</code>, <code>B x 6</code>, <code>C</code>. Untick above to keep the exact order you typed.<br>رفّ بكل سطر، بلا حد. أضف <b>x N</b> لتقسيم الرف إلى N خانات — ولا يلزم تساوي الأرفف. أزل العلامة أعلاه ليبقى ترتيبك اليدوي.</div>'+
    '</div>'+
    '<div style="margin-top:12px"><button class="btn bp" data-clickact="piSaveCabinet">Save</button> <button class="btn bg bsm" data-clickact="piCloseModal">Cancel</button></div>'
  );
  setTimeout(function(){var x=piE('pi-cab-name');if(x)x.focus()},40);
}
async function piSaveCabinet(){
  var name=String((piE('pi-cab-name')||{}).value||'').trim();
  var type=String((piE('pi-cab-type')||{}).value||'storage');
  var shelfLines=String((piE('pi-cab-shelves')||{}).value||'').split('\n').map(function(s){return s.trim()}).filter(Boolean);
  if(!name)return piToast('Enter a cabinet name','err');
  if(!shelfLines.length)return piToast('Add at least one shelf','err');
  var parsed=shelfLines.map(piParseShelfLine).filter(function(x){return !!x.name});
  if(!parsed.length)return piToast('Add at least one shelf','err');
  // Duplicate shelf names collide when medicine locations are matched by name.
  var seenShelf={},dupShelf='';
  parsed.forEach(function(x){var k=x.name.toLowerCase();if(seenShelf[k]&&!dupShelf)dupShelf=x.name;seenShelf[k]=1});
  if(dupShelf)return piToast('Two shelves are both named "'+dupShelf+'" / رفّان بنفس الاسم','err');

  var autoSort=!!((piE('pi-cab-autosort')||{}).checked);
  if(autoSort)parsed=parsed.slice().sort(function(a,b){return piShelfCmp(a.name,b.name)});

  // Prefer the ids the open dialog carries; module-level UI state can drift.
  var roomId=String((piE('pi-cab-room')||{}).value||'')||PI_UI.editRoomId;
  var cabId=String((piE('pi-cab-id')||{}).value||'')||PI_UI.editCabId;
  var rooms=piClone(piRooms());
  var room=rooms.find(function(r){return r.id===roomId});
  // Never return silently: a Save that neither saves nor explains reads as a dead button.
  if(!room)return piToast('That room is no longer available — reopen the page and try again. / الغرفة لم تعد متاحة، أعد فتح الصفحة','err');
  var shelves=parsed.map(function(x,i){return {id:piUid('sh'),name:x.name,cells:x.cells,order:i}});
  if(cabId){
    var cab=(room.cabinets||[]).find(function(c){return c.id===cabId});
    if(!cab)return piToast('That cabinet is no longer available — reopen the page and try again. / الخزانة لم تعد متاحة، أعد فتح الصفحة','err');
    // Map existing shelf IDs by name to preserve medicine locations
    var oldByName={};(cab.shelves||[]).forEach(function(sh){oldByName[sh.name]=sh.id});
    shelves=parsed.map(function(x,i){return {id:oldByName[x.name]||piUid('sh'),name:x.name,cells:x.cells,order:i}});
    cab.name=name;cab.type=type;cab.shelves=shelves;cab.autoSort=autoSort;
  }else{
    if(!room.cabinets)room.cabinets=[];
    room.cabinets.push({id:piUid('cab'),name:name,type:type,shelves:shelves,autoSort:autoSort});
  }
  try{await piSaveRooms(rooms);piCloseModal();window.renderPharmInv();piToast('Saved ✓','succ')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};
async function piDeleteCabinet(roomId,cabId){
  var rooms=piClone(piRooms());
  var room=rooms.find(function(r){return r.id===roomId});if(!room)return;
  var cab=(room.cabinets||[]).find(function(c){return c.id===cabId});if(!cab)return;
  var medCount=piMeds().filter(function(m){return (m.locations||[]).some(function(l){return l.roomId===roomId&&l.cabId===cabId})}).length;
  if(medCount&&!confirm(medCount+' medicine location(s) in this cabinet. Delete?'))return;
  if(!confirm('Delete cabinet "'+cab.name+'"?'))return;
  room.cabinets=(room.cabinets||[]).filter(function(c){return c.id!==cabId});
  var meds=piClone(piMeds()).map(function(m){m.locations=(m.locations||[]).filter(function(l){return !(l.roomId===roomId&&l.cabId===cabId)});return m});
  try{await piSaveRooms(rooms);await piSaveMeds(meds);window.renderPharmInv();piToast('Deleted','info')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};
function piFilterByShelf(roomId,cabId,shelfId){
  PI_UI.tab='meds';PI_UI.medFilterLoc=roomId+':'+cabId+':'+shelfId;window.renderPharmInv();
};

// ══════════════════════════════════════════════════════════
// MEDICINES TAB
// ══════════════════════════════════════════════════════════
function piRenderMedsTab(host){
  var allowedRooms=piAllowedRooms();
  var allMeds=visibleMedicines(piMeds(),allowedRooms);
  var rooms=piRooms().filter(function(r){return piRoomAllowed(r.id)});
  var canEdit=piCanEdit();
  var canEditIntCls=piCanEditIntCls();
  var colors=piGetColors();

  // Location options for filter
  var locOpts='<option value="">All locations</option>';
  rooms.forEach(function(room){
    (room.cabinets||[]).forEach(function(cab){
      piShelvesOf(cab).forEach(function(sh){
        var key=room.id+':'+cab.id+':'+sh.id;
        locOpts+='<option value="'+piEsc(key)+'" '+(PI_UI.medFilterLoc===key?'selected':'')+'>'+piEsc(room.name)+' › '+piEsc(cab.name)+' › '+piEsc(sh.name)+'</option>';
      });
    });
  });

  // Build internal status/urgency/dosage options for filters
  var intCls=piIntCls();
  function intOpts(grp,curVal){
    var g=intCls[grp];if(!g)return '';
    return '<option value="">All</option>'+
      (g.options||[]).map(function(o){return '<option value="'+piEsc(o.key)+'" '+(curVal===o.key?'selected':'')+'>'+piEsc(o.label)+'</option>'}).join('');
  }

  var filterHtml=
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">'+
    '<input id="pi-med-search" class="inp" placeholder="🔍 Search name / MOH / Nupco..." value="'+piEsc(PI_UI.medFilter)+'" data-inputact="piMedSearch" style="grid-column:1/-1">'+
    '<select id="pi-med-loc-filter" class="psel" data-changeact="piMedLocFilter" title="Location">'+locOpts+'</select>'+
    '<select id="pi-med-cls-filter" class="psel" data-changeact="piMedClsFilter" title="Classification">'+
      '<option value="">All classifications</option>'+
      ['ha','haz','lasa','ref'].map(function(v){var l={ha:'🔴 HA',haz:'⚠ HAZ',lasa:'🔵 LASA',ref:'❄ Ref'};return '<option value="'+v+'" '+(PI_UI.medFilterCls===v?'selected':'')+'>'+l[v]+'</option>'}).join('')+
    '</select>'+
    '<select id="pi-med-expiry-filter" class="psel" data-changeact="piMedExpiryFilter" title="Expiry">'+
      '<option value="">All expiry</option>'+
      '<option value="expired" '+(PI_UI.medFilterExpiry==='expired'?'selected':'')+'>⛔ Expired</option>'+
      '<option value="soon" '+(PI_UI.medFilterExpiry==='soon'?'selected':'')+'>⚠ Expiring ≤'+PI_EXPIRY_WARN_DAYS+'d</option>'+
      '<option value="ok" '+(PI_UI.medFilterExpiry==='ok'?'selected':'')+'>✓ Valid</option>'+
    '</select>'+
    '<select id="pi-med-status-filter" class="psel" data-changeact="piMedStatusFilter" title="Availability Status">'+intOpts('status',PI_UI.medFilterStatus)+'</select>'+
    '<select id="pi-med-urgency-filter" class="psel" data-changeact="piMedUrgencyFilter" title="Urgency">'+intOpts('urgency',PI_UI.medFilterUrgency)+'</select>'+
    '<select id="pi-med-dosage-filter" class="psel" data-changeact="piMedDosageFilter" title="Dosage Form">'+intOpts('dosageForm',PI_UI.medFilterDosage)+'</select>'+
    '</div>'+
    '<div class="fl g8 ic mb14" style="flex-wrap:wrap">'+
    '<label class="fl ic g8" style="cursor:pointer"><input type="checkbox" '+(PI_UI.medFilterMultiLoc?'checked':'')+' data-changeact="piMedToggleMulti"> Multi-location only</label>'+
    '<label class="fl ic g8" style="cursor:pointer"><input type="checkbox" '+(PI_UI.medFilterOOS?'checked':'')+' data-changeact="piMedToggleOOS"> Out of stock only</label>'+
    (PI_UI.medFilter||PI_UI.medFilterLoc||PI_UI.medFilterCls||PI_UI.medFilterExpiry||PI_UI.medFilterStatus||PI_UI.medFilterUrgency||PI_UI.medFilterDosage||PI_UI.medFilterMultiLoc||PI_UI.medFilterOOS?
      '<button class="btn bg bxs" data-clickact="piMedClearFilters">✕ Clear filters</button>':'')+
    '</div>';

  var meds=filterMedicines(allMeds,{
    search:PI_UI.medFilter, location:PI_UI.medFilterLoc, classification:PI_UI.medFilterCls,
    expiry:PI_UI.medFilterExpiry, status:PI_UI.medFilterStatus, urgency:PI_UI.medFilterUrgency,
    dosageForm:PI_UI.medFilterDosage, multiLocation:PI_UI.medFilterMultiLoc, outOfStock:PI_UI.medFilterOOS
  });

  // Reorder list: out-of-stock or expiring soon (gated by permission)
  var reorderMeds=piCanViewReorder()?medicinesNeedingReorder(allMeds):[];
  var reorderHtml='';
  if(reorderMeds.length){
    reorderHtml='<div class="card" style="margin-bottom:14px;border-left:3px solid var(--rd)"><div class="ch"><span class="ct">📋 Reorder List / قائمة الطلب</span><span style="font-size:12px;opacity:.6">'+reorderMeds.length+' item(s) need attention</span></div><div class="cb">';
    reorderHtml+='<table class="table" style="font-size:12px"><thead><tr><th>Medicine</th><th>MOH</th><th>Nupco</th><th>Status</th><th>Location</th></tr></thead><tbody>';
    reorderMeds.forEach(function(m){
      var rooms2=piRooms();
      var locs=(m.locations||[]).slice(0,2).map(function(l){var ro=rooms2.find(function(r){return r.id===l.roomId});var ca=ro&&(ro.cabinets||[]).find(function(c){return c.id===l.cabId});return (ro?ro.name:'?')+(ca?' › '+ca.name:'')}).join(', ');
      var stat=m.outOfStock?'<span style="color:var(--rd);font-weight:600">⛔ Out of stock</span>':(piExpiryStatus(m.expiry)==='expired'?'<span style="color:var(--rd)">⛔ Expired</span>':'<span style="color:var(--yl)">'+piExpiryLabel(m.expiry)+'</span>');
      reorderHtml+='<tr><td><b>'+piEsc(m.name)+'</b></td><td style="font-family:monospace">'+piEsc(m.mohCode||'—')+'</td><td style="font-family:monospace">'+piEsc(m.nupcoCode||'—')+'</td><td>'+stat+'</td><td style="font-size:11px">'+piEsc(locs)+'</td></tr>';
    });
    reorderHtml+='</tbody></table>';
    reorderHtml+='<button class="btn bg bsm" style="margin-top:8px" data-clickact="piPrintReorder">🖨 Print reorder list</button></div></div>';
  }

  // LASA conflicts detection — pharmacy role only (point 3)
  var curRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  var canSeeLasaConflicts=curRole==='pharmacy'||(typeof window.isMasterActual==='function'&&window.isMasterActual());
  var lasaNames={};
  meds.forEach(function(m){if(m.classification==='lasa')lasaNames[(m.name||'').toLowerCase()]=true});

  var addBtn=canEdit?'<button class="btn bp bsm" data-clickact="piOpenAddMed" style="margin-bottom:12px">+ Add Medicine</button>':'';

  if(!meds.length){
    host.innerHTML=filterHtml+reorderHtml+addBtn+'<div class="card"><div class="cb" style="text-align:center;color:var(--tx2);padding:28px">No medicines match the selected filters. / لا توجد أدوية تطابق الفلاتر.</div></div>';
    piBindMedFilters();return;
  }

  // LASA warning from dept inventory — pharmacy role only
  var conflictBanner='';
  if(canSeeLasaConflicts&&Object.keys(lasaNames).length){
    var deptLasaConflicts=[];
    try{
      var allDeptMeds=[];
      if(typeof gd==='function')gd().forEach(function(dept){if(typeof getMeds==='function')(getMeds(dept.id)||[]).forEach(function(m){allDeptMeds.push({name:(m.name||m.medication||'').toLowerCase()})})});
      Object.keys(lasaNames).forEach(function(n){if(allDeptMeds.some(function(x){return x.name===n}))deptLasaConflicts.push(n)});
    }catch(e){/* an optional source that is not loaded in this session */}
    if(deptLasaConflicts.length){
      conflictBanner='<div class="alert-banner" style="margin-bottom:12px">⚠ LASA name match with dept inventory: <b>'+deptLasaConflicts.join(', ')+'</b> — verify look-alike labeling is consistent.</div>';
    }
  }

  var rows=meds.map(function(m){
    var cls=piClassBadge(m.classification,colors);
    var locs=(m.locations||[]).map(function(l){
      var room=rooms.find(function(r){return r.id===l.roomId});
      var cab=room&&(room.cabinets||[]).find(function(c){return c.id===l.cabId});
      var sh=cab&&(cab.shelves||[]).find(function(s){return s.id===l.shelfId});
      var locStr=(room?room.name:'?')+' › '+(cab?cab.name:'?')+(sh?' › '+sh.name:'');
      var locExpSt=piExpiryStatus(l.expiry);
      var locExpColor=locExpSt==='expired'?'var(--rd)':locExpSt==='soon'?'var(--yl)':'var(--tx2)';
      var locExpStr=l.expiry?'<span style="color:'+locExpColor+';font-size:10px"> ('+piEsc(l.expiry)+')</span>':'';
      return piEsc(locStr)+locExpStr;
    }).join('<br>');
    var expStat=piExpiryStatus(m.expiry);
    var expColor=expStat==='expired'?'var(--rd)':expStat==='soon'?'var(--yl)':'var(--tx2)';
    var expLabel=piExpiryLabel(m.expiry);
    var expiry=m.expiry?'<span style="font-size:11px;color:'+expColor+'">'+piEsc(m.expiry)+(expLabel?' '+expLabel:'')+'</span>':'';
    var oos=m.outOfStock?'<span class="badge brd" style="font-size:10px">OUT OF STOCK</span>':'';
    // Internal classification badges
    var intBadges=piIntBadge('status',m.internalStatus)+piIntBadge('urgency',m.urgency)+piIntBadge('dosageForm',m.dosageForm);
    var actions='<button class="btn bg bxs" data-clickact="piShowMedDetail" data-a1="'+piEsc(m.id)+'" title="Details / التفاصيل">🔍</button> '+
      (canEdit?'<button class="btn bg bxs" data-clickact="piOpenEditMed" data-a1="'+piEsc(m.id)+'">✏️</button> '+
      '<button class="btn bd2c bxs" data-clickact="piDeleteMed" data-a1="'+piEsc(m.id)+'">🗑</button>':'');
    return '<tr>'+
      '<td>'+cls+'<b>'+piEsc(m.name)+'</b><br>'+(intBadges?'<div style="margin-top:3px">'+intBadges+'</div>':'')+expiry+' '+oos+'</td>'+
      '<td style="font-family:monospace;font-size:12px">'+piEsc(m.mohCode||'—')+'</td>'+
      '<td style="font-family:monospace;font-size:12px">'+piEsc(m.nupcoCode||'—')+'</td>'+
      '<td style="font-size:12px">'+locs+'</td>'+
      '<td>'+actions+'</td>'+
      '</tr>';
  }).join('');

  host.innerHTML=filterHtml+reorderHtml+conflictBanner+addBtn+
    '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Medicine</th><th>MOH Code</th><th>Nupco Code</th><th>Location(s)</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="fhint" style="margin-top:8px">🔍 = view all locations + expiry per batch &nbsp;|&nbsp; Colored badges = availability · urgency · dosage form</div>';
  piBindMedFilters();
}

function piClassBadge(cls,colors){
  if(!cls||cls==='none')return '';
  var c=colors||piGetColors();
  if(cls==='ha')return '<span class="badge" style="background:'+c.ha+';color:'+(luma(c.ha)>128?'#000':'#fff')+';font-size:10px;margin-right:4px">HA</span>';
  if(cls==='haz')return '<span class="badge" style="border:1px solid '+c.haz+';color:'+c.haz+';font-size:10px;margin-right:4px">HAZ</span>';
  if(cls==='lasa')return '<span class="badge" style="outline:2px solid '+c.lasa+';color:'+c.lasa+';font-size:10px;margin-right:4px">LASA</span>';
  if(cls==='ref')return '<span class="badge" style="background:var(--s2);border:1px solid var(--br);font-size:10px;margin-right:4px">❄</span>';
  return '';
}

function piMedSearch(v){PI_UI.medFilter=v;window.renderPharmInv()};
function piMedLocFilter(v){PI_UI.medFilterLoc=v;window.renderPharmInv()};
function piMedClsFilter(v){PI_UI.medFilterCls=v;window.renderPharmInv()};
function piMedExpiryFilter(v){PI_UI.medFilterExpiry=v;window.renderPharmInv()};
function piMedStatusFilter(v){PI_UI.medFilterStatus=v;window.renderPharmInv()};
function piMedUrgencyFilter(v){PI_UI.medFilterUrgency=v;window.renderPharmInv()};
function piMedDosageFilter(v){PI_UI.medFilterDosage=v;window.renderPharmInv()};
function piMedToggleMulti(v){PI_UI.medFilterMultiLoc=v;window.renderPharmInv()};
function piMedToggleOOS(v){PI_UI.medFilterOOS=v;window.renderPharmInv()};
function piMedClearFilters(){
  PI_UI.medFilter='';PI_UI.medFilterLoc='';PI_UI.medFilterCls='';PI_UI.medFilterExpiry='';
  PI_UI.medFilterStatus='';PI_UI.medFilterUrgency='';PI_UI.medFilterDosage='';
  PI_UI.medFilterMultiLoc=false;PI_UI.medFilterOOS=false;
  window.renderPharmInv();
};
function piBindMedFilters(){
  var s=piE('pi-med-search');if(s&&!s._pibound){s._pibound=true;s.oninput=function(){piMedSearch(s.value)}}
}

// ── Medicine modal ──────────────────────────────────────────────────────────
function piLocationsHtml(locations){
  var rooms=piRooms();
  var locs=locations&&locations.length?locations:[{roomId:'',cabId:'',shelfId:'',expiry:''}];
  return locs.map(function(l){
    var val=l.roomId?l.roomId+'|'+l.cabId+'|'+l.shelfId:'';
    return piLocRowHtml(rooms,val,l.expiry||'',l.cell||'');
  }).join('');
}

function piOpenAddMed(){PI_UI.editMedId='';piShowMedModal(null)};
function piOpenEditMed(id){var m=piMeds().find(function(x){return x.id===id});PI_UI.editMedId=id;piShowMedModal(m)};

function piIntClsRadios(grp,fieldId,currentVal){
  var g=piIntCls()[grp];if(!g||!g.options)return '';
  var intColors=piIntColors();
  var opts=g.options.map(function(o){
    var checked=currentVal===o.key;
    var hex=intColors[o.key]||o.def||'#888';
    var lm=luma(hex);var tc=lm>128?'#111':'#fff';
    var style=checked?'background:'+hex+';color:'+tc+';border-color:'+hex:'border:1px solid var(--br)';
    return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;cursor:pointer;font-size:12px;'+(checked?'background:'+hex+';color:'+tc+';':'border:1px solid var(--br);')+'margin-bottom:4px">'+
      '<input type="radio" name="'+fieldId+'" value="'+piEsc(o.key)+'" '+(checked?'checked':'')+' style="display:none" data-changeact="piIntRadioChange" data-a1="'+piEsc(grp)+'" data-a2="'+piEsc(fieldId)+'" data-a3="'+piEsc(o.key)+'">'+
      piEsc(o.label)+'</label>';
  }).join('');
  // None option
  var noneChecked=!currentVal||currentVal==='none';
  return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;cursor:pointer;font-size:12px;border:1px solid var(--br);margin-bottom:4px;'+(noneChecked?'opacity:.5':'')+'">'+
    '<input type="radio" name="'+fieldId+'" value="none" '+(noneChecked?'checked':'')+' style="display:none" data-changeact="piIntRadioChange" data-a1="'+piEsc(grp)+'" data-a2="'+piEsc(fieldId)+'" data-a3="none">None / لا يوجد</label>'+opts;
}
function piIntRadioChange(grp,fieldId,key,radio){
  // Restyle all labels in this group
  var intColors=piIntColors();
  var g=piIntCls()[grp];
  var labels=document.querySelectorAll('input[name="'+fieldId+'"]');
  labels.forEach(function(inp){
    var lbl=inp.parentElement;
    if(!lbl)return;
    if(inp.value===key){
      var hex=(g&&g.options.find(function(o){return o.key===key}))?(intColors[key]||'#888'):'';
      if(hex&&key!=='none'){var lm=luma(hex);lbl.style.background=hex;lbl.style.color=(lm>128?'#111':'#fff');lbl.style.borderColor=hex}
      else{lbl.style.background='var(--s2)';lbl.style.color='var(--tx)';lbl.style.borderColor='var(--br)'}
    }else{lbl.style.background='';lbl.style.color='';lbl.style.borderColor='var(--br)'}
  });
};

function piShowMedModal(m){
  var canIntCls=piCanEditIntCls();
  // Internal classification section — shown to all who can add/edit, but editable only if canIntCls
  var intClsSections='';
  var intDef=piIntCls();
  var groups=[['status','Availability Status / حالة التوفر','pi-med-status',m?m.internalStatus||'none':'none'],
              ['urgency','Urgency / الأولوية','pi-med-urgency',m?m.urgency||'none':'none'],
              ['dosageForm','Dosage Form / الشكل الصيدلاني','pi-med-dosage',m?m.dosageForm||'none':'none']];
  groups.forEach(function(g){
    var disabled=!canIntCls?'style="opacity:.5;pointer-events:none"':'';
    intClsSections+='<div class="fg" '+disabled+'><label>'+piEsc(g[1])+'</label><div style="display:flex;flex-wrap:wrap;gap:4px">'+piIntClsRadios(g[0],g[2],g[3])+'</div></div>';
  });
  if(!canIntCls)intClsSections='<div class="fg"><div class="fhint">Internal classifications (view only — editing requires Pharmacy Director access)</div>'+intClsSections+'</div>';

  var html='<h3>'+(m?'Edit Medicine':'Add Medicine')+'</h3>'+
    '<div class="fg"><label>Name / الاسم *</label><input id="pi-med-name" class="inp" value="'+piEsc(m?m.name:'')+'"></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
    '<div class="fg"><label>MOH Code</label><input id="pi-med-moh" class="inp" value="'+piEsc(m?m.mohCode||'':'')+'"></div>'+
    '<div class="fg"><label>Nupco Code</label><input id="pi-med-nupco" class="inp" value="'+piEsc(m?m.nupcoCode||'':'')+'"></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
    '<div class="fg"><label>Essential Classification / التصنيف الأساسي</label><select id="pi-med-cls" class="psel">'+
    ['none','ha','haz','lasa','ref'].map(function(v){var labels={none:'None',ha:'🔴 High Alert',haz:'⚠ Hazard',lasa:'🔵 LASA',ref:'❄ Refrigerated'};return '<option value="'+v+'" '+(m&&m.classification===v?'selected':'')+'>'+labels[v]+'</option>'}).join('')+
    '</select></div>'+
    '<div class="fg" style="display:none"><input id="pi-med-expiry" value=""></div>'+ // computed from locations
    '</div>'+
    '<div style="border-top:1px solid var(--br);padding-top:10px;margin:10px 0">'+
    '<div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:8px">Internal Classifications / التصنيفات الداخلية</div>'+
    intClsSections+
    '</div>'+
    '<div class="fl g8 ic" style="margin-bottom:8px">'+
    '<label class="fl ic g8"><input type="checkbox" id="pi-med-oos" '+(m&&m.outOfStock?'checked':'')+'>  Out of stock / نافد</label>'+
    '<label class="fl ic g8"><input type="checkbox" id="pi-med-qr" '+(m&&m.qrAlert?'checked':'')+'>  QR "not available" alert</label>'+
    '</div>'+
    '<div class="fg"><label>Location(s) + Expiry per batch / المواقع وتواريخ الانتهاء لكل دفعة</label>'+
    '<div id="pi-med-locs">'+piLocationsHtml(m?m.locations:null)+'</div>'+
    '<button class="btn bg bxs" style="margin-top:4px" data-clickact="piAddLocRow">+ Add location</button>'+
    '</div>'+
    '<div style="margin-top:14px"><button class="btn bp" data-clickact="piSaveMed">Save</button> <button class="btn bg bsm" data-clickact="piCloseModal">Cancel</button></div>';
  piShowModal('pi-med-modal',html);
  setTimeout(function(){var x=piE('pi-med-name');if(x)x.focus()},40);
}
/* Shelf options for a transaction row, restricted to the side of the cabinet the
   entry belongs to: a receipt lands in storage (مستودع), a dispense leaves from a
   dispensing cabinet. Offering the whole building on both sides is how stock ends
   up recorded in the wrong half of the pharmacy.
   Shelves the medicine is already assigned to are listed first and marked, so the
   normal case is one keystroke and adding a new place is still possible below. */
function piTxnLocOptions(type, medName) {
  var wantStorage = type === 'receipt';
  var med = medName
    ? piMeds().find(function (m) { return String(m.name || '').trim().toLowerCase() === String(medName).trim().toLowerCase(); })
    : null;
  var known = {};
  (med && med.locations || []).forEach(function (l) { known[l.roomId + '|' + l.cabId + '|' + l.shelfId] = true; });

  var mine = [], others = [];
  (piRooms() || []).forEach(function (room) {
    if (typeof piRoomAllowed === 'function' && !piRoomAllowed(room.id)) return;
    (room.cabinets || []).forEach(function (cab) {
      var isStorage = (cab.type || 'storage') === 'storage';
      if (isStorage !== wantStorage) return;
      piShelvesOf(cab).forEach(function (sh) {
        var v = room.id + '|' + cab.id + '|' + sh.id;
        var label = room.name + ' › ' + cab.name + ' › ' + sh.name;
        (known[v] ? mine : others).push({ v: v, label: label });
      });
    });
  });
  return { mine: mine, others: others, hasMed: !!med };
}

function piTxnLocSelectHtml(type, medName, current) {
  var o = piTxnLocOptions(type, medName);
  var opt = function (x) {
    return '<option value="' + piEsc(x.v) + '"' + (x.v === current ? ' selected' : '') + '>' + piEsc(x.label) + '</option>';
  };
  var html = '<select class="pi-txn-loc" style="min-width:180px;width:100%;box-sizing:border-box">';
  html += '<option value="">' + (type === 'receipt' ? 'Storage location…' : 'Dispense from…') + '</option>';
  if (o.mine.length) html += '<optgroup label="Assigned to this medicine / مواقع هذا الدواء">' + o.mine.map(opt).join('') + '</optgroup>';
  if (o.others.length) html += '<optgroup label="' + (o.mine.length ? 'Add a new location / موقع جديد' : (type === 'receipt' ? 'Storage / مستودع' : 'Dispensing / صرف')) + '">' + o.others.map(opt).join('') + '</optgroup>';
  if (!o.mine.length && !o.others.length) html += '<option value="" disabled>' + (type === 'receipt' ? 'No storage shelves defined' : 'No dispensing shelves defined') + '</option>';
  html += '</select>';
  return html;
}

/* Re-render a row's options once its medicine is known, keeping any choice that
   is still valid for the new medicine. */
function piTxnMedChanged(input) {
  var tr = input && input.closest ? input.closest('tr') : null;
  if (!tr) return;
  var cell = tr.querySelector('.pi-txn-loc');
  if (!cell) return;
  var current = cell.value;
  var type = tr.dataset.type || '';
  var wrapper = cell.parentNode;
  wrapper.innerHTML = piTxnLocSelectHtml(type, input.value, current);
};

function piLocRowHtml(rooms,locVal,expiryVal,cellVal){
  return '<div class="fl g8 ic pi-loc-row" style="margin-bottom:6px;flex-wrap:wrap">'+
    '<select class="psel pi-loc-sel" style="flex:2;min-width:160px" data-changeact="piLocShelfChanged"><option value="">Select shelf...</option>'+
    rooms.map(function(room){return (room.cabinets||[]).map(function(cab){return piShelvesOf(cab).map(function(sh){var v=room.id+'|'+cab.id+'|'+sh.id;return '<option value="'+piEsc(v)+'" '+(v===locVal?'selected':'')+'>'+piEsc(room.name+' › '+cab.name+' › '+sh.name)+'</option>'}).join('')}).join('')}).join('')+
    '</select>'+
    '<select class="psel pi-loc-cell-sel" style="flex:0 0 92px;min-width:92px" title="Cell on this shelf / الخانة داخل الرف">'+piCellOptionsHtml(rooms,locVal,cellVal)+'</select>'+
    '<input type="date" class="inp pi-loc-expiry" style="flex:1;min-width:130px" placeholder="Expiry for this batch" value="'+piEsc(expiryVal||'')+'">'+
    '<button class="btn bd2c bxs" data-clickact="removeClosest" data-a1=".pi-loc-row">✕</button>'+
    '</div>';
}
function piAddLocRow(){
  var c=piE('pi-med-locs');if(!c)return;
  var rooms=piRooms();
  var div=document.createElement('div');
  div.innerHTML=piLocRowHtml(rooms,'','','');
  c.appendChild(div.firstChild);
};
function piLocShelfChanged(sel){
  var row=sel&&sel.closest('.pi-loc-row');if(!row)return;
  var cellSel=row.querySelector('.pi-loc-cell-sel');if(!cellSel)return;
  cellSel.innerHTML=piCellOptionsHtml(piRooms(),sel.value,'');
};
async function piSaveMed(){
  var name=String((piE('pi-med-name')||{}).value||'').trim();
  if(!name)return piToast('Enter a medicine name','err');
  var locations=[];
  document.querySelectorAll('#pi-med-locs .pi-loc-row').forEach(function(row){
    var sel=row.querySelector('.pi-loc-sel');var expInput=row.querySelector('.pi-loc-expiry');
    var v=sel?sel.value:'';if(!v)return;
    var parts=v.split('|');if(parts.length<3)return;
    var cellSel=row.querySelector('.pi-loc-cell-sel');
    var cell=parseInt(cellSel&&cellSel.value,10);
    locations.push({roomId:parts[0],cabId:parts[1],shelfId:parts[2],cell:cell>0?cell:null,expiry:expInput?expInput.value.trim():''});
  });
  var computedExpiry=medicineExpiryFromLocations(locations,(piE('pi-med-expiry')||{}).value);
  function piRadioVal(name){var sel=document.querySelector('input[name="'+name+'"]:checked');return sel?sel.value:'none'}
  var med={
    id:PI_UI.editMedId||piUid('med'),
    name:name,
    mohCode:String((piE('pi-med-moh')||{}).value||'').trim(),
    nupcoCode:String((piE('pi-med-nupco')||{}).value||'').trim(),
    classification:String((piE('pi-med-cls')||{}).value||'none'),
    expiry:computedExpiry,
    outOfStock:!!(piE('pi-med-oos')||{}).checked,
    qrAlert:!!(piE('pi-med-qr')||{}).checked,
    internalStatus:piRadioVal('pi-med-status'),
    urgency:piRadioVal('pi-med-urgency'),
    dosageForm:piRadioVal('pi-med-dosage'),
    locations:locations,
    updatedAt:piNow(),
    updatedBy:(window.CU&&(CU.email||CU.uid))||'',
  };
  var meds=piClone(piMeds());
  if(PI_UI.editMedId){meds=meds.map(function(x){return x.id===PI_UI.editMedId?med:x})}
  else meds.push(med);
  try{await piSaveMeds(meds);piCloseModal();window.renderPharmInv();piToast('Saved ✓','succ')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};
function piShowMedDetail(id){
  var m=piMeds().find(function(x){return x.id===id});if(!m)return;
  var rooms=piRooms();
  var colors=piGetColors();
  var clsBadge=piClassBadge(m.classification,colors);
  var intBadges=piIntBadge('status',m.internalStatus)+piIntBadge('urgency',m.urgency)+piIntBadge('dosageForm',m.dosageForm);
  var html='<h3>'+piEsc(m.name)+'</h3>';
  html+='<div style="margin-bottom:10px">'+clsBadge+intBadges+'</div>';
  if(m.mohCode||m.nupcoCode){html+='<div style="font-size:12px;font-family:monospace;margin-bottom:10px;color:var(--tx2)">'+(m.mohCode?'MOH: '+piEsc(m.mohCode):'')+(m.mohCode&&m.nupcoCode?' · ':'')+(m.nupcoCode?'Nupco: '+piEsc(m.nupcoCode):'')+'</div>'}
  // Locations with per-location expiry
  var locs=m.locations||[];
  if(!locs.length){html+='<div style="color:var(--tx2);margin-bottom:12px">No locations assigned / لم يُحدد موقع بعد.</div>'}
  else{
    html+='<div style="margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:8px">📍 Locations / المواقع</div>';
    locs.forEach(function(l,i){
      var room=rooms.find(function(r){return r.id===l.roomId});
      var cab=room&&(room.cabinets||[]).find(function(c){return c.id===l.cabId});
      var sh=cab&&(cab.shelves||[]).find(function(s){return s.id===l.shelfId});
      var locLabel=(room?room.name:'?')+' › '+(cab?cab.name:'?')+(sh?' › '+sh.name:'');
      var expSt=piExpiryStatus(l.expiry);
      var expColor=expSt==='expired'?'var(--rd)':expSt==='soon'?'var(--yl)':'var(--tx)';
      var expLabel=l.expiry?'<span style="color:'+expColor+';font-weight:'+(expSt!=='ok'?'600':'400')+'"> — '+piEsc(l.expiry)+(piExpiryLabel(l.expiry)?' ('+piExpiryLabel(l.expiry)+')':'')+'</span>':'<span style="opacity:.5"> — no expiry set</span>';
      html+='<div style="padding:8px 12px;border:1px solid var(--br);border-radius:8px;margin-bottom:6px;font-size:13px">'+
        '<div>'+piEsc(locLabel)+expLabel+'</div>'+
        (cab?'<div style="font-size:11px;opacity:.6;margin-top:2px">'+(cab.type==='dispensing'?'🔵 Dispensing':'🟤 Storage')+'</div>':'')+
        '</div>';
    });
    html+='</div>';
  }
  // Overall status
  if(m.outOfStock)html+='<div class="alert-banner" style="margin-bottom:10px">⛔ Out of stock / نافد</div>';
  html+='<div style="margin-top:10px"><button class="btn bg bsm" data-clickact="piCloseModal">Close</button>';
  if(piCanEdit())html+=' <button class="btn bp bsm" data-clickact="piCloseModal" data-a1=");piOpenEditMed(\''+piEsc(id)+'">✏️ Edit</button>';
  html+='</div>';
  piShowModal('pi-detail-modal',html);
};

async function piDeleteMed(id){
  if(!confirm('Delete this medicine?'))return;
  var meds=piMeds().filter(function(m){return m.id!==id});
  try{await piSaveMeds(meds);window.renderPharmInv();piToast('Deleted','info')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};

// ══════════════════════════════════════════════════════════
// PRINT TAB
// ══════════════════════════════════════════════════════════
function piRenderPrintTab(host){
  if(!piCanDo('canPrint')){host.innerHTML='<div class="card"><div class="cb" style="color:var(--tx2);text-align:center;padding:28px">No print permission. / لا توجد صلاحية طباعة.</div></div>';return}
  var rooms=piRooms().filter(function(r){return piRoomAllowed(r.id)});
  var opts=PI_UI.printOpts;

  var roomOpts='<option value="">All rooms</option>'+rooms.map(function(r){return '<option value="'+piEsc(r.id)+'" '+(PI_UI.printRoomId===r.id?'selected':'')+'>'+piEsc(r.name)+'</option>'}).join('');
  var selRoom=rooms.find(function(r){return r.id===PI_UI.printRoomId});
  var cabOpts='<option value="">All cabinets</option>'+(selRoom?(selRoom.cabinets||[]).map(function(c){return '<option value="'+piEsc(c.id)+'" '+(PI_UI.printCabId===c.id?'selected':'')+'>'+piEsc(c.name)+'</option>'}).join(''):'');

  var html=
    '<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">🖨 Print Options</span></div><div class="cb">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'+
    '<div class="fg"><label>Room</label><select id="pi-print-room" class="psel" data-changeact="piPrintRoomChange">'+roomOpts+'</select></div>'+
    '<div class="fg"><label>Cabinet</label><select id="pi-print-cab" class="psel" data-changeact="piPrintCabChange">'+cabOpts+'</select></div>'+
    '</div>'+
    '<div class="fl g8 ic" style="flex-wrap:wrap;margin-bottom:12px">'+
    ['showMoh:MOH Code','showNupco:Nupco Code','showExpiry:Expiry Date','showQr:QR Code (expiry)','showRoom:Show Room'].map(function(x){
      var k=x.split(':')[0],l=x.split(':')[1];
      return '<label class="fl ic g8"><input type="checkbox" '+(opts[k]?'checked':'')+' data-changeact="piPrintOptChange" data-a1="'+k+'"> '+l+'</label>';
    }).join('')+
    '</div>'+
    '<div class="fl g8 ic" style="flex-wrap:wrap">'+
    '<button class="btn bp" data-clickact="piDoPrint">🖨 Print Cabinet List</button>'+
    '<button class="btn bg bsm" data-clickact="piPrintRoomDoor">🚪 Print Room Door List</button>'+
    /* The map needs one cabinet: it is a drawing of that cabinet, so "all
       cabinets" has nothing to draw. The button says which one it will print. */
    '<button class="btn bp bsm" data-clickact="piPrintSelectedCabinetMap"'+(PI_UI.printCabId?'':' disabled title="Choose a cabinet first / اختر خزانة أولًا"')+'>🗺 Print Cabinet Map (A4 + QR) / خريطة الخزانة</button>'+
    '</div>'+
    '</div></div>';

  // Preview
  var meds=piMeds();
  var filtRooms=PI_UI.printRoomId?rooms.filter(function(r){return r.id===PI_UI.printRoomId}):rooms;
  filtRooms.forEach(function(room){
    var cabs=(room.cabinets||[]).filter(function(c){return !PI_UI.printCabId||c.id===PI_UI.printCabId});
    if(!cabs.length)return;
    html+='<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">🏠 '+piEsc(room.name)+'</span></div><div class="cb">';
    cabs.forEach(function(cab){
      var cabMeds=meds.filter(function(m){return (m.locations||[]).some(function(l){return l.roomId===room.id&&l.cabId===cab.id})});
      html+='<div style="margin-bottom:12px"><b>'+piEsc(cab.name)+'</b> <span style="font-size:11px;opacity:.6">'+(cab.type==='dispensing'?'Dispensing':'Storage')+'</span>';
      if(cabMeds.length){
        var shelfMap={};
        cabMeds.forEach(function(m){
          (m.locations||[]).filter(function(l){return l.roomId===room.id&&l.cabId===cab.id}).forEach(function(l){
            if(!shelfMap[l.shelfId])shelfMap[l.shelfId]=[];shelfMap[l.shelfId].push(m);
          });
        });
        piShelvesOf(cab).forEach(function(sh){
          var shMeds=shelfMap[sh.id]||[];if(!shMeds.length)return;
          html+='<div style="margin-left:16px;margin-top:4px;font-size:12px"><span style="opacity:.6">'+piEsc(sh.name)+':</span> '+shMeds.map(function(m){return piEsc(m.name)+(m.outOfStock?' <span style="color:var(--rd)">[OOS]</span>':'')}).join(', ')+'</div>';
        });
      }else{html+=' <span style="font-size:12px;opacity:.5">empty</span>'}
      html+='</div>';
    });
    html+='</div></div>';
  });

  host.innerHTML=html;
}

// Print reorder list (out-of-stock + expiring soon)
function piPrintRoomChange(v){
  PI_UI.printRoomId=v;PI_UI.printCabId='';window.renderPharmInv();
};
/* One cabinet, one A4 page. The cabinet is drawn as it stands: each shelf is a row
   of the grid, split into however many cells that shelf has -- shelves do not have
   to match, so the rows are sized independently. Same model as the controlled
   pharmacy storage map (rows of cells).

   The page is locked to a fixed height with the grid taking the remaining space, so
   a cabinet with three shelves and one with twelve both fill exactly one sheet
   instead of spilling onto a second. */
/* Publishes a redacted snapshot of one cabinet so the QR on its printed map opens
   without a sign-in. Deliberately partial: names, cell, expiry and the safety
   flags a nurse needs at the shelf -- no batch numbers, suppliers, costs or notes.
   Anyone holding the printed sheet can read it, which is the point, so nothing
   goes in that we would not put on the wall beside the cabinet.

   Written on print rather than on every edit: it is one deliberate moment, and the
   page stamps the time so a stale snapshot announces itself instead of being
   mistaken for live stock. */
async function piSyncPublicCabinet(room,cab,shelves){
  if(!window.FB_DB||!window.FB_AUTH||!FB_AUTH.currentUser)return false;
  var meds=piMeds();
  var items=[];
  meds.forEach(function(m){
    (m.locations||[]).forEach(function(l){
      if(l.roomId!==room.id||l.cabId!==cab.id)return;
      var sh=shelves.find(function(x){return x.id===l.shelfId});
      if(!sh)return;
      var c=parseInt(l.cell,10);
      items.push({
        shelfId:sh.id,
        shelf:sh.name,
        cell:(c>0&&c<=piShelfCells(sh))?c:null,
        name:m.name||'',
        expiry:l.expiry||m.expiry||'',
        moh:m.moh||'',
        nupco:m.nupco||'',
        form:m.form||'',
        highAlert:!!m.high_alert,
        hazard:!!m.hazard,
        lasa:!!m.lasa,
        refrigerated:!!m.refrigerated,
        outOfStock:!!m.outOfStock
      });
    });
  });
  var stamp=(window.firebase&&firebase.firestore&&firebase.firestore.FieldValue)
    ?firebase.firestore.FieldValue.serverTimestamp():new Date().toISOString();
  var col=window.fsTenantCollection?fsTenantCollection('public_pharm_inv'):FB_DB.collection('public_pharm_inv');
  await col.doc(String(cab.id)).set({
    cabinetId:String(cab.id),
    cabinet:cab.name||'',
    room:room.name||'',
    type:cab.type||'storage',
    shelves:shelves.map(function(sh){return {id:sh.id,name:sh.name,cells:piShelfCells(sh)}}),
    items:items,
    updatedAt:stamp,
    updatedAtIso:new Date().toISOString()
  });
  return true;
}
/* Inline handlers must be plain calls: the CSP bridge rejects bare assignments,
   so `PI_UI.printCabId=this.value` silently failed and the print controls did
   nothing. The cabinet change also re-renders, because the map button's enabled
   state depends on it. */
function piPrintCabChange(v){
  PI_UI.printCabId=String(v||'');
  window.renderPharmInv();
};
function piPrintOptChange(key,checked){
  if(!PI_UI.printOpts)PI_UI.printOpts={};
  PI_UI.printOpts[String(key)]=!!checked;
  window.renderPharmInv();
};
function piPrintSelectedCabinetMap(){
  if(!PI_UI.printRoomId||!PI_UI.printCabId)return piToast('Choose a room and one cabinet / اختر غرفة وخزانة واحدة','err');
  return window.piPrintCabinetMap(PI_UI.printRoomId,PI_UI.printCabId);
};
var piPrintCss=pharmacyPrintCss;
var piPrintClass2=pharmacyPrintName;

/* Rendered by the bundled generator (window.makeReadableQR), which every other QR
   in the app uses. This used to point at a third-party QR image service, which the
   page's own CSP blocks under img-src 'self' data: blob: — so the code never
   actually appeared — and it sent the encoded value off-site. A data: URI also prints and
   works offline, which an external image does not. Falls back to the plain text
   if the generator is unavailable, so a label still carries the value. */
var piQrSvg=pharmacyPrintQr;

// ══════════════════════════════════════════════════════════
// IMPORT TAB
// ══════════════════════════════════════════════════════════
function piRenderImportTab(host){
  host.innerHTML=
    '<div class="card"><div class="ch"><span class="ct">⬇ Import Medicines from Excel / CSV</span></div><div class="cb">'+
    '<div class="fhint" style="margin-bottom:12px">Paste data with columns: <b>Name | MOH Code | Nupco Code</b> (tab-separated or CSV). First row can be a header.</div>'+
    '<textarea id="pi-import-data" class="inp" rows="10" style="font-family:monospace;resize:vertical;width:100%" placeholder="Medicine Name&#9;MOH Code&#9;Nupco Code&#10;Amoxicillin 500mg&#9;12345&#9;NP-001"></textarea>'+
    '<div class="fl g8 ic" style="flex-wrap:wrap;margin-top:10px">'+
    '<select id="pi-import-cls" class="psel"><option value="none">No classification</option><option value="ha">High Alert</option><option value="haz">Hazard</option><option value="lasa">LASA</option><option value="ref">Refrigerated</option></select>'+
    '<button class="btn bp" data-clickact="piDoImport">⬇ Import</button>'+
    '<button class="btn bg bsm" data-clickact="piDownloadTemplate">📥 Download template</button>'+
    '</div>'+
    '<div id="pi-import-result" style="margin-top:12px"></div>'+
    '</div></div>';
}

async function piDoImport(){
  var raw=String((piE('pi-import-data')||{}).value||'').trim();
  if(!raw)return piToast('Paste data first','err');
  var existingMeds=piClone(piMeds());
  var parsed=parseMedicineImport(raw,{
    existing:existingMeds,
    classification:String((piE('pi-import-cls')||{}).value||'none'),
    newId:function(){return piUid('med')},
    now:piNow(),
    actor:(window.CU&&(CU.email||CU.uid))||''
  });
  if(!parsed.imported.length)return piToast('Nothing to import (all duplicates or empty)','err');
  var imported=parsed.imported,skipped=parsed.skipped;
  try{
    await piSaveMeds(existingMeds.concat(imported));
    var res=piE('pi-import-result');
    if(res)res.innerHTML='<div class="alert-banner" style="background:var(--gnl2)">✓ Imported <b>'+imported.length+'</b> medicine(s).'+(skipped.length?' Skipped: '+skipped.join(', '):'')+'</div>';
    piToast('Imported '+imported.length,'succ');
  }catch(e){piToast(String(e&&e.message||e),'err')}
};

function piDownloadTemplate(){
  var csv='Medicine Name\tMOH Code\tNupco Code\nAmoxicillin 500mg\t12345\tNP-001\nParacetamol 1g\t67890\tNP-002';
  var blob=new Blob([csv],{type:'text/tab-separated-values'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pharmacy_inventory_template.tsv';a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
};

// ══════════════════════════════════════════════════════════
// MODAL SYSTEM
// ══════════════════════════════════════════════════════════
function piShowModal(id,html){
  var existing=piE('pi-global-modal');
  if(existing)existing.parentNode.removeChild(existing);
  var overlay=document.createElement('div');overlay.id='pi-global-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';
  var box=document.createElement('div');
  box.style.cssText='background:var(--bg);border:1px solid var(--br);border-radius:12px;padding:20px 24px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto';
  box.innerHTML=html;
  overlay.appendChild(box);
  overlay.onclick=function(e){if(e.target===overlay)piCloseModal()};
  document.body.appendChild(overlay);
}
function piCloseModal(){var m=piE('pi-global-modal');if(m)m.parentNode.removeChild(m)};

// ══════════════════════════════════════════════════════════
// RECEIVE / DISPENSE ENTRY TAB
// ══════════════════════════════════════════════════════════

function piMedSuggestions(){
  var names={};
  piMeds().forEach(function(m){if(m.name)names[m.name.trim()]=1});
  piTxns().forEach(function(t){if(t.medName)names[t.medName.trim()]=1});
  return Object.keys(names).sort();
}

function piRenderTxnEntryTab(body,type){
  var isReceipt=type==='receipt';
  var canEdit=piCanEdit()||piIsMaster();
  /* The transaction date is one value for the whole entry — a delivery arrives on a
     day, not per line — so it sits once above the grid instead of repeating down
     every row. Expiry stays per row, where it genuinely differs per medicine, and
     is never pre-filled. */
  var cols=isReceipt
    ?['Medicine / الدواء','Qty / الكمية','Batch #','Expiry / الانتهاء','Supplier / المورد','Note / ملاحظة','Location / الموقع','']
    :['Medicine / الدواء','Qty / الكمية','Expiry / الانتهاء','Note / ملاحظة','Location / الموقع',''];
  var sugg=piMedSuggestions();
  var listId='pi-txn-sugg-'+type;
  var html='<datalist id="'+listId+'">'+sugg.map(function(s){return'<option value="'+piEsc(s)+'">'}).join('')+'</datalist>';
  html+='<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">'+(isReceipt?'📥 Receive from Supplier / استلام من المورد':'📤 Dispense to Pharmacy / صرف للصيدلية')+'</span></div><div class="cb">';
  if(!canEdit){html+='<div class="fhint">Editing requires Pharmacy Director access.</div></div></div>';body.innerHTML=html;return}
  html+='<div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div class="fg" style="margin:0">'
    +'<label style="font-size:11px;opacity:.7">'+(isReceipt?'Receipt date / تاريخ الاستلام':'Dispense date / تاريخ الصرف')+'</label>'
    +'<input id="pi-txn-date-'+type+'" type="date" lang="en" dir="ltr" value="'+piEsc(piTodayStr())+'" style="margin:0;width:150px">'
    +'</div>'
    +'<div class="fhint" style="padding-bottom:6px">Applies to every row below / يُطبَّق على كل الصفوف</div>'
    +'</div>';
  /* Stated plainly rather than left to be discovered: the keys are what make this
     grid quick, and only the two fields that cannot be inferred are required. */
  html+='<div class="fhint" style="margin-bottom:10px;padding:8px 11px;border:1px solid var(--bd);border-radius:8px;background:var(--s2);line-height:1.6">'
    +'<b>Faster entry / إدخال أسرع:</b> '
    +'<kbd>Tab</kbd> next field / الحقل التالي &nbsp;·&nbsp; '
    +'<kbd>↑</kbd> <kbd>↓</kbd> same column / نفس العمود &nbsp;·&nbsp; '
    +'<kbd>Enter</kbd> next row, adds one at the end / صف تالٍ ويضيف صفاً عند النهاية'
    +'<br>Only <b>medicine</b> and <b>location</b> are required; quantity, batch, expiry and supplier are optional. '
    +'<span dir="rtl">المطلوب فقط <b>اسم الدواء</b> و<b>الموقع</b>؛ الكمية والتشغيلة والانتهاء والمورد اختيارية.</span>'
    +'</div>';
  html+='<table style="width:100%;border-collapse:collapse" id="pi-txn-rows-'+type+'">';
  html+='<thead><tr>'+cols.map(function(c){return'<th style="text-align:left;padding:4px 6px;font-size:11px;opacity:.6;white-space:nowrap">'+piEsc(c)+'</th>'}).join('')+'</tr></thead>';
  html+='<tbody id="pi-txn-body-'+type+'"></tbody></table>';
  html+='<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">';
  html+='<button class="btn bg bsm" type="button" data-clickact="piAddTxnRow" data-a1="'+type+'">+ Add row / إضافة صف</button>';
  html+='<button class="btn bp bsm" type="button" data-clickact="piSubmitTxnRows" data-a1="'+type+'">Save all / حفظ الكل</button>';
  if(isReceipt)html+='<label class="btn bg bsm" style="cursor:pointer">📄 PDF scan<input type="file" accept=".pdf,.txt,.csv" style="display:none" data-changeact="piPdfScan" data-a2="'+type+'"></label>';
  html+='</div></div></div>';
  body.innerHTML=html;
  piAddTxnRow(type);
}

/* Keyboard grid navigation.
 *
 * Entering a delivery means many rows that differ only in medicine and quantity,
 * so reaching for the mouse between every field is most of the work. Down/Up move
 * within a column and Enter does the same, adding a row when it runs off the end
 * so a whole delivery can be typed without leaving the keyboard. Tab already
 * crosses columns natively; Left/Right are deliberately untouched because they
 * move the caret inside the field being typed in.
 *
 * Down and Up are prevented from reaching number and date inputs, where the
 * browser would otherwise step the value instead of moving.
 */
function piGridKeydown(e){
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp'&&e.key!=='Enter')return;
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  var el=e.target;
  if(!el||!el.className||typeof el.className!=='string'||el.className.indexOf('pi-txn-')<0)return;
  var cell=el.closest('td'),tr=el.closest('tr');
  if(!cell||!tr||!tr.parentNode)return;
  var tbody=tr.parentNode;
  var col=Array.prototype.indexOf.call(tr.children,cell);
  var rows=Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  var i=rows.indexOf(tr);
  var down=e.key==='ArrowDown'||e.key==='Enter';
  e.preventDefault();
  var target=down?rows[i+1]:rows[i-1];
  if(!target){
    if(!down)return;
    var gridType=tr.dataset.type||String(tbody.id||'').replace('pi-txn-body-','');
    if(!gridType)return;
    window.piAddTxnRow(gridType);
    rows=Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    target=rows[rows.length-1];
    if(!target||target===tr)return;
  }
  var next=target.children[col]&&target.children[col].querySelector('input');
  if(!next)return;
  next.focus();
  try{next.select()}catch(selectError){/* tearing down something already gone is not a failure */}
}
if(typeof document!=='undefined'&&!window.__piGridKeysBound){
  window.__piGridKeysBound=true;
  document.addEventListener('keydown',piGridKeydown,true);
}

function piAddTxnRow(type){
  var isReceipt=type==='receipt';
  var tbody=document.getElementById('pi-txn-body-'+type);if(!tbody)return;
  /* A delivery is entered in one sitting, so the date and supplier repeat down the
     whole grid. Carrying them from the row above means they are typed once rather
     than on every line; today's date remains the default for the first row. */
  var lastRow=tbody.querySelector('tr:last-child');
  var carry=function(sel,fallback){
    var prev=lastRow&&lastRow.querySelector(sel);
    var v=prev&&prev.value;
    return (v==null||v==='')?fallback:v;
  };
  var carriedSupplier=isReceipt?carry('.pi-txn-supplier',''):'';
  var listId='pi-txn-sugg-'+type;
  var rowId='pirow_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  var td=function(content){return'<td style="padding:3px 4px">'+content+'</td>'};
  var inp=function(cls,ph,type2,extra){return'<input class="'+cls+' pi-txn-field" data-row="'+rowId+'" type="'+(type2||'text')+'" placeholder="'+piEsc(ph)+'" style="width:100%;box-sizing:border-box" '+(extra||'')+'>';};
  var tr=document.createElement('tr');tr.id=rowId;tr.dataset.type=type;
  var cells=td('<input class="pi-txn-med" data-row="'+rowId+'" list="'+listId+'" placeholder="Medicine name..." style="min-width:160px;width:100%;box-sizing:border-box" data-inputact="piTxnMedChanged" data-changeact="piTxnMedChanged">');
  cells+=td('<input class="pi-txn-qty" data-row="'+rowId+'" type="number" min="0" step="any" placeholder="0" style="width:70px">');
  if(isReceipt){
    cells+=td('<input class="pi-txn-batch" data-row="'+rowId+'" type="text" placeholder="Batch #" style="width:90px">');
  }
  // Expiry is offered on both sides and stays optional: it is often unknown at the
  // counter, and refusing the entry over it would cost more than the missing date.
  cells+=td('<input class="pi-txn-expiry" data-row="'+rowId+'" type="date" lang="en" dir="ltr" style="width:120px">');
  if(isReceipt){
    cells+=td('<input class="pi-txn-supplier" data-row="'+rowId+'" type="text" value="'+piEsc(carriedSupplier)+'" placeholder="Supplier / المورد" style="min-width:120px">');
  }
  cells+=td('<input class="pi-txn-note" data-row="'+rowId+'" type="text" placeholder="Note..." style="min-width:80px">');
  cells+=td(piTxnLocSelectHtml(type,'',''));
  cells+=td('<button type="button" class="btn bd2c bxs" style="padding:2px 7px" data-clickact="removeById" data-a1="'+rowId+'">✕</button>');
  tr.innerHTML=cells;tbody.appendChild(tr);
  tr.querySelector('.pi-txn-med').focus();
};

async function piSubmitTxnRows(type){
  var tbody=document.getElementById('pi-txn-body-'+type);if(!tbody)return;
  var rows=Array.from(tbody.querySelectorAll('tr'));
  if(!rows.length)return piToast('No rows to save / لا توجد صفوف','err');
  // One date for the whole entry, read once from the field above the grid.
  var dateEl=document.getElementById('pi-txn-date-'+type);
  var sharedDate=String((dateEl||{}).value||'').trim();
  if(!sharedDate){
    if(dateEl)dateEl.focus();
    return piToast(type==='receipt'?'Enter the receipt date / أدخل تاريخ الاستلام':'Enter the dispense date / أدخل تاريخ الصرف','err');
  }
  function cell(tr,cls){return String((tr.querySelector(cls)||{}).value||'')}
  var built=buildTxnRecords({
    type:type,
    sharedDate:sharedDate,
    rows:rows.map(function(tr){return {
      med:cell(tr,'.pi-txn-med'), qty:cell(tr,'.pi-txn-qty'), location:cell(tr,'.pi-txn-loc'),
      expiry:cell(tr,'.pi-txn-expiry'), batchNo:cell(tr,'.pi-txn-batch'),
      supplier:cell(tr,'.pi-txn-supplier'), note:cell(tr,'.pi-txn-note')
    }}),
    actor:(window.CU&&(CU.name||CU.email))||'',
    purgeDays:piTxnSettings().purgeDays,
    newId:piTxnId
  });
  if(built.errors.length)return piToast(built.errors[0],'err');
  try{
    await piSaveTxns(piTxns().concat(built.records));
    /* Saved after the movements so a failure here cannot lose the entry itself;
       the assignment is a convenience and is reported separately if it fails. */
    try{
      var applied=applyNewLocations(piClone(piMeds()),built.records);
      if(applied.added)await piSaveMeds(applied.meds);
    }catch(locError){
      console.error('Could not record the new location on the medicine.',locError);
      piToast('Entry saved, but the new location was not added to the medicine. / حُفظ الإدخال دون إضافة الموقع للدواء.','err');
    }
    piToast('Saved '+built.records.length+' record(s) ✓ / تم الحفظ ✓','succ');
    window.renderPharmInv();
  }catch(e){piToast(String(e&&e.message||e),'err')}
};

async function piPdfScan(input,type){
  var file=input&&input.files&&input.files[0];if(!file)return;
  var tbody=document.getElementById('pi-txn-body-'+type);if(!tbody)return;
  try{
    var text=await file.text();
    var lines=text.split(/\r?\n/);
    var added=0;
    lines.forEach(function(line){
      var m=line.match(/([^\t,|]+)[\t,|]\s*(\d+(?:\.\d+)?)/);
      if(!m)return;
      var medName=m[1].trim(),qty=parseFloat(m[2]);
      if(!medName||isNaN(qty)||qty<=0)return;
      piAddTxnRow(type);
      var rows=tbody.querySelectorAll('tr');var tr=rows[rows.length-1];
      if(tr){
        var medInp=tr.querySelector('.pi-txn-med');var qtyInp=tr.querySelector('.pi-txn-qty');
        if(medInp)medInp.value=medName;if(qtyInp)qtyInp.value=qty;
        added++;
      }
    });
    piToast('Loaded '+added+' item(s) from file / تم تحميل '+added+' صف','succ');
  }catch(e){piToast('Could not read file: '+String(e&&e.message||e),'err')}
};

// ══════════════════════════════════════════════════════════
// HISTORY TAB
// ══════════════════════════════════════════════════════════

function piRenderHistoryTab(body){
  var settings=piTxnSettings();
  var purgeMs=settings.purgeDays*864e5;
  var now=Date.now();
  var txns=piTxns();
  var eligible=txns.filter(function(t){return new Date(t.createdAt).getTime()<now-purgeMs});
  var fType=document.getElementById('pi-hist-ftype')?document.getElementById('pi-hist-ftype').value:'all';
  var fMed=document.getElementById('pi-hist-fmed')?document.getElementById('pi-hist-fmed').value.trim().toLowerCase():'';
  var fFrom=document.getElementById('pi-hist-ffrom')?document.getElementById('pi-hist-ffrom').value:'';
  var fTo=document.getElementById('pi-hist-fto')?document.getElementById('pi-hist-fto').value:'';
  var filtered=txns.filter(function(t){
    if(fType!=='all'&&t.type!==fType)return false;
    if(fMed&&t.medName.toLowerCase().indexOf(fMed)<0)return false;
    if(fFrom&&t.date<fFrom)return false;
    if(fTo&&t.date>fTo)return false;
    return true;
  }).sort(function(a,b){return b.date.localeCompare(a.date)});
  var html='<div class="card" style="margin-bottom:12px"><div class="cb">';
  html+='<div class="fl g8 ic" style="flex-wrap:wrap;margin-bottom:12px">';
  html+='<select id="pi-hist-ftype" class="psel" data-changeact="rerender" style="min-width:120px"><option value="all">All / الكل</option><option value="receipt"'+(fType==='receipt'?' selected':'')+'>📥 Receive</option><option value="dispense"'+(fType==='dispense'?' selected':'')+'>📤 Dispense</option></select>';
  html+='<input id="pi-hist-fmed" type="text" placeholder="Medicine search / بحث دواء" style="min-width:160px" value="'+piEsc(fMed)+'" data-inputact="rerender">';
  html+='<input id="pi-hist-ffrom" type="date" value="'+piEsc(fFrom)+'" data-changeact="rerender" title="From date">';
  html+='<input id="pi-hist-fto" type="date" value="'+piEsc(fTo)+'" data-changeact="rerender" title="To date">';
  if(fType!=='all'||fMed||fFrom||fTo)html+='<button class="btn bg bsm" data-clickact="piHistClear">✕ Clear</button>';
  html+='</div>';
  if(!filtered.length){html+='<div class="fhint">No records found.</div></div></div>';body.innerHTML=html;return}
  html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
  html+='<thead><tr style="border-bottom:1px solid var(--br)"><th style="text-align:left;padding:6px 8px">Type</th><th style="text-align:left;padding:6px 8px">Date</th><th style="text-align:left;padding:6px 8px">Medicine</th><th style="text-align:right;padding:6px 8px">Qty</th><th style="text-align:left;padding:6px 8px">Batch</th><th style="text-align:left;padding:6px 8px">Expiry</th><th style="text-align:left;padding:6px 8px">Supplier</th><th style="text-align:left;padding:6px 8px">Note</th><th style="text-align:left;padding:6px 8px">By</th>'+(piIsMaster()?'<th></th>':'')+'</tr></thead><tbody>';
  filtered.forEach(function(t){
    var badge=t.type==='receipt'?'<span style="background:#0ea5e9;color:#fff;border-radius:4px;padding:1px 7px;font-size:11px">📥 Recv</span>':'<span style="background:#f59e0b;color:#fff;border-radius:4px;padding:1px 7px;font-size:11px">📤 Disp</span>';
    html+='<tr style="border-bottom:1px solid var(--br)">';
    html+='<td style="padding:5px 8px">'+badge+'</td>';
    html+='<td style="padding:5px 8px;white-space:nowrap">'+piEsc(t.date)+'</td>';
    html+='<td style="padding:5px 8px"><b>'+piEsc(t.medName)+'</b></td>';
    html+='<td style="padding:5px 8px;text-align:right">'+piEsc(String(t.qty))+'</td>';
    html+='<td style="padding:5px 8px;opacity:.7">'+piEsc(t.batchNo||'—')+'</td>';
    html+='<td style="padding:5px 8px;opacity:.7">'+piEsc(t.expiry||'—')+'</td>';
    html+='<td style="padding:5px 8px;opacity:.7">'+piEsc(t.supplier||'—')+'</td>';
    html+='<td style="padding:5px 8px;opacity:.7">'+piEsc(t.note||'')+'</td>';
    html+='<td style="padding:5px 8px;opacity:.6;font-size:11px">'+piEsc(t.createdBy||'')+'</td>';
    if(piIsMaster())html+='<td style="padding:5px 8px"><button class="btn bd2c bxs" style="font-size:11px;padding:1px 7px" data-clickact="piDeleteTxn" data-a1="'+piEsc(t.id)+'">Delete</button></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  if(eligible.length&&piIsMaster()){
    html+='<div style="margin-top:12px;padding:10px;background:rgba(245,158,11,.1);border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html+='<span style="font-size:13px">⚠ <b>'+eligible.length+'</b> record(s) are older than <b>'+settings.purgeDays+'</b> days and eligible for purge.</span>';
    html+='<button class="btn" style="background:#ef4444;color:#fff" data-clickact="piPurgeTxns">Purge now / حذف القديم</button>';
    html+='</div>';
  }
  html+='</div></div>';
  if(piIsMaster()){
    html+='<div class="card" style="margin-top:12px"><div class="ch"><span class="ct">⚙ Settings / الإعدادات</span></div><div class="cb"><div class="fl g8 ic">';
    html+='<label style="font-size:13px">Auto-purge after <input id="pi-purge-days" type="number" min="30" max="3650" value="'+piEsc(String(settings.purgeDays))+'" style="width:70px;margin:0 4px"> days</label>';
    html+='<button class="btn bp bsm" data-clickact="piSavePurgeDays">Save</button>';
    html+='</div></div></div>';
  }
  body.innerHTML=html;
}

function piHistClear(){
  ['pi-hist-ftype','pi-hist-fmed','pi-hist-ffrom','pi-hist-fto'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=el.tagName==='SELECT'?'all':''});
  window.renderPharmInv();
};

async function piDeleteTxn(id){
  if(!piIsMaster())return piToast('Master only.','err');
  if(!window.confirm('Delete this record? / حذف هذا السجل؟'))return;
  try{
    var all=piTxns().filter(function(t){return t.id!==id});
    await piSaveTxns(all);piToast('Deleted ✓','succ');window.renderPharmInv();
  }catch(e){piToast(String(e&&e.message||e),'err')}
};

async function piPurgeTxns(){
  if(!piIsMaster())return piToast('Master only.','err');
  var split=splitForPurge(piTxns(),{purgeDays:piTxnSettings().purgeDays});
  if(!split.purge.length)return piToast('Nothing is old enough to purge. / لا يوجد سجل قديم بما يكفي','info');
  if(!window.confirm('Permanently delete '+split.purge.length+' old record(s)? This cannot be undone. / حذف '+split.purge.length+' سجل قديم بشكل نهائي؟'))return;
  try{await piSaveTxns(split.keep);piToast('Purged '+split.purge.length+' record(s) ✓','succ');window.renderPharmInv()}catch(e){piToast(String(e&&e.message||e),'err')}
};

async function piSavePurgeDays(){
  var inp=document.getElementById('pi-purge-days');if(!inp)return;
  var days=validPurgeDays(inp.value);
  if(days===null)return piToast('Minimum 30 days. / الحد الأدنى 30 يوماً','err');
  try{await piSaveTxnSettings(Object.assign(piTxnSettings(),{purgeDays:days}));piToast('Saved ✓','succ')}catch(e){piToast(String(e&&e.message||e),'err')}
};

// ══════════════════════════════════════════════════════════
// REPORTS TAB
// ══════════════════════════════════════════════════════════

function piRenderReportsTab(body){
  var txns=piTxns();
  var today=piTodayStr();
  var yearStart=today.slice(0,4)+'-01-01';

  // Read filter state from DOM (if rendered before) or defaults
  var inactiveRecvDays=parseInt((document.getElementById('pi-rpt-recv-days')||{}).value)||90;
  var inactiveDispDays=parseInt((document.getElementById('pi-rpt-disp-days')||{}).value)||90;
  var sumFrom=(document.getElementById('pi-rpt-sum-from')||{}).value||yearStart;
  var sumTo=(document.getElementById('pi-rpt-sum-to')||{}).value||today;
  var sumMed=String((document.getElementById('pi-rpt-sum-med')||{}).value||'').trim().toLowerCase();

  var html='';

  // ── Not received filter ──
  var allMeds=piMedSuggestions();
  var lastRecv=lastMovementByMedicine(txns,'receipt');
  var notRecv=inactiveSince(txns,allMeds,'receipt',cutoffDaysAgo(inactiveRecvDays)).map(function(row){return row.medicine});

  html+='<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">📭 Not received since / لم يُستلم منذ</span></div><div class="cb">';
  html+='<div class="fl g8 ic" style="margin-bottom:10px"><label style="font-size:13px">Last <input id="pi-rpt-recv-days" type="number" min="1" value="'+inactiveRecvDays+'" style="width:60px;margin:0 4px" data-changeact="rerender"> days</label></div>';
  if(!notRecv.length){html+='<div class="fhint">All medicines received within this period ✓</div>';}
  else{
    html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid var(--br)"><th style="text-align:left;padding:5px 8px">Medicine</th><th style="text-align:left;padding:5px 8px">Last Receipt</th></tr></thead><tbody>';
    notRecv.forEach(function(m){html+='<tr style="border-bottom:1px solid var(--br)"><td style="padding:5px 8px"><b>'+piEsc(m)+'</b></td><td style="padding:5px 8px;opacity:.7">'+(lastRecv[m]||'Never / لم يُستلم قط')+'</td></tr>'});
    html+='</tbody></table></div>';
  }
  html+='</div></div>';

  // ── Not dispensed filter ──
  var lastDisp=lastMovementByMedicine(txns,'dispense');
  var notDisp=inactiveSince(txns,allMeds,'dispense',cutoffDaysAgo(inactiveDispDays)).map(function(row){return row.medicine});

  html+='<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">📤 Not dispensed since / لم يُصرف منذ</span></div><div class="cb">';
  html+='<div class="fl g8 ic" style="margin-bottom:10px"><label style="font-size:13px">Last <input id="pi-rpt-disp-days" type="number" min="1" value="'+inactiveDispDays+'" style="width:60px;margin:0 4px" data-changeact="rerender"> days</label></div>';
  if(!notDisp.length){html+='<div class="fhint">All medicines dispensed within this period ✓</div>';}
  else{
    html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid var(--br)"><th style="text-align:left;padding:5px 8px">Medicine</th><th style="text-align:left;padding:5px 8px">Last Dispatch</th></tr></thead><tbody>';
    notDisp.forEach(function(m){html+='<tr style="border-bottom:1px solid var(--br)"><td style="padding:5px 8px"><b>'+piEsc(m)+'</b></td><td style="padding:5px 8px;opacity:.7">'+(lastDisp[m]||'Never / لم يُصرف قط')+'</td></tr>'});
    html+='</tbody></table></div>';
  }
  html+='</div></div>';

  // ── Period summary ──
  html+='<div class="card"><div class="ch"><span class="ct">📊 Period Summary / ملخص الفترة</span></div><div class="cb">';
  html+='<div class="fl g8 ic" style="flex-wrap:wrap;margin-bottom:12px">';
  html+='<label style="font-size:13px">From <input id="pi-rpt-sum-from" type="date" value="'+piEsc(sumFrom)+'" data-changeact="rerender" style="margin:0 4px"></label>';
  html+='<label style="font-size:13px">To <input id="pi-rpt-sum-to" type="date" value="'+piEsc(sumTo)+'" data-changeact="rerender" style="margin:0 4px"></label>';
  html+='<input id="pi-rpt-sum-med" type="text" placeholder="Filter medicine / فلتر" value="'+piEsc(sumMed)+'" data-inputact="rerender" style="min-width:140px">';
  html+='</div>';
  var summary=periodSummary(txns,{from:sumFrom,to:sumTo,medicine:sumMed}),sumData={};
  summary.rows.forEach(function(row){sumData[row.medicine]={recv:row.received,disp:row.dispensed}});
  var sumKeys=summary.rows.map(function(row){return row.medicine});
  if(!sumKeys.length){html+='<div class="fhint">No transactions in this period.</div>';}
  else{
    var totalRecv=0,totalDisp=0;
    html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:2px solid var(--br)"><th style="text-align:left;padding:6px 8px">Medicine</th><th style="text-align:right;padding:6px 8px">Received 📥</th><th style="text-align:right;padding:6px 8px">Dispensed 📤</th><th style="text-align:right;padding:6px 8px">Net</th></tr></thead><tbody>';
    sumKeys.forEach(function(k){
      var d=sumData[k];var net=d.recv-d.disp;
      totalRecv+=d.recv;totalDisp+=d.disp;
      html+='<tr style="border-bottom:1px solid var(--br)"><td style="padding:5px 8px"><b>'+piEsc(k)+'</b></td>';
      html+='<td style="padding:5px 8px;text-align:right;color:#0ea5e9">'+d.recv+'</td>';
      html+='<td style="padding:5px 8px;text-align:right;color:#f59e0b">'+d.disp+'</td>';
      html+='<td style="padding:5px 8px;text-align:right;font-weight:600;color:'+(net>=0?'#22c55e':'#ef4444')+'">'+net+'</td></tr>';
    });
    html+='<tr style="border-top:2px solid var(--br);font-weight:700"><td style="padding:6px 8px">Total</td>';
    html+='<td style="padding:6px 8px;text-align:right;color:#0ea5e9">'+totalRecv+'</td>';
    html+='<td style="padding:6px 8px;text-align:right;color:#f59e0b">'+totalDisp+'</td>';
    html+='<td style="padding:6px 8px;text-align:right;color:'+(totalRecv-totalDisp>=0?'#22c55e':'#ef4444')+'">'+(totalRecv-totalDisp)+'</td></tr>';
    html+='</tbody></table></div>';
  }
  html+='</div></div>';
  body.innerHTML=html;
}

// ══════════════════════════════════════════════════════════
// NAV & PERMISSIONS REGISTRATION
// ══════════════════════════════════════════════════════════

// Register render function for showPg dispatcher
window.__showPgAfterExtensions=window.__showPgAfterExtensions||[];
window.__showPgAfterExtensions.push(function(id){
  if(id==='pg-pharm-inv'&&typeof window.renderPharmInv==='function')window.renderPharmInv();
});

publishLegacy('84-pharmacy-inventory.js', {
  renderPharmInv: window.renderPharmInv
});

export {};

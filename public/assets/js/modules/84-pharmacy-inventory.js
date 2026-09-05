/* Pharmacy Inventory — rooms → cabinets → shelves → medicines */
import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';
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

function hexToRgb(hex){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return {r:r,g:g,b:b};
}
function luma(hex){var c=hexToRgb(hex);return 0.299*c.r+0.587*c.g+0.114*c.b}

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
window.renderPharmInv = function(){
  var host=piE('pg-pharm-inv');if(!host)return;
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
    html+='<div style="margin-bottom:14px"><button class="btn bp bsm" onclick="piOpenAddRoom()">+ Add Room / إضافة غرفة</button></div>';
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
      html+='<button class="btn bg bxs" onclick="piOpenAddCabinet(\''+piEsc(room.id)+'\')">+ Cabinet</button>';
      html+='<button class="btn bg bxs" onclick="piOpenEditRoom(\''+piEsc(room.id)+'\')">✏️ Edit</button>';
      html+='<button class="btn bd2c bxs" onclick="piDeleteRoom(\''+piEsc(room.id)+'\')">🗑</button>';
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
        html+='<button class="btn bg bxs" onclick="piOpenEditCabinet(\''+piEsc(room.id)+'\',\''+piEsc(cab.id)+'\')">✏️</button>';
        html+='<button class="btn bg bxs" onclick="piPrintCabinet(\''+piEsc(room.id)+'\',\''+piEsc(cab.id)+'\')">🖨</button>';
        html+='<button class="btn bd2c bxs" onclick="piDeleteCabinet(\''+piEsc(room.id)+'\',\''+piEsc(cab.id)+'\')">🗑</button>';
        html+='</div>';
      }
      html+='</div>';
      // Shelf map preview
      var shelves=cab.shelves||[];
      if(shelves.length){
        html+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">';
        shelves.forEach(function(sh){
          var meds=piMedsInShelf(room.id,cab.id,sh.id);
          html+='<div style="background:var(--s2);border:1px solid var(--br);border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer" onclick="piFilterByShelf(\''+piEsc(room.id)+'\',\''+piEsc(cab.id)+'\',\''+piEsc(sh.id)+'\')" title="'+meds.length+' medicine(s)">'+piEsc(sh.name)+' <b>'+meds.length+'</b></div>';
        });
        html+='</div>';
      }
      html+='</div>';
    });
    html+='</div></div>';
  });
  host.innerHTML=html;
}

// ── Expiry helpers ─────────────────────────────────────────────────────────
var PI_EXPIRY_WARN_DAYS=60; // configurable
function piDaysToExpiry(expiryStr){
  if(!expiryStr)return null;
  var d=new Date(expiryStr);if(isNaN(d))return null;
  return Math.floor((d-Date.now())/(1000*60*60*24));
}
function piExpiryStatus(expiryStr){
  var d=piDaysToExpiry(expiryStr);if(d===null)return 'ok';
  if(d<0)return 'expired';if(d<=PI_EXPIRY_WARN_DAYS)return 'soon';return 'ok';
}
function piExpiryLabel(expiryStr){
  var d=piDaysToExpiry(expiryStr);if(d===null)return '';
  if(d<0)return '⛔ Expired';if(d<=PI_EXPIRY_WARN_DAYS)return '⚠ '+d+'d left';return '';
}

function piMedsInShelf(roomId,cabId,shelfId){
  return piMeds().filter(function(m){
    return (m.locations||[]).some(function(l){
      return String(l.roomId)===String(roomId)&&String(l.cabId)===String(cabId)&&String(l.shelfId)===String(shelfId);
    });
  });
}

// ── Room modal ─────────────────────────────────────────────────────────────
window.piOpenAddRoom=function(){
  PI_UI.editRoomId='';
  piShowModal('pi-room-modal','<h3>Add Room / إضافة غرفة</h3>'+
    '<div class="fg"><label>Room name</label><input id="pi-room-name" class="inp" placeholder="e.g. Main Room, Cold Room"></div>'+
    '<div style="margin-top:12px"><button class="btn bp" onclick="piSaveRoom()">Save</button> <button class="btn bg bsm" onclick="piCloseModal()">Cancel</button></div>');
  setTimeout(function(){var x=piE('pi-room-name');if(x)x.focus()},40);
};
window.piOpenEditRoom=function(roomId){
  var room=(piRooms()||[]).find(function(r){return r.id===roomId});
  if(!room)return;
  PI_UI.editRoomId=roomId;
  piShowModal('pi-room-modal','<h3>Edit Room</h3>'+
    '<div class="fg"><label>Room name</label><input id="pi-room-name" class="inp" value="'+piEsc(room.name)+'"></div>'+
    '<div style="margin-top:12px"><button class="btn bp" onclick="piSaveRoom()">Save</button> <button class="btn bg bsm" onclick="piCloseModal()">Cancel</button></div>');
  setTimeout(function(){var x=piE('pi-room-name');if(x)x.focus()},40);
};
window.piSaveRoom=async function(){
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
window.piDeleteRoom=async function(roomId){
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
window.piOpenAddCabinet=function(roomId){
  PI_UI.editRoomId=roomId;PI_UI.editCabId='';
  piShowCabModal(roomId,'');
};
window.piOpenEditCabinet=function(roomId,cabId){
  PI_UI.editRoomId=roomId;PI_UI.editCabId=cabId;
  piShowCabModal(roomId,cabId);
};
function piShowCabModal(roomId,cabId){
  var rooms=piRooms();
  var room=rooms.find(function(r){return r.id===roomId});if(!room)return;
  var cab=cabId?(room.cabinets||[]).find(function(c){return c.id===cabId}):null;
  var shelves=cab?JSON.stringify((cab.shelves||[]).map(function(s){return s.name})):JSON.stringify(['Shelf 1','Shelf 2','Shelf 3']);
  piShowModal('pi-cab-modal',
    '<h3>'+(cab?'Edit Cabinet':'Add Cabinet')+'</h3>'+
    '<div class="fg"><label>Cabinet name</label><input id="pi-cab-name" class="inp" value="'+piEsc(cab?cab.name:'')+'" placeholder="e.g. Cabinet A, Fridge 1"></div>'+
    '<div class="fg"><label>Type</label><select id="pi-cab-type" class="psel"><option value="storage" '+((!cab||cab.type==='storage')?'selected':'')+'>🟤 Storage / مستودع</option><option value="dispensing" '+(cab&&cab.type==='dispensing'?'selected':'')+'>🔵 Dispensing / منطقة صرف</option></select></div>'+
    '<div class="fg"><label>Shelves (one per line)</label><textarea id="pi-cab-shelves" class="inp" rows="5" style="font-family:monospace;resize:vertical">'+piEsc(JSON.parse(shelves).join('\n'))+'</textarea></div>'+
    '<div style="margin-top:12px"><button class="btn bp" onclick="piSaveCabinet()">Save</button> <button class="btn bg bsm" onclick="piCloseModal()">Cancel</button></div>'
  );
  setTimeout(function(){var x=piE('pi-cab-name');if(x)x.focus()},40);
}
window.piSaveCabinet=async function(){
  var name=String((piE('pi-cab-name')||{}).value||'').trim();
  var type=String((piE('pi-cab-type')||{}).value||'storage');
  var shelfLines=String((piE('pi-cab-shelves')||{}).value||'').split('\n').map(function(s){return s.trim()}).filter(Boolean);
  if(!name)return piToast('Enter a cabinet name','err');
  if(!shelfLines.length)return piToast('Add at least one shelf','err');
  var rooms=piClone(piRooms());
  var room=rooms.find(function(r){return r.id===PI_UI.editRoomId});if(!room)return;
  var shelves=shelfLines.map(function(s,i){return {id:piUid('sh'),name:s,order:i}});
  if(PI_UI.editCabId){
    var cab=( room.cabinets||[]).find(function(c){return c.id===PI_UI.editCabId});
    if(cab){
      // Map existing shelf IDs by name to preserve medicine locations
      var oldByName={};(cab.shelves||[]).forEach(function(sh){oldByName[sh.name]=sh.id});
      shelves=shelfLines.map(function(s,i){return {id:oldByName[s]||piUid('sh'),name:s,order:i}});
      cab.name=name;cab.type=type;cab.shelves=shelves;
    }
  }else{
    if(!room.cabinets)room.cabinets=[];
    room.cabinets.push({id:piUid('cab'),name:name,type:type,shelves:shelves});
  }
  try{await piSaveRooms(rooms);piCloseModal();window.renderPharmInv();piToast('Saved ✓','succ')}
  catch(e){piToast(String(e&&e.message||e),'err')}
};
window.piDeleteCabinet=async function(roomId,cabId){
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
window.piFilterByShelf=function(roomId,cabId,shelfId){
  PI_UI.tab='meds';PI_UI.medFilterLoc=roomId+':'+cabId+':'+shelfId;window.renderPharmInv();
};

// ══════════════════════════════════════════════════════════
// MEDICINES TAB
// ══════════════════════════════════════════════════════════
function piRenderMedsTab(host){
  var allowedRooms=piAllowedRooms();
  var allMeds=allowedRooms.length
    ? piMeds().filter(function(m){return (m.locations||[]).some(function(l){return allowedRooms.indexOf(l.roomId)>=0})})
    : piMeds();
  var rooms=piRooms().filter(function(r){return piRoomAllowed(r.id)});
  var canEdit=piCanEdit();
  var canEditIntCls=piCanEditIntCls();
  var colors=piGetColors();

  // Location options for filter
  var locOpts='<option value="">All locations</option>';
  rooms.forEach(function(room){
    (room.cabinets||[]).forEach(function(cab){
      (cab.shelves||[]).forEach(function(sh){
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
    '<input id="pi-med-search" class="inp" placeholder="🔍 Search name / MOH / Nupco..." value="'+piEsc(PI_UI.medFilter)+'" oninput="piMedSearch(this.value)" style="grid-column:1/-1">'+
    '<select id="pi-med-loc-filter" class="psel" onchange="piMedLocFilter(this.value)" title="Location">'+locOpts+'</select>'+
    '<select id="pi-med-cls-filter" class="psel" onchange="piMedClsFilter(this.value)" title="Classification">'+
      '<option value="">All classifications</option>'+
      ['ha','haz','lasa','ref'].map(function(v){var l={ha:'🔴 HA',haz:'⚠ HAZ',lasa:'🔵 LASA',ref:'❄ Ref'};return '<option value="'+v+'" '+(PI_UI.medFilterCls===v?'selected':'')+'>'+l[v]+'</option>'}).join('')+
    '</select>'+
    '<select id="pi-med-expiry-filter" class="psel" onchange="piMedExpiryFilter(this.value)" title="Expiry">'+
      '<option value="">All expiry</option>'+
      '<option value="expired" '+(PI_UI.medFilterExpiry==='expired'?'selected':'')+'>⛔ Expired</option>'+
      '<option value="soon" '+(PI_UI.medFilterExpiry==='soon'?'selected':'')+'>⚠ Expiring ≤'+PI_EXPIRY_WARN_DAYS+'d</option>'+
      '<option value="ok" '+(PI_UI.medFilterExpiry==='ok'?'selected':'')+'>✓ Valid</option>'+
    '</select>'+
    '<select id="pi-med-status-filter" class="psel" onchange="piMedStatusFilter(this.value)" title="Availability Status">'+intOpts('status',PI_UI.medFilterStatus)+'</select>'+
    '<select id="pi-med-urgency-filter" class="psel" onchange="piMedUrgencyFilter(this.value)" title="Urgency">'+intOpts('urgency',PI_UI.medFilterUrgency)+'</select>'+
    '<select id="pi-med-dosage-filter" class="psel" onchange="piMedDosageFilter(this.value)" title="Dosage Form">'+intOpts('dosageForm',PI_UI.medFilterDosage)+'</select>'+
    '</div>'+
    '<div class="fl g8 ic mb14" style="flex-wrap:wrap">'+
    '<label class="fl ic g8" style="cursor:pointer"><input type="checkbox" '+(PI_UI.medFilterMultiLoc?'checked':'')+' onchange="piMedToggleMulti(this.checked)"> Multi-location only</label>'+
    '<label class="fl ic g8" style="cursor:pointer"><input type="checkbox" '+(PI_UI.medFilterOOS?'checked':'')+' onchange="piMedToggleOOS(this.checked)"> Out of stock only</label>'+
    (PI_UI.medFilter||PI_UI.medFilterLoc||PI_UI.medFilterCls||PI_UI.medFilterExpiry||PI_UI.medFilterStatus||PI_UI.medFilterUrgency||PI_UI.medFilterDosage||PI_UI.medFilterMultiLoc||PI_UI.medFilterOOS?
      '<button class="btn bg bxs" onclick="piMedClearFilters()">✕ Clear filters</button>':'')+
    '</div>';

  // Filter meds
  var meds=allMeds.slice();
  if(PI_UI.medFilter){var q=PI_UI.medFilter.toLowerCase();meds=meds.filter(function(m){return (m.name||'').toLowerCase().indexOf(q)>=0||(m.mohCode||'').toLowerCase().indexOf(q)>=0||(m.nupcoCode||'').toLowerCase().indexOf(q)>=0})}
  if(PI_UI.medFilterLoc){var locParts=PI_UI.medFilterLoc.split(':');meds=meds.filter(function(m){return (m.locations||[]).some(function(l){return l.roomId===locParts[0]&&l.cabId===locParts[1]&&(!locParts[2]||l.shelfId===locParts[2])})})}
  if(PI_UI.medFilterCls)meds=meds.filter(function(m){return m.classification===PI_UI.medFilterCls});
  if(PI_UI.medFilterExpiry)meds=meds.filter(function(m){return piExpiryStatus(m.expiry)===PI_UI.medFilterExpiry});
  if(PI_UI.medFilterStatus)meds=meds.filter(function(m){return m.internalStatus===PI_UI.medFilterStatus});
  if(PI_UI.medFilterUrgency)meds=meds.filter(function(m){return m.urgency===PI_UI.medFilterUrgency});
  if(PI_UI.medFilterDosage)meds=meds.filter(function(m){return m.dosageForm===PI_UI.medFilterDosage});
  if(PI_UI.medFilterMultiLoc)meds=meds.filter(function(m){return (m.locations||[]).length>1});
  if(PI_UI.medFilterOOS)meds=meds.filter(function(m){return !!m.outOfStock});

  // Reorder list: out-of-stock or expiring soon (gated by permission)
  var reorderMeds=piCanViewReorder()?allMeds.filter(function(m){return m.outOfStock||piExpiryStatus(m.expiry)==='expired'||piExpiryStatus(m.expiry)==='soon'}):[];
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
    reorderHtml+='<button class="btn bg bsm" style="margin-top:8px" onclick="piPrintReorder()">🖨 Print reorder list</button></div></div>';
  }

  // LASA conflicts detection — pharmacy role only (point 3)
  var curRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  var canSeeLasaConflicts=curRole==='pharmacy'||(typeof window.isMasterActual==='function'&&window.isMasterActual());
  var lasaNames={};
  meds.forEach(function(m){if(m.classification==='lasa')lasaNames[(m.name||'').toLowerCase()]=true});

  var addBtn=canEdit?'<button class="btn bp bsm" onclick="piOpenAddMed()" style="margin-bottom:12px">+ Add Medicine</button>':'';

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
    }catch(e){}
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
    var actions='<button class="btn bg bxs" onclick="piShowMedDetail(\''+piEsc(m.id)+'\')" title="Details / التفاصيل">🔍</button> '+
      (canEdit?'<button class="btn bg bxs" onclick="piOpenEditMed(\''+piEsc(m.id)+'\')">✏️</button> '+
      '<button class="btn bd2c bxs" onclick="piDeleteMed(\''+piEsc(m.id)+'\')">🗑</button>':'');
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

window.piMedSearch=function(v){PI_UI.medFilter=v;window.renderPharmInv()};
window.piMedLocFilter=function(v){PI_UI.medFilterLoc=v;window.renderPharmInv()};
window.piMedClsFilter=function(v){PI_UI.medFilterCls=v;window.renderPharmInv()};
window.piMedExpiryFilter=function(v){PI_UI.medFilterExpiry=v;window.renderPharmInv()};
window.piMedStatusFilter=function(v){PI_UI.medFilterStatus=v;window.renderPharmInv()};
window.piMedUrgencyFilter=function(v){PI_UI.medFilterUrgency=v;window.renderPharmInv()};
window.piMedDosageFilter=function(v){PI_UI.medFilterDosage=v;window.renderPharmInv()};
window.piMedToggleMulti=function(v){PI_UI.medFilterMultiLoc=v;window.renderPharmInv()};
window.piMedToggleOOS=function(v){PI_UI.medFilterOOS=v;window.renderPharmInv()};
window.piMedClearFilters=function(){
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
    return piLocRowHtml(rooms,val,l.expiry||'');
  }).join('');
}

window.piOpenAddMed=function(){PI_UI.editMedId='';piShowMedModal(null)};
window.piOpenEditMed=function(id){var m=piMeds().find(function(x){return x.id===id});PI_UI.editMedId=id;piShowMedModal(m)};

function piIntClsRadios(grp,fieldId,currentVal){
  var g=piIntCls()[grp];if(!g||!g.options)return '';
  var intColors=piIntColors();
  var opts=g.options.map(function(o){
    var checked=currentVal===o.key;
    var hex=intColors[o.key]||o.def||'#888';
    var lm=luma(hex);var tc=lm>128?'#111':'#fff';
    var style=checked?'background:'+hex+';color:'+tc+';border-color:'+hex:'border:1px solid var(--br)';
    return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;cursor:pointer;font-size:12px;'+(checked?'background:'+hex+';color:'+tc+';':'border:1px solid var(--br);')+'margin-bottom:4px">'+
      '<input type="radio" name="'+fieldId+'" value="'+piEsc(o.key)+'" '+(checked?'checked':'')+' style="display:none" onchange="piIntRadioChange(\''+piEsc(grp)+'\',\''+piEsc(fieldId)+'\',\''+piEsc(o.key)+'\',this)">'+
      piEsc(o.label)+'</label>';
  }).join('');
  // None option
  var noneChecked=!currentVal||currentVal==='none';
  return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;cursor:pointer;font-size:12px;border:1px solid var(--br);margin-bottom:4px;'+(noneChecked?'opacity:.5':'')+'">'+
    '<input type="radio" name="'+fieldId+'" value="none" '+(noneChecked?'checked':'')+' style="display:none" onchange="piIntRadioChange(\''+piEsc(grp)+'\',\''+piEsc(fieldId)+'\',\'none\',this)">None / لا يوجد</label>'+opts;
}
window.piIntRadioChange=function(grp,fieldId,key,radio){
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
    '<button class="btn bg bxs" style="margin-top:4px" onclick="piAddLocRow()">+ Add location</button>'+
    '</div>'+
    '<div style="margin-top:14px"><button class="btn bp" onclick="piSaveMed()">Save</button> <button class="btn bg bsm" onclick="piCloseModal()">Cancel</button></div>';
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
      (cab.shelves || []).forEach(function (sh) {
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
window.piTxnMedChanged = function (input) {
  var tr = input && input.closest ? input.closest('tr') : null;
  if (!tr) return;
  var cell = tr.querySelector('.pi-txn-loc');
  if (!cell) return;
  var current = cell.value;
  var type = tr.dataset.type || '';
  var wrapper = cell.parentNode;
  wrapper.innerHTML = piTxnLocSelectHtml(type, input.value, current);
};

function piLocRowHtml(rooms,locVal,expiryVal){
  return '<div class="fl g8 ic pi-loc-row" style="margin-bottom:6px;flex-wrap:wrap">'+
    '<select class="psel pi-loc-sel" style="flex:2;min-width:160px"><option value="">Select shelf...</option>'+
    rooms.map(function(room){return (room.cabinets||[]).map(function(cab){return (cab.shelves||[]).map(function(sh){var v=room.id+'|'+cab.id+'|'+sh.id;return '<option value="'+piEsc(v)+'" '+(v===locVal?'selected':'')+'>'+piEsc(room.name+' › '+cab.name+' › '+sh.name)+'</option>'}).join('')}).join('')}).join('')+
    '</select>'+
    '<input type="date" class="inp pi-loc-expiry" style="flex:1;min-width:130px" placeholder="Expiry for this batch" value="'+piEsc(expiryVal||'')+'">'+
    '<button class="btn bd2c bxs" onclick="this.closest(\'.pi-loc-row\').remove()">✕</button>'+
    '</div>';
}
window.piAddLocRow=function(){
  var c=piE('pi-med-locs');if(!c)return;
  var rooms=piRooms();
  var div=document.createElement('div');
  div.innerHTML=piLocRowHtml(rooms,'','');
  c.appendChild(div.firstChild);
};
window.piSaveMed=async function(){
  var name=String((piE('pi-med-name')||{}).value||'').trim();
  if(!name)return piToast('Enter a medicine name','err');
  var locations=[];
  document.querySelectorAll('#pi-med-locs .pi-loc-row').forEach(function(row){
    var sel=row.querySelector('.pi-loc-sel');var expInput=row.querySelector('.pi-loc-expiry');
    var v=sel?sel.value:'';if(!v)return;
    var parts=v.split('|');if(parts.length<3)return;
    locations.push({roomId:parts[0],cabId:parts[1],shelfId:parts[2],expiry:expInput?expInput.value.trim():''});
  });
  // Compute soonest non-expired location expiry as the medicine-level expiry for filtering/display
  var allLocExpiries=locations.map(function(l){return l.expiry}).filter(Boolean).sort();
  var computedExpiry=allLocExpiries.length?allLocExpiries[0]:String((piE('pi-med-expiry')||{}).value||'').trim();
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
window.piShowMedDetail=function(id){
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
  html+='<div style="margin-top:10px"><button class="btn bg bsm" onclick="piCloseModal()">Close</button>';
  if(piCanEdit())html+=' <button class="btn bp bsm" onclick="piCloseModal();piOpenEditMed(\''+piEsc(id)+'\')">✏️ Edit</button>';
  html+='</div>';
  piShowModal('pi-detail-modal',html);
};

window.piDeleteMed=async function(id){
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
    '<div class="fg"><label>Room</label><select id="pi-print-room" class="psel" onchange="piPrintRoomChange(this.value)">'+roomOpts+'</select></div>'+
    '<div class="fg"><label>Cabinet</label><select id="pi-print-cab" class="psel" onchange="PI_UI.printCabId=this.value">'+cabOpts+'</select></div>'+
    '</div>'+
    '<div class="fl g8 ic" style="flex-wrap:wrap;margin-bottom:12px">'+
    ['showMoh:MOH Code','showNupco:Nupco Code','showExpiry:Expiry Date','showQr:QR Code (expiry)','showRoom:Show Room'].map(function(x){
      var k=x.split(':')[0],l=x.split(':')[1];
      return '<label class="fl ic g8"><input type="checkbox" '+(opts[k]?'checked':'')+' onchange="PI_UI.printOpts.'+k+'=this.checked"> '+l+'</label>';
    }).join('')+
    '</div>'+
    '<div class="fl g8 ic" style="flex-wrap:wrap">'+
    '<button class="btn bp" onclick="piDoPrint()">🖨 Print Cabinet List</button>'+
    '<button class="btn bg bsm" onclick="piPrintRoomDoor()">🚪 Print Room Door List</button>'+
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
        (cab.shelves||[]).forEach(function(sh){
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
window.piPrintReorder=function(){
  var rooms=piRooms();var colors=piGetColors();
  var reorderMeds=piMeds().filter(function(m){return m.outOfStock||piExpiryStatus(m.expiry)==='expired'||piExpiryStatus(m.expiry)==='soon'});
  if(!reorderMeds.length)return piToast('No items need reordering','info');
  var css=piPrintCss(colors)+'  .ro-section{margin-bottom:20px} .ro-title{font-size:16px;font-weight:700;border-bottom:2px solid #000;margin-bottom:8px;padding-bottom:4px} .ro-soon{color:#b45309} .ro-expired,.ro-oos{color:#dc2626;font-weight:600}';
  var rows=reorderMeds.map(function(m){
    var stat=m.outOfStock?'<span class="ro-oos">⛔ Out of stock</span>':(piExpiryStatus(m.expiry)==='expired'?'<span class="ro-expired">⛔ Expired ('+piEsc(m.expiry)+')</span>':'<span class="ro-soon">⚠ Expiring '+piEsc(m.expiry)+' ('+piDaysToExpiry(m.expiry)+'d)</span>');
    var locs=(m.locations||[]).slice(0,3).map(function(l){var ro=rooms.find(function(r){return r.id===l.roomId});var ca=ro&&(ro.cabinets||[]).find(function(c){return c.id===l.cabId});return (ro?ro.name:'?')+(ca?' › '+ca.name:'')}).join(', ');
    return '<tr><td>'+piPrintClass2(m.classification,m.name,colors)+'</td><td class="mono">'+piEsc(m.mohCode||'—')+'</td><td class="mono">'+piEsc(m.nupcoCode||'—')+'</td><td>'+stat+'</td><td style="font-size:11px">'+piEsc(locs)+'</td></tr>';
  }).join('');
  var body='<div class="ro-section"><div class="ro-title">📋 Reorder List — '+new Date().toLocaleDateString('en-SA')+'</div>'+
    '<table class="pi-table"><thead><tr><th>Medicine</th><th>MOH</th><th>Nupco</th><th>Status</th><th>Location</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  var win=window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reorder List</title><style>'+css+'</style></head><body>'+body+'</body></html>');
  win.document.close();setTimeout(function(){win.print()},400);
};

window.piPrintRoomChange=function(v){
  PI_UI.printRoomId=v;PI_UI.printCabId='';window.renderPharmInv();
};
window.piPrintCabinet=function(roomId,cabId){
  PI_UI.tab='print';PI_UI.printRoomId=roomId;PI_UI.printCabId=cabId;window.renderPharmInv();
};
window.piPrintRoomDoor=function(){
  var rooms=piRooms();
  var meds=piMeds();
  var colors=piGetColors();
  var filtRooms=PI_UI.printRoomId?rooms.filter(function(r){return r.id===PI_UI.printRoomId}):rooms;
  var css=piPrintCss(colors)+'  .pi-door-block{break-inside:avoid;border:2px solid #000;border-radius:8px;padding:12px;margin-bottom:20px} .pi-door-title{font-size:18px;font-weight:700;margin-bottom:8px} .pi-door-cab{margin-bottom:6px;font-size:13px} .pi-door-qr{display:flex;align-items:center;gap:10px}';
  var body='';
  filtRooms.forEach(function(room){
    body+='<div class="pi-door-block"><div class="pi-door-title">🏠 '+piEsc(room.name)+'</div>';
    (room.cabinets||[]).forEach(function(cab){
      var cabMeds=meds.filter(function(m){return (m.locations||[]).some(function(l){return l.roomId===room.id&&l.cabId===cab.id})});
      body+='<div class="pi-door-cab"><b>'+piEsc(cab.name)+'</b>: ';
      body+=cabMeds.slice(0,8).map(function(m){return piEsc(m.name)}).join(', ')+(cabMeds.length>8?' +'+( cabMeds.length-8)+' more':'');
      body+='</div>';
    });
    body+='</div>';
  });
  var win=window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Room Door List</title><style>'+css+'</style></head><body>'+body+'</body></html>');
  win.document.close();setTimeout(function(){win.print()},400);
};

function piPrintCss(colors){
  return '@media print{@page{margin:10mm}}body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}.pi-cab-block{break-inside:avoid;margin-bottom:24px}.pi-cab-header{font-size:15px;font-weight:700;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:8px}.pi-cab-type{font-size:11px;font-weight:400;margin-left:8px;opacity:.6}.pi-shelf-label{font-size:11px;font-weight:600;margin:8px 0 3px;text-transform:uppercase;letter-spacing:.5px;opacity:.65}.pi-table{width:100%;border-collapse:collapse;margin-bottom:8px}.pi-table th,.pi-table td{border:1px solid #ccc;padding:3px 6px;text-align:left;font-size:11px}.pi-table th{background:#f0f0f0;font-weight:600}.pi-oos{opacity:.5;text-decoration:line-through}.mono{font-family:monospace}'+
    // Classification styles
    '.pi-ha{background:'+colors.ha+';color:'+(luma(colors.ha)>128?'#000':'#fff')+';padding:1px 4px;border-radius:2px}'+
    '.pi-haz{border-bottom:2px solid '+colors.haz+';position:relative}'+
    '.pi-haz::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(135deg,transparent,transparent 4px,'+colors.haz+'22 4px,'+colors.haz+'22 5px)}'+
    '.pi-lasa{outline:2px solid '+colors.lasa+';outline-offset:1px;display:inline-block;padding:0 3px}'+
    '.pi-soon td{background:#fef9c3}.pi-expired td{background:#fee2e2}.pi-oos{text-decoration:line-through;opacity:.55}';
}
function piPrintClass2(cls,name,colors){
  if(cls==='ha')return '<span class="pi-ha">'+piEsc(name)+'</span>';
  if(cls==='haz')return '<span class="pi-haz">'+piEsc(name)+'</span>';
  if(cls==='lasa')return '<span class="pi-lasa">'+piEsc(name)+'</span>';
  return piEsc(name);
}

window.piDoPrint=function(){
  var opts=PI_UI.printOpts;
  var rooms=piRooms();var meds=piMeds();var colors=piGetColors();
  var filtRooms=PI_UI.printRoomId?rooms.filter(function(r){return r.id===PI_UI.printRoomId}):rooms;
  var css=piPrintCss(colors);
  var body='';
  filtRooms.forEach(function(room){
    var cabs=(room.cabinets||[]).filter(function(c){return !PI_UI.printCabId||c.id===PI_UI.printCabId});
    cabs.forEach(function(cab){
      var cabMeds=meds.filter(function(m){return (m.locations||[]).some(function(l){return l.roomId===room.id&&l.cabId===cab.id})});
      body+='<div class="pi-cab-block">';
      body+='<div class="pi-cab-header">'+(opts.showRoom?piEsc(room.name)+' — ':'')+piEsc(cab.name)+'<span class="pi-cab-type">'+(cab.type==='dispensing'?'Dispensing':'Storage')+'</span></div>';
      var shelfMap={};
      cabMeds.forEach(function(m){(m.locations||[]).filter(function(l){return l.roomId===room.id&&l.cabId===cab.id}).forEach(function(l){if(!shelfMap[l.shelfId])shelfMap[l.shelfId]=[];shelfMap[l.shelfId].push(m)})});
      (cab.shelves||[]).forEach(function(sh){
        var shMeds=shelfMap[sh.id]||[];if(!shMeds.length)return;
        body+='<div class="pi-shelf-label">'+piEsc(sh.name)+'</div>';
        var intColorsP=piIntColors();
        body+='<table class="pi-table"><thead><tr><th>Medicine</th>';
        if(opts.showMoh)body+='<th>MOH</th>';if(opts.showNupco)body+='<th>Nupco</th>';
        body+='<th>Status</th><th>Urgency</th><th>Form</th>';
        if(opts.showExpiry&&!opts.showQr)body+='<th>Expiry</th>';if(opts.showQr)body+='<th>QR</th>';
        body+='</tr></thead><tbody>';
        shMeds.forEach(function(m){
          var expSt=piExpiryStatus(m.expiry);
          var rowCls=(m.outOfStock?'pi-oos':'')+(expSt==='soon'?' pi-soon':expSt==='expired'?' pi-expired':'');
          function piPrintIntBadge(grp,key){if(!key||key==='none')return '—';var g2=piIntCls()[grp];var o=g2&&(g2.options||[]).find(function(x){return x.key===key});if(!o)return piEsc(key);var hex=intColorsP[key]||o.def||'#888';var lm=luma(hex);return '<span style="background:'+hex+';color:'+(lm>128?'#000':'#fff')+';padding:1px 5px;border-radius:3px;font-size:10px">'+piEsc(o.label)+'</span>'}
          body+='<tr class="pi-med-row '+rowCls+'"><td>'+piPrintClass2(m.classification,m.name,colors)+(m.outOfStock?' <span style="color:#dc2626">[OOS]</span>':'')+(expSt==='soon'?' <span style="color:#b45309">⚠'+piDaysToExpiry(m.expiry)+'d</span>':expSt==='expired'?' <span style="color:#dc2626">⛔</span>':'')+'</td>';
          if(opts.showMoh)body+='<td class="mono">'+piEsc(m.mohCode||'—')+'</td>';
          if(opts.showNupco)body+='<td class="mono">'+piEsc(m.nupcoCode||'—')+'</td>';
          body+='<td>'+piPrintIntBadge('status',m.internalStatus)+'</td>';
          body+='<td>'+piPrintIntBadge('urgency',m.urgency)+'</td>';
          body+='<td>'+piPrintIntBadge('dosageForm',m.dosageForm)+'</td>';
          if(opts.showExpiry&&!opts.showQr)body+='<td style="'+(expSt!=='ok'?'color:'+(expSt==='soon'?'#b45309':'#dc2626'):'')+'">'+piEsc(m.expiry||'—')+'</td>';
          if(opts.showQr)body+='<td>'+(m.expiry?piQrSvg(m.expiry,36):'—')+'</td>';
          body+='</tr>';
        });
        body+='</tbody></table>';
      });
      body+='</div>';
    });
  });
  var win=window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pharmacy Inventory</title><style>'+css+'</style></head><body>'+body+'</body></html>');
  win.document.close();setTimeout(function(){win.print()},400);
};

/* Rendered by the bundled generator (window.makeReadableQR), which every other QR
   in the app uses. This used to point at a third-party QR image service, which the
   page's own CSP blocks under img-src 'self' data: blob: — so the code never
   actually appeared — and it sent the encoded value off-site. A data: URI also prints and
   works offline, which an external image does not. Falls back to the plain text
   if the generator is unavailable, so a label still carries the value. */
function piQrSvg(data,size){
  var value=String(data==null?'':data);
  if(!value)return '—';
  try{
    if(typeof window.makeReadableQR==='function'){
      var src=window.makeReadableQR(value);
      if(src)return '<img src="'+src+'" width="'+size+'" height="'+size+'" style="image-rendering:pixelated" alt="'+piEsc(value)+'">';
    }
  }catch(error){console.warn('QR generation failed; showing the value instead.',error)}
  return '<span style="font-size:9px;font-family:var(--mono)">'+piEsc(value)+'</span>';
}

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
    '<button class="btn bp" onclick="piDoImport()">⬇ Import</button>'+
    '<button class="btn bg bsm" onclick="piDownloadTemplate()">📥 Download template</button>'+
    '</div>'+
    '<div id="pi-import-result" style="margin-top:12px"></div>'+
    '</div></div>';
}

window.piDoImport=async function(){
  var raw=String((piE('pi-import-data')||{}).value||'').trim();
  if(!raw)return piToast('Paste data first','err');
  var cls=String((piE('pi-import-cls')||{}).value||'none');
  var lines=raw.split('\n').map(function(l){return l.trim()}).filter(Boolean);
  var imported=[];var skipped=[];
  var existingMeds=piClone(piMeds());
  var existingNames={};existingMeds.forEach(function(m){existingNames[(m.name||'').toLowerCase()]=true});
  lines.forEach(function(line,i){
    var cols=line.indexOf('\t')>=0?line.split('\t'):line.split(',');
    var name=String(cols[0]||'').trim();
    var moh=String(cols[1]||'').trim();
    var nupco=String(cols[2]||'').trim();
    if(!name||i===0&&(name.toLowerCase()==='name'||name.toLowerCase()==='medicine name')){skipped.push('Row '+(i+1)+': header/empty');return}
    if(existingNames[name.toLowerCase()]){skipped.push(name+' (duplicate)');return}
    existingNames[name.toLowerCase()]=true;
    imported.push({id:piUid('med'),name:name,mohCode:moh,nupcoCode:nupco,classification:cls,expiry:'',outOfStock:false,qrAlert:false,locations:[],updatedAt:piNow(),updatedBy:(window.CU&&CU.email)||''});
  });
  if(!imported.length)return piToast('Nothing to import (all duplicates or empty)','err');
  var next=existingMeds.concat(imported);
  try{
    await piSaveMeds(next);
    var res=piE('pi-import-result');
    if(res)res.innerHTML='<div class="alert-banner" style="background:var(--gnl2)">✓ Imported <b>'+imported.length+'</b> medicine(s).'+(skipped.length?' Skipped: '+skipped.join(', '):'')+'</div>';
    piToast('Imported '+imported.length,'succ');
  }catch(e){piToast(String(e&&e.message||e),'err')}
};

window.piDownloadTemplate=function(){
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
window.piCloseModal=function(){var m=piE('pi-global-modal');if(m)m.parentNode.removeChild(m)};

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
    ?['Medicine / الدواء','Location / الموقع','Qty / الكمية','Batch #','Expiry / الانتهاء','Supplier / المورد','Note / ملاحظة','']
    :['Medicine / الدواء','Location / الموقع','Qty / الكمية','Note / ملاحظة',''];
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
  html+='<table style="width:100%;border-collapse:collapse" id="pi-txn-rows-'+type+'">';
  html+='<thead><tr>'+cols.map(function(c){return'<th style="text-align:left;padding:4px 6px;font-size:11px;opacity:.6;white-space:nowrap">'+piEsc(c)+'</th>'}).join('')+'</tr></thead>';
  html+='<tbody id="pi-txn-body-'+type+'"></tbody></table>';
  html+='<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">';
  html+='<button class="btn bg bsm" type="button" onclick="piAddTxnRow(\''+type+'\')">+ Add row / إضافة صف</button>';
  html+='<button class="btn bp bsm" type="button" onclick="piSubmitTxnRows(\''+type+'\')">Save all / حفظ الكل</button>';
  if(isReceipt)html+='<label class="btn bg bsm" style="cursor:pointer">📄 PDF scan<input type="file" accept=".pdf,.txt,.csv" style="display:none" onchange="piPdfScan(this,\''+type+'\')"></label>';
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
  try{next.select()}catch(selectError){}
}
if(typeof document!=='undefined'&&!window.__piGridKeysBound){
  window.__piGridKeysBound=true;
  document.addEventListener('keydown',piGridKeydown,true);
}

window.piAddTxnRow=function(type){
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
  var cells=td('<input class="pi-txn-med" data-row="'+rowId+'" list="'+listId+'" placeholder="Medicine name..." style="min-width:160px;width:100%;box-sizing:border-box" oninput="piTxnMedChanged(this)" onchange="piTxnMedChanged(this)">');
  cells+=td(piTxnLocSelectHtml(type,'',''));
  cells+=td('<input class="pi-txn-qty" data-row="'+rowId+'" type="number" min="0" step="any" placeholder="0" style="width:70px">');
  if(isReceipt){
    cells+=td('<input class="pi-txn-batch" data-row="'+rowId+'" type="text" placeholder="Batch #" style="width:90px">');
    cells+=td('<input class="pi-txn-expiry" data-row="'+rowId+'" type="date" style="width:120px">');
    cells+=td('<input class="pi-txn-supplier" data-row="'+rowId+'" type="text" value="'+piEsc(carriedSupplier)+'" placeholder="Supplier / المورد" style="min-width:120px">');
  }
  cells+=td('<input class="pi-txn-note" data-row="'+rowId+'" type="text" placeholder="Note..." style="min-width:80px">');
  cells+=td('<button type="button" class="btn bd2c bxs" style="padding:2px 7px" onclick="document.getElementById(\''+rowId+'\').remove()">✕</button>');
  tr.innerHTML=cells;tbody.appendChild(tr);
  tr.querySelector('.pi-txn-med').focus();
};

window.piSubmitTxnRows=async function(type){
  var tbody=document.getElementById('pi-txn-body-'+type);if(!tbody)return;
  var isReceipt=type==='receipt';
  var rows=Array.from(tbody.querySelectorAll('tr'));
  if(!rows.length)return piToast('No rows to save / لا توجد صفوف','err');
  // One date for the whole entry, read once from the field above the grid.
  var dateEl=document.getElementById('pi-txn-date-'+type);
  var sharedDate=String((dateEl||{}).value||'').trim();
  if(!sharedDate){
    if(dateEl)dateEl.focus();
    return piToast(isReceipt?'Enter the receipt date / أدخل تاريخ الاستلام':'Enter the dispense date / أدخل تاريخ الصرف','err');
  }
  var records=[];var errs=[];
  rows.forEach(function(tr,i){
    var med=String((tr.querySelector('.pi-txn-med')||{}).value||'').trim();
    var date=sharedDate;
    var qty=parseFloat((tr.querySelector('.pi-txn-qty')||{}).value)||0;
    if(!med)return errs.push('Row '+(i+1)+': medicine name required');
    if(!date)return errs.push('Row '+(i+1)+': date required');
    if(qty<=0)return errs.push('Row '+(i+1)+': quantity must be > 0');
    var rec={id:piTxnId(),type:type,medName:med,qty:qty,date:date,createdAt:piNow(),createdBy:window.CU&&(CU.name||CU.email)||'',purgeAfter:new Date(Date.now()+piTxnSettings().purgeDays*864e5).toISOString()};
    if(isReceipt){
      rec.batchNo=String((tr.querySelector('.pi-txn-batch')||{}).value||'').trim();
      rec.expiry=String((tr.querySelector('.pi-txn-expiry')||{}).value||'').trim();
      rec.supplier=String((tr.querySelector('.pi-txn-supplier')||{}).value||'').trim();
    }
    var locVal=String((tr.querySelector('.pi-txn-loc')||{}).value||'').trim();
    if(locVal){
      var lp=locVal.split('|');
      rec.roomId=lp[0]||'';rec.cabId=lp[1]||'';rec.shelfId=lp[2]||'';
    }
    rec.note=String((tr.querySelector('.pi-txn-note')||{}).value||'').trim();
    records.push(rec);
  });
  if(errs.length)return piToast(errs[0],'err');
  try{
    var all=piTxns().concat(records);
    await piSaveTxns(all);
    /* Choosing a shelf the medicine was not assigned to is how a new location gets
       created — the point of offering them. Recording it on the medicine as well
       means the next entry lists it under "assigned" instead of asking again.
       Saved after the transactions so a failure here cannot lose the entry itself;
       the assignment is a convenience and is reported separately if it fails. */
    try{
      var addedLoc=0;
      var meds=piClone(piMeds());
      records.forEach(function(rec){
        if(!rec.shelfId)return;
        var med=meds.find(function(m){return String(m.name||'').trim().toLowerCase()===String(rec.medName||'').trim().toLowerCase()});
        if(!med)return;
        med.locations=med.locations||[];
        var exists=med.locations.some(function(l){
          return l.roomId===rec.roomId&&l.cabId===rec.cabId&&l.shelfId===rec.shelfId;
        });
        if(!exists){med.locations.push({roomId:rec.roomId,cabId:rec.cabId,shelfId:rec.shelfId,expiry:''});addedLoc++}
      });
      if(addedLoc)await piSaveMeds(meds);
    }catch(locError){
      console.error('Could not record the new location on the medicine.',locError);
      piToast('Entry saved, but the new location was not added to the medicine. / حُفظ الإدخال دون إضافة الموقع للدواء.','err');
    }
    piToast('Saved '+records.length+' record(s) ✓ / تم الحفظ ✓','succ');
    window.renderPharmInv();
  }catch(e){piToast(String(e&&e.message||e),'err')}
};

window.piPdfScan=async function(input,type){
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
  html+='<select id="pi-hist-ftype" class="psel" onchange="window.renderPharmInv()" style="min-width:120px"><option value="all">All / الكل</option><option value="receipt"'+(fType==='receipt'?' selected':'')+'>📥 Receive</option><option value="dispense"'+(fType==='dispense'?' selected':'')+'>📤 Dispense</option></select>';
  html+='<input id="pi-hist-fmed" type="text" placeholder="Medicine search / بحث دواء" style="min-width:160px" value="'+piEsc(fMed)+'" oninput="window.renderPharmInv()">';
  html+='<input id="pi-hist-ffrom" type="date" value="'+piEsc(fFrom)+'" onchange="window.renderPharmInv()" title="From date">';
  html+='<input id="pi-hist-fto" type="date" value="'+piEsc(fTo)+'" onchange="window.renderPharmInv()" title="To date">';
  if(fType!=='all'||fMed||fFrom||fTo)html+='<button class="btn bg bsm" onclick="piHistClear()">✕ Clear</button>';
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
    if(piIsMaster())html+='<td style="padding:5px 8px"><button class="btn bd2c bxs" style="font-size:11px;padding:1px 7px" onclick="piDeleteTxn(\''+piEsc(t.id)+'\')">Delete</button></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  if(eligible.length&&piIsMaster()){
    html+='<div style="margin-top:12px;padding:10px;background:rgba(245,158,11,.1);border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html+='<span style="font-size:13px">⚠ <b>'+eligible.length+'</b> record(s) are older than <b>'+settings.purgeDays+'</b> days and eligible for purge.</span>';
    html+='<button class="btn" style="background:#ef4444;color:#fff" onclick="piPurgeTxns()">Purge now / حذف القديم</button>';
    html+='</div>';
  }
  html+='</div></div>';
  if(piIsMaster()){
    html+='<div class="card" style="margin-top:12px"><div class="ch"><span class="ct">⚙ Settings / الإعدادات</span></div><div class="cb"><div class="fl g8 ic">';
    html+='<label style="font-size:13px">Auto-purge after <input id="pi-purge-days" type="number" min="30" max="3650" value="'+piEsc(String(settings.purgeDays))+'" style="width:70px;margin:0 4px"> days</label>';
    html+='<button class="btn bp bsm" onclick="piSavePurgeDays()">Save</button>';
    html+='</div></div></div>';
  }
  body.innerHTML=html;
}

window.piHistClear=function(){
  ['pi-hist-ftype','pi-hist-fmed','pi-hist-ffrom','pi-hist-fto'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=el.tagName==='SELECT'?'all':''});
  window.renderPharmInv();
};

window.piDeleteTxn=async function(id){
  if(!piIsMaster())return piToast('Master only.','err');
  if(!window.confirm('Delete this record? / حذف هذا السجل؟'))return;
  try{
    var all=piTxns().filter(function(t){return t.id!==id});
    await piSaveTxns(all);piToast('Deleted ✓','succ');window.renderPharmInv();
  }catch(e){piToast(String(e&&e.message||e),'err')}
};

window.piPurgeTxns=async function(){
  if(!piIsMaster())return piToast('Master only.','err');
  var settings=piTxnSettings();var cutoff=Date.now()-settings.purgeDays*864e5;
  var remaining=piTxns().filter(function(t){return new Date(t.createdAt).getTime()>=cutoff});
  var purged=piTxns().length-remaining.length;
  if(!window.confirm('Permanently delete '+purged+' old record(s)? This cannot be undone. / حذف '+purged+' سجل قديم بشكل نهائي؟'))return;
  try{await piSaveTxns(remaining);piToast('Purged '+purged+' record(s) ✓','succ');window.renderPharmInv()}catch(e){piToast(String(e&&e.message||e),'err')}
};

window.piSavePurgeDays=async function(){
  var inp=document.getElementById('pi-purge-days');if(!inp)return;
  var days=parseInt(inp.value)||365;
  if(days<30)return piToast('Minimum 30 days.','err');
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
  var recvCutoff=new Date(Date.now()-inactiveRecvDays*864e5).toISOString().slice(0,10);
  var allMeds=piMedSuggestions();
  var lastRecv={};
  txns.filter(function(t){return t.type==='receipt'}).forEach(function(t){
    var k=t.medName.trim();if(!lastRecv[k]||t.date>lastRecv[k])lastRecv[k]=t.date;
  });
  var notRecv=allMeds.filter(function(m){return !lastRecv[m]||lastRecv[m]<recvCutoff});

  html+='<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">📭 Not received since / لم يُستلم منذ</span></div><div class="cb">';
  html+='<div class="fl g8 ic" style="margin-bottom:10px"><label style="font-size:13px">Last <input id="pi-rpt-recv-days" type="number" min="1" value="'+inactiveRecvDays+'" style="width:60px;margin:0 4px" onchange="window.renderPharmInv()"> days</label></div>';
  if(!notRecv.length){html+='<div class="fhint">All medicines received within this period ✓</div>';}
  else{
    html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid var(--br)"><th style="text-align:left;padding:5px 8px">Medicine</th><th style="text-align:left;padding:5px 8px">Last Receipt</th></tr></thead><tbody>';
    notRecv.forEach(function(m){html+='<tr style="border-bottom:1px solid var(--br)"><td style="padding:5px 8px"><b>'+piEsc(m)+'</b></td><td style="padding:5px 8px;opacity:.7">'+(lastRecv[m]||'Never / لم يُستلم قط')+'</td></tr>'});
    html+='</tbody></table></div>';
  }
  html+='</div></div>';

  // ── Not dispensed filter ──
  var dispCutoff=new Date(Date.now()-inactiveDispDays*864e5).toISOString().slice(0,10);
  var lastDisp={};
  txns.filter(function(t){return t.type==='dispense'}).forEach(function(t){
    var k=t.medName.trim();if(!lastDisp[k]||t.date>lastDisp[k])lastDisp[k]=t.date;
  });
  var notDisp=allMeds.filter(function(m){return !lastDisp[m]||lastDisp[m]<dispCutoff});

  html+='<div class="card" style="margin-bottom:12px"><div class="ch"><span class="ct">📤 Not dispensed since / لم يُصرف منذ</span></div><div class="cb">';
  html+='<div class="fl g8 ic" style="margin-bottom:10px"><label style="font-size:13px">Last <input id="pi-rpt-disp-days" type="number" min="1" value="'+inactiveDispDays+'" style="width:60px;margin:0 4px" onchange="window.renderPharmInv()"> days</label></div>';
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
  html+='<label style="font-size:13px">From <input id="pi-rpt-sum-from" type="date" value="'+piEsc(sumFrom)+'" onchange="window.renderPharmInv()" style="margin:0 4px"></label>';
  html+='<label style="font-size:13px">To <input id="pi-rpt-sum-to" type="date" value="'+piEsc(sumTo)+'" onchange="window.renderPharmInv()" style="margin:0 4px"></label>';
  html+='<input id="pi-rpt-sum-med" type="text" placeholder="Filter medicine / فلتر" value="'+piEsc(sumMed)+'" oninput="window.renderPharmInv()" style="min-width:140px">';
  html+='</div>';
  var sumData={};
  txns.filter(function(t){return t.date>=sumFrom&&t.date<=sumTo&&(!sumMed||t.medName.toLowerCase().indexOf(sumMed)>=0)}).forEach(function(t){
    var k=t.medName.trim();if(!sumData[k])sumData[k]={recv:0,disp:0};
    if(t.type==='receipt')sumData[k].recv+=t.qty;else sumData[k].disp+=t.qty;
  });
  var sumKeys=Object.keys(sumData).sort();
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

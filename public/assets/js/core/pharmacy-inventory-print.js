/* Everything the pharmacy inventory prints: the reorder list, a cabinet's
   contents, the cabinet map with its QR codes, the room door list, and the full
   inventory.

   These five sheets are what actually leaves the screen and gets pinned to a
   cabinet door, so they share one house style (core/pharmacy-print-style.js)
   and one printer (core/print-window.js) rather than each carrying its own.

   Moved out of modules/84 whole: the module keeps the screens, this keeps the
   paper. Everything here reads the inventory through the accessors it is given
   at call time, so nothing is duplicated to make the move. */

import { fsEsc as piEsc } from './dom-utils.js?v=b2909b7f46';
import { printDocument } from './print-window.js?v=7e3e2088a2';
import { pharmacyPrintCss as piPrintCss, pharmacyPrintName as piPrintClass2, pharmacyPrintQr as piQrSvg, luma } from './pharmacy-print-style.js?v=be72d2bca8';
import { piShelvesOf, piShelfCells, piCellLabel, piExpiryStatus, piDaysToExpiry } from './pharmacy-inventory-model.js?v=77f4ad8cd5';
import { medicinesNeedingReorder, visibleMedicines } from './pharmacy-inventory-filters.js?v=709188b2f5';

/* Supplied by the screen: reading the inventory is its job, not this file's. */
let inventory = { rooms: () => [], meds: () => [], colors: () => ({}), ui: () => ({}), toast: () => {}, allowedRooms: () => [], intCls: () => ({}), intColors: () => ({}), syncPublicCabinet: () => Promise.resolve() };
export function usePharmacyInventory(accessors) { inventory = Object.assign({}, inventory, accessors); }

const piRooms = (...args) => inventory.rooms(...args);
const piMeds = (...args) => inventory.meds(...args);
const piGetColors = (...args) => inventory.colors(...args);
const piToast = (...args) => inventory.toast(...args);
const piAllowedRooms = (...args) => inventory.allowedRooms(...args);
/* The internal classification vocabulary and its colours are the screen's, and
   the public cabinet mirror is written by the screen too — both are handed in. */
const piIntCls = (...args) => inventory.intCls(...args);
const piIntColors = (...args) => inventory.intColors(...args);
const piSyncPublicCabinet = (...args) => inventory.syncPublicCabinet(...args);
const PI_UI_PROXY = new Proxy({}, { get: (target, key) => inventory.ui()[key] });
const PI_UI = PI_UI_PROXY;

function piPrintReorder(){
  var rooms=piRooms();var colors=piGetColors();
  /* The same list the screen shows, under the same room restriction: this used
     to read every medicine in the pharmacy, so a staff member assigned to two
     rooms printed a reorder list covering rooms they cannot even see. */
  var reorderMeds=medicinesNeedingReorder(visibleMedicines(piMeds(),piAllowedRooms()));
  if(!reorderMeds.length)return piToast('No items need reordering','info');
  var css=piPrintCss(colors)+'  .ro-section{margin-bottom:20px} .ro-title{font-size:16px;font-weight:700;border-bottom:2px solid #000;margin-bottom:8px;padding-bottom:4px} .ro-soon{color:#b45309} .ro-expired,.ro-oos{color:#dc2626;font-weight:600}';
  var rows=reorderMeds.map(function(m){
    var stat=m.outOfStock?'<span class="ro-oos">⛔ Out of stock</span>':(piExpiryStatus(m.expiry)==='expired'?'<span class="ro-expired">⛔ Expired ('+piEsc(m.expiry)+')</span>':'<span class="ro-soon">⚠ Expiring '+piEsc(m.expiry)+' ('+piDaysToExpiry(m.expiry)+'d)</span>');
    var locs=(m.locations||[]).slice(0,3).map(function(l){var ro=rooms.find(function(r){return r.id===l.roomId});var ca=ro&&(ro.cabinets||[]).find(function(c){return c.id===l.cabId});return (ro?ro.name:'?')+(ca?' › '+ca.name:'')}).join(', ');
    return '<tr><td>'+piPrintClass2(m.classification,m.name,colors)+'</td><td class="mono">'+piEsc(m.mohCode||'—')+'</td><td class="mono">'+piEsc(m.nupcoCode||'—')+'</td><td>'+stat+'</td><td style="font-size:11px">'+piEsc(locs)+'</td></tr>';
  }).join('');
  var body='<div class="ro-section"><div class="ro-title">📋 Reorder List — '+new Date().toLocaleDateString('en-SA')+'</div>'+
    '<table class="pi-table"><thead><tr><th>Medicine</th><th>MOH</th><th>Nupco</th><th>Status</th><th>Location</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  printDocument({ title:'Reorder List', html:body, css:css, brand:'' });
};


function piPrintCabinet(roomId,cabId){
  PI_UI.tab='print';PI_UI.printRoomId=roomId;PI_UI.printCabId=cabId;window.renderPharmInv();
};

function piPublicCabinetUrl(cabId,shelfId){
  var base=new URL(location.href);
  base.search='';base.hash='';
  base.searchParams.set('view','pharm-cabinet');
  base.searchParams.set('cab',String(cabId));
  if(shelfId)base.searchParams.set('shelf',String(shelfId));
  var t=window.fsTenantId&&fsTenantId();if(t)base.searchParams.set('tenant',t);
  return base.toString();
}

async function piPrintCabinetMap(roomId,cabId){
  var rooms=piRooms();
  var room=(rooms||[]).find(function(r){return r.id===roomId});
  if(!room)return piToast('Room not found / الغرفة غير موجودة','err');
  var cab=(room.cabinets||[]).find(function(c){return c.id===cabId});
  if(!cab)return piToast('Cabinet not found / الخزانة غير موجودة','err');

  var shelves=piShelvesOf(cab);
  if(!shelves.length)return piToast('This cabinet has no shelves yet / لا توجد أرفف بعد','err');

  var meds=piMeds();
  var colors=piGetColors();

  var published=false;
  try{published=await piSyncPublicCabinet(room,cab,shelves)}
  catch(err){console.warn('Public cabinet snapshot failed',err)}
  // A QR that opens an empty or stale page is worse than no QR, so it is only
  // printed when the snapshot it points at was actually written just now.
  if(!published)piToast('Printed without QR — the public copy could not be saved. / طُبعت بلا رمز: تعذر حفظ النسخة العامة','err');

  // medicines that name a cell go in it; the rest are listed under the map so a
  // medicine is never drawn in a position nobody recorded.
  var byCell={},unplaced=[];
  meds.forEach(function(m){
    (m.locations||[]).forEach(function(l){
      if(l.roomId!==room.id||l.cabId!==cab.id)return;
      var sh=shelves.find(function(x){return x.id===l.shelfId});
      if(!sh)return;
      var c=parseInt(l.cell,10);
      if(c>0&&c<=piShelfCells(sh)){
        var k=sh.id+':'+c;
        (byCell[k]=byCell[k]||[]).push(m);
      }else{
        unplaced.push({shelf:sh,med:m});
      }
    });
  });

  /* Rows share the page equally, so the more shelves a cabinet has the shorter each
     one is. Overflow was hidden, which on a pharmacy map means a medicine that is
     really there simply is not shown. Estimate how many chips a row can hold and
     say "+N more" for the rest, so the sheet never under-reports. */
  var rowMm=Math.max(8,(258-shelves.length*3)/shelves.length);
  var chipCap=Math.max(1,Math.floor((rowMm-5)/3.6));

  function medChip(m){
    var cls=m.outOfStock?' oos':'';
    var st=piExpiryStatus(m.expiry);
    if(st==='expired')cls+=' exp';else if(st==='soon')cls+=' soon';
    return '<span class="mchip'+cls+'">'+(m.high_alert?'<i class="ha"></i>':'')+piEsc(m.name)+'</span>';
  }

  var grid='<div class="map">'+shelves.map(function(sh){
    var n=piShelfCells(sh);
    var cells='';
    for(var i=1;i<=n;i++){
      var list=byCell[sh.id+':'+i]||[];
      var shown=list.slice(0,chipCap),hidden=list.length-shown.length;
      cells+='<div class="cell"><b class="clab">'+piEsc(piCellLabel(sh,i-1))+'</b>'+
             '<div class="cbody">'+shown.map(medChip).join('')+
             (hidden>0?'<span class="mchip more">+'+hidden+' more</span>':'')+
             '</div></div>';
    }
    /* One QR per shelf: staff scan the shelf they are standing at. Below about
       18mm a printed code stops scanning reliably, so on a tall cabinet the row
       QR is dropped and the header code -- which opens the whole cabinet --
       carries it instead. Printing an unscannable square helps nobody. */
    var shelfQr=(published&&rowMm>=18)?'<div class="sqr">'+piQrSvg(piPublicCabinetUrl(cab.id,sh.id),44)+'</div>':'';
    return '<div class="srow">'+
      '<div class="shead">'+piEsc(sh.name)+shelfQr+'</div>'+
      '<div class="scells" style="grid-template-columns:repeat('+n+',1fr)">'+cells+'</div>'+
    '</div>';
  }).join('')+'</div>';

  var foot='';
  if(unplaced.length){
    var byShelf={};
    unplaced.forEach(function(u){(byShelf[u.shelf.name]=byShelf[u.shelf.name]||[]).push(u.med)});
    foot='<div class="foot"><b><bdi>On a shelf without a recorded cell / على الرف بلا خانة محددة</bdi>:</b> '+
      Object.keys(byShelf).map(function(k){
        return '<bdi>'+piEsc(k)+' — '+byShelf[k].map(function(m){return piEsc(m.name)}).join(', ')+'</bdi>';
      }).join(' · ')+'</div>';
  }

  var css=
    '@page{size:A4 portrait;margin:8mm}'+
    'html,body{margin:0;width:100%}'+
    'body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;height:281mm;display:flex;flex-direction:column;overflow:hidden}'+
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}'+
    '.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px;flex:0 0 auto}'+
    '.head h1{font-size:15pt;margin:0}.head .sub{font-size:9pt;color:#333}'+
    '.hqr{text-align:center}.hqr img{display:block;width:20mm;height:20mm;margin:0 auto;image-rendering:pixelated}.hqr b{display:block;font-size:6.5pt;margin-top:1px}'+
    '.map{flex:1 1 auto;display:flex;flex-direction:column;gap:3mm;margin-top:3mm;min-height:0}'+
    '.srow{flex:1 1 0;display:flex;min-height:0;border:1.5px solid #000;border-radius:3px;overflow:hidden}'+
    '.shead{flex:0 0 18mm;background:#e8f0ff;border-right:1.5px solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm;font-weight:700;font-size:11pt}'+
    '.sqr img{display:block;width:13mm;height:13mm;image-rendering:pixelated}'+
    '.scells{flex:1 1 auto;display:grid;min-width:0}'+
    '.cell{border-right:1px dashed #94a3b8;padding:1.5mm;display:flex;flex-direction:column;min-width:0;overflow:hidden}'+
    '.cell:last-child{border-right:none}'+
    '.clab{font-size:7pt;color:#475569;flex:0 0 auto}'+
    '.cbody{flex:1 1 auto;display:flex;flex-wrap:wrap;gap:1mm;align-content:flex-start;overflow:hidden;margin-top:1mm}'+
    '.mchip{font-size:7.5pt;line-height:1.15;border:1px solid #64748b;border-radius:2px;padding:0 1mm;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.mchip .ha{display:inline-block;width:5px;height:5px;border-radius:50%;background:'+colors.ha+';margin-right:2px}'+
    '.mchip.more{border-style:dashed;font-weight:700}'+
    '.mchip.soon{background:#fef9c3}.mchip.exp{background:#fee2e2}.mchip.oos{text-decoration:line-through;opacity:.6}'+
    '.foot{flex:0 0 auto;border-top:1px solid #000;margin-top:2mm;padding-top:1.5mm;font-size:7.5pt}'+
    '.legend{flex:0 0 auto;font-size:7pt;color:#334155;margin-top:1.5mm}';

  /* "4 shelves / أرفف" next to "Storage / مستودع" on one line lets the bidi
     algorithm interleave the two pairs into nonsense. <bdi> isolates each. */
  function bd(t){return '<bdi>'+piEsc(t)+'</bdi>'}
  var head='<div class="head"><div><h1>'+piEsc(cab.name)+'</h1>'+
    '<div class="sub">'+bd(room.name)+' · '+bd(cab.type==='dispensing'?'Dispensing / منطقة صرف':'Storage / مستودع')+
    ' · '+bd(shelves.length+' shelves / أرفف')+'</div></div>'+
    '<div class="hqr">'+(published?piQrSvg(piPublicCabinetUrl(cab.id,''),80)+'<b>Scan for live list / امسح للقائمة</b>':'')+
    '<div class="sub">'+new Date().toLocaleDateString('en-GB')+'</div></div></div>';

  var legend='<div class="legend">'+
    ['● high-alert / عالي الخطورة','▪ yellow = expiring soon / قرب الانتهاء','▪ red = expired / منتهٍ','▪ struck through = out of stock / غير متوفر','⌁ +N more = cell is fuller than the space shown / الخانة فيها أكثر']
      .map(bd).join(' &nbsp; ')+'</div>';

  printDocument({ title:cab.name+' — Map', html:head+grid+foot+legend, css:css, brand:'' });
};

function piPrintRoomDoor(){
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
  printDocument({ title:'Room Door List', html:body, css:css, brand:'' });
};


function piDoPrint(){
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
      piShelvesOf(cab).forEach(function(sh){
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
  printDocument({ title:'Pharmacy Inventory', html:body, css:css, brand:'' });
};


export { piPrintReorder, piPrintCabinet, piPublicCabinetUrl, piPrintCabinetMap, piPrintRoomDoor, piDoPrint };

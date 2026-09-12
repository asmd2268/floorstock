import { publishLegacy } from '../core/legacy-registry.js?v=003344116e';
import { installActions } from '../core/delegated-actions.js?v=078b8d25e6';

// ── SHELVES ──────────────────────────────────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, el, gd, getMeds, getExpiry, deptName, syncPublicExpiry,
// warnPublicSync, officialPrintHeaderHTML, openBlobPrint) is already published
// to globalThis by its owning module.
function renderShelves(){
  renderShelfAlertSettings();
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},shelfRole=window.fsEffectiveRole?window.fsEffectiveRole():String(profile.role||''),shelfDept=String(profile.deptId||profile.departmentId||'');
  if(!profile||shelfRole!=='department'||!shelfDept)return;
  var shelfPrintCard=el('shelf-print-card'),shelfPrintTop=el('shelf-print-top-btn'),shelfPrintButton=el('print-shelf-btn');
  if(shelfPrintCard)shelfPrintCard.style.display='block';
  if(shelfPrintButton){shelfPrintButton.disabled=false;shelfPrintButton.style.display='inline-flex'}
  if(shelfPrintTop){shelfPrintTop.disabled=false;shelfPrintTop.style.display='inline-flex';shelfPrintTop.onclick=printShelfList}
  el('shelves-sub').textContent=(profile.deptName||shelfDept)+' — Shelf Management';
  var shelves=getShelves(shelfDept);
  var ms=getMeds(shelfDept);
  // Count meds per shelf
  var shelfCounts={};
  // A medicine may sit in several drawers, so it counts toward each of them.
  ms.forEach(function(m){shelfIdsOf(m).forEach(function(sid){shelfCounts[sid]=(shelfCounts[sid]||0)+1});});
  // Render shelves table
  el('shelves-tbl').innerHTML=shelves.length
    ?shelves.map(function(s){
      return '<tr><td><span class="shelf-badge">'+s.name+'</span></td>'
        +'<td style="color:var(--tx2);font-size:12px">'+(s.desc||'—')+'</td>'
        +'<td style="font-family:var(--mono)">'+(shelfCounts[s.id]||0)+' meds</td>'
        +'<td style="white-space:nowrap">'
          +'<button class="btn bg bxs" data-sid="'+s.id+'" data-name="'+s.name+'" data-desc="'+(s.desc||'')+'" data-clickact="shelfEdit">✏</button> '
          +'<button class="btn bd2c bxs" data-sid="'+s.id+'" data-clickact="shelfRemove">✕</button>'
        +'</td></tr>';
    }).join('')
    :'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx2)">No shelves yet — click + Add Shelf</td></tr>';
  // Populate print shelf selector
  var pSel=el('print-shelf-sel');
  if(pSel){pSel.innerHTML='<option value="all">All Shelves / &#x643;&#x644; &#x627;&#x644;&#x623;&#x631;&#x641;&#x641;</option>'
    +shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');}
  var assigned=ms.filter(function(m){return shelfIdsOf(m).length>0}).length;
  if(el('shelves-summary'))el('shelves-summary').innerHTML='<div class="sc" style="padding:12px"><div class="sl">Medications</div><div class="sv" style="font-size:22px">'+ms.length+'</div></div>'+'<div class="sc" style="padding:12px"><div class="sl">Assigned</div><div class="sv" style="font-size:22px">'+assigned+'</div></div>'+'<div class="sc" style="padding:12px"><div class="sl">Unassigned</div><div class="sv" style="font-size:22px">'+(ms.length-assigned)+'</div></div>';
  if(typeof renderShelfMedicationDatabase==='function')renderShelfMedicationDatabase();
}
/* Resolved at call time: the shared helper is published by module 07j, which
   loads after this file. Falls back to the legacy single shelfId. */
function shelfIdsOf(m){
  if(typeof window.fsMedShelfIds==='function')return window.fsMedShelfIds(m);
  if(!m)return [];
  if(Array.isArray(m.shelfIds))return m.shelfIds.filter(Boolean).map(String);
  return m.shelfId?[String(m.shelfId)]:[];
}
function getShelfName(shelfId){
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},dept=String(profile.deptId||profile.departmentId||'');if(!dept)return '';
  var s=getShelves(dept).find(function(x){return x.id===shelfId});
  return s?s.name:'?';
}
function openAddShelf(){
  el('mshelf-title').textContent='Add Shelf / إضافة رف';
  el('shelf-name-inp').value='';el('shelf-desc-inp').value='';el('shelf-edit-id').value='';
  OM('mshelf');
}
function openEditShelf(btn){
  el('mshelf-title').textContent='Edit Shelf / تعديل رف';
  el('shelf-name-inp').value=btn.dataset.name||'';
  el('shelf-desc-inp').value=btn.dataset.desc||'';
  el('shelf-edit-id').value=btn.dataset.sid||'';
  OM('mshelf');
}
/* The sheet carries a QR onto the drawer, and that QR is only as good as the
   published expiry document behind it. Nothing in this flow used to publish:
   public_expiry/<dept> is written when an expiry row is saved and by the drug
   list print, so a drawer created or re-stocked since the last expiry save was
   missing from it entirely — scanning the drawer's own QR opened an empty list,
   or "Public expiry list was not found" for a department that had never saved
   an expiry at all. Published before the sheet is built, so the code printed on
   the paper and the data behind it are the same moment.
   يُنشر سجل الصلاحية قبل الطباعة حتى يعمل رمز QR الملصق على الدرج. */
async function printShelfList(){
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},printRole=window.fsEffectiveRole?window.fsEffectiveRole():String(profile.role||''),deptId=String(profile.deptId||profile.departmentId||'');
  if(printRole!=='department'||!deptId)return toast('Shelf printing is available to department accounts for their own department. / طباعة الأرفف متاحة لحساب القسم لقسمه فقط.','err');
  try{
    var published=typeof syncPublicExpiry==='function'&&typeof getExpiry==='function'
      ?await syncPublicExpiry(deptId,getExpiry(deptId)||[])
      :false;
    if(!published)warnPublicSync('Shelf list QR',new Error('Firebase authentication is unavailable.'));
  }catch(syncError){warnPublicSync('Shelf list QR',syncError)}
  var shelfId=el('print-shelf-sel').value;
  var clsFilter=el('print-shelf-cls').value;
  var ms=getMeds(deptId);
  var shelves=getShelves(deptId);
  var today=fmtDate(nowISO());
  var deptName=profile.deptName||deptId;
  // Apply filters
  var filtered=ms.filter(function(m){
    var shMatch=shelfId==='all'||shelfIdsOf(m).indexOf(shelfId)>=0;
    var clMatch=true;
    if(clsFilter==='high_alert')clMatch=!!m.high_alert;
    else if(clsFilter==='hazard')clMatch=!!m.hazard;
    else if(clsFilter==='lasa')clMatch=!!m.lasa;
    else if(clsFilter==='standard')clMatch=!m.high_alert&&!m.hazard&&!m.lasa;
    return shMatch&&clMatch;
  });
  if(!filtered.length)return toast('No medications match the selected filters','err');
  // Group by shelf then category
  var byShelf={};
  // Printed under every drawer it belongs to: the sheet is read at the shelf, so a
  // medicine kept in two drawers has to appear on both lists.
  filtered.forEach(function(m){
    var sids=shelfIdsOf(m);
    if(!sids.length)sids=['__none__'];
    sids.forEach(function(sid){
      if(!byShelf[sid])byShelf[sid]=[];
      byShelf[sid].push(m);
    });
  });
  /* When one drawer is being printed the QR is scoped to it, so scanning the sheet
     taped to that drawer checks exactly what is in it rather than the whole
     department. Printing All Shelves keeps the department-wide link. */
  var expiryUrl=getPublicExpiryUrl(deptId);
  if(shelfId&&shelfId!=='all'){
    expiryUrl+=(expiryUrl.indexOf('?')>=0?'&':'?')+'shelf='+encodeURIComponent(shelfId);
  }
  var qrUrl=window.makeReadableQR(expiryUrl);
  var qrSiteUrl=window.makeReadableQR(getAppUrl());
  
  var _cs=getComputedStyle(document.documentElement);
  function _rgb(v,fb){return 'rgba('+(_cs.getPropertyValue(v).trim()||fb)+',1)'}
  var pHex={ha:_rgb('--cls-ha-rgb','239,68,68'),lasa:_rgb('--cls-lasa-rgb','14,165,233'),ref:_rgb('--cls-ref-rgb','147,51,234'),haz:_rgb('--cls-haz-rgb','234,179,8')};
  var rows='';
  Object.keys(byShelf).sort().forEach(function(sid){
    var shelf=sid==='__none__'?{name:'Unassigned / &#x63A;&#x64A;&#x631; &#x645;&#x639;&#x64A;&#x646;'}:shelves.find(function(s){return s.id===sid});
    var shName=shelf?shelf.name:'Unknown';
    // Group by category within shelf
    var byCat={};
    byShelf[sid].forEach(function(m){if(!byCat[m.category])byCat[m.category]=[];byCat[m.category].push(m);});
    rows+='<tr><td colspan="4" style="background:#2a2a2a;color:#fff;font-weight:700;font-size:9pt;padding:5px 8px">📦 '+shName+(shelf&&shelf.desc?' — '+shelf.desc:'')+'</td></tr>';
    Object.keys(byCat).sort().forEach(function(cat){
      rows+='<tr><td colspan="4" style="background:#e8e8e8;font-weight:600;font-size:7.5pt;text-transform:uppercase;padding:3px 8px;color:#555">'+cat+' / '+catAr(cat)+'</td></tr>';
      byCat[cat].forEach(function(m){
        var bc=m.high_alert?pHex.ha:m.hazard?pHex.haz:m.lasa?pHex.lasa:m.refrigerated?pHex.ref:'transparent';
        var bg=m.high_alert?'#fff0f0':m.hazard?'#fffbea':m.lasa?'#f0f9ff':m.refrigerated?'#faf5ff':'#fff';
        var classes=[];
        if(m.high_alert)classes.push(['HIGH ALERT',pHex.ha]);
        if(m.lasa)classes.push(['LASA',pHex.lasa]);
        if(m.hazard)classes.push(['HAZARD',pHex.haz]);
        if(m.refrigerated)classes.push(['REFRIGERATED',pHex.ref]);
        // Marked by the department; shown on the sheet so whoever restocks sees it.
        if(m.outOfStock)classes.push(['OUT OF STOCK / نفد','#6e7781']);
        var flag=classes.map(function(c){
          return '<span style="color:'+c[1]+';font-weight:700;font-size:6.5pt;white-space:nowrap">'+c[0]+'</span>';
        }).join('<span style="color:#bbb;font-size:6.5pt"> &middot; </span>');
        rows+='<tr style="background:'+bg+';border-left:3px solid '+bc+'">'
          +'<td style="padding:3px 6px;border:1px solid #ddd;font-weight:500">'+m.name+'</td>'
          +'<td style="padding:3px 6px;border:1px solid #ddd;text-align:center">'+flag+'</td>'
          +'<td style="padding:3px 6px;border:1px solid #ddd;text-align:center;font-weight:700">'+m.min+'</td>'
          +'<td style="padding:3px 6px;border:1px solid #ddd;text-align:center;font-weight:700">'+m.max+'</td>'
          +'</tr>';
      });
    });
  });
  var filterLabel=clsFilter==='all'?'All Classifications':clsFilter.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
  var shelfLabel=shelfId==='all'?'All Shelves':(shelves.find(function(s){return s.id===shelfId})||{name:'?'}).name;
  var slHtml='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+deptName+' — Shelf List</title><style>'
    +'@page{size:A4;margin:10mm 10mm 18mm 10mm}'
    /* A4 portrait with 10mm margins leaves 190mm of printable width. Constraining
       the document to it makes the on-screen preview render at the same width as
       the paper, instead of stretching across a 2000px window and opening a gap
       between the medicine name and the columns beside it. */
    +'body{font-family:Arial,sans-serif;font-size:8.5pt;color:#000;margin:0 auto;max-width:190mm}'
    /* Fixed layout with explicit widths: auto layout gave the leftover width to
       the Medication column, which is why its short names sat far from the rest. */
    +'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    +'td{overflow-wrap:anywhere}'
    +'th{background:#1f2328;color:#fff;padding:5px 6px;text-align:left;font-size:7.5pt}'
    +'th.c{text-align:center}'
    +'tr{page-break-inside:avoid}'
    +'thead{display:table-header-group}'
    +'#footer{position:fixed;bottom:0;left:0;right:0;font-size:6.5pt;color:#555;display:flex;justify-content:space-between;align-items:center;padding:4px 10px;border-top:1px solid #ccc;background:#fff}'
    +'</style></head><body>'
    +officialPrintHeaderHTML()
    +'<div style="position:relative;min-height:96px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #000">'
    +'<div style="text-align:center;padding:0 200px 0 40px">'
    +'<div style="font-size:13pt;font-weight:700">'+deptName+' — Floor Stock / &#x623;&#x62F;&#x648;&#x64A;&#x629; &#x627;&#x644;&#x642;&#x633;&#x645;</div>'
    +'<div style="font-size:8pt;color:#333;margin-top:3px">Date: <b>'+today+'</b> &nbsp;|&nbsp; Shelf: <b>'+shelfLabel+'</b> &nbsp;|&nbsp; Filter: <b>'+filterLabel+'</b> &nbsp;|&nbsp; Items: <b>'+filtered.length+'</b></div>'
    +'<div style="font-size:7pt;color:#666;margin-top:2px">By: '+(profile.username||profile.email||'Department')+' &nbsp;|&nbsp; Developed by Ali Abudahash | ASDHealth</div>'
    +'</div>'
    +'<div style="position:absolute;top:0;right:0;display:flex;gap:8px">'
    +'<div style="text-align:center"><img class="asd-qr-image" src="'+qrSiteUrl+'" width="90" height="90" alt="System QR code"><div style="font-size:5.5pt;color:#888">System</div></div>'
    +'<div style="text-align:center"><img class="asd-qr-image" src="'+qrUrl+'" width="90" height="90" alt="Expiry monitor QR code"><div style="font-size:5.5pt;color:#888">Expiry Monitor'+(shelfId&&shelfId!=='all'?' — '+shelfLabel:'')+'</div></div>'
    +'</div>'
    +'</div>'
    +'<table>'
    +'<colgroup><col style="width:48%"><col style="width:26%"><col style="width:13%"><col style="width:13%"></colgroup>'
    +'<thead><tr>'
    +'<th>Medication / &#x627;&#x644;&#x62F;&#x648;&#x627;&#x621;</th>'
    +'<th>Classification / &#x627;&#x644;&#x62A;&#x635;&#x646;&#x64A;&#x641;</th>'
    +'<th class="c">Min / &#x627;&#x644;&#x623;&#x62F;&#x646;&#x649;</th>'
    +'<th class="c">Max / &#x627;&#x644;&#x623;&#x639;&#x644;&#x649;</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div id="footer">'
    +'<span>'+deptName+' — Floor Stock — '+today+' — By Ali Abudahash</span>'
    +'<img class="asd-qr-image" src="'+qrUrl+'" width="76" height="76" alt="Expiry monitor QR code">'
    +'</div>'
    /* The shared print runtime, not a timer: it waits for every QR image to
       decode and refuses to print a sheet whose QR came back as the
       "QR unavailable" placeholder, which would go onto a drawer looking like a
       code and scan as nothing. / لا تُطبع ورقة برمز QR غير قابل للمسح. */
    +'<script>'+window.ASD_QR.printRuntimeScript({})+'</sc'+'ript></body></html>';
  var pw=openBlobPrint(slHtml);
  if(!pw){toast('Allow pop-ups to print the shelf list.','err');return false;}
  return true;
}


/* Delegated actions for the shelves table. Registered at module load from the
   scope that declares openEditShelf; removeShelf is owned by another module and
   published on globalThis. / أزرار جدول الأرفف تُسجَّل مرة واحدة عند التحميل. */
installActions(document.body,{
  shelfEdit:function(el){openEditShelf(el)},
  shelfRemove:function(el){if(typeof window.removeShelf==='function')window.removeShelf(el.dataset.sid)}
},{event:'click',attribute:'clickact'});

publishLegacy("07f-shelves.js", {
  renderShelves,
  getShelfName,
  openAddShelf,
  printShelfList});

export {};

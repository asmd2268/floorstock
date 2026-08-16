import { publishLegacy } from '../core/legacy-registry.js';

// ── SHELVES ──────────────────────────────────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, el, gd, getMeds, deptName, officialPrintHeaderHTML,
// openBlobPrint) is already published to globalThis by its owning module.
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
  ms.forEach(function(m){if(m.shelfId){shelfCounts[m.shelfId]=(shelfCounts[m.shelfId]||0)+1;}});
  // Render shelves table
  el('shelves-tbl').innerHTML=shelves.length
    ?shelves.map(function(s){
      return '<tr><td><span class="shelf-badge">'+s.name+'</span></td>'
        +'<td style="color:var(--tx2);font-size:12px">'+(s.desc||'—')+'</td>'
        +'<td style="font-family:var(--mono)">'+(shelfCounts[s.id]||0)+' meds</td>'
        +'<td style="white-space:nowrap">'
          +'<button class="btn bg bxs" data-sid="'+s.id+'" data-name="'+s.name+'" data-desc="'+(s.desc||'')+'" onclick="openEditShelf(this)">✏</button> '
          +'<button class="btn bd2c bxs" data-sid="'+s.id+'" onclick="removeShelf(this.getAttribute(&#x27;data-sid&#x27;))">✕</button>'
        +'</td></tr>';
    }).join('')
    :'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx2)">No shelves yet — click + Add Shelf</td></tr>';
  // Populate print shelf selector
  var pSel=el('print-shelf-sel');
  if(pSel){pSel.innerHTML='<option value="all">All Shelves / &#x643;&#x644; &#x627;&#x644;&#x623;&#x631;&#x641;&#x641;</option>'
    +shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');}
  var assigned=ms.filter(function(m){return !!m.shelfId}).length;
  if(el('shelves-summary'))el('shelves-summary').innerHTML='<div class="sc" style="padding:12px"><div class="sl">Medications</div><div class="sv" style="font-size:22px">'+ms.length+'</div></div>'+'<div class="sc" style="padding:12px"><div class="sl">Assigned</div><div class="sv" style="font-size:22px">'+assigned+'</div></div>'+'<div class="sc" style="padding:12px"><div class="sl">Unassigned</div><div class="sv" style="font-size:22px">'+(ms.length-assigned)+'</div></div>';
  if(typeof renderShelfMedicationDatabase==='function')renderShelfMedicationDatabase();
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
function printShelfList(){
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},printRole=window.fsEffectiveRole?window.fsEffectiveRole():String(profile.role||''),deptId=String(profile.deptId||profile.departmentId||'');
  if(printRole!=='department'||!deptId)return toast('Shelf printing is available to department accounts for their own department. / طباعة الأرفف متاحة لحساب القسم لقسمه فقط.','err');
  var shelfId=el('print-shelf-sel').value;
  var clsFilter=el('print-shelf-cls').value;
  var ms=getMeds(deptId);
  var shelves=getShelves(deptId);
  var today=fmtDate(nowISO());
  var deptName=profile.deptName||deptId;
  // Apply filters
  var filtered=ms.filter(function(m){
    var shMatch=shelfId==='all'||m.shelfId===shelfId;
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
  filtered.forEach(function(m){
    var sid=m.shelfId||'__none__';
    if(!byShelf[sid])byShelf[sid]=[];
    byShelf[sid].push(m);
  });
  var qrUrl=window.makeReadableQR(getPublicExpiryUrl(deptId));
  var qrSiteUrl=window.makeReadableQR(getAppUrl());
  
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
        var bc=m.high_alert?'#da3633':m.hazard?'#d29922':m.lasa?'#8957e5':'transparent';
        var bg=m.high_alert?'#fff0f0':m.hazard?'#fffbea':m.lasa?'#f5f0ff':'#fff';
        var flag='';
        if(m.high_alert&&m.hazard)flag='<span style="color:#da3633;font-weight:700;font-size:6.5pt">HIGH ALERT + HAZARD</span>';
        else if(m.high_alert)flag='<span style="color:#da3633;font-weight:700;font-size:6.5pt">HIGH ALERT</span>';
        else if(m.hazard)flag='<span style="color:#b07d00;font-weight:700;font-size:6.5pt">HAZARD</span>';
        else if(m.lasa)flag='<span style="color:#6639ba;font-weight:700;font-size:6.5pt">LASA</span>';
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
    +'body{font-family:Arial,sans-serif;font-size:8.5pt;color:#000;margin:0}'
    +'table{width:100%;border-collapse:collapse}'
    +'th{background:#1f2328;color:#fff;padding:5px 6px;text-align:left;font-size:7.5pt}'
    +'th.c{text-align:center}'
    +'tr{page-break-inside:avoid}'
    +'thead{display:table-header-group}'
    +'#footer{position:fixed;bottom:0;left:0;right:0;font-size:6.5pt;color:#555;display:flex;justify-content:space-between;align-items:center;padding:4px 10px;border-top:1px solid #ccc;background:#fff}'
    +'</style></head><body>'
    +officialPrintHeaderHTML()
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #000">'
    +'<div>'
    +'<div style="font-size:13pt;font-weight:700">'+deptName+' — Floor Stock / &#x645;&#x62E;&#x632;&#x648;&#x646; &#x627;&#x644;&#x623;&#x631;&#x636;&#x64A;&#x629;</div>'
    +'<div style="font-size:8pt;color:#333;margin-top:3px">Date: <b>'+today+'</b> &nbsp;|&nbsp; Shelf: <b>'+shelfLabel+'</b> &nbsp;|&nbsp; Filter: <b>'+filterLabel+'</b> &nbsp;|&nbsp; Items: <b>'+filtered.length+'</b></div>'
    +'<div style="font-size:7pt;color:#666;margin-top:2px">By: '+(profile.username||profile.email||'Department')+' &nbsp;|&nbsp; Developed by Ali Abudahash | ASDHealth</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<div style="text-align:center"><img src="'+qrSiteUrl+'" width="90" height="90"><div style="font-size:5.5pt;color:#888">System</div></div>'
    +'<div style="text-align:center"><img src="'+qrUrl+'" width="90" height="90"><div style="font-size:5.5pt;color:#888">Expiry Monitor</div></div>'
    +'</div>'
    +'</div>'
    +'<table><thead><tr>'
    +'<th>Medication / &#x627;&#x644;&#x62F;&#x648;&#x627;&#x621;</th>'
    +'<th>Classification / &#x627;&#x644;&#x62A;&#x635;&#x646;&#x64A;&#x641;</th>'
    +'<th class="c">Min / &#x627;&#x644;&#x623;&#x62F;&#x646;&#x649;</th>'
    +'<th class="c">Max / &#x627;&#x644;&#x623;&#x639;&#x644;&#x649;</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div id="footer">'
    +'<span>'+deptName+' — Floor Stock — '+today+' — By Ali Abudahash</span>'
    +'<img src="'+qrUrl+'" width="76" height="76">'
    +'</div>'
    +'<script>(function(){var d=false;function g(){if(d)return;d=true;window.focus();window.print()}if(document.readyState==="complete")setTimeout(g,300);else window.addEventListener("load",function(){setTimeout(g,300)},{once:true})})()</sc'+'ript></body></html>';
  var pw=openBlobPrint(slHtml);
  if(!pw){toast('Allow pop-ups to print the shelf list.','err');return false;}
  return true;
}


publishLegacy("07f-shelves.js", {
  renderShelves,
  getShelfName,
  openAddShelf,
  openEditShelf,
  printShelfList,
});

export {};

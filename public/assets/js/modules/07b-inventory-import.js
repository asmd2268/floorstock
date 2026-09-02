import { publishLegacy } from '../core/legacy-registry.js';

// ── INVENTORY IMPORT (Excel / CSV / paste) ──────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, toast, el, gd, getMeds, setMeds, autoDetectCat, uid, now,
// deptName, ensureXLSX's canonicalEnsureXLSX from module 40) is already
// published to globalThis by its owning module.
function renderImport(){
  var dsel=el('imp-dept');
  if(dsel){dsel.innerHTML='<option value="">Select target department...</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');dsel.value=''}
  if(typeof window.restoreImportDraft==='function'&&window.restoreImportDraft())return;
  IROWS=[];
  el('imp-ptitle').textContent='Preview';
  var ia=el('imp-actions');if(ia)ia.style.cssText='display:none';
  el('imp-prev').innerHTML='<div style="text-align:center;padding:40px 0;opacity:.5;color:var(--tx2)"><div style="font-size:36px;margin-bottom:8px">📄</div>Upload or paste, then click Parse</div>';
  if(typeof window.injectUsersTabBar==='function')window.injectUsersTabBar('pg-import');
}
function clearImport(){
  if(typeof window.clearImportDraftState==='function')window.clearImportDraftState();
  var ta=el('imp-txt');if(ta)ta.value='';
  var dz=el('xlsx-drop-zone');
  if(dz){dz.style.borderColor='var(--bd)';dz.querySelector('div:nth-child(2)').textContent='Upload Excel / CSV file';}
  renderImport();
}

// Excel loader is shared by the import and controlled-import workflows.
async function ensureXLSX(){return typeof canonicalEnsureXLSX==='function'?canonicalEnsureXLSX():undefined}

// ── XLSX UPLOAD HANDLER ──────────────────────────────────
function handleXlsxDrop(e){
  e.preventDefault();
  var f=e.dataTransfer.files[0];
  if(f)handleXlsxFile(f);
}
async function handleXlsxFile(file){
  if(!file)return;
  try{await ensureXLSX()}catch(e){toast('تعذر تحميل قارئ Excel. تأكد من الاتصال بالإنترنت أو استخدم وضع اللصق.\nThe Excel reader could not be loaded. Check your internet connection or use Paste mode.','err');return;}
  var ext=file.name.split('.').pop().toLowerCase();
  var dz=el('xlsx-drop-zone');
  if(dz){var h2=dz.querySelector('.upload-status');if(!h2){h2=document.createElement('div');h2.className='upload-status';h2.style.cssText='font-size:12px;color:var(--acl);margin-top:8px';dz.appendChild(h2);}h2.textContent='⏳ Reading: '+file.name;}
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      if(ext==='csv'){parseCsvData(ev.target.result);}
      else{parseXlsxData(ev.target.result,file.name);}
    }catch(err){toast('Error: '+err.message,'err');console.error(err);}
  };
  if(ext==='csv') reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}
function parseCsvData(text){
  // Convert CSV to paste-style then use text parser
  el('imp-txt').value=text;
  parseImport();
}
function parseXlsxData(buffer,fname){
  var wb=XLSX.read(buffer,{type:'array',cellStyles:true});
  var wsName=wb.SheetNames[0];
  var ws=wb.Sheets[wsName];
  var ref=ws['!ref'];
  if(!ref){toast('Empty sheet','err');return;}
  var range=XLSX.utils.decode_range(ref);

  // ── Color detection helpers ──
  function getCellBg(addr){
    var c=ws[addr];if(!c||!c.s)return null;
    try{
      var fg=c.s.fgColor;
      if(fg){
        var rgb=(fg.rgb||fg.argb||'').toUpperCase();
        if(rgb&&rgb!=='00000000'&&rgb!=='FFFFFFFF'&&rgb!=='FFFFFF'&&rgb.length>=6)return rgb;
      }
      var bg=c.s.bgColor;
      if(bg){
        var rgb2=(bg.rgb||bg.argb||'').toUpperCase();
        if(rgb2&&rgb2!=='00000000'&&rgb2!=='FFFFFFFF'&&rgb2!=='FFFFFF'&&rgb2.length>=6)return rgb2;
      }
    }catch(e){}
    return null;
  }
  // Red = High Alert (FF0000, FFFF0000)
  function isHA(bg){
    if(!bg)return false;
    var s=bg.replace(/^FF/,'');
    return s==='FF0000'||s==='FF0000FF'||bg==='FFFF0000'||bg==='FF0000';
  }
  // Yellow = Hazard (FFFF00, FFFFFF00)
  function isHZ(bg){
    if(!bg)return false;
    var s=bg.replace(/^FF/,'');
    return s==='FFFF00'||bg==='FFFFFF00'||bg==='FFFF00';
  }
  // Gray = Category header (BFBFBF, C0C0C0, etc.)
  function isCatHdr(bg){
    if(!bg)return false;
    var s=bg.replace(/^FF/,'');
    return s==='BFBFBF'||s==='C0C0C0'||s==='BDBDBD'||s==='BBBBBB'||s==='CCCCCC'||s==='D9D9D9';
  }

  function getCellText(addr){
    var c=ws[addr];if(!c||c.t==='e')return null;
    var v=c.v;if(v===undefined||v===null)return null;
    var s=String(v).trim();
    if(!s||/^#(REF|VALUE|NAME|DIV\/0|N\/A|NUM|NULL)/i.test(s))return null;
    return s.replace(/\n/g,' ').replace(/\r/g,' ').replace(/\s+/g,' ').trim()||null;
  }
  function getCellNum(addr){
    var c=ws[addr];if(!c||c.t==='e')return null;
    var v=c.v;if(v===undefined||v===null||v==='')return null;
    var s=String(v).trim();
    if(!s||/^#|^=/i.test(s))return null;
    var n=Number(s.replace(/,/g,''));
    return Number.isFinite(n)?n:null;
  }

  var drugs=[];
  var currentCat='Injections';
  var incomplete=[];  // track rows with missing min/max

  for(var R=range.s.r;R<=range.e.r;R++){
    var aAddr=XLSX.utils.encode_cell({r:R,c:0});
    var bAddr=XLSX.utils.encode_cell({r:R,c:1});
    var cAddr=XLSX.utils.encode_cell({r:R,c:2});

    var aText=getCellText(aAddr);
    var bNum=getCellNum(bAddr);
    var cNum=getCellNum(cAddr);
    var aBg=getCellBg(aAddr);

    // Skip completely empty rows
    if(!aText&&bNum===null&&cNum===null)continue;
    // Skip formula-only rows
    if(!aText&&bNum===null)continue;

    // ── Category header row? ──
    // Category rows in real hospital files may contain 0/0 formulas or #REF! in Min/Max.
    // A recognized category name is therefore always treated as a heading, never a medicine.
    var catFromName=aText?recognizeCat(aText):null;
    if(catFromName&&aText){
      currentCat=catFromName;
      continue;
    }
    if(isCatHdr(aBg)&&aText&&(bNum===null||bNum===0)&&(cNum===null||cNum===0))continue;

    // ── Must have a name to be a drug row ──
    if(!aText||aText.length<2)continue;

    // ── Skip if name looks like a header label ──
    if(/^(medication|drug|name|item|description)$/i.test(aText))continue;

    var ha=isHA(aBg);
    var hz=isHZ(aBg);
    var cat=currentCat||autoDetectCat(aText);

    // ── Missing min or max — add but flag ──
    var hasMin=bNum!==null;
    var hasMax=cNum!==null;
    var mn=hasMin?Math.round(bNum):null;
    var mx=hasMax?Math.round(cNum):null;

    var drug={
      _i:drugs.length,
      name:aText,
      category:cat,
      min:mn!==null?mn:0,
      max:mx!==null?mx:0,
      high_alert:ha,
      hazard:hz,
      lasa:false,
      _del:false,
      _incomplete:(!hasMin||!hasMax),
      _missingMin:!hasMin,
      _missingMax:!hasMax
    };
    drugs.push(drug);
    if(!hasMin||!hasMax){
      incomplete.push({row:R+1,name:aText,missingMin:!hasMin,missingMax:!hasMax});
    }
  }

  IROWS=drugs;
  if(!drugs.length)return toast('No valid medications found in file','err');

  // ── Show warning for incomplete rows ──
  var warnMsg='';
  if(incomplete.length>0){
    warnMsg='<div class="alert-banner-y" style="margin-bottom:12px">⚠ <b>'+incomplete.length+' medications</b> are missing Min or Max values (shown in orange). Please fill them in before importing:<br><span style="font-size:11px">'+
      incomplete.slice(0,5).map(function(x){
        return x.name.slice(0,40)+(x.missingMin?' [missing Min]':'')+(x.missingMax?' [missing Max]':'');
      }).join('<br>')+
      (incomplete.length>5?'<br>...and '+(incomplete.length-5)+' more':'')
    +'</span></div>';
  }

  toast('Parsed '+drugs.length+' medications from '+fname+(incomplete.length?' — ⚠ '+incomplete.length+' incomplete':''),'succ');
  renderImportPreview(true,0,0,warnMsg);
}

function recognizeCat(name){
  var n=String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
  // Match section headings only. Do not treat medicine names containing words
  // such as "eye drop", "ointment", "injection" or "solution" as headings.
  if(/^(injection|injections)$/.test(n))return 'Injections';
  if(/^(inhaler|inhalers)$/.test(n))return 'Inhalers';
  if(/^(tablet|tablets)$/.test(n))return 'Tablets';
  if(/^(syrup|syrups)$/.test(n))return 'Syrups';
  if(/^topicals?$/.test(n))return 'Topical';
  if(/^(solution|solutions)$/.test(n))return 'Solutions';
  if(/^(suppository|suppositories)$/.test(n))return 'Suppositories';
  if(/^(ointment|ointments|drop|drops|ointments?\s*&\s*drops?(?:\s*&\s*suppositor(?:y|ies))?)$/.test(n))return 'Ointments & Drops';
  return null;
}


// ── PASTE PARSER (smart) ─────────────────────────────────
function parseImport(){
  var raw=el('imp-txt').value;
  if(!raw.trim())return toast('Paste some data first','err');
  var lines=raw.split(/\n/);
  var headerIdx=-1,colMap={name:-1,min:-1,max:-1,ha:-1,hz:-1,ls:-1};
  var hdrKw={name:/^(name|medication|drug|item)/i,min:/^(min|minimum)/i,max:/^(max|maximum)/i,ha:/^(high.?alert|ha)$/i,hz:/^(hazard|hz)$/i,ls:/^(lasa|ls)$/i};
  for(var li=0;li<Math.min(lines.length,8);li++){
    var parts=lines[li].split(/\t/).map(function(p){return p.trim()});
    var mc=0,tm={name:-1,min:-1,max:-1,ha:-1,hz:-1,ls:-1};
    parts.forEach(function(p,pi){Object.keys(hdrKw).forEach(function(k){if(hdrKw[k].test(p)){tm[k]=pi;mc++;}});});
    if(mc>=2){headerIdx=li;colMap=tm;break;}
  }
  var hasHdr=headerIdx>-1,dataStart=hasHdr?headerIdx+1:0;
  var rows=[],skipped=0,lastName='';
  for(var i=dataStart;i<lines.length;i++){
    var line=lines[i];if(!line.trim()){skipped++;continue;}
    var parts=line.split(/\t/).map(function(p){return p.trim()});
    if(parts.every(function(p){return p===''})){skipped++;continue;}
    var numIdx=-1;
    for(var j=0;j<parts.length;j++){if(parts[j]!==''&&!isNaN(parts[j])){numIdx=j;break;}}
    var name='';
    if(hasHdr&&colMap.name>-1){name=(parts[colMap.name]||'').trim();}
    else{name=numIdx>0?parts.slice(0,numIdx).join(' ').trim():parts[0].trim();}
    // Skip header-like rows
    if(!name||name.length<2){skipped++;continue;}
    if(recognizeCat(name)){skipped++;continue;} // category header
    lastName=name;
    function getN(colKey,fallback){
      if(hasHdr&&colMap[colKey]>-1){var v=parts[colMap[colKey]];return(v&&!isNaN(v))?+v:0;}
      return numIdx>-1?(+(parts[numIdx+fallback]||0)||0):0;
    }
    function getF(colKey,fallback){
      if(hasHdr&&colMap[colKey]>-1){var v=(parts[colMap[colKey]]||'').toLowerCase();return v==='yes'||v==='1';}
      return numIdx>-1&&((parts[numIdx+fallback]||'').toLowerCase()==='yes');
    }
    var mn=getN('min',0)||1,mx=getN('max',1)||10;
    var ha=getF('ha',2),hz=getF('hz',3),ls=getF('ls',4);
    var selCat=el('imp-cat').value;
    var cat=selCat==='auto'?autoDetectCat(name):selCat;
    rows.push({_i:rows.length,name:name,min:mn,max:mx,high_alert:ha,hazard:hz,lasa:ls,category:cat,_del:false});
  }
  IROWS=rows;
  if(!rows.length)return toast('No valid rows found','err');
  renderImportPreview(hasHdr,headerIdx,skipped,'');
}

// ── SHARED PREVIEW RENDERER ──────────────────────────────
function renderImportPreview(hasHeader,headerIdx,skipped,warnMsg){
  var deptId=el('imp-dept').value;
  var deptName=(gd().find(function(d){return d.id===deptId})||{}).name||deptId;
  var existNames=getMeds(deptId).map(function(m){return m.name.toLowerCase()});
  // Re-index
  IROWS.forEach(function(r,i){r._i=i;});
  var active=IROWS.filter(function(r){return !r._del});
  var ia=el('imp-actions');
  if(ia){ia.style.cssText='display:flex;align-items:center;gap:8px';}
  el('imp-cbtn').style.display='';
  el('imp-ptitle').textContent='Preview: '+active.length+' meds for '+deptName;
  el('imp-count-txt').textContent=active.length+' items'+(skipped?' | '+skipped+' skipped':'')+(hasHeader?' | header detected':'');
  var CATS=['Injections','Inhalers','Suppositories','Tablets','Syrups','Topical','Ointments & Drops','Solutions'];
  var tableRows=IROWS.map(function(r){
    var dup=existNames.indexOf(r.name.toLowerCase())>-1;
    var catOpts=CATS.map(function(c){return '<option value="'+esc(c)+'"'+(r.category===c?' selected':'')+'>'+esc(c)+'</option>'}).join('');
    var rowBg=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':
              r._incomplete?'background:rgba(210,153,34,.12)':
              r.high_alert?'background:rgba(218,54,51,.07)':
              r.hazard?'background:rgba(210,153,34,.06)':'';
    return '<tr id="irow-'+r._i+'" style="'+rowBg+'">'
      +'<td style="padding:4px 8px"><input type="checkbox" class="imp-del-chk" data-idx="'+r._i+'"'+(r._del?'':' checked')+' onchange="impToggleRow(this)"></td>'
      +'<td style="padding:3px 4px;min-width:200px"><input class="imp-edit-input" data-idx="'+r._i+'" data-f="name" value="'+esc(r.name)+'" oninput="impEdit(this)" style="min-width:180px"></td>'
      +'<td style="padding:3px 4px"><select class="imp-edit-input" data-idx="'+r._i+'" data-f="category" onchange="impEdit(this)" style="font-size:11px;padding:3px 4px;min-width:90px">'+catOpts+'</select></td>'
      +'<td style="padding:3px 4px"><input class="imp-edit-input" type="number" data-idx="'+r._i+'" data-f="min" value="'+r.min+'" oninput="impEdit(this)" style="width:50px;text-align:center"></td>'
      +'<td style="padding:3px 4px"><input class="imp-edit-input" type="number" data-idx="'+r._i+'" data-f="max" value="'+r.max+'" oninput="impEdit(this)" style="width:50px;text-align:center"></td>'
      +'<td style="padding:3px 4px;white-space:nowrap">'
        +'<label title="High Alert" style="cursor:pointer"><input type="checkbox" data-idx="'+r._i+'" data-f="high_alert"'+(r.high_alert?' checked':'')+' onchange="impEdit(this)" style="width:auto;margin:0"> 🔴</label> '
        +'<label title="Hazard" style="cursor:pointer"><input type="checkbox" data-idx="'+r._i+'" data-f="hazard"'+(r.hazard?' checked':'')+' onchange="impEdit(this)" style="width:auto;margin:0"> 🟡</label> '
        +'<label title="LASA" style="cursor:pointer"><input type="checkbox" data-idx="'+r._i+'" data-f="lasa"'+(r.lasa?' checked':'')+' onchange="impEdit(this)" style="width:auto;margin:0"> 🟣</label>'
      +'</td>'
      +'<td style="padding:3px 6px">'+(dup&&!r._del?'<span class="badge byl">Update</span>':r._del?'<span class="badge bgr">Skip</span>':'<span class="badge bgn">New</span>')+'</td>'
      +'</tr>';
  }).join('');
  el('imp-prev').innerHTML=(warnMsg||'')+'<div class="tw" style="max-height:520px;overflow-y:auto">'
    +'<table style="font-size:12px"><thead><tr>'
    +'<th title="Uncheck to skip">✔</th><th>Medication Name</th><th>Category</th><th>Min</th><th>Max</th><th>Flags</th><th>Status</th>'
    +'</tr></thead><tbody>'+tableRows+'</tbody></table></div>';
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
function impEdit(inp){
  var idx=+inp.dataset.idx;var f=inp.dataset.f;
  if(f==='high_alert'||f==='hazard'||f==='lasa'){IROWS[idx][f]=inp.checked;}
  else if(f==='min'||f==='max'){IROWS[idx][f]=+inp.value||0;}
  else{IROWS[idx][f]=inp.value;}
  // update row bg
  var tr=document.getElementById('irow-'+idx);
  if(tr){
    var r=IROWS[idx];
    tr.style.cssText=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':
      r.high_alert?'background:rgba(218,54,51,.07)':
      r.hazard?'background:rgba(210,153,34,.06)':'';
  }
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
function impToggleRow(chk){
  var idx=+chk.dataset.idx;
  IROWS[idx]._del=!chk.checked;
  var tr=document.getElementById('irow-'+idx);
  if(tr){var r=IROWS[idx];tr.style.cssText=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':r.high_alert?'background:rgba(218,54,51,.07)':r.hazard?'background:rgba(210,153,34,.06)':'';}
  var active=IROWS.filter(function(r){return !r._del}).length;
  el('imp-count-txt').textContent=active+' items selected';
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
function impSelectAll(include){
  IROWS.forEach(function(r,i){
    r._del=!include;
    var chk=document.querySelector('.imp-del-chk[data-idx="'+i+'"]');
    if(chk)chk.checked=include;
    var tr=document.getElementById('irow-'+i);
    if(tr){tr.style.cssText=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':r.high_alert?'background:rgba(218,54,51,.07)':r.hazard?'background:rgba(210,153,34,.06)':'';}
  });
  el('imp-count-txt').textContent=(include?IROWS.length:0)+' items selected';
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
async function confirmImport(){
  var toImport=IROWS.filter(function(r){return !r._del});
  if(!toImport.length)return toast('No items selected','err');
  // Check for still-incomplete rows (0 min AND 0 max means truly empty)
  var stillIncomplete=toImport.filter(function(r){return r._incomplete&&r.min===0&&r.max===0});
  if(stillIncomplete.length>0){
    return toast('⚠ '+stillIncomplete.length+' medications still have 0 Min AND 0 Max. Please fill them in the preview or uncheck to skip.','err');
  }
  var deptId=el('imp-dept').value;
  if(!deptId)return toast('Select a department','err');
  var existing=getMeds(deptId);
  var added=0,updated=0;
  for(var ri=0;ri<toImport.length;ri++){
    var r=toImport[ri];
    var idx=-1;existing.forEach(function(m,i){if(m.name.toLowerCase()===r.name.toLowerCase())idx=i;});
    if(idx>-1){await updMed(deptId,existing[idx].id,{min:r.min,max:r.max,high_alert:r.high_alert,hazard:r.hazard,lasa:r.lasa,category:r.category});updated++;}
    else{await pushMed(deptId,{name:r.name,category:r.category,min:r.min,max:r.max,monthly:null,high_alert:r.high_alert,hazard:r.hazard,lasa:r.lasa,created:nowISO()});added++;}
  }
  toast('Done: '+added+' added, '+updated+' updated ✓','succ');
  IROWS=[];el('imp-txt').value='';
  el('imp-prev').innerHTML='<div style="text-align:center;padding:30px;color:var(--gnl)"><div style="font-size:36px">✓</div><div style="margin-top:8px;font-weight:600">'+added+' added &middot; '+updated+' updated</div></div>';
  el('imp-ptitle').textContent='Import complete';
  var ia=el('imp-actions');if(ia)ia.style.cssText='display:none';
}


publishLegacy("07b-inventory-import.js", {
  renderImport,
  clearImport,
  ensureXLSX,
  handleXlsxDrop,
  handleXlsxFile,
  parseCsvData,
  parseXlsxData,
  recognizeCat,
  parseImport,
  renderImportPreview,
  impEdit,
  impToggleRow,
  impSelectAll,
  confirmImport,
});

export {};

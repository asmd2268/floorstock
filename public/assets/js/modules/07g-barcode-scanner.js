import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

// ── BARCODE SCANNER (GS1/HIBC parsing, camera scan, manual entry) ──────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, el, toast, getMeds, ensureZXing/ZXing global from
// media-loaders.js — already globalThis-published by module 03's own
// import of that file) is already published to globalThis by its owning
// module. CM (close-modal) lives here rather than in a generic helpers
// file because closing the expiry modal must also stop the camera.
globalThis._scanReader = null;
globalThis._scanStream = null;
globalThis._parsedScan = {};   // holds parsed result from camera
globalThis._parsedType = {};   // holds parsed result from type tab

// ── Tab switcher ──────────────────────────────────────────
function switchExpTab(tab){
  ['manual','scan','type'].forEach(function(t){
    var d=el('tab-'+t); if(d) d.style.display = t===tab?'block':'none';
    var b=el('tab-'+t+'-btn'); if(b){ b.className=t===tab?'btn bp bsm':'btn bg bsm'; b.style.flex='1'; }
  });
  if(tab==='scan') startScanner();
  else stopScanner();
}

// ── GS1 / HIBC / General Barcode Parser ──────────────────
function parseBarcode(raw){
  var result={ lot:'', expiry:'', gtin:'', raw:raw, drug:'' };
  if(!raw) return result;
  var s = raw.trim();

  // ── GS1-128 / GS1 DataMatrix: AIs ──────────────────────
  // AI 01 = GTIN, AI 17 = Expiry YYMMDD, AI 10 = Lot/Batch
  // Format: (01)GTIN(17)YYMMDD(10)LOT  — parens or FNC1 char
  var gs1 = s.replace(/\((\d{2})\)/g, '\x1D$1');  // convert (AI) to GS1 FNC1 style
  var aiMatches = gs1.match(/\x1D(\d{2})([^\x1D]*)/g) || [];
  if(!aiMatches.length){
    // Try without FNC1 — bare AIs like "011234567890(17)251231..."
    gs1 = s.replace(/\((\d{2,3})\)/g, '\x1D$1');
    aiMatches = gs1.match(/\x1D(\d{2,3})([^\x1D]*)/g) || [];
  }
  aiMatches.forEach(function(seg){
    var ai = seg.slice(1,3); var val = seg.slice(3);
    if(ai==='01'||ai==='02'){ result.gtin=val.replace(/\D/g,''); }
    if(ai==='17'){ result.expiry = parseExpiryStr(val.trim()); }
    if(ai==='10'){ result.lot=val.trim(); }
    if(ai==='11'||ai==='13'||ai==='15'){ result.expiry = result.expiry||parseExpiryStr(val.trim()); }
  });

  // ── HIBC format: +LABELER$PRODUCT/YYMMDD$BATCH ──────────
  if(!result.expiry && /^\+/.test(s)){
    var hibcDate = s.match(/\/(\d{6,8})/);
    if(hibcDate) result.expiry = parseExpiryStr(hibcDate[1]);
    var hibcLot = s.match(/\$([A-Z0-9]+)$/i);
    if(hibcLot) result.lot = hibcLot[1];
  }

  // ── Free-text / QR style: "EXP:2025-12 LOT:A123 DrugName" ──
  if(!result.expiry){
    var expPat = s.match(/(?:exp(?:iry)?|expdate|use before|bb)[:\s\/]?(\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{6,8})/i);
    if(expPat) result.expiry = parseExpiryStr(expPat[1]);
  }
  if(!result.lot){
    var lotPat = s.match(/(?:lot|batch|lot no|lot#)[:\s#]?([A-Z0-9\-]+)/i);
    if(lotPat) result.lot = lotPat[1];
  }

  // ── Numeric-only: try as YYMMDD or MMYYYY ──
  if(!result.expiry){
    var numOnly = s.replace(/\D/g,'');
    if(numOnly.length===6) result.expiry = parseExpiryStr(numOnly);
  }

  // ── Try to extract drug name from QR free text ──
  if(!result.drug){
    // Remove known fields, rest might be drug name
    var cleaned = s
      .replace(/\(?\d{2,3}\)?[\dA-Z]{6,14}/g,'')
      .replace(/(?:exp|lot|batch)[:\s#][^\s,;]+/gi,'')
      .replace(/\d{6,8}/g,'')
      .replace(/[^\w\s\-\.\/\%]/g,' ')
      .replace(/\s+/g,' ').trim();
    if(cleaned.length > 3) result.drug = cleaned;
  }

  return result;
}

function parseExpiryStr(s){
  // Normalize various date formats to YYYY-MM-DD
  if(!s) return '';
  s = s.toString().replace(/\s/g,'');

  // YYMMDD → 20YY-MM-DD
  if(/^\d{6}$/.test(s)){
    var yy=s.slice(0,2), mm=s.slice(2,4), dd=s.slice(4,6);
    var yyyy = +yy < 50 ? '20'+yy : '19'+yy;
    var day = dd==='00' ? '01' : dd;  // GS1 day 00 means last day of month
    return yyyy+'-'+mm+'-'+day;
  }
  // YYYYMMDD
  if(/^\d{8}$/.test(s)){
    return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
  }
  // MM/YYYY or MM-YYYY
  if(/^\d{1,2}[-\/]\d{4}$/.test(s)){
    var parts=s.split(/[-\/]/);
    return parts[1]+'-'+parts[0].padStart(2,'0')+'-01';
  }
  // YYYY-MM-DD or YYYY/MM/DD
  if(/^\d{4}[-\/]\d{1,2}([-\/]\d{1,2})?$/.test(s)){
    return s.replace(/\//g,'-');
  }
  // MM/YY
  if(/^\d{2}\/\d{2}$/.test(s)){
    var p=s.split('/');
    return '20'+p[1]+'-'+p[0]+'-01';
  }
  return '';
}

function formatParsedFields(parsed, prefix){
  prefix = prefix||'scan';
  var html='';
  if(parsed.gtin)  html+='<div class="scan-field"><label>GTIN / Product Code</label><div class="val">'+parsed.gtin+'</div></div>';
  if(parsed.lot)   html+='<div class="scan-field"><label>Lot / Batch</label><div class="val">'+parsed.lot+'</div></div>';
  if(parsed.expiry)html+='<div class="scan-field" style="border-left:3px solid var(--gn)"><label>Expiry Date / &#x62A;&#x627;&#x631;&#x64A;&#x62E; &#x627;&#x644;&#x627;&#x646;&#x62A;&#x647;&#x627;&#x621;</label><div class="val" style="color:var(--gnl)">'+fmtDate(parsed.expiry)+' ('+parsed.expiry+')</div></div>';
  if(parsed.drug)  html+='<div class="scan-field"><label>Detected Name / &#x627;&#x644;&#x627;&#x633;&#x645; &#x627;&#x644;&#x645;&#x643;&#x62A;&#x634;&#x641;</label><div class="val">'+parsed.drug+'</div></div>';
  if(!parsed.expiry&&!parsed.lot&&!parsed.gtin) html='<div class="scan-field" style="border-left:3px solid var(--rd)"><label>No structured data detected</label><div class="val" style="color:var(--tx2)">Try typing the barcode or enter details manually</div></div>';
  return html;
}

function getMedSelectOptions(defaultId){
  if(!CU) return '';
  return getMeds(CU.deptId).map(function(m){
    return '<option value="'+esc(m.id)+'"'+(m.id===defaultId?' selected':'')+'>'+esc(m.name)+'</option>';
  }).join('');
}

// ── Fuzzy match drug name from barcode to existing meds ──
function fuzzyMatchMed(drug){
  if(!drug||!CU) return null;
  var ms=getMeds(CU.deptId);
  var dl=drug.toLowerCase();
  // Exact
  var exact=ms.find(function(m){return m.name.toLowerCase()===dl});
  if(exact) return exact.id;
  // Contains
  var contain=ms.find(function(m){return m.name.toLowerCase().includes(dl)||dl.includes(m.name.toLowerCase().slice(0,8))});
  if(contain) return contain.id;
  return null;
}

// ── Camera Scanner ────────────────────────────────────────
async function startScanner(){
  stopScanner();
  var video=el('scan-modal-video');
  if(!video) return;
  el('scan-status').textContent='⏳ Requesting camera access...';
  el('scan-result-area').style.display='none';
  el('scan-line').style.display='block';
  // Enumerate cameras first
  navigator.mediaDevices.enumerateDevices().then(function(devices){
    var cams=devices.filter(function(d){return d.kind==='videoinput'});
    var sel=el('scan-cam-sel');
    if(sel){
      sel.innerHTML=cams.map(function(c,i){return '<option value="'+esc(c.deviceId)+'">'+esc(c.label||'Camera '+(i+1))+'</option>'}).join('');
    }
    var constraints={video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}};
    if(cams.length>0 && sel && sel.value){
      constraints.video={deviceId:{exact:sel.value},width:{ideal:1280},height:{ideal:720}};
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  }).then(async function(stream){
    _scanStream=stream;
    video.srcObject=stream;
    video.play();
    el('scan-status').textContent='🟢 Scanning — hold barcode steady...';
    // Load ZXing only when the scanner is opened
    try{await ensureZXing()}catch(e){}
    if(typeof ZXing!=='undefined'){
      var hints=new Map();
      var fmts=[
        ZXing.BarcodeFormat.QR_CODE,ZXing.BarcodeFormat.DATA_MATRIX,
        ZXing.BarcodeFormat.CODE_128,ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,ZXing.BarcodeFormat.PDF_417,
        ZXing.BarcodeFormat.AZTEC
      ].filter(Boolean);
      if(fmts.length) hints.set(ZXing.DecodeHintType&&ZXing.DecodeHintType.POSSIBLE_FORMATS, fmts);
      _scanReader=new ZXing.BrowserMultiFormatReader(hints);
      _scanReader.decodeFromStream(stream,video,function(result,err){
        if(result){
          onScanSuccess(result.getText());
        }
      });
    } else {
      // Fallback: ZXing not loaded, do manual capture
      el('scan-status').innerHTML='⚠ ZXing library loading... <button class="btn bg bxs" onclick="captureFrame()">📸 Capture Frame</button>';
    }
  }).catch(function(err){
    el('scan-status').textContent='❌ Camera error: '+err.message+' — use "Type Barcode" tab instead';
    el('scan-line').style.display='none';
  });
}

function switchCamera(deviceId){
  stopScanner();
  var video=el('scan-modal-video');
  if(!video) return;
  navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:deviceId}}}).then(function(stream){
    _scanStream=stream;video.srcObject=stream;video.play();
    if(_scanReader) _scanReader.decodeFromStream(stream,video,function(r,e){if(r)onScanSuccess(r.getText())});
  }).catch(function(e){el('scan-status').textContent='Camera error: '+e.message});
}

function stopScanner(){
  if(_scanReader){try{_scanReader.reset();}catch(e){} _scanReader=null;}
  if(_scanStream){_scanStream.getTracks().forEach(function(t){t.stop();});_scanStream=null;}
  var line=el('scan-line');if(line)line.style.display='none';
}

function restartScanner(){
  el('scan-result-area').style.display='none';
  _parsedScan={};
  startScanner();
}

async function captureFrame(){
  var video=el('scan-modal-video'),status=el('scan-status');
  if(!video||video.readyState<2){if(status)status.textContent='Camera frame is not ready yet. Please try again.';return;}
  try{
    if(typeof BarcodeDetector!=='undefined'){
      var detector=new BarcodeDetector();
      var found=await detector.detect(video);
      if(found&&found.length&&found[0].rawValue){onScanSuccess(found[0].rawValue);return;}
      if(status)status.innerHTML='No barcode detected in this frame. Hold it steady and <button class="btn bg bxs" onclick="captureFrame()">try again</button>.';
      return;
    }
    await ensureZXing();
    if(typeof ZXing!=='undefined'){restartScanner();return;}
  }catch(e){if(status)status.textContent='Barcode capture failed: '+(e.message||e);return;}
  if(status)status.textContent='Automatic capture is not supported in this browser. Use the Type Barcode tab.';
}

function onScanSuccess(raw){
  stopScanner();
  el('scan-line').style.display='none';
  el('scan-status').innerHTML='✅ <b>Barcode detected!</b> <button class="btn bg bxs" onclick="restartScanner()">🔄 Scan Again</button>';
  el('scan-raw-val').textContent=raw;
  _parsedScan=parseBarcode(raw);
  el('scan-parsed-fields').innerHTML=formatParsedFields(_parsedScan,'scan');
  var matchId=fuzzyMatchMed(_parsedScan.drug)||null;
  el('scan-med-sel').innerHTML=getMedSelectOptions(matchId);
  el('scan-result-area').style.display='block';
}

function applyScanResult(){
  var medId=el('scan-med-sel').value;
  if(!medId) return toast('Select a medication to link','err');
  if(!_parsedScan.expiry) return toast('No expiry date detected — fill manually or scan again','err');
  // Switch to manual tab and fill fields
  switchExpTab('manual');
  el('exp-med-sel').value=medId;
  el('exp-batch-inp').value=_parsedScan.lot||'';
  el('exp-date-inp').value=_parsedScan.expiry||'';
  toast('Data filled — review and Save ✓','succ');
}

// ── Type barcode ───────────────────────────────────────────
function parseTypedBarcode(){
  var raw=(el('type-barcode-inp')||{}).value||'';
  if(!raw.trim()) return toast('Enter a barcode string','err');
  _parsedType=parseBarcode(raw);
  el('type-parsed-fields').innerHTML=formatParsedFields(_parsedType,'type');
  el('type-parsed-fields').style.display='block';
  var matchId=fuzzyMatchMed(_parsedType.drug)||null;
  el('type-med-sel').innerHTML=getMedSelectOptions(matchId);
  el('type-med-wrap').style.display='block';
}
function applyTypedResult(){
  var medId=el('type-med-sel').value;
  if(!medId) return toast('Select a medication','err');
  if(!_parsedType.expiry) return toast('No expiry date found — check the barcode string','err');
  switchExpTab('manual');
  el('exp-med-sel').value=medId;
  el('exp-batch-inp').value=_parsedType.lot||'';
  el('exp-date-inp').value=_parsedType.expiry||'';
  toast('Data filled ✓','succ');
}

// ── Open expiry modal via scan shortcut ───────────────────


// ── Close scanner when modal closes ───────────────────────
function CM(id){document.getElementById(id).classList.remove('on');if(id==='mexpiry')stopScanner();}



publishLegacy("07g-barcode-scanner.js", {
  switchExpTab,
  parseBarcode,
  parseExpiryStr,
  formatParsedFields,
  getMedSelectOptions,
  fuzzyMatchMed,
  startScanner,
  switchCamera,
  stopScanner,
  restartScanner,
  captureFrame,
  onScanSuccess,
  applyScanResult,
  parseTypedBarcode,
  applyTypedResult,
  CM,
});

export {};

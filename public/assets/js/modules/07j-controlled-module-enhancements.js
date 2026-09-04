import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

// ── CONTROLLED MODULE ENHANCEMENTS: unified stock, PDF receipt import,
// batch editor v6, dispensing, analytics, print suite, department shelf
// medication database, role/permission helpers, crash-cart accessors ───
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). startApp() itself stays behind in module 07 — a wrapper further
// down in that same file captures window.startApp synchronously at
// module-evaluation time, so moving the core definition to a
// later-loading file would break app startup. Everything else referenced
// here that isn't declared in this file (S, CU, esc, el, toast, gd, gu,
// getMeds, deptName, ensurePDFJS — already globalThis-published by
// module 03's own import of media-loaders.js) is already published to
// globalThis by its owning module.
// ── CONTROLLED MODULE ENHANCEMENTS: unified stock, alerts, flags and seeded department lists ──

function ctlIsMaster(){
  var profile=window.fsPermissionProfile?window.fsPermissionProfile():(window.CU||{});
  return !!(profile&&profile.master===true);
}
function ctlCanManage(){
  if(window.fsHasCapability)return window.fsHasCapability('controlled.manage');
  return ctlIsMaster()||ctlIsOfficer();
}
function ctlCanEditCatalog(){return ctlCanManage()}
function ctlCanAddCatalog(){return ctlCanManage()||ctlIsWarehouse()}
function ctlCanEditDept(){return ctlCanManage()}
function ctlAlertDays(){return Math.max(1,Number(S.g('controlled_alert_days')||60))}

function ctlFridgeIcon(m){
  return m&&m.refrigerated
    ?'<span class="fridge-icon" title="Refrigerated / Store in refrigerator (2–8°C)" aria-label="Refrigerated medicine"><span class="fridge-glyph" aria-hidden="true"></span></span>'
    :'';
}

function ctlFlags(m){
  var out=[];
  if(m.highAlert)out.push('<span class="badge brd">🔴 High Alert</span>');
  if(m.lasa)out.push('<span class="badge bpu">🔵 LASA</span>');
  if(m.refrigerated)out.push(ctlFridgeIcon(m));
  return out.join(' ')||'<span class="badge bgr">—</span>';
}
function ctlClassLabel(v){
  return v==='psychotropic'
    ?'<span class="badge byl">Psychotropic / نفسي</span>'
    :'<span class="badge brd">Narcotic / مخدر</span>';
}

function ctlEarliestDays(batches){
  var arr=(batches||[]).map(function(b){return daysUntil(b.expiry)}).filter(function(d){return d!==null});
  return arr.length?Math.min.apply(null,arr):null;
}
function ctlStatus(m,w,p){
  var min=ctlNum(m.min),wqty=ctlNum(w.system)+ctlNum(w.outside),pqty=ctlNum(p.qty);
  var wd=ctlEarliestDays(w.batches),pd=ctlEarliestDays(p.batches),d=[wd,pd].filter(function(x){return x!==null});
  var earliest=d.length?Math.min.apply(null,d):null,days=ctlAlertDays();
  if(earliest!==null&&earliest<=0)return {key:'expired',html:'<span class="badge brd">Expired</span>'};
  if(earliest!==null&&earliest<=days)return {key:'soon',html:'<span class="badge byl">Expiring ≤ '+days+'d</span>'};
  if(wqty===0||pqty===0)return {key:'out',html:'<span class="badge brd">Out of stock</span>'};
  if((min>0&&wqty<min)||(min>0&&pqty<min))return {key:'low',html:'<span class="badge byl">Below minimum</span>'};
  return {key:'ok',html:'<span class="badge bgn">OK</span>'};
}


// ── WAREHOUSE PDF RECEIPT IMPORT ─────────────────────────────
globalThis.CTL_PDF_REVIEW = [];
function ctlPdfReceipts(){return S.g('controlled_pdf_receipts')||[]}
function ctlSetPdfReceipts(v){return S.s('controlled_pdf_receipts',v)}
function ctlPdfNormalizeCode(v){return String(v==null?'':v).replace(/[^0-9]/g,'').replace(/^0+(?=\d)/,'')}
function ctlPdfCanUse(){return !!(CU&&(ctlIsWarehouse()||ctlIsMaster()))}
function ctlPdfDrag(e,on){e.preventDefault();var z=el('ctl-pdf-drop');if(z)z.classList.toggle('drag',!!on)}
function ctlPdfDrop(e){e.preventDefault();ctlPdfDrag(e,false);var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)ctlParseReceiptPdf(f)}
function ctlPdfClearReview(){CTL_PDF_REVIEW=[];if(el('ctl-pdf-receipt-file'))el('ctl-pdf-receipt-file').value='';if(el('ctl-pdf-review-wrap'))el('ctl-pdf-review-wrap').style.display='none';if(el('ctl-pdf-progress'))el('ctl-pdf-progress').textContent=''}
function ctlPdfFindMedicine(code){
  var c=ctlPdfNormalizeCode(code);if(!c)return null;
  return ctlCatalog().find(function(m){return ctlPdfNormalizeCode(m.moh)===c||ctlPdfNormalizeCode(m.nupco)===c})||null;
}
function ctlPdfRowsFromItems(items,pageNo){
  var groups=[];
  items.forEach(function(it){
    var str=String(it.str||'').trim();if(!str)return;
    var y=Math.round((it.transform&&it.transform[5]||0)*2)/2,x=it.transform&&it.transform[4]||0,g=null;
    for(var i=0;i<groups.length;i++)if(Math.abs(groups[i].y-y)<=2.5){g=groups[i];break}
    if(!g){g={y:y,t:[]};groups.push(g)}g.t.push({x:x,s:str});
  });
  var out=[];
  groups.sort(function(a,b){return b.y-a.y}).forEach(function(g){
    g.t.sort(function(a,b){return a.x-b.x});
    var ts=g.t,codeToken=null;
    for(var i=0;i<ts.length;i++){var n=ctlPdfNormalizeCode(ts[i].s);if(/^\d{8,14}$/.test(n)){codeToken={code:n,index:i,x:ts[i].x};break}}
    if(!codeToken)return;
    var qtyToken=null;
    for(var j=ts.length-1;j>codeToken.index;j--){var raw=ts[j].s.replace(/,/g,'').trim();if(/^\d+(?:\.\d+)?$/.test(raw)){qtyToken={qty:Number(raw),index:j};break}}
    if(!qtyToken||!isFinite(qtyToken.qty))return;
    var desc=ts.slice(codeToken.index+1,qtyToken.index).map(function(x){return x.s}).join(' ').trim();
    out.push({page:pageNo,code:codeToken.code,description:desc,qty:qtyToken.qty});
  });
  return out;
}
async function ctlParseReceiptPdf(file){
  if(!ctlPdfCanUse())return toast('Warehouse permission required','err');
  if(!file||!/\.pdf$/i.test(file.name||''))return toast('Choose a PDF file','err');
  var pr=el('ctl-pdf-progress');if(pr)pr.textContent='جاري قراءة الملف...\nReading the file...';
  try{
    await ensurePDFJS();
    var data=await file.arrayBuffer(),doc=await pdfjsLib.getDocument({data:data}).promise,raw=[];
    for(var p=1;p<=doc.numPages;p++){
      if(pr)pr.textContent='جاري قراءة الصفحة '+p+' من '+doc.numPages+'...\nReading page '+p+' of '+doc.numPages+'...';
      var page=await doc.getPage(p),content=await page.getTextContent({normalizeWhitespace:true});
      raw=raw.concat(ctlPdfRowsFromItems(content.items,p));
    }
    var seen={};raw=raw.filter(function(r){var k=r.page+'|'+r.code+'|'+r.qty;if(seen[k])return false;seen[k]=1;return true});
    CTL_PDF_REVIEW=raw.map(function(r,i){var med=ctlPdfFindMedicine(r.code);return {id:'pdfrow_'+Date.now()+'_'+i,page:r.page,code:r.code,description:r.description,pdfQty:ctlNum(r.qty),approvedQty:ctlNum(r.qty),expiry:'',selected:!!med,medId:med?med.id:'',medName:med?med.name:'',matched:!!med}});
    if(pr)pr.textContent='تمت قراءة '+doc.numPages+' صفحة من '+file.name+'\nRead '+doc.numPages+' page(s) from '+file.name;
    ctlRenderPdfReview();
    if(!CTL_PDF_REVIEW.length)toast('لم يتم العثور على صفوف صنف وكمية قابلة للقراءة.\nNo readable Item / Quantity rows were found.','err');
  }catch(err){console.error(err);if(pr)pr.textContent='';toast(err.message||'تعذر قراءة ملف PDF.\nThe PDF file could not be read.','err')}
}
function ctlRenderPdfReview(){
  var wrap=el('ctl-pdf-review-wrap'),body=el('ctl-pdf-review-body');if(!wrap||!body)return;
  wrap.style.display=CTL_PDF_REVIEW.length?'block':'none';
  var matched=CTL_PDF_REVIEW.filter(function(r){return r.matched}).length,miss=CTL_PDF_REVIEW.length-matched,total=CTL_PDF_REVIEW.reduce(function(a,r){return a+ctlNum(r.pdfQty)},0);
  el('ctl-pdf-summary').innerHTML='<span class="chip">Rows: <b>'+CTL_PDF_REVIEW.length+'</b></span><span class="chip">Matched: <b>'+matched+'</b></span><span class="chip">Unmatched: <b>'+miss+'</b></span><span class="chip">Total PDF Qty: <b>'+total+'</b></span>';
  body.innerHTML=CTL_PDF_REVIEW.map(function(r,i){return '<tr class="'+(r.matched?'ctl-pdf-match-ok':'ctl-pdf-match-miss')+'"><td><input type="checkbox" '+(r.selected?'checked':'')+' '+(r.matched?'':'disabled')+' onchange="ctlPdfSetField('+i+',\'selected\',this.checked)"></td><td>'+(i+1)+'</td><td><b>'+esc(r.code)+'</b><div class="fhint">Page '+r.page+'</div></td><td><b>'+esc(r.medName||r.description||'Unknown')+'</b>'+(r.medName&&r.description?'<div class="fhint">PDF: '+esc(r.description)+'</div>':'')+'</td><td>'+ctlNum(r.pdfQty)+'</td><td><input type="number" min="0" step="1" value="'+ctlNum(r.approvedQty)+'" '+(r.matched?'':'disabled')+' onchange="ctlPdfSetField('+i+',\'approvedQty\',this.value)"></td><td><input type="date" value="'+esc(r.expiry||'')+'" '+(r.matched?'':'disabled')+' onchange="ctlPdfSetField('+i+',\'expiry\',this.value)"></td><td><span class="ctl-pdf-status '+(r.matched?'ok':'miss')+'">'+(r.matched?'Matched':'Not found')+'</span></td></tr>'}).join('');
  var all=el('ctl-pdf-select-all');if(all){var ok=CTL_PDF_REVIEW.filter(function(r){return r.matched});all.checked=!!ok.length&&ok.every(function(r){return r.selected})}
}
function ctlPdfSetField(i,k,v){var r=CTL_PDF_REVIEW[i];if(!r)return;if(k==='approvedQty')v=Math.max(0,ctlNum(v));r[k]=v;if(k==='selected'&&v&&ctlNum(r.approvedQty)<=0)r.approvedQty=r.pdfQty}
function ctlPdfToggleAll(checked){CTL_PDF_REVIEW.forEach(function(r){if(r.matched)r.selected=checked});ctlRenderPdfReview()}
async function ctlApprovePdfReceipt(allMatched){
  if(!ctlPdfCanUse())return;
  var chosen=CTL_PDF_REVIEW.filter(function(r){return r.matched&&(allMatched||r.selected)&&ctlNum(r.approvedQty)>0});
  if(!chosen.length)return toast('حدد صنفًا مطابقًا واحدًا على الأقل.\nSelect at least one matching item.','err');
  var msg=allMatched?'اعتماد جميع الأصناف المطابقة وإضافتها إلى رصيد المستودع؟\nApprove all matching items and add them to warehouse stock?':'اعتماد الأصناف المحددة فقط وإضافتها إلى رصيد المستودع؟\nApprove only the selected items and add them to warehouse stock?';if(!await uiConfirm(msg))return;
  var originalWh=ctlWarehouse()||{},originalReceipts=ctlPdfReceipts()||[],wh=Object.assign({},originalWh),receipt={id:'pdfreceipt_'+Date.now(),fileName:(el('ctl-pdf-receipt-file')&&el('ctl-pdf-receipt-file').files[0]?el('ctl-pdf-receipt-file').files[0].name:'PDF'),created:nowISO(),by:CU.username,status:'approved',rows:[]};
  chosen.forEach(function(r){var w=Object.assign({},wh[r.medId]||{});w.system=ctlNum(w.system)+ctlNum(r.approvedQty);w.outside=ctlNum(w.outside);w.batches=(w.batches||[]).map(function(b){return Object.assign({},b)});if(r.expiry)w.batches.push({qty:ctlNum(r.approvedQty),expiry:ctlDate(r.expiry)||r.expiry,lot:'PDF receipt'});wh[r.medId]=w;receipt.rows.push({id:r.id,medId:r.medId,code:r.code,medName:r.medName,pdfQty:r.pdfQty,qty:ctlNum(r.approvedQty),expiry:r.expiry||'',expiryBatches:r.expiry?[{qty:ctlNum(r.approvedQty),expiry:r.expiry}]:[],expiryAllocatedQty:r.expiry?ctlNum(r.approvedQty):0,expiryPending:!r.expiry,page:r.page})});
  var receipts=originalReceipts.slice();receipts.unshift(receipt);var warehouseSaved=false;
  try{await ctlSetWarehouse(wh);warehouseSaved=true;await ctlSetPdfReceipts(receipts)}catch(e){
    console.error('PDF warehouse receipt save failed',e);var rollbackFailed=false;
    if(warehouseSaved)try{await ctlSetWarehouse(originalWh)}catch(err){rollbackFailed=true;console.error('PDF receipt warehouse rollback failed',err)}
    return toast(rollbackFailed?'تعذر حفظ الاستلام ولم يمكن تأكيد استعادة رصيد المستودع. راجع الرصيد والسجل.\nThe receipt could not be saved and warehouse stock restoration could not be confirmed. Review the balance and log.':'تعذر حفظ الاستلام وتمت استعادة رصيد المستودع.\nThe receipt could not be saved, and warehouse stock was restored.','err')
  }
  var movementSaved=await ctlSaveMovementLog({type:'warehouse_pdf_receipt',qty:chosen.reduce(function(a,r){return a+ctlNum(r.approvedQty)},0),note:'PDF warehouse receipt approved: '+chosen.length+' line(s)'},'PDF warehouse receipt');
  toast(movementSaved?'تم اعتماد '+chosen.length+' صنف وإضافة الكميات للمستودع ✓\nApproved '+chosen.length+' item(s) and added the quantities to warehouse stock.':'تم اعتماد الأصناف، لكن تعذر حفظ سجل الحركة.\nThe items were approved, but the movement log could not be saved.',movementSaved?'succ':'info');ctlPdfClearReview();renderControlled();return true
}
function ctlPendingPdfExpiryRows(){var out=[];ctlPdfReceipts().forEach(function(rec){(rec.rows||[]).forEach(function(r){var allocated=ctlNum(r.expiryAllocatedQty);if(!allocated&&(r.expiryBatches||[]).length)allocated=(r.expiryBatches||[]).reduce(function(a,b){return a+ctlNum(b.qty)},0);var remaining=Math.max(ctlNum(r.qty)-allocated,0);r.expiryAllocatedQty=allocated;r.expiryPending=remaining>0;if(remaining>0)out.push({receipt:rec,row:r,remaining:remaining})})});return out}
function renderCtlPdfReceiptPanel(){
  var card=el('ctl-pdf-receipt-card');if(!card)return;card.style.display=ctlPdfCanUse()?'block':'none';if(!ctlPdfCanUse())return;
  var rows=ctlPendingPdfExpiryRows(),wrap=el('ctl-pdf-pending-expiry-wrap'),box=el('ctl-pdf-pending-expiry');if(!wrap||!box)return;
  wrap.style.display=rows.length?'block':'none';if(el('ctl-pdf-pending-count'))el('ctl-pdf-pending-count').textContent=rows.length;
  box.innerHTML=rows.map(function(x,i){return '<div class="ctl-pdf-pending-row"><div><b>'+esc(x.row.medName||x.row.code)+'</b><div class="fhint">Total '+ctlNum(x.row.qty)+' · Remaining '+ctlNum(x.remaining)+' · '+esc(x.receipt.fileName||'PDF')+'</div></div><input type="number" min="1" max="'+ctlNum(x.remaining)+'" value="'+ctlNum(x.remaining)+'" id="ctl-pdf-expqty-'+i+'"><input type="date" id="ctl-pdf-exp-'+i+'"><button class="btn bp bxs" onclick="ctlSavePendingPdfExpiry(\''+esc(x.receipt.id)+'\',\''+esc(x.row.id)+'\','+i+')">حفظ الدفعة</button></div>'}).join('');
}
async function ctlSavePendingPdfExpiry(receiptId,rowId,index){
  var inp=el('ctl-pdf-exp-'+index),date=inp&&inp.value,qty=ctlNum(el('ctl-pdf-expqty-'+index)&&el('ctl-pdf-expqty-'+index).value);if(!date)return toast('اختر تاريخ الانتهاء.\nSelect the expiry date.','err');
  var originalReceipts=ctlPdfReceipts()||[],receipts=originalReceipts.map(function(rec){return Object.assign({},rec,{rows:(rec.rows||[]).map(function(r){return Object.assign({},r,{expiryBatches:(r.expiryBatches||[]).map(function(b){return Object.assign({},b)})})})})}),rec=receipts.find(function(x){return x.id===receiptId}),row=rec&&(rec.rows||[]).find(function(x){return x.id===rowId});if(!row)return toast('Receipt row not found','err');
  var allocated=ctlNum(row.expiryAllocatedQty),remaining=Math.max(ctlNum(row.qty)-allocated,0);if(qty<=0||qty>remaining)return toast('كمية دفعة الانتهاء يجب ألا تتجاوز المتبقي '+remaining+'.\nThe expiry-batch quantity cannot exceed the remaining quantity of '+remaining+'.','err');
  var originalWh=ctlWarehouse()||{},wh=Object.assign({},originalWh),w=Object.assign({},wh[row.medId]||{});w.batches=(w.batches||[]).map(function(b){return Object.assign({},b)});w.batches.push({qty:qty,expiry:ctlDate(date)||date,lot:'PDF receipt'});wh[row.medId]=w;row.expiryBatches=(row.expiryBatches||[]).concat([{qty:qty,expiry:date}]);row.expiryAllocatedQty=allocated+qty;row.expiryPending=row.expiryAllocatedQty<ctlNum(row.qty);row.expiry=row.expiryPending?'':date;var warehouseSaved=false;
  try{await ctlSetWarehouse(wh);warehouseSaved=true;await ctlSetPdfReceipts(receipts)}catch(e){
    console.error('PDF expiry batch save failed',e);var rollbackFailed=false;
    if(warehouseSaved)try{await ctlSetWarehouse(originalWh)}catch(err){rollbackFailed=true;console.error('PDF expiry warehouse rollback failed',err)}
    return toast(rollbackFailed?'تعذر حفظ دفعة الانتهاء ولم يمكن تأكيد استعادة رصيد المستودع.\nThe expiry batch could not be saved and warehouse stock restoration could not be confirmed.':'تعذر حفظ دفعة الانتهاء وتمت استعادة رصيد المستودع.\nThe expiry batch could not be saved, and warehouse stock was restored.','err')
  }
  var movementSaved=await ctlSaveMovementLog({type:'warehouse_pdf_expiry_added',medId:row.medId,qty:qty,note:'Expiry added later for PDF receipt'},'PDF expiry batch');
  toast(movementSaved?'تم حفظ تاريخ الانتهاء ✓\nThe expiry date was saved.':'تم حفظ تاريخ الانتهاء، لكن تعذر حفظ سجل الحركة.\nThe expiry date was saved, but the movement log could not be saved.',movementSaved?'succ':'info');renderControlled();return true
}

async function ctlPromptMed(existing){
  var e=existing||{},name=await uiPrompt('Medicine name',e.name||'');if(!name)return null;
  var moh=await uiPrompt('MOH code',e.moh||'')||'',nupco=await uiPrompt('NUPCO code',e.nupco||'')||'';
  var cls=String(await uiPrompt('Classification: narcotic or psychotropic',e.classification||'narcotic')||'').toLowerCase();
  if(cls!=='narcotic'&&cls!=='psychotropic'){toast('Classification must be narcotic or psychotropic','err');return null}
  var highAlert=await uiConfirm('Mark as HIGH ALERT? (Red badge)');
  var lasa=await uiConfirm('Mark as LASA? (Blue badge)');
  var refrigerated=await uiConfirm('Does this medicine require refrigerator storage (2–8°C)?');
  var min=ctlNum(await uiPrompt('Minimum quantity',e.min||0)),max=ctlNum(await uiPrompt('Maximum quantity',e.max||0));
  return {name:name.trim(),moh:moh.trim(),nupco:nupco.trim(),classification:cls,highAlert:highAlert,lasa:lasa,refrigerated:refrigerated,min:min,max:max};
}
async function ctlAddCatalogMedicine(){
  if(!ctlCanAddCatalog())return toast('No add permission','err');
  var d=await ctlPromptMed();if(!d)return;d.id=ctlKey(d.moh,d.nupco,d.name)+'_'+Date.now().toString(36);
  var a=ctlCatalog().slice();a.push(d);
  try{await ctlSetCatalog(a)}catch(e){console.error('Controlled catalogue add failed',e);return toast('Medicine was not added.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'catalog_add',medId:d.id,note:'Shared catalogue medicine added'},'Controlled catalogue add');
  renderControlled();toast(movementSaved?'Medicine added to the shared catalogue ✓':'Medicine was added, but the movement log was not saved.',movementSaved?'succ':'info');return true
}
// ── MASTER NARCOTIC STOCK RESTORE + SEPARATE OUT-OF-STOCK LIST ──


// Run the exact stock restore once after the app state is ready.
// ── CONTROLLED MODULE V6: batch editor, dispensing, analytics and print suite ──
function ctlFmtDMY(v){if(!v)return '—';var d=new Date(v);if(isNaN(d))return esc(v);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()}
function ctlCanDispense(){return typeof window.canControlledDispense==='function'&&window.canControlledDispense()}

function ctlEnsureV6UI(){
  if(el('mctlbatches'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-bg" id="mctlbatches"><div class="modal"><div class="mh"><span class="mt" id="mctlb-title">Expiry batches</span><button class="xbtn" onclick="CM('mctlbatches')">✕</button></div><div id="mctlb-list"></div><button class="btn bg bsm" onclick="ctlAddBatchEditorRow()">+ Add expiry batch</button><div class="fl g8" style="justify-content:flex-end;margin-top:18px"><button class="btn bg" onclick="CM('mctlbatches')">Cancel</button><button class="btn bp" onclick="ctlSaveBatchEditor()">Save batches</button></div></div></div>
  <div class="modal-bg" id="mctldisp"><div class="modal"><div class="mh"><span class="mt">Dispense controlled medicine / صرف دواء</span><button class="xbtn" onclick="CM('mctldisp')">✕</button></div><input type="hidden" id="ctld-med"><div class="fg"><label>Medicine</label><input id="ctld-name" disabled></div><div class="frow"><div class="fg"><label>Quantity</label><input id="ctld-qty" type="number" min="1"></div><div class="fg"><label>Dispensing type</label><select id="ctld-type" onchange="ctlDispTypeChanged()"><option value="inpatient">Inpatient / تنويم</option><option value="internal">Internal hospital department / قسم داخلي</option><option value="outpatient">Outpatient / عيادات أو مريض خارجي</option></select></div></div><div class="fg" id="ctld-dept-wrap"><label>Hospital department / القسم</label><select id="ctld-dept"></select></div><div class="fg"><label>Recipient name / اسم المستلم</label><input id="ctld-recipient"></div><div class="fg"><label>Notes</label><textarea id="ctld-note" rows="2"></textarea></div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" onclick="CM('mctldisp')">Cancel</button><button class="btn bs" onclick="ctlConfirmDispense()">Confirm dispensing</button></div></div></div>
  <input type="file" id="ctl-logo-file" accept="image/png,image/jpeg" style="display:none" onchange="ctlSavePrintLogo(this.files[0])">`);
}
globalThis.CTL_BATCH_CTX = null;
function ctlAddBatchEditorRow(b){b=b||{};var d=document.createElement('div');d.className='batch-editor-row';d.innerHTML='<input type="number" class="be-qty" min="0" placeholder="Qty" value="'+esc(b.qty||'')+'"><input type="date" class="be-exp" value="'+esc(b.expiry||'')+'"><input class="be-lot" placeholder="Batch / lot" value="'+esc(b.lot||'')+'"><button class="btn bd2c bxs" onclick="this.parentElement.remove()">✕</button>';el('mctlb-list').appendChild(d)}
async function ctlSaveBatchEditor(){
  if(!CTL_BATCH_CTX)return;
  var src=CTL_BATCH_CTX.source,id=CTL_BATCH_CTX.id,rows=Array.from(el('mctlb-list').querySelectorAll('.batch-editor-row')).map(function(r){return {qty:ctlNum(r.querySelector('.be-qty').value),expiry:r.querySelector('.be-exp').value,lot:r.querySelector('.be-lot').value.trim()}}).filter(function(b){return b.qty||b.expiry||b.lot}),actual=0;
  if(src==='pharmacy'){var curp=ctlPharmacy()[id]||{};actual=ctlNum(curp.actualQty!=null?curp.actualQty:curp.qty)}else if(src==='warehouse'){var curw=ctlWarehouse()[id]||{};actual=ctlNum(curw.system)+ctlNum(curw.outside)}
  if(actual<0)return toast('Actual quantity cannot be negative.','err');
  if(actual===0)rows=[];else{
    if(!rows.length)return toast('At least one expiry date is required when the actual quantity is greater than zero.','err');
    if(rows.length===1&&rows[0].expiry&&!(rows[0].qty>0))rows[0].qty=actual;
    for(var i=0;i<rows.length;i++){if(!(rows[i].qty>0))return toast('Every expiry row must have a quantity greater than zero.','err');if(!rows[i].expiry)return toast('Expiry date is required for each entered expiry quantity.','err')}
    var total=rows.reduce(function(a,b){return a+ctlNum(b.qty)},0);if(total!==actual)return toast('Expiry quantities must equal the actual quantity. Total: '+total+' / Actual: '+actual,'err')
  }
  try{
    if(src==='warehouse'){var all=Object.assign({},ctlWarehouse()),x=Object.assign({},all[id]||{});x.batches=rows;all[id]=x;await ctlSetWarehouse(all)}
    else{var all2=Object.assign({},ctlPharmacy()),x2=Object.assign({},all2[id]||{});x2.batches=rows;x2.qty=actual;all2[id]=x2;await ctlSetPharmacy(all2)}
  }catch(e){console.error('Controlled expiry batch save failed',e);return toast('Expiry batches were not saved.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'expiry_batches_update',medId:id,source:src,note:'Expiry batches updated'},'Controlled expiry batches');
  CM('mctlbatches');renderControlled();toast(movementSaved?(actual===0?'Expiry batches cleared ✓':'Expiry batches saved ✓'):(actual===0?'Expiry batches were cleared, but the movement log was not saved.':'Expiry batches were saved, but the movement log was not saved.'),movementSaved?'succ':'info');return true
}
function ctlOpenDispense(id){if(!ctlCanDispense())return;ctlEnsureV6UI();var m=ctlMedicine(id)||{};el('ctld-med').value=id;el('ctld-name').value=m.name||'';el('ctld-qty').value='';el('ctld-recipient').value='';el('ctld-note').value='';el('ctld-dept').innerHTML=gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');ctlDispTypeChanged();OM('mctldisp')}
function ctlDispTypeChanged(){var t=el('ctld-type').value;el('ctld-dept-wrap').style.display=(t==='inpatient'||t==='internal')?'block':'none'}
function ctlLogo(){return S.g('controlled_print_logo')||''}
function ctlChooseLogo(){ctlEnsureV6UI();el('ctl-logo-file').click()}
async function ctlSavePrintLogo(file){if(!file)return;try{var data=await window.fsPrepareImageDataUrl(file);await S.s('controlled_print_logo',data);toast('Print logo saved ✓','succ')}catch(error){var input=el('ctl-logo-file');if(input)input.value='';toast(String(error&&error.message||error),'err')}}
function ctlPrintSettings(dept){return S.g('controlled_settings_'+dept)||{}}
function ctlPublicUrl(dept){var u=new URL(window.location.href);u.search='';u.hash='';u.searchParams.set('view','controlled-expiry');u.searchParams.set('dept',dept);var tenant=window.fsTenantId&&fsTenantId();if(tenant)u.searchParams.set('tenant',tenant);return u.toString()}
async function ctlPublishDept(dept){
  if(!window.FB_DB)throw new Error('Firebase is not initialized');
  var d=(typeof gd==='function'?(gd()||[]):[]).find(function(x){return x.id===dept})||{};
  var items=(typeof ctlDeptList==='function'?ctlDeptList(dept):[]).map(function(x){var m=typeof ctlMedicine==='function'?(ctlMedicine(x.medId)||{}):{};return {name:m.name||'',classification:m.classification||'narcotic',qty:ctlNum(x.qty),batches:(x.batches||[]).map(function(b){return {expiry:b.expiry||'',qty:b.qty==null?'':ctlNum(b.qty)}})}});
  var alertDays=((typeof ctlSettingsGlobal==='function'?(ctlSettingsGlobal()||{}):{}).expiryAlertDays||30);
  var collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');
  await collection.doc(dept).set({departmentId:dept,departmentName:d.name||((window.CU&&CU.deptId===dept)?CU.deptName:'')||dept,alertDays:Number(alertDays)||30,items:items,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:false});
}
function renderCtlAnalytics(){if(!CU)return;var deptSel=el('ctl-an-dept');if(deptSel&&deptSel.options.length<=1)deptSel.innerHTML='<option value="">All departments</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');var from=el('ctl-an-from')?el('ctl-an-from').value:'',to=el('ctl-an-to')?el('ctl-an-to').value:'',type=el('ctl-an-type')?el('ctl-an-type').value:'',dept=deptSel?deptSel.value:'',rec=(el('ctl-an-recipient')?el('ctl-an-recipient').value:'').toLowerCase();var rows=ctlMoves().filter(function(x){if(x.type!=='dispense')return false;var d=String(x.at||'').slice(0,10);return (!from||d>=from)&&(!to||d<=to)&&(!type||x.dispenseType===type)&&(!dept||x.dept===dept)&&(!rec||String(x.recipient||'').toLowerCase().includes(rec))});var total=rows.reduce(function(s,x){return s+ctlNum(x.qty)},0),recipients=new Set(rows.map(function(x){return x.recipient}).filter(Boolean)).size,depts=new Set(rows.map(function(x){return x.dept}).filter(Boolean)).size;el('ctl-an-stats').innerHTML='<div class="sc"><div class="sl">Transactions</div><div class="ctl-stat-number">'+rows.length+'</div></div><div class="sc"><div class="sl">Total quantity</div><div class="ctl-stat-number">'+total+'</div></div><div class="sc"><div class="sl">Recipients</div><div class="ctl-stat-number">'+recipients+'</div></div><div class="sc"><div class="sl">Departments</div><div class="ctl-stat-number">'+depts+'</div></div>';el('ctl-an-table').innerHTML=rows.slice().reverse().map(function(x){var m=ctlMedicine(x.medId)||{};return '<tr><td>'+fmtDateTime(x.at)+'</td><td>'+esc(m.name||'')+'</td><td>'+ctlNum(x.qty)+'</td><td>'+esc(x.source||'')+'</td><td>'+esc(x.dispenseType||'')+'</td><td>'+esc(x.deptName||'—')+'</td><td>'+esc(x.recipient||'')+'</td><td>'+esc(x.by||'')+'</td></tr>'}).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px">No matching records</td></tr>';if(typeof window.injectAnTabBar==='function')window.injectAnTabBar('pg-ctl-analytics');}
function printCtlAnalytics(){var html=el('ctl-an-table').closest('table').outerHTML;ctlPrintHTML('Controlled dispensing analytics','<h1>إحصائيات صرف الأدوية المخدرة</h1><h2>Controlled Dispensing Analytics</h2>'+html)}
// Override public barcode page to be login-free and cleaner.
// Add buttons and improved batch controls after each controlled render.


globalThis.CTL_DEPT_SELECTED = {};

function ctlDeptShelves(deptId){
  return S.g('controlled_dept_shelves_'+deptId)||[];
}
function ctlSetDeptShelves(deptId,arr){
  return S.s('controlled_dept_shelves_'+deptId,arr);
}
function ctlDeptShelfName(deptId,shelfId){
  var s=ctlDeptShelves(deptId).find(function(x){return x.id===shelfId});
  return s?s.name:'—';
}
function ctlToggleDeptMed(cb){
  var dept=ctlCurrentDept();
  if(!CTL_DEPT_SELECTED[dept])CTL_DEPT_SELECTED[dept]={};
  if(cb.checked)CTL_DEPT_SELECTED[dept][cb.dataset.id]=true;
  else delete CTL_DEPT_SELECTED[dept][cb.dataset.id];
  ctlRefreshDeptBulkBar();
}
function ctlToggleAllDeptMeds(cb){
  var dept=ctlCurrentDept(),list=ctlDeptList(dept);
  CTL_DEPT_SELECTED[dept]={};
  list.forEach(function(x){
    if(cb.checked)CTL_DEPT_SELECTED[dept][x.medId]=true;
  });
  renderCtlDepartments();
}
function ctlSelectedDeptIds(){
  var dept=ctlCurrentDept();
  return Object.keys(CTL_DEPT_SELECTED[dept]||{}).filter(function(id){return CTL_DEPT_SELECTED[dept][id]});
}
function ctlRefreshDeptBulkBar(){
  var ids=ctlSelectedDeptIds(),btn=el('ctl-bulk-shelf-btn');
  if(btn){
    btn.style.display=ctlCanEditDept()&&ids.length?'inline-flex':'none';
    btn.textContent='Add '+ids.length+' selected to shelf';
  }
}
async function ctlOpenBulkShelf(){
  var ids=ctlSelectedDeptIds();
  if(!ids.length)return toast('Select at least one medicine','err');
  var dept=ctlCurrentDept(),shelves=ctlDeptShelves(dept);
  var sel=el('ctl-bulk-shelf-select');
  sel.innerHTML=shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');
  if(!shelves.length){
    var name=await uiPrompt('No shelf exists. Enter a new shelf name, e.g. Refrigerator / ثلاجة','');
    if(!name)return;
    var shelf={id:'shelf_'+Date.now().toString(36),name:name.trim(),created:nowISO()};
    ctlSetDeptShelves(dept,[shelf]).then(function(){
      sel.innerHTML='<option value="'+shelf.id+'">'+esc(shelf.name)+'</option>';
      el('ctl-bulk-shelf-count').textContent=ids.length+' medicines selected';
      OM('mctl-bulk-shelf');
    });
    return;
  }
  el('ctl-bulk-shelf-count').textContent=ids.length+' medicines selected';
  OM('mctl-bulk-shelf');
}
async function ctlApplyBulkShelf(){
  if(!ctlCanEditDept())return toast('No permission','err');
  var dept=ctlCurrentDept(),shelfId=el('ctl-bulk-shelf-select').value,ids=ctlSelectedDeptIds();
  if(!shelfId||!ids.length)return;
  var list=ctlDeptList(dept).map(function(x){return ids.includes(x.medId)?Object.assign({},x,{shelfId:shelfId}):x});
  try{await ctlSetDeptList(dept,list)}catch(e){console.error('Bulk department shelf assignment failed',e);return toast('Shelf assignment was not saved.','err')}
  CTL_DEPT_SELECTED[dept]={};CM('mctl-bulk-shelf');toast(ids.length+' medicines added to shelf ✓','succ');renderCtlDepartments();return true
}

function renderCtlDepartments(){
  if(ctlIsWarehouse()){var v=el('ctl-departments-view');if(v)v.style.display='none';return;}
  var sel=el('ctl-dept');
  if(!sel)return;
  var ds=gd(),cur=sel.value;
  if(CU.role==='department')sel.innerHTML='<option value="'+CU.deptId+'">'+esc(CU.deptName)+'</option>';
  else sel.innerHTML=ds.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  if(cur&&Array.from(sel.options).some(function(o){return o.value===cur}))sel.value=cur;
  var dept=ctlCurrentDept(),list=ctlDeptList(dept),can=ctlCanEditDept();
  el('ctl-assign-btn').style.display=can?'inline-flex':'none';
  el('ctl-sign-btn').style.display=can?'inline-flex':'none';

  var selected=CTL_DEPT_SELECTED[dept]||{};
  var alerts=[];
  list.forEach(function(x){
    (x.batches||[]).forEach(function(b){
      var d=daysUntil(b.expiry);
      if(d!==null&&d<=ctlAlertDays())alerts.push({name:(ctlMedicine(x.medId)||{}).name||'',days:d});
    });
  });
  el('ctl-dept-alerts').innerHTML=alerts.length
    ?'<div class="alert-banner">⚠ '+alerts.map(function(a){return esc(a.name)+' ('+(a.days<=0?'expired '+Math.abs(a.days)+'d':a.days+'d')+')'}).join(' · ')+'</div>'
    :'';

  el('ctl-dept-table').innerHTML=list.length?list.map(function(x,i){
    var m=ctlMedicine(x.medId)||{};
    return '<tr>'+
      '<td><input type="checkbox" data-id="'+x.medId+'" onchange="ctlToggleDeptMed(this)" '+(selected[x.medId]?'checked':'')+'></td>'+
      '<td>'+(i+1)+'</td>'+
      '<td>'+esc(m.moh||'—')+'</td>'+
      '<td>'+esc(m.nupco||'—')+'</td>'+
      '<td><b>'+esc(m.name||'')+'</b>'+ctlFridgeIcon(m)+'</td>'+
      '<td>'+ctlClassLabel(m.classification)+'</td>'+
      '<td>'+ctlFlags(m)+'</td>'+
      '<td>'+ctlNum(x.min!=null?x.min:m.min)+'</td>'+
      '<td>'+ctlNum(x.max!=null?x.max:m.max)+'</td>'+
      '<td>'+ctlNum(x.qty)+'</td>'+
      '<td><span class="shelf-badge">'+esc(ctlDeptShelfName(dept,x.shelfId))+'</span></td>'+
      '<td>'+ctlBatchText(x.batches)+'</td>'+
      '<td>'+(can?'<button class="btn bg bxs" data-id="'+x.medId+'" onclick="ctlEditDeptMedicine(this.dataset.id)">Edit</button> <button class="btn bd2c bxs" data-id="'+x.medId+'" onclick="ctlRemoveDeptMedicine(this.dataset.id)">Remove</button>':'<span class="chip">Read only</span>')+'</td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--tx2)">No medicines assigned to this department.</td></tr>';

  if(el('ctl-dept-select-all')){
    el('ctl-dept-select-all').checked=list.length>0&&list.every(function(x){return selected[x.medId]});
  }
  ctlRefreshDeptBulkBar();
}


function requestColdMarker(m){
  return m&&m.refrigerated
    ?'<span class="request-snow-marker" title="Refrigerated / Store in refrigerator (2–8°C)" aria-label="Refrigerated medicine">❄️</span>'
    :'';
}


// ═══════════════════════════════════════════════════════════
// COMPREHENSIVE ACCESS, DEPARTMENT INVENTORY, CRASH CART,
// REQUEST RECEIVING AND CONTROLLED-MEDICINE ENHANCEMENTS
// ═══════════════════════════════════════════════════════════
globalThis.MASTER_ACTUAL = null;
globalThis.MASTER_EFFECTIVE = null;

function actualUser(){
  return MASTER_ACTUAL||CU;
}
function actualActorName(){
  var u=actualUser();
  return u?(u.username||u.email||'Unknown'):'Unknown';
}
function isMasterActual(){return !!(MASTER_ACTUAL&&MASTER_ACTUAL.master===true)||!!(CU&&CU.master===true&&!MASTER_ACTUAL)}
function isPharmacyDirector(){return (window.fsEffectiveRole?window.fsEffectiveRole():String(CU&&CU.role||''))==='pharmacy'}
function isInpatientSupervisor(){return (window.fsEffectiveRole?window.fsEffectiveRole():String(CU&&CU.role||''))==='inpatient_supervisor'}
function isPharmacyStaff(){return (window.fsEffectiveRole?window.fsEffectiveRole():String(CU&&CU.role||''))==='pharmacy_staff'}
function canManageRequests(){return window.fsHasCapability?window.fsHasCapability('requests.manage'):(isPharmacyDirector()||isInpatientSupervisor()||isPharmacyStaff()||role()==='outpatient_pharmacy_supervisor')}
function canManageCrashCart(){return window.fsCanManageCrashCart?window.fsCanManageCrashCart():(isPharmacyDirector()||isInpatientSupervisor()||isPharmacyStaff()||role()==='outpatient_pharmacy_supervisor')}
function canConfigureCrashCart(){return window.fsHasCapability?window.fsHasCapability('crashCart.configure'):(isPharmacyDirector()||isInpatientSupervisor()||role()==='outpatient_pharmacy_supervisor')}
function requireCrashCartConfigurationPermission(){if(canConfigureCrashCart())return true;toast('Only the Pharmacy Director or Inpatient Pharmacy Supervisor can change Crash Cart medicines and quantities. / التعديل متاح فقط لمدير الصيدلية أو مشرف الصيدلية الداخلية','err');return false}
function canManageUsers(){return isPharmacyDirector()&&!MASTER_EFFECTIVE}

function masterRoleLabel(role){
  return role==='pharmacy'?'Pharmacy Director / مدير الصيدلية'
    :role==='inpatient_supervisor'?'Inpatient Pharmacy Supervisor / مشرف الصيدلية الداخلية'
    :role==='outpatient_pharmacy_supervisor'?'Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية'
    :role==='pharmacy_staff'?'Pharmacy Employee / موظف صيدلية'
    :role==='controlled_pharmacy'?'Controlled Medicines Pharmacy Officer / مسؤول الأدوية الخاضعة للرقابة'
    :role==='warehouse'?'Warehouse Custody Officer / مسؤول عهدة المستودع'
    :role==='department'?'Department Employee / موظف قسم'
    :role||'Unknown role';
}
function ensureMasterRoleModal(){return typeof window.fsR6EnsureMasterModal==='function'?window.fsR6EnsureMasterModal():null}
function masterRoleSelectionChanged(){
  var role=el('master-role-select')?el('master-role-select').value:'pharmacy';
  var wrap=el('master-dept-wrap');if(wrap)wrap.style.display=role==='department'?'block':'none';
  masterPreviewRole();
}
function masterPreviewRole(){
  var role=el('master-role-select')?el('master-role-select').value:'pharmacy';
  var deptId=el('master-dept-select')?el('master-dept-select').value:'';
  var dept=role==='department'?gd().find(function(d){return d.id===deptId}):null;
  var preview=el('master-user-preview');if(!preview)return;
  preview.innerHTML='<strong>Effective permissions:</strong> '+esc(masterRoleLabel(role))
    +(role==='department'?'<br><strong>Department:</strong> '+esc(dept?dept.name:'No department selected'):'')
    +'<br><strong>Actual signed-in user:</strong> '+esc((actualUser()||{}).email||(actualUser()||{}).username||'Master')+' (Master)';
}


// Master uniqueness is enforced directly by saveUser.

// Bulk medication flags for any inventory.
async function bulkSetMedicationFlag(flag){
  var ids=getSelectedMedIds(),deptId=getInvDept();
  if(!deptId)return toast('Choose a department first','err');
  if(!ids.length)return toast('Select medications first','err');
  var label=flag==='refrigerated'?'Refrigerated':flag==='lasa'?'LASA':flag==='hazard'?'Hazard':'High Alert';
  var setTo=await uiConfirm('Press OK to mark selected medicines as '+label+'.\nPress Cancel to remove the flag.');
  var meds=getMeds(deptId).map(function(m){if(ids.includes(m.id)){var n=Object.assign({},m);n[flag]=setTo;return n}return m});
  await setMeds(deptId,meds);auditAction('bulk_medication_flag',{deptId:deptId,ids:ids,flag:flag,value:setTo});toast(ids.length+' medicines updated ✓','succ');clearInvSelection();renderInv();
}

// Pharmacy request permissions and actual master attribution.

/* Print Orders permission/audit logic is handled by the canonical print module below. */

// Add receive/expiry action after fulfillment for departments.

/* Department receive/expiry actions use the consolidated flow below. */


// Full department inventory.


// ── DEPARTMENT SHELF MEDICATION DATABASE ─────────────────
globalThis.SHELF_MED_SELECTED = {};
function shelfSelectedIds(){return Object.keys(SHELF_MED_SELECTED).filter(function(id){return SHELF_MED_SELECTED[id]})}
function shelfMedMatches(m){
  var q=((el('shelf-med-search')||{}).value||'').trim().toLowerCase();
  var f=((el('shelf-med-filter')||{}).value||'all');
  if(q && !(String(m.name||'').toLowerCase().includes(q)||String(m.category||'').toLowerCase().includes(q)))return false;
  if(f==='__none__' && m.shelfId)return false;
  if(f==='__no_expiry__'){
    var hasExpiry=getExpiry(CU.deptId).some(function(b){return b.medId===m.id&&String(b.date||'').trim();});
    if(hasExpiry)return false;
  }
  if(f==='__expiring_soon__'){
    var cfg=getAlertSettings(CU.deptId)||{d1:30,d2:7};
    var isSoon=getExpiry(CU.deptId).some(function(b){
      if(b.medId!==m.id||!String(b.date||'').trim())return false;
      var days=daysUntil(b.date);
      return days!==null&&days>0&&days<=Number(cfg.d1||30);
    });
    if(!isSoon)return false;
  }
  if(f!=='all'&&f!=='__none__'&&f!=='__no_expiry__'&&f!=='__expiring_soon__'&&m.shelfId!==f)return false;
  return true;
}
function shelfExpiryCell(medId){
  var cfg=getAlertSettings(CU.deptId)||{d1:30,d2:7};
  var batches=getExpiry(CU.deptId).filter(function(b){return b.medId===medId;}).sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));});
  var rows=batches.map(function(b){
    var days=daysUntil(b.date),cls='exp-ok',label='—';
    if(days!==null&&days<=0){cls='exp-red';label=(days===0?'Expires today':'Expired '+Math.abs(days)+' day'+(Math.abs(days)===1?'':'s')+' ago');}
    else if(days!==null){
      label=days+' day'+(days===1?'':'s')+' remaining';
      if(days<=Number(cfg.d2||7))cls='exp-red';
      else if(days<=Number(cfg.d1||30))cls='exp-yellow';
    }
    return '<div class="'+cls+'" style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">'
      +'<span><b>'+esc(fmtDate(b.date))+'</b>'+(b.batch?' · '+esc(b.batch):'')+' <small>('+label+')</small></span>'
      +'<span style="white-space:nowrap"><button class="btn bg bxs" data-bid="'+b.id+'" data-mid="'+medId+'" data-batch="'+esc(b.batch||'')+'" data-date="'+esc(b.date||'')+'" onclick="openEditExpiry(this)">✎</button> '
      +'<button class="btn bd2c bxs" data-bid="'+b.id+'" onclick="delBatch(this.dataset.bid,this)">×</button></span></div>';
  }).join('');
  return (rows||'<span style="color:var(--tx3)">No expiry batches</span>')
    +'<div style="margin-top:5px"><button class="btn bg bxs" data-mid="'+medId+'" onclick="openAddExpiryForMed(this.dataset.mid)">+ Add expiry</button></div>';
}
function openAddExpiryForMed(medId){
  openAddExpiry();
  if(el('exp-med-sel'))el('exp-med-sel').value=medId;
}
function renderShelfMedicationDatabase(){
  if(!CU||CU.role!=='department'||!el('shelf-med-db'))return;
  var shelves=getShelves(CU.deptId),meds=getMeds(CU.deptId),shown=meds.filter(shelfMedMatches);
  var cfg=typeof getPharmacyCategoryConfig==='function'?getPharmacyCategoryConfig(CU.deptId):{order:[]};
  var order=cfg.order||[];
  shown.sort(function(a,b){
    var ac=String(a.category||'Uncategorized'),bc=String(b.category||'Uncategorized');
    var ai=order.indexOf(ac),bi=order.indexOf(bc);
    if(ai<0)ai=999;if(bi<0)bi=999;
    var cc=ai-bi;
    return cc||String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base',numeric:true});
  });
  var filter=el('shelf-med-filter'),target=el('shelf-bulk-target');
  if(filter){
    var fv=filter.value;
    filter.innerHTML='<option value="all">All medications / كل الأدوية</option><option value="__none__">Unassigned / غير معيّنة لدرج</option><option value="__no_expiry__">No expiry date / بدون تاريخ انتهاء</option><option value="__expiring_soon__">Expiring soon / قريبة الانتهاء</option>'+shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');
    if(Array.from(filter.options).some(function(o){return o.value===fv}))filter.value=fv;
  }
  if(target){var tv=target.value;target.innerHTML='<option value="">Choose drawer...</option><option value="__none__">Remove from drawer</option>'+shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');if(Array.from(target.options).some(function(o){return o.value===tv}))target.value=tv}
  var rowNo=0,lastCategory=null,html='';
  shown.forEach(function(m){
    var category=String(m.category||'Uncategorized');
    if(category!==lastCategory){
      var count=shown.filter(function(x){return String(x.category||'Uncategorized')===category;}).length;
      html+='<tr class="shelf-category-row"><td colspan="9" style="background:var(--s3);color:var(--tx);font-weight:700;padding:9px 12px;border-top:2px solid var(--bd2)">'+esc(category)+' <span class="chip" style="margin-inline-start:6px">'+count+'</span></td></tr>';
      lastCategory=category;
    }
    rowNo++;
    html+='<tr><td><input type="checkbox" '+(SHELF_MED_SELECTED[m.id]?'checked':'')+' data-mid="'+m.id+'" onchange="toggleShelfMedication(this.dataset.mid,this.checked)"></td>'
      +'<td>'+rowNo+'</td><td><b>'+esc(m.name)+'</b>'+requestColdMarker(m)+'</td><td>'+esc(category)+'</td><td>'+bdg(m)+'</td>'
      +'<td>'+(m.shelfId?'<span class="shelf-badge">'+esc(getShelfName(m.shelfId))+'</span>':'<span class="badge bgr">Unassigned</span>')+'</td>'
      +'<td>'+shelfExpiryCell(m.id)+'</td>'
      +'<td style="text-align:center">'+esc(m.min==null?'—':m.min)+'</td><td style="text-align:center">'+esc(m.max==null?'—':m.max)+'</td></tr>';
  });
  el('shelf-med-db').innerHTML=html||'<tr><td colspan="9" style="text-align:center;padding:26px;color:var(--tx2)">No medications match this search.</td></tr>';
  var ids=shelfSelectedIds(),bar=el('shelf-bulk-bar');if(bar)bar.style.display=ids.length?'block':'none';
  if(el('shelf-selected-count'))el('shelf-selected-count').textContent=ids.length+' selected';
  var all=el('shelf-med-all');if(all){all.checked=shown.length>0&&shown.every(function(m){return !!SHELF_MED_SELECTED[m.id]});all.indeterminate=!all.checked&&shown.some(function(m){return !!SHELF_MED_SELECTED[m.id]})}
}
function toggleShelfMedication(id,v){SHELF_MED_SELECTED[id]=v;renderShelfMedicationDatabase()}
function toggleAllShelfMedications(v){getMeds(CU.deptId).filter(shelfMedMatches).forEach(function(m){SHELF_MED_SELECTED[m.id]=v});renderShelfMedicationDatabase()}
function clearShelfMedicationSelection(){SHELF_MED_SELECTED={};renderShelfMedicationDatabase()}
async function assignSelectedMedsToShelf(){
  var ids=shelfSelectedIds(),target=(el('shelf-bulk-target')||{}).value;
  if(!ids.length)return toast('Select one or more medications first','err');
  if(!target)return toast('Choose a drawer first','err');
  var shelfId=target==='__none__'?'':target;
  var meds=getMeds(CU.deptId).map(function(m){return ids.includes(m.id)?Object.assign({},m,{shelfId:shelfId}):m});
  await setMeds(CU.deptId,meds);auditAction('department_bulk_shelf',{deptId:CU.deptId,ids:ids,shelfId:shelfId});
  SHELF_MED_SELECTED={};renderShelves();toast(ids.length+' medications updated ✓','succ');
}

// Crash Cart
function crashCarts(){return S.g('crash_carts')||[]}
function crashReports(){return S.g('crash_cart_reports')||[]}
function setCrashReports(v){
  var p=S.s('crash_cart_reports',v);
  // Every legacy direct-write path (close/respond, bulk open+replace, seal
  // correction) still only touches this state-doc array. Mirror the affected
  // reports into crash_cart_reports_v2 afterward, best-effort, so scoped
  // roles (inpatient_supervisor, pharmacy_staff) — who only read v2 — don't
  // see a report stuck at a stale status.
  Promise.resolve(p).then(function(){
    if(typeof window.fsCallFunction!=='function')return;
    var ids=(v||[]).map(function(r){return r&&r.id}).filter(Boolean);
    if(!ids.length)return;
    window.fsCallFunction('syncCrashCartReportsToV2',{reportIds:ids}).catch(function(e){console.warn('crash_cart_reports_v2 sync failed',e)});
  });
  return p;
}
function crashCart(id){return crashCarts().find(function(c){return c.id===id})}


// Controlled medicines: hospital, approved flag, barcode, separated narcotic/psychotropic.
function ctlSettingsGlobal(){return S.g('controlled_global_settings')||{hospitalName:'',approved:false,expiryAlertDays:30}}


publishLegacy("07j-controlled-module-enhancements.js", {
  ctlIsMaster,
  ctlCanManage,
  ctlCanEditCatalog,
  ctlCanAddCatalog,
  ctlCanEditDept,
  ctlAlertDays,
  ctlFridgeIcon,
  ctlFlags,
  ctlClassLabel,
  ctlEarliestDays,
  ctlStatus,
  ctlPdfReceipts,
  ctlSetPdfReceipts,
  ctlPdfNormalizeCode,
  ctlPdfCanUse,
  ctlPdfDrag,
  ctlPdfDrop,
  ctlPdfClearReview,
  ctlPdfFindMedicine,
  ctlPdfRowsFromItems,
  ctlParseReceiptPdf,
  ctlRenderPdfReview,
  ctlPdfSetField,
  ctlPdfToggleAll,
  ctlApprovePdfReceipt,
  ctlPendingPdfExpiryRows,
  renderCtlPdfReceiptPanel,
  ctlSavePendingPdfExpiry,
  ctlPromptMed,
  ctlAddCatalogMedicine,
  ctlFmtDMY,
  ctlCanDispense,
  ctlEnsureV6UI,
  ctlAddBatchEditorRow,
  ctlSaveBatchEditor,
  ctlOpenDispense,
  ctlDispTypeChanged,
  ctlLogo,
  ctlChooseLogo,
  ctlSavePrintLogo,
  ctlPrintSettings,
  ctlPublicUrl,
  ctlPublishDept,
  renderCtlAnalytics,
  printCtlAnalytics,
  ctlDeptShelves,
  ctlSetDeptShelves,
  ctlDeptShelfName,
  ctlToggleDeptMed,
  ctlToggleAllDeptMeds,
  ctlSelectedDeptIds,
  ctlRefreshDeptBulkBar,
  ctlOpenBulkShelf,
  ctlApplyBulkShelf,
  renderCtlDepartments,
  requestColdMarker,
  actualUser,
  actualActorName,
  isMasterActual,
  isPharmacyDirector,
  isInpatientSupervisor,
  isPharmacyStaff,
  canManageRequests,
  canManageCrashCart,
  canConfigureCrashCart,
  requireCrashCartConfigurationPermission,
  canManageUsers,
  masterRoleLabel,
  ensureMasterRoleModal,
  masterRoleSelectionChanged,
  masterPreviewRole,
  bulkSetMedicationFlag,
  shelfSelectedIds,
  shelfMedMatches,
  shelfExpiryCell,
  openAddExpiryForMed,
  renderShelfMedicationDatabase,
  toggleShelfMedication,
  toggleAllShelfMedications,
  clearShelfMedicationSelection,
  assignSelectedMedsToShelf,
  crashCarts,
  crashReports,
  setCrashReports,
  crashCart,
  ctlSettingsGlobal,
});

export {};

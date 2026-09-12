/* The printed controlled-custody sheet: one department, one A4 page, signed.

   This is a document, not a screen. It is opened as a self-contained blob — its
   own HTML, its own CSS, its own runtime — because it has to survive being
   printed from a browser the hospital did not choose, and because a print
   stylesheet inside the application could never guarantee that the whole custody
   list lands on ONE page. That guarantee is the entire difficulty: a signed
   custody sheet that silently continues onto a second page is a second document
   nobody signed.

   So the document ships with a fitter. Both a landscape and a portrait layout
   are written into the page; the runtime measures each against the paper,
   shrinks type and padding within fixed bounds until one fits, keeps that one,
   and removes the other. If neither fits even at the smallest step, the sheet
   says so rather than printing a truncated custody list.

   The QR code is the department's live list. It is required, not decorative — a
   placeholder image is treated as a failure and stops the print, because a
   signed sheet carrying a QR that leads nowhere is worse than no sheet.

   Moved out of modules/51 as its own file: it shared nothing with the screens
   around it except the data it prints. */

import { fsEsc } from './dom-utils.js?v=b2909b7f46';
import { fsText } from './text-normalize.js?v=aa16ae9ac0';
import { uiToast } from './module-ui-helpers.js?v=3657403ad7';
import { fsR5ControlledDept, fsR5ControlledRows } from './controlled-custody-data.js?v=d6e06a3ad2';
import { fsR12PrintDate, fsR12HasNearExpiry, fsR5BatchText, fsR5Class } from './controlled-expiry-format.js?v=7370bbb9a3';

function fsR5PublicUrl(dept){
  try{if(typeof window.ctlPublicUrl==='function')return window.ctlPublicUrl(dept)}catch(e){/* an optional source that is not loaded in this session */}
  var url=new URL(location.origin+location.pathname);url.searchParams.set('view','controlled-expiry');url.searchParams.set('dept',dept);var tenant=window.fsTenantId&&fsTenantId();if(tenant)url.searchParams.set('tenant',tenant);return url.toString();
}
function fsR5PrintSettings(dept){try{if(typeof window.ctlPrintSettings==='function')return window.ctlPrintSettings(dept)||{}}catch(e){/* an optional source that is not loaded in this session */}return {}}
/* Arabic department name for the printed heading.
 *
 * Resolved by module 83, which keeps the mapping as master-editable state keyed by
 * department id and falls back to a seed table for departments that have not been
 * given one yet. A department with no Arabic name prints its English heading only,
 * so adding a department never breaks a printout. */
function fsDeptNameAr(deptId,englishName){
  return typeof window.fsDeptPrintNameAr==='function'
    ? window.fsDeptPrintNameAr(deptId,englishName)
    : '';
}

function fsR5ControlledPrintHtml(dept,rows){
  var effective=(typeof window.fsEffectiveUser==='function'?window.fsEffectiveUser():window.CU||{});
  var name=window.floorstockDepartmentName({
    id:dept,
    name:effective.deptName||effective.departmentName
  });
  var settings=fsR5PrintSettings(dept);
  var url=fsR5PublicUrl(dept);
  var official=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var printInfo=fsR12PrintDate();
  var qr=window.makeReadableQR(url);

  var body=rows.map(function(row,index){
    var near=fsR12HasNearExpiry(row.batches,30,printInfo.dayUtc);
    return '<tr class="custody-row'+(near?' near-expiry-30':'')+'">'+
      '<td>'+(index+1)+'</td>'+
      '<td>'+fsEsc(row.moh||'—')+'</td>'+
      '<td>'+fsEsc(row.nupco||'—')+'</td>'+
      '<td class="medicine">'+fsEsc(row.name)+'</td>'+
      '<td>'+fsEsc(fsR5Class(row.classification))+'</td>'+
      '<td>'+fsEsc(row.required)+'</td>'+
      '<td>'+fsEsc(row.actual)+'</td>'+
      '<td class="batch">'+fsR5BatchText(row.batches,true,row.actual)+'</td>'+
    '</tr>';
  }).join('');

  var signatures=[
    ['Head Nurse / رئيس التمريض',settings.nursingHead||''],
    ['Controlled Medicines Officer / مسؤول الأدوية المخدرة والمقيدة',
      settings.controlledOfficer||settings.controlledPharmacyOfficer||''],
    ['Pharmacy Manager / مدير الصيدلية',settings.pharmacyManager||'']
  ].map(function(signature){
    return '<div class="signature"><b>'+fsEsc(signature[0])+'</b>'+
      '<span>'+fsEsc(signature[1]||'')+'</span></div>';
  }).join('');

  var css=`@page{size:A4 landscape;margin:6mm}
*{
  box-sizing:border-box;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
html,body{
  margin:0!important;
  padding:0!important;
  width:100%!important;
  height:100%!important;
  overflow:hidden!important;
  background:#fff!important;
  color:#000!important;
  font-family:Arial,Tahoma,sans-serif;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
body{position:fixed!important;inset:0!important}
.sheet{position:fixed;inset:0;overflow:hidden;background:#fff}
.controlled-layout{
  position:absolute;
  top:0;
  left:0;
  overflow:hidden;
  background:#fff;
  padding:1mm;
  --fs:7.6pt;
  --py:.8mm;
  --qr:22mm
}
.landscape-layout{width:291mm;height:204mm;display:block}
.portrait-layout{width:204mm;height:291mm;display:none}
.fit{width:100%;transform-origin:top left}
.official-print-header{margin-bottom:2mm!important}
.document-head{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--qr);
  gap:2mm;
  align-items:center;
  min-height:20mm;
  border-bottom:1.4px solid #000;
  margin-bottom:.8mm
}
.titles{text-align:center}
.titles h1{font-size:13pt;margin:0}
.titles h2{font-size:10pt;margin:.6mm 0}
.titles h3{font-size:8.2pt;margin:0}.titles h3 .h3-ar{font-weight:700;direction:rtl}.titles h3 .h3-en{font-weight:600;margin-top:1pt}
.qr{width:var(--qr);height:var(--qr);justify-self:end;object-fit:contain}
.print-legend{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:3mm;
  margin:0 0 .8mm;
  padding:.45mm .8mm;
  border:1px solid #000;
  font-size:5.9pt;
  line-height:1.15;
  break-inside:avoid
}
.legend-item{display:flex;align-items:center;gap:1mm}
.legend-swatch{
  display:inline-block;
  width:4mm;
  height:3mm;
  background:#000!important;
  border:1px solid #000;
  flex:0 0 auto
}
.print-date{white-space:nowrap;font-weight:700}
table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:var(--fs)
}
thead{display:table-header-group}
tr{break-inside:avoid}
th,td{
  border:1px solid #000;
  padding:var(--py) .8mm;
  line-height:1.1;
  text-align:center;
  vertical-align:middle;
  overflow-wrap:anywhere
}
th{font-weight:900}
.medicine{text-align:center;font-weight:800}
.batch{text-align:center}
.ctl-batch-print-line{display:block;padding:.18mm 0;text-align:center}
.near-expiry-30 td{
  font-weight:700!important;
  background:#f0f0f0!important;
  background-color:#f0f0f0!important;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
.near-expiry-30 td:first-child{
  border-left:3px solid #000!important
}
.near-expiry-30 .ctl-batch-print-line{
  font-weight:900!important;
  text-decoration:underline
}
.signatures{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:5mm;
  margin-top:2.5mm
}
.signature{
  border-top:1px solid #000;
  text-align:center;
  padding-top:.8mm;
  min-height:8mm;
  font-size:6.2pt
}
.signature b,.signature span{display:block}
.electronic-certification{
  margin-top:1.6mm;
  padding-top:.9mm;
  border-top:.7px solid #777;
  text-align:center;
  font-size:5.7pt;
  line-height:1.35;
  font-weight:700;
  color:#000!important;
  -webkit-text-fill-color:#000!important;
  break-inside:avoid;
  page-break-inside:avoid;
  forced-color-adjust:none!important;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
.electronic-certification .cert-ar{
  display:block;
  direction:rtl;
  unicode-bidi:plaintext
}
.electronic-certification .cert-en{
  display:block;
  direction:ltr;
  unicode-bidi:plaintext
}
.footer{text-align:center;font-size:5.8pt;margin-top:.7mm}
.brand{text-align:right;font-size:5.5pt;color:#94a3b8;margin-top:.5mm}
.print-error{padding:15mm;text-align:center}
@media print and (orientation:landscape){
  .landscape-layout{display:block!important}
  .portrait-layout{display:none!important}
}
@media print and (orientation:portrait){
  .landscape-layout{display:none!important}
  .portrait-layout{display:block!important}
}
@media screen and (orientation:landscape){
  body{background:#d5d5d5!important}
  .landscape-layout{display:block!important;visibility:visible!important}
  .portrait-layout{display:none!important}
}
@media screen and (orientation:portrait){
  body{background:#d5d5d5!important}
  .landscape-layout{display:none!important}
  .portrait-layout{display:block!important;visibility:visible!important}
}`;

  var legend=
    '<div class="print-legend">'+
      '<div class="legend-item"><span class="legend-swatch"></span>'+
        '<span>Expiry within 30 days / قريب الانتهاء خلال 30 يومًا</span></div>'+
      '<div class="print-date">Print date / تاريخ الطباعة: '+
        fsEsc(printInfo.text)+'</div>'+
    '</div>';

  var content='<div class="fit">'+official+
    '<header class="document-head">'+
      '<div class="titles">'+
        '<h1>Controlled and Restricted Medicines List</h1>'+
        '<h2>قائمة الأدوية المخدرة والمقيدة</h2>'+
        '<h3>'+(function(){var ar=fsDeptNameAr(dept,name);return ar?'<div class="h3-ar">عهدة قسم '+fsEsc(ar)+'</div>':''})()+'<div class="h3-en">'+fsEsc(name)+' Department Controlled List</div></h3>'+
      '</div>'+
      '<img class="qr asd-qr-image" src="'+fsEsc(qr)+'" alt="Live controlled list QR">'+
    '</header>'+
    legend+
    '<table>'+
      '<colgroup>'+
        '<col style="width:3%"><col style="width:8%"><col style="width:8%">'+
        '<col style="width:32%"><col style="width:10%"><col style="width:6%">'+
        '<col style="width:6%"><col style="width:27%">'+
      '</colgroup>'+
      '<thead><tr>'+
        '<th>#</th><th>MOH</th><th>NUPCO</th><th>Medicine / الدواء</th>'+
        '<th>Class / التصنيف</th><th>Required / المطلوب</th>'+
        '<th>Actual / الفعلي</th><th>Qty · Expiry / الكمية والانتهاء</th>'+
      '</tr></thead>'+
      '<tbody>'+body+'</tbody>'+
    '</table>'+
    '<div class="signatures">'+signatures+'</div>'+
    '<div class="electronic-certification">'+
      '<span class="cert-ar">هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم</span>'+
      '<span class="cert-en">This list is electronically approved and certified and does not require a stamp.</span>'+
    '</div>'+
    '<div class="footer">Live list: '+fsEsc(url)+'</div>'+
    '<div class="brand">By Ali Abudahash</div>'+
  '</div>';

  var runtime=`(function(){
function imagesReady(){
  return Promise.all(Array.from(document.images).map(function(image){
    var qr=image.classList.contains('asd-qr-image');
    if(qr&&/^data:image\/svg\+xml/i.test(image.getAttribute('src')||''))return Promise.reject(new Error('QR generator returned a placeholder'));
    if(image.complete)return image.naturalWidth>0?Promise.resolve():(qr?Promise.reject(new Error('QR image failed to decode')):Promise.resolve());
    return new Promise(function(resolve,reject){
      image.onload=resolve;
      image.onerror=function(){qr?reject(new Error('QR image failed to load')):resolve()};
      setTimeout(function(){qr?reject(new Error('QR image load timed out')):resolve()},5000);
    });
  }));
}
function showQrFailure(error){
  document.body.dataset.qrPrint='failed';
  document.querySelectorAll('img.asd-qr-image').forEach(function(image){if(/^data:image\/svg\+xml/i.test(image.getAttribute('src')||''))image.style.display='none'});
  var box=document.createElement('div');box.className='print-error';box.innerHTML='<h2>QR generation failed / تعذر إنشاء رمز QR</h2><p>Automatic printing stopped because the QR would not be scannable.<br>تم إيقاف الطباعة التلقائية لأن الرمز لن يكون قابلاً للمسح.</p><button type="button">Print without QR / طباعة بدون QR</button>';box.querySelector('button').onclick=function(){window.focus();window.print()};document.body.insertBefore(box,document.body.firstChild);console.error(error);
}
function over(layout,fit){
  return fit.scrollHeight>layout.clientHeight+1||
    fit.scrollWidth>layout.clientWidth+1;
}
function fitOne(layout){
  var fit=layout.querySelector('.fit');
  var orientation=layout.dataset.orientation;
  var font=orientation==='landscape'?7.6:6.7;
  var padding=orientation==='landscape'?.8:.5;
  var qr=orientation==='landscape'?22:17;
  var fontMax=orientation==='landscape'?15:13;
  var guard=0;

  layout.style.display='block';
  layout.style.visibility='hidden';
  fit.style.transform='none';
  layout.style.setProperty('--fs',font+'pt');
  layout.style.setProperty('--py',padding+'mm');
  layout.style.setProperty('--qr',qr+'mm');
  void fit.offsetHeight;

  while(over(layout,fit)&&guard<100){
    if(font>(orientation==='landscape'?5:4.6)){
      font=Math.max(orientation==='landscape'?5:4.6,font-.18);
      layout.style.setProperty('--fs',font+'pt');
    }else if(padding>.16){
      padding=Math.max(.16,padding-.05);
      layout.style.setProperty('--py',padding+'mm');
    }else if(qr>(orientation==='landscape'?13:10)){
      qr--;
      layout.style.setProperty('--qr',qr+'mm');
    }else{
      break;
    }
    void fit.offsetHeight;
    guard++;
  }

  // Short custody lists (few medicines) used to stay at the small base font even
  // though most of the A4 sheet was empty underneath — the layout only ever
  // shrank to fit, never grew to fill real headroom. Grow the font (and QR/
  // padding to match) step by step while there's still room, so a short list
  // reads clearly at a glance instead of looking unfinished in a corner.
  guard=0;
  while(!over(layout,fit)&&font<fontMax&&guard<100){
    var nextFont=Math.min(fontMax,font+.2);
    layout.style.setProperty('--fs',nextFont+'pt');
    void fit.offsetHeight;
    if(over(layout,fit)){
      layout.style.setProperty('--fs',font+'pt');
      void fit.offsetHeight;
      break;
    }
    font=nextFont;
    guard++;
  }
  guard=0;
  var qrMax=orientation==='landscape'?30:24;
  while(!over(layout,fit)&&qr<qrMax&&guard<60){
    qr++;
    layout.style.setProperty('--qr',qr+'mm');
    void fit.offsetHeight;
    if(over(layout,fit)){
      qr--;
      layout.style.setProperty('--qr',qr+'mm');
      void fit.offsetHeight;
      break;
    }
    guard++;
  }

  var widthRatio=(layout.clientWidth-2)/Math.max(1,fit.scrollWidth);
  var heightRatio=(layout.clientHeight-2)/Math.max(1,fit.scrollHeight);
  var scale=Math.min(widthRatio,heightRatio,1.06);
  if(!isFinite(scale)||scale<=0)scale=1;
  fit.style.transform='scale('+scale+')';

  var expected=Number(layout.dataset.expected||0);
  var actual=layout.querySelectorAll('.custody-row').length;
  if(expected===0||actual!==expected){
    layout.innerHTML='<div class="print-error"><h2>Controlled list integrity check failed</h2>'+
      '<p>Expected '+expected+' rows; rendered '+actual+'.</p></div>';
    layout.dataset.failed='1';
  }else{
    layout.dataset.ready='1';
    layout.dataset.scale=String(scale);
    layout.dataset.font=String(font);
  }

  layout.style.removeProperty('display');
  layout.style.removeProperty('visibility');
}
function fitAll(){
  var layouts=Array.from(document.querySelectorAll('.controlled-layout'));
  layouts.forEach(fitOne);
  if(layouts.some(function(layout){return layout.dataset.failed==='1'})){
    document.body.dataset.failed='1';
    return;
  }
  document.body.dataset.ready='1';
}
function start(){
  imagesReady().then(function(){
    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(function(){
        fitAll();
        if(document.body.dataset.ready==='1'){
          setTimeout(function(){window.focus();window.print()},180);
        }
      },function(){
        fitAll();
        if(document.body.dataset.ready==='1'){
          setTimeout(function(){window.focus();window.print()},180);
        }
      });
    }else{
      fitAll();
      if(document.body.dataset.ready==='1'){
        setTimeout(function(){window.focus();window.print()},180);
      }
    }
  }).catch(showQrFailure);
}
window.addEventListener('load',start,{once:true});
})();`;

  function layoutHtml(orientation){
    var label=orientation==='landscape'?'landscape-layout':'portrait-layout';
    return '<section class="controlled-layout '+label+
      '" data-orientation="'+orientation+
      '" data-expected="'+rows.length+'">'+content+'</section>';
  }

  return '<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+fsEsc(name)+' Department Controlled List</title>'+
    '<style>'+css+'</style></head><body>'+
    '<main class="sheet">'+layoutHtml('landscape')+layoutHtml('portrait')+'</main>'+
    '<script>'+runtime+'<\/script></body></html>';
}
function openBlobPrintR5(html){
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var w=window.open(url,'_blank');
  setTimeout(function(){URL.revokeObjectURL(url);},60000);
  return !!w;
}
window.printDepartmentCustodyExact=async function(dept,options){
  options=options||{};
  dept=fsText(dept||fsR5ControlledDept(),'');
  if(options.printWindow){try{options.printWindow.close();}catch(e){/* tearing down something already gone is not a failure */}}
  try{
    var result=await fsLoginTimeout(fsR5ControlledRows(dept),18000,'Controlled custody print data timed out.');
    if(!result.rows||!result.rows.length){
      uiToast('My controlled list is empty / قائمة عهدتي فارغة','err');
      return false;
    }
    openBlobPrintR5(fsR5ControlledPrintHtml(result.dept||dept,result.rows));
    setTimeout(function(){
      try{
        if(typeof window.ctlPublishDept==='function')Promise.resolve(window.ctlPublishDept(result.dept||dept)).catch(function(error){console.warn('Background controlled public publish skipped.',error);});
      }catch(error){/* an optional source that is not loaded in this session */}
    },0);
    return true;
  }catch(error){
    console.error('Controlled list print failed',error);
    uiToast('Unable to prepare My controlled list: '+String(error&&error.message||error),'err');
    return false;
  }
};
window.ctlConfirmDepartmentPrint=async function(event){
  if(event&&typeof event.preventDefault==='function')event.preventDefault();
  var dept=fsR5ControlledDept();
  if(!dept)return uiToast('Department is not assigned / لم يتم تحديد القسم','err');
  return window.printDepartmentCustodyExact(dept,{});
};
window.printControlledCurrent=function(){return window.ctlConfirmDepartmentPrint()};
window.finalControlledPrintRun=function(){return window.ctlConfirmDepartmentPrint()};
window.ctlOpenDepartmentPrintOptions=function(){return window.ctlConfirmDepartmentPrint()};

/* Bound in HTML and called by other modules under all four names. */
Object.assign(globalThis,{
  printDepartmentCustodyExact: globalThis.printDepartmentCustodyExact,
  ctlConfirmDepartmentPrint: globalThis.ctlConfirmDepartmentPrint,
  fsR5ControlledPrintHtml
});

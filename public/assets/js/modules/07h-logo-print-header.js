import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

// ── LOGO / OFFICIAL PRINT HEADER ─────────────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, el, toast, window.fsPrepareImageDataUrl) is already
// published to globalThis by its owning module.
//
// openBlobPrint was NEVER actually in the original __asdhLegacyApi
// object (a pre-existing gap only invisible because every function lived
// in one shared file scope) even though 07e-dept-drug-list-print.js and
// 07f-shelves.js both call it as a bare global — publishing it here for
// the first time is a real fix, not just a mechanical move.
function getLogo(){
  var data=S.g('facility_logo')||{};
  var legacy=Array.isArray(data.lines)?data.lines.slice(0,4):[data.name||'','','',''];
  while(legacy.length<4)legacy.push('');
  var english=Array.isArray(data.enLines)?data.enLines.slice(0,4):[];
  // If arLines not saved (old format), default to empty — officialPrintHeaderHTML will mirror English.
  var arabic=Array.isArray(data.arLines)?data.arLines.slice(0,4):['','','',''];
  while(english.length<4)english.push('');
  while(arabic.length<4)arabic.push('');
  return {
    img:data.img||'',
    enLines:english,
    arLines:arabic,
    lines:english,
    name:english[0]||arabic[0]||''
  };
}
function setLogoData(obj){return S.s('facility_logo',obj)}
function openLogoSettings(){
  if(!CU||CU.master!==true)return toast('Print header settings are available to Master only.','err');
  var header=getLogo(),img=el('logo-preview-img'),none=el('logo-preview-none');
  img.dataset.pending='';
  if(header.img){
    img.src=header.img;
    img.style.display='';
    none.style.display='none';
  }else{
    img.src='';
    img.style.display='none';
    none.style.display='';
  }
  for(var i=1;i<=4;i++){
    el('print-header-en'+i).value=header.enLines[i-1]||'';
    el('print-header-ar'+i).value=header.arLines[i-1]||'';
  }
  OM('mlogo');
}
function handleLogoDrop(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleLogoFile(f)}
async function handleLogoFile(file){if(!file)return;try{var data=await window.fsPrepareImageDataUrl(file),img=el('logo-preview-img');img.src=data;img.style.display='';el('logo-preview-none').style.display='none';img.dataset.pending=data}catch(error){var input=el('logo-file-inp');if(input)input.value='';toast(String(error&&error.message||error),'err')}}
async function saveLogo(){
  if(!CU||CU.master!==true)return toast('Master only','err');
  var img=el('logo-preview-img'),logoData=img.dataset.pending||img.getAttribute('src')||'';
  if(logoData&&!logoData.startsWith('data:')&&!logoData.startsWith('http'))logoData='';
  var english=[],arabic=[];
  for(var i=1;i<=4;i++){
    english.push((el('print-header-en'+i).value||'').trim());
    arabic.push((el('print-header-ar'+i).value||'').trim());
  }
  await setLogoData({
    img:logoData,
    enLines:english,
    arLines:arabic,
    lines:english,
    name:english[0]||arabic[0]||''
  });
  toast('Official print header saved ✓','succ');
  CM('mlogo');
}
async function clearLogo(){
  var old=getLogo();
  await setLogoData({
    img:'',
    enLines:old.enLines,
    arLines:old.arLines,
    lines:old.enLines,
    name:old.enLines[0]||old.arLines[0]||''
  });
  var img=el('logo-preview-img');
  img.src='';
  img.style.display='none';
  img.dataset.pending='';
  el('logo-preview-none').style.display='';
  toast('Logo removed; header text retained','info');
}
function officialPrintHeaderHTML(){
  var header=getLogo();
  var english=header.enLines.filter(function(value){return String(value||'').trim();});
  var arabic=header.arLines.filter(function(value){return String(value||'').trim();});
  // No hardcoded defaults — if Arabic is empty but English is set, mirror English for Arabic.
  if(!arabic.length&&english.length)arabic=english.slice();
  function headerEscape(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(character){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }
  function rows(values,direction){
    return values.map(function(value,index){
      return '<div style="font-size:'+(index===0?'11':'8.5')+'pt;font-weight:'+(index===0?'800':'600')+
        ';line-height:1.35;white-space:normal;overflow-wrap:anywhere">'+headerEscape(value)+'</div>';
    }).join('');
  }
  return '<div class="official-print-header" style="display:grid;grid-template-columns:minmax(0,1fr) 34mm minmax(0,1fr);gap:5mm;align-items:center;border-bottom:2px solid #222;padding:0 0 3mm;margin:0 0 3mm;min-height:27mm">'+
    '<div dir="ltr" style="text-align:left">'+rows(english,'ltr')+'</div>'+
    '<div style="display:flex;align-items:center;justify-content:center">'+
      (header.img?'<img src="'+headerEscape(header.img)+'" alt="Official logo" style="max-width:31mm;max-height:25mm;object-fit:contain">':'')+
    '</div>'+
    '<div dir="rtl" style="text-align:right">'+rows(arabic,'rtl')+'</div>'+
  '</div>';
}
function openBlobPrint(fullHtml){
  var blob=new Blob([fullHtml],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var pw=window.__preOpenedPW;
  if(pw&&!pw.closed){
    window.__preOpenedPW=null;
    pw.location.href=url;
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    return pw;
  }
  var w=window.open(url,'_blank','width=1100,height=850');
  setTimeout(function(){URL.revokeObjectURL(url)},60000);
  if(!w){window.toast&&window.toast('Allow pop-ups to print.','err');}
  return w;
}
window.fsOfficialPrint=function(opts){
  var title=String(opts&&opts.title||'ASDHealth');
  var html=String(opts&&opts.html||'');
  var css=String(opts&&opts.css||'');
  var hdr=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var brand='<div style="text-align:center;font-size:8.5pt;color:#555;margin-top:14px">By Ali Abudahash</div>';
  var pcss='@page{size:A4;margin:10mm}body{font-family:Arial,Tahoma,sans-serif;background:#fff;color:#111;margin:0}'+css;
  var autoprint='<script>(function(){var d=false;function g(){if(d)return;d=true;window.focus();window.print()}if(document.readyState==="complete")setTimeout(g,300);else window.addEventListener("load",function(){setTimeout(g,300)},{once:true})})()</sc'+'ript>';
  openBlobPrint('<!doctype html><html><head><meta charset="utf-8"><title>'+title.replace(/</g,'&lt;')+'</title><style>'+pcss+'</style></head><body>'+hdr+html+brand+autoprint+'</body></html>');
};


publishLegacy("07h-logo-print-header.js", {
  getLogo,
  setLogoData,
  openLogoSettings,
  handleLogoDrop,
  handleLogoFile,
  saveLogo,
  clearLogo,
  officialPrintHeaderHTML,
  openBlobPrint,
});

export {};

(function(){
'use strict';

var FALLBACK_LABEL='QR unavailable / رمز QR غير متاح';
var warned=false;

function escapeXml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(character){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character];
  });
}

function placeholderDataUrl(label){
  var text=String(label||FALLBACK_LABEL);
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">'+
    '<rect width="360" height="360" fill="#fff" stroke="#111" stroke-width="8"/>'+
    '<path d="M42 42h82v82H42zm194 0h82v82h-82zM42 236h82v82H42z" fill="none" stroke="#111" stroke-width="12"/>'+
    '<text x="180" y="178" text-anchor="middle" font-family="Arial,Tahoma,sans-serif" font-size="20" font-weight="700" fill="#111">QR unavailable</text>'+
    '<text x="180" y="210" text-anchor="middle" font-family="Arial,Tahoma,sans-serif" font-size="18" fill="#111">'+escapeXml(text.indexOf('/')>=0?'رمز QR غير متاح':text)+'</text>'+
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

function reportFailure(error){
  if(warned)return;
  warned=true;
  try{console.warn('Local QR generation is unavailable; printing will continue without a scannable QR code.',error)}catch(ignore){}
}

function createCode(text,options){
  options=options||{};
  if(typeof window.qrcode!=='function')throw new Error('The local QR generator did not initialize.');
  var code=window.qrcode(0,String(options.errorCorrection||'H').toUpperCase());
  code.addData(String(text==null?'':text),'Byte');
  code.make();
  return code;
}

function createQrDataUrl(text,options){
  options=options||{};
  try{
    var code=createCode(text,options);
    var cellSize=Math.max(2,Number(options.cellSize)||6);
    var margin=Math.max(2,Number(options.margin)||4);
    return code.createDataURL(cellSize,margin);
  }catch(error){
    reportFailure(error);
    return placeholderDataUrl(options.fallbackLabel||FALLBACK_LABEL);
  }
}

function isPlaceholder(source){
  return /^data:image\/svg\+xml/i.test(String(source||''));
}

function createQrSvg(text,options){
  options=options||{};
  try{
    var code=createCode(text,options);
    return code.createSvgTag({
      cellSize:Math.max(2,Number(options.cellSize)||6),
      margin:Math.max(2,Number(options.margin)||4),
      scalable:true,
      alt:{text:String(options.alt||'QR code')},
      title:{text:String(options.title||'QR code')}
    });
  }catch(error){
    reportFailure(error);
    return '<div class="asd-qr-unavailable" role="img" aria-label="'+escapeXml(options.alt||FALLBACK_LABEL)+'">'+escapeXml(FALLBACK_LABEL)+'</div>';
  }
}

function imageMarkup(text,options){
  options=options||{};
  var source=createQrDataUrl(text,options);
  var width=Math.max(24,Number(options.width)||120);
  var height=Math.max(24,Number(options.height)||width);
  return '<img class="asd-qr-image" data-qr-state="'+(isPlaceholder(source)?'unavailable':'ready')+'" src="'+escapeXml(source)+'" width="'+width+'" height="'+height+'" alt="'+escapeXml(options.alt||'QR code')+'">';
}

function renderQr(target,text,options){
  var element=typeof target==='string'?document.querySelector(target):target;
  if(!element)return false;
  options=options||{};
  if(element.tagName==='IMG'){
    element.classList.add('asd-qr-image');
    element.src=createQrDataUrl(text,options);
    element.dataset.qrState=isPlaceholder(element.src)?'unavailable':'ready';
    element.alt=String(options.alt||'QR code');
    return true;
  }
  element.innerHTML=imageMarkup(text,options);
  return true;
}

function printRuntimeScript(options){
  options=options||{};
  var closeAfter=options.closeAfter===true;
  var timeout=Math.max(1000,Number(options.timeout)||5000);
  return '(function(){var printed=false,timeout='+JSON.stringify(timeout)+',closeAfter='+JSON.stringify(closeAfter)+';'+
    'function unavailable(img){return img.dataset.qrState==="unavailable"||/^data:image\\/svg\\+xml/i.test(img.getAttribute("src")||"")}'+
    'function fail(message){document.body.dataset.qrPrint="failed";var imgs=Array.from(document.querySelectorAll("img.asd-qr-image"));imgs.forEach(function(img){if(unavailable(img))img.style.display="none"});var box=document.getElementById("asd-qr-print-error");if(!box){box=document.createElement("div");box.id="asd-qr-print-error";box.setAttribute("role","alert");box.style.cssText="margin:12px;padding:12px;border:2px solid #b42318;background:#fff1f0;color:#7a271a;font:700 13px Arial;text-align:center";box.innerHTML="QR generation failed; automatic printing was stopped because the code would not be scannable.<br>تعذر إنشاء رمز QR، وتم إيقاف الطباعة التلقائية لأن الرمز لن يكون قابلاً للمسح.<br><button type=\\"button\\" style=\\"margin-top:8px;padding:7px 12px\\">Print without QR / طباعة بدون QR</button>";document.body.insertBefore(box,document.body.firstChild);box.querySelector("button").onclick=function(){window.focus();window.print()}}console.error(message||"Printable QR unavailable")}'+
    'function ready(img){return new Promise(function(resolve,reject){if(unavailable(img))return reject(new Error("QR generator returned a placeholder"));if(img.complete)return img.naturalWidth>0?resolve():reject(new Error("QR image failed to decode"));var done=false,timer=setTimeout(function(){if(done)return;done=true;reject(new Error("QR image load timed out"))},timeout);img.addEventListener("load",function(){if(done)return;done=true;clearTimeout(timer);img.naturalWidth>0?resolve():reject(new Error("QR image failed to decode"))},{once:true});img.addEventListener("error",function(){if(done)return;done=true;clearTimeout(timer);reject(new Error("QR image failed to load"))},{once:true})})}'+
    'function start(){var manual=document.querySelector("[data-qr-print-button]");if(manual){manual.disabled=true;manual.onclick=null}var imgs=Array.from(document.querySelectorAll("img.asd-qr-image"));if(!imgs.length)return fail("No QR image was rendered");Promise.all(imgs.map(ready)).then(function(){document.body.dataset.qrPrint="ready";if(manual){manual.disabled=false;manual.onclick=function(){window.focus();window.print()}}if(printed)return;printed=true;setTimeout(function(){window.focus();window.print();if(closeAfter)setTimeout(function(){window.close()},50)},100)}).catch(function(error){fail(error&&error.message)})}'+
    'if(document.readyState==="complete")start();else window.addEventListener("load",start,{once:true})})();';
}

var api=Object.freeze({
  dataUrl:createQrDataUrl,
  svg:createQrSvg,
  imageMarkup:imageMarkup,
  render:renderQr,
  placeholderDataUrl:placeholderDataUrl,
  isPlaceholder:isPlaceholder,
  printRuntimeScript:printRuntimeScript,
  available:function(){return typeof window.qrcode==='function'}
});

window.ASD_QR=api;
window.makeReadableQR=createQrDataUrl;
})();
export {};

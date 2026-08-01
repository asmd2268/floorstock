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
  return '<img class="asd-qr-image" src="'+escapeXml(source)+'" width="'+width+'" height="'+height+'" alt="'+escapeXml(options.alt||'QR code')+'">';
}

function renderQr(target,text,options){
  var element=typeof target==='string'?document.querySelector(target):target;
  if(!element)return false;
  options=options||{};
  if(element.tagName==='IMG'){
    element.classList.add('asd-qr-image');
    element.src=createQrDataUrl(text,options);
    element.alt=String(options.alt||'QR code');
    return true;
  }
  element.innerHTML=imageMarkup(text,options);
  return true;
}

var api=Object.freeze({
  dataUrl:createQrDataUrl,
  svg:createQrSvg,
  imageMarkup:imageMarkup,
  render:renderQr,
  placeholderDataUrl:placeholderDataUrl,
  available:function(){return typeof window.qrcode==='function'}
});

window.ASD_QR=api;
window.makeReadableQR=createQrDataUrl;
})();
export {};

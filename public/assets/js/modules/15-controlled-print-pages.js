(function(){

  window.ctlPrintHTML=function(title,body,preparedWindow){
    var w=preparedWindow||window.open('','_blank');
    if(!w){toast('Allow pop-ups to print.','err');return null}
    try{
      w.document.open();
      w.document.write('<!doctype html><html dir="ltr"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+
        '@page{size:A4 landscape;margin:5mm}'+
        '*{box-sizing:border-box}html,body{width:100%;height:auto!important;max-height:none!important;margin:0;padding:0;overflow:visible!important;direction:ltr!important}'+
        'body{font-family:Arial,Tahoma,sans-serif;color:#111;text-align:left;padding:0}'+
        '.print-page{width:100%;height:auto!important;max-height:none!important;max-width:none;margin:0;overflow:visible!important;transform:none!important}'+
        'h1,h2{text-align:center;margin:2px 0;direction:ltr}'+
        '.head{display:grid;grid-template-columns:105px minmax(0,1fr) 105px;align-items:center;width:100%;gap:8px;break-inside:avoid;page-break-inside:avoid}'+
        '.logo{max-width:95px;max-height:68px}.qr{width:88px;height:88px}'+
        '.printed-date{text-align:left;font-size:9px;margin:4px 0 6px;direction:ltr}'+
        'table{width:100%!important;max-width:none;border-collapse:collapse;table-layout:auto;margin:6px 0 0;direction:ltr!important;page-break-inside:auto;break-inside:auto}'+
        'thead{display:table-header-group}tbody{display:table-row-group}tfoot{display:table-footer-group}'+
        'tr{page-break-inside:avoid!important;break-inside:avoid!important}'+
        'th,td{border:1px solid #333;padding:4px 5px;text-align:left!important;font-size:9.5px;line-height:1.25;direction:ltr!important;vertical-align:middle}'+
        'th{background:#e8eef7;font-weight:700}'+
        'th:first-child,td:first-child{width:30px;text-align:center!important}'+
        '.med{width:auto!important;min-width:230px;text-align:left!important;font-weight:bold}'+
        '.expiry{text-align:left!important;line-height:1.45;white-space:normal;overflow:visible!important}'+
        '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:16px;direction:ltr;page-break-inside:avoid!important;break-inside:avoid!important}'+
        '.sig{text-align:center;border-top:1px solid #222;padding-top:5px;margin-top:24px;page-break-inside:avoid;break-inside:avoid}'+
        '.electronic-cert{margin-top:10px;padding:6px;border:1px solid #333;text-align:center;font-size:9px;font-weight:bold;page-break-inside:avoid;break-inside:avoid}'+
        '.by{font-size:8px;text-align:center;margin-top:8px;page-break-inside:avoid;break-inside:avoid}.handover{margin:8px 0;padding:7px;border:1px solid #444;page-break-inside:avoid;break-inside:avoid}.ltr{direction:ltr!important}'+
        '@media print{html,body,.print-page{height:auto!important;max-height:none!important;overflow:visible!important}table{page-break-inside:auto!important;break-inside:auto!important}thead{display:table-header-group!important}tr{page-break-inside:avoid!important;break-inside:avoid!important}}'+
        '</style></head><body><div class="print-page">'+officialPrintHeaderHTML()+body+'<div class="electronic-cert">هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم<br>This list is electronically approved and certified and does not require a stamp.</div><div class="by">By Ali Abudahash</div></div><script>(function(){var fired=false;function go(){if(fired)return;fired=true;try{window.focus()}catch(e){}window.print()}window.addEventListener("load",function(){setTimeout(go,250)},{once:true});setTimeout(go,1800)})();<\/script></body></html>');
      w.document.close();
      return w
    }catch(err){
      try{w.document.open();w.document.write('<!doctype html><html><body style="font-family:Arial;padding:24px"><h2>Print failed / تعذر تجهيز الطباعة</h2><pre>'+String(err&&err.message||err).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'</pre></body></html>');w.document.close()}catch(e){}
      throw err
    }
  };
})();
export {};

import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

// ── DEPT DRUG LIST PRINT ────────────────────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, el, gd, getMeds, getExpiry, fmtDate, deptName,
// officialPrintHeaderHTML, openBlobPrint) is already published to
// globalThis by its owning module.
function renderDeptPrint(){
  if(!CU||CU.role!=='department')return;
  el('deptprint-sub').textContent=CU.deptName+' — Drug List';
  el('deptprint-preview').innerHTML='<div style="color:var(--tx2);font-size:13px">Configure options above and click <b>Print</b>.</div>';
}
async function doDeptPrint(){
  if(!CU)return;

  try{
    var deptId=String(CU.deptId||'');
    var ms=getMeds(deptId);
    var expiryRows=getExpiry(deptId);

    try{
      var published=await syncPublicExpiry(deptId,expiryRows);
      if(!published){
        warnPublicSync(
          'Expiry data',
          new Error('Firebase authentication is unavailable.')
        );
      }
    }catch(syncError){
      warnPublicSync('Expiry data',syncError);
    }

    var fitOne=el('dpopt-pages').value==='fit';
    var includeExpiryDate=el('dpopt-expiry').value==='date-barcode';
    var today=fmtDate(nowISO());
    var deptName=CU.deptName;
    var userName=CU.username;
    var qrUrl=window.makeReadableQR(getAppUrl());
    var qrExpUrl=window.makeReadableQR(getPublicExpiryUrl(deptId));
    
    var expiryPrintBlock='<div style="text-align:center;max-width:260px;margin:18px auto 8px;padding:10px;border:1px solid #bbb;border-radius:6px;page-break-inside:avoid"><div style="font-size:8pt;font-weight:700;margin-bottom:5px">Expiry Monitor / متابعة الصلاحية</div><img class="asd-qr-image" src="'+qrExpUrl+'" width="110" height="110" alt="Expiry monitor QR code"><div style="font-size:7pt;color:#555;margin-top:3px">Scan to open the public expiry monitor</div></div>';

    var grp={};
    ms.forEach(function(m){
      if(!grp[m.category])grp[m.category]=[];
      grp[m.category].push(m);
    });

    var _cs=getComputedStyle(document.documentElement);
    var pClr={ha:_cs.getPropertyValue('--cls-ha-rgb').trim()||'239,68,68',haz:_cs.getPropertyValue('--cls-haz-rgb').trim()||'234,179,8',lasa:_cs.getPropertyValue('--cls-lasa-rgb').trim()||'14,165,233',ref:_cs.getPropertyValue('--cls-ref-rgb').trim()||'147,51,234'};
    var rows='';
    var medNumber=0;
    var catCfg=typeof getPharmacyCategoryConfig==='function'
      ?getPharmacyCategoryConfig(deptId)
      :{order:[]};
    var catOrder=catCfg.order||[];

    Object.keys(grp).sort(function(a,b){
      var ai=catOrder.indexOf(a),bi=catOrder.indexOf(b);
      if(ai<0)ai=999;
      if(bi<0)bi=999;
      return ai-bi||String(a).localeCompare(String(b));
    }).forEach(function(cat){
      rows+='<tr class="cat-row"><td colspan="6" style="background:#bcbcbc;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.5px;padding:4px 6px;border:1px solid #ccc">'+cat+' / '+catAr(cat)+'</td></tr>';
      grp[cat].forEach(function(m){
        medNumber++;
        var bands=[],flags=[];
        if(m.high_alert){bands.push('rgba('+pClr.ha+',.13)');flags.push('HIGH ALERT / تنبيه عالي')}
        if(m.hazard){bands.push('rgba('+pClr.haz+',.18)');flags.push('HAZARD / خطر')}
        if(m.lasa){bands.push('rgba('+pClr.lasa+',.13)');flags.push('LASA')}
        if(m.refrigerated){bands.push('rgba('+pClr.ref+',.13)');flags.push('REFRIGERATED / مبرد')}
        var bc=m.high_alert?('rgba('+pClr.ha+',1)'):m.hazard?('rgba('+pClr.haz+',1)'):m.lasa?('rgba('+pClr.lasa+',1)'):m.refrigerated?('rgba('+pClr.ref+',1)'):'transparent';
        var bg=bands.length<2
          ?(bands[0]||'#ffffff')
          :'linear-gradient(180deg,'+bands.map(function(c,i){
            var a=(i*100/bands.length).toFixed(2);
            var b=((i+1)*100/bands.length).toFixed(2);
            return c+' '+a+'% '+b+'%';
          }).join(',')+')';
        var flagTxt=flags.join(' + ');
        var flagColor=m.high_alert?('rgba('+pClr.ha+',1)'):m.hazard?('rgba('+pClr.haz+',1)'):m.lasa?('rgba('+pClr.lasa+',1)'):m.refrigerated?('rgba('+pClr.ref+',1)'):'#000';
        var medBatches=expiryRows.filter(function(batch){
          return String(batch.medId)===String(m.id);
        }).sort(function(a,b){
          return String(a.date||'').localeCompare(String(b.date||''));
        });
        var expText=medBatches.length
          ?medBatches.map(function(batch){
            return fmtDate(batch.date)+(batch.batch?' — '+batch.batch:'');
          }).join('<br>')
          :'—';
        if(includeExpiryDate){
          expText+='<div style="margin-top:4px;white-space:nowrap">Write-in / كتابة: ____/____/________</div>';
        }
        rows+='<tr style="background:'+bg+';border-left:3px solid '+bc+'">'
          +'<td style="padding:3px 5px;border:1px solid #ddd;text-align:center;font-weight:700">'+medNumber+'</td>'
          +'<td style="padding:3px 5px;border:1px solid #ddd;font-weight:500">'+m.name+'</td>'
          +'<td style="padding:3px 5px;border:1px solid #ddd;text-align:center;font-weight:700;color:'+flagColor+';font-size:6.5pt">'+flagTxt+'</td>'
          +'<td style="padding:3px 5px;border:1px solid #ddd;text-align:center;font-weight:700">'+m.min+'</td>'
          +'<td style="padding:3px 5px;border:1px solid #ddd;text-align:center;font-weight:700">'+m.max+'</td>'
          +'<td style="padding:3px 5px;border:1px solid #ddd;text-align:center;font-size:7pt;line-height:1.45">'+expText+'</td>'
          +'</tr>';
      });
    });

    var orientation=(el('dpopt-orientation')&&el('dpopt-orientation').value)==='portrait'
      ?'portrait':'landscape';
    var pageSize='A4 '+orientation;
    var pageStyle=fitOne
      ?'@page{size:'+pageSize+';margin:6mm} html,body{width:100%;min-height:100%;overflow:visible} body{transform:scale('+(orientation==='portrait'?'0.64':'0.78')+');transform-origin:top left;width:'+(orientation==='portrait'?'156.25%':'128.21%')+'}'
      :'@page{size:'+pageSize+';margin:8mm 8mm 18mm 8mm}';
    var footerNote=deptName+' — Floor Stock — '+today+
      ' — by: '+userName+' — Developed by Ali Abudahash';

    var dpHtml='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+deptName+' Drug List</title><style>'
      +pageStyle
      +'body{font-family:Arial,sans-serif;font-size:8.5pt;color:#000;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      +'.page-title{font-size:13pt;font-weight:700;margin-bottom:2px}'
      +'.page-sub{font-size:8.5pt;color:#333;margin-bottom:10px}'
      +'table{width:100%;border-collapse:collapse;font-size:8pt;table-layout:fixed}'
      +'th{background:#303030;color:#fff;padding:5px 6px;text-align:left;font-size:7.5pt;border:1px solid #000}'
      +'th.c{text-align:center}'
      +'.cat-row td{page-break-after:avoid}'
      +'tr{page-break-inside:avoid}'
      +'@media print{thead{display:table-header-group}}'
      +'</style></head><body>'
      +officialPrintHeaderHTML()
      +'<div style="position:relative;min-height:150px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #000">'
      +'<div style="text-align:center;padding:0 170px">'
      +'<div class="page-title">'+deptName+' — Floor Stock / أدوية القسم</div>'
      +'<div class="page-sub">Print Date / تاريخ الطباعة: <b>'+today+'</b> &nbsp;|&nbsp; Total / الإجمالي: <b>'+ms.length+'</b> &nbsp;|&nbsp; By / بواسطة: <b>'+userName+'</b></div>'
      +'<div style="font-size:7pt;color:#666;margin-top:3px">Developed by Ali Abudahash | ASDHealth System</div>'
      +'</div>'
      +'<div style="position:absolute;top:0;right:0;text-align:center"><img src="'+qrUrl+'" width="150" height="150" alt="System"><div style="font-size:5.5pt;color:#888">System</div></div>'
      +'</div>'
      +'<table><thead><tr>'
      +'<th class="c">#</th>'
      +'<th>Medication / الدواء</th>'
      +'<th>Classification / التصنيف</th>'
      +'<th class="c">Min / الأدنى</th>'
      +'<th class="c">Max / الأعلى</th>'
      +'<th class="c">Expiry dates / تواريخ الانتهاء</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
      +expiryPrintBlock
      +'<div id="footer" style="margin-top:20px;padding-top:8px;border-top:1px solid #ccc;font-size:7pt;color:#555;display:flex;justify-content:space-between;align-items:center">'
      +'<span>'+footerNote+'</span>'
      +'<img src="'+qrUrl+'" width="76" height="76" alt="QR">'
      +'</div>'
      +'<script>(function(){var done=false;function go(){if(done)return;done=true;if(!('+fitOne+')){var s=document.createElement("style");s.textContent="@media print{#footer{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:4px 10px;border-top:1px solid #ccc}}";document.head.appendChild(s)}window.focus();window.print()}if(document.readyState==="complete")setTimeout(go,300);else window.addEventListener("load",function(){setTimeout(go,300)},{once:true})})()</sc'+'ript>'
      +'</body></html>';
    var pw=openBlobPrint(dpHtml);
    if(!pw){toast('Allow pop-ups to print the department drug list.','err');return false;}
    if(typeof auditAction==='function')auditAction('drug_list_printed',{deptId:deptId,medCount:ms.length});
    return true;
  }catch(error){
    console.error('Department drug list print failed',error);
    toast('Could not prepare the department drug list: '+String(error&&error.message||error),'err');
    return false;
  }
}
function catAr(cat){
  var m={'Injections':'\u062D\u0642\u0646','Tablets':'\u062D\u0628\u0648\u0628','Inhalers':'\u0628\u062E\u0627\u062E\u0627\u062A','Syrups':'\u0634\u0631\u0627\u0628\u0627\u062A','Suppositories':'\u062A\u062D\u0627\u0645\u064A\u0644','Topical':'\u0645\u0648\u0636\u0639\u064A','Ointments & Drops':'\u0645\u0631\u0627\u0647\u0645 \u0648\u0642\u0637\u0631\u0627\u062A','Solutions':'\u0645\u062D\u0627\u0644\u064A\u0644'};
  return m[cat]||cat;
}



publishLegacy("07e-dept-drug-list-print.js", {
  renderDeptPrint,
  doDeptPrint,
  catAr,
});

export {};

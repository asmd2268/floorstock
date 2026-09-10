/* Print Orders: one A4 landscape page of the medicines dispensed against the
   selected requests, positive quantities only.

   Extracted from modules/51, where it sat beside the controlled-custody print
   and shared nothing with it but the word "print". The two produce different
   documents from different data for different readers, so they are two files.

   The page itself is not built here. `doPrint` hands the rows to
   public/print-orders.html through a job token — the printed layout lives in
   assets/js/print-orders-runtime.js and is measured and fitted there. This file
   only decides which rows get printed, in which order, and with which safety
   flags (high-alert, hazardous, LASA, cold chain) the runtime colours them. */

import { fsEsc } from './dom-utils.js?v=b2909b7f46';
import { fsText, fsNum } from './text-normalize.js?v=aa16ae9ac0';
import { uiToast } from './module-ui-helpers.js?v=3657403ad7';
import { fsR5DepartmentRecords } from './department-names.js?v=ea6f476532';

export function fsR5MedicineFlags(m){
  m=m||{};
  var cls=String(m.classification||'').toLowerCase();
  return {
    high:!!(m.high_alert||m.highAlert||cls.indexOf('high')>=0),
    hazard:!!(m.hazard||m.hazardous||cls.indexOf('hazard')>=0),
    lasa:!!(m.lasa||m.LASA||cls.indexOf('lasa')>=0),
    cold:!!(m.refrigerated||m.fridge||m.cold_chain||cls.indexOf('refriger')>=0)
  };
}

export function fsR5SelectedOrders(ids){
  var requests=typeof window.gr==='function'?(window.gr()||[]):[];
  var depts=fsR5DepartmentRecords();
  return ids.map(function(id){
    var r=requests.find(function(x){return String(x.id)===String(id)});
    if(!r)return null;
    var meds=[];
    try{if(typeof window.getMeds==='function')meds=window.getMeds(r.deptId||r.departmentId||'')||[]}catch(e){/* an optional source that is not loaded in this session */}
    var rows=(Array.isArray(r.dispensed)?r.dispensed:[])
      .filter(function(x){return fsNum(x&&x.qty)>0})
      .map(function(x){
        var med=meds.find(function(m){return String(m.id)===String(x.medId||x.medicationId||x.id)})||x||{};
        var f=fsR5MedicineFlags(med);
        return {
          name:fsText(med.name||x.name||x.medName||x.medId,'Unknown medicine / دواء غير معروف'),
          category:fsText(med.category||x.category,'Uncategorized / غير مصنف'),
          qty:fsNum(x.qty),high:f.high,hazard:f.hazard,lasa:f.lasa,cold:f.cold
        };
      });
    if(!rows.length)return null;
    var dept=depts.find(function(d){return String(d.id)===String(r.deptId||r.departmentId)})||
      {id:r.deptId||r.departmentId,name:r.deptName||r.departmentName};
    return {request:r,dept:dept,rows:rows};
  }).filter(Boolean);
}

/* Rows are grouped by category within an order, but printed as one flat list:
   the runtime draws the category heading when the category changes. */
export function fsR5OrdersPrintData(orders){
  var printData=[];

  (orders||[]).forEach(function(order,orderIndex){
    var tone=orderIndex%2===0?'white':'gray';
    var categoryOrder=[],categoryRows={};

    (order.rows||[]).forEach(function(row){
      var category=row.category||'UNCATEGORIZED / غير مصنف';
      if(!Object.prototype.hasOwnProperty.call(categoryRows,category)){
        categoryRows[category]=[];
        categoryOrder.push(category);
      }
      categoryRows[category].push(row);
    });

    var orderedRows=[];
    categoryOrder.forEach(function(category){
      categoryRows[category].forEach(function(row){orderedRows.push(row);});
    });

    orderedRows.forEach(function(row,index){
      printData.push({
        orderId:String(order.request&&order.request.id||('order_'+orderIndex)),
        orderIndex:orderIndex,
        department:window.floorstockDepartmentName(order.dept),
        category:row.category||'UNCATEGORIZED / غير مصنف',
        itemIndex:index+1,
        name:String(row.name||''),
        qty:row.qty,
        high:!!row.high,
        hazard:!!row.hazard,
        lasa:!!row.lasa,
        cold:!!row.cold,
        tone:tone
      });
    });
  });

  return printData;
}

/* Backward-compatible CSP-safe document generator for diagnostics/tests. */
export function fsR5OrdersHtml(orders){
  var payload={rows:fsR5OrdersPrintData(orders)};
  var runtimeUrl='';
  try{runtimeUrl=new URL('./assets/js/print-orders-runtime.js?v=22c77ac4dc',window.location.href).href;}catch(e){runtimeUrl='/assets/js/print-orders-runtime.js?v=22c77ac4dc';}
  return '<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Print Orders — Preparing PDF</title>'+
    '<style>html,body{margin:0;width:100%;height:100%;background:#fff;font-family:Arial,Tahoma,sans-serif}#status{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:100%;padding:24px;color:#111;text-align:center;white-space:pre-line}</style>'+
    '<script src="'+fsEsc(runtimeUrl)+'" defer><\/script></head><body>'+
    '<canvas id="page-canvas" hidden></canvas><div id="status">Preparing the final A4 PDF…</div>'+
    '<textarea id="print-data" hidden>'+fsEsc(JSON.stringify(payload))+'</textarea></body></html>';
}

export function fsR5PrintJobToken(){
  var suffix='';
  try{
    var bytes=new Uint32Array(2);
    crypto.getRandomValues(bytes);
    suffix=bytes[0].toString(36)+bytes[1].toString(36);
  }catch(e){suffix=Math.random().toString(36).slice(2);}
  return Date.now().toString(36)+'_'+suffix;
}

/* The rows travel to the print page through localStorage under a one-shot
   token, with the opener's own map as the fallback for private-mode browsers
   where localStorage throws. Both copies are dropped after two minutes so a
   printed list never lingers on the machine. */
export function doPrint(){
  if(typeof window.canManageRequests==='function'&&typeof window.isPharmacyDirector==='function'&&!(window.canManageRequests()||window.isPharmacyDirector()))return uiToast('No print permission / لا توجد صلاحية للطباعة','err');
  var ids=Array.from(document.querySelectorAll('.pchk:checked')).map(function(c){return c.dataset.id});
  if(!ids.length)return uiToast('Select at least one order / اختر طلبًا واحدًا على الأقل','err');
  var orders=fsR5SelectedOrders(ids);
  if(!orders.length)return uiToast('No dispensed medicines with quantity greater than zero / لا توجد أدوية مصروفة بكمية أكبر من صفر','err');

  var rows=fsR5OrdersPrintData(orders);
  var token=fsR5PrintJobToken();
  var storageKey='asdhealth:print-orders:'+token;
  var payload={createdAt:Date.now(),rows:rows};
  window.__ASDH_PRINT_ORDER_JOBS__=window.__ASDH_PRINT_ORDER_JOBS__||{};
  window.__ASDH_PRINT_ORDER_JOBS__[token]=payload;
  try{localStorage.setItem(storageKey,JSON.stringify(payload));}catch(storageError){console.warn('Print job could not be stored locally; using the opener fallback.',storageError);}

  var printUrl;
  try{printUrl=new URL('./print-orders.html',window.location.href);}
  catch(e){printUrl={href:'/print-orders.html?job='+encodeURIComponent(token),searchParams:{set:function(){}}};}
  if(printUrl.searchParams&&typeof printUrl.searchParams.set==='function')printUrl.searchParams.set('job',token);
  var popup=window.open(printUrl.href,'_blank');
  if(!popup){
    try{localStorage.removeItem(storageKey);}catch(e){/* storage is unavailable: a private window, or site data the browser cleared. The feature works without it. */}
    delete window.__ASDH_PRINT_ORDER_JOBS__[token];
    return uiToast('Allow pop-ups to print / اسمح بالنوافذ المنبثقة للطباعة','err');
  }

  setTimeout(function(){
    try{localStorage.removeItem(storageKey);}catch(e){/* storage is unavailable: a private window, or site data the browser cleared. The feature works without it. */}
    if(window.__ASDH_PRINT_ORDER_JOBS__)delete window.__ASDH_PRINT_ORDER_JOBS__[token];
  },120000);

  try{
    if(typeof window.persistPrintOrdersMeta==='function')Promise.resolve(window.persistPrintOrdersMeta(orders.map(function(o){return o.request.id}))).catch(function(e){console.error(e)});
  }catch(e){/* an optional source that is not loaded in this session */}
  if(typeof window.renderPrint==='function')window.renderPrint();
  /* The print-page selection state has one owner: core/print-page-state.js. */
  resetPrintPageState();
  return undefined;
}

/* The print button is bound in HTML, so this one name has to stay on window.
   Everything else in this file is imported, not published. */
Object.assign(globalThis,{ doPrint });

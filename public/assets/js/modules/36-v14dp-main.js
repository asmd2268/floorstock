(function(){
'use strict';
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}

/* ══════════════════════════════════════════════════════════════
   2. صفحة الطباعة: عزل Fulfilled
   - الطلبات المكتملة (fulfilled) تعلو الجدول بتمييز أخضر
   - زر فلتر: الكل / Fulfilled فقط / اليوم
   - نسخ renderPrint
══════════════════════════════════════════════════════════════ */
var _v14PrintFilter='today'; /* default for all print users: fulfilled today */

window.renderPrint=function(){
  /* أصل renderPrint */
  var purgeBtn=E('purge-old-orders-btn');
  if(purgeBtn)purgeBtn.style.display=(window.CU&&CU.master===true)?'inline-flex':'none';

  var allReqs=(typeof gr==='function'?gr():[]).slice().reverse();
  var fulfilled=allReqs.filter(function(r){return r.status==='fulfilled'||r.status==='partial'}).sort(function(a,b){return new Date(b.fulfilledAt||b.created||0)-new Date(a.fulfilledAt||a.created||0)});
  var pending=allReqs.filter(function(r){return r.status==='pending'}).sort(function(a,b){return new Date(b.created||0)-new Date(a.created||0)});

  var today=new Date().toISOString().slice(0,10);

  /* بناء صفوف الجدول */
  function buildRow(r,cls){
    var dept=(typeof gd==='function'?gd():[]).find(function(x){return x.id===r.deptId});
    var nn=(r.dispensed||[]).filter(function(x){return x.qty>0}).length;
    var date=typeof fmtDateTime==='function'?fmtDateTime(r.created):r.created;
    var ful=r.fulfilledAt?(typeof fmtDate==='function'?fmtDate(r.fulfilledAt):r.fulfilledAt):'—';
    return '<tr class="'+cls+'">'
      +'<td><input type="checkbox" class="pchk" data-id="'+esc(r.id)+'"></td>'
      +'<td>'+esc((dept&&dept.name)||r.deptId)+'</td>'
      +'<td>'+esc(date)+'</td>'
      +'<td>'+esc(ful)+'</td>'
      +'<td>'+nn+' items</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(r.printCount||0)+'</td>'
      +'</tr>';
  }

  var fRows='',pRows='';
  var todayFulfilled=fulfilled.filter(function(r){return (r.fulfilledAt||r.created||'').slice(0,10)===today});

  if(_v14PrintFilter==='today'){
    fRows=todayFulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else if(_v14PrintFilter==='fulfilled'){
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else {
    /* all: fulfilled أولاً ثم pending */
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
    pRows=pending.map(function(r){return buildRow(r,'v14-ptbl-pending')}).join('');
  }

  var tbl=E('ptbl');
  if(!tbl)return;

  /* إضافة شريط الفلتر فوق الجدول */
  var card=tbl.closest('.card');
  if(card){
    var existFilter=E('v14-print-filter');
    if(!existFilter){
      var filterBar=document.createElement('div');filterBar.id='v14-print-filter';
      filterBar.innerHTML=
        '<span style="font-size:12px;font-weight:700;color:var(--tx2)">Show:</span>'
        +'<button class="btn bg bsm" id="v14-pf-fulfilled" onclick="v14SetPrintFilter(\'fulfilled\')">✅ Fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-today" onclick="v14SetPrintFilter(\'today\')">📅 Today\'s fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-all" onclick="v14SetPrintFilter(\'all\')">All requests</button>'
        +'<span style="font-size:11px;color:var(--tx2);margin-inline-start:8px">'
        +'✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length
        +'</span>';
      card.querySelector('.ch').insertAdjacentElement('afterend',filterBar);
    } else {
      /* حدّث الأرقام */
      var stat=existFilter.querySelector('span:last-child');
      if(stat)stat.textContent='✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length;
    }
    /* أضء الزر النشط */
    ['fulfilled','today','all'].forEach(function(f){
      var btn=E('v14-pf-'+f);if(!btn)return;
      btn.classList.toggle('on',f===_v14PrintFilter);
    });
  }

  /* بناء الـ tbody */
  if(fRows||pRows){
    tbl.innerHTML=
      (fRows?'<tr id="v14-ptbl-fulfilled-head"><td colspan="6">✅ Fulfilled Requests</td></tr>'+fRows:'')
      +(pRows?'<tr id="v14-ptbl-pending-head" style="background:var(--s2)"><td colspan="6" style="padding:6px 10px;font-weight:800;font-size:12px;color:var(--tx2)">⏳ Pending Requests</td></tr>'+pRows:'');
  } else {
    tbl.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx2);padding:18px">No requests found</td></tr>';
  }
};

window.v14SetPrintFilter=function(f){
  _v14PrintFilter=f;
  if(typeof window.renderPrint==='function')window.renderPrint();
};


})();








export {};

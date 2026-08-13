import {buildAnalyticsMedicineIndex,resolveAnalyticsMedicine} from '../core/analytics-medicine-resolver.js?v=R6.76.42';

(function(){
'use strict';
function esc(value){return window.fsEsc?window.fsEsc(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function completedRows(){return (typeof window.gr==='function'?window.gr():[]).concat(window.S&&window.S.g?window.S.g('request_analytics_archive')||[]:[]).filter(function(row){return row&&row.status!=='pending'})}
function departmentName(id){var department=(typeof window.gd==='function'?window.gd()||[]:[]).find(function(item){return String(item.id)===String(id)});return department&&department.name||id||'—'}
function selectedPeriod(){var year=Number((document.getElementById('analytics-report-year')||{}).value)||new Date().getFullYear(),quarter=String((document.getElementById('analytics-report-quarter')||{}).value||'all');return {year:year,quarter:quarter}}
function inPeriod(row,period){var date=new Date(row.fulfilledAt||row.created||'');return !isNaN(date)&&date.getFullYear()===period.year&&(period.quarter==='all'||Math.floor(date.getMonth()/3)+1===Number(period.quarter))}
function reportTitle(period){return period.quarter==='all'?'Annual analytics report '+period.year+' / التقرير الإحصائي السنوي '+period.year:'Q'+period.quarter+' '+period.year+' analytics report / تقرير الربع '+period.quarter+' '+period.year}
function collect(period){
  var result={orders:0,units:0,routine:{},high:{},departments:{}},medicines=buildAnalyticsMedicineIndex();
  completedRows().filter(function(row){return inPeriod(row,period)}).forEach(function(row){
    var department=departmentName(row.deptId),bucket=result.departments[department]||(result.departments[department]={orders:0,units:0});
    result.orders++;bucket.orders++;
    (row.dispensed||[]).forEach(function(line){
      var quantity=Number(line.qty)||0;if(quantity<=0)return;
      var medicine=resolveAnalyticsMedicine(line,row.deptId,medicines,row),group=medicine.high?result.high:result.routine;
      if(!group[medicine.name])group[medicine.name]={quantity:0,departments:{}};
      group[medicine.name].quantity+=quantity;
      group[medicine.name].departments[department]=(group[medicine.name].departments[department]||0)+quantity;
      bucket.units+=quantity;result.units+=quantity;
    });
  });
  return result;
}
function top(group){return Object.keys(group).map(function(name){return {name:name,quantity:group[name].quantity,departments:group[name].departments}}).sort(function(a,b){return b.quantity-a.quantity}).slice(0,10)}
function medicineTable(items,emptyMessage){
  var body=items.length?items.map(function(item){
    var contribution=Object.keys(item.departments).sort(function(a,b){return item.departments[b]-item.departments[a]}).map(function(department){var quantity=item.departments[department],share=item.quantity?Math.round(quantity/item.quantity*1000)/10:0;return esc(department)+': '+quantity+' ('+share+'%)'}).join('<br>');
    return '<tr><td><b>'+esc(item.name)+'</b></td><td>'+item.quantity+'</td><td>'+contribution+'</td></tr>';
  }).join(''):'<tr><td colspan="3" class="empty">'+esc(emptyMessage)+'</td></tr>';
  return '<div class="analytics-table-wrap"><table><thead><tr><th>Medicine / الدواء</th><th>Total units / الإجمالي</th><th>Department contribution / مساهمة الأقسام</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function departmentChart(data){
  var names=Object.keys(data.departments).sort(function(a,b){return data.departments[b].units-data.departments[a].units}),maximum=Math.max.apply(null,names.map(function(name){return data.departments[name].units}).concat([1]));
  if(!names.length)return '<p class="empty">No fulfilled dispensing data in this period. / لا توجد بيانات صرف مكتملة خلال هذه الفترة.</p>';
  return '<div class="department-bars">'+names.map(function(name,index){var entry=data.departments[name],share=data.units?Math.round(entry.units/data.units*1000)/10:0,color=['#1d4ed8','#059669','#d97706','#7c3aed','#dc2626','#0891b2'][index%6];return '<article class="department-bar"><div class="department-label"><b>'+esc(name)+'</b><span>'+entry.orders+' orders · '+entry.units+' units · '+share+'%</span></div><div class="meter"><i style="width:'+Math.max(2,Math.round(entry.units/maximum*100))+'%;background:'+color+'"></i></div></article>'}).join('')+'</div>';
}
function markup(period,data,forPrint){
  var routine=top(data.routine),high=top(data.high),average=data.orders?Math.round(data.units/data.orders*10)/10:0;
  return '<section class="analytics-official-report">'
    +'<header class="analytics-title"><div><h1>'+esc(reportTitle(period))+'</h1><p>Completed fulfilled requests only · official pharmacy consumption analysis</p></div><div class="analytics-period">'+esc(period.quarter==='all'?'Full year':'Quarter '+period.quarter)+'</div></header>'
    +'<div class="analytics-kpis"><div><span>Fulfilled orders</span><b>'+data.orders+'</b></div><div><span>Dispensed units</span><b>'+data.units+'</b></div><div><span>Average / order</span><b>'+average+'</b></div><div><span>Departments</span><b>'+Object.keys(data.departments).length+'</b></div></div>'
    +'<section class="analytics-section"><h2>Top 10 routine medicines / الأكثر صرفًا</h2>'+medicineTable(routine,'No routine medicines were dispensed in this period.')+'</section>'
    +'<section class="analytics-section high-alert"><h2>Top High Alert medicines / الأدوية عالية الخطورة</h2>'+medicineTable(high,'No high-alert medicines were dispensed in this period.')+'</section>'
    +'<section class="analytics-section"><h2>Department consumption / استهلاك الأقسام</h2>'+departmentChart(data)+'</section>'
    +(forPrint?'<p class="analytics-note">Medication rows show each contributing department and its share of that medicine’s total dispensing.</p>':'')
    +'</section>';
}
function printOfficial(period,data){
  var css='@page{size:A4 portrait;margin:14mm 12mm 18mm}body{font:10pt Arial,sans-serif;color:#172033}.analytics-official-report{max-width:100%}.analytics-title{display:flex;justify-content:space-between;gap:12px;border-bottom:3px solid #1d4ed8;padding-bottom:8px}.analytics-title h1{font-size:17pt;margin:0;color:#102a5c}.analytics-title p{margin:4px 0 0;color:#475569}.analytics-period{font-weight:700;color:#1d4ed8;white-space:nowrap}.analytics-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:12px 0}.analytics-kpis div{border:1px solid #b9cae8;border-top:4px solid #2563eb;background:#f5f9ff;padding:8px}.analytics-kpis span{display:block;font-size:8pt;color:#52627b}.analytics-kpis b{display:block;font-size:18pt;color:#102a5c;margin-top:3px}.analytics-section{margin:14px 0;break-inside:avoid}.analytics-section h2{font-size:13pt;margin:0 0 6px;padding:5px 7px;color:#102a5c;background:#e8f0ff;border-left:4px solid #2563eb}.high-alert h2{color:#991b1b;background:#fff1f2;border-left-color:#dc2626}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #9aa8bd;padding:6px;vertical-align:top;word-wrap:break-word}th{background:#dbeafe;color:#102a5c;text-align:left}th:nth-child(1){width:29%}th:nth-child(2){width:14%}th:nth-child(3){width:57%}.empty{text-align:center;color:#64748b;padding:12px}.department-bars{display:grid;gap:7px}.department-bar{break-inside:avoid}.department-label{display:flex;justify-content:space-between;gap:9px;font-size:9pt}.department-label span{color:#475569;white-space:nowrap}.meter{height:12px;background:#e3eaf4;border-radius:10px;overflow:hidden;margin-top:3px}.meter i{display:block;height:100%;border-radius:10px}.analytics-note{font-size:8pt;color:#475569}@media print{button{display:none!important}}';
  if(typeof window.fsOfficialPrint==='function')window.fsOfficialPrint({title:'Official analytics report',html:markup(period,data,true),css:css});else window.toast&&window.toast('Official printing is not ready. Reload the page and try again.','err');
}
function enhance(root){
  if(!root)return;
  if(!document.getElementById('floorstock-unified-analytics-style')){
    var style=document.createElement('style');style.id='floorstock-unified-analytics-style';style.textContent='.analytics-screen{margin-top:18px}.analytics-screen .analytics-title{display:flex;justify-content:space-between;gap:16px;align-items:start;padding:4px 0 14px;border-bottom:2px solid #2563eb}.analytics-screen .analytics-title h1{margin:0;color:#60a5fa;font-size:20px}.analytics-screen .analytics-title p{margin:5px 0 0;color:#94a3b8}.analytics-screen .analytics-period{font-weight:700;color:#bfdbfe;white-space:nowrap}.analytics-screen .analytics-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.analytics-screen .analytics-kpis div{border:1px solid #334155;border-top:4px solid #2563eb;border-radius:9px;padding:12px;background:#172033}.analytics-screen .analytics-kpis span{display:block;color:#94a3b8;font-size:12px}.analytics-screen .analytics-kpis b{display:block;color:#f8fafc;font-size:26px;margin-top:4px}.analytics-screen .analytics-section{margin:19px 0}.analytics-screen .analytics-section h2{margin:0 0 8px;padding:9px 11px;border-left:4px solid #3b82f6;background:#172554;color:#dbeafe;font-size:16px}.analytics-screen .high-alert h2{border-color:#ef4444;background:#450a0a;color:#fee2e2}.analytics-screen .analytics-table-wrap{overflow:auto;border:1px solid #334155;border-radius:8px}.analytics-screen table{width:100%;border-collapse:collapse;min-width:650px}.analytics-screen th,.analytics-screen td{padding:10px;border-bottom:1px solid #334155;text-align:left;vertical-align:top}.analytics-screen th{background:#1e293b;color:#bfdbfe}.analytics-screen td{color:#e2e8f0}.analytics-screen .department-bars{display:grid;gap:10px}.analytics-screen .department-bar{padding:10px;border:1px solid #334155;border-radius:8px;background:#111827}.analytics-screen .department-label{display:flex;justify-content:space-between;gap:8px}.analytics-screen .department-label span{color:#cbd5e1}.analytics-screen .meter{height:13px;background:#334155;border-radius:10px;overflow:hidden;margin-top:6px}.analytics-screen .meter i{display:block;height:100%;border-radius:10px}.analytics-screen .empty{color:#94a3b8;text-align:center;padding:16px}@media(max-width:760px){.analytics-screen .analytics-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-screen .analytics-title{display:block}.analytics-screen .analytics-period{margin-top:8px}}';document.head.appendChild(style);
  }
  var old=root.querySelector('[data-unified-analytics]');if(old)old.remove();
  var legacy=document.getElementById('annual-analytics-print-card');if(legacy)legacy.style.display='none';
  var duplicate=root.querySelector('#analytics-report-print');if(duplicate)duplicate.style.display='none';
  var detail=root.querySelector('#analytics-report-detail');if(!detail)return;
  var period=selectedPeriod(),data=collect(period),section=document.createElement('section');
  section.dataset.unifiedAnalytics='1';section.className='card analytics-screen';
  section.innerHTML='<div class="ch"><span class="ct">📊 Official analytics report / التقرير الإحصائي الرسمي</span><button class="btn bp bsm" type="button">🖨 Print official report / طباعة التقرير الرسمي</button></div><div class="cb">'+markup(period,data,false)+'</div>';
  section.querySelector('button').addEventListener('click',function(){printOfficial(period,data)});
  detail.parentNode.appendChild(section);
}
function render(){var root=document.getElementById('analytics-reports-card');if(root)enhance(root)}
window.addEventListener('floorstock:analytics-rendered',function(event){enhance(event.detail&&event.detail.root)});
var attempts=0,timer=setInterval(function(){render();if(++attempts>60)clearInterval(timer)},500);
})();

export {};

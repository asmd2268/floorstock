(function(){
'use strict';
function esc(value){return window.fsEsc?window.fsEsc(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){return window.S&&typeof window.S.g==='function'?window.S.g('accountability_regimens_v2')||[]:[]}
function deptName(id){var all=window.S&&typeof window.S.g==='function'?window.S.g('departments')||[]:[];var row=all.find(function(d){return String(d.id)===String(id)});return row&&row.name||id||'—'}
function activeVersion(regimen){return regimen&&((regimen.versions||[]).find(function(v){return String(v.id)===String(regimen.activeVersionId)})||(regimen.versions||[])[0])||{}}
function severityLabel(value){return ({low:'Low / منخفضة',moderate:'Moderate / متوسطة',high:'High / عالية',critical:'Critical / حرجة'})[String(value||'moderate')]||'Moderate / متوسطة'}
function payload(regimen){var version=activeVersion(regimen);return ['ASDHealth approved regimen',regimen.name||'',regimen.infectionSource||'',severityLabel(version.severity),version.lineType||'',(version.items||[]).map(function(i){return (i.medName||'Medicine')+' x '+(Number(i.qty)||0)+' units'}).join('; ')].join(' | ')}
function qr(value,small){return window.ASD_QR&&typeof window.ASD_QR.imageMarkup==='function'?window.ASD_QR.imageMarkup(value,{width:small?112:220,height:small?112:220,alt:'Approved regimen QR',errorCorrection:'H'}):'<span>QR unavailable</span>'}
function enhanceBuilder(){
  var line=document.getElementById('acc2-regimen-line');if(!line||document.getElementById('acc2-regimen-severity'))return;
  var field=document.createElement('div');field.className='fg';field.innerHTML='<label>Severity / درجة الشدة *</label><select id="acc2-regimen-severity"><option value="low">Low / منخفضة</option><option value="moderate" selected>Moderate / متوسطة</option><option value="high">High / عالية</option><option value="critical">Critical / حرجة</option></select><div class="fhint">Classifies the current treatment plan.</div>';
  line.parentNode.insertBefore(field,line.nextSibling);
  var hint=line.closest('.card').querySelector('.fhint');if(hint)hint.textContent='Each regimen must contain at least two medicines. Set the planned units for every medicine and the severity of this version.';
}
function renderTable(){
  var root=document.getElementById('r17-accountability-root');if(!root||root.querySelector('#acc2-regimen-print-table'))return;
  var on=root.querySelector('.acc2-tab.on');if(!on||String(on.textContent||'').indexOf('Regimens')<0)return;
  var rows=state();if(!rows.length)return;
  var html='<div class="card" id="acc2-regimen-print-table"><div class="ch"><div><span class="ct">Approved regimen table / جدول الخطط العلاجية المعتمدة</span><div class="fhint">QR encodes the currently approved plan and its specified quantities. Print the table for bedside reference.</div></div></div><div class="tw"><table class="acc2-table"><thead><tr><th>Plan / الخطة</th><th>Department</th><th>Indication</th><th>Line</th><th>Severity</th><th>Medicines and planned units</th><th>Current approved QR</th><th>Print</th></tr></thead><tbody>';
  html+=rows.map(function(r){var v=activeVersion(r),items=(v.items||[]).map(function(i){return '<li><b>'+esc(i.medName||'Medicine')+'</b> — '+esc(i.qty)+' units / وحدة</li>'}).join('');return '<tr><td><b>'+esc(r.name||'Regimen')+'</b><div class="fhint">'+esc(v.label||'—')+'</div></td><td>'+esc(deptName(r.deptId))+'</td><td>'+esc(r.infectionSource||'—')+'</td><td>'+esc(v.lineType||'—')+'</td><td><span class="badge '+(v.severity==='critical'||v.severity==='high'?'brd':'bbl')+'">'+esc(severityLabel(v.severity))+'</span></td><td><ul style="margin:0;padding-inline-start:18px">'+items+'</ul></td><td>'+qr(payload(r),true)+'</td><td><button class="btn bp bsm" type="button" data-acc2-regimen-print="'+esc(r.id)+'">Print / طباعة</button></td></tr>'}).join('');
  root.insertAdjacentHTML('beforeend',html+'</tbody></table></div></div>');
}
function printRegimen(id){
  var regimen=state().find(function(row){return String(row.id)===String(id)});if(!regimen)return window.toast&&window.toast('The regimen was not found.','err');
  var version=activeVersion(regimen),items=(version.items||[]),body=items.map(function(item,index){return '<tr><td>'+String(index+1)+'</td><td>'+esc(item.medName||'Medicine')+'</td><td>'+esc(item.qty)+' units / وحدة</td></tr>'}).join(''),qrRuntime=window.ASD_QR&&window.ASD_QR.printRuntimeScript?window.ASD_QR.printRuntimeScript():'';
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Approved regimen</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;margin:0}.head{display:flex;justify-content:space-between;gap:18px;align-items:center;border-bottom:2px solid #14532d;padding-bottom:10px}.head h1{margin:0;font-size:20px}.meta{margin:12px 0;background:#f2f8f3;padding:10px;border-radius:6px}.sev{font-weight:bold;color:#9f1239}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #555;padding:8px;text-align:left}th{background:#e7f3ea}.qr{text-align:center;margin-top:16px}.qr img{display:block;margin:0 auto}.foot{margin-top:14px;font-size:10px;color:#555}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="head"><div><h1>'+esc(regimen.name||'Regimen')+'</h1><div>Approved treatment plan / الخطة العلاجية المعتمدة حاليًا</div></div><div class="qr">'+qr(payload(regimen),false)+'</div></div><div class="meta"><b>Department:</b> '+esc(deptName(regimen.deptId))+' &nbsp; | &nbsp; <b>Indication:</b> '+esc(regimen.infectionSource||'—')+'<br><b>Line:</b> '+esc(version.lineType||'—')+' &nbsp; | &nbsp; <span class="sev">Severity: '+esc(severityLabel(version.severity))+'</span></div><table><thead><tr><th>#</th><th>Medicine / العلاج</th><th>Planned quantity / الكمية المحددة</th></tr></thead><tbody>'+body+'</tbody></table><div class="foot">QR contains the active approved regimen and its planned quantities. Printed '+esc(new Date().toLocaleString())+'.</div></body>'+qrRuntime+'</html>';
  var win=window.open('','_blank');if(!win)return window.toast&&window.toast('Allow pop-ups to print the regimen.','err');win.document.open();win.document.write(html);win.document.close();
}
function wrapSave(){
  var original=window.acc2SaveRegimenVersion;if(typeof original!=='function'||original.__r676RegimenWrap)return;
  var wrapped=async function(){
    var checked=document.querySelectorAll('[data-acc2-regimen-assignment]:checked');if(checked.length<2){return window.toast&&window.toast('A regimen must contain at least two medicines. / يجب أن تحتوي الخطة على علاجين على الأقل.','err')}
    var severity=(document.getElementById('acc2-regimen-severity')||{}).value||'moderate',name=String((document.getElementById('acc2-regimen-name')||{}).value||'').trim(),dept=(document.getElementById('acc2-regimen-dept')||{}).value||'',store=window.S&&window.S.s;if(!store)return original.apply(this,arguments);
    window.S.s=async function(key,value){if(key==='accountability_regimens_v2'&&Array.isArray(value)){var regimen=value.filter(function(row){return String(row.deptId)===String(dept)&&String(row.name||'')===name}).pop();var version=regimen&&(regimen.versions||[])[(regimen.versions||[]).length-1];if(version)version.severity=severity}return store.apply(this,arguments)};
    try{return await original.apply(this,arguments)}finally{window.S.s=store}
  };wrapped.__r676RegimenWrap=true;window.acc2SaveRegimenVersion=wrapped;
}
function install(){enhanceBuilder();renderTable();wrapSave()}
setTimeout(install,0);
var previous=window.renderMedicationAccountability;if(typeof previous==='function'&&!previous.__r676RegimenPrintWrap){var wrapped=function(){var result=previous.apply(this,arguments);setTimeout(install,0);return result};wrapped.__r676RegimenPrintWrap=true;window.renderMedicationAccountability=wrapped}
document.addEventListener('click',function(event){var button=event.target.closest('[data-acc2-regimen-print]');if(button){printRegimen(button.getAttribute('data-acc2-regimen-print'));return}},true);
})();
export {};

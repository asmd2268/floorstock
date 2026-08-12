(function(){
'use strict';
const E=globalThis.E;
function classIcons(m){var h='<span class="v13-class-icons">';if(m&&m.high_alert)h+='<span class="v13-ci v13-ha" title="High Alert">HA</span>';if(m&&m.lasa)h+='<span class="v13-ci v13-lasa" title="LASA">LASA</span>';if(m&&m.refrigerated)h+='<span class="v13-ci v13-ref" title="Refrigerator">❄</span>';if(m&&m.hazard)h+='<span class="v13-ci v13-haz" title="Hazard">⚠</span>';return h+'</span>'}

window.receiveFulfilledRequest=function(id){var req=(typeof gr==='function'?gr():[]).find(function(x){return x.id===id});if(!req||!window.CU||req.deptId!==CU.deptId)return toast('Request not available','err');E('v13-receive-modal').dataset.requestId=String(id);var meds=getMeds(CU.deptId),rows=(req.dispensed||[]).filter(function(x){return Number(x.qty)>0}).map(function(d,i){var m=meds.find(function(x){return x.id===d.medId})||{};return '<tr data-med="'+d.medId+'" data-qty="'+Number(d.qty||0)+'"><td>'+(i+1)+'</td><td><b>'+esc(m.name||d.medId)+'</b>'+classIcons(m)+'</td><td>'+Number(d.qty||0)+'</td><td><input class="v13-r-exp" type="date"></td><td><input class="v13-r-lot" placeholder="Optional"></td></tr>'}).join('');E('v13-receive-meta').textContent='Request '+id+' — enter all expiry dates and batch numbers, then confirm once.';E('v13-receive-body').innerHTML=rows||'<tr><td colspan="5">No dispensed items</td></tr>';OM('v13-receive-modal')};


})();

export {};

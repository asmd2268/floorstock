import { publishLegacy } from '../core/legacy-registry.js';

// ── ANALYTICS ────────────────────────────────────────────────────────
// Split out of 07-expiry-requests-and-primary-features.js (Phase 3 module
// split). Everything referenced here that isn't declared in this file
// (S, CU, esc, el, gd, gr, getMeds, deptName) is already published to
// globalThis by its owning module.
function anlSwitchTab(name){var panels=['top','alert','compare','zero','crash','period'];panels.forEach(function(t){var p=el('anl-panel-'+t);if(p)p.style.display=t===name?'':'none'});document.querySelectorAll('#anl-tabs .anl-tab').forEach(function(b){var on=b.dataset.anl===name;b.classList.toggle('bp',on);b.classList.toggle('bg',!on);b.style.opacity=on?'1':'0.65';b.style.borderBottom=on?'3px solid var(--ac)':'none'})}
function renderAn(){
  if(!el('anl-tabs').__anlBound){el('anl-tabs').__anlBound=true;el('anl-tabs').addEventListener('click',function(ev){var b=ev.target.closest('.anl-tab');if(b)anlSwitchTab(b.dataset.anl)})}
  var p=el('aperiod').value;
  el('crange').style.display=p==='custom'?'flex':'none';
  var dsel=el('adept');
  if(dsel.options.length<=1)fsRoleScopedDepts(gd()).forEach(function(d){dsel.innerHTML+='<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'});
  var df=dsel.value,now=new Date(),from;
  if(p==='month')from=new Date(now.getFullYear(),now.getMonth(),1);
  else if(p==='quarter')from=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1);
  else if(p==='year')from=new Date(now.getFullYear(),0,1);
  else from=new Date(el('rfrom').value||'2000-01-01');
  var to=p==='custom'?new Date(el('rto').value||now):now;
  var archived=S.g('request_analytics_archive')||[];
  var rs=gr().concat(archived).filter(function(r){if(r.status==='pending')return false;var d=new Date(r.created||0);return(!df||r.deptId===df)&&d>=from&&d<=to});
  /* Use the same stable identity across departments that the Similar Medicines
     workbench uses after a merge.  The medication id is department-local, so
     aggregating by medId incorrectly split identical items (e.g. Oxytocin).
     Keep strength/concentration in the key so genuinely different variants do
     not get combined. */
  function analyticsMedKey(m){var name=String((m&&m.name)||m&&m.id||'').trim(),strength=String((m&&m.concentration)||(m&&m.strength)||'').trim();return name.toLowerCase().replace(/\s+/g,' ')+'|'+strength.toLowerCase().replace(/\s+/g,' ')}
  var catalog={};gd().forEach(function(dep){getMeds(dep.id).forEach(function(m){var name=String(m.name||m.id).trim(),key=analyticsMedKey(m),slot={name:name,key:key,high_alert:!!(m.high_alert||m.highAlert),medId:String(m.id),deptId:String(dep.id)};catalog[dep.id+'|'+m.id]=slot})});
  var compare={};rs.forEach(function(r){(r.dispensed||[]).forEach(function(line){var qty=Number(line.qty)||0,meta=catalog[r.deptId+'|'+line.medId];if(qty<=0||!meta)return;var c=compare[meta.key]||(compare[meta.key]={name:meta.name,departments:{},total:0,orders:0});c.total+=qty;c.orders++;c.departments[r.deptId]=(c.departments[r.deptId]||0)+qty})});
  var search=el('analytics-item-search');if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',renderAn)}
  var jumpZero=el('analytics-jump-zero'),jumpCompare=el('analytics-jump-compare');
  if(jumpZero&&!jumpZero.dataset.bound){jumpZero.dataset.bound='1';jumpZero.addEventListener('click',function(){anlSwitchTab('zero')})}
  if(jumpCompare&&!jumpCompare.dataset.bound){jumpCompare.dataset.bound='1';jumpCompare.addEventListener('click',function(){anlSwitchTab('compare')})}
  var needle=search?String(search.value||'').trim().toLowerCase():'';var matches=Object.keys(compare).map(function(k){return compare[k]}).filter(function(c){return !needle||c.name.toLowerCase().indexOf(needle)>=0});
  var compareHost=el('analytics-item-compare');if(compareHost){compareHost.innerHTML=matches.length?matches.sort(function(a,b){return b.total-a.total}).slice(0,20).map(function(c){var rows=Object.keys(c.departments).sort(function(a,b){return c.departments[b]-c.departments[a]}).map(function(d){var dep=gd().find(function(x){return String(x.id)===String(d)}),q=c.departments[d];return '<tr><td>'+esc(dep?dep.name:d)+'</td><td style="text-align:right;font-family:var(--mono)">'+q+'</td><td style="text-align:right;font-family:var(--mono)">'+(c.total?Math.round(q/c.total*1000)/10:0)+'%</td></tr>'}).join('');return '<div class="card" style="margin-top:10px"><div class="ch"><span class="ct">'+esc(c.name)+'</span><span class="ss">Total '+c.total+' · '+c.orders+' orders</span></div><div class="tw"><table><thead><tr><th>Department</th><th style="text-align:right">Quantity</th><th style="text-align:right">Share</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'}).join(''):'<div style="padding:12px;color:var(--tx2)">'+(needle?'No matching item in the selected period.':'Type an item name to compare department consumption.')+'</div>'}
  var tot={},totMeta={};
  rs.forEach(function(r){(r.dispensed||[]).forEach(function(d){var qty=Number(d.qty)||0,meta=catalog[r.deptId+'|'+d.medId];if(qty<=0)return;var key=meta?meta.key:(String(d.medName||d.name||d.medId||'').trim().toLowerCase().replace(/\s+/g,' ')+'|');tot[key]=(tot[key]||0)+qty;if(!totMeta[key])totMeta[key]={name:meta?meta.name:(d.medName||d.name||d.medId),high_alert:!!(meta&&meta.high_alert)};else if(meta&&meta.high_alert)totMeta[key].high_alert=true})});
  var srt=Object.keys(tot).map(function(k){return[k,tot[k]]}).sort(function(a,b){return b[1]-a[1]});
  // Keep the medication catalog in the same department scope as the request filter.
  // Without this, Zero Dispense mixed every department's catalog into the selected one.
  var allMs=df?getMeds(df).map(function(m){return Object.assign({deptId:df},m)}):gd().reduce(function(acc,d){return acc.concat(getMeds(d.id).map(function(m){return Object.assign({deptId:d.id},m)}));},[]);
  var srtNonHA=srt.filter(function(e){return !(totMeta[e[0]]&&totMeta[e[0]].high_alert)});
  var t10=srtNonHA.slice(0,10),mx1=t10[0]?t10[0][1]:1;
  el('ctop').innerHTML=t10.length
    ?t10.map(function(e){var m=totMeta[e[0]];return '<div class="brow"><div class="blbl" title="'+(m?m.name:e[0])+'">'+(m?m.name:e[0])+'</div><div class="btrk"><div class="bfil" style="width:'+Math.round(e[1]/mx1*100)+'%;background:var(--ac)"><span class="bval">'+e[1]+'</span></div></div></div>'}).join('')
    :'<div style="padding:14px;color:var(--tx2)">No data</div>';
  var ha=srt.filter(function(e){return totMeta[e[0]]&&totMeta[e[0]].high_alert}).slice(0,10);
  var mx2=ha[0]?ha[0][1]:1;
  el('cha').innerHTML=ha.length
    ?ha.map(function(e){var m=totMeta[e[0]];return '<div class="brow"><div class="blbl">'+(m?m.name:e[0])+'</div><div class="btrk"><div class="bfil" style="width:'+Math.round(e[1]/mx2*100)+'%;background:var(--rd)"><span class="bval">'+e[1]+'</span></div></div></div>'}).join('')
    :'<div style="padding:14px;color:var(--tx2)">No data</div>';
  var usedKeys=Object.keys(tot),zeroMap={};
  allMs.forEach(function(m){if(usedKeys.indexOf(analyticsMedKey(m))>=0)return;var key=analyticsMedKey(m),z=zeroMap[key]||(zeroMap[key]={med:m,departments:[],instances:[]}),deptId=String(m.deptId||df),dep=gd().find(function(d){return String(d.id)===deptId}),name=dep?dep.name:(df?((gd().find(function(d){return String(d.id)===String(df)})||{}).name||df):'Department');if(z.departments.indexOf(name)<0)z.departments.push(name);if(!z.instances.some(function(inst){return inst.deptId===deptId&&inst.medId===String(m.id)}))z.instances.push({deptId:deptId,medId:String(m.id),deptName:name})});
  var zero=Object.keys(zeroMap).map(function(k){return zeroMap[k]});
  window._anlZeroRows=zero;
  var zc=el('azero-count'),au=el('analytics-units'),ar=el('analytics-requests');
  if(zc)zc.textContent=zero.length;
  if(au)au.textContent=Object.keys(tot).reduce(function(s,k){return s+Number(tot[k]||0)},0);
  if(ar)ar.textContent=rs.length;
  el('ztbl').innerHTML=zero.length
    ?zero.map(function(z,i){var m=z.med;return '<tr><td><input type="checkbox" class="anl-zero-chk" data-idx="'+i+'" style="width:auto;margin:0"></td><td>'+m.name+'</td><td>'+z.departments.join(', ')+'</td><td><span class="chip">'+m.category+'</span></td><td>'+bdg(m)+'</td><td style="font-family:var(--mono)">'+m.min+'</td><td style="font-family:var(--mono)">'+m.max+'</td></tr>'}).join('')
    :'<tr><td colspan="7" style="text-align:center;color:var(--gnl);padding:18px">All dispensed ✓</td></tr>';
  var hideBtn=el('anl-zero-hide-btn');if(hideBtn)hideBtn.style.display=zero.length?'':'none';

  /* ── Crash Cart Medicines ── */
  (function(){
    var host=el('analytics-crash-cart-section');
    if(!host)return;
    var carts=typeof window.crashCarts==='function'?window.crashCarts():[];
    if(!carts.length){host.innerHTML='<div style="padding:14px;color:var(--tx2)">No crash carts configured.</div>';return;}
    var allMeds={};
    carts.forEach(function(cart){
      (cart.items||cart.medicines||[]).forEach(function(item){
        var name=String(item.name||item.medName||item.med||'').trim();
        if(!name)return;
        var key=name.toLowerCase();
        if(!allMeds[key])allMeds[key]={name:name,carts:[],dispensed:0};
        if(allMeds[key].carts.indexOf(cart.name||cart.id)<0)allMeds[key].carts.push(cart.name||cart.id);
        var medKey=name.toLowerCase().replace(/\s+/g,' ')+'|';
        allMeds[key].dispensed=(allMeds[key].dispensed||0)+(tot[medKey]||0);
      });
    });
    var rows=Object.keys(allMeds).map(function(k){return allMeds[k]}).sort(function(a,b){return b.dispensed-a.dispensed});
    host.innerHTML='<div class="tw"><table><thead><tr><th>Medicine</th><th>Carts</th><th>Dispensed (period)</th></tr></thead><tbody>'+
      (rows.length?rows.map(function(r){return '<tr><td>'+esc(r.name)+'</td><td>'+esc(r.carts.join(', '))+'</td><td style="text-align:right;font-family:var(--mono)">'+r.dispensed+'</td></tr>'}).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--tx2)">No crash cart medicines found.</td></tr>')+
      '</tbody></table></div>';
  })();

  /* ── Quarter & Year comparisons + print charts ── */
  (function(){
    var host=el('analytics-period-compare');
    if(!host)return;
    var allRs=gr().concat(S.g('request_analytics_archive')||[]).filter(function(r){return r.status!=='pending'});
    var nowD=new Date(),cy=nowD.getFullYear(),cm=nowD.getMonth();
    var cq=Math.floor(cm/3);
    /* Current quarter */
    var cqFrom=new Date(cy,cq*3,1),cqTo=nowD;
    /* Previous quarter */
    var pqFrom=new Date(cy,cq*3-3,1),pqTo=new Date(cy,cq*3,0,23,59,59);
    if(pqFrom.getFullYear()<cy-1)pqFrom=new Date(cy-1,9,1);
    /* Current year */
    var cyFrom=new Date(cy,0,1),cyTo=nowD;
    /* Previous year */
    var pyFrom=new Date(cy-1,0,1),pyTo=new Date(cy-1,11,31,23,59,59);

    function sumPeriod(from,to,deptFilter){
      return allRs.filter(function(r){
        var d=new Date(r.created||0);
        return d>=from&&d<=to&&(!deptFilter||r.deptId===deptFilter);
      }).reduce(function(s,r){return s+(r.dispensed||[]).reduce(function(a,x){return a+(Number(x.qty)||0)},0)},0);
    }
    function deptSumPeriod(from,to){
      var out={};
      allRs.filter(function(r){var d=new Date(r.created||0);return d>=from&&d<=to;}).forEach(function(r){
        var q=(r.dispensed||[]).reduce(function(a,x){return a+(Number(x.qty)||0)},0);
        var dep=gd().find(function(x){return String(x.id)===String(r.deptId)});
        var name=dep?dep.name:(r.deptId||'Unknown');
        out[name]=(out[name]||0)+q;
      });
      return out;
    }

    var cqTotal=sumPeriod(cqFrom,cqTo),pqTotal=sumPeriod(pqFrom,pqTo);
    var cyTotal=sumPeriod(cyFrom,cyTo),pyTotal=sumPeriod(pyFrom,pyTo);
    var cqDepts=deptSumPeriod(cqFrom,cqTo),pyDepts=deptSumPeriod(pyFrom,pyTo);
    var deptNames=Array.from(new Set(Object.keys(cqDepts).concat(Object.keys(pyDepts)))).sort();

    function pct(a,b){if(!b)return a?'New':'—';return (a>=b?'▲ +':'▼ ')+Math.round(Math.abs(a-b)/b*1000)/10+'%';}
    function svgBar(val,max,color){
      var w=max?Math.round(val/max*160):0;
      return '<svg width="180" height="20" style="vertical-align:middle" aria-hidden="true"><rect x="0" y="4" width="'+w+'" height="12" rx="3" fill="'+color+'"/><text x="'+(w+4)+'" y="14" font-size="11" fill="currentColor">'+val+'</text></svg>';
    }

    var maxQBars=Math.max(cqTotal,pqTotal,1),maxYBars=Math.max(cyTotal,pyTotal,1);
    var deptMax=Math.max.apply(null,deptNames.map(function(n){return Math.max(cqDepts[n]||0,pyDepts[n]||0)}).concat([1]));

    var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'
      +'<div class="card"><div class="ch"><span class="ct">Quarter comparison / مقارنة الربع</span></div><div class="cb">'
      +'<div style="margin-bottom:8px"><b>Current quarter (Q'+(cq+1)+' '+cy+')</b><br>'+svgBar(cqTotal,maxQBars,'#3b82f6')+'</div>'
      +'<div style="margin-bottom:8px"><b>Previous quarter (Q'+(cq===0?4:cq)+' '+(cq===0?cy-1:cy)+')</b><br>'+svgBar(pqTotal,maxQBars,'#94a3b8')+'</div>'
      +'<div><b>Change:</b> '+pct(cqTotal,pqTotal)+'</div>'
      +'</div></div>'
      +'<div class="card"><div class="ch"><span class="ct">Year comparison / مقارنة السنة</span></div><div class="cb">'
      +'<div style="margin-bottom:8px"><b>Current year ('+cy+')</b><br>'+svgBar(cyTotal,maxYBars,'#3b82f6')+'</div>'
      +'<div style="margin-bottom:8px"><b>Previous year ('+(cy-1)+')</b><br>'+svgBar(pyTotal,maxYBars,'#94a3b8')+'</div>'
      +'<div><b>Change:</b> '+pct(cyTotal,pyTotal)+'</div>'
      +'</div></div>'
      +'</div>'
      +'<div class="card"><div class="ch"><span class="ct">Department vs same period last year / مقارنة الأقسام مع نفس الفترة</span></div><div class="tw"><table><thead><tr><th>Department</th><th>'+cy+'</th><th>'+(cy-1)+'</th><th>Change</th></tr></thead><tbody>'
      +deptNames.map(function(n){
        var c=cqDepts[n]||0,pp=pyDepts[n]||0;
        return '<tr><td>'+esc(n)+'</td>'
          +'<td>'+svgBar(c,deptMax,'#3b82f6')+'</td>'
          +'<td>'+svgBar(pp,deptMax,'#94a3b8')+'</td>'
          +'<td>'+(c>pp?'<span style="color:#16a34a">':'<span style="color:#dc2626">')+pct(c,pp)+'</span></td></tr>';
      }).join('')
      +'</tbody></table></div></div>';

    host.innerHTML=html;
  })();
}


/* Hide selected zero-dispense medicines from New Request only — reuses the
   exact same medication_visibility_rules_v3 map/shape that the Inventory
   page's existing Hide-from-Request feature writes (saveInvRuleC in
   40-v16-clean-optimized-script.js), so behavior stays identical (still
   visible in Shelves, receiving, expiry entry and printing). Zero-dispense
   rows can span several departments, and medicine ids are department-local,
   so each row's own tracked {deptId,medId} instances are used directly
   instead of re-deriving them from a single "current department" selector
   the way the Inventory page's picker does. */
window.hideSelectedZeroDispense=async function(){
  var rows=window._anlZeroRows||[];
  var checked=Array.from(document.querySelectorAll('.anl-zero-chk:checked')).map(function(x){return rows[Number(x.dataset.idx)]}).filter(Boolean);
  if(!checked.length)return toast('Select one or more medicines first. / اختر دواءً واحدًا على الأقل.','err');
  var confirmed=typeof uiConfirm==='function'?await uiConfirm('Hide '+checked.length+' medicine(s) from New Request in their zero-dispense department(s)? They remain visible in Shelves, receiving, expiry entry and printing.\n\nإخفاء '+checked.length+' دواء من نموذج الطلب في الأقسام التي لم تُصرف فيها؟ يبقى ظاهرًا في الأرفف والاستلام وإدخال الصلاحية والطباعة.'):true;
  if(!confirmed)return;
  var key='medication_visibility_rules_v3',map=Object.assign({},(window.S&&S.g?S.g(key):{})||{}),changed=0;
  checked.forEach(function(z){(z.instances||[]).forEach(function(inst){var k='med:'+inst.medId;map[k]={medId:inst.medId,name:z.med.name,allDepartments:false,departmentIds:[inst.deptId],deptIds:[inst.deptId],reason:'No dispensing in the selected analytics period / لا يوجد صرف بالفترة المحددة',updatedAt:new Date().toISOString(),updatedBy:(window.CU&&(CU.username||CU.email))||''};changed++})});
  try{
    await S.s(key,map);
    toast(changed+' medicine/department record(s) hidden from New Request ✓','succ');
    renderAn();
  }catch(error){
    console.error('Hiding zero-dispense medicines failed',error);
    toast(String(error&&error.message||error),'err');
  }
};

publishLegacy("07d-analytics.js", {
  renderAn,
  hideSelectedZeroDispense: window.hideSelectedZeroDispense,
});

export {};

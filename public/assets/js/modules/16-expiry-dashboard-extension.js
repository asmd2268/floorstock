(function(){
  function E(id){return document.getElementById(id)}
  function esc2(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function n2(v){v=Number(v);return isFinite(v)?v:0}
  function dateTime(v){try{var d=v&&v.toDate?v.toDate():new Date(v||Date.now());return d.toLocaleString('en-GB',{calendar:'gregory',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(e){return '—'}}
  function dateOnly(v){try{var d=new Date(v);return isNaN(d)?esc2(v):d.toLocaleDateString('en-GB',{calendar:'gregory',year:'numeric',month:'2-digit',day:'2-digit'})}catch(e){return esc2(v)}}
  window.makeReadableQR=function(url){return 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=png&color=000000&bgcolor=ffffff&qzone=4&ecc=H&data='+encodeURIComponent(url)};
  function publicRoot(){
    E('auth')&&(E('auth').style.display='none');E('app')&&(E('app').style.display='none');
    document.body.style.cssText='margin:0;background:#fff;color:#111';
    var r=E('public-live-root');if(!r){r=document.createElement('main');r.id='public-live-root';r.className='public-live-page';document.body.innerHTML='';document.body.appendChild(r)}return r;
  }
  function renderCrash(d){var r=publicRoot(),rows=(d.items||[]).map(function(it,i){var st=it.status||((n2(it.available)<=0)?'Out of stock':(n2(it.available)<n2(it.required)?'Less than required':'Available')),cls=st==='Out of stock'?'status-out':(st==='Less than required'?'status-low':'status-ok');return '<tr><td>'+(i+1)+'</td><td><b>'+esc2(it.name||'')+'</b></td><td>'+esc2(it.strength||it.concentration||'—')+'</td><td>'+n2(it.required)+'</td><td>'+n2(it.available)+'</td><td class="'+cls+'">'+esc2(st)+'</td><td>'+((it.batches||[]).map(function(b){return dateOnly(b.expiry)+' → '+esc2(b.qty===''?'—':b.qty)}).join('<br>')||'—')+'</td></tr>'}).join('');r.innerHTML='<div class="live-head"><h1>'+esc2(d.name||'Crash Cart')+'</h1><h2>'+esc2(d.department||'')+'</h2><div class="live-meta"><span class="live-pill"><b>Last verification:</b> '+dateTime(d.lastClosedAt)+'</span><span class="live-pill"><b>Last update:</b> '+dateTime(d.updatedAt)+'</span><span class="live-pill"><b>Expiry Track:</b> Urgent ≤ '+n2((d.expiryRules||{}).urgentDays||7)+' days · Near expiry ≤ '+n2((d.expiryRules||{}).nearDays||30)+' days</span><span class="live-pill live-ok">● Live public view — no login</span></div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Generic name</th><th>Concentration</th><th>Standard quantity</th><th>Present</th><th>Status</th><th>Expiry date → Qty</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
  function liveCrash(id){var r=publicRoot();r.innerHTML='<h2>Loading latest Crash Cart information…</h2>';return FB_DB.collection('public_controlled_expiry').doc('crash_'+id).onSnapshot(function(s){if(!s.exists){r.innerHTML='<h2>Public Crash Cart record was not found.</h2><p>Print a new QR once from the system.</p>';return}renderCrash(s.data()||{})},function(e){r.innerHTML='<h2>Could not load the public Crash Cart page.</h2><p>'+esc2(e.message||e)+'</p>'})}
  function renderEmbeddedCrash(raw){try{var d=JSON.parse(decodeURIComponent(escape(atob(raw||''))));d.department=d.department||d.dept||'';renderCrash(d);return true}catch(e){var r=publicRoot();r.innerHTML='<h2>Invalid or expired Crash Cart QR information.</h2>';return true}}
  function renderControlled(d){var r=publicRoot(),limit=Number(d.alertDays)||30,soonCount=0,expiredCount=0,rows=(d.items||[]).map(function(x,i){var itemSoon=false,itemExpired=false,bs=(x.batches||[]).map(function(b){var raw=b.expiry||'',dt=new Date(raw),days=isNaN(dt)?null:Math.ceil((dt-new Date())/86400000),cls='status-ok',label='';if(days!==null&&days<0){cls='status-out';label='Expired';itemExpired=true}else if(days!==null&&days<=limit){cls='status-low';label='Near expiry';itemSoon=true}else if(days!==null){label=days+' days'}return '<div class="'+cls+'">'+(b.qty!=null?esc2(b.qty)+' → ':'')+dateOnly(raw)+(label?' <b>('+esc2(label)+')</b>':'')+'</div>'}).join('')||'—';if(itemExpired)expiredCount++;else if(itemSoon)soonCount++;var rowCls=itemExpired?'status-out':(itemSoon?'status-low':'');return '<tr class="'+rowCls+'"><td>'+(i+1)+'</td><td><b>'+esc2(x.name||'')+'</b></td><td>'+esc2(x.classification||'—')+'</td><td>'+n2(x.qty)+'</td><td>'+bs+'</td></tr>'}).join('');r.innerHTML='<div class="live-head"><h1>Controlled Medicines List</h1><h2>'+esc2(d.departmentName||'')+'</h2><div class="live-meta"><span class="live-pill"><b>Near-expiry rule:</b> '+limit+' days</span><span class="live-pill status-low"><b>Near expiry:</b> '+soonCount+'</span><span class="live-pill status-out"><b>Expired:</b> '+expiredCount+'</span><span class="live-pill"><b>Last update:</b> '+dateTime(d.updatedAt)+'</span><span class="live-pill live-ok">● Live public view</span></div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Medicine</th><th>Class</th><th>Qty</th><th>Expiry batches and status</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
  function liveControlled(dept){var r=publicRoot();r.innerHTML='<h2>Loading latest controlled-medicine list…</h2>';return FB_DB.collection('public_controlled_expiry').doc(dept).onSnapshot(function(s){if(!s.exists){r.innerHTML='<h2>Public list was not found.</h2>';return}renderControlled(s.data()||{})},function(e){r.innerHTML='<h2>Could not load the public list.</h2><p>'+esc2(e.message||e)+'</p>'})}
  function renderExpiry(d,dept){var r=publicRoot(),b=d.batches||[],rows=b.map(function(x,i){var dt=x.date||x.expiry||'';return '<tr><td>'+(i+1)+'</td><td><b>'+esc2(x.medication||x.name||'')+'</b></td><td>'+dateOnly(dt)+'</td><td>'+esc2(x.qty==null?'—':x.qty)+'</td></tr>'}).join('');r.innerHTML='<div class="live-head"><h1>Expiry Monitor</h1><h2>'+esc2(d.departmentName||dept||'')+'</h2><div class="live-meta"><span class="live-pill"><b>Last update:</b> '+dateTime(d.updatedAt)+'</span><span class="live-pill live-ok">● Live public view</span></div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Medication</th><th>Expiry date</th><th>Qty</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
  function liveExpiry(dept){var r=publicRoot();r.innerHTML='<h2>Loading latest expiry data…</h2>';return FB_DB.collection('public_expiry').doc(dept).onSnapshot(function(s){if(!s.exists){r.innerHTML='<h2>Public expiry list was not found.</h2>';return}renderExpiry(s.data()||{},dept)},function(e){r.innerHTML='<h2>Could not load the public expiry page.</h2><p>'+esc2(e.message||e)+'</p>'})}

  var _publicLiveUnsub=null;
  function clearPublicLiveSubscriptions(){
    if(typeof _publicLiveUnsub==='function'){
      try{_publicLiveUnsub()}catch(e){console.warn('Public listener cleanup failed',e)}
    }
    _publicLiveUnsub=null;
  }
  async function startPublicLive(){
    var p=new URLSearchParams(location.search),v=p.get('view'),unsub=null;
    if(v!=='crash-cart-public'&&v!=='controlled-expiry'&&v!=='expiry')return false;
    clearPublicLiveSubscriptions();
    if(v==='crash-cart-public'&&!p.get('id')&&p.get('data')){var legacyRoot=publicRoot();legacyRoot.innerHTML='<h2>This legacy embedded Crash Cart QR is disabled.</h2><p>Print a new live QR from the authenticated system.</p>';return true}
    try{await waitForFirebase()}catch(e){var r=publicRoot();r.innerHTML='<h2>Could not initialize Firebase.</h2><p>'+esc2(e.message||e)+'</p>';return true}
    if(v==='crash-cart-public'&&p.get('id'))unsub=liveCrash(p.get('id'));
    else if(v==='controlled-expiry'&&p.get('dept'))unsub=liveControlled(p.get('dept'));
    else if(v==='expiry'&&p.get('dept'))unsub=liveExpiry(p.get('dept'));
    if(typeof unsub==='function')_publicLiveUnsub=unsub;
    return !!unsub;
  }
  window.clearPublicLiveSubscriptions=clearPublicLiveSubscriptions;
  window.addEventListener('pagehide',clearPublicLiveSubscriptions);
  startPublicLive();

  /* Publish Crash Cart public records automatically after every local/database save. */
})();








export {};

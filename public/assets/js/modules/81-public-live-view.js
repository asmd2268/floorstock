// Extracted from 07-expiry-requests-and-primary-features.js (public live QR view —
// crash cart / controlled-expiry / expiry monitor pages reachable via ?view=...
// with no login). Fully self-contained: only touches window.* globals
// (E, FB_DB, fsTenantCollection, waitForFirebase), never anything from module 07's
// own module-scope closure, so it can live in its own file safely.
(function(){
  const E=globalThis.E;
  function esc2(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function n2(v){v=Number(v);return isFinite(v)?v:0}
  function dateTime(v){try{var d=v&&v.toDate?v.toDate():new Date(v||Date.now());return d.toLocaleString('en-GB',{calendar:'gregory',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(e){return '—'}}
  function dateOnly(v){try{var d=new Date(v);return isNaN(d)?esc2(v):d.toLocaleDateString('en-GB',{calendar:'gregory',year:'numeric',month:'2-digit',day:'2-digit'})}catch(e){return esc2(v)}}
  function publicRoot(){
    E('auth')&&(E('auth').style.display='none');E('app')&&(E('app').style.display='none');
    document.body.style.cssText='margin:0;background:#fff;color:#111';
    var r=E('public-live-root');if(!r){r=document.createElement('main');r.id='public-live-root';r.className='public-live-page';document.body.innerHTML='';document.body.appendChild(r)}return r;
  }
  function renderCrash(d){var r=publicRoot(),rows=(d.items||[]).map(function(it,i){var st=it.status||((n2(it.available)<=0)?'Out of stock':(n2(it.available)<n2(it.required)?'Less than required':'Available')),cls=st==='Out of stock'?'status-out':(st==='Less than required'?'status-low':'status-ok');return '<tr><td>'+(i+1)+'</td><td><b>'+esc2(it.name||'')+'</b></td><td>'+esc2(it.strength||it.concentration||'—')+'</td><td>'+n2(it.required)+'</td><td>'+n2(it.available)+'</td><td class="'+cls+'">'+esc2(st)+'</td><td>'+((it.batches||[]).map(function(b){return dateOnly(b.expiry)+' → '+esc2(b.qty===''?'—':b.qty)}).join('<br>')||'—')+'</td></tr>'}).join('');r.innerHTML='<div class="live-head"><h1>'+esc2(d.name||'Crash Cart')+'</h1><h2>'+esc2(d.department||'')+'</h2><div class="live-meta"><span class="live-pill"><b>Last verification:</b> '+dateTime(d.lastClosedAt)+'</span><span class="live-pill"><b>Last update:</b> '+dateTime(d.updatedAt)+'</span><span class="live-pill"><b>Expiry Track:</b> Urgent ≤ '+n2((d.expiryRules||{}).urgentDays||7)+' days · Near expiry ≤ '+n2((d.expiryRules||{}).nearDays||30)+' days</span><span class="live-pill live-ok">● Live public view — no login</span></div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Generic name</th><th>Concentration</th><th>Standard quantity</th><th>Present</th><th>Status</th><th>Expiry date → Qty</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
  function liveCrash(id){var r=publicRoot(),collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');r.innerHTML='<h2>Loading latest Crash Cart information…</h2>';return collection.doc('crash_'+id).onSnapshot(function(s){if(!s.exists){r.innerHTML='<h2>Public Crash Cart record was not found.</h2><p>Print a new QR once from the system.</p>';return}renderCrash(s.data()||{})},function(e){r.innerHTML='<h2>Could not load the public Crash Cart page.</h2><p>'+esc2(e.message||e)+'</p>'})}
  function renderControlled(d){var r=publicRoot(),limit=Number(d.alertDays)||30,soonCount=0,expiredCount=0,rows=(d.items||[]).map(function(x,i){var itemSoon=false,itemExpired=false,bs=(x.batches||[]).map(function(b){var raw=b.expiry||'',dt=new Date(raw),days=isNaN(dt)?null:Math.ceil((dt-new Date())/86400000),cls='status-ok',label='';if(days!==null&&days<0){cls='status-out';label='Expired';itemExpired=true}else if(days!==null&&days<=limit){cls='status-low';label='Near expiry';itemSoon=true}else if(days!==null){label=days+' days'}return '<div class="'+cls+'">'+(b.qty!=null?esc2(b.qty)+' → ':'')+dateOnly(raw)+(label?' <b>('+esc2(label)+')</b>':'')+'</div>'}).join('')||'—';if(itemExpired)expiredCount++;else if(itemSoon)soonCount++;var rowCls=itemExpired?'status-out':(itemSoon?'status-low':'');return '<tr class="'+rowCls+'"><td>'+(i+1)+'</td><td><b>'+esc2(x.name||'')+'</b></td><td>'+esc2(x.classification||'—')+'</td><td>'+n2(x.qty)+'</td><td>'+bs+'</td></tr>'}).join('');r.innerHTML='<div class="live-head"><h1>Controlled Medicines List</h1><h2>'+esc2(d.departmentName||'')+'</h2><div class="live-meta"><span class="live-pill"><b>Near-expiry rule:</b> '+limit+' days</span><span class="live-pill status-low"><b>Near expiry:</b> '+soonCount+'</span><span class="live-pill status-out"><b>Expired:</b> '+expiredCount+'</span><span class="live-pill"><b>Last update:</b> '+dateTime(d.updatedAt)+'</span><span class="live-pill live-ok">● Live public view</span></div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Medicine</th><th>Class</th><th>Qty</th><th>Expiry batches and status</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
  function liveControlled(dept){var r=publicRoot(),collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');r.innerHTML='<h2>Loading latest controlled-medicine list…</h2>';return collection.doc(dept).onSnapshot(function(s){if(!s.exists){r.innerHTML='<h2>Public list was not found.</h2>';return}renderControlled(s.data()||{})},function(e){r.innerHTML='<h2>Could not load the public list.</h2><p>'+esc2(e.message||e)+'</p>'})}
  /* Rows are tinted by classification and list every class that applies, matching
     the departmental printouts. The flags ride along on each published batch;
     older documents published before that have none, in which case the row simply
     renders untinted rather than breaking. */
  function expiryClasses(x){
    var out=[];
    if(x.highAlert)out.push(['HIGH ALERT','#da3633']);
    if(x.lasa)out.push(['LASA','#6639ba']);
    if(x.hazard)out.push(['HAZARD','#b07d00']);
    if(x.refrigerated)out.push(['REFRIGERATED','#6f42c1']);
    return out;
  }
  function renderExpiry(d,dept){var r=publicRoot(),b=d.batches||[],rows=b.map(function(x,i){var dt=x.date||x.expiry||'';
    var cls=expiryClasses(x);
    var bg=x.highAlert?'#fff0f0':x.hazard?'#fffbea':x.lasa?'#f5f0ff':x.refrigerated?'#f3f0ff':'';
    var bc=x.highAlert?'#da3633':x.hazard?'#d29922':x.lasa?'#8957e5':x.refrigerated?'#8250df':'transparent';
    var tags=cls.map(function(c){return '<span style="color:'+c[1]+';font-weight:700;font-size:10px;white-space:nowrap">'+c[0]+'</span>'}).join('<span style="color:#bbb"> &middot; </span>');
    return '<tr style="'+(bg?'background:'+bg+';':'')+'border-left:3px solid '+bc+';print-color-adjust:exact;-webkit-print-color-adjust:exact">'
      +'<td>'+(i+1)+'</td><td><b>'+esc2(x.medication||x.name||'')+'</b>'+(tags?'<div style="margin-top:2px">'+tags+'</div>':'')+'</td>'
      +'<td>'+dateOnly(dt)+'</td><td>'+esc2(x.qty==null?'—':x.qty)+'</td></tr>'}).join('');r.innerHTML='<div class="live-head"><h1>Expiry Monitor</h1><h2>'+esc2(d.departmentName||dept||'')+'</h2><div class="live-meta"><span class="live-pill"><b>Last update:</b> '+dateTime(d.updatedAt)+'</span><span class="live-pill live-ok">● Live public view</span></div></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Medication</th><th>Expiry date</th><th>Qty</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
  function liveExpiry(dept){var r=publicRoot(),collection=window.fsTenantCollection?fsTenantCollection('public_expiry'):FB_DB.collection('public_expiry');r.innerHTML='<h2>Loading latest expiry data…</h2>';return collection.doc(dept).onSnapshot(function(s){if(!s.exists){r.innerHTML='<h2>Public expiry list was not found.</h2>';return}renderExpiry(s.data()||{},dept)},function(e){r.innerHTML='<h2>Could not load the public expiry page.</h2><p>'+esc2(e.message||e)+'</p>'})}

  // ── Classification list public view (no login) ──────────────────────────
  function fromFsVal(v){if(!v)return null;if(v.stringValue!==undefined)return v.stringValue;if(v.booleanValue!==undefined)return v.booleanValue;if(v.integerValue!==undefined)return Number(v.integerValue);if(v.doubleValue!==undefined)return v.doubleValue;if(v.nullValue!==undefined)return null;if(v.timestampValue!==undefined)return String(v.timestampValue);if(v.arrayValue!==undefined)return(v.arrayValue.values||[]).map(fromFsVal);if(v.mapValue!==undefined){var o={};Object.keys(v.mapValue.fields||{}).forEach(function(k){o[k]=fromFsVal(v.mapValue.fields[k])});return o;}return null;}
  function renderClassification(d){
    var r=publicRoot();
    var meds=d.medicines||[];
    var cols=3,perCol=Math.ceil(meds.length/cols);
    var tables=[];
    for(var c=0;c<cols;c++){var slice=meds.slice(c*perCol,(c+1)*perCol);if(!slice.length)break;var trows=slice.map(function(m,i){var gi=c*perCol+i;var bg=gi%2===0?'#fff':'#ddd';return '<tr style="background:'+bg+';print-color-adjust:exact;-webkit-print-color-adjust:exact"><td style="text-align:center;padding:3px 5px;font-size:8pt">'+(gi+1)+'</td><td style="padding:3px 6px;font-size:9pt"><b>'+esc2(m.name||m.generic||'')+'</b></td></tr>';}).join('');tables.push('<table style="border-collapse:collapse;flex:1;width:100%" border="1"><thead><tr style="background:#bbb;print-color-adjust:exact;-webkit-print-color-adjust:exact"><th style="width:26px;text-align:center;padding:3px 4px;font-size:8pt">#</th><th style="padding:3px 6px;font-size:9pt">'+(d.labelsEn||'Medications')+'</th></tr></thead><tbody>'+trows+'</tbody></table>');}
    r.style.cssText='font-family:Arial,sans-serif;padding:16px;max-width:960px;margin:0 auto';
    r.innerHTML=
      '<div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #333;padding-bottom:10px">'+
        '<h1 style="font-size:16pt;margin:0 0 2px;font-weight:700;direction:rtl">'+esc2(d.labelsAr||'')+'</h1>'+
        '<h2 style="font-size:13pt;margin:0 0 8px;font-weight:700">'+esc2(d.labelsEn||'')+'</h2>'+
        '<p style="font-size:8.5pt;color:#444;margin:0">'+
          '<b>Approval / الاعتماد:</b> '+esc2((d.approvedAt||'').slice(0,10))+
          ' &nbsp;·&nbsp; <b>Effective / الفعالية:</b> '+esc2((d.effectiveAt||'').slice(0,10))+
          ' &nbsp;·&nbsp; <b>Valid until / صالح حتى:</b> '+esc2((d.expiresAt||'').slice(0,10))+
        '</p>'+
      '</div>'+
      '<div style="display:flex;gap:6px;align-items:flex-start">'+tables.join('')+'</div>'+
      '<div style="text-align:center;margin-top:14px;font-size:8pt;color:#555;border-top:1px solid #ddd;padding-top:6px">'+
        '✔ هذه القائمة معتمدة إلكترونياً ولا تحتاج إلى ختم أو توقيع يدوي. | This list is electronically approved and does not require a stamp or manual signature.'+
      '</div>'+
      '<p style="text-align:center;font-size:7.5pt;color:#aaa">Reference: '+esc2(d.referenceName||'—')+'</p>'+
      '<div style="text-align:center;margin-top:10px"><button onclick="window.print()" style="padding:8px 20px;font-size:13px;cursor:pointer">🖨 Print / طباعة</button></div>';
  }
  async function liveClassification(type,tenant){
    var r=publicRoot();r.innerHTML='<p style="text-align:center;padding:40px">Loading… / جاري التحميل</p>';
    var API_KEY='AIzaSyBlcFhBTaJ9so8MlCLa_JTtUpQxCbEwuzU',PROJECT='floorstock-6ac2d';
    var path=tenant?'tenants/'+encodeURIComponent(tenant)+'/public_classification/'+encodeURIComponent(type):'public_classification/'+encodeURIComponent(type);
    var url='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/'+path+'?key='+API_KEY;
    try{
      var res=await fetch(url);
      if(!res.ok)throw new Error('HTTP '+res.status);
      var json=await res.json();
      if(!json.fields){r.innerHTML='<p style="text-align:center;padding:40px">List not published yet. Ask the pharmacy to save the list once from the system. / القائمة لم تُنشر بعد.</p>';return;}
      var fields={};Object.keys(json.fields).forEach(function(k){fields[k]=fromFsVal(json.fields[k]);});
      renderClassification(fields);
    }catch(e){r.innerHTML='<p style="text-align:center;padding:40px;color:red">Could not load the list: '+esc2(e.message)+'</p>';}
  }

  var _publicLiveUnsub=null;
  function clearPublicLiveSubscriptions(){
    if(typeof _publicLiveUnsub==='function'){
      try{_publicLiveUnsub()}catch(e){console.warn('Public listener cleanup failed',e)}
    }
    _publicLiveUnsub=null;
  }
  async function startPublicLive(){
    var p=new URLSearchParams(location.search),v=p.get('view'),unsub=null;
    if(v==='classification'&&p.get('type')){liveClassification(p.get('type'),p.get('tenant')||'');return true;}
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
})();

export {};

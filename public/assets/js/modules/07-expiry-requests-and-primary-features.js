import { publishLegacy } from '../core/legacy-registry.js';

// ── EXPIRY DATES ─────────────────────────────────────────
function renderShelfAlertSettings(){
  if(!CU||CU.role!=='department')return;
  var cfg=getAlertSettings(CU.deptId);
  if(el('alert-days1'))el('alert-days1').value=cfg.d1||30;
  if(el('alert-days2'))el('alert-days2').value=cfg.d2||7;
}
function openAddExpiry(){
  el('mexpiry-title').textContent='Add Expiry / إضافة تاريخ صلاحية';
  var ms=getMeds(CU.deptId);
  el('exp-med-sel').innerHTML=ms.map(function(m){return '<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>'}).join('');
  el('exp-batch-inp').value='';
  el('exp-date-inp').value='';
  el('exp-edit-id').value='';
  OM('mexpiry');
}
function openEditExpiry(btn){
  el('mexpiry-title').textContent='Edit Expiry / تعديل تاريخ الصلاحية';
  var ms=getMeds(CU.deptId);
  el('exp-med-sel').innerHTML=ms.map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===btn.dataset.mid?' selected':'')+'>'+esc(m.name)+'</option>'}).join('');
  el('exp-batch-inp').value=btn.dataset.batch||'';
  el('exp-date-inp').value=btn.dataset.date||'';
  el('exp-edit-id').value=btn.dataset.bid||'';
  OM('mexpiry');
}
// ── USERS
// ── USERS ────────────────────────────────────────────────
function renderUsers(){
  if(typeof canManageUsers==='function'&&!canManageUsers()){el('utbl').innerHTML='<tr><td colspan="4" style="text-align:center;padding:24px">User management is restricted to the Pharmacy Director.</td></tr>';return}
  var us=gu(),ds=gd();
  el('utbl').innerHTML=us.length
    ?us.map(function(u){
      var d=ds.find(function(x){return x.id===u.deptId});
      var roleLabel=u.role==='pharmacy'?'Pharmacy Director':(u.role==='inpatient_supervisor'?'Inpatient Pharmacy Supervisor':(u.role==='outpatient_pharmacy_supervisor'?'Outpatient Pharmacy Supervisor':(u.role==='pharmacy_staff'?'Pharmacy Employee':(u.role==='controlled_pharmacy'?'Controlled medicines pharmacy officer':(u.role==='warehouse'?'Warehouse':'Department')))));
      var masterBadge=u.master===true?' <span class="badge bpu">Master</span>':'';
      var actions='';
      if(CU&&CU.master===true&&u.id!==CU.id){
        actions+='<button class="btn bg bxs" data-user-action="toggle-master" data-id="'+esc(u.id)+'" data-master="'+(u.master===true?'1':'0')+'">'+(u.master===true?'Remove Master':'Grant Master')+'</button> ';
        actions+='<button class="btn bd2c bxs" data-user-action="delete" data-id="'+esc(u.id)+'">Delete permanently</button>';
      }else if(u.id===CU.id){actions='<span style="font-size:11px;color:var(--tx2)">Current user</span>';}
      else{actions='<span style="font-size:11px;color:var(--tx2)">Master only</span>';}
      return '<tr><td style="font-family:var(--mono)">'+esc(u.email||'')+'</td>'
        +'<td>'+roleLabel+masterBadge+(d?' — '+esc(d.name):'')+'</td>'
        +'<td><span class="badge '+(u.active===false?'brd':'bgn')+'">'+(u.active===false?'Inactive':'Active')+'</span></td>'
        +'<td>'+actions+'</td></tr>';
    }).join('')
    :'<tr><td colspan="4" style="text-align:center;color:var(--tx2);padding:18px">No managed users yet</td></tr>';
  el('dlst').innerHTML=ds.length
    ?ds.map(function(d){
      var medCount=getMeds(d.id).length;
      var userCount=us.filter(function(u){return u.deptId===d.id}).length;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid var(--bd);gap:10px">'
        +'<div style="flex:1"><div style="font-weight:600">'+esc(d.name)+'</div><div style="font-size:11px;color:var(--tx2);margin-top:2px"><span class="chip">'+medCount+' medications</span> <span class="chip">'+userCount+' users</span></div></div>'
        +'<div style="display:flex;gap:6px;flex-shrink:0"><button class="btn bg bxs" data-dept-action="rename" data-id="'+esc(d.id)+'" data-name="'+esc(d.name)+'">✏ Rename</button><button class="btn bp bxs" data-dept-action="view-meds" data-id="'+esc(d.id)+'">📋 View Meds</button><button class="btn bd2c bxs" data-dept-action="delete" data-id="'+esc(d.id)+'">🗑 Delete</button></div></div>';
    }).join(''):'<div style="text-align:center;padding:24px;color:var(--tx2)">No departments yet — add one above</div>';
  var ndcopy=el('ndcopy');
  if(ndcopy){var curVal=ndcopy.value;ndcopy.innerHTML='<option value="empty">Empty list — no medicines copied</option><option value="default">Default list (all medications)</option><optgroup label="Copy from existing dept:">'+ds.map(function(d){return '<option value="'+esc(d.id)+'">Copy from: '+esc(d.name)+' ('+getMeds(d.id).length+' meds)</option>'}).join('')+'</optgroup>';if(curVal)ndcopy.value=curVal;}
  el('nudept').innerHTML=ds.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  bindUserPageActions();
}
function bindUserPageActions(){
  var userTable=el('utbl');
  if(userTable&&!userTable.dataset.actionsBound){
    userTable.dataset.actionsBound='1';
    userTable.addEventListener('click',function(event){
      var button=event.target&&event.target.closest?event.target.closest('[data-user-action]'):null;
      if(!button||!userTable.contains(button))return;
      event.preventDefault();
      var id=button.getAttribute('data-id')||'';
      if(button.dataset.userAction==='delete')delUser(id);
      else if(button.dataset.userAction==='toggle-master')toggleMasterUser(id,button.getAttribute('data-master')==='1');
    });
  }
  var departmentList=el('dlst');
  if(departmentList&&!departmentList.dataset.actionsBound){
    departmentList.dataset.actionsBound='1';
    departmentList.addEventListener('click',function(event){
      var button=event.target&&event.target.closest?event.target.closest('[data-dept-action]'):null;
      if(!button||!departmentList.contains(button))return;
      event.preventDefault();
      var id=button.getAttribute('data-id')||'',action=button.dataset.deptAction;
      if(action==='rename')renameDept(id,button.getAttribute('data-name')||'');
      else if(action==='delete')delDept(id);
      else if(action==='view-meds'){
        showPg('pg-inv');
        var selector=el('inv-dept-sel');if(selector)selector.value=id;
        renderInv();
      }
    });
  }
}
function updateUserRoleFields(){
  var role=el('nurole').value;
  el('nudept-wrap').style.display=(role==='department'||role==='outpatient_pharmacy_supervisor')?'block':'none';
  el('numaster-wrap').style.display=(isMasterActual()&&role==='pharmacy')?'block':'none';
  if(role!=='pharmacy')el('numaster').checked=false;
  var deptSelect=el('nudept');
  if(deptSelect&&role==='outpatient_pharmacy_supervisor'){
    var out=gd().filter(function(d){return /outpatient\s+department/i.test(String(d.name||d.nameEn||''))||String(d.id||'').toLowerCase()==='outpatient'});
    deptSelect.innerHTML=out.length?out.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join(''):'<option value="">OUTPATIENT DEPARTMENT not found</option>';
    deptSelect.disabled=!out.length;
  } else if(deptSelect){var allDepartments=gd();deptSelect.innerHTML=allDepartments.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');deptSelect.disabled=!allDepartments.length;}
}
function openAddUser(){
  try{
    if(!CU||CU.role!=='pharmacy'){
      toast('Only the Pharmacy Manager may create users.','err');
      return;
    }
    var emailInput=el('nuname');
    var passInput=el('nupass');
    var roleSelect=el('nurole');
    var masterInput=el('numaster');
    var modal=el('muser');
    if(!emailInput||!passInput||!roleSelect||!masterInput||!modal){
      throw new Error('Add User form is missing from the current page. Upload the latest index.html and refresh.');
    }
    emailInput.value='';
    passInput.value='';
    roleSelect.value='department';
    masterInput.checked=false;
    var deptSelect=el('nudept');
    var departments=gd();
    if(deptSelect){
      deptSelect.innerHTML=departments.length
        ? departments.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>';}).join('')
        : '<option value="">No departments available — add a department first</option>';
      deptSelect.disabled=!departments.length;
    }
    updateUserRoleFields();
    modal.classList.add('on');
    setTimeout(function(){emailInput.focus();},50);
  }catch(err){
    console.error('openAddUser failed:',err);
    toast(err.message||'Could not open Add User form.','err');
  }
}
async function saveUser(){
  if(!canManageUsers())return toast('Only the Pharmacy Director may create users.','err');
  var email=el('nuname').value.trim(),password=el('nupass').value,did=el('nudept').value,requestedRole=el('nurole').value,grantMaster=el('numaster').checked===true;
  if(grantMaster&&gu().some(function(u){return u.master===true}))return toast('Only one Master user is allowed.','err');
  if(!email||!password)return toast('Fill all fields','err');
  if(password.length<8)return toast('Password must be at least 8 characters','err');
  if((requestedRole==='department'||requestedRole==='outpatient_pharmacy_supervisor')&&!did)return toast('Choose the supervisor department before creating this user.','err');
  if(grantMaster&&(!CU.master||requestedRole!=='pharmacy'))return toast('Only a Master may grant Master access to a pharmacy user.','err');
  try{
    var functionsClient=await ensureFirebaseFunctions();var call=functionsClient.httpsCallable('createManagedUser');
    var result=await call({email:email,password:password,role:requestedRole,deptId:(requestedRole==='department'||requestedRole==='outpatient_pharmacy_supervisor')?did:null,master:grantMaster});
    toast('Firebase user created securely ✓','succ');CM('muser');
    await S.loadUsers();renderUsers();
  }catch(err){console.error(err);toast((err&&err.message)||'Could not create Firebase user','err');}
}
async function delUser(id){
  if(!CU||CU.master!==true)return toast('Only Master can permanently delete users.','err');
  if(id===CU.id)return toast('You cannot delete your own account.','err');
  if(!await uiConfirm('Permanently delete this user from Firebase Authentication and Firestore?\n\nThis cannot be undone.'))return;
  try{var functionsClient=await ensureFirebaseFunctions();var call=functionsClient.httpsCallable('deleteManagedUser');await call({uid:id});await S.loadUsers();toast('User permanently deleted','info');renderUsers();}
  catch(err){console.error(err);toast((err&&err.message)||'Could not delete user','err');}
}
async function toggleMasterUser(id,isMaster){
  if(!CU||CU.master!==true)return toast('Only Master can change Master access.','err');
  var action=isMaster?'remove Master access from':'grant Master access to';
  if(!await uiConfirm('Are you sure you want to '+action+' this user?'))return;
  try{var functionsClient=await ensureFirebaseFunctions();var call=functionsClient.httpsCallable('setMasterAccess');await call({uid:id,master:!isMaster});await S.loadUsers();toast('Master access updated ✓','succ');renderUsers();}
  catch(err){console.error(err);toast((err&&err.message)||'Could not update Master access','err');}
}
// ── ANALYTICS ────────────────────────────────────────────
function renderAn(){
  var p=el('aperiod').value;
  el('crange').style.display=p==='custom'?'flex':'none';
  var dsel=el('adept');
  if(dsel.options.length<=1)gd().forEach(function(d){dsel.innerHTML+='<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'});
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
  if(jumpZero&&!jumpZero.dataset.bound){jumpZero.dataset.bound='1';jumpZero.addEventListener('click',function(){el('analytics-zero-card').scrollIntoView({behavior:'smooth',block:'start'})})}
  if(jumpCompare&&!jumpCompare.dataset.bound){jumpCompare.dataset.bound='1';jumpCompare.addEventListener('click',function(){el('analytics-compare-card').scrollIntoView({behavior:'smooth',block:'start'})})}
  var needle=search?String(search.value||'').trim().toLowerCase():'';var matches=Object.keys(compare).map(function(k){return compare[k]}).filter(function(c){return !needle||c.name.toLowerCase().indexOf(needle)>=0});
  var compareHost=el('analytics-item-compare');if(compareHost){compareHost.innerHTML=matches.length?matches.sort(function(a,b){return b.total-a.total}).slice(0,20).map(function(c){var rows=Object.keys(c.departments).sort(function(a,b){return c.departments[b]-c.departments[a]}).map(function(d){var dep=gd().find(function(x){return String(x.id)===String(d)}),q=c.departments[d];return '<tr><td>'+esc(dep?dep.name:d)+'</td><td style="text-align:right;font-family:var(--mono)">'+q+'</td><td style="text-align:right;font-family:var(--mono)">'+(c.total?Math.round(q/c.total*1000)/10:0)+'%</td></tr>'}).join('');return '<div class="card" style="margin-top:10px"><div class="ch"><span class="ct">'+esc(c.name)+'</span><span class="ss">Total '+c.total+' · '+c.orders+' orders</span></div><div class="tw"><table><thead><tr><th>Department</th><th style="text-align:right">Quantity</th><th style="text-align:right">Share</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'}).join(''):'<div style="padding:12px;color:var(--tx2)">'+(needle?'No matching item in the selected period.':'Type an item name to compare department consumption.')+'</div>'}
  var tot={},totMeta={};
  rs.forEach(function(r){(r.dispensed||[]).forEach(function(d){var qty=Number(d.qty)||0,meta=catalog[r.deptId+'|'+d.medId];if(qty<=0)return;var key=meta?meta.key:(String(d.medName||d.name||d.medId||'').trim().toLowerCase().replace(/\s+/g,' ')+'|');tot[key]=(tot[key]||0)+qty;if(!totMeta[key])totMeta[key]={name:meta?meta.name:(d.medName||d.name||d.medId),high_alert:!!(meta&&meta.high_alert)};else if(meta&&meta.high_alert)totMeta[key].high_alert=true})});
  var srt=Object.keys(tot).map(function(k){return[k,tot[k]]}).sort(function(a,b){return b[1]-a[1]});
  // Keep the medication catalog in the same department scope as the request filter.
  // Without this, Zero Dispense mixed every department's catalog into the selected one.
  var allMs=df?getMeds(df).map(function(m){return Object.assign({deptId:df},m)}):gd().reduce(function(acc,d){return acc.concat(getMeds(d.id).map(function(m){return Object.assign({deptId:d.id},m)}));},[]);
  /* High-alert medicines have their own dedicated panel. Keep the general
     Top 10 useful for routine consumption by excluding them here. */
  var t10=srt.filter(function(e){return !(totMeta[e[0]]&&totMeta[e[0]].high_alert)}).slice(0,10),mx1=t10[0]?t10[0][1]:1;
  el('ctop').innerHTML=t10.length
    ?t10.map(function(e){var m=totMeta[e[0]];return '<div class="brow"><div class="blbl" title="'+(m?m.name:e[0])+'">'+(m?m.name:e[0])+'</div><div class="btrk"><div class="bfil" style="width:'+Math.round(e[1]/mx1*100)+'%;background:var(--ac)"><span class="bval">'+e[1]+'</span></div></div></div>'}).join('')
    :'<div style="padding:14px;color:var(--tx2)">No data</div>';
  var ha=srt.filter(function(e){return totMeta[e[0]]&&totMeta[e[0]].high_alert}).slice(0,10);
  var mx2=ha[0]?ha[0][1]:1;
  el('cha').innerHTML=ha.length
    ?ha.map(function(e){var m=totMeta[e[0]];return '<div class="brow"><div class="blbl">'+(m?m.name:e[0])+'</div><div class="btrk"><div class="bfil" style="width:'+Math.round(e[1]/mx2*100)+'%;background:var(--rd)"><span class="bval">'+e[1]+'</span></div></div></div>'}).join('')
    :'<div style="padding:14px;color:var(--tx2)">No data</div>';
  var usedKeys=Object.keys(tot),zeroMap={};
  allMs.forEach(function(m){if(usedKeys.indexOf(analyticsMedKey(m))>=0)return;var key=analyticsMedKey(m),z=zeroMap[key]||(zeroMap[key]={med:m,departments:[]}),dep=gd().find(function(d){return String(d.id)===String(m.deptId||df)}),name=dep?dep.name:(df?((gd().find(function(d){return String(d.id)===String(df)})||{}).name||df):'Department');if(z.departments.indexOf(name)<0)z.departments.push(name)});
  var zero=Object.keys(zeroMap).map(function(k){return zeroMap[k]});
  var zc=el('azero-count'),au=el('analytics-units'),ar=el('analytics-requests');
  if(zc)zc.textContent=zero.length;
  if(au)au.textContent=Object.keys(tot).reduce(function(s,k){return s+Number(tot[k]||0)},0);
  if(ar)ar.textContent=rs.length;
  el('ztbl').innerHTML=zero.length
    ?zero.map(function(z){var m=z.med;return '<tr><td>'+m.name+'</td><td>'+z.departments.join(', ')+'</td><td><span class="chip">'+m.category+'</span></td><td>'+bdg(m)+'</td><td style="font-family:var(--mono)">'+m.min+'</td><td style="font-family:var(--mono)">'+m.max+'</td></tr>'}).join('')
    :'<tr><td colspan="6" style="text-align:center;color:var(--gnl);padding:18px">All dispensed ✓</td></tr>';
  if(typeof window.renderAnalyticsReports==='function')window.renderAnalyticsReports();
}

// ── ORDER RETENTION (6 MONTHS) ───────────────────────────
function orderRetentionCutoff(){var d=new Date();d.setMonth(d.getMonth()-6);return d}
function requestArchiveRecord(r){
  return {id:r.id,deptId:r.deptId||'',deptName:r.deptName||'',created:r.created||r.fulfilledAt||nowISO(),fulfilledAt:r.fulfilledAt||'',status:r.status||'fulfilled',dispensed:(r.dispensed||[]).map(function(x){return {medId:x.medId,qty:Number(x.qty)||0}})};
}
async function cleanupOldOrders(autoMode){
  if(!CU||CU.role!=='pharmacy')return;
  if(!autoMode&&CU.master!==true)return toast('Only Master can delete old orders manually.','err');
  var cutoff=orderRetentionCutoff(), all=gr(), old=all.filter(function(r){var dt=new Date(r.created||r.fulfilledAt||0);return !isNaN(dt)&&dt<cutoff});
  if(!old.length){if(!autoMode)toast('No orders older than 6 months.','info');return}
  if(!autoMode&&!await uiConfirm('Delete '+old.length+' orders older than 6 months? Their dispensed quantities will remain in Analytics.'))return;
  var archive=(S.g('request_analytics_archive')||[]).slice(), ids={};archive.forEach(function(x){ids[x.id]=true});
  old.forEach(function(r){if(r.status!=='pending'&&!ids[r.id])archive.push(requestArchiveRecord(r))});
  // Requests are deleted only from order history. Medication, shelf and expiry databases are separate keys and are never touched here.
  await S.s('request_analytics_archive',archive);
  await S.s('requests',all.filter(function(r){return old.indexOf(r)<0}));
  if(!autoMode)toast(old.length+' old orders deleted; analytics preserved.','succ');
  if(document.querySelector('#pg-print.on'))renderPrint();
}
globalThis._orderCleanupStarted = false;
function scheduleAutomaticOrderCleanup(){
  if(_orderCleanupStarted||!CU||CU.role!=='pharmacy')return;_orderCleanupStarted=true;
  cleanupOldOrders(true).catch(function(e){console.error('Automatic order cleanup failed',e)});
}

// ── PRINT (ORDER FORMS) ──────────────────────────────────
// Final Print Orders renderer/engine is installed later in one canonical module.
globalThis.PPP = 0; // employee must choose 2, 3, 4, or 5 orders per page
function setPPP(n,btn){
  PPP=n;
  document.querySelectorAll('.ppp-btn').forEach(function(b){b.classList.remove('on')});
  if(btn)btn.classList.add('on');
}
function resetPrintPageState(){PPP=0;document.querySelectorAll('.ppp-btn').forEach(function(b){b.classList.remove('on')})}

// ── IMPORT ───────────────────────────────────────────────
function renderImport(){
  var dsel=el('imp-dept');
  if(dsel){dsel.innerHTML='<option value="">Select target department...</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');dsel.value=''}
  if(typeof window.restoreImportDraft==='function'&&window.restoreImportDraft())return;
  IROWS=[];
  el('imp-ptitle').textContent='Preview';
  var ia=el('imp-actions');if(ia)ia.style.cssText='display:none';
  el('imp-prev').innerHTML='<div style="text-align:center;padding:40px 0;opacity:.5;color:var(--tx2)"><div style="font-size:36px;margin-bottom:8px">📄</div>Upload or paste, then click Parse</div>';
}
function clearImport(){
  if(typeof window.clearImportDraftState==='function')window.clearImportDraftState();
  var ta=el('imp-txt');if(ta)ta.value='';
  var dz=el('xlsx-drop-zone');
  if(dz){dz.style.borderColor='var(--bd)';dz.querySelector('div:nth-child(2)').textContent='Upload Excel / CSV file';}
  renderImport();
}

// Standalone-friendly Excel loader: try several mirrors before asking for paste mode.
async function ensureXLSX(){
  if(typeof XLSX!=='undefined')return true;
  var urls=[
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
  ];
  var lastErr=null;
  for(var i=0;i<urls.length;i++){
    try{
      await new Promise(function(resolve,reject){
        var sc=document.createElement('script');
        sc.src=urls[i];sc.async=true;
        sc.onload=function(){typeof XLSX!=='undefined'?resolve(true):reject(new Error('XLSX unavailable'))};
        sc.onerror=function(){reject(new Error('Excel library source '+(i+1)+' failed'))};
        document.head.appendChild(sc);
      });
      if(typeof XLSX!=='undefined')return true;
    }catch(e){lastErr=e;}
  }
  throw lastErr||new Error('Excel library unavailable');
}

// ── XLSX UPLOAD HANDLER ──────────────────────────────────
function handleXlsxDrop(e){
  e.preventDefault();
  var f=e.dataTransfer.files[0];
  if(f)handleXlsxFile(f);
}
async function handleXlsxFile(file){
  if(!file)return;
  try{await ensureXLSX()}catch(e){toast('تعذر تحميل قارئ Excel. تأكد من الاتصال بالإنترنت أو استخدم وضع اللصق.\nThe Excel reader could not be loaded. Check your internet connection or use Paste mode.','err');return;}
  var ext=file.name.split('.').pop().toLowerCase();
  var dz=el('xlsx-drop-zone');
  if(dz){var h2=dz.querySelector('.upload-status');if(!h2){h2=document.createElement('div');h2.className='upload-status';h2.style.cssText='font-size:12px;color:var(--acl);margin-top:8px';dz.appendChild(h2);}h2.textContent='⏳ Reading: '+file.name;}
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      if(ext==='csv'){parseCsvData(ev.target.result);}
      else{parseXlsxData(ev.target.result,file.name);}
    }catch(err){toast('Error: '+err.message,'err');console.error(err);}
  };
  if(ext==='csv') reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}
function parseCsvData(text){
  // Convert CSV to paste-style then use text parser
  el('imp-txt').value=text;
  parseImport();
}
function parseXlsxData(buffer,fname){
  var wb=XLSX.read(buffer,{type:'array',cellStyles:true});
  var wsName=wb.SheetNames[0];
  var ws=wb.Sheets[wsName];
  var ref=ws['!ref'];
  if(!ref){toast('Empty sheet','err');return;}
  var range=XLSX.utils.decode_range(ref);

  // ── Color detection helpers ──
  function getCellBg(addr){
    var c=ws[addr];if(!c||!c.s)return null;
    try{
      var fg=c.s.fgColor;
      if(fg){
        var rgb=(fg.rgb||fg.argb||'').toUpperCase();
        if(rgb&&rgb!=='00000000'&&rgb!=='FFFFFFFF'&&rgb!=='FFFFFF'&&rgb.length>=6)return rgb;
      }
      var bg=c.s.bgColor;
      if(bg){
        var rgb2=(bg.rgb||bg.argb||'').toUpperCase();
        if(rgb2&&rgb2!=='00000000'&&rgb2!=='FFFFFFFF'&&rgb2!=='FFFFFF'&&rgb2.length>=6)return rgb2;
      }
    }catch(e){}
    return null;
  }
  // Red = High Alert (FF0000, FFFF0000)
  function isHA(bg){
    if(!bg)return false;
    var s=bg.replace(/^FF/,'');
    return s==='FF0000'||s==='FF0000FF'||bg==='FFFF0000'||bg==='FF0000';
  }
  // Yellow = Hazard (FFFF00, FFFFFF00)
  function isHZ(bg){
    if(!bg)return false;
    var s=bg.replace(/^FF/,'');
    return s==='FFFF00'||bg==='FFFFFF00'||bg==='FFFF00';
  }
  // Gray = Category header (BFBFBF, C0C0C0, etc.)
  function isCatHdr(bg){
    if(!bg)return false;
    var s=bg.replace(/^FF/,'');
    return s==='BFBFBF'||s==='C0C0C0'||s==='BDBDBD'||s==='BBBBBB'||s==='CCCCCC'||s==='D9D9D9';
  }

  function getCellText(addr){
    var c=ws[addr];if(!c||c.t==='e')return null;
    var v=c.v;if(v===undefined||v===null)return null;
    var s=String(v).trim();
    if(!s||/^#(REF|VALUE|NAME|DIV\/0|N\/A|NUM|NULL)/i.test(s))return null;
    return s.replace(/\n/g,' ').replace(/\r/g,' ').replace(/\s+/g,' ').trim()||null;
  }
  function getCellNum(addr){
    var c=ws[addr];if(!c||c.t==='e')return null;
    var v=c.v;if(v===undefined||v===null||v==='')return null;
    var s=String(v).trim();
    if(!s||/^#|^=/i.test(s))return null;
    var n=Number(s.replace(/,/g,''));
    return Number.isFinite(n)?n:null;
  }

  var drugs=[];
  var currentCat='Injections';
  var incomplete=[];  // track rows with missing min/max

  for(var R=range.s.r;R<=range.e.r;R++){
    var aAddr=XLSX.utils.encode_cell({r:R,c:0});
    var bAddr=XLSX.utils.encode_cell({r:R,c:1});
    var cAddr=XLSX.utils.encode_cell({r:R,c:2});

    var aText=getCellText(aAddr);
    var bNum=getCellNum(bAddr);
    var cNum=getCellNum(cAddr);
    var aBg=getCellBg(aAddr);

    // Skip completely empty rows
    if(!aText&&bNum===null&&cNum===null)continue;
    // Skip formula-only rows
    if(!aText&&bNum===null)continue;

    // ── Category header row? ──
    // Category rows in real hospital files may contain 0/0 formulas or #REF! in Min/Max.
    // A recognized category name is therefore always treated as a heading, never a medicine.
    var catFromName=aText?recognizeCat(aText):null;
    if(catFromName&&aText){
      currentCat=catFromName;
      continue;
    }
    if(isCatHdr(aBg)&&aText&&(bNum===null||bNum===0)&&(cNum===null||cNum===0))continue;

    // ── Must have a name to be a drug row ──
    if(!aText||aText.length<2)continue;

    // ── Skip if name looks like a header label ──
    if(/^(medication|drug|name|item|description)$/i.test(aText))continue;

    var ha=isHA(aBg);
    var hz=isHZ(aBg);
    var cat=currentCat||autoDetectCat(aText);

    // ── Missing min or max — add but flag ──
    var hasMin=bNum!==null;
    var hasMax=cNum!==null;
    var mn=hasMin?Math.round(bNum):null;
    var mx=hasMax?Math.round(cNum):null;

    var drug={
      _i:drugs.length,
      name:aText,
      category:cat,
      min:mn!==null?mn:0,
      max:mx!==null?mx:0,
      high_alert:ha,
      hazard:hz,
      lasa:false,
      _del:false,
      _incomplete:(!hasMin||!hasMax),
      _missingMin:!hasMin,
      _missingMax:!hasMax
    };
    drugs.push(drug);
    if(!hasMin||!hasMax){
      incomplete.push({row:R+1,name:aText,missingMin:!hasMin,missingMax:!hasMax});
    }
  }

  IROWS=drugs;
  if(!drugs.length)return toast('No valid medications found in file','err');

  // ── Show warning for incomplete rows ──
  var warnMsg='';
  if(incomplete.length>0){
    warnMsg='<div class="alert-banner-y" style="margin-bottom:12px">⚠ <b>'+incomplete.length+' medications</b> are missing Min or Max values (shown in orange). Please fill them in before importing:<br><span style="font-size:11px">'+
      incomplete.slice(0,5).map(function(x){
        return x.name.slice(0,40)+(x.missingMin?' [missing Min]':'')+(x.missingMax?' [missing Max]':'');
      }).join('<br>')+
      (incomplete.length>5?'<br>...and '+(incomplete.length-5)+' more':'')
    +'</span></div>';
  }

  toast('Parsed '+drugs.length+' medications from '+fname+(incomplete.length?' — ⚠ '+incomplete.length+' incomplete':''),'succ');
  renderImportPreview(true,0,0,warnMsg);
}

function recognizeCat(name){
  var n=String(name||'').toLowerCase().replace(/\s+/g,' ').trim();
  // Match section headings only. Do not treat medicine names containing words
  // such as "eye drop", "ointment", "injection" or "solution" as headings.
  if(/^(injection|injections)$/.test(n))return 'Injections';
  if(/^(inhaler|inhalers)$/.test(n))return 'Inhalers';
  if(/^(tablet|tablets)$/.test(n))return 'Tablets';
  if(/^(syrup|syrups)$/.test(n))return 'Syrups';
  if(/^topicals?$/.test(n))return 'Topical';
  if(/^(solution|solutions)$/.test(n))return 'Solutions';
  if(/^(suppository|suppositories)$/.test(n))return 'Suppositories';
  if(/^(ointment|ointments|drop|drops|ointments?\s*&\s*drops?(?:\s*&\s*suppositor(?:y|ies))?)$/.test(n))return 'Ointments & Drops';
  return null;
}


// ── PASTE PARSER (smart) ─────────────────────────────────
function parseImport(){
  var raw=el('imp-txt').value;
  if(!raw.trim())return toast('Paste some data first','err');
  var lines=raw.split(/\n/);
  var headerIdx=-1,colMap={name:-1,min:-1,max:-1,ha:-1,hz:-1,ls:-1};
  var hdrKw={name:/^(name|medication|drug|item)/i,min:/^(min|minimum)/i,max:/^(max|maximum)/i,ha:/^(high.?alert|ha)$/i,hz:/^(hazard|hz)$/i,ls:/^(lasa|ls)$/i};
  for(var li=0;li<Math.min(lines.length,8);li++){
    var parts=lines[li].split(/\t/).map(function(p){return p.trim()});
    var mc=0,tm={name:-1,min:-1,max:-1,ha:-1,hz:-1,ls:-1};
    parts.forEach(function(p,pi){Object.keys(hdrKw).forEach(function(k){if(hdrKw[k].test(p)){tm[k]=pi;mc++;}});});
    if(mc>=2){headerIdx=li;colMap=tm;break;}
  }
  var hasHdr=headerIdx>-1,dataStart=hasHdr?headerIdx+1:0;
  var rows=[],skipped=0,lastName='';
  for(var i=dataStart;i<lines.length;i++){
    var line=lines[i];if(!line.trim()){skipped++;continue;}
    var parts=line.split(/\t/).map(function(p){return p.trim()});
    if(parts.every(function(p){return p===''})){skipped++;continue;}
    var numIdx=-1;
    for(var j=0;j<parts.length;j++){if(parts[j]!==''&&!isNaN(parts[j])){numIdx=j;break;}}
    var name='';
    if(hasHdr&&colMap.name>-1){name=(parts[colMap.name]||'').trim();}
    else{name=numIdx>0?parts.slice(0,numIdx).join(' ').trim():parts[0].trim();}
    // Skip header-like rows
    if(!name||name.length<2){skipped++;continue;}
    if(recognizeCat(name)){skipped++;continue;} // category header
    lastName=name;
    function getN(colKey,fallback){
      if(hasHdr&&colMap[colKey]>-1){var v=parts[colMap[colKey]];return(v&&!isNaN(v))?+v:0;}
      return numIdx>-1?(+(parts[numIdx+fallback]||0)||0):0;
    }
    function getF(colKey,fallback){
      if(hasHdr&&colMap[colKey]>-1){var v=(parts[colMap[colKey]]||'').toLowerCase();return v==='yes'||v==='1';}
      return numIdx>-1&&((parts[numIdx+fallback]||'').toLowerCase()==='yes');
    }
    var mn=getN('min',0)||1,mx=getN('max',1)||10;
    var ha=getF('ha',2),hz=getF('hz',3),ls=getF('ls',4);
    var selCat=el('imp-cat').value;
    var cat=selCat==='auto'?autoDetectCat(name):selCat;
    rows.push({_i:rows.length,name:name,min:mn,max:mx,high_alert:ha,hazard:hz,lasa:ls,category:cat,_del:false});
  }
  IROWS=rows;
  if(!rows.length)return toast('No valid rows found','err');
  renderImportPreview(hasHdr,headerIdx,skipped,'');
}

// ── SHARED PREVIEW RENDERER ──────────────────────────────
function renderImportPreview(hasHeader,headerIdx,skipped,warnMsg){
  var deptId=el('imp-dept').value;
  var deptName=(gd().find(function(d){return d.id===deptId})||{}).name||deptId;
  var existNames=getMeds(deptId).map(function(m){return m.name.toLowerCase()});
  // Re-index
  IROWS.forEach(function(r,i){r._i=i;});
  var active=IROWS.filter(function(r){return !r._del});
  var ia=el('imp-actions');
  if(ia){ia.style.cssText='display:flex;align-items:center;gap:8px';}
  el('imp-cbtn').style.display='';
  el('imp-ptitle').textContent='Preview: '+active.length+' meds for '+deptName;
  el('imp-count-txt').textContent=active.length+' items'+(skipped?' | '+skipped+' skipped':'')+(hasHeader?' | header detected':'');
  var CATS=['Injections','Inhalers','Suppositories','Tablets','Syrups','Topical','Ointments & Drops','Solutions'];
  var tableRows=IROWS.map(function(r){
    var dup=existNames.indexOf(r.name.toLowerCase())>-1;
    var catOpts=CATS.map(function(c){return '<option value="'+esc(c)+'"'+(r.category===c?' selected':'')+'>'+esc(c)+'</option>'}).join('');
    var rowBg=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':
              r._incomplete?'background:rgba(210,153,34,.12)':
              r.high_alert?'background:rgba(218,54,51,.07)':
              r.hazard?'background:rgba(210,153,34,.06)':'';
    return '<tr id="irow-'+r._i+'" style="'+rowBg+'">'
      +'<td style="padding:4px 8px"><input type="checkbox" class="imp-del-chk" data-idx="'+r._i+'"'+(r._del?'':' checked')+' onchange="impToggleRow(this)"></td>'
      +'<td style="padding:3px 4px;min-width:200px"><input class="imp-edit-input" data-idx="'+r._i+'" data-f="name" value="'+esc(r.name)+'" oninput="impEdit(this)" style="min-width:180px"></td>'
      +'<td style="padding:3px 4px"><select class="imp-edit-input" data-idx="'+r._i+'" data-f="category" onchange="impEdit(this)" style="font-size:11px;padding:3px 4px;min-width:90px">'+catOpts+'</select></td>'
      +'<td style="padding:3px 4px"><input class="imp-edit-input" type="number" data-idx="'+r._i+'" data-f="min" value="'+r.min+'" oninput="impEdit(this)" style="width:50px;text-align:center"></td>'
      +'<td style="padding:3px 4px"><input class="imp-edit-input" type="number" data-idx="'+r._i+'" data-f="max" value="'+r.max+'" oninput="impEdit(this)" style="width:50px;text-align:center"></td>'
      +'<td style="padding:3px 4px;white-space:nowrap">'
        +'<label title="High Alert" style="cursor:pointer"><input type="checkbox" data-idx="'+r._i+'" data-f="high_alert"'+(r.high_alert?' checked':'')+' onchange="impEdit(this)" style="width:auto;margin:0"> 🔴</label> '
        +'<label title="Hazard" style="cursor:pointer"><input type="checkbox" data-idx="'+r._i+'" data-f="hazard"'+(r.hazard?' checked':'')+' onchange="impEdit(this)" style="width:auto;margin:0"> 🟡</label> '
        +'<label title="LASA" style="cursor:pointer"><input type="checkbox" data-idx="'+r._i+'" data-f="lasa"'+(r.lasa?' checked':'')+' onchange="impEdit(this)" style="width:auto;margin:0"> 🟣</label>'
      +'</td>'
      +'<td style="padding:3px 6px">'+(dup&&!r._del?'<span class="badge byl">Update</span>':r._del?'<span class="badge bgr">Skip</span>':'<span class="badge bgn">New</span>')+'</td>'
      +'</tr>';
  }).join('');
  el('imp-prev').innerHTML=(warnMsg||'')+'<div class="tw" style="max-height:520px;overflow-y:auto">'
    +'<table style="font-size:12px"><thead><tr>'
    +'<th title="Uncheck to skip">✔</th><th>Medication Name</th><th>Category</th><th>Min</th><th>Max</th><th>Flags</th><th>Status</th>'
    +'</tr></thead><tbody>'+tableRows+'</tbody></table></div>';
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
function impEdit(inp){
  var idx=+inp.dataset.idx;var f=inp.dataset.f;
  if(f==='high_alert'||f==='hazard'||f==='lasa'){IROWS[idx][f]=inp.checked;}
  else if(f==='min'||f==='max'){IROWS[idx][f]=+inp.value||0;}
  else{IROWS[idx][f]=inp.value;}
  // update row bg
  var tr=document.getElementById('irow-'+idx);
  if(tr){
    var r=IROWS[idx];
    tr.style.cssText=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':
      r.high_alert?'background:rgba(218,54,51,.07)':
      r.hazard?'background:rgba(210,153,34,.06)':'';
  }
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
function impToggleRow(chk){
  var idx=+chk.dataset.idx;
  IROWS[idx]._del=!chk.checked;
  var tr=document.getElementById('irow-'+idx);
  if(tr){var r=IROWS[idx];tr.style.cssText=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':r.high_alert?'background:rgba(218,54,51,.07)':r.hazard?'background:rgba(210,153,34,.06)':'';}
  var active=IROWS.filter(function(r){return !r._del}).length;
  el('imp-count-txt').textContent=active+' items selected';
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
function impSelectAll(include){
  IROWS.forEach(function(r,i){
    r._del=!include;
    var chk=document.querySelector('.imp-del-chk[data-idx="'+i+'"]');
    if(chk)chk.checked=include;
    var tr=document.getElementById('irow-'+i);
    if(tr){tr.style.cssText=r._del?'background:rgba(218,54,51,.06);text-decoration:line-through;opacity:.55':r.high_alert?'background:rgba(218,54,51,.07)':r.hazard?'background:rgba(210,153,34,.06)':'';}
  });
  el('imp-count-txt').textContent=(include?IROWS.length:0)+' items selected';
  if(typeof window.saveImportDraft==='function')window.saveImportDraft();
}
async function confirmImport(){
  var toImport=IROWS.filter(function(r){return !r._del});
  if(!toImport.length)return toast('No items selected','err');
  // Check for still-incomplete rows (0 min AND 0 max means truly empty)
  var stillIncomplete=toImport.filter(function(r){return r._incomplete&&r.min===0&&r.max===0});
  if(stillIncomplete.length>0){
    return toast('⚠ '+stillIncomplete.length+' medications still have 0 Min AND 0 Max. Please fill them in the preview or uncheck to skip.','err');
  }
  var deptId=el('imp-dept').value;
  if(!deptId)return toast('Select a department','err');
  var existing=getMeds(deptId);
  var added=0,updated=0;
  for(var ri=0;ri<toImport.length;ri++){
    var r=toImport[ri];
    var idx=-1;existing.forEach(function(m,i){if(m.name.toLowerCase()===r.name.toLowerCase())idx=i;});
    if(idx>-1){await updMed(deptId,existing[idx].id,{min:r.min,max:r.max,high_alert:r.high_alert,hazard:r.hazard,lasa:r.lasa,category:r.category});updated++;}
    else{await pushMed(deptId,{name:r.name,category:r.category,min:r.min,max:r.max,monthly:null,high_alert:r.high_alert,hazard:r.hazard,lasa:r.lasa,created:nowISO()});added++;}
  }
  toast('Done: '+added+' added, '+updated+' updated ✓','succ');
  IROWS=[];el('imp-txt').value='';
  el('imp-prev').innerHTML='<div style="text-align:center;padding:30px;color:var(--gnl)"><div style="font-size:36px">✓</div><div style="margin-top:8px;font-weight:600">'+added+' added &middot; '+updated+' updated</div></div>';
  el('imp-ptitle').textContent='Import complete';
  var ia=el('imp-actions');if(ia)ia.style.cssText='display:none';
}

// ── DEPT DRUG LIST PRINT ─────────────────────────────────
function renderDeptPrint(){
  if(!CU||CU.role!=='department')return;
  el('deptprint-sub').textContent=CU.deptName+' — Drug List';
  el('deptprint-preview').innerHTML='<div style="color:var(--tx2);font-size:13px">Configure options above and click <b>Print</b>.</div>';
}
async function doDeptPrint(){
  if(!CU)return;

  var pw=window.open('about:blank','_dp_','width=820,height=700');
  if(!pw){
    toast('Allow pop-ups to print the department drug list.','err');
    return false;
  }

  pw.document.open();
  pw.document.write(
    '<!doctype html><html><head><meta charset="utf-8">'+
    '<title>Preparing department drug list</title></head>'+
    '<body style="font-family:Arial,Tahoma,sans-serif;padding:24px">'+
    'Preparing department drug list… / جاري تجهيز قائمة أدوية القسم…'+
    '</body></html>'
  );
  pw.document.close();

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
    var qrPrintRuntime=window.ASD_QR&&ASD_QR.printRuntimeScript?ASD_QR.printRuntimeScript({closeAfter:true}):'';
    var expiryPrintBlock='<div style="text-align:center;max-width:260px;margin:18px auto 8px;padding:10px;border:1px solid #bbb;border-radius:6px;page-break-inside:avoid"><div style="font-size:8pt;font-weight:700;margin-bottom:5px">Expiry Monitor / متابعة الصلاحية</div><img class="asd-qr-image" src="'+qrExpUrl+'" width="110" height="110" alt="Expiry monitor QR code"><div style="font-size:7pt;color:#555;margin-top:3px">Scan to open the public expiry monitor</div></div>';

    var grp={};
    ms.forEach(function(m){
      if(!grp[m.category])grp[m.category]=[];
      grp[m.category].push(m);
    });

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
        if(m.high_alert){bands.push('#ffe0e0');flags.push('HIGH ALERT / تنبيه عالي')}
        if(m.hazard){bands.push('#fff2b8');flags.push('HAZARD / خطر')}
        if(m.lasa){bands.push('#dbeafe');flags.push('LASA')}
        if(m.refrigerated){bands.push('#f3e8ff');flags.push('REFRIGERATED / مبرد')}
        var bc=m.high_alert?'#da3633':m.hazard?'#d29922':m.lasa?'#2563eb':m.refrigerated?'#7e22ce':'transparent';
        var bg=bands.length<2
          ?(bands[0]||'#ffffff')
          :'linear-gradient(180deg,'+bands.map(function(c,i){
            var a=(i*100/bands.length).toFixed(2);
            var b=((i+1)*100/bands.length).toFixed(2);
            return c+' '+a+'% '+b+'%';
          }).join(',')+')';
        var flagTxt=flags.join(' + ');
        var flagColor=m.high_alert
          ?'#b91c1c'
          :m.hazard
            ?'#92400e'
            :m.lasa
              ?'#1d4ed8'
              :m.refrigerated
                ?'#6b21a8'
                :'#000';
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

    pw.document.open();
    pw.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+deptName+' Drug List</title><style>'
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
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #000">'
      +'<div>'
      +'<div class="page-title">'+deptName+' — Floor Stock / مخزون الأدوية الأرضية</div>'
      +'<div class="page-sub">Print Date / تاريخ الطباعة: <b>'+today+'</b> &nbsp;|&nbsp; Total / الإجمالي: <b>'+ms.length+'</b> &nbsp;|&nbsp; By / بواسطة: <b>'+userName+'</b></div>'
      +'<div style="font-size:7pt;color:#666;margin-top:3px">Developed by Ali Abudahash | ASDHealth System</div>'
      +'</div>'
      +'<div style="text-align:center"><img class="asd-qr-image" src="'+qrUrl+'" width="150" height="150" alt="System"><div style="font-size:5.5pt;color:#888">System</div></div>'
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
      +'<img class="asd-qr-image" src="'+qrUrl+'" width="76" height="76" alt="QR">'
      +'</div>'
      +'<script>'
      +'if(!('+fitOne+')){var s=document.createElement("style");s.textContent="'
      +'@page{counter-increment:page;} @media print{'
      +'#footer{position:fixed;bottom:0;left:0;right:0;background:#fff;padding:4px 10px;border-top:1px solid #ccc}'
      +'}";document.head.appendChild(s);}'
      +qrPrintRuntime
      +'<\/script></body></html>'
    );
    pw.document.close();
    return true;
  }catch(error){
    console.error('Department drug list print failed',error);
    try{
      pw.document.open();
      pw.document.write(
        '<!doctype html><html><meta charset="utf-8"><body style="font-family:Arial,Tahoma,sans-serif;padding:24px">'+
        '<h2>Print preparation failed / تعذر تجهيز الطباعة</h2>'+
        '<p>'+esc(error&&error.message||error)+'</p>'+
        '</body></html>'
      );
      pw.document.close();
    }catch(ignore){}
    toast('Could not prepare the department drug list for printing.','err');
    return false;
  }
}
function catAr(cat){
  var m={'Injections':'\u062D\u0642\u0646','Tablets':'\u062D\u0628\u0648\u0628','Inhalers':'\u0628\u062E\u0627\u062E\u0627\u062A','Syrups':'\u0634\u0631\u0627\u0628\u0627\u062A','Suppositories':'\u062A\u062D\u0627\u0645\u064A\u0644','Topical':'\u0645\u0648\u0636\u0639\u064A','Ointments & Drops':'\u0645\u0631\u0627\u0647\u0645 \u0648\u0642\u0637\u0631\u0627\u062A','Solutions':'\u0645\u062D\u0627\u0644\u064A\u0644'};
  return m[cat]||cat;
}


// ── SHELVES ──────────────────────────────────────────────
function renderShelves(){
  renderShelfAlertSettings();
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},shelfRole=window.fsEffectiveRole?window.fsEffectiveRole():String(profile.role||''),shelfDept=String(profile.deptId||profile.departmentId||'');
  if(!profile||shelfRole!=='department'||!shelfDept)return;
  var shelfPrintCard=el('shelf-print-card'),shelfPrintTop=el('shelf-print-top-btn'),shelfPrintButton=el('print-shelf-btn');
  if(shelfPrintCard)shelfPrintCard.style.display='block';
  if(shelfPrintButton){shelfPrintButton.disabled=false;shelfPrintButton.style.display='inline-flex'}
  if(shelfPrintTop){shelfPrintTop.disabled=false;shelfPrintTop.style.display='inline-flex';shelfPrintTop.onclick=printShelfList}
  el('shelves-sub').textContent=(profile.deptName||shelfDept)+' — Shelf Management';
  var shelves=getShelves(shelfDept);
  var ms=getMeds(shelfDept);
  // Count meds per shelf
  var shelfCounts={};
  ms.forEach(function(m){if(m.shelfId){shelfCounts[m.shelfId]=(shelfCounts[m.shelfId]||0)+1;}});
  // Render shelves table
  el('shelves-tbl').innerHTML=shelves.length
    ?shelves.map(function(s){
      return '<tr><td><span class="shelf-badge">'+s.name+'</span></td>'
        +'<td style="color:var(--tx2);font-size:12px">'+(s.desc||'—')+'</td>'
        +'<td style="font-family:var(--mono)">'+(shelfCounts[s.id]||0)+' meds</td>'
        +'<td style="white-space:nowrap">'
          +'<button class="btn bg bxs" data-sid="'+s.id+'" data-name="'+s.name+'" data-desc="'+(s.desc||'')+'" onclick="openEditShelf(this)">✏</button> '
          +'<button class="btn bd2c bxs" data-sid="'+s.id+'" onclick="removeShelf(this.getAttribute(&#x27;data-sid&#x27;))">✕</button>'
        +'</td></tr>';
    }).join('')
    :'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx2)">No shelves yet — click + Add Shelf</td></tr>';
  // Populate print shelf selector
  var pSel=el('print-shelf-sel');
  if(pSel){pSel.innerHTML='<option value="all">All Shelves / &#x643;&#x644; &#x627;&#x644;&#x623;&#x631;&#x641;&#x641;</option>'
    +shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');}
  var assigned=ms.filter(function(m){return !!m.shelfId}).length;
  if(el('shelves-summary'))el('shelves-summary').innerHTML='<div class="sc" style="padding:12px"><div class="sl">Medications</div><div class="sv" style="font-size:22px">'+ms.length+'</div></div>'+'<div class="sc" style="padding:12px"><div class="sl">Assigned</div><div class="sv" style="font-size:22px">'+assigned+'</div></div>'+'<div class="sc" style="padding:12px"><div class="sl">Unassigned</div><div class="sv" style="font-size:22px">'+(ms.length-assigned)+'</div></div>';
  if(typeof renderShelfMedicationDatabase==='function')renderShelfMedicationDatabase();
}
function getShelfName(shelfId){
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},dept=String(profile.deptId||profile.departmentId||'');if(!dept)return '';
  var s=getShelves(dept).find(function(x){return x.id===shelfId});
  return s?s.name:'?';
}
function openAddShelf(){
  el('mshelf-title').textContent='Add Shelf / إضافة رف';
  el('shelf-name-inp').value='';el('shelf-desc-inp').value='';el('shelf-edit-id').value='';
  OM('mshelf');
}
function openEditShelf(btn){
  el('mshelf-title').textContent='Edit Shelf / تعديل رف';
  el('shelf-name-inp').value=btn.dataset.name||'';
  el('shelf-desc-inp').value=btn.dataset.desc||'';
  el('shelf-edit-id').value=btn.dataset.sid||'';
  OM('mshelf');
}
function printShelfList(){
  var profile=(window.fsEffectiveUser&&window.fsEffectiveUser())||CU||{},printRole=window.fsEffectiveRole?window.fsEffectiveRole():String(profile.role||''),deptId=String(profile.deptId||profile.departmentId||'');
  if(printRole!=='department'||!deptId)return toast('Shelf printing is available to department accounts for their own department. / طباعة الأرفف متاحة لحساب القسم لقسمه فقط.','err');
  var shelfId=el('print-shelf-sel').value;
  var clsFilter=el('print-shelf-cls').value;
  var ms=getMeds(deptId);
  var shelves=getShelves(deptId);
  var today=fmtDate(nowISO());
  var deptName=profile.deptName||deptId;
  // Apply filters
  var filtered=ms.filter(function(m){
    var shMatch=shelfId==='all'||m.shelfId===shelfId;
    var clMatch=true;
    if(clsFilter==='high_alert')clMatch=!!m.high_alert;
    else if(clsFilter==='hazard')clMatch=!!m.hazard;
    else if(clsFilter==='lasa')clMatch=!!m.lasa;
    else if(clsFilter==='standard')clMatch=!m.high_alert&&!m.hazard&&!m.lasa;
    return shMatch&&clMatch;
  });
  if(!filtered.length)return toast('No medications match the selected filters','err');
  // Group by shelf then category
  var byShelf={};
  filtered.forEach(function(m){
    var sid=m.shelfId||'__none__';
    if(!byShelf[sid])byShelf[sid]=[];
    byShelf[sid].push(m);
  });
  var qrUrl=window.makeReadableQR(getPublicExpiryUrl(deptId));
  var qrSiteUrl=window.makeReadableQR(getAppUrl());
  var shelfQrPrintRuntime=window.ASD_QR&&ASD_QR.printRuntimeScript?ASD_QR.printRuntimeScript():'';
  var rows='';
  Object.keys(byShelf).sort().forEach(function(sid){
    var shelf=sid==='__none__'?{name:'Unassigned / &#x63A;&#x64A;&#x631; &#x645;&#x639;&#x64A;&#x646;'}:shelves.find(function(s){return s.id===sid});
    var shName=shelf?shelf.name:'Unknown';
    // Group by category within shelf
    var byCat={};
    byShelf[sid].forEach(function(m){if(!byCat[m.category])byCat[m.category]=[];byCat[m.category].push(m);});
    rows+='<tr><td colspan="4" style="background:#2a2a2a;color:#fff;font-weight:700;font-size:9pt;padding:5px 8px">📦 '+shName+(shelf&&shelf.desc?' — '+shelf.desc:'')+'</td></tr>';
    Object.keys(byCat).sort().forEach(function(cat){
      rows+='<tr><td colspan="4" style="background:#e8e8e8;font-weight:600;font-size:7.5pt;text-transform:uppercase;padding:3px 8px;color:#555">'+cat+' / '+catAr(cat)+'</td></tr>';
      byCat[cat].forEach(function(m){
        var bc=m.high_alert?'#da3633':m.hazard?'#d29922':m.lasa?'#8957e5':'transparent';
        var bg=m.high_alert?'#fff0f0':m.hazard?'#fffbea':m.lasa?'#f5f0ff':'#fff';
        var flag='';
        if(m.high_alert&&m.hazard)flag='<span style="color:#da3633;font-weight:700;font-size:6.5pt">HIGH ALERT + HAZARD</span>';
        else if(m.high_alert)flag='<span style="color:#da3633;font-weight:700;font-size:6.5pt">HIGH ALERT</span>';
        else if(m.hazard)flag='<span style="color:#b07d00;font-weight:700;font-size:6.5pt">HAZARD</span>';
        else if(m.lasa)flag='<span style="color:#6639ba;font-weight:700;font-size:6.5pt">LASA</span>';
        rows+='<tr style="background:'+bg+';border-left:3px solid '+bc+'">'
          +'<td style="padding:3px 6px;border:1px solid #ddd;font-weight:500">'+m.name+'</td>'
          +'<td style="padding:3px 6px;border:1px solid #ddd;text-align:center">'+flag+'</td>'
          +'<td style="padding:3px 6px;border:1px solid #ddd;text-align:center;font-weight:700">'+m.min+'</td>'
          +'<td style="padding:3px 6px;border:1px solid #ddd;text-align:center;font-weight:700">'+m.max+'</td>'
          +'</tr>';
      });
    });
  });
  var pw=window.open('about:blank','_sl_','width=820,height=700');
  if(!pw){
    toast('Allow pop-ups to print the shelf list.','err');
    return false;
  }
  var filterLabel=clsFilter==='all'?'All Classifications':clsFilter.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
  var shelfLabel=shelfId==='all'?'All Shelves':(shelves.find(function(s){return s.id===shelfId})||{name:'?'}).name;
  pw.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+deptName+' — Shelf List</title><style>'
    +'@page{size:A4;margin:10mm 10mm 18mm 10mm}'
    +'body{font-family:Arial,sans-serif;font-size:8.5pt;color:#000;margin:0}'
    +'table{width:100%;border-collapse:collapse}'
    +'th{background:#1f2328;color:#fff;padding:5px 6px;text-align:left;font-size:7.5pt}'
    +'th.c{text-align:center}'
    +'tr{page-break-inside:avoid}'
    +'thead{display:table-header-group}'
    +'#footer{position:fixed;bottom:0;left:0;right:0;font-size:6.5pt;color:#555;display:flex;justify-content:space-between;align-items:center;padding:4px 10px;border-top:1px solid #ccc;background:#fff}'
    +'</style></head><body>'
    +officialPrintHeaderHTML()
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #000">'
    +'<div>'
    +'<div style="font-size:13pt;font-weight:700">'+deptName+' — Floor Stock / &#x645;&#x62E;&#x632;&#x648;&#x646; &#x627;&#x644;&#x623;&#x631;&#x636;&#x64A;&#x629;</div>'
    +'<div style="font-size:8pt;color:#333;margin-top:3px">Date: <b>'+today+'</b> &nbsp;|&nbsp; Shelf: <b>'+shelfLabel+'</b> &nbsp;|&nbsp; Filter: <b>'+filterLabel+'</b> &nbsp;|&nbsp; Items: <b>'+filtered.length+'</b></div>'
    +'<div style="font-size:7pt;color:#666;margin-top:2px">By: '+(profile.username||profile.email||'Department')+' &nbsp;|&nbsp; Developed by Ali Abudahash | ASDHealth</div>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<div style="text-align:center"><img class="asd-qr-image" src="'+qrSiteUrl+'" width="90" height="90"><div style="font-size:5.5pt;color:#888">System</div></div>'
    +'<div style="text-align:center"><img class="asd-qr-image" src="'+qrUrl+'" width="90" height="90"><div style="font-size:5.5pt;color:#888">Expiry Monitor</div></div>'
    +'</div>'
    +'</div>'
    +'<table><thead><tr>'
    +'<th>Medication / &#x627;&#x644;&#x62F;&#x648;&#x627;&#x621;</th>'
    +'<th>Classification / &#x627;&#x644;&#x62A;&#x635;&#x646;&#x64A;&#x641;</th>'
    +'<th class="c">Min / &#x627;&#x644;&#x623;&#x62F;&#x646;&#x649;</th>'
    +'<th class="c">Max / &#x627;&#x644;&#x623;&#x639;&#x644;&#x649;</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div id="footer">'
    +'<span>'+deptName+' — Floor Stock — '+today+' — By Ali Abudahash</span>'
    +'<img class="asd-qr-image" src="'+qrUrl+'" width="76" height="76">'
    +'</div>'
    +'<script>'+shelfQrPrintRuntime+'<\/script></body></html>');
  pw.document.close();
  return true;
}

// ── PUBLIC REQUEST VIEW (read-only, no login) ────────────
function checkPublicView(){
  var params=new URLSearchParams(window.location.search);
  if(params.get('view')==='request')return renderMobileRequest(params.get('request'));
  return false;
}

function renderMobileRequest(requestId){
  var request=gr().find(function(r){return r.id===requestId});
  el('auth').style.display='none';
  el('app').style.display='none';
  var publicPage=el('pub-request');
  if(publicPage)publicPage.style.display='block';
  applyTheme();
  var container=el('pub-req');
  if(!request){
    container.innerHTML='<div class="card" style="margin-top:24px"><div class="cb" style="text-align:center">Request not found or is no longer available.</div></div>';
    return;
  }
  var dept=(gd().find(function(d){return d.id===request.deptId})||{}).name||request.deptName||request.deptId;
  var meds=getMeds(request.deptId);
  var mobileUrl=getMobileRequestUrl(request.id);
  var qrUrl=window.makeReadableQR(mobileUrl);
  var rows=(request.items||[]).map(function(item,index){
    var med=meds.find(function(m){return m.id===item.medId});
    var dispensed=(request.dispensed||[]).find(function(itemDispensed){return itemDispensed.medId===item.medId});
    return '<tr><td style="text-align:center;font-family:var(--mono)">'+(index+1)+'</td><td style="font-weight:600">'+(med?med.name:item.medId)+'</td><td style="text-align:center;font-family:var(--mono)">'+item.qty+'</td><td style="text-align:center;font-family:var(--mono)">'+(dispensed?dispensed.qty:'—')+'</td></tr>';
  }).join('');
  container.innerHTML='<div class="card" style="margin-top:8px"><div class="cb"><div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start"><div><div class="stitle">'+dept+' — Request Summary</div><div class="ssub">Read-only mobile view</div></div><img class="asd-qr-image" src="'+qrUrl+'" width="72" height="72" alt="Request barcode"></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0"><div class="chip">Status: '+request.status+'</div><div class="chip">Submitted: '+fmtDateTime(request.created)+'</div>'+(request.scheduledFor?'<div class="chip">Scheduled: '+fmtDateTime(request.scheduledFor)+'</div>':'<div class="chip">Dispense: Not scheduled</div>')+'</div>'
    +'<div class="tw"><table><thead><tr><th>#</th><th>Medication</th><th>Requested</th><th>Dispensed</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="margin-top:16px;font-size:11px;color:var(--tx2);text-align:center">Read-only request view — By Ali Abudahash</div></div></div>';
}


// ── NOTES / FEEDBACK ──────────────────────────────────────
function getNotes(){return S.g('dept_notes')||[]}
function setNotes(arr){return S.s('dept_notes',arr)}

globalThis.NOTE_TYPE_LABELS = {
  classification:'🏷 Classification',
  request:'➕ Add Medication',
  missing:'⚠ Missing Info',
  other:'💬 Other'
};
globalThis.NOTE_STATUS_LABELS = {
  open:'open',urgent:'urgent',resolved:'resolved'
};
function noteEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function noteStatus(v){return ['open','urgent','resolved'].indexOf(String(v))>=0?String(v):'open'}
function noteType(v){return Object.prototype.hasOwnProperty.call(NOTE_TYPE_LABELS,String(v))?String(v):'other'}

// ── DEPT: Submit note ────────────────────────────────────
function renderDeptNotes(){
  if(!CU||CU.role!=='department')return;
  el('notes-dept-sub').textContent=CU.deptName+' — Notes & Feedback to Pharmacy';
  var notes=getNotes().filter(function(n){return n.deptId===CU.deptId}).slice().reverse();
  var list=el('my-notes-list');
  if(!notes.length){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--tx2)">No notes submitted yet</div>';
    return;
  }
  list.innerHTML=notes.map(function(n){
    var safeType=noteType(n.type),safeStatus=noteStatus(n.status),typeLabel=NOTE_TYPE_LABELS[safeType]||safeType;
    var statusCls=safeStatus==='resolved'?'note-resolved':safeStatus==='urgent'?'note-urgent':'note-open';
    var statusBadgeCls='note-badge-'+safeStatus;
    return '<div class="note-card '+statusCls+'">'
      +'<div class="fl jb ic" style="flex-wrap:wrap;gap:6px">'
        +'<div style="font-weight:600">'+noteEsc(n.medName)+(n.medName?' — ':'')+noteEsc(typeLabel)+'</div>'
        +'<span class="badge '+statusBadgeCls+'">'+noteEsc(safeStatus)+'</span>'
      +'</div>'
      +'<div style="margin-top:6px;color:var(--tx)">'+noteEsc(n.body)+'</div>'
      +(n.reply?'<div style="margin-top:8px;padding:8px 10px;background:rgba(46,160,67,.08);border-left:2px solid var(--gn);border-radius:4px;font-size:12px"><b>Pharmacy reply:</b> '+noteEsc(n.reply)+'</div>':'')
      +'<div class="note-meta">'
        +'<span>'+noteEsc(fmtDate(n.created))+'</span>'
        +'<span class="note-tag ntag-'+safeType+'">'+noteEsc(typeLabel)+'</span>'
        +(n.priority==='urgent'?'<span class="badge brd">🚨 Urgent</span>':'')
      +'</div>'
      +'</div>';
  }).join('');
}


// ── PHARMACY: View & manage notes ───────────────────────
function renderPharmNotes(){
  // Populate dept filter
  var dsel=el('notes-filter-dept');
  if(dsel&&dsel.options.length<=1){
    var noteDeps=gd(),noteRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(noteRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var od=window.fsOutpatientDeptId();noteDeps=noteDeps.filter(function(d){return String(d.id)===String(od)})}
    noteDeps.forEach(function(d){dsel.innerHTML+='<option value="'+noteEsc(d.id)+'">'+noteEsc(d.name)+'</option>';});
  }
  if(dsel&&window.fsEffectiveRole&&window.fsEffectiveRole()==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){dsel.value=window.fsOutpatientDeptId();dsel.disabled=true}
  var deptF=(el('notes-filter-dept')||{value:''}).value||'';
  var typeF=(el('notes-filter-type')||{value:''}).value||'';
  var statusF=(el('notes-filter-status')||{value:''}).value||'';
  var outpatientScope=window.fsEffectiveRole&&window.fsEffectiveRole()==='outpatient_pharmacy_supervisor'?(window.fsOutpatientDeptId?window.fsOutpatientDeptId():String(CU&&CU.deptId||'')):'';

  var notes=getNotes().slice().reverse().filter(function(n){
    return (!outpatientScope&&(!deptF||n.deptId===deptF)||outpatientScope&&String(n.deptId)===outpatientScope)&&(!typeF||n.type===typeF)&&(!statusF||n.status===statusF);
  });

  // Summary
  var all=getNotes();
  var openCount=all.filter(function(n){return n.status==='open'||n.status==='urgent'}).length;
  var urgentCount=all.filter(function(n){return n.status==='urgent'}).length;
  var smEl=el('notes-summary');
  if(smEl)smEl.innerHTML='Total: <b>'+all.length+'</b> &nbsp;|&nbsp; Open: <b style="color:var(--yll)">'+openCount+'</b>&nbsp;|&nbsp; Urgent: <b style="color:var(--rdl)">'+urgentCount+'</b>';

  var list=el('pharm-notes-list');
  if(!notes.length){
    list.innerHTML='<div style="text-align:center;padding:44px;color:var(--tx2)"><div style="font-size:36px">📝</div><div style="margin-top:10px">No notes matching filters</div></div>';
    return;
  }
  list.innerHTML=notes.map(function(n){
    var safeType=noteType(n.type),safeStatus=noteStatus(n.status),typeLabel=NOTE_TYPE_LABELS[safeType]||safeType,safeId=noteEsc(n.id);
    var statusCls=safeStatus==='resolved'?'note-resolved':safeStatus==='urgent'?'note-urgent':'note-open';
    var statusBadgeCls='note-badge-'+safeStatus;
    return '<div class="note-card '+statusCls+'" style="margin-bottom:10px">'
      +'<div class="fl jb ic" style="flex-wrap:wrap;gap:8px">'
        +'<div>'
          +'<span style="font-weight:700">'+noteEsc(n.deptName)+'</span>'
          +(n.medName?'<span style="color:var(--tx2);font-size:12px"> &mdash; '+noteEsc(n.medName)+'</span>':'')
        +'</div>'
        +'<div class="fl ic g8">'
          +'<span class="badge '+statusBadgeCls+'">'+noteEsc(safeStatus)+'</span>'
          +(n.priority==='urgent'?'<span class="badge brd">🚨 Urgent</span>':'')
          +'<button class="btn bp bxs" data-nid="'+safeId+'" onclick="openNoteReply(this.getAttribute(&#x27;data-nid&#x27;))">✏ Reply</button>'
          +(safeStatus!=='resolved'?'<button class="btn bs bxs" data-nid="'+safeId+'" onclick="quickResolve(this.getAttribute(&#x27;data-nid&#x27;))">✓ Resolve</button>':'')
        +'</div>'
      +'</div>'
      +'<div style="margin-top:8px;color:var(--tx)">'+noteEsc(String(n.body||'').length>200?String(n.body||'').slice(0,200)+'...':n.body)+'</div>'
      +(n.reply?'<div style="margin-top:8px;padding:8px 10px;background:rgba(46,160,67,.08);border-left:2px solid var(--gn);border-radius:4px;font-size:12px"><b>Reply:</b> '+noteEsc(n.reply)+'</div>':'')
      +'<div class="note-meta">'
        +'<span>'+noteEsc(fmtDate(n.created))+'</span>'
        +'<span style="font-family:var(--mono);font-size:10px">'+noteEsc(n.username)+'</span>'
        +'<span class="note-tag ntag-'+safeType+'">'+noteEsc(typeLabel)+'</span>'
      +'</div>'
      +'</div>';
  }).join('');
}

function openNoteReply(id){
  var note=getNotes().find(function(n){return n.id===id});
  if(!note)return;
  var safeStatus=noteStatus(note.status);
  el('mnote-content').innerHTML='<div style="font-weight:600;margin-bottom:4px">'+noteEsc(note.deptName)+(note.medName?' — <span style="color:var(--tx2)">'+noteEsc(note.medName)+'</span>':'')+' <span class="badge note-badge-'+safeStatus+'">'+noteEsc(safeStatus)+'</span></div>'
    +'<div>'+noteEsc(note.body)+'</div>'
    +(note.reply?'<div style="margin-top:6px;font-size:11px;color:var(--tx2)">Previous reply: '+noteEsc(note.reply)+'</div>':'');
  el('note-reply-txt').value=note.reply||'';
  el('note-reply-status').value=note.status||'open';
  el('note-reply-id').value=id;
  OM('mnote-reply');
}

// ── Badge on nav button ──────────────────────────────────
function updateNotesBadge(){
  var badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''),badgeDept=badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId?window.fsOutpatientDeptId():'';
  var openCount=getNotes().filter(function(n){return (n.status==='open'||n.status==='urgent')&&(!badgeDept||String(n.deptId)===String(badgeDept))}).length;
  document.querySelectorAll('.nb').forEach(function(btn){
    if(btn.getAttribute('data-pg')==='pg-notes-ph'){
      btn.innerHTML='📝 Notes'+(openCount>0?' <span style="background:var(--rd);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">'+openCount+'</span>':'');
    }
  });
  // Dept: show unread reply count
  var deptId=CU&&CU.deptId;
  if(deptId){
    var withReply=getNotes().filter(function(n){return n.deptId===deptId&&n.reply&&!n._replyRead}).length;
    document.querySelectorAll('.nb').forEach(function(btn){
      if(btn.getAttribute('data-pg')==='pg-notes-dept'){
        btn.innerHTML='📝 Notes / \u0645\u0644\u0627\u062D\u0638\u0627\u062A'+(withReply>0?' <span style="background:var(--gn);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700">'+withReply+'</span>':'');
      }
    });
  }
}


// ── BARCODE SCANNER ──────────────────────────────────────
globalThis._scanReader = null;
globalThis._scanStream = null;
globalThis._parsedScan = {};   // holds parsed result from camera
globalThis._parsedType = {};   // holds parsed result from type tab

// ── Tab switcher ──────────────────────────────────────────
function switchExpTab(tab){
  ['manual','scan','type'].forEach(function(t){
    var d=el('tab-'+t); if(d) d.style.display = t===tab?'block':'none';
    var b=el('tab-'+t+'-btn'); if(b){ b.className=t===tab?'btn bp bsm':'btn bg bsm'; b.style.flex='1'; }
  });
  if(tab==='scan') startScanner();
  else stopScanner();
}

// ── GS1 / HIBC / General Barcode Parser ──────────────────
function parseBarcode(raw){
  var result={ lot:'', expiry:'', gtin:'', raw:raw, drug:'' };
  if(!raw) return result;
  var s = raw.trim();

  // ── GS1-128 / GS1 DataMatrix: AIs ──────────────────────
  // AI 01 = GTIN, AI 17 = Expiry YYMMDD, AI 10 = Lot/Batch
  // Format: (01)GTIN(17)YYMMDD(10)LOT  — parens or FNC1 char
  var gs1 = s.replace(/\((\d{2})\)/g, '\x1D$1');  // convert (AI) to GS1 FNC1 style
  var aiMatches = gs1.match(/\x1D(\d{2})([^\x1D]*)/g) || [];
  if(!aiMatches.length){
    // Try without FNC1 — bare AIs like "011234567890(17)251231..."
    gs1 = s.replace(/\((\d{2,3})\)/g, '\x1D$1');
    aiMatches = gs1.match(/\x1D(\d{2,3})([^\x1D]*)/g) || [];
  }
  aiMatches.forEach(function(seg){
    var ai = seg.slice(1,3); var val = seg.slice(3);
    if(ai==='01'||ai==='02'){ result.gtin=val.replace(/\D/g,''); }
    if(ai==='17'){ result.expiry = parseExpiryStr(val.trim()); }
    if(ai==='10'){ result.lot=val.trim(); }
    if(ai==='11'||ai==='13'||ai==='15'){ result.expiry = result.expiry||parseExpiryStr(val.trim()); }
  });

  // ── HIBC format: +LABELER$PRODUCT/YYMMDD$BATCH ──────────
  if(!result.expiry && /^\+/.test(s)){
    var hibcDate = s.match(/\/(\d{6,8})/);
    if(hibcDate) result.expiry = parseExpiryStr(hibcDate[1]);
    var hibcLot = s.match(/\$([A-Z0-9]+)$/i);
    if(hibcLot) result.lot = hibcLot[1];
  }

  // ── Free-text / QR style: "EXP:2025-12 LOT:A123 DrugName" ──
  if(!result.expiry){
    var expPat = s.match(/(?:exp(?:iry)?|expdate|use before|bb)[:\s\/]?(\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{6,8})/i);
    if(expPat) result.expiry = parseExpiryStr(expPat[1]);
  }
  if(!result.lot){
    var lotPat = s.match(/(?:lot|batch|lot no|lot#)[:\s#]?([A-Z0-9\-]+)/i);
    if(lotPat) result.lot = lotPat[1];
  }

  // ── Numeric-only: try as YYMMDD or MMYYYY ──
  if(!result.expiry){
    var numOnly = s.replace(/\D/g,'');
    if(numOnly.length===6) result.expiry = parseExpiryStr(numOnly);
  }

  // ── Try to extract drug name from QR free text ──
  if(!result.drug){
    // Remove known fields, rest might be drug name
    var cleaned = s
      .replace(/\(?\d{2,3}\)?[\dA-Z]{6,14}/g,'')
      .replace(/(?:exp|lot|batch)[:\s#][^\s,;]+/gi,'')
      .replace(/\d{6,8}/g,'')
      .replace(/[^\w\s\-\.\/\%]/g,' ')
      .replace(/\s+/g,' ').trim();
    if(cleaned.length > 3) result.drug = cleaned;
  }

  return result;
}

function parseExpiryStr(s){
  // Normalize various date formats to YYYY-MM-DD
  if(!s) return '';
  s = s.toString().replace(/\s/g,'');

  // YYMMDD → 20YY-MM-DD
  if(/^\d{6}$/.test(s)){
    var yy=s.slice(0,2), mm=s.slice(2,4), dd=s.slice(4,6);
    var yyyy = +yy < 50 ? '20'+yy : '19'+yy;
    var day = dd==='00' ? '01' : dd;  // GS1 day 00 means last day of month
    return yyyy+'-'+mm+'-'+day;
  }
  // YYYYMMDD
  if(/^\d{8}$/.test(s)){
    return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
  }
  // MM/YYYY or MM-YYYY
  if(/^\d{1,2}[-\/]\d{4}$/.test(s)){
    var parts=s.split(/[-\/]/);
    return parts[1]+'-'+parts[0].padStart(2,'0')+'-01';
  }
  // YYYY-MM-DD or YYYY/MM/DD
  if(/^\d{4}[-\/]\d{1,2}([-\/]\d{1,2})?$/.test(s)){
    return s.replace(/\//g,'-');
  }
  // MM/YY
  if(/^\d{2}\/\d{2}$/.test(s)){
    var p=s.split('/');
    return '20'+p[1]+'-'+p[0]+'-01';
  }
  return '';
}

function formatParsedFields(parsed, prefix){
  prefix = prefix||'scan';
  var html='';
  if(parsed.gtin)  html+='<div class="scan-field"><label>GTIN / Product Code</label><div class="val">'+parsed.gtin+'</div></div>';
  if(parsed.lot)   html+='<div class="scan-field"><label>Lot / Batch</label><div class="val">'+parsed.lot+'</div></div>';
  if(parsed.expiry)html+='<div class="scan-field" style="border-left:3px solid var(--gn)"><label>Expiry Date / &#x62A;&#x627;&#x631;&#x64A;&#x62E; &#x627;&#x644;&#x627;&#x646;&#x62A;&#x647;&#x627;&#x621;</label><div class="val" style="color:var(--gnl)">'+fmtDate(parsed.expiry)+' ('+parsed.expiry+')</div></div>';
  if(parsed.drug)  html+='<div class="scan-field"><label>Detected Name / &#x627;&#x644;&#x627;&#x633;&#x645; &#x627;&#x644;&#x645;&#x643;&#x62A;&#x634;&#x641;</label><div class="val">'+parsed.drug+'</div></div>';
  if(!parsed.expiry&&!parsed.lot&&!parsed.gtin) html='<div class="scan-field" style="border-left:3px solid var(--rd)"><label>No structured data detected</label><div class="val" style="color:var(--tx2)">Try typing the barcode or enter details manually</div></div>';
  return html;
}

function getMedSelectOptions(defaultId){
  if(!CU) return '';
  return getMeds(CU.deptId).map(function(m){
    return '<option value="'+esc(m.id)+'"'+(m.id===defaultId?' selected':'')+'>'+esc(m.name)+'</option>';
  }).join('');
}

// ── Fuzzy match drug name from barcode to existing meds ──
function fuzzyMatchMed(drug){
  if(!drug||!CU) return null;
  var ms=getMeds(CU.deptId);
  var dl=drug.toLowerCase();
  // Exact
  var exact=ms.find(function(m){return m.name.toLowerCase()===dl});
  if(exact) return exact.id;
  // Contains
  var contain=ms.find(function(m){return m.name.toLowerCase().includes(dl)||dl.includes(m.name.toLowerCase().slice(0,8))});
  if(contain) return contain.id;
  return null;
}

// ── Camera Scanner ────────────────────────────────────────
async function startScanner(){
  stopScanner();
  var video=el('scan-modal-video');
  if(!video) return;
  el('scan-status').textContent='⏳ Requesting camera access...';
  el('scan-result-area').style.display='none';
  el('scan-line').style.display='block';
  // Enumerate cameras first
  navigator.mediaDevices.enumerateDevices().then(function(devices){
    var cams=devices.filter(function(d){return d.kind==='videoinput'});
    var sel=el('scan-cam-sel');
    if(sel){
      sel.innerHTML=cams.map(function(c,i){return '<option value="'+esc(c.deviceId)+'">'+esc(c.label||'Camera '+(i+1))+'</option>'}).join('');
    }
    var constraints={video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}};
    if(cams.length>0 && sel && sel.value){
      constraints.video={deviceId:{exact:sel.value},width:{ideal:1280},height:{ideal:720}};
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  }).then(async function(stream){
    _scanStream=stream;
    video.srcObject=stream;
    video.play();
    el('scan-status').textContent='🟢 Scanning — hold barcode steady...';
    // Load ZXing only when the scanner is opened
    try{await ensureZXing()}catch(e){}
    if(typeof ZXing!=='undefined'){
      var hints=new Map();
      var fmts=[
        ZXing.BarcodeFormat.QR_CODE,ZXing.BarcodeFormat.DATA_MATRIX,
        ZXing.BarcodeFormat.CODE_128,ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,ZXing.BarcodeFormat.PDF_417,
        ZXing.BarcodeFormat.AZTEC
      ].filter(Boolean);
      if(fmts.length) hints.set(ZXing.DecodeHintType&&ZXing.DecodeHintType.POSSIBLE_FORMATS, fmts);
      _scanReader=new ZXing.BrowserMultiFormatReader(hints);
      _scanReader.decodeFromStream(stream,video,function(result,err){
        if(result){
          onScanSuccess(result.getText());
        }
      });
    } else {
      // Fallback: ZXing not loaded, do manual capture
      el('scan-status').innerHTML='⚠ ZXing library loading... <button class="btn bg bxs" onclick="captureFrame()">📸 Capture Frame</button>';
    }
  }).catch(function(err){
    el('scan-status').textContent='❌ Camera error: '+err.message+' — use "Type Barcode" tab instead';
    el('scan-line').style.display='none';
  });
}

function switchCamera(deviceId){
  stopScanner();
  var video=el('scan-modal-video');
  if(!video) return;
  navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:deviceId}}}).then(function(stream){
    _scanStream=stream;video.srcObject=stream;video.play();
    if(_scanReader) _scanReader.decodeFromStream(stream,video,function(r,e){if(r)onScanSuccess(r.getText())});
  }).catch(function(e){el('scan-status').textContent='Camera error: '+e.message});
}

function stopScanner(){
  if(_scanReader){try{_scanReader.reset();}catch(e){} _scanReader=null;}
  if(_scanStream){_scanStream.getTracks().forEach(function(t){t.stop();});_scanStream=null;}
  var line=el('scan-line');if(line)line.style.display='none';
}

function restartScanner(){
  el('scan-result-area').style.display='none';
  _parsedScan={};
  startScanner();
}

async function captureFrame(){
  var video=el('scan-modal-video'),status=el('scan-status');
  if(!video||video.readyState<2){if(status)status.textContent='Camera frame is not ready yet. Please try again.';return;}
  try{
    if(typeof BarcodeDetector!=='undefined'){
      var detector=new BarcodeDetector();
      var found=await detector.detect(video);
      if(found&&found.length&&found[0].rawValue){onScanSuccess(found[0].rawValue);return;}
      if(status)status.innerHTML='No barcode detected in this frame. Hold it steady and <button class="btn bg bxs" onclick="captureFrame()">try again</button>.';
      return;
    }
    await ensureZXing();
    if(typeof ZXing!=='undefined'){restartScanner();return;}
  }catch(e){if(status)status.textContent='Barcode capture failed: '+(e.message||e);return;}
  if(status)status.textContent='Automatic capture is not supported in this browser. Use the Type Barcode tab.';
}

function onScanSuccess(raw){
  stopScanner();
  el('scan-line').style.display='none';
  el('scan-status').innerHTML='✅ <b>Barcode detected!</b> <button class="btn bg bxs" onclick="restartScanner()">🔄 Scan Again</button>';
  el('scan-raw-val').textContent=raw;
  _parsedScan=parseBarcode(raw);
  el('scan-parsed-fields').innerHTML=formatParsedFields(_parsedScan,'scan');
  var matchId=fuzzyMatchMed(_parsedScan.drug)||null;
  el('scan-med-sel').innerHTML=getMedSelectOptions(matchId);
  el('scan-result-area').style.display='block';
}

function applyScanResult(){
  var medId=el('scan-med-sel').value;
  if(!medId) return toast('Select a medication to link','err');
  if(!_parsedScan.expiry) return toast('No expiry date detected — fill manually or scan again','err');
  // Switch to manual tab and fill fields
  switchExpTab('manual');
  el('exp-med-sel').value=medId;
  el('exp-batch-inp').value=_parsedScan.lot||'';
  el('exp-date-inp').value=_parsedScan.expiry||'';
  toast('Data filled — review and Save ✓','succ');
}

// ── Type barcode ───────────────────────────────────────────
function parseTypedBarcode(){
  var raw=(el('type-barcode-inp')||{}).value||'';
  if(!raw.trim()) return toast('Enter a barcode string','err');
  _parsedType=parseBarcode(raw);
  el('type-parsed-fields').innerHTML=formatParsedFields(_parsedType,'type');
  el('type-parsed-fields').style.display='block';
  var matchId=fuzzyMatchMed(_parsedType.drug)||null;
  el('type-med-sel').innerHTML=getMedSelectOptions(matchId);
  el('type-med-wrap').style.display='block';
}
function applyTypedResult(){
  var medId=el('type-med-sel').value;
  if(!medId) return toast('Select a medication','err');
  if(!_parsedType.expiry) return toast('No expiry date found — check the barcode string','err');
  switchExpTab('manual');
  el('exp-med-sel').value=medId;
  el('exp-batch-inp').value=_parsedType.lot||'';
  el('exp-date-inp').value=_parsedType.expiry||'';
  toast('Data filled ✓','succ');
}

// ── Open expiry modal via scan shortcut ───────────────────


// ── Close scanner when modal closes ───────────────────────
function CM(id){document.getElementById(id).classList.remove('on');if(id==='mexpiry')stopScanner();}


// ── CATEGORIES (global custom list) ─────────────────────
globalThis.DEFAULT_CATS = ['Injections','Inhalers','Suppositories','Tablets','Syrups','Topical','Ointments & Drops','Solutions'];
function getCategories(){
  var saved=S.g('custom_categories');
  return saved&&saved.length?saved:DEFAULT_CATS.slice();
}
function setCategories(arr){return S.s('custom_categories',arr)}

async function refreshCatSelectors(){
  // Update all open category dropdowns
  var cats=getCategories();
  var opts=cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('');
  ['dcat','imp-cat'].forEach(function(id){
    var sel=el(id);
    if(!sel)return;
    var cur=sel.value;
    if(id==='imp-cat'){
      sel.innerHTML='<option value="auto">Auto-detect</option>'+cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('');
    } else {
      sel.innerHTML=opts;
    }
    sel.value=cats.indexOf(cur)>-1?cur:cats[0];
  });
  renderInv();
}

// ── INVENTORY BULK ACTIONS ───────────────────────────────
function toggleAllInv(chk){
  document.querySelectorAll('.inv-chk').forEach(function(c){c.checked=chk.checked});
  onInvCheck();
}
function onInvCheck(){
  var checked=document.querySelectorAll('.inv-chk:checked');
  var total=document.querySelectorAll('.inv-chk');
  el('bulk-bar').style.display=checked.length?'':'none';
  el('bulk-count').textContent=checked.length+' selected';
  // Update select-all state
  var allChk=el('inv-all-chk');
  if(allChk){allChk.checked=checked.length>0&&checked.length===total.length;allChk.indeterminate=checked.length>0&&checked.length<total.length;}
  if(typeof window.captureInventorySelection==='function')window.captureInventorySelection();
}
function clearInvSelection(){
  if(typeof window.clearInventorySelectionState==='function')window.clearInventorySelectionState();
  document.querySelectorAll('.inv-chk').forEach(function(c){c.checked=false});
  var allChk=el('inv-all-chk');if(allChk){allChk.checked=false;allChk.indeterminate=false;}
  el('bulk-bar').style.display='none';
}
function getSelectedMedIds(){
  return Array.from(document.querySelectorAll('.inv-chk:checked')).map(function(c){return c.dataset.id});
}
async function bulkDelete(){
  var ids=getSelectedMedIds();
  if(!ids.length)return toast('Select medications first','err');
  var deptId=getInvDept();
  if(!await uiConfirm('Delete '+ids.length+' selected medications from this department?'))return;
  var idSet=new Set(ids);
  try{
    await setMeds(deptId,getMeds(deptId).filter(function(m){return !idSet.has(m.id)}));
    toast(ids.length+' medications deleted and saved ✓','succ');
    clearInvSelection();
    renderInv();
  }catch(err){
    console.error(err);
    toast('Delete was not saved. Please retry.','err');
  }
}

// ── LOGO ────────────────────────────────────────────────
function getLogo(){
  var data=S.g('facility_logo')||{};
  var legacy=Array.isArray(data.lines)?data.lines.slice(0,4):[data.name||'','','',''];
  while(legacy.length<4)legacy.push('');
  var english=Array.isArray(data.enLines)?data.enLines.slice(0,4):legacy.slice(0,4);
  var arabic=Array.isArray(data.arLines)?data.arLines.slice(0,4):['','','',''];
  while(english.length<4)english.push('');
  while(arabic.length<4)arabic.push('');
  return {
    img:data.img||'',
    enLines:english,
    arLines:arabic,
    lines:english,
    name:english[0]||arabic[0]||''
  };
}
function setLogoData(obj){return S.s('facility_logo',obj)}
function openLogoSettings(){
  if(!CU||CU.master!==true)return toast('Print header settings are available to Master only.','err');
  var header=getLogo(),img=el('logo-preview-img'),none=el('logo-preview-none');
  img.dataset.pending='';
  if(header.img){
    img.src=header.img;
    img.style.display='';
    none.style.display='none';
  }else{
    img.src='';
    img.style.display='none';
    none.style.display='';
  }
  for(var i=1;i<=4;i++){
    el('print-header-en'+i).value=header.enLines[i-1]||'';
    el('print-header-ar'+i).value=header.arLines[i-1]||'';
  }
  OM('mlogo');
}
function handleLogoDrop(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleLogoFile(f)}
async function handleLogoFile(file){if(!file)return;try{var data=await window.fsPrepareImageDataUrl(file),img=el('logo-preview-img');img.src=data;img.style.display='';el('logo-preview-none').style.display='none';img.dataset.pending=data}catch(error){var input=el('logo-file-inp');if(input)input.value='';toast(String(error&&error.message||error),'err')}}
async function saveLogo(){
  if(!CU||CU.master!==true)return toast('Master only','err');
  var img=el('logo-preview-img'),logoData=img.dataset.pending||img.getAttribute('src')||'';
  if(logoData&&!logoData.startsWith('data:')&&!logoData.startsWith('http'))logoData='';
  var english=[],arabic=[];
  for(var i=1;i<=4;i++){
    english.push((el('print-header-en'+i).value||'').trim());
    arabic.push((el('print-header-ar'+i).value||'').trim());
  }
  await setLogoData({
    img:logoData,
    enLines:english,
    arLines:arabic,
    lines:english,
    name:english[0]||arabic[0]||''
  });
  toast('Official print header saved ✓','succ');
  CM('mlogo');
}
async function clearLogo(){
  var old=getLogo();
  await setLogoData({
    img:'',
    enLines:old.enLines,
    arLines:old.arLines,
    lines:old.enLines,
    name:old.enLines[0]||old.arLines[0]||''
  });
  var img=el('logo-preview-img');
  img.src='';
  img.style.display='none';
  img.dataset.pending='';
  el('logo-preview-none').style.display='';
  toast('Logo removed; header text retained','info');
}
function officialPrintHeaderHTML(){
  var header=getLogo();
  var english=header.enLines.filter(function(value){return String(value||'').trim();});
  var arabic=header.arLines.filter(function(value){return String(value||'').trim();});
  if(!header.img&&!english.length&&!arabic.length)return '';
  function headerEscape(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(character){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }
  function rows(values,direction){
    return values.map(function(value,index){
      return '<div style="font-size:'+(index===0?'11':'8.5')+'pt;font-weight:'+(index===0?'800':'600')+
        ';line-height:1.35;white-space:normal;overflow-wrap:anywhere">'+headerEscape(value)+'</div>';
    }).join('');
  }
  return '<div class="official-print-header" style="display:grid;grid-template-columns:minmax(0,1fr) 34mm minmax(0,1fr);gap:5mm;align-items:center;border-bottom:2px solid #222;padding:0 0 3mm;margin:0 0 3mm;min-height:27mm">'+
    '<div dir="ltr" style="text-align:left">'+rows(english,'ltr')+'</div>'+
    '<div style="display:flex;align-items:center;justify-content:center">'+
      (header.img?'<img src="'+headerEscape(header.img)+'" alt="Official logo" style="max-width:31mm;max-height:25mm;object-fit:contain">':'')+
    '</div>'+
    '<div dir="rtl" style="text-align:right">'+rows(arabic,'rtl')+'</div>'+
  '</div><div class="official-byline" style="font-size:8pt;text-align:center;color:#555;margin:-1mm 0 3mm">By Ali Abudahash</div>';
}


// ── CATEGORY SELECTOR OPTIONS ────────────────────────────
function getCatOptions(selected){
  var cats=getCategories();
  return cats.map(function(c){return '<option value="'+esc(c)+'"'+(c===selected?' selected':'')+'>'+esc(c)+'</option>'}).join('');
}

// ════════════════════════════════════════════════════════
// SCHEDULE & LIMITS
// ════════════════════════════════════════════════════════
globalThis.DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Storage ──────────────────────────────────────────────
function getReqWindows(){return S.g('req_windows')||[]}
function setReqWindows(a){return S.s('req_windows',a)}
function getDispSlots(){return S.g('disp_slots')||[]}
function setDispSlots(a){return S.s('disp_slots',a)}
function getMonthlyLimits(){return S.g('monthly_limits')||{}}   // {deptId: N}
function setMonthlyLimits(o){return S.s('monthly_limits',o)}

// ── Helpers ───────────────────────────────────────────────
function fmt12(t){
  if(!t)return '';
  var p=t.split(':');var h=+p[0],m=p[1]||'00';
  var ampm=h>=12?'PM':'AM';h=h%12||12;
  return h+':'+m+' '+ampm;
}
function dayBits(days){return days.map(function(d){return DAY_NAMES[d]}).join(', ')}

// ── Check if request is currently allowed ─────────────────
function timeToMins(t){var p=(t||'00:00').split(':');return +p[0]*60+(+p[1]||0);}

// ── Check monthly request count ───────────────────────────
function getMonthlyReqCount(deptId){
  var now=new Date();
  var ms0=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  return gr().filter(function(r){return r.deptId===deptId&&r.created>=ms0}).length;
}
function getMonthlyLimit(deptId){
  var lims=getMonthlyLimits();
  return lims[deptId]||null; // null = no limit
}

// ── RENDER schedule page ──────────────────────────────────
function renderSchedule(){
  // Populate dept dropdowns in modals
  var deptOpts='<option value="all">All Departments</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  ['rwin-dept','dslot-dept'].forEach(function(id){var s=el(id);if(s)s.innerHTML=deptOpts;});

  // Request windows
  var wins=getReqWindows();
  el('req-windows-list').innerHTML=wins.length
    ?wins.map(function(w,i){
      var deptName=w.dept==='all'?'All Departments':(gd().find(function(d){return d.id===w.dept})||{name:w.dept}).name;
      return '<div class="win-card'+(w.active?'':' inactive')+'">'
        +'<div>'
          +'<div style="font-weight:600">'+w.label+'</div>'
          +'<div class="win-days">'+deptName+' &nbsp;|&nbsp; '+dayBits(w.days||[])+'</div>'
        +'</div>'
        +'<div class="win-time">'+fmt12(w.from)+' &ndash; '+fmt12(w.to)+'</div>'
        +'<div class="fl g8 ic">'
          +'<button class="btn bg bxs" data-i="'+i+'" onclick="editReqWindow(+this.dataset.i)">✏</button>'
          +'<button class="btn '+(w.active?'bg':'bp')+' bxs" data-i="'+i+'" onclick="toggleWindow(+this.dataset.i)">'+(w.active?'Pause':'Enable')+'</button>'
          +'<button class="btn bd2c bxs" data-i="'+i+'" onclick="delWindow(+this.dataset.i)">✕</button>'
        +'</div></div>';
    }).join('')
    :'<div style="color:var(--tx2);font-size:13px;padding:12px 0">No windows set — requests allowed anytime</div>';

  // Dispense slots
  var slots=getDispSlots();
  el('disp-slots-list').innerHTML=slots.length
    ?slots.map(function(s,i){
      var deptName=s.dept==='all'?'All Departments':(gd().find(function(d){return d.id===s.dept})||{name:s.dept}).name;
      return '<div class="win-card">'
        +'<div>'
          +'<div style="font-weight:600">'+s.label+'</div>'
          +'<div class="win-days">'+deptName+' &nbsp;|&nbsp; '+dayBits(s.days||[])+(s.notes?' &nbsp;|&nbsp; <i>'+s.notes+'</i>':'')+'</div>'
        +'</div>'
        +'<span class="slot-badge">⏰ '+fmt12(s.time)+'</span>'
        +'<div class="fl g8 ic">'
          +'<button class="btn bg bxs" data-i="'+i+'" onclick="editDispSlot(+this.dataset.i)">✏</button>'
          +'<button class="btn bd2c bxs" data-i="'+i+'" onclick="delSlot(+this.dataset.i)">✕</button>'
        +'</div></div>';
    }).join('')
    :'<div style="color:var(--tx2);font-size:13px;padding:12px 0">No dispense slots defined</div>';

  // Monthly limits
  var lims=getMonthlyLimits();
  el('monthly-limits-list').innerHTML='<div class="tw"><table><thead><tr><th>Department</th><th>Monthly Limit</th><th>Used This Month</th><th>Remaining</th></tr></thead><tbody>'
    +gd().map(function(d){
      var lim=lims[d.id]||null;
      var used=getMonthlyReqCount(d.id);
      var remaining=lim?Math.max(0,lim-used):'∞';
      var remColor=lim&&remaining===0?'var(--rdl)':lim&&+remaining<=2?'var(--yll)':'var(--gnl)';
      return '<tr>'
        +'<td style="font-weight:600">'+d.name+'</td>'
        +'<td><div class="fl ic g8"><input type="number" class="monthly-lim-inp" data-dept="'+d.id+'" value="'+(lim||'')+'" min="1" placeholder="∞ No limit" style="width:110px;margin:0;padding:6px 8px"> <span style="font-size:11px;color:var(--tx2)">requests/mo</span></div></td>'
        +'<td style="font-family:var(--mono)">'+used+'</td>'
        +'<td style="font-family:var(--mono);font-weight:700;color:'+remColor+'">'+remaining+'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table></div>';

  if(typeof window.renderRequestCountLimitsSection==='function')window.renderRequestCountLimitsSection();
  if(typeof renderRequestHourGridUI==='function')window.renderRequestHourGridUI();

  if(typeof window.schedulePagePostRender==='function')window.schedulePagePostRender();
}

// ── Request Window CRUD ───────────────────────────────────

function editReqWindow(i){
  var w=getReqWindows()[i];if(!w)return;
  el('mreqwin-title').textContent='Edit Window';
  el('rwin-label').value=w.label||'';el('rwin-from').value=w.from||'';el('rwin-to').value=w.to||'';
  el('rwin-edit-id').value=i;el('rwin-active').checked=w.active!==false;
  el('rwin-dept').innerHTML='<option value="all">All Departments</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  el('rwin-dept').value=w.dept||'all';
  el('rwin-days').querySelectorAll('input').forEach(function(c){c.checked=(w.days||[]).indexOf(+c.value)>-1});
  OM('mreq-window');
}
// ── Dispense Slot CRUD ────────────────────────────────────
function addDispSlot(){
  el('mdisp-title').textContent='Add Dispense Slot';
  el('dslot-label').value='';el('dslot-time').value='10:00';el('dslot-notes').value='';
  el('dslot-edit-id').value='';
  el('dslot-dept').innerHTML='<option value="all">All Departments</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  el('dslot-dept').value='all';
  el('dslot-days').querySelectorAll('input').forEach(function(c){c.checked=[0,1,2,3,4].indexOf(+c.value)>-1});
  OM('mdisp-slot');
}
function editDispSlot(i){
  var s=getDispSlots()[i];if(!s)return;
  el('mdisp-title').textContent='Edit Dispense Slot';
  el('dslot-label').value=s.label||'';el('dslot-time').value=s.time||'';el('dslot-notes').value=s.notes||'';
  el('dslot-edit-id').value=i;
  el('dslot-dept').innerHTML='<option value="all">All Departments</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  el('dslot-dept').value=s.dept||'all';
  el('dslot-days').querySelectorAll('input').forEach(function(c){c.checked=(s.days||[]).indexOf(+c.value)>-1});
  OM('mdisp-slot');
}
// ── Monthly Limits ────────────────────────────────────────
function openBulkLimits(){
  var lims=getMonthlyLimits();
  el('bulk-limit-val').value='';
  el('bulk-limits-per-dept').innerHTML='<div class="tw"><table><thead><tr><th>Department</th><th>Current Limit</th><th>New Limit</th></tr></thead><tbody>'
    +gd().map(function(d){
      return '<tr><td>'+d.name+'</td><td style="font-family:var(--mono)">'+(lims[d.id]||'—')+'</td>'
        +'<td><input type="number" class="blim-inp" data-dept="'+d.id+'" value="'+(lims[d.id]||'')+'" min="1" placeholder="No limit" style="width:110px;margin:0;padding:6px 8px"></td></tr>';
    }).join('')+'</tbody></table></div>';
  OM('mbulk-limits');
}
function applyBulkLimit(){
  var field=el('bulk-limit-val'),raw=field?field.value.trim():'',value='';
  if(raw){
    var parsed=Math.floor(Number(raw));
    if(!isFinite(parsed)||parsed<1)return toast('Enter a positive monthly limit, or leave it empty for unlimited.','err');
    value=String(parsed);
    if(field)field.value=value;
  }
  var inputs=Array.from(document.querySelectorAll('#bulk-limits-per-dept .blim-inp'));
  inputs.forEach(function(inp){inp.value=value});
  toast(value?('Applied '+value+' requests/month to all departments in this form. Click Save All Limits to confirm.'):'Cleared all limits in this form. Click Save All Limits to confirm.','info');
}


// ── DEPT: Show window info + block if outside window ──────
function getNextDispSlot(deptId){
  var now=new Date();
  var slots=getDispSlots().filter(function(s){return s.dept==='all'||s.dept===deptId});
  if(!slots.length)return null;
  var nowMins=now.getHours()*60+now.getMinutes();var dow=now.getDay();
  var best=null,bestDiff=Infinity;
  for(var d=0;d<7;d++){
    var day=(dow+d)%7;
    slots.forEach(function(s){
      if((s.days||[]).indexOf(day)<0)return;
      var sm=timeToMins(s.time);
      var diff=d*1440+(sm-nowMins),dayOffset=d;
      if(diff<=0&&d===0){diff+=1440;dayOffset=1;}
      if(diff>0&&diff<bestDiff){
        var scheduled=new Date(now);
        scheduled.setDate(now.getDate()+dayOffset);
        scheduled.setHours(Math.floor(sm/60),sm%60,0,0);
        bestDiff=diff;best={slot:s,day:DAY_NAMES[day],time:fmt12(s.time),minsAway:diff,scheduledAt:scheduled.toISOString()};
      }
    });
  }
  return best;
}
// Single global exit lifecycle: persist transient UI state, close public listeners, then warn on pending writes.
window.addEventListener('beforeunload',function(e){
  if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();
  if(typeof window.clearPublicLiveSubscriptions==='function')window.clearPublicLiveSubscriptions();
  if(_pendingWrites>0){
    var msg='البيانات لم تُحفظ بعد. هل أنت متأكد من المغادرة؟';
    e.preventDefault();e.returnValue=msg;return msg;
  }
});


// ── CONTROLLED MODULE ENHANCEMENTS: unified stock, alerts, flags and seeded department lists ──

function ctlIsMaster(){
  var profile=window.fsPermissionProfile?window.fsPermissionProfile():(window.CU||{});
  return !!(profile&&profile.master===true);
}
function ctlCanManage(){
  if(window.fsHasCapability)return window.fsHasCapability('controlled.manage');
  return ctlIsMaster()||ctlIsOfficer();
}
function ctlCanEditCatalog(){return ctlCanManage()}
function ctlCanAddCatalog(){return ctlCanManage()||ctlIsWarehouse()}
function ctlCanEditDept(){return ctlCanManage()}
function ctlAlertDays(){return Math.max(1,Number(S.g('controlled_alert_days')||60))}

function ctlFridgeIcon(m){
  return m&&m.refrigerated
    ?'<span class="fridge-icon" title="Refrigerated / Store in refrigerator (2–8°C)" aria-label="Refrigerated medicine"><span class="fridge-glyph" aria-hidden="true"></span></span>'
    :'';
}

function ctlFlags(m){
  var out=[];
  if(m.highAlert)out.push('<span class="badge brd">🔴 High Alert</span>');
  if(m.lasa)out.push('<span class="badge bpu">🔵 LASA</span>');
  if(m.refrigerated)out.push(ctlFridgeIcon(m));
  return out.join(' ')||'<span class="badge bgr">—</span>';
}
function ctlClassLabel(v){
  return v==='psychotropic'
    ?'<span class="badge byl">Psychotropic / نفسي</span>'
    :'<span class="badge brd">Narcotic / مخدر</span>';
}

function ctlEarliestDays(batches){
  var arr=(batches||[]).map(function(b){return daysUntil(b.expiry)}).filter(function(d){return d!==null});
  return arr.length?Math.min.apply(null,arr):null;
}
function ctlStatus(m,w,p){
  var min=ctlNum(m.min),wqty=ctlNum(w.system)+ctlNum(w.outside),pqty=ctlNum(p.qty);
  var wd=ctlEarliestDays(w.batches),pd=ctlEarliestDays(p.batches),d=[wd,pd].filter(function(x){return x!==null});
  var earliest=d.length?Math.min.apply(null,d):null,days=ctlAlertDays();
  if(earliest!==null&&earliest<=0)return {key:'expired',html:'<span class="badge brd">Expired</span>'};
  if(earliest!==null&&earliest<=days)return {key:'soon',html:'<span class="badge byl">Expiring ≤ '+days+'d</span>'};
  if(wqty===0||pqty===0)return {key:'out',html:'<span class="badge brd">Out of stock</span>'};
  if((min>0&&wqty<min)||(min>0&&pqty<min))return {key:'low',html:'<span class="badge byl">Below minimum</span>'};
  return {key:'ok',html:'<span class="badge bgn">OK</span>'};
}


// ── WAREHOUSE PDF RECEIPT IMPORT ─────────────────────────────
globalThis.CTL_PDF_REVIEW = [];
function ctlPdfReceipts(){return S.g('controlled_pdf_receipts')||[]}
function ctlSetPdfReceipts(v){return S.s('controlled_pdf_receipts',v)}
function ctlPdfNormalizeCode(v){return String(v==null?'':v).replace(/[^0-9]/g,'').replace(/^0+(?=\d)/,'')}
function ctlPdfCanUse(){return !!(CU&&(ctlIsWarehouse()||ctlIsMaster()))}
function ctlPdfDrag(e,on){e.preventDefault();var z=el('ctl-pdf-drop');if(z)z.classList.toggle('drag',!!on)}
function ctlPdfDrop(e){e.preventDefault();ctlPdfDrag(e,false);var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)ctlParseReceiptPdf(f)}
function ctlPdfClearReview(){CTL_PDF_REVIEW=[];if(el('ctl-pdf-receipt-file'))el('ctl-pdf-receipt-file').value='';if(el('ctl-pdf-review-wrap'))el('ctl-pdf-review-wrap').style.display='none';if(el('ctl-pdf-progress'))el('ctl-pdf-progress').textContent=''}
function ctlPdfFindMedicine(code){
  var c=ctlPdfNormalizeCode(code);if(!c)return null;
  return ctlCatalog().find(function(m){return ctlPdfNormalizeCode(m.moh)===c||ctlPdfNormalizeCode(m.nupco)===c})||null;
}
function ctlPdfRowsFromItems(items,pageNo){
  var groups=[];
  items.forEach(function(it){
    var str=String(it.str||'').trim();if(!str)return;
    var y=Math.round((it.transform&&it.transform[5]||0)*2)/2,x=it.transform&&it.transform[4]||0,g=null;
    for(var i=0;i<groups.length;i++)if(Math.abs(groups[i].y-y)<=2.5){g=groups[i];break}
    if(!g){g={y:y,t:[]};groups.push(g)}g.t.push({x:x,s:str});
  });
  var out=[];
  groups.sort(function(a,b){return b.y-a.y}).forEach(function(g){
    g.t.sort(function(a,b){return a.x-b.x});
    var ts=g.t,codeToken=null;
    for(var i=0;i<ts.length;i++){var n=ctlPdfNormalizeCode(ts[i].s);if(/^\d{8,14}$/.test(n)){codeToken={code:n,index:i,x:ts[i].x};break}}
    if(!codeToken)return;
    var qtyToken=null;
    for(var j=ts.length-1;j>codeToken.index;j--){var raw=ts[j].s.replace(/,/g,'').trim();if(/^\d+(?:\.\d+)?$/.test(raw)){qtyToken={qty:Number(raw),index:j};break}}
    if(!qtyToken||!isFinite(qtyToken.qty))return;
    var desc=ts.slice(codeToken.index+1,qtyToken.index).map(function(x){return x.s}).join(' ').trim();
    out.push({page:pageNo,code:codeToken.code,description:desc,qty:qtyToken.qty});
  });
  return out;
}
async function ctlParseReceiptPdf(file){
  if(!ctlPdfCanUse())return toast('Warehouse permission required','err');
  if(!file||!/\.pdf$/i.test(file.name||''))return toast('Choose a PDF file','err');
  var pr=el('ctl-pdf-progress');if(pr)pr.textContent='جاري قراءة الملف...\nReading the file...';
  try{
    await ensurePDFJS();
    var data=await file.arrayBuffer(),doc=await pdfjsLib.getDocument({data:data}).promise,raw=[];
    for(var p=1;p<=doc.numPages;p++){
      if(pr)pr.textContent='جاري قراءة الصفحة '+p+' من '+doc.numPages+'...\nReading page '+p+' of '+doc.numPages+'...';
      var page=await doc.getPage(p),content=await page.getTextContent({normalizeWhitespace:true});
      raw=raw.concat(ctlPdfRowsFromItems(content.items,p));
    }
    var seen={};raw=raw.filter(function(r){var k=r.page+'|'+r.code+'|'+r.qty;if(seen[k])return false;seen[k]=1;return true});
    CTL_PDF_REVIEW=raw.map(function(r,i){var med=ctlPdfFindMedicine(r.code);return {id:'pdfrow_'+Date.now()+'_'+i,page:r.page,code:r.code,description:r.description,pdfQty:ctlNum(r.qty),approvedQty:ctlNum(r.qty),expiry:'',selected:!!med,medId:med?med.id:'',medName:med?med.name:'',matched:!!med}});
    if(pr)pr.textContent='تمت قراءة '+doc.numPages+' صفحة من '+file.name+'\nRead '+doc.numPages+' page(s) from '+file.name;
    ctlRenderPdfReview();
    if(!CTL_PDF_REVIEW.length)toast('لم يتم العثور على صفوف صنف وكمية قابلة للقراءة.\nNo readable Item / Quantity rows were found.','err');
  }catch(err){console.error(err);if(pr)pr.textContent='';toast(err.message||'تعذر قراءة ملف PDF.\nThe PDF file could not be read.','err')}
}
function ctlRenderPdfReview(){
  var wrap=el('ctl-pdf-review-wrap'),body=el('ctl-pdf-review-body');if(!wrap||!body)return;
  wrap.style.display=CTL_PDF_REVIEW.length?'block':'none';
  var matched=CTL_PDF_REVIEW.filter(function(r){return r.matched}).length,miss=CTL_PDF_REVIEW.length-matched,total=CTL_PDF_REVIEW.reduce(function(a,r){return a+ctlNum(r.pdfQty)},0);
  el('ctl-pdf-summary').innerHTML='<span class="chip">Rows: <b>'+CTL_PDF_REVIEW.length+'</b></span><span class="chip">Matched: <b>'+matched+'</b></span><span class="chip">Unmatched: <b>'+miss+'</b></span><span class="chip">Total PDF Qty: <b>'+total+'</b></span>';
  body.innerHTML=CTL_PDF_REVIEW.map(function(r,i){return '<tr class="'+(r.matched?'ctl-pdf-match-ok':'ctl-pdf-match-miss')+'"><td><input type="checkbox" '+(r.selected?'checked':'')+' '+(r.matched?'':'disabled')+' onchange="ctlPdfSetField('+i+',\'selected\',this.checked)"></td><td>'+(i+1)+'</td><td><b>'+esc(r.code)+'</b><div class="fhint">Page '+r.page+'</div></td><td><b>'+esc(r.medName||r.description||'Unknown')+'</b>'+(r.medName&&r.description?'<div class="fhint">PDF: '+esc(r.description)+'</div>':'')+'</td><td>'+ctlNum(r.pdfQty)+'</td><td><input type="number" min="0" step="1" value="'+ctlNum(r.approvedQty)+'" '+(r.matched?'':'disabled')+' onchange="ctlPdfSetField('+i+',\'approvedQty\',this.value)"></td><td><input type="date" value="'+esc(r.expiry||'')+'" '+(r.matched?'':'disabled')+' onchange="ctlPdfSetField('+i+',\'expiry\',this.value)"></td><td><span class="ctl-pdf-status '+(r.matched?'ok':'miss')+'">'+(r.matched?'Matched':'Not found')+'</span></td></tr>'}).join('');
  var all=el('ctl-pdf-select-all');if(all){var ok=CTL_PDF_REVIEW.filter(function(r){return r.matched});all.checked=!!ok.length&&ok.every(function(r){return r.selected})}
}
function ctlPdfSetField(i,k,v){var r=CTL_PDF_REVIEW[i];if(!r)return;if(k==='approvedQty')v=Math.max(0,ctlNum(v));r[k]=v;if(k==='selected'&&v&&ctlNum(r.approvedQty)<=0)r.approvedQty=r.pdfQty}
function ctlPdfToggleAll(checked){CTL_PDF_REVIEW.forEach(function(r){if(r.matched)r.selected=checked});ctlRenderPdfReview()}
async function ctlApprovePdfReceipt(allMatched){
  if(!ctlPdfCanUse())return;
  var chosen=CTL_PDF_REVIEW.filter(function(r){return r.matched&&(allMatched||r.selected)&&ctlNum(r.approvedQty)>0});
  if(!chosen.length)return toast('حدد صنفًا مطابقًا واحدًا على الأقل.\nSelect at least one matching item.','err');
  var msg=allMatched?'اعتماد جميع الأصناف المطابقة وإضافتها إلى رصيد المستودع؟\nApprove all matching items and add them to warehouse stock?':'اعتماد الأصناف المحددة فقط وإضافتها إلى رصيد المستودع؟\nApprove only the selected items and add them to warehouse stock?';if(!await uiConfirm(msg))return;
  var originalWh=ctlWarehouse()||{},originalReceipts=ctlPdfReceipts()||[],wh=Object.assign({},originalWh),receipt={id:'pdfreceipt_'+Date.now(),fileName:(el('ctl-pdf-receipt-file')&&el('ctl-pdf-receipt-file').files[0]?el('ctl-pdf-receipt-file').files[0].name:'PDF'),created:nowISO(),by:CU.username,status:'approved',rows:[]};
  chosen.forEach(function(r){var w=Object.assign({},wh[r.medId]||{});w.system=ctlNum(w.system)+ctlNum(r.approvedQty);w.outside=ctlNum(w.outside);w.batches=(w.batches||[]).map(function(b){return Object.assign({},b)});if(r.expiry)w.batches.push({qty:ctlNum(r.approvedQty),expiry:ctlDate(r.expiry)||r.expiry,lot:'PDF receipt'});wh[r.medId]=w;receipt.rows.push({id:r.id,medId:r.medId,code:r.code,medName:r.medName,pdfQty:r.pdfQty,qty:ctlNum(r.approvedQty),expiry:r.expiry||'',expiryBatches:r.expiry?[{qty:ctlNum(r.approvedQty),expiry:r.expiry}]:[],expiryAllocatedQty:r.expiry?ctlNum(r.approvedQty):0,expiryPending:!r.expiry,page:r.page})});
  var receipts=originalReceipts.slice();receipts.unshift(receipt);var warehouseSaved=false;
  try{await ctlSetWarehouse(wh);warehouseSaved=true;await ctlSetPdfReceipts(receipts)}catch(e){
    console.error('PDF warehouse receipt save failed',e);var rollbackFailed=false;
    if(warehouseSaved)try{await ctlSetWarehouse(originalWh)}catch(err){rollbackFailed=true;console.error('PDF receipt warehouse rollback failed',err)}
    return toast(rollbackFailed?'تعذر حفظ الاستلام ولم يمكن تأكيد استعادة رصيد المستودع. راجع الرصيد والسجل.\nThe receipt could not be saved and warehouse stock restoration could not be confirmed. Review the balance and log.':'تعذر حفظ الاستلام وتمت استعادة رصيد المستودع.\nThe receipt could not be saved, and warehouse stock was restored.','err')
  }
  var movementSaved=await ctlSaveMovementLog({type:'warehouse_pdf_receipt',qty:chosen.reduce(function(a,r){return a+ctlNum(r.approvedQty)},0),note:'PDF warehouse receipt approved: '+chosen.length+' line(s)'},'PDF warehouse receipt');
  toast(movementSaved?'تم اعتماد '+chosen.length+' صنف وإضافة الكميات للمستودع ✓\nApproved '+chosen.length+' item(s) and added the quantities to warehouse stock.':'تم اعتماد الأصناف، لكن تعذر حفظ سجل الحركة.\nThe items were approved, but the movement log could not be saved.',movementSaved?'succ':'info');ctlPdfClearReview();renderControlled();return true
}
function ctlPendingPdfExpiryRows(){var out=[];ctlPdfReceipts().forEach(function(rec){(rec.rows||[]).forEach(function(r){var allocated=ctlNum(r.expiryAllocatedQty);if(!allocated&&(r.expiryBatches||[]).length)allocated=(r.expiryBatches||[]).reduce(function(a,b){return a+ctlNum(b.qty)},0);var remaining=Math.max(ctlNum(r.qty)-allocated,0);r.expiryAllocatedQty=allocated;r.expiryPending=remaining>0;if(remaining>0)out.push({receipt:rec,row:r,remaining:remaining})})});return out}
function renderCtlPdfReceiptPanel(){
  var card=el('ctl-pdf-receipt-card');if(!card)return;card.style.display=ctlPdfCanUse()?'block':'none';if(!ctlPdfCanUse())return;
  var rows=ctlPendingPdfExpiryRows(),wrap=el('ctl-pdf-pending-expiry-wrap'),box=el('ctl-pdf-pending-expiry');if(!wrap||!box)return;
  wrap.style.display=rows.length?'block':'none';if(el('ctl-pdf-pending-count'))el('ctl-pdf-pending-count').textContent=rows.length;
  box.innerHTML=rows.map(function(x,i){return '<div class="ctl-pdf-pending-row"><div><b>'+esc(x.row.medName||x.row.code)+'</b><div class="fhint">Total '+ctlNum(x.row.qty)+' · Remaining '+ctlNum(x.remaining)+' · '+esc(x.receipt.fileName||'PDF')+'</div></div><input type="number" min="1" max="'+ctlNum(x.remaining)+'" value="'+ctlNum(x.remaining)+'" id="ctl-pdf-expqty-'+i+'"><input type="date" id="ctl-pdf-exp-'+i+'"><button class="btn bp bxs" onclick="ctlSavePendingPdfExpiry(\''+esc(x.receipt.id)+'\',\''+esc(x.row.id)+'\','+i+')">حفظ الدفعة</button></div>'}).join('');
}
async function ctlSavePendingPdfExpiry(receiptId,rowId,index){
  var inp=el('ctl-pdf-exp-'+index),date=inp&&inp.value,qty=ctlNum(el('ctl-pdf-expqty-'+index)&&el('ctl-pdf-expqty-'+index).value);if(!date)return toast('اختر تاريخ الانتهاء.\nSelect the expiry date.','err');
  var originalReceipts=ctlPdfReceipts()||[],receipts=originalReceipts.map(function(rec){return Object.assign({},rec,{rows:(rec.rows||[]).map(function(r){return Object.assign({},r,{expiryBatches:(r.expiryBatches||[]).map(function(b){return Object.assign({},b)})})})})}),rec=receipts.find(function(x){return x.id===receiptId}),row=rec&&(rec.rows||[]).find(function(x){return x.id===rowId});if(!row)return toast('Receipt row not found','err');
  var allocated=ctlNum(row.expiryAllocatedQty),remaining=Math.max(ctlNum(row.qty)-allocated,0);if(qty<=0||qty>remaining)return toast('كمية دفعة الانتهاء يجب ألا تتجاوز المتبقي '+remaining+'.\nThe expiry-batch quantity cannot exceed the remaining quantity of '+remaining+'.','err');
  var originalWh=ctlWarehouse()||{},wh=Object.assign({},originalWh),w=Object.assign({},wh[row.medId]||{});w.batches=(w.batches||[]).map(function(b){return Object.assign({},b)});w.batches.push({qty:qty,expiry:ctlDate(date)||date,lot:'PDF receipt'});wh[row.medId]=w;row.expiryBatches=(row.expiryBatches||[]).concat([{qty:qty,expiry:date}]);row.expiryAllocatedQty=allocated+qty;row.expiryPending=row.expiryAllocatedQty<ctlNum(row.qty);row.expiry=row.expiryPending?'':date;var warehouseSaved=false;
  try{await ctlSetWarehouse(wh);warehouseSaved=true;await ctlSetPdfReceipts(receipts)}catch(e){
    console.error('PDF expiry batch save failed',e);var rollbackFailed=false;
    if(warehouseSaved)try{await ctlSetWarehouse(originalWh)}catch(err){rollbackFailed=true;console.error('PDF expiry warehouse rollback failed',err)}
    return toast(rollbackFailed?'تعذر حفظ دفعة الانتهاء ولم يمكن تأكيد استعادة رصيد المستودع.\nThe expiry batch could not be saved and warehouse stock restoration could not be confirmed.':'تعذر حفظ دفعة الانتهاء وتمت استعادة رصيد المستودع.\nThe expiry batch could not be saved, and warehouse stock was restored.','err')
  }
  var movementSaved=await ctlSaveMovementLog({type:'warehouse_pdf_expiry_added',medId:row.medId,qty:qty,note:'Expiry added later for PDF receipt'},'PDF expiry batch');
  toast(movementSaved?'تم حفظ تاريخ الانتهاء ✓\nThe expiry date was saved.':'تم حفظ تاريخ الانتهاء، لكن تعذر حفظ سجل الحركة.\nThe expiry date was saved, but the movement log could not be saved.',movementSaved?'succ':'info');renderControlled();return true
}

async function ctlPromptMed(existing){
  var e=existing||{},name=await uiPrompt('Medicine name',e.name||'');if(!name)return null;
  var moh=await uiPrompt('MOH code',e.moh||'')||'',nupco=await uiPrompt('NUPCO code',e.nupco||'')||'';
  var cls=String(await uiPrompt('Classification: narcotic or psychotropic',e.classification||'narcotic')||'').toLowerCase();
  if(cls!=='narcotic'&&cls!=='psychotropic'){toast('Classification must be narcotic or psychotropic','err');return null}
  var highAlert=await uiConfirm('Mark as HIGH ALERT? (Red badge)');
  var lasa=await uiConfirm('Mark as LASA? (Blue badge)');
  var refrigerated=await uiConfirm('Does this medicine require refrigerator storage (2–8°C)?');
  var min=ctlNum(await uiPrompt('Minimum quantity',e.min||0)),max=ctlNum(await uiPrompt('Maximum quantity',e.max||0));
  return {name:name.trim(),moh:moh.trim(),nupco:nupco.trim(),classification:cls,highAlert:highAlert,lasa:lasa,refrigerated:refrigerated,min:min,max:max};
}
async function ctlAddCatalogMedicine(){
  if(!ctlCanAddCatalog())return toast('No add permission','err');
  var d=await ctlPromptMed();if(!d)return;d.id=ctlKey(d.moh,d.nupco,d.name)+'_'+Date.now().toString(36);
  var a=ctlCatalog().slice();a.push(d);
  try{await ctlSetCatalog(a)}catch(e){console.error('Controlled catalogue add failed',e);return toast('Medicine was not added.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'catalog_add',medId:d.id,note:'Shared catalogue medicine added'},'Controlled catalogue add');
  renderControlled();toast(movementSaved?'Medicine added to the shared catalogue ✓':'Medicine was added, but the movement log was not saved.',movementSaved?'succ':'info');return true
}
// ── MASTER NARCOTIC STOCK RESTORE + SEPARATE OUT-OF-STOCK LIST ──


// Run the exact stock restore once after the app state is ready.
// ── CONTROLLED MODULE V6: batch editor, dispensing, analytics and print suite ──
function ctlFmtDMY(v){if(!v)return '—';var d=new Date(v);if(isNaN(d))return esc(v);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()}
function ctlCanDispense(){return typeof window.canControlledDispense==='function'&&window.canControlledDispense()}

function ctlEnsureV6UI(){
  if(el('mctlbatches'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-bg" id="mctlbatches"><div class="modal"><div class="mh"><span class="mt" id="mctlb-title">Expiry batches</span><button class="xbtn" onclick="CM('mctlbatches')">✕</button></div><div id="mctlb-list"></div><button class="btn bg bsm" onclick="ctlAddBatchEditorRow()">+ Add expiry batch</button><div class="fl g8" style="justify-content:flex-end;margin-top:18px"><button class="btn bg" onclick="CM('mctlbatches')">Cancel</button><button class="btn bp" onclick="ctlSaveBatchEditor()">Save batches</button></div></div></div>
  <div class="modal-bg" id="mctldisp"><div class="modal"><div class="mh"><span class="mt">Dispense controlled medicine / صرف دواء</span><button class="xbtn" onclick="CM('mctldisp')">✕</button></div><input type="hidden" id="ctld-med"><div class="fg"><label>Medicine</label><input id="ctld-name" disabled></div><div class="frow"><div class="fg"><label>Quantity</label><input id="ctld-qty" type="number" min="1"></div><div class="fg"><label>Dispensing type</label><select id="ctld-type" onchange="ctlDispTypeChanged()"><option value="inpatient">Inpatient / تنويم</option><option value="internal">Internal hospital department / قسم داخلي</option><option value="outpatient">Outpatient / عيادات أو مريض خارجي</option></select></div></div><div class="fg" id="ctld-dept-wrap"><label>Hospital department / القسم</label><select id="ctld-dept"></select></div><div class="fg"><label>Recipient name / اسم المستلم</label><input id="ctld-recipient"></div><div class="fg"><label>Notes</label><textarea id="ctld-note" rows="2"></textarea></div><div class="fl g8" style="justify-content:flex-end"><button class="btn bg" onclick="CM('mctldisp')">Cancel</button><button class="btn bs" onclick="ctlConfirmDispense()">Confirm dispensing</button></div></div></div>
  <input type="file" id="ctl-logo-file" accept="image/png,image/jpeg" style="display:none" onchange="ctlSavePrintLogo(this.files[0])">`);
}
globalThis.CTL_BATCH_CTX = null;
function ctlAddBatchEditorRow(b){b=b||{};var d=document.createElement('div');d.className='batch-editor-row';d.innerHTML='<input type="number" class="be-qty" min="0" placeholder="Qty" value="'+esc(b.qty||'')+'"><input type="date" class="be-exp" value="'+esc(b.expiry||'')+'"><input class="be-lot" placeholder="Batch / lot" value="'+esc(b.lot||'')+'"><button class="btn bd2c bxs" onclick="this.parentElement.remove()">✕</button>';el('mctlb-list').appendChild(d)}
async function ctlSaveBatchEditor(){
  if(!CTL_BATCH_CTX)return;
  var src=CTL_BATCH_CTX.source,id=CTL_BATCH_CTX.id,rows=Array.from(el('mctlb-list').querySelectorAll('.batch-editor-row')).map(function(r){return {qty:ctlNum(r.querySelector('.be-qty').value),expiry:r.querySelector('.be-exp').value,lot:r.querySelector('.be-lot').value.trim()}}).filter(function(b){return b.qty||b.expiry||b.lot}),actual=0;
  if(src==='pharmacy'){var curp=ctlPharmacy()[id]||{};actual=ctlNum(curp.actualQty!=null?curp.actualQty:curp.qty)}else if(src==='warehouse'){var curw=ctlWarehouse()[id]||{};actual=ctlNum(curw.system)+ctlNum(curw.outside)}
  if(actual<0)return toast('Actual quantity cannot be negative.','err');
  if(actual===0)rows=[];else{
    if(!rows.length)return toast('At least one expiry date is required when the actual quantity is greater than zero.','err');
    if(rows.length===1&&rows[0].expiry&&!(rows[0].qty>0))rows[0].qty=actual;
    for(var i=0;i<rows.length;i++){if(!(rows[i].qty>0))return toast('Every expiry row must have a quantity greater than zero.','err');if(!rows[i].expiry)return toast('Expiry date is required for each entered expiry quantity.','err')}
    var total=rows.reduce(function(a,b){return a+ctlNum(b.qty)},0);if(total!==actual)return toast('Expiry quantities must equal the actual quantity. Total: '+total+' / Actual: '+actual,'err')
  }
  try{
    if(src==='warehouse'){var all=Object.assign({},ctlWarehouse()),x=Object.assign({},all[id]||{});x.batches=rows;all[id]=x;await ctlSetWarehouse(all)}
    else{var all2=Object.assign({},ctlPharmacy()),x2=Object.assign({},all2[id]||{});x2.batches=rows;x2.qty=actual;all2[id]=x2;await ctlSetPharmacy(all2)}
  }catch(e){console.error('Controlled expiry batch save failed',e);return toast('Expiry batches were not saved.','err')}
  var movementSaved=await ctlSaveMovementLog({type:'expiry_batches_update',medId:id,source:src,note:'Expiry batches updated'},'Controlled expiry batches');
  CM('mctlbatches');renderControlled();toast(movementSaved?(actual===0?'Expiry batches cleared ✓':'Expiry batches saved ✓'):(actual===0?'Expiry batches were cleared, but the movement log was not saved.':'Expiry batches were saved, but the movement log was not saved.'),movementSaved?'succ':'info');return true
}
function ctlOpenDispense(id){if(!ctlCanDispense())return;ctlEnsureV6UI();var m=ctlMedicine(id)||{};el('ctld-med').value=id;el('ctld-name').value=m.name||'';el('ctld-qty').value='';el('ctld-recipient').value='';el('ctld-note').value='';el('ctld-dept').innerHTML=gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');ctlDispTypeChanged();OM('mctldisp')}
function ctlDispTypeChanged(){var t=el('ctld-type').value;el('ctld-dept-wrap').style.display=(t==='inpatient'||t==='internal')?'block':'none'}
function ctlLogo(){return S.g('controlled_print_logo')||''}
function ctlChooseLogo(){ctlEnsureV6UI();el('ctl-logo-file').click()}
async function ctlSavePrintLogo(file){if(!file)return;try{var data=await window.fsPrepareImageDataUrl(file);await S.s('controlled_print_logo',data);toast('Print logo saved ✓','succ')}catch(error){var input=el('ctl-logo-file');if(input)input.value='';toast(String(error&&error.message||error),'err')}}
function ctlPrintSettings(dept){return S.g('controlled_settings_'+dept)||{}}
function ctlPublicUrl(dept){var u=new URL(window.location.href);u.search='';u.hash='';u.searchParams.set('view','controlled-expiry');u.searchParams.set('dept',dept);var tenant=window.fsTenantId&&fsTenantId();if(tenant)u.searchParams.set('tenant',tenant);return u.toString()}
async function ctlPublishDept(dept){
  if(!window.FB_DB)throw new Error('Firebase is not initialized');
  var d=(typeof gd==='function'?(gd()||[]):[]).find(function(x){return x.id===dept})||{};
  var items=(typeof ctlDeptList==='function'?ctlDeptList(dept):[]).map(function(x){var m=typeof ctlMedicine==='function'?(ctlMedicine(x.medId)||{}):{};return {name:m.name||'',classification:m.classification||'narcotic',qty:ctlNum(x.qty),batches:(x.batches||[]).map(function(b){return {expiry:b.expiry||'',qty:b.qty==null?'':ctlNum(b.qty)}})}});
  var alertDays=((typeof ctlSettingsGlobal==='function'?(ctlSettingsGlobal()||{}):{}).expiryAlertDays||30);
  var collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');
  await collection.doc(dept).set({departmentId:dept,departmentName:d.name||((window.CU&&CU.deptId===dept)?CU.deptName:'')||dept,alertDays:Number(alertDays)||30,items:items,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:false});
}
function renderCtlAnalytics(){if(!CU)return;var deptSel=el('ctl-an-dept');if(deptSel&&deptSel.options.length<=1)deptSel.innerHTML='<option value="">All departments</option>'+gd().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');var from=el('ctl-an-from')?el('ctl-an-from').value:'',to=el('ctl-an-to')?el('ctl-an-to').value:'',type=el('ctl-an-type')?el('ctl-an-type').value:'',dept=deptSel?deptSel.value:'',rec=(el('ctl-an-recipient')?el('ctl-an-recipient').value:'').toLowerCase();var rows=ctlMoves().filter(function(x){if(x.type!=='dispense')return false;var d=String(x.at||'').slice(0,10);return (!from||d>=from)&&(!to||d<=to)&&(!type||x.dispenseType===type)&&(!dept||x.dept===dept)&&(!rec||String(x.recipient||'').toLowerCase().includes(rec))});var total=rows.reduce(function(s,x){return s+ctlNum(x.qty)},0),recipients=new Set(rows.map(function(x){return x.recipient}).filter(Boolean)).size,depts=new Set(rows.map(function(x){return x.dept}).filter(Boolean)).size;el('ctl-an-stats').innerHTML='<div class="sc"><div class="sl">Transactions</div><div class="ctl-stat-number">'+rows.length+'</div></div><div class="sc"><div class="sl">Total quantity</div><div class="ctl-stat-number">'+total+'</div></div><div class="sc"><div class="sl">Recipients</div><div class="ctl-stat-number">'+recipients+'</div></div><div class="sc"><div class="sl">Departments</div><div class="ctl-stat-number">'+depts+'</div></div>';el('ctl-an-table').innerHTML=rows.slice().reverse().map(function(x){var m=ctlMedicine(x.medId)||{};return '<tr><td>'+fmtDateTime(x.at)+'</td><td>'+esc(m.name||'')+'</td><td>'+ctlNum(x.qty)+'</td><td>'+esc(x.source||'')+'</td><td>'+esc(x.dispenseType||'')+'</td><td>'+esc(x.deptName||'—')+'</td><td>'+esc(x.recipient||'')+'</td><td>'+esc(x.by||'')+'</td></tr>'}).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px">No matching records</td></tr>'}
function printCtlAnalytics(){var html=el('ctl-an-table').closest('table').outerHTML;ctlPrintHTML('Controlled dispensing analytics','<h1>إحصائيات صرف الأدوية المخدرة</h1><h2>Controlled Dispensing Analytics</h2>'+html)}
// Override public barcode page to be login-free and cleaner.
// Add buttons and improved batch controls after each controlled render.


globalThis.CTL_DEPT_SELECTED = {};

function ctlDeptShelves(deptId){
  return S.g('controlled_dept_shelves_'+deptId)||[];
}
function ctlSetDeptShelves(deptId,arr){
  return S.s('controlled_dept_shelves_'+deptId,arr);
}
function ctlDeptShelfName(deptId,shelfId){
  var s=ctlDeptShelves(deptId).find(function(x){return x.id===shelfId});
  return s?s.name:'—';
}
function ctlToggleDeptMed(cb){
  var dept=ctlCurrentDept();
  if(!CTL_DEPT_SELECTED[dept])CTL_DEPT_SELECTED[dept]={};
  if(cb.checked)CTL_DEPT_SELECTED[dept][cb.dataset.id]=true;
  else delete CTL_DEPT_SELECTED[dept][cb.dataset.id];
  ctlRefreshDeptBulkBar();
}
function ctlToggleAllDeptMeds(cb){
  var dept=ctlCurrentDept(),list=ctlDeptList(dept);
  CTL_DEPT_SELECTED[dept]={};
  list.forEach(function(x){
    if(cb.checked)CTL_DEPT_SELECTED[dept][x.medId]=true;
  });
  renderCtlDepartments();
}
function ctlSelectedDeptIds(){
  var dept=ctlCurrentDept();
  return Object.keys(CTL_DEPT_SELECTED[dept]||{}).filter(function(id){return CTL_DEPT_SELECTED[dept][id]});
}
function ctlRefreshDeptBulkBar(){
  var ids=ctlSelectedDeptIds(),btn=el('ctl-bulk-shelf-btn');
  if(btn){
    btn.style.display=ctlCanEditDept()&&ids.length?'inline-flex':'none';
    btn.textContent='Add '+ids.length+' selected to shelf';
  }
}
async function ctlOpenBulkShelf(){
  var ids=ctlSelectedDeptIds();
  if(!ids.length)return toast('Select at least one medicine','err');
  var dept=ctlCurrentDept(),shelves=ctlDeptShelves(dept);
  var sel=el('ctl-bulk-shelf-select');
  sel.innerHTML=shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');
  if(!shelves.length){
    var name=await uiPrompt('No shelf exists. Enter a new shelf name, e.g. Refrigerator / ثلاجة','');
    if(!name)return;
    var shelf={id:'shelf_'+Date.now().toString(36),name:name.trim(),created:nowISO()};
    ctlSetDeptShelves(dept,[shelf]).then(function(){
      sel.innerHTML='<option value="'+shelf.id+'">'+esc(shelf.name)+'</option>';
      el('ctl-bulk-shelf-count').textContent=ids.length+' medicines selected';
      OM('mctl-bulk-shelf');
    });
    return;
  }
  el('ctl-bulk-shelf-count').textContent=ids.length+' medicines selected';
  OM('mctl-bulk-shelf');
}
async function ctlApplyBulkShelf(){
  if(!ctlCanEditDept())return toast('No permission','err');
  var dept=ctlCurrentDept(),shelfId=el('ctl-bulk-shelf-select').value,ids=ctlSelectedDeptIds();
  if(!shelfId||!ids.length)return;
  var list=ctlDeptList(dept).map(function(x){return ids.includes(x.medId)?Object.assign({},x,{shelfId:shelfId}):x});
  try{await ctlSetDeptList(dept,list)}catch(e){console.error('Bulk department shelf assignment failed',e);return toast('Shelf assignment was not saved.','err')}
  CTL_DEPT_SELECTED[dept]={};CM('mctl-bulk-shelf');toast(ids.length+' medicines added to shelf ✓','succ');renderCtlDepartments();return true
}
function ctlSelectDepartmentForEdit(dept){
  var select=el('ctl-dept');
  if(select&&dept){select.value=String(dept);}
}
function ctlEditDeptMedicineFromAggregate(dept,medId){
  if(!ctlCanEditDept())return toast('No permission','err');
  ctlSelectDepartmentForEdit(dept);
  return ctlEditDeptMedicine(medId);
}
function ctlRemoveDeptMedicineFromAggregate(dept,medId){
  if(!ctlCanEditDept())return toast('No permission','err');
  ctlSelectDepartmentForEdit(dept);
  return ctlRemoveDeptMedicine(medId);
}

function renderCtlDepartments(){
  if(ctlIsWarehouse()){var v=el('ctl-departments-view');if(v)v.style.display='none';return;}
  var sel=el('ctl-dept'),ds=gd(),cur=sel.value;
  if((ctlIsOfficer()||ctlIsMaster())&&!sel.dataset.allDefaulted){cur='__all_inpatient__';sel.dataset.allDefaulted='1';}
  if(CU.role==='department')sel.innerHTML='<option value="'+CU.deptId+'">'+esc(CU.deptName)+'</option>';
  else {
    var allOption=(ctlIsOfficer()||ctlIsMaster())?'<option value="__all_inpatient__">All inpatient departments / كل أقسام التنويم</option>':'';
    sel.innerHTML=allOption+ds.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  }
  if(cur&&Array.from(sel.options).some(function(o){return o.value===cur}))sel.value=cur;
  var dept=ctlCurrentDept(),assignedList=ctlDeptList(dept),list=assignedList,can=ctlCanEditDept();
  var aggregate=dept==='__all_inpatient__';
  if(dept==='__all_inpatient__'){
    list=[];
    ds.forEach(function(d){(ctlDeptList(d.id)||[]).forEach(function(row){list.push(Object.assign({},row,{_deptId:d.id,_deptName:d.name}));});});
    can=false;
  }
  el('ctl-assign-btn').style.display=can?'inline-flex':'none';
  el('ctl-sign-btn').style.display=can?'inline-flex':'none';

  var selected=CTL_DEPT_SELECTED[dept]||{};
  var alerts=[];
  list.forEach(function(x){
    (x.batches||[]).forEach(function(b){
      var d=daysUntil(b.expiry);
      if(d!==null&&d<=ctlAlertDays())alerts.push({name:(ctlMedicine(x.medId)||{}).name||'',days:d});
    });
  });
  el('ctl-dept-alerts').innerHTML=alerts.length
    ?'<div class="alert-banner">⚠ '+alerts.map(function(a){return esc(a.name)+' ('+(a.days<=0?'expired '+Math.abs(a.days)+'d':a.days+'d')+')'}).join(' · ')+'</div>'
    :'';

  el('ctl-dept-table').innerHTML=list.length?list.map(function(x,i){
    var m=ctlMedicine(x.medId)||{};
    return '<tr>'+
      '<td><input type="checkbox" data-id="'+x.medId+'" onchange="ctlToggleDeptMed(this)" '+(selected[x.medId]?'checked':'')+'></td>'+
      '<td>'+(i+1)+'</td>'+
      '<td>'+esc(m.moh||'—')+'</td>'+
      '<td>'+esc(m.nupco||'—')+'</td>'+
      '<td><b>'+esc(m.name||'')+'</b>'+ctlFridgeIcon(m)+'</td>'+
      '<td>'+ctlClassLabel(m.classification)+'</td>'+
      '<td>'+ctlFlags(m)+'</td>'+
      '<td>'+ctlNum(x.min!=null?x.min:m.min)+'</td>'+
      '<td>'+ctlNum(x.max!=null?x.max:m.max)+'</td>'+
      '<td>'+ctlNum(x.qty)+'</td>'+
      '<td>'+ctlBatchText(x.batches)+'</td>'+
      '<td>'+(aggregate&&ctlCanEditDept()?'<button class="btn bg bxs" data-dept="'+esc(x._deptId||'')+'" data-id="'+x.medId+'" onclick="ctlEditDeptMedicineFromAggregate(this.dataset.dept,this.dataset.id)">Edit</button> <button class="btn bd2c bxs" data-dept="'+esc(x._deptId||'')+'" data-id="'+x.medId+'" onclick="ctlRemoveDeptMedicineFromAggregate(this.dataset.dept,this.dataset.id)">Remove</button>':(can?'<button class="btn bg bxs" data-id="'+x.medId+'" onclick="ctlEditDeptMedicine(this.dataset.id)">Edit</button> <button class="btn bd2c bxs" data-id="'+x.medId+'" onclick="ctlRemoveDeptMedicine(this.dataset.id)">Remove</button>':'<span class="chip">Read only</span>'))+'</td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--tx2)">No medicines assigned to this department.</td></tr>';

  if(el('ctl-dept-select-all')){
    el('ctl-dept-select-all').checked=list.length>0&&list.every(function(x){return selected[x.medId]});
  }
  ctlRefreshDeptBulkBar();
}


function requestColdMarker(m){
  return m&&m.refrigerated
    ?'<span class="request-snow-marker" title="Refrigerated / Store in refrigerator (2–8°C)" aria-label="Refrigerated medicine">❄️</span>'
    :'';
}


// ═══════════════════════════════════════════════════════════
// COMPREHENSIVE ACCESS, DEPARTMENT INVENTORY, CRASH CART,
// REQUEST RECEIVING AND CONTROLLED-MEDICINE ENHANCEMENTS
// ═══════════════════════════════════════════════════════════
globalThis.MASTER_ACTUAL = null;
globalThis.MASTER_EFFECTIVE = null;

function actualUser(){
  return MASTER_ACTUAL||CU;
}
function actualActorName(){
  var u=actualUser();
  return u?(u.username||u.email||'Unknown'):'Unknown';
}
function isMasterActual(){return !!(MASTER_ACTUAL&&MASTER_ACTUAL.master===true)||!!(CU&&CU.master===true&&!MASTER_ACTUAL)}
function isPharmacyDirector(){return (window.fsEffectiveRole?window.fsEffectiveRole():String(CU&&CU.role||''))==='pharmacy'}
function isInpatientSupervisor(){return (window.fsEffectiveRole?window.fsEffectiveRole():String(CU&&CU.role||''))==='inpatient_supervisor'}
function isPharmacyStaff(){return (window.fsEffectiveRole?window.fsEffectiveRole():String(CU&&CU.role||''))==='pharmacy_staff'}
function canManageRequests(){return window.fsHasCapability?window.fsHasCapability('requests.manage'):(isPharmacyDirector()||isInpatientSupervisor()||isPharmacyStaff()||role()==='outpatient_pharmacy_supervisor')}
function canManageCrashCart(){return window.fsCanManageCrashCart?window.fsCanManageCrashCart():(isPharmacyDirector()||isInpatientSupervisor()||isPharmacyStaff()||role()==='outpatient_pharmacy_supervisor')}
function canConfigureCrashCart(){return window.fsHasCapability?window.fsHasCapability('crashCart.configure'):(isPharmacyDirector()||isInpatientSupervisor()||role()==='outpatient_pharmacy_supervisor')}
function requireCrashCartConfigurationPermission(){if(canConfigureCrashCart())return true;toast('Only the Pharmacy Director or Inpatient Pharmacy Supervisor can change Crash Cart medicines and quantities. / التعديل متاح فقط لمدير الصيدلية أو مشرف الصيدلية الداخلية','err');return false}
function canManageUsers(){return isPharmacyDirector()&&!MASTER_EFFECTIVE}

function masterRoleLabel(role){
  return role==='pharmacy'?'Pharmacy Director / مدير الصيدلية'
    :role==='inpatient_supervisor'?'Inpatient Pharmacy Supervisor / مشرف الصيدلية الداخلية'
    :role==='outpatient_pharmacy_supervisor'?'Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية'
    :role==='pharmacy_staff'?'Pharmacy Employee / موظف صيدلية'
    :role==='controlled_pharmacy'?'Controlled Medicines Pharmacy Officer / مسؤول الأدوية الخاضعة للرقابة'
    :role==='warehouse'?'Warehouse Custody Officer / مسؤول عهدة المستودع'
    :role==='department'?'Department Employee / موظف قسم'
    :role||'Unknown role';
}
function ensureMasterRoleModal(){return typeof window.fsR6EnsureMasterModal==='function'?window.fsR6EnsureMasterModal():null}
function masterRoleSelectionChanged(){
  var role=el('master-role-select')?el('master-role-select').value:'pharmacy';
  var wrap=el('master-dept-wrap');if(wrap)wrap.style.display=role==='department'?'block':'none';
  masterPreviewRole();
}
function masterPreviewRole(){
  var role=el('master-role-select')?el('master-role-select').value:'pharmacy';
  var deptId=el('master-dept-select')?el('master-dept-select').value:'';
  var dept=role==='department'?gd().find(function(d){return d.id===deptId}):null;
  var preview=el('master-user-preview');if(!preview)return;
  preview.innerHTML='<strong>Effective permissions:</strong> '+esc(masterRoleLabel(role))
    +(role==='department'?'<br><strong>Department:</strong> '+esc(dept?dept.name:'No department selected'):'')
    +'<br><strong>Actual signed-in user:</strong> '+esc((actualUser()||{}).email||(actualUser()||{}).username||'Master')+' (Master)';
}


function startApp(){
  if(typeof window.preparePreviewStart==='function')window.preparePreviewStart();
  if(typeof window.prepareRoleUiStart==='function')window.prepareRoleUiStart();
  if(CU&&CU.master===true&&!MASTER_EFFECTIVE&&!MASTER_ACTUAL)MASTER_ACTUAL=Object.assign({},CU);
    el('auth').style.display='none';el('app').style.display='block';
    el('tuser').textContent=['pharmacy','controlled_pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(CU.role)>=0?'👤 '+CU.username:(CU.role==='warehouse'?'📦 '+CU.username:'🏢 '+CU.deptName);
    var rb=el('rbadge');
    rb.innerHTML=CU.role==='pharmacy'?'🏥 Pharmacy'+(CU.master===true?' · Master':'')
      :CU.role==='controlled_pharmacy'?'🔒 Controlled Medicines Pharmacy Officer'
      :CU.role==='warehouse'?'📦 Warehouse Custody Officer'
      :CU.role==='inpatient_supervisor'?'🏥 Inpatient Pharmacy Supervisor / مشرف الصيدلية الداخلية'
      :CU.role==='outpatient_pharmacy_supervisor'?'🏥 Outpatient Pharmacy Supervisor'
      :CU.role==='pharmacy_staff'?'💊 Pharmacy Staff'
      :'🏢 '+CU.deptName;
    rb.className='trole '+(['pharmacy','controlled_pharmacy','inpatient_supervisor','pharmacy_staff'].indexOf(CU.role)>=0?'rph':'rdp');
    buildNav();
    var initialPage=CU.role==='department'?'pg-newreq':((CU.role==='warehouse'||CU.role==='controlled_pharmacy')?'pg-controlled':'pg-dash');
    showPg(initialPage);
    updateNotesBadge();
  document.body.classList.remove('role-pharmacy_staff','role-inpatient_supervisor');
  if(CU)document.body.classList.add('role-'+CU.role);
  if(MASTER_EFFECTIVE&&MASTER_ACTUAL){
    el('tuser').textContent='👤 '+(MASTER_ACTUAL.email||MASTER_ACTUAL.username||'Master')+' → testing '+(MASTER_EFFECTIVE.email||'user');
    var rb=el('rbadge');if(rb)rb.innerHTML='🧪 '+masterRoleLabel(MASTER_EFFECTIVE.role)+(MASTER_EFFECTIVE.deptName?' · '+esc(MASTER_EFFECTIVE.deptName):'');
  }
  addMasterSwitchButton();
  scheduleAutomaticOrderCleanup();
  if(!canManageUsers()){
    var ub=document.querySelector('[data-pg="pg-users"]');if(ub)ub.remove();
  }
  if(typeof window.addMasterCleanupButton==='function')window.addMasterCleanupButton();
  if(typeof window.prepareControlledStartup==='function')window.prepareControlledStartup();
  if(typeof window.syncOfficialHeaderButton==='function')window.syncOfficialHeaderButton();
  if(typeof window.runDailyBackup==='function')window.runDailyBackup();
  repairDeletedDepartments();
  setTimeout(function(){if(typeof window.fsR17MigrateMedicationIdentity==='function')window.fsR17MigrateMedicationIdentity().catch(function(e){console.warn('Medication identity migration skipped',e)})},700);
  if(typeof window.runExpiryStartupAlert==='function')window.runExpiryStartupAlert();
  if(typeof window.finalizeRoleUiStart==='function')window.finalizeRoleUiStart();
  if(typeof window.finalizePreviewStart==='function')window.finalizePreviewStart();
}
// Publish the canonical startup entry point explicitly. Inline handlers and
// authentication live in earlier script blocks, so relying only on an implicit
// cross-script global causes intermittent "startApp is not defined" failures
// in stricter WebKit/Safari execution environments.
window.startApp=startApp;
// Master uniqueness is enforced directly by saveUser.

// Bulk medication flags for any inventory.
async function bulkSetMedicationFlag(flag){
  var ids=getSelectedMedIds(),deptId=getInvDept();
  if(!deptId)return toast('Choose a department first','err');
  if(!ids.length)return toast('Select medications first','err');
  var label=flag==='refrigerated'?'Refrigerated':flag==='lasa'?'LASA':flag==='hazard'?'Hazard':'High Alert';
  var setTo=await uiConfirm('Press OK to mark selected medicines as '+label+'.\nPress Cancel to remove the flag.');
  var meds=getMeds(deptId).map(function(m){if(ids.includes(m.id)){var n=Object.assign({},m);n[flag]=setTo;return n}return m});
  await setMeds(deptId,meds);auditAction('bulk_medication_flag',{deptId:deptId,ids:ids,flag:flag,value:setTo});toast(ids.length+' medicines updated ✓','succ');clearInvSelection();renderInv();
}

// Pharmacy request permissions and actual master attribution.

/* Print Orders permission/audit logic is handled by the canonical print module below. */

// Add receive/expiry action after fulfillment for departments.

/* Department receive/expiry actions use the consolidated flow below. */


// Full department inventory.


// ── DEPARTMENT SHELF MEDICATION DATABASE ─────────────────
globalThis.SHELF_MED_SELECTED = {};
function shelfSelectedIds(){return Object.keys(SHELF_MED_SELECTED).filter(function(id){return SHELF_MED_SELECTED[id]})}
function shelfMedMatches(m){
  var q=((el('shelf-med-search')||{}).value||'').trim().toLowerCase();
  var f=((el('shelf-med-filter')||{}).value||'all');
  if(q && !(String(m.name||'').toLowerCase().includes(q)||String(m.category||'').toLowerCase().includes(q)))return false;
  if(f==='__none__' && m.shelfId)return false;
  if(f==='__no_expiry__'){
    var hasExpiry=getExpiry(CU.deptId).some(function(b){return b.medId===m.id&&String(b.date||'').trim();});
    if(hasExpiry)return false;
  }
  if(f==='__expiring_soon__'){
    var cfg=getAlertSettings(CU.deptId)||{d1:30,d2:7};
    var isSoon=getExpiry(CU.deptId).some(function(b){
      if(b.medId!==m.id||!String(b.date||'').trim())return false;
      var days=daysUntil(b.date);
      return days!==null&&days>0&&days<=Number(cfg.d1||30);
    });
    if(!isSoon)return false;
  }
  if(f!=='all'&&f!=='__none__'&&f!=='__no_expiry__'&&f!=='__expiring_soon__'&&m.shelfId!==f)return false;
  return true;
}
function shelfExpiryCell(medId){
  var cfg=getAlertSettings(CU.deptId)||{d1:30,d2:7};
  var batches=getExpiry(CU.deptId).filter(function(b){return b.medId===medId;}).sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));});
  var rows=batches.map(function(b){
    var days=daysUntil(b.date),cls='exp-ok',label='—';
    if(days!==null&&days<=0){cls='exp-red';label=(days===0?'Expires today':'Expired '+Math.abs(days)+' day'+(Math.abs(days)===1?'':'s')+' ago');}
    else if(days!==null){
      label=days+' day'+(days===1?'':'s')+' remaining';
      if(days<=Number(cfg.d2||7))cls='exp-red';
      else if(days<=Number(cfg.d1||30))cls='exp-yellow';
    }
    return '<div class="'+cls+'" style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">'
      +'<span><b>'+esc(fmtDate(b.date))+'</b>'+(b.batch?' · '+esc(b.batch):'')+' <small>('+label+')</small></span>'
      +'<span style="white-space:nowrap"><button class="btn bg bxs" data-bid="'+b.id+'" data-mid="'+medId+'" data-batch="'+esc(b.batch||'')+'" data-date="'+esc(b.date||'')+'" onclick="openEditExpiry(this)">✎</button> '
      +'<button class="btn bd2c bxs" data-bid="'+b.id+'" onclick="delBatch(this.dataset.bid,this)">×</button></span></div>';
  }).join('');
  return (rows||'<span style="color:var(--tx3)">No expiry batches</span>')
    +'<div style="margin-top:5px"><button class="btn bg bxs" data-mid="'+medId+'" onclick="openAddExpiryForMed(this.dataset.mid)">+ Add expiry</button></div>';
}
function openAddExpiryForMed(medId){
  openAddExpiry();
  if(el('exp-med-sel'))el('exp-med-sel').value=medId;
}
function renderShelfMedicationDatabase(){
  if(!CU||CU.role!=='department'||!el('shelf-med-db'))return;
  var shelves=getShelves(CU.deptId),meds=getMeds(CU.deptId),shown=meds.filter(shelfMedMatches);
  var cfg=typeof getPharmacyCategoryConfig==='function'?getPharmacyCategoryConfig(CU.deptId):{order:[]};
  var order=cfg.order||[];
  shown.sort(function(a,b){
    var ac=String(a.category||'Uncategorized'),bc=String(b.category||'Uncategorized');
    var ai=order.indexOf(ac),bi=order.indexOf(bc);
    if(ai<0)ai=999;if(bi<0)bi=999;
    var cc=ai-bi;
    return cc||String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base',numeric:true});
  });
  var filter=el('shelf-med-filter'),target=el('shelf-bulk-target');
  if(filter){
    var fv=filter.value;
    filter.innerHTML='<option value="all">All medications / كل الأدوية</option><option value="__none__">Unassigned / غير معيّنة لدرج</option><option value="__no_expiry__">No expiry date / بدون تاريخ انتهاء</option><option value="__expiring_soon__">Expiring soon / قريبة الانتهاء</option>'+shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');
    if(Array.from(filter.options).some(function(o){return o.value===fv}))filter.value=fv;
  }
  if(target){var tv=target.value;target.innerHTML='<option value="">Choose drawer...</option><option value="__none__">Remove from drawer</option>'+shelves.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('');if(Array.from(target.options).some(function(o){return o.value===tv}))target.value=tv}
  var rowNo=0,lastCategory=null,html='';
  shown.forEach(function(m){
    var category=String(m.category||'Uncategorized');
    if(category!==lastCategory){
      var count=shown.filter(function(x){return String(x.category||'Uncategorized')===category;}).length;
      html+='<tr class="shelf-category-row"><td colspan="9" style="background:var(--s3);color:var(--tx);font-weight:700;padding:9px 12px;border-top:2px solid var(--bd2)">'+esc(category)+' <span class="chip" style="margin-inline-start:6px">'+count+'</span></td></tr>';
      lastCategory=category;
    }
    rowNo++;
    html+='<tr><td><input type="checkbox" '+(SHELF_MED_SELECTED[m.id]?'checked':'')+' data-mid="'+m.id+'" onchange="toggleShelfMedication(this.dataset.mid,this.checked)"></td>'
      +'<td>'+rowNo+'</td><td><b>'+esc(m.name)+'</b>'+requestColdMarker(m)+'</td><td>'+esc(category)+'</td><td>'+bdg(m)+'</td>'
      +'<td>'+(m.shelfId?'<span class="shelf-badge">'+esc(getShelfName(m.shelfId))+'</span>':'<span class="badge bgr">Unassigned</span>')+'</td>'
      +'<td>'+shelfExpiryCell(m.id)+'</td>'
      +'<td style="text-align:center">'+esc(m.min==null?'—':m.min)+'</td><td style="text-align:center">'+esc(m.max==null?'—':m.max)+'</td></tr>';
  });
  el('shelf-med-db').innerHTML=html||'<tr><td colspan="9" style="text-align:center;padding:26px;color:var(--tx2)">No medications match this search.</td></tr>';
  var ids=shelfSelectedIds(),bar=el('shelf-bulk-bar');if(bar)bar.style.display=ids.length?'block':'none';
  if(el('shelf-selected-count'))el('shelf-selected-count').textContent=ids.length+' selected';
  var all=el('shelf-med-all');if(all){all.checked=shown.length>0&&shown.every(function(m){return !!SHELF_MED_SELECTED[m.id]});all.indeterminate=!all.checked&&shown.some(function(m){return !!SHELF_MED_SELECTED[m.id]})}
}
function toggleShelfMedication(id,v){SHELF_MED_SELECTED[id]=v;renderShelfMedicationDatabase()}
function toggleAllShelfMedications(v){getMeds(CU.deptId).filter(shelfMedMatches).forEach(function(m){SHELF_MED_SELECTED[m.id]=v});renderShelfMedicationDatabase()}
function clearShelfMedicationSelection(){SHELF_MED_SELECTED={};renderShelfMedicationDatabase()}
async function assignSelectedMedsToShelf(){
  var ids=shelfSelectedIds(),target=(el('shelf-bulk-target')||{}).value;
  if(!ids.length)return toast('Select one or more medications first','err');
  if(!target)return toast('Choose a drawer first','err');
  var shelfId=target==='__none__'?'':target;
  var meds=getMeds(CU.deptId).map(function(m){return ids.includes(m.id)?Object.assign({},m,{shelfId:shelfId}):m});
  await setMeds(CU.deptId,meds);auditAction('department_bulk_shelf',{deptId:CU.deptId,ids:ids,shelfId:shelfId});
  SHELF_MED_SELECTED={};renderShelves();toast(ids.length+' medications updated ✓','succ');
}

// Crash Cart
function crashCarts(){return S.g('crash_carts')||[]}
function crashReports(){return S.g('crash_cart_reports')||[]}
function setCrashReports(v){return S.s('crash_cart_reports',v)}
function crashCart(id){return crashCarts().find(function(c){return c.id===id})}


// Controlled medicines: hospital, approved flag, barcode, separated narcotic/psychotropic.
function ctlSettingsGlobal(){return S.g('controlled_global_settings')||{hospitalName:'',approved:false,expiryAlertDays:30}}

// ── BOOT ─────────────────────────────────────────────────
function boot(){
  try{
    initFirebase();
    var view=new URLSearchParams(window.location.search).get('view');
    if(view==='expiry'||view==='controlled-expiry'||view==='crash-cart-public'){
      var auth=el('auth'),app=el('app');if(auth)auth.style.display='none';if(app)app.style.display='none';
      return;
    }
    if(view==='request'){checkPublicView();return;}
    applyTheme();
  }
  catch(err){console.error(err);el('aerr').textContent='Firebase failed to initialize. Check the connection and Firebase setup.';el('aerr').style.display='block';}
}
boot();
document.addEventListener('visibilitychange',function(){
  if(document.hidden){if(typeof window.persistTransientUiState==='function')window.persistTransientUiState();return}
  if(S.ready&&CU)S.scheduleRefresh();
});
// Expiry check after authenticated app startup.
window.runExpiryStartupAlert=function(){
  if(!S.ready||!CU||document.visibilityState!=='visible')return;
  var alerts=[];
  gd().forEach(function(dept){
    var exp=getExpiry(dept.id);
    var ms=getMeds(dept.id);
    var cfg=getAlertSettings(dept.id);
    (Array.isArray(exp)?exp:[]).forEach(function(batch){
      var medId=batch&&batch.medId;
      var m=ms.find(function(x){return String(x.id)===String(medId)});
      if(!m)return;
      var days=daysUntil((batch&&batch.date)||(batch&&batch.expiry));
      if(days!==null&&days<=cfg.d2){alerts.push(dept.name+': '+m.name+' ('+days+'d)');}
    });
  });
  var alertRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
  if(alerts.length&&['pharmacy','pharmacy_manager','inpatient_supervisor','outpatient_pharmacy_supervisor','pharmacy_staff'].indexOf(alertRole)<0)toast('⚠ Expiry alert: '+alerts.slice(0,3).join(', ')+(alerts.length>3?' +more':''),'info');
};


const __asdhLegacyApi = {
  renderShelfAlertSettings: renderShelfAlertSettings,
  openAddExpiry: openAddExpiry,
  openEditExpiry: openEditExpiry,
  renderUsers: renderUsers,
  updateUserRoleFields: updateUserRoleFields,
  openAddUser: openAddUser,
  saveUser: saveUser,
  delUser: delUser,
  toggleMasterUser: toggleMasterUser,
  renderAn: renderAn,
  orderRetentionCutoff: orderRetentionCutoff,
  requestArchiveRecord: requestArchiveRecord,
  cleanupOldOrders: cleanupOldOrders,
  scheduleAutomaticOrderCleanup: scheduleAutomaticOrderCleanup,
  setPPP: setPPP,
  resetPrintPageState: resetPrintPageState,
  renderImport: renderImport,
  clearImport: clearImport,
  ensureXLSX: ensureXLSX,
  handleXlsxDrop: handleXlsxDrop,
  handleXlsxFile: handleXlsxFile,
  parseCsvData: parseCsvData,
  parseXlsxData: parseXlsxData,
  recognizeCat: recognizeCat,
  parseImport: parseImport,
  renderImportPreview: renderImportPreview,
  impEdit: impEdit,
  impToggleRow: impToggleRow,
  impSelectAll: impSelectAll,
  confirmImport: confirmImport,
  renderDeptPrint: renderDeptPrint,
  doDeptPrint: doDeptPrint,
  catAr: catAr,
  renderShelves: renderShelves,
  getShelfName: getShelfName,
  openAddShelf: openAddShelf,
  openEditShelf: openEditShelf,
  printShelfList: printShelfList,
  checkPublicView: checkPublicView,
  renderMobileRequest: renderMobileRequest,
  getNotes: getNotes,
  setNotes: setNotes,
  noteEsc: noteEsc,
  noteStatus: noteStatus,
  noteType: noteType,
  renderDeptNotes: renderDeptNotes,
  renderPharmNotes: renderPharmNotes,
  openNoteReply: openNoteReply,
  updateNotesBadge: updateNotesBadge,
  switchExpTab: switchExpTab,
  parseBarcode: parseBarcode,
  parseExpiryStr: parseExpiryStr,
  formatParsedFields: formatParsedFields,
  getMedSelectOptions: getMedSelectOptions,
  fuzzyMatchMed: fuzzyMatchMed,
  startScanner: startScanner,
  switchCamera: switchCamera,
  stopScanner: stopScanner,
  restartScanner: restartScanner,
  captureFrame: captureFrame,
  onScanSuccess: onScanSuccess,
  applyScanResult: applyScanResult,
  parseTypedBarcode: parseTypedBarcode,
  applyTypedResult: applyTypedResult,
  CM: CM,
  getCategories: getCategories,
  setCategories: setCategories,
  refreshCatSelectors: refreshCatSelectors,
  toggleAllInv: toggleAllInv,
  onInvCheck: onInvCheck,
  clearInvSelection: clearInvSelection,
  getSelectedMedIds: getSelectedMedIds,
  bulkDelete: bulkDelete,
  getLogo: getLogo,
  setLogoData: setLogoData,
  openLogoSettings: openLogoSettings,
  handleLogoDrop: handleLogoDrop,
  handleLogoFile: handleLogoFile,
  saveLogo: saveLogo,
  clearLogo: clearLogo,
  officialPrintHeaderHTML: officialPrintHeaderHTML,
  getCatOptions: getCatOptions,
  getReqWindows: getReqWindows,
  setReqWindows: setReqWindows,
  getDispSlots: getDispSlots,
  setDispSlots: setDispSlots,
  getMonthlyLimits: getMonthlyLimits,
  setMonthlyLimits: setMonthlyLimits,
  fmt12: fmt12,
  dayBits: dayBits,
  timeToMins: timeToMins,
  getMonthlyReqCount: getMonthlyReqCount,
  getMonthlyLimit: getMonthlyLimit,
  renderSchedule: renderSchedule,
  editReqWindow: editReqWindow,
  addDispSlot: addDispSlot,
  editDispSlot: editDispSlot,
  openBulkLimits: openBulkLimits,
  applyBulkLimit: applyBulkLimit,
  getNextDispSlot: getNextDispSlot,
  ctlIsMaster: ctlIsMaster,
  ctlCanEditCatalog: ctlCanEditCatalog,
  ctlCanAddCatalog: ctlCanAddCatalog,
  ctlCanEditDept: ctlCanEditDept,
  ctlAlertDays: ctlAlertDays,
  ctlFridgeIcon: ctlFridgeIcon,
  ctlFlags: ctlFlags,
  ctlClassLabel: ctlClassLabel,
  ctlEarliestDays: ctlEarliestDays,
  ctlStatus: ctlStatus,
  ctlPdfReceipts: ctlPdfReceipts,
  ctlSetPdfReceipts: ctlSetPdfReceipts,
  ctlPdfNormalizeCode: ctlPdfNormalizeCode,
  ctlPdfCanUse: ctlPdfCanUse,
  ctlPdfDrag: ctlPdfDrag,
  ctlPdfDrop: ctlPdfDrop,
  ctlPdfClearReview: ctlPdfClearReview,
  ctlPdfFindMedicine: ctlPdfFindMedicine,
  ctlPdfRowsFromItems: ctlPdfRowsFromItems,
  ctlParseReceiptPdf: ctlParseReceiptPdf,
  ctlRenderPdfReview: ctlRenderPdfReview,
  ctlPdfSetField: ctlPdfSetField,
  ctlPdfToggleAll: ctlPdfToggleAll,
  ctlApprovePdfReceipt: ctlApprovePdfReceipt,
  ctlPendingPdfExpiryRows: ctlPendingPdfExpiryRows,
  renderCtlPdfReceiptPanel: renderCtlPdfReceiptPanel,
  ctlSavePendingPdfExpiry: ctlSavePendingPdfExpiry,
  ctlPromptMed: ctlPromptMed,
  ctlAddCatalogMedicine: ctlAddCatalogMedicine,
  ctlFmtDMY: ctlFmtDMY,
  ctlCanDispense: ctlCanDispense,
  ctlEnsureV6UI: ctlEnsureV6UI,
  ctlAddBatchEditorRow: ctlAddBatchEditorRow,
  ctlSaveBatchEditor: ctlSaveBatchEditor,
  ctlOpenDispense: ctlOpenDispense,
  ctlDispTypeChanged: ctlDispTypeChanged,
  ctlLogo: ctlLogo,
  ctlChooseLogo: ctlChooseLogo,
  ctlSavePrintLogo: ctlSavePrintLogo,
  ctlPrintSettings: ctlPrintSettings,
  ctlPublicUrl: ctlPublicUrl,
  ctlPublishDept: ctlPublishDept,
  renderCtlAnalytics: renderCtlAnalytics,
  printCtlAnalytics: printCtlAnalytics,
  ctlDeptShelves: ctlDeptShelves,
  ctlSetDeptShelves: ctlSetDeptShelves,
  ctlDeptShelfName: ctlDeptShelfName,
  ctlToggleDeptMed: ctlToggleDeptMed,
  ctlToggleAllDeptMeds: ctlToggleAllDeptMeds,
  ctlSelectedDeptIds: ctlSelectedDeptIds,
  ctlRefreshDeptBulkBar: ctlRefreshDeptBulkBar,
  ctlOpenBulkShelf: ctlOpenBulkShelf,
  ctlApplyBulkShelf: ctlApplyBulkShelf,
  renderCtlDepartments: renderCtlDepartments,
  ctlEditDeptMedicineFromAggregate: ctlEditDeptMedicineFromAggregate,
  ctlRemoveDeptMedicineFromAggregate: ctlRemoveDeptMedicineFromAggregate,
  requestColdMarker: requestColdMarker,
  actualUser: actualUser,
  actualActorName: actualActorName,
  isMasterActual: isMasterActual,
  isPharmacyDirector: isPharmacyDirector,
  isInpatientSupervisor: isInpatientSupervisor,
  isPharmacyStaff: isPharmacyStaff,
  canManageRequests: canManageRequests,
  canManageCrashCart: canManageCrashCart,
  canConfigureCrashCart: canConfigureCrashCart,
  requireCrashCartConfigurationPermission: requireCrashCartConfigurationPermission,
  canManageUsers: canManageUsers,
  masterRoleLabel: masterRoleLabel,
  ensureMasterRoleModal: ensureMasterRoleModal,
  masterRoleSelectionChanged: masterRoleSelectionChanged,
  masterPreviewRole: masterPreviewRole,
  startApp: startApp,
  bulkSetMedicationFlag: bulkSetMedicationFlag,
  shelfSelectedIds: shelfSelectedIds,
  shelfMedMatches: shelfMedMatches,
  shelfExpiryCell: shelfExpiryCell,
  openAddExpiryForMed: openAddExpiryForMed,
  renderShelfMedicationDatabase: renderShelfMedicationDatabase,
  toggleShelfMedication: toggleShelfMedication,
  toggleAllShelfMedications: toggleAllShelfMedications,
  clearShelfMedicationSelection: clearShelfMedicationSelection,
  assignSelectedMedsToShelf: assignSelectedMedsToShelf,
  crashCarts: crashCarts,
  crashReports: crashReports,
  setCrashReports: setCrashReports,
  crashCart: crashCart,
  ctlSettingsGlobal: ctlSettingsGlobal,
  boot: boot,
  _orderCleanupStarted: globalThis._orderCleanupStarted,
  PPP: globalThis.PPP,
  NOTE_TYPE_LABELS: globalThis.NOTE_TYPE_LABELS,
  NOTE_STATUS_LABELS: globalThis.NOTE_STATUS_LABELS,
  _scanReader: globalThis._scanReader,
  _scanStream: globalThis._scanStream,
  _parsedScan: globalThis._parsedScan,
  _parsedType: globalThis._parsedType,
  DEFAULT_CATS: globalThis.DEFAULT_CATS,
  DAY_NAMES: globalThis.DAY_NAMES,
  CTL_PDF_REVIEW: globalThis.CTL_PDF_REVIEW,
  CTL_BATCH_CTX: globalThis.CTL_BATCH_CTX,
  CTL_DEPT_SELECTED: globalThis.CTL_DEPT_SELECTED,
  MASTER_ACTUAL: globalThis.MASTER_ACTUAL,
  MASTER_EFFECTIVE: globalThis.MASTER_EFFECTIVE,
  SHELF_MED_SELECTED: globalThis.SHELF_MED_SELECTED
};
publishLegacy("07-expiry-requests-and-primary-features.js", __asdhLegacyApi);
export {
  renderShelfAlertSettings,
  openAddExpiry,
  openEditExpiry,
  renderUsers,
  updateUserRoleFields,
  openAddUser,
  saveUser,
  delUser,
  toggleMasterUser,
  renderAn,
  orderRetentionCutoff,
  requestArchiveRecord,
  cleanupOldOrders,
  scheduleAutomaticOrderCleanup,
  setPPP,
  resetPrintPageState,
  renderImport,
  clearImport,
  ensureXLSX,
  handleXlsxDrop,
  handleXlsxFile,
  parseCsvData,
  parseXlsxData,
  recognizeCat,
  parseImport,
  renderImportPreview,
  impEdit,
  impToggleRow,
  impSelectAll,
  confirmImport,
  renderDeptPrint,
  doDeptPrint,
  catAr,
  renderShelves,
  getShelfName,
  openAddShelf,
  openEditShelf,
  printShelfList,
  checkPublicView,
  renderMobileRequest,
  getNotes,
  setNotes,
  noteEsc,
  noteStatus,
  noteType,
  renderDeptNotes,
  renderPharmNotes,
  openNoteReply,
  updateNotesBadge,
  switchExpTab,
  parseBarcode,
  parseExpiryStr,
  formatParsedFields,
  getMedSelectOptions,
  fuzzyMatchMed,
  startScanner,
  switchCamera,
  stopScanner,
  restartScanner,
  captureFrame,
  onScanSuccess,
  applyScanResult,
  parseTypedBarcode,
  applyTypedResult,
  CM,
  getCategories,
  setCategories,
  refreshCatSelectors,
  toggleAllInv,
  onInvCheck,
  clearInvSelection,
  getSelectedMedIds,
  bulkDelete,
  getLogo,
  setLogoData,
  openLogoSettings,
  handleLogoDrop,
  handleLogoFile,
  saveLogo,
  clearLogo,
  officialPrintHeaderHTML,
  getCatOptions,
  getReqWindows,
  setReqWindows,
  getDispSlots,
  setDispSlots,
  getMonthlyLimits,
  setMonthlyLimits,
  fmt12,
  dayBits,
  timeToMins,
  getMonthlyReqCount,
  getMonthlyLimit,
  renderSchedule,
  editReqWindow,
  addDispSlot,
  editDispSlot,
  openBulkLimits,
  applyBulkLimit,
  getNextDispSlot,
  ctlIsMaster,
  ctlCanEditCatalog,
  ctlCanAddCatalog,
  ctlCanEditDept,
  ctlAlertDays,
  ctlFridgeIcon,
  ctlFlags,
  ctlClassLabel,
  ctlEarliestDays,
  ctlStatus,
  ctlPdfReceipts,
  ctlSetPdfReceipts,
  ctlPdfNormalizeCode,
  ctlPdfCanUse,
  ctlPdfDrag,
  ctlPdfDrop,
  ctlPdfClearReview,
  ctlPdfFindMedicine,
  ctlPdfRowsFromItems,
  ctlParseReceiptPdf,
  ctlRenderPdfReview,
  ctlPdfSetField,
  ctlPdfToggleAll,
  ctlApprovePdfReceipt,
  ctlPendingPdfExpiryRows,
  renderCtlPdfReceiptPanel,
  ctlSavePendingPdfExpiry,
  ctlPromptMed,
  ctlAddCatalogMedicine,
  ctlFmtDMY,
  ctlCanDispense,
  ctlEnsureV6UI,
  ctlAddBatchEditorRow,
  ctlSaveBatchEditor,
  ctlOpenDispense,
  ctlDispTypeChanged,
  ctlLogo,
  ctlChooseLogo,
  ctlSavePrintLogo,
  ctlPrintSettings,
  ctlPublicUrl,
  ctlPublishDept,
  renderCtlAnalytics,
  printCtlAnalytics,
  ctlDeptShelves,
  ctlSetDeptShelves,
  ctlDeptShelfName,
  ctlToggleDeptMed,
  ctlToggleAllDeptMeds,
  ctlSelectedDeptIds,
  ctlRefreshDeptBulkBar,
  ctlOpenBulkShelf,
  ctlApplyBulkShelf,
  renderCtlDepartments,
  ctlEditDeptMedicineFromAggregate,
  ctlRemoveDeptMedicineFromAggregate,
  requestColdMarker,
  actualUser,
  actualActorName,
  isMasterActual,
  isPharmacyDirector,
  isInpatientSupervisor,
  isPharmacyStaff,
  canManageRequests,
  canManageCrashCart,
  canConfigureCrashCart,
  requireCrashCartConfigurationPermission,
  canManageUsers,
  masterRoleLabel,
  ensureMasterRoleModal,
  masterRoleSelectionChanged,
  masterPreviewRole,
  startApp,
  bulkSetMedicationFlag,
  shelfSelectedIds,
  shelfMedMatches,
  shelfExpiryCell,
  openAddExpiryForMed,
  renderShelfMedicationDatabase,
  toggleShelfMedication,
  toggleAllShelfMedications,
  clearShelfMedicationSelection,
  assignSelectedMedsToShelf,
  crashCarts,
  crashReports,
  setCrashReports,
  crashCart,
  ctlSettingsGlobal,
  boot
};
function printCtlCustodyReport(){if(!CU||(['controlled_pharmacy','pharmacy'].indexOf(CU.role)<0&&!CU.master))return toast('Not authorized.','err');var rows=ctlMoves().slice(),disp=rows.filter(function(x){return x.type==='dispense'}),total=disp.reduce(function(s,x){return s+ctlNum(x.qty)},0),byDept={};disp.forEach(function(x){var k=x.deptName||x.dept||'Unknown';byDept[k]=(byDept[k]||0)+ctlNum(x.qty)});var deptRows=Object.keys(byDept).sort(function(a,b){return byDept[b]-byDept[a]}).map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+byDept[k]+'</td><td>'+ (total?Math.round(byDept[k]/total*1000)/10:0)+'%</td></tr>'}).join('');ctlPrintHTML('Controlled custody report','<h1>Controlled Medicines Custody Report</h1><h2>تقرير عهدة الأدوية المخدرة والمقيدة</h2><p>Transactions: '+disp.length+' · Total dispensed: '+total+' · Movement records: '+rows.length+'</p><h3>Inpatient department consumption</h3><table><tr><th>Department</th><th>Units</th><th>Share</th></tr>'+deptRows+'</table><h3>Custody and movement log</h3>'+el('ctl-an-table').closest('table').outerHTML)}
function ensureCtlCustodyReportButton(){var host=el('ctl-an-table');if(!host||el('ctl-custody-report-btn'))return;var b=document.createElement('button');b.id='ctl-custody-report-btn';b.className='btn bp bsm';b.type='button';b.textContent='📊 Custody report / تقرير العهدة';b.onclick=printCtlCustodyReport;var h=host.closest('.card')&&host.closest('.card').querySelector('.ch');if(h)h.appendChild(b)}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',function(){setInterval(ensureCtlCustodyReportButton,1500)});
export const legacyVariableNames = Object.freeze(["_orderCleanupStarted", "PPP", "NOTE_TYPE_LABELS", "NOTE_STATUS_LABELS", "_scanReader", "_scanStream", "_parsedScan", "_parsedType", "DEFAULT_CATS", "DAY_NAMES", "CTL_PDF_REVIEW", "CTL_BATCH_CTX", "CTL_DEPT_SELECTED", "MASTER_ACTUAL", "MASTER_EFFECTIVE", "SHELF_MED_SELECTED"]);
export default __asdhLegacyApi;

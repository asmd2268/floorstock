/* ASDHealth pilot protection: free daily IndexedDB backups + System Health. */
(function(){
  var AH_DB='ASDHealthLocalBackups',AH_STORE='daily',AH_MAX=365,AH_TRANSIENT=null;
  /* Automatic/local operational backups intentionally exclude the users collection (PII). */
  var AH_COLLECTIONS=['floorstock_state','public_expiry','public_controlled_expiry'];
  function masterOnly(){
    try{
      if(window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)return true;
      if(typeof window.isMasterActual==='function'&&window.isMasterActual())return true;
      return !!(window.CU&&window.CU.master===true);
    }catch(e){return false}
  }
  function ahOpen(){return new Promise(function(resolve,reject){try{if(!window.indexedDB)return reject(new Error('IndexedDB is unavailable'));var r=indexedDB.open(AH_DB,1);r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains(AH_STORE)){var st=db.createObjectStore(AH_STORE,{keyPath:'id'});st.createIndex('createdAt','createdAt')}};r.onsuccess=function(){resolve(r.result)};r.onerror=function(){reject(r.error||new Error('IndexedDB open failed'))}}catch(e){reject(e)}})}
  function ahReq(req){return new Promise(function(resolve,reject){req.onsuccess=function(){resolve(req.result)};req.onerror=function(){reject(req.error)}})}
  function enc(v){if(v===null||v===undefined||typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;if(v instanceof Date)return{__pharm_type:'date',value:v.toISOString()};if(v&&typeof v.toDate==='function'&&typeof v.seconds==='number')return{__pharm_type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds||0};if(Array.isArray(v))return v.map(enc);if(typeof v==='object'){var o={};Object.keys(v).forEach(function(k){o[k]=enc(v[k])});return o}return null}
  async function readCol(name){var snap=await FB_DB.collection(name).get();return snap.docs.map(function(d){return{id:d.id,data:enc(d.data())}})}
  async function payload(){var cols={};for(var i=0;i<AH_COLLECTIONS.length;i++)cols[AH_COLLECTIONS[i]]=await readCol(AH_COLLECTIONS[i]);return{format:'ASDHealth-Firestore-Backup',product:'ASDHealth',module:'Pharmacy Operations',version:2,projectId:(window.FIREBASE_CONFIG&&FIREBASE_CONFIG.projectId)||'',exportedAt:new Date().toISOString(),collections:cols}}
  function sizeLabel(n){if(!n&&n!==0)return'—';if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(2)+' MB'}
  function ahClose(db){try{if(db)db.close()}catch(ignore){}}
  async function allBackups(){try{var db=await ahOpen(),a;try{a=await ahReq(db.transaction(AH_STORE,'readonly').objectStore(AH_STORE).getAll())}finally{ahClose(db)}return(a||[]).sort(function(x,y){return String(y.createdAt).localeCompare(String(x.createdAt))})}catch(e){return AH_TRANSIENT?[AH_TRANSIENT]:[]}}
  function ahWriteAndPrune(db,rec){return new Promise(function(resolve,reject){var tx,st,getAll;try{tx=db.transaction(AH_STORE,'readwrite');st=tx.objectStore(AH_STORE);st.put(rec);getAll=st.getAll()}catch(error){reject(error);return}getAll.onsuccess=function(){var all=(getAll.result||[]).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt))});for(var i=AH_MAX;i<all.length;i++)st.delete(all[i].id)};getAll.onerror=function(){try{tx.abort()}catch(ignore){}reject(getAll.error||new Error('IndexedDB backup listing failed'))};tx.oncomplete=function(){resolve(rec)};tx.onabort=tx.onerror=function(){reject(tx.error||new Error('IndexedDB backup transaction failed'))}})}
  async function saveBackup(obj){var txt=JSON.stringify(obj),rec={id:String(obj.exportedAt).slice(0,10),createdAt:obj.exportedAt,size:txt.length,payload:obj};AH_TRANSIENT=rec;var db=await ahOpen();try{return await ahWriteAndPrune(db,rec)}finally{ahClose(db)}}
  async function releaseOldestQuarter(){var db=await ahOpen();try{return await new Promise(function(resolve,reject){var tx=db.transaction(AH_STORE,'readwrite'),st=tx.objectStore(AH_STORE),r=st.getAll();r.onsuccess=function(){var all=(r.result||[]).sort(function(a,b){return String(a.createdAt).localeCompare(String(b.createdAt))}),remove=Math.max(1,Math.ceil(all.length/4));for(var i=0;i<remove&&i<all.length;i++)st.delete(all[i].id)};r.onerror=function(){reject(r.error||new Error('IndexedDB cleanup failed'))};tx.oncomplete=function(){resolve(true)};tx.onabort=tx.onerror=function(){reject(tx.error||new Error('IndexedDB cleanup transaction failed'))}})}finally{ahClose(db)}}
  async function saveWithQuota(obj){try{return await saveBackup(obj)}catch(e){if(e&&(/quota/i.test(e.name||'')||/quota/i.test(e.message||''))){await releaseOldestQuarter();return await saveBackup(obj)}throw e}}
  window.masterCreateLocalBackup=async function(manual){
    if(!masterOnly()||!window.FB_DB){if(manual&&window.toast)toast('Master permission required','err');return null}
    var msg=document.getElementById('auto-backup-message');
    if(msg)msg.textContent='Creating protected local snapshot…';
    try{
      var p=await payload(),r;AH_TRANSIENT={id:String(p.exportedAt).slice(0,10),createdAt:p.exportedAt,size:JSON.stringify(p).length,payload:p};
      try{r=await saveWithQuota(p)}catch(storageError){console.warn('Backup generated but could not be persisted in IndexedDB; device download remains available.',storageError);r=AH_TRANSIENT}
      try{localStorage.setItem('abhealth_last_auto_backup',r.createdAt)}catch(storageMetaError){console.warn('Backup was created, but its local status marker could not be saved.',storageMetaError)}
      if(msg)msg.textContent='Local backup saved: '+new Date(r.createdAt).toLocaleString();
      if(manual&&window.toast)toast('Local backup saved ✓','succ');
      await window.masterRefreshSystemHealth();
      return r;
    }catch(e){
      console.error(e);
      if(msg)msg.textContent='Local backup failed: '+(e.message||e);
      if(manual&&window.toast)toast('Local backup failed','err');
      return null;
    }
  };
  window.masterDownloadLatestLocalBackup=async function(){
    if(!masterOnly()){if(window.toast)toast('Master permission required','err');return false}
    var a=await allBackups(),latest=AH_TRANSIENT&&(!a.length||String(AH_TRANSIENT.createdAt)>String(a[0].createdAt))?AH_TRANSIENT:a[0];
    if(!latest){if(window.toast)toast('No local backup is available yet.','info');return false}
    var obj=latest.payload,blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),x=document.createElement('a');
    x.href=url;x.download='ASDHealth_Pharmacy_Backup_'+String(obj.exportedAt).replace(/[:.]/g,'-')+'.json';document.body.appendChild(x);x.click();x.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
    return true;
  };
  window.masterSaveLocalBackupToDevice=async function(){
    if(!masterOnly()){if(window.toast)toast('Master permission required','err');return}
    var btn=document.getElementById('master-local-device-backup-btn');
    if(btn)btn.disabled=true;
    try{
      var saved=await window.masterCreateLocalBackup(true);
      if(!saved)return;
      var downloaded=await window.masterDownloadLatestLocalBackup();
      if(downloaded&&window.toast)toast('Local backup saved to this device ✓','succ');
    }finally{if(btn)btn.disabled=false}
  };
  window.masterRefreshSystemHealth=async function(){if(!masterOnly())return;try{var depts=typeof gd==='function'?gd():[],users=typeof gu==='function'?gu():[],reqs=typeof gr==='function'?gr():[],meds=0;depts.forEach(function(d){try{meds+=(getMeds(d.id)||[]).length}catch(e){}});var carts=typeof crashCarts==='function'?crashCarts():[],reports=typeof crashReports==='function'?crashReports():[],ctl=typeof ctlCatalog==='function'?ctlCatalog():[],a=await allBackups(),last=a[0]||null;var vals={"health-depts":depts.length,"health-users":users.length,"health-meds":meds,"health-requests":reqs.length,"health-carts":carts.length,"health-controlled":ctl.length,"health-cart-pending":reports.filter(function(r){return r.status==='pending'}).length,"health-backup-count":a.length};Object.keys(vals).forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=vals[id]});var e=document.getElementById('health-last-backup');if(e)e.textContent=last?new Date(last.createdAt).toLocaleString():'No local backup yet';e=document.getElementById('health-backup-size');if(e)e.textContent=last?sizeLabel(last.size):'—';e=document.getElementById('health-last-restore');if(e)e.textContent=localStorage.getItem('abhealth_last_restore')||'Never recorded';e=document.getElementById('auto-backup-state');if(e){e.textContent=last?'Protected':'Not backed up';e.className='badge '+(last?'bgn':'byl')}}catch(err){console.error(err)}};
  async function daily(){if(!masterOnly()||!window.FB_DB)return;var today=new Date().toISOString().slice(0,10),last=String(localStorage.getItem('abhealth_last_auto_backup')||'').slice(0,10);if(last!==today)await window.masterCreateLocalBackup(false);else await window.masterRefreshSystemHealth()}
  window.runDailyBackup=function(){return daily().catch(function(){})};
  window.refreshBackupRestorePage=function(){daily().catch(function(){});Promise.resolve(window.masterRefreshSystemHealth()).catch(function(){})};
})();

// --- Merged from 17-system-health-script.js (Phase 6 consolidation) ---
(function(){
'use strict';
function isMasterHealthLocal(){return typeof window.isMaster==='function'?window.isMaster():!!(window.CU&&CU.master===true&&!window.MASTER_EFFECTIVE)}
function setStatus(id,text,cls){var el=document.getElementById(id);if(!el)return;el.textContent=text;el.className='health-value '+(cls||'')}
window.runSystemHealthDiagnostics=async function(){
  if(!isMasterHealthLocal()){if(window.toast)toast('Master access only','err');return}
  var lines=[],start=performance.now(),online=navigator.onLine;
  setStatus('health-network',online?'Online':'Offline',online?'health-ok':'health-bad');lines.push((online?'✓':'✗')+' Network: '+(online?'online':'offline'));
  var hasFirebase=!!window.firebase;setStatus('health-firebase',hasFirebase?'Loaded':'Unavailable',hasFirebase?'health-ok':'health-bad');lines.push((hasFirebase?'✓':'✗')+' Firebase SDK: '+(hasFirebase?'loaded':'not loaded'));
  var authOk=false,userLabel='No signed-in user';try{var auth=window.auth||(hasFirebase&&firebase.auth?firebase.auth():null),u=auth&&auth.currentUser;authOk=!!u;userLabel=u?(u.email||u.uid||'Signed in'):'No signed-in user'}catch(e){userLabel='Auth error'}
  setStatus('health-auth',userLabel,authOk?'health-ok':'health-warn');lines.push((authOk?'✓':'!')+' Authentication: '+userLabel);
  var dbObj=window.db||null,fireOk=false,fireMsg='Not initialized';try{if(dbObj&&typeof dbObj.collection==='function'){var t0=performance.now();await dbObj.collection('departments').limit(1).get();fireOk=true;fireMsg=Math.round(performance.now()-t0)+' ms'}}catch(e){fireMsg=(e&&e.message)?e.message:'Read failed'}
  setStatus('health-firestore',fireMsg,fireOk?'health-ok':'health-bad');lines.push((fireOk?'✓':'✗')+' Firestore read: '+fireMsg);
  function count(name){try{return Array.isArray(window[name])?window[name].length:'—'}catch(e){return '—'}}
  lines.push('','Departments: '+count('DEPTS'),'Requests: '+count('REQS'),'Crash carts: '+count('CRASH_CARTS'),'Controlled medicines: '+count('CONTROLLED_MEDS'),'','Browser: '+navigator.userAgent,'Completed in '+Math.round(performance.now()-start)+' ms');
  var report=document.getElementById('health-report');if(report)report.textContent=lines.join('\n');var last=document.getElementById('health-last-run');if(last)last.textContent='Last run: '+new Date().toLocaleString('en-GB',{calendar:'gregory'});
};
function initial(){setStatus('health-network',navigator.onLine?'Online':'Offline',navigator.onLine?'health-ok':'health-bad')}
initial();window.addEventListener('online',initial);window.addEventListener('offline',initial);
})();


// --- Merged from 11-master-backup-restore-access.js (Phase 6 consolidation) ---
/* Final warehouse access guard + master-only Firestore backup/restore. */
(function(){
  /* User profiles contain PII and are intentionally excluded from downloadable JSON backups. */
  var BACKUP_COLLECTIONS=['floorstock_state','public_expiry','public_controlled_expiry'];
  var pendingBackup=null;

  function isMasterBackupLocal(){
    try{
      if(window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)return true;
      if(typeof window.isMasterActual==='function'&&window.isMasterActual())return true;
      if(typeof window.isMaster==='function'&&window.isMaster())return true;
      return !!(window.CU&&window.CU.master===true);
    }catch(e){return false}
  }
  function requireMaster(){if(!isMasterBackupLocal()){toast('Master permission required','err');return false}return true}

  /* Warehouse must never see or open inpatient department lists. */
      /* Add the backup page to Master navigation only. */
function encodeValue(v){
    if(v===null||v===undefined||typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;
    if(v instanceof Date)return {__pharm_type:'date',value:v.toISOString()};
    if(v&&typeof v.toDate==='function'&&typeof v.seconds==='number')return {__pharm_type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds||0};
    if(Array.isArray(v))return v.map(encodeValue);
    if(typeof v==='object'){var o={};Object.keys(v).forEach(function(k){o[k]=encodeValue(v[k])});return o}
    return null;
  }
  function decodeValue(v){
    if(v===null||v===undefined||typeof v!=='object')return v;
    if(v.__pharm_type==='date')return new Date(v.value);
    if(v.__pharm_type==='timestamp'&&window.firebase&&firebase.firestore&&firebase.firestore.Timestamp)return new firebase.firestore.Timestamp(v.seconds||0,v.nanoseconds||0);
    if(Array.isArray(v))return v.map(decodeValue);
    var o={};Object.keys(v).forEach(function(k){o[k]=decodeValue(v[k])});return o;
  }
  async function readCollection(name){
    var snap=await FB_DB.collection(name).get();
    return snap.docs.map(function(d){return {id:d.id,data:encodeValue(d.data())}});
  }
  function downloadJSON(obj,name){
    var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
  }
  window.masterExportDatabase=async function(){
    if(!requireMaster()||!FB_DB)return;
    var btn=document.getElementById('db-export-btn'),status=document.getElementById('db-export-status');
    btn.disabled=true;status.textContent='Reading Firestore data…';
    try{
      var collections={};
      for(var i=0;i<BACKUP_COLLECTIONS.length;i++){status.textContent='Exporting '+BACKUP_COLLECTIONS[i]+'…';collections[BACKUP_COLLECTIONS[i]]=await readCollection(BACKUP_COLLECTIONS[i])}
      var payload={format:'ASDHealth-Firestore-Backup',version:1,projectId:(FIREBASE_CONFIG&&FIREBASE_CONFIG.projectId)||'',exportedAt:new Date().toISOString(),collections:collections};
      var stamp=new Date().toISOString().replace(/[:.]/g,'-');downloadJSON(payload,'ASDHealth_Pharmacy_Backup_'+stamp+'.json');
      status.textContent='Backup downloaded successfully ✓';toast('Database backup downloaded ✓','succ');
    }catch(e){console.error(e);status.textContent='Export failed: '+(e.message||e);toast('Backup export failed','err')}finally{btn.disabled=false}
  };
  window.masterPreviewBackupFile=async function(file){
    pendingBackup=null;var p=document.getElementById('db-restore-preview'),b=document.getElementById('db-restore-btn'),st=document.getElementById('db-restore-status');
    b.disabled=true;p.style.display='none';st.textContent='';if(!file)return;
    try{var obj=JSON.parse(await file.text());if(!obj||obj.format!=='ASDHealth-Firestore-Backup'||!obj.collections)throw new Error('This is not a valid ASDHealth backup file');
      var counts=Object.keys(obj.collections).map(function(k){return k+': '+((obj.collections[k]||[]).length)}).join(' · ');pendingBackup=obj;p.innerHTML='<b>Backup ready:</b> '+esc(obj.exportedAt||'Unknown date')+'<br>'+esc(counts);p.style.display='block';b.disabled=false;
    }catch(e){p.innerHTML='<b>Invalid backup:</b> '+esc(e.message||String(e));p.style.display='block';p.className='alert-banner';}
  };
  async function commitOps(ops){
    for(var i=0;i<ops.length;i+=450){var batch=FB_DB.batch(),part=ops.slice(i,i+450);part.forEach(function(op){if(op.kind==='delete')batch.delete(op.ref);else batch.set(op.ref,op.data)});await batch.commit()}
  }
  window.masterRestoreDatabase=async function(){
    localStorage.setItem('abhealth_last_restore',new Date().toLocaleString());
    if(!requireMaster()||!pendingBackup||!FB_DB)return;
    if(!await uiConfirm('Restore this backup and replace the current ASDHealth Firestore data? This cannot be undone unless you export a backup first.'))return;
    var btn=document.getElementById('db-restore-btn'),status=document.getElementById('db-restore-status');btn.disabled=true;status.textContent='Preparing restore…';
    try{
      if(S&&S.stopRealtime)S.stopRealtime();
      var names=BACKUP_COLLECTIONS.slice();Object.keys(pendingBackup.collections||{}).forEach(function(n){if(!names.includes(n))names.push(n)});
      for(var i=0;i<names.length;i++){
        var name=names[i],incoming=pendingBackup.collections[name]||[];status.textContent='Replacing '+name+'…';
        var existing=await FB_DB.collection(name).get(),ops=[];existing.docs.forEach(function(d){ops.push({kind:'delete',ref:d.ref})});await commitOps(ops);
        ops=incoming.map(function(row){return {kind:'set',ref:FB_DB.collection(name).doc(row.id),data:decodeValue(row.data)}});await commitOps(ops);
      }
      status.textContent='Restore completed. Reloading…';toast('Database restored successfully ✓','succ');setTimeout(function(){location.reload()},900);
    }catch(e){console.error(e);status.textContent='Restore failed: '+(e.message||e);toast('Database restore failed','err');try{await S.init();if(typeof window.repairImportedDepartmentAliases==='function')await window.repairImportedDepartmentAliases()}catch(_){}btn.disabled=false}
  };
})();


// --- Merged from 39-final-role-routing-system-health.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var ROLE_CLASSES=['role-pharmacy','role-inpatient_supervisor','role-outpatient_pharmacy_supervisor','role-pharmacy_staff','role-controlled_pharmacy','role-warehouse','role-department'];
  var RESTRICTED={
    controlled_pharmacy:[
      ['pg-controlled','🔒 Controlled & psychotropic medicines'],
      ['pg-announcements','📢 Announcements / الإعلانات']
    ],
    warehouse:[
      ['pg-controlled','🔒 Warehouse controlled custody']
    ]
  };
  var RENDERERS={'pg-controlled':'renderControlled','pg-ctl-analytics':'renderCtlAnalytics','pg-announcements':'renderAnnouncements'};
  function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
  function realMaster(){
    try{
      if(window.MASTER_ACTUAL&&window.MASTER_ACTUAL.master===true)return true;
      if(typeof window.isMasterActual==='function'&&window.isMasterActual())return true;
      return !!(window.CU&&window.CU.master===true);
    }catch(e){return false}
  }
  function fallbackFor(r){return (r==='controlled_pharmacy'||r==='warehouse')?'pg-controlled':(r==='department'?'pg-newreq':'pg-dash')}
  function specFor(r){return RESTRICTED[r]||null}
  function restrictedPages(r){return (specFor(r)||[]).map(function(x){return x[0]})}
  function setRoleClass(){ROLE_CLASSES.forEach(function(c){document.body.classList.remove(c)});if(role())document.body.classList.add('role-'+role());document.body.classList.toggle('real-master-ui',realMaster())}
  function makeButton(spec){var b=document.createElement('button');b.type='button';b.className='nb';b.dataset.pg=spec[0];b.innerHTML=spec[1];b.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}window.showPg(spec[0])};return b}
  function rebuildRestrictedNav(){var spec=specFor(role()),nav=document.getElementById('mnav');if(!spec||!nav)return false;nav.innerHTML='';spec.forEach(function(x){nav.appendChild(makeButton(x))});return true}
  function removeMasterOnlyForNonMaster(){
    if(realMaster())return;
    ['#nb-system-health','[data-pg="pg-system-health"]','[data-pg="pg-backup-restore"]','#zebra-labels-nav','[data-pg="pg-zebra-labels"]'].forEach(function(sel){document.querySelectorAll(sel).forEach(function(n){n.remove()})});
    ['pg-system-health','pg-backup-restore','pg-zebra-labels'].forEach(function(id){var p=document.getElementById(id);if(p){p.classList.remove('on');p.style.display='none'}})
  }
  function ensureMasterHealth(){
    var nav=document.getElementById('mnav');if(!nav)return;var old=nav.querySelector('#nb-system-health,[data-pg="pg-system-health"]');
    if(!realMaster()){if(old)old.remove();return}
    if(!old){old=document.createElement('button');old.id='nb-system-health';old.type='button';old.className='nb';old.textContent='🩺 System Health';nav.appendChild(old)}
    old.dataset.pg='pg-system-health';old.onclick=function(){window.showPg('pg-system-health')}
  }
  function syncActiveNav(){var active=(document.querySelector('.pg.on')||{}).id||'';document.querySelectorAll('#mnav .nb').forEach(function(b){b.classList.toggle('on',!!(b.dataset&&b.dataset.pg===active))})}
  function activatePage(id,runRenderer){
    var p=document.getElementById(id);if(!p)return false;
    document.querySelectorAll('.pg').forEach(function(x){x.classList.remove('on');x.style.display='none'});p.style.removeProperty('display');p.classList.add('on');syncActiveNav();
    if(runRenderer!==false){var fn=window[RENDERERS[id]];if(typeof fn==='function'){try{fn()}catch(err){console.error('Role page render failed:',id,err);if(window.toast)toast('Unable to load this page.','err')}}if(id==='pg-announcements'&&typeof window.renderDepartmentAnnouncements==='function'){try{window.renderDepartmentAnnouncements()}catch(err){console.error(err)}}}
    return true
  }
  function strictRestrictedShow(id){var allowed=restrictedPages(role());if(allowed.indexOf(id)<0)id=fallbackFor(role());activatePage(id,true);rebuildRestrictedNav();syncActiveNav();removeMasterOnlyForNonMaster()}
  function enforce(){setRoleClass();var restricted=rebuildRestrictedNav();removeMasterOnlyForNonMaster();if(!restricted)ensureMasterHealth();var allowed=restrictedPages(role()),active=document.querySelector('.pg.on');if(allowed.length&&(!active||allowed.indexOf(active.id)<0))activatePage(fallbackFor(role()),true);syncActiveNav()}
  var EXTRA_ALLOWED={'controlled_pharmacy':['pg-ctl-analytics'],'warehouse':['pg-ctl-analytics']};
  function allowedTarget(id){if((id==='pg-system-health'||id==='pg-backup-restore'||id==='pg-zebra-labels')&&!realMaster())return fallbackFor(role());var allowed=restrictedPages(role());var extra=(EXTRA_ALLOWED[role()]||[]);if(allowed.length&&allowed.indexOf(id)<0&&extra.indexOf(id)<0)return fallbackFor(role());return id}

  window.resolveAllowedPageTarget=allowedTarget;
  window.handleRestrictedPage=function(id){if(specFor(role())){strictRestrictedShow(id);return true}if(id==='pg-system-health'&&realMaster()){activatePage(id,false);return true}return false};
  window.enforceRoleUi=enforce;
  enforce();
})();

// --- Merged from 26-department-rename-repair.js (Phase 6 consolidation) ---
/* Department rename repair: the Users page button existed but renameDept was missing. */
(function(){
  window.renameDept=async function(deptId,currentName){
    try{
      if(!CU || (CU.role!=='pharmacy' && CU.master!==true)){
        return toast('Only the Pharmacy Manager may rename departments.','err');
      }
      var departments=gd();
      var dept=departments.find(function(d){return String(d.id)===String(deptId);});
      if(!dept)return toast('Department not found. Refresh the page and try again.','err');
      var entered=await uiPrompt(
        'Enter the new department name / أدخل اسم القسم الجديد',
        dept.name||currentName||'',
        {title:'Rename Department / تعديل اسم القسم',okText:'Save / حفظ',cancelText:'Cancel / إلغاء'}
      );
      if(entered===null || entered===undefined)return;
      var newName=String(entered).trim().replace(/\s+/g,' ');
      if(!newName)return toast('Department name cannot be empty.','err');
      if(newName===dept.name)return toast('No changes were made.','info');
      var duplicate=departments.some(function(d){
        return String(d.id)!==String(deptId) && String(d.name||'').trim().toLowerCase()===newName.toLowerCase();
      });
      if(duplicate)return toast('A department with this name already exists.','err');

      var updated=departments.map(function(d){
        return String(d.id)===String(deptId)?Object.assign({},d,{name:newName,updated:nowISO()}):d;
      });
      await S.s('departments',updated);

      /* IDs stay unchanged, so users, medicines, requests, expiry data,
         announcements, and department-specific settings remain linked. */
      renderUsers();
      if(typeof fillDS==='function')fillDS();
      if(typeof populateInvDeptSel==='function')populateInvDeptSel();
      if(typeof refreshCurrentPage==='function')refreshCurrentPage();
      toast('Department renamed successfully ✓','succ');
    }catch(err){
      console.error('renameDept failed:',err);
      toast((err&&err.message)||'Could not rename the department.','err');
    }
  };
})();


// --- Merged from 19-test-data-cleanup-guard.js (Phase 6 consolidation) ---
(function(){
  function hasTestWord(v){return /(^|[^a-z0-9])test([^a-z0-9]|$)/i.test(String(v||''));}
  function masterAllowed(){try{return typeof isMasterActual==='function'&&isMasterActual();}catch(e){return !!(window.CU&&CU.master===true);}}
  function relatedToIds(v,ids){
    if(v==null)return false;
    if(typeof v==='string')return ids.has(v);
    if(Array.isArray(v))return v.some(function(x){return relatedToIds(x,ids)});
    if(typeof v==='object')return Object.keys(v).some(function(k){return relatedToIds(v[k],ids)});
    return false;
  }
  function namedTest(o){
    if(!o||typeof o!=='object')return false;
    return ['name','title','label','displayName','description','note','username'].some(function(k){return hasTestWord(o[k]);});
  }
  function collectTestIds(v,ids){
    if(!v)return;
    if(Array.isArray(v)){v.forEach(function(x){collectTestIds(x,ids)});return;}
    if(typeof v==='object'){
      if(namedTest(v)&&v.id)ids.add(String(v.id));
      Object.keys(v).forEach(function(k){collectTestIds(v[k],ids)});
    }
  }
  function cleanValue(v,ids,key){
    if(Array.isArray(v)){
      return v.filter(function(x){
        if(x&&typeof x==='object'){
          if(namedTest(x))return false;
          if(x.id&&ids.has(String(x.id)))return false;
          if(key==='audit_log'&&(relatedToIds(x,ids)||hasTestWord(JSON.stringify(x))))return false;
          if(relatedToIds(x,ids))return false;
        }
        return true;
      }).map(function(x){return cleanValue(x,ids,key)});
    }
    if(v&&typeof v==='object'){
      var out={};Object.keys(v).forEach(function(k){
        var x=v[k];
        if(x&&typeof x==='object'&&namedTest(x))return;
        if(ids.has(String(k)))return;
        out[k]=cleanValue(x,ids,key);
      });return out;
    }
    return v;
  }
  async function deletePublicCrashDoc(id){
    if(window.FB_DB){var collection=window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry');await collection.doc('crash_'+String(id)).delete();}
    return true
  }
  window.masterPurgeAllTestData=async function(){
    if(!masterAllowed())return toast('Master permission required.','err');
    if(!(await uiConfirm('Permanently delete every record whose name contains the standalone word TEST, including linked records and audit traces? This cannot be undone.')))return;
    var ids=new Set();Object.keys(S.cache||{}).forEach(function(k){collectTestIds(S.cache[k],ids)});
    var testCrashIds=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return namedTest(c)}).map(function(c){return String(c.id)});testCrashIds.forEach(function(x){ids.add(x)});
    var changed=0,operations=[];
    Object.keys(S.cache||{}).forEach(function(k){
      if(k==='users')return;
      var old=S.cache[k],clean=cleanValue(old,ids,k);
      try{if(JSON.stringify(old)!==JSON.stringify(clean)){changed++;operations.push({label:k,promise:S.s(k,clean)})}}catch(e){console.warn('TEST cleanup comparison failed for '+k,e)}
    });
    testCrashIds.forEach(function(id){operations.push({label:'public crash '+id,promise:deletePublicCrashDoc(id)})});
    var results=await Promise.allSettled(operations.map(function(x){return x.promise})),failed=[];
    results.forEach(function(r,i){if(r.status==='rejected'){failed.push(operations[i].label);console.error('TEST cleanup failed for '+operations[i].label,r.reason)}});
    if(typeof refreshCurrentPage==='function')refreshCurrentPage();
    if(failed.length){toast('TEST cleanup completed partially. '+failed.length+' area(s) could not be deleted; review the console and retry.','err');return false}
    toast('TEST data purged completely from '+changed+' data area(s).','succ');return true
  };
  function addMasterCleanupButton(){
    var host=document.getElementById('tuser')&&document.getElementById('tuser').parentElement;
    var old=document.getElementById('master-test-clean-btn');if(old)old.remove();
    if(!host||!masterAllowed())return;
    var b=document.createElement('button');b.id='master-test-clean-btn';b.className='btn bg bsm master-test-clean-btn';b.textContent='Delete TEST data';b.title='Permanently remove records named TEST and all linked traces';b.onclick=masterPurgeAllTestData;
    host.insertBefore(b,document.getElementById('themeBtn'));
  }
  window.addMasterCleanupButton=addMasterCleanupButton;
  })();

export {};

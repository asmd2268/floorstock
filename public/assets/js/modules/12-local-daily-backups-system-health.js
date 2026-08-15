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

export {};

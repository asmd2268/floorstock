/* ASDHealth R6.65 Modular
 * Original script position: 15
 * Original id: (none)
 * Compatibility mode: classic script, original execution order preserved.
 */
/* ASDHealth pilot protection: free daily IndexedDB backups + System Health. */
(function(){
  var AH_DB='ASDHealthLocalBackups',AH_STORE='daily',AH_MAX=365;
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
  async function allBackups(){try{var db=await ahOpen();var tx=db.transaction(AH_STORE,'readonly');var a=await ahReq(tx.objectStore(AH_STORE).getAll());db.close();return(a||[]).sort(function(x,y){return String(y.createdAt).localeCompare(String(x.createdAt))})}catch(e){return []}}
  async function saveBackup(obj){var txt=JSON.stringify(obj),rec={id:String(obj.exportedAt).slice(0,10),createdAt:obj.exportedAt,size:txt.length,payload:obj};var db=await ahOpen();var tx=db.transaction(AH_STORE,'readwrite'),st=tx.objectStore(AH_STORE);await ahReq(st.put(rec));var all=await ahReq(st.getAll());all.sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt))});for(var i=AH_MAX;i<all.length;i++)await ahReq(st.delete(all[i].id));db.close();return rec}
  async function saveWithQuota(obj){try{return await saveBackup(obj)}catch(e){if(e&&(/quota/i.test(e.name||'')||/quota/i.test(e.message||''))){var db=await ahOpen(),tx=db.transaction(AH_STORE,'readwrite'),st=tx.objectStore(AH_STORE),all=await ahReq(st.getAll());all.sort(function(a,b){return String(a.createdAt).localeCompare(String(b.createdAt))});for(var i=0;i<Math.max(1,Math.ceil(all.length/4));i++)await ahReq(st.delete(all[i].id));db.close();return await saveBackup(obj)}throw e}}
  window.masterCreateLocalBackup=async function(manual){
    if(!masterOnly()||!window.FB_DB){if(manual&&window.toast)toast('Master permission required','err');return null}
    var msg=document.getElementById('auto-backup-message');
    if(msg)msg.textContent='Creating protected local snapshot…';
    try{
      var p=await payload(),r=await saveWithQuota(p);
      localStorage.setItem('abhealth_last_auto_backup',r.createdAt);
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
    var a=await allBackups();
    if(!a.length){if(window.toast)toast('No local backup is available yet.','info');return false}
    var obj=a[0].payload,blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),x=document.createElement('a');
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

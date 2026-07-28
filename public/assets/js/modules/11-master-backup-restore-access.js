/* ASDHealth R6.65 Modular
 * Original script position: 14
 * Original id: (none)
 * Compatibility mode: classic script, original execution order preserved.
 */
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

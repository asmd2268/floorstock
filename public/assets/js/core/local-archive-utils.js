/* Shared helpers for "archive old log data locally before deleting it from
   Firestore" flows (orders, controlled/narcotic movements, accountability
   history, ...). Each domain keeps its own aggregation/grouping logic —
   only the mechanical parts (file download, a second local IndexedDB copy,
   optional Excel export) live here. */

function downloadJsonFile(obj,name){
  var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url)},1000);
}

// Excel export reuses the SAME XLSX library already loaded elsewhere in the
// app for inventory import (window.ensureXLSX/window.XLSX) rather than
// pulling in a second copy — falls back to a plain error if unavailable
// rather than blocking the (already-completed) JSON download.
async function downloadExcelFile(rows,columns,name){
  if(typeof window.ensureXLSX!=='function')throw new Error('Excel export library is unavailable.');
  await window.ensureXLSX();
  if(typeof XLSX==='undefined')throw new Error('Excel export library failed to load.');
  var header=columns.map(function(c){return c.label});
  var body=rows.map(function(row){return columns.map(function(c){return c.value(row)})});
  var ws=XLSX.utils.aoa_to_sheet([header].concat(body));
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Archive');
  XLSX.writeFile(wb,name);
}

// One shared IndexedDB database, one object store per archive "domain"
// (orders / controlled-moves / accountability / ...) so each domain's
// history browses and prunes independently without stepping on another's
// keys. Best-effort only — the downloaded file is the real safety net.
var LOCAL_ARCHIVE_DB='ASDHealth_LocalArchives';
function localArchiveDbOpen(store){
  return new Promise(function(resolve,reject){
    if(!window.indexedDB)return reject(new Error('IndexedDB is unavailable'));
    var req=indexedDB.open(LOCAL_ARCHIVE_DB,2);
    req.onupgradeneeded=function(){
      var db=req.result;
      ['orders','controlled_moves','accountability'].forEach(function(name){
        if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
      });
    };
    req.onsuccess=function(){resolve(req.result)};
    req.onerror=function(){reject(req.error||new Error('IndexedDB open failed'))};
  });
}
async function localArchiveDbSave(store,record){
  try{
    var db=await localArchiveDbOpen(store);
    try{
      await new Promise(function(resolve,reject){
        var tx=db.transaction(store,'readwrite');
        tx.objectStore(store).put(record);
        tx.oncomplete=function(){resolve()};
        tx.onabort=tx.onerror=function(){reject(tx.error||new Error('IndexedDB write failed'))};
      });
    }finally{db.close()}
  }catch(indexedDbError){
    console.warn('Local archive copy could not be saved to IndexedDB (the downloaded file remains the real copy).',indexedDbError);
  }
}
async function localArchiveDbList(store){
  try{
    var db=await localArchiveDbOpen(store);
    try{
      return await new Promise(function(resolve,reject){
        var req=db.transaction(store,'readonly').objectStore(store).getAll();
        req.onsuccess=function(){resolve(req.result||[])};
        req.onerror=function(){reject(req.error||new Error('IndexedDB read failed'))};
      });
    }finally{db.close()}
  }catch(indexedDbError){
    console.warn('Local archive listing unavailable.',indexedDbError);
    return [];
  }
}

Object.assign(globalThis,{downloadJsonFile,downloadExcelFile,localArchiveDbSave,localArchiveDbList});
export {downloadJsonFile,downloadExcelFile,localArchiveDbSave,localArchiveDbList};

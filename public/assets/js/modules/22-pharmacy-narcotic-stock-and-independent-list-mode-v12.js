/* ASDHealth R6.65 Modular
 * Original script position: 25
 * Original id: pharmacy-narcotic-stock-and-independent-list-mode-v12
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
  'use strict';
  var _narcoticSeedDone=false,_narcoticSeedBusy=false;
  function norm(v){return String(v==null?'':v).trim().replace(/\.0+$/,'');}

  async function ensureNarcoticSharedList(){
    if(_narcoticSeedDone||_narcoticSeedBusy)return false;
    _narcoticSeedBusy=true;
    try{
      var catalog=typeof ctlCatalog==='function'?(ctlCatalog()||[]).map(function(m){return Object.assign({},m)}):[];
      var pharmacy=typeof ctlPharmacy==='function'?Object.assign({},ctlPharmacy()||{}):{};
      var changedCatalog=false,changedStock=false;
      [].forEach(function(src){
        var srcName=norm(src.name).toLowerCase();
        var med=catalog.find(function(m){
          return (src.nupco&&norm(m.nupco)===norm(src.nupco))
            ||(src.moh&&norm(m.moh)===norm(src.moh))
            ||(srcName&&norm(m.name).toLowerCase()===srcName);
        });
        if(!med){
          var id=typeof ctlKey==='function'?ctlKey(src.moh,src.nupco,src.name):('cm_'+(src.moh||src.nupco||Date.now()));
          med={id:id,moh:src.moh||'',nupco:src.nupco||'',name:src.name||'',classification:'narcotic',min:0,max:0};
          catalog.push(med);changedCatalog=true;
        }else{
          if(!med.moh&&src.moh){med.moh=src.moh;changedCatalog=true;}
          if(!med.nupco&&src.nupco){med.nupco=src.nupco;changedCatalog=true;}
          if(!med.name&&src.name){med.name=src.name;changedCatalog=true;}
          if(String(med.classification||'')!=='narcotic'){med.classification='narcotic';changedCatalog=true;}
        }
        /* Repair missing rows only. Existing edited quantities and batches are never overwritten. */
        if(!Object.prototype.hasOwnProperty.call(pharmacy,med.id)){
          pharmacy[med.id]={
            qty:Number(src.qty)||0,
            actualQty:Number(src.qty)||0,
            batches:(src.batches||[]).map(function(b){return {qty:Number(b.qty)||0,expiry:b.expiry||'',lot:b.lot||''};}),
            updatedAt:(typeof nowISO==='function'?nowISO():new Date().toISOString()),
            source:'Recovered controlled shared catalogue seed'
          };
          changedStock=true;
        }
      });
      var jobs=[];
      if(changedCatalog&&typeof ctlSetCatalog==='function')jobs.push(Promise.resolve(ctlSetCatalog(catalog)));
      if(changedStock&&typeof ctlSetPharmacy==='function')jobs.push(Promise.resolve(ctlSetPharmacy(pharmacy)));
      if(jobs.length)await Promise.all(jobs);
      _narcoticSeedDone=true;
      return changedCatalog||changedStock;
    }catch(e){console.error('Narcotic shared list repair failed',e);return false;}
    finally{_narcoticSeedBusy=false;}
  }
  window.ensureNarcoticSharedList=ensureNarcoticSharedList;

})();

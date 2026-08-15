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

// --- Merged from 20-psychotropic-shared-list-v12.js (Phase 6 consolidation) ---
(function(){
  var PSYCHOTROPIC_SHARED_SEED=[{"moh":"545051836","nupco":"5114169900100","name":"AGOMELATINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031410","nupco":"5114160100100","name":"AMITRIPTYLINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031400","nupco":"5114160100200","name":"AMITRIPTYLINE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031589","nupco":"5114163400200","name":"ARIPIPRAZOLE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031382","nupco":"5114163400100","name":"ARIPIPRAZOLE 15MG","classification":"psychotropic","min":0,"max":0},{"moh":"545021061","nupco":"5112176600000","name":"ATOMOXETINE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545071925","nupco":"5115160200000","name":"BENZTROPINE 2MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031402","nupco":"5129340200000","name":"BUPROPION 150MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031500","nupco":"5114179800200","name":"CHLORPROMAZINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034510","nupco":"5114179800000","name":"CHLORPROMAZINE 50MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031631","nupco":"5129200400000","name":"CITALOPRAM 20MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031430","nupco":"5114161600200","name":"CLOMIPRAMINE 10 MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031435","nupco":"5114161600000","name":"CLOMIPRAMINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031539","nupco":"5114171500100","name":"CLOZAPINE 100MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031538","nupco":"5114171500200","name":"CLOZAPINE 25 MG","classification":"psychotropic","min":0,"max":0},{"moh":"545064880","nupco":"5115190300000","name":"DANTROLINE 25MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545051830","nupco":"5114153900000","name":"DULOXETINE 60MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031632","nupco":"5114163300000","name":"ESCITALOPRAM 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034639","nupco":"5114161800100","name":"FLUPENTHIXOL 25MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031642","nupco":"5114160700100","name":"FLUVOXAMINE 100MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031636","nupco":"5114160700000","name":"FLUVOXAMINE 50MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034638","nupco":"5114161800000","name":"FLUOXETINE 20MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034639","nupco":"5114161800100","name":"FLUOXETINE 20MG/5ML LIQUID","classification":"psychotropic","min":0,"max":0},{"moh":"545034615","nupco":"5114170200600","name":"HALOPERIDOL 5MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031600","nupco":"5114170200700","name":"HALOPERIDOL 1.5MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034618","nupco":"5114170200000","name":"HALOPERIDOL 50MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031605","nupco":"5114170200100","name":"HALOPERIDOL 5MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031450","nupco":"5114162100000","name":"IMIPRAMINE 10 MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031455","nupco":"5114162100100","name":"IMIPRAMINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031470","nupco":"5114162300000","name":"MAPROTILINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545071926","nupco":"5114154100000","name":"MEMANTINE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031635","nupco":"5114160400000","name":"MIRTAZAPINE 30MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031379","nupco":"5114170300500","name":"OLANZAPINE 10MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031372","nupco":"5114170300000","name":"OLANZAPINE 5MG DIS","classification":"psychotropic","min":0,"max":0},{"moh":"545031378","nupco":"5114170300600","name":"OLANZAPINE 5MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031542","nupco":"5133200300400","name":"PALIPERIDONE 3MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031546","nupco":"5133200300000","name":"PALIPERIDONE 100MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031543","nupco":"5133200300100","name":"PALIPERIDONE 150MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031353","nupco":"5114172200100","name":"QUETIAPINE 100MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031354","nupco":"5114172200200","name":"QUETIAPINE 200MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031356","nupco":"5114172200300","name":"QUETIAPINE 300MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031527","nupco":"5114170400200","name":"RISPERIDONE 25 MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031536","nupco":"5114170400100","name":"RISPERIDONE 2MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031529","nupco":"5114170400300","name":"RISPERIDONE 37.5 MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031534","nupco":"5114170400400","name":"RISPERIDONE 4MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031525","nupco":"5114170400600","name":"RISPERIDONE 50 MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545032550","nupco":"5114170400500","name":"RISPERIDONE 1MG SYRUP","classification":"psychotropic","min":0,"max":0},{"moh":"545031385","nupco":"5133210300000","name":"SULPRIDE 200MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031531","nupco":"5133210300100","name":"SULPRIDE 50MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031580","nupco":"5114179900300","name":"TRIFLUPHENAZINE 1MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031590","nupco":"5114179900100","name":"TRIFLUPHENAZINE 5MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031358","nupco":"5114163600100","name":"VENLAFAXINE 150MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031641","nupco":"5114163600200","name":"VENLAFAXINE 75 MG","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5115151500000","name":"RIVASTIGMINE PATCHES 4.6MG/24H","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5115151500100","name":"RIVASTIGMINE PATCHES 9.5MG/24H","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5112176600200","name":"ATOMOXETINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5114153900100","name":"DULOXETINE 30MG","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5110230200000","name":"AMANTADINE 100MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5114153800100","name":"DONEPEZIL 10MG TABLET","classification":"psychotropic","min":0,"max":0}];
  window.PSYCHOTROPIC_SHARED_SEED=PSYCHOTROPIC_SHARED_SEED;
})();

// --- Merged from 69-r676-narcotic-catalog-restore-20260728.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var RESTORE_KEY='narcotic_restore_from_backup_20260728_v1';
  var DEPT_ENRICH_KEY='controlled_dept_list_name_enrich_v1';
  var NARCOTIC_CATALOG=[{"min":0,"nupco":"","name":"ALPRAZOLAM .5 MG","max":0,"id":"cm_545031626","classification":"narcotic","moh":"545031626"},{"nupco":"5115160400200","min":0,"name":"BENZOHXOLE 2 MG","max":0,"classification":"narcotic","id":"cm_545071900","moh":"545071900"},{"id":"cm_549551905","classification":"narcotic","max":0,"moh":"549551905","min":0,"nupco":"5136150100000","name":"CHLORAL HYDRATE 100MG/1ML"},{"moh":"545051785","id":"cm_545051785","classification":"narcotic","max":0,"name":"CLONAZEPAM 2 MG TAB","nupco":"5114150200200","min":0},{"moh":"545054595","max":0,"classification":"narcotic","id":"cm_545054595","name":"CLONAZEPAM 2.5 MG DROP","nupco":"5114150200300","min":0},{"moh":"545064870","classification":"narcotic","id":"cm_545064870","max":0,"name":"DIAZEPAM 10 MG INJ","min":0,"nupco":"5114192000300"},{"moh":"545031370","max":0,"id":"cm_545031370","classification":"narcotic","name":"DIAZEPAM 5 MG TAB","nupco":"5114192000500","min":0},{"max":0,"classification":"narcotic","id":"cm_545031365","moh":"545031365","nupco":"5114192000000","min":0,"name":"DIAZEPAM 5 MG TUBE"},{"classification":"narcotic","id":"cm_544094615","max":0,"moh":"544094615","min":0,"nupco":"5139171700000","name":"EPHIDRINE 50 MG"},{"moh":"545024065","max":0,"id":"cm_545024065","classification":"narcotic","name":"FENTANYL 100 MCG","min":0,"nupco":"5137230500300"},{"nupco":"5137230500400","min":0,"name":"FENTANYL 500 MCG","classification":"narcotic","id":"cm_545024064","max":0,"moh":"545024064"},{"name":"GABAPENTINE 300","nupco":"5114151700000","min":0,"moh":"545051784","classification":"narcotic","id":"cm_545051784","max":0},{"nupco":"5127220400000","min":0,"name":"KETAMINE 10 mg/1ml/20 ml","classification":"narcotic","id":"cm_545044670","max":0,"moh":"545044670"},{"min":0,"nupco":"5114191600100","name":"LORAZEPAM 1 MG T","max":0,"classification":"narcotic","id":"cm_545031350","moh":"545031350"},{"moh":"545021064","max":0,"classification":"narcotic","id":"cm_545021064","name":"METHYPHENEDATE 36 MG","nupco":"5114261800100","min":0},{"name":"METHYPHENEDATE 18 MG","min":0,"nupco":"5114261800200","moh":"545021065","id":"cm_545021065","classification":"narcotic","max":0},{"min":0,"nupco":"5114154200100","name":"MIDAZOLAM 15 MG","max":0,"id":"cm_545034625","classification":"narcotic","moh":"545034625"},{"max":0,"classification":"narcotic","id":"cm_545024051","moh":"545024051","min":0,"nupco":"5114220600300","name":"MORPHINE 10 MG"},{"name":"PETHIDINE 100 MG","min":0,"nupco":"5137180300000","moh":"545024060","max":0,"id":"cm_545024060","classification":"narcotic"},{"max":0,"id":"cm_545024055","classification":"narcotic","moh":"545024055","min":0,"nupco":"5137180300100","name":"PETHIDINE 50 MG"},{"nupco":"5114150500000","min":0,"name":"PHENO 10 MG TAB","classification":"narcotic","id":"cm_545051700","max":0,"moh":"545051700"},{"name":"PHENO 100 MG TAB","nupco":"5114150500900","min":0,"moh":"545051715","max":0,"classification":"narcotic","id":"cm_545051715"},{"nupco":"5114150500700","min":0,"name":"PHENO 200 MG INJ","id":"cm_545054730","classification":"narcotic","max":0,"moh":"545054730"},{"id":"cm_545054725","classification":"narcotic","max":0,"moh":"545054725","min":0,"nupco":"5114150500800","name":"PHENO 40-60 MG INJ"},{"nupco":"5114150500200","min":0,"name":"PHENO 50 MG TAB","id":"cm_545051710","classification":"narcotic","max":0,"moh":"545051710"},{"moh":"545051812","id":"cm_545051812","classification":"narcotic","max":0,"name":"PREGABALINE 150 MG","min":0,"nupco":"5114153400000"},{"name":"PREGABALINE 75 MG","min":0,"nupco":"5114153400100","moh":"545051816","id":"cm_545051816","classification":"narcotic","max":0},{"name":"PROCYCLIDINE 5 MG","min":0,"nupco":"5115160300000","moh":"545071902","max":0,"classification":"narcotic","id":"cm_545071902"},{"moh":"545044658","max":0,"classification":"narcotic","id":"cm_545044658","name":"PROPOFOL","nupco":"5114294100000","min":0},{"id":"cm_545046696","classification":"narcotic","max":0,"moh":"545046696","min":0,"nupco":"5114294200100","name":"SEVOFLORAN"},{"name":"THIOPENTAL 500 MG","min":0,"nupco":"5114292100000","moh":"545044650","max":0,"id":"cm_545044650"},{"min":0,"nupco":"5137160100300","name":"TRAMADOL 100 MG INJ","id":"cm_545024089","classification":"narcotic","max":0,"moh":"545024089"},{"id":"cm_545021091","classification":"narcotic","max":0,"moh":"545021091","min":0,"nupco":"5137160100100","name":"TRAMADOL 50 MG C"}];
  var NARCOTIC_STOCK={"cm_545031370":{"source":"Recovered controlled shared catalogue seed","qty":722,"actualQty":722,"batches":[{"qty":722,"lot":"","expiry":"2029-01-31"}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545044650":{"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0,"batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545021064":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed"},"cm_545051812":{"batches":[{"expiry":"2027-08-31","lot":"","qty":1679}],"source":"Recovered controlled shared catalogue seed","qty":1679,"actualQty":1679,"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024051":{"updatedAt":"2026-07-25T17:31:54.223Z","actualQty":49,"qty":49,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2028-06-30","qty":49,"lot":""}]},"cm_545024089":{"batches":[{"lot":"","qty":4,"expiry":"2029-05-31"}],"source":"Recovered controlled shared catalogue seed","qty":4,"actualQty":4,"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545054595":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed","batches":[]},"cm_545044670":{"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0,"batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024064":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":162,"actualQty":162,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-12-31","qty":162,"lot":""}]},"cm_545024060":{"batches":[{"expiry":"2027-12-31","qty":96,"lot":""}],"qty":96,"actualQty":96,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051816":{"batches":[{"qty":970,"lot":"","expiry":"2028-08-31"}],"qty":970,"actualQty":970,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545031626":{"source":"Recovered controlled shared catalogue seed","actualQty":0,"qty":0,"batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051700":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[{"qty":1384,"lot":"","expiry":"2027-03-30"}],"qty":1384,"actualQty":1384,"source":"Recovered controlled shared catalogue seed"},"cm_549551905":{"updatedAt":"2026-07-25T17:31:54.223Z","source":"Recovered controlled shared catalogue seed","actualQty":0,"qty":0,"batches":[]},"cm_545021065":{"qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed","batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545021091":{"qty":737,"actualQty":737,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2026-12-31","qty":737,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024055":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":171,"actualQty":171,"source":"Recovered controlled shared catalogue seed","batches":[{"lot":"","qty":171,"expiry":"2026-12-31"}]},"cm_545051710":{"qty":264,"actualQty":264,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-03-30","qty":264,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024065":{"actualQty":479,"qty":479,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-12-31","qty":479,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051784":{"batches":[{"expiry":"31/11/2028","lot":"","qty":1850}],"qty":1850,"actualQty":1850,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051785":{"qty":787,"actualQty":787,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"31/06/2028","qty":787,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545071900":{"source":"Recovered controlled shared catalogue seed","qty":438,"actualQty":438,"batches":[{"expiry":"31/09/2028","lot":"","qty":438}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545064870":{"batches":[{"lot":"","qty":34,"expiry":"31/11/2028"}],"qty":34,"actualQty":34,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545044658":{"qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed","batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545046696":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0},"cm_545054730":{"batches":[{"expiry":"31/11/2027","lot":"","qty":48}],"actualQty":48,"qty":48,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545071902":{"source":"Recovered controlled shared catalogue seed","qty":555,"actualQty":555,"batches":[{"qty":555,"lot":"","expiry":"2028-08-31"}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545034625":{"source":"Recovered controlled shared catalogue seed","actualQty":175,"qty":175,"batches":[{"lot":"","qty":175,"expiry":"2027-03-31"}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545031365":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"source":"Recovered controlled shared catalogue seed","actualQty":0,"qty":0},"cm_544094615":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"actualQty":0,"qty":0,"source":"Recovered controlled shared catalogue seed"},"cm_545051715":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":1196,"actualQty":1196,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-01-31","qty":1196,"lot":""}]},"cm_545054725":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0},"cm_545031350":{"updatedAt":"2026-07-25T17:31:54.223Z","source":"Recovered controlled shared catalogue seed","qty":115,"actualQty":115,"batches":[{"qty":100,"lot":"","expiry":"31/04/2028"},{"expiry":"31/09/2028","qty":15,"lot":""}]}};

  window.restoreNarcoticCatalogFromBackup=async function(){
    if(!window.S||!S.ready)return false;
    if(S.g(RESTORE_KEY))return false;
    var role=String((window.CU&&CU.role)||'');
    if(!(window.CU&&(CU.master===true||role==='pharmacy'||role==='controlled_pharmacy')))return false;
    var liveCatalog=(typeof ctlCatalog==='function'?ctlCatalog():S.g('controlled_catalog'))||[];
    var liveStock=Object.assign({},(typeof ctlPharmacy==='function'?ctlPharmacy():S.g('controlled_pharmacy_stock'))||{});
    var existingNarcIds=new Set(liveCatalog.filter(function(m){return String(m.classification||'').toLowerCase()==='narcotic'}).map(function(m){return m.id}));
    var toAdd=NARCOTIC_CATALOG.filter(function(m){return !existingNarcIds.has(m.id)});
    var stockToAdd={};
    Object.keys(NARCOTIC_STOCK).forEach(function(id){if(!Object.prototype.hasOwnProperty.call(liveStock,id))stockToAdd[id]=NARCOTIC_STOCK[id];});
    await S.s(RESTORE_KEY,{done:true,restoredAt:new Date().toISOString(),added:toAdd.length});
    if(!toAdd.length&&!Object.keys(stockToAdd).length)return false;
    var mergedCatalog=liveCatalog.concat(toAdd);
    var mergedStock=Object.assign({},liveStock,stockToAdd);
    await S.s('controlled_catalog',mergedCatalog);
    await S.s('controlled_pharmacy_stock',mergedStock);
    console.log('[narcotic-restore] Restored',toAdd.length,'narcotic catalog entries.');
    if(typeof window.toast==='function')toast('Narcotic medicines restored ('+toAdd.length+') ✓','succ');
    return true;
  };

  window.enrichAllDeptListNames=async function(){
    if(!window.S||!S.ready)return false;
    if(S.g(DEPT_ENRICH_KEY))return false;
    var role=String((window.CU&&CU.role)||'');
    if(!(window.CU&&(CU.master===true||role==='pharmacy'||role==='controlled_pharmacy')))return false;
    var depts=(typeof gd==='function'?gd():[]);
    if(!depts.length)return false;
    var cat=(typeof ctlCatalog==='function'?ctlCatalog():[]);
    if(!cat.length)return false;
    var catMap={};cat.forEach(function(m){catMap[m.id]=m;});
    var enriched=0;
    for(var i=0;i<depts.length;i++){
      var dept=depts[i],deptId=String(dept.id||'');
      if(!deptId)continue;
      var list=S.g('controlled_dept_list_'+deptId);
      if(!Array.isArray(list)||!list.length)continue;
      var needsEnrich=list.some(function(row){return !row.name&&catMap[row.medId]&&catMap[row.medId].name;});
      if(!needsEnrich)continue;
      var enriched_list=list.map(function(row){
        if(row.name)return row;
        var m=catMap[row.medId]||{};
        if(!m.name)return row;
        return Object.assign({},row,{name:m.name,moh:m.moh||row.moh||'',nupco:m.nupco||row.nupco||'',classification:m.classification||row.classification||'narcotic'});
      });
      await S.s('controlled_dept_list_'+deptId,enriched_list);
      enriched++;
    }
    await S.s(DEPT_ENRICH_KEY,{done:true,at:new Date().toISOString(),depts:enriched});
    if(enriched>0)console.log('[dept-enrich] Embedded medicine names in',enriched,'dept lists.');
    return enriched>0;
  };
})();


// --- Merged from 21-r664-psychotropic-pharmacy-stock-import-20260728.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var IMPORT_KEY='psychotropic_pharmacy_stock_import_r664_20260728_v2_safe_psych_only';
  var SOURCE_FILE='متوفر الادوية النفسية.xlsx';
  var DATA=[{"name":"AGOMELATINE 25MG","sourceName":"AGOMELATINE 25MG","matchMoh":"545051836","matchNupco":"5114169900100","moh":"545051836","nupco":"5114169900100","qty":1000,"batches":[{"qty":1000,"expiry":"2026-12-31","lot":""}]},{"name":"AMITRIPTYLINE 25MG","sourceName":"AMITRIPTYLINE 25MG","matchMoh":"545031410","matchNupco":"5114160100100","moh":"545031410","nupco":"5114160100100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-04-30","lot":""}]},{"name":"AMITRIPTYLINE 10MG","sourceName":"AMITRIPTYLINE 10MG","matchMoh":"545031400","matchNupco":"5114160100200","moh":"545031400","nupco":"5114160100200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-04-30","lot":""}]},{"name":"ARIPIPRAZOLE 10MG","sourceName":"ARIPIPRAZOLE 10MG","matchMoh":"545031589","matchNupco":"5114163400200","moh":"545031589","nupco":"5114163400200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-02-28","lot":""}]},{"name":"ARIPIPRAZOLE 15MG","sourceName":"ARIPIPRAZOLE 15MG","matchMoh":"545031382","matchNupco":"5114163400100","moh":"545031382","nupco":"5114163400100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-11-30","lot":""}]},{"name":"ATOMOXETINE 10MG","sourceName":"ATOMOXETINE10MG","matchMoh":"545021061","matchNupco":"5112176600000","moh":"545021061","nupco":"5112176600000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-12-31","lot":""}]},{"name":"BENZTROPINE 2MG","sourceName":"BENZTROPINE 2MG","matchMoh":"545071925","matchNupco":"5115160200000","moh":"545071925","nupco":"5115160200000","qty":1000,"batches":[{"qty":1000,"expiry":"2028-11-30","lot":""}]},{"name":"BUPROPION 150MG","sourceName":"BUPROPION 150MG","matchMoh":"545031402","matchNupco":"5129340200000","moh":"545031402","nupco":"5129340200000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-08-31","lot":""}]},{"name":"CHLORPROMAZINE 25MG","sourceName":"CHLORPROMAZINE 25mg","matchMoh":"545031500","matchNupco":"5114179800200","moh":"545031500","nupco":"5114179800200","qty":0,"batches":[]},{"name":"CHLORPROMAZINE 50MG INJ","sourceName":"CHLORPROMAZINE 50mg INJ","matchMoh":"545034510","matchNupco":"5114179800000","moh":"545034510","nupco":"5114179800000","qty":0,"batches":[]},{"name":"CITALOPRAM 20MG","sourceName":"CITALOPRAM 20MG","matchMoh":"545031631","matchNupco":"5129200400000","moh":"545031631","nupco":"5129200400000","qty":0,"batches":[]},{"name":"CLOMIPRAMINE 10 MG","sourceName":"CLOMIPRAMINE 10 MG","matchMoh":"545031430","matchNupco":"5114161600200","moh":"545031430","nupco":"5114161600200","qty":0,"batches":[]},{"name":"CLOMIPRAMINE 25MG","sourceName":"CLOMIPRAMINE 25MG","matchMoh":"545031435","matchNupco":"5114161600000","moh":"545031435","nupco":"5114161600000","qty":2000,"batches":[{"qty":1000,"expiry":"2027-03-31","lot":""},{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"CLOZAPINE 100MG","sourceName":"CLOZAPINE 100MG","matchMoh":"545031539","matchNupco":"5114171500100","moh":"545031539","nupco":"5114171500100","qty":0,"batches":[]},{"name":"CLOZAPINE 25 MG","sourceName":"CLOZAPINE 25 MG","matchMoh":"545031538","matchNupco":"5114171500200","moh":"545031538","nupco":"5114171500200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-05-31","lot":""}]},{"name":"DANTROLINE 25MG INJ","sourceName":"DANTROLINE 25MG INJ","matchMoh":"545064880","matchNupco":"5115190300000","moh":"545064880","nupco":"5115190300000","qty":60,"batches":[{"qty":60,"expiry":"2028-04-30","lot":""}]},{"name":"DULOXETINE 60MG","sourceName":"DULOXETINE 60MG","matchMoh":"545051830","matchNupco":"5114153900000","moh":"545051830","nupco":"5114153900000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-02-28","lot":""}]},{"name":"ESCITALOPRAM 10MG","sourceName":"ESCITALOPRAM 10MG","matchMoh":"545031632","matchNupco":"5114163300000","moh":"545034640","nupco":"5114179900500","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"FLUPENTHIXOL 25MG INJ","sourceName":"FLUPENTHIXOL 20MG INJ","matchMoh":"545034639","matchNupco":"5114161800100","moh":"545034639","nupco":"5114161800100","qty":0,"batches":[]},{"name":"FLUVOXAMINE 100MG","sourceName":"FLUVOXAMINE 100MG","matchMoh":"545031642","matchNupco":"5114160700100","moh":"545031642","nupco":"5114160700100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-05-31","lot":""}]},{"name":"FLUVOXAMINE 50MG","sourceName":"FLUVOXAMINE 50MG","matchMoh":"545031636","matchNupco":"5114160700000","moh":"545031636","nupco":"5114160700000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"FLUOXETINE 20MG","sourceName":"FLUXETINE 20MG","matchMoh":"545034638","matchNupco":"5114161800000","moh":"545034638","nupco":"5114161800000","qty":1000,"batches":[{"qty":1000,"expiry":"2028-09-30","lot":""}]},{"name":"FLUOXETINE 20MG/5ML LIQUID","sourceName":"FLUXETINE 20MG/5 ML LIQUID","matchMoh":"545034639","matchNupco":"5114161800100","moh":"545034639","nupco":"5114161800100","qty":12,"batches":[{"qty":12,"expiry":"2026-09-30","lot":""}]},{"name":"HALOPERIDOL 5MG INJ","sourceName":"HALOORIDOLE 5MG INJ","matchMoh":"545034615","matchNupco":"5114170200600","moh":"545034615","nupco":"5114170200600","qty":0,"batches":[]},{"name":"HALOPERIDOL 1.5MG","sourceName":"HALOPRIDOLE 1.5MG","matchMoh":"545031600","matchNupco":"5114170200700","moh":"545031600","nupco":"5114170200700","qty":1000,"batches":[{"qty":1000,"expiry":"2029-12-31","lot":""}]},{"name":"HALOPERIDOL 50MG INJ","sourceName":"HALOPRIDOLE 50MG INJ","matchMoh":"545034618","matchNupco":"5114170200000","moh":"545034618","nupco":"5114170200000","qty":0,"batches":[]},{"name":"HALOPERIDOL 5MG TAB","sourceName":"HALOPRIDOLE 5MG TAB","matchMoh":"545031605","matchNupco":"5114170200100","moh":"545031605","nupco":"5114170200100","qty":0,"batches":[]},{"name":"IMIPRAMINE 10 MG","sourceName":"IMIPRAMINE 10 MG","matchMoh":"545031450","matchNupco":"5114162100000","moh":"545031450","nupco":"5114162100000","qty":0,"batches":[]},{"name":"IMIPRAMINE 25MG","sourceName":"IMIPRAMINE 25MG","matchMoh":"545031455","matchNupco":"5114162100100","moh":"545031455","nupco":"5114162100100","qty":0,"batches":[]},{"name":"MAPROTILINE 25MG","sourceName":"MAPROTILINE  25MG","matchMoh":"545031470","matchNupco":"5114162300000","moh":"545031470","nupco":"5114162300000","qty":0,"batches":[]},{"name":"MEMANTINE 10MG","sourceName":"MEMANTINE 10MG","matchMoh":"545071926","matchNupco":"5114154100000","moh":"545071926","nupco":"5114154100000","qty":300,"batches":[{"qty":300,"expiry":"2027-12-31","lot":""}]},{"name":"MIRTAZAPINE 30MG","sourceName":"MIRTAZAPINE 30MG","matchMoh":"545031635","matchNupco":"5114160400000","moh":"545031635","nupco":"5114160400000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-10-31","lot":""}]},{"name":"OLANZAPINE 10MG TAB","sourceName":"OLANZAPINE 10MG TAB","matchMoh":"545031379","matchNupco":"5114170300500","moh":"545031379","nupco":"5114170300500","qty":0,"batches":[]},{"name":"OLANZAPINE 5MG DIS","sourceName":"OLANZAPINE 5mg DIS","matchMoh":"545031372","matchNupco":"5114170300000","moh":"545031372","nupco":"5114170300000","qty":0,"batches":[]},{"name":"OLANZAPINE 5MG TAB","sourceName":"OLANZAPINE 5MG TAB","matchMoh":"545031378","matchNupco":"5114170300600","moh":"545031378","nupco":"5114170300600","qty":60,"batches":[{"qty":60,"expiry":"2027-04-30","lot":""}]},{"name":"PALIPERIDONE 3MG","sourceName":"PALIPERIDONE 3MG","matchMoh":"545031542","matchNupco":"5133200300400","moh":"545031542","nupco":"5133200300400","qty":0,"batches":[]},{"name":"PALIPERIDONE 100MG INJ","sourceName":"PALPRIDONE 100MG INJ","matchMoh":"545031546","matchNupco":"5133200300000","moh":"545031546","nupco":"5133200300000","qty":200,"batches":[{"qty":200,"expiry":"2027-08-31","lot":""}]},{"name":"PALIPERIDONE 150MG INJ","sourceName":"PALPRIDONE 150MG INJ","matchMoh":"545031543","matchNupco":"5133200300100","moh":"545031543","nupco":"5133200300100","qty":200,"batches":[{"qty":200,"expiry":"2027-05-31","lot":""}]},{"name":"QUETIAPINE 100MG","sourceName":"QUTEAPINE 100MG","matchMoh":"545031353","matchNupco":"5114172200100","moh":"545031353","nupco":"5114172200100","qty":1000,"batches":[{"qty":1000,"expiry":"2028-11-30","lot":""}]},{"name":"QUETIAPINE 200MG","sourceName":"QUTEAPINE 200MG","matchMoh":"545031354","matchNupco":"5114172200200","moh":"545031354","nupco":"5114172200200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-09-30","lot":""}]},{"name":"QUETIAPINE 300MG","sourceName":"QUTEAPINE 300MG","matchMoh":"545031356","matchNupco":"5114172200300","moh":"545031356","nupco":"5114172200300","qty":0,"batches":[]},{"name":"RISPERIDONE 25 MG INJ","sourceName":"RISPERIDONE 25 MG inj","matchMoh":"545031527","matchNupco":"5114170400200","moh":"545031527","nupco":"5114170400200","qty":0,"batches":[]},{"name":"RISPERIDONE 2MG TAB","sourceName":"RISPERIDONE 2MG TAB","matchMoh":"545031536","matchNupco":"5114170400100","moh":"545031536","nupco":"5114170400100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-12-31","lot":""}]},{"name":"RISPERIDONE 37.5 MG INJ","sourceName":"RISPERIDONE 37.5 MG inj","matchMoh":"545031529","matchNupco":"5114170400300","moh":"545031529","nupco":"5114170400300","qty":0,"batches":[]},{"name":"RISPERIDONE 4MG TAB","sourceName":"RISPERIDONE 4MG TAB","matchMoh":"545031534","matchNupco":"5114170400400","moh":"545031534","nupco":"5114170400400","qty":1000,"batches":[{"qty":1000,"expiry":"2028-05-31","lot":""}]},{"name":"RISPERIDONE 50 MG INJ","sourceName":"RISPERIDONE 50 MG inj","matchMoh":"545031525","matchNupco":"5114170400600","moh":"545031525","nupco":"5114170400600","qty":5,"batches":[{"qty":5,"expiry":"2027-02-28","lot":""}]},{"name":"RISPERIDONE 1MG SYRUP","sourceName":"RISPREDONE 1MG SYP","matchMoh":"545032550","matchNupco":"5114170400500","moh":"545032550","nupco":"5114170400500","qty":1000,"batches":[{"qty":1000,"expiry":"2027-02-28","lot":""}]},{"name":"SULPRIDE 200MG","sourceName":"SULPRIDE 200MG","matchMoh":"545031385","matchNupco":"5133210300000","moh":"545031385","nupco":"5133210300000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"SULPRIDE 50MG","sourceName":"SULPRIDE 50MG","matchMoh":"545031531","matchNupco":"5133210300100","moh":"545031531","nupco":"5133210300100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-11-30","lot":""}]},{"name":"TRIFLUPHENAZINE 1MG","sourceName":"TRIFLUPHENAZINE 1MG","matchMoh":"545031580","matchNupco":"5114179900300","moh":"545031580","nupco":"5114179900300","qty":0,"batches":[]},{"name":"TRIFLUPHENAZINE 5MG","sourceName":"TRIFLUPHENAZINE 5MG","matchMoh":"545031590","matchNupco":"5114179900100","moh":"545031590","nupco":"5114179900100","qty":0,"batches":[]},{"name":"VENLAFAXINE 150MG","sourceName":"VENLAFAXINE 150MG","matchMoh":"545031358","matchNupco":"5114163600100","moh":"545031358","nupco":"5114163600100","qty":2000,"batches":[{"qty":1000,"expiry":"2027-03-31","lot":""},{"qty":1000,"expiry":"2027-07-31","lot":""}]},{"name":"VENLAFAXINE 75 MG","sourceName":"VENLAFAXINE 75 MG","matchMoh":"545031641","matchNupco":"5114163600200","moh":"545031641","nupco":"5114163600200","qty":0,"batches":[]},{"name":"RIVASTIGMINE PATCHES 4.6MG/24H","sourceName":"RIVASTIGMINE PATCHES 4.6MG/24H","matchMoh":"","matchNupco":"5115151500000","moh":"","nupco":"5115151500000","qty":0,"batches":[]},{"name":"RIVASTIGMINE PATCHES 9.5MG/24H","sourceName":"RIVASTIGMINE PATCHES 9.5MG/24H","matchMoh":"","matchNupco":"5115151500100","moh":"","nupco":"5115151500100","qty":200,"batches":[{"qty":200,"expiry":"2026-08-31","lot":""}]},{"name":"ATOMOXETINE 25MG","sourceName":"Atomoxetine 25mg","matchMoh":"","matchNupco":"5112176600200","moh":"","nupco":"5112176600200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-08-31","lot":""}]},{"name":"DULOXETINE 30MG","sourceName":"DULOXETINE 30MG","matchMoh":"","matchNupco":"5114153900100","moh":"","nupco":"5114153900100","qty":0,"batches":[]},{"name":"AMANTADINE 100MG TAB","sourceName":"AMANTADINE 100MG TAB","matchMoh":"","matchNupco":"5110230200000","moh":"","nupco":"5110230200000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-12-31","lot":""}]},{"name":"DONEPEZIL 10MG TABLET","sourceName":"DONEPEZIL 10MG TABLET","matchMoh":"","matchNupco":"5114153800100","moh":"","nupco":"5114153800100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]}];

  function norm(v){
    return String(v==null?'':v).trim().toLowerCase()
      .replace(/\s+/g,' ')
      .replace(/[^a-z0-9\u0600-\u06ff]+/g,'');
  }
  function code(v){return String(v==null?'':v).replace(/[^0-9]/g,'')}
  function canApply(){
    var u=window.CU||{},r=String(u.role||'');
    return !!(u.master===true||r==='pharmacy'||r==='controlled_pharmacy');
  }
  function sourceCodeIsUnique(field,value){
    value=code(value);if(!value)return false;
    return DATA.filter(function(row){return code(row[field])===value}).length===1;
  }
  function findMedicine(catalog,src){
    var byName=catalog.find(function(m){return norm(m.name)===norm(src.name)});
    if(byName)return byName;
    var oldMoh=code(src.matchMoh),oldNupco=code(src.matchNupco);
    return catalog.find(function(m){
      return (oldMoh&&sourceCodeIsUnique('matchMoh',oldMoh)&&code(m.moh||m.mohCode)===oldMoh)||
             (oldNupco&&sourceCodeIsUnique('matchNupco',oldNupco)&&code(m.nupco||m.nupcoCode)===oldNupco);
    })||null;
  }
  async function applyPsychotropicPharmacyStockR664(){
    if(!window.S||!S.ready||!canApply())return false;
    if(S.g(IMPORT_KEY))return false;

    var catalog=typeof window.ctlCatalog==='function'
      ?(ctlCatalog()||[]).map(function(m){return Object.assign({},m)})
      :[];
    var pharmacy=typeof window.ctlPharmacy==='function'
      ?Object.assign({},ctlPharmacy()||{})
      :{};
    var stamp=typeof window.nowISO==='function'?nowISO():new Date().toISOString();
    var created=0,updated=0,totalQty=0;
    var originalNonPsychStockKeys=Object.keys(pharmacy).filter(function(id){
      var med=catalog.find(function(item){return String(item&&item.id||'')===String(id)});
      return !med||String(med.classification||'').toLowerCase()!=='psychotropic';
    });

    DATA.forEach(function(src,index){
      var med=findMedicine(catalog,src);
      /* Never convert or overwrite an existing narcotic/restricted catalogue item.
         If a code/name collision exists, create a separate psychotropic record. */
      if(med&&String(med.classification||'').toLowerCase()&&String(med.classification||'').toLowerCase()!=='psychotropic')med=null;
      if(!med){
        var baseId=(typeof window.ctlKey==='function'
          ?ctlKey(src.matchMoh||src.moh,src.matchNupco||src.nupco,src.name)
          :'psy_r664')+'_r664_'+String(index+1);
        var id=baseId,idSuffix=1;
        while(catalog.some(function(item){return String(item&&item.id||'')===String(id)})){id=baseId+'_'+idSuffix;idSuffix++;}
        med={id:id,name:src.name,moh:src.moh||'',nupco:src.nupco||'',classification:'psychotropic',min:0,max:0};
        catalog.push(med);created++;
      }else{
        if(src.moh)med.moh=src.moh;
        if(src.nupco)med.nupco=src.nupco;
        med.classification='psychotropic';
        updated++;
      }

      var stock=Object.assign({},pharmacy[med.id]||{});
      var qty=Number(src.qty)||0;
      stock.name=med.name||src.name;
      stock.moh=src.moh||med.moh||'';
      stock.nupco=src.nupco||med.nupco||'';
      stock.classification='psychotropic';
      stock.qty=qty;
      stock.actualQty=qty;
      stock.batches=qty>0?(src.batches||[]).map(function(b,i){
        return {
          id:'r664psy_'+String(index+1)+'_'+String(i+1),
          batchId:'r664psy_'+String(index+1)+'_'+String(i+1),
          qty:Number(b.qty)||0,
          expiry:String(b.expiry||'').slice(0,10),
          lot:String(b.lot||'')
        };
      }):[];
      stock.updatedAt=stamp;
      stock.updatedBy=(window.CU&&(CU.email||CU.username||CU.id||CU.uid))||'R6.64 import';
      stock.source='R6.64 psychotropic pharmacy balance import';
      stock.sourceFile=SOURCE_FILE;
      stock.sourceName=src.sourceName||src.name;
      pharmacy[med.id]=stock;
      totalQty+=qty;
    });
    /* No deletion or filtering is performed. Existing narcotic/restricted stock keys are preserved. */
    var missingProtected=originalNonPsychStockKeys.filter(function(id){return !Object.prototype.hasOwnProperty.call(pharmacy,id)});
    if(missingProtected.length)throw new Error('Safety stop: non-psychotropic pharmacy stock would be removed');

    /* Direct state writes avoid department-custody setters and do not modify any controlled_dept_list_* document. */
    await S.s('controlled_catalog',catalog);
    await S.s('controlled_pharmacy_stock',pharmacy);
    await S.s(IMPORT_KEY,{
      applied:true,appliedAt:stamp,sourceFile:SOURCE_FILE,
      rows:DATA.length,totalQty:totalQty,createdCatalogRows:created,updatedCatalogRows:updated,
      departmentCustodyTouched:false,nonPsychotropicStockPreserved:true
    });
    if(typeof window.auditAction==='function'){
      try{await Promise.resolve(auditAction('controlled_pharmacy_psychotropic_balance_import',{
        sourceFile:SOURCE_FILE,rows:DATA.length,totalQty:totalQty,
        createdCatalogRows:created,updatedCatalogRows:updated,
        departmentCustodyTouched:false,nonPsychotropicStockPreserved:true
      }))}catch(e){console.warn('Psychotropic import audit warning',e)}
    }
    if(typeof window.renderControlled==='function'){
      var active=document.querySelector('.pg.on');
      if(active&&active.id==='pg-controlled')window.renderControlled();
    }
    if(typeof window.toast==='function')toast('Psychotropic pharmacy balance updated from the approved file ✓','succ');
    return true;
  }
  window.applyPsychotropicPharmacyStockR664=applyPsychotropicPharmacyStockR664;
})();

export {};

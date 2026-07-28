/* ASDHealth R6.65 Modular
 * Original script position: 24
 * Original id: r664-psychotropic-pharmacy-stock-import-20260728
 * Compatibility mode: classic script, original execution order preserved.
 */
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

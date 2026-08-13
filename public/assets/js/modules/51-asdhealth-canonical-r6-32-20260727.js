import { publishLegacy } from '../core/legacy-registry.js';

/* ASDHealth FloorStock — R6.32 canonical rules.
   Direct top-level definitions only. No wrapper chaining. */

function fsR5E(id){return document.getElementById(id)}
function fsR5S(v,f){var s=String(v==null?'':v).trim();return s||f||''}
function fsR5N(v){v=Number(v);return isFinite(v)?v:0}
function fsR5Esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fsR5Toast(m,t){
  if(typeof window.toast2==='function')return window.toast2(m,t||'info');
  if(typeof window.toast==='function')return window.toast(m,t||'info');
  if(t==='err')console.error(m);else console.log(m);
}
function fsR5Norm(v){
  return String(v==null?'':v).trim().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g,'');
}
globalThis.FS_R5_DEPT_FALLBACKS = {
  icu:'INTENSIVE CARE UNIT',emergency:'EMERGENCY DEPARTMENT',er:'EMERGENCY DEPARTMENT',
  endoscopy_unit:'ENDOSCOPY UNIT',endoscopy:'ENDOSCOPY UNIT',ccu:'CORONARY CARE UNIT',
  obw:'OBSTETRICS AND GYNAECOLOGY',pedia:'PEDIATRIC',nursery:'NURSERY',
  fmw:'FEMALE MEDICAL WARD',mmw:'MALE MEDICAL WARD',msw:'MALE SURGICAL WARD',
  anesthesia:'ANESTHESIA',aku:'ARTIFICIAL KIDNEY UNIT',opd:'OUTPATIENT DEPARTMENT'
};
globalThis.FS_R5_DEPT_ALIASES = {
  intensivecareunit:'icu',intensivecare:'icu',icu:'icu',
  emergencydepartment:'emergency',emergency:'emergency',er:'emergency',
  endoscopyunit:'endoscopy_unit',endoscopy:'endoscopy_unit',
  coronarycareunit:'ccu',deliveryroom:'ccu',delivery:'ccu',ccu:'ccu',
  obstetricsandgynaecology:'obw',obstetricsgynecology:'obw',obgyn:'obw',obw:'obw',
  pediatric:'pedia',pediatrics:'pedia',paediatric:'pedia',pedia:'pedia',
  nursery:'nursery',femalemedicalward:'fmw',femaleward:'fmw',fmw:'fmw',
  malemedicalward:'mmw',malemedical:'mmw',mmw:'mmw',
  malesurgicalward:'msw',malesurgical:'msw',msw:'msw',
  anesthesia:'anesthesia',anaesthesia:'anesthesia',
  artificialkidneyunit:'aku',dialysis:'aku',aku:'aku',
  outpatientdepartment:'opd',outpatient:'opd',opd:'opd'
};

function fsR5DepartmentRecords(){
  var pools=[],records=[],seen={};
  function addPool(x){if(Array.isArray(x))pools.push(x)}
  try{if(typeof window.gd==='function')addPool(window.gd()||[])}catch(e){}
  try{if(typeof window.getDepts==='function')addPool(window.getDepts()||[])}catch(e){}
  try{if(window.S&&typeof S.g==='function')addPool(S.g('departments')||[])}catch(e){}
  try{
    if(typeof window.gu==='function')addPool((window.gu()||[]).map(function(u){
      return {id:u&&fsR5S(u.deptId||u.departmentId||u.department,''),name:u&&fsR5S(u.deptName||u.departmentName||u.departmentLabel,'')};
    }));
  }catch(e){}
  if(window.CU)addPool([{id:CU.deptId||CU.departmentId||CU.department,name:CU.deptName||CU.departmentName||CU.departmentLabel}]);
  pools.forEach(function(pool){
    pool.forEach(function(d){
      if(!d)return;
      var id=fsR5S(d.id||d.deptId||d.departmentId||d.department||d.code,'');
      if(!id)return;
      var name=fsR5S(d.name||d.deptName||d.departmentName||d.departmentLabel||d.label,'');
      var alias=FS_R5_DEPT_ALIASES[fsR5Norm(id)];
      if(!name)name=FS_R5_DEPT_FALLBACKS[id]||FS_R5_DEPT_FALLBACKS[alias]||'';
      if(!seen[id]){seen[id]={id:id,name:name};records.push(seen[id])}
      else if(name&&(!seen[id].name||seen[id].name===id))seen[id].name=name;
    });
  });
  return records;
}
window.floorstockDepartmentName=function(ref){
  var d=ref&&typeof ref==='object'?ref:{id:ref};
  var id=fsR5S(d.id||d.deptId||d.departmentId||d.department||d.code,'');
  var given=fsR5S(d.name||d.deptName||d.departmentName||d.departmentLabel||d.label,'');
  if(given)return given;
  var hit=fsR5DepartmentRecords().find(function(x){return String(x.id)===String(id)});
  if(hit&&hit.name)return hit.name;
  var alias=FS_R5_DEPT_ALIASES[fsR5Norm(id)];
  return FS_R5_DEPT_FALLBACKS[id]||FS_R5_DEPT_FALLBACKS[alias]||id||'Department / القسم';
};
function fsR5DepartmentCandidates(ref,name){
  var out=[];
  function add(v){v=fsR5S(v,'');if(v&&out.indexOf(v)<0)out.push(v)}
  add(ref);
  var alias=FS_R5_DEPT_ALIASES[fsR5Norm(name)]||FS_R5_DEPT_ALIASES[fsR5Norm(ref)];
  add(alias);
  fsR5DepartmentRecords().forEach(function(d){
    if(String(d.id)===String(ref)||fsR5Norm(d.name)===fsR5Norm(name)||fsR5Norm(d.name)===fsR5Norm(ref)||(alias&&String(d.id)===String(alias)))add(d.id);
  });
  if(window.CU){
    add(CU.deptId);add(CU.departmentId);add(CU.originalDeptId);
    add(FS_R5_DEPT_ALIASES[fsR5Norm(CU.deptName||CU.departmentName)]);
  }
  return out;
}
window.fsR5DepartmentCandidates=fsR5DepartmentCandidates;

/* Print Orders: one A4 landscape page, dispensed positive quantities only. */

function fsR5MedicineFlags(m){
  m=m||{};
  var cls=String(m.classification||'').toLowerCase();
  return {
    high:!!(m.high_alert||m.highAlert||cls.indexOf('high')>=0),
    hazard:!!(m.hazard||m.hazardous||cls.indexOf('hazard')>=0),
    lasa:!!(m.lasa||m.LASA||cls.indexOf('lasa')>=0),
    cold:!!(m.refrigerated||m.fridge||m.cold_chain||cls.indexOf('refriger')>=0)
  };
}
function fsR5SelectedOrders(ids){
  var requests=typeof window.gr==='function'?(window.gr()||[]):[];
  var depts=fsR5DepartmentRecords();
  return ids.map(function(id){
    var r=requests.find(function(x){return String(x.id)===String(id)});
    if(!r)return null;
    var meds=[];
    try{if(typeof window.getMeds==='function')meds=window.getMeds(r.deptId||r.departmentId||'')||[]}catch(e){}
    var rows=(Array.isArray(r.dispensed)?r.dispensed:[])
      .filter(function(x){return fsR5N(x&&x.qty)>0})
      .map(function(x){
        var med=meds.find(function(m){return String(m.id)===String(x.medId||x.medicationId||x.id)})||x||{};
        var f=fsR5MedicineFlags(med);
        return {
          name:fsR5S(med.name||x.name||x.medName||x.medId,'Unknown medicine / دواء غير معروف'),
          category:fsR5S(med.category||x.category,'Uncategorized / غير مصنف'),
          qty:fsR5N(x.qty),high:f.high,hazard:f.hazard,lasa:f.lasa,cold:f.cold
        };
      });
    if(!rows.length)return null;
    var dept=depts.find(function(d){return String(d.id)===String(r.deptId||r.departmentId)})||
      {id:r.deptId||r.departmentId,name:r.deptName||r.departmentName};
    return {request:r,dept:dept,rows:rows};
  }).filter(Boolean);
}
function fsR5OrderRow(row,index){
  var nc='med-name'+(row.high?' high-alert':'')+(row.hazard?' hazard':'');
  var qc='qty-box'+(row.cold?' refrigerated':'');
  var inner='qty-value'+(row.lasa?' lasa':'');
  return '<div class="medicine-item" data-positive="1">'+
    '<span class="item-no">'+index+'</span>'+
    '<span class="'+nc+'">'+fsR5Esc(row.name)+'</span>'+
    '<span class="'+qc+'"><span class="'+inner+'">'+fsR5Esc(row.qty)+'</span></span>'+
    '</div>';
}
function fsR5OrdersPrintData(orders){
  var printData=[];

  (orders||[]).forEach(function(order,orderIndex){
    var tone=orderIndex%2===0?'white':'gray';
    var categoryOrder=[],categoryRows={};

    (order.rows||[]).forEach(function(row){
      var category=row.category||'UNCATEGORIZED / غير مصنف';
      if(!Object.prototype.hasOwnProperty.call(categoryRows,category)){
        categoryRows[category]=[];
        categoryOrder.push(category);
      }
      categoryRows[category].push(row);
    });

    var orderedRows=[];
    categoryOrder.forEach(function(category){
      categoryRows[category].forEach(function(row){orderedRows.push(row);});
    });

    orderedRows.forEach(function(row,index){
      printData.push({
        orderId:String(order.request&&order.request.id||('order_'+orderIndex)),
        orderIndex:orderIndex,
        department:window.floorstockDepartmentName(order.dept),
        category:row.category||'UNCATEGORIZED / غير مصنف',
        itemIndex:index+1,
        name:String(row.name||''),
        qty:row.qty,
        high:!!row.high,
        hazard:!!row.hazard,
        lasa:!!row.lasa,
        cold:!!row.cold,
        tone:tone
      });
    });
  });

  return printData;
}

/* Backward-compatible CSP-safe document generator for diagnostics/tests. */
function fsR5OrdersHtml(orders){
  var payload={rows:fsR5OrdersPrintData(orders)};
  var runtimeUrl='';
  try{runtimeUrl=new URL('./assets/js/print-orders-runtime.js?v=R6.75.0',window.location.href).href;}catch(e){runtimeUrl='/assets/js/print-orders-runtime.js?v=R6.75.0';}
  return '<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Print Orders — Preparing PDF</title>'+
    '<style>html,body{margin:0;width:100%;height:100%;background:#fff;font-family:Arial,Tahoma,sans-serif}#status{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:100%;padding:24px;color:#111;text-align:center;white-space:pre-line}</style>'+
    '<script src="'+fsR5Esc(runtimeUrl)+'" defer><\/script></head><body>'+
    '<canvas id="page-canvas" hidden></canvas><div id="status">Preparing the final A4 PDF…</div>'+
    '<textarea id="print-data" hidden>'+fsR5Esc(JSON.stringify(payload))+'</textarea></body></html>';
}

function fsR5PrintJobToken(){
  var suffix='';
  try{
    var bytes=new Uint32Array(2);
    crypto.getRandomValues(bytes);
    suffix=bytes[0].toString(36)+bytes[1].toString(36);
  }catch(e){suffix=Math.random().toString(36).slice(2);}
  return Date.now().toString(36)+'_'+suffix;
}

window.doPrint=function(){
  if(typeof window.canManageRequests==='function'&&typeof window.isPharmacyDirector==='function'&&!(window.canManageRequests()||window.isPharmacyDirector()))return fsR5Toast('No print permission / لا توجد صلاحية للطباعة','err');
  var ids=Array.from(document.querySelectorAll('.pchk:checked')).map(function(c){return c.dataset.id});
  if(!ids.length)return fsR5Toast('Select at least one order / اختر طلبًا واحدًا على الأقل','err');
  var orders=fsR5SelectedOrders(ids);
  if(!orders.length)return fsR5Toast('No dispensed medicines with quantity greater than zero / لا توجد أدوية مصروفة بكمية أكبر من صفر','err');

  var rows=fsR5OrdersPrintData(orders);
  var token=fsR5PrintJobToken();
  var storageKey='asdhealth:print-orders:'+token;
  var payload={createdAt:Date.now(),rows:rows};
  window.__ASDH_PRINT_ORDER_JOBS__=window.__ASDH_PRINT_ORDER_JOBS__||{};
  window.__ASDH_PRINT_ORDER_JOBS__[token]=payload;
  try{localStorage.setItem(storageKey,JSON.stringify(payload));}catch(storageError){console.warn('Print job could not be stored locally; using the opener fallback.',storageError);}

  var printUrl;
  try{printUrl=new URL('./print-orders.html',window.location.href);}
  catch(e){printUrl={href:'/print-orders.html?job='+encodeURIComponent(token),searchParams:{set:function(){}}};}
  if(printUrl.searchParams&&typeof printUrl.searchParams.set==='function')printUrl.searchParams.set('job',token);
  var popup=window.open(printUrl.href,'_blank');
  if(!popup){
    try{localStorage.removeItem(storageKey);}catch(e){}
    delete window.__ASDH_PRINT_ORDER_JOBS__[token];
    return fsR5Toast('Allow pop-ups to print / اسمح بالنوافذ المنبثقة للطباعة','err');
  }

  setTimeout(function(){
    try{localStorage.removeItem(storageKey);}catch(e){}
    if(window.__ASDH_PRINT_ORDER_JOBS__)delete window.__ASDH_PRINT_ORDER_JOBS__[token];
  },120000);

  try{
    if(typeof window.persistPrintOrdersMeta==='function')Promise.resolve(window.persistPrintOrdersMeta(orders.map(function(o){return o.request.id}))).catch(function(e){console.error(e)});
  }catch(e){}
  if(typeof window.renderPrint==='function')window.renderPrint();
  window.PPP=0;
};

/* My controlled list: department read-only view and one-page A4 print. */

function fsR5ControlledDept(){
  var effective=window.MASTER_EFFECTIVE||window.CU||{},value='';
  try{if(typeof window.ctlCurrentDept==='function')value=window.ctlCurrentDept()||''}catch(e){}
  if(!value)value=effective.deptId||effective.departmentId||effective.department||'';
  var selector=fsR5E('ctl-dept');
  if(!value&&selector)value=selector.value||'';
  return fsR5S(value,'');
}
function fsR5ControlledMedicine(id,row){
  var m={};row=row||{};
  try{if(typeof window.ctlMedicine==='function')m=window.ctlMedicine(id)||{}}catch(e){}
  return {
    name:fsR5S(m.name||row.name||row.medName||row.medicineName,'Unknown medicine / دواء غير معروف'),
    moh:fsR5S(m.moh||m.mohCode||row.moh||row.mohCode,''),
    nupco:fsR5S(m.nupco||m.nupcoCode||row.nupco||row.nupcoCode,''),
    classification:fsR5S(m.classification||row.classification,'narcotic')
  };
}
function fsR5NormalizeControlled(rows,source){
  return (Array.isArray(rows)?rows:[]).map(function(row,i){
    row=row||{};
    var id=row.medId||row.medicationId||row.id;
    var m=fsR5ControlledMedicine(id,row);
    var rawBatches=[];

    if(Array.isArray(row.batches))rawBatches=row.batches;
    else if(Array.isArray(row.batchList))rawBatches=row.batchList;
    else if(Array.isArray(row.lots))rawBatches=row.lots;
    else if(Array.isArray(row.expiryBatches))rawBatches=row.expiryBatches;
    else if(
      row.expiry||row.expiryDate||row.expDate||row.date||
      row.lot||row.lotNo||row.batch||row.batchNo||row.batchNumber
    ){
      rawBatches=[row];
    }

    var batches=rawBatches.map(function(batch){
      batch=batch||{};
      var lot=batch.lot!=null?batch.lot:
        (batch.lotNo!=null?batch.lotNo:
        (batch.batch!=null?batch.batch:
        (batch.batchNo!=null?batch.batchNo:
        (batch.batchNumber!=null?batch.batchNumber:''))));
      var expiry=batch.expiry||batch.expiryDate||batch.expDate||batch.date||'';
      var qty=batch.qty!=null?batch.qty:
        (batch.quantity!=null?batch.quantity:
        (batch.available!=null?batch.available:
        (batch.actualQty!=null?batch.actualQty:'')));

      return {
        lot:fsR5S(lot,''),
        expiry:fsR5S(expiry,''),
        qty:qty===''?'':fsR5N(qty)
      };
    }).filter(function(batch){
      return batch.lot||batch.expiry||batch.qty!=='';
    });

    return {
      key:fsR5S(id,'row_'+i),
      name:m.name,
      moh:m.moh,
      nupco:m.nupco,
      classification:m.classification,
      required:row.requiredQty!=null?fsR5N(row.requiredQty):
        (row.required!=null?fsR5N(row.required):
        (row.max!=null?fsR5N(row.max):'—')),
      actual:row.actualQty!=null?fsR5N(row.actualQty):
        (row.available!=null?fsR5N(row.available):fsR5N(row.qty)),
      batches:batches,
      source:source
    };
  });
}
async function fsR5ControlledRows(dept){
  function addUnique(list,value){
    value=fsR5S(value,'');
    if(value&&list.indexOf(value)<0)list.push(value);
  }
  function aliasTokens(value){
    var out=[],norm=fsR5Norm(value);
    addUnique(out,value);
    var aliases=window.floorstockDepartmentAliases||{};
    Object.keys(aliases).forEach(function(label){
      var values=[label].concat(aliases[label]||[]);
      if(values.some(function(v){return fsR5Norm(v)===norm;})){
        values.forEach(function(v){addUnique(out,v);});
      }
    });
    return out;
  }
  function candidateIds(){
    var out=fsR5DepartmentCandidates(dept,window.CU&&(CU.deptName||CU.departmentName))||[];
    var targets=[];
    [dept,window.CU&&CU.deptId,window.CU&&CU.departmentId,window.CU&&CU.originalDeptId,window.CU&&(CU.deptName||CU.departmentName)].forEach(function(v){
      aliasTokens(v).forEach(function(x){addUnique(targets,x);});
    });
    fsR5DepartmentRecords().forEach(function(d){
      var match=targets.some(function(target){
        return String(d.id)===String(target)||fsR5Norm(d.name)===fsR5Norm(target)||fsR5Norm(d.id)===fsR5Norm(target);
      });
      if(match)addUnique(out,d.id);
    });
    targets.forEach(function(v){
      var mapped=FS_R5_DEPT_ALIASES[fsR5Norm(v)];
      addUnique(out,mapped);
      addUnique(out,v);
    });
    if(window.S&&S.cache){
      Object.keys(S.cache).filter(function(key){return key.indexOf('controlled_dept_list_')===0;}).forEach(function(key){
        var suffix=key.slice('controlled_dept_list_'.length);
        var record=fsR5DepartmentRecords().find(function(d){return String(d.id)===String(suffix);});
        var matches=out.some(function(v){return String(v)===String(suffix)||fsR5Norm(v)===fsR5Norm(suffix);})||
          targets.some(function(v){return fsR5Norm(v)===fsR5Norm(suffix)||(record&&fsR5Norm(record.name)===fsR5Norm(v));});
        if(matches)addUnique(out,suffix);
      });
    }
    return out;
  }
  function normalizePrivate(value,source){
    var rows=fsR5NormalizeControlled(Array.isArray(value)?value:[],source);
    return rows.filter(function(row){return row&&row.name&&row.name!=='Unknown medicine / دواء غير معروف'||row.key;});
  }
  async function readStateRest(id){
    if(typeof fsStateRestRequest!=='function'||typeof fsStateRestBase!=='function')return [];
    var tenant=window.fsTenantId&&fsTenantId(),statePath=tenant?'tenants/'+tenant+'/state':'floorstock_state';
    var url=fsStateRestBase()+'/'+statePath.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent('controlled_dept_list_'+id)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    var response=await fsStateRestRequest(url,{method:'GET'},8000);
    if(response.status===404||!response.payload)return [];
    var decoded=fsLoginDecodeRestDocument(response.payload)||{};
    return normalizePrivate(decoded.value,'private-rest');
  }
  async function readPublicRest(id){
    if(typeof fsStateRestRequest!=='function'||typeof fsStateRestBase!=='function')return [];
    var tenant=window.fsTenantId&&fsTenantId(),path=tenant?'tenants/'+tenant+'/public_controlled_expiry':'public_controlled_expiry';
    var url=fsStateRestBase()+'/'+path.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent(id)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    var response=await fsStateRestRequest(url,{method:'GET'},8000);
    if(response.status===404||!response.payload)return [];
    var decoded=fsLoginDecodeRestDocument(response.payload)||{};
    return fsR5NormalizeControlled(decoded.items||decoded.medicines||[],'public-rest');
  }

  var candidates=candidateIds(),errors=[];
  for(var i=0;i<candidates.length;i++){
    var id=candidates[i],cacheRows=[];
    try{
      var key='controlled_dept_list_'+id;
      var raw=window.S&&S.cache&&Object.prototype.hasOwnProperty.call(S.cache,key)?S.cache[key]:
        (typeof window.ctlDeptList==='function'?window.ctlDeptList(id):[]);
      cacheRows=normalizePrivate(raw,'private-cache');
      if(cacheRows.length)return {dept:id,rows:cacheRows,source:'private-cache'};
    }catch(error){errors.push(error);}
  }

  for(var j=0;j<candidates.length;j++){
    try{
      var restRows=await readStateRest(candidates[j]);
      if(restRows.length){
        if(window.S&&S.cache)S.cache['controlled_dept_list_'+candidates[j]]=restRows.map(function(row){return {
          medId:row.key,requiredQty:row.required,actualQty:row.actual,qty:row.actual,batches:row.batches
        };});
        return {dept:candidates[j],rows:restRows,source:'private-rest'};
      }
    }catch(error){errors.push(error);}
  }

  for(var k=0;k<candidates.length;k++){
    try{
      var publicRows=await readPublicRest(candidates[k]);
      if(publicRows.length){
        if(window.S&&S.cache)S.cache['controlled_dept_list_'+candidates[k]]=publicRows.map(function(row){return {medId:row.key,requiredQty:row.required,actualQty:row.actual,qty:row.actual,batches:row.batches}});
        return {dept:candidates[k],rows:publicRows,source:'public-rest'};
      }
    }catch(error){errors.push(error);}
  }

  if(window.FB_DB){
    for(var n=0;n<candidates.length;n++){
      try{
        var ref=(window.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry')).doc(String(candidates[n]));
        var snap=await fsLoginTimeout(ref.get({source:'server'}),5000,'Controlled custody SDK request timed out.');
        if(snap&&snap.exists){
          var data=snap.data()||{},sdkRows=fsR5NormalizeControlled(data.items||data.medicines||[],'public-sdk');
          if(sdkRows.length)return {dept:candidates[n],rows:sdkRows,source:'public-sdk'};
        }
      }catch(error){errors.push(error);}
    }
  }

  if(errors.length)console.warn('Controlled custody lookup completed without rows.',errors);
  return {dept:candidates[0]||dept,rows:[],source:'not-found',candidates:candidates};
}
function fsR5DMY(v){
  if(!v)return '—';
  try{if(typeof window.ctlFmtDMY==='function')return window.ctlFmtDMY(v)}catch(e){}
  var d=new Date(v);if(isNaN(d))return String(v);
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function fsR12DateOnly(value){
  if(!value)return null;
  if(value instanceof Date){
    if(isNaN(value.getTime()))return null;
    return Date.UTC(value.getFullYear(),value.getMonth(),value.getDate());
  }

  var text=String(value).trim();
  var match=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(match)return Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));

  var date=new Date(value);
  if(isNaN(date.getTime()))return null;
  return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
}

function fsR12PrintDate(){
  var now=new Date();
  return {
    date:now,
    dayUtc:Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),
    text:String(now.getDate()).padStart(2,'0')+'/'+
      String(now.getMonth()+1).padStart(2,'0')+'/'+
      now.getFullYear()
  };
}

function fsR12ExpiryDays(value,printDayUtc){
  var expiryDay=fsR12DateOnly(value);
  if(expiryDay===null)return null;
  return Math.round((expiryDay-printDayUtc)/86400000);
}

function fsR12HasNearExpiry(batches,days,printDayUtc){
  return (Array.isArray(batches)?batches:[]).some(function(batch){
    var remaining=fsR12ExpiryDays(batch&&batch.expiry,printDayUtc);
    return remaining!==null&&remaining>=0&&remaining<=days;
  });
}

function fsR12BatchLotHtml(batches){
  if(!Array.isArray(batches)||!batches.length)return '—';
  return batches.map(function(batch,index){
    var lot=fsR5S(batch&&batch.lot,'');
    var qty=batch&&batch.qty!==''&&batch.qty!=null?fsR5N(batch.qty):'';
    var label=lot||('Batch '+(index+1));
    return '<div class="ctl-batch-line"><b>'+fsR5Esc(label)+'</b>'+
      (qty!==''?' <span class="chip">'+fsR5Esc(qty)+'</span>':'')+'</div>';
  }).join('');
}

function fsR12BatchExpiryHtml(batches){
  if(!Array.isArray(batches)||!batches.length)return '—';
  return batches.map(function(batch){
    return '<div class="ctl-expiry-line">'+
      fsR5Esc(fsR5DMY(batch&&batch.expiry))+
      '</div>';
  }).join('');
}

function fsR5BatchText(batches,html){
  if(!Array.isArray(batches)||!batches.length)return '—';
  return batches.map(function(batch){
    var lot=fsR5S(batch&&batch.lot,'');
    var expiry=fsR5DMY(batch&&batch.expiry);
    var parts=[];
    if(lot)parts.push('Lot '+lot);
    parts.push('Exp '+expiry);
    if(!html)return parts.join(' · ');
    return '<div class="ctl-batch-print-line">'+parts.map(fsR5Esc).join(' · ')+'</div>';
  }).join(html?'':' ; ');
}
function fsR5Class(v){return String(v||'').toLowerCase()==='psychotropic'?'Psychotropic / نفسي':'Narcotic / مخدر'}
function fsR5ExpiryDays(row){
  var a=(row.batches||[]).map(function(b){return b&&b.expiry}).filter(Boolean).map(function(v){
    var d=new Date(v);return isNaN(d)?null:Math.floor((d.getTime()-Date.now())/86400000);
  }).filter(function(v){return v!==null});
  return a.length?Math.min.apply(Math,a):null;
}
function fsR5NearDays(dept){
  var v='';try{v=sessionStorage.getItem('asdhealth-controlled-near-days-'+dept)||''}catch(e){}
  return Math.max(1,Math.floor(fsR5N(v||30)));
}
window.ctlDeptFinalApply=function(){
  var dept=fsR5ControlledDept(),input=fsR5E('ctl-dept-final-days'),days=Math.floor(fsR5N(input&&input.value));
  if(days<1)return fsR5Toast('Enter a valid number of days / أدخل عدد أيام صحيحًا','err');
  try{sessionStorage.setItem('asdhealth-controlled-near-days-'+dept,String(days))}catch(e){}
  return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
};
window.ctlDeptFinalToggle=function(){
  window.CTL_DEPT_ONLY_SOON=!window.CTL_DEPT_ONLY_SOON;
  return Promise.resolve(window.renderDepartmentControlledPanel()).catch(function(e){console.error('Controlled department render failed',e);if(typeof toast==='function')toast('Unable to render controlled department panel.','err');throw e});
};
window.renderDepartmentControlledPanel=async function(){
  var effective=window.MASTER_EFFECTIVE||window.CU||{};
  if(String(effective.role||'')!=='department')return false;
  var host=fsR5E('ctl-departments-view');
  if(!host)return false;
  if(host.dataset.controlledLoading==='1')return false;
  host.dataset.controlledLoading='1';

  window.CTL_VIEW='departments';
  var overview=fsR5E('ctl-overview-view');
  if(overview)overview.style.display='none';
  host.style.display='block';
  host.innerHTML='<div class="card"><div class="cb">Loading My controlled list… / جاري تحميل عهدتي…</div></div>';

  try{
    var requested=fsR5ControlledDept();
    var result=await fsLoginTimeout(
      fsR5ControlledRows(requested),
      18000,
      'Controlled custody loading timed out.'
    );
    var dept=result.dept||requested;
    var rows=result.rows||[];
    var days=fsR5NearDays(dept);

    var shown=window.CTL_DEPT_ONLY_SOON?rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=days;
    }):rows;

    var soon=rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=days&&remaining>0;
    }).length;

    var expired=rows.filter(function(row){
      var remaining=fsR5ExpiryDays(row);
      return remaining!==null&&remaining<=0;
    }).length;

    var body=shown.map(function(row,index){
      return '<tr>'+
        '<td>'+(index+1)+'</td>'+
        '<td>'+fsR5Esc(row.moh||'—')+'</td>'+
        '<td>'+fsR5Esc(row.nupco||'—')+'</td>'+
        '<td><b>'+fsR5Esc(row.name)+'</b></td>'+
        '<td>'+fsR5Esc(fsR5Class(row.classification))+'</td>'+
        '<td>'+fsR5Esc(row.required)+'</td>'+
        '<td>'+fsR5Esc(row.actual)+'</td>'+
        '<td class="ctl-batch-number-cell">'+fsR12BatchLotHtml(row.batches)+'</td>'+
        '<td class="ctl-expiry-date-cell">'+fsR12BatchExpiryHtml(row.batches)+'</td>'+
      '</tr>';
    }).join('');

    if(!body){
      body='<tr><td colspan="9" style="text-align:center;padding:24px">'+
        'No medicines are assigned to this department custody / لا توجد أدوية مسندة لعهدة هذا القسم'+
      '</td></tr>';
    }

    var deptName=effective.deptName||effective.departmentName||
      window.floorstockDepartmentName({id:dept});

    host.innerHTML=
      '<div class="fl ic jb mb14" style="flex-wrap:wrap;gap:10px">'+
        '<div><div class="stitle">My controlled list / عهدتي</div>'+
        '<div class="ssub" style="margin:0">Controlled Custody — '+
          fsR5Esc(deptName)+' · Read-only</div></div>'+
        '<span class="badge bbl">View only / للاطلاع</span>'+
      '</div>'+
      '<div class="card"><div class="cb"><div class="ctl-rulebar">'+
        '<div class="fg"><label>Near-expiry rule (days)</label>'+
          '<input id="ctl-dept-final-days" type="number" min="1" value="'+days+'"></div>'+
        '<button class="btn bp" onclick="ctlDeptFinalApply()">Apply rule</button>'+
        '<button class="btn bg" onclick="ctlDeptFinalToggle()">'+
          (window.CTL_DEPT_ONLY_SOON?'Show all medicines':'Show near-expiry only')+
        '</button>'+
        '<button class="btn bp" id="ctl-dept-authoritative-print-btn" '+
          'onclick="ctlConfirmDepartmentPrint(event)">🖨 Print My controlled list / طباعة عهدتي</button>'+
      '</div>'+
      '<div class="ctl-summary">'+
        '<div class="sc"><div class="sl">Total medicines</div><div class="sv">'+rows.length+'</div></div>'+
        '<div class="sc"><div class="sl">Near expiry ≤ '+days+' days</div><div class="sv">'+soon+'</div></div>'+
        '<div class="sc"><div class="sl">Expired</div><div class="sv">'+expired+'</div></div>'+
      '</div>'+
      '<div class="fhint" style="margin-top:8px">Data source: '+
        fsR5Esc(result.source||'unknown')+'</div></div></div>'+
      '<div class="card">'+
        '<div class="ch"><span class="ct">Controlled and Restricted Medicines List / قائمة الأدوية المخدرة والمقيدة</span></div>'+
        '<div class="fhint" style="padding:0 14px 8px">Scroll horizontally when needed to view Batch No. and Expiry Date / مرّر أفقيًا عند الحاجة لرؤية رقم التشغيلة وتاريخ الصلاحية</div>'+
        '<div class="tw ctl-dept-custody-scroll">'+
          '<table class="ctl-dept-custody-table">'+
            '<colgroup>'+
              '<col style="width:4%"><col style="width:8%"><col style="width:9%">'+
              '<col style="width:22%"><col style="width:10%"><col style="width:7%">'+
              '<col style="width:7%"><col style="width:17%"><col style="width:16%">'+
            '</colgroup>'+
            '<thead><tr>'+
              '<th>#</th><th>MOH Code</th><th>NUPCO Code</th><th>Medicine</th>'+
              '<th>Class</th><th>Required</th><th>Actual</th>'+
              '<th>Batch No. / رقم التشغيلة</th>'+
              '<th>Expiry Date / تاريخ الصلاحية</th>'+
            '</tr></thead>'+
            '<tbody>'+body+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>';

    host.style.display='block';
    delete host.dataset.controlledLoading;
    return true;
  }catch(error){
    console.error('Department controlled custody render failed.',error);
    host.style.display='block';
    host.innerHTML='<div class="card"><div class="cb">'+
      '<div class="alert-banner">Controlled custody could not be loaded / تعذر تحميل عهدة القسم</div>'+
      '<p style="margin-top:10px">'+fsR5Esc(error&&error.message||error)+'</p>'+
      '<button class="btn bp" type="button" onclick="renderDepartmentControlledPanel()">'+
        'Retry / إعادة المحاولة</button></div></div>';
    delete host.dataset.controlledLoading;
    return false;
  }
};
function fsR5PublicUrl(dept){
  try{if(typeof window.ctlPublicUrl==='function')return window.ctlPublicUrl(dept)}catch(e){}
  var url=new URL(location.origin+location.pathname);url.searchParams.set('view','controlled-expiry');url.searchParams.set('dept',dept);var tenant=window.fsTenantId&&fsTenantId();if(tenant)url.searchParams.set('tenant',tenant);return url.toString();
}
function fsR5Logo(){try{if(typeof window.ctlLogo==='function')return window.ctlLogo()||''}catch(e){}return ''}
function fsR5PrintSettings(dept){try{if(typeof window.ctlPrintSettings==='function')return window.ctlPrintSettings(dept)||{}}catch(e){}return {}}
function fsR5ControlledPrintHtml(dept,rows){
  var effective=window.MASTER_EFFECTIVE||window.CU||{};
  var name=window.floorstockDepartmentName({
    id:dept,
    name:effective.deptName||effective.departmentName
  });
  var settings=fsR5PrintSettings(dept);
  var url=fsR5PublicUrl(dept);
  var official=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var printInfo=fsR12PrintDate();
  var qr=window.makeReadableQR(url);

  var body=rows.map(function(row,index){
    var near=fsR12HasNearExpiry(row.batches,30,printInfo.dayUtc);
    return '<tr class="custody-row'+(near?' near-expiry-30':'')+'">'+
      '<td>'+(index+1)+'</td>'+
      '<td>'+fsR5Esc(row.moh||'—')+'</td>'+
      '<td>'+fsR5Esc(row.nupco||'—')+'</td>'+
      '<td class="medicine">'+fsR5Esc(row.name)+'</td>'+
      '<td>'+fsR5Esc(fsR5Class(row.classification))+'</td>'+
      '<td>'+fsR5Esc(row.required)+'</td>'+
      '<td>'+fsR5Esc(row.actual)+'</td>'+
      '<td class="batch">'+fsR5BatchText(row.batches,true)+'</td>'+
    '</tr>';
  }).join('');

  var signatures=[
    ['Head Nurse / رئيس التمريض',settings.nursingHead||''],
    ['Controlled Medicines Officer / مسؤول الأدوية المخدرة والمقيدة',
      settings.controlledOfficer||settings.controlledPharmacyOfficer||''],
    ['Pharmacy Manager / مدير الصيدلية',settings.pharmacyManager||'']
  ].map(function(signature){
    return '<div class="signature"><b>'+fsR5Esc(signature[0])+'</b>'+
      '<span>'+fsR5Esc(signature[1]||'')+'</span></div>';
  }).join('');

  var css=`@page{size:auto;margin:3mm}
*{
  box-sizing:border-box;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
html,body{
  margin:0!important;
  padding:0!important;
  width:100%!important;
  height:100%!important;
  overflow:hidden!important;
  background:#fff!important;
  color:#000!important;
  font-family:Arial,Tahoma,sans-serif;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
body{position:fixed!important;inset:0!important}
.sheet{position:fixed;inset:0;overflow:hidden;background:#fff}
.controlled-layout{
  position:absolute;
  top:0;
  left:0;
  overflow:hidden;
  background:#fff;
  padding:1mm;
  --fs:7.6pt;
  --py:.8mm;
  --qr:22mm
}
.landscape-layout{width:291mm;height:204mm;display:block}
.portrait-layout{width:204mm;height:291mm;display:none}
.fit{width:100%;transform-origin:top left}
.official-print-header{margin-bottom:2mm!important}
.document-head{
  display:grid;
  grid-template-columns:minmax(0,1fr) var(--qr);
  gap:2mm;
  align-items:center;
  min-height:20mm;
  border-bottom:1.4px solid #000;
  margin-bottom:.8mm
}
.titles{text-align:center}
.titles h1{font-size:13pt;margin:0}
.titles h2{font-size:10pt;margin:.6mm 0}
.titles h3{font-size:8.2pt;margin:0}
.qr{width:var(--qr);height:var(--qr);justify-self:end;object-fit:contain}
.print-legend{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:3mm;
  margin:0 0 .8mm;
  padding:.45mm .8mm;
  border:1px solid #000;
  font-size:5.9pt;
  line-height:1.15;
  break-inside:avoid
}
.legend-item{display:flex;align-items:center;gap:1mm}
.legend-swatch{
  display:inline-block;
  width:4mm;
  height:3mm;
  background:#000!important;
  border:1px solid #000;
  flex:0 0 auto
}
.print-date{white-space:nowrap;font-weight:700}
table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:var(--fs)
}
thead{display:table-header-group}
tr{break-inside:avoid}
th,td{
  border:1px solid #000;
  padding:var(--py) .65mm;
  line-height:1.05;
  text-align:center;
  vertical-align:middle;
  overflow-wrap:anywhere
}
th{font-weight:900}
.medicine,.batch{text-align:left}
.medicine{font-weight:800}
.ctl-batch-print-line{display:block;padding:.15mm 0}
.near-expiry-30 td,
.near-expiry-30 td *,
.near-expiry-30 .ctl-batch-print-line{
  background:#000!important;
  background-color:#000!important;
  color:#fff!important;
  -webkit-text-fill-color:#fff!important;
  forced-color-adjust:none!important;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
.signatures{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:5mm;
  margin-top:2.5mm
}
.signature{
  border-top:1px solid #000;
  text-align:center;
  padding-top:.8mm;
  min-height:8mm;
  font-size:6.2pt
}
.signature b,.signature span{display:block}
.electronic-certification{
  margin-top:1.6mm;
  padding-top:.9mm;
  border-top:.7px solid #777;
  text-align:center;
  font-size:5.7pt;
  line-height:1.35;
  font-weight:700;
  color:#000!important;
  -webkit-text-fill-color:#000!important;
  break-inside:avoid;
  page-break-inside:avoid;
  forced-color-adjust:none!important;
  -webkit-print-color-adjust:exact!important;
  print-color-adjust:exact!important
}
.electronic-certification .cert-ar{
  display:block;
  direction:rtl;
  unicode-bidi:plaintext
}
.electronic-certification .cert-en{
  display:block;
  direction:ltr;
  unicode-bidi:plaintext
}
.footer{text-align:center;font-size:5.8pt;margin-top:.7mm}
.print-error{padding:15mm;text-align:center}
@media print and (orientation:landscape){
  .landscape-layout{display:block!important}
  .portrait-layout{display:none!important}
}
@media print and (orientation:portrait){
  .landscape-layout{display:none!important}
  .portrait-layout{display:block!important}
}
@media screen and (orientation:landscape){
  body{background:#d5d5d5!important}
  .landscape-layout{display:block!important;visibility:visible!important}
  .portrait-layout{display:none!important}
}
@media screen and (orientation:portrait){
  body{background:#d5d5d5!important}
  .landscape-layout{display:none!important}
  .portrait-layout{display:block!important;visibility:visible!important}
}`;

  var legend=
    '<div class="print-legend">'+
      '<div class="legend-item"><span class="legend-swatch"></span>'+
        '<span>Expiry within 30 days / قريب الانتهاء خلال 30 يومًا</span></div>'+
      '<div class="print-date">Print date / تاريخ الطباعة: '+
        fsR5Esc(printInfo.text)+'</div>'+
    '</div>';

  var content='<div class="fit">'+official+
    '<header class="document-head">'+
      '<div class="titles">'+
        '<h1>Controlled and Restricted Medicines List</h1>'+
        '<h2>قائمة الأدوية المخدرة والمقيدة</h2>'+
        '<h3>My controlled list / عهدتي — '+fsR5Esc(name)+'</h3>'+
      '</div>'+
      '<img class="qr asd-qr-image" src="'+fsR5Esc(qr)+'" alt="Live controlled list QR">'+
    '</header>'+
    legend+
    '<table>'+
      '<colgroup>'+
        '<col style="width:4%"><col style="width:8%"><col style="width:9%">'+
        '<col style="width:25%"><col style="width:11%"><col style="width:7%">'+
        '<col style="width:7%"><col style="width:29%">'+
      '</colgroup>'+
      '<thead><tr>'+
        '<th>#</th><th>MOH</th><th>NUPCO</th><th>Medicine / الدواء</th>'+
        '<th>Class / التصنيف</th><th>Required / المطلوب</th>'+
        '<th>Actual / الفعلي</th><th>Expiry / الانتهاء</th>'+
      '</tr></thead>'+
      '<tbody>'+body+'</tbody>'+
    '</table>'+
    '<div class="signatures">'+signatures+'</div>'+
    '<div class="electronic-certification">'+
      '<span class="cert-ar">هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم</span>'+
      '<span class="cert-en">This list is electronically approved and certified and does not require a stamp.</span>'+
    '</div>'+
    '<div class="footer">Live list: '+fsR5Esc(url)+'</div>'+
  '</div>';

  var runtime=`(function(){
function imagesReady(){
  return Promise.all(Array.from(document.images).map(function(image){
    var qr=image.classList.contains('asd-qr-image');
    if(qr&&/^data:image\/svg\+xml/i.test(image.getAttribute('src')||''))return Promise.reject(new Error('QR generator returned a placeholder'));
    if(image.complete)return image.naturalWidth>0?Promise.resolve():(qr?Promise.reject(new Error('QR image failed to decode')):Promise.resolve());
    return new Promise(function(resolve,reject){
      image.onload=resolve;
      image.onerror=function(){qr?reject(new Error('QR image failed to load')):resolve()};
      setTimeout(function(){qr?reject(new Error('QR image load timed out')):resolve()},5000);
    });
  }));
}
function showQrFailure(error){
  document.body.dataset.qrPrint='failed';
  document.querySelectorAll('img.asd-qr-image').forEach(function(image){if(/^data:image\/svg\+xml/i.test(image.getAttribute('src')||''))image.style.display='none'});
  var box=document.createElement('div');box.className='print-error';box.innerHTML='<h2>QR generation failed / تعذر إنشاء رمز QR</h2><p>Automatic printing stopped because the QR would not be scannable.<br>تم إيقاف الطباعة التلقائية لأن الرمز لن يكون قابلاً للمسح.</p><button type="button">Print without QR / طباعة بدون QR</button>';box.querySelector('button').onclick=function(){window.focus();window.print()};document.body.insertBefore(box,document.body.firstChild);console.error(error);
}
function over(layout,fit){
  return fit.scrollHeight>layout.clientHeight+1||
    fit.scrollWidth>layout.clientWidth+1;
}
function fitOne(layout){
  var fit=layout.querySelector('.fit');
  var orientation=layout.dataset.orientation;
  var font=orientation==='landscape'?7.6:6.7;
  var padding=orientation==='landscape'?.8:.5;
  var qr=orientation==='landscape'?22:17;
  var guard=0;

  layout.style.display='block';
  layout.style.visibility='hidden';
  fit.style.transform='none';
  layout.style.setProperty('--fs',font+'pt');
  layout.style.setProperty('--py',padding+'mm');
  layout.style.setProperty('--qr',qr+'mm');

  while(over(layout,fit)&&guard<100){
    if(font>(orientation==='landscape'?5:4.6)){
      font=Math.max(orientation==='landscape'?5:4.6,font-.18);
      layout.style.setProperty('--fs',font+'pt');
    }else if(padding>.16){
      padding=Math.max(.16,padding-.05);
      layout.style.setProperty('--py',padding+'mm');
    }else if(qr>(orientation==='landscape'?13:10)){
      qr--;
      layout.style.setProperty('--qr',qr+'mm');
    }else{
      break;
    }
    void fit.offsetHeight;
    guard++;
  }

  var widthRatio=(layout.clientWidth-2)/Math.max(1,fit.scrollWidth);
  var heightRatio=(layout.clientHeight-2)/Math.max(1,fit.scrollHeight);
  var scale=Math.min(widthRatio,heightRatio,1.06);
  if(!isFinite(scale)||scale<=0)scale=1;
  fit.style.transform='scale('+scale+')';

  var expected=Number(layout.dataset.expected||0);
  var actual=layout.querySelectorAll('.custody-row').length;
  if(expected===0||actual!==expected){
    layout.innerHTML='<div class="print-error"><h2>Controlled list integrity check failed</h2>'+
      '<p>Expected '+expected+' rows; rendered '+actual+'.</p></div>';
    layout.dataset.failed='1';
  }else{
    layout.dataset.ready='1';
    layout.dataset.scale=String(scale);
    layout.dataset.font=String(font);
  }

  layout.style.removeProperty('display');
  layout.style.removeProperty('visibility');
}
function fitAll(){
  var layouts=Array.from(document.querySelectorAll('.controlled-layout'));
  layouts.forEach(fitOne);
  if(layouts.some(function(layout){return layout.dataset.failed==='1'})){
    document.body.dataset.failed='1';
    return;
  }
  document.body.dataset.ready='1';
}
function start(){
  imagesReady().then(function(){
    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(function(){
        fitAll();
        if(document.body.dataset.ready==='1'){
          setTimeout(function(){window.focus();window.print()},180);
        }
      },function(){
        fitAll();
        if(document.body.dataset.ready==='1'){
          setTimeout(function(){window.focus();window.print()},180);
        }
      });
    }else{
      fitAll();
      if(document.body.dataset.ready==='1'){
        setTimeout(function(){window.focus();window.print()},180);
      }
    }
  }).catch(showQrFailure);
}
window.addEventListener('load',start,{once:true});
})();`;

  function layoutHtml(orientation){
    var label=orientation==='landscape'?'landscape-layout':'portrait-layout';
    return '<section class="controlled-layout '+label+
      '" data-orientation="'+orientation+
      '" data-expected="'+rows.length+'">'+content+'</section>';
  }

  return '<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+fsR5Esc(name)+' — My controlled list</title>'+
    '<style>'+css+'</style></head><body>'+
    '<main class="sheet">'+layoutHtml('landscape')+layoutHtml('portrait')+'</main>'+
    '<script>'+runtime+'<\/script></body></html>';
}
window.printDepartmentCustodyExact=async function(dept,options){
  options=options||{};
  dept=fsR5S(dept||fsR5ControlledDept(),'');
  var popup=options.printWindow||window.open('about:blank','_blank');
  if(!popup){fsR5Toast('Allow pop-ups to print / اسمح بالنوافذ المنبثقة للطباعة','err');return false;}
  popup.document.open();
  popup.document.write('<!doctype html><html><meta charset="utf-8"><body style="font-family:Arial,Tahoma,sans-serif;padding:24px">Preparing My controlled list… / جاري تجهيز عهدتي…</body></html>');
  popup.document.close();
  try{
    var result=await fsLoginTimeout(fsR5ControlledRows(dept),18000,'Controlled custody print data timed out.');
    if(!result.rows||!result.rows.length){
      popup.document.open();
      popup.document.write('<!doctype html><html><meta charset="utf-8"><body style="font-family:Arial,Tahoma,sans-serif;padding:24px"><h2>No controlled medicines were found for this department.</h2><h2>لم يتم العثور على أدوية مخدرة أو مقيدة لهذا القسم.</h2><p>Checked department identifiers: '+fsR5Esc((result.candidates||[dept]).join(', '))+'</p></body></html>');
      popup.document.close();
      fsR5Toast('My controlled list is empty / قائمة عهدتي فارغة','err');
      return false;
    }
    popup.document.open();
    popup.document.write(fsR5ControlledPrintHtml(result.dept||dept,result.rows));
    popup.document.close();
    setTimeout(function(){
      try{
        if(typeof window.ctlPublishDept==='function')Promise.resolve(window.ctlPublishDept(result.dept||dept)).catch(function(error){console.warn('Background controlled public publish skipped.',error);});
      }catch(error){}
    },0);
    return true;
  }catch(error){
    console.error('Controlled list print failed',error);
    popup.document.open();
    popup.document.write('<!doctype html><html><meta charset="utf-8"><body style="font-family:Arial,Tahoma,sans-serif;padding:24px"><h2>Unable to prepare My controlled list</h2><h2>تعذر تجهيز عهدتي</h2><pre style="white-space:pre-wrap">'+fsR5Esc(error&&error.message||error)+'</pre></body></html>');
    popup.document.close();
    fsR5Toast('Unable to prepare My controlled list / تعذر تجهيز عهدتي','err');
    return false;
  }
};
window.ctlConfirmDepartmentPrint=async function(event){
  if(event&&typeof event.preventDefault==='function')event.preventDefault();
  var dept=fsR5ControlledDept();
  if(!dept)return fsR5Toast('Department is not assigned / لم يتم تحديد القسم','err');
  var popup=window.open('about:blank','_blank');
  if(!popup)return fsR5Toast('Allow pop-ups to print / اسمح بالنوافذ المنبثقة للطباعة','err');
  return window.printDepartmentCustodyExact(dept,{printWindow:popup});
};
window.printControlledCurrent=function(){return window.ctlConfirmDepartmentPrint()};
window.finalControlledPrintRun=function(){return window.ctlConfirmDepartmentPrint()};
window.ctlOpenDepartmentPrintOptions=function(){return window.ctlConfirmDepartmentPrint()};

/* ASDHealth FloorStock — R6 crash-cart, master test mode, and master-only health.
   Direct global definitions; no prior-function wrapping. */

function fsR6E(id){return document.getElementById(id)}
function fsR6S(v,f){var s=String(v==null?'':v).trim();return s||f||''}
function fsR6N(v){v=Number(v);return isFinite(v)?v:0}
function fsR6Esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fsR6Norm(v){
  return String(v==null?'':v).trim().toLowerCase()
    .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g,'');
}
function fsR6Toast(m,t){
  if(typeof window.toast2==='function')return window.toast2(m,t||'info');
  if(typeof window.toast==='function')return window.toast(m,t||'info');
  if(t==='err')console.error(m);else console.log(m);
}
function fsR6Now(){return typeof window.nowISO==='function'?window.nowISO():new Date().toISOString()}
function fsR6Actor(){
  var u=(typeof window.actualUser==='function'?window.actualUser():(window.MASTER_ACTUAL||window.CU||{}))||{};
  return {
    name:u.name||u.fullName||u.displayName||u.username||u.email||'Unknown',
    user:u.username||u.email||u.id||u.uid||'Unknown',
    id:u.id||u.uid||'',
    role:(window.CU&&CU.role)||''
  };
}
function fsR6Audit(action,meta){
  if(typeof window.auditAction==='function'){
    try{return Promise.resolve(window.auditAction(action,meta||{})).catch(function(e){console.error(e)})}
    catch(e){console.error(e)}
  }
  return Promise.resolve();
}
function fsR6CloseModal(id){
  var m=fsR6E(id);
  if(typeof window.CM==='function'){try{window.CM(id);return}catch(e){}}
  if(m)m.classList.remove('on');
}
function fsR6OpenModal(id){
  var m=fsR6E(id);
  if(typeof window.OM==='function'){try{window.OM(id);return}catch(e){}}
  if(m)m.classList.add('on');
}
function fsR6EnsureStyles(){
  if(fsR6E('asdhealth-r6-canonical-style'))return;
  var style=document.createElement('style');
  style.id='asdhealth-r6-canonical-style';
  style.textContent=
    '#pg-crashcart .fsr6-select-col{width:38px;text-align:center}'+
    '#pg-crashcart .fsr6-select-col input{width:16px;height:16px;margin:0}'+
    '#pg-crashcart tr.fsr6-selected td{box-shadow:inset 0 0 0 1px var(--ac);background:rgba(31,111,235,.10)!important}'+
    '#fsr6-crash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-inline-start:auto}'+
    '#fsr6-crash-actions .btn{margin:0}.fsr6-dialog{width:min(1380px,98vw)!important;max-width:98vw!important;height:min(96vh,980px);max-height:96vh;display:flex;flex-direction:column;padding:0!important;overflow:hidden!important}'+
    '.fsr6-head{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}'+
    '.fsr6-body{padding:14px 20px;overflow:auto;flex:1;min-height:0}.fsr6-seeds{font-size:12px;color:var(--tx2);margin-bottom:12px}'+
    '.fsr6-workflow-note{padding:10px 12px;border:1px solid var(--ac);border-radius:10px;background:rgba(31,111,235,.08);margin-bottom:12px;font-size:12px;line-height:1.6}'+
    '.fsr6-plan{border:1px solid var(--bd);border-radius:12px;margin-bottom:14px;overflow:hidden;background:var(--s1)}'+
    '.fsr6-plan.off{opacity:.62}.fsr6-plan-head{display:grid;grid-template-columns:auto minmax(260px,1fr) auto;gap:10px;align-items:center;padding:12px 14px;background:var(--s2);border-bottom:1px solid var(--bd)}'+
    '.fsr6-plan-title{font-weight:800}.fsr6-plan-meta{font-size:11px;color:var(--tx2);margin-top:3px}.fsr6-plan-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}'+
    '.fsr6-plan-body{padding:12px}.fsr6-alloc-box{border:1px solid var(--bd);border-radius:10px;padding:10px;background:var(--s2);margin-bottom:10px}'+
    '.fsr6-alloc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.fsr6-alloc-list{display:grid;gap:7px}'+
    '.fsr6-alloc-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(100px,.55fr) minmax(140px,.8fr) auto;gap:8px;align-items:end}.fsr6-alloc-row input{margin:0}'+
    '.fsr6-cart-plan{border:1px solid var(--bd);border-radius:10px;margin-top:9px;overflow:hidden}.fsr6-cart-plan-head{display:grid;grid-template-columns:auto minmax(220px,1fr) 130px 180px;gap:8px;align-items:end;padding:9px 10px;background:var(--s2)}'+
    '.fsr6-cart-plan-head input,.fsr6-cart-plan-head select{margin:0}.fsr6-cart-custom{padding:10px;border-top:1px dashed var(--bd);background:var(--s1)}'+
    '.fsr6-review-title{margin:20px 0 8px;padding-top:12px;border-top:2px solid var(--bd);font-size:16px;font-weight:900}'+
    '.fsr6-review-card{border:1px solid var(--bd);border-radius:12px;margin-bottom:12px;overflow:hidden}.fsr6-review-head{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(230px,320px);gap:10px;align-items:center;padding:11px 13px;background:var(--s2)}'+
    '.fsr6-review-card.pending{border-color:var(--yl)}.fsr6-review-card.ready{border-color:var(--gn)}.fsr6-review-lines{padding:0 12px 10px}.fsr6-review-line{padding:9px 0;border-bottom:1px dashed var(--bd);font-size:12px;line-height:1.55}.fsr6-review-line:last-child{border-bottom:0}'+
    '.fsr6-review-seal input{margin:0}.fsr6-confirm-label{display:flex;gap:7px;align-items:center;font-weight:800}.fsr6-confirm-label input{width:17px;height:17px;margin:0}'+
    '.fsr6-footer{padding:12px 20px;border-top:1px solid var(--bd);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.fsr6-footer textarea{margin:0;min-height:58px}.fsr6-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.fsr6-status{font-size:11px;color:var(--tx2);max-width:440px}.fsr6-status.err{color:var(--rdl)}'+
    '.fsr6-invalid{border-color:var(--rdl)!important;box-shadow:0 0 0 1px var(--rdl)}.fsr6-empty{padding:12px;border:1px dashed var(--bd);border-radius:9px;color:var(--tx2);font-size:12px}'+
    '.master-test-banner{font-size:10px;line-height:1.2;padding:4px 8px;border:1px solid var(--yl);border-radius:8px;color:var(--yll);white-space:nowrap}.master-test-exit{border-color:var(--rd)!important;color:var(--rdl)!important}'+
    '.fsr6-master-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fsr6-master-preview{padding:10px;border:1px solid var(--bd);border-radius:8px;background:var(--s2);font-size:12px;line-height:1.7}'+
    '@media(max-width:860px){.fsr6-plan-head,.fsr6-cart-plan-head,.fsr6-review-head,.fsr6-footer,.fsr6-master-grid{grid-template-columns:1fr}.fsr6-plan-actions,.fsr6-actions{justify-content:stretch}.fsr6-plan-actions .btn,.fsr6-actions .btn{flex:1}.fsr6-alloc-row{grid-template-columns:1fr 1fr}.fsr6-alloc-row .fsr6-remove-alloc{grid-column:1/-1}}';
  document.head.appendChild(style);
}

/* ---------- Crash Cart smart cross-cart replacement ---------- */

globalThis.FS_R6_CRASH_SELECTED = new Map();
globalThis.FS_R6_CRASH_WORKFLOW = null;
globalThis.FS_R6_CRASH_FILTER = '';
globalThis.FS_R6_ORDER_NAMES = ['Adrenaline (Epinephrine)','Amiodarone','Atropine','Calcium Chloride','Calcium Gluconate','Dextrose','Dobutamine','Dopamine','Lidocaine','Magnesium Sulfate','Naloxone','Norepinephrine','Sodium Bicarbonate'];

function fsR6CrashCanBulk(){
  if(window.fsHasCapability)return window.fsHasCapability('crashCart.configure');
  var role=String((window.CU&&CU.role)||'');
  return !!(window.CU&&(CU.master===true||['pharmacy','pharmacy_director','inpatient_supervisor'].indexOf(role)>=0));
}
function fsR6CrashCarts(){return typeof window.crashCarts==='function'?(window.crashCarts()||[]):[]}
function fsR6CrashFilter(){return String((fsR6E('ccx-expiry')||{}).value||'')}
function fsR6CrashRules(){
  var x={};try{x=window.S&&S.g?S.g('pharmacy_department_expiry_rules')||{}:{}}catch(e){}
  var urgent=Math.max(1,fsR6N(x.urgentDays||7)),near=Math.max(urgent+1,fsR6N(x.nearDays||30));
  return {urgentDays:urgent,nearDays:near};
}
function fsR6CrashDays(expiry){
  if(!expiry)return null;
  var d=new Date(String(expiry).slice(0,10)+'T00:00:00');
  if(isNaN(d.getTime()))return null;
  var z=new Date(),today=new Date(z.getFullYear(),z.getMonth(),z.getDate());
  return Math.floor((d-today)/86400000);
}
function fsR6CrashBatchLevel(batch){
  var d=fsR6CrashDays(batch&&batch.expiry),r=fsR6CrashRules();
  if(d===null)return'missing';
  if(d<0)return'expired';
  if(d<=r.urgentDays)return'urgent';
  if(d<=r.nearDays)return'near';
  return'normal';
}
function fsR6CrashItemLevel(item){
  var rank={expired:5,urgent:4,near:3,missing:2,normal:1},level='normal',batches=(item&&item.batches)||[];
  if(!batches.length)return'missing';
  batches.forEach(function(b){var l=fsR6CrashBatchLevel(b);if(rank[l]>rank[level])level=l});
  return level;
}
function fsR6CrashItemName(item){
  var raw=fsR6Norm(item&&item.name),found='';
  FS_R6_ORDER_NAMES.some(function(x){
    var base=fsR6Norm(x.replace(/\s*\([^)]*\)\s*/g,' '));
    if(raw.indexOf(base)>=0||(base==='adrenalineepinephrine'&&(raw.indexOf('adrenaline')>=0||raw.indexOf('epinephrine')>=0))){found=x;return true}
    return false;
  });
  return found||fsR6S(item&&item.name,'Medication');
}
function fsR6CrashMedicineKey(item){
  return fsR6Norm(fsR6CrashItemName(item))+'|'+fsR6Norm(item&&(item.strength||item.concentration||''));
}
function fsR6CrashSort(items){
  return items.slice().sort(function(a,b){
    var ai=FS_R6_ORDER_NAMES.indexOf(fsR6CrashItemName(a)),bi=FS_R6_ORDER_NAMES.indexOf(fsR6CrashItemName(b));
    if(ai<0)ai=999;if(bi<0)bi=999;
    return ai-bi||fsR6CrashItemName(a).localeCompare(fsR6CrashItemName(b));
  });
}
function fsR6CrashSelectionAllowed(level){return ['expired','urgent','near'].indexOf(level)>=0}
function fsR6CrashKey(cartId,itemId){return String(cartId)+'::'+String(itemId)}
function fsR6CrashVisibleItems(cart,level){
  return fsR6CrashSort((cart.items||[]).filter(function(item){return fsR6CrashItemLevel(item)===level}));
}
function fsR6CrashExactInfo(item,oldDate){
  var present=fsR6N(item&&item.present!=null?item.present:item&&item.qty),required=fsR6N(item&&item.qty);
  var matching=[],matchingExplicit=0,nonMatchingExplicit=0,unknown=false;
  ((item&&item.batches)||[]).forEach(function(batch){
    var q=batch&&batch.qty==null?null:fsR6N(batch.qty);
    if(String(batch&&batch.expiry||'')===String(oldDate||'')){
      matching.push(batch);
      if(q===null)unknown=true;else matchingExplicit+=q;
    }else if(q!==null)nonMatchingExplicit+=q;
  });
  var capacity=Math.max(0,present-nonMatchingExplicit);
  var maxQty=matchingExplicit>0?Math.min(matchingExplicit,capacity,required||matchingExplicit):Math.min(capacity,required||capacity);
  if(unknown&&maxQty<=0&&present>0&&nonMatchingExplicit===0)maxQty=Math.min(present,required||present);
  return {matching:matching,maxQty:Math.max(0,maxQty),present:present,required:required};
}
function fsR6CrashSeedTemplates(){
  var filter=fsR6CrashFilter(),carts=fsR6CrashCarts(),map={};
  FS_R6_CRASH_SELECTED.forEach(function(value,key){
    var parts=key.split('::'),cart=carts.find(function(c){return String(c.id)===parts[0]});
    if(!cart)return;
    var item=(cart.items||[]).find(function(x){return String(x.id)===parts.slice(1).join('::')});
    if(!item)return;
    ((item.batches)||[]).forEach(function(batch){
      if(fsR6CrashBatchLevel(batch)!==filter||!batch.expiry)return;
      var medKey=fsR6CrashMedicineKey(item),templateKey=medKey+'|'+String(batch.expiry);
      if(!map[templateKey])map[templateKey]={key:templateKey,medicineKey:medKey,name:fsR6CrashItemName(item),strength:item.strength||item.concentration||'',oldDate:String(batch.expiry)};
    });
  });
  return Object.keys(map).map(function(k){return map[k]});
}
function fsR6CrashEligibleGroups(templates){
  var groups=[];
  fsR6CrashCarts().forEach(function(cart){
    var rows=[],seen={};
    (cart.items||[]).forEach(function(item){
      var medKey=fsR6CrashMedicineKey(item);
      templates.forEach(function(t){
        if(t.medicineKey!==medKey)return;
        var info=fsR6CrashExactInfo(item,t.oldDate);
        var rowKey=String(item.id)+'|'+t.oldDate;
        if(info.matching.length&&info.maxQty>0&&!seen[rowKey]){
          seen[rowKey]=true;
          rows.push({item:item,template:t,info:info});
        }
      });
    });
    if(rows.length)groups.push({cart:cart,rows:rows});
  });
  return groups;
}
function fsR6CrashUpdateButton(){
  var btn=fsR6E('fsr6-crash-open'),count=fsR6E('fsr6-crash-count'),allowed=fsR6CrashSelectionAllowed(fsR6CrashFilter())&&fsR6CrashCanBulk();
  if(btn){btn.disabled=!allowed||FS_R6_CRASH_SELECTED.size===0;btn.style.display=allowed?'inline-flex':'none'}
  if(count)count.textContent=FS_R6_CRASH_SELECTED.size?FS_R6_CRASH_SELECTED.size+' selected / محدد':'0 selected';
}
function fsR6CrashSelectAllFiltered(){
  var filter=fsR6CrashFilter();
  if(!fsR6CrashSelectionAllowed(filter))return fsR6Toast('Choose Expired, Urgent, or Near-expiry first.','info');
  fsR6CrashCarts().forEach(function(cart){
    fsR6CrashVisibleItems(cart,filter).forEach(function(item){
      if((item.batches||[]).some(function(b){return fsR6CrashBatchLevel(b)===filter&&b.expiry}))FS_R6_CRASH_SELECTED.set(fsR6CrashKey(cart.id,item.id),true);
    });
  });
  window.refreshCrashBulkUi();
}
function fsR6CrashClearSelection(){FS_R6_CRASH_SELECTED.clear();window.refreshCrashBulkUi()}
window.refreshCrashBulkUi=function(){
  fsR6EnsureStyles();
  var filter=fsR6CrashFilter();
  if(filter!==FS_R6_CRASH_FILTER){FS_R6_CRASH_SELECTED.clear();FS_R6_CRASH_FILTER=filter}
  var toolbar=fsR6E('ccx-filters')||fsR6E('v13-crash-filters');
  if(toolbar&&fsR6CrashCanBulk()){
    var actions=fsR6E('fsr6-crash-actions');
    if(!actions){
      actions=document.createElement('div');actions.id='fsr6-crash-actions';
      actions.innerHTML='<button type="button" class="btn bg bsm" id="fsr6-crash-select-all">Select all filtered medicines / تحديد كل أدوية الفلتر</button>'+
        '<button type="button" class="btn bg bsm" id="fsr6-crash-clear">Clear selection / إلغاء التحديد</button>'+
        '<span class="chip" id="fsr6-crash-count">0 selected</span>'+
        '<button type="button" class="btn bs bsm" id="fsr6-crash-open">↻ Open selected & bulk replacement / فتح واستبدال جماعي</button>';
      toolbar.appendChild(actions);
      fsR6E('fsr6-crash-select-all').onclick=fsR6CrashSelectAllFiltered;
      fsR6E('fsr6-crash-clear').onclick=fsR6CrashClearSelection;
      fsR6E('fsr6-crash-open').onclick=window.openCrashCartSmartBulkReplacement;
    }
  }
  if(!fsR6CrashSelectionAllowed(filter)||!fsR6CrashCanBulk()){fsR6CrashUpdateButton();return}
  fsR6CrashCarts().forEach(function(cart){
    var card=fsR6E('ccx-cart-'+cart.id),table=card&&card.querySelector('.ccx-table');
    if(!table)return;
    var items=fsR6CrashVisibleItems(cart,filter),head=table.querySelector('thead tr'),rows=Array.from(table.querySelectorAll('tbody tr'));
    if(!head||rows.length!==items.length)return;
    var th=head.querySelector('.fsr6-select-col');
    if(!th){
      th=document.createElement('th');th.className='fsr6-select-col';
      th.innerHTML='<input type="checkbox" class="fsr6-cart-all" title="Select all filtered medicines in this cart">';
      head.insertBefore(th,head.firstChild);
    }
    var all=th.querySelector('input');
    all.onchange=function(){
      items.forEach(function(item){
        var k=fsR6CrashKey(cart.id,item.id);
        if(all.checked)FS_R6_CRASH_SELECTED.set(k,true);else FS_R6_CRASH_SELECTED.delete(k);
      });
      window.refreshCrashBulkUi();
    };
    rows.forEach(function(row,index){
      var item=items[index],k=fsR6CrashKey(cart.id,item.id),cell=row.querySelector('.fsr6-select-col');
      if(!cell){cell=document.createElement('td');cell.className='fsr6-select-col';cell.innerHTML='<input type="checkbox" class="fsr6-row-check">';row.insertBefore(cell,row.firstChild)}
      var cb=cell.querySelector('input');
      cb.checked=FS_R6_CRASH_SELECTED.has(k);
      row.classList.toggle('fsr6-selected',cb.checked);
      cb.onchange=function(){
        if(cb.checked)FS_R6_CRASH_SELECTED.set(k,true);else FS_R6_CRASH_SELECTED.delete(k);
        row.classList.toggle('fsr6-selected',cb.checked);
        all.checked=items.length>0&&items.every(function(x){return FS_R6_CRASH_SELECTED.has(fsR6CrashKey(cart.id,x.id))});
        fsR6CrashUpdateButton();
      };
    });
    all.checked=items.length>0&&items.every(function(x){return FS_R6_CRASH_SELECTED.has(fsR6CrashKey(cart.id,x.id))});
  });
  fsR6CrashUpdateButton();
};
function fsR6CrashCloseModal(){
  var m=fsR6E('fsr6-crash-modal');if(m)m.remove();
  FS_R6_CRASH_WORKFLOW=null;
}
function fsR6CrashStatus(message,kind){
  var x=fsR6E('fsr6-status');if(x){x.textContent=message||'';x.className='fsr6-status '+(kind||'')}
}
function fsR6CrashUid(prefix){
  return String(prefix||'id')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
}
function fsR6CrashClone(value){return JSON.parse(JSON.stringify(value))}
function fsR6CrashFutureDate(value){
  var d=new Date(String(value||'')+'T00:00:00'),today=new Date();today.setHours(0,0,0,0);
  return !!value&&!isNaN(d.getTime())&&d>today;
}
function fsR6CrashCreateAllocation(qty){
  return {id:fsR6CrashUid('alloc'),expiry:'',qty:qty==null?'':qty,lot:''};
}
function fsR6CrashCreateWorkflow(templates,groups){
  var plans=templates.map(function(template){
    var carts=[];
    groups.forEach(function(group){
      group.rows.forEach(function(row){
        if(row.template.key!==template.key)return;
        carts.push({
          cartId:String(group.cart.id),itemId:String(row.item.id),selected:true,
          maxQty:fsR6N(row.info.maxQty),removeQty:fsR6N(row.info.maxQty),
          allocationMode:'common',customAllocations:[]
        });
      });
    });
    var quantities=carts.map(function(x){return x.removeQty}),same=quantities.length&&quantities.every(function(x){return x===quantities[0]});
    return {
      id:fsR6CrashUid('plan'),enabled:true,template:fsR6CrashClone(template),
      commonAllocations:[fsR6CrashCreateAllocation(same?quantities[0]:'')],carts:carts
    };
  });
  return {id:fsR6CrashUid('workflow'),plans:plans,review:{},note:''};
}
function fsR6CrashFindPlan(planId){
  return FS_R6_CRASH_WORKFLOW&&(FS_R6_CRASH_WORKFLOW.plans||[]).find(function(x){return x.id===planId});
}
function fsR6CrashFindCartPlan(plan,cartId){
  return plan&&(plan.carts||[]).find(function(x){return String(x.cartId)===String(cartId)});
}
function fsR6CrashActiveAllocations(plan,cartPlan){
  return cartPlan&&cartPlan.allocationMode==='custom'?cartPlan.customAllocations:plan.commonAllocations;
}
function fsR6CrashAllocationTotal(allocations){
  return (allocations||[]).reduce(function(sum,x){return sum+fsR6N(x.qty)},0);
}
function fsR6CrashEnsureCustomAllocations(plan,cartPlan){
  if((cartPlan.customAllocations||[]).length)return;
  cartPlan.customAllocations=(plan.commonAllocations||[]).map(function(x){
    return {id:fsR6CrashUid('alloc'),expiry:x.expiry||'',qty:x.qty,lot:x.lot||''};
  });
  if(!cartPlan.customAllocations.length)cartPlan.customAllocations=[fsR6CrashCreateAllocation(cartPlan.removeQty)];
}
function fsR6CrashAllocationRows(planId,cartId,allocations){
  var scope=cartId?'custom':'common';
  return (allocations||[]).map(function(a,index){
    return '<div class="fsr6-alloc-row" data-plan="'+fsR6Esc(planId)+'" data-cart="'+fsR6Esc(cartId||'')+'" data-allocation="'+fsR6Esc(a.id)+'">'+
      '<div class="fg"><label>New expiry '+(index+1)+' / تاريخ الصلاحية الجديد</label><input class="fsr6-alloc-expiry" type="date" value="'+fsR6Esc(a.expiry||'')+'"></div>'+
      '<div class="fg"><label>Quantity / الكمية</label><input class="fsr6-alloc-qty" type="number" min="0.01" step="any" value="'+fsR6Esc(a.qty)+'"></div>'+
      '<div class="fg"><label>Batch/Lot optional / التشغيلة اختيارية</label><input class="fsr6-alloc-lot" value="'+fsR6Esc(a.lot||'')+'" placeholder="Optional"></div>'+
      '<button class="btn bd2c bsm fsr6-remove-alloc" type="button" data-action="remove-allocation" data-scope="'+scope+'">Remove / حذف</button></div>';
  }).join('');
}
function fsR6CrashPlanHtml(plan){
  var t=plan.template;
  var carts=(plan.carts||[]).map(function(cp){
    var cart=fsR6CrashCarts().find(function(c){return String(c.id)===String(cp.cartId)})||{};
    var custom=cp.allocationMode==='custom';
    return '<div class="fsr6-cart-plan" data-plan="'+fsR6Esc(plan.id)+'" data-cart="'+fsR6Esc(cp.cartId)+'">'+
      '<div class="fsr6-cart-plan-head">'+
      '<label class="fsr6-confirm-label"><input class="fsr6-plan-cart-check" type="checkbox" '+(cp.selected?'checked':'')+'>Include / تضمين</label>'+
      '<div><b>'+fsR6Esc(cart.name||cart.number||cp.cartId)+'</b><div class="fhint">'+fsR6Esc(window.floorstockDepartmentName?window.floorstockDepartmentName(cart.deptId):cart.deptId)+' · Current seal: '+fsR6Esc(cart.seal||'—')+' · Exact available: '+cp.maxQty+'</div></div>'+
      '<div class="fg"><label>Replace qty / كمية الاستبدال</label><input class="fsr6-remove-qty" type="number" min="0.01" max="'+cp.maxQty+'" step="any" value="'+fsR6Esc(cp.removeQty)+'" '+(cp.selected?'':'disabled')+'></div>'+
      '<div class="fg"><label>Date rule / قاعدة التواريخ</label><select class="fsr6-allocation-mode" '+(cp.selected?'':'disabled')+'><option value="common" '+(!custom?'selected':'')+'>Use this medicine dates / تواريخ هذا العلاج</option><option value="custom" '+(custom?'selected':'')+'>Cart exception / استثناء للعربة</option></select></div></div>'+
      (custom?'<div class="fsr6-cart-custom"><div class="fsr6-alloc-head"><b>Dates only for this cart / تواريخ خاصة بهذه العربة</b><button class="btn bg bsm" type="button" data-action="add-custom-allocation" data-plan="'+fsR6Esc(plan.id)+'" data-cart="'+fsR6Esc(cp.cartId)+'">+ Add date / إضافة تاريخ</button></div><div class="fsr6-alloc-list">'+fsR6CrashAllocationRows(plan.id,cp.cartId,cp.customAllocations)+'</div></div>':'')+
      '</div>';
  }).join('');
  return '<section class="fsr6-plan '+(plan.enabled?'':'off')+'" data-plan="'+fsR6Esc(plan.id)+'">'+
    '<div class="fsr6-plan-head"><label class="fsr6-confirm-label"><input class="fsr6-plan-enabled" type="checkbox" '+(plan.enabled?'checked':'')+'>Include medicine / تضمين العلاج</label>'+
    '<div><div class="fsr6-plan-title">'+fsR6Esc(t.name)+(t.strength?' · '+fsR6Esc(t.strength):'')+'</div><div class="fsr6-plan-meta">Old expiry / التاريخ القديم: '+fsR6Esc(t.oldDate)+' · '+plan.carts.length+' eligible cart(s)</div></div>'+
    '<div class="fsr6-plan-actions"><button class="btn bg bsm" type="button" data-action="select-plan-carts">Select all carts</button><button class="btn bg bsm" type="button" data-action="clear-plan-carts">Clear carts</button></div></div>'+
    '<div class="fsr6-plan-body"><div class="fsr6-alloc-box"><div class="fsr6-alloc-head"><div><b>Replacement dates for this medicine only / تواريخ الاستبدال لهذا العلاج فقط</b><div class="fhint">These dates apply to selected carts using “medicine dates”. Add more than one date to split the quantity.</div></div><button class="btn bg bsm" type="button" data-action="add-common-allocation">+ Add date / إضافة تاريخ</button></div><div class="fsr6-alloc-list">'+fsR6CrashAllocationRows(plan.id,'',plan.commonAllocations)+'</div></div>'+carts+'</div></section>';
}
function fsR6CrashRenderPlans(){
  var host=fsR6E('fsr6-plan-host');if(!host||!FS_R6_CRASH_WORKFLOW)return;
  host.innerHTML=(FS_R6_CRASH_WORKFLOW.plans||[]).map(fsR6CrashPlanHtml).join('')||'<div class="fsr6-empty">No medication plans.</div>';
}
function fsR6CrashReviewData(){
  var map={};if(!FS_R6_CRASH_WORKFLOW)return [];
  (FS_R6_CRASH_WORKFLOW.plans||[]).forEach(function(plan){
    if(!plan.enabled)return;
    (plan.carts||[]).forEach(function(cp){
      if(!cp.selected)return;
      var cart=fsR6CrashCarts().find(function(c){return String(c.id)===String(cp.cartId)})||{};
      if(!map[cp.cartId])map[cp.cartId]={cartId:cp.cartId,cart:cart,lines:[]};
      map[cp.cartId].lines.push({
        planId:plan.id,itemId:cp.itemId,name:plan.template.name,strength:plan.template.strength||'',
        oldDate:plan.template.oldDate,removeQty:fsR6N(cp.removeQty),
        allocations:fsR6CrashClone(fsR6CrashActiveAllocations(plan,cp)||[])
      });
    });
  });
  return Object.keys(map).map(function(k){
    if(!FS_R6_CRASH_WORKFLOW.review[k])FS_R6_CRASH_WORKFLOW.review[k]={confirmed:true,newSeal:''};
    map[k].review=FS_R6_CRASH_WORKFLOW.review[k];return map[k];
  });
}
function fsR6CrashRenderReview(){
  var host=fsR6E('fsr6-review-host');if(!host)return;
  var data=fsR6CrashReviewData();
  if(!data.length){host.innerHTML='<div class="fsr6-empty">Select at least one cart under a medicine plan to build the final review.</div>';return}
  host.innerHTML=data.map(function(entry){
    var cart=entry.cart||{},review=entry.review||{},lines=entry.lines.map(function(line){
      var dates=(line.allocations||[]).map(function(a){return fsR6Esc(a.expiry||'No date')+' × '+fsR6N(a.qty)+(a.lot?' · '+fsR6Esc(a.lot):'')}).join(' + ');
      return '<div class="fsr6-review-line"><b>'+fsR6Esc(line.name)+(line.strength?' · '+fsR6Esc(line.strength):'')+'</b><br>Remove: '+line.removeQty+' from '+fsR6Esc(line.oldDate)+' → Replace: '+dates+'</div>';
    }).join('');
    return '<section class="fsr6-review-card '+(review.newSeal?'ready':'pending')+'" data-cart="'+fsR6Esc(entry.cartId)+'"><div class="fsr6-review-head">'+
      '<span class="chip">Seal review / مراجعة القفل</span>'+
      '<div><b>'+fsR6Esc(cart.name||cart.number||entry.cartId)+'</b><div class="fhint">'+fsR6Esc(window.floorstockDepartmentName?window.floorstockDepartmentName(cart.deptId):cart.deptId)+' · '+entry.lines.length+' medicine plan(s)<br>Current seal: <b>'+fsR6Esc(cart.seal||'—')+'</b></div></div>'+
      '<div class="fsr6-review-seal"><label>New unique seal / القفل الجديد الفريد</label><input class="fsr6-seal-input" value="'+fsR6Esc(review.newSeal||'')+'" data-old="'+fsR6Esc(cart.seal||'')+'" placeholder="Required and never used"></div></div><div class="fsr6-review-lines">'+lines+'</div></section>';
  }).join('');
  fsR6CrashValidateReview(false);
}
function fsR6CrashRenderWorkflow(){fsR6CrashRenderPlans();fsR6CrashRenderReview()}
function fsR6CrashAllocationByInput(input){
  var row=input.closest('.fsr6-alloc-row');if(!row)return null;
  var plan=fsR6CrashFindPlan(row.dataset.plan);if(!plan)return null;
  var cp=row.dataset.cart?fsR6CrashFindCartPlan(plan,row.dataset.cart):null;
  var list=cp?cp.customAllocations:plan.commonAllocations;
  return {plan:plan,cartPlan:cp,list:list,allocation:(list||[]).find(function(x){return x.id===row.dataset.allocation})};
}
function fsR6CrashHandlePlanInput(input){
  var planNode=input.closest('[data-plan]'),plan=planNode&&fsR6CrashFindPlan(planNode.dataset.plan);if(!plan)return;
  var cartNode=input.closest('[data-cart]'),cp=cartNode&&cartNode.dataset.cart?fsR6CrashFindCartPlan(plan,cartNode.dataset.cart):null;
  if(input.classList.contains('fsr6-plan-enabled')){plan.enabled=input.checked;fsR6CrashRenderWorkflow();return}
  if(input.classList.contains('fsr6-plan-cart-check')&&cp){cp.selected=input.checked;fsR6CrashRenderWorkflow();return}
  if(input.classList.contains('fsr6-remove-qty')&&cp){cp.removeQty=input.value;fsR6CrashRenderReview();return}
  if(input.classList.contains('fsr6-allocation-mode')&&cp){cp.allocationMode=input.value;if(cp.allocationMode==='custom')fsR6CrashEnsureCustomAllocations(plan,cp);fsR6CrashRenderWorkflow();return}
  var ref=fsR6CrashAllocationByInput(input);if(!ref||!ref.allocation)return;
  if(input.classList.contains('fsr6-alloc-expiry'))ref.allocation.expiry=input.value;
  if(input.classList.contains('fsr6-alloc-qty'))ref.allocation.qty=input.value;
  if(input.classList.contains('fsr6-alloc-lot'))ref.allocation.lot=input.value;
  fsR6CrashRenderReview();
}
function fsR6CrashHandlePlanAction(button){
  var action=button.dataset.action,planNode=button.closest('[data-plan]'),plan=planNode&&fsR6CrashFindPlan(planNode.dataset.plan);if(!plan)return;
  if(action==='select-plan-carts'){plan.carts.forEach(function(x){x.selected=true})}
  else if(action==='clear-plan-carts'){plan.carts.forEach(function(x){x.selected=false})}
  else if(action==='add-common-allocation'){plan.commonAllocations.push(fsR6CrashCreateAllocation(''))}
  else if(action==='add-custom-allocation'){
    var cp=fsR6CrashFindCartPlan(plan,button.dataset.cart);if(cp){fsR6CrashEnsureCustomAllocations(plan,cp);cp.customAllocations.push(fsR6CrashCreateAllocation(''))}
  }else if(action==='remove-allocation'){
    var row=button.closest('.fsr6-alloc-row'),cp=row.dataset.cart?fsR6CrashFindCartPlan(plan,row.dataset.cart):null,list=cp?cp.customAllocations:plan.commonAllocations;
    if(list.length<=1)return fsR6CrashStatus('Each date plan must keep at least one row.','err');
    var index=list.findIndex(function(x){return x.id===row.dataset.allocation});if(index>=0)list.splice(index,1);
  }
  fsR6CrashRenderWorkflow();
}
function fsR6CrashUsedSeals(){
  var used={};
  fsR6CrashCarts().forEach(function(c){var s=String(c.seal||'').trim();if(s)used[s.toLowerCase()]=true});
  if(typeof window.crashReports==='function')(window.crashReports()||[]).forEach(function(r){[r.oldSeal,r.newSeal].forEach(function(v){v=String(v||'').trim();if(v)used[v.toLowerCase()]=true})});
  return used;
}
function fsR6CrashValidateReview(showMessage){
  if(!FS_R6_CRASH_WORKFLOW)return false;
  var seen={},used=fsR6CrashUsedSeals(),ok=true,first='',firstCard=null;
  fsR6CrashReviewData().forEach(function(entry){
    var review=entry.review||{},seal=String(review.newSeal||'').trim(),key=seal.toLowerCase(),old=String(entry.cart&&entry.cart.seal||'').trim().toLowerCase(),reason='';
    if(!seal)reason='enter a new seal';
    else if(key===old)reason='the new seal must be different from the current seal';
    else if(seen[key])reason='this seal is duplicated within the selected carts';
    else if(used[key])reason='this seal is already used in a cart or an earlier opening record';
    if(key)seen[key]=true;
    var badSeal=!!reason;
    review.confirmed=!badSeal;
    var card=document.querySelector('#fsr6-review-host [data-cart="'+CSS.escape(String(entry.cartId))+'"]');
    if(card){
      var input=card.querySelector('.fsr6-seal-input');
      if(input)input.classList.toggle('fsr6-invalid',badSeal);
      card.classList.toggle('ready',!badSeal);
      card.classList.toggle('pending',badSeal);
    }
    if(badSeal){
      ok=false;
      if(!first){
        var cartName=(entry.cart&&(entry.cart.name||entry.cart.number))||entry.cartId;
        first='Cart "'+cartName+'": '+reason+'. / العربة "'+cartName+'": أدخل رقم قفل جديداً وفريداً وغير مستخدم.';
        firstCard=card;
      }
    }
  });
  FS_R6_CRASH_WORKFLOW.reviewError=first;
  if(showMessage&&!ok){
    fsR6CrashStatus(first,'err');
    if(firstCard){
      try{firstCard.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){firstCard.scrollIntoView()}
      var firstInput=firstCard.querySelector('.fsr6-seal-input');if(firstInput)firstInput.focus();
    }
  }
  return ok;
}
function fsR6CrashCompileWorkflow(){
  var errors=[],cartMap={},enabledPlans=0;
  if(!FS_R6_CRASH_WORKFLOW)return {ok:false,errors:['Replacement workflow is not available.'],carts:[]};
  (FS_R6_CRASH_WORKFLOW.plans||[]).forEach(function(plan){
    if(!plan.enabled)return;enabledPlans++;
    var selected=(plan.carts||[]).filter(function(x){return x.selected});
    if(!selected.length){errors.push(plan.template.name+': select at least one cart.');return}
    selected.forEach(function(cp){
      var removeQty=fsR6N(cp.removeQty),allocations=fsR6CrashActiveAllocations(plan,cp)||[];
      if(!(removeQty>0)||removeQty>fsR6N(cp.maxQty))errors.push(plan.template.name+': invalid quantity for a selected cart.');
      if(!allocations.length)errors.push(plan.template.name+': add at least one replacement date.');
      allocations.forEach(function(a){if(!(fsR6N(a.qty)>0))errors.push(plan.template.name+': every replacement date needs a positive quantity.');if(!fsR6CrashFutureDate(a.expiry))errors.push(plan.template.name+': every replacement date must be after today.')});
      if(Math.abs(fsR6CrashAllocationTotal(allocations)-removeQty)>.0001)errors.push(plan.template.name+': replacement-date quantities must total '+removeQty+'.');
      if(!cartMap[cp.cartId])cartMap[cp.cartId]={cartId:cp.cartId,lines:[]};
      cartMap[cp.cartId].lines.push({planId:plan.id,itemId:cp.itemId,medicineKey:plan.template.medicineKey,name:plan.template.name,strength:plan.template.strength||'',oldDate:plan.template.oldDate,removeQty:removeQty,allocations:fsR6CrashClone(allocations)});
    });
  });
  if(!enabledPlans)errors.push('Include at least one medicine plan.');
  var carts=Object.keys(cartMap).map(function(cartId){var review=FS_R6_CRASH_WORKFLOW.review[cartId]||{};cartMap[cartId].newSeal=String(review.newSeal||'').trim();cartMap[cartId].confirmed=true;return cartMap[cartId]});
  if(!carts.length)errors.push('Select at least one cart.');
  if(!fsR6CrashValidateReview(false))errors.push(FS_R6_CRASH_WORKFLOW.reviewError||'Enter a new unique seal for every selected cart.');
  return {ok:errors.length===0,errors:errors,carts:carts,note:String(FS_R6_CRASH_WORKFLOW.note||'').trim()};
}
function fsR6CrashNormalizeAllocations(allocations){
  var map={};(allocations||[]).forEach(function(a){var expiry=String(a.expiry||''),lot=String(a.lot||'').trim(),key=expiry+'|'+lot.toLowerCase();if(!map[key])map[key]={expiry:expiry,lot:lot,qty:0};map[key].qty+=fsR6N(a.qty)});return Object.keys(map).map(function(k){return map[k]});
}
function fsR6ApplyExactReplacementAllocations(item,oldDate,removeQty,allocations,reportId,stamp,actorUser){
  removeQty=Math.max(0,fsR6N(removeQty));
  var info=fsR6CrashExactInfo(item,oldDate);
  if(!(removeQty>0)||removeQty>info.maxQty)throw new Error('Replacement quantity is outside the allowed range.');
  var normalized=fsR6CrashNormalizeAllocations(allocations);
  if(Math.abs(fsR6CrashAllocationTotal(normalized)-removeQty)>.0001)throw new Error('Replacement allocations do not equal the removed quantity.');
  var remaining=removeQty,next=[],old=[];
  ((item.batches)||[]).forEach(function(batch){
    if(String(batch.expiry||'')!==String(oldDate)){next.push(Object.assign({},batch));return}
    old.push(Object.assign({},batch));if(remaining<=0){next.push(Object.assign({},batch));return}
    if(batch.qty==null){remaining=0;return}
    var q=fsR6N(batch.qty),take=Math.min(q,remaining),left=q-take;remaining-=take;if(left>0)next.push(Object.assign({},batch,{qty:left}));
  });
  if(remaining>.0001)throw new Error('The exact selected expiry quantity could not be matched.');
  normalized.forEach(function(a){var batchId=fsR6CrashUid('ccb');next.push({id:batchId,batchId:batchId,qty:a.qty,expiry:a.expiry,lot:a.lot||'',source:'pharmacy_smart_cross_cart_replacement',sourceReportId:reportId,replacedExpiry:oldDate,updatedAt:stamp,updatedBy:actorUser})});
  next.sort(function(a,b){return String(a.expiry||'').localeCompare(String(b.expiry||''))});item.batches=next;
  return {itemId:item.id||'',name:fsR6CrashItemName(item),strength:item.strength||item.concentration||'',oldExpiry:oldDate,oldBatches:old,removedQty:removeQty,allocations:normalized};
}
function fsR6CrashBuildBulkResult(originalCarts,originalReports,compiled){
  var carts=fsR6CrashClone(originalCarts),reports=fsR6CrashClone(originalReports),actor=fsR6Actor(),stamp=fsR6Now(),bulkId='ccsmart_'+Date.now().toString(36),verification=[],createdReports=[];
  compiled.carts.forEach(function(cartPlan,index){
    var cart=carts.find(function(c){return String(c.id)===String(cartPlan.cartId)});if(!cart)throw new Error('Crash Cart not found: '+cartPlan.cartId);
    if(reports.some(function(r){return String(r.cartId)===String(cart.id)&&r.status==='open'}))throw new Error((cart.name||'Crash Cart')+' has an open report. Close it first.');
    var oldSeal=String(cart.seal||''),reportId='ccr_smart_'+Date.now().toString(36)+'_'+index+'_'+Math.random().toString(36).slice(2,7),replacements=[];
    cartPlan.lines.forEach(function(line){
      var item=(cart.items||[]).find(function(x){return String(x.id)===String(line.itemId)});if(!item)throw new Error('Medicine no longer exists in '+(cart.name||cart.id));
      if(fsR6CrashMedicineKey(item)!==line.medicineKey)throw new Error('Medicine identity changed in '+(cart.name||cart.id)+'. Reopen the workflow.');
      var detail=fsR6ApplyExactReplacementAllocations(item,line.oldDate,line.removeQty,line.allocations,reportId,stamp,actor.user);replacements.push(detail);
      verification.push({cartId:cart.id,itemId:item.id,reportId:reportId,allocations:detail.allocations});
    });
    cart.seal=cartPlan.newSeal;cart.updatedAt=stamp;cart.updatedBy=actor.name;cart.lastOpenedAt=stamp;cart.lastOpenedByName=actor.name;cart.lastOpenedByUser=actor.user;cart.lastOpenedByRole=actor.role;cart.lastOpenReason='Smart cross-cart expiry replacement initiated by pharmacy';cart.lastClosedAt=stamp;cart.lastClosedByName=actor.name;cart.lastClosedByUser=actor.user;
    var openingReport={id:reportId,cartId:cart.id,deptId:cart.deptId,status:'closed',type:'pharmacy_smart_cross_cart_replacement',operation:'open',openingLog:true,bulkOpen:true,pharmacyInitiated:true,bulkActionId:bulkId,reason:'Bulk opening and smart replacement / فتح جماعي واستبدال ذكي',openedAt:stamp,openedBy:actor.name,openedByName:actor.name,openedByUser:actor.user,openedById:actor.id,openedByRole:actor.role,closedAt:stamp,closedBy:actor.name,closedByName:actor.name,closedByUser:actor.user,closedById:actor.id,oldSeal:oldSeal,newSeal:cartPlan.newSeal,replacements:replacements,pharmacyNote:compiled.note,lastEditedAt:stamp,lastEditedByName:actor.name,lastEditedByUser:actor.user};reports.push(openingReport);createdReports.push(openingReport);
  });
  return {carts:carts,reports:reports,bulkId:bulkId,verification:verification,createdReports:createdReports};
}
function fsR6CrashVerifyPersisted(result,compiled){
  var carts=fsR6CrashCarts(),reports=typeof window.crashReports==='function'?(window.crashReports()||[]):[];
  for(var i=0;i<compiled.carts.length;i++){
    var cp=compiled.carts[i],cart=carts.find(function(c){return String(c.id)===String(cp.cartId)});if(!cart||String(cart.seal||'')!==String(cp.newSeal))return false;
  }
  for(var j=0;j<result.verification.length;j++){
    var v=result.verification[j],cart2=carts.find(function(c){return String(c.id)===String(v.cartId)}),item=cart2&&(cart2.items||[]).find(function(x){return String(x.id)===String(v.itemId)});if(!item)return false;
    var added=(item.batches||[]).filter(function(b){return String(b.sourceReportId||'')===String(v.reportId)}),expected=fsR6CrashAllocationTotal(v.allocations),actual=added.reduce(function(s,b){return s+fsR6N(b.qty)},0);if(Math.abs(expected-actual)>.0001)return false;
    if(!reports.some(function(r){return String(r.id)===String(v.reportId)}))return false;
  }
  return true;
}
window.openCrashCartSmartBulkReplacement=function(){
  if(!fsR6CrashCanBulk())return;
  var level=fsR6CrashFilter();if(!fsR6CrashSelectionAllowed(level))return fsR6Toast('Choose Expired, Urgent, or Near-expiry filter first.','info');
  var templates=fsR6CrashSeedTemplates();if(!templates.length)return fsR6Toast('Select one or more medicines with a dated batch.','err');
  var groups=fsR6CrashEligibleGroups(templates);if(!groups.length)return fsR6Toast('No carts have the same selected medicine, strength, and expiry date.','err');
  fsR6CrashCloseModal();FS_R6_CRASH_WORKFLOW=fsR6CrashCreateWorkflow(templates,groups);
  var seeds=templates.map(function(t){return '<span class="chip">'+fsR6Esc(t.name)+(t.strength?' · '+fsR6Esc(t.strength):'')+' · '+fsR6Esc(t.oldDate)+'</span>'}).join(' ');
  var html='<div class="modal-bg on" id="fsr6-crash-modal" role="dialog" aria-modal="true"><div class="modal fsr6-dialog">'+
    '<div class="fsr6-head"><div><div class="mt">Smart cross-cart replacement / الاستبدال الذكي بين العربات</div><div class="fhint">Each medicine, strength and old expiry has an independent plan. Dates never spill into another medicine plan.</div></div><button class="xbtn" id="fsr6-close" type="button">×</button></div>'+
    '<div class="fsr6-body"><div class="fsr6-seeds">'+seeds+'</div><div class="fsr6-workflow-note"><b>Workflow:</b> configure replacement dates under each medicine; select carts and any cart-specific exceptions; then enter one new unique seal for each cart below. A valid seal completes the review automatically.</div><div id="fsr6-plan-host"></div><div class="fsr6-review-title">Final cart review / المراجعة النهائية للعربات</div><div class="fhint" style="margin-bottom:8px">Read-only medicine summary. Enter a new unique seal for every cart; the window closes automatically only after the save and read-back verification succeed.</div><div id="fsr6-review-host"></div></div>'+
    '<div class="fsr6-footer"><div><label>Pharmacy note / ملاحظة الصيدلية</label><textarea id="fsr6-note" placeholder="Optional note"></textarea></div><div class="fsr6-actions"><span class="fsr6-status" id="fsr6-status"></span><button class="btn bg" id="fsr6-cancel" type="button">Cancel</button><button class="btn bs" id="fsr6-save" type="button">Validate and save / تحقق وحفظ</button></div></div></div></div>';
  document.body.insertAdjacentHTML('beforeend',html);fsR6EnsureStyles();fsR6CrashRenderWorkflow();
  fsR6E('fsr6-close').onclick=fsR6CrashCloseModal;fsR6E('fsr6-cancel').onclick=fsR6CrashCloseModal;fsR6E('fsr6-save').onclick=window.saveCrashCartSmartBulkReplacement;
  fsR6E('fsr6-note').oninput=function(){if(FS_R6_CRASH_WORKFLOW)FS_R6_CRASH_WORKFLOW.note=this.value};
  fsR6E('fsr6-plan-host').addEventListener('click',function(ev){var b=ev.target.closest('[data-action]');if(b)fsR6CrashHandlePlanAction(b)});
  fsR6E('fsr6-plan-host').addEventListener('change',function(ev){if(ev.target.matches('input,select'))fsR6CrashHandlePlanInput(ev.target)});
  fsR6E('fsr6-plan-host').addEventListener('input',function(ev){if(ev.target.matches('.fsr6-remove-qty,.fsr6-alloc-qty,.fsr6-alloc-lot'))fsR6CrashHandlePlanInput(ev.target)});
  fsR6E('fsr6-review-host').addEventListener('input',function(ev){var card=ev.target.closest('[data-cart]');if(!card||!FS_R6_CRASH_WORKFLOW)return;var review=FS_R6_CRASH_WORKFLOW.review[card.dataset.cart]||(FS_R6_CRASH_WORKFLOW.review[card.dataset.cart]={confirmed:true,newSeal:''});if(ev.target.classList.contains('fsr6-seal-input'))review.newSeal=ev.target.value;fsR6CrashValidateReview(false)});
  fsR6E('fsr6-crash-modal').onclick=function(ev){if(ev.target===this)fsR6CrashCloseModal()};
};
window.saveCrashCartSmartBulkReplacement=async function(){
  var save=fsR6E('fsr6-save'),compiled=fsR6CrashCompileWorkflow();
  if(!compiled.ok)return fsR6CrashStatus(compiled.errors[0]||'The replacement plan is incomplete.','err');
  if(save){save.disabled=true;save.textContent='Saving… / جاري الحفظ'}fsR6CrashStatus('Validating exact dates, replacing, resealing and verifying persistence…','');
  var originalCarts=fsR6CrashClone(fsR6CrashCarts()),originalReports=fsR6CrashClone(typeof window.crashReports==='function'?(window.crashReports()||[]):[]),cartsSaved=false,reportsSaved=false;
  try{
    var result=fsR6CrashBuildBulkResult(originalCarts,originalReports,compiled);
    if(typeof window.setCrashCarts==='function'){await window.setCrashCarts(result.carts);cartsSaved=true}
    if(typeof window.setCrashReports==='function'){await window.setCrashReports(result.reports);reportsSaved=true}
    if(!fsR6CrashVerifyPersisted(result,compiled))throw new Error('Read-back verification failed. No completion was accepted.');
    await Promise.all((result.createdReports||[]).map(function(r){return fsR6Audit('crash_cart_open_report',{reportId:r.id,cartId:r.cartId,deptId:r.deptId,oldSeal:r.oldSeal,newSeal:r.newSeal,reason:r.reason,bulk:true,bulkActionId:result.bulkId,openedAt:r.openedAt})}));
    await fsR6Audit('crash_cart_smart_bulk_complete',{bulkActionId:result.bulkId,carts:compiled.carts.length,medicinePlans:(FS_R6_CRASH_WORKFLOW.plans||[]).filter(function(x){return x.enabled}).length,sourceSelection:FS_R6_CRASH_SELECTED.size,uniqueSeals:compiled.carts.map(function(x){return x.newSeal}),openingLogRecords:(result.createdReports||[]).length});
    FS_R6_CRASH_SELECTED.clear();fsR6CrashCloseModal();if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();fsR6Toast(compiled.carts.length+' Crash Cart(s) replaced, reviewed and resealed ✓ · '+result.bulkId,'succ');
  }catch(e){
    console.error(e);
    try{if(reportsSaved&&typeof window.setCrashReports==='function')await window.setCrashReports(originalReports)}catch(rollbackReportError){console.error('Crash report rollback failed',rollbackReportError)}
    try{if(cartsSaved&&typeof window.setCrashCarts==='function')await window.setCrashCarts(originalCarts)}catch(rollbackCartError){console.error('Crash Cart rollback failed',rollbackCartError)}
    fsR6CrashStatus('Save failed and rollback was attempted: '+String(e&&e.message||e),'err');if(save){save.disabled=false;save.textContent='Validate and save / تحقق وحفظ'}
  }
};

/* ---------- Master test mode without logout ---------- */

function fsR6ActualMaster(){
  if(window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true)return MASTER_ACTUAL;
  if(window.CU&&CU.master===true)return CU;
  return null;
}
function fsR6MasterUsers(){
  try{return typeof window.gu==='function'?(window.gu()||[]).filter(function(u){return u&&u.active!==false&&u.master!==true}):[]}catch(e){return []}
}
function fsR6RoleLabel(role){
  var labels={pharmacy:'Pharmacy Director / مدير الصيدلية',inpatient_supervisor:'Inpatient Pharmacy Supervisor / مشرف صيدلية التنويم',outpatient_pharmacy_supervisor:'Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية',pharmacy_staff:'Pharmacy Staff / موظف صيدلية',controlled_pharmacy:'Controlled Medicines Officer / مسؤول الأدوية المخدرة',warehouse:'Warehouse Custody Officer / مسؤول عهدة المستودع',department:'Department Employee / موظف قسم'};
  if(typeof window.masterRoleLabel==='function'){try{return window.masterRoleLabel(role)}catch(e){}}
  return labels[role]||role||'Unknown role';
}
function fsR6EnsureMasterModal(){
  var old=fsR6E('mmaster-role-r6');if(old)return old;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-bg" id="mmaster-role-r6"><div class="modal" style="width:720px;max-width:95vw">'+
    '<div class="mh"><span class="mt">Master Test Mode / وضع اختبار الماستر</span><button class="xbtn" type="button" data-master-test-action="close">×</button></div>'+
    '<div class="fsr6-master-grid"><div class="fg"><label>Test source / مصدر الاختبار</label><select id="fsr6-master-mode"><option value="user">Managed user / مستخدم موجود</option><option value="role">Role only / دور فقط</option></select></div>'+
    '<div class="fg" id="fsr6-master-user-wrap"><label>User / المستخدم</label><select id="fsr6-master-user"></select></div>'+
    '<div class="fg" id="fsr6-master-role-wrap"><label>Role / الدور</label><select id="fsr6-master-role"><option value="pharmacy">Pharmacy Director</option><option value="inpatient_supervisor">Inpatient Supervisor</option><option value="outpatient_pharmacy_supervisor">Outpatient Pharmacy Supervisor / مشرف الصيدلية الخارجية</option><option value="pharmacy_staff">Pharmacy Staff</option><option value="controlled_pharmacy">Controlled Medicines Officer</option><option value="warehouse">Warehouse Custody Officer</option><option value="department">Department Employee</option></select></div>'+
    '<div class="fg" id="fsr6-master-dept-wrap"><label>Department / القسم</label><select id="fsr6-master-dept"></select></div></div>'+
    '<div class="fsr6-master-preview" id="fsr6-master-preview"></div>'+
    '<div class="fl g8" style="justify-content:flex-end;margin-top:16px"><button class="btn bg" type="button" data-master-test-action="close">Cancel</button>'+
    '<button class="btn bd2c" type="button" id="fsr6-master-exit" data-master-test-action="exit">Exit Test Mode</button>'+
    '<button class="btn bp" type="button" data-master-test-action="apply">Start / Change Test</button></div></div></div>');
  var modal=fsR6E('mmaster-role-r6');
  modal.addEventListener('click',function(event){
    var button=event.target&&event.target.closest?event.target.closest('[data-master-test-action]'):null;
    if(!button||!modal.contains(button))return;
    event.preventDefault();
    var action=button.dataset.masterTestAction;
    if(action==='close')fsR6CloseModal('mmaster-role-r6');
    else if(action==='exit')window.masterResetRole();
    else if(action==='apply')window.masterApplyRole();
  });
  fsR6E('fsr6-master-mode').onchange=window.masterPreviewUser;
  fsR6E('fsr6-master-user').onchange=window.masterPreviewUser;
  fsR6E('fsr6-master-role').onchange=window.masterPreviewUser;
  fsR6E('fsr6-master-dept').onchange=window.masterPreviewUser;
  return fsR6E('mmaster-role-r6');
}
window.masterPreviewUser=function(){
  fsR6EnsureMasterModal();
  var mode=fsR6E('fsr6-master-mode').value,userWrap=fsR6E('fsr6-master-user-wrap'),roleWrap=fsR6E('fsr6-master-role-wrap');
  userWrap.style.display=mode==='user'?'block':'none';roleWrap.style.display=mode==='role'?'block':'none';
  var profile=null;
  if(mode==='user'){
    var id=fsR6E('fsr6-master-user').value;profile=fsR6MasterUsers().find(function(u){return String(u.id||u.uid)===String(id)});
  }else{
    profile={role:fsR6E('fsr6-master-role').value,deptId:fsR6E('fsr6-master-dept').value,username:'Role preview'};
  }
  var deptWrap=fsR6E('fsr6-master-dept-wrap'),role=profile&&profile.role||'';
  deptWrap.style.display=(role==='department'||role==='outpatient_pharmacy_supervisor')?'block':'none';
  var actual=fsR6ActualMaster()||{};
  fsR6E('fsr6-master-preview').innerHTML=profile?
    '<b>Effective role:</b> '+fsR6Esc(fsR6RoleLabel(role))+
    '<br><b>Tested user:</b> '+fsR6Esc(profile.email||profile.username||profile.displayName||profile.id||'Role preview')+
    ((role==='department'||role==='outpatient_pharmacy_supervisor')?'<br><b>Department:</b> '+fsR6Esc(window.floorstockDepartmentName?window.floorstockDepartmentName(profile.deptId||fsR6E('fsr6-master-dept').value):profile.deptId):'')+
    '<br><b>Actual authenticated master:</b> '+fsR6Esc(actual.email||actual.username||actual.id||'Master'):
    'No test target is available.';
};
window.openMasterRoleSwitch=function(){
  var actual=fsR6ActualMaster();
  if(!actual)return fsR6Toast('Only the actual signed-in Master can use test mode.','err');
  fsR6EnsureMasterModal();
  var users=fsR6MasterUsers(),userSelect=fsR6E('fsr6-master-user'),deptSelect=fsR6E('fsr6-master-dept');
  userSelect.innerHTML=users.length?users.map(function(u){
    return '<option value="'+fsR6Esc(u.id||u.uid)+'">'+fsR6Esc(u.email||u.username||u.displayName||u.id)+' — '+fsR6Esc(fsR6RoleLabel(u.role))+'</option>';
  }).join(''):'<option value="">No active managed users</option>';
  var deps=typeof window.gd==='function'?(window.gd()||[]):[];
  deptSelect.innerHTML=deps.map(function(d){return '<option value="'+fsR6Esc(d.id)+'">'+fsR6Esc(window.floorstockDepartmentName?window.floorstockDepartmentName(d):d.name||d.id)+'</option>'}).join('');
  var outpatientDept=deps.find(function(d){return /outpatient\s+department/i.test(String(d.name||d.nameEn||''))||String(d.id||'').toLowerCase()==='outpatient'});
  var roleSelect=fsR6E('fsr6-master-role');
  function constrainOutpatientDepartment(){
    var outpatient=roleSelect&&roleSelect.value==='outpatient_pharmacy_supervisor';
    if(outpatient&&outpatientDept){deptSelect.innerHTML='<option value="'+fsR6Esc(outpatientDept.id)+'">'+fsR6Esc(window.floorstockDepartmentName?window.floorstockDepartmentName(outpatientDept):outpatientDept.name||outpatientDept.id)+'</option>';deptSelect.value=String(outpatientDept.id)}
    else if(!outpatient){deptSelect.innerHTML=deps.map(function(d){return '<option value="'+fsR6Esc(d.id)+'">'+fsR6Esc(window.floorstockDepartmentName?window.floorstockDepartmentName(d):d.name||d.id)+'</option>'}).join('')}
    window.masterPreviewUser();
  }
  if(roleSelect&&!roleSelect.dataset.outpatientScopeBound){roleSelect.dataset.outpatientScopeBound='1';roleSelect.addEventListener('change',constrainOutpatientDepartment)}
  constrainOutpatientDepartment();
  fsR6E('fsr6-master-exit').style.display=window.MASTER_EFFECTIVE?'inline-flex':'none';
  window.masterPreviewUser();fsR6OpenModal('mmaster-role-r6');
};
window.fsR6ApplyMasterTestProfile=function(profile,meta){
  var actual=fsR6ActualMaster();
  if(!actual)throw new Error('Actual Master profile is unavailable.');
  if(!window.MASTER_ACTUAL)window.MASTER_ACTUAL=Object.assign({},actual);
  var role=fsR6S(profile.role,''),deptId=fsR6S(profile.deptId||profile.departmentId,'');
  var masterCrashSnapshot=null;
  if(window.S&&S.cache){var testDeptName=deptId&&window.floorstockDepartmentName?window.floorstockDepartmentName(deptId):'',testNorm=function(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()},testAliases=[deptId,testDeptName].map(testNorm).filter(Boolean),belongsTest=function(row){return [row&&row.deptId,row&&row.departmentId,row&&row.deptName,row&&row.departmentName,row&&row.department,row&&row.deptCode,row&&row.departmentCode,row&&row.unit].map(testNorm).some(function(v){return v&&testAliases.indexOf(v)>-1})},testCarts=(Array.isArray(S.cache.crash_carts)?S.cache.crash_carts:[]).filter(belongsTest),testIds=new Set(testCarts.map(function(c){return String(c.id||'')}));masterCrashSnapshot={carts:testCarts,reports:(Array.isArray(S.cache.crash_cart_reports)?S.cache.crash_cart_reports:[]).filter(function(r){return belongsTest(r)||testIds.has(String(r.cartId||''))})};}
  if((role==='department'||role==='outpatient_pharmacy_supervisor')&&!deptId)throw new Error('A department is required for this role.');
  window.MASTER_EFFECTIVE={
    mode:meta&&meta.mode||'user',testedUserId:profile.id||profile.uid||meta&&meta.testedUserId||'role:'+role,
    email:profile.email||profile.username||profile.displayName||'',role:role,deptId:deptId||null,
    deptName:deptId&&window.floorstockDepartmentName?window.floorstockDepartmentName(deptId):''
  };
  window.CU=Object.assign({},profile,{
    id:actual.id||actual.uid,uid:actual.uid||actual.id,authUid:actual.uid||actual.id,
    actualUserId:actual.id||actual.uid,actualEmail:actual.email||'',
    testedUserId:MASTER_EFFECTIVE.testedUserId,role:role,master:false,
    deptId:deptId||null,departmentId:deptId||null,
    deptName:deptId&&window.floorstockDepartmentName?window.floorstockDepartmentName(deptId):'',
    username:profile.username||profile.displayName||profile.email||fsR6RoleLabel(role)
  });
  /* Master Test Mode changes the effective identity without a new auth event.
     Re-apply the same department scope used at login so scoped pages receive
     the selected department's Crash Cart records immediately. */
  /* Keep the authenticated Master's complete read cache in Test Mode. The
     Crash Cart renderer applies the selected test-department scope; mutating
     the Master's cache here made repeated role previews lose carts for the
     remainder of the session. */
  fsR6Audit('master_test_mode_changed',{mode:MASTER_EFFECTIVE.mode,testedUserId:MASTER_EFFECTIVE.testedUserId,role:role,deptId:deptId||null,actualMasterId:actual.id||actual.uid});
  fsR6CloseModal('mmaster-role-r6');
  var restoreMasterCrash=function(){
    if(!window.MASTER_EFFECTIVE||!window.S||!S.cache)return;
    S.cache.crash_carts=masterCrashSnapshot.carts.slice();
    S.cache.crash_cart_reports=masterCrashSnapshot.reports.slice();
    if(typeof window.renderCrashCarts==='function')window.renderCrashCarts();
  };
  if(masterCrashSnapshot&&window.FSArchitecture&&typeof FSArchitecture.on==='function'){var offRestore=FSArchitecture.on('app:started',function(){offRestore();restoreMasterCrash()});}
  if(typeof window.startApp==='function')window.startApp();
  if(masterCrashSnapshot&&!window.FSArchitecture)setTimeout(restoreMasterCrash,10000);
  window.floorstockEnforceMasterSystemHealth();
  fsR6Toast('Test mode: '+fsR6RoleLabel(role)+(CU.deptName?' · '+CU.deptName:''),'info');
  return true;
};
window.masterApplyRole=function(){
  fsR6EnsureMasterModal();
  var mode=fsR6E('fsr6-master-mode').value,profile;
  if(mode==='user'){
    var id=fsR6E('fsr6-master-user').value;
    profile=fsR6MasterUsers().find(function(u){return String(u.id||u.uid)===String(id)});
    if(!profile)return fsR6Toast('Choose an active managed user.','err');
  }else{
    var role=fsR6E('fsr6-master-role').value,dept=(role==='department'||role==='outpatient_pharmacy_supervisor')?fsR6E('fsr6-master-dept').value:'';
    profile={id:'role:'+role,role:role,deptId:dept,username:'Role preview — '+fsR6RoleLabel(role),email:''};
  }
  try{return window.fsR6ApplyMasterTestProfile(profile,{mode:mode})}
  catch(e){return fsR6Toast(e&&e.message||String(e),'err')}
};
window.masterResetRole=function(){
  var actual=window.MASTER_ACTUAL;
  if(!actual){
    if(window.CU&&CU.master===true){window.MASTER_EFFECTIVE=null;fsR6CloseModal('mmaster-role-r6');window.floorstockEnforceMasterSystemHealth();return true}
    return fsR6Toast('Master profile is unavailable.','err');
  }
  var previous=window.MASTER_EFFECTIVE;
  window.CU=Object.assign({},actual);window.MASTER_EFFECTIVE=null;
  fsR6CloseModal('mmaster-role-r6');
  fsR6Audit('master_test_mode_exited',{previous:previous||null});
  if(typeof window.startApp==='function')window.startApp();
  window.floorstockEnforceMasterSystemHealth();
  fsR6Toast('Exited test mode — Master permissions restored.','succ');
  return true;
};
window.addMasterSwitchButton=function(){
  var actual=fsR6ActualMaster(),userNode=fsR6E('tuser'),top=userNode&&userNode.parentElement;
  if(typeof window.floorstockEnforceMasterSystemHealth==='function')window.floorstockEnforceMasterSystemHealth();
  if(!top)return false;
  var switchButton=fsR6E('master-switch-btn'),status=fsR6E('master-test-status'),exit=fsR6E('master-test-exit');
  if(!actual){
    if(switchButton)switchButton.remove();
    if(status)status.remove();
    if(exit)exit.remove();
    return false;
  }
  var anchor=fsR6E('themeBtn')||top.lastElementChild;
  if(window.MASTER_EFFECTIVE){
    var statusHtml='<strong>TEST MODE</strong><br>'+fsR6Esc(fsR6RoleLabel(MASTER_EFFECTIVE.role))+
      (MASTER_EFFECTIVE.deptName?'<br>'+fsR6Esc(MASTER_EFFECTIVE.deptName):'');
    if(!status){
      status=document.createElement('span');status.id='master-test-status';status.className='master-test-banner';
      top.insertBefore(status,anchor||null);
    }
    if(status.innerHTML!==statusHtml)status.innerHTML=statusHtml;
    if(!exit){
      exit=document.createElement('button');exit.id='master-test-exit';exit.type='button';exit.className='btn bg bsm master-test-exit';
      top.insertBefore(exit,anchor||null);
    }
    if(exit.textContent!=='Exit Test Mode')exit.textContent='Exit Test Mode';
    exit.onclick=window.masterResetRole;
  }else{
    if(status)status.remove();
    if(exit)exit.remove();
  }
  if(!switchButton){
    switchButton=document.createElement('button');switchButton.id='master-switch-btn';switchButton.type='button';switchButton.className='btn bg bsm';
    top.insertBefore(switchButton,anchor||null);
  }
  var switchText=window.MASTER_EFFECTIVE?'Change Test User / Role':'Test User / Role';
  if(switchButton.textContent!==switchText)switchButton.textContent=switchText;
  switchButton.onclick=window.openMasterRoleSwitch;
  return true;
};

/* ---------- System Health: actual Master only ---------- */

window.floorstockEnforceMasterSystemHealth=function(){
  var allowed=!!(window.CU&&CU.master===true&&!window.MASTER_EFFECTIVE);
  var page=fsR6E('pg-system-health');
  document.querySelectorAll('[data-pg="pg-system-health"],#system-health-nav,#master-health-nav').forEach(function(node){
    node.style.display=allowed?'':'none';node.setAttribute('aria-hidden',allowed?'false':'true');
  });
  if(page){
    page.style.display=allowed?'':'none';
    if(!allowed&&page.classList.contains('on')){
      page.classList.remove('on');
      if(typeof window.showPg==='function'){
        var fallback=CU&&CU.role==='department'?'pg-newreq':(CU&&['warehouse','controlled_pharmacy'].indexOf(CU.role)>=0?'pg-controlled':'pg-dash');
        try{window.showPg(fallback)}catch(e){}
      }
    }
  }
  return allowed;
};

function fsR6InitializeCanonical(){
  fsR6EnsureStyles();
  var oldModal=fsR6E('ccbx-bulk-modal');if(oldModal)oldModal.remove();
  var oldMaster=fsR6E('mmaster-role');if(oldMaster)oldMaster.remove();
  window.floorstockEnforceMasterSystemHealth();
  window.addMasterSwitchButton();
  window.refreshCrashBulkUi();
  var crashList=fsR6E('crash-list');
  if(crashList&&!window.__FS_R6_CRASH_OBSERVER__){
    var observerOptions={childList:true,subtree:true},observerQueued=false;
    function observeCrashList(){
      if(crashList&&document.documentElement.contains(crashList)){
        window.__FS_R6_CRASH_OBSERVER__.observe(crashList,observerOptions);
      }
    }
    window.__FS_R6_CRASH_OBSERVER__=new MutationObserver(function(){
      if(observerQueued)return;
      observerQueued=true;
      setTimeout(function(){
        window.__FS_R6_CRASH_OBSERVER__.disconnect();
        try{
          var page=fsR6E('pg-crashcart');
          if(page&&page.classList.contains('on'))window.refreshCrashBulkUi();
        }finally{
          observerQueued=false;
          observeCrashList();
        }
      },0);
    });
    observeCrashList();
  }
  if(!window.__FS_R6_CRASH_EVENTS__){
    window.__FS_R6_CRASH_EVENTS__=true;
    document.addEventListener('click',function(ev){
      var target=ev.target&&ev.target.closest?ev.target.closest('[data-pg="pg-crashcart"]'):null;
      if(target)setTimeout(function(){window.refreshCrashBulkUi()},0);
    },false);
    document.addEventListener('change',function(ev){
      var target=ev.target;
      if(target&&target.id==='ccx-expiry')setTimeout(function(){window.refreshCrashBulkUi()},0);
    },false);
  }
  if(!window.__FS_R6_EXIT_CAPTURE__){
    window.__FS_R6_EXIT_CAPTURE__=true;
    document.addEventListener('click',function(ev){
      var target=ev.target&&ev.target.closest?ev.target.closest('#master-test-exit,.master-test-exit,#fsr6-master-exit'):null;
      if(!target)return;
      ev.preventDefault();ev.stopImmediatePropagation();window.masterResetRole();
    },true);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fsR6InitializeCanonical,{once:true});
else setTimeout(fsR6InitializeCanonical,0);


const __asdhLegacyApi = {
  fsR5E: fsR5E,
  fsR5S: fsR5S,
  fsR5N: fsR5N,
  fsR5Esc: fsR5Esc,
  fsR5Toast: fsR5Toast,
  fsR5Norm: fsR5Norm,
  fsR5DepartmentRecords: fsR5DepartmentRecords,
  fsR5DepartmentCandidates: fsR5DepartmentCandidates,
  fsR5MedicineFlags: fsR5MedicineFlags,
  fsR5SelectedOrders: fsR5SelectedOrders,
  fsR5OrderRow: fsR5OrderRow,
  fsR5OrdersHtml: fsR5OrdersHtml,
  fsR5OrdersPrintData: fsR5OrdersPrintData,
  fsR5ControlledDept: fsR5ControlledDept,
  fsR5ControlledMedicine: fsR5ControlledMedicine,
  fsR5NormalizeControlled: fsR5NormalizeControlled,
  fsR5ControlledRows: fsR5ControlledRows,
  fsR5DMY: fsR5DMY,
  fsR12DateOnly: fsR12DateOnly,
  fsR12PrintDate: fsR12PrintDate,
  fsR12ExpiryDays: fsR12ExpiryDays,
  fsR12HasNearExpiry: fsR12HasNearExpiry,
  fsR12BatchLotHtml: fsR12BatchLotHtml,
  fsR12BatchExpiryHtml: fsR12BatchExpiryHtml,
  fsR5BatchText: fsR5BatchText,
  fsR5Class: fsR5Class,
  fsR5ExpiryDays: fsR5ExpiryDays,
  fsR5NearDays: fsR5NearDays,
  fsR5PublicUrl: fsR5PublicUrl,
  fsR5Logo: fsR5Logo,
  fsR5PrintSettings: fsR5PrintSettings,
  fsR5ControlledPrintHtml: fsR5ControlledPrintHtml,
  fsR6E: fsR6E,
  fsR6S: fsR6S,
  fsR6N: fsR6N,
  fsR6Esc: fsR6Esc,
  fsR6Norm: fsR6Norm,
  fsR6Toast: fsR6Toast,
  fsR6Now: fsR6Now,
  fsR6Actor: fsR6Actor,
  fsR6Audit: fsR6Audit,
  fsR6CloseModal: fsR6CloseModal,
  fsR6OpenModal: fsR6OpenModal,
  fsR6EnsureStyles: fsR6EnsureStyles,
  fsR6CrashCanBulk: fsR6CrashCanBulk,
  fsR6CrashCarts: fsR6CrashCarts,
  fsR6CrashFilter: fsR6CrashFilter,
  fsR6CrashRules: fsR6CrashRules,
  fsR6CrashDays: fsR6CrashDays,
  fsR6CrashBatchLevel: fsR6CrashBatchLevel,
  fsR6CrashItemLevel: fsR6CrashItemLevel,
  fsR6CrashItemName: fsR6CrashItemName,
  fsR6CrashMedicineKey: fsR6CrashMedicineKey,
  fsR6CrashSort: fsR6CrashSort,
  fsR6CrashSelectionAllowed: fsR6CrashSelectionAllowed,
  fsR6CrashKey: fsR6CrashKey,
  fsR6CrashVisibleItems: fsR6CrashVisibleItems,
  fsR6CrashExactInfo: fsR6CrashExactInfo,
  fsR6CrashSeedTemplates: fsR6CrashSeedTemplates,
  fsR6CrashEligibleGroups: fsR6CrashEligibleGroups,
  fsR6CrashUpdateButton: fsR6CrashUpdateButton,
  fsR6CrashSelectAllFiltered: fsR6CrashSelectAllFiltered,
  fsR6CrashClearSelection: fsR6CrashClearSelection,
  fsR6CrashCloseModal: fsR6CrashCloseModal,
  fsR6CrashStatus: fsR6CrashStatus,
  fsR6CrashUid: fsR6CrashUid,
  fsR6CrashClone: fsR6CrashClone,
  fsR6CrashFutureDate: fsR6CrashFutureDate,
  fsR6CrashCreateAllocation: fsR6CrashCreateAllocation,
  fsR6CrashCreateWorkflow: fsR6CrashCreateWorkflow,
  fsR6CrashFindPlan: fsR6CrashFindPlan,
  fsR6CrashFindCartPlan: fsR6CrashFindCartPlan,
  fsR6CrashActiveAllocations: fsR6CrashActiveAllocations,
  fsR6CrashAllocationTotal: fsR6CrashAllocationTotal,
  fsR6CrashEnsureCustomAllocations: fsR6CrashEnsureCustomAllocations,
  fsR6CrashAllocationRows: fsR6CrashAllocationRows,
  fsR6CrashPlanHtml: fsR6CrashPlanHtml,
  fsR6CrashRenderPlans: fsR6CrashRenderPlans,
  fsR6CrashReviewData: fsR6CrashReviewData,
  fsR6CrashRenderReview: fsR6CrashRenderReview,
  fsR6CrashRenderWorkflow: fsR6CrashRenderWorkflow,
  fsR6CrashAllocationByInput: fsR6CrashAllocationByInput,
  fsR6CrashHandlePlanInput: fsR6CrashHandlePlanInput,
  fsR6CrashHandlePlanAction: fsR6CrashHandlePlanAction,
  fsR6CrashUsedSeals: fsR6CrashUsedSeals,
  fsR6CrashValidateReview: fsR6CrashValidateReview,
  fsR6CrashCompileWorkflow: fsR6CrashCompileWorkflow,
  fsR6CrashNormalizeAllocations: fsR6CrashNormalizeAllocations,
  fsR6ApplyExactReplacementAllocations: fsR6ApplyExactReplacementAllocations,
  fsR6CrashBuildBulkResult: fsR6CrashBuildBulkResult,
  fsR6CrashVerifyPersisted: fsR6CrashVerifyPersisted,
  fsR6ActualMaster: fsR6ActualMaster,
  fsR6MasterUsers: fsR6MasterUsers,
  fsR6RoleLabel: fsR6RoleLabel,
  fsR6EnsureMasterModal: fsR6EnsureMasterModal,
  fsR6InitializeCanonical: fsR6InitializeCanonical,
  FS_R5_DEPT_FALLBACKS: globalThis.FS_R5_DEPT_FALLBACKS,
  FS_R5_DEPT_ALIASES: globalThis.FS_R5_DEPT_ALIASES,
  FS_R6_CRASH_SELECTED: globalThis.FS_R6_CRASH_SELECTED,
  FS_R6_CRASH_WORKFLOW: globalThis.FS_R6_CRASH_WORKFLOW,
  FS_R6_CRASH_FILTER: globalThis.FS_R6_CRASH_FILTER,
  FS_R6_ORDER_NAMES: globalThis.FS_R6_ORDER_NAMES
};
publishLegacy("51-asdhealth-canonical-r6-32-20260727.js", __asdhLegacyApi);
export {
  fsR5E,
  fsR5S,
  fsR5N,
  fsR5Esc,
  fsR5Toast,
  fsR5Norm,
  fsR5DepartmentRecords,
  fsR5DepartmentCandidates,
  fsR5MedicineFlags,
  fsR5SelectedOrders,
  fsR5OrderRow,
  fsR5OrdersHtml,
  fsR5OrdersPrintData,
  fsR5ControlledDept,
  fsR5ControlledMedicine,
  fsR5NormalizeControlled,
  fsR5ControlledRows,
  fsR5DMY,
  fsR12DateOnly,
  fsR12PrintDate,
  fsR12ExpiryDays,
  fsR12HasNearExpiry,
  fsR12BatchLotHtml,
  fsR12BatchExpiryHtml,
  fsR5BatchText,
  fsR5Class,
  fsR5ExpiryDays,
  fsR5NearDays,
  fsR5PublicUrl,
  fsR5Logo,
  fsR5PrintSettings,
  fsR5ControlledPrintHtml,
  fsR6E,
  fsR6S,
  fsR6N,
  fsR6Esc,
  fsR6Norm,
  fsR6Toast,
  fsR6Now,
  fsR6Actor,
  fsR6Audit,
  fsR6CloseModal,
  fsR6OpenModal,
  fsR6EnsureStyles,
  fsR6CrashCanBulk,
  fsR6CrashCarts,
  fsR6CrashFilter,
  fsR6CrashRules,
  fsR6CrashDays,
  fsR6CrashBatchLevel,
  fsR6CrashItemLevel,
  fsR6CrashItemName,
  fsR6CrashMedicineKey,
  fsR6CrashSort,
  fsR6CrashSelectionAllowed,
  fsR6CrashKey,
  fsR6CrashVisibleItems,
  fsR6CrashExactInfo,
  fsR6CrashSeedTemplates,
  fsR6CrashEligibleGroups,
  fsR6CrashUpdateButton,
  fsR6CrashSelectAllFiltered,
  fsR6CrashClearSelection,
  fsR6CrashCloseModal,
  fsR6CrashStatus,
  fsR6CrashUid,
  fsR6CrashClone,
  fsR6CrashFutureDate,
  fsR6CrashCreateAllocation,
  fsR6CrashCreateWorkflow,
  fsR6CrashFindPlan,
  fsR6CrashFindCartPlan,
  fsR6CrashActiveAllocations,
  fsR6CrashAllocationTotal,
  fsR6CrashEnsureCustomAllocations,
  fsR6CrashAllocationRows,
  fsR6CrashPlanHtml,
  fsR6CrashRenderPlans,
  fsR6CrashReviewData,
  fsR6CrashRenderReview,
  fsR6CrashRenderWorkflow,
  fsR6CrashAllocationByInput,
  fsR6CrashHandlePlanInput,
  fsR6CrashHandlePlanAction,
  fsR6CrashUsedSeals,
  fsR6CrashValidateReview,
  fsR6CrashCompileWorkflow,
  fsR6CrashNormalizeAllocations,
  fsR6ApplyExactReplacementAllocations,
  fsR6CrashBuildBulkResult,
  fsR6CrashVerifyPersisted,
  fsR6ActualMaster,
  fsR6MasterUsers,
  fsR6RoleLabel,
  fsR6EnsureMasterModal,
  fsR6InitializeCanonical
};
export const legacyVariableNames = Object.freeze(["FS_R5_DEPT_FALLBACKS", "FS_R5_DEPT_ALIASES", "FS_R6_CRASH_SELECTED", "FS_R6_CRASH_WORKFLOW", "FS_R6_CRASH_FILTER", "FS_R6_ORDER_NAMES"]);
export default __asdhLegacyApi;

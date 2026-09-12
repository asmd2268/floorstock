/* Reading a department's controlled-custody list — the one place that answers
   "what is this department holding?".

   The answer is looked for in four places, in this order: the session's own
   cache, the private state document over REST, the public mirror over REST, and
   finally the Firestore SDK. That ladder is not redundancy for its own sake — a
   department user may not read the private document at all, and a printed
   custody sheet must still come out; a Master opening a department they were not
   signed in as has no cache to read. The first source with rows wins, and what
   the REST reads find is written back into the cache so the next screen does not
   pay for it again.

   The candidate ids are the other half of the problem: the same ward is written
   as an id, an English name, an Arabic name and an import's abbreviation, and
   the custody document may be filed under any of them. `candidateIds` folds all
   of those to one list before the ladder is walked.

   `fsR5NormalizeControlled` is where the shapes are reconciled: batches have
   been stored as `batches`, `batchList`, `lots`, `expiryBatches`, or flattened
   onto the row itself, with quantity under four different names. Everything
   downstream — the panel, the printed sheet — sees one shape.

   Moved out of modules/51 whole, so the print and the panel can follow it out
   one at a time. */

import { fsE } from './dom-utils.js?v=b2909b7f46';
import { fsNorm, fsText, fsNum } from './text-normalize.js?v=aa16ae9ac0';
import { fsR5DepartmentRecords, fsR5DepartmentCandidates } from './department-names.js?v=ea6f476532';

export function fsR5ControlledDept(){
  var effective=(typeof globalThis.fsEffectiveUser==='function'?globalThis.fsEffectiveUser():globalThis.CU||{}),value='';
  try{if(typeof globalThis.ctlCurrentDept==='function')value=globalThis.ctlCurrentDept()||''}catch(e){/* an optional source that is not loaded in this session */}
  if(!value)value=effective.deptId||effective.departmentId||effective.department||'';
  var selector=fsE('ctl-dept');
  if(!value&&selector)value=selector.value||'';
  return fsText(value,'');
}
export const FS_R5_UNKNOWN_MEDICINE='Unknown medicine / دواء غير معروف';
export function fsR5ControlledMedicine(id,row){
  var m={};row=row||{};
  try{if(typeof globalThis.ctlMedicine==='function')m=globalThis.ctlMedicine(id)||{}}catch(e){/* an optional source that is not loaded in this session */}
  return {
    name:fsText(m.name||row.name||row.medName||row.medicineName,FS_R5_UNKNOWN_MEDICINE),
    moh:fsText(m.moh||m.mohCode||row.moh||row.mohCode,''),
    nupco:fsText(m.nupco||m.nupcoCode||row.nupco||row.nupcoCode,''),
    classification:fsText(m.classification||row.classification,'narcotic')
  };
}
export function fsR5NormalizeControlled(rows,source){
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
        lot:fsText(lot,''),
        expiry:fsText(expiry,''),
        qty:qty===''?'':fsNum(qty)
      };
    }).filter(function(batch){
      return batch.lot||batch.expiry||batch.qty!=='';
    });

    return {
      key:fsText(id,'row_'+i),
      name:m.name,
      moh:m.moh,
      nupco:m.nupco,
      classification:m.classification,
      required:row.requiredQty!=null?fsNum(row.requiredQty):
        (row.required!=null?fsNum(row.required):
        (row.max!=null?fsNum(row.max):'—')),
      actual:row.actualQty!=null?fsNum(row.actualQty):
        (row.available!=null?fsNum(row.available):fsNum(row.qty)),
      batches:batches,
      source:source
    };
  });
}
export async function fsR5ControlledRows(dept){
  function addUnique(list,value){
    value=fsText(value,'');
    if(value&&list.indexOf(value)<0)list.push(value);
  }
  function aliasTokens(value){
    var out=[],norm=fsNorm(value);
    addUnique(out,value);
    var aliases=globalThis.floorstockDepartmentAliases||{};
    Object.keys(aliases).forEach(function(label){
      var values=[label].concat(aliases[label]||[]);
      if(values.some(function(v){return fsNorm(v)===norm;})){
        values.forEach(function(v){addUnique(out,v);});
      }
    });
    return out;
  }
  function candidateIds(){
    var out=fsR5DepartmentCandidates(dept,globalThis.CU&&(CU.deptName||CU.departmentName))||[];
    var targets=[];
    [dept,globalThis.CU&&CU.deptId,globalThis.CU&&CU.departmentId,globalThis.CU&&CU.originalDeptId,globalThis.CU&&(CU.deptName||CU.departmentName)].forEach(function(v){
      aliasTokens(v).forEach(function(x){addUnique(targets,x);});
    });
    fsR5DepartmentRecords().forEach(function(d){
      var match=targets.some(function(target){
        return String(d.id)===String(target)||fsNorm(d.name)===fsNorm(target)||fsNorm(d.id)===fsNorm(target);
      });
      if(match)addUnique(out,d.id);
    });
    targets.forEach(function(v){
      var mapped=FS_R5_DEPT_ALIASES[fsNorm(v)];
      addUnique(out,mapped);
      addUnique(out,v);
    });
    if(globalThis.S&&S.cache){
      Object.keys(S.cache).filter(function(key){return key.indexOf('controlled_dept_list_')===0;}).forEach(function(key){
        var suffix=key.slice('controlled_dept_list_'.length);
        var record=fsR5DepartmentRecords().find(function(d){return String(d.id)===String(suffix);});
        var matches=out.some(function(v){return String(v)===String(suffix)||fsNorm(v)===fsNorm(suffix);})||
          targets.some(function(v){return fsNorm(v)===fsNorm(suffix)||(record&&fsNorm(record.name)===fsNorm(v));});
        if(matches)addUnique(out,suffix);
      });
    }
    return out;
  }
  function normalizePrivate(value,source){
    var rows=fsR5NormalizeControlled(Array.isArray(value)?value:[],source);
    return rows.filter(function(row){return row&&row.name&&row.name!==FS_R5_UNKNOWN_MEDICINE||row.key;});
  }
  async function readStateRest(id){
    if(typeof fsStateRestRequest!=='function'||typeof fsStateRestBase!=='function')return [];
    var tenant=globalThis.fsTenantId&&fsTenantId(),statePath=tenant?'tenants/'+tenant+'/state':'floorstock_state';
    var url=fsStateRestBase()+'/'+statePath.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent('controlled_dept_list_'+id)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    var response=await fsStateRestRequest(url,{method:'GET'},8000);
    if(response.status===404||!response.payload)return [];
    var decoded=fsLoginDecodeRestDocument(response.payload)||{};
    return normalizePrivate(decoded.value,'private-rest');
  }
  async function readPublicRest(id){
    if(typeof fsStateRestRequest!=='function'||typeof fsStateRestBase!=='function')return [];
    var tenant=globalThis.fsTenantId&&fsTenantId(),path=tenant?'tenants/'+tenant+'/public_controlled_expiry':'public_controlled_expiry';
    var url=fsStateRestBase()+'/'+path.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent(id)+'?key='+encodeURIComponent(FIREBASE_CONFIG.apiKey);
    var response=await fsStateRestRequest(url,{method:'GET'},8000);
    if(response.status===404||!response.payload)return [];
    var decoded=fsLoginDecodeRestDocument(response.payload)||{};
    return fsR5NormalizeControlled(decoded.items||decoded.medicines||[],'public-rest');
  }

  /* What a REST read leaves in the cache is what ctlDeptList serves for the rest
     of the session — and what a later custody save republishes. Dropping the
     medicine's identity here is how a republish blanked the public MEDICINE
     column, so the row is cached whole, not reduced to its numbers.
     صف العهدة يُحفظ كاملاً في الذاكرة، لا أرقامه فقط. */
  function cachedRow(row){
    /* The reader's own "unknown medicine" label is a way of showing a gap, not a
       name: caching it would turn a missing name into a recorded one. */
    var name=row.name===FS_R5_UNKNOWN_MEDICINE?'':row.name;
    return {medId:row.key,name:name,moh:row.moh,nupco:row.nupco,classification:row.classification,
      requiredQty:row.required,actualQty:row.actual,qty:row.actual,batches:row.batches};
  }

  var candidates=candidateIds(),errors=[];
  for(var i=0;i<candidates.length;i++){
    var id=candidates[i],cacheRows=[];
    try{
      var key='controlled_dept_list_'+id;
      var raw=globalThis.S&&S.cache&&Object.prototype.hasOwnProperty.call(S.cache,key)?S.cache[key]:
        (typeof globalThis.ctlDeptList==='function'?globalThis.ctlDeptList(id):[]);
      cacheRows=normalizePrivate(raw,'private-cache');
      if(cacheRows.length)return {dept:id,rows:cacheRows,source:'private-cache'};
    }catch(error){errors.push(error);}
  }

  for(var j=0;j<candidates.length;j++){
    try{
      var restRows=await readStateRest(candidates[j]);
      if(restRows.length){
        if(globalThis.S&&S.cache)S.cache['controlled_dept_list_'+candidates[j]]=restRows.map(cachedRow);
        return {dept:candidates[j],rows:restRows,source:'private-rest'};
      }
    }catch(error){errors.push(error);}
  }

  for(var k=0;k<candidates.length;k++){
    try{
      var publicRows=await readPublicRest(candidates[k]);
      if(publicRows.length){
        if(globalThis.S&&S.cache)S.cache['controlled_dept_list_'+candidates[k]]=publicRows.map(cachedRow);
        return {dept:candidates[k],rows:publicRows,source:'public-rest'};
      }
    }catch(error){errors.push(error);}
  }

  if(globalThis.FB_DB){
    for(var n=0;n<candidates.length;n++){
      try{
        var ref=(globalThis.fsTenantCollection?fsTenantCollection('public_controlled_expiry'):FB_DB.collection('public_controlled_expiry')).doc(String(candidates[n]));
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

/* modules/51 and the crash-cart print still call these by name. */
Object.assign(globalThis,{ fsR5ControlledDept, fsR5ControlledRows });

import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

// ── MEDICATION / EXPIRY / SHELF CRUD HELPERS ────────────────────────────
// Split out of 03-core-application-firebase-state-auth.js (Phase 3 module
// split). Every helper referenced here that isn't declared in this file
// (S, CU, renderInv, crashCarts, setCrashCarts, syncPublicExpiry,
// warnPublicSync, nowISO) is already published to globalThis by its owning
// module, so it resolves via normal global fallback — no import statements
// needed. Imported BEFORE 03-core-application-firebase-state-auth.js in
// main.js since the rest of module 03 (dashboard, inventory, requests)
// calls getMeds/getExpiry/gd/gu/gr etc. throughout its own function bodies.
// Per-dept keys: medications are stored per dept
globalThis.FS_R17_MED_MIGRATION_PENDING = {};
function fsR17Now(){return typeof nowISO==='function'?nowISO():new Date().toISOString()}
function fsR17MedNorm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function fsR17MedIdentity(v){var stop={mg:1,mcg:1,g:1,gm:1,ml:1,l:1,iu:1,unit:1,units:1,tab:1,tabs:1,tablet:1,tablets:1,cap:1,caps:1,capsule:1,capsules:1,amp:1,amps:1,ampoule:1,ampoules:1,vial:1,vials:1,bottle:1,bottles:1,bag:1,bags:1,syrup:1,solution:1,solutions:1,injection:1,injections:1,cream:1,ointment:1,drops:1,inhaler:1,inhalers:1,suppository:1,suppositories:1,oral:1,iv:1,im:1,sc:1,infusion:1,for:1,of:1};return fsR17MedNorm(v).split(/\s+/).filter(function(x){return x&&!stop[x]}).join(' ')}
function fsR17UniqueNames(values){var out=[],seen={};(values||[]).forEach(function(v){v=String(v||'').trim();var k=fsR17MedNorm(v);if(v&&k&&!seen[k]){seen[k]=1;out.push(v)}});return out}
function fsR17MedId(){return 'med_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function fsR17NormalizeMed(m,index){m=Object.assign({},m||{});m.id=String(m.id||m.medId||fsR17MedId());m.medId=m.id;m.name=String(m.name||m.currentName||'').trim();m.currentName=m.name;m.aliases=fsR17UniqueNames(m.aliases||m.previousNames||[]).filter(function(x){return fsR17MedNorm(x)!==fsR17MedNorm(m.name)});var order=Number(m.sortOrder);m.sortOrder=isFinite(order)?order:(index+1)*100;if(!m.createdAt)m.createdAt=m.created||fsR17Now();return m}
function fsR17NormalizeMeds(arr){var ids={},changed=false;var out=(Array.isArray(arr)?arr:[]).map(function(m,i){var before=JSON.stringify(m||{}),n=fsR17NormalizeMed(m,i);while(ids[n.id])n.id=n.medId=fsR17MedId();ids[n.id]=1;if(JSON.stringify(n)!==before)changed=true;return n});return {rows:out,changed:changed}}
function getMeds(deptId){var raw=S.g('meds_'+deptId)||[],n=fsR17NormalizeMeds(raw);if(n.changed&&!FS_R17_MED_MIGRATION_PENDING[deptId]){FS_R17_MED_MIGRATION_PENDING[deptId]=1;setTimeout(function(){S.s('meds_'+deptId,n.rows).catch(function(e){console.warn('Medication identity migration failed',deptId,e)}).finally(function(){delete FS_R17_MED_MIGRATION_PENDING[deptId]})},0)}return n.rows}
/* Fail closed until the authoritative R6.64 inventory safety gateway is installed. */
function setMeds(deptId,rows){var gateway=globalThis.inventorySafetySetMeds;if(typeof gateway==='function')return gateway(deptId,rows);return Promise.reject(new Error('Inventory safety gateway is not initialized.'))}
function pushMed(deptId,v){var arr=getMeds(deptId).slice(),max=arr.reduce(function(a,m){return Math.max(a,Number(m.sortOrder)||0)},0);v=fsR17NormalizeMed(Object.assign({},v||{},{id:(v&&v.id)||fsR17MedId(),sortOrder:(v&&isFinite(Number(v.sortOrder)))?Number(v.sortOrder):max+100,createdAt:(v&&v.createdAt)||fsR17Now()}),arr.length);arr.push(v);return setMeds(deptId,arr).then(function(){return v})}
function updMed(deptId,id,d){var arr=getMeds(deptId).slice(),i=arr.findIndex(function(x){return String(x.id)===String(id)});if(i<0)return Promise.resolve(false);var old=arr[i],next=Object.assign({},old,d||{},{id:old.id,medId:old.id,sortOrder:old.sortOrder,updatedAt:fsR17Now()});if(d&&d.name&&fsR17MedNorm(d.name)!==fsR17MedNorm(old.name))next.aliases=fsR17UniqueNames((old.aliases||[]).concat([old.name]));arr[i]=fsR17NormalizeMed(next,i);return setMeds(deptId,arr).then(function(){return true})}
function delMed(deptId,id){return setMeds(deptId,getMeds(deptId).filter(function(x){return String(x.id)!==String(id)}))}
function fsR17SameMedicine(a,b){if(!a||!b)return false;if(String(a.id||'')&&String(a.id||'')===String(b.id||''))return true;var namesA=[a.name].concat(a.aliases||[]),namesB=[b.name].concat(b.aliases||[]);for(var i=0;i<namesA.length;i++)for(var j=0;j<namesB.length;j++){var x=fsR17MedIdentity(namesA[i]),y=fsR17MedIdentity(namesB[j]);if(x&&y&&(x===y||(x.length>5&&y.indexOf(x)>=0)||(y.length>5&&x.indexOf(y)>=0)))return true}return false}
window.fsR17FindCorrespondingMedicine=function(source,deptId){return getMeds(deptId).find(function(m){return fsR17SameMedicine(source,m)})||null};
window.fsR17MedicationRuleFor=function(map,med,dept){if(!map||!med)return null;function applies(r){return !!(r&&(r.allDepartments===true||r.deptIds==='all'||(Array.isArray(r.departmentIds)&&r.departmentIds.map(String).indexOf(String(dept))>=0)||(Array.isArray(r.deptIds)&&r.deptIds.map(String).indexOf(String(dept))>=0)))}var direct=map['med:'+String(med.id)]||map[String(med.id)];if(direct&&applies(direct))return direct;var names=[med.name].concat(med.aliases||[]),keys=[];names.forEach(function(name){var n=fsR17MedNorm(name),i=fsR17MedIdentity(name);if(n)keys.push(n);if(i)keys.push('identity:'+i)});for(var k=0;k<keys.length;k++){var r=map[keys[k]];if(r&&applies(r))return r}return null};
window.fsR17RuleScopeLabel=function(rule){if(!rule)return '';if(rule.allDepartments===true||rule.deptIds==='all')return 'All departments';var ids=(rule.departmentIds||rule.deptIds||[]).map(String),names=ids.map(function(id){var d=(typeof gd==='function'?gd():[]).find(function(x){return String(x.id)===id});return d?d.name:id});return names.length?names.join(', '):'No department'};
window.moveDrugOrder=async function(id,deptId,dir){var all=getMeds(deptId).slice().sort(function(a,b){return Number(a.sortOrder)-Number(b.sortOrder)}),idx=all.findIndex(function(m){return String(m.id)===String(id)});if(idx<0)return;var step=dir<0?-1:1,j=idx+step;while(j>=0&&j<all.length&&all[j].category!==all[idx].category)j+=step;if(j<0||j>=all.length)return;var x=all[idx].sortOrder;all[idx].sortOrder=all[j].sortOrder;all[j].sortOrder=x;await setMeds(deptId,all);if(typeof renderInv==='function')renderInv()};
window.fsR17RefreshMedicationReferences=async function(deptId,medId,oldName,newName){var tasks=[];if(typeof getExpiry==='function'&&typeof setExpiry==='function'){var exp=getExpiry(deptId),changed=false,next=exp.map(function(x){if(String(x.medId)===String(medId)){changed=true;return Object.assign({},x,{medName:newName})}return x});if(changed)tasks.push(setExpiry(deptId,next))}if(typeof crashCarts==='function'&&typeof setCrashCarts==='function'){var carts=JSON.parse(JSON.stringify(crashCarts()||[])),cartChanged=false;carts.forEach(function(c){if(String(c.deptId)!==String(deptId))return;(c.items||[]).forEach(function(it){if(String(it.medId||'')===String(medId)||fsR17MedNorm(it.name)===fsR17MedNorm(oldName)){it.medId=medId;it.name=newName;it.genericName=newName;cartChanged=true}})});if(cartChanged)tasks.push(setCrashCarts(carts))}for(var z=0;z<2;z++){var key=z?'medication_freeze_rules_v3':'medication_visibility_rules_v3',map=Object.assign({},S.g(key)||{}),rk='med:'+medId;if(map[rk]){map[rk]=Object.assign({},map[rk],{medId:medId,name:newName,updatedAt:fsR17Now()});tasks.push(S.s(key,map))}}await Promise.all(tasks)};
// fsR17MigrateMedicationIdentity: module 40 permanently disables this on login
// ("No login-time inventory mutation is permitted.") alongside window.seed and
// repairImportedDepartmentAliases, so this real implementation never runs.
// Removed rather than kept unreachable; the disable-stub in module 40 is the
// active, intentional policy enforcement.
function fsR17Hash(v){var h=2166136261,s=String(v||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
globalThis.FS_R18_EXPIRY_MIGRATION_PENDING = {};
function fsR18ExpiryId(){return 'ex_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9)}
function fsR17NormalizeExpiryRow(deptId,row,index,usedIds){
  row=Object.assign({},row||{});
  usedIds=usedIds||{};
  var medId=String(row.medId||row.medicationId||'');
  var date=String(row.date||row.expiry||row.expiryDate||'').slice(0,10);
  var lot=String(row.batch||row.lot||row.batchNo||row.lotNo||'').trim();
  var id=String(row.batchId||row.id||'').trim();
  if(!id||usedIds[id])id=fsR18ExpiryId();
  usedIds[id]=1;
  return Object.assign({},row,{id:id,batchId:id,medId:medId,date:date,expiry:date,batch:lot,lot:lot});
}
function fsR18NormalizeExpiryRows(deptId,rows){
  var used={},changed=false,merged={};
  var normalized=(Array.isArray(rows)?rows:[]).map(function(row,index){
    var before=JSON.stringify(row||{});
    var next=fsR17NormalizeExpiryRow(deptId,row,index,used);
    if(before!==JSON.stringify(next))changed=true;
    var key=next.medId+'|'+next.date+'|'+next.lot;
    if(merged[key]){merged[key].qty=(Number(merged[key].qty)||0)+(Number(next.qty)||0);changed=true;return null}
    merged[key]=next;return next;
  }).filter(Boolean);
  return {rows:normalized,changed:changed};
}
function fsR18ExpiryComparable(rows){
  return (rows||[]).map(function(row){
    return {
      id:String(row.id||row.batchId||''),
      medId:String(row.medId||''),
      date:String(row.date||row.expiry||'').slice(0,10),
      lot:String(row.lot||row.batch||''),
      qty:row.qty==null?'':Number(row.qty)
    };
  });
}
function getExpiry(deptId){
  var raw=S.g('expiry_'+deptId)||[];
  var normalized=fsR18NormalizeExpiryRows(deptId,raw);
  if(normalized.changed&&!FS_R18_EXPIRY_MIGRATION_PENDING[deptId]){
    FS_R18_EXPIRY_MIGRATION_PENDING[deptId]=1;
    setTimeout(function(){
      S.s('expiry_'+deptId,normalized.rows).catch(function(error){
        console.warn('Expiry ID migration failed',deptId,error);
      }).finally(function(){delete FS_R18_EXPIRY_MIGRATION_PENDING[deptId]});
    },0);
  }
  return normalized.rows;
}
async function fsR18ReadExpiry(deptId){
  var normalized=fsR18NormalizeExpiryRows(deptId,S.g('expiry_'+deptId)||[]);
  if(normalized.changed)await S.s('expiry_'+deptId,normalized.rows);
  return normalized.rows;
}
async function setExpiry(deptId,arr){
  var normalized=fsR18NormalizeExpiryRows(deptId,arr).rows;
  await S.s('expiry_'+deptId,normalized);
  var readBack=fsR18NormalizeExpiryRows(deptId,S.g('expiry_'+deptId)||[]).rows;
  if(JSON.stringify(fsR18ExpiryComparable(readBack))!==JSON.stringify(fsR18ExpiryComparable(normalized))){
    throw new Error('Primary expiry save verification failed');
  }
  try{
    if(typeof syncPublicExpiry==='function')await syncPublicExpiry(deptId,readBack);
  }catch(error){
    warnPublicSync('Expiry data',error);
  }
  return readBack;
}
async function addExpBatch(deptId,batch){
  var arr=(await fsR18ReadExpiry(deptId)).slice();
  var id=fsR18ExpiryId();
  var row=fsR17NormalizeExpiryRow(deptId,Object.assign({},batch||{},{id:id,batchId:id}),arr.length,{});
  arr.push(row);
  var savedRows=await setExpiry(deptId,arr);
  var saved=savedRows.find(function(item){return String(item.id)===id});
  if(!saved)throw new Error('Expiry record was not found after save');
  return saved;
}
async function delExpBatch(deptId,id){
  id=String(id||'');
  var before=await fsR18ReadExpiry(deptId);
  var next=before.filter(function(row){return String(row.id||row.batchId)!==id});
  if(next.length===before.length)throw new Error('Expiry record ID not found');
  var savedRows=await setExpiry(deptId,next);
  if(savedRows.some(function(row){return String(row.id||row.batchId)===id})){
    throw new Error('Expiry deletion verification failed');
  }
  return true;
}
async function updExpBatch(deptId,id,changes){
  id=String(id||'');
  var arr=(await fsR18ReadExpiry(deptId)).slice();
  var index=arr.findIndex(function(row){return String(row.id||row.batchId)===id});
  if(index<0)throw new Error('Expiry record ID not found');
  var originalId=String(arr[index].id||arr[index].batchId);
  arr[index]=fsR17NormalizeExpiryRow(
    deptId,
    Object.assign({},arr[index],changes||{},{id:originalId,batchId:originalId}),
    index,
    {}
  );
  var savedRows=await setExpiry(deptId,arr);
  var saved=savedRows.find(function(row){return String(row.id||row.batchId)===originalId});
  if(!saved)throw new Error('Expiry update verification failed');
  var expected=fsR18ExpiryComparable([arr[index]])[0];
  var actual=fsR18ExpiryComparable([saved])[0];
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('Expiry update read-back mismatch');
  return saved;
}
function getShelves(deptId){return S.g('shelves_'+deptId)||[]}
function setShelves(deptId,arr){return S.s('shelves_'+deptId,arr)}
function addShelf(deptId,v){var arr=(getShelves(deptId)||[]).slice();v=Object.assign({},v||{});v.id=v.id||'sh_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);arr.push(v);return setShelves(deptId,arr).then(function(){return v})}
function delShelf(deptId,id){return setShelves(deptId,(getShelves(deptId)||[]).filter(function(x){return String(x.id)!==String(id)}))}
function updShelf(deptId,id,d){var arr=(getShelves(deptId)||[]).slice(),i=arr.findIndex(function(x){return String(x.id)===String(id)});if(i<0)return Promise.resolve(false);arr[i]=Object.assign({},arr[i],d||{});return setShelves(deptId,arr).then(function(){return true})}
function getAlertSettings(deptId){return S.g('alerts_'+deptId)||{d1:30,d2:7}}
function setAlertSettings(deptId,obj){return S.s('alerts_'+deptId,obj)}
globalThis._gdRawRef = null;
globalThis._gdDeletedRef = null;
globalThis._gdFiltered = [];
globalThis._deletedDeptRepairBusy = false;
function gd(){var raw=S.g('departments')||[],deleted=S.g('deleted_departments')||[];if(raw!==_gdRawRef||deleted!==_gdDeletedRef){_gdRawRef=raw;_gdDeletedRef=deleted;var blocked=new Set((Array.isArray(deleted)?deleted:[]).map(function(x){return String(x)}));_gdFiltered=(Array.isArray(raw)?raw:[]).filter(function(d){return !blocked.has(String(d&&d.id))})}return _gdFiltered.slice()}
async function repairDeletedDepartments(){
  if(_deletedDeptRepairBusy)return;
  /* Tombstone cleanup rewrites the global department directory and deletes a state key.
     Only the pharmacy director / actual master may perform it; never attempt it on
     supervisor sign-in and then surface a misleading authorization toast. */
  if(!window.CU||!(CU.master===true||String(CU.role||'')==='pharmacy'))return;
  var tombs=S.g('deleted_departments')||[];
  if(!Array.isArray(tombs)||!tombs.length)return;
  _deletedDeptRepairBusy=true;
  try{
    var blocked=new Set(tombs.map(function(x){return String(x)})),raw=S.g('departments')||[],filtered=raw.filter(function(d){return !blocked.has(String(d&&d.id))});
    if(filtered.length!==raw.length)await S.s('departments',filtered);
    await S.rm('deleted_departments');
    _gdRawRef=_gdDeletedRef=null;
  }catch(e){console.warn('Deleted department migration failed',e)}
  finally{_deletedDeptRepairBusy=false}
}
function gu(){return S.g('users')||[]}
function gr(){return S.g('requests')||[]}

publishLegacy("03c-medication-expiry-shelf-helpers.js", {
  fsR17Now,
  fsR17MedNorm,
  fsR17MedIdentity,
  fsR17UniqueNames,
  fsR17MedId,
  fsR17NormalizeMed,
  fsR17NormalizeMeds,
  getMeds,
  setMeds,
  pushMed,
  updMed,
  delMed,
  fsR17SameMedicine,
  fsR17Hash,
  fsR18ExpiryId,
  fsR17NormalizeExpiryRow,
  fsR18NormalizeExpiryRows,
  fsR18ExpiryComparable,
  getExpiry,
  fsR18ReadExpiry,
  setExpiry,
  addExpBatch,
  delExpBatch,
  updExpBatch,
  getShelves,
  setShelves,
  addShelf,
  delShelf,
  updShelf,
  getAlertSettings,
  setAlertSettings,
  gd,
  repairDeletedDepartments,
  gu,
  gr,
});

export {};

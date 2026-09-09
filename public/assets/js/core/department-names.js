/* Department names: the aliases a department is known by, and the one way to
   turn an id into a name.

   Extracted from modules/51 as its own concern rather than a corner of the
   printing module. It never belonged to printing — it is used at login to
   resolve the signed-in user's department, by Master Test Mode to label the
   department being tested, and by the Crash Cart screens — all of them reaching
   for it through a global because that is where it happened to sit.

   The aliases exist because the same ward is written differently in different
   places: an import writes "NICU", a user types "العناية المركزة للمواليد", a
   seed file says "Neonatal ICU". Folding those to one identity is why a
   department resolves at all. */

import { fsNorm, fsText } from './text-normalize.js?v=aa16ae9ac0';

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
      return {id:u&&fsText(u.deptId||u.departmentId||u.department,''),name:u&&fsText(u.deptName||u.departmentName||u.departmentLabel,'')};
    }));
  }catch(e){}
  if(window.CU)addPool([{id:CU.deptId||CU.departmentId||CU.department,name:CU.deptName||CU.departmentName||CU.departmentLabel}]);
  pools.forEach(function(pool){
    pool.forEach(function(d){
      if(!d)return;
      var id=fsText(d.id||d.deptId||d.departmentId||d.department||d.code,'');
      if(!id)return;
      var name=fsText(d.name||d.deptName||d.departmentName||d.departmentLabel||d.label,'');
      var alias=FS_R5_DEPT_ALIASES[fsNorm(id)];
      if(!name)name=FS_R5_DEPT_FALLBACKS[id]||FS_R5_DEPT_FALLBACKS[alias]||'';
      if(!seen[id]){seen[id]={id:id,name:name};records.push(seen[id])}
      else if(name&&(!seen[id].name||seen[id].name===id))seen[id].name=name;
    });
  });
  return records;
}
window.floorstockDepartmentName=function(ref){
  var d=ref&&typeof ref==='object'?ref:{id:ref};
  var id=fsText(d.id||d.deptId||d.departmentId||d.department||d.code,'');
  var given=fsText(d.name||d.deptName||d.departmentName||d.departmentLabel||d.label,'');
  if(given)return given;
  var hit=fsR5DepartmentRecords().find(function(x){return String(x.id)===String(id)});
  if(hit&&hit.name)return hit.name;
  var alias=FS_R5_DEPT_ALIASES[fsNorm(id)];
  return FS_R5_DEPT_FALLBACKS[id]||FS_R5_DEPT_FALLBACKS[alias]||id||'Department / القسم';
};
function fsR5DepartmentCandidates(ref,name){
  var out=[];
  function add(v){v=fsText(v,'');if(v&&out.indexOf(v)<0)out.push(v)}
  add(ref);
  var alias=FS_R5_DEPT_ALIASES[fsNorm(name)]||FS_R5_DEPT_ALIASES[fsNorm(ref)];
  add(alias);
  fsR5DepartmentRecords().forEach(function(d){
    if(String(d.id)===String(ref)||fsNorm(d.name)===fsNorm(name)||fsNorm(d.name)===fsNorm(ref)||(alias&&String(d.id)===String(alias)))add(d.id);
  });
  if(window.CU){
    add(CU.deptId);add(CU.departmentId);add(CU.originalDeptId);
    add(FS_R5_DEPT_ALIASES[fsNorm(CU.deptName||CU.departmentName)]);
  }
  return out;
}
window.fsR5DepartmentCandidates=fsR5DepartmentCandidates;

/* Print Orders: one A4 landscape page, dispensed positive quantities only. */


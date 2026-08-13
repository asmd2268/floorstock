// Canonical lookup for historical dispensing lines.  Requests retain the medicine
// id for audit purposes, while this resolver supplies the current readable name
// and classification from the department medicine record.
function text(value){return String(value==null?'':value).trim()}

function highAlert(record){
  record=record||{};
  if(record.high_alert===true||record.highAlert===true||record.isHighAlert===true)return true;
  var labels=[];
  ['classification','classifications','flags','riskClass','alertClass'].forEach(function(key){
    var value=record[key];
    labels=labels.concat(Array.isArray(value)?value:[value]);
  });
  return labels.some(function(value){return /high\s*[- ]?alert/i.test(text(value))});
}

export function buildAnalyticsMedicineIndex(){
  var byDepartment=Object.create(null),byId=Object.create(null);
  var departments=typeof window.gd==='function'?window.gd()||[]:[];
  departments.forEach(function(department){
    var departmentId=text(department&&department.id);
    var medicines=typeof window.getMeds==='function'?window.getMeds(departmentId)||[]:[];
    medicines.forEach(function(medicine){
      var id=text(medicine&&medicine.id);
      if(!id)return;
      var normalized={
        id:id,
        name:text(medicine.name||medicine.medName||medicine.medicineName||medicine.drugName)||id,
        high:highAlert(medicine)
      };
      byDepartment[departmentId+'|'+id]=normalized;
      // Prefer a real name over an earlier legacy id-only record.
      if(!byId[id]||byId[id].name===id)byId[id]=normalized;
    });
  });
  return {byDepartment:byDepartment,byId:byId};
}

function requestLineSnapshot(request,id){
  request=request||{};id=text(id);
  var groups=[request.items,request.requestedItems,request.requestItems,request.lines,request.medications,request.meds];
  for(var i=0;i<groups.length;i++){
    var found=(Array.isArray(groups[i])?groups[i]:[]).find(function(item){
      return item&&text(item.medId||item.medicationId||item.catalogId||item.id)===id;
    });
    if(found)return found;
  }
  return {};
}

export function resolveAnalyticsMedicine(line,departmentId,index,request){
  line=line||{};
  index=index||buildAnalyticsMedicineIndex();
  var id=text(line.medId||line.medicationId||line.catalogId||line.id);
  var record=index.byDepartment[text(departmentId)+'|'+id]||index.byId[id]||{};
  var snapshot=requestLineSnapshot(request,id);
  var direct=text(line.medName||line.name||line.medicineName||line.drugName||line.itemName||snapshot.medName||snapshot.name||snapshot.medicineName||snapshot.drugName||snapshot.itemName);
  // Generated request ids (for example m_178...) are identifiers, not names.
  var usableDirect=direct&&!/^m_[a-z0-9_]+$/i.test(direct)?direct:'';
  // A current catalogue record may itself be a legacy generated id. A readable
  // snapshot captured on the fulfilled line is more useful than that id and
  // keeps historical reports readable after catalogue migrations.
  var usableRecord=text(record.name);
  if(/^m_[a-z0-9_]+$/i.test(usableRecord))usableRecord='';
  return {
    id:id,
    name:usableDirect||usableRecord||id||'Unknown medicine',
    high:record.high===true||highAlert(line)||highAlert(snapshot)
  };
}

(function(){
'use strict';

/*
 * R6.65 is protected by a CSP that intentionally blocks inline event handlers.
 * Older feature modules still create trusted application controls with onclick,
 * onchange, oninput, and onkeydown attributes. This bridge removes those
 * attributes as soon as they enter the DOM and binds their small, known action
 * grammar without eval, Function, or unsafe-inline.
 */
var ALLOWED=new Set((
  'CM OM showPg captureFrame restartScanner openManageCats openAnnouncementEditor toggleAnnouncement deleteAnnouncement saveAnnouncement toggleAnnouncementDepartments '+
  'moveManagedCategory removeManagedCategory renameManagedCategory openEditShelf removeShelf openNoteReply quickResolve '+
  'editReqWindow toggleWindow delWindow editDispSlot delSlot setRequestGridDay saveRequestCountLimits '+
  'openEditDrug moveDrugOrder delDrug onInvCheck openEditExpiry delBatch openAddExpiryForMed toggleShelfMedication '+
  'impToggleRow impEdit ctlPdfSetField ctlSavePendingPdfExpiry ctlAddBatchEditorRow ctlSaveBatchEditor ctlDispTypeChanged ctlConfirmDispense ctlSavePrintLogo ctlToggleDeptMed ctlEditDeptMedicine ctlRemoveDeptMedicine '+
  'ctlAddCatalogMedicine ctlEditCatalogMedicine ctlEditWarehouseStock ctlSendToPharmacy ctlEditPharmacyStock ctlOpenDispense ctlReceiveDelivery ctlImportMasterFile ctlImportMasterText '+
  'ctlDeptFinalApply ctlDeptFinalToggle ctlConfirmDepartmentPrint renderDepartmentControlledPanel ctlEditDeptMedicineFromAggregate ctlRemoveDeptMedicineFromAggregate '+
  'crashPrint crashAddItem crashReportOpen ccxOpenReport ccCrashActionChanged ccCrashResponsePreview '+
  'r17CrashSaveDetails r18OpenCrashCorrection r18CrashCorrectionAddBatch r17CrashRenderMatrix '+
  'acc2SetAdminTab acc2RefreshMedicationList acc2SaveAssignment acc2CancelAssignmentEdit acc2EditAssignment acc2ToggleAssignment acc2DeleteAssignment acc2SetFilter acc2Decision acc2SetReceiptDept acc2RegimenDeptChanged acc2SaveRegimenVersion acc2CancelRegimenEdit acc2ActivateRegimen acc2ToggleRegimenPause acc2StartRegimenVersion acc2DeleteRegimen acc2SubmitUsage acc2ToggleAllReceipt acc2CreateReceipt acc3SetDept acc3AddMedicine acc3ToggleMedicine acc3SaveRegimen acc3CancelEdit acc3EditRegimen acc3PrintRegimen acc3ToggleRegimen '+
  'controlledStorageCountsChanged controlledStorageEditUnit controlledStoragePrint controlledStorageDeleteUnit controlledStorageAssignByName controlledStorageValidateSearch '+
  'bulkReplacementToggleLimits runBulkReplacement aaFinalSaveExpiryRules phExpiryToggleDept phExpirySetView phExpirySelectAllDepartments phExpiryClearDepartments phExpiryEditRules '+
  'v13InventorySelect updateAllInventoryMergeCount v13SelectVisibleInventory v13ApplyBulkClassification openMergeInventoryNames undoLatestInventoryNameMerge v13OpenBulkClassification v13WLoadMore v13ApplyControlledClassification v13BulkReplacementClassOnly '+
  'v13XClose v13XAddBatch v13XSaveCatalogMed v13XSaveStock valQ v14SaveEditReq2 v14SetPrintFilter v16ToggleScope v16ToggleMultiApplicable v16ApplyMultiClean v16ManageHiddenCategories v16SaveHiddenCats '+
  'whBulkResolveRow whBulkReceiveOpen whBulkDispenseOpen whReceiveOpen whReceiveSelect confirmMergeInventoryNames purgeOrphanDepartment print'
).split(/\s+/).filter(Boolean));

var ATTRIBUTE_EVENTS={onclick:'click',onchange:'change',oninput:'input',onsubmit:'submit',onkeydown:'keydown',onkeyup:'keyup'};

function report(error,expression){
  console.error('CSP-safe legacy action failed:',expression,error);
  if(typeof window.toast==='function')window.toast('Action could not be completed. / تعذر تنفيذ العملية','err');
}
function splitTop(value,separator){
  var out=[],start=0,quote='',escape=false,depth=0;
  for(var i=0;i<value.length;i++){
    var ch=value[i];
    if(escape){escape=false;continue}
    if(ch==='\\'){escape=true;continue}
    if(quote){if(ch===quote)quote='';continue}
    if(ch==='\''||ch==='"'){quote=ch;continue}
    if(ch==='('||ch==='['||ch==='{')depth++;
    else if(ch===')'||ch===']'||ch==='}')depth=Math.max(0,depth-1);
    else if(ch===separator&&depth===0){out.push(value.slice(start,i));start=i+1}
  }
  out.push(value.slice(start));return out;
}
function stringValue(raw){
  var body=raw.slice(1,-1);
  return body.replace(/\\(['"\\nrt])/g,function(_,ch){return ch==='n'?'\n':ch==='r'?'\r':ch==='t'?'\t':ch});
}
function argument(raw,element,event){
  raw=String(raw||'').trim();
  var numeric=false;if(raw[0]==='+'){numeric=true;raw=raw.slice(1).trim()}
  var value;
  if((raw[0]==='\''&&raw[raw.length-1]==='\'')||(raw[0]==='"'&&raw[raw.length-1]==='"'))value=stringValue(raw);
  else if(raw==='true'||raw==='false')value=raw==='true';
  else if(raw==='null')value=null;
  else if(raw==='this')value=element;
  else if(raw==='event')value=event;
  else if(raw==='this.value')value=element.value;
  else if(raw==='this.checked')value=!!element.checked;
  else if(raw==='this.files[0]')value=element.files&&element.files[0];
  else if(/^this\.dataset\.[A-Za-z_$][\w$]*$/.test(raw))value=element.dataset[raw.split('.').pop()];
  else if(/^this\.getAttribute\((['"]).*\1\)$/.test(raw)){var match=raw.match(/^this\.getAttribute\((['"])(.*)\1\)$/);value=element.getAttribute(match[2])}
  else if(/^-?\d+(?:\.\d+)?$/.test(raw))value=Number(raw);
  else throw new Error('Unsupported legacy action argument: '+raw);
  return numeric?Number(value):value;
}
function runCall(statement,element,event){
  var match=statement.match(/^(?:window\.)?([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if(!match)return false;
  var name=match[1];
  if(!ALLOWED.has(name))throw new Error('Legacy action is not allowlisted: '+name);
  var fn=name==='print'?window.print:window[name];
  if(typeof fn!=='function')throw new Error('Legacy action is unavailable: '+name);
  var rawArgs=match[2].trim(),args=rawArgs?splitTop(rawArgs,',').map(function(raw){return argument(raw,element,event)}):[];
  var result=fn.apply(element,args);
  if(result&&typeof result.catch==='function')result.catch(function(error){report(error,statement)});
  return true;
}
function runStatement(statement,element,event){
  statement=String(statement||'').trim().replace(/^return\s+/,'');
  if(!statement)return true;
  var guarded=statement.match(/^if\(typeof (?:window\.)?([A-Za-z_$][\w$]*)===['"]function['"]\)([\s\S]+)$/);
  if(guarded){if(typeof window[guarded[1]]!=='function')return true;statement=guarded[2].trim()}
  var exists=statement.match(/^if\(window\.([A-Za-z_$][\w$]*)\)([\s\S]+)$/);
  if(exists){if(!window[exists[1]])return true;statement=exists[2].trim()}
  if(/^if\(event\.key===['"]Enter['"]\)\{?this\.blur\(\)\}?$/.test(statement)){if(event.key==='Enter')element.blur();return true}
  if(statement==='this.parentElement.remove()'){if(element.parentElement)element.parentElement.remove();return true}
  var closestRemove=statement.match(/^this\.closest\((['"])(.+)\1\)\.remove\(\)$/);
  if(closestRemove){var closest=element.closest(closestRemove[2]);if(closest)closest.remove();return true}
  var byIdRemove=statement.match(/^document\.getElementById\((['"])(.+)\1\)\.remove\(\)$/);
  if(byIdRemove){var found=document.getElementById(byIdRemove[2]);if(found)found.remove();return true}
  var byIdClick=statement.match(/^document\.getElementById\((['"])(.+)\1\)\.click\(\)$/);
  if(byIdClick){var clickable=document.getElementById(byIdClick[2]);if(clickable)clickable.click();return true}
  var toggle=statement.match(/^this\.closest\((['"])(.+)\1\)\.classList\.toggle\((['"])(.+)\3,this\.checked\)$/);
  if(toggle){var host=element.closest(toggle[2]);if(host)host.classList.toggle(toggle[4],!!element.checked);return true}
  if(statement==='this.value=Math.min(Math.max(0,+this.value||0),+this.dataset.max)'){
    element.value=Math.min(Math.max(0,Number(element.value)||0),Number(element.dataset.max));return true;
  }
  if(statement==='ACC2_UI.filters.medicine=this.value'){
    if(window.ACC2_UI&&window.ACC2_UI.filters)window.ACC2_UI.filters.medicine=element.value;return true;
  }
  if(statement==='clearTimeout(window.acc2FilterTimer)'){clearTimeout(window.acc2FilterTimer);return true}
  if(statement==='window.acc2FilterTimer=setTimeout(r17AccRenderVerify,140)'){
    if(typeof window.r17AccRenderVerify==='function')window.acc2FilterTimer=setTimeout(window.r17AccRenderVerify,140);return true;
  }
  return runCall(statement,element,event);
}
function execute(expression,element,event){
  var statements=splitTop(String(expression||''),';');
  for(var i=0;i<statements.length;i++){
    if(!runStatement(statements[i],element,event))throw new Error('Unsupported legacy action: '+statements[i]);
  }
}
function bindAttribute(element,attribute,eventName){
  var expression=element.getAttribute(attribute);if(!expression)return;
  element.removeAttribute(attribute);
  element.addEventListener(eventName,function(event){
    if(eventName==='click'||eventName==='submit')event.preventDefault();
    try{execute(expression,element,event)}catch(error){report(error,expression)}
  });
}
function bindTree(root){
  if(!root||root.nodeType!==1)return;
  Object.keys(ATTRIBUTE_EVENTS).forEach(function(attribute){
    if(root.hasAttribute&&root.hasAttribute(attribute))bindAttribute(root,attribute,ATTRIBUTE_EVENTS[attribute]);
    root.querySelectorAll('['+attribute+']').forEach(function(element){bindAttribute(element,attribute,ATTRIBUTE_EVENTS[attribute])});
  });
}
function install(){
  bindTree(document.documentElement);
  new MutationObserver(function(records){records.forEach(function(record){
    if(record.type==='attributes')bindTree(record.target);
    else record.addedNodes.forEach(bindTree);
  })}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:Object.keys(ATTRIBUTE_EVENTS)});
  document.documentElement.setAttribute('data-asdh-csp-bridge','ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

export {};

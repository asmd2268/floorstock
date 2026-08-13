(function(){
'use strict';

/* Returnable setters. Local-only printer/UI preferences remain intentionally local. */
/* Audit records are persistent too, but an audit failure never masks a completed primary action. */
window.auditAction=function(action,meta){
  try{var u=typeof actualUser==='function'?actualUser():(window.CU||{}),name=typeof actualActorName==='function'?actualActorName():(u.username||u.email||'Unknown');return S.push('audit_log',{action:action,meta:meta||{},at:typeof nowISO==='function'?nowISO():new Date().toISOString(),actorId:u.id||'',actor:name,effectiveRole:(window.CU&&CU.role)||'',masterActing:typeof isMasterActual==='function'?isMasterActual():!!u.master}).catch(function(err){console.error('Audit save failed',err);return false})}catch(err){console.error('Audit save failed',err);return Promise.resolve(false)}
};
window.ctlMove=function(v){
  var many=Array.isArray(v),input=many?v:[v],stamp=Date.now(),actor=(window.CU&&(CU.username||CU.email))||'Unknown';
  var records=input.filter(Boolean).map(function(item,index){var x=Object.assign({},item);x.id=x.id||'ctl_'+stamp+'_'+index+'_'+Math.random().toString(36).slice(2,7);x.at=x.at||(typeof nowISO==='function'?nowISO():new Date().toISOString());x.by=x.by||actor;return x});
  if(!records.length)return Promise.resolve(many?[]:null);
  var promise=many?S.s('controlled_moves',(typeof ctlMoves==='function'?(ctlMoves()||[]):[]).concat(records)).then(function(){return records}):S.push('controlled_moves',records[0]);
  promise.catch(function(err){console.error('Controlled movement save failed',err)});return promise
};

/* Inventory add/edit: success is shown only after Firestore confirms the write. */
window.saveDrug=async function(){
  var n=el('dname').value.trim();if(!n)return toast('Enter medication name','err');
  var deptId=window.EDID?(window.EDDEPT||el('ddept-sel').value):el('ddept-sel').value;if(!deptId)return toast('Select a department','err');
  var data={name:n,category:el('dcat').value,min:+el('dmin').value||0,max:+el('dmax').value||1,monthly:el('dmly').value?+el('dmly').value:null,high_alert:el('cha2').checked,hazard:el('chaz').checked,lasa:el('chls').checked,refrigerated:!!(el('chcool')&&el('chcool').checked)};
  try{
    if(window.EDID){
      var old=getMeds(deptId).find(function(m){return String(m.id)===String(EDID)});if(!old)throw new Error('Medicine no longer exists');
      await updMed(deptId,EDID,data);
      if(fsR17MedNorm(old.name)!==fsR17MedNorm(n))await fsR17RefreshMedicationReferences(deptId,EDID,old.name,n);
      if(typeof auditAction==='function')auditAction('medicine_renamed_or_edited',{deptId:deptId,medId:EDID,oldName:old.name,newName:n,sortOrder:old.sortOrder});
    }else{
      var added=await pushMed(deptId,Object.assign({},data,{createdAt:fsR17Now()}));
      if(typeof auditAction==='function')auditAction('medicine_added',{deptId:deptId,medId:added.id,name:added.name,sortOrder:added.sortOrder});
    }
    var ds=el('ddept-sel');if(ds)ds.disabled=false;CM('mdrug');renderInv();toast(window.EDID?'Updated without creating a new medicine ✓':'Added as a new medicine ✓','succ');window.EDID=null;window.EDDEPT=null;
  }catch(err){console.error(err);toast('Save failed — '+String(err&&err.message||err),'err')}
};
window.bulkChangeCategory=async function(){var ids=typeof getSelectedMedIds==='function'?getSelectedMedIds():[],newCat=(el('bulk-cat-sel')||{}).value,deptId=typeof getInvDept==='function'?getInvDept():'';if(!ids.length)return toast('Select medications first','err');if(!newCat)return toast('Choose a category to apply','err');try{var set=new Set(ids.map(String)),meds=(getMeds(deptId)||[]).map(function(m){return set.has(String(m.id))?Object.assign({},m,{category:newCat}):m});await setMeds(deptId,meds);toast(ids.length+' medications moved to "'+newCat+'" and saved ✓','succ');if(typeof clearInvSelection==='function')clearInvSelection();renderInv()}catch(err){console.error(err);toast('Category change was not saved.','err')}};

/* Request submission and fulfillment: no early success message. */
var requestSaving=false;
window.submitReq=async function(){
  if(requestSaving)return toast('[DBG] requestSaving locked','err');
  if(!window.CU||String(CU.role)!=='department')return toast('[DBG] CU='+JSON.stringify(window.CU&&{role:CU.role,deptId:CU.deptId}),'err');
  if(typeof window.getNewRequestGateState==='function'){
    var gate;try{gate=window.getNewRequestGateState(CU.deptId)}catch(gateErr){return toast('[DBG] gate threw: '+String(gateErr&&gateErr.message||gateErr),'err')}
    if(gate&&gate.blocked)return toast((gate.reasonAr||'')+'\n'+(gate.reasonEn||''),'err');
  }else{
    var windowCheck=typeof isRequestAllowed==='function'?isRequestAllowed(CU.deptId):{allowed:true};if(!windowCheck.allowed){var next=windowCheck.next?(windowCheck.next.day+' '+windowCheck.next.time):'';return toast('Ordering is currently unavailable.'+(next?' Next: '+next:''),'err')}
    var monthly=typeof getMonthlyLimit==='function'?getMonthlyLimit(CU.deptId):null;if(monthly!==null&&typeof getMonthlyReqCount==='function'&&getMonthlyReqCount(CU.deptId)>=monthly)return toast('Monthly request limit reached ('+monthly+'/month). Contact pharmacy.','err');
    if(typeof window.checkRequestCountLimits==='function'){var countLimit=window.checkRequestCountLimits(CU.deptId);if(countLimit&&countLimit.blocked)return toast(countLimit.reason,'err')}
  }
  var items=Array.from(document.querySelectorAll('.rqi')).filter(function(i){return Number(i.value)>0}).map(function(i){return {medId:i.dataset.mid,qty:Number(i.value)}});
  if(!items.length)return toast('Enter at least one quantity','err');
  var nextDispense=typeof getNextDispSlot==='function'?getNextDispSlot(CU.deptId):null,btn=document.querySelector('#pg-newreq button[data-asdh-binding="b047"]');
  requestSaving=true;if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Saving… / جاري الحفظ'}
  try{var created=typeof nowISO==='function'?nowISO():new Date().toISOString(),deadline=typeof window.getRequestEditDeadline==='function'?window.getRequestEditDeadline(CU.deptId,created):null,payload={deptId:CU.deptId,deptName:CU.deptName,items:items,status:'pending',created:created,editUntil:Number.isFinite(deadline)?new Date(deadline).toISOString():null,scheduledFor:nextDispense?nextDispense.scheduledAt:null,scheduledLabel:nextDispense&&nextDispense.slot?nextDispense.slot.label:''};await S.push('requests',payload);await auditAction('request_submitted',{deptId:CU.deptId,itemCount:items.length,editUntil:payload.editUntil});toast('Request submitted and saved — '+items.length+' items ✓','succ');if(typeof renderReqForm==='function')renderReqForm();if(typeof renderMyReqs==='function')renderMyReqs()}catch(err){console.error(err);toast('Request was not saved. Check the connection and retry.','err')}finally{requestSaving=false;if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Submit';delete btn.dataset.oldText}if(typeof window.refreshNewRequestGate==='function')window.refreshNewRequestGate()}
};
var fulfillSaving=false;
window.submitFulfill=async function(){
  if(fulfillSaving)return;
  var current=(typeof gr==='function'?gr():[]).find(function(request){return String(request.id)===String(window.FRID)});
  var editing=!!(current&&current.status==='fulfilled');
  if(editing){
    if(typeof window.canEditFulfillmentRequest!=='function'||!window.canEditFulfillmentRequest(current))return toast('The fulfillment editing window has expired or this account is outside the permitted scope.','err');
  }else if(typeof canManageRequests==='function'&&!canManageRequests())return toast('No request edit permission','err');
  var inputs=Array.from((document.getElementById('ftbl')||document).querySelectorAll('input[data-med]'));inputs.forEach(function(x){x.style.borderColor='';x.style.boxShadow=''});
  var missing=inputs.find(function(x){return String(x.value).trim()===''});if(missing){missing.style.borderColor='var(--rd)';missing.focus();return toast('Enter the dispensed quantity for every item. Enter 0 if not dispensed.','err')}
  var bad=inputs.find(function(x){var q=Number(x.value);return !isFinite(q)||q<0});if(bad){bad.style.borderColor='var(--rd)';bad.focus();return toast('Dispensed quantity must be zero or a positive number.','err')}
  var dispensed=inputs.map(function(x){return {medId:x.dataset.med,qty:Number(x.value)}}),id=window.FRID,btn=document.getElementById('fulfill-btn');fulfillSaving=true;if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Saving…'}
  try{
    var stamp=typeof nowISO==='function'?nowISO():new Date().toISOString(),actor=typeof actualUser==='function'?(actualUser()||{}):(window.CU||{}),actorName=typeof actualActorName==='function'?actualActorName():(actor.username||actor.email||'');
    var beforeDispensed=editing?(current.dispensed||[]).map(function(x){return {medId:x.medId,qty:Number(x.qty)||0}}):[];
    var changes=editing?{dispensed:dispensed,fulfillmentEditedAt:stamp,fulfillmentEditedBy:actorName,fulfillmentEditedById:actor.id||'',fulfillmentEditedEffectiveRole:(window.CU&&CU.role)||'',fulfillmentEditRevision:Number(current.fulfillmentEditRevision||0)+1}:{dispensed:dispensed,status:'fulfilled',fulfilledAt:stamp,fulfilledBy:actorName,fulfilledById:actor.id||'',fulfilledEffectiveRole:(window.CU&&CU.role)||''};
    await S.upd('requests',id,changes);
    if(editing){await auditAction('request_fulfillment_edited',{requestId:id,deptId:current.deptId||'',fulfilledAt:current.fulfilledAt||'',revision:changes.fulfillmentEditRevision,before:beforeDispensed,after:dispensed})}
    else await auditAction('request_fulfilled',{requestId:id,deptId:current&&current.deptId||''});
    CM('mfulfill');renderReqs();if(typeof renderMyReqs==='function'&&window.CU&&CU.role==='department')renderMyReqs();if(typeof renderDash==='function')renderDash();toast(editing?'Fulfillment update saved and audited ✓':'Fulfillment saved permanently ✓','succ')
  }catch(err){console.error(err);toast('Fulfillment was not saved. Please retry.','err')}finally{fulfillSaving=false;if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Confirm';delete btn.dataset.oldText}}
};

/* Expiry and department receipt saves are batched into one Firestore write. */
window.saveAlertSettings=async function(){if(!window.CU)return;var d1=Math.max(1,+el('alert-days1').value||30),d2=Math.max(1,+el('alert-days2').value||7);if(d2>=d1)return toast('Urgent alert must be shorter than early alert','err');try{await setAlertSettings(CU.deptId,{d1:d1,d2:d2});toast('Department alert periods saved ✓','succ');renderShelfAlertSettings()}catch(e){toast('Alert settings were not saved.','err')}};
window.delBatch=async function(id,button){
  if(!await uiConfirm('Delete this expiry record? Batch/Lot may be blank.'))return;
  if(button)button.disabled=true;
  try{
    await delExpBatch(CU.deptId,id);
    renderShelves();
    toast('Expiry record deleted and verified ✓','info');
  }catch(e){
    console.error(e);
    if(button)button.disabled=false;
    toast(String(e&&e.message||'Expiry deletion was not saved.'),'err');
  }
};
window.saveExpiry=async function(){
  if(!window.CU)return;
  var medId=el('exp-med-sel').value;
  var date=el('exp-date-inp').value;
  if(!medId||!date){
    return toast(
      'Medicine and expiry date are required. Batch/Lot is optional.',
      'err'
    );
  }

  var button=el('exp-save-btn');
  var editId=el('exp-edit-id').value;
  var lot=el('exp-batch-inp').value.trim();
  var row={
    medId:medId,
    batch:lot,
    lot:lot,
    date:date,
    expiry:date
  };

  if(button)button.disabled=true;
  try{
    if(editId)await updExpBatch(CU.deptId,editId,row);
    else await addExpBatch(CU.deptId,row);

    CM('mexpiry');
    renderShelves();
    toast(
      'Expiry saved and verified. Batch/Lot remained optional ✓',
      'succ'
    );
  }catch(e){
    console.error(e);
    toast(String(e&&e.message||'Expiry was not saved.'),'err');
  }finally{
    if(button)button.disabled=false;
  }
};
window.v13SaveReceive=async function(){var modal=el('v13-receive-modal'),requestId=modal&&modal.dataset?String(modal.dataset.requestId||''):'';var req=(gr()||[]).find(function(x){return String(x.id)===requestId});if(!req)return toast('Request not available','err');var arr=(getExpiry(CU.deptId)||[]).slice(),received=[];document.querySelectorAll('#v13-receive-body tr[data-med]').forEach(function(tr){var date=tr.querySelector('.v13-r-exp').value,lot=tr.querySelector('.v13-r-lot').value.trim(),medId=tr.dataset.med,qty=Number(tr.dataset.qty||0);if(date){arr.push({id:'ex_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),medId:medId,expiry:date,date:date,batch:lot,lot:lot,qty:qty,sourceRequestId:requestId,receivedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()});received.push({medId:medId,qty:qty,expiry:date,batch:lot})}});try{await setExpiry(CU.deptId,arr);await S.upd('requests',requestId,{receivedAt:typeof nowISO==='function'?nowISO():new Date().toISOString(),receivedBy:typeof actualActorName==='function'?actualActorName():CU.username,receivedExpiry:received});await auditAction('department_request_received',{requestId:requestId,items:received});if(modal&&modal.dataset)delete modal.dataset.requestId;CM('v13-receive-modal');if(typeof renderMyReqs==='function')renderMyReqs();toast('All received items saved permanently ✓','succ')}catch(e){console.error(e);toast('Received items were not fully saved.','err')}};

/* Notes. */
window.submitNote=async function(){if(!window.CU||CU.role!=='department')return;var body=el('note-body').value.trim();if(!body)return toast('Write a note first','err');var notes=(getNotes()||[]).slice(),priority=el('note-priority').value,note={id:'n_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),deptId:CU.deptId,deptName:CU.deptName,username:CU.username,type:el('note-type').value,priority:priority,medName:el('note-med-name').value.trim(),body:body,status:priority==='urgent'?'urgent':'open',reply:'',created:typeof nowISO==='function'?nowISO():new Date().toISOString(),updatedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()};notes.push(note);try{await setNotes(notes);el('note-body').value='';el('note-med-name').value='';renderDeptNotes();updateNotesBadge();toast('Note submitted and saved ✓','succ')}catch(e){toast('Note was not saved.','err')}};
window.saveNoteReply=async function(){var id=el('note-reply-id').value,notes=(getNotes()||[]).map(function(n){return Object.assign({},n)}),i=notes.findIndex(function(n){return String(n.id)===String(id)});if(i<0)return;notes[i].reply=el('note-reply-txt').value.trim();notes[i].status=el('note-reply-status').value;notes[i].updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();try{await setNotes(notes);CM('mnote-reply');renderPharmNotes();updateNotesBadge();toast('Reply saved permanently ✓','succ')}catch(e){toast('Reply was not saved.','err')}};
window.quickResolve=async function(id){var notes=(getNotes()||[]).map(function(n){return Object.assign({},n)}),i=notes.findIndex(function(n){return String(n.id)===String(id)});if(i<0)return;notes[i].status='resolved';notes[i].updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();try{await setNotes(notes);renderPharmNotes();updateNotesBadge();toast('Marked as resolved and saved ✓','succ')}catch(e){toast('Resolution was not saved.','err')}};

/* Shelves. */
window.saveShelf=async function(){if(!window.CU)return;var name=el('shelf-name-inp').value.trim();if(!name)return toast('Enter shelf name','err');var editId=el('shelf-edit-id').value,data={name:name,desc:el('shelf-desc-inp').value.trim()};try{if(editId)await updShelf(CU.deptId,editId,data);else await addShelf(CU.deptId,data);CM('mshelf');renderShelves();toast('Shelf saved permanently ✓','succ')}catch(e){toast('Shelf was not saved.','err')}};
window.removeShelf=async function(id){if(!await uiConfirm('Remove this shelf? Medications will become unassigned.'))return;try{var meds=(getMeds(CU.deptId)||[]).map(function(m){return String(m.shelfId)===String(id)?Object.assign({},m,{shelfId:null}):m});await Promise.all([setMeds(CU.deptId,meds),delShelf(CU.deptId,id)]);renderShelves();toast('Shelf removed and saved ✓','info')}catch(e){toast('Shelf removal was not saved.','err')}};

/* Categories: one write per department, all awaited. */
window.addCategory=async function(){var n=el('new-cat-inp').value.trim();if(!n)return toast('Enter a category name','err');var cats=(getCategories()||[]).slice();if(cats.indexOf(n)>-1)return toast('Already exists','err');var sol=cats.filter(function(x){return String(x).trim().toLowerCase()==='solutions'});cats=cats.filter(function(x){return String(x).trim().toLowerCase()!=='solutions'});cats.push(n);cats=cats.concat(sol.length?sol:['Solutions']);try{await setCategories(cats);el('new-cat-inp').value='';renderCatList();refreshCatSelectors();toast('"'+n+'" added and saved ✓','succ')}catch(e){toast('Category was not saved.','err')}};

/* Schedule and limits. */
// Schedule CRUD moved to modules/68-schedule-controller.js.

/* Departments are committed as one awaited operation set. */
window.addDept=async function(){
  var n=el('ndname').value.trim();if(!n)return toast('Enter department name','err');
  var base=n.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,20)||'dept',id=base,c=2;
  while((gd()||[]).some(function(d){return d.id===id})){id=base+'_'+c++}
  var copyMode=(el('ndcopy')||{value:'empty'}).value||'empty',meds=[];
  if(copyMode==='default')meds=(window.MEDS||[]).map(function(m){return {id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),name:m.n,category:m.c,min:m.mn,max:m.mx,monthly:null,high_alert:!!m.ha,hazard:!!m.hz,lasa:!!m.ls,created:typeof nowISO==='function'?nowISO():new Date().toISOString()}});
  else if(copyMode!=='empty')meds=(getMeds(copyMode)||[]).map(function(m){return Object.assign({},m,{id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)})});
  var department={id:id,name:n,created:typeof nowISO==='function'?nowISO():new Date().toISOString()},created=false;
  try{
    await S.push('departments',department);created=true;
    if(meds.length&&typeof window.inventorySafetyApprovedBulk==='function')await window.inventorySafetyApprovedBulk('create_department_inventory',function(){return setMeds(id,meds)});
    else await setMeds(id,meds);
    el('ndname').value='';renderUsers();fillDS();populateInvDeptSel();if(typeof window.renderRequestHourGridUI==='function')window.renderRequestHourGridUI();
    toast('"'+n+'" added and saved with '+meds.length+' medication(s) ✓','succ')
  }catch(error){
    console.error(error);
    if(created){
      try{await S.s('departments',(S.g('departments')||[]).filter(function(d){return String(d.id)!==String(id)}))}catch(rollbackError){console.error('Department rollback failed',rollbackError)}
      try{if(S.g('meds_'+id)!=null)await S.rm('meds_'+id)}catch(cleanupError){console.error('New department inventory cleanup failed',cleanupError)}
    }
    toast('Department creation was rolled back; no partial department was kept.','err')
  }
};
window.delDept=async function(id){
  var dept=(gd()||[]).find(function(item){
    return String(item.id)===String(id);
  });
  if(!dept)return window.purgeOrphanDepartment(id);

  var linked=(gu()||[]).filter(function(user){
    return [
      user&&user.deptId,
      user&&user.departmentId,
      user&&user.department
    ].some(function(value){
      return String(value||'')===String(id);
    });
  });

  if(linked.length){
    if(typeof toast==='function'){
      toast(
        'Delete or reassign '+linked.length+
        ' linked user account(s) before deleting this department.',
        'err'
      );
    }
    if(typeof showPg==='function')showPg('pg-users');
    return false;
  }

  var linkedCarts=(S.g('crash_carts')||[]).filter(function(cart){
    return String(cart&&cart.deptId||'')===String(id);
  });

  if(linkedCarts.length){
    if(typeof toast==='function'){
      toast(
        'Move or delete '+linkedCarts.length+
        ' crash cart(s) before deleting this department.',
        'err'
      );
    }
    if(typeof showPg==='function')showPg('pg-crash-ops');
    return false;
  }

  var count=(getMeds(id)||[]).length;
  var confirmed=await uiConfirm(
    'Delete department "'+(dept.name||id)+'" permanently?\n\n'+
    'This removes '+count+
    ' medications, expiry, shelves, alerts, and controlled department custody, '+
    'request schedules, limits, and current accountability balances. '+
    'Historical completed requests are retained for audit.'
  );
  if(!confirmed)return false;

  var deletionReport;
  try{
    deletionReport=await window.floorstockPurgeDepartmentState(
      id,
      [id,dept.name,dept.code].filter(Boolean),
      true
    );
  }catch(error){
    console.error(error);
    if(typeof toast==='function'){
      toast(
        'Department deletion stopped at: '+
        String(error&&error.message||error),
        'err'
      );
    }
    return false;
  }

  var uiFailures=window.floorstockDeleteUiRefresh();

  if(typeof toast==='function'){
    if(uiFailures.length){
      toast(
        'Department was deleted and verified. One screen refresh failed; '+
        'reopen the page to refresh that panel.',
        'info'
      );
    }else if(deletionReport.optionalFailed.length){
      toast(
        'Department deleted. A public QR cleanup will retry later.',
        'info'
      );
    }else{
      toast('Department deleted permanently and verified ✓','succ');
    }
  }

  return deletionReport;
};

})();

export {};

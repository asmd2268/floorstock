/* ASDHealth R6.65 Modular
 * Original script position: 8
 * Original id: (none)
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
  'use strict';
  function E(id){return document.getElementById(id)}
  function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
  function todayISO(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function activeExpiry(deptId,medId){
    var t=todayISO();
    return (getExpiry(deptId)||[]).filter(function(x){return x.medId===medId&&x.date&&x.date>=t});
  }
  function medKey(m){return norm(m.name)+'|'+norm(m.strength||m.dose||'')}
  function allTemplates(){
    var map={};
    (gd()||[]).forEach(function(d){(getMeds(d.id)||[]).forEach(function(m){var k=medKey(m);if(k&&!map[k])map[k]=Object.assign({},m,{_key:k,_sourceDept:d.id})})});
    return Object.keys(map).map(function(k){return map[k]}).sort(function(a,b){return String(a.name).localeCompare(String(b.name))});
  }
  function replacementAllowed(){return !!(window.CU&&(CU.master||CU.role==='pharmacy'||CU.role==='pharmacy_manager'))}
  async function cleanRetired(deptId){
    var meds=(getMeds(deptId)||[]).slice(),exp=(getExpiry(deptId)||[]).slice(),changed=false;
    var keep=[];
    meds.forEach(function(m){
      if(!m.floorStockRetired){keep.push(m);return}
      if(activeExpiry(deptId,m.id).length){keep.push(m);return}
      exp=exp.filter(function(x){return x.medId!==m.id});changed=true;
    });
    if(changed){await setMeds(deptId,keep);await setExpiry(deptId,exp)}
    return changed;
  }
  async function cleanAllRetired(){for(var d of (gd()||[])){await cleanRetired(d.id)}}

  function ensureButton(){
    if(!replacementAllowed())return;
    var pg=E('pg-inv');if(!pg||E('bulk-replace-med-btn'))return;
    var top=pg.querySelector('.fl.ic.jb.mb14 .fl.g8.ic')||pg.querySelector('.fl.g8.ic');if(!top)return;
    var b=document.createElement('button');b.id='bulk-replace-med-btn';b.className='btn bg';b.innerHTML='⇄ Bulk Replacement';b.onclick=openBulkReplacement;top.appendChild(b);
  }
  function ensureModal(){
    if(E('mbulk-replacement'))return;
    var bg=document.createElement('div');bg.className='modal-bg';bg.id='mbulk-replacement';
    bg.innerHTML='<div class="modal" style="width:820px;max-width:97vw"><div class="mh"><span class="mt">⇄ Bulk Floor Stock Medication Replacement</span><button class="xbtn" onclick="CM(\'mbulk-replacement\')">✕</button></div>'+
      '<div class="frow"><div class="fg"><label>Medication to replace</label><select id="br-old"><option value="">Choose old medication...</option></select></div><div class="fg"><label>Replacement medication</label><select id="br-new"><option value="">Choose new medication...</option></select></div></div>'+
      '<div class="card" style="margin-bottom:12px"><div class="cb" style="padding:12px"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="br-override" style="width:auto;margin:0" onchange="bulkReplacementToggleLimits()"> Override inherited Min / Max for every department</label><div class="frow" id="br-limits" style="display:none;margin-top:10px"><div><label>New Min</label><input type="number" id="br-min" min="0" placeholder="Leave blank to inherit"></div><div><label>New Max</label><input type="number" id="br-max" min="0" placeholder="Leave blank to inherit"></div></div></div></div>'+
      '<div class="alert-banner-y" style="font-size:12px"><b>Expiry rule:</b> If the old medication still has an active expiry batch in a department, the new medication is added but the old one remains marked <b>Not available for Floor Stock requests</b>. It is removed automatically after the final expiry date passes or is deleted.</div>'+
      '<div id="br-preview" style="max-height:260px;overflow:auto;border:1px solid var(--bd);border-radius:8px;margin-bottom:12px"></div>'+
      '<div class="fl jb"><button class="btn bg" onclick="CM(\'mbulk-replacement\')">Cancel</button><button class="btn bp" onclick="runBulkReplacement()">Apply replacement</button></div></div>';
    document.body.appendChild(bg);
    E('br-old').addEventListener('change',renderBulkReplacementPreview);E('br-new').addEventListener('change',renderBulkReplacementPreview);
  }
  window.bulkReplacementToggleLimits=function(){E('br-limits').style.display=E('br-override').checked?'grid':'none'};
  window.openBulkReplacement=function(){
    ensureModal();if(typeof window.extendBulkReplacementUi==='function')window.extendBulkReplacementUi();var list=allTemplates(),opts=list.map(function(m){return '<option value="'+esc(m._key)+'">'+esc(m.name)+(m.strength?' — '+esc(m.strength):'')+'</option>'}).join('');
    E('br-old').innerHTML='<option value="">Choose old medication...</option>'+opts;E('br-new').innerHTML='<option value="">Choose new medication...</option>'+opts;E('br-preview').innerHTML='<div style="padding:14px;color:var(--tx2)">Choose both medications to preview affected departments.</div>';E('br-override').checked=false;bulkReplacementToggleLimits();OM('mbulk-replacement');
  };
  window.renderBulkReplacementPreview=function(){
    var ok=E('br-old').value,nk=E('br-new').value,root=E('br-preview');if(!ok||!nk){root.innerHTML='<div style="padding:14px;color:var(--tx2)">Choose both medications.</div>';return}
    if(ok===nk){root.innerHTML='<div class="alert-banner" style="margin:8px">Old and replacement medications cannot be the same.</div>';return}
    var rows=[];(gd()||[]).forEach(function(d){var old=(getMeds(d.id)||[]).find(function(m){return medKey(m)===ok});if(!old)return;var ex=activeExpiry(d.id,old.id);rows.push('<div class="bulk-result-row"><b>'+esc(d.name||d.id)+'</b> · Min '+esc(old.min)+' / Max '+esc(old.max)+' · '+(ex.length?'<span style="color:var(--yll)">'+ex.length+' active expiry batch(es): add replacement and retire old item</span>':'<span style="color:var(--gnl)">Full replacement</span>')+'</div>')});
    root.innerHTML=rows.join('')||'<div style="padding:14px;color:var(--tx2)">The old medication is not present in any department.</div>';
  };
  window.runBulkReplacement=async function(){
    var ok=E('br-old').value,nk=E('br-new').value;if(!ok||!nk||ok===nk)return toast('Choose two different medications.','err');
    var tmpl=allTemplates().find(function(m){return m._key===nk});if(!tmpl)return toast('Replacement template was not found.','err');
    var override=E('br-override').checked,omin=E('br-min').value,omax=E('br-max').value,results=[];
    for(var d of (gd()||[])){
      var meds=(getMeds(d.id)||[]).slice(),idx=meds.findIndex(function(m){return medKey(m)===ok});if(idx<0)continue;
      var old=meds[idx],existing=meds.find(function(m){return medKey(m)===nk}),ex=activeExpiry(d.id,old.id),limits={min:override&&omin!==''?Number(omin):Number(old.min||0),max:override&&omax!==''?Number(omax):Number(old.max||0)};
      if(limits.max<limits.min){return toast('Max cannot be less than Min.','err')}
      if(!existing){var nm=Object.assign({},tmpl,{id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),min:limits.min,max:limits.max,monthly:old.monthly||'',shelfId:old.shelfId||'',floorStockReplacementOf:old.id});delete nm._key;delete nm._sourceDept;meds.push(nm);existing=nm}else{existing.min=limits.min;existing.max=limits.max}
      if(ex.length){meds[idx]=Object.assign({},old,{floorStockRetired:true,requestDisabled:true,replacedById:existing.id,replacedByName:existing.name,retiredAt:nowISO(),retiredMessage:'This medication is no longer available in the Floor Stock list and cannot be requested. Use '+existing.name+'.'});results.push((d.name||d.id)+': replacement added; old item retained until expiry clears')}
      else{meds.splice(idx,1);results.push((d.name||d.id)+': fully replaced')}
      await setMeds(d.id,meds);syncPublicExpiry(d.id,getExpiry(d.id));
    }
    await cleanAllRetired();CM('mbulk-replacement');renderInv();toast('Bulk replacement completed.','succ');
    await uiDialog({title:'Bulk replacement result',message:results.length?results.join('\n'):'No departments contained the selected old medication.',okText:'OK',cancelText:'Close'});
  };

  function decorateInventory(){
    var deptId=getInvDept&&getInvDept();if(!deptId)return;(getMeds(deptId)||[]).filter(function(m){return m.floorStockRetired}).forEach(function(m){var row=E('inv-row-'+m.id);if(!row)return;row.classList.add('med-retired-row');var cell=row.cells&&row.cells[2];if(cell&&!cell.querySelector('.med-retired-badge'))cell.insertAdjacentHTML('beforeend','<div class="med-retired-badge">Not available for Floor Stock requests · Replacement: '+esc(m.replacedByName||'new medication')+'</div>')});
  }
  window.refreshInventoryRetirementUi=function(){ensureButton();decorateInventory();cleanAllRetired()};

})();

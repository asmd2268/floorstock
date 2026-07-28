(function(){
  'use strict';
  function uniq(a){return (a||[]).filter(function(v,i,x){return v&&x.indexOf(v)===i});}
  function canManageCategoryNames(){
    try{return !!(window.CU&&(CU.master===true||CU.role==='pharmacy'||CU.role==='inpatient_supervisor')||(window.MASTER_ACTUAL&&MASTER_ACTUAL.master===true)||(typeof window.isMasterActual==='function'&&window.isMasterActual()));}catch(e){return false;}
  }
  function allCats(){
    var a=typeof getCategories==='function'?getCategories().slice():[];
    (typeof gd==='function'?gd():[]).forEach(function(d){
      (typeof getMeds==='function'?getMeds(d.id):[]).forEach(function(m){if(m&&m.category&&a.indexOf(m.category)<0)a.push(m.category);});
    });
    return uniq(a);
  }
  function isSolutionsCategory(c){return String(c||'').trim().toLowerCase()==='solutions';}
  function normalizeConfig(cfg){
    var all=allCats();cfg=cfg||{};
    var solutionName=all.find(function(c){return isSolutionsCategory(c);})||'Solutions';
    var order=uniq((cfg.order||[]).concat(all)).filter(function(c){return all.indexOf(c)>=0&&!isSolutionsCategory(c);});
    order.push(solutionName);
    /* Category hiding from New Request is managed separately. Solutions is always fixed at the bottom. */
    return {order:order,enabled:order.slice()};
  }
  function saveGlobalConfig(cfg){
    cfg=normalizeConfig(cfg);
    return S.s('pharmacy_category_config',cfg);
  }

  /* One global category order is authoritative for Pharmacy, New Request, shelves and printing. */
  window.getPharmacyCategoryConfig=function(){return normalizeConfig(S.g('pharmacy_category_config')||{});};
  window.sortDeptInventoryCategories=function(id,cats){
    var order=getPharmacyCategoryConfig().order||[];
    return (cats||[]).slice().sort(function(a,b){
      var ai=order.indexOf(a),bi=order.indexOf(b);if(ai<0)ai=999;if(bi<0)bi=999;
      return ai-bi||String(a).localeCompare(String(b));
    });
  };
  window.refreshDeptCategorySelectors=function(){
    var cfg=getPharmacyCategoryConfig(),cats=cfg.order||[];
    ['dcat','bulk-cat-sel'].forEach(function(x){
      var sel=document.getElementById(x);if(!sel)return;
      var cur=sel.value,p=x==='bulk-cat-sel'?'<option value="">Change category to...</option>':'';
      sel.innerHTML=p+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
      if(cats.indexOf(cur)>-1)sel.value=cur;
    });
  };

  function getScopeConfig(){return getPharmacyCategoryConfig();}
  function saveScopeConfig(cfg){saveGlobalConfig(cfg);return true;}
  function updateConfigsRename(oldName,newName){
    var cfg=getPharmacyCategoryConfig();
    cfg.order=cfg.order.map(function(c){return c===oldName?newName:c;});
    saveGlobalConfig(cfg);
  }
  function updateConfigsRemove(name){
    var cfg=getPharmacyCategoryConfig();
    cfg.order=cfg.order.filter(function(c){return c!==name;});
    saveGlobalConfig(cfg);
  }
  window.openManageCats=function(){
    if(!canManageCategoryNames())return toast('Category management is available only to authorized Pharmacy users and Master.','err');
    renderCatList();OM('mcat-mgr');
  };
  window.renderCatList=function(){
    var box=document.getElementById('cat-list');if(!box)return;
    var allowed=canManageCategoryNames(),ordered=getScopeConfig().order||[];
    var ctx=document.getElementById('dept-cat-context');
    if(ctx)ctx.innerHTML='<div><b>Global category order / ترتيب التصنيفات الموحد</b></div><div class="fhint" style="margin-top:6px">This exact order is saved automatically and used for Inventory, New Request, shelves and Pharmacy Print in every department. Solutions is always fixed at the bottom.</div>';
    var addWrap=document.getElementById('new-cat-inp')&&document.getElementById('new-cat-inp').parentElement;if(addWrap)addWrap.style.display=allowed?'flex':'none';
    box.innerHTML=ordered.map(function(c,i){
      var q=String(c).replace(/\\/g,'\\\\').replace(/'/g,"\\'"),locked=isSolutionsCategory(c),lastMovable=ordered.length-(ordered.some(isSolutionsCategory)?2:1);
      return '<div class="category-manage-row" style="display:grid;grid-template-columns:minmax(180px,1fr) auto auto;align-items:center;gap:8px;padding:9px 4px;border-bottom:1px solid var(--bd)" data-cat="'+esc(c)+'">'
       +'<input value="'+esc(c)+'" '+(locked?'disabled title="Solutions is fixed at the bottom"':'')+' style="margin:0;padding:7px 9px;font-weight:600" onchange="renameManagedCategory(\''+q+'\',this.value)" onkeydown="if(event.key===\'Enter\'){this.blur()}">'
       +'<div style="display:flex;gap:5px"><button type="button" class="btn bg bsm" title="Move up" '+(locked||i===0?'disabled':'')+' onclick="moveManagedCategory(\''+q+'\',-1)">↑</button><button type="button" class="btn bg bsm" title="Move down" '+(locked||i>=lastMovable?'disabled':'')+' onclick="moveManagedCategory(\''+q+'\',1)">↓</button></div>'
       +(locked?'<span class="badge bgr" title="Always last">Fixed last</span>':'<button type="button" class="btn bd2c bsm" onclick="removeManagedCategory(\''+q+'\')">Delete</button>')+'</div>';
    }).join('');
  
};
    window.renameManagedCategory=function(oldName,newValue){
    if(!canManageCategoryNames())return;
    if(isSolutionsCategory(oldName))return toast('Solutions is fixed and cannot be renamed.','info');
    var n=String(newValue||'').trim();if(!n)return renderCatList();
    var cats=allCats();if(cats.some(function(c){return c!==oldName&&c.toLowerCase()===n.toLowerCase();})){toast('Category name already exists.','err');return renderCatList();}
    var global=typeof getCategories==='function'?getCategories().slice():cats.slice();
    global=uniq(global.map(function(c){return c===oldName?n:c;}));setCategories(global);
    (typeof gd==='function'?gd():[]).forEach(function(d){
      var ms=getMeds(d.id),changed=false;ms.forEach(function(m){if(m.category===oldName){m.category=n;changed=true;}});if(changed)setMeds(d.id,ms);
    });
    updateConfigsRename(oldName,n);
    if(typeof refreshCatSelectors==='function')refreshCatSelectors();refreshDeptCategorySelectors();renderCatList();if(typeof renderInv==='function')renderInv();toast('Category renamed everywhere.','succ');
  };
  window.moveManagedCategory=function(cat,dir){
    if(isSolutionsCategory(cat))return;
    var cfg=getScopeConfig(),solution=cfg.order.find(function(c){return isSolutionsCategory(c);}),arr=cfg.order.filter(function(c){return !isSolutionsCategory(c);}),i=arr.indexOf(cat),j=i+dir;
    if(i<0||j<0||j>=arr.length)return;
    var t=arr[i];arr[i]=arr[j];arr[j]=t;if(solution)arr.push(solution);cfg.order=arr;saveScopeConfig(cfg);
    renderCatList();refreshDeptCategorySelectors();if(typeof renderInv==='function')renderInv();if(typeof renderReqForm==='function')renderReqForm();
  };
  window.removeManagedCategory=async function(name){
    if(!canManageCategoryNames())return;
    if(isSolutionsCategory(name))return toast('Solutions is fixed at the bottom and cannot be deleted.','info');
    var used=false;
    (typeof gd==='function'?gd():[]).some(function(d){return (getMeds(d.id)||[]).some(function(m){if(m.category===name){used=true;return true;}return false;});});
    if(used)return toast('Reassign medicines in this category before deleting it.','err');
    if(!await uiConfirm('Delete category "'+name+'"?'))return;
    var cats=(typeof getCategories==='function'?getCategories():[]).filter(function(c){return c!==name;});setCategories(cats);updateConfigsRemove(name);
    if(typeof refreshCatSelectors==='function')refreshCatSelectors();refreshDeptCategorySelectors();renderCatList();if(typeof renderInv==='function')renderInv();toast('Category deleted everywhere.','info');
  };
  function enforceButton(){
    var b=document.querySelector('#pg-inv button[onclick="openManageCats()"]');if(b)b.style.display=canManageCategoryNames()?'inline-flex':'none';
  }
  window.refreshCategoryManagementUi=function(){enforceButton();refreshDeptCategorySelectors();};

})();

export {};

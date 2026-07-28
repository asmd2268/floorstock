(function(){
  function hasTestWord(v){return /(^|[^a-z0-9])test([^a-z0-9]|$)/i.test(String(v||''));}
  function masterAllowed(){try{return typeof isMasterActual==='function'&&isMasterActual();}catch(e){return !!(window.CU&&CU.master===true);}}
  function relatedToIds(v,ids){
    if(v==null)return false;
    if(typeof v==='string')return ids.has(v);
    if(Array.isArray(v))return v.some(function(x){return relatedToIds(x,ids)});
    if(typeof v==='object')return Object.keys(v).some(function(k){return relatedToIds(v[k],ids)});
    return false;
  }
  function namedTest(o){
    if(!o||typeof o!=='object')return false;
    return ['name','title','label','displayName','description','note','username'].some(function(k){return hasTestWord(o[k]);});
  }
  function collectTestIds(v,ids){
    if(!v)return;
    if(Array.isArray(v)){v.forEach(function(x){collectTestIds(x,ids)});return;}
    if(typeof v==='object'){
      if(namedTest(v)&&v.id)ids.add(String(v.id));
      Object.keys(v).forEach(function(k){collectTestIds(v[k],ids)});
    }
  }
  function cleanValue(v,ids,key){
    if(Array.isArray(v)){
      return v.filter(function(x){
        if(x&&typeof x==='object'){
          if(namedTest(x))return false;
          if(x.id&&ids.has(String(x.id)))return false;
          if(key==='audit_log'&&(relatedToIds(x,ids)||hasTestWord(JSON.stringify(x))))return false;
          if(relatedToIds(x,ids))return false;
        }
        return true;
      }).map(function(x){return cleanValue(x,ids,key)});
    }
    if(v&&typeof v==='object'){
      var out={};Object.keys(v).forEach(function(k){
        var x=v[k];
        if(x&&typeof x==='object'&&namedTest(x))return;
        if(ids.has(String(k)))return;
        out[k]=cleanValue(x,ids,key);
      });return out;
    }
    return v;
  }
  async function deletePublicCrashDoc(id){
    if(window.FB_DB)await FB_DB.collection('public_controlled_expiry').doc('crash_'+String(id)).delete();
    return true
  }
  window.masterPurgeAllTestData=async function(){
    if(!masterAllowed())return toast('Master permission required.','err');
    if(!(await uiConfirm('Permanently delete every record whose name contains the standalone word TEST, including linked records and audit traces? This cannot be undone.')))return;
    var ids=new Set();Object.keys(S.cache||{}).forEach(function(k){collectTestIds(S.cache[k],ids)});
    var testCrashIds=(typeof crashCarts==='function'?crashCarts():[]).filter(function(c){return namedTest(c)}).map(function(c){return String(c.id)});testCrashIds.forEach(function(x){ids.add(x)});
    var changed=0,operations=[];
    Object.keys(S.cache||{}).forEach(function(k){
      if(k==='users')return;
      var old=S.cache[k],clean=cleanValue(old,ids,k);
      try{if(JSON.stringify(old)!==JSON.stringify(clean)){changed++;operations.push({label:k,promise:S.s(k,clean)})}}catch(e){console.warn('TEST cleanup comparison failed for '+k,e)}
    });
    testCrashIds.forEach(function(id){operations.push({label:'public crash '+id,promise:deletePublicCrashDoc(id)})});
    var results=await Promise.allSettled(operations.map(function(x){return x.promise})),failed=[];
    results.forEach(function(r,i){if(r.status==='rejected'){failed.push(operations[i].label);console.error('TEST cleanup failed for '+operations[i].label,r.reason)}});
    if(typeof refreshCurrentPage==='function')refreshCurrentPage();
    if(failed.length){toast('TEST cleanup completed partially. '+failed.length+' area(s) could not be deleted; review the console and retry.','err');return false}
    toast('TEST data purged completely from '+changed+' data area(s).','succ');return true
  };
  function addMasterCleanupButton(){
    var host=document.getElementById('tuser')&&document.getElementById('tuser').parentElement;
    var old=document.getElementById('master-test-clean-btn');if(old)old.remove();
    if(!host||!masterAllowed())return;
    var b=document.createElement('button');b.id='master-test-clean-btn';b.className='btn bg bsm master-test-clean-btn';b.textContent='Delete TEST data';b.title='Permanently remove records named TEST and all linked traces';b.onclick=masterPurgeAllTestData;
    host.insertBefore(b,document.getElementById('themeBtn'));
  }
  window.addMasterCleanupButton=addMasterCleanupButton;
  })();

export {};

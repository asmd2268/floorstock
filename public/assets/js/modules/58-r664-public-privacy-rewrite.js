(function(){
  'use strict';
  var attempts=0,running=false;
  function allowed(){var u=window.CU||{};return u.active!==false&&(u.master===true||String(u.role||'')==='pharmacy'||String(u.role||'')==='inpatient_supervisor')}
  async function rewrite(){
    if(running||sessionStorage.getItem('r664_public_privacy_rewritten')==='1')return;
    if(!allowed()||!window.S||!S.ready||!window.FB_DB){if(++attempts<40)setTimeout(rewrite,750);return}
    if(typeof publishPublic!=='function'){if(++attempts<40)setTimeout(rewrite,750);return}
    running=true;
    try{
      var carts=typeof crashCarts==='function'?(crashCarts()||[]):[];
      if(Array.isArray(carts)&&carts.length)await publishPublic(carts);
      var departments=typeof gd==='function'?(gd()||[]):[];
      for(var i=0;i<departments.length;i++){
        var id=String(departments[i]&&departments[i].id||'');if(!id)continue;
        if(typeof ctlPublishDept==='function')await ctlPublishDept(id);
        if(typeof syncPublicExpiry==='function'&&typeof getExpiry==='function')await syncPublicExpiry(id,getExpiry(id)||[]);
      }
      if(typeof storageState==='function'&&typeof controlledMeds==='function'&&typeof publishStorage==='function'){
        var state=storageState(),medicines=controlledMeds();
        for(var j=0;j<(state.units||[]).length;j++)await publishStorage(state.units[j],medicines);
      }
      sessionStorage.setItem('r664_public_privacy_rewritten','1');
    }catch(error){console.warn('Public privacy rewrite will retry on the next authorized session.',error)}
    finally{running=false}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(rewrite,1200)},{once:true});else setTimeout(rewrite,1200);
  var previousStart=window.startApp;
  if(typeof previousStart==='function')window.startApp=function(){var result=previousStart.apply(this,arguments);setTimeout(rewrite,1500);return result};
})();

export {};

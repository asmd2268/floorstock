(function(){
  'use strict';
  if(!window.console||window.__ASDH_DEBUG)return;
  var nativeError=typeof console.error==='function'?console.error.bind(console):function(){};
  var nativeWarn=typeof console.warn==='function'?console.warn.bind(console):function(){};
  ['log','info','debug','trace'].forEach(function(method){try{console[method]=function(){}}catch(ignore){}});
  try{console.warn=function(){nativeWarn('[ASDHealth] A recoverable warning occurred.');}}catch(ignore){}
  try{console.error=function(){nativeError('[ASDHealth] An operation failed. Review the in-app message or Firebase logs.');}}catch(ignore){}
})();

/* Stable architecture boundary shared by legacy-compatible modules.  New code
   should use this facade instead of adding another window-level wrapper. */
(function(){
  'use strict';
  var existing=window.FSArchitecture||{},listeners=existing.listeners||{};
  function norm(value){return String(value==null?'':value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
  function aliases(profile){profile=profile||window.CU||{};return [profile.deptId,profile.departmentId,profile.deptName,profile.departmentName,profile.department,profile.deptCode,profile.departmentCode].map(norm).filter(Boolean)}
  function on(name,handler){if(typeof handler!=='function')return function(){};(listeners[name]||(listeners[name]=[])).push(handler);return function(){var list=listeners[name]||[],i=list.indexOf(handler);if(i>=0)list.splice(i,1)}}
  function emit(name,payload){(listeners[name]||[]).slice().forEach(function(handler){try{handler(payload)}catch(error){if(window.console&&console.warn)console.warn('Architecture listener failed',name,error)}})}
  function session(){var c=window.CU||{};return Object.freeze({id:c.id||'',role:c.role||'',deptId:c.deptId||'',deptName:c.deptName||'',master:c.master===true})}
  window.FSArchitecture=Object.assign(existing,{listeners:listeners,normalize:existing.normalize||norm,departmentAliases:existing.departmentAliases||aliases,on:on,emit:emit,session:session,version:'1.0'});
})();

export {};

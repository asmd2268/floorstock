(function(){
  'use strict';
  if(!window.console||window.__ASDH_DEBUG)return;
  ['log','info','debug'].forEach(function(method){try{console[method]=function(){}}catch(ignore){}});
})();

export {};

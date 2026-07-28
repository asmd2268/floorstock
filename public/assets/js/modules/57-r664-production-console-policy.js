(function(){
  'use strict';
  if(!window.console)return;
  ['log','info','debug'].forEach(function(method){try{console[method]=function(){}}catch(ignore){}});
})();








export {};

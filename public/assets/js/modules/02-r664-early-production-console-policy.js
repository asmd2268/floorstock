(function(){
  'use strict';
  if(!window.console)return;
  var nativeError=typeof console.error==='function'?console.error.bind(console):function(){};
  var nativeWarn=typeof console.warn==='function'?console.warn.bind(console):function(){};
  ['log','info','debug','trace'].forEach(function(method){try{console[method]=function(){}}catch(ignore){}});
  try{console.warn=function(){nativeWarn('[ASDHealth] A recoverable warning occurred.');}}catch(ignore){}
  try{console.error=function(){nativeError('[ASDHealth] An operation failed. Review the in-app message or Firebase logs.');}}catch(ignore){}
})();

export {};

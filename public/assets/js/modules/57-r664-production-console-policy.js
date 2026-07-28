/* ASDHealth R6.65 Modular
 * Original script position: 60
 * Original id: r664-production-console-policy
 * Compatibility mode: classic script, original execution order preserved.
 */
(function(){
  'use strict';
  if(!window.console)return;
  ['log','info','debug'].forEach(function(method){try{console[method]=function(){}}catch(ignore){}});
})();

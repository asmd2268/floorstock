(function(){
  'use strict';
  var WARNING_MS=28*60*1000,LOGOUT_MS=30*60*1000;
  var warningTimer=null,logoutTimer=null,lastActivity=Date.now(),warningOpen=false,lastReset=0;
  function signedIn(){return !!(window.FB_AUTH&&FB_AUTH.currentUser)}
  function clearTimers(){if(warningTimer)clearTimeout(warningTimer);if(logoutTimer)clearTimeout(logoutTimer);warningTimer=logoutTimer=null}
  async function forceLogout(){clearTimers();warningOpen=false;try{if(window.FB_AUTH&&FB_AUTH.currentUser)await FB_AUTH.signOut()}catch(ignore){}try{sessionStorage.clear()}catch(ignore){}location.reload()}
  function showWarning(){
    if(!signedIn()||warningOpen)return;
    warningOpen=true;
    if(typeof window.uiConfirm==='function'){
      window.uiConfirm('Your session will close in 2 minutes because no activity was detected.\n\nستنتهي الجلسة خلال دقيقتين بسبب عدم النشاط.\n\nContinue this session?',{title:'Session timeout / انتهاء الجلسة',okText:'Continue / متابعة',cancelText:'Sign out / تسجيل الخروج'}).then(function(continueSession){warningOpen=false;if(continueSession)reset(true);else forceLogout()});
    }else if(typeof window.toast==='function')window.toast('Session will close in 2 minutes بسبب عدم النشاط','info');
  }
  function schedule(){clearTimers();if(!signedIn())return;var elapsed=Date.now()-lastActivity;warningTimer=setTimeout(showWarning,Math.max(0,WARNING_MS-elapsed));logoutTimer=setTimeout(forceLogout,Math.max(0,LOGOUT_MS-elapsed))}
  function reset(force){if(warningOpen&&!force)return;var now=Date.now();if(!force&&now-lastReset<15000)return;lastReset=now;lastActivity=now;schedule()}
  ['pointerdown','keydown','touchstart','scroll'].forEach(function(name){document.addEventListener(name,function(){reset(false)},{capture:true,passive:true})});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){if(signedIn()&&Date.now()-lastActivity>=LOGOUT_MS)forceLogout();else schedule()}});
  function attach(){if(window.FB_AUTH&&typeof FB_AUTH.onAuthStateChanged==='function')FB_AUTH.onAuthStateChanged(function(user){if(user)reset(true);else clearTimers()});else setTimeout(attach,500)}
  attach();
})();

export {};

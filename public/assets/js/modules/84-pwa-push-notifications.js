/* PWA push notifications — requests permission after login, stores FCM token in Firestore */
(function(){
  if(!('Notification' in window)||!('serviceWorker' in navigator))return;

  // VAPID public key — generate from Firebase Console → Project Settings → Cloud Messaging
  // Replace this placeholder before enabling push sends from the server
  var VAPID_KEY = 'BIfCkwFW3lLKKmJyfaa3eeeJsFSeILTduZ96MUV0Zk7TAuyr-jRrrSRI2GQCaT6pLd2shd5pN7Q_jKGCgfK1tOs';

  var tokenSaved = false;

  async function saveFcmToken(token){
    if(tokenSaved||!token)return;
    tokenSaved = true;
    try {
      var user = window.CU;
      if(!user||!user.uid)return;
      var db = window.FB_DB;
      if(!db)return;
      var tenantId = window.fsTenantId && window.fsTenantId(window.S && window.S.scopeProfile);
      if(!tenantId)return;
      await db.collection('tenants').doc(tenantId)
        .collection('fcm_tokens').doc(user.uid)
        .set({ token: token, uid: user.uid, role: user.role||'', updatedAt: new Date().toISOString() }, { merge: true });
    } catch(e){
      console.warn('[PWA] FCM token save failed', e);
    }
  }

  async function initMessaging(){
    if(VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY')return; // not configured yet
    try {
      if(!window.firebase||!window.firebase.messaging)return;
      var messaging = window.firebase.messaging();
      var token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: await navigator.serviceWorker.ready });
      if(token) saveFcmToken(token);
      messaging.onMessage(function(payload){
        var title = (payload.notification&&payload.notification.title)||'FloorStock';
        var body  = (payload.notification&&payload.notification.body)||'';
        if(window.toast) window.toast(title+(body?' — '+body:''));
      });
    } catch(e){
      console.warn('[PWA] Messaging init failed', e);
    }
  }

  async function requestPermission(){
    if(Notification.permission === 'granted'){ initMessaging(); return; }
    if(Notification.permission === 'denied')return;
    var perm = await Notification.requestPermission();
    if(perm === 'granted') initMessaging();
  }

  // Wait for app ready + user logged in, then ask for permission
  function tryInit(){
    if(!(window.CU&&window.CU.uid))return;
    requestPermission();
  }

  document.addEventListener('asdhealth:userReady', tryInit, { once: true });
  // Fallback poll in case the event already fired
  if(window.CU&&window.CU.uid) requestPermission();
  else setTimeout(function(){ if(window.CU&&window.CU.uid) requestPermission(); }, 4000);
})();

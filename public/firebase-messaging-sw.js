/* Firebase Cloud Messaging Service Worker — FloorStock */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBlcFhBTaJ9so8MlCLa_JTtUpQxCbEwuzU',
  authDomain: 'floorstock-6ac2d.firebaseapp.com',
  projectId: 'floorstock-6ac2d',
  storageBucket: 'floorstock-6ac2d.firebasestorage.app',
  messagingSenderId: '920762414422',
  appId: '1:920762414422:web:8d6dbc7069d4088defd2f7'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || 'FloorStock';
  const body  = (payload.notification && payload.notification.body)  || '';
  const icon  = '/assets/icons/icon-192.png';
  self.registration.showNotification(title, { body, icon, badge: icon, dir: 'rtl' });
});

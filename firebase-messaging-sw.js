importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCgtZvZzWdWQEJna0bJz_YhATLnnNoJRfA",
  authDomain:        "gecc-uniport.firebaseapp.com",
  projectId:         "gecc-uniport",
  storageBucket:     "gecc-uniport.appspot.com",
  messagingSenderId: "565729305146",   // Firebase Console → Project Settings → General
  appId:             "1:565729305146:web:2973acd0293903725acb03"       // Firebase Console → Project Settings → General
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'GECC Uniport';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:  '/gecc-logo.jpg',
    badge: '/gecc-logo.jpg',
    tag:   payload.data?.tag || 'gecc-notif',
    data:  payload.data || {}
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.link || '/';
  e.waitUntil(clients.openWindow(url));
});

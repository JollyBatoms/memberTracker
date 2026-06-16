// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCgtZvZzWdWQEJna0bJz_YhATLnnNoJRfA",
  authDomain: "gecc-uniport.firebaseapp.com",
  projectId: "gecc-uniport",
  storageBucket: "gecc-uniport.appspot.com",
  messagingSenderId: "565729305146",
  appId: "1:565729305146:web:2973acd0293903725acb03"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'GECC Uniport', {
    body: body || '',
    icon: icon || '/gecc-logo.jpg',
    badge: '/gecc-logo.jpg',
    tag: payload.data?.tag || 'gecc-notif',
    data: payload.data || {},
    actions: payload.data?.link ? [{ action:'open', title:'View' }] : []
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(clients.openWindow(link));
});

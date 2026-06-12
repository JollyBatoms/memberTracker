const firebaseConfig = {
  apiKey: "AIzaSyCgtZvZzWdWQEJna0bJz_YhATLnnNoJRfA",
  authDomain: "gecc-uniport.firebaseapp.com",
  projectId: "gecc-uniport",
  storageBucket: "gecc-uniport.firebasestorage.app",
  messagingSenderId: "565729305146",
  appId: "1:565729305146:web:2973acd0293903725acb03"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

/**
 * Fetches the role ('admin' or 'member') for a given uid
 * from the /users/{uid} Firestore document.
 * Returns null if the document doesn't exist or has no role.
 */
async function getUserRoleFromDB(uid) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (snap.exists && snap.data().role) {
      return snap.data().role;
    }
    return null;
  } catch (err) {
    console.error('getUserRoleFromDB error:', err);
    return null;
  }
}

// Add this at the bottom of firebase-config.js

// Make auth, db, storage available globally (you likely have these already)
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// FCM Setup — call this once after login
async function initFCM(userId) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // Register service worker
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging = firebase.messaging();
    messaging.useServiceWorker(reg);

    // Only request if not already granted
    if (Notification.permission === 'granted') {
      // Replace with your VAPID key from:
      // Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
      const token = await messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY_HERE' });
      if (token && userId) {
        await db.collection('users').doc(userId).update({ fcmToken: token });
      }
    }
  } catch (e) {
    console.log('FCM init error:', e);
  }
}

// Call initFCM after login — add this in your auth.html login success handler:
// initFCM(userId);

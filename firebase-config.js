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

// Fetch role from Firestore — used across all pages
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



// Inside firebase-config.js
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
window.auth = firebase.auth();

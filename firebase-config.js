const firebaseConfig = {
  apiKey: "AIzaSyCgtZvZzWdwQEJna0bJz_YhATlnnNoJRfA",
  authDomain: "gecc-uniport.firebaseapp.com",
  projectId: "gecc-uniport",
  storageBucket: "gecc-uniport.firebasestorage.app",
  messagingSenderId: "565729305146",
  appId: "1:565729305146:web:2973acd0293903725acb03"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Fetches the user's real role from Firestore
function getUserRoleFromDB(uid) {
  return db.collection('users').doc(uid).get().then(doc => {
    if (doc.exists) {
      return doc.data().role || null;
    }
    return null;
  });
}

// Kicks out disabled or expired sessions instantly
auth.onIdTokenChanged((user) => {
  if (user) {
    user.getIdToken(true).catch((error) => {
      console.log("Session invalid or account disabled. Logging out...", error);
      auth.signOut().then(() => {
        window.location.href = "auth.html";
      });
    });
  }
});

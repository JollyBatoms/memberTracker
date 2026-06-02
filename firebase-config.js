// 1. Your Exact Firebase Configuration Keys
const firebaseConfig = {
  apiKey: "AIzaSyCgtZvZzWdwQEJna0bJz_YhATlnnNoJRfA",
  authDomain: "gecc-uniport.firebaseapp.com",
  projectId: "gecc-uniport",
  storageBucket: "gecc-uniport.firebasestorage.app",
  messagingSenderId: "565729305146",
  appId: "1:565729305146:web:2973acd0293903725acb03"
};

// 2. Initialize Firebase (v8 Web Style)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// 3. Helper Global Admin Email String
const ADMIN_EMAIL = 'admin@geccuniport.org';

// 4. Token Monitor (Instantly kicks out disabled users)
auth.onIdTokenChanged((user) => {
  if (user) {
    user.getIdToken(true)
      .catch((error) => {
        console.log("Session invalid. Logging out...", error);
        auth.signOut().then(() => {
          window.location.href = "auth.html";
        });
      });
  }
});

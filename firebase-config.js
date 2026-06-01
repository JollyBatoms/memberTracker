const firebaseConfig = {
  apiKey: "AIzaSyCgtZvZzWdWQEJna0bJz_YhATLnnNoJRfA",
  authDomain: "gecc-uniport.firebaseapp.com",
  projectId: "gecc-uniport",
  storageBucket: "gecc-uniport.firebasestorage.app",
  messagingSenderId: "565729305146",
  appId: "1:565729305146:web:2973acd0293903725acb03"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// Admin email — must match exactly what you set in Firebase Console
const ADMIN_EMAIL = 'admin@geccuniport.org';

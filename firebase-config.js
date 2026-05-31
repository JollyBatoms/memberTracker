// Firebase configuration — shared across all pages

const firebaseConfig = {
  apiKey: "AIzaSyCgtZvZzWdWQEJna0bJz_YhATLnnNoJRfA",
  authDomain: "gecc-uniport.firebaseapp.com",
  projectId: "gecc-uniport",
  storageBucket: "gecc-uniport.firebasestorage.app",
  messagingSenderId: "565729305146",
  appId: "1:565729305146:web:2973acd0293903725acb03"
};

// Initialize Firebase (CDN version)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
  





function deleteAssociate(id) {
  if (!confirm('Delete this associate? This cannot be undone.')) return;
  db.collection('past-members').doc(id).delete()
    .then(() => {
      console.log('Deleted:', id);
      closeDetail();
      showToast('Associate deleted.', 'success');
    })
    .catch(err => {
      console.error('Delete failed:', err);
      showToast('Error: ' + err.message, 'error');
    });
}

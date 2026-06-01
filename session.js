import { auth } from "./firebaseConfig.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let timer;

function resetTimer() {
  clearTimeout(timer);

  timer = setTimeout(async () => {
    alert("Session expired. Please login again.");

    await signOut(auth);

    window.location.href = "auth.html";
  }, 2 * 60 * 1000); // 2 minutes
}

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(event => {
  document.addEventListener(event, resetTimer);
});

resetTimer();

// js/login.js
import { auth, provider, signInWithPopup, signInWithRedirect, onAuthStateChanged } from "./firebase-config.js";

const loginBtn = document.getElementById('google-login-btn');

// ১. লগইন বাটনের কাজ
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        // লোকাল কম্পিউটার নাকি লাইভ সাইট চেক করা
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

        if (isLocalhost) {
            console.log("Environment: Localhost (Using Popup)");
            signInWithPopup(auth, provider)
                .then(() => {
                    // সফল হলে ড্যাশবোর্ডে যাও
                    window.location.replace("dashboard.html");
                })
                .catch((error) => {
                    console.error("Popup Login Error:", error);
                    alert("Login Failed: " + error.message);
                });
        } else {
            // APK বা লাইভ সাইটের জন্য Redirect ভালো কাজ করে
            console.log("Environment: Production/APK (Using Redirect)");
            signInWithRedirect(auth, provider);
        }
    });
}

// ২. ইউজার লগইন চেক (রিডাইরেক্ট হয়ে ফিরে আসার পর এটা কাজ করবে)
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User detected:", user.email);
        // ইউজার লগইন থাকলে ড্যাশবোর্ডে পাঠিয়ে দিন
        window.location.replace("dashboard.html");
    }
});
// js/auth.js

import { auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const loginBtn = document.getElementById('google-login-btn');

// ১. লগইন বাটনের কাজ (স্মার্ট ডিটেকশন)
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        
        // আমরা চেক করবো ইউজার কি লোকাল কম্পিউটারে আছে নাকি লাইভ সাইটে/অ্যাপে
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

        if (isLocalhost) {
            // কম্পিউটারে টেস্টিংয়ের সময় পপ-আপ ব্যবহার করবো (Brave বা অন্য ব্রাউজারে সমস্যা এড়াতে)
            console.log("Using Popup for Localhost");
            signInWithPopup(auth, provider)
                .then(() => {
                    window.location.href = "dashboard.html";
                })
                .catch((error) => {
                    console.error("Popup Login Error:", error);
                    alert("Login Failed: " + error.message);
                });
        } else {
            // যখন অ্যাপ বা লাইভ সাইটে চলবে, তখন রিডাইরেক্ট ব্যবহার করবো (APK সাপোর্টের জন্য)
            console.log("Using Redirect for Production/APK");
            signInWithRedirect(auth, provider);
        }
    });
}

// ২. ইউজার চেক (Redirect বা Popup সব ক্ষেত্রেই কাজ করবে)
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User found:", user.email);
        
        // ইউজার পাওয়া গেলে ড্যাশবোর্ডে পাঠাও
        // তবে আমরা চেক করবো বর্তমান পেজটি ড্যাশবোর্ড কিনা, তা না হলে লুপ হতে পারে
        if (!window.location.pathname.includes("dashboard.html")) {
            window.location.href = "dashboard.html";
        }
    } else {
        console.log("No user logged in.");
    }
});
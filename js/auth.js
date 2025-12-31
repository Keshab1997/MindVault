// js/auth.js

import { auth } from './firebase-config.js';
// পপআপ বাদ দিয়ে signInWithRedirect ইম্পোর্ট করা হলো
import { GoogleAuthProvider, signInWithRedirect, onAuthStateChanged, getRedirectResult } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const loginBtn = document.getElementById('google-login-btn');

// ১. লগইন বাটনের কাজ
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        
        // মোবাইলে পপআপ কাজ করে না, তাই Redirect ব্যবহার করতে হবে
        // এটি একই উইন্ডোতে লোড হবে, তাই APK তে সমস্যা হবে না
        signInWithRedirect(auth, provider);
    });
}

// ২. রিডাইরেক্ট হয়ে ফিরে আসার পর রেজাল্ট চেক করা (ঐচ্ছিক, ডিবাগিংয়ের জন্য)
getRedirectResult(auth)
    .then((result) => {
        if (result) {
            console.log("Redirect login successful:", result.user);
            window.location.replace("dashboard.html");
        }
    })
    .catch((error) => {
        console.error("Redirect Login Error:", error);
    });

// ৩. ইউজার লগইন আছে কিনা চেক করা
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ইউজার লগইন অবস্থায় আছে, ড্যাশবোর্ডে পাঠিয়ে দাও
        // 'replace' ব্যবহার করছি যাতে ব্যাক বাটন চাপলে আবার লগইনে না আসে
        window.location.replace("dashboard.html");
    } else {
        console.log("Please login.");
    }
});
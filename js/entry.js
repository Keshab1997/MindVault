import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// পেজ লোড হলে চেক করো
onAuthStateChanged(auth, (user) => {
    // শেয়ার করা ডাটা আছে কিনা URL এ চেক করা
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text');
    
    // রিডাইরেক্ট লিংক তৈরি করা (যদি শেয়ার টেক্সট থাকে, সেটা সাথে নিয়ে যাবে)
    let targetUrl = "dashboard.html";
    if (sharedText) {
        targetUrl += `?text=${encodeURIComponent(sharedText)}`;
    }

    if (user) {
        // ইউজার লগইন আছে -> ড্যাশবোর্ডে পাঠাও
        console.log("User found, redirecting to dashboard...");
        window.location.href = targetUrl;
    } else {
        // ইউজার লগইন নেই -> লগইন পেজে পাঠাও
        console.log("No user, redirecting to login...");
        window.location.href = "login.html";
    }
});
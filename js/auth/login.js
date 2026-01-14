// js/auth/login.js
import { auth, provider, signInWithPopup, onAuthStateChanged } from "../core/firebase-config.js";

console.log("🚀 Login Script Running");

// ১. ইউজার স্টেট চেক
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ User Found:", user.email);
        window.location.replace("dashboard.html");
    } else {
        console.log("ℹ️ No user session found.");
    }
});

const loginBtn = document.getElementById('google-login-btn');

if (loginBtn) {
    loginBtn.onclick = async () => {
        console.log("🖱️ Button Clicked");
        try {
            // পপআপ দিয়ে লগইন
            const result = await signInWithPopup(auth, provider);
            console.log("✅ Login Success:", result.user.email);
            window.location.replace("dashboard.html");
        } catch (error) {
            console.error("❌ Login Error:", error.code, error.message);
            
            // যদি পপআপ ব্লক হয়, তবে রিডাইরেক্ট ব্যবহার করা
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                console.log("🔄 Popup blocked, switching to redirect...");
                const { signInWithRedirect } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                signInWithRedirect(auth, provider);
            } else {
                alert("Login Error: " + error.message);
            }
        }
    };
} else {
    console.error("❌ Error: 'google-login-btn' not found in HTML!");
}

// js/dashboard/main.js
import { auth } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

console.log("🚀 Dashboard Main.js Loaded");

// মডিউল ইমপোর্ট
import { loadNotes, setupNoteSaving } from "./note-manager.js";
import { setupFolders } from "./folder-manager.js";
import { setupEventListeners } from "./event-manager.js";
import { setupModals } from "./menu-manager.js";

// অথেনটিকেশন চেকার
onAuthStateChanged(auth, (user) => {
    console.log("🔄 Auth State Changed (Dashboard):", user ? "User: " + user.email : "No User Found");
    
    if (!user) {
        console.warn("⚠️ No user detected on Dashboard! Redirecting to index.html...");
        window.location.replace("index.html");
    } else {
        console.log("✅ Access Granted for:", user.email);
        initDashboard(user);
    }
});

// ড্যাশবোর্ড ইনিশিয়ালাইজেশন ফাংশন
function initDashboard(user) {
    console.log("🛠️ Initializing Dashboard for:", user.email);
    // ১. প্রোফাইল সেটআপ (নাম ও ছবি দেখানো)
    const profileDiv = document.getElementById('nav-mini-profile');
    const nameEl = document.getElementById('nav-user-name');
    const imgEl = document.getElementById('nav-user-img');

    if (profileDiv) {
        profileDiv.style.display = 'flex'; 
        
        // নাম সেট করা (যদি নাম না থাকে, ইমেইলের প্রথম অংশ দেখাবে)
        if (nameEl) {
            nameEl.innerText = user.displayName || user.email.split('@')[0];
        }

        // ছবি সেট করা (যদি ছবি না থাকে, একটি ডিফল্ট আইকন দেখাবে)
        const defaultImg = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        if (imgEl) {
            imgEl.src = user.photoURL ? user.photoURL : defaultImg;
        }

        // প্রোফাইলে ক্লিক করলে প্রোফাইল পেজে নিয়ে যাওয়া (অপশনাল)
        profileDiv.style.cursor = 'pointer';
        profileDiv.onclick = () => {
            // ভবিষ্যতে এখানে প্রোফাইল পেজের লিংক দিতে পারেন
            alert(`Logged in as: ${user.email}`); 
        };
    }

    // ২. অ্যাপের বাকি মডিউলগুলো চালু করা
    try {
        loadNotes(user.uid, 'All');       
        setupNoteSaving(user);            
        setupFolders(user.uid);           
        setupEventListeners(user);        
        setupModals(); // Context menu এবং modal functionality
    } catch (error) {
        console.error("Error initializing modules:", error);
    }

    // ৩. শেয়ার্ড কনটেন্ট হ্যান্ডলার (Android & Web Share Target)
    // URL থেকে 'text' বা 'note' প্যারামিটার চেক করা
    const p = new URLSearchParams(window.location.search);
    const sharedText = p.get('text') || p.get('note'); 

    if (sharedText) {
        const noteInput = document.getElementById('noteInput');
        if (noteInput) {
            // টেক্সট ডিকোড করে ইনপুটে বসানো
            noteInput.value = decodeURIComponent(sharedText);
            noteInput.focus(); // ইনপুটে ফোকাস করা
            
            // URL ক্লিন করা (যাতে পেজ রিফ্রেশ দিলে আবার টেক্সট না আসে)
            window.history.replaceState({}, document.title, "dashboard.html");
        }
    }
}

// লগআউট বাটন হ্যান্ডলার
// দুটি ID চেক করা হচ্ছে কারণ মোবাইল এবং ডেস্কটপ মেনুতে ভিন্ন ID থাকতে পারে
const logoutBtn = document.getElementById('menu-logout-btn') || document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = () => {
        signOut(auth).then(() => {
            console.log("User signed out");
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Sign out error:", error);
        });
    };
}
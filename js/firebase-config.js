// js/firebase-config.js

// ১. ইম্পোর্ট সেকশন
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithRedirect, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    doc,
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// (Storage ইম্পোর্ট বাদ দেওয়া হয়েছে কারণ আমরা Cloudinary ব্যবহার করছি)

// ২. কনফিগারেশন (তোমার দেওয়া তথ্য)
const firebaseConfig = {
  apiKey: "AIzaSyDnXqLbGRyaOqP58edPaS5uut1dxDyDSQU",
  authDomain: "mybrain-1df31.firebaseapp.com",
  projectId: "mybrain-1df31",
  storageBucket: "mybrain-1df31.firebasestorage.app",
  messagingSenderId: "202677633038",
  appId: "1:202677633038:web:dded22e77062462a383c5f",
  measurementId: "G-JS89ND0VJR"
};

// ৩. ইনিশিয়ালাইজেশন
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = ... (বাদ দেওয়া হয়েছে)
const provider = new GoogleAuthProvider();

// ৪. এক্সপোর্ট
export { 
    app, 
    auth, 
    db, 
    // storage, (বাদ দেওয়া হয়েছে)
    provider, 
    signInWithPopup, 
    signInWithRedirect, 
    onAuthStateChanged, 
    signOut,
    collection, 
    addDoc, 
    getDocs,
    doc,
    deleteDoc,
    query,
    where
};
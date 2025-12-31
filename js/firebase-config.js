// js/firebase-config.js

// ১. ইম্পোর্ট সেকশন (সব প্রয়োজনীয় টুলস এখানে আনা হয়েছে)
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

import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ২. কনফিগারেশন (আপনার দেওয়া কি-গুলো ঠিক রাখা হয়েছে)
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
const storage = getStorage(app);
const provider = new GoogleAuthProvider(); // লগইনের জন্য প্রোভাইডার সেটআপ

// ৪. এক্সপোর্ট (খুবই গুরুত্বপূর্ণ: সব ফাংশন এখান থেকে এক্সপোর্ট করতে হবে)
export { 
    app, 
    auth, 
    db, 
    storage, 
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
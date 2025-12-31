// js/dashboard.js

import { db, auth, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

let unsubscribeNotes = null; // ডাটা লিসেনার কন্ট্রোল করার ভেরিয়েবল

// ১. অথেনটিকেশন চেক
onAuthStateChanged(auth, (user) => {
    if (!user) {
        if (unsubscribeNotes) {
            unsubscribeNotes();
            unsubscribeNotes = null;
        }
        window.location.href = "index.html";
    } else {
        loadUserNotes(user.uid);
    }
});

// ২. লগআউট বাটন
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Logout Error:", error));
    });
}

// ৩. সেভ লজিক
const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('uploadStatus');

if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const text = noteInput.value;
        const file = fileInput.files[0];
        const user = auth.currentUser;

        if (!text && !file) return alert("Empty note!");

        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
        if (statusText) statusText.style.display = 'block';

        try {
            let fileUrl = null;
            let fileType = null;

            if (file) {
                const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                fileUrl = await getDownloadURL(storageRef);
                fileType = file.type.startsWith('image/') ? 'image' : 'file';
            }

            let type = 'text';
            if (fileUrl) type = fileType;
            else if (isValidURL(text)) type = 'link';

            await addDoc(collection(db, "notes"), {
                uid: user.uid,
                text: text,
                fileUrl: fileUrl,
                type: type,
                timestamp: serverTimestamp() // সার্ভারের সময় সেভ হচ্ছে
            });

            noteInput.value = "";
            fileInput.value = "";

        } catch (error) {
            console.error("Error:", error);
            alert("Error saving.");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = "Save to Brain";
            if (statusText) statusText.style.display = 'none';
        }
    });
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// [নতুন] সময় ফরম্যাট করার ফাংশন
function formatFirestoreTimestamp(timestamp) {
    if (!timestamp) return "Just now"; // লোড হওয়ার সাথে সাথে অনেক সময় টাইমস্ট্যাম্প নাল থাকে
    const date = timestamp.toDate(); 
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: 'numeric', 
        hour12: true 
    });
}

// ৪. ডাটা লোড
function loadUserNotes(uid) {
    const q = query(collection(db, "notes"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    const grid = document.getElementById('content-grid');

    if (unsubscribeNotes) unsubscribeNotes();

    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        grid.innerHTML = ""; 
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // [নতুন] সময় ফরম্যাট করা হচ্ছে
            const dateString = formatFirestoreTimestamp(data.timestamp);

            const card = document.createElement('div');
            card.className = 'card brain-card'; 
            
            let contentHTML = '';

            // ---- Content Logic ----
            if (data.type === 'image') {
                contentHTML += `<img src="${data.fileUrl}" alt="Image">`;
                if(data.text) contentHTML += `<p class="note-text">${data.text}</p>`;
            }
            else if (data.type === 'link') {
                const previewId = `preview-${id}`;
                contentHTML += `
                    <div id="${previewId}" class="link-preview-box">
                        <a href="${data.text}" target="_blank" class="raw-link note-text">🔗 ${data.text}</a>
                    </div>
                `;
                fetchLinkPreview(data.text, previewId);
            } 
            else {
                if(data.text) contentHTML += `<p class="note-text">${data.text}</p>`;
                if (data.type === 'file') {
                    contentHTML += `<br><a href="${data.fileUrl}" target="_blank" class="file-btn">⬇ Download File</a>`;
                }
            }

            // ---- Footer with Date & Delete ----
            // এখানে স্টাইল দিয়ে দিয়েছি যাতে বাম দিকে তারিখ আর ডান দিকে ডিলিট বাটন থাকে
            contentHTML += `
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <small style="color: #888; font-size: 11px;">📅 ${dateString}</small>
                    <button class="delete-btn" onclick="deleteNote('${id}')">🗑</button>
                </div>
            `;

            card.innerHTML = contentHTML;
            grid.appendChild(card);
        });
    });
}

// ৫. লিংক প্রিভিউ
async function fetchLinkPreview(url, elementId) {
    try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const result = await response.json();
        
        const data = result.data;
        const el = document.getElementById(elementId);

        if (el && result.status === 'success') {
            el.innerHTML = `
                <a href="${url}" target="_blank" class="preview-card-link">
                    ${data.image ? `<div class="preview-img" style="background-image: url('${data.image.url}')"></div>` : ''}
                    <div class="preview-info">
                        <h4 class="preview-title">${data.title || url}</h4>
                        <p class="preview-desc">${data.description || 'No description available'}</p>
                        <small class="preview-site">${data.publisher || new URL(url).hostname}</small>
                    </div>
                </a>
            `;
        }
    } catch (error) {
        console.error("Preview failed", error);
    }
}

// ৬. ডিলিট ফাংশন
window.deleteNote = async (id) => {
    if(confirm("Delete this?")) {
        await deleteDoc(doc(db, "notes", id));
    }
};
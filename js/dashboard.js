// ১. কনফিগারেশন ইমপোর্ট
import { auth, db, storage } from "./firebase-config.js"; 

// ২. অথেনটিকেশন ফাংশন
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ৩. ফায়ারস্টোর ফাংশন
import { 
    collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ৪. স্টোরেজ ফাংশন
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// DOM এলিমেন্টস
let unsubscribeNotes = null;
const logoutBtn = document.getElementById('logout-btn');
const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('uploadStatus');

// --- ১. মেইন অথেনটিকেশন চেক এবং প্রসেস শুরু ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // ইউজার লগইন না থাকলে লগইন পেজে পাঠাও
        if (unsubscribeNotes) {
            unsubscribeNotes();
            unsubscribeNotes = null;
        }
        window.location.href = "index.html"; 
    } else {
        console.log("Logged in as:", user.email);
        
        // A. ইউজারের পুরনো নোটস লোড করো
        loadUserNotes(user.uid);

        // B. [গুরুত্বপূর্ণ] অ্যাপ থেকে শেয়ার করা লিংক চেক করো
        handleSharedContent(user.uid);
    }
});

// --- ২. অটো সেভ লজিক (Android Share Intent হ্যান্ডেলার) ---
async function handleSharedContent(userId) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Android App পাঠাচ্ছে '?note=', তাই আমরা 'note' চেক করবো
    // ব্যাকআপ হিসেবে 'text' রাখা হলো
    const sharedRaw = urlParams.get('note') || urlParams.get('text');

    if (sharedRaw && sharedRaw.trim() !== "") {
        try {
            // ১. এনকোড করা লিংক বা টেক্সট ডিকোড করা
            const decodedContent = decodeURIComponent(sharedRaw);
            console.log("Shared content detected:", decodedContent);

            // ২. ইনপুট বক্সে দেখানো (ইউজারকে বোঝানোর জন্য)
            if(noteInput) noteInput.value = "Saving shared link...";

            // ৩. টাইপ নির্ণয় (লিংক নাকি সাধারণ টেক্সট)
            let type = isValidURL(decodedContent) ? 'link' : 'text';

            // ৪. ডাটাবেসে সেভ করা
            await addDoc(collection(db, "notes"), {
                uid: userId,
                text: decodedContent, // মূল কন্টেন্ট
                type: type,
                source: "android_share", // বোঝার সুবিধার্থে ট্যাগ
                timestamp: serverTimestamp()
            });

            // ৫. সফল হলে URL ক্লিন করা (যাতে রিফ্রেশ দিলে আবার সেভ না হয়)
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // ৬. ইনপুট ক্লিয়ার এবং নোটিফিকেশন
            if(noteInput) noteInput.value = ""; 
            // alert("Link auto-saved from App!"); // চাইলে এলার্ট অন রাখতে পারেন

        } catch (error) {
            console.error("Auto-save failed:", error);
            if(noteInput) noteInput.value = "Failed to save share.";
        }
    }
}

// --- ৩. ম্যানুয়াল সেভ লজিক (সেভ বাটনে ক্লিক করলে) ---
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const text = noteInput.value;
        const file = fileInput.files[0];
        const user = auth.currentUser;

        if (!text && !file) return alert("Please write something or select a file!");

        // বাটন ডিজেবল করা (ডবল ক্লিক আটকাতে)
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
        if (statusText) statusText.style.display = 'block';

        try {
            let fileUrl = null;
            let fileType = null;

            // ফাইল থাকলে আপলোড করো
            if (file) {
                if(!storage) throw new Error("Storage not configured properly.");
                
                const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                fileUrl = await getDownloadURL(storageRef);
                fileType = file.type.startsWith('image/') ? 'image' : 'file';
            }

            // টাইপ ডিটেকশন
            let type = 'text';
            if (fileUrl) type = fileType;
            else if (isValidURL(text)) type = 'link';

            // ডাটাবেসে সেভ
            await addDoc(collection(db, "notes"), {
                uid: user.uid,
                text: text,
                fileUrl: fileUrl,
                type: type,
                timestamp: serverTimestamp()
            });

            // ফিল্ড রিসেট
            noteInput.value = "";
            fileInput.value = "";

        } catch (error) {
            console.error("Error saving:", error);
            alert("Error: " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = "Save";
            if (statusText) statusText.style.display = 'none';
        }
    });
}

// --- ৪. লগআউট ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        }).catch((error) => console.error("Logout Error:", error));
    });
}

// --- ৫. হেল্পার ফাংশন: URL ভ্যালিডেশন ---
function isValidURL(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;  
    }
}

// --- ৬. ডাটা লোড এবং দেখানো (রিয়েলটাইম) ---
function loadUserNotes(uid) {
    // শুধুমাত্র বর্তমান ইউজারের ডাটা আনবে, সময়ের উল্টো অর্ডারে
    const q = query(collection(db, "notes"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    const grid = document.getElementById('content-grid'); 

    if (unsubscribeNotes) unsubscribeNotes();

    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        if(!grid) return;
        grid.innerHTML = ""; // আগের কন্টেন্ট মুছে ফেলা
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // কার্ড তৈরি
            const card = document.createElement('div');
            card.className = 'card brain-card'; 
            
            let contentHTML = '';

            // A. ইমেজ হলে
            if (data.type === 'image') {
                contentHTML += `<img src="${data.fileUrl}" alt="Image" style="max-width:100%; border-radius: 8px;">`;
                if(data.text) contentHTML += `<p class="note-text" style="margin-top:10px;">${escapeHtml(data.text)}</p>`;
            }
            // B. লিংক হলে (প্রিভিউ সহ)
            else if (data.type === 'link') {
                const previewId = `preview-${id}`;
                contentHTML += `
                    <div id="${previewId}" class="link-preview-box">
                        <a href="${data.text}" target="_blank" class="raw-link note-text">🔗 ${escapeHtml(data.text)}</a>
                        <small style="display:block; color:#999;">Loading preview...</small>
                    </div>
                `;
                // লিংক প্রিভিউ ফেচ করা
                fetchLinkPreview(data.text, previewId);
            } 
            // C. সাধারণ টেক্সট বা ফাইল
            else {
                if(data.text) contentHTML += `<p class="note-text">${escapeHtml(data.text)}</p>`;
                if (data.type === 'file') {
                    contentHTML += `<br><a href="${data.fileUrl}" target="_blank" class="file-btn" style="display:inline-block; padding:8px 12px; background:#f0f0f0; border-radius:5px; text-decoration:none; color:#333; margin-top:5px;">⬇ Download File</a>`;
                }
            }

            // ফুটার (তারিখ এবং ডিলিট বাটন)
            const dateString = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'Just now';
            contentHTML += `
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    <small style="color: #888; font-size: 11px;">📅 ${dateString}</small>
                    <button class="delete-btn" onclick="deleteNote('${id}')" style="background:none; border:none; cursor:pointer; font-size:16px; color: red;">🗑</button>
                </div>
            `;

            card.innerHTML = contentHTML;
            grid.appendChild(card);
        });
    });
}

// --- ৭. লিংক প্রিভিউ ফেচ (Microlink API) ---
async function fetchLinkPreview(url, elementId) {
    try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const result = await response.json();
        const data = result.data;
        const el = document.getElementById(elementId);

        if (el && result.status === 'success') {
            el.innerHTML = `
                <a href="${url}" target="_blank" class="preview-card-link" style="text-decoration:none; color:inherit; display:block; border:1px solid #eee; border-radius:8px; overflow:hidden; background: #fff;">
                    ${data.image ? `<div class="preview-img" style="height:120px; background-image: url('${data.image.url}'); background-size:cover; background-position:center;"></div>` : ''}
                    <div class="preview-info" style="padding:10px;">
                        <h4 class="preview-title" style="margin:0 0 5px 0; font-size:14px; color:#333;">${data.title || url}</h4>
                        <p class="preview-desc" style="margin:0; font-size:12px; color:#666;">${data.description ? data.description.substring(0, 100) + '...' : ''}</p>
                        <small class="preview-site" style="display:block; margin-top:5px; color:#999; font-size:10px;">${data.publisher || new URL(url).hostname}</small>
                    </div>
                </a>
            `;
        } else if (el) {
             // প্রিভিউ না পেলে শুধু লিংক দেখাও
             el.innerHTML = `<a href="${url}" target="_blank" class="raw-link note-text">🔗 ${escapeHtml(url)}</a>`;
        }
    } catch (error) {
        console.log("Preview load failed:", error);
    }
}

// --- ৮. সিকিউরিটি: XSS প্রতিরোধের জন্য ---
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- ৯. ডিলিট ফাংশন (Global Scope এ রাখা হয়েছে যাতে HTML থেকে কল করা যায়) ---
window.deleteNote = async (id) => {
    if(confirm("Are you sure you want to delete this?")) {
        try {
            await deleteDoc(doc(db, "notes", id));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Delete failed!");
        }
    }
};
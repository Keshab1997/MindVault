// ১. কনফিগারেশন ইমপোর্ট
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// 👇 Cloudinary সেটআপ
const CLOUDINARY_CLOUD_NAME = "dfi0mg8bb"; 
const CLOUDINARY_PRESET = "i2tvy1m9";    
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
// ============================================

// DOM এলিমেন্টস
let unsubscribeNotes = null;

// [FIXED] Logout ID সঠিক করা হয়েছে
const logoutBtn = document.getElementById('menu-logout-btn'); 

const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('uploadStatus');

// [NEW] সার্চ ইনপুট ধরা হয়েছে
const searchInput = document.getElementById('searchInput');

// প্রিভিউ এলিমেন্টস
const previewContainer = document.getElementById('image-preview-container');
const previewImage = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

// আইকন ট্রিগার
const triggerFile = document.getElementById('triggerFile');
const triggerLink = document.getElementById('triggerLink');

// --- ১. UI ইভেন্ট লিসেনার ---

// [NEW] সার্চ লজিক যোগ করা হয়েছে
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.note-card');

        cards.forEach(card => {
            const textContent = card.innerText.toLowerCase();
            if (textContent.includes(searchText)) {
                card.style.display = 'block'; // ম্যাচ করলে দেখাবে
            } else {
                card.style.display = 'none';  // ম্যাচ না করলে লুকাবে
            }
        });
    });
}

// ক্যামেরা আইকনে ক্লিক
if(triggerFile && fileInput) {
    triggerFile.addEventListener('click', () => fileInput.click());
}

// ফাইল সিলেক্ট এবং প্রিভিউ লজিক
if(fileInput) {
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                previewContainer.style.display = 'block';
            }
            reader.readAsDataURL(file);

            triggerFile.style.color = '#007bff'; 
            triggerFile.title = "Selected: " + file.name;
        }
    });
}

// প্রিভিউ রিমুভ বাটন
if(removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
        clearFileInput();
    });
}

// লিংক আইকনে ক্লিক
if(triggerLink && noteInput) {
    triggerLink.addEventListener('click', () => {
        noteInput.focus();
        noteInput.placeholder = "Paste your link here...";
    });
}

// --- ২. মেইন অথেনটিকেশন ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        if (unsubscribeNotes) unsubscribeNotes();
        window.location.href = "index.html"; 
    } else {
        console.log("User Logged In:", user.uid);
        loadUserNotes(user.uid);
        handleSharedContent(user.uid);
        
        // লগইন করার পর ইউজারনেম আপডেট (Navbar)
        const navUserName = document.getElementById('nav-user-name');
        const navUserImg = document.getElementById('nav-user-img');
        const navProfileDiv = document.getElementById('nav-mini-profile');

        if(navProfileDiv) navProfileDiv.style.display = 'flex';
        if(navUserName) navUserName.textContent = user.displayName || user.email.split('@')[0];
        if(navUserImg && user.photoURL) navUserImg.src = user.photoURL;
    }
});

// --- ৩. অটো সেভ লজিক (Android Share) ---
async function handleSharedContent(userId) {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedRaw = urlParams.get('note') || urlParams.get('text');

    if (sharedRaw && sharedRaw.trim() !== "") {
        try {
            const decodedContent = decodeURIComponent(sharedRaw);
            if(noteInput) noteInput.value = "Saving shared link...";

            let type = isValidURL(decodedContent) ? 'link' : 'text';

            await addDoc(collection(db, "notes"), {
                uid: userId,
                text: decodedContent,
                type: type,
                source: "android_share",
                timestamp: serverTimestamp()
            });

            window.history.replaceState({}, document.title, window.location.pathname);
            if(noteInput) noteInput.value = ""; 

        } catch (error) {
            console.error("Auto-save failed:", error);
        }
    }
}

// --- ৪. ম্যানুয়াল সেভ লজিক ---
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const text = noteInput.value;
        const file = fileInput.files[0];
        const user = auth.currentUser;

        if (!text && !file) return alert("Please write something or select a file!");

        saveBtn.disabled = true;
        saveBtn.innerText = "Uploading...";
        if (statusText) statusText.style.display = 'block';

        try {
            let fileUrl = null;
            let fileType = 'text';

            // ১. ছবি থাকলে Cloudinary তে আপলোড
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', CLOUDINARY_PRESET); 

                const response = await fetch(CLOUDINARY_URL, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Upload failed: ${errorData.error.message}`);
                }

                const cloudData = await response.json();
                fileUrl = cloudData.secure_url; 
                fileType = 'image';
            }

            // ২. টাইপ ঠিক করা
            let type = 'text';
            if (fileUrl) type = 'image';
            else if (isValidURL(text)) type = 'link';

            // ৩. ডাটাবেসে সেভ
            await addDoc(collection(db, "notes"), {
                uid: user.uid,
                text: text,
                fileUrl: fileUrl, 
                type: type,
                timestamp: serverTimestamp()
            });

            // সব ইনপুট ক্লিয়ার
            noteInput.value = "";
            clearFileInput(); 

        } catch (error) {
            console.error("Error saving:", error);
            alert("Error: " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = "Save to Brain";
            if (statusText) statusText.style.display = 'none';
        }
    });
}

// --- হেল্পার: ফাইল ইনপুট রিসেট ---
function clearFileInput() {
    fileInput.value = ""; 
    if(previewContainer) previewContainer.style.display = 'none'; 
    if(previewImage) previewImage.src = ""; 
    
    if(triggerFile) {
        triggerFile.style.color = ""; 
        triggerFile.title = "Add Image";
    }
}

// --- ৫. লগআউট (FIXED) ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault(); // লিংকের ডিফল্ট বিহেভিয়ার বন্ধ করা
        signOut(auth).then(() => {
            console.log("User signed out");
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Sign Out Error", error);
        });
    });
} else {
    console.error("Logout Button NOT FOUND! Check HTML ID 'menu-logout-btn'");
}

// --- ৬. ইউআরএল ভ্যালিডেশন ---
function isValidURL(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) { return false; }
}

// --- ৭. ডাটা লোড এবং দেখানো ---
function loadUserNotes(uid) {
    const q = query(collection(db, "notes"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    const grid = document.getElementById('content-grid'); 

    if (unsubscribeNotes) unsubscribeNotes();

    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        if(!grid) return;
        grid.innerHTML = ""; 
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.className = 'note-card'; 
            
            let cardType = 'note';
            if (data.type === 'image') cardType = 'image';
            else if (data.type === 'link') cardType = 'link';
            
            card.setAttribute('data-type', cardType);

            let contentHTML = '';

            // A. ইমেজ
            if (data.type === 'image') {
                contentHTML += `<img src="${data.fileUrl}" loading="lazy" alt="Image" style="width:100%; border-radius: 8px; display:block;">`;
                if(data.text) contentHTML += `<p class="note-text" style="margin-top:10px;">${escapeHtml(data.text)}</p>`;
            }
            // B. লিংক (Enhanced Preview)
            else if (data.type === 'link') {
                const previewId = `preview-${id}`;
                contentHTML += `
                    <div id="${previewId}" class="link-preview-box">
                        <a href="${data.text}" target="_blank" class="raw-link note-text">🔗 ${escapeHtml(data.text)}</a>
                        <small style="display:block; color:#999; margin-top:5px;">Loading preview...</small>
                    </div>
                `;
                fetchLinkPreview(data.text, previewId);
            } 
            // C. টেক্সট
            else {
                if(data.text) contentHTML += `<p class="note-text">${escapeHtml(data.text)}</p>`;
            }

            const dateString = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : '';
            contentHTML += `
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-color, #eee);">
                    <small style="color: var(--text-muted, #888); font-size: 11px;">${dateString}</small>
                    <button class="delete-btn" onclick="deleteNote('${id}')" style="background:none; border:none; cursor:pointer; font-size:16px; color: #ff4d4d;">🗑</button>
                </div>
            `;

            card.innerHTML = contentHTML;
            grid.appendChild(card);
        });
    });
}

// --- ৮. লিংক প্রিভিউ (UPDATED: More Details) ---
async function fetchLinkPreview(url, elementId) {
    try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const result = await response.json();
        const data = result.data;
        const el = document.getElementById(elementId);

        if (el && result.status === 'success') {
            // [UPDATED] ডেসক্রিপশন এবং পাবলিশার যোগ করা হয়েছে
            const description = data.description 
                ? `<p style="font-size: 12px; color: #666; margin: 5px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${data.description}</p>` 
                : '';
            
            const publisher = data.publisher || new URL(url).hostname;

            el.innerHTML = `
                <a href="${url}" target="_blank" class="preview-card-link" style="text-decoration:none; color:inherit; display:block; border:1px solid #ddd; border-radius:8px; overflow:hidden; background: var(--card-bg, #fff); transition: transform 0.2s;">
                    ${data.image ? `<div class="preview-img" style="height:140px; background-image: url('${data.image.url}'); background-size:cover; background-position:center;"></div>` : ''}
                    <div class="preview-info" style="padding:12px;">
                        <h4 class="preview-title" style="margin:0 0 5px 0; font-size:15px; font-weight:600; line-height:1.3;">${data.title || url}</h4>
                        ${description}
                        <div style="font-size: 10px; color: #999; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${publisher}</div>
                    </div>
                </a>
            `;
        }
    } catch (error) { console.log("Preview error", error); }
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- ১০. ডিলিট ফাংশন ---
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
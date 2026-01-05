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

// স্পিনার স্টাইল ইনজেকশন (CSS ফাইল এডিট না করার জন্য)
const style = document.createElement('style');
style.innerHTML = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .loader-spin { animation: spin 1s linear infinite; border: 2px solid #ddd; border-top: 2px solid #007bff; border-radius: 50%; width: 16px; height: 16px; display: inline-block; }
`;
document.head.appendChild(style);

// DOM এলিমেন্টস
let unsubscribeNotes = null;

const logoutBtn = document.getElementById('menu-logout-btn'); 
const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('uploadStatus');
const searchInput = document.getElementById('searchInput');

// প্রিভিউ এলিমেন্টস
const previewContainer = document.getElementById('image-preview-container');
const previewImage = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

// আইকন ট্রিগার
const triggerFile = document.getElementById('triggerFile');
const triggerLink = document.getElementById('triggerLink');

// --- ১. UI ইভেন্ট লিসেনার ---

// সার্চ লজিক
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.note-card');

        cards.forEach(card => {
            const textContent = card.innerText.toLowerCase();
            if (textContent.includes(searchText)) {
                card.style.display = 'block'; 
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// ফাইল/ক্যামেরা আইকনে ক্লিক
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
        
        // লগইন করার পর ইউজারনেম আপডেট
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

function clearFileInput() {
    fileInput.value = ""; 
    if(previewContainer) previewContainer.style.display = 'none'; 
    if(previewImage) previewImage.src = ""; 
    if(triggerFile) {
        triggerFile.style.color = ""; 
        triggerFile.title = "Add Image";
    }
}

// --- ৫. লগআউট ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault(); 
        signOut(auth).then(() => {
            console.log("User signed out");
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Sign Out Error", error);
        });
    });
}

// --- ৬. ইউআরএল ভ্যালিডেশন ---
function isValidURL(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) { return false; }
}

// --- ৭. ডাটা লোড এবং রেন্ডারিং ---
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

            // A. ইমেজ কার্ড
            if (data.type === 'image') {
                contentHTML += `<img src="${data.fileUrl}" loading="lazy" alt="Image" style="width:100%; border-radius: 8px; display:block;">`;
                if(data.text) contentHTML += `<p class="note-text" style="margin-top:10px;">${escapeHtml(data.text)}</p>`;
            }
            // B. লিংক কার্ড (লোডিং স্টেট সহ)
            else if (data.type === 'link') {
                const previewId = `preview-${id}`;
                contentHTML += `
                    <div id="${previewId}" class="link-preview-box">
                        <div style="padding: 15px; border: 1px solid #f0f0f0; border-radius: 8px; background: #fafafa;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="loader-spin"></div>
                                <span style="font-size: 13px; color: #777;">Loading preview...</span>
                            </div>
                            <a href="${data.text}" target="_blank" class="raw-link note-text" style="margin-top:8px; display:block; font-size:12px; color:#007bff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8;">${escapeHtml(data.text)}</a>
                        </div>
                    </div>
                `;
                // প্রিভিউ লোড শুরু (একটু সময় নিয়ে কল করা যাতে UI আটকে না যায়)
                setTimeout(() => fetchLinkPreview(data.text, previewId), 100);
            } 
            // C. টেক্সট কার্ড
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

// --- ৮. লিংক প্রিভিউ (UPDATED & FIXED) ---
async function fetchLinkPreview(url, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    try {
        // ১. Microlink API সেটআপ
        const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        // যদি সফল হয় এবং ডাটা থাকে
        if (result.status === 'success' && result.data) {
            const data = result.data;
            const title = data.title || url;
            const description = data.description || '';
            const image = data.image ? data.image.url : null;
            const logo = data.logo ? data.logo.url : null;
            const publisher = data.publisher || new URL(url).hostname;

            let htmlContent = `
                <a href="${url}" target="_blank" style="text-decoration:none; color:inherit; display:block; border:1px solid #eee; border-radius:8px; overflow:hidden; background: #fff;">
            `;

            // ইমেজ থাকলে দেখাবে
            if (image) {
                htmlContent += `
                    <div style="height:140px; background-image: url('${image}'); background-size: cover; background-position: center;"></div>
                `;
            }

            htmlContent += `
                    <div style="padding:10px;">
                        <h4 style="margin:0 0 5px 0; font-size:14px; color:#333; line-height:1.4;">${escapeHtml(title)}</h4>
                        ${description ? `<div style="font-size:12px; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:5px;">${escapeHtml(description)}</div>` : ''}
                        
                        <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#999;">
                            ${logo ? `<img src="${logo}" style="width:14px; height:14px; border-radius:2px;">` : '🔗'}
                            <span>${escapeHtml(publisher)}</span>
                        </div>
                    </div>
                </a>
            `;

            el.innerHTML = htmlContent;

        } else {
            // API কাজ না করলে বা ডাটা না পেলে Fallback View দেখাবে
            throw new Error("No preview data");
        }

    } catch (error) {
        console.warn("Preview failed, showing fallback for:", url);
        
        // --- ফালব্যাক ডিজাইন (Fallback Design) ---
        // সোশ্যাল মিডিয়ার জন্য স্পেশাল কালার
        let brandColor = '#f8f9fa';
        let textColor = '#333';
        let iconHtml = '🔗';
        let siteName = 'Website';
        let subText = 'Click to open link';

        if (url.includes('facebook.com')) {
            brandColor = '#1877F2'; textColor = '#fff'; iconHtml = '<b>f</b>'; siteName = 'Facebook'; subText = 'View on Facebook';
        } else if (url.includes('instagram.com')) {
            brandColor = 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'; 
            textColor = '#fff'; iconHtml = '📷'; siteName = 'Instagram'; subText = 'View on Instagram';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            brandColor = '#FF0000'; textColor = '#fff'; iconHtml = '▶️'; siteName = 'YouTube'; subText = 'Watch Video';
        }

        // Fallback UI রেন্ডার করা (broken image বা error ছাড়া)
        el.innerHTML = `
            <a href="${url}" target="_blank" style="text-decoration:none; display:flex; align-items:center; gap:12px; padding:12px; border-radius:8px; background: ${brandColor}; color: ${textColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="width:36px; height:36px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px;">
                    ${iconHtml}
                </div>
                <div style="overflow:hidden;">
                    <div style="font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subText}</div>
                    <div style="font-size:11px; opacity:0.9;">${siteName}</div>
                </div>
                <div style="margin-left:auto; font-size:18px; opacity:0.8;">↗</div>
            </a>
            <div style="margin-top:4px; font-size:10px; color:#aaa; padding-left:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${url}</div>
        `;
    }
}

// HTML ক্যারেক্টার এস্কেপ
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- ১০. ডিলিট ফাংশন ---
window.deleteNote = async (id) => {
    if(confirm("Are you sure you want to delete this?")) {
        try {
            await deleteDoc(doc(db, "notes", id));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Delete failed! Check console.");
        }
    }
};
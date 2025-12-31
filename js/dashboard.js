// ১. কনফিগারেশন ইমপোর্ট (storage সহ)
import { auth, db, storage } from "./firebase-config.js"; 

// ২. অথেনটিকেশন ফাংশন
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ৩. ফায়ারস্টোর ফাংশন (deleteDoc এবং doc যোগ করা হয়েছে)
import { 
    collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ৪. স্টোরেজ ফাংশন (ফাইল আপলোডের জন্য এগুলো লাগবে)
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ভেরিয়েবল
let unsubscribeNotes = null;
const logoutBtn = document.getElementById('logout-btn');
const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('uploadStatus');

// --- ১. মেইন অথেনটিকেশন চেক এবং অটো সেভ ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        if (unsubscribeNotes) {
            unsubscribeNotes();
            unsubscribeNotes = null;
        }
        window.location.href = "index.html";
    } else {
        console.log("Logged in as:", user.email);
        
        // ১. নোটস লোড করো
        loadUserNotes(user.uid);

        // ২. [নতুন] শেয়ার করা লিংক চেক এবং সেভ করো (Android App এর জন্য)
        handleSharedContent(user.uid);
    }
});

// --- ২. অটো সেভ লজিক (Share Intent) ---
async function handleSharedContent(userId) {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text');

    if (sharedText && sharedText.trim() !== "") {
        console.log("Shared content detected:", sharedText);
        
        // ইনপুটে দেখাও যে সেভ হচ্ছে
        if(noteInput) noteInput.value = "Saving shared content...";

        try {
            // লিংকের টাইপ ডিটেক্ট করা
            let type = isValidURL(sharedText) ? 'link' : 'text';

            await addDoc(collection(db, "notes"), {
                content: sharedText, // আগের কোডে 'text' ছিল, কিন্তু শেয়ার লজিকের জন্য 'content' বা 'text' যে কোনো একটা কনসিস্টেন্ট রাখো। আমি নিচে 'text' ব্যবহার করেছি।
                text: sharedText,
                uid: userId,
                type: type,
                source: "app_share",
                timestamp: serverTimestamp()
            });

            // URL পরিষ্কার করা
            window.history.replaceState({}, document.title, "dashboard.html");
            
            if(noteInput) noteInput.value = ""; 
            alert("Shared content saved to Brain!");

        } catch (error) {
            console.error("Auto-save failed:", error);
            alert("Failed to save shared content.");
        }
    }
}

// --- ৩. ম্যানুয়াল সেভ লজিক (বাটন ক্লিক) ---
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const text = noteInput.value;
        const file = fileInput.files[0];
        const user = auth.currentUser;

        if (!text && !file) return alert("Please write something or select a file!");

        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
        if (statusText) statusText.style.display = 'block';

        try {
            let fileUrl = null;
            let fileType = null;

            // ফাইল আপলোড লজিক
            if (file) {
                if(!storage) {
                    throw new Error("Storage not configured in firebase-config.js");
                }
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
                timestamp: serverTimestamp()
            });

            noteInput.value = "";
            fileInput.value = "";

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

// --- ৪. লগআউট ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        }).catch((error) => console.error("Logout Error:", error));
    });
}

// --- ৫. হেল্পার ফাংশন সমূহ ---

// URL ভ্যালিডেশন
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// টাইমস্ট্যাম্প ফরম্যাট
function formatFirestoreTimestamp(timestamp) {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate(); 
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: 'numeric', 
        hour12: true 
    });
}

// --- ৬. ডাটা লোড এবং দেখানো ---
function loadUserNotes(uid) {
    const q = query(collection(db, "notes"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    const grid = document.getElementById('content-grid'); // তোমার HTML এ এই ID থাকতে হবে

    if (unsubscribeNotes) unsubscribeNotes();

    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        if(!grid) return; // এরর হ্যান্ডেলিং
        grid.innerHTML = ""; 
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const dateString = formatFirestoreTimestamp(data.timestamp);

            const card = document.createElement('div');
            card.className = 'card brain-card'; 
            
            let contentHTML = '';

            // ---- কন্টেন্ট রেন্ডারিং ----
            if (data.type === 'image') {
                contentHTML += `<img src="${data.fileUrl}" alt="Image" style="max-width:100%; border-radius: 8px;">`;
                if(data.text) contentHTML += `<p class="note-text" style="margin-top:10px;">${data.text}</p>`;
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
                // টেক্সট এবং ফাইল
                if(data.text) contentHTML += `<p class="note-text">${data.text}</p>`;
                if (data.type === 'file') {
                    contentHTML += `<br><a href="${data.fileUrl}" target="_blank" class="file-btn" style="display:inline-block; padding:8px 12px; background:#f0f0f0; border-radius:5px; text-decoration:none; color:#333; margin-top:5px;">⬇ Download File</a>`;
                }
            }

            // ---- ফুটার (তারিখ ও ডিলিট) ----
            contentHTML += `
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    <small style="color: #888; font-size: 11px;">📅 ${dateString}</small>
                    <button class="delete-btn" onclick="deleteNote('${id}')" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑</button>
                </div>
            `;

            card.innerHTML = contentHTML;
            grid.appendChild(card);
        });
    });
}

// --- ৭. লিংক প্রিভিউ ফেচ ---
async function fetchLinkPreview(url, elementId) {
    try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const result = await response.json();
        const data = result.data;
        const el = document.getElementById(elementId);

        if (el && result.status === 'success') {
            el.innerHTML = `
                <a href="${url}" target="_blank" class="preview-card-link" style="text-decoration:none; color:inherit; display:block; border:1px solid #eee; border-radius:8px; overflow:hidden;">
                    ${data.image ? `<div class="preview-img" style="height:120px; background-image: url('${data.image.url}'); background-size:cover; background-position:center;"></div>` : ''}
                    <div class="preview-info" style="padding:10px;">
                        <h4 class="preview-title" style="margin:0 0 5px 0; font-size:14px;">${data.title || url}</h4>
                        <p class="preview-desc" style="margin:0; font-size:12px; color:#666;">${data.description || 'No description'}</p>
                        <small class="preview-site" style="display:block; margin-top:5px; color:#999; font-size:10px;">${data.publisher || new URL(url).hostname}</small>
                    </div>
                </a>
            `;
        }
    } catch (error) {
        // প্রিভিউ ফেল করলে শুধু লিংক দেখাবে (আগে থেকেই ডিফল্ট HTML এ আছে)
        console.log("Preview load failed for:", url);
    }
}

// --- ৮. গ্লোবাল ডিলিট ফাংশন ---
window.deleteNote = async (id) => {
    if(confirm("Are you sure you want to delete this note?")) {
        try {
            await deleteDoc(doc(db, "notes", id));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Could not delete note.");
        }
    }
};
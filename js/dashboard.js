// ১. কনফিগারেশন ইমপোর্ট
import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, getDoc, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// 👇 Cloudinary সেটআপ
const CLOUDINARY_CLOUD_NAME = "dfi0mg8bb"; 
const CLOUDINARY_PRESET = "i2tvy1m9";    
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const WORKER_URL = "https://royal-rain-33fa.keshabsarkar2018.workers.dev";
// ============================================

// স্টাইল ইনজেকশন (স্পিনার, একটিভ বাটন এবং রিডিং মোডাল)
const style = document.createElement('style');
style.innerHTML = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .loader-spin { animation: spin 1s linear infinite; border: 2px solid #ddd; border-top: 2px solid #007bff; border-radius: 50%; width: 16px; height: 16px; display: inline-block; }
  .filter-btn.active { background-color: #007bff !important; color: white !important; border-color: #007bff; }
  .folder-chip.active { background-color: #007bff !important; color: white !important; border: 1px solid #007bff; }
  .view-btn.active { background-color: #1877f2; color: white; border-color: #1877f2; }

  /* 👇 রিডিং মোডাল স্টাইল (Reading Mode) */
  .read-modal-overlay {
      display: none; 
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.6); z-index: 2000;
      justify-content: center; align-items: center;
      backdrop-filter: blur(5px);
  }
  .read-modal-paper {
      background: #fff; width: 90%; max-width: 700px; height: 85vh;
      border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      display: flex; flex-direction: column; overflow: hidden;
      position: relative; animation: slideUp 0.3s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  
  .read-header {
      padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f9f9f9;
  }
  .read-meta { font-size: 12px; color: #666; display: flex; gap: 10px; align-items: center; }
  .read-badge { background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
  .read-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #555; }
  
  .read-content {
      padding: 30px; overflow-y: auto; font-family: 'Georgia', serif; /* বইয়ের মতো ফন্ট */
      font-size: 18px; line-height: 1.8; color: #2d2d2d; flex: 1;
  }
  .read-content img { max-width: 100%; border-radius: 8px; margin: 15px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
  .read-content a { color: #007bff; text-decoration: underline; }
  .read-content blockquote { border-left: 4px solid #007bff; padding-left: 15px; color: #555; font-style: italic; margin: 20px 0; }
`;
document.head.appendChild(style);

// --- গ্লোবাল ভেরিয়েবল ---
let unsubscribeNotes = null;
let unsubscribeFolders = null; 
let androidSharedImage = null; 
let currentEditId = null; 

// --- DOM এলিমেন্টস ---
const logoutBtn = document.getElementById('menu-logout-btn'); 
const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('uploadStatus');
const searchInput = document.getElementById('searchInput');

// ফোল্ডার এবং ভিউ এলিমেন্টস
const createFolderBtn = document.getElementById('createFolderBtn');
const customFolderList = document.getElementById('custom-folder-list');
const folderSelect = document.getElementById('folderSelect');
const contentGrid = document.getElementById('content-grid');
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');

// প্রিভিউ, এডিট এবং রিডিং মোডাল
const previewContainer = document.getElementById('image-preview-container');
const previewImage = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const triggerFile = document.getElementById('triggerFile');

// এডিট মোডাল
const editModal = document.getElementById('editModal');
const editNoteInput = document.getElementById('editNoteInput');
const updateNoteBtn = document.getElementById('updateNoteBtn');
const closeModalBtn = document.querySelector('.close-modal');
const contextMenu = document.getElementById('contextMenu');

// 👇 নতুন: রিডিং মোডাল এলিমেন্টস (HTML এ এগুলো যোগ করতে হবে)
const readModal = document.getElementById('readModal');
const readModalContent = document.getElementById('readModalContent'); 
const readModalDate = document.getElementById('readModalDate');
const readModalFolder = document.getElementById('readModalFolder');
const closeReadModalBtn = document.getElementById('closeReadModalBtn');

// --- ১. অথেনটিকেশন ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html"; 
    } else {
        loadUserFolders(user.uid);
        // ডিফল্টভাবে 'All' একটিভ থাকবে
        const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if(allBtn) allBtn.classList.add('active');
        
        loadUserNotes(user.uid, 'All');
        handleSharedContent(user.uid);
        
        // প্রোফাইল UI আপডেট
        const navUserName = document.getElementById('nav-user-name');
        const navUserImg = document.getElementById('nav-user-img');
        const navProfileDiv = document.getElementById('nav-mini-profile');
        if(navProfileDiv) navProfileDiv.style.display = 'flex';
        if(navUserName) navUserName.textContent = user.displayName || user.email.split('@')[0];
        if(navUserImg && user.photoURL) navUserImg.src = user.photoURL;
    }
});

// ==================================================
// 📁 ২. ফোল্ডার ম্যানেজমেন্ট
// ==================================================

// A. ফোল্ডার লোড করা
function loadUserFolders(uid) {
    const q = query(collection(db, "folders"), where("uid", "==", uid), orderBy("createdAt", "asc"));
    
    if(unsubscribeFolders) unsubscribeFolders();

    unsubscribeFolders = onSnapshot(q, (snapshot) => {
        if(customFolderList) customFolderList.innerHTML = "";
        if(folderSelect) folderSelect.innerHTML = `<option value="General">General</option>`;

        // "General" বাটন
        if(customFolderList) {
            const genBtn = document.createElement('div');
            genBtn.className = 'folder-chip';
            genBtn.innerText = "📁 General";
            genBtn.onclick = () => filterByFolder('General', genBtn);
            customFolderList.appendChild(genBtn);
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const fName = data.name;
            const fId = docSnap.id;

            // ফোল্ডার লিস্ট
            if(customFolderList) {
                const btn = document.createElement('div');
                btn.className = 'folder-chip';
                
                const nameSpan = document.createElement('span');
                nameSpan.innerText = `📁 ${fName}`;
                btn.appendChild(nameSpan);

                // ডিলিট বাটন
                const delIcon = document.createElement('span');
                delIcon.className = 'folder-delete-btn';
                delIcon.innerHTML = '×';
                
                delIcon.onclick = (e) => {
                    e.stopPropagation(); 
                    deleteCustomFolder(fId, fName);
                };

                btn.appendChild(delIcon);
                btn.onclick = () => filterByFolder(fName, btn);
                customFolderList.appendChild(btn);
            }

            // ড্রপডাউন অপশন
            if(folderSelect) {
                const option = document.createElement('option');
                option.value = fName;
                option.innerText = fName;
                folderSelect.appendChild(option);
            }
        });
    });
}

// B. ফোল্ডার ফিল্টার
function filterByFolder(folderName, clickedBtn) {
    const uid = auth.currentUser.uid;
    
    document.querySelectorAll('.folder-chip').forEach(b => b.classList.remove('active'));
    if(clickedBtn) clickedBtn.classList.add('active');

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(searchInput) searchInput.value = "";

    loadUserNotes(uid, 'folder', folderName);
}

// C. ফোল্ডার তৈরি
if(createFolderBtn) {
    createFolderBtn.addEventListener('click', async () => {
        const folderName = prompt("Enter new folder name:");
        if(folderName && folderName.trim() !== "") {
            try {
                await addDoc(collection(db, "folders"), {
                    uid: auth.currentUser.uid,
                    name: folderName.trim(),
                    createdAt: serverTimestamp()
                });
            } catch (e) { alert("Error creating folder"); }
        }
    });
}

// D. ফোল্ডার ডিলিট
async function deleteCustomFolder(folderId, folderName) {
    if(!confirm(`Delete "${folderName}"? Notes will move to 'General'.`)) return;
    try {
        const batch = writeBatch(db);
        const q = query(collection(db, "notes"), where("uid", "==", auth.currentUser.uid), where("folder", "==", folderName));
        const snaps = await getDocs(q);
        snaps.forEach((doc) => batch.update(doc.ref, { folder: "General" }));
        batch.delete(doc(db, "folders", folderId));
        await batch.commit();
        
        const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if(allBtn) allBtn.click();
    } catch (e) { alert("Delete failed"); }
}

// ==================================================
// 🔍 ৩. সার্চ এবং ভিউ লজিক
// ==================================================

// সার্চ ফাংশন
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.note-card');

        cards.forEach(card => {
            const textContent = card.innerText.toLowerCase();
            if (textContent.includes(searchText)) {
                card.style.display = 'inline-block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// গ্রিড এবং লিস্ট ভিউ টগল
if(gridViewBtn && listViewBtn) {
    gridViewBtn.addEventListener('click', () => {
        contentGrid.classList.remove('list-view');
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    });

    listViewBtn.addEventListener('click', () => {
        contentGrid.classList.add('list-view');
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    });
}

// ==================================================
// 📝 ৪. নোট ম্যানেজমেন্ট (Load & Save)
// ==================================================

function loadUserNotes(uid, filterType = 'All', filterValue = null) {
    const notesRef = collection(db, "notes");
    let q;

    const pinSection = document.getElementById('pinned-section');
    if(pinSection) pinSection.style.display = 'none';

    if (filterType === 'trash') {
        q = query(notesRef, where("uid", "==", uid), where("status", "==", "trash"), orderBy("timestamp", "desc"));
    } 
    else if (filterType === 'folder') {
        loadPinnedNotes(uid); 
        q = query(notesRef, where("uid", "==", uid), where("status", "==", "active"), where("folder", "==", filterValue), orderBy("timestamp", "desc"));
    }
    else if (filterType !== 'All' && filterType !== 'all') {
        loadPinnedNotes(uid);
        q = query(notesRef, where("uid", "==", uid), where("status", "==", "active"), where("type", "==", filterType), orderBy("timestamp", "desc"));
    } 
    else {
        loadPinnedNotes(uid);
        q = query(notesRef, where("uid", "==", uid), where("status", "==", "active"), orderBy("timestamp", "desc"));
    }
    
    if (unsubscribeNotes) unsubscribeNotes();

    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        if(!contentGrid) return;
        contentGrid.innerHTML = ""; 
        
        if(snapshot.empty) {
            contentGrid.innerHTML = `<p style="text-align:center; color:#999; width:100%; margin-top:20px;">No notes found here.</p>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (filterType !== 'trash' && data.isPinned) return; 
            const card = createNoteCard(docSnap);
            contentGrid.appendChild(card);
        });

        // যদি সার্চ বক্সে কিছু লেখা থাকে তবে ফিল্টার আবার চালাও
        if(searchInput && searchInput.value) searchInput.dispatchEvent(new Event('input'));

        // Drag & Drop
        if (typeof Sortable !== 'undefined') {
             if (contentGrid.sortableInstance) contentGrid.sortableInstance.destroy();
             contentGrid.sortableInstance = new Sortable(contentGrid, { 
                 animation: 150, ghostClass: 'sortable-ghost', handle: '.drag-handle', delay: 100
             });
        }
    });
}

// ফিল্টার বাটন হ্যান্ডলার
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.folder-chip').forEach(b => b.classList.remove('active'));
        const type = btn.getAttribute('data-filter');
        loadUserNotes(auth.currentUser.uid, type);
    });
});

// পিন নোট লোড
function loadPinnedNotes(uid) {
    const q = query(collection(db, "notes"), where("uid", "==", uid), where("isPinned", "==", true), where("status", "==", "active"));
    const pinSection = document.getElementById('pinned-section');
    const pinGrid = document.getElementById('pinned-grid');
    if(!pinSection || !pinGrid) return;

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            pinSection.style.display = 'none';
        } else {
            pinSection.style.display = 'block';
            pinGrid.innerHTML = "";
            snapshot.forEach((docSnap) => {
                pinGrid.appendChild(createNoteCard(docSnap));
            });
        }
    });
}

// নোট সেভ
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const rawText = noteInput.value;
        const file = fileInput.files[0];
        const user = auth.currentUser;
        const selectedColor = document.querySelector('input[name="noteColor"]:checked')?.value || "#ffffff";
        const targetFolder = folderSelect ? folderSelect.value : "General";

        if (!rawText && !file && !androidSharedImage) return alert("Empty note!");

        const text = normalizeUrl(rawText);
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
        
        try {
            let fileUrl = null;
            let type = 'text';
            let linkMeta = {};

            if (file || androidSharedImage) {
                const formData = new FormData();
                formData.append('file', file || androidSharedImage);
                formData.append('upload_preset', CLOUDINARY_PRESET); 
                const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
                const data = await res.json();
                fileUrl = data.secure_url; 
                type = 'image';
            } 
            else if (isValidURL(text)) {
                type = 'link';
                linkMeta = await getLinkPreviewData(text);
            }

            await addDoc(collection(db, "notes"), {
                uid: user.uid, text: text, fileUrl: fileUrl, type: type,
                color: selectedColor, folder: targetFolder, isPinned: false, status: 'active',
                metaTitle: linkMeta.title || null, metaDesc: linkMeta.description || null,
                metaImg: linkMeta.image || null, metaDomain: linkMeta.domain || null,
                timestamp: serverTimestamp()
            });

            noteInput.value = "";
            clearFileInput(); 

        } catch (error) { alert("Error: " + error.message); } 
        finally {
            saveBtn.disabled = false;
            saveBtn.innerText = "Save to Brain";
        }
    });
}

// ==================================================
// 🎨 ৫. কার্ড জেনারেটর (Updated with Reading Modal)
// ==================================================

function createNoteCard(docSnap) {
    const data = docSnap.data();
    const id = docSnap.id;
    const card = document.createElement('div');
    card.className = 'note-card'; 
    card.setAttribute('data-id', id);
    if(data.color) card.style.backgroundColor = data.color;

    const dragIcon = document.createElement('div');
    dragIcon.className = 'drag-handle';
    dragIcon.innerHTML = '⋮⋮'; 
    card.appendChild(dragIcon);
    
    if(data.isPinned) card.innerHTML += `<div class="pin-indicator">📌</div>`;

    if(data.folder) {
        const folderBadge = document.createElement('span');
        folderBadge.style.cssText = "position:absolute; top:8px; right:30px; background:rgba(0,0,0,0.1); font-size:10px; padding:2px 6px; border-radius:10px; color:#555;";
        folderBadge.innerText = data.folder;
        card.appendChild(folderBadge);
    }

    let contentHTML = '';

    // A. Image Logic
    if (data.type === 'image') {
        contentHTML += `<img src="${data.fileUrl}" loading="lazy" style="width:100%; border-radius: 8px; display:block; margin-bottom:5px;">`;
        if(data.text) {
            contentHTML += generateTextHTML(data.text);
        }
    }
    // B. Link Logic
    else if (data.type === 'link' && data.metaTitle) {
        contentHTML += `
        <a href="${data.text}" target="_blank" style="text-decoration:none; color:inherit; display:block; border:1px solid rgba(0,0,0,0.1); border-radius:10px; overflow:hidden; background: rgba(255,255,255,0.5);">
            ${data.metaImg ? `<div style="height:140px; background-image: url('${data.metaImg}'); background-size: cover; background-position: center;"></div>` : ''}
            <div style="padding:10px;">
                <h4 style="margin:0 0 5px 0; font-size:14px;">${data.metaTitle}</h4>
                <div style="font-size:11px; opacity:0.7;">🔗 ${data.metaDomain || 'Link'}</div>
            </div>
        </a>`;
    } 
    // C. Text Logic
    else {
        contentHTML += generateTextHTML(data.text || '');
    }

    contentHTML += `
        <div class="card-footer">
            <small class="card-date">${data.timestamp?.toDate().toLocaleDateString() || ''}</small>
            <button class="delete-btn" onclick="openContextMenu(event, '${id}')">⋮</button> 
        </div>
    `;

    card.innerHTML += contentHTML; 

    // 👇 নতুন: Read More ইভেন্ট লিসেনার (মোডাল ওপেন করবে)
    const readMoreBtn = card.querySelector('.read-more-btn');
    if (readMoreBtn) {
        readMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // কার্ডের অন্য ক্লিক ইভেন্ট বন্ধ করতে
            openReadModal(data, id);
        });
    }

    // কার্ডে রাইট ক্লিক মেনু
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.openContextMenu(e, id);
    });
    return card;
}

// টেক্সট জেনারেটর (Read More বাটন সহ)
function generateTextHTML(text) {
    if (!text) return "";
    
    // Markdown পার্সিং
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = marked.parse(text);
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    const isLongText = plainText.length > 250; // ২৫০ অক্ষরের বেশি হলে কাটবে

    if (isLongText) {
        // এখানে শুধু অল্প টেক্সট দেখাবো
        const shortText = plainText.substring(0, 250) + "...";
        return `
            <div class="note-text">${shortText}</div>
            <button class="read-more-btn" style="color:#007bff; border:none; background:none; padding:0; cursor:pointer; font-size:13px; margin-top:5px;">Read More...</button>
        `;
    } else {
        return `<div class="note-text">${marked.parse(text)}</div>`;
    }
}

// ==================================================
// 📖 ৬. রিডিং মোডাল ফাংশন (NEW)
// ==================================================
function openReadModal(data, id) {
    if(!readModal || !readModalContent) return;

    // ১. ডেট এবং ফোল্ডার সেট করা
    if(readModalDate) readModalDate.innerText = data.timestamp?.toDate().toLocaleString() || '';
    if(readModalFolder) {
        readModalFolder.style.display = data.folder ? 'inline-block' : 'none';
        readModalFolder.innerText = data.folder || '';
    }

    // ২. মেইন কন্টেন্ট তৈরি
    let html = '';

    // ছবি থাকলে উপরে দেখাবো
    if (data.type === 'image' && data.fileUrl) {
        html += `<img src="${data.fileUrl}" alt="Note Image">`;
    }

    // লিংক থাকলে সুন্দর করে দেখাবো
    if (data.type === 'link') {
        html += `
        <div style="background:#f0f2f5; padding:15px; border-radius:8px; margin-bottom:20px; border-left: 4px solid #007bff;">
            <a href="${data.text}" target="_blank" style="font-size:18px; font-weight:bold;">${data.metaTitle || data.text}</a>
            <p style="margin:5px 0 0 0; color:#666;">${data.metaDesc || ''}</p>
        </div>`;
    }

    // টেক্সট (Markdown রেন্ডার করে)
    if (data.text) {
        html += marked.parse(data.text);
    }

    readModalContent.innerHTML = html;
    readModal.style.display = 'flex'; // মোডাল শো
}

// মোডাল বন্ধ করার লজিক
if(closeReadModalBtn) {
    closeReadModalBtn.addEventListener('click', () => {
        readModal.style.display = 'none';
    });
}
// মোডালের বাইরে ক্লিক করলে বন্ধ হবে
if(readModal) {
    readModal.addEventListener('click', (e) => {
        if(e.target === readModal) {
            readModal.style.display = 'none';
        }
    });
}

// --- ৭. কনটেক্সট মেনু ---
window.openContextMenu = async (e, id) => {
    e.stopPropagation();
    currentEditId = id;
    const docSnap = await getDoc(doc(db, "notes", id));
    
    if(docSnap.exists()){
        const data = docSnap.data();
        if(!contextMenu) return;

        let x = e.pageX;
        let y = e.pageY;
        // মোবাইল ফিক্স
        if(e.type === 'click') {
           const rect = e.target.getBoundingClientRect();
           x = rect.left - 100;
           y = rect.bottom + window.scrollY;
        }

        contextMenu.style.top = `${y}px`;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.display = 'block';
        
        document.getElementById('ctx-trash').onclick = () => { updateDoc(doc(db, "notes", id), { status: 'trash' }); contextMenu.style.display = 'none'; };
        document.getElementById('ctx-edit').onclick = () => { editNoteInput.value = data.text; editModal.style.display = 'flex'; contextMenu.style.display = 'none'; };
        document.getElementById('ctx-copy').onclick = () => { navigator.clipboard.writeText(data.text); contextMenu.style.display = 'none'; };
        const pinBtn = document.getElementById('ctx-pin');
        pinBtn.innerHTML = data.isPinned ? "🚫 Unpin" : "📌 Pin";
        pinBtn.onclick = () => { updateDoc(doc(db, "notes", id), { isPinned: !data.isPinned }); contextMenu.style.display = 'none'; };
    }
};

// --- ৮. ইউটিলিটি ফাংশন ---
if(updateNoteBtn) updateNoteBtn.onclick = async () => {
    if(currentEditId) await updateDoc(doc(db, "notes", currentEditId), { text: editNoteInput.value });
    editModal.style.display = 'none';
};

if(triggerFile) triggerFile.onclick = () => fileInput.click();
if(fileInput) fileInput.onchange = (e) => {
    if(e.target.files[0]) {
        const r = new FileReader();
        r.onload = (ev) => { previewImage.src = ev.target.result; previewContainer.style.display = 'block'; };
        r.readAsDataURL(e.target.files[0]);
    }
};
if(removeImageBtn) removeImageBtn.onclick = clearFileInput;

function clearFileInput() { fileInput.value = ""; androidSharedImage = null; previewContainer.style.display = 'none'; }
function normalizeUrl(u) { if(!u)return""; let x=u.trim(); return (x && !x.startsWith('http') && x.includes('.') && !x.includes(' ')) ? 'https://'+x : x; }
function isValidURL(s) { try { return new URL(s).protocol.startsWith("http"); } catch { return false; } }
async function getLinkPreviewData(url) { try{ const r=await fetch(`${WORKER_URL}?url=${encodeURIComponent(url)}`); const j=await r.json(); return j.status==='success'?j.data:{title:url}; }catch{return{title:url};} }

async function handleSharedContent(uid) {
    const p = new URLSearchParams(window.location.search);
    const txt = p.get('note') || p.get('text');
    if(txt) {
        try {
            await addDoc(collection(db, "notes"), { uid, text: decodeURIComponent(txt), type: 'text', folder: "General", status: 'active', timestamp: serverTimestamp(), color:'#ffffff' });
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch(e){}
    }
}

if (logoutBtn) logoutBtn.onclick = () => signOut(auth).then(() => window.location.href = "index.html");

// উইন্ডো ক্লিক ইভেন্ট
window.addEventListener('click', (e) => {
    if(contextMenu && !contextMenu.contains(e.target) && !e.target.classList.contains('delete-btn')) {
        contextMenu.style.display = 'none';
    }
    if(e.target == editModal) {
        editModal.style.display = 'none';
    }
});
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

// স্টাইল ইনজেকশন (স্পিনার ও একটিভ বাটন)
const style = document.createElement('style');
style.innerHTML = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .loader-spin { animation: spin 1s linear infinite; border: 2px solid #ddd; border-top: 2px solid #007bff; border-radius: 50%; width: 16px; height: 16px; display: inline-block; }
  .filter-btn.active { background-color: #007bff !important; color: white !important; border-color: #007bff; }
  .folder-chip.active { background-color: #007bff !important; color: white !important; border: 1px solid #007bff; }
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

// প্রিভিউ এবং মোডাল
const previewContainer = document.getElementById('image-preview-container');
const previewImage = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const triggerFile = document.getElementById('triggerFile');
const editModal = document.getElementById('editModal');
const editNoteInput = document.getElementById('editNoteInput');
const updateNoteBtn = document.getElementById('updateNoteBtn');
const closeModalBtn = document.querySelector('.close-modal');
const contextMenu = document.getElementById('contextMenu');

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
                delIcon.style.marginLeft = "8px";
                delIcon.style.color = "red";
                delIcon.style.cursor = "pointer";
                
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
// 📝 ৩. নোট ম্যানেজমেন্ট (Load & Save)
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

// --- কার্ড UI ---
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
    if (data.type === 'image') {
        contentHTML += `<img src="${data.fileUrl}" loading="lazy" style="width:100%; border-radius: 8px; display:block; margin-bottom:5px;">`;
        if(data.text) contentHTML += `<div class="note-text">${marked.parse(data.text)}</div>`;
    }
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
    else {
        contentHTML += `<div class="note-text">${marked.parse(data.text || '')}</div>`;
    }

    contentHTML += `
        <div class="card-footer">
            <small class="card-date">${data.timestamp?.toDate().toLocaleDateString() || ''}</small>
            <button class="delete-btn" onclick="openContextMenu(event, '${id}')">⋮</button> 
        </div>
    `;

    card.innerHTML += contentHTML; 
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.openContextMenu(e, id);
    });
    return card;
}

// --- কনটেক্সট মেনু ---
window.openContextMenu = async (e, id) => {
    e.stopPropagation();
    currentEditId = id;
    const docSnap = await getDoc(doc(db, "notes", id));
    
    if(docSnap.exists()){
        const data = docSnap.data();
        if(!contextMenu) return;

        let x = e.pageX;
        let y = e.pageY;
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

// --- ইউটিলিটি ---
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

// ⚡ এই অংশটি আপডেট করা হয়েছে যাতে External JS এর সাথে কনফ্লিক্ট না হয়
window.addEventListener('click', (e) => {
    // কনটেক্সট মেনু বন্ধ করা
    if(contextMenu && !contextMenu.contains(e.target) && !e.target.classList.contains('delete-btn')) {
        contextMenu.style.display = 'none';
    }
    // এডিট মোডাল বন্ধ করা
    if(e.target == editModal) {
        editModal.style.display = 'none';
    }
});
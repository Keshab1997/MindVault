// js/dashboard/menu-manager.js

import { db } from "../core/firebase-config.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import * as DBService from "../core/firebase-service.js";
import * as Utils from "../core/utils.js";

import { showToast } from "../ui-shared.js";

let currentEditId = null;

export async function openContextMenu(e, id) {
    e.stopPropagation();
    e.preventDefault();
    
    currentEditId = id;
    const menu = document.getElementById('contextMenu');
    
    // ব্যাকড্রপ তৈরি (যদি না থাকে)
    let backdrop = document.querySelector('.menu-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'menu-backdrop';
        document.body.appendChild(backdrop);
        backdrop.onclick = () => closeMenu();
    }

    // পিন টেক্সট আপডেট
    const docSnap = await getDoc(doc(db, "notes", id));
    if(docSnap.exists()) {
        const data = docSnap.data();
        const pinBtn = document.getElementById('ctx-pin');
        if(pinBtn) pinBtn.innerHTML = data.isPinned ? "🚫 Unpin Note" : "📌 Pin Note";
    }

    // মেনু এবং ব্যাকড্রপ দেখানো
    backdrop.style.display = 'block';
    menu.classList.add('active');
    menu.style.display = 'block';
}

// মেনু বন্ধ করার ফাংশন
function closeMenu() {
    const menu = document.getElementById('contextMenu');
    const backdrop = document.querySelector('.menu-backdrop');
    if (menu) menu.classList.remove('active');
    if (backdrop) backdrop.style.display = 'none';
}

// ২. রিড মোডাল ওপেন
export function openReadModal(data, id) {
    const modal = document.getElementById('readModal');
    const content = document.getElementById('readModalContent');
    const dateEl = document.getElementById('readModalDate');
    const folderEl = document.getElementById('readModalFolder');

    if(dateEl) dateEl.innerText = data.timestamp?.toDate().toLocaleString() || '';
    if(folderEl) folderEl.innerText = data.folder || 'General';

    const embed = Utils.getUniversalEmbedHTML(data.text);
    let html = embed || (data.text ? marked.parse(data.text) : '');
    
    if(data.type === 'image') {
        html = `<img src="${data.fileUrl}" style="max-width:100%; border-radius:8px; margin-bottom:15px;">` + html;
    }
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

export function setupModals() {
    const contextMenu = document.getElementById('contextMenu');

    // ২. কপি ফাংশন (Copy Text/Link)
    document.getElementById('ctx-copy')?.addEventListener('click', async () => {
        if(!currentEditId) return;
        const docSnap = await getDoc(doc(db, "notes", currentEditId));
        if(docSnap.exists()) {
            const data = docSnap.data();
            const textToCopy = data.text || data.fileUrl || "";
            // হ্যাশট্যাগ রিমুভ করে ক্লিন টেক্সট কপি
            const cleanText = textToCopy.replace(/#\w+/g, '').trim();
            
            navigator.clipboard.writeText(cleanText).then(() => {
                showToast("📋 Copied to clipboard!");
            });
        }
        closeMenu();
    });

    // ৩. পিন/আনপিন ফাংশন
    document.getElementById('ctx-pin')?.addEventListener('click', async () => {
        if(!currentEditId) return;
        const docRef = doc(db, "notes", currentEditId);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) {
            const newStatus = !docSnap.data().isPinned;
            await DBService.togglePinDB(currentEditId, docSnap.data().isPinned);
            showToast(newStatus ? "📌 Pinned to top" : "🚫 Unpinned");
        }
        closeMenu();
    });

    // ৪. ডাউনলোড ফাংশন (Image/Audio/Text)
    document.getElementById('ctx-download')?.addEventListener('click', async () => {
        if(!currentEditId) return;
        const docSnap = await getDoc(doc(db, "notes", currentEditId));
        if(docSnap.exists()) {
            const data = docSnap.data();
            if (data.fileUrl) {
                // ইমেজ বা অডিও হলে সরাসরি ডাউনলোড
                const link = document.createElement('a');
                link.href = data.fileUrl;
                link.download = `MindVault_${data.type}_${currentEditId}`;
                link.target = "_blank";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // টেক্সট নোট হলে .txt ফাইল হিসেবে ডাউনলোড
                const blob = new Blob([data.text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = "note.txt";
                link.click();
                URL.revokeObjectURL(url);
            }
            showToast("⬇️ Downloading...");
        }
        closeMenu();
    });

    // ৫. এডিট ফাংশন (Edit Modal Open)
    document.getElementById('ctx-edit')?.addEventListener('click', async () => {
        if(!currentEditId) return;
        const docSnap = await getDoc(doc(db, "notes", currentEditId));
        if(docSnap.exists()) {
            document.getElementById('editNoteInput').value = docSnap.data().text || "";
            document.getElementById('editModal').style.display = 'flex';
        }
        closeMenu();
    });

    // ৬. ট্র্যাশ ফাংশন (Move to Trash)
    document.getElementById('ctx-trash')?.addEventListener('click', () => {
        if(currentEditId && confirm("Move this note to Trash?")) {
            DBService.moveToTrashDB(currentEditId);
            showToast("🗑️ Moved to Trash", "error");
        }
        closeMenu();
    });

    // ৭. শেয়ার ফাংশন (Share Modal Open)
    document.getElementById('ctx-share')?.addEventListener('click', () => {
        document.getElementById('shareModal').style.display = 'flex';
        closeMenu();
    });

    // Update Note (Edit Save)
    document.getElementById('updateNoteBtn')?.addEventListener('click', async () => {
        if(currentEditId) {
            await DBService.updateNoteContentDB(currentEditId, document.getElementById('editNoteInput').value);
            document.getElementById('editModal').style.display = 'none';
            showToast("✅ Note updated!");
        }
    });

    // Share Modal Logic
    const handleShare = async (platform) => {
        const docSnap = await getDoc(doc(db, "notes", currentEditId));
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const text = data.text || "";
        let shareUrl = "";

        switch (platform) {
            case 'wa':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                break;
            case 'fb':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(text)}`;
                break;
            case 'tg':
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(text)}`;
                break;
            case 'copy':
                const cleanText = text.replace(/#\w+/g, '').replace(/\s\s+/g, ' ').trim();
                navigator.clipboard.writeText(cleanText);
                showToast("📋 Copied to clipboard (without tags)!");
                document.getElementById('shareModal').style.display = 'none';
                return;
        }
        
        if (shareUrl) window.open(shareUrl, '_blank');
        document.getElementById('shareModal').style.display = 'none';
    };

    document.getElementById('share-wa')?.addEventListener('click', () => handleShare('wa'));
    document.getElementById('share-fb')?.addEventListener('click', () => handleShare('fb'));
    document.getElementById('share-tg')?.addEventListener('click', () => handleShare('tg'));
    document.getElementById('share-copy')?.addEventListener('click', () => handleShare('copy'));
    
    // বাইরে ক্লিক করলে মেনু বন্ধ হবে
    window.addEventListener('click', (e) => {
        if(contextMenu && contextMenu.style.display === 'block') {
            if (!contextMenu.contains(e.target) && !e.target.classList.contains('context-trigger')) {
                contextMenu.style.display = 'none';
            }
        }
        if (e.target === readModal) readModal.style.display = 'none';
        if (e.target === editModal) editModal.style.display = 'none';
        if (e.target === shareModal) shareModal.style.display = 'none';
    });

    // ক্লোজ বাটনস
    document.getElementById('closeReadModalBtn')?.addEventListener('click', () => readModal.style.display = 'none');
    document.querySelector('#editModal .close-modal')?.addEventListener('click', () => editModal.style.display = 'none');
    document.querySelector('#shareModal .close-modal')?.addEventListener('click', () => shareModal.style.display = 'none');
}
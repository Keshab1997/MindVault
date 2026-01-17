// js/dashboard-core/event-manager.js
import { loadNotes } from "./note-manager.js";
import { localDB } from "../core/db-local.js";

export function setupEventListeners(user) {
    // ১. ফিল্টার বাটন
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.folder-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            loadNotes(user.uid, btn.getAttribute('data-filter'));
        });
    });

    // ২. সার্চ বার (সাজেশন সহ)
    const searchInput = document.getElementById('searchInput');
    const suggestionsBox = document.getElementById('searchSuggestions');

    if(searchInput && suggestionsBox) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 1) {
                suggestionsBox.style.display = 'none';
                filterNotes(""); // সব নোট দেখাও
                return;
            }

            // ১. লোকাল ডিবি থেকে নোটগুলো নিন
            const allNotes = await localDB.getAllNotes();
            
            // ২. কুয়েরির সাথে ম্যাচ করে এমন সাজেশন ফিল্টার করুন
            const matches = allNotes.filter(n => 
                (n.text && n.text.toLowerCase().includes(query)) ||
                (n.title && n.title.toLowerCase().includes(query)) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
            ).slice(0, 6); // সর্বোচ্চ ৬টি সাজেশন দেখাবে

            // ৩. সাজেশন রেন্ডার করুন
            if (matches.length > 0) {
                suggestionsBox.innerHTML = matches.map(n => {
                    const title = n.title || n.text.substring(0, 30) + "...";
                    const icon = n.type === 'image' ? '📷' : n.type === 'link' ? '🔗' : '📝';
                    return `
                        <div class="suggestion-item" data-value="${title}">
                            <span class="type-icon">${icon}</span>
                            <span class="text-truncate">${title}</span>
                        </div>
                    `;
                }).join('');
                suggestionsBox.style.display = 'block';
            } else {
                suggestionsBox.style.display = 'none';
            }

            // ৪. মেইন গ্রিড ফিল্টার করুন
            filterNotes(query);
        });

        // সাজেশনে ক্লিক করলে সার্চ বক্সে সেট হবে
        suggestionsBox.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                const val = item.getAttribute('data-value');
                searchInput.value = val;
                suggestionsBox.style.display = 'none';
                filterNotes(val.toLowerCase());
            }
        });

        // বাইরে ক্লিক করলে সাজেশন বক্স বন্ধ হবে
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });
    }

    // ৩. ভিউ টগল
    const gBtn = document.getElementById('gridViewBtn');
    const lBtn = document.getElementById('listViewBtn');
    const grid = document.getElementById('content-grid');
    
    if(gBtn && lBtn) {
        gBtn.onclick = () => { grid.classList.remove('list-view'); gBtn.classList.add('active'); lBtn.classList.remove('active'); };
        lBtn.onclick = () => { grid.classList.add('list-view'); lBtn.classList.add('active'); gBtn.classList.remove('active'); };
    }
}

// নোট ফিল্টার করার কমন ফাংশন
function filterNotes(query) {
    document.querySelectorAll('.note-card').forEach(card => {
        const isMatch = card.innerText.toLowerCase().includes(query);
        card.style.display = isMatch ? 'inline-block' : 'none';
    });
}
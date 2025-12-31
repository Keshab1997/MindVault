// js/search.js - Fixed Version

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const contentGrid = document.getElementById('content-grid');

    // যদি পেজে এই এলিমেন্টগুলো না থাকে তবে স্ক্রিপ্ট চালাবে না (Error Protection)
    if (!searchInput || !contentGrid) return;

    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.trim().toLowerCase();
        // ড্যাশবোর্ডের জেনারেট করা .card বা .brain-card ক্লাসগুলো খুঁজবে
        const cards = contentGrid.querySelectorAll('.brain-card, .card');

        cards.forEach(card => {
            // ১. রিসেট
            removeHighlights(card);

            if (searchText === "") {
                card.style.display = "";
                return;
            }

            // ২. কার্ডের কন্টেন্ট চেক
            const cardContent = card.textContent.toLowerCase();

            if (cardContent.includes(searchText)) {
                card.style.display = ""; 
                
                // ৩. হাইলাইট (যে ক্লাসগুলো dashboard.js এ দেওয়া হয়েছে)
                const textElements = card.querySelectorAll('.note-text, .preview-title, .preview-desc, .preview-site');
                
                textElements.forEach(element => {
                    highlightText(element, searchText);
                });

            } else {
                card.style.display = "none";
            }
        });

        checkEmptyResult(cards);
    });
});

function highlightText(element, text) {
    if (!element) return; // সেফটি চেক
    const innerHTML = element.innerHTML;
    const lowerHTML = innerHTML.toLowerCase();
    
    if (lowerHTML.includes(text)) {
        const regex = new RegExp(`(${text})`, 'gi');
        element.innerHTML = innerHTML.replace(regex, '<mark class="highlight">$1</mark>');
    }
}

function removeHighlights(card) {
    const highlights = card.querySelectorAll('mark.highlight');
    highlights.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize(); 
        }
    });
}

function checkEmptyResult(cards) {
    let hasVisibleCard = false;
    cards.forEach(card => {
        if (card.style.display !== "none") hasVisibleCard = true;
    });

    const existingMsg = document.getElementById('no-result-msg');
    if (existingMsg) existingMsg.remove();

    if (!hasVisibleCard) {
        const grid = document.getElementById('content-grid');
        const msg = document.createElement('p');
        msg.id = 'no-result-msg';
        msg.innerHTML = "No matches found. Try a different keyword. 🧐";
        msg.style.textAlign = "center";
        msg.style.color = "#888";
        msg.style.gridColumn = "1 / -1";
        msg.style.marginTop = "20px";
        grid.appendChild(msg);
    }
}
// js/menu-manager.js
// মোবাইল হ্যামবার্গার মেনু ওপেন/ক্লোজ লজিক

document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('navLinks');

    if (menuBtn && navLinks) {
        // ১. বাটনে ক্লিক করলে মেনু টগল হবে
        menuBtn.addEventListener('click', (e) => {
            navLinks.classList.toggle('active');
            
            // আইকন পরিবর্তন (☰ <-> ✕)
            if (navLinks.classList.contains('active')) {
                menuBtn.innerHTML = '✕'; // ক্লোজ আইকন
                menuBtn.style.color = 'red'; // ক্লোজ অবস্থায় লাল রঙ (অপশনাল)
            } else {
                menuBtn.innerHTML = '☰'; // মেনু আইকন
                menuBtn.style.color = ''; // আগের রঙে ফেরত
            }
            
            e.stopPropagation(); // ক্লিক বাবলিং বন্ধ রাখা
        });

        // ২. স্ক্রিনের অন্য কোথাও ক্লিক করলে মেনু বন্ধ হবে
        document.addEventListener('click', (e) => {
            // যদি ক্লিক মেনু বাটন বা মেনুর ভেতরে না হয়
            if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    menuBtn.innerHTML = '☰';
                    menuBtn.style.color = '';
                }
            }
        });
        
        // ৩. কোনো লিংকে ক্লিক করলে মেনু অটো বন্ধ হয়ে যাবে
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuBtn.innerHTML = '☰';
                menuBtn.style.color = '';
            });
        });
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const body = document.body;

    // ১. আগের সেভ করা মোড চেক করা
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        body.classList.add('dark-mode');
        themeToggleBtn.textContent = '☀️'; // আইকন চেঞ্জ
    }

    // ২. বাটনে ক্লিক করলে টগল হবে
    themeToggleBtn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        
        let theme = 'light';
        if (body.classList.contains('dark-mode')) {
            theme = 'dark';
            themeToggleBtn.textContent = '☀️';
        } else {
            themeToggleBtn.textContent = '🌙';
        }
        
        // ৩. লোকালে স্টোর করা
        localStorage.setItem('theme', theme);
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const gridBtn = document.getElementById('gridViewBtn'); // বাটনগুলোর ID চেক করো HTML এ
    const listBtn = document.getElementById('listViewBtn');
    const contentGrid = document.getElementById('content-grid');
    
    // যদি বাটন না থাকে তবে এরর আটকানোর জন্য চেক
    if (!gridBtn || !listBtn || !contentGrid) return;

    // ১. গ্রিড ভিউ বাটন ক্লিক
    gridBtn.addEventListener('click', () => {
        contentGrid.classList.remove('list-view'); // লিস্ট ক্লাস সরিয়ে দাও
        gridBtn.classList.add('active'); // গ্রিড বাটন একটিভ করো
        listBtn.classList.remove('active');
    });

    // ২. লিস্ট ভিউ বাটন ক্লিক
    listBtn.addEventListener('click', () => {
        contentGrid.classList.add('list-view'); // লিস্ট ক্লাস যোগ করো
        listBtn.classList.add('active'); // লিস্ট বাটন একটিভ করো
        gridBtn.classList.remove('active');
    });
});
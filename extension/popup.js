document.getElementById('saveBtn').addEventListener('click', async () => {
    // ১. ব্রাউজারের বর্তমান ট্যাবের লিংক এবং টাইটেল নেওয়া
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // ২. আপনার ড্যাশবোর্ডের ঠিকানা (লাইভ হলে লাইভ লিংক দেবেন)
    // বর্তমানে আপনার লোকাল সার্ভার লিংক দিচ্ছি:
    const myBrainUrl = "http://127.0.0.1:5500/dashboard.html"; 
    
    // ৩. লিংকটি এনকোড করা যাতে URL এ পাঠানো যায়
    const linkToSave = encodeURIComponent(tab.url);
    
    // ৪. নতুন ট্যাবে MyBrain ওপেন করা প্যারামিটার সহ
    // উদাহরণ: dashboard.html?text=https://google.com
    chrome.tabs.create({ 
        url: `${myBrainUrl}?text=${linkToSave}` 
    });
});
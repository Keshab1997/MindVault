document.getElementById('saveBtn').addEventListener('click', async () => {
    // ১. ব্রাউজারের বর্তমান ট্যাবের লিংক নেওয়া
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // ২. আপনার লাইভ ওয়েবসাইটের ড্যাশবোর্ড লিংক [UPDATED]
    const myBrainUrl = "https://my-brain-three.vercel.app/dashboard.html"; 
    
    // ৩. লিংকটি এনকোড করা
    const linkToSave = encodeURIComponent(tab.url);
    
    // ৪. নতুন ট্যাবে ওপেন করা
    chrome.tabs.create({ 
        url: `${myBrainUrl}?text=${linkToSave}` 
    });
});
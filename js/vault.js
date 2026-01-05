// ১. কনফিগারেশন ইমপোর্ট (firebase-config.js থেকে)
import { db, auth } from './firebase-config.js';

// ২. ফায়ারবেস ফাংশন ইমপোর্ট
import { 
    collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// DOM Elements
const siteInput = document.getElementById('siteName');
const userInput = document.getElementById('username');
const passInput = document.getElementById('password');
const saveBtn = document.getElementById('saveSecretBtn');
const vaultGrid = document.getElementById('vault-grid');
const togglePassBtn = document.getElementById('togglePass');
const statusMsg = document.getElementById('vaultStatus');
const csvInput = document.getElementById('csvInput'); 
const exportBtn = document.getElementById('exportBtn'); 

// [FIXED] HTML অনুযায়ী সঠিক ID ব্যবহার করা হয়েছে
const logoutBtn = document.getElementById('menu-logout-btn'); 

// [FIXED] HTML এ তোমার ID ছিল 'vaultSearchInput'
const searchInput = document.getElementById('vaultSearchInput');

let currentUser = null;
let allSecrets = [];

// ৩. অথেনটিকেশন চেক
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Vault User:", user.email);
        loadSecrets(user.uid);
        
        // মিনি প্রোফাইল আপডেট (Navbar)
        const navUserName = document.getElementById('nav-user-name');
        const navUserImg = document.getElementById('nav-user-img');
        const navProfileDiv = document.getElementById('nav-mini-profile');

        if(navProfileDiv) navProfileDiv.style.display = 'flex';
        if(navUserName) navUserName.textContent = user.displayName || user.email.split('@')[0];
        if(navUserImg && user.photoURL) navUserImg.src = user.photoURL;

    } else {
        window.location.href = "index.html";
    }
});

// --- ৪. সার্চ লজিক (FIXED) ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        // কার্ডগুলো সিলেক্ট করা
        const cards = document.querySelectorAll('.secret-card');

        cards.forEach(card => {
            // কার্ডের ভেতরের সাইট নেম এবং ইউজারনেম চেক করা
            const siteNameEl = card.querySelector('.secret-header span');
            const userNameEl = card.querySelector('.secret-username');
            
            const siteName = siteNameEl ? siteNameEl.innerText.toLowerCase() : "";
            const userName = userNameEl ? userNameEl.innerText.toLowerCase() : "";

            // যদি সাইট নেম অথবা ইউজারনেম এর সাথে সার্চ টেক্সট মিলে যায়
            if (siteName.includes(searchText) || userName.includes(searchText)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
} else {
    console.error("Search Input (vaultSearchInput) not found in HTML");
}

// ৫. পাসওয়ার্ড সেভ লজিক
if(saveBtn) {
    saveBtn.addEventListener('click', async () => {
        await saveSingleSecret(siteInput.value, userInput.value, passInput.value);
        
        siteInput.value = ""; 
        userInput.value = ""; 
        passInput.value = "";
    });
}

// সিঙ্গেল পাসওয়ার্ড সেভ করার ফাংশন
async function saveSingleSecret(site, username, password) {
    if (!site || !password) {
        alert("Site name and Password are required!");
        return;
    }

    try {
        if(statusMsg) {
            statusMsg.style.display = "block";
            statusMsg.style.color = "blue";
            statusMsg.textContent = "Encrypting & Saving...";
        }
        
        // এনক্রিপশন
        const encryptedPassword = CryptoJS.AES.encrypt(password, currentUser.uid).toString();

        await addDoc(collection(db, "vault"), {
            userId: currentUser.uid,
            site: site,
            username: username || "",
            password: encryptedPassword,
            createdAt: serverTimestamp()
        });

        if(statusMsg) {
            statusMsg.style.color = "green";
            statusMsg.textContent = "Saved Securely!";
            setTimeout(() => statusMsg.style.display = 'none', 1500);
        }

    } catch (error) {
        console.error("Error saving:", error);
        if(statusMsg) {
            statusMsg.style.color = "red";
            statusMsg.textContent = "Error: " + error.message;
        }
    }
}

// ৬. Bitwarden CSV Import Logic
if(csvInput) {
    csvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if(!confirm(`Import passwords from ${file.name}?`)) return;

        if(statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.textContent = "Reading CSV...";
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                const rows = results.data;
                let count = 0;
                
                if(statusMsg) statusMsg.textContent = `Importing ${rows.length} items...`;

                for (let row of rows) {
                    const site = row.name || row.login_uri || row.Title || "Unknown Site";
                    const username = row.login_username || row.Username || "";
                    const password = row.login_password || row.Password;

                    if (password) {
                        await saveSingleSecret(site, username, password);
                        count++;
                    }
                }
                alert(`Success! Imported ${count} passwords.`);
                if(statusMsg) statusMsg.style.display = 'none';
                csvInput.value = ""; 
            },
            error: function(err) {
                alert("CSV Error: " + err.message);
            }
        });
    });
}

// ৭. Export All Function
if(exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (allSecrets.length === 0) {
            alert("Vault is empty!");
            return;
        }

        if(!confirm("Warning: Exporting will download DECRYPTED passwords. Continue?")) return;

        const csvData = allSecrets.map(secret => {
            let realPass = "";
            try {
                const bytes = CryptoJS.AES.decrypt(secret.password, currentUser.uid);
                realPass = bytes.toString(CryptoJS.enc.Utf8);
            } catch(e) { realPass = "Error"; }

            return {
                Title: secret.site,
                Username: secret.username,
                Password: realPass,
                URL: secret.site
            };
        });

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "mybrain_vault_backup.csv";
        link.click();
    });
}

// ৮. ডাটা লোড করা এবং দেখানো
function loadSecrets(userId) {
    const q = query(
        collection(db, "vault"), 
        where("userId", "==", userId), 
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        if(!vaultGrid) return;
        
        vaultGrid.innerHTML = "";
        allSecrets = [];

        if (snapshot.empty) {
            vaultGrid.innerHTML = '<p style="text-align:center; color:#888; width:100%;">No passwords saved yet.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allSecrets.push(data);
            
            const card = document.createElement('div');
            card.className = 'secret-card'; // সার্চের জন্য এই ক্লাস জরুরি
            
            const hasUser = data.username && data.username.trim() !== "";

            card.innerHTML = `
                <div class="secret-header">
                    <span style="font-weight:bold; color:#333;">${data.site}</span>
                    <button class="delete-btn" onclick="deleteSecret('${docSnap.id}')" title="Delete">🗑️</button>
                </div>
                
                <div class="secret-user-row">
                    <span class="secret-username" title="${data.username}">${hasUser ? data.username : 'No User'}</span>
                    ${hasUser ? `<button class="copy-user-btn" onclick="copyUsername('${data.username}')" title="Copy Username">📋</button>` : ''}
                </div>
                
                <div class="secret-pass-area">
                    <span id="pass-text-${docSnap.id}" class="pass-dots">••••••••</span>
                    <div class="card-actions">
                        <button onclick="revealPass('${docSnap.id}', '${data.password}')" title="Show">👁️</button>
                        <button onclick="copyPass('${docSnap.id}', '${data.password}')" title="Copy Password">📋</button>
                    </div>
                </div>
            `;
            vaultGrid.appendChild(card);
        });
    }, (error) => {
        console.error("Snapshot Error:", error);
    });
}

// ৯. গ্লোবাল ফাংশন সমূহ
window.copyUsername = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        // Optional toast
    }).catch(err => console.error('Failed to copy: ', err));
};

window.revealPass = (id, encryptedPass) => {
    const passField = document.getElementById(`pass-text-${id}`);
    if (passField.textContent !== "••••••••") {
        passField.textContent = "••••••••";
        return;
    }
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedPass, currentUser.uid);
        const original = bytes.toString(CryptoJS.enc.Utf8);
        passField.textContent = original || "Error";
    } catch (e) { alert("Decrypt Error"); }
};

window.copyPass = (id, encryptedPass) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedPass, currentUser.uid);
        const original = bytes.toString(CryptoJS.enc.Utf8);
        navigator.clipboard.writeText(original);
        alert("Password Copied!");
    } catch (e) { alert("Copy Failed"); }
};

window.deleteSecret = async (id) => {
    if(confirm("Are you sure you want to delete this?")) {
        try {
            await deleteDoc(doc(db, "vault", id));
        } catch (error) {
            console.error("Delete Error", error);
        }
    }
};

// পাসওয়ার্ড ইনপুট টগল
if(togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
        passInput.type = passInput.type === "password" ? "text" : "password";
    });
}

// ১০. লগআউট (FIXED)
if(logoutBtn){
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            console.log("Logged out");
            window.location.href = "index.html";
        }).catch((err) => {
            console.error("Logout Error:", err);
        });
    });
} else {
    console.warn("Logout button (menu-logout-btn) not found in DOM");
}
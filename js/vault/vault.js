// js/vault/vault.js (SECURE VERSION)

import { db, auth } from '../core/firebase-config.js';
import { collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from '../ui-shared.js';

const siteInput = document.getElementById('siteName');
const userInput = document.getElementById('username');
const passInput = document.getElementById('password');
const saveBtn = document.getElementById('saveSecretBtn');
const vaultGrid = document.getElementById('vault-grid');
const togglePassBtn = document.getElementById('togglePass');
const statusMsg = document.getElementById('vaultStatus');
const csvInput = document.getElementById('csvInput'); 
const exportBtn = document.getElementById('exportBtn'); 
const logoutBtn = document.getElementById('menu-logout-btn'); 
const searchInput = document.getElementById('vaultSearchInput');

let currentUser = null;
let allSecrets = [];
let masterKey = null;
let inactivityTimer;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        sessionStorage.removeItem('vault_master_key');
        masterKey = null;
        showToast("🔒 Vault locked due to inactivity.", "error");
        setTimeout(() => window.location.reload(), 1500);
    }, 5 * 60 * 1000);
}

function requestMasterPassword() {
    let storedKey = sessionStorage.getItem('vault_master_key');
    if (storedKey) {
        masterKey = storedKey;
        return true;
    }

    const input = prompt("🔐 Enter your Vault Master Password:", "");
    if (input && input.trim().length >= 4) {
        masterKey = input.trim();
        sessionStorage.setItem('vault_master_key', masterKey);
        return true;
    } else {
        showToast("⚠️ Master Password required!", "error");
        setTimeout(() => window.location.href = "dashboard.html", 1500);
        return false;
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        
        if (requestMasterPassword()) {
            loadSecrets(user.uid);
            resetInactivityTimer();
            document.addEventListener('mousemove', resetInactivityTimer);
            document.addEventListener('keypress', resetInactivityTimer);
            document.addEventListener('click', resetInactivityTimer);
        }

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

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        document.querySelectorAll('.secret-card').forEach(card => {
            const siteName = card.querySelector('.secret-header span')?.innerText.toLowerCase() || "";
            const userName = card.querySelector('.secret-username')?.innerText.toLowerCase() || "";
            card.style.display = (siteName.includes(searchText) || userName.includes(searchText)) ? 'block' : 'none';
        });
    });
}

if(saveBtn) {
    saveBtn.addEventListener('click', async () => {
        await saveSingleSecret(siteInput.value, userInput.value, passInput.value);
        siteInput.value = ""; userInput.value = ""; passInput.value = "";
    });
}

async function saveSingleSecret(site, username, password) {
    if (!site || !password) { showToast("⚠️ Site name and Password are required!", "error"); return; }
    if (!masterKey) { showToast("🔒 Vault is locked! Refresh page.", "error"); return; }

    try {
        if(statusMsg) { statusMsg.style.display = "block"; statusMsg.style.color = "blue"; statusMsg.textContent = "Encrypting & Saving..."; }
        
        const encryptionKey = currentUser.uid + masterKey;
        const encryptedPassword = CryptoJS.AES.encrypt(password, encryptionKey).toString();

        await addDoc(collection(db, "vault"), { 
            userId: currentUser.uid, 
            site: site, 
            username: username || "", 
            password: encryptedPassword, 
            createdAt: serverTimestamp() 
        });

        if(statusMsg) { statusMsg.style.color = "green"; statusMsg.textContent = "Saved Securely!"; setTimeout(() => statusMsg.style.display = 'none', 1500); }
        showToast("✅ Password saved securely!", "success");
    } catch (error) { 
        console.error("Error saving:", error); 
        if(statusMsg) { statusMsg.style.color = "red"; statusMsg.textContent = "Error: " + error.message; }
        showToast("❌ Error: " + error.message, "error");
    }
}

if(csvInput) {
    csvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !confirm(`Import passwords from ${file.name}?`)) return;
        if (!masterKey) { showToast("🔒 Vault is locked!", "error"); return; }

        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async function(results) {
                const rows = results.data;
                let count = 0;
                if(statusMsg) statusMsg.textContent = `Importing ${rows.length} items...`;
                for (let row of rows) {
                    const site = row.name || row.login_uri || row.Title || "Unknown Site";
                    const username = row.login_username || row.Username || "";
                    const password = row.login_password || row.Password;
                    if (password) { await saveSingleSecret(site, username, password); count++; }
                }
                showToast(`✅ Imported ${count} passwords successfully!`, "success");
                if(statusMsg) statusMsg.style.display = 'none';
                csvInput.value = ""; 
            },
            error: function(err) { showToast("❌ CSV Error: " + err.message, "error"); }
        });
    });
}

if(exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (allSecrets.length === 0) { showToast("⚠️ Vault is empty!", "error"); return; }
        if (!masterKey) { showToast("🔒 Vault is locked!", "error"); return; }
        if(!confirm("Warning: Exporting will download DECRYPTED passwords. Continue?")) return;

        const csvData = allSecrets.map(secret => {
            let realPass = "";
            try { 
                const encryptionKey = currentUser.uid + masterKey;
                realPass = CryptoJS.AES.decrypt(secret.password, encryptionKey).toString(CryptoJS.enc.Utf8); 
                if(!realPass) realPass = "Wrong Master Key";
            } catch(e) { realPass = "Error"; }
            return { Title: secret.site, Username: secret.username, Password: realPass, URL: secret.site };
        });

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = "mybrain_vault_backup.csv"; link.click();
        showToast("✅ Vault exported successfully!", "success");
    });
}

function loadSecrets(userId) {
    const q = query(collection(db, "vault"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        if(!vaultGrid) return;
        vaultGrid.innerHTML = ""; allSecrets = [];
        if (snapshot.empty) { vaultGrid.innerHTML = '<p style="text-align:center; color:#888; width:100%;">No passwords saved yet.</p>'; return; }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allSecrets.push(data);
            const card = document.createElement('div');
            card.className = 'secret-card'; 
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
                </div>`;
            vaultGrid.appendChild(card);
        });
    });
}

window.copyUsername = (text) => { 
    navigator.clipboard.writeText(text); 
    showToast("✅ Username copied!", "success"); 
};

window.revealPass = (id, encryptedPass) => {
    const passField = document.getElementById(`pass-text-${id}`);
    if (passField.textContent !== "••••••••") { passField.textContent = "••••••••"; return; }
    if (!masterKey) { requestMasterPassword(); return; }

    try { 
        const encryptionKey = currentUser.uid + masterKey;
        const decrypted = CryptoJS.AES.decrypt(encryptedPass, encryptionKey).toString(CryptoJS.enc.Utf8);
        
        if(decrypted) {
            passField.textContent = decrypted;
        } else {
            showToast("❌ Wrong Master Password!", "error");
        }
    } catch (e) { showToast("❌ Decrypt Error", "error"); }
};

window.copyPass = (id, encryptedPass) => {
    if (!masterKey) { requestMasterPassword(); return; }
    try { 
        const encryptionKey = currentUser.uid + masterKey;
        const decrypted = CryptoJS.AES.decrypt(encryptedPass, encryptionKey).toString(CryptoJS.enc.Utf8);
        if(decrypted) {
            navigator.clipboard.writeText(decrypted); 
            showToast("✅ Password copied!", "success"); 
        } else {
            showToast("❌ Wrong Master Password!", "error");
        }
    } catch (e) { showToast("❌ Copy Failed", "error"); }
};

window.deleteSecret = async (id) => { 
    if(confirm("Are you sure?")) {
        await deleteDoc(doc(db, "vault", id));
        showToast("✅ Password deleted!", "success");
    }
};

if(togglePassBtn) togglePassBtn.addEventListener('click', () => passInput.type = passInput.type === "password" ? "text" : "password");
if(logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); signOut(auth).then(() => window.location.href = "index.html"); });

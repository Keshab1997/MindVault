// FILE: js/core/db-local.js
export const localDB = {
    dbName: "MindVaultLocal",
    version: 1,

    async open() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("notes")) db.createObjectStore("notes", { keyPath: "id" });
            };
            request.onsuccess = (e) => resolve(e.target.result);
        });
    },

    async saveNotes(notes) {
        const db = await this.open();
        const tx = db.transaction("notes", "readwrite");
        const store = tx.objectStore("notes");
        store.clear(); // পুরনো ডেটা মুছে নতুন ডেটা রাখা
        notes.forEach(n => store.put(n));
    },

    async getAllNotes() {
        const db = await this.open();
        return new Promise((resolve) => {
            const tx = db.transaction("notes", "readonly");
            const store = tx.objectStore("notes");
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });
    }
};
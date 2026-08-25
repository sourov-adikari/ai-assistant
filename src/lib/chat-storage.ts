// @ts-nocheck
/* Chat storage: IndexedDB persistence with localStorage compatibility and fallback. */
(() => {
    "use strict";
    const DB_NAME = "sca-gemini-assistant";
    const DB_VERSION = 1;
    const MAX_SESSIONS = 100;
    const MAX_MESSAGES = 100;
    const MAX_TEXT_LENGTH = 20000;
    const state = window.__chatStorageState = window.__chatStorageState || { ready: false, available: false, error: null, migrated: false };
    let db = null;

    const readLocal = () => {
        try {
            const raw = localStorage.getItem("gemini_sessions");
            const data = raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data.slice(0, MAX_SESSIONS) : [];
        } catch (error) { console.warn("Chat local storage read failed:", error); return []; }
    };
    const writeLocal = (sessions) => {
        try { localStorage.setItem("gemini_sessions", JSON.stringify(sessions)); return true; }
        catch (error) { console.warn("Chat local storage write failed:", error); return false; }
    };
    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains("sessions")) database.createObjectStore("sessions", { keyPath: "id" });
                if (!database.objectStoreNames.contains("messages")) {
                    const store = database.createObjectStore("messages", { keyPath: "id" });
                    store.createIndex("sessionId", "sessionId", { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
            request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked"));
        });
    }
    function readDatabase(database) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = database.transaction(["sessions", "messages"], "readonly");
                const sessionRequest = transaction.objectStore("sessions").getAll();
                const messageRequest = transaction.objectStore("messages").getAll();
                transaction.oncomplete = () => {
                    const messagesBySession = {};
                    (messageRequest.result || []).forEach((message) => {
                        (messagesBySession[message.sessionId] || (messagesBySession[message.sessionId] = [])).push({ role: message.role === "model" ? "model" : "user", parts: [{ text: String(message.text || "").slice(0, MAX_TEXT_LENGTH) }] });
                    });
                    resolve((sessionRequest.result || []).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, MAX_SESSIONS).map((session) => ({
                        id: String(session.id), title: String(session.title || "New Chat").slice(0, 100), timestamp: Number(session.timestamp) || Date.now(), history: (messagesBySession[session.id] || []).slice(-MAX_MESSAGES)
                    })));
                };
                transaction.onerror = () => reject(transaction.error || new Error("IndexedDB read failed"));
                transaction.onabort = () => reject(transaction.error || new Error("IndexedDB read aborted"));
            } catch (error) { reject(error); }
        });
    }
    function syncFromLocal() {
        if (!db) return Promise.resolve(false);
        const sessions = readLocal();
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction(["sessions", "messages"], "readwrite");
                const sessionStore = transaction.objectStore("sessions");
                const messageStore = transaction.objectStore("messages");
                sessionStore.clear(); messageStore.clear();
                sessions.forEach((session) => {
                    const id = String(session.id);
                    sessionStore.put({ id, title: String(session.title || "New Chat").slice(0, 100), timestamp: Number(session.timestamp) || Date.now() });
                    (Array.isArray(session.history) ? session.history : []).slice(-MAX_MESSAGES).forEach((message, index) => {
                        const text = Array.isArray(message?.parts) ? message.parts.filter((part) => part && typeof part.text === "string").map((part) => part.text).join("\n").slice(0, MAX_TEXT_LENGTH) : "";
                        if (text) messageStore.put({ id: `${id}:${index}`, sessionId: id, role: message.role === "model" ? "model" : "user", text });
                    });
                });
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => { console.warn("IndexedDB chat sync failed:", transaction.error); resolve(false); };
                transaction.onabort = () => { console.warn("IndexedDB chat sync aborted:", transaction.error); resolve(false); };
            } catch (error) { console.warn("IndexedDB chat sync failed:", error); resolve(false); }
        });
    }
    async function boot() {
        try {
            db = await openDatabase(); window.__chatStorageDB = db; state.available = true;
            const stored = await readDatabase(db); const local = readLocal();
            if (stored.length && !local.length) { writeLocal(stored); state.migrated = true; }
            else if (local.length) await syncFromLocal();
        } catch (error) { state.error = error; console.warn("IndexedDB unavailable; localStorage fallback is active:", error); }
        finally { state.ready = true; }
        return state;
    }
    window.__syncChatStorage = syncFromLocal;
    window.__clearChatStorage = () => new Promise((resolve) => {
        if (!db) return resolve(false);
        try {
            const transaction = db.transaction(["sessions", "messages"], "readwrite");
            transaction.objectStore("sessions").clear(); transaction.objectStore("messages").clear();
            transaction.oncomplete = () => resolve(true); transaction.onerror = () => resolve(false); transaction.onabort = () => resolve(false);
        } catch (_) { resolve(false); }
    });
    window.__chatStorageReady = boot();
    window.setTimeout(() => {
        if (typeof window.saveSessions === "function") {
            const originalSave = window.saveSessions;
            if (!originalSave.__chatStorageWrapped) {
                const wrapped = function (...args) { const result = originalSave.apply(this, args); window.__syncChatStorage(); return result; };
                wrapped.__chatStorageWrapped = true; window.saveSessions = wrapped;
            }
        }
    }, 0);
    document.addEventListener("DOMContentLoaded", () => {
        if (state.error && typeof window.showNotification === "function") window.showNotification("Chat storage could not use IndexedDB. Local storage fallback is active.", "error");
    }, { once: true });
})();
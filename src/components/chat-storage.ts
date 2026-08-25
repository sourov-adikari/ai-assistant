/**
 * Durable browser storage for chat state.
 *
 * localStorage remains the synchronous compatibility layer because the
 * existing UI reads it synchronously. IndexedDB is the durable source of
 * backup data and is versioned so future schema migrations are explicit.
 */

(() => {
    const DB_NAME = "sca-ai-storage";
    const DB_VERSION = 2;
    const KV_STORE = "kv";
    const META_STORE = "meta";
    const SCHEMA_VERSION = 2;

    const SESSIONS_KEY = "gemini_sessions";
    const ACTIVE_KEY = "gemini_active_id";
    const LANG_KEY = "gemini_lang";
    const THEME_KEY = "gemini_theme";
    const trackedKeys = [SESSIONS_KEY, ACTIVE_KEY, LANG_KEY, THEME_KEY];

    type KV = { key: string; value: string };
    type Meta = { key: string; value: number };

    function openDb(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            if (!("indexedDB" in window)) {
                reject(new Error("IndexedDB is not supported"));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(KV_STORE)) {
                    db.createObjectStore(KV_STORE, { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains(META_STORE)) {
                    db.createObjectStore(META_STORE, { keyPath: "key" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
            request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked"));
        });
    }

    async function transaction(
        mode: IDBTransactionMode,
        work: (stores: { kv: IDBObjectStore; meta: IDBObjectStore }) => void,
    ): Promise<void> {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([KV_STORE, META_STORE], mode);
            work({ kv: tx.objectStore(KV_STORE), meta: tx.objectStore(META_STORE) });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
            tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
        });
        db.close();
    }

    async function put(key: string, value: string): Promise<void> {
        await transaction("readwrite", ({ kv }) => kv.put({ key, value } satisfies KV));
    }

    async function remove(key: string): Promise<void> {
        await transaction("readwrite", ({ kv }) => kv.delete(key));
    }

    async function get(key: string): Promise<string | null> {
        const db = await openDb();
        const value = await new Promise<string | null>((resolve, reject) => {
            const tx = db.transaction(KV_STORE, "readonly");
            const request = tx.objectStore(KV_STORE).get(key);
            request.onsuccess = () => resolve((request.result as KV | undefined)?.value ?? null);
            request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
        });
        db.close();
        return value;
    }

    async function migrateSchema(): Promise<void> {
        try {
            await transaction("readwrite", ({ meta }) => {
                meta.put({ key: "schemaVersion", value: SCHEMA_VERSION } satisfies Meta);
            });
        } catch (error) {
            console.warn("IndexedDB schema migration skipped:", error);
        }
    }

    async function backup(key: string): Promise<void> {
        try {
            const value = localStorage.getItem(key);
            if (value !== null) await put(key, value);
        } catch (error) {
            console.warn("IndexedDB backup skipped:", error);
        }
    }

    async function restoreIfMissing(key: string): Promise<void> {
        try {
            if (localStorage.getItem(key) !== null) return;
            const value = await get(key);
            if (value !== null) localStorage.setItem(key, value);
        } catch (error) {
            console.warn("IndexedDB restore skipped:", error);
        }
    }

    // Never make startup depend on IndexedDB. It is intentionally fire-and-forget.
    void migrateSchema();
    trackedKeys.forEach((key) => void backup(key));
    trackedKeys.forEach((key) => void restoreIfMissing(key));

    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    const originalClear = Storage.prototype.clear;

    Storage.prototype.setItem = function (key: string, value: string): void {
        originalSetItem.call(this, key, value);
        if (this === window.localStorage && trackedKeys.includes(key)) {
            void put(key, value).catch(() => undefined);
        }
    };

    Storage.prototype.removeItem = function (key: string): void {
        originalRemoveItem.call(this, key);
        if (this === window.localStorage && trackedKeys.includes(key)) {
            void remove(key).catch(() => undefined);
        }
    };

    Storage.prototype.clear = function (): void {
        originalClear.call(this);
        if (this === window.localStorage) {
            trackedKeys.forEach((key) => void remove(key).catch(() => undefined));
        }
    };
})();

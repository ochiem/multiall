/* IndexedDB-backed localStorage shim
 * - Transparently persists localStorage reads/writes to IndexedDB
 * - Uses an in-memory cache for synchronous reads
 * - One-way migration from native localStorage at init (no mirroring after)
 */
(function () {
  if (typeof window === 'undefined' || !('indexedDB' in window) || !window.localStorage) {
    return; // Environment not supported; do nothing.
  }

  const storage = window.localStorage;
  const native = {
    getItem: storage.getItem.bind(storage),
    // We will NOT call set/remove/clear on native after migration (one-way)
    key: storage.key ? storage.key.bind(storage) : undefined,
    length: () => storage.length
  };
  // Accessors to call original native removal/clear for cleanup only
  const StorageProto = Object.getPrototypeOf(storage) || window.Storage && window.Storage.prototype;
  const nativeRemove = StorageProto && StorageProto.removeItem ? StorageProto.removeItem.bind(storage) : null;
  const nativeClear = StorageProto && StorageProto.clear ? StorageProto.clear.bind(storage) : null;

  const root = window;
  const appCfg = (root.CONFIG_APP && root.CONFIG_APP.APP) ? root.CONFIG_APP.APP : {};
  const dbCfg = root.CONFIG_DB || {};
  const DB_NAME = dbCfg.NAME || appCfg.NAME || 'MULTIALL-PLUS';
  const STORE_NAME = (dbCfg.STORES && dbCfg.STORES.LOCALSTORAGE) ? dbCfg.STORES.LOCALSTORAGE : 'LOCALSTORAGE_STORE';
  let db = null;
  const cache = new Map();
  let readyResolve;
  const ready = new Promise((res) => (readyResolve = res));
  const nativeKeysAtInit = [];

  function openDB() {
    return new Promise((resolve, reject) => {
      try{
        // Open without explicit version to avoid VersionError when DB already upgraded
        const req = indexedDB.open(DB_NAME);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(STORE_NAME)) {
            d.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(STORE_NAME)){
            const next = (d.version || 1) + 1;
            d.close();
            const up = indexedDB.open(DB_NAME, next);
            up.onupgradeneeded = () => {
              const udb = up.result;
              if (!udb.objectStoreNames.contains(STORE_NAME)) udb.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
            up.onsuccess = () => resolve(up.result);
            up.onerror = () => reject(up.error);
          } else {
            resolve(d);
          }
        };
        req.onerror = () => reject(req.error);
      }catch(e){ reject(e); }
    });
  }

  function tx(storeName, mode) {
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  }

  function idbSet(key, value) {
    if (!db) return;
    try {
      tx(STORE_NAME, 'readwrite').put({ key, value });
    } catch (_) {}
  }

  function idbRemove(key) {
    if (!db) return;
    try {
      tx(STORE_NAME, 'readwrite').delete(key);
    } catch (_) {}
  }

  function idbClear() {
    if (!db) return;
    try {
      tx(STORE_NAME, 'readwrite').clear();
    } catch (_) {}
  }

  function idbLoadAll() {
    return new Promise((resolve) => {
      try {
        const store = tx(STORE_NAME, 'readonly');
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const { key, value } = cursor.value || {};
            if (typeof key === 'string') cache.set(key, String(value));
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  function migrateFromNative() {
    // Copy any existing native localStorage keys into IDB if not present in cache
    try {
      const len = native.length();
      for (let i = 0; i < len; i++) {
        const key = storage.key(i);
        if (key && !cache.has(key)) {
          const v = native.getItem(key);
          if (v !== null) {
            const sv = String(v);
            cache.set(key, sv);
            idbSet(key, sv);
          }
        }
        if (key) nativeKeysAtInit.push(key);
      }
    } catch (_) {}
  }

  function clearNativeMigratedKeys() {
    // Safely remove only keys that were present at init and are now in cache (migrated)
    if (!nativeRemove) return;
    try {
      for (const k of nativeKeysAtInit) {
        if (cache.has(k)) {
          try { nativeRemove(k); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  (async function init() {
    try {
      db = await openDB();
      await idbLoadAll();
      // One-time migrate from native localStorage to IDB (one-way)
      migrateFromNative();
      // After successful migration, clean up native keys to enforce single source of truth
      clearNativeMigratedKeys();
    } catch (_) {
      // If IDB fails, we keep native behavior only.
    } finally {
      readyResolve();
    }
  })();

  // Override methods to use cache + IDB only (no mirroring back to native)
  storage.setItem = function (key, value) {
    const sv = String(value);
    cache.set(key, sv);
    idbSet(key, sv);
  };

  storage.getItem = function (key) {
    if (cache.has(key)) return cache.get(key);
    // After init+migration completes, we only trust IDB cache; return null if not present
    return null;
  };

  storage.removeItem = function (key) {
    cache.delete(key);
    idbRemove(key);
  };

  storage.clear = function () {
    cache.clear();
    idbClear();
  };

  // Expose a readiness promise in case app code wants to await it
  window.__IDB_LOCALSTORAGE_READY__ = ready;
})();

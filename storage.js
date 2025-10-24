    // IndexedDB-based storage with in-memory cache.
    // Uses a single application database defined in CONFIG_APP / CONFIG_DB.
    (function initIndexedDBStorage(){
        const root = (typeof window !== 'undefined') ? window : {};
        const appCfg = (root.CONFIG_APP && root.CONFIG_APP.APP) ? root.CONFIG_APP.APP : {};
        const dbCfg = root.CONFIG_DB || {};
        const DB_NAME = dbCfg.NAME || appCfg.NAME || 'MULTIALL-PLUS';
        const STORE_KV = (dbCfg.STORES && dbCfg.STORES.KV) ? dbCfg.STORES.KV : 'APP_KV_STORE';
        const STORE_SNAPSHOT = (dbCfg.STORES && dbCfg.STORES.SNAPSHOT) ? dbCfg.STORES.SNAPSHOT : null;
        const STORE_LOCALSTORAGE = (dbCfg.STORES && dbCfg.STORES.LOCALSTORAGE) ? dbCfg.STORES.LOCALSTORAGE : null;
        const BC_NAME = dbCfg.BROADCAST_CHANNEL || `${DB_NAME}_CHANNEL`;
        const requiredStores = Array.from(new Set(
            [STORE_KV, STORE_SNAPSHOT, STORE_LOCALSTORAGE].filter(Boolean)
        ));
        const cache = {}; // runtime cache for sync reads
        let db = null;

        function openDB(){
            return new Promise((resolve, reject)=>{
                if (db) return resolve(db);
                try{
                    // Open without explicit version to avoid VersionError when DB was upgraded elsewhere
                    const req = indexedDB.open(DB_NAME);
                    req.onupgradeneeded = (ev)=>{
                        const d = ev.target.result;
                        requiredStores.forEach(storeName=>{
                            if (!d.objectStoreNames.contains(storeName)) {
                                d.createObjectStore(storeName, { keyPath:'key' });
                            }
                        });
                    };
                    req.onsuccess = (ev)=>{
                        const d = ev.target.result;
                        const missing = requiredStores.filter(storeName => !d.objectStoreNames.contains(storeName));
                        if (missing.length){
                            const nextVersion = (d.version || 1) + 1;
                            try { d.close(); } catch(_){}
                            const up = indexedDB.open(DB_NAME, nextVersion);
                            up.onupgradeneeded = (e2)=>{
                                const udb = e2.target.result;
                                requiredStores.forEach(storeName=>{
                                    if (!udb.objectStoreNames.contains(storeName)) {
                                        udb.createObjectStore(storeName, { keyPath:'key' });
                                    }
                                });
                            };
                            up.onsuccess = (e2)=>{
                                db = e2.target.result;
                                resolve(db);
                            };
                            up.onerror = (e2)=>{ reject(e2.target.error || new Error('IDB upgrade failed')); };
                            up.onblocked = ()=>{ reject(new Error('IDB upgrade blocked')); };
                        } else {
                            db = d; resolve(db);
                        }
                    };
                    req.onerror = (ev)=>{ reject(ev.target.error || new Error('IDB open failed')); };
                    req.onblocked = ()=>{ reject(new Error('IDB open blocked')); };
                } catch(e){ reject(e); }
            });
        }

        async function idbGetAll(){
            await openDB();
            return new Promise((resolve)=>{
                const out = [];
                try{
                    const tx = db.transaction([STORE_KV], 'readonly');
                    const st = tx.objectStore(STORE_KV);
                    const req = st.openCursor();
                    req.onsuccess = function(e){
                        const cursor = e.target.result;
                        if (cursor) {
                            try { out.push({ key: cursor.key, val: cursor.value?.val }); } catch(_){}
                            cursor.continue();
                        } else { resolve(out); }
                    };
                    req.onerror = function(){ resolve(out); };
                }catch(_){ resolve(out); }
            });
        }

        function idbGet(nsKey){
            return new Promise(async (resolve)=>{
                try{
                    await openDB();
                    const tx = db.transaction([STORE_KV], 'readonly');
                    const st = tx.objectStore(STORE_KV);
                    const req = st.get(nsKey);
                    req.onsuccess = ()=> resolve(req.result ? req.result.val : undefined);
                    req.onerror = ()=> resolve(undefined);
                }catch(_){ resolve(undefined); }
            });
        }
        function idbSet(nsKey, val){
            return new Promise(async (resolve)=>{
                try{
                    await openDB();
                    const tx = db.transaction([STORE_KV], 'readwrite');
                    tx.objectStore(STORE_KV).put({ key: nsKey, val });
                    tx.oncomplete = ()=> resolve(true);
                    tx.onerror = ()=> resolve(false);
                }catch(_){ resolve(false); }
            });
        }
        function idbDel(nsKey){
            return new Promise(async (resolve)=>{
                try{
                    await openDB();
                    const tx = db.transaction([STORE_KV], 'readwrite');
                    tx.objectStore(STORE_KV).delete(nsKey);
                    tx.oncomplete = ()=> resolve(true);
                    tx.onerror = ()=> resolve(false);
                }catch(_){ resolve(false); }
            });
        }

        // Note: LocalStorage mirroring removed. All state persisted in IndexedDB only.

        // Warm all cache entries early (best-effort)
        function warmCacheAll(){
            return new Promise(async (resolve)=>{
                try{
                    await openDB();
                    const tx = db.transaction([STORE_KV], 'readonly');
                    const st = tx.objectStore(STORE_KV);
                    const req = st.openCursor();
                    req.onsuccess = function(e){
                        const cursor = e.target.result;
                        if (cursor) {
                            try { cache[cursor.key] = cursor.value?.val; } catch(_){}
                            cursor.continue();
                        } else { resolve(true); }
                    };
                    req.onerror = function(){ resolve(false); };
                }catch(_){ resolve(false); }
            });
        }
        try { window.whenStorageReady = warmCacheAll(); } catch(_){}

        // Initialize cross-tab channel for state sync (best-effort)
        try { window.__MC_BC = window.__MC_BC || new BroadcastChannel(BC_NAME); } catch(_) {}

        // Public API (kept sync signatures to avoid large refactor)
        window.getFromLocalStorage = function(key, defaultValue){
            try{
                const nsKey = String((window.storagePrefix||'') + key);
                if (Object.prototype.hasOwnProperty.call(cache, nsKey)) return cache[nsKey];
                // Lazy load from IDB; return fallback synchronously
                idbGet(nsKey).then(val => { if (val !== undefined) cache[nsKey] = val; });
                return defaultValue;
            }catch(e){ return defaultValue; }
        };

        // History helpers (append-only list in KV)
        function resolveModeInfo(){
            try {
                if (typeof getAppMode === 'function') {
                    const m = getAppMode();
                    if (m && String(m.type).toLowerCase() === 'single') {
                        return { mode: 'single', chain: String(m.chain||'').toUpperCase() || 'UNKNOWN' };
                    }
                    return { mode: 'multi', chain: 'MULTICHAIN' };
                }
            } catch(_) {}
            // Fallback to URL param
            try {
                const params = new URLSearchParams(window.location.search || '');
                const raw = (params.get('chain') || 'all').toLowerCase();
                if (!raw || raw === 'all') return { mode: 'multi', chain: 'MULTICHAIN' };
                return { mode: 'single', chain: raw.toUpperCase() };
            } catch(_) { return { mode: 'multi', chain: 'MULTICHAIN' }; }
        }

        function formatActionLabel(action, includeChain){
            try {
                const hasBracket = /\[[^\]]+\]$/.test(String(action));
                if (!includeChain || hasBracket) return String(action);
                const info = resolveModeInfo();
                return `${String(action)} [${info.chain}]`;
            } catch(_) { return String(action); }
        }

        async function getHistoryLog(){
            try {
                const key = String((window.storagePrefix||'') + 'HISTORY_LOG');
                if (Object.prototype.hasOwnProperty.call(cache, key)) return Array.isArray(cache[key]) ? cache[key] : [];
                const val = await idbGet(key);
                if (val !== undefined) cache[key] = val;
                return Array.isArray(val) ? val : [];
            } catch(_) { return []; }
        }

        async function addHistoryEntryRaw(entry){
            try {
                const list = await getHistoryLog();
                const capped = list.slice(-999);
                capped.push(entry);
                const key = String((window.storagePrefix||'') + 'HISTORY_LOG');
                cache[key] = capped;
                await idbSet(key, capped);
                try { if (window.__MC_BC) window.__MC_BC.postMessage({ type: 'history', entry }); } catch(_) {}
                return true;
            } catch(_) { return false; }
        }

        // options: { includeChain?: boolean }
        window.addHistoryEntry = async function(action, status, meta, options){
            try {
                const when = new Date();
                const stamp = when.toLocaleString('id-ID', { hour12: false });
                const includeChain = (options && typeof options.includeChain === 'boolean') ? options.includeChain : true;
                const actionLabel = formatActionLabel(action, includeChain);
                const entry = {
                    id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
                    timeISO: when.toISOString(),
                    time: stamp,
                    action: String(actionLabel||'').trim(),
                    status: String(status||'success').toLowerCase(),
                    meta: meta || undefined
                };
                return await addHistoryEntryRaw(entry);
            } catch(_) { return false; }
        };

        // Expose getters and bulk delete utilities
        window.getHistoryLog = async function(){ return await getHistoryLog(); };
        window.clearHistoryLog = async function(){
            try{
                const key = String((window.storagePrefix||'') + 'HISTORY_LOG');
                cache[key] = [];
                await idbSet(key, []);
                try { if (window.__MC_BC) window.__MC_BC.postMessage({ type: 'history_clear' }); } catch(_) {}
                return true;
            } catch(_) { return false; }
        };
        window.deleteHistoryByIds = async function(ids){
            try{
                const list = await getHistoryLog();
                const set = new Set((ids||[]).map(String));
                const filtered = list.filter(e => !set.has(String(e.id)));
                const key = String((window.storagePrefix||'') + 'HISTORY_LOG');
                cache[key] = filtered;
                await idbSet(key, filtered);
                try { if (window.__MC_BC) window.__MC_BC.postMessage({ type: 'history_delete', ids: Array.from(set) }); } catch(_) {}
                return { ok: true, removed: list.length - filtered.length };
            } catch(e){ return { ok:false, error: e }; }
        };

        window.saveToLocalStorage = function(key, value){
            try{
                const nsKey = String((window.storagePrefix||'') + key);
                cache[nsKey] = value;
                idbSet(nsKey, value);
                // Broadcast key update (e.g., APP_STATE) to other tabs
                try { if (window.__MC_BC) window.__MC_BC.postMessage({ type: 'kv', key, val: value }); } catch(_) {}
                // no localStorage mirror
            }catch(_){ /* ignore */ }
        };

        // Async variant with explicit success/failure result for better UX
        window.saveToLocalStorageAsync = async function(key, value){
            const nsKey = String((window.storagePrefix||'') + key);
            try {
                cache[nsKey] = value;
                const ok = await idbSet(nsKey, value);
                // no localStorage mirror
                if (!ok) {
                    try {
                        window.LAST_STORAGE_ERROR = 'IndexedDB transaction failed (possibly quota or permissions).';
                    } catch(_) {}
                }
                try { if (ok && window.__MC_BC) window.__MC_BC.postMessage({ type: 'kv', key, val: value }); } catch(_) {}
                return { ok };
            } catch (e) {
                try { window.LAST_STORAGE_ERROR = (e && e.message) ? e.message : String(e); } catch(_) {}
                return { ok: false, error: e };
            }
        };

        window.removeFromLocalStorage = function(key){
            try{
                const nsKey = String((window.storagePrefix||'') + key);
                delete cache[nsKey];
                idbDel(nsKey);
                // no localStorage mirror
            }catch(_){ /* ignore */ }
        };

        // ============================
        // BACKUP & RESTORE HELPERS
        // ============================
        window.exportIDB = async function(){
            try {
                const items = await idbGetAll();
                return {
                    schema: 'kv-v1',
                    db: DB_NAME,
                    store: STORE_KV,
                    prefix: (window.storagePrefix||''),
                    exportedAt: new Date().toISOString(),
                    count: items.length,
                    items
                };
            } catch(e){ return { schema:'kv-v1', error: String(e) }; }
        };

        window.restoreIDB = async function(payload, opts){
            const options = Object.assign({ overwrite: true }, opts||{});
            let ok = 0, fail = 0;
            if (!payload || !Array.isArray(payload.items)) return { ok, fail, error: 'Invalid payload' };
            for (const it of payload.items){
                try {
                    if (!it || !it.key) { fail++; continue; }
                    // Optional: honor prefix if provided; else write as-is
                    const key = String(it.key);
                    const res = await idbSet(key, it.val);
                    if (res) { cache[key] = it.val; ok++; } else { fail++; }
                } catch(_) { fail++; }
            }
            return { ok, fail };
        };

        window.downloadJSON = function(filename, obj){
            try {
                const dataStr = JSON.stringify(obj, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = filename || 'backup.json';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return true;
            } catch(_) { return false; }
        };
    })();

   // ============================
    // DOWNLOAD CSV
    // ============================
    function getActiveTokenKeyLocal() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const raw = (params.get('chain') || '').toLowerCase();
            if (!raw || raw === 'all') return 'TOKEN_MULTICHAIN';
            return `TOKEN_${String(raw).toUpperCase()}`;
        } catch(_) { return 'TOKEN_MULTICHAIN'; }
    }

    function getActiveChainLabel() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const raw = (params.get('chain') || 'all').toLowerCase();
            return (!raw || raw === 'all') ? 'MULTICHAIN' : raw.toUpperCase();
        } catch(_) { return 'MULTICHAIN'; }
    }

    /**
     * Export tokens to CSV with human-readable expanded format
     * - CEX columns: CEX_BINANCE, CEX_MEXC, etc. (TRUE/FALSE)
     * - DEX columns: DEX_1INCH, DEX_PARASWAP, etc. (left|right modal)
     * - Auto-generates columns based on CONFIG_CEX and CONFIG_DEXS
     * - No ID/NO columns (auto-generated on import)
     * - No JSON fields (all plain text)
     */
    function downloadTokenScannerCSV() {
        const tokenData = getFromLocalStorage(getActiveTokenKeyLocal(), []);
        const chainLabel = getActiveChainLabel();
        const appName = (typeof window !== 'undefined' && window.CONFIG_APP && window.CONFIG_APP.APP && window.CONFIG_APP.APP.NAME)
            ? window.CONFIG_APP.APP.NAME
            : 'MULTIALL-PLUS';
        const safeApp = (function(name){
            try {
                const safe = String(name || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
                return safe ? safe.toUpperCase() : 'APP';
            } catch(_) { return 'APP'; }
        })(appName);

        // Get all available CEX and DEX from config
        const allCex = Object.keys(window.CONFIG_CEX || {}).map(c => c.toUpperCase());
        const allDex = Object.keys(window.CONFIG_DEXS || {}).map(d => d.toLowerCase());

        // Build dynamic headers with expanded CEX and DEX columns
        const baseHeaders = [
            "symbol_in", "symbol_out", "chain",
            "sc_in", "des_in", "sc_out", "des_out", "status"
        ];

        // CEX columns: CEX_BINANCE, CEX_MEXC, etc.
        const cexHeaders = allCex.map(cex => `CEX_${cex}`);

        // DEX columns: DEX_1INCH, DEX_PARASWAP, etc. (format: left|right)
        const dexHeaders = allDex.map(dex => `DEX_${dex.toUpperCase()}`);

        const headers = [...baseHeaders, ...cexHeaders, ...dexHeaders];

        // Convert each token to row with expanded columns
        const rows = tokenData.map(token => {
            const baseValues = [
                token.symbol_in ?? "",
                token.symbol_out ?? "",
                token.chain ?? "",
                token.sc_in ?? "",
                token.des_in ?? "",
                token.sc_out ?? "",
                token.des_out ?? "",
                token.status ? "TRUE" : "FALSE"
            ];

            // CEX values: true/false based on selectedCexs
            const selectedCexs = (token.selectedCexs || []).map(c => c.toUpperCase());
            const cexValues = allCex.map(cex => selectedCexs.includes(cex) ? "TRUE" : "FALSE");

            // DEX values: left|right or empty
            // Token stores DEX data in selectedDexs (array) and dataDexs (object with modal data)
            const selectedDexs = (token.selectedDexs || []).map(d => String(d).toLowerCase());
            const dataDexs = token.dataDexs || {};

            const dexValues = allDex.map(dex => {
                const dexLower = dex.toLowerCase();
                // Check if this DEX is selected
                if (selectedDexs.includes(dexLower)) {
                    const dexData = dataDexs[dexLower];
                    if (dexData && typeof dexData.left !== 'undefined' && typeof dexData.right !== 'undefined') {
                        // ✅ EXPORT NILAI ASLI dari aplikasi (NO DEFAULT)
                        return `${dexData.left}|${dexData.right}`;
                    }
                    // Jika tidak ada modal data, skip (return empty)
                    return "";
                }
                return "";
            });

            const allValues = [...baseValues, ...cexValues, ...dexValues];
            return allValues.map(v => `"${String(v).replace(/"/g, '""')}"`);
        });

        // Gabungkan jadi CSV
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

        // Debug logging untuk sample token
        if (tokenData.length > 0) {
            const sampleToken = tokenData[0];
            // console.log('[EXPORT CSV] Sample token structure:', {
                // selectedDexs: sampleToken.selectedDexs,
                // dataDexs: sampleToken.dataDexs,
                // selectedCexs: sampleToken.selectedCexs
            // });
        }

        // Buat file download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `KOIN_${safeApp}_${chainLabel}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // console.log(`[EXPORT CSV] Exported ${tokenData.length} tokens with ${cexHeaders.length} CEX and ${dexHeaders.length} DEX columns`);
        // console.log(`[EXPORT CSV] DEX columns:`, dexHeaders);
        try { setLastAction(`EXPORT DATA KOIN`, 'success'); } catch(_) {}
    }

    // ============================
    // UPLOAD CSV
    // ============================
    function uploadTokenScannerCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const csvText = e.target.result.trim();
                const rows = csvText.split("\n").filter(r => r.trim());

                if (rows.length < 2) {
                    throw new Error("CSV file is empty or has no data rows");
                }

                // Ambil header dan normalize (remove quotes, trim)
                const rawHeaders = rows[0].split(",").map(h => {
                    let clean = h.trim();
                    if (clean.startsWith('"') && clean.endsWith('"')) {
                        clean = clean.slice(1, -1);
                    }
                    return clean;
                });

                // console.log('[IMPORT CSV] Headers detected:', rawHeaders);

                // Detect format: NEW (expanded CEX/DEX columns) or OLD (compact)
                const hasExpandedFormat = rawHeaders.some(h => h.startsWith('CEX_') || h.startsWith('DEX_'));
                // console.log('[IMPORT CSV] Format detected:', hasExpandedFormat ? 'NEW (Expanded)' : 'OLD (Compact)');

                // Parse tiap baris → object
                const tokenData = rows.slice(1).map((row, rowIndex) => {
                    // Split CSV aman, mempertahankan koma dalam tanda kutip
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

                    let obj = {
                        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + rowIndex,
                        selectedCexs: [],
                        dexs: [],
                        dataCexs: {},
                        dataDexs: {},
                        status: true
                    };

                    rawHeaders.forEach((header, index) => {
                        let val = values[index] ? values[index].trim() : "";

                        // Hapus tanda kutip luar & ganti "" jadi "
                        if (val.startsWith('"') && val.endsWith('"')) {
                            val = val.slice(1, -1).replace(/""/g, '"');
                        }

                        // === NEW FORMAT: Expanded CEX/DEX columns ===
                        if (header.startsWith('CEX_')) {
                            const cexName = header.substring(4).toUpperCase();
                            const isActive = (val || '').toString().trim().toUpperCase() === 'TRUE';
                            if (isActive && !obj.selectedCexs.includes(cexName)) {
                                obj.selectedCexs.push(cexName);
                                // Initialize dataCexs entry
                                obj.dataCexs[cexName] = {
                                    feeWDToken: 0,
                                    feeWDPair: 0,
                                    depositToken: false,
                                    withdrawToken: false,
                                    depositPair: false,
                                    withdrawPair: false
                                };
                            }
                        }
                        else if (header.startsWith('DEX_')) {
                            const dexName = header.substring(4).toLowerCase();
                            if (val && val.includes('|')) {
                                const parts = val.split('|');
                                const left = parseFloat(parts[0].trim());
                                const right = parseFloat(parts[1].trim());

                                // ✅ IMPORT NILAI ASLI dari CSV (NO DEFAULT - parse exact values)
                                if (!isNaN(left) && !isNaN(right)) {
                                    obj.dexs.push({
                                        dex: dexName,
                                        left: left,
                                        right: right
                                    });
                                    // Also add to selectedDexs
                                    if (!obj.selectedDexs) obj.selectedDexs = [];
                                    if (!obj.selectedDexs.includes(dexName)) {
                                        obj.selectedDexs.push(dexName);
                                    }
                                }
                            }
                        }
                        // === OLD FORMAT: Compact columns ===
                        else if (header === "dataCexs") {
                            try { obj.dataCexs = JSON.parse(val || "{}"); } catch { obj.dataCexs = {}; }
                        }
                        else if (header === "dataDexs") {
                            try { obj.dataDexs = JSON.parse(val || "{}"); } catch { obj.dataDexs = {}; }
                        }
                        else if (header === "selectedCexs") {
                            obj.selectedCexs = val ? val.split("|").map(c => c.trim().toUpperCase()) : [];
                            // Auto-initialize dataCexs for each selected CEX with default values
                            obj.selectedCexs.forEach(cexName => {
                                if (!obj.dataCexs[cexName]) {
                                    obj.dataCexs[cexName] = {
                                        feeWDToken: 0,
                                        feeWDPair: 0,
                                        depositToken: false,
                                        withdrawToken: false,
                                        depositPair: false,
                                        withdrawPair: false
                                    };
                                }
                            });
                        }
                        else if (header === "selectedDexs") {
                            // OLD FORMAT: selectedDexs | dataDexs columns
                            obj.selectedDexs = val ? val.split("|").map(d => d.trim().toLowerCase()) : [];
                            // dataDexs will be parsed separately from dataDexs column
                            // NO DEFAULT VALUES - use exact data from dataDexs JSON
                        }
                        // === Common fields ===
                        else if (header === "id" || header === "no") {
                            // Skip - we auto-generate ID
                        }
                        else if (header === "des_in" || header === "des_out") {
                            obj[header] = val ? Number(val) : 0;
                        }
                        else if (header === "status") {
                            obj.status = (val || "").toString().trim().toUpperCase() === "TRUE";
                        }
                        else {
                            obj[header] = val;
                        }
                    });

                    // === POST-PROCESSING: Convert obj.dexs to selectedDexs + dataDexs ===
                    if (obj.dexs && obj.dexs.length > 0) {
                        // Build selectedDexs array
                        obj.selectedDexs = obj.dexs.map(d => d.dex);

                        // Build dataDexs object with EXACT values from CSV (NO DEFAULT)
                        obj.dexs.forEach(dexItem => {
                            obj.dataDexs[dexItem.dex] = {
                                left: dexItem.left,   // ✅ Exact value dari CSV
                                right: dexItem.right  // ✅ Exact value dari CSV
                            };
                        });

                        // Clear temporary dexs array (not needed in final structure)
                        delete obj.dexs;
                    } else {
                        obj.selectedDexs = obj.selectedDexs || [];
                    }

                    // === POST-PROCESSING: Auto-fill missing dataCexs with default values ===
                    // Ensure all selectedCexs have dataCexs entries
                    (obj.selectedCexs || []).forEach(cexName => {
                        if (!obj.dataCexs[cexName]) {
                            // console.log(`[IMPORT CSV] Auto-filling dataCexs for ${cexName} with defaults`);
                            obj.dataCexs[cexName] = {
                                feeWDToken: 0,           // Default: no fee
                                feeWDPair: 0,            // Default: no fee
                                depositToken: false,     // Default: deposit closed
                                withdrawToken: false,    // Default: withdraw closed
                                depositPair: false,      // Default: deposit closed
                                withdrawPair: false      // Default: withdraw closed
                            };
                        } else {
                            // Ensure all required fields exist with defaults
                            const defaults = {
                                feeWDToken: 0,
                                feeWDPair: 0,
                                depositToken: false,
                                withdrawToken: false,
                                depositPair: false,
                                withdrawPair: false
                            };
                            // Merge with defaults to fill missing fields
                            obj.dataCexs[cexName] = { ...defaults, ...obj.dataCexs[cexName] };
                        }
                    });

                    // === POST-PROCESSING: Clean up dataCexs - remove entries not in selectedCexs ===
                    const selectedSet = new Set((obj.selectedCexs || []).map(c => c.toUpperCase()));
                    Object.keys(obj.dataCexs || {}).forEach(cexName => {
                        if (!selectedSet.has(cexName.toUpperCase())) {
                            // console.log(`[IMPORT CSV] Removing unused dataCexs entry: ${cexName}`);
                            delete obj.dataCexs[cexName];
                        }
                    });

                    return obj;
                });

                // console.log('[IMPORT CSV] Parsed tokens:', tokenData.length);
                // console.log('[IMPORT CSV] Sample token:', tokenData[0]);

                // Simpan ke storage (IndexedDB KV)
                const chainLabel = getActiveChainLabel();
                saveToLocalStorage(getActiveTokenKeyLocal(), tokenData);

                // Hitung jumlah token yang diimport
                let jumlahToken = Array.isArray(tokenData) ? tokenData.length : 0;

                // Notifikasi sukses + tetap tampil setelah reload
                try { setLastAction(`IMPORT DATA KOIN`, 'success', { count: jumlahToken }); } catch(_) {}
                try {
                    if (typeof reloadWithNotify === 'function') {
                        reloadWithNotify('success', `✅ BERHASIL IMPORT ${jumlahToken} TOKEN 📦`);
                    } else if (typeof notifyAfterReload === 'function') {
                        notify('success', `✅ BERHASIL IMPORT ${jumlahToken} TOKEN 📦`, null, { persist: true });
                        location.reload();
                    } else if (typeof toast !== 'undefined' && toast.success) {
                        toast.success(`✅ BERHASIL IMPORT ${jumlahToken} TOKEN 📦`);
                        location.reload();
                    } else {
                        alert(`✅ BERHASIL IMPORT ${jumlahToken} TOKEN 📦`);
                        location.reload();
                    }
                } catch(_) { try { location.reload(); } catch(_){} }

            } catch (error) {
                // console.error("Error parsing CSV:", error);
                try { setLastAction('IMPORT DATA KOIN', 'error', { error: String(error && error.message || error) }); } catch(_) {}
                if (typeof toast !== 'undefined' && toast.error) {
                    toast.error(`Format file CSV tidak valid: ${error.message}`);
                } else {
                    alert(`Format file CSV tidak valid: ${error.message}`);
                }
            }
        };
        reader.readAsText(file);
    }

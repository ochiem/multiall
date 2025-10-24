// =================================================================================
// CENTRALIZED LOGGING UTILITY
// =================================================================================

/**
 * Centralized logger yang hanya menampilkan console.log jika checkbox log aktif.
 * console.error dan console.warn SELALU ditampilkan untuk debugging.
 */
const AppLogger = {
    isEnabled: function() {
        return typeof window !== 'undefined' && window.SCAN_LOG_ENABLED === true;
    },

    log: function(module, message, data) {
        if (!this.isEnabled()) return;
        const prefix = module ? `[${module}]` : '';
        if (data !== undefined) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    },

    warn: function(module, message, data) {
        // Warning SELALU ditampilkan
        const prefix = module ? `[${module}]` : '';
        if (data !== undefined) {
            console.warn(prefix, message, data);
        } else {
            console.warn(prefix, message);
        }
    },

    error: function(module, message, data) {
        // Error SELALU ditampilkan
        const prefix = module ? `[${module}]` : '';
        if (data !== undefined) {
            console.error(prefix, message, data);
        } else {
            console.error(prefix, message);
        }
    },

    // Untuk backward compatibility dengan kode yang ada
    info: function(module, message, data) {
        this.log(module, message, data);
    }
};

// Expose globally
if (typeof window !== 'undefined') {
    window.AppLogger = AppLogger;
}

// =================================================================================
// APP MODE & DATA ACCESS HELPERS (shared by UI/API/Main)
// =================================================================================

/**
 * Resolves application mode from URL query.
 * - multi: index.html?chain=all
 * - single: index.html?chain=<chain>
 */
function getAppMode() {
    try {
        if (window.AppMode && window.AppMode._cached) return window.AppMode;
        const params = new URLSearchParams(window.location.search || '');
        const raw = (params.get('chain') || '').toLowerCase();
        let mode;
        if (!raw || raw === 'all') {
            mode = { type: 'multi' };
        } else if (window.CONFIG_CHAINS && window.CONFIG_CHAINS[raw]) {
            mode = { type: 'single', chain: raw };
        } else {
            mode = { type: 'multi' };
        }
        window.AppMode = Object.assign({ _cached: true }, mode);
        return window.AppMode;
    } catch (_) {
        return { type: 'multi' };
    }
}

// =================================================================================
// GLOBAL SCAN LOCK SYSTEM
// =================================================================================
/**
 * Global scan lock menggunakan filter.run untuk mencegah multiple scan bersamaan.
 * Lock disimpan dengan metadata: tabId, timestamp, mode, chain
 */

/**
 * Get global scan lock info dari semua filter keys
 * @returns {Object|null} Lock info jika ada scan berjalan, null jika tidak ada
 */
function getGlobalScanLock() {
    try {
        const now = Date.now();
        const LOCK_TIMEOUT = 300000; // 5 minutes - auto cleanup if stale

        // Check FILTER_MULTICHAIN
        const multiFilter = getFromLocalStorage('FILTER_MULTICHAIN', {});
        if (multiFilter.run === 'YES' && multiFilter.runMeta) {
            const age = now - (multiFilter.runMeta.timestamp || 0);
            if (age < LOCK_TIMEOUT) {
                return {
                    mode: 'MULTICHAIN',
                    key: 'FILTER_MULTICHAIN',
                    ...multiFilter.runMeta,
                    age
                };
            } else {
                // Stale lock - auto cleanup
                clearGlobalScanLock('FILTER_MULTICHAIN');
            }
        }

        // Check all FILTER_<CHAIN> keys
        const chains = Object.keys(window.CONFIG_CHAINS || {});
        for (const chain of chains) {
            const key = `FILTER_${chain.toUpperCase()}`;
            const filter = getFromLocalStorage(key, {});
            if (filter.run === 'YES' && filter.runMeta) {
                const age = now - (filter.runMeta.timestamp || 0);
                if (age < LOCK_TIMEOUT) {
                    return {
                        mode: chain.toUpperCase(),
                        key,
                        ...filter.runMeta,
                        age
                    };
                } else {
                    // Stale lock - auto cleanup
                    clearGlobalScanLock(key);
                }
            }
        }

        return null;
    } catch(e) {
        // console.error('[SCAN LOCK] Error getting global lock:', e);
        return null;
    }
}

/**
 * Set global scan lock
 * @param {string} filterKey - Filter key (FILTER_MULTICHAIN or FILTER_<CHAIN>)
 * @param {Object} meta - Metadata: { tabId, mode, chain }
 * @returns {boolean} True if lock acquired, false if already locked
 */
function setGlobalScanLock(filterKey, meta = {}) {
    try {
        // Check if scan limit is enabled
        const scanLimitEnabled = typeof window !== 'undefined'
            && window.CONFIG_APP
            && window.CONFIG_APP.APP
            && window.CONFIG_APP.APP.SCAN_LIMIT === true;

        // If scan limit is disabled, skip lock checking (allow multiple scans)
        if (!scanLimitEnabled) {
            // console.log('[SCAN LOCK] Scan limit disabled - skipping lock enforcement');
            // Still set the lock data for tracking purposes, but don't enforce uniqueness
            const filter = getFromLocalStorage(filterKey, {}) || {};
            filter.run = 'YES';
            filter.runMeta = {
                tabId: meta.tabId || (typeof getTabId === 'function' ? getTabId() : null),
                mode: meta.mode || 'UNKNOWN',
                chain: meta.chain || null,
                timestamp: Date.now(),
                startTime: new Date().toISOString()
            };
            saveToLocalStorage(filterKey, filter);
            startScanLockHeartbeat(filterKey);
            return true;
        }

        // Scan limit is enabled - enforce single scan restriction
        const existingLock = getGlobalScanLock();
        if (existingLock) {
            const isSameTab = existingLock.tabId === (meta.tabId || getTabId());
            if (!isSameTab) {
                // console.warn('[SCAN LOCK] Cannot acquire lock - scan already running:', existingLock);
                return false;
            }
        }

        const filter = getFromLocalStorage(filterKey, {}) || {};
        filter.run = 'YES';
        filter.runMeta = {
            tabId: meta.tabId || (typeof getTabId === 'function' ? getTabId() : null),
            mode: meta.mode || 'UNKNOWN',
            chain: meta.chain || null,
            timestamp: Date.now(),
            startTime: new Date().toISOString()
        };

        saveToLocalStorage(filterKey, filter);
        // console.log('[SCAN LOCK] Lock acquired:', filterKey, filter.runMeta);

        // Start heartbeat
        startScanLockHeartbeat(filterKey);

        return true;
    } catch(e) {
        // console.error('[SCAN LOCK] Error setting lock:', e);
        return false;
    }
}

/**
 * Clear global scan lock
 * @param {string} filterKey - Filter key to clear
 */
function clearGlobalScanLock(filterKey) {
    try {
        const filter = getFromLocalStorage(filterKey, {}) || {};
        filter.run = 'NO';
        delete filter.runMeta;
        saveToLocalStorage(filterKey, filter);
        // console.log('[SCAN LOCK] Lock cleared:', filterKey);

        // Stop heartbeat
        stopScanLockHeartbeat();
    } catch(e) {
        // console.error('[SCAN LOCK] Error clearing lock:', e);
    }
}

/**
 * Check if current tab can start scanning
 * @returns {Object} { canScan: boolean, reason: string, lockInfo: Object|null }
 */
function checkCanStartScan() {
    try {
        // Check if scan limit is enabled
        const scanLimitEnabled = typeof window !== 'undefined'
            && window.CONFIG_APP
            && window.CONFIG_APP.APP
            && window.CONFIG_APP.APP.SCAN_LIMIT === true;

        // If scan limit is disabled, always allow scanning
        if (!scanLimitEnabled) {
            // console.log('[SCAN LOCK] Scan limit disabled - allowing multiple scans');
            return { canScan: true, reason: 'Scan limit disabled', lockInfo: null };
        }

        const lock = getGlobalScanLock();

        if (!lock) {
            return { canScan: true, reason: 'No active scan', lockInfo: null };
        }

        const currentTabId = typeof getTabId === 'function' ? getTabId() : null;
        const isSameTab = lock.tabId === currentTabId;

        if (isSameTab) {
            return { canScan: true, reason: 'Same tab lock', lockInfo: lock };
        }

        const ageSeconds = Math.floor(lock.age / 1000);
        const lockMode = lock.mode || 'UNKNOWN';
        const reason = `Scan sedang berjalan di tab lain (${lockMode}) - ${ageSeconds}s ago`;

        return { canScan: false, reason, lockInfo: lock };
    } catch(e) {
        // console.error('[SCAN LOCK] Error checking can scan:', e);
        return { canScan: true, reason: 'Error checking - allowing scan', lockInfo: null };
    }
}

// Heartbeat untuk keep-alive scan lock
let _scanLockHeartbeatInterval = null;
let _scanLockHeartbeatKey = null;

function startScanLockHeartbeat(filterKey) {
    stopScanLockHeartbeat(); // Clear any existing

    _scanLockHeartbeatKey = filterKey;
    _scanLockHeartbeatInterval = setInterval(() => {
        try {
            const filter = getFromLocalStorage(filterKey, {});
            if (filter.run === 'YES' && filter.runMeta) {
                // Update timestamp to keep lock alive
                filter.runMeta.timestamp = Date.now();
                saveToLocalStorage(filterKey, filter);
                // console.log('[SCAN LOCK] Heartbeat updated:', filterKey);
            } else {
                // Lock was cleared elsewhere - stop heartbeat
                stopScanLockHeartbeat();
            }
        } catch(e) {
            // console.error('[SCAN LOCK] Heartbeat error:', e);
        }
    }, 30000); // Update every 30 seconds
}

function stopScanLockHeartbeat() {
    if (_scanLockHeartbeatInterval) {
        clearInterval(_scanLockHeartbeatInterval);
        _scanLockHeartbeatInterval = null;
        _scanLockHeartbeatKey = null;
        // console.log('[SCAN LOCK] Heartbeat stopped');
    }
}

/** Returns the active token storage key based on mode. */
function getActiveTokenKey() {
    const m = getAppMode();
    if (m.type === 'single') return `TOKEN_${String(m.chain).toUpperCase()}`;
    return 'TOKEN_MULTICHAIN';
}

/** Returns the active filter storage key based on mode. */
function getActiveFilterKey() {
    const m = getAppMode();
    if (m.type === 'single') return `FILTER_${String(m.chain).toUpperCase()}`;
    return 'FILTER_MULTICHAIN';
}

/** Get tokens for active mode. */
function getActiveTokens(defaultVal = []) {
    return getFromLocalStorage(getActiveTokenKey(), defaultVal) || defaultVal;
}

/** Save tokens for active mode. */
function saveActiveTokens(list) {
    return saveToLocalStorage(getActiveTokenKey(), Array.isArray(list) ? list : []);
}

/** Get filters for active mode. */
function getActiveFilters(defaultVal = null) {
    return getFromLocalStorage(getActiveFilterKey(), defaultVal);
}

/** Save filters for active mode. */
function saveActiveFilters(obj) {
    return saveToLocalStorage(getActiveFilterKey(), obj || {});
}

// PNL filter helpers per mode
function getPNLFilter() {
    try {
        const f = getFromLocalStorage(getActiveFilterKey(), {}) || {};
        const v = parseFloat(f.pnl);
        return isFinite(v) && v >= 0 ? v : 0;
    } catch(_) { return 0; }
}

function setPNLFilter(value) {
    const v = parseFloat(value);
    const key = getActiveFilterKey();
    const f = getFromLocalStorage(key, {}) || {};
    f.pnl = isFinite(v) && v >= 0 ? v : 0;
    saveToLocalStorage(key, f);
}

// =================================================================================
// MODULAR FILTER AND TOKEN HELPERS (shared across app)
// =================================================================================

function getFilterMulti() {
    const f = getFromLocalStorage('FILTER_MULTICHAIN', null);
    if (f && typeof f === 'object') return { chains: f.chains || [], cex: f.cex || [], dex: (f.dex || []).map(x => String(x).toLowerCase()) };
    return { chains: [], cex: [], dex: [] };
}

function setFilterMulti(val){
    // Merge with existing filter so other keys (e.g., sort, pnl) remain intact
    const prev = getFromLocalStorage('FILTER_MULTICHAIN', {}) || {};
    const next = { ...prev };
    if (val && Object.prototype.hasOwnProperty.call(val, 'chains')) {
        next.chains = (val.chains || []).map(x => String(x).toLowerCase());
    }
    if (val && Object.prototype.hasOwnProperty.call(val, 'cex')) {
        next.cex = (val.cex || []).map(x => String(x).toUpperCase());
    }
    if (val && Object.prototype.hasOwnProperty.call(val, 'dex')) {
        next.dex = (val.dex || []).map(x => String(x).toLowerCase());
    }
    saveToLocalStorage('FILTER_MULTICHAIN', next);
}

function getFilterChain(chain){
    const chainKey = String(chain).toLowerCase();
    const key = `FILTER_${String(chainKey).toUpperCase()}`;
    let f = getFromLocalStorage(key, null);
    if (!f || typeof f !== 'object'){
        // REFACTORED: no try/catch; use optional chaining
        const legacyName = (window.CONFIG_CHAINS?.[chainKey]?.Nama_Chain || '').toString().toUpperCase();
        if (legacyName) {
            const legacyKey = `FILTER_${legacyName}`;
            const lf = getFromLocalStorage(legacyKey, null);
            if (lf && typeof lf === 'object') {
                saveToLocalStorage(key, lf);
                f = lf;
            }
        }
    }
    if (f && typeof f==='object') return { cex: (f.cex||[]).map(String), pair: (f.pair||[]).map(x=>String(x).toUpperCase()), dex: (f.dex||[]).map(x=>String(x).toLowerCase()) };
    return { cex: [], pair: [], dex: [] };
}

function setFilterChain(chain, val){
    const key = `FILTER_${String(chain).toUpperCase()}`;
    const prev = getFromLocalStorage(key, {}) || {};
    const next = { ...prev };
    if (val && Object.prototype.hasOwnProperty.call(val, 'cex')) {
        next.cex = (val.cex || []).map(String);
    }
    if (val && Object.prototype.hasOwnProperty.call(val, 'pair')) {
        next.pair = (val.pair || []).map(x => String(x).toUpperCase());
    }
    if (val && Object.prototype.hasOwnProperty.call(val, 'dex')) {
        next.dex = (val.dex || []).map(x => String(x).toLowerCase());
    }
    saveToLocalStorage(key, next);
}

// =================================================================================
// SORTING HELPERS (symbol_in ASC/DESC) BASED ON IDB DATA
// =================================================================================
function sortBySymbolIn(list, pref){
    const dir = (pref === 'Z') ? -1 : 1; // default ASC
    return (Array.isArray(list) ? [...list] : []).sort((a,b)=>{
        const A = String(a.symbol_in||'').toUpperCase();
        const B = String(b.symbol_in||'').toUpperCase();
        if (A < B) return -1 * dir;
        if (A > B) return  1 * dir;
        return 0;
    });
}

function getSortPrefForMulti(){ // REFACTORED
    const f = getFromLocalStorage('FILTER_MULTICHAIN', null);
    return (f && (f.sort==='A'||f.sort==='Z')) ? f.sort : 'A';
}
function getSortPrefForChain(chain){ // REFACTORED
    const key = `FILTER_${String(chain).toUpperCase()}`;
    const f = getFromLocalStorage(key, null);
    return (f && (f.sort==='A'||f.sort==='Z')) ? f.sort : 'A';
}

function getFlattenedSortedMulti(){
    const pref = getSortPrefForMulti();
    const tokens = getTokensMulti();
    const flat = flattenDataKoin(tokens);
    return sortBySymbolIn(flat, pref);
}

function getFlattenedSortedChain(chain){
    const pref = getSortPrefForChain(chain);
    const tokens = getTokensChain(chain);
    const flat = flattenDataKoin(tokens);
    return sortBySymbolIn(flat, pref);
}

function getTokensMulti(){
    let t = getFromLocalStorage('TOKEN_MULTICHAIN', []);
    if (!Array.isArray(t)) return [];
    // Ensure every token has a stable non-empty id
    let mutated = false;
    const fixed = t.map(item => {
        if (!item || (item.id !== 0 && !item.id)) {
            // generate a reasonably unique id
            const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            mutated = true;
            return { ...item, id: newId };
        }
        return item;
    });
    if (mutated) saveToLocalStorage('TOKEN_MULTICHAIN', fixed);
    return fixed;
}

function setTokensMulti(list){
    const prev = getFromLocalStorage('TOKEN_MULTICHAIN', []);
    const arr = Array.isArray(list) ? list : [];
    saveToLocalStorage('TOKEN_MULTICHAIN', arr);
    // REFACTORED
    const hadNoneBefore = !Array.isArray(prev) || prev.length === 0;
    const nowHas = Array.isArray(arr) && arr.length > 0;
    if (nowHas && hadNoneBefore) {
        const chains = Object.keys(window.CONFIG_CHAINS || {}).map(k => String(k).toLowerCase());
        const cex = Object.keys(window.CONFIG_CEX || {}).map(k => String(k).toUpperCase());
        const dex = Object.keys(window.CONFIG_DEXS || {}).map(k => String(k).toLowerCase());
        const existing = getFromLocalStorage('FILTER_MULTICHAIN', null);
        const empty = !existing || ((existing.chains||[]).length===0 && (existing.cex||[]).length===0 && (existing.dex||[]).length===0);
        if (empty) setFilterMulti({ chains, cex, dex });
    }
}

// Async variants for explicit success/failure reporting (non-breaking: new helpers)
async function setTokensMultiAsync(list){
    const arr = Array.isArray(list) ? list : [];
    const { ok } = await (window.saveToLocalStorageAsync ? window.saveToLocalStorageAsync('TOKEN_MULTICHAIN', arr) : Promise.resolve({ ok: true }));
    return ok;
}

function getTokensChain(chain){
    const chainKey = String(chain).toLowerCase();
    const primaryKey = `TOKEN_${String(chainKey).toUpperCase()}`;
    let t = getFromLocalStorage(primaryKey, []);
    if (Array.isArray(t) && t.length) {
        // Ensure ids
        let mutated = false;
        const fixed = t.map(item => {
            if (!item || (item.id !== 0 && !item.id)) {
                const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                mutated = true;
                return { ...item, id: newId };
            }
            return item;
        });
        if (mutated) saveToLocalStorage(primaryKey, fixed);
        return fixed;
    }
    // Fallback to legacy naming using Nama_Chain (e.g., ETHEREUM) if present in backup
    // REFACTORED: legacy fallback without try/catch
    const legacyName = (window.CONFIG_CHAINS?.[chainKey]?.Nama_Chain || '').toString().toUpperCase();
    if (legacyName) {
        const legacyKey = `TOKEN_${legacyName}`;
        const legacy = getFromLocalStorage(legacyKey, []);
        if (Array.isArray(legacy) && legacy.length) {
            let mutated = false;
            const fixed = legacy.map(item => {
                if (!item || (item.id !== 0 && !item.id)) {
                    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                    mutated = true;
                    return { ...item, id: newId };
                }
                return item;
            });
            saveToLocalStorage(primaryKey, fixed);
            return fixed;
        }
    }
    return Array.isArray(t) ? t : [];
}

function setTokensChain(chain, list){
    const chainKey = String(chain).toLowerCase();
    const key = `TOKEN_${String(chainKey).toUpperCase()}`;
    const prev = getFromLocalStorage(key, []);
    const arr = Array.isArray(list) ? list : [];
    saveToLocalStorage(key, arr);
    // REFACTORED
    const hadNoneBefore2 = !Array.isArray(prev) || prev.length === 0;
    const nowHas2 = Array.isArray(arr) && arr.length > 0;
    if (nowHas2 && hadNoneBefore2) {
        const cfg = (window.CONFIG_CHAINS || {})[chainKey] || {};
        const cex = Object.keys(cfg.WALLET_CEX || window.CONFIG_CEX || {}).map(k => String(k));
        const pairs = Array.from(new Set([...(Object.keys(cfg.PAIRDEXS || {})), 'NON'])).map(x => String(x).toUpperCase());
        const dex = (cfg.DEXS || []).map(x => String(x).toLowerCase());
        const fkey = `FILTER_${String(chainKey).toUpperCase()}`;
        const existing = getFromLocalStorage(fkey, null);
        const empty = !existing || ((existing.cex||[]).length===0 && (existing.pair||[]).length===0 && (existing.dex||[]).length===0);
        if (empty) setFilterChain(chain, { cex, pair: pairs, dex });
    }
}

async function setTokensChainAsync(chain, list){
    const key = `TOKEN_${String(chain).toLowerCase().toUpperCase()}`; // keep current primary
    const arr = Array.isArray(list) ? list : [];
    const { ok } = await (window.saveToLocalStorageAsync ? window.saveToLocalStorageAsync(key, arr) : Promise.resolve({ ok: true }));
    return ok;
}

// =================================================================================
// FEATURE READINESS & GATING HELPERS
// =================================================================================

function getFeatureReadiness() {
    const mode = getAppMode();
    const settings = getFromLocalStorage('SETTING_SCANNER', {});
    const hasSettings = !!(settings && typeof settings === 'object' && Object.keys(settings).length);
    const multi = getTokensMulti(); // REFACTORED
    const hasTokensMulti = Array.isArray(multi) && multi.length > 0;
    const hasTokensChain = (mode.type === 'single') ? (Array.isArray(getTokensChain(mode.chain)) && getTokensChain(mode.chain).length > 0) : false;

    const feature = {
        settings: true,
        scan: hasSettings && (mode.type === 'single' ? hasTokensChain : hasTokensMulti),
        manage: hasSettings, // aktif jika setting sudah ada (semua mode)
        sync: hasSettings && (mode.type === 'single'),
        import: hasSettings,
        export: hasSettings && (mode.type === 'single' ? hasTokensChain : hasTokensMulti),
        wallet: hasSettings && (hasTokensChain || hasTokensMulti),
        assets: hasSettings,
        snapshot: hasSettings,
        proxy: true,
        reload: true
    };

    return { mode, hasSettings, hasTokensMulti, hasTokensChain, feature };
}

/**
 * Apply theme color based on mode:
 * - multi: keep existing green accent
 * - single: use CONFIG_CHAINS[chain].WARNA
 */
function applyThemeForMode() {
    try {
        const m = getAppMode();
        const root = document.documentElement;
        const body = document.body || document.getElementsByTagName('body')[0];
        if (!root || !body) return;

        let accent = '#5c9514'; // default for multi
        let label = '[ALL]';
        body.classList.remove('theme-single', 'theme-multi');

        if (m.type === 'single') {
            const cfg = (window.CONFIG_CHAINS || {})[m.chain] || {};
            accent = cfg.WARNA || accent;
            label = `[${(cfg.Nama_Pendek || cfg.Nama_Chain || m.chain || 'CHAIN').toString().toUpperCase()}]`;
            body.classList.add('theme-single');
        } else {
            body.classList.add('theme-multi');
        }

        // Apply dark-mode based on per-mode state
        try {
            const st = (typeof getAppState === 'function') ? getAppState() : { darkMode: false };
            if (st && st.darkMode) {
                body.classList.add('dark-mode', 'uk-dark');
                body.classList.remove('uk-light');
            } else {
                body.classList.remove('dark-mode', 'uk-dark');
            }
            try { if (typeof updateDarkIcon === 'function') updateDarkIcon(!!st.darkMode); } catch(_) {}
        } catch(_) {}

        root.style.setProperty('--theme-accent', accent);
        const chainLabel = document.getElementById('current-chain-label');
        if (chainLabel) {
            chainLabel.textContent = label;
            chainLabel.style.color = accent;
        }

        // Update document title and favicon based on mode
        try {
            // Cache default favicon once
            const fav = document.querySelector('link#favicon');
            if (fav && !window.DEFAULT_FAVICON_HREF) {
                window.DEFAULT_FAVICON_HREF = fav.getAttribute('href');
            }
            if (m.type === 'single') {
                const cfg = (window.CONFIG_CHAINS || {})[m.chain] || {};
                const nm = (cfg.Nama_Pendek || cfg.Nama_Chain || m.chain || 'CHAIN').toString().toUpperCase();
                document.title = `${nm} SCANNER`;
                if (fav) fav.setAttribute('href', cfg.ICON || window.DEFAULT_FAVICON_HREF || fav.getAttribute('href'));
            } else {
                document.title = 'ALL SCANNER';
                if (fav && window.DEFAULT_FAVICON_HREF) fav.setAttribute('href', window.DEFAULT_FAVICON_HREF);
            }
        } catch(_) {}

        // Inject or update a style tag for theme overrides
        let styleEl = document.getElementById('dynamic-theme-style');
        const css = `
          :root { --theme-accent: ${accent}; }
          /* Use accent header only in light mode */
          body.theme-single:not(.dark-mode) .uk-table:not(.wallet-cex-table) thead th,
          body.theme-multi:not(.dark-mode) .uk-table:not(.wallet-cex-table) thead th { background: var(--theme-accent) !important; }
          /* Dark-mode: force dark header for monitoring tables */
          body.dark-mode .uk-table thead th { background: #1c1c1e !important; color: #e8e8e8 !important; border-bottom: 1px solid #444 !important; }
          body.dark-mode #tabel-monitoring thead { background: #1c1c1e !important; }
          #progress-bar { background-color: var(--theme-accent) !important; }
          #progress-container { border: 1px solid var(--theme-accent) !important; }
          /* Cards and panels: keep token-management accent only; borders for #filter-card and #scanner-config unified in CSS */
          #token-management { border-color: var(--theme-accent) !important; }
          .uk-card.uk-card-default { border-color: var(--theme-accent); }
          /* Modal header accent */
          .uk-modal-header { border-bottom: 2px solid var(--theme-accent) !important; }
          /* Toggles */
          .toggle-radio.active { background-color: var(--theme-accent) !important; }
          #judul { color: #000; }
          /* Themed body background */
          body.theme-single { background: linear-gradient(180deg, var(--theme-accent) 0%, #ffffff 45%) !important; }
          body.theme-multi  { background: linear-gradient(180deg, #5c9514 0%, #ffffff 45%) !important; }
        `;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-theme-style';
            styleEl.type = 'text/css';
            styleEl.appendChild(document.createTextNode(css));
            document.head.appendChild(styleEl);
        } else {
            styleEl.textContent = css;
        }
    } catch (e) { /* debug logs removed */ }
}

/**
 * Creates a hyperlink with a hover title.
 * @param {string} url - The URL for the link.
 * @param {string} text - The visible text for the link.
 * @param {string} [className=''] - Optional CSS class.
 * @returns {string} HTML string for the anchor tag.
 */
function createHoverLink(url, text, className = '') {
    // Force link to inherit color from its parent (so chain accent colors apply)
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="hover-link ${className}" style="color:inherit;" title="${url}">${text}</a>`;
}

/**
 * Validates a URL, returning a fallback if invalid.
 * @param {string} u - The URL to validate.
 * @param {string} fallback - The fallback URL.
 * @returns {string} The original URL or the fallback.
 */
function safeUrl(u, fallback) {
    return (u && typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : fallback;
}

/**
 * Creates a styled link for deposit/withdraw status.
 * @param {boolean} flag - The status flag (true for active).
 * @param {string} label - The label text (e.g., 'DP', 'WD').
 * @param {string} urlOk - The URL to use if the status is active.
 * @param {string} [colorOk='green'] - The color for the active status.
 * @returns {string} HTML string for the status.
 */
function linkifyStatus(flag, label, urlOk, colorOk = 'green') {
    // Selalu pertahankan hyperlink bila URL tersedia; ubah hanya teks + warna
    const safe = (u) => (u && /^https?:\/\//i.test(u)) ? u : '#';
    let text, color, className;
    if (flag === true) {
        text = label; // WD, DP
        className = 'uk-text-success';
    } else if (flag === false) {
        text = (label === 'DP') ? 'DX' : 'WX'; // DX, WX
        className = 'uk-text-danger';
    } else {
        text = `?${label}`; // ?WD, ?DP
        className = 'uk-text-muted';
    }
    return `<a href="${safe(urlOk)}" target="_blank" rel="noopener noreferrer" class="uk-text-bold ${className}">${text}</a>`;
}

// refactor: remove getStatusLabel (tidak dipakai); gunakan linkifyStatus untuk status DP/WD.

/**
 * Converts a HEX color to an RGBA color.
 * @param {string} hex - The hex color string.
 * @param {number} alpha - The alpha transparency value.
 * @returns {string} The RGBA color string.
 */
// refactor: modernize to const
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Formats a price number into a display string with a '$' sign.
 * Handles small decimal numbers with a special format.
 * @param {number} price - The price to format.
 * @returns {string} The formatted price string.
 */
function formatPrice(price) {
    if (price >= 1) {
        return price.toFixed(3) + '$'; // Jika >= 1, tampilkan 2 angka desimal
    }

    let strPrice = price.toFixed(20).replace(/0+$/, ''); // Paksa format desimal, hapus nol di akhir
    let match = strPrice.match(/0\.(0*)(\d+)/); // Ambil nol setelah koma dan angka signifikan

    if (match) {
        let zeroCount = match[1].length; // Hitung jumlah nol setelah koma
        let significant = match[2].substring(0, 4); // Ambil 5 digit signifikan pertama

        // Jika angka signifikan kurang dari 5 digit, tambahkan nol di akhir
        significant = significant.padEnd(4, '0');

        if (zeroCount >= 2) {
            return `0.{${zeroCount}}${significant}$`; // Format dengan {N} jika nol >= 2
        } else {
            return `0.${match[1]}${significant}$`; // Format biasa jika nol < 2
        }
    }

    return price.toFixed(6) + '$'; // Fallback jika format tidak dikenali
}

// refactor: remove unused helper createLink (tidak dipakai)

/**
 * Generates various URLs for a given CEX and token pair.
 * @param {string} cex - The CEX name (e.g., 'GATE', 'BINANCE').
 * @param {string} NameToken - The base token symbol.
 * @param {string} NamePair - The quote token symbol.
 * @returns {object} An object containing different URL types (trade, withdraw, deposit).
 */
function GeturlExchanger(cex, NameToken, NamePair) { // REFACTORED
    if (window.CEX?.link && typeof CEX.link.buildAll === 'function') {
        return CEX.link.buildAll(cex, NameToken, NamePair);
    }
    const cfg = (window.CONFIG_CEX || {})[String(cex||'').toUpperCase()] || {};
    const L = cfg.LINKS || {};
    const T = String(NameToken||'').toUpperCase();
    const P = String(NamePair||'').toUpperCase();
    const build = (fn, args) => (typeof fn === 'function' ? fn(args) : null);
    const tradeToken = build(L.tradeToken, { cex, token: T, pair: P }) || '#';
    const tradePair  = build(L.tradePair,  { cex, token: T, pair: P }) || '#';
    const withdraw   = build(L.withdraw,   { cex, token: T, pair: P }) || '#';
    const deposit    = build(L.deposit,    { cex, token: T, pair: P }) || '#';
    return {
        tradeToken, tradePair,
        withdrawUrl: withdraw, depositUrl: deposit,
        withdrawTokenUrl: withdraw, depositTokenUrl: deposit,
        withdrawPairUrl: withdraw, depositPairUrl: deposit
    };
}

/**
 * Retrieves configuration data for a specific chain.
 * @param {string} chainName - The name of the chain (e.g., 'polygon').
 * @returns {object|null} The chain configuration object or null if not found.
 */
function getChainData(chainName) {
    if (!chainName) return null;
    
    const chainLower = chainName.toLowerCase();
    const chainData = CONFIG_CHAINS[chainLower];

    // Inline managed chains resolution (previously via getManagedChains)
    const settings = getFromLocalStorage('SETTING_SCANNER', {});
    const managedChains = (settings.AllChains || Object.keys(CONFIG_CHAINS)).map(x => String(x).toLowerCase());
    if (!managedChains.includes(chainLower)) {
        return null;
    }
    
    if (!chainData) {
        return null;
    }

    return {
        Kode_Chain: chainData.Kode_Chain || '',
        Nama_Chain: chainData.Nama_Chain || '',
        DEXS: chainData.DEXS || {},
        PAIRDExS: chainData.PAIRDExS || {},
        URL_Chain: chainData.URL_Chain || '',
        DATAJSON: chainData.DATAJSON || {},
        BaseFEEDEX: chainData.BaseFEEDEX || '',
        CEXCHAIN: chainData.WALLET_CEX || {},
        ICON_CHAIN: chainData.ICON || '',
        COLOR_CHAIN: chainData.WARNA || '#000',
        SHORT_NAME: chainData.Nama_Pendek || '',
        // RPC: Use RPCManager (auto fallback to default suggestions)
        RPC: (function() {
            try {
                if (typeof window !== 'undefined' && window.RPCManager && typeof window.RPCManager.getRPC === 'function') {
                    return window.RPCManager.getRPC(chainLower) || '';
                }
                return '';
            } catch(e) {
                return '';
            }
        })()
    };
}

function _normalizeChainLabel(s){
    return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
}

function resolveWalletChainBySynonym(walletInfo, chainKey, desiredLabel){
    if (!walletInfo || typeof walletInfo !== 'object') return null;
    const keys = Object.keys(walletInfo);
    if (!keys.length) return null;
    const normDesired = _normalizeChainLabel(desiredLabel||'');
    // direct exact (normalized) match first
    if (normDesired) {
        const hit = keys.find(k => _normalizeChainLabel(k) === normDesired);
        if (hit) return walletInfo[hit];
    }
    // synonym match by chainKey catalogue
    let cat = [];
    try {
        cat = ((typeof window !== 'undefined' && window.CHAIN_SYNONYMS) ? window.CHAIN_SYNONYMS : (typeof CHAIN_SYNONYMS !== 'undefined' ? CHAIN_SYNONYMS : {}))[ String(chainKey||'').toLowerCase() ] || [];
    } catch(_) { cat = []; }
    const candidates = new Set(cat.map(_normalizeChainLabel));
    candidates.add(_normalizeChainLabel(chainKey));
    // try any key that matches synonyms
    for (const k of keys) {
        const nk = _normalizeChainLabel(k);
        if (candidates.has(nk)) return walletInfo[k];
    }
    // loose contains match (e.g., BASEMAINNET contains BASE)
    for (const k of keys) {
        const nk = _normalizeChainLabel(k);
        for (const s of candidates) { if (nk.includes(s)) return walletInfo[k]; }
    }
    return null;
}

try {
    if (typeof window !== 'undefined') {
        window.resolveWalletChainBySynonym = window.resolveWalletChainBySynonym || resolveWalletChainBySynonym;
    }
} catch(_){}

// refactor: remove unused getCexDataConfig (tidak dipakai di alur aplikasi)

// refactor: remove unused getDexData (tidak dipakai di alur aplikasi)

/**
 * Flattens the token data from TOKEN_SCANNER, creating a separate entry for each selected CEX.
 * @param {Array} dataTokens - The array of token objects from storage.
 * @returns {Array} A flattened array of token objects, ready for scanning.
 */
function flattenDataKoin(dataTokens) {
  if (!Array.isArray(dataTokens)) {
    try { dataTokens = JSON.parse(dataTokens || '[]'); } catch { dataTokens = []; }
  }
  let flatResult = [];
  let counter = 1;

  // Note: Do not apply any FILTER_* logic here.
  // This function only flattens tokens → one row per selected CEX.
  // Filtering by chain/cex/pair is handled by callers (per mode).
  dataTokens.forEach(item => {
    if (!item || item.status === false) return;
    (item.selectedCexs || []).forEach(cex => {
      const cexUpper = String(cex).toUpperCase();
      const cexInfo = item.dataCexs?.[cexUpper] || {};
      // Normalize DEX keys to lowercase for consistency
      const dexArray = (item.selectedDexs || []).map(dex => {
        const dexLower = String(dex).toLowerCase();
        return {
          dex: dexLower,
          left: item.dataDexs?.[dex]?.left || item.dataDexs?.[dexLower]?.left || 0,
          right: item.dataDexs?.[dex]?.right || item.dataDexs?.[dexLower]?.right || 0
        };
      });

      flatResult.push({
        no: counter++,
        id: item.id,
        cex: cexUpper,
        feeWDToken: parseFloat(cexInfo.feeWDToken) || 0,
        feeWDPair:  parseFloat(cexInfo.feeWDPair)  || 0,
        depositToken: !!cexInfo.depositToken,
        withdrawToken: !!cexInfo.withdrawToken,
        depositPair: !!cexInfo.depositPair,
        withdrawPair: !!cexInfo.withdrawPair,
        chain: item.chain,
        symbol_in: item.symbol_in,
        sc_in: item.sc_in,
        des_in: item.des_in,
        symbol_out: item.symbol_out,
        sc_out: item.sc_out,
        des_out: item.des_out,
        status: item.status,
        dexs: dexArray
      });
    });
  });

  return flatResult;
}

/**
 * Generate consistent DEX cell ID for both skeleton and scanner
 * @param {Object} params - Parameters for ID generation
 * @param {string} params.cex - CEX name (e.g., 'BINANCE')
 * @param {string} params.dex - DEX name (e.g., 'paraswap')
 * @param {string} params.symbolIn - Input symbol (e.g., 'SAND')
 * @param {string} params.symbolOut - Output symbol (e.g., 'EDU')
 * @param {string} params.chain - Chain name (e.g., 'BSC')
 * @param {boolean} params.isLeft - True for LEFT side (TokentoPair), False for RIGHT (PairtoToken)
 * @param {string} params.tableBodyId - Table body ID prefix (e.g., 'dataTableBody')
 * @returns {string} Full cell ID
 */
function generateDexCellId({ cex, dex, symbolIn, symbolOut, chain, isLeft, tableBodyId = 'dataTableBody', tokenId = '' }) {
  const cexUpper = String(cex || '').toUpperCase();
  const dexUpper = String(dex || '').toLowerCase().toUpperCase(); // normalize
  const sym1 = isLeft ? String(symbolIn || '').toUpperCase() : String(symbolOut || '').toUpperCase();
  const sym2 = isLeft ? String(symbolOut || '').toUpperCase() : String(symbolIn || '').toUpperCase();
  const chainUpper = String(chain || '').toUpperCase();
  const tokenIdUpper = String(tokenId || '').toUpperCase();

  const baseIdRaw = tokenIdUpper
    ? `${cexUpper}_${dexUpper}_${sym1}_${sym2}_${chainUpper}_${tokenIdUpper}`
    : `${cexUpper}_${dexUpper}_${sym1}_${sym2}_${chainUpper}`;
  const baseId = baseIdRaw.replace(/[^A-Z0-9_]/g, '');
  return `${tableBodyId}_${baseId}`;
}

// Export to window
try {
  if (typeof window !== 'undefined') {
    window.generateDexCellId = generateDexCellId;
  }
} catch(_) {}

/**
 * Calculates the estimated swap fee in USD for a given chain.
 * @param {string} chainName - The name of the chain.
 * @returns {number} The estimated swap fee in USD.
 */
function getFeeSwap(chainName) {
    const allGasData = getFromLocalStorage("ALL_GAS_FEES");
    if (!allGasData) return 0;

    // cari data gas untuk chain yang sesuai
    const gasInfo = allGasData.find(g => g.chain.toLowerCase() === chainName.toLowerCase());
    if (!gasInfo) {
        // console.error(`❌ Gas data not found for chain: ${chainName}`);
        return 0;
    }

    // ambil GASLIMIT dari CONFIG_CHAINS
    const chainConfig = CONFIG_CHAINS[chainName.toLowerCase()];
    if (!chainConfig) {
        // console.error(`❌ Chain config not found for: ${chainName}`);
        return 0;
    }

    const gasLimit = parseFloat(chainConfig.GASLIMIT || 250000); // default kalau tidak ada
    const feeSwap = ((parseFloat(gasInfo.gwei) * gasLimit) / Math.pow(10, 9)) * parseFloat(gasInfo.tokenPrice);

    return feeSwap;
}

// =================================================================================
// PRICE HELPERS (USD conversion for DEX display)
// =================================================================================
function getStableSymbols(){
    return ['USDT','USDC','DAI','FDUSD','TUSD','BUSD','USDE'];
}

function getBaseTokenSymbol(chainName){
    try {
        const cfg = (window.CONFIG_CHAINS||{})[String(chainName).toLowerCase()] || {};
        const sym = String((cfg.BaseFEEDEX||'').replace('USDT','')||'');
        return sym.toUpperCase();
    } catch(_) { return ''; }
}

function getBaseTokenUSD(chainName){
    try {
        const list = getFromLocalStorage('ALL_GAS_FEES', []) || [];
        const key = (window.CONFIG_CHAINS?.[String(chainName).toLowerCase()]?.Nama_Chain) || chainName;
        const hit = (list||[]).find(e => String(e.chain||'').toLowerCase() === String(key).toLowerCase());
        const price = parseFloat(hit?.tokenPrice);
        return isFinite(price) && price > 0 ? price : 0;
    } catch(_) { return 0; }
}

try {
    if (typeof window !== 'undefined') {
        window.getStableSymbols = window.getStableSymbols || getStableSymbols;
        window.getBaseTokenSymbol = window.getBaseTokenSymbol || getBaseTokenSymbol;
        window.getBaseTokenUSD = window.getBaseTokenUSD || getBaseTokenUSD;
        // refactor: provide a small shared helper for dark mode checks
        window.isDarkMode = window.isDarkMode || function isDarkMode(){
            try { return !!(document && document.body && document.body.classList && document.body.classList.contains('dark-mode')); }
            catch(_) { return false; }
        };
        // Resolve active DEX list based on mode + saved filters; fallback to config defaults
        window.resolveActiveDexList = window.resolveActiveDexList || function resolveActiveDexList(){
            try {
                const m = getAppMode();
                if (m.type === 'single') {
                    const chain = String(m.chain).toLowerCase();
                    const saved = getFilterChain(chain) || { dex: [] };
                    const base = ((window.CONFIG_CHAINS || {})[chain] || {}).DEXS || [];
                    const list = (Array.isArray(saved.dex) && saved.dex.length) ? saved.dex : base;
                    return (list || []).map(x => String(x).toLowerCase());
                } else {
                    const saved = getFilterMulti() || { dex: [] };
                    const base = Object.keys(window.CONFIG_DEXS || {});
                    const list = (Array.isArray(saved.dex) && saved.dex.length) ? saved.dex : base;
                    return (list || []).map(x => String(x).toLowerCase());
                }
            } catch(_) { return Object.keys(window.CONFIG_DEXS || {}).map(x => String(x).toLowerCase()); }
        };
    }
} catch(_){}

/**
 * Generates a direct trade link for a given DEX.
 * @param {string} dex - The DEX name.
 * @param {string} chainName - The chain name.
 * @param {number} codeChain - The chain ID.
 * @param {string} NameToken - The input token symbol.
 * @param {string} sc_input - The input token contract address.
 * @param {string} NamePair - The output token symbol.
 * @param {string} sc_output - The output token contract address.
 * @returns {string|null} The DEX trade URL or null if not supported.
 */
function getWarnaCEX(cex) {
    if (!cex || typeof cex !== 'string') {
        return 'black';
    }
    try {
        const upperCex = cex.toUpperCase();
        if (CONFIG_CEX && CONFIG_CEX[upperCex] && CONFIG_CEX[upperCex].WARNA) {
            return CONFIG_CEX[upperCex].WARNA;
        }
        return 'black'; // Warna default
    } catch (error) {
        // console.error('Error dalam getWarnaCEX:', error);
        return 'black';
    }
}

function generateDexLink(dex, chainName, codeChain, NameToken, sc_input, NamePair, sc_output) {
    if (!dex) return null;

    const lowerDex = dex.toLowerCase();

    // Find the correct DEX configuration key by checking if the input 'dex' string includes it.
    // This handles cases like "kyber" and "kyber via LIFI".
    let dexKey = Object.keys(CONFIG_DEXS).find(key => lowerDex.includes(key));
    // Backward compatibility: map legacy/alias names to new keys
    if (!dexKey) {
        // Normalize known brand/alias names to canonical CONFIG_DEXS keys
        // e.g. 'kyberswap' -> 'kyber', 'flytrade' -> 'fly'
        const synonyms = { kyberswap: 'kyber', flytrade: 'fly' };
        const found = Object.keys(synonyms).find(oldKey => lowerDex.includes(oldKey));
        if (found && CONFIG_DEXS[synonyms[found]]) dexKey = synonyms[found];
    }

    if (dexKey && CONFIG_DEXS[dexKey] && typeof CONFIG_DEXS[dexKey].builder === 'function') {
        const builder = CONFIG_DEXS[dexKey].builder;
        return builder({
            chainName: chainName,
            // Provide both to satisfy different builder signatures
            codeChain: codeChain,    // some builders expect codeChain
            chainCode: codeChain,    // others used chainCode
            tokenAddress: sc_input,
            pairAddress: sc_output,
            NameToken: NameToken,
            NamePair: NamePair
        });
    }

    return null; // Return null if no matching DEX config is found
}

function convertIDRtoUSDT(idrAmount) {
    const rateUSDT = getFromLocalStorage("PRICE_RATE_USDT", 0);
    if (!rateUSDT || rateUSDT === 0) return 0;
    return parseFloat((idrAmount / rateUSDT).toFixed(8));
}

// Convert USDT amount to IDR number using cached rate
function convertUSDTtoIDR(usdtAmount) {
    const rateUSDT = parseFloat(getFromLocalStorage("PRICE_RATE_USDT", 0)) || 0;
    const v = parseFloat(usdtAmount) || 0;
    return rateUSDT > 0 ? v * rateUSDT : 0;
}

// Format IDR currency string from USDT amount
function formatIDRfromUSDT(usdtAmount) {
    const idr = convertUSDTtoIDR(usdtAmount);
    return idr > 0 ? idr.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : 'N/A';
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// =============================================================
// RPC HELPER - Get RPC with custom override support
// =============================================================

/**
 * Get RPC URL untuk chain tertentu dengan support custom RPC dari SETTING_SCANNER
 * @param {string} chainKey - Chain key (bsc, polygon, ethereum, dll)
 * @returns {string} RPC URL
 */
function getRPC(chainKey) {
    try {
        const chainLower = String(chainKey || '').toLowerCase();

        // 1. Check custom RPC dari SETTING_SCANNER
        const settings = (typeof getFromLocalStorage === 'function')
            ? getFromLocalStorage('SETTING_SCANNER', {})
            : {};

        if (settings.customRPCs && settings.customRPCs[chainLower]) {
            return settings.customRPCs[chainLower];
        }

        // 2. Fallback ke CONFIG_CHAINS
        const chainConfig = (typeof CONFIG_CHAINS !== 'undefined' && CONFIG_CHAINS[chainLower])
            ? CONFIG_CHAINS[chainLower]
            : null;

        if (chainConfig && chainConfig.RPC) {
            return chainConfig.RPC;
        }

        // 3. Fallback terakhir: empty string
        return '';
    } catch(err) {
        // console.error('[getRPC] Error:', err);
        return '';
    }
}

// Expose globally
if (typeof window !== 'undefined') {
    window.getRPC = getRPC;
}

// =============================================================
// UI GATING WHILE SCANNING
// Disable most interactions while scan is running; allow Reload + Theme
// =============================================================
function setScanUIGating(isRunning) {
    try {
        const $allToolbar = $('.header-card a, .header-card .icon');
        const mode = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
        const isSingle = String(mode.type||'').toLowerCase() === 'single';
        if (isRunning) {
            // Dim and disable all toolbar actions
            $allToolbar.css({ pointerEvents: 'none', opacity: 0.4 });
            // Allow only reload (dark mode toggle ikut dinonaktifkan saat scan)
            $('#reload').css({ pointerEvents: 'auto', opacity: 1 });
            // Allow chain selection icons remain active during scan (including their img.icon children)
            $('#chain-links-container a, #chain-links-container .chain-link, #chain-links-container .icon, #multichain_scanner, #multichain_scanner .icon')
                .css({ pointerEvents: 'auto', opacity: 1 });
            // Disable scanner config controls and filter card inputs
            $('#scanner-config').find('input, select, button, textarea').not('#btn-scroll-top').prop('disabled', true);
            $('#filter-card').find('input, select, button, textarea').not('#btn-scroll-top').prop('disabled', true);
            // Keep Auto Scroll checkbox enabled and clickable during scanning
            $('#autoScrollCheckbox').prop('disabled', false).css({ pointerEvents: 'auto', opacity: 1 });
            // Some extra clickable items in page (keep chain links enabled)
            if (isSingle) {
                // Per-chain: keep edit icon active so user can edit during scan
                $('.sort-toggle').css({ pointerEvents: 'none', opacity: 0.4 });
                $('.edit-token-button').css({ pointerEvents: 'auto', opacity: 1 });
            } else {
                $('.sort-toggle, .edit-token-button').css({ pointerEvents: 'none', opacity: 0.4 });
            }
            // Keep delete buttons active during scanning as requested
            $('.delete-token-button').css({ pointerEvents: 'auto', opacity: 1 });
            // Lock token management during scan; Edit modal behavior depends on mode
            $('#token-management').find('input, select, button, textarea').prop('disabled', true).css({ pointerEvents: 'none', opacity: 0.6 });
            if (isSingle) {
                // Per-chain: keep all inputs active in Edit modal, and show only Import + Cancel buttons
                const $modal = $('#FormEditKoinModal');
                $modal.find('input, select, button, textarea').prop('disabled', false).css({ pointerEvents: 'auto', opacity: '' });
                // Buttons: only Import (CopyToMultiBtn) and Cancel (BatalEditkoin)
                $('#HapusEditkoin').hide().prop('disabled', true);
                $('#SaveEditkoin').hide().prop('disabled', true);
                $('#CopyToMultiBtn').show().prop('disabled', false);
                $('#BatalEditkoin').show().prop('disabled', false);
            } else {
                // Multi-chain: disable edit modal
                $('#FormEditKoinModal').find('input, select, button, textarea').prop('disabled', true).css({ pointerEvents: 'none', opacity: 0.6 });
            }
            // Keep STOP button usable during running
            $('#stopSCAN').prop('disabled', false).show();
            // Keep RELOAD usable (already via toolbar allow-list), disable START explicitly
            $('#startSCAN').prop('disabled', true);
        } else {
            // Re-enable toolbar
            $allToolbar.css({ pointerEvents: '', opacity: '' });
            // Reset controls (actual availability will be enforced by applyControlsFor)
            $('#scanner-config').find('input, select, button, textarea').prop('disabled', false);
            $('#filter-card').find('input, select, button, textarea').prop('disabled', false);
            $('.sort-toggle, .edit-token-button, #chain-links-container a').css({ pointerEvents: '', opacity: '' });
            $('.delete-token-button').css({ pointerEvents: '', opacity: '' });
            $('#token-management, #FormEditKoinModal').find('input, select, button, textarea').prop('disabled', false).css({ pointerEvents: '', opacity: '' });
            // Restore full button set visibility in edit modal
            $('#HapusEditkoin, #SaveEditkoin').show().prop('disabled', false);
            $('#CopyToMultiBtn').show();
            $('#BatalEditkoin').show();
            // Ensure Auto Scroll remains interactive when idle too
            $('#autoScrollCheckbox').prop('disabled', false).css({ pointerEvents: 'auto', opacity: '' });
        }
    } catch (_) { /* noop */ }
}

// Optional namespacing for future modular use
try {
    if (window.App && typeof window.App.register === 'function') {
        window.App.register('Utils', {
            getAppMode,
            getActiveTokenKey,
            getActiveFilterKey,
            getActiveTokens,
            saveActiveTokens,
            getActiveFilters,
            saveActiveFilters,
            getPNLFilter,
            setPNLFilter,
            getFilterMulti,
            setFilterMulti,
            getFilterChain,
            setFilterChain,
            getTokensMulti,
            setTokensMulti,
            getTokensChain,
            setTokensChain,
            getFeatureReadiness,
            applyThemeForMode,
            createHoverLink,
            safeUrl,
            linkifyStatus,
            hexToRgba,
            flattenDataKoin,
            getFeeSwap,
            getWarnaCEX,
            generateDexLink,
            convertIDRtoUSDT,
            debounce,
            getRPC,  // RPC helper with custom override
            setScanUIGating,
            // Global Scan Lock
            getGlobalScanLock,
            setGlobalScanLock,
            clearGlobalScanLock,
            checkCanStartScan
        });
    }
} catch(_) {}

// =================================================================================
// MAIN APPLICATION LOGIC AND EVENT LISTENERS
// =================================================================================

// --- Global Variables ---
const MAIN_APP_META = (function(){
    try {
        return (typeof window !== 'undefined' && window.CONFIG_APP && window.CONFIG_APP.APP) ? window.CONFIG_APP.APP : {};
    } catch(_) { return {}; }
})();
const MAIN_APP_NAME = MAIN_APP_META.NAME || 'MULTIALL-PLUS';
const MAIN_APP_NAME_SAFE = (function(name){
    try {
        const safe = String(name || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
        return safe ? safe.toUpperCase() : 'APP';
    } catch(_) { return 'APP'; }
})(MAIN_APP_NAME);
const PRIMARY_DB_NAME = (function(){
    try {
        if (typeof window !== 'undefined' && window.CONFIG_DB && window.CONFIG_DB.NAME) return window.CONFIG_DB.NAME;
    } catch(_) {}
    return MAIN_APP_NAME;
})();
const PRIMARY_KV_STORE = (function(){
    try {
        if (typeof window !== 'undefined' && window.CONFIG_DB && window.CONFIG_DB.STORES && window.CONFIG_DB.STORES.KV) {
            return window.CONFIG_DB.STORES.KV;
        }
    } catch(_) {}
    return 'APP_KV_STORE';
})();

const storagePrefix = MAIN_APP_NAME_SAFE ? `${MAIN_APP_NAME_SAFE}_` : '';
const REQUIRED_KEYS = {
    SETTINGS: 'SETTING_SCANNER'
};

let sortOrder = {};
let filteredTokens = [];
let originalTokens = [];
var SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});
let activeSingleChainKey = null; // Active chain key (single mode)

// Log scan limit configuration on load
(function logScanLimitStatus(){
    try {
        const scanLimitEnabled = typeof window !== 'undefined'
            && window.CONFIG_APP
            && window.CONFIG_APP.APP
            && window.CONFIG_APP.APP.SCAN_LIMIT === true;

        if (scanLimitEnabled) {
            // console.log('%c[SCAN LIMIT] ⚠️ ENABLED - Only ONE scan allowed at a time', 'color: #FF9800; font-weight: bold; background: #FFF3E0; padding: 4px 8px; border-left: 4px solid #FF9800;');
        } else {
            // console.log('%c[SCAN LIMIT] ✓ DISABLED - Multiple scans allowed (parallel scanning enabled)', 'color: #4CAF50; font-weight: bold; background: #E8F5E9; padding: 4px 8px; border-left: 4px solid #4CAF50;');
        }
    } catch(e) {
        // console.warn('[SCAN LIMIT] Could not determine scan limit status:', e);
    }
})();

// Apply app branding (title/header) based on CONFIG_APP metadata.
(function applyAppBranding(){
    try {
        if (typeof document === 'undefined') return;
        const name = MAIN_APP_NAME;
        const version = MAIN_APP_META.VERSION ? String(MAIN_APP_META.VERSION) : '';
        const headerEl = document.getElementById('app-title');
        if (headerEl) headerEl.textContent = version ? `${name} v${version}` : name;
        try { document.title = version ? `${name} v${version}` : name; } catch(_) {}
        const infoEl = document.getElementById('infoAPP');
        if (infoEl) {
            const current = String(infoEl.textContent || '').trim();
            if (!current || current === '???') {
                infoEl.textContent = version ? `v${version}` : name;
            }
        }
    } catch(_) {}
})();

// refactor: Toastr is centrally configured in js/notify-shim.js

// --- Application Initialization ---

// Per-mode app state is merged into FILTER_<CHAIN> / FILTER_MULTICHAIN
// Fields: { run: 'YES'|'NO', darkMode: boolean, sort: 'A'|'Z', pnl: number, ... }
function getAppState() {
    try {
        const key = (typeof getActiveFilterKey === 'function') ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
        const f = getFromLocalStorage(key, {}) || {};
        return {
            run: (f.run || 'NO'),
            darkMode: !!f.darkMode,
            lastChain: f.lastChain
        };
    } catch(_) { return { run: 'NO', darkMode: false }; }
}
function setAppState(patch) {
    try {
        const key = (typeof getActiveFilterKey === 'function') ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
        const cur = getFromLocalStorage(key, {}) || {};
        const next = Object.assign({}, cur, patch || {});
        saveToLocalStorage(key, next);
        return next;
    } catch(_) { return patch || {}; }
}

// Floating scroll-to-top button for monitoring table (robust across browsers)
(function initScrollTopButton(){
    function bindScrollTop() {
        try {
            const btn = document.getElementById('btn-scroll-top');
            if (!btn) return;
            // Ensure the button is enabled and avoid duplicate bindings
            try { btn.disabled = false; btn.style.pointerEvents = ''; btn.style.opacity = ''; } catch(_){}
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';

            function isVisible(el){
                if (!el) return false;
                const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
                const displayOK = !style || style.display !== 'none';
                const visibleOK = !style || style.visibility !== 'hidden' && style.opacity !== '0';
                const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width:1, height:1 };
                const sizeOK = (rect.width > 0 && rect.height > 0);
                return displayOK && visibleOK && sizeOK;
            }

            function findScrollableContainer(){
                // Unified table scroll container
                const mon = document.getElementById('monitoring-scroll');
                if (mon && isVisible(mon) && mon.scrollHeight > mon.clientHeight) return mon;
                return null;
            }

            btn.addEventListener('click', function(){
                try {
                    const container = findScrollableContainer();
                    const useContainer = !!container;

                    if (useContainer) {
                        if (typeof $ === 'function') {
                            $(container).stop(true).animate({ scrollTop: 0 }, 250);
                        } else if (typeof container.scrollTo === 'function') {
                            container.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                        } else {
                            container.scrollTop = 0;
                        }
                    } else {
                        if (typeof $ === 'function') {
                            $('html, body').stop(true).animate({ scrollTop: 0 }, 250);
                        } else if (typeof window.scrollTo === 'function') {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            try { document.documentElement.scrollTop = 0; } catch(_){}
                            try { document.body.scrollTop = 0; } catch(_){}
                        } else {
                            try { document.documentElement.scrollTop = 0; } catch(_){}
                            try { document.body.scrollTop = 0; } catch(_){}
                        }
                    }
                } catch(_) {}
            });
        } catch(_) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindScrollTop);
        window.addEventListener('load', bindScrollTop);
    } else {
        // DOM is already ready; bind immediately
        bindScrollTop();
        // Also attach as a fallback in case of late reflows
        setTimeout(bindScrollTop, 0);
    }
})();

// Smooth scroll chaining: when monitoring table reaches its scroll limits,
// allow the page to continue scrolling (so user can reach signal cards above).
(function enableMonitoringScrollChaining(){
    function bindChain(){
        try {
            const el = document.getElementById('monitoring-scroll');
            if (!el) return;
            if (el.dataset._chainBound === '1') return; // avoid duplicate bindings
            el.dataset._chainBound = '1';

            // Wheel (mouse/trackpad)
            el.addEventListener('wheel', function(e){
                try {
                    // Only intervene when the container cannot scroll further
                    const delta = e.deltaY;
                    const atTop = (el.scrollTop <= 0);
                    const atBottom = (el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
                    if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
                        e.preventDefault();
                        // Scroll the page/body instead
                        if (typeof window.scrollBy === 'function') window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
                        else {
                            try { document.documentElement.scrollTop += delta; } catch(_) {}
                            try { document.body.scrollTop += delta; } catch(_) {}
                        }
                    }
                } catch(_) {}
            }, { passive: false });

            // Touch (mobile)
            let lastY = null;
            el.addEventListener('touchstart', function(ev){
                try { lastY = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : null; } catch(_) { lastY = null; }
            }, { passive: true });
            el.addEventListener('touchmove', function(ev){
                try {
                    if (lastY == null) return;
                    const y = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : lastY;
                    const delta = lastY - y; // positive = scroll down
                    const atTop = (el.scrollTop <= 0);
                    const atBottom = (el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
                    if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
                        ev.preventDefault();
                        if (typeof window.scrollBy === 'function') window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
                        else {
                            try { document.documentElement.scrollTop += delta; } catch(_) {}
                            try { document.body.scrollTop += delta; } catch(_) {}
                        }
                    }
                    lastY = y;
                } catch(_) {}
            }, { passive: false });
        } catch(_) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindChain);
        window.addEventListener('load', bindChain);
    } else {
        bindChain();
        setTimeout(bindChain, 0);
    }
})();

// Storage helpers moved to utils.js for modular use across app.

/**
 * Refreshes the main token table from localStorage data.
 */
function attachEditButtonListeners() {
    // Edit handler is delegated globally; no direct binding here.
    // This avoids missing handlers after dynamic rerenders and prevents duplicates.

    // Delete token handler is delegated globally (see click.globalDelete).
    // No direct binding here to avoid duplicate confirmations.
}

// Also bind a delegated delete handler to be resilient during scanning and rerenders
$(document).off('click.globalDelete').on('click.globalDelete', '.delete-token-button', function(){
    try {
        const $el = $(this);
        const id = String($el.data('id'));
        if (!id) return;
        const symIn  = String($el.data('symbol-in')  || '').toUpperCase();
        const symOut = String($el.data('symbol-out') || '').toUpperCase();
        const chain  = String($el.data('chain')      || '').toUpperCase();
        const cex    = String($el.data('cex')        || '').toUpperCase();
        const detail = `• Token: ${symIn||'-'}/${symOut||'-'}\n• Chain: ${chain||'-'}\n• CEX: ${cex||'-'}`;
        const ok = confirm(`🗑️ Hapus Koin Ini?\n\n${detail}\n\n⚠️ Tindakan ini tidak dapat dibatalkan. Lanjutkan?`);
        if (!ok) return;

        const mode = getAppMode();
        if (mode.type === 'single') {
            let list = getTokensChain(mode.chain);
            const before = list.length;
            list = list.filter(t => String(t.id) !== id);
            setTokensChain(mode.chain, list);
            if (list.length < before) {
                try { setLastAction('HAPUS KOIN'); } catch(_) {}
                if (typeof toast !== 'undefined' && toast.info) toast.info(`PROSES HAPUS KOIN ${symIn} VS ${symOut} BERHASIL`);
            }
            try { $el.closest('tr').addClass('row-hidden'); } catch(_) {}
        } else {
            let list = getTokensMulti();
            const before = list.length;
            list = list.filter(t => String(t.id) !== id);
            setTokensMulti(list);
            if (list.length < before) {
                try { setLastAction('HAPUS KOIN'); } catch(_) {}
                if (typeof toast !== 'undefined' && toast.info) toast.info(`PROSES HAPUS KOIN ${symIn} VS ${symOut} BERHASIL`);
            }
            try { $el.closest('tr').addClass('row-hidden'); } catch(_) {}
        }
    } catch(e) { console.error('Delete error:', e); if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal menghapus koin'); }
});

// Also bind a delegated edit handler so newly rendered rows always work
$(document).off('click.globalEdit').on('click.globalEdit', '.edit-token-button', function(){
    try {
        const id = String($(this).data('id') || '');
        if (!id) { if (typeof toast !== 'undefined' && toast.error) toast.error('ID token tidak ditemukan'); return; }
        if (typeof openEditModalById === 'function') openEditModalById(id);
        else if (typeof toast !== 'undefined' && toast.error) toast.error('Fungsi edit tidak tersedia');
    } catch (e) {
        // console.error('Gagal membuka modal edit:', e);
        if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal membuka form edit');
    }
});

function refreshTokensTable() {
    const storedFilter = getFromLocalStorage('FILTER_MULTICHAIN', null);
    const filtersActive = storedFilter !== null; // null = first load

    const fm = getFilterMulti();
    const chainsSel = (fm.chains || []).map(c => String(c).toLowerCase());
    const cexSel = (fm.cex || []).map(c => String(c).toUpperCase());
    const dexSel = (fm.dex || []).map(d => String(d).toLowerCase());

    // Ambil data ter-flatten dan terurut dari IndexedDB berdasarkan symbol_in (ASC/DESC)
    let flatTokens = (typeof getFlattenedSortedMulti === 'function') ? getFlattenedSortedMulti() : flattenDataKoin(getTokensMulti());

    let filteredByChain = [];
    if (!filtersActive) {
        // First load (no saved FILTER_MULTICHAIN): show all
        filteredByChain = flatTokens;
    } else if (chainsSel.length > 0 && cexSel.length > 0 && dexSel.length > 0) {
        // Combined filter: require both CHAIN and CEX selections
        filteredByChain = flatTokens
            .filter(t => chainsSel.includes(String(t.chain || '').toLowerCase()))
            .filter(t => cexSel.includes(String(t.cex || '').toUpperCase()))
            .filter(t => (t.dexs||[]).some(d => dexSel.includes(String(d.dex||'').toLowerCase())));
    } else {
        // One or both groups empty → show none
        filteredByChain = [];
    }

    // Tidak perlu sort ulang di sini; sumber sudah sorted berdasarkan preferensi

    filteredTokens = [...filteredByChain];
    originalTokens = [...filteredByChain];
    loadKointoTable(filteredTokens, 'dataTableBody');
    try { window.currentListOrderMulti = Array.isArray(filteredTokens) ? [...filteredTokens] : []; } catch(_) {}
    try { applySortToggleState(); } catch(_) {}
    attachEditButtonListeners(); // Re-attach listeners after table render
}

/**
 * Loads and displays the saved tokens for the currently active single chain.
 */
function loadAndDisplaySingleChainTokens() {
    if (!activeSingleChainKey) return;
    // Prefer new key; fallback to old if present (one-time migration semantics)
    let tokens = getTokensChain(activeSingleChainKey);

    // Ambil data ter-flatten dan terurut dari IDB
    let flatTokens = (typeof getFlattenedSortedChain === 'function') ? getFlattenedSortedChain(activeSingleChainKey) : flattenDataKoin(tokens);

    // Apply single-chain filters: CEX, PAIR (persisted in unified settings, fallback legacy)
    try {
        const rawSaved = getFromLocalStorage(`FILTER_${String(activeSingleChainKey).toUpperCase()}`, null);
        const filters = getFilterChain(activeSingleChainKey);
        const selCex = (filters.cex || []).map(x=>String(x).toUpperCase());
        const selPair = (filters.pair || []).map(x=>String(x).toUpperCase());
        const selDex = (filters.dex || []).map(x=>String(x).toLowerCase());

        // Combined filter: if no saved filters yet → show all; otherwise require CEX, PAIR and DEX
        if (!rawSaved) {
            // keep all
        } else if (selCex.length > 0 && selPair.length > 0 && selDex.length > 0) {
            flatTokens = flatTokens.filter(t => selCex.includes(String(t.cex).toUpperCase()));
            flatTokens = flatTokens.filter(t => {
                const chainCfg = CONFIG_CHAINS[(t.chain||'').toLowerCase()]||{};
                const pairDefs = chainCfg.PAIRDEXS||{};
                const p = String(t.symbol_out||'').toUpperCase();
                const mapped = pairDefs[p]?p:'NON';
                return selPair.includes(mapped);
            });
            flatTokens = flatTokens.filter(t => (t.dexs||[]).some(d => selDex.includes(String(d.dex||'').toLowerCase())));
        } else {
            flatTokens = [];
        }
        // Tidak perlu sort ulang; sudah terurut dari sumber
    } catch(e) { /* debug logs removed */ }

    // Expose current list for search-aware scanning (keep sorted order)
    try { window.singleChainTokensCurrent = Array.isArray(flatTokens) ? [...flatTokens] : []; } catch(_){}
    loadKointoTable(flatTokens, 'dataTableBody');
    try { applySortToggleState(); } catch(_) {}
    attachEditButtonListeners(); // Re-attach listeners after table render
}


/**
 * Checks if essential settings and token data are present in storage.
 * @returns {string} The readiness state of the application.
 */
function computeAppReadiness() {
    const okS = hasValidSettings();
    const okT = hasValidTokens();
    if (okS && okT) return 'READY';
    if (!okS && !okT) return 'MISSING_BOTH';
    return okS ? 'MISSING_TOKENS' : 'MISSING_SETTINGS';
}

/**
 * Checks if settings are valid.
 * @returns {boolean}
 */
function hasValidSettings() {
    const s = getFromLocalStorage(REQUIRED_KEYS.SETTINGS, {});
    return s && typeof s === 'object' && Object.keys(s).length > 0;
}

/**
 * Checks if token data is valid.
 * @returns {boolean}
 */
function hasValidTokens() {
    const m = getAppMode();
    if (m && m.type === 'single') {
        const t = getTokensChain(m.chain);
        return Array.isArray(t) && t.length > 0;
    } else {
        const t = getTokensMulti();
        return Array.isArray(t) && t.length > 0;
    }
}

/**
 * Renders the Settings form: generates CEX/DEX delay inputs and API key fields,
 * and preloads saved values from storage.
 */
function renderSettingsForm() {
    // Generate DEX delay inputs with colors
    const dexList = Object.keys(CONFIG_DEXS || {}).sort();
    let dexDelayHtml = '';
    dexList.forEach(dex => {
        const dexConfig = CONFIG_DEXS[dex] || {};
        const dexLabel = (dexConfig.label || dex).toUpperCase();  // ✅ UPPERCASE semua
        const dexColor = dexConfig.warna || '#333';

        dexDelayHtml += `
            <div class="uk-card uk-card-small uk-card-default uk-margin-small-bottom" style="border-left: 4px solid ${dexColor};">
                <div class="uk-card-body uk-padding-small">
                    <div class="uk-flex uk-flex-between uk-flex-middle">
                        <label class="uk-text-bold uk-margin-remove" style="color: ${dexColor}; font-size: 13px;">
                            ${dexLabel}
                        </label>
                        <div class="uk-flex uk-flex-middle" style="gap: 4px;">
                            <input type="number" class="uk-input uk-form-small dex-delay-input"
                                   data-dex="${dex}"
                                   value="100"
                                   style="width:70px; text-align:center; border-color: ${dexColor}40;"
                                   min="0">
                            <span class="uk-text-meta uk-text-small">ms</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    $('#dex-delay-group').html(dexDelayHtml);

    // Load existing settings
    const appSettings = getFromLocalStorage('SETTING_SCANNER') || {};
        $('#user').val(appSettings.nickname || '');
        $('#jeda-time-group').val(appSettings.jedaTimeGroup || 2000);
        $('#jeda-koin').val(appSettings.jedaKoin || 500);
        $('#walletMeta').val(appSettings.walletMeta || '');
    $(`input[name=\"koin-group\"][value=\"${appSettings.scanPerKoin || 5}\"]`).prop('checked', true);
    $(`input[name=\"waktu-tunggu\"][value=\"${appSettings.speedScan || 2}\"]`).prop('checked', true);

    // Apply saved DEX delay values (CEX delay removed)
    const modalDexs = appSettings.JedaDexs || {};
    $('.dex-delay-input').each(function() {
        const dex = $(this).data('dex');
        if (modalDexs[dex] !== undefined) $(this).val(modalDexs[dex]);
    });

    // Generate RPC settings inputs with chain colors (compact horizontal layout)
    const chainList = Object.keys(CONFIG_CHAINS || {}).sort();
    // Get initial RPC values from database migrator (not hardcoded anymore)
    const getInitialRPC = (chain) => {
        if (window.RPCDatabaseMigrator && window.RPCDatabaseMigrator.INITIAL_RPC_VALUES) {
            return window.RPCDatabaseMigrator.INITIAL_RPC_VALUES[chain] || '';
        }
        return '';
    };
    let rpcHtml = '';

    chainList.forEach(chain => {
        const cfg = CONFIG_CHAINS[chain];
        const suggestedRpc = getInitialRPC(chain);
        const chainLabel = (cfg.Nama_Chain || chain).toUpperCase();
        const chainColor = cfg.WARNA || '#333';
        const chainIcon = cfg.ICON || '';

        rpcHtml += `
            <div class="uk-margin-small-bottom" style="border-left: 3px solid ${chainColor}; padding-left: 8px; padding-top: 4px; padding-bottom: 4px; background: ${chainColor}08;">
                <div class="uk-grid-small uk-flex-middle" uk-grid>
                    <div class="uk-width-auto">
                        <div class="uk-flex uk-flex-middle">
                            ${chainIcon ? `<img src="${chainIcon}" alt="${chainLabel}" style="width:16px; height:16px; margin-right:6px; border-radius:50%;">` : ''}
                            <label class="uk-text-bold uk-margin-remove" style="color: ${chainColor}; font-size: 13px; min-width: 90px;">
                                ${chainLabel}
                            </label>
                        </div>
                    </div>
                    <div class="uk-width-expand">
                        <input type="text" class="uk-input uk-form-small rpc-input"
                               data-chain="${chain}"
                               placeholder="${suggestedRpc}"
                               value=""
                               style="font-size:12px; font-family: monospace; border-color: ${chainColor}40; padding: 4px 8px; height: 28px;">
                        <small class="uk-text-muted" style="font-size: 10px;">Default: ${suggestedRpc || 'N/A'}</small>
                    </div>
                </div>
            </div>
        `;
    });
    $('#rpc-settings-group').html(rpcHtml);

    // Load user RPCs dari setting (jika ada), atau auto-fill dengan default
    const userRPCs = appSettings.userRPCs || {};
    $('.rpc-input').each(function() {
        const chain = $(this).data('chain');
        if (userRPCs[chain]) {
            // User sudah punya custom RPC
            $(this).val(userRPCs[chain]);
        } else {
            // Auto-fill dengan default suggestion untuk kemudahan user
            const initialRPC = getInitialRPC(chain);
            if (initialRPC) $(this).val(initialRPC);
        }
    });

}

/**
 * Initializes the application on DOM content load.
 * Sets up controls based on readiness state.
 */
function bootApp() {
    // One-time migration: remove deprecated CEX delay settings from storage
    try {
        const s = getFromLocalStorage('SETTING_SCANNER', {});
        if (s && typeof s === 'object' && s.JedaCexs) {
            delete s.JedaCexs;
            saveToLocalStorage('SETTING_SCANNER', s);
        }
    } catch(_) {}
    const state = computeAppReadiness();
    // REFACTORED
    if (typeof applyThemeForMode === 'function') applyThemeForMode();
    applyControlsFor(state);
    // Show settings section automatically if settings are missing (including MISSING_BOTH)
    const settingsMissing = !hasValidSettings();
    if (settingsMissing) {
        // Populate settings form when auto-shown and ensure it's enabled
        // REFACTORED
        if (typeof renderSettingsForm === 'function') renderSettingsForm();
        $('#form-setting-app').show();
        $('#filter-card, #scanner-config, #token-management, #iframe-container').hide();
        try {
            if (window.SnapshotModule && typeof window.SnapshotModule.hide === 'function') {
                window.SnapshotModule.hide();
            }
        } catch(_) {}
        // REFACTORED
        if ($('#dataTableBody').length) { $('#dataTableBody').closest('.uk-overflow-auto').hide(); }
        if ($('#form-setting-app').length && $('#form-setting-app')[0] && typeof $('#form-setting-app')[0].scrollIntoView === 'function') {
            $('#form-setting-app')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }       
    } else {
    // Show the main scanner view by default if settings are complete
    showMainSection('scanner');
    }
    if (state === 'READY') {
        // REFACTORED
        if (typeof cekDataAwal === 'function') { cekDataAwal(); } else { /* debug logs removed */ }
    } else {
        if (window.toastr) {
            if (typeof toast !== 'undefined') {
                if (state === 'MISSING_SETTINGS' && toast.warning) toast.warning('Lengkapi SETTING terlebih dahulu');
                else if (state === 'MISSING_TOKENS' && toast.warning) toast.warning('Tambah/Import/Sinkronisasi KOIN terlebih dahulu');
                else if (toast.error) toast.error('LAKUKAN SETTING APLIASI & LENGKAPI DATA KOIN TOKEN');
            }
        }
    }
}

/**
 * Performs the initial data check and renders the UI.
 */
function cekDataAwal() {
  let info = true;
  let errorMessages = [];

  const mBoot = getAppMode();
  let DataTokens = (mBoot.type === 'single') ? getTokensChain(mBoot.chain) : getTokensMulti();
  let SavedSettingData = getFromLocalStorage('SETTING_SCANNER', {});

  if (!Array.isArray(DataTokens) || DataTokens.length === 0) {
    errorMessages.push("❌ Tidak ada data token yang tersedia.");
    if (typeof toast !== 'undefined' && toast.error) toast.error("Tidak ada data token yang tersedia");
    if(typeof scanner_form_off !== 'undefined') scanner_form_off();
    info = false;
  }

  if (!SavedSettingData || Object.keys(SavedSettingData).length === 0) {
    errorMessages.push("⚠️ Cek SETTINGAN aplikasi {USERNAME, WALLET ADDRESS, JEDA}!");
    $("#SettingConfig").addClass("icon-wrapper");
    form_off();
    info = false;
  }

  if (info) {
    // debug logs removed
    // Use new modular filter card + loaders
    // REFACTORED
    if (typeof refreshTokensTable === 'function') { refreshTokensTable(); }
  }

  const managedChains = Object.keys(CONFIG_CHAINS || {});
  if (managedChains.length > 0) {
    const chainParam = encodeURIComponent(managedChains.join(','));
    const link = $('a[href="index.html"]');
    if (link.length > 0) {
      let href = link.attr('href') || '';
      href = href.split('?')[0] || 'index.html';
      link.attr('href', `${href}?chains=${chainParam}`);
    }
  }

  if (!info) {
    $("#infoAPP").show().html(errorMessages.join("<br/>"));
  }

  try { updateInfoFromHistory(); } catch(_) {}
}


// --- Main Execution ---

/**
 * Deferred initializations to run after critical path rendering.
 */
async function deferredInit() {
    try { if (window.whenStorageReady) await window.whenStorageReady; } catch(_) {}
    bootApp();

    // Build unified filter card based on mode
    function getMode() { const m = getAppMode(); return { mode: m.type === 'single' ? 'single' : 'multi', chain: m.chain }; }

    // Helper: Convert hex to rgba
    function hexToRgba(hex, alpha = 1) {
        if (!hex) return null;
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Helper: Darken color for gradient
    function darkenColor(hex, percent = 30) {
        if (!hex) return '#000';
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        r = Math.max(0, Math.floor(r * (1 - percent / 100)));
        g = Math.max(0, Math.floor(g * (1 - percent / 100)));
        b = Math.max(0, Math.floor(b * (1 - percent / 100)));

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // Helper: Calculate brightness and determine text color (white or black)
    function getContrastTextColor(hex) {
        if (!hex) return '#000';
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Calculate relative luminance (WCAG formula)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return white for dark backgrounds, black for light backgrounds
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    function chipHtml(cls, id, label, color, count, checked, dataVal, disabled=false) {
        const badge = typeof count==='number' ? ` <span style="font-weight:bolder;">[${count}]</span>` : '';
        const dval = (typeof dataVal !== 'undefined' && dataVal !== null) ? dataVal : label;
        const styleDis = disabled ? 'opacity:0.5; pointer-events:none;' : '';

        // Create data attribute for color to be used by CSS
        const colorData = color ? `data-color="${color}"` : '';

        return `<label class="uk-text-small ${cls}" data-val="${dval}" ${colorData} style="display:inline-flex;align-items:inherit;cursor:pointer;${styleDis}">
            <input type="checkbox" class="uk-checkbox" id="${id}" ${checked && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
            <span style="${color?`color:${color};`:''} padding-left:4px; font-weight:bolder;">${label}</span>&nbsp;${badge}
        </label>`;
    }

    function renderFilterCard() {
        const $wrap = $('#filter-groups'); if(!$wrap.length) return; $wrap.empty();
        const m = getMode();
        const settings = getFromLocalStorage('SETTING_SCANNER', {}) || {};
        const $headLabels = $('#filter-head-labels');
        const $hdr = $('#current-chain-label');
        if ($hdr.length) {
            if (m.mode === 'single') {
                const cfg = (CONFIG_CHAINS && CONFIG_CHAINS[m.chain]) ? CONFIG_CHAINS[m.chain] : null;
                const label = (cfg?.Nama_Pendek || cfg?.Nama_Chain || m.chain || 'CHAIN').toString().toUpperCase();
                const color = cfg?.WARNA || '#333';
                $hdr.text(`[${label}]`).css('color', color);
            } else {
                $hdr.text('[ALL]').css('color', '#666');
            }
        }
        // Build right-side group (total) aligned to the right (sync button moved to token management)
        const createRightGroup = () => $('<div  class="uk-flex uk-flex-middle uk-text-muted" style="gap:6px; margin-left:auto;"></div>');
        let $right = createRightGroup();
        
        // Determine accent color based on mode
        let accentColor = '#5c9514'; // Default for multi-chain
        if (m.mode === 'single') {
            const cfg = (CONFIG_CHAINS && CONFIG_CHAINS[m.chain]) ? CONFIG_CHAINS[m.chain] : null;
            accentColor = cfg?.WARNA || '#333';
        }
        
        let $sum = $(`<span  class="uk-text-small" style="font-weight:bolder; color: white; background-color: ${accentColor}; padding: 2px 8px; border-radius: 4px;">TOTAL KOIN: 0</span>`);
        if (m.mode === 'multi') {
            const fmNow = getFilterMulti();
            // FIX: Don't default to all chains, respect the user's saved empty selection.
            const chainsSel = fmNow.chains || [];
            const cexSel = fmNow.cex || [];
            const dexSel = (fmNow.dex || []).map(x=>String(x).toLowerCase());
            const flat = flattenDataKoin(getTokensMulti()) || [];
            const byChain = flat.reduce((a,t)=>{const k=String(t.chain||'').toLowerCase(); a[k]=(a[k]||0)+1; return a;},{});
            const byCex = flat.filter(t=> (chainsSel.length === 0 || chainsSel.includes(String(t.chain||'').toLowerCase())))
                               .reduce((a,t)=>{const k=String(t.cex||'').toUpperCase(); a[k]=(a[k]||0)+1; return a;},{});
            const flatForDex = flat
              .filter(t => (chainsSel.length === 0 || chainsSel.includes(String(t.chain||'').toLowerCase())))
              .filter(t => (cexSel.length === 0 || cexSel.includes(String(t.cex||'').toUpperCase())));
            const byDex = flatForDex.reduce((a,t)=>{
                (t.dexs || []).forEach(d => { const k = String(d.dex||'').toLowerCase(); a[k] = (a[k]||0)+1; });
                return a;
            },{});
            const $secChain = $('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><b>CHAIN:</b></div>');
            Object.keys(CONFIG_CHAINS||{}).forEach(k=>{
                const short=(CONFIG_CHAINS[k].Nama_Pendek||k.substr(0,3)).toUpperCase();
                const id=`fc-chain-${k}`; const cnt=byChain[k]||0;
                if (cnt === 0) return; // hide chips with [0]
                const checked = chainsSel.includes(k.toLowerCase());
                $secChain.append(chipHtml('fc-chain',id,short,CONFIG_CHAINS[k].WARNA,cnt,checked, k.toLowerCase(), false));
            });
            const $secCex = $('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><span class="uk-text-danger">EXCH:</span></div>');
            Object.keys(CONFIG_CEX||{}).forEach(cx=>{
                const id=`fc-cex-${cx}`; const cnt=byCex[cx]||0; if (cnt===0) return; const checked=cexSel.includes(cx.toUpperCase());
                $secCex.append(chipHtml('fc-cex',id,cx,CONFIG_CEX[cx].WARNA,cnt,checked, cx, false));
            });
            const $secDex = $('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><span class="uk-text-bolder uk-text-danger">DEX:</span></div>');
            Object.keys(CONFIG_DEXS||{}).forEach(dx=>{
                const key = String(dx).toLowerCase();
                const id=`fc-dex-${key}`; const cnt=byDex[key]||0; if (cnt===0) return; const checked=dexSel.includes(key);
                const col = (CONFIG_DEXS[key] && (CONFIG_DEXS[key].warna || CONFIG_DEXS[key].WARNA)) || '#333';
                $secDex.append(chipHtml('fc-dex',id,dx.toUpperCase(),col,cnt,checked, key, false));
            });
            if ($headLabels.length)
            $wrap.append($secChain).append($('<div class=\"uk-text-muted\">|</div>')).append($secCex).append($('<div class=\"uk-text-muted\">|</div>')).append($secDex);
            const saved = getFromLocalStorage('FILTER_MULTICHAIN', null);
            let total = 0;
            if (!saved) {
                total = flat.length;
            } else if (chainsSel.length > 0 && cexSel.length > 0 && ((fmNow.dex||[]).length > 0)) {
                total = flat.filter(t => chainsSel.includes(String(t.chain||'').toLowerCase()))
                            .filter(t => cexSel.includes(String(t.cex||'').toUpperCase()))
                            .filter(t => (t.dexs||[]).some(d => (dexSel||[]).includes(String(d.dex||'').toLowerCase())))
                            .length;
            } else {
                total = 0;
            }
            $sum.text(`TOTAL KOIN: ${total}`);
            $right.append($sum);
            $wrap.append($right);
            $wrap.off('change.multif').on('change.multif','label.fc-chain input, label.fc-cex input, label.fc-dex input',function(){
                const prev = getFilterMulti();
                const prevChains = (prev.chains||[]).map(s=>String(s).toLowerCase());
                const prevCex = (prev.cex||[]).map(s=>String(s).toUpperCase());
                const prevDex = (prev.dex||[]).map(s=>String(s).toLowerCase());

                const chains=$wrap.find('label.fc-chain input:checked').map(function(){return $(this).closest('label').attr('data-val').toLowerCase();}).get();
                const cex=$wrap.find('label.fc-cex input:checked').map(function(){return $(this).closest('label').attr('data-val').toUpperCase();}).get();
                const dex=$wrap.find('label.fc-dex input:checked').map(function(){return $(this).closest('label').attr('data-val').toLowerCase();}).get();

                setFilterMulti({ chains, cex, dex });

                // Build detailed toast message
                const addChains = chains.filter(x => !prevChains.includes(x)).map(x=>x.toUpperCase());
                const delChains = prevChains.filter(x => !chains.includes(x)).map(x=>x.toUpperCase());
                const addCex = cex.filter(x => !prevCex.includes(x));
                const delCex = prevCex.filter(x => !cex.includes(x));
                const addDex = dex.filter(x => !prevDex.includes(x)).map(x=>x.toUpperCase());
                const delDex = prevDex.filter(x => !dex.includes(x)).map(x=>x.toUpperCase());
                const parts = [];
                if (addChains.length) parts.push(`+CHAIN: ${addChains.join(', ')}`);
                if (delChains.length) parts.push(`-CHAIN: ${delChains.join(', ')}`);
                if (addCex.length) parts.push(`+CEX: ${addCex.join(', ')}`);
                if (delCex.length) parts.push(`-CEX: ${delCex.join(', ')}`);
                if (addDex.length) parts.push(`+DEX: ${addDex.join(', ')}`);
                if (delDex.length) parts.push(`-DEX: ${delDex.join(', ')}`);
                const msg = parts.length ? parts.join(' | ') : `Filter MULTI diperbarui: CHAIN=${chains.length}, CEX=${cex.length}`;
                try { if (typeof toast !== 'undefined' && toast.info) toast.info(msg); } catch(_){ }

                // Clear both monitoring and management search boxes after filter change
                try { $('#searchInput').val(''); $('#mgrSearchInput').val(''); } catch(_){}
                // Also clear any existing signal cards produced by a previous scan
                try { if (typeof window.clearSignalCards === 'function') window.clearSignalCards(); } catch(_) {}
                refreshTokensTable();
                try { renderTokenManagementList(); } catch(_) {}
                renderFilterCard();
            });
        } else {
            const chain=m.chain;
            // FIX: Load from the correct getFilterChain function instead of SETTING_SCANNER
            const saved = getFilterChain(chain);
            const cexSel = saved.cex || [];
            const pairSel = saved.pair || [];
            const dexSel = (saved.dex || []).map(x=>String(x).toLowerCase());

            const flat = flattenDataKoin(getTokensChain(chain))||[];
            const byCex = flat.reduce((a,t)=>{const k=String(t.cex||'').toUpperCase(); a[k]=(a[k]||0)+1; return a;},{});
            const pairDefs = (CONFIG_CHAINS[chain]||{}).PAIRDEXS||{};
            const flatPair = (cexSel.length? flat.filter(t=>cexSel.includes(String(t.cex||'').toUpperCase())): flat);
            const byPair = flatPair.reduce((a,t)=>{
                const p = String(t.symbol_out||'').toUpperCase().trim();
                const k = pairDefs[p] ? p : 'NON';
                a[k] = (a[k]||0)+1;
                return a;
            },{});
            const $secCex=$('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><span class="uk-text-bolder uk-text-primary">EXCH:</span></div>');
            const relevantCexs = (CONFIG_CHAINS[chain] && CONFIG_CHAINS[chain].WALLET_CEX) ? Object.keys(CONFIG_CHAINS[chain].WALLET_CEX) : [];
            relevantCexs.forEach(cx=>{
                const id=`sc-cex-${cx}`; const cnt=byCex[cx]||0;
                if (cnt===0) return; // hide chips with 0 token
                const checked=cexSel.includes(cx);
                $secCex.append(chipHtml('sc-cex',id,cx,(CONFIG_CEX[cx] || {}).WARNA,cnt,checked, undefined, false));
            });
            const $secPair=$('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><span class="uk-text-bolder uk-text-success">PAIR:</span></div>');
            const pairs=Array.from(new Set([...Object.keys(pairDefs),'NON']));
            pairs.forEach(p=>{
                const id=`sc-pair-${p}`; const cnt=byPair[p]||0;
                if (cnt===0) return; // hide chips with 0 token
                const checked=pairSel.includes(p);
                $secPair.append(chipHtml('sc-pair',id,p,'',cnt,checked, undefined, false));
            });
            // DEX chips based on chain-allowed DEXes and filtered dataset
            const $secDex=$('<div class="uk-flex uk-flex-middle" style="gap:8px;flex-wrap:wrap;"><span class="uk-text-bolder uk-text-danger">DEX:</span></div>');
            const dexAllowed = ((CONFIG_CHAINS[chain]||{}).DEXS || []).map(x=>String(x).toLowerCase());
            const byDex = flatPair.reduce((a,t)=>{
                (t.dexs||[]).forEach(d => { const k=String(d.dex||'').toLowerCase(); if (!dexAllowed.includes(k)) return; a[k]=(a[k]||0)+1; });
                return a;
            },{});
            dexAllowed.forEach(dx => {
                const id=`sc-dex-${dx}`; const cnt=byDex[dx]||0; if (cnt===0) return; const checked=dexSel.includes(dx);
                const col = (CONFIG_DEXS[dx] && (CONFIG_DEXS[dx].warna || CONFIG_DEXS[dx].WARNA)) || '#333';
                $secDex.append(chipHtml('sc-dex',id,dx.toUpperCase(),col,cnt,checked, dx, false));
            });
            if ($headLabels.length)
            $wrap.append($secCex).append($('<div class=\"uk-text-muted\">|</div>')).append($secPair).append($('<div class=\"uk-text-muted\">|</div>')).append($secDex);
            let totalSingle = 0;
            if ((cexSel && cexSel.length) && (pairSel && pairSel.length) && (dexSel && dexSel.length)) {
                const filtered = flat.filter(t => cexSel.includes(String(t.cex||'').toUpperCase()))
                                     .filter(t => { const p = String(t.symbol_out||'').toUpperCase(); const key = pairDefs[p] ? p : 'NON'; return pairSel.includes(key); })
                                     .filter(t => (t.dexs||[]).some(d => dexSel.includes(String(d.dex||'').toLowerCase())));
                totalSingle = filtered.length;
            } else {
                totalSingle = 0;
            }
            $sum.text(`TOTAL KOIN: ${totalSingle}`);
            $right.append($sum);
            $wrap.append($right);
            $wrap.off('change.scf').on('change.scf','label.sc-cex input, label.sc-pair input, label.sc-dex input',function(){
                const prev = getFilterChain(chain);
                const prevC = (prev.cex||[]).map(String);
                const prevP = (prev.pair||[]).map(x=>String(x).toUpperCase());
                const prevD = (prev.dex||[]).map(x=>String(x).toLowerCase());

                const c=$wrap.find('label.sc-cex input:checked').map(function(){return $(this).closest('label').attr('data-val');}).get();
                const p=$wrap.find('label.sc-pair input:checked').map(function(){return $(this).closest('label').attr('data-val');}).get();
                const d=$wrap.find('label.sc-dex input:checked').map(function(){return $(this).closest('label').attr('data-val').toLowerCase();}).get();
                setFilterChain(chain, { cex:c, pair:p, dex:d });
                // Detailed toast
                const cAdd = c.filter(x => !prevC.includes(x));
                const cDel = prevC.filter(x => !c.includes(x));
                const pU = p.map(x=>String(x).toUpperCase());
                const pAdd = pU.filter(x => !prevP.includes(x));
                const pDel = prevP.filter(x => !pU.includes(x));
                const dAdd = d.filter(x=>!prevD.includes(x)).map(x=>x.toUpperCase());
                const dDel = prevD.filter(x=>!d.includes(x)).map(x=>x.toUpperCase());
                const parts = [];
                if (cAdd.length) parts.push(`+CEX: ${cAdd.join(', ')}`);
                if (cDel.length) parts.push(`-CEX: ${cDel.join(', ')}`);
                if (pAdd.length) parts.push(`+PAIR: ${pAdd.join(', ')}`);
                if (pDel.length) parts.push(`-PAIR: ${pDel.join(', ')}`);
                if (dAdd.length) parts.push(`+DEX: ${dAdd.join(', ')}`);
                if (dDel.length) parts.push(`-DEX: ${dDel.join(', ')}`);
                const label = String(chain).toUpperCase();
                const msg = parts.length ? `[${label}] ${parts.join(' | ')}` : `[${label}] Filter diperbarui: CEX=${c.length}, PAIR=${p.length}`;
                try { if (typeof toast !== 'undefined' && toast.info) toast.info(msg); } catch(_){ }
                // Clear both monitoring and management search boxes after filter change
                try { $('#searchInput').val(''); $('#mgrSearchInput').val(''); } catch(_){}
                // Also clear any existing signal cards produced by a previous scan
                try { if (typeof window.clearSignalCards === 'function') window.clearSignalCards(); } catch(_) {}
                loadAndDisplaySingleChainTokens();
                try { renderTokenManagementList(); } catch(_) {}
                renderFilterCard();
            });
        }

        // CTA untuk kondisi tidak ada data koin (berlaku untuk SEMUA mode)
        try {
            const needCTA = (typeof hasValidTokens === 'function') ? !hasValidTokens() : false;
            if (needCTA) {
                $('#ManajemenKoin .icon').addClass('cta-settings').attr('title','Klik untuk membuka Manajemen Koin');
                // Jika tombol sync tersedia (saat manajemen terbuka), highlight juga
                $('#sync-tokens-btn').addClass('cta-sync').attr('title','Klik untuk SYNC data koin');
            } else {
                $('#ManajemenKoin .icon').removeClass('cta-settings').attr('title','Manajemen Koin');
                $('#sync-tokens-btn').removeClass('cta-sync');
            }
        } catch(_) {}


        // Enforce disabled state for filter controls if tokens are missing
        try {
            const stateNow = computeAppReadiness();
            if (stateNow === 'MISSING_TOKENS' || stateNow === 'MISSING_BOTH') {
                const $fc = $('#filter-card');
                $fc.find('input, button, select, textarea').prop('disabled', true);
                $fc.find('label, .toggle-radio').css({ pointerEvents: 'none', opacity: 0.5 });
            }
        } catch(_) {}

        // Apply dynamic colors from config to checked checkboxes (Opsi 4)
        applyFilterColors();
    }

    // Apply background and text colors based on config (Opsi 5: Gradient + Smart Contrast)
    function applyFilterColors() {
        // Default pair color (green)
        const defaultPairColor = '#4caf50';

        // Process all filter labels with data-color attribute
        $('#filter-groups label[data-color]').each(function() {
            const $label = $(this);
            const color = $label.attr('data-color');
            const $checkbox = $label.find('input[type="checkbox"]');

            if (!color) return;

            // Apply colors when checked
            if ($checkbox.is(':checked')) {
                const darkerColor = darkenColor(color, 25); // Darken by 25% for gradient end
                const gradient = `linear-gradient(135deg, ${color} 0%, ${darkerColor} 100%)`;
                const textColor = getContrastTextColor(color); // Auto white/black

                $label.css({
                    'background': gradient,
                    'border-color': color,
                    'color': textColor
                });
                $label.find('span').css('color', textColor);
            }
        });

        // Handle pair labels (no data-color, use default green)
        $('#filter-groups label.sc-pair').each(function() {
            const $label = $(this);
            const $checkbox = $label.find('input[type="checkbox"]');

            if ($checkbox.is(':checked')) {
                const darkerGreen = darkenColor(defaultPairColor, 25);
                const gradient = `linear-gradient(135deg, ${defaultPairColor} 0%, ${darkerGreen} 100%)`;
                const textColor = getContrastTextColor(defaultPairColor);

                $label.css({
                    'background': gradient,
                    'border-color': defaultPairColor,
                    'color': textColor
                });
                $label.find('span').css('color', textColor);
            }
        });

        // Add event listener for checkbox changes
        $('#filter-groups label input[type="checkbox"]').off('change.colorize').on('change.colorize', function() {
            const $checkbox = $(this);
            const $label = $checkbox.closest('label');
            const color = $label.attr('data-color');
            const isPair = $label.hasClass('sc-pair');

            const actualColor = color || (isPair ? defaultPairColor : null);

            if (!actualColor) return;

            if ($checkbox.is(':checked')) {
                const darkerColor = darkenColor(actualColor, 25);
                const gradient = `linear-gradient(135deg, ${actualColor} 0%, ${darkerColor} 100%)`;
                const textColor = getContrastTextColor(actualColor);

                $label.css({
                    'background': gradient,
                    'border-color': actualColor,
                    'color': textColor
                });
                $label.find('span').css('color', textColor);
            } else {
                // Reset to default unchecked state - let CSS handle it
                $label.css({
                    'background': '',
                    'border-color': '',
                    'color': ''
                });
                $label.find('span').css('color', color || '');
            }
        });
    }

    renderFilterCard();
    // Ensure UI gating matches current run state after initial render
    try {
        const st = getAppState();
        if (st && st.run === 'YES' && typeof setScanUIGating === 'function') {
            setScanUIGating(true);
        }
    } catch(_) {}
    // Auto open Token Management when no tokens exist
    (function autoOpenManagerIfNoTokens(){
        try {
            const mode = getAppMode();
            let hasTokens = false;
            if (mode.type === 'single') {
                const t = getTokensChain(mode.chain);
                hasTokens = Array.isArray(t) && t.length > 0;
            } else {
                const t = getTokensMulti();
                hasTokens = Array.isArray(t) && t.length > 0;
            }
            if (!hasTokens) {
                showMainSection('#token-management');
                try {
                    if (window.SnapshotModule && typeof window.SnapshotModule.hide === 'function') {
                        window.SnapshotModule.hide();
                    }
                } catch(_) {}
                renderTokenManagementList();
            }
        } catch(_) {}
    })();
    // helper to reflect saved sort preference to A-Z / Z-A toggle
    function applySortToggleState() {
        try {
            const mode = getAppMode();
            let pref = 'A';
            if (mode.type === 'single') {
                const key = `FILTER_${String(mode.chain).toUpperCase()}`;
                const obj = getFromLocalStorage(key, {}) || {};
                if (obj && (obj.sort === 'A' || obj.sort === 'Z')) pref = obj.sort;
            } else {
                const obj = getFromLocalStorage('FILTER_MULTICHAIN', {}) || {};
                if (obj && (obj.sort === 'A' || obj.sort === 'Z')) pref = obj.sort;
            }
            const want = (pref === 'A') ? 'opt_A' : 'opt_Z';
            const $toggles = $('.sort-toggle');
            $toggles.removeClass('active');
            $toggles.find('input[type=radio]').prop('checked', false);
            const $target = $toggles.filter(`[data-sort="${want}"]`);
            $target.addClass('active');
            $target.find('input[type=radio]').prop('checked', true);
        } catch(_) {}
    }
    try { applySortToggleState(); } catch(_) {}

    // Auto-switch to single-chain view if URL indicates per-chain mode
    (function autoOpenSingleChainIfNeeded(){
        const m = getMode();
        if (m.mode !== 'single') return;
        try {
            activeSingleChainKey = m.chain;
            const chainCfg = (window.CONFIG_CHAINS||{})[m.chain] || {};
            const chainName = chainCfg.Nama_Chain || m.chain.toUpperCase();
            // Show the main scanner view
            showMainSection('scanner');
            loadAndDisplaySingleChainTokens();
        } catch(e) { /* debug logs removed */ }
    })();


    // --- Event Listeners ---

    // Removed localStorage 'storage' event listener; app state is now IDB-only.

    $('#darkModeToggle').on('click', function() {
        // Block toggling while scanning is running
        try {
            const st = (typeof getAppState === 'function') ? getAppState() : { run: 'NO' };
            if (String(st.run||'NO').toUpperCase() === 'YES') return; // refactor: disable dark-mode toggle during scan
        } catch(_) {}
        const body = $('body');
        body.toggleClass('dark-mode uk-dark');
        const isDark = body.hasClass('dark-mode');
        setAppState({ darkMode: isDark }); // saved into FILTER_*
        if (typeof applyThemeForMode === 'function') applyThemeForMode();
        try { if (typeof window.updateSignalTheme === 'function') window.updateSignalTheme(); } catch(_) {}
        // Re-apply filter colors after dark mode toggle
        try { if (typeof applyFilterColors === 'function') applyFilterColors(); } catch(_) {}
    });

    // Console Log Summary toggle (default OFF)
    try {
        const savedScanLog = getFromLocalStorage('SCAN_LOG_ENABLED', false);
        const isOn = (savedScanLog === true) || (String(savedScanLog).toLowerCase() === 'true') || (String(savedScanLog) === '1');
        window.SCAN_LOG_ENABLED = !!isOn;
        const $tgl = $('#toggleScanLog');
        if ($tgl.length) $tgl.prop('checked', !!isOn);
        $(document).off('change.scanlog').on('change.scanlog', '#toggleScanLog', function(){
            const v = !!$(this).is(':checked');
            window.SCAN_LOG_ENABLED = v;
            try { saveToLocalStorage('SCAN_LOG_ENABLED', v); } catch(_) {}
        });
        // Keep it enabled even during scan gating
        try { $('#toggleScanLog').prop('disabled', false).css({ opacity: '', pointerEvents: '' }); } catch(_) {}
    } catch(_) {}

    $('.sort-toggle').off('click').on('click', function () {
        $('.sort-toggle').removeClass('active');
        $(this).addClass('active');
        const sortValue = $(this).data('sort'); // expects 'opt_A' or 'opt_Z'
        const pref = (sortValue === 'opt_A') ? 'A' : 'Z';
        try {
            const mode = getAppMode();
            if (mode.type === 'single') {
                const key = `FILTER_${String(mode.chain).toUpperCase()}`;
                const obj = getFromLocalStorage(key, {}) || {};
                obj.sort = pref;
                saveToLocalStorage(key, obj);
                loadAndDisplaySingleChainTokens(); // will re-apply sorting and update window.singleChainTokensCurrent
            } else {
                const key = 'FILTER_MULTICHAIN';
                const obj = getFromLocalStorage(key, {}) || {};
                obj.sort = pref;
                saveToLocalStorage(key, obj);
                // Re-sort current multi data
                // Re-fetch sorted from source to reflect new preference
                refreshTokensTable();
            }
        } catch(_) {}
    });

    // Initialize and persist PNL filter input per mode
    function syncPnlInputFromStorage() {
        try {
            const v = (typeof getPNLFilter === 'function') ? getPNLFilter() : 0;
            $('#pnlFilterInput').val(v);
        } catch(_) {}
    }
    syncPnlInputFromStorage();

    $(document).on('change blur', '#pnlFilterInput', function(){
        const raw = $(this).val();
        const v = parseFloat(raw);
        const clean = isFinite(v) && v >= 0 ? v : 0;
        try {
            setPNLFilter(clean);
            $(this).val(clean);
            try { if (typeof toast !== 'undefined' && toast.info) toast.info(`PNL Filter diset: $${clean}`); } catch(_) {}
            // Clear previously displayed scan signal cards when PNL filter changes
            try { if (typeof window.clearSignalCards === 'function') window.clearSignalCards(); } catch(_) {}
        } catch(_) {}
    });

    $('#btn-save-setting').on('click', async function() {
        const nickname = $('#user').val().trim();
        const jedaTimeGroup = parseInt($('#jeda-time-group').val(), 10);
        const jedaKoin = parseInt($('#jeda-koin').val(), 10);
        const walletMeta = $('#walletMeta').val().trim();
        const scanPerKoin = $('input[name="koin-group"]:checked').val();
        const speedScan = $('input[name="waktu-tunggu"]:checked').val();

        if (!nickname) return UIkit.notification({message: 'Nickname harus diisi!', status: 'danger'});
        if (!jedaTimeGroup || jedaTimeGroup <= 0) return UIkit.notification({message: 'Jeda / Group harus lebih dari 0!', status: 'danger'});
        if (!jedaKoin || jedaKoin <= 0) return UIkit.notification({message: 'Jeda / Koin harus lebih dari 0!', status: 'danger'});
        if (!walletMeta || !walletMeta.startsWith('0x')) return UIkit.notification({message: 'Wallet Address harus valid!', status: 'danger'});

        let JedaDexs = {};
        $('.dex-delay-input').each(function() {
            JedaDexs[$(this).data('dex')] = parseFloat($(this).val()) || 100;
        });

        // Collect user RPC settings (NEW: simplified structure using database)
        let userRPCs = {};
        // Get initial values from database migrator (not hardcoded anymore)
        const getInitialRPC = (chain) => {
            if (window.RPCDatabaseMigrator && window.RPCDatabaseMigrator.INITIAL_RPC_VALUES) {
                return window.RPCDatabaseMigrator.INITIAL_RPC_VALUES[chain] || '';
            }
            return '';
        };

        $('.rpc-input').each(function() {
            const chain = $(this).data('chain');
            const rpc = $(this).val().trim();

            // Simpan RPC yang diinput user, atau gunakan initial value dari migrator jika kosong
            if (rpc) {
                userRPCs[chain] = rpc;
            } else {
                const initialRPC = getInitialRPC(chain);
                if (initialRPC) {
                    userRPCs[chain] = initialRPC;
                }
            }
        });

        // Validasi: pastikan semua chain punya RPC
        const missingRPCs = Object.keys(CONFIG_CHAINS).filter(chain => !userRPCs[chain]);
        if (missingRPCs.length > 0) {
            UIkit.notification({
                message: `RPC untuk chain berikut harus diisi: ${missingRPCs.join(', ')}`,
                status: 'danger',
                timeout: 5000
            });
            return;
        }

        const settingData = {
            nickname, jedaTimeGroup, jedaKoin, walletMeta,
            scanPerKoin: parseInt(scanPerKoin, 10),
            speedScan: parseFloat(speedScan),
            JedaDexs,
            userRPCs  // NEW: hanya simpan RPC yang diinput user (1 per chain)
        };

        saveToLocalStorage('SETTING_SCANNER', settingData);

        try { setLastAction("SIMPAN SETTING"); } catch(_) {}
        alert("✅ SETTING SCANNER BERHASIL DISIMPAN");
        location.reload();
    });

    // Deprecated modal handler removed; settings now inline

    // Global search handler (filter card)

    $('.posisi-check').on('change', function () {
        if ($('.posisi-check:checked').length === 0) {
            $(this).prop('checked', true);
            if (typeof toast !== 'undefined' && toast.error) toast.error("Minimal salah satu POSISI harus aktif!");
            return;
        }
        const label = $(this).val() === 'Actionkiri' ? 'KIRI' : 'KANAN';
        const status = $(this).is(':checked') ? 'AKTIF' : 'NONAKTIF';
        if (typeof toast !== 'undefined' && toast.info) toast.info(`POSISI ${label} ${status}`);
    });

$("#reload").click(function () {
        // Per-tab reload: do NOT broadcast run=NO; only mark local flag
        try { sessionStorage.setItem('APP_FORCE_RUN_NO', '1'); } catch(_) {}
        try { location.reload(); } catch(_) {}
    });

    $("#stopSCAN").click(function () {
        if (window.App?.Scanner?.stopScanner) window.App.Scanner.stopScanner();
    });

    // Autorun toggle
    try {
        window.AUTORUN_ENABLED = false;
        $(document).on('change', '#autoRunToggle', function(){
            window.AUTORUN_ENABLED = $(this).is(':checked');
            if (!window.AUTORUN_ENABLED) {
                // cancel any pending autorun countdown
                try { clearInterval(window.__autoRunInterval); } catch(_) {}
                window.__autoRunInterval = null;
                // clear countdown label
                $('#autoRunCountdown').text('');
                // restore UI to idle state if not scanning
                try {
                    $('#stopSCAN').hide().prop('disabled', true);
                    $('#startSCAN').prop('disabled', false).removeClass('uk-button-disabled').text('START');
                    $("#LoadDataBtn, #SettingModal, #MasterData,#UpdateWalletCEX,#chain-links-container,.sort-toggle, .edit-token-button").css("pointer-events", "auto").css("opacity", "1");
                    if (typeof setScanUIGating === 'function') setScanUIGating(false);
                    $('.header-card a, .header-card .icon').css({ pointerEvents: 'auto', opacity: 1 });
                } catch(_) {}
            }
        });
    } catch(_) {}

    // Cancel button in inline settings: restore without broadcasting to other tabs
    $(document).on('click', '#btn-cancel-setting', function () {
        try { sessionStorage.setItem('APP_FORCE_RUN_NO', '1'); } catch(_) {}
        try { location.reload(); } catch(_) {}
    });

    $("#SettingConfig").on("click", function () {
        showMainSection('#form-setting-app');
        try { document.getElementById('form-setting-app').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
        renderSettingsForm();
    });

    $('#ManajemenKoin').on('click', function(e){
      e.preventDefault();
      showMainSection('#token-management');
      // Filter card is part of the main scanner view, so we need to show it separately if needed with management
      $('#filter-card').show();
      try {
        if (window.SnapshotModule && typeof window.SnapshotModule.hide === 'function') {
            window.SnapshotModule.hide();
        }
      } catch(_) {}
      renderTokenManagementList();
    });

    // Global search (in filter card) updates both monitoring and management views
    $('#searchInput').on('input', debounce(function() {
        // Filter monitoring table rows (multi and single chain)
        const searchValue = ($(this).val() || '').toLowerCase();
        const filterTable = (tbodyId) => {
            const el = document.getElementById(tbodyId);
            if (!el) return;
            const rows = el.getElementsByTagName('tr');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowText = row.textContent || row.innerText || '';
                row.style.display = rowText.toLowerCase().indexOf(searchValue) > -1 ? '' : 'none';
            }
        };
        filterTable('dataTableBody');

        // Build scan candidates based on search and current mode
        try {
            const mode = getAppMode();
            const q = searchValue;
            const pick = (t) => {
                try {
                    const chainKey = String(t.chain||'').toLowerCase();
                    const chainName = (window.CONFIG_CHAINS?.[chainKey]?.Nama_Chain || '').toString().toLowerCase();
                    const dexs = (t.dexs||[]).map(d => String(d.dex||'').toLowerCase()).join(' ');
                    const addresses = [t.sc_in, t.sc_out].map(x => String(x||'').toLowerCase()).join(' ');
                    return [t.symbol_in, t.symbol_out, t.cex, t.chain, chainName, dexs, addresses]
                        .filter(Boolean)
                        .map(s => String(s).toLowerCase())
                        .join(' ');
                } catch(_) { return ''; }
            };
            if (!q) {
                window.scanCandidateTokens = null; // reset to default scanning
            } else if (mode.type === 'single') {
                const base = Array.isArray(window.singleChainTokensCurrent) ? window.singleChainTokensCurrent : [];
                window.scanCandidateTokens = base.filter(t => pick(t).includes(q));
            } else {
                const base = Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : (Array.isArray(window.filteredTokens) ? window.filteredTokens : []);
                window.scanCandidateTokens = base.filter(t => pick(t).includes(q));
            }
        } catch(_) {}

        // Re-render token management list to apply same query
        try { renderTokenManagementList(); } catch(_) {}
    }, 250));

    // Management search input (visible only on Token Management view)
    $(document).on('input', '#mgrSearchInput', debounce(function(){
        try { renderTokenManagementList(); } catch(_) {}
    }, 250));

    $(document).on('click', '#btnNewToken', () => {
      const keys = Object.keys(window.CONFIG_CHAINS || {});
      const firstChainWithDex = keys.find(k => {
          const d = CONFIG_CHAINS[k]?.DEXS;
          return Array.isArray(d) ? d.length > 0 : !!(d && Object.keys(d).length);
        }) || keys[0] || '';

      const empty = { id: Date.now().toString(), chain: String(firstChainWithDex).toLowerCase(), status: true, selectedCexs: [], selectedDexs: [], dataDexs: {}, dataCexs: {} };

      $('#multiTokenIndex').val(empty.id);
      $('#inputSymbolToken, #inputSCToken, #inputSymbolPair, #inputSCPair').val('');
      $('#inputDesToken, #inputDesPair').val('');
      setStatusRadios(true);

      const $sel = $('#FormEditKoinModal #mgrChain');
      populateChainSelect($sel, empty.chain);

      // Enforce chain select by mode + theme the modal
      try {
        const m = getAppMode();
        if (m.type === 'single') {
          const c = String(m.chain).toLowerCase();
          $sel.val(c).prop('disabled', true).attr('title','Per-chain mode: Chain terkunci');
          if (typeof applyEditModalTheme === 'function') applyEditModalTheme(c);
          $('#CopyToMultiBtn').show();
        } else {
          $sel.prop('disabled', false).attr('title','');
          if (typeof applyEditModalTheme === 'function') applyEditModalTheme(null);
          $('#CopyToMultiBtn').hide();
        }
      } catch(_) {}

      const currentChain = String($sel.val() || empty.chain).toLowerCase();
      const baseToken = { ...empty, chain: currentChain };

      buildCexCheckboxForKoin(baseToken);
      buildDexCheckboxForKoin(baseToken);

      $sel.off('change.rebuildDexAdd').on('change.rebuildDexAdd', function () {
        const newChain = String($(this).val() || '').toLowerCase();
        buildDexCheckboxForKoin({ ...baseToken, chain: newChain });
        try { if (typeof applyEditModalTheme === 'function') applyEditModalTheme(newChain); } catch(_){}
      });

      if (window.UIkit?.modal) UIkit.modal('#FormEditKoinModal').show();
    });

    $('#UpdateWalletCEX').on('click', async () => {
        // NEW UI: Show wallet exchanger section instead of running immediately
        try {
            if (window.App?.WalletExchanger?.show) {
                window.App.WalletExchanger.show();
                return;
            }
        } catch(err) {
            // console.error('[UpdateWalletCEX] Error showing wallet exchanger section:', err);
        }

        // FALLBACK: Old behavior (direct execution) if new UI not available
        // Pre-check: require at least 1 CEX selected in filter chips
        try {
            const m = getAppMode();
            let selected = [];
            if (m.type === 'single') {
                const fc = getFilterChain(m.chain || '');
                selected = (fc && Array.isArray(fc.cex)) ? fc.cex : [];
            } else {
                const fm = getFilterMulti();
                selected = (fm && Array.isArray(fm.cex)) ? fm.cex : [];
            }
            const cfg = (typeof window !== 'undefined' ? (window.CONFIG_CEX || {}) : (CONFIG_CEX || {}));
            const valid = (selected || []).map(x => String(x).toUpperCase()).filter(cx => !!cfg[cx]);
            if (!valid.length) {
                if (typeof toast !== 'undefined' && toast.error) toast.error('Pilih minimal 1 CEX pada filter sebelum update wallet.');
                try { setLastAction('UPDATE WALLET EXCHANGER', 'error', { reason: 'NO_CEX_SELECTED' }); } catch(_) {}
                return;
            }
        } catch(_) { /* fallthrough to confirm */ }

        if (!confirm("APAKAH ANDA INGIN UPDATE WALLET EXCHANGER?")) { try { setLastAction('UPDATE WALLET EXCHANGER', 'warning', { reason: 'CANCELLED' }); } catch(_) {} return; }

        // Ensure any running scan stops before updating wallets
        try {
            const st = getAppState();
            if (st && st.run === 'YES' && window.App?.Scanner?.stopScannerSoft) {
                window.App.Scanner.stopScannerSoft();
                // Small delay to let UI settle
                await new Promise(r => setTimeout(r, 200));
            }
        } catch(_) {}

        // Run wallet update; page will reload after success in the service layer
        try { checkAllCEXWallets(); } catch(e) { console.error(e); }
    });

$("#startSCAN").click(function () {
        // Rebuild monitoring header to reflect current active DEXs before scanning
        try {
            const dexList = (window.computeActiveDexList ? window.computeActiveDexList() : Object.keys(window.CONFIG_DEXS || {}));
            if (window.renderMonitoringHeader) window.renderMonitoringHeader(dexList);
        } catch(_) {}

        // === GLOBAL SCAN LOCK CHECK ===
        try {
            const lockCheck = typeof checkCanStartScan === 'function' ? checkCanStartScan() : { canScan: true };

            if (!lockCheck.canScan) {
                // console.warn('[START BUTTON] Cannot start scan - locked by another tab:', lockCheck.lockInfo);

                // Show user-friendly notification
                if (typeof toast !== 'undefined' && toast.warning) {
                    const lockInfo = lockCheck.lockInfo || {};
                    const mode = lockInfo.mode || 'UNKNOWN';
                    const ageMin = Math.floor((lockInfo.age || 0) / 60000);
                    const ageSec = Math.floor(((lockInfo.age || 0) % 60000) / 1000);
                    const timeStr = ageMin > 0 ? `${ageMin}m ${ageSec}s` : `${ageSec}s`;

                    toast.warning(
                        `⚠️ SCAN SEDANG BERJALAN!\n\n` +
                        `Mode: ${mode}\n` +
                        `Durasi: ${timeStr}\n\n` +
                        `Tunggu scan selesai atau tutup tab lain yang sedang scanning.`,
                        { timeOut: 5000 }
                    );
                }

                return; // Exit early - don't start scan
            }
        } catch(e) {
            // console.error('[START BUTTON] Error checking global scan lock:', e);
            // On error checking lock, allow scan to proceed
        }

        // Prevent starting if app state indicates a run is already active (per-tab check)
        try {
            const stClick = getAppState();
            if (stClick && stClick.run === 'YES') {
                $('#startSCAN').prop('disabled', true).attr('aria-busy','true').text('Running...').addClass('uk-button-disabled');
                $('#stopSCAN').show().prop('disabled', false);
                try { if (typeof setScanUIGating === 'function') setScanUIGating(true); } catch(_) {}
                return; // do not start twice
            }
        } catch(_) {}

        const settings = getFromLocalStorage('SETTING_SCANNER', {}) || {};

        const mode = getAppMode();
        if (mode.type === 'single') {
            // Build flat tokens for the active chain and apply per‑chain filters (CEX ∩ PAIR)
            const chainKey = mode.chain;
            let tokens = getTokensChain(chainKey);
            let flatTokens = flattenDataKoin(tokens);

            try {
                const rawSaved = getFromLocalStorage(`FILTER_${String(chainKey).toUpperCase()}`, null);
                const filters = getFilterChain(chainKey);
                const selCex = (filters.cex || []).map(x=>String(x).toUpperCase());
                const selPair = (filters.pair || []).map(x=>String(x).toUpperCase());
                if (!rawSaved) {
                    // No saved filter yet: scan all tokens for this chain
                } else if (selCex.length > 0 && selPair.length > 0) {
                    flatTokens = flatTokens.filter(t => selCex.includes(String(t.cex).toUpperCase()));
                    flatTokens = flatTokens.filter(t => {
                        const chainCfg = CONFIG_CHAINS[(t.chain||'').toLowerCase()]||{};
                        const pairDefs = chainCfg.PAIRDEXS||{};
                        const p = String(t.symbol_out||'').toUpperCase();
                        const mapped = pairDefs[p]?p:'NON';
                        return selPair.includes(mapped);
                    });
                } else {
                    flatTokens = [];
                }
            } catch(_) {}

            // Apply single-chain sort preference to scanning order (from FILTER_<CHAIN>.sort)
            try {
                const rawSavedSort = getFromLocalStorage(`FILTER_${String(chainKey).toUpperCase()}`, null);
                const sortPref = (rawSavedSort && (rawSavedSort.sort === 'A' || rawSavedSort.sort === 'Z')) ? rawSavedSort.sort : 'A';
                flatTokens = flatTokens.sort((a,b) => {
                    const A = (a.symbol_in||'').toUpperCase();
                    const B = (b.symbol_in||'').toUpperCase();
                    if (A < B) return sortPref === 'A' ? -1 : 1;
                    if (A > B) return sortPref === 'A' ?  1 : -1;
                    return 0;
                });
            } catch(_) {}

            // If user searched, limit scan to visible (search-filtered) tokens
            try {
                const q = ($('#searchInput').val() || '').trim();
                if (q) {
                    const cand = Array.isArray(window.scanCandidateTokens) ? window.scanCandidateTokens : [];
                    flatTokens = cand;
                }
            } catch(_) {}

            if (!Array.isArray(flatTokens) || flatTokens.length === 0) {
                if (typeof toast !== 'undefined' && toast.info) toast.info('Tidak ada token pada filter per‑chain untuk dipindai.');
                return;
            }
            // Re-render monitoring table to initial state for these tokens
            try {
                loadKointoTable(flatTokens, 'dataTableBody');
                // console.log('[START] Table skeleton rendered, waiting for DOM to settle...');
            } catch(e) {
                // console.error('[START] Failed to render table:', e);
            }
            // Wait for DOM to settle before starting scanner (increased to 250ms for safety)
            setTimeout(() => {
                // console.log('[START] Starting scanner now...');
                if (window.App?.Scanner?.startScanner) window.App.Scanner.startScanner(flatTokens, settings, 'dataTableBody');
            }, 250);
            return;
        }

        // Multi‑chain: use visible (search-filtered) tokens if search active; else use the current list order (CHAIN ∩ CEX)
        let toScan = Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : (Array.isArray(filteredTokens) ? filteredTokens : []);
        try {
            const q = ($('#searchInput').val() || '').trim();
            if (q) {
                toScan = Array.isArray(window.scanCandidateTokens) ? window.scanCandidateTokens : [];
            }
        } catch(_) {}
        if (!Array.isArray(toScan) || toScan.length === 0) {
            if (typeof toast !== 'undefined' && toast.info) toast.info('Tidak ada token yang cocok dengan hasil pencarian/fitur filter untuk dipindai.');
            return;
        }
        // Re-render monitoring table to initial state for these tokens
        try {
            loadKointoTable(toScan, 'dataTableBody');
            // console.log('[START] Table skeleton rendered, waiting for DOM to settle...');
        } catch(e) {
            // console.error('[START] Failed to render table:', e);
        }
        // Wait for DOM to settle before starting scanner (increased to 250ms for safety)
        setTimeout(() => {
            // console.log('[START] Starting scanner now...');
            if (window.App?.Scanner?.startScanner) window.App.Scanner.startScanner(toScan, settings, 'dataTableBody');
        }, 250);
    });

    // Token Management Form Handlers
    // Export/Import (delegated)
    $(document).on('click', '#btnExportTokens', function(){
        try { downloadTokenScannerCSV(); } catch(e) { console.error(e); }
    });
    $(document).on('click', '#btnImportTokens', function(){
        const $inp = $('#uploadJSON');
        if ($inp.length) $inp.trigger('click');
    });
    $(document).on('submit', '#multiTokenForm', function (e) {
        e.preventDefault();
        const id = $('#multiTokenIndex').val();
        if (!id) return (typeof toast !== 'undefined' && toast.error) ? toast.error('ID token tidak ditemukan.') : undefined;

        const updatedToken = {
            id,
            symbol_in: ($('#inputSymbolToken').val() || '').trim(),
            des_in: Number($('#inputDesToken').val() || 0),
            sc_in: ($('#inputSCToken').val() || '').trim(),
            symbol_out: ($('#inputSymbolPair').val() || '').trim(),
            des_out: Number($('#inputDesPair').val() || 0),
            sc_out: ($('#inputSCPair').val() || '').trim(),
            chain: String($('#FormEditKoinModal #mgrChain').val() || '').toLowerCase(),
            status: readStatusRadio(),
            ...readCexSelectionFromForm(),
            ...readDexSelectionFromForm()
        };

        if (!updatedToken.symbol_in || !updatedToken.symbol_out) return (typeof toast !== 'undefined' && toast.warning) ? toast.warning('Symbol Token & Pair tidak boleh kosong') : undefined;
        // Removed 4-DEX selection cap: allow any number of DEX

        const m = getAppMode();
        let tokens = (m.type === 'single') ? getTokensChain(m.chain) : getTokensMulti();
        const idx = tokens.findIndex(t => String(t.id) === String(id));

        const buildDataCexs = (prev = {}) => {
            const obj = {};
            (updatedToken.selectedCexs || []).forEach(cx => {
                const up = String(cx).toUpperCase();
                obj[up] = prev[up] || { feeWDToken: 0, feeWDPair: 0, depositToken: false, withdrawToken: false, depositPair: false, withdrawPair: false };
            });
            return obj;
        };
        updatedToken.dataCexs = buildDataCexs(idx !== -1 ? tokens[idx].dataCexs : {});

        if (idx !== -1) {
            tokens[idx] = { ...tokens[idx], ...updatedToken };
        } else {
            tokens.push(updatedToken);
        }

        if (m.type === 'single') setTokensChain(m.chain, tokens); else setTokensMulti(tokens);
        if (typeof toast !== 'undefined' && toast.success) toast.success(idx !== -1 ? 'Perubahan token berhasil disimpan' : 'Token baru berhasil ditambahkan');
        // Refresh both monitoring and management views according to mode
        try {
            if (m.type === 'single') { loadAndDisplaySingleChainTokens(); }
            else { refreshTokensTable(); }
            if (typeof renderFilterCard === 'function') renderFilterCard();
            renderTokenManagementList();
        } catch(_) {}
        try {
            const action = (idx !== -1) ? 'UBAH KOIN' : 'TAMBAH KOIN';
            const chainLbl = String(updatedToken.chain || (m.type==='single'? m.chain : 'all')).toUpperCase();
            setLastAction(`${action}`);
        } catch(_) { setLastAction('UBAH KOIN'); }
        if (window.UIkit?.modal) UIkit.modal('#FormEditKoinModal').hide();
    });

    $(document).on('click', '#HapusEditkoin', function (e) {
        e.preventDefault();
        const id = $('#multiTokenIndex').val();
        if (!id) return (typeof toast !== 'undefined' && toast.error) ? toast.error('ID token tidak ditemukan.') : undefined;

        // Compose detailed confirmation message
        const symIn  = String(($('#inputSymbolToken').val() || '')).trim().toUpperCase();
        const symOut = String(($('#inputSymbolPair').val() || '')).trim().toUpperCase();
        const mode = getAppMode();
        const chainSel = String($('#FormEditKoinModal #mgrChain').val() || (mode.type==='single'? mode.chain : '')).toUpperCase();
        let cexList = '-';
        let dexList = '-';
        try {
            const cex = (readCexSelectionFromForm()?.selectedCexs || []).map(x=>String(x).toUpperCase());
            const dex = (readDexSelectionFromForm()?.selectedDexs || []).map(x=>String(x).toUpperCase());
            cexList = cex.length ? cex.join(', ') : '-';
            dexList = dex.length ? dex.join(', ') : '-';
        } catch(_) {}
        const detailMsg = `⚠️ INGIN HAPUS DATA KOIN INI?\n\n`+
                          `- Pair : ${symIn || '?'} / ${symOut || '?'}\n`+
                          `- Chain: ${chainSel || '?'}\n`+
                          `- CEX  : ${cexList}\n`+
                          `- DEX  : ${dexList}`;

        if (confirm(detailMsg)) {
            deleteTokenById(id);
            if (typeof toast !== 'undefined' && toast.success) toast.success(`KOIN TERHAPUS`);
            if (window.UIkit?.modal) UIkit.modal('#FormEditKoinModal').hide();
            // Live refresh current view without reloading page (works during scanning)
            try {
                const m = getAppMode();
                if (m.type === 'single') { loadAndDisplaySingleChainTokens(); }
                else { refreshTokensTable(); }
                renderTokenManagementList();
            } catch(_) {}
        }
    });

    // Copy current edited token to Multichain store (from per-chain edit modal)
    $(document).on('click', '#CopyToMultiBtn', function(){
        try {
            const mode = getAppMode();
            if (mode.type !== 'single') {
                if (typeof toast !== 'undefined' && toast.info) toast.info('Tombol ini hanya tersedia pada mode per-chain.');
                return;
            }
            const chainKey = String(mode.chain).toLowerCase();
            const id = $('#multiTokenIndex').val();
            let singleTokens = getTokensChain(chainKey);
            const idx = singleTokens.findIndex(t => String(t.id) === String(id));
            const prevDataCexs = idx !== -1 ? (singleTokens[idx].dataCexs || {}) : {};

            const tokenObj = {
                id: id || Date.now().toString(),
                symbol_in: ($('#inputSymbolToken').val() || '').trim(),
                des_in: Number($('#inputDesToken').val() || 0),
                sc_in: ($('#inputSCToken').val() || '').trim(),
                symbol_out: ($('#inputSymbolPair').val() || '').trim(),
                des_out: Number($('#inputDesPair').val() || 0),
                sc_out: ($('#inputSCPair').val() || '').trim(),
                chain: chainKey,
                status: readStatusRadio(),
                ...readCexSelectionFromForm(),
                ...readDexSelectionFromForm()
            };

            if (!tokenObj.symbol_in || !tokenObj.symbol_out) return (typeof toast !== 'undefined' && toast.warning) ? toast.warning('Symbol Token & Pair tidak boleh kosong') : undefined;
            // Removed 4-DEX selection cap: allow any number of DEX

            // Build dataCexs preserving previous per-chain CEX details if available
            const dataCexs = {};
            (tokenObj.selectedCexs || []).forEach(cx => {
                const up = String(cx).toUpperCase();
                dataCexs[up] = prevDataCexs[up] || { feeWDToken: 0, feeWDPair: 0, depositToken: false, withdrawToken: false, depositPair: false, withdrawPair: false };
            });
            tokenObj.dataCexs = dataCexs;

            // Upsert into TOKEN_MULTICHAIN by (chain, symbol_in, symbol_out)
            let multi = getTokensMulti();
            const matchIdx = multi.findIndex(t => String(t.chain).toLowerCase() === chainKey && String(t.symbol_in||'').toUpperCase() === tokenObj.symbol_in.toUpperCase() && String(t.symbol_out||'').toUpperCase() === tokenObj.symbol_out.toUpperCase());
            let proceed = true;
            if (matchIdx !== -1) {
                proceed = confirm('DATA KOIN di mode Multichain SUDAH ADA. Ganti dengan data ini?');
                if (!proceed) return;
                multi[matchIdx] = { ...multi[matchIdx], ...tokenObj };
            } else {
                multi.push(tokenObj);
            }
            setTokensMulti(multi);
            if (typeof toast !== 'undefined' && toast.success) toast.success('Koin berhasil disalin ke mode Multichain');
            $('#FormEditKoinModal').hide();
            try { if (typeof renderFilterCard === 'function') renderFilterCard(); } catch(_){}
        } catch(e) {
            // console.error('Copy to Multichain failed:', e);
            if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal menyalin ke Multichain');
        }
    });

    $('#mgrTbody').on('click', '.mgrEdit', function () {
        try {
            const id = $(this).data('id');
            if (id) {
                openEditModalById(id);
            } else {
                if (typeof toast !== 'undefined' && toast.error) toast.error('ID token tidak ditemukan pada tombol edit.');
            }
        } catch (e) {
            // console.error('Gagal membuka modal edit dari manajemen list:', e);
            if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal membuka form edit.');
        }
    });

    $(document).on('change', '.mgrStatus', function(){
        const id = String($(this).data('id'));
        const val = $(this).val() === 'true';
        const m = getAppMode();
        let tokens = (m.type === 'single') ? getTokensChain(m.chain) : getTokensMulti();
        const idx = tokens.findIndex(t => String(t.id) === id);
        if (idx !== -1) {
            tokens[idx].status = val;
            if (m.type === 'single') setTokensChain(m.chain, tokens); else setTokensMulti(tokens);
            if (typeof toast !== 'undefined' && toast.success) toast.success(`Status diubah ke ${val ? 'ON' : 'OFF'}`);
            try {
                const chainLbl = String(tokens[idx]?.chain || (m.type==='single'? m.chain : 'all')).toUpperCase();
                const pairLbl = `${String(tokens[idx]?.symbol_in||'').toUpperCase()}/${String(tokens[idx]?.symbol_out||'').toUpperCase()}`;
                setLastAction(`UBAH STATUS KOIN`);
            } catch(_) { setLastAction('UBAH STATUS KOIN'); }
        }
    });

// =================================================================================
// Sync Modal Helpers (Server / Snapshot)
// =================================================================================
// REFACTORED: Snapshot operations now unified in snapshot-new.js
// - processSnapshotForCex() handles all CEX data fetching and enrichment
// - saveToSnapshot() moved to snapshot-new.js (exported via window.SnapshotModule)
// - Single IndexedDB storage for all snapshot data (SNAPSHOT_DATA_KOIN key)
//
// This file only handles:
// - Loading snapshot data to modal UI
// - Fetching from remote JSON server (fallback)
// - Modal interaction handlers
// =================================================================================

const SNAPSHOT_DB_CONFIG = (function(){
    const root = (typeof window !== 'undefined') ? window : {};
    const appCfg = (root.CONFIG_APP && root.CONFIG_APP.APP) ? root.CONFIG_APP.APP : {};
    const dbCfg = root.CONFIG_DB || {};
    return {
        name: dbCfg.NAME || appCfg.NAME || 'MULTIALL-PLUS',
        store: (dbCfg.STORES && dbCfg.STORES.SNAPSHOT) ? dbCfg.STORES.SNAPSHOT : 'SNAPSHOT_STORE',
        snapshotKey: 'SNAPSHOT_DATA_KOIN'
    };
})();
let snapshotDbInstance = null;

function setSyncSourceIndicator(label) {
    try {
        $('#sync-source-indicator').text(label || '-');
    } catch(_) {}
}

// ====================================================================================
// SNAPSHOT PROCESS FUNCTIONS
// ====================================================================================

// =================================================================================
// SNAPSHOT OVERLAY SYSTEM - Modern AppOverlay Integration
// =================================================================================
// Modern overlay system using AppOverlay manager with full progress tracking
// Optimized for snapshot and wallet exchanger operations

const SnapshotOverlay = (function() {
    let overlayId = null;
    const OVERLAY_ID = 'snapshot-process-overlay';

    return {
        /**
         * Show overlay with initial message
         * @param {string} title - Main title/message
         * @param {string} subtitle - Subtitle/phase info
         */
        show(title = 'Memproses...', subtitle = '') {
            try {
                // Hide existing overlay if any
                if (overlayId) {
                    this.hide();
                }

                // Create new overlay with progress
                overlayId = AppOverlay.showProgress({
                    id: OVERLAY_ID,
                    title: title,
                    message: subtitle,
                    progressValue: 0,
                    progressMax: 100,
                    canClose: false
                });

                // console.log(`[SnapshotOverlay] Shown: ${title}`);
            } catch(error) {
                // console.error('[SnapshotOverlay.show] Error:', error);
            }
        },

        /**
         * Hide overlay with optional delay
         * @param {number} delay - Delay in milliseconds before hiding (default: 0)
         */
        hide(delay = 0) {
            try {
                const doHide = () => {
                    if (overlayId) {
                        AppOverlay.hide(overlayId);
                        overlayId = null;
                        // console.log('[SnapshotOverlay] Hidden');
                    }
                };

                if (delay > 0) {
                    setTimeout(doHide, delay);
                } else {
                    doHide();
                }
            } catch(error) {
                // console.error('[SnapshotOverlay.hide] Error:', error);
            }
        },

        /**
         * Update progress bar
         * @param {number} current - Current progress value
         * @param {number} total - Total/max value
         * @param {string} message - Progress message
         */
        updateProgress(current, total, message = '') {
            try {
                if (!overlayId) return;

                AppOverlay.updateProgress(overlayId, current, total, message);
            } catch(error) {
                // console.error('[SnapshotOverlay.updateProgress] Error:', error);
            }
        },

        /**
         * Update overlay message/subtitle
         * @param {string} title - Main title (optional, keeps current if not provided)
         * @param {string} subtitle - Subtitle/phase (optional)
         */
        updateMessage(title, subtitle) {
            try {
                if (!overlayId) return;

                // Update subtitle/message if provided
                if (subtitle !== undefined) {
                    AppOverlay.updateMessage(overlayId, subtitle);
                }

                // Update title if provided
                if (title !== undefined && title !== null) {
                    const overlay = AppOverlay.get(overlayId);
                    if (overlay && overlay.element) {
                        const titleEl = overlay.element.querySelector('.app-overlay-title');
                        if (titleEl) {
                            // Preserve spinner if exists
                            const spinner = titleEl.querySelector('.app-overlay-spinner');
                            titleEl.textContent = title;
                            if (spinner) {
                                titleEl.insertBefore(spinner, titleEl.firstChild);
                            }
                        }
                    }
                }
            } catch(error) {
                // console.error('[SnapshotOverlay.updateMessage] Error:', error);
            }
        },

        /**
         * Show success message and auto-hide
         * @param {string} message - Success message
         * @param {number} autoHideDelay - Delay before auto-hide (default: 1500ms)
         */
        showSuccess(message, autoHideDelay = 1500) {
            try {
                this.updateMessage('✅ Berhasil!', message);
                this.updateProgress(100, 100, '');
                this.hide(autoHideDelay);
            } catch(error) {
                // console.error('[SnapshotOverlay.showSuccess] Error:', error);
            }
        },

        /**
         * Show error message and auto-hide
         * @param {string} message - Error message
         * @param {number} autoHideDelay - Delay before auto-hide (default: 2000ms)
         */
        showError(message, autoHideDelay = 2000) {
            try {
                this.updateMessage('❌ Gagal!', message);
                this.hide(autoHideDelay);
            } catch(error) {
                // console.error('[SnapshotOverlay.showError] Error:', error);
            }
        },

        /**
         * Check if overlay is currently shown
         */
        isShown() {
            return overlayId !== null;
        }
    };
})();

// Export to window for backward compatibility
window.SnapshotOverlay = SnapshotOverlay;

// Legacy API for backward compatibility with existing code
window.showSyncOverlay = (msg, phase) => SnapshotOverlay.show(msg, phase);
window.hideSyncOverlay = (delay) => SnapshotOverlay.hide(delay || 0);
window.updateSyncOverlayProgress = (current, total, phase) => SnapshotOverlay.updateProgress(current, total, phase);
window.setSyncOverlayMessage = (msg, phase) => SnapshotOverlay.updateMessage(phase, msg);

// Ensure snapshot-new.js has initialized the global module before use
let snapshotModuleLoader = null;
async function ensureSnapshotModuleLoaded() {
    const isReady = () => window.SnapshotModule && typeof window.SnapshotModule.processSnapshotForCex === 'function';
    if (isReady()) return window.SnapshotModule;
    if (snapshotModuleLoader) return snapshotModuleLoader;

    snapshotModuleLoader = new Promise((resolve, reject) => {
        let timer = null;
        const start = Date.now();
        const timeout = 10000;
        const tickInterval = 100;

        const finishIfReady = () => {
            if (isReady()) {
                if (timer) clearInterval(timer);
                resolve(window.SnapshotModule);
                return true;
            }
            return false;
        };

        const existingScript = Array.from(document.getElementsByTagName('script'))
            .find(s => typeof s.src === 'string' && s.src.includes('snapshot-new.js'));

        const attachListeners = (scriptEl) => {
            if (!scriptEl) return;
            scriptEl.addEventListener('load', () => finishIfReady(), { once: true });
            scriptEl.addEventListener('error', () => {
                if (timer) clearInterval(timer);
                reject(new Error('Snapshot module gagal dimuat'));
            }, { once: true });
        };

        if (!existingScript) {
            const head = document.head || document.getElementsByTagName('head')[0];
            if (!head) {
                reject(new Error('Tidak dapat menemukan elemen <head> untuk memuat snapshot module'));
                return;
            }
            const script = document.createElement('script');
            script.src = 'snapshot-new.js';
            script.async = false;
            attachListeners(script);
            head.appendChild(script);
        } else {
            attachListeners(existingScript);
        }

        if (finishIfReady()) return;

        timer = setInterval(() => {
            if (finishIfReady()) return;
            if ((Date.now() - start) >= timeout) {
                clearInterval(timer);
                reject(new Error('Snapshot module belum siap (timeout)'));
            }
        }, tickInterval);
    }).finally(() => {
        snapshotModuleLoader = null;
    });

    return snapshotModuleLoader;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function resetSyncModalSelections() {
    try {
        // Reset radio button selection dan disable sampai tabel selesai di-render
        const $modeRadios = $('input[name="sync-pick-mode"]');
        $modeRadios.prop('checked', false);
        $modeRadios.prop('disabled', true);

        // Visual feedback: disabled state
        $modeRadios.closest('label').css({
            opacity: '0.5',
            pointerEvents: 'none',
            cursor: 'not-allowed'
        });
    } catch(_) {}
}

function setSyncModalData(chainKey, rawTokens, savedTokens, sourceLabel) {
    try {
        // console.log('setSyncModalData called:', {
            // chainKey,
            // rawTokensLength: rawTokens?.length,
            // savedTokensLength: savedTokens?.length,
            // sourceLabel
        // });

        const chainLower = String(chainKey || '').toLowerCase();
        const normalizedSource = (String(sourceLabel || 'server').toLowerCase().includes('snapshot')) ? 'snapshot' : 'server';
        const list = Array.isArray(rawTokens) ? rawTokens.map((item, idx) => {
            const clone = Object.assign({}, item);
            if (typeof clone._idx !== 'number') clone._idx = idx;
            if (!clone.__source) clone.__source = normalizedSource;
            return clone;
        }) : [];

        // console.log('Processed list:', list.length, 'items');

        const $modal = $('#sync-modal');
        $modal.data('remote-raw', list);
        const savedList = Array.isArray(savedTokens) ? savedTokens : [];
        $modal.data('saved-tokens', savedList);
        $modal.data('source', normalizedSource);
        resetSyncModalSelections();
        const labelText = `${sourceLabel || 'Server'} (${list.length})`;
        setSyncSourceIndicator(labelText);
        buildSyncFilters(chainLower);

        // console.log('About to render table for chain:', chainLower);
        renderSyncTable(chainLower);
    } catch(error) {
        // console.error('setSyncModalData failed:', error);
    }
}

function parseNumberSafe(val, fallback = 0) {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
}

function parseSnapshotStatus(val) {
    if (val === undefined || val === null || val === '') return null;
    if (val === true) return true;
    if (val === false) return false;
    const str = String(val).toLowerCase();
    if (['on', 'true', 'yes', 'open', 'enabled', 'aktif', '1'].includes(str)) return true;
    if (['off', 'false', 'no', 'close', 'closed', 'disabled', 'nonaktif', 'tidak', '0'].includes(str)) return false;
    return null;
}
try { window.parseSnapshotStatus = parseSnapshotStatus; } catch(_) {}

function readNonPairConfig() {
    try {
        const pairSymbol = ($('#sync-non-pair-name').val() || '').trim().toUpperCase();
        const pairSc = ($('#sync-non-pair-sc').val() || '').trim();
        const desRaw = $('#sync-non-pair-des').val();
        const desVal = desRaw === '' ? null : Number(desRaw);
        return {
            symbol: pairSymbol,
            sc: pairSc,
            des: Number.isFinite(desVal) && desVal >= 0 ? desVal : null
        };
    } catch(_) {
        return { symbol:'', sc:'', des:null };
    }
}

function toggleNonPairInputs() {
    try {
        // Check if NON is selected (radio button)
        const isNonChecked = $('#sync-filter-pair input[type="radio"]:checked').val() === 'NON';
        $('#sync-non-config').css('display', isNonChecked ? 'block' : 'none');

        // If NON is selected, validate inputs and update button state
        if (isNonChecked) {
            validateNonPairInputs();
        }
    } catch(_) {}
}

try { window.toggleNonPairInputs = toggleNonPairInputs; } catch(_) {}

function validateNonPairInputs() {
    try {
        const isNonSelected = $('#sync-filter-pair input[type="radio"]:checked').val() === 'NON';
        if (!isNonSelected) return true; // Not NON, no validation needed

        const pairName = String($('#sync-non-pair-name').val() || '').trim();
        const pairSc = String($('#sync-non-pair-sc').val() || '').trim();
        const pairDes = $('#sync-non-pair-des').val();

        const isValid = pairName && pairSc && pairDes && Number.isFinite(Number(pairDes));

        // Update visual feedback HANYA untuk input NON (cepat)
        $('#sync-non-pair-name').toggleClass('uk-form-danger', !pairName);
        $('#sync-non-pair-sc').toggleClass('uk-form-danger', !pairSc);
        $('#sync-non-pair-des').toggleClass('uk-form-danger', !pairDes || !Number.isFinite(Number(pairDes)));

        // ========== OPTIMASI: Update button state secara langsung ==========
        // Jangan panggil updateAddTokenButtonState() karena itu query semua checkbox (lambat!)
        // Langsung update button Save berdasarkan validasi NON saja
        const $saveBtn = $('#sync-save-btn');
        if ($saveBtn.length) {
            // Jika NON dipilih, button Save enable/disable berdasarkan validasi input NON
            // (Asumsi: koin sudah dipilih sebelumnya, pair baru bisa diklik)
            $saveBtn.prop('disabled', !isValid);
            if (!isValid) {
                $saveBtn.attr('title', 'Lengkapi data Pair NON terlebih dahulu');
            } else {
                $saveBtn.removeAttr('title');
            }
        }
        // =====================================================================

        return isValid;
    } catch(e) {
        // console.error('validateNonPairInputs error:', e);
        return false;
    }
}
try { window.validateNonPairInputs = validateNonPairInputs; } catch(_) {}

function updateAddTokenButtonState() {
    try {
        // Update both "Save" button in modal footer and any other add buttons
        const $addBtn = $('#sync-save-btn, .sync-add-token-button, #btn-add-sync-tokens');
        if (!$addBtn.length) return;

        // Cek apakah ada koin yang dipilih
        const hasSelection = $('#sync-modal-tbody .sync-token-checkbox:checked').length > 0;
        const isNonSelected = $('#sync-filter-pair input[type="radio"]:checked').val() === 'NON';

        let canSave = hasSelection;
        let tooltipMsg = '';

        if (!hasSelection) {
            canSave = false;
            tooltipMsg = 'Pilih minimal 1 koin untuk disimpan';
        } else if (isNonSelected) {
            // Check if NON inputs are valid
            const isValid = validateNonPairInputs();
            canSave = isValid;
            if (!isValid) {
                tooltipMsg = 'Lengkapi data Pair NON terlebih dahulu';
            }
        }

        $addBtn.prop('disabled', !canSave);
        if (tooltipMsg) {
            $addBtn.attr('title', tooltipMsg);
        } else {
            $addBtn.removeAttr('title');
        }
    } catch(_) {}
}
try { window.updateAddTokenButtonState = updateAddTokenButtonState; } catch(_) {}

function updateSyncSelectedCount() {
    try {
        const total = $('#sync-modal-tbody .sync-token-checkbox:checked').length;
        // Update counter dengan angka saja (lebih simpel)
        $('#sync-selected-count').text(total);
        const hasSelection = total > 0;

        console.log(`[updateSyncSelectedCount] Counter updated: ${total} koin dipilih`);

        // ========== RADIO BUTTON ENABLE/DISABLE DIPINDAH KE renderSyncTable() ==========
        // Radio button diaktifkan di renderSyncTable() setelah tabel selesai di-render
        // (TIDAK di sini, agar konsisten dengan konsep baru)
        // ================================================================================

        // ========== PAIR: AKTIF/NONAKTIF SESUAI ADA/TIDAKNYA KOIN YANG DICENTANG ==========
        // Sama seperti DEX, pair hanya aktif jika ada koin yang dipilih
        const $pairRadios = $('#sync-filter-pair input[type="radio"]');
        if ($pairRadios.length) {
            $pairRadios.prop('disabled', !hasSelection);

            // Visual feedback
            $pairRadios.closest('label').css({
                opacity: hasSelection ? '1' : '0.5',
                pointerEvents: hasSelection ? 'auto' : 'none',
                cursor: hasSelection ? 'pointer' : 'not-allowed'
            });

            console.log(`[updateSyncSelectedCount] Pair radios: ${hasSelection ? 'ENABLED' : 'DISABLED'}`);
        }

        // Toggle NON inputs visibility hanya jika TIDAK ada selection
        // Jika ada selection, biarkan handler pair change yang handle toggle
        if (!hasSelection) {
            // Jika tidak ada koin yang dipilih, sembunyikan NON inputs
            $('#sync-non-config').css('display', 'none');
        }
        // =================================================================================

        // Input DEX: aktif/nonaktif sesuai ada/tidaknya koin yang dicentang
        const $dexInputs = $('#sync-dex-config').find('input');
        if ($dexInputs.length) {
            $dexInputs.prop('disabled', !hasSelection);
            $('#sync-dex-config').css({ opacity: hasSelection ? '' : '0.5', pointerEvents: hasSelection ? '' : 'none' });
        }

        // Update tombol SAVE: hanya aktif jika ada koin yang dipilih
        const $saveBtn = $('#sync-save-btn');
        if ($saveBtn.length) {
            // Cek juga apakah pair NON dan perlu validasi
            const isNonSelected = $('#sync-filter-pair input[type="radio"]:checked').val() === 'NON';
            let canSave = hasSelection;

            if (isNonSelected && hasSelection) {
                // Jika pair NON dipilih, cek validasi NON inputs
                canSave = typeof validateNonPairInputs === 'function' ? validateNonPairInputs() : true;
            }

            $saveBtn.prop('disabled', !canSave);

            if (!hasSelection) {
                $saveBtn.attr('title', 'Pilih minimal 1 koin untuk disimpan');
            } else if (isNonSelected && !canSave) {
                $saveBtn.attr('title', 'Lengkapi data Pair NON terlebih dahulu');
            } else {
                $saveBtn.removeAttr('title');
            }
        }
    } catch(_) {}
}
try { window.updateSyncSelectedCount = updateSyncSelectedCount; } catch(_) {}

const SYNC_PRICE_CACHE_TTL = 60000; // 60 detik
function getSyncPriceCache() {
    if (!window.__SYNC_PRICE_CACHE) window.__SYNC_PRICE_CACHE = new Map();
    return window.__SYNC_PRICE_CACHE;
}

function formatSyncPriceValue(price, currency) {
    if (!Number.isFinite(price) || price <= 0) return '-';

    // Format berbeda untuk IDR vs USDT
    const curr = String(currency || 'USDT').toUpperCase();
    let formatted = '';

    if (curr === 'IDR') {
        // IDR: format dengan pemisah ribuan, tanpa desimal untuk nilai besar
        if (price >= 1000) {
            formatted = new Intl.NumberFormat('id-ID', {
                style: 'decimal',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(price);
        } else {
            formatted = new Intl.NumberFormat('id-ID', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price);
        }
        return `Rp ${formatted}`;
    } else {
        // USDT/other crypto: use existing formatPrice or standard format
        if (typeof formatPrice === 'function') {
            formatted = formatPrice(price);
        } else {
            formatted = price.toFixed(price >= 1 ? 4 : 6);
        }
        return `$${formatted}`;
    }
}
try { window.formatSyncPriceValue = formatSyncPriceValue; } catch(_) {}

function setSyncPriceCell(cex, symbol, pair, price, renderId, currency) {
    const $cell = $(`#sync-modal-tbody td[data-price-cex="${cex}"][data-symbol="${symbol}"][data-pair="${pair}"]`);
    if (!$cell.length) return;
    const currentToken = Number($cell.data('render-id')) || 0;
    if (renderId && currentToken && renderId !== currentToken) return;
    if (renderId) $cell.data('render-id', renderId);
    // Determine currency: INDODAX uses IDR, others use USDT/pair
    const priceCurrency = currency || (String(cex).toUpperCase() === 'INDODAX' ? 'IDR' : 'USDT');
    $cell.text(formatSyncPriceValue(price, priceCurrency));
}

function getSyncProxyPrefix() {
    try {
        return (window.CONFIG_PROXY && window.CONFIG_PROXY.PREFIX) || 'https://proxykanan.awokawok.workers.dev/?';
    } catch(_) {
        return 'https://proxykanan.awokawok.workers.dev/?';
    }
}

function proxSync(url) {
    if (!url) return url;
    try {
        const prefix = getSyncProxyPrefix();
        if (!prefix) return url;
        if (url.startsWith(prefix)) return url;
        if (/^https?:\/\//i.test(url)) return prefix + url;
    } catch(_) {}
    return url;
}

const SYNC_TICKER_CACHE_TTL = 60000;
const SYNC_TICKER_CACHE = new Map();

const SYNC_TICKER_ENDPOINTS = {
    BINANCE: {
        url: 'https://data-api.binance.vision/api/v3/ticker/price',
        proxy: false,
        parser: (data) => {
            const map = new Map();
            if (Array.isArray(data)) {
                data.forEach(item => {
                    const symbol = String(item?.symbol || '').toUpperCase();
                    const price = Number(item?.price);
                    if (!symbol || !Number.isFinite(price)) return;
                    map.set(symbol, price);
                });
            }
            return map;
        }
    },
    MEXC: {
        url: 'https://api.mexc.com/api/v3/ticker/price',
        proxy: true,
        parser: (data) => {
            const map = new Map();
            if (Array.isArray(data)) {
                data.forEach(item => {
                    const symbol = String(item?.symbol || '').toUpperCase();
                    const price = Number(item?.price);
                    if (!symbol || !Number.isFinite(price)) return;
                    map.set(symbol, price);
                });
            }
            return map;
        }
    },
    GATE: {
        url: 'https://api.gateio.ws/api/v4/spot/tickers',
        proxy: true,
        parser: (data) => {
            const map = new Map();
            if (Array.isArray(data)) {
                data.forEach(item => {
                    const pair = String(item?.currency_pair || '').toUpperCase();
                    const price = Number(item?.last || item?.last_price || item?.close);
                    if (!pair || !Number.isFinite(price)) return;
                    map.set(pair.replace('/', '_'), price);
                    map.set(pair.replace('_', ''), price);
                    map.set(pair.replace('_', '-'), price);
                });
            }
            return map;
        }
    },
    KUCOIN: {
        url: 'https://api.kucoin.com/api/v1/market/allTickers',
        proxy: true,
        parser: (data) => {
            const map = new Map();
            const list = data?.data?.ticker;
            if (Array.isArray(list)) {
                list.forEach(item => {
                    const symbol = String(item?.symbol || '').toUpperCase();
                    const price = Number(item?.last || item?.lastTradedPrice || item?.lastPrice || item?.close);
                    if (!symbol || !Number.isFinite(price)) return;
                    map.set(symbol, price);
                    map.set(symbol.replace('-', ''), price);
                    map.set(symbol.replace('-', '_'), price);
                });
            }
            return map;
        }
    },
    OKX: {
        url: 'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
        proxy: true,
        parser: (data) => {
            const map = new Map();
            const list = data?.data;
            if (Array.isArray(list)) {
                list.forEach(item => {
                    const symbol = String(item?.instId || '').toUpperCase();
                    const price = Number(item?.last || item?.lastPrice || item?.close);
                    if (!symbol || !Number.isFinite(price)) return;
                    map.set(symbol, price);
                    map.set(symbol.replace('-', ''), price);
                    map.set(symbol.replace('-', '_'), price);
                });
            }
            return map;
        }
    },
    BITGET: {
        url: 'https://api.bitget.com/api/v2/spot/market/tickers',
        proxy: false,
        parser: (data) => {
            const map = new Map();
            const list = data?.data;
            if (Array.isArray(list)) {
                list.forEach(item => {
                    const symbol = String(item?.symbol || '').toUpperCase();
                    const price = Number(item?.last || item?.close || item?.latestPrice);
                    if (!symbol || !Number.isFinite(price)) return;
                    map.set(symbol, price);
                });
            }
            return map;
        }
    },
    BYBIT: {
        url: 'https://api.bybit.com/v5/market/tickers?category=spot',
        proxy: true,
        parser: (data) => {
            const map = new Map();
            const list = data?.result?.list;
            if (Array.isArray(list)) {
                list.forEach(item => {
                    const symbol = String(item?.symbol || '').toUpperCase();
                    const price = Number(item?.lastPrice || item?.last || item?.price);
                    if (!symbol || !Number.isFinite(price)) return;
                    map.set(symbol, price);
                });
            }
            return map;
        }
    },
    INDODAX: {
        url: 'https://indodax.com/api/ticker_all',
        proxy: true,
        parser: (data) => {
            const map = new Map();
            if (!data || typeof data !== 'object') return map;
            const tickers = data.tickers || data.Tickers || data;
            const rateStored = Number(getFromLocalStorage('PRICE_RATE_USDT') || 0);
            const usdtTicker = tickers['usdt_idr'] || tickers['usdtidr'] || tickers['USDT_IDR'] || tickers['USDTIDR'];
            const usdtRate = Number(usdtTicker?.last || usdtTicker?.buy || usdtTicker?.sell || rateStored);
            Object.keys(tickers || {}).forEach(pair => {
                const info = tickers[pair];
                const lastRaw = info?.last ?? info?.close ?? info?.price ?? info?.sell ?? info?.buy;
                const last = Number(lastRaw);
                if (!Number.isFinite(last) || last <= 0) return;
                const upper = String(pair || '').toUpperCase();
                if (upper) {
                    map.set(upper, last);
                    map.set(upper.replace('_', ''), last);
                    map.set(upper.replace('-', ''), last);
                }
                if (upper.endsWith('IDR')) {
                    const base = upper.replace('_IDR', '').replace('IDR', '').replace('-', '').toUpperCase();
                    const rate = Number.isFinite(usdtRate) && usdtRate > 0 ? usdtRate : rateStored;
                    if (rate > 0 && base) {
                        const usdtPrice = last / rate;
                        map.set(`${base}USDT`, usdtPrice);
                        map.set(`${base}_USDT`, usdtPrice);
                        map.set(`${base}-USDT`, usdtPrice);
                    }
                }
            });
            return map;
        }
    }
};

async function fetchTickerMapForCex(cex) {
    const key = String(cex || '').toUpperCase();
    const cached = SYNC_TICKER_CACHE.get(key);
    const now = Date.now();
    if (cached && (now - cached.ts) < SYNC_TICKER_CACHE_TTL) {
        return cached.map;
    }
    const endpoint = SYNC_TICKER_ENDPOINTS[key];
    if (!endpoint) throw new Error(`Ticker endpoint untuk ${key} tidak tersedia`);
    const targetUrl = endpoint.proxy ? proxSync(endpoint.url) : endpoint.url;
    const resp = await $.getJSON(targetUrl);
    const map = endpoint.parser(resp) || new Map();
    SYNC_TICKER_CACHE.set(key, { map, ts: now });
    return map;
}

function resolveTickerPriceFromMap(cex, map, base, quote) {
    if (!map) return NaN;
    const b = String(base || '').toUpperCase();
    const q = String(quote || '').toUpperCase();
    const candidates = [
        `${b}${q}`,
        `${b}_${q}`,
        `${b}-${q}`,
        `${b}/${q}`,
        `${b}:${q}`
    ];
    for (const key of candidates) {
        if (map.has(key)) return Number(map.get(key));
    }
    return NaN;
}

function queueSyncPriceFetch(job) {
    window.__SYNC_PRICE_QUEUE = window.__SYNC_PRICE_QUEUE || [];
    window.__SYNC_PRICE_QUEUE.push(job);
    processSyncPriceQueue();
}
try { window.queueSyncPriceFetch = queueSyncPriceFetch; } catch(_) {}

async function processSyncPriceQueue() {
    if (window.__SYNC_PRICE_ACTIVE) return;
    const queue = window.__SYNC_PRICE_QUEUE || [];
    const next = queue.shift();
    if (!next) return;
    window.__SYNC_PRICE_ACTIVE = true;
    const cache = getSyncPriceCache();
    const cacheKey = `${next.cex}__${next.symbol}__${next.pair}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.ts) < SYNC_PRICE_CACHE_TTL) {
        setSyncPriceCell(next.cex, next.symbol, next.pair, cached.price, next.renderId);
        window.__SYNC_PRICE_ACTIVE = false;
        processSyncPriceQueue();
        return;
    }
    try {
        const map = await fetchTickerMapForCex(next.cex);
        let price = resolveTickerPriceFromMap(next.cex, map, next.symbol, next.pair);
        if (!Number.isFinite(price) || price <= 0) price = NaN;
        if (Number.isFinite(price) && price > 0) {
            cache.set(cacheKey, { price, ts: now });
        }
        setSyncPriceCell(next.cex, next.symbol, next.pair, price, next.renderId);
    } catch(err) {
        setSyncPriceCell(next.cex, next.symbol, next.pair, NaN, next.renderId);
    } finally {
        window.__SYNC_PRICE_ACTIVE = false;
        if (queue.length) processSyncPriceQueue();
    }
}

function normalizeSnapshotRecord(rec, chainKey) {
    if (!rec) return null;
    const cex = String(rec.cex || rec.exchange || '').toUpperCase().trim();
    const symbol = String(rec.symbol_in || rec.symbol || rec.ticker || rec.koin || rec.token || '').toUpperCase().trim();
    const sc = String(rec.sc_in || rec.sc || rec.contract || rec.address || '').trim();

    // Require at least CEX and symbol (SC bisa kosong)
    if (!cex || !symbol) {
        // console.warn('normalizeSnapshotRecord - Missing required fields:', { cex, symbol });
        return null;
    }

    return {
        __source: 'snapshot',
        chain: String(chainKey || '').toLowerCase(),
        cex,
        symbol_in: symbol,
        sc_in: sc,
        des_in: parseNumberSafe(rec.des || rec.decimals || rec.des_in || rec.decimals_in || 0, 0),
        token_name: rec.token_name || rec.name || rec.token || symbol,
        symbol_out: rec.symbol_out || '',
        sc_out: rec.sc_out || '',
        des_out: rec.des_out || 0,
        deposit: rec.deposit,
        withdraw: rec.withdraw,
        feeWD: rec.feeWD,
        current_price: parseNumberSafe(rec.current_price ?? rec.price ?? 0, 0),
        price_timestamp: rec.price_timestamp || rec.price_ts || null
    };
}

// saveToSnapshot() removed - now using window.SnapshotModule.saveToSnapshot() from snapshot-new.js

async function loadSnapshotRecords(chainKey) {
    try {
        const snapshotMap = await (window.snapshotDbGet ? window.snapshotDbGet(SNAPSHOT_DB_CONFIG.snapshotKey) : Promise.resolve(null));
        // console.log('loadSnapshotRecords - snapshotMap:', snapshotMap);

        if (!snapshotMap || typeof snapshotMap !== 'object') {
            // console.warn('loadSnapshotRecords - No snapshot map found');
            return [];
        }

        const keyLower = String(chainKey || '').toLowerCase();
        const fallbackKey = String(chainKey || '').toUpperCase();

        // console.log('loadSnapshotRecords - Looking for keys:', { keyLower, fallbackKey });
        // console.log('loadSnapshotRecords - Available keys:', Object.keys(snapshotMap));

        const arr = Array.isArray(snapshotMap[keyLower]) ? snapshotMap[keyLower]
                  : Array.isArray(snapshotMap[fallbackKey]) ? snapshotMap[fallbackKey]
                  : [];

        // console.log('loadSnapshotRecords - Found array length:', arr.length);

        if (!Array.isArray(arr) || !arr.length) {
            // console.warn('loadSnapshotRecords - Empty array');
            return [];
        }

        const seen = new Set();
        const out = [];
        arr.forEach((rec) => {
            const norm = normalizeSnapshotRecord(rec, keyLower);
            if (!norm) return;
            const dedupKey = `${norm.cex}__${norm.symbol_in}__${String(norm.sc_in || '').toLowerCase()}`;
            if (seen.has(dedupKey)) return;
            seen.add(dedupKey);
            norm._idx = out.length;
            out.push(norm);
        });

        // console.log('loadSnapshotRecords - Returning:', out.length, 'tokens');
        return out;
    } catch(error) {
        // console.error('loadSnapshotRecords failed:', error);
        return [];
    }
}

async function fetchTokensFromServer(chainKey) {
    const keyLower = String(chainKey || '').toLowerCase();
    const cfg = (window.CONFIG_CHAINS || {})[keyLower];
    if (!cfg || !cfg.DATAJSON) throw new Error(`No datajson URL for ${String(chainKey || '').toUpperCase()}`);
    const remoteTokens = await $.getJSON(cfg.DATAJSON);
    let raw = [];
    if (Array.isArray(remoteTokens)) raw = remoteTokens;
    else if (remoteTokens && Array.isArray(remoteTokens.token)) raw = remoteTokens.token;
    else raw = [];
    const normalizeServerTokenRecord = (item, idx) => {
        const clone = Object.assign({}, item || {});
        const pairDefs = (cfg && cfg.PAIRDEXS) || {};
        const pickFallbackPair = () => {
            const preferred = ['USDT', 'USDC', 'BUSD', 'DAI'];
            for (const code of preferred) {
                if (pairDefs && pairDefs[code]) return code;
            }
            const keys = Object.keys(pairDefs || {});
            if (keys.length) return String(keys[0]).toUpperCase();
            return 'NON';
        };

        clone.cex = String(clone.cex || clone.exchange || '').toUpperCase();
        const symbolRaw = clone.symbol || clone.ticker || clone.token || clone.nama_token || clone.name || '';
        const pairRaw = clone.symbol_out || clone.pair || clone.quote || '';
        const scRaw = clone.sc_in || clone.sc || clone.contract || clone.address || '';
        const decimalsRaw = clone.des_in ?? clone.decimals ?? clone.decimal ?? 0;

        clone.symbol_in = String(symbolRaw || '').toUpperCase();
        clone.symbol_out = String(pairRaw || '').toUpperCase() || pickFallbackPair();
        clone.sc_in = String(scRaw || '').trim();
        clone.des_in = Number(decimalsRaw) || 0;
        clone.token_name = clone.token_name || clone.nama_token || clone.name || clone.symbol_in;
        clone._idx = idx;
        clone.__source = 'server';
        return clone;
    };

    return raw.map((item, idx) => normalizeServerTokenRecord(item, idx));
}

// DEPRECATED: Removed direct server loading from sync modal
// Now using snapshot-only approach with SYNC EXCHANGER button
// async function loadSyncTokensFromServer(chainKey) {
//     const key = String(chainKey || '').toLowerCase();
//     const chainConfig = (window.CONFIG_CHAINS || {})[key];
//     if (!chainConfig || !chainConfig.DATAJSON) throw new Error(`No datajson URL for ${String(chainKey || '').toUpperCase()}`);
//     try { if (typeof toast !== 'undefined' && toast.info) toast.info('Mengambil data koin dari server...'); } catch(_) {}
//     const raw = await fetchTokensFromServer(key);
//     const savedTokens = getTokensChain(chainKey);
//     setSyncModalData(chainKey, raw, savedTokens, 'Server');
//     try { if (typeof toast !== 'undefined' && toast.success) toast.success(`Berhasil memuat ${raw.length} koin dari server`); } catch(_) {}
// }

async function loadSyncTokensFromSnapshot(chainKey, silent = false) {
    const key = String(chainKey || '').toLowerCase();
    const raw = await loadSnapshotRecords(key);
    if (!raw.length) {
        if (!silent) throw new Error('Snapshot kosong untuk chain ini.');
        return false; // Return false instead of throwing when silent
    }
    const savedTokens = getTokensChain(chainKey);
    setSyncModalData(chainKey, raw, savedTokens, 'Snapshot');
    if (!silent) {
        try { if (typeof toast !== 'undefined' && toast.success) toast.success(`Berhasil memuat ${raw.length} koin dari snapshot lokal`); } catch(_) {}
    }
    return true;
}

// Single Chain Mode Handler removed (unified table)

    // Let #home-link perform a full navigation (fresh reload)

    // Token Sync Modal Logic dengan Auto-Fetch JSON
    $(document).on('click', '#sync-tokens-btn', async function() {
        if (!activeSingleChainKey) {
            if (typeof toast !== 'undefined' && toast.error) toast.error("No active chain selected.");
            return;
        }

        const chainConfig = CONFIG_CHAINS[activeSingleChainKey];
        if (!chainConfig || !chainConfig.DATAJSON) {
            if (typeof toast !== 'undefined' && toast.error) toast.error(`No datajson URL for ${String(activeSingleChainKey).toUpperCase()}`);
            return;
        }

        // Reset modal state
        $('#sync-modal-chain-name').text(chainConfig.Nama_Chain || String(activeSingleChainKey).toUpperCase());
        $('#sync-snapshot-chain-label').text(chainConfig.Nama_Chain || String(activeSingleChainKey).toUpperCase());
        $('#sync-modal-tbody').empty().html('<tr><td colspan="8">Memuat Data Koin...</td></tr>');
        $('#sync-snapshot-status').text('Memeriksa database...');
        setSyncSourceIndicator('-');

        // Show modal
        UIkit.modal('#sync-modal').show();

        // Check if data exists in IndexedDB
        let hasSnapshot = false;
        try {
            hasSnapshot = await loadSyncTokensFromSnapshot(activeSingleChainKey, true);
            // console.log('Check snapshot result:', hasSnapshot);
            if (hasSnapshot) {
                $('#sync-snapshot-status').text('Data dimuat dari snapshot');
                // console.log('Snapshot data loaded successfully');
                return; // Data sudah ada, tidak perlu fetch
            }
        } catch(e) {
            // console.log('No snapshot, will fetch from JSON. Error:', e);
        }

        // Data belum ada → Fetch dari DATAJSON
        // console.log('hasSnapshot:', hasSnapshot, '- proceeding to fetch from server');
        $('#sync-snapshot-status').text('Mengambil data dari server...');
        // console.log('Fetching data from server for chain:', activeSingleChainKey);

        try {
            const rawTokens = await fetchTokensFromServer(activeSingleChainKey);
            // console.log('Fetched tokens:', rawTokens.length);

            if (!rawTokens || !rawTokens.length) {
                $('#sync-modal-tbody').html('<tr><td colspan="8">Tidak ada data token dari server</td></tr>');
                $('#sync-snapshot-status').text('Gagal: Data kosong');
                return;
            }

            // Save to IndexedDB
            // console.log('Saving to snapshot...');
            await window.SnapshotModule.saveToSnapshot(activeSingleChainKey, rawTokens);
            // console.log('Saved to snapshot successfully');

            // Load to modal
            const loaded = await loadSyncTokensFromSnapshot(activeSingleChainKey, true);
            // console.log('Load result:', loaded);

            if (loaded) {
                $('#sync-snapshot-status').text(`Data dimuat: ${rawTokens.length} koin`);
                if (typeof toast !== 'undefined' && toast.success) {
                    toast.success(`Berhasil memuat ${rawTokens.length} koin dari server`);
                }
            } else {
                // console.error('Failed to load after save');
                $('#sync-modal-tbody').html('<tr><td colspan="8">Gagal memuat data setelah save</td></tr>');
            }
        } catch(error) {
            // console.error('Fetch JSON failed:', error);
            $('#sync-modal-tbody').html(`<tr><td colspan="8">Gagal mengambil data dari server: ${error.message}</td></tr>`);
            $('#sync-snapshot-status').text('Gagal fetch');
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error(`Gagal: ${error.message || 'Unknown error'}`);
            }
        }
    });

    // Handler untuk CEX checkbox change - Re-render table (no snapshot process needed)
    $(document).on('change', '#sync-filter-cex input[type="checkbox"]', function() {
        if (!activeSingleChainKey) return;

        // Just re-render table with new filters
        renderSyncTable(activeSingleChainKey);
        updateSyncSelectedCount();
    });

    // ========== REFACTOR: Handler untuk Pair radio button change ==========
    // Pair BUKAN filter tampilan dan TIDAK untuk fetch harga
    // Pair HANYA digunakan saat SAVE untuk menentukan symbol_out
    // Fetch harga selalu menggunakan USDT (kecuali INDODAX pakai IDR)
    $(document).on('change', '#sync-filter-pair input[type="radio"]', function() {
        const selectedPair = $(this).val();
        console.log('[Pair Change] Selected pair:', selectedPair, '(HANYA untuk save, BUKAN fetch harga)');

        // Toggle NON pair inputs visibility dan validasi
        // toggleNonPairInputs() akan memanggil validateNonPairInputs() yang sudah update button state
        if (typeof window.toggleNonPairInputs === 'function') {
            window.toggleNonPairInputs();
        }

        console.log('[Pair Change] No table re-render needed - harga tetap pakai USDT');
    });

    // Handler untuk NON pair inputs - Real-time validation
    $(document).on('input change', '#sync-non-pair-name, #sync-non-pair-sc, #sync-non-pair-des', function() {
        if (typeof window.validateNonPairInputs === 'function') {
            window.validateNonPairInputs();
        }
    });

    // Refresh Snapshot - Fetch CEX data & validate with Web3
    $(document).on('click', '#refresh-snapshot-btn', async function() {
        if (!activeSingleChainKey) {
            if (typeof toast !== 'undefined' && toast.error) toast.error("No active chain selected.");
            return;
        }

        // Get modal reference
        const $modal = $('#sync-modal');

        // Get selected CEX from checkboxes
        const selectedCexs = $('#sync-filter-cex input:checked').map(function() {
            return $(this).val();
        }).get();

        if (selectedCexs.length === 0) {
            if (typeof toast !== 'undefined' && toast.warning) {
                toast.warning("Pilih minimal 1 CEX untuk refresh snapshot");
            }
            return;
        }

        // console.log('Refresh snapshot for CEX:', selectedCexs);

        // Disable button during process
        const $btn = $('#refresh-snapshot-btn');
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<span uk-spinner="ratio: 0.6"></span> Processing...');

        const $tbody = $('#sync-modal-tbody');
        const incrementalOrder = [];
        const incrementalMap = new Map();
        const renderIncrementalRows = () => {
            $tbody.empty();
            if (!incrementalOrder.length) {
                $tbody.html('<tr><td colspan="8" class="uk-text-center uk-text-meta">Memuat data koin terbaru...</td></tr>');
                return;
            }
            incrementalOrder.forEach((key, idx) => {
                const token = incrementalMap.get(key);
                if (!token) return;
                const cex = String(token.cex || token.cex_source || '').toUpperCase() || '?';
                const symbol = String(token.symbol_in || token.symbol || '').toUpperCase() || '?';
                const tokenName = token.token_name || token.name || token.symbol_in || '-';
                const scRaw = String(token.sc_in || token.contract_in || '').trim();
                const scDisplay = scRaw ? (scRaw.length > 12 ? `${scRaw.slice(0, 6)}...${scRaw.slice(-4)}` : scRaw) : '?';
                const desRaw = token.des_in ?? token.decimals ?? token.decimals_in;
                const decimals = (Number.isFinite(desRaw) && desRaw >= 0) ? desRaw : '?';
                // Status trade (tradeable) dengan badge ON/OFF
                const tradeableState = parseSnapshotStatus(token.tradeable);
                let tradeBadge = '';

                if (tradeableState === true) {
                    tradeBadge = '<span class="uk-label uk-label-success" style="font-size:10px; padding:3px 8px;">ON</span>';
                } else if (tradeableState === false) {
                    tradeBadge = '<span class="uk-label uk-label-danger" style="font-size:10px; padding:3px 8px;">OFF</span>';
                } else {
                    tradeBadge = '<span class="uk-label" style="font-size:10px; padding:3px 8px; background:#666; color:#fff;">?</span>';
                }

                // CEX display dengan SNAPSHOT badge
                const cexDisplay = `<div class="uk-text-bold uk-text-primary">${cex}</div><div style="font-size:9px; color:#faa05a; font-weight:600; margin-top:2px;">SNAPSHOT</div>`;

                const priceVal = Number(token.current_price ?? token.price ?? token.price_value);
                const priceCurrency = token.price_currency || (cex === 'INDODAX' ? 'IDR' : 'USDT');
                const priceDisplay = (Number.isFinite(priceVal) && priceVal > 0) ? formatSyncPriceValue(priceVal, priceCurrency) : '?';
                const rowHtml = `
                    <tr data-temp="1">
                        <td class="uk-text-center"><input type="checkbox" class="uk-checkbox" disabled></td>
                        <td class="uk-text-center">${idx + 1}</td>
                        <td class="uk-text-small" style="line-height:1.4;">${cexDisplay}</td>
                        <td>
                            <div class="uk-text-bold uk-text-small">${symbol}</div>
                            <div class="uk-text-meta">${tokenName}</div>
                        </td>
                        <td class="uk-text-small mono" title="${scRaw || '?'}">${scDisplay}</td>
                        <td class="uk-text-center">${decimals}</td>
                        <td class="uk-text-center" style="padding:8px 12px;">${tradeBadge}</td>
                        <td class="uk-text-right uk-text-small">${priceDisplay}</td>
                    </tr>`;
                $tbody.append(rowHtml);
            });
        };
        renderIncrementalRows();

        try {
            // Note: Don't call showSyncOverlay here - processSnapshotForCex handles its own overlay
            const snapshotModule = await ensureSnapshotModuleLoaded();
            await snapshotModule.processSnapshotForCex(
                activeSingleChainKey,
                selectedCexs,
                (token) => {
                    try {
                        if (!token) return;
                        const cex = String(token.cex || token.cex_source || '').toUpperCase();
                        const symbol = String(token.symbol_in || token.symbol || '').toUpperCase();
                        const scKey = String(token.sc_in || token.contract_in || '').toLowerCase() || 'NOSC';
                        const rowKey = `${cex || 'UNKNOWN'}__${symbol || 'UNKNOWN'}__${scKey}`;
                        if (!incrementalMap.has(rowKey)) {
                            incrementalOrder.push(rowKey);
                        }
                        incrementalMap.set(rowKey, { ...token });
                        renderIncrementalRows();
                    } catch(rowErr) {
                        // console.error('Failed to render incremental token row:', rowErr);
                    }
                }
            );

            // Reload snapshot data from IndexedDB and update UI
            try {
                const snapshotMap = await (window.snapshotDbGet ? window.snapshotDbGet(SNAPSHOT_DB_CONFIG.snapshotKey) : Promise.resolve(null));
                const chainData = (snapshotMap && typeof snapshotMap === 'object') ? snapshotMap[activeSingleChainKey] : null;

                if (Array.isArray(chainData) && chainData.length > 0) {
                    // Save current state before rebuild
                    const currentMode = $('input[name="sync-pick-mode"]:checked').val();
                    const selectedCexsBefore = $('#sync-filter-cex input:checked').map(function() {
                        return $(this).val();
                    }).get();

                    // Update modal data with fresh snapshot
                    $modal.data('remote-raw', chainData);
                    $modal.data('source', 'snapshot');
                    setSyncSourceIndicator('Snapshot (Terbaru)');

                    // Rebuild filters to update CEX badges
                    if (typeof window.buildSyncFilters === 'function') {
                        window.buildSyncFilters(activeSingleChainKey);
                    }

                    // Restore CEX selections after rebuild
                    selectedCexsBefore.forEach(cex => {
                        $(`#sync-filter-cex input[value="${cex}"]`).prop('checked', true);
                    });

                    // Re-render table with updated data
                    if (typeof window.renderSyncTable === 'function') {
                        window.renderSyncTable(activeSingleChainKey);
                    }

                    // Re-apply selection mode if it was set before
                    if (currentMode) {
                        const $modeRadio = $(`input[name="sync-pick-mode"][value="${currentMode}"]`);
                        if ($modeRadio.length) {
                            $modeRadio.prop('checked', true).trigger('change');
                        }
                    }

                    // console.log(`Snapshot reloaded: ${chainData.length} tokens from IndexedDB`);
                    // console.log(`CEX selections restored: ${selectedCexsBefore.join(', ')}`);
                }
            } catch(reloadErr) {
                // console.error('Failed to reload snapshot data after update:', reloadErr);
            }

            if (typeof toast !== 'undefined' && toast.success) {
                toast.success('Snapshot berhasil di-refresh!');
            }

            // Log ke history: Update Koin berhasil
            if (typeof addHistoryEntry === 'function') {
                const totalTokens = incrementalMap.size;
                addHistoryEntry(
                    'UPDATE KOIN',
                    'success',
                    {
                        chain: activeSingleChainKey.toUpperCase(),
                        cex: selectedCexs.join(', '),
                        totalTokens: totalTokens
                    }
                );
            }
        } catch(error) {
            // console.error('Refresh snapshot failed:', error);
            SnapshotOverlay.showError(error.message || 'Unknown error');
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error(`Gagal refresh: ${error.message || 'Unknown error'}`);
            }

            // Log ke history: Update Koin error
            if (typeof addHistoryEntry === 'function') {
                addHistoryEntry(
                    'UPDATE KOIN',
                    'error',
                    {
                        chain: activeSingleChainKey.toUpperCase(),
                        cex: selectedCexs.join(', '),
                        error: error.message || 'Unknown error'
                    }
                );
            }
        } finally {
            // Ensure button is re-enabled after a short delay
            setTimeout(() => {
                // Ensure modal is visible
                const $syncModal = $('#sync-modal');
                if ($syncModal.length) {
                    UIkit.modal($syncModal).show();
                }

                // Re-enable button
                $btn.prop('disabled', false).html(originalHtml);
            }, 300);
        }
    });

    // Save synced tokens
    $(document).on('click', '#sync-save-btn', async function() {
        if (!activeSingleChainKey) return (typeof toast !== 'undefined' && toast.error) ? toast.error("No active chain selected.") : undefined;

        const $modal = $('#sync-modal');
        const remoteTokens = $modal.data('remote-raw') || [];
        const savedTokens = $modal.data('saved-tokens') || [];

        // Build selected tokens with DEX configs
        const chainKey = activeSingleChainKey.toLowerCase();
        const chainCfg = CONFIG_CHAINS[chainKey] || {};
        const pairDefs = chainCfg.PAIRDEXS || {};
        const dexList = (chainCfg.DEXS || []).map(d => String(d));

        // Baca modal per DEX - HANYA yang checkboxnya dicentang
        const selectedDexsGlobal = [];
        const dataDexsGlobal = {};
        $('#sync-dex-config .sync-dex-checkbox:checked').each(function(){
            const dx = String($(this).data('dex'));
            const leftVal = parseFloat($(`#sync-dex-config .sync-dex-left[data-dex="${dx}"]`).val());
            const rightVal = parseFloat($(`#sync-dex-config .sync-dex-right[data-dex="${dx}"]`).val());
            const dxLower = dx.toLowerCase();
            selectedDexsGlobal.push(dxLower);
            dataDexsGlobal[dxLower] = {
                left: Number.isFinite(leftVal) ? leftVal : 0,
                right: Number.isFinite(rightVal) ? rightVal : 0
            };
        });
        if (selectedDexsGlobal.length < 1) {
            if (typeof toast !== 'undefined' && toast.warning) toast.warning('Pilih minimal 1 DEX untuk digunakan.');
            return;
        }

        // debug logs removed

        // ========== REFACTOR: Ambil pair yang dipilih dari RADIO BUTTON ==========
        const selectedPairFromRadio = $('#sync-filter-pair input[type="radio"]:checked').val();
        const pairForSave = selectedPairFromRadio ? String(selectedPairFromRadio).toUpperCase() : 'USDT';
        // console.log('[Save] Using pair from radio button:', pairForSave);

        const nonPairConfig = readNonPairConfig();
        const hasNonPairOverride = nonPairConfig && nonPairConfig.symbol;
        const usingCustomNon = (pairForSave === 'NON') && hasNonPairOverride;

        const selectedTokens = [];
        $('#sync-modal-tbody tr').each(function() {
            const $row = $(this);
            const $cb = $row.find('.sync-token-checkbox');
            if (!$cb.is(':checked')) return;
            const idx = Number($cb.data('index'));
            const tok = remoteTokens[idx];
            if (!tok) return;

            const cexUpper = String(tok.cex || '').toUpperCase().trim();
            const symbolIn = String(tok.symbol_in || '').toUpperCase().trim();
            const isSnapshot = String(tok.__source || '').toLowerCase() === 'snapshot';

            // ========== PAIR dari RADIO BUTTON, bukan dari checkbox ==========
            let symbolOut = pairForSave;
            if (usingCustomNon) {
                symbolOut = String(nonPairConfig.symbol).toUpperCase();
            }
            let scIn = tok.sc_in || tok.contract_in || '';
            const scOutRaw = tok.sc_out || tok.contract_out || '';
            const desInVal = Number(tok.des_in ?? tok.decimals_in ?? tok.des ?? tok.dec_in ?? 0);
            const desOutRaw = Number(tok.des_out ?? tok.decimals_out ?? tok.desPair ?? tok.dec_out ?? 0);

            // Map pair to config; if unknown → NON
            // NON concept: any pair NOT explicitly listed in PAIRDEXS.
            // For NON we should keep sc_out from source if provided; only fallback to PAIRDEXS['NON'] when input is missing/invalid.
            const customPairDef = usingCustomNon ? {
                scAddressPair: nonPairConfig.sc || '',
                desPair: Number.isFinite(nonPairConfig.des) ? nonPairConfig.des : 18,
                symbolPair: symbolOut
            } : null;
            const pairDef = pairDefs[symbolOut] || customPairDef || pairDefs['NON'] || { scAddressPair: '0x', desPair: 18, symbolPair: 'NON' };
            const isAddrInvalid = (addr) => !addr || String(addr).toLowerCase() === '0x' || String(addr).length < 6;
            let scOut = tok.sc_out || tok.contract_out || '';
            let desOut = Number.isFinite(desOutRaw) && desOutRaw > 0 ? desOutRaw : Number(pairDef.desPair);
            if (pairDefs[symbolOut]) {
                // Known pair in config: allow fallback to config default if source empty
                scOut = scOut || pairDef.scAddressPair;
                desOut = Number.isFinite(desOutRaw) && desOutRaw > 0 ? desOutRaw : Number(pairDef.desPair);
            } else if (usingCustomNon) {
                scOut = nonPairConfig.sc || scOut || pairDef.scAddressPair || '';
                if (isAddrInvalid(scOut)) scOut = pairDef.scAddressPair || scOut;
                desOut = Number.isFinite(nonPairConfig.des) ? nonPairConfig.des : (Number.isFinite(desOutRaw) && desOutRaw > 0 ? desOutRaw : Number(pairDef.desPair || 18));
            } else {
                // NON: keep source SC if present; only fallback when invalid
                if (isAddrInvalid(scOut)) {
                    scOut = pairDef.scAddressPair || scOut;
                    desOut = Number(pairDef.desPair || desOutRaw || 18);
                }
            }

            // Use global DEX config
            const selectedDexs = selectedDexsGlobal.slice();
            const dataDexs = { ...dataDexsGlobal };

            // Merge prior CEX info if exists
            const existing = savedTokens.find(s => String(s.cex).toUpperCase() === cexUpper && s.symbol_in === symbolIn && s.symbol_out === symbolOut);
            const dataCexs = {};
            const baseCexInfo = existing?.dataCexs?.[cexUpper] ? { ...existing.dataCexs[cexUpper] } : {
                feeWDToken: 0, feeWDPair: 0,
                depositToken: false, withdrawToken: false,
                depositPair: false, withdrawPair: false
            };
            if (isSnapshot) {
                const feeSnapshot = parseFloat(tok.feeWDToken ?? tok.feeWD);
                if (Number.isFinite(feeSnapshot) && feeSnapshot >= 0) {
                    baseCexInfo.feeWDToken = feeSnapshot;
                }
                const depositSnap = parseSnapshotStatus(tok.depositToken ?? tok.deposit);
                if (depositSnap !== null) {
                    baseCexInfo.depositToken = depositSnap;
                    baseCexInfo.depositPair = depositSnap;
                }
                const withdrawSnap = parseSnapshotStatus(tok.withdrawToken ?? tok.withdraw);
                if (withdrawSnap !== null) {
                    baseCexInfo.withdrawToken = withdrawSnap;
                    baseCexInfo.withdrawPair = withdrawSnap;
                }
            }
            dataCexs[cexUpper] = baseCexInfo;

            if (!scIn || isAddrInvalid(scIn)) scIn = tok.sc_in || tok.contract_in || '';
            scIn = String(scIn || '').trim();
            if (!scIn || scIn.length < 6) return;
            if (isAddrInvalid(scOut)) scOut = pairDef.scAddressPair || scOut;
            scOut = String(scOut || '').trim();

            const desIn = Number.isFinite(desInVal) && desInVal >= 0 ? desInVal : 0;
            desOut = Number.isFinite(desOut) && desOut >= 0 ? desOut : desIn;

            const tokenObj = {
                id: `${chainKey}_${cexUpper}_${symbolIn}_${symbolOut}`,
                chain: chainKey,
                symbol_in: symbolIn,
                sc_in: scIn,
                des_in: desIn,
                symbol_out: symbolOut,
                sc_out: scOut,
                des_out: desOut,
                status: true,
                selectedCexs: [cexUpper],
                selectedDexs,
                dataDexs,
                dataCexs,
                cex: cexUpper
            };
            selectedTokens.push(tokenObj);
            // debug logs removed
        });

        // Validate at least 1 token selected
        if (selectedTokens.length === 0) {
            if (typeof toast !== 'undefined' && toast.info) toast.info('Pilih minimal 1 koin untuk disimpan.');
            return;
        }

        // Save to current per-chain store
        // Merge strategy: replace existing entries (same chain+cex+symbol_in+symbol_out), keep others
        const existingList = Array.isArray(getTokensChain(activeSingleChainKey)) ? getTokensChain(activeSingleChainKey) : [];
        const sameEntry = (a, b) =>
            String(a.chain).toLowerCase() === String(b.chain).toLowerCase() &&
            String(a.cex || (a.selectedCexs||[])[0] || '').toUpperCase() === String(b.cex || (b.selectedCexs||[])[0] || '').toUpperCase() &&
            String(a.symbol_in).toUpperCase() === String(b.symbol_in).toUpperCase() &&
            String(a.symbol_out).toUpperCase() === String(b.symbol_out).toUpperCase();

        const merged = [...existingList];
        let replaced = 0; let added = 0;
        selectedTokens.forEach(newTok => {
            const idx = merged.findIndex(oldTok => sameEntry(oldTok, newTok));
            if (idx !== -1) { merged[idx] = newTok; replaced += 1; } else { merged.push(newTok); added += 1; }
        });

        // Disable save button while saving
        const $btn = $('#sync-save-btn');
        const prevLabel = $btn.text();
        try { $btn.prop('disabled', true).text('Saving...'); } catch(_) {}
        // debug logs removed
        let ok = true;
        if (typeof setTokensChainAsync === 'function') {
            ok = await setTokensChainAsync(activeSingleChainKey, merged);
        } else {
            try { setTokensChain(activeSingleChainKey, merged); ok = true; } catch(_) { ok = false; }
        }

        if (ok) {
            try { setLastAction('SINKRONISASI KOIN'); } catch(_) {}
            if (typeof toast !== 'undefined' && toast.success) toast.success(`Disimpan: ${selectedTokens.length} koin (${added} baru, ${replaced} diperbarui) untuk ${activeSingleChainKey}.`);
            UIkit.modal('#sync-modal').hide();
            // Full reload to ensure a clean state and updated filters
            location.reload();
        } else {
            const reason = (window.LAST_STORAGE_ERROR ? `: ${window.LAST_STORAGE_ERROR}` : '');
            if (typeof toast !== 'undefined' && toast.error) toast.error(`Gagal menyimpan ke penyimpanan lokal${reason}`);
            try { $btn.prop('disabled', false).text(prevLabel); } catch(_) {}
        }
        // debug logs removed
    });

    // Event handler untuk checkbox di tabel koin - Update button save state
    // Flag untuk mencegah trigger berulang saat bulk selection (Select All/Clear/dll)
    let isBulkSelecting = false;
    window.setSyncBulkSelecting = function(value) { isBulkSelecting = !!value; };

    $(document).on('change', '#sync-modal-tbody .sync-token-checkbox', function() {
        // Skip individual update jika sedang bulk selection
        if (isBulkSelecting) return;

        updateSyncSelectedCount();
        updateAddTokenButtonState();
    });

    $(document).on('change', '#sync-filter-cex input[type="checkbox"]', function(){
        renderSyncTable(activeSingleChainKey);
    });

    // Event handler untuk checkbox DEX - Toggle visual state dan disable/enable inputs
    $(document).on('change', '#sync-dex-config .sync-dex-checkbox', function(){
        const dex = $(this).data('dex');
        const isChecked = $(this).is(':checked');
        const $row = $(this).closest('.sync-dex-row');

        // Toggle input fields (modal kiri/kanan)
        $row.find('.sync-dex-left, .sync-dex-right').prop('disabled', !isChecked);

        // Visual feedback: opacity dan pointer events
        if (isChecked) {
            $row.css({ opacity: '1', filter: 'none' });
        } else {
            $row.css({ opacity: '0.4', filter: 'grayscale(100%)' });
        }
    });

    $(document).on('click', '#sync-table thead th[data-sort-key]', function(e){
        e.preventDefault();
        const key = String($(this).data('sort-key') || '');
        if (!key) return;
        if (key === 'default') {
            setSyncSortState('default');
        } else {
            setSyncSortState(key);
        }
        if (activeSingleChainKey) {
            renderSyncTable(activeSingleChainKey);
        } else {
            updateSyncSortIndicators();
        }
    });

    // ========================================
    // RADIO BUTTON: Auto-Select Modes
    // ========================================
    // Mode: "all" (Semua), "selected" (Dipilih), "snapshot" (Snapshot), "clear" (Hapus)
    // KONSEP BARU: Radio button hanya baca dari DOM tabel yang sudah di-render
    $(document).on('change', 'input[name="sync-pick-mode"]', function(){
        const mode = $(this).val();
        const $allBoxes = $('#sync-modal-tbody .sync-token-checkbox');

        console.log(`[Sync Pick Mode] Mode: ${mode}, Found ${$allBoxes.length} checkboxes.`);

        // Set flag untuk mencegah individual change handler (optimasi)
        if (typeof window.setSyncBulkSelecting === 'function') {
            window.setSyncBulkSelecting(true);
        }

        if (mode === 'all') {
            // 1. SEMUA: Centang semua koin
            console.log('[Sync Pick Mode] Mencentang semua checkbox...');
            $allBoxes.prop('checked', true);

        } else if (mode === 'selected') {
            // 2. DIPILIH: Centang koin yang punya badge [DIPILIH] di kolom CEX
            console.log('[Sync Pick Mode] Mencari koin dengan badge [DIPILIH]...');
            let checkedCount = 0;

            $allBoxes.each(function() {
                const $row = $(this).closest('tr');
                // Cari badge [DIPILIH] di kolom CEX (kolom ke-3, td:eq(2))
                const $cexCell = $row.find('td:eq(2)');
                const cexText = $cexCell.text().trim();
                const hasDipilihBadge = cexText.includes('[DIPILIH]');

                $(this).prop('checked', hasDipilihBadge);
                if (hasDipilihBadge) checkedCount++;
            });

            console.log('[Sync Pick Mode] Koin [DIPILIH] ditemukan:', checkedCount);

        } else if (mode === 'snapshot') {
            // 3. SNAPSHOT: Centang koin yang punya badge [SNAPSHOT] di kolom CEX
            console.log('[Sync Pick Mode] Mencari koin dengan badge [SNAPSHOT]...');
            let snapshotCount = 0;

            $allBoxes.each(function() {
                const $row = $(this).closest('tr');
                // Cari badge [SNAPSHOT] di kolom CEX (kolom ke-3, td:eq(2))
                const $cexCell = $row.find('td:eq(2)');
                const cexText = $cexCell.text().trim();
                const hasSnapshotBadge = cexText.includes('[SNAPSHOT]');

                $(this).prop('checked', hasSnapshotBadge);
                if (hasSnapshotBadge) snapshotCount++;
            });

            console.log('[Sync Pick Mode] Koin [SNAPSHOT] ditemukan:', snapshotCount);

        } else if (mode === 'clear') {
            // 4. HAPUS: Uncheck semua koin
            console.log('[Sync Pick Mode] Menghapus semua centangan...');
            $allBoxes.prop('checked', false);
        }

        // Reset flag dan update UI
        if (typeof window.setSyncBulkSelecting === 'function') {
            window.setSyncBulkSelecting(false);
        }

        // ========== UPDATE COUNTER DAN BUTTON STATE SETELAH RADIO BUTTON DIPILIH ==========
        updateSyncSelectedCount();  // Update jumlah koin yang dipilih
        updateAddTokenButtonState(); // Update status button Save

        // Log jumlah akhir yang tercentang
        const finalCount = $('#sync-modal-tbody .sync-token-checkbox:checked').length;
        console.log(`[Sync Pick Mode] Total checkbox tercentang setelah update: ${finalCount}`);
        // ===================================================================================
    });

    // Removed legacy single-chain start button handler (using unified #startSCAN now)
}

$(document).ready(function() {
    // Database functions removed - snapshot-new.js will use alternative methods

    // --- Critical Initializations (Immediate) ---
    // If previous page triggered a reload/reset, clear local flag only (do not broadcast)
    try {
        if (sessionStorage.getItem('APP_FORCE_RUN_NO') === '1') {
            sessionStorage.removeItem('APP_FORCE_RUN_NO');
        }
    } catch(_) {}
    // Initialize app state from localStorage
    function applyRunUI(isRunning){
        if (isRunning) {
            try { form_off(); } catch(_) {}
            $('#startSCAN').prop('disabled', true).attr('aria-busy','true').text('Running...').addClass('uk-button-disabled');
            // Show standardized running banner: [ RUN SCANNING: <CHAINS> ]
            try { if (typeof window.updateRunningChainsBanner === 'function') window.updateRunningChainsBanner(); } catch(_) {}
            $('#stopSCAN').show().prop('disabled', false);
            $('#reload').prop('disabled', false);
            //$('#infoAPP').html('⚠️ Proses sebelumnya tidak selesai. Tekan tombol <b>RESET PROSES</b> untuk memulai ulang.').show();
           
            try { if (typeof setScanUIGating === 'function') setScanUIGating(true); } catch(_) {}
        } else {
            $('#startSCAN').prop('disabled', false).removeAttr('aria-busy').text('Start').removeClass('uk-button-disabled');
            $('#stopSCAN').hide();
            // Clear banner when not running
            try { $('#infoAPP').text('').hide(); } catch(_) {}
            try { if (typeof setScanUIGating === 'function') setScanUIGating(false); } catch(_) {}
        }
    }

    // In-memory cache of run states to avoid stale storage reads across tabs
    window.RUN_STATES = window.RUN_STATES || {};
    function updateRunStateCache(filterKey, val){
        try {
            const key = String(filterKey||'');
            const up = key.toUpperCase();
            if (!up.startsWith('FILTER_')) return;
            const isMulti = (up === 'FILTER_MULTICHAIN');
            const k = isMulti ? 'multichain' : key.replace(/^FILTER_/i,'').toLowerCase();
            const runVal = (val && typeof val==='object' && Object.prototype.hasOwnProperty.call(val,'run')) ? val.run : (getFromLocalStorage(key, {})||{}).run;
            const r = String(runVal||'NO').toUpperCase() === 'YES';
            window.RUN_STATES[k] = r;
        } catch(_) {}
    }
    try { window.updateRunStateCache = window.updateRunStateCache || updateRunStateCache; } catch(_) {}
    function initRunStateCache(){
        try { updateRunStateCache('FILTER_MULTICHAIN'); } catch(_) {}
        try { Object.keys(CONFIG_CHAINS||{}).forEach(k => updateRunStateCache(`FILTER_${String(k).toUpperCase()}`)); } catch(_) {}
    }
    try {
        if (window.whenStorageReady && typeof window.whenStorageReady.then === 'function') {
            window.whenStorageReady.then(initRunStateCache);
        } else { initRunStateCache(); }
    } catch(_) { initRunStateCache(); }

    const appStateInit = getAppState();
    applyRunUI(appStateInit.run === 'YES');

    // === CHECK GLOBAL SCAN LOCK ON PAGE LOAD (DISABLED FOR MULTI-TAB) ===
    // REMOVED: Global lock check on page load
    // Multi-tab scanning is now supported via Tab Manager (tab-manager.js)

    // Re-apply once IndexedDB cache is fully warmed to avoid false negatives
    try {
        if (window.whenStorageReady && typeof window.whenStorageReady.then === 'function') {
            window.whenStorageReady.then(() => {
                try {
                    const st = getAppState();
                    applyRunUI(st && st.run === 'YES');
                    // REMOVED: Global lock re-check (multi-tab support enabled)
                } catch(_) {}
            });
        }
    } catch(_) {}

    // ========== PROTEKSI RELOAD LOOP ==========
    // Mencegah reload loop saat 2 tab dengan URL sama saling broadcast message
    let lastReloadTimestamp = 0;
    const RELOAD_COOLDOWN = 3000; // 3 detik cooldown untuk mencegah reload berulang

    // Track page load time untuk ignore early messages (saat page baru reload)
    const pageLoadTime = Date.now();
    const IGNORE_MESSAGES_DURATION = 2000; // Ignore messages 2 detik pertama setelah load

    // Cross-tab run state sync via BroadcastChannel (per FILTER_* key)
    if (window.__MC_BC) {
        window.__MC_BC.addEventListener('message', function(ev){
            // ========== IGNORE MESSAGES SAAT BARU RELOAD ==========
            // Mencegah tab yang baru reload langsung reload lagi karena message dari tab lain
            if (Date.now() - pageLoadTime < IGNORE_MESSAGES_DURATION) {
                // console.log('[CROSS-TAB] Message ignored - page just loaded');
                return;
            }
            const msg = ev?.data;
            if (!msg) return;
            if (msg.type === 'kv') {
                try {
                    const keyStr = String(msg.key || '');
                    const keyUpper = keyStr.toUpperCase();

                    // === HANDLE GLOBAL_SCAN_LOCK CHANGES (DISABLED FOR MULTI-TAB) ===
                    // REMOVED: Cross-tab lock synchronization
                    // Multi-tab scanning is now supported independently via Tab Manager
                    if (keyUpper === 'GLOBAL_SCAN_LOCK') {
                        // Ignore lock messages - each tab manages its own scanning state
                        return;
                    }

                    if (!keyUpper.startsWith('FILTER_')) return; // only react to FILTER_* changes

                    // Update in-memory cache first
                    try { updateRunStateCache(keyUpper, msg.val || {}); } catch(_) {}

                    // Refresh toolbar indicators and running banner for ANY filter change
                    try { if (typeof window.updateRunningChainsBanner === 'function') window.updateRunningChainsBanner(); } catch(_) {}
                    try { if (typeof window.updateToolbarRunIndicators === 'function') window.updateToolbarRunIndicators(); } catch(_) {}

                    // If this update is for the ACTIVE filter key, also apply run/theme locally
                    const activeKey = (typeof getActiveFilterKey === 'function') ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
                    if (keyUpper === String(activeKey).toUpperCase()) {
                        const hasRun = msg.val && Object.prototype.hasOwnProperty.call(msg.val, 'run');
                        const hasDark = msg.val && Object.prototype.hasOwnProperty.call(msg.val, 'darkMode');
                        if (hasRun) {
                            const r = String(msg.val.run || 'NO').toUpperCase();
                            applyRunUI(r === 'YES');
                            if (r === 'NO') {
                                const running = (typeof window.App?.Scanner?.isScanRunning !== 'undefined') ? !!window.App.Scanner.isScanRunning : false;
                                if (running) {
                                    // ========== FIX RELOAD LOOP ==========
                                    // Hanya reload jika sudah lewat cooldown period
                                    const now = Date.now();
                                    if (now - lastReloadTimestamp > RELOAD_COOLDOWN) {
                                        lastReloadTimestamp = now;
                                        if (window.App?.Scanner?.stopScannerSoft) window.App.Scanner.stopScannerSoft();

                                        // Set flag untuk mencegah broadcast saat reload
                                        try { sessionStorage.setItem('APP_FORCE_RUN_NO', '1'); } catch(_) {}

                                        // console.log('[CROSS-TAB] Reloading due to run:NO from another tab');
                                        location.reload();
                                    } else {
                                        // console.log('[CROSS-TAB] Reload skipped - cooldown active to prevent loop');
                                    }
                                }
                            }
                        }
                        if (hasDark && typeof applyThemeForMode === 'function') {
                            applyThemeForMode();
                        }
                    }
                } catch(_) {}
                return;
            }
            if (msg.type === 'history' || msg.type === 'history_clear' || msg.type === 'history_delete') {
                try { updateInfoFromHistory(); } catch(_) {}
            }
        });
    }

    // Apply themed background + dark mode per state
    if (typeof applyThemeForMode === 'function') applyThemeForMode();
    // applyThemeForMode already executed above to paint early
    setTimeout(deferredInit, 0);

    // Bersihkan konten kolom DEX saat ada perubahan filter (serupa perilaku saat START scan)
    try {
        $(document).on('change input', '#filter-card input, #filter-card select', function(){
            try { resetDexCells('dataTableBody'); } catch(_) {}
        });
    } catch(_) {}

    // --- Report Database Status (IndexedDB) --- // REFACTORED
    async function reportDatabaseStatus(){
        const payload = await (window.exportIDB ? window.exportIDB() : Promise.resolve(null));
        if (!payload || !Array.isArray(payload.items)) {
            if (typeof toast !== 'undefined' && toast.warning) toast.warning('Database belum tersedia atau tidak dapat diakses.');
            return;
        }
        if (typeof toast !== 'undefined' && toast.info) toast.info(`TERHUBUNG DATABASE...`);
        else { /* debug logs removed */ }
    }
    if (window.whenStorageReady && typeof window.whenStorageReady.then === 'function') {
        window.whenStorageReady.then(reportDatabaseStatus);
    } else {
        reportDatabaseStatus();
    }

    // Initial header label + sync icon visibility based on URL mode
    try {
        const params = new URLSearchParams(window.location.search);
        const ch = (params.get('chain') || '').toLowerCase();
        const isSingle = (!!ch && ch !== 'all' && (CONFIG_CHAINS || {})[ch]);
        const $hdr = $('#current-chain-label');
        if ($hdr.length) {
            if (isSingle) {
                const cfg = (CONFIG_CHAINS && CONFIG_CHAINS[ch]) ? CONFIG_CHAINS[ch] : null;
                const label = (cfg?.Nama_Pendek || cfg?.Nama_Chain || ch).toString().toUpperCase();
                const color = cfg?.WARNA || '#333';
                $hdr.text(`[${label}]`).css('color', color);
            } else {
                $hdr.text('[ALL]').css('color', '#666');
            }
        }
        const $sync = $('#sync-tokens-btn');
        if ($sync.length) {
            if (isSingle) { $sync.show(); } else { $sync.remove(); }
        }
    } catch(e) { /* noop */ }

    // URL-based mode switching (multichain vs per-chain)
    function getDefaultChain() {
        const settings = getFromLocalStorage('SETTING_SCANNER', {});
        if (Array.isArray(settings.AllChains) && settings.AllChains.length) {
            return String(settings.AllChains[0]).toLowerCase();
        }
        const keys = Object.keys(CONFIG_CHAINS || {});
        return String(keys[0] || 'bsc').toLowerCase();
    }

    function applyModeFromURL() {
        const params = new URLSearchParams(window.location.search);
        const requested = (params.get('chain') || '').toLowerCase();

        const setHomeHref = (chainKey) => {
            const target = chainKey ? chainKey : getDefaultChain();
            $('#home-link').attr('href', `index.html?chain=${encodeURIComponent(target)}`);
            setAppState({ lastChain: target });
        };

        // Always render chain links to reflect active selection
        renderChainLinks(requested || 'all');

        if (!requested || requested === 'all') {
            // Multichain view (unified table)
            showMainSection('scanner');
            activeSingleChainKey = null;
            // Clear AppMode cache to force re-evaluation
            try { delete window.AppMode; } catch(_) {}
            // Filter card handles UI
            const st = getAppState();
            setHomeHref(st.lastChain || getDefaultChain());
            try { applySortToggleState(); } catch(_) {}
            try { syncPnlInputFromStorage(); } catch(_) {}
            // Re-apply controls based on multichain state
            try {
                const state = computeAppReadiness();
                applyControlsFor(state);
            } catch(e) { console.error('applyControlsFor error', e); }
            return;
        }

        if (!CONFIG_CHAINS || !CONFIG_CHAINS[requested]) {
            // Invalid chain → fallback to multichain
            window.location.replace('index.html?chain=all');
            return;
        }

        // Per-chain view (unified table): keep main table visible and render single-chain data into it
        activeSingleChainKey = requested;
        // Clear AppMode cache to force re-evaluation for this specific chain
        try { delete window.AppMode; } catch(_) {}
        showMainSection('scanner');
        setHomeHref(requested);
        try { loadAndDisplaySingleChainTokens(); } catch(e) { console.error('single-chain init error', e); }
        try { applySortToggleState(); } catch(_) {}
        try { syncPnlInputFromStorage(); } catch(_) {}
        // Re-apply controls based on current chain state (check if tokens exist for this chain)
        try {
            const state = computeAppReadiness();
            applyControlsFor(state);
        } catch(e) { console.error('applyControlsFor error', e); }
    }

    try {
        if (window.whenStorageReady) {
            window.whenStorageReady.then(applyModeFromURL);
        } else {
            applyModeFromURL();
        }
    } catch(_) { applyModeFromURL(); }
    // Apply gating again after mode/layout switches
    try {
        const st2 = getAppState();
        if (st2 && st2.run === 'YES' && typeof setScanUIGating === 'function') {
            setScanUIGating(true);
        }
    } catch(_) {}

    // Build chain icon links based on CONFIG_CHAINS
    function renderChainLinks(activeKey = 'all') {
        const $wrap = $('#chain-links-container');
        if ($wrap.length === 0) return;
        $wrap.empty();

        const currentPage = (window.location.pathname.split('/').pop() || 'index.html');
        Object.keys(CONFIG_CHAINS || {}).forEach(chainKey => {
            const chain = CONFIG_CHAINS[chainKey] || {};
            const isActive = String(activeKey).toLowerCase() === String(chainKey).toLowerCase();
            const style = isActive ? 'width:30px' : '';
            const width = isActive ? 30 : 24;
            const icon = chain.ICON || '';
            const name = chain.Nama_Chain || chainKey.toUpperCase();
            // Determine running state for this chain
            let running = false;
            try {
                const f = getFromLocalStorage(`FILTER_${String(chainKey).toUpperCase()}`, {}) || {};
                running = String(f.run || 'NO').toUpperCase() === 'YES';
            } catch(_) {}
            // Do not apply ring or enlargement; small dot indicator handled elsewhere
            const ring = '';
            const linkHTML = `
                <span class="chain-link icon" data-chain="${chainKey}" style="display:inline-block; ${style} margin-right:4px;">
                    <a href="${currentPage}?chain=${encodeURIComponent(chainKey)}" title="SCANNER ${name.toUpperCase()}">
                        <img src="${icon}" alt="${name} icon" width="${width}" style="${ring}">
                    </a>
                </span>`;
            $wrap.append(linkHTML);
        });
        try { updateToolbarRunIndicators(); } catch(_) {}
    }

    // Update toolbar indicators (multichain + per-chain) based on current FILTER_* run states
    function updateToolbarRunIndicators(){
        try {
            // Multichain icon reflect multi run
            const runMulti = !!(window.RUN_STATES && window.RUN_STATES.multichain);
            const $mcImg = $('#multichain_scanner img');
            if ($mcImg.length) {
                // Do not enlarge or add glow; only attach a small dot indicator
                $mcImg.css('filter', '').css('opacity', '');
                const $mc = $('#multichain_scanner');
                let $dot = $mc.find('span.run-dot');
                if (runMulti) {
                    if (!$dot.length) $mc.append('<span class="run-dot" style="background:#5c9514;"></span>');
                    else $dot.show();
                } else {
                    if ($dot.length) $dot.remove();
                }
            }
            // Per-chain icons
            Object.keys(CONFIG_CHAINS || {}).forEach(chainKey => {
                const cfg = CONFIG_CHAINS[chainKey] || {};
                const running = !!(window.RUN_STATES && window.RUN_STATES[String(chainKey).toLowerCase()]);
                const sel = `.chain-link[data-chain="${chainKey}"] img`;
                const $img = $(sel);
                // Do not add ring or enlarge the icon during scan; only show small dot
                $img.css('box-shadow', '').css('border-radius', '');
                // Add small dot indicator on the host span
                const $host = $(`.chain-link[data-chain="${chainKey}"]`);
                let $dot = $host.find('span.run-dot');
                if (running) {
                    const color = cfg.WARNA || '#5c9514';
                    if (!$dot.length) {
                        $host.append(`<span class="run-dot" style="background:${color};"></span>`);
                    } else {
                        $dot.css('background', color).show();
                    }
                } else {
                    if ($dot.length) $dot.remove();
                }
            });
        } catch(_) {}
    }
    try { window.updateToolbarRunIndicators = window.updateToolbarRunIndicators || updateToolbarRunIndicators; } catch(_) {}

    // Single-chain filter builders are removed (unified filter card is used)
    // function renderSingleChainFilters(chainKey) { ... }

    // Helpers: Sync filters + table render (global, used by deferredInit handlers)
    let syncSortState = { column: 'default', direction: 'asc' };
    window.__SYNC_SORT_STATE = { ...syncSortState };

    function getSyncSortState() {
        return { column: syncSortState.column, direction: syncSortState.direction };
    }

    function setSyncSortState(column) {
        if (!column) return;
        if (column === 'default') {
            syncSortState = { column: 'default', direction: 'asc' };
            window.__SYNC_SORT_STATE = { ...syncSortState };
            return;
        }
        if (syncSortState.column === column) {
            syncSortState = {
                column,
                direction: syncSortState.direction === 'asc' ? 'desc' : 'asc'
            };
        } else {
            syncSortState = { column, direction: 'asc' };
        }
        window.__SYNC_SORT_STATE = { ...syncSortState };
    }

    function updateSyncSortIndicators() {
        try {
            const state = syncSortState || { column: 'default', direction: 'asc' };
            const $headers = $('#sync-table thead th[data-sort-key]');
            if ($headers.length) {
                $headers.css('cursor', 'pointer');
            }
            $headers.each(function(){
                const $th = $(this);
                const key = String($th.data('sort-key') || '');
                const $indicator = $th.find('.sync-sort-indicator');
                if (!$indicator.length) return;
                const isActive = (key === 'default' && state.column === 'default') || (state.column === key);
                if (isActive && key !== 'default') {
                    // Gunakan icon UIkit atau unicode yang lebih bagus
                    const icon = state.direction === 'asc'
                        ? '<span uk-icon="icon: triangle-up; ratio: 0.6"></span>'
                        : '<span uk-icon="icon: triangle-down; ratio: 0.6"></span>';
                    $indicator.html(icon);
                    $indicator.css({ 'margin-left': '4px', 'opacity': '0.7' });
                } else {
                    $indicator.html('');
                }
            });
        } catch(_) {}
    }
    try {
        window.getSyncSortState = getSyncSortState;
        window.setSyncSortState = setSyncSortState;
        window.updateSyncSortIndicators = updateSyncSortIndicators;
    } catch(_) {}

    function getSyncSortValue(token, column) {
        switch (column) {
            case 'cex':
                {
                    const cexUp = String(token.cex || '').toUpperCase();
                    const statusRank = Number.isFinite(token.__statusRank) ? token.__statusRank : 2;
                    return `${cexUp}|${statusRank}`;
                }
            case 'token':
                return String(token.symbol_in || token.token_name || '').toUpperCase();
            case 'sc':
                return String(token.sc_in || token.contract_in || '').toLowerCase();
            case 'decimals': {
                const num = Number(token.des_in ?? token.decimals_in ?? token.decimal ?? 0);
                return Number.isFinite(num) ? num : 0;
            }
            case 'trade': {
                const dep = parseSnapshotStatus(token.deposit);
                const wd = parseSnapshotStatus(token.withdraw);
                if (dep === true && wd === true) return 2;
                if (dep === false || wd === false) return 0;
                return 1; // unknown
            }
            case 'price': {
                const priceVal = Number(token.current_price ?? token.price ?? token.last_price ?? NaN);
                if (Number.isFinite(priceVal) && priceVal > 0) return priceVal;
                return Number.NEGATIVE_INFINITY;
            }
            default:
                return Number.isFinite(token.__order) ? token.__order : 0;
        }
    }

    function applySyncSorting(list) {
        if (!Array.isArray(list) || !list.length) return;
        const state = syncSortState || { column: 'default', direction: 'asc' };
        list.sort((a, b) => {
            const orderA = Number.isFinite(a.__order) ? a.__order : (typeof a.__baseIndex === 'number' ? a.__baseIndex : 0);
            const orderB = Number.isFinite(b.__order) ? b.__order : (typeof b.__baseIndex === 'number' ? b.__baseIndex : 0);
            if (state.column === 'default') {
                return orderA - orderB;
            }
            const aVal = getSyncSortValue(a, state.column);
            const bVal = getSyncSortValue(b, state.column);
            let cmp;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                cmp = aVal - bVal;
            } else {
                cmp = String(aVal || '').localeCompare(String(bVal || ''), undefined, { sensitivity: 'base', numeric: false });
            }
            if (cmp === 0) return orderA - orderB;
            return state.direction === 'desc' ? (cmp > 0 ? -1 : 1) : (cmp > 0 ? 1 : -1);
        });
    }

    window.buildSyncFilters = function(chainKey) {
        const $modal = $('#sync-modal');
        const raw = $modal.data('remote-raw') || [];

        // ========== REFACTOR: CEX COUNT (untuk badge) ==========
        // Count by CEX SAJA (bukan pair, karena pair bukan filter)
        const countByCex = raw.reduce((acc, t) => {
            const k = String(t.cex||'').toUpperCase();
            acc[k] = (acc[k]||0)+1; return acc;
        }, {});

        const chain = (CONFIG_CHAINS || {})[chainKey] || {};
        const pairDefs = chain.PAIRDEXS || {};

        // Build CEX checkboxes (horizontal chips) - unchecked by default
        const $cex = $('#sync-filter-cex').empty();
        Object.keys(CONFIG_CEX || {}).forEach(cex => {
            const id = `sync-cex-${cex}`;
           const badge = countByCex[cex] || 0;
           // No auto-check - user must select manually
           $cex.append(`<label class="uk-text-small" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #e5e5e5; border-radius:6px; background:#fafafa;">
                <input type="checkbox" id="${id}" value="${cex}" class="uk-checkbox">
                <span style="color:${CONFIG_CEX[cex].WARNA||'#333'}; font-weight:bolder;">${cex}</span>
                <span class="uk-text-muted">(${badge})</span>
            </label>`);
        });

        // ========== REFACTOR: PAIR RADIO BUTTONS (TANPA COUNTER) ==========
        // Pair adalah INPUT untuk konfigurasi save, BUKAN filter tampilan
        // Jadi TIDAK perlu counter/badge
        // Pair DISABLED sampai user centang minimal 1 koin (sama seperti DEX)
        const $pair = $('#sync-filter-pair').empty();
        const pairKeys = Array.from(new Set([...Object.keys(pairDefs||{}), 'NON']));
        // Default: USDT jika ada, kalau tidak pakai pair pertama
        const defaultPair = pairKeys.includes('USDT') ? 'USDT' : (pairKeys.length > 0 ? pairKeys[0] : 'NON');
        pairKeys.forEach(p => {
            const id = `sync-pair-${p}`;
            const checked = (p === defaultPair) ? 'checked' : '';
            // TANPA badge/counter karena pair bukan filter
            // DISABLED by default (akan enabled di updateSyncSelectedCount saat ada koin dipilih)
            $pair.append(`<label class="uk-text-small" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #e5e5e5; border-radius:6px; background:#fafafa; opacity:0.5; pointer-events:none; cursor:not-allowed;">
                <input type="radio" name="sync-pair-group" id="${id}" value="${p}" class="uk-radio" ${checked} disabled>
                <span style="font-weight:bolder;">${p}</span>
            </label>`);
        });
        // Sembunyikan NON inputs by default (akan di-toggle saat pair aktif)
        $('#sync-non-config').css('display', 'none');

        // Build DEX config dengan checkbox untuk memilih DEX mana yang aktif
        const $dex = $('#sync-dex-config').empty();
        const dexList = (chain.DEXS || []).map(String);
        dexList.forEach(dx => {
            const dexConfig = CONFIG_DEXS?.[dx.toLowerCase()] || {};
            const dexColor = dexConfig.warna || '#333';

            $dex.append(`
                <div class="uk-flex uk-flex-middle sync-dex-row" data-dex="${dx}" style="gap:6px; padding: 4px; border-left: 3px solid ${dexColor}; background: ${dexColor}08;">
                    <label class="uk-margin-remove" style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" class="uk-checkbox sync-dex-checkbox" data-dex="${dx}" checked style="margin-right: 6px;">
                    </label>
                    <span class="uk-text-small uk-text-bold sync-dex-label" style="width:70px; color: ${dexColor};">${dx.toUpperCase()}</span>
                    <input type="number" class="uk-input uk-form-small sync-dex-left" data-dex="${dx}" placeholder="Modal Kiri" value="100" style="flex: 1;">
                    <input type="number" class="uk-input uk-form-small sync-dex-right" data-dex="${dx}" placeholder="Modal Kanan" value="100" style="flex: 1;">
                </div>`);
        });
    };

    window.renderSyncTable = function(chainKey) {
        const $modal = $('#sync-modal');

        // ========== SIMPAN STATE CHECKBOX SEBELUM RE-RENDER ==========
        // Simpan state centang checkbox saat ini (termasuk pilihan user yang belum di-save)
        const currentCheckboxState = new Map();
        $('#sync-modal-tbody .sync-token-checkbox').each(function() {
            const $cb = $(this);
            const cex = String($cb.data('cex') || '').toUpperCase();
            const symbol = String($cb.data('symbol') || '').toUpperCase();
            const isChecked = $cb.is(':checked');
            // Key: HANYA cex+symbol (TANPA index, karena index berubah saat filter/sort)
            const key = `${cex}__${symbol}`;
            currentCheckboxState.set(key, isChecked);
        });
        // console.log('[renderSyncTable] Saved checkbox state:', currentCheckboxState.size, 'items');
        // ==============================================================

        const modalBody = $('#sync-modal-tbody').empty();
        const raw = $modal.data('remote-raw') || [];
        const savedTokens = $modal.data('saved-tokens') || [];
        const chainCfg = CONFIG_CHAINS[chainKey] || {};
        const pairDefs = chainCfg.PAIRDEXS || {};
        const sourceLabel = String($modal.data('source') || 'server').toLowerCase();
        const selectedCexs = $('#sync-filter-cex input:checked').map(function(){ return $(this).val().toUpperCase(); }).get();
        // Get selected pair from radio button (only one)
        const selectedPair = $('#sync-filter-pair input[type="radio"]:checked').val();
        const preferredPairs = selectedPair ? [String(selectedPair).toUpperCase()] : [];
        window.__SYNC_PRICE_QUEUE = [];
        window.__SYNC_PRICE_ACTIVE = false;
        const renderId = Date.now();

        if (!raw.length || selectedCexs.length === 0) {
            modalBody.html('<tr><td colspan="8">Pilih minimal 1 CEX untuk menampilkan koin.</td></tr>');
            updateSyncSelectedCount();
            updateSyncSortIndicators();
            return;
        }

        // ========== FETCH HARGA SELALU PAKAI USDT ==========
        // Fetch harga SELALU pakai USDT (kecuali INDODAX pakai IDR)
        // Pair yang dipilih user (selectedPair) HANYA untuk SAVE, bukan fetch harga
        // selectedPair akan dibaca ulang saat tombol Save diklik
        const pairForPrice = 'USDT'; // ← Hardcoded USDT untuk fetch harga
        // ====================================================

        const savedLookup = new Map();
        const savedPairsLookup = new Map(); // Map untuk menyimpan pairs per koin
        (Array.isArray(savedTokens) ? savedTokens : []).forEach(s => {
            const symIn = String(s.symbol_in || '').toUpperCase();
            const symOut = String(s.symbol_out || '').toUpperCase();
            if (!symIn) return;
            const cexesRaw = Array.isArray(s.selectedCexs) && s.selectedCexs.length ? s.selectedCexs : [s.cex];
            (cexesRaw || []).filter(Boolean).forEach(cx => {
                const cexUp = String(cx).toUpperCase();
                savedLookup.set(`${cexUp}__${symIn}`, s);

                // Kumpulkan pairs untuk koin ini
                const pairKey = `${cexUp}__${symIn}`;
                if (!savedPairsLookup.has(pairKey)) {
                    savedPairsLookup.set(pairKey, new Set());
                }
                if (symOut) {
                    savedPairsLookup.get(pairKey).add(symOut);
                }
            });
        });

        // ========== REFACTOR: JANGAN EXPAND BERDASARKAN PAIR ==========
        // Pair BUKAN filter tampilan, tapi konfigurasi untuk save
        // 1 token = 1 row di tabel, tidak peduli berapa banyak pair
        const processed = [];
        let orderCounter = 0;
        raw.forEach((token, idx) => {
            const baseIndex = (typeof token._idx === 'number') ? token._idx : idx;
            const source = String(token.__source || sourceLabel || 'server').toLowerCase();
            const cexUp = String(token.cex || '').toUpperCase();

            // Simpan token apa adanya, TANPA expand berdasarkan pair
            processed.push(Object.assign({}, token, {
                __baseIndex: baseIndex,
                __source: source,
                cex: cexUp,
                __order: orderCounter++
            }));
        });

        // Filter HANYA berdasarkan CEX (BUKAN pair atau search)
        const filtered = processed.filter(t => {
            const cexUp = String(t.cex || '').toUpperCase();
            if (selectedCexs.length && !selectedCexs.includes(cexUp)) return false;
            return true;
        });

        if (!filtered.length) {
            modalBody.html('<tr><td colspan="8">No tokens match filters.</td></tr>');
            updateSyncSelectedCount();
            updateSyncSortIndicators();
            return;
        }

        // Deteksi koin dengan nama sama tapi SC berbeda
        const symbolScMap = new Map(); // Map<symbol, Set<SC>>
        filtered.forEach(token => {
            const symIn = String(token.symbol_in || '').toUpperCase();
            const scIn = String(token.sc_in || token.contract_in || '').toLowerCase().trim();
            if (!symbolScMap.has(symIn)) {
                symbolScMap.set(symIn, new Set());
            }
            if (scIn && scIn !== '0x' && scIn.length > 6) {
                symbolScMap.get(symIn).add(scIn);
            }
        });

        // Tandai token yang punya multiple SC
        const duplicateSymbols = new Set();
        symbolScMap.forEach((scSet, symbol) => {
            if (scSet.size > 1) {
                duplicateSymbols.add(symbol);
            }
        });

        filtered.forEach(token => {
            const cexUp = String(token.cex || '').toUpperCase();
            const symIn = String(token.symbol_in || '').toUpperCase();
            const savedEntry = savedLookup.get(`${cexUp}__${symIn}`) || null;
            token.__isSaved = !!savedEntry;
            token.__savedEntry = savedEntry;
            const isSnapshot = String(token.__source || sourceLabel || '').toLowerCase() === 'snapshot';
            token.__isSnapshot = !token.__isSaved && isSnapshot;
            token.__statusRank = token.__isSaved ? 0 : (token.__isSnapshot ? 1 : 2);
            token.__hasDuplicateSC = duplicateSymbols.has(symIn); // Flag untuk warna merah
        });

        applySyncSorting(filtered);

        // Debug logging: show tokens that already exist in DB and any internal DB duplicates
        try {
            // Remote vs DB intersection (for current filters)
            const dupRemote = [];
            (filtered || []).forEach((token, idx) => {
                const cexUp = String(token.cex || '').toUpperCase();
                const symIn = String(token.symbol_in || '').toUpperCase();
                const saved = savedLookup.get(`${cexUp}__${symIn}`) || null;
                if (saved) dupRemote.push({ idx: (token._idx ?? idx), cex: cexUp, symbol_in: symIn, savedId: saved.id || '-' });
            });
            /* debug logs removed */

            // Internal DB duplicates (per-chain), expanded per selected CEX
            const keyCounts = {};
            (Array.isArray(savedTokens) ? savedTokens : []).forEach(s => {
                const symIn = String(s.symbol_in || '').toUpperCase();
                if (!symIn) return;
                const cexes = (Array.isArray(s.selectedCexs) && s.selectedCexs.length ? s.selectedCexs : [s.cex])
                    .filter(Boolean)
                    .map(x => String(x).toUpperCase());
                cexes.forEach(cx => {
                    const key = `${cx}__${symIn}`;
                    keyCounts[key] = (keyCounts[key] || 0) + 1;
                });
            });
            const dbDup = Object.entries(keyCounts)
              .filter(([, cnt]) => cnt > 1)
              .map(([k, cnt]) => { const [cx, si] = k.split('__'); return { cex: cx, symbol_in: si, count: cnt }; });
            /* debug logs removed */
        } catch(e) { /* debug logs removed */ }

        const priceJobKeys = new Set();
        const priceJobs = [];

        filtered.forEach((token, index) => {
            const baseIndex = (typeof token.__baseIndex === 'number') ? token.__baseIndex : (token._idx ?? index);
            const source = String(token.__source || sourceLabel || 'server').toLowerCase();
            const cexUp = String(token.cex || '').toUpperCase();
            const symIn = String(token.symbol_in || '').toUpperCase();
            const scInRaw = token.sc_in || token.contract_in || '';
            const desInRaw = token.des_in;

            // Cek apakah koin sudah ada di database (per-chain)
            const saved = token.__isSaved ? (token.__savedEntry || {}) : null;

            // ========== RESTORE STATE CHECKBOX DARI SEBELUM RE-RENDER ==========
            // Key berdasarkan identitas koin: HANYA cex+symbol (TANPA index dan pair)
            const checkboxKey = `${cexUp}__${symIn}`;
            let isChecked = false; // ← DEFAULT: TIDAK TERCENTANG (user harus manual centang atau pakai radio button)

            // Jika ada state checkbox sebelumnya, gunakan state tersebut (PRIORITAS UTAMA)
            // Ini untuk preserve pilihan user saat tabel di-render ulang (filter/sort)
            if (currentCheckboxState.has(checkboxKey)) {
                isChecked = currentCheckboxState.get(checkboxKey);
            }
            // ====================================================================

            // CEX display dengan status badge di baris baru
            const showSourceBadge = token.__isSnapshot;
            const statusText = saved ? '[DIPILIH]' : (showSourceBadge ? '[SNAPSHOT]' : '');
            const statusColor = saved ? '#054b31ff' : '#d96c19ff'; // success green / warning orange

            // Ambil warna CEX dari CONFIG_CEX
            const cexColor = (CONFIG_CEX && CONFIG_CEX[cexUp]) ? CONFIG_CEX[cexUp].WARNA : '#333';

            const cexDisplay = statusText
                ? `<div class="uk-text-bold" style="color:${cexColor};">${cexUp}</div><div style="font-size:10px; color:${statusColor}; font-weight:700; margin-top:2px;">${statusText}</div>`
                : `<div class="uk-text-bold" style="color:${cexColor};">${cexUp}</div>`;

            const scIn = String(scInRaw || '');
            const scDisplay = scIn ? (scIn.length > 12 ? `${scIn.slice(0, 6)}...${scIn.slice(-4)}` : scIn) : '?';
            const decimalsValue = Number(token.des_in);
            const desIn = Number.isFinite(decimalsValue) && decimalsValue >= 0 ? decimalsValue : '?';
            const tokenName = token.token_name || token.name || symIn || '-';

            // Status trade (tradeable) dengan badge ON/OFF
            const tradeableState = parseSnapshotStatus(token.tradeable);
            let tradeBadge = '';

            if (tradeableState === true) {
                tradeBadge = '<span class="uk-label uk-label-success" style="font-size:10px; padding:3px 8px;">ON</span>';
            } else if (tradeableState === false) {
                tradeBadge = '<span class="uk-label uk-label-danger" style="font-size:10px; padding:3px 8px;">OFF</span>';
            } else {
                tradeBadge = '<span class="uk-label" style="font-size:10px; padding:3px 8px; background:#666; color:#fff;">?</span>';
            }
            // ========== PAIR UNTUK HARGA SELALU USDT ==========
            // Fetch harga SELALU pakai USDT (kecuali INDODAX pakai IDR)
            // Tidak peduli pair apa yang dipilih user untuk save
            // pairForPrice sudah dideklarasikan di atas (line 4005)
            const eligibleForPrice = true; // Selalu fetch harga dengan USDT

            const priceStored = Number(token.current_price ?? NaN);
            const priceCurrency = token.price_currency || (cexUp === 'INDODAX' ? 'IDR' : 'USDT');
            const priceDisplay = (Number.isFinite(priceStored) && priceStored > 0)
                ? formatSyncPriceValue(priceStored, priceCurrency)
                : '?';

            // Checkbox: simpan data-cex dan data-symbol (TANPA pair)
            const checkboxHtml = `<input type="checkbox" class="uk-checkbox sync-token-checkbox" data-index="${baseIndex}" data-cex="${cexUp}" data-symbol="${symIn}" ${isChecked ? 'checked' : ''} ${saved ? 'data-saved="1"' : ''}>`;

            // Style untuk koin dengan SC berbeda (warna merah)
            const duplicateStyle = token.__hasDuplicateSC ? ' style="color: #f0506e; font-weight: bold;"' : '';
            const duplicateWarning = token.__hasDuplicateSC ? '⚠️ ' : '';

            // Ambil pairs yang tersimpan untuk koin ini, kelompokkan sesuai PAIRDEXS
            const pairKey = `${cexUp}__${symIn}`;
            const savedPairs = savedPairsLookup.get(pairKey);
            let pairsDisplay = '';
            if (savedPairs && savedPairs.size > 0) {
                // Get main pairs dari PAIRDEXS config
                const mainPairs = Object.keys(pairDefs || {}).map(p => p.toUpperCase());
                const displayPairs = [];
                let hasNonPairs = false;

                // Separate main pairs dan other pairs
                savedPairs.forEach(pair => {
                    if (mainPairs.includes(pair)) {
                        displayPairs.push(pair);
                    } else {
                        hasNonPairs = true;
                    }
                });

                // Jika ada pairs selain main pairs, tambahkan "NON"
                if (hasNonPairs) {
                    displayPairs.push('NON');
                }

                pairsDisplay = displayPairs.length > 0
                    ? `<span style="color: #666; font-size: 10px;"><br/>[${displayPairs.join(',')}]</span>`
                    : '';
            }

            const row = `
                <tr data-sc="${scIn}" data-source="${source}" class="${showSourceBadge ? 'snapshot-row' : ''}">
                    <td class="uk-text-center">${checkboxHtml}</td>
                    <td class="uk-text-center">${index + 1}</td>
                    <td class="uk-text-small" style="line-height:1.4;">${cexDisplay}</td>
                    <td${duplicateStyle}>
                        <span title="${tokenName}${token.__hasDuplicateSC ? ' - Multiple SC Address' : ''}">${duplicateWarning}<strong>${symIn}</strong>${pairsDisplay}</span>
                    </td>
                    <td class="uk-text-small mono" title="${scIn || '-'}"${duplicateStyle}>${scDisplay}</td>
                    <td class="uk-text-center">${desIn}</td>
                    <td class="uk-text-center" style="padding:8px 12px;">
                        ${tradeBadge}
                    </td>
                    <td class="uk-text-right uk-text-small" data-price-cex="${cexUp}" data-symbol="${symIn}" data-index="${baseIndex}">${priceDisplay}</td>
                </tr>`;
            modalBody.append(row);

            // Price fetch: gunakan pair yang dipilih dari radio button
            const $priceCell = $(`#sync-modal-tbody td[data-price-cex="${cexUp}"][data-symbol="${symIn}"][data-index="${baseIndex}"]`);
            if ($priceCell.length) {
                if (eligibleForPrice) {
                    $priceCell.text(priceDisplay === '?' ? '?' : priceDisplay);
                }
                $priceCell.data('render-id', renderId);
            }
            const jobKey = `${cexUp}__${symIn}__${pairForPrice}`;
            if (eligibleForPrice && !priceJobKeys.has(jobKey)) {
                priceJobKeys.add(jobKey);
                priceJobs.push({
                    cex: cexUp,
                    symbol: symIn,
                    pair: pairForPrice,
                    scIn: scIn,
                    scOut: '', // Will be resolved during price fetch
                    chain: chainKey,
                    renderId
                });
            }
        });
        updateSyncSelectedCount();
        updateAddTokenButtonState();
        priceJobs.forEach(queueSyncPriceFetch);
        updateSyncSortIndicators();

        // ========== ENABLE/DISABLE RADIO BUTTON BERDASARKAN DATA TABEL ==========
        // Radio button hanya aktif setelah tabel selesai di-render dan punya data
        const hasTableData = $('#sync-modal-tbody tr').length > 0 &&
                            !$('#sync-modal-tbody tr td[colspan]').length; // Pastikan bukan row kosong/error
        const $modeRadios = $('input[name="sync-pick-mode"]');

        if ($modeRadios.length) {
            $modeRadios.prop('disabled', !hasTableData);

            // Visual feedback: opacity + pointer events
            $modeRadios.closest('label').css({
                opacity: hasTableData ? '1' : '0.5',
                pointerEvents: hasTableData ? 'auto' : 'none',
                cursor: hasTableData ? 'pointer' : 'not-allowed'
            });

            console.log('[renderSyncTable] Radio buttons:', hasTableData ? 'ENABLED' : 'DISABLED', '- Table rows:', $('#sync-modal-tbody tr').length);
        }
        // =========================================================================
    };
});

// Ensure any hard reload navigations do not leave run=YES persisted
try {
    window.addEventListener('beforeunload', function(){
        try { sessionStorage.setItem('APP_FORCE_RUN_NO', '1'); } catch(_) {}
    });
} catch(_) {}

function readCexSelectionFromForm() {
    const selectedCexs = [];
    $('#cex-checkbox-koin input[type="checkbox"]:checked').each(function () {
        selectedCexs.push(String($(this).val()).toUpperCase());
    });
    return { selectedCexs };
}

function readDexSelectionFromForm() {
    const selectedDexs = [];
    const dataDexs = {};
    $('#dex-checkbox-koin .dex-edit-checkbox:checked').each(function () {
        const dexName = String($(this).val());
        const dexKeyLower = dexName.toLowerCase().replace(/[^a-z0-9_-]/gi, '');
        // Normalize: always use lowercase canonical key for consistency
        const canonicalKey = dexKeyLower || dexName.toLowerCase();
        const leftVal  = parseFloat($(`#dex-${dexKeyLower}-left`).val());
        const rightVal = parseFloat($(`#dex-${dexKeyLower}-right`).val());
        selectedDexs.push(canonicalKey);
        dataDexs[canonicalKey] = { left: isNaN(leftVal) ? 0 : leftVal, right: isNaN(rightVal) ? 0 : rightVal };
    });
    return { selectedDexs, dataDexs };
}

    function deleteTokenById(tokenId) {
        const m = getAppMode();
        let tokens = (m.type === 'single') ? getTokensChain(m.chain) : getTokensMulti();
        const updated = tokens.filter(t => String(t.id) !== String(tokenId));
        if (m.type === 'single') setTokensChain(m.chain, updated); else setTokensMulti(updated);
        refreshTokensTable();
        try { loadAndDisplaySingleChainTokens(); } catch(_) {}
        renderTokenManagementList();
        setLastAction("UBAH KOIN");
    }

async function updateInfoFromHistory() {
    try {
        // Do not override RUN banner while scanning
        try {
            const anyRun = (function(){
                const st = (typeof getAppState === 'function') ? getAppState() : { run: 'NO' };
                if (String(st.run||'NO').toUpperCase() === 'YES') return true;
                if (window.RUN_STATES) {
                    return Object.values(window.RUN_STATES).some(Boolean);
                }
                return false;
            })();
            if (anyRun) { if (typeof window.updateRunningChainsBanner === 'function') window.updateRunningChainsBanner(); return; }
        } catch(_) {}
        if (typeof getHistoryLog === 'function') {
            const list = await getHistoryLog();
            const last = Array.isArray(list) && list.length ? list[list.length - 1] : null;
            if (last && last.action && (last.time || last.timeISO)) {
                const t = last.time || new Date(last.timeISO).toLocaleString('id-ID', { hour12: false });
                $("#infoAPP").show().text(`${last.action} at ${t}`);
                return;
            }
        }
    } catch(_) {}
    try { $("#infoAPP").empty(); } catch(_) {}
}

function setLastAction(action, statusOrMeta, maybeMeta) {
    const formattedTime = new Date().toLocaleString('id-ID', { hour12: false });
    // Normalize status/meta early so we can enrich the action text conditionally
    const status = (typeof statusOrMeta === 'string') ? statusOrMeta : 'success';
    const meta = (typeof statusOrMeta === 'object' && statusOrMeta) ? statusOrMeta : (maybeMeta || undefined);

    // Build action label consistently with history (append [CHAIN] unless excluded)
    const excludeChain = /BACKUP|RESTORE|SETTING/i.test(String(action||''));
    // Normalize incoming action: drop any existing [..] chunks and trailing extras
    let baseAction = String(action||'').replace(/\s*\[[^\]]*\]/g, '').trim();
    let displayAction = baseAction;
    try {
        // Only append if not already has trailing [..]
        const hasBracket = /\[[^\]]+\]$/.test(displayAction);
        if (!excludeChain && !hasBracket) {
            let chainLabel = 'MULTICHAIN';
            try {
                const m = getAppMode();
                chainLabel = (m && String(m.type).toLowerCase()==='single') ? String(m.chain||'').toUpperCase() : 'MULTICHAIN';
            } catch(_) {}
            displayAction = `${displayAction} [${chainLabel}]`;
        }
    } catch(_) {}

    // Special case: enrich Update Wallet history with failed CEX names if any
    try {
        if (/^UPDATE\s+WALLET\s+EXCHANGER/i.test(baseAction) && meta && Array.isArray(meta.failedCex) && meta.failedCex.length) {
            const names = meta.failedCex.map(s => String(s).toUpperCase()).join(', ');
            displayAction = `${displayAction} | FAIL: ${names}`;
        }
    } catch(_) {}

    // Do not override RUN banner while scanning
    try {
        const st = (typeof getAppState === 'function') ? getAppState() : { run: 'NO' };
        const anyRun = (String(st.run||'NO').toUpperCase() === 'YES') || (window.RUN_STATES && Object.values(window.RUN_STATES).some(Boolean));
        if (!anyRun) {
            $("#infoAPP").html(`${displayAction} at ${formattedTime}`);
        } else {
            if (typeof window.updateRunningChainsBanner === 'function') window.updateRunningChainsBanner();
        }
    } catch(_) {}

    // Append to HISTORY_LOG in IndexedDB with same label (single source of truth)
    try {
        if (typeof addHistoryEntry === 'function') addHistoryEntry(displayAction, status, meta, { includeChain: false });
    } catch(_) {}
    // Update info label from history log
    try { updateInfoFromHistory(); } catch(_) {}
}

// getManagedChains is defined in utils.js (deduplicated)

/**
 * Calculates the result of a swap and returns a data object for the UI queue.
 */
// calculateResult is implemented in dom-renderer.js (deduplicated)
    // Backup/Restore modal
$(document).on('click', '#openBackupModal', function(e){ e.preventDefault(); try { UIkit.modal('#backup-modal').show(); } catch(_) {} });
// History modal
$(document).on('click', '#openHistoryModal', function(e){ e.preventDefault(); try { UIkit.modal('#history-modal').show(); renderHistoryTable(); } catch(_) {} });
// Database Viewer
$(document).on('click', '#openDatabaseViewer', function(e){ e.preventDefault(); try { if(window.App?.DatabaseViewer?.show) window.App.DatabaseViewer.show(); } catch(err) { console.error('Database Viewer error:', err); } });

async function renderHistoryTable(){
  try {
    const rows = await (window.getHistoryLog ? window.getHistoryLog() : Promise.resolve([]));
    const mode = String($('#histMode').val()||'all').toLowerCase();
    const chain = String($('#histChain').val()||'').trim().toUpperCase();
    const q = String($('#histSearch').val()||'').toLowerCase();
    const filtered = rows.filter(r => {
      // Since action already contains [CHAIN], chain filter applies to action string
      if (chain && String(r.action||'').toUpperCase().indexOf(`[${chain}]`) === -1) return false;
      if (mode !== 'all') {
        const isSingle = /\[[A-Z0-9_]+\]$/.test(String(r.action||''));
        if (mode === 'single' && !isSingle) return false;
        if (mode === 'multi' && isSingle && String(r.action||'').toUpperCase().indexOf('[MULTICHAIN]') === -1) return false;
      }
      if (q) {
        const blob = `${r.action||''} ${r.status||''} ${r.time||''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).reverse();
    const $tb = $('#histTbody').empty();
    filtered.forEach(it => {
      const id = String(it.id||'');
      const stColor = (it.status==='success')?'#1e8e3e':(it.status==='warning')?'#b37d00':'#b3261e';
      // Build optional failure badge if meta.failedCex present
      let actionCell = String(it.action||'');
      try {
        const fails = Array.isArray(it.meta?.failedCex) ? it.meta.failedCex.filter(Boolean).map(s=>String(s).toUpperCase()) : [];
        if (fails.length) {
          const title = fails.join(', ');
          const badge = `<span class="uk-badge hist-badge-fail" title="${title}">${fails.length}</span>`;
          actionCell = `${actionCell} ${badge}`;
        }
      } catch(_) {}
      const tr = `
        <tr data-id="${id}">
          <td><input type="checkbox" class="histRowChk"></td>
          <td>${it.time||''}</td>
          <td>${actionCell}</td>
          <td><span style="color:${stColor}; font-weight:600;">${String(it.status||'').toUpperCase()}</span></td>
        </tr>`;
      $tb.append(tr);
    });
  } catch(e) { /* debug logs removed */ }
}

$(document).on('change', '#histMode, #histChain, #histSearch', function(){ renderHistoryTable(); });
$(document).on('click', '#histSelectAll', function(){ const on=this.checked; $('#histTbody .histRowChk').prop('checked', on); });
$(document).on('click', '#histDeleteSelected', async function(){
  try {
    const ids = $('#histTbody .histRowChk:checked').map(function(){ return $(this).closest('tr').data('id'); }).get();
    if (!ids.length) { if (typeof toast !== 'undefined' && toast.info) toast.info('Pilih data riwayat terlebih dahulu.'); return; }
    const res = await (window.deleteHistoryByIds ? window.deleteHistoryByIds(ids) : Promise.resolve({ ok:false }));
    if (res.ok) { if (typeof toast !== 'undefined' && toast.success) toast.success(`Hapus ${res.removed||ids.length} entri riwayat.`); renderHistoryTable(); }
    else { if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal menghapus riwayat.'); }
  } catch(e) { if (typeof toast !== 'undefined' && toast.error) toast.error('Error saat menghapus riwayat.'); }
});
$(document).on('click', '#histClearAll', async function(){
  try {
    if (!confirm('Bersihkan semua riwayat?')) return;
    const ok = await (window.clearHistoryLog ? window.clearHistoryLog() : Promise.resolve(false));
    if (ok) { if (typeof toast !== 'undefined' && toast.success) toast.success('Riwayat dibersihkan.'); renderHistoryTable(); }
    else { if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal membersihkan riwayat.'); }
  } catch(e) { if (typeof toast !== 'undefined' && toast.error) toast.error('Error saat membersihkan riwayat.'); }
});
// No export/save from History per request
    $(document).on('click', '#btnBackupDb', async function(){
        try {
            const payload = await (window.exportIDB ? window.exportIDB() : Promise.resolve(null));
            if (!payload || !payload.items) { if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal membuat backup.'); return; }
            const filename = `${MAIN_APP_NAME_SAFE}_BACKUP_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
            const ok = window.downloadJSON ? window.downloadJSON(filename, payload) : false;
            if (ok) {
                if (typeof toast !== 'undefined' && toast.success) toast.success(`Backup berhasil. ${payload.count||payload.items.length} item disalin.`);
                try { setLastAction('BACKUP DATABASE'); } catch(_) {}
                try { $('#backupSummary').text(`Backup: ${payload.items.length} item pada ${new Date().toLocaleString('id-ID',{hour12:false})}`); } catch(_) {}
            } else {
                if (typeof toast !== 'undefined' && toast.error) toast.error('Gagal mengunduh file backup.');
            }
        } catch(e) {
            // console.error('Backup error:', e);
            if (typeof toast !== 'undefined' && toast.error) toast.error('Terjadi kesalahan saat backup.');
            try { setLastAction('BACKUP DATABASE', 'error', { error: String(e && e.message || e) }); } catch(_) {}
        }
    });
    $(document).on('click', '#btnRestoreDb', function(){ $('#restoreFileInput').trigger('click'); });
    $(document).on('change', '#restoreFileInput', function(ev){
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(e){
            try{
                const text = String(e.target.result||'').trim();
                const json = JSON.parse(text);
                // Validasi dasar payload backup
                if (!json || typeof json !== 'object' || json.schema !== 'kv-v1' || !Array.isArray(json.items)) {
                    if (typeof toast !== 'undefined' && toast.error) toast.error('File backup tidak valid atau schema tidak dikenali.');
                    return;
                }
                // Info jika DB/Store berbeda (tetap lanjut restore)
                try {
                    if (json.db && String(json.db) !== String(PRIMARY_DB_NAME)) {
                        if (typeof toast !== 'undefined' && toast.warning) toast.warning(`Nama database berbeda: ${json.db}`);
                    }
                    if (json.store && String(json.store) !== String(PRIMARY_KV_STORE)) {
                        if (typeof toast !== 'undefined' && toast.warning) toast.warning(`Nama store berbeda: ${json.store}`);
                    }
                } catch(_) {}
                const res = await (window.restoreIDB ? window.restoreIDB(json) : Promise.resolve({ ok:0, fail:0 }));
                try { setLastAction('RESTORE DATABASE'); } catch(_) {}
                const msg = `Restore selesai. OK: ${res.ok}, Fail: ${res.fail}`;
                try { if (typeof toast !== 'undefined' && toast.success) toast.success(`✅ ${msg}`); } catch(_) {}
                try { $('#backupSummary').text(`Restore OK: ${res.ok}, Fail: ${res.fail}`); } catch(_) {}
                // Tampilkan alert sukses dan reload halaman agar data hasil restore terpakai penuh
                try { alert(`✅ ${msg}\nHalaman akan di-reload untuk menerapkan perubahan.`); } catch(_) {}
                try { location.reload(); } catch(_) {}
            } catch(err){
                // console.error('Restore parse error:', err);
                if (typeof toast !== 'undefined' && toast.error) toast.error('File tidak valid. Pastikan format JSON benar.');
                try { setLastAction('RESTORE DATABASE', 'error', { error: String(err && err.message || err) }); } catch(_) {}
            } finally {
                try { ev.target.value = ''; } catch(_) {}
            }
        };
        reader.readAsText(file);
    });

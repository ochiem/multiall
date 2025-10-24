// =================================================================================
// DATABASE VIEWER MODULE
// =================================================================================
/**
 * Module untuk menampilkan semua data tabel dari IndexedDB
 * - Accordion cards per tabel
 * - Pencarian global dan per-tabel
 * - Summary statistik per tabel
 * - Export data ke JSON
 *
 * Tabel yang ditampilkan:
 * - SETTING_SCANNER
 * - KOIN_<CHAIN> (BSC, ETH, SOLANA, dll)
 * - SNAPSHOT_DATA_KOIN (unified snapshot)
 * - FILTER_<CHAIN>
 */

(function(global) {
    'use strict';

    const root = global || (typeof window !== 'undefined' ? window : {});
    const App = root.App || (root.App = {});

    // Configuration
    const DB_CONFIG = {
        name: '',
        store: '',
        snapshotStore: '',
        initialized: false
    };

    // State management
    let allTablesData = {};
    let filteredData = {};
    let searchQuery = '';
    let expandedTables = new Set();

    /**
     * Helper to get chain color from config
     */
    function getChainColor(chainKey) {
        try {
            if (!chainKey) return '#667eea'; // Default color
            const config = root.CONFIG_CHAINS || {};
            const chainData = config[String(chainKey).toLowerCase()];
            return chainData?.WARNA || '#667eea';
        } catch (e) {
            return '#667eea';
        }
    }

    /**
     * Initialize DB configuration from global config
     */
    function initializeDBConfig() {
        try {
            const appCfg = root.CONFIG_APP?.APP || {};
            const dbCfg = root.CONFIG_DB || {};

            // Use the dynamic database name from the main config
            DB_CONFIG.name = dbCfg.NAME || appCfg.NAME || 'MULTIALL-PLUS';

            // Store names from CONFIG_DB so it follows config changes
            DB_CONFIG.store = (dbCfg && dbCfg.STORES && dbCfg.STORES.KV) ? dbCfg.STORES.KV : 'APP_KV_STORE';
            DB_CONFIG.snapshotStore = (dbCfg && dbCfg.STORES && dbCfg.STORES.SNAPSHOT) ? dbCfg.STORES.SNAPSHOT : 'SNAPSHOT_STORE';
            DB_CONFIG.initialized = true;

            console.log('[Database Viewer] Initialized with config:', DB_CONFIG);
            console.log('[Database Viewer] Expected stores: APP_KV_STORE, SNAPSHOT_STORE');
        } catch(err) {
            console.error('[Database Viewer] Error initializing config:', err);
        }
    }

    /**
     * Get all chain keys from CONFIG_CHAINS with fallback
     */
    function getAllChainKeys() {
        try {
            const chains = root.CONFIG_CHAINS || {};
            const chainKeys = Object.keys(chains).filter(key => key !== 'multichain');

            if (chainKeys.length > 0) {
                console.log('[Database Viewer] Chains from CONFIG_CHAINS:', chainKeys);
                return chainKeys;
            }

            // Fallback: Detect from IndexedDB keys
            console.warn('[Database Viewer] CONFIG_CHAINS not found, using fallback chain list');
            // Hardcoded common chains sebagai fallback
            return ['bsc', 'ethereum', 'solana', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'fantom', 'base', 'ton'];
        } catch(err) {
            console.error('[Database Viewer] Error getting chain keys:', err);
            // Ultimate fallback
            return ['bsc', 'ethereum', 'solana'];
        }
    }

    /**
     * Load all data from IndexedDB
     */
    async function loadAllTableData() {
        if (!DB_CONFIG.initialized) {
            initializeDBConfig();
        }

        console.log('[Database Viewer] Loading tables with config:', DB_CONFIG);

        // Preferred path: use centralized storage API so DB responds to config changes
        try {
            if (typeof window.exportIDB === 'function') {
                const tables = {};

                const payload = await window.exportIDB();
                const storagePrefix = (function(){ try { return String(window.storagePrefix || ''); } catch(_) { return ''; }})();
                const strip = (k) => (k && storagePrefix && String(k).startsWith(storagePrefix)) ? String(k).slice(storagePrefix.length) : String(k);

                const kvIndex = new Map(); // stripped -> { rawKey, val }
                if (payload && Array.isArray(payload.items)) {
                    for (const it of payload.items) {
                        if (!it || typeof it.key !== 'string') continue;
                        kvIndex.set(strip(it.key), { rawKey: it.key, val: it.val });
                    }
                }

                const getKv = (k) => { const r = kvIndex.get(String(k)); return r ? r.val : undefined; };

                // Settings
                const settings = getKv('SETTING_SCANNER') ?? (typeof window.getFromLocalStorage === 'function' ? window.getFromLocalStorage('SETTING_SCANNER', undefined) : undefined);
                if (settings) {
                    tables['SETTING_SCANNER'] = {
                        name: 'SETTING_SCANNER', displayName: 'Setting Scanner', type: 'settings', rawKey: (kvIndex.get('SETTING_SCANNER')||{}).rawKey || 'SETTING_SCANNER', data: settings, count: Object.keys(settings).length
                    };
                }

                // Tokens by chain
                const chains = getAllChainKeys();
                for (const chain of chains) {
                    const chainUpper = chain.toUpperCase();
                    const chainCfg = root.CONFIG_CHAINS?.[chain.toLowerCase()] || {};
                    const chainName = chainCfg.Nama_Chain || chainUpper;
                    const key = `TOKEN_${chainUpper}`;
                    const data = getKv(key);
                    if (Array.isArray(data) && data.length) {
                        tables[key] = { name: key, displayName: `Koin ${chainName}`, type: 'koin', chain: chain, rawKey: (kvIndex.get(key)||{}).rawKey || key, data, count: data.length };
                    }
                }

                // Token Multichain (global list)
                const multiTokens = getKv('TOKEN_MULTICHAIN');
                if (Array.isArray(multiTokens) && multiTokens.length) {
                    tables['TOKEN_MULTICHAIN'] = {
                        name: 'TOKEN_MULTICHAIN',
                        displayName: 'Koin Multichain',
                        type: 'koin',
                        chain: 'multichain',
                        rawKey: (kvIndex.get('TOKEN_MULTICHAIN') || {}).rawKey || 'TOKEN_MULTICHAIN',
                        data: multiTokens,
                        count: multiTokens.length
                    };
                }

                // Snapshot map via snapshot module
                if (typeof window.snapshotDbGet === 'function') {
                    const snap = await window.snapshotDbGet('SNAPSHOT_DATA_KOIN');
                    if (snap && typeof snap === 'object') {
                        Object.keys(snap).forEach(chainKey => {
                            const arr = snap[chainKey];
                            if (Array.isArray(arr) && arr.length) {
                                const chainLower = String(chainKey).toLowerCase();
                                const chainCfg = root.CONFIG_CHAINS?.[chainLower] || {};
                                const disp = chainCfg.Nama_Chain || chainKey.toUpperCase();
                                const tKey = `SNAPSHOT_${chainKey.toUpperCase()}`;
                                tables[tKey] = { name: tKey, displayName: `Snapshot ${disp}`, type: 'snapshot', chain: chainLower, data: arr, count: arr.length };
                            }
                        });
                    }
                }

                // Filters
                for (const chain of chains) {
                    const chainUpper = chain.toUpperCase();
                    const chainCfg = root.CONFIG_CHAINS?.[chain.toLowerCase()] || {};
                    const chainName = chainCfg.Nama_Chain || chainUpper;
                    const key = `FILTER_${chainUpper}`;
                    const data = getKv(key);
                    if (data) {
                        tables[key] = { name: key, displayName: `Filter ${chainName}`, type: 'filter', chain: chain, rawKey: (kvIndex.get(key)||{}).rawKey || key, data, count: typeof data === 'object' ? Object.keys(data).length : 1 };
                    }
                }

                // Filter Multichain
                const fm = getKv('FILTER_MULTICHAIN') ?? (typeof window.getFromLocalStorage === 'function' ? window.getFromLocalStorage('FILTER_MULTICHAIN', undefined) : undefined);
                if (fm) {
                    tables['FILTER_MULTICHAIN'] = { name: 'FILTER_MULTICHAIN', displayName: 'Filter Multichain', type: 'filter', chain: 'multichain', rawKey: (kvIndex.get('FILTER_MULTICHAIN')||{}).rawKey || 'FILTER_MULTICHAIN', data: fm, count: typeof fm === 'object' ? Object.keys(fm).length : 1 };
                }

                allTablesData = tables;
                filteredData = { ...tables };
                return tables;
            }
        } catch(e) {
            console.warn('[Database Viewer] Storage module path failed, falling back to direct IDB:', e);
        }

        try {
            const db = await openDatabase();
            const tables = {};

            // Get all available keys from APP_KV_STORE for auto-detection
            const allKeys = await getAllKeysFromStore(db, DB_CONFIG.store);
            console.log('[Database Viewer] All keys in APP_KV_STORE:', allKeys);

            // 1. Load SETTING_SCANNER
            console.log('[Database Viewer] Loading SETTING_SCANNER...');
            const settings = await getFromDB(db, DB_CONFIG.store, 'SETTING_SCANNER');
            console.log('[Database Viewer] SETTING_SCANNER result:', settings);
            if (settings) {
                tables['SETTING_SCANNER'] = {
                    name: 'SETTING_SCANNER',
                    displayName: 'Setting Scanner',
                    type: 'settings',
                    data: settings,
                    count: Object.keys(settings).length
                };
            }

            // 2. Load KOIN_<CHAIN> for all chains
            const chains = getAllChainKeys();
            console.log('[Database Viewer] Chains found:', chains);

            for (const chain of chains) {
                // Try both formats: BSC and ETHEREUM (not ETH)
                const chainUpper = chain.toUpperCase();

                // Get chain display name (ETHEREUM instead of ETH)
                const chainConfig = root.CONFIG_CHAINS?.[chain.toLowerCase()] || {};
                const chainDisplayName = chainConfig.Nama_Chain || chainUpper;

                const key = `TOKEN_${chainUpper}`;
                console.log(`[Database Viewer] Loading ${key}...`);
                const koinData = await getFromDB(db, DB_CONFIG.store, key);
                console.log(`[Database Viewer] ${key} result:`, koinData ? `${koinData.length} items` : 'null');

                if (koinData && Array.isArray(koinData) && koinData.length > 0) {
                    tables[key] = {
                        name: key,
                        displayName: `Koin ${chainDisplayName}`,
                        type: 'koin',
                        chain: chain,
                        data: koinData,
                        count: koinData.length
                    };
                }
            }

            // Load TOKEN_MULTICHAIN
            console.log('[Database Viewer] Loading TOKEN_MULTICHAIN...');
            const multiTokens = await getFromDB(db, DB_CONFIG.store, 'TOKEN_MULTICHAIN');
            console.log('[Database Viewer] TOKEN_MULTICHAIN result:', multiTokens ? `${multiTokens.length || 0} items` : 'null');
            if (Array.isArray(multiTokens) && multiTokens.length > 0) {
                tables['TOKEN_MULTICHAIN'] = {
                    name: 'TOKEN_MULTICHAIN',
                    displayName: 'Koin Multichain',
                    type: 'koin',
                    chain: 'multichain',
                    data: multiTokens,
                    count: multiTokens.length
                };
            }

            // 3. Load SNAPSHOT_DATA_KOIN (unified snapshot from SNAPSHOT_STORE)
            const snapshotData = await getFromDB(db, DB_CONFIG.snapshotStore, 'SNAPSHOT_DATA_KOIN');
            if (snapshotData && typeof snapshotData === 'object') {
                // Snapshot data adalah object dengan key per chain
                Object.keys(snapshotData).forEach(chainKey => {
                    const chainData = snapshotData[chainKey];
                    if (Array.isArray(chainData) && chainData.length > 0) {
                        const tableKey = `SNAPSHOT_${chainKey.toUpperCase()}`;
                        tables[tableKey] = {
                            name: tableKey,
                            displayName: `Snapshot ${chainKey.toUpperCase()}`,
                            type: 'snapshot',
                            chain: chainKey,
                            data: chainData,
                            count: chainData.length
                        };
                    }
                });
            }

            // 4. Load FILTER_<CHAIN> for all chains
            for (const chain of chains) {
                const chainUpper = chain.toUpperCase();

                // Get chain display name
                const chainConfig = root.CONFIG_CHAINS?.[chain.toLowerCase()] || {};
                const chainDisplayName = chainConfig.Nama_Chain || chainUpper;

                const key = `FILTER_${chainUpper}`;
                console.log(`[Database Viewer] Loading ${key}...`);
                const filterData = await getFromDB(db, DB_CONFIG.store, key);
                console.log(`[Database Viewer] ${key} result:`, filterData ? 'Found' : 'null');

                if (filterData) {
                    tables[key] = {
                        name: key,
                        displayName: `Filter ${chainDisplayName}`,
                        type: 'filter',
                        chain: chain,
                        data: filterData,
                        count: typeof filterData === 'object' ? Object.keys(filterData).length : 1
                    };
                }
            }

            // 5. Load FILTER_MULTICHAIN
            console.log('[Database Viewer] Loading FILTER_MULTICHAIN...');
            let filterMulti = await getFromDB(db, DB_CONFIG.store, 'FILTER_MULTICHAIN');
            if (!filterMulti && typeof window.getFromLocalStorage === 'function') {
                filterMulti = window.getFromLocalStorage('FILTER_MULTICHAIN', undefined);
            }
            console.log('[Database Viewer] FILTER_MULTICHAIN result:', filterMulti);
            if (filterMulti) {
                tables['FILTER_MULTICHAIN'] = {
                    name: 'FILTER_MULTICHAIN',
                    displayName: 'Filter Multichain',
                    type: 'filter',
                    chain: 'multichain',
                    data: filterMulti,
                    count: typeof filterMulti === 'object' ? Object.keys(filterMulti).length : 1
                };
            }

            allTablesData = tables;
            filteredData = { ...tables };

            console.log('[Database Viewer] ✅ Total tables loaded:', Object.keys(tables).length);
            console.log('[Database Viewer] Table list:', Object.keys(tables));
            return tables;

        } catch(err) {
            console.error('[Database Viewer] Error loading data:', err);
            return {};
        }
    }

    /**
     * Open IndexedDB database
     */
    function openDatabase() {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(DB_CONFIG.name);

                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };

                request.onerror = (event) => {
                    reject(new Error('Failed to open database'));
                };
            } catch(err) {
                reject(err);
            }
        });
    }

    /**
     * Get all keys from a store (for auto-detection)
     */
    function getAllKeysFromStore(db, storeName) {
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([storeName], 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => {
                    resolve(request.result || []);
                };

                request.onerror = () => {
                    resolve([]);
                };
            } catch(err) {
                console.error(`[Database Viewer] Error getting keys from ${storeName}:`, err);
                resolve([]);
            }
        });
    }

    /**
     * Get data from IndexedDB store
     * Support multiple data formats based on screenshot analysis:
     * - {key: 'xxx', val: data} (standard MULTIPLUS-DEV format)
     * - direct data (fallback)
     */
    function getFromDB(db, storeName, key) {
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([storeName], 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;

                    if (!result) {
                        console.log(`[Database Viewer] ${storeName}/${key}: No data found`);
                        resolve(null);
                        return;
                    }

                    // Dari screenshot: format adalah {key: 'TOKEN_BSC', val: Array(600)}
                    if (result.val !== undefined) {
                        const dataType = Array.isArray(result.val) ? `Array(${result.val.length})` : typeof result.val;
                        console.log(`[Database Viewer] ${storeName}/${key}: ✅ Found - Type: ${dataType}`);
                        resolve(result.val);
                    } else if (result.value !== undefined) {
                        console.log(`[Database Viewer] ${storeName}/${key}: Found with .value format`);
                        resolve(result.value);
                    } else {
                        console.log(`[Database Viewer] ${storeName}/${key}: Found with direct format`);
                        resolve(result);
                    }
                };

                request.onerror = (err) => {
                    console.error(`[Database Viewer] ❌ Error reading ${key} from ${storeName}:`, err);
                    resolve(null);
                };
            } catch(err) {
                console.error(`[Database Viewer] ❌ Exception reading ${key} from ${storeName}:`, err);
                resolve(null);
            }
        });
    }

    /**
     * Apply search filter to tables
     */
    function applySearch(query) {
        searchQuery = query.toLowerCase();

        if (!query) {
            filteredData = { ...allTablesData };
            return;
        }

        filteredData = {};

        Object.keys(allTablesData).forEach(tableKey => {
            const table = allTablesData[tableKey];

            // Filter by table name
            if (table.displayName.toLowerCase().includes(searchQuery)) {
                filteredData[tableKey] = table;
                return;
            }

            // Filter by table data content
            if (table.type === 'koin' || table.type === 'snapshot') {
                const filtered = table.data.filter(item => {
                    const searchStr = JSON.stringify(item).toLowerCase();
                    return searchStr.includes(searchQuery);
                });

                if (filtered.length > 0) {
                    filteredData[tableKey] = {
                        ...table,
                        data: filtered,
                        count: filtered.length
                    };
                }
            } else if (table.type === 'settings' || table.type === 'filter') {
                const searchStr = JSON.stringify(table.data).toLowerCase();
                if (searchStr.includes(searchQuery)) {
                    filteredData[tableKey] = table;
                }
            }
        });
    }

    /**
     * Render summary statistics for a table
     */
    function renderTableSummary(table) {
        if (table.type === 'koin' || table.type === 'snapshot') {
            const data = table.data;
            const cexSet = new Set();
            const dexSet = new Set();
            let withSC = 0;
            let withoutSC = 0;

            data.forEach(item => {
                // Count CEX
                if (item.selectedCexs && Array.isArray(item.selectedCexs)) {
                    item.selectedCexs.forEach(cex => cexSet.add(cex));
                } else if (item.cex) {
                    cexSet.add(item.cex);
                }

                // Count DEX
                if (item.selectedDexs && Array.isArray(item.selectedDexs)) {
                    item.selectedDexs.forEach(dex => dexSet.add(dex));
                }

                // Count SC
                const sc = item.sc_in || item.contract_in || '';
                if (sc && sc !== '0x' && sc !== '-') {
                    withSC++;
                } else {
                    withoutSC++;
                }
            });

            return `
                <div class="db-table-summary">
                    <span class="summary-item">
                        <strong>${table.count}</strong> koin
                    </span>
                    <span class="summary-item">
                        <strong>${cexSet.size}</strong> CEX
                    </span>
                    <span class="summary-item">
                        <strong>${dexSet.size}</strong> DEX
                    </span>
                    <span class="summary-item">
                        SC: <strong>${withSC}</strong> ada / <strong>${withoutSC}</strong> kosong
                    </span>
                </div>
            `;
        } else if (table.type === 'filter') {
            const data = table.data;
            const cexCount = data.cex ? data.cex.length : 0;
            const dexCount = data.dex ? data.dex.length : 0;

            return `
                <div class="db-table-summary">
                    <span class="summary-item">
                        CEX aktif: <strong>${cexCount}</strong>
                    </span>
                    <span class="summary-item">
                        DEX aktif: <strong>${dexCount}</strong>
                    </span>
                </div>
            `;
        } else if (table.type === 'settings') {
            return `
                <div class="db-table-summary">
                    <span class="summary-item">
                        <strong>${table.count}</strong> pengaturan
                    </span>
                </div>
            `;
        }

        return '';
    }

    /**
     * Render table data as HTML table
     */
    function renderTableData(table) {
        if (table.type === 'koin' || table.type === 'snapshot' || table.type === 'settings') {
            return renderKoinTable(table.data);
        } else if (table.type === 'filter') {
            return renderFilterData(table.data);
        } else if (table.type === 'settings') {
            return renderSettingsData(table.data);
        }
        return '<p class="uk-text-muted">No data renderer available</p>';
    }

    /**
     * Render koin data as table
     */
    function renderKoinTable(data) {
        const isArray = Array.isArray(data);
        if (!data || (isArray && data.length === 0) || (!isArray && Object.keys(data).length === 0)) {
            return '<p class="uk-text-muted uk-text-center">Tidak ada data</p>';
        }

        let html = `
            <div class="uk-overflow-auto">
                <table class="uk-table uk-table-divider uk-table-hover uk-table-small db-data-table">
                    <thead>
                        <tr>
                            <th style="width:40px">No</th>
                            <th>Symbol In</th>
                            <th>Symbol Out</th>
                            <th>SC In</th>
                            <th style="width:60px">DES</th>
                            <th>CEX</th>
                            <th>DEX</th>
                            <th style="width:80px">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (isArray) {
            data.forEach((item, idx) => {
                const symbolIn = item.symbol_in || '-';
                const symbolOut = item.symbol_out || '-';
                const scIn = item.sc_in || item.contract_in || '-';
                const des = item.des_in ?? item.decimals ?? '-';
                const status = item.status ? 'Aktif' : 'Nonaktif';
                const statusClass = item.status ? 'uk-label-success' : 'uk-label-warning';

                let cexList = Array.isArray(item.selectedCexs) ? item.selectedCexs.join(', ') : (item.cex || '');
                let dexList = Array.isArray(item.selectedDexs) ? item.selectedDexs.join(', ') : '';

                const shortenSc = (sc) => (!sc || sc === '-' || sc.length < 12) ? sc : `${sc.substring(0, 6)}...${sc.substring(sc.length - 4)}`;

                html += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${symbolIn}</strong></td>
                        <td>${symbolOut}</td>
                        <td class="uk-text-truncate" title="${scIn}">
                            <code class="uk-text-small">${shortenSc(scIn)}</code>
                        </td>
                        <td class="uk-text-center">${des}</td>
                        <td class="uk-text-small">${cexList}</td>
                        <td class="uk-text-small">${dexList}</td>
                        <td><span class="uk-label ${statusClass}" style="font-size:10px">${status}</span></td>
                    </tr>
                `;
            });
        } else {
            // Handle object data (like SETTING_SCANNER)
            html = `
                <div class="uk-overflow-auto">
                    <table class="uk-table uk-table-divider uk-table-hover uk-table-small db-data-table">
                        <thead><tr><th data-sort-index="0">Key <span class="sort-indicator"></span></th><th data-sort-index="1">Value <span class="sort-indicator"></span></th></tr></thead>
                        <tbody>
            `;
            Object.entries(data).forEach(([key, value]) => {
                // Special rendering for userRPCs to show each chain's RPC clearly
                if (key === 'userRPCs' && typeof value === 'object' && value !== null) {
                    let rpcHtml = '<div class="uk-margin-remove">';
                    Object.entries(value).forEach(([chain, rpcUrl]) => {
                        const chainConfig = (typeof window !== 'undefined' && window.CONFIG_CHAINS) ? window.CONFIG_CHAINS[chain.toLowerCase()] : null;
                        const chainColor = chainConfig?.WARNA || '#667eea';
                        const chainLabel = chainConfig?.Nama_Chain?.toUpperCase() || chain.toUpperCase();
                        rpcHtml += `
                            <div class="uk-margin-small-bottom" style="padding: 4px 8px; border-left: 3px solid ${chainColor}; background: ${chainColor}10;">
                                <div><strong style="color: ${chainColor};">${chainLabel}</strong></div>
                                <div class="uk-text-small uk-text-truncate" style="font-family: monospace; color: #666;" title="${rpcUrl}">${rpcUrl}</div>
                            </div>
                        `;
                    });
                    rpcHtml += '</div>';
                    html += `<tr><td><strong>${key}</strong></td><td>${rpcHtml}</td></tr>`;
                } else {
                    const valStr = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
                    html += `<tr><td><strong>${key}</strong></td><td class="uk-text-small uk-text-truncate" title="${valStr}">${valStr}</td></tr>`;
                }
            });
            html += '</tbody></table></div>';
            return html;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    /**
     * Render filter data
     */
    function renderFilterData(data) {
        let html = '<div class="db-filter-data">';

        if (data.cex && Array.isArray(data.cex)) {
            html += `
                <div class="uk-margin-small">
                    <strong>CEX Aktif (${data.cex.length}):</strong>
                    <div class="uk-margin-small-top">
                        ${data.cex.map(cex => `<span class="uk-label uk-label-primary uk-margin-small-right">${cex}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (data.dex && Array.isArray(data.dex)) {
            html += `
                <div class="uk-margin-small">
                    <strong>DEX Aktif (${data.dex.length}):</strong>
                    <div class="uk-margin-small-top">
                        ${data.dex.map(dex => `<span class="uk-label uk-label-success uk-margin-small-right">${dex}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Show raw JSON for other properties
        const otherData = { ...data };
        delete otherData.cex;
        delete otherData.dex;

        if (Object.keys(otherData).length > 0) {
            html += `
                <div class="uk-margin-small">
                    <strong>Data Lainnya:</strong>
                    <pre class="uk-margin-small-top uk-padding-small uk-background-muted" style="font-size:11px; max-height:200px; overflow:auto;">${JSON.stringify(otherData, null, 2)}</pre>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * Render all tables as accordion cards
     */
    function renderDatabaseView() {
        const $container = $('#database-viewer-container');
        if (!$container.length) return;

        const tables = Object.values(filteredData);

        if (tables.length === 0) {
            $container.html(`
                <div class="uk-alert uk-alert-warning">
                    <p>Tidak ada data yang ditemukan${searchQuery ? ` untuk pencarian: "${searchQuery}"` : ''}.</p>
                </div>
            `);
            return;
        }

        // Group tables by type
        const grouped = {
            settings: [],
            koin: [],
            snapshot: [],
            filter: []
        };

        tables.forEach(table => {
            grouped[table.type].push(table);
        });

        let html = '';

        // Render Settings
        if (grouped.settings.length > 0) {
            html += renderTableGroup('Pengaturan Scanner', grouped.settings);
        }

        // Render Koin Tables
        if (grouped.koin.length > 0) {
            html += renderTableGroup('Data Koin per Chain', grouped.koin);
        }

        // Render Snapshot Tables
        if (grouped.snapshot.length > 0) {
            html += renderTableGroup('Snapshot Data', grouped.snapshot);
        }

        // Render Filter Tables
        if (grouped.filter.length > 0) {
            html += renderTableGroup('Filter per Chain', grouped.filter);
        }

        $container.html(html);

        // Bind accordion events
        bindAccordionEvents();
    }

    /**
     * Render table group
     */
    function renderTableGroup(groupTitle, tables) {
        let html = `
            <div class="uk-margin-medium">
                <h4 class="uk-heading-line uk-text-bold">
                    <span>${groupTitle} (${tables.length})</span>
                </h4>
        `;

        tables.forEach(table => {
            const isExpanded = expandedTables.has(table.name);
            const contentDisplay = isExpanded ? 'block' : 'none';
            const iconName = isExpanded ? 'chevron-down' : 'chevron-right';
            const chainColor = getChainColor(table.chain);
            const displayName = String(table.displayName || table.name);
            const isMultichainHighlight = table.chain === 'multichain' && (table.type === 'koin' || table.type === 'filter');
            const titleClassAttr = isMultichainHighlight ? ' class="multichain-highlight"' : '';

            html += `
                <div class="db-table-card uk-card uk-card-default uk-margin-small ${isExpanded ? 'expanded' : ''}" data-table="${table.name}" style="--card-accent-color: ${chainColor};">
                    <div class="db-table-header" data-table="${table.name}">
                        <div class="db-table-title">
                            <span uk-icon="icon: ${iconName}; ratio: 0.8" class="accordion-icon"></span>
                            <strong${titleClassAttr}>${displayName}</strong>
                            <span class="uk-badge uk-margin-small-left">${table.count}</span>
                        </div>
                        <div class="db-table-actions">
                            ${(table.type === 'koin' || table.type === 'snapshot' || table.type === 'settings') ? `
                            <div class="uk-inline">
                                <span class="uk-form-icon uk-form-icon-flip" uk-icon="icon: search; ratio: 0.7"></span>
                                <input class="uk-input uk-form-small db-table-search" type="text" placeholder="Cari di tabel ini...">
                            </div>
                            ` : ''}
                            <button class="uk-button uk-button-small uk-button-default export-table-btn" data-table="${table.name}" title="Export to JSON">
                                <span uk-icon="icon: download; ratio: 0.7"></span>
                                Export
                            </button>
                            <button class="uk-button uk-button-small uk-button-danger delete-table-btn" data-table="${table.name}" title="Hapus Tabel">
                                <span uk-icon="icon: trash; ratio: 0.7"></span>
                                Hapus
                            </button>
                        </div>
                    </div>
                    <div class="db-table-content" style="display: ${contentDisplay}">
                        ${renderTableSummary(table)}
                        <div class="uk-margin-small-top">
                            ${renderTableData(table)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Bind accordion click events
     */
     function bindAccordionEvents() {
        $('.db-table-header').off('click').on('click', function(e) {
            // Jangan toggle jika klik di button export
            if ($(e.target).closest('.export-table-btn').length > 0) {
                return;
            }

            const tableName = $(this).data('table');
            const $card = $(`.db-table-card[data-table="${tableName}"]`);
            const $content = $card.find('.db-table-content');
            const $icon = $card.find('.accordion-icon');

            if (expandedTables.has(tableName)) {
                // Collapse
                expandedTables.delete(tableName);
                $content.slideUp(300);
                $card.removeClass('expanded');
                $icon.attr('uk-icon', 'icon: chevron-right; ratio: 0.8');
            } else {
                // Expand
                expandedTables.add(tableName);
                $content.slideDown(300);
                $card.addClass('expanded');
                $icon.attr('uk-icon', 'icon: chevron-down; ratio: 0.8');
            }
        });

        // Per-table search
        $('.db-table-search').off('input').on('input', function(e) {
            e.stopPropagation();
            const query = $(this).val().toLowerCase();
            const $table = $(this).closest('.db-table-card').find('.db-data-table');
            const $rows = $table.find('tbody tr');

            $rows.each(function() {
                const rowText = $(this).text().toLowerCase();
                $(this).toggle(rowText.includes(query));
            });
        });

        // Per-table sorting
        $('.db-data-table thead th').off('click').on('click', function(e) {
            e.stopPropagation();
            const $th = $(this);
            const $table = $th.closest('table');
            const colIndex = $th.index();
            const currentSort = $th.attr('data-sort-dir') || 'none';
            let nextSort = 'asc';

            if (currentSort === 'asc') {
                nextSort = 'desc';
            }

            // Reset other columns
            $table.find('thead th').removeAttr('data-sort-dir').find('.sort-indicator').html('');

            // Set new sort state
            $th.attr('data-sort-dir', nextSort);
            $th.find('.sort-indicator').html(nextSort === 'asc' ? ' ▲' : ' ▼');

            const $tbody = $table.find('tbody');
            const rows = $tbody.find('tr').get();

            rows.sort((a, b) => {
                const valA = $(a).children('td').eq(colIndex).text().trim();
                const valB = $(b).children('td').eq(colIndex).text().trim();

                const numA = parseFloat(valA);
                const numB = parseFloat(valB);

                const compare = (isNaN(numA) || isNaN(numB)) ? valA.localeCompare(valB) : numA - numB;

                return nextSort === 'asc' ? compare : -compare;
            });

            $.each(rows, function(index, row) {
                $tbody.append(row);
            });
        });

        // Bind export buttons
        $('.export-table-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const tableName = $(this).data('table');
            exportTableToJSON(tableName);
        });

        // Bind delete buttons
        $('.delete-table-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const tableName = $(this).data('table');
            deleteTable(tableName);
        });
    }
    /**
     * Export table data to JSON file
     */
    function exportTableToJSON(tableName) {
        const table = allTablesData[tableName];
        if (!table) {
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Tabel tidak ditemukan');
            }
            return;
        }

        try {
            const dataStr = JSON.stringify(table.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${tableName}_${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof toast !== 'undefined' && toast.success) {
                toast.success(`Export ${table.displayName} berhasil`);
            }
        } catch(err) {
            console.error('[Database Viewer] Export error:', err);
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Gagal export data');
            }
        }
    }

    /**
     * Delete table data from IndexedDB
     */
    async function deleteTable(tableName) {
        const table = allTablesData[tableName];
        if (!table) {
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Tabel tidak ditemukan');
            }
            return;
        }

        if (!confirm(`Anda yakin ingin menghapus tabel "${table.displayName}"? Tindakan ini tidak dapat dibatalkan.`)) {
            return;
        }

        try {
            if (table.type === 'snapshot') {
                if (typeof window.snapshotDbGet === 'function' && typeof window.snapshotDbSet === 'function') {
                    const map = await window.snapshotDbGet('SNAPSHOT_DATA_KOIN') || {};
                    const keyLower = String(table.chain || '').toLowerCase();
                    if (Object.prototype.hasOwnProperty.call(map, keyLower)) {
                        try { delete map[keyLower]; } catch(_) {}
                        const ok = await window.snapshotDbSet('SNAPSHOT_DATA_KOIN', map);
                        if (!ok) throw new Error('Gagal menyimpan snapshot');
                    }
                } else {
                    const db = await openDatabase();
                    const tx = db.transaction([DB_CONFIG.snapshotStore], 'readwrite');
                    tx.objectStore(DB_CONFIG.snapshotStore).delete('SNAPSHOT_DATA_KOIN');
                }
            } else {
                if (typeof window.removeFromLocalStorage === 'function') {
                    window.removeFromLocalStorage(table.name);
                } else {
                    const db = await openDatabase();
                    const tx = db.transaction([DB_CONFIG.store], 'readwrite');
                    tx.objectStore(DB_CONFIG.store).delete(table.name);
                }
            }

            if (typeof toast !== 'undefined' && toast.success) {
                toast.success(`Tabel "${table.displayName}" berhasil dihapus`);
            }
            // Log deletion to history (success)
            try {
                if (typeof window.addHistoryEntry === 'function') {
                    await window.addHistoryEntry(
                        `DELETE TABLE ${table.displayName}`,
                        'success',
                        {
                            name: table.name,
                            type: table.type,
                            chain: table.chain || 'n/a',
                            store: (table.type === 'snapshot') ? DB_CONFIG.snapshotStore : DB_CONFIG.store
                        },
                        { includeChain: false }
                    );
                }
            } catch(_) {}
            await refresh();

        } catch(err) {
            console.error('[Database Viewer] Error saat menghapus tabel:', err);
            // Log deletion error to history
            try {
                if (typeof window.addHistoryEntry === 'function') {
                    await window.addHistoryEntry(
                        `DELETE TABLE ${table.displayName || tableName}`,
                        'error',
                        {
                            name: tableName,
                            type: (table && table.type) || 'unknown',
                            chain: (table && table.chain) || 'n/a',
                            error: String((err && err.message) ? err.message : err)
                        },
                        { includeChain: false }
                    );
                }
            } catch(_) {}
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Gagal menghapus data');
            }
        }
    }

    /**
     * Show database viewer section
     */
    async function show() {
        // Use the centralized section manager
        showMainSection('#database-viewer-section');

        // Show loading overlay
        if (window.AppOverlay) {
            window.AppOverlay.show({
                id: 'db-viewer-loading',
                title: 'Memuat Database...',
                message: 'Mengambil data dari IndexedDB'
            });
        }

        try {
            // Load data
            await loadAllTableData();

            // Render view
            renderDatabaseView();

            // Update stats
            updateGlobalStats();

        } catch(err) {
            console.error('[Database Viewer] Error showing viewer:', err);
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Gagal memuat database: ' + err.message);
            }
        } finally {
            // Hide loading overlay
            if (window.AppOverlay) {
                window.AppOverlay.hide('db-viewer-loading');
            }
        }
    }

    /**
     * Hide database viewer section
     */
    function hide() {
        // Show the main scanner view
        showMainSection('scanner');
    }

    /**
     * Update global statistics
     */
    function updateGlobalStats() {
        const totalTables = Object.keys(allTablesData).length;
        const totalRecords = Object.values(allTablesData).reduce((sum, table) => sum + table.count, 0);

        $('#db-total-tables').text(totalTables);
        $('#db-total-records').text(totalRecords);
    }

    /**
     * Handle search input
     */
    function handleSearch(query) {
        applySearch(query);
        renderDatabaseView();
        updateGlobalStats();
    }

    /**
     * Refresh database view
     */
    async function refresh() {
        if (window.AppOverlay) {
            window.AppOverlay.show({
                id: 'db-viewer-refresh',
                title: 'Refresh Database...',
                message: 'Memuat ulang data'
            });
        }

        try {
            await loadAllTableData();
            applySearch(searchQuery);
            renderDatabaseView();
            updateGlobalStats();

            if (typeof toast !== 'undefined' && toast.success) {
                toast.success('Database berhasil di-refresh');
            }
        } catch(err) {
            console.error('[Database Viewer] Refresh error:', err);
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Gagal refresh database');
            }
        } finally {
            if (window.AppOverlay) {
                window.AppOverlay.hide('db-viewer-refresh');
            }
        }
    }

    /**
     * Initialize module
     */
    function init() {
        // Bind search input
        $('#db-search-input').off('input').on('input', function() {
            const query = $(this).val();
            handleSearch(query);
        });

        // Bind refresh button
        $('#db-refresh-btn').off('click').on('click', refresh);

        // Bind close button
        $('#db-close-btn').off('click').on('click', hide);

        console.log('[Database Viewer] Module initialized');
    }

    // Register to App namespace
    if (typeof App.register === 'function') {
        App.register('DatabaseViewer', {
            show,
            hide,
            refresh,
            init
        });
    } else {
        App.DatabaseViewer = { show, hide, refresh, init };
    }

    // Auto-init on DOM ready
    $(document).ready(function() {
        init();
    });

})(typeof window !== 'undefined' ? window : this);

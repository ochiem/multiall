// =================================================================================
// WALLET EXCHANGER UI MODULE
// =================================================================================
/**
 * Module untuk mengelola UI Update Wallet Exchanger
 * - Render CEX cards dengan tabel koin
 * - Handle pemilihan CEX
 * - Integrate dengan fetchWalletStatus dari services/cex.js
 */
(function initWalletExchangerUI(global) {
    const root = global || (typeof window !== 'undefined' ? window : {});
    const App = root.App || (root.App = {});

    // State management
    let activeChain = null;
    let selectedCexList = [];

    const chainSynonymResolver = (() => {
        const map = new Map();
        const source = (root && root.CHAIN_SYNONYMS) ? root.CHAIN_SYNONYMS : {};
        Object.keys(source).forEach(key => {
            const canonical = String(key).toLowerCase();
            map.set(canonical, canonical);
            const list = Array.isArray(source[key]) ? source[key] : [];
            list.forEach(name => {
                const norm = String(name).toLowerCase();
                if (!map.has(norm)) {
                    map.set(norm, canonical);
                }
            });
        });
        return {
            canonical(raw) {
                if (raw === undefined || raw === null) return null;
                const norm = String(raw).toLowerCase().trim();
                if (!norm) return null;
                return map.get(norm) || norm;
            }
        };
    })();

    function getCanonicalChainKey(rawChain) {
        return chainSynonymResolver.canonical(rawChain);
    }

    function filterTokensForWallet(tokens, mode) {
        if (!Array.isArray(tokens) || tokens.length === 0) return [];

        // ✅ BARU: Hanya filter by chain (tidak filter CEX/PAIR/DEX)
        // Update Wallet Exchanger tidak lagi bergantung pada filter scanner

        if (mode.type === 'single' && mode.chain) {
            const chainKey = getCanonicalChainKey(mode.chain) || String(mode.chain).toLowerCase();

            // Filter by chain only
            return tokens.filter(t => {
                const tokenChain = getCanonicalChainKey(t.chain) || String(t.chain || '').toLowerCase();
                return tokenChain === chainKey;
            });
        }

        // Multichain mode: return all tokens
        return tokens;
    }

    /**
     * Load coins data from storage (localStorage or IndexedDB) and apply active filters.
     */
    function loadCoinsFromStorage(options = {}) {
        const applyFilter = options.applyFilter !== undefined ? !!options.applyFilter : true;
        const modeOverride = options.mode || null;
        try {
            const mode = modeOverride || ((typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' });
            let tokens = [];

            // Gunakan getActiveTokens() untuk konsistensi dengan sistem storage
            if (typeof getActiveTokens === 'function') {
                tokens = getActiveTokens([]);
                const storageKey = (typeof getActiveTokenKey === 'function') ? getActiveTokenKey() : 'TOKEN_MULTICHAIN';
                // console.log(`[Wallet Exchanger] Loaded ${tokens.length} coins from ${storageKey}`);
            } else if (mode.type === 'single' && mode.chain) {
                const chainKey = getCanonicalChainKey(mode.chain) || mode.chain;
                tokens = (typeof getTokensChain === 'function') ? getTokensChain(chainKey) : [];
                // console.log(`[Wallet Exchanger] Loaded ${tokens.length} coins for chain ${chainKey}`);
            } else {
                tokens = (typeof getFromLocalStorage === 'function') ? getFromLocalStorage('TOKEN_MULTICHAIN', []) : [];
                // console.log(`[Wallet Exchanger] Loaded ${tokens.length} coins (multichain mode)`);
            }

            if (!applyFilter) {
                return Array.isArray(tokens) ? tokens : [];
            }

            const filteredTokens = filterTokensForWallet(tokens, mode);
            // console.log(`[Wallet Exchanger] Tokens after filter: ${filteredTokens.length}`);

            if (filteredTokens.length > 0) {
                const sampleCoin = filteredTokens[0];
                // console.log('[Wallet Exchanger] Sample filtered coin:', {
                    // symbol: sampleCoin.symbol_in,
                    // chain: sampleCoin.chain,
                    // hasCexData: !!sampleCoin.dataCexs,
                    // cexCount: sampleCoin.dataCexs ? Object.keys(sampleCoin.dataCexs).length : 0
                // });
            }

            return filteredTokens;
        } catch(err) {
            // console.error('[Wallet Exchanger] Error loading coins from storage:', err);
            return [];
        }
    }

    function normalizeFlag(value) {
        if (value === undefined || value === null || value === '-') return undefined;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        const normalized = String(value).toLowerCase();
        if (['true', 'yes', 'on', 'open', 'enabled', 'enable', '1'].includes(normalized)) return true;
        if (['false', 'no', 'off', 'close', 'closed', 'disabled', 'disable', '0'].includes(normalized)) return false;
        return undefined;
    }

    function normalizeFee(value) {
        if (value === undefined || value === null || value === '-') return undefined;
        const num = Number(value);
        return Number.isFinite(num) ? num : undefined;
    }

    function normalizeChainKey(rawChain, mode) {
        const canonical = getCanonicalChainKey(rawChain);
        if (canonical) return canonical;
        if (mode?.type === 'single' && mode.chain) {
            const fallback = getCanonicalChainKey(mode.chain);
            if (fallback) return fallback;
            return String(mode.chain).toLowerCase();
        }
        const chain = rawChain ? String(rawChain).toLowerCase().trim() : '';
        return chain || 'unknown';
    }

    /**
     * Get chain config from CONFIG_CHAINS with fallback lookup
     * Handles multiple possible chain key formats (ethereum vs erc, bsc vs bep20, etc.)
     */
    function getChainConfig(rawChainKey, CONFIG_CHAINS) {
        if (!rawChainKey) return {};

        // Try exact match first
        const exactMatch = CONFIG_CHAINS[rawChainKey];
        if (exactMatch) return exactMatch;

        // Try canonical match
        const canonical = getCanonicalChainKey(rawChainKey);
        if (canonical && CONFIG_CHAINS[canonical]) return CONFIG_CHAINS[canonical];

        // Try common synonyms manually as fallback
        const chainLower = String(rawChainKey).toLowerCase();
        const synonymMap = {
            'erc': 'ethereum',
            'erc20': 'ethereum',
            'eth': 'ethereum',
            'bep20': 'bsc',
            'bep-20': 'bsc',
            'bnb': 'bsc',
            'matic': 'polygon',
            'pol': 'polygon',
            'arb': 'arbitrum'
        };

        const mappedKey = synonymMap[chainLower];
        if (mappedKey && CONFIG_CHAINS[mappedKey]) {
            return CONFIG_CHAINS[mappedKey];
        }

        return {};
    }

    function cloneDataCexs(dataCexs) {
        if (!dataCexs || typeof dataCexs !== 'object') return {};
        return Object.keys(dataCexs).reduce((acc, key) => {
            acc[key] = Object.assign({}, dataCexs[key]);
            return acc;
        }, {});
    }

    function buildCoinIndex(coins) {
        const index = new Map();
        const pushIndex = (key, ref) => {
            if (!index.has(key)) index.set(key, []);
            index.get(key).push(ref);
        };

        coins.forEach((coin, idx) => {
            const chainKey = getCanonicalChainKey(coin.chain) || String(coin.chain || '').toLowerCase();
            if (!chainKey) return;
            const tokenSymbol = String(coin.symbol_in || coin.tokenName || '').toUpperCase();
            if (tokenSymbol) {
                pushIndex(`${chainKey}:${tokenSymbol}`, { idx, role: 'token' });
            }
            const pairSymbol = String(coin.symbol_out || '').toUpperCase();
            if (pairSymbol) {
                pushIndex(`${chainKey}:${pairSymbol}`, { idx, role: 'pair' });
            }
        });

        return index;
    }

    function ensureCexEntry(coin, cexName) {
        coin.dataCexs = coin.dataCexs || {};
        const key = String(cexName || '').toUpperCase();
        if (!coin.dataCexs[key]) {
            coin.dataCexs[key] = {};
        }
        return coin.dataCexs[key];
    }

    function mergeWalletData(existingCoins, walletDataByCex, mode) {
        const merged = existingCoins.map(coin => {
            const clone = Object.assign({}, coin);
            if (coin.dataCexs) {
                clone.dataCexs = cloneDataCexs(coin.dataCexs);
                const selectedSet = new Set((coin.selectedCexs || []).map(cx => String(cx || '').toUpperCase()));
                if (selectedSet.size > 0) {
                    Object.keys(clone.dataCexs).forEach(key => {
                        if (!selectedSet.has(String(key || '').toUpperCase())) {
                            delete clone.dataCexs[key];
                        }
                    });
                }
            }
            return clone;
        });

        const coinIndex = buildCoinIndex(merged);
        const allowedCexByCoin = merged.map(coin => {
            const allowed = new Set();
            (coin.selectedCexs || []).forEach(cx => allowed.add(String(cx || '').toUpperCase()));
            if (allowed.size === 0 && coin.dataCexs && typeof coin.dataCexs === 'object') {
                Object.keys(coin.dataCexs).forEach(cx => allowed.add(String(cx || '').toUpperCase()));
            }
            return allowed;
        });

        Object.keys(walletDataByCex || {}).forEach(cexName => {
            const cexUpper = String(cexName || '').toUpperCase();
            const walletItems = walletDataByCex[cexName] || walletDataByCex[cexUpper] || [];
            if (!Array.isArray(walletItems) || walletItems.length === 0) return;

            const normalizedEntries = new Map();
            walletItems.forEach(item => {
                const symbol = String(item.tokenName || '').toUpperCase();
                if (!symbol) return;
                const chainKey = normalizeChainKey(item.chain, mode);
                const indexKey = `${chainKey}:${symbol}`;
                normalizedEntries.set(indexKey, Object.assign({}, item, { _chainKey: chainKey, _symbol: symbol }));
            });

            normalizedEntries.forEach(entry => {
                const refs = coinIndex.get(`${entry._chainKey}:${entry._symbol}`);
                if (!refs || refs.length === 0) {
                    return;
                }

                refs.forEach(({ idx, role }) => {
                    if (!allowedCexByCoin[idx].has(cexUpper)) {
                        return;
                    }

                    const coin = merged[idx];
                    const target = ensureCexEntry(coin, cexUpper);

                    if (role === 'token') {
                        const depositToken = normalizeFlag(entry.depositEnable);
                        if (depositToken !== undefined) target.depositToken = depositToken;

                        const withdrawToken = normalizeFlag(entry.withdrawEnable);
                        if (withdrawToken !== undefined) target.withdrawToken = withdrawToken;

                        const feeToken = normalizeFee(entry.feeWDs);
                        if (feeToken !== undefined) target.feeWDToken = feeToken;

                        if (entry.tradingActive !== undefined) {
                            target.tradingActive = entry.tradingActive !== false;
                        }

                        if (entry.contractAddress && entry.contractAddress !== '-') {
                            coin.sc_in = entry.contractAddress;
                        }

                        if (entry.decimals !== undefined && entry.decimals !== '-' && entry.decimals !== null) {
                            coin.des_in = entry.decimals;
                            coin.decimals = entry.decimals;
                        }
                    } else if (role === 'pair') {
                        const depositPair = normalizeFlag(entry.depositEnable);
                        if (depositPair !== undefined) target.depositPair = depositPair;

                        const withdrawPair = normalizeFlag(entry.withdrawEnable);
                        if (withdrawPair !== undefined) target.withdrawPair = withdrawPair;

                        const feePair = normalizeFee(entry.feeWDs);
                        if (feePair !== undefined) target.feeWDPair = feePair;
                    }
                });
            });
        });

        return merged;
    }

    /**
     * Save coins data to storage
     */
    function saveCoinsToStorage(coins) {
        try {
            // Gunakan saveActiveTokens() untuk konsistensi dengan sistem storage
            if (typeof saveActiveTokens === 'function') {
                saveActiveTokens(coins);
                const storageKey = (typeof getActiveTokenKey === 'function') ? getActiveTokenKey() : 'TOKEN_MULTICHAIN';
                // console.log(`[Wallet Exchanger] Saved ${coins.length} coins to ${storageKey}`);
            } else {
                const mode = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };

                if (mode.type === 'single' && mode.chain) {
                    // Single chain mode - save to specific chain storage
                    const chainKey = getCanonicalChainKey(mode.chain) || String(mode.chain).toLowerCase();
                    const storageKey = `TOKEN_${String(chainKey).toUpperCase()}`;
                    if (typeof saveToLocalStorage === 'function') {
                        saveToLocalStorage(storageKey, coins);
                    }
                } else {
                    // Multichain mode
                    if (typeof saveToLocalStorage === 'function') {
                        saveToLocalStorage('TOKEN_MULTICHAIN', coins);
                    }
                }

                // console.log(`[Wallet Exchanger] Saved ${coins.length} coins to storage`);
            }
        } catch(err) {
            // console.error('[Wallet Exchanger] Error saving coins to storage:', err);
        }
    }

    /**
     * Show update result notification
     */
    function showUpdateResult(success, failedCexes) {
        const $result = $('#wallet-update-result');
        const $resultText = $result.find('p');

        if (success && (!failedCexes || failedCexes.length === 0)) {
            $result.removeClass('uk-alert-warning uk-alert-danger').addClass('uk-alert-success');
            $resultText.html('<strong>✅ Update Berhasil!</strong> Semua exchanger berhasil diperbarui. Data terbaru ditampilkan di bawah.');
        } else if (failedCexes && failedCexes.length > 0) {
            $result.removeClass('uk-alert-success uk-alert-danger').addClass('uk-alert-warning');
            const failedList = failedCexes.join(', ');
            $resultText.html(`<strong>⚠️ Update Sebagian Berhasil</strong><br>Exchanger yang gagal: ${failedList}`);
        } else {
            $result.removeClass('uk-alert-success uk-alert-warning').addClass('uk-alert-danger');
            $resultText.html('<strong>❌ Update Gagal</strong> Tidak ada exchanger yang berhasil diperbarui.');
        }

        $result.fadeIn(300);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            $result.fadeOut(300);
        }, 10000);
    }

    /**
     * Render CEX cards grid - ambil semua CEX dari CONFIG_CEX (tidak dari filter)
     * User pilih CEX mana yang ingin di-update via checkbox
     */
    function renderCexCards() {
        const $grid = $('#wallet-cex-grid');
        if (!$grid.length) return;

        $grid.empty();

        // Get active mode and chain
        const mode = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
        const CONFIG_CEX = root.CONFIG_CEX || {};
        const CONFIG_CHAINS = root.CONFIG_CHAINS || {};

        // ✅ BARU: Ambil SEMUA CEX dari CONFIG_CEX (sumber yang sama dengan filter)
        // Tidak lagi tergantung pada filter aktif
        let availableCexes = Object.keys(CONFIG_CEX)
            .map(x => String(x).toUpperCase())
            .filter(cx => !!CONFIG_CEX[cx])
            .sort(); // Sort alphabetically untuk konsistensi

        // Determine active chain
        if (mode.type === 'single') {
            const canonicalChain = getCanonicalChainKey(mode.chain) || String(mode.chain || '').toLowerCase();
            activeChain = canonicalChain || mode.chain;
        } else {
            activeChain = 'MULTICHAIN';
        }

        // Update chain label
        try {
            const canonicalActive = getCanonicalChainKey(activeChain) || String(activeChain || '').toLowerCase();
            const chainName = (activeChain === 'MULTICHAIN') ? 'MULTICHAIN' :
                              (CONFIG_CHAINS?.[canonicalActive]?.Nama_Chain || activeChain);
            $('#wallet-chain-label').text(String(chainName).toUpperCase());
        } catch(_) {}

        // ✅ BARU: Load coins dengan filter by chain only (tidak filter CEX/PAIR/DEX)
        const allCoinsData = loadCoinsFromStorage({ applyFilter: false });

        // Filter by chain only untuk single mode
        const chainFilteredCoins = (mode.type === 'single')
            ? allCoinsData.filter(coin => {
                const coinChain = getCanonicalChainKey(coin.chain) || String(coin.chain || '').toLowerCase();
                const targetChain = getCanonicalChainKey(activeChain) || String(activeChain || '').toLowerCase();
                return coinChain === targetChain;
              })
            : allCoinsData;

        // ✅ Filter CEX: hanya tampilkan yang punya koin (sama seperti filter scanner)
        // Hitung jumlah koin per CEX untuk menentukan mana yang ditampilkan
        const cexCoinCount = {};
        chainFilteredCoins.forEach(coin => {
            if (coin.dataCexs && typeof coin.dataCexs === 'object') {
                Object.keys(coin.dataCexs).forEach(cexName => {
                    const upper = String(cexName).toUpperCase();
                    cexCoinCount[upper] = (cexCoinCount[upper] || 0) + 1;
                });
            }
        });

        // Filter availableCexes: hanya yang punya koin
        availableCexes = availableCexes.filter(cexName => {
            const count = cexCoinCount[cexName] || 0;
            return count > 0; // Sama seperti filter scanner: if (cnt===0) return;
        });

        // console.log(`[Update Wallet] CEX dengan koin:`, Object.keys(cexCoinCount).filter(cx => cexCoinCount[cx] > 0));

        // Jika tidak ada CEX yang punya koin
        if (!availableCexes.length) {
            $grid.html(`
                <div class="uk-width-1-1">
                    <div class="uk-alert uk-alert-warning">
                        <p><strong>Belum ada koin untuk chain ${String(activeChain).toUpperCase()}</strong></p>
                        <p class="uk-text-small uk-margin-remove">Silakan tambah koin terlebih dahulu di menu <strong>MANAJEMEN KOIN</strong>, kemudian buka Update Wallet Exchanger untuk fetch status deposit/withdraw.</p>
                    </div>
                </div>
            `);
            return;
        }

        // Render each CEX card dari availableCexes (yang punya koin)
        availableCexes.forEach(cexName => {
            const cexConfig = CONFIG_CEX[cexName] || {};
            const cexColor = cexConfig.WARNA || '#333';

            // ✅ Filter coins untuk CEX ini dari chainFilteredCoins (sudah difilter by chain)
            const cexCoins = chainFilteredCoins.filter(coin => {
                // Check if coin has data for this CEX
                if (!coin.dataCexs || !coin.dataCexs[cexName]) return false;

                // FILTER: Hanya tampilkan yang bermasalah (WD atau Depo CLOSED untuk TOKEN atau PAIR)
                const dataCex = coin.dataCexs[cexName];

                // Check TOKEN status
                const wdTokenClosed = dataCex.withdrawToken === false;
                const dpTokenClosed = dataCex.depositToken === false;

                // Check PAIR status
                const wdPairClosed = dataCex.withdrawPair === false;
                const dpPairClosed = dataCex.depositPair === false;

                // Tampilkan jika ada yang bermasalah (TOKEN atau PAIR)
                return wdTokenClosed || dpTokenClosed || wdPairClosed || dpPairClosed;
            });

            // Jumlah koin bermasalah dan total koin
            const problemCount = cexCoins.length;
            const totalCount = cexCoinCount[cexName] || 0;

            // Console log dengan breakdown per chain untuk mode multi
            if (mode.type === 'multi') {
                // Breakdown per chain
                const chainBreakdown = {};
                cexCoins.forEach(coin => {
                    const chainKey = getCanonicalChainKey(coin.chain) || String(coin.chain || '').toLowerCase();
                    chainBreakdown[chainKey] = (chainBreakdown[chainKey] || 0) + 1;
                });

                const breakdown = Object.entries(chainBreakdown)
                    .map(([chain, count]) => `${chain.toUpperCase()}:${count}`)
                    .join(', ');

                // console.log(`[${cexName}] Koin bermasalah (multichain): ${problemCount} dari ${totalCount} | Breakdown: ${breakdown}`);
            } else {
                // console.log(`[${cexName}] Koin bermasalah di chain ${activeChain}: ${problemCount} dari total ${totalCount}`);
            }

            const isSelected = selectedCexList.includes(cexName);

            // Badge status untuk setiap CEX (sama seperti filter scanner)
            let statusBadge = '';
            if (problemCount > 0) {
                // Ada koin bermasalah
                statusBadge = `<span class="uk-badge" style="background-color: #dc3545; color: white;">${problemCount} bermasalah dari ${totalCount}</span>`;
            } else if (totalCount > 0) {
                // Ada koin tapi tidak bermasalah
                statusBadge = `<span class="uk-badge" style="background-color: #28a745; color: white;">${totalCount} koin OK</span>`;
            } else {
                // Tidak seharusnya terjadi karena sudah difilter di atas
                statusBadge = `<span class="uk-badge" style="background-color: #6c757d; color: white;">Belum ada data</span>`;
            }

            const cardHtml = `
                <div class="wallet-cex-grid-item uk-width-1-1 uk-width-1-2@m">
                    <div class="wallet-cex-card ${isSelected ? 'selected' : ''}" data-cex="${cexName}">
                        <div class="wallet-cex-header" data-cex="${cexName}">
                            <div class="wallet-cex-name" style="color: ${cexColor}">
                                <input type="checkbox" class="wallet-cex-checkbox" data-cex="${cexName}" ${isSelected ? 'checked' : ''}>
                                ${cexName}
                            </div>
                            ${statusBadge}
                        </div>
                        <div class="wallet-cex-table-wrapper">
                            ${problemCount > 0
                                ? renderCexTable(cexName, cexCoins, mode)
                                : '<div class="uk-text-center uk-padding-small uk-text-muted"><p class="uk-margin-remove">Tidak ada koin bermasalah</p><p class="uk-text-small uk-margin-remove">Centang untuk update data terbaru</p></div>'}
                        </div>
                    </div>
                </div>
            `;

            $grid.append(cardHtml);
        });

        // Bind events untuk checkbox
        bindCexCardEvents();
        updateCekButton();

        try {
            const uiKit = (root && root.UIkit) ? root.UIkit : (typeof window !== 'undefined' ? window.UIkit : null);
            if (uiKit && typeof uiKit.update === 'function') {
                uiKit.update($grid[0]);
            }
        } catch(_) {}
    }

    /**
     * Render tabel koin untuk CEX dengan breakdown per-chain untuk mode multi
     * Data koin akan di-fetch dari CEX saat user mengklik UPDATE WALLET EXCHANGER
     */
    function renderCexTable(cexName, coins, mode) {
        if (!coins || coins.length === 0) {
            return `
                <div class="uk-text-center uk-padding-small uk-text-muted">
                    <p>Belum ada data wallet</p>
                    <p class="uk-text-small">Pilih CEX ini dan klik "UPDATE WALLET EXCHANGER" untuk fetch data</p>
                </div>
            `;
        }

        const CONFIG_CHAINS = root.CONFIG_CHAINS || {};
        const isMultiMode = mode && mode.type === 'multi';

        // Group coins by chain untuk mode multi
        let coinsByChain = {};
        if (isMultiMode) {
            coins.forEach(coin => {
                const chainKey = getCanonicalChainKey(coin.chain) || String(coin.chain || '').toLowerCase();
                if (!coinsByChain[chainKey]) {
                    coinsByChain[chainKey] = [];
                }
                coinsByChain[chainKey].push(coin);
            });
        } else {
            // Single mode: tidak perlu grouping
            const chainKey = getCanonicalChainKey(coins[0]?.chain) || 'unknown';
            // console.log(`[Wallet Table SINGLE MODE] Original chain: ${coins[0]?.chain} | Canonical chainKey: ${chainKey}`);
            coinsByChain[chainKey] = coins;
        }

        // Sort chains alphabetically
        const sortedChains = Object.keys(coinsByChain).sort();

        let tableHtml = '';

        // Render tabel per chain
        sortedChains.forEach((chainKey, chainIdx) => {
            const chainCoins = coinsByChain[chainKey];
            const chainConfig = getChainConfig(chainKey, CONFIG_CHAINS);
            const chainName = (chainConfig.Nama_Chain || chainKey).toUpperCase();
            const chainColor = chainConfig.WARNA || '#333';
            const headerStyle = `background: ${chainColor}; color: white;`;
            const headerWidthStyle = width => `style="width:${width}; ${headerStyle}"`;
            const headerPlainStyle = `style="${headerStyle}"`;

            // Debug logging
            // console.log(`[Wallet Table] Chain: ${chainKey} | Config found: ${!!chainConfig.Nama_Chain} | Color: ${chainColor}`);
            if (!chainConfig.Nama_Chain) {
                // console.warn(`[Wallet Table] No config found for chainKey: ${chainKey}. Available keys:`, Object.keys(CONFIG_CHAINS));
            }

            // Header chain untuk mode multi
            if (isMultiMode) {
                tableHtml += `
                    <div class="wallet-chain-header" style="background: ${chainColor}; color: white; padding: 4px 8px; font-weight: bold; font-size: 12px; margin-top: ${chainIdx > 0 ? '8px' : '0'};">
                        ${chainName} (${chainCoins.length} koin bermasalah)
                    </div>
                `;
            }

            tableHtml += `
                <table class="wallet-cex-table uk-table uk-table-divider uk-table-hover uk-table-small">
                    <thead style="background: ${chainColor}; color: white;">
                        <tr>
                            <th ${headerWidthStyle('30px')} rowspan="2">No</th>
                            <th ${headerWidthStyle('80px')} rowspan="2">Symbol</th>
                            <th ${headerWidthStyle('130px')} rowspan="2">SC</th>
                            <th ${headerWidthStyle('70px')} rowspan="2" class="uk-text-center">Decimals</th>
                            <th ${headerPlainStyle} colspan="2" class="uk-text-center">TOKEN Status</th>
                            <th ${headerPlainStyle} colspan="2" class="uk-text-center">PAIR Status</th>
                        </tr>
                        <tr>
                            <th ${headerWidthStyle('70px')} class="uk-text-center">WD</th>
                            <th ${headerWidthStyle('70px')} class="uk-text-center">Depo</th>
                            <th ${headerWidthStyle('70px')} class="uk-text-center">WD</th>
                            <th ${headerWidthStyle('70px')} class="uk-text-center">Depo</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            chainCoins.forEach((coin, idx) => {
            const dataCex = (coin.dataCexs || {})[cexName] || {};

            // Symbol dan SC data
            const tokenSymbol = (coin.symbol_in || coin.tokenName || '?').toUpperCase();
            const pairSymbol = (coin.symbol_out || 'USDT').toUpperCase();
            const tokenSc = coin.sc_in || coin.contractAddress || '-';

            // Decimals dari enrichment
            const decimals = coin.des_in || coin.decimals || '-';

            // ========== STATUS TOKEN (symbol_in) ==========
            const wdToken = dataCex.withdrawToken;
            const dpToken = dataCex.depositToken;

            let statusWdToken = '';
            if (wdToken === true) {
                statusWdToken = '<span class="wallet-status-badge wallet-status-on">OPEN</span>';
            } else if (wdToken === false) {
                statusWdToken = '<span class="wallet-status-badge wallet-status-off">CLOSED</span>';
            } else {
                statusWdToken = '<span class="wallet-status-badge wallet-status-loading">?</span>';
            }

            let statusDpToken = '';
            if (dpToken === true) {
                statusDpToken = '<span class="wallet-status-badge wallet-status-on">OPEN</span>';
            } else if (dpToken === false) {
                statusDpToken = '<span class="wallet-status-badge wallet-status-off">CLOSED</span>';
            } else {
                statusDpToken = '<span class="wallet-status-badge wallet-status-loading">?</span>';
            }

            // ========== STATUS PAIR (symbol_out) ==========
            const wdPair = dataCex.withdrawPair;
            const dpPair = dataCex.depositPair;

            let statusWdPair = '';
            if (wdPair === true) {
                statusWdPair = '<span class="wallet-status-badge wallet-status-on">OPEN</span>';
            } else if (wdPair === false) {
                statusWdPair = '<span class="wallet-status-badge wallet-status-off">CLOSED</span>';
            } else {
                statusWdPair = '<span class="wallet-status-badge wallet-status-loading">?</span>';
            }

            let statusDpPair = '';
            if (dpPair === true) {
                statusDpPair = '<span class="wallet-status-badge wallet-status-on">OPEN</span>';
            } else if (dpPair === false) {
                statusDpPair = '<span class="wallet-status-badge wallet-status-off">CLOSED</span>';
            } else {
                statusDpPair = '<span class="wallet-status-badge wallet-status-loading">?</span>';
            }

            // Shorten smart contract addresses
            const shortenSc = (sc) => {
                if (!sc || sc === '-' || sc.length < 12) return sc;
                return `${sc.substring(0, 6)}...${sc.substring(sc.length - 4)}`;
            };

            tableHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>
                        <span class="uk-text-bold uk-text-primary">${tokenSymbol}</span>
                        <span class="uk-text-meta uk-text-small"> / ${pairSymbol}</span>
                    </td>
                    <td class="uk-text-truncate" title="${tokenSc}" style="max-width: 130px;">
                        <code class="uk-text-small">${shortenSc(tokenSc)}</code>
                    </td>
                    <td class="uk-text-center">
                        <span class="uk-text-small">${decimals}</span>
                    </td>
                    <td class="uk-text-center">
                        ${statusWdToken}
                    </td>
                    <td class="uk-text-center">
                        ${statusDpToken}
                    </td>
                    <td class="uk-text-center">
                        ${statusWdPair}
                    </td>
                    <td class="uk-text-center">
                        ${statusDpPair}
                    </td>
                </tr>
            `;
            }); // End chainCoins.forEach

            tableHtml += `
                    </tbody>
                </table>
            `;
        }); // End sortedChains.forEach

        return tableHtml;
    }


    /**
     * Bind events untuk CEX cards checkbox
     */
    function bindCexCardEvents() {
        // Checkbox click
        $('.wallet-cex-checkbox').off('click').on('click', function(e) {
            e.stopPropagation();
            const cexName = $(this).data('cex');
            toggleCexSelection(cexName);
        });

        // Header click (toggle checkbox)
        $('.wallet-cex-header').off('click').on('click', function(e) {
            if ($(e.target).hasClass('wallet-cex-checkbox')) return;
            const cexName = $(this).data('cex');
            toggleCexSelection(cexName);
        });
    }

    /**
     * Toggle CEX selection
     */
    function toggleCexSelection(cexName) {
        const idx = selectedCexList.indexOf(cexName);

        if (idx >= 0) {
            // Remove from selection
            selectedCexList.splice(idx, 1);
            $(`.wallet-cex-card[data-cex="${cexName}"]`).removeClass('selected');
            $(`.wallet-cex-checkbox[data-cex="${cexName}"]`).prop('checked', false);
        } else {
            // Add to selection
            selectedCexList.push(cexName);
            $(`.wallet-cex-card[data-cex="${cexName}"]`).addClass('selected');
            $(`.wallet-cex-checkbox[data-cex="${cexName}"]`).prop('checked', true);
        }

        updateCekButton();
    }

    /**
     * Update button state berdasarkan selection
     */
    function updateCekButton() {
        const $btn = $('#btn-cek-wallet-exchanger');
        if (selectedCexList.length > 0) {
            $btn.prop('disabled', false).removeClass('uk-button-default').addClass('uk-button-primary');
        } else {
            $btn.prop('disabled', true).removeClass('uk-button-primary').addClass('uk-button-default');
        }
    }

    /**
     * Show progress overlay saat fetch CEX wallet (menggunakan AppOverlay)
     */
    function showFetchProgressOverlay(cexList) {
        // Create items array for progress tracking
        const items = cexList.map(cexName => ({
            name: cexName,
            status: 'waiting',
            text: 'Menunggu...'
        }));

        // Show overlay dengan AppOverlay
        const overlayId = AppOverlay.showItems({
            id: 'wallet-fetch-overlay',
            title: 'Memproses Wallet Exchanger...',
            message: 'Mohon tunggu, aplikasi sedang melakukan Memuat data wallet dari exchanger',
            items: items
        });

        return overlayId;
    }

    /**
     * Update progress untuk CEX tertentu (menggunakan AppOverlay)
     */
    function updateFetchProgress(cexName, status, message, tokenCount) {
        const text = tokenCount
            ? `${message || ''}`
            : (message || '');

        AppOverlay.updateItem('wallet-fetch-overlay', cexName, status, text);
    }

    /**
     * Hide progress overlay (menggunakan AppOverlay)
     */
    function hideFetchProgressOverlay() {
        setTimeout(() => {
            AppOverlay.hide('wallet-fetch-overlay');
        }, 1000);
    }

    /**
     * Handle CEK WALLET EXCHANGER button click
     * KONSEP: User pilih CEX dengan checkbox -> fetch wallet data -> update tabel
     */
    async function handleCekWallet() {
        // Validasi: harus ada CEX yang dipilih
        if (selectedCexList.length === 0) {
            try {
                if (typeof toast !== 'undefined' && toast.error) {
                    toast.error('Pilih minimal 1 CEX terlebih dahulu');
                }
            } catch(_) {}
            return;
        }

        if (!confirm(`Fetch data wallet dari ${selectedCexList.length} exchanger?\n\n${selectedCexList.join(', ')}\n\nProses ini akan memakan waktu beberapa saat.`)) {
            return;
        }

        // Get current app mode (single chain vs multichain)
        const mode = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };

        // Ensure scanner is stopped
        try {
            const st = (typeof getAppState === 'function') ? getAppState() : {};
            if (st && st.run === 'YES' && window.App?.Scanner?.stopScannerSoft) {
                window.App.Scanner.stopScannerSoft();
                await new Promise(r => setTimeout(r, 200));
            }
        } catch(_) {}

        // Show progress overlay (layar freeze)
        showFetchProgressOverlay(selectedCexList);

        // Storage untuk menyimpan hasil fetch per CEX
        const cexWalletData = {};
        const failedCexes = [];

        // Fetch wallet data dari setiap CEX secara sequential
        for (const cexName of selectedCexList) {
            try {
                // Update progress: fetching
                updateFetchProgress(cexName, 'fetching', `Connecting to ${cexName} API...`);

                // Fetch wallet status menggunakan services/cex.js
                if (typeof window.App?.Services?.CEX?.fetchWalletStatus === 'function') {
                    const walletData = await window.App.Services.CEX.fetchWalletStatus(cexName);

                    // Update progress: processing
                    updateFetchProgress(cexName, 'processing', 'Memproses data wallet...');

                    // Filter data berdasarkan chain aktif menggunakan CHAIN_SYNONYMS
                    let filteredData = walletData;
                    if (mode.type === 'single' && mode.chain) {
                        const targetChain = mode.chain.toLowerCase();

                        // Gunakan CHAIN_SYNONYMS dari config.js untuk matching
                        const chainSynonyms = window.CHAIN_SYNONYMS?.[targetChain] || [];

                        // Buat regex pattern dari synonyms
                        const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const pattern = chainSynonyms.length > 0
                            ? new RegExp(chainSynonyms.map(escapeRegex).join('|'), 'i')
                            : null;

                        filteredData = walletData.filter(item => {
                            const itemChain = String(item.chain || '');

                            // Match menggunakan regex pattern dari synonyms
                            if (pattern && pattern.test(itemChain)) {
                                return true;
                            }

                            // Fallback: exact match dengan chain key
                            return itemChain.toLowerCase() === targetChain;
                        });

                        // console.log(`[${cexName}] Chain filter: ${targetChain} | Synonyms: [${chainSynonyms.join(', ')}] | Total: ${walletData.length} → Filtered: ${filteredData.length}`);
                    }

                    // Simpan data
                    cexWalletData[cexName] = filteredData;

                    // Update progress: success
                    updateFetchProgress(cexName, 'success', 'Berhasil', filteredData.length);

                } else {
                    throw new Error('fetchWalletStatus function not available');
                }

            } catch(err) {
                // console.error(`[Wallet Exchanger] Error fetching ${cexName}:`, err);
                failedCexes.push(cexName);
                updateFetchProgress(cexName, 'error', err.message || 'Gagal fetch data');
            }

            // Delay antar CEX untuk menghindari rate limit
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Hide progress overlay
        hideFetchProgressOverlay();

        // Proses dan tampilkan hasil
        try {
            // Load existing coins dari storage
            const existingCoins = loadCoinsFromStorage({ applyFilter: false, mode });
            // console.log('[Wallet Exchanger] Existing coins in storage:', existingCoins.length);

            const mergedCoins = mergeWalletData(existingCoins, cexWalletData, mode);
            // console.log('[Wallet Exchanger] Merged coins:', mergedCoins.length);

            // Debug: tampilkan sample data
            if (mergedCoins.length > 0) {
                // console.log('[Wallet Exchanger] Sample merged coin:', mergedCoins[0]);
            }

            // Save merged data ke storage
            saveCoinsToStorage(mergedCoins);

            // Re-render cards dengan data terbaru
            renderCexCards();

            // Show notification
            if (failedCexes.length === 0) {
                showUpdateResult(true, []);
                if (typeof toast !== 'undefined' && toast.success) {
                    const uniqueKeys = new Set();
                    Object.keys(cexWalletData).forEach(name => {
                        (cexWalletData[name] || []).forEach(item => {
                            const chainKey = normalizeChainKey(item.chain, mode);
                            const symbol = String(item.tokenName || '').toUpperCase();
                            if (symbol) uniqueKeys.add(`${chainKey}:${symbol}`);
                        });
                    });
                    const totalCoins = uniqueKeys.size;
                    toast.success(`✅ Berhasil fetch ${totalCoins} koin dari ${selectedCexList.length} CEX`);
                }

                // Log ke history: Update Wallet berhasil
                if (typeof addHistoryEntry === 'function') {
                    const totalTokens = Object.keys(cexWalletData).reduce((sum, name) => sum + (cexWalletData[name] || []).length, 0);
                    addHistoryEntry(
                        'UPDATE WALLET EXCHANGER',
                        'success',
                        {
                            cex: selectedCexList.join(', '),
                            totalTokens: totalTokens,
                            mode: mode.type === 'single' ? `Chain: ${mode.chain}` : 'Multichain'
                        }
                    );
                }
            } else {
                showUpdateResult(false, failedCexes);
                if (typeof toast !== 'undefined' && toast.warning) {
                    toast.warning(`⚠️ Berhasil: ${selectedCexList.length - failedCexes.length}, Gagal: ${failedCexes.length}`);
                }

                // Log ke history: Update Wallet sebagian berhasil
                if (typeof addHistoryEntry === 'function') {
                    addHistoryEntry(
                        'UPDATE WALLET EXCHANGER',
                        'warning',
                        {
                            success: selectedCexList.filter(c => !failedCexes.includes(c)).join(', '),
                            failed: failedCexes.join(', ')
                        }
                    );
                }
            }

        } catch(err) {
            // console.error('[Wallet Exchanger] Error processing results:', err);
            showUpdateResult(false, selectedCexList);
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Gagal memproses hasil: ' + err.message);
            }

            // Log ke history: Update Wallet error
            if (typeof addHistoryEntry === 'function') {
                addHistoryEntry(
                    'UPDATE WALLET EXCHANGER',
                    'error',
                    {
                        cex: selectedCexList.join(', '),
                        error: err.message || 'Unknown error'
                    }
                );
            }
        }
    }

    /**
     * Show wallet exchanger section
     */
    function show() {
        // Gunakan section manager terpusat untuk mencegah tumpang tindih
        if (typeof showMainSection === 'function') {
            showMainSection('#update-wallet-section');
        } else {
            // Fallback jika showMainSection tidak tersedia
            $('#update-wallet-section').show();
        }

        // Reset selection
        selectedCexList = [];

        // Render CEX cards dengan data dari storage
        renderCexCards();
    }

    /**
     * Hide wallet exchanger section
     */
    function hide() {
        $('#update-wallet-section').fadeOut(300);
        // Gunakan section manager terpusat untuk kembali ke tampilan utama
        if (typeof showMainSection === 'function') {
            showMainSection('scanner');
        }
    }

    /**
     * Initialize module
     */
    function init() {
        // Bind CEK WALLET button
        $('#btn-cek-wallet-exchanger').off('click').on('click', handleCekWallet);

        // Bind close button
        $('#btn-close-wallet-section').off('click').on('click', hide);

        // console.log('[Wallet Exchanger UI] Module initialized');
    }

    // Register to App namespace
    if (typeof App.register === 'function') {
        App.register('WalletExchanger', {
            show,
            hide,
            renderCexCards,
            showUpdateResult,
            init
        });
    } else {
        // Fallback registration
        App.WalletExchanger = { show, hide, renderCexCards, showUpdateResult, init };
    }

    // Auto-init on DOM ready
    $(document).ready(function() {
        init();
    });

})(typeof window !== 'undefined' ? window : this);

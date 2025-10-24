/**
 * Monitoring Table Column Spec & Header Utilities
 *
 * Column order: ORDERBOOK (left) → DEX (left, per active DEX) → DETAIL TOKEN → DEX (right, per active DEX) → ORDERBOOK (right)
 * Header and body cells should be driven from the same DEX list so they always stay in sync.
 */

// Resolve currently active DEX list based on app mode and config; safe for global use
function computeActiveDexList() {
  try {
    // Honor locked DEX list during an active scan to keep header/columns stable
    if (typeof window !== 'undefined' && Array.isArray(window.__LOCKED_DEX_LIST) && window.__LOCKED_DEX_LIST.length) {
      return window.__LOCKED_DEX_LIST.map(x => String(x).toLowerCase());
    }
    if (typeof window !== 'undefined' && typeof window.resolveActiveDexList === 'function') return window.resolveActiveDexList();
    const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    if (m.type === 'single') {
      const arr = ((window.CONFIG_CHAINS || {})[m.chain] || {}).DEXS || [];
      return (Array.isArray(arr) ? arr : []).map(x => String(x).toLowerCase());
    }
    return Object.keys(window.CONFIG_DEXS || {}).map(x => String(x).toLowerCase());
  } catch (_) {
    return Object.keys(window.CONFIG_DEXS || {}).map(x => String(x).toLowerCase());
  }
}

// Build a normalized column specification for the monitoring table header
function getMonitoringColumnSpec(dexList) {
  const spec = [];
  const activeDexList = Array.isArray(dexList) ? dexList : [];
  spec.push({ type: 'orderbook-left', label: 'ORDERBOOK', classes: 'uk-text-center uk-text-bolder th-orderbook' });
  activeDexList.forEach(d => spec.push({ type: 'dex', side: 'left', key: String(d).toLowerCase(), label: String(d).toUpperCase(), classes: 'uk-text-center uk-text-small th-dex' }));
  spec.push({ type: 'detail', label: 'DETAIL TOKEN', classes: 'uk-text-center uk-text-bolder th-detail' });
  activeDexList.forEach(d => spec.push({ type: 'dex', side: 'right', key: String(d).toLowerCase(), label: String(d).toUpperCase(), classes: 'uk-text-center uk-text-small th-dex' }));
  spec.push({ type: 'orderbook-right', label: 'ORDERBOOK', classes: 'uk-text-center uk-text-bolder th-orderbook' });
  return spec;
}

// Helper function to calculate total column count based on active DEX list
function getTotalColumnCount(dexList) {
  const activeDexCount = Array.isArray(dexList) ? dexList.length : 0;
  // Formula: 1 (ORDERBOOK left) + activeDexCount (DEX left) + 1 (DETAIL) + activeDexCount (DEX right) + 1 (ORDERBOOK right)
  return 3 + (activeDexCount * 2);
}

// Render the monitoring table header from a spec; exposed globally for reuse (e.g., Start Scan)
function renderMonitoringHeader(dexList) {
  try {
    const thead = document.querySelector('#tabel-monitoring thead');
    if (!thead) return;
    const spec = getMonitoringColumnSpec(dexList || []);
    const cells = spec.map(c => `<th class="${c.classes}">${c.label}</th>`);
    thead.innerHTML = `<tr style="border-bottom: 1px solid black;">${cells.join('')}</tr>`;
  } catch(_) {}
}
try { if (typeof window !== 'undefined') { window.renderMonitoringHeader = renderMonitoringHeader; window.computeActiveDexList = computeActiveDexList; window.getTotalColumnCount = getTotalColumnCount; } } catch(_) {}

/**
 * Render monitoring table rows for the given flat token list.
 * Also refreshes DEX signal cards when rendering main table.
 */
function loadKointoTable(filteredData, tableBodyId = 'dataTableBody') {
    // header helpers moved to top-level: computeActiveDexList(), renderMonitoringHeader()
    // refactor: pecah rendering row menjadi helper kecil agar lebih mudah dibaca/dirawat.
    function buildOrderbookCell(side, data, idPrefix, warnaCex) {
        const arrow = side === 'LEFT' ? `${(data.symbol_in||'').toUpperCase()} → ${(data.symbol_out||'').toUpperCase()}`
                                      : `${(data.symbol_out||'').toUpperCase()} → ${(data.symbol_in||'').toUpperCase()}`;
        const rawId = `${side}_`+
                      `${String(data.cex).toUpperCase()}_`+
                      `${String(data.symbol_in||'').toUpperCase()}_`+
                      `${String(data.symbol_out||'').toUpperCase()}_`+
                      `${String(data.chain).toUpperCase()}`;
        const id = idPrefix + rawId.replace(/[^A-Z0-9_]/g, '');
        return `
            <td class="td-orderbook" style="color: ${warnaCex}; text-align: center; vertical-align: middle;">
                <div class="orderbook-wrap">
                    <div class="orderbook-scroll">
                        <span id="${id}">
                            <b>${arrow}<br>${data.cex}</b> 🔒
                        </span>
                    </div>
                </div>
            </td>`;
    }

    function buildDexSlots(direction, data, dexList, idPrefix, rowIndex) {
        const isLeft = direction === 'LEFT';
        let html = '';
        const lowerDexs = (data.dexs || []).map(d => ({
            dex: String(d.dex || '').toLowerCase(),
            left: d.left, right: d.right
        }));
        dexList.forEach(dexKey => {
            const dexKeyLower = String(dexKey).toLowerCase();
            const found = lowerDexs.find(x => x.dex === dexKeyLower);
            if (found) {
                // Get proper display label from CONFIG_DEXS
                const dexConfig = (typeof window !== 'undefined' && window.CONFIG_DEXS) ? window.CONFIG_DEXS[dexKeyLower] : null;
                const dexName = (dexConfig && dexConfig.label) ? String(dexConfig.label) : String(dexKey).toUpperCase();
                // Normalize DEX name using registry to handle aliases (kyberswap->kyber, matcha->0x)
                let canonicalDex = String(found.dex || dexKeyLower);
                try {
                    if (typeof window !== 'undefined' && window.DEX && typeof window.DEX.normalize === 'function') {
                        canonicalDex = window.DEX.normalize(canonicalDex);
                    }
                } catch(_) {}
                const modal = isLeft ? (found.left ?? 0) : (found.right ?? 0);
                // ID generation: include token ID and CEX for uniqueness across multiple rows with same symbol pair
                const sym1 = isLeft ? String(data.symbol_in||'').toUpperCase() : String(data.symbol_out||'').toUpperCase();
                const sym2 = isLeft ? String(data.symbol_out||'').toUpperCase() : String(data.symbol_in||'').toUpperCase();
                const tokenId = String(data.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                const baseIdRaw = `${String(data.cex).toUpperCase()}_${canonicalDex.toUpperCase()}_${sym1}_${sym2}_${String(data.chain).toUpperCase()}_${tokenId}`;
                const baseId = baseIdRaw.replace(/[^A-Z0-9_]/g, '');
                const fullCellId = `${idPrefix}${baseId}`;
                // Debug: log cell ID yang dibuat
                if (window.DEBUG_CELL_IDS) {
                    // console.log(`[buildDexSlots] Created cell:`, {
                        // id: fullCellId,
                        // dex: dexName,
                        // direction: direction,
                        // modal: modal,
                        // symbolIn: data.symbol_in,
                        // symbolOut: data.symbol_out,
                        // cex: data.cex,
                        // chain: data.chain
                    // });
                }
                html += `
                    <td class="td-dex" id="${fullCellId}"
                        data-cex="${String(data.cex).toUpperCase()}"
                        data-dex="${canonicalDex}"
                        data-sym1="${sym1}"
                        data-sym2="${sym2}"
                        data-chain="${String(data.chain).toUpperCase()}"
                        data-row-index="${rowIndex}"
                        style="text-align: center; vertical-align: middle;">
                        <strong class="uk-align-center" style="display:inline-block; margin:0;">${dexName.toUpperCase().substring(0, 6)} [$${modal}] </strong></br>
                        <span class="dex-status uk-text-muted"> 🔒 </span>
                    </td>`;
            } else {
                html += '<td class="td-dex dex-slot-empty">-</td>';
            }
        });
        return html;
    }

    const dexList = computeActiveDexList();
    if (tableBodyId === 'dataTableBody') { RenderCardSignal(); }
    renderMonitoringHeader(dexList);
    const $tableBody = $('#' + tableBodyId);
    const $startButton = $('#startSCAN');
    const hasRows = Array.isArray(filteredData) && filteredData.length > 0;
    const scanningActive = (() => {
        try {
            if (typeof getAppState === 'function') {
                const state = getAppState();
                return state && state.run === 'YES';
            }
        } catch(_) {}
        return false;
    })();

    if ($startButton.length) {
        if (hasRows) {
            $startButton.show();
            if ($startButton.attr('data-disabled-empty') === '1') {
                $startButton.removeAttr('data-disabled-empty');
                if (!scanningActive) {
                    $startButton.prop('disabled', false).removeClass('uk-button-disabled');
                }
            }
        } else {
            if (!scanningActive) {
                $startButton.prop('disabled', true).addClass('uk-button-disabled');
            }
            $startButton.attr('data-disabled-empty', '1').hide();
        }
    }

    if (!hasRows) {
        const totalCols = getTotalColumnCount(dexList);
        if ($tableBody.length) $tableBody.html(`<tr><td colspan="${totalCols}" class="uk-text-center">No tokens to display.</td></tr>`);
        return;
    }

    // Manage concurrent renders per table body // REFACTORED
    if (typeof window !== 'undefined') {
        window.__TABLE_RENDER_JOBS = window.__TABLE_RENDER_JOBS || new Map();
    }
    const __jobKey = String(tableBodyId);
    const __prevJob = window.__TABLE_RENDER_JOBS.get(__jobKey);
    // Cancel previous job safely without try/catch // REFACTORED
    if (__prevJob && typeof __prevJob.cancel === 'function') { __prevJob.cancel(); }

    const maxSlots = dexList.length;

    // Incremental chunked rendering to avoid blocking on large datasets
    if ($tableBody.length) $tableBody.html('');
    const total = filteredData.length;
    const CHUNK = 200; // rows per batch
    let cursor = 0;
    let __cancelled = false;
    window.__TABLE_RENDER_JOBS.set(__jobKey, { cancel: () => { __cancelled = true; } });

    function renderChunk(){
        if (__cancelled) return;
        if (!$tableBody.length) return;
        let chunkHtml = '';
        const start = cursor;
        const end = Math.min(start + CHUNK, total);
        for (let i = start; i < end; i++) {
            const data = filteredData[i];
            const index = i;
        // CEX and Chain specific data
        const warnaCex = (CONFIG_CEX[data.cex] && CONFIG_CEX[data.cex].WARNA) || '#000';
        const chainLower = data.chain?.toLowerCase();
        const chainConfig = CONFIG_CHAINS[chainLower] || { URL_Chain: '', WARNA: '#000', Kode_Chain: '', Nama_Chain: '' };
        const warnaChain = chainConfig.WARNA || '#000';

        // Start row
        let rowHtml = '<tr>';

        const idPrefix = tableBodyId + '_';

        // refactor: gunakan helper kecil untuk orderbook kiri
        rowHtml += buildOrderbookCell('LEFT', data, idPrefix, warnaCex);

        // refactor: render slot DEX kiri via helper (pass row index for unique IDs)
        rowHtml += buildDexSlots('LEFT', data, dexList, idPrefix, index);

        // Detail Info
        const urlScIn = chainConfig.URL_Chain ? `${chainConfig.URL_Chain}/token/${data.sc_in}` : '#';
        const urlScOut = chainConfig.URL_Chain ? `${chainConfig.URL_Chain}/token/${data.sc_out}` : '#';
        const urlsCEX = GeturlExchanger(data.cex, data.symbol_in, data.symbol_out);

        const tradeTokenUrl = safeUrl(urlsCEX?.tradeToken, urlScIn);
        const tradePairUrl  = safeUrl(urlsCEX?.tradePair,  urlScOut);
        const withdrawTokenUrl = safeUrl(urlsCEX?.withdrawTokenUrl || urlsCEX?.withdrawUrl, urlScIn);
        const depositTokenUrl  = safeUrl(urlsCEX?.depositTokenUrl  || urlsCEX?.depositUrl,  urlScIn);
        const withdrawPairUrl  = safeUrl(urlsCEX?.withdrawPairUrl  || urlsCEX?.withdrawUrl, urlScOut);
        const depositPairUrl   = safeUrl(urlsCEX?.depositPairUrl   || urlsCEX?.depositUrl,  urlScOut);

        const linkToken = createHoverLink(tradeTokenUrl, (data.symbol_in||'').toUpperCase());
        const linkPair  = createHoverLink(tradePairUrl,  (data.symbol_out||'').toUpperCase());

        const WD_TOKEN = linkifyStatus(data.withdrawToken, 'WD', withdrawTokenUrl);
        const DP_TOKEN = linkifyStatus(data.depositToken,  'DP', depositTokenUrl);
        const WD_PAIR  = linkifyStatus(data.withdrawPair,  'WD', withdrawPairUrl);
        const DP_PAIR  = linkifyStatus(data.depositPair,   'DP', depositPairUrl);

        const chainData = getChainData(data.chain);
        const walletObj = chainData?.CEXCHAIN?.[data.cex] || {};
        const linkStokToken = Object.entries(walletObj)
            .filter(([key, val]) => key.toLowerCase().includes('address') && val && val !== '#')
            .map(([key, val], idx) => createHoverLink(`${chainConfig.URL_Chain}/token/${data.sc_in}?a=${val}`, `#${idx + 1} `))
            .join('');
        const linkStokPair = Object.entries(walletObj)
            .filter(([key, val]) => key.toLowerCase().includes('address') && val && val !== '#')
            .map(([key, val], idx) => createHoverLink(`${chainConfig.URL_Chain}/token/${data.sc_out}?a=${val}`, `#${idx + 1} `))
            .join('');

        const linkSCtoken = createHoverLink(urlScIn, '[SC]', 'uk-text-primary');
        const linkSCpair = createHoverLink(urlScOut, '[SC]', 'uk-text-primary');

        const linkOKDEX = createHoverLink(`https://www.okx.com/web3/dex-swap?inputChain=${chainConfig.Kode_Chain}&inputCurrency=${data.sc_in}&outputChain=${chainConfig.Kode_Chain}&outputCurrency=${data.sc_out}`, '#OKX', 'uk-text-primary');
        const linkUNIDEX = createHoverLink(`https://app.unidex.exchange/?chain=${chainConfig.Nama_Chain}&from=${data.sc_in}&to=${data.sc_out}`, '#UNX', 'uk-text-success');
        const linkDEFIL = createHoverLink(`https://swap.defillama.com/?chain=${chainConfig.Nama_Chain}&from=${data.sc_in}&to=${data.sc_out}`, '#DFL', 'uk-text-danger');
        const linkDZAP = createHoverLink(`https://app.dzap.io/trade?fromChain=${chainConfig.Kode_Chain}&fromToken=${data.sc_in}&toChain=${chainConfig.Kode_Chain}&toToken=${data.sc_out}`, '#DZP', 'uk-text-dark');

        const rowId = `DETAIL_${String(data.cex).toUpperCase()}_${String(data.symbol_in).toUpperCase()}_${String(data.symbol_out).toUpperCase()}_${String(data.chain).toUpperCase()}`.replace(/[^A-Z0-9_]/g,'');
        const chainShort = (data.chain || '').substring(0,3).toUpperCase();

        rowHtml += `
            <td id="${idPrefix}${rowId}" class="uk-text-center uk-background td-detail" style="text-align: center; border:1px solid black; padding:10px;">
                <span class="detail-line">[${index + 1}] 
                <span style="color: ${warnaChain}; font-weight:bolder; font-size:medium;"  >${linkToken} </span> ⇄ <span style="color: ${warnaChain}; font-weight:bolder; font-size:medium;">${linkPair} </span>
                <span id="${idPrefix}EditMulti-${data.id}" data-id="${data.id}"
                data-chain="${String(data.chain).toLowerCase()}"
                      data-cex="${String(data.cex).toUpperCase()}"
                      data-symbol-in="${String(data.symbol_in).toUpperCase()}"
                      data-symbol-out="${String(data.symbol_out).toUpperCase()}"
                       title="UBAH DATA KOIN" uk-icon="icon: settings; ratio: 0.7" class="uk-text-primary uk-text-bolder edit-token-button" style="cursor:pointer"></span>
                
                <span id="${idPrefix}DelMulti-${data.id}"
                      data-id="${data.id}"
                      data-chain="${String(data.chain).toLowerCase()}"
                      data-cex="${String(data.cex).toUpperCase()}"
                      data-symbol-in="${String(data.symbol_in).toUpperCase()}"
                      data-symbol-out="${String(data.symbol_out).toUpperCase()}"
                      title="HAPUS DATA KOIN"
                      uk-icon="icon: trash; ratio: 0.7"
                      class="uk-text-danger uk-text-bolder delete-token-button"
                      style="cursor:pointer;">
                </span>
                </span>
                               <span style="color: ${warnaCex}; font-weight:bolder;">${data.cex} </span> on <span style="color: ${warnaChain}; font-weight:bolder;">${chainShort} </span>

                <span class="detail-line uk-text-bolder">${WD_TOKEN}~ ${DP_TOKEN} | ${WD_PAIR}~ ${DP_PAIR}</span>
                <span class="detail-line"><span class="uk-text-primary uk-text-bolder">${(data.symbol_in||'').toUpperCase()}</span> ${linkSCtoken} : ${linkStokToken}</span>
                <span class="detail-line"><span class="uk-text-primary uk-text-bolder">${(data.symbol_out||'').toUpperCase()}</span> ${linkSCpair} : ${linkStokPair}</span>
                <span class="detail-line">${linkUNIDEX} ${linkOKDEX} ${linkDEFIL} ${linkDZAP}</span>
            </td>`;

        // refactor: render slot DEX kanan via helper
        rowHtml += buildDexSlots('RIGHT', data, dexList, idPrefix, index);

        // refactor: gunakan helper kecil untuk orderbook kanan
        rowHtml += buildOrderbookCell('RIGHT', data, idPrefix, warnaCex);

        // End row
        rowHtml += '</tr>';
        chunkHtml += rowHtml;
        }
        if (chunkHtml) $tableBody.append(chunkHtml);
        // Update progress label without try/catch // REFACTORED
        const pct = Math.floor(((end) / Math.max(total,1)) * 100);
        const label = `Rendering table: ${end}/${total} (${pct}%)`;
        $('#progress').text(label);
        cursor = end;
        if (cursor < total) {
            // Yield back to UI; schedule next batch
            requestAnimationFrame(renderChunk);
        } else {
            $('#startSCAN').prop('disabled', false);
            // clear job when done
            window.__TABLE_RENDER_JOBS.delete(__jobKey);
        }
    }
    renderChunk();
}

/**
 * Ensure monitoring table UI skeleton exists for a given token list before scanning updates run.
 * - Locks to current active/locked DEX list for consistent columns.
 * - Renders header and body rows with placeholder cells and ids that scanner.js expects.
 * - Does not trigger any calculation; only prepares DOM targets.
 */
function prepareMonitoringSkeleton(tokens, tableBodyId = 'dataTableBody') {
    try {
        const dexList = computeActiveDexList();
        renderMonitoringHeader(dexList);
        // Reuse chunked renderer to build rows with the correct id scheme
        loadKointoTable(Array.isArray(tokens) ? tokens : [], tableBodyId);
    } catch(_) {}
}
try { if (typeof window !== 'undefined') { window.prepareMonitoringSkeleton = prepareMonitoringSkeleton; } } catch(_) {}

function renderTokenManagementList() {
    const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    let allTokens = (m.type === 'single')
        ? (getFromLocalStorage(`TOKEN_${String(m.chain).toUpperCase()}`, []) || [])
        : (getFromLocalStorage('TOKEN_MULTICHAIN', []) || []);
    if (!Array.isArray(allTokens)) allTokens = [];

    // This variable will hold the list of tokens after applying chain/cex/pair filters.
    let filteredForStats = [...allTokens];

    // Apply active filters (Chain, CEX, Pair, DEX) to determine the base list for stats
    if (m.type === 'single') {
        const chainKey = m.chain;
        const filters = getFilterChain(chainKey) || { cex: [], pair: [], dex: [] };
        const hasCex = Array.isArray(filters.cex) && filters.cex.length > 0;
        const hasPair = Array.isArray(filters.pair) && filters.pair.length > 0;
        const hasDex = Array.isArray(filters.dex) && filters.dex.length > 0;
        if (hasCex && hasPair && hasDex) {
            const upperCexFilters = filters.cex.map(c => String(c).toUpperCase());
            const pairDefs = (CONFIG_CHAINS?.[chainKey] || {}).PAIRDEXS || {};
            filteredForStats = filteredForStats
                .filter(t => (t.selectedCexs || []).some(c => upperCexFilters.includes(String(c).toUpperCase())))
                .filter(t => {
                    const p = String(t.symbol_out || '').toUpperCase();
                    const key = pairDefs[p] ? p : 'NON';
                    return filters.pair.includes(key);
                })
                .filter(t => (t.selectedDexs || []).some(d => filters.dex.includes(String(d).toLowerCase())));
        } else {
            filteredForStats = [];
        }
    } else { // multi-chain mode
        const saved = getFromLocalStorage('FILTER_MULTICHAIN', null);
        const filters = getFilterMulti() || { chains: [], cex: [], dex: [] };
        const hasChains = Array.isArray(filters.chains) && filters.chains.length > 0;
        const hasCex = Array.isArray(filters.cex) && filters.cex.length > 0;
        const hasDex = Array.isArray(filters.dex) && filters.dex.length > 0;
        if (!saved) {
            // no saved filter → keep all
        } else if (!(hasChains && hasCex && hasDex)) {
            filteredForStats = [];
        } else {
            const lowerChainFilters = filters.chains.map(c => String(c).toLowerCase());
            const upperCexFilters = filters.cex.map(c => String(c).toUpperCase());
            filteredForStats = filteredForStats
                .filter(t => lowerChainFilters.includes(String(t.chain || '').toLowerCase()))
                .filter(t => (t.selectedCexs || []).some(c => upperCexFilters.includes(String(c).toUpperCase())))
                .filter(t => (t.selectedDexs || []).some(d => filters.dex.includes(String(d).toLowerCase())));
        }
    }

    // Calculate stats based on this filtered list (and token status)
    const activeTokensForStats = filteredForStats.filter(t => t.status);
    let statsHtml = '-';

    if (m.type === 'single') {
        const chainKey = m.chain;
        const pairDefs = (CONFIG_CHAINS?.[chainKey] || {}).PAIRDEXS || {};
        const countByCex = activeTokensForStats.reduce((acc, t) => {
            (t.selectedCexs || []).forEach(cx => { const u = String(cx).toUpperCase(); acc[u] = (acc[u] || 0) + 1; }); return acc;
        }, {});
        const countByPair = activeTokensForStats.reduce((acc, t) => {
            const p = String(t.symbol_out || '').toUpperCase(); const key = pairDefs[p] ? p : 'NON'; acc[key] = (acc[key] || 0) + 1; return acc;
        }, {});
        const cexStatsHtml = Object.entries(countByCex).map(([cex, count]) => {
            const col = CONFIG_CEX?.[cex]?.WARNA || '#444';
            return `<span style="color:${col}; margin:2px; font-weight:bolder;">${cex}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `;
        }).join(' ') || '-';
        const pairStatsHtml = Object.entries(countByPair).map(([pair, count]) => (
            `<span class="uk-text-bolder" style="margin:2px;">${pair}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `
        )).join(' ') || '-';
       
        statsHtml = `<b class="uk-text-primary uk-text-bolder">MANAJEMEN KOIN CHAIN ${chainKey.toUpperCase()}</b>`;
    } else { // multi-chain mode
        const countByChain = activeTokensForStats.reduce((acc, t) => { const k = String(t.chain || '').toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
        const countByCex = activeTokensForStats.reduce((acc, t) => { (t.selectedCexs || []).forEach(cx => { const u = String(cx).toUpperCase(); acc[u] = (acc[u] || 0) + 1; }); return acc; }, {});
        const chainStatsHtml = Object.entries(countByChain).map(([chain, count]) => {
            const cfg = CONFIG_CHAINS?.[chain] || {}; const color = cfg.WARNA || '#666';
            const label = (cfg.Nama_Pendek || cfg.SHORT_NAME || chain).toUpperCase();
            return `<span style="color:${color}; margin:2px; font-weight:bolder;">${label}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `;
        }).join(' ') || '-';
        const cexStatsHtml = Object.entries(countByCex).map(([cex, count]) => {
            const col = CONFIG_CEX?.[cex]?.WARNA || '#444';
            return `<span style="color:${col}; margin:2px; font-weight:bolder;">${cex}</span> <span class="uk-text-dark uk-text-bolder"> [${count}]</span> `;
        }).join(' ') || '-';
        statsHtml = `<b class="uk-text-primary uk-text-bolder">MANAJEMEN KOIN (MULTICHAIN)</b>`;
       
    }

    const currentQ = ($('#mgrSearchInput').length ? ($('#mgrSearchInput').val() || '') : ($('#searchInput').length ? ($('#searchInput').val() || '') : ''));
    const safeQ = String(currentQ || '').replace(/"/g, '&quot;');
    const controls = (() => {
        const base = [
          `<input id="mgrSearchInput" class="uk-input uk-form-small" type="text" placeholder="Cari koin..." style="width:160px;" value="${safeQ}">`,
          `<button id=\"btnNewToken\" class=\"uk-button uk-button-default uk-button-small\" title=\"Tambah Data Koin\"><span uk-icon=\"plus-circle\"></span> ADD COIN</button>`,
          `<button id=\"btnExportTokens\" data-feature=\"export\" class=\"uk-button uk-button-small uk-button-secondary\" title=\"Export CSV\"><span uk-icon=\"download\"></span> Export</button>`,
          `<button id=\"btnImportTokens\" data-feature=\"import\" class=\"uk-button uk-button-small uk-button-danger\" title=\"Import CSV\"><span uk-icon=\"upload\"></span> Import</button>`,
          `<input type=\"file\" id=\"uploadJSON\" accept=\".csv,text/csv\" style=\"display:none;\" onchange=\"uploadTokenScannerCSV(event)\">`
        ];
        if (m.type === 'single') {
          base.splice(2, 0, `<button id=\"sync-tokens-btn\" class=\"uk-button uk-button-small uk-button-primary\" title=\"Sinkronisasi Data Koin\"><span uk-icon=\"database\"></span> SYNC</button>`);
        }
        return base.join('\n');
    })();

    // Render header only once; on subsequent calls, only update stats summary to avoid losing focus on input
    const $hdr = $('#token-management-stats');
    if ($hdr.find('.mgr-header').length === 0) {
        const headerHtml = `<div class="uk-flex uk-flex-between uk-flex-middle mgr-header" style="gap:8px; align-items:center;">
                        <!-- Bagian kiri -->
                        <div id="mgrStatsSummary" class="uk-flex uk-flex-middle" style="white-space:nowrap;">
                            <h4 class="uk-margin-remove">${statsHtml}</h4>
                        </div>

                        <!-- Bagian kanan -->
                        <div class="uk-flex uk-flex-middle" style="gap:6px; align-items:center;">
                            ${controls}
                        </div>
                    </div>
                    `;
        $hdr.html(headerHtml);
    } else {
        $('#mgrStatsSummary').html(statsHtml);
    }

    // Now, apply the search filter to the already chain/cex filtered list for the table display
    const q = (currentQ || '').toLowerCase();
    const rows = filteredForStats
        .filter(t => !q || `${t.symbol_in} ${t.symbol_out} ${t.chain}`.toLowerCase().includes(q))
        .map((t, i) => ({ ...t, no: i + 1 }));

    const $tb = $('#mgrTbody').empty();

    // Virtualize manager rows for large datasets
    const ROW_ESTIMATE = 64; // px per row (approx, adjusted for larger text)
    const VIRTUAL_THRESHOLD = 150; // start virtualization earlier for smoother scroll on large lists

    function renderMgrRow(r){
        const cexHtml = (r.selectedCexs || []).map(cx => {
            const name = String(cx).toUpperCase();
            const col = (CONFIG_CEX?.[name]?.WARNA) || '#000';
            const d = (r.dataCexs || {})[name] || {};
            
            // REFACTORED: Tampilkan status WD/DP secara terpisah untuk Token dan Pair agar konsisten dengan tabel scanning.
            const renderStatus = (flag, label) => {
                if (flag === true) return `<span class="uk-text-success">${label}</span>`; // WD, DP
                if (flag === false) return `<span class="uk-text-danger">${label === 'WD' ? 'WX' : 'DX'}</span>`; // WX, DX
                return `<span class="uk-text-muted">?${label}</span>`;
            };

            const dpTokLabel = renderStatus(d.depositToken, 'DP');
            const wdTokLabel = renderStatus(d.withdrawToken, 'WD');
            const dpPairLabel = renderStatus(d.depositPair, 'DP');
            const wdPairLabel = renderStatus(d.withdrawPair, 'WD');

            const tokenStatus = `${wdTokLabel}/${dpTokLabel}`;
            const pairStatus = `${wdPairLabel}/${dpPairLabel}`;

            return ` <span class="cex-chip" style="font-weight:bolder;color:${col}" title="Status WD/DP untuk ${name}">${name} [${tokenStatus} | ${pairStatus}]</span>`;
        }).join(' ');

        const chainName = (CONFIG_CHAINS?.[String(r.chain).toLowerCase()]?.Nama_Chain) || r.chain;

        const radioGroup = `
        <div class="status-group">
          <label class="uk-text-success">
            <input class="uk-radio mgrStatus" type="radio" name="status-${r.id}" data-id="${r.id}" value="true" ${r.status ? 'checked' : ''}> ON
          </label>
          <label class="uk-text-danger">
            <input class="uk-radio mgrStatus" type="radio" name="status-${r.id}" data-id="${r.id}" value="false" ${!r.status ? 'checked' : ''}> OFF
          </label>
        </div>
      `;

        const names = (r.selectedDexs || []);
        const dexHtml = names.length ? names.map(name => {
            const k = String(name);
            const l = r?.dataDexs?.[k]?.left ?? r?.dataDexs?.[k.toLowerCase()]?.left ?? 0;
            const rgt = r?.dataDexs?.[k]?.right ?? r?.dataDexs?.[k.toLowerCase()]?.right ?? 0;
            return `<span class="dex-chip"><b>${k.toUpperCase()}</b> [<span class="dex-mini">${l}</span>~<span class="dex-mini">${rgt}</span>]</span>`;
        }).join(' ') : `<span class="dex-chip dex-empty">-</span>`;

        // Resolve display SC for NON/placeholder '0x'
        let scInDisp = r.sc_in || '';
        let desInDisp = r.des_in ?? '';
        let scOutDisp = r.sc_out || '';
        let desOutDisp = r.des_out ?? '';
        // Resolve defaults without try/catch // REFACTORED
        const chainCfg = (window.CONFIG_CHAINS || {})[String(r.chain).toLowerCase()] || {};
        const pairDefs = chainCfg.PAIRDEXS || {};
        const isInvalid = (addr) => !addr || String(addr).toLowerCase() === '0x' || String(addr).length < 6;
        const pairKey = String(r.symbol_out || '').toUpperCase();
        if (isInvalid(scOutDisp)) {
            const def = pairDefs[pairKey] || pairDefs['NON'] || {};
            if (def && def.scAddressPair) {
                scOutDisp = def.scAddressPair;
                desOutDisp = def.desPair ?? desOutDisp;
            }
        }

        const rowHtml = `
        <tr>
          <td class="uk-text-center">${r.no}</td>
          <td>
            <div><span class="uk-text-bold uk-text-success">${(r.symbol_in || '-').toUpperCase()}</span>
              <span class="addr">${scInDisp} [${desInDisp}]</span>
            </div>
            <div><span class="uk-text-bold uk-text-danger">${(r.symbol_out || '-').toUpperCase()}</span>
              <span class="addr">${scOutDisp} [${desOutDisp}]</span>
            </div>
          </td>
          <td>
            <div class="uk-text-center uk-margin-small-bottom">
              ${String(chainName).toUpperCase()} ${radioGroup}
            </div>
          </td>
          <td>${cexHtml || '-'}</td>
          <td>${dexHtml}</td>
          <td class="actions">
            <button class="uk-button uk-button-primary uk-button-xxsmall mgrEdit" data-id="${r.id}">Edit</button>
          </td>
        </tr>
      `;
        return rowHtml;
    }

    if ($('#manager-table').length && rows.length > VIRTUAL_THRESHOLD) {
        // Initialize virtualization
        const $container = $('#manager-table');
        const total = rows.length;
        const visibleCount = Math.max(20, Math.ceil($container.height() / ROW_ESTIMATE) + 10);

        function renderSlice(startIdx){
            const start = Math.max(0, Math.min(total - 1, startIdx|0));
            const end = Math.min(total, start + visibleCount);
            const topPad = Math.max(0, start * ROW_ESTIMATE);
            const botPad = Math.max(0, (total - end) * ROW_ESTIMATE);

            let html = '';
            // top spacer
            html += `<tr class="virt-spacer-top"><td colspan="6" style="padding:0; border:none;"><div style="height:${topPad}px"></div></td></tr>`;
            for (let i = start; i < end; i++) html += renderMgrRow(rows[i]);
            // bottom spacer
            html += `<tr class="virt-spacer-bot"><td colspan="6" style="padding:0; border:none;"><div style="height:${botPad}px"></div></td></tr>`;
            $tb.html(html);
        }

        let lastStart = 0;
        renderSlice(0);
        $container.on('scroll.virtual', function(){
            const newStart = Math.floor(($container.scrollTop() || 0) / ROW_ESTIMATE) - 5;
            if (newStart !== lastStart) {
                lastStart = newStart;
                renderSlice(newStart);
            }
        });
    } else {
        rows.forEach(r => { $tb.append(renderMgrRow(r)); });
    }
}

/**
 * Update left/right orderbook columns with parsed CEX volumes and prices.
 */
function updateTableVolCEX(finalResult, cex, tableBodyId = 'dataTableBody') {
    const cexName = String(cex||'').toUpperCase();
    const TokenPair = String(finalResult.token||'').toUpperCase().replace(/[^A-Z0-9_]/g,'') + "_" + String(finalResult.pair||'').toUpperCase().replace(/[^A-Z0-9_]/g,'');
    
    const idPrefix = tableBodyId + '_';

    const getPriceIDR = priceUSDT => {
        const rateIDR = getFromLocalStorage("PRICE_RATE_USDT", 0);
        return rateIDR
            ? (priceUSDT * rateIDR).toLocaleString("id-ID", { style: "currency", currency: "IDR" })
            : "N/A";
    };

    const renderVolume = (data, className) => `
        <span class='${className}' title="IDR: ${getPriceIDR(data.price)}">
            ${formatPrice(data.price || 0)} : <b>${(data.volume || 0).toFixed(2)}$</b><br/>
        </span>
    `;

    const volumesBuyTokenAll  = Array.isArray(finalResult.volumes_buyToken) ? finalResult.volumes_buyToken.slice().sort((a, b) => b.price - a.price) : [];
    const volumesSellPairAll  = Array.isArray(finalResult.volumes_sellPair) ? finalResult.volumes_sellPair.slice() : [];
    const volumesBuyPairAll   = Array.isArray(finalResult.volumes_buyPair) ? finalResult.volumes_buyPair.slice().sort((a, b) => b.price - a.price) : [];
    const volumesSellTokenAll = Array.isArray(finalResult.volumes_sellToken) ? finalResult.volumes_sellToken.slice().sort((a, b) => b.price - a.price) : [];

    const volumesSellToken = volumesSellTokenAll.slice(0, 4); // Kiri atas: 4
    const volumesSellPair  = volumesSellPairAll.slice(0, 2);  // Kiri bawah: 2
    const volumesBuyPair   = volumesBuyPairAll.slice(0, 2);
    const volumesBuyToken  = volumesBuyTokenAll.slice(0, 4);

    const leftId  = idPrefix + ('LEFT_'  + cexName + '_' + TokenPair + '_' + String(finalResult.chainName||'').toUpperCase()).replace(/[^A-Z0-9_]/g,'');
    const rightId = idPrefix + ('RIGHT_' + cexName + '_' + TokenPair + '_' + String(finalResult.chainName||'').toUpperCase()).replace(/[^A-Z0-9_]/g,'');
    const leftSelector = '#' + leftId;
    const rightSelector = '#' + rightId;

    $(leftSelector).html(
        volumesSellToken.map(data => renderVolume(data, 'uk-text-success')).join('') +
        `<span class='uk-text-primary uk-text-bolder'>${finalResult.token} -> ${finalResult.pair}</span><br/>` +
        volumesSellPair.map(data => renderVolume(data, 'uk-text-danger')).join('')
    );

    $(rightSelector).html(
        volumesBuyPair.map(data => renderVolume(data, 'uk-text-success')).join('') +
        `<span class='uk-text-primary uk-text-bolder'>${finalResult.pair} -> ${finalResult.token}</span><br/>` +
        volumesBuyToken.map(data => renderVolume(data, 'uk-text-danger')).join('')
    );
}

// Helper: convert HEX or named color to RGBA with given alpha; fall back to greenish
// Use global utils.hexToRgba to avoid duplication

// Helper: resolve chain color hex from config or chainData
function getChainColorHexByName(chainName) { // REFACTORED
  const key = String(chainName || '').toLowerCase();
  const cfg = (typeof getChainData === 'function')
    ? getChainData(chainName)
    : (typeof window !== 'undefined' ? window.CONFIG_CHAINS?.[key] : undefined);
  return cfg?.WARNA || cfg?.COLOR_CHAIN || '#94fa95';
}

// Helper: detect dark mode (basic). Overrideable if app provides getTheme/getDarkMode
function isDarkMode() { // REFACTORED
  // refactor: delegate to shared helper when available, with sensible fallbacks
  try { if (typeof window !== 'undefined' && window.isDarkMode) return !!window.isDarkMode(); } catch(_) {}
  try { if (typeof document !== 'undefined' && document.body && document.body.classList.contains('dark-mode')) return true; } catch(_) {}
  if (typeof getTheme === 'function') return String(getTheme()).toLowerCase().includes('dark');
  if (typeof getDarkMode === 'function') return !!getDarkMode();
  if (typeof window !== 'undefined' && window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return false;
}

/**
 * Render computed fees/PNL and swap link into a DEX cell; drive signal panel and Telegram.
 */
function DisplayPNL(data) {
  const {
    profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype,
    priceBuyToken_CEX, priceSellToken_CEX,
    FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal,
    nameChain, codeChain, trx, profitLossPercent, vol,
    idPrefix, baseId, linkDEX, dexUsdRate,
    quoteToUSDT: quoteToUSDT_in,
    cexInfo,
    rates,
    isFallback, fallbackSource  // REFACTORED: Tambahkan info sumber alternatif
  } = data;

  const elementId = String(idPrefix || '') + String(baseId || '');
  const el = document.getElementById(elementId);
  if (!el) {
    // Debug: log missing cell ID dengan console.error agar lebih terlihat
    // console.error(`❌ [DisplayPNL] Cell NOT FOUND!`, {
      // elementId,
      // cex: cex,
      // dex: dextype,
      // direction: trx,
      // symbolIn: Name_in,
      // symbolOut: Name_out,
      // chain: nameChain,
      // baseId: baseId,
      // idPrefix: idPrefix
    // });
    // List all cells with similar pattern for debugging
    try {
      const allCells = Array.from(document.querySelectorAll('[id*="' + String(cex).toUpperCase() + '"]'));
      const relevantCells = allCells.filter(c => c.id.includes(String(Name_in || '').toUpperCase())).map(c => c.id);
      if (relevantCells.length) {
        // console.log(`💡 Similar cells found:`, relevantCells);
      }
    } catch(_) {}
    return;
  }

  // Success log
  // console.log(`✅ [DisplayPNL] Cell FOUND & Updated:`, {
  //   elementId,
  //   dex: dextype,
  //   pnl: profitLoss.toFixed(2),
  //   isFallback,
  //   fallbackSource
  // });
  // REFACTORED: Clear any prior error background and finalize cell
  try { el.classList.remove('dex-error'); } catch(_) {}
  // REFACTORED: Finalize cell untuk mencegah overwrite oleh error lainnya
  try {
    if (el.dataset) {
      el.dataset.final = '1';
      delete el.dataset.checking;
      delete el.dataset.deadline;
    }
  } catch(_) {}
  // REFACTORED: Clear error status span jika ada
  try {
    const statusSpan = el.querySelector('.dex-status');
    if (statusSpan) {
      // Hapus status error/checking, biarkan DisplayPNL render hasil normal
      statusSpan.innerHTML = '';
      statusSpan.className = 'dex-status';
    }
  } catch(_) {}
  // Capture existing title log (built during scan in scanner.js) to reuse on price links only
  let __titleLog = null;
  try { __titleLog = (el && el.dataset && el.dataset.titleLog) ? String(el.dataset.titleLog) : null; } catch(_) {}
  // Remove cell-level title so tooltip lives only on price anchors (as requested)
  try { el.removeAttribute('title'); if (el && el.dataset) el.dataset.titleLog=''; } catch(_) {}
  const $mainCell = $(el);

  // Helpers
  const n = v => Number.isFinite(+v) ? +v : 0;
  const fmtUSD = v => (typeof formatPrice === 'function') ? formatPrice(n(v)) : n(v).toFixed(6);
  const fmtIDR = v => (typeof formatIDRfromUSDT === 'function') ? formatIDRfromUSDT(n(v)) : 'N/A';
  const lower = s => String(s || '').toLowerCase();
  const upper = s => String(s || '').toUpperCase();

  // Link CEX (default for current in/out orientation)
  const urls = (typeof GeturlExchanger === 'function')
    ? GeturlExchanger(upper(cex), String(Name_in||''), String(Name_out||''))
    : {};

  const getCexLinks = (direction) => {
    const isT2P = (lower(direction) === 'tokentopair');
    return {
      trade   : isT2P ? (urls?.tradeToken || urls?.tradeUrl || '#')
                      : (urls?.tradePair  || urls?.tradeUrl || '#'),
      withdraw: isT2P ? (urls?.withdrawTokenUrl || urls?.withdrawUrl || '#')
                      : (urls?.withdrawPairUrl  || urls?.withdrawUrl || '#'),
      deposit : isT2P ? (urls?.depositTokenUrl  || urls?.depositUrl  || '#')
                      : (urls?.depositPairUrl   || urls?.depositTokenUrl  || '#'),
    };
  };

  // Angka umum
  const pnl     = n(profitLoss);
  const feeAll  = n(totalFee);
  const bruto   = n(totalValue) - n(Modal);

  const filterPNLValue =
    (typeof getPNLFilter === 'function') ? n(getPNLFilter())
      : (typeof SavedSettingData !== 'undefined' ? n(SavedSettingData?.filterPNL) : 0);

  const passPNL =
    ((filterPNLValue === 0) && (n(totalValue) > n(totalModal))) ||
    ((n(totalValue) - n(totalModal)) > filterPNLValue) ||
    (pnl > feeAll);

  const checkVol = (typeof $ === 'function') ? $('#checkVOL').is(':checked') : false;
  const volOK    = n(vol) >= n(Modal);
  const isHighlight = (!checkVol && passPNL) || (checkVol && passPNL && volOK);

  // Normalisasi harga DEX → USDT/TOKEN
  const quote = upper(Name_out);
  const isUSDTQuote = quote === 'USDT';

  let q2u = 0;
  if (isUSDTQuote) q2u = 1;
  else if (Number.isFinite(+quoteToUSDT_in)) q2u = n(quoteToUSDT_in);
  else if (cexInfo && cexInfo[`${quote}ToUSDT`]) q2u = n(cexInfo[`${quote}ToUSDT`].buy || cexInfo[`${quote}ToUSDT`].sell || 0);
  else if (rates && rates[quote]) q2u = n(rates[quote].toUSDT);

  const dexRateRaw = n(dexUsdRate);

  let candA = dexRateRaw;
  let candB = dexRateRaw;
  if (!isUSDTQuote) {
    candA = (q2u > 0) ? (dexRateRaw * q2u) : dexRateRaw;           // QUOTE/TOKEN → USDT/TOKEN
    candB = (q2u > 0 && dexRateRaw > 0) ? (q2u / dexRateRaw) : 0;  // TOKEN/QUOTE → USDT/TOKEN
  }

  const refCexBuy  = n(priceBuyToken_CEX);
  const refCexSell = n(priceSellToken_CEX);

  let dexUsdtPerToken;
  if (lower(trx) === 'tokentopair') {
    if (refCexBuy > 0 && candA > 0 && candB > 0) {
      dexUsdtPerToken = (Math.abs(candA - refCexBuy) <= Math.abs(candB - refCexBuy)) ? candA : candB;
    } else dexUsdtPerToken = candA || candB || dexRateRaw;
  } else {
    if (refCexSell > 0 && candA > 0 && candB > 0) {
      dexUsdtPerToken = (Math.abs(candA - refCexSell) <= Math.abs(candB - refCexSell)) ? candA : candB;
    } else dexUsdtPerToken = candA || candB || dexRateRaw;
  }

  // Tampilkan harga + link
  const CEX = upper(cex);
  const DEX = upper(dextype);
  const direction = lower(trx);
  const cexLinks = getCexLinks(direction);

  let buyPrice, sellPrice, buyLink, sellLink, tipBuy, tipSell;

  // REFACTORED: Tambahkan info sumber alternatif ke label DEX
  const dexLabel = isFallback && fallbackSource ? `${DEX} via ${fallbackSource}` : DEX;

  if (direction === 'tokentopair') {
    buyPrice  = refCexBuy;
    sellPrice = n(dexUsdtPerToken);
    buyLink   = cexLinks.trade;      // TOKEN
    sellLink  = linkDEX || '#';

    tipBuy  = `USDT -> ${Name_in} | ${CEX} | ${fmtIDR(buyPrice)} | ${fmtUSD(buyPrice)} USDT/${Name_in}`;
    const inv = sellPrice > 0 ? (1/sellPrice) : 0;
    tipSell = `${Name_in} -> ${Name_out} | ${dexLabel} | ${fmtIDR(sellPrice)} | ${inv>0&&isFinite(inv)?inv.toFixed(6):'N/A'} ${Name_in}/${Name_out}`;
  } else {
    buyPrice  = n(dexUsdtPerToken);
    sellPrice = refCexSell;
    buyLink   = linkDEX || '#';
    sellLink  = cexLinks.trade;      // PAIR

    tipBuy  = `${Name_in} -> ${Name_out} | ${dexLabel} | ${fmtIDR(buyPrice)} | ${fmtUSD(buyPrice)} USDT/${Name_in}`;
    const inv = sellPrice > 0 ? (1/sellPrice) : 0;
    tipSell = `${Name_out} -> USDT | ${CEX} | ${fmtIDR(sellPrice)} | ${inv>0&&isFinite(inv)?inv.toFixed(6):'N/A'} ${Name_in}/${Name_out}`;
  }

  // Re-apply detailed title log only on price links when result is complete (not for errors)
  if (__titleLog && __titleLog.length > 0) {
    tipBuy = __titleLog;
    tipSell = __titleLog;
  }

  // Console summary: ringkasan kalkulasi scanning (toggled via #toggleScanLog)
  try {
    if (!(typeof window !== 'undefined' && window.SCAN_LOG_ENABLED === true)) {
      throw new Error('scan log disabled');
    }
    // Resolve WD/DP status dari list token aktif (jika ada)
    // Tambahkan status detail untuk Token & Pair agar jelas konteks ON/OFF mengacu ke apa.
    let wdFlag, dpFlag; let wdFeeToken = null;
    let wdTokenFlag, wdPairFlag, dpTokenFlag, dpPairFlag; // detail per entitas
    try {
      const list = (Array.isArray(window.singleChainTokensCurrent) && window.singleChainTokensCurrent.length)
        ? window.singleChainTokensCurrent
        : (Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : []);
      // Flattened data disimpan sebagai (symbol_in = TOKEN, symbol_out = PAIR).
      // Saat arah Pair→Token, Name_in=PAIR dan Name_out=TOKEN → perlu dibalik untuk pencarian.
      const keyIn  = (direction === 'tokentopair') ? upper(Name_in)  : upper(Name_out);  // TOKEN (selalu TOKEN)
      const keyOut = (direction === 'tokentopair') ? upper(Name_out) : upper(Name_in);   // PAIR  (selalu PAIR)
      const hit = (list || []).find(t => String(t.cex).toUpperCase() === CEX
        && String(t.symbol_in).toUpperCase() === keyIn
        && String(t.symbol_out).toUpperCase() === keyOut
        && String(t.chain).toLowerCase() === String(nameChain).toLowerCase());
      if (hit) {
        // WD selalu refer ke TOKEN; DP juga selalu refer ke TOKEN (konsisten)
        wdFlag = hit.withdrawToken;
        wdFeeToken = Number(hit.feeWDToken || 0);
        dpFlag = hit.depositToken;
        // Simpan status detail
        wdTokenFlag = hit.withdrawToken;
        wdPairFlag  = hit.withdrawPair;
        dpTokenFlag = hit.depositToken;
        dpPairFlag  = hit.depositPair;
      }
    } catch(_) {}

    const f = (v) => (v===true ? 'ON' : (v===false ? 'OFF' : '?'));
    const sep = '======================================';
    const coinLine = (direction === 'tokentopair')
      ? `${upper(Name_in)} => ${upper(Name_out)} on ${String(nameChain).toUpperCase()}`
      : `${upper(Name_out)} => ${upper(Name_in)} on ${String(nameChain).toUpperCase()}`;
    const procLine = (direction === 'tokentopair') ? `${CEX} => ${DEX}` : `${DEX} => ${CEX}`;
    // Simbol tetap (token/pair) terlepas dari arah
    const tokenSym = (direction === 'tokentopair') ? upper(Name_in)  : upper(Name_out);
    const pairSym  = (direction === 'tokentopair') ? upper(Name_out) : upper(Name_in);

    // Console logging (Time/ID Cell/Proses/PNL dsb.) dipindahkan ke layer scanner untuk
    // menambahkan informasi status DEX dan sumber (VIA LIFI/SWOOP/DEX). Bagian ini
    // dihapus agar tidak terjadi duplikasi log dan agar informasi tetap konsisten.
  } catch(_) {}

  // Fee & info (WD/DP sesuai arah) — FEE SWAP PISAH BARIS
  // WD link mengikuti arah (Token→Pair menggunakan withdrawTokenUrl) → sudah sesuai kebutuhan FARM(WD)
  const wdUrl = cexLinks.withdraw;
  // DP harus selalu berbasis TOKEN yang disetor ke CEX.
  // Untuk Token→Pair, token = Name_in; untuk Pair→Token, token = Name_out.
  const tokenForDeposit = (direction === 'tokentopair') ? upper(Name_in) : upper(Name_out);
  // Ambil ulang link CEX khusus untuk token yang akan didepositkan agar DP selalu milik TOKEN (contoh: FARM)
  const urlsForTokenDeposit = (typeof GeturlExchanger === 'function')
    ? GeturlExchanger(upper(cex), tokenForDeposit, (direction === 'tokentopair') ? upper(Name_out) : upper(Name_in))
    : {};
  const dpUrlToken = (urlsForTokenDeposit && (urlsForTokenDeposit.depositTokenUrl || urlsForTokenDeposit.depositUrl))
    ? (urlsForTokenDeposit.depositTokenUrl || urlsForTokenDeposit.depositUrl)
    : (urls && (urls.depositTokenUrl || urls.depositUrl))
      ? (urls.depositTokenUrl || urls.depositUrl)
      : cexLinks.deposit;
  // Tentukan status WD/DP dari token aktif (lihat data tersimpan)
  let wdFlag, dpFlag;
  try {
    const list = (Array.isArray(window.singleChainTokensCurrent) && window.singleChainTokensCurrent.length)
      ? window.singleChainTokensCurrent
      : (Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : []);
    const keyIn2  = (direction === 'tokentopair') ? upper(Name_in)  : upper(Name_out);  // TOKEN
    const keyOut2 = (direction === 'tokentopair') ? upper(Name_out) : upper(Name_in);   // PAIR
    const hit = (list || []).find(t => String(t.cex).toUpperCase() === upper(cex)
      && String(t.symbol_in).toUpperCase() === keyIn2
      && String(t.symbol_out).toUpperCase() === keyOut2
      && String(t.chain).toLowerCase() === String(nameChain).toLowerCase());
    if (hit) {
      wdFlag = hit.withdrawToken; // WD selalu berdasarkan TOKEN
      // DP selalu berdasarkan TOKEN (samakan warna/teks untuk semua arah)
      dpFlag = hit.depositToken;
    }
  } catch(_) {}
  const wdText = (wdFlag === false) ? '🈳 WX' : '🈳 WD';
  // Nama token untuk label DP Token (arah-sensitive: TokenToPair → Name_in, PairToToken → Name_out)
  const dpTokenName = (direction === 'tokentopair') ? upper(Name_in) : upper(Name_out);
  const dpText = (dpFlag === false) ? `🈷️ DX[${dpTokenName}]` : `🈷️ DP[${dpTokenName}]`;
  const wdCls  = (wdFlag === false) ? 'uk-text-danger' : 'uk-text-primary';
  const dpCls  = (dpFlag === false) ? 'uk-text-danger' : 'uk-text-primary';
  const wdLine   = `<a class="${wdCls}" href="${wdUrl}" target="_blank" rel="noopener" title="FEE WITHDRAW">${wdText}: ${n(FeeWD).toFixed(4)}$</a>`;
  const dpLine   = `<a class="${dpCls}" href="${dpUrlToken}" target="_blank" rel="noopener">${dpText}</a>`;
  const swapLine = `<span class="monitor-line uk-text-danger" title="FEE SWAP">💸 SW: ${n(FeeSwap).toFixed(4)}$</span>`;

  const feeLine  = (direction === 'tokentopair') ? wdLine : dpLine;

  // Highlight + UIkit
  const netClass = (pnl >= 0) ? 'uk-text-success' : 'uk-text-danger';
  const bracket  = `[${bruto.toFixed(2)} ~ ${feeAll.toFixed(2)}]`;

  const shouldHighlight = isHighlight || (pnl > feeAll);
  const chainColorHexHL = getChainColorHexByName(nameChain);
  const modeNowHL = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
  const isMultiModeHL = String(modeNowHL.type).toLowerCase() !== 'single';
  // Multichain: gunakan hijau muda agar konsisten
  const multiLightGreen = '#bafaba';
  const hlBg = isMultiModeHL
    ? multiLightGreen
    : (isDarkMode() ? '#d8ff41' : '#bafaba');
  // Tambahkan kelas agar CSS bisa override tambahan saat dark-mode
  if (shouldHighlight) { try { $mainCell.addClass('dex-cell-highlight'); } catch(_) {}
  } else { try { $mainCell.removeClass('dex-cell-highlight'); } catch(_) {} }
  $mainCell.attr('style', shouldHighlight
    ? `background-color:${hlBg}!important;font-weight:bolder!important;vertical-align:middle!important;text-align:center!important; border:1px solid black !important;`
    : 'text-align:center;vertical-align:middle;');

  // Baris utama (SWAP dipisah baris sendiri)
  const lineBuy   = `<a class="monitor-line uk-text-success dex-price-link" href="${buyLink}"  target="_blank" rel="noopener" title="${tipBuy}">⬆ ${fmtUSD(buyPrice)}</a>`;
  const lineSell  = `<a class="monitor-line uk-text-danger  dex-price-link" href="${sellLink}" target="_blank" rel="noopener" title="${tipSell}">⬇ ${fmtUSD(sellPrice)}</a>`;
  const feeBlock1 = `<span class="monitor-line">${feeLine}</span>`;
  const feeBlock2 = `<span class="monitor-line">${swapLine}</span>`; // ← baris terpisah
  const lineBrut  = `<span class="monitor-line uk-text-muted" title="BRUTO ~ TOTAL FEE">${bracket}</span>`;
  const linePNL   = `<span class="monitor-line ${netClass}" title="PROFIT / LOSS">💰 PNL: ${pnl.toFixed(2)}</span>`;

  const resultHtml = [lineBuy, lineSell, feeBlock1, '', feeBlock2, lineBrut, linePNL].join(' ');

  // Panel sinyal / Telegram (opsional) — kondisi selaras dengan highlight/filter // REFACTORED
  const passSignal = (!checkVol && passPNL) || (checkVol && passPNL && volOK);
  if (passSignal && typeof InfoSinyal === 'function') {
    InfoSinyal(lower(dextype), NameX, pnl, feeAll, upper(cex), Name_in, Name_out, profitLossPercent, Modal, nameChain, codeChain, trx, idPrefix, baseId);
  }

    // --- Ambil status WD/DP detail untuk TOKEN & PAIR (sekali saja)
  let wdTokenFlag, wdPairFlag, dpTokenFlag, dpPairFlag;
  try {
    const list = (Array.isArray(window.singleChainTokensCurrent) && window.singleChainTokensCurrent.length)
      ? window.singleChainTokensCurrent
      : (Array.isArray(window.currentListOrderMulti) ? window.currentListOrderMulti : []);
    // TOKEN selalu = Name_in saat tokentopair, dan = Name_out saat pairtotoken
    const keyToken = (direction === 'tokentopair') ? upper(Name_in) : upper(Name_out);
    const keyPair  = (direction === 'tokentopair') ? upper(Name_out) : upper(Name_in);
    const hit = (list || []).find(t => String(t.cex).toUpperCase() === upper(cex)
      && String(t.symbol_in).toUpperCase() === keyToken
      && String(t.symbol_out).toUpperCase() === keyPair
      && String(t.chain).toLowerCase() === String(nameChain).toLowerCase());
    if (hit) {
      wdTokenFlag = hit.withdrawToken;
      wdPairFlag  = hit.withdrawPair;
      dpTokenFlag = hit.depositToken;
      dpPairFlag  = hit.depositPair;
    }
  } catch(_) {}

  // Telegram alert mengikuti kondisi yang sama agar konsisten // REFACTORED
    if (typeof MultisendMessage === 'function' && passSignal) {
    const directionMsg = (direction === 'tokentopair') ? 'cex_to_dex' : 'dex_to_cex';
    const tokenData = {
      chain: nameChain,
      symbol: Name_in,
      pairSymbol: Name_out,
      contractAddress: sc_input,
      pairContractAddress: sc_output
    };
    const nickname = (typeof getFromLocalStorage === 'function')
      ? (getFromLocalStorage('SETTING_SCANNER', {})?.nickname || '')
      : (typeof SavedSettingData !== 'undefined' ? (SavedSettingData?.nickname || '') : '');

    // Kirim status yang sama agar Telegram = Kolom
    const statusOverrides = {
      depositToken : dpTokenFlag,
      withdrawToken: wdTokenFlag,
      depositPair  : dpPairFlag,
      withdrawPair : wdPairFlag,
    };

    MultisendMessage(
      upper(cex), dextype, tokenData, Modal, pnl,
      n(buyPrice), n(sellPrice), n(FeeSwap), n(FeeWD), feeAll, nickname, directionMsg,
      statusOverrides // ← tambahan baru
    );
  }


  // Render akhir
  const dexNameAndModal = ($mainCell.find('strong').first().prop('outerHTML')) || '';
  const modeNow = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
  const resultWrapClass = (lower(modeNow.type) === 'single') ? 'uk-text-dark' : 'uk-text-primary';
  const boldStyle = shouldHighlight ? 'font-weight:bolder;' : '';

  $mainCell.html(`${dexNameAndModal ? dexNameAndModal + '<br>' : ''}<span class="${resultWrapClass}" style="${boldStyle}">${resultHtml}</span>`);
  try {
    el.dataset.final = '1';
    el.dataset.finalSuccess = '1';  // Mark as successful (cannot be overridden)
    delete el.dataset.finalError;    // Clear any prior error flag
    // clear any pending checking metadata so sweepers/tickers stop
    try { delete el.dataset.deadline; } catch(_) {}
    try { delete el.dataset.checking; } catch(_) {}
  } catch(_) {}
}

function InfoSinyal(DEXPLUS, TokenPair, PNL, totalFee, cex, NameToken, NamePair, profitLossPercent, modal, nameChain, codeChain, trx, idPrefix, domIdOverride) {
  const chainData = getChainData(nameChain);
  const chainShort = String(chainData?.SHORT_NAME || chainData?.Nama_Chain || nameChain).toUpperCase();
  const warnaChain = String(chainData?.COLOR_CHAIN || chainData?.WARNA || '#94fa95');
  const filterPNLValue = (typeof getPNLFilter === 'function') ? getPNLFilter() : parseFloat(SavedSettingData.filterPNL);
  const warnaCEX = getWarnaCEX(cex);
  const warnaTeksArah = (trx === "TokentoPair") ? "uk-text-success" : "uk-text-danger";
  const baseIdComputed = (`${String(cex||'').toUpperCase()}_${String(DEXPLUS||'').toUpperCase()}_${String(NameToken||'').toUpperCase()}_${String(NamePair||'').toUpperCase()}_${String(nameChain||'').toUpperCase()}`)
    .replace(/[^A-Z0-9_]/g,'');
  const baseId = domIdOverride ? String(domIdOverride) : baseIdComputed;
  const modeNowSig = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
  const isMultiSig = String(modeNowSig.type).toLowerCase() !== 'single';
  const multiLightGreen = '#bafaba';
  // Multichain: pakai hijau muda; per‑chain: gunakan tema normal (kuning terang untuk dark, rgba warna chain untuk light)
  const signalBg = isMultiSig
    ? multiLightGreen
    : (isDarkMode() ? '#d8ff41' :'#bafaba');
  const highlightStyle = (Number(PNL) > filterPNLValue)
    ? `background-color:${signalBg}; font-weight:bolder;`
    : "";

  const modeNow2 = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
  const isSingleMode2 = String(modeNow2.type).toLowerCase() === 'single';
  const chainPart = isSingleMode2 ? '' : ` <span style="color:${warnaChain};">[${chainShort}]</span>`;

  // Item sinyal: kompak + border kanan (separator)
  const sLink = `
    <div class="signal-item uk-flex uk-flex-middle uk-flex-nowrap uk-text-small uk-padding-remove-vertical" >
      <a href="#${idPrefix}${baseId}" class="uk-link-reset" style="text-decoration:none; font-size:12px; margin-top:2px; margin-left:4px;">
        <span class="${Number(PNL) > filterPNLValue ? 'signal-highlight' : ''}" style="color:${warnaCEX}; ${highlightStyle}; display:inline-block;">
          🔸 ${String(cex).slice(0,3).toUpperCase()}X
          <span class="uk-text-dark">:${modal}</span>
          <span class="${warnaTeksArah}"> ${NameToken}->${NamePair}</span>${chainPart}:
          <span class="uk-text-dark">${Number(PNL).toFixed(2)}$</span>
        </span>
      </a>
    </div>`;

  $("#sinyal" + DEXPLUS.toLowerCase()).append(sLink);

  // Pastikan kartu sinyal DEX utama terlihat ketika ada item sinyal // REFACTORED
  if (typeof window !== 'undefined' && typeof window.showSignalCard === 'function') {
    window.showSignalCard(DEXPLUS.toLowerCase());
  }

  const audio = new Audio('audio.mp3');
  audio.play();
} 

/**
 * Compute rates, value, and PNL for a DEX route result; return data for DisplayPNL.
 */
function calculateResult(baseId, tableBodyId, amount_out, FeeSwap, sc_input, sc_output, cex, Modal, amount_in, priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX, Name_in, Name_out, feeWD, dextype,nameChain,codeChain, trx, vol,DataDEX) {
    const NameX = Name_in + "_" + Name_out;
    const FeeWD = parseFloat(feeWD);
    const FeeTrade = parseFloat(0.0014 * Modal);

    FeeSwap = parseFloat(FeeSwap) || 0;
    Modal = parseFloat(Modal) || 0;
    amount_in = parseFloat(amount_in) || 0;
    amount_out = parseFloat(amount_out) || 0;
    priceBuyToken_CEX = parseFloat(priceBuyToken_CEX) || 0;
    priceSellToken_CEX = parseFloat(priceSellToken_CEX) || 0;
    priceBuyPair_CEX = parseFloat(priceBuyPair_CEX) || 0;
    priceSellPair_CEX = parseFloat(priceSellPair_CEX) || 0;

    // Early guards for numeric validity to avoid NaN/Infinity propagation
    const idPrefix = tableBodyId + '_';
    const toId = () => String(baseId || '').replace(/[^A-Z0-9_]/g,'');
    const errorPayload = (msg) => ({ type: 'error', id: idPrefix + toId(), message: msg });
    const isPos = v => Number.isFinite(v) && v >= 0;
    const isPosStrict = v => Number.isFinite(v) && v > 0;

    if (!isPosStrict(amount_in)) return errorPayload('Amount_in tidak valid');
    if (!isPos(amount_out)) return errorPayload('Amount_out tidak valid');

    const rateTokentoPair = (amount_in > 0) ? (amount_out / amount_in) : 0;
    const ratePairtoToken = (amount_out > 0) ? (amount_in / amount_out) : 0;

    const totalModal = Modal + FeeSwap + FeeWD + FeeTrade;
    const totalFee = FeeSwap + FeeWD + FeeTrade;

    let totalValue = 0;
    if (trx === "TokentoPair") {
        if (priceSellPair_CEX > 0) totalValue = amount_out * priceSellPair_CEX;
        else if (priceBuyToken_CEX > 0) totalValue = amount_in * priceBuyToken_CEX;
        else totalValue = amount_out;
    } else {
        if (priceSellToken_CEX > 0) totalValue = amount_out * priceSellToken_CEX;
        else if (priceBuyPair_CEX > 0) totalValue = amount_in * priceBuyPair_CEX;
        else totalValue = amount_out;
    }

    // Validate totals before computing PNL
    if (!(Number.isFinite(totalModal) && Number.isFinite(totalFee) && Number.isFinite(totalValue))) {
        return errorPayload('Perhitungan nilai/fee tidak valid');
    }
    const profitLoss = totalValue - totalModal;
    const profitLossPercent = totalModal !== 0 ? (profitLoss / totalModal) * 100 : 0;

    const linkDEX = generateDexLink(
        dextype,
        nameChain,
        codeChain,
        Name_in,
        sc_input,
        Name_out,
        sc_output
    ) || '#';

    let displayRate, tooltipRate, tooltipText;
    tooltipRate = rateTokentoPair;
    tooltipText = `1 ${Name_in} ≈ ${tooltipRate.toFixed(6)} ${Name_out}`;

    // New: DEX-based USD rate where possible (both directions)
    // Compute displayRate using safe checks (no try/catch) // REFACTORED
    const stableSet = (typeof getStableSymbols === 'function') ? getStableSymbols() : ['USDT','USDC','DAI'];
    const outSym = String(Name_out||'').toUpperCase();
    const inSym  = String(Name_in||'').toUpperCase();
    const baseSym = (typeof getBaseTokenSymbol === 'function') ? getBaseTokenSymbol(nameChain) : '';
    const baseUsd = (typeof getBaseTokenUSD === 'function') ? getBaseTokenUSD(nameChain) : 0;

    if (trx === 'TokentoPair') {
        // token -> pair
        if (stableSet.includes(outSym)) {
            // Output already in stable → amount_out is USD directly per 1 token_in
            displayRate = rateTokentoPair;
        } else if (baseSym && outSym === baseSym && baseUsd > 0) {
            // token -> base → multiply by base USD
            displayRate = rateTokentoPair * baseUsd;
        } else if (priceBuyPair_CEX > 0) {
            // Output non-stable, non-base (BNT, 1INCH, dll) → multiply rate dengan CEX pair price
            displayRate = rateTokentoPair * priceBuyPair_CEX;
        }
    } else {
        // pair -> token (we want USD per 1 token_out)
        if (rateTokentoPair > 0) {
            if (stableSet.includes(inSym)) {
                // Input already USD → price per token = 1 / tokens_per_USD
                displayRate = 1 / rateTokentoPair;
            } else if (baseSym && inSym === baseSym && baseUsd > 0) {
                // Input base coin → price per token = (baseUSD) / tokens_per_base
                displayRate = baseUsd / rateTokentoPair;
            } else if (priceBuyPair_CEX > 0) {
                // Multi-hop via CEX USD per pair: USD/token = (USD per 1 pair) / (tokens per 1 pair)
                displayRate = priceBuyPair_CEX / rateTokentoPair;
            }
        }
    }

    // Fallback if DEX-based USD rate not resolved
    // - TokentoPair: USD/token = (pair per token) * (USD per 1 pair)
    // - PairtoToken: USD/token = langsung harga CEX token (hindari mengalikan hingga jadi USD per PAIR)
    if (!Number.isFinite(displayRate) || displayRate <= 0) {
        if (trx === 'TokentoPair') {
            // FIX: Multiply rateTokentoPair dengan priceSellPair_CEX untuk konversi ke USDT
            displayRate = (rateTokentoPair > 0 && priceSellPair_CEX > 0)
                ? rateTokentoPair * priceSellPair_CEX
                : (priceBuyToken_CEX > 0 ? priceBuyToken_CEX : rateTokentoPair || 0);
        } else {
            displayRate = priceSellToken_CEX > 0
                ? priceSellToken_CEX
                : (priceBuyPair_CEX > 0 ? priceBuyPair_CEX : (rateTokentoPair > 0 ? (1 / rateTokentoPair) : 0));
        }
    }

    if (!Number.isFinite(displayRate) || displayRate < 0) {
        return errorPayload('Harga DEX (USD/token) tidak valid');
    }

    const rateIdr = (typeof formatIDRfromUSDT === 'function') ? formatIDRfromUSDT(displayRate) : 'N/A';
    const rateLabel = `<label class="uk-text-primary" title="${tooltipText} | ${formatPrice(displayRate)} | ${rateIdr}">${formatPrice(displayRate)}</label>`;
    const swapHtml = `<a href="${linkDEX}" target="_blank">${rateLabel}</a>`;
    // debug logs removed

    // REFACTORED: Tambahkan info sumber alternatif dari DataDEX
    const isFallback = DataDEX && DataDEX.isFallback === true;
    const fallbackSource = DataDEX && DataDEX.fallbackSource ? String(DataDEX.fallbackSource) : '';

    return {
        type: 'update',
        idPrefix: idPrefix,
        baseId: String(baseId || '').replace(/[^A-Z0-9_]/g,''),
        swapHtml: swapHtml,
        linkDEX: linkDEX,
        dexUsdRate: displayRate,
        profitLoss, cex, Name_in, NameX, totalFee, Modal, dextype,
        priceBuyToken_CEX, priceSellToken_CEX, priceBuyPair_CEX, priceSellPair_CEX,
        FeeSwap, FeeWD, sc_input, sc_output, Name_out, totalValue, totalModal,
        nameChain, codeChain, trx, profitLossPercent, vol,
        isFallback, fallbackSource  // REFACTORED: Tambahkan info sumber alternatif
    };
}

// Optional namespacing for future modular use // REFACTORED
if (typeof window !== 'undefined' && window.App && typeof window.App.register === 'function') {
    window.App.register('DOM', {
        loadKointoTable,
        renderTokenManagementList,
        InfoSinyal,
        calculateResult
    });
}

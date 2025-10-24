// =================================================================================
// SCANNER LOGIC
// =================================================================================
/**
 * Memastikan sebuah sel DEX memiliki elemen <span> untuk menampilkan status.
 * Jika belum ada, fungsi ini akan membuatnya dan menambahkannya ke dalam sel.
 * Ini menjaga struktur DOM tetap konsisten untuk pembaruan status.
 * @param {HTMLElement} cell - Elemen <td> dari sel DEX.
 * @returns {HTMLElement|null} Elemen <span> untuk status, atau null jika sel tidak valid.
 */
function ensureDexStatusSpan(cell) {
    // Jika sel tidak ada, kembalikan null.
    if (!cell) return null;
    // Cari span status yang sudah ada.
    let statusSpan = cell.querySelector('.dex-status');
    // Jika sudah ada, langsung kembalikan.
    if (statusSpan) return statusSpan;
    const strong = cell.querySelector('strong');
    if (strong) {
        const br = document.createElement('br');
        strong.insertAdjacentElement('afterend', br);
        statusSpan = document.createElement('span');
        statusSpan.className = 'dex-status';
        br.insertAdjacentElement('afterend', statusSpan);
        return statusSpan;
    }
    // Jika tidak ada elemen <strong>, buat span baru dan tambahkan di akhir sel.
    statusSpan = document.createElement('span');
    statusSpan.className = 'dex-status';
    cell.appendChild(statusSpan);
    return statusSpan;
}

/**
 * Mengatur latar belakang sel menjadi merah untuk menandakan error.
 * Menggunakan kelas CSS 'dex-error' agar bisa di-styling secara terpusat,
 * termasuk untuk mode gelap (dark mode).
 * @param {HTMLElement} cell - Elemen <td> dari sel DEX yang error.
 */
function setDexErrorBackground(cell) {
    if (!cell) return;
    try { cell.classList.add('dex-error'); } catch(_) {}
}

// REMOVED: Watchdog functions removed as per user request

/**
 * Menghapus/membersihkan interval timer countdown (misal: "Checking (4s)" atau "SWOOP (3s)")
 * yang terkait dengan sebuah sel DEX.
 * @param {string} id - ID dari sel DEX.
 */
function clearDexTickerById(id){
    try {
        window._DEX_TICKERS = window._DEX_TICKERS || new Map();
        const key = String(id) + ':ticker';
        if (window._DEX_TICKERS.has(key)) {
            // Hapus interval timer.
            clearInterval(window._DEX_TICKERS.get(key));
            window._DEX_TICKERS.delete(key);
        }
    } catch(_) {}
}

// Variabel global untuk mengelola state pemindaian.
// ID untuk loop `requestAnimationFrame` yang meng-update UI.
let animationFrameId;
// Flag boolean yang menandakan apakah proses pemindaian sedang berjalan atau tidak.
// NOTE: Ini adalah per-tab state, tidak akan conflict dengan tab lain
let isScanRunning = false;
// Counter untuk melacak jumlah request DEX yang masih berjalan (termasuk fallback).
let activeDexRequests = 0;
// Resolver yang menunggu seluruh request DEX selesai sebelum finalisasi.
let dexRequestWaiters = [];

/**
 * Helper function untuk check apakah tab ini sedang scanning
 * Menggunakan sessionStorage untuk per-tab isolation
 */
function isThisTabScanning() {
    try {
        // Check internal flag
        if (isScanRunning) return true;

        // Check session storage sebagai backup
        if (typeof sessionStorage !== 'undefined') {
            const tabScanning = sessionStorage.getItem('TAB_SCANNING');
            return tabScanning === 'YES';
        }

        return false;
    } catch(e) {
        return isScanRunning;
    }
}

function markDexRequestStart() {
    try { activeDexRequests += 1; } catch(_) { activeDexRequests = 1; }
}

function markDexRequestEnd() {
    try {
        activeDexRequests = Math.max(0, activeDexRequests - 1);
        if (activeDexRequests === 0 && dexRequestWaiters.length > 0) {
            const waiters = dexRequestWaiters.slice();
            dexRequestWaiters.length = 0;
            waiters.forEach(fn => {
                try { fn(); } catch(_) {}
            });
        }
    } catch(_) {}
}

function waitForPendingDexRequests(timeoutMs = 8000) {
    if (activeDexRequests === 0) return Promise.resolve();
    return new Promise((resolve) => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
        try { dexRequestWaiters.push(done); } catch(_) { dexRequestWaiters = [done]; }
        if (timeoutMs > 0) {
            setTimeout(() => {
                if (settled) return;
                settled = true;
                try {
                    const idx = dexRequestWaiters.indexOf(done);
                    if (idx !== -1) dexRequestWaiters.splice(idx, 1);
                } catch(_) {}
                resolve();
            }, timeoutMs);
        }
    });
}

/**
 * Mengubah judul halaman untuk menandakan pemindaian sedang aktif.
 * Ini hanya berlaku untuk mode single-chain untuk memberikan feedback visual yang jelas.
 * @param {boolean} running - True jika pemindaian sedang berjalan.
 */
function setPageTitleForRun(running){
    try {
        const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
        if (String(m.type||'').toLowerCase() !== 'single') return; // only affect per-chain pages
        if (running) {
            if (!window.__ORIG_TITLE) window.__ORIG_TITLE = document.title;
            document.title = 'SCANNING..';
        } else {
            if (window.__ORIG_TITLE) { document.title = window.__ORIG_TITLE; }
            window.__ORIG_TITLE = null;
        }
    } catch(_) {}
}

/**
 * Kumpulan fungsi untuk mengelola tooltip (title) pada sel DEX.
 * Tooltip ini digunakan untuk menampilkan log detail dari proses kalkulasi.
 */

/**
 * Mengatur teks tooltip untuk sebuah elemen sel.
 * @param {HTMLElement} cell - Elemen sel.
 * @param {string} text - Teks tooltip yang akan diatur.
 */
function setCellTitleByEl(cell, text){
    try {
        cell.dataset.titleLog = String(text || '');
        cell.setAttribute('title', cell.dataset.titleLog);
        // Juga terapkan pada span status di dalamnya agar tooltip konsisten.
        const span = cell.querySelector('.dex-status');
        if (span) span.setAttribute('title', cell.dataset.titleLog);
    } catch(_) {}
}
/**
 * Menambahkan baris baru ke teks tooltip yang sudah ada pada sebuah elemen sel.
 * @param {HTMLElement} cell - Elemen sel.
 * @param {string} line - Baris teks baru yang akan ditambahkan.
 */
function appendCellTitleByEl(cell, line){
    try {
        const prev = cell.dataset && cell.dataset.titleLog ? String(cell.dataset.titleLog) : '';
        const next = prev ? (prev + '\n' + String(line||'')) : String(line||'');
        setCellTitleByEl(cell, next);
    } catch(_) {}
}
/**
 * Menambahkan baris baru ke teks tooltip berdasarkan ID sel.
 * @param {string} id - ID elemen sel.
 * @param {string} line - Baris teks baru.
 */
function appendCellTitleById(id, line){
    const cell = document.getElementById(id);
    if (!cell) return;
    appendCellTitleByEl(cell, line);
}
/**
 * Start the scanning process for a flattened list of tokens.
 * - Batches tokens per group (scanPerKoin)
 * - For each token: fetch CEX orderbook → quote DEX routes → compute PNL → update UI
 */
async function startScanner(tokensToScan, settings, tableBodyId) {
    // Batalkan countdown auto-run yang mungkin sedang berjalan saat scan baru dimulai.
    clearInterval(window.__autoRunInterval);
    window.__autoRunInterval = null;
    $('#autoRunCountdown').text('');

    // Ambil konfigurasi scan dari argumen.
    const ConfigScan = settings;
    // Dapatkan mode aplikasi saat ini (multi-chain atau single-chain).
    const mMode = getAppMode();
    let allowedChains = [];
    // Tentukan chain mana saja yang aktif berdasarkan mode.
    if (mMode.type === 'single') {
        allowedChains = [String(mMode.chain).toLowerCase()];
    } else {
        const fm = getFilterMulti();
        allowedChains = (fm.chains && fm.chains.length)
            // Jika ada filter chain, gunakan itu.
            ? fm.chains.map(c => String(c).toLowerCase())
            // Jika tidak, gunakan semua chain dari konfigurasi.
            : Object.keys(CONFIG_CHAINS || {});
    }

    if (!allowedChains || !allowedChains.length) {
        if (typeof toast !== 'undefined' && toast.warning) toast.warning('Tidak ada Chain yang dipilih. Silakan pilih minimal 1 Chain.');
        return;
    }

    // Simpan data setting dan chain aktif ke variabel global untuk diakses oleh fungsi lain.
    window.SavedSettingData = ConfigScan;
    window.CURRENT_CHAINS = allowedChains;

    // Tentukan daftar DEX yang aktif dan "kunci" daftar ini selama proses scan.
    // Ini memastikan struktur kolom tabel tidak berubah di tengah jalan.
    let allowedDexs = [];
    try { allowedDexs = (typeof window.resolveActiveDexList === 'function') ? window.resolveActiveDexList() : []; } catch(_) { allowedDexs = []; }
    try { if (typeof window !== 'undefined') window.__LOCKED_DEX_LIST = (allowedDexs || []).slice(); } catch(_) {}

    // Filter daftar token yang akan dipindai:
    // 1. Token harus berada di salah satu chain yang diizinkan.
    // 2. Token harus memiliki minimal satu DEX yang juga aktif di filter.
    const flatTokens = tokensToScan
        .filter(t => allowedChains.includes(String(t.chain).toLowerCase()))
        .filter(t => {
            try { return (Array.isArray(t.dexs) && t.dexs.some(d => allowedDexs.includes(String(d.dex||'').toLowerCase()))); } catch(_) { return true; }
        });

    // Jika tidak ada token yang lolos filter, hentikan proses dan beri notifikasi.
    if (!flatTokens || flatTokens.length === 0) {
        if (typeof toast !== 'undefined' && toast.info) toast.info('Tidak ada token pada chain terpilih untuk dipindai.');
        return;
    }

    // Siapkan "kerangka" tabel monitoring (header dan semua baris token).
    // Ini penting agar sel-sel tujuan untuk update UI sudah ada sebelum kalkulasi dimulai.
    try {
        const bodyId = tableBodyId || 'dataTableBody';
        if (typeof window.prepareMonitoringSkeleton === 'function') {
            window.prepareMonitoringSkeleton(flatTokens, bodyId);
        } else if (typeof window.renderMonitoringHeader === 'function' && typeof window.computeActiveDexList === 'function') {
            window.renderMonitoringHeader(window.computeActiveDexList());
        }
    } catch(_) {}

    // --- PERSIAPAN STATE & UI SEBELUM SCAN ---

    // === CHECK GLOBAL SCAN LOCK ===
    try {
        const lockCheck = typeof checkCanStartScan === 'function' ? checkCanStartScan() : { canScan: true };

        if (!lockCheck.canScan) {
            // console.warn('[SCANNER] Cannot start scan - locked by another tab:', lockCheck.lockInfo);

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

            // Reset UI state
            $('#startSCAN').prop('disabled', false).text('START').removeClass('uk-button-disabled');
            return; // Exit early - don't start scan
        }
    } catch(e) {
        // console.error('[SCANNER] Error checking global scan lock:', e);
        // On error checking lock, allow scan to proceed
    }

    // === SET GLOBAL SCAN LOCK ===
    try {
        const mode = getAppMode();
        const chainLabel = allowedChains.map(c => String(c).toUpperCase()).join(', ');
        const filterKey = getActiveFilterKey();

        const lockAcquired = typeof setGlobalScanLock === 'function'
            ? setGlobalScanLock(filterKey, {
                tabId: typeof getTabId === 'function' ? getTabId() : null,
                mode: mode.type === 'multi' ? 'MULTICHAIN' : (mode.chain || 'UNKNOWN').toUpperCase(),
                chain: chainLabel
            })
            : true;

        if (!lockAcquired) {
            // console.error('[SCANNER] Failed to acquire global scan lock');
            if (typeof toast !== 'undefined' && toast.error) {
                toast.error('Gagal memulai scan - ada scan lain yang berjalan');
            }
            $('#startSCAN').prop('disabled', false).text('START').removeClass('uk-button-disabled');
            return; // Exit early
        }

        // console.log('[SCANNER] Global scan lock acquired:', filterKey);

        // Set per-tab scanning state (sessionStorage - per-tab isolation)
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('TAB_SCANNING', 'YES');
            sessionStorage.setItem('TAB_SCAN_CHAIN', chainLabel);
            sessionStorage.setItem('TAB_SCAN_START', Date.now().toString());
        }

        // Notify TabManager untuk broadcast ke tab lain
        if (window.TabManager && typeof window.TabManager.notifyScanStart === 'function') {
            window.TabManager.notifyScanStart(chainLabel);
            // console.log(`[SCANNER] Tab ${window.getTabId()} started scanning: ${chainLabel}`);
        }
    } catch(e) {
        // console.error('[SCANNER] Error setting scan start state:', e);
    }

    // Set state aplikasi menjadi 'berjalan' (run: 'YES').
    setAppState({ run: 'YES' });
    setPageTitleForRun(true);
    try {
        if (typeof window.updateRunStateCache === 'function') {
            try { window.updateRunStateCache(getActiveFilterKey(), { run: 'YES' }); } catch(_) {}
            // Mark each allowed chain as running to isolate per-chain state
            try { (allowedChains || []).forEach(c => window.updateRunStateCache(`FILTER_${String(c).toUpperCase()}`, { run: 'YES' })); } catch(_) {}
        }
        if (typeof window.updateRunningChainsBanner === 'function') {
            const m = getAppMode();
            const preListed = (m.type === 'single') ? [String(m.chain).toLowerCase()] : (allowedChains || []);
            window.updateRunningChainsBanner(preListed);
        }
        if (typeof window.updateToolbarRunIndicators === 'function') window.updateToolbarRunIndicators();
    } catch(_){}

    // Update tampilan tombol dan banner.
    $('#startSCAN').prop('disabled', true).text('Running...').addClass('uk-button-disabled');
    // Bersihkan kartu sinyal dari scan sebelumnya.
    $('#sinyal-container [id^="sinyal"]').empty();
    if (typeof window.hideEmptySignalCards === 'function') window.hideEmptySignalCards();

    // Nonaktifkan sebagian besar kontrol UI untuk mencegah perubahan konfigurasi saat scan.
    if (typeof setScanUIGating === 'function') setScanUIGating(true);
    form_off();
    $("#autoScrollCheckbox").show().prop('disabled', false);
    $("#stopSCAN").show().prop('disabled', false);
    $('.statusCheckbox').css({ 'pointer-events': 'auto', 'opacity': '1' }).prop('disabled', false);

    // Kirim notifikasi status 'ONLINE' ke Telegram.
    sendStatusTELE(ConfigScan.nickname, 'ONLINE');

    // Ambil parameter jeda dan kecepatan dari settings.
    let scanPerKoin = parseInt(ConfigScan.scanPerKoin || 1);
    let jedaKoin = parseInt(ConfigScan.jedaKoin || 500);
    let jedaTimeGroup = parseInt(ConfigScan.jedaTimeGroup || 1000);
    // Jeda tambahan agar urutan fetch mengikuti pola lama (tanpa mengubah logika hasil)
    // Catatan: gunakan nilai dari SETTING_SCANNER
    // - Jeda DEX: per-DEX dari ConfigScan.JedaDexs[dex] (Jeda CEX dihapus)
    let speedScan = Math.round(parseFloat(ConfigScan.speedScan || 2) * 1000);

    const jedaDexMap = (ConfigScan || {}).JedaDexs || {};
    const getJedaDex = (dx) => parseInt(jedaDexMap[dx]) || 0;

    // Fungsi helper untuk membuat jeda (delay).
    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    // Fungsi helper untuk memeriksa apakah checkbox posisi (KIRI/KANAN) dicentang.
    const isPosChecked = (val) => $('input[type="checkbox"][value="' + val + '"]').is(':checked');

    /**
     * Memperbarui progress bar dan teks status di UI.
     * @param {number} current - Jumlah item yang sudah diproses.
     * @param {number} total - Jumlah total item.
     * @param {number} startTime - Timestamp awal proses.
     * @param {string} TokenPair - Nama token yang sedang diproses.
     */
    function updateProgress(current, total, startTime, TokenPair) {
        let duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        let progressPercentage = Math.floor((current / total) * 100);
        let progressText = `CHECKING - ${TokenPair} [${current}/${total}] :: Mulai: ${new Date(startTime).toLocaleTimeString()} ~ DURASI [${duration} Menit]`;
        $('#progress-bar').css('width', progressPercentage + '%');
        $('#progress-text').text(progressPercentage + '%');
        $('#progress').text(progressText);
    }

    // `uiUpdateQueue` adalah antrian untuk semua tugas pembaruan UI.
    // Daripada memanipulasi DOM secara langsung setiap kali ada hasil,
    // objek hasil (sukses/error) dimasukkan ke array ini. `processUiUpdates`
    // akan mengambil dari antrian ini dan meng-update UI secara efisien
    // menggunakan `requestAnimationFrame` untuk mencegah browser lag.
    let uiUpdateQueue = [];

    // Pastikan update UI segera dijalankan saat tab kembali aktif (visible).
    try {
        if (typeof window !== 'undefined' && !window.__UI_VIS_LISTENER_SET__) {
            document.addEventListener('visibilitychange', () => {
                try { if (!document.hidden) processUiUpdates(); } catch(_) {}
            });
            window.__UI_VIS_LISTENER_SET__ = true;
        }
    } catch(_) {}

    // Jeda auto-scroll sementara jika pengguna berinteraksi dengan halaman
    // (scroll, klik, dll.) agar tidak mengganggu.
    try {
        if (typeof window !== 'undefined' && !window.__AUTO_SCROLL_SUSPENDER_SET__) {
            const suspend = () => { try { window.__AUTO_SCROLL_SUSPEND_UNTIL = Date.now() + 4000; } catch(_) {} };
            ['wheel','touchstart','mousedown','keydown'].forEach(ev => {
                try { window.addEventListener(ev, suspend, { passive: true }); } catch(_) {}
            });
            window.__AUTO_SCROLL_SUSPENDER_SET__ = true;
        }
    } catch(_) {}

    /**
     * Mengambil data order book dari CEX dengan mekanisme coba ulang (retry).
     * @param {object} token - Objek data token.
     * @param {string} tableBodyId - ID dari tbody tabel.
     * @param {object} options - Opsi tambahan (maxAttempts, delayMs).
     * @returns {Promise<{ok: boolean, data: object|null, error: any}>} Hasil fetch.
     */
    async function fetchCEXWithRetry(token, tableBodyId, options = {}) {
        const maxAttempts = Number(options.maxAttempts) > 0 ? Number(options.maxAttempts) : 3;
        const delayMs = Number(options.delayMs) >= 0 ? Number(options.delayMs) : 400;
        let attempts = 0;
        let lastError = null;
        let lastData = null;

        while (attempts < maxAttempts) {
            // Coba panggil getPriceCEX.
            try {
                const data = await getPriceCEX(token, token.symbol_in, token.symbol_out, token.cex, tableBodyId);
                lastData = data;
                const prices = [
                    data?.priceBuyToken,
                    data?.priceSellToken,
                    data?.priceBuyPair,
                    data?.priceSellPair
                ];
                // Validasi bahwa semua harga yang dibutuhkan adalah angka positif.
                const valid = prices.every(p => Number.isFinite(p) && Number(p) > 0);
                if (valid) {
                    return { ok: true, data };
                }
                lastError = 'Harga CEX tidak lengkap';
            } catch (error) {
                lastError = error;
            }
            // Jika gagal, tunggu sebentar sebelum mencoba lagi.
            attempts += 1;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        return { ok: false, data: lastData, error: lastError };
    }

    /**
     * Loop utama yang memproses antrian pembaruan UI (`uiUpdateQueue`).
     * Dijalankan menggunakan `requestAnimationFrame` untuk performa optimal.
     */
    function processUiUpdates() {
        // Jika scan sudah berhenti dan antrian kosong, hentikan loop.
        if (!isScanRunning && uiUpdateQueue.length === 0) return;

        const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        // Batas waktu eksekusi per frame (misal, 8ms) untuk menjaga UI tetap responsif.
        const budgetMs = 8; // aim to keep under one frame @120Hz
        let processed = 0;

        // "Penyapuan keamanan": Finalisasi sel DEX yang melewati batas waktu (timeout)
        // tapi belum di-update statusnya. Ini mencegah sel terjebak di status "Checking".
        try {
            const nowTs = Date.now();
            const cells = document.querySelectorAll('td[data-deadline]');
            cells.forEach(cell => {
                // Cek apakah deadline sudah lewat dan sel belum difinalisasi.
                try {
                    const d = Number(cell.dataset.deadline || 0);
                    const done = String(cell.dataset.final || '') === '1';
                    if (!done && d > 0 && nowTs - d > 250) {
                        const dexName = (cell.dataset.dex || '').toUpperCase() || 'DEX';
                        // stop any lingering ticker for this cell
                        try { clearDexTickerById(cell.id); } catch(_) {}
                        // Paksa finalisasi ke status TIMEOUT.
                        try { cell.classList.add('dex-error'); } catch(_) {}
                        const span = ensureDexStatusSpan(cell);
                        try {
                            span.classList.remove('uk-text-muted', 'uk-text-warning');
                            span.classList.add('uk-text-danger');
                            span.innerHTML = `<span class=\"uk-label uk-label-warning\">TIMEOUT</span>`;
                            span.title = `${dexName}: Request Timeout`;
                        } catch(_) {}
                        try { cell.dataset.final = '1'; delete cell.dataset.checking; delete cell.dataset.deadline; } catch(_) {}
                    }
                } catch(_) {}
            });
        } catch(_) {}

        // Proses item dari antrian selama masih ada dan budget waktu belum habis.
        if (uiUpdateQueue.length > 0) {
            //(`[PROCESS QUEUE] Processing ${uiUpdateQueue.length} items in queue`);
        }
        while (uiUpdateQueue.length) {
            const updateData = uiUpdateQueue.shift();
            if (updateData) {
               // console.log(`[PROCESS ITEM]`, { type: updateData?.type, id: updateData?.id || updateData?.idPrefix + updateData?.baseId });
            }
            // Jika item adalah error, update sel dengan pesan error.
            if (updateData && updateData.type === 'error') {
                const { id, message, swapMessage } = updateData;
                const cell = document.getElementById(id);
                if (cell) {
                    // Skip if already finalized by a successful result
                    try {
                        if (cell.dataset && cell.dataset.final === '1') {
                            processed++;
                            continue;
                        }
                    } catch(_) {}
                    // finalize error: stop ticker, mark final, clear checking/deadline
                    try { clearDexTickerById(id); } catch(_) {}
                    try { cell.dataset.final = '1'; delete cell.dataset.checking; delete cell.dataset.deadline; } catch(_) {}
                    setDexErrorBackground(cell);
                    let statusSpan = ensureDexStatusSpan(cell);
                    if (statusSpan) statusSpan.className = 'dex-status uk-text-danger';
                    statusSpan.classList.remove('uk-text-muted', 'uk-text-warning');
                    statusSpan.classList.add('uk-text-danger');
                    statusSpan.textContent = swapMessage || '[ERROR]';
                    statusSpan.title = message || '';
                }
            // Jika item adalah hasil sukses, panggil DisplayPNL untuk merender hasilnya.
            } else if (updateData) {
                DisplayPNL(updateData);
            }
            processed++;
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            // Jika waktu eksekusi melebihi budget, hentikan dan serahkan ke frame berikutnya.
            if ((now - start) >= budgetMs) break; // yield to next frame
        }

        // Jika halaman tidak terlihat (tab tidak aktif), `requestAnimationFrame` akan dijeda oleh browser.
        // Gunakan `setTimeout` sebagai fallback untuk memastikan UI tetap di-update.
        if (typeof document !== 'undefined' && document.hidden) {
            setTimeout(processUiUpdates, 150);
        } else {
            animationFrameId = requestAnimationFrame(processUiUpdates);
        }
    }

    /**
     * Memproses satu token: mengambil data CEX, lalu memproses semua DEX yang terkait.
     * @param {object} token - Objek data token yang akan diproses.
     * @param {string} tableBodyId - ID dari tbody tabel.
     */
    async function processRequest(token, tableBodyId) {
        if (!allowedChains.includes(String(token.chain).toLowerCase())) return;
        // Skip processing if token has been deleted during scanning
        try {
            const modeNow = getAppMode();
            let stillExists = false;
            if (modeNow.type === 'single') {
                const list = getTokensChain(modeNow.chain);
                stillExists = Array.isArray(list) && list.some(t => String(t.id) === String(token.id));
            } else {
                const list = getTokensMulti();
                stillExists = Array.isArray(list) && list.some(t => String(t.id) === String(token.id));
            }
            if (!stillExists) return; // token removed; do not fetch
        } catch(_) {}
        try {
            // 1. Ambil data harga dari CEX dengan mekanisme retry.
            const cexResult = await fetchCEXWithRetry(token, tableBodyId, { maxAttempts: 3, delayMs: 450 });
            const DataCEX = cexResult.data || {};

            // Jika pengambilan data CEX gagal setelah semua percobaan, tandai semua sel DEX sebagai error.
            if (!cexResult.ok) {
                if (typeof toast !== 'undefined' && toast.error) {
                    toast.error(`CEK MANUAL ${token.symbol_in} di ${token.cex}`);
                }
                try {
                    if (Array.isArray(token.dexs)) {
                        token.dexs.forEach((dd) => {
                            try { if (!allowedDexs.includes(String(dd.dex||'').toLowerCase())) return; } catch(_) {}
                            const dex = String(dd.dex||'').toLowerCase();
                            ['TokentoPair','PairtoToken'].forEach(dir => {
                                const isKiri = dir === 'TokentoPair';
                                // ID generation: include token ID for uniqueness
                                const sym1 = isKiri ? String(token.symbol_in).toUpperCase() : String(token.symbol_out).toUpperCase();
                                const sym2 = isKiri ? String(token.symbol_out).toUpperCase() : String(token.symbol_in).toUpperCase();
                                const tokenId = String(token.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                                const baseIdRaw = `${String(token.cex).toUpperCase()}_${String(dex).toUpperCase()}_${sym1}_${sym2}_${String(token.chain).toUpperCase()}_${tokenId}`;
                                const baseId = baseIdRaw.replace(/[^A-Z0-9_]/g,'');
                                const idCELL = tableBodyId + '_' + baseId;
                                const cell = document.getElementById(idCELL);
                                if (!cell) return;
                                setDexErrorBackground(cell);
                                const span = ensureDexStatusSpan(cell);
                                span.className = 'dex-status uk-text-danger';
                                span.innerHTML = `<span class=\"uk-label uk-label-danger\">ERROR5</span>`;
                                appendCellTitleByEl(cell, '[CEX] INVALID PRICES');
                                try { if (cell.dataset) cell.dataset.final = '1'; } catch(_) {}
                            });
                        });
                    }
                } catch(_) {}
                return;
            }

            // 2. Lanjut ke DEX tanpa jeda CEX terkonfigurasi (fitur dihapus)

            if (token.dexs && Array.isArray(token.dexs)) {
                // 3. Loop untuk setiap DEX yang terkonfigurasi untuk token ini.
                token.dexs.forEach((dexData) => {
                            // Skip DEX not included in active selection
                            try { if (!allowedDexs.includes(String(dexData.dex||'').toLowerCase())) return; } catch(_) {}
                            // Normalize DEX name to handle aliases (kyberswap->kyber, matcha->0x, etc)
                            let dex = String(dexData.dex || '').toLowerCase();
                            try {
                                if (typeof window !== 'undefined' && window.DEX && typeof window.DEX.normalize === 'function') {
                                    dex = window.DEX.normalize(dex);
                                }
                            } catch(_) {}
                            const modalKiri = dexData.left;
                            const modalKanan = dexData.right;
                            const amount_in_token = parseFloat(modalKiri) / DataCEX.priceBuyToken;
                            const amount_in_pair = parseFloat(modalKanan) / DataCEX.priceBuyPair;

                            /**
                             * Fungsi internal untuk memanggil API DEX untuk satu arah transaksi.
                             * @param {string} direction - Arah transaksi ('TokentoPair' atau 'PairtoToken').
                             */
                            const callDex = (direction) => {
                                const isKiri = direction === 'TokentoPair';
                                // Periksa apakah posisi (KIRI/KANAN) diaktifkan di UI.
                                if (isKiri && !isPosChecked('Actionkiri')) { return; }
                                if (!isKiri && !isPosChecked('ActionKanan')) { return; }

                                // ID generation: include token ID for uniqueness
                                const sym1 = isKiri ? String(token.symbol_in||'').toUpperCase() : String(token.symbol_out||'').toUpperCase();
                                const sym2 = isKiri ? String(token.symbol_out||'').toUpperCase() : String(token.symbol_in||'').toUpperCase();
                                const tokenId = String(token.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                                const baseIdRaw = `${String(token.cex).toUpperCase()}_${String(dex).toUpperCase()}_${sym1}_${sym2}_${String(token.chain).toUpperCase()}_${tokenId}`;
                                const baseId = baseIdRaw.replace(/[^A-Z0-9_]/g,'');
                                const idCELL = tableBodyId + '_' + baseId;
                                let lastPrimaryError = null;

                                // Normalisasi alamat kontrak dan desimal, terutama untuk pair 'NON'
                                // agar menggunakan nilai default jika tidak ada.
                                const chainCfgSafe = (window.CONFIG_CHAINS || {})[String(token.chain).toLowerCase()] || {};
                                const pairDefsSafe = chainCfgSafe.PAIRDEXS || {};
                                const nonDef = pairDefsSafe['NON'] || {};
                                const isAddrInvalid = (addr) => !addr || String(addr).toLowerCase() === '0x' || String(addr).length < 6;
                                let scInSafe  = isKiri ? token.sc_in  : token.sc_out;
                                let scOutSafe = isKiri ? token.sc_out : token.sc_in;
                                let desInSafe  = isKiri ? Number(token.des_in)  : Number(token.des_out);
                                let desOutSafe = isKiri ? Number(token.des_out) : Number(token.des_in);
                                const symOut = isKiri ? String(token.symbol_out||'') : String(token.symbol_in||'');
                                if (String(symOut).toUpperCase() === 'NON' || isAddrInvalid(scOutSafe)) {
                                    if (nonDef && nonDef.scAddressPair) {
                                        scOutSafe = nonDef.scAddressPair;
                                        desOutSafe = Number(nonDef.desPair || desOutSafe || 18);
                                    }
                                }

                                /**
                                 * Memperbarui status visual sel DEX (misal: "Checking...", "ERROR").
                                 * @param {string} status - 'checking', 'fallback', 'error', 'failed', 'fallback_error'.
                                 * @param {string} dexName - Nama DEX.
                                 * @param {string} [message=''] - Pesan tambahan untuk tooltip.
                                 */
                                const updateDexCellStatus = (status, dexName, message = '') => {
                                    const cell = document.getElementById(idCELL);
                                    if (!cell) return;
                                    // Do not overwrite if cell already finalized by a prior UPDATE/ERROR
                                try {
                                    if (cell.dataset && cell.dataset.final === '1') {
                                        // NEVER overwrite a finalized cell, regardless of new status
                                        return;
                                    }
                                } catch(_) {}
                                    // Presentation only: spinner for checking, badge for error
                                    try { cell.classList.remove('dex-error'); } catch(_) {}
                                    let statusSpan = ensureDexStatusSpan(cell);
                                    statusSpan.removeAttribute('title');
                                    statusSpan.classList.remove('uk-text-muted', 'uk-text-warning', 'uk-text-danger');
                                    if (status === 'checking') {
                                        statusSpan.classList.add('uk-text-warning');
                                        statusSpan.innerHTML = `<span class=\"uk-margin-small-right\" uk-spinner=\"ratio: 0.5\"></span>${String(dexName||'').toUpperCase()}`;
                                        try { if (window.UIkit && UIkit.update) UIkit.update(cell); } catch(_) {}
                                        // Build rich header log like example
                                        try {
                                            const chainCfg = (window.CONFIG_CHAINS||{})[String(token.chain).toLowerCase()] || {};
                                            const chainName = (chainCfg.Nama_Chain || token.chain || '').toString().toUpperCase();
                                            const nameIn  = String(isKiri ? token.symbol_in  : token.symbol_out).toUpperCase();
                                            const nameOut = String(isKiri ? token.symbol_out : token.symbol_in ).toUpperCase();
                                            const ce  = String(token.cex||'').toUpperCase();
                                            const dx  = String(dexName||dex||'').toUpperCase();
                                            const proc = isKiri ? `${ce} → ${dx}` : `${dx} → ${ce}`;
                                            const modal = Number(isKiri ? modalKiri : modalKanan) || 0;
                                            const header = [
                                                `✅ [LOG ${isKiri? 'CEX → DEX':'DEX → CEX'}] ${nameIn} → ${nameOut} on ${chainName}`,
                                                `    🔄 [${proc}]`,
                                                '',
                                                `    🪙 Modal: $${modal.toFixed(2)}`,
                                               // message ? `    💹 CEX SUMMARY: ${message}` : ''
                                            ].filter(Boolean).join('\n');
                                            setCellTitleByEl(cell, header);
                                        } catch(_) {}
                                    } else if (status === 'fallback') {
                                        statusSpan.classList.add('uk-text-warning');
                                        statusSpan.innerHTML = `<span class=\"uk-margin-small-right\" uk-spinner=\"ratio: 0.5\"></span>SWOOP`;
                                        // REFACTORED: Tidak menampilkan error message dari primary DEX
                                        // Tooltip tetap menampilkan header info checking saja
                                        try { if (window.UIkit && UIkit.update) UIkit.update(cell); } catch(_) {}
                                    } else if (status === 'fallback_error') {
                                        setDexErrorBackground(cell);
                                        statusSpan.classList.remove('uk-text-warning');
                                        statusSpan.classList.add('uk-text-danger');
                                        statusSpan.innerHTML = `<span class=\"uk-label uk-label-warning\">TIMEOUT</span>`;
                                        // REFACTORED: Tooltip menampilkan error dari fallback saja (bukan primary)
                                        // Message berisi error dari alternatif DEX
                                        if (message) {
                                            statusSpan.title = String(message);
                                            setCellTitleByEl(cell, String(message));
                                            try { const lab = statusSpan.querySelector('.uk-label'); if (lab) lab.setAttribute('title', String(message)); } catch(_) {}
                                        } else {
                                            statusSpan.removeAttribute('title');
                                        }
                                        // Finalize regardless of tab visibility
                                        try { clearDexTickerById(idCELL); } catch(_) {}
                                        try { if (cell.dataset) { cell.dataset.final = '1'; delete cell.dataset.checking; delete cell.dataset.deadline; } } catch(_) {}
                                    } else if (status === 'failed') {
                                        // Validation failed before DEX call (e.g., modal/contract/chain code)
                                        setDexErrorBackground(cell);
                                        statusSpan.classList.remove('uk-text-warning');
                                        statusSpan.classList.add('uk-text-danger');
                                        statusSpan.innerHTML = `<span class=\"uk-label uk-label-failed\">FAILED</span>`;
                                        if (message) {
                                            statusSpan.title = String(message);
                                            setCellTitleByEl(cell, String(message));
                                            try { const lab = statusSpan.querySelector('.uk-label'); if (lab) lab.setAttribute('title', String(message)); } catch(_) {}
                                        } else {
                                            statusSpan.removeAttribute('title');
                                        }
                                        // Finalize regardless of tab visibility
                                        try { clearDexTickerById(idCELL); } catch(_) {}
                                        try { if (cell.dataset) { cell.dataset.final = '1'; delete cell.dataset.checking; delete cell.dataset.deadline; } } catch(_) {}
                                    } else if (status === 'error') {
                                        setDexErrorBackground(cell);
                                        statusSpan.classList.remove('uk-text-warning');
                                        statusSpan.classList.add('uk-text-danger');
                                        statusSpan.innerHTML = `<span class=\"uk-label uk-label-danger\">ERROR</span>`;
                                        if (message) {
                                            statusSpan.title = String(message);
                                            setCellTitleByEl(cell, String(message));
                                            // Ensure the visible ERROR/TIMEOUT badge also shows the tooltip itself
                                            try { const lab = statusSpan.querySelector('.uk-label'); if (lab) lab.setAttribute('title', String(message)); } catch(_) {}
                                        } else {
                                            statusSpan.removeAttribute('title');
                                        }
                                        // Finalize regardless of tab visibility
                                        try { clearDexTickerById(idCELL); } catch(_) {}
                                        try { if (cell.dataset) { cell.dataset.final = '1'; delete cell.dataset.checking; delete cell.dataset.deadline; } } catch(_) {}
                                    }
                                };

                                /**
                                 * Validasi cepat sebelum memanggil API DEX untuk menghindari request yang tidak perlu.
                                 * @returns {{ok: boolean, reason?: string}}
                                 */
                                const validateDexReadiness = () => {
                                    const modal = isKiri ? modalKiri : modalKanan;
                                    const amtIn = isKiri ? amount_in_token : amount_in_pair;
                                    const chainCfg = CONFIG_CHAINS[String(token.chain).toLowerCase()] || {};
                                    // Modal must be > 0
                                    if (!(Number(modal) > 0)) return { ok:false, reason:'Modal tidak valid (<= 0)' };
                                    // Amount-in must be > 0
                                    if (!(Number(amtIn) > 0)) return { ok:false, reason:'Amount input tidak valid (<= 0)' };
                                    // Chain code must exist (used by DEX link and queries)
                                    if (!chainCfg || !chainCfg.Kode_Chain) return { ok:false, reason:'Kode chain tidak tersedia' };
                                    // Basic SC presence (after NON fallback sanitation)
                                    if (!scInSafe || !scOutSafe || String(scInSafe).length < 6 || String(scOutSafe).length < 6) return { ok:false, reason:'Alamat kontrak tidak lengkap' };
                                    return { ok:true };
                                };

                                const ready = validateDexReadiness();
                                if (!ready.ok) { updateDexCellStatus('failed', dex, ready.reason); return; }

                                // REMOVED: Watchdog keys removed

                                /**
                                 * Handler yang dijalankan jika panggilan API DEX (atau fallback-nya) berhasil.
                                 * @param {object} dexResponse - Respons dari `getPriceDEX` atau `getPriceAltDEX`.
                                 * @param {boolean} [isFallback=false] - True jika ini adalah hasil dari fallback.
                                 * @param {string} [fallbackSource=''] - Sumber fallback ('DZAP' atau 'SWOOP').
                                 */
                                const handleSuccess = (dexResponse, isFallback = false, fallbackSource = '') => {
                                    try {
                                    // REMOVED: clearAllWatchdogs()
                                    // REFACTORED: Tambahkan info sumber alternatif ke dexResponse
                                    const finalDexRes = isFallback ? {
                                        ...dexResponse,
                                        dexTitle: (dexResponse.dexTitle || dex),
                                        isFallback: true,  // Flag untuk DisplayPNL
                                        fallbackSource: fallbackSource || 'UNKNOWN'
                                    } : dexResponse;
                                    // Panggil `calculateResult` untuk menghitung PNL dan data lainnya.
                                    const update = calculateResult(
                                        baseId, tableBodyId, finalDexRes.amount_out, finalDexRes.FeeSwap,
                                        isKiri ? token.sc_in : token.sc_out, isKiri ? token.sc_out : token.sc_in,
                                        token.cex, isKiri ? modalKiri : modalKanan,
                                        isKiri ? amount_in_token : amount_in_pair,
                                        DataCEX.priceBuyToken, DataCEX.priceSellToken, DataCEX.priceBuyPair, DataCEX.priceSellPair,
                                        isKiri ? token.symbol_in : token.symbol_out, isKiri ? token.symbol_out : token.symbol_in,
                                        isKiri ? DataCEX.feeWDToken : DataCEX.feeWDPair,
                                        dex, token.chain, CONFIG_CHAINS[token.chain.toLowerCase()].Kode_Chain,
                                        direction, 0, finalDexRes
                                    );
                                    // Buat log ringkasan untuk console jika diaktifkan.
                                    // Console log summary for this successful check (cleaned)
                                    try {
                                        // Compute DEX USD rate based on direction
                                        const amtIn = isKiri ? amount_in_token : amount_in_pair;
                                        const rate = (Number(finalDexRes.amount_out)||0) / (Number(amtIn)||1);
                                        let dexUsd = null;
                                        try {
                                            const stable = (typeof getStableSymbols === 'function') ? getStableSymbols() : ['USDT','USDC','DAI'];
                                            const baseSym = (typeof getBaseTokenSymbol === 'function') ? getBaseTokenSymbol(token.chain) : '';
                                            const baseUsd = (typeof getBaseTokenUSD === 'function') ? getBaseTokenUSD(token.chain) : 0;
                                            const inSym  = String(isKiri ? token.symbol_in  : token.symbol_out).toUpperCase();
                                            const outSym = String(isKiri ? token.symbol_out : token.symbol_in ).toUpperCase();
                                            if (isKiri) {
                                                // token -> pair: USD per 1 token
                                                if (stable.includes(outSym)) dexUsd = rate;
                                                else if (baseSym && outSym === baseSym && baseUsd > 0) dexUsd = rate * baseUsd;
                                                else dexUsd = rate * (Number(DataCEX.priceBuyPair)||0); // fallback via CEX
                                            } else {
                                                // pair -> token: USD per 1 token
                                                if (stable.includes(inSym) && rate > 0) dexUsd = 1 / rate;
                                                else if (baseSym && inSym === baseSym && baseUsd > 0 && rate > 0) dexUsd = baseUsd / rate;
                                                else dexUsd = Number(DataCEX.priceSellToken)||0; // fallback via CEX
                                            }
                                        } catch(_) { dexUsd = null; }

                                        // refactor: removed unused local debug variables (buy/sell/pnl lines)
                                        
                                    } catch(_) {}
                                    // Append success details (rich format)
                                    try {
                                        const chainCfg = (window.CONFIG_CHAINS||{})[String(token.chain).toLowerCase()] || {};
                                        const chainName = (chainCfg.Nama_Chain || token.chain || '').toString().toUpperCase();
                                        const ce  = String(token.cex||'').toUpperCase();
                                        const dx  = String((finalDexRes?.dexTitle)||dex||'').toUpperCase();
                                        // Sumber nilai: jika alternatif dipakai tampilkan 'via DZAP' atau 'via SWOOP'
                                        const viaText = (function(){
                                            try {
                                                if (isFallback === true) {
                                                    // Jika fallback DZAP (memiliki routeTool dari services), tampilkan via DZAP
                                                    if (finalDexRes && typeof finalDexRes.routeTool !== 'undefined') return ' via DZAP';
                                                    // Selain itu fallback dianggap SWOOP
                                                    return ' via SWOOP';
                                                }
                                            } catch(_) {}
                                            return '';
                                        })();
                                        const nameIn  = String(isKiri ? token.symbol_in  : token.symbol_out).toUpperCase();
                                        const nameOut = String(isKiri ? token.symbol_out : token.symbol_in ).toUpperCase();
                                        const modal = Number(isKiri ? modalKiri : modalKanan) || 0;
                                        const amtIn  = Number(isKiri ? amount_in_token : amount_in_pair) || 0;
                                        const outAmt = Number(finalDexRes.amount_out)||0;
                                        const feeSwap = Number(finalDexRes.FeeSwap||0);
                                        const feeWD   = Number(isKiri ? DataCEX.feeWDToken : DataCEX.feeWDPair) || 0;
                                        const feeTrade = 0.0014 * modal;
                                        // Harga efektif DEX (USDT/token)
                                        let effDexPerToken = 0;
                                        if (isKiri) {
                                            if (nameOut === 'USDT') effDexPerToken = (amtIn>0)? (outAmt/amtIn) : 0;
                                            else effDexPerToken = (amtIn>0)? (outAmt/amtIn) * Number(DataCEX.priceSellPair||0) : 0;
                                        } else {
                                            if (nameIn === 'USDT') effDexPerToken = (outAmt>0)? (amtIn/outAmt) : 0;
                                            else effDexPerToken = (outAmt>0)? (amtIn/outAmt) * Number(DataCEX.priceBuyPair||0) : 0;
                                        }
                                        // Total value hasil (USDT)
                                        const totalValue = isKiri
                                          ? outAmt * Number(DataCEX.priceSellPair||0)
                                          : outAmt * Number(DataCEX.priceSellToken||0);
                                        const bruto = totalValue - modal;
                                        const totalFee = feeSwap + feeWD + feeTrade;
                                        const profitLoss = totalValue - (modal + totalFee);
                                        const pnlPct = modal>0 ? (bruto/modal)*100 : 0;
                                        const toIDR = (v)=>{ try{ return (typeof formatIDRfromUSDT==='function')? formatIDRfromUSDT(Number(v)||0):'';}catch(_){return '';} };
                                        const buyPriceCEX = Number(DataCEX.priceBuyToken||0);
                                        const buyLine = isKiri
                                          ? `    🛒 Beli di ${ce} @ $${buyPriceCEX.toFixed(6)} → ${amtIn.toFixed(6)} ${nameIn}`
                                          : `    🛒 Beli di ${dx} @ ~$${effDexPerToken.toFixed(6)} / ${nameOut}`;
                                        const buyIdrLine = isKiri
                                          ? `    💱 Harga Beli (${ce}) dalam IDR: ${toIDR(buyPriceCEX)}`
                                          : `    💱 Harga Beli (${dx}) dalam IDR: ${toIDR(effDexPerToken)}`;
                                        const sellIdrLine = isKiri
                                          ? `    💱 Harga Jual (${dx}) dalam IDR: ${toIDR(effDexPerToken)}`
                                          : `    💱 Harga Jual (${ce}) dalam IDR: ${toIDR(Number(DataCEX.priceSellToken||0))}`;
                                        // Header block (selalu tampil di awal tooltip)
                                        const nowStr = (new Date()).toLocaleTimeString();
                                        const viaName = (function(){
                                            try {
                                                if (isFallback === true) {
                                                    const routeTool = String(finalDexRes?.routeTool || '').toUpperCase();
                                                    if (routeTool) {
                                                        if (/DZAP|PARASWAP|1INCH|0X|KYBER/i.test(routeTool)) {
                                                            return `DZAP (${routeTool})`;
                                                        }
                                                        return routeTool;
                                                    }
                                                    return 'SWOOP';
                                                }
                                            } catch(_) {}
                                            return dx;
                                        })();
                                        const prosesLine = isKiri
                                          ? `PROSES : ${ce} => ${dx} (VIA ${viaName})`
                                          : `PROSES : ${dx} => ${ce} (VIA ${viaName})`;
                                        // REFACTORED: Jika fallback berhasil, statusnya TETAP "OK"
                                        // Tidak perlu menampilkan error dari primary DEX karena sudah berhasil via fallback
                                        let statusLine = 'STATUS DEX : OK';
                                        const headerBlock = [
                                            '======================================',
                                            `Time: ${nowStr}`,
                                           // `ID CELL: ${idCELL}`,
                                            `PROSES : ${isKiri ? `${ce} => ${dx}` : `${dx} => ${ce}`} (VIA ${viaName})`,
                                            statusLine
                                        ].join('\n');
                                        // Token info untuk debugging
                                        const tokenInInfo = isKiri
                                            ? `    📥 Token IN  : ${nameIn} (${String(token.sc_in).substring(0,10)}...)`
                                            : `    📥 Token IN  : ${nameIn} (${String(token.sc_out).substring(0,10)}...)`;
                                        const tokenOutInfo = isKiri
                                            ? `    📤 Token OUT : ${nameOut} (${String(token.sc_out).substring(0,10)}...)`
                                            : `    📤 Token OUT : ${nameOut} (${String(token.sc_in).substring(0,10)}...)`;
                                        // Info sumber alternatif untuk console log
                                        const sourceInfo = (function(){
                                            try {
                                                if (isFallback === true) {
                                                    const routeTool = String(finalDexRes?.routeTool || '').toUpperCase();
                                                    if (routeTool) {
                                                        // DZAP dengan provider spesifik
                                                        if (/DZAP|PARASWAP|1INCH|0X|KYBER/i.test(routeTool)) {
                                                            return `    🔄 SUMBER: DZAP (Provider: ${routeTool})`;
                                                        }
                                                        return `    🔄 SUMBER: ${routeTool}`;
                                                    }
                                                    // Default SWOOP
                                                    return `    🔄 SUMBER: SWOOP`;
                                                }
                                            } catch(_) {}
                                            return ''; // Tidak ada info sumber jika bukan fallback
                                        })();

                                        const lines = [
                                            headerBlock,
                                            sourceInfo, // Tambahkan info sumber di bawah header
                                            tokenInInfo,
                                            tokenOutInfo,
                                            `    🪙 Modal: $${modal.toFixed(2)}`,
                                            buyLine,
                                            buyIdrLine,
                                            '',
                                            `    💰 Swap di ${dx}:`,
                                            `    - Harga Swap Efektif: ~$${effDexPerToken.toFixed(6)} / ${nameIn}`,
                                            `    - Hasil: $${Number(totalValue||0).toFixed(6)}`,
                                            sellIdrLine,
                                            '',
                                            `    💸 Fee WD: $${feeWD.toFixed(2)}`,
                                            `    🛒 Fee Swap: $${feeSwap.toFixed(2)}`,
                                            `    🧾 Total Fee: ~$${totalFee.toFixed(2)}`,
                                            '',
                                            `    📈 PNL: ${bruto>=0?'+':''}${bruto.toFixed(2)} USDT (${pnlPct.toFixed(2)}%)`,
                                            `    🚀 PROFIT : ${profitLoss>=0?'+':''}${profitLoss.toFixed(2)} USDT`,
                                            `idCELL: ${idCELL}`,
                                        ].filter(Boolean).join('\n'); // filter(Boolean) menghapus string kosong
                                        appendCellTitleById(idCELL, lines);
                                        try { if (window.SCAN_LOG_ENABLED) console.log(lines); } catch(_) {}
                                    } catch(_) {}
                                    // Masukkan hasil kalkulasi ke antrian pembaruan UI.
                                   // console.log(`[PUSH TO QUEUE] Pushing update to uiUpdateQueue`, { idCELL, isFallback, type: update.type });
                                    uiUpdateQueue.push(update);
                                    if (!isScanRunning) {
                                        try {
                                            animationFrameId = requestAnimationFrame(processUiUpdates);
                                        } catch(_) {
                                            try { processUiUpdates(); } catch(_) {}
                                        }
                                    }
                                    } finally {
                                        markDexRequestEnd();
                                    }
                                };

                                /**
                                 * Handler yang dijalankan jika panggilan API DEX utama gagal.
                                 * @param {object} initialError - Objek error dari `getPriceDEX`.
                                 */
                                const handleError = (initialError) => {
                                    try { lastPrimaryError = initialError; } catch(_) {}
                                    // REMOVED: clearAllWatchdogs()
                                    // debug logs removed
                                    const dexConfig = CONFIG_DEXS[dex.toLowerCase()];
                                    // Build richer error title with HTTP status code only if not already present
                                    let msg = (initialError && initialError.pesanDEX) ? String(initialError.pesanDEX) : 'Unknown Error';
                                    const hasPrefix = /\[(HTTP \d{3}|XHR ERROR 200)\]/.test(msg);
                                    try {
                                        const code = Number(initialError && initialError.statusCode);
                                        if (!hasPrefix && Number.isFinite(code) && code > 0) {
                                            if (code === 200) msg = `[XHR ERROR 200] ${msg}`;
                                            else msg = `[HTTP ${code}] ${msg}`;
                                        }
                                    } catch(_) {}
                                    // Periksa apakah DEX ini dikonfigurasi untuk menggunakan fallback.
                                    if (dexConfig && dexConfig.allowFallback) {
                                        // REFACTORED: Tidak update UI dengan error dari primary DEX
                                        // Langsung tampilkan status fallback (SWOOP) tanpa menampilkan error primary
                                       // console.log(`[FALLBACK] Primary DEX ${dex.toUpperCase()} error, trying fallback...`, { idCELL, error: msg });
                                        updateDexCellStatus('fallback', dex, '');
                                        // Mulai countdown untuk SWOOP fallback (menggunakan speedScan dari setting user)
                                        try {
                                            // Hapus ticker lama dan mulai ticker baru untuk fallback.
                                            clearDexTickerById(idCELL);
                                            // FIXED: Gunakan speedScan dari user setting, bukan hardcoded 5000ms
                                            const fallbackTimeout = Math.max(speedScan, 2000); // minimum 2 detik untuk fallback
                                            const endAtFB = Date.now() + fallbackTimeout;
                                            // Use shared ticker helper
                                            const renderFB = (secs, cell) => {
                                                const span = ensureDexStatusSpan(cell);
                                                span.innerHTML = `<span class=\\"uk-margin-small-right\\" uk-spinner=\\"ratio: 0.5\\"></span>SWOOP (${secs}s)`;
                                                try { if (window.UIkit && UIkit.update) UIkit.update(cell); } catch(_) {}
                                            };
                                            const onEndFB = () => {
                                                // REFACTORED: Tidak menampilkan error dari primary, hanya info timeout fallback
                                                const rawMsg = 'Fallback Timeout';
                                                if (!(typeof document !== 'undefined' && document.hidden)) {
                                                    try { updateDexCellStatus('fallback_error', dex, rawMsg); } catch(_) {}
                                                }
                                            };
                                            // Define lightweight helper locally (no global pollution)
                                            const startTicker = (endAt, render, onEnd) => {
                                                try {
                                                    window._DEX_TICKERS = window._DEX_TICKERS || new Map();
                                                    const key = idCELL + ':ticker';
                                                    if (window._DEX_TICKERS.has(key)) { clearInterval(window._DEX_TICKERS.get(key)); window._DEX_TICKERS.delete(key); }
                                                    const tick = () => {
                                                        const rem = endAt - Date.now();
                                                        const secs = Math.max(0, Math.ceil(rem/1000));
                                                        const cell = document.getElementById(idCELL);
                                                        if (!cell) { clearDexTickerById(idCELL); return; }
                                                        if (cell.dataset && cell.dataset.final === '1') { clearDexTickerById(idCELL); return; }
                                                        render(secs, cell);
                                                        if (rem <= 0) { clearDexTickerById(idCELL); /*if (typeof onEnd === 'function') onEnd();*/ }
                                                    };
                                                    const intId = setInterval(tick, 1000);
                                                    window._DEX_TICKERS.set(key, intId);
                                                    tick();
                                                } catch(_) {}
                                            };
                                            startTicker(endAtFB, renderFB, onEndFB);
                                        } catch(_) {}
                                        // REMOVED: Watchdog for fallback removed
                                        // Panggil API fallback.
                                        getPriceAltDEX(
                                            isKiri ? token.sc_in : token.sc_out, isKiri ? token.des_in : token.des_out,
                                            isKiri ? token.sc_out : token.sc_in, isKiri ? token.des_out : token.des_in,
                                            isKiri ? amount_in_token : amount_in_pair, DataCEX.priceBuyPair, dex,
                                            isKiri ? token.symbol_in : token.symbol_out, isKiri ? token.symbol_out : token.symbol_in,
                                            token.cex, token.chain, CONFIG_CHAINS[token.chain.toLowerCase()].Kode_Chain, direction
                                        )
                                        // Jika fallback berhasil, panggil `handleSuccess`.
                                        .then((fallbackRes) => {
                                            // REMOVED: clearDexWatchdog(wdKeyFallback)
                                            try { clearDexTickerById(idCELL); } catch(_) {}
                                            // REFACTORED: Deteksi sumber fallback dari response
                                            const routeTool = String(fallbackRes?.routeTool || '').toUpperCase();
                                            let source = 'SWOOP'; // Default
                                            if (routeTool) {
                                                if (/DZAP|PARASWAP|1INCH|0X|KYBER/i.test(routeTool)) {
                                                    source = `DZAP (${routeTool})`;
                                                } else {
                                                    source = routeTool;
                                                }
                                            }
                                           // console.log(`[FALLBACK SUCCESS] ${dex.toUpperCase()} fallback succeeded via ${source}`, { idCELL, amount_out: fallbackRes.amount_out });
                                            handleSuccess(fallbackRes, true, source);
                                        })
                                        // Jika fallback juga gagal, tampilkan error final.
                                        .catch((fallbackErr) => {
                                            try {
                                            // REMOVED: watchdog cleanup
                                            // REFACTORED: Gunakan error dari fallback, bukan dari primary
                                            let finalMessage = (fallbackErr && fallbackErr.pesanDEX) ? fallbackErr.pesanDEX : 'Fallback Error';
                                            try {
                                                const sc = Number(fallbackErr && fallbackErr.statusCode);
                                                if (Number.isFinite(sc) && sc > 0) {
                                                    const prefix = (sc === 200) ? '[XHR ERROR 200] ' : `[HTTP ${sc}] `;
                                                    // Only add prefix if not already present
                                                    if (finalMessage.indexOf(prefix) !== 0) finalMessage = prefix + finalMessage;
                                                }
                                            } catch(_) {}
                                            try { clearDexTickerById(idCELL); } catch(_) {}
                                            // REFACTORED: Tampilkan error dari alternatif, bukan error dari primary
                                            //console.log(`[FALLBACK ERROR] ${dex.toUpperCase()} fallback also failed`, { idCELL, error: finalMessage });
                                            updateDexCellStatus('fallback_error', dex, finalMessage);
                                            try {
                                                // Align console info with requested orderbook logic
                                                const amtIn = isKiri ? amount_in_token : amount_in_pair;
                                                const rate = Number(amtIn) ? (Number(fallbackRes?.amount_out||0) / Number(amtIn)) : 0;
                                                let dexUsd = null;
                                                try {
                                                    const stable = (typeof getStableSymbols === 'function') ? getStableSymbols() : ['USDT','USDC','DAI'];
                                                    const baseSym = (typeof getBaseTokenSymbol === 'function') ? getBaseTokenSymbol(token.chain) : '';
                                                    const baseUsd = (typeof getBaseTokenUSD === 'function') ? getBaseTokenUSD(token.chain) : 0;
                                                    const inSym  = String(isKiri ? token.symbol_in  : token.symbol_out).toUpperCase();
                                                    const outSym = String(isKiri ? token.symbol_out : token.symbol_in ).toUpperCase();
                                                    if (isKiri) {
                                                        if (stable.includes(outSym)) dexUsd = rate; else if (baseSym && outSym === baseSym && baseUsd > 0) dexUsd = rate * baseUsd; else dexUsd = rate * (Number(DataCEX.priceBuyPair)||0);
                                                    } else {
                                                        if (stable.includes(inSym) && rate>0) dexUsd = 1 / rate; else if (baseSym && inSym === baseSym && baseUsd>0 && rate>0) dexUsd = baseUsd / rate; else dexUsd = Number(DataCEX.priceSellToken)||0;
                                                    }
                                                } catch(_) { dexUsd = null; }
                                                // refactor: removed unused local debug variables (buy/sell/pnl lines)
                                                
                                            } catch(_) {}
                                            } finally {
                                                markDexRequestEnd();
                                            }
                                        });
                                    } else {
                                        // Jika tidak ada fallback, langsung tampilkan error.
                                        // Use formatted message with HTTP code when available (avoid duplicate prefix)
                                        updateDexCellStatus('error', dex, msg);
                                        // Tambahkan header block ke tooltip + console (jika Log ON)
                                        try {
                                            const nowStr = (new Date()).toLocaleTimeString();
                                            const dxName = String(dex||'').toUpperCase();
                                            const ceName = String(token.cex||'').toUpperCase();
                                            // PROSES mengikuti arah
                                            const prosesLine = (direction === 'TokentoPair')
                                                ? `PROSES : ${ceName} => ${dxName} (VIA ${dxName})`
                                                : `PROSES : ${dxName} => ${ceName} (VIA ${dxName})`;
                                            // STATUS
                                            let s = 'FAILED';
                                            try {
                                                const ts = String(initialError && initialError.textStatus || '').toLowerCase();
                                                if (ts === 'timeout' || /timeout/i.test(String(initialError && initialError.pesanDEX||''))) s = 'TIMEOUT';
                                            } catch(_) { s = 'FAILED'; }
                                            const codeNum = Number(initialError && initialError.statusCode);
                                            const statusLine = `STATUS DEX : ${s} (KODE ERROR : ${Number.isFinite(codeNum)?codeNum:'NA'})`;
                                            const headerBlock = [
                                                '======================================',
                                                `Time: ${nowStr}`,
                                               // `ID CELL: ${idCELL}`,
                                                prosesLine,
                                                statusLine
                                            ].join('\n');
                                            appendCellTitleById(idCELL, headerBlock);
                                            try { if (window.SCAN_LOG_ENABLED) console.log(headerBlock); } catch(_) {}
                                        } catch(_) {}
                                        try {
                                            // Align console info with requested orderbook logic (logs removed)
                                        } catch(_) {}
                                        markDexRequestEnd();
                                    }
                                };

                                // Update UI ke status "Checking" sebelum memanggil API.
                                // Include CEX summary in title while checking
                                const fmt6 = v => (Number.isFinite(+v) ? (+v).toFixed(6) : String(v));
                                const cexSummary = `CEX READY BT=${fmt6(DataCEX.priceBuyToken)} ST=${fmt6(DataCEX.priceSellToken)} BP=${fmt6(DataCEX.priceBuyPair)} SP=${fmt6(DataCEX.priceSellPair)}`;
                                updateDexCellStatus('checking', dex, cexSummary);
                                // REMOVED: Watchdog for primary DEX removed
                                const dexTimeoutWindow = getJedaDex(dex) + Math.max(speedScan) + 300;
                                // Mulai ticker countdown untuk menampilkan sisa detik pada label "Checking".
                                try {
                                    const endAt = Date.now() + dexTimeoutWindow;
                                    // Stamp a deadline on the cell for a global safety sweeper
                                    try { const c = document.getElementById(idCELL); if (c) { c.dataset.deadline = String(endAt); c.dataset.dex = String(dex); c.dataset.checking = '1'; } } catch(_) {}
                                    const renderCheck = (secs, cell) => {
                                        const span = ensureDexStatusSpan(cell);
                                        span.innerHTML = `<span class=\"uk-margin-small-right\" uk-spinner=\"ratio: 0.5\"></span>${String(dex||'').toUpperCase()} (${secs}s)`;
                                        try { if (window.UIkit && UIkit.update) UIkit.update(cell); } catch(_) {}
                                    };
                                    const onEndCheck = () => {
                                        // REMOVED: Watchdog logic removed
                                        // Timeout will be handled by ticker and safety sweeper in processUiUpdates
                                    };
                                    // Define lightweight helper locally (reused)
                                    const startTicker = (endAt, render, onEnd) => {
                                        try {
                                            window._DEX_TICKERS = window._DEX_TICKERS || new Map();
                                            const key = idCELL + ':ticker';
                                            if (window._DEX_TICKERS.has(key)) { clearInterval(window._DEX_TICKERS.get(key)); window._DEX_TICKERS.delete(key); }
                                            const tick = () => {
                                                const rem = endAt - Date.now();
                                                const secs = Math.max(0, Math.ceil(rem/1000));
                                                const cell = document.getElementById(idCELL);
                                                if (!cell) { clearDexTickerById(idCELL); return; }
                                                if (cell.dataset && cell.dataset.final === '1') { clearDexTickerById(idCELL); return; }
                                                render(secs, cell);
                                                if (rem <= 0) { clearDexTickerById(idCELL); /*if (typeof onEnd === 'function') onEnd();*/ }
                                            };
                                            const intId = setInterval(tick, 1000);
                                            window._DEX_TICKERS.set(key, intId);
                                            tick();
                                        } catch(_) {}
                                    };
                                    startTicker(endAt, renderCheck, onEndCheck);
                                } catch(_) {}

                                // Panggil API DEX setelah jeda yang dikonfigurasi.
                                setTimeout(() => {
                                    markDexRequestStart();
                                    if (!isScanRunning) {
                                        markDexRequestEnd();
                                        return;
                                    }
                                    getPriceDEX(
                                        scInSafe, desInSafe,
                                        scOutSafe, desOutSafe,
                                        isKiri ? amount_in_token : amount_in_pair, DataCEX.priceBuyPair, dex,
                                        isKiri ? token.symbol_in : token.symbol_out, isKiri ? token.symbol_out : token.symbol_in,
                                        token.cex, token.chain, CONFIG_CHAINS[token.chain.toLowerCase()].Kode_Chain, direction, tableBodyId
                                    )
                                    // Panggil handler yang sesuai berdasarkan hasil promise.
                                    .then((dexRes) => { /* REMOVED: clearAllWatchdogs() */ handleSuccess(dexRes); })
                                    .catch((err) => { handleError(err); });
                                }, getJedaDex(dex));
                            };
                            // Jalankan untuk kedua arah: CEX->DEX dan DEX->CEX.
                            callDex('TokentoPair');
                            (function(){
                                const gap = getJedaDex(dex) || 0;
                                if (gap > 0) setTimeout(() => { try { callDex('PairtoToken'); } catch(_) {} }, gap);
                                else callDex('PairtoToken');
                            })();
                        });
                    }
            // Beri jeda antar token dalam satu grup.
            await delay(jedaKoin);
        } catch (error) {
            // console.error(`Kesalahan saat memproses ${token.symbol_in}_${token.symbol_out}:`, error);
        }
    }

    async function processTokens(tokensToProcess, tableBodyId) {
        // Set flag bahwa scan sedang berjalan dan mulai loop update UI.
        isScanRunning = true;
        animationFrameId = requestAnimationFrame(processUiUpdates);

        const startTime = Date.now();
        // Bagi daftar token menjadi beberapa grup kecil.
        const tokenGroups = [];
        for (let i = 0; i < tokensToProcess.length; i += scanPerKoin) {
            tokenGroups.push(tokensToProcess.slice(i, i + scanPerKoin));
        }
        let processed = 0; // track tokens completed across groups

        // --- PROSES UTAMA ---

        // 1. Ambil data harga gas dan kurs USDT/IDR sebelum memulai loop token.
        try {
           
            $('#progress-bar').css('width', '5%');
            $('#progress-text').text('5%');
        } catch(_) {}
        await feeGasGwei();
        try {
            $('#progress').text('GAS / GWEI CHAINS READY');
            $('#progress-bar').css('width', '8%');
            $('#progress-text').text('8%');
        } catch(_) {}
        await getRateUSDT();

        // 2. Loop melalui setiap grup token.
        for (let groupIndex = 0; groupIndex < tokenGroups.length; groupIndex++) {
            // Jika user menekan STOP, hentikan loop.
            if (!isScanRunning) { break; }
            const groupTokens = tokenGroups[groupIndex];

            // Jika auto-scroll aktif, scroll ke baris token pertama dari grup saat ini.
            if ($('#autoScrollCheckbox').is(':checked') && groupTokens.length > 0) {
                const first = groupTokens[0];
                const suffix = `DETAIL_${first.cex.toUpperCase()}_${first.symbol_in.toUpperCase()}_${first.symbol_out.toUpperCase()}_${first.chain.toUpperCase()}`.replace(/[^A-Z0-9_]/g, '');
                const fullId = `${tableBodyId}_${suffix}`;
                requestAnimationFrame(() => { // REFACTORED
                    // Respect user interaction: temporarily suspend auto-scroll
                    try { if (window.__AUTO_SCROLL_SUSPEND_UNTIL && Date.now() < window.__AUTO_SCROLL_SUSPEND_UNTIL) return; } catch(_) {}
                    const $target = $('#' + fullId).length ? $('#' + fullId) : $(`[id$="${suffix}"]`).first();
                    if (!$target.length) return;
                    $target.addClass('auto-focus');
                    setTimeout(() => $target.removeClass('auto-focus'), 900);
                    // Prefer explicit monitoring container; fallback to nearest scrollable
                    let $container = $('#monitoring-scroll');
                    if (!$container.length) $container = $target.closest('.uk-overflow-auto');
                    if (!$container.length) return; // do not scroll the main page

                    // If container not scrollable, skip instead of scrolling the body
                    const cEl = $container[0];
                    if (!(cEl.scrollHeight > cEl.clientHeight)) return;

                    const tRect = $target[0].getBoundingClientRect();
                    const cRect = cEl.getBoundingClientRect();
                    // Skip if already fully visible inside container viewport
                    const fullyVisible = (tRect.top >= cRect.top) && (tRect.bottom <= cRect.bottom);
                    if (fullyVisible) return;

                    const desiredTop = (tRect.top - cRect.top) + $container.scrollTop() - (cEl.clientHeight / 2) + ($target[0].clientHeight / 2);
                    $container.animate({ scrollTop: Math.max(desiredTop, 0) }, 200);
                });
            }

            // Proses token-token dalam satu grup secara paralel,
            // dengan jeda kecil antar pemanggilan untuk menghindari rate-limit.
            const jobs = groupTokens.map((token, tokenIndex) => (async () => {
                if (!isScanRunning) return;
                // Stagger start per token within the group
                try { await delay(tokenIndex * Math.max(jedaKoin, 0)); } catch(_) {}
                if (!isScanRunning) return;
                try { await processRequest(token, tableBodyId); } catch(e) { console.error(`Err token ${token.symbol_in}_${token.symbol_out}`, e); }
                // Update progress as each token finishes
                processed += 1;
                updateProgress(processed, tokensToProcess.length, startTime, `${token.symbol_in}_${token.symbol_out}`);
            })());

            // Tunggu semua proses dalam grup selesai.
            await Promise.allSettled(jobs);
            if (!isScanRunning) break;
            // Beri jeda antar grup.
            if (groupIndex < tokenGroups.length - 1) { await delay(jedaTimeGroup); }
        }

        // --- FINALISASI SETELAH SEMUA TOKEN SELESAI ---

        updateProgress(tokensToProcess.length, tokensToProcess.length, startTime, 'SELESAI');

        // REFACTORED: Tunggu semua request DEX (termasuk fallback) benar-benar selesai.
       //('[FINAL] Waiting for pending DEX requests to settle...');
        await waitForPendingDexRequests(8000);
        if (activeDexRequests > 0) {
            // console.warn(`[FINAL] Continuing with ${activeDexRequests} pending DEX request(s) after timeout window.`);
        }

        // Trigger final processUiUpdates untuk memastikan semua item di queue diproses
       // console.log(`[FINAL] Queue length before final processing: ${uiUpdateQueue.length}`);

        if (uiUpdateQueue.length > 0) {
           // console.log(`[FINAL] Processing remaining ${uiUpdateQueue.length} items in queue...`);

            // Process semua item yang ada di queue
            while (uiUpdateQueue.length > 0) {
                const updateData = uiUpdateQueue.shift();
                if (!updateData) { continue; }
                if (updateData.type === 'error') {
                    const { id, message, swapMessage } = updateData;
                    const cell = document.getElementById(id);
                    if (cell) {
                        try {
                            if (cell.dataset && cell.dataset.final === '1') {
                                continue;
                            }
                        } catch(_) {}
                        try { clearDexTickerById(id); } catch(_) {}
                        try { if (cell.dataset) { cell.dataset.final = '1'; delete cell.dataset.checking; delete cell.dataset.deadline; } } catch(_) {}
                        setDexErrorBackground(cell);
                        const statusSpan = ensureDexStatusSpan(cell);
                        if (statusSpan) {
                            try { statusSpan.className = 'dex-status uk-text-danger'; } catch(_) {}
                            try {
                                statusSpan.classList.remove('uk-text-muted', 'uk-text-warning');
                                statusSpan.classList.add('uk-text-danger');
                            } catch(_) {}
                            statusSpan.textContent = swapMessage || '[ERROR]';
                            statusSpan.title = message || '';
                        }
                    }
                    continue;
                }
               // console.log(`[FINAL PROCESS]`, { idCELL: updateData.idPrefix + updateData.baseId });
                try {
                    DisplayPNL(updateData);
                } catch(e) {
                    // console.error('[FINAL PROCESS ERROR]', e);
                }
            }
           // console.log('[FINAL] All items processed.');
        } else {
           // console.log('[FINAL] No items in queue to process.');
        }

        // Set flag dan hentikan loop UI.
        isScanRunning = false;
        cancelAnimationFrame(animationFrameId);
        setPageTitleForRun(false);

        // === RELEASE GLOBAL SCAN LOCK ===
        try {
            // Clear global scan lock
            const filterKey = typeof getActiveFilterKey === 'function' ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
            if (typeof clearGlobalScanLock === 'function') {
                clearGlobalScanLock(filterKey);
                // console.log('[SCANNER] Global scan lock released:', filterKey);
            }

            // Clear per-tab scanning state
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('TAB_SCANNING');
                sessionStorage.removeItem('TAB_SCAN_CHAIN');
                sessionStorage.removeItem('TAB_SCAN_START');
            }

            // Notify TabManager untuk broadcast ke tab lain
            if (window.TabManager && typeof window.TabManager.notifyScanStop === 'function') {
                window.TabManager.notifyScanStop();
                // console.log(`[SCANNER] Tab ${window.getTabId()} stopped scanning`);
            }
        } catch(e) {
            // console.error('[SCANNER] Error releasing scan state:', e);
        }

        // Aktifkan kembali UI.
        form_on();
        $("#stopSCAN").hide().prop("disabled", true);
        $('#startSCAN').prop('disabled', false).text('Start').removeClass('uk-button-disabled');
        // Release gating via centralized helper
        if (typeof setScanUIGating === 'function') setScanUIGating(false); // REFACTORED
        // Persist run=NO reliably before any potential next action
        await persistRunStateNo();

        // Buka kunci daftar DEX dan refresh header tabel.
        try {
            if (typeof window !== 'undefined') { window.__LOCKED_DEX_LIST = null; }
            if (typeof window.renderMonitoringHeader === 'function' && typeof window.computeActiveDexList === 'function') {
                window.renderMonitoringHeader(window.computeActiveDexList());
            }
        } catch(_) {}

        // Jika auto-run aktif, mulai countdown untuk scan berikutnya.
        try {
            if (window.AUTORUN_ENABLED === true) {
                const total = 10; // seconds
                let remain = total;
                const $cd = $('#autoRunCountdown');
                // Disable UI while waiting, similar to running state
                $('#startSCAN').prop('disabled', true).addClass('uk-button-disabled'); // REFACTORED
                $('#stopSCAN').show().prop('disabled', false);
                if (typeof setScanUIGating === 'function') setScanUIGating(true);
                const tick = () => {
                    if (!window.AUTORUN_ENABLED) { clearInterval(window.__autoRunInterval); window.__autoRunInterval=null; return; }
                    $cd.text(`AutoRun ${remain}s`).css({ color: '#e53935', fontWeight: 'bold' }); // REFACTORED
                    remain -= 1;
                    if (remain < 0) {
                        clearInterval(window.__autoRunInterval);
                        window.__autoRunInterval = null;
                        $cd.text('').css({ color: '', fontWeight: '' }); // REFACTORED
                        // Trigger new scan using current filters/selection
                        $('#startSCAN').trigger('click');
                    }
                };
                clearInterval(window.__autoRunInterval); // REFACTORED
                window.__autoRunInterval = setInterval(tick, 1000);
                tick();
            }
        } catch(_) {}
    }

    processTokens(flatTokens, tableBodyId);
}


/**
 * Stops the currently running scanner.
 * Ini adalah "hard stop" yang akan me-reload halaman.
 */
async function stopScanner() {
    isScanRunning = false;
    try { cancelAnimationFrame(animationFrameId); } catch(_) {}
    clearInterval(window.__autoRunInterval);
    window.__autoRunInterval = null;
    setPageTitleForRun(false);
    if (typeof form_on === 'function') form_on();

    // === RELEASE GLOBAL SCAN LOCK (MANUAL STOP) ===
    try {
        // Clear global scan lock
        const filterKey = typeof getActiveFilterKey === 'function' ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
        if (typeof clearGlobalScanLock === 'function') {
            clearGlobalScanLock(filterKey);
            // console.log('[SCANNER] Global scan lock released (manual stop):', filterKey);
        }

        // Clear per-tab scanning state
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('TAB_SCANNING');
            sessionStorage.removeItem('TAB_SCAN_CHAIN');
            sessionStorage.removeItem('TAB_SCAN_START');
            sessionStorage.setItem('APP_FORCE_RUN_NO', '1');
        }

        // Notify TabManager untuk broadcast ke tab lain
        if (window.TabManager && typeof window.TabManager.notifyScanStop === 'function') {
            window.TabManager.notifyScanStop();
            // console.log(`[SCANNER] Tab ${window.getTabId()} stopped scanning (manual stop)`);
        }
    } catch(e) {
        // console.error('[SCANNER] Error releasing scan state on manual stop:', e);
    }

    // Simpan state 'run:NO' dan update indikator UI sebelum reload.
    await persistRunStateNo();
    location.reload();
}

/**
 * Soft-stop scanner without reloading the page.
 * Useful before running long operations (e.g., Update Wallet CEX).
 */
function stopScannerSoft() {
    isScanRunning = false;
    try { cancelAnimationFrame(animationFrameId); } catch(_) {}

    // === RELEASE GLOBAL SCAN LOCK (SOFT STOP) ===
    try {
        // Clear global scan lock
        const filterKey = typeof getActiveFilterKey === 'function' ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
        if (typeof clearGlobalScanLock === 'function') {
            clearGlobalScanLock(filterKey);
            // console.log('[SCANNER] Global scan lock released (soft stop):', filterKey);
        }

        // Clear per-tab scanning state
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('TAB_SCANNING');
            sessionStorage.removeItem('TAB_SCAN_CHAIN');
            sessionStorage.removeItem('TAB_SCAN_START');
        }

        // Notify TabManager untuk broadcast ke tab lain
        if (window.TabManager && typeof window.TabManager.notifyScanStop === 'function') {
            window.TabManager.notifyScanStop();
            // console.log(`[SCANNER] Tab ${window.getTabId()} soft stopped scanning`);
        }
    } catch(e) {
        // console.error('[SCANNER] Error releasing scan state on soft stop:', e);
    }

    // Simpan state 'run:NO' tanpa me-reload halaman.
    try { (async()=>{ await persistRunStateNo(); })(); } catch(_) {}
    clearInterval(window.__autoRunInterval);
    window.__autoRunInterval = null;
    if (typeof form_on === 'function') form_on();
}

/**
 * Memperbarui banner info di atas untuk menunjukkan chain mana saja yang sedang dipindai.
 * @param {string[]} [seedChains] - Daftar awal chain yang akan ditampilkan.
 */
function updateRunningChainsBanner(seedChains) {
    try {
        const setKeys = new Set();
        if (Array.isArray(seedChains)) seedChains.forEach(c => { if (c) setKeys.add(String(c).toLowerCase()); });
        const cache = (typeof window.RUN_STATES === 'object' && window.RUN_STATES) ? window.RUN_STATES : {};
        Object.keys(window.CONFIG_CHAINS || {}).forEach(k => { if (cache[String(k).toLowerCase()]) setKeys.add(String(k).toLowerCase()); });
        const labels = Array.from(setKeys).map(k => {
            const cfg = (window.CONFIG_CHAINS || {})[k] || {};
            return (cfg.Nama_Pendek || cfg.Nama_Chain || k).toString().toUpperCase();
        });
        // If multichain mode is running, prepend MULTICHAIN flag
        try { if (cache.multichain) labels.unshift('MULTICHAIN'); } catch(_) {}
        if (labels.length > 0) {
            $('#infoAPP').html(` RUN SCANNING: ${labels.join(' | ')}`).show();
        } else {
            // No running chains → clear banner
            $('#infoAPP').text('').hide();
        }
    } catch(_) {}
}

try { window.updateRunningChainsBanner = window.updateRunningChainsBanner || updateRunningChainsBanner; } catch(_){}

/**
 * Helper terpusat untuk menyimpan state `run: 'NO'` ke storage,
 * dan memperbarui indikator UI yang relevan.
 */
async function persistRunStateNo() {
    try {
        const key = (typeof getActiveFilterKey === 'function') ? getActiveFilterKey() : 'FILTER_MULTICHAIN';
        const cur = (typeof getFromLocalStorage === 'function') ? (getFromLocalStorage(key, {}) || {}) : {};
        if (typeof saveToLocalStorageAsync === 'function') {
            await saveToLocalStorageAsync(key, Object.assign({}, cur, { run: 'NO' }));
        } else {
            setAppState({ run: 'NO' });
        }
        if (typeof window.updateRunStateCache === 'function') { try { window.updateRunStateCache(key, { run: 'NO' }); } catch(_) {} }
    } catch(_) { try { setAppState({ run: 'NO' }); } catch(__) {} }
    try {
        if (typeof window.updateRunStateCache === 'function') {
            try { window.updateRunStateCache(getActiveFilterKey(), { run: 'NO' }); } catch(_) {}
        }
        try { (window.CURRENT_CHAINS || []).forEach(c => window.updateRunStateCache(`FILTER_${String(c).toUpperCase()}`, { run: 'NO' })); } catch(_) {}
    } catch(_){}
    try {
        if (typeof window.updateRunningChainsBanner === 'function') window.updateRunningChainsBanner();
        if (typeof window.updateToolbarRunIndicators === 'function') window.updateToolbarRunIndicators();
    } catch(_){}
}

// =================================================================================
// EXPORT TO APP NAMESPACE
// =================================================================================
// Register scanner functions to window.App.Scanner for use by main.js
if (typeof window !== 'undefined' && window.App && typeof window.App.register === 'function') {
    window.App.register('Scanner', {
        startScanner,
        stopScanner,
        stopScannerSoft,
        // Return per-tab scanning state (not global)
        isScanRunning: () => isThisTabScanning(),
        // Expose helper untuk external access
        isThisTabScanning: isThisTabScanning
    });
}

// Expose untuk backward compatibility
if (typeof window !== 'undefined') {
    window.isThisTabScanning = isThisTabScanning;
}

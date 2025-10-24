// Token Price Monitor Application - Updated for Frontend API Calls
const DexList = [ 'Matcha','KyberSwap','1inch','ODOS','OKXDEX','LIFI'];
const CexList = ['Binance', 'MEXC', 'Gateio', 'INDODAX'];

const CexShortMap = {
    Binance: 'BINC',
    MEXC: 'MEXC',
    Gateio: 'GATE',
    INDODAX: 'INDX'
};

const ratePrice = {}; // Menyimpan semua kurs mata uang (misal: IDR)

class TokenPriceMonitor {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.tokens = this.loadTokens();
        this.settings = this.loadSettings();
        this.currentEditingToken = null;        
        this.searchKeyword = '';
        this.sortAscending = true;
        this.selectedChains = JSON.parse(localStorage.getItem('MULTIALL_CHAINS')) || [];
        this.isAutorun = false;
        this.autorunTimer = null;

        this.init();

    }

    // Initialize the application
    init() {
        this.selectedChains = JSON.parse(localStorage.getItem('MULTIALL_CHAINS')) || [];

        this.loadTokenTable();
        this.updateStats();
        this.bindEvents();
        this.loadSettingsForm();
        this.fetchGasTokenPrices();
        this.SearchCTokenMonitoring(); 
        this.generateEmptyTable();
        this.fetchUSDTtoIDRRate();
        this.initializeChainCheckbox();
        this.initPairSymbolAutocomplete();

        // Sinkronkan status toggle sorting saat init
        try {
            const onA = this.sortAscending === true;
            const sel = onA ? '.sort-toggle input[value="opt_A"]' : '.sort-toggle input[value="opt_Z"]';
            const $inp = $(sel);
            if ($inp.length) {
                $inp.prop('checked', true);
                $('.sort-toggle').removeClass('uk-button-primary');
                $inp.closest('.sort-toggle').addClass('uk-button-primary');
            }
        } catch(_) {}

         // ✅ Set timeout global dari settings ke window
        const timeoutValue = this.settings?.TimeoutCount || 4000;
        window.timeoutApi = timeoutValue;

        const lastWalletUpdate = localStorage.getItem("MULTIALL_ACTIONS");
        $('#infostatus').html(lastWalletUpdate ? lastWalletUpdate : "???");

         // 🚫 Jika setting belum valid, nonaktifkan semua tombol
        if (this.isSettingInvalid()) {
            $('#CheckPrice').prop('disabled', true);
            $('#autorunBtn').prop('disabled', true);
            $('#StopScan').addClass('d-none');

            alert("⚠️ Silakan Setting Aplikasi Dahulu");

            // Nonaktifkan klik pada tab lain (bukan disembunyikan)
            const disableTab = (selector) => {
                const tabBtn = $(`#tabIconController button[data-bs-target="${selector}"]`);
                tabBtn.addClass('disabled').css({
                    'pointer-events': 'none',
                    'opacity': 0.5
                });
            };

            disableTab('#priceMonitoring');
            disableTab('#tokenManagement');
            disableTab('#portfolioTab');
            disableTab('#WalletCEX');

            $('#setting-tab').addClass('petunjuk');

            this.showAlert('⚠️ Silakan Isi Nama dan Wallet!', 'warning');
            return;
        }

        this.dexErrorCount = {}; // untuk menyimpan jumlah error per DEX
        DexList.forEach(dex => this.dexErrorCount[dex] = 0);

    }

    incrementDexError(dexName) {
        if (!this.dexErrorCount[dexName]) {
            this.dexErrorCount[dexName] = 0;
        }
        this.dexErrorCount[dexName]++;
        this.updateDexErrorBadge(dexName);
    }

    updateDexErrorBadge(dexName) {
        const count = this.dexErrorCount[dexName] || 0;
        const badge = $(`#errorBadge_${dexName}`);
        if (count > 0) {
            badge.text(count).removeClass('d-none');
        } else {
            badge.addClass('d-none');
        }
    }

    // Bind event handlers
    bindEvents() {

        $('#autorunBtn').on('click', () => {
            this.isAutorun = !this.isAutorun;
            const btn = $('#autorunBtn');

            // Tetap pakai ikon power saja, tidak ada teks tambahan
            btn.html('<i class="bi bi-power"></i>')
                .removeClass(this.isAutorun ? 'btn-danger' : 'btn-success') // Hapus warna lama
                .addClass(this.isAutorun ? 'btn-success' : 'btn-danger');   // Tambah warna baru
        });

        $('#tokenSearch').on('input', () => {
            this.loadTokenTable();
        });

        $('.filter-chain-checkbox').on('change', () => {
            this.loadTokenTable();
        });

        $('#mainTabs .disabled a').on('click', function (e) {
            e.preventDefault();
        });

       $(document).off('click', '.btn-save-inline').on('click', '.btn-save-inline', (e) => {
            const btn = $(e.currentTarget);
            const tokenId = btn.data('token-id');

            const token = this.tokens.find(t => t.id.toString() === tokenId.toString());
            if (!token) return;

            // Ambil semua input dalam kolom <td> yang sama
            const $container = btn.closest('td');
            const $inputs = $container.find('.inline-edit');

            $inputs.each((_, input) => {
                const $input = $(input);
                const fieldName = $input.data('field');
                const value = $input.val();

                if (['modalCexToDex', 'modalDexToCex', 'decimals', 'pairDecimals'].includes(fieldName)) {
                    const parsed = parseFloat(value);
                    if (!isNaN(parsed)) {
                        token[fieldName] = parsed;
                    }
                } else {
                    token[fieldName] = value;
                }
            });

            this.saveTokensToStorage(true);
            this.showAlert(`✅ SIMPAN perubahan untuk ${token.symbol} berhasil!`, 'success');

            this.logAction(`UBAH DATA KOIN ${(token.symbol).toUpperCase()}`);
            console.log(`📝 Menyimpan field dari token ${token.symbol}:`, token);

             this.loadTokenTable();
             this.updateStats();
        });

        $(document).off('change', '.update-cex-checkbox').on('change', '.update-cex-checkbox', (e) => {
            const checkbox = $(e.target);
            const tokenId = checkbox.data('token-id');
            const cexName = checkbox.data('cex');
            const isChecked = checkbox.is(':checked');

            const tokenIndex = this.tokens.findIndex(t => t.id.toString() === tokenId.toString());
            if (tokenIndex === -1) return;

            const token = this.tokens[tokenIndex];
            if (isChecked) {
                if (!token.selectedCexs.includes(cexName)) {
                    token.selectedCexs.push(cexName);
                }
            } else {
                token.selectedCexs = token.selectedCexs.filter(c => c !== cexName);
            }

            this.saveTokensToStorage(true);

            const emoji = isChecked ? '✅' : '❌';
            const alertType = isChecked ? 'primary' : 'danger';
            this.showAlert(`${emoji} ${cexName} ${isChecked ? 'ditambahkan ke' : 'dihapus dari'} token ${token.symbol}`, alertType);

             this.logAction(`UBAH DATA KOIN`);
        });

        $(document).off('change', '.update-dex-checkbox').on('change', '.update-dex-checkbox', (e) => {
            const checkbox = $(e.target);
            const tokenId = checkbox.data('token-id');
            const dexName = checkbox.data('dex');
            const isChecked = checkbox.is(':checked');

            const tokenIndex = this.tokens.findIndex(t => t.id.toString() === tokenId.toString());
            if (tokenIndex === -1) return;

            const token = this.tokens[tokenIndex];

            if (isChecked) {
                if (token.selectedDexs.length >= 4) {
                    // Batasi hanya 4 DEX
                    checkbox.prop('checked', false); // batalkan centang
                    this.showAlert('⚠️ Maksimal 4 DEX per token yang diperbolehkan.', 'warning');
                    return;
                }

                if (!token.selectedDexs.includes(dexName)) {
                    token.selectedDexs.push(dexName);
                }
            } else {
                token.selectedDexs = token.selectedDexs.filter(d => d !== dexName);
            }

            this.saveTokensToStorage(true);

            const emoji = isChecked ? '✅' : '❌';
            const alertType = isChecked ? 'primary' : 'danger';
            this.showAlert(`${emoji} ${dexName} ${isChecked ? 'ditambahkan ke' : 'dihapus dari'} token ${token.symbol}`, alertType);

            this.logAction(`UBAH DATA KOIN`);
        });

        $(document).off('change', '.form-check-input.dex-option').on('change', '.form-check-input.dex-option', function () {
            const checked = $('.form-check-input.dex-option:checked');
            if (checked.length > 4) {
                $(this).prop('checked', false);
                alert('⚠️ Maksimal hanya 4 DEX yang boleh dipilih.');
            }
        });

        $(document).on('change', '.chainFilterCheckbox', () => {
            const selectedChains = $('.chainFilterCheckbox:checked').map(function () {
                return $(this).val();
            }).get();

            localStorage.setItem('MULTIALL_CHAINS', JSON.stringify(selectedChains));
            this.selectedChains = selectedChains; // <-- Penting!

            this.generateEmptyTable();
            this.updateStats();
            location.reload();
        });

        $('#CheckPrice').on('click', async () => {
            //reset 0 info error tiap DEX
            this.dexErrorCount = {};
            DexList.forEach(d => this.dexErrorCount[d] = 0);
            DexList.forEach(d => this.updateDexErrorBadge(d));
            
            // Inisialisasi sekali saja di luar loop (bukan tiap iterasi sinyal)
            this.highestPNLSignal = {}; // ✅ Reset setiap scan baru

            // Aktifkan tab Price Monitoring
            $('#mainTabs a[href="#priceMonitoring"]').tab('show');
            
           // Nonaktifkan klik pada tab lain (bukan disembunyikan)
            const disableTab = (selector) => {
                const tabBtn = $(`#tabIconController button[data-bs-target="${selector}"]`);
                tabBtn.addClass('disabled').css({
                    'pointer-events': 'none',
                    'opacity': 0.5
                });
            };

            const enableTab = (selector) => {
                const tabBtn = $(`#tabIconController button[data-bs-target="${selector}"]`);
                tabBtn.removeClass('disabled').css({
                    'pointer-events': '',
                    'opacity': 1
                });
            };

            disableTab('#tokenManagement');
            disableTab('#apiSettings');
            disableTab('#portfolioTab');
            disableTab('#WalletCEX');

            // Tampilkan kembali panel sinyal
            $('#dexSignals').show();

            // Nonaktifkan tombol-tombol selama proses
            $('#CheckPrice').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> SCAN..');
            $('#autorunBtn').prop('disabled', true);
            $('#monitoringSearch').prop('disabled', true).val('');
            $('#sortByToken').prop('disabled', true);
            $('#tokenSearch').prop('disabled', true);

            // Tampilkan tombol Stop
            $('#StopScan').removeClass('d-none').prop('disabled', false);

            // Inisialisasi sinyal PNL
            this.initPNLSignalStructure();

            // Update status ke Telegram jika diaktifkan
            this.sendStatusTELE(this.settings.UserName, 'ONLINE');

            // Kosongkan tabel sebelum mulai
            this.generateEmptyTable();

            // Jalankan proses scan harga token
            await this.CheckPrices();

            // Setelah selesai proses (manual atau autorun)
            if (this.isAutorun) {
                // AutoRun: semua tombol tetap disable, hanya Stop yang aktif
                $('#CheckPrice').prop('disabled', true);
                $('#autorunBtn').prop('disabled', true);
                $('#monitoringSearch').prop('disabled', true);
                $('#sortByToken').prop('disabled', true);
                $('#tokenSearch').prop('disabled', true);
                $('#StopScan').removeClass('d-none').prop('disabled', false);

                // Jalankan countdown dan trigger ulang CheckPrice
                this.startAutorunCountdown(() => $('#CheckPrice').trigger('click'));
            } else {
                // Mode Manual: kembalikan tab & aktifkan tombol-tombol
                enableTab('#tokenManagement');
                enableTab('#apiSettings');
                enableTab('#portfolioTab');
                enableTab('#WalletCEX');

                $('#StopScan').addClass('d-none');
                $('#monitoringSearch').prop('disabled', false);
                $('#sortByToken').prop('disabled', false);
                $('#tokenSearch').prop('disabled', false);
                $('#autorunBtn').prop('disabled', false);

                $('#CheckPrice').prop('disabled', false).html('<i class="bi bi-play-fill"></i>Check Price');

                // Bersihkan countdown jika ada
                $('#autorunCountdown').text('');
            }
        });

       $('#StopScan,#reload').on('click', () => {
            clearInterval(this.autorunTimer);
            $('#autorunCountdown').remove();

            // Aktifkan tombol kembali jika reload dibatalkan (optional)
            $('#CheckPrice').prop('disabled', false);
            $('#autorunBtn').prop('disabled', false);
            $('#monitoringSearch').prop('disabled', false);
            $('#sortByToken').prop('disabled', false);
            $('#tokenSearch').prop('disabled', false);

            location.reload(); // Reload akan menyapu semuanya
        });


        $('#WalletCEX').on('click', () => {
            if (confirm("Apakah Anda yakin ingin UPDATE WALLET CEX?")) {
                 $('#CheckPrice').prop('disabled', true);
                 $('#autorunBtn').prop('disabled', true);
                checkAllCEXWalletsPerChain();
                 // Nonaktifkan klik pada tab lain (bukan disembunyikan)
           
                 const disableTab = (selector) => {
                const tabBtn = $(`#tabIconController button[data-bs-target="${selector}"]`);
                tabBtn.addClass('disabled').css({
                    'pointer-events': 'none',
                    'opacity': 0.5
                });
            };
            
            disableTab('#priceMonitoring');
            disableTab('#tokenManagement');
            disableTab('#apiSettings');
            disableTab('#portfolioTab');
            disableTab('#WalletCEX');
            }
        });


      //  Save token button
        $('#saveTokenBtn').on('click', (e) => {
            e.preventDefault();     
            this.saveToken();
        });

        $(document).on('click', 'a.nav-link.active[href="#priceMonitoring"]', function(e) {
            e.preventDefault(); // Mencegah default tab switching jika perlu
            location.reload();  // Melakukan reload halaman
        });


        // Save settings button
        $('#saveSettingsBtn').on('click', (e) => {
            e.preventDefault();     
            this.saveSettings();
        });

        // Token form reset when modal opens
        $('#tokenModal').on('show.bs.modal', () => {
            if (!this.currentEditingToken) {
                this.resetTokenForm();
            }
        });

        // Clear editing token when modal closes
        $('#tokenModal').on('hidden.bs.modal', () => {
            this.currentEditingToken = null;
            $('#modalTitle').text('Add New Token');
        });

        $('#exportTokensBtn').on('click', () => {
            const tokens = app.tokens;
            if (!tokens.length) return app.showAlert('❌ Tidak ada token untuk diexport!', 'warning');

            const headers = [
                'id', 'symbol', 'pairSymbol', 'contractAddress', 'pairContractAddress',
                'decimals', 'pairDecimals', 'chain',
                'modalCexToDex', 'modalDexToCex',
                ...CexList,  // pakai nama asli sebagai header
                ...DexList,
                'isActive'
            ];

            const rows = tokens.map(t => {
                const row = [
                    t.id,
                    t.symbol,
                    t.pairSymbol,
                    t.contractAddress,
                    t.pairContractAddress,
                    t.decimals,
                    t.pairDecimals,
                    t.chain,
                    t.modalCexToDex,
                    t.modalDexToCex
                ];

                CexList.forEach(cex => row.push(t.selectedCexs.includes(cex).toString()));
                DexList.forEach(dex => row.push(t.selectedDexs.includes(dex).toString()));
                row.push(t.isActive);

                return row;
            });

            const csvText = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
            const blob = new Blob([csvText], { type: 'text/tab-separated-values;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'tokens-multiall.csv';
            app.logAction(`EXPORT DATA KOIN`);
            link.click();
        });

        $('#importTokensBtn').on('click', () => {
            $('#importTokensInput').click();
        });

        $('#importTokensInput').on('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (event) => {
                const csvText = event.target.result;
                const lines = csvText.split('\n').map(line => line.trim()).filter(Boolean);

                if (lines.length < 2) {
                    app.showAlert('❌ Format file tidak valid atau kosong.', 'danger');
                    return;
                }

                const delimiter = lines[0].includes('\t') ? '\t' : (
                    lines[0].includes(',') ? ',' : null
                );

                if (!delimiter) {
                    app.showAlert('❌ Format file tidak valid. Gunakan Tab atau Koma sebagai pemisah.', 'danger');
                    return;
                }

                const headers = lines[0].split(delimiter);
                const tokens = [];
                let errorCount = 0;

                lines.slice(1).forEach((line, index) => {
                    const values = line.split(delimiter);
                    const token = {};
                    const selectedCexs = [];
                    const selectedDexs = [];

                    headers.forEach((h, i) => {
                        const val = values[i]?.trim() ?? '';

                        if (CexList.includes(h)) {
                            if (val.toLowerCase() === 'true') selectedCexs.push(h);
                        } else if (DexList.includes(h)) {
                            if (val.toLowerCase() === 'true') selectedDexs.push(h);
                        } else if (h === 'isActive') {
                            token[h] = val.toLowerCase() === 'true';
                        } else if (['modalCexToDex', 'modalDexToCex', 'decimals', 'pairDecimals', 'id'].includes(h)) {
                            token[h] = Number(val);
                        } else {
                            token[h] = val;
                        }
                    });

                    token.selectedCexs = selectedCexs;
                    token.selectedDexs = selectedDexs;

                    if (!token.symbol || !token.chain) {
                        console.warn(`⛔ Baris ${index + 2} dilewati (symbol/chain kosong):`, token);
                        errorCount++;
                        return;
                    }

                    tokens.push(token);
                });

                if (tokens.length === 0) {
                    app.showAlert('❌ Semua baris gagal diimpor. Periksa format dan isi file.', 'danger');
                    return;
                }

                // ✅ Penempatan yang benar DI SINI
                localStorage.setItem('MULTIALL_TOKENS', JSON.stringify(tokens));
                app.tokens = tokens;
                app.loadTokenTable();
                app.updateStats();

                const msg = errorCount > 0
                    ? `✅ Import selesai, ${tokens.length} token berhasil. ⚠️ ${errorCount} baris dilewati karena tidak valid.`
                    : `✅ Import berhasil, ${tokens.length} token dimuat.`;

                this.logAction(`IMPORT DATA KOIN`);
                app.showAlert(msg, 'danger');
            };

            reader.readAsText(file);
        });

        // Toggle sorting (A→Z vs Z→A) via radio buttons in toolbar
        $(document).on('change', '.sort-toggle input', (e) => {
            try {
                const val = String($(e.currentTarget).val() || '');
                this.sortAscending = (val === 'opt_A');
                // Visual state: highlight selected toggle
                $('.sort-toggle').removeClass('uk-button-primary');
                $(e.currentTarget).closest('.sort-toggle').addClass('uk-button-primary');
                // Resort tokens and rerender
                this.tokens.sort((a, b) => this.sortAscending
                    ? a.symbol.localeCompare(b.symbol)
                    : b.symbol.localeCompare(a.symbol));
                this.generateEmptyTable();
            } catch(_) {}
        });

    }

    initializeChainCheckbox() {
        $('.chainFilterCheckbox').each((_, el) => {
            const chain = $(el).val();
            if (this.selectedChains.includes(chain)) {
                $(el).prop('checked', true);
            }
        });
    }

    startAutorunCountdown(callback) {
        clearInterval(this.autorunTimer);
        let seconds = 25;

        const $countdown = $('#autorunCountdown');

        // ✅ Reset dan tampilkan teks awal
        $countdown.text(`⏳ Autorun in ${seconds}s`).show();

        this.autorunTimer = setInterval(() => {
            seconds--;
            $countdown.text(`⏳ Autorun in ${seconds}s`);

            if (seconds <= 0) {
                clearInterval(this.autorunTimer);
                $countdown.text(''); // ✅ Kosongkan teks, tapi tidak remove elemen
                callback();
            }
        }, 1000);
    }

   initPairSymbolAutocomplete() {
        const PAIR_LIST = [
            { symbolPair: 'USDT', scAddressPair: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', desPair: '6', chain: 'POLYGON' },
            { symbolPair: 'POL', scAddressPair: '0x0000000000000000000000000000000000001010', desPair: '18', chain: 'POLYGON' },
            { symbolPair: 'ETH', scAddressPair: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', desPair: '18', chain: 'ARBITRUM' },
            { symbolPair: 'USDT', scAddressPair: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', desPair: '6', chain: 'ARBITRUM' },
            { symbolPair: 'ETH', scAddressPair: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', desPair: '18', chain: 'ETHEREUM' },
            { symbolPair: 'USDT', scAddressPair: '0xdAC17F958D2ee523a2206206994597C13D831ec7', desPair: '6', chain: 'ETHEREUM' },
            { symbolPair: 'USDC', scAddressPair: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', desPair: '6', chain: 'ETHEREUM' },
            { symbolPair: 'BNB', scAddressPair: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', desPair: '18', chain: 'BSC' },
            { symbolPair: 'USDT', scAddressPair: '0x55d398326f99059fF775485246999027B3197955', desPair: '18', chain: 'BSC' },
            { symbolPair: 'ETH', scAddressPair: '0x4200000000000000000000000000000000000006', desPair: '18', chain: 'BASE' },
            { symbolPair: 'USDC', scAddressPair: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', desPair: '6', chain: 'BASE' }
        ];


        const $input = $('#pairSymbol');
        const $suggestions = $('<ul id="pairSuggestions" class="list-group position-absolute w-30" style="z-index:999; display:none;"></ul>');
        $input.after($suggestions);

        $input.on('focus input', () => {
            const keyword = $input.val().toUpperCase().trim();
            $suggestions.empty();

            const matches = PAIR_LIST.filter(item =>
                !keyword || item.symbolPair.toUpperCase().startsWith(keyword)
            );

            if (!matches.length) {
                $suggestions.hide();
                return;
            }

            matches.forEach(item => {
                const $li = $('<li class="list-group-item list-group-item-action">')
                    .text(`${item.symbolPair} [${item.chain}]`)
                    .data('pair', item)
                    .appendTo($suggestions);
            });

            $suggestions.show();
        });

        $suggestions.on('click', 'li', function () {
            const item = $(this).data('pair');
            $('#pairSymbol').val(item.symbolPair);
            $('#pairContract').val(item.scAddressPair);
            $('#pairDecimals').val(item.desPair);
            $suggestions.hide();
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest('#pairSymbol, #pairSuggestions').length) {
                $suggestions.hide();
            }
        });
    }

    async fetchGasTokenPrices() {
    const binanceURL = 'https://api-gcp.binance.com/api/v3/ticker/price?symbols=["BNBUSDT","ETHUSDT","MATICUSDT","BTCUSDT"]';
    $('#gasTokenPrices').html(`<small class="text-white">Loading Gwei info...</small>`);

    const response = await $.getJSON(binanceURL).catch(err => {
        $('#gasTokenPrices').html('<span class="text-danger">Gagal ambil harga.</span>');
        throw new Error('Gagal ambil harga token dari Binance');
    });

    if (!response) {
        throw new Error("Respon harga token kosong dari Binance");
    }

    const tokenPrices = {};
    response.forEach(item => {
        const symbol = item.symbol.replace("USDT", "");
        tokenPrices[symbol] = parseFloat(item.price);

        if (symbol === 'BTC') $('#btcPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
        if (symbol === 'BNB') $('#bnbPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
        if (symbol === 'ETH') $('#ethPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
        if (symbol === 'MATIC') $('#maticPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
    });

    const Web3 = window.Web3;
    const gasTextParts = [];
    const gasTokenInfo = {};

    // 🔍 Ambil selectedChains dari localStorage
    let selectedChains = [];
    try {
        const stored = localStorage.getItem("MULTIALL_CHAINS");
        if (stored) {
            selectedChains = JSON.parse(stored).map(c => c.toLowerCase());
        }
    } catch (e) {
        console.warn("MULTIALL_CHAINS invalid:", e);
    }

    // 🔗 Filter hanya chain yang terpilih
    const supportedChains = Object.keys(CHAIN_CONFIG)
        .filter(key => CHAIN_CONFIG[key].rpc && selectedChains.includes(key.toLowerCase()))
        .map(key => ({
            key,
            label: CHAIN_CONFIG[key].short,
            symbol: CHAIN_CONFIG[key].symbol,
            gasLimit: CHAIN_CONFIG[key].gasLimit
        }));

    let successCount = 0;

    for (const chain of supportedChains) {
        const key = chain.key || chain.symbol;
        const symbol = chain.symbol;
        const rpcUrl = CHAIN_CONFIG[key.toLowerCase()]?.rpc || '';
        let tokenPrice = tokenPrices[symbol];

        if (!tokenPrice && symbol === 'POL') {
            tokenPrice = tokenPrices['MATIC'];
        }

        if (!rpcUrl || !tokenPrice) {
            gasTextParts.push(`<span class='badge bg-light text-dark fs-8'>${chain.label} [n/a]</span>`);
            continue;
        }

        try {
            const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
            const block = await web3.eth.getBlock("pending");
            const baseFee = block?.baseFeePerGas ? parseInt(block.baseFeePerGas) : await web3.eth.getGasPrice();

            const gwei = (baseFee / 1e9) * 2;
            const gasUSDT = (gwei * chain.gasLimit * tokenPrice) / 1e9;

            console.log(`🟢 ${chain.label} | Gwei: ${gwei.toFixed(2)} | Token: ${symbol} | Price: $${tokenPrice} | Fee ≈ $${gasUSDT.toFixed(4)}`);
            
            gasTextParts.push(
                `<span class='badge bg-secondary text-white fs-8 fw-bold'>🔥 ${chain.label} [${gwei.toFixed(2)} | $${gasUSDT.toFixed(4)}]</span>`
            );

            gasTokenInfo[key] = {
                symbol,
                gwei,
                tokenPrice,
                gasFeeUSDT: gasUSDT,
                gasLimit: chain.gasLimit
            };

            successCount++;
        } catch (err) {
            console.error(`❌ Gagal ambil data gas untuk ${chain.label}:`, err);
            gasTextParts.push(`<span class='badge bg-danger fs-8'>${chain.label} [err]</span>`);
        }
    }

    $('#gasTokenPrices').html(gasTextParts.join(" "));
    localStorage.setItem('MULTIALL_GAS', JSON.stringify(gasTokenInfo));

    if (successCount === 0) {
        throw new Error("Gagal mengambil data gas untuk semua chain.");
    }
}

    async fetchGasTokenPricesLAMA() {
        const binanceURL = 'https://api-gcp.binance.com/api/v3/ticker/price?symbols=["BNBUSDT","ETHUSDT","MATICUSDT","BTCUSDT"]';
        $('#gasTokenPrices').html(`<small class="text-white">Loading Gwei info...</small>`);

        const response = await $.getJSON(binanceURL).catch(err => {
            $('#gasTokenPrices').html('<span class="text-danger">Gagal ambil harga.</span>');
            throw new Error('Gagal ambil harga token dari Binance');
        });

        if (!response) {
            throw new Error("Respon harga token kosong dari Binance");
        }

        const tokenPrices = {};
        response.forEach(item => {
            const symbol = item.symbol.replace("USDT", "");
            tokenPrices[symbol] = parseFloat(item.price);

            if (symbol === 'BTC') $('#btcPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
            if (symbol === 'BNB') $('#bnbPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
            if (symbol === 'ETH') $('#ethPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
            if (symbol === 'MATIC') $('#maticPrice').text(`$${tokenPrices[symbol].toFixed(2)}`);
        });

        const Web3 = window.Web3;
        const gasTextParts = [];
        const gasTokenInfo = {};

        const supportedChains = Object.keys(CHAIN_CONFIG)
            .filter(key => CHAIN_CONFIG[key].rpc)
            .map(key => ({
                key,
                label: CHAIN_CONFIG[key].short,
                symbol: CHAIN_CONFIG[key].symbol,
                gasLimit: CHAIN_CONFIG[key].gasLimit
            }));

        let successCount = 0;

        for (const chain of supportedChains) {
            const key = chain.key || chain.symbol;
            const symbol = chain.symbol;
            const rpcUrl = CHAIN_CONFIG[key.toLowerCase()]?.rpc || CHAIN_CONFIG[symbol.toLowerCase()]?.rpc || '';
            let tokenPrice = tokenPrices[symbol];

            if (!tokenPrice && symbol === 'POL') {
                tokenPrice = tokenPrices['MATIC'];
            }

            if (!rpcUrl || !tokenPrice) {
                gasTextParts.push(`<span class='badge bg-light text-dark fs-8'>${chain.label} [n/a]</span>`);
                continue;
            }

            try {
                const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
                const block = await web3.eth.getBlock("pending");
                const baseFee = block?.baseFeePerGas ? parseInt(block.baseFeePerGas) : await web3.eth.getGasPrice();

                const gwei = (baseFee / 1e9) * 2;
                const gasUSDT = (gwei * chain.gasLimit * tokenPrice) / 1e9;

                console.log(`🟢 ${chain.label} | Gwei: ${gwei.toFixed(2)} | Token: ${symbol} | Price: $${tokenPrice} | Fee ≈ $${gasUSDT.toFixed(4)}`);
                
                gasTextParts.push(
                    `<span class='badge bg-secondary text-white fs-8 fw-bold'>🔥 ${chain.label} [${gwei.toFixed(2)} | $${gasUSDT.toFixed(4)}]</span>`
                );

                gasTokenInfo[key] = {
                    symbol,
                    gwei,
                    tokenPrice,
                    gasFeeUSDT: gasUSDT,
                    gasLimit: chain.gasLimit
                };

                successCount++;
            } catch (err) {
                console.error(`❌ Gagal ambil data gas untuk ${chain.label}:`, err);
                gasTextParts.push(`<span class='badge bg-danger fs-8'>${chain.label} [err]</span>`);
            }
        }

        $('#gasTokenPrices').html(gasTextParts.join(" "));
        localStorage.setItem('MULTIALL_GAS', JSON.stringify(gasTokenInfo));

        if (successCount === 0) {
            throw new Error("Gagal mengambil data gas untuk semua chain.");
        }
    }

    fetchUSDTtoIDRRate() {
        const targetURL = 'https://indodax.com/api/ticker/usdtidr';
        const fullURL = withProxy(targetURL); // menggunakan fungsi proxy

        $.getJSON(fullURL)
            .done(response => {
                const rate = parseFloat(response.ticker.last);
                window.ExchangeRates = window.ExchangeRates || {};
                window.ExchangeRates.IndodaxUSDT = rate;

                $('#usdtIdrPrice').text(`Rp ${rate.toLocaleString('id-ID')}`);
            })
            .fail(err => {
                console.warn('[✘] Failed to fetch USDT → IDR rate:', err);
            });
    }

    generateEmptyTable() {
        const tbody = $('#priceTableBody');
        tbody.empty();

        if (typeof this.sortAscending === 'undefined') {
            this.sortAscending = true;
        }

        const activeTokens = this.tokens
            .filter(t => t.isActive)
            .filter(t => this.selectedChains.includes(t.chain))
            .filter(t => {
                const keyword = (this.searchKeyword || '').toLowerCase();
                return (
                    t.symbol.toLowerCase().includes(keyword) ||
                    t.pairSymbol.toLowerCase().includes(keyword)
                );
            })
            .sort((a, b) => {
                const symbolA = a.symbol.toLowerCase();
                const symbolB = b.symbol.toLowerCase();
                return this.sortAscending
                    ? symbolA.localeCompare(symbolB)
                    : symbolB.localeCompare(symbolA);
            });

        if (activeTokens.length === 0) {
            tbody.html(`<tr><td colspan="16" class="text-center text-danger py-7">DATA TIDAK DITEMUAKN / TIDAK ADA DAFTAR TOKEN</td></tr>`);
            return;
        }

        let rowIndex = 0;

        for (const token of activeTokens) {
            for (const cex of token.selectedCexs) {
                const selectedDexs = token.selectedDexs || [];
                const limitedDexList = selectedDexs.slice(0, 4); // maksimal 4
                const fillerCount = 4 - limitedDexList.length;

                const rowId = `token-row-${token.id}-${cex.replace(/\W+/g, '').toLowerCase()}`;

                // 🔒➡️ CEX ke DEX
                const dexCEXtoDEX = limitedDexList.map(dex => {
                    const isSelected = selectedDexs.includes(dex);
                    const icon = isSelected ? ` ${dex} 🔒` : `➖`;
                    const cellId = `cell_${token.symbol}_${token.pairSymbol}_${token.chain}_${cex}_${dex}`.toLowerCase().replace(/\W+/g, '');
                    return `<td id="${cellId}" class="dex-price-cell text-center">${icon}</td>`;
                }).join('');

                const fillerCEXtoDEX = Array(fillerCount).fill('<td class="dex-price-cell text-center">➖</td>').join('');

                // 🔒⬅️ DEX ke CEX
                const dexDEXtoCEX = limitedDexList.map(dex => {
                    const isSelected = selectedDexs.includes(dex);
                    const icon = isSelected ? ` ${dex} 🔒` : `➖`;
                    const cellId = `cell_${token.pairSymbol}_${token.symbol}_${token.chain}_${dex}_${cex}`.toLowerCase().replace(/\W+/g, '');
                    return `<td id="${cellId}" class="dex-price-cell text-center">${icon}</td>`;
                }).join('');


                const fillerDEXtoCEX = Array(fillerCount).fill('<td class="dex-price-cell text-center">➖</td>').join('');

                const detailHTML = this.createTokenDetailContent(token, cex);
                const orderbookLeftId = `orderbook_cex_to_dex_${cex}_${token.chain}_${token.symbol}_${token.pairSymbol}`;
                const orderbookRightId = `orderbook_dex_to_cex_${cex}_${token.chain}_${token.pairSymbol}_${token.symbol}`;

                const stripClass = rowIndex % 2 === 0 ? 'strip-even' : 'strip-odd';

                const rowHTML = `
                    <tr id="${rowId}" class="token-data-row text-center ${stripClass} fs-8 align-middle">
                        <td id="${orderbookLeftId.toLowerCase()}">${cex}🔒</td>
                        ${dexCEXtoDEX}${fillerCEXtoDEX}
                        <td class="token-detail-cell">${detailHTML}</td>
                        ${dexDEXtoCEX}${fillerDEXtoCEX}
                        <td id="${orderbookRightId.toLowerCase()}">${cex}🔒</td>
                    </tr>
                `;

                tbody.append(rowHTML);
                rowIndex++;
            }
        }
    }


    generateOrderBook(token, priceData, cexName, direction) {
        const base = token.symbol.toUpperCase();        // e.g. AUCTION
        const quote = token.pairSymbol.toUpperCase();   // e.g. BNB
        const chain = token.chain.toLowerCase();        // e.g. bsc

        const cexData = priceData.analisis_data?.[direction]?.[cexName];
        if (!cexData) return;

        const baseToUSDT = cexData[`${base}ToUSDT`] || {};
        const isIndodax = cexName.toLowerCase() === 'indodax';

        // 🛠️ Format orderbook 5 baris
        const formatOrder = (orders = [], type = 'buy', tokenSymbol = '') => {
            // ✅ Warna khusus Indodax dibalik
            let colorClass;
            if (isIndodax) {
                colorClass = type === 'sell' ? 'text-danger' : 'text-success';  // SELL → merah, BUY → hijau
            } else {
                colorClass = type === 'sell' ? 'text-success' : 'text-danger';  // SELL → hijau, BUY → merah
            }

            // Dummy jika token = USDT
            if (tokenSymbol === 'USDT') {
                const dummy = `<span class="${colorClass}">1.0000$ : 10000.00$</span>`;
                return `${dummy}<br>${dummy}<br>${dummy}`;
            }

            // ✅ Sorting order sesuai jenis dan CEX
            const sorted = [...(orders || [])].sort((a, b) => {
                const pa = parseFloat(a.price);
                const pb = parseFloat(b.price);
                if (isIndodax) {
                    return type === 'buy' ? pa - pb : pb - pa;  // BUY → ASC, SELL → DESC
                } else {
                    return type === 'buy' ? pb - pa : pa - pb;  // BUY → DESC, SELL → ASC
                }
            });

            return sorted.slice(0, 5).map(o => {
                const price = parseFloat(o.price);
                const qty = parseFloat(o.qty);
                const vol = o.vol !== undefined ? parseFloat(o.vol) : price * qty;
                const priceStr = PriceUtils.formatPrice(price);
                const volumeStr = vol.toFixed(2);
                return `<span class="${colorClass}">${priceStr}$ : ${volumeStr}$</span>`;
            }).join('<br>');
        };

        // 🔁 Orderbook Teks (dibalik untuk Indodax)
        let leftText, rightText;

        if (isIndodax) {
            leftText = [
                `<span class="text-secondary fw-bold">${base} → ${quote}</span>`,
                formatOrder(baseToUSDT.topAsks, 'sell', base)  // SELL base di kiri
            ].filter(Boolean).join('<br>');

            rightText = [
                `<span class="text-secondary fw-bold">${quote} → ${base}</span>`,
                formatOrder(baseToUSDT.topBids, 'buy', base)   // BUY base di kanan
            ].filter(Boolean).join('<br>');
        } else {
            leftText = [
                `<span class="text-secondary fw-bold">${base} → ${quote}</span>`,
                formatOrder(baseToUSDT.topBids, 'buy', base)
            ].filter(Boolean).join('<br>');

            rightText = [
                `<span class="text-secondary fw-bold">${quote} → ${base}</span>`,
                formatOrder(baseToUSDT.topAsks, 'sell', base)
            ].filter(Boolean).join('<br>');
        }

        // 🧩 ID target kolom
        
        const orderbookRightId = `orderbook_dex_to_cex_${cexName.toLowerCase()}_${chain}_${quote.toLowerCase()}_${base.toLowerCase()}`;
        const orderbookLeftId = `orderbook_cex_to_dex_${cexName.toLowerCase()}_${chain}_${base.toLowerCase()}_${quote.toLowerCase()}`;

        if (direction === 'dex_to_cex') {
            $(`#${orderbookRightId}`).html(leftText || '-');
        } else if (direction === 'cex_to_dex') {
            $(`#${orderbookLeftId}`).html(rightText || '-');
        }
    }

    // LocalStorage operations
    loadTokens() {
        const tokens = JSON.parse(localStorage.getItem('MULTIALL_TOKENS') || '[]');
        return tokens.map(t => ({ ...t, id: String(t.id) }));
    }

    saveTokensToStorage(updateUI = false) {
        localStorage.setItem('MULTIALL_TOKENS', JSON.stringify(this.tokens));
        this.updateStats();
        if (updateUI) {
            this.loadTokenTable();
            this.bindEvents();
        }
    }

    loadSettings() {
        const settings = localStorage.getItem('MULTIALL_SETTING');
        const parsedSettings = settings ? JSON.parse(settings) : {
            tokensPerBatch: 3, // jumlah anggota
            UserName: 'XXX', // jeda antar member
            delayBetweenGrup: 400, // jeda batch
            TimeoutCount: 4000,
            PNLFilter: 0,
            WalletAddress: '-'
        };
         // Tampilkan info config ke elemen #infoConfig
        const shortened = this.shortenAddress(parsedSettings.WalletAddress);
        // Buat HTML info dengan icon unicode
        const infoHTML = `
            🆔&nbsp; UserName: ${parsedSettings.UserName}<br>
            👛&nbsp; Wallets: ${shortened}<br>
            👥&nbsp; Anggota Grup: ${parsedSettings.tokensPerBatch} Koin<br>
            ⏱️&nbsp; Jeda Grup: ${parsedSettings.delayBetweenGrup}ms<br>
            ⌛&nbsp; Time Out: ${parsedSettings.TimeoutCount}ms<br>
            💰&nbsp; PNLFilter: $${parsedSettings.PNLFilter}
        `;
        $('#infoConfig').html(infoHTML);

        //console.log("DATA SETTING: ",parsedSettings); // ← log sebelum return
        return parsedSettings;
    }

    saveSettingsToStorage() {
        localStorage.setItem('MULTIALL_SETTING', JSON.stringify(this.settings));
    }

   // Token management
    addToken(tokenData) {
        const token = {
            id: Date.now().toString(),
            symbol: tokenData.symbol,
            pairSymbol: tokenData.pairSymbol,
            contractAddress: tokenData.contractAddress,
            pairContractAddress: tokenData.pairContractAddress,
            decimals: parseInt(tokenData.decimals),
            pairDecimals: parseInt(tokenData.pairDecimals),
            chain: tokenData.chain,
            modalCexToDex: parseFloat(tokenData.modalCexToDex),
            modalDexToCex: parseFloat(tokenData.modalDexToCex),
            selectedCexs: tokenData.selectedCexs,
            selectedDexs: tokenData.selectedDexs,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        this.tokens.push(token);
        this.saveTokensToStorage();
        this.loadTokenTable();      // ⬅️ update tabel tampilan
        this.updateStats();         // ⬅️ update statistik
        this.showAlert(`Token ${token.symbol} berhasil ditambahkan`, 'success');
        return token;
    }

    SearchCTokenMonitoring() {
        $('#monitoringSearch').on('keyup', () => {
            const keyword = $('#monitoringSearch').val().toLowerCase();
            const rows = $('#priceTableBody tr.token-data-row');
            rows.each(function() {
                const detailCell = $(this).find('.token-detail-cell').text().toLowerCase();
                $(this).toggle(detailCell.includes(keyword));
            });
        });
    }

    updateToken(tokenId, tokenData) {
        const index = this.tokens.findIndex(t => t.id === tokenId);
        if (index !== -1) {
            this.tokens[index] = {
                ...this.tokens[index],
                ...tokenData,
                updatedAt: new Date().toISOString()
            };
            this.saveTokensToStorage();
          //  this.showAlert(`Token ${this.tokens[index].symbol} berhasil diperbarui`, 'info');
            return this.tokens[index];
        }
        this.showAlert(`Token tidak ditemukan`, 'danger');
        this.loadTokenTable();
        this.updateStats();
        return null;
    }

    deleteToken(tokenId) {
        const token = this.tokens.find(t => t.id === tokenId);
        if (!token) {
            this.showAlert(`Token tidak ditemukan`, 'danger');
            return false;
        }

        const konfirmasi = confirm(`Ingin Hapus Token ${token.symbol} on ${token.chain} semua CEX?`);
        if (!konfirmasi) return false;

        this.tokens = this.tokens.filter(t => t.id !== tokenId);
        this.saveTokensToStorage();
        this.showAlert(`Token ${token.symbol} berhasil dihapus, Silakan Refresh!`, 'warning');
        this.loadTokenTable();
        this.updateStats();
        return true;
    }

    toggleTokenStatus(tokenId) {
        const token = this.tokens.find(t => t.id === tokenId);
        if (token) {
            token.isActive = !token.isActive;
            this.saveTokensToStorage();

            // ⬅️ Tambahkan ini agar tabel langsung ter-update:
            this.loadTokenTable(); 
            this.updateStats();

            const status = token.isActive ? 'diaktifkan' : 'dinonaktifkan';
            this.showAlert(`Token ${token.symbol} telah ${status}`, 'info');

            this.logAction(`UBAH STATUS KOIN`);
            return token;
        }

        this.showAlert(`Token tidak ditemukan`, 'danger');
        return null;
    }

    getCexList() {
        return CexList;
    }

    getDexList() {
        return DexList;
    }

    getChainList() {
        return Object.values(CHAIN_CONFIG).map(c => c.name);
    }

    loadTokenTable() {
        const tbody = $('#tokenTableBody');
        tbody.empty();

        const keyword = $('#tokenSearch').val()?.toLowerCase().trim() || '';
        const selectedChains = $('.filter-chain-checkbox:checked').map(function () {
            return this.value.toLowerCase();
        }).get();

        const filteredTokens = this.tokens.filter(token => {
            const chainMatch = selectedChains.length === 0 || selectedChains.includes(token.chain.toLowerCase());

            const searchableFields = [
                token.symbol,
                token.pairSymbol,
                token.chain,
                token.contractAddress,
                token.pairContractAddress,
                token.isActive ? 'active' : 'inactive', // ✔️ status ON/OFF ikut dicari
                ...(token.selectedCexs || []),
                ...(token.selectedDexs || [])
            ].map(val => (val || '').toLowerCase());

            const keywordMatch = keyword === '' || searchableFields.some(val => val.includes(keyword));

            return chainMatch && keywordMatch;
        });

        if (filteredTokens.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">
                    Data yang dicari Tidak Ditemukan
                    </td>
                </tr>
            `);
            return;
        }

        const sortedTokens = filteredTokens.slice().sort((a, b) => (b.isActive === true) - (a.isActive === true));

        sortedTokens.forEach((token, index) => {
            const cexTextList = this.getCexList().map(cex => {
                const isChecked = token.selectedCexs.includes(cex);
                const checkedAttr = isChecked ? 'checked' : '';
                const tokenSymbol = token.symbol.toUpperCase();
                const pairSymbol = token.pairSymbol.toUpperCase();
                const cexUpper = cex.toUpperCase();

                const matchedCEXKey = Object.keys(token.cexInfo || {}).find(k => k.toUpperCase() === cexUpper);
                const info = token.cexInfo?.[matchedCEXKey] || {};

                const tokenInfo = info[tokenSymbol] || {};
                const pairInfo = info[pairSymbol] || {};

                const formatStatus = (value, openText, closeText) => {
                    if (value === true) return `<span class="text-success fw-bold">${openText}</span>`;
                    if (value === false) return `<span class="text-danger fw-bold">${closeText}</span>`;
                    return `<span class="text-warning">⚠️</span>`;
                };

                const wdToken = formatStatus(tokenInfo.wd, 'WD', 'WX');
                const dpToken = formatStatus(tokenInfo.depo, 'DP', 'DX');
                const wdPair = formatStatus(pairInfo.wd, 'WD', 'WX');
                const dpPair = formatStatus(pairInfo.depo, 'DP', 'DX');

                const textColorClass = this.getTextColorClassFromBadge(this.getBadgeColor(cex, 'cex'));

                return `
                    <div>
                        <label class="${textColorClass}" style="cursor: pointer;">
                            <input type="checkbox" class="update-cex-checkbox me-1"
                                data-token-id="${token.id}" data-cex="${cex}" value="${cex}" ${checkedAttr} />
                            <span class="fw-bold fs-7 ${textColorClass}">${cexUpper}:</span>
                        </label>
                        ${isChecked ? `
                            <div class="d-inline-flex align-items-center mt-1 fs-7">                                
                                <span class="badge text-dark bg-white">
                                    <strong class="text-dark">${tokenSymbol}</strong> [${wdToken}|${dpToken}] ⇄ 
                                    <strong class="text-dark">${pairSymbol}</strong> [${wdPair}|${dpPair}]
                                </span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            const allDexs = this.getDexList();
            let dexCheckboxes = '';

            allDexs.forEach((dex, index) => {
                const isChecked = token.selectedDexs.includes(dex);
                const checkedAttr = isChecked ? 'checked' : '';
                const colorClass = this.getTextColorClassFromBadge(this.getBadgeColor(dex, 'dex'));

                dexCheckboxes += `
                    <label class="me-2 fs-7 fw-bold ${colorClass}" style="cursor: pointer;">
                        <input type="checkbox" class="update-dex-checkbox me-1"
                            data-token-id="${token.id}" data-dex="${dex}" value="${dex}" ${checkedAttr}/> ${dex.toUpperCase()}
                    </label>
                `;

                if ((index + 1) % 3 === 0) {
                    dexCheckboxes += '<br/>';
                }
            });

            const chainOptions = this.getChainList().map(chain => {
                const selected = chain === token.chain ? 'selected' : '';
                return `<option value="${chain}" ${selected}>${chain}</option>`;
            }).join('');

            const chainSelect = `
                <div class="d-flex align-items-center gap-1">
                    <select class="form-select form-select-sm inline-edit"
                        data-token-id="${token.id}"
                        data-field="chain"
                        style="width: 120px; height: 32px;">
                        ${chainOptions}
                    </select>
                    <button class="btn btn-outline-dark btn-save-inline btn-sm"
                            data-token-id="${token.id}" data-field="chain" title="Simpan Chain"
                            style="height: 32px;">
                        <i class="bi bi-check-lg small"></i>
                    </button>
                </div>
            `;

            const isActive = token.isActive;
            const statusText = isActive ? 'ACTIVE' : 'INACTIVE';
            const statusBtnClass = token.isActive ? 'btn-success' : 'btn-outline-secondary';

            tbody.append(`
                <tr class="align-middle token-data-row">
                    <td>${index + 1}</td>
                    <td>
                        <div class="d-flex flex-column small text-muted" style="line-height: 1.2;">
                            <div class="d-flex flex-column gap-1">
                                <div class="d-flex align-items-center">
                                    <input type="text" class="form-control form-control-sm inline-edit me-1"
                                    data-token-id="${token.id}" data-field="symbol" value="${token.symbol}" style="width:100px;" />
                                    <input type="text" class="form-control form-control-sm inline-edit me-1"
                                        data-token-id="${token.id}" data-field="contractAddress" value="${token.contractAddress}" style="width:360px;" />
                                    <input type="text" class="form-control form-control-sm inline-edit me-1"
                                        data-token-id="${token.id}" data-field="decimals" value="${token.decimals}" style="width:60px;" />
                                    <button class="btn btn-outline-dark btn-save-inline btn-sm"
                                            data-token-id="${token.id}" data-field="contractAddress" title="Simpan SC">
                                        <i class="bi bi-check-lg small"></i>
                                    </button>
                                </div>
                                <div class="d-flex align-items-center">
                                    <input type="text" class="form-control form-control-sm inline-edit me-1"
                                    data-token-id="${token.id}" data-field="pairSymbol" value="${token.pairSymbol}" style="width:100px;" />
                                    <input type="text" class="form-control form-control-sm inline-edit me-1"
                                        data-token-id="${token.id}" data-field="pairContractAddress" value="${token.pairContractAddress}" style="width:360px;" />
                                    <input type="text" class="form-control form-control-sm inline-edit me-1"
                                        data-token-id="${token.id}" data-field="pairDecimals" value="${token.pairDecimals}" style="width:60px;" />
                                    <button class="btn btn-outline-dark btn-save-inline btn-sm"
                                            data-token-id="${token.id}" data-field="pairContractAddress" title="Simpan Pair SC">
                                        <i class="bi bi-check-lg small"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>

                    <td>
                        <div class="d-flex flex-column gap-1">                        
                            <div class="btn-group btn-group-sm" role="group" aria-label="Control group">
                                <span class="badge fw-bold small ${isActive ? 'text-success' : 'text-danger'}">
                                    ${statusText}
                                </span>
                                <button class="btn ${statusBtnClass} btn-sm px-2 py-0"
                                        onclick="app.toggleTokenStatus('${token.id}')" title="Toggle Status">
                                    <i class="bi bi-power small"></i>
                                </button>
                                <button class="btn btn-outline-danger btn-sm px-2 py-0"
                                        onclick="app.deleteToken('${token.id}')" title="Delete">
                                    <i class="bi bi-trash small"></i>
                                </button>
                            </div>
                            ${chainSelect}
                        </div>
                    </td>

                    <td>
                        <div class="input-group input-group-sm mb-1 d-flex align-items-center" style="width: 180px;">
                            <span class="me-2 fs-7 fw-bold">CEX:</span>
                            <input type="text"
                                class="form-control form-control-sm inline-edit"
                                data-token-id="${token.id}"
                                data-field="modalCexToDex"
                                value="${token.modalCexToDex}" />
                            <button class="btn btn-outline-dark btn-save-inline btn-sm"
                                    data-token-id="${token.id}"
                                    data-field="modalCexToDex"
                                    title="Simpan">
                                <i class="bi bi-check-lg small"></i>
                            </button>
                        </div>

                        <div class="input-group input-group-sm d-flex align-items-center" style="width: 180px;">
                            <span class="me-2 fs-7 fw-bold">DEX:</span>
                            <input type="text"
                                class="form-control form-control-sm inline-edit"
                                data-token-id="${token.id}"
                                data-field="modalDexToCex"
                                value="${token.modalDexToCex}" />
                            <button class="btn btn-outline-dark btn-save-inline btn-sm"
                                    data-token-id="${token.id}"
                                    data-field="modalDexToCex"
                                    title="Simpan">
                                <i class="bi bi-check-lg small"></i>
                            </button>
                        </div>
                    </td>

                    <td>${cexTextList}</td>
                    <td>${dexCheckboxes}</td>
                </tr>
            `);
        });
    }

    shortenAddress(address, start = 6, end = 6) {
        if (!address || address.length <= start + end) return address;
        return address.substring(0, start) + "..." + address.substring(address.length - end);
    }

    getBadgeColor(name, type) {
        if (type === 'cex') {
            const colors = {
                Binance: 'bg-binance',
                MEXC: 'bg-mexc',
                Gateio: 'bg-gateio',
                INDODAX: 'bg-indodax',
            };
            return colors[name] || 'bg-secondary text-light';
        }

        if (type === 'dex') {
            const colors = {
                "1inch": 'bg-1inch',
                KyberSwap: 'bg-kyberswap',
                Matcha: 'bg-matcha',
                ODOS: 'bg-odos',
                ParaSwap: 'bg-paraswap',
                OKXDEX: 'bg-okxdex',
                LIFI: 'bg-lifi',
                Magpie: 'bg-magpie',
            };
            return colors[name] || 'bg-secondary text-light';
        }

        if (type === 'chain') {
            const colors = {
                bsc: 'bg-warning text-dark',
                ethereum: 'bg-primary text-light',
                polygon: 'bg-success text-light',
                arbitrum: 'bg-info text-dark',
                base: 'bg-dark text-light',
            };
            return colors[name.toLowerCase()] || 'bg-dark text-light';
        }

        return 'bg-secondary text-light';
    }


    getTextColorClassFromBadge(badgeClass = '') {
        const map = {
            // Bootstrap default
            'bg-success': 'text-success',
            'bg-primary': 'text-primary',
            'bg-danger': 'text-danger',
            'bg-light': 'text-light',
            'bg-info': 'text-info',
            'bg-secondary': 'text-secondary',
            'bg-dark': 'text-dark',
            'bg-warning': 'text-warning',

            // Custom brand (CEX & DEX)
            'bg-binance': 'text-binance',
            'bg-mexc': 'text-mexc',
            'bg-gateio': 'text-gateio',
            'bg-indodax': 'text-indodax',

            'bg-1inch': 'text-1inch',
            'bg-kyberswap': 'text-kyberswap',
            'bg-matcha': 'text-matcha',
            'bg-odos': 'text-odos',
            'bg-paraswap': 'text-paraswap',
            'bg-okxdex': 'text-okxdex',
            'bg-lifi': 'text-lifi',
            'bg-magpie': 'text-magpie',
        };

        const bgClass = badgeClass.split(' ').find(cls => cls.startsWith('bg-'));
        return map[bgClass] || 'text-light';
    }

    loadSettingsForm() {
        $('#tokensPerBatch').val(this.settings.tokensPerBatch);
        $('#UserName').val(this.settings.UserName);
        $('#delayBetweenGrup').val(this.settings.delayBetweenGrup);
        $('#TimeoutCount').val(this.settings.TimeoutCount);
        $('#PNLFilter').val(this.settings.PNLFilter);
        $('#WalletAddress').val(this.settings.WalletAddress);
    }

    updateStats() {
        const totalTokens = this.tokens.length;
        const activeTokens = this.tokens.filter(t => t.isActive);
        const inactiveTokens = this.tokens.filter(t => !t.isActive);

        const targets = ['Monitoring', 'Management'];

        for (const target of targets) {
            // Total, aktif, tidak aktif
            $(`#totalTokens${target}`).text(totalTokens);
            $(`#activeTokens${target}`).text(activeTokens.length);
            $(`#inactiveTokens${target}`).text(inactiveTokens.length);
/*
            for (const chainKey in CHAIN_CONFIG) {
                const chain = CHAIN_CONFIG[chainKey];
                const chainName = chain.name; // Misal: "Polygon", "Ethereum"
                const htmlId = chain.short?.toLowerCase(); // "poly", "eth", dsb

                // Jika elemen HTML tidak tersedia, skip
                if (!htmlId || !$(`#${htmlId}Count${target}`).length) continue;

                const count = this.tokens.filter(t => t.chain === chainName).length;
                $(`#${htmlId}Count${target}`).text(count);
            }
*/            

            for (const chainKey in CHAIN_CONFIG) {
                // Total, aktif, tidak aktif
                $(`#totalTokens${target}`).text(totalTokens);
                $(`#activeTokens${target}`).text(activeTokens.length);
                $(`#inactiveTokens${target}`).text(inactiveTokens.length);

                const chain = CHAIN_CONFIG[chainKey];
                const chainName = chain.name; // e.g., "BSC", "Polygon"
                const htmlId = chain.short?.toLowerCase(); // e.g., "bsc", "poly"

                if (!htmlId || !$(`#${htmlId}Count${target}`).length) continue;

                const totalPerChain = this.tokens.filter(t => t.chain === chainName).length;
                const activePerChain = this.tokens.filter(t => t.chain === chainName && t.isActive).length;

                $(`#${htmlId}Count${target}`).text(`${activePerChain}/${totalPerChain}`).attr("title", `Aktif ${activePerChain} dari TOTAL ${totalPerChain} Koin`);
            }
        }

       

        // Total baris monitoring = jumlah token aktif × banyaknya selectedCEX
        let totalBaris = 0;
        activeTokens.forEach(token => {
            // Lewati jika chain tidak aktif difilter
            if (!this.selectedChains.includes(token.chain)) return;

            if (Array.isArray(token.selectedCexs)) {
                totalBaris += token.selectedCexs.filter(c => c).length;
            }
        });

        $('#totalBarisMonitoring').text(totalBaris);
    }

    // Form operations
    resetTokenForm() {
        $('#tokenForm')[0].reset();
        $('#tokenDecimals').val(18);
        $('#pairDecimals').val(18);
        $('#modalCexToDex').val(100);
        $('#modalDexToCex').val(100);
        $('input[type="checkbox"]').prop('checked', false);
    }

    saveToken() {
        const formData = this.getTokenFormData();

        // Validasi maksimal 4 DEX
        if (formData.selectedDexs && formData.selectedDexs.length > 4) {
            this.showAlert('⚠️ Maksimal hanya boleh memilih 4 DEX untuk setiap token.', 'warning');
            return;
        }

        // Validasi form lain
        if (!this.validateTokenForm(formData)) {
            return;
        }

        try {
            if (this.currentEditingToken) {
                this.updateToken(this.currentEditingToken.id, formData);
                this.showAlert('✅ Berhasil SIMPAN Perubahan DATA, Silakan Refresh!', 'success');
                this.logAction(`UBAH DATA KOIN`);
            } else {
                this.addToken(formData);
                this.showAlert('✅ Berhasil Menambah DATA Baru, Silakan Refresh', 'success');
                this.logAction(`TAMBAH DATA KOIN`);
            }

            $('#tokenModal').modal('hide');
            this.resetTokenForm();
        } catch (error) {
            this.showAlert('❌ Error saving token: ' + error.message, 'danger');
        }
    }

    getTokenFormData() {
        const selectedCexs = [];
        $('input[id^="cex"]:checked').each(function() {
            selectedCexs.push($(this).val());
        });

        const selectedDexs = [];
        $('input[id^="dex"]:checked').each(function() {
            selectedDexs.push($(this).val());
        });

        return {
            symbol: $('#tokenSymbol').val().trim().toUpperCase(),
            pairSymbol: $('#pairSymbol').val().trim().toUpperCase(),
            contractAddress: $('#tokenContract').val().trim(),
            pairContractAddress: $('#pairContract').val().trim(),
            decimals: $('#tokenDecimals').val(),
            pairDecimals: $('#pairDecimals').val(),
            chain: $('#tokenChain').val(),
            modalCexToDex: $('#modalCexToDex').val(),
            modalDexToCex: $('#modalDexToCex').val(),
            selectedCexs: selectedCexs,
            selectedDexs: selectedDexs
        };
    }

    validateTokenForm(formData) {
        // 🔸 Validasi token
        if (!formData.symbol || !formData.pairSymbol) {
            this.showAlert('Masukan Symbol Token & Pair', 'warning');
            return false;
        }

        if (!formData.contractAddress || !formData.pairContractAddress) {
            this.showAlert('Masukan Smart Kontrak', 'warning');
            return false;
        }

        if (!formData.chain) {
            this.showAlert('Pilih Chain', 'warning');
            return false;
        }

        if (!formData.selectedCexs || formData.selectedCexs.length === 0) {
            this.showAlert('Pilih CEX', 'warning');
            return false;
        }

        if (!formData.selectedDexs || formData.selectedDexs.length === 0) {
            this.showAlert('Pilih DEX', 'warning');
            return false;
        }

        // ✅ Semua valid
        return true;
    }

    editToken(tokenId) {
        const token = this.tokens.find(t => t.id === tokenId);

        if (!token) return;

        this.currentEditingToken = token;
        $('#modalTitle').text('Edit Token');

        // Populate form
        $('#tokenSymbol').val(token.symbol);
        $('#pairSymbol').val(token.pairSymbol);
        $('#tokenContract').val(token.contractAddress);
        $('#pairContract').val(token.pairContractAddress);
        $('#tokenDecimals').val(token.decimals);
        $('#pairDecimals').val(token.pairDecimals);
        $('#tokenChain').val(token.chain);
        $('#modalCexToDex').val(token.modalCexToDex);
        $('#modalDexToCex').val(token.modalDexToCex);

        // Set checkboxes
        $('input[type="checkbox"]').prop('checked', false);
        token.selectedCexs.forEach(cex => {
            $(`input[value="${cex}"]`).prop('checked', true);
        });
        token.selectedDexs.forEach(dex => {
            $(`input[value="${dex}"]`).prop('checked', true);
        });

        $('#tokenModal').modal('show');
    }

    saveSettings() {
        const $userEl = $('#UserName');
        const $walletEl = $('#WalletAddress');

        const userName = $userEl.val()?.trim() || '';
        const wallet = $walletEl.val()?.trim() || '';
        const tokensPerBatch = parseInt($('#tokensPerBatch').val(), 10) || 3;
        const delayBetweenGrup = parseInt($('#delayBetweenGrup').val(), 10) || 400;
        const timeoutCount = parseInt($('#TimeoutCount').val(), 10) || 10000;
        const pnlFilter = parseFloat($('#PNLFilter').val()) || 0;

        if (!userName || userName === 'XXX') {
            this.showAlert('❌ Nama pengguna tidak boleh kosong atau "XXX"', 'danger');
            return;
        }

        if (!wallet || wallet === '-' || !wallet.startsWith('0x')) {
            this.showAlert('❌ Alamat wallet SALAH (harus diawali "0x")', 'danger');
            return;
        }

        if (!tokensPerBatch || tokensPerBatch < 3 || tokensPerBatch > 10) {
            this.showAlert('Jumlah Anggota (Tokens Per Batch) harus antara 3-7', 'danger');
            return false;
        }

        if (!delayBetweenGrup || delayBetweenGrup < 300 || delayBetweenGrup > 5000) {
            this.showAlert('Delay antar grup harus antara 300–5000 ms', 'danger');
            return false;
        }

        if (!timeoutCount || timeoutCount < 2000 || timeoutCount > 10000) {
            this.showAlert('Timeout harus antara 2000–15000 ms', 'danger');
            return false;
        }

        this.settings = {
            UserName: userName,
            WalletAddress: wallet,
            tokensPerBatch,
            delayBetweenGrup: delayBetweenGrup,
            TimeoutCount: timeoutCount,
            PNLFilter: pnlFilter
        };

        this.saveSettingsToStorage();
        
        this.logAction(`SETTING APLIKASI`);
        alert('✅ SIMPAN SETTING BERHASIL!');

        location.reload();
    }

    async CheckPrices() { 
        this.errorStats = {};
        $('#statERROR').html(''); // opsional: bersihkan tampilan lama

        try {
            $('#scanProgressPercent').html(`Cek Harga Gas Gwei..`);
            await this.fetchGasTokenPrices();
        } catch (err) {
            console.error('Gagal fetchGasTokenPrices:', err);
            this.showAlert('Gagal mengambil harga Gas Token, scan dibatalkan', 'danger');
            return;
        }

        $('.chainFilterCheckbox').prop('disabled', true);
        $('#scanProgressPercent').html(``);

        const settings = this.loadSettings();
        if (!settings || settings.WalletAddress === '-' || settings.UserName === 'XXX') {
            this.showAlert('SILAKAN SETTING APLIKASI', 'danger');
            return;
        }

        const tokensPerBatch = settings.tokensPerBatch;
        const delayBetweenGrup = settings.delayBetweenGrup;
        const delayPerDexDirection = 200;
        const delayPerToken = 200;

        const allTokenUnits = [];

        for (const token of this.tokens) {
            if (!token.isActive || !this.selectedChains.includes(token.chain)) continue;
            for (const cexName of token.selectedCexs) {
                allTokenUnits.push({ ...token, cexName });
            }
        }

        allTokenUnits.sort((a, b) => {
            const symbolA = a.symbol.toLowerCase();
            const symbolB = b.symbol.toLowerCase();
            return this.sortAscending ? symbolA.localeCompare(symbolB) : symbolB.localeCompare(symbolA);
        });

        if (allTokenUnits.length === 0) {
            this.showAlert('Tidak Ada Daftar Token, Silakan Pilih Chain', 'info');
            $('#priceTableBody').html(`<tr><td colspan="13" class="text-center text-muted py-5">
                <i class="bi bi-info-circle me-2"></i> Tidak ada DATA KOIN, Silakan ke Management TOKEN
            </td></tr>`);
            return;
        }

        const chunkArray = (arr, size) => {
            const result = [];
            for (let i = 0; i < arr.length; i += size) {
                result.push(arr.slice(i, i + size));
            }
            return result;
        };

        const unitBatches = chunkArray(allTokenUnits, tokensPerBatch);
        const totalUnits = allTokenUnits.length;
        let currentIndex = 0;
        const skipDelayDEX = ['LIFI','ODOS'];

        const startTime = new Date();
        const startStr = startTime.toLocaleTimeString();
        $('#scanTimeInfo').html(`<span class="text-dark">&nbsp;🔍 ${startStr}</span>&nbsp;`);

        for (const batch of unitBatches) {
            await Promise.allSettled(batch.map(async tokenUnit => {
                currentIndex++;
                const percent = Math.round((currentIndex / totalUnits) * 100);
                $('#scanProgressBar').css('width', `${percent}%`);

                const priceData = {
                    token: tokenUnit,
                    analisis_data: {
                        cex_to_dex: {},
                        dex_to_cex: {}
                    }
                };

                const shortCex = (CexShortMap[tokenUnit.cexName] || tokenUnit.cexName || '').toUpperCase();
                const shortChain = (CHAIN_CONFIG[tokenUnit.chain?.toLowerCase()]?.short || tokenUnit.chain || '').toUpperCase();

                const firstToken = batch[0];
                if (firstToken) {
                    this.tryAutoScrollToRow(firstToken);
                }

                await this.fetchCEXPrices(tokenUnit, priceData, tokenUnit.cexName, 'cex_to_dex');
                this.generateOrderBook(tokenUnit, priceData, tokenUnit.cexName, 'cex_to_dex');

                const skippedDexPromises = tokenUnit.selectedDexs
                .filter(dex => skipDelayDEX.includes(dex))
                .map(async dexName => {
                    this.fetchDEXPrices(tokenUnit, priceData, dexName, tokenUnit.cexName, 'cex_to_dex')
                    .then(() => this.fetchCEXPrices(tokenUnit, priceData, tokenUnit.cexName, 'dex_to_cex'))
                    .then(() => this.fetchDEXPrices(tokenUnit, priceData, dexName, tokenUnit.cexName, 'dex_to_cex'))
                    .catch(err => console.warn(`[SKIP_DELAY][${dexName}] Error:`, err));
                });

                const normalDexPromises = tokenUnit.selectedDexs
                .filter(dex => !skipDelayDEX.includes(dex))
                .map(async dexName => {
                    $('#scanProgressText').html(`🔄 ${shortCex} → <b>[${tokenUnit.symbol} on ${shortChain}]</b> → ${dexName} [${percent}%]`);
                    try {
                    await this.fetchDEXPrices(tokenUnit, priceData, dexName, tokenUnit.cexName, 'cex_to_dex');
                    await new Promise(r => setTimeout(r, delayPerDexDirection));

                    await this.fetchCEXPrices(tokenUnit, priceData, tokenUnit.cexName, 'dex_to_cex');
                    this.generateOrderBook(tokenUnit, priceData, tokenUnit.cexName, 'dex_to_cex');

                    await this.fetchDEXPrices(tokenUnit, priceData, dexName, tokenUnit.cexName, 'dex_to_cex');

                    await new Promise(r => setTimeout(r, delayPerDexDirection));

                    $('#scanProgressText').html(`🔄 ${dexName} → <b>[${tokenUnit.symbol} on ${shortChain}]</b> → ${shortCex} [${percent}%]`);
                    } catch (err) {
                    console.warn(`[NORMAL_DELAY][${dexName}] Error:`, err);
                    }

                    // Error stats
                    if (this.errorStats) {
                    const errorSummary = Object.entries(this.errorStats)
                        .map(([dex, stat]) =>
                        `<span class="badge text-dark bg-warning fs-8">❌ ${dex.toUpperCase()} [ <span class="text-white "> 🕒: ${stat.timeout || 0} </span>|<span class="text-danger">  ⚠️: ${stat.dexError || 0}</span> ]</span> <br/>`
                        ).join('');
                    $('#statERROR').html(`<span class="fw-bold text-white fs-7">STATS ERROR: </span><br/>${errorSummary}`);
                    }
                });

                // Jalankan yang tidak delay secara non-blocking (tidak di-await)
                skippedDexPromises.forEach(p => p);

                // Tunggu hanya yang normal
                await Promise.allSettled(normalDexPromises);


            }));

            await new Promise(resolve => setTimeout(resolve, delayBetweenGrup));
        }

        const endTime = new Date();
        const durationSec = Math.floor((endTime - startTime) / 1000);
        const minutes = Math.floor(durationSec / 60).toString().padStart(2, '0');
        const seconds = (durationSec % 60).toString().padStart(2, '0');

        $('#scanProgressText').html(``);
        $('#scanProgressPercent').html(`<span class="text-white fs-7">&nbsp;&nbsp;✅ Durasi Scan: ${minutes}:${seconds}</span>&nbsp;`);
        this.showAlertWithAudio();
        $('.chainFilterCheckbox').prop('disabled', false);

    }

    async showAlertWithAudio() {
        const alertBox = document.getElementById("customAlert");
        
        var audio = new Audio('finish.mp3');  // Ganti dengan path file suara yang sesuai
        audio.play();
        
        // Tampilkan alert
        alertBox.style.display = "block";

        // Sembunyikan setelah 4 detik
        setTimeout(() => {
            alertBox.style.display = "none";
        }, 4000);
    }

    setDexCellLoading(token, cexName, dexName, direction) {
        const cellId = direction === 'cex_to_dex'
            ? `cell_${token.symbol}_${token.pairSymbol}_${token.chain}_${cexName}_${dexName}`
            : `cell_${token.pairSymbol}_${token.symbol}_${token.chain}_${dexName}_${cexName}`;

        const safeId = cellId.toLowerCase().replace(/\W+/g, '');
        const $cell = $('#' + safeId);

        if ($cell.length) {
            $cell
                .removeClass()
                .addClass('dex-price-cell text-info text-center align-middle')
                .html(`
                    <div class="text-info small">
                        ${dexName}&nbsp;
                        <span class="spinner-border spinner-border-sm me-1"></span>
                    </div>
                    <div >&nbsp;</div>
                    <div class="pnl-info">&nbsp;</div>
                `);
        }
    }

    async fetchCEXPrices(token, tokenPriceData, cexName, direction) {
        if (!this.gasTokenPrices) this.gasTokenPrices = {};
        const promises = [];

        const baseSymbol = token.symbol.toUpperCase();
        const quoteSymbol = token.pairSymbol.toUpperCase();

        if (baseSymbol === 'USDT') this.gasTokenPrices['USDT'] = 1;
        if (quoteSymbol === 'USDT') this.gasTokenPrices['USDT'] = 1;

        // ✅ Siapkan struktur penyimpanan
        tokenPriceData.analisis_data = tokenPriceData.analisis_data || {};
        tokenPriceData.analisis_data[direction] = tokenPriceData.analisis_data[direction] || {};
        tokenPriceData.analisis_data[direction][cexName] = tokenPriceData.analisis_data[direction][cexName] || {};

        const symbols = [baseSymbol, quoteSymbol];

        for (const symbol of symbols) {
            const pair = { baseSymbol: symbol, quoteSymbol: 'USDT' };

            const assignData = (symbol => data => {
                tokenPriceData.analisis_data[direction][cexName][`${symbol}ToUSDT`] = data;
                if (data.buy) this.gasTokenPrices[symbol] = data.buy;
            })(symbol);
            
            switch (cexName) {
                case 'Binance':
                    promises.push(
                        CEXAPIs.getBinanceOrderBook(pair).then(assignData).catch(err =>
                            console.warn(`Binance ${symbol}/USDT error: ${err.message}`)
                        )
                    );
                    break;
                case 'MEXC':
                    promises.push(
                        CEXAPIs.getMEXCOrderBook(pair).then(assignData).catch(err =>
                            console.warn(`MEXC ${symbol}/USDT error: ${err.message}`)
                        )
                    );
                    break;
                case 'Gateio':
                    promises.push(
                        CEXAPIs.getGateOrderBook(pair).then(assignData).catch(err =>
                            console.warn(`Gateio ${symbol}/USDT error: ${err.message}`)
                        )
                    );
                    break;
                case 'INDODAX':
                    promises.push(
                        CEXAPIs.getIndodaxOrderBook(pair).then(assignData).catch(err =>
                            console.warn(`INDODAX ${symbol}/USDT error: ${err.message}`)
                        )
                    );
                break;
            }
        }

        await Promise.allSettled(promises);
    }

    async fetchDEXPrices(token, tokenPriceData, dexName, cexName, direction) {
        const chainId = PriceUtils.getChainId(token.chain);
        const network = token.chain.toLowerCase();
        const tokenDecimals = token.decimals;
        const pairDecimals = token.pairDecimals;
        const shortChain = CHAIN_CONFIG[token.chain?.toLowerCase()]?.short || token.chain || '';
        
        const baseSymbol = token.symbol.toUpperCase();
        const quoteSymbol = token.pairSymbol.toUpperCase();
        const modal = direction === 'cex_to_dex' ? token.modalCexToDex : token.modalDexToCex;

        const isBaseUSDT = baseSymbol === 'USDT';
        const isQuoteUSDT = quoteSymbol === 'USDT';

        const cexData = tokenPriceData.analisis_data?.[direction]?.[cexName];
        
        if (!cexData || Object.keys(cexData).length === 0) {
            console.warn(`❗ Tidak ada atau data kosong di CEX untuk ${token.symbol}/${token.pairSymbol} @ ${cexName}`);
            const cellId = direction === 'cex_to_dex'
                ? `cell_${token.symbol}_${token.pairSymbol}_${token.chain}_${cexName}_${dexName}`
                : `cell_${token.pairSymbol}_${token.symbol}_${token.chain}_${dexName}_${cexName}`;

            $(`#${cellId.toLowerCase().replace(/\W+/g, '')}`).html(`
                <div class="pink small"> ${cexName} ⚠️</div>
            `);
            return;
        }

        const getCEXRate = (symbol, type = 'buy') => {
            const key = Object.keys(cexData).find(k => k.toUpperCase().includes(symbol));
            return Number(cexData?.[key]?.[type] || 0);
        };

        const baseBuy = isBaseUSDT ? 1 : getCEXRate(baseSymbol, 'buy');
        const baseSell = isBaseUSDT ? 1 : getCEXRate(baseSymbol, 'sell');
        const quoteBuy = isQuoteUSDT ? 1 : getCEXRate(quoteSymbol, 'buy');
        const quoteSell = isQuoteUSDT ? 1 : getCEXRate(quoteSymbol, 'sell');

        if (!baseBuy || !baseSell || !quoteBuy || !quoteSell) {
            console.warn(`${cexName} ${symbol} Harga tidak lengkap:`, { baseBuy, baseSell, quoteBuy, quoteSell });
            return;
        }

        let inputContract, outputContract, inputDecimals, outputDecimals;
        if (direction === 'cex_to_dex') {
            inputContract = token.contractAddress;
            outputContract = token.pairContractAddress;
            inputDecimals = tokenDecimals;
            outputDecimals = pairDecimals;
        } else {
            inputContract = token.pairContractAddress;
            outputContract = token.contractAddress;
            inputDecimals = pairDecimals;
            outputDecimals = tokenDecimals;
        }

        const inputAmountToken = direction === 'cex_to_dex'
            ? (isBaseUSDT ? modal : modal / baseBuy)
            : (isQuoteUSDT ? modal : modal / quoteBuy);

        const rawAmountIn = PriceUtils.calculateAmount(inputAmountToken, inputDecimals);
        const quotePriceUSDT = direction === 'cex_to_dex' ? quoteBuy : baseSell;

        this.setDexCellLoading(token, cexName, dexName, direction);

        const handleResult = (dexName, data, rawOutProp = 'amountOut') => {
           // console.warn(dexName,data);
            const outRaw = data[rawOutProp] || '0';
            const normalizedIn = inputAmountToken;
            const normalizedOut = PriceUtils.normalizeAmount(outRaw, outputDecimals);

            let price = 0;
            if (direction === 'cex_to_dex') {
                price = normalizedOut / normalizedIn;
            } else {
                price = normalizedOut > 0 ? modal / normalizedOut : 0;
            }

            const priceInUSDT = price * quotePriceUSDT;
            const pairKey = `${baseSymbol}To${quoteSymbol}`;

            tokenPriceData.analisis_data[direction][dexName] = tokenPriceData.analisis_data[direction][dexName] || {};
            tokenPriceData.analisis_data[direction][dexName][pairKey] = {
                exchange: data.exchange || dexName,
                amountIn: rawAmountIn,
                amountOut: outRaw,
                price: priceInUSDT,
                rawRate: price,
                feeDEX: data.feeDEX,
                feeSwapUSDT: data.feeSwapUSDT,
                from: direction === 'cex_to_dex' ? baseSymbol : quoteSymbol,
                to: direction === 'cex_to_dex' ? quoteSymbol : baseSymbol,
                rateSymbol: `${direction === 'cex_to_dex' ? quoteSymbol : baseSymbol}/${direction === 'cex_to_dex' ? baseSymbol : quoteSymbol}`,
                quotePriceUSDT,
                baseBuy, baseSell, quoteBuy, quoteSell,
                gasEstimate: data.gasEstimate || 0,
                gasPrice: data.gasPrice || 0,
                isFallback: data.isFallback || false,
                hasilUSDT: (normalizedOut * quotePriceUSDT),
                normalizedOut,
                normalizedIn,
                inputAmountToken,
                timestamp: Date.now()
            };
                // ✅ LOG
                //const feeTrade = modal * 0.0015;
                const isAnyNotUSDT = !isBaseUSDT || !isQuoteUSDT;
                const feeTrade = modal * (isAnyNotUSDT ? 0.0035 : 0.0015);

                const matchedCEXKey = Object.keys(token.cexInfo || {}).find(k => k.toUpperCase() === cexName.toUpperCase());
                const feeWDToken = token.cexInfo?.[matchedCEXKey]?.[token.symbol.toUpperCase()]?.feewd ?? 0;

                const feeWD = feeWDToken * baseBuy;
                const feeDEX = data.feeSwapUSDT || data.feeDEX;
                const totalFee = feeTrade + feeWD  + feeDEX;

            if (direction === 'cex_to_dex') {
                const hasilUSDT = (normalizedOut * quotePriceUSDT).toFixed(6); // ✅ BENAR
                const hargaSwapEfektif = ((normalizedOut * quotePriceUSDT) / inputAmountToken).toFixed(6);

                const pnl = hasilUSDT - modal - totalFee;
                const pnlPersen = ((pnl / modal) * 100).toFixed(2);
                /*
                console.log(`✅ [LOG CEX → DEX] ${token.symbol} → ${token.pairSymbol} on ${(token.chain).toUpperCase()}`);
                console.log(`🔄 [${cexName.toUpperCase()} → ${dexName.toUpperCase()}]`);
                console.log(`🪙 Modal: $${modal}`);
                console.log(`🛒 Beli di ${cexName} @ $${baseBuy.toFixed(6)} → ${inputAmountToken.toFixed(6)} ${token.symbol}`);
                console.log(`💰 Swap di ${dexName}:`);
                console.log(`   - Harga Swap Efektif: ~$${hargaSwapEfektif} / ${token.symbol}`);
                console.log(`   - Hasil: $${hasilUSDT}`);
                console.log(`   - Fee Swap: $${feeDEX}`);
                console.log(`   - Total Fee: ~$${totalFee.toFixed(2)}`);
                console.log(`📈 PNL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${pnlPersen}%)`);
                console.log(`----------------------------------------`);
                */

                // if (pnl > 0) {
                //     const alertMsg = [
                //         `🚀 DETECT SIGNAL (CEX → DEX)`,
                //         `PAIR      : ${token.symbol} → ${token.pairSymbol}`,
                //         `CHAIN     : ${(token.chain).toUpperCase()}`,
                //         `CEX       : ${cexName.toUpperCase()}`,
                //         `DEX       : ${dexName.toUpperCase()}`,
                //         `MODAL     : $${modal}`,
                //         `NET PROFIT: $${pnl.toFixed(2)} (${pnlPersen}%)`
                //     ].join('<br>');

                //     this.showAlert(alertMsg, 'success');
                // }
                if (pnl > parseFloat(this.settings.PNLFilter)) {
                    // const alertMsg = `
                    //     🌐 CHAIN: ${token.chain.toUpperCase()} | 
                    //     💹 CEX: ${cexName.toUpperCase()} → DEX: ${dexName.toUpperCase()} | 
                    //     <span style="color:black; font-weight:bold;">🪙 MODAL: $${modal} </span> | 
                    //     <span style="color:blue; font-weight:bold;">🚀 ${token.symbol}→${token.pairSymbol}</span> | 
                    //     <span style="color:green; font-weight:bold;">💰 PROFIT: $${pnl.toFixed(2)} (${pnlPersen}%)</span>
                    // `.replace(/\s{2,}/g, ' ').trim(); // Hilangkan spasi berlebih

                     const alertMsg = `
                        <span style="color:blue; font-weight:bold;">🚀 ${token.symbol}→${token.pairSymbol}[${shortChain}]</span> | 
                        <span style="color:green; font-weight:bold;">💰PNL: $${pnl.toFixed(2)}</span>
                    `.replace(/\s{2,}/g, ' ').trim(); 

                    this.showAlert(alertMsg, 'success');
                }


            } else {
                const jumlahToken = normalizedOut.toFixed(6);
                const hargaSwapEfektif = (modal / normalizedOut).toFixed(6);
                const hasilUSDT = (normalizedOut * baseSell).toFixed(6);
                const pnl = normalizedOut * baseSell - modal - totalFee;
                const pnlPersen = ((pnl / modal) * 100).toFixed(2);
                /*
                console.log(`✅ [LOG DEX → CEX] ${token.pairSymbol} → ${token.symbol} on ${(token.chain).toUpperCase()}`);
                console.log(`🔄 [${dexName.toUpperCase()} → ${cexName.toUpperCase()}]`);
                console.log(`🪙 Modal: $${modal}`);
                console.log(`🛒 Swap di ${dexName} → ${jumlahToken} ${token.symbol} @ ~$${hargaSwapEfektif}/${token.symbol}`);
                console.log(`💰 Jual di ${cexName}:`);
                console.log(`   - Harga Jual: ~$${baseSell.toFixed(6)}/${token.symbol}`);
                console.log(`   - Hasil: $${hasilUSDT}`);
                console.log(`   - Fee Swap: $${feeDEX}`);
                console.log(`   - Total Fee: ~$${totalFee.toFixed(2)}`);
                console.log(`📈 PNL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${pnlPersen}%)`);
                console.log(`----------------------------------------`);
                */

                // if (pnl > 0) {
                //     const alertMsg = [
                //         `🚀 DETECT SIGNAL (DEX → CEX)`,
                //         `PAIR      : ${token.pairSymbol} → ${token.symbol}`,
                //         `CHAIN     : ${(token.chain).toUpperCase()}`,
                //         `CEX       : ${cexName.toUpperCase()}`,
                //         `DEX       : ${dexName.toUpperCase()}`,
                //         `MODAL     : $${modal}`,
                //         `NET PROFIT: $${pnl.toFixed(2)} (${pnlPersen}%)`
                //     ].join('<br>');

                //     this.showAlert(alertMsg, 'success');
                // }
                 if (pnl >  parseFloat(this.settings.PNLFilter)) {
                    // const alertMsg = `
                    //     🌐 CHAIN: ${token.chain.toUpperCase()} | 
                    //     💹 DEX: ${dexName.toUpperCase()} → CEX: ${cexName.toUpperCase()} | 
                    //     <span style="color:black; font-weight:bold;">🪙 MODAL: $${modal} </span> | 
                    //     <span style="color:blue; font-weight:bold;">🚀 ${token.symbol}→${token.pairSymbol}</span> | 
                    //     <span style="color:green; font-weight:bold;">💰 PROFIT: $${pnl.toFixed(2)} (${pnlPersen}%)</span>
                    // `.replace(/\s{2,}/g, ' ').trim(); // Hilangkan spasi berlebih

                     const alertMsg = `
                        <span style="color:blue; font-weight:bold;">🚀 ${token.symbol}→${token.pairSymbol}[${shortChain}]</span> | 
                        <span style="color:green; font-weight:bold;">💰PNL: $${pnl.toFixed(2)}</span>
                    `.replace(/\s{2,}/g, ' ').trim(); // Hilangkan spasi berlebih

                    this.showAlert(alertMsg, 'success');
                }

            }
            const dexInfo = tokenPriceData.analisis_data[direction][dexName][pairKey];
            const html = this.CellResult(token, cexData, dexInfo, direction, cexName, dexName);

            const cellId = direction === 'cex_to_dex'
                ? `cell_${token.symbol.toLowerCase()}_${token.pairSymbol.toLowerCase()}_${token.chain.toLowerCase()}_${cexName.toLowerCase()}_${dexName.toLowerCase()}`
                : `cell_${token.pairSymbol.toLowerCase()}_${token.symbol.toLowerCase()}_${token.chain.toLowerCase()}_${dexName.toLowerCase()}_${cexName.toLowerCase()}`;

            $(`#${cellId}`).html(html);
        };

        try {
            const cellId = direction === 'cex_to_dex'
                ? `cell_${token.symbol}_${token.pairSymbol}_${token.chain}_${cexName}_${dexName}`
                : `cell_${token.pairSymbol}_${token.symbol}_${token.chain}_${dexName}_${cexName}`;
            const safeCellId = cellId.toLowerCase().replace(/\W+/g, '');
            const timeoutLimit = timeoutApi;
            const wallet = this.settings?.WalletAddress || '0x0000000000000000000000000000000000000000';

           switch (dexName) {
                case '1inch':
                  //  if (direction === 'cex_to_dex') {
                        const dzapData = await fetchWithCountdown(
                            safeCellId, dexName,
                            () => DEXAPIs.getDZAPPrice({
                                account: wallet,
                                chainId: chainId,
                                sellToken: inputContract,
                                sellDecimals: inputDecimals,
                                buyToken: outputContract,
                                buyDecimals: outputDecimals,
                                sellAmount: rawAmountIn,
                                direction: direction,
                                slippage: 0.3,
                                integratorId: 'dzap',
                                allowedSources: ['oneInchViaLifi'] // ✅ ini yang kamu minta: odos via dzap
                            }),
                            timeoutLimit
                        );

                        if (dzapData?.status === 'timeout' || dzapData?.error) {
                            throw new Error(`DZAP error: ${dzapData.error || dzapData.status}`);
                        }

                        handleResult('1inch', dzapData);
                    // }else{
                    //      if (parseInt(chainId) === 1) {
                    //         // 🔁 Gunakan ZERO untuk chain ETH
                    //         const zeroData = await fetchWithCountdown(
                    //             safeCellId, dexName,
                    //             () => DEXAPIs.getZero1inchPrice(
                    //                 inputContract,
                    //                 outputContract,
                    //                 rawAmountIn,
                    //                 inputDecimals,
                    //                 outputDecimals,
                    //                 chainId,
                    //                 direction,
                    //                 network
                    //             ),
                    //             timeoutLimit
                    //         );

                    //         if (zeroData?.status === 'timeout' || zeroData?.error) {
                    //             throw new Error(`ZERO (ETH) error: ${zeroData.error || zeroData.status}`);
                    //         }

                    //         handleResult('1inch', { ...zeroData });

                    //     } else {
                    //         // 🔁 Gunakan HINKAL untuk chain non-ETH
                    //         const inchIn = [{ tokenAddress: inputContract, amount: rawAmountIn.toString() }];
                    //         const inchOut = [{ tokenAddress: outputContract, proportion: 1 }];

                    //         const inchData = await fetchWithCountdown(
                    //             safeCellId, dexName,
                    //             () => DEXAPIs.getHinkal1InchPrice(inchIn, inchOut, wallet, rawAmountIn.toString(), chainId,network),
                    //             timeoutLimit
                    //         );

                    //         if (inchData?.status === 'timeout' || inchData?.error) {
                    //             throw new Error(`1INCH (via Hinkal) error: ${inchData.error || inchData.status}`);
                    //         }

                    //         handleResult('1inch', {
                    //             ...inchData,
                    //             amountOut: inchData.outAmounts?.[0] || '0',
                    //             exchange: '1inch'
                    //         });
                    //     }

                    // }
                        
                    break;

                case 'KyberSwap': 
                       // if (direction === 'cex_to_dex') {
                            const kyberData = await fetchWithCountdown(
                                    safeCellId, dexName,
                                    () => DEXAPIs.getKyberSwapPrice(inputContract, outputContract, rawAmountIn, network),
                                    timeoutLimit
                                );

                                    if (kyberData?.status === 'timeout' || kyberData?.error) {
                                        throw new Error(`KyberSwap error: ${kyberData.error || kyberData.status}`);
                                    }

                                    handleResult('KyberSwap', kyberData);
                        // }else{
                        //         const zeroData = await fetchWithCountdown(
                        //             safeCellId, dexName,
                        //             () => DEXAPIs.getZeroKyberPrice(
                        //                 inputContract,
                        //                 outputContract,
                        //                 rawAmountIn,
                        //                 inputDecimals,
                        //                 outputDecimals,
                        //                 chainId,
                        //                 direction,
                        //                 network
                        //             ),
                        //             timeoutLimit
                        //         );

                        //         if (zeroData?.status === 'timeout' || zeroData?.error) {
                        //             throw new Error(`ZERO (KYBER) error: ${zeroData.error || zeroData.status}`);
                        //         }

                        //         handleResult('KyberSwap', { ...zeroData });
                        // }
                    break;

                case 'Matcha': {
                    const matchaData = await fetchWithCountdown(
                        safeCellId, dexName,
                        () => DEXAPIs.get0xPrice(inputContract, outputContract, rawAmountIn, chainId, direction,network),
                        timeoutLimit
                    );

                        if (matchaData?.status === 'timeout' || matchaData?.error) {
                            throw new Error(`Matcha error: ${matchaData.error || matchaData.status}`);
                        }

                        handleResult('Matcha', matchaData, 'buyAmount');
                        break;
                    }
                   
                case 'OKXDEX': {
                    const okxData = await fetchWithCountdown(
                        safeCellId, dexName,
                        () => DEXAPIs.getOKXDEXPrice(inputContract, outputContract, rawAmountIn, network),
                        timeoutLimit
                    );

                        if (okxData?.status === 'timeout' || okxData?.error) {
                            throw new Error(`OKXDEX error: ${okxData.error || okxData.status}`);
                        }

                        handleResult('OKXDEX', okxData);
                        break;
                    }
               
                case 'ODOS': {
                    const odosIn = [{ tokenAddress: inputContract, amount: rawAmountIn.toString() }];
                    const odosOut = [{ tokenAddress: outputContract, proportion: 1 }];

                    if (direction === 'cex_to_dex') {
                        const odosData = await fetchWithCountdown(
                            safeCellId, dexName,
                            () => DEXAPIs.getODOSPrice(odosIn, odosOut, wallet, rawAmountIn.toString(), chainId,network),
                            timeoutLimit
                        );

                        if (odosData?.status === 'timeout' || odosData?.error) {
                            throw new Error(`ODOS error: ${odosData.error || odosData.status}`);
                        }

                        handleResult('ODOS', { ...odosData, amountOut: odosData.outAmounts?.[0] || '0' });

                    } else {
                        
                        odosData = await fetchWithCountdown(
                            safeCellId,dexName,
                            () => DEXAPIs.getHinkalODOSPrice(odosIn, odosOut, wallet, rawAmountIn.toString(), chainId,network),
                            timeoutLimit
                        );

                        if (odosData?.status === 'timeout' || odosData?.error) {
                            throw new Error(`ODOS error: ${odosData.error || odosData.status}`);
                        }

                        handleResult('ODOS', { ...odosData, amountOut: odosData.outAmounts?.[0] || '0' });
                    }

                    break;
                }
                /*
                case 'LIFI':
                        const MarbleData = await fetchWithCountdown(
                                safeCellId, dexName,
                                () => DEXAPIs.getMarblePrice(
                                    inputContract,
                                    outputContract,
                                    rawAmountIn,
                                    inputDecimals,
                                    outputDecimals,
                                    chainId,
                                    token,
                                    [],
                                    direction,
                                    network
                                ),
                                timeoutLimit
                            );

                            if (MarbleData?.status === 'timeout' || MarbleData?.error) {
                                throw new Error(`LIFI error: ${MarbleData.error || MarbleData.status}`);
                            }

                            handleResult('lifi', { ...MarbleData });                   

                    break;
                    */
                   /*
                    case 'ODOS': {
                        const odosIn = [{ tokenAddress: inputContract, amount: rawAmountIn.toString() }];
                        const odosOut = [{ tokenAddress: outputContract, proportion: 1 }];

                        let odosData;

                        if (direction === 'cex_to_dex') {
                            odosData = await DEXAPIs.getODOSPrice(
                                odosIn,
                                odosOut,
                                wallet,
                                rawAmountIn.toString(),
                                chainId,
                                network
                            );
                        } else {
                            odosData = await DEXAPIs.getHinkalODOSPrice(
                                odosIn,
                                odosOut,
                                wallet,
                                rawAmountIn.toString(),
                                chainId,
                                network
                            );
                        }

                        if (odosData?.error) {
                            throw new Error(`ODOS error: ${odosData.error}`);
                        }

                        handleResult('ODOS', { ...odosData, amountOut: odosData.outAmounts?.[0] || '0' });
                        break;
                    }
                    */
                    case 'LIFI': {
                        const MarbleData = await DEXAPIs.getMarblePrice(
                            inputContract,
                            outputContract,
                            rawAmountIn,
                            inputDecimals,
                            outputDecimals,
                            chainId,
                            token,
                            [],
                            direction,
                            network
                        );

                        if (MarbleData?.error) {
                            throw new Error(`LIFI error: ${MarbleData.error}`);
                        }

                        handleResult('lifi', { ...MarbleData });
                        break;
                    }

                default:
                    console.warn(`[⚠️ fetchDEXPrices] DEX tidak dikenal: ${dexName}`);
                    break;
            }

         } catch (err) {
            const fallbackSlugMap = {
                'KyberSwap': 'kyberswap',
                'Matcha': '0x',
                'OKXDEX': 'okx',
                'ODOS': 'odos',
//                'ParaSwap': 'paraswap',
            };
            const slug = fallbackSlugMap[dexName];
            
            // Statistik error per DEX
            this.errorStats = this.errorStats || {};
            this.errorStats[dexName] = this.errorStats[dexName] || { timeout: 0, dexError: 0 };

            // Konversi error menjadi string
            const errorMessage = typeof err === 'string'
                ? err
                : err?.error || err?.message || JSON.stringify(err) || 'Unknown error';

            const isFetchError = errorMessage.toLowerCase().includes('timeout') ||
                                errorMessage.toLowerCase().includes('network') ||
                                errorMessage.toLowerCase().includes('request') ||
                                errorMessage.toLowerCase().includes('fetch') ||
                                errorMessage.toLowerCase().includes('fail');

            if (isFetchError) {
                this.incrementDexError(dexName);
                this.errorStats[dexName].timeout += 1;
            } else {
                this.errorStats[dexName].dexError += 1;
            }

            this.CellResult(token, cexData, { isFallbackLoading: true }, direction, cexName, dexName);

            if (!slug) {
                this.CellResult(token, cexData, { error: errorMessage }, direction, cexName, dexName);
                return;
            }
           
          // if(err.message=="Request timeout"){
                DEXAPIs.getSWOOPPrice( slug, direction,  inputContract,  outputContract, rawAmountIn,  inputDecimals, outputDecimals,  chainId, this.settings?.WalletAddress || '0x0000000000000000000000000000000000000000',  quotePriceUSDT,network )
                .then(fallbackData => {
                    handleResult(dexName, fallbackData, 'amountOut');
                }).catch(fallbackErr => {
                    const fallbackErrorMessage = typeof fallbackErr === 'string'
                        ? fallbackErr
                        : fallbackErr?.error || fallbackErr?.message || JSON.stringify(fallbackErr) || 'Unknown fallback error';

                    console.error(`❌ Fallback gagal → ${dexName} => ${token.symbol}/${token.pairSymbol}`, fallbackErrorMessage);
                    this.CellResult(token, cexData, {
                            error: fallbackErrorMessage,
                            isFromFallback: true // ← ini penting untuk membedakan
                        }, direction, cexName, dexName);

                });
           // }
        
        }
    }

    CellResult(token, cexInfo, dexInfo, direction, cexName, dexName) {
        let cellId = direction === 'cex_to_dex'
            ? `cell_${token.symbol}_${token.pairSymbol}_${token.chain}_${cexName}_${dexName}`
            : `cell_${token.pairSymbol}_${token.symbol}_${token.chain}_${dexName}_${cexName}`;
        const cleanCellId = cellId.toLowerCase().replace(/\W+/g, '');
        const $cell = $('#' + cleanCellId);
        if (!$cell.length) return;

        if (!dexInfo || dexInfo.error || dexInfo.isFallbackLoading || !dexInfo.normalizedOut || dexInfo.normalizedOut <= 0 || dexInfo.hasilUSDT <= 0) {
        let content = '';

        if (dexInfo?.isFallbackLoading) {
            content = `
                <div class="price-info text-center text-dark small">⌛ Via Swoop...</div>
                <div>&nbsp;</div>
                <div class="pnl-info">&nbsp;</div>
            `;
            $cell.removeClass().addClass('dex-price-cell text-center text-warning').html(content);
            return;
        }

        const errorRaw = (dexInfo?.error?.message || dexInfo?.error || 'Fetch Error').toString().toLowerCase();
        const isFallbackError = dexInfo?.isFromFallback === true;
        const title = `${dexName}: ${errorRaw.substring(0, 120)}`;

        // Pilih emoji berdasarkan isi error
        let emoji = '❓'; // default

        if (errorRaw.includes('timeout')) emoji = '🕒';
            else if (errorRaw.includes('network') || errorRaw.includes('fetch')) emoji = '❌';
            else if (errorRaw.includes('unauthorized') || errorRaw.includes('401')) emoji = '🛑';
            else if (errorRaw.includes('forbidden') || errorRaw.includes('403')) emoji = '🚫';
            else if (errorRaw.includes('slow') || errorRaw.includes('delay')) emoji = '🐌';
            else if (isFallbackError) emoji = '⚠️';

            // 🔢 Hitung jumlah emoji per DEX
            this.errorVisualStats = this.errorVisualStats || {};
            this.errorVisualStats[dexName] = this.errorVisualStats[dexName] || {};
            this.errorVisualStats[dexName][emoji] = (this.errorVisualStats[dexName][emoji] || 0) + 1;

            content = `
                <div class="price-info">&nbsp;</div>
                <div title="${title}" class="text-danger">${dexName} ${emoji}</div>
                <div class="pnl-info">&nbsp;</div>
            `;

            $cell.removeClass().addClass('dex-price-cell text-center text-light');
            $cell.addClass(isFallbackError ? 'pink' : 'abu');
            $cell.html(content);
            return;
        }

        const modal = direction === 'cex_to_dex' ? token.modalCexToDex : token.modalDexToCex;

        if (typeof dexInfo.feeDEX === 'number' && dexInfo.feeDEX > 0) {
           var fee = dexInfo.feeDEX;
        } else {
           var fee = dexInfo.feeSwapUSDT;
        }
        
        const baseBuy = dexInfo.baseBuy || 0;
        const baseSell = dexInfo.baseSell || 0;
        const quoteUSDT = dexInfo.quotePriceUSDT || dexInfo.price || 0;
        const rawRate = dexInfo.rawRate || 0;

        let buyPrice = direction === 'cex_to_dex' ? baseBuy : rawRate;
        let sellPrice = direction === 'cex_to_dex' ? rawRate : baseSell;

        // 🔁 Convert DEX price to USDT if direction is CEX → DEX
        if (direction === 'cex_to_dex') {
            const quoteSymbol = token.pairSymbol.toUpperCase();
            const quoteToUSDT = cexInfo?.[`${quoteSymbol}ToUSDT`]?.buy || cexInfo?.[`${quoteSymbol}ToUSDT`]?.sell || 0;
            if (rawRate && quoteToUSDT) {
                sellPrice = rawRate * quoteToUSDT;
            }
        }

        const qty = dexInfo.normalizedIn || (modal / baseBuy);
        const resultQty = dexInfo.normalizedOut || 0;
        const hasilUSDT = dexInfo.hasilUSDT || (resultQty * quoteUSDT);

        // Fee Detail
        const matchedCEXKey = Object.keys(token.cexInfo || {}).find(k => k.toUpperCase() === cexName.toUpperCase());
        const feeWDToken = token.cexInfo?.[matchedCEXKey]?.[token.symbol.toUpperCase()]?.feewd ?? 0;

       // const feeTrade = modal * 0.0013;

       // Deteksi jika bukan pair USDT
        const symbolUpper = token.symbol.toUpperCase();
        const pairSymbolUpper = token.pairSymbol.toUpperCase();

        const isUSDTBase = symbolUpper === 'USDT';
        const isUSDTQuote = pairSymbolUpper === 'USDT';

        const feeTrade = (!isUSDTBase && !isUSDTQuote)
            ? modal * 0.0035   // Fee 3% jika bukan USDT
            : modal * 0.0013; // Fee default 0.13% jika salah satu USDT

        const feeWD = feeWDToken * baseBuy;
        const totalFee = feeTrade + feeWD + fee;

        const pnl = hasilUSDT - modal;
        const pnlNetto = pnl - totalFee;
        const pnlClass = pnlNetto > 0 ? 'opit' : 'lost';
        const tdStyle = pnlNetto > 0 ? 'background-color:var(--sinyal-info) !important;' : '';

        const fromSymbol = direction === 'cex_to_dex' ? token.symbol : token.pairSymbol;
        const toSymbol = direction === 'cex_to_dex' ? token.pairSymbol : token.symbol;
        const resultSymbol = toSymbol;
        const resultDecimals = direction === 'cex_to_dex' ? token.pairDecimals : token.decimals;

        const linkSwap = direction === 'cex_to_dex'
            ? this.generateDexLink(dexName, token.chain, token.symbol, token.contractAddress, token.pairSymbol, token.pairContractAddress)
            : this.generateDexLink(dexName, token.chain, token.pairSymbol, token.pairContractAddress, token.symbol, token.contractAddress);
        
        const mainSymbol = token.symbol.toUpperCase();
        const cexLinks = this.GeturlExchanger(cexName.toUpperCase(), mainSymbol, mainSymbol);
        const cexLink = cexLinks.tradeLink || '#';
        const buyLink = direction === 'cex_to_dex' ? cexLink : linkSwap;
        const sellLink = direction === 'cex_to_dex' ? linkSwap : cexLink;
        
        // Konversi harga ke IDR
        const resultPriceUSDT = (
            cexInfo?.[`${resultSymbol.toUpperCase()}ToUSDT`]?.buy ||
            cexInfo?.[`${resultSymbol.toUpperCase()}ToUSDT`]?.sell ||
            0
        );
        const usdtValueFinal = resultQty * resultPriceUSDT;
        const usdtToIDR = window.ExchangeRates?.IndodaxUSDT || 16000;
        const buyPriceIDR = buyPrice * usdtToIDR;
        const sellPriceIDR = sellPrice * usdtToIDR;
        const swapRate = resultQty / qty;

        // Tooltip versi LOG 
        const hargaSwapEfektif = direction === 'cex_to_dex'
        ? ((resultQty / qty) * quoteUSDT).toFixed(6)
        : (modal / resultQty).toFixed(6);

    const pnlPersen = ((pnl / modal) * 100).toFixed(2);

    const tooltip = direction === 'cex_to_dex'
        ? `
    ✅ [LOG CEX → DEX] ${token.symbol} → ${token.pairSymbol} on ${(token.chain).toUpperCase()}
    🔄 [${cexName.toUpperCase()} → ${(dexInfo.exchange).toUpperCase()}]

    🪙 Modal: $${modal}
    🛒 Beli di ${cexName} @ $${baseBuy.toFixed(6)} → ${qty.toFixed(6)} ${token.symbol}
    💱 Harga Beli (${cexName.toUpperCase()}) dalam IDR: Rp ${Math.round(buyPriceIDR).toLocaleString('id-ID')}

    💰 Swap di ${dexName}:
    - Harga Swap Efektif: ~$${hargaSwapEfektif} / ${token.symbol}
    - Hasil: $${hasilUSDT.toFixed(6)}
    💱 Harga Jual (${dexName.toUpperCase()}) dalam IDR: Rp ${Math.round(sellPriceIDR).toLocaleString('id-ID')}

    💸 Fee WD: $${feeWD.toFixed(2)}
    🛒 Fee Swap: $${fee.toFixed(2)}
    🧾 Total Fee: ~$${totalFee.toFixed(2)}

    📈 PNL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${pnlPersen}%)
    🚀 PROFIT : ${pnlNetto.toFixed(2)} USDT
    `.trim()
        : `
    ✅ [LOG DEX → CEX] ${token.pairSymbol} → ${token.symbol} on ${(token.chain).toUpperCase()}
    🔄 [${cexName.toUpperCase()} → ${(dexInfo.exchange).toUpperCase()}]

    🪙 Modal: $${modal}
    🛒 Swap di ${dexName} → ${resultQty.toFixed(6)} ${token.symbol} @ ~$${hargaSwapEfektif}/${token.symbol}
    💱 Harga Beli (${dexName.toUpperCase()}) dalam IDR: Rp ${Math.round(buyPriceIDR).toLocaleString('id-ID')}

    💰 Jual di ${cexName}:
    - Harga Jual: ~$${baseSell.toFixed(6)}/${token.symbol}
    - Hasil: $${hasilUSDT}
    💱 Harga Jual (${cexName.toUpperCase()}) dalam IDR: Rp ${Math.round(sellPriceIDR).toLocaleString('id-ID')}

    💸 Fee Swap: $${fee.toFixed(2)}
    🧾 Total Fee: ~$${totalFee.toFixed(2)}

    📈 PNL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${pnlPersen}%)
    🚀 PROFIT : ${pnlNetto.toFixed(2)} USDT
    `.trim();

        // ➕ Kirim sinyal jika PNL positif
        if (pnlNetto > 0) {
            this.pnlSignals = this.pnlSignals || {};
            const dexKey = dexName.toUpperCase();
            this.pnlSignals[dexKey] = this.pnlSignals[dexKey] || [];

            const fromSideRaw = direction === 'cex_to_dex' ? cexName : dexName;
            const toSideRaw = direction === 'cex_to_dex' ? dexName : cexName;

            const fromSide = CexShortMap[fromSideRaw] || fromSideRaw;
            const toSide = CexShortMap[toSideRaw] || toSideRaw;

            const shortChain = CHAIN_CONFIG[token.chain?.toLowerCase()]?.short || 'CHAIN';

            const cexColor = this.getTextColorClassFromBadge(this.getBadgeColor(cexName, 'cex'));
            const chainColor = this.getTextColorClassFromBadge(this.getBadgeColor(token.chain, 'chain'));
            const rowId = `token-row-${token.id}-${cexName.replace(/\W+/g, '').toLowerCase()}`;
            
            const cexBadgeColor = this.getBadgeColor(cexName, 'cex');
            
             const directionLabel = direction === 'cex_to_dex'
                ? `<span class="pe-1 ${cexColor} fw-bold">${fromSide.toUpperCase()}</span><span class="text-success fw-bold">[${fromSymbol}⇄${toSymbol}] </span><span class="${chainColor} ">[${shortChain}]</span>`
                : `<span class="pe-1 ${cexColor} fw-bold">${toSide.toUpperCase()}</span><span class="text-danger fw-bold">[${fromSymbol}⇄${toSymbol}] </span><span class="${chainColor} ">[${shortChain}]</span>`;

            const signalText = `
                <a href="#${rowId}" class="text-decoration-none text-dark text-break align-middle">${directionLabel}:<span class="fw-bold " style="color:#dd9d06;">${modal}$</span>→<span class="text-dark fw-bold" >${pnlNetto.toFixed(2)}$</span></a>`;

            const signalKey = `${token.symbol}_${token.pairSymbol}_${token.chain}_${cexName}_${dexName}_${direction}`;
            const listEl = document.getElementById(`pnl-list-${dexKey}`);
            const existingLI = listEl?.querySelector(`li[data-key="${signalKey}"]`);
            
           // this.highestPNLSignal = this.highestPNLSignal || {};

            if (!this.pnlSignals[dexKey][signalKey] && !existingLI) {
                this.pnlSignals[dexKey][signalKey] = {
                    html: signalText,
                    pnlNetto: parseFloat(pnlNetto)
                };

                if (listEl) {
                    listEl.classList.add('list-unstyled');

                    const highlightClass = parseFloat(pnlNetto) > parseFloat(this.settings.PNLFilter)
                        ? "highlight px-1 fs-8 fw-bold"
                        : "biasa px-1 fs-8";

                    const li = document.createElement("li");
                    li.className = highlightClass;
                    li.setAttribute("data-key", signalKey);
                    li.innerHTML = `✶ ${signalText}`;
                    listEl.append(li);
                }
            }

            // 🟨 SELALU cek apakah ini PNL tertinggi
            const prevPNL = this.highestPNLSignal[dexKey]?.pnlNetto ?? -Infinity;

            if (parseFloat(pnlNetto) > prevPNL) {
                this.highestPNLSignal[dexKey] = {
                    html: signalText,
                    pnlNetto: parseFloat(pnlNetto)
                };

                // ✅ Ganti isi span jika memang lebih tinggi
                $(`#new_${dexKey}_Signal`).html(`${signalText}`);
            }

            const username = this.settings.UserName || 'Anon';
            const modalParsed = parseFloat(modal);
            const pnlFilter = parseFloat(this.settings.PNLFilter);

           if (direction === 'cex_to_dex') {
                const audio = new Audio(pnlNetto > pnlFilter ? 'boom.mp3' : 'sinyal.mp3');
                audio.play();

                if (pnlNetto > pnlFilter) {
                    // CEX → DEX: baseBuy vs hargaSwapEfektif
                    this.sendInfoSignal(
                        username, token, cexName, dexName,
                        baseBuy, hargaSwapEfektif,
                        feeWD, fee, totalFee, pnl, pnlNetto,
                        direction, modalParsed
                    );
                }

            } else if (direction === 'dex_to_cex') {
                const audio = new Audio(pnlNetto > pnlFilter ? 'boom.mp3' : 'sinyal.mp3');
                audio.play();

                if (pnlNetto > pnlFilter) {
                    // DEX → CEX: hargaSwapEfektif vs baseSell
                    this.sendInfoSignal(
                        username, token, cexName, dexName,
                        hargaSwapEfektif, baseSell,
                        feeWD, fee, totalFee, pnl, pnlNetto,
                        direction, modalParsed
                    );
                }
            }

        }

       // Render status WD/DP sesuai arah
        let statusWalletCEX = '';
        const wdStatus = token.cexInfo?.[matchedCEXKey]?.[token.symbol.toUpperCase()]?.wd ?? false;
        const depoStatus = token.cexInfo?.[matchedCEXKey]?.[token.symbol.toUpperCase()]?.depo ?? false;
 
        if (direction === 'cex_to_dex') {
            if (wdStatus === true) {
                statusWalletCEX = `<a href="${cexLinks.withdrawUrl}" target="_blank" class="text-primary fs-8">🈳 WD: ${PriceUtils.formatFee(feeWD)}</a>`;
            } else if (wdStatus === false) {
                statusWalletCEX = `<a href="${cexLinks.withdrawUrl}" target="_blank" class="text-primary fs-8">🚫 WD</a>`;
            } else {
                statusWalletCEX = `<a href="${cexLinks.withdrawUrl}" target="_blank" class="text-primary fs-8">❗ WD</a>`;
            }
        } else {
           const shortSymbol = toSymbol.substring(0, 6); // atau: toSymbol.slice(0, 6)
            if (depoStatus === true) {
                statusWalletCEX = `<a href="${cexLinks.depositUrl}" target="_blank" class="text-warning fs-8">🈷️ DP[${shortSymbol}]</a>`;
            } else if (depoStatus === false) {
                statusWalletCEX = `<a href="${cexLinks.depositUrl}" target="_blank" class="text-warning fs-8">🚫 DP[${shortSymbol}]</a>`;
            } else {
                statusWalletCEX = `<a href="${cexLinks.depositUrl}" target="_blank" class="text-warning fs-8">❗ DP[${shortSymbol}]</a>`;
            }

        }

        // 🎯 Render ke dalam cell 
        $cell
            .attr('style', tdStyle)
            .attr('title', tooltip)
            .removeClass()
            .addClass('dex-price-cell align-middle')
            .html(`
                <div>
                    <div class="small text-muted fw-bold">${dexName.toUpperCase()}</div>
                    <a href="${buyLink}" target="_blank" class="text-success">⬆ ${PriceUtils.formatPrice(buyPrice)}</a><br>
                    <a href="${sellLink}" target="_blank" class="text-danger">⬇ ${PriceUtils.formatPrice(sellPrice)}</a>
                </div>
                ${statusWalletCEX}
                <div class="fw-bold text-danger">Swap: ${PriceUtils.formatFee(fee)}</div>
                <div class="text-dark small" title="PNL - Fee Total"><strong>[${PriceUtils.formatPNL(pnl)} - ${(totalFee).toFixed(2)}]</strong></div>
                <div class="${pnlClass}"><strong>💰 NET: ${PriceUtils.formatPNL(pnlNetto)}</strong></div>
            `);
    }
 
    initPNLSignalStructure() {
        const container = $('#dexSignals');
        container.empty();

        this.pnlSignals = {};

        // Gunakan row Bootstrap dengan grid responsive
        const row = $('<div class="row g-2"></div>');

        DexList.forEach((dex) => {
            this.pnlSignals[dex] = [];

            const dexId = dex.toUpperCase();
            const collapseId = `collapse-${dexId}`;
            const listId = `pnl-list-${dexId}`;
            const textColor = this.getTextColorClassFromBadge(this.getBadgeColor(dex, 'dex'));

            const card = $(`
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card border shadow-sm rounded-top no-rounded-bottom h-100">
                        <!-- HEADER -->
                        <div class="card-header px-1 py-1 d-flex justify-content-between align-items-center border-bottom-0 align-middle NameSinyalDEX" style="min-height: unset;">
                            <div class="fw-semibold text-uppercase ps-2" style="font-size: 0.85rem;">
                                ${dexId} &nbsp;<span class="badge fs-8 bg-warning-subtle" id="new_${dexId}_Signal" ></span> 
                            </div>
                            <i class="bi bi-caret-down-fill toggle-icon" id="icon-${dexId}"
                                data-bs-toggle="collapse"
                                data-bs-target="#${collapseId}"
                                aria-expanded="true"
                                aria-controls="${collapseId}"
                                style="cursor: pointer; font-size: 0.85rem;"></i>
                        </div>
                        <!-- BODY -->
                        <div class="card-body p-2  InfoSinyalDEX align-middle">
                            <div id="${collapseId}" class="collapse show">
                                <div id="${listId}" class="d-flex flex-column gap-1 small text-start"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            row.append(card);
        });

        container.append(row);

        // Event collapse Bootstrap
        container.on('shown.bs.collapse', function (e) {
            const targetId = $(e.target).attr('id');
            const dexId = targetId.replace('collapse-', '');
            $(`#icon-${dexId}`).removeClass('bi-caret-right-fill').addClass('bi-caret-down-fill');
        });

        container.on('hidden.bs.collapse', function (e) {
            const targetId = $(e.target).attr('id');
            const dexId = targetId.replace('collapse-', '');
            $(`#icon-${dexId}`).removeClass('bi-caret-down-fill').addClass('bi-caret-right-fill');
        });
    }

    generateDexLink(dex, tokenChain, tokenSymbol, tokenAddress, pairSymbol, pairAddress) {
        const chainName = tokenChain.toLowerCase(); // e.g. 'bsc', 'ethereum'        
        //const chainCode = chainCodeMap[chainName] || 1;
         const chainCode = CHAIN_CONFIG[chainName]?.code


        const links = {
            kyberswap: `https://kyberswap.com/swap/${chainName}/${tokenAddress}-to-${pairAddress}`,
            matcha: `https://matcha.xyz/tokens/${chainName}/${tokenAddress.toLowerCase()}?buyChain=${chainCode}&buyAddress=${pairAddress.toLowerCase()}`,
            magpie: `https://app.magpiefi.xyz/swap/${chainName}/${tokenSymbol.toUpperCase()}/${chainName}/${pairSymbol.toUpperCase()}`,
            odos: "https://app.odos.xyz",
            okxdex: `https://www.okx.com/web3/dex-swap?inputChain=${chainCode}&inputCurrency=${tokenAddress}&outputChain=501&outputCurrency=${pairAddress}`,
            paraswap: `https://app.ParaSwap.xyz/#/swap/${tokenAddress}-${pairAddress}?version=6.2&network=${chainName}`,
            '1inch': ` https://app.1inch.io/advanced/swap?network=${chainCode}&src=${tokenAddress}&dst=${pairAddress}`,
            lifi :`https://jumper.exchange/?fromChain=${chainCode}&fromToken=${tokenAddress}&toChain=${chainCode}&toToken=${pairAddress}`
        };

        return links[dex.toLowerCase()] || null;
    }

    generateStokLinkCEX(tokenAddress, chain, cex) {
        const chainKey = chain.toLowerCase();
        const cexKey = cex.toUpperCase();
        const chainData = CEXWallets[chainKey];
        if (!chainData) return '#STOK';

        const wallet = chainData.WALLET_CEX?.[cexKey]?.address; 
        const explorer = (Object.values(CHAIN_CONFIG).find(c => c.code === Number(chainData.Kode_Chain)) || {}).explorer ;

        if (!wallet) return '#STOK';

        return `${explorer}/token/${tokenAddress}?a=${wallet}`;
    }

    // ✅ Tambahkan fungsi ini dalam class
    GeturlExchanger(cex, NameToken, NamePair, direction = 'cex_to_dex') {
        const token = NameToken.toUpperCase();
        const pair = NamePair.toUpperCase();
        const dir = direction.toLowerCase();

        let tradeLink = '#';
        let withdrawUrl = null;
        let depositUrl = null;
        let symbolWD = token;
        let symbolDP = token;

        // ✅ Tentukan simbol untuk trade berdasarkan arah dan posisi USDT
        let symbolForTrade = 'BTC'; // fallback jika tidak ada pilihan

        if (token === 'USDT') {
            symbolForTrade = pair;
        } else if (pair === 'USDT') {
            symbolForTrade = token;
        } else {
            symbolForTrade = pair;
        }

        switch (cex.toUpperCase()) {
            case 'BINANCE':
                tradeLink = `https://www.binance.com/en/trade/${symbolForTrade}_USDT`;
                withdrawUrl = `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${symbolWD}`;
                depositUrl = `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${symbolDP}`;
                break;

            case 'GATEIO':
                tradeLink = `https://www.gate.io/trade/${symbolForTrade}_USDT`;
                withdrawUrl = `https://www.gate.io/myaccount/withdraw/${symbolWD}`;
                depositUrl = `https://www.gate.io/myaccount/deposit/${symbolDP}`;
                break;

            case 'MEXC':
                tradeLink = `https://www.mexc.com/exchange/${symbolForTrade}_USDT?_from=search`;
                withdrawUrl = `https://www.mexc.com/assets/withdraw/${symbolWD}`;
                depositUrl = `https://www.mexc.com/assets/deposit/${symbolDP}`;
                break;

            case 'INDODAX':
                tradeLink = `https://indodax.com/market/${symbolForTrade}IDR`;
                withdrawUrl = `https://indodax.com/finance/${symbolWD}#kirim`;
                depositUrl = `https://indodax.com/finance/${symbolDP}`;
                break;
            }

        return {
            tradeLink,
            withdrawUrl,
            depositUrl
        };
    }

    // Create token detail content
    createTokenDetailContent(token, cex) {
        const chainId = PriceUtils.getChainId(token.chain);
        const explorerUrl = (Object.values(CHAIN_CONFIG).find(c => c.code === Number(chainId)) || {}).explorer ;

        const tokenSymbol = token.symbol.toUpperCase();
        const pairSymbol = token.pairSymbol.toUpperCase();
        const chain = token.chain.toUpperCase();
        const cexUpper = cex.toUpperCase();

        const cexBadgeColor = this.getBadgeColor(cex, 'cex');
        const cexColor = this.getTextColorClassFromBadge(this.getBadgeColor(cex, 'cex'));

        const chainBadgeColor = this.getBadgeColor(token.chain, 'chain');
        const chainColor = this.getTextColorClassFromBadge(this.getBadgeColor(token.chain, 'chain'));

        const url = this.GeturlExchanger(cexUpper, tokenSymbol, pairSymbol, 'cex_to_dex');
        const url2 = this.GeturlExchanger(cexUpper, pairSymbol, tokenSymbol, 'dex_to_cex');

        const tokenSC = `<a href="${url2.tradeLink}" class="fs-6 mx-1 ${cexColor} " target="_blank">${tokenSymbol}</a>`;
        const pairSC = `<a href="${url.tradeLink}" class="fs-7" target="_blank">${pairSymbol}</a>`;

        const stokTokenLink = this.generateStokLinkCEX(token.contractAddress, token.chain, cexUpper);
        const stokPairLink = this.generateStokLinkCEX(token.pairContractAddress, token.chain, cexUpper);
        const shortChain = CHAIN_CONFIG[token.chain?.toLowerCase()]?.short || 'CHAIN';


        const tokenStok = `<a href="${explorerUrl}/token/${token.contractAddress}" target="_blank">[SC]</a>`;
        const pairStok = `<a href="${explorerUrl}/token/${token.pairContractAddress}" target="_blank">[SC]</a>`;

        const linkOKDEX = `<a href="https://www.okx.com/web3/dex-swap?inputChain=${chainId}&inputCurrency=${token.contractAddress}&outputChain=501&outputCurrency=${token.pairContractAddress}" target="_blank" class="text-dark">#OKX</a>`;
        const linkUNIDEX = `<a href="https://app.unidex.exchange/?chain=${token.chain}&from=${token.contractAddress}&to=${token.pairContractAddress}" target="_blank" class="text-secondary">#UNX</a>`;
        const linkDEFIL = `<a href="https://swap.defillama.com/?chain=${token.chain}&from=${token.contractAddress}&to=${token.pairContractAddress}" target="_blank" class="text-success">#DFL</a>`;
        const link1INCH = `<a href="https://app.1inch.io/advanced/swap?network=${chainId}&src=${token.contractAddress}&dst=${token.pairContractAddress}" target="_blank" class="text-danger">#1NC</a>`;
        const linkJumper = `<a href="https://jumper.exchange/?fromChain=${chainId}&fromToken=${token.contractAddress}&toChain=${chainId}&toToken=${token.pairContractAddress}" target="_blank" class="text-info">#LFX</a>`;
        const linkSQUID = `<a href="https://app.squidrouter.com/?chains=${chainId}%2C${chainId}&tokens=${token.contractAddress}%2C${token.pairContractAddress}" target="_blank" class="text-info">#SQX</a>`;
        const linkRELAY = `<a href="https://relay.link/bridge/${token.chain}?fromChainId=${chainId}&fromCurrency=${token.contractAddress}&toCurrency=${token.pairContractAddress}" target="_blank" class="text-warning">#RLY</a>`;

        // 🔍 Ambil info token & pair dari token.cexInfo
        const matchedCEXKey = Object.keys(token.cexInfo || {}).find(k => k.toUpperCase() === cexUpper);
        const infoCEX = token.cexInfo?.[matchedCEXKey] || {};
        const tokenInfo = infoCEX[tokenSymbol] || {};
        const pairInfo = infoCEX[pairSymbol] || {};

        // === STATUS BADGE ===

        const wdBadgeToken = (tokenInfo.wd === true)
            ? `<a href="${url.withdrawUrl || '#'}" target="_blank" class="text-success">WD</a>`
            : (tokenInfo.wd === false)
                ? `<span class="fw-bold text-danger">WX</span>`
                : `<span class="text-warning">⚠️</span>`;

        const dpBadgeToken = (tokenInfo.depo === true)
            ? `<a href="${url.depositUrl || '#'}" target="_blank" class="text-success">DP</a>`
            : (tokenInfo.depo === false)
                ? `<span class="fw-bold text-danger">DX</span>`
                : `<span class="text-warning">⚠️</span>`;

        const wdBadgePair = (pairInfo.wd === true)
            ? `<a href="${url2.withdrawUrl || '#'}" target="_blank" class="text-success">WD</a>`
            : (pairInfo.wd === false)
                ? `<span class="fw-bold text-danger">WX</span>`
                : `<span class="text-warning">⚠️</span>`;

        const dpBadgePair = (pairInfo.depo === true)
            ? `<a href="${url2.depositUrl || '#'}" target="_blank" class="text-success">DP</a>`
            : (pairInfo.depo === false)
                ? `<span class="fw-bold text-danger">DX</span>`
                : `<span class="text-warning">⚠️</span>`;
      return `
          <div class="bg-white py-1">
                <div class="d-block mb-1">   
                    <button class="btn bg-success btn-xs text-light"  onclick="app.confirmToggleToken('${token.id}')" title="Ganti Status">
                        <i class="bi bi-power"></i>
                    </button>

                     <strong class="fs-7 align-middle">${token.modalCexToDex}$ ⇔ ${token.modalDexToCex}$</strong>
                    <button class="btn bg-primary btn-xs text-light" onclick="app.editToken('${token.id}')" title="Ubah">
                        <i class="bi bi-pencil"></i>
                    </button>
                     <button class="btn bg-danger btn-xs text-light" onclick="app.deleteToken('${token.id}')" title="Hapus">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>

                <!-- CEX & Chain badge -->
                <div class="d-block mb-1 text-secondary fs-6">
                    <span class="badge ${cexBadgeColor}">${cexUpper}</span>
                    in <span class="badge ${chainBadgeColor}">${shortChain}</span>
                </div>

                <!-- SC & Trade Info -->
                <div class="d-block mb-1 fw-bold">
                    <span>${tokenSC}<a href="${stokTokenLink}" target="_blank"><i class="bi bi-wallet"></i></a></span>
                    VS 
                    <span>${pairSC} <a href="${stokPairLink}" target="_blank"><i class="bi bi-wallet"></i></a></span>
                </div>

                <!-- Status WD/DP masing-masing -->
                <div class="d-block mb-1 text-secondary fs-9">
                    ${tokenStok}[${wdBadgeToken} ${dpBadgeToken}]
                    ~
                    ${pairStok}[${wdBadgePair} ${dpBadgePair}]
                </div>

                <!-- Link-link DEX -->
                <div class="d-block mb-1 fw-bold fs-8">
                    ${link1INCH} ${linkOKDEX} ${linkDEFIL} ${linkUNIDEX} ${linkSQUID} 
                </div>
            </div>
            `;
    }

    confirmToggleToken(tokenId) {
        const userConfirmed = confirm("Apakah Anda yakin ingin mengganti status token ini?\nPerubahan akan berlaku setelah refresh.");
        if (userConfirmed) {
            this.toggleTokenStatus(tokenId);
            alert("Status berhasil diganti. Silakan refresh halaman untuk melihat perubahan.");
        }
    }

    // Utility functions
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showAlert(message, type = 'info') {
        const alertId = 'alert-' + Date.now();

        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show position-fixed d-flex align-items-center justify-content-between"
                style="top: 1%; left: 50%; transform: translateX(-50%); z-index: 9999; min-width: 70%; max-width: 90vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 3rem;">
                <div class="me-2">${message}</div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        $('body').append(alertHtml);

        setTimeout(() => {
            $(`#${alertId}`).alert('close');
        }, 5000);

        // 🔔 Tambahan Android: hapus HTML sebelum dikirim ke native
        if (window.Android && typeof window.Android.showToast === 'function') {
            const plainText = message.replace(/<[^>]*>/g, ''); // hapus semua <tag>
            window.Android.showToast(plainText);
        }

        // 💥 Tambahan: Getar jika tersedia
        if (window.Android && typeof window.Android.vibrate === 'function') {
            window.Android.vibrate(200); // Getar 200ms
        }
    }

    logAction(message) {
        const now = new Date();

        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0'); // Bulan dimulai dari 0
        const yyyy = now.getFullYear();

        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');

        const timestamp = `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
        const fullMessage = `${timestamp} </br> [${message}]`;

        // Simpan ke localStorage
        localStorage.setItem("MULTIALL_ACTIONS", fullMessage);

        // Update tampilan
        $('#infostatus').html(fullMessage);

        // Logging ke console (opsional)
        console.log("Action:", fullMessage);
    }

    sendStatusTELE(user, status) {
        var users = [
            { chat_id: -1002079288809 }
        ];

         // Ambil hanya token yang aktif
        const activeTokens = this.tokens.filter(t => t.isActive);

        // Hitung jumlah per chain
        const bscCount = activeTokens.filter(t => t.chain === 'BSC').length;
        const ethCount = activeTokens.filter(t => t.chain === 'Ethereum').length;
        const polyCount = activeTokens.filter(t => t.chain === 'Polygon').length;
        const baseCount = activeTokens.filter(t => t.chain === 'Base').length;
        const arbCount = activeTokens.filter(t => t.chain === 'Arbitrum').length;
        
        var apiUrl = (typeof CONFIG_TELEGRAM !== 'undefined' && CONFIG_TELEGRAM.PROXY_URL) ? CONFIG_TELEGRAM.PROXY_URL : '';

       // var message = "MULTI ARBITRAGE: #" + user.toUpperCase() + " is <b>[ " + status + " ]</b>";
        let message =
        `#${user.toUpperCase()} is <b>${status}</b> in MULTIALL\n` +
        `-------------------------------------------\n` +
        `• <b>BSC</b>: ${bscCount} ` +
        `• <b>Ethereum</b>: ${ethCount} \n` +
        `• <b>Polygon</b>: ${polyCount} ` +
        `• <b>Base</b>: ${baseCount} \n` +
        `• <b>Arbitrum</b>: ${arbCount} ` ;
        // Loop melalui daftar pengguna
        for (var i = 0; i < users.length; i++) {
            var user = users[i];
            var chatId = user.chat_id; // Ganti dengan ID chat pengguna

            // Membuat permintaan POST menggunakan jQuery
            if (!apiUrl) continue;
            $.ajax({
                url: apiUrl,
                method: "POST",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                }),
                success: function(response) {
                    // ok
                },
                error: function(xhr, status, error) {
                    console.log("Error sending message:", error);
                }
            });
          }
    }

    sendInfoSignal(user, token, cex, dex, buyPrice, sellPrice, feeWD, feeSwap,totalFee, pnl,netto, direction, modal) {
        const users = [
            { chat_id: -1002079288809 }
        ];

        const apiUrl = (typeof CONFIG_TELEGRAM !== 'undefined' && CONFIG_TELEGRAM.PROXY_URL) ? CONFIG_TELEGRAM.PROXY_URL : '';

        const fromSymbol = direction === 'cex_to_dex' ? token.symbol : token.pairSymbol;
        const toSymbol   = direction === 'cex_to_dex' ? token.pairSymbol : token.symbol;
        const scIn       = direction === 'cex_to_dex' ? token.contractAddress : token.pairContractAddress;
        const scOut      = direction === 'cex_to_dex' ? token.pairContractAddress : token.contractAddress;

        const chainName  = token.chain.toLowerCase();
       
        const chainId = Object.values(CHAIN_CONFIG).find(c => c.name === chainName)?.code || '1';

        const explorerBase = (Object.values(CHAIN_CONFIG).find(c => c.code === Number(chainId)) || {}).explorer || CHAIN_CONFIG.ethereum.explorer;

        const linkBuy  = `<a href="${explorerBase}/token/${scIn}" target="_blank">${fromSymbol}</a>`;
        const linkSell = `<a href="${explorerBase}/token/${scOut}" target="_blank">${toSymbol}</a>`;

        // ✅ Ambil link trade CEX masing-masing simbol
        const cexLinkFrom = this.GeturlExchanger(cex.toUpperCase(), fromSymbol, fromSymbol)?.tradeLink || '#';
        const cexLinkTo   = this.GeturlExchanger(cex.toUpperCase(), toSymbol, toSymbol)?.tradeLink || '#';

        const dexTradeLink = `https://swap.defillama.com/?chain=${token.chain}&from=${scIn}&to=${scOut}`;
       // console.log("isi pesan : ");

        const message =
            `<b>#SIGNAL_MULTIALL</b>\n` +
            `<b>USER:</b> #${user}\n` +
            `--------------------------------------------\n` +
             `<b>MARKET:</b> <a href="${cexLinkFrom}" target="_blank">${cex.toUpperCase()}</a> VS <a href="${dexTradeLink}" target="_blank">${dex.toUpperCase()}</a>\n` +
             `<b>CHAIN:</b> ${token.chain.toUpperCase()}\n` +
             `<b>TOKEN-PAIR:</b> <b>#<a href="${cexLinkFrom}" target="_blank">${fromSymbol}</a>_<a href="${cexLinkTo}" target="_blank">${toSymbol}</a></b>\n` +
             `<b>MODAL:</b> $${modal} | <b>OPIT:</b> ${netto.toFixed(2)}$ \n` +
             `<b>BUY:</b> ${linkBuy} @ ${buyPrice} \n` +
             `<b>SELL:</b> ${linkSell} @ ${sellPrice} \n` +
             `<b>FEE WD:</b> ${feeWD.toFixed(3)}$ \n` +
             `<b>FEE TOTAL:</b> $${totalFee.toFixed(2)} | <b>SWAP:</b> $${feeSwap.toFixed(2)}\n` +
            `<b>PNL:</b> ${pnl.toFixed(3)}$\n` +
            `--------------------------------------------`;
      //  console.log(message);

        users.forEach(user => {
            if (!apiUrl) return;
            $.ajax({
                url: apiUrl,
                method: "POST",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    chat_id: user.chat_id,
                    text: message,
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                }),
                success: function () {
                    // ok
                },
                error: function (xhr, status, error) {
                    // noop
                }
            });
        });
    }

    tryAutoScrollToRow(firstToken) {
        const isAutoScroll = localStorage.getItem('MULTIALL_SCROLL') === 'true';
        if (!isAutoScroll) return;

        const firstCEX = (firstToken).selectedCexs?.[0] || 'binance';
        const rowId = `token-row-${firstToken.id}-${firstCEX.toLowerCase()}`;
        const $row = $('#' + rowId);
        const $wrapper = $('.scrollable-price-table');

        if ($row.length && $wrapper.length) {
            const headerOffset = 60; // Ubah sesuai tinggi header table kamu
            const rowTop = $row[0].offsetTop;
            $wrapper[0].scrollTo({
                top: rowTop - headerOffset,
                behavior: 'smooth'
            });
            setTimeout(() => $row.removeClass('highlight-row'), 2500);
        }
    }

    isSettingInvalid() {
        const parsed = this.settings;
        return (
            !parsed ||
            parsed.UserName === 'XXX' || !parsed.UserName || parsed.UserName.trim() === '' ||
            parsed.WalletAddress === '-' || !parsed.WalletAddress || parsed.WalletAddress.trim() === ''
        );
    }

}

// Initialize the application when DOM is ready
$(document).ready(function() {
    window.app = new TokenPriceMonitor();
    
    $('#scrollTopBtn').show();
    
   // Fungsi untuk menerapkan tema dan tandai kotak aktif
    function applyTheme(theme) {
        $('body').attr('data-theme', theme);
        localStorage.setItem('MULTIALL_theme', theme);

        // Highlight kotak aktif
        $('.theme-box').removeClass('active');
        $(`.theme-box[data-theme="${theme}"]`).addClass('active');
    }

    // Fungsi validasi tema yang tersedia
    function isValidTheme(theme) {
        const allowedThemes = ['biru', 'ijo', 'coklat', 'abu', 'pink', 'orange', 'ungu'];
        return allowedThemes.includes(theme);
    }

    // === Saat awal page dimuat ===
    const savedTheme = localStorage.getItem('MULTIALL_theme');

    if (!savedTheme || !isValidTheme(savedTheme)) {
        const defaultTheme = 'biru';
        alert("🎨 SILAKAN PILIH TEMA LAIN [POJOK KANAN ATAS]!");
        applyTheme(defaultTheme);
        localStorage.removeItem('MULTIALL_theme'); // bersihkan jika tidak valid
    } else {
        applyTheme(savedTheme);
    }

    // === Klik kotak palet warna ===
    $('.theme-box').on('click', function () {
        const selected = $(this).data('theme');
        applyTheme(selected);
    });

    
    if (!$('#alert-container').length) {
        $('body').append(`
            <div id="alert-container" class="position-fixed d-flex gap-2"
                style="top: 6%; right: 2%; z-index: 9999; flex-wrap: wrap; justify-content: flex-end;">
            </div>
        `);
    }

    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        if ($(e.target).attr('href') === '#tokenManagement') {
            app.updateStats();
        }
    });

    // Saat tab apapun diklik dan ditampilkan
    $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        $('#dexSignals').hide(); // Sembunyikan elemen dexSignals
    });

      // Inisialisasi nilai dari localStorage
    const saved = localStorage.getItem('MULTIALL_SCROLL');
    $('#autoScrollCheckbox').prop('checked', saved === 'true');

    // Simpan perubahan ke localStorage saat dicentang/ubah
    $('#autoScrollCheckbox').on('change', function () {
        const isChecked = $(this).is(':checked');
        localStorage.setItem('MULTIALL_SCROLL', isChecked);

        // Tambahkan alert berdasarkan status
        if (isChecked) {
            //alert('✅ Auto Scroll diaktifkan.');
            app.showAlert('✅  Auto Scroll AKTIF ...', 'success');
        } else {
            //alert('⛔ Auto Scroll dimatikan.');
            app.showAlert('❌ Auto Scroll NON AKTIF...!', 'warning');
        }
    });

    // Tampilkan tombol saat scroll
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $('#scrollTopBtn').fadeIn();
        } else {
            $('#scrollTopBtn').fadeOut();
        }
    });

    // Scroll ke atas saat tombol diklik
    $('#scrollTopBtn').click(function () {
        $('html, body').animate({ scrollTop: 0 }, 300);
        return false;
    });
});

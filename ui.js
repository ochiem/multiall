/**
 * Manages the visibility of main application sections, ensuring only one is visible at a time.
 * @param {string | null} sectionIdToShow The ID of the section to show. If null, all main sections are hidden.
 */
function showMainSection(sectionIdToShow) {
    const allSections = [
        '#database-viewer-section',
        '#token-management',
        '#form-setting-app',
        '#update-wallet-section',
        '#iframe-container',
        // Main scanner view is a combination of these elements
        '#scanner-config',
        '#sinyal-container',
        '#filter-card',
        '#monitoring-scroll'
    ];

    const $form   = $("#FormScanner");
    const $start  = $('#startSCAN');
    const $stop   = $('#stopSCAN');
    const $import = $('#uploadJSON');
    const $export = $('a[onclick="downloadTokenScannerCSV()"], #btnExportTokens');
    const $settingsIcon = $('#SettingConfig');
    const $toolIcons = $('.header-card .icon');
    const $chainLinks = $('#chain-links-container a, #chain-links-container .chain-link');
    const $filterControls = $('#filter-card').find('input, .toggle-radio, button, label');
    const $sortToggles = $('.sort-toggle');

    // Hide all sections first
    allSections.forEach(id => $(id).hide());

    if (sectionIdToShow === 'scanner') {
        // Special case for the main scanner view
        $('#scanner-config, #sinyal-container, #filter-card, #monitoring-scroll').show();
    } else if (sectionIdToShow) {
        $(sectionIdToShow).show();
    }
}

// =================================================================================
// UI AND DOM MANIPULATION FUNCTIONS
// =================================================================================

/**
 * Gate interactive UI controls based on readiness state (settings/tokens).
 * @param {string} state - 'READY'|'MISSING_SETTINGS'|'MISSING_TOKENS'|'MISSING_BOTH'
 */
function applyControlsFor(state) {
    const $start  = $('#startSCAN');
    const $stop   = $('#stopSCAN');
    const $import = $('#uploadJSON');
    const $export = $('a[onclick="downloadTokenScannerCSV()"], #btnExportTokens');
    const $settingsIcon = $('#SettingConfig');
    const $toolIcons = $('.header-card .icon');
    const $chainLinks = $('#chain-links-container a, #chain-links-container .chain-link');
    const $sortToggles = $('.sort-toggle');

    function toggleFilterControls(enabled){
        try {
            // disable actual input elements
            $('#filter-card').find('input, button, select, textarea').prop('disabled', !enabled);
            // and neutralize pointer events on label-like chips/toggles
            $filterControls.css('pointer-events', enabled ? '' : 'none')
                           .css('opacity', enabled ? '' : '0.5');
        } catch(_) {}
    }

    function setDisabled($els, disabled) {
        $els.prop('disabled', disabled)
            .css('opacity', disabled ? '0.5' : '')
            .css('pointer-events', disabled ? 'none' : '');
    }
    function setClickableEnabled($els, enabled) {
        $els.css('opacity', enabled ? '' : '0.5')
            .css('pointer-events', enabled ? '' : 'none');
    }
    
    // lock everything by default
    // Only lock scanner-config controls; settings form remains usable even when missing
    setDisabled($('#scanner-config').find('input, select, button'), true);
    setDisabled($start.add($stop).add($export).add($import), true);
    setClickableEnabled($toolIcons.add($chainLinks), false);
    setClickableEnabled($sortToggles, false);
    toggleFilterControls(false);
    $settingsIcon.removeClass('cta-settings icon-alert-missing');

    if (state === 'READY') {
        try {
            const fr = (typeof getFeatureReadiness === 'function') ? getFeatureReadiness() : null;
            if (fr && fr.feature) {
                $('[data-feature]').each(function(){
                    const name = $(this).attr('data-feature');
                    const enabled = !!fr.feature[name];
                    setClickableEnabled($(this), enabled);
                    if (this.tagName === 'BUTTON' || this.tagName === 'INPUT') {
                        $(this).prop('disabled', !enabled);
                    }
                });
            }
        } catch(_) {}
        setDisabled($('#scanner-config').find('input, select, button'), false);
        setDisabled($start.add($stop).add($export).add($import), false);
        setClickableEnabled($toolIcons.add($chainLinks), true);
        setClickableEnabled($sortToggles, true);
        toggleFilterControls(true);
        try { $('#sync-tokens-btn').removeClass('cta-highlight'); } catch(_){ }
        try { $('#ManajemenKoin').removeClass('cta-highlight'); } catch(_){ }
        try { $('#ManajemenKoin img.icon').removeClass('icon-alert-missing'); } catch(_){ }
        try { $('#btnImportTokens, #btnExportTokens').removeClass('cta-settings cta-highlight'); } catch(_){ }
        // Ensure Update Wallet CEX is enabled when tokens exist
        try { $('#UpdateWalletCEX').css({ opacity: '', pointerEvents: '' }).prop('disabled', false); } catch(_) {}
    } else if (state === 'MISSING_SETTINGS') {
        // Inform user and gate the UI strictly per requirement
        $settingsIcon.addClass('cta-settings icon-alert-missing').attr('title','⚠️ Klik untuk membuka Pengaturan');
        $('#infoAPP').html('⚠️ Lengkapi <b>SETTING</b> terlebih dahulu. Form pengaturan dibuka otomatis.').show();
        // Disable all inputs globally then re-enable only the settings form controls
        try {
            $('input, select, textarea, button').not('#btn-scroll-top').prop('disabled', true);
            $('#form-setting-app').find('input, select, textarea, button').prop('disabled', false);
        } catch(_) {}

        // Disable all toolbar icons by default
        setClickableEnabled($toolIcons.add($chainLinks), false);
        setClickableEnabled($sortToggles, false);
        toggleFilterControls(false);

        // Enable only: assets, proxy, settings, reload, and dark mode toggle
        try {
            const allow = $('[data-feature="assets"], [data-feature="proxy"], [data-feature="settings"], [data-feature="reload"]');
            setClickableEnabled(allow, true);
            allow.find('.icon').css({ opacity: '', pointerEvents: '' });
            $('#darkModeToggle').css({ opacity: '', pointerEvents: '' });
            // Explicitly ensure #SettingConfig and #reload are not dimmed
            $('#SettingConfig, #reload').css({ opacity: '', pointerEvents: '' }).prop('disabled', false);
            // Explicitly disable Manajemen Koin menu
            $('#ManajemenKoin,#multichain_scanner').css({ opacity: '0.5', pointerEvents: 'none' }).prop('disabled', true);
        } catch(_) {}
    } else if (state === 'MISSING_TOKENS') {
        setDisabled($import, false);
        // Settings sudah ada: semua toolbar bisa diklik, kecuali Update Wallet CEX
        setClickableEnabled($toolIcons.add($chainLinks), true);
        $toolIcons.css({ opacity: '', pointerEvents: '' });
        // Tetap nonaktifkan kontrol filter karena tidak ada data
        toggleFilterControls(false);
        // Nonaktifkan sort toggle sampai ada data token
        setClickableEnabled($sortToggles, false);
        // Disable khusus tombol Update Wallet CEX sampai ada token tersimpan
        try { $('#UpdateWalletCEX').css({ opacity: '0.5', pointerEvents: 'none' }).prop('disabled', true); } catch(_) {}
        // Remove setting icon alert since settings exist
        // Info
        $('#infoAPP').html('⚠️ Tambahkan / Import / Sinkronisasi <b>DATA KOIN</b> terlebih dahulu.').show();
        try { $('#ManajemenKoin img.icon').addClass('icon-alert-missing'); } catch(_) {}
    } else {
        $('#infoAPP').html('⚠️ Lengkapi <b>SETTING</b> & <b>DATA KOIN</b> terlebih dahulu.').show();
        $settingsIcon.addClass('cta-settings').attr('title','⚠️ Klik untuk membuka Pengaturan');
        try { $('#ManajemenKoin img.icon').addClass('icon-alert-missing'); } catch(_) {}
        setClickableEnabled($toolIcons.not($settingsIcon), false);
        setClickableEnabled($settingsIcon, true);
    }
}

/** Update dark-mode icon based on current theme. */
function updateDarkIcon(isDark) {
    const icon = document.querySelector('#darkModeToggle');
    if (icon) {
        icon.setAttribute("src", isDark ?  "https://cdn-icons-png.flaticon.com/256/5262/5262027.png":"https://cdn-icons-png.flaticon.com/512/5261/5261906.png");
    }
}

/**
 * Generates and populates filter checkboxes for chains and CEXs.
 * @param {object} items - The configuration object (CONFIG_CHAINS or CONFIG_CEX).
 * @param {string} containerId - The ID of the container element.
 * @param {string} idPrefix - The prefix for checkbox IDs.
 * @param {string} labelText - The label text for the group.
 * @param {string} style - CSS classes for the label.
 * @param {string} type - 'chain' or 'cex'.
 */
// Legacy filter generator removed. Filtering UI is handled by new filter card in main.js.

/** Render signal card containers per configured DEX. */
function RenderCardSignal() {
  const dexList = (typeof window.resolveActiveDexList === 'function') ? window.resolveActiveDexList() : Object.keys(CONFIG_DEXS || {});
  const sinyalContainer = document.getElementById('sinyal-container');
  if (!sinyalContainer) return;

  // Grid dasar (tanpa child-width tetap; akan diset dinamis sesuai jumlah kartu terlihat)
  sinyalContainer.innerHTML = '';
  sinyalContainer.setAttribute('uk-grid', '');
  sinyalContainer.className = 'uk-grid uk-grid-small uk-grid-match';

  // Warna header sesuai chain
  let chainColor = '#5c9514';
  try {
    const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    if (m.type === 'single') {
      const cfg = (window.CONFIG_CHAINS || {})[m.chain] || {};
      if (cfg.WARNA) chainColor = cfg.WARNA;
    }
  } catch(_) {}

  dexList.forEach((dex, index) => {
    const gridItem = document.createElement('div');
    const dexLower = String(dex).toLowerCase();
    gridItem.id = `card-${dexLower}`;
    gridItem.dataset.dex = dexLower;
    // Sembunyikan card saat awal (belum ada sinyal)
    gridItem.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'uk-card uk-card-default uk-card-hover uk-card-small signal-card uk-margin-small-top';
    card.dataset.accentColor = chainColor;
    // border handled via CSS .signal-card; avoid inline styles

    const bodyId = `body-${dexLower}-${index}`;

    // HEADER lebih tipis
    const cardHeader = document.createElement('div');
    cardHeader.className = 'uk-card-header uk-padding-small uk-padding-remove-vertical uk-flex uk-flex-middle uk-flex-between';
    cardHeader.style.backgroundColor = chainColor;
    cardHeader.style.color = '#fff';

    const left = document.createElement('div');
    left.className = 'uk-flex uk-flex-middle';
    left.style.gap = '8px';
    left.innerHTML = `<span class="uk-text-bold" style="color:#fff!important; font-size:14px;">${String(dex).toUpperCase()}</span>`;

    const toggle = document.createElement('a');
    toggle.className = 'uk-icon-link uk-text-bolder';
    toggle.style.color = '#fff';
    toggle.setAttribute('uk-icon', 'chevron-up');
    toggle.setAttribute('uk-toggle', `target: #${bodyId}`);

    cardHeader.appendChild(left);
    cardHeader.appendChild(toggle);

    // BODY lebih ramping (tipis atas-bawah + sempit kiri-kanan)
    const cardBody = document.createElement('div');
    cardBody.className = 'uk-card-body uk-padding-small uk-padding-remove-vertical uk-card-hover';
    cardBody.style.paddingLeft = '6px';
    cardBody.style.paddingRight = '6px';
    cardBody.id = bodyId;

    // CONTAINER SINYAL: flex wrap rapat
    const signalSpan = document.createElement('div');
    signalSpan.id = `sinyal${dexLower}`;
    signalSpan.className = 'signal-card_content uk-flex uk-flex-middle uk-flex-wrap';
    signalSpan.style.gap = '2px'; // jarak antar sinyal kecil

    cardBody.appendChild(signalSpan);
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    gridItem.appendChild(card);
    sinyalContainer.appendChild(gridItem);
  });

  UIkit.update(sinyalContainer);

  // Sinkron tema + warna border sinyal saat dark mode
  try { if (typeof window.updateSignalTheme === 'function') window.updateSignalTheme(); } catch(_) {}

  // Terapkan layout grid dinamis sesuai jumlah kartu yang terlihat
  try { if (typeof window.updateSignalGridLayout === 'function') window.updateSignalGridLayout(); } catch(_) {}

  // Tambahkan placeholder info jika belum ada sinyal
  try {
    const existing = document.getElementById('no-signal-placeholder');
    if (!existing) {
      const info = document.createElement('div');
      info.id = 'no-signal-placeholder';
      info.className = 'no-signal-placeholder uk-width-1-1 uk-margin-small-top';
      info.style.display = 'none';
      info.innerHTML = `
        <div class=\"uk-card uk-card-default uk-card-hover uk-card-small signal-card\" data-accent-color=\"${chainColor}\">
          <div class=\"uk-card-header uk-padding-small uk-padding-remove-vertical\" style=\"background-color:${chainColor}; color:#fff;\">
            <div class="uk-flex uk-flex-middle uk-flex-between">
              <div class="uk-flex uk-flex-middle" style="gap:8px;">
                <span class="uk-text-bold" style="color:#fff!important; font-size:14px;">INFORMASI</span>
              </div>
            </div>
          </div>
          <div class="uk-card-body uk-padding-small uk-padding-remove-vertical uk-card-hover" style="padding-left:6px; padding-right:6px;">
            <div class="uk-text-center uk-text-bold" style="color:#e53935; font-size:13px;">MASIH BELUM ADA INFO SELISIH HARGA</div>
          </div>
        </div>`;
      sinyalContainer.insertBefore(info, sinyalContainer.firstChild);
    }
  } catch(_) {}
}

 
// Expose updater to switch theme for signal cards when dark mode toggles
window.updateSignalTheme = function() {
    try {
        // refactor: ikuti dark mode aplikasi saja (abaikan preferensi OS)
        const bodyHasDark = (typeof document !== 'undefined') &&
                            document.body &&
                            document.body.classList &&
                            document.body.classList.contains('dark-mode');
        let isDark = false;
        if (bodyHasDark) {
            isDark = true;
        } else {
            try {
                if (typeof getTheme === 'function' && String(getTheme()).toLowerCase().indexOf('dark') !== -1) {
                    isDark = true;
                } else if (typeof getDarkMode === 'function' && !!getDarkMode()) {
                    isDark = true;
                } else if (typeof window !== 'undefined' && typeof window.isDarkMode === 'function' && window.isDarkMode()) {
                    isDark = true;
                }
            } catch(_) {}
        }

        let chainColor = '#5c9514';
        const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
        if (m.type === 'single') {
            const cfg = (window.CONFIG_CHAINS || {})[m.chain] || {};
            if (cfg.WARNA) chainColor = cfg.WARNA;
        }
        const container = document.getElementById('sinyal-container');
        if (!container) return;
        const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
        const headerTextColor = isDark ? '#f3f4f6' : '#ffffff';
        const signalTextColor = isDark ? '#e7e7ec' : '#000000';
        const applyHeaderTheme = (header, accent) => {
            if (!header) return;
            const useAccent = accent || chainColor;
            header.style.backgroundColor = useAccent;
            header.style.color = headerTextColor;
            header.style.borderBottomColor = borderColor;
        };

        const cards = container.querySelectorAll('.signal-card');
        cards.forEach(card => {
            const accent = card.dataset.accentColor || chainColor;
            applyHeaderTheme(card.querySelector('.uk-card-header'), accent);
            const span = card.querySelector('[id^="sinyal"]');
            if (span) span.style.color = signalTextColor;
        });

        const placeholderCard = container.querySelector('#no-signal-placeholder .signal-card');
        if (placeholderCard) {
            const accent = placeholderCard.dataset.accentColor || chainColor;
            applyHeaderTheme(placeholderCard.querySelector('.uk-card-header'), accent);
        }
    } catch(_) {}
};

/** Hitung dan set kelas grid child-width berdasarkan jumlah card yang terlihat. */
window.updateSignalGridLayout = function() {
  try {
    const container = document.getElementById('sinyal-container');
    if (!container) return;
    const cardItems = Array.from(container.querySelectorAll('div[id^="card-"]'));
    const visibleItems = cardItems.filter(el => el && el.style.display !== 'none');
    const n = Math.max(visibleItems.length, 1);

    // Reset kelas child-width lama
    container.className = 'uk-grid uk-grid-small uk-grid-match';

    // Tambah kelas child-width sesuai jumlah terlihat (1..12 aman untuk UIkit)
    const maxCols = Math.min(n, 12);
    container.classList.add(`uk-child-width-1-${maxCols}`);

    // Toggle placeholder info
    const placeholder = document.getElementById('no-signal-placeholder');
    if (placeholder) {
      placeholder.style.display = (visibleItems.length === 0) ? '' : 'none';
    }

    // Update UIkit layout
    if (window.UIkit && typeof UIkit.update === 'function') UIkit.update(container);
  } catch(_) {}
};

/** Tampilkan card sinyal untuk DEX tertentu (dipanggil saat ada sinyal). */
window.showSignalCard = function(dexLower) {
  try {
    const el = document.getElementById(`card-${String(dexLower).toLowerCase()}`);
    if (!el) return;
    el.style.display = '';
    window.updateSignalGridLayout && window.updateSignalGridLayout();
  } catch(_) {}
};

/** Sembunyikan semua card yang kontennya kosong; panggil di awal scan. */
window.hideEmptySignalCards = function() {
  try {
    const container = document.getElementById('sinyal-container');
    if (!container) return;
    const spans = container.querySelectorAll('[id^="sinyal"]');
    spans.forEach(sp => {
      const wrap = sp.closest('div[id^="card-"]');
      if (!wrap) return;
      if (!sp.children || sp.children.length === 0) {
        wrap.style.display = 'none';
      }
    });
    window.updateSignalGridLayout && window.updateSignalGridLayout();
  } catch(_) {}
};

/**
 * Clear all rendered signal contents and hide empty cards.
 * Use this when filters change so previous scan results are removed.
 */
window.clearSignalCards = function() {
  try {
    const container = document.getElementById('sinyal-container');
    if (!container) return;
    const spans = container.querySelectorAll('[id^="sinyal"]');
    spans.forEach(sp => { try { sp.innerHTML = ''; } catch(_){} });
    if (typeof window.hideEmptySignalCards === 'function') window.hideEmptySignalCards();
  } catch(_) {}
};

/** Open and populate the 'Edit Koin' modal by token id. */
function openEditModalById(id) {
    const m = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
    const tokens = (m.type === 'single') ? getFromLocalStorage(`TOKEN_${String(m.chain).toUpperCase()}`, [])
                                         : getFromLocalStorage('TOKEN_MULTICHAIN', []);
    const token = (Array.isArray(tokens) ? tokens : []).find(t => String(t.id) === String(id));
    if (!token) {
        // refactor: use toast helper
        if (typeof toast !== 'undefined' && toast.error) toast.error('Data token tidak ditemukan');
        return;
    }

    $('#multiTokenIndex').val(token.id);
    $('#inputSymbolToken').val(token.symbol_in || '');
    $('#inputDesToken').val(token.des_in ?? '');
    $('#inputSCToken').val(token.sc_in || '');
    $('#inputSymbolPair').val(token.symbol_out || '');
    $('#inputDesPair').val(token.des_out ?? '');
    $('#inputSCPair').val(token.sc_out || '');

    setStatusRadios(!!token.status);

    const $ctx = $('#FormEditKoinModal');
    const $sel = $ctx.find('#mgrChain');
    populateChainSelect($sel, token.chain);
    // Enforce chain select behavior by mode and apply modal theme
    try {
        const isRunning = $('#stopSCAN').is(':visible');
        if (m.type === 'single') {
            const c = String(m.chain).toLowerCase();
            $sel.val(c);
            if (isRunning) {
                // During per-chain scan: keep inputs editable per request
                $sel.prop('disabled', false).attr('title', '');
            } else {
                $sel.prop('disabled', true).attr('title', 'Per-chain mode: Chain terkunci');
            }
            applyEditModalTheme(c);
            // Show copy-to-multichain button in per-chain mode
            $('#CopyToMultiBtn').show();
        } else {
            $sel.prop('disabled', false).attr('title', '');
            applyEditModalTheme(null); // multi-mode theme
            // Hide copy-to-multichain in multi mode
            $('#CopyToMultiBtn').hide();
        }
    } catch(_) {}
    
    try { buildCexCheckboxForKoin(token); } catch (e) { /* debug logs removed */ }
    try { buildDexCheckboxForKoin(token); } catch (e) { /* debug logs removed */ }

    $sel.off('change.rebuildDex').on('change.rebuildDex', function(){
        const newChain = $(this).val();
        try { buildDexCheckboxForKoin({ ...token, chain: newChain }); } catch (_) {}
        try { applyEditModalTheme(String(newChain).toLowerCase()); } catch(_){}
    });

    if (window.UIkit && UIkit.modal) {
        UIkit.modal('#FormEditKoinModal').show();
    }

    // Ensure requested button visibility while scanning per-chain
    try {
        const m2 = (typeof getAppMode === 'function') ? getAppMode() : { type: 'multi' };
        const running = $('#stopSCAN').is(':visible');
        if (String(m2.type).toLowerCase() === 'single' && running) {
            $('#HapusEditkoin, #SaveEditkoin').hide().prop('disabled', true);
            $('#CopyToMultiBtn, #BatalEditkoin').show().prop('disabled', false);
        }
    } catch(_) {}
}

/** Apply themed colors to Edit Koin modal based on active chain. */
function applyEditModalTheme(chainKey) {
    const accent = (chainKey && window.CONFIG_CHAINS && window.CONFIG_CHAINS[chainKey] && window.CONFIG_CHAINS[chainKey].WARNA)
        ? window.CONFIG_CHAINS[chainKey].WARNA
        : '#5c9514';
    const $modal = $('#FormEditKoinModal');
    // Accent borders and header
    $modal.find('.uk-modal-dialog').css('border-top', `3px solid ${accent}`);
    $modal.find('#judulmodal').css({ background: accent, color: '#fff', borderRadius: '4px' });
    $modal.find('.uk-card.uk-card-default').css('border-color', accent);

    // Reset previous text colors first (avoid stacking)
    $modal.find('.uk-form-label').css('color', '');
    $modal.find('#dex-checkbox-koin label').css('color', '');
    $modal.find('.uk-text-bold').not('#cex-checkbox-koin *').css('color', '');

    // Apply accent text color across modal except CEX data area
    $modal.find('.uk-form-label').css('color', accent);
    $modal.find('#dex-checkbox-koin label').css('color', accent);
    $modal.find('.uk-text-bold').not('#cex-checkbox-koin *').css('color', accent);
}

/** Populate a <select> element with chain options from CONFIG_CHAINS. */
function populateChainSelect($select, selectedKey) {
  const cfg = window.CONFIG_CHAINS || {};
  const keys = Object.keys(cfg);

  $select.empty();
  if (!keys.length) {
    $select.append('<option value="">-- PILIHAN CHAIN --</option>');
    return;
  }

  keys.sort().forEach(k => {
    const item  = cfg[k] || {};
    const label = (item.Nama_Chain || item.nama_chain || item.name || k).toString().toUpperCase();
    $select.append(`<option value="${k.toLowerCase()}">${label}</option>`);
  });

  const want = String(selectedKey || '').toLowerCase();
  const lowerKeys = keys.map(k => k.toLowerCase());
  $select.val(lowerKeys.includes(want) ? want : lowerKeys[0]);
}

/** Set ON/OFF radio status in edit modal. */
function setStatusRadios(isOn) {
    $('#mgrStatusOn').prop('checked', !!isOn);
    $('#mgrStatusOff').prop('checked', !isOn);
}

/** Read ON/OFF radio status in edit modal. */
function readStatusRadio() {
    return ($('input[name="mgrStatus"]:checked').val() === 'on');
}

/** Build CEX selection checkboxes for edit modal. */
function buildCexCheckboxForKoin(token) {
    const container = $('#cex-checkbox-koin');
    container.empty();
    const selected = (token.selectedCexs || []).map(s => String(s).toUpperCase());
    Object.keys(CONFIG_CEX || {}).forEach(cexKey => {
        const upper = String(cexKey).toUpperCase();
        const isChecked = selected.includes(upper);
        const color = (CONFIG_CEX[upper] && CONFIG_CEX[upper].WARNA) || '#000';
        const id = `cex-${upper}`;
        container.append(`<label class="uk-display-block uk-margin-xsmall"><input type="checkbox" class="uk-checkbox" id="${id}" value="${upper}" ${isChecked ? 'checked' : ''}> <span style="color:${color}; font-weight:bold;">${upper}</span></label>`);
    });
}

/** Build DEX selection checkboxes and capital inputs for edit modal. */
function buildDexCheckboxForKoin(token = {}) {
    const container = $('#dex-checkbox-koin');
    container.empty();
    const chainName = token.chain || '';
    const chainCfg = CONFIG_CHAINS?.[String(chainName).toLowerCase()] || CONFIG_CHAINS?.[chainName] || {};
    const allowedDexs = Array.isArray(chainCfg.DEXS) ? chainCfg.DEXS : Object.keys(chainCfg.DEXS || {});

    if (!allowedDexs.length) {
        container.html('<div class="uk-text-meta">Tidak ada DEX terdefinisi untuk chain ini di CONFIG_CHAINS.</div>');
        return;
    }

    const selectedDexs = (token.selectedDexs || []).map(d => String(d).toLowerCase());
    const dataDexs = token.dataDexs || {};

    allowedDexs.forEach(dexNameRaw => {
        const dexName = String(dexNameRaw);
        const dexKeyLower = dexName.toLowerCase();
        const isChecked = selectedDexs.includes(dexKeyLower) || selectedDexs.includes(dexName);
        const stored = dataDexs[dexName] || dataDexs[dexKeyLower] || {};
        const leftVal  = stored.left  ?? 0;
        const rightVal = stored.right ?? 0;
        const safeId = dexKeyLower.replace(/[^a-z0-9_-]/gi, '');
        // Use lowercase canonical key as value for consistency
        container.append(`<div class="uk-flex uk-flex-middle uk-margin-small"><label class="uk-margin-small-right"><input type="checkbox" class="uk-checkbox dex-edit-checkbox" id="dex-${safeId}" value="${dexKeyLower}" ${isChecked ? 'checked' : ''}> <b>${dexName.toUpperCase()}</b></label><div class="uk-flex uk-flex-middle" style="gap:6px;"><input type="number" class="uk-input uk-form-xxsmall dex-left" id="dex-${safeId}-left" placeholder="KIRI" value="${leftVal}" style="width:88px;"><input type="number" class="uk-input uk-form-xxsmall dex-right" id="dex-${safeId}-right" placeholder="KANAN" value="${rightVal}" style="width:88px;"></div></div>`);
    });

    // Removed 4-DEX selection cap: no checkbox limit handler
}

/** Disable all form inputs globally. */
function form_off() {
    $('input, select, textarea, button').not('#btn-scroll-top').prop('disabled', true);
    // Whitelist critical controls to remain interactive during scanning
    try {
        // refactor: dark mode toggle juga ikut nonaktif saat scan
        $('#stopSCAN, #reload, #autoScrollCheckbox, #toggleScanLog').prop('disabled', false);
    } catch(_) {}
}

/** Enable primary inputs (except textareas) globally. */
function form_on() {
    $('input, select, button').prop('disabled', false);
}

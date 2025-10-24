// =================================================================================
// TAB MANAGER - Multi-Tab Isolation System
// =================================================================================
/**
 * Sistem untuk mengelola multiple tab scanner secara independen
 * Setiap tab memiliki:
 * - Unique Tab ID (dibuat saat pertama load)
 * - Isolated scanning state
 * - Communication channel dengan tab lain via BroadcastChannel
 */

(function() {
    'use strict';

    // Generate unique tab ID menggunakan timestamp + random
    function generateTabId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        return `TAB_${timestamp}_${random}`;
    }

    // Get or create tab ID (stored in sessionStorage - unique per tab)
    function getTabId() {
        try {
            let tabId = sessionStorage.getItem('APP_TAB_ID');
            if (!tabId) {
                tabId = generateTabId();
                sessionStorage.setItem('APP_TAB_ID', tabId);
                console.log(`[TAB MANAGER] New tab initialized: ${tabId}`);
            }
            return tabId;
        } catch(e) {
            console.error('[TAB MANAGER] Error getting tab ID:', e);
            return generateTabId(); // fallback
        }
    }

    // Tab Manager Class
    class TabManager {
        constructor() {
            this.tabId = getTabId();
            this.channel = null;
            this.otherTabs = new Map(); // Map of other active tabs
            this.scanningState = null;
            this.heartbeatInterval = null;
            this.lastHeartbeat = Date.now();

            this.initBroadcastChannel();
            this.initHeartbeat();
            this.initVisibilityHandler();
            this.announcePresence();

            console.log(`[TAB MANAGER] Initialized for tab: ${this.tabId}`);
        }

        // Initialize BroadcastChannel for inter-tab communication
        initBroadcastChannel() {
            try {
                if (typeof BroadcastChannel === 'undefined') {
                    console.warn('[TAB MANAGER] BroadcastChannel not supported, using fallback');
                    this.initStorageFallback();
                    return;
                }

                this.channel = new BroadcastChannel('multiplus_scanner_tabs');

                this.channel.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.channel.onerror = (error) => {
                    console.error('[TAB MANAGER] BroadcastChannel error:', error);
                };

                console.log('[TAB MANAGER] BroadcastChannel initialized');
            } catch(e) {
                console.error('[TAB MANAGER] Failed to init BroadcastChannel:', e);
                this.initStorageFallback();
            }
        }

        // Fallback untuk browser yang tidak support BroadcastChannel
        initStorageFallback() {
            console.log('[TAB MANAGER] Using localStorage fallback for inter-tab communication');

            window.addEventListener('storage', (e) => {
                if (e.key === 'TAB_MESSAGE' && e.newValue) {
                    try {
                        const message = JSON.parse(e.newValue);
                        if (message.fromTab !== this.tabId) {
                            this.handleMessage(message);
                        }
                    } catch(err) {
                        console.error('[TAB MANAGER] Error parsing storage message:', err);
                    }
                }
            });
        }

        // Handle messages from other tabs
        handleMessage(data) {
            if (!data || data.fromTab === this.tabId) return;

            const { type, fromTab, payload } = data;

            switch(type) {
                case 'HEARTBEAT':
                    this.updateTabPresence(fromTab, payload);
                    break;

                case 'SCAN_START':
                    this.onOtherTabScanStart(fromTab, payload);
                    break;

                case 'SCAN_STOP':
                    this.onOtherTabScanStop(fromTab, payload);
                    break;

                case 'ANNOUNCE':
                    this.updateTabPresence(fromTab, payload);
                    // Reply dengan own presence
                    this.sendHeartbeat();
                    break;

                case 'TAB_CLOSING':
                    this.removeTab(fromTab);
                    break;

                default:
                    console.log(`[TAB MANAGER] Unknown message type: ${type}`);
            }
        }

        // Broadcast message to all other tabs
        broadcast(type, payload = {}) {
            const message = {
                type,
                fromTab: this.tabId,
                timestamp: Date.now(),
                payload
            };

            try {
                if (this.channel) {
                    this.channel.postMessage(message);
                } else {
                    // Fallback to localStorage
                    localStorage.setItem('TAB_MESSAGE', JSON.stringify(message));
                    // Clear immediately to allow multiple messages
                    setTimeout(() => {
                        try {
                            const current = localStorage.getItem('TAB_MESSAGE');
                            if (current === JSON.stringify(message)) {
                                localStorage.removeItem('TAB_MESSAGE');
                            }
                        } catch(e) {}
                    }, 100);
                }
            } catch(e) {
                console.error('[TAB MANAGER] Error broadcasting:', e);
            }
        }

        // Announce this tab's presence to other tabs
        announcePresence() {
            const state = this.getTabState();
            this.broadcast('ANNOUNCE', state);
        }

        // Send heartbeat to keep tab alive in other tabs' registry
        sendHeartbeat() {
            const state = this.getTabState();
            this.broadcast('HEARTBEAT', state);
            this.lastHeartbeat = Date.now();
        }

        // Initialize periodic heartbeat
        initHeartbeat() {
            // Send heartbeat every 5 seconds
            this.heartbeatInterval = setInterval(() => {
                this.sendHeartbeat();
                this.cleanupDeadTabs();
            }, 5000);

            // Initial heartbeat
            this.sendHeartbeat();
        }

        // Get current tab state
        getTabState() {
            return {
                tabId: this.tabId,
                isScanning: this.isScanning(),
                chainLabel: this.getCurrentChainLabel(),
                timestamp: Date.now(),
                url: window.location.href
            };
        }

        // Check if this tab is currently scanning
        isScanning() {
            try {
                // Check scanner running state
                if (typeof window.App !== 'undefined' &&
                    window.App.Scanner &&
                    typeof window.App.Scanner.isScanRunning === 'function') {
                    return window.App.Scanner.isScanRunning();
                }
                return false;
            } catch(e) {
                return false;
            }
        }

        // Get current chain label
        getCurrentChainLabel() {
            try {
                const mode = typeof getAppMode === 'function' ? getAppMode() : { type: 'multi' };
                if (mode.type === 'single') {
                    return mode.chain ? mode.chain.toUpperCase() : 'UNKNOWN';
                }
                return 'MULTICHAIN';
            } catch(e) {
                return 'UNKNOWN';
            }
        }

        // Update presence info for another tab
        updateTabPresence(tabId, state) {
            this.otherTabs.set(tabId, {
                ...state,
                lastSeen: Date.now()
            });

            // Update UI indicator if function exists
            this.updateMultiTabIndicator();
        }

        // Remove tab from registry
        removeTab(tabId) {
            this.otherTabs.delete(tabId);
            console.log(`[TAB MANAGER] Removed tab: ${tabId}`);
            this.updateMultiTabIndicator();
        }

        // Clean up tabs that haven't sent heartbeat in 15 seconds
        cleanupDeadTabs() {
            const now = Date.now();
            const timeout = 25000; // 15 seconds

            for (const [tabId, info] of this.otherTabs.entries()) {
                if (now - info.lastSeen > timeout) {
                    console.log(`[TAB MANAGER] Tab timeout: ${tabId}`);
                    this.removeTab(tabId);
                }
            }
        }

        // Handler when other tab starts scanning
        onOtherTabScanStart(tabId, payload) {
            console.log(`[TAB MANAGER] Tab ${tabId} started scanning: ${payload.chainLabel}`);
            this.updateTabPresence(tabId, { ...payload, isScanning: true });
        }

        // Handler when other tab stops scanning
        onOtherTabScanStop(tabId, payload) {
            console.log(`[TAB MANAGER] Tab ${tabId} stopped scanning`);
            this.updateTabPresence(tabId, { ...payload, isScanning: false });
        }

        // Notify other tabs that this tab started scanning
        notifyScanStart(chainLabel) {
            this.scanningState = {
                isScanning: true,
                chainLabel,
                startTime: Date.now()
            };

            this.broadcast('SCAN_START', {
                chainLabel,
                timestamp: Date.now()
            });

            this.updateMultiTabIndicator();
        }

        // Notify other tabs that this tab stopped scanning
        notifyScanStop() {
            this.scanningState = {
                isScanning: false,
                chainLabel: null,
                stopTime: Date.now()
            };

            this.broadcast('SCAN_STOP', {
                timestamp: Date.now()
            });

            this.updateMultiTabIndicator();
        }

        // Get list of all active tabs
        getActiveTabs() {
            const tabs = [{
                tabId: this.tabId,
                isCurrent: true,
                ...this.getTabState()
            }];

            for (const [tabId, info] of this.otherTabs.entries()) {
                tabs.push({
                    tabId,
                    isCurrent: false,
                    ...info
                });
            }

            return tabs;
        }

        // Get tabs that are currently scanning
        getScanningTabs() {
            return this.getActiveTabs().filter(tab => tab.isScanning);
        }

        // Update multi-tab indicator in UI
        updateMultiTabIndicator() {
            try {
                const activeTabs = this.getActiveTabs();
                const scanningTabs = this.getScanningTabs();

                // Update badge/indicator
                let badge = document.getElementById('multi-tab-indicator');
                if (!badge) {
                    // Create indicator if doesn't exist
                    badge = document.createElement('span');
                    badge.id = 'multi-tab-indicator';
                    badge.style.cssText = 'position:fixed; top:10px; right:10px; z-index:9999; background:#1e87f0; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;';
                    document.body.appendChild(badge);
                }

                // Show tab count
                if (activeTabs.length > 1) {
                    badge.style.display = 'block';
                    badge.innerHTML = `${activeTabs.length} TABS` +
                        (scanningTabs.length > 0 ? ` (${scanningTabs.length} SCANNING)` : '');
                    badge.title = activeTabs.map(t =>
                        `${t.isCurrent ? '▶ ' : ''}Tab: ${t.chainLabel || 'Unknown'}${t.isScanning ? ' [SCANNING]' : ''}`
                    ).join('\n');
                } else {
                    badge.style.display = 'none';
                }

                // Update info banner dengan daftar chain yang sedang di-scan
                this.updateChainScanningBanner(scanningTabs);

            } catch(e) {
                console.error('[TAB MANAGER] Error updating indicator:', e);
            }
        }

        // Update banner showing which chains are scanning
        updateChainScanningBanner(scanningTabs) {
            try {
                const infoEl = document.getElementById('infoAPP');
                if (!infoEl) return;

                if (scanningTabs.length === 0) {
                    // No tabs scanning - clear or show default
                    const readiness = typeof computeAppReadiness === 'function' ? computeAppReadiness() : 'UNKNOWN';
                    if (readiness !== 'READY') {
                        // Keep the warning message if not ready
                        return;
                    }
                    infoEl.innerHTML = '';
                    infoEl.style.display = 'none';
                    return;
                }

                // Group by chain
                const chainLabels = [...new Set(scanningTabs.map(t => t.chainLabel))];
                const currentTabScanning = scanningTabs.find(t => t.isCurrent);

                let html = 'RUN SCANNING: ';

                if (currentTabScanning) {
                    html += `<span style="color:#e53935;font-weight:bold;">${chainLabels.join(' | ')}</span>`;
                } else {
                    html += chainLabels.join(' | ');
                }

                // Show other tabs count with better alignment
                if (scanningTabs.length > 1) {
                    html += ` <span style="font-size:11px;vertical-align:middle;opacity:0.85;">(${scanningTabs.length} tabs)</span>`;
                }

                infoEl.innerHTML = html;
                infoEl.style.display = 'block';

            } catch(e) {
                console.error('[TAB MANAGER] Error updating banner:', e);
            }
        }

        // Handle page visibility change
        initVisibilityHandler() {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    // Tab became visible - send heartbeat
                    this.sendHeartbeat();
                    // Request other tabs to announce themselves
                    this.announcePresence();
                }
            });
        }

        // Cleanup when tab is closing
        destroy() {
            console.log(`[TAB MANAGER] Destroying tab: ${this.tabId}`);

            // Notify other tabs
            this.broadcast('TAB_CLOSING', {});

            // Clear heartbeat
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }

            // Close channel
            if (this.channel) {
                try {
                    this.channel.close();
                } catch(e) {
                    console.error('[TAB MANAGER] Error closing channel:', e);
                }
            }

            // Clear session data
            try {
                sessionStorage.removeItem('APP_TAB_ID');
            } catch(e) {}
        }

        // Get tab-specific storage key
        getTabStorageKey(key) {
            return `${this.tabId}_${key}`;
        }

        // Save tab-specific data to sessionStorage
        saveTabData(key, value) {
            try {
                const tabKey = this.getTabStorageKey(key);
                sessionStorage.setItem(tabKey, JSON.stringify(value));
            } catch(e) {
                console.error('[TAB MANAGER] Error saving tab data:', e);
            }
        }

        // Load tab-specific data from sessionStorage
        loadTabData(key, defaultValue = null) {
            try {
                const tabKey = this.getTabStorageKey(key);
                const data = sessionStorage.getItem(tabKey);
                return data ? JSON.parse(data) : defaultValue;
            } catch(e) {
                console.error('[TAB MANAGER] Error loading tab data:', e);
                return defaultValue;
            }
        }

        // Clear tab-specific data
        clearTabData(key) {
            try {
                const tabKey = this.getTabStorageKey(key);
                sessionStorage.removeItem(tabKey);
            } catch(e) {
                console.error('[TAB MANAGER] Error clearing tab data:', e);
            }
        }
    }

    // Initialize global tab manager instance
    window.TabManager = new TabManager();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.TabManager) {
            window.TabManager.destroy();
        }
    });

    // Expose helper functions
    window.getTabId = function() {
        return window.TabManager ? window.TabManager.tabId : null;
    };

    window.isTabScanning = function() {
        return window.TabManager ? window.TabManager.isScanning() : false;
    };

    window.getActiveTabsInfo = function() {
        return window.TabManager ? window.TabManager.getActiveTabs() : [];
    };

    console.log('[TAB MANAGER] Module loaded');

})();

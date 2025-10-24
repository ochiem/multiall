// =================================================================================
// OVERLAY MANAGER - Unified Overlay System
// =================================================================================
/**
 * Sistem overlay terpusat untuk semua loading/progress indicator
 * Menggantikan: #pageLoadingOverlay, #loadingOverlay, #sync-overlay, #wallet-fetch-overlay
 *
 * Usage:
 * - AppOverlay.show({ title: 'Loading...', message: 'Please wait' })
 * - AppOverlay.showProgress({ title: 'Processing', max: 100 })
 * - AppOverlay.updateProgress('overlay-id', 50, 100, 'Step 2 of 3')
 * - AppOverlay.hide('overlay-id')
 */

(function(global) {
    'use strict';

    class OverlayManager {
        constructor() {
            this.overlays = new Map();
            this.currentOverlay = null;
            this.initialized = false;
            this.bodyFreezed = false;
            this.originalBodyStyle = '';
            this.init();
        }

        /**
         * Initialize overlay manager
         */
        init() {
            if (this.initialized) return;

            // Add CSS styles
            this.addStyles();

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                this.hideAll();
            });

            this.initialized = true;
            console.log('[OVERLAY MANAGER] Initialized');
        }

        /**
         * Freeze body (disable all clicks/interactions)
         */
        freezeBody() {
            if (this.bodyFreezed) return;

            this.originalBodyStyle = document.body.style.pointerEvents || '';
            document.body.style.pointerEvents = 'none';
            this.bodyFreezed = true;

            console.log('[OVERLAY MANAGER] Body frozen - screen locked');
        }

        /**
         * Unfreeze body (restore interactions)
         */
        unfreezeBody() {
            if (!this.bodyFreezed) return;

            document.body.style.pointerEvents = this.originalBodyStyle;
            this.bodyFreezed = false;

            console.log('[OVERLAY MANAGER] Body unfrozen - screen unlocked');
        }

        /**
         * Add unified CSS styles
         */
        addStyles() {
            const styleId = 'overlay-manager-styles';
            if (document.getElementById(styleId)) return;

            const css = `
                /* ==========================================================================
                   APP OVERLAY - Unified Overlay System
                   Colors: Consistent with config.js
                   Fonts: Standardized sizes
                   Behavior: Complete screen freeze when active
                   ========================================================================== */
                .app-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease-in-out;
                    pointer-events: auto;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }

                .app-overlay.hiding {
                    animation: fadeOut 0.3s ease-in-out;
                }

                .app-overlay-content {
                    background: #ffffff;
                    padding: 32px;
                    border-radius: 12px;
                    max-width: 520px;
                    width: 90%;
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
                    max-height: 80vh;
                    overflow-y: auto;
                    pointer-events: auto;
                }

                .app-overlay-title {
                    margin: 0 0 12px 0;
                    font-size: 20px;
                    font-weight: 600;
                    text-align: center;
                    color: #2c3e50;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    line-height: 1.4;
                }

                .app-overlay-message {
                    margin: 12px 0;
                    text-align: center;
                    color: #7f8c8d;
                    font-size: 15px;
                    line-height: 1.5;
                }

                .app-overlay-progress {
                    margin-top: 20px;
                }

                .app-overlay-counter {
                    margin-top: 10px;
                    text-align: center;
                    font-size: 14px;
                    color: #7f8c8d;
                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', monospace;
                    font-weight: 500;
                }

                .app-overlay-items {
                    margin-top: 20px;
                    max-height: 320px;
                    overflow-y: auto;
                }

                .app-overlay-item {
                    padding: 12px 14px;
                    margin-bottom: 10px;
                    border-left: 4px solid #95a5a6;
                    background: #f8f9fa;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .app-overlay-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                }

                .app-overlay-item-name {
                    font-weight: 600;
                    color: #2c3e50;
                    font-size: 14px;
                }

                .app-overlay-item-status {
                    font-size: 11px;
                    padding: 3px 8px;
                    border-radius: 4px;
                    background: #95a5a6;
                    color: white;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .app-overlay-item-status.waiting {
                    background: #95a5a6;
                }

                .app-overlay-item-status.fetching {
                    background: #3498db;
                }

                .app-overlay-item-status.processing {
                    background: #f39c12;
                }

                .app-overlay-item-status.success {
                    background: #27ae60;
                }

                .app-overlay-item-status.error {
                    background: #e74c3c;
                }

                .app-overlay-item-text {
                    color: #7f8c8d;
                    font-size: 13px;
                    line-height: 1.4;
                }

                .app-overlay-spinner {
                    display: inline-block;
                }

                /* Responsive adjustments */
                @media (max-width: 768px) {
                    .app-overlay-content {
                        padding: 24px;
                        width: 95%;
                    }

                    .app-overlay-title {
                        font-size: 18px;
                    }

                    .app-overlay-message {
                        font-size: 14px;
                    }

                    .app-overlay-item {
                        font-size: 13px;
                        padding: 10px 12px;
                    }
                }
            `;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
        }

        /**
         * Show simple overlay
         */
        show(options = {}) {
            const defaults = {
                id: 'app-overlay-' + Date.now(),
                title: 'Processing...',
                message: '',
                spinner: true,
                backdrop: 'rgba(0, 0, 0, 0.85)',
                blur: true,
                freezeScreen: true
            };

            const config = { ...defaults, ...options };

            // Remove existing overlay with same ID
            this.hide(config.id);

            // Freeze screen to prevent user interaction
            if (config.freezeScreen) {
                this.freezeBody();
            }

            // Create overlay
            const overlay = this.createOverlay(config);
            document.body.appendChild(overlay);
            this.overlays.set(config.id, { element: overlay, config });
            this.currentOverlay = config.id;

            return config.id;
        }

        /**
         * Show overlay with progress bar
         */
        showProgress(options = {}) {
            const defaults = {
                id: 'app-overlay-progress-' + Date.now(),
                title: 'Processing...',
                message: '',
                spinner: true,
                progress: true,
                progressValue: 0,
                progressMax: 100
            };

            return this.show({ ...defaults, ...options });
        }

        /**
         * Show overlay with item list (for CEX-style progress)
         */
        showItems(options = {}) {
            const defaults = {
                id: 'app-overlay-items-' + Date.now(),
                title: 'Processing...',
                message: '',
                items: [] // Array of { name, status, text }
            };

            return this.show({ ...defaults, ...options });
        }

        /**
         * Create overlay DOM element
         */
        createOverlay(config) {
            const div = document.createElement('div');
            div.id = config.id;
            div.className = 'app-overlay';

            if (config.backdrop) {
                div.style.background = config.backdrop;
            }

            if (!config.blur) {
                div.style.backdropFilter = 'none';
            }

            const content = document.createElement('div');
            content.className = 'app-overlay-content';

            // Title
            const title = document.createElement('h3');
            title.className = 'app-overlay-title';

            if (config.spinner) {
                const spinner = document.createElement('span');
                spinner.className = 'app-overlay-spinner';
                spinner.setAttribute('uk-spinner', 'ratio: 0.8');
                title.appendChild(spinner);
            }

            const titleText = document.createTextNode(config.title);
            title.appendChild(titleText);
            content.appendChild(title);

            // Message
            if (config.message) {
                const msg = document.createElement('p');
                msg.className = 'app-overlay-message';
                msg.textContent = config.message;
                content.appendChild(msg);
            }

            // Progress bar
            if (config.progress) {
                const progressDiv = document.createElement('div');
                progressDiv.className = 'app-overlay-progress';

                const progress = document.createElement('progress');
                progress.className = 'uk-progress';
                progress.value = config.progressValue || 0;
                progress.max = config.progressMax || 100;
                progressDiv.appendChild(progress);

                const counter = document.createElement('div');
                counter.className = 'app-overlay-counter';
                counter.textContent = `${config.progressValue || 0} / ${config.progressMax || 100} (0%)`;
                progressDiv.appendChild(counter);

                content.appendChild(progressDiv);
            }

            // Items list
            if (config.items && config.items.length > 0) {
                const itemsDiv = document.createElement('div');
                itemsDiv.className = 'app-overlay-items';

                config.items.forEach(item => {
                    const itemEl = this.createItemElement(item);
                    itemsDiv.appendChild(itemEl);
                });

                content.appendChild(itemsDiv);
            }

            div.appendChild(content);
            return div;
        }

        /**
         * Create item element
         */
        createItemElement(item) {
            const div = document.createElement('div');
            div.className = 'app-overlay-item';
            div.setAttribute('data-item-name', item.name);

            const header = document.createElement('div');
            header.className = 'app-overlay-item-header';

            const name = document.createElement('span');
            name.className = 'app-overlay-item-name';
            name.textContent = item.name;

            const status = document.createElement('span');
            status.className = `app-overlay-item-status ${(item.status || 'waiting').toLowerCase()}`;
            status.textContent = (item.status || 'WAITING').toUpperCase();

            header.appendChild(name);
            header.appendChild(status);
            div.appendChild(header);

            if (item.text) {
                const text = document.createElement('div');
                text.className = 'app-overlay-item-text';
                text.textContent = item.text;
                div.appendChild(text);
            }

            return div;
        }

        /**
         * Update progress
         */
        updateProgress(id, current, total, message = '') {
            const overlay = this.overlays.get(id);
            if (!overlay) return;

            const element = overlay.element;
            const progress = element.querySelector('progress');
            const counter = element.querySelector('.app-overlay-counter');
            const msg = element.querySelector('.app-overlay-message');

            if (progress) {
                progress.value = current;
                progress.max = total;
            }

            if (counter) {
                const percent = total > 0 ? Math.round((current / total) * 100) : 0;
                counter.textContent = `${current} / ${total} (${percent}%)`;
            }

            if (msg && message) {
                msg.textContent = message;
            }
        }

        /**
         * Update specific item in list
         */
        updateItem(id, itemName, status, text = '') {
            const overlay = this.overlays.get(id);
            if (!overlay) return;

            const element = overlay.element;
            const item = element.querySelector(`[data-item-name="${itemName}"]`);

            if (item) {
                const statusEl = item.querySelector('.app-overlay-item-status');
                if (statusEl) {
                    // Remove old status class
                    statusEl.className = 'app-overlay-item-status';
                    // Add new status class
                    statusEl.classList.add(status.toLowerCase());
                    statusEl.textContent = status.toUpperCase();
                }

                // Update border color
                const colors = {
                    waiting: '#999',
                    fetching: '#1e87f0',
                    processing: '#faa05a',
                    success: '#32d296',
                    error: '#f0506e'
                };
                item.style.borderLeftColor = colors[status.toLowerCase()] || '#999';

                // Update text
                const textEl = item.querySelector('.app-overlay-item-text');
                if (textEl) {
                    textEl.textContent = text;
                } else if (text) {
                    const newTextEl = document.createElement('div');
                    newTextEl.className = 'app-overlay-item-text';
                    newTextEl.textContent = text;
                    item.appendChild(newTextEl);
                }
            }
        }

        /**
         * Update message
         */
        updateMessage(id, message) {
            const overlay = this.overlays.get(id);
            if (!overlay) return;

            const element = overlay.element;
            const msg = element.querySelector('.app-overlay-message');

            if (msg) {
                msg.textContent = message;
            } else {
                const newMsg = document.createElement('p');
                newMsg.className = 'app-overlay-message';
                newMsg.textContent = message;
                const content = element.querySelector('.app-overlay-content');
                const title = content.querySelector('.app-overlay-title');
                title.after(newMsg);
            }
        }

        /**
         * Hide overlay
         */
        hide(id) {
            const overlay = this.overlays.get(id);
            if (!overlay) return;

            const element = overlay.element;
            element.classList.add('hiding');

            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.overlays.delete(id);

                if (this.currentOverlay === id) {
                    this.currentOverlay = null;
                }

                // Unfreeze body when no more overlays are visible
                if (this.overlays.size === 0) {
                    this.unfreezeBody();
                }
            }, 300); // Match animation duration
        }

        /**
         * Hide all overlays
         */
        hideAll() {
            this.overlays.forEach((overlay, id) => {
                this.hide(id);
            });
        }

        /**
         * Get overlay by ID
         */
        get(id) {
            return this.overlays.get(id);
        }

        /**
         * Check if overlay exists
         */
        has(id) {
            return this.overlays.has(id);
        }

        /**
         * Get current overlay ID
         */
        getCurrent() {
            return this.currentOverlay;
        }
    }

    // Create global instance
    const instance = new OverlayManager();

    // Export to window
    if (typeof global !== 'undefined') {
        global.AppOverlay = instance;
        global.OverlayManager = OverlayManager;
    }

    console.log('[OVERLAY MANAGER] Module loaded');

})(typeof window !== 'undefined' ? window : this);

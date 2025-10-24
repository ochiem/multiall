// =================================================================================
// EVENT BUS - Global Event System
// =================================================================================
/**
 * Event Bus untuk state management tanpa reload
 * Menggantikan location.reload() dengan event-driven updates
 *
 * Usage:
 * - AppEvents.on('data:restored', (data) => { ... })
 * - AppEvents.emit('data:restored', { tokens: [...] })
 * - AppEvents.off('data:restored', handler)
 * - AppEvents.once('scan:complete', (data) => { ... })
 */

(function(global) {
    'use strict';

    class EventBus {
        constructor() {
            this.listeners = new Map();
            this.history = [];
            this.maxHistory = 50;
            this.debugMode = false;

            console.log('[EVENT BUS] Initialized');
        }

        /**
         * Register event listener
         */
        on(event, callback, options = {}) {
            if (typeof callback !== 'function') {
                console.error('[EVENT BUS] Callback must be a function');
                return;
            }

            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }

            const listener = {
                callback,
                once: options.once || false,
                priority: options.priority || 0,
                id: this.generateListenerId()
            };

            this.listeners.get(event).push(listener);

            // Sort by priority (higher priority first)
            this.listeners.get(event).sort((a, b) => b.priority - a.priority);

            if (this.debugMode) {
                console.log(`[EVENT BUS] Registered listener for "${event}" (${listener.id})`);
            }

            return listener.id;
        }

        /**
         * Register one-time event listener
         */
        once(event, callback, options = {}) {
            return this.on(event, callback, { ...options, once: true });
        }

        /**
         * Remove event listener
         */
        off(event, callbackOrId) {
            if (!this.listeners.has(event)) return;

            const listeners = this.listeners.get(event);

            if (typeof callbackOrId === 'function') {
                // Remove by callback reference
                const index = listeners.findIndex(l => l.callback === callbackOrId);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            } else if (typeof callbackOrId === 'string') {
                // Remove by ID
                const index = listeners.findIndex(l => l.id === callbackOrId);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            } else {
                // Remove all listeners for this event
                this.listeners.delete(event);
            }

            if (this.debugMode) {
                console.log(`[EVENT BUS] Removed listener for "${event}"`);
            }
        }

        /**
         * Emit event
         */
        emit(event, data = {}) {
            // Add to history
            this.addToHistory({
                event,
                data,
                timestamp: Date.now()
            });

            if (this.debugMode) {
                console.log(`[EVENT BUS] Emitting "${event}"`, data);
            }

            if (!this.listeners.has(event)) {
                if (this.debugMode) {
                    console.log(`[EVENT BUS] No listeners for "${event}"`);
                }
                return;
            }

            const listeners = this.listeners.get(event).slice(); // Clone to avoid mutation during iteration
            const toRemove = [];

            listeners.forEach(listener => {
                try {
                    listener.callback(data);

                    // Remove if it's a one-time listener
                    if (listener.once) {
                        toRemove.push(listener);
                    }
                } catch (error) {
                    console.error(`[EVENT BUS] Error in listener for "${event}":`, error);
                }
            });

            // Remove one-time listeners
            if (toRemove.length > 0) {
                const remaining = this.listeners.get(event).filter(l => !toRemove.includes(l));
                this.listeners.set(event, remaining);
            }
        }

        /**
         * Emit event asynchronously
         */
        async emitAsync(event, data = {}) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.emit(event, data);
                    resolve();
                }, 0);
            });
        }

        /**
         * Wait for event (returns promise)
         */
        waitFor(event, timeout = 30000) {
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.off(event, listenerId);
                    reject(new Error(`Timeout waiting for event "${event}"`));
                }, timeout);

                const listenerId = this.once(event, (data) => {
                    clearTimeout(timeoutId);
                    resolve(data);
                });
            });
        }

        /**
         * Get all listeners for an event
         */
        getListeners(event) {
            return this.listeners.get(event) || [];
        }

        /**
         * Get all registered events
         */
        getEvents() {
            return Array.from(this.listeners.keys());
        }

        /**
         * Clear all listeners for an event
         */
        clear(event) {
            if (event) {
                this.listeners.delete(event);
            } else {
                this.listeners.clear();
            }
        }

        /**
         * Clear all listeners
         */
        clearAll() {
            this.listeners.clear();
            if (this.debugMode) {
                console.log('[EVENT BUS] Cleared all listeners');
            }
        }

        /**
         * Get event history
         */
        getHistory(limit = 10) {
            return this.history.slice(-limit);
        }

        /**
         * Clear event history
         */
        clearHistory() {
            this.history = [];
        }

        /**
         * Add to event history
         */
        addToHistory(event) {
            this.history.push(event);

            // Keep only last N events
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }
        }

        /**
         * Generate unique listener ID
         */
        generateListenerId() {
            return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * Enable debug mode
         */
        enableDebug() {
            this.debugMode = true;
            console.log('[EVENT BUS] Debug mode enabled');
        }

        /**
         * Disable debug mode
         */
        disableDebug() {
            this.debugMode = false;
            console.log('[EVENT BUS] Debug mode disabled');
        }

        /**
         * Get statistics
         */
        getStats() {
            const stats = {
                totalEvents: this.listeners.size,
                totalListeners: 0,
                events: {}
            };

            this.listeners.forEach((listeners, event) => {
                stats.totalListeners += listeners.length;
                stats.events[event] = listeners.length;
            });

            return stats;
        }

        /**
         * Print statistics
         */
        printStats() {
            const stats = this.getStats();
            console.log('[EVENT BUS] Statistics:', stats);
            return stats;
        }
    }

    // Create global instance
    const instance = new EventBus();

    // Export to window
    if (typeof global !== 'undefined') {
        global.AppEvents = instance;
        global.EventBus = EventBus;
    }

    // Pre-define common events for better autocomplete
    instance.EVENTS = {
        // Data events
        DATA_RESTORED: 'data:restored',
        DATA_BACKUP: 'data:backup',
        DATA_IMPORT: 'data:import',
        DATA_EXPORT: 'data:export',
        DATA_CLEAR: 'data:clear',

        // Scan events
        SCAN_START: 'scan:start',
        SCAN_STOP: 'scan:stop',
        SCAN_PAUSE: 'scan:pause',
        SCAN_RESUME: 'scan:resume',
        SCAN_COMPLETE: 'scan:complete',
        SCAN_ERROR: 'scan:error',

        // Token events
        TOKEN_ADD: 'token:add',
        TOKEN_UPDATE: 'token:update',
        TOKEN_DELETE: 'token:delete',
        TOKEN_SYNC: 'token:sync',

        // Wallet events
        WALLET_UPDATE: 'wallet:update',
        WALLET_REFRESH: 'wallet:refresh',
        WALLET_ERROR: 'wallet:error',

        // CEX events
        CEX_FETCH_START: 'cex:fetch:start',
        CEX_FETCH_COMPLETE: 'cex:fetch:complete',
        CEX_FETCH_ERROR: 'cex:fetch:error',

        // UI events
        UI_SECTION_SHOW: 'ui:section:show',
        UI_SECTION_HIDE: 'ui:section:hide',
        UI_MODAL_OPEN: 'ui:modal:open',
        UI_MODAL_CLOSE: 'ui:modal:close',

        // Filter events
        FILTER_CHANGE: 'filter:change',
        FILTER_RESET: 'filter:reset',

        // Chain events
        CHAIN_SWITCH: 'chain:switch',
        CHAIN_MODE_CHANGE: 'chain:mode:change'
    };

    console.log('[EVENT BUS] Module loaded');

})(typeof window !== 'undefined' ? window : this);

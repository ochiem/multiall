// =================================================================================
// RPC MANAGER - Simplified RPC Getter from SETTING_SCANNER
// =================================================================================
// Purpose: Provide centralized access to user-configured RPC endpoints
//
// New Architecture:
// - RPCs are stored in SETTING_SCANNER.userRPCs (1 per chain)
// - No migration logic, no fallback system
// - Simple getter function for all application parts
//
// =================================================================================

(function() {
    'use strict';

    // ====================
    // MAIN RPC GETTER
    // ====================

    /**
     * Get RPC URL for a specific chain (with automatic fallback to defaults)
     * @param {string} chainKey - Chain identifier (e.g., 'bsc', 'polygon', 'ethereum')
     * @returns {string|null} RPC URL or null if not found
     */
    function getRPC(chainKey) {
        try {
            // Normalize chain key to lowercase
            const chainLower = String(chainKey || '').toLowerCase();

            if (!chainLower) {
                console.error('[RPC Manager] Chain key is required');
                return null;
            }

            // Get settings from storage
            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            // Try to get user-configured RPC first
            if (settings.userRPCs && typeof settings.userRPCs === 'object') {
                const userRpc = settings.userRPCs[chainLower];
                if (userRpc) {
                    return userRpc;
                }
            }

            // AUTO FALLBACK: Try to get from database migrator (initial values)
            if (typeof window !== 'undefined' && window.RPCDatabaseMigrator) {
                const initialRPC = window.RPCDatabaseMigrator.getRPCFromDatabase(chainLower);
                if (initialRPC) {
                    // Only show warning once per session to avoid spam
                    if (!getRPC._warnedChains) getRPC._warnedChains = new Set();
                    if (!getRPC._warnedChains.has(chainLower)) {
                        console.warn(`[RPC Manager] Using initial RPC for ${chainKey} (not yet saved in database)`);
                        getRPC._warnedChains.add(chainLower);
                    }
                    return initialRPC;
                }
            }

            // No RPC available at all
            console.error(`[RPC Manager] No RPC available for chain: ${chainKey}`);
            console.error(`[RPC Manager] Please configure RPC in Settings or ensure rpc-database-migrator.js is loaded`);
            return null;

        } catch (error) {
            console.error('[RPC Manager] Error getting RPC:', error);
            return null;
        }
    }

    /**
     * Get all configured RPCs
     * @returns {Object} Map of chainKey -> RPC URL
     */
    function getAllRPCs() {
        try {
            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            return settings.userRPCs || {};
        } catch (error) {
            console.error('[RPC Manager] Error getting all RPCs:', error);
            return {};
        }
    }

    /**
     * Check if RPC is configured for a chain
     * @param {string} chainKey - Chain identifier
     * @returns {boolean}
     */
    function hasRPC(chainKey) {
        const rpc = getRPC(chainKey);
        return rpc !== null && rpc !== '';
    }

    /**
     * Get RPC with fallback to default suggestion
     * @param {string} chainKey - Chain identifier
     * @returns {string|null}
     */
    function getRPCWithFallback(chainKey) {
        const rpc = getRPC(chainKey);

        if (rpc) {
            return rpc;
        }

        // Fallback to database migrator initial values
        if (typeof window !== 'undefined' && window.RPCDatabaseMigrator) {
            const chainLower = String(chainKey || '').toLowerCase();
            const initialRPC = window.RPCDatabaseMigrator.getRPCFromDatabase(chainLower);
            if (initialRPC) {
                console.warn(`[RPC Manager] Using initial RPC for ${chainKey} (not configured in settings)`);
                return initialRPC;
            }
        }

        return null;
    }

    // ====================
    // EXPORT PUBLIC API
    // ====================

    const RPCManager = {
        getRPC,
        getAllRPCs,
        hasRPC,
        getRPCWithFallback
    };

    // Expose to window
    if (typeof window !== 'undefined') {
        window.RPCManager = RPCManager;
    }

    console.log('[RPC Manager] ✅ Simplified RPC Manager initialized');

})();

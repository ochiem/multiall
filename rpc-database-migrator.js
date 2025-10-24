// =================================================================================
// RPC DATABASE MIGRATOR - Auto-migrate RPC to Database
// =================================================================================
// Purpose: Automatically migrate default RPC suggestions to database
//
// Architecture:
// - Check if RPC already exists in database
// - If not, initialize with default values
// - Provide UI for user to update RPC endpoints
// - All RPC stored centrally in SETTING_SCANNER.userRPCs
// =================================================================================

(function() {
    'use strict';

    // Default RPC values (only used for initial setup, not as fallback)
    const INITIAL_RPC_VALUES = {
        bsc: 'https://binance.llamarpc.com',
        polygon: 'https://polygon-pokt.nodies.app',
        ethereum: 'https://eth.llamarpc.com',
        arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
        base: 'https://base.llamarpc.com'
    };

    /**
     * Initialize RPC in database if not exists
     * This runs once on app startup
     */
    async function initializeRPCDatabase() {
        try {
            console.log('[RPC Migrator] 🔄 Checking RPC database...');

            // Get current settings
            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            // Check if userRPCs already exists
            if (settings.userRPCs && typeof settings.userRPCs === 'object') {
                const existingChains = Object.keys(settings.userRPCs);
                console.log(`[RPC Migrator] ✅ RPC database already initialized with ${existingChains.length} chains:`, existingChains);

                // Check if all chains have RPC
                const allChains = Object.keys(INITIAL_RPC_VALUES);
                const missingChains = allChains.filter(chain => !settings.userRPCs[chain]);

                if (missingChains.length > 0) {
                    console.log(`[RPC Migrator] ⚠️ Found ${missingChains.length} chains without RPC, adding defaults:`, missingChains);

                    // Add missing chains
                    missingChains.forEach(chain => {
                        settings.userRPCs[chain] = INITIAL_RPC_VALUES[chain];
                    });

                    // Save to database
                    if (typeof saveToLocalStorage === 'function') {
                        saveToLocalStorage('SETTING_SCANNER', settings);
                        console.log('[RPC Migrator] ✅ Missing chains added to database');
                    }
                }

                return true;
            }

            // No userRPCs exists, initialize with defaults
            console.log('[RPC Migrator] 📦 Initializing RPC database with default values...');

            settings.userRPCs = { ...INITIAL_RPC_VALUES };

            // Save to database
            if (typeof saveToLocalStorage === 'function') {
                saveToLocalStorage('SETTING_SCANNER', settings);
                console.log('[RPC Migrator] ✅ RPC database initialized successfully');
                console.log('[RPC Migrator] 📊 Initialized chains:', Object.keys(settings.userRPCs));
            } else {
                console.error('[RPC Migrator] ❌ saveToLocalStorage not available');
                return false;
            }

            return true;

        } catch (error) {
            console.error('[RPC Migrator] ❌ Error initializing RPC database:', error);
            return false;
        }
    }

    /**
     * Get RPC for a specific chain from database
     * @param {string} chainKey - Chain identifier
     * @returns {string|null} RPC URL or null
     */
    function getRPCFromDatabase(chainKey) {
        try {
            const chainLower = String(chainKey || '').toLowerCase();

            if (!chainLower) {
                console.error('[RPC Migrator] Chain key is required');
                return null;
            }

            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            if (settings.userRPCs && settings.userRPCs[chainLower]) {
                return settings.userRPCs[chainLower];
            }

            // If not found in database, return initial value (for first-time setup)
            if (INITIAL_RPC_VALUES[chainLower]) {
                console.warn(`[RPC Migrator] RPC not in database for ${chainKey}, using initial value`);
                return INITIAL_RPC_VALUES[chainLower];
            }

            console.error(`[RPC Migrator] No RPC available for chain: ${chainKey}`);
            return null;

        } catch (error) {
            console.error('[RPC Migrator] Error getting RPC from database:', error);
            return null;
        }
    }

    /**
     * Update RPC for a specific chain
     * @param {string} chainKey - Chain identifier
     * @param {string} rpcUrl - New RPC URL
     * @returns {boolean} Success status
     */
    function updateRPCInDatabase(chainKey, rpcUrl) {
        try {
            const chainLower = String(chainKey || '').toLowerCase();
            const url = String(rpcUrl || '').trim();

            if (!chainLower) {
                console.error('[RPC Migrator] Chain key is required');
                return false;
            }

            if (!url) {
                console.error('[RPC Migrator] RPC URL is required');
                return false;
            }

            // Validate URL format
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                console.error('[RPC Migrator] Invalid RPC URL format (must start with http:// or https://)');
                return false;
            }

            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            if (!settings.userRPCs) {
                settings.userRPCs = {};
            }

            settings.userRPCs[chainLower] = url;

            if (typeof saveToLocalStorage === 'function') {
                saveToLocalStorage('SETTING_SCANNER', settings);
                console.log(`[RPC Migrator] ✅ RPC updated for ${chainKey}: ${url}`);
                return true;
            } else {
                console.error('[RPC Migrator] saveToLocalStorage not available');
                return false;
            }

        } catch (error) {
            console.error('[RPC Migrator] Error updating RPC:', error);
            return false;
        }
    }

    /**
     * Get all RPCs from database
     * @returns {Object} Map of chainKey -> RPC URL
     */
    function getAllRPCsFromDatabase() {
        try {
            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            return settings.userRPCs || {};
        } catch (error) {
            console.error('[RPC Migrator] Error getting all RPCs:', error);
            return {};
        }
    }

    /**
     * Reset RPC to initial value
     * @param {string} chainKey - Chain identifier
     * @returns {boolean} Success status
     */
    function resetRPCToDefault(chainKey) {
        const chainLower = String(chainKey || '').toLowerCase();

        if (!INITIAL_RPC_VALUES[chainLower]) {
            console.error(`[RPC Migrator] No initial value for chain: ${chainKey}`);
            return false;
        }

        return updateRPCInDatabase(chainLower, INITIAL_RPC_VALUES[chainLower]);
    }

    // ====================
    // EXPORT PUBLIC API
    // ====================

    const RPCDatabaseMigrator = {
        initializeRPCDatabase,
        getRPCFromDatabase,
        updateRPCInDatabase,
        getAllRPCsFromDatabase,
        resetRPCToDefault,
        INITIAL_RPC_VALUES // expose for reference only
    };

    // Expose to window
    if (typeof window !== 'undefined') {
        window.RPCDatabaseMigrator = RPCDatabaseMigrator;
    }

    // Auto-initialize on script load (with delay to ensure storage.js is loaded)
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                initializeRPCDatabase();
            }, 500); // Small delay to ensure storage.js is ready
        });
    }

    console.log('[RPC Database Migrator] ✅ Module initialized');

})();

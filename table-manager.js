// =================================================================================
// TABLE MANAGER - Standardized Table Component
// =================================================================================
/**
 * Unified table system untuk konsistensi styling
 * Standardisasi semua tabel kecuali tabel scanning
 *
 * Usage:
 * - TableManager.create({ columns: [...], data: [...] })
 * - TableManager.update('table-id', newData)
 * - TableManager.addRow('table-id', rowData)
 * - TableManager.removeRow('table-id', rowIndex)
 */

(function(global) {
    'use strict';

    class TableManager {
        constructor() {
            this.tables = new Map();
            this.initialized = false;
            this.init();
        }

        /**
         * Initialize table manager
         */
        init() {
            if (this.initialized) return;

            // Add CSS styles
            this.addStyles();

            this.initialized = true;
            console.log('[TABLE MANAGER] Initialized');
        }

        /**
         * Add unified CSS styles
         */
        addStyles() {
            const styleId = 'table-manager-styles';
            if (document.getElementById(styleId)) return;

            const css = `
                /* Standardized table container */
                .app-table-container {
                    width: 100%;
                    overflow-x: auto;
                    margin: 0;
                }

                /* Standardized table */
                .app-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                /* Standard table variations */
                .app-table.small {
                    font-size: 0.875rem;
                }

                .app-table.hover tbody tr:hover {
                    background: #f8f8f8;
                }

                .app-table.striped tbody tr:nth-child(odd) {
                    background: #fafafa;
                }

                .app-table.divider tbody tr {
                    border-bottom: 1px solid #e5e5e5;
                }

                .app-table thead {
                    background: #f8f8f8;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .app-table thead th {
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 2px solid #e5e5e5;
                    white-space: nowrap;
                }

                .app-table tbody td {
                    padding: 10px 8px;
                    color: #666;
                    vertical-align: middle;
                }

                .app-table tbody tr:last-child td {
                    border-bottom: none;
                }

                /* Cell alignment */
                .app-table .text-left {
                    text-align: left;
                }

                .app-table .text-center {
                    text-align: center;
                }

                .app-table .text-right {
                    text-align: right;
                }

                /* Cell emphasis */
                .app-table .text-bold {
                    font-weight: 600;
                }

                .app-table .text-muted {
                    color: #999;
                }

                .app-table .text-small {
                    font-size: 0.85em;
                }

                /* Status badges */
                .app-table .status-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .app-table .status-badge.success {
                    background: #32d296;
                    color: white;
                }

                .app-table .status-badge.warning {
                    background: #faa05a;
                    color: white;
                }

                .app-table .status-badge.danger {
                    background: #f0506e;
                    color: white;
                }

                .app-table .status-badge.info {
                    background: #1e87f0;
                    color: white;
                }

                .app-table .status-badge.default {
                    background: #999;
                    color: white;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .app-table {
                        font-size: 0.85rem;
                    }

                    .app-table thead th,
                    .app-table tbody td {
                        padding: 8px 6px;
                    }
                }

                /* Empty state */
                .app-table-empty {
                    text-align: center;
                    padding: 40px 20px;
                    color: #999;
                    font-size: 14px;
                }

                .app-table-empty-icon {
                    font-size: 48px;
                    margin-bottom: 10px;
                    opacity: 0.3;
                }
            `;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
        }

        /**
         * Create standardized table
         */
        create(options = {}) {
            const defaults = {
                id: 'app-table-' + Date.now(),
                columns: [],
                data: [],
                small: true,
                hover: true,
                striped: false,
                divider: true,
                responsive: true,
                stickyHeader: true,
                emptyMessage: 'Tidak ada data',
                emptyIcon: '📊'
            };

            const config = { ...defaults, ...options };

            // Validate
            if (!config.columns || config.columns.length === 0) {
                console.error('[TABLE MANAGER] Columns are required');
                return '';
            }

            // Store config
            this.tables.set(config.id, config);

            // Generate HTML
            return this.generateTableHTML(config);
        }

        /**
         * Generate table HTML
         */
        generateTableHTML(config) {
            const classes = [
                'app-table',
                config.small ? 'small' : '',
                config.hover ? 'hover' : '',
                config.striped ? 'striped' : '',
                config.divider ? 'divider' : ''
            ].filter(Boolean).join(' ');

            let html = '';

            // Container
            if (config.responsive) {
                html += '<div class="app-table-container">';
            }

            // Table
            html += `<table id="${config.id}" class="${classes}">`;

            // Header
            html += '<thead><tr>';
            config.columns.forEach(col => {
                const width = col.width ? `style="width:${col.width}"` : '';
                const align = col.align ? `class="text-${col.align}"` : '';
                html += `<th ${width} ${align}>${col.label}</th>`;
            });
            html += '</tr></thead>';

            // Body
            html += '<tbody>';

            if (config.data && config.data.length > 0) {
                config.data.forEach((row, index) => {
                    html += this.generateRowHTML(row, config.columns, index);
                });
            } else {
                // Empty state
                html += `<tr><td colspan="${config.columns.length}" class="app-table-empty">`;
                if (config.emptyIcon) {
                    html += `<div class="app-table-empty-icon">${config.emptyIcon}</div>`;
                }
                html += `<div>${config.emptyMessage}</div>`;
                html += '</td></tr>';
            }

            html += '</tbody>';
            html += '</table>';

            if (config.responsive) {
                html += '</div>';
            }

            return html;
        }

        /**
         * Generate row HTML
         */
        generateRowHTML(row, columns, index) {
            let html = '<tr>';

            columns.forEach(col => {
                const value = this.getNestedValue(row, col.key);
                const formatted = col.format ? col.format(value, row, index) : this.formatValue(value);
                const align = col.align ? `class="text-${col.align}"` : '';

                html += `<td ${align}>${formatted}</td>`;
            });

            html += '</tr>';
            return html;
        }

        /**
         * Get nested value from object (supports dot notation)
         */
        getNestedValue(obj, path) {
            if (typeof path !== 'string') return '';

            return path.split('.').reduce((current, prop) => {
                return current && current[prop] !== undefined ? current[prop] : '';
            }, obj);
        }

        /**
         * Format value
         */
        formatValue(value) {
            if (value === null || value === undefined) return '-';
            if (typeof value === 'boolean') return value ? 'Yes' : 'No';
            return String(value);
        }

        /**
         * Update table data
         */
        update(id, newData) {
            const config = this.tables.get(id);
            if (!config) {
                console.error(`[TABLE MANAGER] Table "${id}" not found`);
                return;
            }

            config.data = newData;
            const html = this.generateTableHTML(config);

            const container = document.getElementById(id);
            if (container && container.parentNode) {
                container.parentNode.innerHTML = html;
            }
        }

        /**
         * Add row to table
         */
        addRow(id, rowData) {
            const config = this.tables.get(id);
            if (!config) {
                console.error(`[TABLE MANAGER] Table "${id}" not found`);
                return;
            }

            config.data.push(rowData);

            const table = document.getElementById(id);
            if (table) {
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    const rowHTML = this.generateRowHTML(rowData, config.columns, config.data.length - 1);
                    tbody.insertAdjacentHTML('beforeend', rowHTML);
                }
            }
        }

        /**
         * Remove row from table
         */
        removeRow(id, rowIndex) {
            const config = this.tables.get(id);
            if (!config) {
                console.error(`[TABLE MANAGER] Table "${id}" not found`);
                return;
            }

            config.data.splice(rowIndex, 1);

            const table = document.getElementById(id);
            if (table) {
                const tbody = table.querySelector('tbody');
                if (tbody && tbody.rows[rowIndex]) {
                    tbody.deleteRow(rowIndex);
                }
            }
        }

        /**
         * Clear table
         */
        clear(id) {
            this.update(id, []);
        }

        /**
         * Get table config
         */
        getConfig(id) {
            return this.tables.get(id);
        }

        /**
         * Remove table
         */
        remove(id) {
            this.tables.delete(id);
        }

        /**
         * Helper: Create status badge
         */
        static createStatusBadge(status, type = 'default') {
            return `<span class="status-badge ${type}">${status}</span>`;
        }

        /**
         * Helper: Create link
         */
        static createLink(text, url, target = '_blank') {
            return `<a href="${url}" target="${target}" rel="noopener">${text}</a>`;
        }

        /**
         * Helper: Truncate text
         */
        static truncate(text, maxLength = 20) {
            if (!text || text.length <= maxLength) return text;
            return text.substring(0, maxLength) + '...';
        }

        /**
         * Helper: Format number
         */
        static formatNumber(num, decimals = 2) {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return Number(num).toFixed(decimals);
        }

        /**
         * Helper: Format currency
         */
        static formatCurrency(num, decimals = 2) {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return '$' + Number(num).toFixed(decimals);
        }

        /**
         * Helper: Format address (shorten)
         */
        static formatAddress(address) {
            if (!address || address.length < 12) return address;
            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        }
    }

    // Create global instance
    const instance = new TableManager();

    // Export to window
    if (typeof global !== 'undefined') {
        global.TableManager = instance;
        global.TableManagerClass = TableManager;
    }

    console.log('[TABLE MANAGER] Module loaded');

})(typeof window !== 'undefined' ? window : this);

frappe.pages['prd-pipeline'].on_page_load = function(wrapper) {

    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Sales Intelligence Hub',
        single_column: true
    });
    
    frappe.sales_intelligence = new EnhancedSalesIntelligence(wrapper, page);
}

class EnhancedSalesIntelligence {
    constructor(wrapper, page) {
        this.wrapper = wrapper;
        this.page = page;
       // In the constructor, replace the pipelines object:
this.data = {
    quotations: [],
    cancelled_quotations: [],
    filtered: [],
    stats: {},
    metadata: {},
    pipelines: {
        'A': { 
            min: 90, 
            max: 100, 
            quotes: [], 
            value: 0, 
            workflow_states: ['Pipeline A'] // Updated to match actual workflow state
        },
        'B': { 
            min: 50, 
            max: 75, 
            quotes: [], 
            value: 0, 
            workflow_states: ['Pipeline B'] // Updated to match actual workflow state
        },
        'C': { 
            min: 0, 
            max: 50, 
            quotes: [], 
            value: 0, 
            workflow_states: ['Pipeline C'] // Updated to match actual workflow state
        },
        'None': { quotes: [], value: 0 }
    }
};
        this.filters = {
            from_date: frappe.datetime.add_days(frappe.datetime.get_today(), -30),
            to_date: frappe.datetime.get_today(),
            status: 'all',
            company: 'PRASTARA DECORATION DESIGN L.L.C',
            branch: '',
            account_incharge: '',
            sales_team: '',
            created_by: '',
            customer: null,
            amount_min: null,
            amount_max: null,
            margin_min: null,
            margin_max: null,
            quotation_to: ['Customer', 'Lead'],
            search_query: '',
            items: [],
            workflow_state: []
        };
        this.currentSection = 'overview';
        this.viewMode = 'grid';
        this.charts = {};
        this.itemImages = new Map();
        this.sortState = {}; // Track sort state for tables
        
        this.init();
    }

    async init() {
        this.loadFontAwesome();
        this.injectStyles();
        this.setupPage();
        this.bindEvents();
        this.setupCategoryFilter(); // Initialize category filter
        this.detectCurrentPreset(); // Check if current date range matches a preset
        await this.loadData();
        await this.renderCurrentSection();
    }

    loadFontAwesome() {
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const fontAwesome = document.createElement('link');
            fontAwesome.rel = 'stylesheet';
            fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            fontAwesome.onload = () => {
                console.log('FontAwesome loaded successfully');
            };
            fontAwesome.onerror = (e) => {
                console.error('Failed to load FontAwesome:', e);
            };
            document.head.appendChild(fontAwesome);
        }
    }

    injectStyles() {
        const styles = `
            <style id="enhanced-sales-dashboard-styles">
                :root {
    --primary-bg: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    --secondary-bg: #1e293b;
    --card-bg: rgba(30, 41, 59, 0.95);
    --sidebar-bg: rgba(15, 23, 42, 0.98);
    --border-color: rgba(148, 163, 184, 0.15);
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    --accent-blue: #3b82f6;
    --accent-green: #10b981;
    --accent-orange: #f59e0b;
    --accent-red: #ef4444;
    --accent-purple: #8b5cf6;
    --accent-cyan: #06b6d4;
    --shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    --shadow-hover: 0 20px 40px rgba(0, 0, 0, 0.3);
    --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.1);
    --modal-overlay: rgba(0, 0, 0, 0.8);
    --gradient-primary: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    --gradient-success: linear-gradient(135deg, var(--accent-green), #059669);
    --gradient-warning: linear-gradient(135deg, var(--accent-orange), #d97706);
    --gradient-danger: linear-gradient(135deg, var(--accent-red), #dc2626);
    --border-radius: 16px;
    --border-radius-sm: 8px;
    --border-radius-lg: 24px;
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-fast: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
                * {
                    box-sizing: border-box;
                }

            .sales-dashboard-container {
    display: flex;
    min-height: calc(100vh - 60px);
    margin-top: 0px;
    background: var(--primary-bg);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    position: relative;
}

@media (max-width: 1024px) {
    .sales-dashboard-container {
        flex-direction: column;
        margin-top: 50px;
        min-height: calc(100vh - 50px);
    }
}

/* Typography Scale */
.text-xs { font-size: 0.75rem; line-height: 1.2; }
.text-sm { font-size: 0.875rem; line-height: 1.3; }
.text-base { font-size: 1rem; line-height: 1.5; }
.text-lg { font-size: 1.125rem; line-height: 1.4; }
.text-xl { font-size: 1.25rem; line-height: 1.3; }
.text-2xl { font-size: 1.5rem; line-height: 1.2; }
.text-3xl { font-size: 1.875rem; line-height: 1.1; }

.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }

.tracking-wide { letter-spacing: 0.025em; }
.tracking-wider { letter-spacing: 0.05em; }
                /* Enhanced Modal Styles */
                .modal-backdrop {
                    background-color: var(--modal-overlay) !important;
                    backdrop-filter: blur(8px);
                }

                .modal-dialog {
                    margin: 1rem auto;
                    max-width: 90vw;
                    padding: 0 1rem;
                }

                .modal-dialog.modal-xl {
                    max-width: 95vw;
                }

                @media (max-width: 768px) {
                    .modal-dialog {
                        margin: 0.5rem auto;
                        max-width: 95vw;
                        padding: 0 0.5rem;
                    }
                }

         .modal-backdrop {
    background-color: var(--modal-overlay) !important;
    backdrop-filter: blur(12px);
    animation: modalBackdropFadeIn 0.3s ease-out;
}

@keyframes modalBackdropFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-dialog {
    margin: 1rem auto;
    max-width: 90vw;
    padding: 0 1rem;
    animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (max-width: 768px) {
    .modal-dialog {
        margin: 0.5rem auto;
        max-width: 95vw;
        padding: 0 0.5rem;
    }
}

@keyframes modalSlideIn {
    from { 
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to { 
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-dialog.modal-xl {
    max-width: 95vw;
}

.modal-content {
    background: rgba(30, 41, 59, 0.98) !important;
    backdrop-filter: blur(30px);
    border: 1px solid rgba(148, 163, 184, 0.2) !important;
    color: var(--text-primary) !important;
    border-radius: var(--border-radius-lg) !important;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6) !important;
    overflow: hidden;
}

.modal-header {
    border-bottom: 1px solid rgba(148, 163, 184, 0.15) !important;
    padding: 2rem 2.5rem 1.5rem !important;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(30, 41, 59, 0.3));
    position: relative;
}

.modal-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--gradient-primary);
}

.modal-title {
    color: var(--text-primary) !important;
    font-size: 1.5rem !important;
    font-weight: 700 !important;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0 !important;
}

.modal-title i {
    color: var(--accent-blue);
    font-size: 1.25rem;
    width: 24px;
    text-align: center;
}

.modal-body {
    padding: 2.5rem !important;
    max-height: 75vh;
    overflow-y: auto;
    background: rgba(15, 23, 42, 0.05);
}

.modal-footer {
    border-top: 1px solid rgba(148, 163, 184, 0.15) !important;
    padding: 1.5rem 2.5rem 2rem !important;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(30, 41, 59, 0.3));
    display: flex;
    align-items: center;
    gap: 1rem;
}

.modal-body::-webkit-scrollbar {
    width: 8px;
}

.modal-body::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.1);
    border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb {
    background: var(--gradient-primary);
    border-radius: 4px;
}

.modal-section {
    background: rgba(51, 65, 85, 0.3);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--border-radius);
    padding: 2rem;
    margin-bottom: 2rem;
    position: relative;
    overflow: hidden;
}

.modal-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--gradient-primary);
    opacity: 0.7;
}

.modal-section h6 {
    color: var(--accent-blue) !important;
    font-weight: 700;
    margin-bottom: 1.5rem;
    font-size: 1.125rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.modal-section h6 i {
    color: var(--accent-blue);
    font-size: 1rem;
}

.close {
    color: var(--text-primary) !important;
    opacity: 0.7 !important;
    font-size: 1.5rem !important;
    border: none !important;
    background: none !important;
    cursor: pointer !important;
    transition: var(--transition) !important;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}

.close:hover {
    opacity: 1 !important;
    background: rgba(239, 68, 68, 0.1) !important;
    color: var(--accent-red) !important;
}

                .modal-header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
                }

                .modal-title {
                    color: var(--text-primary) !important;
                    font-size: 1.5rem !important;
                    font-weight: 700 !important;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 0 !important;
                }

                .modal-title i {
                    color: var(--accent-blue);
                    font-size: 1.25rem;
                    width: 24px;
                    text-align: center;
                }

                .modal-body {
                    padding: 2.5rem !important;
                    max-height: 75vh;
                    overflow-y: auto;
                    background: rgba(15, 23, 42, 0.1);
                }

                .modal-footer {
                    border-top: 1px solid rgba(148, 163, 184, 0.2) !important;
                    padding: 1.5rem 2.5rem 2rem !important;
                    background: linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(30, 41, 59, 0.3));
                }

                .modal-body::-webkit-scrollbar {
                    width: 8px;
                }

                .modal-body::-webkit-scrollbar-track {
                    background: rgba(148, 163, 184, 0.1);
                    border-radius: 4px;
                }

                .modal-body::-webkit-scrollbar-thumb {
                    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                    border-radius: 4px;
                }

                .modal-section {
                    background: rgba(51, 65, 85, 0.4);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 16px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    position: relative;
                    overflow: hidden;
                }

                .modal-section::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, var(--accent-blue), transparent);
                }

                .modal-section h6 {
                    color: var(--accent-blue) !important;
                    font-weight: 700;
                    margin-bottom: 1.5rem;
                    font-size: 1.125rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .modal-section h6 i {
                    color: var(--accent-blue);
                    font-size: 1rem;
                }

                /* Enhanced Table Controls */
                .table-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    gap: 1rem;
                    flex-wrap: wrap;
                    background: rgba(51, 65, 85, 0.3);
                    padding: 1rem 1.5rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                }

                .table-controls-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex: 1;
                    min-width: 200px;
                }

                .table-controls-right {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .pagination-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .pagination-controls .page-info {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0 0.5rem;
                    min-width: 60px;
                    text-align: center;
                }
                
                .pagination-controls button {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                    border-radius: 4px;
                }
                
                .pagination-controls button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                /* Multi-select dropdown styles */
                .multi-select-dropdown {
                    position: relative;
                    width: 100%;
                }
                
                .multi-select-input-container {
                    position: relative;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: white;
                    min-height: 38px;
                    display: flex;
                    align-items: center;
                    padding: 0.5rem;
                    cursor: pointer;
                    transition: border-color 0.2s ease;
                }
                
                .multi-select-input-container:hover,
                .multi-select-input-container:focus-within {
                    border-color: var(--accent-blue);
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                }
                
                .multi-select-input {
                    border: none;
                    outline: none;
                    background: transparent;
                    flex: 1;
                    font-size: 0.875rem;
                    padding: 0;
                }
                
                .multi-select-options {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid var(--border-color);
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 1000;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                
                .multi-select-option {
                    padding: 0.75rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: background-color 0.2s ease;
                    border-bottom: 1px solid var(--border-light);
                }
                
                .multi-select-option:hover {
                    background-color: var(--hover-bg);
                }
                
                .multi-select-option.select-all {
                    font-weight: 600;
                    background-color: var(--light-bg);
                    border-bottom: 2px solid var(--border-color);
                }
                
                .multi-select-option input[type="checkbox"] {
                    margin: 0;
                    transform: scale(1.1);
                }
                
                .multi-select-option label {
                    margin: 0;
                    cursor: pointer;
                    flex: 1;
                    font-size: 0.875rem;
                }
                
                .selected-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem;
                    margin-top: 0.5rem;
                    padding: 0.25rem;
                    background: var(--light-bg);
                    border-radius: 6px;
                    min-height: 30px;
                    align-items: center;
                }
                
                .selected-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    background: var(--accent-blue);
                    color: white;
                    padding: 0.2rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }
                
                .selected-tag .remove-tag {
                    cursor: pointer;
                    font-weight: bold;
                    margin-left: 0.25rem;
                    opacity: 0.8;
                }
                
                .selected-tag .remove-tag:hover {
                    opacity: 1;
                }
                
                /* Multi-select within existing dropdown */
                .searchable-option.multi-selected {
                    background-color: var(--accent-blue);
                    color: white;
                    position: relative;
                }
                
                .searchable-option.multi-selected::after {
                    content: "✓";
                    position: absolute;
                    right: 10px;
                    font-weight: bold;
                }
                
                .selected-managers-display {
                    margin-top: 0.5rem;
                    padding: 0.5rem;
                    background: var(--light-bg);
                    border-radius: 6px;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    max-height: 60px;
                    overflow-y: auto;
                }

                .table-search {
                    position: relative;
                    min-width: 300px;
                    max-width: 400px;
                    flex: 1;
                }

                .table-search input {
                    background: rgba(30, 41, 59, 0.8) !important;
                    border: 2px solid var(--border-color) !important;
                    border-radius: 10px !important;
                    padding: 0.75rem 1rem 0.75rem 2.5rem !important;
                    color: var(--text-primary) !important;
                    width: 100% !important;
                    font-size: 0.875rem !important;
                    transition: all 0.3s ease !important;
                }

                .table-search input:focus {
                    outline: none !important;
                    border-color: var(--accent-blue) !important;
                    background: rgba(30, 41, 59, 0.9) !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
                }

                .table-search i {
                    position: absolute;
                    left: 0.875rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                    font-size: 0.875rem;
                    z-index: 1;
                }

                .table-sort-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .sort-label {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .sort-select {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    color: var(--text-primary);
                    cursor: pointer;
                    font-size: 0.875rem;
                    min-width: 120px;
                }

                .sort-order-btn {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 0.5rem;
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sort-order-btn:hover {
                    background: var(--accent-blue);
                    border-color: var(--accent-blue);
                    transform: translateY(-1px);
                }

                .table-category-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-left: 1rem;
                    padding-left: 1rem;
                    border-left: 1px solid var(--border-color);
                }

                .filter-label {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .category-select {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    color: var(--text-primary);
                    cursor: pointer;
                    font-size: 0.875rem;
                    min-width: 120px;
                }

                .category-select:focus {
                    outline: none;
                    border-color: var(--accent-blue);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .table-info {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    white-space: nowrap;
                    min-width: fit-content;
                    flex-shrink: 0;
                    background-color: #ccd7d900;
                }

                .table-info i {
                    color: var(--accent-blue);
                    flex-shrink: 0;
                }
.data-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--card-bg);
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(20px);
}

.data-table thead {
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9));
    position: sticky;
    top: 0;
    z-index: 10;
}

.data-table th {
    padding: 1rem 1.25rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border-color);
    position: relative;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}

.data-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: var(--transition);
}

.data-table th.sortable:hover {
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent-blue);
}

.data-table th.sortable.active {
    color: var(--accent-blue);
    background: rgba(59, 130, 246, 0.15);
}

.data-table th .sort-icon {
    margin-left: 0.5rem;
    opacity: 0.3;
    font-size: 0.75rem;
    transition: var(--transition);
}

.data-table th.sortable:hover .sort-icon {
    opacity: 0.7;
}

.data-table th.active .sort-icon {
    opacity: 1;
    color: var(--accent-blue);
}

.data-table td {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    color: var(--text-primary);
    font-size: 0.875rem;
    vertical-align: middle;
}

.data-table tbody tr {
    transition: var(--transition);
    cursor: pointer;
    border-radius: 0;
}

.data-table tbody tr:hover {
    background: rgba(59, 130, 246, 0.06);
    transform: translateX(2px);
}

.data-table tbody tr:nth-child(even) {
    background: rgba(0, 0, 0, 0.02);
}

.data-table tbody tr:nth-child(even):hover {
    background: rgba(59, 130, 246, 0.06);
}

/* Improved table responsiveness */
.table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: var(--border-radius);
}

.table-responsive::-webkit-scrollbar {
    height: 8px;
}

.table-responsive::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.1);
    border-radius: 4px;
}

.table-responsive::-webkit-scrollbar-thumb {
    background: var(--gradient-primary);
    border-radius: 4px;
}
                /* Enhanced Clickable Cards */
            .stat-card {
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border-color);
    width: 100%;
    min-height: 140px;
    border-radius: var(--border-radius);
    padding: 1.5rem;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transform-origin: center;
    box-shadow: var(--shadow-soft);
}

.stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--gradient-primary);
    opacity: 0;
    transition: var(--transition);
}

.stat-card:hover::before {
    opacity: 1;
}

.stat-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-hover);
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(30, 41, 59, 0.98);
}

.stat-card:active {
    transform: translateY(-2px);
}

.stat-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.stat-card-content {
    flex: 1;
}

.stat-card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.stat-card-value {
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    line-height: 1;
}

.stat-card-amount {
    font-size: 0.875rem;
    color: var(--accent-green);
    margin: 0;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.stat-card-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: white;
    background: var(--gradient-primary);
    opacity: 0.9;
    transition: var(--transition);
}

.stat-card:hover .stat-card-icon {
    opacity: 1;
    transform: scale(1.1);
}

.stat-card-icon.success { background: var(--gradient-success); }
.stat-card-icon.warning { background: var(--gradient-warning); }
.stat-card-icon.danger { background: var(--gradient-danger); }
.stat-card-icon.info { background: var(--gradient-primary); }
.stat-card-icon.draft { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }

            


                /* Pipeline Enhancements */
                .pipeline-stage {
                    background: rgba(51, 65, 85, 0.4);
                    border: 2px solid var(--border-color);
                    border-radius: 16px;
                    padding: 2rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .pipeline-stage::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, transparent, var(--accent-blue), transparent);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .pipeline-stage:hover::before {
                    opacity: 1;
                }

                .pipeline-stage:hover {
                    background: rgba(51, 65, 85, 0.6);
                    transform: translateY(-4px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
                }

                .pipeline-stage.pipeline-a {
                    border-color: rgba(16, 185, 129, 0.4);
                }

                .pipeline-stage.pipeline-a:hover {
                    border-color: var(--accent-green);
                    background: rgba(16, 185, 129, 0.08);
                }

                .pipeline-stage.pipeline-b {
                    border-color: rgba(59, 130, 246, 0.4);
                }

                .pipeline-stage.pipeline-b:hover {
                    border-color: var(--accent-blue);
                    background: rgba(59, 130, 246, 0.08);
                }

                .pipeline-stage.pipeline-c {
                    border-color: rgba(245, 158, 11, 0.4);
                }

                .pipeline-stage.pipeline-c:hover {
                    border-color: var(--accent-orange);
                    background: rgba(245, 158, 11, 0.08);
                }

                .pipeline-stage.pipeline-none {
                    border-color: rgba(107, 114, 128, 0.4);
                }

                .pipeline-stage.pipeline-none:hover {
                    border-color: #6b7280;
                    background: rgba(107, 114, 128, 0.08);
                }

                /* Customer Insights Enhancements */
                .insight-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.25rem;
                    margin-bottom: 2rem;
                    padding: 0 1rem;
                }

                @media (max-width: 768px) {
                    .insight-cards {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                        padding: 0 0.5rem;
                    }
                }

                .insight-card {
                    background: rgba(51, 65, 85, 0.4);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 2rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                }

                .insight-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .insight-card:hover::before {
                    opacity: 1;
                }

                .insight-card:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow);
                    border-color: var(--accent-blue);
                }

                .customer-segmentation {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .segment-card {
                    background: rgba(51, 65, 85, 0.4);
                    border: 2px solid var(--border-color);
                    border-radius: 16px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    position: relative;
                }

                .segment-card:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow);
                }

                .segment-card.segment-vip {
                    border-color: rgba(245, 158, 11, 0.6);
                    background: rgba(245, 158, 11, 0.1);
                }

                .segment-card.segment-loyal {
                    border-color: rgba(16, 185, 129, 0.6);
                    background: rgba(16, 185, 129, 0.1);
                }

                .segment-card.segment-potential {
                    border-color: rgba(59, 130, 246, 0.6);
                    background: rgba(59, 130, 246, 0.1);
                }

                .segment-card.segment-atrisk {
                    border-color: rgba(239, 68, 68, 0.6);
                    background: rgba(239, 68, 68, 0.1);
                }

                /* Sidebar Styles (keeping existing) */
               .dashboard-sidebar {
    width: 280px;
    min-width: 280px;
    background: var(--sidebar-bg);
    backdrop-filter: blur(20px);
    border-right: 1px solid var(--border-color);
    transition: transform 0.3s ease;
    z-index: 1000;
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    overflow-y: auto;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
}

.dashboard-sidebar.collapsed {
    transform: translateX(-100%);
}

.dashboard-sidebar::-webkit-scrollbar {
    width: 4px;
}

.dashboard-sidebar::-webkit-scrollbar-track {
    background: transparent;
}

.dashboard-sidebar::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.3);
    border-radius: 4px;
}

.sidebar-header {
    padding: 2rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    background: var(--sidebar-bg);
    backdrop-filter: blur(20px);
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.logo {
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: var(--transition);
    flex: 1;
    min-width: 0;
}

.logo:hover {
    transform: translateX(2px);
}

.logo-icon {
    width: 50px;
    height: 50px;
    background: var(--gradient-primary);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    transition: var(--transition);
}

.logo:hover .logo-icon {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.logo-text h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.logo-text p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
    font-weight: 500;
}

.sidebar-close-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--accent-red);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    opacity: 1;
    display: block;
    min-width: 36px;
    height: 36px;
    flex-shrink: 0;
    z-index: 1000;
    align-self: flex-start;
    margin-top: 0.25rem;
}

.sidebar-close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: var(--accent-red);
    opacity: 1;
    transform: scale(1.1);
}

.sidebar-show-btn {
    position: fixed !important;
    top: 80px !important;
    left: 20px !important;
    z-index: 99999 !important;
    background: var(--accent-blue) !important;
    border: none !important;
    color: white !important;
    font-size: 1.25rem !important;
    cursor: pointer !important;
    padding: 0.75rem !important;
    border-radius: 50% !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
    width: 50px !important;
    height: 50px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    transform: none !important;
}

.sidebar-show-btn:hover {
    background: var(--accent-blue) !important;
    transform: scale(1.1) !important;
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4) !important;
}

.sales-dashboard-container.sidebar-collapsed .sidebar-show-btn {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
}


.sidebar-nav {
    padding: 1.5rem 0;
}

.nav-section {
    margin-bottom: 2rem;
}

.nav-section-title {
    padding: 0 1.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    position: relative;
}

.nav-section-title::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 1.5rem;
    right: 1.5rem;
    height: 1px;
    background: linear-gradient(90deg, var(--accent-blue), transparent);
    opacity: 0.3;
}

.nav-item {
    display: flex;
    align-items: center;
    padding: 0.875rem 1.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: var(--transition);
    position: relative;
    border: none;
    background: none;
    width: 100%;
    cursor: pointer;
    margin: 0.25rem 0;
    border-radius: 0 24px 24px 0;
    margin-right: 12px;
}

.nav-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--gradient-primary);
    border-radius: 0 4px 4px 0;
    transform: scaleY(0);
    transition: var(--transition);
}

.nav-item:hover::before {
    transform: scaleY(1);
}

.nav-item:hover {
    background: rgba(59, 130, 246, 0.08);
    color: var(--accent-blue);
    text-decoration: none;
    transform: translateX(4px);
}

.nav-item.active {
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
    font-weight: 600;
}

.nav-item.active::before {
    transform: scaleY(1);
}

.nav-item i {
    width: 20px;
    margin-right: 0.875rem;
    font-size: 1rem;
    transition: var(--transition);
}

.nav-item:hover i,
.nav-item.active i {
    transform: scale(1.1);
}

.nav-item-badge {
    margin-left: auto;
    background: var(--gradient-primary);
    color: white;
    font-size: 0.6875rem;
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
    font-weight: 600;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.nav-item:hover .nav-item-badge {
    transform: scale(1.1);
}

                /* Main Content */
                .dashboard-main-content {
                    flex: 1;
                    margin-left: 280px;
                    display: flex;
                    flex-direction: column;
                    min-height: 100%;
                    width: calc(100% - 280px);
                    transition: margin-left 0.3s ease, width 0.3s ease;
                }

                .sales-dashboard-container.sidebar-collapsed .dashboard-main-content {
                    margin-left: 0;
                    width: 100%;
                }

                @media (max-width: 1024px) {
                    .dashboard-sidebar {
                        position: fixed;
                        top: 0;
                        height: 100%;
                        transform: translateX(-100%);
                        z-index: 9999;
                    }
                    
                    .dashboard-sidebar.active {
                        transform: translateX(0);
                    }
                    
                    .dashboard-main-content {
                        margin-left: 0;
                        width: 100%;
                    }

                    .sidebar-header {
                        padding: 1.5rem 1rem;
                    }

                    .sidebar-show-btn {
                        top: 70px !important;
                        left: 15px !important;
                        width: 44px !important;
                        height: 44px !important;
                    }

                    .stats-grid {
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1rem;
                    }

                    .table-controls {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .table-controls-left,
                    .table-controls-right {
                        width: 100%;
                    }

                    .table-info {
                        margin-top: 0.5rem;
                        font-size: 0.8rem;
                        white-space: normal;
                        min-width: auto;
                    }
                }

                /* Header */
                .dashboard-header {
                    background: var(--card-bg);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid var(--border-color);
                    padding: 1rem 2rem;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 0 1rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .mobile-menu-toggle {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    font-size: 1.25rem;
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: var(--border-radius-sm);
                    transition: var(--transition);
                }

                .mobile-menu-toggle:hover {
                    background: rgba(51, 65, 85, 0.6);
                }

                @media (max-width: 1024px) {
                    .mobile-menu-toggle {
                        display: block;
                    }
                }

                .page-title h1 {
                    font-size: 1.875rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--text-primary);
                }

                .page-title p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    flex-wrap: wrap;
                }

                /* Global Search */
                .global-search-container {
                    position: relative;
                }

                .search-bar {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .search-bar i {
                    position: absolute;
                    left: 1rem;
                    color: var(--text-muted);
                    z-index: 1;
                }

                .search-bar input {
                    background: rgba(51, 65, 85, 0.6);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    color: var(--text-primary);
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    width: 300px;
                    font-size: 0.875rem;
                    transition: all 0.2s ease;
                }

                .search-bar input:focus {
                    outline: none;
                    border-color: var(--accent-blue);
                    background: rgba(51, 65, 85, 0.8);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    width: 350px;
                }

                /* Buttons */
               .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    font-size: 0.8125rem;
    min-height: 36px;
    white-space: nowrap;
    border: none;
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    user-select: none;
    outline: none;
    min-height: 40px;
}

.btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: var(--transition);
}

.btn:hover::before {
    left: 100%;
}

.btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
}

.btn-primary {
    background: var(--gradient-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

.btn-primary:active {
    transform: translateY(0);
}

.btn-secondary {
    background: rgba(51, 65, 85, 0.8);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    backdrop-filter: blur(10px);
}

.btn-secondary:hover {
    background: rgba(51, 65, 85, 0.9);
    border-color: var(--accent-blue);
    transform: translateY(-1px);
    box-shadow: var(--shadow-soft);
}

.btn-success {
    background: var(--gradient-success);
    color: white;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-success:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
}

.btn-warning {
    background: var(--gradient-warning);
    color: white;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.btn-warning:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
}

.btn-danger {
    background: var(--gradient-danger);
    color: white;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    min-height: 32px;
}

.btn-lg {
    padding: 1rem 2rem;
    font-size: 1rem;
    min-height: 48px;
}

.btn-icon {
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
}

.btn-icon.btn-sm {
    width: 32px;
    height: 32px;
}

.btn-icon.btn-lg {
    width: 48px;
    height: 48px;
}

                .btn-primary {
                    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                    color: white;
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover);
                }

                .btn-secondary {
                    background: rgba(51, 65, 85, 0.6);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                }

                .btn-secondary:hover {
                    background: rgba(51, 65, 85, 0.8);
                    border-color: var(--accent-blue);
                    transform: translateY(-1px);
                }

                .btn-sm {
                    padding: 0.375rem 0.75rem;
                    font-size: 0.75rem;
                    min-height: 28px;
                }

                @media (max-width: 768px) {
                    .header-content {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 1rem;
                    }
                    
                    .header-actions {
                        justify-content: center;
                        gap: 0.5rem;
                    }
                    
                    .btn {
                        padding: 0.5rem 0.75rem;
                        font-size: 0.75rem;
                        min-height: 32px;
                    }
                    
                    .search-bar input {
                        width: 100% !important;
                        max-width: none !important;
                    }
                }

                /* Date Range Picker */
                .date-range-picker {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(51, 65, 85, 0.6);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .date-range-picker:hover {
                    background: rgba(51, 65, 85, 0.8);
                    border-color: var(--accent-blue);
                }

                /* Preset Date Buttons */
                .preset-btn {
                    font-size: 0.75rem;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--border-color);
                    background: rgba(51, 65, 85, 0.4);
                    color: var(--text-secondary);
                    border-radius: 6px;
                    transition: all 0.2s ease;
                    text-align: left;
                    white-space: nowrap;
                }

                .preset-btn:hover {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: var(--accent-blue);
                    color: var(--text-primary);
                    transform: translateY(-1px);
                }

                .preset-btn:active,
                .preset-btn.active {
                    background: var(--accent-blue);
                    border-color: var(--accent-blue);
                    color: white;
                }

                .preset-btn i {
                    font-size: 0.7rem;
                    margin-right: 0.25rem;
                    opacity: 0.8;
                }

                /* Content Area */
                .dashboard-content {
                    flex: 1;
                    padding: 2rem;
                    overflow-y: auto;
                    background: linear-gradient(135deg, var(--primary-bg) 0%, var(--secondary-bg) 100%);
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.25rem;
                    margin-bottom: 2rem;
                    padding: 0 1rem;
                }

                @media (max-width: 768px) {
                    .stats-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                        padding: 0 0.5rem;
                    }
                }

                @media (max-width: 1200px) and (min-width: 769px) {
                    .stats-grid {
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1rem;
                    }
                }

                .stat-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .stat-card-content {
                    flex: 1;
                }

                .stat-card-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin: 0 0 0.5rem 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .stat-card-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0 0 0.5rem 0;
                    line-height: 1;
                }

                .stat-card-amount {
                    font-size: 0.875rem;
                    color: var(--accent-green);
                    margin: 0;
                    font-weight: 500;
                }

                .stat-card-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    color: white;
                    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                    opacity: 0.8;
                }

                .stat-card-icon.success {
                    background: linear-gradient(135deg, var(--accent-green), #059669);
                }

                .stat-card-icon.warning {
                    background: linear-gradient(135deg, var(--accent-orange), #d97706);
                }

                .stat-card-icon.danger {
                    background: linear-gradient(135deg, var(--accent-red), #dc2626);
                }
                
                .stat-card-icon.draft {
                    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                }

                .stat-card-icon.info {
                    background: linear-gradient(135deg, var(--accent-blue), #2563eb);
                }

                /* Data Sections */
                .data-section {
                    background: var(--card-bg);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .section-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .section-title i {
                    color: var(--accent-blue);
                }

                /* Badges */
              .status-badge {
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);
}

.status-badge::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.6s ease;
}

.status-badge:hover::before {
    transform: translateX(100%);
}

.status-badge.success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
}

.status-badge.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
}

.status-badge.danger {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);
}

.status-badge.info {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.margin-badge {
    padding: 0.25rem 0.625rem;
    border-radius: 16px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    backdrop-filter: blur(10px);
}

.margin-badge.success { 
    background: rgba(16, 185, 129, 0.15); 
    color: #34d399; 
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.margin-badge.info { 
    background: rgba(59, 130, 246, 0.15); 
    color: #60a5fa; 
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.margin-badge.warning { 
    background: rgba(245, 158, 11, 0.15); 
    color: #fbbf24; 
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.margin-badge.danger { 
    background: rgba(239, 68, 68, 0.15); 
    color: #f87171; 
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-with-icon {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
}

.badge-with-icon i {
    font-size: 0.6875rem;
}
                /* Form Controls */
          .form-control {
    background: rgba(51, 65, 85, 0.7) !important;
    border: 1px solid var(--border-color) !important;
    color: var(--text-primary) !important;
    border-radius: var(--border-radius-sm) !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
    transition: var(--transition) !important;
    min-height: 40px;
    backdrop-filter: blur(10px);
}

.form-control:focus {
    background: rgba(51, 65, 85, 0.9) !important;
    border-color: var(--accent-blue) !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
    color: var(--text-primary) !important;
    outline: none !important;
}

.form-control::placeholder {
    color: var(--text-muted) !important;
}

/* Select dropdown improvements */
select.form-control {
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23ffffff' d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 0.75rem center !important;
    background-size: 16px 12px !important;
    padding-right: 2.5rem !important;
    appearance: none !important;
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
}

select.form-control option {
    background: var(--bg-secondary) !important;
    color: var(--text-primary) !important;
    padding: 0.5rem !important;
}

/* Searchable Dropdown Styles */
.searchable-dropdown {
    position: relative;
    width: 100%;
}

.searchable-input-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
}

.searchable-input {
    width: 100% !important;
    padding-right: 2.5rem !important;
    box-sizing: border-box !important;
    height: auto !important; /* Match form-control height */
}

/* Ensure consistent form control alignment */
#advanced-filters .form-group {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
}

#advanced-filters .form-control,
#advanced-filters .searchable-input {
    height: 38px !important; /* Standard form control height */
    padding: 0.375rem 0.75rem !important;
    border: 1px solid var(--border-color) !important;
    border-radius: var(--border-radius-sm) !important;
    background-color: var(--bg-primary) !important;
    color: var(--text-primary) !important;
    font-size: 0.875rem !important;
    line-height: 1.5 !important;
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
}

#advanced-filters .searchable-input {
    padding-right: 2.5rem !important; /* Keep space for dropdown arrow */
}

#advanced-filters .searchable-dropdown {
    width: 100% !important;
    display: block !important;
}

#advanced-filters .searchable-input-container {
    position: relative !important;
    width: 100% !important;
    display: block !important; /* Change from flex to block */
}

#advanced-filters label {
    color: var(--text-primary) !important;
    font-weight: 600 !important;
    margin-bottom: 0.5rem !important;
    display: block !important;
    font-size: 0.875rem !important;
}

/* Ensure consistent row and column alignment */
#advanced-filters .row {
    margin-left: 0 !important;
    margin-right: 0 !important;
}

#advanced-filters .col-md-6 {
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
}

.dropdown-arrow {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
    z-index: 2;
    font-size: 0.75rem;
}

.searchable-options {
    position: fixed; /* Fixed position to prevent modal scroll interference */
    min-width: 200px; /* Ensure minimum width */
    background: #ffffff !important; /* Solid white background for better visibility */
    border: 2px solid var(--border-color) !important;
    border-radius: var(--border-radius-sm);
    height: auto; /* Auto height to fit content */
    max-height: 320px; /* About 8-10 options visible (40px each) */
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 99999; /* Very high z-index to appear above modal */
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important; /* Enhanced shadow for better visibility */
    /* Position will be set dynamically by JavaScript */
    
    /* Custom scrollbar for better visibility */
    scrollbar-width: thin;
    scrollbar-color: var(--accent-blue) transparent;
}

.searchable-options::-webkit-scrollbar {
    width: 8px;
}

.searchable-options::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}

.searchable-options::-webkit-scrollbar-thumb {
    background: var(--accent-blue);
    border-radius: 4px;
    border: 1px solid var(--bg-secondary);
}

.searchable-options::-webkit-scrollbar-thumb:hover {
    background: var(--accent-blue-hover, #2563eb);
}

.searchable-option {
    padding: 0.75rem 1rem !important; /* Increased padding for better visibility */
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    color: #333333 !important; /* Dark text for better contrast on white background */
    background-color: #ffffff !important; /* Solid white background */
    border-bottom: 1px solid #e5e7eb !important; /* Light gray border */
    font-size: 0.875rem !important; /* Explicit font size */
    line-height: 1.4 !important; /* Better line height */
    white-space: nowrap !important; /* Prevent text wrapping */
    overflow: hidden !important; /* Handle long text */
    text-overflow: ellipsis !important; /* Show ellipsis for long text */
    font-weight: 500 !important; /* Medium weight for better readability */
}

.searchable-option:hover {
    background-color: #f3f4f6 !important; /* Light gray hover */
    color: #1f2937 !important; /* Darker text on hover */
    font-weight: 600 !important;
}

.searchable-option.selected {
    background-color: #3b82f6 !important; /* Blue selection background */
    color: #ffffff !important; /* White text on blue */
    font-weight: 600 !important;
}

/* Highlighted search match styling */
.searchable-option.search-match {
    background-color: #e6f7ff !important; /* Light blue highlight for matches */
    border-left: 3px solid #1890ff !important;
    color: #1f2937 !important; /* Dark text for readability */
    font-weight: 600 !important;
}

.searchable-option.search-match:hover {
    background-color: #bae7ff !important; /* Darker blue on hover */
    color: #1f2937 !important;
}

.searchable-option.search-no-match {
    opacity: 0.6 !important; /* Slightly dim non-matching options but keep them visible */
    background-color: #ffffff !important;
    color: #6b7280 !important; /* Gray text for non-matches */
    font-weight: 400 !important;
}

/* Highlighted text within options */
.search-highlight {
    background-color: #ffeb3b !important; /* Bright yellow highlight */
    color: #1f2937 !important; /* Dark text for contrast */
    font-weight: bold !important;
    padding: 1px 3px !important;
    border-radius: 3px !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
}

.searchable-option:last-child {
    border-bottom: none;
}

.searchable-options::-webkit-scrollbar {
    width: 8px; /* Slightly wider for better visibility */
}

.searchable-options::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
}

.searchable-options::-webkit-scrollbar-thumb {
    background: var(--accent-blue); /* More visible blue color */
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1); /* Border for definition */
}

.searchable-options::-webkit-scrollbar-thumb:hover {
    background: var(--accent-purple); /* Purple on hover */
    border-color: rgba(255, 255, 255, 0.2);
}

/* Focus state for searchable input */
.searchable-input:focus {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
}

.searchable-input:focus + .dropdown-arrow {
    color: var(--accent-blue);
}

.form-control:disabled {
    background: rgba(51, 65, 85, 0.4) !important;
    opacity: 0.6;
    cursor: not-allowed;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    color: var(--text-primary);
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: block;
    font-size: 0.875rem;
}

.form-group label.required::after {
    content: '*';
    color: var(--accent-red);
    margin-left: 0.25rem;
}

.form-select {
    background: rgba(51, 65, 85, 0.7) !important;
    border: 1px solid var(--border-color) !important;
    color: var(--text-primary) !important;
    border-radius: var(--border-radius-sm) !important;
    padding: 0.75rem 1rem !important;
    font-size: 0.875rem !important;
    transition: var(--transition) !important;
    min-height: 40px;
    backdrop-filter: blur(10px);
    cursor: pointer;
}

.form-select:focus {
    background: rgba(51, 65, 85, 0.9) !important;
    border-color: var(--accent-blue) !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
    outline: none !important;
}

.form-select option {
    background: var(--secondary-bg);
    color: var(--text-primary);
    padding: 0.5rem;
}

.input-group {
    position: relative;
    display: flex;
    align-items: center;
}

.input-group-text {
    background: rgba(51, 65, 85, 0.7);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius-sm) 0 0 var(--border-radius-sm);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    min-height: 40px;
}
    /* Pipeline Overview Cards */
.pipeline-overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2rem;
    padding: 0 1rem;
}

@media (max-width: 768px) {
    .pipeline-overview-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
        padding: 0 0.5rem;
    }
}

.pipeline-overview-card {
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 2rem;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
}

.pipeline-overview-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--gradient-primary);
    opacity: 0.8;
}

.pipeline-overview-card.weighted::before {
    background: var(--gradient-success);
}

.pipeline-overview-card.conversion::before {
    background: var(--gradient-warning);
}

.overview-card-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
}

.overview-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    color: white;
    box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

.pipeline-overview-card.weighted .overview-icon {
    background: var(--gradient-success);
    box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
}

.pipeline-overview-card.conversion .overview-icon {
    background: var(--gradient-warning);
    box-shadow: 0 8px 16px rgba(245, 158, 11, 0.3);
}

.overview-details {
    flex: 1;
}

.overview-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.overview-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    line-height: 1;
}

.overview-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
}

/* Pipeline Legend */
.pipeline-legend {
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: block;
}

.legend-a .legend-dot { background: var(--accent-green); }
.legend-b .legend-dot { background: var(--accent-blue); }
.legend-c .legend-dot { background: var(--accent-orange); }
.legend-none .legend-dot { background: var(--text-muted); }

/* Pipeline Stages Container */
.pipeline-stages-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.25rem;
    padding: 0 1rem;
    margin-bottom: 2rem;
}

.pipeline-stage-card {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 2rem;
    cursor: pointer;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
    min-height: 280px;
    display: flex;
    flex-direction: column;
}

.pipeline-stage-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    opacity: 0;
    transition: var(--transition);
}

.pipeline-stage-card:hover::before {
    opacity: 1;
}

.pipeline-stage-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-hover);
}

.pipeline-stage-card.pipeline-a {
    border-color: rgba(16, 185, 129, 0.3);
}

.pipeline-stage-card.pipeline-a::before {
    background: var(--gradient-success);
}

.pipeline-stage-card.pipeline-a:hover {
    border-color: var(--accent-green);
    background: rgba(16, 185, 129, 0.05);
}

.pipeline-stage-card.pipeline-b {
    border-color: rgba(59, 130, 246, 0.3);
}

.pipeline-stage-card.pipeline-b::before {
    background: var(--gradient-primary);
}

.pipeline-stage-card.pipeline-b:hover {
    border-color: var(--accent-blue);
    background: rgba(59, 130, 246, 0.05);
}

.pipeline-stage-card.pipeline-c {
    border-color: rgba(245, 158, 11, 0.3);
}

.pipeline-stage-card.pipeline-c::before {
    background: var(--gradient-warning);
}

.pipeline-stage-card.pipeline-c:hover {
    border-color: var(--accent-orange);
    background: rgba(245, 158, 11, 0.05);
}

.pipeline-stage-card.pipeline-none {
    border-color: rgba(107, 114, 128, 0.3);
}

.pipeline-stage-card.pipeline-none::before {
    background: linear-gradient(135deg, #6b7280, #9ca3af);
}

.pipeline-stage-card.pipeline-none:hover {
    border-color: #6b7280;
    background: rgba(107, 114, 128, 0.05);
}

.pipeline-stage-card.empty {
    opacity: 0.6;
    cursor: default;
}

.pipeline-stage-card.empty:hover {
    transform: none;
    box-shadow: none;
    background: var(--card-bg);
}

.stage-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
}

.stage-info {
    flex: 1;
}

.stage-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
}

.stage-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
}

.stage-probability {
    display: flex;
    align-items: center;
}

.probability-badge {
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.probability-high {
    background: rgba(16, 185, 129, 0.15);
    color: var(--accent-green);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.probability-medium {
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.probability-low {
    background: rgba(245, 158, 11, 0.15);
    color: var(--accent-orange);
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.probability-none {
    background: rgba(107, 114, 128, 0.15);
    color: var(--text-muted);
    border: 1px solid rgba(107, 114, 128, 0.3);
}

.stage-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.metric-group {
    text-align: center;
    padding: 1rem;
    background: rgba(51, 65, 85, 0.3);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
}

.metric-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
    line-height: 1;
}

.metric-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.stage-progress {
    margin-top: auto;
    margin-bottom: 1rem;
}

.progress-bar {
    height: 8px;
    background: rgba(148, 163, 184, 0.2);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
}

.progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: var(--transition);
}

.progress-a { background: var(--gradient-success); }
.progress-b { background: var(--gradient-primary); }
.progress-c { background: var(--gradient-warning); }
.progress-none { background: linear-gradient(135deg, #6b7280, #9ca3af); }

.progress-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-align: center;
}

.stage-click-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: var(--border-radius-sm);
    border: 1px solid rgba(59, 130, 246, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.stage-empty {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-direction: column;
    margin-top: auto;
}

/* Pipeline Tabs */
.pipeline-tabs {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
    backdrop-filter: blur(20px);
}

.tab-navigation {
    display: flex;
    background: rgba(15, 23, 42, 0.3);
    border-bottom: 1px solid var(--border-color);
}

.tab-btn {
    flex: 1;
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
}

.tab-btn::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--gradient-primary);
    transform: scaleX(0);
    transition: var(--transition);
}

.tab-btn:hover {
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent-blue);
}

.tab-btn.active {
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
    font-weight: 600;
}

.tab-btn.active::after {
    transform: scaleX(1);
}

.tab-content {
    min-height: 400px;
}

.tab-pane {
    display: none;
    padding: 2rem;
}

.tab-pane.active {
    display: block;
}

.tab-header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.tab-header h4 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.tab-header h4 i {
    color: var(--accent-blue);
}

.tab-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
}

/* Pipeline Summary Cards */
.pipeline-summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.pipeline-summary-card {
    background: rgba(51, 65, 85, 0.3);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    cursor: pointer;
    transition: var(--transition);
}

.pipeline-summary-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: var(--accent-blue);
}

.summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.branch-name,
.manager-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
}

.branch-total {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--accent-green);
}

.manager-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.manager-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    color: white;
}

.manager-details {
    flex: 1;
}

.manager-total {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent-green);
}

.manager-score {
    text-align: center;
}

.score-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-blue);
    line-height: 1;
}

.score-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.pipeline-distribution {
    margin-bottom: 1rem;
}

.distribution-bar {
    height: 8px;
    background: rgba(148, 163, 184, 0.2);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
}

.dist-segment {
    height: 100%;
    transition: var(--transition);
}

.dist-a { background: var(--accent-green); }
.dist-b { background: var(--accent-blue); }
.dist-c { background: var(--accent-orange); }
.dist-none { background: var(--text-muted); }

.pipeline-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.stat-label {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
}

.stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
}

/* Timeline Styles */
.timeline-container {
    padding: 1rem 0;
}

.timeline-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}

.timeline-stat {
    background: rgba(51, 65, 85, 0.3);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    text-align: center;
}

.timeline-stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    line-height: 1;
}

.timeline-stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
}

.pipeline-timeline-chart {
    background: rgba(51, 65, 85, 0.2);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    margin-bottom: 2rem;
}

.urgent-actions {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--border-radius);
    padding: 1.5rem;
}

.urgent-actions h5 {
    color: var(--accent-red);
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Responsive Design */
@media (max-width: 768px) {
    .pipeline-overview-grid {
        grid-template-columns: 1fr;
    }
    
    .pipeline-stages-container {
        grid-template-columns: 1fr;
    }
    
    .tab-navigation {
        flex-direction: column;
    }
    
    .pipeline-summary-cards {
        grid-template-columns: 1fr;
    }
    
    .timeline-stats {
        grid-template-columns: 1fr;
    }
    
    .stage-metrics {
        grid-template-columns: 1fr;
    }
}

.input-group .form-control {
    border-radius: 0 var(--border-radius-sm) var(--border-radius-sm) 0 !important;
    border-left: none !important;
}

.input-group .form-control:focus {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
}

                /* Loading */
                .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(16px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: loadingFadeIn 0.3s ease-out;
}

/* Quotation Details Modal - Targeted Z-Index */
#quotationDetailsModal {
    z-index: 10001 !important;
}

#quotationDetailsModal.show,
#quotationDetailsModal.in {
    z-index: 10001 !important;
}

@keyframes loadingFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.loading-spinner {
    text-align: center;
    color: var(--text-primary);
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 3rem;
    backdrop-filter: blur(20px);
    box-shadow: var(--shadow-hover);
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(59, 130, 246, 0.2);
    border-left: 4px solid var(--accent-blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.loading-spinner p {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-secondary);
}

.loading-spinner .loading-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
}

/* Skeleton loading states */
.skeleton {
    background: linear-gradient(90deg, rgba(51, 65, 85, 0.3) 25%, rgba(51, 65, 85, 0.5) 50%, rgba(51, 65, 85, 0.3) 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: var(--border-radius-sm);
}

@keyframes skeleton-loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.skeleton-text {
    height: 1rem;
    margin-bottom: 0.5rem;
}

.skeleton-text.w-3-4 { width: 75%; }
.skeleton-text.w-1-2 { width: 50%; }
.skeleton-text.w-1-4 { width: 25%; }

.skeleton-card {
    height: 120px;
    margin-bottom: 1rem;
}

.skeleton-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
}
                

             

                /* Responsive Design */
                @media (max-width: 1024px) {
                    .dashboard-sidebar {
                        transform: translateX(-100%);
                        transition: transform 0.3s ease;
                    }

                    .stats-grid {
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1rem;
                    }

                    .pipeline-stages-container {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                        padding: 0 0.5rem;
                    }

                    #content-area {
                        padding: 1rem 0.5rem !important;
                    }
                    
                    .dashboard-header {
                        padding: 1rem !important;
                    }
                    
                    .page-title h1 {
                        font-size: 1.5rem !important;
                    }
                    
                    .page-title p {
                        font-size: 0.875rem !important;
                    }
                    
                    .section-header h2 {
                        font-size: 1.25rem !important;
                    }
                    
                    .table-responsive {
                        margin: 0 -0.5rem !important;
                    }
                    
                    .modal-dialog {
                        margin: 0.25rem auto !important;
                        max-width: 98vw !important;
                    }

                    .pipeline-overview-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                }

                @media (max-width: 768px) {
                    .dashboard-content {
                        padding: 1rem;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .search-bar input {
                        width: 200px;
                    }

                    .search-bar input:focus {
                        width: 250px;
                    }

                    .table-controls {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .table-controls-left,
                    .table-controls-right {
                        width: 100%;
                    }

                    .table-search {
                        min-width: auto;
                        max-width: none;
                    }

                    .table-info {
                        margin-top: 0.5rem;
                        font-size: 0.8rem;
                        white-space: normal;
                        min-width: auto;
                    }

                    .table-info span {
                        word-break: break-word;
                    }
                }

                /* Additional utility classes */
                .text-center { text-align: center; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-3 { margin-bottom: 1rem; }
                .mb-4 { margin-bottom: 1.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-3 { margin-top: 1rem; }
                .mt-4 { margin-top: 1.5rem; }
                .text-muted { color: var(--text-muted); }

                /* Range Card Styles */
                .range-card {
                    position: relative;
                    overflow: hidden;
                }

                .range-card:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-hover);
                }

                .range-card:active {
                    transform: translateY(-2px);
                }

                .range-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                    opacity: 0;
                    transition: var(--transition);
                }

                .range-card:hover::before {
                    opacity: 1;
                }

                .range-card .fa-chevron-right {
                    transition: var(--transition);
                }

                .range-card:hover .fa-chevron-right {
                    transform: translateX(4px);
                    color: var(--text-primary);
                }
            </style>
        `;
        
        if (!document.getElementById('enhanced-sales-dashboard-styles')) {
            // Remove old styles if they exist
            const oldStyles = document.getElementById('sales-dashboard-styles');
            if (oldStyles) oldStyles.remove();
            
            document.head.insertAdjacentHTML('beforeend', styles);
        }
    }

    setupPage() {
        $(this.page.main).empty();
        $(this.wrapper).find('.page-head').hide();
        $(this.wrapper).html(this.getHTML());
    }

    getHTML() {
        return `
            <div class="sales-dashboard-container">
                <!-- Floating Show Sidebar Button -->
                <button class="sidebar-show-btn" id="sidebar-show" title="Show Sidebar" style="display: none;">
                    <i class="fa fa-bars"></i>
                </button>
                
                <!-- Sidebar -->
                <aside class="dashboard-sidebar" id="sidebar">
                    <div class="sidebar-header">
                        <div class="logo">
                            <div class="logo-icon">
                                <i class="fa fa-chart-line"></i>
                            </div>
                            <div class="logo-text">
                                <h2>Sales Intelligence</h2>
                                <p>Analytics Dashboard</p>
                            </div>
                        </div>
                        <button class="sidebar-close-btn" id="sidebar-close" title="Close Sidebar">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <nav class="sidebar-nav">
                        <div class="nav-section">
                            <div class="nav-section-title">Analytics</div>
                            <a href="#" class="nav-item active" data-section="overview">
                                <i class="fa fa-th-large"></i>
                                <span>Overview</span>
                            </a>
                            <a href="#" class="nav-item" data-section="pipeline">
                                <i class="fa fa-layer-group"></i>
                                <span>Pipeline Analysis</span>
                            </a>
                            <a href="#" class="nav-item" data-section="conversion">
                                <i class="fa fa-exchange-alt"></i>
                                <span>Conversion</span>
                            </a>
                            <a href="#" class="nav-item" data-section="margin">
                                <i class="fa fa-percentage"></i>
                                <span>Margin Analysis</span>
                            </a>
                            <a href="#" class="nav-item" data-section="items">
                                <i class="fa fa-cube"></i>
                                <span>Items Analysis</span>
                            </a>
                            <a href="#" class="nav-item" data-section="followup">
                                <i class="fa fa-phone"></i>
                                <span>Follow-up Tracker</span>
                            </a>
                            <a href="#" class="nav-item" data-section="customers">
                                <i class="fa fa-building"></i>
                                <span>Customer Insights</span>
                            </a>
                            <a href="#" class="nav-item" data-section="lost">
                                <i class="fa fa-times-circle"></i>
                                <span>Lost Quotations</span>
                            </a>
                            <a href="#" class="nav-item" data-section="cancelled">
                                <i class="fa fa-ban"></i>
                                <span>Cancelled Quotations</span>
                            </a>
                            <a href="#" class="nav-item" data-section="opportunities">
                                <i class="fa fa-lightbulb"></i>
                                <span>Opportunities</span>
                            </a>
                        </div>
                    </nav>
                </aside>
                
                <!-- Main Content -->
                <main class="dashboard-main-content">
                    <!-- Header -->
                    <header class="dashboard-header">
                        <div class="header-content">
                            <div class="header-left">
                                <button class="mobile-menu-toggle" id="mobile-menu-toggle" title="Toggle Menu">
                                    <i class="fa fa-bars"></i>
                                </button>
                                <div class="page-title">
                                    <h1 id="page-title">Overview</h1>
                                    <p id="page-subtitle">Comprehensive sales analytics</p>
                                </div>
                            </div>
                            
                            <div class="header-actions">
                                <!-- Global Search -->
                                <div class="global-search-container">
                                    <div class="search-bar">
                                        <i class="fa fa-search"></i>
                                        <input type="text" id="global-search" placeholder="Search everything...">
                                        <div class="search-dropdown" id="search-dropdown" style="display: none;">
                                            <div class="search-results" id="search-results"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button class="btn btn-secondary" id="advanced-filters-btn" title="Advanced Filters">
                                    <i class="fa fa-filter"></i>
                                    <span>Filters</span>
                                </button>
                                
                                <div class="date-range-picker" id="date-range-picker">
                                    <i class="fa fa-calendar-alt"></i>
                                    <span id="date-range-text">Last 30 Days</span>
                                    <i class="fa fa-chevron-down"></i>
                                </div>
                                
                                <button class="btn btn-primary" id="refresh-data">
                                    <i class="fa fa-sync-alt"></i>
                                    <span>Refresh</span>
                                </button>
                            </div>
                        </div>
                    </header>
                    
                    <!-- Content Area -->
                    <div class="dashboard-content" id="content-area">
                        <!-- Dynamic content will be loaded here -->
                    </div>
                </main>
                
                <!-- Loading Overlay -->
                <div class="loading-overlay" id="loading-overlay" style="display: none;">
                    <div class="loading-spinner">
                        <div class="spinner">
                            <i class="fa fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-blue);"></i>
                        </div>
                        <p><i class="fa fa-chart-line" style="margin-right: 0.5rem;"></i>Loading dashboard data...</p>
                    </div>
                </div>
            </div>
            
            ${this.getModalsHTML()}
        `;
    }

    getModalsHTML() {
        return `
            <!-- Date Range Modal -->
            <div class="modal fade" id="dateRangeModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fa fa-calendar"></i>Select Date Range</h5>
                            <button type="button" class="close" data-dismiss="modal" style="color: var(--text-primary); opacity: 0.7; font-size: 1.5rem; border: none; background: none; cursor: pointer;">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="modal-section">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6 style="color: var(--text-primary); font-weight: 600; margin-bottom: 1rem;">
                                            <i class="fa fa-clock" style="margin-right: 0.5rem;"></i>Quick Select
                                        </h6>
                                        <div class="preset-buttons" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="today">
                                                <i class="fa fa-calendar-day"></i> Today
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="yesterday">
                                                <i class="fa fa-calendar-minus"></i> Yesterday
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="this_week">
                                                <i class="fa fa-calendar-week"></i> This Week
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="last_week">
                                                <i class="fa fa-calendar-alt"></i> Last Week
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="this_month">
                                                <i class="fa fa-calendar"></i> This Month
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="last_month">
                                                <i class="fa fa-calendar-check"></i> Last Month
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="this_quarter">
                                                <i class="fa fa-calendar-plus"></i> This Quarter
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="last_quarter">
                                                <i class="fa fa-calendar-times"></i> Last Quarter
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="this_year">
                                                <i class="fa fa-calendar"></i> This Year
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary preset-btn" data-preset="last_year">
                                                <i class="fa fa-history"></i> Last Year
                                            </button>
                                        </div>
                                        
                                        <!-- Yearly Based Section -->
                                        <div style="margin-top: 1.5rem;">
                                            <h6 style="color: var(--text-primary); font-weight: 600; margin-bottom: 1rem;">
                                                <i class="fa fa-calendar-alt" style="margin-right: 0.5rem;"></i>Yearly Based
                                            </h6>
                                            <div class="year-select-container">
                                                <select class="form-control" id="yearly-select" onchange="frappe.sales_intelligence.selectYearlyRange()">
                                                    <option value="">Select Year</option>
                                                    <option value="2022">2022</option>
                                                    <option value="2023">2023</option>
                                                    <option value="2024">2024</option>
                                                    <option value="2025">2025</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6 style="color: var(--text-primary); font-weight: 600; margin-bottom: 1rem;">
                                            <i class="fa fa-edit" style="margin-right: 0.5rem;"></i>Custom Range
                                        </h6>
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">From Date</label>
                                            <input type="date" class="form-control" id="from-date">
                                        </div>
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">To Date</label>
                                            <input type="date" class="form-control" id="to-date">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">
                                <i class="fa fa-times"></i> Cancel
                            </button>
                            <button type="button" class="btn btn-primary" id="apply-date-range">
                                <i class="fa fa-check"></i> Apply Range
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Advanced Filters Modal -->
            <div class="modal fade" id="advancedFiltersModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fa fa-filter"></i>Advanced Filters</h5>
                            <button type="button" class="close" data-dismiss="modal" style="color: var(--text-primary); opacity: 0.7; font-size: 1.5rem; border: none; background: none; cursor: pointer;">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="modal-section">
                                <h6><i class="fa fa-building"></i>Organization Filters</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Company</label>
                                            <div class="searchable-dropdown" id="company-dropdown">
                                                <div class="searchable-input-container">
                                                    <input type="text" class="form-control searchable-input" id="filter-company-input" placeholder="Search companies..." autocomplete="off">
                                                    <div class="dropdown-arrow"><i class="fa fa-chevron-down"></i></div>
                                                </div>
                                                <div class="searchable-options" id="company-options" style="display: none;">
                                                    <div class="searchable-option" data-value="">All Companies</div>
                                                </div>
                                                <input type="hidden" id="filter-company" value="">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Branch</label>
                                            <div class="searchable-dropdown" id="branch-dropdown">
                                                <div class="searchable-input-container">
                                                    <input type="text" class="form-control searchable-input" id="filter-branch-input" placeholder="Search branches..." autocomplete="off">
                                                    <div class="dropdown-arrow"><i class="fa fa-chevron-down"></i></div>
                                                </div>
                                                <div class="searchable-options" id="branch-options" style="display: none;">
                                                    <div class="searchable-option" data-value="">All Branches</div>
                                                </div>
                                                <input type="hidden" id="filter-branch" value="">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-section">
                                <h6><i class="fa fa-users"></i>People Filters</h6>
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Account Manager <small class="text-muted">(Multiple selection)</small></label>
                                            <div class="searchable-dropdown" id="account-manager-dropdown">
                                                <div class="searchable-input-container">
                                                    <input type="text" class="form-control searchable-input" id="filter-account-manager-input" placeholder="Search account managers..." autocomplete="off">
                                                    <div class="dropdown-arrow"><i class="fa fa-chevron-down"></i></div>
                                                </div>
                                                <div class="searchable-options" id="account-manager-options" style="display: none;">
                                                    <div class="searchable-option" data-value="">All Managers</div>
                                                </div>
                                                <input type="hidden" id="filter-account-manager" value="">
                                                <div class="selected-managers-display" id="selected-managers-display" style="display: none;">
                                                    <small class="text-muted">Selected: </small>
                                                    <span id="selected-managers-text"></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">IHG Team</label>
                                            <div class="searchable-dropdown" id="sales-team-dropdown">
                                                <div class="searchable-input-container">
                                                    <input type="text" class="form-control searchable-input" id="filter-sales-team-input" placeholder="Search teams..." autocomplete="off">
                                                    <div class="dropdown-arrow"><i class="fa fa-chevron-down"></i></div>
                                                </div>
                                                <div class="searchable-options" id="sales-team-options" style="display: none;">
                                                    <div class="searchable-option" data-value="">All Teams</div>
                                                </div>
                                                <input type="hidden" id="filter-sales-team" value="">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Status</label>
                                            <div class="searchable-dropdown" id="status-dropdown">
                                                <div class="searchable-input-container">
                                                    <input type="text" class="form-control searchable-input" id="filter-status-input" placeholder="Search status..." autocomplete="off">
                                                    <div class="dropdown-arrow"><i class="fa fa-chevron-down"></i></div>
                                                </div>
                                                <div class="searchable-options" id="status-options" style="display: none;">
                                                    <div class="searchable-option" data-value="all">All Status</div>
                                                    <div class="searchable-option" data-value="Open">Open</div>
                                                    <div class="searchable-option" data-value="Ordered">Ordered</div>
                                                    <div class="searchable-option" data-value="Partially Ordered">Partially Ordered</div>
                                                    <div class="searchable-option" data-value="Expired">Expired</div>
                                                    <div class="searchable-option" data-value="Lost">Lost</div>
                                                </div>
                                                <input type="hidden" id="filter-status" value="">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-section">
                                <h6><i class="fa fa-money-bill"></i>Amount Filters</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Minimum Amount</label>
                                            <input type="number" class="form-control" id="filter-amount-min" placeholder="0">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Maximum Amount</label>
                                            <input type="number" class="form-control" id="filter-amount-max" placeholder="No limit">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="clear-filters">
                                <i class="fa fa-eraser"></i> Clear All
                            </button>
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">
                                <i class="fa fa-times"></i> Cancel
                            </button>
                            <button type="button" class="btn btn-primary" id="apply-filters">
                                <i class="fa fa-check"></i> Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quotation Details Modal -->
            <div class="modal fade" id="quotationDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="quotation-title"><i class="fa fa-file-alt"></i>Quotation Details</h5>
                            <button type="button" class="close" data-dismiss="modal" style="color: var(--text-primary); opacity: 0.7; font-size: 1.5rem; border: none; background: none; cursor: pointer;">×</button>
                        </div>
                        <div class="modal-body" id="quotation-content">
                            <!-- Dynamic content -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">
                                <i class="fa fa-times"></i> Close
                            </button>
                            <button type="button" class="btn btn-primary" id="open-quotation">
                                <i class="fa fa-external-link-alt"></i>
                                Open in New Tab
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Drilldown Modal -->
            <div class="modal fade" id="drilldownModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="drilldown-title"><i class="fa fa-chart-line"></i>Detailed Analysis</h5>
                            <button type="button" class="close" data-dismiss="modal" style="color: var(--text-primary); opacity: 0.7; font-size: 1.5rem; border: none; background: none; cursor: pointer;">×</button>
                        </div>
                        <div class="modal-body" id="drilldown-content">
                            <!-- Dynamic content -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">
                                <i class="fa fa-times"></i> Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Mobile menu toggle
        $('#mobile-menu-toggle').on('click', () => {
            const sidebar = $('.dashboard-sidebar');
            sidebar.toggleClass('active');
            
            // Toggle icon
            const icon = $('#mobile-menu-toggle i');
            if (sidebar.hasClass('active')) {
                icon.removeClass('fa-bars').addClass('fa-times');
            } else {
                icon.removeClass('fa-times').addClass('fa-bars');
            }
        });

        // Sidebar toggle button - use event delegation
        $(document).on('click', '#sidebar-close', () => {
            const sidebar = $('.dashboard-sidebar');
            const container = $('.sales-dashboard-container');
            const icon = $('#sidebar-close i');
            
            // Toggle collapsed state
            if (sidebar.hasClass('collapsed')) {
                // Show sidebar
                sidebar.removeClass('collapsed');
                container.removeClass('sidebar-collapsed');
                icon.removeClass('fa-chevron-right').addClass('fa-times');
            } else {
                // Hide sidebar
                sidebar.addClass('collapsed');
                container.addClass('sidebar-collapsed');
                icon.removeClass('fa-times').addClass('fa-chevron-right');
            }
            
            // Also handle mobile active state
            if (window.innerWidth <= 1024) {
                sidebar.removeClass('active');
                $('#mobile-menu-toggle i').removeClass('fa-times').addClass('fa-bars');
            }
        });

        // Sidebar show button - use event delegation
        $(document).on('click', '#sidebar-show', () => {
            const sidebar = $('.dashboard-sidebar');
            const container = $('.sales-dashboard-container');
            const icon = $('#sidebar-close i');
            
            // Show sidebar
            sidebar.removeClass('collapsed');
            container.removeClass('sidebar-collapsed');
            icon.removeClass('fa-chevron-right').addClass('fa-times');
        });
        
        // Close sidebar when clicking outside on mobile
        $(document).on('click', (e) => {
            const sidebar = $('.dashboard-sidebar');
            const toggle = $('#mobile-menu-toggle');
            
            if (sidebar.hasClass('active') && 
                !sidebar.is(e.target) && 
                sidebar.has(e.target).length === 0 && 
                !toggle.is(e.target) && 
                toggle.has(e.target).length === 0) {
                sidebar.removeClass('active');
                $('#mobile-menu-toggle i').removeClass('fa-times').addClass('fa-bars');
            }
        });

        // Navigation
        $('.nav-item').on('click', (e) => {
            e.preventDefault();
            const section = $(e.currentTarget).data('section');
            this.navigateToSection(section);
            
            // Close mobile menu on navigation
            if (window.innerWidth <= 1024) {
                $('.dashboard-sidebar').removeClass('active');
                $('#mobile-menu-toggle i').removeClass('fa-times').addClass('fa-bars');
            }
        });

        // Global Search
        $('#global-search').on('input', frappe.utils.debounce(async (e) => {
            console.log('Global search triggered with value:', e.target.value);
            console.log('Account incharge filter before global search:', this.filters.account_incharge);
            this.filters.search_query = e.target.value;
            this.applyFilters();
            await this.renderCurrentSection();
        }, 300));

        // Date range picker
        $('#date-range-picker').on('click', () => {
            $('#from-date').val(this.filters.from_date);
            $('#to-date').val(this.filters.to_date);
            
            // Clear all preset button active states
            $('.preset-btn').removeClass('active');
            
            // If current range matches a preset, highlight it
            if (this.currentPreset) {
                $(`.preset-btn[data-preset="${this.currentPreset}"]`).addClass('active');
            }
            
            $('#dateRangeModal').modal('show');
        });

        // Preset date buttons
        $(document).on('click', '.preset-btn', (e) => {
            const preset = $(e.currentTarget).data('preset');
            const dateRange = this.getDateRangeForPreset(preset);
            
            // Update the date inputs
            $('#from-date').val(dateRange.from_date);
            $('#to-date').val(dateRange.to_date);
            
            // Update visual state
            $('.preset-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
            
            // Store the current preset for label update
            this.currentPreset = preset;
        });

        $('#apply-date-range').on('click', () => {
            this.filters.from_date = $('#from-date').val();
            this.filters.to_date = $('#to-date').val();
            $('#dateRangeModal').modal('hide');
            this.updateDateRangeText();
            this.loadData();
        });

        // Advanced filters
        $('#advanced-filters-btn').on('click', async () => {
            await this.populateFilterOptions();
            $('#advancedFiltersModal').modal('show');
        });

        $('#apply-filters').on('click', () => {
            this.applyAdvancedFilters();
            $('#advancedFiltersModal').modal('hide');
        });

        $('#clear-filters').on('click', () => {
            this.clearAllFilters();
        });

        // Refresh data
        $('#refresh-data').on('click', () => {
            this.loadData();
        });

        // Open quotation
        $('#open-quotation').on('click', () => {
            const quotationName = $('#open-quotation').data('quotation');
            if (quotationName) {
                window.open('/app/quotation/' + quotationName, '_blank');
            }
        });

        // Searchable dropdown functionality
        this.initSearchableDropdowns();
    }

    initSearchableDropdowns() {
        // Company searchable dropdown
        this.setupSearchableDropdown('company', '#filter-company-input', '#company-options', '#filter-company');
        
        // Branch searchable dropdown
        this.setupSearchableDropdown('branch', '#filter-branch-input', '#branch-options', '#filter-branch');
        
        // Account Manager searchable dropdown (with multi-select capability)
        this.setupSearchableDropdown('account-manager', '#filter-account-manager-input', '#account-manager-options', '#filter-account-manager');
        
        // Sales Team searchable dropdown
        this.setupSearchableDropdown('sales-team', '#filter-sales-team-input', '#sales-team-options', '#filter-sales-team');
        
        // Status searchable dropdown
        this.setupSearchableDropdown('status', '#filter-status-input', '#status-options', '#filter-status');
    }

    setupSearchableDropdown(dropdownName, inputSelector, optionsSelector, hiddenInputSelector) {
        const input = $(inputSelector);
        const options = $(optionsSelector);
        const hiddenInput = $(hiddenInputSelector);

        // Remove existing event handlers to prevent duplication
        input.off('focus.searchable click.searchable input.searchable keydown.searchable');
        options.off('click.searchable');

        // Show options when input is focused or clicked
        input.on('focus.searchable click.searchable', (e) => {
            e.stopPropagation();
            $('.searchable-options').not(options).hide(); // Hide other dropdowns
            this.positionDropdown(input, options); // Position dropdown correctly
            options.show();
            
            // For multi-select dropdowns, clear the input field and reset search
            if (dropdownName === 'account-manager') {
                input.val(''); // Clear any previous search or placeholder text
            }
            
            // Show all options initially, regardless of current input value
            this.showAllSearchableOptions(dropdownName);
            // Clear any existing 'no results' messages
            options.find('.no-results').remove();
        });

        // Filter options as user types
        input.on('input.searchable', () => {
            const searchTerm = input.val();
            this.filterSearchableOptions(dropdownName, searchTerm);
            if (!options.is(':visible')) {
                this.positionDropdown(input, options);
                options.show();
            }
        });

        // Handle option selection
        options.on('click.searchable', '.searchable-option:not(.no-results)', async (e) => {
            e.stopPropagation();
            const selectedOption = $(e.target);
            const value = selectedOption.data('value');
            const text = selectedOption.text();

            // Check if this is the account manager dropdown for multi-select
            if (dropdownName === 'account-manager') {
                if (value === '') {
                    // "All Managers" selected - clear all selections
                    options.find('.searchable-option').removeClass('multi-selected');
                    hiddenInput.val('');
                    input.val('');
                    $('#selected-managers-display').hide();
                    
                    // Update display and reset placeholder
                    this.updateAccountManagerDisplay();
                    
                    // Apply filters to update the data after clearing selections
                    this.filters.account_incharge = '';
                    this.applyFilters();
                    await this.calculateStats();
                    await this.renderCurrentSection();
                    
                    options.hide();
                } else {
                    // Individual manager selection
                    await this.handleAccountManagerMultiSelect(selectedOption, value, text, hiddenInput);
                }
            } else {
                // Handle single selection for other dropdowns
                if (value === '') {
                    // If "All Branches", "All Managers", or "All Teams" is selected, clear the input and filter
                    input.val('');
                    
                    // Clear team filter if "All Teams" selected
                    if (dropdownName === 'sales-team') {
                        this.filters.sales_team = '';
                        this.applyAdvancedFilters();
                    }
                    
                } else {
                    // Get clean text without HTML highlighting
                    const cleanText = selectedOption.data('original-text') || selectedOption.get(0).textContent || text;
                    input.val(cleanText);
                }
                hiddenInput.val(value);

                // Update visual selection
                options.find('.searchable-option').removeClass('selected');
                selectedOption.addClass('selected');

                // Apply filters immediately for team selection
                if (dropdownName === 'sales-team') {
                    this.filters.sales_team = value;
                    this.applyAdvancedFilters();
                }

                // Hide options
                options.hide();
            }
        });

        // Handle keyboard navigation
        input.on('keydown.searchable', (e) => {
            const allOptions = options.find('.searchable-option:not(.no-results)');
            const currentSelected = allOptions.filter('.selected');
            let newSelected;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (!options.is(':visible')) {
                        options.show();
                        this.filterSearchableOptions(dropdownName, input.val());
                        return;
                    }
                    newSelected = currentSelected.length ? currentSelected.nextAll('.searchable-option:not(.no-results)').first() : allOptions.first();
                    if (newSelected.length) {
                        allOptions.removeClass('selected');
                        newSelected.addClass('selected');
                        this.scrollToOption(options, newSelected);
                    }
                    break;
                
                case 'ArrowUp':
                    e.preventDefault();
                    if (!options.is(':visible')) return;
                    newSelected = currentSelected.length ? currentSelected.prevAll('.searchable-option:not(.no-results)').first() : allOptions.last();
                    if (newSelected.length) {
                        allOptions.removeClass('selected');
                        newSelected.addClass('selected');
                        this.scrollToOption(options, newSelected);
                    }
                    break;
                
                case 'Enter':
                    e.preventDefault();
                    if (options.is(':visible') && currentSelected.length) {
                        currentSelected.click();
                    }
                    break;
                
                case 'Escape':
                    options.hide();
                    input.blur();
                    break;
            }
        });

        // Hide options when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest(`#${dropdownName}-dropdown`).length) {
                options.hide();
            }
        });

        // Reposition dropdown on scroll and resize
        $(window).on('scroll resize', () => {
            if (options.is(':visible')) {
                this.positionDropdown(input, options);
            }
        });

        // Also handle modal scroll
        $('.modal-body, .frappe-control').on('scroll', () => {
            if (options.is(':visible')) {
                this.positionDropdown(input, options);
            }
        });
    }

    positionDropdown(input, options) {
        const inputOffset = input.offset();
        const inputHeight = input.outerHeight();
        const inputWidth = input.outerWidth();
        
        // Always position below the input (force downward)
        const top = inputOffset.top + inputHeight + 1; // Add 1px gap
        const left = inputOffset.left;
        
        options.css({
            'top': top + 'px',
            'left': left + 'px',
            'width': inputWidth + 'px'
        });
    }

    showAllSearchableOptions(dropdownName) {
        const options = $(`#${dropdownName}-options`);
        // Show all options and remove search styling
        options.find('.searchable-option:not(.no-results)')
            .show()
            .removeClass('search-match search-no-match')
            .each(function() {
                // Remove any highlighted text and restore original text
                const originalText = $(this).data('original-text');
                if (originalText) {
                    $(this).html(originalText);
                }
            });
        options.find('.no-results').remove();
    }

    filterSearchableOptions(dropdownName, searchTerm) {
        const options = $(`#${dropdownName}-options`);
        
        // If no search term, show all options without highlighting
        if (!searchTerm || searchTerm.trim() === '') {
            this.showAllSearchableOptions(dropdownName);
            return;
        }
        
        const searchTermLower = searchTerm.toLowerCase();
        let hasMatches = false;

        // First pass: store original text for all options if not already stored
        options.find('.searchable-option:not(.no-results)').each(function() {
            const $option = $(this);
            if (!$option.data('original-text')) {
                // Store the clean text content, removing any existing HTML
                const cleanText = $option.get(0).textContent || $option.text();
                $option.data('original-text', cleanText);
            }
        });

        // Second pass: filter and highlight
        options.find('.searchable-option:not(.no-results)').each((index, element) => {
            const $option = $(element);
            const originalText = $option.data('original-text');
            const optionTextLower = originalText.toLowerCase();
            
            // Always show the option, but style it differently
            $option.show();
            
            if (optionTextLower.includes(searchTermLower)) {
                // Option matches search - highlight it
                $option.removeClass('search-no-match').addClass('search-match');
                
                // Highlight the matching text
                const highlightedText = this.highlightSearchText(originalText, searchTerm);
                $option.html(highlightedText);
                hasMatches = true;
            } else {
                // Option doesn't match - dim it but keep it visible
                $option.removeClass('search-match').addClass('search-no-match');
                $option.html(originalText);
            }
        });

        // Remove any existing "no results" message since we always show all options
        options.find('.no-results').remove();
        
        // If there are no matches, add a subtle indicator at the top
        if (!hasMatches && searchTerm.trim()) {
            options.prepend('<div class="no-results searchable-option" style="color: var(--accent-orange); font-style: italic; cursor: default; background: rgba(245, 158, 11, 0.1); border-bottom: 1px solid var(--accent-orange);">No matches found - showing all options</div>');
        }
    }

    highlightSearchText(text, searchTerm) {
        if (!searchTerm || !text) return text;
        
        const searchTermLower = searchTerm.toLowerCase();
        const textLower = text.toLowerCase();
        const index = textLower.indexOf(searchTermLower);
        
        if (index === -1) return text;
        
        const beforeMatch = text.substring(0, index);
        const match = text.substring(index, index + searchTerm.length);
        const afterMatch = text.substring(index + searchTerm.length);
        
        return beforeMatch + '<span class="search-highlight">' + match + '</span>' + afterMatch;
    }

    scrollToOption(container, option) {
        const containerTop = container.scrollTop();
        const containerHeight = container.height();
        const optionTop = option.position().top;
        const optionHeight = option.outerHeight();

        if (optionTop < 0) {
            container.scrollTop(containerTop + optionTop);
        } else if (optionTop + optionHeight > containerHeight) {
            container.scrollTop(containerTop + optionTop + optionHeight - containerHeight);
        }
    }
    
    // Category filter event handler (legacy - no longer needed with table-based filters)
    setupCategoryFilter() {
        // This function is now handled by the table controls directly
        // Individual table category filters are managed by filterTableByCategory
    }
    
    // Helper function to identify items tables
    isItemsTable(tableId) {
        return ['items-by-count', 'items-by-value', 'low-margin-items'].includes(tableId);
    }
    
    // Helper function to get unique categories from data
    getUniqueCategories(data) {
        const categories = [...new Set(data.map(item => item.category).filter(Boolean))];
        return categories.sort();
    }
    
    // Function to fetch item details from Item doctype
    async fetchItemCategories(itemCodes) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Item',
                    fields: ['item_code', 'category_list', 'is_stock_item'],
                    filters: [
                        ['item_code', 'in', itemCodes]
                    ],
                    limit_page_length: 0  // Get all items
                }
            });
            
            const itemDetails = {};
            if (response.message) {
                response.message.forEach(item => {
                    itemDetails[item.item_code] = {
                        category: item.category_list || 'Uncategorized',
                        is_stock_item: item.is_stock_item || 0
                    };
                });
            }
            
            return itemDetails;
        } catch (error) {
            console.error('Error fetching item details:', error);
            // Return empty object to fallback to defaults
            return {};
        }
    }

    // Function to filter table by category (called from table controls)
    filterTableByCategory(tableId, category) {
        const table = $(`#${tableId}`);
        if (table.length) {
            const rows = table.find('tbody tr');
            
            rows.each(function() {
                const row = $(this);
                const categoryCell = row.find('td').eq(2); // Category is the 3rd column (index 2)
                const rowCategory = categoryCell.text().trim();
                
                if (!category || category === '' || rowCategory === category) {
                    row.show();
                } else {
                    row.hide();
                }
            });
            
            // Update the info text to show filtered count
            const visibleRows = table.find('tbody tr:visible').length;
            const totalRows = table.find('tbody tr').length;
            $(`#${tableId}-info`).text(`Showing ${visibleRows} of ${totalRows} records`);
        }
    }

 // In the loadData() method, add this after processData():
async loadData() {
    try {
        this.showLoading();
        
        // Check if this is a request for all data
        const requestAllData = this.requestAllData || false;
        
        // Debug: Log API parameters being sent
        console.log('API Call Parameters:', {
            from_date: this.filters.from_date,
            to_date: this.filters.to_date,
            company: this.filters.company,
            custom_branch: this.filters.branch,
            status: this.filters.status
        });

        const response = await frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_ldw_quotation_report',
            args: {
                from_date: this.filters.from_date,
                to_date: this.filters.to_date,
                company: this.filters.company ? [this.filters.company] : [],
                custom_branch: this.filters.branch ? [this.filters.branch] : [],
                account_incharge: this.filters.account_incharge ? [this.filters.account_incharge] : [],
                sales_team: this.filters.sales_team ? [this.filters.sales_team] : [],
                created_by: this.filters.created_by ? [this.filters.created_by] : [],
                customer: this.filters.customer,
                status: this.filters.status === 'all' ? null : this.filters.status,
                quotation_to: this.filters.quotation_to,
                amount_min: this.filters.amount_min,
                amount_max: this.filters.amount_max,
                margin_min: this.filters.margin_min,
                margin_max: this.filters.margin_max,
                search_query: this.filters.search_query,
                limit_page_length: requestAllData ? 0 : null, // Only unlimited if explicitly requested
                get_all_data: requestAllData ? 1 : 0 // Explicit flag to get all data
            }
        });

        if (response.message) {
            this.data.quotations = response.message.data || response.message || [];
            
            // Debug: Log API response details
            console.log('API Response:', {
                total_quotations_received: this.data.quotations.length,
                sample_quotation: this.data.quotations[0],
                date_range_of_received_data: this.data.quotations.length > 0 ? {
                    earliest: Math.min(...this.data.quotations.map(q => new Date(q.transaction_date).getTime())),
                    latest: Math.max(...this.data.quotations.map(q => new Date(q.transaction_date).getTime()))
                } : 'No data'
            });
            
            // Debug: Status breakdown of received data
            const apiStatusBreakdown = {};
            this.data.quotations.forEach(q => {
                apiStatusBreakdown[q.status] = (apiStatusBreakdown[q.status] || 0) + 1;
            });
            console.log('API Status Breakdown:', apiStatusBreakdown);
            
            
            // Fix metadata handling
            // Check if filters are applied (excluding default date range)
            const hasFilters = this.filters.company && this.filters.company !== '' || 
                              this.filters.branch && this.filters.branch !== '' || 
                              this.filters.account_incharge && this.filters.account_incharge !== '' || 
                              this.filters.sales_team && this.filters.sales_team !== '' ||
                              this.filters.created_by && this.filters.created_by !== '' || 
                              this.filters.customer || 
                              this.filters.status !== 'all' || 
                              this.filters.amount_min || 
                              this.filters.amount_max || 
                              this.filters.margin_min || 
                              this.filters.margin_max || 
                              this.filters.search_query;

            this.data.metadata = {
                total_count: response.message.total_count || this.data.quotations.length,
                retrieved_count: this.data.quotations.length,
                is_limited: requestAllData ? false : (response.message.is_limited || false),
                has_filters: hasFilters
            };
            
            // Load cancelled quotations data BEFORE processing overview stats
            const cancelledData = await this.loadCancelledQuotations();
            this.cancelledQuotationsData = cancelledData;
            console.log('Loaded cancelled quotations data for overview calculation:', cancelledData);
            
            await this.processData();
            
            // Populate team options after data is processed
            console.log('About to populate team options from loadData...');
            this.populateTeamOptionsFromQuotations();
            
            // Add debugging
            this.debugWorkflowStates(); // Add this line
            
            // Load opportunity data
            await this.loadOpportunityData();
            
            // Load additional doctype data for opportunities section
            await this.loadSiteVisitData();
            await this.loadDesignRequestData();
            await this.loadPermitData();
            
            // Load quotation lost reasons
            await this.loadQuotationLostReasons();
            
            // Populate filter options after data is loaded (for initial load)
            await this.populateFilterOptions();
            
            await this.renderCurrentSection();
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        frappe.msgprint('Failed to load dashboard data');
    } finally {
        this.hideLoading();
    }
}

    async loadCancelledQuotations() {
        try {
            this.showLoading();
            
            const response = await frappe.call({
                method: 'prastara_custom.controller.variant_pricing.get_cancelled_quotations',
                args: {
                    from_date: this.filters.from_date,
                    to_date: this.filters.to_date,
                    company: this.filters.company ? [this.filters.company] : [],
                    custom_branch: this.filters.branch ? [this.filters.branch] : [],
                    account_incharge: this.filters.account_incharge ? [this.filters.account_incharge] : [],
                    customer: this.filters.customer
                }
            });
            
            if (response && response.message) {
                this.data.cancelled_quotations = response.message.data || [];
                console.log('Loaded cancelled quotations:', this.data.cancelled_quotations.length);
                return response.message;
            } else {
                this.data.cancelled_quotations = [];
                return { data: [], total_count: 0 };
            }
        } catch (error) {
            console.error('Failed to load cancelled quotations:', error);
            this.data.cancelled_quotations = [];
            return { data: [], total_count: 0 };
        } finally {
            this.hideLoading();
        }
    }

    async loadSiteVisitData() {
    try {
        // Build filters - date range and branch filter for Site Visit
        let filters = {};
        
        if (this.filters.from_date && this.filters.to_date) {
            filters.creation = ['between', [this.filters.from_date, this.filters.to_date]];
        }
        
        // Add branch filter for Metroplus
        filters.custom_branch = ['like', '%prastara%'];
        
        // Try to get status field, fallback to basic fields if not permitted
        let fields = ['name', 'customer', 'custom_branch', 'creation', 'modified'];
        
        // Try to add status field, but handle gracefully if not permitted
        try {
            const testResponse = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Site Visit',
                    fields: ['name', 'customer', 'custom_branch', 'status', 'creation', 'modified'],
                    filters: filters,
                    limit_page_length: 1,  // Changed from limit
                    order_by: 'creation desc'
                }
            });
            // If successful, use full field list including status
            fields = ['name', 'customer', 'custom_branch', 'status', 'creation', 'modified'];
        } catch (error) {
            console.log('Status field not available for Site Visit, using basic fields');
        }
        
        const response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Site Visit',
                fields: fields,
                filters: filters,
                limit_page_length: 1000,  // Changed from limit
                order_by: 'creation desc'
            }
        });
        
        let siteVisits = response.message || [];
        
        // Apply basic filtering only - remove aggressive company-based filtering
        // This ensures all site visits within the date range are shown
        // Company filtering can be handled differently if needed
        
        this.data.site_visits = siteVisits;
        console.log(`Loaded ${this.data.site_visits.length} site visits filtered for branch: ${this.filters.branch || 'All'}`);
        
        // Optional: Log grouping by status (similar to your Design Request code)
        console.log('Site visits by status:', 
            this.data.site_visits.reduce((acc, visit) => {
                const state = visit.status || 'No Status';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {})
        );
        
        return { data: this.data.site_visits, total_count: this.data.site_visits.length };
    } catch (error) {
        console.error('Failed to load site visit data:', error);
        this.data.site_visits = [];
        return { data: [], total_count: 0 };
    }
}

    async loadDesignRequestData() {
    try {
        // Build filters - date range and branch filter for Design Request
        let filters = {};
        
        if (this.filters.from_date && this.filters.to_date) {
            filters.creation = ['between', [this.filters.from_date, this.filters.to_date]];
        }
        
        // Add branch filter for Metro
        filters.custom_branch = ['like', '%metro%'];
        
        // Try to get workflow_state field, fallback to basic fields if not permitted
        let fields = ['name', 'customer', 'custom_branch', 'creation', 'modified'];
        
        // Try to add workflow_state field, but handle gracefully if not permitted
        try {
            const testResponse = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Design Request',
                    fields: ['name', 'customer', 'custom_branch', 'workflow_state', 'creation', 'owner'],
                    filters: filters,
                    limit_page_length: 1,  // Changed from limit
                    order_by: 'creation desc'
                }
            });
            // If successful, use full field list including workflow_state
            fields = ['name', 'customer', 'custom_branch', 'workflow_state', 'creation', 'owner'];
        } catch (error) {
            console.log('Workflow state field not available for Design Request, using basic fields');
        }
        
        const response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Design Request',
                fields: fields,
                filters: filters,
                limit_page_length: 5000,  // Changed from limit
                order_by: 'creation desc'
            }
        });
        
        let designRequests = response.message || [];
        
        // Apply basic filtering only - remove aggressive company-based filtering
        // This ensures all design requests within the date range are shown
        // Company filtering can be handled differently if needed
        
        this.data.design_requests = designRequests;
        console.log(`Loaded ${this.data.design_requests.length} design requests with filters:`, filters);
        console.log('Sample design request:', this.data.design_requests[0]);
        console.log('Design requests by workflow state:', 
            this.data.design_requests.reduce((acc, req) => {
                const state = req.workflow_state || 'No State';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {})
        );
        return { data: this.data.design_requests, total_count: this.data.design_requests.length };
    } catch (error) {
        console.error('Failed to load design request data:', error);
        this.data.design_requests = [];
        return { data: [], total_count: 0 };
    }
}
    async loadPermitData() {
    try {
        // Build filters - posting date and company filter for Permit
        let filters = {};
        
        if (this.filters.from_date && this.filters.to_date) {
            filters.posting_date = ['between', [this.filters.from_date, this.filters.to_date]];
        }
        
        // Add company filter for METROPLUS ADVERTISING LLC
        filters.company = ['like', '%PRASTARA DECORATION DESIGN L.L.C%'];
        
        const response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Permit Form',
                fields: ['name', 'customer', 'company', 'workflow_state', 'posting_date', 'creation', 'modified'],
                filters: filters,
                limit_page_length: 1000,  // Changed from limit
                order_by: 'posting_date desc'
            }
        });
        
        let permits = response.message || [];
        
        // Filter by company through relationship with opportunities/quotations if company filter is applied
        if (this.filters.company && this.data.opportunities && this.data.opportunities.length > 0) {
            // Get customers from filtered opportunities
            const companyCustomers = new Set(
                this.data.opportunities
                    .filter(opp => !this.filters.company || opp.company === this.filters.company)
                    .map(opp => opp.customer_name || opp.party_name)
            );
            
            // Filter permits to only those customers
            permits = permits.filter(permit => 
                companyCustomers.has(permit.customer)
            );
        }
        
        this.data.permits = permits;
        console.log(`Loaded ${this.data.permits.length} permits filtered for company: ${this.filters.company || 'All'}`);
        
        // Optional: Log grouping by workflow_state (similar to your Design Request code)
        console.log('Permits by workflow state:', 
            this.data.permits.reduce((acc, permit) => {
                const state = permit.workflow_state || 'No State';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {})
        );
        
        return { data: this.data.permits, total_count: this.data.permits.length };
    } catch (error) {
        console.error('Failed to load permit data:', error);
        this.data.permits = [];
        return { data: [], total_count: 0 };
    }
}
    async loadOpportunityData() {
        try {
            const response = await frappe.call({
                method: 'prastara_custom.controller.variant_pricing.get_opportunity_report',
                args: {
                    from_date: this.filters.from_date,
                    to_date: this.filters.to_date,
                    company: this.filters.company ? [this.filters.company] : [],
                    custom_branch: this.filters.branch ? [this.filters.branch] : [],
                    account_incharge: this.filters.account_incharge ? [this.filters.account_incharge] : [],
                    customer: this.filters.customer,
                    status: this.filters.status === 'all' ? null : this.filters.status
                }
            });
            
            if (response && response.message) {
                this.data.opportunities = response.message.data || [];
                console.log('Loaded opportunities:', this.data.opportunities.length);
                if (this.data.opportunities.length > 0) {
                    console.log('Sample opportunity:', this.data.opportunities[0]);
                }
                
                // Process opportunity data to link with quotations
                this.processOpportunityData();
                
                return response.message;
            } else {
                this.data.opportunities = [];
                return { data: [], total_count: 0 };
            }
        } catch (error) {
            console.error('Failed to load opportunity data:', error);
            this.data.opportunities = [];
            return { data: [], total_count: 0 };
        }
    }

    async loadQuotationLostReasons() {
        try {
            // Fetch all lost quotations with their reasons
            const lostQuotationsResponse = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Quotation',
                    filters: {
                        status: 'Lost',
                        creation: ['between', [this.filters.from_date, this.filters.to_date]]
                    },
                    fields: ['name', 'custom_lost_reason', 'grand_total'],
                    limit_page_length: 0
                }
            });

            // Fetch standardized reasons from Quotation Lost Reason doctype (only active ones)
            const reasonsResponse = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Quotation Lost Reason',
                    fields: ['name', 'order_lost_reason'],
                    filters: {
                        custom_disabled: 0
                    },
                    limit_page_length: 0
                }
            });

            const lostQuotations = lostQuotationsResponse.message || [];
            const standardReasons = reasonsResponse.message || [];
            
            // Create a map of reason names to standardized reasons
            const reasonMap = {};
            standardReasons.forEach(reason => {
                reasonMap[reason.name] = reason.order_lost_reason;
            });

            // Group lost quotations by standardized reasons
            const reasonCounts = {};
            const reasonValues = {};
            
            // Initialize with all standard reasons
            standardReasons.forEach(reason => {
                reasonCounts[reason.order_lost_reason] = 0;
                reasonValues[reason.order_lost_reason] = 0;
            });
            
            // Count quotations by reason
            lostQuotations.forEach(quotation => {
                const standardReason = reasonMap[quotation.custom_lost_reason] || 'Other';
                if (reasonCounts.hasOwnProperty(standardReason)) {
                    reasonCounts[standardReason]++;
                    reasonValues[standardReason] += (quotation.grand_total || 0);
                } else {
                    // Handle unmapped reasons
                    if (!reasonCounts['Other']) {
                        reasonCounts['Other'] = 0;
                        reasonValues['Other'] = 0;
                    }
                    reasonCounts['Other']++;
                    reasonValues['Other'] += (quotation.grand_total || 0);
                }
            });

            this.data.lost_quotation_reasons = {
                reasons: standardReasons,
                counts: reasonCounts,
                values: reasonValues,
                total_lost: lostQuotations.length
            };

            console.log('Loaded lost quotation reasons:', this.data.lost_quotation_reasons);
            return this.data.lost_quotation_reasons;
            
        } catch (error) {
            console.error('Failed to load quotation lost reasons:', error);
            this.data.lost_quotation_reasons = {
                reasons: [],
                counts: {},
                values: {},
                total_lost: 0
            };
            return this.data.lost_quotation_reasons;
        }
    }

    processOpportunityData() {
        // Calculate opportunity statistics grouped by status
        this.data.opportunity_stats = {
            total: this.data.opportunities.length,
            by_status: {},
            quoted: 0,
            not_quoted: 0,
            quoted_opportunities: [],
            not_quoted_opportunities: []
        };

        // Group opportunities by status
        this.data.opportunities.forEach(opp => {
            const status = opp.status || 'Open';
            
            // Map specific statuses for grouping
            let groupedStatus = status;
            if (status.toLowerCase() === 'quotation') {
                groupedStatus = 'Quotation';
            } else if (status.toLowerCase() === 'lost') {
                groupedStatus = 'Lost';
            } else if (status.toLowerCase() === 'converted') {
                groupedStatus = 'Converted';
            } else if (status.toLowerCase() === 'overdue') {
                groupedStatus = 'Overdue';
            } else {
                groupedStatus = 'Open';
            }
            
            if (!this.data.opportunity_stats.by_status[groupedStatus]) {
                this.data.opportunity_stats.by_status[groupedStatus] = {
                    count: 0,
                    opportunities: []
                };
            }
            
            this.data.opportunity_stats.by_status[groupedStatus].count++;
            this.data.opportunity_stats.by_status[groupedStatus].opportunities.push(opp);
            
            // Check if this opportunity has quotations using the opportunity field in quotations
            const relatedQuotes = this.data.quotations.filter(quote => 
                quote.opportunity === opp.name  // Primary link through opportunity field
            );
            
            if (relatedQuotes.length > 0) {
                this.data.opportunity_stats.quoted++;
                opp.quotations = relatedQuotes;
                opp.quotation_count = relatedQuotes.length;
                this.data.opportunity_stats.quoted_opportunities.push(opp);
            } else {
                this.data.opportunity_stats.not_quoted++;
                opp.quotation_count = 0;
                this.data.opportunity_stats.not_quoted_opportunities.push(opp);
            }
        });

        console.log('Opportunity stats:', this.data.opportunity_stats);
        
        // Debug quotation-opportunity linking
        const quotationsWithOpportunity = this.data.quotations.filter(q => q.opportunity);
        console.log(`Found ${quotationsWithOpportunity.length} quotations with opportunity field out of ${this.data.quotations.length} total quotations`);
        if (quotationsWithOpportunity.length > 0) {
            console.log('Sample quotation with opportunity:', quotationsWithOpportunity[0]);
        }
    }

    async processData() {
        // Add calculated fields
        this.data.quotations = this.data.quotations.map(quote => {
            quote.pipeline = this.calculatePipeline(quote);
            quote.days_since_created = Math.ceil((new Date() - new Date(quote.transaction_date)) / (1000 * 60 * 60 * 24));
            quote.days_to_expiry = Math.ceil((new Date(quote.valid_till) - new Date()) / (1000 * 60 * 60 * 24));
            return quote;
        });
        
        this.applyFilters();
        await this.calculateStats();
    }

calculatePipeline(quote) {
    // Get workflow state and handle various cases
    const workflowState = quote.workflow_state;
    
    // If no workflow state, return None
    if (!workflowState || workflowState === null || workflowState === undefined || workflowState === '') {
        return 'None';
    }
    
    // Trim and normalize the workflow state
    const normalizedState = workflowState.toString().trim();
    
    // Only map exact Pipeline A, B, C workflow states
    // Everything else goes to "No Pipeline"
    if (normalizedState === 'Pipeline A') {
        return 'A';
    }
    if (normalizedState === 'Pipeline B') {
        return 'B';
    }
    if (normalizedState === 'Pipeline C') {
        return 'C';
    }
    
    // All other workflow states go to None (No Pipeline)
    return 'None';
}

    applyFilters() {
        console.log('applyFilters called - account_incharge filter:', this.filters.account_incharge);
        console.log('applyFilters called - total quotations:', this.data.quotations ? this.data.quotations.length : 'undefined');
        
        this.data.filtered = this.data.quotations.filter(quote => {
            // Search filter
            if (this.filters.search_query && this.filters.search_query.trim()) {
                const searchTerm = this.filters.search_query.toLowerCase();
                const searchableText = [
                    quote.quotation,
                    quote.customer_name,
                    quote.party_name,
                    quote.account_incharge,
                    quote.account_incharge_full_name,
                    quote.project_description,
                    quote.status,
                    quote.workflow_state,
                    quote.custom_sales_team
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }
            
            // Account Manager filter (multiple selection using "in" logic)
            if (this.filters.account_incharge && this.filters.account_incharge !== '') {
                const selectedManagers = this.filters.account_incharge.split(',').map(m => m.trim()).filter(Boolean);
                
                // Debug logging
                console.log('Filter Debug - Selected managers:', selectedManagers);
                console.log('Filter Debug - Quote account_incharge:', quote.account_incharge);
                console.log('Filter Debug - Is match?', selectedManagers.includes(quote.account_incharge));
                
                // Show quotations where account_incharge is IN the selected managers list
                if (selectedManagers.length > 0 && !selectedManagers.includes(quote.account_incharge)) {
                    return false;
                }
            }
            
            // Sales Team filter - check if quotation's team field matches selected team
            if (this.filters.sales_team && this.filters.sales_team !== '') {
                const teamFieldName = this.teamFieldName || 'custom_sales_team';
                if (quote[teamFieldName] !== this.filters.sales_team) {
                    return false;
                }
            }
            
            return true;
        });
    }

    async calculateStats() {
        console.log('calculateStats called - this.data.filtered length:', this.data.filtered ? this.data.filtered.length : 'undefined');
        const data = this.data.filtered;
        
        // Overview Stats
        this.data.stats.overview = this.calculateOverviewStats(data);
        
        // Pipeline Stats - Fixed to only include pending quotations
        this.data.stats.pipeline = this.calculatePipelineStats(data);
        
        // Conversion Stats
        this.data.stats.conversion = this.calculateConversionStats(data);
        
        // Margin Stats
        this.data.stats.margin = this.calculateMarginStats(data);
        
        // Items Stats (now async)
        this.data.stats.items = await this.calculateItemsStats(data);
        
        // Follow-up Stats
        this.data.stats.followup = this.calculateFollowupStats(data);
        
        // Customer Stats - Enhanced
        this.data.stats.customers = this.calculateCustomerStats(data);
    }
    

    calculateOverviewStats(data) {
    // Debug: Log current date range and total data count
    console.log(`Date Range: ${this.filters.from_date} to ${this.filters.to_date}`);
    console.log(`Total quotations in filtered data: ${data.length}`);
    
    // DEBUG: Check for cancelled status fields and values
    console.log('=== DEBUGGING CANCELLED STATUS ===');
    const cancelledStatusFields = new Set();
    const cancelledStatusValues = new Set();
    
    data.forEach((q, index) => {
        // Check all possible field names that might contain cancelled status
        Object.keys(q).forEach(key => {
            if (key.toLowerCase().includes('cancel') || key.toLowerCase().includes('cancell')) {
                cancelledStatusFields.add(key);
                if (q[key]) {
                    cancelledStatusValues.add(`${key}: "${q[key]}"`);
                    if (index < 5) { // Log first 5 for debugging
                        console.log(`Row ${index}: ${key} = "${q[key]}"`);
                    }
                }
            }
        });
    });
    
    console.log('Found cancelled-related fields:', Array.from(cancelledStatusFields));
    console.log('Found cancelled-related values:', Array.from(cancelledStatusValues));
    
    // Calculate counts based on STATUS (simplified logic as requested)
    const wonQuotes = data.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status));
    const lostQuotes = data.filter(q => q.status === 'Lost');
    const draftQuotes = data.filter(q => q.status === 'Draft');
    const pendingQuotes = data.filter(q => ['Open', 'Expired'].includes(q.status));
    const openQuotes = data.filter(q => q.status === 'Open');
    const expiredQuotes = data.filter(q => q.status === 'Expired');
    
    // Use cached cancelled quotations data if available, otherwise try to filter from main data
    let cancelledNotAmendedQuotes = [];
    
    if (this.cancelledQuotationsData && this.cancelledQuotationsData.data) {
        cancelledNotAmendedQuotes = this.cancelledQuotationsData.data || [];
        console.log(`Overview section: Using cached cancelled data: ${cancelledNotAmendedQuotes.length} quotes`);
        console.log(`Overview section: Cancelled data structure:`, this.cancelledQuotationsData);
        console.log(`Overview section: Sample cancelled quotes:`, cancelledNotAmendedQuotes.slice(0, 2));
    } else {
        // Fallback: try to filter from main data if cached data not available
        console.log('No cached cancelled data, trying to filter from main data');
        cancelledNotAmendedQuotes = data.filter(q => {
            const cancelStatus = q.custom_cancel_status || q.custom_cancell_status;
            
            if (!cancelStatus) return false;
            
            // Check for exact match with the value used in the detailed section
            const possibleValues = [
                'Cancelled But Not Amended',
                'cancelled but not amended',
                'Cancelled but not amended',
                'CANCELLED BUT NOT AMENDED'
            ];
            
            return possibleValues.some(value => 
                cancelStatus.toString().trim().toLowerCase() === value.toLowerCase()
            );
        });
        
        if (cancelledNotAmendedQuotes.length === 0) {
            console.log('No cancelled quotes found in main data either, will show 0');
        }
    }
    
    // Additional debugging for cancelled quotes
    console.log(`Cancelled but not amended quotes found: ${cancelledNotAmendedQuotes.length}`);
    if (cancelledNotAmendedQuotes.length > 0) {
        console.log('Sample cancelled quotes:', cancelledNotAmendedQuotes.slice(0, 3).map(q => ({
            id: q.id || q.quote_id,
            status: q.status,
            custom_cancel_status: q.custom_cancel_status,
            custom_cancell_status: q.custom_cancell_status,
            all_cancel_fields: Object.keys(q).filter(k => k.toLowerCase().includes('cancel')).reduce((obj, k) => {
                obj[k] = q[k];
                return obj;
            }, {})
        })));
    }
    
    // Debug: Log status-wise breakdown
    const statusCount = {};
    data.forEach(q => {
        statusCount[q.status] = (statusCount[q.status] || 0) + 1;
    });
    console.log('Status-wise breakdown:', statusCount);
    
    // Value range analysis for pending quotes
    const valueRanges = {
        '0-10K': { min: 0, max: 10000, quotes: [], count: 0, amount: 0 },
        '10K-25K': { min: 10000, max: 25000, quotes: [], count: 0, amount: 0 },
        '25K-50K': { min: 25000, max: 50000, quotes: [], count: 0, amount: 0 },
        '50K-100K': { min: 50000, max: 100000, quotes: [], count: 0, amount: 0 },
        '100K+': { min: 100000, max: Infinity, quotes: [], count: 0, amount: 0 }
    };
    
    pendingQuotes.forEach(quote => {
        const amount = quote.base_grand_total || 0;
        Object.keys(valueRanges).forEach(range => {
            const rangeConfig = valueRanges[range];
            if (amount >= rangeConfig.min && amount < rangeConfig.max) {
                rangeConfig.quotes.push(quote);
                rangeConfig.count++;
                rangeConfig.amount += amount;
            }
        });
    });
    
    // Additional workflow-based filter (NOT included in total)
    const pendingDeptApprovalQuotes = data.filter(q =>
        q.workflow_state === 'Pending Dept Approval' &&
        !['Partially Ordered', 'Lost', 'Cancelled', 'Expired'].includes(q.status)
    );
    
    // Calculate total: Won + Lost + Draft + Pending + Cancelled (NOT including Pending Dept Approval)
    const newTotalCount = wonQuotes.length + lostQuotes.length + draftQuotes.length + pendingQuotes.length + cancelledNotAmendedQuotes.length;
    const newTotalAmount = wonQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) +
                          lostQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) +
                          draftQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) +
                          pendingQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) +
                          cancelledNotAmendedQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0);

    console.log('=== FINAL COUNTS ===');
    console.log(`Won: ${wonQuotes.length}, Lost: ${lostQuotes.length}, Draft: ${draftQuotes.length}`);
    console.log(`Pending: ${pendingQuotes.length}, Cancelled: ${cancelledNotAmendedQuotes.length}`);
    console.log(`Total: ${newTotalCount}`);

    return {
        total: {
            count: newTotalCount,
            amount: newTotalAmount
        },
        won: {
            count: wonQuotes.length,
            amount: wonQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        pending: {
            count: pendingQuotes.length,
            amount: pendingQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        open: {
            count: openQuotes.length,
            amount: openQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        expired: {
            count: expiredQuotes.length,
            amount: expiredQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        lost: {
            count: lostQuotes.length,
            amount: lostQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        draft: {
            count: draftQuotes.length,
            amount: draftQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        pendingDeptApproval: {
            count: pendingDeptApprovalQuotes.length,
            amount: pendingDeptApprovalQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        // New cancelled but not amended stats
        cancelledNotAmended: {
            count: cancelledNotAmendedQuotes.length,
            amount: cancelledNotAmendedQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        },
        valueRanges: valueRanges,
        statusWise: this.calculateStatusWiseBreakdown(data)
    };
}

    calculateStatusWiseBreakdown(data) {
        const statuses = [...new Set(data.map(q => q.status))];
        
        return statuses.map(status => {
            const filtered = data.filter(q => q.status === status);
            return {
                status,
                count: filtered.length,
                amount: filtered.reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
                percentage: data.length > 0 ? (filtered.length / data.length * 100).toFixed(1) : 0
            };
        });
    }

calculatePipelineStats(data) {
    // Reset pipelines
    Object.keys(this.data.pipelines).forEach(key => {
        this.data.pipelines[key].quotes = [];
        this.data.pipelines[key].value = 0;
    });
    
    console.log('Calculating pipeline stats for', data.length, 'quotations');
    
    // Exclude specific statuses from pipeline calculations
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    const pipelineEligibleData = data.filter(quote => {
        return !excludedStatuses.includes(quote.status);
    });
    
    console.log('Status exclusion check:');
    console.log('Total input data:', data.length);
    console.log('After excluding statuses:', pipelineEligibleData.length);
    console.log('Excluded statuses:', excludedStatuses);
    
    // Sample the first few quotations to debug
    console.log('Sample of first 5 quotations:');
    data.slice(0, 5).forEach(q => {
        console.log(`- ${q.quotation}: status="${q.status}", workflow_state="${q.workflow_state}"`);
    });
    
    // Show quotations that have 'Pipeline A' workflow state specifically
    const pipelineAWorkflowQuotes = data.filter(q => q.workflow_state === 'Pipeline A');
    console.log('Quotations with "Pipeline A" workflow state:', pipelineAWorkflowQuotes.length);
    pipelineAWorkflowQuotes.forEach(q => {
        console.log(`- ${q.quotation}: status="${q.status}", workflow_state="${q.workflow_state}"`);
    });
    
    console.log('After excluding statuses:', pipelineEligibleData.length, 'quotations eligible for pipeline');
    
    // Consider quotations that have pipeline workflow states from the eligible data
    const quotationsWithPipeline = pipelineEligibleData.filter(quote => {
        const pipeline = this.calculatePipeline(quote);
        return pipeline !== 'None';
    });
    
    console.log('Found', quotationsWithPipeline.length, 'quotations with pipeline workflow states');
    
    // Include quotations that don't have pipeline states from eligible data
    const quotesWithoutPipeline = pipelineEligibleData.filter(quote => {
        return this.calculatePipeline(quote) === 'None';
    });
    
    console.log('Found', quotesWithoutPipeline.length, 'quotations without pipeline states');
    
    // Process all quotations with pipeline states
    let pipelineACandidates = [];
    quotationsWithPipeline.forEach(quote => {
        const pipeline = this.calculatePipeline(quote);
        
        if (pipeline === 'A') {
            pipelineACandidates.push({
                quotation: quote.quotation,
                status: quote.status,
                workflow_state: quote.workflow_state,
                pipeline: pipeline
            });
        }
        
        console.log(`Quote ${quote.quotation}: status=${quote.status}, pipeline=${pipeline}, workflow_state="${quote.workflow_state}"`);
        
        if (this.data.pipelines[pipeline]) {
            this.data.pipelines[pipeline].quotes.push(quote);
            this.data.pipelines[pipeline].value += quote.base_grand_total || 0;
        }
    });
    
    // Add ALL quotations without pipeline to 'None' category
    quotesWithoutPipeline.forEach(quote => {
        this.data.pipelines['None'].quotes.push(quote);
        this.data.pipelines['None'].value += quote.base_grand_total || 0;
    });
    
    console.log('=== PIPELINE A DEBUG ===');
    console.log('Pipeline A candidates found:', pipelineACandidates.length);
    console.log('Pipeline A details:', pipelineACandidates);
    console.log('Final Pipeline A count:', this.data.pipelines['A'].quotes.length);
    console.log('========================');
    
    // Log final pipeline stats
    Object.keys(this.data.pipelines).forEach(key => {
        console.log(`Pipeline ${key}: ${this.data.pipelines[key].quotes.length} quotes, AED ${this.formatCurrency(this.data.pipelines[key].value)} value`);
    });
    
    return this.data.pipelines;
}

    calculateConversionStats(data) {
        const wonStatuses = ['Ordered', 'Partially Ordered'];
        
        return {
            companyWise: this.calculateConversionByField(data, 'company', wonStatuses),
            branchWise: this.calculateConversionByField(data, 'custom_branch', wonStatuses),
            accountInchargeWise: this.calculateConversionByField(data, 'account_incharge', wonStatuses, 'account_incharge_full_name'),
            ownerWise: this.calculateConversionByField(data, 'owner', wonStatuses, 'owner_full_name')
        };
    }

    calculateConversionByField(data, field, wonStatuses, nameField = null) {
        const groups = {};
        
        data.forEach(quote => {
            const key = quote[field] || 'Unknown';
            const displayName = nameField ? (quote[nameField] || key) : key;
            
            if (!groups[key]) {
                groups[key] = {
                    name: displayName,
                    total_count: 0,
                    total_amount: 0,
                    won_count: 0,
                    won_amount: 0
                };
            }
            
            groups[key].total_count++;
            groups[key].total_amount += quote.base_grand_total || 0;
            
            if (wonStatuses.includes(quote.status)) {
                groups[key].won_count++;
                groups[key].won_amount += quote.base_grand_total || 0;
            }
        });
        
        return Object.values(groups).map(group => ({
            ...group,
            conversion_rate: group.total_count > 0 ? (group.won_count / group.total_count * 100).toFixed(1) : 0,
            conversion_amount_rate: group.total_amount > 0 ? (group.won_amount / group.total_amount * 100).toFixed(1) : 0
        })).sort((a, b) => parseFloat(b.conversion_rate) - parseFloat(a.conversion_rate));
    }

    calculateMarginStats(data) {
        const marginData = data.map(quote => ({
            ...quote,
            margin_amount: quote.expected_profit || 0,
            margin_percentage: quote.profit_percentage || 0
        })).filter(q => q.margin_percentage !== null);
        
        const sortedByMargin = [...marginData].sort((a, b) => parseFloat(b.margin_percentage) - parseFloat(a.margin_percentage));
        const lowMarginQuotes = marginData.filter(q => parseFloat(q.margin_percentage) < 15);
        
        // Branch-wise margin analysis
        const branchMargins = this.calculateMarginByField(marginData, 'custom_branch');
        
        // Account manager-wise margin analysis
        const accountManagerMargins = this.calculateMarginByField(marginData, 'account_incharge', 'account_incharge_full_name');
        
        return {
            all: marginData,
            sorted: sortedByMargin,
            lowMargin: lowMarginQuotes,
            avgMargin: marginData.length > 0 ? 
                (marginData.reduce((sum, q) => sum + parseFloat(q.margin_percentage), 0) / marginData.length).toFixed(1) : 0,
            branchWise: branchMargins,
            accountManagerWise: accountManagerMargins
        };
    }
    
    calculateMarginByField(data, field, nameField = null) {
        const groups = {};
        
        data.forEach(quote => {
            const key = quote[field] || 'Unknown';
            const displayName = nameField ? (quote[nameField] || key) : key;
            
            if (!groups[key]) {
                groups[key] = {
                    name: displayName,
                    total_quotes: 0,
                    total_amount: 0,
                    total_margin_amount: 0,
                    margins: []
                };
            }
            
            groups[key].total_quotes++;
            groups[key].total_amount += quote.base_grand_total || 0;
            groups[key].total_margin_amount += quote.margin_amount || 0;
            groups[key].margins.push(parseFloat(quote.margin_percentage) || 0);
        });
        
        return Object.values(groups).map(group => ({
            ...group,
            avg_margin: group.margins.length > 0 ? 
                (group.margins.reduce((sum, m) => sum + m, 0) / group.margins.length).toFixed(1) : 0,
            margin_percentage: group.total_amount > 0 ? 
                ((group.total_margin_amount / group.total_amount) * 100).toFixed(1) : 0
        })).sort((a, b) => parseFloat(b.avg_margin) - parseFloat(a.avg_margin));
    }

    async calculateItemsStats(data) {
        const itemMap = new Map();
        const itemCodes = new Set();
        
        // First pass: collect all unique item codes
        data.forEach(quote => {
            if (quote.items) {
                quote.items.forEach(item => {
                    itemCodes.add(item.item_code);
                });
            }
        });
        
        // Fetch item details from Item doctype
        const itemDetails = await this.fetchItemCategories(Array.from(itemCodes));
        
        data.forEach(quote => {
            if (quote.items) {
                quote.items.forEach(item => {
                    const key = item.item_code;
                    if (!itemMap.has(key)) {
                        const itemInfo = itemDetails[item.item_code] || { category: 'Uncategorized', is_stock_item: 0 };
                        itemMap.set(key, {
                            item_code: item.item_code,
                            brand: item.brand,
                            image: item.image,
                            category: itemInfo.category,
                            is_stock_item: itemInfo.is_stock_item,
                            total_qty: 0,
                            total_value: 0,
                            total_cost: 0,
                            quote_count: 0,
                            quotes: [],
                            avg_margin: 0,
                            total_margin: 0
                        });
                    }
                    
                    const itemData = itemMap.get(key);
                    itemData.total_qty += item.qty || 0;
                    itemData.total_value += item.amount || 0;
                    itemData.total_cost += (item.standard_buying || 0) * (item.qty || 0);
                    itemData.quote_count++;
                    itemData.quotes.push(quote.quotation);
                    
                    const itemMargin = item.rate && item.standard_buying ? 
                        ((item.rate - item.standard_buying) / item.rate * 100) : 0;
                    itemData.total_margin += itemMargin;
                });
            }
        });
        
        const itemsArray = Array.from(itemMap.values()).map(item => ({
            ...item,
            avg_margin: item.quote_count > 0 ? (item.total_margin / item.quote_count).toFixed(1) : 0,
            avg_cost: item.total_qty > 0 ? item.total_cost / item.total_qty : 0,
            total_profit: item.total_value - item.total_cost
        }));
        
        // Calculate category statistics
        const categoryStats = {};
        itemsArray.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    name: category,
                    item_count: 0,
                    total_value: 0,
                    total_quotes: 0
                };
            }
            categoryStats[category].item_count++;
            categoryStats[category].total_value += item.total_value;
            categoryStats[category].total_quotes += item.quote_count;
        });
        
        // Find top category by item count
        const categoriesByCount = Object.values(categoryStats).sort((a, b) => b.item_count - a.item_count);
        const topCategoryByCount = categoriesByCount[0] || { name: 'None', item_count: 0 };
        
        // Filter stock items only (is_stock_item = 1)
        const stockItems = itemsArray.filter(item => item.is_stock_item === 1);
        
        // Calculate most popular stock item for the card
        const mostPopularStockItem = stockItems.length > 0 ? 
            [...stockItems].sort((a, b) => b.quote_count - a.quote_count)[0] : 
            { item_code: 'N/A', quote_count: 0 };
        
        return {
            all: itemsArray,
            stockItems: stockItems,
            mostQuotedByCount: [...itemsArray].sort((a, b) => b.quote_count - a.quote_count).slice(0, 20),
            mostQuotedStockByCount: [...stockItems].sort((a, b) => b.quote_count - a.quote_count).slice(0, 20),
            mostQuotedByValue: [...itemsArray].sort((a, b) => b.total_value - a.total_value).slice(0, 20),
            lowMarginItems: itemsArray.filter(item => parseFloat(item.avg_margin) < 15)
                .sort((a, b) => parseFloat(a.avg_margin) - parseFloat(b.avg_margin)),
            categoryStats: categoriesByCount,
            topCategoryByCount: topCategoryByCount,
            mostPopularStockItem: mostPopularStockItem
        };
    }

    calculateFollowupStats(data) {
        const noFollowups = data.filter(q => !q.followups || q.followups.length === 0);
        const needFollowup = data.filter(q => {
            if (q.status !== 'Open') return false;
            
            const validTill = new Date(q.valid_till);
            const today = new Date();
            const daysToExpiry = Math.ceil((validTill - today) / (1000 * 60 * 60 * 24));
            
            if (daysToExpiry <= 7) return true;
            
            if (!q.followups || q.followups.length === 0) return true;
            
            const lastFollowup = new Date(q.followups[q.followups.length - 1].followup_date_time);
            const daysSinceLastFollowup = Math.ceil((today - lastFollowup) / (1000 * 60 * 60 * 24));
            
            return daysSinceLastFollowup > 5;
        });
        
        return {
            noFollowups,
            needFollowup,
            totalPendingValue: noFollowups.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) +
                             needFollowup.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
        };
    }

    // Enhanced customer stats with more insights
    calculateCustomerStats(data) {
        const customerMap = new Map();
        
        data.forEach(quote => {
            const customerKey = quote.customer_name || quote.party_name || 'Unknown';
            
            if (!customerMap.has(customerKey)) {
                customerMap.set(customerKey, {
                    name: customerKey,
                    total_quotes: 0,
                    total_value: 0,
                    won_quotes: 0,
                    won_value: 0,
                    pending_quotes: 0,
                    pending_value: 0,
                    lost_quotes: 0,
                    lost_value: 0,
                    avg_margin: 0,
                    last_quote_date: null,
                    first_quote_date: null,
                    quotes: [],
                    avg_quote_value: 0,
                    days_since_last_quote: 0,
                    customer_lifetime_days: 0
                });
            }
            
            const customer = customerMap.get(customerKey);
            customer.total_quotes++;
            customer.total_value += quote.base_grand_total || 0;
            customer.quotes.push(quote);
            
            if (['Ordered', 'Partially Ordered'].includes(quote.status)) {
                customer.won_quotes++;
                customer.won_value += quote.base_grand_total || 0;
            } else if (['Open', 'Expired'].includes(quote.status)) {
                customer.pending_quotes++;
                customer.pending_value += quote.base_grand_total || 0;
            } else if (quote.status === 'Lost') {
                customer.lost_quotes++;
                customer.lost_value += quote.base_grand_total || 0;
            }
            
            // Track first and last quote dates
            const quoteDate = new Date(quote.transaction_date);
            if (!customer.last_quote_date || quoteDate > new Date(customer.last_quote_date)) {
                customer.last_quote_date = quote.transaction_date;
            }
            if (!customer.first_quote_date || quoteDate < new Date(customer.first_quote_date)) {
                customer.first_quote_date = quote.transaction_date;
            }
        });
        
        const customersArray = Array.from(customerMap.values()).map(customer => {
            customer.conversion_rate = customer.total_quotes > 0 ? 
                (customer.won_quotes / customer.total_quotes * 100).toFixed(1) : 0;
            
            const totalMargin = customer.quotes.reduce((sum, q) => sum + (parseFloat(q.profit_percentage) || 0), 0);
            customer.avg_margin = customer.quotes.length > 0 ? 
                (totalMargin / customer.quotes.length).toFixed(1) : 0;
                
            customer.avg_quote_value = customer.total_quotes > 0 ? 
                (customer.total_value / customer.total_quotes) : 0;
                
            // Calculate days since last quote
            if (customer.last_quote_date) {
                customer.days_since_last_quote = Math.ceil(
                    (new Date() - new Date(customer.last_quote_date)) / (1000 * 60 * 60 * 24)
                );
            }
            
            // Calculate customer lifetime in days
            if (customer.first_quote_date && customer.last_quote_date) {
                customer.customer_lifetime_days = Math.ceil(
                    (new Date(customer.last_quote_date) - new Date(customer.first_quote_date)) / (1000 * 60 * 60 * 24)
                );
            }
            
            return customer;
        });
        
        // Customer segmentation
        const segments = this.calculateCustomerSegmentation(customersArray);
        
        return {
            all: customersArray,
            top_by_value: [...customersArray].sort((a, b) => b.total_value - a.total_value).slice(0, 10),
            top_by_count: [...customersArray].sort((a, b) => b.total_quotes - a.total_quotes).slice(0, 10),
            top_by_conversion: [...customersArray]
                .filter(c => c.total_quotes >= 3)
                .sort((a, b) => parseFloat(b.conversion_rate) - parseFloat(a.conversion_rate))
                .slice(0, 10),
            segments: segments,
            insights: this.calculateCustomerInsights(customersArray)
        };
    }
    // Add this method to help debug workflow states
debugWorkflowStates() {
    console.log('=== PIPELINE DEBUG START ===');
    console.log('Total quotations loaded:', this.data.quotations.length);
    
    // Check all quotations
    const allStatuses = [...new Set(this.data.quotations.map(q => q.status))];
    console.log('All statuses found:', allStatuses);
    
    const openQuotes = this.data.quotations.filter(q => q.status === 'Open');
    console.log('Open quotations count:', openQuotes.length);
    
    // Check workflow states for open quotations
    const workflowStates = [...new Set(openQuotes.map(q => q.workflow_state).filter(Boolean))];
    console.log('Workflow states for Open quotations:', workflowStates);
    
    // Check for undefined/null workflow states
    const quotesWithoutWorkflow = openQuotes.filter(q => !q.workflow_state);
    console.log('Open quotes without workflow_state:', quotesWithoutWorkflow.length);
    
    // Detailed breakdown
    openQuotes.forEach(quote => {
        console.log(`Quote: ${quote.quotation} | Status: ${quote.status} | Workflow: "${quote.workflow_state}" | Calculated Pipeline: ${this.calculatePipeline(quote)}`);
    });
    
    // Final pipeline distribution
    const pipelineDistribution = {
        A: openQuotes.filter(q => this.calculatePipeline(q) === 'A').length,
        B: openQuotes.filter(q => this.calculatePipeline(q) === 'B').length,
        C: openQuotes.filter(q => this.calculatePipeline(q) === 'C').length,
        None: openQuotes.filter(q => this.calculatePipeline(q) === 'None').length
    };
    console.log('Pipeline distribution:', pipelineDistribution);
    console.log('=== PIPELINE DEBUG END ===');
}
    calculateCustomerSegmentation(customers) {
        const segments = {
            vip: { 
                name: 'VIP Customers', 
                customers: [], 
                criteria: 'Total value > AED 100K + Conversion > 50%',
                description: 'High-value customers with excellent conversion rates. These are your most profitable clients who consistently close deals.',
                actionable: 'Focus on retention and upselling opportunities.'
            },
            loyal: { 
                name: 'Loyal Customers', 
                customers: [], 
                criteria: 'Conversion > 30% + Active within 60 days',
                description: 'Reliable customers with good conversion rates and regular engagement. They trust your business and convert well.',
                actionable: 'Maintain relationship and explore expansion opportunities.'
            },
            potential: { 
                name: 'Potential Growth', 
                customers: [], 
                criteria: 'All other active customers with some engagement',
                description: 'Customers with moderate activity who could be developed into higher value segments with proper nurturing.',
                actionable: 'Invest in relationship building and targeted offers.'
            },
            atrisk: { 
                name: 'At Risk', 
                customers: [], 
                criteria: 'No activity > 90 days OR Low conversion < 20%',
                description: 'Customers who have gone quiet or consistently reject proposals. They may be considering alternatives.',
                actionable: 'Immediate re-engagement needed or risk losing them.'
            }
        };
        
        customers.forEach(customer => {
            const avgValue = customer.avg_quote_value;
            const conversionRate = parseFloat(customer.conversion_rate);
            const daysSinceLast = customer.days_since_last_quote;
            const totalValue = customer.total_value;
            
            // VIP: High value and good conversion
            if (totalValue > 100000 && conversionRate > 50) {
                segments.vip.customers.push(customer);
            }
            // At Risk: No recent activity or poor conversion
            else if (daysSinceLast > 90 || (conversionRate < 20 && customer.total_quotes > 3)) {
                segments.atrisk.customers.push(customer);
            }
            // Loyal: Good conversion and regular activity
            else if (conversionRate > 30 && daysSinceLast < 60) {
                segments.loyal.customers.push(customer);
            }
            // Potential: Others with some activity
            else {
                segments.potential.customers.push(customer);
            }
        });
        
        // Calculate top 5 customers by quotation count
        segments.topQuoteCustomers = customers.length > 0 ? 
            customers
                .sort((a, b) => b.total_quotes - a.total_quotes)
                .slice(0, 5) : [];
        
        // Keep single top customer for backward compatibility
        segments.topQuoteCustomer = segments.topQuoteCustomers.length > 0 ? 
            segments.topQuoteCustomers[0] : null;
            
        // Calculate continuous non-converting customers
        segments.continuousQuoteCustomers = this.findContinuousNonConvertingCustomers();
        
        return segments;
    }
    
    findContinuousNonConvertingCustomers() {
        if (!this.quotations || this.quotations.length === 0) return [];
        
        const customerQuotes = {};
        
        // Group quotations by customer and sort by creation date
        this.quotations.forEach(quote => {
            if (!quote.customer) return;
            
            if (!customerQuotes[quote.customer]) {
                customerQuotes[quote.customer] = [];
            }
            
            customerQuotes[quote.customer].push({
                name: quote.quotation,
                status: quote.status,
                creation: quote.creation,
                customer: quote.customer
            });
        });
        
        const continuousCustomers = [];
        
        // Check each customer for continuous patterns
        Object.keys(customerQuotes).forEach(customerName => {
            const quotes = customerQuotes[customerName].sort((a, b) => new Date(a.creation) - new Date(b.creation));
            let continuousCount = 0;
            let maxContinuous = 0;
            let currentStreak = [];
            let longestStreak = [];
            
            for (let i = 0; i < quotes.length; i++) {
                const quote = quotes[i];
                
                if (quote.status === 'Won' || quote.status === 'Ordered') {
                    // Reset count if customer won/ordered
                    if (continuousCount >= 5) {
                        // Customer had 5+ continuous before this win, record it
                        if (currentStreak.length >= longestStreak.length) {
                            longestStreak = [...currentStreak];
                        }
                    }
                    continuousCount = 0;
                    currentStreak = [];
                } else if (['Lost', 'Expired', 'Cancelled'].includes(quote.status)) {
                    // Count non-converting quotes
                    continuousCount++;
                    currentStreak.push(quote);
                    if (currentStreak.length > longestStreak.length) {
                        longestStreak = [...currentStreak];
                    }
                }
            }
            
            // Check if customer currently has 5+ continuous non-converting quotes
            if (continuousCount >= 5 || longestStreak.length >= 5) {
                continuousCustomers.push({
                    customer: customerName,
                    continuous_count: Math.max(continuousCount, longestStreak.length),
                    current_streak: continuousCount,
                    longest_streak: longestStreak.length,
                    streak_start: longestStreak.length > 0 ? longestStreak[0].creation : null,
                    streak_end: longestStreak.length > 0 ? longestStreak[longestStreak.length - 1].creation : null,
                    total_quotes: quotes.length,
                    won_quotes: quotes.filter(q => q.status === 'Won' || q.status === 'Ordered').length
                });
            }
        });
        
        return continuousCustomers.sort((a, b) => b.continuous_count - a.continuous_count);
    }
    
    calculateCustomerInsights(customers) {
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter(c => c.days_since_last_quote <= 30).length;
        const avgCustomerValue = customers.reduce((sum, c) => sum + c.total_value, 0) / totalCustomers;
        const avgQuotesPerCustomer = customers.reduce((sum, c) => sum + c.total_quotes, 0) / totalCustomers;
        
        return {
            total_customers: totalCustomers,
            active_customers: activeCustomers,
            avg_customer_value: avgCustomerValue,
            avg_quotes_per_customer: avgQuotesPerCustomer,
            customer_retention_rate: totalCustomers > 0 ? (activeCustomers / totalCustomers * 100).toFixed(1) : 0
        };
    }

    async navigateToSection(section) {
        $('.nav-item').removeClass('active');
        $(`.nav-item[data-section="${section}"]`).addClass('active');
        
        this.currentSection = section;
        await this.renderCurrentSection();
        this.updatePageTitle(section);
    }

    updatePageTitle(section) {
        const titles = {
            overview: { title: 'Overview', subtitle: 'Comprehensive sales analytics' },
            pipeline: { title: 'Pipeline Analysis', subtitle: 'Track your sales pipeline' },
            conversion: { title: 'Conversion Analysis', subtitle: 'Analyze conversion rates' },
            margin: { title: 'Margin Analysis', subtitle: 'Monitor profit margins' },
            items: { title: 'Items Analysis', subtitle: 'Product performance insights' },
            followup: { title: 'Follow-up Tracker', subtitle: 'Manage customer follow-ups' },
            customers: { title: 'Customer Insights', subtitle: 'Customer behavior analysis' },
            lost: { title: 'Lost Quotations', subtitle: 'Analyze lost opportunities and reasons' },
            cancelled: { title: 'Cancelled Quotations', subtitle: 'Analyze cancelled but not amended quotations' },
            opportunities: { title: 'Opportunities', subtitle: 'Track opportunity to quotation conversion' }
        };
        
        const sectionInfo = titles[section] || titles.overview;
        $('#page-title').text(sectionInfo.title);
        $('#page-subtitle').text(sectionInfo.subtitle);
    }

    async renderCurrentSection() {
        let content = '';
        
        switch(this.currentSection) {
            case 'overview':
                content = this.renderOverviewSection();
                break;
            case 'pipeline':
                content = this.renderPipelineSection();
                break;
            case 'conversion':
                content = this.renderConversionSection();
                break;
            case 'margin':
                content = this.renderMarginSection();
                break;
            case 'items':
                content = this.renderItemsSection();
                break;
            case 'followup':
                content = this.renderFollowupSection();
                break;
            case 'customers':
                content = this.renderCustomersSection();
                break;
            case 'lost':
                content = this.renderLostQuotationsSection();
                break;
            case 'cancelled':
                content = await this.renderCancelledQuotationsSection();
                break;
            case 'opportunities':
                content = this.renderOpportunitiesSection();
                break;
            default:
                content = this.renderOverviewSection();
        }
        
        $('#content-area').html(content);
        
        // Initialize charts if needed
        if (['overview', 'conversion', 'pipeline'].includes(this.currentSection)) {
            setTimeout(() => this.initializeCharts(), 100);
        }
    }

    renderOverviewSection() {
        const stats = this.data.stats.overview;
        const metadata = this.data.metadata;
        
        return `
            <!-- Data Summary Info -->
            ${metadata.is_limited ? `
            <div class="data-section mb-3">
                <div class="alert alert-warning" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-exclamation-triangle" style="color: var(--accent-orange); font-size: 1.25rem;"></i>
                            <div>
                                <strong>⚠️ Data Limited:</strong> Showing ${metadata.retrieved_count.toLocaleString()} of ${metadata.total_count.toLocaleString()} matching quotations. 
                                <br><small>Use filters to narrow results for complete data analysis.</small>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="frappe.sales_intelligence.loadAllData()" style="white-space: nowrap;">
                            <i class="fa fa-download" style="margin-right: 0.5rem;"></i>Load All Data
                        </button>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Main Stats Overview -->
            <div class="stats-grid">
                <!-- 1. Total Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('total_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-file-alt" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                Total Quotations
                            </h3>
                            <p class="stat-card-value">${stats.total.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.total.amount)}</p>
                        </div>
                        <div class="stat-card-icon">
                            <i class="fa fa-file-alt"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 2. Won Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('won_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-trophy" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                Won Quotations
                            </h3>
                            <p class="stat-card-value">${stats.won.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.won.amount)}</p>
                        </div>
                        <div class="stat-card-icon success">
                            <i class="fa fa-trophy"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 3. Conversion Rate -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('conversion_rate')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-percentage" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                Conversion Rate
                            </h3>
                            <p class="stat-card-value">${stats.total.count > 0 ? 
                                (stats.won.count / stats.total.count * 100).toFixed(1) : 0}%</p>
                            <p class="stat-card-amount">
                                <i class="fa fa-times-circle" style="color: var(--accent-red); margin-right: 0.25rem;"></i>
                                Lost: ${stats.lost.count} (AED ${this.formatCurrency(stats.lost.amount)})
                            </p>
                        </div>
                        <div class="stat-card-icon info">
                            <i class="fa fa-percentage"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 4. Draft Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('draft_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-edit" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                Draft Quotations
                            </h3>
                            <p class="stat-card-value">${stats.draft.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.draft.amount)}</p>
                        </div>
                        <div class="stat-card-icon draft">
                            <i class="fa fa-edit"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 5. Pending Dept Approval -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('pending_dept_approval_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-hourglass-half" style="color: var(--accent-warning); margin-right: 0.5rem;"></i>
                                Pending Dept Approval
                            </h3>
                            <p class="stat-card-value">${stats.pendingDeptApproval.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.pendingDeptApproval.amount)}</p>
                        </div>
                        <div class="stat-card-icon warning">
                            <i class="fa fa-hourglass-half"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 6. Open Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('open_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-clock" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                Open Quotations
                            </h3>
                            <p class="stat-card-value">${stats.open.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.open.amount)}</p>
                        </div>
                        <div class="stat-card-icon info">
                            <i class="fa fa-clock"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 7. Expired Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('expired_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-exclamation-triangle" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                Expired Quotations
                            </h3>
                            <p class="stat-card-value">${stats.expired.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.expired.amount)}</p>
                        </div>
                        <div class="stat-card-icon danger">
                            <i class="fa fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 8. Lost Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('lost_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-times-circle" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                Lost Quotations
                            </h3>
                            <p class="stat-card-value">${stats.lost.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.lost.amount)}</p>
                        </div>
                        <div class="stat-card-icon danger">
                            <i class="fa fa-times-circle"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
                <!-- 9. Cancelled but not amended Quotations -->
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('cancelled_not_amended_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-ban" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                Cancelled (Not Amended)
                            </h3>
                            <p class="stat-card-value">${stats.cancelledNotAmended.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.cancelledNotAmended.amount)}</p>
                        </div>
                        <div class="stat-card-icon" style="background: linear-gradient(135deg, var(--accent-purple), #8b5cf6);">
                            <i class="fa fa-ban"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
            </div>
            
            <!-- Value Range Analysis for Pending Quotes -->
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-chart-bar"></i>
                        Pending Quotations by Value Range
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-info-circle"></i>
                        <span>Open & Expired quotations only</span>
                    </div>
                </div>
                
                <div class="stats-grid">
                    ${Object.entries(stats.valueRanges).map(([range, data], index) => {
                        const icons = ['fa-coins', 'fa-money-bill', 'fa-money-bill-wave', 'fa-gem', 'fa-crown'];
                        const colors = ['info', 'success', 'warning', 'danger', 'info'];
                        return `
                        <div class="stat-card" onclick="frappe.sales_intelligence.showValueRangeDetails('${range}')">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa ${icons[index]}" style="color: var(--accent-${colors[index] === 'info' ? 'blue' : colors[index] === 'success' ? 'green' : colors[index] === 'warning' ? 'orange' : 'red'}); margin-right: 0.5rem;"></i>
                                        AED ${range}
                                    </h3>
                                    <p class="stat-card-value">${data.count}</p>
                                    <p class="stat-card-amount">AED ${this.formatCurrency(data.amount)}</p>
                                </div>
                                <div class="stat-card-icon ${colors[index]}">
                                    <i class="fa ${icons[index]}"></i>
                                </div>
                            </div>
                            <span class="click-indicator">
                                <i class="fa fa-mouse-pointer"></i>
                                View quotations
                            </span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Recent Quotations -->
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-clock"></i>
                        Recent Quotations
                    </h2>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-list"></i>
                            <span>Last 50 quotations</span>
                        </div>
                        <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showAllQuotations()">
                            <i class="fa fa-expand"></i>
                            View All ${this.data.filtered.length}
                        </button>
                    </div>
                </div>
                
                ${this.renderTableWithControls('recent-quotations', this.data.filtered.slice(0, 50), [
                    { key: 'quotation', label: 'Quotation', sortable: true, icon: 'fa-file-alt' },
                    { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                    { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                    { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                    { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' },
                    { key: 'profit_percentage', label: 'Margin', sortable: true, type: 'margin', icon: 'fa-percentage' },
                    { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                    { key: 'actions', label: 'Actions', sortable: false, type: 'actions', icon: 'fa-cog' }
                ])}
            </div>
        `;
    }
renderPipelineSection() {
    const pipelines = this.data.stats.pipeline;
    const totalPipelineValue = pipelines.A.value + pipelines.B.value + pipelines.C.value;
    const totalQuotes = pipelines.A.quotes.length + pipelines.B.quotes.length + pipelines.C.quotes.length + pipelines.None.quotes.length;
    
    // Calculate branch-wise pipeline data
    const branchPipelineData = this.calculateBranchPipelineData();
    
    // Calculate account manager-wise pipeline data
    const managerPipelineData = this.calculateManagerPipelineData();
    
    return `
        <div class="pipeline-container">
            <!-- Pipeline Overview Cards -->
            <div class="pipeline-overview-grid">
                <div class="pipeline-overview-card">
                    <div class="overview-card-content">
                        <div class="overview-icon">
                             <i class="fa fa-filter"></i>
                        </div>
                        <div class="overview-details">
                            <h3 class="overview-title">Total Pipeline Value</h3>
                            <div class="overview-value">AED ${this.formatCurrency(totalPipelineValue)}</div>
                            <div class="overview-subtitle">${totalQuotes} Active Opportunities</div>
                        </div>
                    </div>
                </div>
                
            </div>

            <!-- Pipeline Stages Visualization -->
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-layer-group"></i>
                        Pipeline Stages
                    </h2>
                    <div class="pipeline-legend">
                        <span class="legend-item legend-a">
                            <span class="legend-dot"></span>
                            Very High Confidence (90-100%)
                        </span>
                        <span class="legend-item legend-b">
                            <span class="legend-dot"></span>
                            High Confidence (75-90%)
                        </span>
                        <span class="legend-item legend-c">
                            <span class="legend-dot"></span>
                            Medium Confidence (50-75%)
                        </span>
                        <span class="legend-item legend-none">
                            <span class="legend-dot"></span>
                            No Pipeline
                        </span>
                    </div>
                </div>
                
                <div class="pipeline-stages-container">
                    <!-- Pipeline A -->
                    <div class="pipeline-stage-card pipeline-a ${pipelines.A.quotes.length === 0 ? 'empty' : ''}" onclick="frappe.sales_intelligence.showPipelineDetails('A')">
                        <div class="stage-header">
                            <div class="stage-info">
                                <div class="stage-title">Pipeline A</div>
                                <div class="stage-subtitle">Very High Confidence</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-very-high">90-100%</div>
                            </div>
                        </div>
                        
                        <div class="stage-metrics">
                            <div class="metric-group">
                                <div class="metric-value">${pipelines.A.quotes.length}</div>
                                <div class="metric-label">Quotations</div>
                            </div>
                            <div class="metric-group">
                                <div class="metric-value">AED ${this.formatCurrency(pipelines.A.value)}</div>
                                <div class="metric-label">Total Value</div>
                            </div>
                        </div>
                        
                        <div class="stage-progress">
                            <div class="progress-bar">
                                <div class="progress-fill progress-a" style="width: 95%"></div>
                            </div>
                            <div class="progress-text">98% Weight Factor</div>
                        </div>
                        
                        ${pipelines.A.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-mouse-pointer"></i> Click to view details</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations in this pipeline</div>`}
                    </div>

                    <!-- Pipeline B -->
                    <div class="pipeline-stage-card pipeline-b ${pipelines.B.quotes.length === 0 ? 'empty' : ''}" onclick="frappe.sales_intelligence.showPipelineDetails('B')">
                        <div class="stage-header">
                            <div class="stage-info">
                                <div class="stage-title">Pipeline B</div>
                                <div class="stage-subtitle">High Confidence</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-high">75-90%</div>
                            </div>
                        </div>
                        
                        <div class="stage-metrics">
                            <div class="metric-group">
                                <div class="metric-value">${pipelines.B.quotes.length}</div>
                                <div class="metric-label">Quotations</div>
                            </div>
                            <div class="metric-group">
                                <div class="metric-value">AED ${this.formatCurrency(pipelines.B.value)}</div>
                                <div class="metric-label">Total Value</div>
                            </div>
                        </div>
                        
                        <div class="stage-progress">
                            <div class="progress-bar">
                                <div class="progress-fill progress-b" style="width: 82.5%"></div>
                            </div>
                            <div class="progress-text">82.5% Weight Factor</div>
                        </div>
                        
                        ${pipelines.B.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-mouse-pointer"></i> Click to view details</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations in this pipeline</div>`}
                    </div>

                    <!-- Pipeline C -->
                    <div class="pipeline-stage-card pipeline-c ${pipelines.C.quotes.length === 0 ? 'empty' : ''}" onclick="frappe.sales_intelligence.showPipelineDetails('C')">
                        <div class="stage-header">
                            <div class="stage-info">
                                <div class="stage-title">Pipeline C</div>
                                <div class="stage-subtitle">Medium Confidence</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-medium">50-75%</div>
                            </div>
                        </div>
                        
                        <div class="stage-metrics">
                            <div class="metric-group">
                                <div class="metric-value">${pipelines.C.quotes.length}</div>
                                <div class="metric-label">Quotations</div>
                            </div>
                            <div class="metric-group">
                                <div class="metric-value">AED ${this.formatCurrency(pipelines.C.value)}</div>
                                <div class="metric-label">Total Value</div>
                            </div>
                        </div>
                        
                        <div class="stage-progress">
                            <div class="progress-bar">
                                <div class="progress-fill progress-c" style="width: 62.5%"></div>
                            </div>
                            <div class="progress-text">62.5% Weight Factor</div>
                        </div>
                        
                        ${pipelines.C.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-mouse-pointer"></i> Click to view details</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations in this pipeline</div>`}
                    </div>


                    <!-- No Pipeline -->
                    <div class="pipeline-stage-card pipeline-none ${pipelines.None.quotes.length === 0 ? 'empty' : ''}" onclick="frappe.sales_intelligence.showPipelineDetails('None')">
                        <div class="stage-header">
                            <div class="stage-info">
                                <div class="stage-title">No Pipeline</div>
                                <div class="stage-subtitle">Needs Classification</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-none">Not Set</div>
                            </div>
                        </div>
                        
                        <div class="stage-metrics">
                            <div class="metric-group">
                                <div class="metric-value">${pipelines.None.quotes.length}</div>
                                <div class="metric-label">Quotations</div>
                            </div>
                            <div class="metric-group">
                                <div class="metric-value">AED ${this.formatCurrency(pipelines.None.value)}</div>
                                <div class="metric-label">Total Value</div>
                            </div>
                            <div class="metric-group">
                                <div class="metric-value">-</div>
                                <div class="metric-label">No Weight</div>
                            </div>
                        </div>
                        
                        <div class="stage-progress">
                            <div class="progress-bar">
                                <div class="progress-fill progress-none" style="width: 5%"></div>
                            </div>
                            <div class="progress-text">Requires Pipeline Assignment</div>
                        </div>
                        
                        ${pipelines.None.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-exclamation-triangle"></i> Click to review unassigned quotations</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations without pipeline</div>`}
                    </div>
                </div>
            </div>

            <!-- Tabbed Analysis -->
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-chart-bar"></i>
                        Pipeline Analysis
                    </h2>
                </div>
                
                <div class="pipeline-tabs">
                    <div class="tab-navigation">
                        <button class="tab-btn active" data-tab="branch-pipeline" onclick="frappe.sales_intelligence.switchPipelineTab('branch-pipeline')">
                            <i class="fa fa-map-marker-alt"></i>
                            <span>Branch Analysis</span>
                        </button>
                        <button class="tab-btn" data-tab="manager-pipeline" onclick="frappe.sales_intelligence.switchPipelineTab('manager-pipeline')">
                            <i class="fa fa-user-tie"></i>
                            <span>Account Manager Analysis</span>
                        </button>
                        <button class="tab-btn" data-tab="timeline-pipeline" onclick="frappe.sales_intelligence.switchPipelineTab('timeline-pipeline')">
                            <i class="fa fa-calendar-alt"></i>
                            <span>Pipeline Timeline</span>
                        </button>
                    </div>
                    
                    <div class="tab-content">
                        <!-- Branch Pipeline Analysis -->
                        <div class="tab-pane active" id="branch-pipeline">
                            <div class="tab-header">
                                <h4><i class="fa fa-map-marker-alt"></i> Pipeline Distribution by Branch</h4>
                                <p class="tab-description">View how pipeline opportunities are distributed across different branches</p>
                            </div>
                            
                            <div class="pipeline-summary-cards">
                                ${branchPipelineData.map(branch => `
                                    <div class="pipeline-summary-card" onclick="frappe.sales_intelligence.showBranchPipelineDetails('${branch.name}')">
                                        <div class="summary-header">
                                            <h5 class="branch-name"><i class="fa fa-map-marker-alt" style="margin-right: 0.5rem; color: var(--accent-blue);"></i>${branch.name}</h5>
                                            <div class="branch-total"><i class="fa fa-coins" style="margin-right: 0.25rem; color: var(--accent-green);"></i>AED ${this.formatCurrency(branch.total_value)}</div>
                                        </div>
                                        <div class="pipeline-distribution">
                                            <div class="distribution-bar">
                                                <div class="dist-segment dist-a" style="width: ${branch.total_value > 0 ? (branch.pipeline_A_value / branch.total_value * 100).toFixed(1) : 0}%" title="Pipeline A: AED ${this.formatCurrency(branch.pipeline_A_value)}"></div>
                                                <div class="dist-segment dist-b" style="width: ${branch.total_value > 0 ? (branch.pipeline_B_value / branch.total_value * 100).toFixed(1) : 0}%" title="Pipeline B: AED ${this.formatCurrency(branch.pipeline_B_value)}"></div>
                                                <div class="dist-segment dist-c" style="width: ${branch.total_value > 0 ? (branch.pipeline_C_value / branch.total_value * 100).toFixed(1) : 0}%" title="Pipeline C: AED ${this.formatCurrency(branch.pipeline_C_value)}"></div>
                                                <div class="dist-segment dist-none" style="width: ${branch.total_value > 0 ? (branch.no_pipeline_value / branch.total_value * 100).toFixed(1) : 0}%" title="No Pipeline: AED ${this.formatCurrency(branch.no_pipeline_value)}"></div>
                                            </div>
                                        </div>
                                        <div class="pipeline-stats">
                                            <div class="stat-item">
                                                <span class="stat-label">Pipeline A:</span>
                                                <span class="stat-value">${branch.pipeline_A_count}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">Pipeline B:</span>
                                                <span class="stat-value">${branch.pipeline_B_count}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">Pipeline C:</span>
                                                <span class="stat-value">${branch.pipeline_C_count}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">No Pipeline:</span>
                                                <span class="stat-value">${branch.no_pipeline_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            ${this.renderTableWithControls('branch-pipeline-table', branchPipelineData, [
                                { key: 'name', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
                                { key: 'total_count', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                                { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                                { key: 'pipeline_A_count', label: 'Pipeline A', sortable: true, icon: 'fa-arrow-up' },
                                { key: 'pipeline_B_count', label: 'Pipeline B', sortable: true, icon: 'fa-minus' },
                                { key: 'pipeline_C_count', label: 'Pipeline C', sortable: true, icon: 'fa-arrow-down' }
                            ])}
                        </div>
                        
                        <!-- Manager Pipeline Analysis -->
                        <div class="tab-pane" id="manager-pipeline">
                            <div class="tab-header">
                                <h4><i class="fa fa-user-tie"></i> Pipeline Management by Account Manager</h4>
                                <p class="tab-description">Analyze pipeline performance and distribution across account managers</p>
                            </div>
                            
                            <div class="pipeline-summary-cards">
                                ${managerPipelineData.map(manager => `
                                    <div class="pipeline-summary-card" onclick="frappe.sales_intelligence.showManagerPipelineDetails('${manager.name}')">
                                        <div class="summary-header">
                                            <div class="manager-info">
                                                ${this.getUserAvatar(manager.name, 48)}
                                                <div class="manager-details">
                                                    <h5 class="manager-name"><i class="fa fa-user-tie" style="margin-right: 0.5rem; color: var(--accent-purple);"></i>${manager.name}</h5>
                                                    <div class="manager-total"><i class="fa fa-coins" style="margin-right: 0.25rem; color: var(--accent-green);"></i>AED ${this.formatCurrency(manager.total_value)}</div>
                                                </div>
                                            </div>
                                            <div class="manager-score">
                                                <div class="score-value"><i class="fa fa-star" style="margin-right: 0.25rem; color: var(--accent-orange);"></i>${manager.pipeline_score.toFixed(1)}%</div>
                                                <div class="score-label">Pipeline Score</div>
                                            </div>
                                        </div>
                                        <div class="pipeline-distribution">
                                            <div class="distribution-bar">
                                                <div class="dist-segment dist-a" style="width: ${manager.total_value > 0 ? (manager.pipeline_A_value / manager.total_value * 100).toFixed(1) : 0}%"></div>
                                                <div class="dist-segment dist-b" style="width: ${manager.total_value > 0 ? (manager.pipeline_B_value / manager.total_value * 100).toFixed(1) : 0}%"></div>
                                                <div class="dist-segment dist-c" style="width: ${manager.total_value > 0 ? (manager.pipeline_C_value / manager.total_value * 100).toFixed(1) : 0}%"></div>
                                                <div class="dist-segment dist-none" style="width: ${manager.total_value > 0 ? (manager.no_pipeline_value / manager.total_value * 100).toFixed(1) : 0}%"></div>
                                            </div>
                                        </div>
                                        <div class="pipeline-stats">
                                            <div class="stat-item">
                                                <span class="stat-label">High Conf:</span>
                                                <span class="stat-value">${manager.pipeline_A_count}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">Med Conf:</span>
                                                <span class="stat-value">${manager.pipeline_B_count}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">Low Conf:</span>
                                                <span class="stat-value">${manager.pipeline_C_count}</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-label">Unassigned:</span>
                                                <span class="stat-value">${manager.no_pipeline_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            ${this.renderTableWithControls('manager-pipeline-table', managerPipelineData, [
                                { key: 'name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                                { key: 'total_count', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                                { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                                { key: 'pipeline_score', label: 'Pipeline Score', sortable: true, type: 'percentage', icon: 'fa-star' },
                                { key: 'pipeline_A_count', label: 'High Confidence', sortable: true, icon: 'fa-arrow-up' },
                                { key: 'pipeline_B_count', label: 'Medium Confidence', sortable: true, icon: 'fa-minus' },
                                { key: 'pipeline_C_count', label: 'Low Confidence', sortable: true, icon: 'fa-arrow-down' }
                            ])}
                        </div>
                        
                        <!-- Pipeline Timeline -->
                        <div class="tab-pane" id="timeline-pipeline">
                            <div class="tab-header">
                                <h4><i class="fa fa-calendar-alt"></i> Pipeline Timeline Analysis</h4>
                                <p class="tab-description">Track how quotations move through different pipeline stages over time</p>
                            </div>
                            
                            <div class="timeline-container">
                                <div class="timeline-stats">
                                    <div class="timeline-stat">
                                        <div class="timeline-stat-value">${this.calculateAverageDaysInPipeline()}</div>
                                        <div class="timeline-stat-label">Avg Days in Pipeline</div>
                                    </div>
                                    <div class="timeline-stat">
                                        <div class="timeline-stat-value">${this.calculateQuotesNearExpiry()}</div>
                                        <div class="timeline-stat-label">Near Expiry (< 7 days)</div>
                                    </div>
                                    <div class="timeline-stat">
                                        <div class="timeline-stat-value">${this.calculateStagnatPipelines()}</div>
                                        <div class="timeline-stat-label">Stagnant (> 30 days)</div>
                                    </div>
                                </div>
                                
                                <div class="pipeline-timeline-chart">
                                    <canvas id="pipelineTimelineChart" width="800" height="400"></canvas>
                                </div>
                                
                                <div class="urgent-actions">
                                    <h5><i class="fa fa-exclamation-triangle"></i> Urgent Actions Required</h5>
                                    ${this.renderUrgentPipelineActions()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
getPipelineStatusBreakdown() {
    const breakdown = {};
    
    Object.keys(this.data.pipelines).forEach(pipelineKey => {
        if (pipelineKey !== 'None') {
            breakdown[pipelineKey] = {};
            
            this.data.pipelines[pipelineKey].quotes.forEach(quote => {
                const status = quote.status || 'Unknown';
                if (!breakdown[pipelineKey][status]) {
                    breakdown[pipelineKey][status] = { count: 0, value: 0 };
                }
                breakdown[pipelineKey][status].count++;
                breakdown[pipelineKey][status].value += quote.base_grand_total || 0;
            });
        }
    });
    
    return breakdown;
}
    renderConversionSection() {
        const stats = this.data.stats.conversion;
        
        return `
            <div class="conversion-container">
                <!-- Tab Navigation -->
                <div class="tab-navigation" style="margin-bottom: 2rem; width: 100%;">
                    <div class="tab-buttons" style="display: flex; width: 100%; border-bottom: 3px solid var(--border-color); background: rgba(51, 65, 85, 0.15); border-radius: 12px 12px 0 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <button class="tab-button active" data-tab="overview" onclick="frappe.sales_intelligence.switchConversionTab('overview')" style="flex: 1; min-width: 160px; padding: 1rem 1.25rem; background: var(--accent-blue); color: white; border: none; border-radius: 12px 0 0 0; font-weight: 600; font-size: 0.9rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <i class="fa fa-chart-line" style="font-size: 1rem;"></i>
                            <span>Overview</span>
                        </button>
                        <button class="tab-button" data-tab="performance" onclick="frappe.sales_intelligence.switchConversionTab('performance')" style="flex: 1; min-width: 160px; padding: 1rem 1.25rem; background: rgba(51, 65, 85, 0.3); color: var(--text-primary); border: none; font-weight: 500; font-size: 0.9rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                            <i class="fa fa-chart-bar" style="font-size: 1rem;"></i>
                            <span>Count</span>
                        </button>
                        <button class="tab-button" data-tab="value-performance" onclick="frappe.sales_intelligence.switchConversionTab('value-performance')" style="flex: 1; min-width: 160px; padding: 1rem 1.25rem; background: rgba(51, 65, 85, 0.3); color: var(--text-primary); border: none; font-weight: 500; font-size: 0.9rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                            <i class="fa fa-dollar-sign" style="font-size: 1rem;"></i>
                            <span>Value</span>
                        </button>
                        <button class="tab-button" data-tab="conversion-performance" onclick="frappe.sales_intelligence.switchConversionTab('conversion-performance')" style="flex: 1; min-width: 160px; padding: 1rem 1.25rem; background: rgba(51, 65, 85, 0.3); color: var(--text-primary); border: none; border-radius: 0 12px 0 0; font-weight: 500; font-size: 0.9rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                            <i class="fa fa-trophy" style="font-size: 1rem;"></i>
                            <span>Conversion</span>
                        </button>
                    </div>
                </div>
                
                <!-- Tab Contents -->
                <div class="tab-content">
                    <!-- Conversion Overview Tab -->
                    <div class="tab-panel active" id="overview-tab">
                        ${this.renderConversionOverviewTab()}
                    </div>
                    <!-- Quotation Performance Tab -->
                    <div class="tab-panel" id="performance-tab" style="display: none;">
                        ${this.renderQuotationPerformanceTab()}
                    </div>
                    <!-- Value Performance Tab -->
                    <div class="tab-panel" id="value-performance-tab" style="display: none;">
                        ${this.renderValuePerformanceTab()}
                    </div>
                    <!-- Conversion Performance Tab -->
                    <div class="tab-panel" id="conversion-performance-tab" style="display: none;">
                        ${this.renderConversionPerformanceTab()}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderConversionOverviewTab() {
        const stats = this.data.stats.conversion;
        
        return `
            <div class="conversion-overview-container">
                <!-- Tab Info Banner -->
                <div class="tab-info-banner" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05)); border-left: 4px solid var(--accent-blue); padding: 0.75rem 1.5rem; margin-bottom: 1.5rem; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-chart-line" style="color: var(--accent-blue); font-size: 1.1rem;"></i>
                            <span style="font-weight: 600; color: var(--text-primary);">Overview</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">•</span>
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">Comprehensive conversion performance across all dimensions</span>
                        </div>
                    </div>
                </div>
                <!-- Conversion Overview -->
                <div class="stats-grid mb-4">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-chart-line" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Overall Conversion
                                </h3>
                                <p class="stat-card-value">${this.data.filtered.length > 0 ? 
                                    (this.data.filtered.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status)).length / this.data.filtered.length * 100).toFixed(1) : 0}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-trophy" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    ${this.data.filtered.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status)).length} won
                                </p>
                            </div>
                            <div class="stat-card-icon success">
                                <i class="fa fa-chart-line"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-user-tie" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    Top Performer
                                </h3>
                                <p class="stat-card-value">${stats.accountInchargeWise[0]?.conversion_rate || 0}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-star" style="color: var(--accent-orange); margin-right: 0.25rem;"></i>
                                    ${stats.accountInchargeWise[0]?.name || 'N/A'}
                                </p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-user-tie"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-building" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                    Top Company
                                </h3>
                                <p class="stat-card-value">${stats.companyWise[0]?.conversion_rate || 0}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-building" style="color: var(--accent-blue); margin-right: 0.25rem;"></i>
                                    ${stats.companyWise[0]?.name || 'N/A'}
                                </p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-building"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Account Manager Conversion with Images -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-user-tie"></i>
                            Account Manager Performance
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-info-circle"></i>
                            <span>Conversion rates with user profiles</span>
                        </div>
                    </div>
                    
                    <div class="conversion-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                        ${stats.accountInchargeWise.slice(0, 6).map(manager => `
                            <div class="conversion-card" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; cursor: pointer; transition: all 0.3s ease;" onclick="frappe.sales_intelligence.showManagerDetails('${manager.name}')">
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    ${this.getUserAvatar(manager.name, 60)}
                                    <div style="flex: 1;">
                                        <h4 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem 0;">${manager.name}</h4>
                                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Account Manager</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue);">${manager.conversion_rate}%</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">Conversion</div>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">${manager.total_count}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Total Quotes</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.125rem; font-weight: 600; color: var(--accent-green);">${manager.won_count}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Won</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">AED ${this.formatCurrency(manager.total_amount)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Total Value</div>
                                    </div>
                                </div>
                                <div style="width: 100%; height: 6px; background: rgba(148, 163, 184, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${manager.conversion_rate}%; height: 100%; background: ${this.getConversionColor(manager.conversion_rate)}; border-radius: 3px; transition: width 0.3s ease;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${this.renderTableWithControls('manager-conversion', stats.accountInchargeWise, [
                        { key: 'name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                        { key: 'total_count', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'won_count', label: 'Won Quotes', sortable: true, icon: 'fa-trophy' },
                        { key: 'total_amount', label: 'Total Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'won_amount', label: 'Won Amount', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'conversion_rate', label: 'Conversion Rate', sortable: true, type: 'conversion', icon: 'fa-percentage' }
                    ])}
                </div>
                
                <!-- Company-wise Conversion -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-building"></i>
                            Company-wise Performance
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-chart-bar"></i>
                            <span>Conversion analysis by company</span>
                        </div>
                    </div>
                    ${this.renderTableWithControls('company-conversion', stats.companyWise, [
                        { key: 'name', label: 'Company', sortable: true, icon: 'fa-building' },
                        { key: 'total_count', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'won_count', label: 'Won Quotes', sortable: true, icon: 'fa-trophy' },
                        { key: 'total_amount', label: 'Total Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'won_amount', label: 'Won Amount', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'conversion_rate', label: 'Conversion Rate', sortable: true, type: 'conversion', icon: 'fa-percentage' }
                    ])}
                </div>
                
                <!-- Branch-wise Conversion -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-map-marker-alt"></i>
                            Branch-wise Performance
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-map"></i>
                            <span>Regional conversion analysis</span>
                        </div>
                    </div>
                    ${this.renderTableWithControls('branch-conversion', stats.branchWise, [
                        { key: 'name', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
                        { key: 'total_count', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'won_count', label: 'Won Quotes', sortable: true, icon: 'fa-trophy' },
                        { key: 'total_amount', label: 'Total Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'won_amount', label: 'Won Amount', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'conversion_rate', label: 'Conversion Rate', sortable: true, type: 'conversion', icon: 'fa-percentage' }
                    ])}
                </div>
                
                <!-- Customer-wise Conversion -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-users"></i>
                            Top Customer Conversions
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-heart"></i>
                            <span>Best converting customers</span>
                        </div>
                    </div>
                    ${this.renderTableWithControls('customer-conversion', this.data.stats.customers.top_by_conversion, [
                        { key: 'name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'total_quotes', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'won_quotes', label: 'Won Quotes', sortable: true, icon: 'fa-trophy' },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'won_value', label: 'Won Value', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'conversion_rate', label: 'Conversion Rate', sortable: true, type: 'conversion', icon: 'fa-percentage' }
                    ])}
                </div>
            </div>
        `;
    }
    
    renderQuotationPerformanceTab() {
        // Calculate quotation performance by account manager (excluding Cancelled, Lost, Expired)
        const quotationsByManager = this.calculateQuotationPerformance();
        
        return `
            <div class="quotation-performance-container">
                <!-- Tab Info Banner -->
                <div class="tab-info-banner" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05)); border-left: 4px solid var(--accent-green); padding: 0.75rem 1.5rem; margin-bottom: 1.5rem; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-chart-bar" style="color: var(--accent-green); font-size: 1.1rem;"></i>
                            <span style="font-weight: 600; color: var(--text-primary);">Count Performance</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">•</span>
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">All salespeople ranked by total quotations created</span>
                        </div>
                    </div>
                </div>
                <!-- Performance Header -->
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-chart-bar"></i>
                        Quotation Creation Performance
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-info-circle"></i>
                        <span>Account managers ranked by quotation creation count (excluding Cancelled, Lost, Expired)</span>
                    </div>
                </div>
                
                <!-- Performance Chart -->
                <div class="performance-chart-container" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; width: 100%;">
                    <canvas id="quotationPerformanceChart" width="1200" height="500" style="width: 100%; height: auto;"></canvas>
                </div>
                
                <!-- Performance Cards -->
                <div class="performance-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                    ${quotationsByManager.map((manager, index) => {
                        const colors = [
                            'var(--accent-blue)', 'var(--accent-green)', 'var(--accent-orange)', 
                            'var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent-red)',
                            'var(--accent-pink)', 'var(--accent-teal)', 'var(--accent-yellow)', 'var(--accent-gray)',
                            '#4F46E5', '#7C3AED', '#DC2626', '#EA580C', '#CA8A04', '#059669',
                            '#0891B2', '#C2410C', '#9333EA', '#DC2626', '#16A34A', '#2563EB',
                            '#7C2D12', '#92400E', '#166534', '#1E40AF', '#581C87', '#991B1B',
                            '#BE123C', '#A21CAF', '#5B21B6', '#1E3A8A', '#0F766E', '#15803D'
                        ];
                        const color = colors[index % colors.length];
                        
                        return `
                            <div class="performance-card" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; position: relative; overflow: hidden;">
                                <!-- Rank Badge -->
                                <div style="position: absolute; top: -8px; right: -8px; width: 40px; height: 40px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 0.875rem; z-index: 2;">
                                    #${index + 1}
                                </div>
                                
                                <!-- Employee Image and Info -->
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    <div id="employee-image-${manager.account_incharge?.replace('@', '-').replace('.', '-')}" style="width: 60px; height: 60px; border-radius: 50%; background: ${color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.25rem; position: relative;">
                                        ${manager.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '??'}
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem 0;">${manager.name || 'Unknown'}</h4>
                                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${manager.account_incharge || ''}</p>
                                    </div>
                                </div>
                                
                                <!-- Performance Metrics -->
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-top: 1rem;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: 700; color: ${color};">${manager.count}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Quotations</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.125rem; font-weight: 600; color: var(--accent-green);">${manager.total_value ? this.formatCurrency(manager.total_value) : 'N/A'}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Total Value</div>
                                    </div>
                                </div>
                                
                                <!-- Progress Bar -->
                                <div style="margin-top: 1rem;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span style="font-size: 0.75rem; color: var(--text-secondary);">Performance</span>
                                        <span style="font-size: 0.75rem; color: var(--text-secondary);">${manager.percentage?.toFixed(1)}%</span>
                                    </div>
                                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: ${color}; width: ${manager.percentage}%; transition: width 0.3s ease;"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    renderValuePerformanceTab() {
        // Calculate value performance by account manager (excluding Cancelled, Lost, Expired)
        const valuesByManager = this.calculateValuePerformance();
        
        return `
            <div class="value-performance-container">
                <!-- Tab Info Banner -->
                <div class="tab-info-banner" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05)); border-left: 4px solid var(--accent-orange); padding: 0.75rem 1.5rem; margin-bottom: 1.5rem; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-dollar-sign" style="color: var(--accent-orange); font-size: 1.1rem;"></i>
                            <span style="font-weight: 600; color: var(--text-primary);">Value Performance</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">•</span>
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">All salespeople ranked by total quotation value generated</span>
                        </div>
                    </div>
                </div>
                <!-- Performance Header -->
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-dollar-sign"></i>
                        Quotation Value Performance
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-info-circle"></i>
                        <span>Account managers ranked by total quotation value (excluding Cancelled, Lost, Expired)</span>
                    </div>
                </div>
                
                <!-- Performance Chart -->
                <div class="value-chart-container" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; width: 100%;">
                    <canvas id="valuePerformanceChart" width="1200" height="500" style="width: 100%; height: auto;"></canvas>
                </div>
                
                <!-- Performance Cards -->
                <div class="value-performance-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                    ${valuesByManager.map((manager, index) => {
                        const colors = [
                            'var(--accent-green)', 'var(--accent-blue)', 'var(--accent-purple)', 
                            'var(--accent-orange)', 'var(--accent-cyan)', 'var(--accent-red)',
                            'var(--accent-pink)', 'var(--accent-teal)', 'var(--accent-yellow)', 'var(--accent-gray)',
                            '#059669', '#4F46E5', '#7C3AED', '#DC2626', '#EA580C', '#CA8A04',
                            '#0891B2', '#C2410C', '#9333EA', '#DC2626', '#16A34A', '#2563EB',
                            '#7C2D12', '#92400E', '#166534', '#1E40AF', '#581C87', '#991B1B',
                            '#BE123C', '#A21CAF', '#5B21B6', '#1E3A8A', '#0F766E', '#15803D'
                        ];
                        const color = colors[index % colors.length];
                        
                        return `
                            <div class="value-performance-card" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; position: relative; overflow: hidden;">
                                <!-- Rank Badge -->
                                <div style="position: absolute; top: -8px; right: -8px; width: 40px; height: 40px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 0.875rem; z-index: 2;">
                                    #${index + 1}
                                </div>
                                
                                <!-- Employee Image and Info -->
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    <div id="employee-value-image-${manager.account_incharge?.replace('@', '-').replace('.', '-')}" style="width: 60px; height: 60px; border-radius: 50%; background: ${color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.25rem; position: relative;">
                                        ${manager.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '??'}
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem 0;">${manager.name || 'Unknown'}</h4>
                                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${manager.account_incharge || ''}</p>
                                    </div>
                                </div>
                                
                                <!-- Performance Metrics -->
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-top: 1rem;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.25rem; font-weight: 700; color: ${color};">${this.formatCurrency(manager.total_value)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Total Value</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.125rem; font-weight: 600; color: var(--accent-blue);">${manager.count}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Quotations</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: var(--accent-orange);">${manager.avg_value ? this.formatCurrency(manager.avg_value) : 'N/A'}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Avg Value</div>
                                    </div>
                                </div>
                                
                                <!-- Progress Bar -->
                                <div style="margin-top: 1rem;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span style="font-size: 0.75rem; color: var(--text-secondary);">Value Performance</span>
                                        <span style="font-size: 0.75rem; color: var(--text-secondary);">${manager.percentage?.toFixed(1)}%</span>
                                    </div>
                                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: ${color}; width: ${manager.percentage}%; transition: width 0.3s ease;"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    renderConversionPerformanceTab() {
        // Calculate conversion performance by account manager (Ordered/Partially Ordered)
        const conversionsByManager = this.calculateConversionPerformance();
        
        return `
            <div class="conversion-performance-container">
                <!-- Tab Info Banner -->
                <div class="tab-info-banner" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05)); border-left: 4px solid var(--accent-purple); padding: 0.75rem 1.5rem; margin-bottom: 1.5rem; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-trophy" style="color: var(--accent-purple); font-size: 1.1rem;"></i>
                            <span style="font-weight: 600; color: var(--text-primary);">Conversion Performance</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">•</span>
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">All salespeople ranked by quotation-to-order conversion rate</span>
                        </div>
                    </div>
                </div>
                <!-- Performance Header -->
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-trophy"></i>
                        Quotation Conversion Performance
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-info-circle"></i>
                        <span>Account managers ranked by successful conversions (Ordered & Partially Ordered quotations)</span>
                    </div>
                </div>
                
                <!-- Performance Chart -->
                <div class="conversion-chart-container" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; width: 100%;">
                    <canvas id="conversionPerformanceChart" width="1200" height="500" style="width: 100%; height: auto;"></canvas>
                </div>
                
                <!-- Performance Cards -->
                <div class="conversion-performance-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                    ${conversionsByManager.map((manager, index) => {
                        const colors = [
                            'var(--accent-orange)', 'var(--accent-purple)', 'var(--accent-green)', 
                            'var(--accent-blue)', 'var(--accent-cyan)', 'var(--accent-red)',
                            'var(--accent-pink)', 'var(--accent-teal)', 'var(--accent-yellow)', 'var(--accent-gray)',
                            '#EA580C', '#7C3AED', '#059669', '#4F46E5', '#0891B2', '#DC2626',
                            '#C2410C', '#9333EA', '#CA8A04', '#16A34A', '#2563EB', '#7C2D12',
                            '#92400E', '#166534', '#1E40AF', '#581C87', '#991B1B', '#BE123C',
                            '#A21CAF', '#5B21B6', '#1E3A8A', '#0F766E', '#15803D', '#6366F1'
                        ];
                        const color = colors[index % colors.length];
                        
                        return `
                            <div class="conversion-performance-card" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; position: relative; overflow: hidden;">
                                <!-- Rank Badge -->
                                <div style="position: absolute; top: -8px; right: -8px; width: 40px; height: 40px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 0.875rem; z-index: 2;">
                                    #${index + 1}
                                </div>
                                
                                <!-- Employee Image and Info -->
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    <div id="employee-conversion-image-${manager.account_incharge?.replace('@', '-').replace('.', '-')}" style="width: 60px; height: 60px; border-radius: 50%; background: ${color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.25rem; position: relative;">
                                        ${manager.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '??'}
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem 0;">${manager.name || 'Unknown'}</h4>
                                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${manager.account_incharge || ''}</p>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.25rem; font-weight: 700; color: ${color};">${manager.conversion_rate}%</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Success Rate</div>
                                    </div>
                                </div>
                                
                                <!-- Performance Metrics -->
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-top: 1rem;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.25rem; font-weight: 700; color: ${color};">${manager.converted_count}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Converted</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: var(--accent-blue);">${manager.total_quotations}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Total</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: var(--accent-green);">${manager.converted_value ? this.formatCurrencyShort(manager.converted_value) : '0'}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Conv. Value</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: var(--accent-purple);">${manager.avg_conversion_value ? this.formatCurrencyShort(manager.avg_conversion_value) : '0'}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Avg Conv.</div>
                                    </div>
                                </div>
                                
                                <!-- Conversion Progress Bar -->
                                <div style="margin-top: 1rem;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span style="font-size: 0.75rem; color: var(--text-secondary);">Conversion Performance</span>
                                        <span style="font-size: 0.75rem; color: var(--text-secondary);">${manager.performance_percentage?.toFixed(1)}%</span>
                                    </div>
                                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: ${color}; width: ${manager.performance_percentage}%; transition: width 0.3s ease;"></div>
                                    </div>
                                </div>
                                
                                <!-- Success Badge -->
                                ${manager.conversion_rate >= 50 ? `
                                    <div style="position: absolute; top: 1rem; left: 1rem; background: var(--accent-green); color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">
                                        <i class="fa fa-star"></i> Top Converter
                                    </div>
                                ` : manager.conversion_rate >= 25 ? `
                                    <div style="position: absolute; top: 1rem; left: 1rem; background: var(--accent-orange); color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">
                                        <i class="fa fa-thumbs-up"></i> Good Converter
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    calculateQuotationPerformance() {
        // Get all quotations excluding Cancelled, Lost, Expired
        const excludedStatuses = ['Cancelled', 'Lost', 'Expired'];
        const eligibleQuotations = this.data.filtered.filter(quote => 
            !excludedStatuses.includes(quote.status)
        );
        
        console.log('Quotation Performance - Total eligible quotations:', eligibleQuotations.length);
        console.log('Excluded statuses:', excludedStatuses);
        
        // Group by account_incharge
        const managerGroups = {};
        eligibleQuotations.forEach(quote => {
            const key = quote.account_incharge || 'Unknown';
            if (!managerGroups[key]) {
                managerGroups[key] = {
                    account_incharge: key,
                    name: quote.account_incharge_full_name || key,
                    quotations: [],
                    count: 0,
                    total_value: 0
                };
            }
            managerGroups[key].quotations.push(quote);
            managerGroups[key].count++;
            managerGroups[key].total_value += quote.base_grand_total || 0;
        });
        
        // Convert to array and calculate percentages
        const managers = Object.values(managerGroups);
        const maxCount = Math.max(...managers.map(m => m.count));
        
        managers.forEach(manager => {
            manager.percentage = maxCount > 0 ? (manager.count / maxCount) * 100 : 0;
        });
        
        // Sort by count descending
        managers.sort((a, b) => b.count - a.count);
        
        console.log('Manager performance data:', managers);
        
        // Load employee images asynchronously
        this.loadEmployeeImages(managers);
        
        return managers;
    }
    
    calculateValuePerformance() {
        // Get all quotations excluding Cancelled, Lost, Expired
        const excludedStatuses = ['Cancelled', 'Lost', 'Expired'];
        const eligibleQuotations = this.data.filtered.filter(quote => 
            !excludedStatuses.includes(quote.status)
        );
        
        console.log('Value Performance - Total eligible quotations:', eligibleQuotations.length);
        console.log('Excluded statuses:', excludedStatuses);
        
        // Group by account_incharge
        const managerGroups = {};
        eligibleQuotations.forEach(quote => {
            const key = quote.account_incharge || 'Unknown';
            const value = quote.base_grand_total || 0;
            
            if (!managerGroups[key]) {
                managerGroups[key] = {
                    account_incharge: key,
                    name: quote.account_incharge_full_name || key,
                    quotations: [],
                    count: 0,
                    total_value: 0
                };
            }
            managerGroups[key].quotations.push(quote);
            managerGroups[key].count++;
            managerGroups[key].total_value += value;
        });
        
        // Convert to array and calculate percentages and averages
        const managers = Object.values(managerGroups);
        const maxValue = Math.max(...managers.map(m => m.total_value));
        
        managers.forEach(manager => {
            manager.percentage = maxValue > 0 ? (manager.total_value / maxValue) * 100 : 0;
            manager.avg_value = manager.count > 0 ? manager.total_value / manager.count : 0;
        });
        
        // Sort by total value descending
        managers.sort((a, b) => b.total_value - a.total_value);
        
        console.log('Manager value performance data:', managers);
        
        // Load employee images asynchronously
        this.loadEmployeeImagesForValue(managers);
        
        return managers;
    }
    
    calculateConversionPerformance() {
        // Get all quotations in the filtered data
        const allQuotations = this.data.filtered;
        
        // Define successful conversion statuses
        const successfulStatuses = ['Ordered', 'Partially Ordered'];
        
        console.log('Conversion Performance - Total quotations:', allQuotations.length);
        console.log('Successful statuses:', successfulStatuses);
        
        // Group by account_incharge
        const managerGroups = {};
        allQuotations.forEach(quote => {
            const key = quote.account_incharge || 'Unknown';
            const value = quote.base_grand_total || 0;
            const isConverted = successfulStatuses.includes(quote.status);
            
            if (!managerGroups[key]) {
                managerGroups[key] = {
                    account_incharge: key,
                    name: quote.account_incharge_full_name || key,
                    total_quotations: 0,
                    converted_count: 0,
                    total_value: 0,
                    converted_value: 0,
                    conversion_rate: 0
                };
            }
            
            managerGroups[key].total_quotations++;
            managerGroups[key].total_value += value;
            
            if (isConverted) {
                managerGroups[key].converted_count++;
                managerGroups[key].converted_value += value;
            }
        });
        
        // Convert to array and calculate percentages and rates
        const managers = Object.values(managerGroups);
        const maxConversions = Math.max(...managers.map(m => m.converted_count));
        
        managers.forEach(manager => {
            // Calculate conversion rate percentage
            manager.conversion_rate = manager.total_quotations > 0 ? 
                ((manager.converted_count / manager.total_quotations) * 100).toFixed(1) : 0;
            
            // Calculate performance percentage for progress bar (based on converted count)
            manager.performance_percentage = maxConversions > 0 ? 
                (manager.converted_count / maxConversions) * 100 : 0;
                
            // Calculate average conversion value
            manager.avg_conversion_value = manager.converted_count > 0 ? 
                manager.converted_value / manager.converted_count : 0;
        });
        
        // Sort by converted count descending (who converted the most)
        managers.sort((a, b) => b.converted_count - a.converted_count);
        
        console.log('Manager conversion performance data:', managers);
        
        // Load employee images asynchronously
        this.loadEmployeeImagesForConversion(managers);
        
        return managers;
    }
    
    async loadEmployeeImagesForConversion(managers) {
        try {
            // Get all unique account incharges (email addresses)
            const userIds = managers.map(m => m.account_incharge).filter(Boolean);
            
            if (userIds.length === 0) return;
            
            // Fetch employee data
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Employee',
                    fields: ['name', 'user_id', 'image', 'employee_name'],
                    filters: [['user_id', 'in', userIds]],
                    limit: 500
                }
            });
            
            const employees = response.message || [];
            console.log('Employee data loaded for conversion performance:', employees);
            
            // Update images for each manager
            employees.forEach(employee => {
                if (employee.image && employee.user_id) {
                    const imageId = employee.user_id.replace('@', '-').replace(/\./g, '-');
                    const imageElement = document.getElementById(`employee-conversion-image-${imageId}`);
                    
                    if (imageElement) {
                        imageElement.innerHTML = `
                            <img src="${employee.image}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="${employee.employee_name || employee.user_id}">
                        `;
                    }
                }
            });
            
            // Draw the conversion performance chart
            this.drawConversionPerformanceChart(managers, employees);
            
        } catch (error) {
            console.error('Failed to load employee images for conversion performance:', error);
        }
    }
    
    drawConversionPerformanceChart(managers, employees = []) {
        const canvas = document.getElementById('conversionPerformanceChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const chartData = managers; // All salespeople
        
        // Chart dimensions - responsive to canvas size with extra space for rotated labels
        const padding = 80;
        const bottomPadding = 120; // Extra space for rotated names
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - padding - bottomPadding;
        const barWidth = Math.min(chartWidth / chartData.length * 0.8, 60); // Cap max bar width
        const maxValue = Math.max(...chartData.map(m => m.converted_count));
        
        // Colors (orange-based for conversion)
        const colors = [
            '#F59E0B', '#8B5CF6', '#10B981', '#3B82F6', '#06B6D4',
            '#EF4444', '#EC4899', '#14B8A6', '#F59E0B', '#6B7280',
            '#4F46E5', '#7C3AED', '#DC2626', '#EA580C', '#CA8A04', '#059669',
            '#0891B2', '#C2410C', '#9333EA', '#DC2626', '#16A34A', '#2563EB',
            '#7C2D12', '#92400E', '#166534', '#1E40AF', '#581C87', '#991B1B',
            '#BE123C', '#A21CAF', '#5B21B6', '#1E3A8A', '#0F766E', '#15803D'
        ];
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set background
        ctx.fillStyle = 'rgba(51, 65, 85, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars
        chartData.forEach((manager, index) => {
            const spacing = chartWidth / chartData.length;
            const x = padding + (index * spacing) + ((spacing - barWidth) / 2);
            const barHeight = (manager.converted_count / maxValue) * chartHeight * 0.8;
            const y = padding + chartHeight - barHeight;
            
            // Draw bar
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw conversion count on top of bar
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(manager.converted_count, x + barWidth/2, y - 10);
            
            // Draw conversion rate below count
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#10B981';
            ctx.fillText(`${manager.conversion_rate}%`, x + barWidth/2, y - 30);
            
            // Draw manager name at bottom (rotated) - positioned with proper spacing
            ctx.save();
            ctx.translate(x + barWidth/2, padding + chartHeight + 35);
            ctx.rotate(-Math.PI/4);
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(manager.name?.substring(0, 15) || 'Unknown', 0, 0);
            ctx.restore();
        });
        
        // Draw chart title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Top 10 Conversion Champions', canvas.width/2, 30);
    }
    
    async loadEmployeeImagesForValue(managers) {
        try {
            // Get all unique account incharges (email addresses)
            const userIds = managers.map(m => m.account_incharge).filter(Boolean);
            
            if (userIds.length === 0) return;
            
            // Fetch employee data
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Employee',
                    fields: ['name', 'user_id', 'image', 'employee_name'],
                    filters: [['user_id', 'in', userIds]],
                    limit: 500
                }
            });
            
            const employees = response.message || [];
            console.log('Employee data loaded for value performance:', employees);
            
            // Update images for each manager
            employees.forEach(employee => {
                if (employee.image && employee.user_id) {
                    const imageId = employee.user_id.replace('@', '-').replace(/\./g, '-');
                    const imageElement = document.getElementById(`employee-value-image-${imageId}`);
                    
                    if (imageElement) {
                        imageElement.innerHTML = `
                            <img src="${employee.image}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="${employee.employee_name || employee.user_id}">
                        `;
                    }
                }
            });
            
            // Draw the value performance chart
            this.drawValuePerformanceChart(managers, employees);
            
        } catch (error) {
            console.error('Failed to load employee images for value performance:', error);
        }
    }
    
    drawValuePerformanceChart(managers, employees = []) {
        const canvas = document.getElementById('valuePerformanceChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const chartData = managers; // All salespeople by value
        
        // Chart dimensions - responsive to canvas size with extra space for rotated labels
        const padding = 80;
        const bottomPadding = 120; // Extra space for rotated names
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - padding - bottomPadding;
        const barWidth = Math.min(chartWidth / chartData.length * 0.8, 60); // Cap max bar width
        const maxValue = Math.max(...chartData.map(m => m.total_value));
        
        // Colors (different from count chart)
        const colors = [
            '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4',
            '#EF4444', '#EC4899', '#14B8A6', '#F59E0B', '#6B7280',
            '#059669', '#4F46E5', '#7C3AED', '#DC2626', '#EA580C', '#CA8A04',
            '#0891B2', '#C2410C', '#9333EA', '#DC2626', '#16A34A', '#2563EB',
            '#7C2D12', '#92400E', '#166534', '#1E40AF', '#581C87', '#991B1B',
            '#BE123C', '#A21CAF', '#5B21B6', '#1E3A8A', '#0F766E', '#15803D'
        ];
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set background
        ctx.fillStyle = 'rgba(51, 65, 85, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars
        chartData.forEach((manager, index) => {
            const spacing = chartWidth / chartData.length;
            const x = padding + (index * spacing) + ((spacing - barWidth) / 2);
            const barHeight = (manager.total_value / maxValue) * chartHeight * 0.8;
            const y = padding + chartHeight - barHeight;
            
            // Draw bar
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw value on top of bar (formatted)
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            const formattedValue = this.formatCurrencyShort(manager.total_value);
            ctx.fillText(formattedValue, x + barWidth/2, y - 10);
            
            // Draw manager name at bottom (rotated) - positioned with proper spacing
            ctx.save();
            ctx.translate(x + barWidth/2, padding + chartHeight + 35);
            ctx.rotate(-Math.PI/4);
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(manager.name?.substring(0, 15) || 'Unknown', 0, 0);
            ctx.restore();
        });
        
        // Draw chart title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Top 10 Value Performers', canvas.width/2, 30);
    }
    
    formatCurrencyShort(amount) {
        if (amount >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}K`;
        } else {
            return amount.toFixed(0);
        }
    }
    
    async loadEmployeeImages(managers) {
        try {
            // Get all unique account incharges (email addresses)
            const userIds = managers.map(m => m.account_incharge).filter(Boolean);
            
            if (userIds.length === 0) return;
            
            // Fetch employee data
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Employee',
                    fields: ['name', 'user_id', 'image', 'employee_name'],
                    filters: [['user_id', 'in', userIds]],
                    limit: 500
                }
            });
            
            const employees = response.message || [];
            console.log('Employee data loaded:', employees);
            
            // Update images for each manager
            employees.forEach(employee => {
                if (employee.image && employee.user_id) {
                    const imageId = employee.user_id.replace('@', '-').replace(/\./g, '-');
                    const imageElement = document.getElementById(`employee-image-${imageId}`);
                    
                    if (imageElement) {
                        imageElement.innerHTML = `
                            <img src="${employee.image}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="${employee.employee_name || employee.user_id}">
                        `;
                    }
                }
            });
            
            // Draw the performance chart
            this.drawQuotationPerformanceChart(managers, employees);
            
        } catch (error) {
            console.error('Failed to load employee images:', error);
        }
    }
    
    drawQuotationPerformanceChart(managers, employees = []) {
        const canvas = document.getElementById('quotationPerformanceChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const chartData = managers; // All salespeople
        
        // Chart dimensions - responsive to canvas size with extra space for rotated labels
        const padding = 80;
        const bottomPadding = 120; // Extra space for rotated names
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - padding - bottomPadding;
        const barWidth = Math.min(chartWidth / chartData.length * 0.8, 60); // Cap max bar width
        const maxValue = Math.max(...chartData.map(m => m.count));
        
        // Colors
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4',
            '#EF4444', '#EC4899', '#14B8A6', '#F59E0B', '#6B7280',
            '#4F46E5', '#7C3AED', '#DC2626', '#EA580C', '#CA8A04', '#059669',
            '#0891B2', '#C2410C', '#9333EA', '#DC2626', '#16A34A', '#2563EB',
            '#7C2D12', '#92400E', '#166534', '#1E40AF', '#581C87', '#991B1B',
            '#BE123C', '#A21CAF', '#5B21B6', '#1E3A8A', '#0F766E', '#15803D'
        ];
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set background
        ctx.fillStyle = 'rgba(51, 65, 85, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars
        chartData.forEach((manager, index) => {
            const spacing = chartWidth / chartData.length;
            const x = padding + (index * spacing) + ((spacing - barWidth) / 2);
            const barHeight = (manager.count / maxValue) * chartHeight * 0.8;
            const y = padding + chartHeight - barHeight;
            
            // Draw bar
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw count on top of bar
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(manager.count, x + barWidth/2, y - 10);
            
            // Draw manager name at bottom (rotated) - positioned with proper spacing
            ctx.save();
            ctx.translate(x + barWidth/2, padding + chartHeight + 35);
            ctx.rotate(-Math.PI/4);
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(manager.name?.substring(0, 15) || 'Unknown', 0, 0);
            ctx.restore();
        });
        
        // Draw chart title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Top 10 Quotation Creators', canvas.width/2, 30);
    }
    
    switchConversionTab(tabName) {
        // Remove active class from all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.remove('active');
            button.style.background = 'rgba(51, 65, 85, 0.3)';
            button.style.color = 'var(--text-primary)';
            button.style.fontWeight = '500';
            button.style.boxShadow = 'none';
        });

        // Hide all tab panels
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabPanels.forEach(panel => {
            panel.classList.remove('active');
            panel.style.display = 'none';
        });

        // Show selected tab
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        const activePanel = document.getElementById(`${tabName}-tab`);
        
        if (activeButton && activePanel) {
            activeButton.classList.add('active');
            activeButton.style.background = 'var(--accent-blue)';
            activeButton.style.color = 'white';
            activeButton.style.fontWeight = '600';
            activeButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            
            activePanel.classList.add('active');
            activePanel.style.display = 'block';
            
            // If switching to performance tab, redraw chart
            if (tabName === 'performance') {
                setTimeout(() => {
                    const managers = this.calculateQuotationPerformance();
                    this.drawQuotationPerformanceChart(managers);
                }, 100);
            }
            
            // If switching to value performance tab, redraw chart
            if (tabName === 'value-performance') {
                setTimeout(() => {
                    const managers = this.calculateValuePerformance();
                    this.drawValuePerformanceChart(managers);
                }, 100);
            }
            
            // If switching to conversion performance tab, redraw chart
            if (tabName === 'conversion-performance') {
                setTimeout(() => {
                    const managers = this.calculateConversionPerformance();
                    this.drawConversionPerformanceChart(managers);
                }, 100);
            }
        }
    }

    renderMarginSection() {
        const stats = this.data.stats.margin;
        
        return `
            <div class="margin-container">
                <!-- Margin Overview -->
                <div class="stats-grid mb-4">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-percentage" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Average Margin
                                </h3>
                                <p class="stat-card-value">${stats.avgMargin}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-chart-line" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    Across all quotations
                                </p>
                            </div>
                            <div class="stat-card-icon">
                                <i class="fa fa-percentage"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('low_margin_quotes')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-exclamation-triangle" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Low Margin Quotes
                                </h3>
                                <p class="stat-card-value">${stats.lowMargin.length}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-arrow-down" style="color: var(--accent-red); margin-right: 0.25rem;"></i>
                                    Below 15% margin
                                </p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-exclamation-triangle"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-chart-line" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    High Margin Quotes
                                </h3>
                                <p class="stat-card-value">${stats.sorted.filter(q => parseFloat(q.margin_percentage) > 30).length}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-arrow-up" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    Above 30% margin
                                </p>
                            </div>
                            <div class="stat-card-icon success">
                                <i class="fa fa-chart-line"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-user-tie" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                    Top Margin Manager
                                </h3>
                                <p class="stat-card-value">${stats.accountManagerWise[0]?.avg_margin || 0}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-star" style="color: var(--accent-orange); margin-right: 0.25rem;"></i>
                                    ${stats.accountManagerWise[0]?.name || 'N/A'}
                                </p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-user-tie"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Account Manager-wise Margin Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-user-tie"></i>
                            Account Manager Margin Performance
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-chart-pie"></i>
                            <span>Margin analysis by account manager</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('manager-margins', stats.accountManagerWise, [
                        { key: 'name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                        { key: 'total_quotes', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'total_amount', label: 'Total Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'total_margin_amount', label: 'Margin Amount', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'avg_margin', label: 'Avg Margin %', sortable: true, type: 'margin', icon: 'fa-percentage' },
                        { key: 'margin_percentage', label: 'Overall Margin %', sortable: true, type: 'margin', icon: 'fa-chart-line' }
                    ])}
                </div>
                
                <!-- Branch-wise Margin Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-map-marker-alt"></i>
                            Branch Margin Performance
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-map"></i>
                            <span>Regional margin analysis</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('branch-margins', stats.branchWise, [
                        { key: 'name', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
                        { key: 'total_quotes', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'total_amount', label: 'Total Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'total_margin_amount', label: 'Margin Amount', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'avg_margin', label: 'Avg Margin %', sortable: true, type: 'margin', icon: 'fa-percentage' },
                        { key: 'margin_percentage', label: 'Overall Margin %', sortable: true, type: 'margin', icon: 'fa-chart-line' }
                    ])}
                </div>
                
                <!-- Detailed Margin Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-chart-line"></i>
                            Detailed Margin Analysis
                        </h2>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                                <i class="fa fa-sort-amount-down"></i>
                                <span>Sorted by highest margin</span>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showDrilldown('low_margin_quotes')">
                                <i class="fa fa-exclamation-triangle"></i>
                                View Low Margin
                            </button>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('margin-analysis', stats.sorted, [
                        { key: 'quotation', label: 'Quotation', sortable: true, icon: 'fa-file-alt' },
                        { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                        { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'margin_amount', label: 'Margin Amount', sortable: true, type: 'currency', icon: 'fa-dollar-sign' },
                        { key: 'margin_percentage', label: 'Margin %', sortable: true, type: 'margin', icon: 'fa-percentage' },
                        { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' }
                    ])}
                </div>
            </div>
        `;
    }

    renderItemsSection() {
        const stats = this.data.stats.items;
        
        return `
            <div class="items-container">
                <!-- Items Overview -->
                <div class="stats-grid mb-4">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-cube" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Total Items
                                </h3>
                                <p class="stat-card-value">${stats.all.length}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-tags" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    Unique items quoted
                                </p>
                            </div>
                            <div class="stat-card-icon">
                                <i class="fa fa-cube"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-star" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Most Popular Stock Item
                                </h3>
                                <p class="stat-card-value">${stats.mostPopularStockItem?.quote_count || 0}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-trophy" style="color: var(--accent-orange); margin-right: 0.25rem;"></i>
                                    ${stats.mostPopularStockItem?.item_code || 'N/A'}
                                </p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-star"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-money-bill-wave" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    Highest Value Item
                                </h3>
                                <p class="stat-card-value">AED ${this.formatCurrency(stats.mostQuotedByValue[0]?.total_value || 0)}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-gem" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    ${stats.mostQuotedByValue[0]?.item_code || 'N/A'}
                                </p>
                            </div>
                            <div class="stat-card-icon success">
                                <i class="fa fa-money-bill-wave"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-chart-line" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                    Avg Item Margin
                                </h3>
                                <p class="stat-card-value">${stats.all.length > 0 ? 
                                    (stats.all.reduce((sum, item) => sum + parseFloat(item.avg_margin), 0) / stats.all.length).toFixed(1) : 0}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-percentage" style="color: var(--accent-purple); margin-right: 0.25rem;"></i>
                                    Across all items
                                </p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-chart-line"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-crown" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Top Category
                                </h3>
                                <p class="stat-card-value">${stats.topCategoryByCount.item_count}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-layer-group" style="color: var(--accent-orange); margin-right: 0.25rem;"></i>
                                    ${stats.topCategoryByCount.name}
                                </p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-crown"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Most Quoted Items by Count with Images -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-sort-numeric-down"></i>
                            Most Quoted Items (By Count)
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-hashtag"></i>
                            <span>Items with highest quote frequency</span>
                        </div>
                    </div>
                    
                    <div class="items-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                        ${stats.mostQuotedByCount.slice(0, 12).map(item => `
                            <div class="item-card" style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; cursor: pointer; transition: all 0.3s ease;" onclick="frappe.sales_intelligence.showItemDetails('${item.item_code}')">
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                    ${item.image ? 
                                        `<img src="${item.image}" alt="${item.item_code}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; border: 2px solid var(--border-color);">` : 
                                        `<div style="width: 60px; height: 60px; border-radius: 12px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
                                            <i class="fa fa-cube"></i>
                                        </div>`
                                    }
                                    <div style="flex: 1; min-width: 0;">
                                        <h4 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.item_code}</h4>
                                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0; display: flex; align-items: center; gap: 0.25rem;">
                                            <i class="fa fa-quote-left" style="font-size: 0.75rem;"></i>
                                            ${item.quote_count} quotes
                                        </p>
                                        ${item.brand ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.25rem 0 0 0; display: flex; align-items: center; gap: 0.25rem;">
                                            <i class="fa fa-tag" style="font-size: 0.6rem;"></i>
                                            ${item.brand}
                                        </p>` : ''}
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary);">${item.total_qty}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Total Qty</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: var(--accent-green);">AED ${this.formatCurrency(item.total_value)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Total Value</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1rem; font-weight: 600; color: ${this.getMarginClass(item.avg_margin) === 'success' ? 'var(--accent-green)' : this.getMarginClass(item.avg_margin) === 'danger' ? 'var(--accent-red)' : 'var(--accent-orange)'};">${item.avg_margin}%</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Avg Margin</div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.75rem;">
                                        <i class="fa fa-eye"></i>
                                        <span>Click to view details</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--accent-blue); font-weight: 600;">#${stats.mostQuotedByCount.indexOf(item) + 1}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${this.renderTableWithControls('items-by-count', stats.mostQuotedByCount, [
                        { key: 'item_code', label: 'Item', sortable: true, icon: 'fa-cube', type: 'item_with_image' },
                        { key: 'brand', label: 'Brand', sortable: true, icon: 'fa-tag' },
                        { key: 'category', label: 'Category', sortable: true, icon: 'fa-layer-group' },
                        { key: 'quote_count', label: 'Quote Count', sortable: true, icon: 'fa-hashtag' },
                        { key: 'total_qty', label: 'Total Qty', sortable: true, icon: 'fa-boxes' },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'total_cost', label: 'Total Cost', sortable: true, type: 'currency', icon: 'fa-coins' },
                        { key: 'total_profit', label: 'Total Profit', sortable: true, type: 'currency', icon: 'fa-chart-line' },
                        { key: 'avg_margin', label: 'Avg Margin', sortable: true, type: 'margin', icon: 'fa-percentage' }
                    ])}
                </div>
                
                <!-- Most Quoted Items by Value -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-dollar-sign"></i>
                            Most Quoted Items (By Value)
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-money-bill-wave"></i>
                            <span>Items with highest total value</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('items-by-value', stats.mostQuotedByValue, [
                        { key: 'item_code', label: 'Item Code', sortable: true, icon: 'fa-cube' },
                        { key: 'brand', label: 'Brand', sortable: true, icon: 'fa-tag' },
                        { key: 'category', label: 'Category', sortable: true, icon: 'fa-layer-group' },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'total_cost', label: 'Total Cost', sortable: true, type: 'currency', icon: 'fa-coins' },
                        { key: 'total_profit', label: 'Total Profit', sortable: true, type: 'currency', icon: 'fa-chart-line' },
                        { key: 'quote_count', label: 'Quote Count', sortable: true, icon: 'fa-hashtag' },
                        { key: 'total_qty', label: 'Total Qty', sortable: true, icon: 'fa-boxes' },
                        { key: 'avg_margin', label: 'Avg Margin', sortable: true, type: 'margin', icon: 'fa-percentage' }
                    ])}
                </div>
                
                <!-- Low Margin Items -->
                ${stats.lowMarginItems.length > 0 ? `
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-exclamation-triangle"></i>
                            Low Margin Items
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-arrow-down"></i>
                            <span>Items with margin below 15%</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('low-margin-items', stats.lowMarginItems, [
                        { key: 'item_code', label: 'Item Code', sortable: true, icon: 'fa-cube' },
                        { key: 'brand', label: 'Brand', sortable: true, icon: 'fa-tag' },
                        { key: 'category', label: 'Category', sortable: true, icon: 'fa-layer-group' },
                        { key: 'avg_margin', label: 'Avg Margin', sortable: true, type: 'margin', icon: 'fa-percentage' },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'total_cost', label: 'Total Cost', sortable: true, type: 'currency', icon: 'fa-coins' },
                        { key: 'total_profit', label: 'Total Profit', sortable: true, type: 'currency', icon: 'fa-chart-line' },
                        { key: 'quote_count', label: 'Quote Count', sortable: true, icon: 'fa-hashtag' }
                    ])}
                </div>
                ` : ''}
            </div>
        `;
    }

    renderFollowupSection() {
        const stats = this.data.stats.followup;
        
        return `
            <div class="followup-container">
                <!-- Follow-up Overview -->
                <div class="stats-grid mb-4">
                    <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('no_followups')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-exclamation-circle" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    No Follow-ups
                                </h3>
                                <p class="stat-card-value">${stats.noFollowups.length}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-money-bill-wave" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    AED ${this.formatCurrency(stats.noFollowups.reduce((sum, q) => sum + (q.base_grand_total || 0), 0))}
                                </p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-exclamation-circle"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>
                    
                    <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('need_followup')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-phone" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                    Need Follow-up
                                </h3>
                                <p class="stat-card-value">${stats.needFollowup.length}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-money-bill-wave" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    AED ${this.formatCurrency(stats.needFollowup.reduce((sum, q) => sum + (q.base_grand_total || 0), 0))}
                                </p>
                            </div>
                            <div class="stat-card-icon danger">
                                <i class="fa fa-phone"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-exclamation-triangle" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                    Total At Risk Value
                                </h3>
                                <p class="stat-card-value">AED ${this.formatCurrency(stats.totalPendingValue)}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-bell" style="color: var(--accent-red); margin-right: 0.25rem;"></i>
                                    Needs immediate attention
                                </p>
                            </div>
                            <div class="stat-card-icon danger">
                                <i class="fa fa-exclamation-triangle"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-calendar-check" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Follow-up Rate
                                </h3>
                                <p class="stat-card-value">${this.data.filtered.length > 0 ? 
                                    (((this.data.filtered.length - stats.noFollowups.length) / this.data.filtered.length) * 100).toFixed(1) : 0}%</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-chart-line" style="color: var(--accent-blue); margin-right: 0.25rem;"></i>
                                    Quotations with follow-ups
                                </p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-calendar-check"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- No Follow-ups Table -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-exclamation-circle"></i>
                            Quotations with No Follow-ups
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-clock"></i>
                            <span>Urgent attention required</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('no-followups', stats.noFollowups, [
                        { key: 'quotation', label: 'Quotation', sortable: true, icon: 'fa-file-alt' },
                        { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                        { key: 'valid_till', label: 'Valid Till', sortable: true, type: 'date', icon: 'fa-calendar-times' },
                        { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                        { key: 'days_since_created', label: 'Days Since', sortable: true, type: 'days', icon: 'fa-clock' }
                    ])}
                </div>
                
                <!-- Need Follow-up Table -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-phone"></i>
                            Quotations Needing Follow-up
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-bell"></i>
                            <span>Follow-up actions required</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('need-followups', stats.needFollowup, [
                        { key: 'quotation', label: 'Quotation', sortable: true, icon: 'fa-file-alt' },
                        { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                        { key: 'valid_till', label: 'Valid Till', sortable: true, type: 'date', icon: 'fa-calendar-times' },
                        { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                        { key: 'days_to_expiry', label: 'Days to Expiry', sortable: true, type: 'expiry', icon: 'fa-hourglass-end' }
                    ])}
                </div>
            </div>
        `;
    }

    renderCustomersSection() {
        const stats = this.data.stats.customers;
        
        return `
            <div class="customers-container">
                <!-- Customer Overview -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-users" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Total Customers
                                </h3>
                                <p class="stat-card-value">${stats.insights.total_customers}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-calendar" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    Active in period
                                </p>
                            </div>
                            <div class="stat-card-icon">
                                <i class="fa fa-users"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-chart-line" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    Average Customer Value
                                </h3>
                                <p class="stat-card-value">AED ${this.formatCurrency(stats.insights.avg_customer_value)}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-user" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    Per customer
                                </p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-chart-line"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-heart" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                    Active Customers
                                </h3>
                                <p class="stat-card-value">${stats.insights.active_customers}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-percentage" style="color: var(--accent-green); margin-right: 0.25rem;"></i>
                                    ${stats.insights.customer_retention_rate}% retention
                                </p>
                            </div>
                            <div class="stat-card-icon success">
                                <i class="fa fa-heart"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-file-alt" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Avg Quotes per Customer
                                </h3>
                                <p class="stat-card-value">${stats.insights.avg_quotes_per_customer.toFixed(1)}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-chart-bar" style="color: var(--accent-orange); margin-right: 0.25rem;"></i>
                                    Quote frequency
                                </p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-file-alt"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Customer Segmentation -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-layer-group"></i>
                            Customer Segmentation
                        </h2>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                                <i class="fa fa-users-cog"></i>
                                <span>Customer categories based on value, conversion rate, and engagement patterns</span>
                            </div>
                            <div style="background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--accent-blue);">
                                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                                    <strong style="color: var(--accent-blue);">💡 How Classifications Work:</strong><br>
                                    Customers are automatically categorized based on their business value, quote conversion rates, and recent activity patterns to help you prioritize your sales efforts effectively.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="customer-segmentation">
                        <div class="segment-card segment-vip" onclick="frappe.sales_intelligence.showCustomerSegment('vip')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-orange), #d97706); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-crown"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.vip.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-orange); margin: 0 0 0.5rem 0;">${stats.segments.vip.name}</p>
                                <div style="background: rgba(249, 115, 22, 0.1); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
                                    <p style="font-size: 0.75rem; color: var(--accent-orange); margin: 0 0 0.25rem 0; font-weight: 600;">Criteria:</p>
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${stats.segments.vip.criteria}</p>
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${stats.segments.vip.description}</p>
                            </div>
                        </div>
                        
                        <div class="segment-card segment-loyal" onclick="frappe.sales_intelligence.showCustomerSegment('loyal')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-green), #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-handshake"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.loyal.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-green); margin: 0 0 0.5rem 0;">${stats.segments.loyal.name}</p>
                                <div style="background: rgba(16, 185, 129, 0.1); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
                                    <p style="font-size: 0.75rem; color: var(--accent-green); margin: 0 0 0.25rem 0; font-weight: 600;">Criteria:</p>
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${stats.segments.loyal.criteria}</p>
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${stats.segments.loyal.description}</p>
                            </div>
                        </div>
                        
                        <div class="segment-card segment-potential" onclick="frappe.sales_intelligence.showCustomerSegment('potential')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-blue), #2563eb); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-rocket"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.potential.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-blue); margin: 0 0 0.5rem 0;">${stats.segments.potential.name}</p>
                                <div style="background: rgba(59, 130, 246, 0.1); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
                                    <p style="font-size: 0.75rem; color: var(--accent-blue); margin: 0 0 0.25rem 0; font-weight: 600;">Criteria:</p>
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${stats.segments.potential.criteria}</p>
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${stats.segments.potential.description}</p>
                            </div>
                        </div>
                        
                        <div class="segment-card segment-atrisk" onclick="frappe.sales_intelligence.showCustomerSegment('atrisk')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-red), #dc2626); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-exclamation-triangle"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.atrisk.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-red); margin: 0 0 0.5rem 0;">${stats.segments.atrisk.name}</p>
                                <div style="background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
                                    <p style="font-size: 0.75rem; color: var(--accent-red); margin: 0 0 0.25rem 0; font-weight: 600;">Criteria:</p>
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${stats.segments.atrisk.criteria}</p>
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${stats.segments.atrisk.description}</p>
                            </div>
                        </div>
                        
                        <!-- Top Customer by Quotation Count -->
                        <div class="segment-card segment-top-quotes" onclick="frappe.sales_intelligence.showTopQuoteCustomer()">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-purple, #8b5cf6), #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-chart-bar"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.topQuoteCustomers && stats.segments.topQuoteCustomers.length > 0 ? stats.segments.topQuoteCustomers[0].total_quotes : 0}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-purple, #8b5cf6); margin: 0 0 0.5rem 0;">Top 5 Customers</p>
                                <div style="background: rgba(139, 92, 246, 0.1); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
                                    <p style="font-size: 0.75rem; color: var(--accent-purple, #8b5cf6); margin: 0 0 0.25rem 0; font-weight: 600;">#1 Customer:</p>
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; word-break: break-word;">${stats.segments.topQuoteCustomers && stats.segments.topQuoteCustomers.length > 0 ? stats.segments.topQuoteCustomers[0].name : 'No data'}</p>
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">Top 5 customers by quotation volume with detailed rankings, values, and conversion analytics.</p>
                            </div>
                        </div>
                        
                        <!-- 5 Continuous Non-Converting Customers -->
                        <div class="segment-card segment-continuous-quotes" onclick="frappe.sales_intelligence.showContinuousQuoteCustomers()">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-yellow, #f59e0b), #d97706); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-refresh"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.continuousQuoteCustomers ? stats.continuousQuoteCustomers.length : 0}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-yellow, #f59e0b); margin: 0 0 0.5rem 0;">Continuous Non-Converting</p>
                                <div style="background: rgba(245, 158, 11, 0.1); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
                                    <p style="font-size: 0.75rem; color: var(--accent-yellow, #f59e0b); margin: 0 0 0.25rem 0; font-weight: 600;">Criteria:</p>
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">5+ consecutive quotes without conversion</p>
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">Customers taking multiple quotes but not converting. Requires immediate attention and strategy review.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Top Customers by Value -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-trophy"></i>
                            Top Customers by Value
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-dollar-sign"></i>
                            <span>Highest value customers</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('customers-by-value', stats.top_by_value, [
                        { key: 'name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'total_quotes', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'won_quotes', label: 'Won', sortable: true, icon: 'fa-trophy' },
                        { key: 'conversion_rate', label: 'Conversion', sortable: true, type: 'conversion', icon: 'fa-percentage' },
                        { key: 'avg_margin', label: 'Avg Margin', sortable: true, type: 'margin', icon: 'fa-chart-line' },
                        { key: 'days_since_last_quote', label: 'Days Since Last', sortable: true, type: 'days', icon: 'fa-clock' }
                    ])}
                </div>
                
                <!-- Top Customers by Conversion -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-star"></i>
                            Top Customers by Conversion Rate
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-chart-line"></i>
                            <span>Best converting customers (min 3 quotes)</span>
                        </div>
                    </div>
                    
                    ${this.renderTableWithControls('customers-by-conversion', stats.top_by_conversion, [
                        { key: 'name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'conversion_rate', label: 'Conversion', sortable: true, type: 'conversion', icon: 'fa-percentage' },
                        { key: 'total_quotes', label: 'Total Quotes', sortable: true, icon: 'fa-list' },
                        { key: 'won_quotes', label: 'Won Quotes', sortable: true, icon: 'fa-trophy' },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'avg_margin', label: 'Avg Margin', sortable: true, type: 'margin', icon: 'fa-chart-line' },
                        { key: 'customer_lifetime_days', label: 'Customer Since', sortable: true, type: 'days', icon: 'fa-calendar' }
                    ])}
                </div>
                
                <!-- Customer Activity Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-chart-bar"></i>
                            Customer Activity Analysis
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-activity"></i>
                            <span>Recent customer engagement patterns</span>
                        </div>
                    </div>
                    
                    <div class="insight-cards">
                        <div class="insight-card">
                            <div class="insight-header">
                                <h4 class="insight-title">
                                    <i class="fa fa-fire" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                    Hot Prospects
                                </h4>
                                <div class="insight-icon" style="background: linear-gradient(135deg, var(--accent-red), #dc2626);">
                                    <i class="fa fa-fire"></i>
                                </div>
                            </div>
                            <div class="insight-value">${stats.all.filter(c => c.pending_quotes > 0 && c.days_since_last_quote <= 7).length}</div>
                            <div class="insight-change positive">
                                <i class="fa fa-arrow-up"></i>
                                Active in last 7 days
                            </div>
                        </div>
                        
                        <div class="insight-card">
                            <div class="insight-header">
                                <h4 class="insight-title">
                                    <i class="fa fa-clock" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Inactive Customers
                                </h4>
                                <div class="insight-icon" style="background: linear-gradient(135deg, var(--accent-orange), #d97706);">
                                    <i class="fa fa-clock"></i>
                                </div>
                            </div>
                            <div class="insight-value">${stats.all.filter(c => c.days_since_last_quote > 90).length}</div>
                            <div class="insight-change negative">
                                <i class="fa fa-arrow-down"></i>
                                No activity in 90+ days
                            </div>
                        </div>
                        
                        <div class="insight-card">
                            <div class="insight-header">
                                <h4 class="insight-title">
                                    <i class="fa fa-repeat" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    Repeat Customers
                                </h4>
                                <div class="insight-icon" style="background: linear-gradient(135deg, var(--accent-green), #059669);">
                                    <i class="fa fa-repeat"></i>
                                </div>
                            </div>
                            <div class="insight-value">${stats.all.filter(c => c.total_quotes >= 3).length}</div>
                            <div class="insight-change positive">
                                <i class="fa fa-arrow-up"></i>
                                3+ quotations
                            </div>
                        </div>
                        
                        <div class="insight-card">
                            <div class="insight-header">
                                <h4 class="insight-title">
                                    <i class="fa fa-gem" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                    High Value Deals
                                </h4>
                                <div class="insight-icon" style="background: linear-gradient(135deg, var(--accent-purple), #7c3aed);">
                                    <i class="fa fa-gem"></i>
                                </div>
                            </div>
                            <div class="insight-value">${stats.all.filter(c => c.total_value > 100000).length}</div>
                            <div class="insight-change positive">
                                <i class="fa fa-arrow-up"></i>
                                AED 100K+ value
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Enhanced table rendering with comprehensive search and sort
    renderTableWithControls(tableId, data, columns) {
        const searchId = `${tableId}-search`;
        // Set pageSize based on table type - larger for opportunity tabs  
        let pageSize = 50; // Default records per page
        if (tableId.includes('design-request') || tableId.includes('site-visit') || tableId.includes('permit')) {
            pageSize = 500; // Show more records for opportunity tabs
        }
        
        // Initialize table state if not exists
        if (!this.tableStates) this.tableStates = {};
        if (!this.tableStates[tableId]) {
            this.tableStates[tableId] = { currentPage: 1, filteredData: data };
        } else {
            // Update filtered data if it's different (for dynamic data like drilldowns)
            this.tableStates[tableId].filteredData = data;
            // Reset to page 1 for new data
            this.tableStates[tableId].currentPage = 1;
        }
        
        const currentPage = this.tableStates[tableId].currentPage;
        const totalPages = Math.ceil(data.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, data.length);
        const currentData = data.slice(startIndex, endIndex);
        
        return `
            <div class="table-controls">
                <div class="table-controls-left">
                    <div class="table-search">
                        <i class="fa fa-search"></i>
                        <input type="text" id="${searchId}" placeholder="Search in table..." oninput="frappe.sales_intelligence.filterTable('${tableId}', this.value)">
                    </div>
                    <div class="table-info">
                        <i class="fa fa-info-circle"></i>
                        <span id="${tableId}-info">Showing ${startIndex + 1}-${endIndex} of ${data.length} records</span>
                    </div>
                </div>
                <div class="table-controls-right">
                    <div class="table-sort-controls">
                        <span class="sort-label">Sort by:</span>
                        <select class="sort-select" onchange="frappe.sales_intelligence.sortTable('${tableId}', this.value)" id="${tableId}-sort-select">
                            ${columns.filter(col => col.sortable).map(col => 
                                `<option value="${col.key}">${col.label}</option>`
                            ).join('')}
                        </select>
                        <button class="sort-order-btn" onclick="frappe.sales_intelligence.toggleSortOrder('${tableId}')" id="${tableId}-sort-order" title="Toggle sort order">
                            <i class="fa fa-sort-amount-down"></i>
                        </button>
                    </div>
                    ${this.isItemsTable(tableId) ? `
                    <div class="table-category-controls">
                        <span class="filter-label">Category:</span>
                        <select class="category-select" onchange="frappe.sales_intelligence.filterTableByCategory('${tableId}', this.value)" id="${tableId}-category-select">
                            <option value="">All</option>
                            ${this.getUniqueCategories(data).map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    ` : ''}
                    ${data.length > pageSize ? `
                    <div class="pagination-controls">
                        <button class="btn btn-sm btn-outline-secondary" onclick="frappe.sales_intelligence.changeTablePage('${tableId}', ${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
                            <i class="fa fa-chevron-left"></i>
                        </button>
                        <span class="page-info">${currentPage} / ${totalPages}</span>
                        <button class="btn btn-sm btn-outline-secondary" onclick="frappe.sales_intelligence.changeTablePage('${tableId}', ${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>
                            <i class="fa fa-chevron-right"></i>
                        </button>
                        <button class="btn btn-sm btn-primary ml-2" onclick="frappe.sales_intelligence.showAllRecords('${tableId}')" title="Show all records in new modal">
                            <i class="fa fa-list"></i> All (${data.length})
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="data-table" id="${tableId}">
                    <thead>
                        <tr>
                            ${columns.map(col => `
                                <th ${col.sortable ? `class="sortable" onclick="frappe.sales_intelligence.sortTableByColumn('${tableId}', '${col.key}')"` : ''}>
                                    ${col.icon ? `<i class="fa ${col.icon}" style="margin-right: 0.5rem; color: var(--accent-blue);"></i>` : ''}
                                    ${col.label}
                                    ${col.sortable ? '<i class="sort-icon fa fa-sort"></i>' : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.renderTableRows(currentData, columns)}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderTableRows(data, columns) {
        return data.map(item => {
            const isQuotation = item.quotation;
            const clickHandler = isQuotation ? 
                `onclick="frappe.sales_intelligence.showQuotationDetails('${item.quotation}')"` : 
                item.name && !item.total_quotes ? `onclick="frappe.sales_intelligence.showCustomerDetails('${item.name}')"` : '';
                
            return `
                <tr ${clickHandler} class="table-row" style="${clickHandler ? 'cursor: pointer;' : ''}">
                    ${columns.map(col => {
                        if (col.type === 'date') {
                            return `<td>${item[col.key] ? frappe.datetime.str_to_user(item[col.key]) : '-'}</td>`;
                        } else if (col.type === 'currency') {
                            return `<td>AED ${this.formatCurrency(item[col.key] || 0)}</td>`;
                        } else if (col.type === 'badge') {
                            const statusIcon = this.getStatusIcon(item[col.key]);
                            return `<td><span class="status-badge ${this.getStatusClass(item[col.key])}"><i class="fa ${statusIcon}" style="margin-right: 0.25rem;"></i>${item[col.key] || '-'}</span></td>`;
                        } else if (col.type === 'margin') {
                            const margin = item[col.key] || 0;
                            return `<td><span class="margin-badge ${this.getMarginClass(margin)}">${margin}%</span></td>`;
                        } else if (col.type === 'conversion') {
                            const rate = item[col.key] || 0;
                            return `<td>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="font-weight: 600; color: var(--text-primary); min-width: 40px;">${rate}%</span>
                                    <div style="flex: 1; height: 6px; background: rgba(148, 163, 184, 0.2); border-radius: 3px; overflow: hidden; max-width: 80px;">
                                        <div style="width: ${rate}%; height: 100%; background: ${this.getConversionColor(rate)}; border-radius: 3px; transition: width 0.3s ease;"></div>
                                    </div>
                                </div>
                            </td>`;
                        } else if (col.type === 'actions') {
                            return `<td>
                                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.open('/app/quotation/${item.quotation}', '_blank')" title="Open in new tab">
                                    <i class="fa fa-external-link-alt"></i>
                                </button>
                            </td>`;
                        } else if (col.type === 'quotation_links') {
                            const quotations = item.quotations || [];
                            if (quotations.length === 0) {
                                return `<td><span class="text-muted">No quotations</span></td>`;
                            }
                            return `<td>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                                    ${quotations.slice(0, 3).map(quote => `
                                        <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${quote.quotation}', '_blank')" title="Open ${quote.quotation} in new tab" style="padding: 0.15rem 0.3rem; font-size: 0.65rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                            ${quote.quotation}
                                        </button>
                                    `).join('')}
                                    ${quotations.length > 3 ? `<span class="text-muted" style="font-size: 0.75rem;">+${quotations.length - 3} more</span>` : ''}
                                </div>
                            </td>`;
                        } else if (col.type === 'customer_link') {
                            return `<td>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong style="color: var(--accent-blue); cursor: pointer;" onclick="event.stopPropagation(); frappe.sales_intelligence.showCustomerDetails('${item[col.key]}')" title="View customer quotations">${item[col.key]}</strong>
                                    <button class="btn btn-xs btn-outline-primary" onclick="event.stopPropagation(); frappe.sales_intelligence.showCustomerDetails('${item[col.key]}')" title="View quotations" style="padding: 0.15rem 0.3rem; font-size: 0.65rem; border: 1px solid var(--accent-blue); color: var(--accent-blue); border-radius: 3px;">
                                        <i class="fa fa-eye" style="font-size: 0.65rem;"></i> ${item.total_quotes}
                                    </button>
                                </div>
                            </td>`;
                        } else if (col.type === 'opportunity_link') {
                            return `<td>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong style="color: var(--accent-blue); cursor: pointer;" onclick="event.stopPropagation(); window.open('/app/opportunity/${item[col.key]}', '_blank')" title="Open opportunity in new tab">${item[col.key]}</strong>
                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/opportunity/${item[col.key]}', '_blank')" title="Open opportunity in new tab" style="padding: 0.15rem 0.3rem; font-size: 0.65rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                        <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                    </button>
                                </div>
                            </td>`;
                        } else if (col.type === 'site_visit_link') {
                            return `<td>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong style="color: var(--accent-orange); cursor: pointer;" onclick="event.stopPropagation(); window.open('/app/site-visit/${item[col.key]}', '_blank')" title="Open site visit in new tab">${item[col.key]}</strong>
                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/site-visit/${item[col.key]}', '_blank')" title="Open site visit in new tab" style="padding: 0.15rem 0.3rem; font-size: 0.65rem; background: var(--accent-orange); border: 1px solid var(--accent-orange); color: white; border-radius: 3px;">
                                        <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                    </button>
                                </div>
                            </td>`;
                        } else if (col.type === 'design_request_link') {
                            return `<td>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong style="color: var(--accent-purple); cursor: pointer;" onclick="event.stopPropagation(); window.open('/app/design-request/${item[col.key]}', '_blank')" title="Open design request in new tab">${item[col.key]}</strong>
                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/design-request/${item[col.key]}', '_blank')" title="Open design request in new tab" style="padding: 0.15rem 0.3rem; font-size: 0.65rem; background: var(--accent-purple); border: 1px solid var(--accent-purple); color: white; border-radius: 3px;">
                                        <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                    </button>
                                </div>
                            </td>`;
                        } else if (col.type === 'permit_link') {
                            return `<td>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong style="color: var(--accent-green); cursor: pointer;" onclick="event.stopPropagation(); window.open('/app/permit/${item[col.key]}', '_blank')" title="Open permit in new tab">${item[col.key]}</strong>
                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/permit/${item[col.key]}', '_blank')" title="Open permit in new tab" style="padding: 0.15rem 0.3rem; font-size: 0.65rem; background: var(--accent-green); border: 1px solid var(--accent-green); color: white; border-radius: 3px;">
                                        <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                    </button>
                                </div>
                            </td>`;
                        } else if (col.type === 'days') {
                            const days = item[col.key] || 0;
                            const badgeClass = days > 30 ? 'danger' : days > 7 ? 'warning' : 'info';
                            return `<td><span class="status-badge ${badgeClass}">${days} days</span></td>`;
                        } else if (col.type === 'expiry') {
                            const days = item[col.key] || 0;
                            const badgeClass = days < 0 ? 'danger' : days <= 7 ? 'warning' : 'info';
                            const text = days < 0 ? `${Math.abs(days)} days expired` : `${days} days`;
                            return `<td><span class="status-badge ${badgeClass}">${text}</span></td>`;
                        } else if (col.key === 'customer_name') {
                            return `<td>${item.customer_name || item.party_name || item.name || 'Unknown'}</td>`;
                        } else if (col.key === 'quotation') {
                            return `<td>
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong style="color: var(--text-primary);">${item[col.key]}</strong>
                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${item[col.key]}', '_blank')" title="Open quotation in new tab" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 4px;">
                                        <i class="fa fa-external-link-alt" style="font-size: 0.7rem;"></i>
                                    </button>
                                </div>
                            </td>`;
                        } else if (col.type === 'item_with_image') {
                            return `<td>
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    ${item.image ? 
                                        `<img src="${item.image}" alt="${item.item_code}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border-color);">` : 
                                        `<div style="width: 32px; height: 32px; border-radius: 6px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                                            <i class="fa fa-cube"></i>
                                        </div>`
                                    }
                                    <div>
                                        <strong style="display: block; font-size: 0.875rem;">${item.item_code || item[col.key]}</strong>
                                        ${item.brand ? `<small style="color: var(--text-secondary);">${item.brand}</small>` : ''}
                                    </div>
                                </div>
                            </td>`;
                        } else if (col.key === 'name' && col.label === 'Account Manager') {
                            const managerName = item.name || '-';
                            if (managerName === '-') {
                                return `<td>-</td>`;
                            }
                            return `<td><div style="display: flex; align-items: center; gap: 0.5rem;">${this.getUserAvatar(managerName, 32)}<span>${managerName}</span></div></td>`;
                        } else if (col.key === 'account_incharge_full_name') {
                            const managerName = item.account_incharge_full_name || item.account_incharge || '-';
                            if (managerName === '-') {
                                return `<td>-</td>`;
                            }
                            return `<td><div style="display: flex; align-items: center; gap: 0.5rem;">${this.getUserAvatar(managerName, 32)}<span>${managerName}</span></div></td>`;
                        }
                        return `<td>${item[col.key] || '-'}</td>`;
                    }).join('')}
                </tr>
            `;
        }).join('');
    }

    // Enhanced table functionality
    filterTable(tableId, searchTerm) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm.toLowerCase())) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // Update info text
        const infoElement = document.getElementById(`${tableId}-info`);
        if (infoElement) {
            const totalRows = rows.length;
            infoElement.textContent = `Showing ${visibleCount} of ${totalRows} records`;
        }
    }

    sortTable(tableId, column) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        const columnIndex = Array.from(table.querySelectorAll('thead th')).findIndex(th => {
            const thText = th.textContent.toLowerCase().trim();
            const colText = column.toLowerCase().trim();
            return thText.includes(colText) || colText.includes(thText);
        });
        
        if (columnIndex === -1) return;
        
        this.sortTableByColumnIndex(tableId, columnIndex, column);
    }

    sortTableByColumn(tableId, column) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const columnIndex = Array.from(table.querySelectorAll('thead th')).findIndex(th => {
            return th.onclick && th.onclick.toString().includes(`'${column}'`);
        });
        
        if (columnIndex === -1) return;
        
        this.sortTableByColumnIndex(tableId, columnIndex, column);
        
        // Update active header
        table.querySelectorAll('thead th').forEach(th => th.classList.remove('active'));
        table.querySelectorAll('thead th')[columnIndex].classList.add('active');
    }

    sortTableByColumnIndex(tableId, columnIndex, column) {
        const table = document.getElementById(tableId);
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        const isNumeric = ['amount', 'total', 'value', 'count', 'qty', 'margin', 'conversion', 'rate', 'days'].some(keyword => 
            column.toLowerCase().includes(keyword)
        );
        const isDate = column.toLowerCase().includes('date');
        
        // Get current sort order for this table
        const currentOrder = this.sortState[tableId] || 'desc';
        const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
        this.sortState[tableId] = newOrder;
        
        rows.sort((a, b) => {
            let aVal = a.cells[columnIndex]?.textContent.trim() || '';
            let bVal = b.cells[columnIndex]?.textContent.trim() || '';
            
            if (isNumeric) {
                // Extract numbers from text (remove currency symbols, commas, etc.)
                aVal = parseFloat(aVal.replace(/[^0-9.-]/g, '')) || 0;
                bVal = parseFloat(bVal.replace(/[^0-9.-]/g, '')) || 0;
                return newOrder === 'desc' ? bVal - aVal : aVal - bVal;
            } else if (isDate) {
                aVal = aVal === '-' ? new Date(0) : new Date(aVal);
                bVal = bVal === '-' ? new Date(0) : new Date(bVal);
                return newOrder === 'desc' ? bVal - aVal : aVal - bVal;
            } else {
                // Text sorting
                const result = aVal.localeCompare(bVal);
                return newOrder === 'desc' ? -result : result;
            }
        });
        
        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));
        
        // Update sort order button
        const orderBtn = document.getElementById(`${tableId}-sort-order`);
        if (orderBtn) {
            const icon = orderBtn.querySelector('i');
            icon.className = newOrder === 'desc' ? 'fa fa-sort-amount-down' : 'fa fa-sort-amount-up';
        }
    }

    toggleSortOrder(tableId) {
        const selectElement = document.getElementById(`${tableId}-sort-select`);
        if (selectElement) {
            const selectedColumn = selectElement.value;
            this.sortTable(tableId, selectedColumn);
        }
    }

    // Modal and detail methods
    showQuotationDetails(quotationName) {
        console.log('showQuotationDetails called with:', quotationName);
        
        const quote = this.data.quotations.find(q => q.quotation === quotationName || q.name === quotationName);
        console.log('Found quote:', quote ? 'Yes' : 'No');
        console.log('Sample quotation field names:', this.data.quotations.length > 0 ? Object.keys(this.data.quotations[0]) : 'No quotations loaded');
        
        if (!quote) {
            console.error('Quotation not found:', quotationName);
            frappe.msgprint(`Quotation ${quotationName} not found in current data.`);
            return;
        }

        try {
            const content = this.generateQuotationDetailsContent(quote);
            console.log('Generated content length:', content.length);
            
            $('#quotation-title').html(`<i class="fa fa-file-alt"></i> ${quotationName} - Details`);
            $('#quotation-content').html(content);
            $('#open-quotation').data('quotation', quotationName);
            
            // Set higher z-index specifically for quotation modal
            $('#quotationDetailsModal').css('z-index', '10001');
            
            // Check if modal elements exist
            if ($('#quotationDetailsModal').length === 0) {
                console.error('quotationDetailsModal element not found in DOM');
                frappe.msgprint('Modal dialog not found. Please refresh the page.');
                return;
            }
            
            console.log('Opening modal...');
            $('#quotationDetailsModal').modal('show');
            
        } catch (error) {
            console.error('Error in showQuotationDetails:', error);
            frappe.msgprint('Error opening quotation details. Please try again.');
        }
    }

    generateQuotationDetailsContent(quote) {
        try {
            return `
            <div class="quotation-details">
                <div class="modal-section">
                    <h6><i class="fa fa-info-circle"></i>Basic Information</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <table class="table table-borderless" style="margin: 0;">
                                <tr><td style="font-weight: 600; color: var(--text-secondary); width: 40%;">Quotation:</td><td style="color: var(--text-primary);">${quote.quotation}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Customer:</td><td style="color: var(--text-primary);">${quote.customer_name || quote.party_name}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Date:</td><td style="color: var(--text-primary);">${frappe.datetime.str_to_user(quote.transaction_date)}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Valid Till:</td><td style="color: var(--text-primary);">${frappe.datetime.str_to_user(quote.valid_till)}</td></tr>
                            </table>
                        </div>
                        <div class="col-md-6">
                            <table class="table table-borderless" style="margin: 0;">
                                <tr><td style="font-weight: 600; color: var(--text-secondary); width: 40%;">Status:</td><td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Workflow State:</td><td style="color: var(--text-primary);">${quote.workflow_state || '-'}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Pipeline:</td><td><span class="status-badge info"><i class="fa fa-layer-group" style="margin-right: 0.25rem;"></i>${quote.pipeline}</span></td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Company:</td><td style="color: var(--text-primary);">${quote.company || '-'}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="modal-section">
                    <h6><i class="fa fa-money-bill-wave"></i>Financial Information</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <table class="table table-borderless" style="margin: 0;">
                                <tr><td style="font-weight: 600; color: var(--text-secondary); width: 40%;">Net Total:</td><td style="color: var(--text-primary);">AED ${this.formatCurrency(quote.base_net_total)}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Tax Amount:</td><td style="color: var(--text-primary);">AED ${this.formatCurrency(quote.base_total_taxes_and_charges)}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Grand Total:</td><td style="color: var(--text-primary); font-weight: 700; font-size: 1.1rem;">AED ${this.formatCurrency(quote.base_grand_total)}</td></tr>
                            </table>
                        </div>
                        <div class="col-md-6">
                            <table class="table table-borderless" style="margin: 0;">
                                <tr><td style="font-weight: 600; color: var(--text-secondary); width: 40%;">Margin:</td><td><span class="margin-badge ${this.getMarginClass(quote.profit_percentage)}">${quote.profit_percentage || 0}%</span></td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Profit Amount:</td><td style="color: var(--text-primary);">AED ${this.formatCurrency(quote.expected_profit || 0)}</td></tr>
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Branch:</td><td style="color: var(--text-primary);">${quote.custom_branch || '-'}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h6><i class="fa fa-user-tie"></i>Account Management</h6>
                    <table class="table table-borderless" style="margin: 0;">
                        <tr>
                            <td style="font-weight: 600; color: var(--text-secondary); width: 20%;">Account Manager:</td>
                            <td style="color: var(--text-primary);">
                                ${quote.account_incharge_full_name || quote.account_incharge ? 
                                    `<div style="display: flex; align-items: center; gap: 0.75rem;">
                                        ${this.getUserAvatar(quote.account_incharge_full_name || quote.account_incharge, 40)}
                                        <span>${quote.account_incharge_full_name || quote.account_incharge}</span>
                                    </div>` : '-'}
                            </td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600; color: var(--text-secondary);">Created By:</td>
                            <td style="color: var(--text-primary);">
                                ${quote.owner_full_name || quote.owner ? 
                                    `<div style="display: flex; align-items: center; gap: 0.75rem;">
                                        ${this.getUserAvatar(quote.owner_full_name || quote.owner, 40)}
                                        <span>${quote.owner_full_name || quote.owner}</span>
                                    </div>` : '-'}
                            </td>
                        </tr>
                    </table>
                </div>

                ${quote.items && quote.items.length > 0 ? `
                <div class="modal-section">
                    <h6><i class="fa fa-cube"></i>Items (${quote.items.length})</h6>
                    <div class="table-responsive">
                        <table class="table table-sm data-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Rate</th>
                                    <th>Cost</th>
                                    <th>Amount</th>
                                    <th>Profit</th>
                                    <th>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quote.items.slice(0, 10).map(item => `
                                    <tr>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                                ${item.image ? 
                                                    `<img src="${item.image}" alt="${item.item_code}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-color);">` : 
                                                    `<div style="width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">
                                                        <i class="fa fa-cube"></i>
                                                    </div>`
                                                }
                                                <div>
                                                    <strong style="display: block; font-size: 0.875rem;">${item.item_code}</strong>
                                                    ${item.brand ? `<small style="color: var(--text-secondary);">${item.brand}</small>` : ''}
                                                </div>
                                            </div>
                                        </td>
                                        <td>${item.qty}</td>
                                        <td>AED ${this.formatCurrency(item.rate || 0)}</td>
                                        <td>AED ${this.formatCurrency(item.standard_buying || 0)}</td>
                                        <td>AED ${this.formatCurrency(item.amount || 0)}</td>
                                        <td>
                                            ${item.rate && item.standard_buying ? 
                                                (() => {
                                                    const totalCost = (item.standard_buying || 0) * (item.qty || 0);
                                                    const profit = (item.amount || 0) - totalCost;
                                                    return `AED ${this.formatCurrency(profit)}`;
                                                })() : 
                                                '<span style="color: var(--text-muted);">-</span>'
                                            }
                                        </td>
                                        <td>
                                            ${item.rate && item.standard_buying ? 
                                                (() => {
                                                    const margin = ((item.rate - item.standard_buying) / item.rate * 100).toFixed(1);
                                                    return `<span class="margin-badge ${this.getMarginClass(margin)}">${margin}%</span>`;
                                                })() : 
                                                '<span style="color: var(--text-muted);">-</span>'
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${quote.items.length > 10 ? `<small style="color: var(--text-muted);">Showing first 10 of ${quote.items.length} items</small>` : ''}
                    </div>
                </div>
                ` : ''}
                
                ${quote.followups && quote.followups.length > 0 ? `
                <div class="modal-section">
                    <h6><i class="fa fa-phone"></i>Follow-ups (${quote.followups.length})</h6>
                    <div class="followup-timeline">
                        ${quote.followups.map(followup => `
                            <div style="background: rgba(51, 65, 85, 0.4); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin: 0.5rem 0; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${frappe.datetime.str_to_user(followup.followup_date_time)}</div>
                                    <div style="color: var(--accent-blue); font-size: 0.875rem;">${followup.method}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.75rem;">By: ${followup.followup_by || 'Unknown'}</div>
                                </div>
                                ${followup.notes ? `<div style="font-style: italic; color: var(--text-secondary); font-size: 0.875rem; max-width: 300px;">${followup.notes}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        } catch (error) {
            console.error('Error generating quotation details content:', error);
            return `
                <div class="alert alert-warning" role="alert">
                    <i class="fa fa-exclamation-triangle"></i>
                    Error loading quotation details. Please try refreshing the page.
                    <br><small>Error: ${error.message}</small>
                </div>
            `;
        }
    }

    showCustomerDetails(customerName) {
        const customerQuotes = this.data.quotations.filter(q => 
            (q.customer_name || q.party_name) === customerName
        );
        
        if (customerQuotes.length === 0) return;
        
        const content = this.generateCustomerDetailsContent(customerName, customerQuotes);
        $('#quotation-title').html(`<i class="fa fa-building"></i> ${customerName} - Customer Analysis`);
        $('#quotation-content').html(content);
        $('#quotationDetailsModal').css('z-index', '10001');
        $('#quotationDetailsModal').modal('show');
    }

    generateCustomerDetailsContent(customerName, quotes) {
        const stats = this.calculateCustomerDetailStats(quotes);
        
        return `
            <div class="customer-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-chart-bar"></i>Customer Overview</h6>
                    <div class="row">
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.total_quotes}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Quotations</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(stats.total_value)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.conversion_rate}%</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Conversion Rate</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.avg_margin}%</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Average Margin</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h6><i class="fa fa-clock"></i>Customer Timeline</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong style="color: var(--accent-blue);">First Quote:</strong> <span style="color: var(--text-primary);">${frappe.datetime.str_to_user(stats.first_quote)}</span></p>
                            <p><strong style="color: var(--accent-blue);">Latest Quote:</strong> <span style="color: var(--text-primary);">${frappe.datetime.str_to_user(stats.last_quote)}</span></p>
                        </div>
                        <div class="col-md-6">
                            <p><strong style="color: var(--accent-blue);">Customer Lifetime:</strong> <span style="color: var(--text-primary);">${stats.customer_lifetime_days} days</span></p>
                            <p><strong style="color: var(--accent-blue);">Average Quote Value:</strong> <span style="color: var(--text-primary);">AED ${this.formatCurrency(stats.avg_quote_value)}</span></p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h6><i class="fa fa-list"></i>Quotation History</h6>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Quotation</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Account Manager</th>
                                    <th>Margin</th>
                                    <th>Pipeline</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotes.map(quote => `
                                    <tr onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')" style="cursor: pointer;">
                                        <td>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <strong>${quote.quotation}</strong>
                                                <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${quote.quotation}', '_blank')" title="Open quotation in new tab" style="padding: 0.2rem 0.4rem; font-size: 0.7rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                                    <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
                                        <td>AED ${this.formatCurrency(quote.base_grand_total)}</td>
                                        <td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td>
                                        <td><span class="account-manager-badge" title="${quote.account_incharge_full_name || quote.account_incharge || 'Not assigned'}"><i class="fa fa-user" style="margin-right: 0.25rem; color: var(--accent-blue);"></i>${quote.account_incharge_full_name || quote.account_incharge || 'Not assigned'}</span></td>
                                        <td><span class="margin-badge ${this.getMarginClass(quote.profit_percentage)}">${quote.profit_percentage || 0}%</span></td>
                                        <td><span class="status-badge info"><i class="fa fa-layer-group" style="margin-right: 0.25rem;"></i>${quote.pipeline}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    // Add these methods to your EnhancedSalesIntelligence class
calculateBranchPipelineData() {
    const branchData = new Map();
    
    // Exclude specific statuses and consider quotations with pipeline workflow states
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    this.data.quotations.filter(q => {
        return !excludedStatuses.includes(q.status) && (this.calculatePipeline(q) !== 'None' || q.status === 'Open');
    }).forEach(quote => {
        const branch = quote.custom_branch || 'Unknown';
        
        if (!branchData.has(branch)) {
            branchData.set(branch, {
                name: branch,
                total_count: 0,
                total_value: 0,
                pipeline_A_count: 0,
                pipeline_A_value: 0,
                pipeline_B_count: 0,
                pipeline_B_value: 0,
                pipeline_C_count: 0,
                pipeline_C_value: 0,
                no_pipeline_count: 0,
                no_pipeline_value: 0,
            });
        }
        
        const data = branchData.get(branch);
        data.total_count++;
        data.total_value += quote.base_grand_total || 0;
        
        const pipeline = this.calculatePipeline(quote);
        switch(pipeline) {
            case 'A':
                data.pipeline_A_count++;
                data.pipeline_A_value += quote.base_grand_total || 0;
                break;
            case 'B':
                data.pipeline_B_count++;
                data.pipeline_B_value += quote.base_grand_total || 0;
                break;
            case 'C':
                data.pipeline_C_count++;
                data.pipeline_C_value += quote.base_grand_total || 0;
                break;
            default:
                data.no_pipeline_count++;
                data.no_pipeline_value += quote.base_grand_total || 0;
                break;
        }
    });
    
    return Array.from(branchData.values()).sort((a, b) => b.total_value - a.total_value);
}

calculateManagerPipelineData() {
    const managerData = new Map();
    
    // Exclude specific statuses and consider quotations with pipeline workflow states
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    this.data.quotations.filter(q => {
        return !excludedStatuses.includes(q.status) && (this.calculatePipeline(q) !== 'None' || q.status === 'Open');
    }).forEach(quote => {
        const manager = quote.account_incharge_full_name || quote.account_incharge || 'Unknown';
        
        if (!managerData.has(manager)) {
            managerData.set(manager, {
                name: manager,
                total_count: 0,
                total_value: 0,
                pipeline_A_count: 0,
                pipeline_A_value: 0,
                pipeline_B_count: 0,
                pipeline_B_value: 0,
                pipeline_C_count: 0,
                pipeline_C_value: 0,
                no_pipeline_count: 0,
                no_pipeline_value: 0,
                weighted_value: 0,
                pipeline_score: 0
            });
        }
        
        const data = managerData.get(manager);
        data.total_count++;
        data.total_value += quote.base_grand_total || 0;
        
        const pipeline = this.calculatePipeline(quote);
        switch(pipeline) {
            case 'A':
                data.pipeline_A_count++;
                data.pipeline_A_value += quote.base_grand_total || 0;
                break;
            case 'B':
                data.pipeline_B_count++;
                data.pipeline_B_value += quote.base_grand_total || 0;
                break;
            case 'C':
                data.pipeline_C_count++;
                data.pipeline_C_value += quote.base_grand_total || 0;
                break;
            default:
                data.no_pipeline_count++;
                data.no_pipeline_value += quote.base_grand_total || 0;
                break;
        }
    });
    
    // Calculate pipeline score for each manager (based on pipeline distribution)
    Array.from(managerData.values()).forEach(data => {
        if (data.total_count > 0) {
            // Simple score based on high confidence pipeline percentage
            data.pipeline_score = (data.pipeline_A_count / data.total_count) * 100;
        }
    });
    
    return Array.from(managerData.values()).sort((a, b) => b.pipeline_score - a.pipeline_score);
}
calculateAverageDaysInPipeline() {
    // Exclude specific statuses from pipeline calculations
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    const eligibleQuotes = this.data.quotations.filter(q => {
        return !excludedStatuses.includes(q.status) && this.calculatePipeline(q) !== 'None';
    });
    if (eligibleQuotes.length === 0) return 0;
    
    const totalDays = eligibleQuotes.reduce((sum, quote) => {
        return sum + Math.ceil((new Date() - new Date(quote.transaction_date)) / (1000 * 60 * 60 * 24));
    }, 0);
    
    return Math.round(totalDays / eligibleQuotes.length);
}

calculateQuotesNearExpiry() {
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    return this.data.quotations.filter(q => {
        if (excludedStatuses.includes(q.status)) return false;
        const daysToExpiry = Math.ceil((new Date(q.valid_till) - new Date()) / (1000 * 60 * 60 * 24));
        return daysToExpiry <= 7 && daysToExpiry >= 0;
    }).length;
}

calculateStagnatPipelines() {
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    return this.data.quotations.filter(q => {
        if (excludedStatuses.includes(q.status) || this.calculatePipeline(q) === 'None') return false;
        const daysInPipeline = Math.ceil((new Date() - new Date(q.transaction_date)) / (1000 * 60 * 60 * 24));
        return daysInPipeline > 30;
    }).length;
}

renderUrgentPipelineActions() {
    const excludedStatuses = ['Partially Ordered', 'Ordered', 'Lost', 'Cancelled', 'Expired', 'Not Approved'];
    const urgentQuotes = this.data.quotations.filter(q => {
        if (excludedStatuses.includes(q.status)) return false;
        const daysToExpiry = Math.ceil((new Date(q.valid_till) - new Date()) / (1000 * 60 * 60 * 24));
        const daysInPipeline = Math.ceil((new Date() - new Date(q.transaction_date)) / (1000 * 60 * 60 * 24));
        return daysToExpiry <= 7 || (q.pipeline === 'None' && daysInPipeline > 7) || daysInPipeline > 30;
    }).slice(0, 5);
    
    if (urgentQuotes.length === 0) {
        return '<p style="color: var(--text-secondary); font-style: italic;">No urgent actions required at this time.</p>';
    }
    
    return `
        <div class="urgent-actions-list">
            ${urgentQuotes.map(quote => {
                const daysToExpiry = Math.ceil((new Date(quote.valid_till) - new Date()) / (1000 * 60 * 60 * 24));
                const daysInPipeline = Math.ceil((new Date() - new Date(quote.transaction_date)) / (1000 * 60 * 60 * 24));
                
                let urgencyType = '';
                let urgencyText = '';
                
                if (daysToExpiry <= 7 && daysToExpiry >= 0) {
                    urgencyType = 'expiring';
                    urgencyText = `Expires in ${daysToExpiry} days`;
                } else if (quote.pipeline === 'None') {
                    urgencyType = 'no-pipeline';
                    urgencyText = 'Needs pipeline assignment';
                } else if (daysInPipeline > 30) {
                    urgencyType = 'stagnant';
                    urgencyText = `Stagnant for ${daysInPipeline} days`;
                }
                
                const urgencyIcon = urgencyType === 'expiring' ? 'fa-clock' : 
                                  urgencyType === 'no-pipeline' ? 'fa-exclamation-triangle' : 
                                  'fa-hourglass-end';
                
                return `
                    <div class="urgent-action-item ${urgencyType}" onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')">
                        <div class="urgent-item-content">
                            <div class="urgent-item-main">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <h6><i class="fa fa-file-alt" style="margin-right: 0.5rem; color: var(--accent-blue);"></i>${quote.quotation}</h6>
                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${quote.quotation}', '_blank')" title="Open quotation in new tab" style="padding: 0.2rem 0.4rem; font-size: 0.7rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                        <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                    </button>
                                </div>
                                <p><i class="fa fa-building" style="margin-right: 0.5rem; color: var(--text-muted);"></i>${quote.customer_name || quote.party_name}</p>
                            </div>
                            <div class="urgent-item-details">
                                <div class="urgent-amount"><i class="fa fa-money-bill-wave" style="margin-right: 0.25rem;"></i>AED ${this.formatCurrency(quote.base_grand_total)}</div>
                                <div class="urgent-status ${urgencyType}"><i class="fa ${urgencyIcon}" style="margin-right: 0.25rem;"></i>${urgencyText}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

switchPipelineTab(tabName) {
    // Remove active class from all tabs and panes
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    // Add active class to selected tab and pane
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // Initialize chart if timeline tab is selected
    if (tabName === 'timeline-pipeline') {
        setTimeout(() => this.initializePipelineTimelineChart(), 100);
    }
}

initializePipelineTimelineChart() {
    const canvas = document.getElementById('pipelineTimelineChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Add your timeline chart implementation here
    // This could show pipeline movement over time, aging quotations, etc.
    
    ctx.fillStyle = 'var(--text-secondary)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Pipeline Timeline Chart - Implementation pending', canvas.width / 2, canvas.height / 2);
}

    calculateCustomerDetailStats(quotes) {
        const stats = {
            total_quotes: quotes.length,
            total_value: quotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
            won_quotes: quotes.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status)).length,
            won_value: quotes.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status))
                .reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
            avg_margin: quotes.length > 0 ? 
                (quotes.reduce((sum, q) => sum + (parseFloat(q.profit_percentage) || 0), 0) / quotes.length).toFixed(1) : 0,
            first_quote: quotes.reduce((earliest, q) => 
                new Date(q.transaction_date) < new Date(earliest) ? q.transaction_date : earliest, 
                quotes[0].transaction_date
            ),
            last_quote: quotes.reduce((latest, q) => 
                new Date(q.transaction_date) > new Date(latest) ? q.transaction_date : latest, 
                quotes[0].transaction_date
            )
        };
        
        stats.conversion_rate = stats.total_quotes > 0 ? 
            (stats.won_quotes / stats.total_quotes * 100).toFixed(1) : 0;
        stats.avg_quote_value = stats.total_quotes > 0 ? 
            stats.total_value / stats.total_quotes : 0;
        stats.customer_lifetime_days = Math.ceil(
            (new Date(stats.last_quote) - new Date(stats.first_quote)) / (1000 * 60 * 60 * 24)
        );
        
        return stats;
    }

    showDrilldown(type) {
        let data, title;
        
        switch(type) {
            case 'total_quotations':
                data = this.data.filtered;
                title = 'All Quotations';
                break;
            case 'won_quotations':
                data = this.data.filtered.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status));
                title = 'Won Quotations';
                break;
            case 'pending_quotations':
                data = this.data.filtered.filter(q => ['Open', 'Expired'].includes(q.status));
                title = 'Pending Quotations';
                break;
            case 'open_quotations':
                data = this.data.filtered.filter(q => q.status === 'Open');
                title = 'Open Quotations';
                break;
            case 'expired_quotations':
                data = this.data.filtered.filter(q => q.status === 'Expired');
                title = 'Expired Quotations';
                break;
            case 'lost_quotations':
                data = this.data.filtered.filter(q => q.status === 'Lost');
                title = 'Lost Quotations';
                break;
            case 'cancelled_not_amended_quotations':
                data = this.cancelledQuotationsData?.data || [];
                title = 'Cancelled But Not Amended Quotations';
                break;
            case 'low_margin_quotes':
                data = this.data.stats.margin.lowMargin;
                title = 'Low Margin Quotations';
                break;
            case 'no_followups':
                data = this.data.stats.followup.noFollowups;
                title = 'Quotations with No Follow-ups';
                break;
            case 'need_followup':
                data = this.data.stats.followup.needFollowup;
                title = 'Quotations Needing Follow-up';
                break;
            case 'draft_quotations':
                data = this.data.filtered.filter(q => q.status === 'Draft');
                title = 'Draft Quotations';
                break;
            case 'pending_dept_approval_quotations':
                data = this.data.filtered.filter(q =>
                    q.workflow_state === 'Pending Dept Approval' &&
                    !['Partially Ordered', 'Lost', 'Cancelled', 'Expired'].includes(q.status)
                );
                title = 'Pending Dept Approval Quotations';
                break;
            default:
                data = this.data.filtered;
                title = 'Quotation Details';
        }

        const content = this.generateDrilldownContent(data, title, type);
        $('#drilldown-title').html(`<i class="fa fa-chart-line"></i> ${title}`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    generateDrilldownContent(data, title = '', type = '') {
        if (!data || data.length === 0) {
            return '<div class="text-center" style="padding: 2rem;"><p style="color: var(--text-secondary);"><i class="fa fa-database" style="margin-right: 0.5rem; font-size: 1.2rem;"></i>No data available for the selected criteria.</p></div>';
        }

        const totalAmount = data.reduce((sum, q) => sum + (q.base_grand_total || 0), 0);
        const avgAmount = data.length > 0 ? totalAmount / data.length : 0;
        const wonCount = data.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status)).length;
        const conversionRate = data.length > 0 ? (wonCount / data.length * 100).toFixed(1) : 0;

        return `
            <div class="drilldown-container">
                <div class="modal-section">
                    <h6><i class="fa fa-info-circle"></i>Summary</h6>
                    <div class="row">
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${data.length.toLocaleString()}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Quotations</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(totalAmount)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(avgAmount)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Average Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${conversionRate}%</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Conversion Rate</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section" style="margin-top: 1.5rem;">
                    <div class="section-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                        <h6 style="margin: 0;"><i class="fa fa-table"></i>Detailed Data</h6>
                        <div class="drilldown-actions" style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="frappe.sales_intelligence.exportQuotationData('${title.replace(/'/g, '\\\'')}')" title="Export to Excel">
                                <i class="fa fa-download"></i> Export
                            </button>
                            ${data.length > 100 ? `
                            <button class="btn btn-sm btn-success" onclick="frappe.sales_intelligence.showFullDataModal('${title.replace(/'/g, '\\\'')}')" title="Show all ${data.length} records">
                                <i class="fa fa-expand"></i> All (${data.length})
                            </button>
                            ` : ''}
                        </div>
                    </div>
                    ${this.renderTableWithControls('drilldown-table', data, [
                        { key: 'quotation', label: 'Quotation', sortable: true },
                        { key: 'customer_name', label: 'Customer', sortable: true },
                        { key: 'transaction_date', label: 'Date', sortable: true, type: 'date' },
                        { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency' },
                        { key: 'status', label: 'Status', sortable: true, type: 'badge' },
                        { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true }
                    ])}
                </div>
            </div>
        `;
    }

    showValueRangeDetails(range) {
        const rangeData = this.data.stats.overview.valueRanges[range];
        if (!rangeData || rangeData.quotes.length === 0) {
            frappe.msgprint(`No quotations found in the ${range} range.`);
            return;
        }
        
        const content = this.generateDrilldownContent(rangeData.quotes);
        $('#drilldown-title').html(`<i class="fa fa-coins"></i> Quotations in AED ${range} Range`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    showAllQuotations() {
        const content = this.generateDrilldownContent(this.data.filtered);
        $('#drilldown-title').html(`<i class="fa fa-list"></i> All Quotations (${this.data.filtered.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    showAllDesignRequests() {
        const designRequests = this.data.design_requests || [];
        const content = this.generateGenericDrilldownContent(designRequests, this.getOpportunityColumns('design-request'), 'Design Requests');
        $('#drilldown-title').html(`<i class="fa fa-drafting-compass"></i> All Design Requests (${designRequests.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    showAllSiteVisits() {
        const siteVisits = this.data.site_visits || [];
        const content = this.generateGenericDrilldownContent(siteVisits, this.getOpportunityColumns('site-visit'), 'Site Visits');
        $('#drilldown-title').html(`<i class="fa fa-map-marker-alt"></i> All Site Visits (${siteVisits.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    showAllPermits() {
        const permits = this.data.permits || [];
        const content = this.generateGenericDrilldownContent(permits, this.getOpportunityColumns('permit'), 'Permits');
        $('#drilldown-title').html(`<i class="fa fa-file-signature"></i> All Permits (${permits.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    showAllLostQuotes() {
        const lostQuotes = this.data.quotations.filter(q => q.status === 'Lost') || [];
        const columns = [
            { key: 'quotation', label: 'Quotation #', sortable: true, icon: 'fa-file-alt' },
            { key: 'party_name', label: 'Customer', sortable: true, icon: 'fa-building' },
            { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
            { key: 'base_grand_total', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
            { key: 'order_lost_reason', label: 'Reason', sortable: true, icon: 'fa-exclamation-triangle' },
            { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' }
        ];
        const content = this.generateGenericDrilldownContent(lostQuotes, columns, 'Lost Quotations');
        $('#drilldown-title').html(`<i class="fa fa-times-circle"></i> All Lost Quotations (${lostQuotes.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    showAllCancelledQuotes() {
        // Use the cancelled quotations data that is specifically loaded for custom_cancel_status = 'Cancelled but not amended'
        const cancelledQuotes = this.cancelledQuotationsData?.data || [];
        const columns = [
            { key: 'quotation', label: 'Quotation #', sortable: true, icon: 'fa-file-alt' },
            { key: 'party_name', label: 'Customer', sortable: true, icon: 'fa-building' },
            { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
            { key: 'base_grand_total', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
            { key: 'custom_cancel_status', label: 'Cancel Status', sortable: true, icon: 'fa-ban' },
            { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
            { key: 'custom_branch', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' }
        ];
        const content = this.generateGenericDrilldownContent(cancelledQuotes, columns, 'Cancelled But Not Amended Quotations');
        $('#drilldown-title').html(`<i class="fa fa-ban"></i> All Cancelled But Not Amended Quotations (${cancelledQuotes.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    showManagerDetails(managerName) {
        const managerQuotes = this.data.quotations.filter(q => 
            (q.account_incharge_full_name || q.account_incharge) === managerName
        );
        
        if (managerQuotes.length === 0) {
            frappe.msgprint(`No quotations found for ${managerName}.`);
            return;
        }
        
        const content = this.generateManagerDetailsContent(managerName, managerQuotes);
        $('#quotation-title').html(`<i class="fa fa-user-tie"></i> ${managerName} - Performance Analysis`);
        $('#quotation-content').html(content);
        $('#quotationDetailsModal').modal('show');
    }

    generateManagerDetailsContent(managerName, quotes) {
        const stats = this.calculateManagerDetailStats(quotes);
        
        return `
            <div class="manager-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-chart-bar"></i>Performance Overview</h6>
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                        ${this.getUserAvatar(managerName, 80)}
                        <div style="flex: 1;">
                            <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${managerName}</h3>
                            <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Account Manager</p>
                            <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                                <span style="color: var(--accent-blue); font-weight: 600;">${stats.conversion_rate}% Conversion</span>
                                <span style="color: var(--accent-green); font-weight: 600;">${stats.avg_margin}% Avg Margin</span>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.total_quotes}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Quotations</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(stats.total_value)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.won_quotes}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Won Quotations</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(stats.avg_quote_value)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Avg Quote Value</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h6><i class="fa fa-list"></i>Recent Quotations</h6>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th><i class="fa fa-file-alt" style="margin-right: 0.5rem;"></i>Quotation</th>
                                    <th><i class="fa fa-building" style="margin-right: 0.5rem;"></i>Customer</th>
                                    <th><i class="fa fa-calendar" style="margin-right: 0.5rem;"></i>Date</th>
                                    <th><i class="fa fa-money-bill-wave" style="margin-right: 0.5rem;"></i>Amount</th>
                                    <th><i class="fa fa-flag" style="margin-right: 0.5rem;"></i>Status</th>
                                    <th><i class="fa fa-user-tie" style="margin-right: 0.5rem;"></i>Account Manager</th>
                                    <th><i class="fa fa-percentage" style="margin-right: 0.5rem;"></i>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotes.slice(0, 10).map(quote => `
                                    <tr onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')" style="cursor: pointer;">
                                        <td>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <strong>${quote.quotation}</strong>
                                                <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${quote.quotation}', '_blank')" title="Open quotation in new tab" style="padding: 0.2rem 0.4rem; font-size: 0.7rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                                    <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td>${quote.customer_name || quote.party_name || 'Unknown'}</td>
                                        <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
                                        <td>AED ${this.formatCurrency(quote.base_grand_total)}</td>
                                        <td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td>
                                        <td><span class="account-manager-badge" title="${quote.account_incharge_full_name || quote.account_incharge || 'Not assigned'}"><i class="fa fa-user" style="margin-right: 0.25rem; color: var(--accent-blue);"></i>${quote.account_incharge_full_name || quote.account_incharge || 'Not assigned'}</span></td>
                                        <td><span class="margin-badge ${this.getMarginClass(quote.profit_percentage)}">${quote.profit_percentage || 0}%</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${quotes.length > 10 ? `<p style="color: var(--text-muted); margin-top: 1rem;">Showing recent 10 of ${quotes.length} quotations.</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    calculateManagerDetailStats(quotes) {
        const stats = {
            total_quotes: quotes.length,
            total_value: quotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
            won_quotes: quotes.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status)).length,
            won_value: quotes.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status))
                .reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
            avg_margin: quotes.length > 0 ? 
                (quotes.reduce((sum, q) => sum + (parseFloat(q.profit_percentage) || 0), 0) / quotes.length).toFixed(1) : 0
        };
        
        stats.conversion_rate = stats.total_quotes > 0 ? 
            (stats.won_quotes / stats.total_quotes * 100).toFixed(1) : 0;
        stats.avg_quote_value = stats.total_quotes > 0 ? 
            stats.total_value / stats.total_quotes : 0;
        
        return stats;
    }

    showOpportunityDrilldown(type) {
        const opportunityStats = this.data.opportunity_stats;
        let data, title;
        
        switch(type) {
            case 'total':
                data = this.data.opportunities || [];
                title = 'All Opportunities';
                break;
            case 'quoted':
                data = opportunityStats.quoted_opportunities || [];
                title = 'Quoted Opportunities';
                break;
            case 'not_quoted':
                data = opportunityStats.not_quoted_opportunities || [];
                title = 'Opportunities Needing Quotations';
                break;
            default:
                // Check if it's a status-based filter
                if (opportunityStats.by_status && opportunityStats.by_status[type]) {
                    data = opportunityStats.by_status[type].opportunities || [];
                    title = `${type} Opportunities`;
                } else {
                    data = this.data.opportunities || [];
                    title = 'Opportunities';
                }
        }

        const content = this.generateOpportunityDrilldownContent(data, type);
        $('#drilldown-title').html(`<i class="fa fa-lightbulb"></i> ${title}`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    generateOpportunityDrilldownContent(data, type) {
        if (!data || data.length === 0) {
            return '<div class="text-center" style="padding: 2rem;"><p style="color: var(--text-secondary);"><i class="fa fa-lightbulb" style="margin-right: 0.5rem; font-size: 1.2rem;"></i>No opportunities available for the selected criteria.</p></div>';
        }

        const totalValue = data.reduce((sum, opp) => sum + (opp.opportunity_amount || 0), 0);
        const avgValue = data.length > 0 ? totalValue / data.length : 0;
        const quotedCount = data.filter(opp => opp.quotations && opp.quotations.length > 0).length;
        const quotationRate = data.length > 0 ? (quotedCount / data.length * 100).toFixed(1) : 0;

        return `
            <div class="drilldown-container">
                <div class="modal-section">
                    <h6><i class="fa fa-info-circle"></i>Summary</h6>
                    <div class="row">
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${data.length}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Opportunities</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(totalValue)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(avgValue)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Average Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${quotationRate}%</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Quotation Rate</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section" style="margin-top: 1.5rem;">
                    <h6><i class="fa fa-table"></i>Detailed Data</h6>
                    ${this.renderTableWithControls('opportunity-drilldown-table', data.slice(0, 100), this.getOpportunityColumns(type))}
                    ${data.length > 100 ? `<p style="color: var(--text-muted); margin-top: 1rem;">Showing first 100 of ${data.length} records.</p>` : ''}
                </div>
            </div>
        `;
    }

    generateGenericDrilldownContent(data, columns, entityName) {
        if (!data || data.length === 0) {
            return `<div class="text-center" style="padding: 2rem;"><p style="color: var(--text-secondary);"><i class="fa fa-inbox" style="margin-right: 0.5rem; font-size: 1.2rem;"></i>No ${entityName.toLowerCase()} available for the selected criteria.</p></div>`;
        }

        return `
            <div class="drilldown-container">
                <div class="modal-section">
                    <h6><i class="fa fa-info-circle"></i>Summary</h6>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-value">${data.length}</div>
                                <div class="summary-label">Total ${entityName}</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-value">${new Date().toLocaleDateString()}</div>
                                <div class="summary-label">Report Date</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-value">${Math.ceil(data.length / 50)}</div>
                                <div class="summary-label">Pages (50 per page)</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section" style="margin-top: 1.5rem;">
                    <h6><i class="fa fa-table"></i>Detailed Data</h6>
                    ${this.renderTableWithControls('generic-drilldown-table', data, columns)}
                </div>
            </div>
        `;
    }

    getOpportunityColumns(type) {
        if (type === 'design-request') {
            return [
                { key: 'name', label: 'Design Request', sortable: true, type: 'design_request_link', icon: 'fa-drafting-compass' },
                { key: 'customer', label: 'Customer', sortable: true, icon: 'fa-building' },
                { key: 'custom_branch', label: 'Branch', sortable: true, icon: 'fa-code-branch' },
                { key: 'workflow_state', label: 'Workflow State', sortable: true, type: 'badge', icon: 'fa-cog' },
                { key: 'creation', label: 'Created', sortable: true, type: 'datetime', icon: 'fa-calendar-plus' },
                { key: 'modified', label: 'Modified', sortable: true, type: 'datetime', icon: 'fa-clock' }
            ];
        }
        
        if (type === 'site-visit') {
            return [
                { key: 'name', label: 'Site Visit', sortable: true, type: 'site_visit_link', icon: 'fa-map-marker-alt' },
                { key: 'customer', label: 'Customer', sortable: true, icon: 'fa-building' },
                { key: 'custom_branch', label: 'Branch', sortable: true, icon: 'fa-code-branch' },
                { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' },
                { key: 'creation', label: 'Created', sortable: true, type: 'datetime', icon: 'fa-calendar-plus' },
                { key: 'modified', label: 'Modified', sortable: true, type: 'datetime', icon: 'fa-clock' }
            ];
        }
        
        if (type === 'permit') {
            return [
                { key: 'name', label: 'Permit', sortable: true, type: 'permit_link', icon: 'fa-file-signature' },
                { key: 'customer', label: 'Customer', sortable: true, icon: 'fa-building' },
                { key: 'company', label: 'Company', sortable: true, icon: 'fa-building' },
                { key: 'workflow_state', label: 'Workflow State', sortable: true, type: 'badge', icon: 'fa-cog' },
                { key: 'posting_date', label: 'Posting Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                { key: 'creation', label: 'Created', sortable: true, type: 'datetime', icon: 'fa-calendar-plus' },
                { key: 'modified', label: 'Modified', sortable: true, type: 'datetime', icon: 'fa-clock' }
            ];
        }

        // Default opportunity columns
        const baseColumns = [
            { key: 'name', label: 'Opportunity', sortable: true, type: 'opportunity_link', icon: 'fa-lightbulb' },
            { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
            { key: 'opportunity_amount', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
            { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' },
            { key: 'expected_closing', label: 'Expected Closing', sortable: true, type: 'date', icon: 'fa-calendar' }
        ];

        if (type === 'quoted') {
            baseColumns.push({ 
                key: 'quotations', 
                label: 'Quotations', 
                sortable: false, 
                type: 'quotation_links', 
                icon: 'fa-file-alt' 
            });
        }

        return baseColumns;
    }

    showItemDetails(itemCode) {
        const itemQuotes = this.data.quotations.filter(q => 
            q.items && q.items.some(item => item.item_code === itemCode)
        );
        
        if (itemQuotes.length === 0) {
            frappe.msgprint(`No quotations found for item ${itemCode}.`);
            return;
        }
        
        const content = this.generateItemDetailsContent(itemCode, itemQuotes);
        $('#quotation-title').html(`<i class="fa fa-cube"></i> ${itemCode} - Item Analysis`);
        $('#quotation-content').html(content);
        $('#quotationDetailsModal').modal('show');
    }

    generateItemDetailsContent(itemCode, quotes) {
        // Get item details from the first occurrence
        const firstItem = quotes[0].items.find(item => item.item_code === itemCode);
        
        // Calculate item statistics
        const itemStats = {
            total_quotes: quotes.length,
            total_qty: 0,
            total_value: 0,
            total_cost: 0,
            avg_rate: 0,
            avg_cost: 0,
            margins: [],
            customers: new Set()
        };
        
        quotes.forEach(quote => {
            const item = quote.items.find(i => i.item_code === itemCode);
            if (item) {
                itemStats.total_qty += item.qty || 0;
                itemStats.total_value += item.amount || 0;
                itemStats.total_cost += (item.standard_buying || 0) * (item.qty || 0);
                if (item.rate && item.standard_buying) {
                    const margin = ((item.rate - item.standard_buying) / item.rate * 100);
                    itemStats.margins.push(margin);
                }
                itemStats.customers.add(quote.customer_name || quote.party_name);
            }
        });
        
        itemStats.avg_rate = itemStats.total_qty > 0 ? itemStats.total_value / itemStats.total_qty : 0;
        itemStats.avg_cost = itemStats.total_qty > 0 ? itemStats.total_cost / itemStats.total_qty : 0;
        itemStats.avg_margin = itemStats.margins.length > 0 ? 
            (itemStats.margins.reduce((sum, m) => sum + m, 0) / itemStats.margins.length).toFixed(1) : 0;
        
        return `
            <div class="item-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-info-circle"></i>Item Information</h6>
                    <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem;">
                        ${firstItem.image ? 
                            `<img src="${firstItem.image}" alt="${itemCode}" style="width: 100px; height: 100px; border-radius: 12px; object-fit: cover; border: 2px solid var(--border-color);">` : 
                            `<div style="width: 100px; height: 100px; border-radius: 12px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; color: white; font-size: 40px;">
                                <i class="fa fa-cube"></i>
                            </div>`
                        }
                        <div style="flex: 1;">
                            <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${itemCode}</h3>
                            ${firstItem.brand ? `<p style="font-size: 1rem; color: var(--text-secondary); margin: 0 0 0.5rem 0;"><i class="fa fa-tag" style="margin-right: 0.5rem;"></i>${firstItem.brand}</p>` : ''}
                            ${firstItem.custom_category ? `<p style="font-size: 1rem; color: var(--text-secondary); margin: 0 0 0.5rem 0;"><i class="fa fa-layer-group" style="margin-right: 0.5rem;"></i><strong>Category:</strong> ${firstItem.custom_category}</p>` : ''}
                            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                                <span style="color: var(--accent-blue); font-weight: 600;">${itemStats.total_quotes} Quotes</span>
                                <span style="color: var(--accent-green); font-weight: 600;">${itemStats.customers.size} Customers</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <span style="color: var(--accent-orange); font-weight: 600;">Avg Rate: AED ${this.formatCurrency(itemStats.avg_rate || 0)}</span>
                                <span style="color: var(--accent-cyan); font-weight: 600;">Avg Cost: AED ${this.formatCurrency(itemStats.avg_cost || 0)}</span>
                                <span style="color: var(--accent-purple); font-weight: 600;">Avg Margin: ${itemStats.avg_margin}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${itemStats.total_qty}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Quantity</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(itemStats.total_value)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(itemStats.avg_rate)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Average Rate</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div style="text-align: center; padding: 1rem; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${itemStats.customers.size}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Unique Customers</p>
                            </div>
                        </div>
                    </div>
                    <div class="row" style="margin-top: 1rem;">
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(itemStats.total_cost)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Cost</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(itemStats.total_value - itemStats.total_cost)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Profit</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(168, 85, 247, 0.1); border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${itemStats.avg_margin}%</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Average Margin</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h6><i class="fa fa-list"></i>Quotations Containing This Item</h6>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th><i class="fa fa-file-alt" style="margin-right: 0.5rem;"></i>Quotation</th>
                                    <th><i class="fa fa-building" style="margin-right: 0.5rem;"></i>Customer</th>
                                    <th><i class="fa fa-calendar" style="margin-right: 0.5rem;"></i>Date</th>
                                    <th><i class="fa fa-user-tie" style="margin-right: 0.5rem;"></i>Account Manager</th>
                                    <th><i class="fa fa-hashtag" style="margin-right: 0.5rem;"></i>Qty</th>
                                    <th><i class="fa fa-money-bill" style="margin-right: 0.5rem;"></i>Rate</th>
                                    <th><i class="fa fa-money-bill-wave" style="margin-right: 0.5rem;"></i>Amount</th>
                                    <th><i class="fa fa-coins" style="margin-right: 0.5rem;"></i>Cost</th>
                                    <th><i class="fa fa-chart-line" style="margin-right: 0.5rem;"></i>Profit</th>
                                    <th><i class="fa fa-percentage" style="margin-right: 0.5rem;"></i>Margin</th>
                                    <th><i class="fa fa-flag" style="margin-right: 0.5rem;"></i>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotes.map(quote => {
                                    const item = quote.items.find(i => i.item_code === itemCode);
                                    return `
                                        <tr onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')" style="cursor: pointer;">
                                            <td>
                                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                                    <strong>${quote.quotation}</strong>
                                                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${quote.quotation}', '_blank')" title="Open quotation in new tab" style="padding: 0.2rem 0.4rem; font-size: 0.7rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                                        <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                                    </button>
                                                </div>
                                            </td>
                                            <td>${quote.customer_name || quote.party_name || 'Unknown'}</td>
                                            <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
                                            <td><span class="account-manager-badge" title="${quote.account_incharge_full_name || quote.account_incharge || 'Not assigned'}"><i class="fa fa-user" style="margin-right: 0.25rem; color: var(--accent-blue);"></i>${quote.account_incharge_full_name || quote.account_incharge || 'Not assigned'}</span></td>
                                            <td>${item.qty || 0}</td>
                                            <td>AED ${this.formatCurrency(item.rate || 0)}</td>
                                            <td>AED ${this.formatCurrency(item.amount || 0)}</td>
                                            <td>AED ${this.formatCurrency((item.standard_buying || 0) * (item.qty || 0))}</td>
                                            <td>AED ${this.formatCurrency((item.amount || 0) - ((item.standard_buying || 0) * (item.qty || 0)))}</td>
                                            <td><span class="margin-badge ${this.getMarginClass(item.rate && item.standard_buying ? ((item.rate - item.standard_buying) / item.rate * 100) : 0)}">${item.rate && item.standard_buying ? ((item.rate - item.standard_buying) / item.rate * 100).toFixed(1) : 0}%</span></td>
                                            <td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    showCustomerSegment(segment) {
        const data = this.data.stats.customers.segments[segment].customers;
        const segmentInfo = this.data.stats.customers.segments[segment];
        
        const content = this.generateCustomerSegmentContent(data, segmentInfo);
        $('#drilldown-title').html(`<i class="fa fa-users"></i> ${segmentInfo.name}`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    generateCustomerSegmentContent(customers, segmentInfo) {
        if (!customers || customers.length === 0) {
            return '<div class="text-center" style="padding: 2rem;"><p style="color: var(--text-secondary);">No customers in this segment.</p></div>';
        }

        const totalValue = customers.reduce((sum, c) => sum + c.total_value, 0);
        const avgValue = totalValue / customers.length;
        const avgConversion = customers.reduce((sum, c) => sum + parseFloat(c.conversion_rate), 0) / customers.length;

        return `
            <div class="segment-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-chart-bar"></i>Segment Overview: ${segmentInfo.name}</h6>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${segmentInfo.criteria}</p>
                    <div class="row">
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${customers.length}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Customers</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(avgValue)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Avg Customer Value</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${avgConversion.toFixed(1)}%</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Avg Conversion</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h6><i class="fa fa-list"></i>Customer Details <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal;">Click customer names to view their quotations</span></h6>
                    ${this.renderTableWithControls('segment-customers', customers, [
                        { key: 'name', label: 'Customer Name', sortable: true, type: 'customer_link' },
                        { key: 'total_quotes', label: 'Total Quotes', sortable: true },
                        { key: 'total_value', label: 'Total Value', sortable: true, type: 'currency' },
                        { key: 'conversion_rate', label: 'Conversion', sortable: true, type: 'conversion' },
                        { key: 'avg_margin', label: 'Avg Margin', sortable: true, type: 'margin' },
                        { key: 'days_since_last_quote', label: 'Days Since Last', sortable: true, type: 'days' }
                    ])}
                </div>
            </div>
        `;
    }

    // Filter and utility methods
    async populateFilterOptions() {
        // Populate company options for searchable dropdown - restricted to METROPLUS ADVERTISING LLC only
        const companyOptions = $('#company-options');
        if (companyOptions.find('.searchable-option:not([data-value=""])').length === 0) {
            companyOptions.append(`<div class="searchable-option" data-value="PRASTARA DECORATION DESIGN L.L.C">PRASTARA DECORATION DESIGN L.L.C</div>`);
        }

        // Populate branch options for searchable dropdown
        const branches = [...new Set(this.data.quotations.map(q => q.custom_branch).filter(Boolean))];
        const branchOptions = $('#branch-options');
        branchOptions.find('.searchable-option:not([data-value=""])').remove(); // Keep "All Branches" option
        branches.forEach(branch => {
            branchOptions.append(`<div class="searchable-option" data-value="${branch}">${branch}</div>`);
        });

        // Populate account manager options for searchable dropdown
        const managers = [...new Set(this.data.quotations.map(q => q.account_incharge).filter(Boolean))];
        const managerOptions = $('#account-manager-options');
        managerOptions.find('.searchable-option:not([data-value=""])').remove(); // Keep "All Managers" option
        managers.forEach(manager => {
            const displayName = this.data.quotations.find(q => q.account_incharge === manager)?.account_incharge_full_name || manager;
            managerOptions.append(`<div class="searchable-option multi-selectable" data-value="${manager}">${displayName}</div>`);
        });

        // Populate sales team options from quotation custom_team field
        console.log('About to populate team options from populateFilterOptions...');
        this.populateTeamOptionsFromQuotations();

        // Set current values for searchable dropdowns
        // Set company searchable dropdown value
        if (this.filters.company) {
            $('#filter-company').val(this.filters.company);
            $('#filter-company-input').val(this.filters.company);
        } else {
            $('#filter-company').val('');
            $('#filter-company-input').val('');
        }
        
        // Set branch searchable dropdown value
        if (this.filters.branch) {
            $('#filter-branch').val(this.filters.branch);
            $('#filter-branch-input').val(this.filters.branch);
        } else {
            $('#filter-branch').val('');
            $('#filter-branch-input').val('');
        }
        
        // Set account manager multi-select dropdown values (restored UI)
        if (this.filters.account_incharge && this.filters.account_incharge !== '') {
            const selectedManagers = this.filters.account_incharge.split(',').filter(Boolean);
            const options = $('#account-manager-options');
            
            $('#filter-account-manager').val(this.filters.account_incharge);
            
            // Mark selected options with multi-selected class
            selectedManagers.forEach(manager => {
                options.find(`.searchable-option[data-value="${manager}"]`).addClass('multi-selected');
            });
            
            this.updateAccountManagerDisplay();
        } else {
            $('#filter-account-manager').val('');
            $('#filter-account-manager-input').val('');
            $('#selected-managers-display').hide();
            $('#account-manager-options .searchable-option').removeClass('multi-selected');
        }
        
        // Set sales team searchable dropdown value
        if (this.filters.sales_team) {
            $('#filter-sales-team').val(this.filters.sales_team);
            $('#filter-sales-team-input').val(this.filters.sales_team);
        } else {
            $('#filter-sales-team').val('');
            $('#filter-sales-team-input').val('');
        }
        
        // Set status searchable dropdown value
        if (this.filters.status && this.filters.status !== 'all') {
            $('#filter-status').val(this.filters.status);
            $('#filter-status-input').val(this.filters.status);
        } else {
            $('#filter-status').val('all');
            $('#filter-status-input').val('All Status');
        }
        
        $('#filter-amount-min').val(this.filters.amount_min || '');
        $('#filter-amount-max').val(this.filters.amount_max || '');
    }

    applyAdvancedFilters() {
        this.filters.company = $('#filter-company').val() || '';
        this.filters.branch = $('#filter-branch').val() || '';
        this.filters.account_incharge = $('#filter-account-manager').val() || '';
        this.filters.sales_team = $('#filter-sales-team').val() || '';
        this.filters.status = $('#filter-status').val() || 'all';
        this.filters.amount_min = parseFloat($('#filter-amount-min').val()) || null;
        this.filters.amount_max = parseFloat($('#filter-amount-max').val()) || null;
        
        console.log('Applied filters - account_incharge:', this.filters.account_incharge);
        if (this.filters.account_incharge && this.filters.account_incharge.includes(',')) {
            console.log('Multiple managers selected:', this.filters.account_incharge.split(','));
        }
        
        // Apply filters to existing data instead of reloading
        this.applyFilters();
        this.calculateStats();
        this.renderCurrentSection();
    }

    clearAllFilters() {
        this.filters = {
            from_date: this.filters.from_date,
            to_date: this.filters.to_date,
            status: 'all',
            company: 'PRASTARA DECORATION DESIGN L.L.C',
            branch: '',
            account_incharge: '',
            created_by: '',
            customer: null,
            amount_min: null,
            amount_max: null,
            margin_min: null,
            margin_max: null,
            quotation_to: ['Customer', 'Lead'],
            search_query: '',
            items: [],
            workflow_state: []
        };
        
        $('#global-search').val('');
        
        // Reset searchable dropdowns
        $('#filter-company-input').val('');
        $('#filter-branch-input').val('');
        $('#filter-account-manager-input').val('');
        $('#filter-sales-team-input').val('');
        $('#filter-status-input').val('');
        
        // Reset hidden input fields (these are what applyAdvancedFilters reads from)
        $('#filter-company').val('');
        $('#filter-branch').val('');
        $('#filter-account-manager').val('');
        $('#filter-sales-team').val('');
        $('#filter-status').val('all');
        $('#filter-amount-min').val('');
        $('#filter-amount-max').val('');
        
        // Reset account manager multi-select
        $('#selected-managers-display').hide();
        $('#account-manager-options .searchable-option').removeClass('multi-selected');
        
        // Apply cleared filters to existing data instead of reloading
        this.applyFilters();
        this.calculateStats();
        this.renderCurrentSection();
    }

    updateDateRangeText() {
        // Check if current date range matches a preset
        if (this.currentPreset) {
            const presetRange = this.getDateRangeForPreset(this.currentPreset);
            if (presetRange.from_date === this.filters.from_date && 
                presetRange.to_date === this.filters.to_date) {
                $('#date-range-text').text(this.getPresetLabel(this.currentPreset));
                return;
            } else {
                // Date range was manually changed, clear preset
                this.currentPreset = null;
            }
        }
        
        // Default behavior for custom ranges
        const fromDate = new Date(this.filters.from_date);
        const toDate = new Date(this.filters.to_date);
        const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
        
        if (days === 1) {
            $('#date-range-text').text(fromDate.toLocaleDateString());
        } else {
            $('#date-range-text').text(`${days} Days Selected`);
        }
    }

    async loadAllData() {
        try {
            // Show confirmation dialog
            const confirmed = await new Promise((resolve) => {
                frappe.confirm(
                    `Are you sure you want to load all ${this.data.metadata.total_count.toLocaleString()} quotations? This may take a moment and could slow down the interface.`,
                    () => resolve(true),
                    () => resolve(false)
                );
            });

            if (confirmed) {
                this.requestAllData = true;
                await this.loadData();
                this.requestAllData = false; // Reset flag
                frappe.show_alert({
                    message: `Successfully loaded all ${this.data.quotations.length.toLocaleString()} quotations!`,
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Failed to load all data:', error);
            frappe.msgprint('Failed to load all data. Please try again.');
        }
    }

    // Utility methods
    showLoading() {
        $('#loading-overlay').show();
    }

    hideLoading() {
        $('#loading-overlay').hide();
    }

    formatCurrency(amount) {
        if (!amount) return '0';
        
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + 'K';
        }
        
        return Math.round(amount).toLocaleString();
    }

    getStatusClass(status) {
        const statusMap = {
            'Ordered': 'success',
            'Partially Ordered': 'info',
            'Open': 'warning',
            'Expired': 'danger',
            'Lost': 'danger'
        };
        return statusMap[status] || 'info';
    }

    getStatusIcon(status) {
        const iconMap = {
            'Ordered': 'fa-check-circle',
            'Partially Ordered': 'fa-clock',
            'Open': 'fa-circle-o',
            'Expired': 'fa-times-circle',
            'Lost': 'fa-times-circle'
        };
        return iconMap[status] || 'fa-info-circle';
    }

    getUserAvatar(userName, size = 40) {
        if (!userName) {
            return `<div class="user-avatar" style="width: ${size}px; height: ${size}px; border-radius: 50%; background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-size: ${size/2.5}px; font-weight: 700;">?</div>`;
        }
        
        // Try to get user image from Frappe
        const userImage = frappe.user_info(userName)?.image;
        
        if (userImage) {
            return `<img class="user-avatar" src="${userImage}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);" alt="${userName}">`;
        } else {
            // Fallback to initials
            const initials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const colors = ['var(--accent-blue)', 'var(--accent-green)', 'var(--accent-orange)', 'var(--accent-purple)', 'var(--accent-cyan)'];
            const colorIndex = userName.charCodeAt(0) % colors.length;
            
            return `<div class="user-avatar" style="width: ${size}px; height: ${size}px; border-radius: 50%; background: ${colors[colorIndex]}; display: flex; align-items: center; justify-content: center; color: white; font-size: ${size/2.5}px; font-weight: 700; border: 2px solid var(--border-color);">${initials}</div>`;
        }
    }

    getDateRangeForPreset(preset) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const date = today.getDate();
        const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        let fromDate, toDate;
        
        switch (preset) {
            case 'today':
                fromDate = toDate = new Date(year, month, date);
                break;
                
            case 'yesterday':
                fromDate = toDate = new Date(year, month, date - 1);
                break;
                
            case 'this_week':
                // Start from Monday (day 1)
                const daysFromMonday = (day + 6) % 7;
                fromDate = new Date(year, month, date - daysFromMonday);
                toDate = new Date(year, month, date + (6 - daysFromMonday));
                break;
                
            case 'last_week':
                const lastWeekDaysFromMonday = (day + 6) % 7 + 7;
                fromDate = new Date(year, month, date - lastWeekDaysFromMonday);
                toDate = new Date(year, month, date - lastWeekDaysFromMonday + 6);
                break;
                
            case 'this_month':
                fromDate = new Date(year, month, 1);
                toDate = new Date(year, month + 1, 0); // Last day of current month
                break;
                
            case 'last_month':
                fromDate = new Date(year, month - 1, 1);
                toDate = new Date(year, month, 0); // Last day of previous month
                break;
                
            case 'this_quarter':
                const currentQuarter = Math.floor(month / 3);
                fromDate = new Date(year, currentQuarter * 3, 1);
                toDate = new Date(year, currentQuarter * 3 + 3, 0);
                break;
                
            case 'last_quarter':
                const lastQuarter = Math.floor(month / 3) - 1;
                const lastQuarterYear = lastQuarter < 0 ? year - 1 : year;
                const lastQuarterMonth = lastQuarter < 0 ? 3 : lastQuarter * 3;
                fromDate = new Date(lastQuarterYear, lastQuarterMonth, 1);
                toDate = new Date(lastQuarterYear, lastQuarterMonth + 3, 0);
                break;
                
            case 'this_year':
                fromDate = new Date(year, 0, 1);
                toDate = new Date(year, 11, 31);
                break;
                
            case 'last_year':
                fromDate = new Date(year - 1, 0, 1);
                toDate = new Date(year - 1, 11, 31);
                break;
                
            default:
                fromDate = toDate = today;
        }
        
        return {
            from_date: fromDate.toISOString().split('T')[0],
            to_date: toDate.toISOString().split('T')[0]
        };
    }

    getPresetLabel(preset) {
        const labels = {
            'today': 'Today',
            'yesterday': 'Yesterday', 
            'this_week': 'This Week',
            'last_week': 'Last Week',
            'this_month': 'This Month',
            'last_month': 'Last Month',
            'this_quarter': 'This Quarter',
            'last_quarter': 'Last Quarter',
            'this_year': 'This Year',
            'last_year': 'Last Year'
        };
        return labels[preset] || 'Custom Range';
    }

    detectCurrentPreset() {
        // Check if current date range matches any preset
        const presets = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year'];
        
        for (const preset of presets) {
            const range = this.getDateRangeForPreset(preset);
            if (range.from_date === this.filters.from_date && range.to_date === this.filters.to_date) {
                this.currentPreset = preset;
                return;
            }
        }
        
        // No preset matches, it's a custom range
        this.currentPreset = null;
    }

    selectYearlyRange() {
        const selectedYear = $('#yearly-select').val();
        if (!selectedYear) return;
        
        // Set from date to January 1st of selected year
        const fromDate = `${selectedYear}-01-01`;
        
        // Set to date to December 31st of selected year
        const toDate = `${selectedYear}-12-31`;
        
        // Update the date input fields
        $('#from-date').val(fromDate);
        $('#to-date').val(toDate);
        
        // Clear all preset button active states since this is a custom yearly selection
        $('.preset-btn').removeClass('active');
        
        // Clear current preset since this is custom
        this.currentPreset = null;
        
        // Visual feedback - highlight the select dropdown temporarily
        $('#yearly-select').css('background-color', '#e3f2fd');
        setTimeout(() => {
            $('#yearly-select').css('background-color', '');
        }, 500);
    }

    getMarginClass(margin) {
        const marginValue = parseFloat(margin);
        if (marginValue >= 30) return 'success';
        if (marginValue >= 20) return 'info';
        if (marginValue >= 15) return 'warning';
        return 'danger';
    }

    getConversionColor(rate) {
        const conversionRate = parseFloat(rate);
        if (conversionRate >= 60) return '#10b981';
        if (conversionRate >= 40) return '#3b82f6';
        if (conversionRate >= 20) return '#f59e0b';
        return '#ef4444';
    }

    // Chart initialization methods (keeping existing)
    initializeCharts() {
        if (this.currentSection === 'overview') {
            this.drawStatusChart();
            this.drawTrendChart();
        }
    }

    drawStatusChart() {
        const canvas = document.getElementById('statusChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const statuses = ['Open', 'Ordered', 'Lost', 'Expired', 'Partially Ordered'];
        const colors = ['#f59e0b', '#10b981', '#ef4444', '#6b7280', '#3b82f6'];
        
        const data = statuses.map(status => 
            this.data.filtered.filter(q => q.status === status).length
        );
        
        const total = data.reduce((sum, val) => sum + val, 0);
        if (total === 0) return;
        
        let currentAngle = 0;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 50;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        data.forEach((value, index) => {
            if (value > 0) {
                const sliceAngle = (value / total) * 2 * Math.PI;
                
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                ctx.lineTo(centerX, centerY);
                ctx.fillStyle = colors[index];
                ctx.fill();
                
                currentAngle += sliceAngle;
            }
        });
        
        // Legend
        let legendY = 20;
        statuses.forEach((status, index) => {
            if (data[index] > 0) {
                ctx.fillStyle = colors[index];
                ctx.fillRect(10, legendY, 15, 15);
                ctx.fillStyle = '#f1f5f9';
                ctx.font = '12px Arial';
                ctx.fillText(`${status}: ${data[index]}`, 30, legendY + 12);
                legendY += 20;
            }
        });
    }

    drawTrendChart() {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        
        // Group data by month
        const monthlyData = {};
        this.data.filtered.forEach(quote => {
            const month = quote.transaction_date.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { count: 0, amount: 0 };
            }
            monthlyData[month].count++;
            monthlyData[month].amount += quote.base_grand_total || 0;
        });
        
        const months = Object.keys(monthlyData).sort();
        const counts = months.map(month => monthlyData[month].count);
        
        if (months.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const maxCount = Math.max(...counts, 1);
        const chartHeight = canvas.height - 60;
        const chartWidth = canvas.width - 60;
        const barWidth = chartWidth / months.length;
        
        // Draw bars
        counts.forEach((count, index) => {
            const barHeight = (count / maxCount) * chartHeight;
            const x = 40 + index * barWidth;
            const y = canvas.height - 40 - barHeight;
            
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(x, y, barWidth - 2, barHeight);
            
            // Month labels
            ctx.fillStyle = '#f1f5f9';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            if (months[index]) {
                ctx.fillText(months[index].substring(5), x + barWidth / 2, canvas.height - 10);
                ctx.fillText(count.toString(), x + barWidth / 2, y - 5);
            }
        });
    }

    showPipelineDetails(stage) {
        const pipelineData = this.data.stats.pipeline[stage];
        if (!pipelineData || !pipelineData.quotes) {
            frappe.msgprint(`No data available for Pipeline ${stage}.`);
            return;
        }

        const content = this.generatePipelineDetailsContent(stage, pipelineData.quotes);
        $('#quotation-title').html(`<i class="fa fa-layer-group"></i> Pipeline ${stage} - Value Range Analysis`);
        $('#quotation-content').html(content);
        $('#quotationDetailsModal').modal('show');
    }

    generatePipelineDetailsContent(stage, quotes) {
        // Define value ranges
        const ranges = [
            { min: 0, max: 5000, label: '0 - 5K AED', id: '0-5k', color: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' },
            { min: 5000, max: 10000, label: '5K - 10K AED', id: '5-10k', color: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },
            { min: 10000, max: 25000, label: '10K - 25K AED', id: '10-25k', color: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
            { min: 25000, max: 50000, label: '25K - 50K AED', id: '25-50k', color: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },
            { min: 50000, max: 100000, label: '50K - 100K AED', id: '50-100k', color: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' },
            { min: 100000, max: Infinity, label: '100K+ AED', id: '100k+', color: 'rgba(236, 72, 153, 0.1)', borderColor: 'rgba(236, 72, 153, 0.3)' }
        ];

        // Categorize quotes by value ranges
        const rangeStats = ranges.map(range => {
            const rangeQuotes = quotes.filter(quote => {
                const amount = quote.base_grand_total || 0;
                return amount >= range.min && amount < range.max;
            });

            return {
                ...range,
                count: rangeQuotes.length,
                amount: rangeQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
                quotes: rangeQuotes
            };
        });

        const totalCount = quotes.length;
        const totalAmount = quotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0);

        return `
            <div class="pipeline-details">
                <div class="modal-section">
                    <h6><i class="fa fa-info-circle"></i>Pipeline ${stage} Overview</h6>
                    <div class="row" style="margin-bottom: 2rem;">
                        <div class="col-md-6">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${totalCount}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Total Quotations</p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(totalAmount)}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-section">
                    <h6><i class="fa fa-chart-bar"></i>Value Range Breakdown</h6>
                    <div class="row">
                        ${rangeStats.map(range => `
                            <div class="col-md-4 mb-3">
                                <div class="range-card" style="padding: 1.5rem; background: ${range.color}; border: 1px solid ${range.borderColor}; border-radius: 12px; cursor: pointer; transition: all 0.3s ease;" onclick="frappe.sales_intelligence.showRangeQuotations('${stage}', '${range.id}', '${range.label}')">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                                        <h5 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0;">${range.label}</h5>
                                        <i class="fa fa-chevron-right" style="color: var(--text-secondary);"></i>
                                    </div>
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <span style="font-size: 0.875rem; color: var(--text-secondary);">Count:</span>
                                        <strong style="font-size: 1.25rem; color: var(--text-primary);">${range.count}</strong>
                                    </div>
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <span style="font-size: 0.875rem; color: var(--text-secondary);">Amount:</span>
                                        <strong style="font-size: 1rem; color: var(--text-primary);">AED ${this.formatCurrency(range.amount)}</strong>
                                    </div>
                                    ${range.count === 0 ? '<div style="text-align: center; margin-top: 1rem; color: var(--text-muted); font-style: italic;">No quotations</div>' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="modal-section">
                    <h6><i class="fa fa-list"></i>All Quotations in Pipeline ${stage}</h6>
                    <div class="quotations-list-container">
                        ${this.renderTableWithControls(`pipeline-${stage.toLowerCase()}-quotations-table`, quotes, [
                            { key: 'quotation', label: 'Quotation #', sortable: true, icon: 'fa-file-alt' },
                            { key: 'party_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                            { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                            { key: 'base_grand_total', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                            { key: 'workflow_state', label: 'Workflow State', sortable: true, icon: 'fa-tasks' },
                            { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                            { key: 'custom_branch', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
                            { key: 'valid_till', label: 'Valid Till', sortable: true, type: 'date', icon: 'fa-clock' }
                        ])}
                    </div>
                </div>
            </div>
        `;
    }

    showRangeQuotations(stage, rangeId, rangeLabel) {
        const pipelineData = this.data.stats.pipeline[stage];
        if (!pipelineData || !pipelineData.quotes) {
            frappe.msgprint(`No data available for Pipeline ${stage}.`);
            return;
        }

        // Define the range based on rangeId
        const ranges = {
            '0-5k': { min: 0, max: 5000 },
            '5-10k': { min: 5000, max: 10000 },
            '10-25k': { min: 10000, max: 25000 },
            '25-50k': { min: 25000, max: 50000 },
            '50-100k': { min: 50000, max: 100000 },
            '100k+': { min: 100000, max: Infinity }
        };

        const range = ranges[rangeId];
        const filteredQuotes = pipelineData.quotes.filter(quote => {
            const amount = quote.base_grand_total || 0;
            return amount >= range.min && amount < range.max;
        });

        if (filteredQuotes.length === 0) {
            frappe.msgprint(`No quotations found in ${rangeLabel} range.`);
            return;
        }

        const content = this.generateRangeQuotationsContent(stage, rangeLabel, filteredQuotes);
        $('#quotation-title').html(`<i class="fa fa-list"></i> Pipeline ${stage} - ${rangeLabel} Quotations`);
        $('#quotation-content').html(content);
        $('#quotationDetailsModal').modal('show');
    }

    generateRangeQuotationsContent(stage, rangeLabel, quotes) {
        const stats = {
            count: quotes.length,
            totalAmount: quotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0),
            avgAmount: quotes.length > 0 ? quotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) / quotes.length : 0,
            customers: new Set(quotes.map(q => q.customer_name || q.party_name)).size
        };

        return `
            <div class="range-quotations">
                <div class="modal-section">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <button class="btn btn-secondary" onclick="frappe.sales_intelligence.showPipelineDetails('${stage}')" style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa fa-arrow-left"></i>
                            Back to Pipeline ${stage}
                        </button>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">${stats.count} quotations</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">•</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">${stats.customers} customers</span>
                        </div>
                    </div>
                    
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.count}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Quotes</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(stats.totalAmount)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Total Value</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h4 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(stats.avgAmount)}</h4>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">Average Value</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-section">
                    <h6><i class="fa fa-file-alt"></i>Quotations in ${rangeLabel}</h6>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th><i class="fa fa-file-alt" style="margin-right: 0.5rem;"></i>Quotation</th>
                                    <th><i class="fa fa-building" style="margin-right: 0.5rem;"></i>Customer</th>
                                    <th><i class="fa fa-user" style="margin-right: 0.5rem;"></i>Account Manager</th>
                                    <th><i class="fa fa-calendar" style="margin-right: 0.5rem;"></i>Date</th>
                                    <th><i class="fa fa-money-bill-wave" style="margin-right: 0.5rem;"></i>Amount</th>
                                    <th><i class="fa fa-flag" style="margin-right: 0.5rem;"></i>Status</th>
                                    <th><i class="fa fa-percentage" style="margin-right: 0.5rem;"></i>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotes.map(quote => `
                                    <tr onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')" style="cursor: pointer;">
                                        <td>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <strong>${quote.quotation}</strong>
                                                <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); window.open('/app/quotation/${quote.quotation}', '_blank')" title="Open quotation in new tab" style="padding: 0.2rem 0.4rem; font-size: 0.7rem; background: var(--accent-blue); border: 1px solid var(--accent-blue); color: white; border-radius: 3px;">
                                                    <i class="fa fa-external-link-alt" style="font-size: 0.65rem;"></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td>${quote.customer_name || quote.party_name || 'Unknown'}</td>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                ${this.getUserAvatar(quote.account_manager, 24)}
                                                <span>${quote.account_manager || 'Unassigned'}</span>
                                            </div>
                                        </td>
                                        <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
                                        <td>AED ${this.formatCurrency(quote.base_grand_total)}</td>
                                        <td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td>
                                        <td><span class="margin-badge ${this.getMarginClass(quote.profit_percentage)}">${quote.profit_percentage || 0}%</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderLostQuotationsSection() {
        const stats = this.data.stats.overview;
        const lostQuotes = this.data.quotations.filter(q => q.status === 'Lost');
        
        
        // Analyze lost reasons
        const reasonsMap = new Map();
        lostQuotes.forEach(quote => {
            const reason = quote.order_lost_reason || quote.lost_reasons || quote.lost_reason || 'Unspecified';
            if (!reasonsMap.has(reason)) {
                reasonsMap.set(reason, { count: 0, amount: 0, quotes: [] });
            }
            const reasonData = reasonsMap.get(reason);
            reasonData.count++;
            reasonData.amount += quote.base_grand_total || 0;
            reasonData.quotes.push(quote);
        });
        
        const reasons = Array.from(reasonsMap.entries()).map(([reason, data]) => ({
            reason,
            ...data
        })).sort((a, b) => b.amount - a.amount);
        
        // Analyze by branch for lost quotations
        const branchLossMap = new Map();
        lostQuotes.forEach(quote => {
            const branch = quote.custom_branch || 'Unknown';
            if (!branchLossMap.has(branch)) {
                branchLossMap.set(branch, { count: 0, amount: 0 });
            }
            const branchData = branchLossMap.get(branch);
            branchData.count++;
            branchData.amount += quote.base_grand_total || 0;
        });
        
        const branchLosses = Array.from(branchLossMap.entries()).map(([branch, data]) => ({
            branch,
            ...data
        })).sort((a, b) => b.amount - a.amount);
        
        // Analyze by account manager for lost quotations
        const managerLossMap = new Map();
        lostQuotes.forEach(quote => {
            const manager = quote.account_incharge_full_name || quote.account_incharge || 'Unknown';
            if (!managerLossMap.has(manager)) {
                managerLossMap.set(manager, { count: 0, amount: 0 });
            }
            const managerData = managerLossMap.get(manager);
            managerData.count++;
            managerData.amount += quote.base_grand_total || 0;
        });
        
        const managerLosses = Array.from(managerLossMap.entries()).map(([manager, data]) => ({
            manager,
            ...data
        })).sort((a, b) => b.amount - a.amount);
        
        
        return `
            <div class="lost-quotations-container">
                <!-- Lost Quotations Overview -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-times-circle" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                    Total Lost
                                </h3>
                                <p class="stat-card-value">${stats.lost.count.toLocaleString()}</p>
                                <p class="stat-card-amount">AED ${this.formatCurrency(stats.lost.amount)}</p>
                            </div>
                            <div class="stat-card-icon danger">
                                <i class="fa fa-times-circle"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-percentage" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Loss Rate
                                </h3>
                                <p class="stat-card-value">${stats.total.count > 0 ? 
                                    (stats.lost.count / stats.total.count * 100).toFixed(1) : 0}%</p>
                                <p class="stat-card-amount">Of Total Quotations</p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-percentage"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-coins" style="color: var(--accent-red); margin-right: 0.5rem;"></i>
                                    Average Lost Value
                                </h3>
                                <p class="stat-card-value">AED ${stats.lost.count > 0 ? 
                                    this.formatCurrency(stats.lost.amount / stats.lost.count) : '0'}</p>
                                <p class="stat-card-amount">Per Lost Quotation</p>
                            </div>
                            <div class="stat-card-icon danger">
                                <i class="fa fa-coins"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Standardized Loss Reasons Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-exclamation-triangle"></i>
                            Standardized Loss Reasons Analysis
                        </h2>
                    </div>
                    
                    ${this.renderStandardizedLossReasons()}
                </div>
                
                <!-- Branch-wise Loss Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-map-marker-alt"></i>
                            Branch-wise Loss Analysis
                        </h2>
                    </div>
                    
                    <div class="table-container">
                        ${this.renderTableWithControls('branch-loss-table', branchLosses, [
                            { key: 'custom_branch', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
                            { key: 'count', label: 'Lost Count', sortable: true, icon: 'fa-list' },
                            { key: 'amount', label: 'Lost Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' }
                        ])}
                    </div>
                </div>
                
                <!-- Account Manager Loss Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-user-tie"></i>
                            Account Manager Loss Analysis
                        </h2>
                    </div>
                    
                    <div class="table-container">
                        ${this.renderTableWithControls('manager-loss-table', managerLosses, [
                            { key: 'manager', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                            { key: 'count', label: 'Lost Count', sortable: true, icon: 'fa-list' },
                            { key: 'amount', label: 'Lost Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' }
                        ])}
                    </div>
                </div>
                
                <!-- Recent Lost Quotations -->
                <div class="data-section">
                    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 class="section-title">
                            <i class="fa fa-clock"></i>
                            Recent Lost Quotations
                        </h2>
                        <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showAllLostQuotes()">
                            <i class="fa fa-expand"></i>
                            View All ${lostQuotes.length}
                        </button>
                    </div>
                    
                    <div class="table-container">
                        ${this.renderTableWithControls('recent-lost-table', 
                            lostQuotes.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)).slice(0, 20), [
                            { key: 'quotation', label: 'Quotation #', sortable: true, icon: 'fa-file-alt' },
                            { key: 'party_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                            { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                            { key: 'base_grand_total', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                            { key: 'order_lost_reason', label: 'Reason', sortable: true, icon: 'fa-exclamation-triangle' },
                            { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' }
                        ])}
                    </div>
                </div>
            </div>
        `;
    }

    renderStandardizedLossReasons() {
        if (!this.data.lost_quotation_reasons || !this.data.lost_quotation_reasons.reasons) {
            return `<div class="no-data-message">
                <i class="fa fa-info-circle"></i>
                <p>No standardized loss reason data available</p>
            </div>`;
        }

        const { reasons, counts, values, total_lost } = this.data.lost_quotation_reasons;

        // Create array of reason data for table
        const reasonsTableData = reasons.map(reason => ({
            reason: reason.order_lost_reason,
            count: counts[reason.order_lost_reason] || 0,
            amount: values[reason.order_lost_reason] || 0,
            percentage: total_lost > 0 ? ((counts[reason.order_lost_reason] || 0) / total_lost * 100).toFixed(1) : 0
        })).filter(r => r.count > 0).sort((a, b) => b.count - a.count);

        // Create visual representation
        const maxCount = Math.max(...reasonsTableData.map(r => r.count));
        const reasonBars = reasonsTableData.slice(0, 10).map(reason => `
            <div class="reason-bar-item">
                <div class="reason-info">
                    <span class="reason-name">${reason.reason}</span>
                    <div class="reason-stats">
                        <span class="count">${reason.count}</span>
                        <span class="percentage">(${reason.percentage}%)</span>
                        <span class="amount">AED ${this.formatCurrency(reason.amount)}</span>
                    </div>
                </div>
                <div class="reason-bar">
                    <div class="reason-bar-fill" style="width: ${(reason.count / maxCount * 100)}%; background: linear-gradient(135deg, var(--accent-red), var(--accent-orange));"></div>
                </div>
            </div>
        `).join('');

        return `
            <!-- Summary Cards -->
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-list" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                Standard Reasons
                            </h3>
                            <p class="stat-card-value">${reasons.length}</p>
                            <p class="stat-card-amount">Total Categories</p>
                        </div>
                        <div class="stat-card-icon primary">
                            <i class="fa fa-list"></i>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-chart-bar" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                Active Reasons
                            </h3>
                            <p class="stat-card-value">${reasonsTableData.length}</p>
                            <p class="stat-card-amount">With Losses</p>
                        </div>
                        <div class="stat-card-icon success">
                            <i class="fa fa-chart-bar"></i>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-trophy" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                Top Reason
                            </h3>
                            <p class="stat-card-value">${reasonsTableData.length > 0 ? reasonsTableData[0].percentage + '%' : '0%'}</p>
                            <p class="stat-card-amount">${reasonsTableData.length > 0 ? reasonsTableData[0].reason : 'None'}</p>
                        </div>
                        <div class="stat-card-icon warning">
                            <i class="fa fa-trophy"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Visual Representation -->
            <div class="reason-analysis-container" style="margin-bottom: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600;">
                    <i class="fa fa-chart-bar" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                    Top Loss Reasons (Visual)
                </h3>
                <div class="reason-bars">
                    ${reasonBars}
                </div>
            </div>

            <!-- Detailed Table -->
            <div class="table-container">
                ${this.renderTableWithControls('standardized-loss-reasons-table', reasonsTableData, [
                    { key: 'reason', label: 'Standardized Reason', sortable: true, icon: 'fa-exclamation-triangle' },
                    { key: 'count', label: 'Count', sortable: true, icon: 'fa-list' },
                    { key: 'percentage', label: 'Percentage', sortable: true, icon: 'fa-percentage', formatter: (value) => value + '%' },
                    { key: 'amount', label: 'Lost Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' }
                ])}
            </div>

            <style>
                .reason-analysis-container {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 1.5rem;
                }

                .reason-bars {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .reason-bar-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .reason-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.875rem;
                }

                .reason-name {
                    font-weight: 600;
                    color: var(--text-primary);
                    flex: 1;
                }

                .reason-stats {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                    font-size: 0.8rem;
                }

                .reason-stats .count {
                    font-weight: 600;
                    color: var(--accent-red);
                }

                .reason-stats .percentage {
                    color: var(--text-muted);
                }

                .reason-stats .amount {
                    color: var(--accent-blue);
                    font-weight: 500;
                }

                .reason-bar {
                    height: 8px;
                    background: rgba(148, 163, 184, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .reason-bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }

                .no-data-message {
                    text-align: center;
                    padding: 2rem;
                    color: var(--text-muted);
                }

                .no-data-message i {
                    font-size: 2rem;
                    margin-bottom: 1rem;
                    color: var(--accent-blue);
                }
            </style>
        `;
    }

    async renderCancelledQuotationsSection() {
        // Use cached cancelled quotations data if available, otherwise load fresh
        let cancelledData;
        if (this.cancelledQuotationsData) {
            cancelledData = this.cancelledQuotationsData;
            console.log('Using cached cancelled quotations data');
        } else {
            cancelledData = await this.loadCancelledQuotations();
            this.cancelledQuotationsData = cancelledData;
            console.log('Loading fresh cancelled quotations data');
        }
        const cancelledQuotes = cancelledData.data || [];
        const stats = this.data.stats.overview;
        
        // Analyze by branch for cancelled but not amended quotations
        const branchCancelledMap = new Map();
        cancelledQuotes.forEach(quote => {
            const branch = quote.custom_branch || 'Unknown';
            if (!branchCancelledMap.has(branch)) {
                branchCancelledMap.set(branch, { count: 0, amount: 0 });
            }
            const branchData = branchCancelledMap.get(branch);
            branchData.count++;
            branchData.amount += quote.base_grand_total || 0;
        });
        
        const branchCancelled = Array.from(branchCancelledMap.entries()).map(([branch, data]) => ({
            branch,
            ...data
        })).sort((a, b) => b.amount - a.amount);
        
        // Analyze by account manager for cancelled but not amended quotations
        const managerCancelledMap = new Map();
        cancelledQuotes.forEach(quote => {
            const manager = quote.account_incharge_full_name || quote.account_incharge || 'Unknown';
            if (!managerCancelledMap.has(manager)) {
                managerCancelledMap.set(manager, { count: 0, amount: 0 });
            }
            const managerData = managerCancelledMap.get(manager);
            managerData.count++;
            managerData.amount += quote.base_grand_total || 0;
        });
        
        const managerCancelled = Array.from(managerCancelledMap.entries()).map(([manager, data]) => ({
            manager,
            ...data
        })).sort((a, b) => b.amount - a.amount);
        
        return `
            <div class="cancelled-quotations-container">
                <!-- Cancelled But Not Amended Section -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-ban" style="color: var(--accent-orange);"></i>
                            Cancelled But Not Amended Quotations
                        </h2>
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-info-circle"></i>
                            <span>Quotations with custom_cancel_status = "Cancelled But Not Amended"</span>
                        </div>
                    </div>
                    
                    <!-- Cancelled But Not Amended Overview -->
                    <div class="stats-grid mb-4">
                        <div class="stat-card">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa fa-ban" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                        Total Cancelled
                                    </h3>
                                    <p class="stat-card-value">${cancelledQuotes.length.toLocaleString()}</p>
                                    <p class="stat-card-amount">AED ${this.formatCurrency(cancelledQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0))}</p>
                                </div>
                                <div class="stat-card-icon warning">
                                    <i class="fa fa-ban"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa fa-percentage" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                        Cancellation Rate
                                    </h3>
                                    <p class="stat-card-value">${stats.total.count > 0 ? 
                                        (stats.cancelledNotAmended.count / stats.total.count * 100).toFixed(1) : 0}%</p>
                                    <p class="stat-card-amount">Of Total Quotations</p>
                                </div>
                                <div class="stat-card-icon info">
                                    <i class="fa fa-percentage"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa fa-coins" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                        Average Cancelled Value
                                    </h3>
                                    <p class="stat-card-value">AED ${cancelledQuotes.length > 0 ? 
                                        this.formatCurrency(cancelledQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0) / cancelledQuotes.length) : '0'}</p>
                                    <p class="stat-card-amount">Per Cancelled Quotation</p>
                                </div>
                                <div class="stat-card-icon warning">
                                    <i class="fa fa-coins"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Branch-wise Cancelled Analysis -->
                    <div class="data-section">
                        <div class="section-header">
                            <h2 class="section-title">
                                <i class="fa fa-map-marker-alt"></i>
                                Branch-wise Cancelled Analysis
                            </h2>
                        </div>
                        
                        <div class="table-container">
                            ${this.renderTableWithControls('branch-cancelled-table', branchCancelled, [
                                { key: 'custom_branch', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
                                { key: 'count', label: 'Cancelled Count', sortable: true, icon: 'fa-list' },
                                { key: 'amount', label: 'Cancelled Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' }
                            ])}
                        </div>
                    </div>
                    
                    <!-- Account Manager Cancelled Analysis -->
                    <div class="data-section">
                        <div class="section-header">
                            <h2 class="section-title">
                                <i class="fa fa-user-tie"></i>
                                Account Manager Cancelled Analysis
                            </h2>
                        </div>
                        
                        <div class="table-container">
                            ${this.renderTableWithControls('manager-cancelled-table', managerCancelled, [
                                { key: 'manager', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' },
                                { key: 'count', label: 'Cancelled Count', sortable: true, icon: 'fa-list' },
                                { key: 'amount', label: 'Cancelled Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' }
                            ])}
                        </div>
                    </div>
                    
                    <!-- Recent Cancelled But Not Amended Quotations -->
                    <div class="data-section">
                        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <h2 class="section-title">
                                <i class="fa fa-clock"></i>
                                Recent Cancelled But Not Amended Quotations
                            </h2>
                            <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showAllCancelledQuotes()">
                                <i class="fa fa-expand"></i>
                                View All ${cancelledQuotes.length}
                            </button>
                        </div>
                        
                        <div class="table-container">
                            ${this.renderTableWithControls('recent-cancelled-table', 
                                cancelledQuotes.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)).slice(0, 20), [
                                { key: 'quotation', label: 'Quotation #', sortable: true, icon: 'fa-file-alt' },
                                { key: 'party_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                                { key: 'transaction_date', label: 'Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                                { key: 'base_grand_total', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                                { key: 'custom_cancel_status', label: 'Cancel Status', sortable: true, icon: 'fa-ban' },
                                { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true, icon: 'fa-user-tie' }
                            ])}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderOpportunitiesSection() {
        return `
            <div class="opportunities-container">
                <!-- Tab Navigation -->
                <div class="tab-navigation" style="margin-bottom: 2rem; width: 100%;">
                    <div class="tab-buttons" style="display: flex; width: 100%; border-bottom: 3px solid var(--border-color); background: rgba(51, 65, 85, 0.15); border-radius: 12px 12px 0 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <button class="tab-button active" data-tab="opportunities" onclick="frappe.sales_intelligence.switchOpportunityTab('opportunities')" style="flex: 1; min-width: 200px; padding: 1.25rem 1.5rem; background: var(--accent-blue); color: white; border: none; border-radius: 12px 0 0 0; font-weight: 600; font-size: 1rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <i class="fa fa-lightbulb" style="font-size: 1.1rem;"></i>
                            <span>Opportunities</span>
                        </button>
                        <button class="tab-button" data-tab="design-request" onclick="frappe.sales_intelligence.switchOpportunityTab('design-request')" style="flex: 1; min-width: 200px; padding: 1.25rem 1.5rem; background: rgba(51, 65, 85, 0.3); color: var(--text-primary); border: none; font-weight: 500; font-size: 1rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                            <i class="fa fa-drafting-compass" style="font-size: 1.1rem;"></i>
                            <span>Design Request</span>
                        </button>
                        <button class="tab-button" data-tab="site-visit" onclick="frappe.sales_intelligence.switchOpportunityTab('site-visit')" style="flex: 1; min-width: 200px; padding: 1.25rem 1.5rem; background: rgba(51, 65, 85, 0.3); color: var(--text-primary); border: none; font-weight: 500; font-size: 1rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                            <i class="fa fa-map-marker-alt" style="font-size: 1.1rem;"></i>
                            <span>Site Visit</span>
                        </button>
                        <button class="tab-button" data-tab="permit" onclick="frappe.sales_intelligence.switchOpportunityTab('permit')" style="flex: 1; min-width: 200px; padding: 1.25rem 1.5rem; background: rgba(51, 65, 85, 0.3); color: var(--text-primary); border: none; border-radius: 0 12px 0 0; font-weight: 500; font-size: 1rem; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                            <i class="fa fa-file-signature" style="font-size: 1.1rem;"></i>
                            <span>Permit</span>
                        </button>
                    </div>
                </div>

                <!-- Tab Contents -->
                <div class="tab-content">
                    <!-- Opportunities Tab -->
                    <div class="tab-panel active" id="opportunities-tab">
                        ${this.renderOpportunitiesTab()}
                    </div>

                    <!-- Design Request Tab -->
                    <div class="tab-panel" id="design-request-tab" style="display: none;">
                        ${this.renderDesignRequestTab()}
                    </div>

                    <!-- Site Visit Tab -->
                    <div class="tab-panel" id="site-visit-tab" style="display: none;">
                        ${this.renderSiteVisitTab()}
                    </div>

                    <!-- Permit Tab -->
                    <div class="tab-panel" id="permit-tab" style="display: none;">
                        ${this.renderPermitTab()}
                    </div>
                </div>
            </div>
        `;
    }

    renderOpportunitiesTab() {
        const opportunityStats = this.data.opportunity_stats || { 
            total: 0, by_status: {}, quoted: 0, not_quoted: 0, 
            quoted_opportunities: [], not_quoted_opportunities: [] 
        };

        // Show debug information if no opportunities
        if (opportunityStats.total === 0) {
            console.log('No opportunities found. Debug info:', {
                opportunities: this.data.opportunities?.length || 0,
                opportunityStats: opportunityStats,
                filters: this.filters
            });
        }

        return `
            <div class="opportunities-tab-content">
                <!-- Opportunity Overview Cards -->
                <div class="stats-grid">
                    <!-- Total Opportunities -->
                    <div class="stat-card" onclick="frappe.sales_intelligence.showOpportunityDrilldown('total')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-lightbulb" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Total Opportunities
                                </h3>
                                <p class="stat-card-value">${opportunityStats.total.toLocaleString()}</p>
                                <p class="stat-card-amount">In Current Period</p>
                            </div>
                            <div class="stat-card-icon">
                                <i class="fa fa-lightbulb"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>

                    <!-- Quoted Opportunities -->
                    <div class="stat-card" onclick="frappe.sales_intelligence.showOpportunityDrilldown('quoted')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-file-alt" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    Quoted Opportunities
                                </h3>
                                <p class="stat-card-value">${opportunityStats.quoted.toLocaleString()}</p>
                                <p class="stat-card-amount">Have Quotations</p>
                            </div>
                            <div class="stat-card-icon success">
                                <i class="fa fa-file-alt"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>

                    <!-- Not Quoted Opportunities -->
                    <div class="stat-card" onclick="frappe.sales_intelligence.showOpportunityDrilldown('not_quoted')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-exclamation-triangle" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                    Not Quoted
                                </h3>
                                <p class="stat-card-value">${opportunityStats.not_quoted.toLocaleString()}</p>
                                <p class="stat-card-amount">Need Quotations</p>
                            </div>
                            <div class="stat-card-icon warning">
                                <i class="fa fa-exclamation-triangle"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>

                    <!-- Status-based Opportunity Cards -->
                    ${Object.entries(opportunityStats.by_status).map(([status, data]) => {
                        const statusColors = {
                            'Quotation': 'var(--accent-blue)',
                            'Overdue': 'var(--accent-red)',
                            'Converted': 'var(--accent-green)',
                            'Lost': 'var(--accent-orange)',
                            'Open': 'var(--accent-purple)'
                        };
                        
                        const statusIcons = {
                            'Quotation': 'fa-file-alt',
                            'Overdue': 'fa-clock',
                            'Converted': 'fa-check-circle',
                            'Lost': 'fa-times-circle',
                            'Open': 'fa-folder-open'
                        };
                        
                        return `
                        <div class="stat-card" onclick="frappe.sales_intelligence.showOpportunityDrilldown('${status}')">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa ${statusIcons[status] || 'fa-circle'}" style="color: ${statusColors[status] || 'var(--accent-blue)'}; margin-right: 0.5rem;"></i>
                                        ${status}
                                    </h3>
                                    <p class="stat-card-value">${data.count.toLocaleString()}</p>
                                    <p class="stat-card-amount">Opportunities</p>
                                </div>
                                <div class="stat-card-icon" style="background: ${statusColors[status] || 'var(--accent-blue)'};">
                                    <i class="fa ${statusIcons[status] || 'fa-circle'}"></i>
                                </div>
                            </div>
                            <span class="click-indicator">
                                <i class="fa fa-mouse-pointer"></i>
                                Click to view details
                            </span>
                        </div>`;
                    }).join('')}

                    <!-- Quotation Conversion Rate -->
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-percentage" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                    Quotation Rate
                                </h3>
                                <p class="stat-card-value">${opportunityStats.total > 0 ? 
                                    (opportunityStats.quoted / opportunityStats.total * 100).toFixed(1) : 0}%</p>
                                <p class="stat-card-amount">Opportunities Quoted</p>
                            </div>
                            <div class="stat-card-icon info">
                                <i class="fa fa-percentage"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Detailed Analysis -->
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-chart-bar"></i>
                        Detailed Analysis
                    </h2>
                </div>

                ${opportunityStats.quoted_opportunities && opportunityStats.quoted_opportunities.length > 0 ? `
                <!-- Quoted Opportunities Table -->
                <div class="modal-section">
                    <h6><i class="fa fa-check-circle"></i>Quoted Opportunities (with Quotation Links)</h6>
                    ${this.renderTableWithControls('quoted-opportunities', opportunityStats.quoted_opportunities, [
                        { key: 'name', label: 'Opportunity', sortable: true, type: 'opportunity_link', icon: 'fa-lightbulb' },
                        { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'opportunity_amount', label: 'Opp Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' },
                        { key: 'quotations', label: 'Quotations', sortable: false, type: 'quotation_links', icon: 'fa-file-alt' }
                    ])}
                </div>
                ` : ''}

                ${opportunityStats.not_quoted_opportunities && opportunityStats.not_quoted_opportunities.length > 0 ? `
                <!-- Not Quoted Opportunities Table -->
                <div class="modal-section">
                    <h6><i class="fa fa-exclamation-triangle"></i>Opportunities Needing Quotations</h6>
                    ${this.renderTableWithControls('not-quoted-opportunities', opportunityStats.not_quoted_opportunities, [
                        { key: 'name', label: 'Opportunity', sortable: true, type: 'opportunity_link', icon: 'fa-lightbulb' },
                        { key: 'customer_name', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'opportunity_amount', label: 'Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' },
                        { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' },
                        { key: 'expected_closing', label: 'Expected Closing', sortable: true, type: 'date', icon: 'fa-calendar' }
                    ])}
                </div>
                ` : ''}
            </div>
        `;
    }

    renderDesignRequestTab() {
        return `
            <div class="design-request-tab-content">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-drafting-compass"></i>
                        Design Request Analysis
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-paint-brush"></i>
                        <span>Design request tracking and completion status</span>
                    </div>
                </div>
                ${this.renderDesignRequestSection()}
            </div>
        `;
    }

    renderSiteVisitTab() {
        return `
            <div class="site-visit-tab-content">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-map-marker-alt"></i>
                        Site Visit Analysis
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-eye"></i>
                        <span>Site visit tracking and status overview</span>
                    </div>
                </div>
                ${this.renderSiteVisitSection()}
            </div>
        `;
    }

    renderPermitTab() {
        return `
            <div class="permit-tab-content">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fa fa-file-signature"></i>
                        Permit Analysis
                    </h2>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        <i class="fa fa-stamp"></i>
                        <span>Permit application tracking and approval status</span>
                    </div>
                </div>
                ${this.renderPermitSection()}
            </div>
        `;
    }

    switchOpportunityTab(tabName) {
        // Remove active class from all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.remove('active');
            button.style.background = 'rgba(51, 65, 85, 0.3)';
            button.style.color = 'var(--text-primary)';
            button.style.fontWeight = '500';
            button.style.boxShadow = 'none';
            button.style.transform = 'none';
        });

        // Hide all tab panels
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabPanels.forEach(panel => {
            panel.style.display = 'none';
            panel.classList.remove('active');
        });

        // Show the selected tab
        const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedPanel = document.getElementById(`${tabName}-tab`);

        if (selectedButton && selectedPanel) {
            selectedButton.classList.add('active');
            selectedButton.style.background = 'var(--accent-blue)';
            selectedButton.style.color = 'white';
            selectedButton.style.fontWeight = '600';
            selectedButton.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0,0,0,0.1)';
            selectedButton.style.transform = 'translateY(-2px)';

            selectedPanel.style.display = 'block';
            selectedPanel.classList.add('active');
        }
    }

    renderSiteVisitSection() {
        const siteVisits = this.data.site_visits || [];
        
        // Group by status
        const statusGroups = {};
        siteVisits.forEach(visit => {
            const status = visit.status || 'Draft';
            if (!statusGroups[status]) {
                statusGroups[status] = [];
            }
            statusGroups[status].push(visit);
        });
        
        console.log('Site Visit Status Groups:', statusGroups);
        console.log('Total Site Visits:', siteVisits.length);
        console.log('Sample Site Visit:', siteVisits[0]);

        const statusColors = {
            'Visited': 'var(--accent-green)',
            'Pending': 'var(--accent-orange)',
            'Cancelled': 'var(--accent-red)',
            'Scheduled Visit': 'var(--accent-purple)',
            'Draft': 'var(--accent-blue)',
            'Scheduled': 'var(--accent-purple)',
            'Completed': 'var(--accent-green)'
        };

        const statusIcons = {
            'Visited': 'fa-check-circle',
            'Pending': 'fa-clock',
            'Cancelled': 'fa-times-circle',
            'Scheduled Visit': 'fa-calendar-check',
            'Draft': 'fa-edit',
            'Scheduled': 'fa-calendar-check',
            'Completed': 'fa-check-circle'
        };
        
        return `
            <div class="data-section">
                <!-- Status Overview Cards -->
                <div class="stats-grid">
                    <!-- Total Site Visits -->
                    <div class="stat-card" onclick="frappe.sales_intelligence.showSiteVisitDetails('total')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-map-marker-alt" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>
                                    Total Site Visits
                                </h3>
                                <p class="stat-card-value">${siteVisits.length}</p>
                                <p class="stat-card-amount">All Site Visits</p>
                            </div>
                            <div class="stat-card-icon" style="background: var(--accent-blue);">
                                <i class="fa fa-map-marker-alt"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>

                    <!-- Status-based Cards -->
                    ${Object.entries(statusGroups).map(([status, visits]) => `
                        <div class="stat-card" onclick="frappe.sales_intelligence.showSiteVisitDetails('${status}')">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa ${statusIcons[status] || 'fa-circle'}" style="color: ${statusColors[status] || 'var(--accent-gray)'}; margin-right: 0.5rem;"></i>
                                        ${status}
                                    </h3>
                                    <p class="stat-card-value">${visits.length}</p>
                                    <p class="stat-card-amount">Site Visits</p>
                                </div>
                                <div class="stat-card-icon" style="background: ${statusColors[status] || 'var(--accent-gray)'};">
                                    <i class="fa ${statusIcons[status] || 'fa-circle'}"></i>
                                </div>
                            </div>
                            <span class="click-indicator">
                                <i class="fa fa-mouse-pointer"></i>
                                Click to view details
                            </span>
                        </div>
                    `).join('')}
                </div>

                <!-- All Site Visits Table -->
                <div class="modal-section" style="margin-top: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h6 style="margin: 0;"><i class="fa fa-list"></i>All Site Visits</h6>
                        <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showAllSiteVisits()">
                            <i class="fa fa-expand"></i>
                            View All ${siteVisits.length}
                        </button>
                    </div>
                    ${this.renderTableWithControls('all-site-visits', siteVisits, [
                        { key: 'name', label: 'Visit ID', sortable: true, type: 'site_visit_link', icon: 'fa-id-card' },
                        { key: 'customer', label: 'Customer', sortable: true, icon: 'fa-building' },
                        { key: 'status', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' },
                        { key: 'creation', label: 'Created Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                        { key: 'modified', label: 'Last Modified', sortable: true, type: 'date', icon: 'fa-clock' }
                    ])}
                </div>
            </div>
        `;
    }

    renderDesignRequestSection() {
        const designRequests = this.data.design_requests || [];
        
        // Group by status (if available)
        const statusGroups = {};
        let hasStatusField = false;
        
        designRequests.forEach(request => {
            const status = request.workflow_state || 'Draft';
            if (request.workflow_state) hasStatusField = true;
            if (!statusGroups[status]) {
                statusGroups[status] = [];
            }
            statusGroups[status].push(request);
        });
        
        console.log('Design Request Status Groups:', statusGroups);
        console.log('Total Design Requests:', designRequests.length);
        console.log('Sample Design Request:', designRequests[0]);

        const statusColors = {
            'Cancelled': 'var(--accent-red)',
            'Hold': 'var(--accent-gray)', 
            'Open': 'var(--accent-purple)',
            'Rejected': 'var(--accent-red)',
            'Under Rework': 'var(--accent-orange)',
            'Working': 'var(--accent-green)',
            'Draft': 'var(--accent-blue)',
            'Completed': 'var(--accent-green)',
            'In Progress': 'var(--accent-orange)',
            'On Hold': 'var(--accent-gray)'
        };

        const statusIcons = {
            'Cancelled': 'fa-times-circle',
            'Hold': 'fa-pause-circle',
            'Open': 'fa-folder-open',
            'Rejected': 'fa-ban',
            'Under Rework': 'fa-wrench',
            'Working': 'fa-cogs',
            'Draft': 'fa-edit',
            'Completed': 'fa-check-circle',
            'In Progress': 'fa-cogs',
            'On Hold': 'fa-pause-circle'
        };
        
        return `
            <div class="data-section">
                <!-- Status Overview Cards -->
                <div class="stats-grid">
                    <!-- Total Design Requests -->
                    <div class="stat-card" onclick="frappe.sales_intelligence.showDesignRequestDetails('total')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-drafting-compass" style="color: var(--accent-purple); margin-right: 0.5rem;"></i>
                                    Total Design Requests
                                </h3>
                                <p class="stat-card-value">${designRequests.length}</p>
                                <p class="stat-card-amount">All Design Requests</p>
                            </div>
                            <div class="stat-card-icon" style="background: var(--accent-purple);">
                                <i class="fa fa-paint-brush"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>

                    ${hasStatusField ? Object.entries(statusGroups).map(([status, requests]) => `
                        <div class="stat-card" onclick="frappe.sales_intelligence.showDesignRequestDetails('${status}')">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa ${statusIcons[status] || 'fa-circle'}" style="color: ${statusColors[status] || 'var(--accent-gray)'}; margin-right: 0.5rem;"></i>
                                        ${status}
                                    </h3>
                                    <p class="stat-card-value">${requests.length}</p>
                                    <p class="stat-card-amount">Design Requests</p>
                                </div>
                                <div class="stat-card-icon" style="background: ${statusColors[status] || 'var(--accent-gray)'}">
                                    <i class="fa ${statusIcons[status] || 'fa-circle'}"></i>
                                </div>
                            </div>
                            <span class="click-indicator">
                                <i class="fa fa-mouse-pointer"></i>
                                Click to view details
                            </span>
                        </div>
                    `).join('') : ''}
                </div>

                <!-- Recent Design Requests Table -->
                <div class="modal-section" style="margin-top: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h6 style="margin: 0;"><i class="fa fa-list"></i>All Design Requests</h6>
                        <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showAllDesignRequests()">
                            <i class="fa fa-expand"></i>
                            View All ${designRequests.length}
                        </button>
                    </div>
                    ${this.renderTableWithControls('all-design-requests', designRequests, [
                        { key: 'name', label: 'Request ID', sortable: true, type: 'design_request_link', icon: 'fa-id-card' },
                        { key: 'customer', label: 'Customer', sortable: true, icon: 'fa-building' },
                        ...(hasStatusField ? [{ key: 'workflow_state', label: 'Workflow State', sortable: true, type: 'badge', icon: 'fa-cog' }] : []),
                        { key: 'creation', label: 'Created Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                        { key: 'modified', label: 'Last Modified', sortable: true, type: 'date', icon: 'fa-clock' }
                    ])}
                </div>
            </div>
        `;
    }

    renderPermitSection() {
        const permits = this.data.permits || [];
        
        // Group by workflow_state
        const workflowGroups = {};
        let hasWorkflowState = false;
        
        permits.forEach(permit => {
            const workflowState = permit.workflow_state || 'Draft';
            if (permit.workflow_state) hasWorkflowState = true;
            if (!workflowGroups[workflowState]) {
                workflowGroups[workflowState] = [];
            }
            workflowGroups[workflowState].push(permit);
        });
        
        console.log('Permit Workflow Groups:', workflowGroups);
        console.log('Total Permits:', permits.length);
        console.log('Sample Permit:', permits[0]);

        const workflowColors = {
            'Approved': 'var(--accent-green)',
            'Cancelled': 'var(--accent-red)',
            'Pending CD Approval': 'var(--accent-orange)',
            'Draft': 'var(--accent-blue)',
            'Submitted': 'var(--accent-purple)',
            'Under Review': 'var(--accent-orange)',
            'Rejected': 'var(--accent-red)',
            'On Hold': 'var(--accent-gray)'
        };

        const workflowIcons = {
            'Approved': 'fa-check-circle',
            'Cancelled': 'fa-ban',
            'Pending CD Approval': 'fa-hourglass-half',
            'Draft': 'fa-edit',
            'Submitted': 'fa-paper-plane',
            'Under Review': 'fa-search',
            'Rejected': 'fa-times-circle',
            'On Hold': 'fa-pause-circle'
        };
        
        return `
            <div class="data-section">
                <!-- Status Overview Cards -->
                <div class="stats-grid">
                    <!-- Total Permits -->
                    <div class="stat-card" onclick="frappe.sales_intelligence.showPermitDetails('total')">
                        <div class="stat-card-header">
                            <div class="stat-card-content">
                                <h3 class="stat-card-title">
                                    <i class="fa fa-file-signature" style="color: var(--accent-green); margin-right: 0.5rem;"></i>
                                    Total Permits
                                </h3>
                                <p class="stat-card-value">${permits.length}</p>
                                <p class="stat-card-amount">All Permits</p>
                            </div>
                            <div class="stat-card-icon" style="background: var(--accent-green);">
                                <i class="fa fa-stamp"></i>
                            </div>
                        </div>
                        <span class="click-indicator">
                            <i class="fa fa-mouse-pointer"></i>
                            Click to view details
                        </span>
                    </div>

                    ${hasWorkflowState ? Object.entries(workflowGroups).map(([workflowState, permits]) => `
                        <div class="stat-card" onclick="frappe.sales_intelligence.showPermitDetails('${workflowState}')">
                            <div class="stat-card-header">
                                <div class="stat-card-content">
                                    <h3 class="stat-card-title">
                                        <i class="fa ${workflowIcons[workflowState] || 'fa-circle'}" style="color: ${workflowColors[workflowState] || 'var(--accent-gray)'}; margin-right: 0.5rem;"></i>
                                        ${workflowState}
                                    </h3>
                                    <p class="stat-card-value">${permits.length}</p>
                                    <p class="stat-card-amount">Permits</p>
                                </div>
                                <div class="stat-card-icon" style="background: ${workflowColors[workflowState] || 'var(--accent-gray)'}">
                                    <i class="fa ${workflowIcons[workflowState] || 'fa-circle'}"></i>
                                </div>
                            </div>
                            <span class="click-indicator">
                                <i class="fa fa-mouse-pointer"></i>
                                Click to view details
                            </span>
                        </div>
                    `).join('') : ''}
                </div>

                <!-- All Permits Table -->
                <div class="modal-section" style="margin-top: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h6 style="margin: 0;"><i class="fa fa-list"></i>All Permits</h6>
                        <button class="btn btn-sm btn-secondary" onclick="frappe.sales_intelligence.showAllPermits()">
                            <i class="fa fa-expand"></i>
                            View All ${permits.length}
                        </button>
                    </div>
                    ${this.renderTableWithControls('all-permits', permits, [
                        { key: 'name', label: 'Permit ID', sortable: true, type: 'permit_link', icon: 'fa-id-card' },
                        { key: 'customer', label: 'Customer', sortable: true, icon: 'fa-building' },
                        ...(hasWorkflowState ? [{ key: 'workflow_state', label: 'Status', sortable: true, type: 'badge', icon: 'fa-flag' }] : []),
                        { key: 'creation', label: 'Created Date', sortable: true, type: 'date', icon: 'fa-calendar' },
                        { key: 'modified', label: 'Last Modified', sortable: true, type: 'date', icon: 'fa-clock' }
                    ])}
                </div>
            </div>
        `;
    }

    groupByStatus(data, statusField) {
        return data.reduce((groups, item) => {
            const status = item[statusField] || 'Undefined';
            if (!groups[status]) {
                groups[status] = [];
            }
            groups[status].push(item);
            return groups;
        }, {});
    }

    getStatusColor(status) {
        const colors = {
            'Draft': '#6b7280',
            'Open': '#3b82f6', 
            'Scheduled': '#8b5cf6',
            'In Progress': '#f59e0b',
            'Completed': '#10b981',
            'Cancelled': '#ef4444',
            'Pending': '#f59e0b',
            'Approved': '#10b981',
            'Rejected': '#ef4444',
            'On Hold': '#f59e0b',
            'Submitted': '#3b82f6',
            'Undefined': '#6b7280'
        };
        return colors[status] || '#6b7280';
    }

    showTopQuoteCustomer() {
        const customers = this.data.stats.customers.segments.topQuoteCustomers;
        if (!customers || customers.length === 0) {
            frappe.msgprint('No customer data available');
            return;
        }
        
        const topCustomer = customers[0];
        const totalQuotes = customers.reduce((sum, c) => sum + c.total_quotes, 0);
        const totalValue = customers.reduce((sum, c) => sum + c.total_value, 0);
        const avgConversion = customers.reduce((sum, c) => sum + parseFloat(c.conversion_rate || 0), 0) / customers.length;
        
        const content = `
            <div class="customer-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-chart-bar"></i>Top 5 Customers by Quotation Count</h6>
                    
                    <!-- Summary Cards -->
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${totalQuotes}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Combined Quotations</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">AED ${this.formatCurrency(totalValue)}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Combined Value</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(245, 158, 11, 0.1); border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${avgConversion.toFixed(1)}%</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Avg Conversion</p>
                            </div>
                        </div>
                    </div>

                    <!-- Top Customer Highlight -->
                    <div class="customer-info mb-4" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05)); padding: 2rem; border-radius: 12px; border: 2px solid rgba(139, 92, 246, 0.3);">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-purple, #8b5cf6), #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
                                <i class="fa fa-crown"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0; font-size: 1.5rem;">🏆 #1 Top Customer</h4>
                                <h5 style="color: var(--accent-purple, #8b5cf6); margin: 0; font-size: 1.25rem;">${topCustomer.name}</h5>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-3">
                                <div style="text-align: center; padding: 1rem; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                    <h4 style="color: var(--text-primary); margin: 0; font-size: 1.8rem;">${topCustomer.total_quotes}</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.875rem;">Quotations</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div style="text-align: center; padding: 1rem; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                    <h4 style="color: var(--text-primary); margin: 0; font-size: 1.8rem;">AED ${this.formatCurrency(topCustomer.total_value)}</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.875rem;">Total Value</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div style="text-align: center; padding: 1rem; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                    <h4 style="color: var(--text-primary); margin: 0; font-size: 1.8rem;">${parseFloat(topCustomer.conversion_rate || 0).toFixed(1)}%</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.875rem;">Conversion</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div style="text-align: center; padding: 1rem; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                    <h4 style="color: var(--text-primary); margin: 0; font-size: 1.8rem;">${topCustomer.won_quotes || 0}</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.875rem;">Won Quotes</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Detailed Table -->
                    <div class="table-responsive">
                        <table class="table table-hover" style="background: rgba(51, 65, 85, 0.3); border-radius: 12px;">
                            <thead style="background: rgba(139, 92, 246, 0.1);">
                                <tr>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-trophy"></i> Rank</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-building"></i> Customer</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-list"></i> Quotations</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-money-bill-wave"></i> Total Value</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-trophy"></i> Won</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-percentage"></i> Conversion</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-chart-line"></i> Avg Margin</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-calculator"></i> Avg Quote Value</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-clock"></i> Last Quote</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${customers.map((customer, index) => `
                                    <tr style="border-bottom: 1px solid rgba(75, 85, 99, 0.3);">
                                        <td style="padding: 1rem; border: none;">
                                            <div style="display: flex; align-items: center; justify-content: center;">
                                                <span style="
                                                    width: 30px; 
                                                    height: 30px; 
                                                    border-radius: 50%; 
                                                    display: flex; 
                                                    align-items: center; 
                                                    justify-content: center; 
                                                    font-weight: 700;
                                                    ${index === 0 ? 'background: linear-gradient(135deg, #ffd700, #ffb300); color: white;' : 
                                                      index === 1 ? 'background: linear-gradient(135deg, #c0c0c0, #a0a0a0); color: white;' : 
                                                      index === 2 ? 'background: linear-gradient(135deg, #cd7f32, #b8860b); color: white;' : 
                                                      'background: rgba(107, 114, 128, 0.3); color: var(--text-secondary);'}
                                                ">
                                                    ${index + 1}
                                                </span>
                                            </div>
                                        </td>
                                        <td style="padding: 1rem; color: var(--text-primary); border: none;">
                                            <strong style="font-size: ${index === 0 ? '1.1rem' : '1rem'};">${customer.name}</strong>
                                        </td>
                                        <td style="padding: 1rem; text-align: center; border: none;">
                                            <span style="font-weight: ${index === 0 ? '700' : '600'}; color: var(--accent-purple, #8b5cf6); font-size: ${index === 0 ? '1.2rem' : '1rem'};">
                                                ${customer.total_quotes}
                                            </span>
                                        </td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">AED ${this.formatCurrency(customer.total_value)}</td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">${customer.won_quotes || 0}</td>
                                        <td style="padding: 1rem; text-align: center; border: none;">
                                            <span style="color: ${parseFloat(customer.conversion_rate || 0) > 50 ? 'var(--accent-green)' : parseFloat(customer.conversion_rate || 0) > 30 ? 'var(--accent-orange)' : 'var(--accent-red)'}; font-weight: 600;">
                                                ${parseFloat(customer.conversion_rate || 0).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">${parseFloat(customer.avg_margin || 0).toFixed(1)}%</td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">AED ${this.formatCurrency(customer.avg_quote_value || 0)}</td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none; font-size: 0.875rem;">
                                            ${customer.days_since_last_quote || 'N/A'} days ago
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="alert alert-info mt-3" style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-lightbulb" style="color: var(--accent-purple, #8b5cf6); font-size: 1.25rem;"></i>
                            <div>
                                <strong>Strategic Insights:</strong> These top customers represent your highest quotation volume. Focus on maintaining relationships, 
                                understanding their procurement patterns, and exploring opportunities for long-term contracts or volume discounts.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#drilldown-title').html(`<i class="fa fa-chart-bar"></i> Top 5 Customers by Quotation Count`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    showContinuousQuoteCustomers() {
        const customers = this.data.stats.customers.segments.continuousQuoteCustomers;
        if (!customers || customers.length === 0) {
            frappe.msgprint('No customers with 5+ continuous non-converting quotations found');
            return;
        }
        
        const content = `
            <div class="continuous-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-refresh"></i>Customers with 5+ Continuous Non-Converting Quotations</h6>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Customers who have taken multiple quotes without conversion. Counter resets after each successful order.</p>
                    
                    <div class="table-responsive">
                        <table class="table table-hover" style="background: rgba(51, 65, 85, 0.3); border-radius: 12px;">
                            <thead style="background: rgba(59, 130, 246, 0.1);">
                                <tr>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-building"></i> Customer</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-refresh"></i> Continuous Count</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-chart-line"></i> Current Streak</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-list"></i> Total Quotes</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-trophy"></i> Won Quotes</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none; text-align: center;"><i class="fa fa-calendar"></i> Period</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${customers.map(customer => `
                                    <tr style="border-bottom: 1px solid rgba(75, 85, 99, 0.3);">
                                        <td style="padding: 1rem; color: var(--text-primary); border: none;">
                                            <strong>${customer.customer}</strong>
                                        </td>
                                        <td style="padding: 1rem; text-align: center; border: none;">
                                            <span class="badge" style="background: linear-gradient(135deg, var(--accent-yellow, #f59e0b), #d97706); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600;">
                                                ${customer.continuous_count}
                                            </span>
                                        </td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">${customer.current_streak}</td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">${customer.total_quotes}</td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none;">${customer.won_quotes}</td>
                                        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); border: none; font-size: 0.875rem;">
                                            ${customer.streak_start && customer.streak_end ? 
                                                `${new Date(customer.streak_start).toLocaleDateString()} - ${new Date(customer.streak_end).toLocaleDateString()}` : 
                                                'Current ongoing'
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="alert alert-warning mt-3" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <i class="fa fa-lightbulb" style="color: var(--accent-yellow, #f59e0b); font-size: 1.25rem;"></i>
                            <div>
                                <strong>Action Needed:</strong> These customers require immediate attention and a different sales approach. 
                                Consider reviewing pricing, product fit, or sales strategy.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#drilldown-title').html(`<i class="fa fa-refresh"></i> Continuous Non-Converting Customers (${customers.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    showSiteVisitDetails() {
        const siteVisits = this.data.site_visits || [];
        
        if (siteVisits.length === 0) {
            frappe.msgprint('No site visits found');
            return;
        }
        
        const content = `
            <div class="doctype-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-map-marker-alt"></i>All Site Visits</h6>
                    <div class="row mb-3">
                        <div class="col-md-12">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${siteVisits.length}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Total Site Visits</p>
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover" style="background: rgba(51, 65, 85, 0.3); border-radius: 12px;">
                            <thead style="background: rgba(59, 130, 246, 0.1);">
                                <tr>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-id-card"></i> Visit ID</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-building"></i> Customer</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-calendar"></i> Created</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-clock"></i> Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${siteVisits.map(visit => `
                                    <tr style="border-bottom: 1px solid rgba(75, 85, 99, 0.3);">
                                        <td style="padding: 1rem; color: var(--text-primary); border: none;">
                                            <strong>${visit.name}</strong>
                                        </td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${visit.customer || 'Not specified'}</td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${visit.creation ? new Date(visit.creation).toLocaleDateString() : 'N/A'}</td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${visit.modified ? new Date(visit.modified).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        $('#drilldown-title').html(`<i class="fa fa-map-marker-alt"></i> All Site Visits (${siteVisits.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    showDesignRequestDetails() {
        const designRequests = this.data.design_requests || [];
        
        if (designRequests.length === 0) {
            frappe.msgprint('No design requests found');
            return;
        }
        
        const content = `
            <div class="doctype-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-drafting-compass"></i>All Design Requests</h6>
                    <div class="row mb-3">
                        <div class="col-md-12">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${designRequests.length}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Total Design Requests</p>
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover" style="background: rgba(51, 65, 85, 0.3); border-radius: 12px;">
                            <thead style="background: rgba(139, 92, 246, 0.1);">
                                <tr>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-id-card"></i> Request ID</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-building"></i> Customer</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-calendar"></i> Created</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-clock"></i> Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${designRequests.map(request => `
                                    <tr style="border-bottom: 1px solid rgba(75, 85, 99, 0.3);">
                                        <td style="padding: 1rem; color: var(--text-primary); border: none;">
                                            <strong>${request.name}</strong>
                                        </td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${request.customer || 'Not specified'}</td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${request.creation ? new Date(request.creation).toLocaleDateString() : 'N/A'}</td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${request.modified ? new Date(request.modified).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        $('#drilldown-title').html(`<i class="fa fa-drafting-compass"></i> All Design Requests (${designRequests.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    showPermitDetails() {
        const permits = this.data.permits || [];
        
        if (permits.length === 0) {
            frappe.msgprint('No permits found');
            return;
        }
        
        const content = `
            <div class="doctype-analysis">
                <div class="modal-section">
                    <h6><i class="fa fa-file-signature"></i>All Permits</h6>
                    <div class="row mb-3">
                        <div class="col-md-12">
                            <div style="text-align: center; padding: 1.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <h3 style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${permits.length}</h3>
                                <p style="font-size: 1rem; color: var(--text-secondary); margin: 0;">Total Permits</p>
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover" style="background: rgba(51, 65, 85, 0.3); border-radius: 12px;">
                            <thead style="background: rgba(16, 185, 129, 0.1);">
                                <tr>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-id-card"></i> Permit ID</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-building"></i> Customer</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-calendar"></i> Created</th>
                                    <th style="color: var(--text-primary); padding: 1rem; border: none;"><i class="fa fa-clock"></i> Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${permits.map(permit => `
                                    <tr style="border-bottom: 1px solid rgba(75, 85, 99, 0.3);">
                                        <td style="padding: 1rem; color: var(--text-primary); border: none;">
                                            <strong>${permit.name}</strong>
                                        </td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${permit.customer || 'Not specified'}</td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${permit.creation ? new Date(permit.creation).toLocaleDateString() : 'N/A'}</td>
                                        <td style="padding: 1rem; color: var(--text-secondary); border: none;">${permit.modified ? new Date(permit.modified).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        $('#drilldown-title').html(`<i class="fa fa-file-signature"></i> All Permits (${permits.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    // Table pagination methods
    changeTablePage(tableId, newPage) {
        if (!this.tableStates[tableId]) return;
        
        const data = this.tableStates[tableId].filteredData || this.data.filtered;
        const pageSize = 50;
        const totalPages = Math.ceil(data.length / pageSize);
        
        if (newPage < 1 || newPage > totalPages) return;
        
        this.tableStates[tableId].currentPage = newPage;
        this.refreshTableDisplay(tableId, data);
    }
    
    refreshTableDisplay(tableId, data = null) {
        const tableState = this.tableStates[tableId];
        if (!tableState) return;
        
        const tableData = data || tableState.filteredData || this.data.filtered;
        const pageSize = 50;
        const currentPage = tableState.currentPage;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, tableData.length);
        const currentData = tableData.slice(startIndex, endIndex);
        
        // Update table body
        const table = document.getElementById(tableId);
        if (table && table.querySelector('tbody')) {
            const columns = this.getTableColumns(tableId);
            table.querySelector('tbody').innerHTML = this.renderTableRows(currentData, columns);
        }
        
        // Update pagination controls
        const totalPages = Math.ceil(tableData.length / pageSize);
        const tableContainer = table?.closest('.table-controls');
        if (tableContainer) {
            const pageInfo = tableContainer.querySelector('.page-info');
            if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
            
            // Update button states
            const prevButtons = tableContainer.querySelectorAll(`[onclick*="changeTablePage('${tableId}', ${currentPage - 1})"]`);
            const nextButtons = tableContainer.querySelectorAll(`[onclick*="changeTablePage('${tableId}', ${currentPage + 1})"]`);
            
            prevButtons.forEach(btn => btn.disabled = currentPage <= 1);
            nextButtons.forEach(btn => btn.disabled = currentPage >= totalPages);
        }
        
        // Update info display
        const infoSpan = document.getElementById(`${tableId}-info`);
        if (infoSpan) {
            infoSpan.textContent = `Showing ${startIndex + 1}-${endIndex} of ${tableData.length} records`;
        }
    }
    
    showAllRecords(tableId) {
        const tableState = this.tableStates[tableId];
        if (!tableState) return;
        
        const data = tableState.filteredData || this.data.filtered;
        const columns = this.getTableColumns(tableId);
        
        // Create a modal to show all records
        const content = `
            <div class="modal-section">
                <h6><i class="fa fa-list"></i>All Records (${data.length})</h6>
                <div class="table-responsive" style="max-height: 70vh; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                ${columns.map(col => `
                                    <th>
                                        ${col.icon ? `<i class="fa ${col.icon}" style="margin-right: 0.5rem; color: var(--accent-blue);"></i>` : ''}
                                        ${col.label}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderTableRows(data, columns)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        $('#drilldown-title').html(`<i class="fa fa-list"></i> All Records for ${tableId} (${data.length})`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }
    
    getTableColumns(tableId) {
        // Return appropriate column definitions based on table ID
        const defaultColumns = [
            { key: 'quotation', label: 'Quotation', sortable: true },
            { key: 'customer_name', label: 'Customer', sortable: true },
            { key: 'transaction_date', label: 'Date', sortable: true, type: 'date' },
            { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency' },
            { key: 'status', label: 'Status', sortable: true, type: 'badge' },
            { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true }
        ];
        return defaultColumns;
    }
    
    // Alternative solutions for viewing all quotations
    exportQuotationData(title) {
        const tableState = this.tableStates['drilldown-table'];
        if (!tableState || !tableState.filteredData) return;
        
        const data = tableState.filteredData;
        const columns = ['quotation', 'customer_name', 'transaction_date', 'base_grand_total', 'status', 'account_incharge_full_name'];
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += columns.map(col => {
            const colMap = {
                'quotation': 'Quotation',
                'customer_name': 'Customer',
                'transaction_date': 'Date',
                'base_grand_total': 'Amount (AED)',
                'status': 'Status',
                'account_incharge_full_name': 'Account Manager'
            };
            return colMap[col];
        }).join(',') + '\n';
        
        // Add data rows
        data.forEach(row => {
            const csvRow = columns.map(col => {
                let value = row[col] || '';
                if (col === 'transaction_date' && value) {
                    value = frappe.datetime.str_to_user(value);
                } else if (col === 'base_grand_total') {
                    value = (value || 0).toFixed(2);
                }
                return `"${value.toString().replace(/"/g, '""')}"`;
            }).join(',');
            csvContent += csvRow + '\n';
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        frappe.show_alert({
            message: `${title} data exported successfully!`,
            indicator: 'green'
        });
    }
    
    // Handle multi-selection for Account Manager dropdown
    async handleAccountManagerMultiSelect(selectedOption, value, text, hiddenInput) {
        const input = $('#filter-account-manager-input');
        const currentValues = hiddenInput.val() ? hiddenInput.val().split(',').map(v => v.trim()).filter(Boolean) : [];
        
        // Get the clean text without any HTML highlighting
        const cleanText = selectedOption.data('original-text') || selectedOption.get(0).textContent || text;
        
        if (selectedOption.hasClass('multi-selected')) {
            // Unselect: remove from current values
            const newValues = currentValues.filter(v => v !== value);
            selectedOption.removeClass('multi-selected');
            hiddenInput.val(newValues.join(','));
        } else {
            // Select: add to current values
            if (!currentValues.includes(value)) {
                currentValues.push(value);
            }
            selectedOption.addClass('multi-selected');
            hiddenInput.val(currentValues.join(','));
        }
        
        // Update display with comma-separated names
        this.updateAccountManagerDisplay();
        
        // Clear the search input and show all options for continued searching
        input.val('');
        this.showAllSearchableOptions('account-manager');
        
        // Apply filters immediately after selection change
        console.log('Before applying filters - Hidden input value:', hiddenInput.val());
        
        // Update filter values without reloading data
        this.filters.account_incharge = hiddenInput.val() || '';
        console.log('Updated this.filters.account_incharge:', this.filters.account_incharge);
        
        // Apply filters to existing data
        this.applyFilters();
        console.log('After applyFilters - Filtered data count:', this.data.filtered ? this.data.filtered.length : 'No filtered data');
        
        await this.calculateStats();
        console.log('After calculateStats - Stats calculated');
        
        await this.renderCurrentSection();
        console.log('After renderCurrentSection - Rendering complete');
        
        // Don't hide options to allow multiple selections and continued searching
    }
    
    updateAccountManagerDisplay() {
        const hiddenInput = $('#filter-account-manager');
        const displayDiv = $('#selected-managers-display');
        const displayText = $('#selected-managers-text');
        const input = $('#filter-account-manager-input');
        
        const selectedValues = hiddenInput.val() ? hiddenInput.val().split(',').map(v => v.trim()).filter(Boolean) : [];
        
        if (selectedValues.length === 0) {
            displayDiv.hide();
            input.attr('placeholder', 'Search account managers...');
        } else {
            // Get display names for selected managers
            const displayNames = selectedValues.map(manager => {
                return this.data.quotations.find(q => q.account_incharge === manager)?.account_incharge_full_name || manager;
            });
            
            displayText.text(displayNames.join(', '));
            displayDiv.show();
            
            // Update placeholder to show selection count but keep input clear for searching
            input.attr('placeholder', `${selectedValues.length} manager(s) selected - continue searching...`);
        }
    }

    populateTeamOptionsFromQuotations() {
        console.log('Populating team options...');
        console.log('Quotations data available:', this.data && this.data.quotations ? this.data.quotations.length : 'No data');
        
        if (!this.data || !this.data.quotations) {
            console.log('No quotations data available yet');
            return;
        }
        
        // Debug first quotation structure
        if (this.data.quotations.length > 0) {
            console.log('Sample quotation structure:', Object.keys(this.data.quotations[0]));
            console.log('First quotation custom_team:', this.data.quotations[0].custom_sales_team);
            
            // Check for alternative field names
            const possibleFields = ['custom_sales_team', 'team', 'sales_team', 'ihg_team'];
            possibleFields.forEach(field => {
                if (this.data.quotations[0][field]) {
                    console.log(`Found team field '${field}':`, this.data.quotations[0][field]);
                }
            });
        }
        
        // Get unique teams from quotation data - try multiple possible field names
        this.teamFieldName = 'custom_sales_team';
        if (this.data.quotations.length > 0) {
            const possibleFields = ['custom_sales_team', 'team', 'sales_team', 'ihg_team'];
            const firstQuotation = this.data.quotations[0];
            for (const field of possibleFields) {
                if (firstQuotation[field]) {
                    this.teamFieldName = field;
                    console.log('Using team field:', this.teamFieldName);
                    break;
                }
            }
        }
        
        const allTeams = this.data.quotations.map(q => q[this.teamFieldName]);
        console.log(`All ${this.teamFieldName} values:`, allTeams);
        
        const teams = [...new Set(this.data.quotations
            .map(q => q[this.teamFieldName])
            .filter(team => team && team.trim() !== ''))]; // Filter out empty/null teams
        
        console.log('Unique teams found:', teams);
        teams.sort(); // Sort alphabetically
        
        const salesTeamOptions = $('#sales-team-options');
        if (salesTeamOptions.length === 0) {
            console.log('Sales team options element not found!');
            return;
        }
        
        salesTeamOptions.find('.searchable-option:not([data-value=""])').remove(); // Keep "All Teams" option
        
        if (teams.length > 0) {
            teams.forEach(team => {
                console.log('Adding team option:', team);
                salesTeamOptions.append(`<div class="searchable-option" data-value="${team}">${team}</div>`);
            });
            console.log('Added', teams.length, 'team options');
        } else {
            console.log('No teams found in quotation data');
            console.log('This likely means:');
            console.log('1. The team field has a different name');
            console.log('2. The team field is empty/null in all quotations');  
            console.log('3. The quotation data structure is different than expected');
        }
    }

    addTestTeamOptions() {
        console.log('Adding direct test team options...');
        const salesTeamOptions = $('#sales-team-options');
        
        if (salesTeamOptions.length === 0) {
            console.log('ERROR: #sales-team-options element not found!');
            console.log('Available elements with "team" in ID:', $('[id*="team"]').map(function() { return this.id; }).get());
            return;
        }
        
        console.log('Found sales-team-options element:', salesTeamOptions);
        
        // Clear existing options except "All Teams"
        salesTeamOptions.find('.searchable-option:not([data-value=""])').remove();
        
        // Add test options directly
        const testTeams = ['Test Team 1', 'Test Team 2', 'Test Team 3', 'Development Team', 'Sales Team'];
        testTeams.forEach(team => {
            console.log('Adding test team:', team);
            salesTeamOptions.append(`<div class="searchable-option" data-value="${team}">${team}</div>`);
        });
        
        console.log('Test team options added. Total options now:', salesTeamOptions.find('.searchable-option').length);
    }

    showFullDataModal(title) {
        const tableState = this.tableStates['drilldown-table'];
        if (!tableState || !tableState.filteredData) return;
        
        const data = tableState.filteredData;
        const columns = this.getTableColumns('drilldown-table');
        
        // Create a full data modal
        const content = `
            <div class="modal-section">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0"><i class="fa fa-list"></i>All ${title} (${data.length} records)</h6>
                    <div class="full-data-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-primary" onclick="frappe.sales_intelligence.exportQuotationData('${title.replace(/'/g, '\\\'')}_Complete')" title="Export all data">
                            <i class="fa fa-download"></i> Export All
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="$('#fullDataModal').modal('hide')" title="Close">
                            <i class="fa fa-times"></i> Close
                        </button>
                    </div>
                </div>
                <div class="table-responsive" style="max-height: 60vh; overflow-y: auto;">
                    <table class="data-table table table-striped table-hover">
                        <thead class="thead-dark" style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                ${columns.map(col => `
                                    <th style="background: var(--dark-bg); color: white; padding: 0.75rem; border: 1px solid var(--border-color);">
                                        ${col.icon ? `<i class="fa ${col.icon}" style="margin-right: 0.5rem;"></i>` : ''}
                                        ${col.label}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderTableRows(data, columns)}
                        </tbody>
                    </table>
                </div>
                <div class="mt-3 text-center">
                    <small class="text-muted">Showing all ${data.length} records</small>
                </div>
            </div>
        `;
        
        // Check if fullDataModal exists, if not create it
        if (!document.getElementById('fullDataModal')) {
            const modalHtml = `
                <div class="modal fade" id="fullDataModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="full-data-title">Complete Data View</h5>
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body" id="full-data-content">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        $('#full-data-title').html(`Complete ${title} Data`);
        $('#full-data-content').html(content);
        $('#fullDataModal').modal('show');
    }
}

// Initialize when page loads
frappe.ready(() => {
    console.log('Enhanced Sales Intelligence Dashboard loaded successfully');
});
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
            company: [],
            branch: [],
            account_incharge: [],
            created_by: [],
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
        this.detectCurrentPreset(); // Check if current date range matches a preset
        await this.loadData();
        this.renderCurrentSection();
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
                                            <select class="form-control" id="filter-company" multiple></select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Branch</label>
                                            <select class="form-control" id="filter-branch" multiple></select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-section">
                                <h6><i class="fa fa-users"></i>People Filters</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Account Manager</label>
                                            <select class="form-control" id="filter-account-manager" multiple></select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.5rem; display: block;">Status</label>
                                            <select class="form-control" id="filter-status" multiple>
                                                <option value="Open">Open</option>
                                                <option value="Ordered">Ordered</option>
                                                <option value="Partially Ordered">Partially Ordered</option>
                                                <option value="Expired">Expired</option>
                                                <option value="Lost">Lost</option>
                                            </select>
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
                                Open in ERP
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
        $('#global-search').on('input', frappe.utils.debounce((e) => {
            this.filters.search_query = e.target.value;
            this.applyFilters();
            this.renderCurrentSection();
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
        $('#advanced-filters-btn').on('click', () => {
            this.populateFilterOptions();
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
                frappe.set_route('Form', 'Quotation', quotationName);
            }
        });
    }

 // In the loadData() method, add this after processData():
async loadData() {
    try {
        this.showLoading();
        
        // Check if this is a request for all data
        const requestAllData = this.requestAllData || false;
        
        const response = await frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_period_wise_quotation_report',
            args: {
                from_date: this.filters.from_date,
                to_date: this.filters.to_date,
                company: this.filters.company,
                branch: this.filters.branch,
                account_incharge: this.filters.account_incharge,
                created_by: this.filters.created_by,
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
            
            // Fix metadata handling
            // Check if filters are applied (excluding default date range)
            const hasFilters = this.filters.company.length > 0 || 
                              this.filters.branch.length > 0 || 
                              this.filters.account_incharge.length > 0 || 
                              this.filters.created_by.length > 0 || 
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
            
            this.processData();
            
            // Add debugging
            this.debugWorkflowStates(); // Add this line
            
            this.renderCurrentSection();
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        frappe.msgprint('Failed to load dashboard data');
    } finally {
        this.hideLoading();
    }
}

    processData() {
        // Add calculated fields
        this.data.quotations = this.data.quotations.map(quote => {
            quote.pipeline = this.calculatePipeline(quote);
            quote.days_since_created = Math.ceil((new Date() - new Date(quote.transaction_date)) / (1000 * 60 * 60 * 24));
            quote.days_to_expiry = Math.ceil((new Date(quote.valid_till) - new Date()) / (1000 * 60 * 60 * 24));
            return quote;
        });
        
        this.applyFilters();
        this.calculateStats();
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
                    quote.custom_project_description,
                    quote.status,
                    quote.workflow_state
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });
    }

    calculateStats() {
        const data = this.data.filtered;
        
        // Overview Stats
        this.data.stats.overview = this.calculateOverviewStats(data);
        
        // Pipeline Stats - Fixed to only include pending quotations
        this.data.stats.pipeline = this.calculatePipelineStats(data);
        
        // Conversion Stats
        this.data.stats.conversion = this.calculateConversionStats(data);
        
        // Margin Stats
        this.data.stats.margin = this.calculateMarginStats(data);
        
        // Items Stats
        this.data.stats.items = this.calculateItemsStats(data);
        
        // Follow-up Stats
        this.data.stats.followup = this.calculateFollowupStats(data);
        
        // Customer Stats - Enhanced
        this.data.stats.customers = this.calculateCustomerStats(data);
    }
    

    calculateOverviewStats(data) {
        const pendingQuotes = data.filter(q => ['Open', 'Expired'].includes(q.status));
        
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
        
        return {
            total: {
                count: data.length,
                amount: data.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
            },
            won: {
                count: data.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status)).length,
                amount: data.filter(q => ['Ordered', 'Partially Ordered'].includes(q.status))
                    .reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
            },
            pending: {
                count: pendingQuotes.length,
                amount: pendingQuotes.reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
            },
            lost: {
                count: data.filter(q => q.status === 'Lost').length,
                amount: data.filter(q => q.status === 'Lost')
                    .reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
            },
            draft: {
                count: data.filter(q => q.status === 'Draft').length,
                amount: data.filter(q => q.status === 'Draft')
                    .reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
            },
            // New workflow state-based stats
            draftWorkflow: {
                count: data.filter(q => q.workflow_state === 'Draft').length,
                amount: data.filter(q => q.workflow_state === 'Draft')
                    .reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
            },
            pendingDeptApproval: {
                count: data.filter(q => q.workflow_state === 'Pending Dept Approval').length,
                amount: data.filter(q => q.workflow_state === 'Pending Dept Approval')
                    .reduce((sum, q) => sum + (q.base_grand_total || 0), 0)
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
    
    // Consider ALL quotations that have pipeline workflow states, not just Open ones
    const quotationsWithPipeline = data.filter(quote => {
        const pipeline = this.calculatePipeline(quote);
        return pipeline !== 'None';
    });
    
    console.log('Found', quotationsWithPipeline.length, 'quotations with pipeline workflow states');
    
    // Also include quotations that are Open but don't have pipeline states
    const openQuotesWithoutPipeline = data.filter(quote => {
        return quote.status === 'Open' && this.calculatePipeline(quote) === 'None';
    });
    
    console.log('Found', openQuotesWithoutPipeline.length, 'Open quotations without pipeline states');
    
    // Process all quotations with pipeline states
    quotationsWithPipeline.forEach(quote => {
        const pipeline = this.calculatePipeline(quote);
        console.log(`Quote ${quote.quotation}: status=${quote.status}, pipeline=${pipeline}, workflow_state="${quote.workflow_state}"`);
        
        if (this.data.pipelines[pipeline]) {
            this.data.pipelines[pipeline].quotes.push(quote);
            this.data.pipelines[pipeline].value += quote.base_grand_total || 0;
        }
    });
    
    // Add Open quotations without pipeline to 'None' category
    openQuotesWithoutPipeline.forEach(quote => {
        this.data.pipelines['None'].quotes.push(quote);
        this.data.pipelines['None'].value += quote.base_grand_total || 0;
    });
    
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
            branchWise: this.calculateConversionByField(data, 'branch', wonStatuses),
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
        const branchMargins = this.calculateMarginByField(marginData, 'branch');
        
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

    calculateItemsStats(data) {
        const itemMap = new Map();
        
        data.forEach(quote => {
            if (quote.items) {
                quote.items.forEach(item => {
                    const key = item.item_code;
                    if (!itemMap.has(key)) {
                        itemMap.set(key, {
                            item_code: item.item_code,
                            brand: item.brand,
                            image: item.image,
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
        
        return {
            all: itemsArray,
            mostQuotedByCount: [...itemsArray].sort((a, b) => b.quote_count - a.quote_count).slice(0, 20),
            mostQuotedByValue: [...itemsArray].sort((a, b) => b.total_value - a.total_value).slice(0, 20),
            lowMarginItems: itemsArray.filter(item => parseFloat(item.avg_margin) < 15)
                .sort((a, b) => parseFloat(a.avg_margin) - parseFloat(b.avg_margin))
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
            vip: { name: 'VIP Customers', customers: [], criteria: 'High value & frequency' },
            loyal: { name: 'Loyal Customers', customers: [], criteria: 'Consistent engagement' },
            potential: { name: 'Potential Growth', customers: [], criteria: 'Growing engagement' },
            atrisk: { name: 'At Risk', customers: [], criteria: 'Declining engagement' }
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
        
        return segments;
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

    navigateToSection(section) {
        $('.nav-item').removeClass('active');
        $(`.nav-item[data-section="${section}"]`).addClass('active');
        
        this.currentSection = section;
        this.renderCurrentSection();
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
            lost: { title: 'Lost Quotations', subtitle: 'Analyze lost opportunities and reasons' }
        };
        
        const sectionInfo = titles[section] || titles.overview;
        $('#page-title').text(sectionInfo.title);
        $('#page-subtitle').text(sectionInfo.subtitle);
    }

    renderCurrentSection() {
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
                
                <div class="stat-card" onclick="frappe.sales_intelligence.showDrilldown('pending_quotations')">
                    <div class="stat-card-header">
                        <div class="stat-card-content">
                            <h3 class="stat-card-title">
                                <i class="fa fa-clock" style="color: var(--accent-orange); margin-right: 0.5rem;"></i>
                                Pending Quotations
                            </h3>
                            <p class="stat-card-value">${stats.pending.count.toLocaleString()}</p>
                            <p class="stat-card-amount">AED ${this.formatCurrency(stats.pending.amount)}</p>
                        </div>
                        <div class="stat-card-icon warning">
                            <i class="fa fa-clock"></i>
                        </div>
                    </div>
                    <span class="click-indicator">
                        <i class="fa fa-mouse-pointer"></i>
                        Click to view details
                    </span>
                </div>
                
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
                            High Confidence (90-100%)
                        </span>
                        <span class="legend-item legend-b">
                            <span class="legend-dot"></span>
                            Medium Confidence (50-75%)
                        </span>
                        <span class="legend-item legend-c">
                            <span class="legend-dot"></span>
                            Low Confidence (0-50%)
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
                                <div class="stage-subtitle">High Confidence</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-high">90-100%</div>
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
                            <div class="progress-text">95% Weight Factor</div>
                        </div>
                        
                        ${pipelines.A.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-mouse-pointer"></i> Click to view details</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations in this pipeline</div>`}
                    </div>

                    <!-- Pipeline B -->
                    <div class="pipeline-stage-card pipeline-b ${pipelines.B.quotes.length === 0 ? 'empty' : ''}" onclick="frappe.sales_intelligence.showPipelineDetails('B')">
                        <div class="stage-header">
                            <div class="stage-info">
                                <div class="stage-title">Pipeline B</div>
                                <div class="stage-subtitle">Medium Confidence</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-medium">50-75%</div>
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
                                <div class="progress-fill progress-b" style="width: 62.5%"></div>
                            </div>
                            <div class="progress-text">62.5% Weight Factor</div>
                        </div>
                        
                        ${pipelines.B.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-mouse-pointer"></i> Click to view details</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations in this pipeline</div>`}
                    </div>

                    <!-- Pipeline C -->
                    <div class="pipeline-stage-card pipeline-c ${pipelines.C.quotes.length === 0 ? 'empty' : ''}" onclick="frappe.sales_intelligence.showPipelineDetails('C')">
                        <div class="stage-header">
                            <div class="stage-info">
                                <div class="stage-title">Pipeline C</div>
                                <div class="stage-subtitle">Low Confidence</div>
                            </div>
                            <div class="stage-probability">
                                <div class="probability-badge probability-low">0-50%</div>
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
                                <div class="progress-fill progress-c" style="width: 25%"></div>
                            </div>
                            <div class="progress-text">25% Weight Factor</div>
                        </div>
                        
                        ${pipelines.C.quotes.length > 0 ? `<div class="stage-click-hint"><i class="fa fa-mouse-pointer"></i> Click to view details</div>` : `<div class="stage-empty"><i class="fa fa-inbox"></i> No quotations in this pipeline</div>`}
                    </div>

                    <!-- No Pipeline -->
                    ${pipelines.None.quotes.length > 0 ? `
                    <div class="pipeline-stage-card pipeline-none" onclick="frappe.sales_intelligence.showPipelineDetails('None')">
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
                        
                        <div class="stage-click-hint"><i class="fa fa-exclamation-triangle"></i> Click to review unassigned quotations</div>
                    </div>
                    ` : ''}
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
                                    Most Popular Item
                                </h3>
                                <p class="stat-card-value">${stats.mostQuotedByCount[0]?.quote_count || 0}</p>
                                <p class="stat-card-amount">
                                    <i class="fa fa-trophy" style="color: var(--accent-orange); margin-right: 0.25rem;"></i>
                                    ${stats.mostQuotedByCount[0]?.item_code || 'N/A'}
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
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fa fa-users-cog"></i>
                            <span>Customer categories based on behavior</span>
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
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${stats.segments.vip.criteria}</p>
                            </div>
                        </div>
                        
                        <div class="segment-card segment-loyal" onclick="frappe.sales_intelligence.showCustomerSegment('loyal')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-green), #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-handshake"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.loyal.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-green); margin: 0 0 0.5rem 0;">${stats.segments.loyal.name}</p>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${stats.segments.loyal.criteria}</p>
                            </div>
                        </div>
                        
                        <div class="segment-card segment-potential" onclick="frappe.sales_intelligence.showCustomerSegment('potential')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-blue), #2563eb); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-rocket"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.potential.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-blue); margin: 0 0 0.5rem 0;">${stats.segments.potential.name}</p>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${stats.segments.potential.criteria}</p>
                            </div>
                        </div>
                        
                        <div class="segment-card segment-atrisk" onclick="frappe.sales_intelligence.showCustomerSegment('atrisk')">
                            <div style="margin-bottom: 1rem;">
                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-red), #dc2626); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: white; font-size: 24px;">
                                    <i class="fa fa-exclamation-triangle"></i>
                                </div>
                                <h4 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">${stats.segments.atrisk.customers.length}</h4>
                                <p style="font-size: 1rem; font-weight: 600; color: var(--accent-red); margin: 0 0 0.5rem 0;">${stats.segments.atrisk.name}</p>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">${stats.segments.atrisk.criteria}</p>
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
        const currentData = data.slice(0, 100); // Limit to 100 rows for performance
        
        return `
            <div class="table-controls">
                <div class="table-controls-left">
                    <div class="table-search">
                        <i class="fa fa-search"></i>
                        <input type="text" id="${searchId}" placeholder="Search in table..." oninput="frappe.sales_intelligence.filterTable('${tableId}', this.value)">
                    </div>
                    <div class="table-info">
                        <i class="fa fa-info-circle"></i>
                        <span id="${tableId}-info">Showing ${currentData.length} of ${data.length} records</span>
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
            ${data.length > 100 ? `<p class="text-muted mt-2" style="font-size: 0.875rem; color: var(--text-secondary);">Showing first 100 of ${data.length} records. Use search to find specific items.</p>` : ''}
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
                                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); frappe.set_route('Form', 'Quotation', '${item.quotation}')" title="Open in Frappe">
                                    <i class="fa fa-external-link-alt"></i>
                                </button>
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
                            return `<td><strong>${item[col.key]}</strong></td>`;
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
        const quote = this.data.quotations.find(q => q.quotation === quotationName);
        if (!quote) return;

        const content = this.generateQuotationDetailsContent(quote);
        $('#quotation-title').html(`<i class="fa fa-file-alt"></i> ${quotationName} - Details`);
        $('#quotation-content').html(content);
        $('#open-quotation').data('quotation', quotationName);
        $('#quotationDetailsModal').modal('show');
    }

    generateQuotationDetailsContent(quote) {
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
                                <tr><td style="font-weight: 600; color: var(--text-secondary);">Branch:</td><td style="color: var(--text-primary);">${quote.branch || '-'}</td></tr>
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
    }

    showCustomerDetails(customerName) {
        const customerQuotes = this.data.quotations.filter(q => 
            (q.customer_name || q.party_name) === customerName
        );
        
        if (customerQuotes.length === 0) return;
        
        const content = this.generateCustomerDetailsContent(customerName, customerQuotes);
        $('#quotation-title').html(`<i class="fa fa-building"></i> ${customerName} - Customer Analysis`);
        $('#quotation-content').html(content);
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
                                    <th>Margin</th>
                                    <th>Pipeline</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotes.map(quote => `
                                    <tr onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')" style="cursor: pointer;">
                                        <td><strong>${quote.quotation}</strong></td>
                                        <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
                                        <td>AED ${this.formatCurrency(quote.base_grand_total)}</td>
                                        <td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td>
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
    
    // Consider ALL quotations with pipeline workflow states, not just Open ones
    this.data.quotations.filter(q => this.calculatePipeline(q) !== 'None' || q.status === 'Open').forEach(quote => {
        const branch = quote.branch || 'Unknown';
        
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
    
    // Consider ALL quotations with pipeline workflow states, not just Open ones
    this.data.quotations.filter(q => this.calculatePipeline(q) !== 'None' || q.status === 'Open').forEach(quote => {
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
    const openQuotes = this.data.quotations.filter(q => q.status === 'Open' && q.pipeline !== 'None');
    if (openQuotes.length === 0) return 0;
    
    const totalDays = openQuotes.reduce((sum, quote) => {
        return sum + Math.ceil((new Date() - new Date(quote.transaction_date)) / (1000 * 60 * 60 * 24));
    }, 0);
    
    return Math.round(totalDays / openQuotes.length);
}

calculateQuotesNearExpiry() {
    return this.data.quotations.filter(q => {
        if (q.status !== 'Open') return false;
        const daysToExpiry = Math.ceil((new Date(q.valid_till) - new Date()) / (1000 * 60 * 60 * 24));
        return daysToExpiry <= 7 && daysToExpiry >= 0;
    }).length;
}

calculateStagnatPipelines() {
    return this.data.quotations.filter(q => {
        if (q.status !== 'Open' || q.pipeline === 'None') return false;
        const daysInPipeline = Math.ceil((new Date() - new Date(q.transaction_date)) / (1000 * 60 * 60 * 24));
        return daysInPipeline > 30;
    }).length;
}

renderUrgentPipelineActions() {
    const urgentQuotes = this.data.quotations.filter(q => {
        if (q.status !== 'Open') return false;
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
                                <h6><i class="fa fa-file-alt" style="margin-right: 0.5rem; color: var(--accent-blue);"></i>${quote.quotation}</h6>
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
            default:
                data = this.data.filtered;
                title = 'Quotation Details';
        }

        const content = this.generateDrilldownContent(data);
        $('#drilldown-title').html(`<i class="fa fa-chart-line"></i> ${title}`);
        $('#drilldown-content').html(content);
        $('#drilldownModal').modal('show');
    }

    generateDrilldownContent(data) {
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
                    <h6><i class="fa fa-table"></i>Detailed Data</h6>
                    ${this.renderTableWithControls('drilldown-table', data.slice(0, 100), [
                        { key: 'quotation', label: 'Quotation', sortable: true },
                        { key: 'customer_name', label: 'Customer', sortable: true },
                        { key: 'transaction_date', label: 'Date', sortable: true, type: 'date' },
                        { key: 'base_grand_total', label: 'Amount', sortable: true, type: 'currency' },
                        { key: 'status', label: 'Status', sortable: true, type: 'badge' },
                        { key: 'account_incharge_full_name', label: 'Account Manager', sortable: true }
                    ])}
                    ${data.length > 100 ? `<p style="color: var(--text-muted); margin-top: 1rem;">Showing first 100 of ${data.length} records.</p>` : ''}
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
                                    <th><i class="fa fa-percentage" style="margin-right: 0.5rem;"></i>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotes.slice(0, 10).map(quote => `
                                    <tr onclick="frappe.sales_intelligence.showQuotationDetails('${quote.quotation}')" style="cursor: pointer;">
                                        <td><strong>${quote.quotation}</strong></td>
                                        <td>${quote.customer_name || quote.party_name || 'Unknown'}</td>
                                        <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
                                        <td>AED ${this.formatCurrency(quote.base_grand_total)}</td>
                                        <td><span class="status-badge ${this.getStatusClass(quote.status)}"><i class="fa ${this.getStatusIcon(quote.status)}" style="margin-right: 0.25rem;"></i>${quote.status}</span></td>
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
                                            <td><strong>${quote.quotation}</strong></td>
                                            <td>${quote.customer_name || quote.party_name || 'Unknown'}</td>
                                            <td>${frappe.datetime.str_to_user(quote.transaction_date)}</td>
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
                    <h6><i class="fa fa-list"></i>Customer Details</h6>
                    ${this.renderTableWithControls('segment-customers', customers, [
                        { key: 'name', label: 'Customer Name', sortable: true },
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
    populateFilterOptions() {
        // Populate company options
        const companies = [...new Set(this.data.quotations.map(q => q.company).filter(Boolean))];
        $('#filter-company').empty().append('<option value="">All Companies</option>');
        companies.forEach(company => {
            $('#filter-company').append(`<option value="${company}">${company}</option>`);
        });

        // Populate branch options
        const branches = [...new Set(this.data.quotations.map(q => q.branch).filter(Boolean))];
        $('#filter-branch').empty().append('<option value="">All Branches</option>');
        branches.forEach(branch => {
            $('#filter-branch').append(`<option value="${branch}">${branch}</option>`);
        });

        // Populate account manager options
        const managers = [...new Set(this.data.quotations.map(q => q.account_incharge).filter(Boolean))];
        $('#filter-account-manager').empty().append('<option value="">All Managers</option>');
        managers.forEach(manager => {
            const displayName = this.data.quotations.find(q => q.account_incharge === manager)?.account_incharge_full_name || manager;
            $('#filter-account-manager').append(`<option value="${manager}">${displayName}</option>`);
        });

        // Set current values
        if (this.filters.company.length > 0) $('#filter-company').val(this.filters.company);
        if (this.filters.branch.length > 0) $('#filter-branch').val(this.filters.branch);
        if (this.filters.account_incharge.length > 0) $('#filter-account-manager').val(this.filters.account_incharge);
        if (this.filters.status !== 'all') $('#filter-status').val(Array.isArray(this.filters.status) ? this.filters.status : [this.filters.status]);
        $('#filter-amount-min').val(this.filters.amount_min || '');
        $('#filter-amount-max').val(this.filters.amount_max || '');
    }

    applyAdvancedFilters() {
        this.filters.company = $('#filter-company').val() || [];
        this.filters.branch = $('#filter-branch').val() || [];
        this.filters.account_incharge = $('#filter-account-manager').val() || [];
        this.filters.status = $('#filter-status').val() || 'all';
        this.filters.amount_min = parseFloat($('#filter-amount-min').val()) || null;
        this.filters.amount_max = parseFloat($('#filter-amount-max').val()) || null;
        
        this.loadData();
    }

    clearAllFilters() {
        this.filters = {
            from_date: this.filters.from_date,
            to_date: this.filters.to_date,
            status: 'all',
            company: [],
            branch: [],
            account_incharge: [],
            created_by: [],
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
        this.loadData();
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
                                        <td><strong>${quote.quotation}</strong></td>
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
        
        // Analyze by branch
        const branchLossMap = new Map();
        lostQuotes.forEach(quote => {
            const branch = quote.branch || 'Unknown';
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
        
        // Analyze by account manager
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
                
                <!-- Loss Reasons Analysis -->
                <div class="data-section">
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-exclamation-triangle"></i>
                            Loss Reasons Analysis
                        </h2>
                    </div>
                    
                    <div class="table-container">
                        ${this.renderTableWithControls('loss-reasons-table', reasons, [
                            { key: 'reason', label: 'Lost Reason', sortable: true, icon: 'fa-exclamation-triangle' },
                            { key: 'count', label: 'Count', sortable: true, icon: 'fa-list' },
                            { key: 'amount', label: 'Lost Value', sortable: true, type: 'currency', icon: 'fa-money-bill-wave' }
                        ])}
                    </div>
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
                            { key: 'branch', label: 'Branch', sortable: true, icon: 'fa-map-marker-alt' },
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
                    <div class="section-header">
                        <h2 class="section-title">
                            <i class="fa fa-clock"></i>
                            Recent Lost Quotations
                        </h2>
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
}

// Initialize when page loads
frappe.ready(() => {
    console.log('Enhanced Sales Intelligence Dashboard loaded successfully');
});
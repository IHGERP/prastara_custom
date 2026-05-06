// Ultra-Modern Sales Order Analytics Dashboard - Complete Redesign
frappe.pages['prd-so-calender'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Sales Order Pending',
        single_column: true
    });

    frappe.sales_order_dashboard = new UltraModernSalesOrderDashboard(wrapper);
}

class UltraModernSalesOrderDashboard {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = wrapper.page;
        this.current_view = 'dashboard';
        this.filters = {};
        this.sort_config = { field: 'delivery_date', order: 'ASC' };
        this.data = {};
        this.completed_summary_data = null;
        this.completed_summary_loading = false;
        this.completed_summary_request_key = null;
        this.all_orders = [];
        this.filtered_orders = [];
        this.project_overview_rows = [];
        this.project_owner_mapping_rows = [];
        this.project_owner_selected_key = null;
        this.project_owner_active_role = 'production_manager';
        this.project_owner_breakdown_rows = [];
        this.project_owner_mapping_loaded = false;
        this.project_owner_mapping_promise = null;
        this.project_owner_table_state = {
            search: '',
            production_filter: 'all',
            installation_filter: 'all',
            supervisor_filter: 'all',
            delay_filter: 'all',
            sort_field: 'delivery_date',
            sort_order: 'asc'
        };
        this.calendar_date = new Date();
        this.filter_options = { customers: [], sales_persons: [], sales_teams: [], branches: [], statuses: [] };
        this.search_timeout = null;
        this.theme = 'light'; // Can be extended for dark mode
        this.header_stat_metric = 'grand_total';
        this.header_count_basis = 'value_range';
        this.header_due_scope = 'all';
        this.show_on_hold_only = false;

        this.initialize();
    }

    initialize() {
        this.setupStyles();
        this.setupLayout();
        this.setupGlobalSearch();
        this.setupFilters();
        this.setupViewSwitcher();
        this.setupModals();
        this.setupFloatingActionButton();
        this.loadData();
    }

    setupStyles() {
        $(`<style>
            /* Ultra-Modern Sales Dashboard Styles */
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            
           
:root {
    /* Enhanced Gray/Neutral Color Palette */
    --primary: #64748b;
    --primary-light: #94a3b8;
    --primary-dark: #475569;
    --primary-glass: rgba(100, 116, 139, 0.12);
    --secondary: #6b7280;
    --secondary-light: #9ca3af;
    --accent: #52525b;
    --success: #10b981;
    --warning: #f59e0b;
    --error: #ef4444;
    --info: #3b82f6;
    
    /* Light Surface Colors */
    --surface: #ffffff;
    --surface-glass: rgba(255, 255, 255, 0.9);
    --surface-alt: #fafafa;
    --surface-hover: #f5f5f5;
    --surface-dark: #e5e7eb;
    --surface-elevated: #ffffff;
    --surface-card: #ffffff;
    --glass-border: rgba(100, 116, 139, 0.15);
    
    /* Enhanced Dark Text Colors */
    --text: #0f172a;
    --text-secondary: #1e293b;
    --text-muted: #475569;
    --text-light: #64748b;
    --text-inverse: #ffffff;
    
    /* Enhanced Borders & Shadows */
    --border: #d1d5db;
    --border-light: #e5e7eb;
    --border-dark: #9ca3af;
    --border-subtle: #f3f4f6;
    --shadow-sm: 0 1px 3px 0 rgb(15 23 42 / 0.08);
    --shadow-md: 0 4px 6px -1px rgb(15 23 42 / 0.12);
    --shadow-lg: 0 10px 15px -3px rgb(15 23 42 / 0.15);
    --shadow-xl: 0 20px 25px -5px rgb(15 23 42 / 0.18);
    --shadow-2xl: 0 25px 50px -12px rgb(15 23 42 / 0.25);
    --shadow-inner: inset 0 2px 4px 0 rgb(15 23 42 / 0.08);
    --shadow-glow: 0 0 25px rgba(100, 116, 139, 0.15);
    --shadow-color: 0 0 20px rgba(100, 116, 139, 0.12);
    
    /* Sophisticated Gray Gradients */
    --gradient-primary: linear-gradient(135deg, #64748b 0%, #475569 100%);
    --gradient-secondary: linear-gradient(135deg, #6b7280 0%, #52525b 100%);
    --gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);
    --gradient-warm: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
    --gradient-cool: linear-gradient(135deg, #475569 0%, #334155 100%);
    --gradient-dark: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    --gradient-surface: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
    --gradient-glass: linear-gradient(135deg, rgba(100, 116, 139, 0.05) 0%, rgba(107, 114, 128, 0.05) 100%);
    
    /* Enhanced Light Backgrounds */
    --bg-primary: var(--surface);
    --bg-secondary: var(--surface-alt);
    --bg-tertiary: var(--surface-elevated);
    --bg-glass: rgba(255, 255, 255, 0.8);
    --bg-blur: rgba(255, 255, 255, 0.9);
    
    /* Spacing & Sizing (unchanged) */
    --radius: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --radius-2xl: 1.25rem;
    --radius-full: 9999px;
    --space-1: 0.2rem;
    --space-2: 0.4rem;
    --space-3: 0.6rem;
    --space-4: 0.8rem;
    --space-5: 1rem;
    --space-6: 1.2rem;
    --space-8: 1.6rem;
    --space-10: 2rem;
    --space-12: 2.4rem;
    --space-16: 3.2rem;
    
    /* Enhanced Animations */
    --transition-fast: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-bounce: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    
    /* Special Gray/Neutral Theme Effects */
    --glow-subtle: 0 0 10px rgba(100, 116, 139, 0.08);
    --glow-medium: 0 0 20px rgba(100, 116, 139, 0.12);
    --glow-strong: 0 0 30px rgba(100, 116, 139, 0.15);
    --backdrop-blur: blur(8px);
    --backdrop-saturate: saturate(120%);
    
    /* Interactive States */
    --hover-overlay: rgba(100, 116, 139, 0.06);
    --focus-ring: 0 0 0 3px rgba(100, 116, 139, 0.15);
    --active-overlay: rgba(100, 116, 139, 0.12);
    
    /* Enhanced Status Indicators */
    --status-online: #10b981;
    --status-away: #f59e0b;
    --status-busy: #ef4444;
    --status-offline: #64748b;
    
    /* Dark Element Overlays for Contrast */
    --dark-overlay-1: rgba(15, 23, 42, 0.05);
    --dark-overlay-2: rgba(15, 23, 42, 0.08);
    --dark-overlay-3: rgba(15, 23, 42, 0.12);
    
    /* Typography Enhancements */
    --text-contrast: #020617;
    --text-heading: #0f172a;
    --text-body: #1e293b;
    --text-caption: #475569;
}

:root {
    /* Additional Gray/Neutral Variations */
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-300: #d1d5db;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;
    --gray-950: #030712;
    
    /* Slate Accents */
    --slate-light: #94a3b8;
    --slate-base: #64748b;
    --slate-dark: #475569;
    
    /* Stone Variations */
    --stone-light: #a8a29e;
    --stone-base: #78716c;
    --stone-dark: #57534e;
}
            /* Global Styles */
            .ultra-modern-dashboard {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: #f0f2f5;
                min-height: 100vh;
                color: var(--text);
                line-height: 1.6;
                position: relative;
                overflow-x: hidden;
            }

            .ultra-modern-dashboard::before {
                content: '';
                position: fixed;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
                animation: float 20s ease-in-out infinite;
                z-index: -1;
            }

            @keyframes float {
                0%, 100% { transform: translate(0, 0) rotate(0deg); }
                33% { transform: translate(-30px, -30px) rotate(120deg); }
                66% { transform: translate(30px, -30px) rotate(240deg); }
            }

            /* Glassmorphism Base */
            .glass {
                background: var(--surface-glass);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid var(--glass-border);
            }

            /* Enhanced Header Section */
.dashboard-header-section {
    
    padding: var(--space-8) 0;
    margin-bottom: var(--space-6);
    position: relative;
    overflow: hidden;
}

            .dashboard-header-section::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
                animation: pulse 4s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 0.3; }
                50% { transform: scale(1.1); opacity: 0.1; }
            }

            .dashboard-header-content {
                max-width: 1400px;
                margin: 0 auto;
                padding: 0 var(--space-8);
                position: relative;
                z-index: 1;
            }

            .header-title {
                font-size: 3.5rem;
                font-weight: 800;
                color: white;
                margin-bottom: var(--space-3);
                letter-spacing: -0.02em;
                text-align: center;
                text-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            .header-subtitle {
                color: rgba(255, 255, 255, 0.9);
                font-size: 1.25rem;
                text-align: center;
                font-weight: 500;
                margin-bottom: var(--space-10);
            }

.header-stats {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: stretch;
    gap: var(--space-3);
    margin-top: var(--space-4);
    overflow-x: auto;
    padding-bottom: var(--space-2);
    scrollbar-width: thin;
}
.header-stats-toolbar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-2);
}
.header-stats-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-full);
    padding: 4px;
    backdrop-filter: blur(10px);
}
.stats-toggle-btn {
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: rgba(15, 23, 42, 0.85);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
    transition: var(--transition-fast);
}
.stats-toggle-btn.active {
    background: rgba(255, 255, 255, 0.95);
    color: var(--text);
    box-shadow: var(--shadow-sm);
}
#header-count-toggle .stats-toggle-btn {
    padding: 6px 10px;
    white-space: nowrap;
}
.on-hold-toggle-btn {
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.22);
    color: rgba(15, 23, 42, 0.85);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 8px 14px;
    cursor: pointer;
    transition: var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.on-hold-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.32);
}
.on-hold-toggle-btn.active {
    background: rgba(239, 68, 68, 0.22);
    border-color: rgba(220, 38, 38, 0.45);
    color: #7f1d1d;
    box-shadow: var(--shadow-sm);
}
.header-stat {
box-shadow: rgba(0, 0, 0, 0.15) 0px 15px 25px, rgba(0, 0, 0, 0.05) 0px 5px 10px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    transition: var(--transition);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    flex: 0 0 155px;
    width: 155px;
    min-height: 160px;
    display: flex;
    flex-direction: column;
}
.header-stat-icon {
    width: 35px;
    height: 35px;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1rem;
    margin-bottom: var(--space-3);
    box-shadow: var(--shadow-md);
}

.header-stat-value {
    font-size: 1.75rem;
    font-weight: 600;
    color: black;
    margin-bottom: var(--space-1);
    line-height: 1;
}
.header-stat::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
    opacity: 0;
    transition: var(--transition);
}

.header-stat:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
}

.header-stat:hover::before {
    opacity: 1;
}
.header-stat-icon {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: black;
    font-size: 0.95rem;
    margin-bottom: var(--space-2);
    box-shadow: var(--shadow-md);
}

.header-stat-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    height: 100%;
}
    
.header-stat-value {
    font-size: 1.35rem;
    font-weight: 800;
    color: black;
    margin-bottom: var(--space-1);
    line-height: 1;
}

.header-stat-label {
    color: rgba(34, 34, 34, 0.9);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-1);
    min-height: 2.1em;
    display: flex;
    align-items: center;
    line-height: 1.2;
}

.header-stat-amount {
    color: #334155;
    font-size: 0.68rem;
    font-weight: 600;
    background: rgba(248, 250, 252, 0.92);
    padding: 4px 6px;
    border-radius: var(--radius);
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid rgba(148, 163, 184, 0.22);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.header-stat-amount-order {
    background: rgba(219, 234, 254, 0.92);
    color: #1d4ed8;
    border: 1px solid rgba(96, 165, 250, 0.45);
}
.header-stat-amount-remaining {
    background: rgba(254, 226, 226, 0.95);
    color: #b91c1c;
    border: 1px solid rgba(248, 113, 113, 0.42);
    font-weight: 700;
}
.header-stat-amount-payment {
    background: rgba(220, 252, 231, 0.95);
    color: #047857;
    border: 1px solid rgba(52, 211, 153, 0.42);
}
.header-stat-amount-billed {
    background: rgba(255, 237, 213, 0.95);
    color: #c2410c;
    border: 1px solid rgba(251, 146, 60, 0.42);
}
.header-stat-amount-secondary {
    display: block;
    width: 100%;
    margin-top: 4px;
}

.header-stat-summary {
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.15);
}

.header-stat-summary .header-stat-value {
    background: linear-gradient(135deg,rgb(51, 51, 51) 0%, #f0f9ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
    .header-stats {
        justify-content: flex-start;
    }
}

@media (max-width: 768px) {
    .header-stats-toolbar {
        justify-content: center;
    }

    .header-stats-toggle {
        width: 100%;
        max-width: 420px;
        justify-content: center;
    }

    .header-stats {
        gap: var(--space-3);
        justify-content: flex-start;
    }
    
    .header-stat {
        flex-basis: 150px;
        width: 150px;
        min-height: 150px;
    }
    
    .header-stat-value {
        font-size: 1.2rem;
    }
    
    .header-stat-icon {
        width: 34px;
        height: 34px;
        font-size: 0.85rem;
    }
}

@media (max-width: 480px) {
    .header-stat {
        flex-basis: 140px;
        width: 140px;
        min-height: 145px;
    }
}

            .header-stat-value {
                font-size: 1.35rem;
                font-weight: 800;
                color: black;
                margin-bottom: var(--space-1);
                line-height: 1;
            }

            .header-stat-label {
                color: rgba(38, 38, 38, 0.9);
                font-size: 0.68rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            /* Floating Search Bar */
       .floating-search-container {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--surface-glass);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--glass-border);
    padding: var(--space-4);
    box-shadow: var(--shadow-lg);
}
            .search-inner {
                max-width: 1400px;
                margin: 0 auto;
                display: flex;
                gap: var(--space-4);
                align-items: center;
            }

            .search-wrapper {
                flex: 1;
                position: relative;
            }

            .search-input {
                width: 100%;
                padding: var(--space-4) var(--space-6) var(--space-4) 3.5rem;
                border: 2px solid transparent;
                border-radius: var(--radius-2xl);
                font-size: 1rem;
                font-weight: 500;
                background: var(--surface);
                transition: var(--transition);
                box-shadow: var(--shadow-md);
            }

            .search-input:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 4px var(--primary-glass), var(--shadow-lg);
                transform: translateY(-1px);
            }

            .search-icon {
                position: absolute;
                left: 1.5rem;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted);
                font-size: 1.25rem;
                pointer-events: none;
            }

            .search-shortcuts {
                position: absolute;
                right: 1rem;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                gap: var(--space-2);
            }

            .shortcut-key {
                background: var(--surface-hover);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: var(--space-1) var(--space-2);
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-muted);
            }

            /* Advanced Filter Bar */
    .filter-bar {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    margin-bottom: var(--space-6);
    box-shadow: var(--shadow-md);
    max-width: 1400px;
    margin-left: auto;
    margin-right: auto;
}

.filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
}

            .filter-title {
                font-size: 1.125rem;
                font-weight: 700;
                color: var(--text);
                display: flex;
                align-items: center;
                gap: var(--space-3);
            }

            .filter-quick-actions {
                display: flex;
                gap: var(--space-3);
            }

            .filter-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: var(--space-4);
            }

            .filter-field {
                position: relative;
            }

            .filter-label {
                display: block;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: var(--space-2);
                font-size: 0.875rem;
            }

            .filter-control {
                width: 100%;
                padding: var(--space-3) var(--space-4);
                border: 2px solid var(--border);
                border-radius: var(--radius-lg);
                background: var(--surface);
                font-size: 0.9rem;
                font-weight: 500;
                transition: var(--transition-fast);
                appearance: none;
                cursor: pointer;
            }

            .filter-control:hover {
                border-color: var(--primary-light);
            }

            .filter-control:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px var(--primary-glass);
            }

            /* View Navigation Pills */
            .view-navigation {
                display: flex;
                justify-content: center;
                margin-bottom: var(--space-8);
                position: sticky;
                top: 88px;
                z-index: 90;
                background: var(--surface-glass);
                backdrop-filter: blur(20px);
                padding: var(--space-4) 0;
            }

            .view-pills {
                display: flex;
                background: var(--surface);
                border-radius: var(--radius-2xl);
                padding: var(--space-2);
                gap: var(--space-2);
                box-shadow: var(--shadow-lg);
                overflow-x: auto;
                max-width: 100%;
            }

            .view-pill {
                padding: var(--space-3) var(--space-6);
                border: none;
                background: transparent;
                border-radius: var(--radius-xl);
                cursor: pointer;
                font-weight: 600;
                font-size: 0.9rem;
                color: var(--text-secondary);
                transition: var(--transition-fast);
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: var(--space-2);
                position: relative;
            }

            .view-pill:hover {
                color: var(--primary);
                background: var(--primary-glass);
            }

            .view-pill.active {
                background: var(--gradient-primary);
                color: white;
                box-shadow: var(--shadow-md);
            }

            .view-pill.view-pill-completed:hover {
                color: #047857;
                background: rgba(16, 185, 129, 0.12);
            }

            .view-pill.view-pill-completed.active {
                background: var(--gradient-success);
                color: white;
            }

            .view-pill i {
                font-size: 1.125rem;
            }

            .view-pill-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                background: var(--error);
                color: white;
                font-size: 0.625rem;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: var(--radius-full);
                box-shadow: var(--shadow-sm);
            }

            /* Content Container */
            .content-container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 0 var(--space-8) var(--space-12);
                min-height: 600px;
            }

            /* Modern Metric Cards */
          .metrics-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-6);
}

.metric-card-modern {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    position: relative;
    overflow: hidden;
    transition: var(--transition);
    cursor: pointer;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-light);
}

.metric-card-icon {
    width: 45px;
    height: 45px;
    background: var(--gradient-primary);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
    margin-bottom: var(--space-4);
    box-shadow: var(--shadow-lg);
}

.metric-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
    margin-bottom: var(--space-2);
}

            .metric-card-modern:hover {
                transform: translateY(-4px);
                box-shadow: var(--shadow-xl);
                border-color: var(--primary-light);
            }

            .metric-card-modern::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: var(--gradient-primary);
            }

           
            .metric-card-content {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .metric-value {
                font-size: 1.5rem;
                font-weight: 800;
                color: var(--text);
                line-height: 1;
                margin-bottom: var(--space-2);
            }

            .metric-label {
                font-size: 0.9rem;
                color: var(--text-secondary);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .metric-trend {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                margin-top: var(--space-4);
                padding: var(--space-2) var(--space-3);
                background: var(--surface-alt);
                border-radius: var(--radius);
                width: fit-content;
                font-size: 0.875rem;
                font-weight: 600;
            }

            .metric-trend.positive {
                color: var(--success);
                background: rgba(16, 185, 129, 0.1);
            }

            .metric-trend.negative {
                color: var(--error);
                background: rgba(239, 68, 68, 0.1);
            }

            /* Data Tables Modern */
            .table-modern-container {
                background: var(--surface);
                border-radius: var(--radius-xl);
                overflow: hidden;
                box-shadow: var(--shadow-lg);
                margin-bottom: var(--space-8);
            }

            .table-modern-header {
                background: var(--gradient-primary);
                padding: var(--space-6);
                color: white;
            }

            .table-modern-title {
                font-size: 1.25rem;
                font-weight: 700;
                margin-bottom: var(--space-4);
            }

            .table-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: var(--space-4);
                flex-wrap: wrap;
            }

            .table-search-box {
                position: relative;
                flex: 1;
                min-width: 300px;
            }

            .table-search-input {
                width: 100%;
                padding: var(--space-3) var(--space-4) var(--space-3) 2.5rem;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: var(--radius-lg);
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                color: white;
                font-size: 0.9rem;
                transition: var(--transition-fast);
            }

            .table-search-input::placeholder {
                color: rgba(255, 255, 255, 0.7);
            }

            .table-search-input:focus {
                outline: none;
                border-color: white;
                background: rgba(255, 255, 255, 0.2);
            }

            .table-search-icon {
                position: absolute;
                left: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                color: rgba(255, 255, 255, 0.8);
            }

            .table-actions {
                display: flex;
                gap: var(--space-3);
            }

            .table-body {
                overflow-x: auto;
                max-height: 600px;
                overflow-y: auto;
            }

            .data-table {
                width: 100%;
                border-collapse: collapse;
            }
.data-table th {
    background: var(--surface-alt);
    padding: var(--space-3) var(--space-4);
    text-align: left;
    font-weight: 700;
    color: var(--text);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 2px solid var(--border);
}

.data-table td {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-light);
    color: var(--text);
    font-size: 0.85rem;
}

            .data-table tbody tr {
                transition: var(--transition-fast);
                cursor: pointer;
            }

            .data-table tbody tr:hover {
                background: var(--surface-hover);
            }

            .data-table tbody tr:nth-child(even) {
                background: var(--surface-alt);
            }

            /* Interactive Order Cards */
           .orders-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
}

      .order-card-modern {
    background: var(--surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    transition: var(--transition);
    cursor: pointer;
    position: relative;
    border: 1px solid var(--border-light);
}
    .order-card-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-light);
}

.order-card-body {
    padding: var(--space-4);
}

            .order-card-modern:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: var(--shadow-xl);
                border-color: var(--primary-light);
            }

            .order-card-status-bar {
                height: 6px;
                background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
            }

            .order-card-status-bar.overdue {
                background: var(--gradient-warm);
            }

            .order-card-status-bar.due-today {
                background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
            }

        

            .order-card-number {
                font-size: 1.125rem;
                font-weight: 700;
                color: var(--primary);
                margin-bottom: var(--space-2);
            }

            .order-card-customer {
                font-size: 0.9rem;
                color: var(--text-secondary);
                font-weight: 500;
            }

        
            .order-info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-4);
                margin-bottom: var(--space-6);
            }

            .order-info-item {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .order-info-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .order-info-value {
                font-size: 0.9rem;
                color: var(--text);
                font-weight: 600;
            }

            /* Progress Indicators */
            .progress-container {
                margin-top: var(--space-6);
            }

            .progress-item {
                margin-bottom: var(--space-4);
            }

            .progress-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: var(--space-2);
                font-size: 0.875rem;
            }

            .progress-label {
                font-weight: 600;
                color: var(--text-secondary);
            }

            .progress-value {
                font-weight: 700;
                color: var(--text);
            }

            .progress-bar-modern {
                width: 100%;
                height: 8px;
                background: var(--surface-hover);
                border-radius: var(--radius-full);
                overflow: hidden;
                position: relative;
            }
            
.quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
}

.quick-action-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-light);
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.quick-action-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-xl);
    border-color: var(--primary-light);
}

.quick-action-icon {
    width: 45px;
    height: 45px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
    flex-shrink: 0;
}
.quick-action-content {
    flex: 1;
}

.quick-action-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: var(--space-1);
}

.quick-action-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
}

.quick-action-count {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary);
    background: var(--primary-glass);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    display: inline-block;
}

/* Analytics Cards */
.analytics-card {
    background: var(--surface);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-light);
}

.analytics-header {
    background: var(--surface-alt);
    padding: var(--space-6);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-light);
}

.analytics-header h4 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.analytics-header h4 i {
    color: var(--primary);
}

.analytics-content {
    padding: var(--space-4);
}

.analytics-item {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-fast);
    margin-bottom: var(--space-2);
}
    .search-suggestion.highlighted {
    background: var(--primary-glass) !important;
    color: var(--primary) !important;
}

.analytics-item:hover {
    background: var(--surface-hover);
}

.analytics-item:last-child {
    margin-bottom: 0;
}

.analytics-rank {
    width: 30px;
    height: 30px;
    background: var(--primary-glass);
    color: var(--primary);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
}

.analytics-info {
    flex: 1;
}

.analytics-name {
    font-weight: 600;
    color: var(--text);
    margin-bottom: var(--space-1);
}

.analytics-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.analytics-value {
    font-weight: 700;
    color: var(--primary);
    font-size: 0.9rem;
}

/* Enhanced Metric Cards */
.metric-card-primary {
    border-left: 4px solid var(--primary);
}

.metric-card-warning {
    border-left: 4px solid var(--warning);
}

.metric-card-info {
    border-left: 4px solid var(--info);
}

.metric-card-success {
    border-left: 4px solid var(--success);
}

.metric-card-success::before {
    background: var(--gradient-success);
}

.metric-card-modern .metric-description {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: var(--space-2);
    font-weight: 500;
}

/* Responsive Design for Quick Actions */
@media (max-width: 768px) {
    .quick-actions-grid {
        grid-template-columns: 1fr;
    }
    
    .quick-action-card {
        padding: var(--space-4);
    }
    
    .quick-action-icon {
        width: 50px;
        height: 50px;
        font-size: 1.25rem;
    }
    
    .analytics-card {
        margin-bottom: var(--space-6);
    }
    
    div[style*="grid-template-columns: 1fr 1fr"] {
        grid-template-columns: 1fr !important;
    }
}


            .progress-fill-modern {
                height: 100%;
                background: var(--gradient-primary);
                border-radius: var(--radius-full);
                transition: width 0.5s ease;
                position: relative;
                overflow: hidden;
            }

            .progress-fill-modern::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                animation: shimmer 2s infinite;
            }

            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }

            /* Calendar Modern */
    .calendar-modern {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow-lg);
}
.calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-5);
}
    #customer-type-filter {
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    font-weight: 600;
    color: var(--text);
    transition: var(--transition-fast);
}

#customer-type-filter:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-glass);
}
            .calendar-title {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text);
            }

            .calendar-nav {
                display: flex;
                gap: var(--space-3);
            }

            .calendar-nav-btn {
                padding: var(--space-3) var(--space-6);
                border: 2px solid var(--border);
                background: var(--surface);
                color: var(--text);
                border-radius: var(--radius-lg);
                cursor: pointer;
                transition: var(--transition-fast);
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .calendar-nav-btn:hover {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
                transform: translateY(-1px);
            }

            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 2px;
                background: var(--border-light);
                border-radius: var(--radius-lg);
                overflow: hidden;
            }

            .calendar-day-header {
                background: var(--surface-alt);
                padding: var(--space-4);
                text-align: center;
                font-weight: 700;
                font-size: 0.875rem;
                color: var(--text);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

          .calendar-day {
    background: var(--surface);
    padding: var(--space-3);
    min-height: 80px;
    cursor: pointer;
    transition: var(--transition-fast);
    position: relative;
}

            .calendar-day:hover {
                background: var(--surface-hover);
                z-index: 1;
                box-shadow: var(--shadow-md);
            }

            .calendar-day.other-month {
                background: var(--surface-alt);
                color: var(--text-light);
            }

            .calendar-day.today {
                background: var(--primary-glass);
                border: 2px solid var(--primary);
            }

            .calendar-day-number {
                font-weight: 700;
                font-size: 0.9rem;
                margin-bottom: var(--space-2);
            }

            .calendar-day-events {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .calendar-event {
                background: var(--gradient-primary);
                color: white;
                border-radius: var(--radius);
                padding: 2px 6px;
                font-size: 0.625rem;
                font-weight: 600;
                text-align: center;
            }

            /* Enhanced Modals */
            .modal-backdrop {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .modal-container {
                background: var(--surface);
                margin: 2% auto;
                border-radius: var(--radius-2xl);
                width: 95%;
                max-width: 1200px;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: var(--shadow-2xl);
                animation: slideUp 0.3s ease;
            }

            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(50px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .modal-header {
                background: var(--gradient-primary);
                padding: var(--space-8);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .modal-title {
                font-size: 1.5rem;
                font-weight: 700;
            }

            .modal-close-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 40px;
                height: 40px;
                border-radius: var(--radius-lg);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: var(--transition-fast);
                font-size: 1.5rem;
            }

            .modal-close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .modal-body {
                padding: var(--space-8);
                max-height: 70vh;
                overflow-y: auto;
            }

            /* Floating Action Button */
            .fab-container {
                position: fixed;
                bottom: var(--space-8);
                right: var(--space-8);
                z-index: 100;
            }

            .fab {
                width: 60px;
                height: 60px;
                border-radius: var(--radius-full);
                background: var(--gradient-primary);
                color: white;
                border: none;
                box-shadow: var(--shadow-xl);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                transition: var(--transition);
                position: relative;
            }

            .fab:hover {
                transform: scale(1.1);
                box-shadow: var(--shadow-2xl);
            }

            .fab-menu {
                position: absolute;
                bottom: 70px;
                right: 0;
                display: none;
                flex-direction: column;
                gap: var(--space-3);
            }

            .fab-menu.active {
                display: flex;
            }

            .fab-menu-item {
                background: var(--surface);
                border-radius: var(--radius-lg);
                padding: var(--space-3) var(--space-6);
                box-shadow: var(--shadow-lg);
                white-space: nowrap;
                cursor: pointer;
                transition: var(--transition-fast);
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: var(--space-3);
            }

            .fab-menu-item:hover {
                transform: translateX(-5px);
                background: var(--primary);
                color: white;
            }

            /* Loading States */
            .skeleton {
                background: linear-gradient(90deg, var(--surface-hover) 25%, var(--surface-dark) 50%, var(--surface-hover) 75%);
                background-size: 200% 100%;
                animation: loading 1.5s ease-in-out infinite;
                border-radius: var(--radius);
            }

            @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .skeleton-text {
                height: 1rem;
                margin-bottom: var(--space-2);
            }

            .skeleton-title {
                height: 1.5rem;
                width: 60%;
                margin-bottom: var(--space-4);
            }

            /* Empty States */
            .empty-state {
                text-align: center;
                padding: var(--space-16) var(--space-8);
            }

            .empty-state-icon {
                font-size: 6rem;
                color: var(--text-light);
                margin-bottom: var(--space-6);
            }

            .empty-state-title {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text);
                margin-bottom: var(--space-3);
            }

            .empty-state-message {
                font-size: 1rem;
                color: var(--text-secondary);
                margin-bottom: var(--space-8);
            }

            /* Buttons Modern */
            .btn {
                padding: var(--space-3) var(--space-6);
                border: none;
                border-radius: var(--radius-lg);
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                transition: var(--transition-fast);
                display: inline-flex;
                align-items: center;
                gap: var(--space-2);
                position: relative;
                overflow: hidden;
            }

            .btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                transform: translate(-50%, -50%);
                transition: width 0.3s, height 0.3s;
            }

            .btn:active::before {
                width: 300px;
                height: 300px;
            }

            .btn-primary {
                background: var(--gradient-primary);
                color: white;
                box-shadow: var(--shadow-md);
            }

            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }

            /* Quick Search Button Styles */
            #quick-search-btn {
                position: relative;
                overflow: hidden;
                cursor: pointer;
            }

            #quick-search-btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
            }

            #quick-search-btn:hover::before {
                width: 300px;
                height: 300px;
            }

            #quick-search-btn:active {
                transform: translateY(0) scale(0.98);
            }

            #quick-search-btn kbd {
                font-family: inherit;
                font-weight: 600;
            }

            #gantt-chart-btn {
                position: relative;
                overflow: hidden;
                cursor: pointer;
            }

            #gantt-chart-btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
            }

            #gantt-chart-btn:hover::before {
                width: 300px;
                height: 300px;
            }

            #gantt-chart-btn:active {
                transform: translateY(0) scale(0.98);
            }

            .btn-secondary {
                background: var(--surface);
                color: var(--text);
                border: 2px solid var(--border);
            }

            .btn-secondary:hover {
                background: var(--surface-hover);
                border-color: var(--primary);
                color: var(--primary);
            }

            .btn-ghost {
                background: transparent;
                color: var(--text-secondary);
                padding: var(--space-2) var(--space-4);
            }

            .btn-ghost:hover {
                background: var(--surface-hover);
                color: var(--text);
            }

            .btn-sm {
                padding: var(--space-2) var(--space-4);
                font-size: 0.8rem;
            }

            .btn-lg {
                padding: var(--space-4) var(--space-8);
                font-size: 1rem;
            }

            /* Toast Notifications */
            .toast-container {
                position: fixed;
                bottom: var(--space-8);
                left: var(--space-8);
                z-index: 1100;
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
            }

            .toast {
                background: var(--surface);
                border-radius: var(--radius-lg);
                padding: var(--space-4) var(--space-6);
                box-shadow: var(--shadow-xl);
                display: flex;
                align-items: center;
                gap: var(--space-4);
                min-width: 300px;
                animation: slideInLeft 0.3s ease;
            }

            @keyframes slideInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-50px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .toast-icon {
                font-size: 1.5rem;
            }

            .toast-success .toast-icon {
                color: var(--success);
            }

            .toast-error .toast-icon {
                color: var(--error);
            }

            .toast-info .toast-icon {
                color: var(--info);
            }

            .toast-content {
                flex: 1;
            }

            .toast-title {
                font-weight: 700;
                color: var(--text);
                margin-bottom: var(--space-1);
            }

            .toast-message {
                font-size: 0.875rem;
                color: var(--text-secondary);
            }

            /* Responsive Design */
            @media (max-width: 1024px) {
                .header-title {
                    font-size: 2.5rem;
                }
                
                .metrics-container {
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                }
                
                .filter-grid {
                    grid-template-columns: 1fr;
                }
                
                .view-pills {
                    flex-wrap: wrap;
                }
            }

            @media (max-width: 768px) {
                .header-title {
                    font-size: 2rem;
                }
                
                .header-stats {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .search-inner {
                    flex-direction: column;
                }
                
                .table-toolbar {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .orders-card-grid {
                    grid-template-columns: 1fr;
                }
                
                .calendar-grid {
                    font-size: 0.8rem;
                }
                
                .calendar-day {
                    min-height: 80px;
                    padding: var(--space-2);
                }
                
                .fab {
                    width: 50px;
                    height: 50px;
                    font-size: 1.25rem;
                }
            }

            /* Custom Scrollbar */
            ::-webkit-scrollbar {
                width: 12px;
                height: 12px;
            }

            ::-webkit-scrollbar-track {
                background: var(--surface-alt);
                border-radius: var(--radius);
            }

            ::-webkit-scrollbar-thumb {
                background: var(--primary-light);
                border-radius: var(--radius);
                border: 2px solid var(--surface-alt);
            }

            ::-webkit-scrollbar-thumb:hover {
                background: var(--primary);
            }

            /* Quick Search Modal Styles */
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-30px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            #quick-search-modal .modal-close:hover {
                background: rgba(255,255,255,0.25);
                transform: rotate(90deg);
            }

            #quick-search-input:focus {
                border-color: rgba(255,255,255,0.4);
                box-shadow: 0 0 0 4px rgba(255,255,255,0.15);
            }

            .filter-tab:hover {
                background: rgba(255,255,255,0.2) !important;
                border-color: rgba(255,255,255,0.4) !important;
            }

            .filter-tab.active {
                background: rgba(255,255,255,0.25) !important;
                border-color: rgba(255,255,255,0.4) !important;
                color: white !important;
            }

            .search-result-item {
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-light);
                cursor: pointer;
                transition: all 0.2s;
                animation: slideDown 0.3s ease-out;
            }

            .search-result-item:hover {
                background: var(--surface-alt);
                transform: translateX(4px);
            }

            .search-result-item.selected {
                background: var(--primary-glass) !important;
                border-color: var(--primary) !important;
                box-shadow: 0 4px 12px var(--primary-glass) !important;
            }

            .history-item:hover {
                background: var(--surface-alt);
                transform: translateX(4px);
            }

            #quick-search-results::-webkit-scrollbar {
                width: 8px;
            }

            #quick-search-results::-webkit-scrollbar-track {
                background: var(--border);
            }

            #quick-search-results::-webkit-scrollbar-thumb {
                background: var(--text-muted);
                border-radius: 4px;
            }

            #quick-search-results::-webkit-scrollbar-thumb:hover {
                background: var(--text);
            }

            /* Print Styles */
            @media print {
                .floating-search-container,
                .view-navigation,
                .fab-container,
                .modal-backdrop {
                    display: none !important;
                }
                
                .dashboard-header-section {
                    background: none;
                    color: var(--text);
                }
                
                .header-title,
                .header-subtitle {
                    color: var(--text);
                }
            }

            /* Multi-select Status Filter Styles */
            .multi-select-container {
                position: relative;
                min-width: 200px;
            }

            .multi-select-btn {
                width: 100%;
                padding: var(--space-2) var(--space-4);
                background: rgba(255, 255, 255, 0.95);
                border: 1px solid var(--border);
                border-radius: var(--radius-lg);
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--text-muted);
                text-align: left;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                transition: var(--transition-fast);
                height: 38px;
            }

            .multi-select-btn:hover {
                background: white;
                border-color: var(--primary-light);
            }

            .multi-select-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid var(--border);
                border-radius: var(--radius-lg);
                margin-top: var(--space-2);
                box-shadow: var(--shadow-xl);
                z-index: 1000;
                max-height: 250px;
                overflow-y: auto;
                display: none;
                padding: var(--space-2);
            }

            .multi-select-dropdown.open {
                display: block;
                animation: slideDown 0.2s ease-out;
            }

            .multi-select-option {
                padding: var(--space-2) var(--space-3);
                display: flex;
                align-items: center;
                gap: var(--space-3);
                border-radius: var(--radius);
                cursor: pointer;
                transition: var(--transition-fast);
                font-size: 0.875rem;
                color: var(--text);
            }

            .multi-select-option:hover {
                background: var(--surface-alt);
            }

            .multi-select-option input[type="checkbox"] {
                width: 16px;
                height: 16px;
                cursor: pointer;
                accent-color: var(--primary);
            }

            .multi-select-badge {
                background: var(--primary);
                color: white;
                font-size: 0.75rem;
                padding: 1px 6px;
                border-radius: 999px;
            }
        </style>`).appendTo('head');
    }

    setupLayout() {
        this.page.main.addClass('ultra-modern-dashboard');

        this.container = $(`
            <div class="dashboard-wrapper">
                <!-- Header Section -->
                <div class="dashboard-header-section">
                    <div class="dashboard-header-content">
                        <div class="header-stats-toolbar">
                            <div class="header-stats-toggle" id="header-value-toggle">
                                <button class="stats-toggle-btn active" data-metric="grand_total">Order Value</button>
                                <button class="stats-toggle-btn" data-metric="remaining_amount">Remaining Balance</button>
                            </div>
                            <div class="header-stats-toggle" id="header-count-toggle">
                                <button class="stats-toggle-btn active" data-count-basis="value_range">Value Range</button>
                                <button class="stats-toggle-btn" data-count-basis="delivery_to_today">Delivery to Today</button>
                                <button class="stats-toggle-btn" data-count-basis="created_to_today">Created to Today</button>
                                <button class="stats-toggle-btn" data-count-basis="created_to_delivery">Created to Delivery</button>
                            </div>
                            <button class="on-hold-toggle-btn" id="on-hold-toggle" type="button">
                                <i class="fa fa-pause-circle"></i>
                                On Hold: All Orders
                            </button>
                            <div class="header-stats-toggle" id="header-due-toggle">
                                <button class="stats-toggle-btn" data-due-scope="future">From Today</button>
                                <button class="stats-toggle-btn" data-due-scope="overdue">Overdue</button>
                                <button class="stats-toggle-btn active" data-due-scope="all">All</button>
                            </div>
                        </div>
                        <div class="header-stats" id="header-stats">
                            <!-- Dynamic stats will be loaded here -->
                        </div>
                    </div>
                </div>
                
                <!-- Floating Search Bar -->
                <div class="floating-search-container">
    <div class="search-inner">
        <div class="search-wrapper">
            <i class="fa fa-search search-icon"></i>
            <input type="text" class="search-input" 
                   placeholder="Search orders, customers, sales persons, or any keyword..." 
                   id="global-search">
            <div class="search-shortcuts">
                <span class="shortcut-key">⌘</span>
                <span class="shortcut-key">K</span>
            </div>
            <div class="search-suggestions" id="search-suggestions"></div>
        </div>
        
        <!-- Quick Search Button -->
        <button class="btn btn-primary" id="quick-search-btn" style="background: linear-gradient(135deg, var(--primary) 0%, var(--success) 100%); border: none; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px var(--primary-glass); transition: all 0.2s; margin-right: var(--space-3);">
            <i class="fa fa-search"></i>
            Quick Search
            <kbd style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px;">⌘K</kbd>
        </button>

        <button class="btn btn-primary" id="gantt-chart-btn" style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); border: none; color: white; padding: 10px 18px; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.28); transition: all 0.2s; margin-right: var(--space-3);">
            <i class="fa fa-tasks"></i>
            Gantt Chart
        </button>

        <!-- Add Customer Type Filter Dropdown -->
        <select class="filter-control1" id="customer-type-filter" style="min-width: 140px;height: 40px; margin-right: var(--space-4);">
            <option value="">All Customers</option>
            <option value="internal">Internal Only</option>
            <option value="external">External Only</option>
        </select>

        <button class="btn btn-secondary" id="advanced-search-btn">
            <i class="fa fa-sliders"></i>
            Advanced Search
        </button>
    </div>
</div>
                
                <!-- Filter Bar -->
                <div class="filter-bar" id="filter-bar" style="display: none;">
                    <div class="filter-header">
                        <div class="filter-title">
                            <i class="fa fa-filter"></i>
                            Advanced Filters
                        </div>
                        <div class="filter-quick-actions">
                            <button class="btn btn-ghost btn-sm" id="reset-filters">
                                <i class="fa fa-refresh"></i>
                                Reset
                            </button>
                            <button class="btn btn-ghost btn-sm" id="save-filter">
                                <i class="fa fa-save"></i>
                                Save Filter
                            </button>
                        </div>
                    </div>
                    <div class="filter-grid" id="filter-grid">
                        <!-- Filters will be dynamically added here -->
                    </div>
                    <div class="active-filters" id="active-filters" style="margin-top: var(--space-4); display: none;">
                        <!-- Active filter chips -->
                    </div>
                </div>
                
                <!-- View Navigation -->
                <div class="view-navigation">
                    <div class="view-pills" id="view-pills">
                        <!-- View pills will be dynamically added here -->
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="content-container" id="content-area">
                    <!-- Dynamic content will be loaded here -->
                </div>
                
                <!-- Toast Container -->
                <div class="toast-container" id="toast-container"></div>
            </div>
        `).appendTo(this.page.main);

        this.content_area = this.page.main.find('#content-area');
        this.page.main.on('click', '#header-value-toggle .stats-toggle-btn', (e) => {
            const metric = $(e.currentTarget).data('metric');
            if (!metric || metric === this.header_stat_metric) return;

            this.header_stat_metric = metric;
            this.header_count_basis = 'value_range';
            $('#header-value-toggle .stats-toggle-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
            $('#header-count-toggle .stats-toggle-btn').removeClass('active');
            $('#header-count-toggle .stats-toggle-btn[data-count-basis="value_range"]').addClass('active');
            this.updateHeaderStats();
        });
        this.page.main.on('click', '#header-count-toggle .stats-toggle-btn', (e) => {
            const countBasis = $(e.currentTarget).data('count-basis');
            if (!countBasis || countBasis === this.header_count_basis) return;

            this.header_count_basis = countBasis;
            $('#header-count-toggle .stats-toggle-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
            this.updateHeaderStats();
        });
        this.page.main.on('click', '#header-due-toggle .stats-toggle-btn', (e) => {
            const dueScope = $(e.currentTarget).data('due-scope');
            if (!dueScope || dueScope === this.header_due_scope) return;

            this.header_due_scope = dueScope;
            $('#header-due-toggle .stats-toggle-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
            this.updateHeaderStats();
        });
        this.page.main.on('click', '#on-hold-toggle', () => {
            this.setOnHoldToggle(!this.show_on_hold_only);
            this.applyFilters();
        });
        this.setOnHoldToggle(this.show_on_hold_only);
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        $(document).on('keydown', (e) => {
            // Cmd/Ctrl + K for search focus
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                $('#global-search').focus();
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                $('.modal-backdrop').hide();
                $('#search-suggestions').hide();
            }
        });
    }

    setupFloatingActionButton() {
        const fabHtml = `
            <div class="fab-container">
                <div class="fab-menu" id="fab-menu">
                    <div class="fab-menu-item" data-action="export">
                        <i class="fa fa-download"></i>
                        Export Data
                    </div>
                    <div class="fab-menu-item" data-action="refresh">
                        <i class="fa fa-refresh"></i>
                        Refresh
                    </div>
                    <div class="fab-menu-item" data-action="settings">
                        <i class="fa fa-cog"></i>
                        Settings
                    </div>
                </div>
                <button class="fab" id="fab">
                    <i class="fa fa-plus"></i>
                </button>
            </div>
        `;

        $(fabHtml).appendTo('body');

        $('#fab').on('click', function () {
            $(this).find('i').toggleClass('fa-plus fa-times');
            $('#fab-menu').toggleClass('active');
        });

        $('.fab-menu-item').on('click', (e) => {
            const action = $(e.currentTarget).data('action');
            this.handleFabAction(action);
            $('#fab').click(); // Close menu
        });
    }

    handleFabAction(action) {
        switch (action) {
            case 'export':
                this.exportData();
                break;
            case 'refresh':
                this.loadData();
                this.showToast('Data refreshed successfully', 'success');
                break;
            case 'settings':
                this.showSettingsModal();
                break;
        }
    }

    showToast(message, type = 'info', title = '') {
        const toastId = `toast-${Date.now()}`;
        const toastHtml = `
            <div class="toast toast-${type}" id="${toastId}">
                <div class="toast-icon">
                    <i class="fa ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                </div>
                <div class="toast-content">
                    ${title ? `<div class="toast-title">${title}</div>` : ''}
                    <div class="toast-message">${message}</div>
                </div>
            </div>
        `;

        $('#toast-container').append(toastHtml);

        setTimeout(() => {
            $(`#${toastId}`).fadeOut(300, function () {
                $(this).remove();
            });
        }, 3000);
    }

    setupGlobalSearch() {
        const searchInput = $('#global-search');
        const suggestions = $('#search-suggestions');

        // Style for suggestions dropdown
        suggestions.css({
            position: 'absolute',
            top: '100%',
            left: '0',
            right: '0',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: '1000',
            display: 'none',
            marginTop: 'var(--space-2)'
        });

        // Input event for suggestions and auto-filtering
        searchInput.on('input', (e) => {
            clearTimeout(this.search_timeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                suggestions.hide();
                this.applyGlobalFilter('');
                return;
            }

            this.search_timeout = setTimeout(() => {
                this.showSearchSuggestions(query);
                this.applyGlobalFilter(query);
            }, 300);
        });

        // Add Enter key event for immediate filtering
        searchInput.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if any
                clearTimeout(this.search_timeout); // Cancel any pending timeout

                const query = e.target.value.trim();

                // Hide suggestions dropdown
                suggestions.hide();

                // Apply filter immediately
                if (query.length >= 1) { // Allow even single character search on Enter
                    this.applyGlobalFilter(query);
                    this.showToast(`Filtered by: "${query}"`, 'success');
                } else {
                    this.applyGlobalFilter('');
                    this.showToast('Search filter cleared', 'info');
                }

                // Blur the input to remove focus
                searchInput.blur();
            }

            // Handle Escape key to clear search and hide suggestions
            if (e.key === 'Escape') {
                suggestions.hide();
                searchInput.val('');
                this.applyGlobalFilter('');
                searchInput.blur();
            }

            // Handle Arrow keys for suggestion navigation (optional enhancement)
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateSuggestions(e.key === 'ArrowDown' ? 'down' : 'up');
            }
        });

        // Add customer type filter handler
        $('#customer-type-filter').on('change', () => {
            // Add a small delay to ensure smooth transition
            setTimeout(() => {
                this.applyFilters(); // This will now update header stats
            }, 100);
        });

        $('#advanced-search-btn').on('click', () => {
            $('#filter-bar').slideToggle();
        });

        // Hide suggestions when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.search-wrapper').length) {
                suggestions.hide();
            }
        });

        // Setup keyboard shortcuts for quick search
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        $(document).on('keydown', (e) => {
            // Cmd/Ctrl + K for quick search modal
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.showQuickSearchModal();
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                $('.modal-backdrop').hide();
                $('#search-suggestions').hide();
            }
        });

        // Quick Search button click handler
        $(document).on('click', '#quick-search-btn', (e) => {
            e.preventDefault();
            this.showQuickSearchModal();
        });

        $(document).on('click', '#gantt-chart-btn', (e) => {
            e.preventDefault();
            const company = encodeURIComponent(
                (this.filters && this.filters.company) || 'METROPLUS ADVERTISING LLC'
            );
            window.open(`/app/prd-project-gantt?company=${company}`, '_blank');
        });

        // Add hover effect to quick search button
        $(document).on('mouseenter', '#quick-search-btn', function () {
            $(this).css({
                'transform': 'translateY(-2px)',
                'box-shadow': '0 6px 16px rgba(59, 130, 246, 0.4)'
            });
        }).on('mouseleave', '#quick-search-btn', function () {
            $(this).css({
                'transform': 'translateY(0)',
                'box-shadow': '0 4px 12px rgba(59, 130, 246, 0.3)'
            });
        });

        $(document).on('mouseenter', '#gantt-chart-btn', function () {
            $(this).css({
                'transform': 'translateY(-2px)',
                'box-shadow': '0 6px 16px rgba(37, 99, 235, 0.36)'
            });
        }).on('mouseleave', '#gantt-chart-btn', function () {
            $(this).css({
                'transform': 'translateY(0)',
                'box-shadow': '0 4px 12px rgba(14, 165, 233, 0.28)'
            });
        });
    }

    showHeaderStatsLoading() {
        const loadingHtml = `
        <div class="header-stat">
            <div class="skeleton skeleton-title" style="height: 60px; margin-bottom: var(--space-2);"></div>
            <div class="skeleton skeleton-text" style="height: 20px; margin-bottom: var(--space-2);"></div>
            <div class="skeleton skeleton-text" style="height: 16px; width: 70%;"></div>
        </div>
    `.repeat(6);

        $('#header-stats').html(loadingHtml);
    }

    navigateSuggestions(direction) {
        const suggestions = $('#search-suggestions');
        const items = suggestions.find('.search-suggestion');

        if (!items.length) return;

        let currentIndex = items.index(items.filter('.highlighted'));

        // Remove current highlight
        items.removeClass('highlighted');

        if (direction === 'down') {
            currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
            currentIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        // Add highlight to new item
        const newItem = items.eq(currentIndex);
        newItem.addClass('highlighted');

        // Update search input with highlighted suggestion
        const orderName = newItem.data('order');
        if (orderName) {
            const order = this.all_orders.find(o => o.name === orderName);
            if (order) {
                $('#global-search').val(order.name);
            }
        }
    }
    showSearchSuggestions(query) {
        const suggestions = $('#search-suggestions');
        const lowerQuery = query.toLowerCase();

        const matches = this.all_orders.filter(order =>
            order.name.toLowerCase().includes(lowerQuery) ||
            order.customer.toLowerCase().includes(lowerQuery) ||
            (order.sales_person || '').toLowerCase().includes(lowerQuery) ||
            (order.status || '').toLowerCase().includes(lowerQuery) ||
            (order.project || '').toLowerCase().includes(lowerQuery) ||
            (order.project_description || '').toLowerCase().includes(lowerQuery)
        ).slice(0, 8);

        if (matches.length === 0) {
            suggestions.hide();
            return;
        }

        let html = '';
        matches.forEach(order => {
            html += `
            <div style="padding: var(--space-4); border-bottom: 1px solid var(--border-light); cursor: pointer; transition: var(--transition-fast);"
                 class="search-suggestion" data-order="${order.name}"
                 onmouseover="this.style.background='var(--surface-hover)'"
                 onmouseout="this.style.background='transparent'">
                <div style="font-weight: 600; color: var(--text); margin-bottom: var(--space-1);">${order.name}</div>
                <div style="font-size: 0.875rem; color: var(--text-muted);">
                    ${order.customer} • ${order.sales_person} • ${frappe.format(order.grand_total, { fieldtype: 'Currency' })}
                    ${order.project ? ` • 📋 ${order.project}` : ''}
                </div>
                ${order.project_description ? `
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: var(--space-1);">
                        ${order.project_description.length > 60 ? order.project_description.substring(0, 60) + '...' : order.project_description}
                    </div>
                ` : ''}
            </div>
        `;
        });

        suggestions.html(html).show();

        suggestions.find('.search-suggestion').on('click', (e) => {
            const orderName = $(e.currentTarget).data('order');
            this.showOrderDetails(orderName);
            suggestions.hide();
        });

        // Add Enter key handling for suggestions
        suggestions.find('.search-suggestion').on('keydown', (e) => {
            if (e.key === 'Enter') {
                $(e.currentTarget).click();
            }
        });
    }
    setupFilters() {
        const filtersHtml = `
        <div class="filter-field">
            <label class="filter-label">Customer</label>
            <select class="filter-control" id="customer-filter">
                <option value="">All Customers</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Sales Person</label>
            <select class="filter-control" id="sales-person-filter">
                <option value="">All Sales Persons</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Sales Team</label>
            <select class="filter-control" id="sales-team-filter">
                <option value="">All Sales Teams</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Project</label>
            <select class="filter-control" id="project-filter">
                <option value="">All Projects</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Branch</label>
            <select class="filter-control" id="branch-filter">
                <option value="">All Branches</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Status</label>
            <select class="filter-control" id="status-filter">
                <option value="">All Status</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Payment Type</label>
            <select class="filter-control" id="payment-filter">
                <option value="">All Orders</option>
                <option value="advance">Has Advance</option>
                <option value="progress">Has Progress</option>
                <option value="any">Has Advance or Progress</option>
                <option value="both">Has Both</option>
                <option value="none">No Advance/Progress</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Due Date From</label>
            <input type="date" class="filter-control" id="date-from">
        </div>
        <div class="filter-field">
            <label class="filter-label">Due Date To</label>
            <input type="date" class="filter-control" id="date-to">
        </div>
        <div class="filter-field">
            <label class="filter-label">Quick Filters</label>
            <select class="filter-control" id="quick-filter">
                <option value="">No Filter</option>
                <option value="overdue">🔴 Overdue Orders</option>
                <option value="due-today">🟡 Due Today</option>
                <option value="due-week">🟢 Due This Week</option>
                <option value="high-value">💎 High Value (>20K)</option>
                <option value="on-hold">⏸️ On Hold</option>
                <option value="with-projects">📋 With Projects</option>
                <option value="without-projects">📋 Without Projects</option>
            </select>
        </div>
        <div class="filter-field">
            <label class="filter-label">Order Value Range</label>
            <div style="display: flex; gap: var(--space-2); align-items: center;">
                <input type="number" class="filter-control" id="value-min" placeholder="Min" style="flex: 1;">
                <span style="color: var(--text-muted);">to</span>
                <input type="number" class="filter-control" id="value-max" placeholder="Max" style="flex: 1;">
            </div>
        </div>
    `;

        $('#filter-grid').html(filtersHtml);

        $('.filter-control').on('change', () => {
            this.applyFilters();
        });

        $('#reset-filters').on('click', () => {
            this.clearAllFilters();
        });

        $('#save-filter').on('click', () => {
            this.saveCurrentFilter();
        });
    }
    setupViewSwitcher() {
        const views = [
            { id: 'dashboard', icon: 'fa-dashboard', label: 'Dashboard', badge: '' },
            { id: 'summary', icon: 'fa-chart-pie', label: 'Summary', badge: '' },
            { id: 'completed', icon: 'fa-check-circle', label: 'Completed', badge: '', className: 'view-pill-completed' },
            { id: 'grid', icon: 'fa-th-large', label: 'Grid', badge: '' },
            { id: 'list', icon: 'fa-list-ul', label: 'List', badge: '' },
            { id: 'sales-person', icon: 'fa-user-tie', label: 'Sales Team', badge: '' },
            { id: 'customer', icon: 'fa-building', label: 'Customers', badge: '' },
            { id: 'calendar', icon: 'fa-calendar-alt', label: 'Calendar', badge: '' },
            { id: 'draft-orders', icon: 'fa-list-ul', label: 'Draft Orders', badge: '' },
            { id: 'project-owner', icon: 'fa-user-circle', label: 'Project Owner', badge: '' },
            { id: 'project-overview', icon: 'fa-project-diagram', label: 'Projects', badge: '' },
            { id: 'dispute-overview', icon: 'fa-exclamation-triangle', label: 'Disputes', badge: '' },
            { id: 'issue-overview', icon: 'fa-ticket-alt', label: 'Issues', badge: '' }
        ];


        // Fetch draft order count
        this.fetchDraftOrderCount().then(count => {
            const draftView = views.find(view => view.id === 'draft-orders');
            if (draftView) {
                draftView.badge = count > 0 ? `(${count})` : '';
            }

            let html = '';
            views.forEach((view, index) => {
                html += `
                <button class="view-pill ${view.className || ''} ${index === 0 ? 'active' : ''}" data-view="${view.id}">
                    <i class="fa ${view.icon}"></i>
                    <span>${view.label}</span>
                    ${view.badge ? `<span class="view-pill-badge">${view.badge}</span>` : ''}
                </button>
            `;
            });

            $('#view-pills').html(html);

            $('.view-pill').on('click', (e) => {
                const view = $(e.currentTarget).data('view');
                this.switchView(view);
            });
        });
    }

    // New method to fetch draft order count
    fetchDraftOrderCount() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'prastara_custom.controller.variant_pricing.draft_get_sales_order_list_prd',
                args: {
                    status: 'Draft',
                    company: 'METROPLUS ADVERTISING LLC'
                },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data.orders.length);
                    } else {
                        resolve(0);
                    }
                },
                error: (err) => {
                    this.showToast('Failed to fetch draft order count', 'error');
                    resolve(0);
                }
            });
        });
    }


    // New method to fetch draft order count
    fetchDraftOrderCount() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'prastara_custom.controller.variant_pricing.draft_get_sales_order_list_prd',
                args: {
                    status: 'Draft',
                    company: 'METROPLUS ADVERTISING LLC'
                },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data.orders.length);
                    } else {
                        resolve(0);
                    }
                },
                error: (err) => {
                    this.showToast('Failed to fetch draft order count', 'error');
                    resolve(0);
                }
            });
        });
    }

    setupModals() {
        // Enhanced modal structure
        this.main_modal = $(`
            <div class="modal-backdrop" id="main-modal">
                <div class="modal-container">
                    <div class="modal-header">
                        <h2 class="modal-title">Details</h2>
                        <button class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="skeleton">
                            <div class="skeleton-title"></div>
                            <div class="skeleton-text"></div>
                            <div class="skeleton-text"></div>
                            <div class="skeleton-text"></div>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        this.detail_modal = $(`
            <div class="modal-backdrop" id="detail-modal">
                <div class="modal-container">
                    <div class="modal-header">
                        <h2 class="modal-title">Order Details</h2>
                        <button class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="skeleton">
                            <div class="skeleton-title"></div>
                            <div class="skeleton-text"></div>
                            <div class="skeleton-text"></div>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        $('.modal-close-btn').on('click', (e) => {
            $(e.target).closest('.modal-backdrop').fadeOut(300);
        });

        $('.modal-backdrop').on('click', (e) => {
            if (e.target === e.currentTarget) {
                $(e.currentTarget).fadeOut(300);
            }
        });
    }
    loadData() {
        this.showLoading();
        this.completed_summary_data = null;
        this.completed_summary_loading = false;
        this.completed_summary_request_key = null;

        frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_sales_order_list',
            args: {
                sort_by: this.sort_config.field,
                sort_order: this.sort_config.order
            },
            callback: (r) => {
                if (r.message && r.message.status === 'success') {
                    this.all_orders = r.message.data.orders || [];
                    this.processOrdersData();
                    this.extractFilterOptions();
                    this.populateFilterOptions();
                    this.applyFilters(); // This will now call updateHeaderStats()
                } else {
                    this.showError('Failed to load data');
                }
            },
            error: () => {
                this.showError('Failed to load data');
            }
        });
    }
    updateHeaderStats() {
        const headerModel = this.getHeaderStatsModel();
        const renderMetricAmounts = (orderValue, paymentValue, billedValue, remainingValue) => `
            <div class="header-stat-amount header-stat-amount-order">Order Value: ${frappe.format(orderValue, { fieldtype: 'Currency' })}</div>
            <div class="header-stat-amount header-stat-amount-secondary header-stat-amount-payment">Advance + Progress: ${frappe.format(paymentValue, { fieldtype: 'Currency' })}</div>
            <div class="header-stat-amount header-stat-amount-secondary header-stat-amount-billed">Already Billed: ${frappe.format(billedValue, { fieldtype: 'Currency' })}</div>
            <div class="header-stat-amount header-stat-amount-secondary header-stat-amount-remaining">Remaining: ${frappe.format(remainingValue, { fieldtype: 'Currency' })}</div>
        `;

        const cardsHtml = headerModel.cards.map(card => {
            const rangeData = headerModel.ranges[card.field];
            const iconStyle = card.iconStyle ? ` style="${card.iconStyle}"` : '';

            return `
                <div class="header-stat" data-range="${card.key}">
                    <div class="header-stat-icon"${iconStyle}>
                        <i class="fa ${card.icon || 'fa-shopping-basket'}"></i>
                    </div>
                    <div class="header-stat-content">
                        <div class="header-stat-value">${rangeData.count}</div>
                        <div class="header-stat-label">${card.label}</div>
                        ${renderMetricAmounts(
                rangeData.grandTotal || 0,
                rangeData.paymentTotal || 0,
                rangeData.billedTotal || 0,
                rangeData.remainingTotal || 0
            )}
                    </div>
                </div>
            `;
        }).join('');

        const statsHtml = `
            ${cardsHtml}
            <div class="header-stat header-stat-summary">
                <div class="header-stat-icon" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">
                    <i class="fa ${headerModel.summaryIcon || 'fa-shopping-basket'}"></i>
                </div>
                <div class="header-stat-content">
                    <div class="header-stat-value">${headerModel.scopeOrderCount}</div>
                    <div class="header-stat-label">${headerModel.summaryLabel || 'Total Orders'}</div>
                    ${renderMetricAmounts(
            headerModel.ranges.grandTotal || 0,
            headerModel.ranges.paymentTotal || 0,
            headerModel.ranges.billedTotal || 0,
            headerModel.ranges.remainingTotal || 0
        )}
                </div>
            </div>
        `;

        $('#header-stats').html(statsHtml);
        $('#header-value-toggle .stats-toggle-btn').removeClass('active');
        $(`#header-value-toggle .stats-toggle-btn[data-metric="${this.header_stat_metric}"]`).addClass('active');
        $('#header-count-toggle .stats-toggle-btn').removeClass('active');
        $(`#header-count-toggle .stats-toggle-btn[data-count-basis="${this.header_count_basis}"]`).addClass('active');
        $('#header-due-toggle .stats-toggle-btn').removeClass('active');
        $(`#header-due-toggle .stats-toggle-btn[data-due-scope="${this.header_due_scope}"]`).addClass('active');

        // Add click handlers for drill-down functionality
        $('.header-stat[data-range]').on('click', (e) => {
            const range = $(e.currentTarget).data('range');
            this.showValueRangeOrders(range);
        });
    }
    getHeaderScopeMeta() {
        const validScopes = ['future', 'overdue', 'all'];
        const scope = validScopes.includes(this.header_due_scope) ? this.header_due_scope : 'all';
        this.header_due_scope = scope;

        const labelByScope = {
            future: 'From Today',
            overdue: 'Overdue',
            all: 'All'
        };
        const titleSuffixByScope = {
            future: 'Today Onwards',
            overdue: 'Overdue Delivery Dates',
            all: 'All Delivery Dates'
        };

        return {
            scope,
            label: labelByScope[scope] || 'All',
            titleSuffix: titleSuffixByScope[scope] || 'All Delivery Dates'
        };
    }

    parseOrderDate(value) {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        parsed.setHours(0, 0, 0, 0);
        return parsed;
    }

    getHeaderScopeOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { scope } = this.getHeaderScopeMeta();

        return this.filtered_orders.filter(order => {
            if (scope === 'all') {
                return true;
            }
            const deliveryDate = this.parseOrderDate(order.delivery_date);
            if (!deliveryDate) return false;

            if (scope === 'overdue') {
                return deliveryDate < today;
            }
            return deliveryDate >= today;
        });
    }

    getHeaderStatsModel() {
        const valueRangeCards = [
            { key: 'below-5k', field: 'below5k', label: 'Below AED 5K', title: 'Below AED 5,000', icon: 'fa-shopping-basket' },
            { key: '5k-10k', field: 'range5k10k', label: 'AED 5K - AED 10K', title: 'AED 5,000 - AED 10,000', icon: 'fa-shopping-basket', iconStyle: 'background: linear-gradient(135deg, #d55aa6ff 0%, #c75da5ff 100%);' },
            { key: '10k-25k', field: 'range10k25k', label: 'AED 10K - AED 25K', title: 'AED 10,000 - AED 25,000', icon: 'fa-shopping-basket', iconStyle: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);' },
            { key: '25k-50k', field: 'range25k50k', label: 'AED 25K - AED 50K', title: 'AED 25,000 - AED 50,000', icon: 'fa-shopping-basket', iconStyle: 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);' },
            { key: '50k-100k', field: 'range50k100k', label: 'AED 50K - AED 100K', title: 'AED 50,000 - AED 100,000', icon: 'fa-shopping-basket', iconStyle: 'background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);' },
            { key: 'above-100k', field: 'above100k', label: 'Above AED 100K', title: 'Above AED 100,000', icon: 'fa-shopping-basket', iconStyle: 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);' }
        ];

        const validDateBasis = ['value_range', 'delivery_to_today', 'created_to_today', 'created_to_delivery'];
        const selectedBasis = validDateBasis.includes(this.header_count_basis) ? this.header_count_basis : 'value_range';
        if (selectedBasis !== this.header_count_basis) {
            this.header_count_basis = selectedBasis;
        }
        const scopeMeta = this.getHeaderScopeMeta();

        if (selectedBasis === 'value_range') {
            const ranges = this.calculateValueRangeMetrics(this.header_stat_metric);
            return {
                cards: valueRangeCards,
                ranges,
                titlePrefix: this.header_stat_metric === 'remaining_amount' ? 'Remaining Balance' : 'Order Value',
                summaryLabel: `${scopeMeta.label} Orders`,
                summaryIcon: 'fa-shopping-basket',
                scopeOrderCount: ranges.scopeOrderCount || 0,
                scopeLabel: scopeMeta.label,
                scopeTitleSuffix: scopeMeta.titleSuffix
            };
        }

        const dateRangeCards = [
            { key: 'days-0-10', field: 'range0to10', label: '0 - 10 Days', title: '0 - 10 Days', icon: 'fa-calendar-check-o' },
            { key: 'days-10-30', field: 'range10to30', label: '10 - 30 Days', title: '10 - 30 Days', icon: 'fa-calendar', iconStyle: 'background: linear-gradient(135deg, #d55aa6ff 0%, #c75da5ff 100%);' },
            { key: 'months-1-2', field: 'range30to60', label: '1 - 2 Months', title: '1 - 2 Months', icon: 'fa-calendar-plus-o', iconStyle: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);' },
            { key: 'months-2-3', field: 'range60to90', label: '2 - 3 Months', title: '2 - 3 Months', icon: 'fa-calendar-times-o', iconStyle: 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);' },
            { key: 'months-3-6', field: 'range90to180', label: '3 - 6 Months', title: '3 - 6 Months', icon: 'fa-hourglass-half', iconStyle: 'background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);' },
            { key: 'months-above-6', field: 'rangeAbove180', label: 'Above 6 Months', title: 'Above 6 Months', icon: 'fa-exclamation-circle', iconStyle: 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);' }
        ];

        const titlePrefixByBasis = {
            delivery_to_today: 'Delivery Date to Today',
            created_to_today: 'Created Date to Today',
            created_to_delivery: 'Created Date to Delivery Date'
        };

        const ranges = this.calculateDateRangeMetrics(selectedBasis);
        return {
            cards: dateRangeCards,
            ranges,
            titlePrefix: titlePrefixByBasis[selectedBasis] || 'Date Range',
            summaryLabel: `${scopeMeta.label} Orders`,
            summaryIcon: 'fa-calendar-alt',
            scopeOrderCount: ranges.scopeOrderCount || 0,
            scopeLabel: scopeMeta.label,
            scopeTitleSuffix: scopeMeta.titleSuffix
        };
    }

    calculateDateRangeMetrics(dateBasis = 'delivery_to_today') {
        const scopedOrders = this.getHeaderScopeOrders();
        const ranges = {
            range0to10: { count: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range10to30: { count: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range30to60: { count: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range60to90: { count: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range90to180: { count: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            rangeAbove180: { count: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] }
        };

        const addOrderToRange = (bucket, order, grandTotal, remainingTotal, paymentTotal, billedTotal) => {
            bucket.count++;
            bucket.grandTotal += grandTotal;
            bucket.remainingTotal += remainingTotal;
            bucket.paymentTotal += paymentTotal;
            bucket.billedTotal += billedTotal;
            bucket.orders.push(order);
        };

        scopedOrders.forEach(order => {
            const daysDifference = this.getDaysForHeaderBasis(order, dateBasis);
            if (daysDifference === null) return;

            const grandTotal = this.toNumber(order.grand_total);
            const remainingTotal = this.toNumber(order.remaining_amount);
            const paymentTotal = this.toNumber(order.advance_amount) + this.toNumber(order.progress_amount);
            const billedTotal = this.getAlreadyBilledAmount(order);

            if (daysDifference <= 10) {
                addOrderToRange(ranges.range0to10, order, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (daysDifference <= 30) {
                addOrderToRange(ranges.range10to30, order, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (daysDifference <= 60) {
                addOrderToRange(ranges.range30to60, order, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (daysDifference <= 90) {
                addOrderToRange(ranges.range60to90, order, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (daysDifference <= 180) {
                addOrderToRange(ranges.range90to180, order, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else {
                addOrderToRange(ranges.rangeAbove180, order, grandTotal, remainingTotal, paymentTotal, billedTotal);
            }
        });

        ranges.scopeOrderCount = scopedOrders.length;
        ranges.grandTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order.grand_total), 0);
        ranges.remainingTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order.remaining_amount), 0);
        ranges.paymentTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order.advance_amount) + this.toNumber(order.progress_amount), 0);
        ranges.billedTotal = scopedOrders.reduce((sum, order) => sum + this.getAlreadyBilledAmount(order), 0);
        return ranges;
    }

    getDaysForHeaderBasis(order, dateBasis) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const createdDate = order.date || order.transaction_date;
        const deliveryDate = order.delivery_date;

        if (dateBasis === 'delivery_to_today') {
            return this.getDateDiffInDays(deliveryDate, today);
        }
        if (dateBasis === 'created_to_today') {
            return this.getDateDiffInDays(createdDate, today);
        }

        return this.getDateDiffInDays(createdDate, deliveryDate);
    }

    getDateDiffInDays(fromDate, toDate) {
        if (!fromDate || !toDate) return null;

        const from = new Date(fromDate);
        const to = new Date(toDate);

        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

        from.setHours(0, 0, 0, 0);
        to.setHours(0, 0, 0, 0);

        const diffMs = Math.abs(to.getTime() - from.getTime());
        return Math.floor(diffMs / (1000 * 3600 * 24));
    }

    calculateValueRangeMetrics(metricField = 'grand_total') {
        const scopedOrders = this.getHeaderScopeOrders();
        const selectedMetric = metricField === 'remaining_amount' ? 'remaining_amount' : 'grand_total';
        const ranges = {
            below5k: { count: 0, total: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range5k10k: { count: 0, total: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range10k25k: { count: 0, total: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range25k50k: { count: 0, total: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            range50k100k: { count: 0, total: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] },
            above100k: { count: 0, total: 0, grandTotal: 0, remainingTotal: 0, paymentTotal: 0, billedTotal: 0, orders: [] }
        };

        const addOrderToRange = (bucket, order, selectedValue, grandTotal, remainingTotal, paymentTotal, billedTotal) => {
            bucket.count++;
            bucket.total += selectedValue;
            bucket.grandTotal += grandTotal;
            bucket.remainingTotal += remainingTotal;
            bucket.paymentTotal += paymentTotal;
            bucket.billedTotal += billedTotal;
            bucket.orders.push(order);
        };

        scopedOrders.forEach(order => {
            const grandTotal = this.toNumber(order.grand_total);
            const remainingTotal = this.toNumber(order.remaining_amount);
            const paymentTotal = this.toNumber(order.advance_amount) + this.toNumber(order.progress_amount);
            const billedTotal = this.getAlreadyBilledAmount(order);
            const value = this.toNumber(order[selectedMetric]);

            if (value < 5000) {
                addOrderToRange(ranges.below5k, order, value, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (value >= 5000 && value < 10000) {
                addOrderToRange(ranges.range5k10k, order, value, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (value >= 10000 && value < 25000) {
                addOrderToRange(ranges.range10k25k, order, value, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (value >= 25000 && value < 50000) {
                addOrderToRange(ranges.range25k50k, order, value, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (value >= 50000 && value < 100000) {
                addOrderToRange(ranges.range50k100k, order, value, grandTotal, remainingTotal, paymentTotal, billedTotal);
            } else if (value >= 100000) {
                addOrderToRange(ranges.above100k, order, value, grandTotal, remainingTotal, paymentTotal, billedTotal);
            }
        });

        ranges.selectedMetric = selectedMetric;
        ranges.scopeOrderCount = scopedOrders.length;
        ranges.selectedMetricTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order[selectedMetric]), 0);
        ranges.grandTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order.grand_total), 0);
        ranges.remainingTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order.remaining_amount), 0);
        ranges.paymentTotal = scopedOrders.reduce((sum, order) => sum + this.toNumber(order.advance_amount) + this.toNumber(order.progress_amount), 0);
        ranges.billedTotal = scopedOrders.reduce((sum, order) => sum + this.getAlreadyBilledAmount(order), 0);

        return ranges;
    }

    // Add this new method to show orders for a specific value range
    showValueRangeOrders(range) {
        const headerModel = this.getHeaderStatsModel();
        const matchedCard = headerModel.cards.find(card => card.key === range);
        if (!matchedCard) return;

        const rangeData = headerModel.ranges[matchedCard.field];
        const orders = rangeData?.orders || [];
        const title = `${headerModel.titlePrefix}: ${matchedCard.title || matchedCard.label} (${headerModel.scopeTitleSuffix || headerModel.scopeLabel || ''})`;

        if (orders.length > 0) {
            this.showOrdersModal(orders, title);
        } else {
            this.showToast(`No orders found in ${title.toLowerCase()}`, 'info');
        }
    }

    renderView() {
        switch (this.current_view) {
            case 'dashboard':
                this.renderModernDashboard();
                break;
            case 'summary':
                this.renderModernSummary();
                break;
            case 'completed':
                this.renderCompletedSummary();
                break;
            case 'grid':
                this.renderModernGrid();
                break;
            case 'list':
                this.renderModernList();
                break;
            case 'sales-person':
                this.renderModernSalesPersonView();
                break;
            case 'customer':
                this.renderModernCustomerView();
                break;
            case 'calendar':
                this.renderModernCalendar();
                break;
            case 'draft-orders':
                this.renderDraftOrdersTable();
                break;
            case 'project-owner':
                this.renderProjectOwnerView();
                break;
            case 'project-overview':
                this.renderProjectOverviewTable();
                break;
            case 'dispute-overview':
                this.renderDisputeOverviewTable();
                break;
            case 'issue-overview':
                this.renderIssueOverviewTable();
                break;
        }
    }

    renderModernDashboard() {
        const summary = this.data.summary;
        const valueRanges = this.calculateValueRangeMetrics();
        const renderSplitAmounts = (orderValue, remainingValue) => `
            <div style="margin-top: var(--space-2); display: flex; flex-direction: column; gap: 4px;">
                <div style="display: inline-flex; align-items: center; width: fit-content; max-width: 100%; font-size: 0.76rem; font-weight: 700; color: #9d174d; background: rgba(213, 90, 166, 0.16); border: 1px solid rgba(213, 90, 166, 0.38); border-radius: 999px; padding: 3px 8px;">
                    Order Value: <strong style="color: #9d174d; margin-left: 4px;">${frappe.format(orderValue || 0, { fieldtype: 'Currency' })}</strong>
                </div>
                <div style="display: inline-flex; align-items: center; width: fit-content; max-width: 100%; font-size: 0.76rem; font-weight: 700; color: #1e3a8a; background: rgba(59, 130, 246, 0.16); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 999px; padding: 3px 8px;">
                    Remaining: <strong style="color: #1e3a8a; margin-left: 4px;">${frappe.format(remainingValue || 0, { fieldtype: 'Currency' })}</strong>
                </div>
            </div>
        `;

        const html = `
        <!-- Value Range Overview Cards -->
        <div class="metrics-container" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4);">
            <div class="metric-card-modern metric-card-primary" data-drill="all" style="cursor: pointer; padding: var(--space-4);">
                <div class="metric-card-icon">
                    <i class="fa fa-chart-bar"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value" style="font-size: 1.8rem;">${summary.total_orders}</div>
                    <div class="metric-label">Total Active Orders</div>
                    ${renderSplitAmounts(summary.total_value, summary.total_remaining)}
                    <div class="metric-description">Click to view all active orders</div>
                </div>
            </div>
            
            <div class="metric-card-modern metric-card-warning" data-drill="overdue" style="cursor: pointer; padding: var(--space-4);">
                <div class="metric-card-icon">
                    <i class="fa fa-exclamation-triangle"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value" style="font-size: 1.8rem;">${summary.overdue_count}</div>
                    <div class="metric-label">Overdue Orders</div>
                    ${renderSplitAmounts(summary.overdue_value, summary.overdue_remaining)}
                    <div class="metric-description">Click to view overdue orders</div>
                </div>
            </div>
            
            <div class="metric-card-modern metric-card-info" data-drill="due-today" style="cursor: pointer; padding: var(--space-4);">
                <div class="metric-card-icon">
                    <i class="fa fa-clock"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value" style="font-size: 1.8rem;">${summary.due_today_count}</div>
                    <div class="metric-label">Due Today</div>
                    ${renderSplitAmounts(summary.due_today_value, summary.due_today_remaining)}
                    <div class="metric-description">Click to view today's deliveries</div>
                </div>
            </div>

            <div class="metric-card-modern metric-card-info" data-drill="due-week" style="cursor: pointer; padding: var(--space-4);">
                <div class="metric-card-icon" style="background: var(--gradient-success);">
                    <i class="fa fa-calendar"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value" style="font-size: 1.8rem;">${summary.due_week_count}</div>
                    <div class="metric-label">Due This Week</div>
                    ${renderSplitAmounts(summary.due_week_value, summary.due_week_remaining)}
                    <div class="metric-description">Click to view this week's deliveries</div>
                </div>
            </div>

            <div class="metric-card-modern metric-card-info" data-drill="due-month" style="cursor: pointer; padding: var(--space-4);">
                <div class="metric-card-icon" style="background: var(--gradient-cool);">
                    <i class="fa fa-calendar-alt"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value" style="font-size: 1.8rem;">${summary.due_month_count}</div>
                    <div class="metric-label">Due This Month</div>
                    ${renderSplitAmounts(summary.due_month_value, summary.due_month_remaining)}
                    <div class="metric-description">Click to view this month's deliveries</div>
                </div>
            </div>
        </div>
        
        <!-- Quick Action Cards -->
        <div class="quick-actions-section" style="margin: var(--space-10) 0;">
            <h3 style="color: var(--text); margin-bottom: var(--space-6); text-align: center; font-size: 1.5rem; font-weight: 700;">
                Quick Actions
            </h3>
            <div class="quick-actions-grid">
                <div class="quick-action-card" data-action="high-priority">
                    <div class="quick-action-icon" style="background: var(--gradient-warm);">
                        <i class="fa fa-fire"></i>
                    </div>
                    <div class="quick-action-content">
                        <div class="quick-action-title">High Priority</div>
                        <div class="quick-action-subtitle">View overdue & high-value orders</div>
                        <div class="quick-action-count">${summary.overdue_count + valueRanges.above100k.count} orders</div>
                    </div>
                </div>
                
                <div class="quick-action-card" data-action="pending-billing">
                    <div class="quick-action-icon" style="background: var(--gradient-primary);">
                        <i class="fa fa-credit-card"></i>
                    </div>
                    <div class="quick-action-content">
                        <div class="quick-action-title">Pending Billing</div>
                        <div class="quick-action-subtitle">Orders ready for invoicing</div>
                        <div class="quick-action-count">${frappe.format(summary.total_remaining, { fieldtype: 'Currency' })}</div>
                    </div>
                </div>
                
                <div class="quick-action-card" data-action="today-delivery">
                    <div class="quick-action-icon" style="background: var(--gradient-success);">
                        <i class="fa fa-truck"></i>
                    </div>
                    <div class="quick-action-content">
                        <div class="quick-action-title">Today's Deliveries</div>
                        <div class="quick-action-subtitle">Scheduled for delivery today</div>
                        <div class="quick-action-count">${summary.due_today_count} orders</div>
                    </div>
                </div>
                
                <div class="quick-action-card" data-action="sales-performance">
                    <div class="quick-action-icon" style="background: var(--gradient-cool);">
                        <i class="fa fa-users"></i>
                    </div>
                    <div class="quick-action-content">
                        <div class="quick-action-title">Sales Performance</div>
                        <div class="quick-action-subtitle">Team performance overview</div>
                        <div class="quick-action-count">${this.data.by_sales_person.length} sales persons</div>
                    </div>
                </div>
            </div>
        </div>
        
        ${this.renderSimplifiedAnalytics()}
    `;

        this.content_area.html(html);
        this.setupDashboardHandlers();
        this.setupQuickActionHandlers();
        this.initializeSalesTeamPerformanceDetailsSection();
    }

    // Add this new method for simplified analytics
    renderSimplifiedAnalytics() {
        const topCustomers = this.data.by_customer.slice(0, 5);
        const topSalesPersons = this.data.by_sales_person.slice(0, 5);

        return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); margin-top: var(--space-10);">
            <!-- Top Customers -->
            <div class="analytics-card">
                <div class="analytics-header">
                    <h4><i class="fa fa-building"></i> Top Customers</h4>
                    <button class="btn btn-ghost btn-sm" data-action="view-all-customers">View All</button>
                </div>
                <div class="analytics-content">
                    ${topCustomers.map((customer, index) => `
                        <div class="analytics-item" data-customer="${customer.name}">
                            <div class="analytics-rank">${index + 1}</div>
                            <div class="analytics-info">
                                <div class="analytics-name">${customer.name}</div>
                                <div class="analytics-meta">${customer.orders.length} orders</div>
                            </div>
                            <div class="analytics-value">${frappe.format(customer.total_value, { fieldtype: 'Currency' })}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Top Sales Persons -->
            <div class="analytics-card">
                <div class="analytics-header">
                    <h4><i class="fa fa-user-tie"></i> Top Sales Persons</h4>
                    <button class="btn btn-ghost btn-sm" data-action="view-all-salespersons">View All</button>
                </div>
                <div class="analytics-content">
                    ${topSalesPersons.map((sp, index) => `
                        <div class="analytics-item" data-salesperson="${sp.name}">
                            <div class="analytics-rank">${index + 1}</div>
                            <div class="analytics-info">
                                <div class="analytics-name">${sp.name}</div>
                                <div class="analytics-meta">${sp.orders.length} orders • ${sp.efficiency_score.toFixed(0)}</div>
                            </div>
                            <div class="analytics-value">${frappe.format(sp.total_value, { fieldtype: 'Currency' })}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div class="table-modern-container" style="margin-top: var(--space-8);">
            <div class="table-modern-header" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                <div class="table-modern-title">Sales Team Performance Details</div>
                <div style="display: flex; align-items: end; gap: var(--space-3); flex-wrap: wrap;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #dbdbdb; margin-bottom: 4px;">Quick Range</label>
                        <select id="team-performance-range-preset" class="table-search-input" style="min-width: 160px;">
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="this_year">This Year</option>
                            <option value="this_week">This Week</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #dbdbdb; margin-bottom: 4px;">From Date</label>
                        <input type="date" id="team-performance-from-date" class="table-search-input" style="min-width: 150px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #dbdbdb; margin-bottom: 4px;">To Date</label>
                        <input type="date" id="team-performance-to-date" class="table-search-input" style="min-width: 150px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #dbdbdb; margin-bottom: 4px;">Sales Person</label>
                        <select id="team-performance-sales-person" class="table-search-input" style="min-width: 180px;">
                            <option value="">All Sales Persons</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #dbdbdb; margin-bottom: 4px;">Sales Team</label>
                        <select id="team-performance-sales-team" class="table-search-input" style="min-width: 180px;">
                            <option value="">All Sales Teams</option>
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm" id="team-performance-apply-dates">
                        <i class="fa fa-filter"></i>
                        Apply
                    </button>
                    <button class="btn btn-default btn-sm" id="team-performance-export">
                        <i class="fa fa-download"></i>
                        Export
                    </button>
                </div>
            </div>
            <div class="table-body" style="overflow-x: auto;">
                <table class="data-table" id="team-performance-details-table" style="min-width: 1520px;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; z-index: 3; background: var(--surface-elevated, #ffffff); min-width: 240px; box-shadow: 2px 0 0 var(--border-light);">Sales Person</th>
                            <th>Team</th>
                            <th>Target</th>
                            <th>Actual Sales</th>
                            <th>Remaining to Bill</th>
                            <th>Expected Sale</th>
                            <th>Actual %</th>
                            <th>Expected %</th>
                            <th>Shortage Sales</th>
                            <th>Shortage Sale %</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="10" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                                <i class="fa fa-spinner fa-spin"></i> Loading sales team performance...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    }

    getTeamPerformanceDefaultDates() {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        return {
            fromDate: frappe.datetime.obj_to_str(monthStart),
            toDate: frappe.datetime.obj_to_str(today)
        };
    }

    getTeamPerformancePresetDates(preset) {
        const today = new Date();
        let fromDate = new Date(today);
        let toDate = new Date(today);

        switch (preset) {
            case 'this_week': {
                const weekDay = today.getDay();
                const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
                fromDate = new Date(today);
                fromDate.setDate(today.getDate() + mondayOffset);
                break;
            }
            case 'last_month':
                fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                toDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'this_year':
                fromDate = new Date(today.getFullYear(), 0, 1);
                break;
            case 'this_month':
            default:
                fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
        }

        return {
            fromDate: frappe.datetime.obj_to_str(fromDate),
            toDate: frappe.datetime.obj_to_str(toDate)
        };
    }

    applyTeamPerformanceTableFilters(rows) {
        const salesPersonFilter = (this.content_area.find('#team-performance-sales-person').val() || '').trim();
        const salesTeamFilter = (this.content_area.find('#team-performance-sales-team').val() || '').trim();

        return rows.filter((row) => {
            const personMatches = !salesPersonFilter || (row.sales_person || '') === salesPersonFilter;
            const teamMatches = !salesTeamFilter || (row.sales_team || '') === salesTeamFilter;
            return personMatches && teamMatches;
        });
    }

    populateTeamPerformanceFilterOptions(rows) {
        const salesPersonSelect = this.content_area.find('#team-performance-sales-person');
        const salesTeamSelect = this.content_area.find('#team-performance-sales-team');
        if (!salesPersonSelect.length || !salesTeamSelect.length) return;
        const escapeHtml = (value) => $('<div/>').text(value || '').html();

        const selectedPerson = (salesPersonSelect.val() || '').trim();
        const selectedTeam = (salesTeamSelect.val() || '').trim();

        const salesPersons = [...new Set(
            rows
                .map(row => (row.sales_person || '').trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        const salesTeams = [...new Set(
            rows
                .map(row => (row.sales_team || '').trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        const personOptions = ['<option value="">All Sales Persons</option>'].concat(
            salesPersons.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        );
        salesPersonSelect.html(personOptions.join(''));
        if (selectedPerson && salesPersons.includes(selectedPerson)) {
            salesPersonSelect.val(selectedPerson);
        }

        const teamOptions = ['<option value="">All Sales Teams</option>'].concat(
            salesTeams.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        );
        salesTeamSelect.html(teamOptions.join(''));
        if (selectedTeam && salesTeams.includes(selectedTeam)) {
            salesTeamSelect.val(selectedTeam);
        }
    }

    initializeSalesTeamPerformanceDetailsSection() {
        const fromInput = this.content_area.find('#team-performance-from-date');
        const toInput = this.content_area.find('#team-performance-to-date');
        const applyBtn = this.content_area.find('#team-performance-apply-dates');
        const exportBtn = this.content_area.find('#team-performance-export');
        const presetSelect = this.content_area.find('#team-performance-range-preset');
        const salesPersonSelect = this.content_area.find('#team-performance-sales-person');
        const salesTeamSelect = this.content_area.find('#team-performance-sales-team');

        if (!fromInput.length || !toInput.length || !applyBtn.length) return;

        const defaults = this.getTeamPerformanceDefaultDates();
        fromInput.val(defaults.fromDate);
        toInput.val(defaults.toDate);
        if (presetSelect.length) presetSelect.val('this_month');

        const renderFilteredTable = () => {
            const allRows = Array.isArray(this.team_performance_details_rows) ? this.team_performance_details_rows : [];
            const filteredRows = this.applyTeamPerformanceTableFilters(allRows);
            this.team_performance_filtered_rows = filteredRows;
            this.renderSalesTeamPerformanceDetailsTable(filteredRows);
        };

        const loadTable = () => {
            const fromDate = (fromInput.val() || '').trim();
            const toDate = (toInput.val() || '').trim();
            const tbody = this.content_area.find('#team-performance-details-table tbody');

            if (!fromDate || !toDate) {
                this.showToast('Please select both From Date and To Date', 'error');
                return;
            }
            this.team_performance_from_date = fromDate;
            this.team_performance_to_date = toDate;

            tbody.html(`
                <tr>
                    <td colspan="10" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-spinner fa-spin"></i> Loading sales team performance...
                    </td>
                </tr>
            `);

            this.fetchSalesTeamPerformanceDetails(fromDate, toDate).then(rows => {
                this.team_performance_details_rows = rows;
                this.populateTeamPerformanceFilterOptions(rows);
                renderFilteredTable();
            });
        };

        applyBtn.off('click').on('click', loadTable);
        exportBtn.off('click').on('click', () => {
            this.exportTeamPerformanceDetailsTable();
        });
        salesPersonSelect.off('change').on('change', renderFilteredTable);
        salesTeamSelect.off('change').on('change', renderFilteredTable);

        fromInput.off('change').on('change', () => {
            if (presetSelect.length) presetSelect.val('custom');
        });
        toInput.off('change').on('change', () => {
            if (presetSelect.length) presetSelect.val('custom');
        });

        presetSelect.off('change').on('change', () => {
            const preset = (presetSelect.val() || '').trim();
            if (!preset || preset === 'custom') return;
            const range = this.getTeamPerformancePresetDates(preset);
            fromInput.val(range.fromDate);
            toInput.val(range.toDate);
            loadTable();
        });

        loadTable();
    }

    exportTeamPerformanceDetailsTable() {
        const rows = Array.isArray(this.team_performance_filtered_rows)
            ? this.team_performance_filtered_rows
            : [];

        if (!rows.length) {
            this.showToast('No rows available to export', 'warning');
            return;
        }

        const headers = [
            'Sales Person',
            'Team',
            'Target',
            'Actual Sales',
            'Remaining to Bill',
            'Expected Sale',
            'Actual %',
            'Expected %',
            'Shortage Sales',
            'Shortage Sale %'
        ];

        const csvEscape = (value) => {
            const str = String(value ?? '');
            return `"${str.replace(/"/g, '""')}"`;
        };

        const csvRows = [headers.map(csvEscape).join(',')];

        rows.forEach((row) => {
            const target = this.toNumber(row.total_target);
            const actualSales = this.toNumber(row.total_sales);
            const remainingToBill = Math.max(this.toNumber(row.remaining_to_bill ?? row.remainingToBill ?? 0), 0);
            const expectedSale = actualSales + remainingToBill;
            const actualPercent = target > 0 ? (actualSales / target) * 100 : 0;
            const expectedPercent = target > 0 ? (expectedSale / target) * 100 : 0;
            const shortageSales = expectedSale < target ? (target - expectedSale) : 0;
            const shortagePercent = expectedSale < target ? Math.max(100 - expectedPercent, 0) : 0;

            csvRows.push([
                row.sales_person || '',
                row.sales_team || '',
                target.toFixed(2),
                actualSales.toFixed(2),
                remainingToBill.toFixed(2),
                expectedSale.toFixed(2),
                actualPercent.toFixed(1),
                expectedPercent.toFixed(1),
                shortageSales.toFixed(2),
                shortagePercent.toFixed(1)
            ].map(csvEscape).join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fromDate = (this.team_performance_from_date || '').replace(/-/g, '');
        const toDate = (this.team_performance_to_date || '').replace(/-/g, '');
        link.href = url;
        link.download = `sales_team_performance_${fromDate || 'from'}_${toDate || 'to'}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    fetchSalesTeamPerformanceDetails(fromDate, toDate) {
        return new Promise((resolve) => {
            frappe.call({
                method: 'prastara_custom.controller.variant_pricing.get_sales_data',
                args: {
                    filters: JSON.stringify({
                        from_date: fromDate,
                        to_date: toDate,
                        company: 'METROPLUS ADVERTISING LLC'
                    })
                },
                callback: (r) => {
                    const rows = Array.isArray(r?.message) ? r.message : [];
                    const filteredRows = rows.filter(row => row && row.sales_person && row.sales_person !== 'Total');
                    resolve(filteredRows);
                },
                error: (err) => {
                    this.showToast('Failed to load sales team performance details', 'error');
                    resolve([]);
                }
            });
        });
    }

    renderSalesTeamPerformanceDetailsTable(rows) {
        const tbody = this.content_area.find('#team-performance-details-table tbody');
        if (!tbody.length) return;

        if (!rows.length) {
            tbody.html(`
                <tr>
                    <td colspan="10" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        No sales team performance data found for the selected date range.
                    </td>
                </tr>
            `);
            return;
        }

        const escapeHtml = (value) => $('<div/>').text(value || '').html();
        const sortedRows = [...rows].sort((a, b) => {
            const aTarget = this.toNumber(a.total_target);
            const bTarget = this.toNumber(b.total_target);
            const aSales = this.toNumber(a.total_sales);
            const bSales = this.toNumber(b.total_sales);
            const aPct = aTarget > 0 ? (aSales / aTarget) * 100 : 0;
            const bPct = bTarget > 0 ? (bSales / bTarget) * 100 : 0;
            return bPct - aPct;
        });

        const rowsHtml = sortedRows.map(row => {
            const salesPerson = escapeHtml(row.sales_person || 'Unknown');
            const team = escapeHtml(row.sales_team || 'No Team');
            const imageSrc = escapeHtml(row.employee_image || '/assets/frappe/images/default-avatar.png');
            const target = this.toNumber(row.total_target);
            const actualSales = this.toNumber(row.total_sales);
            const remainingToBill = Math.max(
                this.toNumber(row.remaining_to_bill ?? row.remainingToBill ?? 0),
                0
            );
            const expectedSale = actualSales + remainingToBill;
            const actualPercent = target > 0 ? (actualSales / target) * 100 : 0;
            const expectedPercent = target > 0 ? (expectedSale / target) * 100 : 0;
            const shortageSales = expectedSale < target ? (target - expectedSale) : 0;
            const shortagePercent = expectedSale < target ? Math.max(100 - expectedPercent, 0) : 0;

            const actualPercentColor = actualPercent >= 100
                ? '#059669'
                : actualPercent >= 70
                    ? '#2563eb'
                    : actualPercent >= 40
                        ? '#d97706'
                        : '#dc2626';

            return `
                <tr>
                    <td style="position: sticky; left: 0; z-index: 2; background: var(--surface, #ffffff); min-width: 240px; box-shadow: 2px 0 0 var(--border-light);">
                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                            <img src="${imageSrc}"
                                 alt="${salesPerson}"
                                 style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-light);"
                                 onerror="this.src='/assets/frappe/images/default-avatar.png'">
                            <span style="font-weight: 600;">${salesPerson}</span>
                        </div>
                    </td>
                    <td>${team}</td>
                    <td>${frappe.format(target, { fieldtype: 'Currency' })}</td>
                    <td>${frappe.format(actualSales, { fieldtype: 'Currency' })}</td>
                    <td>${frappe.format(remainingToBill, { fieldtype: 'Currency' })}</td>
                    <td>${frappe.format(expectedSale, { fieldtype: 'Currency' })}</td>
                    <td>
                        <span style="font-weight: 700; color: ${actualPercentColor};">${actualPercent.toFixed(1)}%</span>
                    </td>
                    <td><span style="font-weight: 700; color: #1d4ed8;">${expectedPercent.toFixed(1)}%</span></td>
                    <td><span style="font-weight: 700; color: #dc2626;">${frappe.format(shortageSales, { fieldtype: 'Currency' })}</span></td>
                    <td><span style="font-weight: 700; color: #dc2626;">${shortagePercent.toFixed(1)}%</span></td>
                </tr>
            `;
        }).join('');

        tbody.html(rowsHtml);
    }

    // Add these new handlers
    setupQuickActionHandlers() {
        $('.quick-action-card').on('click', (e) => {
            const action = $(e.currentTarget).data('action');
            this.handleQuickAction(action);
        });
    }

    handleQuickAction(action) {
        switch (action) {
            case 'high-priority':
                const highPriorityOrders = this.filtered_orders.filter(order =>
                    order.due_days < 0 || parseFloat(order.grand_total) > 100000
                );
                this.showOrdersModal(highPriorityOrders, 'High Priority Orders');
                break;

            case 'pending-billing':
                const pendingBillingOrders = this.filtered_orders.filter(order =>
                    parseFloat(order.remaining_amount || 0) > 0
                );
                this.showOrdersModal(pendingBillingOrders, 'Orders with Pending Billing');
                break;

            case 'today-delivery':
                const todayOrders = this.filtered_orders.filter(order => order.due_days === 0);
                this.showOrdersModal(todayOrders, "Today's Deliveries");
                break;

            case 'sales-performance':
                this.switchView('sales-person');
                break;
        }
    }
    renderMetricCard(label, value, icon, color, drill) {
        return `
            <div class="metric-card-modern" data-drill="${drill}">
                <div class="metric-card-icon" style="background: var(--gradient-${color === 'primary' ? 'primary' : color === 'warning' ? 'warm' : color === 'error' ? 'warm' : 'cool'});">
                    <i class="fa ${icon}"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value">${value}</div>
                    <div class="metric-label">${label}</div>
                    ${this.getMetricTrend(drill)}
                </div>
            </div>
        `;
    }

    getMetricTrend(type) {
        // Simulated trend data - you can replace with actual calculations
        const trends = {
            'all': { value: '+12%', positive: true },
            'balance-to-bill': { value: '-5%', positive: true },
            'overdue': { value: '+3', positive: false },
            'due-today': { value: '0', positive: null },
            'high-value': { value: '+8%', positive: true },
            'on-hold': { value: '-2', positive: true }
        };

        const trend = trends[type] || { value: '0', positive: null };
        if (trend.positive === null) return '';

        return `
            <div class="metric-trend ${trend.positive ? 'positive' : 'negative'}">
                <i class="fa fa-arrow-${trend.positive ? 'up' : 'down'}"></i>
                ${trend.value} from last week
            </div>
        `;
    }

    renderStatusAnalytics() {
        const statusData = this.data.by_status;

        return `
            <div class="table-modern-container">
                <div class="table-modern-header">
                    <div class="table-modern-title">Order Status Analytics</div>
                    <div class="table-toolbar">
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon"></i>
                            <input type="text" class="table-search-input" placeholder="Search status..." id="status-search">
                        </div>
                        <div class="table-actions">
                            <button class="btn btn-ghost btn-sm">
                                <i class="fa fa-download"></i>
                                Export
                            </button>
                        </div>
                    </div>
                </div>
                <div class="table-body">
                    <table class="data-table" id="status-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Orders</th>
                                <th>Total Value</th>
                                <th>Percentage</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${statusData.map(status => `
                                <tr data-status="${status.name}">
                                    <td><strong>${status.name}</strong></td>
                                    <td>${status.count}</td>
                                    <td><strong>${frappe.format(status.total_value, { fieldtype: 'Currency' })}</strong></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                                            <div class="progress-bar-modern" style="flex: 1;">
                                                <div class="progress-fill-modern" style="width: ${status.percentage}%"></div>
                                            </div>
                                            <span>${status.percentage.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <button class="btn btn-primary btn-sm" data-action="view-status-orders" data-status="${status.name}">
                                            View Orders
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderTimelineAnalytics() {
        const timelineData = this.data.by_delivery_date;

        return `
            <div class="table-modern-container" style="margin-top: var(--space-8);">
                <div class="table-modern-header">
                    <div class="table-modern-title">Delivery Timeline Analysis</div>
                    <div class="table-toolbar">
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon"></i>
                            <input type="text" class="table-search-input" placeholder="Search timeline..." id="timeline-search">
                        </div>
                    </div>
                </div>
                <div class="table-body">
                    <table class="data-table" id="timeline-table">
                        <thead>
                            <tr>
                                <th>Timeline</th>
                                <th>Orders</th>
                                <th>Total Value</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${timelineData.map(timeline => `
                                <tr data-timeline="${timeline.name}">
                                    <td>
                                        <strong>${timeline.name}</strong>
                                        ${this.getTimelineBadge(timeline.name)}
                                    </td>
                                    <td>${timeline.count}</td>
                                    <td><strong>${frappe.format(timeline.total_value, { fieldtype: 'Currency' })}</strong></td>
                                    <td>
                                        <button class="btn btn-primary btn-sm" data-action="view-timeline-orders" data-timeline="${timeline.name}">
                                            View Orders
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    getTimelineBadge(timeline) {
        const badges = {
            'Overdue': '<span style="display: inline-block; margin-left: var(--space-2); padding: 2px 8px; background: var(--error); color: white; border-radius: var(--radius); font-size: 0.75rem; font-weight: 600;">Urgent</span>',
            'Due Today': '<span style="display: inline-block; margin-left: var(--space-2); padding: 2px 8px; background: var(--warning); color: white; border-radius: var(--radius); font-size: 0.75rem; font-weight: 600;">Today</span>',
            'Due This Week': '<span style="display: inline-block; margin-left: var(--space-2); padding: 2px 8px; background: var(--info); color: white; border-radius: var(--radius); font-size: 0.75rem; font-weight: 600;">This Week</span>'
        };

        return badges[timeline] || '';
    }

    renderModernGrid() {
        if (!this.filtered_orders.length) {
            this.content_area.html(this.renderEmptyState('No orders found', 'Try adjusting your filters or search criteria'));
            return;
        }

        const html = `
            <div class="orders-card-grid">
                ${this.filtered_orders.map(order => this.renderModernOrderCard(order)).join('')}
            </div>
        `;

        this.content_area.html(html);
        this.setupOrderCardHandlers();
    }
    renderModernOrderCard(order) {
        const billedPercent = parseFloat(order.per_billed || 0);
        const deliveredPercent = parseFloat(order.per_delivered || 0);

        return `
        <div class="order-card-modern" data-order="${order.name}">
            <div class="order-card-status-bar ${order.due_status}"></div>
            
            <div class="order-card-header">
                <div class="order-card-number">${order.name}</div>
                <div class="order-card-customer">${order.customer}</div>
                ${order.project ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: var(--space-1);">📋 ${order.project}</div>` : ''}
            </div>
            
            <div class="order-card-body">
                <div class="order-info-grid">
                    <div class="order-info-item">
                        <div class="order-info-label">Sales Person</div>
                        <div class="order-info-value">${order.sales_person}</div>
                    </div>
                    <div class="order-info-item">
                        <div class="order-info-label">Delivery Date</div>
                        <div class="order-info-value">${frappe.datetime.str_to_user(order.delivery_date)}</div>
                    </div>
                    ${order.project ? `
                        <div class="order-info-item">
                            <div class="order-info-label">Project</div>
                            <div class="order-info-value">${order.project}</div>
                        </div>
                    ` : ''}
                    ${order.project_description ? `
                        <div class="order-info-item">
                            <div class="order-info-label">Project Description</div>
                            <div class="order-info-value" title="${order.project_description}">${order.project_description.length > 30 ? order.project_description.substring(0, 30) + '...' : order.project_description}</div>
                        </div>
                    ` : ''}
                    <div class="order-info-item">
                        <div class="order-info-label">Grand Total</div>
                        <div class="order-info-value">${frappe.format(order.grand_total, { fieldtype: 'Currency' })}</div>
                    </div>
                    <div class="order-info-item">
                        <div class="order-info-label">Advance</div>
                        <div class="order-info-value">${frappe.format(order.advance_amount || 0, { fieldtype: 'Currency' })}</div>
                    </div>
                    <div class="order-info-item">
                        <div class="order-info-label">Progress</div>
                        <div class="order-info-value">${frappe.format(order.progress_amount || 0, { fieldtype: 'Currency' })}</div>
                    </div>
                    <div class="order-info-item">
                        <div class="order-info-label">Remaining</div>
                        <div class="order-info-value">${frappe.format(order.remaining_amount, { fieldtype: 'Currency' })}</div>
                    </div>
                </div>
                
                <div class="progress-container">
                    <div class="progress-item">
                        <div class="progress-header">
                            <span class="progress-label">Billing Progress</span>
                            <span class="progress-value">${billedPercent.toFixed(1)}%</span>
                        </div>
                        <div class="progress-bar-modern">
                            <div class="progress-fill-modern" style="width: ${billedPercent}%"></div>
                        </div>
                    </div>
                    <div class="progress-item">
                        <div class="progress-header">
                            <span class="progress-label">Delivery Progress</span>
                            <span class="progress-value">${deliveredPercent.toFixed(1)}%</span>
                        </div>
                        <div class="progress-bar-modern">
                            <div class="progress-fill-modern" style="width: ${deliveredPercent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    renderModernCalendar() {
        const currentDate = this.calendar_date;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const html = `
            <div class="calendar-modern">
                <div class="calendar-header">
                    <div class="calendar-title">${this.getMonthName(month)} ${year}</div>
                    <div class="calendar-nav">
                        <button class="calendar-nav-btn" id="prev-month">
                            <i class="fa fa-chevron-left"></i>
                            Previous
                        </button>
                        <button class="calendar-nav-btn" id="today-btn">Today</button>
                        <button class="calendar-nav-btn" id="next-month">
                            Next
                            <i class="fa fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div class="calendar-grid">
                    ${this.renderCalendarGrid(year, month)}
                </div>
            </div>
        `;

        this.content_area.html(html);
        this.setupCalendarHandlers();
    }

    renderEmptyState(title, message) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fa fa-inbox"></i>
                </div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-message">${message}</div>
                <button class="btn btn-primary btn-lg" onclick="frappe.sales_order_dashboard.clearAllFilters()">
                    <i class="fa fa-refresh"></i>
                    Reset Filters
                </button>
            </div>
        `;
    }

    showLoading() {
        const loadingHtml = `
            <div class="metrics-container">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="metric-card-modern">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    </div>
                `).join('')}
            </div>
        `;

        this.content_area.html(loadingHtml);
    }

    // Keep all existing methods but enhance UI where needed...
    // (All other methods remain the same with minor UI enhancements)

    // Existing methods remain unchanged
    toNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

        const cleaned = String(value).replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    escapeHtml(value) {
        return $('<div/>').text(value || '').html();
    }
    isOnHoldOrder(order) {
        return (order.status || '').toLowerCase().includes('hold');
    }

    setOnHoldToggle(enabled) {
        this.show_on_hold_only = Boolean(enabled);
        const button = $('#on-hold-toggle');

        if (!button.length) return;

        button.toggleClass('active', this.show_on_hold_only);
        button.html(`
            <i class="fa fa-pause-circle"></i>
            ${this.show_on_hold_only ? 'On Hold: Only' : 'On Hold: All Orders'}
        `);
    }

    processOrdersData() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.all_orders.forEach(order => {
            order.name = order.sales_order_number;
            order.sales_person = order.sales_person || 'Unassigned';
            order.sales_team = (order.parent_sales_person || order.sales_team || '').trim();

            const grandTotal = this.toNumber(order.grand_total);
            const advanceAmount = this.toNumber(order.advance_amount);
            const progressAmount = this.toNumber(order.progress_amount);
            const billedPercent = this.toNumber(order.percent_amount_billed);
            const deliveredPercent = this.toNumber(order.percent_amount_delivered);
            const apiRemaining = this.toNumber(order.balance_to_bill_amount);
            const computedRemaining = Math.max(grandTotal - ((grandTotal * billedPercent) / 100), 0);
            const billedBasedRemaining = (!Number.isFinite(apiRemaining) || (billedPercent > 0 && Math.abs(apiRemaining - grandTotal) < 0.01))
                ? computedRemaining
                : Math.max(apiRemaining, 0);
            const alreadyBilledAmount = Math.max(grandTotal - billedBasedRemaining, 0);
            const actualRemaining = Math.max(grandTotal - advanceAmount - progressAmount - alreadyBilledAmount, 0);

            order.grand_total = grandTotal;
            order.advance_amount = advanceAmount;
            order.progress_amount = progressAmount;
            order.per_billed = billedPercent;
            order.per_delivered = deliveredPercent;
            order.api_remaining_amount = billedBasedRemaining;
            order.already_billed_amount = alreadyBilledAmount;
            order.actual_remaining_amount = actualRemaining;
            order.remaining_amount = actualRemaining;

            const deliveryDate = new Date(order.delivery_date);
            deliveryDate.setHours(0, 0, 0, 0);
            const timeDiff = deliveryDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            order.due_days = daysDiff;
            order.due_days_text = this.formatDueDays(daysDiff);
            order.due_status = this.getDueStatus(daysDiff);
        });
    }

    getActualRemaining(order) {
        const explicitRemaining = this.toNumber(order.actual_remaining_amount ?? order.remaining_amount);
        if (Number.isFinite(explicitRemaining)) {
            return Math.max(explicitRemaining, 0);
        }

        const grandTotal = this.toNumber(order.grand_total);
        const advanceAmount = this.toNumber(order.advance_amount);
        const progressAmount = this.toNumber(order.progress_amount);
        const alreadyBilled = this.getAlreadyBilledAmount(order);

        return Math.max(grandTotal - advanceAmount - progressAmount - alreadyBilled, 0);
    }

    getAlreadyBilledAmount(order) {
        const explicitAlreadyBilled = this.toNumber(order.already_billed_amount);
        if (Number.isFinite(explicitAlreadyBilled)) {
            return Math.max(explicitAlreadyBilled, 0);
        }

        const orderValue = this.toNumber(order.grand_total);
        const billedRemainingValue = this.toNumber(order.api_remaining_amount ?? order.balance_to_bill_amount);
        const alreadyBilled = orderValue - (Number.isFinite(billedRemainingValue) ? billedRemainingValue : 0);

        return Math.max(alreadyBilled, 0);
    }

    getRemainingCalculation(order) {
        const orderValue = this.toNumber(order.grand_total);
        const advanceAmount = this.toNumber(order.advance_amount);
        const progressAmount = this.toNumber(order.progress_amount);
        const actualRemaining = this.getActualRemaining(order);
        const apiRemaining = this.toNumber(order.api_remaining_amount ?? order.balance_to_bill_amount);
        const alreadyBilled = this.getAlreadyBilledAmount(order);

        return {
            orderValue,
            advanceAmount,
            progressAmount,
            alreadyBilled,
            actualRemaining,
            apiRemaining: Number.isFinite(apiRemaining) ? Math.max(apiRemaining, 0) : null
        };
    }

    renderRemainingCalculationDetails(order, options = {}) {
        const calculation = this.getRemainingCalculation(order);
        const title = options.title || 'Actual Remaining Calculation';
        const compact = options.compact === true;

        return `
            <div style="padding: ${compact ? 'var(--space-4)' : 'var(--space-5)'}; background: var(--surface-alt); border: 1px solid var(--border-light); border-radius: var(--radius-lg);">
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">
                    ${title}
                </div>
                <div style="display: grid; gap: var(--space-2);">
                    <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
                        <span style="color: var(--text-muted);">Order Value</span>
                        <strong>${frappe.format(calculation.orderValue, { fieldtype: 'Currency' })}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
                        <span style="color: var(--text-muted);">Less: Advance</span>
                        <strong style="color: #b45309;">-${frappe.format(calculation.advanceAmount, { fieldtype: 'Currency' })}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
                        <span style="color: var(--text-muted);">Less: Progress Payment</span>
                        <strong style="color: #7c3aed;">-${frappe.format(calculation.progressAmount, { fieldtype: 'Currency' })}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
                        <span style="color: var(--text-muted);">Less: Already Billed</span>
                        <strong style="color: #1d4ed8;">-${frappe.format(calculation.alreadyBilled || 0, { fieldtype: 'Currency' })}</strong>
                    </div>
                    <div style="height: 1px; background: var(--border-light); margin: var(--space-1) 0;"></div>
                    <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
                        <span style="font-weight: 700; color: var(--text);">Actual Remaining</span>
                        <strong style="font-size: ${compact ? '1rem' : '1.1rem'}; color: #b91c1c;">${frappe.format(calculation.actualRemaining, { fieldtype: 'Currency' })}</strong>
                    </div>
                    ${calculation.apiRemaining !== null ? `
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--space-2);">
                            Already billed value = Grand Total - Billed Remaining Value
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    extractFilterOptions() {
        const customers = new Set();
        const sales_persons = new Set();
        const sales_teams = new Set();
        const branches = new Set();
        const statuses = new Set();
        const projects = new Set();

        this.all_orders.forEach(order => {
            if (order.customer) customers.add(order.customer);
            if (order.sales_person) sales_persons.add(order.sales_person);
            if (order.sales_team) sales_teams.add(order.sales_team);
            if (order.branch) branches.add(order.branch);
            if (order.status) statuses.add(order.status);
            if (order.project) projects.add(order.project);
        });

        this.filter_options = {
            customers: Array.from(customers).sort(),
            sales_persons: Array.from(sales_persons).sort(),
            sales_teams: Array.from(sales_teams).sort(),
            branches: Array.from(branches).sort(),
            statuses: Array.from(statuses).sort(),
            projects: Array.from(projects).sort()
        };
    }
    populateFilterOptions() {
        ['customers', 'sales_persons', 'sales_teams', 'branches', 'statuses', 'projects'].forEach(type => {
            const filterId = type === 'customers' ? 'customer-filter' :
                type === 'sales_persons' ? 'sales-person-filter' :
                    type === 'sales_teams' ? 'sales-team-filter' :
                    type === 'branches' ? 'branch-filter' :
                        type === 'projects' ? 'project-filter' : 'status-filter';

            const filter = $(`#${filterId}`);
            filter.find('option:not(:first)').remove();

            this.filter_options[type].forEach(option => {
                filter.append(`<option value="${option}">${option}</option>`);
            });
        });
    }
    getDashboardFilterState() {
        return {
            globalSearch: ($('#global-search').val() || '').trim().toLowerCase(),
            customer: $('#customer-filter').val() || '',
            salesPerson: $('#sales-person-filter').val() || '',
            salesTeam: $('#sales-team-filter').val() || '',
            project: $('#project-filter').val() || '',
            branch: $('#branch-filter').val() || '',
            status: $('#status-filter').val() || '',
            paymentFilter: $('#payment-filter').val() || '',
            dateFrom: $('#date-from').val() || '',
            dateTo: $('#date-to').val() || '',
            quickFilter: $('#quick-filter').val() || '',
            valueMin: parseFloat($('#value-min').val()) || 0,
            valueMax: parseFloat($('#value-max').val()) || Infinity,
            customerType: $('#customer-type-filter').val() || '',
            showOnHoldOnly: this.show_on_hold_only
        };
    }

    getFilterDate(value) {
        const parsedDate = this.parseOrderDate(value);
        return parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    }

    getDateOffsetFromToday(value) {
        const targetDate = this.getFilterDate(value);
        if (!targetDate) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    matchesCustomerType(order, customerType) {
        if (!customerType) return true;
        const isInternal = order.is_internal_customer === 1 || order.is_internal_customer === true;
        return customerType === 'internal' ? isInternal : !isInternal;
    }

    matchesSalesTeam(order, salesTeam) {
        if (!salesTeam) return true;

        const orderTeams = String(order.sales_team || order.parent_sales_person || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);

        return orderTeams.includes(salesTeam);
    }

    filterOrderCollection(rows, options = {}) {
        const { dateField = 'delivery_date' } = options;
        const state = this.getDashboardFilterState();
        let filtered = [...(rows || [])];

        if (state.customer) filtered = filtered.filter(order => (order.customer || '') === state.customer);
        if (state.salesPerson) filtered = filtered.filter(order => (order.sales_person || '') === state.salesPerson);
        if (state.salesTeam) filtered = filtered.filter(order => this.matchesSalesTeam(order, state.salesTeam));
        if (state.project) filtered = filtered.filter(order => (order.project || '') === state.project);
        if (state.branch) filtered = filtered.filter(order => (order.branch || '') === state.branch);
        if (state.status) filtered = filtered.filter(order => (order.status || '') === state.status);

        if (state.paymentFilter) {
            filtered = filtered.filter(order => {
                const hasAdvance = this.toNumber(order.advance_amount) > 0;
                const hasProgress = this.toNumber(order.progress_amount) > 0;

                switch (state.paymentFilter) {
                    case 'advance':
                        return hasAdvance;
                    case 'progress':
                        return hasProgress;
                    case 'any':
                        return hasAdvance || hasProgress;
                    case 'both':
                        return hasAdvance && hasProgress;
                    case 'none':
                        return !hasAdvance && !hasProgress;
                    default:
                        return true;
                }
            });
        }

        if (state.customerType) {
            filtered = filtered.filter(order => this.matchesCustomerType(order, state.customerType));
        }

        if (state.showOnHoldOnly) {
            filtered = filtered.filter(order => this.isOnHoldOrder(order));
        }

        const fromDate = this.getFilterDate(state.dateFrom);
        const toDate = this.getFilterDate(state.dateTo);
        if (fromDate) {
            filtered = filtered.filter(order => {
                const rowDate = this.getFilterDate(order[dateField]);
                return rowDate && rowDate >= fromDate;
            });
        }
        if (toDate) {
            filtered = filtered.filter(order => {
                const rowDate = this.getFilterDate(order[dateField]);
                return rowDate && rowDate <= toDate;
            });
        }

        filtered = filtered.filter(order => {
            const value = this.toNumber(order.grand_total);
            return value >= state.valueMin && value <= state.valueMax;
        });

        if (state.quickFilter) {
            filtered = filtered.filter(order => {
                const value = this.toNumber(order.grand_total);
                const project = (order.project || '').trim();
                const dateDiff = this.getDateOffsetFromToday(order[dateField]);

                switch (state.quickFilter) {
                    case 'overdue':
                        return dateDiff !== null && dateDiff < 0;
                    case 'due-today':
                        return dateDiff === 0;
                    case 'due-week':
                        return dateDiff !== null && dateDiff >= 0 && dateDiff <= 7;
                    case 'high-value':
                        return value > 20000;
                    case 'on-hold':
                        return this.isOnHoldOrder(order);
                    case 'with-projects':
                        return Boolean(project);
                    case 'without-projects':
                        return !project;
                    default:
                        return true;
                }
            });
        }

        if (state.globalSearch) {
            filtered = filtered.filter(order => {
                const searchableValues = [
                    order.name,
                    order.customer,
                    order.customer_name,
                    order.sales_person,
                    order.sales_team,
                    order.status,
                    order.branch,
                    order.project,
                    order.project_description
                ];

                return searchableValues.some(value => String(value || '').toLowerCase().includes(state.globalSearch));
            });
        }

        return filtered;
    }
    applyFilters() {
        const globalSearch = $('#global-search').val().toLowerCase();

        let filtered = [...this.all_orders];

        if (globalSearch && !this.hasActiveFilters()) {
            this.applyGlobalFilter(globalSearch);
            return;
        }
        filtered = this.filterOrderCollection(this.all_orders, { dateField: 'delivery_date' });

        this.showHeaderStatsLoading();
        this.filtered_orders = filtered;
        this.processData();
        this.updateActiveFilters();
        this.updateHeaderStats();
        this.renderView();
    }
    hasActiveFilters() {
        return $('#customer-filter').val() || $('#sales-person-filter').val() ||
            $('#sales-team-filter').val() ||
            $('#project-filter').val() || $('#branch-filter').val() ||
            $('#status-filter').val() || $('#payment-filter').val() || $('#date-from').val() ||
            $('#date-to').val() || $('#quick-filter').val() ||
            $('#value-min').val() || $('#value-max').val() ||
            $('#customer-type-filter').val() || this.show_on_hold_only;
    }
    updateActiveFilters() {
        const activeFiltersContainer = $('#active-filters');
        const filters = [];

        const filterMappings = [
            { id: 'customer-filter', label: 'Customer' },
            { id: 'sales-person-filter', label: 'Sales Person' },
            { id: 'sales-team-filter', label: 'Sales Team' },
            { id: 'project-filter', label: 'Project' },
            { id: 'branch-filter', label: 'Branch' },
            { id: 'status-filter', label: 'Status' },
            { id: 'payment-filter', label: 'Payment Type' },
            { id: 'customer-type-filter', label: 'Customer Type' },
            { id: 'date-from', label: 'From Date' },
            { id: 'date-to', label: 'To Date' },
            { id: 'quick-filter', label: 'Quick Filter' },
            { id: 'value-min', label: 'Min Value' },
            { id: 'value-max', label: 'Max Value' }
        ];

        filterMappings.forEach(mapping => {
            const value = $(`#${mapping.id}`).val();
            if (value) {
                filters.push({
                    id: mapping.id,
                    label: mapping.label,
                    value: value
                });
            }
        });

        const globalSearch = $('#global-search').val();
        if (globalSearch) {
            filters.push({
                id: 'global-search',
                label: 'Search',
                value: globalSearch
            });
        }

        if (this.show_on_hold_only) {
            filters.push({
                id: 'on-hold-toggle-filter',
                label: 'On Hold',
                value: 'Only',
                custom_remove: true
            });
        }

        if (filters.length > 0) {
            let html = '<div style="display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-4);">';
            filters.forEach(filter => {
                const removeAction = filter.custom_remove
                    ? "frappe.sales_order_dashboard.setOnHoldToggle(false); frappe.sales_order_dashboard.applyFilters();"
                    : `$('#${filter.id}').val(''); frappe.sales_order_dashboard.applyFilters();`;

                html += `
                <div style="display: inline-flex; align-items: center; gap: var(--space-2); background: var(--primary); color: white; padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); font-size: 0.875rem; font-weight: 600;">
                    <span>${filter.label}: ${filter.value}</span>
                    <button style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;" 
                            onclick="${removeAction}">
                        ×
                    </button>
                </div>
            `;
            });
            html += '</div>';

            activeFiltersContainer.html(html).show();
        } else {
            activeFiltersContainer.hide();
        }
    }
    clearAllFilters() {
        $('.filter-control').val('');
        $('#global-search').val('');
        $('#customer-type-filter').val('');
        $('#project-filter').val(''); // Add this line
        this.setOnHoldToggle(false);
        this.applyFilters();
        this.showToast('All filters cleared', 'success');
    }
    saveCurrentFilter() {
        // Implement filter saving logic
        this.showToast('Filter saved successfully', 'success');
    }

    processData() {
        this.data = {
            summary: this.calculateSummaryMetrics(),
            date_summary: this.calculateDateBasedSummary(),
            by_status: this.groupByStatus(),
            by_delivery_date: this.groupByDeliveryDate(),
            by_sales_person: this.groupBySalesPerson(),
            by_branch: this.groupByBranch(),
            by_customer: this.groupByCustomer(),
            calendar_data: this.prepareCalendarData()
        };
    }

    calculateSummaryMetrics() {
        const total_orders = this.filtered_orders.length;
        const total_value = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        const total_remaining = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);

        const overdue_orders = this.filtered_orders.filter(order => order.due_days < 0);
        const due_today = this.filtered_orders.filter(order => order.due_days === 0);
        const due_week_orders = this.filtered_orders.filter(order => order.due_days >= 0 && order.due_days <= 7);
        const due_month_orders = this.filtered_orders.filter(order => order.due_days >= 0 && order.due_days <= 30);
        const high_value_orders = this.filtered_orders.filter(order => parseFloat(order.grand_total) > 20000);
        const on_hold_orders = this.filtered_orders.filter(order => (order.status || '').toLowerCase().includes('hold'));
        const overdue_value = overdue_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        const overdue_remaining = overdue_orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);
        const due_today_value = due_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        const due_today_remaining = due_today.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);
        const due_week_value = due_week_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        const due_week_remaining = due_week_orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);
        const due_month_value = due_month_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        const due_month_remaining = due_month_orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);

        return {
            total_orders,
            total_value,
            total_remaining,
            overdue_count: overdue_orders.length,
            overdue_value,
            overdue_remaining,
            due_today_count: due_today.length,
            due_today_value,
            due_today_remaining,
            due_week_count: due_week_orders.length,
            due_week_value,
            due_week_remaining,
            due_month_count: due_month_orders.length,
            due_month_value,
            due_month_remaining,
            high_value_count: high_value_orders.length,
            high_value_total: high_value_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0),
            on_hold_count: on_hold_orders.length,
            on_hold_value: on_hold_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0),
            avg_order_value: total_orders > 0 ? total_value / total_orders : 0,
            completion_rate: total_value > 0 ? ((total_value - total_remaining) / total_value * 100) : 0,
            avg_billing_progress: total_orders > 0 ? this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.per_billed || 0), 0) / total_orders : 0,
            avg_delivery_progress: total_orders > 0 ? this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.per_delivered || 0), 0) / total_orders : 0
        };
    }

    calculateDateBasedSummary() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfWeek.getDate() - 7);
        const endOfLastWeek = new Date(startOfWeek);
        endOfLastWeek.setDate(startOfWeek.getDate() - 1);

        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfLastWeek.setHours(0, 0, 0, 0);
        endOfLastWeek.setHours(23, 59, 59, 999);

        const summary = {
            // Transaction Date Based
            transaction_today: this.getOrdersByTransactionDate(today, today),
            transaction_yesterday: this.getOrdersByTransactionDate(yesterday, yesterday),
            transaction_this_week: this.getOrdersByTransactionDate(startOfWeek, today),
            transaction_last_week: this.getOrdersByTransactionDate(startOfLastWeek, endOfLastWeek),

            // Delivery Date Based
            delivery_today: this.getOrdersByDeliveryDate(today, today),
            delivery_yesterday: this.getOrdersByDeliveryDate(yesterday, yesterday),
            delivery_this_week: this.getOrdersByDeliveryDate(startOfWeek, new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)),
            delivery_last_week: this.getOrdersByDeliveryDate(startOfLastWeek, endOfLastWeek),
            delivery_overdue: this.filtered_orders.filter(order => {
                const deliveryDate = new Date(order.delivery_date);
                deliveryDate.setHours(0, 0, 0, 0);
                return deliveryDate < today;
            }),
            delivery_future: this.filtered_orders.filter(order => {
                const deliveryDate = new Date(order.delivery_date);
                deliveryDate.setHours(0, 0, 0, 0);
                const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                return deliveryDate > nextWeek;
            })
        };

        return summary;
    }

    getOrdersByTransactionDate(startDate, endDate) {
        return this.filtered_orders.filter(order => {
            const transactionDate = new Date(order.transaction_date || order.date);
            transactionDate.setHours(0, 0, 0, 0);
            return transactionDate >= startDate && transactionDate <= endDate;
        });
    }

    getOrdersByDeliveryDate(startDate, endDate) {
        return this.filtered_orders.filter(order => {
            const deliveryDate = new Date(order.delivery_date);
            deliveryDate.setHours(0, 0, 0, 0);
            return deliveryDate >= startDate && deliveryDate <= endDate;
        });
    }

    groupByStatus() {
        const groups = {};
        this.filtered_orders.forEach(order => {
            const status = order.status || 'Unknown';
            if (!groups[status]) {
                groups[status] = {
                    name: status,
                    orders: [],
                    count: 0,
                    total_value: 0,
                    percentage: 0
                };
            }
            groups[status].orders.push(order);
            groups[status].count++;
            groups[status].total_value += parseFloat(order.grand_total || 0);
        });

        const total_value = this.data?.summary?.total_value || this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        Object.values(groups).forEach(group => {
            group.percentage = total_value > 0 ? (group.total_value / total_value * 100) : 0;
        });

        return Object.values(groups).sort((a, b) => b.total_value - a.total_value);
    }

    groupByDeliveryDate() {
        const today = new Date();
        const groups = {
            overdue: { name: 'Overdue', orders: [], count: 0, total_value: 0 },
            today: { name: 'Due Today', orders: [], count: 0, total_value: 0 },
            this_week: { name: 'Due This Week', orders: [], count: 0, total_value: 0 },
            next_week: { name: 'Due Next Week', orders: [], count: 0, total_value: 0 },
            this_month: { name: 'Due This Month', orders: [], count: 0, total_value: 0 },
            next_month: { name: 'Due Next Month', orders: [], count: 0, total_value: 0 },
            future: { name: 'Future Orders', orders: [], count: 0, total_value: 0 }
        };

        this.filtered_orders.forEach(order => {
            const value = parseFloat(order.grand_total || 0);
            const daysDiff = order.due_days;

            let category = 'future';
            if (daysDiff < 0) category = 'overdue';
            else if (daysDiff === 0) category = 'today';
            else if (daysDiff <= 7) category = 'this_week';
            else if (daysDiff <= 14) category = 'next_week';
            else if (daysDiff <= 30) category = 'this_month';
            else if (daysDiff <= 60) category = 'next_month';

            groups[category].orders.push(order);
            groups[category].count++;
            groups[category].total_value += value;
        });

        return Object.values(groups);
    }

    groupBySalesPerson() {
        const groups = {};
        this.filtered_orders.forEach(order => {
            const salesPerson = order.sales_person || 'Unassigned';
            if (!groups[salesPerson]) {
                groups[salesPerson] = {
                    name: salesPerson,
                    orders: [],
                    total_value: 0,
                    total_remaining: 0,
                    overdue_count: 0,
                    avg_completion: 0,
                    efficiency_score: 0,
                    image: order.sales_person_image || '/assets/frappe/images/default-avatar.png'
                };
            }
            groups[salesPerson].orders.push(order);
            groups[salesPerson].total_value += parseFloat(order.grand_total || 0);
            groups[salesPerson].total_remaining += parseFloat(order.remaining_amount || 0);
            groups[salesPerson].avg_completion += (parseFloat(order.per_billed || 0) + parseFloat(order.per_delivered || 0)) / 2;
            if (order.due_days < 0) groups[salesPerson].overdue_count++;

            if (order.sales_person_image && order.sales_person_image !== '/assets/frappe/images/default-avatar.png') {
                groups[salesPerson].image = order.sales_person_image;
            }
        });

        Object.values(groups).forEach(group => {
            group.avg_completion = group.orders.length > 0 ? group.avg_completion / group.orders.length : 0;
            group.efficiency_score = group.orders.length > 0 ? Math.max(0, 100 - (group.overdue_count / group.orders.length * 100)) : 0;
        });

        return Object.values(groups).sort((a, b) => b.total_value - a.total_value);
    }

    groupByBranch() {
        const groups = {};
        this.filtered_orders.forEach(order => {
            const branch = order.branch || 'Unassigned';
            if (!groups[branch]) {
                groups[branch] = {
                    name: branch,
                    orders: [],
                    total_value: 0,
                    total_remaining: 0,
                    overdue_count: 0
                };
            }
            groups[branch].orders.push(order);
            groups[branch].total_value += parseFloat(order.grand_total || 0);
            groups[branch].total_remaining += parseFloat(order.remaining_amount || 0);
            if (order.due_days < 0) groups[branch].overdue_count++;
        });
        return Object.values(groups).sort((a, b) => b.total_value - a.total_value);
    }

    groupByCustomer() {
        const groups = {};
        this.filtered_orders.forEach(order => {
            const customer = order.customer;
            if (!groups[customer]) {
                groups[customer] = {
                    name: customer,
                    orders: [],
                    total_value: 0,
                    total_remaining: 0,
                    overdue_count: 0,
                    is_internal: order.is_internal_customer
                };
            }
            groups[customer].orders.push(order);
            groups[customer].total_value += parseFloat(order.grand_total || 0);
            groups[customer].total_remaining += parseFloat(order.remaining_amount || 0);
            if (order.due_days < 0) groups[customer].overdue_count++;
        });
        return Object.values(groups).sort((a, b) => b.total_value - a.total_value);
    }

    prepareCalendarData() {
        const deliveryDates = {};
        const transactionDates = {};

        this.filtered_orders.forEach(order => {
            const deliveryDateStr = frappe.datetime.obj_to_str(new Date(order.delivery_date));
            const transactionDateStr = frappe.datetime.obj_to_str(new Date(order.transaction_date || order.date));

            deliveryDates[deliveryDateStr] = (deliveryDates[deliveryDateStr] || 0) + 1;
            transactionDates[transactionDateStr] = (transactionDates[transactionDateStr] || 0) + 1;
        });

        return { delivery_dates: deliveryDates, transaction_dates: transactionDates };
    }

    switchView(view) {
        this.current_view = view;
        $('.view-pill').removeClass('active');
        $(`.view-pill[data-view="${view}"]`).addClass('active');
        this.renderView();
    }

    renderModernSummary() {
        const dateSummary = this.data.date_summary;

        const html = `
            <div class="metrics-container">
                <div class="metric-card-modern">
                    <div class="metric-card-icon" style="background: var(--gradient-primary);">
                        <i class="fa fa-plus-circle"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value">${dateSummary.transaction_today.length}</div>
                        <div class="metric-label">Orders Created Today</div>
                        <div class="metric-trend positive">
                            <i class="fa fa-money"></i>
                            ${frappe.format(dateSummary.transaction_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}
                        </div>
                    </div>
                </div>
                
                <div class="metric-card-modern">
                    <div class="metric-card-icon" style="background: var(--gradient-warm);">
                        <i class="fa fa-truck"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value">${dateSummary.delivery_today.length}</div>
                        <div class="metric-label">Deliveries Due Today</div>
                        <div class="metric-trend positive">
                            <i class="fa fa-money"></i>
                            ${frappe.format(dateSummary.delivery_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}
                        </div>
                    </div>
                </div>
                
                <div class="metric-card-modern">
                    <div class="metric-card-icon" style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);">
                        <i class="fa fa-exclamation-circle"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value">${dateSummary.delivery_overdue.length}</div>
                        <div class="metric-label">Overdue Deliveries</div>
                        <div class="metric-trend negative">
                            <i class="fa fa-money"></i>
                            ${frappe.format(dateSummary.delivery_overdue.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}
                        </div>
                    </div>
                </div>
            </div>
            
            ${this.renderDateSummaryTables()}
        `;

        this.content_area.html(html);
        this.setupDateSummaryHandlers();
    }

    buildCompletedSummaryFromRows(rows, summaryTemplate) {
        const summary = {};
        Object.entries(summaryTemplate || {}).forEach(([key, period]) => {
            const fromDate = this.getFilterDate(period?.from_date);
            const toDate = this.getFilterDate(period?.to_date);
            const matchingRows = (rows || []).filter((row) => {
                const completionDate = this.getFilterDate(row.completion_date);
                return completionDate && fromDate && toDate && completionDate >= fromDate && completionDate <= toDate;
            });

            summary[key] = {
                label: period?.label || key.replace(/_/g, ' '),
                from_date: period?.from_date || '',
                to_date: period?.to_date || '',
                count: matchingRows.length,
                total_value: matchingRows.reduce((sum, row) => sum + this.toNumber(row.grand_total), 0),
                total_outstanding: matchingRows.reduce((sum, row) => sum + this.toNumber(row.outstanding_amount), 0)
            };
        });

        return summary;
    }

    getCompletedViewData() {
        const rawData = this.completed_summary_data || { rows: [], summary: {}, meta: {} };
        const filteredRows = this.filterOrderCollection(rawData.rows || [], { dateField: 'completion_date' });
        const filterState = this.getDashboardFilterState();

        return {
            rows: filteredRows,
            summary: this.buildCompletedSummaryFromRows(filteredRows, rawData.summary || {}),
            meta: {
                ...(rawData.meta || {}),
                filtered_row_count: filteredRows.length,
                filter_date_from: filterState.dateFrom || '',
                filter_date_to: filterState.dateTo || '',
                filter_date_basis: 'completion_date'
            }
        };
    }

    getCompletedSummaryRequestArgs() {
        const filterState = this.getDashboardFilterState();
        return {
            company: 'METROPLUS ADVERTISING LLC',
            from_date: filterState.dateFrom || null,
            to_date: filterState.dateTo || null
        };
    }

    getCompletedSummaryRequestKey() {
        return JSON.stringify(this.getCompletedSummaryRequestArgs());
    }

    renderCompletedSummary() {
        const requestKey = this.getCompletedSummaryRequestKey();

        if (this.completed_summary_loading) {
            this.content_area.html(`
                <div class="table-modern-container" style="padding: var(--space-10); text-align: center;">
                    <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--success);"></i>
                    <div style="margin-top: var(--space-3); color: var(--text-secondary); font-weight: 600;">
                        Loading completed sales orders...
                    </div>
                </div>
            `);
            return;
        }

        if (!this.completed_summary_data || this.completed_summary_request_key !== requestKey) {
            this.completed_summary_loading = true;
            this.renderCompletedSummary();
            this.fetchCompletedSummaryData().then((data) => {
                this.completed_summary_data = data;
                this.completed_summary_loading = false;
                this.completed_summary_request_key = requestKey;
                if (this.current_view === 'completed') {
                    this.renderCompletedSummary();
                }
            });
            return;
        }

        const completedViewData = this.getCompletedViewData();
        const summary = completedViewData.summary || {};
        const rows = completedViewData.rows || [];
        const meta = completedViewData.meta || {};
        const periodOrder = [
            'all',
            'today',
            'yesterday',
            'this_week',
            'last_week',
            'this_month',
            'last_month',
            'this_quarter',
            'last_quarter'
        ];
        const hasFilterContext = this.hasActiveFilters() || Boolean((this.getDashboardFilterState().globalSearch || '').trim());

        if (!periodOrder.some((key) => (summary[key]?.count || 0) > 0) && !rows.length) {
            this.content_area.html(this.renderEmptyState(
                'No completed sales orders found',
                hasFilterContext
                    ? 'No completed sales orders match the current filters.'
                    : 'No fully delivered and billed sales orders were completed in the supported periods.'
            ));
            return;
        }

        const cardsHtml = periodOrder.map((key) => {
            const item = summary[key] || {};
            const label = item.label || key.replace(/_/g, ' ');
            return `
                <div class="metric-card-modern metric-card-success" data-completed-period="${key}" style="cursor: pointer; padding: var(--space-4);">
                    <div class="metric-card-icon" style="background: var(--gradient-success);">
                        <i class="fa fa-check-circle"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value" style="font-size: 1.8rem;">${item.count || 0}</div>
                        <div class="metric-label">${label}</div>
                        <div style="margin-top: var(--space-2); display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: inline-flex; align-items: center; width: fit-content; max-width: 100%; font-size: 0.76rem; font-weight: 700; color: #065f46; background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.28); border-radius: 999px; padding: 3px 8px;">
                                Value: <strong style="color: #065f46; margin-left: 4px;">${frappe.format(item.total_value || 0, { fieldtype: 'Currency' })}</strong>
                            </div>
                            <div style="display: inline-flex; align-items: center; width: fit-content; max-width: 100%; font-size: 0.76rem; font-weight: 700; color: #92400e; background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.26); border-radius: 999px; padding: 3px 8px;">
                                Outstanding: <strong style="color: #92400e; margin-left: 4px;">${frappe.format(item.total_outstanding || 0, { fieldtype: 'Currency' })}</strong>
                            </div>
                        </div>
                        <div class="metric-description">Click to view completed orders by completion date</div>
                    </div>
                </div>
            `;
        }).join('');

        const completionFilterLabel = meta.filter_date_from || meta.filter_date_to
            ? `
                <span class="stat-pill" style="background: rgba(59, 130, 246, 0.12); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.24);">
                    <i class="fa fa-filter"></i> Completion Filter:
                    ${meta.filter_date_from ? frappe.datetime.str_to_user(meta.filter_date_from) : 'Start'}
                    to
                    ${meta.filter_date_to ? frappe.datetime.str_to_user(meta.filter_date_to) : 'End'}
                </span>
            `
            : '';

        const html = `
            <div class="table-modern-container" style="margin-bottom: var(--space-6); overflow: hidden;">
                <div style="padding: var(--space-6); background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.06) 100%); border: 1px solid rgba(16, 185, 129, 0.18);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                        <div>
                            <div style="font-size: 1.25rem; font-weight: 800; color: #065f46; display: flex; align-items: center; gap: var(--space-3);">
                                <i class="fa fa-check-circle"></i>
                                Completed Sales Orders
                            </div>
                            <div style="margin-top: 6px; color: var(--text-secondary); font-size: 0.92rem;">
                                Completion date = later of the latest submitted Delivery Note date and latest submitted Sales Invoice date.
                            </div>
                        </div>
                        <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
                            <span class="stat-pill" style="background: rgba(16, 185, 129, 0.14); color: #065f46; border: 1px solid rgba(16, 185, 129, 0.24);">
                                <i class="fa fa-calendar"></i> Range: ${frappe.datetime.str_to_user(meta.from_date || '')} to ${frappe.datetime.str_to_user(meta.to_date || '')}
                            </span>
                            <span class="stat-pill" style="background: rgba(16, 185, 129, 0.14); color: #065f46; border: 1px solid rgba(16, 185, 129, 0.24);">
                                <i class="fa fa-building"></i> ${meta.company || 'METROPLUS ADVERTISING LLC'}
                            </span>
                            <span class="stat-pill" style="background: rgba(16, 185, 129, 0.14); color: #065f46; border: 1px solid rgba(16, 185, 129, 0.24);">
                                <i class="fa fa-list"></i> Showing: ${meta.filtered_row_count || 0}
                            </span>
                            ${completionFilterLabel}
                        </div>
                    </div>
                </div>
            </div>

            <div class="metrics-container" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
                ${cardsHtml}
            </div>
        `;

        this.content_area.html(html);
        this.content_area.find('[data-completed-period]').on('click', (e) => {
            const periodKey = $(e.currentTarget).data('completedPeriod');
            this.showCompletedOrdersModal(periodKey);
        });
    }

    fetchCompletedSummaryData() {
        return new Promise((resolve) => {
            const requestArgs = this.getCompletedSummaryRequestArgs();
            frappe.call({
                method: 'prastara_custom.prastara_custom.page.prd_so_calender.prd_so_calender.get_completed_sales_order_summary',
                args: requestArgs,
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data || { rows: [], summary: {}, meta: {} });
                    } else {
                        this.showToast('Failed to load completed sales orders', 'error');
                        resolve({ rows: [], summary: {}, meta: {} });
                    }
                },
                error: (err) => {
                    this.showToast(`Failed to load completed sales orders: ${err.message || 'Unknown error'}`, 'error');
                    resolve({ rows: [], summary: {}, meta: {} });
                }
            });
        });
    }

    getCompletedOrdersByPeriod(periodKey) {
        const completedViewData = this.getCompletedViewData();
        const period = completedViewData.summary?.[periodKey];
        const rows = completedViewData.rows || [];
        if (!period) return [];

        const fromDate = this.getFilterDate(period.from_date);
        const toDate = this.getFilterDate(period.to_date);
        if (!fromDate || !toDate) return [];

        return rows.filter((row) => {
            const completionDate = this.getFilterDate(row.completion_date);
            return completionDate && completionDate >= fromDate && completionDate <= toDate;
        });
    }

    showCompletedOrdersModal(periodKey) {
        const period = this.getCompletedViewData().summary?.[periodKey];
        if (!period) return;

        const orders = this.getCompletedOrdersByPeriod(periodKey);
        const title = `Completed Sales Orders - ${period.label || periodKey}`;
        this.main_modal.find('.modal-title').text(title);

        if (!orders.length) {
            this.main_modal.find('.modal-body').html(this.renderEmptyState('No completed sales orders found', ''));
            this.main_modal.fadeIn(300);
            return;
        }

        const totalValue = orders.reduce((sum, order) => sum + this.toNumber(order.grand_total), 0);
        const totalOutstanding = orders.reduce((sum, order) => sum + this.toNumber(order.outstanding_amount), 0);

        const html = `
            <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                <div class="table-toolbar" style="padding: var(--space-4); background: var(--surface-alt); border-radius: var(--radius-lg); margin-bottom: var(--space-4);">
                    <div class="table-search-box">
                        <i class="fa fa-search table-search-icon"></i>
                        <input type="text" class="table-search-input" placeholder="Search completed sales orders..." id="completed-modal-search" style="background: var(--surface); color: var(--text);">
                    </div>
                </div>
                <div class="table-body" style="overflow-x: auto;">
                    <table class="data-table" id="completed-modal-orders-table" style="min-width: 1500px;">
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Project</th>
                                <th>Sales Person</th>
                                <th>Completion Date</th>
                                <th>Last Delivery</th>
                                <th>Last Invoice</th>
                                <th>Grand Total</th>
                                <th>Outstanding</th>
                                <th>Invoices</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map((order) => `
                                <tr data-order="${order.name}" style="cursor: pointer;">
                                    <td><strong style="color: var(--success);">${this.escapeHtml(order.name)}</strong></td>
                                    <td>${this.escapeHtml(order.customer_name || order.customer || '')}</td>
                                    <td>
                                        ${order.project ? `
                                            <div>
                                                <div style="font-weight: 600; font-size: 0.85rem;">${this.escapeHtml(order.project)}</div>
                                                ${order.project_description ? `<div style="font-size: 0.7rem; color: var(--text-muted);" title="${this.escapeHtml(order.project_description)}">${this.escapeHtml(order.project_description.length > 20 ? `${order.project_description.substring(0, 20)}...` : order.project_description)}</div>` : ''}
                                            </div>
                                        ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">No Project</span>`}
                                    </td>
                                    <td>${this.escapeHtml(order.sales_person || 'Unassigned')}</td>
                                    <td><strong>${frappe.datetime.str_to_user(order.completion_date)}</strong></td>
                                    <td>${order.last_delivery_date ? frappe.datetime.str_to_user(order.last_delivery_date) : '-'}</td>
                                    <td>${order.last_invoice_date ? frappe.datetime.str_to_user(order.last_invoice_date) : '-'}</td>
                                    <td><strong>${frappe.format(order.grand_total || 0, { fieldtype: 'Currency' })}</strong></td>
                                    <td><strong>${frappe.format(order.outstanding_amount || 0, { fieldtype: 'Currency' })}</strong></td>
                                    <td>
                                        <span class="status-badge status-completed">${order.invoice_count || 0} invoice${(order.invoice_count || 0) === 1 ? '' : 's'}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="padding: var(--space-6); background: var(--surface-alt); border-top: 2px solid var(--success); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
                    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap;">
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Completed SOs</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: var(--success);">${orders.length}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Value</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: var(--success);">${frappe.format(totalValue, { fieldtype: 'Currency' })}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Outstanding</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #b45309;">${frappe.format(totalOutstanding, { fieldtype: 'Currency' })}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.main_modal.find('.modal-body').html(html);
        this.setupTableSearch('#completed-modal-search', '#completed-modal-orders-table');
        this.main_modal.find('tbody tr[data-order]').on('click', (e) => {
            const orderName = $(e.currentTarget).data('order');
            this.showOrderDetails(orderName);
        });
        this.main_modal.fadeIn(300);
    }

    renderDateSummaryTables() {
        const dateSummary = this.data.date_summary;

        return `
            <div class="table-modern-container">
                <div class="table-modern-header">
                    <div class="table-modern-title">Transaction Date Analysis</div>
                </div>
                <div class="table-body">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Period</th>
                                <th>Orders</th>
                                <th>Total Value</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Today</strong></td>
                                <td>${dateSummary.transaction_today.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="today">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Yesterday</strong></td>
                                <td>${dateSummary.transaction_yesterday.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_yesterday.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="yesterday">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>This Week</strong></td>
                                <td>${dateSummary.transaction_this_week.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_this_week.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="this-week">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Last Week</strong></td>
                                <td>${dateSummary.transaction_last_week.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_last_week.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="last-week">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="table-modern-container" style="margin-top: var(--space-8);">
                <div class="table-modern-header">
                    <div class="table-modern-title">Delivery Date Analysis</div>
                </div>
                <div class="table-body">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Period</th>
                                <th>Orders</th>
                                <th>Total Value</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Overdue</strong> <span style="display: inline-block; margin-left: var(--space-2); padding: 2px 8px; background: var(--error); color: white; border-radius: var(--radius); font-size: 0.75rem;">Urgent</span></td>
                                <td>${dateSummary.delivery_overdue.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_overdue.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="overdue">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Today</strong></td>
                                <td>${dateSummary.delivery_today.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="today">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>This Week</strong></td>
                                <td>${dateSummary.delivery_this_week.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_this_week.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="this-week">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Future</strong></td>
                                <td>${dateSummary.delivery_future.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_future.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="future">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderModernList() {
        if (!this.filtered_orders.length) {
            this.content_area.html(this.renderEmptyState('No orders found', 'Try adjusting your filters or search criteria'));
            return;
        }

        const totalValue = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
        const totalAdvance = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.advance_amount || 0), 0);
        const totalProgress = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.progress_amount || 0), 0);
        const totalRemaining = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);

        const html = `
        <div class="table-modern-container">
            <div class="table-modern-header">
                <div class="table-modern-title">All Orders (${this.filtered_orders.length} orders)</div>
                <div class="table-toolbar">
                    <div class="table-search-box">
                        <i class="fa fa-search table-search-icon"></i>
                        <input type="text" class="table-search-input" placeholder="Search orders, projects..." id="list-search">
                    </div>
                    <div class="table-actions">
                        <button class="btn btn-ghost btn-sm" onclick="frappe.sales_order_dashboard.exportData()">
                            <i class="fa fa-download"></i>
                            Export
                        </button>
                    </div>
                </div>
            </div>
            <div class="table-body">
                <table class="data-table" id="orders-table">
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Project</th>
                            <th>Sales Person</th>
                            <th>Delivery Date</th>
                            <th>Status</th>
                            <th>Grand Total</th>
                            <th>Advance</th>
                            <th>Progress Payment</th>
                            <th>Completion</th>
                            <th>Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filtered_orders.map(order => this.renderModernOrderRow(order)).join('')}
                    </tbody>
                </table>
            </div>
            <div style="padding: var(--space-6); background: var(--surface-alt); border-top: 2px solid var(--primary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
                <div style="display: flex; gap: var(--space-8); flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Orders</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${this.filtered_orders.length}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Value</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalValue, { fieldtype: 'Currency' })}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Advance</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalAdvance, { fieldtype: 'Currency' })}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Progress</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalProgress, { fieldtype: 'Currency' })}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Remaining</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalRemaining, { fieldtype: 'Currency' })}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

        this.content_area.html(html);
        this.setupListHandlers();
    }
    renderModernOrderRow(order) {
        const billedPercent = parseFloat(order.per_billed || 0);
        const deliveredPercent = parseFloat(order.per_delivered || 0);
        const avgProgress = (billedPercent + deliveredPercent) / 2;

        return `
        <tr data-order="${order.name}" style="cursor: pointer;">
            <td>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                    <strong style="color: var(--primary);">${order.name}</strong>
                    <div style="display: flex; gap: var(--space-1);">
                        ${order.dispute_count > 0
                ? `<span title="Active Disputes" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; background: #fee2e2; color: #b91c1c; font-size: 10px; border: 1px solid #fecaca;">
                                <i class="fa fa-exclamation-triangle"></i>
                               </span>`
                : ''}
                        ${order.issue_count > 0
                ? `<span title="Active Issues" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; background: #fffbeb; color: #92400e; font-size: 10px; border: 1px solid #fde68a;">
                                <i class="fa fa-ticket-alt"></i>
                               </span>`
                : ''}
                    </div>
                </div>
            </td>
            <td>${order.customer}</td>
            <td>
                ${order.project ? `
                    <div>
                        <div style="font-weight: 600;">${order.project}</div>
                        ${order.project_description ? `<div style="font-size: 0.75rem; color: var(--text-muted);" title="${order.project_description}">${order.project_description.length > 25 ? order.project_description.substring(0, 25) + '...' : order.project_description}</div>` : ''}
                    </div>
                ` : `<span style="color: var(--text-muted);">No Project</span>`}
            </td>
            <td>${order.sales_person}</td>
            <td>
                ${frappe.datetime.str_to_user(order.delivery_date)}
                ${this.getDueBadge(order.due_status, order.due_days_text)}
            </td>
            <td>${order.status || 'Unknown'}</td>
            <td><strong>${frappe.format(order.grand_total, { fieldtype: 'Currency' })}</strong></td>
            <td><strong>${frappe.format(order.advance_amount || 0, { fieldtype: 'Currency' })}</strong></td>
            <td><strong>${frappe.format(order.progress_amount || 0, { fieldtype: 'Currency' })}</strong></td>
            <td>
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div class="progress-bar-modern" style="flex: 1;">
                        <div class="progress-fill-modern" style="width: ${avgProgress}%"></div>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 600;">${avgProgress.toFixed(0)}%</span>
                </div>
            </td>
            <td><strong>${frappe.format(order.remaining_amount, { fieldtype: 'Currency' })}</strong></td>
        </tr>
    `;
    }
    getDueBadge(status, text) {
        const colors = {
            'overdue': 'var(--error)',
            'due-today': 'var(--warning)',
            'upcoming': 'var(--success)'
        };

        return `
            <div style="display: inline-block; margin-left: var(--space-2); padding: 2px 8px; background: ${colors[status] || 'var(--info)'}; color: white; border-radius: var(--radius); font-size: 0.625rem; font-weight: 600;">
                ${text}
            </div>
        `;
    }



    renderModernSalesPersonView() {
        const salesPersonData = this.data.by_sales_person;

        const html = `
            <div class="metrics-container">
                ${salesPersonData.slice(0, 3).map(sp => `
                    <div class="metric-card-modern">
                        <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-4);">
                            <img src="${sp.image}" style="width: 50px; height: 50px; border-radius: var(--radius-full); object-fit: cover; border: 3px solid var(--primary);" 
                                 onerror="this.src='/assets/frappe/images/default-avatar.png'">
                            <div>
                                <div style="font-weight: 700; color: var(--text);">${sp.name}</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">${sp.orders.length} orders</div>
                            </div>
                        </div>
                        <div class="metric-value">${frappe.format(sp.total_value, { fieldtype: 'Currency' })}</div>
                        <div class="metric-label">Total Sales Value</div>
                        <div class="metric-trend ${sp.efficiency_score > 80 ? 'positive' : 'negative'}">
                            <i class="fa fa-chart-line"></i>
                            ${sp.efficiency_score.toFixed(0)}% efficiency
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="table-modern-container">
                <div class="table-modern-header">
                    <div class="table-modern-title">Sales Team Performance</div>
                    <div class="table-toolbar">
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon"></i>
                            <input type="text" class="table-search-input" placeholder="Search sales persons..." id="sp-search">
                        </div>
                    </div>
                </div>
                <div class="table-body">
    <table class="data-table" id="salesperson-table">
        <thead>
            <tr>
                <th>Sales Person</th>
                <th>Orders</th>
                <th>Projects</th>
                <th>Total Value</th>
                <th>Remaining</th>
                <th>Overdue</th>
                <th>Avg Completion</th>
                <th>Efficiency</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${salesPersonData.map(sp => {
            const uniqueProjects = [...new Set(sp.orders.filter(o => o.project).map(o => o.project))];
            return `
                    <tr data-salesperson="${sp.name}">
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-3);">
                                <img src="${sp.image}" style="width: 35px; height: 35px; border-radius: var(--radius-full); object-fit: cover;"
                                     onerror="this.src='/assets/frappe/images/default-avatar.png'">
                                <strong>${sp.name}</strong>
                            </div>
                        </td>
                        <td>${sp.orders.length}</td>
                        <td>
                            <div style="font-weight: 600;">${uniqueProjects.length}</div>
                            ${uniqueProjects.length > 0 ? `
                                <div style="font-size: 0.75rem; color: var(--text-muted);" title="${uniqueProjects.join(', ')}">
                                    ${uniqueProjects.length === 1 ? uniqueProjects[0] : `${uniqueProjects[0]} +${uniqueProjects.length - 1} more`}
                                </div>
                            ` : `<div style="font-size: 0.75rem; color: var(--text-muted);">No projects</div>`}
                        </td>
                        <td><strong>${frappe.format(sp.total_value, { fieldtype: 'Currency' })}</strong></td>
                        <td><strong>${frappe.format(sp.total_remaining, { fieldtype: 'Currency' })}</strong></td>
                        <td>
                            <span style="color: ${sp.overdue_count > 0 ? 'var(--error)' : 'var(--success)'}; font-weight: 600;">
                                ${sp.overdue_count}
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-3);">
                                <div class="progress-bar-modern" style="flex: 1; height: 6px;">
                                    <div class="progress-fill-modern" style="width: ${sp.avg_completion}%"></div>
                                </div>
                                <span style="font-size: 0.75rem;">${sp.avg_completion.toFixed(0)}%</span>
                            </div>
                        </td>
                        <td>
                            <span style="padding: 4px 8px; background: ${sp.efficiency_score > 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; 
                                         color: ${sp.efficiency_score > 80 ? 'var(--success)' : 'var(--error)'}; 
                                         border-radius: var(--radius); font-size: 0.75rem; font-weight: 600;">
                                ${sp.efficiency_score.toFixed(0)}%
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-primary btn-sm" data-action="view-sp-orders" data-salesperson="${sp.name}">
                                View Orders
                            </button>
                        </td>
                    </tr>
                `;
        }).join('')}
        </tbody>
    </table>
</div>
            </div>
        `;

        this.content_area.html(html);
        this.setupSalesPersonHandlers();
    }






    // Modified renderDraftOrdersTable to include green toolbar
    renderDraftOrdersTable() {
        this.fetchDraftOrderCount().then(count => {
            this.content_area.html(`
            <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                <div class="table-toolbar" style="padding: var(--space-4); background:#9ca3af; border-radius: var(--radius-lg); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: var(--space-4);">
                        <span style="font-weight: 600; color: white;">${count} Draft Order${count === 1 ? '' : 's'}</span>
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon" style="color: white;"></i>
                            <input type="text" class="table-search-input" placeholder="Search draft orders by order #, customer, project..." id="draft-orders-search" style="background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);">
                        </div>
                    </div>
                    <button class="btn btn-primary" id="export-draft-orders" style="padding: var(--space-2) var(--space-4); background: white; color: #9ca3af; border-color: white;">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
                <div class="table-body">
                    <table class="data-table" id="draft-orders-table">
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Project</th>
                                <th>Sales Person</th>
                                <th>Delivery Date</th>
                                <th>Grand Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colspan="7" style="text-align: center; padding: var(--space-6);">
                                <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-muted);"></i>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `);

            // Fetch and render draft orders
            this.fetchDraftOrders().then(orders => {
                if (!orders.length) {
                    this.content_area.find('#draft-orders-table tbody').html(`
                    <tr>
                        <td colspan="7" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                            <i class="fa fa-inbox" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                            <div>No draft orders found</div>
                        </td>
                    </tr>
                `);
                } else {
                    const html = orders.map(order => `
                    <tr data-order="${order.name}" style="cursor: pointer;">
                        <td><strong style="color: var(--primary);">${order.name}</strong></td>
                        <td>${order.customer}</td>
                        <td>
                            ${order.project ? `
                                <div>
                                    <div style="font-weight: 600; font-size: 0.85rem;">${order.project}</div>
                                    ${order.project_description ? `<div style="font-size: 0.7rem; color: var(--text-muted);" title="${order.project_description}">${order.project_description.length > 20 ? order.project_description.substring(0, 20) + '...' : order.project_description}</div>` : ''}
                                </div>
                            ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">No Project</span>`}
                        </td>
                        <td>${order.sales_person}</td>
                        <td>
                            ${order.delivery_date ? frappe.datetime.str_to_user(order.delivery_date) : 'No Date'}
                            ${order.due_status ? this.getDueBadge(order.due_status, order.due_days_text) : ''}
                        </td>
                        <td><strong>${frappe.format(order.grand_total || 0, { fieldtype: 'Currency' })}</strong></td>
                        <td><span class="status-badge status-normal">${order.status || 'Draft'}</span></td>
                    </tr>
                `).join('');

                    this.content_area.find('#draft-orders-table tbody').html(html);

                    // Setup search functionality
                    this.setupTableSearch('#draft-orders-search', '#draft-orders-table', ['name', 'customer', 'project', 'sales_person']);

                    // Setup row click handlers
                    this.content_area.find('tbody tr[data-order]').on('click', (e) => {
                        const orderName = $(e.currentTarget).data('order');
                        this.showOrderDetails(orderName);
                    });

                    // Setup export button handler
                    $('#export-draft-orders').on('click', () => {
                        this.exportDraftOrders(orders);
                    });
                }
            });
        });
    }

    // Updated fetchDraftOrders to handle getdate, date_diff, and today
    fetchDraftOrders() {
        return new Promise((resolve, reject) => {
            // Fallback date difference calculation
            const calculateDateDiff = (date1, date2) => {
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                const diffTime = d1 - d2;
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            };

            // Fallback getdate function
            const parseDate = (dateStr) => {
                return dateStr ? new Date(dateStr) : new Date();
            };

            // Fallback today function
            const getToday = () => {
                const today = new Date();
                return today.toISOString().split('T')[0]; // Returns YYYY-MM-DD
            };

            frappe.call({
                method: 'prastara_custom.controller.variant_pricing.draft_get_sales_order_list_prd',
                args: {
                    status: 'Draft',
                    company: 'METROPLUS ADVERTISING LLC'
                },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        const orders = r.message.data.orders.map(order => {
                            // Use frappe.utils.getdate if available, else fallback
                            const deliveryDate = order.delivery_date ? (frappe.utils.getdate ? frappe.utils.getdate(order.delivery_date) : parseDate(order.delivery_date)) : null;
                            // Use frappe.utils.today if available, else fallback
                            const todayDate = frappe.utils.today ? (frappe.utils.getdate ? frappe.utils.getdate(frappe.utils.today()) : parseDate(getToday())) : parseDate(getToday());

                            // Calculate due days using frappe.utils.date_diff or fallback
                            const dueDays = deliveryDate ? (frappe.utils.date_diff ? frappe.utils.date_diff(deliveryDate, todayDate) : calculateDateDiff(deliveryDate, todayDate)) : 999999;

                            return {
                                ...order,
                                name: order.sales_order_number,
                                due_days: dueDays,
                                due_days_text: deliveryDate ? this.formatDueDays(dueDays) : 'No delivery date',
                                due_status: deliveryDate ? this.getDueStatus(dueDays) : 'none',
                                formatted_transaction_date: order.formatted_date,
                                formatted_delivery_date: order.formatted_delivery_date
                            };
                        });
                        resolve(orders);
                    } else {
                        this.showToast('Failed to load draft orders', 'error');
                        resolve([]);
                    }
                },
                error: (err) => {
                    this.showToast('Failed to load draft orders: ' + err.message, 'error');
                    resolve([]);
                }
            });
        });
    }

    // New method to export draft orders as CSV
    exportDraftOrders(orders) {
        const headers = ['Order #', 'Customer', 'Project', 'Project Description', 'Sales Person', 'Delivery Date', 'Grand Total', 'Status'];
        const rows = orders.map(order => [
            order.name,
            order.customer,
            order.project || 'No Project',
            order.project_description || '',
            order.sales_person,
            order.delivery_date ? frappe.datetime.str_to_user(order.delivery_date) : 'No Date',
            frappe.format(order.grand_total || 0, { fieldtype: 'Currency' }),
            order.status || 'Draft'
        ]);

        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'draft_orders_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    ensureProjectOwnerMappingLoaded() {
        if (this.project_owner_mapping_loaded) {
            return Promise.resolve(this.project_owner_mapping_rows);
        }

        if (this.project_owner_mapping_promise) {
            return this.project_owner_mapping_promise;
        }

        this.project_owner_mapping_promise = this.fetchProjectOwnerMappingData()
            .then((result) => {
                this.project_owner_mapping_rows = result.projects || [];
                this.project_owner_mapping_loaded = true;
                return this.project_owner_mapping_rows;
            })
            .finally(() => {
                this.project_owner_mapping_promise = null;
            });

        return this.project_owner_mapping_promise;
    }

    fetchProjectOwnerMappingData() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'prastara_custom.prastara_custom.page.prd_so_calender.prd_so_calender.get_project_owner_mapping',
                args: {
                    company: 'METROPLUS ADVERTISING LLC'
                },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data || { projects: [], summary: {} });
                    } else {
                        this.showToast('Failed to load project owner mapping', 'error');
                        resolve({ projects: [], summary: {} });
                    }
                },
                error: (err) => {
                    this.showToast('Failed to load project owner mapping: ' + (err.message || 'Unknown error'), 'error');
                    resolve({ projects: [], summary: {} });
                }
            });
        });
    }

    getProjectOwnerRoleConfig() {
        const roleConfigs = {
            production_manager: {
                key: 'production_manager',
                label: 'Production Incharge',
                userField: 'production_manager_user',
                nameField: 'production_manager_name',
                imageField: 'production_manager_image',
                emptyHelpText: 'No user linked in Project.custom_team'
            },
            installation_manager: {
                key: 'installation_manager',
                label: 'Installation In Charge',
                userField: 'installation_manager_user',
                nameField: 'installation_manager_name',
                imageField: 'installation_manager_image',
                emptyHelpText: 'No user linked in Project.custom_installation_handled'
            },
            site_supervisor: {
                key: 'site_supervisor',
                label: 'Site Supervisor',
                userField: 'site_supervisor_user',
                nameField: 'site_supervisor_name',
                imageField: 'site_supervisor_image',
                emptyHelpText: 'No user linked in Project.custom_site_supervisor'
            }
        };

        return roleConfigs[this.project_owner_active_role] || roleConfigs.production_manager;
    }

    buildProjectOwnerData() {
        const roleConfig = this.getProjectOwnerRoleConfig();
        const projectMap = {};
        (this.project_owner_mapping_rows || []).forEach((row) => {
            const projectCode = (row.project || '').trim();
            if (!projectCode) return;
            projectMap[projectCode] = row;
        });

        const owners = {};
        this.filtered_orders.forEach((order) => {
            const orderProjectCode = (order.project || '').trim();
            const hasTaggedProject = Boolean(orderProjectCode);
            const projectCode = hasTaggedProject ? orderProjectCode : '__no_project__';
            const projectMeta = hasTaggedProject
                ? (projectMap[projectCode] || {
                    project: projectCode,
                    project_name: '',
                    customer: order.customer || '',
                    project_status: 'Project Missing',
                    [roleConfig.userField]: '',
                    [roleConfig.nameField]: 'Unassigned',
                    [roleConfig.imageField]: ''
                })
                : {
                    project: projectCode,
                    project_name: '',
                    customer: '',
                    project_status: 'No Project',
                    [roleConfig.userField]: '',
                    [roleConfig.nameField]: 'Unassigned / No Project',
                    [roleConfig.imageField]: ''
                };

            const ownerUser = (projectMeta[roleConfig.userField] || '').trim();
            const ownerKey = hasTaggedProject ? (ownerUser || 'unassigned') : 'unassigned_no_project';
            const ownerName = projectMeta[roleConfig.nameField] || ownerUser || 'Unassigned';
            const ownerImage = projectMeta[roleConfig.imageField] || '/assets/frappe/images/default-avatar.png';

            if (!owners[ownerKey]) {
                owners[ownerKey] = {
                    key: ownerKey,
                    owner_user: ownerUser,
                    owner_name: ownerName,
                    owner_image: ownerImage,
                    total_value: 0,
                    total_remaining: 0,
                    sales_order_count: 0,
                    projects_map: {}
                };
            }

            const owner = owners[ownerKey];
            const grandTotal = this.toNumber(order.grand_total);
            const remainingAmount = this.toNumber(order.remaining_amount);

            owner.total_value += grandTotal;
            owner.total_remaining += remainingAmount;
            owner.sales_order_count += 1;

            if (!owner.projects_map[projectCode]) {
                owner.projects_map[projectCode] = {
                    project: hasTaggedProject ? projectCode : 'No Project Tagged',
                    project_name: projectMeta.project_name || '',
                    customer: projectMeta.customer || order.customer || '',
                    project_status: projectMeta.project_status || 'Open',
                    expected_start_date: projectMeta.expected_start_date || '',
                    expected_end_date: projectMeta.expected_end_date || '',
                    orders: [],
                    total_value: 0,
                    total_remaining: 0,
                    so_status_map: {},
                    customers_map: {},
                    counts_as_project: hasTaggedProject,
                    can_open_project: hasTaggedProject
                };
            }

            const project = owner.projects_map[projectCode];
            project.orders.push(order);
            project.total_value += grandTotal;
            project.total_remaining += remainingAmount;
            if (order.customer) {
                project.customers_map[order.customer] = true;
            }

            const orderStatus = order.status || 'Unknown';
            project.so_status_map[orderStatus] = true;
        });

        return Object.values(owners)
            .map((owner) => {
                const projects = Object.values(owner.projects_map)
                    .map((project) => ({
                        ...project,
                        customer_names: Object.keys(project.customers_map || {}),
                        so_statuses: Object.keys(project.so_status_map || {}).sort()
                    }))
                    .sort((a, b) => {
                        const valueDiff = this.toNumber(b.total_value) - this.toNumber(a.total_value);
                        if (valueDiff !== 0) return valueDiff;
                        return (a.project || '').localeCompare(b.project || '');
                    });

                return {
                    ...owner,
                    projects,
                    project_count: projects.reduce((sum, project) => sum + (project.counts_as_project ? 1 : 0), 0)
                };
            })
            .sort((a, b) => {
                const valueDiff = this.toNumber(b.total_value) - this.toNumber(a.total_value);
                if (valueDiff !== 0) return valueDiff;
                return (a.owner_name || '').localeCompare(b.owner_name || '');
            });
    }

    getProjectOwnerStatusClass(projectStatus) {
        if (projectStatus === 'Completed') return 'status-completed';
        if (projectStatus === 'Cancelled' || projectStatus === 'Project Missing') return 'status-overdue';
        return 'status-normal';
    }

    parseProjectOwnerDate(dateValue) {
        if (!dateValue) return null;

        if (dateValue instanceof Date) {
            if (Number.isNaN(dateValue.getTime())) return null;
            const parsedDate = new Date(dateValue.getTime());
            parsedDate.setHours(0, 0, 0, 0);
            return parsedDate;
        }

        const rawValue = String(dateValue).trim();
        if (!rawValue) return null;

        let normalizedValue = rawValue;
        if (/^\d{2}-\d{2}-\d{4}$/.test(rawValue)) {
            const [day, month, year] = rawValue.split('-');
            normalizedValue = `${year}-${month}-${day}`;
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
            const parsedDate = new Date(`${normalizedValue}T00:00:00`);
            if (Number.isNaN(parsedDate.getTime())) return null;
            parsedDate.setHours(0, 0, 0, 0);
            return parsedDate;
        }

        const fallbackDate = new Date(rawValue);
        if (Number.isNaN(fallbackDate.getTime())) return null;
        fallbackDate.setHours(0, 0, 0, 0);
        return fallbackDate;
    }

    buildProjectOwnerBreakdownRows(orders, projectMap) {
        return (orders || []).map((order) => {
            const projectCode = (order.project || '').trim();
            const projectMeta = projectMap[projectCode] || {};
            const row = {
                project: projectCode || 'No Project Tagged',
                sales_order: order.name || '',
                customer: order.customer || '',
                delivery_date: order.delivery_date || '',
                sales_order_status: order.status || 'Unknown',
                sales_person: order.sales_person || 'Unassigned',
                value: this.toNumber(order.grand_total),
                remaining_value: this.toNumber(order.remaining_amount),
                project_status: projectMeta.project_status || '',
                expected_end_date: projectMeta.expected_end_date || '',
                production_incharge: projectMeta.production_manager_name || '-',
                production_incharge_user: projectMeta.production_manager_user || '',
                production_end_date: projectMeta.production_end_date || '',
                installation_in_charge: projectMeta.installation_manager_name || '-',
                installation_in_charge_user: projectMeta.installation_manager_user || '',
                installation_end_date: projectMeta.installation_end_date || '',
                site_supervisor: projectMeta.site_supervisor_name || '-',
                site_supervisor_user: projectMeta.site_supervisor_user || ''
            };

            const expectedEndDate = this.parseProjectOwnerDate(row.expected_end_date);
            const productionEndDate = this.parseProjectOwnerDate(row.production_end_date);
            const installationEndDate = this.parseProjectOwnerDate(row.installation_end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const projectIsCancelled = row.project_status === 'Cancelled';
            row.has_expected_end_date = Boolean(expectedEndDate && !Number.isNaN(expectedEndDate.getTime()));
            row.is_project_overdue = Boolean(
                row.has_expected_end_date &&
                !projectIsCancelled &&
                expectedEndDate < today
            );
            row.has_production_end_date = Boolean(productionEndDate && !Number.isNaN(productionEndDate.getTime()));
            row.has_installation_end_date = Boolean(installationEndDate && !Number.isNaN(installationEndDate.getTime()));
            row.is_production_delayed = Boolean(
                row.has_production_end_date &&
                !projectIsCancelled &&
                productionEndDate < today
            );
            row.is_installation_delayed = Boolean(
                row.has_installation_end_date &&
                !projectIsCancelled &&
                installationEndDate < today
            );
            row.production_delay_days = row.is_production_delayed
                ? Math.max(Math.ceil((today.getTime() - productionEndDate.getTime()) / (1000 * 60 * 60 * 24)), 0)
                : 0;
            row.installation_delay_days = row.is_installation_delayed
                ? Math.max(Math.ceil((today.getTime() - installationEndDate.getTime()) / (1000 * 60 * 60 * 24)), 0)
                : 0;

            row.searchText = [
                row.project,
                row.sales_order,
                row.customer,
                row.sales_order_status,
                row.sales_person,
                row.project_status,
                row.delivery_date,
                row.production_incharge,
                row.production_end_date,
                row.installation_in_charge,
                row.installation_end_date,
                row.site_supervisor
            ].join(' ').toLowerCase();

            return row;
        });
    }

    getProjectOwnerBreakdownDefaultState() {
        return {
            search: '',
            production_filter: 'all',
            installation_filter: 'all',
            supervisor_filter: 'all',
            delay_filter: 'all',
            sort_field: 'delivery_date',
            sort_order: 'asc'
        };
    }

    getProjectOwnerActiveAssignmentUser(row) {
        const roleToField = {
            production_manager: 'production_incharge_user',
            installation_manager: 'installation_in_charge_user',
            site_supervisor: 'site_supervisor_user'
        };
        const fieldName = roleToField[this.project_owner_active_role] || roleToField.production_manager;
        return (row && row[fieldName] ? String(row[fieldName]) : '').trim();
    }

    getProjectOwnerUniqueFilterValues(rows, fieldName) {
        return [...new Set((rows || [])
            .map((row) => (row && row[fieldName] ? String(row[fieldName]).trim() : ''))
            .filter(Boolean))]
            .sort((left, right) => left.localeCompare(right));
    }

    getProjectOwnerBreakdownSortValue(row, sortField) {
        switch (sortField) {
            case 'project':
                return `${row.project || ''} ${row.sales_order || ''}`.toLowerCase();
            case 'customer':
                return (row.customer || '').toLowerCase();
            case 'delivery_date':
                return row.delivery_date ? new Date(row.delivery_date).getTime() || 0 : 0;
            case 'value':
                return this.toNumber(row.value);
            case 'remaining_value':
                return this.toNumber(row.remaining_value);
            case 'production_incharge':
                return (row.production_incharge || '').toLowerCase();
            case 'installation_in_charge':
                return (row.installation_in_charge || '').toLowerCase();
            case 'site_supervisor':
                return (row.site_supervisor || '').toLowerCase();
            default:
                return (row[sortField] || '').toString().toLowerCase();
        }
    }

    getProjectOwnerBreakdownDisplayRows(rows, state) {
        const searchTerm = (state.search || '').trim().toLowerCase();
        const productionFilter = state.production_filter || 'all';
        const installationFilter = state.installation_filter || 'all';
        const supervisorFilter = state.supervisor_filter || 'all';
        const delayFilter = state.delay_filter || 'all';
        const sortField = state.sort_field || 'delivery_date';
        const sortOrder = state.sort_order || 'asc';

        const filteredRows = (rows || []).filter((row) => {
            if (searchTerm && !(row.searchText || '').includes(searchTerm)) {
                return false;
            }

            if (productionFilter !== 'all' && (row.production_incharge || '') !== productionFilter) {
                return false;
            }

            if (installationFilter !== 'all' && (row.installation_in_charge || '') !== installationFilter) {
                return false;
            }

            if (supervisorFilter !== 'all' && (row.site_supervisor || '') !== supervisorFilter) {
                return false;
            }

            if (delayFilter === 'production-delayed' && !row.is_production_delayed) {
                return false;
            }

            if (delayFilter === 'installation-delayed' && !row.is_installation_delayed) {
                return false;
            }

            if (delayFilter === 'any-delayed' && !row.is_production_delayed && !row.is_installation_delayed) {
                return false;
            }

            if (delayFilter === 'both-delayed' && (!row.is_production_delayed || !row.is_installation_delayed)) {
                return false;
            }

            if (delayFilter === 'on-track' && (row.is_production_delayed || row.is_installation_delayed)) {
                return false;
            }

            return true;
        });

        filteredRows.sort((left, right) => {
            const leftValue = this.getProjectOwnerBreakdownSortValue(left, sortField);
            const rightValue = this.getProjectOwnerBreakdownSortValue(right, sortField);

            if (leftValue < rightValue) return sortOrder === 'asc' ? -1 : 1;
            if (leftValue > rightValue) return sortOrder === 'asc' ? 1 : -1;
            return (left.sales_order || '').localeCompare(right.sales_order || '');
        });

        return filteredRows;
    }

    renderProjectOwnerAssignmentCell(name, dateValue, dateLabel, options = {}) {
        const safeName = this.escapeHtml(name || '-');
        const hasDate = Boolean(dateValue);
        const dateText = hasDate ? frappe.datetime.str_to_user(dateValue) : '';
        const isDelayed = Boolean(options.isDelayed);
        const delayDays = Number(options.delayDays || 0);
        const overdueText = delayDays === 1 ? '1 day overdue' : `${delayDays} days overdue`;
        const dateStyle = isDelayed
            ? 'display: inline-flex; align-items: center; gap: 4px; width: fit-content; padding: 2px 8px; border-radius: 999px; background: rgba(239, 68, 68, 0.12); color: #b91c1c; font-size: 11px; font-weight: 700;'
            : 'font-size: 11px; color: var(--text-muted);';

        return `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 600; color: var(--text);">${safeName}</span>
                ${hasDate ? `
                    <span style="${dateStyle}">
                        ${this.escapeHtml(dateLabel)}: ${this.escapeHtml(dateText)}
                    </span>
                ` : ''}
                ${isDelayed ? `
                    <span style="font-size: 10px; font-weight: 700; color: var(--error); text-transform: uppercase; letter-spacing: 0.03em;">
                        Overdue: ${this.escapeHtml(overdueText)}
                    </span>
                ` : ''}
            </div>
        `;
    }

    getProjectOwnerDelayBucketLabel(days) {
        if (days >= 1 && days <= 3) return '1-3 Days';
        if (days >= 4 && days <= 7) return '4-7 Days';
        if (days >= 8) return '8+ Days';
        return '';
    }

    buildProjectOwnerDelayProjectSummary(tableRows) {
        const rowGroupsByProject = {};
        (tableRows || []).forEach((row) => {
            const projectCode = (row && row.project ? String(row.project).trim() : '');
            if (!projectCode || projectCode === 'No Project Tagged') return;
            if (!rowGroupsByProject[projectCode]) {
                rowGroupsByProject[projectCode] = [];
            }
            rowGroupsByProject[projectCode].push(row);
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const productionProjects = [];
        const installationProjects = [];

        (this.project_owner_mapping_rows || []).forEach((project) => {
            const projectCode = (project && project.project ? String(project.project).trim() : '');
            if (!projectCode) return;

            const projectStatus = (project.project_status || '').trim();
            if (projectStatus === 'Cancelled') return;

            const linkedRows = rowGroupsByProject[projectCode] || [];
            const productionEndDate = this.parseProjectOwnerDate(project.production_end_date);
            const installationEndDate = this.parseProjectOwnerDate(project.installation_end_date);

            if (productionEndDate && productionEndDate < today) {
                productionProjects.push({
                    project: projectCode,
                    project_status: projectStatus || 'Open',
                    customer: project.customer || '',
                    delay_days: Math.max(Math.ceil((today.getTime() - productionEndDate.getTime()) / (1000 * 60 * 60 * 24)), 0),
                    remaining_total: linkedRows.reduce((sum, row) => sum + this.toNumber(row.remaining_value), 0),
                    rows: linkedRows
                });
            }

            if (installationEndDate && installationEndDate < today) {
                installationProjects.push({
                    project: projectCode,
                    project_status: projectStatus || 'Open',
                    customer: project.customer || '',
                    delay_days: Math.max(Math.ceil((today.getTime() - installationEndDate.getTime()) / (1000 * 60 * 60 * 24)), 0),
                    remaining_total: linkedRows.reduce((sum, row) => sum + this.toNumber(row.remaining_value), 0),
                    rows: linkedRows
                });
            }
        });

        return {
            productionProjects,
            installationProjects
        };
    }

    getProjectOwnerDelayBucketSummary(projects, delayType) {
        const bucketConfigs = [
            { key: '1-3', label: '1-3 Days', min: 1, max: 3 },
            { key: '4-7', label: '4-7 Days', min: 4, max: 7 },
            { key: '8+', label: '8+ Days', min: 8, max: Infinity }
        ];

        return bucketConfigs.map((bucket) => {
            const bucketProjects = (projects || []).filter((project) => {
                const delayDays = Number(project.delay_days || 0);
                return delayDays >= bucket.min && delayDays <= bucket.max;
            });
            const bucketRows = bucketProjects.flatMap((project) => project.rows || []);

            return {
                ...bucket,
                projects: bucketProjects,
                rows: bucketRows,
                count: bucketProjects.length,
                remaining_total: bucketProjects.reduce((sum, project) => sum + this.toNumber(project.remaining_total), 0)
            };
        });
    }

    renderProjectOwnerRowBadges(row) {
        const badges = [];

        if ((row.project || '') === 'No Project Tagged') {
            badges.push('<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(15, 23, 42, 0.08); color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">No Project</span>');
        }
        if (row.is_project_overdue) {
            badges.push('<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(239, 68, 68, 0.10); color: #b91c1c; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Project Overdue</span>');
        }
        if (row.is_production_delayed) {
            badges.push('<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(220, 38, 38, 0.12); color: #991b1b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Production Delayed</span>');
        }
        if (row.is_installation_delayed) {
            badges.push('<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(245, 158, 11, 0.16); color: #92400e; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Installation Delayed</span>');
        }

        if (!badges.length) return '';

        return `
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                ${badges.join('')}
            </div>
        `;
    }

    renderProjectOwnerProjectCell(row) {
        const projectName = row.project || '';
        const salesOrder = this.escapeHtml(row.sales_order || '-');
        const canOpenProject = Boolean(projectName && projectName !== 'No Project Tagged');
        const badgesHtml = this.renderProjectOwnerRowBadges(row);

        if (!canOpenProject) {
            return `
                <div style="font-weight: 700; color: var(--primary);">${this.escapeHtml(projectName || 'No Project Tagged')}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${salesOrder}</div>
                ${badgesHtml}
            `;
        }

        return `
            <button
                type="button"
                data-project-owner-open-project="${this.escapeHtml(projectName)}"
                style="background: none; border: none; padding: 0; margin: 0; font-weight: 700; color: var(--primary); text-decoration: none; cursor: pointer; text-align: left;">
                ${this.escapeHtml(projectName)}
            </button>
            <div style="font-size: 11px; color: var(--text-muted);">${salesOrder}</div>
            ${badgesHtml}
        `;
    }

    renderProjectOwnerSortHeader(label, fieldName, state) {
        const isActive = state.sort_field === fieldName;
        const arrow = isActive ? (state.sort_order === 'asc' ? '↑' : '↓') : '↕';

        return `
            <button type="button"
                data-project-owner-sort="${this.escapeHtml(fieldName)}"
                style="display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer; font-weight: 700;">
                <span>${this.escapeHtml(label)}</span>
                <span style="font-size: 11px; color: ${isActive ? 'var(--primary)' : 'var(--text-muted)'};">${arrow}</span>
            </button>
        `;
    }

    renderProjectOwnerBreakdownTable(rows, options = {}) {
        const state = options.state || this.getProjectOwnerBreakdownDefaultState();
        const namespace = options.namespace || 'project-owner-breakdown';
        const emptyMessage = options.emptyMessage || 'No sales orders found';
        const visibleRows = this.getProjectOwnerBreakdownDisplayRows(rows, state);
        const productionOptions = this.getProjectOwnerUniqueFilterValues(rows, 'production_incharge');
        const installationOptions = this.getProjectOwnerUniqueFilterValues(rows, 'installation_in_charge');
        const supervisorOptions = this.getProjectOwnerUniqueFilterValues(rows, 'site_supervisor');

        return `
            <div style="display: grid; gap: var(--space-4);">
                <div style="display: grid; gap: var(--space-3);">
                    <div style="display: flex; align-items: flex-end; gap: var(--space-3); flex-wrap: wrap;">
                        <div class="filter-group" style="flex: 1 1 320px; min-width: 320px; max-width: 380px;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Global Search</label>
                            <div class="table-search-box" style="min-width: 0;">
                                <i class="fa fa-search table-search-icon" style="color: var(--text-muted);"></i>
                                <input
                                    type="text"
                                    class="table-search-input"
                                    data-project-owner-search="${this.escapeHtml(namespace)}"
                                    placeholder="Search project, customer, sales order..."
                                    value="${this.escapeHtml(state.search || '')}"
                                    style="height: 38px; background: var(--surface); color: var(--text); border: 1px solid var(--border); backdrop-filter: none;">
                            </div>
                        </div>
                        <div class="filter-group">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Production</label>
                            <select
                                data-project-owner-production-filter="${this.escapeHtml(namespace)}"
                                class="project-filter-control"
                                style="min-width: 180px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600;">
                                <option value="all" ${state.production_filter === 'all' ? 'selected' : ''}>All Production</option>
                                ${productionOptions.map((option) => `
                                    <option value="${this.escapeHtml(option)}" ${state.production_filter === option ? 'selected' : ''}>${this.escapeHtml(option)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Installation</label>
                            <select
                                data-project-owner-installation-filter="${this.escapeHtml(namespace)}"
                                class="project-filter-control"
                                style="min-width: 180px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600;">
                                <option value="all" ${state.installation_filter === 'all' ? 'selected' : ''}>All Installation</option>
                                ${installationOptions.map((option) => `
                                    <option value="${this.escapeHtml(option)}" ${state.installation_filter === option ? 'selected' : ''}>${this.escapeHtml(option)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Supervisor</label>
                            <select
                                data-project-owner-supervisor-filter="${this.escapeHtml(namespace)}"
                                class="project-filter-control"
                                style="min-width: 180px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600;">
                                <option value="all" ${state.supervisor_filter === 'all' ? 'selected' : ''}>All Supervisors</option>
                                ${supervisorOptions.map((option) => `
                                    <option value="${this.escapeHtml(option)}" ${state.supervisor_filter === option ? 'selected' : ''}>${this.escapeHtml(option)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Delay</label>
                            <select
                                data-project-owner-delay-filter="${this.escapeHtml(namespace)}"
                                class="project-filter-control"
                                style="min-width: 190px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600;">
                                <option value="all" ${state.delay_filter === 'all' ? 'selected' : ''}>All Delay Status</option>
                                <option value="production-delayed" ${state.delay_filter === 'production-delayed' ? 'selected' : ''}>Delay Production</option>
                                <option value="installation-delayed" ${state.delay_filter === 'installation-delayed' ? 'selected' : ''}>Delay Installation</option>
                                <option value="any-delayed" ${state.delay_filter === 'any-delayed' ? 'selected' : ''}>Any Delay</option>
                                <option value="both-delayed" ${state.delay_filter === 'both-delayed' ? 'selected' : ''}>Both Delayed</option>
                                <option value="on-track" ${state.delay_filter === 'on-track' ? 'selected' : ''}>On Track</option>
                            </select>
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-align: right;">
                        Showing ${visibleRows.length} of ${(rows || []).length} rows
                    </div>
                </div>

                <div class="table-body" style="overflow-x: auto;">
                    <table class="data-table" style="min-width: 1350px;">
                        <thead>
                            <tr>
                                <th>${this.renderProjectOwnerSortHeader('Project', 'project', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Customer', 'customer', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Delivery Date', 'delivery_date', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Order Value', 'value', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Remaining Value', 'remaining_value', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Production Incharge', 'production_incharge', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Installation In Charge', 'installation_in_charge', state)}</th>
                                <th>${this.renderProjectOwnerSortHeader('Site Supervisor', 'site_supervisor', state)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visibleRows.length ? visibleRows.map((row) => `
                                <tr>
                                    <td>
                                        ${this.renderProjectOwnerProjectCell(row)}
                                    </td>
                                    <td>
                                        <div>${this.escapeHtml(row.customer || '-')}</div>
                                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                                            ${this.escapeHtml(row.sales_person || 'Unassigned')}
                                        </div>
                                    </td>
                                    <td>${row.delivery_date ? this.escapeHtml(frappe.datetime.str_to_user(row.delivery_date)) : '-'}</td>
                                    <td><strong>${frappe.format(this.toNumber(row.value), { fieldtype: 'Currency' })}</strong></td>
                                    <td><strong>${frappe.format(this.toNumber(row.remaining_value), { fieldtype: 'Currency' })}</strong></td>
                                    <td>${this.renderProjectOwnerAssignmentCell(row.production_incharge, row.production_end_date, 'End', { isDelayed: row.is_production_delayed, delayDays: row.production_delay_days })}</td>
                                    <td>${this.renderProjectOwnerAssignmentCell(row.installation_in_charge, row.installation_end_date, 'End', { isDelayed: row.is_installation_delayed, delayDays: row.installation_delay_days })}</td>
                                    <td>${this.renderProjectOwnerAssignmentCell(row.site_supervisor, row.installation_end_date, 'End')}</td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="8" style="text-align:center; padding: var(--space-6); color: var(--text-muted);">
                                        ${this.escapeHtml(emptyMessage)}
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    mountProjectOwnerBreakdownTable(container, rows, options = {}) {
        const state = options.state || this.getProjectOwnerBreakdownDefaultState();
        const namespace = options.namespace || 'project-owner-breakdown';
        const render = () => {
            const activeElement = document.activeElement;
            const activeSearchNamespace = activeElement ? activeElement.getAttribute('data-project-owner-search') : '';
            const shouldRestoreSearchFocus = activeSearchNamespace === namespace;
            const searchSelectionStart = shouldRestoreSearchFocus && typeof activeElement.selectionStart === 'number'
                ? activeElement.selectionStart
                : null;
            const searchSelectionEnd = shouldRestoreSearchFocus && typeof activeElement.selectionEnd === 'number'
                ? activeElement.selectionEnd
                : null;

            container.html(this.renderProjectOwnerBreakdownTable(rows, { ...options, namespace, state }));

            container.find(`[data-project-owner-search="${namespace}"]`).on('input', (e) => {
                state.search = e.currentTarget.value || '';
                render();
            });

            container.find(`[data-project-owner-production-filter="${namespace}"]`).on('change', (e) => {
                state.production_filter = e.currentTarget.value || 'all';
                render();
            });

            container.find(`[data-project-owner-installation-filter="${namespace}"]`).on('change', (e) => {
                state.installation_filter = e.currentTarget.value || 'all';
                render();
            });

            container.find(`[data-project-owner-supervisor-filter="${namespace}"]`).on('change', (e) => {
                state.supervisor_filter = e.currentTarget.value || 'all';
                render();
            });

            container.find(`[data-project-owner-delay-filter="${namespace}"]`).on('change', (e) => {
                state.delay_filter = e.currentTarget.value || 'all';
                render();
            });

            container.find('[data-project-owner-sort]').on('click', (e) => {
                const nextField = $(e.currentTarget).data('projectOwnerSort');
                if (!nextField) return;

                if (state.sort_field === nextField) {
                    state.sort_order = state.sort_order === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sort_field = nextField;
                    state.sort_order = nextField === 'project' || nextField === 'customer' ? 'asc' : 'desc';
                }

                render();
            });

            container.find('[data-project-owner-open-project]').on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const projectName = $(e.currentTarget).data('projectOwnerOpenProject');
                if (!projectName) return;
                window.open(`/app/project/${encodeURIComponent(projectName)}`, '_blank');
            });

            if (shouldRestoreSearchFocus) {
                const searchInput = container.find(`[data-project-owner-search="${namespace}"]`).get(0);
                if (searchInput) {
                    searchInput.focus();
                    if (typeof searchSelectionStart === 'number' && typeof searchSelectionEnd === 'number') {
                        searchInput.setSelectionRange(searchSelectionStart, searchSelectionEnd);
                    }
                }
            }
        };

        render();
    }

    showProjectOwnerDetailModal(owner, projectMap, roleLabel) {
        const ownerOrders = owner.projects.reduce((accumulator, project) => accumulator.concat(project.orders || []), []);
        const rows = this.buildProjectOwnerBreakdownRows(ownerOrders, projectMap);
        const totalValue = rows.reduce((sum, row) => sum + this.toNumber(row.value), 0);
        const totalRemaining = rows.reduce((sum, row) => sum + this.toNumber(row.remaining_value), 0);

        this.main_modal.find('.modal-title').text(`${roleLabel}: ${owner.owner_name || 'Unassigned'}`);

        this.main_modal.find('.modal-body').html(`
            <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                <div class="table-modern-header" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: var(--space-4);">
                        <img src="${this.escapeHtml(owner.owner_image || '/assets/frappe/images/default-avatar.png')}" alt="${this.escapeHtml(owner.owner_name || 'Unassigned')}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(100, 116, 139, 0.18);" onerror="this.src='/assets/frappe/images/default-avatar.png'">
                        <div>
                            <div class="table-modern-title" style="margin: 0;">${this.escapeHtml(owner.owner_name || 'Unassigned')}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">${this.escapeHtml(owner.owner_user || 'No linked user')}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(15, 23, 42, 0.04); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Projects</div>
                            <div style="font-size: 1rem; font-weight: 700; color: var(--text);">${owner.project_count}</div>
                        </div>
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(59, 130, 246, 0.08); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Sales Orders</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #1d4ed8;">${rows.length}</div>
                        </div>
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(16, 185, 129, 0.09); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Value</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #047857;">${frappe.format(totalValue, { fieldtype: 'Currency' })}</div>
                        </div>
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(239, 68, 68, 0.08); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Remaining</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #b91c1c;">${frappe.format(totalRemaining, { fieldtype: 'Currency' })}</div>
                        </div>
                    </div>
                </div>
                <div id="project-owner-detail-table-section"></div>
            </div>
        `);

        this.mountProjectOwnerBreakdownTable(
            this.main_modal.find('#project-owner-detail-table-section'),
            rows,
            {
                namespace: 'project-owner-detail',
                state: this.getProjectOwnerBreakdownDefaultState(),
                emptyMessage: 'No sales orders found'
            }
        );

        this.main_modal.fadeIn(300);
    }

    showProjectOwnerRowsModal(title, subtitle, rows) {
        const totalValue = (rows || []).reduce((sum, row) => sum + this.toNumber(row.value), 0);
        const totalRemaining = (rows || []).reduce((sum, row) => sum + this.toNumber(row.remaining_value), 0);
        const totalProjects = new Set((rows || []).map((row) => row.project).filter(Boolean)).size;

        this.main_modal.find('.modal-title').text(title || 'Project Owner Details');

        this.main_modal.find('.modal-body').html(`
            <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                <div class="table-modern-header" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                    <div>
                        <div class="table-modern-title" style="margin: 0;">${this.escapeHtml(title || 'Project Owner Details')}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            ${this.escapeHtml(subtitle || 'Detailed delayed rows')}
                        </div>
                    </div>
                    <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(15, 23, 42, 0.04); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Projects</div>
                            <div style="font-size: 1rem; font-weight: 700; color: var(--text);">${totalProjects}</div>
                        </div>
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(59, 130, 246, 0.08); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Sales Orders</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #1d4ed8;">${(rows || []).length}</div>
                        </div>
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(16, 185, 129, 0.09); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Value</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #047857;">${frappe.format(totalValue, { fieldtype: 'Currency' })}</div>
                        </div>
                        <div style="padding: var(--space-3) var(--space-4); background: rgba(239, 68, 68, 0.08); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Remaining</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #b91c1c;">${frappe.format(totalRemaining, { fieldtype: 'Currency' })}</div>
                        </div>
                    </div>
                </div>
                <div id="project-owner-kpi-table-section"></div>
            </div>
        `);

        this.mountProjectOwnerBreakdownTable(
            this.main_modal.find('#project-owner-kpi-table-section'),
            rows || [],
            {
                namespace: 'project-owner-kpi',
                state: this.getProjectOwnerBreakdownDefaultState(),
                emptyMessage: 'No rows found'
            }
        );

        this.main_modal.fadeIn(300);
    }

    renderProjectOwnerView() {
        this.content_area.html(`
            <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                    <i class="fa fa-spinner fa-spin" style="font-size: 1.75rem; margin-bottom: var(--space-3);"></i>
                    <div>Loading project owner data...</div>
                </div>
            </div>
        `);

        this.ensureProjectOwnerMappingLoaded().then(() => {
            if (this.current_view !== 'project-owner') return;
            this.renderProjectOwnerViewContent();
        });
    }

    renderProjectOwnerViewContent() {
        const roleConfig = this.getProjectOwnerRoleConfig();
        const owners = this.buildProjectOwnerData();
        const totalOrdersInView = this.filtered_orders.length;
        const projectMap = {};
        (this.project_owner_mapping_rows || []).forEach((row) => {
            const projectCode = (row.project || '').trim();
            if (!projectCode) return;
            projectMap[projectCode] = row;
        });

        if (!owners.length) {
            this.content_area.html(`
                <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                    <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                        <i class="fa fa-user-circle" style="font-size: 2.5rem; margin-bottom: var(--space-4);"></i>
                        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: var(--space-2);">No ${this.escapeHtml(roleConfig.label)} data found</div>
                        <div>There are no filtered pending sales orders in the current result.</div>
                        <div style="margin-top: var(--space-2); font-size: 0.85rem;">Filtered sales orders: ${totalOrdersInView}</div>
                    </div>
                </div>
            `);
            return;
        }

        const totalProjects = owners.reduce((sum, owner) => sum + owner.project_count, 0);
        const totalSalesOrders = owners.reduce((sum, owner) => sum + owner.sales_order_count, 0);
        const totalValue = owners.reduce((sum, owner) => sum + this.toNumber(owner.total_value), 0);
        const totalRemaining = owners.reduce((sum, owner) => sum + this.toNumber(owner.total_remaining), 0);
        const tableRows = owners.flatMap((owner) => {
            const ownerOrders = owner.projects.reduce((accumulator, project) => accumulator.concat(project.orders || []), []);
            return this.buildProjectOwnerBreakdownRows(ownerOrders, projectMap);
        });
        const delaySummary = this.buildProjectOwnerDelayProjectSummary(tableRows);
        const productionDelayedProjects = delaySummary.productionProjects || [];
        const installationDelayedProjects = delaySummary.installationProjects || [];
        const productionDelayedRows = productionDelayedProjects.flatMap((project) => project.rows || []);
        const installationDelayedRows = installationDelayedProjects.flatMap((project) => project.rows || []);
        const productionDelayedProjectCount = productionDelayedProjects.length;
        const installationDelayedProjectCount = installationDelayedProjects.length;
        const productionDelayBuckets = this.getProjectOwnerDelayBucketSummary(productionDelayedProjects, 'production');
        const installationDelayBuckets = this.getProjectOwnerDelayBucketSummary(installationDelayedProjects, 'installation');
        const roleTabsHtml = ['production_manager', 'installation_manager', 'site_supervisor'].map((roleKey) => {
            const config = {
                production_manager: { label: 'Production Incharge' },
                installation_manager: { label: 'Installation In Charge' },
                site_supervisor: { label: 'Site Supervisor' }
            }[roleKey];
            const isActive = this.project_owner_active_role === roleKey;
            return `
                <button type="button"
                    data-project-owner-role="${roleKey}"
                    style="border: ${isActive ? '1px solid rgba(255,255,255,0.75)' : '1px solid rgba(255,255,255,0.25)'}; background: ${isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}; color: white; padding: 10px 16px; border-radius: 999px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: var(--transition-fast);">
                    ${config.label}
                </button>
            `;
        }).join('');

        const cardsHtml = owners.map((owner) => {
            const ownerImage = this.escapeHtml(owner.owner_image || '/assets/frappe/images/default-avatar.png');
            const ownerName = this.escapeHtml(owner.owner_name || 'Unassigned');
            const ownerUser = this.escapeHtml(owner.owner_user || 'Unassigned');

            return `
                <button type="button"
                    data-project-owner-card="1"
                    data-owner-key="${this.escapeHtml(owner.key)}"
                    style="text-align: left; border: 1px solid var(--border-light); background: var(--surface-card); border-radius: var(--radius-xl); padding: var(--space-5); box-shadow: var(--shadow-sm); transition: var(--transition-fast); display: flex; flex-direction: column; gap: var(--space-4); cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: var(--space-4);">
                        <img src="${ownerImage}" alt="${ownerName}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(100, 116, 139, 0.18);" onerror="this.src='/assets/frappe/images/default-avatar.png'">
                        <div style="min-width: 0;">
                            <div style="font-size: 1rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ownerName}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ownerUser}</div>
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 1.7rem; font-weight: 800; color: var(--primary); line-height: 1;">${owner.sales_order_count}</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Pending Sales Orders</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3);">
                        <div style="padding: var(--space-3); background: rgba(15, 23, 42, 0.04); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Projects</div>
                            <div style="font-size: 1.05rem; font-weight: 700; color: var(--text);">${owner.project_count}</div>
                        </div>
                        <div style="padding: var(--space-3); background: rgba(59, 130, 246, 0.08); border-radius: var(--radius-lg);">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Remaining</div>
                            <div style="font-size: 0.92rem; font-weight: 700; color: #1d4ed8;">${frappe.format(owner.total_remaining, { fieldtype: 'Currency' })}</div>
                        </div>
                    </div>
                    <div style="padding: var(--space-3); background: rgba(16, 185, 129, 0.09); border-radius: var(--radius-lg);">
                        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Order Value</div>
                        <div style="font-size: 1rem; font-weight: 700; color: #047857;">${frappe.format(owner.total_value, { fieldtype: 'Currency' })}</div>
                    </div>
                </button>
            `;
        }).join('');

        const kpiCardsHtml = [
            {
                key: 'production-delayed',
                label: 'Production Delayed',
                count: productionDelayedProjectCount,
                total: productionDelayedProjects.reduce((sum, project) => sum + this.toNumber(project.remaining_total), 0),
                icon: 'fa-industry',
                bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.10) 0%, rgba(248, 113, 113, 0.18) 100%)',
                color: '#b91c1c'
            },
            {
                key: 'installation-delayed',
                label: 'Installation Delayed',
                count: installationDelayedProjectCount,
                total: installationDelayedProjects.reduce((sum, project) => sum + this.toNumber(project.remaining_total), 0),
                icon: 'fa-wrench',
                bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.20) 100%)',
                color: '#b45309'
            }
        ].map((card) => `
            <button
                type="button"
                data-project-owner-kpi-card="${card.key}"
                style="text-align: left; border: 1px solid var(--border-light); background: ${card.bg}; border-radius: var(--radius-xl); padding: var(--space-5); box-shadow: var(--shadow-sm); transition: var(--transition-fast); display: flex; flex-direction: column; gap: var(--space-4); cursor: pointer;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);">
                    <div style="font-size: 0.82rem; font-weight: 800; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em;">${card.label}</div>
                    <div style="width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.75); color: ${card.color};">
                        <i class="fa ${card.icon}"></i>
                    </div>
                </div>
                <div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: ${card.color}; line-height: 1;">${card.count}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Projects</div>
                </div>
                <div style="padding: var(--space-3); background: rgba(255,255,255,0.65); border-radius: var(--radius-lg);">
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Remaining Value</div>
                    <div style="font-size: 1rem; font-weight: 700; color: ${card.color};">${frappe.format(card.total, { fieldtype: 'Currency' })}</div>
                </div>
            </button>
        `).join('');

        const delayBucketCardsHtml = [
            {
                type: 'production',
                title: 'Production Aging',
                color: '#b91c1c',
                icon: 'fa-industry',
                buckets: productionDelayBuckets
            },
            {
                type: 'installation',
                title: 'Installation Aging',
                color: '#b45309',
                icon: 'fa-wrench',
                buckets: installationDelayBuckets
            }
        ].map((group) => `
            <div style="border: 1px solid var(--border-light); background: var(--surface-card); border-radius: var(--radius-xl); padding: var(--space-5); box-shadow: var(--shadow-sm); display: grid; gap: var(--space-4);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);">
                    <div>
                        <div style="font-size: 0.82rem; font-weight: 800; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em;">${group.title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Delay aging buckets</div>
                    </div>
                    <div style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.05); color: ${group.color};">
                        <i class="fa ${group.icon}"></i>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3);">
                    ${group.buckets.map((bucket) => `
                        <button
                            type="button"
                            data-project-owner-delay-bucket="${group.type}:${bucket.key}"
                            style="text-align: left; border: 1px solid var(--border-light); background: rgba(255,255,255,0.75); border-radius: var(--radius-lg); padding: var(--space-3); display: grid; gap: 4px; cursor: pointer;">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">${bucket.label}</div>
                            <div style="font-size: 1.2rem; font-weight: 800; color: ${group.color}; line-height: 1;">${bucket.count}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${frappe.format(bucket.remaining_total, { fieldtype: 'Currency' })}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        this.content_area.html(`
            <div style="display: grid; gap: var(--space-6);">
                <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                    <div class="table-toolbar" style="padding: var(--space-4); background:#9ca3af; border-radius: var(--radius-lg); color: white; display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                        <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; width: 100%; align-items: center; justify-content: space-between;">
                            <div style="font-size: 0.92rem; font-weight: 800; letter-spacing: 0.03em;">Project Owner View: ${this.escapeHtml(roleConfig.label)}</div>
                            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                                ${roleTabsHtml}
                            </div>
                        </div>
                        <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; font-weight: 600;">
                            <span>${this.escapeHtml(roleConfig.label)}s: ${owners.length}</span>
                            <span>| Projects: ${totalProjects}</span>
                            <span>| Sales Orders: ${totalSalesOrders}</span>
                            <span>| Value: ${frappe.format(totalValue, { fieldtype: 'Currency' })}</span>
                            <span>| Remaining: ${frappe.format(totalRemaining, { fieldtype: 'Currency' })}</span>
                        </div>
                        <div style="font-size: 0.85rem; font-weight: 600;">
                            Click a card to open detailed rows
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
                    ${kpiCardsHtml}
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4);">
                    ${delayBucketCardsHtml}
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">
                    ${cardsHtml}
                </div>

                <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                    <div class="table-modern-header" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                        <div>
                            <div class="table-modern-title" style="margin: 0;">Table View</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">
                                Detailed sales order rows for ${this.escapeHtml(roleConfig.label)}
                            </div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                            Rows: ${tableRows.length}
                        </div>
                    </div>
                    <div id="project-owner-main-table-section"></div>
                </div>
            </div>
        `);

        this.mountProjectOwnerBreakdownTable(
            this.content_area.find('#project-owner-main-table-section'),
            tableRows,
            {
                namespace: 'project-owner-main',
                state: this.project_owner_table_state,
                emptyMessage: `No ${roleConfig.label} sales order rows found`
            }
        );

        this.content_area.find('[data-project-owner-card]').on('click', (e) => {
            const ownerKey = $(e.currentTarget).data('ownerKey');
            const owner = owners.find(item => item.key === ownerKey);
            if (!owner) return;
            this.showProjectOwnerDetailModal(owner, projectMap, roleConfig.label);
        });

        this.content_area.find('[data-project-owner-kpi-card]').on('click', (e) => {
            const kpiKey = $(e.currentTarget).data('projectOwnerKpiCard');
            if (kpiKey === 'production-delayed') {
                this.showProjectOwnerRowsModal('Production Delayed', 'Projects with delayed production end date. Modal shows linked pending sales order rows when available.', productionDelayedRows);
                return;
            }
            if (kpiKey === 'installation-delayed') {
                this.showProjectOwnerRowsModal('Installation Delayed', 'Projects with delayed installation end date. Modal shows linked pending sales order rows when available.', installationDelayedRows);
            }
        });

        this.content_area.find('[data-project-owner-delay-bucket]').on('click', (e) => {
            const bucketKey = $(e.currentTarget).data('projectOwnerDelayBucket');
            if (!bucketKey) return;

            const [delayType, bucketRange] = String(bucketKey).split(':');
            const bucketSource = delayType === 'production' ? productionDelayBuckets : installationDelayBuckets;
            const bucket = (bucketSource || []).find((item) => item.key === bucketRange);
            if (!bucket) return;

            const modalTitle = `${delayType === 'production' ? 'Production' : 'Installation'} Aging: ${bucket.label}`;
            const modalSubtitle = `${delayType === 'production' ? 'Production' : 'Installation'} delayed rows in the ${bucket.label.toLowerCase()} bucket`;
            this.showProjectOwnerRowsModal(modalTitle, modalSubtitle, bucket.rows || []);
        });

        this.content_area.find('[data-project-owner-role]').on('click', (e) => {
            this.project_owner_active_role = $(e.currentTarget).data('projectOwnerRole');
            this.project_owner_selected_key = null;
            this.renderProjectOwnerViewContent();
        });
    }

    renderProjectOverviewTable() {
        this.content_area.html(`
        <div class="table-modern-container" style="box-shadow: none; margin: 0;">
            <div class="table-toolbar" style="padding: var(--space-4); background:#9ca3af; border-radius: var(--radius-lg); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                <div id="project-overview-stats" style="display: flex; gap: var(--space-3); align-items: center; color: white; font-weight: 600;">
                    <span>Loading projects...</span>
                </div>
                <div style="display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap;">
                    <div class="table-search-box" style="min-width: 200px;">
                        <i class="fa fa-search table-search-icon" style="color: white;"></i>
                        <input type="text" class="table-search-input" placeholder="Search..." id="project-overview-search" style="background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);">
                    </div>
                    
                    <!-- Multi-select for Project Status -->
                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Project Status</label>
                        <div class="multi-select-container" id="project-status-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <!-- Multi-select for SO Status -->
                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">SO Status</label>
                        <div class="multi-select-container" id="so-status-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Quick Filter</label>
                        <select id="project-overview-filter" class="project-filter-control" style="min-width: 150px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600;">
                            <option value="all">All Items</option>
                            <option value="with-so">With Sales Orders</option>
                            <option value="without-so">Without Sales Orders</option>
                            <option value="overdue">Overdue Projects</option>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Start Date From</label>
                        <input type="date" id="project-start-date-from" class="project-filter-control" style="min-width: 150px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600; padding: 0 10px;">
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Start Date To</label>
                        <input type="date" id="project-start-date-to" class="project-filter-control" style="min-width: 150px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600; padding: 0 10px;">
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">End Date From</label>
                        <input type="date" id="project-end-date-from" class="project-filter-control" style="min-width: 150px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600; padding: 0 10px;">
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">End Date To</label>
                        <input type="date" id="project-end-date-to" class="project-filter-control" style="min-width: 150px; height: 38px; background: rgba(255, 255, 255, 0.95); border-radius: var(--radius-lg); border: 1px solid var(--border); font-size: 0.9rem; font-weight: 600; padding: 0 10px;">
                    </div>

                    <button class="btn btn-default" id="clear-project-date-filters" style="padding: var(--space-2) var(--space-4); background: rgba(255, 255, 255, 0.12); color: white; border: 1px solid rgba(255, 255, 255, 0.3);">
                        <i class="fa fa-eraser"></i> Clear Dates
                    </button>
                    <button class="btn btn-primary" id="export-project-overview" style="padding: var(--space-2) var(--space-4); background: white; color: #9ca3af; border-color: white;">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
            </div>
            <div class="table-body">
                <table class="data-table" id="project-overview-table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Customer</th>
                            <th>SO Tagged</th>
                            <th>SO Status</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Overdue Days</th>
                            <th>Disputes</th>
                            <th>Issues</th>
                            <th>Project Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="11" style="text-align: center; padding: var(--space-6);">
                            <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-muted);"></i>
                        </td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `);

        this.fetchProjectOverviewData().then((result) => {
            const projects = result.projects || [];
            const summary = result.summary || {};
            this.project_overview_rows = projects;

            const statsHtml = `
            <span>Total: ${summary.total_projects || projects.length}</span>
            <span>| With SO: ${summary.with_sales_order || 0}</span>
            <span>| Without SO: ${summary.without_sales_order || 0}</span>
            <span>| Overdue: ${summary.overdue_projects || 0}</span>
            ${summary.total_disputes ? `<span style="color: #ef4444;">| Disputes: ${summary.total_disputes}</span>` : ''}
            ${summary.total_issues ? `<span style="color: #f59e0b;">| Issues: ${summary.total_issues}</span>` : ''}
            <span id="project-overview-visible" style="opacity: 0.9;"></span>
        `;
            this.content_area.find('#project-overview-stats').html(statsHtml);

            if (!projects.length) {
                this.content_area.find('#project-overview-table tbody').html(`
                <tr>
                    <td colspan="11" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-inbox" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No projects found</div>
                    </td>
                </tr>
            `);
                return;
            }

            const escapeHtml = (value) => $('<div/>').text(value || '').html();

            // Extract all unique statuses for filters
            const projectStatuses = [...new Set(projects.map(p => p.project_status || 'Open'))].sort();
            const allSoStatuses = [];
            projects.forEach(p => {
                if (Array.isArray(p.so_statuses)) {
                    p.so_statuses.forEach(s => allSoStatuses.push(s));
                }
            });
            const uniqueSoStatuses = [...new Set(allSoStatuses)].sort();
            this.all_unique_so_statuses = uniqueSoStatuses;
            this.all_unique_project_statuses = projectStatuses;

            const rowsHtml = projects.map((project) => {
                const projectCode = project.project || '';
                const projectName = project.project_name || '';
                const customer = project.customer || '';
                const projectStatus = project.project_status || 'Open';
                const expectedStart = project.expected_start_date ? frappe.datetime.str_to_user(project.expected_start_date) : '-';
                const expectedEnd = project.expected_end_date ? frappe.datetime.str_to_user(project.expected_end_date) : '-';
                const overdueDays = Number(project.overdue_days || 0);
                const isOverdue = overdueDays > 0;
                const soNames = Array.isArray(project.sales_orders) ? project.sales_orders : [];
                const soStatuses = Array.isArray(project.so_statuses) ? project.so_statuses : [];
                const visibleSoNames = soNames.slice(0, 3);
                const moreSoCount = Math.max(soNames.length - 3, 0);
                const hasSalesOrder = soNames.length > 0;

                const soTaggedHtml = hasSalesOrder
                    ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${visibleSoNames.map((so) => `
                            <a href="/app/sales-order/${encodeURIComponent(so)}" target="_blank"
                               style="display: inline-block; padding: 2px 8px; border-radius: 999px; background: rgba(59, 130, 246, 0.12); color: #1d4ed8; font-size: 11px; font-weight: 600; text-decoration: none;">
                                ${escapeHtml(so)}
                            </a>
                        `).join('')}
                        ${moreSoCount > 0 ? `<span style="font-size: 11px; color: var(--text-muted);">+${moreSoCount} more</span>` : ''}
                    </div>
                `
                    : `<span style="color: #dc2626; font-size: 12px; font-weight: 600;">No Sales Order</span>`;

                const soStatusHtml = soStatuses.length
                    ? soStatuses.map(status => `<span style="display: inline-block; margin: 1px 3px 1px 0; padding: 2px 6px; border-radius: 999px; background: rgba(15, 23, 42, 0.06); font-size: 11px;">${escapeHtml(status)}</span>`).join('')
                    : `<span style="color: var(--text-muted);">-</span>`;

                const overdueHtml = isOverdue
                    ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 999px; background: #fee2e2; color: #b91c1c; font-weight: 700;">${overdueDays}</span>`
                    : `<span style="color: var(--text-muted);">${project.expected_end_date ? '0' : '-'}</span>`;

                const projectStatusClass =
                    projectStatus === 'Completed' ? 'status-completed' :
                        (projectStatus === 'Cancelled' ? 'status-overdue' : 'status-normal');

                const searchText = `${projectCode} ${projectName} ${customer} ${projectStatus} ${soNames.join(' ')} ${soStatuses.join(' ')}`.toLowerCase();

                return `
                <tr data-project-row="1" data-has-so="${hasSalesOrder ? 1 : 0}" data-overdue="${isOverdue ? 1 : 0}"
                    data-project-status="${escapeHtml(projectStatus)}"
                    data-so-statuses="${soStatuses.join(',')}"
                    data-start-date="${project.expected_start_date || ''}"
                    data-end-date="${project.expected_end_date || ''}"
                    data-search="${searchText}">
                    <td>
                        <div style="font-weight: 700; color: var(--primary);">${escapeHtml(projectCode)}</div>
                        ${projectName ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(projectName)}</div>` : ''}
                    </td>
                    <td>${escapeHtml(customer || '-')}</td>
                    <td>${soTaggedHtml}</td>
                    <td>${soStatusHtml}</td>
                    <td>${expectedStart}</td>
                    <td>${expectedEnd}</td>
                    <td>${overdueHtml}</td>
                    <td>
                        ${project.dispute_count > 0
                        ? `<span class="badge badge-danger" style="cursor: pointer; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;" onclick="frappe.sales_order_dashboard.switchView('dispute-overview')">
                                <i class="fa fa-exclamation-triangle"></i> ${project.dispute_count}
                               </span>`
                        : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td>
                        ${project.issue_count > 0
                        ? `<span class="badge badge-warning" style="cursor: pointer; background: #fffbeb; color: #92400e; border: 1px solid #fde68a;" onclick="frappe.sales_order_dashboard.switchView('issue-overview')">
                                <i class="fa fa-ticket-alt"></i> ${project.issue_count}
                               </span>`
                        : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td><span class="status-badge ${projectStatusClass}">${escapeHtml(projectStatus)}</span></td>
                    <td>
                        <a class="btn btn-secondary btn-sm" href="/app/project/${encodeURIComponent(projectCode)}" target="_blank">
                            <i class="fa fa-external-link"></i> Open
                        </a>
                    </td>
                </tr>
            `;
            }).join('');

            this.content_area.find('#project-overview-table tbody').html(rowsHtml);

            // Setup multi-select filters
            const $projMulti = this.content_area.find('#project-status-multi');
            const $soMulti = this.content_area.find('#so-status-multi');

            if ($projMulti.length) {
                this.setupMultiSelect($projMulti, projectStatuses, (selected) => {
                    this.selected_project_statuses = selected;
                    this.applyProjectOverviewFilter();
                });
            }
            if ($soMulti.length) {
                this.setupMultiSelect($soMulti, uniqueSoStatuses, (selected) => {
                    this.selected_so_statuses = selected;
                    this.applyProjectOverviewFilter();
                });
            }

            // Initialize selections
            this.selected_project_statuses = projectStatuses;
            this.selected_so_statuses = uniqueSoStatuses;

            this.content_area.find('#project-overview-search').on('input', () => this.applyProjectOverviewFilter());
            this.content_area.find('#project-overview-filter').on('change', () => this.applyProjectOverviewFilter());
            this.content_area.find('#project-start-date-from, #project-start-date-to, #project-end-date-from, #project-end-date-to').on('change input', () => this.applyProjectOverviewFilter());
            this.content_area.find('#clear-project-date-filters').on('click', () => {
                this.content_area.find('#project-start-date-from, #project-start-date-to, #project-end-date-from, #project-end-date-to').val('');
                this.applyProjectOverviewFilter();
            });
            this.content_area.find('#export-project-overview').on('click', () => this.exportProjectOverview(this.project_overview_rows));
            this.applyProjectOverviewFilter();
        });
    }

    fetchProjectOverviewData() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'prastara_custom.prastara_custom.page.prd_so_calender.prd_so_calender.get_project_sales_order_overview',
                args: {
                    company: 'METROPLUS ADVERTISING LLC'
                },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data || { projects: [], summary: {} });
                    } else {
                        this.showToast('Failed to load project overview', 'error');
                        resolve({ projects: [], summary: {} });
                    }
                },
                error: (err) => {
                    this.showToast('Failed to load project overview: ' + (err.message || 'Unknown error'), 'error');
                    resolve({ projects: [], summary: {} });
                }
            });
        });
    }

    normalizeProjectDateFilterValue(dateValue) {
        if (!dateValue) return '';
        return String(dateValue).slice(0, 10);
    }

    applyProjectOverviewFilter() {
        if (!this.content_area.find('#project-overview-table').length) return;

        // Debounce to keep UI main thread free for checkbox updates
        if (this.project_filter_timeout) clearTimeout(this.project_filter_timeout);

        this.project_filter_timeout = setTimeout(() => {
            const searchTerm = (this.content_area.find('#project-overview-search').val() || '').toLowerCase();
            const filterType = this.content_area.find('#project-overview-filter').val() || 'all';
            const startDateFrom = this.normalizeProjectDateFilterValue(this.content_area.find('#project-start-date-from').val());
            const startDateTo = this.normalizeProjectDateFilterValue(this.content_area.find('#project-start-date-to').val());
            const endDateFrom = this.normalizeProjectDateFilterValue(this.content_area.find('#project-end-date-from').val());
            const endDateTo = this.normalizeProjectDateFilterValue(this.content_area.find('#project-end-date-to').val());
            const tbody = this.content_area.find('#project-overview-table tbody');
            const rows = tbody.find('tr[data-project-row]');
            let visibleCount = 0;

            const selectedProjectStatuses = this.selected_project_statuses || [];
            const selectedSoStatuses = this.selected_so_statuses || [];
            const totalUniqueSoStatuses = (this.all_unique_so_statuses || []).length;
            const totalUniqueProjStatuses = (this.all_unique_project_statuses || []).length;

            const allProjectSelected = selectedProjectStatuses.length === totalUniqueProjStatuses || selectedProjectStatuses.length === 0;
            const allSoSelected = selectedSoStatuses.length === totalUniqueSoStatuses || selectedSoStatuses.length === 0;

            // Use native element for maximum speed
            rows.each((index, element) => {
                const ds = element.dataset;
                const rowSearch = ds.search || '';

                const hasSo = ds.hasSo === '1';
                const isOverdue = ds.overdue === '1';
                const projectStatus = ds.projectStatus || '';
                const soStatusesStr = ds.soStatuses || '';
                const soStatuses = soStatusesStr ? soStatusesStr.split(',') : [];
                const rowStartDate = this.normalizeProjectDateFilterValue(ds.startDate);
                const rowEndDate = this.normalizeProjectDateFilterValue(ds.endDate);

                let visible = rowSearch.includes(searchTerm);

                // Standard filters
                if (visible) {
                    if (filterType === 'with-so' && !hasSo) visible = false;
                    else if (filterType === 'without-so' && hasSo) visible = false;
                    else if (filterType === 'overdue' && !isOverdue) visible = false;
                }

                // Expected start date range filters
                if (visible && startDateFrom) {
                    if (!rowStartDate || rowStartDate < startDateFrom) visible = false;
                }
                if (visible && startDateTo) {
                    if (!rowStartDate || rowStartDate > startDateTo) visible = false;
                }

                // Expected end date range filters
                if (visible && endDateFrom) {
                    if (!rowEndDate || rowEndDate < endDateFrom) visible = false;
                }
                if (visible && endDateTo) {
                    if (!rowEndDate || rowEndDate > endDateTo) visible = false;
                }

                // Project Status Multi-select
                if (visible && !allProjectSelected) {
                    if (!selectedProjectStatuses.includes(projectStatus)) {
                        visible = false;
                    }
                }

                // SO Status Multi-select
                if (visible && !allSoSelected) {
                    if (hasSo) {
                        const hasMatch = soStatuses.some(status => selectedSoStatuses.includes(status));
                        if (!hasMatch) visible = false;
                    } else {
                        visible = false;
                    }
                }

                // Direct style access is faster than row.toggle()
                const isHidden = element.style.display === 'none';
                if (visible && isHidden) element.style.display = '';
                else if (!visible && !isHidden) element.style.display = 'none';

                if (visible) visibleCount++;
            });

            this.content_area.find('#project-overview-visible').text(`| Showing: ${visibleCount}`);
        }, 30); // Ultra-short 30ms pulse to ensure UI responsiveness
    }

    exportProjectOverview(projects) {
        const headers = [
            'Project',
            'Project Name',
            'Customer',
            'SO Tagged',
            'SO Status',
            'Project Start Date',
            'Project End Date',
            'Overdue Days',
            'Project Status'
        ];

        const rows = (projects || []).map((project) => [
            project.project || '',
            project.project_name || '',
            project.customer || '',
            (project.sales_orders || []).join(' | '),
            (project.so_statuses || []).join(' | '),
            project.expected_start_date ? frappe.datetime.str_to_user(project.expected_start_date) : '',
            project.expected_end_date ? frappe.datetime.str_to_user(project.expected_end_date) : '',
            project.overdue_days || 0,
            project.project_status || ''
        ]);

        let csvContent = headers.join(',') + '\n';
        rows.forEach((row) => {
            csvContent += row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'project_overview_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    renderDisputeOverviewTable() {
        this.content_area.html(`
        <div class="table-modern-container" style="box-shadow: none; margin: 0;">
            <div class="table-toolbar" style="padding: var(--space-4); background:#9ca3af; border-radius: var(--radius-lg); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                <div id="dispute-overview-stats" style="display: flex; gap: var(--space-3); align-items: center; color: white; font-weight: 600;">
                    <span>Loading disputes...</span>
                </div>
                <div style="display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap;">
                    <div class="table-search-box" style="min-width: 200px;">
                        <i class="fa fa-search table-search-icon" style="color: white;"></i>
                        <input type="text" class="table-search-input" placeholder="Search disputes..." id="dispute-overview-search" style="background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);">
                    </div>
                    
                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Dispute Status</label>
                        <div class="multi-select-container" id="dispute-status-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Dispute Reason</label>
                        <div class="multi-select-container" id="dispute-reason-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Project Status</label>
                        <div class="multi-select-container" id="dispute-project-status-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <button class="btn btn-primary" id="export-dispute-overview" style="padding: var(--space-2) var(--space-4); background: white; color: #9ca3af; border-color: white;">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
            </div>
            <div class="table-body">
                <table class="data-table" id="dispute-overview-table">
                    <thead>
                        <tr>
                            <th>Dispute ID</th>
                            <th>Reference</th>
                            <th>Customer</th>
                            <th>Against</th>
                            <th>Project Status</th>
                            <th>Reason</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="10" style="text-align: center; padding: var(--space-10);">
                                <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-muted);"></i>
                                <div style="margin-top: var(--space-2);">Fetching dispute data...</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        `);

        this.fetchDisputeOverviewData().then((data) => {
            const disputes = data.disputes || [];
            const summary = data.summary || {};

            // Update stats
            this.content_area.find('#dispute-overview-stats').html(`
                <span class="stat-pill" style="background: rgba(255,255,255,0.2);"><i class="fa fa-exclamation-triangle"></i> Total: ${summary.total_disputes || 0}</span>
                <span class="stat-pill" style="background: rgba(239, 68, 68, 0.4);"><i class="fa fa-clock"></i> Open: ${summary.open_disputes || 0}</span>
                <span class="stat-pill" style="background: rgba(34, 197, 94, 0.4);"><i class="fa fa-check-circle"></i> Resolved: ${summary.resolved_disputes || 0}</span>
                <span id="dispute-overview-visible" style="font-size: 12px; margin-left: 10px; opacity: 0.9;"></span>
            `);

            if (disputes.length === 0) {
                this.content_area.find('#dispute-overview-table tbody').html(`
                    <tr>
                        <td colspan="10" style="text-align: center; padding: var(--space-12); color: var(--text-muted);">
                            <i class="fa fa-check-circle" style="font-size: 2rem; margin-bottom: var(--space-3); color: #22c55e;"></i>
                            <div>No active disputes found</div>
                        </td>
                    </tr>
                `);
                return;
            }

            const escapeHtml = (val) => String(val || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

            // Build rows
            const rowsHtml = disputes.map(d => {
                const statusClass = d.status === 'Resolved' || d.status === 'Closed' ? 'status-completed' : 'status-overdue';
                const refLink = d.reference === 'Project' ? `/app/project/${encodeURIComponent(d.project)}` :
                    (d.reference === 'Sales Order' ? `/app/sales-order/${encodeURIComponent(d.sales_order)}` : '#');

                const refName = d.project || d.sales_order || '-';
                const searchText = `${d.dispute_id} ${d.customer} ${d.reason} ${d.status} ${refName}`.toLowerCase();

                return `
                    <tr data-dispute-row="1" data-status="${escapeHtml(d.status)}" data-reason="${escapeHtml(d.reason)}" data-project-status="${escapeHtml(d.project_status || '')}" data-search="${searchText}">
                        <td><a href="/app/dispute/${encodeURIComponent(d.dispute_id)}" target="_blank" style="font-weight:700; color: var(--primary);">${escapeHtml(d.dispute_id)}</a></td>
                        <td><span class="status-badge status-normal">${escapeHtml(d.reference)}</span></td>
                        <td>${escapeHtml(d.customer)}</td>
                        <td>
                            <a href="${refLink}" target="_blank" style="font-weight: 600;">${escapeHtml(refName)}</a>
                        </td>
                        <td>${d.project_status ? `<span class="status-badge status-normal">${escapeHtml(d.project_status)}</span>` : '-'}</td>
                        <td>${escapeHtml(d.reason)}</td>
                        <td>${frappe.datetime.str_to_user(d.dispute_date)}</td>
                        <td style="font-weight: 600;">${frappe.format(d.outstanding_amount, { fieldtype: 'Currency' })}</td>
                        <td><span class="status-badge ${statusClass}">${escapeHtml(d.status)}</span></td>
                        <td>
                            <a class="btn btn-secondary btn-sm" href="/app/dispute/${encodeURIComponent(d.dispute_id)}" target="_blank">
                                <i class="fa fa-external-link"></i> Open
                            </a>
                        </td>
                    </tr>
                `;
            }).join('');

            this.content_area.find('#dispute-overview-table tbody').html(rowsHtml);

            // Extract unique values for filters
            const statuses = [...new Set(disputes.map(d => d.status))].filter(s => s).sort();
            const reasons = [...new Set(disputes.map(d => d.reason))].filter(r => r).sort();
            const projectStatuses = [...new Set(disputes.map(d => d.project_status))].filter(s => s).sort();

            this.setupMultiSelect('#dispute-status-multi', statuses, (selected) => {
                this.selected_dispute_statuses = selected;
                this.applyDisputeOverviewFilter();
            });

            this.setupMultiSelect('#dispute-reason-multi', reasons, (selected) => {
                this.selected_dispute_reasons = selected;
                this.applyDisputeOverviewFilter();
            });

            this.setupMultiSelect('#dispute-project-status-multi', projectStatuses, (selected) => {
                this.selected_dispute_project_statuses = selected;
                this.applyDisputeOverviewFilter();
            });

            // Event listeners
            this.content_area.find('#dispute-overview-search').on('input', () => this.applyDisputeOverviewFilter());
            this.content_area.find('#export-dispute-overview').on('click', () => this.exportDisputeOverview(disputes));

            this.applyDisputeOverviewFilter();
        });
    }

    fetchDisputeOverviewData() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'prastara_custom.prastara_custom.page.prd_so_calender.prd_so_calender.get_prd_dispute_overview',
                args: { company: 'METROPLUS ADVERTISING LLC' },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data || { disputes: [], summary: {} });
                    } else {
                        resolve({ disputes: [], summary: {} });
                    }
                }
            });
        });
    }

    applyDisputeOverviewFilter() {
        if (!this.content_area.find('#dispute-overview-table').length) return;

        if (this.dispute_filter_timeout) clearTimeout(this.dispute_filter_timeout);

        this.dispute_filter_timeout = setTimeout(() => {
            const searchTerm = (this.content_area.find('#dispute-overview-search').val() || '').toLowerCase();
            const rows = this.content_area.find('#dispute-overview-table tbody tr[data-dispute-row]');
            let visibleCount = 0;

            const selectedStatuses = this.selected_dispute_statuses || [];
            const selectedReasons = this.selected_dispute_reasons || [];
            const selectedProjectStatuses = this.selected_dispute_project_statuses || [];

            rows.each((index, element) => {
                const ds = element.dataset;
                const rowSearch = ds.search || '';
                const rowStatus = ds.status || '';
                const rowReason = ds.reason || '';
                const rowProjectStatus = ds.projectStatus || '';

                let visible = rowSearch.includes(searchTerm);

                if (visible && selectedStatuses.length > 0) {
                    if (!selectedStatuses.includes(rowStatus)) visible = false;
                }
                if (visible && selectedReasons.length > 0) {
                    if (!selectedReasons.includes(rowReason)) visible = false;
                }
                if (visible && selectedProjectStatuses.length > 0) {
                    if (!selectedProjectStatuses.includes(rowProjectStatus)) visible = false;
                }

                element.style.display = visible ? '' : 'none';
                if (visible) visibleCount++;
            });

            this.content_area.find('#dispute-overview-visible').text(`| Showing: ${visibleCount}`);
        }, 30);
    }

    exportDisputeOverview(disputes) {
        const headers = ['Dispute ID', 'Reference', 'Customer', 'Linked Type', 'Linked ID', 'Reason', 'Date', 'Amount', 'Status'];
        const rows = disputes.map(d => [
            d.dispute_id,
            d.reference,
            d.customer,
            d.reference,
            d.project || d.sales_order,
            d.reason,
            d.dispute_date,
            d.outstanding_amount,
            d.status
        ]);

        let csvContent = headers.join(',') + '\n';
        rows.forEach((row) => {
            csvContent += row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'dispute_overview_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    renderIssueOverviewTable() {
        this.content_area.html(`
        <div class="table-modern-container" style="box-shadow: none; margin: 0;">
            <div class="table-toolbar" style="padding: var(--space-4); background:#9ca3af; border-radius: var(--radius-lg); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
                <div id="issue-overview-stats" style="display: flex; gap: var(--space-3); align-items: center; color: white; font-weight: 600;">
                    <span>Loading issues...</span>
                </div>
                <div style="display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap;">
                    <div class="table-search-box" style="min-width: 200px;">
                        <i class="fa fa-search table-search-icon" style="color: white;"></i>
                        <input type="text" class="table-search-input" placeholder="Search issues..." id="issue-overview-search" style="background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);">
                    </div>
                    
                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Issue Status</label>
                        <div class="multi-select-container" id="issue-status-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Priority</label>
                        <div class="multi-select-container" id="issue-priority-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <div class="filter-group">
                        <label style="color: white; font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px;">Project Status</label>
                        <div class="multi-select-container" id="issue-project-status-multi">
                            <div class="multi-select-btn">
                                <span class="multi-select-label">All</span>
                                <span class="multi-select-badge">0</span>
                                <i class="fa fa-chevron-down"></i>
                            </div>
                            <div class="multi-select-dropdown"></div>
                        </div>
                    </div>

                    <button class="btn btn-primary" id="export-issue-overview" style="padding: var(--space-2) var(--space-4); background: white; color: #9ca3af; border-color: white;">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
            </div>
            <div class="table-body">
                <table class="data-table" id="issue-overview-table">
                    <thead>
                        <tr>
                            <th>Issue ID</th>
                            <th>Subject</th>
                            <th>Customer</th>
                            <th>Reference</th>
                            <th>Project Status</th>
                            <th>Date</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="9" style="text-align: center; padding: var(--space-10);">
                                <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-muted);"></i>
                                <div style="margin-top: var(--space-2);">Fetching issue data...</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        `);

        this.fetchIssueOverviewData().then((data) => {
            const issues = data.issues || [];
            const summary = data.summary || {};

            // Update stats
            this.content_area.find('#issue-overview-stats').html(`
                <span class="stat-pill" style="background: rgba(255,255,255,0.2);"><i class="fa fa-ticket-alt"></i> Total: ${summary.total_issues || 0}</span>
                <span class="stat-pill" style="background: rgba(239, 68, 68, 0.4);"><i class="fa fa-clock"></i> Open: ${summary.open_issues || 0}</span>
                <span class="stat-pill" style="background: rgba(34, 197, 94, 0.4);"><i class="fa fa-check-circle"></i> Resolved: ${summary.resolved_issues || 0}</span>
                <span id="issue-overview-visible" style="font-size: 12px; margin-left: 10px; opacity: 0.9;"></span>
            `);

            if (issues.length === 0) {
                this.content_area.find('#issue-overview-table tbody').html(`
                    <tr>
                        <td colspan="9" style="text-align: center; padding: var(--space-12); color: var(--text-muted);">
                            <i class="fa fa-check-circle" style="font-size: 2rem; margin-bottom: var(--space-3); color: #22c55e;"></i>
                            <div>No active issues found</div>
                        </td>
                    </tr>
                `);
                return;
            }

            const escapeHtml = (val) => String(val || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

            // Build rows
            const rowsHtml = issues.map(i => {
                const statusClass = i.status === 'Resolved' || i.status === 'Closed' ? 'status-completed' :
                    (i.status === 'Open' ? 'status-overdue' : 'status-pending');

                const priorityClass = i.priority === 'High' || i.priority === 'Urgent' ? 'status-overdue' : 'status-normal';

                const refLink = i.project ? `/app/project/${encodeURIComponent(i.project)}` :
                    (i.custom_sales_order ? `/app/sales-order/${encodeURIComponent(i.custom_sales_order)}` : '#');

                const refName = i.project || i.custom_sales_order || '-';
                const searchText = `${i.issue_id} ${i.subject} ${i.customer_name} ${i.status} ${i.priority} ${refName}`.toLowerCase();

                return `
                    <tr data-issue-row="1" data-status="${escapeHtml(i.status)}" data-priority="${escapeHtml(i.priority)}" data-project-status="${escapeHtml(i.project_status || '')}" data-search="${searchText}">
                        <td><a href="/app/issue/${encodeURIComponent(i.issue_id)}" target="_blank" style="font-weight:700; color: var(--primary);">${escapeHtml(i.issue_id)}</a></td>
                        <td><div style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;" title="${escapeHtml(i.subject)}">${escapeHtml(i.subject)}</div></td>
                        <td>${escapeHtml(i.customer_name)}</td>
                        <td>
                            <a href="${refLink}" target="_blank" style="font-weight: 600;">${escapeHtml(refName)}</a>
                        </td>
                        <td>${i.project_status ? `<span class="status-badge status-normal">${escapeHtml(i.project_status)}</span>` : '-'}</td>
                        <td>${frappe.datetime.str_to_user(i.opening_date)}</td>
                        <td><span class="status-badge ${priorityClass}">${escapeHtml(i.priority)}</span></td>
                        <td><span class="status-badge ${statusClass}">${escapeHtml(i.status)}</span></td>
                        <td>
                            <a class="btn btn-secondary btn-sm" href="/app/issue/${encodeURIComponent(i.issue_id)}" target="_blank">
                                <i class="fa fa-external-link"></i> Open
                            </a>
                        </td>
                    </tr>
                `;
            }).join('');

            this.content_area.find('#issue-overview-table tbody').html(rowsHtml);

            // Extract unique values for filters
            const statuses = [...new Set(issues.map(i => i.status))].filter(s => s).sort();
            const priorities = [...new Set(issues.map(i => i.priority))].filter(p => p).sort();
            const projectStatuses = [...new Set(issues.map(i => i.project_status))].filter(s => s).sort();

            this.setupMultiSelect('#issue-status-multi', statuses, (selected) => {
                this.selected_issue_statuses = selected;
                this.applyIssueOverviewFilter();
            });

            this.setupMultiSelect('#issue-priority-multi', priorities, (selected) => {
                this.selected_issue_priorities = selected;
                this.applyIssueOverviewFilter();
            });

            this.setupMultiSelect('#issue-project-status-multi', projectStatuses, (selected) => {
                this.selected_issue_project_statuses = selected;
                this.applyIssueOverviewFilter();
            });

            // Event listeners
            this.content_area.find('#issue-overview-search').on('input', () => this.applyIssueOverviewFilter());
            this.content_area.find('#export-issue-overview').on('click', () => this.exportIssueOverview(issues));

            this.applyIssueOverviewFilter();
        });
    }

    fetchIssueOverviewData() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'prastara_custom.prastara_custom.page.prd_so_calender.prd_so_calender.get_prd_issue_overview',
                args: { company: 'METROPLUS ADVERTISING LLC' },
                callback: (r) => {
                    if (r.message && r.message.status === 'success') {
                        resolve(r.message.data || { issues: [], summary: {} });
                    } else {
                        resolve({ issues: [], summary: {} });
                    }
                }
            });
        });
    }

    applyIssueOverviewFilter() {
        if (!this.content_area.find('#issue-overview-table').length) return;

        if (this.issue_filter_timeout) clearTimeout(this.issue_filter_timeout);

        this.issue_filter_timeout = setTimeout(() => {
            const searchTerm = (this.content_area.find('#issue-overview-search').val() || '').toLowerCase();
            const rows = this.content_area.find('#issue-overview-table tbody tr[data-issue-row]');
            let visibleCount = 0;

            const selectedStatuses = this.selected_issue_statuses || [];
            const selectedPriorities = this.selected_issue_priorities || [];
            const selectedProjectStatuses = this.selected_issue_project_statuses || [];

            rows.each((index, element) => {
                const ds = element.dataset;
                const rowSearch = ds.search || '';
                const rowStatus = ds.status || '';
                const rowPriority = ds.priority || '';
                const rowProjectStatus = ds.projectStatus || '';

                let visible = rowSearch.includes(searchTerm);

                if (visible && selectedStatuses.length > 0) {
                    if (!selectedStatuses.includes(rowStatus)) visible = false;
                }
                if (visible && selectedPriorities.length > 0) {
                    if (!selectedPriorities.includes(rowPriority)) visible = false;
                }
                if (visible && selectedProjectStatuses.length > 0) {
                    if (!selectedProjectStatuses.includes(rowProjectStatus)) visible = false;
                }

                element.style.display = visible ? '' : 'none';
                if (visible) visibleCount++;
            });

            this.content_area.find('#issue-overview-visible').text(`| Showing: ${visibleCount}`);
        }, 30);
    }

    exportIssueOverview(issues) {
        const headers = ['Issue ID', 'Subject', 'Customer', 'Reference', 'Date', 'Priority', 'Status'];
        const rows = issues.map(i => [
            i.issue_id,
            i.subject,
            i.customer_name,
            i.project || i.custom_sales_order,
            i.opening_date,
            i.priority,
            i.status
        ]);

        let csvContent = headers.join(',') + '\n';
        rows.forEach((row) => {
            csvContent += row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'issue_overview_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Ensure getDueBadge is defined for consistent styling
    getDueBadge(dueStatus, dueDaysText) {
        const badgeClass = {
            overdue: 'status-overdue',
            'due-today': 'status-pending',
            upcoming: 'status-normal',
            none: 'status-normal'
        }[dueStatus] || 'status-normal';

        return `<span class="status-badge ${badgeClass}">${dueDaysText}</span>`;
    }

    // Ensure showToast is defined for notifications
    showToast(message, type) {
        const bgColor = {
            success: 'var(--success)',
            error: 'var(--error)',
            info: 'var(--info)'
        }[type] || 'var(--info)';

        const toast = $(`
        <div class="toast-notification" style="position: fixed; bottom: 20px; right: 20px; background: ${bgColor}; color: white; padding: var(--space-3); border-radius: var(--radius); box-shadow: var(--shadow-md); z-index: 1000;">
            ${message}
        </div>
    `);

        $('body').append(toast);
        toast.fadeIn(300);
        setTimeout(() => {
            toast.fadeOut(300, () => toast.remove());
        }, 3000);
    }

    renderModernCustomerView() {
        const customerData = this.data.by_customer;

        const html = `
            <div class="metrics-container">
                <div class="metric-card-modern">
                    <div class="metric-card-icon">
                        <i class="fa fa-building"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value">${customerData.length}</div>
                        <div class="metric-label">Total Customers</div>
                    </div>
                </div>
                
                <div class="metric-card-modern">
                    <div class="metric-card-icon" style="background: var(--gradient-warm);">
                        <i class="fa fa-star"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value">${customerData.filter(c => c.total_value > 50000).length}</div>
                        <div class="metric-label">Premium Customers (>50K)</div>
                    </div>
                </div>
                
                <div class="metric-card-modern">
                    <div class="metric-card-icon" style="background: var(--gradient-cool);">
                        <i class="fa fa-home"></i>
                    </div>
                    <div class="metric-card-content">
                        <div class="metric-value">${customerData.filter(c => c.is_internal).length}</div>
                        <div class="metric-label">Internal Customers</div>
                    </div>
                </div>
            </div>
            
            <div class="table-modern-container">
                <div class="table-modern-header">
                    <div class="table-modern-title">Customer Performance</div>
                    <div class="table-toolbar">
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon"></i>
                            <input type="text" class="table-search-input" placeholder="Search customers..." id="customer-search">
                        </div>
                    </div>
                </div>
                <div class="table-body">
    <table class="data-table" id="customer-table">
        <thead>
            <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Orders</th>
                <th>Projects</th>
                <th>Total Value</th>
                <th>Remaining</th>
                <th>Overdue</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${customerData.map(customer => {
            const uniqueProjects = [...new Set(customer.orders.filter(o => o.project).map(o => o.project))];
            return `
                    <tr data-customer="${customer.name}">
                        <td><strong>${customer.name}</strong></td>
                        <td>
                            <span style="padding: 4px 8px; background: ${customer.is_internal ? 'rgba(99, 102, 241, 0.1)' : 'rgba(139, 92, 246, 0.1)'}; 
                                         color: ${customer.is_internal ? 'var(--primary)' : 'var(--secondary)'}; 
                                         border-radius: var(--radius); font-size: 0.75rem; font-weight: 600;">
                                ${customer.is_internal ? 'Internal' : 'External'}
                            </span>
                        </td>
                        <td>${customer.orders.length}</td>
                        <td>
                            <div style="font-weight: 600;">${uniqueProjects.length}</div>
                            ${uniqueProjects.length > 0 ? `
                                <div style="font-size: 0.75rem; color: var(--text-muted);" title="${uniqueProjects.join(', ')}">
                                    ${uniqueProjects.length === 1 ? uniqueProjects[0] : `${uniqueProjects[0]} +${uniqueProjects.length - 1} more`}
                                </div>
                            ` : `<div style="font-size: 0.75rem; color: var(--text-muted);">No projects</div>`}
                        </td>
                        <td><strong>${frappe.format(customer.total_value, { fieldtype: 'Currency' })}</strong></td>
                        <td><strong>${frappe.format(customer.total_remaining, { fieldtype: 'Currency' })}</strong></td>
                        <td>
                            <span style="color: ${customer.overdue_count > 0 ? 'var(--error)' : 'var(--success)'}; font-weight: 600;">
                                ${customer.overdue_count}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-primary btn-sm" data-action="view-customer-orders" data-customer="${customer.name}">
                                View Orders
                            </button>
                        </td>
                    </tr>
                `;
        }).join('')}
        </tbody>
    </table>
</div>
            </div>
        `;

        this.content_area.html(html);
        this.setupCustomerHandlers();
    }
    renderCalendarGrid(year, month) {
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = '';

        // Day headers
        dayHeaders.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });

        // Calendar days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const today = new Date();
        const deliveryDates = this.data.calendar_data.delivery_dates;

        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const dateStr = frappe.datetime.obj_to_str(date);
            const isToday = date.toDateString() === today.toDateString();
            const isCurrentMonth = date.getMonth() === month;
            const deliveryCount = deliveryDates[dateStr] || 0;

            // Get orders for this date to show project info
            const ordersForDate = this.filtered_orders.filter(order =>
                frappe.datetime.obj_to_str(new Date(order.delivery_date)) === dateStr
            );

            const hasOrders = deliveryCount > 0;
            const isOverdue = date < today && hasOrders;
            const uniqueProjects = [...new Set(ordersForDate.filter(o => o.project).map(o => o.project))];

            html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}"
                 data-date="${dateStr}" ${hasOrders ? 'style="cursor: pointer;"' : ''}>
                <div class="calendar-day-number">${date.getDate()}</div>
                <div class="calendar-day-events">
                    ${deliveryCount > 0 ? `
                        <div class="calendar-event" style="${isOverdue ? 'background: var(--gradient-warm);' : ''}">
                            ${deliveryCount} ${deliveryCount === 1 ? 'order' : 'orders'}
                        </div>
                        ${uniqueProjects.length > 0 ? `
                            <div class="calendar-event" style="background: var(--gradient-cool); font-size: 0.55rem; margin-top: 2px;">
                                📋 ${uniqueProjects.length} ${uniqueProjects.length === 1 ? 'project' : 'projects'}
                            </div>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        `;
        }

        return html;
    }
    // Event Handlers
    setupDashboardHandlers() {
        $('.metric-card-modern[data-drill]').on('click', (e) => {
            const drill = $(e.currentTarget).data('drill');
            this.showDrillDownModal(drill);
        });

        this.setupTableSearch('#status-search', '#status-table');
        this.setupTableSearch('#timeline-search', '#timeline-table');

        $('[data-action="view-status-orders"]').on('click', (e) => {
            e.stopPropagation();
            const status = $(e.currentTarget).data('status');
            const statusData = this.data.by_status.find(s => s.name === status);
            if (statusData) {
                this.showOrdersModal(statusData.orders, `${status} Orders`);
            }
        });

        $('[data-action="view-timeline-orders"]').on('click', (e) => {
            e.stopPropagation();
            const timeline = $(e.currentTarget).data('timeline');
            const timelineData = this.data.by_delivery_date.find(t => t.name === timeline);
            if (timelineData) {
                this.showOrdersModal(timelineData.orders, `${timeline} Orders`);
            }
        });
    }

    setupDateSummaryHandlers() {
        $('[data-action="view-transaction"]').on('click', (e) => {
            e.stopPropagation();
            const period = $(e.currentTarget).data('period');
            const orders = this.getTransactionOrdersByPeriod(period);
            this.showOrdersModal(orders, `Transaction - ${this.getPeriodLabel(period)}`);
        });

        $('[data-action="view-delivery"]').on('click', (e) => {
            e.stopPropagation();
            const period = $(e.currentTarget).data('period');
            const orders = this.getDeliveryOrdersByPeriod(period);
            this.showOrdersModal(orders, `Delivery - ${this.getPeriodLabel(period)}`);
        });
    }

    getTransactionOrdersByPeriod(period) {
        const dateSummary = this.data.date_summary;
        switch (period) {
            case 'today': return dateSummary.transaction_today;
            case 'yesterday': return dateSummary.transaction_yesterday;
            case 'this-week': return dateSummary.transaction_this_week;
            case 'last-week': return dateSummary.transaction_last_week;
            default: return [];
        }
    }

    getDeliveryOrdersByPeriod(period) {
        const dateSummary = this.data.date_summary;
        switch (period) {
            case 'overdue': return dateSummary.delivery_overdue;
            case 'today': return dateSummary.delivery_today;
            case 'this-week': return dateSummary.delivery_this_week;
            case 'future': return dateSummary.delivery_future;
            default: return [];
        }
    }

    getPeriodLabel(period) {
        const labels = {
            'today': 'Today',
            'yesterday': 'Yesterday',
            'this-week': 'This Week',
            'last-week': 'Last Week',
            'overdue': 'Overdue',
            'future': 'Future'
        };
        return labels[period] || period;
    }

    setupListHandlers() {
        this.setupTableSearch('#list-search', '#orders-table');

        $('#orders-table tbody tr').on('click', (e) => {
            const orderName = $(e.currentTarget).data('order');
            this.showOrderDetails(orderName);
        });
    }

    setupSalesPersonHandlers() {
        this.setupTableSearch('#sp-search', '#salesperson-table');

        $('[data-action="view-sp-orders"]').on('click', (e) => {
            e.stopPropagation();
            const salesPerson = $(e.currentTarget).data('salesperson');
            const spData = this.data.by_sales_person.find(sp => sp.name === salesPerson);
            if (spData) {
                this.showOrdersModal(spData.orders, `${salesPerson} - Orders`);
            }
        });
    }

    setupCustomerHandlers() {
        this.setupTableSearch('#customer-search', '#customer-table');

        $('[data-action="view-customer-orders"]').on('click', (e) => {
            e.stopPropagation();
            const customer = $(e.currentTarget).data('customer');
            const customerData = this.data.by_customer.find(c => c.name === customer);
            if (customerData) {
                this.showOrdersModal(customerData.orders, `${customer} - Orders`);
            }
        });
    }

    setupOrderCardHandlers() {
        $('.order-card-modern').on('click', (e) => {
            const orderName = $(e.currentTarget).data('order');
            this.showOrderDetails(orderName);
        });
    }

    setupCalendarHandlers() {
        $('#prev-month').on('click', () => {
            this.calendar_date.setMonth(this.calendar_date.getMonth() - 1);
            this.renderModernCalendar();
        });

        $('#next-month').on('click', () => {
            this.calendar_date.setMonth(this.calendar_date.getMonth() + 1);
            this.renderModernCalendar();
        });

        $('#today-btn').on('click', () => {
            this.calendar_date = new Date();
            this.renderModernCalendar();
        });

        $('.calendar-day[data-date]').on('click', (e) => {
            const date = $(e.currentTarget).data('date');
            const ordersForDate = this.filtered_orders.filter(order =>
                frappe.datetime.obj_to_str(new Date(order.delivery_date)) === date
            );

            if (ordersForDate.length > 0) {
                this.showOrdersModal(ordersForDate, `Orders for ${frappe.datetime.str_to_user(date)}`);
            }
        });
    }

    setupTableSearch(inputId, tableId) {
        $(inputId).on('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = $(`${tableId} tbody tr`);

            rows.each(function () {
                const rowText = $(this).text().toLowerCase();
                $(this).toggle(rowText.includes(searchTerm));
            });
        });
    }

    setupMultiSelect(selector, options, onChange) {
        const container = typeof selector === 'string' ? $(selector) : selector;
        if (!container.length) return;

        const btn = container.find('.multi-select-btn');
        const dropdown = container.find('.multi-select-dropdown');
        const badge = container.find('.multi-select-badge');
        const label = container.find('.multi-select-label');

        // Toggle dropdown
        btn.off('click').on('click', (e) => {
            e.stopPropagation();
            $('.multi-select-dropdown').not(dropdown).removeClass('open');
            dropdown.toggleClass('open');
        });

        // Close on click outside - use unique namespace per container if needed, but one is enough if we just close all
        $(document).off('click.multi-select-global').on('click.multi-select-global', () => {
            $('.multi-select-dropdown').removeClass('open');
        });
        dropdown.off('click').on('click', (e) => e.stopPropagation());

        // Render options
        const optionsHtml = options.map(opt => `
            <label class="multi-select-option">
                <input type="checkbox" value="${opt}" checked>
                <span>${opt || 'Not Set'}</span>
            </label>
        `).join('');
        dropdown.html(optionsHtml);

        // Handle change
        dropdown.find('input').on('change', () => {
            const selected = dropdown.find('input:checked').map(function () { return $(this).val(); }).get();
            const totalCount = dropdown.find('input').length;

            if (selected.length === totalCount) {
                label.text('All');
                badge.hide();
            } else if (selected.length === 0) {
                label.text('None');
                badge.show().text('0');
            } else {
                label.text(`${selected.length} selected`);
                badge.show().text(selected.length);
            }

            if (onChange) onChange(selected);
        });

        // Initial state
        label.text('All');
        badge.hide();
    }

    // Modal Methods
    showDrillDownModal(drillType) {
        let filteredOrders = [];
        let title = '';

        switch (drillType) {
            case 'all':
                filteredOrders = this.filtered_orders;
                title = 'All Pending Orders';
                break;
            case 'balance-to-bill':
                filteredOrders = this.filtered_orders.filter(order => parseFloat(order.remaining_amount || 0) > 0);
                title = 'Orders with Actual Remaining';
                break;
            case 'overdue':
                filteredOrders = this.filtered_orders.filter(order => order.due_days < 0);
                title = 'Overdue Orders';
                break;
            case 'due-today':
                filteredOrders = this.filtered_orders.filter(order => order.due_days === 0);
                title = 'Orders Due Today';
                break;
            case 'due-week':
                filteredOrders = this.filtered_orders.filter(order => order.due_days >= 0 && order.due_days <= 7);
                title = 'Orders Due This Week';
                break;
            case 'due-month':
                filteredOrders = this.filtered_orders.filter(order => order.due_days >= 0 && order.due_days <= 30);
                title = 'Orders Due This Month';
                break;
            case 'high-value':
                filteredOrders = this.filtered_orders.filter(order => parseFloat(order.grand_total) > 20000);
                title = 'High Value Orders (>20K)';
                break;
            case 'on-hold':
                filteredOrders = this.filtered_orders.filter(order => (order.status || '').toLowerCase().includes('hold'));
                title = 'Orders On Hold';
                break;
        }

        this.showOrdersModal(filteredOrders, title);
    }

    getTransactionDateForOrder(order) {
        const rawDate = order.transaction_date || order.date;

        if (rawDate) {
            try {
                return frappe.datetime.str_to_user(rawDate);
            } catch (e) {
                return String(rawDate).slice(0, 10);
            }
        }

        return order.formatted_transaction_date || '-';
    }

    getTimePeriodText(order) {
        const transactionDate = this.parseOrderDate(order.transaction_date || order.date);
        const deliveryDate = this.parseOrderDate(order.delivery_date);
        const dueTimelineText = this.getDueTimelineText(order);
        if (!transactionDate || !deliveryDate) {
            return dueTimelineText || '-';
        }

        const dayMs = 1000 * 3600 * 24;
        const rawDiff = Math.floor((deliveryDate.getTime() - transactionDate.getTime()) / dayMs);
        const totalDays = Math.abs(rawDiff) + 1; // inclusive day count

        let baseTimePeriod = '';
        if (totalDays < 30) {
            baseTimePeriod = `${totalDays} day${totalDays === 1 ? '' : 's'}`;
        } else {
            const months = Math.floor(totalDays / 30);
            const remainingDays = totalDays % 30;
            if (remainingDays === 0) {
                baseTimePeriod = `${months} month${months === 1 ? '' : 's'}`;
            } else {
                baseTimePeriod = `${months} month${months === 1 ? '' : 's'} ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
            }
        }

        if (!dueTimelineText) {
            return baseTimePeriod;
        }

        return `${baseTimePeriod} | ${dueTimelineText}`;
    }

    getDueTimelineText(order) {
        if (!order || !order.delivery_date) return '';

        if (order.due_days_text && order.due_days_text !== 'No delivery date') {
            return order.due_days_text;
        }

        if (Number.isFinite(order.due_days) && Math.abs(order.due_days) < 900000) {
            return this.formatDueDays(order.due_days);
        }

        return '';
    }

    showOrdersModal(orders, title) {
        this.main_modal.find('.modal-title').text(title);

        if (!orders.length) {
            this.main_modal.find('.modal-body').html(this.renderEmptyState('No orders found', ''));
        } else {
            const totalValue = orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
            const totalPayments = orders.reduce(
                (sum, order) => sum + this.toNumber(order.advance_amount) + this.toNumber(order.progress_amount),
                0
            );
            const totalRemaining = orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);

            const html = `
    <div class="table-modern-container" style="box-shadow: none; margin: 0;">
        <div class="table-toolbar" style="padding: var(--space-4); background: var(--surface-alt); border-radius: var(--radius-lg); margin-bottom: var(--space-4);">
            <div class="table-search-box">
                <i class="fa fa-search table-search-icon"></i>
                <input type="text" class="table-search-input" placeholder="Search orders, projects..." id="modal-search" style="background: var(--surface); color: var(--text);">
            </div>
        </div>
        <div class="table-body" style="overflow-x: auto;">
            <table class="data-table" id="modal-orders-table" style="min-width: 1400px;">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Project</th>
                        <th>Sales Person</th>
                        <th style="min-width: 130px;">Transaction Date</th>
                        <th style="min-width: 150px;">Delivery Date</th>
                        <th style="min-width: 260px;">Time Period</th>
                        <th>Grand Total</th>
                        <th>Advance + Progress</th>
                        <th>Remaining</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr data-order="${order.name}" style="cursor: pointer;">
                            <td><strong style="color: var(--primary);">${order.name}</strong></td>
                            <td>${order.customer}</td>
                            <td>
                                ${order.project ? `
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.85rem;">${order.project}</div>
                                        ${order.project_description ? `<div style="font-size: 0.7rem; color: var(--text-muted);" title="${order.project_description}">${order.project_description.length > 20 ? order.project_description.substring(0, 20) + '...' : order.project_description}</div>` : ''}
                                    </div>
                                ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">No Project</span>`}
                            </td>
                            <td>${order.sales_person}</td>
                            <td style="white-space: nowrap; text-align: left; vertical-align: middle;">${this.getTransactionDateForOrder(order)}</td>
                            <td style="white-space: nowrap; text-align: left; vertical-align: middle;">
                                ${frappe.datetime.str_to_user(order.delivery_date)}
                            </td>
                            <td style="min-width: 260px; white-space: nowrap; text-align: left; vertical-align: middle;">${this.getTimePeriodText(order)}</td>
                            <td><strong>${frappe.format(order.grand_total, { fieldtype: 'Currency' })}</strong></td>
                            <td><strong class="header-stat-amount-payment">${frappe.format(this.toNumber(order.advance_amount) + this.toNumber(order.progress_amount), { fieldtype: 'Currency' })}</strong></td>
                            <td><strong>${frappe.format(order.remaining_amount, { fieldtype: 'Currency' })}</strong></td>
                            <td>${order.status || 'Unknown'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
          <div style="padding: var(--space-6); background: var(--surface-alt); border-top: 2px solid var(--primary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
                        <div style="display: flex; gap: var(--space-8); flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Orders</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${orders.length}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Value</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalValue, { fieldtype: 'Currency' })}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Advance + Progress</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--success);">${frappe.format(totalPayments, { fieldtype: 'Currency' })}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Remaining</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalRemaining, { fieldtype: 'Currency' })}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.main_modal.find('.modal-body').html(html);

            // Setup modal search functionality
            this.setupTableSearch('#modal-search', '#modal-orders-table');

            this.main_modal.find('tbody tr[data-order]').on('click', (e) => {
                const orderName = $(e.currentTarget).data('order');
                this.showOrderDetails(orderName);
            });
        }

        this.main_modal.fadeIn(300);
    }

    showQuickSearchModal() {
        const self = this;
        let selectedIndex = -1;
        let currentResults = { salesOrders: [], projects: [] };
        let currentFilter = 'all'; // 'all', 'orders', 'projects'

        // Get search history
        const getSearchHistory = () => {
            try {
                return JSON.parse(localStorage.getItem('prd_search_history') || '[]');
            } catch (e) {
                return [];
            }
        };

        // Save to search history
        const saveToHistory = (query) => {
            if (!query || query.trim().length < 2) return;

            try {
                let history = getSearchHistory();

                // Remove duplicates
                history = history.filter(h => h !== query);

                // Add to beginning
                history.unshift(query);

                // Keep only last 10
                history = history.slice(0, 10);

                localStorage.setItem('prd_search_history', JSON.stringify(history));
            } catch (e) {
                console.error('Error saving search history:', e);
            }
        };

        // Get recent items
        const getRecentItems = () => {
            // This could be enhanced to track recently viewed items
            return [];
        };

        // Update selection
        const updateSelection = (items) => {
            items.removeClass('selected');
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                $(items[selectedIndex]).addClass('selected');
                items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        };

        // Highlight matching text
        const highlightText = (text, query) => {
            if (!text || !query) return text || '';
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return String(text).replace(regex, '<mark style="background: #ffd60a; padding: 0 2px; border-radius: 2px; font-weight: 600;">$1</mark>');
        };

        // Remove any existing panel
        $('#quick-search-panel').remove();
        $('#quick-search-overlay').remove();

        const panel = $(`
            <!-- Overlay -->
            <div id="quick-search-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 9998; opacity: 0; transition: opacity 0.3s;"></div>

            <!-- Slide-out Panel -->
            <div id="quick-search-panel" style="position: fixed; top: 0; right: -600px; width: 600px; max-width: 90vw; height: 100vh; background: white; box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2); z-index: 9999; transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--success) 100%); padding: 20px 24px; position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fa fa-search" style="color: white; font-size: 18px;"></i>
                                </div>
                                <div>
                                    <h3 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">Quick Search</h3>
                                    <div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 2px;">Search orders, projects, and customers</div>
                                </div>
                            </div>
                            <button class="modal-close" style="background: rgba(255,255,255,0.15); border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">&times;</button>
                        </div>

                        <!-- Search Input -->
                        <div style="position: relative;">
                            <i class="fa fa-search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 16px; z-index: 1;"></i>
                            <input
                                type="text"
                                id="quick-search-input"
                                placeholder="Type to search... (min 2 characters)"
                                style="width: 100%; padding: 13px 16px 13px 44px; font-size: 15px; border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; background: rgba(255,255,255,0.95); transition: all 0.2s; outline: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
                                autofocus
                            />
                            <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); display: flex; gap: 6px; align-items: center;">
                                <kbd style="background: rgba(0,0,0,0.1); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted);">↑↓</kbd>
                                <kbd style="background: rgba(0,0,0,0.1); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted);">↵</kbd>
                                <kbd style="background: rgba(0,0,0,0.1); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted);">ESC</kbd>
                            </div>
                        </div>

                        <!-- Filter Tabs -->
                        <div style="display: flex; gap: 8px; margin-top: 16px;">
                            <button class="filter-tab active" data-filter="all" style="flex: 1; padding: 8px 16px; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.4); color: white; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                <i class="fa fa-th" style="margin-right: 6px;"></i>All Results
                            </button>
                            <button class="filter-tab" data-filter="orders" style="flex: 1; padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                <i class="fa fa-file-text" style="margin-right: 6px;"></i>Orders
                            </button>
                            <button class="filter-tab" data-filter="projects" style="flex: 1; padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                <i class="fa fa-folder" style="margin-right: 6px;"></i>Projects
                            </button>
                        </div>
                    </div>

                    <!-- Results Container -->
                    <div style="flex: 1; overflow-y: auto; background: #f8fafc;" id="quick-search-results">
                        ${this.renderInitialSearchState(getSearchHistory(), getRecentItems())}
                    </div>
            </div>
        `);

        $('body').append(panel);

        const closePanel = () => {
            $('#quick-search-panel').css('right', '-600px');
            $('#quick-search-overlay').css('opacity', '0');
            setTimeout(() => {
                $('#quick-search-panel').remove();
                $('#quick-search-overlay').remove();
            }, 300);
        };

        // Show panel with animation
        setTimeout(() => {
            $('#quick-search-panel').css('right', '0');
            $('#quick-search-overlay').css('opacity', '1');
        }, 10);

        // Close panel when clicking X button
        $('.modal-close').on('click', (e) => {
            e.preventDefault();
            closePanel();
        });

        // Close panel when clicking overlay
        $('#quick-search-overlay').on('click', closePanel);

        // Filter tab handling
        $('.filter-tab').on('click', function (e) {
            $('.filter-tab').removeClass('active').css({
                background: 'rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.8)'
            });
            $(this).addClass('active').css({
                background: 'rgba(255,255,255,0.25)',
                borderColor: 'rgba(255,255,255,0.4)',
                color: 'white'
            });
            currentFilter = $(this).data('filter');
            selectedIndex = -1;

            // Re-render with filter
            if (currentResults.salesOrders.length > 0 || currentResults.projects.length > 0) {
                self.renderQuickSearchResults(currentResults, null, $('#quick-search-input').val(), currentFilter);
            }
        });

        // Search functionality
        const searchInput = $('#quick-search-input');
        const resultsContainer = $('#quick-search-results');
        const renderSearchError = (message) => {
            const safeMessage = $('<div/>').text(message || 'Unable to perform search. Please try again.').html();
            resultsContainer.html(`
                <div style="text-align: center; padding: 60px 24px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fa fa-exclamation-triangle" style="font-size: 32px; color: #dc2626;"></i>
                    </div>
                    <div style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">Search Error</div>
                    <div style="font-size: 14px; color: #64748b;">${safeMessage}</div>
                </div>
            `);
        };

        // Keyboard navigation
        searchInput.on('keydown', (e) => {
            const items = $('.search-result-item:visible');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection(items);
            } else if (e.key === 'Enter' && selectedIndex >= 0 && items.length > 0) {
                e.preventDefault();
                $(items[selectedIndex]).trigger('click');
            }
        });

        // Search with debounce
        let searchTimeout;
        searchInput.on('input', () => {
            clearTimeout(searchTimeout);
            const query = searchInput.val().trim();
            selectedIndex = -1;

            if (query.length < 2) {
                resultsContainer.html(this.renderInitialSearchState(getSearchHistory(), getRecentItems()));
                return;
            }

            resultsContainer.html(`
                <div style="text-align: center; padding: 60px 24px;">
                    <div style="width: 60px; height: 60px; margin: 0 auto 20px; border: 3px solid #e0e7ff; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                    <div style="font-size: 16px; font-weight: 600; color: #1e293b;">Searching...</div>
                    <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Finding matching results</div>
                </div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            `);

            searchTimeout = setTimeout(() => {
                saveToHistory(query);
                frappe.call({
                    method: 'prastara_custom.prastara_custom.page.prd_so_calender.prd_so_calender.search_sales_orders_and_projects',
                    args: { query: query },
                    callback: (r) => {
                        if (r.message && r.message.status === 'success') {
                            currentResults = {
                                salesOrders: r.message.data.sales_orders || [],
                                projects: r.message.data.projects || []
                            };
                            self.renderQuickSearchResults(currentResults, null, query, currentFilter);
                        } else {
                            const serverMessage =
                                (r && r.message && r.message.message) ||
                                (r && r.exc_type ? `${r.exc_type}: check server logs` : null);
                            renderSearchError(serverMessage);
                        }
                    },
                    error: (err) => {
                        const errorMessage =
                            (err && err.message) ||
                            (err && err.responseJSON && err.responseJSON.exception) ||
                            'Unable to perform search. Please try again.';
                        renderSearchError(errorMessage);
                    }
                });
            }, 300);
        });

        // Handle history item clicks
        resultsContainer.on('click', '.history-item', function () {
            const query = $(this).text().trim();
            searchInput.val(query).trigger('input');
        });

        // Handle ESC key to close panel
        $(document).on('keydown.quicksearch', (e) => {
            if (e.key === 'Escape') {
                closePanel();
                $(document).off('keydown.quicksearch');
            }
        });

        // Focus on search input
        setTimeout(() => {
            searchInput.focus();
        }, 350);
    }

    renderInitialSearchState(history, recent) {
        let html = '<div style="padding: 24px;">';

        // Search history section
        if (history && history.length > 0) {
            html += `
                <div style="margin-bottom: 32px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                            <i class="fa fa-history" style="margin-right: 6px;"></i>Recent Searches
                        </div>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            `;

            history.forEach(item => {
                html += `
                    <div class="history-item" style="background: var(--surface-alt); padding: 8px 14px; border-radius: 8px; font-size: 14px; color: var(--text); cursor: pointer; transition: all 0.2s; border: 1px solid var(--border-light);">
                        <i class="fa fa-search" style="margin-right: 6px; color: var(--text-muted); font-size: 12px;"></i>${item}
                    </div>
                `;
            });

            html += '</div></div>';
        }

        // Empty state
        html += `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: var(--primary-glass); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fa fa-search" style="font-size: 32px; color: var(--primary);"></i>
                </div>
                <div style="font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px;">Start Searching</div>
                <div style="font-size: 14px; color: var(--text-muted); max-width: 300px; margin: 0 auto;">
                    Type at least 2 characters to search for sales orders, projects, and customers
                </div>
                <div style="margin-top: 24px; padding: 16px; background: var(--surface-alt); border-radius: 12px; border: 1px solid var(--border-light);">
                    <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">💡 QUICK TIPS</div>
                    <ul style="list-style: none; padding: 0; margin: 0; text-align: left; font-size: 13px; color: var(--text-light);">
                        <li style="padding: 4px 0;"><kbd style="background: var(--surface); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px;">⌘K</kbd> Open Quick Search</li>
                        <li style="padding: 4px 0;"><kbd style="background: var(--surface); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px;">↑↓</kbd> Navigate Results</li>
                        <li style="padding: 4px 0;"><kbd style="background: var(--surface); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px;">↵</kbd> Select Item</li>
                        <li style="padding: 4px 0;"><kbd style="background: var(--surface); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px;">ESC</kbd> Close Panel</li>
                    </ul>
                </div>
            </div>
        `;

        html += '</div>';
        return html;
    }

    renderQuickSearchResults(data, modal, query = '', filter = 'all') {
        const self = this;
        const salesOrders = data.salesOrders || data.sales_orders || [];
        const projects = data.projects || [];

        // Highlight matching text
        const highlightText = (text, query) => {
            if (!text || !query) return text || '';
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return String(text).replace(regex, '<mark style="background: #ffd60a; padding: 0 2px; border-radius: 2px; font-weight: 600;">$1</mark>');
        };
        const resultsContainer = $('#quick-search-results');

        // Apply filter
        const filteredSalesOrders = (filter === 'all' || filter === 'orders') ? salesOrders : [];
        const filteredProjects = (filter === 'all' || filter === 'projects') ? projects : [];

        if (filteredSalesOrders.length === 0 && filteredProjects.length === 0) {
            resultsContainer.html(`
                <div style="text-align: center; padding: 60px 24px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fa fa-search" style="font-size: 32px; color: #f59e0b;"></i>
                    </div>
                    <div style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">No Results Found</div>
                    <div style="font-size: 14px; color: #64748b;">Try different keywords or check your filters</div>
                </div>
            `);
            return;
        }

        let html = '<div style="padding-bottom: 20px;">';

        // Sales Orders Section
        if (filteredSalesOrders.length > 0) {
            html += `
                <div style="background: var(--surface-alt); padding: 12px 20px; border-bottom: 2px solid var(--border); position: sticky; top: 0; z-index: 10;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa fa-file-text" style="margin-right: 8px; color: var(--primary);"></i>
                        Sales Orders (${filteredSalesOrders.length})
                    </div>
                </div>
            `;

            filteredSalesOrders.forEach(order => {
                html += `
                    <div class="search-result-item" data-order="${order.name}" style="padding: 16px 20px; border-bottom: 1px solid var(--border-light); cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div style="font-size: 15px; font-weight: 600; color: var(--primary);">
                                ${highlightText(order.name, query)}
                            </div>
                            <span style="background: ${order.status === 'Completed' ? 'var(--success)' : 'var(--warning)'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ${order.status}
                            </span>
                        </div>
                        <div style="font-size: 14px; color: var(--text); margin-bottom: 6px;">
                            <i class="fa fa-user" style="margin-right: 6px; color: var(--text-muted);"></i>
                            ${highlightText(order.customer_name || order.customer, query)}
                        </div>
                        ${order.project ? `
                            <div style="font-size: 13px; color: var(--text-light); margin-bottom: 4px;">
                                <i class="fa fa-folder" style="margin-right: 6px; color: var(--text-muted);"></i>
                                ${highlightText(order.project, query)}
                            </div>
                        ` : ''}
                        <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--text-muted);">
                            <span><i class="fa fa-calendar" style="margin-right: 4px;"></i>${frappe.datetime.str_to_user(order.transaction_date)}</span>
                            <span><i class="fa fa-money" style="margin-right: 4px;"></i>${frappe.format(order.grand_total, { fieldtype: 'Currency' })}</span>
                        </div>
                    </div>
                `;
            });
        }

        // Projects Section
        if (filteredProjects.length > 0) {
            html += `
                <div style="background: var(--surface-alt); padding: 12px 20px; border-bottom: 2px solid var(--border); position: sticky; top: 0; z-index: 10; margin-top: ${filteredSalesOrders.length > 0 ? '20px' : '0'};">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa fa-folder" style="margin-right: 8px; color: var(--info);"></i>
                        Projects (${filteredProjects.length})
                    </div>
                </div>
            `;

            filteredProjects.forEach(project => {
                html += `
                    <div class="search-result-item project-item" data-project="${project.name}" style="padding: 16px 20px; border-bottom: 1px solid var(--border-light); cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div style="font-size: 15px; font-weight: 600; color: var(--info);">
                                ${highlightText(project.name, query)}
                            </div>
                            <span style="background: var(--info); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ${project.status}
                            </span>
                        </div>
                        ${project.project_name ? `
                            <div style="font-size: 14px; color: var(--text); margin-bottom: 6px;">
                                ${highlightText(project.project_name, query)}
                            </div>
                        ` : ''}
                        <div style="font-size: 13px; color: var(--text-light);">
                            <i class="fa fa-user" style="margin-right: 6px; color: var(--text-muted);"></i>
                            ${highlightText(project.customer, query)}
                        </div>
                        ${project.percent_complete ? `
                            <div style="margin-top: 8px;">
                                <div style="background: var(--border-light); height: 4px; border-radius: 2px; overflow: hidden;">
                                    <div style="background: var(--info); height: 100%; width: ${project.percent_complete}%; transition: width 0.3s;"></div>
                                </div>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${project.percent_complete}% Complete</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }

        html += '</div>';
        resultsContainer.html(html);

        // Handle sales order clicks
        resultsContainer.find('[data-order]').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const orderName = $(this).data('order');

            // Close search panel and open detail modal
            $('#quick-search-panel').css('right', '-600px');
            $('#quick-search-overlay').css('opacity', '0');

            setTimeout(() => {
                $('#quick-search-panel').remove();
                $('#quick-search-overlay').remove();
                $(document).off('keydown.quicksearch');

                // Show order details
                try {
                    self.showOrderDetails(orderName);
                } catch (err) {
                    console.error('Error calling showOrderDetails:', err);
                }
            }, 300);
        });

        // Handle project clicks
        resultsContainer.find('[data-project]').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const projectName = $(this).data('project');

            // Try to find sales order for this project
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Sales Order',
                    filters: {
                        project: projectName,
                        docstatus: 1
                    },
                    fields: ['name'],
                    limit: 1
                },
                callback: (r) => {
                    if (r.message && r.message.length > 0) {
                        // If sales order found, show its details
                        const soName = r.message[0].name;

                        $('#quick-search-panel').css('right', '-600px');
                        $('#quick-search-overlay').css('opacity', '0');

                        setTimeout(() => {
                            $('#quick-search-panel').remove();
                            $('#quick-search-overlay').remove();
                            $(document).off('keydown.quicksearch');

                            // Show order details
                            try {
                                self.showOrderDetails(soName);
                            } catch (err) {
                                console.error('Error showing order details:', err);
                            }
                        }, 300);
                    } else {
                        // Otherwise, open project in new tab
                        $('#quick-search-panel').css('right', '-600px');
                        $('#quick-search-overlay').css('opacity', '0');

                        setTimeout(() => {
                            $('#quick-search-panel').remove();
                            $('#quick-search-overlay').remove();
                            $(document).off('keydown.quicksearch');
                        }, 300);

                        window.open('/app/project/' + projectName, '_blank');
                    }
                }
            });
        });
    }

    showOrderDetails(orderName) {
        this.detail_modal.find('.modal-title').text(`Order Details: ${orderName}`);
        this.detail_modal.find('.modal-body').html(`
            <div class="skeleton">
                <div class="skeleton-title"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text"></div>
            </div>
        `);
        this.detail_modal.fadeIn(300);

        frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_sales_order_details',
            args: { sales_order_name: orderName },
            callback: (r) => {
                if (r.message && r.message.status === 'success') {
                    this.renderOrderDetailsModal(r.message.data);
                } else {
                    this.detail_modal.find('.modal-body').html(this.renderEmptyState('Failed to load order details', ''));
                }
            },
            error: () => {
                this.detail_modal.find('.modal-body').html(this.renderEmptyState('Error loading order details', ''));
            }
        });
    }

    // Enhanced renderOrderDetailsModal function
    // Enhanced renderOrderDetailsModal function
    renderOrderDetailsModal(data) {
        const order = data.order || {};
        const items = data.items || [];
        const salesTeam = data.sales_team || [];
        const invoices = data.invoices || [];
        const deliveryNotes = data.delivery_notes || [];
        const payments = data.payment_entries || [];
        const quotations = data.quotations || [];
        const permits = data.permits || [];
        const opportunities = data.opportunities || [];
        const projectDetails = data.project_details || {};
        const tasks = data.tasks || [];
        const paymentSchedule = data.payment_schedule || [];
        const materialRequests = data.material_requests || [];
        const advanceInvoices = data.advance_invoices || [];
        const financialDetails = data.financial_details || {};
        const disputes = data.disputes || [];
        const issues = data.issues || [];

        // Generate insights based on data
        const insights = this.generateOrderInsights(data);

        const html = `
        <div style="display: flex; flex-direction: column; gap: var(--space-4); max-height: 80vh; overflow-y: auto;">
            
            <!-- Insights Panel -->
            ${insights.length > 0 ? `
                <div class="insights-panel">
                    <div class="insights-header">
                        <i class="fa fa-lightbulb"></i>
                        Key Insights & Recommendations
                    </div>
                    <div class="insights-grid">
                        ${insights.map(insight => `
                            <div class="insight-item">
                                <i class="fa ${insight.icon}" style="color: ${insight.color};"></i>
                                <span>${insight.message}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Navigation Tabs -->
            <div class="detail-nav-tabs">
                <button class="detail-tab active" data-tab="overview">
                    <i class="fa fa-info-circle"></i> Overview
                </button>
                ${order.project ? `
                    <button class="detail-tab" data-tab="project">
                        <i class="fa fa-project-diagram"></i> Project
                    </button>
                ` : ''}
                <button class="detail-tab" data-tab="financials">
                    <i class="fa fa-money"></i> Financials
                </button>
                <button class="detail-tab" data-tab="team">
                    <i class="fa fa-users"></i> Team
                </button>
                <button class="detail-tab" data-tab="items">
                    <i class="fa fa-list"></i> Items (${items.length})
                </button>
                <button class="detail-tab" data-tab="schedule">
                    <i class="fa fa-calendar-check"></i> Schedule
                </button>
                <button class="detail-tab" data-tab="documents">
                    <i class="fa fa-file-text"></i> Documents
                </button>
                ${materialRequests.length > 0 ? `
                    <button class="detail-tab" data-tab="materials">
                        <i class="fa fa-boxes"></i> Materials (${materialRequests.length})
                    </button>
                ` : ''}
                <button class="detail-tab" data-tab="workflow">
                    <i class="fa fa-sitemap"></i> Workflow
                </button>
                <button class="detail-tab" data-tab="disputes">
                    <i class="fa fa-exclamation-triangle"></i> Disputes (${disputes.length})
                </button>
                <button class="detail-tab" data-tab="issues">
                    <i class="fa fa-ticket-alt"></i> Issues (${issues.length})
                </button>
            </div>

            <!-- Content Areas -->
            <div class="detail-content active" data-content="overview">
                ${this.renderEnhancedOverviewSection(order, financialDetails)}
            </div>

            ${order.project ? `
                <div class="detail-content" data-content="project" style="display: none;">
                    ${this.renderProjectSection(projectDetails, tasks, financialDetails)}
                </div>
            ` : ''}

            <div class="detail-content" data-content="financials" style="display: none;">
                ${this.renderEnhancedFinancialsSection(order, invoices, payments, advanceInvoices, financialDetails)}
            </div>

            <div class="detail-content" data-content="team" style="display: none;">
                ${this.renderSalesTeamSection(salesTeam)}
            </div>

            <div class="detail-content" data-content="items" style="display: none;">
                ${this.renderItemsSection(items)}
            </div>

            <div class="detail-content" data-content="schedule" style="display: none;">
                ${this.renderPaymentScheduleSection(paymentSchedule, order)}
            </div>

            <div class="detail-content" data-content="documents" style="display: none;">
                ${this.renderDocumentsSection(invoices, deliveryNotes, quotations, permits)}
            </div>

            ${materialRequests.length > 0 ? `
                <div class="detail-content" data-content="materials" style="display: none;">
                    ${this.renderMaterialRequestsSection(materialRequests)}
                </div>
            ` : ''}

            <div class="detail-content" data-content="workflow" style="display: none;">
                ${this.renderWorkflowSection(opportunities)}
            </div>

            <div class="detail-content" data-content="disputes" style="display: none;">
                ${this.renderDisputesSection(disputes)}
            </div>

            <div class="detail-content" data-content="issues" style="display: none;">
                ${this.renderIssuesSection(issues)}
            </div>

        </div>
        
        <style>
            /* Enhanced Styling for Details Modal */
            .insights-panel {
                background: linear-gradient(135deg, var(--surface-alt) 0%, var(--surface) 100%);
                border-radius: var(--radius-lg);
                padding: var(--space-4);
                border-left: 4px solid var(--primary);
                margin-bottom: var(--space-4);
            }
            
            .insights-header {
                font-weight: 700;
                color: var(--text);
                margin-bottom: var(--space-3);
                display: flex;
                align-items: center;
                gap: var(--space-2);
                font-size: 1rem;
            }
            
            .insights-header i {
                color: var(--warning);
                font-size: 1.125rem;
            }
            
            .insights-grid {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }
            
            .insight-item {
                display: flex;
                align-items: flex-start;
                gap: var(--space-2);
                font-size: 0.875rem;
                color: var(--text-secondary);
                line-height: 1.4;
            }
            
            .insight-item i {
                font-size: 0.875rem;
                margin-top: 2px;
                flex-shrink: 0;
            }
            
            .detail-nav-tabs {
                display: flex;
                gap: var(--space-2);
                border-bottom: 2px solid var(--border);
                padding-bottom: var(--space-3);
                position: sticky;
                top: 0;
                background: var(--surface);
                z-index: 10;
                flex-wrap: wrap;
                margin-bottom: var(--space-4);
            }
            
            .detail-tab {
                padding: var(--space-2) var(--space-4);
                border: none;
                background: transparent;
                border-radius: var(--radius-lg);
                cursor: pointer;
                font-weight: 600;
                font-size: 0.8rem;
                color: var(--text-secondary);
                transition: var(--transition-fast);
                display: flex;
                align-items: center;
                gap: var(--space-1);
                white-space: nowrap;
            }
            
            .detail-tab:hover {
                background: var(--surface-hover);
                color: var(--text);
            }
            
            .detail-tab.active {
                background: var(--primary);
                color: white;
                box-shadow: var(--shadow-sm);
            }
            
            .detail-tab i {
                font-size: 0.875rem;
            }
            
            .detail-section {
                background: var(--surface-alt);
                border-radius: var(--radius-lg);
                padding: var(--space-5);
                margin-bottom: var(--space-4);
            }
            
            .detail-section-title {
                font-size: 1rem;
                font-weight: 700;
                color: var(--text);
                margin-bottom: var(--space-4);
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }
            
            .detail-section-title i {
                font-size: 1.125rem;
            }
            
            .detail-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: var(--space-3);
            }
            
            .detail-field {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }
            
            .detail-label {
                font-size: 0.7rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
            }
            
            .detail-value {
                font-weight: 600;
                color: var(--text);
                font-size: 0.875rem;
            }
            
            .status-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: var(--radius);
                font-size: 0.7rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .status-overdue { background: rgba(239, 68, 68, 0.1); color: var(--error); }
            .status-pending { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
            .status-completed { background: rgba(16, 185, 129, 0.1); color: var(--success); }
            .status-normal { background: rgba(99, 102, 241, 0.1); color: var(--primary); }
            
            .open-doc-btn {
                background: var(--primary);
                color: white;
                border: none;
                border-radius: var(--radius);
                padding: var(--space-1) var(--space-2);
                font-size: 0.7rem;
                font-weight: 600;
                cursor: pointer;
                transition: var(--transition-fast);
                display: inline-flex;
                align-items: center;
                gap: var(--space-1);
            }
            
            .open-doc-btn:hover {
                background: var(--primary-dark);
                transform: scale(1.05);
            }
            
            .document-card {
                background: var(--surface);
                border: 1px solid var(--border-light);
                border-radius: var(--radius-lg);
                padding: var(--space-4);
                transition: var(--transition);
                cursor: pointer;
            }
            
            .document-card:hover {
                transform: translateY(-1px);
                box-shadow: var(--shadow-md);
                border-color: var(--primary-light);
            }
            
            .item-image {
                width: 40px;
                height: 40px;
                border-radius: var(--radius);
                object-fit: cover;
                border: 1px solid var(--border-light);
            }
            
            .team-member-card {
                background: var(--surface);
                border: 1px solid var(--border-light);
                border-radius: var(--radius-lg);
                padding: var(--space-3);
                display: flex;
                align-items: center;
                gap: var(--space-3);
            }
            
            .team-member-image {
                width: 40px;
                height: 40px;
                border-radius: var(--radius-full);
                object-fit: cover;
                border: 2px solid var(--primary-light);
            }
            
            .profit-card {
                background: var(--surface);
                border-radius: var(--radius-lg);
                padding: var(--space-5);
                border: 1px solid var(--border-light);
                transition: var(--transition);
            }
            
            .profit-card:hover {
                transform: translateY(-1px);
                box-shadow: var(--shadow-md);
            }
            
            .financial-metric {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-3) 0;
                border-bottom: 1px solid var(--border-light);
                font-size: 0.875rem;
            }
            
            .financial-metric:last-child {
                border-bottom: none;
                margin: var(--space-3) -var(--space-5) -var(--space-5);
                padding: var(--space-4);
                background: var(--surface-alt);
                border-radius: 0 0 var(--radius-lg) var(--radius-lg);
            }
            
            .task-card {
                background: var(--surface);
                border: 1px solid var(--border-light);
                border-radius: var(--radius-lg);
                padding: var(--space-3);
                transition: var(--transition);
            }
            
            .task-card:hover {
                border-color: var(--primary-light);
                box-shadow: var(--shadow-sm);
            }
            
            .pl-account-row {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr;
                gap: var(--space-3);
                padding: var(--space-2);
                border-bottom: 1px solid var(--border-light);
                align-items: center;
                font-size: 0.8rem;
            }
            
            .pl-account-row:hover {
                background: var(--surface-hover);
            }
            
            .pl-total-row {
                background: var(--surface-alt);
                font-weight: 700;
                border-top: 2px solid var(--primary);
                border-bottom: 2px solid var(--primary);
            }
            
            .metric-card-small {
                text-align: center;
                padding: var(--space-4);
                background: var(--surface);
                border-radius: var(--radius-lg);
                border: 1px solid var(--border);
            }
            
            .metric-card-small .metric-value {
                font-size: 1.25rem;
                font-weight: 700;
                margin-bottom: var(--space-1);
            }
            
            .metric-card-small .metric-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                font-weight: 600;
            }
            
            /* Responsive adjustments */
            @media (max-width: 768px) {
                .detail-grid {
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                }
                
                .pl-account-row {
                    grid-template-columns: 1.5fr 1fr 1fr 1fr;
                    font-size: 0.75rem;
                    padding: var(--space-2);
                }
                
                .detail-tab {
                    font-size: 0.75rem;
                    padding: var(--space-2) var(--space-3);
                }
            }
        </style>
    `;

        this.detail_modal.find('.modal-body').html(html);
        this.setupDetailTabHandlers();
    }
    // Generate insights based on order data
    generateOrderInsights(data) {
        const insights = [];
        const order = data.order || {};
        const financialDetails = data.financial_details || {};
        const tasks = data.tasks || [];
        const paymentSchedule = data.payment_schedule || [];
        const advanceInvoices = data.advance_invoices || [];

        // Financial insights
        if (financialDetails.profit_percentage !== undefined) {
            if (financialDetails.profit_percentage < 35) {
                insights.push({
                    icon: 'fa-exclamation-triangle',
                    color: 'var(--error)',
                    message: `Project profit margin is ${financialDetails.profit_percentage}% - below target of 40%. Consider reviewing expenses or renegotiating pricing.`
                });
            } else if (financialDetails.profit_percentage >= 40) {
                insights.push({
                    icon: 'fa-check-circle',
                    color: 'var(--success)',
                    message: `Excellent profit margin of ${financialDetails.profit_percentage}% - meeting target of 40%.`
                });
            }
        }

        // Delivery insights
        if (order.days_until_delivery < 0) {
            insights.push({
                icon: 'fa-clock',
                color: 'var(--error)',
                message: `Order is ${Math.abs(order.days_until_delivery)} days overdue. Immediate action required.`
            });
        } else if (order.days_until_delivery === 0) {
            insights.push({
                icon: 'fa-truck',
                color: 'var(--warning)',
                message: 'Order is due for delivery today. Ensure all items are ready for dispatch.'
            });
        }

        // Payment insights
        const unpaidAdvances = advanceInvoices.filter(inv => !inv.is_paid);
        if (unpaidAdvances.length > 0) {
            const totalUnpaid = unpaidAdvances.reduce((sum, inv) => sum + parseFloat(inv.outstanding_amount || 0), 0);
            insights.push({
                icon: 'fa-credit-card',
                color: 'var(--warning)',
                message: `${unpaidAdvances.length} advance invoice(s) pending payment totaling ${frappe.format(totalUnpaid, { fieldtype: 'Currency' })}.`
            });
        }

        // Task insights
        const incompleteTasks = tasks.filter(task => task.status !== 'Completed' && task.status !== 'Closed');
        if (incompleteTasks.length > 0 && order.days_until_delivery < 7) {
            insights.push({
                icon: 'fa-tasks',
                color: 'var(--warning)',
                message: `${incompleteTasks.length} task(s) still pending with delivery approaching. Review task priorities.`
            });
        }

        // Budget status insight
        if (financialDetails.status === 'Over Budget') {
            insights.push({
                icon: 'fa-chart-line',
                color: 'var(--error)',
                message: 'Project expenses have exceeded budget limits. Cost control measures recommended.'
            });
        }

        return insights;
    }

    // Enhanced Overview Section
    renderEnhancedOverviewSection(order, financialDetails) {
        const profitStatus = this.getProfitStatus(financialDetails);
        const calculation = this.getRemainingCalculation(order);

        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-info-circle" style="color: var(--primary);"></i>
                Order Information
            </div>
            <div class="detail-grid">
                <div class="detail-field">
                    <div class="detail-label">Order Number</div>
                    <div class="detail-value">${order.name || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Customer</div>
                    <div class="detail-value">${order.customer_name || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${order.status || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Sales Person</div>
                    <div class="detail-value">${order.sales_person || 'Not assigned'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Branch</div>
                    <div class="detail-value">${order.branch || 'Not specified'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Project</div>
                    <div class="detail-value">${order.project || 'Not specified'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Transaction Date</div>
                    <div class="detail-value">${order.formatted_transaction_date || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Delivery Date</div>
                    <div class="detail-value">${order.formatted_delivery_date || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Days Until Delivery</div>
                    <div class="detail-value">
                        <span class="status-badge ${order.days_until_delivery < 0 ? 'status-overdue' : order.days_until_delivery === 0 ? 'status-pending' : 'status-normal'}">
                            ${order.days_until_delivery < 0 ? Math.abs(order.days_until_delivery) + ' days overdue' :
                order.days_until_delivery === 0 ? 'Due today' :
                    order.days_until_delivery === 999999 ? 'No delivery date' :
                        order.days_until_delivery + ' days remaining'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-chart-pie" style="color: var(--success);"></i>
                Financial Overview
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-4);">
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary); margin-bottom: var(--space-2);">
                        ${frappe.format(order.grand_total || 0, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Grand Total</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: #b45309; margin-bottom: var(--space-2);">
                        ${frappe.format(calculation.advanceAmount, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Advance</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: #7c3aed; margin-bottom: var(--space-2);">
                        ${frappe.format(calculation.progressAmount, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Progress Payment</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-2);">
                        ${frappe.format(calculation.actualRemaining, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Actual Remaining</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: ${profitStatus.color}; margin-bottom: var(--space-2);">
                        ${financialDetails.profit_percentage || 0}%
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Profit Margin</div>
                    <div class="status-badge ${profitStatus.badgeClass}" style="margin-top: var(--space-2);">
                        ${profitStatus.label}
                    </div>
                </div>
            </div>

            <div style="margin-top: var(--space-6);">
                ${this.renderRemainingCalculationDetails(order)}
            </div>
            
            <div class="progress-container" style="margin-top: var(--space-6);">
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Billing Progress</span>
                        <span class="progress-value">${parseFloat(order.per_billed || 0).toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar-modern">
                        <div class="progress-fill-modern" style="width: ${parseFloat(order.per_billed || 0)}%"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Delivery Progress</span>
                        <span class="progress-value">${parseFloat(order.per_delivered || 0).toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar-modern">
                        <div class="progress-fill-modern" style="width: ${parseFloat(order.per_delivered || 0)}%"></div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-4); margin-top: var(--space-4);">
            <button class="btn btn-secondary" onclick="window.open('/app/sales-order/${order.name}', '_blank')">
                <i class="fa fa-external-link"></i>
                Open Sales Order
            </button>
            ${order.project ? `
                <button class="btn btn-secondary" onclick="window.open('/app/project/${order.project}', '_blank')">
                    <i class="fa fa-tasks"></i>
                    Open Project
                </button>
            ` : ''}
            ${order.customer ? `
                <button class="btn btn-secondary" onclick="window.open('/app/customer/${order.customer}', '_blank')">
                    <i class="fa fa-building"></i>
                    Open Customer
                </button>
            ` : ''}
        </div>
    `;
    }

    // New Project Section
    renderProjectSection(projectDetails, tasks, financialDetails) {
        if (!projectDetails.name) {
            return `
            <div class="detail-section">
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-project-diagram" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No project linked to this order</div>
                </div>
            </div>
        `;
        }

        const plStatement = financialDetails.profit_loss_statement || {};

        return `
        <div style="display: grid; gap: var(--space-6);">
            <!-- Project Overview -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-project-diagram" style="color: var(--primary);"></i>
                    Project Overview
                </div>
                <div class="detail-grid">
                    <div class="detail-field">
                        <div class="detail-label">Project Name</div>
                        <div class="detail-value">${projectDetails.project_name || projectDetails.name}</div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="status-badge ${projectDetails.status === 'Completed' ? 'status-completed' : 'status-pending'}">
                                ${projectDetails.status}
                            </span>
                        </div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Progress</div>
                        <div class="detail-value">${projectDetails.percent_complete || 0}%</div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Project Owner</div>
                        <div class="detail-value">${projectDetails.custom_project_owner_name || 'Not specified'}</div>
                    </div>
                </div>
            </div>
            
            <!-- Project P&L Statement -->
            ${plStatement.summary ? `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fa fa-chart-bar" style="color: var(--success);"></i>
                        Project Profit & Loss Statement
                    </div>
                    
                    <!-- Summary Cards -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Total Income</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">
                                ${frappe.format(plStatement.summary.total_income || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Total Expenses</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--error);">
                                ${frappe.format(plStatement.summary.total_expense || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Net Profit</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${plStatement.summary.net_profit >= 0 ? 'var(--success)' : 'var(--error)'};">
                                ${frappe.format(plStatement.summary.net_profit || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Profit Margin</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${financialDetails.profit_percentage >= 40 ? 'var(--success)' : financialDetails.profit_percentage >= 35 ? 'var(--warning)' : 'var(--error)'};">
                                ${financialDetails.profit_percentage || 0}%
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--space-1);">Target: 40%</div>
                        </div>
                    </div>
                    
                    <!-- Income Accounts -->
                    ${plStatement.income_accounts && plStatement.income_accounts.length > 0 ? `
                        <div style="margin-bottom: var(--space-6);">
                            <h4 style="font-weight: 600; color: var(--text); margin-bottom: var(--space-3);">Income Accounts</h4>
                            <div style="background: var(--surface); border-radius: var(--radius-lg); overflow: hidden;">
                                <div class="pl-account-row" style="background: var(--surface-alt); font-weight: 600;">
                                    <div>Account</div>
                                    <div style="text-align: right;">Debit</div>
                                    <div style="text-align: right;">Credit</div>
                                    <div style="text-align: right;">Net Income</div>
                                </div>
                                ${plStatement.income_accounts.map(acc => `
                                    <div class="pl-account-row">
                                        <div>${acc.account_name}</div>
                                        <div style="text-align: right;">${frappe.format(acc.total_debit || 0, { fieldtype: 'Currency' })}</div>
                                        <div style="text-align: right;">${frappe.format(acc.total_credit || 0, { fieldtype: 'Currency' })}</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--success);">
                                            ${frappe.format(acc.net_amount || 0, { fieldtype: 'Currency' })}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Expense Accounts -->
                    ${plStatement.expense_accounts && plStatement.expense_accounts.length > 0 ? `
                        <div>
                            <h4 style="font-weight: 600; color: var(--text); margin-bottom: var(--space-3);">Expense Accounts</h4>
                            <div style="background: var(--surface); border-radius: var(--radius-lg); overflow: hidden;">
                                <div class="pl-account-row" style="background: var(--surface-alt); font-weight: 600;">
                                    <div>Account</div>
                                    <div style="text-align: right;">Debit</div>
                                    <div style="text-align: right;">Credit</div>
                                    <div style="text-align: right;">Net Expense</div>
                                </div>
                                ${plStatement.expense_accounts.map(acc => `
                                    <div class="pl-account-row">
                                        <div>${acc.account_name}</div>
                                        <div style="text-align: right;">${frappe.format(acc.total_debit || 0, { fieldtype: 'Currency' })}</div>
                                        <div style="text-align: right;">${frappe.format(acc.total_credit || 0, { fieldtype: 'Currency' })}</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--error);">
                                            ${frappe.format(acc.net_amount || 0, { fieldtype: 'Currency' })}
                                        </div>
                                    </div>
                                `).join('')}
                                <div class="pl-account-row pl-total-row">
                                    <div>Total Expenses</div>
                                    <div style="text-align: right;">-</div>
                                    <div style="text-align: right;">-</div>
                                    <div style="text-align: right; color: var(--error);">
                                        ${frappe.format(plStatement.summary.total_expense || 0, { fieldtype: 'Currency' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <!-- Project Tasks -->
            ${tasks.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fa fa-tasks" style="color: var(--info);"></i>
                        Project Tasks (${tasks.length})
                    </div>
                    <div style="display: grid; gap: var(--space-4);">
                        ${tasks.map(task => `
                            <div class="task-card">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-3);">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${task.subject}
                                        </div>
                                        <div class="status-badge status-${task.status === 'Completed' ? 'completed' : task.status === 'Open' ? 'pending' : 'normal'}">
                                            ${task.status}
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/task/${task.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                    </button>
                                </div>
                                ${task.description ? `
                                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-3);">
                                        ${task.description}
                                    </div>
                                ` : ''}
                                <div class="progress-item">
                                    <div class="progress-header">
                                        <span class="progress-label">Progress</span>
                                        <span class="progress-value">${task.progress || 0}%</span>
                                    </div>
                                    <div class="progress-bar-modern" style="height: 6px;">
                                        <div class="progress-fill-modern" style="width: ${task.progress || 0}%"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    }

    // Enhanced Financials Section
    renderEnhancedFinancialsSection(order, invoices, payments, advanceInvoices, financialDetails) {
        const calculation = this.getRemainingCalculation(order);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
        const totalPaid = payments.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0);
        const totalAdvance = advanceInvoices.reduce((sum, inv) => sum + this.toNumber(inv.advance_amount), 0);
        const totalProgress = advanceInvoices.reduce((sum, inv) => sum + this.toNumber(inv.progress_amount), 0);
        const totalAdvancePaid = advanceInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);

        return `
        <div style="display: grid; gap: var(--space-6);">
            
            <!-- Financial Summary -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-chart-bar" style="color: var(--success);"></i>
                    Financial Summary
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4);">
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: var(--space-1);">
                            ${frappe.format(order.grand_total || 0, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Order Total</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #b45309; margin-bottom: var(--space-1);">
                            ${frappe.format(calculation.advanceAmount, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Advance</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #7c3aed; margin-bottom: var(--space-1);">
                            ${frappe.format(calculation.progressAmount, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Progress Payment</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-1);">
                            ${frappe.format(calculation.actualRemaining, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Actual Remaining</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success); margin-bottom: var(--space-1);">
                            ${frappe.format(totalInvoiced, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Total Invoiced</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--info); margin-bottom: var(--space-1);">
                            ${frappe.format(totalPaid, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Total Paid</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-1);">
                            ${frappe.format(totalOutstanding, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Outstanding</div>
                    </div>
                </div>
                <div style="margin-top: var(--space-4);">
                    ${this.renderRemainingCalculationDetails(order)}
                </div>
            </div>

            <!-- Advance Invoices -->
            ${advanceInvoices.length > 0 ? `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fa fa-file-invoice-dollar" style="color: var(--secondary);"></i>
                        Advance/Progress Invoices (${advanceInvoices.length})
                    </div>
                    <div style="display: grid; gap: var(--space-4);">
                        ${advanceInvoices.map(invoice => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${invoice.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                            ${frappe.datetime.str_to_user(invoice.posting_date)} • ${invoice.status}
                                        </div>
                                        <div style="display: flex; gap: var(--space-4);">
                                            <div>
                                                <span class="detail-label">Advance: </span>
                                                <strong>${frappe.format(invoice.advance_amount || 0, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Progress: </span>
                                                <strong style="color: #7c3aed;">${frappe.format(invoice.progress_amount || 0, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Net Effect: </span>
                                                <strong style="color: var(--primary);">${frappe.format(invoice.net_amount || 0, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Paid: </span>
                                                <strong style="color: var(--success);">${frappe.format(invoice.paid_amount || 0, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="status-badge status-${invoice.is_paid ? 'completed' : 'pending'}">
                                                    ${invoice.is_paid ? 'Paid' : 'Unpaid'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/sales-invoice/${invoice.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        <div style="background: var(--surface-alt); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--primary);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>Advance / Progress Net Totals</strong>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: var(--primary);">
                                        ${frappe.format(totalAdvance, { fieldtype: 'Currency' })}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-muted);">
                                        Progress: ${frappe.format(totalProgress, { fieldtype: 'Currency' })}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-muted);">
                                        Paid: ${frappe.format(totalAdvancePaid, { fieldtype: 'Currency' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Financial Health Analysis -->
            ${financialDetails.total_sales_amount ? `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fa fa-heartbeat" style="color: ${financialDetails.status === 'Within Budget' ? 'var(--success)' : 'var(--error)'}"></i>
                        Financial Health Analysis
                    </div>
                    <div class="profit-card">
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Total Project Revenue</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Income from all sources</div>
                            </div>
                            <div style="font-weight: 700; color: var(--success);">
                                ${frappe.format(financialDetails.total_sales_amount || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Total Expenses</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">All project costs</div>
                            </div>
                            <div style="font-weight: 700; color: var(--error);">
                                ${frappe.format(financialDetails.total_expenses || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Actual Profit</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Revenue - Expenses</div>
                            </div>
                            <div style="font-weight: 700; color: ${financialDetails.actual_profit >= 0 ? 'var(--success)' : 'var(--error)'};">
                                ${frappe.format(financialDetails.actual_profit || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Expense Limit (60% Target)</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Maximum recommended expenses</div>
                            </div>
                            <div style="font-weight: 700;">
                                ${frappe.format(financialDetails.expected_expense_limit || 0, { fieldtype: 'Currency' })}
                            </div>
                        </div>
                        <div class="financial-metric" style="background: var(--surface-alt); padding: var(--space-4); border-radius: var(--radius-lg); margin: var(--space-3) -var(--space-6) -var(--space-6);">
                            <div>
                                <div style="font-weight: 700; font-size: 1.125rem;">Budget Status</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">
                                    ${financialDetails.expense_percentage}% of revenue spent
                                </div>
                            </div>
                            <div>
                                <span class="status-badge status-${financialDetails.status === 'Within Budget' ? 'completed' : financialDetails.status === 'Close to Target' ? 'pending' : 'overdue'}" style="font-size: 1rem; padding: var(--space-2) var(--space-4);">
                                    ${financialDetails.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Payment Entries -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-credit-card" style="color: var(--info);"></i>
                    Payment Entries (${payments.length})
                </div>
                ${payments.length ? `
                    <div style="display: grid; gap: var(--space-4);">
                        ${payments.map(payment => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${payment.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                            ${frappe.datetime.str_to_user(payment.posting_date)} • ${payment.mode_of_payment || 'N/A'}
                                            ${payment.reference_no ? ` • Ref: ${payment.reference_no}` : ''}
                                        </div>
                                        <div style="display: flex; gap: var(--space-4);">
                                            <div>
                                                <span class="detail-label">Amount: </span>
                                                <strong style="color: var(--success);">${frappe.format(payment.paid_amount, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Status: </span>
                                                <span class="status-badge status-${payment.status === 'Submitted' ? 'completed' : 'pending'}">
                                                    ${payment.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/payment-entry/${payment.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-credit-card" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No payment entries recorded</div>
                    </div>
                `}
            </div>

        </div>
    `;
    }

    // Payment Schedule Section
    renderPaymentScheduleSection(paymentSchedule, order) {
        if (!paymentSchedule.length) {
            return `
            <div class="detail-section">
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-calendar-check" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No payment schedule defined for this order</div>
                </div>
            </div>
        `;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-calendar-check" style="color: var(--primary);"></i>
                Payment Schedule
            </div>
            <div class="table-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Payment Term</th>
                            <th>Due Date</th>
                            <th>Invoice Portion (%)</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentSchedule.map(schedule => {
            const dueDate = new Date(schedule.due_date);
            const isPastDue = dueDate < today;
            const isToday = dueDate.toDateString() === today.toDateString();
            const amount = (order.grand_total * schedule.invoice_portion) / 100;

            return `
                                <tr>
                                    <td><strong>${schedule.payment_term}</strong></td>
                                    <td>
                                        ${frappe.datetime.str_to_user(schedule.due_date)}
                                        ${isPastDue ? '<span class="status-badge status-overdue" style="margin-left: var(--space-2);">Overdue</span>' :
                    isToday ? '<span class="status-badge status-pending" style="margin-left: var(--space-2);">Due Today</span>' : ''}
                                    </td>
                                    <td>${schedule.invoice_portion}%</td>
                                    <td><strong>${frappe.format(amount, { fieldtype: 'Currency' })}</strong></td>
                                    <td>
                                        <span class="status-badge status-normal">
                                            ${isPastDue ? 'Check Payment' : 'Upcoming'}
                                        </span>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    }

    // Material Requests Section
    renderMaterialRequestsSection(materialRequests) {
        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-boxes" style="color: var(--warning);"></i>
                Material Requests (${materialRequests.length})
            </div>
            <div style="display: grid; gap: var(--space-4);">
                ${materialRequests.map(mr => `
                    <div class="document-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                    ${mr.name}
                                </div>
                                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                    ${frappe.datetime.str_to_user(mr.transaction_date)} • ${mr.material_request_type}
                                </div>
                                <div>
                                    <span class="status-badge status-${mr.status === 'Submitted' ? 'completed' : mr.status === 'Ordered' ? 'pending' : 'normal'}">
                                        ${mr.status}
                                    </span>
                                </div>
                            </div>
                            <button class="open-doc-btn" onclick="window.open('/app/material-request/${mr.name}', '_blank')">
                                <i class="fa fa-external-link"></i>
                                Open
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    }

    // Helper function to determine profit status
    getProfitStatus(financialDetails) {
        const profitPercentage = financialDetails.profit_percentage || 0;

        if (profitPercentage >= 40) {
            return {
                color: 'var(--success)',
                label: 'Excellent',
                badgeClass: 'status-completed'
            };
        } else if (profitPercentage >= 35) {
            return {
                color: 'var(--warning)',
                label: 'Good',
                badgeClass: 'status-pending'
            };
        } else if (profitPercentage >= 25) {
            return {
                color: 'var(--warning)',
                label: 'Below Target',
                badgeClass: 'status-pending'
            };
        } else {
            return {
                color: 'var(--error)',
                label: 'Poor',
                badgeClass: 'status-overdue'
            };
        }
    }
    renderOverviewSection(order) {
        const calculation = this.getRemainingCalculation(order);
        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-info-circle" style="color: var(--primary);"></i>
                Order Information
            </div>
            <div class="detail-grid">
                <div class="detail-field">
                    <div class="detail-label">Order Number</div>
                    <div class="detail-value">${order.name || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Customer</div>
                    <div class="detail-value">${order.customer_name || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${order.status || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Sales Person</div>
                    <div class="detail-value">${order.sales_person || 'Not assigned'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Branch</div>
                    <div class="detail-value">${order.branch || 'Not specified'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Project</div>
                    <div class="detail-value">${order.project || 'Not specified'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Transaction Date</div>
                    <div class="detail-value">${order.formatted_transaction_date || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Delivery Date</div>
                    <div class="detail-value">${order.formatted_delivery_date || 'N/A'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-label">Days Until Delivery</div>
                    <div class="detail-value">
                        <span class="status-badge ${order.days_until_delivery < 0 ? 'status-overdue' : order.days_until_delivery === 0 ? 'status-pending' : 'status-normal'}">
                            ${order.days_until_delivery < 0 ? Math.abs(order.days_until_delivery) + ' days overdue' :
                order.days_until_delivery === 0 ? 'Due today' :
                    order.days_until_delivery === 999999 ? 'No delivery date' :
                        order.days_until_delivery + ' days remaining'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-chart-pie" style="color: var(--success);"></i>
                Financial Overview
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-4);">
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary); margin-bottom: var(--space-2);">
                        ${frappe.format(order.grand_total || 0, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Grand Total</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: #b45309; margin-bottom: var(--space-2);">
                        ${frappe.format(calculation.advanceAmount, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Advance</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: #7c3aed; margin-bottom: var(--space-2);">
                        ${frappe.format(calculation.progressAmount, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Progress Payment</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-2);">
                        ${frappe.format(calculation.actualRemaining, { fieldtype: 'Currency' })}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Actual Remaining</div>
                </div>
            </div>

            <div style="margin-top: var(--space-6);">
                ${this.renderRemainingCalculationDetails(order)}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-top: var(--space-6);">
                <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div class="status-badge ${order.billing_status === 'Fully Billed' ? 'status-completed' : 'status-pending'}" style="font-size: 1rem; padding: var(--space-2) var(--space-4);">
                        ${order.billing_status || 'Unknown'}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-top: var(--space-2);">Billing Status</div>
                </div>
                <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div class="status-badge ${order.delivery_status === 'Fully Delivered' ? 'status-completed' : 'status-pending'}" style="font-size: 1rem; padding: var(--space-2) var(--space-4);">
                        ${order.delivery_status || 'Unknown'}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-top: var(--space-2);">Delivery Status</div>
                </div>
            </div>
            
            <div class="progress-container" style="margin-top: var(--space-6);">
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Billing Progress</span>
                        <span class="progress-value">${parseFloat(order.per_billed || order.percent_amount_billed || 0).toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar-modern">
                        <div class="progress-fill-modern" style="width: ${parseFloat(order.per_billed || order.percent_amount_billed || 0)}%"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Delivery Progress</span>
                        <span class="progress-value">${parseFloat(order.per_delivered || order.percent_amount_delivered || 0).toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar-modern">
                        <div class="progress-fill-modern" style="width: ${parseFloat(order.per_delivered || order.percent_amount_delivered || 0)}%"></div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-4); margin-top: var(--space-4);">
            <button class="btn btn-secondary" onclick="window.open('/app/sales-order/${order.name}', '_blank')">
                <i class="fa fa-external-link"></i>
                Open Sales Order
            </button>
            ${order.project ? `
                <button class="btn btn-secondary" onclick="window.open('/app/project/${order.project}', '_blank')">
                    <i class="fa fa-tasks"></i>
                    Open Project
                </button>
            ` : ''}
            ${order.customer ? `
                <button class="btn btn-secondary" onclick="window.open('/app/customer/${order.customer}', '_blank')">
                    <i class="fa fa-building"></i>
                    Open Customer
                </button>
            ` : ''}
        </div>
    `;
    }

    renderSalesTeamSection(salesTeam) {
        if (!salesTeam.length) {
            return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-users" style="color: var(--primary);"></i>
                    Sales Team
                </div>
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-users" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No sales team assigned to this order</div>
                </div>
            </div>
        `;
        }

        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-users" style="color: var(--primary);"></i>
                Sales Team (${salesTeam.length} members)
            </div>
            <div style="display: grid; gap: var(--space-4);">
                ${salesTeam.map(member => `
                    <div class="team-member-card">
                        <img src="${member.image || '/assets/frappe/images/default-avatar.png'}" 
                             class="team-member-image" 
                             onerror="this.src='/assets/frappe/images/default-avatar.png'">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                ${member.employee_name || member.sales_person}
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                ${member.sales_person} • ${member.branch || 'Branch not specified'}
                            </div>
                            <div style="display: flex; gap: var(--space-4);">
                                <div>
                                    <div class="detail-label">Allocation %</div>
                                    <div class="detail-value">${member.allocated_percentage || 0}%</div>
                                </div>
                                <div>
                                    <div class="detail-label">Allocated Amount</div>
                                    <div class="detail-value">${frappe.format(member.allocated_amount || 0, { fieldtype: 'Currency' })}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    }

    renderItemsSection(items) {
        if (!items.length) {
            return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-list" style="color: var(--primary);"></i>
                    Order Items
                </div>
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-inbox" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No items found in this order</div>
                </div>
            </div>
        `;
        }

        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-list" style="color: var(--primary);"></i>
                Order Items (${items.length} items)
            </div>
            <div class="table-body" style="border-radius: var(--radius-lg); overflow: hidden;">
                <table class="data-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                            <th>Delivered</th>
                            <th>Billed</th>
                            <th>Pending</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: var(--space-2);">
                                        ${item.image ? `
                                            <img src="${item.image}" class="item-image" onerror="this.style.display='none'">
                                        ` : `
                                            <div class="item-image" style="background: var(--surface-alt); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.875rem;">
                                                <i class="fa fa-cube"></i>
                                            </div>
                                        `}
                                        <div>
                                            <div style="font-weight: 600; color: var(--text); font-size: 0.8rem;">${item.item_code}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.item_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>${item.qty || 0}</td>
                                <td>${frappe.format(item.rate || 0, { fieldtype: 'Currency' })}</td>
                                <td><strong>${frappe.format(item.amount || 0, { fieldtype: 'Currency' })}</strong></td>
                                <td>
                                    <span class="status-badge ${item.delivered_qty >= item.qty ? 'status-completed' : 'status-pending'}">
                                        ${item.delivered_qty || 0}
                                    </span>
                                </td>
                                <td>${frappe.format(item.billed_amt || 0, { fieldtype: 'Currency' })}</td>
                                <td>
                                    <div style="font-size: 0.75rem;">
                                        <div>Qty: ${item.pending_qty || 0}</div>
                                        <div style="color: var(--warning); font-weight: 600;">
                                            ${frappe.format(item.pending_amount || 0, { fieldtype: 'Currency' })}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <button class="open-doc-btn" onclick="window.open('/app/item/${item.item_code}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        View
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    }
    renderDocumentsSection(invoices, deliveryNotes, quotations, permits) {
        return `
        <div style="display: grid; gap: var(--space-6);">
            
            <!-- Invoices Section -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-file-text" style="color: var(--success);"></i>
                    Sales Invoices (${invoices.length})
                </div>
                ${invoices.length ? `
                    <div style="display: grid; gap: var(--space-4);">
                        ${invoices.map(invoice => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${invoice.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                            ${frappe.datetime.str_to_user(invoice.posting_date)} • ${invoice.status}
                                        </div>
                                        <div style="display: flex; gap: var(--space-4);">
                                            <div>
                                                <span class="detail-label">Total: </span>
                                                <strong>${frappe.format(invoice.grand_total, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Outstanding: </span>
                                                <strong style="color: var(--warning);">${frappe.format(invoice.outstanding_amount, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/sales-invoice/${invoice.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-file-text" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No invoices created yet</div>
                    </div>
                `}
            </div>

            <!-- Delivery Notes Section -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-truck" style="color: var(--info);"></i>
                    Delivery Notes (${deliveryNotes.length})
                </div>
                ${deliveryNotes.length ? `
                    <div style="display: grid; gap: var(--space-4);">
                        ${deliveryNotes.map(dn => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${dn.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                            ${frappe.datetime.str_to_user(dn.posting_date)} • ${dn.status}
                                        </div>
                                        <div>
                                            <span class="detail-label">Total: </span>
                                            <strong>${frappe.format(dn.grand_total, { fieldtype: 'Currency' })}</strong>
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/delivery-note/${dn.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-truck" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No delivery notes created yet</div>
                    </div>
                `}
            </div>

            <!-- Quotations Section -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-quote-left" style="color: var(--secondary);"></i>
                    Related Quotations (${quotations.length})
                </div>
                ${quotations.length ? `
                    <div style="display: grid; gap: var(--space-4);">
                        ${quotations.map(quote => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${quote.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                            Status: ${quote.status}
                                            ${quote.opportunity ? ` • Opportunity: ${quote.opportunity}` : ''}
                                        </div>
                                        <div>
                                            <span class="detail-label">Total: </span>
                                            <strong>${frappe.format(quote.grand_total, { fieldtype: 'Currency' })}</strong>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: var(--space-2);">
                                        <button class="open-doc-btn" onclick="window.open('/app/quotation/${quote.name}', '_blank')">
                                            <i class="fa fa-external-link"></i>
                                            Open
                                        </button>
                                        ${quote.opportunity ? `
                                            <button class="open-doc-btn" onclick="window.open('/app/opportunity/${quote.opportunity}', '_blank')">
                                                <i class="fa fa-bullseye"></i>
                                                Opportunity
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-quote-left" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No related quotations found</div>
                    </div>
                `}
            </div>

            <!-- Permits Section -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-certificate" style="color: var(--warning);"></i>
                    Permits (${permits.length})
                </div>
                ${permits.length ? `
                    <div style="display: grid; gap: var(--space-4);">
                        ${permits.map(permit => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="font-weight: 700; color: var(--text);">
                                        ${permit.name}
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/permit/${permit.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-certificate" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No permits linked to this order</div>
                    </div>
                `}
            </div>

        </div>
    `;
    }

    renderFinancialsSection(order, invoices, payments) {
        const calculation = this.getRemainingCalculation(order);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
        const totalPaid = payments.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0);

        return `
        <div style="display: grid; gap: var(--space-6);">
            
            <!-- Financial Summary -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-chart-bar" style="color: var(--success);"></i>
                    Financial Summary
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4);">
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: var(--space-1);">
                            ${frappe.format(order.grand_total || 0, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Order Total</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #b45309; margin-bottom: var(--space-1);">
                            ${frappe.format(calculation.advanceAmount, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Advance</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #7c3aed; margin-bottom: var(--space-1);">
                            ${frappe.format(calculation.progressAmount, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Progress Payment</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-1);">
                            ${frappe.format(calculation.actualRemaining, { fieldtype: 'Currency' })}
                        </div>
                        <div class="detail-label">Actual Remaining</div>
                    </div>
                </div>
                <div style="margin-top: var(--space-4);">
                    ${this.renderRemainingCalculationDetails(order)}
                </div>
            </div>

            <!-- Payment Entries -->
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-credit-card" style="color: var(--info);"></i>
                    Payment Entries (${payments.length})
                </div>
                ${payments.length ? `
                    <div style="display: grid; gap: var(--space-4);">
                        ${payments.map(payment => `
                            <div class="document-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                            ${payment.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                            ${frappe.datetime.str_to_user(payment.posting_date)} • ${payment.mode_of_payment || 'N/A'}
                                            ${payment.reference_no ? ` • Ref: ${payment.reference_no}` : ''}
                                        </div>
                                        <div style="display: flex; gap: var(--space-4);">
                                            <div>
                                                <span class="detail-label">Amount: </span>
                                                <strong style="color: var(--success);">${frappe.format(payment.paid_amount, { fieldtype: 'Currency' })}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Status: </span>
                                                <span class="status-badge status-${payment.status === 'Submitted' ? 'completed' : 'pending'}">
                                                    ${payment.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/payment-entry/${payment.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                        <i class="fa fa-credit-card" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                        <div>No payment entries recorded</div>
                    </div>
                `}
            </div>

        </div>
    `;
    }

    renderWorkflowSection(opportunities) {
        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-sitemap" style="color: var(--secondary);"></i>
                Sales Workflow & Process Documents
            </div>
            ${opportunities.length ? `
                <div style="display: grid; gap: var(--space-6);">
                    ${opportunities.map(opp => `
                        <div style="background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: var(--space-6);">
                            
                            <!-- Opportunity Details -->
                            <div style="margin-bottom: var(--space-6);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); font-size: 1.125rem; margin-bottom: var(--space-1);">
                                            ${opp.opportunity.name}
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted);">
                                            ${opp.opportunity.opportunity_from}: ${opp.opportunity.party_name} • Status: ${opp.opportunity.status}
                                        </div>
                                    </div>
                                    <button class="open-doc-btn" onclick="window.open('/app/opportunity/${opp.opportunity.name}', '_blank')">
                                        <i class="fa fa-external-link"></i>
                                        Open Opportunity
                                    </button>
                                </div>
                            </div>

                            <!-- Site Visits -->
                            ${opp.site_visits.length ? `
                                <div style="margin-bottom: var(--space-6);">
                                    <div style="font-weight: 600; color: var(--text); margin-bottom: var(--space-3); display: flex; align-items: center; gap: var(--space-2);">
                                        <i class="fa fa-map-marker" style="color: var(--info);"></i>
                                        Site Visits (${opp.site_visits.length})
                                    </div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-3);">
                                        ${opp.site_visits.map(visit => `
                                            <div class="document-card" style="padding: var(--space-3);">
                                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                                    <div style="font-weight: 600; color: var(--text);">${visit.name}</div>
                                                    <button class="open-doc-btn" style="padding: var(--space-1) var(--space-2); font-size: 0.7rem;" onclick="window.open('/app/site-visit/${visit.name}', '_blank')">
                                                        <i class="fa fa-external-link"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Design Requests -->
                            ${opp.design_requests.length ? `
                                <div>
                                    <div style="font-weight: 600; color: var(--text); margin-bottom: var(--space-3); display: flex; align-items: center; gap: var(--space-2);">
                                        <i class="fa fa-paint-brush" style="color: var(--secondary);"></i>
                                        Design Requests (${opp.design_requests.length})
                                    </div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-3);">
                                        ${opp.design_requests.map(design => `
                                            <div class="document-card" style="padding: var(--space-3);">
                                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                                    <div style="font-weight: 600; color: var(--text);">${design.name}</div>
                                                    <button class="open-doc-btn" style="padding: var(--space-1) var(--space-2); font-size: 0.7rem;" onclick="window.open('/app/design-request/${design.name}', '_blank')">
                                                        <i class="fa fa-external-link"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${!opp.site_visits.length && !opp.design_requests.length ? `
                                <div style="text-align: center; padding: var(--space-4); color: var(--text-muted);">
                                    <i class="fa fa-info-circle" style="font-size: 1.5rem; margin-bottom: var(--space-2);"></i>
                                    <div>No site visits or design requests recorded</div>
                                </div>
                            ` : ''}

                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-sitemap" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No workflow documents found</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">This order doesn't have any linked opportunities, site visits, or design requests</div>
                </div>
            `}
        </div>
    `;
    }

    renderDisputesSection(disputes) {
        if (!disputes.length) {
            return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-exclamation-triangle" style="color: var(--error);"></i>
                    Active Disputes
                </div>
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-check-circle" style="font-size: 3rem; margin-bottom: var(--space-4); color: var(--success);"></i>
                    <div>No active disputes found for this order</div>
                </div>
            </div>
        `;
        }

        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-exclamation-triangle" style="color: var(--error);"></i>
                Active Disputes (${disputes.length})
            </div>
            <div style="display: grid; gap: var(--space-4);">
                ${disputes.map(d => `
                    <div class="document-card" onclick="window.open('/app/dispute/${d.name}', '_blank')">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                    ${d.name}
                                </div>
                                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                    ${frappe.datetime.str_to_user(d.date)} • ${d.reason}
                                </div>
                                <div style="display: flex; gap: var(--space-4);">
                                    <div>
                                        <span class="detail-label">Amount: </span>
                                        <strong style="color: var(--error);">${frappe.format(d.amount, { fieldtype: 'Currency' })}</strong>
                                    </div>
                                    <div>
                                        <span class="status-badge status-overdue">
                                            ${d.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button class="open-doc-btn">
                                <i class="fa fa-external-link"></i>
                                Open
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    }

    renderIssuesSection(issues) {
        if (!issues.length) {
            return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-ticket-alt" style="color: var(--warning);"></i>
                    Active Issues
                </div>
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-thumbs-up" style="font-size: 3rem; margin-bottom: var(--space-4); color: var(--success);"></i>
                    <div>No active issues found for this order</div>
                </div>
            </div>
        `;
        }

        return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-ticket-alt" style="color: var(--warning);"></i>
                Active Issues (${issues.length})
            </div>
            <div style="display: grid; gap: var(--space-4);">
                ${issues.map(i => `
                    <div class="document-card" onclick="window.open('/app/issue/${i.name}', '_blank')">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                    ${i.name}: ${i.subject}
                                </div>
                                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                    ${frappe.datetime.str_to_user(i.date)} • Priority: ${i.priority}
                                </div>
                                <div>
                                    <span class="status-badge status-pending">
                                        ${i.status}
                                    </span>
                                </div>
                            </div>
                            <button class="open-doc-btn">
                                <i class="fa fa-external-link"></i>
                                Open
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    }

    setupDetailTabHandlers() {
        $('.detail-tab').on('click', function () {
            const tabId = $(this).data('tab');

            // Update active tab
            $('.detail-tab').removeClass('active');
            $(this).addClass('active');

            // Show corresponding content
            $('.detail-content').hide();
            $(`.detail-content[data-content="${tabId}"]`).show();
        });
    }
    exportData() {
        // Prepare data for export
        const headers = ['Order #', 'Customer', 'Project', 'Project Description', 'Sales Person', 'Delivery Date', 'Status', 'Grand Total', 'Advance Amount', 'Progress Payment', 'Actual Remaining', 'Billing %', 'Delivery %'];
        const rows = this.filtered_orders.map(order => [
            order.name,
            order.customer,
            order.project || '',
            order.project_description || '',
            order.sales_person,
            order.delivery_date,
            order.status || 'Unknown',
            order.grand_total,
            order.advance_amount || 0,
            order.progress_amount || 0,
            order.remaining_amount,
            order.per_billed,
            order.per_delivered
        ]);

        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_orders_${frappe.datetime.now_datetime().replace(/[^0-9]/g, '')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showToast('Data exported successfully', 'success');
    }
    showSettingsModal() {
        // Placeholder for settings modal
        this.showToast('Settings panel coming soon', 'info');
    }

    showError(message) {
        this.content_area.html(`
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fa fa-exclamation-triangle" style="color: var(--error);"></i>
                </div>
                <div class="empty-state-title">Error</div>
                <div class="empty-state-message">${message}</div>
                <button class="btn btn-primary btn-lg" onclick="frappe.sales_order_dashboard.loadData()">
                    <i class="fa fa-refresh"></i>
                    Retry
                </button>
            </div>
        `);
    }

    // Utility methods
    formatDueDays(days) {
        if (days < 0) {
            return `${Math.abs(days)} days overdue`;
        } else if (days === 0) {
            return 'Due today';
        } else if (days === 1) {
            return 'Due tomorrow';
        } else {
            return `Due in ${days} days`;
        }
    }

    getDueStatus(days) {
        if (days < 0) return 'overdue';
        if (days === 0) return 'due-today';
        return 'upcoming';
    }

    getMonthName(month) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[month];
    }

    applyGlobalFilter(query) {
        if (!query) {
            this.applyFilters();
            return;
        }

        const lowerQuery = query.toLowerCase();

        // Start with all orders
        let filtered = [...this.all_orders];

        // Apply customer type filter first if it's set
        const customerType = $('#customer-type-filter').val();
        if (customerType) {
            if (customerType === 'internal') {
                filtered = filtered.filter(order => order.is_internal_customer === 1 || order.is_internal_customer === true);
            } else if (customerType === 'external') {
                filtered = filtered.filter(order => !order.is_internal_customer || order.is_internal_customer === 0);
            }
        }

        if (this.show_on_hold_only) {
            filtered = filtered.filter(order => this.isOnHoldOrder(order));
        }

        // Then apply global search filter - INCLUDING PROJECT FIELDS
        this.filtered_orders = filtered.filter(order =>
            order.name.toLowerCase().includes(lowerQuery) ||
            order.customer.toLowerCase().includes(lowerQuery) ||
            (order.sales_person || '').toLowerCase().includes(lowerQuery) ||
            (order.sales_team || '').toLowerCase().includes(lowerQuery) ||
            (order.status || '').toLowerCase().includes(lowerQuery) ||
            (order.branch || '').toLowerCase().includes(lowerQuery) ||
            (order.project || '').toLowerCase().includes(lowerQuery) ||
            (order.project_description || '').toLowerCase().includes(lowerQuery)
        );

        this.processData();
        this.updateActiveFilters();
        this.updateHeaderStats();
        this.renderView();
    }
}

// Export the class
window.UltraModernSalesOrderDashboard = UltraModernSalesOrderDashboard;

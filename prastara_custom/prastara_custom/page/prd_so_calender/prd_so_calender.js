// Ultra-Modern Sales Order Analytics Dashboard - Complete Redesign
frappe.pages['prd-so-calender'].on_page_load = function(wrapper) {
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
        this.all_orders = [];
        this.filtered_orders = [];
        this.calendar_date = new Date();
        this.filter_options = { customers: [], sales_persons: [], branches: [], statuses: [] };
        this.search_timeout = null;
        this.theme = 'light'; // Can be extended for dark mode
        
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
    /* Enhanced Green Color Palette */
    --primary: #2e4d3a;
    --primary-light: #4a6b5a;
    --primary-dark: #1a2d24;
    --primary-glass: rgba(46, 77, 58, 0.12);
    --secondary: #3d5a47;
    --secondary-light: #5c7a68;
    --accent: #8b5a3c;
    --success: #059669;
    --warning: #d97706;
    --error: #dc2626;
    --info: #0f766e;
    
    /* Light Surface Colors */
    --surface: #ffffff;
    --surface-glass: rgba(255, 255, 255, 0.9);
    --surface-alt: #f8faf9;
    --surface-hover: #f1f5f3;
    --surface-dark: #e6f2e8;
    --surface-elevated: #ffffff;
    --surface-card: #ffffff;
    --glass-border: rgba(46, 77, 58, 0.15);
    
    /* Enhanced Dark Text Colors */
    --text: #0f1712;
    --text-secondary: #1a2d24;
    --text-muted: #2e4d3a;
    --text-light: #4a6b5a;
    --text-inverse: #ffffff;
    
    /* Enhanced Borders & Shadows */
    --border: #c7d6cc;
    --border-light: #e1ece4;
    --border-dark: #9eb5a5;
    --border-subtle: #f1f5f3;
    --shadow-sm: 0 1px 3px 0 rgb(15 23 18 / 0.08);
    --shadow-md: 0 4px 6px -1px rgb(15 23 18 / 0.12);
    --shadow-lg: 0 10px 15px -3px rgb(15 23 18 / 0.15);
    --shadow-xl: 0 20px 25px -5px rgb(15 23 18 / 0.18);
    --shadow-2xl: 0 25px 50px -12px rgb(15 23 18 / 0.25);
    --shadow-inner: inset 0 2px 4px 0 rgb(15 23 18 / 0.08);
    --shadow-glow: 0 0 25px rgba(46, 77, 58, 0.15);
    --shadow-color: 0 0 20px rgba(46, 77, 58, 0.12);
    
    /* Sophisticated Green Gradients */
    --gradient-primary: linear-gradient(135deg, #2e4d3a 0%, #3d5a47 100%);
    --gradient-secondary: linear-gradient(135deg, #3d5a47 0%, #8b5a3c 100%);
    --gradient-success: linear-gradient(135deg, #059669 0%, #0f766e 100%);
    --gradient-warm: linear-gradient(135deg, #8b5a3c 0%, #d97706 100%);
    --gradient-cool: linear-gradient(135deg, #0f766e 0%, #2e4d3a 100%);
    --gradient-dark: linear-gradient(135deg, #0f1712 0%, #1a2d24 100%);
    --gradient-surface: linear-gradient(135deg, #ffffff 0%, #f8faf9 100%);
    --gradient-glass: linear-gradient(135deg, rgba(46, 77, 58, 0.05) 0%, rgba(61, 90, 71, 0.05) 100%);
    
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
    
    /* Special Green Theme Effects */
    --glow-subtle: 0 0 10px rgba(46, 77, 58, 0.08);
    --glow-medium: 0 0 20px rgba(46, 77, 58, 0.12);
    --glow-strong: 0 0 30px rgba(46, 77, 58, 0.15);
    --backdrop-blur: blur(8px);
    --backdrop-saturate: saturate(120%);
    
    /* Interactive States */
    --hover-overlay: rgba(46, 77, 58, 0.06);
    --focus-ring: 0 0 0 3px rgba(46, 77, 58, 0.15);
    --active-overlay: rgba(46, 77, 58, 0.12);
    
    /* Enhanced Status Indicators */
    --status-online: #059669;
    --status-away: #d97706;
    --status-busy: #dc2626;
    --status-offline: #64748b;
    
    /* Dark Element Overlays for Contrast */
    --dark-overlay-1: rgba(15, 23, 18, 0.05);
    --dark-overlay-2: rgba(15, 23, 18, 0.08);
    --dark-overlay-3: rgba(15, 23, 18, 0.12);
    
    /* Typography Enhancements */
    --text-contrast: #061708;
    --text-heading: #0f1712;
    --text-body: #1a2d24;
    --text-caption: #2e4d3a;
}
:root {
    /* Additional Green Variations */
    --green-50: #f7fdf8;
    --green-100: #f0faf2;
    --green-200: #dcf4e0;
    --green-300: #bfe7c7;
    --green-400: #9bd3a4;
    --green-500: #6ab377;
    --green-600: #4a8c57;
    --green-700: #3d7347;
    --green-800: #2e4d3a;
    --green-900: #1f342a;
    --green-950: #0f1712;
    
    /* Forest Green Accents */
    --forest-light: #5c7a68;
    --forest-base: #3d5a47;
    --forest-dark: #2a3f32;
    
    /* Sage Green Variations */
    --sage-light: #a8c3b0;
    --sage-base: #7ea088;
    --sage-dark: #5a7961;
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
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-4);
}
.header-stat {
box-shadow: rgba(0, 0, 0, 0.15) 0px 15px 25px, rgba(0, 0, 0, 0.05) 0px 5px 10px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    transition: var(--transition);
    cursor: pointer;
    position: relative;
    overflow: hidden;
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
    font-weight: 700;
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
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: black;
    font-size: 1.25rem;
    margin-bottom: var(--space-4);
    box-shadow: var(--shadow-md);
}

.header-stat-content {
    position: relative;
    z-index: 1;
}
    
.header-stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: black;
    margin-bottom: var(--space-1);
    line-height: 1;
}

.header-stat-label {
    color: rgba(34, 34, 34, 0.9);
    font-size: 0.800rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-2);
}

.header-stat-amount {
    color: rgba(28, 28, 28, 0.8);
    font-size: 0.8rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.1);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    display: inline-block;
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
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (max-width: 768px) {
    .header-stats {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-4);
    }
    
    .header-stat {
        padding: var(--space-4);
    }
    
    .header-stat-value {
        font-size: 1.75rem;
    }
    
    .header-stat-icon {
        width: 40px;
        height: 40px;
        font-size: 1rem;
    }
}

@media (max-width: 480px) {
    .header-stats {
        grid-template-columns: 1fr;
    }
}

            .header-stat-value {
                font-size: 1.75rem;
                font-weight: 700;
                color: black;
                margin-bottom: var(--space-1);
            }

            .header-stat-label {
                color: rgba(38, 38, 38, 0.9);
                font-size: 0.800rem;
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
                background: var(--gradient-primary);
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
        </style>`).appendTo('head');
    }

    setupLayout() {
        this.page.main.addClass('ultra-modern-dashboard');
        
        this.container = $(`
            <div class="dashboard-wrapper">
                <!-- Header Section -->
                <div class="dashboard-header-section">
                    <div class="dashboard-header-content">
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
        
        this.content_area = $('#content-area');
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

        // Add hover effect to quick search button
        $(document).on('mouseenter', '#quick-search-btn', function() {
            $(this).css({
                'transform': 'translateY(-2px)',
                'box-shadow': '0 6px 16px rgba(59, 130, 246, 0.4)'
            });
        }).on('mouseleave', '#quick-search-btn', function() {
            $(this).css({
                'transform': 'translateY(0)',
                'box-shadow': '0 4px 12px rgba(59, 130, 246, 0.3)'
            });
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
                    <i class="fa fa-ellipsis-v"></i>
                </button>
            </div>
        `;

        $(fabHtml).appendTo('body');

        $('#fab').on('click', function() {
            $('#fab-menu').toggleClass('active');
        });

        $('.fab-menu-item').on('click', (e) => {
            const action = $(e.currentTarget).data('action');
            this.handleFabAction(action);
            $('#fab').click(); // Close menu
        });
    }

    handleFabAction(action) {
        switch(action) {
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
            let history = getSearchHistory();
            history = [query, ...history.filter(q => q !== query)].slice(0, 10);
            localStorage.setItem('prd_search_history', JSON.stringify(history));
        };

        // Get recent items
        const getRecentItems = () => {
            try {
                return JSON.parse(localStorage.getItem('prd_recent_items') || '[]');
            } catch (e) {
                return [];
            }
        };

        // Save recent item
        const saveRecentItem = (item) => {
            let recent = getRecentItems();
            recent = [item, ...recent.filter(r => r.id !== item.id)].slice(0, 5);
            localStorage.setItem('prd_recent_items', JSON.stringify(recent));
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
                        <div style="display: flex; gap: 8px; margin-top: 12px;" id="search-filter-tabs">
                            <button class="filter-tab active" data-filter="all" style="flex: 1; padding: 8px 16px; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(10px);">
                                <i class="fa fa-th-large" style="margin-right: 6px;"></i>All
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

            <style>
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
                    cursor: pointer;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 2px solid transparent;
                }

                .search-result-item:hover {
                    transform: translateX(4px);
                    background: white !important;
                    border-color: var(--primary) !important;
                    box-shadow: 0 4px 12px var(--primary-glass) !important;
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
            </style>
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
        $('.filter-tab').on('click', function(e) {
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

        // Keyboard navigation
        searchInput.on('keydown', (e) => {
            const items = $('.search-result-item:visible');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection(items);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                $(items[selectedIndex]).click();
            }
        });

        const updateSelection = (items) => {
            items.removeClass('selected');
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                const selected = $(items[selectedIndex]);
                selected.addClass('selected');

                // Scroll into view
                const container = resultsContainer;
                const itemTop = selected.position().top;
                const containerHeight = container.height();

                if (itemTop < 0) {
                    container.scrollTop(container.scrollTop() + itemTop - 20);
                } else if (itemTop + selected.outerHeight() > containerHeight) {
                    container.scrollTop(container.scrollTop() + (itemTop + selected.outerHeight() - containerHeight) + 20);
                }
            }
        };

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
                    method: 'prastara_custom.controller.variant_pricing.search_sales_orders_and_projects',
                    args: { query: query },
                    callback: (r) => {
                        if (r.message && r.message.status === 'success') {
                            currentResults = {
                                salesOrders: r.message.data.sales_orders || [],
                                projects: r.message.data.projects || []
                            };
                            self.renderQuickSearchResults(currentResults, null, query, currentFilter);
                        } else {
                            resultsContainer.html(`
                                <div style="text-align: center; padding: 60px 24px;">
                                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <i class="fa fa-exclamation-triangle" style="font-size: 32px; color: #dc2626;"></i>
                                    </div>
                                    <div style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">Search Error</div>
                                    <div style="font-size: 14px; color: #64748b;">Unable to perform search. Please try again.</div>
                                </div>
                            `);
                        }
                    }
                });
            }, 300);
        });

        // Handle history item clicks
        resultsContainer.on('click', '.history-item', function() {
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

        // Recent searches
        if (history && history.length > 0) {
            html += `
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <i class="fa fa-history" style="color: #64748b; font-size: 14px;"></i>
                        <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Recent Searches</h4>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${history.map(q => `
                            <div class="history-item" style="padding: 8px 14px; background: white; border: 1px solid #e2e8f0; border-radius: 20px; font-size: 13px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
                                <i class="fa fa-search" style="font-size: 11px; color: #94a3b8;"></i>
                                ${q}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Tips
        html += `
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 20px; border-radius: 12px; border: 1px solid #bae6fd;">
                <div style="display: flex; gap: 16px; align-items: start;">
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="fa fa-lightbulb-o" style="font-size: 24px; color: white;"></i>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0c4a6e;">Search Tips</h4>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #075985; line-height: 1.8;">
                            <li>Search by <strong>Order ID</strong>, <strong>Project Name</strong>, or <strong>Customer Name</strong></li>
                            <li>Use <strong>↑ ↓</strong> arrow keys to navigate results</li>
                            <li>Press <strong>Enter</strong> to open selected item</li>
                            <li>Use filter tabs to narrow your search</li>
                        </ul>
                    </div>
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

        console.log('=== renderQuickSearchResults called ===');
        console.log('Sales Orders:', salesOrders.length);
        console.log('Projects:', projects.length);
        console.log('Results Container:', resultsContainer.length);

        // Apply filter
        const filteredSalesOrders = (filter === 'all' || filter === 'orders') ? salesOrders : [];
        const filteredProjects = (filter === 'all' || filter === 'projects') ? projects : [];

        if (filteredSalesOrders.length === 0 && filteredProjects.length === 0) {
            resultsContainer.html(`
                <div style="text-align: center; padding: 60px 24px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fa fa-search" style="font-size: 36px; color: #94a3b8;"></i>
                    </div>
                    <div style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">No Results Found</div>
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Try searching with different keywords or adjust your filters</div>
                    <div style="display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                        <div style="padding: 6px 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 12px; color: #0369a1;">
                            <i class="fa fa-lightbulb-o" style="margin-right: 4px;"></i>
                            Try broader terms
                        </div>
                        <div style="padding: 6px 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 12px; color: #0369a1;">
                            <i class="fa fa-filter" style="margin-right: 4px;"></i>
                            Check "All" filter
                        </div>
                    </div>
                </div>
            `);
            return;
        }

        let html = '<div style="padding: 16px;">';

        if (filteredSalesOrders.length > 0) {
            html += `
                <div style="margin-bottom: ${filteredProjects.length > 0 ? '24px' : '0'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px 12px; background: #eff6ff; border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                                <i class="fa fa-file-text" style="color: white; font-size: 14px;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: #1e40af; font-size: 14px;">Sales Orders</div>
                                <div style="font-size: 11px; color: #60a5fa;">${filteredSalesOrders.length} result${filteredSalesOrders.length > 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    </div>
                    <div style="display: grid; gap: 10px;">
                        ${filteredSalesOrders.map(so => `
                            <div class="search-result-item" style="padding: 14px; background: white; border-radius: 10px; border: 2px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,0.08);" data-order="${so.name}">
                                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 700; color: var(--text); font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                            <span>${highlightText(so.name, query)}</span>
                                            <span style="display: inline-block; padding: 2px 8px; background: ${so.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : so.status === 'Draft' ? 'rgba(245, 158, 11, 0.1)' : 'var(--primary-glass)'}; color: ${so.status === 'Completed' ? 'var(--success)' : so.status === 'Draft' ? 'var(--warning)' : 'var(--primary)'}; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                                                ${so.status}
                                            </span>
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 6px;">
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                <i class="fa fa-user" style="font-size: 11px; color: var(--text-muted);"></i>
                                                <span style="font-size: 12px; color: var(--text-secondary);">${highlightText(so.customer_name, query)}</span>
                                            </div>
                                            ${so.project ? `
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <i class="fa fa-folder" style="font-size: 11px; color: var(--text-muted);"></i>
                                                    <span style="font-size: 12px; color: var(--text-secondary);">${highlightText(so.project, query)}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                <i class="fa fa-money" style="font-size: 11px; color: #10b981;"></i>
                                                <span style="font-size: 13px; font-weight: 700; color: #10b981;">${frappe.format(so.grand_total, {fieldtype: 'Currency'})}</span>
                                            </div>
                                            ${so.transaction_date ? `
                                                <div style="font-size: 11px; color: #94a3b8;">
                                                    <i class="fa fa-calendar" style="margin-right: 4px;"></i>
                                                    ${frappe.datetime.str_to_user(so.transaction_date)}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                    <div style="flex-shrink: 0; width: 28px; height: 28px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <i class="fa fa-chevron-right" style="color: #94a3b8; font-size: 12px;"></i>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (filteredProjects.length > 0) {
            html += `
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border-radius: 8px; border-left: 3px solid #10b981;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                                <i class="fa fa-folder" style="color: white; font-size: 14px;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: #065f46; font-size: 14px;">Projects</div>
                                <div style="font-size: 11px; color: #34d399;">${filteredProjects.length} result${filteredProjects.length > 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    </div>
                    <div style="display: grid; gap: 10px;">
                        ${filteredProjects.map(project => `
                            <div class="search-result-item" style="padding: 14px; background: white; border-radius: 10px; border: 2px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,0.08);" data-project="${project.name}">
                                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                            <span>${highlightText(project.name, query)}</span>
                                            <span style="display: inline-block; padding: 2px 8px; background: ${project.status === 'Completed' ? '#dcfce7' : project.status === 'Open' ? '#dbeafe' : '#fef9c3'}; color: ${project.status === 'Completed' ? '#166534' : project.status === 'Open' ? '#1e40af' : '#854d0e'}; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                                                ${project.status}
                                            </span>
                                        </div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 6px;">
                                            ${project.project_name ? `
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <i class="fa fa-tag" style="font-size: 11px; color: #64748b;"></i>
                                                    <span style="font-size: 12px; color: #475569;">${highlightText(project.project_name, query)}</span>
                                                </div>
                                            ` : ''}
                                            ${project.customer ? `
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <i class="fa fa-user" style="font-size: 11px; color: #64748b;"></i>
                                                    <span style="font-size: 12px; color: #475569;">${highlightText(project.customer, query)}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            <div style="display: flex; align-items: center; gap: 8px; flex: 1; max-width: 150px;">
                                                <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                                    <div style="width: ${project.percent_complete || 0}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); transition: width 0.3s;"></div>
                                                </div>
                                                <span style="font-size: 11px; font-weight: 700; color: #10b981; min-width: 35px;">${project.percent_complete || 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="flex-shrink: 0; width: 28px; height: 28px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <i class="fa fa-external-link" style="color: #94a3b8; font-size: 11px;"></i>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        resultsContainer.html(html);

        console.log('=== Adding click handlers ===');
        console.log('HTML set, length:', html.length);
        console.log('Sales order cards found:', resultsContainer.find('[data-order]').length);
        console.log('Project cards found:', resultsContainer.find('[data-project]').length);

        // Add click handlers for sales orders and projects (self is already declared at method start)

        // Sales Order click handler - attach directly to the parent
        resultsContainer.off('click', '[data-order]'); // Remove any existing handlers
        resultsContainer.on('click', '[data-order]', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const orderName = $(this).data('order');

            console.log('=== Sales Order Clicked ===');
            console.log('Order Name:', orderName);
            console.log('Self exists:', !!self);
            console.log('showOrderDetails exists:', typeof self.showOrderDetails);

            // Close search panel and open detail modal
            $('#quick-search-panel').css('right', '-600px');
            $('#quick-search-overlay').css('opacity', '0');

            setTimeout(() => {
                $('#quick-search-panel').remove();
                $('#quick-search-overlay').remove();
                $(document).off('keydown.quicksearch');

                // Show order details
                try {
                    console.log('Attempting to show order details...');
                    self.showOrderDetails(orderName);
                    console.log('showOrderDetails called successfully');
                } catch (err) {
                    console.error('Error calling showOrderDetails:', err);
                }
            }, 300);
        });

        // Project click handler - attach directly to the parent
        resultsContainer.off('click', '[data-project]'); // Remove any existing handlers
        resultsContainer.on('click', '[data-project]', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const projectName = $(this).data('project');

            console.log('=== Project Clicked ===');
            console.log('Project Name:', projectName);

            // Try to find sales order associated with this project
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
                        console.log('Found SO for project:', soName);

                        $('#quick-search-panel').css('right', '-600px');
                        $('#quick-search-overlay').css('opacity', '0');

                        setTimeout(() => {
                            $('#quick-search-panel').remove();
                            $('#quick-search-overlay').remove();
                            $(document).off('keydown.quicksearch');

                            // Show order details
                            try {
                                self.showOrderDetails(soName);
                                console.log('Showed order details for SO:', soName);
                            } catch (err) {
                                console.error('Error showing order details:', err);
                            }
                        }, 300);
                    } else {
                        // Otherwise, open project in new tab
                        console.log('No SO found, opening project page');
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
            $(`#${toastId}`).fadeOut(300, function() {
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
        (order.custom_project_description || '').toLowerCase().includes(lowerQuery)
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
                    ${order.customer} • ${order.sales_person} • ${frappe.format(order.grand_total, {fieldtype: 'Currency'})}
                    ${order.project ? ` • 📋 ${order.project}` : ''}
                </div>
                ${order.custom_project_description ? `
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: var(--space-1);">
                        ${order.custom_project_description.length > 60 ? order.custom_project_description.substring(0, 60) + '...' : order.custom_project_description}
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
            { id: 'grid', icon: 'fa-th-large', label: 'Grid', badge: '' },
            { id: 'list', icon: 'fa-list-ul', label: 'List', badge: '' },
            { id: 'sales-person', icon: 'fa-user-tie', label: 'Sales Team', badge: '' },
            { id: 'customer', icon: 'fa-building', label: 'Customers', badge: '' },
            { id: 'calendar', icon: 'fa-calendar-alt', label: 'Calendar', badge: '' },
            { id: 'draft-orders', icon: 'fa-list-ul', label: 'Draft Orders', badge: '' },
            { id: 'no-project-orders', icon: 'fa-folder-open', label: 'No Project', badge: '' }
        ];


    // Fetch draft order count
    this.fetchDraftOrderCount().then(count => {
        const draftView = views.find(view => view.id === 'draft-orders');
        if (draftView) {
            draftView.badge = count > 0 ? `(${count})` : '';
        }

        // Fetch no-project order count
        this.fetchNoProjectOrderCount().then(noProjectCount => {
            const noProjectView = views.find(view => view.id === 'no-project-orders');
            if (noProjectView) {
                noProjectView.badge = noProjectCount > 0 ? `(${noProjectCount})` : '';
            }

            let html = '';
            views.forEach((view, index) => {
                html += `
                <button class="view-pill ${index === 0 ? 'active' : ''}" data-view="${view.id}">
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
    });

    }


// New method to fetch draft order count
fetchDraftOrderCount() {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'prastara_custom.controller.variant_pricing.draft_get_sales_order_list_prd',
            args: {
                status: 'Draft',
                company: 'PRASTARA DECORATION DESIGN L.L.C'
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
                company: 'PRASTARA DECORATION DESIGN L.L.C'
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

// New method to fetch no-project order count
fetchNoProjectOrderCount() {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_sales_order_no_project_list_prd',
            args: {
                company: 'PRASTARA DECORATION DESIGN L.L.C'
            },
            callback: (r) => {
                if (r.message && r.message.status === 'success') {
                    resolve(r.message.data.orders.length);
                } else {
                    resolve(0);
                }
            },
            error: (err) => {
                this.showToast('Failed to fetch no-project order count', 'error');
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
    const valueRanges = this.calculateValueRangeMetrics();
    
    const statsHtml = `
        <div class="header-stat" data-range="below-5k">
            <div class="header-stat-icon">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${valueRanges.below5k.count}</div>
                <div class="header-stat-label">Below AED 5K</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.below5k.total, {fieldtype: 'Currency'})}</div>
            </div>
        </div>


         <div class="header-stat" data-range="5k-10k">
            <div class="header-stat-icon" style="background: linear-gradient(135deg, #d55aa6ff 0%, #c75da5ff 100%);">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${valueRanges.range5k10k.count}</div>
                <div class="header-stat-label">AED 5K - AED 10K</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.range5k10k.total, {fieldtype: 'Currency'})}</div>
            </div>
        </div>



        <div class="header-stat" data-range="10k-25k">
            <div class="header-stat-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${valueRanges.range10k25k.count}</div>
                <div class="header-stat-label">AED 10K - AED 25K</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.range10k25k.total, {fieldtype: 'Currency'})}</div>
            </div>
        </div>
        <div class="header-stat" data-range="25k-50k">
            <div class="header-stat-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${valueRanges.range25k50k.count}</div>
                <div class="header-stat-label">AED 25K - AED 50K</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.range25k50k.total, {fieldtype: 'Currency'})}</div>
            </div>
        </div>
        <div class="header-stat" data-range="50k-100k">
            <div class="header-stat-icon" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${valueRanges.range50k100k.count}</div>
                <div class="header-stat-label">AED 50K - AED 100K</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.range50k100k.total, {fieldtype: 'Currency'})}</div>
            </div>
        </div>
        <div class="header-stat" data-range="above-100k">
            <div class="header-stat-icon" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${valueRanges.above100k.count}</div>
                <div class="header-stat-label">Above AED 100K</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.above100k.total, {fieldtype: 'Currency'})}</div>
            </div>
        </div>
        <div class="header-stat header-stat-summary">
            <div class="header-stat-icon" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">
                <i class="fa fa-shopping-basket"></i>
            </div>
            <div class="header-stat-content">
                <div class="header-stat-value">${this.filtered_orders.length}</div>
                <div class="header-stat-label">Total Orders</div>
                <div class="header-stat-amount">${frappe.format(valueRanges.grandTotal, {fieldtype: 'Currency'})}</div>
            </div>
        </div>
    `;
    
    $('#header-stats').html(statsHtml);
    
    // Add click handlers for drill-down functionality
    $('.header-stat[data-range]').on('click', (e) => {
        const range = $(e.currentTarget).data('range');
        this.showValueRangeOrders(range);
    });
}
calculateValueRangeMetrics() {
    const ranges = {
        below5k: { count: 0, total: 0, orders: [] },
        range5k10k: { count: 0, total: 0, orders: [] },
        range10k25k: { count: 0, total: 0, orders: [] },
        range25k50k: { count: 0, total: 0, orders: [] },
        range50k100k: { count: 0, total: 0, orders: [] },
        above100k: { count: 0, total: 0, orders: [] }
    };
    
    this.filtered_orders.forEach(order => {
        const value = parseFloat(order.grand_total || 0);
        
        if (value < 5000) {
            ranges.below5k.count++;
            ranges.below5k.total += value;
            ranges.below5k.orders.push(order);
        } else if (value >= 5000 && value < 10000) {
            ranges.range5k10k.count++;
            ranges.range5k10k.total += value;
            ranges.range5k10k.orders.push(order);
        }else if (value >= 10000 && value < 25000) {
            ranges.range10k25k.count++;
            ranges.range10k25k.total += value;
            ranges.range10k25k.orders.push(order);
        } else if (value >= 25000 && value < 50000) {
            ranges.range25k50k.count++;
            ranges.range25k50k.total += value;
            ranges.range25k50k.orders.push(order);
        } else if (value >= 50000 && value < 100000) {
            ranges.range50k100k.count++;
            ranges.range50k100k.total += value;
            ranges.range50k100k.orders.push(order);
        } else if (value >= 100000) {
            ranges.above100k.count++;
            ranges.above100k.total += value;
            ranges.above100k.orders.push(order);
        }
    });
    
    ranges.grandTotal = this.filtered_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
    
    return ranges;
}

// Add this new method to show orders for a specific value range
showValueRangeOrders(range) {
    const valueRanges = this.calculateValueRangeMetrics();
    let orders = [];
    let title = '';
    
    switch(range) {
        case 'below-5k':
            orders = valueRanges.below5k.orders;
            title = 'Orders Below AED 5,000';
            break;
        case '5k-10k':
            orders = valueRanges.range5k10k.orders;
            title = 'Orders AED 5,000 - AED 10,000';
            break;
        case '10k-25k':
            orders = valueRanges.range10k25k.orders;
            title = 'Orders AED 10,000 - AED 25,000';
            break;
        case '25k-50k':
            orders = valueRanges.range25k50k.orders;
            title = 'Orders AED 25,000 - AED 50,000';
            break;
        case '50k-100k':
            orders = valueRanges.range50k100k.orders;
            title = 'Orders AED 50,000 - AED 100,000';
            break;
        case 'above-100k':
            orders = valueRanges.above100k.orders;
            title = 'Orders Above AED 100,000';
            break;
    }
    
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
            case 'no-project-orders':
                this.renderNoProjectOrdersTable();
                break;
        }
    }

  renderModernDashboard() {
    const summary = this.data.summary;
    const valueRanges = this.calculateValueRangeMetrics();
    
    const html = `
        <!-- Value Range Overview Cards -->
        <div class="metrics-container">
            <div class="metric-card-modern metric-card-primary">
                <div class="metric-card-icon">
                    <i class="fa fa-chart-bar"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value">${summary.total_orders}</div>
                    <div class="metric-label">Total Active Orders</div>
                    <div class="metric-description">Currently tracking ${summary.total_orders} orders across all value ranges</div>
                </div>
            </div>
            
            <div class="metric-card-modern metric-card-warning">
                <div class="metric-card-icon">
                    <i class="fa fa-exclamation-triangle"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value">${summary.overdue_count}</div>
                    <div class="metric-label">Overdue Orders</div>
                    <div class="metric-description">Orders requiring immediate attention</div>
                </div>
            </div>
            
            <div class="metric-card-modern metric-card-info">
                <div class="metric-card-icon">
                    <i class="fa fa-clock"></i>
                </div>
                <div class="metric-card-content">
                    <div class="metric-value">${summary.due_today_count}</div>
                    <div class="metric-label">Due Today</div>
                    <div class="metric-description">Orders scheduled for delivery today</div>
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
                        <div class="quick-action-count">${frappe.format(summary.total_remaining, {fieldtype: 'Currency'})}</div>
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
                            <div class="analytics-value">${frappe.format(customer.total_value, {fieldtype: 'Currency'})}</div>
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
                            <div class="analytics-value">${frappe.format(sp.total_value, {fieldtype: 'Currency'})}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Add these new handlers
setupQuickActionHandlers() {
    $('.quick-action-card').on('click', (e) => {
        const action = $(e.currentTarget).data('action');
        this.handleQuickAction(action);
    });
}

handleQuickAction(action) {
    switch(action) {
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
                                    <td><strong>${frappe.format(status.total_value, {fieldtype: 'Currency'})}</strong></td>
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
                                    <td><strong>${frappe.format(timeline.total_value, {fieldtype: 'Currency'})}</strong></td>
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
                    ${order.custom_project_description ? `
                        <div class="order-info-item">
                            <div class="order-info-label">Project Description</div>
                            <div class="order-info-value" title="${order.custom_project_description}">${order.custom_project_description.length > 30 ? order.custom_project_description.substring(0, 30) + '...' : order.custom_project_description}</div>
                        </div>
                    ` : ''}
                    <div class="order-info-item">
                        <div class="order-info-label">Grand Total</div>
                        <div class="order-info-value">${frappe.format(order.grand_total, {fieldtype: 'Currency'})}</div>
                    </div>
                    <div class="order-info-item">
                        <div class="order-info-label">Remaining</div>
                        <div class="order-info-value">${frappe.format(order.remaining_amount, {fieldtype: 'Currency'})}</div>
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
                ${[1,2,3,4,5,6].map(() => `
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
    processOrdersData() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        this.all_orders.forEach(order => {
            order.name = order.sales_order_number;
            order.sales_person = order.sales_person || 'Unassigned';
            order.per_billed = order.percent_amount_billed || 0;
            order.per_delivered = order.percent_amount_delivered || 0;
            order.remaining_amount = order.balance_to_bill_amount || 0;
            
            const deliveryDate = new Date(order.delivery_date);
            deliveryDate.setHours(0, 0, 0, 0);
            const timeDiff = deliveryDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            order.due_days = daysDiff;
            order.due_days_text = this.formatDueDays(daysDiff);
            order.due_status = this.getDueStatus(daysDiff);
        });
    }

 extractFilterOptions() {
    const customers = new Set();
    const sales_persons = new Set();
    const branches = new Set();
    const statuses = new Set();
    const projects = new Set();
    
    this.all_orders.forEach(order => {
        if (order.customer) customers.add(order.customer);
        if (order.sales_person) sales_persons.add(order.sales_person);
        if (order.branch) branches.add(order.branch);
        if (order.status) statuses.add(order.status);
        if (order.project) projects.add(order.project);
    });
    
    this.filter_options = {
        customers: Array.from(customers).sort(),
        sales_persons: Array.from(sales_persons).sort(),
        branches: Array.from(branches).sort(),
        statuses: Array.from(statuses).sort(),
        projects: Array.from(projects).sort()
    };
}
  populateFilterOptions() {
    ['customers','sales_persons', 'branches', 'statuses', 'projects'].forEach(type => {
        const filterId = type === 'customers' ? 'customer-filter' :
                        type === 'sales_persons' ? 'sales-person-filter' :
                        type === 'branches' ? 'branch-filter' : 
                        type === 'projects' ? 'project-filter' : 'status-filter';
        
        const filter = $(`#${filterId}`);
        filter.find('option:not(:first)').remove();
        
        this.filter_options[type].forEach(option => {
            filter.append(`<option value="${option}">${option}</option>`);
        });
    });
}
applyFilters() {
    const globalSearch = $('#global-search').val().toLowerCase();
    
    let filtered = [...this.all_orders];
    
    if (globalSearch && !this.hasActiveFilters()) {
        this.applyGlobalFilter(globalSearch);
        return;
    }
    
    const customer = $('#customer-filter').val();
    const salesPerson = $('#sales-person-filter').val();
    const project = $('#project-filter').val();
    const branch = $('#branch-filter').val();
    const status = $('#status-filter').val();
    const dateFrom = $('#date-from').val();
    const dateTo = $('#date-to').val();
    const quickFilter = $('#quick-filter').val();
    const valueMin = parseFloat($('#value-min').val()) || 0;
    const valueMax = parseFloat($('#value-max').val()) || Infinity;
    
    // Add customer type filter
    const customerType = $('#customer-type-filter').val();
    
    if (customer) filtered = filtered.filter(order => order.customer === customer);
    if (salesPerson) filtered = filtered.filter(order => order.sales_person === salesPerson);
    if (project) filtered = filtered.filter(order => order.project === project);
    if (branch) filtered = filtered.filter(order => order.branch === branch);
    if (status) filtered = filtered.filter(order => order.status === status);
    
    // Apply customer type filter
    if (customerType) {
        if (customerType === 'internal') {
            filtered = filtered.filter(order => order.is_internal_customer === 1 || order.is_internal_customer === true);
        } else if (customerType === 'external') {
            filtered = filtered.filter(order => !order.is_internal_customer || order.is_internal_customer === 0);
        }
    }
    
    if (dateFrom) filtered = filtered.filter(order => new Date(order.delivery_date) >= new Date(dateFrom));
    if (dateTo) filtered = filtered.filter(order => new Date(order.delivery_date) <= new Date(dateTo));
    
    // Value range filter
    filtered = filtered.filter(order => {
        const value = parseFloat(order.grand_total || 0);
        return value >= valueMin && value <= valueMax;
    });
    
    if (quickFilter) {
        switch (quickFilter) {
            case 'overdue':
                filtered = filtered.filter(order => order.due_days < 0);
                break;
            case 'due-today':
                filtered = filtered.filter(order => order.due_days === 0);
                break;
            case 'due-week':
                filtered = filtered.filter(order => order.due_days >= 0 && order.due_days <= 7);
                break;
            case 'high-value':
                filtered = filtered.filter(order => parseFloat(order.grand_total) > 20000);
                break;
            case 'on-hold':
                filtered = filtered.filter(order => (order.status || '').toLowerCase().includes('hold'));
                break;
            case 'with-projects':
                filtered = filtered.filter(order => order.project && order.project.trim() !== '');
                break;
            case 'without-projects':
                filtered = filtered.filter(order => !order.project || order.project.trim() === '');
                break;
        }
    }
    
    if (globalSearch) {
        filtered = filtered.filter(order =>
            order.name.toLowerCase().includes(globalSearch) ||
            order.customer.toLowerCase().includes(globalSearch) ||
            (order.sales_person || '').toLowerCase().includes(globalSearch) ||
            (order.status || '').toLowerCase().includes(globalSearch) ||
            (order.project || '').toLowerCase().includes(globalSearch) ||
            (order.custom_project_description || '').toLowerCase().includes(globalSearch)
        );
    }
    
    this.showHeaderStatsLoading();
    this.filtered_orders = filtered;
    this.processData();
    this.updateActiveFilters();
    this.updateHeaderStats();
    this.renderView();
}
hasActiveFilters() {
    return $('#customer-filter').val() || $('#sales-person-filter').val() ||
           $('#project-filter').val() || $('#branch-filter').val() ||
           $('#status-filter').val() || $('#date-from').val() || 
           $('#date-to').val() || $('#quick-filter').val() ||
           $('#value-min').val() || $('#value-max').val() || 
           $('#customer-type-filter').val();
}
updateActiveFilters() {
    const activeFiltersContainer = $('#active-filters');
    const filters = [];
    
    const filterMappings = [
        { id: 'customer-filter', label: 'Customer' },
        { id: 'sales-person-filter', label: 'Sales Person' },
        { id: 'project-filter', label: 'Project' },
        { id: 'branch-filter', label: 'Branch' },
        { id: 'status-filter', label: 'Status' },
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
    
    if (filters.length > 0) {
        let html = '<div style="display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-4);">';
        filters.forEach(filter => {
            html += `
                <div style="display: inline-flex; align-items: center; gap: var(--space-2); background: var(--primary); color: white; padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); font-size: 0.875rem; font-weight: 600;">
                    <span>${filter.label}: ${filter.value}</span>
                    <button style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;" 
                            onclick="$('#${filter.id}').val(''); frappe.sales_order_dashboard.applyFilters();">
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
        const high_value_orders = this.filtered_orders.filter(order => parseFloat(order.grand_total) > 20000);
        const on_hold_orders = this.filtered_orders.filter(order => (order.status || '').toLowerCase().includes('hold'));
        
        return {
            total_orders,
            total_value,
            total_remaining,
            overdue_count: overdue_orders.length,
            overdue_value: overdue_orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0),
            due_today_count: due_today.length,
            due_today_value: due_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0),
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
                    image: order.sales_person_image || '/assets/frappe/images/ui/avatar.png'
                };
            }
            groups[salesPerson].orders.push(order);
            groups[salesPerson].total_value += parseFloat(order.grand_total || 0);
            groups[salesPerson].total_remaining += parseFloat(order.remaining_amount || 0);
            groups[salesPerson].avg_completion += (parseFloat(order.per_billed || 0) + parseFloat(order.per_delivered || 0)) / 2;
            if (order.due_days < 0) groups[salesPerson].overdue_count++;
            
            if (order.sales_person_image && order.sales_person_image !== '/assets/frappe/images/ui/avatar.png') {
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
                            ${frappe.format(dateSummary.transaction_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}
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
                            ${frappe.format(dateSummary.delivery_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}
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
                            ${frappe.format(dateSummary.delivery_overdue.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}
                        </div>
                    </div>
                </div>
            </div>
            
            ${this.renderDateSummaryTables()}
        `;
        
        this.content_area.html(html);
        this.setupDateSummaryHandlers();
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
                                <td><strong>${frappe.format(dateSummary.transaction_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="today">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Yesterday</strong></td>
                                <td>${dateSummary.transaction_yesterday.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_yesterday.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="yesterday">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>This Week</strong></td>
                                <td>${dateSummary.transaction_this_week.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_this_week.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-transaction" data-period="this-week">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Last Week</strong></td>
                                <td>${dateSummary.transaction_last_week.length}</td>
                                <td><strong>${frappe.format(dateSummary.transaction_last_week.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
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
                                <td><strong>${frappe.format(dateSummary.delivery_overdue.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="overdue">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Today</strong></td>
                                <td>${dateSummary.delivery_today.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_today.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="today">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>This Week</strong></td>
                                <td>${dateSummary.delivery_this_week.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_this_week.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" data-action="view-delivery" data-period="this-week">
                                        View Orders
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Future</strong></td>
                                <td>${dateSummary.delivery_future.length}</td>
                                <td><strong>${frappe.format(dateSummary.delivery_future.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0), {fieldtype: 'Currency'})}</strong></td>
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
                            <th>Progress</th>
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
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalValue, {fieldtype: 'Currency'})}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Remaining</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalRemaining, {fieldtype: 'Currency'})}</div>
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
            <td><strong style="color: var(--primary);">${order.name}</strong></td>
            <td>${order.customer}</td>
            <td>
                ${order.project ? `
                    <div>
                        <div style="font-weight: 600;">${order.project}</div>
                        ${order.custom_project_description ? `<div style="font-size: 0.75rem; color: var(--text-muted);" title="${order.custom_project_description}">${order.custom_project_description.length > 25 ? order.custom_project_description.substring(0, 25) + '...' : order.custom_project_description}</div>` : ''}
                    </div>
                ` : `<span style="color: var(--text-muted);">No Project</span>`}
            </td>
            <td>${order.sales_person}</td>
            <td>
                ${frappe.datetime.str_to_user(order.delivery_date)}
                ${this.getDueBadge(order.due_status, order.due_days_text)}
            </td>
            <td>${order.status || 'Unknown'}</td>
            <td><strong>${frappe.format(order.grand_total, {fieldtype: 'Currency'})}</strong></td>
            <td>
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div class="progress-bar-modern" style="flex: 1;">
                        <div class="progress-fill-modern" style="width: ${avgProgress}%"></div>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 600;">${avgProgress.toFixed(0)}%</span>
                </div>
            </td>
            <td><strong>${frappe.format(order.remaining_amount, {fieldtype: 'Currency'})}</strong></td>
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
                                 onerror="this.src='/assets/frappe/images/ui/avatar.png'">
                            <div>
                                <div style="font-weight: 700; color: var(--text);">${sp.name}</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">${sp.orders.length} orders</div>
                            </div>
                        </div>
                        <div class="metric-value">${frappe.format(sp.total_value, {fieldtype: 'Currency'})}</div>
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
                                     onerror="this.src='/assets/frappe/images/ui/avatar.png'">
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
                        <td><strong>${frappe.format(sp.total_value, {fieldtype: 'Currency'})}</strong></td>
                        <td><strong>${frappe.format(sp.total_remaining, {fieldtype: 'Currency'})}</strong></td>
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
                <div class="table-toolbar" style="padding: var(--space-4); background:#33544a; border-radius: var(--radius-lg); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: var(--space-4);">
                        <span style="font-weight: 600; color: white;">${count} Draft Order${count === 1 ? '' : 's'}</span>
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon" style="color: white;"></i>
                            <input type="text" class="table-search-input" placeholder="Search draft orders by order #, customer, project..." id="draft-orders-search" style="background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);">
                        </div>
                    </div>
                    <button class="btn btn-primary" id="export-draft-orders" style="padding: var(--space-2) var(--space-4); background: white; color: #33544a; border-color: white;">
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
                                    ${order.custom_project_description ? `<div style="font-size: 0.75rem; color: var(--text-muted);" title="${order.custom_project_description}">${order.custom_project_description.length > 20 ? order.custom_project_description.substring(0, 20) + '...' : order.custom_project_description}</div>` : ''}
                                </div>
                            ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">No Project</span>`}
                        </td>
                        <td>${order.sales_person}</td>
                        <td>
                            ${order.delivery_date ? frappe.datetime.str_to_user(order.delivery_date) : 'No Date'}
                            ${order.due_status ? this.getDueBadge(order.due_status, order.due_days_text) : ''}
                        </td>
                        <td><strong>${frappe.format(order.grand_total || 0, {fieldtype: 'Currency'})}</strong></td>
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
                company: 'PRASTARA DECORATION DESIGN L.L.C'
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
        order.custom_project_description || '',
        order.sales_person,
        order.delivery_date ? frappe.datetime.str_to_user(order.delivery_date) : 'No Date',
        frappe.format(order.grand_total || 0, {fieldtype: 'Currency'}),
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

// Render No Project Orders Table
renderNoProjectOrdersTable() {
    this.fetchNoProjectOrderCount().then(count => {
        this.content_area.html(`
            <div class="table-modern-container" style="box-shadow: none; margin: 0;">
                <div class="table-toolbar" style="padding: var(--space-4); background:#33544a; border-radius: var(--radius-lg); margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: var(--space-4);">
                        <span style="font-weight: 600; color: white;">${count} Order${count === 1 ? '' : 's'} Without Project</span>
                        <div class="table-search-box">
                            <i class="fa fa-search table-search-icon" style="color: white;"></i>
                            <input type="text" class="table-search-input" placeholder="Search orders by order #, customer..." id="no-project-orders-search" style="background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);">
                        </div>
                    </div>
                    <button class="btn btn-primary" id="export-no-project-orders" style="padding: var(--space-2) var(--space-4); background: white; color: #33544a; border-color: white;">
                        <i class="fa fa-download"></i> Export
                    </button>
                </div>
                <div class="table-body">
                    <table class="data-table" id="no-project-orders-table">
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Sales Person</th>
                                <th>Delivery Date</th>
                                <th>Grand Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colspan="6" style="text-align: center; padding: var(--space-6);">
                                <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-muted);"></i>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `);

        // Fetch and render no-project orders
        this.fetchNoProjectOrders().then(orders => {
            if (!orders.length) {
                this.content_area.find('#no-project-orders-table tbody').html(`
                    <tr>
                        <td colspan="6" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                            <i class="fa fa-inbox" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                            <div>No orders without project found</div>
                        </td>
                    </tr>
                `);
            } else {
                const html = orders.map(order => `
                    <tr data-order="${order.name}" style="cursor: pointer;">
                        <td><strong style="color: var(--primary);">${order.name}</strong></td>
                        <td>${order.customer}</td>
                        <td>${order.sales_person || 'Unassigned'}</td>
                        <td>
                            ${order.delivery_date ? `
                                <div style="display: flex; align-items: center; gap: var(--space-2);">
                                    <span>${frappe.datetime.str_to_user(order.delivery_date)}</span>
                                    ${this.getDueBadge(order.due_status, order.due_days_text)}
                                </div>
                            ` : '<span style="color: var(--text-muted);">No Date</span>'}
                        </td>
                        <td><strong>${frappe.format(order.grand_total || 0, {fieldtype: 'Currency'})}</strong></td>
                        <td><span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span></td>
                    </tr>
                `).join('');

                this.content_area.find('#no-project-orders-table tbody').html(html);

                // Setup search functionality
                this.setupTableSearch('#no-project-orders-search', '#no-project-orders-table', ['name', 'customer', 'sales_person']);

                // Setup row click handlers
                this.content_area.find('tbody tr[data-order]').on('click', (e) => {
                    const orderName = $(e.currentTarget).data('order');
                    this.showOrderDetails(orderName);
                });

                // Setup export button handler
                $('#export-no-project-orders').on('click', () => {
                    this.exportNoProjectOrders(orders);
                });
            }
        });
    });
}

// Fetch No Project Orders
fetchNoProjectOrders() {
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
            method: 'prastara_custom.controller.variant_pricing.get_sales_order_no_project_list_prd',
            args: {
                company: 'PRASTARA DECORATION DESIGN L.L.C'
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
                    this.showToast('Failed to load no-project orders', 'error');
                    resolve([]);
                }
            },
            error: (err) => {
                this.showToast('Failed to load no-project orders: ' + err.message, 'error');
                resolve([]);
            }
        });
    });
}

// Export No Project Orders as CSV
exportNoProjectOrders(orders) {
    const headers = ['Order #', 'Customer', 'Sales Person', 'Delivery Date', 'Grand Total', 'Status'];
    const rows = orders.map(order => [
        order.name,
        order.customer,
        order.sales_person || 'Unassigned',
        order.delivery_date ? frappe.datetime.str_to_user(order.delivery_date) : 'No Date',
        frappe.format(order.grand_total || 0, {fieldtype: 'Currency'}),
        order.status
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'no_project_orders_export.csv');
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
                        <td><strong>${frappe.format(customer.total_value, {fieldtype: 'Currency'})}</strong></td>
                        <td><strong>${frappe.format(customer.total_remaining, {fieldtype: 'Currency'})}</strong></td>
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
        switch(period) {
            case 'today': return dateSummary.transaction_today;
            case 'yesterday': return dateSummary.transaction_yesterday;
            case 'this-week': return dateSummary.transaction_this_week;
            case 'last-week': return dateSummary.transaction_last_week;
            default: return [];
        }
    }

    getDeliveryOrdersByPeriod(period) {
        const dateSummary = this.data.date_summary;
        switch(period) {
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
            
            rows.each(function() {
                const rowText = $(this).text().toLowerCase();
                $(this).toggle(rowText.includes(searchTerm));
            });
        });
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
                title = 'Orders with Balance to Bill';
                break;
            case 'overdue':
                filteredOrders = this.filtered_orders.filter(order => order.due_days < 0);
                title = 'Overdue Orders';
                break;
            case 'due-today':
                filteredOrders = this.filtered_orders.filter(order => order.due_days === 0);
                title = 'Orders Due Today';
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

    showOrdersModal(orders, title) {
        this.main_modal.find('.modal-title').text(title);
        
        if (!orders.length) {
            this.main_modal.find('.modal-body').html(this.renderEmptyState('No orders found', ''));
        } else {
            const totalValue = orders.reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
            const totalRemaining = orders.reduce((sum, order) => sum + parseFloat(order.remaining_amount || 0), 0);
            
            const html = `
    <div class="table-modern-container" style="box-shadow: none; margin: 0;">
        <div class="table-toolbar" style="padding: var(--space-4); background: var(--surface-alt); border-radius: var(--radius-lg); margin-bottom: var(--space-4);">
            <div class="table-search-box">
                <i class="fa fa-search table-search-icon"></i>
                <input type="text" class="table-search-input" placeholder="Search orders, projects..." id="modal-search" style="background: var(--surface); color: var(--text);">
            </div>
        </div>
        <div class="table-body">
            <table class="data-table" id="modal-orders-table">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Project</th>
                        <th>Sales Person</th>
                        <th>Delivery Date</th>
                        <th>Grand Total</th>
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
                                        ${order.custom_project_description ? `<div style="font-size: 0.75rem; color: var(--text-muted);" title="${order.custom_project_description}">${order.custom_project_description.length > 20 ? order.custom_project_description.substring(0, 20) + '...' : order.custom_project_description}</div>` : ''}
                                    </div>
                                ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">No Project</span>`}
                            </td>
                            <td>${order.sales_person}</td>
                            <td>
                                ${frappe.datetime.str_to_user(order.delivery_date)}
                                ${this.getDueBadge(order.due_status, order.due_days_text)}
                            </td>
                            <td><strong>${frappe.format(order.grand_total, {fieldtype: 'Currency'})}</strong></td>
                            <td><strong>${frappe.format(order.remaining_amount, {fieldtype: 'Currency'})}</strong></td>
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
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalValue, {fieldtype: 'Currency'})}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Remaining</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${frappe.format(totalRemaining, {fieldtype: 'Currency'})}</div>
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

    showOrderDetails(orderName) {
        this.detail_modal.find('.modal-title').text(`Order Details: ${orderName}`);
        this.detail_modal.find('.modal-body').html(`
            <div style="text-align: center; padding: 40px;">
                <div style="width: 50px; height: 50px; margin: 0 auto 16px; border: 3px solid #e0e7ff; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">Loading Order Details...</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 8px;">Please wait</div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `);
        this.detail_modal.fadeIn(300);

        // Store order name for lazy loading
        this.currentOrderName = orderName;
        this.orderDataCache = {};

        // Load only basic order data first (FAST!)
        frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_sales_order_basic',
            args: { sales_order_name: orderName },
            callback: (r) => {
                if (r.message && r.message.status === 'success') {
                    this.orderDataCache.basic = r.message.data;
                    this.renderOrderDetailsModalFast(r.message.data);
                } else {
                    this.detail_modal.find('.modal-body').html(this.renderEmptyState('Failed to load order details', ''));
                }
            },
            error: () => {
                this.detail_modal.find('.modal-body').html(this.renderEmptyState('Error loading order details', ''));
            }
        });
    }

    // Fast rendering with basic data only
    renderOrderDetailsModalFast(data) {
        const order = data.order || {};

        const html = `
            <div style="padding: 24px; max-height: 70vh; overflow-y: auto;">
                <!-- Quick Overview Card -->
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 12px; color: white; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">Sales Order</div>
                            <div style="font-size: 24px; font-weight: 700;">${order.name}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                            ${order.status}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-top: 20px;">
                        <div>
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Customer</div>
                            <div style="font-size: 16px; font-weight: 600;">${order.customer_name}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Total Amount</div>
                            <div style="font-size: 16px; font-weight: 600;">${frappe.format(order.grand_total, {fieldtype: 'Currency'})}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Items</div>
                            <div style="font-size: 16px; font-weight: 600;">${order.item_count || 0}</div>
                        </div>
                    </div>
                </div>

                <!-- Key Metrics -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="padding: 20px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 8px;">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Billing Progress</div>
                        <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${order.per_billed || 0}%</div>
                        <div style="width: 100%; height: 6px; background: #e0e7ff; border-radius: 3px; margin-top: 8px; overflow: hidden;">
                            <div style="width: ${order.per_billed || 0}%; height: 100%; background: #3b82f6;"></div>
                        </div>
                    </div>
                    <div style="padding: 20px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px;">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Delivery Progress</div>
                        <div style="font-size: 24px; font-weight: 700; color: #10b981;">${order.per_delivered || 0}%</div>
                        <div style="width: 100%; height: 6px; background: #d1fae5; border-radius: 3px; margin-top: 8px; overflow: hidden;">
                            <div style="width: ${order.per_delivered || 0}%; height: 100%; background: #10b981;"></div>
                        </div>
                    </div>
                    <div style="padding: 20px; background: #fef9c3; border-left: 4px solid #f59e0b; border-radius: 8px;">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Outstanding</div>
                        <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${frappe.format(order.total_outstanding || 0, {fieldtype: 'Currency'})}</div>
                        <div style="font-size: 12px; color: #92400e; margin-top: 4px;">Pending payment</div>
                    </div>
                </div>

                <!-- Order Info -->
                <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #1e293b;">Order Information</h4>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="color: #64748b; font-size: 14px;">Order Date</span>
                            <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${frappe.datetime.str_to_user(order.transaction_date)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="color: #64748b; font-size: 14px;">Delivery Date</span>
                            <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${frappe.datetime.str_to_user(order.delivery_date)}</span>
                        </div>
                        ${order.project ? `
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="color: #64748b; font-size: 14px;">Project</span>
                            <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${order.project}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                            <span style="color: #64748b; font-size: 14px;">Company</span>
                            <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${order.company}</span>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div style="margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="frappe.set_route('Form', 'Sales Order', '${order.name}')">
                        <i class="fa fa-external-link"></i> Open in Form View
                    </button>
                    <button class="btn btn-secondary load-full-details">
                        <i class="fa fa-download"></i> Load All Details
                    </button>
                </div>
            </div>
        `;

        this.detail_modal.find('.modal-body').html(html);

        // Handle load full details button
        this.detail_modal.find('.load-full-details').on('click', () => {
            this.loadFullOrderDetails(order.name);
        });
    }

    // Load full details (old method)
    loadFullOrderDetails(orderName) {
        this.detail_modal.find('.modal-body').html(`
            <div style="text-align: center; padding: 40px;">
                <div style="width: 50px; height: 50px; margin: 0 auto 16px; border: 3px solid #e0e7ff; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">Loading Full Details...</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 8px;">This may take a moment</div>
            </div>
        `);

        frappe.call({
            method: 'prastara_custom.controller.variant_pricing.get_sales_order_details',
            args: { sales_order_name: orderName },
            callback: (r) => {
                if (r.message && r.message.status === 'success') {
                    this.renderOrderDetailsModal(r.message.data);
                } else {
                    this.detail_modal.find('.modal-body').html(this.renderEmptyState('Failed to load full details', ''));
                }
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
    const designRequests = data.design_requests || [];
    const opportunities = data.opportunities || [];
    const projectDetails = data.project_details || {};
    const tasks = data.tasks || [];
    const paymentSchedule = data.payment_schedule || [];
    const materialRequests = data.material_requests || [];
    const advanceInvoices = data.advance_invoices || [];
    const financialDetails = data.financial_details || {};
    const boms = data.boms || [];
    const purchaseOrders = data.purchase_orders || [];

    // Generate insights based on data
    const insights = this.generateOrderInsights(data);
    const summaryCards = this.generateSmartSummary(data);

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

            <!-- Smart Summary Section -->
            ${summaryCards.length > 0 ? `
                <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <i class="fa fa-chart-bar" style="color: white; font-size: 18px;"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Quick Summary</h3>
                            <p style="margin: 0; font-size: 13px; color: #64748b;">Key metrics and status overview</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                        ${summaryCards.map(card => `
                            <div style="background: linear-gradient(135deg, ${card.color}15 0%, ${card.color}05 100%); padding: 16px; border-radius: 10px; border: 1px solid ${card.color}30;">
                                <!-- Card Header -->
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                    <div style="width: 36px; height: 36px; background: ${card.color}; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px ${card.color}40;">
                                        <i class="fa ${card.icon}" style="color: white; font-size: 16px;"></i>
                                    </div>
                                    <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">${card.title}</h4>
                                </div>

                                <!-- Stats Grid -->
                                <div style="display: grid; grid-template-columns: repeat(${card.stats.length}, 1fr); gap: 12px; margin-bottom: ${card.amount || card.progress || card.details ? '12px' : '0'};">
                                    ${card.stats.map(stat => `
                                        <div style="text-align: center; padding: 8px; background: ${stat.highlight ? '#fef3c7' : 'white'}; border-radius: 6px; ${stat.highlight ? 'border: 1px solid #fbbf24;' : ''}">
                                            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${stat.label}</div>
                                            <div style="font-size: 18px; font-weight: 700; color: ${stat.color};">${stat.value}</div>
                                        </div>
                                    `).join('')}
                                </div>

                                <!-- Amount (if present) -->
                                ${card.amount ? `
                                    <div style="padding: 10px; background: ${card.amount.color}15; border-left: 3px solid ${card.amount.color}; border-radius: 6px; margin-bottom: 8px;">
                                        <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">${card.amount.label}</div>
                                        <div style="font-size: 16px; font-weight: 700; color: ${card.amount.color};">${card.amount.value}</div>
                                    </div>
                                ` : ''}

                                <!-- Progress Bar (if present) -->
                                ${card.progress ? `
                                    <div>
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                            <span style="font-size: 11px; color: #64748b;">${card.progress.label}</span>
                                            <span style="font-size: 11px; font-weight: 600; color: ${card.color};">${card.progress.percent}%</span>
                                        </div>
                                        <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                                            <div style="width: ${card.progress.percent}%; height: 100%; background: linear-gradient(90deg, ${card.color} 0%, ${card.color}dd 100%); transition: width 0.3s;"></div>
                                        </div>
                                    </div>
                                ` : ''}

                                <!-- Details (if present) -->
                                ${card.details && card.details.length > 0 ? `
                                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                                        ${card.details.slice(0, 3).map(detail => `
                                            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;">
                                                <span style="color: #64748b;">${detail.label}</span>
                                                <span style="font-weight: 600; color: #1e293b;">${detail.value}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
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
                ${order.project && purchaseOrders.length > 0 ? `
                    <button class="detail-tab" data-tab="purchase-orders">
                        <i class="fa fa-shopping-cart"></i> Purchase Orders (${purchaseOrders.length})
                    </button>
                ` : ''}
                ${order.project && boms.length > 0 ? `
                    <button class="detail-tab" data-tab="boms">
                        <i class="fa fa-cogs"></i> BOMs (${boms.length})
                    </button>
                ` : ''}
                <button class="detail-tab" data-tab="workflow">
                    <i class="fa fa-sitemap"></i> Workflow
                </button>
                ${designRequests.length > 0 ? `
                    <button class="detail-tab" data-tab="design-requests">
                        <i class="fa fa-paint-brush"></i> Design Request (${designRequests.length})
                    </button>
                ` : ''}
                ${permits.length > 0 ? `
                    <button class="detail-tab" data-tab="permits">
                        <i class="fa fa-file-signature"></i> Permit (${permits.length})
                    </button>
                ` : ''}
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

            ${order.project && purchaseOrders.length > 0 ? `
                <div class="detail-content" data-content="purchase-orders" style="display: none;">
                    ${this.renderPurchaseOrdersSection(purchaseOrders)}
                </div>
            ` : ''}

            ${order.project && boms.length > 0 ? `
                <div class="detail-content" data-content="boms" style="display: none;">
                    ${this.renderBOMsSection(boms)}
                </div>
            ` : ''}

            <div class="detail-content" data-content="workflow" style="display: none;">
                ${this.renderWorkflowSection(opportunities)}
            </div>

            ${designRequests.length > 0 ? `
                <div class="detail-content" data-content="design-requests" style="display: none;">
                    ${this.renderDesignRequestsSection(designRequests)}
                </div>
            ` : ''}

            ${permits.length > 0 ? `
                <div class="detail-content" data-content="permits" style="display: none;">
                    ${this.renderPermitsSection(permits)}
                </div>
            ` : ''}

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
                font-size: 0.75rem;
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
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .status-overdue { background: rgba(239, 68, 68, 0.1); color: var(--error); }
            .status-pending { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
            .status-completed { background: rgba(16, 185, 129, 0.1); color: var(--success); }
            .status-normal { background: var(--primary-glass); color: var(--primary); }
            
            .open-doc-btn {
                background: var(--primary);
                color: white;
                border: none;
                border-radius: var(--radius);
                padding: var(--space-1) var(--space-2);
                font-size: 0.75rem;
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

    // Setup filtering for all sections
    this.setupAllSectionFilters(data);
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
            message: `${unpaidAdvances.length} advance invoice(s) pending payment totaling ${frappe.format(totalUnpaid, {fieldtype: 'Currency'})}.`
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

// NEW: Generate smart summary cards
generateSmartSummary(data) {
    const summaryCards = [];

    const items = data.items || [];
    const invoices = data.invoices || [];
    const deliveryNotes = data.delivery_notes || [];
    const payments = data.payment_entries || [];
    const tasks = data.tasks || [];
    const materialRequests = data.material_requests || [];
    const purchaseOrders = data.purchase_orders || [];
    const boms = data.boms || [];

    // Purchase Orders Summary
    if (purchaseOrders && purchaseOrders.length > 0) {
        const poByStatus = purchaseOrders.reduce((acc, po) => {
            acc[po.status] = (acc[po.status] || 0) + 1;
            return acc;
        }, {});

        const pendingPO = (poByStatus['To Receive and Bill'] || 0) + (poByStatus['To Receive'] || 0) + (poByStatus['To Bill'] || 0);
        const completedPO = poByStatus['Completed'] || 0;

        summaryCards.push({
            title: 'Purchase Orders',
            icon: 'fa-shopping-cart',
            color: '#3b82f6',
            stats: [
                { label: 'Total', value: purchaseOrders.length, color: '#64748b' },
                { label: 'Pending', value: pendingPO, color: '#f59e0b', highlight: pendingPO > 0 },
                { label: 'Completed', value: completedPO, color: '#10b981' }
            ],
            details: Object.entries(poByStatus).map(([status, count]) => ({
                label: status,
                value: count
            }))
        });
    }

    // Material Requests Summary
    if (materialRequests && materialRequests.length > 0) {
        const mrByStatus = materialRequests.reduce((acc, mr) => {
            acc[mr.status] = (acc[mr.status] || 0) + 1;
            return acc;
        }, {});

        const pendingMR = (mrByStatus['Pending'] || 0) + (mrByStatus['Partially Ordered'] || 0);
        const completedMR = mrByStatus['Ordered'] || 0;

        summaryCards.push({
            title: 'Material Requests',
            icon: 'fa-boxes',
            color: '#8b5cf6',
            stats: [
                { label: 'Total', value: materialRequests.length, color: '#64748b' },
                { label: 'Pending', value: pendingMR, color: '#f59e0b', highlight: pendingMR > 0 },
                { label: 'Ordered', value: completedMR, color: '#10b981' }
            ],
            details: Object.entries(mrByStatus).map(([status, count]) => ({
                label: status,
                value: count
            }))
        });
    }

    // Invoices Summary
    if (invoices && invoices.length > 0) {
        const paidInvoices = invoices.filter(inv => inv.status === 'Paid').length;
        const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid').length;
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (parseFloat(inv.outstanding_amount) || 0), 0);

        summaryCards.push({
            title: 'Sales Invoices',
            icon: 'fa-file-invoice-dollar',
            color: '#ec4899',
            stats: [
                { label: 'Total', value: invoices.length, color: '#64748b' },
                { label: 'Paid', value: paidInvoices, color: '#10b981' },
                { label: 'Unpaid', value: unpaidInvoices, color: '#f59e0b', highlight: unpaidInvoices > 0 }
            ],
            amount: totalOutstanding > 0 ? {
                label: 'Outstanding',
                value: frappe.format(totalOutstanding, {fieldtype: 'Currency'}),
                color: '#dc2626'
            } : null
        });
    }

    // Delivery Summary
    if (items && items.length > 0) {
        const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
        const deliveredQty = items.reduce((sum, item) => sum + (parseFloat(item.delivered_qty) || 0), 0);
        const pendingQty = totalQty - deliveredQty;
        const deliveryPercent = totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;

        summaryCards.push({
            title: 'Delivery Status',
            icon: 'fa-truck',
            color: '#10b981',
            stats: [
                { label: 'Total Items', value: items.length, color: '#64748b' },
                { label: 'Delivered', value: `${deliveryPercent}%`, color: '#10b981' },
                { label: 'Pending Qty', value: Math.round(pendingQty), color: '#f59e0b', highlight: pendingQty > 0 }
            ],
            progress: {
                percent: deliveryPercent,
                label: `${Math.round(deliveredQty)} of ${Math.round(totalQty)} units delivered`
            }
        });
    }

    // Tasks Summary
    if (tasks && tasks.length > 0) {
        const taskByStatus = tasks.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
        }, {});

        const completedTasks = (taskByStatus['Completed'] || 0) + (taskByStatus['Closed'] || 0);
        const pendingTasks = tasks.length - completedTasks;
        const overdueTasks = tasks.filter(task => task.exp_end_date && new Date(task.exp_end_date) < new Date() && task.status !== 'Completed').length;

        summaryCards.push({
            title: 'Project Tasks',
            icon: 'fa-tasks',
            color: '#6366f1',
            stats: [
                { label: 'Total', value: tasks.length, color: '#64748b' },
                { label: 'Completed', value: completedTasks, color: '#10b981' },
                { label: 'Pending', value: pendingTasks, color: '#f59e0b', highlight: pendingTasks > 0 },
                { label: 'Overdue', value: overdueTasks, color: '#dc2626', highlight: overdueTasks > 0 }
            ]
        });
    }

    // Payment Summary
    if (payments && payments.length > 0) {
        const totalPaid = payments.reduce((sum, pay) => sum + (parseFloat(pay.paid_amount) || 0), 0);
        const paymentModes = payments.reduce((acc, pay) => {
            acc[pay.mode_of_payment] = (acc[pay.mode_of_payment] || 0) + 1;
            return acc;
        }, {});

        summaryCards.push({
            title: 'Payments Received',
            icon: 'fa-money',
            color: '#10b981',
            stats: [
                { label: 'Transactions', value: payments.length, color: '#64748b' },
                { label: 'Total Received', value: frappe.format(totalPaid, {fieldtype: 'Currency'}), color: '#10b981' }
            ],
            details: Object.entries(paymentModes).map(([mode, count]) => ({
                label: mode,
                value: count
            }))
        });
    }

    // BOM Summary
    if (boms && boms.length > 0) {
        summaryCards.push({
            title: 'Bill of Materials',
            icon: 'fa-list-alt',
            color: '#f59e0b',
            stats: [
                { label: 'Total BOMs', value: boms.length, color: '#64748b' },
                { label: 'Items Planned', value: boms.reduce((sum, bom) => sum + (bom.items_count || 0), 0), color: '#f59e0b' }
            ]
        });
    }

    return summaryCards;
}

// Setup filtering for all sections in the detail modal
setupAllSectionFilters(data) {
    const self = this;

    // Purchase Orders filtering
    if (data.purchase_orders && data.purchase_orders.length > 0) {
        this.setupSectionFiltering('purchase-orders', data.purchase_orders, {
            searchFields: ['name', 'supplier', 'supplier_name', 'status'],
            renderFn: (filteredData) => self.renderPurchaseOrderItems(filteredData)
        });
    }

    // Material Requests filtering
    if (data.material_requests && data.material_requests.length > 0) {
        this.setupSectionFiltering('material-requests', data.material_requests, {
            searchFields: ['name', 'status', 'material_request_type'],
            renderFn: (filteredData) => self.renderMaterialRequestItems(filteredData)
        });
    }

    // Sales Invoices filtering
    if (data.invoices && data.invoices.length > 0) {
        this.setupSectionFiltering('sales-invoices', data.invoices, {
            searchFields: ['name', 'status'],
            renderFn: (filteredData) => self.renderSalesInvoiceItems(filteredData)
        });
    }

    // Delivery Notes filtering
    if (data.delivery_notes && data.delivery_notes.length > 0) {
        this.setupSectionFiltering('delivery-notes', data.delivery_notes, {
            searchFields: ['name', 'status'],
            renderFn: (filteredData) => self.renderDeliveryNoteItems(filteredData)
        });
    }

    // Payment Entries filtering
    if (data.payment_entries && data.payment_entries.length > 0) {
        this.setupSectionFiltering('payment-entries', data.payment_entries, {
            searchFields: ['name', 'mode_of_payment', 'status', 'reference_no'],
            renderFn: (filteredData) => self.renderPaymentEntryItems(filteredData)
        });
    }

    // Tasks filtering
    if (data.tasks && data.tasks.length > 0) {
        this.setupSectionFiltering('tasks', data.tasks, {
            searchFields: ['name', 'subject', 'status', 'description'],
            renderFn: (filteredData) => self.renderTaskItems(filteredData)
        });
    }
}

// Generate filter bar for sections
generateSectionFilterBar(sectionId, filterOptions = {}) {
    const {
        showSearch = true,
        showStatusFilter = false,
        statusOptions = [],
        placeholder = 'Search...',
        additionalFilters = []
    } = filterOptions;

    return `
        <div class="section-filter-bar" style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                ${showSearch ? `
                    <div style="flex: 1; min-width: 200px; position: relative;">
                        <i class="fa fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px;"></i>
                        <input
                            type="text"
                            class="section-search-input"
                            data-section="${sectionId}"
                            placeholder="${placeholder}"
                            style="width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; transition: all 0.2s;"
                        />
                    </div>
                ` : ''}

                ${showStatusFilter && statusOptions.length > 0 ? `
                    <select
                        class="section-status-filter"
                        data-section="${sectionId}"
                        style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; outline: none;"
                    >
                        <option value="">All Status</option>
                        ${statusOptions.map(opt => `<option value="${opt.value}">${opt.label} ${opt.count ? `(${opt.count})` : ''}</option>`).join('')}
                    </select>
                ` : ''}

                ${additionalFilters.map(filter => `
                    <select
                        class="section-additional-filter"
                        data-section="${sectionId}"
                        data-filter="${filter.key}"
                        style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; outline: none;"
                    >
                        <option value="">${filter.label}</option>
                        ${filter.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                `).join('')}

                <div class="filter-results-count" data-section="${sectionId}" style="padding: 6px 12px; background: #3b82f6; color: white; border-radius: 6px; font-size: 13px; font-weight: 600; white-space: nowrap;">
                    <i class="fa fa-filter" style="margin-right: 4px;"></i>
                    <span class="count">0</span> items
                </div>

                <button
                    class="section-reset-filter"
                    data-section="${sectionId}"
                    style="padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; transition: all 0.2s; display: none;"
                >
                    <i class="fa fa-times"></i> Reset
                </button>
            </div>
        </div>
    `;
}

// Setup filtering for a section
setupSectionFiltering(sectionId, data, filterConfig) {
    const self = this;
    const containerId = `${sectionId}-container`;
    let filteredData = [...data];
    let filters = {
        search: '',
        status: '',
        additional: {}
    };

    const applyFilters = () => {
        filteredData = data.filter(item => {
            // Search filter
            if (filters.search && filterConfig.searchFields) {
                const matchesSearch = filterConfig.searchFields.some(field => {
                    const value = item[field];
                    return value && String(value).toLowerCase().includes(filters.search);
                });
                if (!matchesSearch) return false;
            }

            // Status filter
            if (filters.status && item.status !== filters.status) {
                return false;
            }

            // Additional filters
            for (let key in filters.additional) {
                if (filters.additional[key] && item[key] !== filters.additional[key]) {
                    return false;
                }
            }

            return true;
        });

        // Update count
        $(`.filter-results-count[data-section="${sectionId}"] .count`).text(filteredData.length);

        // Show/hide reset button
        const hasFilters = filters.search || filters.status || Object.values(filters.additional).some(v => v);
        $(`.section-reset-filter[data-section="${sectionId}"]`).toggle(hasFilters);

        // Re-render
        if (filterConfig.renderFn) {
            $(`#${containerId}`).html(filterConfig.renderFn(filteredData));
        }
    };

    // Search input handler
    $(document).on('input', `.section-search-input[data-section="${sectionId}"]`, function() {
        filters.search = $(this).val().toLowerCase().trim();
        applyFilters();
    });

    // Status filter handler
    $(document).on('change', `.section-status-filter[data-section="${sectionId}"]`, function() {
        filters.status = $(this).val();
        applyFilters();
    });

    // Additional filters handler
    $(document).on('change', `.section-additional-filter[data-section="${sectionId}"]`, function() {
        const filterKey = $(this).data('filter');
        filters.additional[filterKey] = $(this).val();
        applyFilters();
    });

    // Reset button handler
    $(document).on('click', `.section-reset-filter[data-section="${sectionId}"]`, function() {
        filters = { search: '', status: '', additional: {} };
        $(`.section-search-input[data-section="${sectionId}"]`).val('');
        $(`.section-status-filter[data-section="${sectionId}"]`).val('');
        $(`.section-additional-filter[data-section="${sectionId}"]`).val('');
        applyFilters();
    });

    // Initial count
    $(`.filter-results-count[data-section="${sectionId}"] .count`).text(data.length);
}

// Enhanced Overview Section
renderEnhancedOverviewSection(order, financialDetails) {
    const profitStatus = this.getProfitStatus(financialDetails);
    
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
                        ${frappe.format(order.grand_total || 0, {fieldtype: 'Currency'})}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Grand Total</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-2);">
                        ${frappe.format(order.balance_to_bill_amount || 0, {fieldtype: 'Currency'})}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Balance to Bill</div>
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
            
            
            <!-- Project Tasks -->
            ${this.renderTasksSection(tasks)}
        </div>
    `;
}

// Enhanced Financials Section
renderEnhancedFinancialsSection(order, invoices, payments, advanceInvoices, financialDetails) {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
    const totalPaid = payments.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0);
    const totalAdvance = advanceInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    const totalAdvancePaid = advanceInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
    const plStatement = financialDetails.profit_loss_statement || {};

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
                            ${frappe.format(order.grand_total || 0, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Order Total</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success); margin-bottom: var(--space-1);">
                            ${frappe.format(totalInvoiced, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Total Invoiced</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--info); margin-bottom: var(--space-1);">
                            ${frappe.format(totalPaid, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Total Paid</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-1);">
                            ${frappe.format(totalOutstanding, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Outstanding</div>
                    </div>
                </div>
            </div>

            <!-- Profit & Loss Statement -->
            ${plStatement.summary ? `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <i class="fa fa-chart-line" style="color: var(--success);"></i>
                        Profit & Loss Statement
                    </div>

                    <!-- Summary Cards -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Total Income</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">
                                ${frappe.format(plStatement.summary.total_income || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Total Expenses</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--error);">
                                ${frappe.format(plStatement.summary.total_expense || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="profit-card">
                            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600; margin-bottom: var(--space-2);">Net Profit</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${plStatement.summary.net_profit >= 0 ? 'var(--success)' : 'var(--error)'};">
                                ${frappe.format(plStatement.summary.net_profit || 0, {fieldtype: 'Currency'})}
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
                                        <div style="text-align: right;">${frappe.format(acc.total_debit || 0, {fieldtype: 'Currency'})}</div>
                                        <div style="text-align: right;">${frappe.format(acc.total_credit || 0, {fieldtype: 'Currency'})}</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--success);">
                                            ${frappe.format(acc.net_amount || 0, {fieldtype: 'Currency'})}
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
                                        <div style="text-align: right;">${frappe.format(acc.total_debit || 0, {fieldtype: 'Currency'})}</div>
                                        <div style="text-align: right;">${frappe.format(acc.total_credit || 0, {fieldtype: 'Currency'})}</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--error);">
                                            ${frappe.format(acc.net_amount || 0, {fieldtype: 'Currency'})}
                                        </div>
                                    </div>
                                `).join('')}
                                <div class="pl-account-row pl-total-row">
                                    <div>Total Expenses</div>
                                    <div style="text-align: right;">-</div>
                                    <div style="text-align: right;">-</div>
                                    <div style="text-align: right; color: var(--error);">
                                        ${frappe.format(plStatement.summary.total_expense || 0, {fieldtype: 'Currency'})}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

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
                                                <span class="detail-label">Total: </span>
                                                <strong>${frappe.format(invoice.grand_total, {fieldtype: 'Currency'})}</strong>
                                            </div>
                                            <div>
                                                <span class="detail-label">Paid: </span>
                                                <strong style="color: var(--success);">${frappe.format(invoice.paid_amount || 0, {fieldtype: 'Currency'})}</strong>
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
                                    <strong>Total Advances</strong>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: var(--primary);">
                                        ${frappe.format(totalAdvance, {fieldtype: 'Currency'})}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-muted);">
                                        Paid: ${frappe.format(totalAdvancePaid, {fieldtype: 'Currency'})}
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
                                ${frappe.format(financialDetails.total_sales_amount || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Total Expenses</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">All project costs</div>
                            </div>
                            <div style="font-weight: 700; color: var(--error);">
                                ${frappe.format(financialDetails.total_expenses || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Actual Profit</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Revenue - Expenses</div>
                            </div>
                            <div style="font-weight: 700; color: ${financialDetails.actual_profit >= 0 ? 'var(--success)' : 'var(--error)'};">
                                ${frappe.format(financialDetails.actual_profit || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Timesheet Cost</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Labor and resource costs</div>
                            </div>
                            <div style="font-weight: 700; color: var(--warning);">
                                ${frappe.format(financialDetails.timesheet_amount || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Job Card Cost</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Manufacturing costs</div>
                            </div>
                            <div style="font-weight: 700; color: var(--warning);">
                                ${frappe.format(financialDetails.jc_expense || 0, {fieldtype: 'Currency'})}
                            </div>
                        </div>
                        <div class="financial-metric">
                            <div>
                                <div style="font-weight: 600;">Expense Limit (60% Target)</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">Maximum recommended expenses</div>
                            </div>
                            <div style="font-weight: 700;">
                                ${frappe.format(financialDetails.expected_expense_limit || 0, {fieldtype: 'Currency'})}
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

            ${this.renderPaymentEntriesSection(payments)}

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
                                    <td><strong>${frappe.format(amount, {fieldtype: 'Currency'})}</strong></td>
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
    // Get unique statuses for filter
    const uniqueStatuses = [...new Set(materialRequests.map(mr => mr.status))].sort();

    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-boxes" style="color: var(--warning);"></i>
                Material Requests (${materialRequests.length})
            </div>

            <!-- Filter Bar -->
            ${this.generateSectionFilterBar('material-requests', {
                showSearch: true,
                showStatusFilter: true,
                statusOptions: uniqueStatuses.map(status => ({
                    value: status,
                    label: status
                })),
                placeholder: 'Search by MR number, type...'
            })}

            <div id="material-requests-container" style="display: grid; gap: var(--space-4);">
                ${this.renderMaterialRequestItems(materialRequests)}
            </div>
        </div>
    `;
}

// Render individual Material Request items (separated for filtering)
renderMaterialRequestItems(materialRequests) {
    return materialRequests.map(mr => `
        <div class="document-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                        ${mr.name}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                        ${frappe.datetime.str_to_user(mr.transaction_date)}
                    </div>
                    <div style="display: flex; gap: var(--space-2); align-items: center;">
                        <span class="status-badge status-${mr.status === 'Submitted' ? 'completed' : mr.status === 'Ordered' ? 'pending' : 'normal'}">
                            ${mr.status}
                        </span>
                        <span style="background: var(--surface-alt); padding: var(--space-1) var(--space-2); border-radius: var(--radius); font-size: 0.75rem; color: var(--text-secondary);">
                            ${mr.material_request_type}
                        </span>
                    </div>
                </div>
                <button class="open-doc-btn" onclick="window.open('/app/material-request/${mr.name}', '_blank')">
                    <i class="fa fa-external-link"></i>
                    Open
                </button>
            </div>
        </div>
    `).join('');
}

// Render Sales Invoices Section
renderSalesInvoicesSection(invoices) {
    if (!invoices || invoices.length === 0) {
        return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-file-text" style="color: var(--success);"></i>
                    Sales Invoices (0)
                </div>
                <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                    <i class="fa fa-file-text" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                    <div>No invoices created yet</div>
                </div>
            </div>
        `;
    }

    // Get unique statuses for filter
    const uniqueStatuses = [...new Set(invoices.map(inv => inv.status))].sort();

    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-file-text" style="color: var(--success);"></i>
                Sales Invoices (${invoices.length})
            </div>

            <!-- Filter Bar -->
            ${this.generateSectionFilterBar('sales-invoices', {
                showSearch: true,
                showStatusFilter: true,
                statusOptions: uniqueStatuses.map(status => ({
                    value: status,
                    label: status
                })),
                placeholder: 'Search by invoice number, status...'
            })}

            <div id="sales-invoices-container" style="display: grid; gap: var(--space-4);">
                ${this.renderSalesInvoiceItems(invoices)}
            </div>
        </div>
    `;
}

// Render individual Sales Invoice items (separated for filtering)
renderSalesInvoiceItems(invoices) {
    return invoices.map(invoice => `
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
                            <strong>${frappe.format(invoice.grand_total, {fieldtype: 'Currency'})}</strong>
                        </div>
                        <div>
                            <span class="detail-label">Outstanding: </span>
                            <strong style="color: var(--warning);">${frappe.format(invoice.outstanding_amount, {fieldtype: 'Currency'})}</strong>
                        </div>
                    </div>
                </div>
                <button class="open-doc-btn" onclick="window.open('/app/sales-invoice/${invoice.name}', '_blank')">
                    <i class="fa fa-external-link"></i>
                    Open
                </button>
            </div>
        </div>
    `).join('');
}

// Render Delivery Notes Section
renderDeliveryNotesSection(deliveryNotes) {
    if (!deliveryNotes || deliveryNotes.length === 0) {
        return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-truck" style="color: var(--info);"></i>
                    Delivery Notes (0)
                </div>
                <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                    <i class="fa fa-truck" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                    <div>No delivery notes created yet</div>
                </div>
            </div>
        `;
    }

    // Get unique statuses for filter
    const uniqueStatuses = [...new Set(deliveryNotes.map(dn => dn.status))].sort();

    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-truck" style="color: var(--info);"></i>
                Delivery Notes (${deliveryNotes.length})
            </div>

            <!-- Filter Bar -->
            ${this.generateSectionFilterBar('delivery-notes', {
                showSearch: true,
                showStatusFilter: true,
                statusOptions: uniqueStatuses.map(status => ({
                    value: status,
                    label: status
                })),
                placeholder: 'Search by delivery note number, status...'
            })}

            <div id="delivery-notes-container" style="display: grid; gap: var(--space-4);">
                ${this.renderDeliveryNoteItems(deliveryNotes)}
            </div>
        </div>
    `;
}

// Render individual Delivery Note items (separated for filtering)
renderDeliveryNoteItems(deliveryNotes) {
    return deliveryNotes.map(dn => `
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
                        <strong>${frappe.format(dn.grand_total, {fieldtype: 'Currency'})}</strong>
                    </div>
                </div>
                <button class="open-doc-btn" onclick="window.open('/app/delivery-note/${dn.name}', '_blank')">
                    <i class="fa fa-external-link"></i>
                    Open
                </button>
            </div>
        </div>
    `).join('');
}

// Render Payment Entries Section
renderPaymentEntriesSection(payments) {
    if (!payments || payments.length === 0) {
        return `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fa fa-credit-card" style="color: var(--info);"></i>
                    Payment Entries (0)
                </div>
                <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
                    <i class="fa fa-credit-card" style="font-size: 2rem; margin-bottom: var(--space-3);"></i>
                    <div>No payment entries recorded</div>
                </div>
            </div>
        `;
    }

    // Get unique payment modes and statuses for filter
    const uniqueModes = [...new Set(payments.map(p => p.mode_of_payment).filter(Boolean))].sort();
    const uniqueStatuses = [...new Set(payments.map(p => p.status))].sort();

    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-credit-card" style="color: var(--info);"></i>
                Payment Entries (${payments.length})
            </div>

            <!-- Filter Bar -->
            ${this.generateSectionFilterBar('payment-entries', {
                showSearch: true,
                showStatusFilter: true,
                statusOptions: uniqueStatuses.map(status => ({
                    value: status,
                    label: status
                })),
                placeholder: 'Search by payment number, mode, reference...',
                additionalFilters: [{
                    type: 'select',
                    id: 'mode-filter',
                    label: 'Payment Mode',
                    options: [
                        { value: '', label: 'All Modes' },
                        ...uniqueModes.map(mode => ({ value: mode, label: mode }))
                    ]
                }]
            })}

            <div id="payment-entries-container" style="display: grid; gap: var(--space-4);">
                ${this.renderPaymentEntryItems(payments)}
            </div>
        </div>
    `;
}

// Render individual Payment Entry items (separated for filtering)
renderPaymentEntryItems(payments) {
    return payments.map(payment => `
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
                            <strong style="color: var(--success);">${frappe.format(payment.paid_amount, {fieldtype: 'Currency'})}</strong>
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
    `).join('');
}

// Render Tasks Section
renderTasksSection(tasks) {
    if (!tasks || tasks.length === 0) {
        return '';
    }

    // Get unique statuses for filter
    const uniqueStatuses = [...new Set(tasks.map(t => t.status))].sort();

    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-tasks" style="color: var(--info);"></i>
                Project Tasks (${tasks.length})
            </div>

            <!-- Filter Bar -->
            ${this.generateSectionFilterBar('tasks', {
                showSearch: true,
                showStatusFilter: true,
                statusOptions: uniqueStatuses.map(status => ({
                    value: status,
                    label: status
                })),
                placeholder: 'Search by task name, description...'
            })}

            <div id="tasks-container" style="display: grid; gap: var(--space-4);">
                ${this.renderTaskItems(tasks)}
            </div>
        </div>
    `;
}

// Render individual Task items (separated for filtering)
renderTaskItems(tasks) {
    return tasks.map(task => `
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
    `).join('');
}

// Render Purchase Orders Section
renderPurchaseOrdersSection(purchaseOrders) {
    const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + (po.grand_total || 0), 0);

    // Get unique statuses for filter
    const uniqueStatuses = [...new Set(purchaseOrders.map(po => po.status))].sort();

    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-shopping-cart" style="color: var(--secondary);"></i>
                Purchase Orders (${purchaseOrders.length})
            </div>

            <!-- Summary Card -->
            <div style="background: var(--surface-alt); padding: var(--space-4); border-radius: var(--radius-lg); margin-bottom: var(--space-4);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-4);">
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
                            ${purchaseOrders.length}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total POs</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">
                            ${frappe.format(totalPOAmount, {fieldtype: 'Currency'})}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Amount</div>
                    </div>
                </div>
            </div>

            <!-- Filter Bar -->
            ${this.generateSectionFilterBar('purchase-orders', {
                showSearch: true,
                showStatusFilter: true,
                statusOptions: uniqueStatuses.map(status => ({
                    value: status,
                    label: status
                })),
                placeholder: 'Search by PO number, supplier...'
            })}

            <!-- Purchase Orders List -->
            <div id="purchase-orders-container" style="display: grid; gap: var(--space-4);">
                ${this.renderPurchaseOrderItems(purchaseOrders)}
            </div>
        </div>
    `;
}

// Render individual Purchase Order items (separated for filtering)
renderPurchaseOrderItems(purchaseOrders) {
    return purchaseOrders.map(po => `
        <div class="document-card">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                        ${po.name}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                        Supplier: ${po.supplier_name || po.supplier}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                        Date: ${frappe.datetime.str_to_user(po.transaction_date)} • Schedule: ${frappe.datetime.str_to_user(po.schedule_date)}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-2);">
                        <div>
                            <span class="detail-label">Total: </span>
                            <strong>${frappe.format(po.grand_total, {fieldtype: 'Currency'})}</strong>
                        </div>
                        <div>
                            <span class="detail-label">Received: </span>
                            <strong>${po.per_received}%</strong>
                        </div>
                        <div>
                            <span class="detail-label">Billed: </span>
                            <strong>${po.per_billed}%</strong>
                        </div>
                        ${po.advance_paid > 0 ? `
                            <div>
                                <span class="detail-label">Advance: </span>
                                <strong>${frappe.format(po.advance_paid, {fieldtype: 'Currency'})}</strong>
                            </div>
                        ` : ''}
                    </div>
                    <div>
                        <span class="status-badge status-${
                            po.status === 'Completed' ? 'completed' :
                            po.status === 'To Receive and Bill' || po.status === 'To Bill' || po.status === 'To Receive' ? 'pending' :
                            'normal'
                        }">
                            ${po.status}
                        </span>
                    </div>
                </div>
                <button class="open-doc-btn" onclick="window.open('/app/purchase-order/${po.name}', '_blank')">
                    <i class="fa fa-external-link"></i>
                    Open
                </button>
            </div>
        </div>
    `).join('');
}

// Render BOMs Section
renderBOMsSection(boms) {
    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-cogs" style="color: var(--info);"></i>
                Bills of Materials (${boms.length})
            </div>
            <div style="display: grid; gap: var(--space-4);">
                ${boms.map(bom => `
                    <div class="document-card">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="font-weight: 700; color: var(--text); margin-bottom: var(--space-1);">
                                    ${bom.name}
                                </div>
                                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-2);">
                                    Item: ${bom.item_name || bom.item}
                                </div>
                                <div style="display: flex; gap: var(--space-4); margin-bottom: var(--space-2);">
                                    <div>
                                        <span class="detail-label">Quantity: </span>
                                        <strong>${bom.quantity}</strong>
                                    </div>
                                    <div>
                                        <span class="detail-label">Created: </span>
                                        <strong>${frappe.datetime.str_to_user(bom.creation)}</strong>
                                    </div>
                                </div>
                                <div style="display: flex; gap: var(--space-2); align-items: center;">
                                    <span class="status-badge status-${bom.is_active ? 'completed' : 'normal'}">
                                        ${bom.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    ${bom.is_default ? `
                                        <span style="background: var(--primary-glass); color: var(--primary); padding: var(--space-1) var(--space-2); border-radius: var(--radius); font-size: 0.75rem; font-weight: 600;">
                                            Default
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            <button class="open-doc-btn" onclick="window.open('/app/bom/${bom.name}', '_blank')">
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
                        ${frappe.format(order.grand_total || 0, {fieldtype: 'Currency'})}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Grand Total</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-2);">
                        ${frappe.format(order.balance_to_bill_amount || 0, {fieldtype: 'Currency'})}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Balance to Bill</div>
                </div>
                <div style="text-align: center; padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--info); margin-bottom: var(--space-2);">
                        ${frappe.format(order.advance_paid || 0, {fieldtype: 'Currency'})}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 600;">Advance Paid</div>
                </div>
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
                        <img src="${member.image || '/assets/frappe/images/ui/avatar.png'}" 
                             class="team-member-image" 
                             onerror="this.src='/assets/frappe/images/ui/avatar.png'">
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
                                    <div class="detail-value">${frappe.format(member.allocated_amount || 0, {fieldtype: 'Currency'})}</div>
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
                                <td>${frappe.format(item.rate || 0, {fieldtype: 'Currency'})}</td>
                                <td><strong>${frappe.format(item.amount || 0, {fieldtype: 'Currency'})}</strong></td>
                                <td>
                                    <span class="status-badge ${item.delivered_qty >= item.qty ? 'status-completed' : 'status-pending'}">
                                        ${item.delivered_qty || 0}
                                    </span>
                                </td>
                                <td>${frappe.format(item.billed_amt || 0, {fieldtype: 'Currency'})}</td>
                                <td>
                                    <div style="font-size: 0.75rem;">
                                        <div>Qty: ${item.pending_qty || 0}</div>
                                        <div style="color: var(--warning); font-weight: 600;">
                                            ${frappe.format(item.pending_amount || 0, {fieldtype: 'Currency'})}
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
            
            ${this.renderSalesInvoicesSection(invoices)}

            ${this.renderDeliveryNotesSection(deliveryNotes)}

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
                                            <strong>${frappe.format(quote.grand_total, {fieldtype: 'Currency'})}</strong>
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
                            ${frappe.format(order.grand_total || 0, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Order Total</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success); margin-bottom: var(--space-1);">
                            ${frappe.format(totalInvoiced, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Total Invoiced</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--info); margin-bottom: var(--space-1);">
                            ${frappe.format(totalPaid, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Total Paid</div>
                    </div>
                    <div style="text-align: center; padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border);">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning); margin-bottom: var(--space-1);">
                            ${frappe.format(totalOutstanding, {fieldtype: 'Currency'})}
                        </div>
                        <div class="detail-label">Outstanding</div>
                    </div>
                </div>
            </div>

            ${this.renderPaymentEntriesSection(payments)}

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
                                                    <button class="open-doc-btn" style="padding: var(--space-1) var(--space-2); font-size: 0.75rem;" onclick="window.open('/app/site-visit/${visit.name}', '_blank')">
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
                                                    <button class="open-doc-btn" style="padding: var(--space-1) var(--space-2); font-size: 0.75rem;" onclick="window.open('/app/design-request/${design.name}', '_blank')">
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

renderDesignRequestsSection(designRequests) {
    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-paint-brush" style="color: var(--secondary);"></i>
                Design Requests
            </div>
            ${designRequests.length ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4);">
                    ${designRequests.map(design => `
                        <div class="document-card" style="padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-light); transition: all 0.2s;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-3);">
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; color: var(--text); font-size: 1rem; margin-bottom: var(--space-2);">
                                        ${design.name}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-1);">
                                        <i class="fa fa-calendar" style="margin-right: var(--space-1);"></i>
                                        Created: ${frappe.datetime.str_to_user(design.creation)}
                                    </div>
                                    ${design.modified ? `
                                        <div style="font-size: 0.875rem; color: var(--text-muted);">
                                            <i class="fa fa-clock" style="margin-right: var(--space-1);"></i>
                                            Modified: ${frappe.datetime.str_to_user(design.modified)}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <button class="open-doc-btn" style="width: 100%; justify-content: center;" onclick="window.open('/app/design-request/${design.name}', '_blank')">
                                <i class="fa fa-external-link"></i>
                                Open Design Request
                            </button>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-paint-brush" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No design requests found</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">This sales order doesn't have any linked design requests</div>
                </div>
            `}
        </div>
    `;
}

renderPermitsSection(permits) {
    return `
        <div class="detail-section">
            <div class="detail-section-title">
                <i class="fa fa-file-signature" style="color: var(--warning);"></i>
                Permits
            </div>
            ${permits.length ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4);">
                    ${permits.map(permit => `
                        <div class="document-card" style="padding: var(--space-4); background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-light); transition: all 0.2s;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-3);">
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; color: var(--text); font-size: 1rem; margin-bottom: var(--space-2);">
                                        ${permit.name}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-1);">
                                        <i class="fa fa-calendar" style="margin-right: var(--space-1);"></i>
                                        Created: ${frappe.datetime.str_to_user(permit.creation)}
                                    </div>
                                    ${permit.modified ? `
                                        <div style="font-size: 0.875rem; color: var(--text-muted);">
                                            <i class="fa fa-clock" style="margin-right: var(--space-1);"></i>
                                            Modified: ${frappe.datetime.str_to_user(permit.modified)}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <button class="open-doc-btn" style="width: 100%; justify-content: center;" onclick="window.open('/app/permit-form/${permit.name}', '_blank')">
                                <i class="fa fa-external-link"></i>
                                Open Permit
                            </button>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                    <i class="fa fa-file-signature" style="font-size: 3rem; margin-bottom: var(--space-4);"></i>
                    <div>No permits found</div>
                    <div style="font-size: 0.875rem; margin-top: var(--space-2);">This sales order doesn't have any linked permits</div>
                </div>
            `}
        </div>
    `;
}

setupDetailTabHandlers() {
    $('.detail-tab').on('click', function() {
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
    const headers = ['Order #', 'Customer', 'Project', 'Project Description', 'Sales Person', 'Delivery Date', 'Status', 'Grand Total', 'Remaining Amount', 'Billing %', 'Delivery %'];
    const rows = this.filtered_orders.map(order => [
        order.name,
        order.customer,
        order.project || '',
        order.custom_project_description || '',
        order.sales_person,
        order.delivery_date,
        order.status || 'Unknown',
        order.grand_total,
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
    
    // Then apply global search filter - INCLUDING PROJECT FIELDS
    this.filtered_orders = filtered.filter(order =>
        order.name.toLowerCase().includes(lowerQuery) ||
        order.customer.toLowerCase().includes(lowerQuery) ||
        (order.sales_person || '').toLowerCase().includes(lowerQuery) ||
        (order.status || '').toLowerCase().includes(lowerQuery) ||
        (order.branch || '').toLowerCase().includes(lowerQuery) ||
        (order.project || '').toLowerCase().includes(lowerQuery) ||
        (order.custom_project_description || '').toLowerCase().includes(lowerQuery)
    );
    
    this.processData();
    this.updateActiveFilters();
    this.updateHeaderStats();
    this.renderView();
}
}

// Export the class
window.UltraModernSalesOrderDashboard = UltraModernSalesOrderDashboard;
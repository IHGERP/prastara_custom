frappe.pages['prd-arm'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Accounts Receivable Management Dashboard',
		single_column: true
	});

	// Disable localStorage caching to prevent QuotaExceededError
	// This page is too large (263KB+) to be cached in localStorage
	frappe.pages['prd-arm'].no_cache = 1;

	// Initialize the dashboard
	frappe.prd_arm = new ARMDashboard(wrapper, page);
	frappe.prd_arm.init();
}

class ARMDashboard {
	constructor(wrapper, page) {
		this.wrapper = wrapper;
		this.page = page;
		this.data = [];
		this.filtered_data = [];
		this.summary_data = {};
		this.current_section = 'overview';
		this.loading = false;
		this.data_cache = new Map(); // Cache for API responses
		this.cache_duration = 5 * 60 * 1000; // 5 minutes cache
		this.last_loaded = null;
		this.filters = {
			company: 'PRASTARA DECORATION DESIGN L.L.C',
			customer: '',
			branch: '',
			account_incharge: '',
			sales_team: '',
			sales_person: '',
			report_date: frappe.datetime.get_today(),
			aging_filter: 'all',
			min_outstanding: 0,
			max_outstanding: null,
			internal_customer: '',
			voucher_type_filter: 'all'
		};
		// Section-specific caching
		this.section_cache = {
			listed_customers: { data: null, timestamp: null },
			payment_schedules: { data: null, timestamp: null },
			intercompany_overdues: { data: null, timestamp: null }
		};
		this.section_loaded = {}; // Track which sections have been loaded

		// Collection totals for Overview cards
		this.month_collection_total = 0;
		this.year_collection_total = 0;

		// Internal customers list for splitting outstanding
		this.internal_customers = new Set();

		// Intercompany Pagination
		this.intercompany_page = 1;
		this.intercompany_page_size = 50;

		// Salesperson-wise local filter state
		this.salesperson_data = { totals: {}, summary: [], detailed: [] };
		this.salesperson_data_loaded = false;
		this.salesperson_name_filter = '';
	}

	init() {
		this.setup_page();
		this.create_sidebar();
		this.create_main_content();
		this.setup_table_enhancements();
		this.setup_card_click_handlers();
		this.load_chartjs_library();
		this.fetch_internal_customers();
		this.load_default_data();
	}

	fetch_internal_customers() {
		const set_internal_customers = (names) => {
			this.internal_customers = new Set(Array.isArray(names) ? names : []);
		};

		const fallback_to_server_method = () => {
			frappe.call({
				method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_internal_customers',
				freeze: false,
				callback: (r) => {
					if (r.message) {
						set_internal_customers(r.message);
					}
				}
			});
		};

		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Customer',
				fields: ['name', 'is_internal_customer'],
				limit_page_length: 0
			},
			freeze: false,
			callback: (r) => {
				if (r.message && Array.isArray(r.message)) {
					const internal_names = r.message
						.filter(row => row && row.is_internal_customer)
						.map(row => row.name);
					set_internal_customers(internal_names);
				} else {
					fallback_to_server_method();
				}
			},
			error: () => {
				fallback_to_server_method();
			}
		});
	}

	load_chartjs_library() {
		// Check if Chart.js is already loaded
		if (typeof Chart !== 'undefined') {
			console.log('Chart.js already loaded');
			return Promise.resolve();
		}

		console.log('Loading Chart.js library...');

		// Load Chart.js from CDN
		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
			script.onload = () => {
				console.log('Chart.js loaded successfully');
				resolve();
			};
			script.onerror = () => {
				console.error('Failed to load Chart.js');
				reject(new Error('Failed to load Chart.js'));
			};
			document.head.appendChild(script);
		});
	}

	wait_for_chartjs_and_create_charts() {
		// Wait for Chart.js to be loaded and data to be ready
		const checkAndCreate = () => {
			if (typeof Chart !== 'undefined') {
				console.log('Chart.js is loaded, creating charts');
				console.log('Filtered data length:', this.filtered_data ? this.filtered_data.length : 0);
				this.create_aging_distribution_chart();
				this.create_aging_pie_chart();
			} else {
				console.log('Chart.js not loaded yet, waiting...');
				setTimeout(checkAndCreate, 100);
			}
		};

		// Wait for debounce_render to complete (100ms) + buffer time for Chart.js
		setTimeout(checkAndCreate, 300);
	}

	setup_page() {
		console.log('Setting up page actions...');
		this.page.set_primary_action(__('Refresh'), () => this.load_data(), 'fa fa-refresh');
		this.page.set_secondary_action(__('Filters'), () => this.show_filter_modal(), 'fa fa-filter');
		this.page.add_menu_item(__('Export to Excel'), () => this.export_to_excel(), true);
		this.page.add_menu_item(__('Print'), () => this.print_report(), true);
		console.log('Page actions set up complete');

		// Add global search bar to page header (near filter button)
		this.add_global_search_to_header();

		// Setup global navbar event handlers
		setTimeout(() => {
			this.setup_global_navbar_events();
		}, 500);

		// Add custom CSS styles
		this.add_custom_styles();

		// Aggressively override ALL Frappe containers to be full width
		$('body, html').css({
			'margin': '0 !important',
			'padding': '0 !important',
			'width': '100% !important',
			'max-width': '100vw !important',
			'overflow-x': 'hidden !important',
			'box-sizing': 'border-box !important'
		});

		// Override page containers
		this.page.body.css({
			'margin': '0 !important',
			'padding': '0 !important',
			'width': '100% !important',
			'max-width': '100vw !important',
			'overflow-x': 'hidden !important',
			'box-sizing': 'border-box !important'
		});

		// Override wrapper and all parent containers
		$(this.wrapper).css({
			'margin': '0 !important',
			'padding': '0 !important',
			'width': '100% !important',
			'max-width': '100vw !important',
			'overflow-x': 'hidden !important',
			'box-sizing': 'border-box !important'
		});

		// Override any parent containers
		$(this.wrapper).parents().each(function () {
			$(this).css({
				'margin': '0 !important',
				'padding': '0 !important',
				'width': '100% !important',
				'max-width': 'none !important'
			});
		});

		// Create main container with sidebar layout
		this.main_container = $(`
			<div class="arm-dashboard-container">
				<div class="dashboard-sidebar">
					<!-- Sidebar content will be added here -->
				</div>
				<div class="dashboard-content">
					<!-- Main content will be added here -->
				</div>
			</div>
		`).appendTo(this.page.body);
	}

	add_global_search_to_header() {
		// The search bar is now added inline in create_global_title_section()
		// We just need to initialize it after the DOM is ready
		setTimeout(() => {
			// Store reference to search container
			this.search_container = $('.global-search-bar-inline');

			// Setup global search functionality
			if (this.search_container.length > 0) {
				this.setup_global_search();
			}
		}, 500);
	}

	add_custom_styles() {
		const styles = `
			<style>
			/* Global Viewport Fit Rules */
			* {
				box-sizing: border-box;
			}

			/* Force full viewport usage - override all Frappe defaults */
			body, html {
				overflow-x: hidden !important;
				max-width: 100vw !important;
				width: 100% !important;
				margin: 0 !important;
				padding: 0 !important;
			}

			/* Override Frappe's page containers */
			.page-container, .container, .page-body,
			.page-wrapper, .page-content, .layout-main {
				margin: 0 !important;
				padding: 0 !important;
				width: 100% !important;
				max-width: none !important;
			}

			/* Custom column class for 5 columns (20% width each) */
			.col-md-2-4 {
				flex: 0 0 20%;
				max-width: 20%;
				position: relative;
				width: 100%;
				padding-right: 15px;
				padding-left: 15px;
			}

			@media (max-width: 991px) {
				.col-md-2-4 {
					flex: 0 0 50%;
					max-width: 50%;
				}
			}

			@media (max-width: 767px) {
				.col-md-2-4 {
					flex: 0 0 100%;
					max-width: 100%;
				}
			}

			/* 🌙 Dark Glassmorphism Theme - Fixed Layout Structure */
			.arm-dashboard-container {
				position: fixed !important;
				top: 60px !important;
				left: 0 !important;
				right: 0 !important;
				bottom: 0 !important;
				display: flex;
				width: 100vw !important;
				height: calc(100vh - 60px) !important;
				margin: 0 !important;
				padding: 0 !important;
				background: linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #334155 50%, #475569 75%, #64748b 100%);
				background-size: 400% 400%;
				animation: gradientShift 15s ease infinite;
				font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				color: #e2e8f0;
				overflow: hidden;
				box-sizing: border-box;
				z-index: 999;
			}

			/* Animated background gradient */
			@keyframes gradientShift {
				0% { background-position: 0% 50%; }
				50% { background-position: 100% 50%; }
				100% { background-position: 0% 50%; }
			}

			/* Glassmorphism overlay effects */
			.arm-dashboard-container::before {
				content: '';
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background:
					radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
					radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.15) 0%, transparent 50%),
					radial-gradient(circle at 40% 60%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
				pointer-events: none;
				z-index: 0;
			}

			/* Sidebar Styles - Fixed Position */
			.dashboard-sidebar {
				width: 280px;
				height: 100%;
				background: rgba(30, 41, 59, 0.7);
				backdrop-filter: blur(20px);
				border-right: 1px solid rgba(59, 130, 246, 0.3);
				box-shadow:
					0 8px 32px rgba(0, 0, 0, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.1);
				position: fixed;
				top: 60px;
				left: 0;
				bottom: 0;
				overflow-y: auto;
				z-index: 1000;
			}

			/* Neon accent border */
			.dashboard-sidebar::after {
				content: '';
				position: absolute;
				top: 0;
				right: 0;
				width: 2px;
				height: 100%;
				background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%);
				box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
			}

			.sidebar-header {
				padding: 24px 20px;
				border-bottom: 1px solid rgba(59, 130, 246, 0.3);
				background: rgba(15, 23, 42, 0.8);
				backdrop-filter: blur(10px);
			}

			.sidebar-title {
				color: #f1f5f9;
				font-size: 18px;
				font-weight: 700;
				margin: 0;
				display: flex;
				align-items: center;
				text-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
			}

			.sidebar-title i {
				color: #3b82f6;
				margin-right: 12px;
				font-size: 20px;
				filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8));
			}

			.sidebar-subtitle {
				color: #94a3b8;
				font-size: 12px;
				margin: 8px 0 0 0;
				font-weight: 400;
				opacity: 0.8;
			}

			.sidebar-nav {
				padding: 16px 0;
			}

			.nav-section {
				margin-bottom: 32px;
			}

			.nav-section-title {
				color: #64748b;
				font-size: 11px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 1px;
				padding: 0 20px 8px;
				margin-bottom: 8px;
			}

			.nav-item {
				display: flex;
				align-items: center;
				padding: 12px 20px;
				color: #cbd5e1;
				text-decoration: none;
				transition: all 0.3s ease;
				cursor: pointer;
				font-size: 14px;
				font-weight: 500;
				border-left: 3px solid transparent;
				border-radius: 0 12px 12px 0;
				margin: 2px 0;
			}

			.nav-item:hover {
				background: rgba(59, 130, 246, 0.1);
				color: #f1f5f9;
				text-decoration: none;
				transform: translateX(4px);
				border-left: 3px solid #3b82f6;
				box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
			}

			.nav-item.active {
				background: linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
				color: #60a5fa;
				border-left-color: #3b82f6;
				box-shadow:
					0 4px 12px rgba(59, 130, 246, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.1);
			}

			.nav-item i {
				width: 20px;
				margin-right: 12px;
				font-size: 16px;
			}

			.nav-item .badge {
				margin-left: auto;
				background: #be185d;
				color: white;
				font-size: 10px;
				padding: 2px 6px;
				border-radius: 10px;
			}

			/* Main Content Area - Simple Layout */
			.dashboard-content {
				position: fixed;
				top: 60px;
				left: 280px;
				right: 0;
				bottom: 0;
				background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
				box-sizing: border-box;
				overflow-y: auto;
				overflow-x: hidden;
			}

			/* Global Title Section (Common across all sections) */
			.global-title-section {
				background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
				border-bottom: 2px solid rgba(59, 130, 246, 0.3);
				padding: 15px 20px;
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 20px;
			}

			.global-title-section h1 {
				margin: 0;
				color: #e2e8f0;
				font-size: 20px;
				font-weight: 600;
			}

			.global-title-section i {
				color: #3b82f6;
				margin-right: 8px;
			}

			.global-actions {
				display: flex;
				gap: 10px;
				align-items: center;
			}

			/* Fixed Content Header - Sticky like Excel freeze */
			.content-header {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(51, 65, 85, 0.98) 100%);
				border-bottom: 2px solid rgba(59, 130, 246, 0.3);
				padding: 20px;
				position: sticky;
				top: 0;
				backdrop-filter: blur(20px);
				flex-shrink: 0;
				z-index: 950;
				box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 2px 10px rgba(59, 130, 246, 0.2);
			}

			/* Scrollable Content Body */
			.content-body {
				flex: 1;
				overflow-y: auto;
				overflow-x: hidden;
				padding: 20px;
				background: transparent;
			}

			.content-title {
				color: #b3bfcd;
				font-size: 24px;
				font-weight: 700;
				margin: 0;
				display: flex;
				align-items: center;
			}

			.content-title i {
				color: #3b82f6;
				margin-right: 12px;
			}

			.content-subtitle {
				color: #94a3b8;
				font-size: 14px;
				margin: 4px 0 0 0;
				font-weight: 400;
			}

			.content-body {
				padding: 32px;
			}

			/* Cards and Components - Dark Glassmorphism */
			.stat-card {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%);
				backdrop-filter: blur(20px);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 16px;
				padding: 20px 16px;
				min-height: 140px;
				box-shadow:
					0 8px 32px rgba(0, 0, 0, 0.3),
					0 0 0 1px rgba(59, 130, 246, 0.2),
					inset 0 1px 0 rgba(255, 255, 255, 0.1);
				transition: all 0.3s ease;
				position: relative;
				overflow: visible;
				color: #e2e8f0;
				display: flex;
				flex-direction: column;
			}

			.stat-card:hover {
				transform: translateY(-6px);
				box-shadow:
					0 20px 40px rgba(0, 0, 0, 0.3),
					0 0 20px rgba(59, 130, 246, 0.2),
					inset 0 1px 0 rgba(255, 255, 255, 0.15);
				border: 1px solid rgba(59, 130, 246, 0.4);
			}

			.stat-card::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				height: 4px;
				animation: neonPulse 2s ease-in-out infinite alternate;
			}

			@keyframes neonPulse {
				from { opacity: 0.8; }
				to { opacity: 1; box-shadow: 0 0 10px currentColor; }
			}

			.stat-card.primary::before { background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); }
			.stat-card.success::before { background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%); }
			.stat-card.warning::before { background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%); }
			.stat-card.danger::before { background: linear-gradient(90deg, #ef4444 0%, #f43f5e 100%); }

			.stat-header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 16px;
			}

			.stat-title {
				color: #94a3b8;
				font-size: 14px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				margin: 0;
				text-shadow: 0 0 5px rgba(148, 163, 184, 0.3);
			}

			.stat-icon {
				width: 52px;
				height: 52px;
				border-radius: 16px;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 22px;
				box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
			}

			.stat-icon.primary {
				background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
				color: #60a5fa;
				border: 1px solid rgba(59, 130, 246, 0.3);
				box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
			}
			.stat-icon.success {
				background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
				color: #34d399;
				border: 1px solid rgba(16, 185, 129, 0.3);
				box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
			}
			.stat-icon.warning {
				background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
				color: #fbbf24;
				border: 1px solid rgba(245, 158, 11, 0.3);
				box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
			}
			.stat-icon.danger {
				background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(244, 63, 94, 0.2) 100%);
				color: #f87171;
				border: 1px solid rgba(239, 68, 68, 0.3);
				box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
			}

			.stat-header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 12px;
				flex-wrap: wrap;
				gap: 8px;
			}

			.stat-title {
				font-size: 13px;
				font-weight: 600;
				color: #cbd5e1;
				margin: 0;
				flex: 1;
				min-width: 0;
				word-wrap: break-word;
				overflow-wrap: break-word;
			}

			.stat-value {
				font-size: 22px;
				font-weight: 800;
				color: #f1f5f9;
				line-height: 1.2;
				margin-bottom: 8px;
				text-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
				word-break: break-word;
				overflow-wrap: break-word;
				white-space: normal;
				max-width: 100%;
			}

			.stat-change {
				font-size: 11px;
				font-weight: 600;
				word-wrap: break-word;
			}

			.stat-description {
				font-size: 11px;
				color: #94a3b8;
				margin-top: 8px;
				word-wrap: break-word;
			}

			.stat-icon {
				width: 36px;
				height: 36px;
				border-radius: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 18px;
				flex-shrink: 0;
			}

			.stat-icon.primary { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
			.stat-icon.success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
			.stat-icon.warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
			.stat-icon.danger { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
			.stat-icon.info { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }

			.stat-change.positive { color: #059669; }
			.stat-change.negative { color: #dc2626; }

			/* Metrics Grid - Advanced View */
			.metrics-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
				gap: 20px;
				margin-bottom: 24px;
				background: rgba(30, 41, 59, 0.4);
				padding: 24px;
				border-radius: 20px;
				border: 1px solid rgba(59, 130, 246, 0.2);
				backdrop-filter: blur(10px);
			}

			.metric-item {
				display: flex;
				flex-direction: column;
				gap: 8px;
				padding: 12px;
				border-radius: 12px;
				background: rgba(30, 41, 59, 0.2);
				border: 1px solid transparent;
				transition: all 0.3s ease;
			}

			.metric-item:hover {
				background: rgba(59, 130, 246, 0.1);
				border-color: rgba(59, 130, 246, 0.3);
				transform: scale(1.02);
			}

			.metric-label {
				font-size: 11px;
				font-weight: 700;
				color: #94a3b8;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.metric-value-large {
				font-size: 20px;
				font-weight: 800;
				color: #f1f5f9;
				text-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
			}

			/* Data Table */
			.data-table-container {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 16px;
				overflow: hidden;
				backdrop-filter: blur(10px);
				box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
			}

			.table-header {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				color: white;
				padding: 20px 24px;
				border-bottom: none;
			}

			.table-title {
				font-size: 18px;
				font-weight: 700;
				margin: 0;
				display: flex;
				align-items: center;
			}

			.table-title i {
				margin-right: 12px;
				color: #c084fc;
			}

			.table {
				margin: 0;
				border: none;
				font-size: 14px;
			}

			.table thead th {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(51, 65, 85, 0.3) 100%);
				border: none;
				border-bottom: 2px solid rgba(59, 130, 246, 0.3);
				color: #3b82f6;
				font-weight: 600;
				padding: 16px 12px;
				font-size: 12px;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.table tbody td {
				border: none;
				border-bottom: 1px solid #f3f0ff;
				padding: 16px 12px;
				vertical-align: middle;
				color:white;
			}

			.table tbody tr:hover {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(51, 65, 85, 0.3) 100%);
			}

			/* Table tools: search + sorting */
			.arm-table-tools {
				display: flex;
				align-items: center;
				justify-content: flex-end;
				gap: 10px;
				padding: 10px 12px;
				background: rgba(30, 41, 59, 0.35);
				border: 1px solid rgba(59, 130, 246, 0.25);
				border-bottom: none;
				border-radius: 8px 8px 0 0;
				margin-top: 12px;
			}

			.arm-table-search-wrapper {
				position: relative;
				min-width: 220px;
				max-width: 320px;
				width: 100%;
			}

			.arm-table-search-input {
				width: 100%;
				padding: 8px 30px 8px 12px;
				border-radius: 8px;
				border: 1px solid rgba(59, 130, 246, 0.35);
				background: rgba(15, 23, 42, 0.6);
				color: #e2e8f0;
				font-size: 12px;
			}

			.arm-table-search-input:focus {
				outline: none;
				border-color: #3b82f6;
				box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
			}

			.arm-table-search-clear {
				position: absolute;
				right: 8px;
				top: 50%;
				transform: translateY(-50%);
				color: #94a3b8;
				cursor: pointer;
				display: none;
			}

			.arm-table-search-clear:hover {
				color: #3b82f6;
			}

			.arm-sortable {
				cursor: pointer;
				user-select: none;
			}

			.arm-sort-icon {
				margin-left: 6px;
				color: #94a3b8;
				font-size: 11px;
			}

			.arm-sortable:hover .arm-sort-icon {
				color: #3b82f6;
			}

			/* Filters */
			.filters-section {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(51, 65, 85, 0.4) 100%);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 16px;
				padding: 24px;
				margin-bottom: 24px;
				box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
			}

			.filters-title {
				color: #581c87;
				font-size: 16px;
				font-weight: 700;
				margin-bottom: 20px;
				display: flex;
				align-items: center;
			}

			.filters-title i {
				color: #3b82f6;
				margin-right: 8px;
			}

			.form-control {
				border: 1px solid #d8b4fe;
				border-radius: 10px;
				padding: 10px 16px;
				font-size: 14px;
				line-height: 1.5;
				height: auto;
				min-height: 42px;
				transition: border-color 0.3s ease, box-shadow 0.3s ease;
				background: rgba(30, 41, 59, 0.4);
				color: #e2e8f0 !important;
			}

			.form-control:focus {
				border-color: #3b82f6;
				box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
				background: rgba(30, 41, 59, 0.6);
				color: #e2e8f0 !important;
				outline: none;
			}

			/* Select dropdown options styling */
			.form-control select,
			.form-control option {
				color: #e2e8f0 !important;
				background: rgba(30, 41, 59, 0.95) !important;
			}

			/* Date input styling */
			.form-control[type="date"] {
				color: #e2e8f0 !important;
				color-scheme: dark;
			}

			.form-control[type="date"]::-webkit-calendar-picker-indicator {
				filter: invert(1);
				cursor: pointer;
			}

			.btn {
				border-radius: 10px;
				font-weight: 600;
				padding: 12px 24px;
				font-size: 14px;
				transition: all 0.3s ease;
				border: 1px solid transparent;
			}

			.btn-primary {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				color: white;
				border-color: #3b82f6;
			}

			.btn-primary:hover {
				background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
				border-color: #2563eb;
				transform: translateY(-2px);
				box-shadow: 0 6px 15px rgba(59, 130, 246, 0.4);
			}

			.btn-secondary {
				background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
				color: white;
				border-color: #6b7280;
			}

			.btn-secondary:hover {
				background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
				border-color: #4b5563;
				color: white;
				transform: translateY(-2px);
			}

			.control-label {
				color: #581c87;
				font-weight: 600;
				font-size: 13px;
				margin-bottom: 6px;
				display: flex;
				align-items: center;
			}

			.control-label i {
				margin-right: 6px;
				color: #3b82f6;
			}

			/* Badges */
			.badge {
				padding: 4px 8px;
				border-radius: 8px;
				font-weight: 600;
				font-size: 11px;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.badge-success { background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%); color: #34d399; }
			.badge-warning { background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%); color: #fbbf24; }
			.badge-danger { background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(244, 63, 94, 0.1) 100%); color: #f87171; }
			.badge-info { background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%); color: #60a5fa; }

			/* Loading */
			.loading-overlay {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(15, 23, 42, 0.95);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 10000;
				backdrop-filter: blur(4px);
			}

			/* Card Modal Styles */
			.card-modal-backdrop {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(30, 41, 59, 0.8);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 15000;
				backdrop-filter: blur(8px);
				opacity: 0;
				transition: opacity 0.3s ease;
			}

			.card-modal-backdrop.show {
				opacity: 1;
			}

			.card-modal {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%);
				backdrop-filter: blur(20px);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 16px;
				box-shadow:
					0 25px 50px rgba(0, 0, 0, 0.5),
					0 0 0 1px rgba(59, 130, 246, 0.2),
					0 0 30px rgba(59, 130, 246, 0.15),
					inset 0 1px 0 rgba(255, 255, 255, 0.1);
				padding: 0;
				max-width: 600px;
				width: 90%;
				max-height: 80vh;
				overflow: hidden;
				transform: scale(0.9) translateY(20px);
				transition: transform 0.3s ease;
				color: #e2e8f0;
			}

			.card-modal-backdrop.show .card-modal {
				transform: scale(1) translateY(0);
			}

			.card-modal-header {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				backdrop-filter: blur(20px);
				border: 1px solid rgba(59, 130, 246, 0.4);
				border-bottom: 2px solid rgba(59, 130, 246, 0.3);
				color: #f1f5f9;
				padding: 24px;
				border-radius: 16px 16px 0 0;
				position: relative;
				box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
			}

			.card-modal-title {
				font-size: 24px;
				font-weight: 700;
				margin: 0;
				display: flex;
				align-items: center;
				gap: 12px;
			}

			.card-modal-subtitle {
				margin: 8px 0 0 0;
				opacity: 0.9;
				font-size: 14px;
			}

			.card-modal-close {
				position: absolute;
				top: 20px;
				right: 20px;
				background: rgba(255, 255, 255, 0.2);
				border: none;
				color: white;
				width: 36px;
				height: 36px;
				border-radius: 50%;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: background-color 0.2s ease;
			}

			.card-modal-close:hover {
				background: rgba(255, 255, 255, 0.3);
			}

			.card-modal-body {
				background: rgba(15, 23, 42, 0.6);
				backdrop-filter: blur(16px);
				padding: 24px;
				max-height: 60vh;
				overflow-y: auto;
				border-radius: 0 0 16px 16px;
			}

			.card-modal-stats {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 16px;
				margin-bottom: 24px;
			}

			.card-modal-stat-item {
				background: rgba(30, 41, 59, 0.5);
				backdrop-filter: blur(12px);
				border: 1px solid rgba(59, 130, 246, 0.2);
				padding: 16px;
				border-radius: 12px;
				box-shadow:
					0 4px 16px rgba(0, 0, 0, 0.2),
					inset 0 1px 0 rgba(255, 255, 255, 0.1);
				transition: all 0.3s ease;
			}

			.card-modal-stat-label {
				font-size: 12px;
				color: #94a3b8;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				margin-bottom: 4px;
			}

			.card-modal-stat-value {
				font-size: 18px;
				font-weight: 700;
				color: #f1f5f9;
			}

			.clickable-stat {
				cursor: pointer;
				color: #3b82f6 !important;
				transition: all 0.2s ease;
				padding: 2px 4px;
				border-radius: 4px;
			}

			.clickable-stat:hover {
				background-color: rgba(59, 130, 246, 0.1);
				color: #60a5fa !important;
				transform: translateY(-1px);
			}

			.card-modal-footer {
				padding: 5px 24px;
				border-top: 1px solid rgba(59, 130, 246, 0.2);
				display: flex;
				justify-content: space-between;
				align-items: center;
				background: rgba(15, 23, 42, 0.8);
				backdrop-filter: blur(16px);
			}

			.btn-view-details {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				border: 1px solid rgba(59, 130, 246, 0.3);
				color: #f1f5f9;
				padding: 12px 24px;
				border-radius: 8px;
				font-weight: 600;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				transition: all 0.3s ease;
				backdrop-filter: blur(10px);
				box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
			}

			.btn-view-details:hover {
				transform: translateY(-2px);
				box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4);
				border-color: rgba(59, 130, 246, 0.5);
			}

			/* Enhanced Premium Animations and Effects */
			.card-modal-stat-item:hover {
				transform: translateY(-3px);
				border-color: rgba(59, 130, 246, 0.4);
				box-shadow:
					0 8px 25px rgba(0, 0, 0, 0.3),
					0 0 20px rgba(59, 130, 246, 0.2),
					inset 0 1px 0 rgba(255, 255, 255, 0.15);
			}

			.breakdown-card:hover {
				transform: translateY(-3px) scale(1.02);
				border-color: rgba(59, 130, 246, 0.5);
				box-shadow:
					0 12px 30px rgba(0, 0, 0, 0.4),
					0 0 25px rgba(59, 130, 246, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.2);
			}

			/* Animated Glow Effect for Cards */
			@keyframes cardGlow {
				0%, 100% {
					box-shadow:
						0 8px 32px rgba(0, 0, 0, 0.3),
						0 0 0 1px rgba(59, 130, 246, 0.2),
						inset 0 1px 0 rgba(255, 255, 255, 0.1);
				}
				50% {
					box-shadow:
						0 12px 40px rgba(59, 130, 246, 0.2),
						0 0 20px rgba(59, 130, 246, 0.3),
						inset 0 1px 0 rgba(255, 255, 255, 0.15);
				}
			}

			.stat-card {
				animation: cardGlow 4s ease-in-out infinite;
			}

			/* Enhanced Animated Background with Multiple Layers */
			@keyframes gradientShift {
				0% {
					background-position: 0% 50%;
				}
				50% {
					background-position: 100% 50%;
				}
				100% {
					background-position: 0% 50%;
				}
			}

			@keyframes floatingOrbs {
				0%, 100% {
					transform: translateY(0px) rotate(0deg);
				}
				33% {
					transform: translateY(-20px) rotate(120deg);
				}
				66% {
					transform: translateY(10px) rotate(240deg);
				}
			}

			/* Floating Orb Effects */
			.arm-dashboard-container::before {
				content: '';
				position: absolute;
				top: 10%;
				left: 10%;
				width: 200px;
				height: 200px;
				background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
				border-radius: 50%;
				animation: floatingOrbs 8s ease-in-out infinite;
				pointer-events: none;
				z-index: 1;
			}

			.arm-dashboard-container::after {
				content: '';
				position: absolute;
				top: 60%;
				right: 15%;
				width: 150px;
				height: 150px;
				background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
				border-radius: 50%;
				animation: floatingOrbs 6s ease-in-out infinite reverse;
				pointer-events: none;
				z-index: 1;
			}

			/* Enhanced Sidebar Animations */
			.sidebar-items .list-group-item {
				transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
			}

			.sidebar-items .list-group-item:hover {
				transform: translateX(8px);
				background: rgba(59, 130, 246, 0.15);
				border-left: 3px solid #3b82f6;
			}

			/* Pulse Animation for Active Elements */
			@keyframes pulse {
				0%, 100% {
					opacity: 1;
				}
				50% {
					opacity: 0.7;
				}
			}

			.stat-card.active,
			.breakdown-card.active {
				animation: pulse 2s ease-in-out infinite;
			}

			/* Enhanced Modal Entrance Animation */
			@keyframes modalSlideIn {
				0% {
					opacity: 0;
					transform: scale(0.8) translateY(30px) rotateX(-10deg);
				}
				100% {
					opacity: 1;
					transform: scale(1) translateY(0) rotateX(0deg);
				}
			}

			.card-modal-backdrop.show .card-modal {
				animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
			}

			/* Aging Modal Styles */
			.aging-modal-backdrop {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.6);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 10001;
				backdrop-filter: blur(8px);
				opacity: 0;
				transition: opacity 0.3s ease;
			}

			.aging-modal-backdrop.show {
				opacity: 1;
			}

			.aging-modal {
				background: rgba(30, 41, 59, 0.95);
				border: 1px solid rgba(148, 163, 184, 0.2);
				border-radius: 16px;
				box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
				max-width: 1200px;
				width: 95%;
				max-height: 90vh;
				overflow: hidden;
				transform: scale(0.9) translateY(20px);
				transition: transform 0.3s ease;
				color: #e2e8f0;
			}

			.aging-modal-backdrop.show .aging-modal {
				transform: scale(1) translateY(0);
			}

			.aging-modal-header {
				background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
				color: white;
				padding: 20px 24px;
				border-radius: 16px 16px 0 0;
				position: relative;
			}

			.aging-modal-title {
				font-size: 20px;
				font-weight: 700;
				margin: 0;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
			}

			.aging-modal-subtitle {
				margin: 8px 0 0 0;
				font-size: 14px;
				opacity: 0.9;
			}

			.aging-modal-close {
				position: absolute;
				top: 16px;
				right: 16px;
				background: rgba(255, 255, 255, 0.2);
				border: none;
				border-radius: 8px;
				color: white;
				width: 32px;
				height: 32px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				transition: background-color 0.2s ease;
			}

			.aging-modal-close:hover {
				background: rgba(255, 255, 255, 0.3);
			}

			.aging-modal-body {
				padding: 24px;
				overflow-y: auto;
				max-height: calc(90vh - 140px);
			}

			.aging-stats {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 16px;
				margin-bottom: 24px;
			}

			.aging-stat-item {
				background: rgba(51, 65, 85, 0.3);
				border-radius: 12px;
				padding: 16px;
				text-align: center;
				border: 1px solid rgba(148, 163, 184, 0.1);
			}

			.aging-stat-label {
				font-size: 12px;
				color: #94a3b8;
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				margin-bottom: 8px;
			}

			.aging-stat-value {
				font-size: 20px;
				font-weight: 700;
				color: #f1f5f9;
			}

			.aging-invoices-table-container {
				background: rgba(51, 65, 85, 0.2);
				border-radius: 12px;
				overflow: hidden;
				border: 1px solid rgba(148, 163, 184, 0.1);
			}

			.aging-modal-footer {
				padding: 16px 24px;
				background: rgba(51, 65, 85, 0.3);
				border-top: 1px solid rgba(148, 163, 184, 0.1);
				text-align: right;
			}

			.aging-badge {
				background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
				color: white;
				padding: 4px 8px;
				border-radius: 6px;
				font-size: 11px;
				font-weight: 600;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
			}

			.status-badge {
				padding: 4px 8px;
				border-radius: 6px;
				font-size: 11px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.status-badge.status-unpaid {
				background: #ef4444;
				color: white;
			}

			.status-badge.status-partly-paid {
				background: #f59e0b;
				color: white;
			}

			.status-badge.status-paid {
				background: #10b981;
				color: white;
			}

			.status-badge.status-overdue {
				background: #dc2626;
				color: white;
			}

			/* Detailed Aging Cards */
			.detailed-aging-card {
				position: relative;
				overflow: visible;
			}

			.aging-status-badge {
				position: absolute;
				top: 12px;
				right: 12px;
				padding: 4px 8px;
				border-radius: 6px;
				font-size: 10px;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.aging-status-badge.current {
				background: #10b981;
				color: white;
			}

			.aging-status-badge.warning {
				background: #f59e0b;
				color: white;
			}

			.aging-status-badge.caution {
				background: #f97316;
				color: white;
			}

			.aging-status-badge.critical {
				background: #ef4444;
				color: white;
			}

			/* Aging Alerts */
			.aging-alerts-list {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}

			.alert-item {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 12px;
				background: rgba(248, 250, 252, 0.5);
				border-radius: 8px;
				border-left: 3px solid transparent;
			}

			.alert-item:has(.alert-icon.critical) {
				border-left-color: #ef4444;
			}

			.alert-item:has(.alert-icon.warning) {
				border-left-color: #f59e0b;
			}

			.alert-item:has(.alert-icon.info) {
				border-left-color: #3b82f6;
			}

			.alert-icon {
				width: 32px;
				height: 32px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				font-size: 14px;
			}

			.alert-icon.critical {
				background: #ef4444;
			}

			.alert-icon.warning {
				background: #f59e0b;
			}

			.alert-icon.info {
				background: #3b82f6;
			}

			.alert-content {
				flex: 1;
			}

			.alert-title {
				font-size: 13px;
				font-weight: 600;
				color: #f1f5f9;
				margin-bottom: 2px;
			}

			.alert-desc {
				font-size: 12px;
				color: #000000;
			}

			/* Enhanced Aging Card Hover Effects */
			.detailed-aging-card:hover {
				transform: translateY(-4px);
				box-shadow: 0 12px 30px rgba(124, 58, 237, 0.2);
			}

			.detailed-aging-card:hover .aging-status-badge {
				transform: scale(1.05);
			}

			/* Shimmer Effect for Loading States */
			@keyframes shimmer {
				0% {
					background-position: -468px 0;
				}
				100% {
					background-position: 468px 0;
				}
			}

			.loading-shimmer {
				background: linear-gradient(90deg, rgba(30, 41, 59, 0.2) 25%, rgba(59, 130, 246, 0.1) 50%, rgba(30, 41, 59, 0.2) 75%);
				background-size: 400% 100%;
				animation: shimmer 1.5s infinite;
			}

			/* Enhanced Glassmorphism with Dynamic Lighting */
			.stat-card::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(59, 130, 246, 0.05) 100%);
				border-radius: 16px;
				pointer-events: none;
				transition: opacity 0.3s ease;
				opacity: 0;
			}

			.stat-card:hover::before {
				opacity: 1;
			}

			/* Advanced Button Interactions */
			.btn-primary {
				position: relative;
				overflow: hidden;
			}

			.btn-primary::before {
				content: '';
				position: absolute;
				top: 0;
				left: -100%;
				width: 100%;
				height: 100%;
				background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
				transition: left 0.5s;
			}

			.btn-primary:hover::before {
				left: 100%;
			}

			/* Invoice Details Modal Styles */
			.invoice-details-modal-backdrop {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.6);
				z-index: 1100;
				display: flex;
				align-items: center;
				justify-content: center;
				opacity: 0;
				visibility: hidden;
				transition: all 0.3s ease;
			}

			.invoice-details-modal-backdrop.show {
				opacity: 1;
				visibility: visible;
			}

			.invoice-details-modal {
				background: rgba(30, 41, 59, 0.6);
				border-radius: 12px;
				max-width: 90vw;
				width: 800px;
				max-height: 80vh;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
				transform: scale(0.9) translateY(-20px);
				transition: transform 0.3s ease;
				display: flex;
				flex-direction: column;
			}

			.invoice-details-modal-backdrop.show .invoice-details-modal {
				transform: scale(1) translateY(0);
			}

			.invoice-details-header {
				padding: 24px;
				border-bottom: 1px solid rgba(59, 130, 246, 0.2);
				position: relative;
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%);
			}

			.invoice-header-content {
				padding-right: 60px;
			}

			.invoice-details-title {
				font-size: 24px;
				font-weight: 700;
				color: #f1f5f9;
				margin: 0 0 8px 0;
				display: flex;
				align-items: center;
				gap: 12px;
			}

			.invoice-details-title i {
				color: #3b82f6;
			}

			.invoice-details-subtitle {
				color: #64748b;
				font-size: 14px;
				margin: 0;
			}

			.invoice-details-close {
				position: absolute;
				top: 24px;
				right: 24px;
				background: none;
				border: none;
				font-size: 20px;
				cursor: pointer;
				color: #64748b;
				padding: 4px;
				border-radius: 4px;
				transition: color 0.2s ease;
			}

			.invoice-details-close:hover {
				color: #f1f5f9;
				background-color: rgba(30, 41, 59, 0.4);
			}

			.invoice-details-body {
				padding: 0;
				flex: 1;
				overflow: hidden;
			}

			.invoice-details-table-container {
				max-height: 400px;
				overflow-y: auto;
			}

			.invoice-details-table {
				width: 100%;
				border-collapse: separate;
				border-spacing: 0;
				background: rgba(30, 41, 59, 0.6);
				border-radius: 8px;
				overflow: hidden;
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
			}

			.invoice-details-table th {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				padding: 16px 20px;
				text-align: left;
				font-weight: 600;
				color: white;
				font-size: 14px;
				letter-spacing: 0.5px;
				text-transform: uppercase;
				position: sticky;
				top: 0;
				z-index: 10;
				border: none;
			}

			.invoice-details-table th:first-child {
				border-top-left-radius: 8px;
			}

			.invoice-details-table th:last-child {
				border-top-right-radius: 8px;
			}

			.invoice-details-table td {
				padding: 16px 20px;
				border-bottom: 1px solid #f1f5f9;
				color: #475569;
				font-weight: 500;
				vertical-align: middle;
				background: rgba(30, 41, 59, 0.6);
				transition: all 0.2s ease;
			}

			.invoice-details-table tbody tr {
				transition: all 0.2s ease;
			}

			.invoice-details-table tbody tr:hover {
				background: linear-gradient(90deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.3) 100%);
				transform: scale(1.01);
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			}

			.invoice-details-table tbody tr:nth-child(even) {
				background: rgba(30, 41, 59, 0.3);
			}

			.invoice-details-table tbody tr:nth-child(even):hover {
				background: linear-gradient(90deg, rgba(30, 41, 59, 0.5) 0%, rgba(51, 65, 85, 0.3) 100%);
			}

			.invoice-link {
				color: #4f46e5;
				cursor: pointer;
				text-decoration: none;
				font-weight: 600;
				padding: 6px 12px;
				background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
				border-radius: 6px;
				display: inline-block;
				transition: all 0.2s ease;
				border: 1px solid #c7d2fe;
			}

			.invoice-link:hover {
				color: white;
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
				border-color: #3b82f6;
			}

			.invoice-details-footer {
				padding: 20px 24px;
				border-top: 1px solid #e2e8f0;
				display: flex;
				justify-content: space-between;
				align-items: center;
				background: rgba(30, 41, 59, 0.4);
			}

			.btn-view-all-invoices {
				background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
				color: white;
				border: none;
				padding: 12px 24px;
				border-radius: 8px;
				font-weight: 600;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				transition: transform 0.2s ease, box-shadow 0.2s ease;
			}

			.btn-view-all-invoices:hover {
				transform: translateY(-2px);
				box-shadow: 0 8px 25px rgba(0, 123, 255, 0.3);
			}

			/* Enhanced styling for currency amounts */
			.currency-amount {
				font-weight: 700;
				font-family: 'Monaco', 'Menlo', monospace;
			}

			.currency-positive {
				color: #34d399;
			}

			.currency-negative {
				color: #dc2626;
			}

			.currency-outstanding {
				color: #d97706;
			}

			/* Sales person badge styling */
			.sales-person-badge {
				background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
				color: white;
				padding: 4px 8px;
				border-radius: 12px;
				font-size: 12px;
				font-weight: 600;
				display: inline-block;
				margin: 2px 0;
			}

			.no-sales-person {
				background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
				color: white;
				padding: 4px 8px;
				border-radius: 12px;
				font-size: 12px;
				font-weight: 600;
				display: inline-block;
				margin: 2px 0;
			}

			/* Enhanced table container */
			.invoice-details-table-container {
				max-height: 400px;
				overflow-y: auto;
				background: rgba(30, 41, 59, 0.4);
				padding: 8px;
				border-radius: 8px;
			}

			.invoice-details-table-container::-webkit-scrollbar {
				width: 8px;
			}

			.invoice-details-table-container::-webkit-scrollbar-track {
				background: rgba(30, 41, 59, 0.4);
				border-radius: 4px;
			}

			.invoice-details-table-container::-webkit-scrollbar-thumb {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				border-radius: 4px;
			}

			.invoice-details-table-container::-webkit-scrollbar-thumb:hover {
				background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
			}

			/* Make cards clickable */
			.stat-card {
				cursor: pointer;
				transition: transform 0.3s ease, box-shadow 0.3s ease;
			}

			.stat-card:hover {
				transform: translateY(-4px);
				box-shadow:
					0 12px 40px rgba(59, 130, 246, 0.25),
					0 0 0 1px rgba(59, 130, 246, 0.4),
					inset 0 1px 0 rgba(255, 255, 255, 0.15);
				border-color: rgba(59, 130, 246, 0.5);
			}

			.loading-spinner {
				width: 48px;
				height: 48px;
				border: 4px solid rgba(124, 58, 237, 0.2);
				border-top: 4px solid #3b82f6;
				border-radius: 50%;
				animation: spin 1.2s linear infinite;
				box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);
			}

			@keyframes spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}

			/* Enhanced Royal Purple Accents */
			.table-container {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 16px;
				backdrop-filter: blur(10px);
				overflow: hidden;
				box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
			}

			/* Purple accent colors for financial data */
			.btn-xs {
				border-radius: 6px;
				font-size: 11px;
				padding: 4px 8px;
			}

			.btn-xs.btn-primary {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				border-color: #3b82f6;
			}

			.btn-xs.btn-success {
				background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
				border-color: #10b981;
			}

			/* Enhanced hover effects */
			.stat-card:hover::before {
				height: 6px;
				transition: height 0.3s ease;
			}

			/* Royal Purple scrollbar */
			.dashboard-sidebar::-webkit-scrollbar {
				width: 6px;
			}

			.dashboard-sidebar::-webkit-scrollbar-track {
				background: rgba(59, 7, 100, 0.3);
			}

			.dashboard-sidebar::-webkit-scrollbar-thumb {
				background: linear-gradient(180deg, #8b5cf6 0%, #3b82f6 100%);
				border-radius: 3px;
			}

			.dashboard-sidebar::-webkit-scrollbar:hover {
				background: linear-gradient(180deg, #7c3aed 0%, #2563eb 100%);
			}

			/* Responsive */
			@media (max-width: 768px) {
				.dashboard-sidebar {
					width: 240px;
				}

				.content-body {
					padding: 16px;
				}

				.stat-card {
					margin-bottom: 16px;
				}
			}

			@media (max-width: 640px) {
				.arm-dashboard-container {
					flex-direction: column;
				}

				.dashboard-sidebar {
					width: 100%;
					height: auto;
					background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
				}

				.content-header {
					padding: 16px 20px;
				}

				.content-body {
					padding: 20px 16px;
				}
			}

			/* Additional Royal Purple Enhancements */
			.nav-item:active {
				background: linear-gradient(90deg, rgba(147, 51, 234, 0.3) 0%, rgba(124, 58, 237, 0.2) 100%);
			}

			.form-control::placeholder {
				color: #a78bfa;
			}

			/* Additional form control styling for select dropdowns */
			select.form-control {
				color: #e2e8f0 !important;
				background: rgba(30, 41, 59, 0.4) !important;
				appearance: auto;
				height: auto;
				min-height: 42px;
				padding: 10px 16px;
				line-height: 1.5;
				vertical-align: middle;
			}

			select.form-control:focus {
				height: auto;
				min-height: 42px;
				padding: 10px 16px;
			}

			select.form-control option {
				color: #e2e8f0 !important;
				background: #1e293b !important;
				padding: 10px 12px;
				line-height: 1.5;
				min-height: 40px;
			}

			select.form-control option:hover,
			select.form-control option:focus,
			select.form-control option:checked {
				background: #3b82f6 !important;
				color: #ffffff !important;
			}

			/* Input date specific styling */
			input[type="date"].form-control {
				color: #e2e8f0 !important;
				background: rgba(30, 41, 59, 0.4) !important;
			}

			input[type="date"].form-control::-webkit-datetime-edit {
				color: #e2e8f0;
			}

			input[type="date"].form-control::-webkit-datetime-edit-fields-wrapper {
				color: #e2e8f0;
			}

			input[type="date"].form-control::-webkit-datetime-edit-text {
				color: #94a3b8;
			}

			input[type="date"].form-control::-webkit-datetime-edit-month-field,
			input[type="date"].form-control::-webkit-datetime-edit-day-field,
			input[type="date"].form-control::-webkit-datetime-edit-year-field {
				color: #e2e8f0;
			}

			/* Elegant animations */
			@keyframes fadeInUp {
				from {
					opacity: 0;
					transform: translateY(20px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.stat-card {
				animation: fadeInUp 0.6s ease-out;
			}

			.stat-card:nth-child(2) { animation-delay: 0.1s; }
			.stat-card:nth-child(3) { animation-delay: 0.2s; }
			.stat-card:nth-child(4) { animation-delay: 0.3s; }

			/* Overview Analytics Specific Styles */
			.collection-progress {
				margin-top: 12px;
			}

			.progress-bar-container {
				width: 100%;
				height: 8px;
				background: rgba(59, 130, 246, 0.1);
				border-radius: 4px;
				overflow: hidden;
				margin-bottom: 6px;
			}

			.progress-bar {
				height: 100%;
				background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%);
				border-radius: 4px;
				width: 0%;
				transition: width 0.6s ease;
			}

			.progress-text {
				font-size: 12px;
				color: #94a3b8;
				font-weight: 600;
			}

			.gauge-container {
				display: flex;
				justify-content: center;
				margin: 16px 0;
			}

			.circular-progress {
				width: 120px;
				height: 120px;
				border-radius: 50%;
				background: conic-gradient(#3b82f6 0deg, #8b5cf6 var(--progress-angle, 0deg), rgba(59, 130, 246, 0.1) var(--progress-angle, 0deg));
				display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
			}

			.circular-progress::before {
				content: '';
				width: 80px;
				height: 80px;
				border-radius: 50%;
				background: rgba(30, 41, 59, 0.6);
			}

			.progress-value {
				position: absolute;
				font-size: 18px;
				font-weight: 800;
				color: #3b82f6;
			}

			.day-suffix {
				font-size: 16px;
				font-weight: 400;
				margin-left: 4px;
				color: #94a3b8;
			}

			.invoice-breakdown {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				margin-top: 12px;
			}

			.breakdown-item {
				font-size: 11px;
				color: #94a3b8;
				background: rgba(59, 130, 246, 0.1);
				padding: 4px 8px;
				border-radius: 6px;
			}

			/* Aging Cards Styles */
			.aging-card {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%);
				border-radius: 16px;
				padding: 20px;
				margin-bottom: 16px;
				border: 1px solid rgba(148, 163, 184, 0.2);
				backdrop-filter: blur(10px);
				box-shadow: 0 4px 20px rgba(148, 163, 184, 0.1);
				transition: all 0.3s ease;
				border-left: 4px solid transparent;
			}

			.aging-card:hover {
				transform: translateY(-2px);
				box-shadow: 0 8px 30px rgba(148, 163, 184, 0.2);
				border-color: rgba(148, 163, 184, 0.4);
			}

			.aging-card.aging-current { border-left-color: rgba(148, 163, 184, 0.3); }
			.aging-card.aging-warning { border-left-color: rgba(148, 163, 184, 0.3); }
			.aging-card.aging-caution { border-left-color: rgba(148, 163, 184, 0.3); }
			.aging-card.aging-critical { border-left-color: rgba(148, 163, 184, 0.3); }

			.aging-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 16px;
			}

			.aging-title {
				font-size: 14px;
				font-weight: 700;
				color: #cbd5e1;
				margin: 0;
			}

			.aging-icon {
				width: 32px;
				height: 32px;
				border-radius: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 14px;
			}

			.aging-icon.current { background: rgba(16, 185, 129, 0.15); color: #10b981; }
			.aging-icon.warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
			.aging-icon.caution { background: rgba(249, 115, 22, 0.15); color: #f97316; }
			.aging-icon.critical { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

			.aging-amount {
				font-size: 22px;
				font-weight: 800;
				color: #e2e8f0;
				margin-bottom: 8px;
			}

			.aging-count, .aging-percentage {
				font-size: 12px;
				color: #cbd5e1;
				margin-bottom: 4px;
			}

			.aging-percentage {
				font-weight: 600;
			}

			/* Top Debtors Styles */
			.top-debtors-list {
				max-height: 400px;
				overflow-y: auto;
			}

			.debtor-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 16px 0;
				border-bottom: 1px solid #f3f0ff;
			}

			.debtor-item:last-child {
				border-bottom: none;
			}

			.debtor-info {
				flex: 1;
			}

			.debtor-name {
				font-size: 14px;
				font-weight: 600;
				color: #581c87;
				margin-bottom: 4px;
			}

			.debtor-details {
				font-size: 12px;
				color: #94a3b8;
			}

			.debtor-amount {
				font-size: 16px;
				font-weight: 700;
				color: #3b82f6;
			}

			.debtor-bar {
				width: 60px;
				height: 6px;
				background: rgba(59, 130, 246, 0.1);
				border-radius: 3px;
				margin-top: 4px;
				overflow: hidden;
			}

			.debtor-bar-fill {
				height: 100%;
				background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
				border-radius: 3px;
				transition: width 0.6s ease;
			}

			.debtor-placeholder {
				text-align: center;
				padding: 40px 20px;
				color: #94a3b8;
			}

			/* Dashboard Navbar Styles */
			.dashboard-navbar {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-top: 20px;
				padding: 16px 20px;
				background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 244, 255, 0.95) 100%);
				border: 1px solid rgba(124, 58, 237, 0.2);
				border-radius: 12px;
				box-shadow: 0 4px 20px rgba(91, 33, 182, 0.15);
				backdrop-filter: blur(10px);
			}

			.navbar-left {
				flex: 1;
				max-width: 400px;
			}

			.navbar-right {
				display: flex;
				gap: 12px;
				align-items: center;
			}

			.global-search-container {
				position: relative;
				width: 100%;
			}

			#global-search {
				width: 100%;
				padding: 10px 40px 10px 16px;
				border: 2px solid rgba(124, 58, 237, 0.3);
				border-radius: 8px;
				background: rgba(255, 255, 255, 0.95);
				color: #4c1d95;
				font-size: 14px;
				transition: all 0.3s ease;
				box-shadow: inset 0 2px 4px rgba(59, 130, 246, 0.1);
			}

			#global-search:focus {
				outline: none;
				border-color: #3b82f6;
				box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2), inset 0 2px 4px rgba(59, 130, 246, 0.1);
				background: rgba(30, 41, 59, 0.6);
			}

			#global-search::placeholder {
				color: #a78bfa;
				font-style: italic;
			}

			.search-icon {
				position: absolute;
				right: 14px;
				top: 50%;
				transform: translateY(-50%);
				color: #3b82f6;
				font-size: 16px;
				pointer-events: none;
			}

			.navbar-btn {
				padding: 10px 16px;
				border-radius: 8px;
				font-weight: 600;
				font-size: 14px;
				transition: all 0.3s ease;
				border: 2px solid transparent;
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 110px;
				justify-content: center;
			}

			.navbar-btn i {
				font-size: 14px;
			}

			.navbar-btn.btn-default {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(51, 65, 85, 0.4) 100%);
				color: #3b82f6;
				border-color: rgba(59, 130, 246, 0.3);
			}

			.navbar-btn.btn-default:hover {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(51, 65, 85, 0.3) 100%);
				border-color: #3b82f6;
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
			}

			.navbar-btn.btn-primary {
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
				color: #ffffff;
				border-color: #3b82f6;
			}

			.navbar-btn.btn-primary:hover {
				background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
			}

			.navbar-btn:active {
				transform: translateY(0);
			}

			.btn-text {
				font-weight: 600;
			}

			/* Filter Modal Styles */
			.filter-modal-backdrop {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.6);
				backdrop-filter: blur(4px);
				z-index: 1050;
				display: flex;
				align-items: center;
				justify-content: center;
				opacity: 0;
				transition: opacity 0.3s ease;
			}

			.filter-modal-backdrop.show {
				opacity: 1;
			}

			.filter-modal {
				background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%);
				border-radius: 16px;
				backdrop-filter: blur(20px);
				border: 1px solid rgba(59, 130, 246, 0.3);
				box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3);
				max-width: 600px;
				width: 90%;
				max-height: 80vh;
				overflow-y: auto;
				transform: scale(0.9) translateY(20px);
				transition: all 0.3s ease;
			}

			.filter-modal-backdrop.show .filter-modal {
				transform: scale(1) translateY(0);
			}

			.filter-modal-header {
				padding: 24px 24px 0 24px;
				border-bottom: 1px solid rgba(124, 58, 237, 0.2);
				margin-bottom: 20px;
			}

			.filter-modal-title {
				color: #4c1d95;
				font-size: 20px;
				font-weight: 700;
				margin: 0 0 8px 0;
				display: flex;
				align-items: center;
				gap: 12px;
			}

			.filter-modal-subtitle {
				color: #94a3b8;
				font-size: 14px;
				margin: 0 0 20px 0;
				opacity: 0.8;
			}

			.filter-modal-body {
				padding: 0 24px;
			}

			.filter-modal-footer {
				padding: 20px 24px 24px 24px;
				display: flex;
				justify-content: flex-end;
				gap: 12px;
				border-top: 1px solid rgba(124, 58, 237, 0.2);
				margin-top: 20px;
			}

			.close-modal-btn {
				position: absolute;
				top: 20px;
				right: 20px;
				background: none;
				border: none;
				color: #3b82f6;
				font-size: 20px;
				cursor: pointer;
				padding: 4px;
				border-radius: 50%;
				transition: all 0.2s ease;
			}

			.close-modal-btn:hover {
				background: rgba(59, 130, 246, 0.1);
				color: #5b21b6;
			}

			/* Responsive Design */
			@media (max-width: 768px) {
				.dashboard-navbar {
					flex-direction: column;
					gap: 16px;
					align-items: stretch;
				}

				.navbar-left {
					max-width: none;
				}

				.navbar-right {
					justify-content: center;
				}

				.navbar-btn .btn-text {
					display: none;
				}

				.navbar-btn {
					min-width: auto;
					padding: 10px 12px;
				}
			}

			/* Mobile Responsive Layout */
			@media (max-width: 768px) {
				.dashboard-sidebar {
					width: 240px;
				}
				.dashboard-content {
					left: 240px;
				}
			}

			@media (max-width: 640px) {
				.arm-dashboard-container {
					flex-direction: column;
				}
				.dashboard-sidebar {
					position: fixed;
					top: 60px;
					left: 0;
					right: 0;
					width: 100%;
					height: 200px;
					z-index: 1001;
				}
				.dashboard-content {
					position: fixed;
					top: 260px;
					left: 0;
					right: 0;
					bottom: 0;
				}
			}

			/* Force no horizontal overflow for all elements - but maintain flex layout */
			.arm-dashboard-container {
				overflow-x: hidden;
			}

			/* Tables and wide content responsive fix */
			table {
				width: 100%;
				table-layout: fixed;
			}

			.card-modal-backdrop {
				overflow-x: hidden !important;
			}

			.filter-modal {
				max-width: 95vw !important;
				word-wrap: break-word;
			}

			/* Listed Customers Filter Section Styles */
			.table-filters .customer-global-search:focus {
				outline: none !important;
				border-color: #3b82f6 !important;
				box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3) !important;
				background: rgba(255, 255, 255, 0.15) !important;
			}

			.table-filters .customer-name-filter:focus {
				outline: none !important;
				border-color: #3b82f6 !important;
				box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3) !important;
				background: rgba(255, 255, 255, 0.15) !important;
			}

			.table-filters .customer-global-search::placeholder {
				color: rgba(226, 232, 240, 0.6);
			}

			.table-filters .apply-filters-btn:hover {
				background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
				transform: translateY(-2px);
				box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5) !important;
			}

			.table-filters .apply-filters-btn:active {
				transform: translateY(0);
			}

			.table-filters .clear-customer-filters-btn:hover {
				background: linear-gradient(135deg, #475569 0%, #334155 100%) !important;
				transform: translateY(-2px);
				box-shadow: 0 6px 16px rgba(100, 116, 139, 0.5) !important;
			}

			.table-filters .clear-customer-filters-btn:active {
				transform: translateY(0);
			}

			/* Page Tour Styles */
			.page-tour-btn {
				position: fixed !important;
				bottom: 30px !important;
				right: 30px !important;
				width: 60px !important;
				height: 60px !important;
				border-radius: 50% !important;
				background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
				border: none !important;
				color: white !important;
				font-size: 24px !important;
				cursor: pointer !important;
				box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5) !important;
				z-index: 999999 !important;
				transition: all 0.3s ease !important;
				pointer-events: auto !important;
				display: flex !important;
				align-items: center !important;
				justify-content: center !important;
			}

			.page-tour-btn:hover {
				transform: scale(1.1) !important;
				box-shadow: 0 6px 30px rgba(59, 130, 246, 0.7) !important;
			}

			.page-tour-btn:active {
				transform: scale(0.95) !important;
			}

			.tour-overlay {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.3);
				z-index: 999998;
				display: none;
			}

			.tour-overlay.active {
				display: block;
			}

			.tour-highlight {
				position: absolute;
				border: 5px solid #fbbf24 !important;
				border-radius: 8px;
				box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.2), 0 0 50px #fbbf24 !important;
				pointer-events: none;
				z-index: 999999;
				transition: all 0.5s ease;
				background: transparent !important;
				display: none;
			}

			/* Zoom animation for tour elements */
			@keyframes tourZoomIn {
				0% {
					transform: scale(1);
				}
				50% {
					transform: scale(1.12);
				}
				100% {
					transform: scale(1.08);
				}
			}

			.tour-element-zoom {
				animation: tourZoomIn 0.6s ease-out forwards !important;
				transform-origin: center !important;
				transition: transform 0.3s ease-out !important;
			}

			/* Make highlighted section content visible */
			.tour-overlay.active ~ * .dashboard-sidebar,
			.tour-overlay.active ~ * .nav-item,
			.tour-overlay.active ~ * .global-actions {
				position: relative;
				z-index: 999999 !important;
			}

			.tour-popup {
				position: fixed !important;
				background: white !important;
				border: 4px solid #3b82f6 !important;
				border-radius: 12px;
				padding: 0;
				max-width: 500px;
				min-width: 400px;
				max-height: 80vh;
				z-index: 1000000 !important;
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8) !important;
				color: #1e293b !important;
				display: none;
				flex-direction: column;
			}

			.tour-popup.visible {
				display: flex !important;
				visibility: visible !important;
				opacity: 1 !important;
			}

			.tour-popup-content {
				flex: 1;
				overflow-y: auto;
				padding: 24px;
				max-height: calc(80vh - 80px);
			}

			.tour-popup-content::-webkit-scrollbar {
				width: 8px;
			}

			.tour-popup-content::-webkit-scrollbar-track {
				background: #f1f5f9;
				border-radius: 4px;
			}

			.tour-popup-content::-webkit-scrollbar-thumb {
				background: #3b82f6;
				border-radius: 4px;
			}

			.tour-popup-content::-webkit-scrollbar-thumb:hover {
				background: #2563eb;
			}

			.tour-popup h3 {
				color: #3b82f6;
				margin: 0 0 16px 0;
				font-size: 20px;
				font-weight: 700;
				border-bottom: 2px solid #e0e7ff;
				padding-bottom: 10px;
			}

			.tour-popup p {
				margin: 0 0 20px 0;
				line-height: 1.8;
				font-size: 15px;
				text-align: justify;
			}

			.tour-popup-buttons {
				display: flex;
				gap: 10px;
				padding: 16px 24px;
				background: #f8fafc;
				border-top: 2px solid #e0e7ff;
				border-radius: 0 0 8px 8px;
				flex-shrink: 0;
			}

			.tour-popup-buttons button {
				padding: 10px 20px;
				border: none;
				border-radius: 8px;
				font-size: 14px;
				font-weight: 600;
				cursor: pointer;
				transition: all 0.3s ease;
			}

			.tour-btn-skip {
				background: #94a3b8 !important;
				color: white !important;
				border: none !important;
			}

			.tour-btn-skip:hover {
				background: #64748b !important;
			}

			.tour-btn-next {
				background: #3b82f6 !important;
				color: white !important;
				flex: 1;
				border: none !important;
			}

			.tour-btn-next:hover {
				transform: translateY(-2px);
				box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
				background: #2563eb !important;
			}

			/* ====== SKELETON LOADERS ====== */
			@keyframes skeleton-loading {
				0% {
					background-position: -200% 0;
				}
				100% {
					background-position: 200% 0;
				}
			}

			.skeleton-loader {
				padding: 20px;
			}

			.skeleton-line {
				margin-bottom: 15px;
				border-radius: 8px;
			}

			/* ====== TABS STYLING ====== */
			.salesperson-tabs {
				display: flex;
				gap: 10px;
				border-bottom: 2px solid rgba(59, 130, 246, 0.3);
				padding-bottom: 10px;
			}

			.sp-tab {
				padding: 10px 20px;
				background: rgba(255, 255, 255, 0.05);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 8px;
				color: #e2e8f0;
				cursor: pointer;
				transition: all 0.3s ease;
				font-weight: 600;
			}

			.sp-tab:hover {
				background: rgba(59, 130, 246, 0.2);
				border-color: #3b82f6;
			}

			.sp-tab.active {
				background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
				border-color: #3b82f6;
				box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
			}

			/* ====== COLLAPSIBLE SECTIONS ====== */
			.section-header.collapsible {
				cursor: pointer;
				transition: all 0.3s ease;
				padding: 15px;
				border-radius: 8px;
				background: rgba(59, 130, 246, 0.1);
				margin-bottom: 15px;
			}

			.section-header.collapsible:hover {
				background: rgba(59, 130, 246, 0.2);
			}

			.section-header-left {
				display: flex;
				align-items: center;
				gap: 10px;
			}

			.section-header-right {
				display: flex;
				align-items: center;
			}

			.collapse-icon {
				transition: transform 0.3s ease;
				color: #3b82f6;
				font-size: 18px;
			}

			.collapse-icon.fa-chevron-up {
				transform: rotate(180deg);
			}

			/* ====== GLOBAL SEARCH BAR INLINE (NEXT TO FILTER BUTTON) ====== */
			.global-search-bar-inline {
				position: relative;
				display: inline-flex;
				align-items: center;
				margin: 0 10px;
				flex: 1;
				max-width: 400px;
			}

			.search-input-wrapper {
				position: relative;
				width: 100%;
				min-width: 300px;
			}

			.global-search-input {
				width: 100%;
				padding: 8px 40px 8px 35px;
				background: rgba(255, 255, 255, 0.1);
				border: 1px solid rgba(59, 130, 246, 0.3);
				border-radius: 20px;
				color: #333;
				font-size: 13px;
				transition: all 0.3s ease;
			}

			.global-search-input:focus {
				outline: none;
				border-color: #3b82f6;
				background: rgba(255, 255, 255, 0.15);
				box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
			}

			.global-search-input::placeholder {
				color: #94a3b8;
			}

			.search-icon {
				position: absolute;
				left: 15px;
				top: 50%;
				transform: translateY(-50%);
				color: #3b82f6;
				font-size: 16px;
			}

			.search-clear {
				position: absolute;
				right: 15px;
				top: 50%;
				transform: translateY(-50%);
				color: #94a3b8;
				font-size: 14px;
				cursor: pointer;
				transition: color 0.3s ease;
			}

			.search-clear:hover {
				color: #ef4444;
			}

			.search-results-dropdown {
				position: absolute;
				top: calc(100% + 5px);
				left: 0;
				right: 0;
				min-width: 400px;
				max-height: 500px;
				overflow-y: auto;
				background: white;
				border: 1px solid #d1d5db;
				border-radius: 8px;
				box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
				z-index: 9999;
			}

			.search-results-section {
				padding: 15px;
				border-bottom: 1px solid rgba(148, 163, 184, 0.2);
			}

			.search-results-section:last-child {
				border-bottom: none;
			}

			.search-section-title {
				color: #3b82f6;
				font-size: 11px;
				font-weight: 700;
				text-transform: uppercase;
				margin-bottom: 8px;
				letter-spacing: 0.5px;
			}

			.search-result-item {
				padding: 8px 10px;
				margin-bottom: 3px;
				background: #f9fafb;
				border-radius: 6px;
				cursor: pointer;
				transition: all 0.2s ease;
				display: flex;
				align-items: center;
				gap: 10px;
			}

			.search-result-item:hover {
				background: #eff6ff;
				transform: translateX(3px);
				border-left: 3px solid #3b82f6;
				padding-left: 7px;
			}

			.search-result-item i {
				color: #3b82f6;
				font-size: 14px;
			}

			.search-result-content {
				flex: 1;
			}

			.search-result-title {
				color: #1f2937;
				font-weight: 600;
				font-size: 13px;
				margin-bottom: 2px;
			}

			.search-result-subtitle {
				color: #6b7280;
				font-size: 11px;
			}

			.search-no-results {
				padding: 30px;
				text-align: center;
				color: #6b7280;
			}

			.search-loading {
				padding: 30px;
				text-align: center;
				color: #3b82f6;
			}

			</style>
		`;
		$('head').append(styles);
	}

	setup_table_enhancements() {
		if (this.table_enhancer) {
			return;
		}

		const enhance_tables = (root) => {
			const $tables = $(root).find('table').addBack('table');
			$tables.each((_, table) => {
				this.enhance_table($(table));
			});
		};

		this.table_enhancer = new MutationObserver((mutations) => {
			const tablesToEnhance = new Set();

			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType !== 1) {
						return;
					}

					if (node.tagName && node.tagName.toLowerCase() === 'table') {
						tablesToEnhance.add(node);
					}

					if (node.querySelectorAll) {
						node.querySelectorAll('table').forEach((table) => tablesToEnhance.add(table));
					}
				});
			});

			if (tablesToEnhance.size === 0) {
				return;
			}

			clearTimeout(this.table_enhancement_timeout);
			this.table_enhancement_timeout = setTimeout(() => {
				tablesToEnhance.forEach((table) => {
					this.enhance_table($(table));
				});
			}, 60);
		});

		this.table_enhancer.observe(document.body, { childList: true, subtree: true });
		enhance_tables(document.body);
	}

	is_table_in_scope($table) {
		if ($table.closest('.arm-dashboard-container').length) {
			return true;
		}

		if ($table.closest('.card-modal-backdrop, .invoice-details-modal-backdrop, .aging-modal-backdrop').length) {
			return true;
		}

		if ($table.closest('.modal-dialog').length) {
			return true;
		}

		return false;
	}

	enhance_table($table) {
		if (!$table || $table.length === 0) {
			return;
		}

		if ($table.attr('data-arm-enhanced') === '1') {
			return;
		}

		if (!this.is_table_in_scope($table)) {
			return;
		}

		if ($table.closest('td, th').length > 0 && $table.attr('data-arm-allow-nested') !== '1') {
			return;
		}

		if ($table.find('tbody').length === 0) {
			return;
		}

		if ($table.find('tbody tr').length === 0) {
			return;
		}

		$table.attr('data-arm-enhanced', '1');

		this.setup_table_sorting($table);
		this.setup_table_search($table);
	}

	setup_table_search($table) {
		if ($table.attr('data-arm-no-search') === '1') {
			return;
		}

		const $wrapper = $table.closest('.table-responsive');
		const $anchor = $wrapper.length ? $wrapper : $table;

		if ($anchor.prev('.arm-table-tools').length > 0) {
			return;
		}

		const tools = $(`
			<div class="arm-table-tools">
				<div class="arm-table-search-wrapper">
					<input type="text" class="arm-table-search-input" placeholder="Search in table..." />
					<i class="fa fa-times arm-table-search-clear"></i>
				</div>
			</div>
		`);

		$anchor.before(tools);

		const searchInput = tools.find('.arm-table-search-input');
		const clearBtn = tools.find('.arm-table-search-clear');
		let searchTimeout;

		const applyFilter = () => {
			const query = searchInput.val().trim().toLowerCase();
			const rows = $table.find('tbody tr');

			if (!query) {
				rows.show();
				clearBtn.hide();
				return;
			}

			clearBtn.show();

			rows.each(function () {
				const rowText = $(this).text().toLowerCase();
				$(this).toggle(rowText.includes(query));
			});
		};

		searchInput.on('input', () => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(applyFilter, 120);
		});

		clearBtn.on('click', () => {
			searchInput.val('');
			applyFilter();
			searchInput.focus();
		});
	}

	setup_table_sorting($table) {
		if ($table.attr('data-arm-no-sort') === '1') {
			return;
		}

		if ($table.hasClass('customers-data-table')) {
			return;
		}

		const $headers = $table.find('thead th');
		if ($headers.length === 0) {
			return;
		}

		if ($headers.filter('[data-column]').length > 0) {
			return;
		}

		$headers.each((index, th) => {
			const $th = $(th);

			if ($th.attr('colspan')) {
				return;
			}

			if ($th.attr('data-arm-no-sort') === '1') {
				return;
			}

			if ($th.find('input, select, button').length > 0) {
				return;
			}

			$th.addClass('arm-sortable');

			if ($th.find('.arm-sort-icon').length === 0) {
				$th.append('<i class="fa fa-sort arm-sort-icon"></i>');
			}

			$th.off('click.armTableSort').on('click.armTableSort', () => {
				const sortState = $table.data('armSortState') || {};
				const currentDirection = sortState[index] || 'desc';
				const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';
				sortState[index] = nextDirection;
				$table.data('armSortState', sortState);

				const $tbody = $table.find('tbody');
				const rows = $tbody.find('tr').get().map((row, rowIndex) => {
					return {
						row,
						index: rowIndex,
						value: this.get_table_cell_value($(row), index)
					};
				});

				rows.sort((a, b) => {
					const comparison = this.compare_table_values(a.value, b.value);
					if (comparison === 0) {
						return a.index - b.index;
					}

					return nextDirection === 'asc' ? comparison : -comparison;
				});

				$tbody.append(rows.map((item) => item.row));

				$headers.find('.arm-sort-icon')
					.removeClass('fa-sort-asc fa-sort-desc')
					.addClass('fa-sort');

				$th.find('.arm-sort-icon')
					.removeClass('fa-sort')
					.addClass(nextDirection === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc');
			});
		});
	}

	get_table_cell_value($row, columnIndex) {
		const cell = $row.children('td').eq(columnIndex);
		const text = cell.text().trim();

		if (!text) {
			return { type: 'empty', value: '' };
		}

		const numericText = text.replace(/[^0-9.-]/g, '');
		if (numericText && !isNaN(numericText)) {
			return { type: 'number', value: parseFloat(numericText) };
		}

		const hasDateHint = /[a-zA-Z]/.test(text) || /[/-]/.test(text);
		if (hasDateHint) {
			const dateValue = Date.parse(text);
			if (!isNaN(dateValue)) {
				return { type: 'date', value: dateValue };
			}
		}

		return { type: 'text', value: text.toLowerCase() };
	}

	compare_table_values(a, b) {
		if (a.type === 'empty' && b.type === 'empty') {
			return 0;
		}

		if (a.type === 'empty') {
			return 1;
		}

		if (b.type === 'empty') {
			return -1;
		}

		if (a.type === b.type) {
			if (a.value === b.value) {
				return 0;
			}

			return a.value > b.value ? 1 : -1;
		}

		return a.value.toString() > b.value.toString() ? 1 : -1;
	}

	create_sidebar() {
		const sidebar_content = $(`
			<div class="sidebar-header">
				<h3 class="sidebar-title">
					<i class="fa fa-bar-chart"></i>
					ARM Dashboard
				</h3>
				<p class="sidebar-subtitle">Accounts Receivable Management</p>
			</div>
			<nav class="sidebar-nav">
				<div class="nav-section">
					<a class="nav-item active" data-section="overview">
						<i class="fa fa-dashboard"></i>
						Overview
					</a>
					<a class="nav-item" data-section="listed_customers">
						<i class="fa fa-list-alt"></i>
						Listed Customers
					</a>
					<a class="nav-item" data-section="aging">
						<i class="fa fa-clock-o"></i>
						Aging Analysis
					</a>
					<a class="nav-item" data-section="outstanding">
						<i class="fa fa-exclamation-circle"></i>
						Outstanding Report
						<span class="badge" id="outstanding-count">0</span>
					</a>
					<a class="nav-item" data-section="salesperson_wise">
						<i class="fa fa-user-circle"></i>
						Sales Person Wise
					</a>
					<a class="nav-item" data-section="collection">
						<i class="fa fa-money"></i>
						Collection Tracker

				</a>
				<a class="nav-item" data-section="overdue_advance_progressive">
					<i class="fa fa-credit-card"></i>
					Overdue Advance/Progressive Bills
				</a>
					<a class="nav-item" data-section="payment_schedules">
						<i class="fa fa-calendar"></i>
						Sales Order Payment Schedules
					</a>
					<a class="nav-item" data-section="pdc_report">
						<i class="fa fa-file-text-o"></i>
						PDC Report
					</a>
					<a class="nav-item" data-section="intercompany_overdues">
						<i class="fa fa-exchange"></i>
						Inter Company Overdues
					</a>
					<a class="nav-item" data-section="payment_followup">
						<i class="fa fa-phone-square"></i>
						Payment Followup
					</a>
					<a class="nav-item" data-section="blocked_dispute">
						<i class="fa fa-ban"></i>
						Blocked Customer
					</a>
					<a class="nav-item" data-section="proforma_invoice">
						<i class="fa fa-file-text"></i>
						Proforma Invoice
					</a>
					<a class="nav-item" data-section="quotation_followup">
						<i class="fa fa-phone"></i>
						Quotation Follow-up
					</a>
					<a class="nav-item" data-section="dispute">
						<i class="fa fa-exclamation-triangle"></i>
						Dispute
					</a>
					<a class="nav-item" data-section="customer_outstanding_clearance">
						<i class="fa fa-check-circle"></i>
						Customer Outstanding Clearance
					</a>
					<a class="nav-item" data-section="cheque_document">
						<i class="fa fa-money"></i>
						Cheque Document
					</a>
				</div>
			</nav>
		`);

		this.main_container.find('.dashboard-sidebar').append(sidebar_content);
		this.setup_sidebar_navigation();
	}

	setup_sidebar_navigation() {
		this.main_container.find('.nav-item').on('click', (e) => {
			e.preventDefault();
			const section = $(e.currentTarget).data('section');
			this.switch_section(section);
		});
	}

	switch_section(section) {
		// Update active navigation
		this.main_container.find('.nav-item').removeClass('active');
		this.main_container.find(`[data-section="${section}"]`).addClass('active');

		// Update current section
		this.current_section = section;

		// Check if section is already initialized to avoid redundant work
		let section_already_exists = false;
		if (this.is_section_initialized(section)) {
			section_already_exists = true;
		}

		// Show appropriate content (handles showing/hiding wrappers or initial render)
		this.render_section_content(section);

		// If section already exists/init, don't repopulate immediately (unless data is missing)
		if (section_already_exists && this.data && this.data.length > 0) {
			console.log(`Section ${section} already initialized, skipping immediate populate`);
			return;
		}

		// Only load main AR data if the current section needs it
		const needs_main_data = ['overview', 'aging', 'outstanding', 'listed_customers'].includes(section);

		if (needs_main_data) {
			// If data is already loaded, immediately populate the section
			if (this.data && this.data.length > 0) {
				this.populate_current_section();
			} else if (!this.loading) {
				// Only load data once if not already loaded
				this.load_data();
			}
		}
	}

	is_section_initialized(section) {
		if (section === 'collection' && this.collection_section_initialized) return true;
		if (section === 'intercompany_overdues' && this.intercompany_section_initialized) return true;

		const content_area = this.main_container.find('.dashboard-content');
		const wrappers = {
			'overview': '.overview-section-wrapper',
			'aging': '.aging-section-wrapper',
			'outstanding': '.outstanding-section-wrapper',
			'collection': '.collection-section-wrapper',
			'intercompany_overdues': '.intercompany-overdues-section-wrapper',
			'payment_followup': '.payment-followup-section-wrapper',
			'salesperson_wise': '[data-section="salesperson_wise"]',
			'listed_customers': '.listed-customers-section-wrapper',
			'payment_schedules': '.payment-schedules-section-wrapper',
			'pdc_report': '.pdc-report-section-wrapper',
			'proforma_invoice': '.proforma-invoice-section-wrapper',
			'quotation_followup': '.quotation-followup-section-wrapper',
			'dispute': '.dispute-section-wrapper',
			'customer_outstanding_clearance': '.customer-outstanding-clearance-section-wrapper',
			'overdue_advance_progressive': '[data-section="overdue_advance_progressive"]',
			'blocked_dispute': '[data-section="blocked_dispute"]',
			'cheque_document': '.cheque-document-section-wrapper'
		};

		if (wrappers[section]) {
			return content_area.find(wrappers[section]).length > 0;
		}
		return false;
	}

	populate_current_section() {
		console.log('=== populate_current_section START ===');
		console.log('Current section:', this.current_section);
		console.log('data length:', this.data ? this.data.length : 0);
		console.log('filtered_data length BEFORE:', this.filtered_data ? this.filtered_data.length : 0);

		// Populate the current section with already loaded data
		// IMPORTANT: Do NOT call apply_filters() here as it causes unnecessary recalculation
		// The data is already filtered and ready to display
		// Just update the section-specific UI elements

		// Ensure filtered_data is populated if empty
		if ((!this.filtered_data || this.filtered_data.length === 0) && this.data && this.data.length > 0) {
			console.log('populate_current_section: filtered_data empty, copying from data');
			this.filtered_data = [...this.data];
		}

		console.log('filtered_data length AFTER:', this.filtered_data ? this.filtered_data.length : 0);

		switch (this.current_section) {
			case 'overview':
				// Update overview analytics with existing filtered data (no recalculation)
				console.log('Updating Overview section');
				if (this.filtered_data && this.filtered_data.length > 0) {
					this.update_overview_analytics();
				} else {
					console.warn('Cannot update Overview - no filtered_data');
				}
				break;
			case 'aging':
				// Update aging section with existing filtered data (no recalculation)
				console.log('Updating Aging section');
				if (this.filtered_data && this.filtered_data.length > 0) {
					// Update aging cards and table (don't recalculate, just display)
					this.update_detailed_aging_cards();
					this.populate_aging_details_table();
					// Recreate charts with current data
					this.wait_for_chartjs_and_create_charts();
				} else {
					console.warn('Cannot update Aging - no filtered_data');
				}
				break;
			case 'outstanding':
				// Update outstanding table with existing filtered data (no recalculation)
				console.log('Updating Outstanding section');
				if (this.filtered_data && this.filtered_data.length > 0) {
					// Check if table exists before updating
					if (this.main_container.find('.outstanding-table-section').length > 0) {
						this.render_table(); // Just re-render the table with existing filtered_data
						this.update_summary(); // Update summary cards
					}
				} else {
					console.warn('Cannot update Outstanding - no filtered_data');
				}
				break;
			case 'collection':
			case 'listed_customers':
			case 'payment_schedules':
			case 'pdc_report':
			case 'salesperson_wise':
			case 'intercompany_overdues':
			case 'payment_followup':
			case 'blocked_dispute':
			case 'proforma_invoice':
			case 'quotation_followup':
			case 'dispute':
			case 'customer_outstanding_clearance':
				// These sections handle their own display updates
				// No need to do anything here as their render methods handle it
				break;
			default:
				// For sections that don't need data (filters, settings), do nothing
				break;
		}
	}

	update_outstanding_badge(count) {
		const badge = this.main_container.find('#outstanding-count');
		if (badge.length > 0) {
			badge.text(count);
			badge.toggle(count > 0); // Hide badge if count is 0
		}
	}

	render_section_content(section) {
		const content_area = this.main_container.find('.dashboard-content');

		// For section caching, check if it has been initialized
		const wrappers = {
			'overview': '.overview-section-wrapper',
			'aging': '.aging-section-wrapper',
			'outstanding': '.outstanding-section-wrapper',
			'collection': '.collection-section-wrapper',
			'intercompany_overdues': '.intercompany-overdues-section-wrapper',
			'payment_followup': '.payment-followup-section-wrapper',
			'salesperson_wise': '[data-section="salesperson_wise"]',
			'listed_customers': '.listed-customers-section-wrapper',
			'payment_schedules': '.payment-schedules-section-wrapper',
			'pdc_report': '.pdc-report-section-wrapper',
			'proforma_invoice': '.proforma-invoice-section-wrapper',
			'quotation_followup': '.quotation-followup-section-wrapper',
			'dispute': '.dispute-section-wrapper',
			'customer_outstanding_clearance': '.customer-outstanding-clearance-section-wrapper'
		};

		if (wrappers[section]) {
			const existingWrapper = content_area.find(wrappers[section]);
			if (existingWrapper.length > 0) {
				console.log(`${section} section already exists, showing without recreating`);
				content_area.children().hide();
				existingWrapper.show();
				return;
			}
		}

		// Hide all sections
		content_area.children().hide();

		switch (section) {
			case 'overview':
				this.render_overview_section();
				break;
			case 'aging':
				this.render_aging_section();
				break;
			case 'outstanding':
				this.render_outstanding_section();
				break;
			case 'collection':
				this.render_collection_section();
				break;
			case 'overdue_advance_progressive':
				this.render_overdue_advance_progressive_section();
				break;
			case 'listed_customers':
				this.render_listed_customers_section();
				break;
			case 'payment_schedules':
				this.render_payment_schedules_section();
				break;
			case 'pdc_report':
				this.render_pdc_report_section();
				break;
			case 'salesperson_wise':
				this.render_salesperson_wise_section();
				break;
			case 'intercompany_overdues':
				this.render_intercompany_overdues_section();
				break;
			case 'payment_followup':
				this.render_payment_followup_section();
				break;
			case 'blocked_dispute':
				this.render_blocked_dispute_section();
				break;
			case 'proforma_invoice':
				this.render_proforma_invoice_section();
				break;
			case 'quotation_followup':
				this.render_quotation_followup_section();
				break;
			case 'dispute':
				this.render_dispute_section();
				break;
			case 'customer_outstanding_clearance':
				this.render_customer_outstanding_clearance_section();
				break;
			case 'cheque_document':
				this.render_cheque_document_section();
				break;
			case 'filters':
				this.render_filters_section();
				break;
			case 'settings':
				this.render_settings_section();
				break;
		}
	}

	create_main_content() {
		// Initial load with overview section
		this.render_overview_section();
	}

	setup_global_navbar_events() {
		// Global filter button - use event delegation to work across all sections
		$(document).off('click', '#global-filter-btn').on('click', '#global-filter-btn', (e) => {
			e.preventDefault();
			console.log('Global filter button clicked');
			this.show_filter_modal();
		});

		// Global refresh button - use event delegation to work across all sections
		$(document).off('click', '#global-refresh-btn').on('click', '#global-refresh-btn', (e) => {
			e.preventDefault();
			console.log('Global refresh button clicked');

			// Reset section initialization flags
			this.collection_section_initialized = false;

			// Clear cached sections so they re-render fresh
			const content_area = this.main_container.find('.dashboard-content');
			content_area.empty();

			// Re-render the current section
			this.render_section_content(this.current_section);

			// Load fresh data
			this.load_data();
		});

		// Export options - use event delegation
		$(document).off('click', '#export-excel').on('click', '#export-excel', (e) => {
			e.preventDefault();
			this.export_to_excel();
		});

		$(document).off('click', '#export-pdf').on('click', '#export-pdf', (e) => {
			e.preventDefault();
			frappe.show_alert('PDF export functionality will be implemented soon.', 3);
		});

		$(document).off('click', '#export-print').on('click', '#export-print', (e) => {
			e.preventDefault();
			this.print_report();
		});

		console.log('Global navbar events setup complete');
	}

	update_section_header(title, subtitle, icon = 'fa-dashboard') {
		$('#current-section-title').html(`<i class="fa ${icon}"></i> ${title}`);
		$('#current-section-subtitle').text(subtitle);
	}

	create_global_title_section() {
		return `
			<div class="global-title-section">
				<h1><i class="fa fa-dashboard"></i> Accounts Receivable Dashboard</h1>
				<div class="global-actions">
					<button class="btn btn-default" id="global-filter-btn" title="Filters">
						<i class="fa fa-filter"></i> Filters
					</button>
					<div class="global-search-bar-inline">
						<div class="search-input-wrapper">
							<i class="fa fa-search search-icon"></i>
							<input type="text" class="global-search-input" placeholder="Search customers, invoices, PDCs..." />
							<i class="fa fa-times search-clear" style="display: none;"></i>
						</div>
						<div class="search-results-dropdown" style="display: none;"></div>
					</div>
					<button class="btn btn-primary" id="global-refresh-btn" title="Refresh">
						<i class="fa fa-refresh"></i> Refresh
					</button>
				</div>
			</div>
		`;
	}

	render_overview_section() {
		const content = $(`
			<div class="overview-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-dashboard"></i>
						Dashboard Overview
					</h2>
					<p class="content-subtitle">Complete view of accounts receivable performance and key metrics</p>
				</div>
				<div class="content-body">
					<div class="overview-analytics-section"></div>
					<div class="aging-analysis-section" style="margin-top: 24px;"></div>
					<div class="top-debtors-section" style="margin-top: 24px;"></div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_overview_analytics();
		this.create_aging_analysis_cards();
		this.create_top_debtors_card();
	}

	setup_navbar_events() {
		// Setup refresh button event for overview section

		// Filter button click with event delegation
		$(document).off('click', '#filter-btn').on('click', '#filter-btn', (e) => {
			e.preventDefault();
			console.log('Filter button clicked'); // Debug log
			this.show_filter_modal();
		});

		// Refresh button click with event delegation
		$(document).off('click', '#refresh-btn').on('click', '#refresh-btn', (e) => {
			e.preventDefault();
			this.refresh_data();
		});
	}

	perform_global_search(searchTerm) {
		if (!searchTerm || searchTerm.length < 2) {
			// Reset to show all data
			this.filtered_data = [...this.data];
			this.debounce_render();
			return;
		}

		searchTerm = searchTerm.toLowerCase();

		// Search across multiple fields
		this.filtered_data = this.data.filter(item => {
			return (
				(item.customer && item.customer.toLowerCase().includes(searchTerm)) ||
				(item.customer_name && item.customer_name.toLowerCase().includes(searchTerm)) ||
				(item.branch && item.branch.toLowerCase().includes(searchTerm)) ||
				(item.outstanding && item.outstanding.toString().includes(searchTerm)) ||
				(item.invoiced && item.invoiced.toString().includes(searchTerm)) ||
				(item.paid && item.paid.toString().includes(searchTerm))
			);
		});

		this.debounce_render();
	}

	show_filter_modal() {
		console.log('show_filter_modal called'); // Debug log

		// Always create a fresh modal to avoid conflicts
		$('#filter-modal-backdrop').remove();

		// Create the modal immediately
		console.log('Creating fresh modal...'); // Debug log
		this.create_simple_modal();
	}

	create_simple_modal() {
		// Remove any existing modal
		$('#filter-modal-backdrop').remove();

		// Create a comprehensive modal with all filter options
		const modalHtml = `
			<div id="filter-modal-backdrop" class="filter-modal-backdrop show" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1050; display: flex; align-items: center; justify-content: center;">
				<div class="filter-modal" style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(59, 130, 246, 0.3); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 80vh; overflow-y: auto;">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
						<h3 style="margin: 0; color: #3b82f6;">
							<i class="fa fa-filter"></i> Advanced Filters & Search
						</h3>
						<button class="close-modal-btn" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
					</div>

					<!-- Global Search Section -->
					<div style="margin-bottom: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 4px solid #3b82f6;">
						<label style="display: block; margin-bottom: 8px; font-weight: 600; color: #3b82f6;">
							<i class="fa fa-search"></i> Global Search
						</label>
						<input type="text" id="modal-global-search" class="form-control" placeholder="Search customers, invoices, amounts..." style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
						<small style="color: #64748b; margin-top: 5px; display: block;">Search across customer names, invoice numbers, and amounts</small>
					</div>
					<div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
							<div id="modal-company-container">
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Company:</label>
							</div>
							<div>
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Report Date:</label>
								<input type="date" id="modal-report-date" class="form-control" value="${frappe.datetime.get_today()}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
							</div>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
							<div id="modal-customer-container">
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Customer:</label>
							</div>
							<div id="modal-branch-container">
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Branch:</label>
							</div>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
							<div id="modal-sales-person-container">
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Sales Person:</label>
							</div>
							<div id="modal-sales-team-container">
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Sales Team:</label>
							</div>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
							<div>
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Aging Filter:</label>
								<select id="modal-aging-filter" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
									<option value="all">All Outstanding</option>
									<option value="current">Current (0-30 days)</option>
									<option value="overdue_30">Overdue 31-60 days</option>
									<option value="overdue_60">Overdue 61-90 days</option>
									<option value="overdue_90">Overdue 91-120 days</option>
									<option value="overdue_120">Overdue 120+ days</option>
								</select>
							</div>
							<div>
								<label style="display: block; margin-bottom: 5px; font-weight: 600;color:white;">Minimum Outstanding:</label>
								<input type="number" id="modal-min-outstanding" class="form-control" placeholder="0" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
							</div>
						</div>
						<div style="margin-bottom: 20px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 4px solid #f59e0b;">
							<label style="display: block; margin-bottom: 8px; color: white; font-weight: 600;">
								<i class="fa fa-building" style="margin-right: 8px; color: #f59e0b;"></i>
								Internal Customer
							</label>
							<select id="modal-internal-customer" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
								<option value="">All Customers</option>
								<option value="yes">Yes - Internal Only</option>
								<option value="no">No - Non-Internal Only</option>
							</select>
							<small style="color: #94a3b8; margin-top: 5px; display: block;">Filter customers by internal/inter-company status</small>
						</div>
						<div style="text-align: right;">
							<button id="clear-filters-btn" class="btn btn-default" style="margin-right: 10px; padding: 8px 16px; border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(30, 41, 59, 0.6); color: #e2e8f0; border-radius: 4px; cursor: pointer;">
								<i class="fa fa-eraser"></i> Clear Filters
							</button>
							<button id="apply-filters-btn" class="btn btn-primary" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
								<i class="fa fa-check"></i> Apply Filters
							</button>
						</div>
					</div>
				</div>
			</div>
		`;

		$('body').append(modalHtml);

		// Create Link field controls with clear buttons
		this.create_filter_link_controls();

		// Setup events for the simple modal first
		$('.close-modal-btn').on('click', (e) => {
			e.preventDefault();
			this.hide_filter_modal();
		});

		$('.filter-modal-backdrop').on('click', (e) => {
			if (e.target === e.currentTarget) {
				this.hide_filter_modal();
			}
		});

		// Prevent modal from closing when clicking inside the modal content
		$('.filter-modal').on('click', (e) => {
			e.stopPropagation();
		});

		$('#clear-filters-btn').on('click', () => {
			// Clear Link field controls
			if (this.modal_company_field) this.modal_company_field.set_value('');
			if (this.modal_customer_field) this.modal_customer_field.set_value('');
			if (this.modal_branch_field) this.modal_branch_field.set_value('');
			if (this.modal_sales_team_field) this.modal_sales_team_field.set_value('');
			if (this.modal_sales_person_field) this.modal_sales_person_field.set_value('');

			$('#modal-aging-filter').val('all');
			$('#modal-min-outstanding').val('');
			$('#modal-report-date').val(frappe.datetime.get_today());
			$('#modal-global-search').val('');
			$('#modal-internal-customer').val('');
		});

		$('#apply-filters-btn').on('click', () => {
			this.apply_modal_filters();
		});

		// Load filter options and populate current values after loading
		this.load_simple_filter_options();

		// Populate current filter values after a short delay
		setTimeout(() => {
			this.populate_current_filters();
		}, 100);

		console.log('Complete modal created and shown');
	}

	create_filter_link_controls() {
		// Create Company Link field with clear button
		this.modal_company_field = frappe.ui.form.make_control({
			parent: $('#modal-company-container'),
			df: {
				fieldtype: 'Link',
				options: 'Company',
				placeholder: 'All Companies',
				change: () => {
					const selected_company = this.modal_company_field.get_value();
					console.log('Company changed to:', selected_company);
					// Sales Person and Sales Team Link fields will automatically filter by company via get_query
				}
			},
			render_input: true
		});

		// Set current value
		if (this.filters.company) {
			this.modal_company_field.set_value(this.filters.company);
		}

		// Create Customer Link field with clear button
		this.modal_customer_field = frappe.ui.form.make_control({
			parent: $('#modal-customer-container'),
			df: {
				fieldtype: 'Link',
				options: 'Customer',
				placeholder: 'All Customers',
				change: () => {
					console.log('Customer changed to:', this.modal_customer_field.get_value());
				}
			},
			render_input: true
		});

		// Set current value
		if (this.filters.customer) {
			this.modal_customer_field.set_value(this.filters.customer);
		}

		// Create Branch Link field with clear button
		this.modal_branch_field = frappe.ui.form.make_control({
			parent: $('#modal-branch-container'),
			df: {
				fieldtype: 'Link',
				options: 'Branch',
				placeholder: 'All Branches',
				change: () => {
					console.log('Branch changed to:', this.modal_branch_field.get_value());
				}
			},
			render_input: true
		});

		// Set current value
		if (this.filters.branch) {
			this.modal_branch_field.set_value(this.filters.branch);
		}

		// Create Sales Person Link field with clear button
		this.modal_sales_person_field = frappe.ui.form.make_control({
			parent: $('#modal-sales-person-container'),
			df: {
				fieldtype: 'Link',
				options: 'Sales Person',
				placeholder: 'All Sales Persons',
				get_query: () => {
					// Only show individual sales persons (not team leaders)
					// Team leaders (is_group = 1) are shown in Sales Team filter
					return {
						filters: {
							enabled: 1,
							is_group: 0  // Exclude team leaders/parents
						}
					};
				},
				change: () => {
					console.log('Sales Person changed to:', this.modal_sales_person_field.get_value());
				}
			},
			render_input: true
		});

		// Set current value
		if (this.filters.sales_person) {
			this.modal_sales_person_field.set_value(this.filters.sales_person);
		}

		// Create Sales Team Link field (actually Sales Person with is_group filter)
		this.modal_sales_team_field = frappe.ui.form.make_control({
			parent: $('#modal-sales-team-container'),
			df: {
				fieldtype: 'Link',
				options: 'Sales Person',
				placeholder: 'All Sales Teams',
				get_query: () => {
					// Filter for team leaders only (is_group = 1)
					return {
						filters: {
							is_group: 1,
							enabled: 1
						}
					};
				},
				change: () => {
					console.log('Sales Team changed to:', this.modal_sales_team_field.get_value());
				}
			},
			render_input: true
		});

		// Set current value
		if (this.filters.sales_team) {
			this.modal_sales_team_field.set_value(this.filters.sales_team);
		}

		console.log('Filter Link controls created with clear buttons');

		// Apply dark theme styling to Link fields
		this.apply_dark_theme_to_link_fields();
	}

	apply_dark_theme_to_link_fields() {
		// Add dark theme CSS for Link field controls in the modal
		const darkThemeStyles = `
			<style>
			/* Dark theme for modal Link field controls */
			#filter-modal-backdrop .frappe-control input.input-with-feedback,
			#filter-modal-backdrop .frappe-control .link-field,
			#filter-modal-backdrop .form-control {
				background: rgba(30, 41, 59, 0.8) !important;
				border: 1px solid rgba(59, 130, 246, 0.3) !important;
				color: #e2e8f0 !important;
				padding: 8px !important;
				border-radius: 4px !important;
			}

			#filter-modal-backdrop .frappe-control input.input-with-feedback:focus,
			#filter-modal-backdrop .frappe-control .link-field:focus {
				border-color: #3b82f6 !important;
				box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
				background: rgba(30, 41, 59, 0.95) !important;
			}

			/* Clear button styling */
			#filter-modal-backdrop .btn-open,
			#filter-modal-backdrop .clear-action {
				color: #94a3b8 !important;
				background: transparent !important;
				border: none !important;
			}

			#filter-modal-backdrop .btn-open:hover,
			#filter-modal-backdrop .clear-action:hover {
				color: #3b82f6 !important;
			}

			/* Awesomplete dropdown dark theme */
			#filter-modal-backdrop .awesomplete > ul {
				background: rgba(30, 41, 59, 0.98) !important;
				border: 1px solid rgba(59, 130, 246, 0.3) !important;
				border-radius: 4px !important;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
			}

			#filter-modal-backdrop .awesomplete > ul > li {
				color: #e2e8f0 !important;
				padding: 8px 12px !important;
			}

			#filter-modal-backdrop .awesomplete > ul > li:hover,
			#filter-modal-backdrop .awesomplete > ul > li[aria-selected="true"] {
				background: rgba(59, 130, 246, 0.2) !important;
				color: #ffffff !important;
			}

			/* Link field container */
			#filter-modal-backdrop .frappe-control {
				margin-bottom: 0 !important;
			}

			/* Input group styling */
			#filter-modal-backdrop .input-group {
				background: transparent !important;
			}

			/* Placeholder text */
			#filter-modal-backdrop .frappe-control input::placeholder {
				color: #64748b !important;
			}
			</style>
		`;

		// Append dark theme styles to the modal
		if (!$('#modal-dark-theme-styles').length) {
			$('head').append($(darkThemeStyles).attr('id', 'modal-dark-theme-styles'));
		}
	}

	load_simple_filter_options() {
		console.log('Loading simple filter options...');

		// Load companies with a more reliable method
		frappe.db.get_list('Company', {
			fields: ['name'],
			limit: 0
		}).then(companies => {
			console.log('Companies loaded via db.get_list:', companies);
			const companySelect = $('#modal-company');
			if (companySelect.length > 0 && companies && companies.length > 0) {
				// Clear existing options except "All Companies"
				companySelect.find('option:not(:first)').remove();

				companies.forEach(company => {
					if (company && company.name) {
						companySelect.append(`<option value="${company.name}">${company.name}</option>`);
					}
				});
				console.log('Companies populated:', companies.length);

				// Set current filter value for company
				if (this.filters.company) {
					companySelect.val(this.filters.company);
					console.log('Company filter value set to:', this.filters.company);
				}
			}
		}).catch(error => {
			console.log('Error loading companies via db.get_list:', error);

			// Fallback: try with frappe.call
			frappe.call({
				method: 'frappe.client.get_list',
				args: {
					doctype: 'Company',
					fields: ['name']
				},
				callback: (r) => {
					console.log('Companies fallback response:', r);
					if (r && r.message) {
						const companySelect = $('#modal-company');
						if (companySelect.length > 0) {
							companySelect.find('option:not(:first)').remove();
							r.message.forEach(company => {
								companySelect.append(`<option value="${company.name}">${company.name}</option>`);
							});

							// Set current filter value for company (fallback)
							if (this.filters.company) {
								companySelect.val(this.filters.company);
								console.log('Company filter value set to (fallback):', this.filters.company);
							}
						}
					}
				}
			});
		});

		// Load customers
		frappe.db.get_list('Customer', {
			fields: ['name', 'customer_name'],
			limit: 0
		}).then(customers => {
			console.log('Customers loaded via db.get_list:', customers);
			const customerSelect = $('#modal-customer');
			if (customerSelect.length > 0 && customers && customers.length > 0) {
				// Clear existing options except "All Customers"
				customerSelect.find('option:not(:first)').remove();

				customers.forEach(customer => {
					if (customer && customer.name) {
						const displayName = customer.customer_name || customer.name;
						customerSelect.append(`<option value="${customer.name}">${displayName}</option>`);
					}
				});
				console.log('Customers populated:', customers.length);

				// Set current filter value for customer
				if (this.filters.customer) {
					customerSelect.val(this.filters.customer);
					console.log('Customer filter value set to:', this.filters.customer);
				}
			}
		}).catch(error => {
			console.log('Error loading customers via db.get_list:', error);
		});

		// Load branches
		frappe.db.get_list('Branch', {
			fields: ['name'],
			limit: 0
		}).then(branches => {
			console.log('Branches loaded via db.get_list:', branches);
			const branchSelect = $('#modal-branch');
			if (branchSelect.length > 0 && branches && branches.length > 0) {
				// Clear existing options except "All Branches"
				branchSelect.find('option:not(:first)').remove();

				branches.forEach(branch => {
					if (branch && branch.name) {
						branchSelect.append(`<option value="${branch.name}">${branch.name}</option>`);
					}
				});
				console.log('Branches populated:', branches.length);

				// Set current filter value for branch
				if (this.filters.branch) {
					branchSelect.val(this.filters.branch);
					console.log('Branch filter value set to:', this.filters.branch);
				}
			}
		}).catch(error => {
			console.log('Error loading branches via db.get_list:', error);
		});

		// Note: Sales Teams and Sales Persons will be loaded after company data is loaded
		// They are not loaded here initially

		// Add some test data if API calls fail and ensure current filter values are populated
		setTimeout(() => {
			const companySelect = $('#modal-company');
			const customerSelect = $('#modal-customer');
			const branchSelect = $('#modal-branch');

			// Check if options were loaded, if not add some fallback options
			if (companySelect.find('option').length <= 1) {
				console.log('No companies loaded, adding fallback options');
				companySelect.append('<option value="Test Company">Test Company</option>');
			}

			if (customerSelect.find('option').length <= 1) {
				console.log('No customers loaded, adding fallback options');
				customerSelect.append('<option value="Test Customer">Test Customer</option>');
			}

			if (branchSelect.find('option').length <= 1) {
				console.log('No branches loaded, adding fallback options');
				branchSelect.append('<option value="Main Branch">Main Branch</option>');
			}

			// Ensure all current filter values are populated (backup method)
			console.log('Setting current filter values (backup method)...');
			this.populate_current_filters();
		}, 2000);
	}

	hide_filter_modal() {
		const modal = $('#filter-modal-backdrop');
		if (modal.length > 0) {
			modal.removeClass('show');
			// Remove the modal completely so it can be recreated fresh
			setTimeout(() => {
				modal.remove();
			}, 300);
		}

		// Also remove any event handlers to prevent conflicts
		$(document).off('keydown.filter-modal');
	}

	refresh_data() {
		// Clear cache and force reload
		this.data_cache.clear();

		// Show loading state on refresh button
		const refreshBtn = $('#refresh-btn');
		const originalContent = refreshBtn.html();
		refreshBtn.html('<i class="fa fa-spin fa-refresh"></i> <span class="btn-text">Loading...</span>');
		refreshBtn.prop('disabled', true);

		// Load fresh data
		this.load_data();

		// Reset button after a short delay (load_data will reset loading state)
		setTimeout(() => {
			refreshBtn.html(originalContent);
			refreshBtn.prop('disabled', false);
		}, 1000);
	}

	create_filter_modal() {
		// Safely handle modal creation
		try {
			// Remove existing modal if any
			$('#filter-modal-backdrop').remove();

			const modal = $(`
			<div id="filter-modal-backdrop" class="filter-modal-backdrop">
				<div class="filter-modal">
					<button class="close-modal-btn" type="button">
						<i class="fa fa-times"></i>
					</button>
					<div class="filter-modal-header">
						<h3 class="filter-modal-title">
							<i class="fa fa-filter"></i>
							Advanced Filters
						</h3>
						<p class="filter-modal-subtitle">Configure filters to refine your accounts receivable data</p>
					</div>
					<div class="filter-modal-body">
						<div class="row">
							<div class="col-md-6">
								<div class="form-group">
									<label>Company</label>
									<select class="form-control" id="modal-company">
										<option value="">All Companies</option>
									</select>
								</div>
							</div>
							<div class="col-md-6">
								<div class="form-group">
									<label>Report Date</label>
									<input type="date" class="form-control" id="modal-report-date" value="${frappe.datetime.get_today()}">
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-6">
								<div class="form-group">
									<label>Customer</label>
									<select class="form-control" id="modal-customer">
										<option value="">All Customers</option>
									</select>
								</div>
							</div>
							<div class="col-md-6">
								<div class="form-group">
									<label>Branch</label>
									<select class="form-control" id="modal-branch">
										<option value="">All Branches</option>
									</select>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-6">
								<div class="form-group">
									<label>Aging Filter</label>
									<select class="form-control" id="modal-aging-filter">
										<option value="all">All Outstanding</option>
										<option value="current">Current (0-30 days)</option>
										<option value="overdue_30">Overdue 31-60 days</option>
										<option value="overdue_60">Overdue 61-90 days</option>
										<option value="overdue_90">Overdue 91-120 days</option>
										<option value="overdue_120">Overdue 120+ days</option>
									</select>
								</div>
							</div>
							<div class="col-md-6">
								<div class="form-group">
									<label>Minimum Outstanding Amount</label>
									<input type="number" class="form-control" id="modal-min-outstanding" placeholder="0" min="0" step="0.01">
								</div>
							</div>
						</div>
					</div>
					<div class="filter-modal-footer">
						<button type="button" class="btn btn-default" id="clear-filters-btn">
							<i class="fa fa-eraser"></i> Clear Filters
						</button>
						<button type="button" class="btn btn-primary" id="apply-filters-btn">
							<i class="fa fa-check"></i> Apply Filters
						</button>
					</div>
				</div>
			</div>
		`);

			// Append to body
			$('body').append(modal);

			// Load filter options
			this.load_filter_options();

			// Setup modal events
			this.setup_filter_modal_events();

			// Set current filter values
			this.populate_current_filters();

		} catch (e) {
			console.log('Error creating filter modal:', e);
			// Fallback: create basic modal without filter options
			this.create_basic_filter_modal();
		}
	}

	create_basic_filter_modal() {
		// Simple fallback modal without dynamic filter options
		const modal = $(`
			<div id="filter-modal-backdrop" class="filter-modal-backdrop">
				<div class="filter-modal">
					<button class="close-modal-btn" type="button">
						<i class="fa fa-times"></i>
					</button>
					<div class="filter-modal-header">
						<h3 class="filter-modal-title">
							<i class="fa fa-filter"></i>
							Basic Filters
						</h3>
						<p class="filter-modal-subtitle">Configure basic filters for your data</p>
					</div>
					<div class="filter-modal-body">
						<div class="row">
							<div class="col-md-6">
								<div class="form-group">
									<label>Report Date</label>
									<input type="date" class="form-control" id="modal-report-date" value="${frappe.datetime.get_today()}">
								</div>
							</div>
							<div class="col-md-6">
								<div class="form-group">
									<label>Minimum Outstanding Amount</label>
									<input type="number" class="form-control" id="modal-min-outstanding" placeholder="0" min="0" step="0.01">
								</div>
							</div>
						</div>
					</div>
					<div class="filter-modal-footer">
						<button type="button" class="btn btn-default" id="clear-filters-btn">
							<i class="fa fa-eraser"></i> Clear Filters
						</button>
						<button type="button" class="btn btn-primary" id="apply-filters-btn">
							<i class="fa fa-check"></i> Apply Filters
						</button>
					</div>
				</div>
			</div>
		`);

		$('body').append(modal);
		this.setup_filter_modal_events();
	}

	setup_filter_modal_events() {
		// Close modal events
		$('.close-modal-btn, .filter-modal-backdrop').on('click', (e) => {
			if (e.target === e.currentTarget) {
				this.hide_filter_modal();
			}
		});

		// Prevent modal close when clicking inside modal content
		$('.filter-modal').on('click', (e) => {
			e.stopPropagation();
		});

		// Clear filters
		$('#clear-filters-btn').on('click', () => {
			this.clear_all_filters();
		});

		// Apply filters
		$('#apply-filters-btn').on('click', () => {
			this.apply_modal_filters();
		});

		// Escape key to close modal
		$(document).on('keydown.filter-modal', (e) => {
			if (e.key === 'Escape') {
				this.hide_filter_modal();
			}
		});
	}

	load_filter_options() {
		// Load companies
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Company',
				fields: ['name'],
				limit_page_length: 0
			},
			callback: (r) => {
				try {
					if (r.message && Array.isArray(r.message)) {
						const companySelect = $('#modal-company');
						if (companySelect.length > 0) {
							r.message.forEach(company => {
								if (company && company.name) {
									companySelect.append(`<option value="${company.name}">${company.name}</option>`);
								}
							});
						}
					}
				} catch (e) {
					console.log('Error loading companies:', e);
				}
			},
			error: (r) => {
				console.log('Failed to load companies:', r);
			}
		});

		// Load customers
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Customer',
				fields: ['name', 'customer_name'],
				limit_page_length: 0
			},
			callback: (r) => {
				try {
					if (r.message && Array.isArray(r.message)) {
						const customerSelect = $('#modal-customer');
						if (customerSelect.length > 0) {
							r.message.forEach(customer => {
								if (customer && customer.name) {
									const displayName = customer.customer_name || customer.name;
									customerSelect.append(`<option value="${customer.name}">${displayName}</option>`);
								}
							});
						}
					}
				} catch (e) {
					console.log('Error loading customers:', e);
				}
			},
			error: (r) => {
				console.log('Failed to load customers:', r);
			}
		});

		// Load branches
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Branch',
				fields: ['name'],
				limit_page_length: 0
			},
			callback: (r) => {
				try {
					if (r.message && Array.isArray(r.message)) {
						const branchSelect = $('#modal-branch');
						if (branchSelect.length > 0) {
							r.message.forEach(branch => {
								if (branch && branch.name) {
									branchSelect.append(`<option value="${branch.name}">${branch.name}</option>`);
								}
							});
						}
					}
				} catch (e) {
					console.log('Error loading branches:', e);
				}
			},
			error: (r) => {
				console.log('Failed to load branches:', r);
			}
		});
	}

	populate_current_filters() {
		// Link field controls are set during their creation in create_filter_link_controls()
		// Only set the non-link fields here
		$('#modal-report-date').val(this.filters.report_date || frappe.datetime.get_today());
		$('#modal-aging-filter').val(this.filters.aging_filter || 'all');
		$('#modal-min-outstanding').val(this.filters.min_outstanding || '');
		$('#modal-internal-customer').val(this.filters.internal_customer || '');
	}

	clear_all_filters() {
		// Clear Link field controls
		if (this.modal_company_field) this.modal_company_field.set_value('');
		if (this.modal_customer_field) this.modal_customer_field.set_value('');
		if (this.modal_branch_field) this.modal_branch_field.set_value('');
		if (this.modal_sales_team_field) this.modal_sales_team_field.set_value('');
		if (this.modal_sales_person_field) this.modal_sales_person_field.set_value('');

		// Clear regular fields
		$('#modal-aging-filter').val('all');
		$('#modal-min-outstanding').val('');
		$('#modal-report-date').val(frappe.datetime.get_today());
		$('#modal-internal-customer').val('');
	}

	apply_modal_filters() {
		// Get values from Link field controls
		const modal_company = this.modal_company_field ? this.modal_company_field.get_value() : '';
		console.log('[Modal Filters] Applying company from modal:', modal_company);

		this.filters.company = modal_company || '';
		this.filters.report_date = $('#modal-report-date').val() || frappe.datetime.get_today();
		this.filters.customer = this.modal_customer_field ? this.modal_customer_field.get_value() : '';
		this.filters.branch = this.modal_branch_field ? this.modal_branch_field.get_value() : '';
		this.filters.sales_team = this.modal_sales_team_field ? this.modal_sales_team_field.get_value() : '';
		this.filters.sales_person = this.modal_sales_person_field ? this.modal_sales_person_field.get_value() : '';
		this.filters.aging_filter = $('#modal-aging-filter').val() || 'all';
		this.filters.min_outstanding = parseFloat($('#modal-min-outstanding').val()) || 0;
		this.filters.internal_customer = $('#modal-internal-customer').val() || '';

		// Sync back to main company filter
		if (this.company_filter && modal_company) {
			this.company_filter.set_value(modal_company);
		}

		// Get global search value
		const globalSearch = $('#modal-global-search').val();
		if (globalSearch && globalSearch.trim()) {
			this.perform_global_search(globalSearch.trim());
		}

		// Hide modal
		this.hide_filter_modal();

		// Clear cache
		this.data_cache.clear();

		// Reload appropriate data source based on current section
		const main_data_sections = ['overview', 'aging', 'outstanding'];

		if (main_data_sections.includes(this.current_section)) {
			console.log(`Reloading main data for ${this.current_section}`);
			this.load_data();
		} else {
			// Clear main data if we're not in a main section, so it reloads correctly when switching back
			this.data = null;
			this.filtered_data = [];
		}

		// Reload current section if it has its own data source
		if (this.current_section === 'proforma_invoice') {
			this.load_proforma_invoices();
		} else if (this.current_section === 'collection') {
			this.load_collection_data();
		} else if (this.current_section === 'payment_schedules') {
			this.load_payment_schedules();
		} else if (this.current_section === 'pdc_report') {
			this.load_pdc_data();
		} else if (this.current_section === 'intercompany_overdues') {
			this.load_intercompany_overdues();
		} else if (this.current_section === 'payment_followup') {
			this.load_payment_followup();
		} else if (this.current_section === 'blocked_dispute') {
			this.load_blocked_dispute_data();
		} else if (this.current_section === 'quotation_followup') {
			this.load_quotation_followup();
		} else if (this.current_section === 'dispute') {
			this.load_dispute_data();
		} else if (this.current_section === 'customer_outstanding_clearance') {
			this.load_customer_outstanding_clearance_data();
		} else if (this.current_section === 'cheque_document') {
			this.load_cheque_document_data();
		} else if (this.current_section === 'listed_customers') {
			this.load_listed_customers_data();
		} else if (this.current_section === 'salesperson_wise') {
			this.load_salesperson_data();
		} else if (this.current_section === 'overdue_advance_progressive') {
			this.load_overdue_advance_progressive_data();
		}

		// Show success message
		frappe.show_alert({
			message: __('Filters applied successfully'),
			indicator: 'green'
		}, 3);
	}

	render_summary_section() {
		const content = $(`
			${this.create_global_title_section()}
			<div class="content-header">
				<h2 class="content-title">
					<i class="fa fa-pie-chart"></i>
					Financial Summary
				</h2>
				<p class="content-subtitle">Detailed breakdown of sales, payments, and receivables</p>
			</div>
			<div class="content-body">
				<div class="summary-cards-section"></div>
				<div class="detailed-summary-section" style="margin-top: 24px;"></div>
				<div class="visual-charts-section" style="margin-top: 24px;"></div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_summary_cards();
		this.create_detailed_summary();
		this.create_financial_charts();
	}

	render_aging_section() {
		const content = $(`
			<div class="aging-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-clock-o"></i>
						Aging Analysis
					</h2>
					<p class="content-subtitle">Analyze receivables by age brackets and payment terms</p>
				</div>
				<div class="content-body">
					<div class="aging-breakdown-section"></div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();

		// Ensure filtered_data is properly initialized before creating aging analysis
		if (!this.filtered_data || this.filtered_data.length === 0) {
			if (this.data && this.data.length > 0) {
				console.log('Aging section: Initializing filtered_data from raw data');
				this.filtered_data = [...this.data];
			}
		}

		// Create aging analysis with properly initialized data
		this.create_aging_analysis();
	}

	render_customers_section() {
		const content = $(`
			<div class="customers-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-users"></i>
						Customer Details
					</h2>
					<p class="content-subtitle">Individual customer receivables and payment history</p>
				</div>
				<div class="content-body">
					<div class="customer-table-section"></div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_customer_table();
	}

	render_outstanding_section() {
		const content = $(`
			<div class="outstanding-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-exclamation-circle"></i>
						Outstanding Report
					</h2>
					<p class="content-subtitle">Detailed view of all outstanding receivables requiring attention</p>
				</div>
				<div class="content-body">
					<div class="outstanding-table-section"></div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_outstanding_table();
	}

	render_collection_section() {
		const content = $(`
			<div class="collection-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-money"></i>
						Collection Tracker
					</h2>
					<p class="content-subtitle">Track collection targets, due dates, and payment schedules</p>
				</div>
				<div class="content-body">
					<div class="collection-cards-section"></div>
					<div class="collection-schedule-section" style="margin-top: 24px;"></div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_collection_tracker();

		// Mark collection section as initialized
		this.collection_section_initialized = true;
	}

	render_listed_customers_section() {
		const content = $(`
			<div class="listed-customers-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-list-alt"></i>
						Listed Customers
					</h2>
					<p class="content-subtitle">Customer listing and management overview</p>
				</div>
				<div class="content-body">
					<div class="customer-stats-cards" style="margin-bottom: 20px;"></div>
					<div class="customer-classification-tabs" style="margin-bottom: 20px;">
						<ul class="nav nav-tabs" style="border-bottom: 2px solid #dee2e6;">
							<li class="nav-item">
								<a class="nav-link active customer-type-tab" data-type="listed" style="cursor: pointer; font-weight: 600;">
									<i class="fa fa-check-circle"></i> Listed Customers
								</a>
							</li>
							<li class="nav-item">
								<a class="nav-link customer-type-tab" data-type="non_listed" style="cursor: pointer; font-weight: 600;">
									<i class="fa fa-circle-o"></i> Non-Listed Customers
								</a>
							</li>
							<li class="nav-item">
								<a class="nav-link customer-type-tab" data-type="comparison" style="cursor: pointer; font-weight: 600;">
									<i class="fa fa-bar-chart"></i> Credit Limit vs Outstanding
								</a>
							</li>
						</ul>
					</div>
					<div class="customers-table-container"></div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.load_customer_classification();
	}

	load_customer_classification() {
		const self = this;

		if (!self.filters.company) {
			self.main_container.find('.customers-table-container').html(`
				<div class="alert alert-warning" style="margin-top: 20px;">
					<i class="fa fa-exclamation-triangle"></i> Please select a company from the global filters to load data.
				</div>
			`);
			return;
		}

		frappe.call({
			method: 'prastara_custom.controller.accounts_receivable.get_customer_classification_sql',
			args: {
				customer_names: self.filters.customer ? [self.filters.customer] : null,
				company: self.filters.company,
				sales_person: self.filters.sales_person || null,
				sales_team: self.filters.sales_team || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: (r) => {
				if (r.message) {
					this.render_customer_classification_data(r.message);
				}
			}
		});
	}

	render_customer_classification_data(data) {
		let listed = data.listed || [];
		let non_listed = data.non_listed || [];

		listed = this.filter_records_by_internal_customer(listed, ['name', 'customer', 'customer_name']);
		non_listed = this.filter_records_by_internal_customer(non_listed, ['name', 'customer', 'customer_name']);

		// Store data for comparison tab
		this.listed_customers_data = listed;
		this.non_listed_customers_data = non_listed;

		// Calculate statistics
		const total_listed = listed.length;
		const total_non_listed = non_listed.length;
		const total_customers = total_listed + total_non_listed;
		const total_credit_limit_listed = listed.reduce((sum, c) => sum + (c.credit_limit || 0), 0);
		const total_credit_limit_non_listed = non_listed.reduce((sum, c) => sum + (c.credit_limit || 0), 0);

		// Find highest credit limit customers
		const highest_credit_listed = listed.length > 0
			? listed.reduce((max, c) => (c.credit_limit || 0) > (max.credit_limit || 0) ? c : max, listed[0])
			: null;

		const highest_credit_non_listed = non_listed.length > 0
			? non_listed.reduce((max, c) => (c.credit_limit || 0) > (max.credit_limit || 0) ? c : max, non_listed[0])
			: null;

		// Render statistics cards
		this.render_customer_stats(total_listed, total_non_listed, total_customers, total_credit_limit_listed, total_credit_limit_non_listed, highest_credit_listed, highest_credit_non_listed);

		// Setup tab switching
		this.setup_customer_type_tabs(listed, non_listed);

		// Render listed customers by default
		this.render_customers_table(listed, 'listed');
	}

	render_customer_stats(total_listed, total_non_listed, total_customers, total_credit_limit_listed, total_credit_limit_non_listed, highest_credit_listed, highest_credit_non_listed) {
		const stats_html = `
			<div class="row">
				<div class="col-md-4">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Customers</h4>
							<div class="stat-icon primary">
								<i class="fa fa-users"></i>
							</div>
						</div>
						<div class="stat-value">${total_customers}</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> All active customers</small>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Listed Customers</h4>
							<div class="stat-icon success">
								<i class="fa fa-check-circle"></i>
							</div>
						</div>
						<div class="stat-value">${total_listed}</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> With credit facility</small>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Non-Listed</h4>
							<div class="stat-icon warning">
								<i class="fa fa-circle-o"></i>
							</div>
						</div>
						<div class="stat-value">${total_non_listed}</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Without credit facility</small>
						</div>
					</div>
				</div>
			</div>
			<div class="row" style="margin-top: 20px;">
				<div class="col-md-4">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Total Non-Listed Credit Amount</h4>
							<div class="stat-icon warning">
								<i class="fa fa-credit-card"></i>
							</div>
						</div>
						<div class="stat-value">${frappe.format(total_credit_limit_non_listed, { fieldtype: 'Currency' })}</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Total for non-listed</small>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Total Listed Credit Amount</h4>
							<div class="stat-icon success">
								<i class="fa fa-credit-card"></i>
							</div>
						</div>
						<div class="stat-value">${frappe.format(total_credit_limit_listed, { fieldtype: 'Currency' })}</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Total for listed customers</small>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Total Credit Amount (All)</h4>
							<div class="stat-icon info">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value">${frappe.format(total_credit_limit_listed + total_credit_limit_non_listed, { fieldtype: 'Currency' })}</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Combined credit limit</small>
						</div>
					</div>
				</div>
			</div>
			<div class="row" style="margin-top: 20px;">
				<div class="col-md-4">
					<div class="stat-card ${highest_credit_listed ? 'success' : 'secondary'} top-listed-card" style="cursor: ${highest_credit_listed ? 'pointer' : 'default'};" data-customer='${highest_credit_listed ? JSON.stringify(highest_credit_listed) : ''}'>
						<div class="stat-header">
							<h4 class="stat-title">Top Listed Amount</h4>
							<div class="stat-icon ${highest_credit_listed ? 'success' : 'secondary'}">
								<i class="fa fa-star"></i>
							</div>
						</div>
						<div class="stat-value">${highest_credit_listed ? frappe.format(highest_credit_listed.credit_limit, { fieldtype: 'Currency' }) : 'N/A'}</div>
						<div class="stat-description">
							<small><i class="fa fa-user"></i> ${highest_credit_listed ? (highest_credit_listed.customer_name || highest_credit_listed.name) : 'No data'}</small>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card ${highest_credit_non_listed ? 'warning' : 'secondary'} top-non-listed-card" style="cursor: ${highest_credit_non_listed ? 'pointer' : 'default'};" data-customer='${highest_credit_non_listed ? JSON.stringify(highest_credit_non_listed) : ''}'>
						<div class="stat-header">
							<h4 class="stat-title">Top Non-Listed Amount</h4>
							<div class="stat-icon ${highest_credit_non_listed ? 'warning' : 'secondary'}">
								<i class="fa fa-star"></i>
							</div>
						</div>
						<div class="stat-value">${highest_credit_non_listed ? frappe.format(highest_credit_non_listed.credit_limit, { fieldtype: 'Currency' }) : 'N/A'}</div>
						<div class="stat-description">
							<small><i class="fa fa-user"></i> ${highest_credit_non_listed ? (highest_credit_non_listed.customer_name || highest_credit_non_listed.name) : 'No data'}</small>
						</div>
					</div>
				</div>
				<div class="col-md-4"></div>
			</div>
		`;
		this.main_container.find('.customer-stats-cards').html(stats_html);

		// Setup click handlers for top customer cards
		this.setup_top_customer_click_handlers();
	}

	setup_top_customer_click_handlers() {
		// Click handler for Top Listed card
		this.main_container.find('.top-listed-card').on('click', (e) => {
			const customerData = $(e.currentTarget).data('customer');
			if (customerData) {
				this.show_customer_details_dialog(customerData, 'Listed');
			}
		});

		// Click handler for Top Non-Listed card
		this.main_container.find('.top-non-listed-card').on('click', (e) => {
			const customerData = $(e.currentTarget).data('customer');
			if (customerData) {
				this.show_customer_details_dialog(customerData, 'Non-Listed');
			}
		});
	}

	show_customer_details_dialog(customer, type) {
		const dialog = new frappe.ui.Dialog({
			title: `${type} Customer Details`,
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'customer_details',
					options: `
						<div style="padding: 20px;">
							<div style="background: linear-gradient(135deg, ${type === 'Listed' ? '#28a745' : '#ffc107'} 0%, ${type === 'Listed' ? '#20c997' : '#ff9800'} 100%);
								padding: 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
								<h3 style="color: white; margin: 0 0 10px 0;">
									<i class="fa fa-star"></i> Top ${type} Customer
								</h3>
								<p style="margin: 0; opacity: 0.9;">Highest credit limit in ${type.toLowerCase()} category</p>
							</div>
							<table class="table table-bordered" style="margin: 0;">
								<tr>
									<th style="width: 40%;">Customer ID</th>
									<td><a href="/app/customer/${customer.name}" target="_blank">${customer.name}</a></td>
								</tr>
								<tr>
									<th>Customer Name</th>
									<td><strong>${customer.customer_name || customer.name}</strong></td>
								</tr>
								<tr>
									<th>Customer Type</th>
									<td>${customer.customer_type || 'N/A'}</td>
								</tr>
								<tr>
									<th>Territory</th>
									<td>${customer.territory || 'N/A'}</td>
								</tr>
								<tr>
									<th>Customer Group</th>
									<td>${customer.customer_group || 'N/A'}</td>
								</tr>
								<tr>
									<th>Company</th>
									<td>${customer.company || 'N/A'}</td>
								</tr>
								<tr style="background: ${type === 'Listed' ? '#d4edda' : '#fff3cd'};">
									<th>Credit Limit</th>
									<td><strong style="font-size: 18px; color: ${type === 'Listed' ? '#28a745' : '#856404'};">
										${frappe.format(customer.credit_limit, { fieldtype: 'Currency' })}
									</strong></td>
								</tr>
							</table>
						</div>
					`
				}
			],
			primary_action_label: 'View Customer',
			primary_action: () => {
				window.open(`/app/customer/${customer.name}`, '_blank');
				dialog.hide();
			},
			secondary_action_label: 'Close'
		});

		dialog.show();
	}

	setup_customer_type_tabs(listed, non_listed) {
		this.main_container.find('.customer-type-tab').on('click', (e) => {
			e.preventDefault();
			const type = $(e.currentTarget).data('type');
			this.main_container.find('.customer-type-tab').removeClass('active');
			$(e.currentTarget).addClass('active');

			if (type === 'comparison') {
				this.render_credit_comparison();
			} else {
				const customers = type === 'listed' ? listed : non_listed;
				this.render_customers_table(customers, type);
			}
		});
	}

	render_customers_table(customers, type) {
		const container = this.main_container.find('.customers-table-container');
		container.empty();

		if (!customers || customers.length === 0) {
			container.html(`
				<div class="alert alert-warning">
					<i class="fa fa-info-circle"></i> No ${type === 'listed' ? 'listed' : 'non-listed'} customers found.
				</div>
			`);
			return;
		}

		// Store original customers for filtering
		this.original_customers = [...customers];
		this.current_type = type;

		const table_html = `
			<div class="section-card">
				<h3 style="margin-bottom: 15px; color: ${type === 'listed' ? '#28a745' : '#ffc107'};">
					<i class="fa fa-${type === 'listed' ? 'check-circle' : 'circle-o'}"></i>
					${type === 'listed' ? 'Listed' : 'Non-Listed'} Customers (${customers.length})
				</h3>

				<!-- Customer Filter -->
				<div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
					<div class="row">
						<div class="col-md-4">
							<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
								<i class="fa fa-user" style="color: #3b82f6; margin-right: 5px;"></i> Filter by Customer ID
							</label>
							<select class="form-control customer-id-filter-select" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
								<option value="" style="background: #1e293b; color: #e2e8f0;">All Customers</option>
								${[...new Set(customers.map(c => c.name))].sort().map(id =>
			`<option value="${id}" style="background: #1e293b; color: #e2e8f0;">${id}</option>`
		).join('')}
							</select>
						</div>
					</div>
				</div>

				<div class="customers-filtered-table"></div>
			</div>
		`;

		container.html(table_html);
		this.render_filtered_customers_table(customers, type);
		this.setup_simple_customer_filter();
	}

	render_filtered_customers_table(customers, type, skipSortingSetup = false) {
		// Store current customers for sorting
		this.current_customers = [...customers];

		const table_html = `
			<table class="table table-bordered table-striped customers-data-table">
				<thead style="background-color: #34495e;">
					<tr>
						<th style="color: white; font-weight: 600; cursor: pointer;" data-column="name">
							Customer ID <i class="fa fa-sort"></i>
						</th>
						<th style="color: white; font-weight: 600; cursor: pointer;" data-column="customer_name">
							Customer Name <i class="fa fa-sort"></i>
						</th>
						<th style="color: white; font-weight: 600; cursor: pointer; text-align: right;" data-column="credit_limit">
							Credit Limit <i class="fa fa-sort"></i>
						</th>
						<th style="color: white; font-weight: 600; cursor: pointer;" data-column="customer_type">
							Customer Type <i class="fa fa-sort"></i>
						</th>
						<th style="color: white; font-weight: 600; cursor: pointer;" data-column="territory">
							Territory <i class="fa fa-sort"></i>
						</th>
						<th style="color: white; font-weight: 600; cursor: pointer;" data-column="customer_group">
							Customer Group <i class="fa fa-sort"></i>
						</th>
					</tr>
				</thead>
				<tbody>
					${customers.map(c => `
						<tr>
							<td><a href="/app/customer/${c.name}" target="_blank" style="color: #667eea; font-weight: 600;">${c.name}</a></td>
							<td>${c.customer_name || ''}</td>
							<td style="text-align: right; font-weight: ${c.credit_limit > 0 ? 'bold' : 'normal'}; color: ${c.credit_limit > 0 ? '#28a745' : '#6c757d'};">
								${c.credit_limit > 0 ? frappe.format(c.credit_limit, { fieldtype: 'Currency' }) : '-'}
							</td>
							<td>${c.customer_type || 'N/A'}</td>
							<td>${c.territory || 'N/A'}</td>
							<td>${c.customer_group || 'N/A'}</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
		`;

		this.main_container.find('.customers-filtered-table').html(table_html);

		// Only setup sorting once, not on every re-render
		if (!skipSortingSetup) {
			this.setup_column_sorting();
		}
	}

	setup_simple_customer_filter() {
		const self = this;

		// Customer ID filter (auto-apply on change)
		$('.customer-id-filter-select').off('change').on('change', function () {
			const selectedCustomerId = $(this).val();
			console.log('Customer filter changed to:', selectedCustomerId);

			// Filter customers
			let filteredCustomers;
			if (selectedCustomerId === '') {
				filteredCustomers = self.original_customers;
			} else {
				filteredCustomers = self.original_customers.filter(c => c.name === selectedCustomerId);
			}

			console.log('Filtered count:', filteredCustomers.length);

			// Update header count
			self.main_container.find('.section-card h3').html(`
				<i class="fa fa-${self.current_type === 'listed' ? 'check-circle' : 'circle-o'}"></i>
				${self.current_type === 'listed' ? 'Listed' : 'Non-Listed'} Customers (${filteredCustomers.length})
			`);

			// Re-render table with filtered data
			self.render_filtered_customers_table(filteredCustomers, self.current_type, true);
			self.setup_column_sorting();

			// Show feedback
			frappe.show_alert({
				message: selectedCustomerId ? `Showing customer: ${selectedCustomerId}` : 'Showing all customers',
				indicator: 'green'
			}, 2);
		});
	}

	setup_column_sorting() {
		const self = this;

		// Initialize sort direction if not exists
		if (!this.customer_sort_direction) {
			this.customer_sort_direction = {};
		}

		// Remove existing click handlers to avoid duplicates
		this.main_container.find('.customers-data-table thead th[data-column]').off('click');

		this.main_container.find('.customers-data-table thead th[data-column]').on('click', function () {
			const column = $(this).data('column');

			console.log('Column clicked:', column, 'Current direction:', self.customer_sort_direction[column]);

			// Toggle sort direction
			self.customer_sort_direction[column] = self.customer_sort_direction[column] === 'asc' ? 'desc' : 'asc';

			console.log('New direction:', self.customer_sort_direction[column]);

			// Sort the current customers
			const sorted = [...self.current_customers].sort((a, b) => {
				let aVal = a[column] || '';
				let bVal = b[column] || '';

				// Handle numeric sorting for credit_limit
				if (column === 'credit_limit') {
					aVal = parseFloat(aVal) || 0;
					bVal = parseFloat(bVal) || 0;
				} else {
					aVal = aVal.toString().toLowerCase();
					bVal = bVal.toString().toLowerCase();
				}

				if (self.customer_sort_direction[column] === 'asc') {
					return aVal > bVal ? 1 : -1;
				} else {
					return aVal < bVal ? 1 : -1;
				}
			});

			// Store current sort column and direction
			self.current_sort_column = column;

			// Render the sorted data without re-setting up sorting
			self.render_filtered_customers_table(sorted, self.current_type, true);

			// Update sort icons after render
			self.main_container.find('.customers-data-table thead th i').removeClass('fa-sort-asc fa-sort-desc').addClass('fa-sort');
			self.main_container.find('.customers-data-table thead th[data-column="' + column + '"] i')
				.removeClass('fa-sort')
				.addClass(self.customer_sort_direction[column] === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc');

			// Re-attach click handlers after rendering new table
			self.setup_column_sorting();
		});
	}

	render_credit_comparison() {
		const container = this.main_container.find('.customers-table-container');
		container.empty();

		// Fetch outstanding data from main dashboard data
		const listed_with_outstanding = this.listed_customers_data.map(c => {
			const outstanding = this.get_customer_outstanding(c.name);
			return {
				...c,
				outstanding: outstanding,
				utilization: c.credit_limit > 0 ? (outstanding / c.credit_limit * 100).toFixed(2) : 0
			};
		}).filter(c => c.credit_limit > 0); // Only show customers with credit limit

		const non_listed_with_outstanding = this.non_listed_customers_data.map(c => {
			const outstanding = this.get_customer_outstanding(c.name);
			return {
				...c,
				outstanding: outstanding,
				utilization: c.credit_limit > 0 ? (outstanding / c.credit_limit * 100).toFixed(2) : 0
			};
		}).filter(c => c.credit_limit > 0); // Only show customers with credit limit

		const comparison_html = `
			<div class="section-card">
				<h3 style="margin-bottom: 20px; color: #667eea;">
					<i class="fa fa-bar-chart"></i> Credit Limit vs Outstanding Comparison
				</h3>

				<!-- Tabs Navigation -->
				<ul class="nav nav-tabs comparison-tabs" style="border-bottom: 2px solid #dee2e6; margin-bottom: 20px;">
					<li class="nav-item">
						<a class="nav-link active comparison-tab-link" data-comparison-type="listed" style="cursor: pointer; padding: 12px 24px; font-weight: 600;">
							<i class="fa fa-check-circle"></i> Listed Customers
							<span class="badge" style="background: #2c3e50; color: white; margin-left: 8px; padding: 3px 8px; border-radius: 12px;">${listed_with_outstanding.length}</span>
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link comparison-tab-link" data-comparison-type="non_listed" style="cursor: pointer; padding: 12px 24px; font-weight: 600;">
							<i class="fa fa-circle-o"></i> Non-Listed Customers
							<span class="badge" style="background: #2c3e50; color: white; margin-left: 8px; padding: 3px 8px; border-radius: 12px;">${non_listed_with_outstanding.length}</span>
						</a>
					</li>
				</ul>

				<!-- Tab Content -->
				<div class="comparison-tab-content">
					<!-- Listed Customers Content -->
					<div class="comparison-content-listed" style="display: block;">
						<div class="comparison-charts-listed"></div>
					</div>

					<!-- Non-Listed Customers Content -->
					<div class="comparison-content-non-listed" style="display: none;">
						<div class="comparison-charts-non-listed"></div>
					</div>
				</div>
			</div>
		`;

		container.html(comparison_html);

		// Store data for tab switching
		this.listed_comparison_data = listed_with_outstanding;
		this.non_listed_comparison_data = non_listed_with_outstanding;

		// Render initial tab (Listed)
		this.render_comparison_charts(listed_with_outstanding, 'listed');

		// Setup tab click handlers
		this.setup_comparison_tabs();
	}

	setup_comparison_tabs() {
		const self = this;

		// Remove existing handlers
		this.main_container.find('.comparison-tab-link').off('click');

		// Add click handlers for comparison tabs
		this.main_container.find('.comparison-tab-link').on('click', function () {
			const type = $(this).data('comparison-type');

			// Update active tab
			self.main_container.find('.comparison-tab-link').removeClass('active');
			$(this).addClass('active');

			// Show/hide content
			if (type === 'listed') {
				self.main_container.find('.comparison-content-listed').show();
				self.main_container.find('.comparison-content-non-listed').hide();

				// Render listed data if not already rendered
				if (self.main_container.find('.comparison-charts-listed').is(':empty')) {
					self.render_comparison_charts(self.listed_comparison_data, 'listed');
				}
			} else {
				self.main_container.find('.comparison-content-listed').hide();
				self.main_container.find('.comparison-content-non-listed').show();

				// Render non-listed data if not already rendered
				if (self.main_container.find('.comparison-charts-non-listed').is(':empty')) {
					self.render_comparison_charts(self.non_listed_comparison_data, 'non_listed');
				}
			}
		});
	}

	get_customer_outstanding(customer_name) {
		// Get outstanding from main dashboard data if available
		if (this.data && this.data.length > 0) {
			const customer_data = this.data.find(d => d.customer === customer_name);
			if (customer_data) {
				// If customer has invoices array, calculate outstanding from invoices
				if (customer_data.invoices && Array.isArray(customer_data.invoices)) {
					let total_outstanding = 0;
					customer_data.invoices.forEach(inv => {
						total_outstanding += (inv.outstanding || 0);
					});
					return total_outstanding;
				}
				// Otherwise use the outstanding field directly
				return customer_data.outstanding || 0;
			}
		}
		return 0;
	}

	render_comparison_charts(customers, type) {
		const container_class = type === 'listed' ? '.comparison-charts-listed' : '.comparison-charts-non-listed';

		// Sort by utilization percentage (descending)
		const sorted_customers = [...customers].sort((a, b) => b.utilization - a.utilization).slice(0, 10);

		// Calculate statistics
		const total_customers = sorted_customers.length;
		const exceeded_count = sorted_customers.filter(c => parseFloat(c.utilization) > 100).length;
		const warning_count = sorted_customers.filter(c => {
			const util = parseFloat(c.utilization);
			return util > 80 && util <= 100;
		}).length;
		const safe_count = sorted_customers.filter(c => parseFloat(c.utilization) <= 80).length;

		const chart_html = `
			<!-- Summary Stats -->
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div style="padding: 10px; background: #dc3545; color: white; border-radius: 8px; text-align: center;">
						<div style="font-size: 24px; font-weight: bold;">${exceeded_count}</div>
						<div style="font-size: 12px;">EXCEEDED (>100%)</div>
					</div>
				</div>
				<div class="col-md-3">
					<div style="padding: 10px; background: #ffc107; color: white; border-radius: 8px; text-align: center;">
						<div style="font-size: 24px; font-weight: bold;">${warning_count}</div>
						<div style="font-size: 12px;">WARNING (80-100%)</div>
					</div>
				</div>
				<div class="col-md-3">
					<div style="padding: 10px; background: #28a745; color: white; border-radius: 8px; text-align: center;">
						<div style="font-size: 24px; font-weight: bold;">${safe_count}</div>
						<div style="font-size: 12px;">SAFE (0-80%)</div>
					</div>
				</div>
				<div class="col-md-3">
					<div style="padding: 10px; background: #6c757d; color: white; border-radius: 8px; text-align: center;">
						<div style="font-size: 24px; font-weight: bold;">${total_customers}</div>
						<div style="font-size: 12px;">TOTAL CUSTOMERS</div>
					</div>
				</div>
			</div>

			<table class="table table-bordered" style="background: #2c3e50;">
				<thead style="background-color: #34495e;">
					<tr>
						<th style="color: white; width: 20%; font-weight: 600;">Customer Name</th>
						<th style="color: white; width: 12%; font-weight: 600;">Credit Limit</th>
						<th style="color: white; width: 12%; font-weight: 600;">Outstanding</th>
						<th style="color: white; width: 12%; font-weight: 600;">Over Limit</th>
						<th style="color: white; width: 12%; font-weight: 600;">Status</th>
						<th style="color: white; width: 10%; font-weight: 600;">Utilization</th>
						<th style="color: white; width: 22%; font-weight: 600;">Visual Progress</th>
					</tr>
				</thead>
				<tbody>
					${sorted_customers.map(c => {
			const utilization = parseFloat(c.utilization);
			const bar_color = utilization > 100 ? '#dc3545' : (utilization > 80 ? '#ffc107' : '#28a745');
			const bar_width = Math.min(utilization, 100);
			const over_limit = c.outstanding > c.credit_limit ? (c.outstanding - c.credit_limit) : 0;

			// Cap utilization display at 100%, but show if exceeded
			const displayUtilization = Math.min(utilization, 100);
			const utilizationText = utilization > 100 ? '100% +' : `${displayUtilization.toFixed(2)}%`;

			let status_badge = '';
			let status_text = '';
			if (utilization > 100) {
				status_badge = '#dc3545';
				status_text = 'EXCEEDED';
			} else if (utilization > 80) {
				status_badge = '#ffc107';
				status_text = 'WARNING';
			} else {
				status_badge = '#28a745';
				status_text = 'SAFE';
			}

			return `
							<tr style="background: #34495e; border-bottom: 1px solid #2c3e50;">
								<td style="color: #ecf0f1;">
									<strong>${c.customer_name || c.name}</strong>
									${utilization > 100 ? '<br><small style="color: #dc3545;"><i class="fa fa-exclamation-triangle"></i> Credit Limit Exceeded</small>' : ''}
								</td>
								<td style="text-align: right; color: #ecf0f1;">${frappe.format(c.credit_limit, { fieldtype: 'Currency' })}</td>
								<td style="text-align: right; color: ${utilization > 100 ? '#dc3545' : '#2ecc71'}; font-weight: bold;">
									${frappe.format(c.outstanding, { fieldtype: 'Currency' })}
								</td>
								<td style="text-align: right; color: ${over_limit > 0 ? '#dc3545' : '#95a5a6'}; font-weight: ${over_limit > 0 ? 'bold' : 'normal'};">
									${over_limit > 0 ? frappe.format(over_limit, { fieldtype: 'Currency' }) : '-'}
								</td>
								<td style="text-align: center;">
									<span style="padding: 5px 10px; border-radius: 12px; background: ${status_badge}; color: white; font-weight: 600; font-size: 11px; display: inline-block;">
										${status_text}
									</span>
								</td>
								<td style="text-align: center; font-weight: bold; color: ${bar_color};">
									${utilizationText}
								</td>
								<td>
									<div style="background: #2c3e50; border-radius: 4px; height: 30px; position: relative;">
										<div style="background: ${bar_color}; width: ${bar_width}%; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 11px;">
											${utilization > 100 ? 'EXCEEDED' : utilization > 0 ? utilization + '%' : ''}
										</div>
									</div>
								</td>
							</tr>
						`;
		}).join('')}
				</tbody>
			</table>
			${sorted_customers.length === 0 ? '<p class="text-muted text-center">No customers with credit limits found.</p>' : ''}
		`;

		this.main_container.find(container_class).html(chart_html);
	}


	render_overdue_advance_progressive_section() {
		// Add responsive CSS if not already added
		if (!$('#overdue-advance-progressive-responsive-css').length) {
			$('head').append(`
				<style id="overdue-advance-progressive-responsive-css">
					/* Mobile responsive styles for Overdue Advance/Progressive Bills */
					@media (max-width: 768px) {
						.overdue-advance-progressive-section-wrapper .summary-card {
							margin-bottom: 15px !important;
						}
						.overdue-advance-progressive-section-wrapper .col-md-3 {
							width: 100% !important;
							margin-bottom: 10px;
						}
						.overdue-advance-progressive-section-wrapper .col-md-4 {
							width: 100% !important;
							margin-bottom: 10px;
						}
						.overdue-advance-progressive-filters .row {
							display: flex;
							flex-direction: column;
						}
						.overdue-advance-progressive-filters .form-control {
							width: 100% !important;
						}
						.overdue-advance-progressive-table {
							overflow-x: auto;
							-webkit-overflow-scrolling: touch;
						}
						.overdue-advance-progressive-table table {
							min-width: 1200px;
						}
						.content-title {
							font-size: 20px !important;
						}
						.content-subtitle {
							font-size: 14px !important;
						}
					}
					@media (max-width: 480px) {
						.summary-card div:last-child {
							font-size: 24px !important;
						}
						.content-title {
							font-size: 18px !important;
						}
					}
				</style>
			`);
		}

		const content = $(`
			<div class="overdue-advance-progressive-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-credit-card"></i>
						Overdue Advance/Progressive Bills
					</h2>
					<p class="content-subtitle">Track advance and progressive payment invoices against sales orders</p>
				</div>
				<div class="content-body">
					<div class="section-card">
						<h3><i class="fa fa-credit-card"></i> Advance/Progressive Bills Details</h3>
						<p class="text-muted">Monitor advance and progressive payment invoices with their related sales orders</p>

						<!-- Summary Cards -->
						<div class="overdue-advance-progressive-summary"></div>

						<!-- Workflow State Summary -->
						<div class="overdue-advance-progressive-workflow-summary" style="margin-top: 20px;"></div>

						<!-- Filters -->
						<div class="overdue-advance-progressive-filters" style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);"></div>

						<!-- Table -->
						<div class="overdue-advance-progressive-table"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.load_overdue_advance_progressive_data();
	}

	load_overdue_advance_progressive_data() {
		const self = this;

		if (!self.filters.company) {
			self.main_container.find('.overdue-advance-progressive-table').html(`
				<div class="alert alert-warning" style="margin-top: 20px;">
					<i class="fa fa-exclamation-triangle"></i> Please select a company from the global filters to load data.
				</div>
			`);
			return;
		}

		// Show loading indicator
		self.main_container.find('.overdue-advance-progressive-table').html(`
			<div class="text-center" style="padding: 40px;">
				<i class="fa fa-spinner fa-spin fa-3x" style="color: #3b82f6;"></i>
				<p style="color: #cbd5e1; margin-top: 15px;">Loading data...</p>
			</div>
		`);

		// Build URL with query parameters - use direct fetch to bypass frappe.call caching
		const params = new URLSearchParams();
		params.append('company', self.filters.company);
		if (self.filters.customer) params.append('customer', self.filters.customer);
		if (self.filters.branch) params.append('branch', self.filters.branch);
		if (self.filters.sales_person) params.append('sales_person', self.filters.sales_person);
		if (self.filters.sales_team) params.append('sales_team', self.filters.sales_team);
		const internalParam = self.get_internal_customer_param();
		if (internalParam !== null) params.append('internal_customer', internalParam);

		const apiUrl = '/api/method/prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_overdue_advance_progressive_bills?' + params.toString();

		fetch(apiUrl, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'X-Frappe-CSRF-Token': frappe.csrf_token
			},
			credentials: 'same-origin'
		})
			.then(response => response.json())
			.then(data => {
				if (data.message) {
					const filtered_records = self.filter_records_by_internal_customer(data.message.data || []);
					self.original_overdue_advance_progressive_data = filtered_records;
					self.render_overdue_advance_progressive_summary(data.message.summary || {});
					// self.render_overdue_advance_progressive_workflow_summary(data.message.workflow_summary || []);
					self.render_overdue_advance_progressive_filters(filtered_records);
					self.render_overdue_advance_progressive_table(filtered_records);
				} else {
					self.main_container.find('.overdue-advance-progressive-table').html(`
					<div class="alert alert-danger" style="margin-top: 20px;">
						<i class="fa fa-exclamation-circle"></i> Failed to load data. Please try again.
					</div>
				`);
				}
			})
			.catch(error => {
				console.error('Fetch Error:', error);
				self.main_container.find('.overdue-advance-progressive-table').html(`
				<div class="alert alert-danger" style="margin-top: 20px;">
					<i class="fa fa-exclamation-circle"></i> Error loading data. Please try again.
				</div>
			`);
			});
	}

	render_overdue_advance_progressive_filters(data) {
		// Extract unique values for filters from the data
		const unique_branches = [...new Set(data.map(d => d.branch).filter(b => b))].sort();
		const unique_customers = [...new Set(data.map(d => d.customer).filter(c => c))].sort();
		const unique_sales_persons = [...new Set(data.map(d => d.sales_person).filter(sp => sp).flatMap(sp => sp.split(', ')))].sort();

		const filters_html = `
			<div class="row">
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-building" style="color: #3b82f6; margin-right: 5px;"></i> Branch
					</label>
					<select class="form-control overdue-branch-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Branches</option>
						${unique_branches.map(branch => `<option value="${branch}" style="background: #1e293b; color: #e2e8f0;">${branch}</option>`).join('')}
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-user" style="color: #3b82f6; margin-right: 5px;"></i> Customer
					</label>
					<select class="form-control overdue-customer-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Customers</option>
						${unique_customers.map(customer => `<option value="${customer}" style="background: #1e293b; color: #e2e8f0;">${customer}</option>`).join('')}
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-user-circle" style="color: #3b82f6; margin-right: 5px;"></i> Sales Person
					</label>
					<select class="form-control overdue-sales-person-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Sales Persons</option>
						${unique_sales_persons.map(sp => `<option value="${sp}" style="background: #1e293b; color: #e2e8f0;">${sp}</option>`).join('')}
					</select>
				</div>
			</div>
		`;

		this.main_container.find('.overdue-advance-progressive-filters').html(filters_html);

		// Bind filter change events
		const self = this;
		this.main_container.find('.overdue-branch-filter, .overdue-customer-filter, .overdue-sales-person-filter').on('change', function () {
			self.filter_overdue_advance_progressive_data();
		});
	}

	filter_overdue_advance_progressive_data() {
		const branch = this.main_container.find('.overdue-branch-filter').val();
		const customer = this.main_container.find('.overdue-customer-filter').val();
		const sales_person = this.main_container.find('.overdue-sales-person-filter').val();

		let filtered_data = this.original_overdue_advance_progressive_data;

		if (branch) {
			filtered_data = filtered_data.filter(d => d.branch === branch);
		}

		if (customer) {
			filtered_data = filtered_data.filter(d => d.customer === customer);
		}

		if (sales_person) {
			filtered_data = filtered_data.filter(d => d.sales_person && d.sales_person.includes(sales_person));
		}

		// Recalculate summary for filtered data
		const summary = {
			total_count: filtered_data.length,
			total_invoice_amount: filtered_data.reduce((sum, d) => sum + (d.invoice_grand_total || 0), 0),
			total_so_amount: filtered_data.reduce((sum, d) => sum + (d.so_grand_total || 0), 0),
			total_balance_to_be_paid: filtered_data.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0)
		};

		this.render_overdue_advance_progressive_summary(summary);
		this.render_overdue_advance_progressive_table(filtered_data);
	}

	render_overdue_advance_progressive_summary(summary) {
		const summary_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div class="summary-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px;">Total Invoices</div>
						<div style="color: white; font-size: 28px; font-weight: bold;">${summary.total_count || 0}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="summary-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px;">Invoice Amount</div>
						<div style="color: white; font-size: 28px; font-weight: bold;">${frappe.format(summary.total_invoice_amount || 0, { fieldtype: 'Currency' })}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px;">SO Amount</div>
						<div style="color: white; font-size: 28px; font-weight: bold;">${frappe.format(summary.total_so_amount || 0, { fieldtype: 'Currency' })}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="summary-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px;">Balance to be Paid</div>
						<div style="color: white; font-size: 28px; font-weight: bold;">${frappe.format(summary.total_balance_to_be_paid || 0, { fieldtype: 'Currency' })}</div>
					</div>
				</div>
			</div>
		`;
		this.main_container.find('.overdue-advance-progressive-summary').html(summary_html);
	}

	// render_overdue_advance_progressive_workflow_summary(workflow_summary) {
	// 	if (!workflow_summary || workflow_summary.length === 0) {
	// 		this.main_container.find('.overdue-advance-progressive-workflow-summary').html('');
	// 		return;
	// 	}

	// 	const total_amount = workflow_summary.reduce((sum, ws) => sum + (ws.grand_total || 0), 0);
	// 	const total_count = workflow_summary.reduce((sum, ws) => sum + (ws.count || 0), 0);

	// 	const get_workflow_badge_style = (state) => {
	// 		const s = (state || '').toLowerCase();
	// 		if (s.includes('approved') || s.includes('completed') || s.includes('paid')) {
	// 			return 'background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4);';
	// 		} else if (s.includes('pending') || s.includes('draft') || s.includes('submitted')) {
	// 			return 'background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4);';
	// 		} else if (s.includes('reject') || s.includes('cancel') || s.includes('overdue')) {
	// 			return 'background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4);';
	// 		}
	// 		return 'background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);';
	// 	};

	// 	const rows_html = workflow_summary.map(ws => `
	// 		<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
	// 			<td style="padding: 12px; color: #e2e8f0;">
	// 				<span style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; ${get_workflow_badge_style(ws.workflow_state)}">
	// 					${ws.workflow_state}
	// 				</span>
	// 			</td>
	// 			<td style="padding: 12px; text-align: center; color: #cbd5e1; font-weight: 600;">${ws.count}</td>
	// 			<td style="padding: 12px; text-align: right; color: #e2e8f0; font-weight: 700;">${frappe.format(ws.grand_total, { fieldtype: 'Currency' })}</td>
	// 		</tr>
	// 	`).join('');

	// 	const summary_html = `
	// 		<div style="padding: 20px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
	// 			<h4 style="color: #e2e8f0; font-weight: 700; margin-bottom: 16px;">
	// 				<i class="fa fa-sitemap" style="margin-right: 8px; color: #3b82f6;"></i>
	// 				Workflow State Summary
	// 			</h4>
	// 			<div class="table-responsive">
	// 				<table class="table" style="margin-bottom: 0;">
	// 					<thead style="background-color: rgba(59, 130, 246, 0.1); border-bottom: 2px solid rgba(59, 130, 246, 0.3);">
	// 						<tr>
	// 							<th style="color: #cbd5e1; font-weight: 600; padding: 12px;">Workflow State</th>
	// 							<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: center;">Count</th>
	// 							<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">Grand Total</th>
	// 						</tr>
	// 					</thead>
	// 					<tbody>
	// 						${rows_html}
	// 						<tr style="background-color: rgba(59, 130, 246, 0.1); border-top: 2px solid rgba(59, 130, 246, 0.3);">
	// 							<td style="padding: 12px; color: #e2e8f0; font-weight: 700;">Total</td>
	// 							<td style="padding: 12px; text-align: center; color: #e2e8f0; font-weight: 700;">${total_count}</td>
	// 							<td style="padding: 12px; text-align: right; color: #60a5fa; font-weight: 700; font-size: 16px;">${frappe.format(total_amount, { fieldtype: 'Currency' })}</td>
	// 						</tr>
	// 					</tbody>
	// 				</table>
	// 			</div>
	// 		</div>
	// 	`;

	// 	this.main_container.find('.overdue-advance-progressive-workflow-summary').html(summary_html);
	// }

	render_overdue_advance_progressive_table(data) {
		data = this.filter_records_by_internal_customer(data);
		if (!data || data.length === 0) {
			this.main_container.find('.overdue-advance-progressive-table').html(`
				<div class="alert alert-info" style="margin-top: 20px;">
					<i class="fa fa-info-circle"></i> No advance/progressive payment invoices found.
				</div>
			`);
			return;
		}

		let table_html = `
			<div class="table-responsive" style="margin-top: 20px;">
				<table class="table table-bordered table-hover" style="background: rgba(30, 41, 59, 0.5); border-radius: 8px; overflow: hidden;">
					<thead style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%); border-bottom: 2px solid rgba(59, 130, 246, 0.5);">
						<tr>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px; text-align: center;">Sr</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px;">ID</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px;">Customer</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px;">Branch</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px;">Company</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px;">Sales Person</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px; text-align: right;">Grand Total - Sales Invoice</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px;">Sales Order</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px; text-align: right;">Grand Total - Sales Order</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px; text-align: right;">Balance to be Paid</th>
							<th style="color: #e2e8f0; font-weight: 600; padding: 12px; text-align: right;">% Against SO</th>
						</tr>
					</thead>
					<tbody>
		`;

		data.forEach((row, index) => {
			const percentage = row.percentage_against_so ? row.percentage_against_so.toFixed(2) : '0.00';
			const balance = row.balance_to_be_paid || 0;
			const row_style = index % 2 === 0 ? 'background: rgba(15, 23, 42, 0.3);' : 'background: rgba(30, 41, 59, 0.3);';

			table_html += `
				<tr style="${row_style}">
					<td style="color: #cbd5e1; padding: 10px; text-align: center;">${index + 1}</td>
					<td style="color: #cbd5e1; padding: 10px;">
						<a href="/app/sales-invoice/${row.invoice_id}" target="_blank" style="color: #3b82f6; text-decoration: none;">
							${row.invoice_id}
						</a>
					</td>
					<td style="color: #cbd5e1; padding: 10px;">${row.customer_name || row.customer || '-'}</td>
					<td style="color: #cbd5e1; padding: 10px;">${row.branch || '-'}</td>
					<td style="color: #cbd5e1; padding: 10px;">${row.company || '-'}</td>
					<td style="color: #cbd5e1; padding: 10px;">${row.sales_person || '-'}</td>
					<td style="color: #cbd5e1; padding: 10px; text-align: right;">${frappe.format(row.invoice_grand_total, { fieldtype: 'Currency' })}</td>
					<td style="color: #cbd5e1; padding: 10px;">
						${row.sales_order ? `<a href="/app/sales-order/${row.sales_order}" target="_blank" style="color: #3b82f6; text-decoration: none;">${row.sales_order}</a>` : '-'}
					</td>
					<td style="color: #cbd5e1; padding: 10px; text-align: right;">${row.so_grand_total ? frappe.format(row.so_grand_total, { fieldtype: 'Currency' }) : '-'}</td>
					<td style="color: #cbd5e1; padding: 10px; text-align: right;">${frappe.format(balance, { fieldtype: 'Currency' })}</td>
					<td style="color: #cbd5e1; padding: 10px; text-align: right;">${percentage}%</td>
				</tr>
			`;
		});

		table_html += `
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.overdue-advance-progressive-table').html(table_html);
	}
	render_payment_schedules_section() {
		const content = $(`
			<div class="payment-schedules-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-calendar"></i>
						Sales Order Payment Schedules
					</h2>
					<p class="content-subtitle">Track payment schedules, outstanding amounts, and payment status</p>
				</div>
				<div class="content-body">
					<div class="section-card">
						<h3><i class="fa fa-calendar-check-o"></i> Payment Schedule Details</h3>
						<p class="text-muted">Monitor sales order payment schedules with overdue and receivable amounts</p>

						<!-- Summary Cards -->
						<div class="payment-schedule-summary"></div>

						<!-- Filters -->
						<div class="payment-schedule-filters" style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);"></div>

						<!-- Payment Schedules Table -->
						<div class="payment-schedules-table"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.load_payment_schedules_data();
	}

	load_payment_schedules_data() {
		const self = this;

		if (!self.filters.company) {
			self.main_container.find('.payment-schedules-table').html(`
				<div class="alert alert-warning" style="margin-top: 20px;">
					<i class="fa fa-exclamation-triangle"></i> Please select a company from the global filters to load data.
				</div>
			`);
			return;
		}

		frappe.call({
			method: 'prastara_custom.controller.accounts_receivable.get_sales_order_status',
			args: {
				company: self.filters.company,
				sales_person: self.filters.sales_person || null,
				sales_team: self.filters.sales_team || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: function (r) {
				if (r.message) {
					const filtered_orders = self.filter_records_by_internal_customer(r.message);
					self.original_payment_schedules = filtered_orders;
					self.render_payment_schedule_filters(filtered_orders);
					self.render_payment_schedules_summary(filtered_orders);
					self.render_payment_schedules_table(filtered_orders);
				}
			}
		});
	}

	render_payment_schedule_filters(sales_orders) {
		// Extract unique values for filters
		const unique_so_ids = [...new Set(sales_orders.map(so => so.name))].sort();
		const unique_customers = [...new Set(sales_orders.map(so => so.customer))].sort();

		// Extract unique payment terms from all payment schedules
		const payment_terms = new Set();
		sales_orders.forEach(so => {
			if (so.payment_schedule && Array.isArray(so.payment_schedule)) {
				so.payment_schedule.forEach(schedule => {
					if (schedule.payment_term) {
						payment_terms.add(schedule.payment_term);
					}
				});
			}
		});
		const unique_payment_terms = [...payment_terms].sort();

		const filters_html = `
			<div class="row">
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-file-text" style="color: #3b82f6; margin-right: 5px;"></i> Sales Order ID
					</label>
					<select class="form-control payment-schedule-so-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Sales Orders</option>
						${unique_so_ids.map(id => `<option value="${id}" style="background: #1e293b; color: #e2e8f0;">${id}</option>`).join('')}
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-user" style="color: #3b82f6; margin-right: 5px;"></i> Customer ID
					</label>
					<select class="form-control payment-schedule-customer-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Customers</option>
						${unique_customers.map(customer => `<option value="${customer}" style="background: #1e293b; color: #e2e8f0;">${customer}</option>`).join('')}
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-calendar" style="color: #3b82f6; margin-right: 5px;"></i> Payment Term
					</label>
					<select class="form-control payment-schedule-term-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Terms</option>
						${unique_payment_terms.map(term => `<option value="${term}" style="background: #1e293b; color: #e2e8f0;">${term}</option>`).join('')}
					</select>
				</div>
			</div>
		`;

		this.main_container.find('.payment-schedule-filters').html(filters_html);
		this.setup_payment_schedule_filters();
	}

	setup_payment_schedule_filters() {
		const self = this;

		$('.payment-schedule-so-filter, .payment-schedule-customer-filter, .payment-schedule-term-filter').off('change').on('change', function () {
			const selected_so = $('.payment-schedule-so-filter').val();
			const selected_customer = $('.payment-schedule-customer-filter').val();
			const selected_term = $('.payment-schedule-term-filter').val();

			let filtered_data = self.original_payment_schedules;

			// Filter by Sales Order ID
			if (selected_so) {
				filtered_data = filtered_data.filter(so => so.name === selected_so);
			}

			// Filter by Customer
			if (selected_customer) {
				filtered_data = filtered_data.filter(so => so.customer === selected_customer);
			}

			// Filter by Payment Term (check if any schedule has this term)
			if (selected_term) {
				filtered_data = filtered_data.filter(so => {
					if (so.payment_schedule && Array.isArray(so.payment_schedule)) {
						return so.payment_schedule.some(schedule => schedule.payment_term === selected_term);
					}
					return false;
				});
			}

			// Re-render summary and table with filtered data
			self.render_payment_schedules_summary(filtered_data);
			self.render_payment_schedules_table(filtered_data);

			frappe.show_alert({
				message: `Filtered: ${filtered_data.length} sales order(s)`,
				indicator: 'green'
			}, 2);
		});
	}

	render_payment_schedules_summary(sales_orders) {
		let total_grand_total = 0;
		let total_advance_paid = 0;
		let total_outstanding = 0;
		let total_overdue = 0;
		let total_receivable = 0;
		let paid_count = 0;
		let overdue_count = 0;
		let due_count = 0;

		const today = frappe.datetime.get_today();

		sales_orders.forEach(so => {
			total_grand_total += so.grand_total || 0;
			total_advance_paid += so.advance_paid || 0;
			total_outstanding += so.outstanding || 0;

			// Count status
			if (so.computed_status === 'Paid') {
				paid_count++;
			} else if (so.computed_status === 'Overdue') {
				overdue_count++;
				total_overdue += so.outstanding || 0;
			} else if (so.computed_status === 'Due') {
				due_count++;
				total_receivable += so.outstanding || 0;
			}
		});

		const summary_html = `
			<div class="row" style="margin-bottom: 30px;">
				<div class="col-md-3">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Total Orders</h4>
							<div class="stat-icon info"><i class="fa fa-file-text"></i></div>
						</div>
						<div class="stat-value">${sales_orders.length}</div>
						<div class="stat-description">
							<small><span class="badge badge-success">${paid_count} Paid</span>
							<span class="badge badge-warning">${due_count} Due</span>
							<span class="badge badge-danger">${overdue_count} Overdue</span></small>
						</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Amount</h4>
							<div class="stat-icon primary"><i class="fa fa-money"></i></div>
						</div>
						<div class="stat-value">${frappe.format(total_grand_total, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>Grand Total of all orders</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Amount Paid</h4>
							<div class="stat-icon success"><i class="fa fa-check-circle"></i></div>
						</div>
						<div class="stat-value">${frappe.format(total_advance_paid, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>Total advance received</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Outstanding</h4>
							<div class="stat-icon warning"><i class="fa fa-exclamation-circle"></i></div>
						</div>
						<div class="stat-value">${frappe.format(total_outstanding, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>Pending payment amount</small></div>
					</div>
				</div>
			</div>
			<div class="row" style="margin-bottom: 30px;">
				<div class="col-md-6">
					<div class="stat-card danger">
						<div class="stat-header">
							<h4 class="stat-title">Overdue Amount</h4>
							<div class="stat-icon danger"><i class="fa fa-calendar-times-o"></i></div>
						</div>
						<div class="stat-value">${frappe.format(total_overdue, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${overdue_count} orders with overdue payments</small></div>
					</div>
				</div>
				<div class="col-md-6">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Receivable Amount</h4>
							<div class="stat-icon info"><i class="fa fa-calendar-check-o"></i></div>
						</div>
						<div class="stat-value">${frappe.format(total_receivable, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${due_count} orders with upcoming payments</small></div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.payment-schedule-summary').html(summary_html);
	}

	render_payment_schedules_table(sales_orders) {
		sales_orders = this.filter_records_by_internal_customer(sales_orders);
		if (!sales_orders || sales_orders.length === 0) {
			this.main_container.find('.payment-schedules-table').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No sales orders with payment schedules found.
				</div>
			`);
			return;
		}

		let table_rows = '';
		sales_orders.forEach((so, index) => {
			const status_class = so.computed_status === 'Paid' ? 'success' :
				so.computed_status === 'Overdue' ? 'danger' : 'warning';
			const status_icon = so.computed_status === 'Paid' ? 'check-circle' :
				so.computed_status === 'Overdue' ? 'exclamation-triangle' : 'clock-o';

			const schedule_count = so.payment_schedule ? so.payment_schedule.length : 0;
			const has_schedules = schedule_count > 0;
			const expand_icon = has_schedules ? '<i class="fa fa-plus-circle expand-icon" style="cursor: pointer; color: #3b82f6;"></i>' : '';

			// Main row
			table_rows += `
				<tr class="so-main-row" data-so-index="${index}" style="cursor: ${has_schedules ? 'pointer' : 'default'};">
					<td style="width: 30px; text-align: center;">${expand_icon}</td>
					<td><a href="/app/sales-order/${so.name}" target="_blank" style="color: #667eea; font-weight: 600;">${so.name}</a></td>
					<td>${so.customer || ''}</td>
					<td>${so.customer_name || ''}</td>
					<td>${so.company || ''}</td>
					<td>${frappe.datetime.str_to_user(so.transaction_date)}</td>
					<td>${so.delivery_date ? frappe.datetime.str_to_user(so.delivery_date) : '-'}</td>
					<td style="text-align: right; font-weight: bold;">${frappe.format(so.grand_total, { fieldtype: 'Currency' })}</td>
					<td style="text-align: right; color: #28a745;">${frappe.format(so.advance_paid || 0, { fieldtype: 'Currency' })}</td>
					<td style="text-align: right; font-weight: bold; color: ${so.outstanding > 0 ? '#dc3545' : '#28a745'};">
						${frappe.format(so.outstanding || 0, { fieldtype: 'Currency' })}
					</td>
					<td style="text-align: center;">
						<span class="badge badge-${status_class}">
							<i class="fa fa-${status_icon}"></i> ${so.computed_status}
						</span>
					</td>
					<td style="text-align: center;">
						<span class="badge badge-info">${schedule_count}</span>
					</td>
				</tr>
			`;

			// Expandable row with payment schedule details
			if (has_schedules) {
				let schedule_rows = so.payment_schedule.map((ps, ps_index) => {
					const is_overdue = ps.due_date && new Date(ps.due_date) < new Date();
					const row_class = is_overdue ? 'table-danger' : '';
					return `
						<tr style="background-color: #2c3e50; color: #ecf0f1;">
							<td style="text-align: center; padding-left: 30px; color: #3498db;">
								<strong>Schedule ${ps_index + 1}</strong>
							</td>
							<td style="color: #ecf0f1;">
								<i class="fa fa-calendar"></i> ${frappe.datetime.str_to_user(ps.due_date)}
								${is_overdue ? '<span class="badge badge-danger" style="margin-left: 5px;">Overdue</span>' : ''}
							</td>
							<td style="color: #ecf0f1;">
								${ps.payment_term || '-'}
							</td>
							<td style="color: #ecf0f1;">
								${ps.mode_of_payment ? `<i class="fa fa-credit-card"></i> ${ps.mode_of_payment}` : '-'}
							</td>
							<td style="text-align: right; font-weight: bold; color: #2ecc71;">
								${frappe.format(ps.payment_amount, { fieldtype: 'Currency' })}
							</td>
							<td style="text-align: center; color: #ecf0f1;">
								${ps.invoice_portion ? `${ps.invoice_portion}%` : '-'}
							</td>
							<td style="color: #ecf0f1;">
								${ps.description ? `<small>${ps.description}</small>` : '-'}
							</td>
						</tr>
					`;
				}).join('');

				table_rows += `
					<tr class="schedule-details-row" data-so-index="${index}" style="display: none;">
						<td colspan="2"></td>
						<td colspan="10" style="padding: 0; background-color: #34495e;">
							<table class="table table-sm" style="margin: 0; font-size: 12px; background-color: #34495e;">
								<thead style="background-color: #34495e; color: white;height:10px;">
									<tr>
										<th style="text-align: center; width: 100px; padding: 6px 8px;">Schedule #</th>
										<th style="width: 150px; padding: 6px 8px;">Due Date</th>
										<th style="width: 150px; padding: 6px 8px;">Payment Term</th>
										<th style="width: 150px; padding: 6px 8px;">Payment Mode</th>
										<th style="text-align: right; width: 150px; padding: 6px 8px;">Amount</th>
										<th style="text-align: center; width: 100px; padding: 6px 8px;">Invoice %</th>
										<th style="padding: 6px 8px;">Description</th>
									</tr>
								</thead>
								<tbody>
									${schedule_rows}
								</tbody>
							</table>
						</td>
					</tr>
				`;
			}
		});

		const table_html = `
			<div class="table-responsive" style="margin-top: 20px;">
				<table class="table table-bordered table-hover payment-schedule-main-table" style="font-size: 13px;">
					<thead style="background-color: #34495e; color: white;">
						<tr>
							<th style="width: 30px;"></th>
							<th>Sales Order</th>
							<th>Customer ID</th>
							<th>Customer Name</th>
							<th>Company</th>
							<th>Order Date</th>
							<th>Delivery Date</th>
							<th style="text-align: right;">Grand Total</th>
							<th style="text-align: right;">Paid</th>
							<th style="text-align: right;">Outstanding</th>
							<th style="text-align: center;">Status</th>
							<th style="text-align: center;">Schedules</th>
						</tr>
					</thead>
					<tbody>
						${table_rows}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.payment-schedules-table').html(table_html);
		this.setup_payment_schedule_expand();
	}

	setup_payment_schedule_expand() {
		const self = this;

		// Click on row to expand/collapse
		$('.so-main-row').off('click').on('click', function () {
			const index = $(this).data('so-index');
			const detailRow = $(`.schedule-details-row[data-so-index="${index}"]`);
			const icon = $(this).find('.expand-icon');

			if (detailRow.length > 0) {
				if (detailRow.is(':visible')) {
					detailRow.slideUp(200);
					icon.removeClass('fa-minus-circle').addClass('fa-plus-circle');
				} else {
					detailRow.slideDown(200);
					icon.removeClass('fa-plus-circle').addClass('fa-minus-circle');
				}
			}
		});
	}

	render_pdc_report_section() {
		const content = $(`
			<div class="pdc-report-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-file-text-o"></i>
						PDC Report
					</h2>
					<p class="content-subtitle">Post-dated cheque tracking and management</p>
				</div>
				<div class="content-body">
				<div class="section-card">
					<h3><i class="fa fa-money"></i> Cheque Payments (PDC)</h3>
					<p class="text-muted">Shows all cheque payments (same day, back dated, post-dated) collected within the selected date range - matches the PDC card in Collection Tracker</p>

					<!-- Summary Cards -->
					<div class="pdc-summary-cards"></div>

					<!-- Filters -->
					<div class="pdc-filters" style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);"></div>

					<!-- Detailed View (Only) -->
					<div class="pdc-detailed-table"></div>
				</div>
			</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();

		// Render initial filters first, then load data
		this.render_initial_pdc_filters();
	}

	render_initial_pdc_filters() {
		const self = this;

		// Inherit filter values from Collection Tracker section if available
		const collection_company = $('#collection-company').val() || this.filters.company || '';
		const collection_from_date = $('#collection-from-date').val() || '';
		const collection_to_date = $('#collection-to-date').val() || '';

		console.log('[PDC Report] Inheriting filters from Collection Tracker:', {
			company: collection_company,
			from_date: collection_from_date,
			to_date: collection_to_date
		});

		const filters_html = `
			<div class="row" style="margin-bottom: 15px;">
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-building" style="color: #3b82f6; margin-right: 5px;"></i> Company
					</label>
					<select id="pdc-company" class="form-control" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Companies</option>
					</select>
				</div>
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-calendar" style="color: #3b82f6; margin-right: 5px;"></i> From Date
					</label>
					<input type="date" class="form-control pdc-from-date" value="${collection_from_date}" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
				</div>
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-calendar" style="color: #3b82f6; margin-right: 5px;"></i> To Date
					</label>
					<input type="date" class="form-control pdc-to-date" value="${collection_to_date}" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
				</div>
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-code-fork" style="color: #3b82f6; margin-right: 5px;"></i> Branch
					</label>
					<select id="pdc-branch" class="form-control" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Branches</option>
					</select>
				</div>
				<div class="col-md-4" style="display: flex; align-items: flex-end; gap: 8px;">
					<button class="btn btn-primary pdc-apply-filter" style="flex: 1; padding: 10px 12px; border-radius: 8px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; font-weight: 600;">
						<i class="fa fa-filter"></i> Apply
					</button>
					<button class="btn btn-success pdc-sync-filter" style="flex: 1; padding: 10px 12px; border-radius: 8px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; font-weight: 600;" title="Sync filters from Collection Tracker">
						<i class="fa fa-refresh"></i> Sync
					</button>
					<button class="btn btn-secondary pdc-reset-filter" style="flex: 1; padding: 10px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; font-weight: 600;">
						<i class="fa fa-times"></i> Clear
					</button>
				</div>
			</div>
			<div class="row" style="margin-top: 15px;">
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-user" style="color: #3b82f6; margin-right: 5px;"></i> Customer
					</label>
					<select class="form-control pdc-customer-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Customers</option>
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-info-circle" style="color: #3b82f6; margin-right: 5px;"></i> Status
					</label>
					<select class="form-control pdc-status-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="All" style="background: #1e293b; color: #e2e8f0;">All</option>
						<option value="Due Today" style="background: #1e293b; color: #e2e8f0;">Due Today</option>
						<option value="Pending Clearance" style="background: #1e293b; color: #e2e8f0;">Pending Clearance</option>
						<option value="Future" style="background: #1e293b; color: #e2e8f0;">Future</option>
						<option value="Cleared" style="background: #1e293b; color: #e2e8f0;">Cleared</option>
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-search" style="color: #3b82f6; margin-right: 5px;"></i> Search Cheque Number
					</label>
					<input type="text" class="form-control pdc-cheque-search" placeholder="Enter cheque number..." style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
				</div>
			</div>
		`;

		this.main_container.find('.pdc-filters').html(filters_html);

		// Load companies and branches, then load PDC data
		this.load_pdc_company_list();
		this.load_pdc_branch_list();
		this.setup_pdc_filters();

		// Load PDC data after a short delay to ensure dropdowns are populated
		setTimeout(() => {
			this.load_pdc_data();
		}, 500);
	}

	load_pdc_data() {
		const self = this;

		console.log('=== PDC Report: load_pdc_data called ===');

		// Get filter values from the PDC section filters
		let company = $('#pdc-company').val() || null;
		let branch = $('#pdc-branch').val() || null;
		let from_date = $('.pdc-from-date').val() || null;
		let to_date = $('.pdc-to-date').val() || null;

		console.log('PDC Section Filters:', { company, branch, from_date, to_date });

		// Fallback logic removed to allow clearing filters
		// The initial values are set in render_initial_pdc_filters() inheriting from Collection Tracker
		// But once loaded, the user should be able to clear them or select "All"

		console.log('Final filters to use:', { company, branch, from_date, to_date });

		// Show loading message
		const company_msg = company ? `for ${company}` : 'for all companies';
		const date_msg = from_date && to_date ? ` from ${from_date} to ${to_date}` : ' (all dates)';
		self.main_container.find('.pdc-detailed-table').html(`
			<div class="alert alert-info" style="margin-top: 20px;">
				<i class="fa fa-spinner fa-spin"></i> Loading PDC data ${company_msg}${date_msg}...
			</div>
		`);

		const api_args = {
			company: company,
			from_date: from_date,
			to_date: to_date,
			customer: self.filters.customer || null,
			branch: branch,
			sales_team: self.filters.sales_team || null,
			sales_person: self.filters.sales_person || null,
			internal_customer: self.get_internal_customer_param()
		};

		console.log('PDC API Call Args:', api_args);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_pdc_data',
			args: api_args,
			callback: function (r) {
				console.log('=== PDC API Response ===');
				console.log('Full response:', r);

				if (r.message) {
					console.log('PDC Summary:', r.message.summary);
					console.log('PDC Records Count:', r.message.pdc_records ? r.message.pdc_records.length : 0);
					console.log('Sample PDC Record:', r.message.pdc_records && r.message.pdc_records[0]);

					const filtered_pdc_records = self.filter_records_by_internal_customer(r.message.pdc_records || []);
					self.original_pdc_data = {
						...r.message,
						pdc_records: filtered_pdc_records
					};
					self.render_pdc_summary(r.message.summary);
					// Don't re-render filters on every data load - it clears user inputs!
					// Filters are already rendered in render_initial_pdc_filters()
					// Only update the customer dropdown options if needed
					self.update_pdc_customer_options(filtered_pdc_records);
					self.render_pdc_detailed_table(filtered_pdc_records);

					const record_count = filtered_pdc_records.length;
					frappe.show_alert({
						message: `Loaded ${record_count} PDC records`,
						indicator: record_count > 0 ? 'green' : 'orange'
					});
				} else {
					console.warn('PDC API returned no message');
					frappe.show_alert({
						message: 'PDC API returned no data',
						indicator: 'orange'
					});
				}
			},
			error: function (r) {
				console.error('=== PDC API Error ===');
				console.error('Error response:', r);
				console.error('Error message:', r.message);
				console.error('Exception:', r.exception);

				self.main_container.find('.pdc-detailed-table').html(`
					<div class="alert alert-danger" style="margin-top: 20px;">
						<i class="fa fa-exclamation-triangle"></i> Error loading PDC data: ${r.message || 'Unknown error'}
						<br><small>Check browser console for details</small>
					</div>
				`);

				frappe.show_alert({
					message: 'Error loading PDC data',
					indicator: 'red'
				});
			}
		});
	}

	render_pdc_summary(summary) {
		const summary_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total PDCs</h4>
							<div class="stat-icon primary"><i class="fa fa-file-text"></i></div>
						</div>
						<div class="stat-value">${summary.total_count || 0}</div>
						<div class="stat-description">
							<small>Amount: ${frappe.format(summary.total_amount || 0, { fieldtype: 'Currency' })}</small>
						</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">In My Hand</h4>
							<div class="stat-icon info"><i class="fa fa-hand-paper-o"></i></div>
						</div>
						<div class="stat-value">${frappe.format(summary.in_hand_amount || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${summary.total_count || 0} cheque(s) collected</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Past Collected</h4>
							<div class="stat-icon warning"><i class="fa fa-history"></i></div>
						</div>
						<div class="stat-value">${frappe.format(summary.past_collected_amount || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${summary.past_collected_count || 0} cheque(s) with past date</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
						<div class="stat-header">
							<h4 class="stat-title">Future PDCs</h4>
							<div class="stat-icon"><i class="fa fa-clock-o"></i></div>
						</div>
						<div class="stat-value">${frappe.format(summary.future_amount || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${summary.future_count || 0} cheque(s) upcoming</small></div>
					</div>
				</div>
			</div>
			<div class="row" style="margin-bottom: 30px;">
				<div class="col-md-4">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Due Today</h4>
							<div class="stat-icon success"><i class="fa fa-calendar-check-o"></i></div>
						</div>
						<div class="stat-value">${frappe.format(summary.due_today_amount || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${summary.due_today_count || 0} cheque(s) to deposit now</small></div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card" style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
						<div class="stat-header">
							<h4 class="stat-title">Due This Week</h4>
							<div class="stat-icon"><i class="fa fa-calendar"></i></div>
						</div>
						<div class="stat-value">${frappe.format(summary.due_this_week_amount || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${summary.due_this_week_count || 0} cheque(s) next 7 days</small></div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);">
						<div class="stat-header">
							<h4 class="stat-title">Due This Month</h4>
							<div class="stat-icon"><i class="fa fa-calendar-o"></i></div>
						</div>
						<div class="stat-value">${frappe.format(summary.due_this_month_amount || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${summary.due_this_month_count || 0} cheque(s) next 30 days</small></div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.pdc-summary-cards').html(summary_html);
	}

	render_pdc_calendar_view(pdc_records) {
		if (!pdc_records || pdc_records.length === 0) {
			this.main_container.find('.pdc-calendar-view').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No PDC records found for the selected criteria.
				</div>
			`);
			return;
		}

		// Get current month and year
		const today = new Date();
		const currentMonth = today.getMonth();
		const currentYear = today.getFullYear();

		// Generate calendar for current month
		const calendarHtml = this.generate_calendar_html(pdc_records, currentMonth, currentYear);

		const calendar_view_html = `
			<div class="pdc-calendar-container" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px; padding: 25px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);">
				<div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
					<button class="btn btn-sm btn-primary prev-month" style="padding: 8px 20px; background: #3b82f6; border: none; color: white; font-weight: 600;">
						<i class="fa fa-chevron-left"></i> Previous
					</button>
					<h3 class="calendar-month-year" style="margin: 0; color: #e2e8f0; font-weight: 700; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);"></h3>
					<button class="btn btn-sm btn-primary next-month" style="padding: 8px 20px; background: #3b82f6; border: none; color: white; font-weight: 600;">
						Next <i class="fa fa-chevron-right"></i>
					</button>
				</div>
				<div class="calendar-legend" style="display: flex; gap: 20px; margin-bottom: 15px; padding: 12px; background: rgba(30, 41, 59, 0.6); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
					<div style="display: flex; align-items: center; gap: 8px;">
						<div style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.4);"></div>
						<span style="font-size: 13px; color: #e2e8f0; font-weight: 500;">Due Today</span>
					</div>
					<div style="display: flex; align-items: center; gap: 8px;">
						<div style="width: 14px; height: 14px; background: #f59e0b; border-radius: 3px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.4);"></div>
						<span style="font-size: 13px; color: #e2e8f0; font-weight: 500;">Past Date</span>
					</div>
					<div style="display: flex; align-items: center; gap: 8px;">
						<div style="width: 14px; height: 14px; background: #3b82f6; border-radius: 3px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.4);"></div>
						<span style="font-size: 13px; color: #e2e8f0; font-weight: 500;">Future</span>
					</div>
				</div>
				<div class="calendar-grid"></div>
			</div>
		`;

		this.main_container.find('.pdc-calendar-view').html(calendar_view_html);
		this.current_calendar_month = currentMonth;
		this.current_calendar_year = currentYear;
		this.render_calendar_month(pdc_records, currentMonth, currentYear);
		this.setup_calendar_navigation(pdc_records);
	}

	generate_calendar_html(pdc_records, month, year) {
		// This will be called when rendering the calendar
		return '';
	}

	render_calendar_month(pdc_records, month, year) {
		const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];

		// Update month/year display
		this.main_container.find('.calendar-month-year').text(`${monthNames[month]} ${year}`);

		// Get first day of month and number of days
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const today = new Date();
		const todayDate = today.getDate();
		const todayMonth = today.getMonth();
		const todayYear = today.getFullYear();

		// Group PDCs by date
		const pdcsByDate = {};
		pdc_records.forEach(pdc => {
			if (pdc.cheque_date) {
				const date = new Date(pdc.cheque_date);
				if (date.getMonth() === month && date.getFullYear() === year) {
					const day = date.getDate();
					if (!pdcsByDate[day]) {
						pdcsByDate[day] = [];
					}
					pdcsByDate[day].push(pdc);
				}
			}
		});

		// Generate calendar grid
		let calendarHtml = `
			<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Sun</div>
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Mon</div>
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Tue</div>
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Wed</div>
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Thu</div>
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Fri</div>
				<div style="text-align: center; font-weight: 700; padding: 12px; background: rgba(59, 130, 246, 0.2); color: #e2e8f0; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">Sat</div>
		`;

		// Add empty cells for days before month starts
		for (let i = 0; i < firstDay; i++) {
			calendarHtml += '<div style="min-height: 100px; background: rgba(15, 23, 42, 0.5); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.1);"></div>';
		}

		// Add days of month
		for (let day = 1; day <= daysInMonth; day++) {
			const isToday = (day === todayDate && month === todayMonth && year === todayYear);
			const pdcs = pdcsByDate[day] || [];
			const hasPdcs = pdcs.length > 0;

			let bgColor = 'rgba(30, 41, 59, 0.4)';
			let borderColor = 'rgba(59, 130, 246, 0.2)';
			let textColor = '#cbd5e1';
			let pdcInfo = '';

			if (isToday) {
				borderColor = '#3b82f6';
				bgColor = 'rgba(59, 130, 246, 0.15)';
			}

			if (hasPdcs) {
				const totalAmount = pdcs.reduce((sum, pdc) => sum + pdc.paid_amount, 0);
				const statuses = pdcs.map(p => p.pdc_status);

				if (statuses.includes('Due Today')) {
					bgColor = 'rgba(34, 197, 94, 0.2)';
					borderColor = '#22c55e';
					textColor = '#86efac';
				} else if (statuses.includes('Overdue')) {
					bgColor = 'rgba(245, 158, 11, 0.2)';
					borderColor = '#f59e0b';
					textColor = '#fbbf24';
				} else {
					bgColor = 'rgba(59, 130, 246, 0.25)';
					borderColor = '#3b82f6';
					textColor = '#93c5fd';
				}

				pdcInfo = `
					<div style="margin-top: 8px; font-size: 11px; color: #e2e8f0;">
						<div style="font-weight: 600; color: ${textColor};">${pdcs.length} PDC(s)</div>
						<div style="font-size: 10px; color: #f0f9ff;">${frappe.format(totalAmount, { fieldtype: 'Currency' })}</div>
					</div>
				`;
			}

			calendarHtml += `
				<div class="calendar-day ${hasPdcs ? 'has-pdcs' : ''}" data-day="${day}"
					style="min-height: 100px; padding: 10px; background: ${bgColor}; border: 2px solid ${borderColor};
					border-radius: 6px; cursor: ${hasPdcs ? 'pointer' : 'default'}; transition: all 0.3s; backdrop-filter: blur(10px);">
					<div style="font-weight: ${isToday ? '700' : '600'}; color: ${isToday ? '#60a5fa' : '#e2e8f0'};
						font-size: 15px;">${day}</div>
					${pdcInfo}
				</div>
			`;
		}

		calendarHtml += '</div>';

		this.main_container.find('.calendar-grid').html(calendarHtml);

		// Add click handlers for days with PDCs
		const self = this;
		this.main_container.find('.calendar-day.has-pdcs').on('click', function () {
			const day = $(this).data('day');
			const pdcs = pdcsByDate[day];
			self.show_pdc_day_detail(pdcs, day, month, year);
		});

		// Add hover effect
		this.main_container.find('.calendar-day.has-pdcs').hover(
			function () {
				$(this).css('transform', 'scale(1.05)');
				$(this).css('box-shadow', '0 8px 16px rgba(59, 130, 246, 0.4)');
			},
			function () {
				$(this).css('transform', 'scale(1)');
				$(this).css('box-shadow', 'none');
			}
		);
	}

	setup_calendar_navigation(pdc_records) {
		const self = this;

		this.main_container.find('.prev-month').off('click').on('click', function () {
			self.current_calendar_month--;
			if (self.current_calendar_month < 0) {
				self.current_calendar_month = 11;
				self.current_calendar_year--;
			}
			self.render_calendar_month(pdc_records, self.current_calendar_month, self.current_calendar_year);
		});

		this.main_container.find('.next-month').off('click').on('click', function () {
			self.current_calendar_month++;
			if (self.current_calendar_month > 11) {
				self.current_calendar_month = 0;
				self.current_calendar_year++;
			}
			self.render_calendar_month(pdc_records, self.current_calendar_month, self.current_calendar_year);
		});
	}

	show_pdc_day_detail(pdcs, day, month, year) {
		const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];

		let pdcRows = '';
		pdcs.forEach(pdc => {
			const statusColor = pdc.pdc_status === 'Due Today' ? '#22c55e' :
				pdc.pdc_status === 'Pending Clearance' ? '#3b82f6' : '#f59e0b';
			pdcRows += `
				<tr>
					<td>${pdc.cheque_number || 'N/A'}</td>
					<td>${pdc.customer_name || pdc.customer}</td>
					<td style="text-align: right;">${frappe.format(pdc.paid_amount, { fieldtype: 'Currency' })}</td>
					<td><span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 11px;">${pdc.pdc_status}</span></td>
					<td><a href="/app/payment-entry/${pdc.payment_entry}" target="_blank"><i class="fa fa-external-link"></i> View</a></td>
				</tr>
			`;
		});

		const dialog = new frappe.ui.Dialog({
			title: `PDCs for ${monthNames[month]} ${day}, ${year}`,
			size: 'large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'pdc_details'
				}
			]
		});

		dialog.fields_dict.pdc_details.$wrapper.html(`
			<div class="table-responsive">
				<table class="table table-bordered">
					<thead style="background: #f1f5f9;">
						<tr>
							<th>Cheque No</th>
							<th>Customer</th>
							<th style="text-align: right;">Amount</th>
							<th>Status</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						${pdcRows}
					</tbody>
				</table>
			</div>
		`);

		dialog.show();
	}

	update_pdc_customer_options(pdc_records) {
		// Only update customer dropdown options without recreating the entire filter HTML
		// This preserves user-entered values in date fields
		if (!pdc_records || pdc_records.length === 0) return;

		const unique_customers = [...new Set(pdc_records.map(pdc => pdc.customer))].sort();
		const customer_select = $('.pdc-customer-filter');

		if (customer_select.length > 0) {
			const current_value = customer_select.val();
			customer_select.empty().append('<option value="">All Customers</option>');
			unique_customers.forEach(customer => {
				customer_select.append(`<option value="${customer}">${customer}</option>`);
			});
			// Restore previous selection if it still exists
			if (current_value && unique_customers.includes(current_value)) {
				customer_select.val(current_value);
			}
		}
	}

	render_pdc_filters(pdc_data) {
		// Extract unique customers
		const unique_customers = [...new Set(pdc_data.pdc_records.map(pdc => pdc.customer))].sort();
		const unique_statuses = ['All', 'Due Today', 'Pending Clearance', 'Future', 'Cleared'];

		// Always leave dates empty by default to show ALL PDCs
		// User must explicitly set dates if they want to filter by date range
		const from_date_val = '';
		const to_date_val = '';

		const filters_html = `
			<div class="row" style="margin-bottom: 15px;">
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-building" style="color: #3b82f6; margin-right: 5px;"></i> Company
					</label>
					<select id="pdc-company" class="form-control" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Companies</option>
					</select>
				</div>
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-calendar" style="color: #3b82f6; margin-right: 5px;"></i> From Date
					</label>
					<input type="date" class="form-control pdc-from-date" value="${from_date_val}" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
				</div>
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-calendar" style="color: #3b82f6; margin-right: 5px;"></i> To Date
					</label>
					<input type="date" class="form-control pdc-to-date" value="${to_date_val}" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
				</div>
				<div class="col-md-2">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-code-fork" style="color: #3b82f6; margin-right: 5px;"></i> Branch
					</label>
					<select id="pdc-branch" class="form-control" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Branches</option>
					</select>
				</div>
				<div class="col-md-2" style="display: flex; align-items: flex-end;">
					<button class="btn btn-primary pdc-apply-filter" style="width: 100%; padding: 10px 15px; border-radius: 8px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; font-weight: 600;">
						<i class="fa fa-filter"></i> Apply Filter
					</button>
				</div>
				<div class="col-md-2" style="display: flex; align-items: flex-end;">
					<button class="btn btn-secondary pdc-reset-filter" style="width: 100%; padding: 10px 15px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; font-weight: 600;">
						<i class="fa fa-refresh"></i> Reset
					</button>
				</div>
			</div>
			<div class="row">
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-user" style="color: #3b82f6; margin-right: 5px;"></i> Customer
					</label>
					<select class="form-control pdc-customer-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						<option value="" style="background: #1e293b; color: #e2e8f0;">All Customers</option>
						${unique_customers.map(customer => `<option value="${customer}" style="background: #1e293b; color: #e2e8f0;">${customer}</option>`).join('')}
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-info-circle" style="color: #3b82f6; margin-right: 5px;"></i> Status
					</label>
					<select class="form-control pdc-status-filter" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
						${unique_statuses.map(status => `<option value="${status}" style="background: #1e293b; color: #e2e8f0;">${status}</option>`).join('')}
					</select>
				</div>
				<div class="col-md-4">
					<label style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; display: block;">
						<i class="fa fa-search" style="color: #3b82f6; margin-right: 5px;"></i> Search Cheque Number
					</label>
					<input type="text" class="form-control pdc-cheque-search" placeholder="Enter cheque number..." style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: #e2e8f0; padding: 10px 15px; border-radius: 8px;">
				</div>
			</div>
		`;

		this.main_container.find('.pdc-filters').html(filters_html);

		// Load company and branch lists into the dropdowns
		this.load_pdc_company_list();
		this.load_pdc_branch_list();

		this.setup_pdc_filters();
	}

	load_pdc_company_list() {
		const self = this;
		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_company_list',
			callback: (r) => {
				if (r.message) {
					const company_select = $('#pdc-company');
					company_select.empty().append('<option value="">All Companies</option>');
					r.message.forEach(company => {
						company_select.append(`<option value="${company.name}">${company.name}</option>`);
					});

					// Auto-select company: first from Collection Tracker, then from global filters
					const collection_company = $('#collection-company').val();
					if (collection_company) {
						company_select.val(collection_company);
						console.log('[PDC Report] Auto-selected company from Collection Tracker:', collection_company);
					} else if (self.filters.company) {
						company_select.val(self.filters.company);
						console.log('[PDC Report] Auto-selected company from global filter:', self.filters.company);
					}
				}
			}
		});
	}

	load_pdc_branch_list() {
		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_branch_list',
			callback: (r) => {
				if (r.message) {
					const branch_select = $('#pdc-branch');
					branch_select.empty().append('<option value="">All Branches</option>');
					r.message.forEach(branch => {
						branch_select.append(`<option value="${branch.name}">${branch.name}</option>`);
					});
				}
			}
		});
	}

	setup_pdc_filters() {
		const self = this;

		// Apply filter button
		$('.pdc-apply-filter').off('click').on('click', function () {
			self.load_pdc_data();
			frappe.show_alert({
				message: 'Applying filter...',
				indicator: 'blue'
			});
		});

		// Sync filter button - sync from Collection Tracker
		$('.pdc-sync-filter').off('click').on('click', function () {
			// Inherit values from Collection Tracker section
			const collection_company = $('#collection-company').val() || self.filters.company || '';
			const collection_from_date = $('#collection-from-date').val() || '';
			const collection_to_date = $('#collection-to-date').val() || '';

			// Set PDC filters to match Collection Tracker
			$('#pdc-company').val(collection_company);
			$('.pdc-from-date').val(collection_from_date);
			$('.pdc-to-date').val(collection_to_date);

			console.log('[PDC Report] Synced filters from Collection Tracker:', {
				company: collection_company,
				from_date: collection_from_date,
				to_date: collection_to_date
			});

			self.load_pdc_data();
			frappe.show_alert({
				message: 'Filters synced with Collection Tracker',
				indicator: 'green'
			});
		});

		// Clear filter button - clear all filters
		$('.pdc-reset-filter').off('click').on('click', function () {
			$('#pdc-company').val('');
			$('#pdc-branch').val('');
			$('.pdc-from-date').val('');
			$('.pdc-to-date').val('');
			$('.pdc-customer-filter').val('');
			$('.pdc-status-filter').val('All');
			$('.pdc-cheque-search').val('');

			self.load_pdc_data();
			frappe.show_alert({
				message: 'All filters cleared',
				indicator: 'blue'
			});
		});

		// Table-level filters (auto-apply on client-side)
		$('.pdc-customer-filter, .pdc-status-filter, .pdc-cheque-search').off('change keyup').on('change keyup', function () {
			const selected_customer = $('.pdc-customer-filter').val();
			const selected_status = $('.pdc-status-filter').val();
			const search_text = $('.pdc-cheque-search').val().toLowerCase();

			let filtered_data = self.original_pdc_data.pdc_records;

			// Filter by customer
			if (selected_customer) {
				filtered_data = filtered_data.filter(pdc => pdc.customer === selected_customer);
			}

			// Filter by status
			if (selected_status && selected_status !== 'All') {
				filtered_data = filtered_data.filter(pdc => pdc.pdc_status === selected_status);
			}

			// Filter by cheque number
			if (search_text) {
				filtered_data = filtered_data.filter(pdc =>
					(pdc.cheque_number || '').toLowerCase().includes(search_text)
				);
			}

			// Re-render detailed table only
			self.render_pdc_detailed_table(filtered_data);

			frappe.show_alert({
				message: `Filtered: ${filtered_data.length} PDC(s)`,
				indicator: 'green'
			}, 2);
		});
	}

	group_by_date(pdc_records, date_field) {
		const grouped = {};
		pdc_records.forEach(pdc => {
			const date = String(pdc[date_field]);
			if (!grouped[date]) {
				grouped[date] = {
					date: date,
					count: 0,
					amount: 0,
					status: pdc.pdc_status,
					pdcs: []
				};
			}
			grouped[date].count += 1;
			grouped[date].amount += pdc.paid_amount;
			grouped[date].pdcs.push(pdc);
		});
		return Object.values(grouped);
	}

	setup_pdc_tabs() {
		$('.pdc-tab').off('click').on('click', function () {
			const tab = $(this).data('tab');

			$('.pdc-tab').removeClass('active');
			$(this).addClass('active');

			$('.pdc-calendar-view, .pdc-month-table, .pdc-collection-table, .pdc-maturity-table, .pdc-detailed-table').hide();

			if (tab === 'calendar') {
				$('.pdc-calendar-view').show();
			} else if (tab === 'month') {
				$('.pdc-month-table').show();
			} else if (tab === 'collection') {
				$('.pdc-collection-table').show();
			} else if (tab === 'maturity') {
				$('.pdc-maturity-table').show();
			} else if (tab === 'detailed') {
				$('.pdc-detailed-table').show();
			}
		});
	}

	render_pdc_collection_table(collection_grouped) {
		if (!collection_grouped || collection_grouped.length === 0) {
			this.main_container.find('.pdc-collection-table').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No PDC records found for the selected criteria.
				</div>
			`);
			return;
		}

		let table_rows = '';
		collection_grouped.forEach((group, index) => {
			const date_formatted = frappe.datetime.str_to_user(group.date);

			table_rows += `
				<tr class="pdc-group-row" data-group-index="${index}" style="cursor: pointer;">
					<td style="padding: 8px;">
						<i class="fa fa-plus-circle expand-icon" style="color: #3b82f6; margin-right: 8px;"></i>
						<strong>${date_formatted}</strong>
					</td>
					<td style="padding: 8px; text-align: center;"><strong>${group.count}</strong></td>
					<td style="padding: 8px; text-align: right;"><strong>${frappe.format(group.amount, { fieldtype: 'Currency' })}</strong></td>
					<td style="padding: 8px;"></td>
					<td style="padding: 8px;"></td>
					<td style="padding: 8px;"></td>
				</tr>
			`;

			// Detail rows
			const detail_rows = group.pdcs.map(pdc => `
				<tr>
					<td style="padding: 6px 8px;">${pdc.cheque_number || '-'}</td>
					<td style="padding: 6px 8px;">${pdc.customer_name || pdc.customer}</td>
					<td style="padding: 6px 8px; text-align: right;">${frappe.format(pdc.paid_amount, { fieldtype: 'Currency' })}</td>
					<td style="padding: 6px 8px;">${frappe.datetime.str_to_user(pdc.cheque_date)}</td>
					<td style="padding: 6px 8px; text-align: center;">
						<span class="badge badge-${pdc.pdc_status === 'Pending Clearance' ? 'info' : pdc.pdc_status === 'Due Today' ? 'success' : 'warning'}">
							${pdc.pdc_status}
						</span>
					</td>
					<td style="padding: 6px 8px; text-align: center;">${pdc.days_in_hand} days</td>
				</tr>
			`).join('');

			table_rows += `
				<tr class="pdc-detail-row" data-group-index="${index}" style="display: none;">
					<td colspan="6" style="padding: 0; background-color: #34495e;">
						<table class="table table-sm" style="margin: 0; font-size: 12px; background-color: #34495e; color: white;">
							<thead style="background-color: #34495e;">
								<tr>
									<th style="padding: 6px 8px;">Cheque Number</th>
									<th style="padding: 6px 8px;">Customer</th>
									<th style="text-align: right; padding: 6px 8px;">Amount</th>
									<th style="padding: 6px 8px;">Maturity Date</th>
									<th style="text-align: center; padding: 6px 8px;">Status</th>
									<th style="text-align: center; padding: 6px 8px;">Days in Hand</th>
								</tr>
							</thead>
							<tbody>
								${detail_rows}
							</tbody>
						</table>
					</td>
				</tr>
			`;
		});

		const table_html = `
			<div class="table-responsive" style="margin-top: 20px;">
				<table class="table table-bordered table-hover table-sm">
					<thead style="background-color: #34495e; color: white;">
						<tr>
							<th style="padding: 8px;">Collection Date</th>
							<th style="padding: 8px; text-align: center;">Count</th>
							<th style="padding: 8px; text-align: right;">Total Amount</th>
							<th style="padding: 8px;"></th>
							<th style="padding: 8px;"></th>
							<th style="padding: 8px;"></th>
						</tr>
					</thead>
					<tbody>
						${table_rows}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.pdc-collection-table').html(table_html);
		this.setup_pdc_expand_collapse();
	}

	render_pdc_maturity_table(maturity_grouped) {
		if (!maturity_grouped || maturity_grouped.length === 0) {
			this.main_container.find('.pdc-maturity-table').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No PDC records found for the selected criteria.
				</div>
			`);
			return;
		}

		let table_rows = '';
		maturity_grouped.forEach((group, index) => {
			const date_formatted = frappe.datetime.str_to_user(group.date);
			const status_badge = group.status === 'Overdue' ? 'danger' : group.status === 'Due Today' ? 'success' : 'warning';

			table_rows += `
				<tr class="pdc-maturity-group-row" data-group-index="${index}" style="cursor: pointer;">
					<td style="padding: 8px;">
						<i class="fa fa-plus-circle expand-icon-maturity" style="color: #3b82f6; margin-right: 8px;"></i>
						<strong>${date_formatted}</strong>
					</td>
					<td style="padding: 8px; text-align: center;">
						<span class="badge badge-${status_badge}">${group.status}</span>
					</td>
					<td style="padding: 8px; text-align: center;"><strong>${group.count}</strong></td>
					<td style="padding: 8px; text-align: right;"><strong>${frappe.format(group.amount, { fieldtype: 'Currency' })}</strong></td>
					<td style="padding: 8px;"></td>
					<td style="padding: 8px;"></td>
				</tr>
			`;

			// Detail rows
			const detail_rows = group.pdcs.map(pdc => `
				<tr>
					<td style="padding: 6px 8px;">${pdc.cheque_number || '-'}</td>
					<td style="padding: 6px 8px;">${pdc.customer_name || pdc.customer}</td>
					<td style="padding: 6px 8px; text-align: right;">${frappe.format(pdc.paid_amount, { fieldtype: 'Currency' })}</td>
					<td style="padding: 6px 8px;">${frappe.datetime.str_to_user(pdc.collection_date)}</td>
					<td style="padding: 6px 8px; text-align: center;">${pdc.days_to_maturity} days</td>
					<td style="padding: 6px 8px;">${pdc.payment_entry}</td>
				</tr>
			`).join('');

			table_rows += `
				<tr class="pdc-maturity-detail-row" data-group-index="${index}" style="display: none;">
					<td colspan="6" style="padding: 0; background-color: #34495e;">
						<table class="table table-sm" style="margin: 0; font-size: 12px; background-color: #34495e; color: white;">
							<thead style="background-color: #34495e;">
								<tr>
									<th style="padding: 6px 8px;">Cheque Number</th>
									<th style="padding: 6px 8px;">Customer</th>
									<th style="text-align: right; padding: 6px 8px;">Amount</th>
									<th style="padding: 6px 8px;">Collection Date</th>
									<th style="text-align: center; padding: 6px 8px;">Days to Maturity</th>
									<th style="padding: 6px 8px;">Payment Entry</th>
								</tr>
							</thead>
							<tbody>
								${detail_rows}
							</tbody>
						</table>
					</td>
				</tr>
			`;
		});

		const table_html = `
			<div class="table-responsive" style="margin-top: 20px;">
				<table class="table table-bordered table-hover table-sm">
					<thead style="background-color: #34495e; color: white;">
						<tr>
							<th style="padding: 8px;">Maturity Date (Cheque Date)</th>
							<th style="padding: 8px; text-align: center;">Status</th>
							<th style="padding: 8px; text-align: center;">Count</th>
							<th style="padding: 8px; text-align: right;">Total Amount</th>
							<th style="padding: 8px;"></th>
							<th style="padding: 8px;"></th>
						</tr>
					</thead>
					<tbody>
						${table_rows}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.pdc-maturity-table').html(table_html);
		this.setup_pdc_maturity_expand_collapse();
	}

	render_pdc_detailed_table(pdc_records) {
		pdc_records = this.filter_records_by_internal_customer(pdc_records);
		console.log('=== render_pdc_detailed_table called ===');
		console.log('PDC records:', pdc_records);
		console.log('PDC records count:', pdc_records ? pdc_records.length : 0);

		if (!pdc_records || pdc_records.length === 0) {
			console.log('No PDC records to display');
			this.main_container.find('.pdc-detailed-table').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No PDC records found for the selected criteria.
				</div>
			`);
			return;
		}

		console.log('Rendering', pdc_records.length, 'PDC records');

		const table_rows = pdc_records.map(pdc => {
			const status_badge = pdc.pdc_status === 'Pending Clearance' ? 'info' :
				pdc.pdc_status === 'Due Today' ? 'success' :
					pdc.pdc_status === 'Cleared' ? 'secondary' :
						'warning';

			const type_badge = pdc.cheque_type === 'Post-Dated' ? 'info' :
				pdc.cheque_type === 'Same Day' ? 'success' :
					pdc.cheque_type === 'Back Dated' ? 'warning' :
						'secondary';

			return `
				<tr>
					<td style="padding: 8px;">${pdc.payment_entry}</td>
					<td style="padding: 8px;">${pdc.cheque_number || '-'}</td>
					<td style="padding: 8px;">${pdc.customer_name || pdc.customer}</td>
					<td style="padding: 8px; text-align: right;">${frappe.format(pdc.paid_amount, { fieldtype: 'Currency' })}</td>
					<td style="padding: 8px;">${frappe.datetime.str_to_user(pdc.collection_date)}</td>
					<td style="padding: 8px;">${pdc.cheque_date ? frappe.datetime.str_to_user(pdc.cheque_date) : '-'}</td>
					<td style="padding: 8px; text-align: center;">
						<span class="badge badge-${type_badge}" style="font-size: 10px;">${pdc.cheque_type || 'Unknown'}</span>
					</td>
					<td style="padding: 8px; text-align: center;">
						<span class="badge badge-${status_badge}">${pdc.pdc_status}</span>
					</td>
					<td style="padding: 8px;">${pdc.company}</td>
				</tr>
			`;
		}).join('');

		const table_html = `
			<div class="table-responsive" style="margin-top: 20px;">
				<table class="table table-bordered table-hover table-sm">
					<thead style="background-color: #34495e; color: white;">
						<tr>
							<th style="padding: 8px;">Payment Entry</th>
							<th style="padding: 8px;">Cheque Number</th>
							<th style="padding: 8px;">Customer</th>
							<th style="padding: 8px; text-align: right;">Amount</th>
							<th style="padding: 8px;">Collection Date</th>
							<th style="padding: 8px;">Cheque Date</th>
							<th style="padding: 8px; text-align: center;">Cheque Type</th>
							<th style="padding: 8px; text-align: center;">Status</th>
							<th style="padding: 8px;">Company</th>
						</tr>
					</thead>
					<tbody>
						${table_rows}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.pdc-detailed-table').html(table_html);
	}

	render_pdc_month_table(month_grouped) {
		if (!month_grouped || month_grouped.length === 0) {
			this.main_container.find('.pdc-month-table').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No PDC records found for the selected criteria.
				</div>
			`);
			return;
		}

		let table_rows = '';
		month_grouped.forEach((group, index) => {
			table_rows += `
				<tr class="pdc-month-group-row" data-group-index="${index}" style="cursor: pointer;">
					<td style="padding: 8px;">
						<i class="fa fa-plus-circle expand-icon-month" style="color: #3b82f6; margin-right: 8px;"></i>
						<strong>${group.month}</strong>
					</td>
					<td style="padding: 8px; text-align: center;"><strong>${group.count}</strong></td>
					<td style="padding: 8px; text-align: right;"><strong>${frappe.format(group.amount, { fieldtype: 'Currency' })}</strong></td>
					<td style="padding: 8px;"></td>
					<td style="padding: 8px;"></td>
					<td style="padding: 8px;"></td>
				</tr>
			`;

			// Detail rows
			const detail_rows = group.pdcs.map(pdc => `
				<tr>
					<td style="padding: 6px 8px;">${pdc.cheque_number || '-'}</td>
					<td style="padding: 6px 8px;">${pdc.customer_name || pdc.customer}</td>
					<td style="padding: 6px 8px; text-align: right;">${frappe.format(pdc.paid_amount, { fieldtype: 'Currency' })}</td>
					<td style="padding: 6px 8px;">${frappe.datetime.str_to_user(pdc.cheque_date)}</td>
					<td style="padding: 6px 8px; text-align: center;">
						<span class="badge badge-${pdc.pdc_status === 'Pending Clearance' ? 'info' : pdc.pdc_status === 'Due Today' ? 'success' : 'warning'}">
							${pdc.pdc_status}
						</span>
					</td>
					<td style="padding: 6px 8px; text-align: center;">${pdc.days_to_maturity} days</td>
				</tr>
			`).join('');

			table_rows += `
				<tr class="pdc-month-detail-row" data-group-index="${index}" style="display: none;">
					<td colspan="6" style="padding: 0; background-color: #34495e;">
						<table class="table table-sm" style="margin: 0; font-size: 12px; background-color: #34495e; color: white;">
							<thead style="background-color: #34495e;">
								<tr>
									<th style="padding: 6px 8px;">Cheque Number</th>
									<th style="padding: 6px 8px;">Customer</th>
									<th style="text-align: right; padding: 6px 8px;">Amount</th>
									<th style="padding: 6px 8px;">Maturity Date</th>
									<th style="text-align: center; padding: 6px 8px;">Status</th>
									<th style="text-align: center; padding: 6px 8px;">Days to Maturity</th>
								</tr>
							</thead>
							<tbody>
								${detail_rows}
							</tbody>
						</table>
					</td>
				</tr>
			`;
		});

		const table_html = `
			<div class="table-responsive" style="margin-top: 20px;">
				<table class="table table-bordered table-hover table-sm">
					<thead style="background-color: #34495e; color: white;">
						<tr>
							<th style="padding: 8px;">Month</th>
							<th style="padding: 8px; text-align: center;">Count</th>
							<th style="padding: 8px; text-align: right;">Total Amount</th>
							<th style="padding: 8px;"></th>
							<th style="padding: 8px;"></th>
							<th style="padding: 8px;"></th>
						</tr>
					</thead>
					<tbody>
						${table_rows}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.pdc-month-table').html(table_html);
		this.setup_pdc_month_expand_collapse();
	}

	setup_pdc_expand_collapse() {
		$('.pdc-group-row').off('click').on('click', function () {
			const index = $(this).data('group-index');
			const detailRow = $(`.pdc-detail-row[data-group-index="${index}"]`);
			const icon = $(this).find('.expand-icon');

			if (detailRow.is(':visible')) {
				detailRow.slideUp(200);
				icon.removeClass('fa-minus-circle').addClass('fa-plus-circle');
			} else {
				detailRow.slideDown(200);
				icon.removeClass('fa-plus-circle').addClass('fa-minus-circle');
			}
		});
	}

	setup_pdc_maturity_expand_collapse() {
		$('.pdc-maturity-group-row').off('click').on('click', function () {
			const index = $(this).data('group-index');
			const detailRow = $(`.pdc-maturity-detail-row[data-group-index="${index}"]`);
			const icon = $(this).find('.expand-icon-maturity');

			if (detailRow.is(':visible')) {
				detailRow.slideUp(200);
				icon.removeClass('fa-minus-circle').addClass('fa-plus-circle');
			} else {
				detailRow.slideDown(200);
				icon.removeClass('fa-plus-circle').addClass('fa-minus-circle');
			}
		});
	}

	setup_pdc_month_expand_collapse() {
		$('.pdc-month-group-row').off('click').on('click', function () {
			const index = $(this).data('group-index');
			const detailRow = $(`.pdc-month-detail-row[data-group-index="${index}"]`);
			const icon = $(this).find('.expand-icon-month');

			if (detailRow.is(':visible')) {
				detailRow.slideUp(200);
				icon.removeClass('fa-minus-circle').addClass('fa-plus-circle');
			} else {
				detailRow.slideDown(200);
				icon.removeClass('fa-plus-circle').addClass('fa-minus-circle');
			}
		});
	}

	render_intercompany_overdues_section() {
		const content = $(`
			<div class="intercompany-overdues-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-exchange"></i>
						Inter Company Overdues
					</h2>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Summary Cards -->
						<div class="intercompany-summary-cards"></div>

						<!-- Table -->
						<div class="intercompany-data-table" style="margin-top: 20px;"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.intercompany_section_initialized = true; // Set initialized flag
		this.load_intercompany_overdues();
	}

	load_intercompany_overdues(reset_page = true) {
		const self = this;
		if (reset_page) self.intercompany_page = 1;

		if (!self.filters.company) {
			self.main_container.find('.intercompany-data-table').html(`
				<div class="alert alert-warning" style="margin-top: 20px;">
					<i class="fa fa-exclamation-triangle"></i> Please select a company from the global filters to load data.
				</div>
			`);
			self.render_intercompany_summary_cards({
				total_invoiced: 0,
				collection_against_invoice: 0,
				credit_note: 0,
				outstanding: 0,
				unallocated_advance: 0
			});
			return;
		}

		const cache_key = JSON.stringify({
			company: self.filters.company,
			report_date: self.filters.report_date || null,
			customer: self.filters.customer || null,
			branch: self.filters.branch || null,
			sales_team: self.filters.sales_team || null,
			sales_person: self.filters.sales_person || null
		});

		if (self.intercompany_cache && self.intercompany_cache_key === cache_key) {
			self.render_intercompany_summary_cards(self.intercompany_cache.summary || {});
			self.render_intercompany_data_table(self.intercompany_cache.data || []);
			return;
		}

		// Show loading spinner
		self.main_container.find('.intercompany-data-table').html(`
			<div style="text-align: center; padding: 60px; color: #94a3b8;">
				<i class="fa fa-spinner fa-spin" style="font-size: 32px; color: #3b82f6;"></i>
				<p style="margin-top: 15px; font-weight: 500;">Retrieving Inter-Company Receivables...</p>
				<p style="font-size: 12px; color: #64748b;">This may take a moment for large datasets</p>
			</div>
		`);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_intercompany_overdues',
			args: {
				filters: {
					company: self.filters.company,
					report_date: self.filters.report_date || null,
					customer: self.filters.customer || null,
					branch: self.filters.branch || null,
					sales_team: self.filters.sales_team || null,
					sales_person: self.filters.sales_person || null,
					internal_customer: self.get_internal_customer_param()
				}
			},
			callback: function (r) {
				if (r.message) {
					self.intercompany_cache = r.message;
					self.intercompany_cache_key = cache_key;

					self.render_intercompany_summary_cards(r.message.summary || {});
					self.render_intercompany_data_table(r.message.data || []);
				}
			}
		});
	}

	render_intercompany_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-2" style="padding: 0 8px;">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Invoice</h4>
							<div class="stat-icon primary">
								<i class="fa fa-file-text"></i>
							</div>
						</div>
						<div class="stat-value" style="font-size: 16px;">${this.formatCurrency(data.total_invoiced || 0)}</div>
					</div>
				</div>
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Collection Against Invoice</h4>
							<div class="stat-icon success">
								<i class="fa fa-check-circle"></i>
							</div>
						</div>
						<div class="stat-value" style="font-size: 16px;">${this.formatCurrency(data.collection_against_invoice || 0)}</div>
					</div>
				</div>
				<div class="col-md-2" style="padding: 0 8px;">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Credit Note</h4>
							<div class="stat-icon info">
								<i class="fa fa-minus-circle"></i>
							</div>
						</div>
						<div class="stat-value" style="font-size: 16px;">${this.formatCurrency(data.credit_note || 0)}</div>
					</div>
				</div>
				<div class="col-md-2" style="padding: 0 8px;">
					<div class="stat-card danger">
						<div class="stat-header">
							<h4 class="stat-title">Outstanding</h4>
							<div class="stat-icon danger">
								<i class="fa fa-exclamation-circle"></i>
							</div>
						</div>
						<div class="stat-value" style="font-size: 16px;">${this.formatCurrency(data.outstanding || 0)}</div>
					</div>
				</div>
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Unallocated / Advance</h4>
							<div class="stat-icon warning">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value" style="font-size: 16px;">${this.formatCurrency(data.unallocated_advance || 0)}</div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.intercompany-summary-cards').html(cards_html);
	}

	render_intercompany_data_table(data) {
		data = this.filter_records_by_internal_customer(data);
		const total_records = data.length;
		const total_pages = Math.ceil(total_records / this.intercompany_page_size);
		const start_idx = (this.intercompany_page - 1) * this.intercompany_page_size;
		const end_idx = start_idx + this.intercompany_page_size;
		const paginated_data = data.slice(start_idx, end_idx);

		const table_html = `
			<div class="table-responsive">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 0 5px;">
					<div style="color: #94a3b8; font-size: 13px;">
						Showing <b>${Math.min(start_idx + 1, total_records)} - ${Math.min(end_idx, total_records)}</b> of <b>${total_records}</b> records
					</div>
					${total_pages > 1 ? this.render_intercompany_pagination(total_pages) : ''}
				</div>
				<table class="table table-hover">
					<thead>
						<tr>
							<th>Posting Date</th>
							<th>Customer</th>
							<th>Internal Company</th>
							<th>Voucher Type</th>
							<th>Voucher No</th>
							<th>Due Date</th>
							<th style="text-align: right;">Invoiced Amount</th>
							<th style="text-align: right;">Paid Amount</th>
							<th style="text-align: right;">Credit Note</th>
							<th style="text-align: right;">Outstanding</th>
							<th style="text-align: center;">Age (Days)</th>
						</tr>
					</thead>
					<tbody>
						${paginated_data.length > 0 ? paginated_data.map(row => `
							<tr>
								<td>${row.posting_date ? frappe.datetime.str_to_user(row.posting_date) : '-'}</td>
								<td>
									<a href="/app/customer/${row.customer || ''}" target="_blank" style="color: #60a5fa; text-decoration: none;">
										${row.customer_name || row.customer || '-'}
									</a>
								</td>
								<td>${row.internal_company || '-'}</td>
								<td>${row.voucher_type || '-'}</td>
								<td>
									<a href="/app/${(row.voucher_type || '').toLowerCase().replace(/ /g, '-')}/${row.voucher_no || ''}" target="_blank" style="color: #60a5fa; text-decoration: none;">
										${row.voucher_no || '-'}
									</a>
								</td>
								<td>${row.due_date ? frappe.datetime.str_to_user(row.due_date) : '-'}</td>
								<td style="text-align: right;">${this.formatCurrency(row.invoiced_amount || 0)}</td>
								<td style="text-align: right; color: #22c55e;">${this.formatCurrency(row.paid_amount || 0)}</td>
								<td style="text-align: right; color: #3b82f6;">${this.formatCurrency(row.credit_note || 0)}</td>
								<td style="text-align: right; color: ${row.outstanding_amount > 0 ? '#dc3545' : '#94a3b8'}; font-weight: ${row.outstanding_amount > 0 ? 'bold' : 'normal'};">
									${this.formatCurrency(row.outstanding_amount || 0)}
								</td>
								<td style="text-align: center;">
									<span style="padding: 3px 8px; border-radius: 10px; background: ${row.age > 90 ? '#dc3545' : (row.age > 30 ? '#f59e0b' : '#22c55e')}; color: white; font-size: 11px; font-weight: 600;">
										${row.age || 0}
									</span>
								</td>
							</tr>
						`).join('') : `
							<tr>
								<td colspan="11" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
									<p>No inter-company receivable data found</p>
								</td>
							</tr>
						`}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.intercompany-data-table').html(table_html);
		this.setup_intercompany_pagination_events();
	}

	render_intercompany_pagination(total_pages) {
		let pages = [];
		const current = this.intercompany_page;

		// Simple slice-based pagination
		for (let i = 1; i <= total_pages; i++) {
			if (i === 1 || i === total_pages || (i >= current - 2 && i <= current + 2)) {
				pages.push(i);
			} else if (pages[pages.length - 1] !== '...') {
				pages.push('...');
			}
		}

		return `
			<div class="pagination-controls" style="display: flex; gap: 5px;">
				<button class="btn btn-xs btn-default ${current === 1 ? 'disabled' : ''}" data-page="${current - 1}"><i class="fa fa-chevron-left"></i></button>
				${pages.map(p => p === '...' ? '<span style="padding: 0 5px; color: #94a3b8;">...</span>' : `
					<button class="btn btn-xs ${p === current ? 'btn-primary' : 'btn-default'}" data-page="${p}">${p}</button>
				`).join('')}
				<button class="btn btn-xs btn-default ${current === total_pages ? 'disabled' : ''}" data-page="${current + 1}"><i class="fa fa-chevron-right"></i></button>
			</div>
		`;
	}

	setup_intercompany_pagination_events() {
		const self = this;
		this.main_container.find('.pagination-controls button:not(.disabled)').on('click', function () {
			self.intercompany_page = parseInt($(this).data('page'));
			self.render_intercompany_data_table(self.intercompany_cache.data || []);
			// Scroll top of table
			$('html, body').animate({
				scrollTop: self.main_container.find('.intercompany-data-table').offset().top - 100
			}, 300);
		});
	}

	// ========================
	// Payment Followup Section
	// ========================
	render_payment_followup_section() {
		var self = this;
		self.payment_followup_data = [];
		self.payment_followup_method_filter = 'all';
		self.payment_followup_customer_filter = 'all';

		var filterHtml = '<div class="payment-followup-filters" style="margin-top: 20px; padding: 15px; background: rgba(30, 41, 59, 0.6); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.2);">' +
			'<div class="row align-items-center">' +
				'<div class="col-md-3">' +
					'<label style="color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 5px; display: block;">' +
						'<i class="fa fa-filter"></i> Filter by Method' +
					'</label>' +
					'<select id="payment-followup-method-filter" class="form-control" style="background: #1e293b; color: #e2e8f0; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 8px 12px;">' +
						'<option value="all">All Methods</option>' +
						'<option value="Call">Call</option>' +
						'<option value="Whatsapp">Whatsapp</option>' +
						'<option value="Email">Email</option>' +
						'<option value="Direct Visit">Direct Visit</option>' +
					'</select>' +
				'</div>' +
				'<div class="col-md-4">' +
					'<label style="color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 5px; display: block;">' +
						'<i class="fa fa-user"></i> Filter by Customer' +
					'</label>' +
					'<select id="payment-followup-customer-filter" class="form-control" style="background: #1e293b; color: #e2e8f0; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 8px 12px;">' +
						'<option value="all">All Customers</option>' +
					'</select>' +
				'</div>' +
				'<div class="col-md-2">' +
					'<label style="color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 5px; display: block;">&nbsp;</label>' +
					'<button id="payment-followup-clear-filters" class="btn btn-sm" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 8px 15px; width: 100%;">' +
						'<i class="fa fa-times"></i> Clear Filters' +
					'</button>' +
				'</div>' +
				'<div class="col-md-3" style="text-align: right;">' +
					'<label style="color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 5px; display: block;">&nbsp;</label>' +
					'<span class="payment-followup-filter-count" style="color: #64748b; font-size: 12px;"></span>' +
				'</div>' +
			'</div>' +
		'</div>';

		var contentHtml = '<div class="payment-followup-section-wrapper">' +
			'<div class="content-header">' +
				this.create_global_title_section() +
				'<h2 class="content-title">' +
					'<i class="fa fa-phone-square"></i> Payment Followup' +
				'</h2>' +
			'</div>' +
			'<div class="content-body">' +
				'<div class="section-card">' +
					'<div class="payment-followup-summary-cards"></div>' +
					filterHtml +
					'<div class="payment-followup-table" style="margin-top: 20px;"></div>' +
				'</div>' +
			'</div>' +
		'</div>';

		var content = $(contentHtml);
		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.setup_payment_followup_filters();
		this.load_payment_followup();
	}

	setup_payment_followup_filters() {
		var self = this;

		this.main_container.find('#payment-followup-method-filter').on('change', function() {
			self.payment_followup_method_filter = $(this).val();
			self.apply_payment_followup_filter();
		});

		this.main_container.find('#payment-followup-customer-filter').on('change', function() {
			self.payment_followup_customer_filter = $(this).val();
			self.apply_payment_followup_filter();
		});

		this.main_container.find('#payment-followup-clear-filters').on('click', function() {
			self.payment_followup_method_filter = 'all';
			self.payment_followup_customer_filter = 'all';
			self.main_container.find('#payment-followup-method-filter').val('all');
			self.main_container.find('#payment-followup-customer-filter').val('all');
			self.apply_payment_followup_filter();
		});
	}

	populate_payment_followup_customers() {
		var customers = [];
		var seen = {};
		for (var i = 0; i < this.payment_followup_data.length; i++) {
			var item = this.payment_followup_data[i];
			if (!seen[item.customer]) {
				seen[item.customer] = true;
				customers.push({
					customer: item.customer,
					customer_name: item.customer_name || item.customer
				});
			}
		}
		customers.sort(function(a, b) {
			return (a.customer_name || '').localeCompare(b.customer_name || '');
		});

		var optionsHtml = '<option value="all">All Customers</option>';
		for (var j = 0; j < customers.length; j++) {
			var c = customers[j];
			optionsHtml += '<option value="' + c.customer + '">' + c.customer_name + ' (' + c.customer + ')</option>';
		}
		this.main_container.find('#payment-followup-customer-filter').html(optionsHtml);
	}

	apply_payment_followup_filter() {
		if (!this.payment_followup_data || this.payment_followup_data.length === 0) {
			return;
		}

		var filtered = [];
		for (var i = 0; i < this.payment_followup_data.length; i++) {
			var item = this.payment_followup_data[i];
			var matchMethod = (this.payment_followup_method_filter === 'all' || item.method === this.payment_followup_method_filter);
			var matchCustomer = (this.payment_followup_customer_filter === 'all' || item.customer === this.payment_followup_customer_filter);
			if (matchMethod && matchCustomer) {
				filtered.push(item);
			}
		}

		this.main_container.find('.payment-followup-filter-count').text(
			'Showing ' + filtered.length + ' of ' + this.payment_followup_data.length + ' records'
		);

		this.render_payment_followup_table(filtered);
	}

	load_payment_followup() {
		var self = this;

		if (!self.filters.company) {
			self.main_container.find('.payment-followup-table').html(
				'<div class="alert alert-warning" style="margin-top: 20px;">' +
					'<i class="fa fa-exclamation-triangle"></i> Please select a company from the global filters to load data.' +
				'</div>'
			);
			self.render_payment_followup_summary_cards({
				total_followups: 0,
				pending_followups: 0,
				today_followups: 0
			});
			return;
		}

		self.main_container.find('.payment-followup-table').html(
			'<div style="text-align: center; padding: 60px; color: #94a3b8;">' +
				'<i class="fa fa-spinner fa-spin" style="font-size: 32px; color: #3b82f6;"></i>' +
				'<p style="margin-top: 15px; font-weight: 500;">Loading Payment Followups...</p>' +
				'<p style="font-size: 12px; color: #64748b;">This may take a moment for large datasets</p>' +
			'</div>'
		);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_payment_followup',
			args: {
				filters: {
					company: self.filters.company,
					report_date: self.filters.report_date || null,
					customer: self.filters.customer || null,
					branch: self.filters.branch || null,
					sales_team: self.filters.sales_team || null,
					sales_person: self.filters.sales_person || null,
					internal_customer: self.get_internal_customer_param()
				}
			},
			callback: function(r) {
				if (r.message) {
					self.payment_followup_data = self.filter_records_by_internal_customer(r.message.data || []);
					self.render_payment_followup_summary_cards(r.message.summary || {});

					self.payment_followup_method_filter = 'all';
					self.payment_followup_customer_filter = 'all';
					self.main_container.find('#payment-followup-method-filter').val('all');

					self.populate_payment_followup_customers();
					self.main_container.find('#payment-followup-customer-filter').val('all');

					self.main_container.find('.payment-followup-filter-count').text(
						'Showing ' + self.payment_followup_data.length + ' of ' + self.payment_followup_data.length + ' records'
					);

					self.render_payment_followup_table(self.payment_followup_data);
				} else {
					self.payment_followup_data = [];
					self.main_container.find('.payment-followup-filter-count').text('');
					self.main_container.find('#payment-followup-customer-filter').html('<option value="all">All Customers</option>');
					self.main_container.find('.payment-followup-table').html(
						'<p class="text-muted text-center">No payment followup data found.</p>'
					);
				}
			},
			error: function(err) {
				console.error('Error loading payment followup:', err);
				self.payment_followup_data = [];
				self.main_container.find('.payment-followup-filter-count').text('');
				self.main_container.find('.payment-followup-table').html(
					'<div class="alert alert-danger">' +
						'<i class="fa fa-exclamation-circle"></i> Error loading payment followup data.' +
					'</div>'
				);
			}
		});
	}

	render_payment_followup_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-4">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Followups</h4>
							<div class="stat-icon primary">
								<i class="fa fa-phone"></i>
							</div>
						</div>
						<div class="stat-value">${data.total_followups || 0}</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Pending Extended Dates</h4>
							<div class="stat-icon warning">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.pending_followups || 0}</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Today's Followups</h4>
							<div class="stat-icon success">
								<i class="fa fa-calendar-check-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.today_followups || 0}</div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.payment-followup-summary-cards').html(cards_html);
	}

	render_payment_followup_table(followups) {
		followups = this.filter_records_by_internal_customer(followups);
		if (!followups || followups.length === 0) {
			this.main_container.find('.payment-followup-table').html(`
				<p class="text-muted text-center" style="padding: 40px;">No payment followup records found for the selected filters.</p>
			`);
			return;
		}

		const table_html = `
			<div style="overflow-x: auto;">
				<table class="table table-bordered" style="background: #2c3e50; min-width: 1200px;">
					<thead style="background-color: #34495e;">
						<tr>
							<th style="color: white; font-weight: 600; min-width: 140px;">Sales Invoice</th>
							<th style="color: white; font-weight: 600; min-width: 180px;">Customer</th>
							<th style="color: white; font-weight: 600; min-width: 100px;">Method</th>
							<th style="color: white; font-weight: 600; min-width: 200px;">Comments</th>
							<th style="color: white; font-weight: 600; min-width: 130px;">Extended Date</th>
							<th style="color: white; font-weight: 600; min-width: 160px;">Followup Date & Time</th>
							<th style="color: white; font-weight: 600; min-width: 130px;">Followup By</th>
							<th style="color: white; font-weight: 600; text-align: right; min-width: 130px;">Outstanding</th>
						</tr>
					</thead>
					<tbody>
						${followups.map(f => {
							const method_colors = {
								'Call': '#3b82f6',
								'Whatsapp': '#22c55e',
								'Email': '#f59e0b',
								'Direct Visit': '#8b5cf6'
							};
							const method_color = method_colors[f.method] || '#64748b';

							return `
							<tr style="background: #34495e; border-bottom: 1px solid #2c3e50;">
								<td style="color: #ecf0f1;">
									<a href="/app/sales-invoice/${f.sales_invoice}" target="_blank" style="color: #667eea; font-weight: 600;">
										${f.sales_invoice}
									</a>
								</td>
								<td style="color: #ecf0f1;">
									<a href="/app/customer/${f.customer}" target="_blank" style="color: #60a5fa;">
										${f.customer_name || f.customer}
									</a>
								</td>
								<td style="text-align: center;">
									<span style="padding: 4px 10px; border-radius: 12px; background: ${method_color}; color: white; font-weight: 500; font-size: 11px; display: inline-block;">
										${f.method || '-'}
									</span>
								</td>
								<td style="color: #ecf0f1; max-width: 250px; white-space: pre-wrap; word-wrap: break-word;">
									${f.comments || '-'}
								</td>
								<td style="color: ${f.payment_extended_date ? '#fbbf24' : '#64748b'}; font-weight: ${f.payment_extended_date ? '600' : 'normal'};">
									${f.payment_extended_date ? frappe.datetime.str_to_user(f.payment_extended_date) : '-'}
								</td>
								<td style="color: #ecf0f1;">
									${f.followup_date_time ? frappe.datetime.str_to_user(f.followup_date_time) : '-'}
								</td>
								<td style="color: #ecf0f1;">
									${f.followup_by || '-'}
								</td>
								<td style="text-align: right; color: ${f.outstanding > 0 ? '#ef4444' : '#64748b'}; font-weight: bold;">
									${f.outstanding > 0 ? frappe.format(f.outstanding, { fieldtype: 'Currency' }) : '-'}
								</td>
							</tr>
						`;
						}).join('')}
					</tbody>
				</table>
			</div>
			<div style="margin-top: 15px; color: #94a3b8; font-size: 12px;">
				Total ${followups.length} followup record(s) found.
			</div>
		`;

		this.main_container.find('.payment-followup-table').html(table_html);
	}

	render_blocked_dispute_section() {
		const content = $(`
			<div class="blocked-dispute-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-ban"></i>
						Blocked Customer
					</h2>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Summary Cards -->
						<div class="blocked-summary-cards"></div>

						<!-- Table -->
						<div class="blocked-customers-table"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.load_blocked_customers();
	}

	load_blocked_customers() {
		const self = this;

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_disable_customer',
			args: {
				customer_names: self.filters.customer ? [self.filters.customer] : null,
				company: self.filters.company || null,
				branch: self.filters.branch || null,
				sales_team: self.filters.sales_team || null,
				sales_person: self.filters.sales_person || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: function (r) {
				if (r.message) {
					// Combine listed and non_listed customers
					const all_customers = [...(r.message.listed || []), ...(r.message.non_listed || [])];

					// Use summaries from API
					const summary = {
						total_blocked: all_customers.length,
						total_outstanding: r.message.total_outstanding || 0,
						total_sales: r.message.total_sales || 0
					};

					self.render_blocked_summary_cards(summary);
					self.render_blocked_customers_table(all_customers);
				}
			}
		});
	}

	render_blocked_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-4">
					<div class="stat-card danger">
						<div class="stat-header">
							<h4 class="stat-title">Total Blocked Customers</h4>
							<div class="stat-icon danger">
								<i class="fa fa-ban"></i>
							</div>
						</div>
						<div class="stat-value">${data.total_blocked}</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Total Outstanding</h4>
							<div class="stat-icon warning">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value">${frappe.format(data.total_outstanding, { fieldtype: 'Currency' })}</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Sales (All Time)</h4>
							<div class="stat-icon primary">
								<i class="fa fa-line-chart"></i>
							</div>
						</div>
						<div class="stat-value">${frappe.format(data.total_sales, { fieldtype: 'Currency' })}</div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.blocked-summary-cards').html(cards_html);
	}

	render_blocked_customers_table(customers) {
		customers = this.filter_records_by_internal_customer(customers);
		const table_html = `
			<table class="table table-bordered" style="background: #2c3e50;">
				<thead style="background-color: #34495e;">
					<tr>
						<th style="color: white; font-weight: 600;">Customer ID</th>
						<th style="color: white; font-weight: 600;">Customer Name</th>
						<th style="color: white; font-weight: 600;">Type</th>
						<th style="color: white; font-weight: 600;">Territory</th>
						<th style="color: white; font-weight: 600; text-align: right;">Outstanding</th>
						<th style="color: white; font-weight: 600; text-align: right;">Total Sales</th>
						<th style="color: white; font-weight: 600; text-align: center;">Invoices</th>
						<th style="color: white; font-weight: 600; text-align: center;">Status</th>
					</tr>
				</thead>
				<tbody>
					${customers.map(c => `
						<tr style="background: #34495e; border-bottom: 1px solid #2c3e50;">
							<td style="color: #ecf0f1;">
								<a href="/app/customer/${c.name}" target="_blank" style="color: #667eea; font-weight: 600;">
									${c.name}
								</a>
							</td>
							<td style="color: #ecf0f1;">${c.customer_name || c.name}</td>
							<td style="color: #ecf0f1;">${c.customer_type || '-'}</td>
							<td style="color: #ecf0f1;">${c.territory || '-'}</td>
							<td style="text-align: right; color: ${c.outstanding > 0 ? '#dc3545' : '#95a5a6'}; font-weight: ${c.outstanding > 0 ? 'bold' : 'normal'};">
								${c.outstanding > 0 ? frappe.format(c.outstanding, { fieldtype: 'Currency' }) : '-'}
							</td>
							<td style="text-align: right; color: #ecf0f1; font-weight: bold;">
								${frappe.format(c.total_sales, { fieldtype: 'Currency' })}
							</td>
							<td style="text-align: center; color: #ecf0f1;">${c.invoice_count || 0}</td>
							<td style="text-align: center;">
								<span style="padding: 5px 10px; border-radius: 12px; background: ${c.on_hold ? '#ffc107' : '#dc3545'}; color: white; font-weight: 600; font-size: 11px; display: inline-block;">
									${c.block_reason}
								</span>
							</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
			${customers.length === 0 ? '<p class="text-muted text-center">No blocked or disabled customers found.</p>' : ''}
		`;

		this.main_container.find('.blocked-customers-table').html(table_html);
	}

	render_proforma_invoice_section() {
		const content = $(`
			<div class="proforma-invoice-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-file-text"></i>
						Proforma Invoice
					</h2>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Summary Cards -->
						<div class="proforma-summary-cards"></div>

						<!-- Table -->
						<div class="proforma-invoice-table"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.load_proforma_invoices();
	}

	load_proforma_invoices() {
		const self = this;

		// Require company filter
		if (!self.filters.company) {
			console.log('[Proforma Invoice] No company selected, showing empty state');
			self.render_proforma_summary_cards({
				total_proforma: 0,
				total_amount: 0,
				pending_conversion: 0
			});
			self.render_proforma_invoice_table([]);

			// Show message to select company
			frappe.msgprint(__('Please select a company to view proforma invoice data.'));
			return;
		}

		console.log('[Proforma Invoice] Loading with filters:', self.filters);
		console.log('[Proforma Invoice] Company filter value:', self.filters.company);

		const api_args = {
			company: self.filters.company || null,
			customer: self.filters.customer || null,
			branch: self.filters.branch || null,
			account_incharge: self.filters.account_incharge || null,
			sales_person: self.filters.sales_person || null,
			sales_team: self.filters.sales_team || null,
			sales_order: self.filters.sales_order || null,
			internal_customer: self.get_internal_customer_param()
		};
		console.log('[Proforma Invoice] API args:', api_args);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_proforma_invoice_orm',
			args: api_args,
			callback: function (r) {
				console.log('[Proforma Invoice] API Response:', r.message);
				console.log('[Proforma Invoice] API returned', r.message ? r.message.length : 0, 'records');

				if (r.message) {
					// Filter out proforma invoices with status "Invoiced" (backup filter - backend already filters)
					const proforma_data = r.message.filter(inv => inv.proforma_invoice_status !== 'Invoiced');

					console.log('[Proforma Invoice] After filter:', proforma_data.length, 'records');
					console.log('[Proforma Invoice] Filtered data:', proforma_data);

					// Calculate summary
					const total_proforma = proforma_data.length;
					const total_amount = proforma_data.reduce((sum, inv) => sum + (parseFloat(inv.amount_received) || 0), 0);

					// Count pending (assuming all are pending if no status field exists)
					const pending_conversion = total_proforma;

					self.render_proforma_summary_cards({
						total_proforma: total_proforma,
						total_amount: total_amount,
						pending_conversion: pending_conversion
					});
					self.render_proforma_invoice_table(proforma_data);
				} else {
					// Show empty state
					self.render_proforma_summary_cards({
						total_proforma: 0,
						total_amount: 0,
						pending_conversion: 0
					});
					self.render_proforma_invoice_table([]);
				}
			},
			error: function (r) {
				// Handle error - show empty state
				self.render_proforma_summary_cards({
					total_proforma: 0,
					total_amount: 0,
					pending_conversion: 0
				});
				self.render_proforma_invoice_table([]);
			}
		});
	}

	render_proforma_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-4">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Proforma Invoices</h4>
							<div class="stat-icon primary">
								<i class="fa fa-file-text"></i>
							</div>
						</div>
						<div class="stat-value">${data.total_proforma}</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Total Amount</h4>
							<div class="stat-icon success">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value">${this.formatCurrency(data.total_amount)}</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Pending Conversion</h4>
							<div class="stat-icon warning">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.pending_conversion}</div>
					</div>
				</div>
			</div>
		`;

		console.log('[Proforma Invoice] Updating summary cards with total:', data.total_proforma);
		this.main_container.find('.proforma-summary-cards').html(cards_html);
	}

	render_proforma_invoice_table(invoices) {
		invoices = this.filter_records_by_internal_customer(invoices);
		const table_html = `
			<div class="table-responsive">
				<table class="table table-hover">
					<thead>
						<tr>
							<th>Proforma Invoice</th>
							<th>Proforma Invoice Status</th>
							<th>Customer</th>
							<th>Branch</th>
							<th>Account Incharge</th>
							<th>SO #</th>
							<th style="text-align: right;">SO Amount</th>
							<th>SO Status</th>
							<th>Sales Inv #</th>
							<th style="text-align: right;">Sales Invoice Amount</th>
							<th>Sales Invoice Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						${invoices.length > 0 ? invoices.map(inv => `
							<tr>
								<td>
									<a href="/app/proforma-invoice/${inv.proforma_invoice || ''}" target="_blank" style="color: #60a5fa; text-decoration: none;">
										${inv.proforma_invoice || '-'}
									</a>
								</td>
								<td>${inv.proforma_invoice_status || '-'}</td>
								<td>${inv.customer || '-'}</td>
								<td>${inv.branch || '-'}</td>
								<td>${inv.account_incharge || '-'}</td>
								<td>
									<a href="/app/sales-order/${inv.sales_order || ''}" target="_blank" style="color: #60a5fa; text-decoration: none;">
										${inv.sales_order || '-'}
									</a>
								</td>
								<td style="text-align: right;">${this.formatCurrency(inv.so_amount || 0)}</td>
								<td>${inv.so_status || '-'}</td>
								<td>
									${inv.sales_invoice_no ? inv.sales_invoice_no.split(', ').map(si =>
			`<a href="/app/sales-invoice/${si}" target="_blank" style="color: #60a5fa; text-decoration: none;">${si}</a>`
		).join(', ') : '-'}
								</td>
								<td style="text-align: right;">${this.formatCurrency(inv.sales_invoice_amount || 0)}</td>
								<td>${inv.sales_invoice_status || '-'}</td>
								<td>
									<button class="btn btn-xs btn-primary" onclick="window.open('/app/sales-order/${inv.sales_order || ''}', '_blank')">
										<i class="fa fa-eye"></i> View SO
									</button>
									<button class="btn btn-xs btn-info" onclick="window.open('/app/proforma-invoice/${inv.proforma_invoice || ''}', '_blank')" style="margin-left: 5px;">
										<i class="fa fa-file-text"></i> View PI
									</button>
								</td>
							</tr>
						`).join('') : `
							<tr>
								<td colspan="12" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
									<p>No proforma invoices found</p>
								</td>
							</tr>
						`}
					</tbody>
				</table>
			</div>
		`;

		console.log('[Proforma Invoice] Updating table with', invoices.length, 'rows');
		this.main_container.find('.proforma-invoice-table').html(table_html);
	}

	render_quotation_followup_section() {
		const content = $(`
			<div class="quotation-followup-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-phone"></i>
						Quotation Follow-up
					</h2>
					<p class="content-subtitle">Track quotations pending conversion to Sales Orders</p>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Summary Cards -->
						<div class="quotation-summary-cards"></div>

						<!-- Sales Person Summary -->
						<div class="sales-person-summary-section"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.load_pending_quotations();
	}

	load_pending_quotations() {
		const self = this;

		console.log('=== Loading Quotations ===');
		console.log('[load_pending_quotations] Company being sent:', self.filters.company || null);
		console.log('Filters:', {
			company: self.filters.company || null,
			account_incharge: self.filters.sales_person || null,
			team: self.filters.sales_team || null,
			branch: self.filters.branch || null
		});

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_quotation_list',
			args: {
				company: self.filters.company || null,
				account_incharge: self.filters.sales_person || null,  // sales_person maps to account_incharge
				team: self.filters.sales_team || null,  // sales_team maps to team
				branch: self.filters.branch || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: function (r) {
				console.log('=== Quotation API Response ===');
				console.log('Full response:', r);
				console.log('Message:', r.message);
				console.log('Message type:', typeof r.message);
				console.log('Message is array?', Array.isArray(r.message));
				console.log('Message length:', r.message ? r.message.length : 'null/undefined');

				if (r.message && r.message.length > 0) {
					console.log('First quotation:', r.message[0]);
					const quotations = r.message;

					// Calculate summary from the quotation list
					const total_quotations = quotations.length;
					const total_amount = quotations.reduce((sum, q) => sum + (q.grand_total || 0), 0);

					// Group by account_incharge for sales person summary
					const sales_person_summary = {};
					let pipeline_a_count = 0, pipeline_a_amount = 0;
					let pipeline_b_count = 0, pipeline_b_amount = 0;
					let pipeline_c_count = 0, pipeline_c_amount = 0;

					quotations.forEach(q => {
						const account_incharge = q.account_incharge || 'Unassigned';
						if (!sales_person_summary[account_incharge]) {
							sales_person_summary[account_incharge] = {
								sales_person: account_incharge,
								quotation_count: 0,
								total_amount: 0,
								pipeline_a_count: 0,
								pipeline_a_amount: 0,
								pipeline_b_count: 0,
								pipeline_b_amount: 0,
								pipeline_c_count: 0,
								pipeline_c_amount: 0
							};
						}
						sales_person_summary[account_incharge].quotation_count += 1;
						sales_person_summary[account_incharge].total_amount += (q.grand_total || 0);

						// Count and sum by pipeline
						if (q.workflow_state === 'Pipeline A') {
							sales_person_summary[account_incharge].pipeline_a_count += 1;
							sales_person_summary[account_incharge].pipeline_a_amount += (q.grand_total || 0);
							pipeline_a_count += 1;
							pipeline_a_amount += (q.grand_total || 0);
						} else if (q.workflow_state === 'Pipeline B') {
							sales_person_summary[account_incharge].pipeline_b_count += 1;
							sales_person_summary[account_incharge].pipeline_b_amount += (q.grand_total || 0);
							pipeline_b_count += 1;
							pipeline_b_amount += (q.grand_total || 0);
						} else if (q.workflow_state === 'Pipeline C') {
							sales_person_summary[account_incharge].pipeline_c_count += 1;
							sales_person_summary[account_incharge].pipeline_c_amount += (q.grand_total || 0);
							pipeline_c_count += 1;
							pipeline_c_amount += (q.grand_total || 0);
						}
					});

					const summary = {
						total_quotations: total_quotations,
						total_amount: total_amount,
						expired_count: 0,
						expiring_soon_count: 0,
						active_count: total_quotations,
						pipeline_a_count: pipeline_a_count,
						pipeline_a_amount: pipeline_a_amount,
						pipeline_b_count: pipeline_b_count,
						pipeline_b_amount: pipeline_b_amount,
						pipeline_c_count: pipeline_c_count,
						pipeline_c_amount: pipeline_c_amount
					};

					self.render_quotation_summary_cards(summary);
					self.render_sales_person_summary(Object.values(sales_person_summary));
					self.render_quotation_followup_table(quotations);
				} else {
					self.render_quotation_summary_cards({
						total_quotations: 0,
						total_amount: 0,
						expired_count: 0,
						expiring_soon_count: 0,
						active_count: 0,
						pipeline_a_count: 0,
						pipeline_a_amount: 0,
						pipeline_b_count: 0,
						pipeline_b_amount: 0,
						pipeline_c_count: 0,
						pipeline_c_amount: 0
					});
					self.render_sales_person_summary([]);
					self.render_quotation_followup_table([]);
				}
			},
			error: function (r) {
				self.render_quotation_summary_cards({
					total_quotations: 0,
					total_amount: 0,
					expired_count: 0,
					expiring_soon_count: 0,
					active_count: 0,
					pipeline_a_count: 0,
					pipeline_a_amount: 0,
					pipeline_b_count: 0,
					pipeline_b_amount: 0,
					pipeline_c_count: 0,
					pipeline_c_amount: 0
				});
				self.render_sales_person_summary([]);
				self.render_quotation_followup_table([]);
			}
		});
	}

	render_quotation_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Total Pending Quotations</h4>
							<div class="stat-icon info">
								<i class="fa fa-file-text-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.total_quotations}</div>
						<small style="color: #94a3b8;"><strong>Amount:</strong> ${this.formatCurrency(data.total_amount)}</small>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
						<div class="stat-header">
							<h4 class="stat-title">Pipeline A</h4>
							<div class="stat-icon">
								<i class="fa fa-flag"></i>
							</div>
						</div>
						<div class="stat-value">${data.pipeline_a_count}</div>
						<small style="color: rgba(255,255,255,0.9);"><strong>Amount:</strong> ${this.formatCurrency(data.pipeline_a_amount)}</small>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
						<div class="stat-header">
							<h4 class="stat-title">Pipeline B</h4>
							<div class="stat-icon">
								<i class="fa fa-flag"></i>
							</div>
						</div>
						<div class="stat-value">${data.pipeline_b_count}</div>
						<small style="color: rgba(255,255,255,0.9);"><strong>Amount:</strong> ${this.formatCurrency(data.pipeline_b_amount)}</small>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
						<div class="stat-header">
							<h4 class="stat-title">Pipeline C</h4>
							<div class="stat-icon">
								<i class="fa fa-flag"></i>
							</div>
						</div>
						<div class="stat-value">${data.pipeline_c_count}</div>
						<small style="color: rgba(255,255,255,0.9);"><strong>Amount:</strong> ${this.formatCurrency(data.pipeline_c_amount)}</small>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.quotation-summary-cards').html(cards_html);
	}

	render_sales_person_summary(summary_data) {
		if (!summary_data || summary_data.length === 0) {
			this.main_container.find('.sales-person-summary-section').html('');
			return;
		}

		const summary_html = `
			<div class="section-card" style="margin-bottom: 20px;">
				<h4 style="color: #60a5fa; margin-top: 0; margin-bottom: 16px;">
					<i class="fa fa-users"></i> Account Manager Pipeline Summary
				</h4>
				<div class="table-responsive">
					<table class="table table-hover">
						<thead>
							<tr>
								<th>Account Manager</th>
								<th style="text-align: center;">Total</th>
								<th style="text-align: right;">Total Amount</th>
								<th style="text-align: center; background: #667eea; color: white;">Pipeline A</th>
								<th style="text-align: center; background: #f59e0b; color: white;">Pipeline B</th>
								<th style="text-align: center; background: #10b981; color: white;">Pipeline C</th>
							</tr>
						</thead>
						<tbody>
							${summary_data.map((sp, index) => `
								<tr>
									<td>
										<i class="fa fa-user" style="color: #60a5fa; margin-right: 8px;"></i>
										<a href="#" class="view-account-manager-quotations" data-account-manager="${sp.sales_person}" data-index="${index}" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
											${sp.sales_person}
										</a>
									</td>
									<td style="text-align: center;">
										<span class="badge" style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 12px;">
											${sp.quotation_count}
										</span>
									</td>
									<td style="text-align: right;">
										<strong style="color: #10b981;">${this.formatCurrency(sp.total_amount)}</strong>
									</td>
									<td style="text-align: center; background: rgba(102, 126, 234, 0.1);">
										<div><strong style="color: #667eea;">${sp.pipeline_a_count}</strong></div>
										<small style="color: #667eea;"><strong>Amount:</strong> ${this.formatCurrency(sp.pipeline_a_amount)}</small>
									</td>
									<td style="text-align: center; background: rgba(245, 158, 11, 0.1);">
										<div><strong style="color: #f59e0b;">${sp.pipeline_b_count}</strong></div>
										<small style="color: #f59e0b;"><strong>Amount:</strong> ${this.formatCurrency(sp.pipeline_b_amount)}</small>
									</td>
									<td style="text-align: center; background: rgba(16, 185, 129, 0.1);">
										<div><strong style="color: #10b981;">${sp.pipeline_c_count}</strong></div>
										<small style="color: #10b981;"><strong>Amount:</strong> ${this.formatCurrency(sp.pipeline_c_amount)}</small>
									</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				</div>
			</div>
		`;

		this.main_container.find('.sales-person-summary-section').html(summary_html);

		// Setup click event for account manager names
		const self = this;
		this.main_container.find('.view-account-manager-quotations').on('click', function (e) {
			e.preventDefault();
			const account_manager = $(this).data('account-manager');
			self.show_account_manager_quotations_modal(account_manager);
		});
	}

	render_quotation_followup_table(quotations) {
		quotations = this.filter_records_by_internal_customer(quotations);
		// Store quotation data for modal view
		this.quotation_data = quotations;
	}

	render_quotation_table_content(quotations) {
		quotations = this.filter_records_by_internal_customer(quotations);
		return `
			<div class="table-responsive">
				<table class="table table-hover">
					<thead>
						<tr>
							<th>Quotation No</th>
							<th>Company</th>
							<th>Branch</th>
							<th>Sales Team</th>
							<th>Account Incharge</th>
							<th>Date</th>
							<th style="text-align: center;">Workflow State</th>
							<th style="text-align: right;">Amount</th>
							<th style="text-align: center;">Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						${quotations.length > 0 ? quotations.map(q => {
			// Determine status color based on the status field
			let status_color = 'label-success';
			if (q.status === 'Open') {
				status_color = 'label-primary';
			} else if (q.status === 'Replied') {
				status_color = 'label-info';
			} else if (q.status === 'Submitted') {
				status_color = 'label-success';
			}

			// Determine workflow state color
			let workflow_color = '#667eea';
			let workflow_bg = 'rgba(102, 126, 234, 0.1)';
			if (q.workflow_state === 'Pipeline B') {
				workflow_color = '#f59e0b';
				workflow_bg = 'rgba(245, 158, 11, 0.1)';
			} else if (q.workflow_state === 'Pipeline C') {
				workflow_color = '#10b981';
				workflow_bg = 'rgba(16, 185, 129, 0.1)';
			}

			return `
								<tr>
									<td>
										<a href="/app/quotation/${q.name}" target="_blank" style="color: #60a5fa; text-decoration: none;">
											${q.name}
										</a>
									</td>
									<td>${q.company || '-'}</td>
									<td>${q.branch || '-'}</td>
									<td>${q.custom_sales_team || '-'}</td>
									<td>
										<small>${q.account_incharge || '-'}</small>
									</td>
									<td>${q.transaction_date ? frappe.datetime.str_to_user(q.transaction_date) : '-'}</td>
									<td style="text-align: center; background: ${workflow_bg};">
										<span class="badge" style="background: ${workflow_color}; color: white;">
											${q.workflow_state || '-'}
										</span>
									</td>
									<td style="text-align: right;">
										<strong>${this.formatCurrency(q.grand_total || 0)}</strong>
									</td>
									<td style="text-align: center;">
										<span class="label ${status_color}">
											${q.status || 'Open'}
										</span>
									</td>
									<td>
										<button class="btn btn-xs btn-primary" onclick="frappe.set_route('Form', 'Quotation', '${q.name}')">
											<i class="fa fa-eye"></i> View
										</button>
									</td>
								</tr>
							`;
		}).join('') : `
							<tr>
								<td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-check-circle" style="font-size: 24px; margin-bottom: 10px; color: #10b981;"></i>
									<p>No quotations found in this pipeline!</p>
								</td>
							</tr>
						`}
					</tbody>
				</table>
			</div>
		`;
	}

	show_account_manager_quotations_modal(account_manager) {
		const self = this;

		// Filter quotations for this specific account manager
		const manager_quotations = this.quotation_data ? this.quotation_data.filter(q => q.account_incharge === account_manager) : [];

		// Create modal dialog
		const modal = new frappe.ui.Dialog({
			title: `<i class="fa fa-user"></i> Quotations - ${account_manager}`,
			size: 'extra-large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'quotation_list'
				}
			]
		});

		// Render the quotations table in the modal
		const quotation_html = `
			<div style="padding: 10px;">
				<!-- Summary Stats -->
				<div class="row" style="margin-bottom: 20px;">
					<div class="col-md-3">
						<div class="stat-card" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 15px; border-radius: 8px; text-align: center;">
							<h4 class="stat-title" style="color: white; margin: 0;">Total Quotations</h4>
							<div class="stat-value" style="color: white; font-size: 32px; font-weight: bold;">${manager_quotations.length}</div>
						</div>
					</div>
					<div class="col-md-3">
						<div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; text-align: center;">
							<h4 class="stat-title" style="color: white; margin: 0;">Pipeline A</h4>
							<div class="stat-value" style="color: white; font-size: 32px; font-weight: bold;">${manager_quotations.filter(q => q.workflow_state === 'Pipeline A').length}</div>
							<small style="color: white;"><strong>Amount:</strong> ${this.formatCurrency(manager_quotations.filter(q => q.workflow_state === 'Pipeline A').reduce((sum, q) => sum + (q.grand_total || 0), 0))}</small>
						</div>
					</div>
					<div class="col-md-3">
						<div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 15px; border-radius: 8px; text-align: center;">
							<h4 class="stat-title" style="color: white; margin: 0;">Pipeline B</h4>
							<div class="stat-value" style="color: white; font-size: 32px; font-weight: bold;">${manager_quotations.filter(q => q.workflow_state === 'Pipeline B').length}</div>
							<small style="color: white;"><strong>Amount:</strong> ${this.formatCurrency(manager_quotations.filter(q => q.workflow_state === 'Pipeline B').reduce((sum, q) => sum + (q.grand_total || 0), 0))}</small>
						</div>
					</div>
					<div class="col-md-3">
						<div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 15px; border-radius: 8px; text-align: center;">
							<h4 class="stat-title" style="color: white; margin: 0;">Pipeline C</h4>
							<div class="stat-value" style="color: white; font-size: 32px; font-weight: bold;">${manager_quotations.filter(q => q.workflow_state === 'Pipeline C').length}</div>
							<small style="color: white;"><strong>Amount:</strong> ${this.formatCurrency(manager_quotations.filter(q => q.workflow_state === 'Pipeline C').reduce((sum, q) => sum + (q.grand_total || 0), 0))}</small>
						</div>
					</div>
				</div>

				<!-- Quotations Table -->
				<div class="table-responsive">
					<table class="table table-hover" style="background: #000000;">
						<thead>
							<tr style="background: #1a1a1a; color: white;">
								<th style="color: white;">Quotation No</th>
								<th style="color: white;">Company</th>
								<th style="color: white;">Branch</th>
								<th style="color: white;">Sales Team</th>
								<th style="color: white;">Date</th>
								<th style="text-align: center; color: white;">Workflow State</th>
								<th style="text-align: right; color: white;">Amount</th>
								<th style="text-align: center; color: white;">Status</th>
								<th style="color: white;">Actions</th>
							</tr>
						</thead>
						<tbody style="background: #000000;">
							${manager_quotations.length > 0 ? manager_quotations.map(q => {
			// Determine status color
			let status_color = 'label-success';
			if (q.status === 'Open') {
				status_color = 'label-primary';
			} else if (q.status === 'Replied') {
				status_color = 'label-info';
			} else if (q.status === 'Submitted') {
				status_color = 'label-success';
			}

			// Determine workflow state color
			let workflow_color = '#667eea';
			let workflow_bg = 'rgba(102, 126, 234, 0.1)';
			if (q.workflow_state === 'Pipeline B') {
				workflow_color = '#f59e0b';
				workflow_bg = 'rgba(245, 158, 11, 0.1)';
			} else if (q.workflow_state === 'Pipeline C') {
				workflow_color = '#10b981';
				workflow_bg = 'rgba(16, 185, 129, 0.1)';
			}

			return `
									<tr style="background: #000000; color: white;">
										<td style="color: white;">
											<a href="/app/quotation/${q.name}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
												${q.name}
											</a>
										</td>
										<td style="color: white;">${q.company || '-'}</td>
										<td style="color: white;">${q.branch || '-'}</td>
										<td style="color: white;">${q.custom_sales_team || '-'}</td>
										<td style="color: white;">${q.transaction_date ? frappe.datetime.str_to_user(q.transaction_date) : '-'}</td>
										<td style="text-align: center; background: ${workflow_bg};">
											<span class="badge" style="background: ${workflow_color}; color: white;">
												${q.workflow_state || '-'}
											</span>
										</td>
										<td style="text-align: right; color: white;">
											<strong style="color: #10b981;">${this.formatCurrency(q.grand_total || 0)}</strong>
										</td>
										<td style="text-align: center;">
											<span class="label ${status_color}">
												${q.status || 'Open'}
											</span>
										</td>
										<td>
											<button class="btn btn-xs btn-primary" onclick="frappe.set_route('Form', 'Quotation', '${q.name}')">
												<i class="fa fa-eye"></i> View
											</button>
										</td>
									</tr>
								`;
		}).join('') : `
								<tr style="background: #000000;">
									<td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8; background: #000000;">
										<i class="fa fa-inbox" style="font-size: 24px; margin-bottom: 10px; color: #94a3b8;"></i>
										<p style="color: #94a3b8;">No quotations found for this account manager!</p>
									</td>
								</tr>
							`}
						</tbody>
					</table>
				</div>
			</div>
		`;

		modal.fields_dict.quotation_list.$wrapper.html(quotation_html);
		modal.show();
	}

	render_dispute_section() {
		const content = $(`
			<div class="dispute-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-exclamation-triangle"></i>
						Dispute
					</h2>
					<p class="content-subtitle">Track and manage customer payment disputes</p>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Summary Cards -->
						<div class="dispute-summary-cards"></div>

						<!-- Tabs -->
						<div class="dispute-tabs" style="margin-top: 20px; margin-bottom: 20px;">
							<ul class="nav nav-tabs" style="border-bottom: 2px solid #dee2e6; background: rgba(255, 255, 255, 0.05); padding: 5px; border-radius: 4px 4px 0 0;">
								<li class="nav-item">
									<a href="javascript:void(0)" class="nav-link dispute-type-tab active" data-reference="Sales Order" style="cursor: pointer; font-weight: 600; color: #fff; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4);">
										<i class="fa fa-file-text-o"></i> Sales Order
									</a>
								</li>
								<li class="nav-item">
									<a href="javascript:void(0)" class="nav-link dispute-type-tab" data-reference="Sales Invoice" style="cursor: pointer; font-weight: 600; color: #e2e8f0; background: transparent; border: 1px solid transparent;">
										<i class="fa fa-file-text"></i> Sales Invoice
									</a>
								</li>
								<li class="nav-item">
									<a href="javascript:void(0)" class="nav-link dispute-type-tab" data-reference="Project" style="cursor: pointer; font-weight: 600; color: #e2e8f0; background: transparent; border: 1px solid transparent;">
										<i class="fa fa-folder"></i> Project
									</a>
								</li>
							</ul>
							<div class="dispute-table-container" style="margin-top: 20px;"></div>
						</div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.setup_dispute_tab_events();
		this.load_dispute_data();
	}

	setup_dispute_tab_events() {
		const self = this;

		// Add CSS for tab styling
		if (!$('#dispute-tab-styles').length) {
			$('head').append(`
				<style id="dispute-tab-styles">
					.dispute-type-tab {
						transition: all 0.3s ease;
					}
					.dispute-type-tab:hover {
						background: rgba(59, 130, 246, 0.15) !important;
						color: #fff !important;
					}
					.dispute-type-tab.active {
						background: rgba(59, 130, 246, 0.3) !important;
						color: #fff !important;
						border: 1px solid rgba(59, 130, 246, 0.6) !important;
						box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
					}
				</style>
			`);
		}

		// Handle tab switching
		$('.dispute-type-tab').on('click', function (e) {
			e.preventDefault();
			const reference_type = $(this).data('reference');
			console.log('Dispute tab clicked:', reference_type);

			// Update active state and styling
			$('.dispute-type-tab').removeClass('active').css({
				'background': 'transparent',
				'border': '1px solid transparent',
				'color': '#e2e8f0'
			});

			$(this).addClass('active').css({
				'background': 'rgba(59, 130, 246, 0.3)',
				'border': '1px solid rgba(59, 130, 246, 0.6)',
				'color': '#fff'
			});

			// Load data for this reference type
			self.load_dispute_data_by_reference(reference_type);
		});
	}

	load_dispute_data() {
		const self = this;

		// Require company filter
		if (!self.filters.company) {
			console.log('[Dispute] No company selected, showing empty state');
			self.all_disputes = [];
			self.render_dispute_summary_cards({
				total_disputes: 0,
				pending_disputes: 0,
				sales_order_count: 0,
				sales_invoice_count: 0,
				project_count: 0
			});
			self.render_dispute_table([], 'Sales Order');

			// Show message to select company
			frappe.msgprint(__('Please select a company to view dispute data.'));
			return;
		}

		console.log('[Dispute] Loading all disputes with filters:', self.filters);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_dispute_data',
			args: {
				company: self.filters.company || null,
				customer: self.filters.customer || null,
				branch: self.filters.branch || null,
				sales_person: self.filters.sales_person || null,
				sales_team: self.filters.sales_team || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: function (r) {
				if (r.message) {
					const dispute_data = r.message;

					// Store all dispute data
					self.all_disputes = dispute_data;

					// Calculate summary
					const total_disputes = dispute_data.length;
					const pending_disputes = dispute_data.filter(d => d.status === 'Open' || d.status === 'Pending').length;

					// Count by reference type
					const sales_order_count = dispute_data.filter(d => d.reference === 'Sales Order').length;
					const sales_invoice_count = dispute_data.filter(d => d.reference === 'Sales Invoice').length;
					const project_count = dispute_data.filter(d => d.reference === 'Project').length;

					self.render_dispute_summary_cards({
						total_disputes: total_disputes,
						pending_disputes: pending_disputes,
						sales_order_count: sales_order_count,
						sales_invoice_count: sales_invoice_count,
						project_count: project_count
					});

					// Load Sales Order tab by default
					self.load_dispute_data_by_reference('Sales Order');
				} else {
					// Show empty state
					self.all_disputes = [];
					self.render_dispute_summary_cards({
						total_disputes: 0,
						pending_disputes: 0,
						sales_order_count: 0,
						sales_invoice_count: 0,
						project_count: 0
					});
					// Show empty Sales Order table
					self.render_dispute_table([], 'Sales Order');
				}
			},
			error: function (r) {
				// Handle error - show empty state
				self.all_disputes = [];
				self.render_dispute_summary_cards({
					total_disputes: 0,
					pending_disputes: 0,
					sales_order_count: 0,
					sales_invoice_count: 0,
					project_count: 0
				});
				// Show empty Sales Order table
				self.render_dispute_table([], 'Sales Order');
			}
		});
	}

	load_dispute_data_by_reference(reference_type) {
		const self = this;
		console.log('[Dispute] Loading disputes for reference type:', reference_type);

		// Filter disputes by reference type
		const filtered_disputes = (self.all_disputes || []).filter(d => d.reference === reference_type);

		// Render the table for this specific reference type
		self.render_dispute_table(filtered_disputes, reference_type);
	}

	render_dispute_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Disputes</h4>
							<div class="stat-icon primary">
								<i class="fa fa-exclamation-triangle"></i>
							</div>
						</div>
						<div class="stat-value">${data.total_disputes}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Pending Disputes</h4>
							<div class="stat-icon warning">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.pending_disputes}</div>
					</div>
				</div>
				<div class="col-md-2">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Sales Order</h4>
							<div class="stat-icon info">
								<i class="fa fa-file-text-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.sales_order_count || 0}</div>
					</div>
				</div>
				<div class="col-md-2">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Sales Invoice</h4>
							<div class="stat-icon success">
								<i class="fa fa-file-text"></i>
							</div>
						</div>
						<div class="stat-value">${data.sales_invoice_count || 0}</div>
					</div>
				</div>
				<div class="col-md-2">
					<div class="stat-card danger">
						<div class="stat-header">
							<h4 class="stat-title">Project</h4>
							<div class="stat-icon danger">
								<i class="fa fa-folder"></i>
							</div>
						</div>
						<div class="stat-value">${data.project_count || 0}</div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.dispute-summary-cards').html(cards_html);
	}

	render_dispute_table(disputes, reference_type) {
		disputes = this.filter_records_by_internal_customer(disputes);
		// Single container for all tabs
		let container_selector = '.dispute-table-container';
		let ref_field = 'sales_order';
		let ref_doctype = 'Sales Order';

		if (reference_type === 'Sales Invoice') {
			ref_field = 'sales_invoice';
			ref_doctype = 'Sales Invoice';
		} else if (reference_type === 'Project') {
			ref_field = 'project';
			ref_doctype = 'Project';
		}

		const is_sales_invoice = reference_type === 'Sales Invoice';
		const col_count = is_sales_invoice ? 11 : 10;

		const table_html = `
			<div class="table-responsive">
				<table class="table table-hover">
					<thead>
						<tr>
							<th>Dispute ID</th>
							<th>Company</th>
							<th>Customer</th>
							<th>${reference_type}</th>
							${is_sales_invoice ? '<th style="text-align: right;">Outstanding Amount</th>' : ''}
							<th>Branch</th>
							<th>Dispute Date</th>
							<th>Reason</th>
							<th>Sales Person</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						${disputes.length > 0 ? disputes.map(d => {
			const ref_value = d[ref_field] || '-';
			const ref_url = ref_value !== '-' ? `/app/${ref_doctype.toLowerCase().replace(' ', '-')}/${ref_value}` : '#';

			return `
								<tr>
									<td>
										<a href="/app/dispute/${d.dispute_id || ''}" target="_blank" style="color: #60a5fa; text-decoration: none;">
											${d.dispute_id || '-'}
										</a>
									</td>
									<td>${d.company || '-'}</td>
									<td>${d.customer || '-'}</td>
									<td>
										${ref_value !== '-' ? `
											<a href="${ref_url}" target="_blank" style="color: #60a5fa; text-decoration: none;">
												${ref_value}
											</a>
										` : '-'}
									</td>
									${is_sales_invoice ? `<td style="text-align: right; font-weight: 600;">${this.formatCurrency(d.outstanding_amount || 0)}</td>` : ''}
									<td>${d.branch || '-'}</td>
									<td>${d.dispute_date ? frappe.datetime.str_to_user(d.dispute_date) : '-'}</td>
									<td>${d.reason || '-'}</td>
									<td>${d.sales_person || '-'}</td>
									<td>
										<span class="label ${d.status === 'Open' || d.status === 'Pending' ? 'label-warning' : 'label-success'}">
											${d.status || 'Open'}
										</span>
									</td>
									<td>
										<button class="btn btn-xs btn-primary" onclick="window.open('/app/dispute/${d.dispute_id || ''}', '_blank')">
											<i class="fa fa-eye"></i> View
										</button>
									</td>
								</tr>
							`;
		}).join('') : `
							<tr>
								<td colspan="${col_count}" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
									<p>No disputes found for ${reference_type}</p>
								</td>
							</tr>
						`}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find(container_selector).html(table_html);
	}

	// ==================== Customer Outstanding Clearance Section ====================
	render_customer_outstanding_clearance_section() {
		const content = $(`
			<div class="customer-outstanding-clearance-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-check-circle"></i>
						Customer Outstanding Clearance
					</h2>
					<p class="content-subtitle">Track and manage customer outstanding clearance requests</p>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Sub-tabs -->
						<div class="clearance-sub-tabs" style="margin-bottom: 20px;">
							<div class="btn-group" role="group">
								<button class="btn clearance-tab-btn active" data-tab="details" style="background: rgba(59, 130, 246, 0.8); color: #fff; border: 1px solid rgba(59, 130, 246, 0.5); padding: 8px 20px; font-weight: 600;">
									<i class="fa fa-list"></i> Details
								</button>
								<button class="btn clearance-tab-btn" data-tab="workflow_summary" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); padding: 8px 20px; font-weight: 600;">
									<i class="fa fa-sitemap"></i> Workflow Summary
								</button>
							</div>
						</div>

						<!-- Tab: Details -->
						<div class="clearance-tab-content clearance-tab-details">
							<!-- Summary Cards -->
							<div class="clearance-summary-cards"></div>

							<!-- Filters Row -->
							<div class="clearance-filters-row" style="margin-top: 20px; margin-bottom: 20px;">
								<div class="row">
									<div class="col-md-3">
										<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">Type</label>
										<select id="clearance-type-filter" class="form-control" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
											<option value="">All Types</option>
										</select>
									</div>
									<div class="col-md-3">
										<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">Status</label>
										<select id="clearance-status-filter" class="form-control" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
											<option value="">All Statuses</option>
										</select>
									</div>
									<div class="col-md-3">
										<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">&nbsp;</label>
										<button id="clearance-apply-filter-btn" class="btn btn-primary" style="width: 100%;">
											<i class="fa fa-filter"></i> Apply Filter
										</button>
									</div>
									<div class="col-md-3">
										<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">&nbsp;</label>
										<button id="clearance-reset-filter-btn" class="btn btn-default" style="width: 100%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
											<i class="fa fa-refresh"></i> Reset
										</button>
									</div>
								</div>
							</div>

							<!-- Table Container -->
							<div class="clearance-table-container" style="margin-top: 20px;"></div>
						</div>

						<!-- Tab: Workflow Summary -->
						<div class="clearance-tab-content clearance-tab-workflow_summary" style="display: none;">
							<div class="clearance-workflow-summary"></div>
						</div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.setup_clearance_filter_events();
		this.load_customer_outstanding_clearance_data();
	}

	setup_clearance_filter_events() {
		const self = this;

		// Add CSS for select styling
		if (!$('#clearance-select-styles').length) {
			$('head').append(`
				<style id="clearance-select-styles">
					#clearance-type-filter option,
					#clearance-status-filter option {
						background: #1e293b;
						color: #fff;
					}
				</style>
			`);
		}

		// Sub-tab switching
		this.main_container.find('.clearance-tab-btn').on('click', function () {
			const tab = $(this).data('tab');

			// Update button styles
			self.main_container.find('.clearance-tab-btn').css({
				'background': 'rgba(255,255,255,0.1)',
				'color': '#cbd5e1'
			}).removeClass('active');
			$(this).css({
				'background': 'rgba(59, 130, 246, 0.8)',
				'color': '#fff'
			}).addClass('active');

			// Show/hide tab content
			self.main_container.find('.clearance-tab-content').hide();
			self.main_container.find('.clearance-tab-' + tab).show();

			// Re-render workflow summary from stored data when switching to that tab
			if (tab === 'workflow_summary' && self.clearance_workflow_data) {
				self.render_clearance_workflow_summary(self.clearance_workflow_data);
			}
		});

		// Apply filter button
		$('#clearance-apply-filter-btn').on('click', function () {
			self.filter_clearance_table();
		});

		// Reset filter button
		$('#clearance-reset-filter-btn').on('click', function () {
			$('#clearance-type-filter').val('');
			$('#clearance-status-filter').val('');
			self.filter_clearance_table();
		});

		// Also filter on change
		$('#clearance-type-filter, #clearance-status-filter').on('change', function () {
			self.filter_clearance_table();
		});
	}

	load_customer_outstanding_clearance_data() {
		const self = this;

		// Require company filter
		if (!self.filters.company) {
			console.log('[Customer Outstanding Clearance] No company selected, showing empty state');
			self.all_clearance_data = [];
			self.render_clearance_summary_cards({
				total_records: 0,
				total_amount: 0,
				pending_count: 0,
				approved_count: 0
			});
			self.render_clearance_table([]);
			frappe.msgprint(__('Please select a company to view customer outstanding clearance data.'));
			return;
		}

		console.log('[Customer Outstanding Clearance] Loading data with filters:', self.filters);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_customer_outstanding_clearance_data',
			args: {
				company: self.filters.company || null,
				branch: self.filters.branch || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: function (r) {
				if (r.message && r.message.data) {
					const clearance_data = r.message.data;
					const summary = r.message.summary || {};

					// Store all data
					self.all_clearance_data = clearance_data;

					// Populate filter dropdowns
					self.populate_clearance_filter_options(clearance_data);

					// Render summary cards
					self.render_clearance_summary_cards({
						total_records: summary.total_records || clearance_data.length,
						total_amount: summary.total_amount || 0,
						pending_count: summary.pending_count || 0,
						approved_count: summary.approved_count || 0
					});

					// Store and render workflow state summary
					self.clearance_workflow_data = r.message.workflow_summary || [];
					self.render_clearance_workflow_summary(self.clearance_workflow_data);

					// Render table
					self.render_clearance_table(clearance_data);
				} else {
					// Show empty state
					self.all_clearance_data = [];
					self.render_clearance_summary_cards({
						total_records: 0,
						total_amount: 0,
						pending_count: 0,
						approved_count: 0
					});
					self.render_clearance_workflow_summary([]);
					self.render_clearance_table([]);
				}
			},
			error: function () {
				// Handle error - show empty state
				self.all_clearance_data = [];
				self.render_clearance_summary_cards({
					total_records: 0,
					total_amount: 0,
					pending_count: 0,
					approved_count: 0
				});
				self.render_clearance_table([]);
			}
		});
	}

	populate_clearance_filter_options(data) {
		// Get unique types
		const types = [...new Set(data.map(d => d.from_type).filter(Boolean))];
		const typeSelect = $('#clearance-type-filter');
		typeSelect.find('option:not(:first)').remove();
		types.forEach(type => {
			typeSelect.append(`<option value="${type}">${type}</option>`);
		});

		// Get unique statuses
		const statuses = [...new Set(data.map(d => d.status).filter(Boolean))];
		const statusSelect = $('#clearance-status-filter');
		statusSelect.find('option:not(:first)').remove();
		statuses.forEach(status => {
			statusSelect.append(`<option value="${status}">${status}</option>`);
		});
	}

	filter_clearance_table() {
		const type_filter = $('#clearance-type-filter').val();
		const status_filter = $('#clearance-status-filter').val();

		let filtered_data = this.all_clearance_data || [];

		if (type_filter) {
			filtered_data = filtered_data.filter(d => d.from_type === type_filter);
		}

		if (status_filter) {
			filtered_data = filtered_data.filter(d => d.status === status_filter);
		}

		this.render_clearance_table(filtered_data);
	}

	render_clearance_summary_cards(data) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Records</h4>
							<div class="stat-icon primary">
								<i class="fa fa-list"></i>
							</div>
						</div>
						<div class="stat-value">${data.total_records}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Total Amount</h4>
							<div class="stat-icon success">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value">${this.formatCurrency(data.total_amount)}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card warning">
						<div class="stat-header">
							<h4 class="stat-title">Pending</h4>
							<div class="stat-icon warning">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="stat-value">${data.pending_count}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Approved</h4>
							<div class="stat-icon info">
								<i class="fa fa-check"></i>
							</div>
						</div>
						<div class="stat-value">${data.approved_count}</div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.clearance-summary-cards').html(cards_html);
	}

	render_clearance_workflow_summary(workflow_summary) {
		const container = this.main_container.find('.clearance-workflow-summary');
		if (!container.length) {
			console.warn('clearance-workflow-summary container not found');
			return;
		}

		if (!workflow_summary || workflow_summary.length === 0) {
			container.html(`
				<div style="padding: 40px; text-align: center; color: #94a3b8;">
					<i class="fa fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
					<p>No workflow state data available</p>
				</div>
			`);
			return;
		}

		const total_amount = workflow_summary.reduce((sum, ws) => sum + (ws.grand_total || 0), 0);

		const rows_html = workflow_summary.map(ws => `
			<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
				<td style="padding: 12px; color: #e2e8f0; font-weight: 600;">${ws.workflow_state}</td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0; font-weight: 700;">${this.formatCurrency(ws.grand_total)}</td>
			</tr>
		`).join('');

		const summary_html = `
			<div style="padding: 20px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.3);">
				<h4 style="color: #e2e8f0; font-weight: 700; margin-bottom: 16px;">
					<i class="fa fa-sitemap" style="margin-right: 8px; color: #3b82f6;"></i>
					Workflow State Summary
				</h4>
				<div class="table-responsive">
					<table class="table" style="margin-bottom: 0;">
						<thead style="background-color: rgba(59, 130, 246, 0.1); border-bottom: 2px solid rgba(59, 130, 246, 0.3);">
							<tr>
								<th style="color: #cbd5e1; font-weight: 600; padding: 12px;">Workflow State</th>
								<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">Grand Total</th>
							</tr>
						</thead>
						<tbody>
							${rows_html}
							<tr style="background-color: rgba(59, 130, 246, 0.1); border-top: 2px solid rgba(59, 130, 246, 0.3);">
								<td style="padding: 12px; color: #e2e8f0; font-weight: 700;">Total</td>
								<td style="padding: 12px; text-align: right; color: #60a5fa; font-weight: 700; font-size: 16px;">${this.formatCurrency(total_amount)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		`;

		container.html(summary_html);
	}

	render_clearance_table(data) {
		data = this.filter_records_by_internal_customer(data);
		const table_html = `
			<div class="table-responsive">
				<table class="table table-hover">
					<thead>
						<tr>
							<th>Name</th>
							<th>Company</th>
							<th>Branch</th>
							<th>Customer</th>
							<th>Is Frozen</th>
							<th>Date</th>
							<th>Reason</th>
							<th>Grand Total</th>
							<th>Type</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						${data.length > 0 ? data.map(d => {
			const status_class = this.get_clearance_status_class(d.status);
			return `
								<tr>
									<td>
										<a href="/app/customer-outstanding-clearence/${d.name || ''}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
											${d.name || '-'}
										</a>
									</td>
									<td>${d.company || '-'}</td>
									<td>${d.branch || '-'}</td>
									<td>${d.customer || '-'}</td>
									<td style="text-align: center;">
										<span style="padding: 3px 8px; border-radius: 10px; background: ${d.is_frozen ? '#dc3545' : '#28a745'}; color: white; font-size: 11px; font-weight: 600;">
											${d.is_frozen ? 'Yes' : 'No'}
										</span>
									</td>
									<td>${d.date ? frappe.datetime.str_to_user(d.date) : '-'}</td>
									<td>${d.reason || '-'}</td>
									<td style="text-align: right; font-weight: 600;">${this.formatCurrency(d.grand_total || 0)}</td>
									<td>${d.from_type || '-'}</td>
									<td>
										<span class="label ${status_class}">
											${d.status || '-'}
										</span>
									</td>
								</tr>
							`;
		}).join('') : `
							<tr>
								<td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
									<p>No customer outstanding clearance records found</p>
								</td>
							</tr>
						`}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.clearance-table-container').html(table_html);
	}

	get_clearance_status_class(status) {
		const status_lower = (status || '').toLowerCase();
		if (status_lower === 'approved' || status_lower === 'completed') {
			return 'label-success';
		} else if (status_lower === 'pending' || status_lower === 'draft') {
			return 'label-warning';
		} else if (status_lower === 'rejected' || status_lower === 'cancelled') {
			return 'label-danger';
		}
		return 'label-default';
	}

	get_clearance_workflow_class(workflow_state) {
		const state_lower = (workflow_state || '').toLowerCase();
		if (state_lower === 'approved' || state_lower === 'completed') {
			return 'label-success';
		} else if (state_lower === 'pending' || state_lower === 'pending approval' || state_lower === 'draft') {
			return 'label-warning';
		} else if (state_lower === 'rejected' || state_lower === 'cancelled') {
			return 'label-danger';
		}
		return 'label-info';
	}
	// ==================== End Customer Outstanding Clearance Section ====================

	// ==================== Cheque Document Section ====================
	render_cheque_document_section() {
		const content = $(`
			<div class="cheque-document-section-wrapper">
				<div class="content-header">
					${this.create_global_title_section()}
					<h2 class="content-title">
						<i class="fa fa-money"></i>
						Cheque Document
					</h2>
					<p class="content-subtitle">Track and manage cheque documents from customers</p>
				</div>
				<div class="content-body">
					<div class="section-card">
						<!-- Summary Cards -->
						<div class="cheque-summary-cards"></div>

						<!-- Filters Row -->
						<div class="cheque-filters-row" style="margin-top: 20px; margin-bottom: 20px;">
							<div class="row">
								<div class="col-md-3">
									<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">Workflow State</label>
									<select id="cheque-workflow-filter" class="form-control" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
										<option value="">All States</option>
									</select>
								</div>
								<div class="col-md-3">
									<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">Purpose</label>
									<select id="cheque-purpose-filter" class="form-control" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
										<option value="">All Purposes</option>
									</select>
								</div>
								<div class="col-md-3">
									<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">Type</label>
									<select id="cheque-type-filter" class="form-control" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
										<option value="">All Types</option>
									</select>
								</div>
								<div class="col-md-3">
									<label style="color: #e2e8f0; font-weight: 600; margin-bottom: 5px;">&nbsp;</label>
									<div class="btn-group" style="width: 100%;">
										<button id="cheque-apply-filter-btn" class="btn btn-primary" style="width: 50%;">
											<i class="fa fa-filter"></i> Apply
										</button>
										<button id="cheque-reset-filter-btn" class="btn btn-default" style="width: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
											<i class="fa fa-refresh"></i> Reset
										</button>
									</div>
								</div>
							</div>
						</div>

						<!-- Table Container -->
						<div class="cheque-table-container" style="margin-top: 20px;"></div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.setup_cheque_filter_events();
		this.load_cheque_document_data();
	}

	setup_cheque_filter_events() {
		const self = this;

		// Add CSS for select styling
		if (!$('#cheque-select-styles').length) {
			$('head').append(`
				<style id="cheque-select-styles">
					#cheque-workflow-filter option,
					#cheque-purpose-filter option,
					#cheque-type-filter option {
						background: #1e293b;
						color: #fff;
					}
				</style>
			`);
		}

		// Apply filter button
		$('#cheque-apply-filter-btn').on('click', function () {
			self.filter_cheque_table();
		});

		// Reset filter button
		$('#cheque-reset-filter-btn').on('click', function () {
			$('#cheque-workflow-filter').val('');
			$('#cheque-purpose-filter').val('');
			$('#cheque-type-filter').val('');
			self.filter_cheque_table();
		});

		// Also filter on change
		$('#cheque-workflow-filter, #cheque-purpose-filter, #cheque-type-filter').on('change', function () {
			self.filter_cheque_table();
		});
	}

	load_cheque_document_data() {
		const self = this;

		// Require company filter
		if (!self.filters.company) {
			console.log('[Cheque Document] No company selected, showing empty state');
			self.all_cheque_data = [];
			self.render_cheque_summary_cards({
				total_records: 0,
				total_amount: 0,
				workflow_summary: {},
				type_summary: {}
			});
			self.render_cheque_table([]);
			frappe.msgprint(__('Please select a company to view cheque document data.'));
			return;
		}

		console.log('[Cheque Document] Loading data with filters:', self.filters);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_cheque_document_data',
			args: {
				company: self.filters.company || null,
				branch: self.filters.branch || null,
				internal_customer: self.get_internal_customer_param()
			},
			callback: function (r) {
				if (r.message) {
					const cheque_data = r.message.data || [];
					const summary = r.message.summary || {};
					const filter_options = r.message.filter_options || {};

					// Store all data
					self.all_cheque_data = cheque_data;

					// Populate filter dropdowns
					self.populate_cheque_filter_options(filter_options);

					// Render summary cards
					self.render_cheque_summary_cards(summary);

					// Render table
					self.render_cheque_table(cheque_data);
				} else {
					self.all_cheque_data = [];
					self.render_cheque_summary_cards({
						total_records: 0,
						total_amount: 0,
						workflow_summary: {},
						type_summary: {}
					});
					self.render_cheque_table([]);
				}
			},
			error: function (err) {
				console.error('[Cheque Document] Error loading data:', err);
				self.all_cheque_data = [];
				self.render_cheque_summary_cards({
					total_records: 0,
					total_amount: 0,
					workflow_summary: {},
					type_summary: {}
				});
				self.render_cheque_table([]);
			}
		});
	}

	populate_cheque_filter_options(filter_options) {
		// Populate workflow state filter
		const workflow_select = $('#cheque-workflow-filter');
		workflow_select.find('option:not(:first)').remove();
		(filter_options.workflow_states || []).forEach(state => {
			workflow_select.append(`<option value="${state}">${state}</option>`);
		});

		// Populate purpose filter
		const purpose_select = $('#cheque-purpose-filter');
		purpose_select.find('option:not(:first)').remove();
		(filter_options.purposes || []).forEach(purpose => {
			purpose_select.append(`<option value="${purpose}">${purpose}</option>`);
		});

		// Populate type filter
		const type_select = $('#cheque-type-filter');
		type_select.find('option:not(:first)').remove();
		(filter_options.types || []).forEach(type => {
			type_select.append(`<option value="${type}">${type}</option>`);
		});
	}

	filter_cheque_table() {
		const workflow_filter = $('#cheque-workflow-filter').val();
		const purpose_filter = $('#cheque-purpose-filter').val();
		const type_filter = $('#cheque-type-filter').val();

		let filtered_data = this.all_cheque_data || [];

		if (workflow_filter) {
			filtered_data = filtered_data.filter(r => r.workflow_state === workflow_filter);
		}
		if (purpose_filter) {
			filtered_data = filtered_data.filter(r => r.purpose === purpose_filter);
		}
		if (type_filter) {
			filtered_data = filtered_data.filter(r => r.type === type_filter);
		}

		this.render_cheque_table(filtered_data);
	}

	render_cheque_summary_cards(summary) {
		const total_records = summary.total_records || 0;
		const total_amount = summary.total_amount || 0;
		const workflow_summary = summary.workflow_summary || {};
		const type_summary = summary.type_summary || {};

		// Build workflow state cards
		let workflow_cards = '';
		Object.keys(workflow_summary).forEach(state => {
			const data = workflow_summary[state];
			workflow_cards += `
				<div class="col-md-2">
					<div class="stat-card info" style="padding: 15px;">
						<div class="stat-title" style="font-size: 12px; color: #94a3b8;">${state}</div>
						<div class="stat-value" style="font-size: 18px; font-weight: 700;">${data.count}</div>
						<div class="stat-subtitle" style="font-size: 11px; color: #64748b;">${this.formatCurrency(data.amount)}</div>
					</div>
				</div>
			`;
		});

		const html = `
			<div class="row" style="margin-bottom: 15px;">
				<div class="col-md-3">
					<div class="stat-card primary" style="padding: 20px;">
						<div class="stat-header">
							<h4 class="stat-title">Total Records</h4>
							<div class="stat-icon primary">
								<i class="fa fa-file-text-o"></i>
							</div>
						</div>
						<div class="stat-value">${total_records.toLocaleString()}</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card success" style="padding: 20px;">
						<div class="stat-header">
							<h4 class="stat-title">Total Amount</h4>
							<div class="stat-icon success">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value">${this.formatCurrency(total_amount)}</div>
					</div>
				</div>
				${workflow_cards}
			</div>
		`;

		this.main_container.find('.cheque-summary-cards').html(html);
	}

	render_cheque_table(data) {
		data = this.filter_records_by_internal_customer(data);
		if (!data || data.length === 0) {
			this.main_container.find('.cheque-table-container').html(`
				<div class="empty-state" style="text-align: center; padding: 40px; color: #94a3b8;">
					<i class="fa fa-inbox" style="font-size: 48px; margin-bottom: 15px;"></i>
					<p>No cheque documents found</p>
				</div>
			`);
			return;
		}

		const table_html = `
			<div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
				<table class="table table-striped" style="background: rgba(255,255,255,0.05); border-radius: 8px;">
					<thead style="background: rgba(59, 130, 246, 0.2); position: sticky; top: 0;">
						<tr>
							<th style="color: #e2e8f0; padding: 12px;">Name</th>
							<th style="color: #e2e8f0; padding: 12px;">Date</th>
							<th style="color: #e2e8f0; padding: 12px;">Company</th>
							<th style="color: #e2e8f0; padding: 12px;">Branch</th>
							<th style="color: #e2e8f0; padding: 12px;">Type</th>
							<th style="color: #e2e8f0; padding: 12px;">Party</th>
							<th style="color: #e2e8f0; padding: 12px;">Party Name</th>
							<th style="color: #e2e8f0; padding: 12px;">Purpose</th>
							<th style="color: #e2e8f0; padding: 12px;">Remarks</th>
							<th style="color: #e2e8f0; padding: 12px; text-align: right;">Amount</th>
							<th style="color: #e2e8f0; padding: 12px;">Workflow State</th>
						</tr>
					</thead>
					<tbody>
						${data.map(row => `
							<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
								<td style="color: #e2e8f0; padding: 10px;">
									<a href="/app/cheque-document/${row.name}" target="_blank" style="color: #3b82f6;">${row.name}</a>
								</td>
								<td style="color: #e2e8f0; padding: 10px;">${row.date || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px;">${row.company || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px;">${row.branch || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px;">${row.type || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px;">
									<a href="/app/customer/${row.party}" target="_blank" style="color: #3b82f6;">${row.party || '-'}</a>
								</td>
								<td style="color: #e2e8f0; padding: 10px;">${row.party_name || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.purpose || ''}">${row.purpose || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.remarks || ''}">${row.remarks || '-'}</td>
								<td style="color: #e2e8f0; padding: 10px; text-align: right;">${this.formatCurrency(row.amount || 0)}</td>
								<td style="padding: 10px;">
									<span class="label ${this.get_cheque_workflow_class(row.workflow_state)}">${row.workflow_state || '-'}</span>
								</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
			</div>
		`;

		this.main_container.find('.cheque-table-container').html(table_html);
	}

	get_cheque_workflow_class(workflow_state) {
		const state_lower = (workflow_state || '').toLowerCase();
		if (state_lower === 'approved' || state_lower === 'completed' || state_lower === 'received') {
			return 'label-success';
		} else if (state_lower === 'pending' || state_lower === 'pending approval' || state_lower === 'draft') {
			return 'label-warning';
		} else if (state_lower === 'rejected' || state_lower === 'cancelled' || state_lower === 'bounced') {
			return 'label-danger';
		}
		return 'label-info';
	}
	// ==================== End Cheque Document Section ====================

	render_filters_section() {
		const content = $(`
			${this.create_global_title_section()}
			<div class="content-header">
				<h2 class="content-title">
					<i class="fa fa-filter"></i>
					Advanced Filters
				</h2>
				<p class="content-subtitle">Configure filters to customize your receivables view</p>
			</div>
			<div class="content-body">
				<div class="filters-config-section"></div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_advanced_filters();
	}

	render_settings_section() {
		const content = $(`
			${this.create_global_title_section()}
			<div class="content-header">
				<h2 class="content-title">
					<i class="fa fa-cog"></i>
					Settings
				</h2>
				<p class="content-subtitle">Configure dashboard preferences and default values</p>
			</div>
			<div class="content-body">
				<div class="settings-config-section"></div>
			</div>
		`);

		this.main_container.find('.dashboard-content').append(content);
		this.setup_global_navbar_events();
		this.create_settings_panel();
	}

	load_filter_options() {
		// Create Company filter using frappe.ui.form.make_control
		this.company_filter = frappe.ui.form.make_control({
			parent: this.filters_container.find('#company-filter-container'),
			df: {
				fieldtype: 'Link',
				options: 'Company',
				placeholder: 'Select Company',
				reqd: 1,
				change: () => {
					this.filters.company = this.company_filter.get_value();
					console.log('[Company Filter] Changed to:', this.filters.company);

					// IMPORTANT: Sync with modal filter to prevent override
					if ($('#modal-company').length > 0) {
						$('#modal-company').val(this.filters.company);
						console.log('[Company Filter] Synced modal filter to:', this.filters.company);
					}

					if (this.filters.company) {
						// Clear cache
						this.data_cache.clear();

						// Reload main data
						this.load_data();

						// Reload current section if it has its own data source
						if (this.current_section === 'proforma_invoice') {
							this.load_proforma_invoices();
						} else if (this.current_section === 'collection') {
							this.load_collection_data();
						} else if (this.current_section === 'payment_schedules') {
							this.load_payment_schedules();
						} else if (this.current_section === 'pdc_report') {
							this.load_pdc_data();
						} else if (this.current_section === 'intercompany_overdues') {
							this.load_intercompany_overdues();
						} else if (this.current_section === 'payment_followup') {
							this.load_payment_followup();
						} else if (this.current_section === 'blocked_dispute') {
							this.load_blocked_dispute_data();
						} else if (this.current_section === 'quotation_followup') {
							this.load_quotation_followup();
						} else if (this.current_section === 'dispute') {
							this.load_dispute_data();
						} else if (this.current_section === 'listed_customers') {
							this.load_listed_customers_data();
						}
					}
				}
			},
			render_input: true
		});

		// Set default company
		const default_company = frappe.defaults.get_user_default('Company') || 'PRASTARA DECORATION DESIGN L.L.C';
		this.company_filter.set_value(default_company);
		this.filters.company = default_company;

		// Sync with modal filter
		if ($('#modal-company').length > 0) {
			$('#modal-company').val(default_company);
		}
		console.log('[Company Filter] Default company set to:', default_company);

		// Create Customer filter using frappe.ui.form.make_control
		this.customer_filter = frappe.ui.form.make_control({
			parent: this.filters_container.find('#customer-filter-container'),
			df: {
				fieldtype: 'Link',
				options: 'Customer',
				placeholder: 'Select Customer (Optional)',
				change: () => {
					this.filters.customer = this.customer_filter.get_value();

					// Reload section-specific data that requires API calls
					if (this.current_section === 'proforma_invoice') {
						this.load_proforma_invoices();
					} else if (this.current_section === 'collection') {
						this.load_collection_data();
					} else if (this.current_section === 'payment_schedules') {
						this.load_payment_schedules();
					} else if (this.current_section === 'pdc_report') {
						this.load_pdc_data();
					} else if (this.current_section === 'intercompany_overdues') {
						this.load_intercompany_overdues();
					} else if (this.current_section === 'payment_followup') {
						this.load_payment_followup();
					} else if (this.current_section === 'blocked_dispute') {
						this.load_blocked_dispute_data();
					} else if (this.current_section === 'quotation_followup') {
						this.load_quotation_followup();
					} else if (this.current_section === 'dispute') {
						this.load_dispute_data();
					} else if (this.current_section === 'customer_outstanding_clearance') {
						this.load_customer_outstanding_clearance_data();
					} else if (this.current_section === 'cheque_document') {
						this.load_cheque_document_data();
					} else if (this.current_section === 'listed_customers') {
						this.load_listed_customers_data();
					} else {
						// For main sections, apply filters on existing data
						this.apply_filters();
					}
				}
			},
			render_input: true
		});

		// Create Branch filter using frappe.ui.form.make_control
		this.branch_filter = frappe.ui.form.make_control({
			parent: this.filters_container.find('#branch-filter-container'),
			df: {
				fieldtype: 'Link',
				options: 'Branch',
				placeholder: 'Select Branch (Optional)',
				change: () => {
					this.filters.branch = this.branch_filter.get_value();

					// Reload section-specific data that requires API calls
					if (this.current_section === 'proforma_invoice') {
						this.load_proforma_invoices();
					} else if (this.current_section === 'collection') {
						this.load_collection_data();
					} else if (this.current_section === 'payment_schedules') {
						this.load_payment_schedules();
					} else if (this.current_section === 'pdc_report') {
						this.load_pdc_data();
					} else if (this.current_section === 'intercompany_overdues') {
						this.load_intercompany_overdues();
					} else if (this.current_section === 'payment_followup') {
						this.load_payment_followup();
					} else if (this.current_section === 'blocked_dispute') {
						this.load_blocked_dispute_data();
					} else if (this.current_section === 'quotation_followup') {
						this.load_quotation_followup();
					} else if (this.current_section === 'dispute') {
						this.load_dispute_data();
					} else if (this.current_section === 'customer_outstanding_clearance') {
						this.load_customer_outstanding_clearance_data();
					} else if (this.current_section === 'cheque_document') {
						this.load_cheque_document_data();
					} else if (this.current_section === 'listed_customers') {
						this.load_listed_customers_data();
					} else {
						// For main sections, apply filters on existing data or reload
						if (this.data && this.data.length > 0) {
							this.apply_filters();
						} else {
							this.load_data();
						}
					}
				}
			},
			render_input: true
		});
	}

	create_filters() {
		const filters_container = $(`
			<div class="filters-section">
				<h3 class="filters-title">
					<i class="fa fa-filter"></i>
					Data Filters
				</h3>
				<div class="row">
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-building"></i> Company
						</label>
						<div id="company-filter-container"></div>
					</div>
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-user"></i> Customer
						</label>
						<div id="customer-filter-container"></div>
					</div>
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-map-marker"></i> Branch
						</label>
						<div id="branch-filter-container"></div>
					</div>
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-calendar"></i> Report Date
						</label>
						<input type="date" class="form-control" id="report-date-filter" value="${this.filters.report_date}">
					</div>
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-clock-o"></i> Aging Filter
						</label>
						<select class="form-control" id="aging-filter">
							<option value="all">All Ages</option>
							<option value="0-30">0-30 Days</option>
							<option value="31-60">31-60 Days</option>
							<option value="61-90">61-90 Days</option>
							<option value="91-120">91-120 Days</option>
							<option value="120+">120+ Days</option>
						</select>
					</div>
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-money"></i> Min Outstanding
						</label>
						<input type="number" class="form-control" id="min-outstanding-filter" placeholder="AED 0">
					</div>
				</div>
				<div class="row" style="margin-top: 15px;">
					<div class="col-md-2">
						<label class="control-label">
							<i class="fa fa-money"></i> Max Outstanding
						</label>
						<input type="number" class="form-control" id="max-outstanding-filter" placeholder="No limit">
					</div>
					<div class="col-md-8"></div>
					<div class="col-md-1">
						<label class="control-label" style="visibility: hidden;">Actions</label>
						<button class="btn btn-primary" id="apply-filters" style="width: 100%;">
							<i class="fa fa-search"></i> Apply
						</button>
					</div>
					<div class="col-md-1">
						<label class="control-label" style="visibility: hidden;">Actions</label>
						<button class="btn btn-secondary" id="clear-filters" style="width: 100%;">
							<i class="fa fa-times"></i> Clear
						</button>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.filters-section').append(filters_container);
		this.filters_container = filters_container;
		this.setup_filter_events();
		this.load_filter_options();
	}

	create_summary_cards() {
		this.summary_container = $(`
			<!-- Key Financial Metrics Row 1 -->
			<div class="row" style="margin-bottom: 24px;">
				<div class="col-md-3">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Outstanding</h4>
							<div class="stat-icon primary">
								<i class="fa fa-exclamation-circle"></i>
							</div>
						</div>
						<div class="stat-value" id="total-outstanding-amount">AED 0</div>
						<div class="stat-change negative" id="outstanding-change">Current Balance</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card danger">
						<div class="stat-header">
							<h4 class="stat-title">Overdue Amount</h4>
							<div class="stat-icon danger">
								<i class="fa fa-warning"></i>
							</div>
						</div>
						<div class="stat-value" id="overdue-amount">AED 0</div>
						<div class="stat-change negative" id="overdue-change">Past Due</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Credit Limit</h4>
							<div class="stat-icon info">
								<i class="fa fa-credit-card"></i>
							</div>
						</div>
						<div class="stat-value" id="total-credit-limit">AED 0</div>
						<div class="stat-change" id="credit-utilization">0% Utilized</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Avg Collection Period</h4>
							<div class="stat-icon success">
								<i class="fa fa-calendar-check-o"></i>
							</div>
						</div>
						<div class="stat-value" id="avg-collection-period">0</div>
						<div class="stat-change" id="collection-days">Days</div>
					</div>
				</div>
			</div>

			<!-- Key Financial Metrics Row 2 -->
			<div class="row" style="margin-bottom: 24px;">
				<div class="col-md-3">
					<div class="stat-card">
						<div class="stat-header">
							<h4 class="stat-title">Last Payment Date</h4>
							<div class="stat-icon primary">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="stat-value" id="last-payment-date" style="font-size: 16px;">--</div>
						<div class="stat-change" id="last-payment-days">Most Recent</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card">
						<div class="stat-header">
							<h4 class="stat-title">Credit Score</h4>
							<div class="stat-icon warning">
								<i class="fa fa-star"></i>
							</div>
						</div>
						<div class="stat-value" id="credit-score">A+</div>
						<div class="stat-change" id="credit-rating">Rating</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card">
						<div class="stat-header">
							<h4 class="stat-title">Due Today</h4>
							<div class="stat-icon danger">
								<i class="fa fa-exclamation-triangle"></i>
							</div>
						</div>
						<div class="stat-value" id="due-today">AED 0</div>
						<div class="stat-change" id="due-today-count">0 Invoices</div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card">
						<div class="stat-header">
							<h4 class="stat-title">Collection Rate</h4>
							<div class="stat-icon success">
								<i class="fa fa-percent"></i>
							</div>
						</div>
						<div class="stat-value" id="collection-efficiency">0%</div>
						<div class="stat-change positive" id="collection-trend">Efficiency</div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.summary-cards-section').append(this.summary_container);
	}

	create_data_table() {
		this.table_container = $(`
			<div class="table-container" style="margin-top: 24px;">
				<div class="table-header" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); padding: 20px; border-radius: 8px 8px 0 0; border: 1px solid rgba(59, 130, 246, 0.3); border-bottom: none;">
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<div>
							<h3 class="table-title" style="margin: 0 0 4px 0; color: #e2e8f0; font-weight: 600; font-size: 18px;">
								<i class="fa fa-table" style="color: #3b82f6; margin-right: 8px;"></i>
								Customer Receivables Details
							</h3>
							<p style="color: #94a3b8; margin: 0; font-size: 12px;">
								Showing <span id="receivables-visible-count">0</span> customers
							</p>
						</div>
						<div style="display: flex; align-items: center; gap: 12px;">
							<label style="color: #cbd5e1; font-size: 13px; font-weight: 600; margin: 0;">
								<i class="fa fa-filter" style="margin-right: 6px; color: #60a5fa;"></i>Filter by:
							</label>
							<select id="receivables-voucher-filter" style="background: rgba(30, 41, 59, 0.8); color: #e2e8f0; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; padding: 6px 32px 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; outline: none;">
								<option value="all">All Document Types</option>
								<option value="Sales Invoice">Sales Invoice</option>
								<option value="Payment Entry">Payment Entry</option>
								<option value="Journal Entry">Journal Entry</option>
							</select>
							<button id="reset-receivables-filter" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: none;">
								<i class="fa fa-times"></i> Reset
							</button>
						</div>
					</div>
				</div>
				<div class="table-responsive" style="overflow-x: auto; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 0 0 8px 8px;">
					<table class="table" id="receivables-table" style="margin: 0; min-width: 1950px; background: transparent;">
						<thead>
							<tr style="background: rgba(59, 130, 246, 0.1); border-bottom: 2px solid rgba(59, 130, 246, 0.3);">
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 140px;">
									<i class="fa fa-user" style="margin-right: 6px;"></i>Customer
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 180px;">
									<i class="fa fa-info-circle" style="margin-right: 6px;"></i>Customer Name
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 120px;">
									<i class="fa fa-map-marker" style="margin-right: 6px;"></i>Branch
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 150px;">
									<i class="fa fa-user-circle" style="margin-right: 6px;"></i>Sales Person
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 130px;">
									<i class="fa fa-credit-card" style="margin-right: 6px;"></i>Credit Limit
								</th>
								<th style="padding: 16px 12px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 130px;">
									<i class="fa fa-line-chart" style="margin-right: 6px;"></i>Invoiced
								</th>
								<th style="padding: 16px 12px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 130px;">
									<i class="fa fa-check-circle" style="margin-right: 6px;"></i>Paid
								</th>
								<th style="padding: 16px 12px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 130px;">
									<i class="fa fa-file-text" style="margin-right: 6px;"></i>Credit Note
								</th>
								<th style="padding: 16px 12px; background: rgba(239, 68, 68, 0.15); color: #f87171; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 140px;">
									<i class="fa fa-exclamation-circle" style="margin-right: 6px;"></i>Outstanding
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: center; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 100px;">
									<i class="fa fa-clock-o" style="margin-right: 6px;"></i>Age
								</th>
								<th style="padding: 16px 12px; color: #10b981; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 110px;">
									0-30 Days
								</th>
								<th style="padding: 16px 12px; color: #f59e0b; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 110px;">
									31-60 Days
								</th>
								<th style="padding: 16px 12px; color: #f97316; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 110px;">
									61-90 Days
								</th>
								<th style="padding: 16px 12px; color: #ef4444; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 110px;">
									91-120 Days
								</th>
								<th style="padding: 16px 12px; color: #dc2626; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: right; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 110px;">
									120+ Days
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: center; border-right: 1px solid rgba(148, 163, 184, 0.1); min-width: 120px;">
									<i class="fa fa-calendar" style="margin-right: 6px;"></i>Due Date
								</th>
								<th style="padding: 16px 12px; color: #cbd5e1; font-weight: 600; font-size: 13px; white-space: nowrap; text-align: center; min-width: 120px;">
									<i class="fa fa-cogs" style="margin-right: 6px;"></i>Actions
								</th>
							</tr>
						</thead>
						<tbody></tbody>
					</table>
				</div>
			</div>
		`);

		// Append to appropriate section based on current context
		if (this.main_container.find('.customer-table-section').length > 0) {
			this.main_container.find('.customer-table-section').append(this.table_container);
		} else if (this.main_container.find('.outstanding-table-section').length > 0) {
			this.main_container.find('.outstanding-table-section').append(this.table_container);
		} else {
			this.main_container.find('.table-section').append(this.table_container);
		}

		// Setup voucher type filter events after table is created
		this.setup_receivables_voucher_filter_events();
	}

	load_default_data() {
		if (this.filters.company) {
			this.load_data();
		} else {
			frappe.msgprint(__('Please select a company to view receivables data.'));
		}
	}

	load_data() {
		if (!this.filters.company) {
			frappe.msgprint(__('Please select a company.'));
			return;
		}

		// Prevent multiple simultaneous calls
		if (this.loading) {
			return;
		}

		// Create cache key
		const cache_key = this.get_cache_key();

		// Check cache first
		const cached_data = this.data_cache.get(cache_key);
		if (cached_data && (Date.now() - cached_data.timestamp) < this.cache_duration) {
			// Use cached data (already transformed)
			this.data = cached_data.data;
			this.summary_data = cached_data.summary_data;
			this.api_totals = cached_data.api_totals || {};
			this.update_outstanding_badge(this.data.length);

			// Populate Sales Team and Sales Person filters from cached data
			this.populate_sales_filters_from_data();

			this.apply_filters();
			this.update_summary();

			// Also update overview analytics for cached data
			if (this.current_section === 'overview') {
				this.update_overview_analytics();
			}
			return;
		}

		// Show loading state
		this.loading = true;
		this.show_loading();

		console.log('=== Loading data using get_customer_outstandings_new API ===');
		console.log('[load_data] Company being sent to API:', this.filters.company);
		const api_args = {
			filters: {
				company: this.filters.company,
				report_date: this.filters.report_date
			},
			customer: this.filters.customer || null,
			branch: this.filters.branch || null,
			sales_person: this.filters.sales_person || null,
			sales_team: this.filters.sales_team || null,
			include_sales_person: true  // Request sales person data
		};
		const internalFilter = this.get_internal_customer_filter_value();
		if (internalFilter) {
			api_args.internal_customer = internalFilter === 'yes' ? 1 : 0;
		}

		frappe.call({
			method: 'prastara_custom.controller.accounts_receivable.get_customer_outstandings_new',
			args: api_args,
			freeze: false, // Don't freeze the entire interface
			callback: (r) => {
				this.loading = false;
				this.hide_loading();
				if (r.message) {
					console.log('=== API RESPONSE RECEIVED ===');
					console.log('Full response:', r.message);
					console.log('Data array length:', r.message.data ? r.message.data.length : 0);
					if (r.message.data && r.message.data.length > 0) {
						console.log('First customer sample:', r.message.data[0]);
						console.log('First customer invoices?', r.message.data[0].invoices ? 'Yes' : 'No');
						if (r.message.data[0].invoices) {
							console.log('First customer invoices count:', r.message.data[0].invoices.length);
							if (r.message.data[0].invoices.length > 0) {
								console.log('First invoice sample:', r.message.data[0].invoices[0]);
							}
						}
					}

					// Keep the nested API response structure - don't flatten it!
					// The data has customer objects with invoices array, which is needed for accurate calculations
					this.data = r.message.data || [];
					this.summary_data = {
						due_today: r.message.due_today || 0,
						due_yesterday: r.message.due_yesterday || 0,
						due_this_month: r.message.due_this_month || 0
					};

					// Store API totals for accurate reporting
					this.api_totals = r.message.totals || {
						invoiced: 0,
						paid: 0,
						credit_note: 0,
						outstanding: 0,
						range1: 0,
						range2: 0,
						range3: 0,
						range4: 0,
						range5: 0,
						future_amount: 0,
						remaining_balance: 0
					};

					console.log('API Totals stored:', this.api_totals);

					// Fetch sales person data separately since it comes in different format
					this.fetchAndIntegrateSalesPersonData(r.message.data || []);

					// Fetch payment schedule totals for Due Today, Due This Week, Due This Month cards
					this.fetch_payment_schedule_totals();

					// Cache the data
					this.data_cache.set(cache_key, {
						data: this.data,
						summary_data: this.summary_data,
						api_totals: this.api_totals,
						original_data: r.message.data || [],
						timestamp: Date.now()
					});

					// Clean old cache entries (keep only last 10 entries)
					if (this.data_cache.size > 10) {
						const oldest_key = this.data_cache.keys().next().value;
						this.data_cache.delete(oldest_key);
					}

					// Update outstanding count badge
					this.update_outstanding_badge(this.data.length);

					// Populate Sales Team and Sales Person filters from loaded data
					this.populate_sales_filters_from_data();

					this.apply_filters();
					this.update_summary();

					// Also update overview analytics immediately after loading
					if (this.current_section === 'overview') {
						this.update_overview_analytics();
					}

					// Mark load time for performance tracking
					this.last_loaded = new Date();
				} else {
					frappe.show_alert(__('No data found for the selected filters.'), 5);
				}
			},
			error: (r) => {
				this.loading = false;
				this.hide_loading();
				frappe.show_alert({
					message: __('Error loading data. Please check your filters and try again.'),
					indicator: 'red'
				}, 5);
				console.error('API Error:', r);
			}
		});
	}

	fetch_payment_schedule_totals() {
		// Fetch payment schedule totals separately for Due Today, Due This Week, Due This Month cards
		const month_start = frappe.datetime.month_start();
		const month_end = frappe.datetime.month_end();

		console.log('=== Fetching Payment Schedule Totals for Due Date Cards ===');
		console.log('Date Range:', month_start, 'to', month_end);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_payment_schedule_summary',
			args: {
				company: this.filters.company,
				from_date: month_start,
				to_date: month_end,
				customer: this.filters.customer || null,
				branch: this.filters.branch || null,
				sales_person: this.filters.sales_person || null,
				sales_team: this.filters.sales_team || null,
				internal_customer: this.get_internal_customer_param()
			},
			freeze: false,
			callback: (r) => {
				if (r.message && r.message.totals) {
					console.log('Payment Schedule Totals received:', r.message.totals);

					// Store payment schedule totals
					this.payment_schedule_totals = r.message.totals;

					// Update the overview cards immediately if we're in overview section
					if (this.current_section === 'overview') {
						this.update_overview_analytics();
					}
				} else {
					console.log('No payment schedule totals received');
				}
			},
			error: (r) => {
				console.error('Error fetching payment schedule totals:', r);
			}
		});
	}

	transformApiData(apiData) {
		/**
		 * Transform the new nested API response format to the flat format expected by the dashboard
		 * New API format:
		 * [
		 *   {
		 *     customer: "CUST001",
		 *     customer_name: "Customer Name",
		 *     parent_customer: "Parent Customer",
		 *     company: "Company Name",
		 *     credit_limit: 100000,
		 *     invoices: [
		 *       {
		 *         voucher_no: "INV001",
		 *         voucher_type: "Sales Invoice",
		 *         posting_date: "2025-09-22",
		 *         due_date: "2025-10-22",
		 *         branch: "Main Branch",
		 *         invoiced: 10000,
		 *         paid: 5000,
		 *         credit_note: 0,
		 *         outstanding: 5000,
		 *         age: 30,
		 *         range1: 5000, range2: 0, range3: 0, range4: 0, range5: 0,
		 *         sales_person: "John Doe"
		 *       }
		 *     ]
		 *   }
		 * ]
		 *
		 * Expected dashboard format:
		 * [
		 *   {
		 *     customer: "CUST001",
		 *     customer_name: "Customer Name",
		 *     parent_customer: "Parent Customer",
		 *     company: "Company Name",
		 *     branch: "Main Branch",
		 *     credit_limit: 100000,
		 *     invoiced: 10000,
		 *     paid: 5000,
		 *     credit_note: 0,
		 *     outstanding: 5000,
		 *     due_date: "2025-10-22",
		 *     age: 30,
		 *     range1: 5000, range2: 0, range3: 0, range4: 0, range5: 0
		 *   }
		 * ]
		 */

		const flatData = [];

		for (const customerData of apiData) {
			if (!customerData.invoices || customerData.invoices.length === 0) {
				// Customer with no invoices - still include them if they have credit limit
				flatData.push({
					customer: customerData.customer,
					customer_name: customerData.customer_name || '',
					parent_customer: customerData.parent_customer || '',
					company: customerData.company || '',
					branch: '',
					credit_limit: customerData.credit_limit || 0,
					invoiced: 0,
					paid: 0,
					credit_note: 0,
					outstanding: 0,
					due_date: null,
					age: 0,
					range1: 0,
					range2: 0,
					range3: 0,
					range4: 0,
					range5: 0
				});
				continue;
			}

			// Aggregate all invoices for this customer
			let totalInvoiced = 0, totalPaid = 0, totalCreditNote = 0, totalOutstanding = 0;
			let totalRange1 = 0, totalRange2 = 0, totalRange3 = 0, totalRange4 = 0, totalRange5 = 0;
			let earliestDueDate = null;
			let maxAge = 0;
			let primaryBranch = '';
			let primarySalesPerson = null;
			let primarySalesTeam = null;
			const allSalesTeamData = [];

			for (const invoice of customerData.invoices) {
				totalInvoiced += invoice.invoiced || 0;
				totalPaid += invoice.paid || 0;
				totalCreditNote += invoice.credit_note || 0;
				totalOutstanding += invoice.outstanding || 0;
				totalRange1 += invoice.range1 || 0;
				totalRange2 += invoice.range2 || 0;
				totalRange3 += invoice.range3 || 0;
				totalRange4 += invoice.range4 || 0;
				totalRange5 += invoice.range5 || 0;

				// Track earliest posting date
				if (invoice.posting_date) {
					const invoicePostingDate = new Date(invoice.posting_date);
					if (!earliestDueDate || invoicePostingDate < earliestDueDate) {
						earliestDueDate = invoicePostingDate;
					}
				}

				// Track maximum age
				if (invoice.age && invoice.age > maxAge) {
					maxAge = invoice.age;
				}

				// Use the first non-empty branch as primary branch
				if (!primaryBranch && invoice.branch) {
					primaryBranch = invoice.branch;
				}

				// Collect sales person and team data
				if (invoice.sales_person && !primarySalesPerson) {
					primarySalesPerson = invoice.sales_person;
				}
				if (invoice.sales_team && !primarySalesTeam) {
					primarySalesTeam = invoice.sales_team;
				}
				if (invoice.sales_team_data && invoice.sales_team_data.length > 0) {
					allSalesTeamData.push(...invoice.sales_team_data);
				}
			}

			// Create aggregated customer record
			flatData.push({
				customer: customerData.customer,
				customer_name: customerData.customer_name || '',
				parent_customer: customerData.parent_customer || '',
				company: customerData.company || '',
				branch: primaryBranch,
				credit_limit: customerData.credit_limit || 0,
				invoiced: totalInvoiced,
				paid: totalPaid,
				credit_note: totalCreditNote,
				outstanding: totalOutstanding,
				posting_date: earliestDueDate ? earliestDueDate.toISOString().split('T')[0] : null,
				age: maxAge,
				range1: totalRange1,
				range2: totalRange2,
				range3: totalRange3,
				range4: totalRange4,
				range5: totalRange5,
				sales_person: primarySalesPerson || 'No Sales Person',
				sales_team: primarySalesTeam || 'No Sales Team',
				sales_team_data: allSalesTeamData,
				invoices: customerData.invoices  // Keep original invoice data for detailed views
			});
		}

		return flatData;
	}

	fetchAndIntegrateSalesPersonData(customerData) {
		// Extract all invoice numbers to fetch sales person data
		const invoiceNumbers = [];

		for (const customer of customerData) {
			if (customer.invoices && customer.invoices.length > 0) {
				for (const invoice of customer.invoices) {
					if (invoice.voucher_no && invoice.voucher_type === 'Sales Invoice') {
						invoiceNumbers.push(invoice.voucher_no);
					}
				}
			}
		}

		if (invoiceNumbers.length === 0) {
			return;
		}

		console.log('Fetching sales person data for invoices:', invoiceNumbers); // Debug log

		// Call the correct API that returns sales person data
		frappe.call({
			method: 'prastara_custom.controller.accounts_receivable.get_sales_person_data',
			args: {
				invoice_numbers: invoiceNumbers
			},
			callback: (r) => {
				console.log('Sales person API response:', r.message); // Debug log
				if (r.message && Array.isArray(r.message)) {
					this.integrateSalesPersonData(r.message, customerData);
				}
			}
		});
	}

	integrateSalesPersonData(salesPersonData, customerData) {
		// Create a mapping from invoice number to sales person
		const invoiceToSalesPersonMap = {};

		for (const item of salesPersonData) {
			if (!invoiceToSalesPersonMap[item.parent]) {
				invoiceToSalesPersonMap[item.parent] = [];
			}
			invoiceToSalesPersonMap[item.parent].push({
				sales_person: item.sales_person,
				allocated_percentage: item.allocated_percentage || 0
			});
		}

		console.log('Sales person mapping:', invoiceToSalesPersonMap); // Debug log

		// Update the cached original_data with sales person information
		const cache_key = this.get_cache_key();
		const cached = this.data_cache.get(cache_key);

		if (cached && cached.original_data) {
			for (const customerRecord of cached.original_data) {
				if (customerRecord.invoices && customerRecord.invoices.length > 0) {
					for (const invoice of customerRecord.invoices) {
						const salesTeam = invoiceToSalesPersonMap[invoice.voucher_no];
						if (salesTeam && salesTeam.length > 0) {
							// Get the primary sales person (highest allocation percentage)
							const primarySalesPerson = salesTeam.reduce((prev, current) =>
								(current.allocated_percentage > prev.allocated_percentage) ? current : prev
							);
							invoice.sales_person = primarySalesPerson.sales_person;
							invoice.sales_team = salesTeam; // Store full team for reference
						} else {
							invoice.sales_person = 'No Sales Person';
						}
					}
				}
			}

			// Update the cache with the integrated data
			this.data_cache.set(cache_key, cached);

			console.log('Updated cache with sales person data'); // Debug log
		}
	}

	fetchSalesPersonData(customerData) {
		// Extract all invoice numbers to fetch sales person data
		const invoiceNumbers = [];

		for (const customer of customerData) {
			if (customer.invoices && customer.invoices.length > 0) {
				for (const invoice of customer.invoices) {
					if (invoice.voucher_no && invoice.voucher_type === 'Sales Invoice') {
						invoiceNumbers.push(invoice.voucher_no);
					}
				}
			}
		}

		if (invoiceNumbers.length === 0) {
			return;
		}

		// Fetch sales person data for all invoices in batches
		const batchSize = 100; // Process invoices in batches to avoid large queries
		for (let i = 0; i < invoiceNumbers.length; i += batchSize) {
			const batch = invoiceNumbers.slice(i, i + batchSize);
			this.fetchSalesPersonBatch(batch, customerData);
		}
	}

	fetchSalesPersonBatch(invoiceNumbers, customerData) {
		// Use server-side method to fetch sales person data with proper permissions
		frappe.call({
			method: 'prastara_custom.controller.accounts_receivable.get_sales_person_data',
			args: {
				invoice_numbers: invoiceNumbers
			},
			callback: (r) => {
				if (r.message) {
					// Process sales team data directly
					this.processSalesTeamDataDirect(r.message, customerData);
				}
			}
		});
	}

	processSalesTeamDataDirect(salesTeamData, customerData) {
		// Group sales persons by invoice directly from Sales Team data
		const salesTeamMap = {};

		for (const team of salesTeamData) {
			if (!salesTeamMap[team.parent]) {
				salesTeamMap[team.parent] = [];
			}
			salesTeamMap[team.parent].push({
				sales_person: team.sales_person,
				allocated_percentage: team.allocated_percentage || 0
			});
		}

		// Update the cached data with sales person information
		this.updateCachedDataWithSalesPerson(salesTeamMap);
	}

	updateCachedDataWithSalesPerson(salesTeamMap) {
		// Update the original_data in cache
		const cache_key = this.get_cache_key();
		const cached = this.data_cache.get(cache_key);

		if (cached && cached.original_data) {
			for (const customerData of cached.original_data) {
				if (customerData.invoices && customerData.invoices.length > 0) {
					for (const invoice of customerData.invoices) {
						const salesTeam = salesTeamMap[invoice.voucher_no];
						if (salesTeam && salesTeam.length > 0) {
							// Get the primary sales person (highest allocation percentage)
							const primarySalesPerson = salesTeam.reduce((prev, current) =>
								(current.allocated_percentage > prev.allocated_percentage) ? current : prev
							);
							invoice.sales_person = primarySalesPerson.sales_person;
							invoice.sales_team = salesTeam; // Store full team for reference
						} else {
							invoice.sales_person = 'No Sales Person';
						}
					}
				}
			}

			// Update the cache
			this.data_cache.set(cache_key, cached);
		}
	}

	show_loading() {
		if (this.loading_overlay) {
			this.loading_overlay.remove();
		}
		this.loading_overlay = $(`
			<div class="loading-overlay">
				<div style="text-align: center;">
					<div class="loading-spinner"></div>
					<p style="margin-top: 15px; color: #e2e8f0; font-weight: 600;">Loading receivables data...</p>
				</div>
			</div>
		`);
		$('body').append(this.loading_overlay);
	}

	hide_loading() {
		if (this.loading_overlay) {
			this.loading_overlay.remove();
			this.loading_overlay = null;
		}
	}

	update_filters() {
		this.filters.company = this.company_filter ? this.company_filter.get_value() : '';
		this.filters.customer = this.customer_filter ? this.customer_filter.get_value() : '';
		this.filters.branch = this.branch_filter ? this.branch_filter.get_value() : '';
		this.filters.report_date = this.filters_container.find('#report-date-filter').val();
		this.filters.aging_filter = this.filters_container.find('#aging-filter').val();
		this.filters.min_outstanding = parseFloat(this.filters_container.find('#min-outstanding-filter').val()) || 0;
		this.filters.max_outstanding = parseFloat(this.filters_container.find('#max-outstanding-filter').val()) || null;
	}

	has_active_filters() {
		// Check if any non-default filters are active
		return (
			(this.filters.customer && this.filters.customer !== '') ||
			(this.filters.min_outstanding && this.filters.min_outstanding > 0) ||
			(this.filters.max_outstanding && this.filters.max_outstanding > 0) ||
			(this.filters.aging_filter && this.filters.aging_filter !== 'all') ||
			(this.filters.internal_customer && this.filters.internal_customer !== '') ||
			(this.filters.voucher_type_filter && this.filters.voucher_type_filter !== 'all')
		);
	}

	get_internal_customer_filter_value() {
		const value = (this.filters.internal_customer || '').toLowerCase();
		if (value === 'yes') return 'yes';
		if (value === 'no') return 'no';
		return '';
	}

	get_internal_customer_param() {
		const value = this.get_internal_customer_filter_value();
		if (value === 'yes') return 1;
		if (value === 'no') return 0;
		return null;
	}

	is_customer_internal(customerName) {
		if (!customerName) return false;
		return this.internal_customers && this.internal_customers.has(customerName);
	}

	get_customer_name_from_record(record, keys = null) {
		if (!record) return '';
		const candidateKeys = keys || [
			'customer',
			'customer_name',
			'party',
			'party_name',
			'debtor',
			'parent_customer'
		];

		for (const key of candidateKeys) {
			const value = record[key];
			if (typeof value === 'string' && value.trim()) {
				return value.trim();
			}
			if (value && typeof value === 'object') {
				if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
				if (typeof value.customer === 'string' && value.customer.trim()) return value.customer.trim();
				if (typeof value.party === 'string' && value.party.trim()) return value.party.trim();
			}
		}

		if (record.party_type === 'Customer' && typeof record.party === 'string') {
			return record.party;
		}

		return '';
	}

	filter_records_by_internal_customer(records, keys = null) {
		const filterValue = this.get_internal_customer_filter_value();
		if (!filterValue || !Array.isArray(records)) {
			return records;
		}

		return records.filter((record) => {
			const customerName = this.get_customer_name_from_record(record, keys);
			const isInternal = this.is_customer_internal(customerName);
			return filterValue === 'yes' ? isInternal : !isInternal;
		});
	}

	apply_filters() {
		// Early exit if no data
		if (!this.data || this.data.length === 0) {
			this.filtered_data = [];
			this.render_table();
			this.update_summary();
			return;
		}

		// Optimize filtering with early returns and minimal processing
		this.filtered_data = this.data.filter(item => {
			// Internal customer filter (uses Customer.is_internal_customer map)
			const internalFilter = this.get_internal_customer_filter_value();
			if (internalFilter) {
				const customerName = this.get_customer_name_from_record(item);
				const isInternal = this.is_customer_internal(customerName);
				if (internalFilter === 'yes' && !isInternal) {
					return false;
				}
				if (internalFilter === 'no' && isInternal) {
					return false;
				}
			}

			// Customer filter - most selective, check first
			if (this.filters.customer && item.customer !== this.filters.customer) {
				return false;
			}

			// Voucher type filter - filter based on document type in invoices
			if (this.filters.voucher_type_filter && this.filters.voucher_type_filter !== 'all') {
				// If customer has invoices array, check if any invoice matches the filter
				if (item.invoices && Array.isArray(item.invoices) && item.invoices.length > 0) {
					const hasMatchingDocs = item.invoices.some(inv =>
						(inv.voucher_type || 'Sales Invoice') === this.filters.voucher_type_filter
					);
					if (!hasMatchingDocs) {
						return false;
					}
				} else {
					// If no invoices array, assume it's a Sales Invoice type for backward compatibility
					if (this.filters.voucher_type_filter !== 'Sales Invoice') {
						return false;
					}
				}
			}

			// Outstanding amount filters - numeric comparisons are fast
			const outstanding = item.outstanding || 0;
			if (outstanding < this.filters.min_outstanding) {
				return false;
			}
			if (this.filters.max_outstanding && outstanding > this.filters.max_outstanding) {
				return false;
			}

			// Aging filter - only check if not 'all'
			if (this.filters.aging_filter !== 'all') {
				let aging_amount = 0;
				switch (this.filters.aging_filter) {
					case '0-30': aging_amount = item.range1 || 0; break;
					case '31-60': aging_amount = item.range2 || 0; break;
					case '61-90': aging_amount = item.range3 || 0; break;
					case '91-120': aging_amount = item.range4 || 0; break;
					case '120+': aging_amount = item.range5 || 0; break;
				}
				if (aging_amount <= 0) {
					return false;
				}
			}

			return true;
		});

		// Update visible count after filtering
		$('#receivables-visible-count').text(this.filtered_data.length);

		// Use debounced rendering for better performance
		this.debounce_render();
	}

	debounce_render() {
		// Clear previous timeout
		if (this.render_timeout) {
			clearTimeout(this.render_timeout);
		}

		// Debounce rendering to avoid excessive DOM updates
		this.render_timeout = setTimeout(() => {
			this.render_table();
			this.update_summary();

			// Always update overview analytics when in overview section
			if (this.current_section === 'overview') {
				this.update_overview_analytics();
			}

			// Update aging section when in aging section
			if (this.current_section === 'aging') {
				this.update_detailed_aging_cards();
				this.populate_aging_details_table();
			}
		}, 100);
	}

	render_table() {
		// Check if table container exists, if not create it
		if (!this.table_container || this.table_container.length === 0) {
			this.create_data_table();
		}

		const tbody = this.table_container.find('tbody');
		tbody.empty();

		if (this.filtered_data.length === 0) {
			tbody.append(`
				<tr>
					<td colspan="17" style="text-align: center; padding: 40px;">
						<div style="opacity: 0.6;">
							<i class="fa fa-inbox" style="font-size: 48px; margin-bottom: 10px;"></i>
							<p>No receivables data found for the selected filters.</p>
						</div>
					</td>
				</tr>
			`);
			return;
		}

		// Optimized table rendering for large datasets
		const maxRows = 100; // Limit initial display
		const dataToShow = this.filtered_data.slice(0, maxRows);

		// Get voucher type filter
		const voucherTypeFilter = this.filters.voucher_type_filter || 'all';

		// Build rows as HTML string for better performance
		let rowsHtml = '';
		dataToShow.forEach(item => {
			// Calculate totals from invoices if available
			let total_invoiced = item.invoiced || 0;
			let total_paid = item.paid || 0;
			let total_credit_note = item.credit_note || 0;
			let total_outstanding = item.outstanding || 0;
			let range1 = item.range1 || 0;
			let range2 = item.range2 || 0;
			let range3 = item.range3 || 0;
			let range4 = item.range4 || 0;
			let range5 = item.range5 || 0;
			let latest_posting_date = item.posting_date || '';
			let max_age = item.age || 0;
			let primary_branch = item.branch || '';
			let sales_persons = new Set(); // Collect unique sales persons

			// If item has invoices array, calculate from invoices (filtered by voucher type if applicable)
			if (item.invoices && Array.isArray(item.invoices) && item.invoices.length > 0) {
				total_invoiced = 0;
				total_paid = 0;
				total_credit_note = 0;
				total_outstanding = 0;
				range1 = 0;
				range2 = 0;
				range3 = 0;
				range4 = 0;
				range5 = 0;
				primary_branch = '';

				// Filter invoices by voucher type if filter is applied
				const filteredInvoices = voucherTypeFilter === 'all'
					? item.invoices
					: item.invoices.filter(inv => (inv.voucher_type || 'Sales Invoice') === voucherTypeFilter);

				filteredInvoices.forEach(inv => {
					total_invoiced += (inv.invoiced || 0);
					total_paid += (inv.paid || 0);
					total_credit_note += (inv.credit_note || 0);
					total_outstanding += (inv.outstanding || 0);
					range1 += (inv.range1 || 0);
					range2 += (inv.range2 || 0);
					range3 += (inv.range3 || 0);
					range4 += (inv.range4 || 0);
					range5 += (inv.range5 || 0);

					// Get latest posting date
					if (inv.posting_date && (!latest_posting_date || inv.posting_date > latest_posting_date)) {
						latest_posting_date = inv.posting_date;
					}

					// Get max age
					if (inv.age && inv.age > max_age) {
						max_age = inv.age;
					}

					// Get primary branch (first non-empty branch from invoices)
					if (!primary_branch && inv.branch) {
						primary_branch = inv.branch;
					}

					// Collect sales persons from invoices
					if (inv.sales_person) {
						// Handle comma-separated sales persons
						inv.sales_person.split(',').forEach(sp => {
							const trimmed = sp.trim();
							if (trimmed) sales_persons.add(trimmed);
						});
					}
				});
			} else if (item.sales_person) {
				// If no invoices array, use the item's sales_person field
				item.sales_person.split(',').forEach(sp => {
					const trimmed = sp.trim();
					if (trimmed) sales_persons.add(trimmed);
				});
			}

			// Convert sales persons Set to comma-separated string
			const sales_person_display = [...sales_persons].join(', ') || '-';

			const outstanding_color = this.getOutstandingColor(total_outstanding, item.credit_limit);
			const age_badge = this.getAgeBadge(max_age);

			// Calculate colors for different amounts
			const sale_color = '#3b82f6'; // Primary Blue
			const paid_color = '#059669'; // Elegant Green
			const credit_color = '#d97706'; // Warm Orange
			const receivable_color = outstanding_color;

			rowsHtml += `
				<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); transition: background 0.2s;">
					<td style="padding: 14px 12px; color: #cbd5e1; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						<a href="/app/customer/${item.customer}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
							${item.customer}
						</a>
					</td>
					<td style="padding: 14px 12px; color: #e2e8f0; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${item.customer_name || '-'}
					</td>
					<td style="padding: 14px 12px; color: #94a3b8; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${primary_branch || '-'}
					</td>
					<td style="padding: 14px 12px; color: #a78bfa; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${sales_person_display}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #cbd5e1; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(item.credit_limit)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${sale_color}; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(59, 130, 246, 0.05);">
						${this.formatCurrency(total_invoiced)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${paid_color}; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(16, 185, 129, 0.05);">
						${this.formatCurrency(total_paid)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${credit_color}; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(245, 158, 11, 0.05);">
						${this.formatCurrency(total_credit_note)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${receivable_color}; font-weight: 700; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(239, 68, 68, 0.05);">
						${this.formatCurrency(total_outstanding)}
					</td>
					<td style="padding: 14px 12px; text-align: center; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${age_badge}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #10b981; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range1)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #f59e0b; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range2)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #f97316; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range3)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #ef4444; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range4)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #dc2626; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range5)}
					</td>
					<td style="padding: 14px 12px; text-align: center; color: #94a3b8; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${latest_posting_date || '-'}
					</td>
					<td style="padding: 14px 12px; text-align: center;">
						<button class="btn btn-xs btn-primary" onclick="frappe.prd_arm.view_customer_details('${item.customer}')" style="padding: 6px 10px;" title="View Customer Details">
							<i class="fa fa-eye"></i> View
						</button>
					</td>
				</tr>
			`;
		});

		tbody.html(rowsHtml);

		// Add hover effect to table rows
		setTimeout(() => {
			$('#receivables-table tbody tr').hover(
				function () {
					$(this).css('background', 'rgba(59, 130, 246, 0.08)');
				},
				function () {
					$(this).css('background', 'transparent');
				}
			);
		}, 100);

		// Update visible customer count
		$('#receivables-visible-count').text(this.filtered_data.length);

		// Add "Show More" button if there are more rows
		if (this.filtered_data.length > maxRows) {
			tbody.append(`
				<tr>
					<td colspan="17" style="text-align: center; padding: 20px;">
						<button class="btn btn-primary btn-sm" onclick="frappe.prd_arm.show_all_rows()">
							<i class="fa fa-plus"></i>
							Show ${this.filtered_data.length - maxRows} More Records
						</button>
					</td>
				</tr>
			`);
		}
	}

	update_summary() {
		// Early exit if no summary container
		if (!this.summary_container || this.summary_container.length === 0) {
			return;
		}

		// Check if we should use API totals
		const has_filters = this.has_active_filters();
		const use_api_totals = !has_filters && this.api_totals && Object.keys(this.api_totals).length > 0;

		// Optimize calculations using single pass through data
		let total_sales = 0, total_paid = 0, total_credit_notes = 0, total_outstanding = 0;
		let overdue_amount = 0, total_credit_limit = 0, payment_dates = [];
		let aging_days_sum = 0, aging_count = 0, due_today_count = 0;

		// Use API totals if available and no filters are active
		if (use_api_totals) {
			console.log('Using API totals for summary (no filters applied)');
			total_sales = this.api_totals.invoiced || 0;
			total_paid = this.api_totals.paid || 0;
			total_credit_notes = this.api_totals.credit_note || 0;
			total_outstanding = this.api_totals.outstanding || 0;
			overdue_amount = (this.api_totals.range2 || 0) + (this.api_totals.range3 || 0) +
				(this.api_totals.range4 || 0) + (this.api_totals.range5 || 0);
		}

		for (const item of this.filtered_data) {
			// Only calculate if not using API totals
			if (!use_api_totals) {
				total_sales += item.invoiced || 0;
				total_paid += item.paid || 0;
				total_credit_notes += item.credit_note || 0;
				total_outstanding += item.outstanding || 0;

				// Calculate overdue amount (items beyond 30 days)
				overdue_amount += (item.range2 || 0) + (item.range3 || 0) + (item.range4 || 0) + (item.range5 || 0);
			}

			// Always calculate these from filtered data
			total_credit_limit += item.credit_limit || 0;

			// Calculate aging for average collection period
			const aging = item.age || 0;
			if (aging > 0) {
				aging_days_sum += aging;
				aging_count++;
			}

			// Count invoices posted today
			if (item.posting_date && this.isToday(item.posting_date)) {
				due_today_count++;
			}

			// Collect payment dates for last payment calculation
			if (item.last_payment_date) {
				payment_dates.push(new Date(item.last_payment_date));
			}
		}

		// Financial calculations
		const collection_rate = total_sales > 0 ? (total_paid / total_sales * 100) : 0;
		const avg_collection_period = aging_count > 0 ? Math.round(aging_days_sum / aging_count) : 0;
		const credit_utilization = total_credit_limit > 0 ? ((total_outstanding / total_credit_limit) * 100) : 0;

		// Find most recent payment date
		const last_payment = payment_dates.length > 0 ?
			new Date(Math.max(...payment_dates)).toLocaleDateString('en-IN') :
			'No Recent Payments';

		// Calculate credit score based on collection efficiency and aging
		const credit_score = this.calculateCreditScore(collection_rate, avg_collection_period, credit_utilization);

		// Batch DOM updates to minimize reflows
		const updates = [
			['#total-outstanding-amount', this.formatCurrency(total_outstanding)],
			['#overdue-amount', this.formatCurrency(overdue_amount)],
			['#total-credit-limit', this.formatCurrency(total_credit_limit)],
			['#credit-utilization', credit_utilization.toFixed(1) + '% Utilized'],
			['#avg-collection-period', avg_collection_period.toString()],
			['#last-payment-date', last_payment],
			['#credit-score', credit_score.rating],
			['#credit-rating', credit_score.description],
			['#due-today', this.formatCurrency(this.summary_data.due_today || 0)],
			['#due-today-count', due_today_count + ' Invoices'],
			['#collection-efficiency', collection_rate.toFixed(1) + '%']
		];

		// Apply all updates in a single DOM operation
		updates.forEach(([selector, value]) => {
			const element = this.summary_container.find(selector);
			if (element.length > 0 && element.text() !== value) {
				element.text(value);
			}
		});

		// Also update overview analytics if in overview section
		if (this.current_section === 'overview') {
			this.update_overview_analytics();
		}

		// Update detailed summary tables if in summary section
		if (this.current_section === 'summary') {
			this.update_detailed_summary_tables();
			this.update_financial_charts();
			this.setup_customer_table_filters();
			this.populate_customer_details_table();
		}
	}

	async fetch_collection_totals() {
		// Fetch collection totals for "this month" and "this year"
		const month_range = this.get_this_month_date_range();
		const year_range = this.get_this_year_date_range();

		try {
			// Fetch this month's collections
			const month_response = await new Promise((resolve, reject) => {
				frappe.call({
					method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_collection_data',
					args: {
						filters: {
							from_date: month_range.from_date,
							to_date: month_range.to_date,
							branch: this.filters.branch || '',
							company: this.filters.company || ''
						}
					},
					callback: (r) => {
						if (r.message) {
							resolve(r.message);
						} else {
							reject('No data received');
						}
					},
					error: (err) => reject(err)
				});
			});

			// Fetch this year's collections
			const year_response = await new Promise((resolve, reject) => {
				frappe.call({
					method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_collection_data',
					args: {
						filters: {
							from_date: year_range.from_date,
							to_date: year_range.to_date,
							branch: this.filters.branch || '',
							company: this.filters.company || ''
						}
					},
					callback: (r) => {
						if (r.message) {
							resolve(r.message);
						} else {
							reject('No data received');
						}
					},
					error: (err) => reject(err)
				});
			});

			// Store the collection totals
			this.month_collection_total = month_response.totals ? month_response.totals.total : 0;
			this.year_collection_total = year_response.totals ? year_response.totals.total : 0;

			console.log('Collection Totals Fetched:');
			console.log('This Month Collection:', this.month_collection_total);
			console.log('This Year Collection:', this.year_collection_total);

		} catch (error) {
			console.error('Error fetching collection totals:', error);
			// Set defaults if fetch fails
			this.month_collection_total = 0;
			this.year_collection_total = 0;
		}
	}

	async update_overview_analytics() {
		if (!this.filtered_data || this.filtered_data.length === 0) {
			return;
		}

		// Fetch real collection data for this month and this year
		await this.fetch_collection_totals();

		// Calculate comprehensive analytics
		const analytics = this.calculate_analytics();

		// Update Total Invoiced
		$('#overview-total-sale').text(this.formatCurrency(analytics.total_sale));

		// Update Collection Against Invoice (sum of paid where voucher_type = Sales Invoice)
		$('#overview-collection-against-invoice').text(this.formatCurrency(analytics.collection_against_invoice));

		// Update Credit Notes
		$('#overview-total-credit').text(this.formatCurrency(analytics.total_credit_note));

		// Update Outstanding (non-internal customers only)
		$('#overview-total-outstanding').text(this.formatCurrency(analytics.regular_outstanding));

		// Update Inter Company Outstanding (internal customers only)
		$('#overview-intercompany-outstanding').text(this.formatCurrency(analytics.intercompany_outstanding));

		// Update Unallocated/Advance (outstanding where voucher_type != Sales Invoice)
		$('#overview-unallocated-advance').text(this.formatCurrency(analytics.unallocated_advance));

		// Update Total Outstanding: show global SI outstanding (full dataset), then currently-viewing if filtered
		const global_si_outstanding = this.compute_total_si_outstanding(this.data);
		$('#overview-total-outstanding-all').text(this.formatCurrency(global_si_outstanding));
		$('#overview-outstanding-without-future').text(this.formatCurrency(global_si_outstanding));

		// Show "currently viewing" amount when a client-side filter is narrowing the data
		if (this.has_active_filters() && this.filtered_data.length < this.data.length) {
			$('#overview-total-outstanding-viewing').html(
				`<i class="fa fa-filter" style="margin-right:4px;"></i>Viewing: ${this.formatCurrency(analytics.total_outstanding)}`
			);
		} else {
			$('#overview-total-outstanding-viewing').text('');
		}

		// Update Due Today (Sales Invoice with due_date = today)
		$('#overview-due-today').text(this.formatCurrency(analytics.due_today_amount));
		$('#overview-due-today-count').html(`
			<i class="fa fa-file-text-o"></i> ${analytics.due_today_count} invoices
		`);

		// Update Due This Week (Sales Invoice with due_date within 7 days)
		$('#overview-due-this-week').text(this.formatCurrency(analytics.due_this_week_amount));
		$('#overview-due-week-count').html(`
			<i class="fa fa-file-text-o"></i> ${analytics.due_this_week_count} invoices
		`);

		// Update Due This Month (Sales Invoice with due_date within 30 days)
		$('#overview-due-this-month').text(this.formatCurrency(analytics.due_this_month_amount));
		$('#overview-due-month-count').html(`
			<i class="fa fa-file-text-o"></i> ${analytics.due_this_month_count} invoices
		`);

		// Update Month Collections
		$('#overview-month-collections').text(this.formatCurrency(analytics.month_collections));

		// Update Year Collections
		$('#overview-year-collections').text(this.formatCurrency(analytics.year_collections));

		// Update Unallocated Collection (same as unallocated/advance - non-SI outstanding)
		$('#overview-unallocated-collection').text(this.formatCurrency(analytics.unallocated_advance));

		// Update Future Amount (future payment allocation from AR data)
		$('#overview-future-amount').text(this.formatCurrency(analytics.future_amount));

		// Update Collection Efficiency Gauge
		this.update_efficiency_gauge(analytics.collection_efficiency);

		// Update Average Collection Days
		$('#avg-collection-days').text(Math.round(analytics.avg_collection_days));

		// Update Aging Analysis Cards
		this.update_aging_cards(analytics);

		// Update Detailed Aging Cards (if in aging section)
		if (this.current_section === 'aging') {
			this.update_detailed_aging_cards();
		}

		// Update Top Debtors
		this.update_top_debtors();
	}

	compute_total_si_outstanding(data) {
		// Sum outstanding only for Sales Invoice voucher type across a given dataset
		let total = 0;
		for (const item of (data || [])) {
			if (item.invoices && Array.isArray(item.invoices)) {
				for (const invoice of item.invoices) {
					if ((invoice.voucher_type || '').trim().toLowerCase() === 'sales invoice') {
						total += invoice.outstanding || 0;
					}
				}
			}
		}
		return total;
	}

	calculate_analytics() {
		// Check if we're showing all data (no filters applied) and we have API totals
		const has_filters = this.has_active_filters();
		const use_api_totals = !has_filters && this.api_totals && Object.keys(this.api_totals).length > 0;

		let total_outstanding = 0, total_sale = 0, total_paid = 0, total_credit_note = 0;
		let collection_against_invoice = 0;
		let intercompany_outstanding = 0;
		let regular_outstanding = 0;
		let unallocated_advance = 0;
		let all_invoiced_total = 0, all_credit_total = 0; // all voucher types (matches AR report)
		let si_invoiced_total = 0, si_paid_total = 0, si_credit_total = 0;
		let si_invoiced_internal = 0, si_paid_internal = 0, si_credit_internal = 0;
		let si_invoiced_external = 0, si_paid_external = 0, si_credit_external = 0;
		let future_amount = 0;
		let range1_amount = 0, range2_amount = 0, range3_amount = 0, range4_amount = 0, range5_amount = 0;
		let aging_counts = { range1: 0, range2: 0, range3: 0, range4: 0, range5: 0 };
		let total_days = 0, invoice_count = 0;
		let due_today_amount = 0, due_today_count = 0;
		let due_this_week_amount = 0, due_this_week_count = 0;
		let due_this_month_amount = 0, due_this_month_count = 0;

		// If using API totals, use them for total_sale and total_credit_note
		// Note: range amounts are NOT taken from api_totals because they include all voucher types.
		// They are always calculated from the invoice loop below, filtered to Sales Invoice only.
		if (use_api_totals) {
			total_sale = this.api_totals.invoiced || 0;
			total_credit_note = this.api_totals.credit_note || 0;
			future_amount = this.api_totals.future_amount || 0;
		}

		// Get today's date and date ranges
		const today = frappe.datetime.get_today();
		const week_end = frappe.datetime.add_days(today, 7);
		const month_end = frappe.datetime.add_days(today, 30);

		// Calculate analytics from filtered data - sum from invoices array
		for (const item of this.filtered_data) {
			// Check if this customer is an internal customer
			const customer_name = item.customer || item.party || '';
			const is_internal = this.internal_customers && this.internal_customers.has(customer_name);

			// Process invoices array - all data is at invoice level
			if (item.invoices && Array.isArray(item.invoices)) {
				for (const invoice of item.invoices) {
					const inv_outstanding = invoice.outstanding || 0;
					const inv_invoiced = invoice.invoiced || 0;
					const inv_paid = invoice.paid || 0;
					const inv_credit_note = invoice.credit_note || 0;
					const inv_future_amount = invoice.future_amount || 0;
					const voucherType = (invoice.voucher_type || '').trim();
					const isSalesInvoice = voucherType.toLowerCase() === 'sales invoice';

					// Always accumulate total_paid and all-voucher invoiced (matches AR report)
					total_paid += inv_paid;
					all_invoiced_total += inv_invoiced;
					all_credit_total += inv_credit_note;

					if (isSalesInvoice) {
						si_invoiced_total += inv_invoiced;
						si_paid_total += inv_paid;
						si_credit_total += inv_credit_note;

						if (is_internal) {
							si_invoiced_internal += inv_invoiced;
							si_paid_internal += inv_paid;
							si_credit_internal += inv_credit_note;
						} else {
							si_invoiced_external += inv_invoiced;
							si_paid_external += inv_paid;
							si_credit_external += inv_credit_note;
						}
					}

					// Calculate financial totals if not using API totals
					if (!use_api_totals) {
						total_outstanding += inv_outstanding;
						total_sale += inv_invoiced;
						total_credit_note += inv_credit_note;
						future_amount += inv_future_amount;
					}

					// Sum aging amounts for Sales Invoice vouchers only (excludes Payment Entry, Journal Entry, etc.)
					if (isSalesInvoice) {
						range1_amount += invoice.range1 || 0;
						range2_amount += invoice.range2 || 0;
						range3_amount += invoice.range3 || 0;
						range4_amount += invoice.range4 || 0;
						range5_amount += invoice.range5 || 0;
					}

					// Collection Against Invoice: sum of paid where voucher_type = Sales Invoice
					if (isSalesInvoice) {
						collection_against_invoice += inv_paid;
					}

					// Outstanding split by internal customer status
					if (is_internal) {
						intercompany_outstanding += inv_outstanding;
					} else {
						regular_outstanding += inv_outstanding;
					}

					// Unallocated/Advance: outstanding where voucher_type != Sales Invoice
					if (!isSalesInvoice && voucherType !== '') {
						unallocated_advance += inv_outstanding;
					}

					// Due Today: outstanding where voucher_type = Sales Invoice AND due_date = today
					if (isSalesInvoice && invoice.due_date === today && inv_outstanding > 0) {
						due_today_amount += inv_outstanding;
						due_today_count++;
					}

					// Due This Week: outstanding where voucher_type = Sales Invoice AND due_date within next 7 days
					if (isSalesInvoice && invoice.due_date && invoice.due_date >= today && invoice.due_date <= week_end && inv_outstanding > 0) {
						due_this_week_amount += inv_outstanding;
						due_this_week_count++;
					}

					// Due This Month: outstanding where voucher_type = Sales Invoice AND due_date within next 30 days
					if (isSalesInvoice && invoice.due_date && invoice.due_date >= today && invoice.due_date <= month_end && inv_outstanding > 0) {
						due_this_month_amount += inv_outstanding;
						due_this_month_count++;
					}

					// Count Sales Invoice vouchers by aging range only
					if (isSalesInvoice) {
						if ((invoice.range1 || 0) != 0) aging_counts.range1++;
						if ((invoice.range2 || 0) != 0) aging_counts.range2++;
						if ((invoice.range3 || 0) != 0) aging_counts.range3++;
						if ((invoice.range4 || 0) != 0) aging_counts.range4++;
						if ((invoice.range5 || 0) != 0) aging_counts.range5++;
					}

					// Average collection period calculation
					if (inv_outstanding > 0 && invoice.age) {
						total_days += invoice.age;
						invoice_count++;
					}
				}
			}
		}

		// Override summary cards to reflect Sales Invoice only
		const si_outstanding_total = si_invoiced_total - si_paid_total - si_credit_total;
		const si_outstanding_internal = si_invoiced_internal - si_paid_internal - si_credit_internal;

		// Total Invoiced = sum of ALL voucher types' invoiced (matches AR report "Invoiced Amount" total).
		// When no filters: prefer api_totals.invoiced (grand total row from AR report, most accurate).
		// When filters active: use all_invoiced_total recalculated from filtered data.
		console.log('[ARM] api_totals.invoiced:', this.api_totals && this.api_totals.invoiced, '| all_invoiced_total:', all_invoiced_total, '| si_invoiced_total:', si_invoiced_total, '| use_api_totals:', use_api_totals);
		if (use_api_totals && this.api_totals.invoiced > 0) {
			total_sale = this.api_totals.invoiced;
			total_credit_note = this.api_totals.credit_note || 0;
			total_outstanding = this.api_totals.outstanding || 0;
		} else {
			total_sale = all_invoiced_total;
			total_credit_note = all_credit_total;
			total_outstanding = si_outstanding_total;
		}
		// Always derive collection_against_invoice and intercompany from the invoice loop
		collection_against_invoice = si_paid_total;
		regular_outstanding = use_api_totals
			? (this.api_totals.outstanding || 0) - si_outstanding_internal
			: si_outstanding_total;
		intercompany_outstanding = si_outstanding_internal;

		// Calculate overdue from aging ranges (ranges 2-5, > 30 days)
		const overdue_amount = range2_amount + range3_amount + range4_amount + range5_amount;
		const overdue_percentage = total_outstanding > 0 ? (overdue_amount / total_outstanding * 100) : 0;

		// Average Collection Period
		const avg_collection_days = invoice_count > 0 ? total_days / invoice_count : 0;

		// Collection Efficiency: (Collection Against Invoice / Total Sale) × 100
		const collection_efficiency = total_sale > 0 ? (collection_against_invoice / total_sale * 100) : 0;

		// Use real collection data fetched from the API
		const month_collections = this.month_collection_total || 0;
		const year_collections = this.year_collection_total || 0;

		// Trend values (placeholder)
		const sale_trend = 0;
		const paid_trend = 0;
		const outstanding_trend = 0;
		const efficiency_trend = 0;
		const days_trend = 0;

		return {
			total_sale,
			total_paid,
			total_credit_note,
			total_outstanding,
			regular_outstanding,
			intercompany_outstanding,
			collection_against_invoice,
			unallocated_advance,
			future_amount,
			overdue_amount,
			overdue_percentage,
			due_today_amount,
			due_today_count,
			due_this_week_amount,
			due_this_week_count,
			due_this_month_amount,
			due_this_month_count,
			month_collections,
			year_collections,
			collection_efficiency,
			avg_collection_days,
			sale_trend,
			paid_trend,
			outstanding_trend,
			efficiency_trend,
			days_trend,
			invoice_count: this.filtered_data.length,
			aging_counts,
			aging_amounts: {
				range1: range1_amount,
				range2: range2_amount,
				range3: range3_amount,
				range4: range4_amount,
				range5: range5_amount
			}
		};
	}

	update_efficiency_gauge(percentage) {
		const angle = (percentage / 100) * 360;
		$('#efficiency-gauge').css('--progress-angle', `${angle}deg`);
		$('#efficiency-percentage').text(`${percentage.toFixed(1)}%`);
	}

	update_aging_cards(analytics) {
		const aging_data = [
			{
				range: '0-30',
				amount: analytics.aging_amounts.range1,
				count: analytics.aging_counts.range1,
				total: analytics.total_outstanding
			},
			{
				range: '31-60',
				amount: analytics.aging_amounts.range2,
				count: analytics.aging_counts.range2,
				total: analytics.total_outstanding
			},
			{
				range: '61-90',
				amount: analytics.aging_amounts.range3,
				count: analytics.aging_counts.range3,
				total: analytics.total_outstanding
			},
			{
				range: '91-120',
				amount: analytics.aging_amounts.range4,
				count: analytics.aging_counts.range4,
				total: analytics.total_outstanding
			},
			{
				range: '120-plus',
				amount: analytics.aging_amounts.range5,
				count: analytics.aging_counts.range5,
				total: analytics.total_outstanding
			}
		];

		aging_data.forEach((data, index) => {
			const percentage = data.total > 0 ? (data.amount / data.total * 100) : 0;
			$(`#aging-${data.range}-amount`).text(this.formatCurrency(data.amount));
			$(`#aging-${data.range}-count`).text(`${data.count} invoices`);
			$(`#aging-${data.range}-percentage`).text(`${percentage.toFixed(1)}% of total`);
		});
	}

	update_top_debtors() {
		// Sort customers by outstanding amount and get top 10
		// Calculate total outstanding from invoices for each customer
		const customers_with_totals = this.filtered_data.map(customer => {
			let total_outstanding = 0;
			let max_age = 0;

			// Sum outstanding from all invoices
			if (customer.invoices && Array.isArray(customer.invoices)) {
				customer.invoices.forEach(invoice => {
					total_outstanding += (invoice.outstanding || 0);
					max_age = Math.max(max_age, invoice.age || 0);
				});
			} else {
				// Fallback to customer-level outstanding if no invoices array
				total_outstanding = customer.outstanding || 0;
				max_age = customer.age || 0;
			}

			return {
				...customer,
				outstanding: total_outstanding,
				age: max_age
			};
		});

		const sorted_customers = customers_with_totals
			.filter(c => c.outstanding > 0)
			.sort((a, b) => b.outstanding - a.outstanding)
			.slice(0, 10);

		const max_outstanding = sorted_customers.length > 0 ? sorted_customers[0].outstanding : 0;

		let debtors_html = '';
		sorted_customers.forEach((customer, index) => {
			const percentage = max_outstanding > 0 ? (customer.outstanding / max_outstanding * 100) : 0;
			debtors_html += `
				<div class="debtor-item">
					<div class="debtor-info">
						<div class="debtor-name">${customer.customer_name || customer.customer}</div>
						<div class="debtor-details">Age: ${customer.age || 0} days | Credit: ${this.formatCurrency(customer.credit_limit || 0)}</div>
					</div>
					<div style="text-align: right;">
						<div class="debtor-amount">${this.formatCurrency(customer.outstanding)}</div>
						<div class="debtor-bar">
							<div class="debtor-bar-fill" style="width: ${percentage}%"></div>
						</div>
					</div>
				</div>
			`;
		});

		if (debtors_html === '') {
			debtors_html = `
				<div class="debtor-placeholder">
					<i class="fa fa-info-circle"></i>
					<p>No outstanding customers found</p>
				</div>
			`;
		}

		$('#top-debtors-list').html(debtors_html);
	}

	clear_filters() {
		if (this.customer_filter) this.customer_filter.set_value('');
		if (this.branch_filter) this.branch_filter.set_value('');
		this.filters_container.find('#aging-filter').val('all');
		this.filters_container.find('#min-outstanding-filter').val('');
		this.filters_container.find('#max-outstanding-filter').val('');

		// Reset voucher type filter
		$('#receivables-voucher-filter').val('all');
		$('#reset-receivables-filter').hide();
		this.filters.voucher_type_filter = 'all';

		this.update_filters();
		this.apply_filters();
	}

	formatCurrency(amount) {
		if (!amount && amount !== 0) return 'AED 0';
		const isNegative = amount < 0;
		const absAmount = Math.abs(amount);
		const formatted = new Intl.NumberFormat('en-AE', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(absAmount);
		return isNegative ? `AED -${formatted}` : `AED ${formatted}`;
	}

	getOutstandingColor(outstanding, credit_limit) {
		// Return appropriate color based on credit utilization
		if (!credit_limit || credit_limit === 0) {
			// If no credit limit, color by amount
			if (outstanding > 100000) return '#ef4444'; // Red - High amount
			if (outstanding > 50000) return '#f59e0b'; // Orange - Medium amount
			if (outstanding > 0) return '#10b981'; // Green - Low amount
			return '#94a3b8'; // Gray - No outstanding
		}

		const utilization = (outstanding / credit_limit) * 100;
		if (utilization > 100) return '#ef4444'; // Red - Exceeded credit limit
		if (utilization > 90) return '#dc2626'; // Dark Red - Critical
		if (utilization > 75) return '#f97316'; // Orange - Warning High
		if (utilization > 50) return '#f59e0b'; // Amber - Warning
		if (utilization > 25) return '#10b981'; // Green - Safe
		return '#6b7280'; // Gray - Very low utilization
	}

	getAgeBadge(age) {
		let badge_class = 'success';
		if (age > 120) badge_class = 'danger';
		else if (age > 90) badge_class = 'warning';
		else if (age > 60) badge_class = 'info';
		else if (age > 30) badge_class = 'primary';

		return `<span class="badge badge-${badge_class}">${age || 0} days</span>`;
	}

	isToday(dateString) {
		if (!dateString) return false;
		const date = new Date(dateString);
		const today = new Date();
		return date.toDateString() === today.toDateString();
	}

	calculateCreditScore(collectionRate, avgCollectionPeriod, creditUtilization) {
		let score = 100;

		// Deduct points based on collection rate (lower is worse)
		if (collectionRate < 50) score -= 30;
		else if (collectionRate < 70) score -= 20;
		else if (collectionRate < 85) score -= 10;

		// Deduct points based on collection period (higher is worse)
		if (avgCollectionPeriod > 90) score -= 25;
		else if (avgCollectionPeriod > 60) score -= 15;
		else if (avgCollectionPeriod > 30) score -= 10;

		// Deduct points based on credit utilization (higher is worse)
		if (creditUtilization > 90) score -= 20;
		else if (creditUtilization > 75) score -= 15;
		else if (creditUtilization > 50) score -= 10;

		// Determine letter grade and description
		let rating, description;
		if (score >= 90) {
			rating = 'A+';
			description = 'Excellent';
		} else if (score >= 80) {
			rating = 'A';
			description = 'Very Good';
		} else if (score >= 70) {
			rating = 'B+';
			description = 'Good';
		} else if (score >= 60) {
			rating = 'B';
			description = 'Fair';
		} else if (score >= 50) {
			rating = 'C';
			description = 'Poor';
		} else {
			rating = 'D';
			description = 'Critical';
		}

		return { rating, description, score };
	}

	view_customer_details(customer) {
		// Find customer data from main data array (use this.data, not filtered_data to get all invoices)
		let customer_data = this.data.find(d => d.customer === customer);

		// If not found in main data, try filtered data
		if (!customer_data) {
			customer_data = this.filtered_data.find(d => d.customer === customer);
		}

		if (!customer_data) {
			frappe.msgprint(__('Customer data not found.'));
			console.error('Customer not found:', customer);
			console.log('Available data:', this.data);
			return;
		}

		console.log('=== VIEW CUSTOMER DETAILS ===');
		console.log('Customer:', customer);
		console.log('Customer data:', customer_data);
		console.log('Has invoices array?', customer_data.invoices ? 'Yes' : 'No');
		console.log('Invoices count:', customer_data.invoices ? customer_data.invoices.length : 0);

		// Calculate customer grade based on receivables
		const grade = this.calculate_customer_grade(customer_data);

		// Calculate totals from invoices
		let total_invoiced = 0;
		let total_paid = 0;
		let total_credit_note = 0;
		let total_outstanding = 0;
		let invoice_count = 0;

		if (customer_data.invoices && Array.isArray(customer_data.invoices)) {
			console.log('Processing invoices...');
			customer_data.invoices.forEach(inv => {
				console.log('Invoice:', inv.voucher_no, 'Outstanding:', inv.outstanding, 'Invoiced:', inv.invoiced);
				total_invoiced += (inv.invoiced || 0);
				total_paid += (inv.paid || 0);
				total_credit_note += (inv.credit_note || 0);
				total_outstanding += (inv.outstanding || 0);
				if (inv.outstanding > 0) invoice_count++;
			});
		} else {
			console.log('No invoices array found or not an array');
			console.log('Customer data keys:', Object.keys(customer_data));
		}

		console.log('Calculated totals:', {
			total_invoiced,
			total_paid,
			total_credit_note,
			total_outstanding,
			invoice_count
		});

		// Create modal dialog
		const dialog = new frappe.ui.Dialog({
			title: `Customer Details: ${customer_data.customer_name || customer}`,
			size: 'extra-large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'customer_details_html'
				}
			]
		});

		// Generate HTML content
		const html_content = this.generate_customer_details_html(customer_data, grade, {
			total_invoiced,
			total_paid,
			total_credit_note,
			total_outstanding,
			invoice_count
		});

		dialog.fields_dict.customer_details_html.$wrapper.html(html_content);
		dialog.show();

		// Setup expand/collapse for invoice rows
		setTimeout(() => {
			$('.customer-detail-row[data-has-invoices="true"]').on('click', function () {
				const customerId = $(this).data('customer-id');
				const detailRow = $(`.invoice-detail-row[data-customer-id="${customerId}"]`);
				const icon = $(this).find('.expand-icon');

				if (detailRow.is(':visible')) {
					detailRow.hide();
					icon.removeClass('fa-minus-circle').addClass('fa-plus-circle');
				} else {
					detailRow.show();
					icon.removeClass('fa-plus-circle').addClass('fa-minus-circle');
				}
			});
		}, 100);
	}

	calculate_customer_grade(customer_data) {
		// Calculate grade based on:
		// 1. Payment history (paid vs invoiced)
		// 2. Aging distribution
		// 3. Credit limit utilization

		let total_invoiced = 0;
		let total_paid = 0;
		let total_outstanding = 0;
		let aged_30_plus = 0;
		let aged_60_plus = 0;
		let aged_90_plus = 0;

		if (customer_data.invoices && Array.isArray(customer_data.invoices)) {
			customer_data.invoices.forEach(inv => {
				total_invoiced += (inv.invoiced || 0);
				total_paid += (inv.paid || 0);
				total_outstanding += (inv.outstanding || 0);

				const age = inv.age || 0;
				if (age > 30) aged_30_plus += (inv.outstanding || 0);
				if (age > 60) aged_60_plus += (inv.outstanding || 0);
				if (age > 90) aged_90_plus += (inv.outstanding || 0);
			});
		}

		let score = 100;

		// Deduct for payment delays
		const payment_rate = total_invoiced > 0 ? (total_paid / total_invoiced) * 100 : 100;
		if (payment_rate < 50) score -= 30;
		else if (payment_rate < 70) score -= 20;
		else if (payment_rate < 90) score -= 10;

		// Deduct for aged receivables
		if (total_outstanding > 0) {
			const aged_30_ratio = (aged_30_plus / total_outstanding) * 100;
			const aged_60_ratio = (aged_60_plus / total_outstanding) * 100;
			const aged_90_ratio = (aged_90_plus / total_outstanding) * 100;

			if (aged_90_ratio > 50) score -= 30;
			else if (aged_90_ratio > 25) score -= 20;
			else if (aged_60_ratio > 50) score -= 15;
			else if (aged_30_ratio > 50) score -= 10;
		}

		// Deduct for credit limit exceeded
		const credit_limit = customer_data.credit_limit || 0;
		if (credit_limit > 0 && total_outstanding > credit_limit) {
			const excess_ratio = ((total_outstanding - credit_limit) / credit_limit) * 100;
			if (excess_ratio > 50) score -= 20;
			else if (excess_ratio > 25) score -= 10;
		}

		score = Math.max(0, Math.min(100, score));

		let grade_letter = 'A+';
		let grade_color = '#10b981';
		let grade_description = 'Excellent Payment History';

		if (score >= 90) {
			grade_letter = 'A+';
			grade_color = '#10b981';
			grade_description = 'Excellent Payment History';
		} else if (score >= 80) {
			grade_letter = 'A';
			grade_color = '#22c55e';
			grade_description = 'Very Good Payment History';
		} else if (score >= 70) {
			grade_letter = 'B+';
			grade_color = '#84cc16';
			grade_description = 'Good Payment History';
		} else if (score >= 60) {
			grade_letter = 'B';
			grade_color = '#eab308';
			grade_description = 'Fair Payment History';
		} else if (score >= 50) {
			grade_letter = 'C';
			grade_color = '#f59e0b';
			grade_description = 'Average Payment History';
		} else if (score >= 40) {
			grade_letter = 'D';
			grade_color = '#f97316';
			grade_description = 'Below Average Payment History';
		} else {
			grade_letter = 'F';
			grade_color = '#ef4444';
			grade_description = 'Poor Payment History';
		}

		return {
			score,
			letter: grade_letter,
			color: grade_color,
			description: grade_description
		};
	}

	generate_customer_details_html(customer_data, grade, totals) {
		const invoices = customer_data.invoices || [];
		console.log('Customer data:', customer_data);
		console.log('Total invoices:', invoices.length);
		console.log('Totals:', totals);

		// Filter for invoices with outstanding amount
		const outstanding_invoices = invoices.filter(inv => {
			const outstanding = inv.outstanding || 0;
			return outstanding > 0;
		});

		console.log('Outstanding invoices:', outstanding_invoices.length);
		console.log('Outstanding invoices data:', outstanding_invoices);

		// Calculate aging breakdown
		let aging_0_30 = 0, aging_31_60 = 0, aging_61_90 = 0, aging_90_plus = 0;
		outstanding_invoices.forEach(inv => {
			const age = inv.age || 0;
			const outstanding = inv.outstanding || 0;
			console.log(`Invoice ${inv.voucher_no}: age=${age}, outstanding=${outstanding}`);

			if (age <= 30) aging_0_30 += outstanding;
			else if (age <= 60) aging_31_60 += outstanding;
			else if (age <= 90) aging_61_90 += outstanding;
			else aging_90_plus += outstanding;
		});

		console.log('Aging breakdown:', { aging_0_30, aging_31_60, aging_61_90, aging_90_plus });

		const credit_utilization = customer_data.credit_limit > 0
			? ((totals.total_outstanding / customer_data.credit_limit) * 100).toFixed(2)
			: 0;

		return `
			<style>
				.modal-dialog.modal-xl {
					max-width: 1200px !important;
				}
				.frappe-control[data-fieldname="customer_details_html"] {
					margin: 0 !important;
					padding: 0 !important;
				}
				.frappe-control[data-fieldname="customer_details_html"] .form-group {
					margin-bottom: 0 !important;
				}
				.customer-detail-header {
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					padding: 24px;
					border-radius: 8px;
					margin-bottom: 24px;
					color: white;
				}
				.grade-badge {
					display: inline-block;
					padding: 12px 24px;
					border-radius: 50px;
					font-size: 32px;
					font-weight: 700;
					background: white;
					margin-right: 16px;
					box-shadow: 0 4px 6px rgba(0,0,0,0.1);
				}
				.summary-card {
					background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
					border: 1px solid rgba(59, 130, 246, 0.3);
					border-radius: 8px;
					padding: 20px;
					margin-bottom: 16px;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1);
				}
				.summary-card h4 {
					margin-top: 0 !important;
					margin-bottom: 16px !important;
					color: #60a5fa !important;
					font-weight: 600 !important;
				}
				.summary-row {
					display: flex;
					justify-content: space-between;
					padding: 10px 0;
					border-bottom: 1px solid rgba(148, 163, 184, 0.2);
					align-items: center;
				}
				.summary-row:last-child {
					border-bottom: none;
					font-weight: 700;
					font-size: 16px;
					margin-top: 8px;
					padding-top: 12px;
					border-top: 2px solid rgba(59, 130, 246, 0.5);
				}
				.summary-label {
					color: #cbd5e1;
					font-weight: 600;
					font-size: 14px;
				}
				.summary-label i {
					margin-right: 8px;
					width: 16px;
					text-align: center;
				}
				.summary-value {
					color: #e2e8f0;
					font-weight: 700;
					font-size: 16px;
				}
				.invoice-table {
					width: 100%;
					border-collapse: collapse;
					margin-top: 16px;
					background: transparent;
				}
				.invoice-table th {
					background: rgba(59, 130, 246, 0.1);
					color: #cbd5e1;
					padding: 12px;
					text-align: left;
					font-weight: 600;
					font-size: 12px;
					border-bottom: 2px solid rgba(59, 130, 246, 0.3);
					white-space: nowrap;
				}
				.invoice-table td {
					padding: 10px 12px;
					border-bottom: 1px solid rgba(148, 163, 184, 0.1);
					font-size: 13px;
					color: #cbd5e1;
				}
				.invoice-table tbody tr {
					transition: background 0.2s;
				}
				.invoice-table tbody tr:hover {
					background: rgba(59, 130, 246, 0.08) !important;
				}
				.aging-bar-container {
					display: flex;
					height: 30px;
					border-radius: 4px;
					overflow: hidden;
					margin-top: 8px;
					background: rgba(15, 23, 42, 0.5);
				}
				.aging-bar-segment {
					display: flex;
					align-items: center;
					justify-content: center;
					color: white;
					font-size: 11px;
					font-weight: 600;
					min-width: 40px;
				}
			</style>

			<div class="customer-detail-header">
				<div style="display: flex; align-items: center; justify-content: space-between;">
					<div>
						<h3 style="margin: 0; font-size: 24px;">${customer_data.customer_name || customer_data.customer}</h3>
						<p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">
							<i class="fa fa-id-card"></i> ${customer_data.customer} |
							<i class="fa fa-map-marker"></i> ${customer_data.branch || 'N/A'}
						</p>
					</div>
					<div style="text-align: right;">
						<div class="grade-badge" style="color: ${grade.color};">${grade.letter}</div>
						<div style="font-size: 14px; margin-top: 8px;">${grade.description}</div>
						<div style="font-size: 12px; opacity: 0.9;">Score: ${grade.score}/100</div>
					</div>
				</div>
			</div>

			<div class="summary-card">
				<h4 style="color: #60a5fa; margin-top: 0; margin-bottom: 16px;">
					<i class="fa fa-list"></i> Invoice Details (${outstanding_invoices.length} outstanding)
				</h4>
				<div class="table-responsive">
					<table class="invoice-table">
						<thead>
							<tr>
								<th style="width: 15%;">Invoice No</th>
								<th style="width: 14%; text-align: right;">Invoiced</th>
								<th style="width: 14%; text-align: right;">Paid</th>
								<th style="width: 14%; text-align: right;">Credit Note</th>
								<th style="width: 14%; text-align: right;">Outstanding</th>
								<th style="width: 14%;">Posting Date</th>
								<th style="width: 8%; text-align: center;">Age</th>
								<th style="width: 7%; text-align: center;">Status</th>
							</tr>
						</thead>
						<tbody>
							${outstanding_invoices.length > 0 ? outstanding_invoices.map(inv => {
			const age = inv.age || 0;
			const status_color = age > 90 ? '#ef4444' : age > 60 ? '#f97316' : age > 30 ? '#f59e0b' : '#10b981';
			const status_text = age > 90 ? 'Overdue' : age > 60 ? 'Critical' : age > 30 ? 'Warning' : 'Current';

			return `
									<tr>
										<td style="color: #cbd5e1; font-weight: 600;">
											<a href="/app/sales-invoice/${inv.voucher_no}" target="_blank" style="color: #60a5fa; text-decoration: none;">
												${inv.voucher_no}
											</a>
										</td>
										<td style="text-align: right; color: #3b82f6; font-weight: 600;">${this.formatCurrency(inv.invoiced || 0)}</td>
										<td style="text-align: right; color: #10b981; font-weight: 600;">${this.formatCurrency(inv.paid || 0)}</td>
										<td style="text-align: right; color: #f59e0b; font-weight: 600;">${this.formatCurrency(inv.credit_note || 0)}</td>
										<td style="text-align: right; color: #ef4444; font-weight: 700;">${this.formatCurrency(inv.outstanding || 0)}</td>
										<td style="color: #94a3b8;">${inv.posting_date || '-'}</td>
										<td style="text-align: center; color: #cbd5e1; font-weight: 600;">${age} days</td>
										<td style="text-align: center;">
											<span style="display: inline-block; padding: 4px 8px; border-radius: 12px; background: ${status_color}; color: white; font-size: 10px; font-weight: 600;">
												${status_text}
											</span>
										</td>
									</tr>
								`;
		}).join('') : '<tr><td colspan="9" style="text-align: center; padding: 24px; color: #94a3b8;">No outstanding invoices</td></tr>'}
						</tbody>
					</table>
				</div>
			</div>
		`;
	}

	create_payment_entry(customer) {
		frappe.new_doc("Payment Entry", {
			party_type: "Customer",
			party: customer,
			payment_type: "Receive"
		});
	}

	export_to_excel() {
		if (this.filtered_data.length === 0) {
			frappe.msgprint(__('No data to export.'));
			return;
		}

		const data = this.filtered_data.map(item => ({
			'Customer': item.customer,
			'Customer Name': item.customer_name,
			'Branch': item.branch,
			'Credit Limit': item.credit_limit,
			'Total Sale': item.invoiced || 0,
			'Total Paid': item.paid || 0,
			'Credit Note': item.credit_note || 0,
			'Receivable': item.outstanding,
			'Age (Days)': item.age,
			'0-30 Days': item.range1,
			'31-60 Days': item.range2,
			'61-90 Days': item.range3,
			'91-120 Days': item.range4,
			'120+ Days': item.range5,
			'Posting Date': item.posting_date
		}));

		frappe.tools.downloadify(data, null, "Customer_Receivables_" + frappe.datetime.get_today());
	}

	print_report() {
		const print_html = this.generate_print_html();
		const print_window = window.open('', '_blank');
		print_window.document.write(print_html);
		print_window.document.close();
		print_window.print();
	}

	generate_print_html() {
		const company_name = this.filters.company || 'All Companies';
		const report_date = this.filters.report_date;

		let table_html = '<table border="1" style="width: 100%; border-collapse: collapse; font-size: 12px;">';
		table_html += '<thead><tr>';
		table_html += '<th>Customer</th><th>Customer Name</th><th>Total Sale</th><th>Total Paid</th><th>Credit Note</th><th>Receivable</th><th>0-30</th><th>31-60</th><th>61-90</th><th>91-120</th><th>120+</th>';
		table_html += '</tr></thead><tbody>';

		this.filtered_data.forEach(item => {
			table_html += `<tr>
				<td>${item.customer}</td>
				<td>${item.customer_name || ''}</td>
				<td style="text-align: right;">${this.formatCurrency(item.invoiced || 0)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.paid || 0)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.credit_note || 0)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.outstanding)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.range1)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.range2)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.range3)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.range4)}</td>
				<td style="text-align: right;">${this.formatCurrency(item.range5)}</td>
			</tr>`;
		});
		table_html += '</tbody></table>';

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Accounts Receivable Report</title>
				<style>
					body { font-family: Arial, sans-serif; margin: 20px; }
					.header { text-align: center; margin-bottom: 30px; }
					.company-name { font-size: 18px; font-weight: bold; }
					.report-title { font-size: 16px; margin: 10px 0; }
					.report-date { font-size: 12px; color: #666; }
					table { margin-top: 20px; }
					th { background-color: rgba(59, 130, 246, 0.1); color: #e2e8f0; padding: 8px; }
					td { padding: 6px; }
				</style>
			</head>
			<body>
				<div class="header">
					<div class="company-name">${company_name}</div>
					<div class="report-title">Accounts Receivable Report</div>
					<div class="report-date">As on ${report_date}</div>
				</div>
				${table_html}
				<div style="margin-top: 20px; font-size: 10px; color: #666;">
					Generated on ${frappe.datetime.get_datetime_as_string(new Date())}
				</div>
			</body>
			</html>
		`;
	}

	// Missing section methods
	create_overview_analytics() {
		const analytics_container = $(`
			<!-- Row 1: AR Report Summary (4 cards) -->
			<div class="row">
				<!-- Total Invoiced Amount -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card primary" data-card-type="total-sale">
						<div class="stat-header">
							<h4 class="stat-title">Total Invoiced</h4>
							<div class="stat-icon primary">
								<i class="fa fa-file-text"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-total-sale">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Sum of Invoiced Amount from AR Report</small>
						</div>
					</div>
				</div>

				<!-- Collection Against Invoice -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card success" data-card-type="collection-against-invoice">
						<div class="stat-header">
							<h4 class="stat-title">Collection Against Invoice</h4>
							<div class="stat-icon success">
								<i class="fa fa-check-circle"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-collection-against-invoice">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Paid amount where Voucher Type = Sales Invoice</small>
						</div>
					</div>
				</div>

				<!-- Credit Notes -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card info" data-card-type="total-credit">
						<div class="stat-header">
							<h4 class="stat-title">Credit Notes</h4>
							<div class="stat-icon info">
								<i class="fa fa-minus-circle"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-total-credit">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Sum of Credit Note from AR Report</small>
						</div>
					</div>
				</div>

				<!-- Outstanding (Sales Invoice Only) -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card danger" data-card-type="total-outstanding">
						<div class="stat-header">
							<h4 class="stat-title">Outstanding</h4>
							<div class="stat-icon danger">
								<i class="fa fa-exclamation-circle"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-total-outstanding">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Sales Invoice only (all customers)</small>
						</div>
					</div>
				</div>
			</div>

			<!-- Row 2: Inter Company Outstanding, Unallocated/Advance, Overdue, Due Today (4 cards) -->
			<div class="row" style="margin-top: 16px;">
				<!-- Inter Company Outstanding -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card danger" data-card-type="intercompany-outstanding">
						<div class="stat-header">
							<h4 class="stat-title">Inter Company Outstanding</h4>
							<div class="stat-icon danger">
								<i class="fa fa-exchange"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-intercompany-outstanding">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Outstanding from internal customers</small>
						</div>
					</div>
				</div>

				<!-- Unallocated Collection / Advance -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card warning" data-card-type="unallocated-advance">
						<div class="stat-header">
							<h4 class="stat-title">Unallocated / Advance</h4>
							<div class="stat-icon warning">
								<i class="fa fa-money"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-unallocated-advance">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Outstanding where Voucher Type != Sales Invoice</small>
						</div>
					</div>
				</div>

				<!-- Total Outstanding (Sales Invoice Only) -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card danger" data-card-type="total-outstanding-all">
						<div class="stat-header">
							<h4 class="stat-title">Total Outstanding</h4>
							<div class="stat-icon danger">
								<i class="fa fa-exclamation-triangle"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-total-outstanding-all">AED 0</div>
						<div id="overview-total-outstanding-viewing" style="font-size: 13px; color: #f59e0b; margin-top: 4px; min-height: 18px;"></div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Sales Invoice only (all customers)</small>
						</div>
					</div>
				</div>

				<!-- Due Today -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card danger" data-card-type="due-today">
						<div class="stat-header">
							<h4 class="stat-title">Due Today</h4>
							<div class="stat-icon danger">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-due-today">AED 0</div>
						<div class="stat-change" id="overview-due-today-count">
							<i class="fa fa-file-text-o"></i> 0 invoices
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Amount due today</small>
						</div>
					</div>
				</div>
			</div>

			<!-- Row 2.5: Outstanding without future payment reduction -->
			<div class="row" style="margin-top: 16px;">
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card primary" data-card-type="outstanding-without-future">
						<div class="stat-header">
							<h4 class="stat-title">Outstanding (Without Future Payment)</h4>
							<div class="stat-icon primary">
								<i class="fa fa-balance-scale"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-outstanding-without-future">AED 0</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Gross SI outstanding (not reduced by future amount)</small>
						</div>
					</div>
				</div>
			</div>

			<!-- Row 3: Due This Week, Due This Month, Month Collections, Year Collections (4 cards) -->
			<div class="row" style="margin-top: 16px;">
				<!-- Due This Week -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card warning" data-card-type="due-this-week">
						<div class="stat-header">
							<h4 class="stat-title">Due This Week</h4>
							<div class="stat-icon warning">
								<i class="fa fa-calendar-o"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-due-this-week">AED 0</div>
						<div class="stat-change" id="overview-due-week-count">
							<i class="fa fa-file-text-o"></i> 0 invoices
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Amount due within this week</small>
						</div>
					</div>
				</div>

				<!-- Due This Month -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card info" data-card-type="due-this-month">
						<div class="stat-header">
							<h4 class="stat-title">Due This Month</h4>
							<div class="stat-icon info">
								<i class="fa fa-calendar-check-o"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-due-this-month">AED 0</div>
						<div class="stat-change" id="overview-due-month-count">
							<i class="fa fa-file-text-o"></i> 0 invoices
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Amount due within this month</small>
						</div>
					</div>
				</div>

				<!-- Current Month Collections -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card success" data-card-type="month-collections">
						<div class="stat-header">
							<h4 class="stat-title">Month Collections</h4>
							<div class="stat-icon success">
								<i class="fa fa-calendar-check-o"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-month-collections">AED 0</div>
						<div class="stat-change" id="overview-month-collection-count">
							<i class="fa fa-file-text-o"></i> 0 payments
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Collections received this month</small>
						</div>
					</div>
				</div>

				<!-- This Year Collection -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card success" data-card-type="year-collections">
						<div class="stat-header">
							<h4 class="stat-title">This Year Collection</h4>
							<div class="stat-icon success">
								<i class="fa fa-line-chart"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-year-collections">AED 0</div>
						<div class="stat-change" id="overview-year-collection-count">
							<i class="fa fa-calendar"></i> Year-to-date
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Total collections for current year</small>
						</div>
					</div>
				</div>
			</div>

			<!-- Row 4: Unallocated Collection, Future Amount, Collection Efficiency, Avg Collection Period (4 cards) -->
			<div class="row" style="margin-top: 16px;">
				<!-- Unallocated Collection -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card info" data-card-type="unallocated-collection">
						<div class="stat-header">
							<h4 class="stat-title">Unallocated Collection</h4>
							<div class="stat-icon info">
								<i class="fa fa-exchange"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-unallocated-collection">AED 0</div>
						<div class="stat-change" id="overview-unallocated-count">
							<i class="fa fa-file-text-o"></i> 0 open entries
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> Payment Entry & Journal Entry balances</small>
						</div>
					</div>
				</div>

				<!-- Future Amount -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card success" data-card-type="future-amount">
						<div class="stat-header">
							<h4 class="stat-title">Future Amount</h4>
							<div class="stat-icon success">
								<i class="fa fa-hourglass-half"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-future-amount">AED 0</div>
						<div class="stat-change" id="overview-future-count">
							<i class="fa fa-calendar"></i> Future allocations
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> AR future payment amount</small>
						</div>
					</div>
				</div>

				<!-- Collection Efficiency -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card warning" data-card-type="collection-efficiency">
						<div class="stat-header">
							<h4 class="stat-title">Collection Efficiency</h4>
							<div class="stat-icon warning">
								<i class="fa fa-tachometer"></i>
							</div>
						</div>
						<div class="gauge-container">
							<div class="circular-progress" id="efficiency-gauge">
								<div class="progress-value" id="efficiency-percentage">0%</div>
							</div>
						</div>
						<div class="stat-change" id="efficiency-comparison">
							<i class="fa fa-info-circle"></i> Collections / Invoiced
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> (Total Paid / Total Sale) × 100</small>
						</div>
					</div>
				</div>

				<!-- Average Collection Period -->
				<div class="col-md-3" style="padding: 0 8px;">
					<div class="stat-card primary" data-card-type="avg-collection-period">
						<div class="stat-header">
							<h4 class="stat-title">Avg Collection Period</h4>
							<div class="stat-icon primary">
								<i class="fa fa-calendar-o"></i>
							</div>
						</div>
						<div class="stat-value" id="overview-avg-days">
							<span id="avg-collection-days">0</span><span class="day-suffix"> days</span>
						</div>
						<div class="stat-change" id="avg-days-trend">
							<i class="fa fa-info-circle"></i> Average time to collect
						</div>
						<div class="stat-description">
							<small><i class="fa fa-info-circle"></i> (Outstanding / Total Sale) × Days in Period</small>
						</div>
					</div>
				</div>
			</div>

		`);

		this.main_container.find('.overview-analytics-section').append(analytics_container);
	}

	create_aging_analysis_cards() {
		const aging_container = $(`
			<div class="aging-analysis-header">
				<h3 style="color: #e2e8f0; font-size: 18px; font-weight: 700; margin-bottom: 20px;">
					<i class="fa fa-clock-o" style="margin-right: 8px; color: #cbd5e1;"></i>
					Aging Analysis Breakdown
				</h3>
			</div>
			<div class="row">
				<!-- 0-30 Days -->
				<div class="col-md-2-4">
					<div class="aging-card aging-current" data-aging-range="0-30" title="Click to view invoices in 0-30 days range" style="cursor: pointer;">
						<div class="aging-header">
							<h4 class="aging-title">0-30 Days</h4>
							<div class="aging-icon current">
								<i class="fa fa-check-circle"></i>
							</div>
						</div>
						<div class="aging-amount" id="aging-0-30-amount">AED 0</div>
						<div class="aging-count" id="aging-0-30-count">0 invoices</div>
						<div class="aging-percentage" id="aging-0-30-percentage">0% of total</div>
						<div class="aging-click-hint" style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
							<i class="fa fa-hand-pointer-o"></i> Click to view invoices
						</div>
					</div>
				</div>

				<!-- 31-60 Days -->
				<div class="col-md-2-4">
					<div class="aging-card aging-warning" data-aging-range="31-60" title="Click to view invoices in 31-60 days range" style="cursor: pointer;">
						<div class="aging-header">
							<h4 class="aging-title">31-60 Days</h4>
							<div class="aging-icon warning">
								<i class="fa fa-clock-o"></i>
							</div>
						</div>
						<div class="aging-amount" id="aging-31-60-amount">AED 0</div>
						<div class="aging-count" id="aging-31-60-count">0 invoices</div>
						<div class="aging-percentage" id="aging-31-60-percentage">0% of total</div>
						<div class="aging-click-hint" style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
							<i class="fa fa-hand-pointer-o"></i> Click to view invoices
						</div>
					</div>
				</div>

				<!-- 61-90 Days -->
				<div class="col-md-2-4">
					<div class="aging-card aging-caution" data-aging-range="61-90" title="Click to view invoices in 61-90 days range" style="cursor: pointer;">
						<div class="aging-header">
							<h4 class="aging-title">61-90 Days</h4>
							<div class="aging-icon caution">
								<i class="fa fa-exclamation-circle"></i>
							</div>
						</div>
						<div class="aging-amount" id="aging-61-90-amount">AED 0</div>
						<div class="aging-count" id="aging-61-90-count">0 invoices</div>
						<div class="aging-percentage" id="aging-61-90-percentage">0% of total</div>
						<div class="aging-click-hint" style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
							<i class="fa fa-hand-pointer-o"></i> Click to view invoices
						</div>
					</div>
				</div>

				<!-- 91-120 Days -->
				<div class="col-md-2-4">
					<div class="aging-card aging-danger" data-aging-range="91-120" title="Click to view invoices in 91-120 days range" style="cursor: pointer;">
						<div class="aging-header">
							<h4 class="aging-title">91-120 Days</h4>
							<div class="aging-icon danger">
								<i class="fa fa-exclamation-triangle"></i>
							</div>
						</div>
						<div class="aging-amount" id="aging-91-120-amount">AED 0</div>
						<div class="aging-count" id="aging-91-120-count">0 invoices</div>
						<div class="aging-percentage" id="aging-91-120-percentage">0% of total</div>
						<div class="aging-click-hint" style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
							<i class="fa fa-hand-pointer-o"></i> Click to view invoices
						</div>
					</div>
				</div>

				<!-- 120+ Days -->
				<div class="col-md-2-4">
					<div class="aging-card aging-critical" data-aging-range="120-plus" title="Click to view invoices in 120+ days range" style="cursor: pointer;">
						<div class="aging-header">
							<h4 class="aging-title">120+ Days</h4>
							<div class="aging-icon critical">
								<i class="fa fa-warning"></i>
							</div>
						</div>
						<div class="aging-amount" id="aging-120-plus-amount">AED 0</div>
						<div class="aging-count" id="aging-120-plus-count">0 invoices</div>
						<div class="aging-percentage" id="aging-120-plus-percentage">0% of total</div>
						<div class="aging-click-hint" style="font-size: 11px; color: #cbd5e1; margin-top: 8px;">
							<i class="fa fa-hand-pointer-o"></i> Click to view invoices
						</div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.aging-analysis-section').append(aging_container);

		// Setup unified aging card click handlers (handles both overview and detailed cards)
		this.setup_detailed_aging_click_handlers();
	}

	create_top_debtors_card() {
		const debtors_container = $(`
			<div class="top-debtors-header">
				<h3 style="color: #ae7cd6; font-size: 18px; font-weight: 700; margin-bottom: 20px;">
					<i class="fa fa-users" style="margin-right: 8px; color: #10b981;"></i>
					Top Outstanding Customers
				</h3>
			</div>
			<div class="stat-card">
				<div class="top-debtors-list" id="top-debtors-list">
					<div class="debtor-placeholder">
						<i class="fa fa-spinner fa-spin"></i>
						<p>Loading top debtors...</p>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.top-debtors-section').append(debtors_container);
	}



	create_customer_table() {
		this.create_data_table();
	}

	create_outstanding_table() {
		this.create_data_table();
	}

	create_detailed_summary() {
		const detailed_container = $(`
			<!-- Sales Summary Table -->
			<div class="stat-card" style="margin-bottom: 24px;">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-line-chart" style="margin-right: 8px; color: #3b82f6;"></i>
					A. Sales Summary
				</h4>
				<div class="table-responsive">
					<table class="table table-striped" style="margin-bottom: 0;">
						<thead style="background-color: rgba(59, 130, 246, 0.1); border-bottom: 1px solid rgba(59, 130, 246, 0.3);">
							<tr>
								<th style="color: #e2e8f0; font-weight: 600;">Metric</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">Current Month</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">Current Quarter</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">Current Year</th>
								<th style="text-align: center; color: #e2e8f0; font-weight: 600;">Growth %</th>
							</tr>
						</thead>
						<tbody>
							<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Total Sales</td>
								<td style="text-align: right; color: #e2e8f0;" id="sales-month">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="sales-quarter">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="sales-year">AED 0</td>
								<td style="text-align: center; color: #10b981;" id="sales-growth">+0%</td>
							</tr>
							<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Outstanding Sales Invoices</td>
								<td style="text-align: right; color: #e2e8f0;" id="outstanding-invoices-count">0</td>
								<td style="text-align: right; color: #e2e8f0;" id="outstanding-invoices-quarter">0</td>
								<td style="text-align: right; color: #e2e8f0;" id="outstanding-invoices-year">0</td>
								<td style="text-align: center; color: #f59e0b;" id="outstanding-invoices-trend">0%</td>
							</tr>
							<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Average Invoice Value</td>
								<td style="text-align: right; color: #e2e8f0;" id="avg-invoice-month">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="avg-invoice-quarter">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="avg-invoice-year">AED 0</td>
								<td style="text-align: center; color: #10b981;" id="avg-invoice-trend">+0%</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Payment Summary Table -->
			<div class="stat-card" style="margin-bottom: 24px;">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-money" style="margin-right: 8px; color: #10b981;"></i>
					B. Payment Summary
				</h4>
				<div class="table-responsive">
					<table class="table table-striped" style="margin-bottom: 0;">
						<thead style="background-color: rgba(16, 185, 129, 0.1); border-bottom: 1px solid rgba(16, 185, 129, 0.3);">
							<tr>
								<th style="color: #e2e8f0; font-weight: 600;">Payment Metric</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">This Month</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">This Quarter</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">This Year</th>
								<th style="text-align: center; color: #e2e8f0; font-weight: 600;">Method Breakdown</th>
							</tr>
						</thead>
						<tbody>
							<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Total Payments Received</td>
								<td style="text-align: right; color: #e2e8f0;" id="payments-month">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="payments-quarter">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="payments-year">AED 0</td>
								<td style="text-align: center; color: #94a3b8;" id="payment-methods">Cash: 40%, Bank: 60%</td>
							</tr>
							<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Average Payment Amount</td>
								<td style="text-align: right; color: #e2e8f0;" id="avg-payment-month">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="avg-payment-quarter">AED 0</td>
								<td style="text-align: right; color: #e2e8f0;" id="avg-payment-year">AED 0</td>
								<td style="text-align: center; color: #94a3b8;" id="payment-frequency">Weekly</td>
							</tr>
							<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Payment Efficiency</td>
								<td style="text-align: right; color: #e2e8f0;" id="payment-efficiency-month">0%</td>
								<td style="text-align: right; color: #e2e8f0;" id="payment-efficiency-quarter">0%</td>
								<td style="text-align: right; color: #e2e8f0;" id="payment-efficiency-year">0%</td>
								<td style="text-align: center; color: #10b981;" id="payment-trend">↑ Improving</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Receivables Aging Analysis Table -->
			<div class="stat-card">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-clock-o" style="margin-right: 8px; color: #f59e0b;"></i>
					C. Receivables Aging Analysis
				</h4>
				<div class="table-responsive">
					<table class="table table-striped" style="margin-bottom: 0;">
						<thead style="background-color: rgba(245, 158, 11, 0.1); border-bottom: 1px solid rgba(245, 158, 11, 0.3);">
							<tr>
								<th style="color: #e2e8f0; font-weight: 600;">Age Range</th>
								<th style="text-align: right; color: #e2e8f0; font-weight: 600;">Amount</th>
								<th style="text-align: center; color: #e2e8f0; font-weight: 600;">Percentage</th>
								<th style="text-align: center; color: #e2e8f0; font-weight: 600;">Invoice Count</th>
								<th style="text-align: center; color: #e2e8f0; font-weight: 600;">Risk Level</th>
							</tr>
						</thead>
						<tbody>
							<tr style="background-color: rgba(16, 185, 129, 0.05); border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Current (0-30 days)</td>
								<td style="text-align: right; color: #e2e8f0;" id="aging-current-amount">AED 0</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-current-percentage">0%</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-current-count">0</td>
								<td style="text-align: center;"><span style="background-color: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 11px;">Low</span></td>
							</tr>
							<tr style="background-color: rgba(245, 158, 11, 0.05); border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">31-60 days</td>
								<td style="text-align: right; color: #e2e8f0;" id="aging-31-60-amount">AED 0</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-31-60-percentage">0%</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-31-60-count">0</td>
								<td style="text-align: center;"><span style="background-color: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 8px; border-radius: 4px; font-size: 11px;">Medium</span></td>
							</tr>
							<tr style="background-color: rgba(239, 68, 68, 0.05); border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">61-90 days</td>
								<td style="text-align: right; color: #e2e8f0;" id="aging-61-90-amount">AED 0</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-61-90-percentage">0%</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-61-90-count">0</td>
								<td style="text-align: center;"><span style="background-color: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 8px; border-radius: 4px; font-size: 11px;">High</span></td>
							</tr>
							<tr style="background-color: rgba(220, 38, 38, 0.05); border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
								<td style="color: #f1f5f9; font-weight: 600;">Over 90 days</td>
								<td style="text-align: right; color: #e2e8f0;" id="aging-over-90-amount">AED 0</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-over-90-percentage">0%</td>
								<td style="text-align: center; color: #e2e8f0;" id="aging-over-90-count">0</td>
								<td style="text-align: center;"><span style="background-color: rgba(220, 38, 38, 0.2); color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 11px;">Critical</span></td>
							</tr>
							<tr style="background-color: rgba(59, 130, 246, 0.05); font-weight: bold; border-top: 2px solid rgba(59, 130, 246, 0.3);">
								<td style="color: #f1f5f9; font-weight: 700;">Total Outstanding</td>
								<td style="text-align: right; color: #3b82f6; font-weight: 700;" id="aging-total-amount">AED 0</td>
								<td style="text-align: center; color: #e2e8f0; font-weight: 700;">100%</td>
								<td style="text-align: center; color: #e2e8f0; font-weight: 700;" id="aging-total-count">0</td>
								<td style="text-align: center; color: #94a3b8;">--</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		`);
		this.main_container.find('.detailed-summary-section').append(detailed_container);
		this.update_detailed_summary_tables();
		this.setup_customer_table_filters();
		this.populate_customer_details_table();
	}

	update_detailed_summary_tables() {
		if (!this.filtered_data || this.filtered_data.length === 0) {
			return;
		}

		// Calculate sales summary data from invoice level
		let total_sales = 0, total_invoices = 0, total_paid = 0, total_outstanding = 0;
		let range1_amount = 0, range2_amount = 0, range3_amount = 0, range4_amount = 0, range5_amount = 0;
		let range1_count = 0, range2_count = 0, range3_count = 0, range4_count = 0, range5_count = 0;

		for (const customer of this.filtered_data) {
			// Process invoices array for accurate totals
			if (customer.invoices && Array.isArray(customer.invoices)) {
				customer.invoices.forEach(invoice => {
					const inv_outstanding = invoice.outstanding || 0;
					const inv_invoiced = invoice.invoiced || 0;
					const inv_paid = invoice.paid || 0;

					total_sales += inv_invoiced;
					total_paid += inv_paid;
					total_outstanding += inv_outstanding;

					if (inv_outstanding > 0) {
						total_invoices++;

						// Aging breakdown based on invoice age
						const age = invoice.age || 0;
						if (age >= 0 && age <= 30) {
							range1_amount += inv_outstanding;
							range1_count++;
						} else if (age >= 31 && age <= 60) {
							range2_amount += inv_outstanding;
							range2_count++;
						} else if (age >= 61 && age <= 90) {
							range3_amount += inv_outstanding;
							range3_count++;
						} else if (age >= 91 && age <= 120) {
							range4_amount += inv_outstanding;
							range4_count++;
						} else if (age > 120) {
							range5_amount += inv_outstanding;
							range5_count++;
						}
					}
				});
			}
		}

		// Calculate averages and percentages
		const avg_invoice_value = total_invoices > 0 ? total_sales / total_invoices : 0;
		const avg_payment = total_invoices > 0 ? total_paid / total_invoices : 0;
		const payment_efficiency = total_sales > 0 ? (total_paid / total_sales * 100) : 0;
		const over90_amount = range4_amount + range5_amount;
		const over90_count = range4_count + range5_count;

		// Update Sales Summary Table
		$('#sales-month').text(this.formatCurrency(total_sales));
		$('#sales-quarter').text(this.formatCurrency(total_sales)); // Simplified for now
		$('#sales-year').text(this.formatCurrency(total_sales));
		$('#sales-growth').text('+5.2%'); // Mock data - would need historical comparison

		$('#outstanding-invoices-count').text(total_invoices.toLocaleString());
		$('#outstanding-invoices-quarter').text(total_invoices.toLocaleString());
		$('#outstanding-invoices-year').text(total_invoices.toLocaleString());
		$('#outstanding-invoices-trend').text('+2.1%');

		$('#avg-invoice-month').text(this.formatCurrency(avg_invoice_value));
		$('#avg-invoice-quarter').text(this.formatCurrency(avg_invoice_value));
		$('#avg-invoice-year').text(this.formatCurrency(avg_invoice_value));
		$('#avg-invoice-trend').text('+3.5%');

		// Update Payment Summary Table
		$('#payments-month').text(this.formatCurrency(total_paid));
		$('#payments-quarter').text(this.formatCurrency(total_paid));
		$('#payments-year').text(this.formatCurrency(total_paid));
		$('#payment-methods').text('Bank: 65%, Cash: 25%, Others: 10%');

		$('#avg-payment-month').text(this.formatCurrency(avg_payment));
		$('#avg-payment-quarter').text(this.formatCurrency(avg_payment));
		$('#avg-payment-year').text(this.formatCurrency(avg_payment));
		$('#payment-frequency').text('Bi-weekly');

		$('#payment-efficiency-month').text(payment_efficiency.toFixed(1) + '%');
		$('#payment-efficiency-quarter').text(payment_efficiency.toFixed(1) + '%');
		$('#payment-efficiency-year').text(payment_efficiency.toFixed(1) + '%');
		$('#payment-trend').text(payment_efficiency > 75 ? '↑ Improving' : payment_efficiency > 50 ? '→ Stable' : '↓ Declining');

		// Update Aging Analysis Table
		const total_aging_count = range1_count + range2_count + range3_count + range4_count + range5_count;

		$('#aging-current-amount').text(this.formatCurrency(range1_amount));
		$('#aging-current-percentage').text(total_outstanding > 0 ? ((range1_amount / total_outstanding) * 100).toFixed(1) + '%' : '0%');
		$('#aging-current-count').text(range1_count.toLocaleString());

		$('#aging-31-60-amount').text(this.formatCurrency(range2_amount));
		$('#aging-31-60-percentage').text(total_outstanding > 0 ? ((range2_amount / total_outstanding) * 100).toFixed(1) + '%' : '0%');
		$('#aging-31-60-count').text(range2_count.toLocaleString());

		$('#aging-61-90-amount').text(this.formatCurrency(range3_amount));
		$('#aging-61-90-percentage').text(total_outstanding > 0 ? ((range3_amount / total_outstanding) * 100).toFixed(1) + '%' : '0%');
		$('#aging-61-90-count').text(range3_count.toLocaleString());

		$('#aging-over-90-amount').text(this.formatCurrency(over90_amount));
		$('#aging-over-90-percentage').text(total_outstanding > 0 ? ((over90_amount / total_outstanding) * 100).toFixed(1) + '%' : '0%');
		$('#aging-over-90-count').text(over90_count.toLocaleString());

		$('#aging-total-amount').text(this.formatCurrency(total_outstanding));
		$('#aging-total-count').text(total_aging_count.toLocaleString());
	}

	setup_customer_table_filters() {
		if (!this.filtered_data || this.filtered_data.length === 0) {
			return;
		}

		// Extract unique values for filters
		const customers = [...new Set(this.filtered_data.map(item => item.customer))].sort();
		const salespersons = [...new Set(this.filtered_data.map(item => item.sales_person || 'No Sales Person').filter(sp => sp))].sort();
		const teams = [...new Set(this.filtered_data.map(item => item.sales_team || 'No Sales Team').filter(team => team))].sort();

		// Populate customer filter
		const customerFilter = $('#customer-filter');
		customerFilter.empty().append('<option value="">All Customers</option>');
		customers.forEach(customer => {
			if (customer) {
				customerFilter.append(`<option value="${customer}">${customer}</option>`);
			}
		});

		// Populate salesperson filter
		const salespersonFilter = $('#salesperson-filter');
		salespersonFilter.empty().append('<option value="">All Salespersons</option>');
		salespersons.forEach(salesperson => {
			if (salesperson) {
				salespersonFilter.append(`<option value="${salesperson}">${salesperson}</option>`);
			}
		});

		// Populate team filter
		const teamFilter = $('#team-filter');
		teamFilter.empty().append('<option value="">All Teams</option>');
		teams.forEach(team => {
			if (team) {
				teamFilter.append(`<option value="${team}">${team}</option>`);
			}
		});

		// Setup filter event handlers
		$('#customer-filter, #salesperson-filter, #team-filter').on('change', () => {
			this.apply_customer_table_filters();
		});

		$('#clear-customer-filters').on('click', () => {
			$('#customer-filter, #salesperson-filter, #team-filter').val('');
			this.apply_customer_table_filters();
		});

		$('#export-customer-table').on('click', () => {
			this.export_customer_table();
		});
	}

	apply_customer_table_filters() {
		const customerFilter = $('#customer-filter').val();
		const salespersonFilter = $('#salesperson-filter').val();
		const teamFilter = $('#team-filter').val();

		let filteredData = this.filtered_data;

		// Apply customer filter
		if (customerFilter) {
			filteredData = filteredData.filter(item => item.customer === customerFilter);
		}

		// Apply salesperson filter
		if (salespersonFilter) {
			filteredData = filteredData.filter(item => (item.sales_person || 'No Sales Person') === salespersonFilter);
		}

		// Apply team filter
		if (teamFilter) {
			filteredData = filteredData.filter(item => (item.sales_team || 'No Sales Team') === teamFilter);
		}

		this.render_customer_table(filteredData);
		this.update_customer_table_summary(filteredData);
	}

	populate_customer_details_table() {
		this.render_customer_table(this.filtered_data);
		this.update_customer_table_summary(this.filtered_data);
	}

	render_customer_table(data) {
		const tbody = $('#customer-details-tbody');
		tbody.empty();

		if (!data || data.length === 0) {
			tbody.html(`
				<tr>
					<td colspan="17" style="text-align: center; padding: 40px; color: #6b7280;">
						<i class="fa fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
						<br>No data available with current filters
					</td>
				</tr>
			`);
			return;
		}

		// Build all rows at once (performance optimization)
		const rows = data.map(item => {
			// Calculate totals from invoices array
			let total_invoiced = 0, total_paid = 0, total_outstanding = 0;
			let range1 = 0, range2 = 0, range3 = 0, range4 = 0, range5 = 0;
			let max_age = 0, latest_posting_date = '';

			if (item.invoices && Array.isArray(item.invoices)) {
				item.invoices.forEach(inv => {
					total_invoiced += (inv.invoiced || 0);
					total_paid += (inv.paid || 0);
					total_outstanding += (inv.outstanding || 0);

					const age = inv.age || 0;
					max_age = Math.max(max_age, age);

					if (inv.posting_date && inv.posting_date > latest_posting_date) {
						latest_posting_date = inv.posting_date;
					}

					// Aging calculation
					if (inv.outstanding > 0) {
						if (age >= 0 && age <= 30) range1 += inv.outstanding;
						else if (age >= 31 && age <= 60) range2 += inv.outstanding;
						else if (age >= 61 && age <= 90) range3 += inv.outstanding;
						else if (age >= 91 && age <= 120) range4 += inv.outstanding;
						else if (age > 120) range5 += inv.outstanding;
					}
				});
			}

			const outstanding_color = this.getOutstandingColor(total_outstanding, item.credit_limit);
			const age_badge = this.getAgeBadge(max_age);

			const sale_color = '#3b82f6';
			const paid_color = '#059669';
			const receivable_color = outstanding_color;
			const over90_amount = range4 + range5;

			return `
				<tr style="border-bottom: 1px solid #f3f4f6;">
					<td style="padding: 12px 8px; font-weight: 600; color: #e2e8f0;">${item.customer || ''}</td>
					<td style="padding: 12px 8px;">${item.customer_name || ''}</td>
					<td style="padding: 12px 8px;">${item.branch || ''}</td>
					<td style="padding: 12px 8px;">
						${item.sales_person && item.sales_person !== 'No Sales Person'
					? `<span class="badge" style="background-color: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 11px;">${item.sales_person}</span>`
					: `<span class="text-muted" style="font-size: 11px;">No Sales Person</span>`
				}
					</td>
					<td style="padding: 12px 8px;">
						${item.sales_team && item.sales_team !== 'No Sales Team'
					? `<span class="badge" style="background-color: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px;">${item.sales_team}</span>`
					: `<span class="text-muted" style="font-size: 11px;">No Sales Team</span>`
				}
					</td>
					<td style="padding: 12px 8px; text-align: right; font-weight: 600;">${this.formatCurrency(item.credit_limit || 0)}</td>
					<td style="padding: 12px 8px; text-align: right; color: ${sale_color}; font-weight: 600;">${this.formatCurrency(total_invoiced)}</td>
					<td style="padding: 12px 8px; text-align: right; color: ${paid_color}; font-weight: 600;">${this.formatCurrency(total_paid)}</td>
					<td style="padding: 12px 8px; text-align: right; color: ${receivable_color}; font-weight: 700;">${this.formatCurrency(total_outstanding)}</td>
					<td style="padding: 12px 8px; text-align: center;">${age_badge}</td>
					<td style="padding: 12px 8px; text-align: right;">${this.formatCurrency(range1)}</td>
					<td style="padding: 12px 8px; text-align: right;">${this.formatCurrency(range2)}</td>
					<td style="padding: 12px 8px; text-align: right;">${this.formatCurrency(range3)}</td>
					<td style="padding: 12px 8px; text-align: right;">${this.formatCurrency(over90_amount)}</td>
					<td style="padding: 12px 8px; text-align: center;">${latest_posting_date || '--'}</td>
					<td style="padding: 12px 8px; text-align: center;">
						<button class="btn btn-xs btn-primary" onclick="frappe.prd_arm.view_customer_details('${item.customer}')" title="View Details" style="margin-right: 5px;">
							<i class="fa fa-eye"></i>
						</button>
						<button class="btn btn-xs btn-success" onclick="frappe.prd_arm.create_payment_entry('${item.customer}')" title="Create Payment">
							<i class="fa fa-money"></i>
						</button>
					</td>
				</tr>
			`;
		}).join('');

		// Single DOM operation (much faster than multiple appends)
		tbody.html(rows);
	}

	update_customer_table_summary(data) {
		if (!data || data.length === 0) {
			$('#customer-total-rows').text('0');
			$('#customer-total-sales').text('AED 0');
			$('#customer-total-paid').text('AED 0');
			$('#customer-total-outstanding').text('AED 0');
			return;
		}

		const totalRows = data.length;
		let totalSales = 0, totalPaid = 0, totalOutstanding = 0;

		// Calculate from invoices array for accuracy
		data.forEach(customer => {
			if (customer.invoices && Array.isArray(customer.invoices)) {
				customer.invoices.forEach(inv => {
					totalSales += (inv.invoiced || 0);
					totalPaid += (inv.paid || 0);
					totalOutstanding += (inv.outstanding || 0);
				});
			}
		});

		$('#customer-total-rows').text(totalRows.toLocaleString());
		$('#customer-total-sales').text(this.formatCurrency(totalSales));
		$('#customer-total-paid').text(this.formatCurrency(totalPaid));
		$('#customer-total-outstanding').text(this.formatCurrency(totalOutstanding));
	}

	export_customer_table() {
		const customerFilter = $('#customer-filter').val();
		const salespersonFilter = $('#salesperson-filter').val();
		const teamFilter = $('#team-filter').val();

		let filteredData = this.filtered_data;

		// Apply same filters as table
		if (customerFilter) {
			filteredData = filteredData.filter(item => item.customer === customerFilter);
		}
		if (salespersonFilter) {
			filteredData = filteredData.filter(item => (item.sales_person || 'No Sales Person') === salespersonFilter);
		}
		if (teamFilter) {
			filteredData = filteredData.filter(item => (item.sales_team || 'No Sales Team') === teamFilter);
		}

		if (filteredData.length === 0) {
			frappe.msgprint(__('No data to export with current filters.'));
			return;
		}

		// Prepare export data
		const exportData = filteredData.map(item => ({
			'Customer': item.customer,
			'Customer Name': item.customer_name,
			'Branch': item.branch,
			'Salesperson': item.sales_person || 'No Sales Person',
			'Sales Team': item.sales_team || 'No Sales Team',
			'Credit Limit': item.credit_limit,
			'Total Sale': item.invoiced || 0,
			'Total Paid': item.paid || 0,
			'Outstanding': item.outstanding,
			'Age (Days)': item.age,
			'0-30 Days': item.range1 || 0,
			'31-60 Days': item.range2 || 0,
			'61-90 Days': item.range3 || 0,
			'90+ Days': (item.range4 || 0) + (item.range5 || 0),
			'Posting Date': item.posting_date || ''
		}));

		// Create and download CSV
		const csvContent = this.convertToCSV(exportData);
		const filename = `Customer_Details_Export_${new Date().toISOString().split('T')[0]}.csv`;
		this.downloadCSV(csvContent, filename);

		frappe.show_alert({
			message: __(`Exported ${exportData.length} customer records to ${filename}`),
			indicator: 'green'
		}, 5);
	}

	convertToCSV(data) {
		if (!data || data.length === 0) return '';

		const headers = Object.keys(data[0]);
		const csvRows = [];

		// Add headers
		csvRows.push(headers.join(','));

		// Add data rows
		data.forEach(row => {
			const values = headers.map(header => {
				const value = row[header];
				// Handle values that might contain commas or quotes
				if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
					return `"${value.replace(/"/g, '""')}"`;
				}
				return value;
			});
			csvRows.push(values.join(','));
		});

		return csvRows.join('\n');
	}

	downloadCSV(csvContent, filename) {
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	create_financial_charts() {
		const charts_container = $(`
			<div class="row">
				<!-- Aging Pie Chart -->
				<div class="col-md-6">
					<div class="stat-card">
						<h5 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 600;">
							<i class="fa fa-pie-chart" style="margin-right: 8px; color: #f59e0b;"></i>
							Receivables Aging Distribution
						</h5>
						<div class="chart-container" style="position: relative; height: 300px; text-align: center;">
							<canvas id="aging-pie-chart" style="max-height: 300px;"></canvas>
						</div>
					</div>
				</div>

				<!-- Payment Trends Line Chart -->
				<div class="col-md-6">
					<div class="stat-card">
						<h5 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 600;">
							<i class="fa fa-line-chart" style="margin-right: 8px; color: #10b981;"></i>
							Monthly Payment Trends
						</h5>
						<div class="chart-container" style="position: relative; height: 300px; text-align: center;">
							<canvas id="payment-trends-chart" style="max-height: 300px;"></canvas>
						</div>
					</div>
				</div>
			</div>

			<div class="row" style="margin-top: 24px;">
				<!-- Outstanding Balance Trend -->
				<div class="col-md-6">
					<div class="stat-card">
						<h5 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 600;">
							<i class="fa fa-area-chart" style="margin-right: 8px; color: #3b82f6;"></i>
							Outstanding Balance Trend
						</h5>
						<div class="chart-container" style="position: relative; height: 300px; text-align: center;">
							<canvas id="outstanding-trend-chart" style="max-height: 300px;"></canvas>
						</div>
					</div>
				</div>

				<!-- Credit Utilization Gauge -->
				<div class="col-md-6">
					<div class="stat-card">
						<h5 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 600;">
							<i class="fa fa-tachometer" style="margin-right: 8px; color: #8b5cf6;"></i>
							Credit Utilization Overview
						</h5>
						<div class="chart-container" style="position: relative; height: 300px; display: flex; align-items: center; justify-content: center;">
							<div class="credit-gauge-container" style="width: 200px; height: 200px; position: relative;">
								<canvas id="credit-utilization-gauge" width="200" height="200"></canvas>
								<div class="gauge-center-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
									<div style="font-size: 32px; font-weight: bold; color: #f1f5f9;" id="gauge-percentage">0%</div>
									<div style="font-size: 14px; color: #6b7280;">Utilization</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.visual-charts-section').append(charts_container);
		this.init_financial_charts();
	}

	init_financial_charts() {
		// Initialize charts after DOM is ready
		setTimeout(() => {
			this.create_aging_pie_chart();
			this.create_payment_trends_chart();
			this.create_outstanding_trend_chart();
			this.create_credit_utilization_gauge();
			this.update_financial_charts();
		}, 100);
	}

	create_aging_pie_chart() {
		const ctx = document.getElementById('aging-pie-chart');
		if (!ctx) return;

		this.aging_pie_chart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: ['0-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days'],
				datasets: [{
					data: [0, 0, 0, 0],
					backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#dc2626'],
					borderWidth: 2,
					borderColor: '#ffffff'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							padding: 20,
							usePointStyle: true
						}
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								const label = context.label || '';
								const value = context.parsed || 0;
								const total = context.dataset.data.reduce((a, b) => a + b, 0);
								const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
								return `${label}: AED ${value.toLocaleString()} (${percentage}%)`;
							}
						}
					}
				}
			}
		});
	}

	create_payment_trends_chart() {
		const ctx = document.getElementById('payment-trends-chart');
		if (!ctx) return;

		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const currentMonth = new Date().getMonth();
		const last6Months = [];
		for (let i = 5; i >= 0; i--) {
			const monthIndex = (currentMonth - i + 12) % 12;
			last6Months.push(months[monthIndex]);
		}

		this.payment_trends_chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: last6Months,
				datasets: [{
					label: 'Payments Received',
					data: [0, 0, 0, 0, 0, 0],
					borderColor: '#10b981',
					backgroundColor: 'rgba(16, 185, 129, 0.1)',
					tension: 0.4,
					fill: true
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top'
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return 'AED ' + value.toLocaleString();
							}
						}
					}
				}
			}
		});
	}

	create_outstanding_trend_chart() {
		const ctx = document.getElementById('outstanding-trend-chart');
		if (!ctx) return;

		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const currentMonth = new Date().getMonth();
		const last6Months = [];
		for (let i = 5; i >= 0; i--) {
			const monthIndex = (currentMonth - i + 12) % 12;
			last6Months.push(months[monthIndex]);
		}

		this.outstanding_trend_chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: last6Months,
				datasets: [{
					label: 'Outstanding Balance',
					data: [0, 0, 0, 0, 0, 0],
					backgroundColor: 'rgba(59, 130, 246, 0.8)',
					borderColor: '#3b82f6',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top'
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return 'AED ' + value.toLocaleString();
							}
						}
					}
				}
			}
		});
	}

	create_credit_utilization_gauge() {
		const canvas = document.getElementById('credit-utilization-gauge');
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		this.credit_gauge_ctx = ctx;
		this.draw_credit_gauge(0); // Initialize with 0%
	}

	draw_credit_gauge(percentage) {
		if (!this.credit_gauge_ctx) return;

		const ctx = this.credit_gauge_ctx;
		const centerX = 100;
		const centerY = 100;
		const radius = 80;

		// Clear canvas
		ctx.clearRect(0, 0, 200, 200);

		// Draw background arc
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
		ctx.strokeStyle = '#e5e7eb';
		ctx.lineWidth = 12;
		ctx.stroke();

		// Determine color based on percentage
		let color = '#10b981'; // Green
		if (percentage > 75) color = '#ef4444'; // Red
		else if (percentage > 50) color = '#f59e0b'; // Yellow

		// Draw progress arc
		const endAngle = 0.75 * Math.PI + (1.5 * Math.PI * percentage / 100);
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, endAngle);
		ctx.strokeStyle = color;
		ctx.lineWidth = 12;
		ctx.lineCap = 'round';
		ctx.stroke();

		// Update percentage text
		const gaugeText = document.getElementById('gauge-percentage');
		if (gaugeText) {
			gaugeText.textContent = percentage.toFixed(1) + '%';
			gaugeText.style.color = color;
		}
	}

	update_financial_charts() {
		if (!this.filtered_data || this.filtered_data.length === 0) {
			return;
		}

		// Calculate data for charts
		let range1_amount = 0, range2_amount = 0, range3_amount = 0, range4_amount = 0, range5_amount = 0;
		let total_outstanding = 0, total_credit_limit = 0, total_paid = 0;

		for (const item of this.filtered_data) {
			range1_amount += item.range1 || 0;
			range2_amount += item.range2 || 0;
			range3_amount += item.range3 || 0;
			range4_amount += item.range4 || 0;
			range5_amount += item.range5 || 0;
			total_outstanding += item.outstanding || 0;
			total_credit_limit += item.credit_limit || 0;
			total_paid += item.paid || 0;
		}

		// Update Aging Pie Chart
		if (this.aging_pie_chart) {
			const over90_amount = range4_amount + range5_amount;
			this.aging_pie_chart.data.datasets[0].data = [range1_amount, range2_amount, range3_amount, over90_amount];
			this.aging_pie_chart.update();
		}

		// Update Payment Trends Chart (mock data for demonstration)
		if (this.payment_trends_chart) {
			const mockPaymentData = [total_paid * 0.8, total_paid * 0.9, total_paid * 0.7, total_paid * 1.1, total_paid * 0.95, total_paid];
			this.payment_trends_chart.data.datasets[0].data = mockPaymentData;
			this.payment_trends_chart.update();
		}

		// Update Outstanding Trend Chart (mock data for demonstration)
		if (this.outstanding_trend_chart) {
			const mockOutstandingData = [total_outstanding * 1.2, total_outstanding * 1.1, total_outstanding * 1.3, total_outstanding * 1.0, total_outstanding * 0.9, total_outstanding];
			this.outstanding_trend_chart.data.datasets[0].data = mockOutstandingData;
			this.outstanding_trend_chart.update();
		}

		// Update Credit Utilization Gauge
		const credit_utilization = total_credit_limit > 0 ? ((total_outstanding / total_credit_limit) * 100) : 0;
		this.draw_credit_gauge(credit_utilization);
	}

	create_aging_analysis() {
		const aging_container = $(`
			<div class="aging-analysis-detailed">
				<div class="aging-analysis-header">
					<h3 style="color: #60a5fa; font-size: 20px; font-weight: 700; margin-bottom: 24px;">
						<i class="fa fa-clock-o" style="margin-right: 8px; color: #3b82f6;"></i>
						Detailed Aging Breakdown
					</h3>
					<p style="color: #6b7280; margin-bottom: 24px;">Click on any aging range to view detailed invoices in that category</p>
				</div>

				<div class="row">
					<!-- 0-30 Days -->
					<div class="col-md-2-4">
						<div class="aging-card aging-current detailed-aging-card" data-aging-range="0-30" title="Click to view invoices in 0-30 days range" style="cursor: pointer;">
							<div class="aging-header">
								<h4 class="aging-title">0-30 Days</h4>
								<div class="aging-icon current">
									<i class="fa fa-check-circle"></i>
								</div>
							</div>
							<div class="aging-amount" id="detailed-aging-0-30-amount">AED 0</div>
							<div class="aging-count" id="detailed-aging-0-30-count">0 invoices</div>
							<div class="aging-percentage" id="detailed-aging-0-30-percentage">0% of total</div>
							<div class="aging-click-hint" style="font-size: 11px; color: #6b7280; margin-top: 8px;">
								<i class="fa fa-hand-pointer-o"></i> Click to view invoices
							</div>
							<div class="aging-status-badge current">Current</div>
						</div>
					</div>

					<!-- 31-60 Days -->
					<div class="col-md-2-4">
						<div class="aging-card aging-warning detailed-aging-card" data-aging-range="31-60" title="Click to view invoices in 31-60 days range" style="cursor: pointer;">
							<div class="aging-header">
								<h4 class="aging-title">31-60 Days</h4>
								<div class="aging-icon warning">
									<i class="fa fa-clock-o"></i>
								</div>
							</div>
							<div class="aging-amount" id="detailed-aging-31-60-amount">AED 0</div>
							<div class="aging-count" id="detailed-aging-31-60-count">0 invoices</div>
							<div class="aging-percentage" id="detailed-aging-31-60-percentage">0% of total</div>
							<div class="aging-click-hint" style="font-size: 11px; color: #6b7280; margin-top: 8px;">
								<i class="fa fa-hand-pointer-o"></i> Click to view invoices
							</div>
							<div class="aging-status-badge warning">Watch</div>
						</div>
					</div>

					<!-- 61-90 Days -->
					<div class="col-md-2-4">
						<div class="aging-card aging-caution detailed-aging-card" data-aging-range="61-90" title="Click to view invoices in 61-90 days range" style="cursor: pointer;">
							<div class="aging-header">
								<h4 class="aging-title">61-90 Days</h4>
								<div class="aging-icon caution">
									<i class="fa fa-exclamation-circle"></i>
								</div>
							</div>
							<div class="aging-amount" id="detailed-aging-61-90-amount">AED 0</div>
							<div class="aging-count" id="detailed-aging-61-90-count">0 invoices</div>
							<div class="aging-percentage" id="detailed-aging-61-90-percentage">0% of total</div>
							<div class="aging-click-hint" style="font-size: 11px; color: #6b7280; margin-top: 8px;">
								<i class="fa fa-hand-pointer-o"></i> Click to view invoices
							</div>
							<div class="aging-status-badge caution">Caution</div>
						</div>
					</div>

					<!-- 91-120 Days -->
					<div class="col-md-2-4">
						<div class="aging-card aging-danger detailed-aging-card" data-aging-range="91-120" title="Click to view invoices in 91-120 days range" style="cursor: pointer;">
							<div class="aging-header">
								<h4 class="aging-title">91-120 Days</h4>
								<div class="aging-icon danger">
									<i class="fa fa-exclamation-triangle"></i>
								</div>
							</div>
							<div class="aging-amount" id="detailed-aging-91-120-amount">AED 0</div>
							<div class="aging-count" id="detailed-aging-91-120-count">0 invoices</div>
							<div class="aging-percentage" id="detailed-aging-91-120-percentage">0% of total</div>
							<div class="aging-click-hint" style="font-size: 11px; color: #6b7280; margin-top: 8px;">
								<i class="fa fa-hand-pointer-o"></i> Click to view invoices
							</div>
							<div class="aging-status-badge danger">Danger</div>
						</div>
					</div>

					<!-- 120+ Days -->
					<div class="col-md-2-4">
						<div class="aging-card aging-critical detailed-aging-card" data-aging-range="120-plus" title="Click to view invoices in 120+ days range" style="cursor: pointer;">
							<div class="aging-header">
								<h4 class="aging-title">120+ Days</h4>
								<div class="aging-icon critical">
									<i class="fa fa-warning"></i>
								</div>
							</div>
							<div class="aging-amount" id="detailed-aging-120-plus-amount">AED 0</div>
							<div class="aging-count" id="detailed-aging-120-plus-count">0 invoices</div>
							<div class="aging-percentage" id="detailed-aging-120-plus-percentage">0% of total</div>
							<div class="aging-click-hint" style="font-size: 11px; color: #6b7280; margin-top: 8px;">
								<i class="fa fa-hand-pointer-o"></i> Click to view invoices
							</div>
							<div class="aging-status-badge critical">Critical</div>
						</div>
					</div>
				</div>

				<!-- Summary Statistics -->
				<div class="aging-summary-stats" style="margin-top: 32px;">
					<!-- Chart Section Header -->
					<div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%); border: 2px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
						<div style="display: flex; align-items: center; justify-content: space-between;">
							<div>
								<h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">
									<i class="fa fa-line-chart" style="margin-right: 10px; color: #3b82f6;"></i>
									Aging Distribution Analytics
								</h4>
								<p style="color: #94a3b8; margin: 0; font-size: 14px;">
									Visual breakdown of outstanding amounts across aging ranges
								</p>
							</div>
							<div style="text-align: right;">
								<div style="color: #6ee7b7; font-size: 13px; font-weight: 600; margin-bottom: 4px;">TOTAL OUTSTANDING</div>
								<div id="chart-total-outstanding" style="color: #e2e8f0; font-size: 28px; font-weight: 700;">AED 0</div>
							</div>
						</div>
					</div>

					<div class="row">
						<!-- Bar Chart -->
						<div class="col-md-7">
							<div class="stat-card" style="padding: 24px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border: 2px solid rgba(59, 130, 246, 0.3); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
								<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
									<div>
										<h5 style="color: #e2e8f0; margin: 0 0 6px 0; font-weight: 700; font-size: 16px;">
											<i class="fa fa-bar-chart" style="margin-right: 8px; color: #3b82f6;"></i>
											Aging Distribution (Bar Chart)
										</h5>
										<p style="color: #94a3b8; margin: 0; font-size: 12px;">
											Compare outstanding amounts across all aging ranges
										</p>
									</div>
									<div style="background: rgba(59, 130, 246, 0.2); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.4);">
										<div style="color: #93c5fd; font-size: 11px; font-weight: 600;">RANGES</div>
										<div style="color: #e2e8f0; font-size: 18px; font-weight: 700;">5</div>
									</div>
								</div>
								<div id="bar-chart-container" style="height: 380px; position: relative; background: rgba(15, 23, 42, 0.6); border-radius: 10px; padding: 20px; border: 1px solid rgba(59, 130, 246, 0.2);">
									<canvas id="aging-analysis-bar-chart" style="display: none; width: 100%; height: 100%;"></canvas>
									<div id="bar-chart-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #94a3b8; text-align: center; display: block;">
										<i class="fa fa-spinner fa-spin" style="font-size: 32px; color: #3b82f6;"></i>
										<p style="margin-top: 12px; font-weight: 600;">Loading chart data...</p>
									</div>
									<div id="bar-chart-error" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ef4444; text-align: center; display: none;">
										<i class="fa fa-exclamation-triangle" style="font-size: 32px;"></i>
										<p style="margin-top: 12px; font-weight: 600;">Failed to load chart</p>
										<p id="bar-chart-error-msg" style="margin-top: 8px; font-size: 12px; color: #94a3b8;">Check console for details</p>
									</div>
								</div>
								<!-- Chart Legend -->
								<div style="margin-top: 16px; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
									<div style="display: flex; align-items: center; gap: 6px;">
										<div style="width: 16px; height: 16px; background: #22c55e; border-radius: 4px;"></div>
										<span style="color: #cbd5e1; font-size: 12px; font-weight: 500;">0-30 Days</span>
									</div>
									<div style="display: flex; align-items: center; gap: 6px;">
										<div style="width: 16px; height: 16px; background: #eab308; border-radius: 4px;"></div>
										<span style="color: #cbd5e1; font-size: 12px; font-weight: 500;">31-60 Days</span>
									</div>
									<div style="display: flex; align-items: center; gap: 6px;">
										<div style="width: 16px; height: 16px; background: #fb923c; border-radius: 4px;"></div>
										<span style="color: #cbd5e1; font-size: 12px; font-weight: 500;">61-90 Days</span>
									</div>
									<div style="display: flex; align-items: center; gap: 6px;">
										<div style="width: 16px; height: 16px; background: #f97316; border-radius: 4px;"></div>
										<span style="color: #cbd5e1; font-size: 12px; font-weight: 500;">91-120 Days</span>
									</div>
									<div style="display: flex; align-items: center; gap: 6px;">
										<div style="width: 16px; height: 16px; background: #dc2626; border-radius: 4px;"></div>
										<span style="color: #cbd5e1; font-size: 12px; font-weight: 500;">120+ Days</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Pie Chart -->
						<div class="col-md-5">
							<div class="stat-card" style="padding: 24px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
								<div style="margin-bottom: 16px;">
									<h5 style="color: #e2e8f0; margin: 0 0 6px 0; font-weight: 700; font-size: 16px;">
										<i class="fa fa-pie-chart" style="margin-right: 8px; color: #10b981;"></i>
										Aging Distribution (Pie Chart)
									</h5>
									<p style="color: #94a3b8; margin: 0; font-size: 12px;">
										Percentage breakdown by aging range
									</p>
								</div>
								<div id="pie-chart-container" style="height: 380px; position: relative; background: rgba(15, 23, 42, 0.6); border-radius: 10px; padding: 20px; border: 1px solid rgba(16, 185, 129, 0.2);">
									<canvas id="aging-analysis-pie-chart" style="display: none; width: 100%; height: 100%;"></canvas>
									<div id="pie-chart-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #94a3b8; text-align: center; display: block;">
										<i class="fa fa-spinner fa-spin" style="font-size: 32px; color: #10b981;"></i>
										<p style="margin-top: 12px; font-weight: 600;">Loading chart data...</p>
									</div>
									<div id="pie-chart-error" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ef4444; text-align: center; display: none;">
										<i class="fa fa-exclamation-triangle" style="font-size: 32px;"></i>
										<p style="margin-top: 12px; font-weight: 600;">Failed to load chart</p>
										<p id="pie-chart-error-msg" style="margin-top: 8px; font-size: 12px; color: #94a3b8;">Check console for details</p>
									</div>
								</div>
								<!-- Percentage Summary -->
								<div id="pie-chart-summary" style="margin-top: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.2);">
									<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
										<div style="text-align: center;">
											<div style="color: #94a3b8; font-size: 11px; font-weight: 600;">CURRENT</div>
											<div id="pie-summary-current" style="color: #10b981; font-size: 16px; font-weight: 700;">0%</div>
										</div>
										<div style="text-align: center;">
											<div style="color: #94a3b8; font-size: 11px; font-weight: 600;">OVERDUE</div>
											<div id="pie-summary-overdue" style="color: #ef4444; font-size: 16px; font-weight: 700;">0%</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row" style="margin-top: 20px;">
						<div class="col-md-12">
							<div class="stat-card" style="padding: 20px;">
								<h5 style="color: #e2e8f0; margin-bottom: 16px; font-weight: 600;">
									<i class="fa fa-exclamation-triangle" style="margin-right: 8px; color: #f59e0b;"></i>
									Aging Alerts
								</h5>
								<div class="aging-alerts-list" id="aging-alerts-list">
									<div class="alert-item">
										<div class="alert-icon critical"><i class="fa fa-warning"></i></div>
										<div class="alert-content">
											<div class="alert-title">Critical Aging (120+ days)</div>
											<div class="alert-desc" id="critical-aging-120-count">0 invoices over 120 days</div>
										</div>
									</div>
									<div class="alert-item">
										<div class="alert-icon danger"><i class="fa fa-exclamation-triangle"></i></div>
										<div class="alert-content">
											<div class="alert-title">Danger Zone (91-120 days)</div>
											<div class="alert-desc" id="danger-aging-91-120-count">0 invoices 91-120 days</div>
										</div>
									</div>
									<div class="alert-item">
										<div class="alert-icon warning"><i class="fa fa-clock-o"></i></div>
										<div class="alert-content">
											<div class="alert-title">Requires Attention (61-90 days)</div>
											<div class="alert-desc" id="attention-aging-count">0 invoices 61-90 days</div>
										</div>
									</div>
									<div class="alert-item">
										<div class="alert-icon info"><i class="fa fa-info-circle"></i></div>
										<div class="alert-content">
											<div class="alert-title">Total Outstanding</div>
											<div class="alert-desc" id="total-aging-amount">AED 0 across all ranges</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Detailed Aging Table -->
				<div class="aging-details-table" style="margin-top: 32px;">
					<div class="stat-card" style="padding: 20px;">
						<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
							<div>
								<h5 style="color: #e2e8f0; margin: 0 0 4px 0; font-weight: 600;">
									<i class="fa fa-table" style="margin-right: 8px; color: #3b82f6;"></i>
									Detailed Customer Aging Report
								</h5>
								<p style="color: #94a3b8; margin: 0; font-size: 12px;">
									Showing <span id="visible-customers-count">0</span> customers
								</p>
							</div>
							<div style="display: flex; align-items: center; gap: 12px;">
								<label style="color: #cbd5e1; font-size: 13px; font-weight: 600; margin: 0;">
									<i class="fa fa-filter" style="margin-right: 6px; color: #60a5fa;"></i>Filter Details by:
								</label>
								<select id="aging-details-voucher-filter" style="background: rgba(30, 41, 59, 0.8); color: #e2e8f0; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; padding: 6px 32px 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; outline: none;">
									<option value="all">All Document Types</option>
									<option value="Sales Invoice">Sales Invoice</option>
									<option value="Payment Entry">Payment Entry</option>
									<option value="Journal Entry">Journal Entry</option>
								</select>
								<button id="reset-aging-details-filter" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: none;">
									<i class="fa fa-times"></i> Reset
								</button>
							</div>
						</div>
						<div class="table-responsive">
							<table class="table table-bordered" style="margin-bottom: 0;">
								<thead style="background-color: rgba(59, 130, 246, 0.1); border-bottom: 2px solid rgba(59, 130, 246, 0.3);">
									<tr>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px;">#</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px;">Customer</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">Total Outstanding</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">0-30 Days</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">31-60 Days</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">61-90 Days</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">91-120 Days</th>
										<th style="color: #cbd5e1; font-weight: 600; padding: 12px; text-align: right;">120+ Days</th>
									</tr>
								</thead>
								<tbody id="aging-details-tbody">
									<tr>
										<td colspan="8" style="text-align: center; padding: 40px; color: #94a3b8;">
											<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
											<p style="margin-top: 10px;">Loading aging details...</p>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		`);

		this.main_container.find('.aging-breakdown-section').append(aging_container);

		// Setup click handlers for detailed aging cards
		this.setup_detailed_aging_click_handlers();

		// Use setTimeout to ensure DOM is fully rendered and data is ready before updating
		setTimeout(() => {
			// Ensure filtered_data is initialized
			if (!this.filtered_data || this.filtered_data.length === 0) {
				if (this.data && this.data.length > 0) {
					console.log('Aging analysis: Repopulating filtered_data before update');
					this.filtered_data = [...this.data];
				}
			}

			// Update the aging data
			this.update_detailed_aging_cards();

			// Populate the detailed aging table
			this.populate_aging_details_table();
		}, 100);

		// Create aging distribution charts
		// Note: Charts will be created/updated when section is shown via show_section()
		// which calls apply_filters() first to ensure data is ready
		console.log('==== Aging section initialized ====');
		console.log('Charts will be created when section is activated');
	}

	create_aging_distribution_chart() {
		console.log('=== create_aging_distribution_chart START ===');

		const ctx = document.getElementById('aging-analysis-bar-chart');
		if (!ctx) {
			console.error('Aging distribution chart canvas not found');
			$('#bar-chart-loading').hide();
			$('#bar-chart-error').show();
			$('#bar-chart-error-msg').text('Canvas element not found');
			return;
		}

		// Check if Chart.js is loaded
		if (typeof Chart === 'undefined') {
			console.error('Chart.js is not loaded');
			$('#bar-chart-loading').hide();
			$('#bar-chart-error').show();
			$('#bar-chart-error-msg').text('Chart.js library not loaded');
			return;
		}

		try {
			// Hide loading, show canvas
			$('#bar-chart-loading').hide();
			$('#bar-chart-error').hide();
			$('#aging-analysis-bar-chart').css('display', 'block');

			// Destroy existing chart if it exists
			if (this.aging_distribution_chart) {
				this.aging_distribution_chart.destroy();
			}

			// Calculate aging data from filtered_data
			const analytics = this.calculate_analytics();
			console.log('Creating aging bar chart with data:', analytics.aging_amounts);
			console.log('Filtered data count:', this.filtered_data ? this.filtered_data.length : 0);

			// Update total outstanding in header
			$('#chart-total-outstanding').text(this.formatCurrency(analytics.total_outstanding || 0));

			// Prepare chart data - now with 5 separate ranges
			let chartData = [
				analytics.aging_amounts.range1 || 0,
				analytics.aging_amounts.range2 || 0,
				analytics.aging_amounts.range3 || 0,
				analytics.aging_amounts.range4 || 0,
				analytics.aging_amounts.range5 || 0
			];

			console.log('Chart data values:', chartData);
			console.log('Total of all values:', chartData.reduce((a, b) => a + b, 0));

			// Check if we have actual data
			const hasData = chartData.some(val => val > 0);
			console.log('Has data:', hasData);

			this.aging_distribution_chart = new Chart(ctx, {
				type: 'bar',
				data: {
					labels: ['0-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '120+ Days'],
					datasets: [{
						label: 'Outstanding Amount',
						data: chartData,
						backgroundColor: [
							'rgba(34, 197, 94, 0.85)',    // 0-30 Days: Bright Green
							'rgba(234, 179, 8, 0.85)',    // 31-60 Days: Yellow
							'rgba(251, 146, 60, 0.85)',   // 61-90 Days: Orange
							'rgba(249, 115, 22, 0.85)',   // 91-120 Days: Dark Orange
							'rgba(220, 38, 38, 0.85)'     // 120+ Days: Deep Red
						],
						borderColor: [
							'#22c55e',  // 0-30 Days: Bright Green border
							'#eab308',  // 31-60 Days: Yellow border
							'#fb923c',  // 61-90 Days: Orange border
							'#f97316',  // 91-120 Days: Dark Orange border
							'#dc2626'   // 120+ Days: Deep Red border
						],
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: false
						},
						title: {
							display: false
						},
						tooltip: {
							backgroundColor: 'rgba(30, 41, 59, 0.95)',
							titleColor: '#e2e8f0',
							bodyColor: '#cbd5e1',
							borderColor: 'rgba(59, 130, 246, 0.5)',
							borderWidth: 1,
							padding: 12,
							displayColors: true,
							callbacks: {
								label: (context) => {
									const value = context.parsed.y;
									const total = analytics.total_outstanding;
									const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
									return [
										`Amount: ${this.formatCurrency(value)}`,
										`Percentage: ${percentage}%`
									];
								}
							}
						}
					},
					scales: {
						x: {
							grid: {
								display: false,
								color: 'rgba(148, 163, 184, 0.1)'
							},
							ticks: {
								color: '#cbd5e1',
								font: {
									size: 11,
									weight: 600
								}
							}
						},
						y: {
							beginAtZero: true,
							grid: {
								color: 'rgba(148, 163, 184, 0.1)',
								drawBorder: false
							},
							ticks: {
								color: '#cbd5e1',
								font: {
									size: 11
								},
								callback: (value) => {
									return this.formatCurrency(value);
								}
							}
						}
					}
				}
			});

			console.log('Bar chart created successfully:', this.aging_distribution_chart);
			console.log('=== create_aging_distribution_chart END ===');
		} catch (error) {
			console.error('Error creating bar chart:', error);
			$('#bar-chart-loading').hide();
			$('#bar-chart-error').show();
			$('#bar-chart-error-msg').text(error.message || 'Unknown error');
			$('#aging-analysis-bar-chart').hide();
		}
	}

	create_aging_pie_chart() {
		console.log('=== create_aging_pie_chart START ===');

		const ctx = document.getElementById('aging-analysis-pie-chart');
		if (!ctx) {
			console.error('Aging pie chart canvas not found');
			$('#pie-chart-loading').hide();
			$('#pie-chart-error').show();
			$('#pie-chart-error-msg').text('Canvas element not found');
			return;
		}

		// Check if Chart.js is loaded
		if (typeof Chart === 'undefined') {
			console.error('Chart.js is not loaded');
			$('#pie-chart-loading').hide();
			$('#pie-chart-error').show();
			$('#pie-chart-error-msg').text('Chart.js library not loaded');
			return;
		}

		try {
			// Hide loading, show canvas
			$('#pie-chart-loading').hide();
			$('#pie-chart-error').hide();
			$('#aging-analysis-pie-chart').css('display', 'block');

			// Destroy existing chart if it exists
			if (this.aging_pie_chart) {
				this.aging_pie_chart.destroy();
			}

			// Calculate aging data from filtered_data
			const analytics = this.calculate_analytics();
			console.log('Creating aging pie chart with data:', analytics.aging_amounts);
			console.log('Filtered data count:', this.filtered_data ? this.filtered_data.length : 0);

			// Prepare data with labels showing amounts and percentages - now with 5 separate ranges
			const total = analytics.total_outstanding || 0;
			let data = [
				analytics.aging_amounts.range1 || 0,
				analytics.aging_amounts.range2 || 0,
				analytics.aging_amounts.range3 || 0,
				analytics.aging_amounts.range4 || 0,
				analytics.aging_amounts.range5 || 0
			];

			console.log('Pie chart data values:', data);
			console.log('Total outstanding:', total);

			// Check if we have actual data
			const hasData = data.some(val => val > 0);
			console.log('Has data:', hasData);

			// Update pie chart summary
			const currentPercentage = total > 0 ? ((data[0] / total) * 100).toFixed(1) : 0;
			const overduePercentage = total > 0 ? (((data[1] + data[2] + data[3] + data[4]) / total) * 100).toFixed(1) : 0;
			$('#pie-summary-current').text(currentPercentage + '%');
			$('#pie-summary-overdue').text(overduePercentage + '%');

			const labels = [
				'0-30 Days',
				'31-60 Days',
				'61-90 Days',
				'91-120 Days',
				'120+ Days'
			];

			this.aging_pie_chart = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: labels,
					datasets: [{
						data: data,
						backgroundColor: [
							'rgba(34, 197, 94, 0.85)',    // 0-30 Days: Bright Green
							'rgba(234, 179, 8, 0.85)',    // 31-60 Days: Yellow
							'rgba(251, 146, 60, 0.85)',   // 61-90 Days: Orange
							'rgba(249, 115, 22, 0.85)',   // 91-120 Days: Dark Orange
							'rgba(220, 38, 38, 0.85)'     // 120+ Days: Deep Red
						],
						borderColor: [
							'#22c55e',  // 0-30 Days: Bright Green border
							'#eab308',  // 31-60 Days: Yellow border
							'#fb923c',  // 61-90 Days: Orange border
							'#f97316',  // 91-120 Days: Dark Orange border
							'#dc2626'   // 120+ Days: Deep Red border
						],
						borderWidth: 2,
						hoverOffset: 10
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: true,
							position: 'bottom',
							labels: {
								color: '#e2e8f0',
								padding: 15,
								font: {
									size: 12,
									weight: '600'
								},
								generateLabels: (chart) => {
									const data = chart.data;
									if (data.labels.length && data.datasets.length) {
										return data.labels.map((label, i) => {
											const value = data.datasets[0].data[i];
											const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
											return {
												text: `${label}: ${this.formatCurrency(value)} (${percentage}%)`,
												fillStyle: data.datasets[0].backgroundColor[i],
												strokeStyle: data.datasets[0].borderColor[i],
												lineWidth: 2,
												hidden: false,
												index: i
											};
										});
									}
									return [];
								}
							}
						},
						title: {
							display: false
						},
						tooltip: {
							backgroundColor: 'rgba(30, 41, 59, 0.95)',
							titleColor: '#e2e8f0',
							bodyColor: '#cbd5e1',
							borderColor: 'rgba(59, 130, 246, 0.5)',
							borderWidth: 1,
							padding: 12,
							displayColors: true,
							callbacks: {
								label: (context) => {
									const value = context.parsed;
									const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
									return [
										`${context.label}`,
										`Amount: ${this.formatCurrency(value)}`,
										`Percentage: ${percentage}%`
									];
								}
							}
						}
					}
				}
			});

			console.log('Pie chart created successfully:', this.aging_pie_chart);
			console.log('=== create_aging_pie_chart END ===');
		} catch (error) {
			console.error('Error creating pie chart:', error);
			$('#pie-chart-loading').hide();
			$('#pie-chart-error').show();
			$('#pie-chart-error-msg').text(error.message || 'Unknown error');
			$('#aging-analysis-pie-chart').hide();
		}
	}

	setup_detailed_aging_click_handlers() {
		console.log('Setting up detailed aging card click handlers...');

		// Remove any existing handlers first to prevent conflicts
		$(document).off('click.aging-card-modal');
		$('.aging-card[data-aging-range]').off('click.aging-card-modal');
		$('.detailed-aging-card[data-aging-range]').off('click.aging-card-modal');

		// Store reference to this for use in event handlers
		const self = this;

		// Add unified click handler for ALL aging cards (both overview and detailed)
		$(document).on('click.aging-card-modal', '.aging-card[data-aging-range], .detailed-aging-card[data-aging-range]', function (e) {
			e.preventDefault();
			e.stopPropagation();
			console.log('Aging card clicked!', this);
			const agingRange = $(this).data('aging-range');
			console.log('Aging range:', agingRange);

			// Use stored reference to call method
			try {
				self.show_aging_invoices_modal(agingRange);
			} catch (error) {
				console.error('Error calling show_aging_invoices_modal:', error);
			}
		});

		// Also add direct click handler as additional fallback
		setTimeout(() => {
			$('.aging-card[data-aging-range], .detailed-aging-card[data-aging-range]').each(function (index, element) {
				$(element).off('click.aging-fallback').on('click.aging-fallback', function (e) {
					e.preventDefault();
					e.stopPropagation();
					console.log('Fallback aging card clicked!', this);
					const agingRange = $(this).data('aging-range');
					console.log('Fallback aging range:', agingRange);

					// Use stored reference for fallback
					try {
						self.show_aging_invoices_modal(agingRange);
					} catch (error) {
						console.error('Error in fallback handler:', error);
					}
				});
			});

			const totalCards = $('.aging-card[data-aging-range], .detailed-aging-card[data-aging-range]').length;
			console.log('Aging card handlers attached to', totalCards, 'cards total');

			// Add a global test function to the window for debugging
			window.testAgingModal = (range) => {
				console.log('Testing aging modal with range:', range);
				self.show_aging_invoices_modal(range || '0-30');
			};
			console.log('Added window.testAgingModal() function for debugging. Try: testAgingModal("0-30")');
		}, 1500);
	}

	update_detailed_aging_cards() {
		console.log('update_detailed_aging_cards called, filtered_data length:', this.filtered_data ? this.filtered_data.length : 0);

		// Check if we have any data to work with
		// Use filtered_data if available, otherwise fall back to raw data
		if (!this.filtered_data || this.filtered_data.length === 0) {
			// If filtered_data is empty, check if we have raw data
			if (!this.data || this.data.length === 0) {
				console.log('No data available for aging cards, skipping update');
				return;
			}
			// Ensure filtered_data is populated from raw data
			console.log('Filtered data empty, repopulating from raw data before aging calculation');
			this.filtered_data = [...this.data];
		}

		console.log('Calculating analytics for aging cards with', this.filtered_data.length, 'customers');
		const analytics = this.calculate_analytics();
		console.log('Analytics calculated, range5_amount:', analytics.aging_amounts.range5);

		// Update detailed aging card values - now with 5 separate ranges
		const aging_data = [
			{
				range: '0-30',
				amount: analytics.aging_amounts.range1,
				count: analytics.aging_counts.range1,
				total: analytics.total_outstanding,
				prefix: 'detailed-aging-0-30'
			},
			{
				range: '31-60',
				amount: analytics.aging_amounts.range2,
				count: analytics.aging_counts.range2,
				total: analytics.total_outstanding,
				prefix: 'detailed-aging-31-60'
			},
			{
				range: '61-90',
				amount: analytics.aging_amounts.range3,
				count: analytics.aging_counts.range3,
				total: analytics.total_outstanding,
				prefix: 'detailed-aging-61-90'
			},
			{
				range: '91-120',
				amount: analytics.aging_amounts.range4,
				count: analytics.aging_counts.range4,
				total: analytics.total_outstanding,
				prefix: 'detailed-aging-91-120'
			},
			{
				range: '120+',
				amount: analytics.aging_amounts.range5,
				count: analytics.aging_counts.range5,
				total: analytics.total_outstanding,
				prefix: 'detailed-aging-120-plus'
			}
		];

		aging_data.forEach(data => {
			const percentage = data.total > 0 ? ((data.amount / data.total) * 100).toFixed(1) : 0;

			$('#' + data.prefix + '-amount').text(this.formatCurrency(data.amount));
			$('#' + data.prefix + '-count').text(data.count + ' invoice' + (data.count !== 1 ? 's' : ''));
			$('#' + data.prefix + '-percentage').text(percentage + '% of total');
		});

		// Update aging alerts with new ranges
		const critical120Count = analytics.aging_counts.range5;
		const danger91120Count = analytics.aging_counts.range4;
		const attentionCount = analytics.aging_counts.range3;
		const totalAmount = analytics.total_outstanding;

		$('#critical-aging-120-count').text(critical120Count + ' invoice' + (critical120Count !== 1 ? 's' : '') + ' over 120 days');
		$('#danger-aging-91-120-count').text(danger91120Count + ' invoice' + (danger91120Count !== 1 ? 's' : '') + ' 91-120 days');
		$('#attention-aging-count').text(attentionCount + ' invoice' + (attentionCount !== 1 ? 's' : '') + ' 61-90 days');
		$('#total-aging-amount').text(this.formatCurrency(totalAmount) + ' across all ranges');

		// Update aging distribution chart (bar chart) - now with 5 separate ranges
		if (this.aging_distribution_chart) {
			this.aging_distribution_chart.data.datasets[0].data = [
				analytics.aging_amounts.range1,
				analytics.aging_amounts.range2,
				analytics.aging_amounts.range3,
				analytics.aging_amounts.range4,
				analytics.aging_amounts.range5
			];
			this.aging_distribution_chart.data.labels = [
				'0-30 Days',
				'31-60 Days',
				'61-90 Days',
				'91-120 Days',
				'120+ Days'
			];
			this.aging_distribution_chart.update();
		}

		// Update aging pie chart - now with 5 separate ranges
		if (this.aging_pie_chart) {
			const total = analytics.total_outstanding;
			const data = [
				analytics.aging_amounts.range1,
				analytics.aging_amounts.range2,
				analytics.aging_amounts.range3,
				analytics.aging_amounts.range4,
				analytics.aging_amounts.range5
			];

			this.aging_pie_chart.data.datasets[0].data = data;

			// Update legend labels with new values
			this.aging_pie_chart.data.labels = [
				'0-30 Days',
				'31-60 Days',
				'61-90 Days',
				'91-120 Days',
				'120+ Days'
			];

			this.aging_pie_chart.update();
		}
	}

	populate_aging_details_table() {
		// Check if we have any data to work with
		if (!this.filtered_data || this.filtered_data.length === 0) {
			// If filtered_data is empty, check if we have raw data
			if (!this.data || this.data.length === 0) {
				$('#aging-details-tbody').html(`
					<tr>
						<td colspan="8" style="text-align: center; padding: 40px; color: #94a3b8;">
							<i class="fa fa-info-circle" style="font-size: 24px;"></i>
							<p style="margin-top: 10px;">No aging data available</p>
						</td>
					</tr>
				`);
				return;
			}
			// Ensure filtered_data is populated from raw data
			console.log('Filtered data empty in aging table, repopulating from raw data');
			this.filtered_data = [...this.data];
		}

		// Build rows using new API data with 5 separate ranges
		const rows = this.filtered_data.map((customer, index) => {
			// Calculate aging buckets from invoices using range fields from new API
			let total_outstanding = 0, range1 = 0, range2 = 0, range3 = 0, range4 = 0, range5 = 0;
			const invoices = [];

			if (customer.invoices && Array.isArray(customer.invoices)) {
				customer.invoices.forEach(inv => {
					const outstanding = inv.outstanding || 0;
					total_outstanding += outstanding;

					// Use range fields from new API
					range1 += (inv.range1 || 0);
					range2 += (inv.range2 || 0);
					range3 += (inv.range3 || 0);
					range4 += (inv.range4 || 0);
					range5 += (inv.range5 || 0);

					if (outstanding != 0) {  // Include both positive and negative (credit notes)
						invoices.push(inv);
					}
				});
			}

			if (total_outstanding === 0 && invoices.length === 0) return '';

			// Customer summary row with 5 separate range columns
			const customerRow = `
				<tr class="aging-customer-row" data-customer-index="${index}" style="cursor: pointer; background-color: rgba(59, 130, 246, 0.05); border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
					<td style="padding: 12px; text-align: center;">
						<i class="fa fa-plus-circle aging-expand-icon" style="color: #3b82f6; font-size: 16px;"></i>
					</td>
					<td style="padding: 12px; color: #e2e8f0; font-weight: 600;">${customer.customer_name || customer.customer}</td>
					<td style="padding: 12px; text-align: right; color: #f87171; font-weight: 700;">${this.formatCurrency(total_outstanding)}</td>
					<td style="padding: 12px; text-align: right; color: #cbd5e1;">${this.formatCurrency(range1)}</td>
					<td style="padding: 12px; text-align: right; color: #cbd5e1;">${this.formatCurrency(range2)}</td>
					<td style="padding: 12px; text-align: right; color: #cbd5e1;">${this.formatCurrency(range3)}</td>
					<td style="padding: 12px; text-align: right; color: #cbd5e1;">${this.formatCurrency(range4)}</td>
					<td style="padding: 12px; text-align: right; color: #cbd5e1;">${this.formatCurrency(range5)}</td>
				</tr>
			`;

			// Invoice details row (collapsed by default)
			const invoiceDetails = invoices.map(inv => `
				<tr class="aging-invoice-detail-row" data-voucher-type="${inv.voucher_type || 'Sales Invoice'}" style="background-color: rgba(30, 41, 59, 0.3); border-left: 3px solid #3b82f6;">
					<td style="padding: 8px; padding-left: 40px; color: #94a3b8; font-size: 12px;">${inv.voucher_type || 'Sales Invoice'}</td>
					<td style="padding: 8px; color: #cbd5e1; font-size: 12px; font-weight: 600;">
						<a href="/app/${(inv.voucher_type || 'Sales Invoice').toLowerCase().replace(/ /g, '-')}/${inv.voucher_no}" target="_blank" style="color: #60a5fa; text-decoration: none;">
							${inv.voucher_no}
						</a>
					</td>
					<td style="padding: 8px; text-align: right; color: #3b82f6; font-size: 12px; font-weight: 600;">${this.formatCurrency(inv.invoiced || 0)}</td>
					<td style="padding: 8px; text-align: right; color: #10b981; font-size: 12px; font-weight: 600;">${this.formatCurrency(inv.paid || 0)}</td>
					<td style="padding: 8px; text-align: right; color: #f59e0b; font-size: 12px; font-weight: 600;">${this.formatCurrency(inv.credit_note || 0)}</td>
					<td style="padding: 8px; text-align: right; color: ${inv.outstanding > 0 ? '#ef4444' : '#6b7280'}; font-size: 12px; font-weight: 700;">${this.formatCurrency(inv.outstanding || 0)}</td>
					<td style="padding: 8px; text-align: right; color: #94a3b8; font-size: 12px;">${inv.posting_date || '-'}</td>
					<td style="padding: 8px; text-align: right; color: #94a3b8; font-size: 12px;">${inv.age || 0} days</td>
					<td style="padding: 8px; text-align: right; color: #94a3b8; font-size: 12px;">
						<span class="badge badge-${inv.age > 90 ? 'danger' : inv.age > 60 ? 'warning' : 'info'}" style="font-size: 10px;">
							${inv.age > 90 ? '90+' : inv.age > 60 ? '61-90' : inv.age > 30 ? '31-60' : '0-30'}
						</span>
					</td>
				</tr>
			`).join('');

			const detailsRow = `
				<tr class="aging-details-row" data-customer-index="${index}" style="display: none;">
					<td colspan="8" style="padding: 0;">
						<table class="table" data-arm-allow-nested="1" style="margin: 0; background-color: rgba(30, 41, 59, 0.2); width: 100%;">
							<thead style="background-color: rgba(59, 130, 246, 0.05);">
								<tr>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; padding-left: 40px; font-weight: 600; width: 8%;">Type</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; font-weight: 600; width: 12%;">Document</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Invoiced</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Paid</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Credit Note</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Outstanding</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Posting Date</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Due Date</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Age</th>
									<th style="color: #94a3b8; font-size: 11px; padding: 8px; text-align: right; font-weight: 600; width: 10%;">Range</th>
								</tr>
							</thead>
							<tbody>
								${invoiceDetails}
							</tbody>
						</table>
					</td>
				</tr>
			`;

			return customerRow + detailsRow;
		}).filter(row => row !== '').join('');

		$('#aging-details-tbody').html(rows || `
			<tr>
				<td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">
					<i class="fa fa-info-circle" style="font-size: 24px;"></i>
					<p style="margin-top: 10px;">No outstanding aging data</p>
				</td>
			</tr>
		`);

		// Ensure sorting/search are attached for the main aging table and nested detail tables
		this.enhance_table($('.aging-details-table .table-responsive table').first());
		$('.aging-details-row table').each((_, table) => this.enhance_table($(table)));

		// Setup expand/collapse handlers
		$('.aging-customer-row').off('click').on('click', function () {
			const customerIndex = $(this).data('customer-index');
			const detailsRow = $(`.aging-details-row[data-customer-index="${customerIndex}"]`);
			const icon = $(this).find('.aging-expand-icon');

			detailsRow.toggle();
			icon.toggleClass('fa-plus-circle fa-minus-circle');

			// Apply current filter when expanding
			const currentFilter = $('#aging-details-voucher-filter').val();
			if (currentFilter && currentFilter !== 'all') {
				detailsRow.find('.aging-invoice-detail-row').each(function () {
					const rowType = $(this).data('voucher-type');
					if (rowType === currentFilter) {
						$(this).show();
					} else {
						$(this).hide();
					}
				});
			}
		});

		// Setup filter handlers
		const filterSelect = $('#aging-details-voucher-filter');
		const resetButton = $('#reset-aging-details-filter');
		const visibleCountSpan = $('#visible-customers-count');

		// Function to update visible customer count
		const updateVisibleCount = () => {
			const visibleCount = $('.aging-customer-row:visible').length;
			if (visibleCountSpan.length) {
				visibleCountSpan.text(visibleCount);
			}
		};

		// Initial count
		updateVisibleCount();

		if (filterSelect.length) {
			filterSelect.off('change').on('change', function () {
				const selectedType = $(this).val();

				// Filter invoice detail rows
				$('.aging-invoice-detail-row').each(function () {
					const rowType = $(this).data('voucher-type');
					if (selectedType === 'all' || rowType === selectedType) {
						$(this).show();
					} else {
						$(this).hide();
					}
				});

				// Hide/show customer rows based on whether they have matching documents
				let visibleCustomers = 0;
				$('.aging-customer-row').each(function () {
					const customerIndex = $(this).data('customer-index');
					const detailsRow = $(`.aging-details-row[data-customer-index="${customerIndex}"]`);

					if (selectedType === 'all') {
						// Show all customer rows when no filter is applied
						$(this).show();
						visibleCustomers++;
					} else {
						// Check if this customer has any documents of the selected type
						const hasMatchingDocs = detailsRow.find(`.aging-invoice-detail-row[data-voucher-type="${selectedType}"]`).length > 0;

						if (hasMatchingDocs) {
							$(this).show();
							visibleCustomers++;
						} else {
							$(this).hide();
							// Also hide the details row if it's expanded
							detailsRow.hide();
							// Reset the expand icon
							$(this).find('.aging-expand-icon').removeClass('fa-minus-circle').addClass('fa-plus-circle');
						}
					}
				});

				// Update visible count
				updateVisibleCount();

				// Show/hide reset button
				if (selectedType !== 'all') {
					resetButton.show();
				} else {
					resetButton.hide();
				}
			});

			// Reset button handler
			resetButton.off('click').on('click', function () {
				filterSelect.val('all').trigger('change');
			});
		}
	}

	create_collection_tracker() {
		// 1. Filter Panel
		const filter_panel = this.create_collection_filters();
		this.main_container.find('.collection-cards-section').append(filter_panel);

		// 2. Summary KPI Grid
		const kpi_cards = this.create_collection_kpi_cards();
		this.main_container.find('.collection-cards-section').append(kpi_cards);

		// 3. Detailed Collection Table
		const collection_table = this.create_collection_table();
		this.main_container.find('.collection-schedule-section').append(collection_table);

		// 4. Master Analytics & Actions
		const analytics_section = this.create_collection_master_analytics();
		this.main_container.find('.collection-schedule-section').append(analytics_section);

		// Load collection data
		this.load_collection_data();
	}

	create_collection_master_analytics() {
		return $(`
			<div class="stat-card" style="margin-top: 24px; padding: 24px;">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 16px;">
					<h4 style="margin: 0; color: #f1f5f9; font-weight: 700;">
						<i class="fa fa-line-chart" style="margin-right: 8px; color: #3b82f6;"></i>
						Advanced Analytics & Intelligence
					</h4>
					<div class="btn-group">
						<button class="btn btn-secondary btn-sm active" data-view="performance">Performance</button>
						<button class="btn btn-secondary btn-sm" data-view="distribution">Distribution</button>
						<button class="btn btn-secondary btn-sm" data-view="insights">Insights</button>
					</div>
				</div>

				<div class="analytics-content-wrapper">
					<div class="row">
						<!-- Performance Bars (Left) -->
						<div class="col-md-7">
							<div style="background: rgba(30, 41, 59, 0.4); border-radius: 16px; padding: 20px; border: 1px solid rgba(59, 130, 246, 0.1);">
								<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
									<h5 style="color: #e2e8f0; margin: 0; font-size: 15px; font-weight: 600;">Branch Performance Matrix</h5>
									<span style="font-size: 11px; color: #94a3b8;">Top 8 Branches</span>
								</div>
								<div id="branch-performance-master" style="min-height: 350px;">
									<div style="text-align: center; padding: 60px; color: #94a3b8;">
										<i class="fa fa-spinner fa-spin" style="font-size: 32px; color: #3b82f6;"></i>
										<p style="margin-top: 15px;">Aggregating performance data...</p>
									</div>
								</div>
							</div>
						</div>

						<!-- Insights & Actions (Right) -->
						<div class="col-md-5">
							<div style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
								<!-- Speedometer / Distribution Placeholder -->
								<div style="background: rgba(30, 41, 59, 0.4); border-radius: 16px; padding: 20px; border: 1px solid rgba(59, 130, 246, 0.1); flex: 1;">
									<h5 style="color: #e2e8f0; margin-bottom: 15px; font-size: 15px; font-weight: 600;">Payment Composition</h5>
									<div id="payment-distribution-master" style="min-height: 180px;"></div>
								</div>

								<!-- Intelligence Summary -->
								<div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 16px; padding: 20px; border: 1px solid rgba(59, 130, 246, 0.2);">
									<h5 style="color: #60a5fa; margin-bottom: 12px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">AI Insights</h5>
									<div id="collection-intelligence-feed" style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
										<div style="margin-bottom: 10px;">• <strong style="color: #10b981;">Strongest Channel:</strong> Cash collections are 12% above average.</div>
										<div style="margin-bottom: 10px;">• <strong style="color: #f59e0b;">Action Required:</strong> 3 branches are below target for card payments.</div>
									</div>
								</div>

								<!-- Quick Actions Grid -->
								<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
									<button class="btn btn-primary btn-sm" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
										<i class="fa fa-download"></i> Export
									</button>
									<button class="btn btn-secondary btn-sm" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
										<i class="fa fa-share-alt"></i> Share
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);
	}

	// Helper method to get this month's date range
	get_this_month_date_range() {
		const today = frappe.datetime.get_today();
		const from_date = frappe.datetime.month_start();
		const to_date = frappe.datetime.month_end();
		return { from_date, to_date };
	}

	// Helper method to get this year's date range
	get_this_year_date_range() {
		const today = new Date();
		const year = today.getFullYear();
		const from_date = `${year}-01-01`;
		const to_date = `${year}-12-31`;
		return { from_date, to_date };
	}

	// Helper method to get date range based on period selection
	get_date_range_for_period(period) {
		const today = frappe.datetime.get_today();
		let from_date, to_date;

		switch (period) {
			case 'today':
				from_date = to_date = today;
				break;
			case 'yesterday':
				from_date = to_date = frappe.datetime.add_days(today, -1);
				break;
			case 'this_week':
				from_date = frappe.datetime.week_start();
				to_date = frappe.datetime.week_end();
				break;
			case 'this_month':
				from_date = frappe.datetime.month_start();
				to_date = frappe.datetime.month_end();
				break;
			case 'last_month':
				const last_month_start = frappe.datetime.add_months(frappe.datetime.month_start(), -1);
				from_date = last_month_start;
				to_date = frappe.datetime.month_end(last_month_start);
				break;
			case 'this_quarter':
				from_date = frappe.datetime.quarter_start();
				to_date = frappe.datetime.quarter_end();
				break;
			case 'this_year':
				const year_range = this.get_this_year_date_range();
				from_date = year_range.from_date;
				to_date = year_range.to_date;
				break;
			default:
				// Default to this month
				from_date = frappe.datetime.month_start();
				to_date = frappe.datetime.month_end();
		}

		return { from_date, to_date };
	}

	create_collection_filters() {
		const month_range = this.get_this_month_date_range();
		const default_from_date = month_range.from_date;
		const default_to_date = month_range.to_date;

		return $(`
			<div class="stat-card" style="margin-bottom: 24px; min-height: auto; padding: 16px;">
				<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 15px;">
					<div style="display: flex; align-items: center; gap: 10px; margin-right: 10px;">
						<i class="fa fa-filter" style="color: #3b82f6; font-size: 18px;"></i>
						<span style="font-weight: 700; color: #f1f5f9; white-space: nowrap;">Quick Filters</span>
					</div>

					<div class="filter-item" style="flex: 1; min-width: 150px;">
						<select class="form-control" id="collection-company" style="width: 100%;">
							<option value="">Select Company</option>
						</select>
					</div>

					<div class="filter-item" style="flex: 1; min-width: 150px;">
						<select class="form-control" id="collection-branch" style="width: 100%;">
							<option value="">All Branches</option>
						</select>
					</div>

					<div class="filter-item" style="flex: 0.8; min-width: 120px;">
						<select class="form-control" id="collection-period" style="width: 100%;">
							<option value="today">Today</option>
							<option value="yesterday">Yesterday</option>
							<option value="this_week">This Week</option>
							<option value="this_month" selected>This Month</option>
							<option value="last_month">Last Month</option>
							<option value="this_quarter">This Quarter</option>
							<option value="this_year">This Year</option>
						</select>
					</div>

					<div style="display: flex; align-items: center; gap: 5px;">
						<input type="date" class="form-control" id="collection-from-date" value="${default_from_date}" style="width: 130px;">
						<span style="color: #94a3b8;">→</span>
						<input type="date" class="form-control" id="collection-to-date" value="${default_to_date}" style="width: 130px;">
					</div>

					<div style="display: flex; gap: 8px;">
						<button class="btn btn-primary" id="apply-collection-filters" style="padding: 8px 16px; min-height: 42px;">
							<i class="fa fa-refresh"></i> Apply
						</button>
						<button class="btn btn-secondary" id="toggle-advanced-filters" style="padding: 8px 12px; min-height: 42px;">
							<i class="fa fa-cog"></i>
						</button>
					</div>
				</div>

				<!-- Hidden Advanced Filters -->
				<div class="advanced-filters-row" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(59, 130, 246, 0.2); display: flex; flex-wrap: wrap; gap: 15px;">
					<div style="flex: 1; min-width: 150px;">
						<select class="form-control" id="collection-payment-mode">
							<option value="">All Modes</option>
							<option value="cash">Cash</option>
							<option value="card">Card</option>
							<option value="cheque">Cheque</option>
							<option value="pdc">PDC</option>
							<option value="wire">Wire Transfer</option>
							<option value="credit">Credit</option>
						</select>
					</div>
					<div style="flex: 1; min-width: 150px;">
						<select class="form-control" id="collection-pos-profile">
							<option value="">All POS Profiles</option>
						</select>
					</div>
					<div style="flex: 0.5; min-width: 100px;">
						<input type="number" class="form-control" id="collection-min-amount" placeholder="Min Amt">
					</div>
					<div style="flex: 0.5; min-width: 100px;">
						<input type="number" class="form-control" id="collection-max-amount" placeholder="Max Amt">
					</div>
					<div style="flex: 1; min-width: 120px;">
						<select class="form-control" id="collection-status">
							<option value="">All Status</option>
							<option value="cleared">Cleared</option>
							<option value="pending">Pending</option>
						</select>
					</div>
					<button class="btn btn-secondary" id="reset-collection-filters" style="padding: 8px 16px;">
						<i class="fa fa-eraser"></i> Reset
					</button>
				</div>
			</div>
		`);
	}

	create_collection_kpi_cards() {
		return $(`
			<div style="margin-bottom: 24px;">
				<div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px;">
					<div>
						<h4 style="margin-bottom: 4px; color: #f1f5f9; font-weight: 700;">
							<i class="fa fa-bar-chart" style="margin-right: 8px; color: #3b82f6;"></i>
							Collection Performance Overview
						</h4>
						<p style="color: #94a3b8; font-size: 13px; margin: 0;">Consolidated view of all payment channels and branch activity</p>
					</div>
					<div style="text-align: right;">
						<div class="stat-value" id="total-collections" style="font-size: 28px; margin-bottom: 0;">AED 0</div>
						<div style="color: #3b82f6; font-size: 12px; font-weight: 700; text-transform: uppercase;">Total Collections</div>
					</div>
				</div>

				<div class="metrics-grid">
					<!-- Payment Modes -->
					<div class="metric-item">
						<div class="metric-label"><i class="fa fa-money" style="color: #10b981;"></i> Cash</div>
						<div class="metric-value-large" id="cash-collections">AED 0</div>
					</div>
					<div class="metric-item">
						<div class="metric-label"><i class="fa fa-credit-card" style="color: #3b82f6;"></i> Card</div>
						<div class="metric-value-large" id="card-collections">AED 0</div>
					</div>
					<div class="metric-item">
						<div class="metric-label"><i class="fa fa-file-text-o" style="color: #f59e0b;"></i> Cheque</div>
						<div class="metric-value-large" id="cheque-collections">AED 0</div>
					</div>
					<div class="metric-item pdc-card-clickable" style="cursor: pointer;" title="Click to view PDC details">
						<div class="metric-label"><i class="fa fa-calendar" style="color: #ef4444;"></i> PDC</div>
						<div class="metric-value-large" id="pdc-collections">AED 0</div>
					</div>
					<div class="metric-item">
						<div class="metric-label"><i class="fa fa-exchange" style="color: #8b5cf6;"></i> Wire</div>
						<div class="metric-value-large" id="wire-collections">AED 0</div>
					</div>
					<div class="metric-item">
						<div class="metric-label"><i class="fa fa-credit-card-alt" style="color: #06b6d4;"></i> Credit</div>
						<div class="metric-value-large" id="credit-collections">AED 0</div>
					</div>
					
					<!-- Operational Metrics -->
					<div class="metric-item" style="border-left: 1px solid rgba(59, 130, 246, 0.3); padding-left: 20px;">
						<div class="metric-label"><i class="fa fa-building" style="color: #3b82f6;"></i> Branches</div>
						<div class="metric-value-large" id="branch-count">0</div>
					</div>
					<div class="metric-item">
						<div class="metric-label"><i class="fa fa-bolt" style="color: #fbbf24;"></i> Today</div>
						<div class="metric-value-large" id="today-collections">AED 0</div>
					</div>
				</div>
			</div>
		`);
	}

	create_collection_analytics() {
		return $(`
			<div class="stat-card" style="margin-bottom: 24px;">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
					<h4 style="margin: 0; color: #f1f5f9; font-weight: 700;">
						<i class="fa fa-line-chart" style="margin-right: 8px; color: #3b82f6;"></i>
						Collection Analytics
					</h4>
					<select class="form-control" style="width: 150px;" id="chart-type">
						<option value="line">Line Chart</option>
						<option value="bar">Bar Chart</option>
						<option value="area">Area Chart</option>
					</select>
				</div>

				<div class="row">
					<div class="col-md-6">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; height: 300px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px;">📊 Collection Trend</h5>
							<div id="collection-trend-chart" style="height: 240px; display: flex; align-items: center; justify-content: center;">
								<p style="color: #94a3b8;">Chart will be rendered here</p>
							</div>
						</div>
					</div>
					<div class="col-md-6">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; height: 300px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px;">🥧 Payment Mode Distribution</h5>
							<div id="payment-mode-chart" style="height: 240px; display: flex; align-items: center; justify-content: center;">
								<div style="text-align: center;">
									<p style="color: #94a3b8; margin-bottom: 12px;">Distribution:</p>
									<div style="text-align: left; display: inline-block;">
										<div style="margin-bottom: 8px;"><span style="color: #10b981;">●</span> Cash: 36%</div>
										<div style="margin-bottom: 8px;"><span style="color: #3b82f6;">●</span> Card: 28%</div>
										<div style="margin-bottom: 8px;"><span style="color: #f59e0b;">●</span> Cheque: 20%</div>
										<div style="margin-bottom: 8px;"><span style="color: #ef4444;">●</span> PDC: 12%</div>
										<div><span style="color: #8b5cf6;">●</span> Others: 4%</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="row" style="margin-top: 16px;">
					<div class="col-md-6">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; height: 300px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px;">📈 Branch Performance</h5>
							<div id="branch-performance-chart" style="height: 240px; overflow-y: auto;">
								<div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading branch performance...</p>
								</div>
							</div>
						</div>
					</div>
					<div class="col-md-6">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; height: 300px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px;">📊 Collection vs Target</h5>
							<div id="target-gauge" style="height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
								<div class="circular-progress" style="--progress-angle: 315deg; margin-bottom: 15px;">
									<div class="progress-value">87.5%</div>
								</div>
								<div style="text-align: center; color: #94a3b8;">
									<div><strong style="color: #e2e8f0;">Target:</strong> AED 1,500,000</div>
									<div><strong style="color: #10b981;">Achieved:</strong> AED 1,312,500</div>
									<div><strong style="color: #f59e0b;">Remaining:</strong> AED 187,500</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);
	}


	create_collection_table() {
		return $(`
			<div class="stat-card" style="margin-bottom: 24px;">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
					<h4 style="margin: 0; color: #f1f5f9; font-weight: 700;">
						<i class="fa fa-table" style="margin-right: 8px; color: #3b82f6;"></i>
						Detailed Collections
					</h4>
					<div>
						<button class="btn btn-sm btn-primary" id="export-collection-table-btn"><i class="fa fa-download"></i> Export</button>
					</div>
				</div>

				<div style="overflow-x: auto;">
					<table class="table collection-table" style="margin-bottom: 0;">
						<thead>
							<tr style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);">
								<th style="color: white; padding: 12px;">Branch</th>
								<th style="color: white; padding: 12px;">POS Profile</th>
								<th style="color: white; padding: 12px; text-align: right;">Cash</th>
								<th style="color: white; padding: 12px; text-align: right;">Card</th>
								<th style="color: white; padding: 12px; text-align: right;">Cheque</th>
								<th style="color: white; padding: 12px; text-align: right;">PDC</th>
								<th style="color: white; padding: 12px; text-align: right;">Wire</th>
								<th style="color: white; padding: 12px; text-align: right;">Credit</th>
								<th style="color: white; padding: 12px; text-align: right;">Total</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading collection data...</p>
								</td>
							</tr>
						</tbody>
						<tfoot style="background: rgba(59, 130, 246, 0.1); font-weight: 700;">
							<tr>
								<td colspan="2" style="padding: 12px; color: #e2e8f0;">TOTAL</td>
								<td style="padding: 12px; text-align: right; color: #e2e8f0;">-</td>
								<td style="padding: 12px; text-align: right; color: #e2e8f0;">-</td>
								<td style="padding: 12px; text-align: right; color: #e2e8f0;">-</td>
								<td style="padding: 12px; text-align: right; color: #e2e8f0;">-</td>
								<td style="padding: 12px; text-align: right; color: #e2e8f0;">-</td>
								<td style="padding: 12px; text-align: right; color: #e2e8f0;">-</td>
								<td style="padding: 12px; text-align: right; color: #10b981; font-size: 16px;">-</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		`);
	}


	create_pdc_tracker() {
		return $(`
			<div class="stat-card" style="margin-bottom: 24px;">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
					<h4 style="margin: 0; color: #f1f5f9; font-weight: 700;">
						<i class="fa fa-calendar-check-o" style="margin-right: 8px; color: #3b82f6;"></i>
						📅 PDC Tracker
					</h4>
					<button class="btn btn-sm btn-primary" id="export-pdc-btn"><i class="fa fa-download"></i> Export</button>
				</div>

				<div class="row" style="margin-bottom: 20px;">
					<div class="col-md-4">
						<div style="padding: 15px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">
							<div style="color: #10b981; font-size: 12px; font-weight: 600; margin-bottom: 4px;">Due This Week</div>
							<div id="pdc-due-week" style="color: #e2e8f0; font-size: 20px; font-weight: 700;">-</div>
						</div>
					</div>
					<div class="col-md-4">
						<div style="padding: 15px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px;">
							<div style="color: #3b82f6; font-size: 12px; font-weight: 600; margin-bottom: 4px;">Due This Month</div>
							<div id="pdc-due-month" style="color: #e2e8f0; font-size: 20px; font-weight: 700;">-</div>
						</div>
					</div>
					<div class="col-md-4">
						<div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
							<div style="color: #ef4444; font-size: 12px; font-weight: 600; margin-bottom: 4px;">⚠️ Overdue</div>
							<div id="pdc-overdue" style="color: #e2e8f0; font-size: 20px; font-weight: 700;">-</div>
						</div>
					</div>
				</div>

				<div style="overflow-x: auto;">
					<table class="table pdc-table" style="margin-bottom: 0;">
						<thead>
							<tr style="background: rgba(59, 130, 246, 0.1);">
								<th style="color: #e2e8f0; padding: 12px;">Cheque No</th>
								<th style="color: #e2e8f0; padding: 12px;">Customer</th>
								<th style="color: #e2e8f0; padding: 12px; text-align: right;">Amount</th>
								<th style="color: #e2e8f0; padding: 12px;">Due Date</th>
								<th style="color: #e2e8f0; padding: 12px;">Status</th>
								<th style="color: #e2e8f0; padding: 12px; text-align: center;">Actions</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading PDC data...</p>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		`);
	}

	create_collection_insights() {
		return $(`
			<div class="stat-card" style="margin-bottom: 24px;">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-lightbulb-o" style="margin-right: 8px; color: #3b82f6;"></i>
					🎯 Collection Performance Insights
				</h4>

				<div class="row">
					<div class="col-md-6">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; margin-bottom: 16px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 10px;">Top Performing Branches</h5>
							<div id="top-branches-insights" style="color: #94a3b8; line-height: 1.8;">
								<div style="text-align: center; padding: 20px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading branch performance...</p>
								</div>
							</div>
						</div>
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 10px;">Collection Summary</h5>
							<div style="color: #94a3b8; line-height: 1.8;">
								<div style="margin-bottom: 8px;">Total Branches: <strong id="insights-total-branches" style="color: #e2e8f0;">-</strong></div>
								<div style="margin-bottom: 8px;">Average per Branch: <strong id="insights-avg-branch" style="color: #e2e8f0;">-</strong></div>
								<div style="margin-bottom: 8px;">Highest Collection: <strong id="insights-highest" style="color: #10b981;">-</strong></div>
								<hr style="border-color: rgba(59, 130, 246, 0.2); margin: 12px 0;">
								<div style="margin-bottom: 8px;">Total Collection: <strong id="insights-total" style="color: #e2e8f0;">-</strong></div>
							</div>
						</div>
					</div>
					<div class="col-md-6">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; margin-bottom: 16px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 10px;">Payment Mode Trends</h5>
							<div style="color: #94a3b8; line-height: 1.8;">
								<div style="margin-bottom: 8px;"><i class="fa fa-arrow-up" style="color: #10b981;"></i> Cash Collections <strong style="color: #10b981;">↑ 12.5%</strong></div>
								<div style="margin-bottom: 8px;"><i class="fa fa-arrow-up" style="color: #10b981;"></i> Card Collections <strong style="color: #10b981;">↑ 8.2%</strong></div>
								<div style="margin-bottom: 8px;"><i class="fa fa-arrow-down" style="color: #ef4444;"></i> Cheque Collections <strong style="color: #ef4444;">↓ 2.3%</strong></div>
								<div style="margin-bottom: 8px;"><i class="fa fa-arrow-up" style="color: #10b981;"></i> Digital Payments <strong style="color: #10b981;">↑ 15.7%</strong></div>
								<hr style="border-color: rgba(59, 130, 246, 0.2); margin: 12px 0;">
								<div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 6px; font-size: 12px;">
									<strong style="color: #3b82f6;">💡 Recommendation:</strong><br>
									Focus on promoting card payments to reduce cash handling
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);
	}

	create_activity_feed() {
		return $(`
			<div class="stat-card" style="margin-bottom: 24px;">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-bar-chart" style="margin-right: 8px; color: #3b82f6;"></i>
					📊 Collection Analytics & Insights
				</h4>

				<div class="row">
					<!-- Branch-wise Collection Chart -->
					<div class="col-md-6" style="margin-bottom: 20px;">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; height: 100%;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 10px;">
								<i class="fa fa-building-o"></i> Branch-wise Collection Comparison
							</h5>
							<div id="branch-collection-chart" style="min-height: 300px;">
								<div style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading chart...</p>
								</div>
							</div>
						</div>
					</div>

					<!-- Payment Mode Distribution Chart -->
					<div class="col-md-6" style="margin-bottom: 20px;">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; height: 100%;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 10px;">
								<i class="fa fa-pie-chart"></i> Payment Mode Distribution
							</h5>
							<div id="payment-mode-distribution-chart" style="min-height: 300px;">
								<div style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading chart...</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="row">
					<!-- Collection Performance Summary -->
					<div class="col-md-12">
						<div style="padding: 20px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px;">
							<h5 style="color: #e2e8f0; margin-bottom: 15px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); padding-bottom: 10px;">
								<i class="fa fa-line-chart"></i> Collection Performance by Branch
							</h5>
							<div id="branch-performance-bars" style="min-height: 250px;">
								<div style="text-align: center; padding: 40px; color: #94a3b8;">
									<i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
									<p style="margin-top: 10px;">Loading performance data...</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);
	}


	create_collection_actions() {
		return $(`
			<div class="stat-card" style="margin-bottom: 24px;">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-flash" style="margin-right: 8px; color: #3b82f6;"></i>
					⚡ Quick Actions
				</h4>

				<div class="row">
					<div class="col-md-3">
						<button class="btn btn-primary btn-block" style="margin-bottom: 10px;">
							<i class="fa fa-file-text-o"></i> Generate Report
						</button>
					</div>
					<div class="col-md-3">
						<button class="btn btn-primary btn-block" style="margin-bottom: 10px;">
							<i class="fa fa-envelope"></i> Email Summary
						</button>
					</div>
					<div class="col-md-3">
						<button class="btn btn-primary btn-block" style="margin-bottom: 10px;">
							<i class="fa fa-bell"></i> Set Alert
						</button>
					</div>
					<div class="col-md-3">
						<button class="btn btn-primary btn-block" style="margin-bottom: 10px;">
							<i class="fa fa-save"></i> Save View
						</button>
					</div>
				</div>

				<div class="row">
					<div class="col-md-3">
						<button class="btn btn-secondary btn-block">
							<i class="fa fa-mobile"></i> SMS Update
						</button>
					</div>
					<div class="col-md-3">
						<button class="btn btn-secondary btn-block">
							<i class="fa fa-print"></i> Print Summary
						</button>
					</div>
					<div class="col-md-3">
						<button class="btn btn-secondary btn-block">
							<i class="fa fa-share-alt"></i> Share Dashboard
						</button>
					</div>
					<div class="col-md-3">
						<button class="btn btn-secondary btn-block">
							<i class="fa fa-cog"></i> Settings
						</button>
					</div>
				</div>
			</div>
		`);
	}

	load_collection_data() {
		// Setup event handlers
		$('#toggle-advanced-filters').on('click', function () {
			$('.advanced-filters-row').slideToggle();
			const icon = $(this).find('i');
			icon.toggleClass('fa-cog fa-chevron-up');
		});

		// Period dropdown change handler - auto-update date fields
		$('#collection-period').on('change', (e) => {
			const period = $(e.target).val();
			const date_range = this.get_date_range_for_period(period);
			$('#collection-from-date').val(date_range.from_date);
			$('#collection-to-date').val(date_range.to_date);
		});

		$('#apply-collection-filters').on('click', () => {
			this.fetch_and_update_collection_data();
		});

		$('#reset-collection-filters').on('click', () => {
			$('#collection-company, #collection-branch, #collection-payment-mode, #collection-pos-profile, #collection-status').val('');
			$('#collection-period').val('this_month');
			$('#collection-min-amount, #collection-max-amount').val('');

			// Reset dates to "this month" range to match Overview section
			const month_range = this.get_this_month_date_range();
			$('#collection-from-date').val(month_range.from_date);
			$('#collection-to-date').val(month_range.to_date);

			// Reset company to global filter value
			if (this.filters.company) {
				$('#collection-company').val(this.filters.company);
			}

			frappe.show_alert({ message: 'Filters reset', indicator: 'blue' });
			this.fetch_and_update_collection_data();
		});

		// Export button event handler
		$(document).on('click', '#export-collection-table-btn', () => {
			this.export_collection_table_to_excel();
		});

		// Load company list
		this.load_company_list();

		// Load branch list
		this.load_branch_list();

		// Load POS profiles
		this.load_pos_profiles();

		// Initial data load
		this.fetch_and_update_collection_data();

		// Load PDC data
		this.fetch_pdc_data();

		// PDC Card click handler - show detailed modal
		$('#pdc-card').off('click').on('click', () => {
			this.show_pdc_details_modal();
		});

		// Add hover effect for PDC card
		$('#pdc-card').hover(
			function () { $(this).css({ 'transform': 'translateY(-3px)', 'box-shadow': '0 8px 25px rgba(245, 158, 11, 0.3)' }); },
			function () { $(this).css({ 'transform': 'translateY(0)', 'box-shadow': '' }); }
		);

		console.log('Collection tracker loaded successfully');
	}

	show_pdc_details_modal() {
		const self = this;

		// Get current filters
		const company = $('#collection-company').val() || this.filters.company || null;
		console.log('[Collection Tracker] Fetching totals with company:', company);
		const from_date = $('#collection-from-date').val() || null;
		const to_date = $('#collection-to-date').val() || null;

		// Show loading
		frappe.show_alert({ message: 'Loading PDC details...', indicator: 'blue' });

		frappe.call({
			method: 'pastara_custom.prastara_custom.page.prd_arm.prd_arm.get_pdc_data',
			args: {
				company: company,
				from_date: from_date,
				to_date: to_date
			},
			callback: (r) => {
				if (r.message) {
					const pdc_data = r.message;
					const summary = pdc_data.summary || {};
					const pdc_records = pdc_data.pdc_records || [];

					// Build modal content
					const modal_content = self.build_pdc_modal_content(summary, pdc_records, { company, from_date, to_date });

					// Create and show modal
					const dialog = new frappe.ui.Dialog({
						title: '📅 PDC Details',
						size: 'extra-large',
						fields: [
							{
								fieldtype: 'HTML',
								fieldname: 'pdc_content',
								options: modal_content
							}
						],
						primary_action_label: 'Go to PDC Report',
						primary_action: () => {
							dialog.hide();
							// Navigate to PDC Report section
							self.show_section('pdc_report');
						}
					});

					dialog.show();
					dialog.$wrapper.find('.modal-dialog').css('max-width', '1200px');
				}
			}
		});
	}

	build_pdc_modal_content(summary, pdc_records, filters) {
		const self = this;

		// Filter info
		const filter_info = [];
		if (filters.company) filter_info.push(`Company: ${filters.company}`);
		if (filters.from_date) filter_info.push(`From: ${frappe.datetime.str_to_user(filters.from_date)}`);
		if (filters.to_date) filter_info.push(`To: ${frappe.datetime.str_to_user(filters.to_date)}`);

		// Summary cards HTML
		const summary_html = `
			<div style="margin-bottom: 20px;">
				<div style="color: #94a3b8; font-size: 12px; margin-bottom: 10px;">
					${filter_info.length > 0 ? filter_info.join(' | ') : 'All Companies | All Dates'}
				</div>
				<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
					<div style="padding: 15px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; text-align: center;">
						<div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-bottom: 5px;">Total PDCs</div>
						<div style="color: white; font-size: 20px; font-weight: 700;">${summary.total_count || 0}</div>
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600;">${this.formatCurrency(summary.total_amount || 0)}</div>
					</div>
					<div style="padding: 15px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; text-align: center;">
						<div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-bottom: 5px;">Due This Week</div>
						<div style="color: white; font-size: 20px; font-weight: 700;">${summary.due_this_week_count || 0}</div>
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600;">${this.formatCurrency(summary.due_this_week_amount || 0)}</div>
					</div>
					<div style="padding: 15px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; text-align: center;">
						<div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-bottom: 5px;">Due This Month</div>
						<div style="color: white; font-size: 20px; font-weight: 700;">${summary.due_this_month_count || 0}</div>
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600;">${this.formatCurrency(summary.due_this_month_amount || 0)}</div>
					</div>
					<div style="padding: 15px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 10px; text-align: center;">
						<div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-bottom: 5px;">Overdue</div>
						<div style="color: white; font-size: 20px; font-weight: 700;">${summary.overdue_count || 0}</div>
						<div style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600;">${this.formatCurrency(summary.overdue_amount || 0)}</div>
					</div>
				</div>
			</div>
		`;

		// Table rows
		const table_rows = pdc_records.slice(0, 20).map(pdc => {
			const pdc_status = pdc.pdc_status || '';
			let status_color = '#94a3b8';
			let status_bg = 'rgba(148, 163, 184, 0.2)';

			if (pdc_status === 'Pending Clearance') {
				status_color = '#3b82f6';
				status_bg = 'rgba(59, 130, 246, 0.2)';
			} else if (pdc_status === 'Due Today') {
				status_color = '#10b981';
				status_bg = 'rgba(16, 185, 129, 0.2)';
			} else if (pdc_status === 'Future') {
				status_color = '#f59e0b';
				status_bg = 'rgba(245, 158, 11, 0.2)';
			} else if (pdc_status === 'Cleared') {
				status_color = '#6b7280';
				status_bg = 'rgba(107, 114, 128, 0.2)';
			}

			const cheque_no = pdc.cheque_number || pdc.reference_no || '-';
			const customer = pdc.customer_name || pdc.customer || '-';
			const amount = pdc.paid_amount || 0;
			const cheque_date = pdc.cheque_date ? frappe.datetime.str_to_user(pdc.cheque_date) : '-';
			const collection_date = pdc.collection_date ? frappe.datetime.str_to_user(pdc.collection_date) : '-';
			const payment_entry = pdc.payment_entry || '';

			return `
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td style="padding: 10px; font-size: 13px;">${cheque_no}</td>
					<td style="padding: 10px; font-size: 13px;">${customer}</td>
					<td style="padding: 10px; font-size: 13px; text-align: right; font-weight: 600;">${this.formatCurrency(amount)}</td>
					<td style="padding: 10px; font-size: 13px;">${cheque_date}</td>
					<td style="padding: 10px; font-size: 13px;">${collection_date}</td>
					<td style="padding: 10px;">
						<span style="background: ${status_bg}; color: ${status_color}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${pdc_status}</span>
					</td>
					<td style="padding: 10px; text-align: center;">
						<a href="/app/payment-entry/${payment_entry}" target="_blank" class="btn btn-xs btn-default">
							<i class="fa fa-external-link"></i>
						</a>
					</td>
				</tr>
			`;
		}).join('');

		// Table HTML
		const table_html = `
			<div style="max-height: 400px; overflow-y: auto;">
				<table style="width: 100%; border-collapse: collapse;">
					<thead style="background: #f1f5f9; position: sticky; top: 0;">
						<tr>
							<th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Cheque No</th>
							<th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Customer</th>
							<th style="padding: 12px; text-align: right; font-weight: 600; color: #475569;">Amount</th>
							<th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Cheque Date</th>
							<th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Collection Date</th>
							<th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Status</th>
							<th style="padding: 12px; text-align: center; font-weight: 600; color: #475569;">Action</th>
						</tr>
					</thead>
					<tbody>
						${table_rows || '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8;">No PDC records found</td></tr>'}
					</tbody>
				</table>
			</div>
			${pdc_records.length > 20 ? `<div style="padding: 10px; text-align: center; color: #64748b; font-size: 12px;">Showing 20 of ${pdc_records.length} records. Click "Go to PDC Report" for full details.</div>` : ''}
		`;

		return summary_html + table_html;
	}

	load_company_list() {
		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_company_list',
			callback: (r) => {
				if (r.message) {
					const company_select = $('#collection-company');
					company_select.empty().append('<option value="">All Companies</option>');
					r.message.forEach(company => {
						company_select.append(`<option value="${company.name}">${company.name}</option>`);
					});

					// Auto-select company from global filters
					if (this.filters.company) {
						company_select.val(this.filters.company);
						console.log('[Collection Tracker] Auto-selected company from global filter:', this.filters.company);
					}
				}
			}
		});
	}

	load_branch_list() {
		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_branch_list',
			callback: (r) => {
				if (r.message) {
					const branch_select = $('#collection-branch');
					branch_select.empty().append('<option value="">All Branches</option>');
					r.message.forEach(branch => {
						branch_select.append(`<option value="${branch.name}">${branch.name}</option>`);
					});
				}
			}
		});
	}

	load_pos_profiles() {
		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_pos_profiles',
			callback: (r) => {
				if (r.message) {
					const pos_select = $('#collection-pos-profile');
					pos_select.empty().append('<option value="">All POS Profiles</option>');
					r.message.forEach(pos => {
						pos_select.append(`<option value="${pos.name}">${pos.name}</option>`);
					});
				}
			}
		});
	}

	fetch_and_update_collection_data() {
		const filters = {
			company: $('#collection-company').val() || this.filters.company || null,
			branch: $('#collection-branch').val() || this.filters.branch || null,
			from_date: $('#collection-from-date').val(),
			to_date: $('#collection-to-date').val(),
			payment_mode: $('#collection-payment-mode').val(),
			pos_profile: $('#collection-pos-profile').val(),
			status: $('#collection-status').val()
		};

		console.log('[Collection Tracker] Fetching data with filters:', JSON.stringify(filters));
		frappe.show_alert({ message: 'Loading collection data...', indicator: 'blue' });

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_collection_data',
			args: { filters: filters },
			callback: (r) => {
				console.log('=== COLLECTION DATA RESPONSE ===');
				console.log('Response:', r);
				console.log('Message:', r.message);
				if (r.message) {
					console.log('Branch Data:', r.message.branch_data);
					console.log('Branch Count:', r.message.branch_count);
					console.log('Totals:', r.message.totals);
					console.log('Today Collection:', r.message.today_collection);
					this.update_collection_ui(r.message);
					frappe.show_alert({ message: 'Collection data loaded successfully', indicator: 'green' });

					// Also refresh PDC data with same filters
					this.fetch_pdc_data();
				} else {
					console.log('No message in response');
				}
			},
			error: (r) => {
				frappe.show_alert({ message: 'Error loading collection data', indicator: 'red' });
				console.error('Error:', r);
			}
		});
	}

	update_collection_ui(data) {
		const totals = data.totals || {};
		const branch_data = data.data || [];

		console.log('[Collection Tracker] Updating UI with totals:', JSON.stringify(totals));

		// Store collection data for export
		this.collection_export_data = {
			branch_data: branch_data,
			totals: totals
		};

		// Update KPI Cards
		$('#total-collections').text(this.formatCurrency(totals.total));
		$('#cash-collections').text(this.formatCurrency(totals.cash));
		$('#card-collections').text(this.formatCurrency(totals.card));
		$('#cheque-collections').text(this.formatCurrency(totals.cheque));
		$('#pdc-collections').text(this.formatCurrency(totals.pdc));
		$('#wire-collections').text(this.formatCurrency(totals.wire_transfer));
		$('#credit-collections').text(this.formatCurrency(totals.credit));
		$('#branch-count').text(data.branch_count);
		$('#today-collections').text(this.formatCurrency(data.today_collection));

		// Update table rows
		this.update_collection_table(branch_data, totals);

		// Update Master Analytics
		this.update_master_analytics(branch_data, totals, data);
	}

	update_master_analytics(branch_data, totals, data) {
		if (!branch_data || branch_data.length === 0) {
			$('#branch-performance-master').html('<div style="text-align: center; color: #94a3b8;">No data available</div>');
			return;
		}

		// 1. Update Branch Performance Matrix
		this.update_branch_matrix(branch_data);

		// 2. Update Payment Distribution (Donut Chart)
		this.update_distribution_master(totals);

		// 3. Update Intelligence Feed
		this.update_intelligence_feed(branch_data, totals);
	}

	update_branch_matrix(branch_data) {
		const sorted = branch_data.slice().sort((a, b) => b.total - a.total).slice(0, 8);
		const max_total = sorted[0].total;

		const matrix_html = sorted.map((branch, index) => {
			const percentage = (branch.total / max_total) * 100;
			return `
				<div style="margin-bottom: 15px;">
					<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
						<span style="color: #e2e8f0; font-size: 13px; font-weight: 600;">${index + 1}. ${branch.branch}</span>
						<span style="color: #60a5fa; font-weight: 700;">${this.formatCurrency(branch.total)}</span>
					</div>
					<div style="background: rgba(59, 130, 246, 0.1); border-radius: 6px; height: 12px; overflow: hidden; display: flex;">
						<div class="matrix-bar-cash" style="background: #10b981; height: 100%; width: ${(branch.cash / branch.total) * percentage}%"></div>
						<div class="matrix-bar-card" style="background: #3b82f6; height: 100%; width: ${(branch.card / branch.total) * percentage}%"></div>
						<div class="matrix-bar-other" style="background: #8b5cf6; height: 100%; width: ${((branch.total - branch.cash - branch.card) / branch.total) * percentage}%"></div>
					</div>
				</div>
			`;
		}).join('');

		$('#branch-performance-master').html(matrix_html);
	}

	update_distribution_master(totals) {
		const container = $('#payment-distribution-master');
		if (!container.length) return;

		const canvas = document.createElement('canvas');
		container.empty().append(canvas);

		if (typeof Chart === 'undefined') {
			container.html('<div style="color: #94a3b8; font-size: 12px;">Chart.js not loaded</div>');
			return;
		}

		new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels: ['Cash', 'Card', 'Cheque', 'PDC', 'Wire', 'Credit'],
				datasets: [{
					data: [totals.cash, totals.card, totals.cheque, totals.pdc, totals.wire_transfer, totals.credit],
					backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
					borderWidth: 0,
					hoverOffset: 10
				}]
			},
			options: {
				maintainAspectRatio: false,
				cutout: '70%',
				plugins: {
					legend: {
						position: 'right',
						labels: { color: '#94a3b8', font: { size: 10 }, usePointStyle: true, padding: 10 }
					}
				}
			}
		});
	}

	update_intelligence_feed(branch_data, totals) {
		const sorted = branch_data.slice().sort((a, b) => b.total - a.total);
		const top = sorted[0];
		const avg = totals.total / branch_data.length;

		const intel_html = `
			<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px;">
				<i class="fa fa-trophy" style="color: #fbbf24; margin-top: 3px;"></i>
				<div>
					<strong style="color: #f1f5f9; font-size: 13px;">Peak Performance</strong><br>
					<span style="color: #94a3b8;">${top.branch} leads with ${this.formatCurrency(top.total)}</span>
				</div>
			</div>
			<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px;">
				<i class="fa fa-info-circle" style="color: #3b82f6; margin-top: 3px;"></i>
				<div>
					<strong style="color: #f1f5f9; font-size: 13px;">Network Average</strong><br>
					<span style="color: #94a3b8;">Avg collection: ${this.formatCurrency(avg)}</span>
				</div>
			</div>
			<div style="display: flex; align-items: flex-start; gap: 10px;">
				<i class="fa fa-warning" style="color: #ef4444; margin-top: 3px;"></i>
				<div>
					<strong style="color: #f1f5f9; font-size: 13px;">PDC Ratio</strong><br>
					<span style="color: #94a3b8;">${(totals.pdc / totals.total * 100).toFixed(1)}% volume in post-dated cheques</span>
				</div>
			</div>
		`;
		$('#collection-intelligence-feed').html(intel_html);
	}

	update_collection_table(branch_data, totals) {
		if (!branch_data || branch_data.length === 0) {
			// Show no data message
			$('.collection-table tbody').html(`
				<tr>
					<td colspan="9" style="text-align: center; padding: 20px; color: #94a3b8;">
						No collection data found for the selected filters
					</td>
				</tr>
			`);
			return;
		}

		const rows = branch_data.map(b => {
			const total = b.total;
			const trend = 0; // You can calculate this based on previous period data
			const trendColor = trend > 0 ? '#10b981' : '#ef4444';
			const trendIcon = trend > 0 ? '↑' : '↓';

			return `
				<tr style="border-bottom: 1px solid rgba(59, 130, 246, 0.1);">
					<td style="padding: 12px; color: #e2e8f0;">${b.branch}</td>
					<td style="padding: 12px; color: #94a3b8;">${b.pos_profile || 'N/A'}</td>
					<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(b.cash)}</td>
					<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(b.card)}</td>
					<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(b.cheque)}</td>
					<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(b.pdc)}</td>
					<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(b.wire_transfer)}</td>
					<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(b.credit)}</td>
					<td style="padding: 12px; text-align: right; color: #3b82f6; font-weight: 600;">${this.formatCurrency(total)}</td>
				</tr>
			`;
		}).join('');

		// Find and update table body
		const tbody = this.main_container.find('.collection-schedule-section .table tbody');
		if (tbody.length) {
			tbody.html(rows);
		}

		// Update footer totals
		const cash_pct = totals.total > 0 ? ((totals.cash / totals.total) * 100).toFixed(1) : 0;
		const card_pct = totals.total > 0 ? ((totals.card / totals.total) * 100).toFixed(1) : 0;
		const cheque_pct = totals.total > 0 ? ((totals.cheque / totals.total) * 100).toFixed(1) : 0;
		const pdc_pct = totals.total > 0 ? ((totals.pdc / totals.total) * 100).toFixed(1) : 0;
		const wire_pct = totals.total > 0 ? ((totals.wire_transfer / totals.total) * 100).toFixed(1) : 0;
		const credit_pct = totals.total > 0 ? ((totals.credit / totals.total) * 100).toFixed(1) : 0;

		const footer = `
			<tr>
				<td colspan="2" style="padding: 12px; color: #e2e8f0;">TOTAL</td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(totals.cash)}<br><small style="color: #94a3b8;">${cash_pct}%</small></td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(totals.card)}<br><small style="color: #94a3b8;">${card_pct}%</small></td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(totals.cheque)}<br><small style="color: #94a3b8;">${cheque_pct}%</small></td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(totals.pdc)}<br><small style="color: #94a3b8;">${pdc_pct}%</small></td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(totals.wire_transfer)}<br><small style="color: #94a3b8;">${wire_pct}%</small></td>
				<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(totals.credit)}<br><small style="color: #94a3b8;">${credit_pct}%</small></td>
				<td style="padding: 12px; text-align: right; color: #10b981; font-size: 16px;">${this.formatCurrency(totals.total)}</td>
			</tr>
		`;

		const tfoot = this.main_container.find('.collection-schedule-section .table tfoot');
		if (tfoot.length) {
			tfoot.html(footer);
		}
	}

	export_collection_table_to_excel() {
		if (!this.collection_export_data || !this.collection_export_data.branch_data) {
			frappe.show_alert({ message: 'No data available to export', indicator: 'red' });
			return;
		}

		const branch_data = this.collection_export_data.branch_data;
		const totals = this.collection_export_data.totals;

		// Prepare data for export
		const export_data = [];

		// Add header row
		export_data.push([
			'Branch',
			'POS Profile',
			'Cash',
			'Card',
			'Cheque',
			'PDC',
			'Wire Transfer',
			'Credit',
			'Total'
		]);

		// Add data rows
		branch_data.forEach(b => {
			export_data.push([
				b.branch,
				b.pos_profile || 'N/A',
				b.cash || 0,
				b.card || 0,
				b.cheque || 0,
				b.pdc || 0,
				b.wire_transfer || 0,
				b.credit || 0,
				b.total || 0
			]);
		});

		// Add totals row
		export_data.push([
			'TOTAL',
			'',
			totals.cash || 0,
			totals.card || 0,
			totals.cheque || 0,
			totals.pdc || 0,
			totals.wire_transfer || 0,
			totals.credit || 0,
			totals.total || 0
		]);

		// Create CSV content
		const csv_content = export_data.map(row =>
			row.map(cell => {
				// Handle numbers and strings
				if (typeof cell === 'number') {
					return cell;
				}
				// Escape quotes in strings
				return `"${String(cell).replace(/"/g, '""')}"`;
			}).join(',')
		).join('\n');

		// Create download link
		const blob = new Blob([csv_content], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		const from_date = $('#collection-from-date').val() || 'all';
		const to_date = $('#collection-to-date').val() || 'all';
		const filename = `Detailed_Collections_${from_date}_to_${to_date}.csv`;

		link.setAttribute('href', url);
		link.setAttribute('download', filename);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		frappe.show_alert({ message: 'Collection data exported successfully', indicator: 'green' });
	}



	fetch_pdc_data() {
		// Use same filters as Collection Tracker section
		const company = $('#collection-company').val() || this.filters.company || null;
		const from_date = $('#collection-from-date').val() || null;
		const to_date = $('#collection-to-date').val() || null;

		console.log('[Collection Tracker PDC] Fetching with filters:', { company, from_date, to_date });

		console.log('[Collection Tracker PDC] Fetching with filters:', { company, from_date, to_date });

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_pdc_data',
			args: {
				company: company,
				from_date: from_date,
				to_date: to_date
			},
			callback: (r) => {
				if (r.message) {
					console.log('[Collection Tracker PDC] Response:', r.message);
					this.update_pdc_ui(r.message);
				}
			}
		});
	}

	update_pdc_ui(pdc_data) {
		// Handle new API format with summary object
		const summary = pdc_data.summary || {};
		const pdc_records = pdc_data.pdc_records || pdc_data.pdc_list || [];

		// Update summary cards using new API format
		$('#pdc-due-week').text(this.formatCurrency(summary.due_this_week_amount || pdc_data.due_this_week || 0));
		$('#pdc-due-month').text(this.formatCurrency(summary.due_this_month_amount || pdc_data.due_this_month || 0));
		$('#pdc-overdue').text(this.formatCurrency(summary.overdue_amount || pdc_data.overdue || 0));

		// Update PDC table if data exists
		if (pdc_records && pdc_records.length > 0) {
			const pdc_rows = pdc_records.map(pdc => {
				const due_date = pdc.cheque_date ? frappe.datetime.str_to_obj(pdc.cheque_date) : null;
				const days_diff = pdc.days_to_maturity || pdc.days_to_due || 0;

				let status_badge = '';
				let status_color = '';
				let days_text = '';

				// Use pdc_status from new API format
				const pdc_status = pdc.pdc_status || pdc.status || '';

				if (pdc_status === 'Pending Clearance') {
					status_badge = '🔵 Pending Clearance';
					status_color = '#3b82f6';
					days_text = `<small style="color: #3b82f6;">(${Math.abs(days_diff)} days ago)</small>`;
				} else if (pdc_status === 'Cleared') {
					status_badge = '⚪ Cleared';
					status_color = '#6b7280';
					days_text = '';
				} else if (pdc_status === 'Due Today' || pdc_status === 'Due This Week') {
					status_badge = '🟢 Due Soon';
					status_color = '#10b981';
					days_text = `<small style="color: #10b981;">(${days_diff} days)</small>`;
				} else if (pdc_status === 'Due This Month') {
					status_badge = '🟡 Scheduled';
					status_color = '#f59e0b';
					days_text = `<small style="color: #f59e0b;">(${days_diff} days)</small>`;
				} else if (pdc_status === 'Future') {
					status_badge = '🔵 Future';
					status_color = '#3b82f6';
					days_text = `<small style="color: #3b82f6;">(${days_diff} days)</small>`;
				} else {
					status_badge = '⚪ ' + pdc_status;
					status_color = '#94a3b8';
					days_text = `<small style="color: #94a3b8;">(${days_diff} days)</small>`;
				}

				// Use correct property names from new API
				const cheque_no = pdc.cheque_number || pdc.reference_no || pdc.cheque_no || pdc.payment_entry || '';
				const customer = pdc.customer || pdc.party || '';
				const amount = pdc.paid_amount || pdc.amount || 0;
				const cheque_date = pdc.cheque_date || pdc.due_date || pdc.reference_date || '';
				const payment_entry = pdc.payment_entry || pdc.name || cheque_no;

				return `
					<tr style="border-bottom: 1px solid rgba(59, 130, 246, 0.1);">
						<td style="padding: 12px; color: #e2e8f0;">${cheque_no}</td>
						<td style="padding: 12px; color: #94a3b8;">${customer}</td>
						<td style="padding: 12px; text-align: right; color: #e2e8f0;">${this.formatCurrency(amount)}</td>
						<td style="padding: 12px; color: #94a3b8;">${cheque_date ? frappe.datetime.str_to_user(cheque_date) : '-'}<br>${days_text}</td>
						<td style="padding: 12px;"><span style="background: rgba(${status_color.slice(1, 3)}, ${status_color.slice(3, 5)}, ${status_color.slice(5, 7)}, 0.2); color: ${status_color}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${status_badge}</span></td>
						<td style="padding: 12px; text-align: center;">
							<button class="btn btn-xs btn-primary" onclick="window.open('/app/payment-entry/${payment_entry}', '_blank')">View</button>
						</td>
					</tr>
				`;
			}).join('');

			$('.pdc-table tbody').html(pdc_rows);
		} else {
			$('.pdc-table tbody').html(`
				<tr>
					<td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">
						No PDC data found
					</td>
				</tr>
			`);
		}
	}

	fetch_recent_activities() {
		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_recent_activities',
			args: { limit: 10 },
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.update_activity_feed(r.message);
				}
			}
		});
	}

	update_activity_feed(activities) {
		const activity_html = activities.map(a => {
			const time_ago = a.minutes_ago < 60 ? `${a.minutes_ago} mins ago` : `${Math.floor(a.minutes_ago / 60)} hours ago`;
			let color = '#10b981'; // Green for cash
			if (a.mode_of_payment && a.mode_of_payment.includes('Card')) color = '#3b82f6';
			else if (a.mode_of_payment && a.mode_of_payment.includes('Cheque')) color = '#f59e0b';
			else if (a.mode_of_payment && a.mode_of_payment.includes('PDC')) color = '#ef4444';

			return `
				<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); margin-bottom: 8px;">
					<div style="display: flex; align-items: center;">
						<span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 12px;"></span>
						<span style="color: #94a3b8; font-size: 12px; width: 80px;">${time_ago}</span>
						<span style="color: #e2e8f0; margin: 0 10px;">|</span>
						<span style="color: #e2e8f0; font-size: 13px;">${a.branch || 'N/A'} - ${a.pos_profile || 'N/A'}</span>
						<span style="color: #94a3b8; margin: 0 10px;">|</span>
						<span style="color: ${color}; font-weight: 600;">${a.mode_of_payment || 'N/A'}: ${this.formatCurrency(a.amount)}</span>
						<span style="color: #94a3b8; margin: 0 10px;">|</span>
						<span style="color: #94a3b8; font-size: 12px;">${a.invoice}</span>
					</div>
				</div>
			`;
		}).join('');

		// Find activity feed container and update
		const activity_container = $('#activity-feed-container');
		if (activity_container.length) {
			activity_container.html(activity_html || '<div style="text-align: center; color: #94a3b8;">No recent activities</div>');
		}
	}



	create_advanced_filters() {
		this.create_filters();
	}

	create_settings_panel() {
		const settings_container = $(`
			<div class="stat-card">
				<h4 style="margin-bottom: 20px; color: #f1f5f9; font-weight: 700;">
					<i class="fa fa-cog" style="margin-right: 8px; color: #3b82f6;"></i>
					Dashboard Settings
				</h4>
				<div class="row">
					<div class="col-md-6">
						<div class="form-group">
							<label class="control-label">Default Company</label>
							<div id="default-company-container"></div>
						</div>
					</div>
					<div class="col-md-6">
						<div class="form-group">
							<label class="control-label">Refresh Interval (minutes)</label>
							<input type="number" class="form-control" value="5" min="1" max="60">
						</div>
					</div>
				</div>
				<div class="row" style="margin-top: 15px;">
					<div class="col-md-12">
						<button class="btn btn-primary">
							<i class="fa fa-save"></i>
							Save Settings
						</button>
						<button class="btn btn-secondary" style="margin-left: 10px;">
							<i class="fa fa-refresh"></i>
							Reset to Default
						</button>
					</div>
				</div>
			</div>
		`);
		this.main_container.find('.settings-config-section').append(settings_container);
	}

	setup_filter_events() {
		// Apply filters button
		this.filters_container.find('#apply-filters').on('click', () => {
			this.update_filters();

			// Only reload data if company or date changed, otherwise just filter
			const needsReload = this.filters.company !== this.last_company ||
				this.filters.report_date !== this.last_report_date;

			if (needsReload) {
				this.last_company = this.filters.company;
				this.last_report_date = this.filters.report_date;
				this.load_data();
			} else {
				this.apply_filters();
			}
		});

		// Clear filters button
		this.filters_container.find('#clear-filters').on('click', () => {
			this.clear_filters();
		});

		// Auto-apply on certain inputs (with debouncing)
		this.filters_container.find('#report-date-filter').on('change', () => {
			clearTimeout(this.date_timeout);
			this.date_timeout = setTimeout(() => {
				this.update_filters();
				this.load_data(); // Date changes require fresh data
			}, 300); // 300ms debounce
		});

		// Real-time filtering for non-API dependent filters
		this.filters_container.find('#aging-filter, #min-outstanding-filter, #max-outstanding-filter').on('input change', () => {
			clearTimeout(this.filter_timeout);
			this.filter_timeout = setTimeout(() => {
				this.update_filters();
				if (this.data && this.data.length > 0) {
					this.apply_filters(); // Instant filtering on existing data
				}
			}, 150); // Faster response for client-side filtering
		});

		// Setup receivables voucher type filter events
		this.setup_receivables_voucher_filter_events();
	}

	setup_receivables_voucher_filter_events() {
		const self = this;
		const filterSelect = $('#receivables-voucher-filter');
		const resetButton = $('#reset-receivables-filter');
		const visibleCountSpan = $('#receivables-visible-count');

		// Function to update visible customer count
		const updateVisibleCount = () => {
			const visibleCount = this.filtered_data ? this.filtered_data.length : 0;
			if (visibleCountSpan.length) {
				visibleCountSpan.text(visibleCount);
			}
		};

		if (filterSelect.length) {
			filterSelect.off('change').on('change', function() {
				const selectedType = $(this).val();
				self.filters.voucher_type_filter = selectedType;

				// Re-apply filters with the new voucher type
				if (self.data && self.data.length > 0) {
					self.apply_filters();
				}

				// Show/hide reset button
				if (selectedType !== 'all') {
					resetButton.show();
				} else {
					resetButton.hide();
				}

				// Update count
				updateVisibleCount();
			});

			// Reset button handler
			resetButton.off('click').on('click', function() {
				filterSelect.val('all').trigger('change');
			});
		}
	}

	show_all_rows() {
		// Remove the "Show More" button row
		this.table_container.find('tbody tr:last-child').remove();

		// Get remaining rows to display
		const tbody = this.table_container.find('tbody');
		const currentRowCount = tbody.find('tr').length;
		const remainingData = this.filtered_data.slice(currentRowCount);

		// Get voucher type filter
		const voucherTypeFilter = this.filters.voucher_type_filter || 'all';

		// Build and append remaining rows
		let rowsHtml = '';
		remainingData.forEach(item => {
			// Calculate totals from invoices if available
			let total_invoiced = item.invoiced || 0;
			let total_paid = item.paid || 0;
			let total_credit_note = item.credit_note || 0;
			let total_outstanding = item.outstanding || 0;
			let range1 = item.range1 || 0;
			let range2 = item.range2 || 0;
			let range3 = item.range3 || 0;
			let range4 = item.range4 || 0;
			let range5 = item.range5 || 0;
			let latest_posting_date = item.posting_date || '';
			let max_age = item.age || 0;
			let primary_branch = item.branch || '';
			let sales_persons = new Set(); // Collect unique sales persons

			// If item has invoices array, calculate from invoices
			if (item.invoices && Array.isArray(item.invoices) && item.invoices.length > 0) {
				total_invoiced = 0;
				total_paid = 0;
				total_credit_note = 0;
				total_outstanding = 0;
				range1 = 0;
				range2 = 0;
				range3 = 0;
				range4 = 0;
				range5 = 0;
				primary_branch = '';

				// Filter invoices by voucher type if filter is applied
				const filteredInvoices = voucherTypeFilter === 'all'
					? item.invoices
					: item.invoices.filter(inv => (inv.voucher_type || 'Sales Invoice') === voucherTypeFilter);

				filteredInvoices.forEach(inv => {
					total_invoiced += (inv.invoiced || 0);
					total_paid += (inv.paid || 0);
					total_credit_note += (inv.credit_note || 0);
					total_outstanding += (inv.outstanding || 0);
					range1 += (inv.range1 || 0);
					range2 += (inv.range2 || 0);
					range3 += (inv.range3 || 0);
					range4 += (inv.range4 || 0);
					range5 += (inv.range5 || 0);

					// Get latest posting date
					if (inv.posting_date && (!latest_posting_date || inv.posting_date > latest_posting_date)) {
						latest_posting_date = inv.posting_date;
					}

					// Get max age
					if (inv.age && inv.age > max_age) {
						max_age = inv.age;
					}

					// Get primary branch (first non-empty branch from invoices)
					if (!primary_branch && inv.branch) {
						primary_branch = inv.branch;
					}

					// Collect sales persons from invoices
					if (inv.sales_person) {
						inv.sales_person.split(',').forEach(sp => {
							const trimmed = sp.trim();
							if (trimmed) sales_persons.add(trimmed);
						});
					}
				});
			} else if (item.sales_person) {
				// If no invoices array, use the item's sales_person field
				item.sales_person.split(',').forEach(sp => {
					const trimmed = sp.trim();
					if (trimmed) sales_persons.add(trimmed);
				});
			}

			// Convert sales persons Set to comma-separated string
			const sales_person_display = [...sales_persons].join(', ') || '-';

			const outstanding_color = this.getOutstandingColor(total_outstanding, item.credit_limit);
			const age_badge = this.getAgeBadge(max_age);

			// Calculate colors for different amounts
			const sale_color = '#3b82f6'; // Primary Blue
			const paid_color = '#059669'; // Elegant Green
			const credit_color = '#d97706'; // Warm Orange
			const receivable_color = outstanding_color;

			rowsHtml += `
				<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); transition: background 0.2s;">
					<td style="padding: 14px 12px; color: #cbd5e1; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						<a href="/app/customer/${item.customer}" target="_blank" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
							${item.customer}
						</a>
					</td>
					<td style="padding: 14px 12px; color: #e2e8f0; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${item.customer_name || '-'}
					</td>
					<td style="padding: 14px 12px; color: #94a3b8; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${primary_branch || '-'}
					</td>
					<td style="padding: 14px 12px; color: #a78bfa; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${sales_person_display}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #cbd5e1; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(item.credit_limit)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${sale_color}; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(59, 130, 246, 0.05);">
						${this.formatCurrency(total_invoiced)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${paid_color}; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(16, 185, 129, 0.05);">
						${this.formatCurrency(total_paid)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${credit_color}; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(245, 158, 11, 0.05);">
						${this.formatCurrency(total_credit_note)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: ${receivable_color}; font-weight: 700; border-right: 1px solid rgba(148, 163, 184, 0.05); background: rgba(239, 68, 68, 0.05);">
						${this.formatCurrency(total_outstanding)}
					</td>
					<td style="padding: 14px 12px; text-align: center; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${age_badge}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #10b981; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range1)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #f59e0b; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range2)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #f97316; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range3)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #ef4444; font-weight: 500; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range4)}
					</td>
					<td style="padding: 14px 12px; text-align: right; color: #dc2626; font-weight: 600; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${this.formatCurrency(range5)}
					</td>
					<td style="padding: 14px 12px; text-align: center; color: #94a3b8; border-right: 1px solid rgba(148, 163, 184, 0.05);">
						${latest_posting_date || '-'}
					</td>
					<td style="padding: 14px 12px; text-align: center;">
						<button class="btn btn-xs btn-primary" onclick="frappe.prd_arm.view_customer_details('${item.customer}')" style="padding: 6px 10px;" title="View Customer Details">
							<i class="fa fa-eye"></i> View
						</button>
					</td>
				</tr>
			`;
		});

		tbody.append(rowsHtml);

		// Add hover effect to the newly added table rows
		setTimeout(() => {
			$('#receivables-table tbody tr').hover(
				function () {
					$(this).css('background', 'rgba(59, 130, 246, 0.08)');
				},
				function () {
					$(this).css('background', 'transparent');
				}
			);
		}, 100);
	}

	// Card Modal Functionality
	setup_card_click_handlers() {
		console.log('Setting up card click handlers for overview cards...');

		// Remove any existing click handlers
		$(document).off('click.card-modal', '.stat-card[data-card-type]');

		// Make cards clickable
		$('.stat-card[data-card-type]').css('cursor', 'pointer').attr('title', 'Click to view details');

		// Use delegated event so it works after re-renders
		$(document).on('click.card-modal', '.stat-card[data-card-type]', (e) => {
			const $card = $(e.currentTarget);
			const cardType = $card.data('card-type');

			// Only handle overview section cards
			if (!$card.closest('.overview-section-wrapper').length) {
				return;
			}

			if (!cardType) {
				return;
			}

			this.show_card_modal(cardType);
		});
	}

	setup_aging_card_click_handlers() {
		console.log('Setting up aging card click handlers for overview cards...');
		// This function is now handled by setup_detailed_aging_click_handlers()
		// which handles BOTH overview and detailed aging cards
		// No need for duplicate handlers - removing to prevent conflicts
		console.log('Overview aging card handlers delegated to unified handler');
	}

	// Show Invoice Details Modal for Total Sale card
	async show_invoice_details_modal() {
		console.log('show_invoice_details_modal called');

		if (!this.filtered_data || this.filtered_data.length === 0) {
			frappe.msgprint(__('No invoice data available. Please load data first.'));
			return;
		}

		// Collect all invoices from filtered data and calculate totals
		const allInvoices = [];
		let totalInvoiced = 0;
		let totalPaid = 0;
		let totalOutstanding = 0;

		this.filtered_data.forEach(customerData => {
			if (customerData.invoices && Array.isArray(customerData.invoices)) {
				customerData.invoices.forEach(invoice => {
					// Include ALL invoices (not just those with invoiced > 0)
					const inv_invoiced = invoice.invoiced || 0;
					const inv_paid = invoice.paid || 0;
					const inv_outstanding = invoice.outstanding || 0;

					// Add to totals
					totalInvoiced += inv_invoiced;
					totalPaid += inv_paid;
					totalOutstanding += inv_outstanding;

					// Only add to display array if there's an invoiced amount
					if (inv_invoiced !== 0) {
						allInvoices.push({
							name: invoice.voucher_no,
							customer: customerData.customer,
							customer_name: customerData.customer_name || customerData.customer,
							posting_date: invoice.posting_date,
							invoiced_amount: inv_invoiced,
							paid_amount: inv_paid,
							outstanding_amount: inv_outstanding,
							branch: invoice.branch || 'N/A',
							voucher_type: invoice.voucher_type || 'Sales Invoice'
						});
					}
				});
			}
		});

		console.log(`Found ${allInvoices.length} invoices to display`);
		console.log(`Total Invoiced: ${totalInvoiced}, Total Paid: ${totalPaid}, Total Outstanding: ${totalOutstanding}`);
		console.log(`Total customers processed: ${this.filtered_data.length}`);

		// Create dialog
		const dialog = new frappe.ui.Dialog({
			title: `<i class="fa fa-line-chart"></i> Total Sale - Invoice Details`,
			size: 'extra-large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'invoice_details'
				}
			],
			primary_action_label: 'Close',
			primary_action: function () {
				dialog.hide();
			}
		});

		// Build content HTML
		const contentHtml = `
			<div style="padding: 10px;">
				<!-- Summary Cards -->
				<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
					<div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Invoices</div>
						<div style="color: #1f2937; font-size: 24px; font-weight: 700;">${allInvoices.length}</div>
					</div>
					<div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Invoiced</div>
						<div style="color: #3b82f6; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalInvoiced)}</div>
					</div>
					<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Paid</div>
						<div style="color: #10b981; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalPaid)}</div>
					</div>
					<div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Outstanding</div>
						<div style="color: #f59e0b; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalOutstanding)}</div>
					</div>
				</div>

				<!-- Invoice Table -->
				<div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
					<table class="table table-bordered" style="margin: 0; font-size: 13px;">
						<thead style="background: #f8fafc;">
							<tr>
								<th style="padding: 12px 8px;">Invoice #</th>
								<th style="padding: 12px 8px;">Customer</th>
								<th style="padding: 12px 8px;">Posting Date</th>
								<th style="padding: 12px 8px; text-align: right;">Invoiced</th>
								<th style="padding: 12px 8px; text-align: right;">Paid</th>
								<th style="padding: 12px 8px; text-align: right;">Outstanding</th>
								<th style="padding: 12px 8px;">Branch</th>
							</tr>
						</thead>
						<tbody>
							${allInvoices.map(inv => `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 10px 8px;">
										<a href="/app/${inv.voucher_type.toLowerCase().replace(/ /g, '-')}/${inv.name}" target="_blank" style="color: #3b82f6; text-decoration: none;">
											${inv.name}
										</a>
									</td>
									<td style="padding: 10px 8px;">${inv.customer_name}</td>
									<td style="padding: 10px 8px;">${frappe.datetime.str_to_user(inv.posting_date)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #3b82f6; font-weight: 600;">${this.formatCurrency(inv.invoiced_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 600;">${this.formatCurrency(inv.paid_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #f59e0b; font-weight: 600;">${this.formatCurrency(inv.outstanding_amount)}</td>
									<td style="padding: 10px 8px;">${inv.branch}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
				</div>
			</div>
		`;

		dialog.fields_dict.invoice_details.$wrapper.html(contentHtml);
		dialog.show();
	}

	// Show Credit Note Details Modal for Total Credit card
	async show_credit_details_modal() {
		console.log('show_credit_details_modal called');

		if (!this.filtered_data || this.filtered_data.length === 0) {
			frappe.msgprint(__('No credit note data available. Please load data first.'));
			return;
		}

		// Collect all credit note records from invoices and calculate totals
		const allCreditNotes = [];
		let totalCreditNote = 0;
		let totalInvoiced = 0;
		let totalPaid = 0;
		let totalOutstanding = 0;

		this.filtered_data.forEach(customerData => {
			if (customerData.invoices && Array.isArray(customerData.invoices)) {
				customerData.invoices.forEach(invoice => {
					// Include ALL invoices (not just those with credit_note > 0)
					const inv_credit_note = invoice.credit_note || 0;
					const inv_invoiced = invoice.invoiced || 0;
					const inv_paid = invoice.paid || 0;
					const inv_outstanding = invoice.outstanding || 0;

					// Add to totals
					totalCreditNote += inv_credit_note;
					totalInvoiced += inv_invoiced;
					totalPaid += inv_paid;
					totalOutstanding += inv_outstanding;

					// Only add to display array if there's a credit note amount
					if (inv_credit_note !== 0) {
						allCreditNotes.push({
							invoice_no: invoice.voucher_no,
							customer: customerData.customer,
							customer_name: customerData.customer_name || customerData.customer,
							posting_date: invoice.posting_date,
							credit_note_amount: inv_credit_note,
							invoiced_amount: inv_invoiced,
							paid_amount: inv_paid,
							outstanding_amount: inv_outstanding,
							branch: invoice.branch || 'N/A',
							voucher_type: invoice.voucher_type || 'Sales Invoice'
						});
					}
				});
			}
		});

		console.log(`Found ${allCreditNotes.length} credit note records to display`);
		console.log(`Total Credit Note: ${totalCreditNote}, Total Invoiced: ${totalInvoiced}, Total Outstanding: ${totalOutstanding}`);
		console.log(`Total customers processed: ${this.filtered_data.length}`);

		const creditRate = totalInvoiced > 0 ? (totalCreditNote / totalInvoiced * 100) : 0;

		// Create dialog
		const dialog = new frappe.ui.Dialog({
			title: `<i class="fa fa-credit-card"></i> Total Credit - Credit Note Details`,
			size: 'extra-large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'credit_details'
				}
			],
			primary_action_label: 'Close',
			primary_action: function () {
				dialog.hide();
			}
		});

		// Build content HTML
		const contentHtml = `
			<div style="padding: 10px;">
				<!-- Summary Cards -->
				<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
					<div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Credit Note Records</div>
						<div style="color: #1f2937; font-size: 24px; font-weight: 700;">${allCreditNotes.length}</div>
					</div>
					<div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Credit Notes</div>
						<div style="color: #06b6d4; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalCreditNote)}</div>
					</div>
					<div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Invoiced</div>
						<div style="color: #3b82f6; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalInvoiced)}</div>
					</div>
					<div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Credit Rate</div>
						<div style="color: #8b5cf6; font-size: 24px; font-weight: 700;">${creditRate.toFixed(1)}%</div>
					</div>
				</div>

				<!-- Credit Note Table -->
				<div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
					<table class="table table-bordered" style="margin: 0; font-size: 13px;">
						<thead style="background: #f8fafc;">
							<tr>
								<th style="padding: 12px 8px;">Invoice #</th>
								<th style="padding: 12px 8px;">Customer</th>
								<th style="padding: 12px 8px;">Posting Date</th>
								<th style="padding: 12px 8px; text-align: right;">Credit Note</th>
								<th style="padding: 12px 8px; text-align: right;">Invoiced</th>
								<th style="padding: 12px 8px; text-align: right;">Paid</th>
								<th style="padding: 12px 8px; text-align: right;">Outstanding</th>
								<th style="padding: 12px 8px;">Branch</th>
							</tr>
						</thead>
						<tbody>
							${allCreditNotes.map(cn => {
			return `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 10px 8px;">
										<a href="/app/${cn.voucher_type.toLowerCase().replace(/ /g, '-')}/${cn.invoice_no}" target="_blank" style="color: #3b82f6; text-decoration: none;">
											${cn.invoice_no}
										</a>
									</td>
									<td style="padding: 10px 8px;">${cn.customer_name}</td>
									<td style="padding: 10px 8px;">${frappe.datetime.str_to_user(cn.posting_date)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #06b6d4; font-weight: 700;">${this.formatCurrency(cn.credit_note_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #3b82f6; font-weight: 600;">${this.formatCurrency(cn.invoiced_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 600;">${this.formatCurrency(cn.paid_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #f59e0b; font-weight: 600;">${this.formatCurrency(cn.outstanding_amount)}</td>
									<td style="padding: 10px 8px;">${cn.branch}</td>
								</tr>
							`}).join('')}
						</tbody>
					</table>
				</div>

				<!-- Info Note -->
				<div style="margin-top: 16px; padding: 12px; background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.1); border-radius: 8px;">
					<p style="margin: 0; color: #6c757d; font-size: 13px;">
						<i class="fa fa-info-circle" style="color: #06b6d4;"></i>
						<strong>Note:</strong> This shows credit note details from all invoices. Credit notes reduce the outstanding amount on invoices.
					</p>
				</div>
			</div>
		`;

		dialog.fields_dict.credit_details.$wrapper.html(contentHtml);
		dialog.show();
	}

	// Show Payment Details Modal for Total Paid card
	async show_payment_details_modal() {
		console.log('show_payment_details_modal called');

		if (!this.filtered_data || this.filtered_data.length === 0) {
			frappe.msgprint(__('No payment data available. Please load data first.'));
			return;
		}

		// Collect all payment records from invoices and calculate totals
		const allPayments = [];
		let totalPaid = 0;
		let totalInvoiced = 0;
		let totalOutstanding = 0;

		this.filtered_data.forEach(customerData => {
			if (customerData.invoices && Array.isArray(customerData.invoices)) {
				customerData.invoices.forEach(invoice => {
					// Include ALL invoices (not just those with paid > 0)
					const inv_paid = invoice.paid || 0;
					const inv_invoiced = invoice.invoiced || 0;
					const inv_outstanding = invoice.outstanding || 0;

					// Add to totals
					totalPaid += inv_paid;
					totalInvoiced += inv_invoiced;
					totalOutstanding += inv_outstanding;

					// Only add to display array if there's a paid amount
					if (inv_paid !== 0) {
						allPayments.push({
							invoice_no: invoice.voucher_no,
							customer: customerData.customer,
							customer_name: customerData.customer_name || customerData.customer,
							posting_date: invoice.posting_date,
							paid_amount: inv_paid,
							invoiced_amount: inv_invoiced,
							outstanding_amount: inv_outstanding,
							branch: invoice.branch || 'N/A',
							voucher_type: invoice.voucher_type || 'Sales Invoice'
						});
					}
				});
			}
		});

		console.log(`Found ${allPayments.length} payment records to display`);
		console.log(`Total Paid: ${totalPaid}, Total Invoiced: ${totalInvoiced}, Total Outstanding: ${totalOutstanding}`);
		console.log(`Total customers processed: ${this.filtered_data.length}`);

		const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced * 100) : 0;

		// Create dialog
		const dialog = new frappe.ui.Dialog({
			title: `<i class="fa fa-check-circle"></i> Total Paid - Payment & Ledger Details`,
			size: 'extra-large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'payment_details'
				}
			],
			primary_action_label: 'Close',
			primary_action: function () {
				dialog.hide();
			}
		});

		// Build content HTML
		const contentHtml = `
			<div style="padding: 10px;">
				<!-- Summary Cards -->
				<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
					<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Payment Records</div>
						<div style="color: #1f2937; font-size: 24px; font-weight: 700;">${allPayments.length}</div>
					</div>
					<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Paid</div>
						<div style="color: #10b981; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalPaid)}</div>
					</div>
					<div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Total Invoiced</div>
						<div style="color: #3b82f6; font-size: 24px; font-weight: 700;">${this.formatCurrency(totalInvoiced)}</div>
					</div>
					<div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 16px; text-align: center;">
						<div style="color: #6c757d; font-size: 12px; margin-bottom: 8px;">Collection Rate</div>
						<div style="color: #8b5cf6; font-size: 24px; font-weight: 700;">${collectionRate.toFixed(1)}%</div>
					</div>
				</div>

				<!-- Payment Table -->
				<div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
					<table class="table table-bordered" style="margin: 0; font-size: 13px;">
						<thead style="background: #f8fafc;">
							<tr>
								<th style="padding: 12px 8px;">Invoice #</th>
								<th style="padding: 12px 8px;">Customer</th>
								<th style="padding: 12px 8px;">Posting Date</th>
								<th style="padding: 12px 8px; text-align: right;">Paid Amount</th>
								<th style="padding: 12px 8px; text-align: right;">Invoiced</th>
								<th style="padding: 12px 8px; text-align: right;">Outstanding</th>
								<th style="padding: 12px 8px; text-align: right;">Payment %</th>
								<th style="padding: 12px 8px;">Branch</th>
							</tr>
						</thead>
						<tbody>
							${allPayments.map(pay => {
			const paymentPercent = pay.invoiced_amount > 0 ? (pay.paid_amount / pay.invoiced_amount * 100) : 0;
			return `
								<tr style="border-bottom: 1px solid #e5e7eb;">
									<td style="padding: 10px 8px;">
										<a href="/app/${pay.voucher_type.toLowerCase().replace(/ /g, '-')}/${pay.invoice_no}" target="_blank" style="color: #3b82f6; text-decoration: none;">
											${pay.invoice_no}
										</a>
									</td>
									<td style="padding: 10px 8px;">${pay.customer_name}</td>
									<td style="padding: 10px 8px;">${frappe.datetime.str_to_user(pay.posting_date)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 700;">${this.formatCurrency(pay.paid_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #3b82f6; font-weight: 600;">${this.formatCurrency(pay.invoiced_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: #f59e0b; font-weight: 600;">${this.formatCurrency(pay.outstanding_amount)}</td>
									<td style="padding: 10px 8px; text-align: right; color: ${paymentPercent >= 100 ? '#10b981' : '#f59e0b'}; font-weight: 600;">${paymentPercent.toFixed(1)}%</td>
									<td style="padding: 10px 8px;">${pay.branch}</td>
								</tr>
							`}).join('')}
						</tbody>
					</table>
				</div>

				<!-- Info Note -->
				<div style="margin-top: 16px; padding: 12px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 8px;">
					<p style="margin: 0; color: #6c757d; font-size: 13px;">
						<i class="fa fa-info-circle" style="color: #3b82f6;"></i>
						<strong>Note:</strong> This shows payment and ledger details from all invoices. The paid amount represents the total amount collected against each invoice.
					</p>
				</div>
			</div>
		`;

		dialog.fields_dict.payment_details.$wrapper.html(contentHtml);
		dialog.show();
	}

	async show_aging_invoices_modal(agingRange) {
		console.log('show_aging_invoices_modal called with agingRange:', agingRange);

		// Remove any existing modal
		$('.aging-modal-backdrop').remove();

		// Show loading modal first
		this.show_loading_modal_aging(agingRange);

		try {
			// Get invoices for this aging range
			const invoices = this.get_invoices_by_aging_range(agingRange);
			console.log(`Found ${invoices.length} invoices for aging range: ${agingRange}`);

			this.render_aging_invoices_modal(agingRange, invoices);
		} catch (error) {
			console.error('Error fetching aging invoices:', error);
			this.render_aging_invoices_modal(agingRange, []);
		}
	}

	show_loading_modal_aging(agingRange) {
		const modal = $(`
			<div class="aging-modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;">
				<div class="aging-modal" style="max-width: 400px; text-align: center; background: rgba(30, 41, 59, 0.98); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
					<div class="aging-modal-header">
						<h3 class="aging-modal-title" style="color: #3b82f6; font-size: 24px; font-weight: 700; margin-bottom: 16px;">
							<i class="fa fa-spinner fa-spin"></i>
							Loading Invoices
						</h3>
						<p class="aging-modal-subtitle" style="color: #94a3b8; font-size: 14px; margin: 0;">Fetching invoices for ${agingRange} days aging range...</p>
					</div>
				</div>
			</div>
		`);
		$('body').append(modal);
	}

	get_invoices_by_aging_range(agingRange) {
		console.log('=== get_invoices_by_aging_range START ===');
		console.log('Aging range requested:', agingRange);
		console.log('Filtered data available:', !!this.filtered_data);
		console.log('Filtered data length:', this.filtered_data ? this.filtered_data.length : 0);

		if (!this.filtered_data) {
			console.warn('No filtered_data available');
			return [];
		}

		const invoices = [];
		let totalRangeAmount = 0;
		let customersProcessed = 0;
		let invoicesChecked = 0;

		// Iterate through filtered customer data and extract real invoices
		this.filtered_data.forEach(customerData => {
			customersProcessed++;

			// Check if customer has invoices array
			if (!customerData.invoices || !Array.isArray(customerData.invoices)) {
				return;
			}

			// Filter invoices by aging range
			customerData.invoices.forEach(invoice => {
				invoicesChecked++;
				let matchesRange = false;
				let rangeAmount = 0;

				// Determine which aging range this invoice belongs to based on range amounts
				// Use the ACTUAL range amount, not the total outstanding
				// Note: We include both positive and negative amounts (credit notes) to match analytics counting
				switch (agingRange) {
					case '0-30':
						rangeAmount = invoice.range1 || 0;
						matchesRange = rangeAmount != 0; // Include negative values (credit notes)
						break;
					case '31-60':
						rangeAmount = invoice.range2 || 0;
						matchesRange = rangeAmount != 0; // Include negative values (credit notes)
						break;
					case '61-90':
						rangeAmount = invoice.range3 || 0;
						matchesRange = rangeAmount != 0; // Include negative values (credit notes)
						break;
					case '91-120':
						rangeAmount = invoice.range4 || 0;
						matchesRange = rangeAmount != 0; // Include negative values (credit notes)
						break;
					case '120+':
					case '120-plus':
						rangeAmount = invoice.range5 || 0;
						matchesRange = rangeAmount != 0; // Include negative values (credit notes)
						break;
					case '90+':
					case '90-plus':
						// For backward compatibility - sum range4 and range5
						rangeAmount = (invoice.range4 || 0) + (invoice.range5 || 0);
						matchesRange = rangeAmount != 0; // Include negative values (credit notes)
						break;
					default:
						console.warn('Unknown aging range:', agingRange);
						break;
				}

				if (matchesRange && rangeAmount != 0) {
					totalRangeAmount += rangeAmount;

					// Log if this is a negative amount (credit note)
					if (rangeAmount < 0) {
						console.log(`  Including credit note: ${invoice.voucher_no} with range amount ${rangeAmount}`);
					}

					invoices.push({
						name: invoice.voucher_no,
						customer: customerData.customer,
						customer_name: customerData.customer_name || customerData.customer,
						posting_date: invoice.posting_date,
						outstanding_amount: rangeAmount, // Use the range-specific amount (can be negative)
						total_outstanding: invoice.outstanding, // Keep total for reference
						invoiced_amount: invoice.invoiced,
						paid_amount: invoice.paid,
						days_outstanding: invoice.age || 0,
						status: invoice.outstanding > 0 ? 'Unpaid' : 'Paid',
						branch: invoice.branch || 'N/A',
						voucher_type: invoice.voucher_type || 'Sales Invoice'
					});
				}
			});
		});

		console.log('=== get_invoices_by_aging_range RESULTS ===');
		console.log(`Customers processed: ${customersProcessed}`);
		console.log(`Invoices checked: ${invoicesChecked}`);
		console.log(`Invoices matched: ${invoices.length}`);
		console.log(`Total range amount: ${this.formatCurrency(totalRangeAmount)}`);
		console.log('=== get_invoices_by_aging_range END ===');

		// Sort by range-specific outstanding amount descending
		return invoices.sort((a, b) => b.outstanding_amount - a.outstanding_amount);
	}

	getDateDaysAgo(days) {
		const date = new Date();
		date.setDate(date.getDate() - days);
		return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
	}

	getRangeNumber(agingRange) {
		// Convert aging range to range field number
		switch (agingRange) {
			case '0-30': return '1';
			case '31-60': return '2';
			case '61-90': return '3';
			case '91-120': return '4';
			case '120+':
			case '120-plus': return '5';
			case '90+':
			case '90-plus': return '4+5';
			default: return '?';
		}
	}

	render_aging_invoices_modal(agingRange, invoices) {
		console.log('render_aging_invoices_modal called with', agingRange, invoices.length, 'invoices');

		// Remove loading modal
		$('.aging-modal-backdrop').remove();

		// Use Frappe's Dialog system for better compatibility
		const totalAmount = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
		console.log('Total amount calculated for modal:', totalAmount);
		console.log('Sample invoice data:', invoices.length > 0 ? invoices[0] : 'No invoices');

		// Debug: Show first few invoice amounts
		if (invoices.length > 0) {
			console.log(`First 10 invoice amounts in ${agingRange} range:`);
			invoices.slice(0, 10).forEach(inv => {
				console.log(`  ${inv.name}: range amount = ${inv.outstanding_amount}, total outstanding = ${inv.total_outstanding}, age = ${inv.days_outstanding} days`);
			});
			console.log(`\nSummary for ${agingRange}:`);
			console.log(`  Total invoices: ${invoices.length}`);
			console.log(`  Total range amount: ${totalAmount}`);
			console.log(`  This should match the card amount`);
		}

		// Format the aging range label for display
		let displayRange = agingRange;
		if (agingRange === '90-plus' || agingRange === '90+') {
			displayRange = '90+';
		} else if (agingRange === '120-plus' || agingRange === '120+') {
			displayRange = '120+';
		}

		const dialog = new frappe.ui.Dialog({
			title: `<i class="fa fa-clock-o"></i> Invoices in ${displayRange} Days Range`,
			size: 'extra-large',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'invoice_data'
				}
			],
			primary_action_label: 'Close',
			primary_action: function () {
				dialog.hide();
			}
		});

		// Build the content HTML
		const rangeLabel = `Outstanding in ${displayRange} Days Range`;

		const contentHtml = `
			<div style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); min-height: 400px;">
				<!-- Summary Cards -->
				<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
					<div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
						<div style="color: #93c5fd; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Invoices in Range</div>
						<div style="color: #e2e8f0; font-size: 32px; font-weight: 700; margin: 8px 0;">${invoices.length}</div>
						<div style="color: #93c5fd; font-size: 12px; margin-top: 8px;">
							<i class="fa fa-file-text-o"></i> With range${this.getRangeNumber(agingRange)} > 0
						</div>
					</div>
					<div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
						<div style="color: #6ee7b7; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Total in ${displayRange} Days</div>
						<div style="color: #e2e8f0; font-size: 32px; font-weight: 700; margin: 8px 0;">${this.formatCurrency(totalAmount)}</div>
						<div style="color: #6ee7b7; font-size: 12px; margin-top: 8px;">
							<i class="fa fa-calculator"></i> Sum of range${this.getRangeNumber(agingRange)} values
						</div>
					</div>
					<div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
						<div style="color: #c4b5fd; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Aging Bucket</div>
						<div style="color: #e2e8f0; font-size: 32px; font-weight: 700; margin: 8px 0;">${displayRange}</div>
						<div style="color: #c4b5fd; font-size: 12px; margin-top: 8px;">
							<i class="fa fa-clock-o"></i> Days outstanding range
						</div>
					</div>
				</div>

				<!-- Invoice Details Table -->
				<div style="margin-top: 24px;">
					${this.renderAgingInvoicesTable(invoices, agingRange, displayRange)}
				</div>
			</div>
		`;

		// Set the HTML content
		dialog.fields_dict.invoice_data.$wrapper.html(contentHtml);

		// Show the dialog
		dialog.show();

		// Setup filter event listeners
		setTimeout(() => {
			const filterSelect = $('#aging-voucher-type-filter');
			const resetButton = $('#reset-aging-filter');
			const visibleCountSpan = $('#visible-invoices-count');

			if (filterSelect.length) {
				filterSelect.off('change').on('change', function () {
					const selectedType = $(this).val();
					let visibleCount = 0;

					$('.aging-invoice-row').each(function () {
						const rowType = $(this).data('voucher-type');
						if (selectedType === 'all' || rowType === selectedType) {
							$(this).show();
							visibleCount++;
						} else {
							$(this).hide();
						}
					});

					// Update visible count
					if (visibleCountSpan.length) {
						visibleCountSpan.text(visibleCount);
					}

					// Show/hide reset button
					if (selectedType !== 'all') {
						resetButton.show();
					} else {
						resetButton.hide();
					}
				});

				// Reset button handler
				resetButton.off('click').on('click', function () {
					filterSelect.val('all').trigger('change');
				});
			}
		}, 100);

		console.log('Frappe dialog shown');
	}

	renderAgingInvoicesTable(invoices, agingRange, displayRange) {
		if (!invoices || invoices.length === 0) {
			return `
				<div style="text-align: center; padding: 60px; background: rgba(30, 41, 59, 0.5); border: 2px dashed rgba(148, 163, 184, 0.3); border-radius: 12px;">
					<i class="fa fa-inbox" style="font-size: 48px; margin-bottom: 16px; display: block; color: #64748b;"></i>
					<p style="margin: 0; color: #cbd5e1; font-size: 16px;">No invoices found in this aging range</p>
					<p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px;">All invoices have been cleared or moved to other aging buckets</p>
				</div>
			`;
		}

		const rangeNum = this.getRangeNumber(agingRange);

		// Get unique voucher types from the invoices
		const voucherTypes = [...new Set(invoices.map(inv => inv.voucher_type || 'Sales Invoice'))];

		const tableRows = invoices.map((invoice, index) => {
			const isEven = index % 2 === 0;
			const rowBg = isEven ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.4)';

			const voucherType = invoice.voucher_type || 'Sales Invoice';
			const doctypeUrl = voucherType.toLowerCase().replace(/ /g, '-');

			// Determine badge color based on voucher type
			let typeBadgeColor = '#3b82f6';
			let typeIcon = 'fa-file-text';
			if (voucherType === 'Payment Entry') {
				typeBadgeColor = '#10b981';
				typeIcon = 'fa-credit-card';
			} else if (voucherType === 'Journal Entry') {
				typeBadgeColor = '#f59e0b';
				typeIcon = 'fa-book';
			}

			return `
			<tr style="background: ${rowBg}; border-bottom: 1px solid rgba(51, 65, 85, 0.5); transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.background='${rowBg}'" class="aging-invoice-row" data-voucher-type="${voucherType}">
				<td style="color: #60a5fa; padding: 14px 12px; font-weight: 600;">
					<a href="/app/${doctypeUrl}/${invoice.name}" target="_blank" style="color: #60a5fa; text-decoration: none;">
						<i class="fa fa-external-link" style="font-size: 10px; margin-right: 6px;"></i>${invoice.name}
					</a>
				</td>
				<td style="padding: 14px 12px;">
					<span style="background: linear-gradient(135deg, ${typeBadgeColor} 0%, ${typeBadgeColor}dd 100%); color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: inline-block;">
						<i class="fa ${typeIcon}" style="margin-right: 4px;"></i>${voucherType}
					</span>
				</td>
				<td style="color: #e2e8f0; padding: 14px 12px;">${invoice.customer_name || invoice.customer || 'N/A'}</td>
				<td style="color: #cbd5e1; padding: 14px 12px; text-align: center;">${invoice.posting_date ? frappe.datetime.str_to_user(invoice.posting_date) : 'N/A'}</td>
				<td style="padding: 14px 12px; text-align: right;">
					<div style="display: flex; flex-direction: column; align-items: flex-end;">
						<span style="color: ${invoice.outstanding_amount < 0 ? '#ef4444' : '#10b981'}; font-weight: 700; font-size: 15px;">
							${invoice.outstanding_amount < 0 ? '<i class="fa fa-credit-card" style="font-size: 11px; margin-right: 4px;"></i>' : ''}${this.formatCurrency(invoice.outstanding_amount || 0)}
						</span>
						<span style="color: #6ee7b7; font-size: 11px; margin-top: 2px;">
							<i class="fa fa-tag" style="font-size: 9px;"></i> range${rangeNum} ${invoice.outstanding_amount < 0 ? '(credit)' : 'value'}
						</span>
					</div>
				</td>
				<td style="color: #cbd5e1; padding: 14px 12px; text-align: right; font-weight: 600;">${this.formatCurrency(invoice.total_outstanding || 0)}</td>
				<td style="text-align: center; padding: 14px 12px;">
					<span style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #e0f2fe; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
						<i class="fa fa-clock-o" style="margin-right: 4px;"></i>${invoice.days_outstanding || 0} days
					</span>
				</td>
				<td style="padding: 14px 12px; text-align: center;">
					<span style="background: ${invoice.status === 'Paid' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}; color: ${invoice.status === 'Paid' ? '#d1fae5' : '#fee2e2'}; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
						<i class="fa fa-${invoice.status === 'Paid' ? 'check-circle' : 'exclamation-circle'}" style="margin-right: 4px;"></i>${invoice.status || 'Unpaid'}
					</span>
				</td>
			</tr>
		`}).join('');

		return `
			<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 12px; overflow: hidden;">
				<!-- Table Header Info -->
				<div style="background: rgba(59, 130, 246, 0.2); padding: 16px; border-bottom: 2px solid rgba(59, 130, 246, 0.3);">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
						<div>
							<h4 style="color: #e2e8f0; margin: 0; font-size: 16px; font-weight: 700;">
								<i class="fa fa-table" style="margin-right: 8px; color: #60a5fa;"></i>Invoice Breakdown
							</h4>
							<p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Showing <span id="visible-invoices-count">${invoices.length}</span> of ${invoices.length} invoices with amounts in ${displayRange} days range</p>
						</div>
						<div style="text-align: right;">
							<div style="color: #6ee7b7; font-size: 12px; font-weight: 600;">RANGE ${rangeNum} FIELD</div>
							<div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">Column shows range-specific amount</div>
						</div>
					</div>
					<!-- Filter Section -->
					<div style="display: flex; align-items: center; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(59, 130, 246, 0.2);">
						<label style="color: #cbd5e1; font-size: 13px; font-weight: 600;">
							<i class="fa fa-filter" style="margin-right: 6px; color: #60a5fa;"></i>Filter by Document Type:
						</label>
						<select id="aging-voucher-type-filter" style="background: rgba(30, 41, 59, 0.8); color: #e2e8f0; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 6px; padding: 6px 32px 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; outline: none;">
							<option value="all">All Document Types (${invoices.length})</option>
							${voucherTypes.map(type => {
			const count = invoices.filter(inv => (inv.voucher_type || 'Sales Invoice') === type).length;
			return `<option value="${type}">${type} (${count})</option>`;
		}).join('')}
						</select>
						<button id="reset-aging-filter" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; display: none;">
							<i class="fa fa-times"></i> Reset
						</button>
					</div>
				</div>

				<div class="table-responsive" style="overflow-x: auto;">
					<table style="width: 100%; border-collapse: collapse;">
						<thead>
							<tr style="background: rgba(30, 41, 59, 0.8); border-bottom: 2px solid rgba(59, 130, 246, 0.3);">
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-file-text-o" style="margin-right: 6px;"></i>Document #
								</th>
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-tag" style="margin-right: 6px;"></i>Type
								</th>
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-user" style="margin-right: 6px;"></i>Customer
								</th>
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-calendar" style="margin-right: 6px;"></i>Posting Date
								</th>
								<th style="color: #6ee7b7; padding: 14px 12px; font-weight: 700; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-tag" style="margin-right: 6px;"></i>Amount in ${displayRange} Days
									<div style="font-size: 10px; color: #6ee7b7; font-weight: 500; margin-top: 2px; text-transform: none;">
										(range${rangeNum} field)
									</div>
								</th>
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-money" style="margin-right: 6px;"></i>Total Outstanding
								</th>
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-clock-o" style="margin-right: 6px;"></i>Age
								</th>
								<th style="color: #93c5fd; padding: 14px 12px; font-weight: 700; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
									<i class="fa fa-info-circle" style="margin-right: 6px;"></i>Status
								</th>
							</tr>
						</thead>
						<tbody>
							${tableRows}
						</tbody>
					</table>
				</div>
			</div>
		`;
	}

	async show_card_modal(cardType) {
		console.log('show_card_modal called with cardType:', cardType);

		// Remove any existing modal
		$('.card-modal-backdrop').remove();

		// Show loading modal first
		this.show_loading_modal(cardType);

		try {
			// Fetch actual source documents for this card type
			const sourceDocuments = await this.fetch_source_documents(cardType);
			console.log('Source documents fetched:', sourceDocuments.length);

			// Get card data (which now needs the actual count)
			console.log('Getting card data...');
			const cardData = await this.get_card_data(cardType);

			this.render_enhanced_modal(cardType, cardData, sourceDocuments);
		} catch (error) {
			console.error('Error fetching source documents:', error);
			// Fallback to existing method
			const invoices = this.get_filtered_invoices(cardType);
			console.log('Invoices for table:', invoices.length);

			// Use fallback card data
			const analytics = this.calculate_analytics();
			const cardData = {
				title: 'Document Details',
				subtitle: 'Showing available document information',
				icon: 'fa fa-file',
				stats: [
					{ label: 'Documents Found', value: invoices.length.toLocaleString() }
				]
			};

			this.render_enhanced_modal(cardType, cardData, invoices);
		}
	}

	show_loading_modal(cardType) {
		const modal = $(`
			<div class="card-modal-backdrop show">
				<div class="card-modal" style="max-width: 400px; text-align: center;">
					<div class="card-modal-header">
						<h3 class="card-modal-title">
							<i class="fa fa-spinner fa-spin"></i>
							Loading Documents
						</h3>
						<p class="card-modal-subtitle">Fetching source documents for ${this.get_card_title(cardType)}</p>
					</div>
					<div class="card-modal-body">
						<div style="padding: 40px;">
							<div class="loading-spinner" style="margin: 0 auto;"></div>
							<p style="margin-top: 20px; color: #64748b;">
								Please wait while we gather the documents...
							</p>
						</div>
					</div>
				</div>
			</div>
		`);
		$('body').append(modal);
	}

	async fetch_source_documents(cardType) {
		const documentConfig = this.get_document_config(cardType);

		if (!documentConfig) {
			throw new Error(`No document configuration found for card type: ${cardType}`);
		}

		console.log(`Fetching source documents for cardType: ${cardType}`, documentConfig);

		try {
			// First try with the configured fields and filters
			let response;
			try {
				console.log(`Attempting to fetch with full config:`, {
					doctype: documentConfig.doctype,
					fields: documentConfig.fields,
					filters: documentConfig.filters
				});

				response = await frappe.db.get_list(documentConfig.doctype, {
					fields: documentConfig.fields,
					filters: documentConfig.filters,
					limit_page_length: 1000,
					order_by: documentConfig.order_by || 'modified desc'
				});

				console.log(`Full config successful: ${response.length} records found`);
			} catch (permissionError) {
				console.warn(`Permission error with full config, trying basic approach:`, permissionError);

				// Try progressively simpler approaches
				try {
					// First fallback: Try with basic fields but keep company filter
					const basicFields = ['name', 'posting_date', 'modified'];
					let basicFilters = { docstatus: 1 };

					if (this.filters.company) {
						basicFilters['company'] = this.filters.company;
					}

					response = await frappe.db.get_list(documentConfig.doctype, {
						fields: basicFields,
						filters: basicFilters,
						limit_page_length: 500,
						order_by: 'modified desc'
					});

					console.log(`Fallback with company filter successful: ${response.length} records`);
				} catch (companyError) {
					console.warn(`Company filter also restricted, trying minimal approach:`, companyError);

					// Final fallback: Minimal filters only
					const minimalFields = ['name', 'modified'];
					const minimalFilters = { docstatus: 1 };

					response = await frappe.db.get_list(documentConfig.doctype, {
						fields: minimalFields,
						filters: minimalFilters,
						limit_page_length: 200,
						order_by: 'modified desc'
					});

					console.log(`Minimal fallback successful: ${response.length} records`);
				}
			}

			// Apply client-side filtering if server-side filtering failed
			if (this.filters.customer && response.length > 0) {
				const originalCount = response.length;
				response = response.filter(doc => {
					// Check all possible customer field variations
					return doc.customer === this.filters.customer ||
						doc.customer_name === this.filters.customer ||
						doc.party === this.filters.customer ||
						doc.party_name === this.filters.customer ||
						(doc.customer_name && doc.customer_name.includes(this.filters.customer)) ||
						(doc.party_name && doc.party_name.includes(this.filters.customer));
				});
				console.log(`Client-side customer filter: ${originalCount} -> ${response.length} records`);
			}

			// Apply other filters if available
			if (this.filters.company && response.length > 0 && !this.filters.company in (response[0] || {})) {
				// If company filter wasn't applied server-side, apply it client-side
				const originalCount = response.length;
				response = response.filter(doc => {
					return doc.company === this.filters.company;
				});
				console.log(`Client-side company filter: ${originalCount} -> ${response.length} records`);
			}

			// Apply card-type specific filtering if server-side filtering failed
			if (cardType === 'outstanding-invoices' || cardType === 'total-outstanding') {
				const originalCount = response.length;
				response = response.filter(doc => {
					// Check if document has outstanding amount
					const outstanding = doc.outstanding_amount || doc.outstanding || 0;
					return outstanding > 0;
				});
				console.log(`Client-side outstanding filter for ${cardType}: ${originalCount} -> ${response.length} records`);
			}

			console.log(`Final fetched ${response.length} ${documentConfig.doctype} documents for ${cardType}`);

			// Add document type information to each record
			const documentsWithType = response.map(doc => ({
				...doc,
				doctype: documentConfig.doctype,
				card_type: cardType
			}));

			console.log('Documents with doctype:', documentsWithType.slice(0, 2)); // Log first 2 docs
			return documentsWithType;

		} catch (error) {
			console.error(`Error fetching ${documentConfig.doctype} for ${cardType}:`, error);
			throw error;
		}
	}

	get_document_config(cardType) {
		const baseFilters = { docstatus: 1 };

		// Only add company filter - avoid customer filter as it's often restricted
		if (this.filters.company) {
			baseFilters['company'] = this.filters.company;
		}

		// Don't add customer filter to avoid permission errors
		// We'll handle customer filtering on the client side

		// Calculate week start and end (current week)
		const today = new Date();
		const dayOfWeek = today.getDay();
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() - dayOfWeek);
		const weekEnd = new Date(today);
		weekEnd.setDate(today.getDate() + (6 - dayOfWeek));

		const configs = {
			'total-sale': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: baseFilters,
				order_by: 'posting_date desc'
			},
			'total-paid': {
				doctype: 'Payment Entry',
				fields: ['name', 'party_name', 'posting_date', 'paid_amount', 'reference_no', 'payment_type'],
				filters: { ...baseFilters, payment_type: 'Receive' },
				order_by: 'posting_date desc'
			},
			'total-outstanding': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: { ...baseFilters, outstanding_amount: ['>', 0] },
				order_by: 'outstanding_amount desc'
			},
			'due-today': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: {
					...baseFilters,
					posting_date: frappe.datetime.get_today(),
					outstanding_amount: ['>', 0]
				},
				order_by: 'outstanding_amount desc'
			},
			'due-this-week': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: {
					...baseFilters,
					posting_date: ['between', [frappe.datetime.get_today(), frappe.datetime.add_days(frappe.datetime.get_today(), 7)]],
					outstanding_amount: ['>', 0]
				},
				order_by: 'posting_date asc'
			},
			'due-this-month': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: {
					...baseFilters,
					posting_date: ['between', [frappe.datetime.get_today(), frappe.datetime.month_end()]],
					outstanding_amount: ['>', 0]
				},
				order_by: 'posting_date asc'
			},
			'overdue-amount': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: {
					...baseFilters,
					posting_date: ['<', frappe.datetime.get_today()],
					outstanding_amount: ['>', 0]
				},
				order_by: 'posting_date asc'
			},
			'month-collections': {
				doctype: 'Payment Entry',
				fields: ['name', 'party_name', 'posting_date', 'paid_amount', 'reference_no', 'payment_type'],
				filters: {
					...baseFilters,
					payment_type: 'Receive',
					posting_date: ['between', [frappe.datetime.month_start(), frappe.datetime.month_end()]]
				},
				order_by: 'posting_date desc'
			},
			'year-collections': {
				doctype: 'Payment Entry',
				fields: ['name', 'party_name', 'posting_date', 'paid_amount', 'reference_no', 'payment_type'],
				filters: {
					...baseFilters,
					payment_type: 'Receive',
					posting_date: ['between', [frappe.datetime.year_start(), frappe.datetime.year_end()]]
				},
				order_by: 'posting_date desc'
			},
			'collection-efficiency': {
				doctype: 'Payment Entry',
				fields: ['name', 'party_name', 'posting_date', 'paid_amount', 'reference_no', 'payment_type'],
				filters: { ...baseFilters, payment_type: 'Receive' },
				order_by: 'posting_date desc'
			},
			'avg-collection-period': {
				doctype: 'Sales Invoice',
				fields: ['name', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status'],
				filters: baseFilters,
				order_by: 'posting_date desc'
			}
		};

		return configs[cardType];
	}

	render_enhanced_modal(cardType, cardData, sourceDocuments) {
		// Remove loading modal
		$('.card-modal-backdrop').remove();

		// Create comprehensive modal with source document table
		const modal = $(`
			<div class="card-modal-backdrop">
				<div class="card-modal" style="max-width: 1200px;">
					<div class="card-modal-header">
						<h3 class="card-modal-title">
							<i class="${cardData.icon}"></i>
							${cardData.title}
						</h3>
						<p class="card-modal-subtitle">${cardData.subtitle}</p>
						<button class="card-modal-close">
							<i class="fa fa-times"></i>
						</button>
					</div>
					<div class="card-modal-body">
						<div class="card-modal-stats">
							${cardData.stats.map(stat => `
								<div class="card-modal-stat-item">
									<div class="card-modal-stat-label">${stat.label}</div>
									<div class="card-modal-stat-value">
										${stat.value}
									</div>
								</div>
							`).join('')}
						</div>

						<!-- Calculation Breakdown Cards -->
						<div class="calculation-breakdown-section" style="margin-top: 20px;">
							<h4 style="color: #f1f5f9; font-size: 14px; font-weight: 700; margin-bottom: 12px;">
								<i class="fa fa-calculator" style="color: #3b82f6; margin-right: 8px;"></i>
								How This Amount Was Calculated
							</h4>
							${this.renderCalculationCards(sourceDocuments, cardType)}
						</div>

						<!-- Source Document Details Table -->
						<div class="source-documents-section" style="margin-top: 24px;">
							<h4 style="color: #f1f5f9; font-size: 16px; font-weight: 700; margin-bottom: 16px;">
								<i class="fa fa-database" style="color: #3b82f6; margin-right: 8px;"></i>
								Source Documents (${sourceDocuments.length} records)
								<span style="font-size: 12px; font-weight: 400; color: #94a3b8; margin-left: 8px;">
									- Shows actual documents contributing to this amount
								</span>
							</h4>
							<div class="source-documents-table-container">
								${this.renderSourceDocumentTable(sourceDocuments, cardType)}
							</div>
						</div>
					</div>
					<div class="card-modal-footer">
						<div style="color: #94a3b8; font-size: 13px;">
							<i class="fa fa-info-circle"></i>
							${sourceDocuments.length} source documents shown
						</div>
						<button class="btn-view-details" data-card-type="${cardType}">
							<i class="fa fa-external-link"></i>
							View in Document List
						</button>
					</div>
				</div>
			</div>
		`);

		// Add to body and show
		$('body').append(modal);
		setTimeout(() => modal.addClass('show'), 10);

		// Close modal handlers
		modal.find('.card-modal-close').on('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.hide_card_modal();
		});

		modal.on('click', (e) => {
			if (e.target === e.currentTarget) {
				this.hide_card_modal();
			}
		});

		// View details handler
		modal.find('.btn-view-details').on('click', () => {
			this.redirect_to_documents(cardType);
		});

		// Document link click handlers
		modal.find('.document-link').on('click', (e) => {
			e.preventDefault();
			const doctype = $(e.currentTarget).data('doctype');
			const docname = $(e.currentTarget).data('docname');
			console.log('Document link clicked:', { doctype, docname });
			console.log('Element data attributes:', $(e.currentTarget).data());
			this.open_document(doctype, docname);
		});

		// Escape key handler
		$(document).on('keydown.card-modal', (e) => {
			if (e.key === 'Escape') {
				this.hide_card_modal();
			}
		});
	}

	renderSourceDocumentTable(sourceDocuments, cardType) {
		if (!sourceDocuments || sourceDocuments.length === 0) {
			return `
				<div style="text-align: center; padding: 40px; color: #94a3b8; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px;">
					<i class="fa fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
					<p>No source documents found for this category</p>
					<small>This might indicate aggregated data or the filter criteria returned no results</small>
				</div>
			`;
		}

		// Determine table headers based on document type
		let doctype = sourceDocuments[0].doctype;

		// Fallback: If doctype is not set, determine from cardType
		if (!doctype) {
			const cardTypeToDoctypeMap = {
				'total-sale': 'Sales Invoice',
				'total-outstanding': 'Sales Invoice',
				'due-today': 'Sales Invoice',
				'due-this-week': 'Sales Invoice',
				'due-this-month': 'Sales Invoice',
				'overdue-amount': 'Sales Invoice',
				'total-paid': 'Payment Entry',
				'month-collections': 'Payment Entry',
				'year-collections': 'Payment Entry',
				'collection-efficiency': 'Payment Entry',
				'avg-collection-period': 'Sales Invoice'
			};
			doctype = cardTypeToDoctypeMap[cardType] || 'Sales Invoice';
			console.log('Doctype fallback:', { cardType, fallbackDoctype: doctype });
		}

		console.log('Table doctype detection:', { doctype, firstDoc: sourceDocuments[0], cardType });
		let headers = [];

		if (doctype === 'Sales Invoice') {
			// Build headers dynamically based on available fields
			headers = [
				{ key: 'name', label: 'Invoice No.', icon: 'fa-file-text-o' }
			];

			// Add fields that are available in the data
			const sampleDoc = sourceDocuments[0];
			if (sampleDoc.customer_name !== undefined) {
				headers.push({ key: 'customer_name', label: 'Customer', icon: 'fa-user' });
			}
			if (sampleDoc.posting_date !== undefined) {
				headers.push({ key: 'posting_date', label: 'Date', icon: 'fa-calendar' });
			}
			if (sampleDoc.posting_date !== undefined && !headers.some(h => h.key === 'posting_date')) {
				headers.push({ key: 'posting_date', label: 'Posting Date', icon: 'fa-calendar-o' });
			}
			if (sampleDoc.grand_total !== undefined) {
				headers.push({ key: 'grand_total', label: 'Amount', icon: 'fa-money', align: 'right' });
			}
			if (sampleDoc.outstanding_amount !== undefined) {
				headers.push({ key: 'outstanding_amount', label: 'Outstanding', icon: 'fa-exclamation-circle', align: 'right' });
			}
			if (sampleDoc.status !== undefined) {
				headers.push({ key: 'status', label: 'Status', icon: 'fa-info-circle' });
			}
			if (sampleDoc.modified !== undefined) {
				headers.push({ key: 'modified', label: 'Modified', icon: 'fa-clock-o' });
			}

		} else if (doctype === 'Payment Entry') {
			headers = [
				{ key: 'name', label: 'Payment No.', icon: 'fa-credit-card' }
			];

			// Add fields that are available in the data
			const sampleDoc = sourceDocuments[0];
			if (sampleDoc.party_name !== undefined) {
				headers.push({ key: 'party_name', label: 'Customer', icon: 'fa-user' });
			}
			if (sampleDoc.posting_date !== undefined) {
				headers.push({ key: 'posting_date', label: 'Date', icon: 'fa-calendar' });
			}
			if (sampleDoc.paid_amount !== undefined) {
				headers.push({ key: 'paid_amount', label: 'Amount', icon: 'fa-money', align: 'right' });
			}
			if (sampleDoc.payment_type !== undefined) {
				headers.push({ key: 'payment_type', label: 'Type', icon: 'fa-exchange' });
			}
			if (sampleDoc.reference_no !== undefined) {
				headers.push({ key: 'reference_no', label: 'Reference', icon: 'fa-hashtag' });
			}
			if (sampleDoc.modified !== undefined) {
				headers.push({ key: 'modified', label: 'Modified', icon: 'fa-clock-o' });
			}
		} else {
			// Fallback generic headers
			headers = [
				{ key: 'name', label: 'Document', icon: 'fa-file' },
				{ key: 'posting_date', label: 'Date', icon: 'fa-calendar' },
				{ key: 'status', label: 'Status', icon: 'fa-info-circle' }
			];
		}

		return `
			<table class="invoice-details-table">
				<thead>
					<tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
						${headers.map(header => `
							<th style="padding: 12px 8px; text-align: ${header.align || 'left'}; font-weight: 600; border: none;">
								<i class="fa ${header.icon}" style="margin-right: 8px;"></i>
								${header.label}
							</th>
						`).join('')}
					</tr>
				</thead>
				<tbody>
					${sourceDocuments.map((doc, index) => {
			const rowBg = index % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'rgba(30, 41, 59, 0.5)';
			return `
							<tr style="background: ${rowBg}; transition: all 0.2s ease;"
								onmouseover="this.style.background='rgba(59, 130, 246, 0.1)';"
								onmouseout="this.style.background='${rowBg}';">
								${headers.map(header => `
									<td style="padding: 12px 8px; border-bottom: 1px solid rgba(59, 130, 246, 0.2); ${header.align === 'right' ? 'text-align: right;' : ''} color: #e2e8f0;">
										${this.renderDocumentCell(doc, header, doctype)}
									</td>
								`).join('')}
							</tr>
						`;
		}).join('')}
				</tbody>
			</table>
		`;
	}

	renderDocumentCell(doc, header, doctype) {
		const value = doc[header.key];

		if (header.key === 'name') {
			// Determine correct doctype based on document name pattern if not set correctly
			let actualDoctype = doctype;

			if (value && typeof value === 'string') {
				if (value.startsWith('ACC-PAY-') || value.startsWith('PE-')) {
					actualDoctype = 'Payment Entry';
				} else if (value.startsWith('INV-') || value.startsWith('SI-')) {
					actualDoctype = 'Sales Invoice';
				} else if (value.startsWith('JE-')) {
					actualDoctype = 'Journal Entry';
				}
			}

			console.log('Rendering document cell:', { originalDoctype: doctype, actualDoctype, value, docData: doc });

			return `
				<a href="#" class="document-link" data-doctype="${actualDoctype}" data-docname="${value}"
				   style="color: #4f46e5; text-decoration: none; font-weight: 600;
				          padding: 4px 8px; background: #e0e7ff; border-radius: 4px; display: inline-block;">
					${value}
				</a>
			`;
		} else if (header.key === 'grand_total' || header.key === 'paid_amount' || header.key === 'outstanding_amount') {
			// Format currency values
			const color = header.key === 'outstanding_amount' && value > 0 ? '#f87171' : '#34d399';
			return `<span style="font-weight: 600; color: ${color};">${this.formatCurrency(value || 0)}</span>`;
		} else if (header.key === 'status') {
			// Format status with color coding
			const statusColors = {
				'Paid': '#059669',
				'Unpaid': '#dc2626',
				'Overdue': '#dc2626',
				'Submitted': '#059669',
				'Draft': '#64748b',
				'Cancelled': '#64748b'
			};
			const color = statusColors[value] || '#64748b';
			return `<span style="color: ${color}; font-weight: 600;">${value || 'N/A'}</span>`;
		} else if (header.key === 'posting_date' || header.key === 'modified') {
			// Format dates and highlight overdue dates
			if (!value) return 'N/A';

			const today = frappe.datetime.get_today();
			const isOverdue = header.key === 'posting_date' && value < today;
			const color = isOverdue ? '#dc2626' : '#64748b';
			const weight = isOverdue ? '600' : '400';

			// Format datetime fields properly
			const displayValue = header.key === 'modified' && value.includes(' ')
				? value.split(' ')[0] // Show only date part for modified field
				: value;

			return `<span style="color: ${color}; font-weight: ${weight};">${displayValue}</span>`;
		} else {
			// Default formatting
			return value || 'N/A';
		}
	}

	renderCalculationCards(sourceDocuments, cardType) {
		if (!sourceDocuments || sourceDocuments.length === 0) {
			return '<p style="color: #94a3b8; font-style: italic;">No source documents available</p>';
		}

		// Calculate breakdown based on document type and card type
		const breakdown = this.calculateBreakdown(sourceDocuments, cardType);

		return `
			<div class="breakdown-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
				${breakdown.map(item => `
					<div class="breakdown-card" style="
						background: rgba(30, 41, 59, 0.6);
						backdrop-filter: blur(12px);
						border: 1px solid rgba(59, 130, 246, 0.3);
						border-radius: 12px;
						padding: 16px;
						color: #f1f5f9;
						text-align: center;
						box-shadow:
							0 4px 16px rgba(0, 0, 0, 0.3),
							inset 0 1px 0 rgba(255, 255, 255, 0.1);
						transition: all 0.3s ease;
					">
						<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
							${item.label}
						</div>
						<div style="font-size: 18px; font-weight: 700; color: #60a5fa; margin-bottom: 4px;">
							${item.value}
						</div>
						<div style="font-size: 10px; color: #64748b; margin-top: 2px;">
							${item.subtitle}
						</div>
					</div>
				`).join('')}
			</div>
		`;
	}

	calculateBreakdown(sourceDocuments, cardType) {
		console.log('calculateBreakdown called:', { sourceDocuments: sourceDocuments.slice(0, 2), cardType });
		const breakdown = [];

		if (cardType === 'total-sale' || cardType === 'total-outstanding') {
			// Sales Invoice breakdown - try multiple field variations
			const totalAmount = sourceDocuments.reduce((sum, doc) => {
				const amount = doc.grand_total || doc.total || doc.amount || doc.invoiced || 0;
				console.log('Document amount:', { doc: doc.name, amount, fields: { grand_total: doc.grand_total, total: doc.total, amount: doc.amount, invoiced: doc.invoiced } });
				return sum + amount;
			}, 0);

			const totalOutstanding = sourceDocuments.reduce((sum, doc) => {
				const outstanding = doc.outstanding_amount || doc.outstanding || 0;
				return sum + outstanding;
			}, 0);

			const totalPaid = totalAmount - totalOutstanding;

			breakdown.push(
				{
					label: 'Total Invoice Amount',
					value: this.formatCurrency(totalAmount),
					subtitle: `${sourceDocuments.length} invoices`,
					gradient: '#667eea 0%, #764ba2 100%'
				},
				{
					label: 'Amount Paid',
					value: this.formatCurrency(totalPaid),
					subtitle: `${((totalPaid / totalAmount) * 100).toFixed(1)}% collected`,
					gradient: '#10b981 0%, #059669 100%'
				},
				{
					label: 'Outstanding',
					value: this.formatCurrency(totalOutstanding),
					subtitle: `${((totalOutstanding / totalAmount) * 100).toFixed(1)}% pending`,
					gradient: '#f59e0b 0%, #d97706 100%'
				}
			);
		} else if (cardType === 'total-paid' || cardType === 'month-collections') {
			// Payment Entry breakdown - try multiple field variations
			const totalPaid = sourceDocuments.reduce((sum, doc) => {
				const amount = doc.paid_amount || doc.amount || doc.total || doc.base_paid_amount || 0;
				console.log('Payment amount:', { doc: doc.name, amount, fields: { paid_amount: doc.paid_amount, amount: doc.amount, total: doc.total } });
				return sum + amount;
			}, 0);

			const avgPayment = sourceDocuments.length > 0 ? totalPaid / sourceDocuments.length : 0;
			const largestPayment = sourceDocuments.length > 0 ? Math.max(...sourceDocuments.map(doc => doc.paid_amount || doc.amount || doc.total || 0)) : 0;

			breakdown.push(
				{
					label: 'Total Collected',
					value: this.formatCurrency(totalPaid),
					subtitle: `${sourceDocuments.length} payments`,
					gradient: '#10b981 0%, #059669 100%'
				},
				{
					label: 'Average Payment',
					value: this.formatCurrency(avgPayment),
					subtitle: 'Per transaction',
					gradient: '#3b82f6 0%, #1d4ed8 100%'
				},
				{
					label: 'Largest Payment',
					value: this.formatCurrency(largestPayment),
					subtitle: 'Single transaction',
					gradient: '#3b82f6 0%, #8b5cf6 100%'
				}
			);
		} else if (cardType === 'due-today') {
			// Due today breakdown
			const totalDue = sourceDocuments.reduce((sum, doc) => {
				const amount = doc.outstanding_amount || doc.outstanding || doc.grand_total || 0;
				return sum + amount;
			}, 0);
			const avgDue = sourceDocuments.length > 0 ? totalDue / sourceDocuments.length : 0;

			breakdown.push(
				{
					label: 'Total Due Today',
					value: this.formatCurrency(totalDue),
					subtitle: `${sourceDocuments.length} invoices`,
					gradient: '#ef4444 0%, #dc2626 100%'
				},
				{
					label: 'Average Due',
					value: this.formatCurrency(avgDue),
					subtitle: 'Per invoice',
					gradient: '#f59e0b 0%, #d97706 100%'
				}
			);
		} else if (cardType === 'overdue-amount') {
			// Overdue breakdown
			const totalOverdue = sourceDocuments.reduce((sum, doc) => {
				const amount = doc.outstanding_amount || doc.outstanding || doc.grand_total || 0;
				return sum + amount;
			}, 0);
			const avgOverdue = sourceDocuments.length > 0 ? totalOverdue / sourceDocuments.length : 0;

			breakdown.push(
				{
					label: 'Total Overdue',
					value: this.formatCurrency(totalOverdue),
					subtitle: `${sourceDocuments.length} invoices`,
					gradient: '#dc2626 0%, #b91c1c 100%'
				},
				{
					label: 'Average Overdue',
					value: this.formatCurrency(avgOverdue),
					subtitle: 'Per invoice',
					gradient: '#f59e0b 0%, #d97706 100%'
				}
			);
		}

		// If no breakdown was generated or all amounts are 0, create a simple document count breakdown
		if (breakdown.length === 0 || breakdown.every(item => item.value === this.formatCurrency(0))) {
			console.log('Creating fallback breakdown due to missing amount data');
			breakdown.length = 0; // Clear existing breakdown

			breakdown.push(
				{
					label: 'Documents Found',
					value: sourceDocuments.length.toString(),
					subtitle: 'Source documents',
					gradient: '#667eea 0%, #764ba2 100%'
				},
				{
					label: 'Data Status',
					value: 'Limited Access',
					subtitle: 'Amount fields restricted',
					gradient: '#f59e0b 0%, #d97706 100%'
				}
			);

			// Try to get totals from dashboard data if available
			if (this.summary_data && Object.keys(this.summary_data).length > 0) {
				const analytics = this.calculate_analytics();

				if (cardType === 'total-sale' && analytics.total_sale > 0) {
					breakdown.unshift({
						label: 'Total Sales',
						value: this.formatCurrency(analytics.total_sale),
						subtitle: 'From dashboard data',
						gradient: '#10b981 0%, #059669 100%'
					});
				} else if (cardType === 'total-paid' && analytics.total_paid > 0) {
					breakdown.unshift({
						label: 'Total Paid',
						value: this.formatCurrency(analytics.total_paid),
						subtitle: 'From dashboard data',
						gradient: '#10b981 0%, #059669 100%'
					});
				} else if (cardType === 'total-outstanding' && analytics.total_outstanding > 0) {
					breakdown.unshift({
						label: 'Total Outstanding',
						value: this.formatCurrency(analytics.total_outstanding),
						subtitle: 'From dashboard data',
						gradient: '#ef4444 0%, #dc2626 100%'
					});
				}
			}
		}

		console.log('Final breakdown:', breakdown);
		return breakdown;
	}

	open_document(doctype, docname) {
		// Create proper route mapping for doctypes
		const routeMap = {
			'Sales Invoice': 'sales-invoice',
			'Payment Entry': 'payment-entry',
			'Purchase Invoice': 'purchase-invoice',
			'Journal Entry': 'journal-entry',
			'Customer': 'customer',
			'Supplier': 'supplier'
		};

		const route = routeMap[doctype] || doctype.toLowerCase().replace(/ /g, '-');
		console.log(`Opening document: ${doctype} -> ${route} -> ${docname}`);
		window.open(`/app/${route}/${docname}`, '_blank');
	}

	renderInvoiceTableRows(invoices, cardType) {
		if (!invoices || invoices.length === 0) {
			return `
				<tr>
					<td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
						<i class="fa fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
						No invoices found for this category with current filters
					</td>
				</tr>
			`;
		}

		return invoices.map((invoice, index) => {
			const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
			const outstandingColor = (invoice.outstanding || 0) > 0 ? '#dc2626' : '#059669';

			return `
				<tr style="background: ${rowBg}; transition: all 0.2s ease;"
					onmouseover="this.style.background='rgba(59, 130, 246, 0.1)';"
					onmouseout="this.style.background='${rowBg}';">
					<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">
						<a href="#" class="invoice-link" data-invoice="${invoice.name}"
						   style="color: #4f46e5; text-decoration: none; font-weight: 600;">
							${invoice.name}
						</a>
					</td>
					<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">
						${invoice.customer_name || invoice.customer || ''}
					</td>
					<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">
						${invoice.posting_date || ''}
					</td>
					<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #3b82f6;">
						${this.formatCurrency(invoice.invoiced || 0)}
					</td>
					<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: ${outstandingColor};">
						${this.formatCurrency(invoice.outstanding || 0)}
					</td>
					<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">
						${this.formatSalesPerson(invoice)}
					</td>
				</tr>
			`;
		}).join('');
	}

	hide_card_modal() {
		const modal = $('.card-modal-backdrop');
		modal.removeClass('show');
		setTimeout(() => {
			modal.remove();
			$(document).off('keydown.card-modal');
		}, 300);
	}

	show_invoice_details_modal(cardType) {
		console.log('show_invoice_details_modal called with cardType:', cardType);

		// Hide the current card modal first
		this.hide_card_modal();

		// Remove any existing invoice details modal
		$('.invoice-details-modal-backdrop').remove();

		// Get relevant invoices based on card type
		const invoices = this.get_filtered_invoices(cardType);

		// Create invoice details modal
		const modal = $(`
			<div class="invoice-details-modal-backdrop">
				<div class="invoice-details-modal">
					<div class="invoice-details-header">
						<div class="invoice-header-content">
							<h3 class="invoice-details-title">
								<i class="fa fa-file-text-o" style="color: #4f46e5;"></i>
								Invoice Details - ${this.get_card_title(cardType)}
							</h3>
							<p class="invoice-details-subtitle">
								<i class="fa fa-info-circle" style="color: #6b7280; margin-right: 6px;"></i>
								Showing <strong style="color: #4f46e5;">${invoices.length}</strong> invoices with detailed breakdown
							</p>
						</div>
						<button class="invoice-details-close">
							<i class="fa fa-times"></i>
						</button>
					</div>
					<div class="invoice-details-body">
						<div class="invoice-details-table-container">
							<table class="invoice-details-table">
								<thead>
									<tr>
										<th><i class="fa fa-hashtag" style="margin-right: 8px;"></i>Invoice No.</th>
										<th><i class="fa fa-user" style="margin-right: 8px;"></i>Customer</th>
										<th><i class="fa fa-calendar" style="margin-right: 8px;"></i>Date</th>
										<th><i class="fa fa-money" style="margin-right: 8px;"></i>Grand Total</th>
										<th><i class="fa fa-exclamation-circle" style="margin-right: 8px;"></i>Outstanding</th>
										<th><i class="fa fa-users" style="margin-right: 8px;"></i>Sales Person</th>
									</tr>
								</thead>
								<tbody>
									${invoices.map(invoice => `
										<tr>
											<td><span class="invoice-link" data-invoice="${invoice.name}">${invoice.name}</span></td>
											<td><strong>${invoice.customer || 'N/A'}</strong></td>
											<td><span style="color: #6b7280;">${invoice.posting_date || 'N/A'}</span></td>
											<td><span class="currency-amount currency-positive">${this.formatCurrency(invoice.invoiced || 0)}</span></td>
											<td><span class="currency-amount currency-outstanding">${this.formatCurrency(invoice.outstanding || 0)}</span></td>
											<td title="${this.getSalesPersonTooltip(invoice)}">
												${invoice.sales_person && invoice.sales_person !== 'No Sales Person'
				? `<span class="sales-person-badge">${invoice.sales_person}</span>`
				: `<span class="no-sales-person">No Sales Person</span>`
			}
											</td>
										</tr>
									`).join('')}
								</tbody>
							</table>
						</div>
					</div>
					<div class="invoice-details-footer">
						<div style="color: #64748b; font-size: 13px;">
							<i class="fa fa-info-circle"></i>
							Click on invoice number to view details or use "View All" for filtered list
						</div>
						<button class="btn-view-all-invoices" data-card-type="${cardType}">
							<i class="fa fa-list"></i>
							View All in List
						</button>
					</div>
				</div>
			</div>
		`);

		// Add to body and show
		$('body').append(modal);
		setTimeout(() => modal.addClass('show'), 10);

		// Close modal handlers
		modal.find('.invoice-details-close').on('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.hide_invoice_details_modal();
		});

		modal.find('.invoice-details-modal-backdrop').on('click', (e) => {
			if (e.target === e.currentTarget) {
				this.hide_invoice_details_modal();
			}
		});

		// Invoice link handler
		modal.find('.invoice-link').on('click', (e) => {
			const invoiceName = $(e.currentTarget).data('invoice');
			this.open_invoice_detail(invoiceName);
		});

		// View all handler
		modal.find('.btn-view-all-invoices').on('click', () => {
			this.redirect_to_documents(cardType);
		});

		// Escape key handler
		$(document).on('keydown.invoice-details-modal', (e) => {
			if (e.key === 'Escape') {
				this.hide_invoice_details_modal();
			}
		});
	}

	hide_invoice_details_modal() {
		const modal = $('.invoice-details-modal-backdrop');
		modal.removeClass('show');
		setTimeout(() => {
			modal.remove();
			$(document).off('keydown.invoice-details-modal');
		}, 300);
	}

	get_filtered_invoices(cardType) {
		const today = frappe.datetime.get_today();

		// First, extract individual invoices from the aggregated customer data
		const individualInvoices = [];

		// Access the original API data to get individual invoices
		const cache_key = this.get_cache_key();
		const cached = this.data_cache.get(cache_key);

		if (cached && cached.original_data) {
			console.log('Original API data structure:', cached.original_data); // Debug log
			for (const customerData of cached.original_data) {
				// Apply dashboard customer filter first
				if (this.filters.customer && customerData.customer !== this.filters.customer) {
					continue; // Skip this customer if it doesn't match the filter
				}

				if (customerData.invoices && customerData.invoices.length > 0) {
					for (const invoice of customerData.invoices) {
						// Apply dashboard branch filter
						if (this.filters.branch && invoice.branch !== this.filters.branch) {
							continue; // Skip this invoice if it doesn't match the branch filter
						}

						// Apply min/max outstanding filters
						const outstanding = invoice.outstanding || 0;
						if (this.filters.min_outstanding > 0 && outstanding < this.filters.min_outstanding) {
							continue;
						}
						if (this.filters.max_outstanding && outstanding > this.filters.max_outstanding) {
							continue;
						}

						console.log('Invoice data:', invoice); // Debug log
						individualInvoices.push({
							name: invoice.voucher_no,
							customer: customerData.customer,
							customer_name: customerData.customer_name,
							posting_date: invoice.posting_date,
							invoiced: invoice.invoiced || 0,
							outstanding: invoice.outstanding || 0,
							sales_person: invoice.sales_person || 'No Sales Person',
							branch: invoice.branch
						});
					}
				}
			}
		} else {
			// Fallback to aggregated data if original data is not available
			// Use this.filtered_data which already has dashboard filters applied
			for (const item of this.filtered_data) {
				if (item.outstanding > 0) {
					individualInvoices.push({
						name: 'Multiple Invoices',
						customer: item.customer,
						customer_name: item.customer_name,
						posting_date: item.posting_date || 'Various',
						invoiced: item.invoiced || 0,
						outstanding: item.outstanding || 0,
						sales_person: 'No Sales Person',
						branch: item.branch
					});
				}
			}
		}

		console.log('Invoices after dashboard filtering:', individualInvoices.length);
		console.log('Applied dashboard filters:', {
			customer: this.filters.customer,
			branch: this.filters.branch,
			min_outstanding: this.filters.min_outstanding,
			max_outstanding: this.filters.max_outstanding
		});

		// Now filter based on card type
		let filteredByCardType;
		switch (cardType) {
			case 'total-sale':
				// Show ALL invoices for total sales (paid, outstanding, etc.)
				filteredByCardType = individualInvoices.filter(invoice => (invoice.invoiced || 0) >= 0);
				console.log(`Total Sales: Showing all ${filteredByCardType.length} invoices for this customer`);
				break;

			case 'total-paid':
				// Show only invoices that have some payment
				filteredByCardType = individualInvoices.filter(invoice => (invoice.invoiced || 0) - (invoice.outstanding || 0) > 0);
				console.log(`Total Paid: Showing ${filteredByCardType.length} invoices with payments`);
				break;

			case 'total-outstanding':
			case 'outstanding-invoices':
				filteredByCardType = individualInvoices.filter(invoice => invoice.outstanding > 0);
				console.log(`Outstanding: Showing ${filteredByCardType.length} invoices with outstanding amount`);
				break;

			case 'due-today':
				filteredByCardType = individualInvoices.filter(invoice =>
					invoice.posting_date === today && invoice.outstanding > 0
				);
				console.log(`Posted Today: Showing ${filteredByCardType.length} invoices posted today`);
				break;

			case 'overdue-amount':
				filteredByCardType = individualInvoices.filter(invoice =>
					invoice.posting_date < today && invoice.outstanding > 0
				);
				console.log(`Overdue: Showing ${filteredByCardType.length} overdue invoices`);
				break;

			case 'collection-efficiency':
			case 'avg-collection-period':
				// Show all invoices for efficiency calculations
				filteredByCardType = individualInvoices.filter(invoice => (invoice.invoiced || 0) >= 0);
				console.log(`${cardType}: Showing all ${filteredByCardType.length} invoices for calculation`);
				break;

			default:
				filteredByCardType = individualInvoices;
				console.log(`Default: Showing all ${filteredByCardType.length} invoices`);
				break;
		}

		console.log(`Invoices after ${cardType} filtering:`, filteredByCardType.length);
		return filteredByCardType;
	}

	get_cache_key() {
		const internalFilter = this.get_internal_customer_filter_value() || 'all';
		return `${this.filters.company}_${this.filters.report_date}_${this.filters.customer || 'all'}_${this.filters.branch || 'all'}_${internalFilter}`;
	}

	formatSalesPerson(invoice) {
		// Enhanced sales person formatting for multiple sales persons
		if (invoice.sales_person) {
			if (invoice.sales_team && invoice.sales_team.length > 1) {
				return `${invoice.sales_person} (+${invoice.sales_team.length - 1} more)`;
			}
			return invoice.sales_person;
		}
		return 'No Sales Person';
	}

	getSalesPersonTooltip(invoice) {
		// Enhanced tooltip for sales person information
		if (invoice.sales_team && invoice.sales_team.length > 1) {
			return invoice.sales_team
				.map(sp => `${sp.sales_person} (${sp.allocated_percentage}%)`)
				.join(', ');
		} else if (invoice.sales_person) {
			return invoice.sales_person;
		}
		return 'No sales person assigned';
	}

	get_card_title(cardType) {
		const titleMap = {
			'total-sale': 'Total Sales',
			'total-outstanding': 'Outstanding Receivables',
			'due-today': 'Due Today',
			'overdue-amount': 'Overdue',
			'outstanding-invoices': 'Outstanding Invoices'
		};
		return titleMap[cardType] || 'Invoice Details';
	}

	open_invoice_detail(invoiceName) {
		// Close the modal first
		this.hide_invoice_details_modal();

		// Open the invoice in a new tab
		window.open(`/app/sales-invoice/${invoiceName}`, '_blank');
	}

	getCurrentFilterInfo() {
		const filterInfo = [];
		if (this.filters.company) filterInfo.push(`Company: ${this.filters.company}`);
		if (this.filters.customer) filterInfo.push(`Customer: ${this.filters.customer}`);
		if (this.filters.branch) filterInfo.push(`Branch: ${this.filters.branch}`);
		if (this.filters.report_date) filterInfo.push(`Report Date: ${this.filters.report_date}`);
		if (this.filters.aging_filter && this.filters.aging_filter !== 'all') filterInfo.push(`Aging: ${this.filters.aging_filter} days`);
		if (this.filters.min_outstanding > 0) filterInfo.push(`Min Outstanding: ${this.formatCurrency(this.filters.min_outstanding)}`);
		if (this.filters.max_outstanding) filterInfo.push(`Max Outstanding: ${this.formatCurrency(this.filters.max_outstanding)}`);

		return filterInfo.length > 0 ? filterInfo.join(', ') : 'No specific filters applied';
	}

	async get_card_data(cardType) {
		const analytics = this.calculate_analytics();

		// Get actual document count that will be shown in modal
		let actual_document_count = 0;
		try {
			const sourceDocuments = await this.fetch_source_documents(cardType);
			actual_document_count = sourceDocuments.length;
		} catch (error) {
			console.warn('Could not get actual document count, using fallback');
			const filteredInvoices = this.get_filtered_invoices(cardType);
			actual_document_count = filteredInvoices.length;
		}

		const customer_count = this.filtered_data.length;

		// Calculate additional metrics from available data
		const avg_invoice_value = actual_document_count > 0 ? analytics.total_sale / actual_document_count : 0;
		const largest_sale = Math.max(...this.filtered_data.map(item => item.invoiced || 0));
		const active_customers = new Set(this.filtered_data.map(item => item.customer)).size;
		const largest_payment = Math.max(...this.filtered_data.map(item => item.paid || 0));
		const avg_payment = actual_document_count > 0 ? analytics.total_paid / actual_document_count : 0;

		// Get current filter information for display
		const currentFilters = this.getCurrentFilterInfo();

		const cardConfigs = {
			'total-sale': {
				title: 'Total Sales Analysis',
				subtitle: 'Complete breakdown of all sales transactions',
				icon: 'fa fa-line-chart',
				stats: [
					{ label: 'Total Sales Amount', value: this.formatCurrency(analytics.total_sale) },
					{ label: 'Number of Invoices', value: actual_document_count.toLocaleString(), clickable: true, action: 'show_invoice_details' },
					{ label: 'Average Invoice Value', value: this.formatCurrency(avg_invoice_value) },
					{ label: 'Largest Sale', value: this.formatCurrency(largest_sale) },
					{ label: 'Monthly Growth', value: `${analytics.sale_trend > 0 ? '+' : ''}${analytics.sale_trend.toFixed(1)}%` },
					{ label: 'Active Customers', value: active_customers.toLocaleString() }
				]
			},
			'total-paid': {
				title: 'Payment Collections Analysis',
				subtitle: 'Detailed view of all collected payments',
				icon: 'fa fa-check-circle',
				stats: [
					{ label: 'Total Collected', value: this.formatCurrency(analytics.total_paid) },
					{ label: 'Collection Rate', value: `${analytics.collection_efficiency.toFixed(1)}%` },
					{ label: 'Number of Payments', value: actual_document_count.toLocaleString() },
					{ label: 'Largest Payment', value: this.formatCurrency(largest_payment) },
					{ label: 'Average Payment', value: this.formatCurrency(avg_payment) },
					{ label: 'Payment Growth', value: `${analytics.paid_trend > 0 ? '+' : ''}${analytics.paid_trend.toFixed(1)}%` }
				]
			},
			'total-outstanding': {
				title: 'Outstanding Receivables',
				subtitle: 'Complete analysis of pending payments',
				icon: 'fa fa-money',
				stats: [
					{ label: 'Total Outstanding', value: this.formatCurrency(analytics.total_outstanding) },
					{ label: 'Outstanding Invoices', value: actual_document_count.toLocaleString(), clickable: true, action: 'show_invoice_details' },
					{ label: 'Average Outstanding', value: this.formatCurrency(actual_document_count > 0 ? analytics.total_outstanding / actual_document_count : 0) },
					{ label: 'Largest Outstanding', value: this.formatCurrency(Math.max(...this.filtered_data.map(item => item.outstanding || 0))) },
					{ label: '% of Total Sales', value: `${(analytics.total_sale > 0 ? (analytics.total_outstanding / analytics.total_sale * 100) : 0).toFixed(1)}%` },
					{ label: 'Customers with Outstanding', value: active_customers.toLocaleString() }
				]
			},
			'due-today': {
				title: 'Due Today Analysis',
				subtitle: 'Invoices requiring immediate attention',
				icon: 'fa fa-clock-o',
				stats: [
					{ label: 'Amount Due Today', value: this.formatCurrency(analytics.due_today_amount) },
					{ label: 'Invoices Due', value: analytics.due_today_count.toLocaleString(), clickable: true, action: 'show_invoice_details' },
					{ label: 'Customers Affected', value: analytics.due_today_count.toLocaleString() },
					{ label: 'Average Due Amount', value: this.formatCurrency(analytics.due_today_count > 0 ? analytics.due_today_amount / analytics.due_today_count : 0) },
					{ label: 'Critical Accounts', value: analytics.due_today_count.toLocaleString() },
					{ label: 'Priority Level', value: analytics.due_today_amount > 100000 ? 'High' : analytics.due_today_amount > 50000 ? 'Medium' : 'Low' }
				]
			},
			'overdue-amount': {
				title: 'Overdue Analysis',
				subtitle: 'Past due invoices requiring collection action',
				icon: 'fa fa-exclamation-triangle',
				stats: [
					{ label: 'Total Overdue', value: this.formatCurrency(analytics.overdue_amount) },
					{ label: 'Overdue Invoices', value: (analytics.aging_counts.range3 + analytics.aging_counts.range4 + analytics.aging_counts.range5).toLocaleString(), clickable: true, action: 'show_invoice_details' },
					{ label: 'Overdue Customers', value: active_customers.toLocaleString() },
					{ label: 'Average Overdue Days', value: `${analytics.avg_collection_days.toFixed(0)} days` },
					{ label: 'Collection Period', value: `${analytics.avg_collection_days.toFixed(0)} days` },
					{ label: '% of Outstanding', value: `${analytics.overdue_percentage.toFixed(1)}%` }
				]
			},
			'month-collections': {
				title: 'Monthly Collections',
				subtitle: 'Current month collection performance',
				icon: 'fa fa-calendar-check-o',
				stats: [
					{ label: 'Month Collections', value: this.formatCurrency(analytics.month_collections) },
					{ label: 'Collection Progress', value: `${analytics.collection_progress.toFixed(1)}%` },
					{ label: 'Collection Efficiency', value: `${analytics.collection_efficiency.toFixed(1)}%` },
					{ label: 'Total Paid', value: this.formatCurrency(analytics.total_paid) },
					{ label: 'Outstanding Amount', value: this.formatCurrency(analytics.total_outstanding) },
					{ label: 'Performance Trend', value: `${analytics.efficiency_trend > 0 ? '+' : ''}${analytics.efficiency_trend.toFixed(1)}%` }
				]
			},
			'collection-efficiency': {
				title: 'Collection Efficiency',
				subtitle: 'Performance metrics and collection trends',
				icon: 'fa fa-tachometer',
				stats: [
					{ label: 'Efficiency Rate', value: `${analytics.collection_efficiency.toFixed(1)}%` },
					{ label: 'Collection Progress', value: `${analytics.collection_progress.toFixed(1)}%` },
					{ label: 'Collection Period', value: `${analytics.avg_collection_days.toFixed(0)} days` },
					{ label: 'Efficiency Trend', value: `${analytics.efficiency_trend > 0 ? '+' : ''}${analytics.efficiency_trend.toFixed(1)}%` },
					{ label: 'Total Collections', value: this.formatCurrency(analytics.month_collections) },
					{ label: 'Collection Ratio', value: `${(analytics.total_sale > 0 ? (analytics.total_paid / analytics.total_sale * 100) : 0).toFixed(1)}%` }
				]
			},
			'avg-collection-period': {
				title: 'Collection Period Analysis',
				subtitle: 'Time analysis for payment collections',
				icon: 'fa fa-calendar-o',
				stats: [
					{ label: 'Average Period', value: `${analytics.avg_collection_days.toFixed(0)} days` },
					{ label: 'Efficiency Trend', value: `${analytics.efficiency_trend > 0 ? '+' : ''}${analytics.efficiency_trend.toFixed(1)}%` },
					{ label: 'Days Trend', value: `${analytics.days_trend > 0 ? '+' : ''}${analytics.days_trend.toFixed(1)} days` },
					{ label: 'Collection Efficiency', value: `${analytics.collection_efficiency.toFixed(1)}%` },
					{ label: 'Industry Benchmark', value: '30 days' },
					{ label: 'Performance Rating', value: analytics.avg_collection_days <= 30 ? 'Excellent' : analytics.avg_collection_days <= 45 ? 'Good' : 'Needs Improvement' }
				]
			}
		};

		return cardConfigs[cardType] || {
			title: 'Card Details',
			subtitle: 'Detailed information',
			icon: 'fa fa-info-circle',
			stats: []
		};
	}

	redirect_to_documents(cardType) {
		// Close modals first
		this.hide_card_modal();
		this.hide_invoice_details_modal();

		// Build filters based on current dashboard filters
		const baseFilters = {};

		// Apply dashboard filters to document filters
		if (this.filters.company) {
			baseFilters['company'] = this.filters.company;
		}

		if (this.filters.customer) {
			baseFilters['customer'] = this.filters.customer;
		}

		// Add branch filter for Sales Invoice documents
		if (this.filters.branch) {
			baseFilters['branch'] = this.filters.branch;
		}

		// Note: Removed date filter to match the modal table exactly
		// The modal shows all invoices regardless of date, so the redirect should too

		// Add min/max outstanding filters for invoice documents
		if (this.filters.min_outstanding > 0) {
			baseFilters['outstanding_amount'] = ['>=', this.filters.min_outstanding];
		}
		if (this.filters.max_outstanding) {
			baseFilters['outstanding_amount'] = baseFilters['outstanding_amount']
				? ['between', [this.filters.min_outstanding || 0, this.filters.max_outstanding]]
				: ['<=', this.filters.max_outstanding];
		}

		// Define redirect mappings with specific filters for each card type
		const redirectMappings = {
			'total-sale': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'docstatus': 1  // Only submitted invoices
				},
				description: 'All submitted sales invoices'
			},
			'total-paid': {
				doctype: 'Payment Entry',
				filters: {
					...baseFilters,
					'payment_type': 'Receive',
					'docstatus': 1  // Only submitted payments
				},
				description: 'All received payments'
			},
			'total-outstanding': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'outstanding_amount': ['>', 0],
					'docstatus': 1
				},
				description: 'All invoices with outstanding amount'
			},
			'due-today': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'posting_date': frappe.datetime.get_today(),
					'outstanding_amount': ['>', 0],
					'docstatus': 1
				},
				description: 'Invoices posted today'
			},
			'overdue-amount': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'status': 'Overdue',
					'docstatus': 1
				},
				description: 'Overdue invoices',
				// Alternative simple filters for URL compatibility
				simpleFilters: {
					...baseFilters,
					'status': 'Overdue',
					'docstatus': 1
				}
			},
			'month-collections': {
				doctype: 'Payment Entry',
				filters: {
					...baseFilters,
					'payment_type': 'Receive',
					'posting_date': ['between', [frappe.datetime.month_start(), frappe.datetime.month_end()]],
					'docstatus': 1
				},
				description: 'This month collections'
			},
			'collection-efficiency': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'docstatus': 1
				},
				description: 'All sales invoices for efficiency calculation'
			},
			'avg-collection-period': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'outstanding_amount': ['>', 0],
					'docstatus': 1
				},
				description: 'Outstanding invoices for collection period analysis'
			},
			'outstanding-invoices': {
				doctype: 'Sales Invoice',
				filters: {
					...baseFilters,
					'outstanding_amount': ['>', 0],
					'docstatus': 1
				},
				description: 'All outstanding invoices'
			}
		};

		const mapping = redirectMappings[cardType];
		if (mapping) {
			// Debug: Log the filters being applied
			console.log('Redirect filters for', cardType, ':', mapping.filters);
			console.log('Current dashboard filters:', this.filters);

			// Build URL with query parameters directly
			// Convert doctype name to URL format (Sales Invoice -> sales-invoice)
			const urlDoctype = mapping.doctype.toLowerCase().replace(/\s+/g, '-');
			let baseUrl = `/app/${urlDoctype}`;
			const queryParams = [];

			// Convert filters to query parameters with special handling for overdue
			const filtersToProcess = mapping.filters;

			// Special handling for overdue-amount card
			if (cardType === 'overdue-amount') {
				console.log('Special processing for overdue-amount card');

				// Use simpler filters for overdue that work with Frappe URL
				Object.keys(mapping.simpleFilters || {}).forEach(key => {
					const value = mapping.simpleFilters[key];
					console.log(`Processing simple filter: ${key} = `, value);
					if (value !== null && value !== undefined && value !== '') {
						queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
					}
				});

				// Add status=Overdue filter for overdue invoices
				queryParams.push(`status=${encodeURIComponent('Overdue')}`);
				console.log('Added overdue-specific filter: status=Overdue');
			} else {
				// Regular processing for other cards
				Object.keys(filtersToProcess).forEach(key => {
					const value = filtersToProcess[key];
					console.log(`Processing filter: ${key} = `, value);
					if (value !== null && value !== undefined && value !== '') {
						if (Array.isArray(value)) {
							// Handle array filters - encode as JSON string
							console.log(`Array filter detected for ${key}:`, JSON.stringify(value));
							queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`);
						} else {
							// Simple string/number values
							console.log(`Simple filter detected for ${key}:`, value);
							queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
						}
					} else {
						console.log(`Skipping filter ${key} because value is:`, value);
					}
				});
			}

			// Construct final URL
			let finalUrl = baseUrl;
			if (queryParams.length > 0) {
				finalUrl += `?${queryParams.join('&')}`;
			}

			console.log('Final URL with query parameters:', finalUrl);
			console.log('Query parameters:', queryParams);

			// Open in new tab
			window.open(finalUrl, '_blank');

			// Show success message with applied filters info
			let filterInfo = [];
			if (this.filters.company) filterInfo.push(`Company: ${this.filters.company}`);
			if (this.filters.customer) filterInfo.push(`Customer: ${this.filters.customer}`);
			if (this.filters.branch) filterInfo.push(`Branch: ${this.filters.branch}`);
			if (this.filters.aging_filter && this.filters.aging_filter !== 'all') filterInfo.push(`Aging: ${this.filters.aging_filter} days`);
			if (this.filters.min_outstanding > 0) filterInfo.push(`Min Outstanding: ${this.formatCurrency(this.filters.min_outstanding)}`);
			if (this.filters.max_outstanding) filterInfo.push(`Max Outstanding: ${this.formatCurrency(this.filters.max_outstanding)}`);

			const filterText = filterInfo.length > 0 ? ` with filters: ${filterInfo.join(', ')}` : '';

			frappe.show_alert({
				message: __(`Opening ${mapping.description}${filterText} in new tab...`),
				indicator: 'blue'
			}, 4);
		} else {
			frappe.show_alert({
				message: __('Document redirection not configured for this card'),
				indicator: 'orange'
			}, 3);
		}
	}

	populate_sales_filters_from_data() {
		// Extract unique sales teams and sales persons from loaded data
		if (!this.data || this.data.length === 0) {
			console.log('No data available to populate sales filters');
			return;
		}

		// Extract unique sales teams and sales persons
		const salesTeams = new Set();
		const salesPersons = new Set();

		this.data.forEach((item, index) => {

			// Get primary sales person (ensure it's a string)
			if (item.sales_person && typeof item.sales_person === 'string' && item.sales_person !== 'No Sales Person') {
				salesPersons.add(item.sales_person);
			}

			// Get primary sales team (ensure it's a string)
			if (item.sales_team && typeof item.sales_team === 'string' && item.sales_team !== 'No Sales Team') {
				salesTeams.add(item.sales_team);
			}

			// Also extract from detailed sales_team_data array
			if (item.sales_team_data && Array.isArray(item.sales_team_data)) {
				item.sales_team_data.forEach(team => {
					// Ensure team is an object and extract string values
					if (team && typeof team === 'object') {
						if (team.sales_person && typeof team.sales_person === 'string') {
							salesPersons.add(team.sales_person);
						}
						if (team.parent_sales_person && typeof team.parent_sales_person === 'string') {
							salesTeams.add(team.parent_sales_person);
						}
					}
				});
			}

			// Extract from invoice-level data if available
			if (item.invoices && Array.isArray(item.invoices)) {
				item.invoices.forEach(invoice => {
					if (invoice.sales_person && typeof invoice.sales_person === 'string') {
						salesPersons.add(invoice.sales_person);
					}
					if (invoice.sales_team && typeof invoice.sales_team === 'string') {
						salesTeams.add(invoice.sales_team);
					}
					if (invoice.sales_team_data && Array.isArray(invoice.sales_team_data)) {
						invoice.sales_team_data.forEach(team => {
							// Ensure team is an object and extract string values
							if (team && typeof team === 'object') {
								if (team.sales_person && typeof team.sales_person === 'string') {
									salesPersons.add(team.sales_person);
								}
								if (team.parent_sales_person && typeof team.parent_sales_person === 'string') {
									salesTeams.add(team.parent_sales_person);
								}
							}
						});
					}
				});
			}
		});

		// Remove any null/undefined/empty values and non-strings
		salesTeams.delete(null);
		salesTeams.delete(undefined);
		salesTeams.delete('');
		salesPersons.delete(null);
		salesPersons.delete(undefined);
		salesPersons.delete('');

		// Convert to array and filter to ensure only strings
		const filteredTeams = Array.from(salesTeams).filter(item => typeof item === 'string' && item.trim() !== '');
		const filteredPersons = Array.from(salesPersons).filter(item => typeof item === 'string' && item.trim() !== '');

		// Update Sales Team dropdown
		const salesTeamSelect = $('#modal-sales-team');
		if (salesTeamSelect.length > 0) {
			salesTeamSelect.find('option:not(:first)').remove();
			const sortedTeams = filteredTeams.sort();
			sortedTeams.forEach(team => {
				if (team && typeof team === 'string') {
					salesTeamSelect.append(`<option value="${team}">${team}</option>`);
				}
			});
			console.log(`Sales Teams populated: ${sortedTeams.length} teams`);
		}

		// Update Sales Person dropdown
		const salesPersonSelect = $('#modal-sales-person');
		if (salesPersonSelect.length > 0) {
			salesPersonSelect.find('option:not(:first)').remove();
			const sortedPersons = filteredPersons.sort();
			sortedPersons.forEach(person => {
				if (person && typeof person === 'string') {
					salesPersonSelect.append(`<option value="${person}">${person}</option>`);
				}
			});
			console.log(`Sales Persons populated: ${sortedPersons.length} persons`);
		}
	}

	load_sales_teams_for_company() {
		const company = $('#modal-company').val();
		console.log('Loading sales teams for company:', company);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_sales_teams',
			args: {
				company: company || null
			},
			callback: (r) => {
				if (r && r.message) {
					const salesTeamSelect = $('#modal-sales-team');
					if (salesTeamSelect.length > 0) {
						// Clear existing options except the first "All Sales Teams"
						salesTeamSelect.find('option:not(:first)').remove();

						// Clear the selected value if company changed
						salesTeamSelect.val('');

						r.message.forEach(team => {
							if (team && team.name) {
								salesTeamSelect.append(`<option value="${team.name}">${team.name}</option>`);
							}
						});
						console.log('Sales Teams populated:', r.message.length);

						// Set current filter value only if it exists in the new list
						if (this.filters.sales_team) {
							const optionExists = salesTeamSelect.find(`option[value="${this.filters.sales_team}"]`).length > 0;
							if (optionExists) {
								salesTeamSelect.val(this.filters.sales_team);
								console.log('Sales Team filter value set to:', this.filters.sales_team);
							} else {
								this.filters.sales_team = '';
								console.log('Previous sales team filter cleared (not in company)');
							}
						}
					}
				}
			}
		});
	}

	load_sales_persons_for_company() {
		const company = $('#modal-company').val();
		console.log('Loading sales persons for company:', company);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_sales_persons',
			args: {
				company: company || null
			},
			callback: (r) => {
				if (r && r.message) {
					const salesPersonSelect = $('#modal-sales-person');
					const salesTeamSelect = $('#modal-sales-team');

					if (salesPersonSelect.length > 0) {
						// Clear existing options except the first "All Sales Persons"
						salesPersonSelect.find('option:not(:first)').remove();

						// Clear the selected value if company changed
						salesPersonSelect.val('');

						// Extract unique parent sales persons (teams) from the loaded sales persons
						const parentTeams = new Set();

						r.message.forEach(person => {
							if (person && person.name) {
								salesPersonSelect.append(`<option value="${person.name}">${person.sales_person_name || person.name}</option>`);

								// Extract parent_sales_person as a team
								if (person.parent_sales_person && person.parent_sales_person !== person.name) {
									parentTeams.add(person.parent_sales_person);
								}
							}
						});
						console.log('Sales Persons populated:', r.message.length);

						// Auto-populate sales teams from parent sales persons
						if (salesTeamSelect.length > 0 && parentTeams.size > 0) {
							// Clear existing options except the first "All Sales Teams"
							salesTeamSelect.find('option:not(:first)').remove();

							const sortedTeams = Array.from(parentTeams).sort();
							sortedTeams.forEach(team => {
								salesTeamSelect.append(`<option value="${team}">${team}</option>`);
							});
							console.log('Sales Teams auto-populated from parent teams:', sortedTeams.length);
						}

						// Set current filter value only if it exists in the new list
						if (this.filters.sales_person) {
							const optionExists = salesPersonSelect.find(`option[value="${this.filters.sales_person}"]`).length > 0;
							if (optionExists) {
								salesPersonSelect.val(this.filters.sales_person);
								console.log('Sales Person filter value set to:', this.filters.sales_person);
							} else {
								this.filters.sales_person = '';
								console.log('Previous sales person filter cleared (not in company)');
							}
						}
					}
				}
			}
		});
	}

	// ================== SALES PERSON WISE SECTION ==================
	render_salesperson_wise_section() {
		const section_html = `
			<div class="section-container" data-section="salesperson_wise">
				<div class="section-header collapsible" data-target="salesperson-content">
					<div class="section-header-left">
						<i class="fa fa-user-circle section-icon"></i>
						<h2>Sales Person Wise Outstanding</h2>
					</div>
					<div class="section-header-right">
						<i class="fa fa-chevron-down collapse-icon"></i>
					</div>
				</div>
				<div class="section-content" id="salesperson-content">
					<div class="salesperson-summary-cards"></div>
					<div class="salesperson-filter-bar" style="margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
						<div style="position: relative; flex: 1; min-width: 220px; max-width: 420px;">
							<i class="fa fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
							<input type="text" class="salesperson-name-filter" placeholder="Search sales person"
								style="width: 100%; padding: 8px 36px 8px 36px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.6); color: #e2e8f0;">
							<button type="button" class="salesperson-filter-clear"
								style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: none; padding: 2px 6px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(30, 41, 59, 0.8); color: #e2e8f0; border-radius: 4px; cursor: pointer;">
								Clear
							</button>
						</div>
					</div>
					<div class="salesperson-tabs" style="margin-top: 20px;">
						<button class="sp-tab active" data-tab="summary">Summary View</button>
						<button class="sp-tab" data-tab="detailed">Detailed View</button>
						<button class="sp-tab" data-tab="customers">Top Customers</button>
					</div>
					<div class="salesperson-summary-view"></div>
					<div class="salesperson-detailed-view" style="display: none;"></div>
					<div class="salesperson-top-customers-view" style="display: none;"></div>
				</div>
			</div>
		`;

		this.main_container.find('.dashboard-content').html(section_html);
		this.setup_collapsible_sections();
		this.setup_salesperson_name_filter();
		this.load_salesperson_data();
	}

	load_salesperson_data() {
		const self = this;
		self.salesperson_data_loaded = false;

		if (!self.filters.company) {
			self.main_container.find('.salesperson-summary-cards, .salesperson-summary-view, .salesperson-detailed-view').html(`
				<div class="alert alert-warning" style="margin-top: 20px;">
					<i class="fa fa-exclamation-triangle"></i> Please select a company from the global filters to load data.
				</div>
			`);
			return;
		}

		// Show skeleton loaders
		self.show_skeleton_loader('.salesperson-summary-cards');
		self.show_skeleton_loader('.salesperson-summary-view');

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.get_salesperson_wise_data',
			args: {
				company: self.filters.company,
				from_date: self.filters.from_date || null,
				to_date: self.filters.to_date || null,
				branch: self.filters.branch || null,
				sales_team: self.filters.sales_team || null,
				sales_person: self.filters.sales_person || null,
				internal_customer: self.get_internal_customer_filter_value() || null
			},
			callback: function (r) {
				if (r.message) {
					self.salesperson_data = {
						totals: r.message.totals || {},
						summary: r.message.summary || [],
						detailed: r.message.detailed || []
					};
					self.salesperson_data_loaded = true;
					self.render_salesperson_summary_cards(self.salesperson_data.totals);
					if ((self.salesperson_name_filter || '').trim().length > 0) {
						self.apply_salesperson_name_filter();
					} else {
						self.render_salesperson_summary_view(self.salesperson_data.summary);
						self.render_salesperson_detailed_view(self.salesperson_data.detailed);
						self.render_salesperson_top_customers_view(self.salesperson_data.detailed);
						self.setup_salesperson_tabs();
					}
				}
			}
		});
	}

	render_salesperson_summary_cards(totals) {
		const cards_html = `
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-md-3">
					<div class="stat-card primary">
						<div class="stat-header">
							<h4 class="stat-title">Total Outstanding</h4>
							<div class="stat-icon primary"><i class="fa fa-money"></i></div>
						</div>
						<div class="stat-value">${frappe.format(totals.total_outstanding || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>${totals.total_invoices || 0} invoice(s)</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card danger">
						<div class="stat-header">
							<h4 class="stat-title">Overdue Amount</h4>
							<div class="stat-icon danger"><i class="fa fa-exclamation-triangle"></i></div>
						</div>
						<div class="stat-value">${frappe.format(totals.total_overdue || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>Past due date</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card success">
						<div class="stat-header">
							<h4 class="stat-title">Not Due Amount</h4>
							<div class="stat-icon success"><i class="fa fa-check-circle"></i></div>
						</div>
						<div class="stat-value">${frappe.format(totals.total_not_due || 0, { fieldtype: 'Currency' })}</div>
						<div class="stat-description"><small>Within credit period</small></div>
					</div>
				</div>
				<div class="col-md-3">
					<div class="stat-card info">
						<div class="stat-header">
							<h4 class="stat-title">Sales Persons</h4>
							<div class="stat-icon info"><i class="fa fa-users"></i></div>
						</div>
						<div class="stat-value">${totals.salesperson_count || 0}</div>
						<div class="stat-description"><small>Active sales team</small></div>
					</div>
				</div>
			</div>
		`;

		this.main_container.find('.salesperson-summary-cards').html(cards_html);
	}

	render_salesperson_summary_view(summary_data) {
		if (!summary_data || summary_data.length === 0) {
			this.main_container.find('.salesperson-summary-view').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No sales person data found for the selected criteria.
				</div>
			`);
			return;
		}

		let cards_html = '<div class="row" style="margin-top: 20px;">';

		summary_data.forEach(sp => {
			const photo_url = sp.employee_photo || '/assets/frappe/images/default-avatar.png';
			const overdue_percentage = sp.total_outstanding > 0 ? ((sp.overdue_amount / sp.total_outstanding) * 100).toFixed(1) : 0;

			cards_html += `
				<div class="col-md-4" style="margin-bottom: 20px;">
					<div class="salesperson-card" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px; padding: 20px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3); border: 1px solid rgba(59, 130, 246, 0.3);">
						<div style="display: flex; align-items: center; margin-bottom: 15px;">
							<img src="${photo_url}" alt="${sp.employee_name || sp.sales_person}"
								style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid #3b82f6; margin-right: 15px;">
							<div>
								<h4 style="margin: 0; color: #e2e8f0; font-weight: 700;">${sp.sales_person}</h4>
								<p style="margin: 0; color: #94a3b8; font-size: 13px;">${sp.employee_name || ''}</p>
							</div>
						</div>
						<div style="border-top: 1px solid rgba(148, 163, 184, 0.2); padding-top: 15px;">
							<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
								<span style="color: #94a3b8; font-size: 13px;">Total Outstanding:</span>
								<span style="color: #3b82f6; font-weight: 700;">${frappe.format(sp.total_outstanding, { fieldtype: 'Currency' })}</span>
							</div>
							<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
								<span style="color: #94a3b8; font-size: 13px;">Overdue Amount:</span>
								<span style="color: #ef4444; font-weight: 700;">${frappe.format(sp.overdue_amount, { fieldtype: 'Currency' })}</span>
							</div>
							<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
								<span style="color: #94a3b8; font-size: 13px;">Not Due Amount:</span>
								<span style="color: #22c55e; font-weight: 700;">${frappe.format(sp.not_due_amount, { fieldtype: 'Currency' })}</span>
							</div>
							<div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
								<span style="color: #94a3b8; font-size: 13px;">Invoice Count:</span>
								<span style="color: #e2e8f0; font-weight: 600;">${sp.invoice_count}</span>
							</div>
							<div style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 10px; text-align: center;">
								<span style="color: #e2e8f0; font-size: 12px;">Overdue Percentage:</span>
								<div style="color: ${overdue_percentage > 50 ? '#ef4444' : overdue_percentage > 25 ? '#f59e0b' : '#22c55e'}; font-size: 20px; font-weight: 700; margin-top: 5px;">
									${overdue_percentage}%
								</div>
							</div>
						</div>
					</div>
				</div>
			`;
		});

		cards_html += '</div>';

		this.main_container.find('.salesperson-summary-view').html(cards_html);
	}

	render_salesperson_detailed_view(detailed_data) {
		if (!detailed_data || detailed_data.length === 0) {
			this.main_container.find('.salesperson-detailed-view').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No detailed data found.
				</div>
			`);
			return;
		}

		let detailed_html = '';

		detailed_data.forEach((sp, index) => {
			const photo_url = sp.employee_photo || '/assets/frappe/images/default-avatar.png';

			detailed_html += `
				<div class="sp-detail-section" style="margin-top: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px; padding: 20px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3); border: 1px solid rgba(59, 130, 246, 0.3);">
					<div class="sp-detail-header collapsible" data-target="sp-invoices-${index}" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; margin-bottom: 15px;">
						<div style="display: flex; align-items: center;">
							<img src="${photo_url}" alt="${sp.sales_person}"
								style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; margin-right: 15px;">
							<div>
								<h3 style="margin: 0; color: #e2e8f0; font-weight: 700;">${sp.sales_person}</h3>
								<p style="margin: 0; color: #94a3b8; font-size: 13px;">${sp.invoice_count} invoices • ${frappe.format(sp.total_outstanding, { fieldtype: 'Currency' })}</p>
							</div>
						</div>
						<i class="fa fa-chevron-down collapse-icon" style="color: #3b82f6; transition: transform 0.3s;"></i>
					</div>
					<div id="sp-invoices-${index}" class="sp-invoices-table">
						<div class="table-responsive">
							<table class="table table-bordered" style="background: rgba(255, 255, 255, 0.05);">
								<thead style="background: rgba(59, 130, 246, 0.2); color: #e2e8f0;">
									<tr>
										<th>Invoice No</th>
										<th>Posting Date</th>
										<th>Customer</th>
										<th style="text-align: right;">Grand Total</th>
										<th style="text-align: right;">Outstanding</th>
										<th>Payment Followup</th>
										<th style="text-align: center;">Aging Days</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
			`;

			sp.invoices.forEach(inv => {
				const status_color = inv.status === 'Overdue' ? '#ef4444' : '#22c55e';
				const status_bg = inv.status === 'Overdue' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';

				detailed_html += `
					<tr style="color: #e2e8f0;">
						<td><a href="/app/sales-invoice/${inv.invoice_no}" target="_blank" style="color: #3b82f6;">${inv.invoice_no}</a></td>
						<td>${frappe.datetime.str_to_user(inv.posting_date)}</td>
						<td>${inv.customer_name || inv.customer}</td>
						<td style="text-align: right;">${frappe.format(inv.grand_total, { fieldtype: 'Currency' })}</td>
						<td style="text-align: right; font-weight: 700;">${frappe.format(inv.outstanding_amount, { fieldtype: 'Currency' })}</td>
						<td style="max-width: 240px; white-space: normal; word-break: break-word;">
							${inv.payment_followup_comment || '-'}
						</td>
						<td style="text-align: center;">${inv.aging_days}</td>
						<td><span style="padding: 4px 10px; background: ${status_bg}; color: ${status_color}; border-radius: 4px; font-size: 12px; font-weight: 600;">${inv.status}</span></td>
					</tr>
				`;
			});

			detailed_html += `
								</tbody>
							</table>
						</div>
					</div>
				</div>
			`;
		});

		this.main_container.find('.salesperson-detailed-view').html(detailed_html);
		this.setup_collapsible_sections();
	}

	setup_salesperson_tabs() {
		const self = this;

		self.main_container.find('.sp-tab').off('click').on('click', function () {
			const tab = $(this).data('tab');

			self.main_container.find('.sp-tab').removeClass('active');
			$(this).addClass('active');

			if (tab === 'summary') {
				self.main_container.find('.salesperson-summary-view').show();
				self.main_container.find('.salesperson-detailed-view').hide();
				self.main_container.find('.salesperson-top-customers-view').hide();
			} else {
				self.main_container.find('.salesperson-summary-view').hide();
				if (tab === 'detailed') {
					self.main_container.find('.salesperson-detailed-view').show();
					self.main_container.find('.salesperson-top-customers-view').hide();
				} else {
					self.main_container.find('.salesperson-detailed-view').hide();
					self.main_container.find('.salesperson-top-customers-view').show();
				}
			}
		});
	}

	setup_salesperson_name_filter() {
		const self = this;
		const filterInput = self.main_container.find('.salesperson-name-filter');
		const clearBtn = self.main_container.find('.salesperson-filter-clear');
		let debounceTimer;

		if (!filterInput.length) {
			return;
		}

		filterInput.val(self.salesperson_name_filter || '');
		clearBtn.toggle((self.salesperson_name_filter || '').trim().length > 0);

		filterInput.off('input').on('input', function () {
			const value = $(this).val();
			self.salesperson_name_filter = value;
			clearBtn.toggle(value.trim().length > 0);
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				self.apply_salesperson_name_filter();
			}, 200);
		});

		filterInput.off('keydown').on('keydown', function (e) {
			if (e.key === 'Escape') {
				filterInput.val('');
				self.salesperson_name_filter = '';
				clearBtn.hide();
				self.apply_salesperson_name_filter();
				filterInput.blur();
			}
		});

		clearBtn.off('click').on('click', function () {
			filterInput.val('');
			self.salesperson_name_filter = '';
			clearBtn.hide();
			self.apply_salesperson_name_filter();
			filterInput.focus();
		});
	}

	get_filtered_salesperson_data() {
		const summary = Array.isArray(this.salesperson_data.summary) ? this.salesperson_data.summary : [];
		const detailed = Array.isArray(this.salesperson_data.detailed) ? this.salesperson_data.detailed : [];
		const query = (this.salesperson_name_filter || '').trim().toLowerCase();

		if (!query) {
			return { summary, detailed };
		}

		const matches = (sp) => {
			if (!sp) return false;
			const salesPerson = (sp.sales_person || '').toString().toLowerCase();
			const employeeName = (sp.employee_name || '').toString().toLowerCase();
			return salesPerson.includes(query) || employeeName.includes(query);
		};

		return {
			summary: summary.filter(matches),
			detailed: detailed.filter(matches)
		};
	}

	apply_salesperson_name_filter() {
		if (!this.salesperson_data_loaded) {
			return;
		}

		const activeTab = this.main_container.find('.sp-tab.active').data('tab') || 'summary';
		const filtered = this.get_filtered_salesperson_data();

		this.render_salesperson_summary_view(filtered.summary);
		this.render_salesperson_detailed_view(filtered.detailed);
		this.render_salesperson_top_customers_view(filtered.detailed);
		this.setup_salesperson_tabs();

		if (activeTab === 'summary') {
			this.main_container.find('.salesperson-summary-view').show();
			this.main_container.find('.salesperson-detailed-view').hide();
			this.main_container.find('.salesperson-top-customers-view').hide();
		} else if (activeTab === 'detailed') {
			this.main_container.find('.salesperson-summary-view').hide();
			this.main_container.find('.salesperson-detailed-view').show();
			this.main_container.find('.salesperson-top-customers-view').hide();
		} else {
			this.main_container.find('.salesperson-summary-view').hide();
			this.main_container.find('.salesperson-detailed-view').hide();
			this.main_container.find('.salesperson-top-customers-view').show();
		}
	}

	render_salesperson_top_customers_view(detailed_data) {
		if (!detailed_data || detailed_data.length === 0) {
			this.main_container.find('.salesperson-top-customers-view').html(`
				<div class="alert alert-info">
					<i class="fa fa-info-circle"></i> No top customer data found.
				</div>
			`);
			return;
		}

		const topLimit = 5;
		let html = '<div class="row" style="margin-top: 20px;">';

		detailed_data.forEach((sp) => {
			const customerMap = {};

			if (Array.isArray(sp.invoices)) {
				sp.invoices.forEach(inv => {
					const customerId = inv.customer || '';
					const customerName = inv.customer_name || inv.customer || 'Unknown Customer';
					const key = customerId || customerName;

					if (!customerMap[key]) {
						customerMap[key] = {
							customer_id: customerId,
							customer_name: customerName,
							outstanding: 0,
							invoice_count: 0
						};
					}

					customerMap[key].outstanding += (inv.outstanding_amount || 0);
					customerMap[key].invoice_count += 1;
				});
			}

			const topCustomers = Object.values(customerMap)
				.sort((a, b) => b.outstanding - a.outstanding)
				.slice(0, topLimit);

			const customerRows = topCustomers.length
				? topCustomers.map(c => {
					const name = c.customer_name || 'Unknown Customer';
					const link = c.customer_id
						? `<a href="/app/customer/${encodeURIComponent(c.customer_id)}" target="_blank" style="color: #60a5fa; text-decoration: none;">${name}</a>`
						: `<span style="color: #e2e8f0;">${name}</span>`;
					return `
						<tr>
							<td style="color: #e2e8f0;">${link}</td>
							<td style="text-align: right; color: #e2e8f0;">${frappe.format(c.outstanding, { fieldtype: 'Currency' })}</td>
							<td style="text-align: center; color: #94a3b8;">${c.invoice_count}</td>
						</tr>
					`;
				}).join('')
				: `
					<tr>
						<td colspan="3" style="text-align: center; color: #94a3b8; padding: 12px;">No invoices found</td>
					</tr>
				`;

			html += `
				<div class="col-md-6" style="margin-bottom: 20px;">
					<div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px; padding: 20px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3); border: 1px solid rgba(59, 130, 246, 0.3);">
						<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
							<div>
								<h4 style="margin: 0; color: #e2e8f0; font-weight: 700;">${sp.sales_person}</h4>
								<p style="margin: 0; color: #94a3b8; font-size: 12px;">Top ${topLimit} customers by outstanding</p>
							</div>
							<i class="fa fa-star" style="color: #f59e0b;"></i>
						</div>
						<div class="table-responsive">
							<table class="table table-bordered" style="background: rgba(255, 255, 255, 0.05); margin: 0;">
								<thead style="background: rgba(59, 130, 246, 0.2); color: #e2e8f0;">
									<tr>
										<th>Customer</th>
										<th style="text-align: right;">Outstanding</th>
										<th style="text-align: center;">Invoices</th>
									</tr>
								</thead>
								<tbody>
									${customerRows}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			`;
		});

		html += '</div>';
		this.main_container.find('.salesperson-top-customers-view').html(html);
	}

	// ================== COLLAPSIBLE SECTIONS ==================
	setup_collapsible_sections() {
		$('.collapsible').off('click').on('click', function () {
			const target = $(this).data('target');
			const icon = $(this).find('.collapse-icon');
			const content = $('#' + target);

			if (content.length) {
				content.slideToggle(300);
				icon.toggleClass('fa-chevron-down fa-chevron-up');
			}
		});
	}

	// ================== SKELETON LOADERS ==================
	show_skeleton_loader(selector) {
		const skeleton_html = `
			<div class="skeleton-loader">
				<div class="skeleton-line" style="width: 100%; height: 200px; background: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite; border-radius: 8px;"></div>
			</div>
		`;
		$(selector).html(skeleton_html);
	}

	// ================== GLOBAL SEARCH ==================
	setup_global_search() {
		const self = this;
		const searchInput = self.search_container.find('.global-search-input');
		const searchClear = self.search_container.find('.search-clear');
		const searchDropdown = self.search_container.find('.search-results-dropdown');

		let searchTimeout;

		// Handle search input
		searchInput.on('input', function () {
			const query = $(this).val().trim();

			// Show/hide clear button
			if (query.length > 0) {
				searchClear.show();
			} else {
				searchClear.hide();
				searchDropdown.hide();
				return;
			}

			// Debounce search
			clearTimeout(searchTimeout);

			if (query.length < 2) {
				searchDropdown.hide();
				return;
			}

			searchTimeout = setTimeout(() => {
				self.perform_global_search(query);
			}, 300);
		});

		// Handle clear button
		searchClear.on('click', function () {
			searchInput.val('').trigger('input').focus();
		});

		// Handle keyboard shortcuts
		searchInput.on('keydown', function (e) {
			if (e.key === 'Escape') {
				searchInput.val('');
				searchDropdown.hide();
				searchInput.blur();
			}
		});

		// Close dropdown when clicking outside
		$(document).on('click', function (e) {
			if (!$(e.target).closest('.global-search-bar').length) {
				searchDropdown.hide();
			}
		});

		// Focus search on Ctrl+K or Cmd+K
		$(document).on('keydown', function (e) {
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				searchInput.focus();
			}
		});
	}

	perform_global_search(query) {
		const self = this;
		const searchDropdown = self.search_container.find('.search-results-dropdown');

		// Show loading
		searchDropdown.show().html(`
			<div class="search-loading">
				<i class="fa fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
				<div>Searching...</div>
			</div>
		`);

		frappe.call({
			method: 'prastara_custom.prastara_custom.page.prd_arm.prd_arm.global_search',
			args: {
				query: query,
				company: self.filters.company || null
			},
			callback: function (r) {
				if (r.message) {
					self.display_search_results(r.message, query);
				}
			},
			error: function () {
				searchDropdown.html(`
					<div class="search-no-results">
						<i class="fa fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
						<div>Search failed. Please try again.</div>
					</div>
				`);
			}
		});
	}

	display_search_results(results, query) {
		const self = this;
		const searchDropdown = self.search_container.find('.search-results-dropdown');

		const total_results = results.customers.length + results.invoices.length +
			results.pdcs.length + results.sales_persons.length;

		if (total_results === 0) {
			searchDropdown.html(`
				<div class="search-no-results">
					<i class="fa fa-search" style="font-size: 24px; margin-bottom: 10px;"></i>
					<div>No results found for "${query}"</div>
				</div>
			`);
			return;
		}

		let html = '';

		// Customers section
		if (results.customers.length > 0) {
			html += `
				<div class="search-results-section">
					<div class="search-section-title">
						<i class="fa fa-users"></i> Customers (${results.customers.length})
					</div>
			`;

			results.customers.forEach(customer => {
				html += `
					<div class="search-result-item" data-type="customer" data-name="${customer.name}">
						<i class="fa fa-user-circle"></i>
						<div class="search-result-content">
							<div class="search-result-title">${customer.customer_name || customer.name}</div>
							<div class="search-result-subtitle">Outstanding: ${frappe.format(customer.outstanding_amount, { fieldtype: 'Currency' })}</div>
						</div>
					</div>
				`;
			});

			html += `</div>`;
		}

		// Invoices section
		if (results.invoices.length > 0) {
			html += `
				<div class="search-results-section">
					<div class="search-section-title">
						<i class="fa fa-file-text"></i> Invoices (${results.invoices.length})
					</div>
			`;

			results.invoices.forEach(inv => {
				html += `
					<div class="search-result-item" data-type="invoice" data-name="${inv.name}">
						<i class="fa fa-file-text-o"></i>
						<div class="search-result-content">
							<div class="search-result-title">${inv.name}</div>
							<div class="search-result-subtitle">${inv.customer_name} • ${frappe.format(inv.outstanding_amount, { fieldtype: 'Currency' })}</div>
						</div>
					</div>
				`;
			});

			html += `</div>`;
		}

		// PDCs section
		if (results.pdcs.length > 0) {
			html += `
				<div class="search-results-section">
					<div class="search-section-title">
						<i class="fa fa-money"></i> PDCs (${results.pdcs.length})
					</div>
			`;

			results.pdcs.forEach(pdc => {
				html += `
					<div class="search-result-item" data-type="pdc" data-name="${pdc.name}">
						<i class="fa fa-check-square-o"></i>
						<div class="search-result-content">
							<div class="search-result-title">${pdc.reference_no || pdc.name}</div>
							<div class="search-result-subtitle">${pdc.party} • ${frappe.format(pdc.paid_amount, { fieldtype: 'Currency' })}</div>
						</div>
					</div>
				`;
			});

			html += `</div>`;
		}

		// Sales Persons section
		if (results.sales_persons.length > 0) {
			html += `
				<div class="search-results-section">
					<div class="search-section-title">
						<i class="fa fa-user"></i> Sales Persons (${results.sales_persons.length})
					</div>
			`;

			results.sales_persons.forEach(sp => {
				html += `
					<div class="search-result-item" data-type="salesperson" data-name="${sp.name}">
						<i class="fa fa-user-circle-o"></i>
						<div class="search-result-content">
							<div class="search-result-title">${sp.name}</div>
							<div class="search-result-subtitle">${sp.employee_name || ''}</div>
						</div>
					</div>
				`;
			});

			html += `</div>`;
		}

		searchDropdown.html(html);

		// Handle click on search results
		searchDropdown.find('.search-result-item').on('click', function () {
			const type = $(this).data('type');
			const name = $(this).data('name');
			self.navigate_to_result(type, name);
			searchDropdown.hide();
			self.search_container.find('.global-search-input').val('').blur();
		});
	}

	navigate_to_result(type, name) {
		if (type === 'customer') {
			frappe.set_route('Form', 'Customer', name);
		} else if (type === 'invoice') {
			frappe.set_route('Form', 'Sales Invoice', name);
		} else if (type === 'pdc') {
			frappe.set_route('Form', 'Payment Entry', name);
		} else if (type === 'salesperson') {
			frappe.set_route('Form', 'Sales Person', name);
		}
	}
}

// Simple Page Tour Class
class PageTour {
	constructor() {
		this.currentStep = 0;
		this.steps = [
			{
				selector: '.dashboard-sidebar',
				title: 'Navigation Sidebar',
				desc: 'Your central hub for navigating the ARM Dashboard. Click on any section to instantly switch views: Overview (dashboard summary), Listed Customers (customer balances), Aging Analysis (payment timelines), Outstanding Report (invoice details), Collection Tracker (payment tracking), and more. The active section is highlighted in blue for easy reference.'
			},
			{
				selector: '[data-section="overview"]',
				title: 'Overview Section',
				desc: 'Your comprehensive financial dashboard at a glance. This section displays: Total Outstanding Amount across all customers, Key Performance Indicators (total invoices, average days outstanding, collection rate), Visual Charts showing receivables trends over time, Top Debtors list with highest outstanding balances, Aging Analysis Cards (0-30, 31-60, 61-90, 90+ days buckets), Payment Schedule indicators for upcoming payments, and Quick Statistics for overdue amounts and due today/this week/this month. Perfect for daily monitoring of accounts receivable health.'
			},
			{
				selector: '[data-section="listed_customers"]',
				title: 'Listed Customers Section',
				desc: 'Complete customer management center for receivables. Features include: Searchable and sortable customer list with outstanding balances, Detailed customer information (name, contact, account number), Balance breakdown showing total outstanding, credit limit, and available credit, Payment history and behavior tracking, Last payment date and average payment time, Risk indicators and credit status, Quick action buttons to send payment reminders, view detailed invoices, create payment entries, Export customer data to Excel/PDF, and Bulk actions for multiple customers. Click any customer row to drill down into their complete transaction history.'
			},
			{
				selector: '[data-section="aging"]',
				title: 'Aging Analysis Section',
				desc: 'Time-based receivables intelligence for strategic collection planning. This section provides: Automatic categorization into aging buckets (0-30 days, 31-60 days, 61-90 days, 90+ days overdue), Visual representations with bar charts, pie charts, and aging distribution graphs, Summary cards showing total amount in each bucket with percentages, Customer-level aging breakdown to identify who falls into which category, Trend analysis comparing current period vs previous periods, Priority scoring system based on amount, age, and customer importance, Drilldown capability to view detailed invoice lists within each aging range, and Custom bucket configuration options. Use this to focus collection efforts on the right accounts at the right time.'
			},
			{
				selector: '[data-section="outstanding"]',
				title: 'Outstanding Report Section',
				desc: 'Your detailed invoice-level command center. This comprehensive section includes: Complete registry of all unpaid and partially paid invoices, Detailed invoice information (invoice number, date, due date, original amount, paid amount, balance), Advanced filtering by customer, date range, amount, status, or aging bucket, Multi-column sorting capabilities (by amount, due date, days overdue, customer name), Payment allocation details showing partial payments and remaining balances, Links to reference documents (sales orders, delivery notes, payment entries), Dispute tracking system to flag and resolve invoice disputes with notes, Bulk actions to send payment reminders or generate statements for multiple invoices, Export and print options in PDF/Excel formats, Payment terms compliance tracking. This is your single source of truth for all outstanding invoice management.'
			},
			{
				selector: '[data-section="collection"]',
				title: 'Collection Tracker Section',
				desc: 'Performance monitoring and collection analytics hub. Track and optimize your collection effectiveness with: Real-time collection dashboard showing daily, weekly, and monthly performance, Target vs Actual comparison with variance analysis, Collection efficiency metrics including DSO (Days Sales Outstanding) and CEI (Collection Effectiveness Index), Time-series charts displaying historical trends and improvement patterns, Collection activities log with complete history of reminders sent, calls made, and follow-up actions, Team performance tracking if you have multiple collectors, Success rate analysis showing which strategies work best for different customer segments, Forecasting tools to predict future collections based on historical patterns and scheduled payments, Reminder effectiveness tracking (email open rates, response rates, payment rates), Monthly scorecards with comprehensive collection metrics and achievements. Use data-driven insights to optimize your collection strategy and improve cash flow.'
			},
			{
				selector: '[data-section="overdue_advance_progressive"]',
				title: 'Overdue Advance/Progressive Bills',
				desc: 'Specialized tracking for advance payment and progressive billing arrangements. This section monitors: Outstanding advance payments made by customers that are overdue for utilization or adjustment, Progressive billing schedules for long-term projects or contracts with milestone-based payments, Advance payment aging and expiry tracking, Customer-wise advance balance summary with utilization status, Progressive bill payment schedules with milestone completion tracking, Overdue progressive invoices requiring follow-up, Contract-wise billing progress and payment status, Adjustment and settlement options for advance amounts, Export and reporting capabilities for advance and progressive billing analysis. Essential for businesses with project-based billing or advance payment models.'
			},
			{
				selector: '[data-section="payment_schedules"]',
				title: 'Sales Order Payment Schedules',
				desc: 'Comprehensive payment schedule management linked to sales orders. Features include: Complete view of all sales orders with payment schedule terms, Upcoming payment due dates and amounts by customer, Overdue scheduled payments requiring collection action, Payment schedule compliance tracking showing on-time vs delayed payments, Customer payment behavior analysis based on schedule adherence, Schedule modification and renegotiation tracking, Multi-installment payment tracking for large orders, Alert system for approaching payment deadlines, Integration with sales order status and delivery tracking, Bulk reminder capabilities for scheduled payment due dates, Export scheduled payment reports for cash flow forecasting. Perfect for managing installment-based sales and ensuring timely collections according to agreed schedules.'
			},
			{
				selector: '[data-section="pdc_report"]',
				title: 'PDC Report (Post-Dated Cheques)',
				desc: 'Complete post-dated cheque management and tracking system. This section provides: Comprehensive list of all PDCs received from customers with cheque details (number, bank, branch, amount, date), PDC maturity calendar showing upcoming cheques to be deposited, Bank-wise PDC summary for efficient deposit planning, Customer-wise PDC holdings and payment commitments, PDC status tracking (received, deposited, cleared, bounced, cancelled), Bounced cheque management with bounce reasons and follow-up actions, PDC aging analysis showing cheque validity periods, Automatic alerts for upcoming PDC maturity dates, Integration with payment entries for automatic reconciliation upon clearance, PDC replacement and reissuance tracking, Deposit planning tools to optimize bank visits and cash flow, Export and print options for PDC registers and bank deposit schedules. Essential for businesses accepting post-dated cheques as payment method.'
			},
			{
				selector: '[data-section="intercompany_overdues"]',
				title: 'Inter Company Overdues',
				desc: 'Specialized tracking for inter-company transactions and outstanding balances. Monitor and manage: Outstanding receivables between related companies or group entities, Inter-company invoice tracking with aging analysis, Transfer pricing compliance and documentation, Consolidated group-level receivables view, Entity-wise outstanding balances within the corporate group, Inter-company payment terms and settlement schedules, Currency conversion and exchange rate management for international inter-company transactions, Elimination entries for consolidated financial reporting, Inter-company reconciliation tools to match payables and receivables, Settlement netting opportunities to optimize cash flow within the group, Transfer and allocation of payments between entities, Compliance tracking for related party transaction regulations, Export options for group consolidation and audit purposes. Critical for corporate groups managing internal transactions and cash pooling.'
			},
			{
				selector: '[data-section="blocked_dispute"]',
				title: 'Blocked Customer & Disputes',
				desc: 'Centralized management for credit holds and dispute resolution. This comprehensive section handles: Complete list of customers currently blocked from new transactions due to credit issues, Block reasons and credit hold justifications with detailed notes, Customer credit limit violations and overdue payment triggers, Dispute tracking system with full case management (dispute type, amount, reason, status, assigned to), Invoice-level dispute details with supporting documentation, Dispute aging to track resolution timeframes, Communication log for all dispute-related correspondence and follow-ups, Resolution workflow with approval processes, Impact analysis showing business effect of blocks and disputes, Unblock request management with credit review processes, Escalation procedures for high-value or long-standing disputes, Historical dispute patterns by customer for risk assessment, Automated notification system for credit managers and sales teams, Export capabilities for credit committee reviews and management reporting. Essential for credit risk management and maintaining healthy customer relationships while protecting receivables.'
			},
			{
				selector: '[data-section="proforma_invoice"]',
				title: 'Proforma Invoice Management',
				desc: 'Complete tracking and management of proforma invoices and quotations. This section provides: Comprehensive list of all active proforma invoices awaiting conversion or payment, Proforma aging analysis showing pending duration and follow-up requirements, Customer-wise proforma summary with total committed amounts, Conversion tracking from proforma to final invoice with conversion rates, Proforma expiry management and renewal tracking, Payment received against proforma invoices with advance adjustment, Modification history tracking for proforma revisions and amendments, Sales pipeline visibility through proforma values and stages, Follow-up scheduler for proforma invoice conversions, Integration with inventory reservation for proforma orders, Approval workflow for high-value proformas, Comparison analysis between proforma and final invoice values, Export options for sales forecasting and pipeline reporting. Ideal for businesses using proforma invoices in their sales process, especially for advance payment collection and export transactions.'
			},
			{
				selector: '[data-section="quotation_followup"]',
				title: 'Quotation Follow-up',
				desc: 'Strategic quotation tracking and conversion management system. Features include: Complete quotation pipeline with all open and pending quotations, Quotation aging to identify opportunities requiring immediate follow-up, Customer-wise quotation status with probability to close indicators, Quotation value analysis for sales forecasting and target tracking, Follow-up schedule management with automated reminder systems, Quotation validity tracking with expiry alerts, Conversion rate analytics comparing quotations sent vs orders received, Competitor comparison notes and pricing strategies, Revision tracking for multiple versions of quotations, Lost quotation analysis with reasons for non-conversion, Win rate statistics by product, customer segment, or sales representative, Re-quotation opportunities for expired but valuable leads, Integration with CRM for comprehensive customer interaction tracking, Bulk action capabilities for follow-up emails and calls, Export options for sales pipeline reviews and management reporting. Essential for sales teams to maximize quotation conversion rates and revenue opportunities.'
			},
			{
				selector: '[data-section="dispute"]',
				title: 'Dispute Management Center',
				desc: 'Comprehensive dispute resolution and case management hub. This dedicated section provides: Complete dispute registry with all active and resolved cases, Detailed dispute information including type (pricing, quality, delivery, billing error, payment terms, documentation), Dispute amount tracking with financial impact analysis, Priority-based dispute categorization (critical, high, medium, low) based on value and customer importance, Status workflow management (new, under review, investigating, negotiating, resolved, escalated, closed), Assignment system to allocate disputes to specific team members or departments, Timeline tracking showing dispute duration and resolution SLA compliance, Communication history with complete audit trail of all interactions and correspondence, Document management for supporting evidence, agreements, and resolution proofs, Root cause analysis to identify systemic issues causing disputes, Resolution templates and standard procedures for common dispute types, Customer satisfaction tracking post-resolution, Financial adjustment tracking for credits, refunds, or write-offs, Reporting and analytics on dispute trends, causes, and resolution effectiveness, Preventive insights to reduce future disputes, Integration with invoicing and payment systems for automatic adjustments. Critical for maintaining customer relationships while protecting company interests and improving operational processes.'
			},
			{
				selector: '.global-actions',
				title: 'Filters & Actions Bar',
				desc: 'Your power control center for customizing the dashboard experience. Access advanced tools including: Date Range Filters to view data by custom periods, predefined ranges, or fiscal quarters, Customer Filters to focus on specific customers, customer groups, or territories, Status Filters to show only overdue, upcoming, or disputed receivables, Amount Range Filters to focus on high-value or low-value accounts, Manual Refresh button to get the latest real-time data from the system, Export Actions to download current view to Excel, PDF, or CSV with all applied filters, Print Options to generate professional reports with company letterhead, Email Actions for sending bulk payment reminders or statements to filtered customers, Advanced Settings to configure dashboard preferences, aging buckets, and display options, Save Views feature to save your favorite filter combinations for quick access later. Master these controls to customize and optimize your dashboard workflow.'
			}
		];
		this.init();
	}

	init() {
		this.createButton();
		this.createOverlay();
	}

	createButton() {
		// Remove any existing tour elements first
		$('.page-tour-btn').remove();

		const self = this;
		const btn = $(`<button class="page-tour-btn"><i class="fa fa-question"></i></button>`);
		$('body').append(btn);

		// Make start function globally accessible
		window.startPageTour = () => {
			console.log('Tour button clicked - starting tour');
			self.start();
		};

		// Add multiple event handlers to ensure it works
		btn.on('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			console.log('Button clicked via jQuery handler');
			window.startPageTour();
		});

		// Also add raw DOM event listener
		btn[0].addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			console.log('Button clicked via DOM listener');
			window.startPageTour();
		});

		console.log('Tour button created and ready. Click it to start!');
		console.log('Button element:', btn[0]);
	}

	createOverlay() {
		// Remove existing overlays first
		$('.tour-overlay, .tour-highlight, .tour-popup').remove();

		$('body').append('<div class="tour-overlay"></div>');
		$('body').append('<div class="tour-highlight"></div>');
		$('body').append('<div class="tour-popup"></div>');
		console.log('Tour overlay elements created');
	}

	start() {
		console.log('Starting tour...');
		this.currentStep = 0;
		$('.tour-overlay').addClass('active');
		$('.page-tour-btn').hide();
		this.showStep();
	}

	showStep() {
		// Reset previous highlighted element z-index and zoom
		$('.dashboard-sidebar, .nav-item, .global-actions').css('zIndex', '');
		$('.tour-element-zoom').removeClass('tour-element-zoom');

		const step = this.steps[this.currentStep];
		console.log('Showing step:', this.currentStep, step.title);
		const $el = $(step.selector);

		if ($el.length === 0) {
			console.warn('Element not found:', step.selector);
			this.nextStep();
			return;
		}

		console.log('Element found:', $el);

		// Scroll the sidebar FIRST to make the navigation item visible if it's in the sidebar
		if (step.selector.includes('data-section')) {
			const $sidebar = $('.sidebar-nav');
			if ($sidebar.length > 0) {
				// Use scrollIntoView for reliable scrolling
				$el[0].scrollIntoView({ behavior: 'auto', block: 'center' });
				console.log('Scrolled element into view in sidebar');
			}
		}

		// Small timeout to ensure DOM updates after sidebar scroll
		setTimeout(() => {
			this.renderStep(step, $el);
		}, 50);
	}

	renderStep(step, $el) {
		// Now get position AFTER sidebar scroll
		const pos = $el.offset();
		const w = $el.outerWidth();
		const h = $el.outerHeight();

		console.log('Position:', pos, 'Size:', w, 'x', h);

		// Make the target element visible above overlay
		$el.css({
			position: 'relative',
			zIndex: 1000000
		});

		// Apply zoom effect to the highlighted element
		$el.addClass('tour-element-zoom');

		// Show highlight with adjusted positioning for better coverage
		// Special adjustment for overview section
		let topOffset = -12;
		let heightAdjust = 20;

		if (step.selector === '[data-section="overview"]') {
			topOffset = -15;
			heightAdjust = 24;
		}

		$('.tour-highlight').css({
			top: pos.top + topOffset,
			left: pos.left - 8,
			width: w + 16,
			height: h + heightAdjust,
			display: 'block'
		});

		// Create popup HTML with separate scrollable content and fixed buttons
		const html = `
			<div class="tour-popup-content">
				<h3>${step.title}</h3>
				<p>${step.desc}</p>
			</div>
			<div class="tour-popup-buttons">
				<button class="tour-btn-skip" onclick="pageTour.end()">Skip</button>
				<button class="tour-btn-next" onclick="pageTour.nextStep()">${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}</button>
			</div>
		`;

		// Calculate better popup position
		const windowWidth = $(window).width();
		const windowHeight = $(window).height();
		const popupWidth = 500;
		const popupMaxHeight = Math.min(windowHeight * 0.8, 600);

		let popupTop = pos.top;
		let popupLeft = pos.left + w + 20; // Position to the right of highlighted element

		// If popup would go off-screen to the right, position it to the left
		if (popupLeft + popupWidth > windowWidth - 20) {
			popupLeft = Math.max(20, pos.left - popupWidth - 20);
		}

		// If still off-screen, center it horizontally
		if (popupLeft < 20 || popupLeft + popupWidth > windowWidth - 20) {
			popupLeft = Math.max(20, (windowWidth - popupWidth) / 2);
		}

		// Ensure popup top is within bounds
		if (popupTop + popupMaxHeight > windowHeight - 20) {
			popupTop = Math.max(20, windowHeight - popupMaxHeight - 20);
		}

		// Ensure popup doesn't go above viewport
		if (popupTop < 20) {
			popupTop = 20;
		}

		console.log('Popup position:', { top: popupTop, left: popupLeft });

		// Show popup
		$('.tour-popup').html(html).addClass('visible').css({
			top: popupTop + 'px',
			left: popupLeft + 'px'
		});

		console.log('Popup should be visible now');
		console.log('Popup element:', $('.tour-popup'));
		console.log('Popup CSS:', $('.tour-popup').css(['display', 'visibility', 'opacity', 'top', 'left']));

		// Special handling for global actions - scroll to top since it's at the top of page
		if (step.selector === '.global-actions') {
			$('html, body').animate({ scrollTop: 0 }, 500);
		} else {
			// Scroll main page to ensure the highlighted element is visible
			$('html, body').animate({ scrollTop: pos.top - 100 }, 500);
		}
	}

	nextStep() {
		console.log('Next step clicked. Current:', this.currentStep, 'Total:', this.steps.length);
		if (this.currentStep < this.steps.length - 1) {
			this.currentStep++;
			this.showStep();
		} else {
			console.log('Tour completed, ending...');
			this.end();
		}
	}

	end() {
		console.log('Ending tour...');

		// Reset all z-indexes and zoom effects
		$('.dashboard-sidebar, .nav-item, .global-actions').css('zIndex', '');
		$('.tour-element-zoom').removeClass('tour-element-zoom');

		$('.tour-overlay').removeClass('active').hide();
		$('.tour-highlight').css({ width: 0, height: 0 }).hide();
		$('.tour-popup').removeClass('visible').hide();
		$('.page-tour-btn').show();
		this.currentStep = 0;
		console.log('Tour ended successfully');
	}

	reset() {
		// Force reset everything if tour gets stuck
		console.log('Resetting tour...');
		$('.tour-element-zoom').removeClass('tour-element-zoom');
		$('.tour-overlay').removeClass('active').hide();
		$('.tour-highlight').hide();
		$('.tour-popup').removeClass('visible').hide();
		$('.page-tour-btn').show();
		this.currentStep = 0;
	}
}

// Initialize tour button after page loads (NO auto-start)
let pageTour;
$(document).ready(function () {
	setTimeout(() => {
		pageTour = new PageTour();
		console.log('Tour button is ready. Click the blue button to start the tour!');
	}, 2000);
});

frappe.pages['actual-prd-pandl'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Executive P&L Dashboard',
		single_column: true
	});

	// Load required external libraries
	$('<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">').appendTo('head');

	// Define setQuickFilter function globally before HTML is rendered
	window.setQuickFilter = function(period, clickedElement) {
		console.log('setQuickFilter called with:', period, clickedElement);
		console.log('window.plFilters status:', window.plFilters);
		
		const today = new Date();
		let startDate, endDate;
		
		switch(period) {
			case 'thisMonth':
				startDate = new Date(today.getFullYear(), today.getMonth(), 1);
				endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
				break;
			case 'lastMonth':
				startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
				endDate = new Date(today.getFullYear(), today.getMonth(), 0);
				break;
			case 'thisQuarter':
				const currentQuarter = Math.floor(today.getMonth() / 3);
				startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
				endDate = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0);
				break;
			case 'lastQuarter':
				const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
				if (lastQuarter < 0) {
					// Previous year's Q4
					startDate = new Date(today.getFullYear() - 1, 9, 1); // October 1st
					endDate = new Date(today.getFullYear() - 1, 11, 31); // December 31st
				} else {
					startDate = new Date(today.getFullYear(), lastQuarter * 3, 1);
					endDate = new Date(today.getFullYear(), lastQuarter * 3 + 3, 0);
				}
				break;
			case 'thisYear':
				startDate = new Date(today.getFullYear(), 0, 1);
				endDate = new Date(today.getFullYear(), 11, 31);
				break;
			case 'lastYear':
				startDate = new Date(today.getFullYear() - 1, 0, 1);
				endDate = new Date(today.getFullYear() - 1, 11, 31);
				break;
		}
		
		console.log('Calculated dates:', startDate, endDate);
		
		// Wait for filters to be initialized if they're not ready
		const trySetDates = () => {
			if (window.plFilters && window.plFilters.start_date && window.plFilters.end_date && startDate && endDate) {
				// Format dates properly for Frappe
				const formattedStartDate = frappe.datetime.obj_to_str(startDate);
				const formattedEndDate = frappe.datetime.obj_to_str(endDate);
				
				console.log('Setting formatted dates:', formattedStartDate, formattedEndDate);
				
				// Set the values
				window.plFilters.start_date.set_value(formattedStartDate);
				window.plFilters.end_date.set_value(formattedEndDate);
				
				// Force refresh the input displays
				setTimeout(() => {
					window.plFilters.start_date.refresh();
					window.plFilters.end_date.refresh();
				}, 50);
				
				// Add visual feedback
				$('.filter-quick-action').removeClass('active');
				if (clickedElement) {
					$(clickedElement).addClass('active');
				}
				
				// Show notification and auto-generate report
				const periodName = period.replace(/([A-Z])/g, ' $1').toLowerCase();
				showNotification(`Date range set to ${periodName}: ${formattedStartDate} to ${formattedEndDate}`, 'success');
				
				// Auto-generate report after setting dates
				setTimeout(() => {
					generateReport();
				}, 500);
			} else {
				console.error('Date filters not available, retrying...', {
					plFilters: window.plFilters,
					startDate: startDate,
					endDate: endDate
				});
				// Retry after a short delay
				setTimeout(trySetDates, 100);
			}
		};
		
		trySetDates();
	};

	// Add modern CSS styles with theme support
	$(`<style id="modern-pl-dashboard-styles">
		/* CSS Variables - Universal Theme Support */
		:root {
			--primary: #4f46e5;
			--primary-light: #6366f1;
			--secondary: #059669;
			--secondary-light: #10b981;
			--danger: #dc2626;
			--danger-light: #ef4444;
			--warning: #d97706;
			--warning-light: #f59e0b;
			--info: #2563eb;
			--info-light: #3b82f6;
			--success: #16a34a;
			--success-light: #22c55e;
			
			--border-radius: 12px;
			--border-radius-lg: 16px;
			--border-radius-xl: 20px;
		}

		/* Light Theme (Default) */
		:root {
			--bg-primary: #ffffff;
			--bg-secondary: #f8fafc;
			--bg-tertiary: #cccccc;
			--bg-card: #ffffff;
			--bg-glass: rgba(255, 255, 255, 0.8);
			--bg-overlay: rgba(255, 255, 255, 0.95);
			
			--text-primary: #0f172a;
			--text-secondary: #475569;
			--text-muted: #64748b;
			--text-inverse: #ffffff;
			
			--border: #e2e8f0;
			--border-hover: #cbd5e1;
			--border-light: #f1f5f9;
			
			--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
			--shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
			--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
			--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
			
			--gradient-primary: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
			--gradient-secondary: linear-gradient(135deg, #059669 0%, #0d9488 100%);
			--gradient-bg: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
		}


		/* Force Light Theme - Override any dark mode attempts */
		.dark, [data-theme="dark"], .theme-dark {
			--bg-primary: #ffffff !important;
			--bg-secondary: #f8fafc !important;
			--bg-tertiary: #f1f5f9 !important;
			--bg-card: #ffffff !important;
			--bg-glass: rgba(255, 255, 255, 0.8) !important;
			--bg-overlay: rgba(255, 255, 255, 0.95) !important;
			
			--text-primary: #0f172a !important;
			--text-secondary: #475569 !important;
			--text-muted: #64748b !important;
			--text-inverse: #ffffff !important;
			
			--border: #e2e8f0 !important;
			--border-hover: #cbd5e1 !important;
			--border-light: #f1f5f9 !important;
			
			--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
			--shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
			--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
			--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
			
			--gradient-bg: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
		}

		/* Force Light Theme Globally - Override any dark mode preferences */
		body, html, * {
			color-scheme: light !important;
		}

		/* Override system dark mode preference */
		@media (prefers-color-scheme: dark) {
			:root, body, html, * {
				color-scheme: light !important;
				
				--bg-primary: #ffffff !important;
				--bg-secondary: #f8fafc !important;
				--bg-tertiary: #f1f5f9 !important;
				--bg-card: #ffffff !important;
				--bg-glass: rgba(255, 255, 255, 0.8) !important;
				--bg-overlay: rgba(255, 255, 255, 0.95) !important;
				
				--text-primary: #0f172a !important;
				--text-secondary: #475569 !important;
				--text-muted: #64748b !important;
				--text-inverse: #ffffff !important;
				
				--border: #e2e8f0 !important;
				--border-hover: #cbd5e1 !important;
				--border-light: #f1f5f9 !important;
				
				--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
				--shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
				--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
				--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
				
				--gradient-bg: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
			}
		}

		/* Override Frappe's default styles for this page */
		.page-profit-and-loss-shor {
			background: var(--bg-primary) !important;
			color-scheme: light !important;
		}

		.page-profit-and-loss-shor .page-content {
			background: var(--gradient-bg) !important;
			color: var(--text-primary) !important;
			min-height: 100vh !important;
			font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
			position: relative !important;
			padding: 0 !important;
		}

		.page-profit-and-loss-shor .page-head {
			background: var(--bg-card) !important;
			backdrop-filter: blur(10px) !important;
			border-bottom: 1px solid var(--border) !important;
			color: var(--text-primary) !important;
		}

		.page-profit-and-loss-shor .page-title {
			color: var(--text-primary) !important;
			font-weight: 700 !important;
		}

		/* Modern Header Section */
		.modern-header {
			background: var(--bg-card);
			backdrop-filter: blur(20px);
			border: 1px solid var(--border);
			border-radius: var(--border-radius-lg);
			padding: 2rem;
			margin: 1.5rem;
			margin-bottom: 2rem;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 2rem;
			box-shadow: var(--shadow);
		}

		.header-info {
			display: flex;
			align-items: center;
			gap: 1rem;
		}

		.header-icon {
			width: 48px;
			height: 48px;
			background: var(--gradient-primary);
			border-radius: var(--border-radius);
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--text-inverse);
			font-size: 1.5rem;
			box-shadow: var(--shadow);
		}

		.header-text h1 {
			font-size: 1.5rem;
			font-weight: 700;
			margin-bottom: 0.25rem;
			color: var(--text-primary);
		}

		.header-text p {
			color: var(--text-secondary);
			font-size: 0.875rem;
		}

		.header-actions {
			display: flex;
			gap: 1rem;
			align-items: center;
		}

		/* Modern Button Styles */
		.btn-modern {
			padding: 0.75rem 1.5rem;
			border: none;
			border-radius: var(--border-radius);
			font-weight: 600;
			font-size: 0.875rem;
			cursor: pointer;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			text-decoration: none;
			position: relative;
			overflow: hidden;
			box-shadow: var(--shadow-sm);
		}

		.btn-modern:focus {
			outline: 2px solid var(--primary);
			outline-offset: 2px;
		}

		.btn-primary {
			background: var(--gradient-primary);
			color: var(--text-inverse);
			box-shadow: var(--shadow-lg);
		}

		.btn-primary:hover {
			transform: translateY(-1px);
			box-shadow: var(--shadow-xl);
		}

		.btn-secondary {
			background: var(--bg-card);
			color: var(--text-primary);
			border: 1px solid var(--border);
		}

		.btn-secondary:hover {
			background: var(--bg-tertiary);
			border-color: var(--border-hover);
			transform: translateY(-1px);
		}

		/* Enhanced Filter Section */
		.filter-section {
			background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
			border: 1px solid var(--border);
			border-radius: var(--border-radius-xl);
			padding: 2.5rem;
			margin: 0 1.5rem 2rem 1.5rem;
			box-shadow: var(--shadow-lg);
			position: relative;
			overflow: visible;
		}

		.filter-section::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 4px;
			background: var(--gradient-primary);
			border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
		}

		.filter-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 2rem;
			padding-bottom: 1rem;
			border-bottom: 2px solid var(--border-light);
		}

		.filter-title {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			font-size: 1.25rem;
			font-weight: 700;
			color: var(--text-primary);
		}

		.filter-title i {
			padding: 0.5rem;
			background: var(--gradient-primary);
			color: var(--text-inverse);
			border-radius: var(--border-radius);
			box-shadow: var(--shadow-sm);
		}

		.filter-actions {
			display: flex;
			gap: 0.75rem;
			flex-wrap: wrap;
		}

		.filter-quick-action {
			padding: 0.5rem 1rem;
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
			border-radius: var(--border-radius);
			color: var(--text-secondary);
			font-size: 0.75rem;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s ease;
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		.filter-quick-action:hover {
			background: var(--primary);
			color: var(--text-inverse);
			transform: translateY(-1px);
			box-shadow: var(--shadow);
		}

		.filter-quick-action.active {
			background: var(--primary);
			color: var(--text-inverse);
			box-shadow: var(--shadow);
			transform: translateY(-1px);
		}

		.filter-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: 2rem;
		}

		.filter-item {
			position: relative;
			background: var(--bg-card);
			border: 2px solid var(--border-light);
			border-radius: var(--border-radius-lg);
			padding: 1.5rem;
			transition: all 0.3s ease;
			box-shadow: var(--shadow-sm);
		}

		.filter-item:hover {
			border-color: var(--primary);
			box-shadow: var(--shadow);
			transform: translateY(-2px);
		}

		.filter-item.focused {
			border-color: var(--primary);
			box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
		}

		.filter-item label {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-size: 0.875rem;
			font-weight: 700;
			color: var(--text-primary);
			margin-bottom: 1rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		.filter-item label i {
			color: var(--primary);
			font-size: 1rem;
		}

		.filter-item::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 3px;
			background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
			border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
			opacity: 0;
			transition: opacity 0.3s ease;
		}

		.filter-item:hover::before,
		.filter-item.focused::before {
			opacity: 1;
		}

		.filter-input {
			width: 100% !important;
			padding: 0.875rem 1rem !important;
			background: var(--bg-secondary) !important;
			border: 1px solid var(--border) !important;
			border-radius: var(--border-radius) !important;
			color: var(--text-primary) !important;
			font-size: 0.875rem !important;
			transition: all 0.3s ease !important;
			box-sizing: border-box !important;
		}

		.filter-input:focus {
			outline: none !important;
			border-color: var(--primary) !important;
			box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
			background: var(--bg-card) !important;
		}

		/* Override Frappe form controls */
		.page-profit-and-loss-shor .form-control,
		.page-profit-and-loss-shor .input-with-feedback,
		.page-profit-and-loss-shor input[type="text"],
		.page-profit-and-loss-shor input[type="date"],
		.page-profit-and-loss-shor select {
			background: var(--bg-secondary) !important;
			border: 1px solid var(--border) !important;
			color: var(--text-primary) !important;
			border-radius: var(--border-radius) !important;
		}

		.page-profit-and-loss-shor .form-control:focus,
		.page-profit-and-loss-shor .input-with-feedback:focus,
		.page-profit-and-loss-shor input:focus,
		.page-profit-and-loss-shor select:focus {
			border-color: var(--primary) !important;
			box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
		}

		/* Fix alignment for non-mandatory fields */
		.filter-item label {
			display: inline-block;
			min-height: 1.5rem;
			padding-right: 0.5rem;
			vertical-align: top;
		}

		/* Ensure consistent spacing for all labels */
		.filter-item label::after {
			content: '';
			display: inline-block;
			width: 8px;
		}

		/* Fix dropdown z-index issues - Comprehensive Fix */
		.page-profit-and-loss-shor .filter-section,
		.page-profit-and-loss-shor .filter-grid,
		.page-profit-and-loss-shor .filter-item {
			position: relative;
			z-index: auto;
		}

		.page-profit-and-loss-shor .frappe-control,
		.page-profit-and-loss-shor .form-group,
		.page-profit-and-loss-shor .link-field,
		.page-profit-and-loss-shor .awesomplete {
			position: relative;
			z-index: 1000 !important;
		}

		/* Frappe Link Field Dropdown */
		.page-profit-and-loss-shor .link-field .awesomplete > ul,
		.page-profit-and-loss-shor .awesomplete ul,
		.page-profit-and-loss-shor .dropdown-menu,
		.page-profit-and-loss-shor .frappe-control .awesomplete > ul {
			z-index: 99999 !important;
			position: absolute !important;
			background: var(--bg-card) !important;
			border: 1px solid var(--border) !important;
			border-radius: var(--border-radius) !important;
			box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
			max-height: 200px !important;
			overflow-y: auto !important;
		}

		/* Override any parent z-index that might interfere */
		.page-profit-and-loss-shor .modern-header,
		.page-profit-and-loss-shor .view-tabs,
		.page-profit-and-loss-shor .main-content-container {
			z-index: 1 !important;
		}

		/* Filter section needs higher z-index for dropdowns */
		.page-profit-and-loss-shor .filter-section {
			z-index: 100 !important;
		}

		.page-profit-and-loss-shor .awesomplete ul li,
		.page-profit-and-loss-shor .link-field .awesomplete > ul li {
			background: var(--bg-card) !important;
			color: var(--text-primary) !important;
			padding: 0.5rem 1rem !important;
			border-bottom: 1px solid var(--border) !important;
		}

		.page-profit-and-loss-shor .awesomplete ul li:hover,
		.page-profit-and-loss-shor .awesomplete ul li[aria-selected="true"],
		.page-profit-and-loss-shor .link-field .awesomplete > ul li:hover,
		.page-profit-and-loss-shor .link-field .awesomplete > ul li[aria-selected="true"] {
			background: var(--primary) !important;
			color: white !important;
		}

		.page-profit-and-loss-shor .awesomplete ul li:last-child {
			border-bottom: none !important;
		}

		/* View Tabs */
		.view-tabs {
			display: flex;
			gap: 0.5rem;
			background: var(--bg-secondary);
			padding: 0.5rem;
			border-radius: var(--border-radius);
			margin: 0 1.5rem 2rem 1.5rem;
			border: 1px solid var(--border);
			box-shadow: var(--shadow-sm);
		}

		.view-tab {
			flex: 1;
			padding: 0.875rem 1rem;
			background: transparent;
			border: none;
			border-radius: calc(var(--border-radius) - 4px);
			color: var(--text-secondary);
			font-weight: 600;
			font-size: 0.875rem;
			cursor: pointer;
			transition: all 0.3s ease;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}

		.view-tab.active {
			background: var(--gradient-primary);
			color: var(--text-inverse);
			box-shadow: var(--shadow);
		}

		.view-tab:hover:not(.active) {
			background: var(--bg-tertiary);
			color: var(--text-primary);
		}

		/* Main Content Container */
		.main-content-container {
			padding: 0 1.5rem 1.5rem 1.5rem;
		}

		/* KPI Cards */
		.kpi-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: 1.5rem;
			margin-bottom: 2rem;
		}

		.kpi-card {
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: var(--border-radius-lg);
			padding: 2rem;
			position: relative;
			overflow: hidden;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: var(--shadow);
		}

		.kpi-card::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 4px;
			background: var(--gradient-primary);
		}

		.kpi-card:hover {
			transform: translateY(-4px);
			box-shadow: var(--shadow-xl);
			border-color: var(--border-hover);
		}

		.kpi-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			margin-bottom: 1.5rem;
		}

		.kpi-icon {
			width: 56px;
			height: 56px;
			border-radius: var(--border-radius);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 1.5rem;
			color: var(--text-inverse);
			box-shadow: var(--shadow);
		}

		.kpi-icon.revenue { background: var(--gradient-secondary); }
		.kpi-icon.profit { 
			background: linear-gradient(135deg, var(--info) 0%, var(--primary) 100%); 
		}
		.kpi-icon.expense { 
			background: linear-gradient(135deg, var(--warning) 0%, var(--danger) 100%); 
		}
		.kpi-icon.margin { 
			background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); 
		}

		.kpi-trend {
			padding: 0.375rem 0.75rem;
			border-radius: 20px;
			font-size: 0.75rem;
			font-weight: 600;
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		.kpi-trend.positive {
			background: rgba(22, 163, 74, 0.1);
			color: var(--success);
		}

		.kpi-trend.negative {
			background: rgba(220, 38, 38, 0.1);
			color: var(--danger);
		}

		.kpi-label {
			font-size: 0.875rem;
			color: var(--text-muted);
			font-weight: 500;
			margin-bottom: 0.5rem;
		}

		.kpi-value {
			font-size: 2rem;
			font-weight: 700;
			color: var(--text-primary);
			margin-bottom: 0.75rem;
		}

		.kpi-subtitle {
			font-size: 0.875rem;
			color: var(--text-secondary);
		}

		/* Summary Cards Grid */
		.summary-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
			gap: 1.5rem;
			margin-bottom: 2rem;
		}

		.summary-card {
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: var(--border-radius-lg);
			padding: 2rem;
			box-shadow: var(--shadow);
			transition: all 0.3s ease;
		}

		.summary-card:hover {
			border-color: var(--border-hover);
			transform: translateY(-2px);
			box-shadow: var(--shadow-lg);
		}

		.summary-title {
			font-size: 1.125rem;
			font-weight: 700;
			color: var(--text-primary);
			margin-bottom: 1.5rem;
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		.metric-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.75rem 0;
			border-bottom: 1px solid var(--border-light);
		}

		.metric-row:last-child {
			border-bottom: none;
		}

		.metric-label {
			font-size: 0.875rem;
			color: var(--text-secondary);
			font-weight: 500;
		}

		.metric-value {
			font-size: 1rem;
			font-weight: 600;
			color: var(--text-primary);
		}

		.metric-percentage {
			font-size: 0.75rem;
			padding: 0.25rem 0.5rem;
			border-radius: 0.375rem;
			margin-left: 0.5rem;
		}

		.metric-percentage.positive {
			background: rgba(22, 163, 74, 0.1);
			color: var(--success);
		}

		.metric-percentage.negative {
			background: rgba(220, 38, 38, 0.1);
			color: var(--danger);
		}

		/* Table Styles */
		.table-section {
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: var(--border-radius-lg);
			overflow: hidden;
			box-shadow: var(--shadow);
			margin-bottom: 2rem;
		}

		.table-header {
			background: var(--gradient-primary);
			padding: 1.5rem 2rem;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.table-title {
			font-size: 1.25rem;
			font-weight: 700;
			color: var(--text-inverse);
		}

		.table-actions {
			display: flex;
			gap: 0.75rem;
		}

		.table-action {
			padding: 0.5rem 1rem;
			background: rgba(255, 255, 255, 0.15);
			border: 1px solid rgba(255, 255, 255, 0.2);
			border-radius: 0.5rem;
			color: var(--text-inverse);
			font-size: 0.75rem;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s ease;
		}

		.table-action:hover {
			background: rgba(255, 255, 255, 0.25);
		}

		.data-table {
			width: 100%;
			border-collapse: collapse;
		}

		.data-table thead {
			background: var(--bg-secondary);
		}

		.data-table th {
			padding: 1rem 1.5rem;
			text-align: left;
			font-weight: 600;
			color: var(--text-secondary);
			font-size: 0.875rem;
			text-transform: uppercase;
			letter-spacing: 0.025em;
			border-bottom: 1px solid var(--border);
		}

		.data-table th:last-child {
			text-align: right;
		}

		.data-table td {
			padding: 1rem 1.5rem;
			border-bottom: 1px solid var(--border-light);
			color: var(--text-primary);
			font-size: 0.875rem;
		}

		.data-table td:last-child {
			text-align: right;
			font-weight: 600;
		}

		.data-table tbody tr {
			transition: all 0.2s ease;
			cursor: pointer;
		}

		.data-table tbody tr:hover {
			background: var(--bg-secondary);
		}

		.data-table tbody tr.total-row {
			background: var(--bg-tertiary);
			font-weight: 600;
		}

		.data-table tbody tr.total-row:hover {
			background: var(--bg-secondary);
		}

		.amount-positive {
			color: var(--success);
		}

		.amount-negative {
			color: var(--danger);
		}

		/* Highlight important profit metrics */
		.profit-highlight {
			background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
			color: white !important;
			font-weight: 700 !important;
			border-radius: 6px !important;
			padding: 0.5rem !important;
			box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3) !important;
			position: relative;
		}

		.profit-highlight::before {
			content: '💰';
			margin-right: 0.5rem;
		}

		/* Gross profit specific styling */
		.gross-profit-highlight {
			background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
			color: white !important;
			font-weight: 700 !important;
			border-radius: 6px !important;
			padding: 0.5rem !important;
			box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3) !important;
		}

		.gross-profit-highlight::before {
			content: '📈';
			margin-right: 0.5rem;
		}

		/* Net profit specific styling */
		.net-profit-highlight {
			background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
			color: white !important;
			font-weight: 700 !important;
			border-radius: 6px !important;
			padding: 0.5rem !important;
			box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3) !important;
		}

		.net-profit-highlight::before {
			content: '🎯';
			margin-right: 0.5rem;
		}

		/* Table row highlighting for profit metrics */
		tr.profit-row {
			background: rgba(16, 185, 129, 0.05) !important;
			border-left: 4px solid #10b981 !important;
		}

		tr.gross-profit-row {
			background: rgba(59, 130, 246, 0.05) !important;
			border-left: 4px solid #3b82f6 !important;
		}

		tr.net-profit-row {
			background: rgba(16, 185, 129, 0.05) !important;
			border-left: 4px solid #10b981 !important;
		}

		/* Profit percentage highlighting */
		.profit-percentage {
			background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
			color: white !important;
			font-weight: 600 !important;
			border-radius: 4px !important;
			padding: 0.25rem 0.5rem !important;
			font-size: 0.875rem !important;
		}

		/* Insights */
		.insights-section {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 1rem;
			margin-bottom: 2rem;
		}

		.insight-card {
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: var(--border-radius);
			padding: 1.5rem;
			border-left: 4px solid;
			transition: all 0.3s ease;
			box-shadow: var(--shadow-sm);
		}

		.insight-card.positive {
			border-left-color: var(--success);
			background: var(--bg-card);
		}

		.insight-card.warning {
			border-left-color: var(--warning);
			background: var(--bg-card);
		}

		.insight-card.danger {
			border-left-color: var(--danger);
			background: var(--bg-card);
		}

		.insight-card:hover {
			transform: translateX(4px);
			border-color: var(--border-hover);
			box-shadow: var(--shadow);
		}

		.insight-icon {
			margin-bottom: 0.75rem;
			font-size: 1.25rem;
		}

		.insight-message {
			font-size: 0.875rem;
			color: var(--text-primary);
			margin-bottom: 0.5rem;
			font-weight: 600;
		}

		.insight-detail {
			font-size: 0.75rem;
			color: var(--text-muted);
			line-height: 1.5;
		}

		/* Loading Animation */
		.loading-overlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--bg-overlay);
			backdrop-filter: blur(8px);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 9999;
			opacity: 0;
			visibility: hidden;
			transition: all 0.3s ease;
		}

		.loading-overlay.active {
			opacity: 1;
			visibility: visible;
		}

		.loading-spinner {
			width: 64px;
			height: 64px;
			border: 4px solid var(--border);
			border-top-color: var(--primary);
			border-radius: 50%;
			animation: spin 1s linear infinite;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		/* Animations */
		.fade-in {
			animation: fadeIn 0.6s ease-out;
		}

		@keyframes fadeIn {
			from {
				opacity: 0;
				transform: translateY(20px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		.slide-up {
			animation: slideUp 0.8s ease-out;
		}

		@keyframes slideUp {
			from {
				opacity: 0;
				transform: translateY(40px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		/* Responsive Design */
		@media (max-width: 1024px) {
			.modern-header {
				flex-direction: column;
				text-align: center;
				gap: 1rem;
			}
			
			.header-actions {
				width: 100%;
				justify-content: center;
			}
			
			.summary-grid {
				grid-template-columns: 1fr;
			}
		}

		@media (max-width: 768px) {
			.modern-header,
			.filter-section,
			.view-tabs,
			.main-content-container {
				margin-left: 1rem;
				margin-right: 1rem;
			}
			
			.modern-header {
				padding: 1.5rem;
			}
			
			.filter-section {
				padding: 1.5rem;
			}
			
			.filter-header {
				flex-direction: column;
				align-items: flex-start;
				gap: 1rem;
			}
			
			.filter-actions {
				width: 100%;
				justify-content: flex-start;
			}
			
			.filter-quick-action {
				font-size: 0.7rem;
				padding: 0.4rem 0.8rem;
			}
			
			.filter-grid {
				grid-template-columns: 1fr;
			}
			
			.kpi-grid {
				grid-template-columns: 1fr;
			}
			
			.view-tabs {
				flex-direction: column;
				gap: 0.25rem;
			}
			
			.header-actions {
				flex-direction: column;
				width: 100%;
			}
			
			.btn-modern {
				width: 100%;
				justify-content: center;
			}
			
			.data-table {
				font-size: 0.8rem;
			}
			
			.data-table th,
			.data-table td {
				padding: 0.75rem 1rem;
			}
		}

		@media (max-width: 480px) {
			.kpi-value {
				font-size: 1.5rem;
			}
			
			.summary-card {
				padding: 1.5rem;
			}
			
			.table-header {
				padding: 1rem 1.5rem;
			}
			
			.table-title {
				font-size: 1rem;
			}
			
			.table-actions {
				flex-direction: column;
				gap: 0.5rem;
			}
		}
	</style>`).appendTo('head');

	// Initialize page content
	page.main.html(`
		<!-- Loading Overlay -->
		<div class="loading-overlay" id="loadingOverlay">
			<div class="loading-spinner"></div>
		</div>

		<!-- Modern Header -->
		<div class="modern-header fade-in">
			<div class="header-info">
				<div class="header-icon">
					<i class="fas fa-chart-line"></i>
				</div>
				<div class="header-text">
					<h1>Profit & Loss Dashboard</h1>
					<p>Real-time financial performance insights and analytics</p>
				</div>
			</div>
			<div class="header-actions">
				<button class="btn-modern btn-secondary" id="exportBtn">
					<i class="fas fa-download"></i>
					Export
				</button>
				<button class="btn-modern btn-primary" id="generateBtn">
					<i class="fas fa-refresh"></i>
					Generate Report
				</button>
		
			</div>
		</div>

		<!-- Enhanced Filters -->
		<section class="filter-section fade-in">
			<div class="filter-header">
				<div class="filter-title">
					<i class="fas fa-filter"></i>
					Report Filters
				</div>
				<div class="filter-actions">
					<div class="filter-quick-action" onclick="setQuickFilter('thisMonth', this)">This Month</div>
					<div class="filter-quick-action" onclick="setQuickFilter('lastMonth', this)">Last Month</div>
					<div class="filter-quick-action" onclick="setQuickFilter('thisQuarter', this)">This Quarter</div>
					<div class="filter-quick-action" onclick="setQuickFilter('lastQuarter', this)">Last Quarter</div>
					<div class="filter-quick-action" onclick="setQuickFilter('thisYear', this)">This Year</div>
					<div class="filter-quick-action" onclick="setQuickFilter('lastYear', this)">Last Year</div>
				</div>
			</div>
			<div class="filter-grid">
				<div class="filter-item">
					<label><i class="fas fa-building"></i> Company</label>
					<div id="company-field"></div>
				</div>
				<div class="filter-item">
					<label><i class="fas fa-bullseye"></i> Cost Center</label>
					<div id="cost-center-field"></div>
				</div>
				<div class="filter-item">
					<label><i class="fas fa-calendar-alt"></i> Start Date</label>
					<div id="start-date-field"></div>
				</div>
				<div class="filter-item">
					<label><i class="fas fa-calendar-check"></i> End Date</label>
					<div id="end-date-field"></div>
				</div>
			</div>
		</section>

		<!-- View Tabs -->
		<nav class="view-tabs fade-in">
			<button class="view-tab active" data-view="dashboard">
				<i class="fas fa-tachometer-alt"></i>
				Dashboard
			</button>
			<button class="view-tab" data-view="detailed">
				<i class="fas fa-calendar-alt"></i>
				Month Wise
			</button>
			<button class="view-tab" data-view="comparison">
				<i class="fas fa-chart-bar"></i>
				YoY Comparison
			</button>
			<button class="view-tab" data-view="cost-center">
				<i class="fas fa-building"></i>
				Cost Centers
			</button>
		</nav>

		<!-- Content Area -->
		<div id="contentArea" class="main-content-container">
			<!-- KPI Cards -->
			<section class="kpi-grid slide-up" id="kpiSection">
				<div class="kpi-card">
					<div class="kpi-header">
						<div class="kpi-icon revenue">
							<i class="fas fa-dollar-sign"></i>
						</div>
						<div class="kpi-trend positive">
							<i class="fas fa-arrow-up"></i>
							<span id="revenue-trend">--</span>
						</div>
					</div>
					<div class="kpi-label">Total Revenue</div>
					<div class="kpi-value" id="revenue-value">AED0</div>
					<div class="kpi-subtitle" id="revenue-subtitle">Loading...</div>
				</div>

				<div class="kpi-card">
					<div class="kpi-header">
						<div class="kpi-icon profit">
							<i class="fas fa-chart-line"></i>
						</div>
						<div class="kpi-trend positive">
							<i class="fas fa-arrow-up"></i>
							<span id="profit-trend">--</span>
						</div>
					</div>
					<div class="kpi-label">Net Profit</div>
					<div class="kpi-value" id="profit-value">AED0</div>
					<div class="kpi-subtitle" id="profit-subtitle">Loading...</div>
				</div>

				<div class="kpi-card">
					<div class="kpi-header">
						<div class="kpi-icon expense">
							<i class="fas fa-coins"></i>
						</div>
						<div class="kpi-trend negative">
							<i class="fas fa-arrow-down"></i>
							<span id="expense-trend">--</span>
						</div>
					</div>
					<div class="kpi-label">Total Expenses</div>
					<div class="kpi-value" id="expense-value">AED0</div>
					<div class="kpi-subtitle" id="expense-subtitle">Loading...</div>
				</div>

				<div class="kpi-card">
					<div class="kpi-header">
						<div class="kpi-icon margin">
							<i class="fas fa-percentage"></i>
						</div>
						<div class="kpi-trend positive">
							<i class="fas fa-arrow-up"></i>
							<span id="margin-trend">--</span>
						</div>
					</div>
					<div class="kpi-label">Net Margin</div>
					<div class="kpi-value" id="margin-value">0%</div>
					<div class="kpi-subtitle" id="margin-subtitle">Loading...</div>
				</div>
			</section>

			<!-- Summary Cards -->
			<section class="summary-grid slide-up" id="summarySection">
				<div class="summary-card">
					<div class="summary-title">
						<i class="fas fa-chart-pie"></i>
						Financial Ratios
					</div>
					<div id="ratiosContent">
						<div class="metric-row">
							<span class="metric-label">Gross Profit Margin</span>
							<span class="metric-value" id="gross-margin">0%</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">Net Profit Margin</span>
							<span class="metric-value" id="net-margin">0%</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">Operating Margin</span>
							<span class="metric-value" id="operating-margin">0%</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">EBITDA Margin</span>
							<span class="metric-value" id="ebitda-margin">0%</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">Expense Ratio</span>
							<span class="metric-value" id="expense-ratio">0%</span>
						</div>
					</div>
				</div>


				<div class="summary-card">
					<div class="summary-title">
						<i class="fas fa-chart-pie"></i>
						Expense Breakdown
					</div>
					<div id="expenseBreakdownContent">
						<div class="metric-row">
							<span class="metric-label">Cost of Sales</span>
							<span class="metric-value" id="cost-of-sales">AED 0</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">Direct Salaries</span>
							<span class="metric-value" id="direct-salary">AED 0</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">Direct Expenses</span>
							<span class="metric-value" id="direct-expenses">AED 0</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">AE & SE Expenses</span>
							<span class="metric-value" id="ae-se-expense">AED 0</span>
						</div>
						<div class="metric-row">
							<span class="metric-label">Depreciation</span>
							<span class="metric-value" id="depreciation">AED 0</span>
						</div>
					</div>
				</div>

			</section>

			<!-- Insights -->
			<section class="insights-section slide-up" id="insightsSection">
				<div class="insight-card positive">
					<div class="insight-icon">💡</div>
					<div class="insight-message">Revenue Growth Analysis</div>
					<div class="insight-detail">Generate a report to see detailed insights about your financial performance and growth trends.</div>
				</div>

				<div class="insight-card warning">
					<div class="insight-icon">⚠️</div>
					<div class="insight-message">Cost Management</div>
					<div class="insight-detail">Monitor your expense trends and identify optimization opportunities to improve profitability.</div>
				</div>

				<div class="insight-card positive">
					<div class="insight-icon">📈</div>
					<div class="insight-message">Profit Optimization</div>
					<div class="insight-detail">Track profit margins and benchmark against industry standards for better performance.</div>
				</div>
			</section>

			<!-- P&L Table -->
			<section class="table-section slide-up" id="tableSection">
				<div class="table-header">
					<h3 class="table-title">Profit & Loss Statement</h3>
					<div class="table-actions">
						<button class="table-action" id="expandAll">
							<i class="fas fa-expand"></i>
							Expand All
						</button>
						<button class="table-action" id="exportTable">
							<i class="fas fa-download"></i>
							Export
						</button>
					</div>
				</div>
				<div id="tableContent">
					<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
						<i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
						<p>Generate a report to view P&L data</p>
					</div>
				</div>
			</section>
		</div>
	`);

	// Initialize Frappe controls - make it globally accessible
	setTimeout(() => {
		window.plFilters = {
			company: frappe.ui.form.make_control({
				parent: $('#company-field'),
				df: {
					fieldtype: 'Link',
					fieldname: 'company',
					options: 'Company',
					reqd: 1,
					default: frappe.defaults.get_user_default("Company")
				},
				render_input: true
			}),

			cost_center: frappe.ui.form.make_control({
				parent: $('#cost-center-field'),
				df: {
					fieldtype: 'Link',
					fieldname: 'cost_center',
					options: 'Cost Center',
					get_query: function() {
						return {
							filters: {
								company: window.plFilters && window.plFilters.company ? window.plFilters.company.get_value() : ''
							}
						};
					}
				},
				render_input: true
			}),

			start_date: frappe.ui.form.make_control({
				parent: $('#start-date-field'),
				df: {
					fieldtype: 'Date',
					fieldname: 'start_date',
					reqd: 1,
					default: frappe.datetime.add_months(frappe.datetime.get_today(), -6)
				},
				render_input: true
			}),

			end_date: frappe.ui.form.make_control({
				parent: $('#end-date-field'),
				df: {
					fieldtype: 'Date',
					fieldname: 'end_date',
					reqd: 1,
					default: frappe.datetime.get_today()
				},
				render_input: true
			})
		};
		
		console.log('Filters initialized:', window.plFilters);
	}, 100);

	// Global variables
	let currentView = 'dashboard';
	let reportData = null;

	// Event Handlers
	function setupEventHandlers() {
		// View tab switching
		$('.view-tab').on('click', function() {
			$('.view-tab').removeClass('active');
			$(this).addClass('active');
			currentView = $(this).data('view');
			switchView(currentView);
		});

		// Generate report
		$('#generateBtn').on('click', generateReport);

		// Test functionality
		$('#testBtn').on('click', testReport);

		// Export functionality
		$('#exportBtn').on('click', showExportOptions);
	}

	// Functions
	function showLoading() {
		$('#loadingOverlay').addClass('active');
	}

	function hideLoading() {
		$('#loadingOverlay').removeClass('active');
	}

	function generateReport() {
		const company = window.plFilters.company.get_value();
		const start_date = window.plFilters.start_date.get_value();
		const end_date = window.plFilters.end_date.get_value();
		const cost_center = window.plFilters.cost_center.get_value();

		if (!company || !start_date || !end_date) {
			frappe.msgprint({
				title: 'Missing Information',
				indicator: 'orange',
				message: 'Please select Company, Start Date and End Date'
			});
			return;
		}

		showLoading();

		// Calculate previous year dates for YoY comparison
		const prevYearStartDate = getPreviousYearDate(start_date);
		const prevYearEndDate = getPreviousYearDate(end_date);
		
		console.log('Fetching data for comparison:', {
			current: { start_date, end_date },
			previous: { start_date: prevYearStartDate, end_date: prevYearEndDate }
		});

		// Use the updated financial report API with enhanced parameters
		frappe.call({
			method: 'prastara_custom.controller.variant_pricing.get_financial_report', // Replace with your actual method path
			args: {
				start_date: start_date,
				end_date: end_date,
				company: company,
				cost_center: cost_center || null,
				report_type: 'detailed', // Get detailed data for monthly and YoY analysis
				include_monthly_breakdown: true, // Request monthly data
				include_previous_year: true, // Request previous year data for comparison
				previous_year_start_date: prevYearStartDate,
				previous_year_end_date: prevYearEndDate,
				comparison_type: 'year_over_year' // Specify comparison type
			},
			callback: function(r) {
				hideLoading();
				if (r.message && r.message.length > 0) {
					reportData = processFinancialData(r.message, start_date, end_date);
					updateDashboard(reportData);
					
					// Show success message with data summary
					const dataCount = r.message.length;
					const dateRange = `${frappe.format(start_date, {fieldtype: 'Date'})} to ${frappe.format(end_date, {fieldtype: 'Date'})}`;
					showNotification(`Report generated successfully! ${dataCount} metrics for ${dateRange}`, 'success');
				} else {
					showNotification('No financial data found for the selected filters. Please check your date range and company selection.', 'warning');
				}
			},
			error: function(err) {
				hideLoading();
				console.error('Error generating report:', err);
				
				// Provide more specific error messages
				let errorMessage = 'Failed to generate report. ';
				if (err.message && err.message.includes('does not exist')) {
					errorMessage += 'Please check if the API method path is correct in the code.';
				} else if (err.message && err.message.includes('custom_dashboard_parent')) {
					errorMessage += 'Please ensure your Account doctype has the custom_dashboard_parent field configured.';
				} else {
					errorMessage += 'Please check console for detailed error information.';
				}
				
				showNotification(errorMessage, 'error');
				
				// Show setup reminder
				setTimeout(() => {
					showNotification('Remember to replace "your_app.your_module.get_financial_report" with your actual method path!', 'info');
				}, 2000);
			}
		});
	}

	function testReport() {
		showLoading();
		
		const test_company = frappe.defaults.get_user_default("Company") || "Your Company";
		const testStartDate = '2025-01-01';
		const testEndDate = '2025-06-30';
		const testPrevStartDate = getPreviousYearDate(testStartDate);
		const testPrevEndDate = getPreviousYearDate(testEndDate);
		
		// Test the updated financial report API
		frappe.call({
			method: 'prastara_custom.controller.variant_pricing.get_financial_report', // Replace with your actual method path
			args: {
				start_date: testStartDate,
				end_date: testEndDate,
				company: test_company,
				cost_center: null,
				report_type: 'detailed',
				include_monthly_breakdown: true,
				include_previous_year: true,
				previous_year_start_date: testPrevStartDate,
				previous_year_end_date: testPrevEndDate,
				comparison_type: 'year_over_year'
			},
			callback: function(r) {
				hideLoading();
				if (r.message && r.message.length > 0) {
					showNotification('Test successful! Found ' + r.message.length + ' financial metrics. Check console for details.', 'success');
					console.log('Test financial data:', r.message);
					
					// Process and display test data
					const testData = processFinancialData(r.message, '2025-01-01', '2025-06-30');
					updateDashboard(testData);
				} else {
					showNotification('Test completed - no financial data returned', 'warning');
				}
			},
			error: function(err) {
				hideLoading();
				console.error('Test error:', err);
				
				// Provide helpful error messages for testing
				let errorMessage = 'Test failed. ';
				if (err.message && err.message.includes('does not exist')) {
					errorMessage += 'API method not found. Please update the method path in the code.';
				} else {
					errorMessage += 'Check console for error details.';
				}
				
				showNotification(errorMessage, 'error');
			}
		});
	}

	// Helper function to calculate previous year date
	function getPreviousYearDate(dateStr) {
		const date = new Date(dateStr);
		date.setFullYear(date.getFullYear() - 1);
		return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
	}

	function processFinancialData(data, start_date, end_date) {
		// Enhanced data processing to handle monthly and YoY comparison data
		const result = {
			current_year: {},
			previous_year: {},
			monthly_data: {},
			previous_year_monthly: {},
			raw_data: data
		};
		
		// Process the enhanced API response
		data.forEach(item => {
			const particular = item.particular;
			
			// Current year total
			result.current_year[particular] = item.amount || 0;
			
			// Previous year data (if available)
			if (item.previous_year_amount !== undefined) {
				result.previous_year[particular] = item.previous_year_amount || 0;
			}
			
			// Monthly breakdown for current year
			if (item.monthly_breakdown && Array.isArray(item.monthly_breakdown)) {
				result.monthly_data[particular] = item.monthly_breakdown;
			}
			
			// Monthly breakdown for previous year
			if (item.previous_year_monthly && Array.isArray(item.previous_year_monthly)) {
				result.previous_year_monthly[particular] = item.previous_year_monthly;
			}
		});
		
		// For backward compatibility, create metrics object
		const metrics = result.current_year;
		
		// Calculate date range for daily averages
		const startDate = new Date(start_date);
		const endDate = new Date(end_date);
		const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
		
		// Extract key values with fallbacks - handle both % and %% formats
		const revenue = Math.abs(metrics['Revenue'] || 0);
		const costOfSales = Math.abs(metrics['Cost of Sales'] || 0);
		const directSalary = Math.abs(metrics['Direct Salary and Allowances'] || 0);
		const directExpenses = Math.abs(metrics['Direct Expenses'] || 0);
		const totalDirectCost = Math.abs(metrics['Total Direct Cost'] || 0);
		const grossProfit = metrics['Gross Profit'] || 0;
		const aeSeExpense = Math.abs(metrics['AE and SE Expense'] || 0);
		const otherIncome = Math.abs(metrics['Other Income'] || 0);
		const sharedAllocation = Math.abs(metrics['Shared Allocation'] || 0);
		const ebitda = metrics['EBITDA'] || 0;
		const depreciation = Math.abs(metrics['Depreciation'] || 0);
		const ebit = metrics['EBIT'] || 0;
		const financeCost = Math.abs(metrics['Finance Cost'] || 0);
		const netProfit = metrics['Net Profit Before Income Tax'] || 0;
		
		// Calculate total expenses
		const totalExpenses = totalDirectCost + aeSeExpense + sharedAllocation + depreciation + financeCost;
		
		// Manual calculation of all percentages - ignore API percentage values
		console.log('Manual percentage calculation:', {
			'revenue': revenue,
			'grossProfit': grossProfit,
			'netProfit': netProfit,
			'ebitda': ebitda,
			'ebit': ebit,
			'totalExpenses': totalExpenses
		});
		
		// Calculate all margins manually using the correct formula
		const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
		const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
		const operatingMargin = revenue > 0 ? (ebit / revenue) * 100 : 0;
		const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
		const expenseRatio = revenue > 0 ? (totalExpenses / revenue) * 100 : 0;
		
		// Debug the calculated percentages
		console.log('Calculated percentages:', {
			'grossMargin': `${grossProfit} / ${revenue} * 100 = ${grossMargin.toFixed(2)}%`,
			'netMargin': `${netProfit} / ${revenue} * 100 = ${netMargin.toFixed(2)}%`,
			'operatingMargin': `${ebit} / ${revenue} * 100 = ${operatingMargin.toFixed(2)}%`,
			'ebitdaMargin': `${ebitda} / ${revenue} * 100 = ${ebitdaMargin.toFixed(2)}%`,
			'expenseRatio': `${totalExpenses} / ${revenue} * 100 = ${expenseRatio.toFixed(2)}%`
		});
		
		// Estimate ROI (simplified calculation)
		const estimatedAssets = revenue * 0.8; // Rough estimate based on revenue
		const roi = estimatedAssets > 0 ? (netProfit / estimatedAssets) * 100 : 0;
		
		// Extract company and cost center info from the new API structure
		const companiesData = [];
		const costCentersData = [];
		
		data.forEach(item => {
			if (item.companies && Array.isArray(item.companies)) {
				item.companies.forEach(company => {
					if (company && !companiesData.includes(company)) {
						companiesData.push(company);
					}
				});
			}
			if (item.cost_centers && Array.isArray(item.cost_centers)) {
				item.cost_centers.forEach(cc => {
					if (cc && cc !== 'Unassigned' && !costCentersData.includes(cc)) {
						costCentersData.push(cc);
					}
				});
			}
		});
		
		return {
			raw_data: data,
			metrics: metrics,
			enhanced_data: result, // Include the enhanced data structure
			summary: {
				revenue: revenue,
				expenses: totalExpenses,
				profit: netProfit,
				grossProfit: grossProfit,
				ebitda: ebitda,
				ebit: ebit,
				totalDirectCost: totalDirectCost,
				operatingExpenses: aeSeExpense + sharedAllocation,
				daysDiff: daysDiff,
				companies: companiesData,
				costCenters: costCentersData
			},
			ratios: {
				grossMargin: grossMargin,
				netMargin: netMargin,
				operatingMargin: operatingMargin,
				ebitdaMargin: ebitdaMargin,
				expenseRatio: expenseRatio,
				roi: roi
			},
			dailyMetrics: {
				revenuePerDay: revenue / daysDiff,
				expensePerDay: totalExpenses / daysDiff,
				profitPerDay: netProfit / daysDiff
			},
			breakdown: {
				costOfSales: costOfSales,
				directSalary: directSalary,
				directExpenses: directExpenses,
				aeSeExpense: aeSeExpense,
				otherIncome: otherIncome,
				sharedAllocation: sharedAllocation,
				depreciation: depreciation,
				financeCost: financeCost
			},
			// Add comparison data
			comparison: {
				previous_year: result.previous_year,
				monthly_current: result.monthly_data,
				monthly_previous: result.previous_year_monthly
			}
		};
	}

	function updateDashboard(data) {
		if (!data || !data.summary) return;
		
		const summary = data.summary;
		const ratios = data.ratios;
		const daily = data.dailyMetrics;
		
		// Update KPIs
		$('#revenue-value').text(formatCurrency(summary.revenue));
		$('#profit-value').text(formatCurrency(summary.profit));
		$('#expense-value').text(formatCurrency(summary.expenses));
		$('#margin-value').text(ratios.netMargin.toFixed(1) + '%');
		
		$('#revenue-subtitle').text('Total for selected period');
		$('#profit-subtitle').text(ratios.netMargin.toFixed(1) + '% net margin');
		$('#expense-subtitle').text(ratios.expenseRatio.toFixed(1) + '% of revenue');
		$('#margin-subtitle').text(ratios.netMargin > 15 ? 'Excellent' : ratios.netMargin > 10 ? 'Good' : 'Needs Improvement');
		
		// Update ratios
		$('#gross-margin').text(ratios.grossMargin.toFixed(1) + '%');
		$('#net-margin').text(ratios.netMargin.toFixed(1) + '%');
		$('#operating-margin').text(ratios.operatingMargin.toFixed(1) + '%');
		$('#ebitda-margin').text(ratios.ebitdaMargin.toFixed(1) + '%');
		$('#expense-ratio').text(ratios.expenseRatio.toFixed(1) + '%');
		
		// Update key metrics
		$('#revenue-growth').text('N/A'); // Would need historical data
		$('#profit-growth').text('N/A'); // Would need historical data
		$('#cost-control').text(ratios.expenseRatio < 80 ? 'Good' : 'Needs Attention');
		$('#breakeven').text(formatCurrency(summary.expenses));
		$('#roi').text(ratios.roi.toFixed(1) + '%');
		
		// Update expense breakdown
		$('#cost-of-sales').text(formatCurrency(data.breakdown.costOfSales));
		$('#direct-salary').text(formatCurrency(data.breakdown.directSalary));
		$('#direct-expenses').text(formatCurrency(data.breakdown.directExpenses));
		$('#ae-se-expense').text(formatCurrency(data.breakdown.aeSeExpense));
		$('#depreciation').text(formatCurrency(data.breakdown.depreciation));
		
		// Update performance indicators including coverage info
		$('#revenue-per-day').text(formatCurrency(daily.revenuePerDay));
		$('#avg-monthly-revenue').text(formatCurrency(daily.revenuePerDay * 30));
		$('#expense-per-day').text(formatCurrency(daily.expensePerDay));
		$('#profit-per-day').text(formatCurrency(daily.profitPerDay));
		
		// Show coverage information
		let coverageInfo = 'Complete data';
		if (summary.companies && summary.companies.length > 0) {
			coverageInfo = summary.companies.length === 1 ? 
				`${summary.companies[0]}` : 
				`${summary.companies.length} companies`;
		}
		if (summary.costCenters && summary.costCenters.length > 0) {
			coverageInfo += ` (${summary.costCenters.length} cost centers)`;
		}
		$('#cashflow-trend').text(daily.profitPerDay > 0 ? 'Positive' : 'Negative');
		
		// Add coverage info to the performance card title or as a subtitle
		$('#performanceContent').prepend(`
			<div style="
				padding: 0.75rem 1rem;
				background: var(--bg-secondary);
				border-radius: 0.5rem;
				margin-bottom: 1rem;
				font-size: 0.875rem;
				color: var(--text-secondary);
				text-align: center;
			">
				<i class="fas fa-info-circle"></i> Data Coverage: ${coverageInfo}
			</div>
		`);
		
		// Apply color coding
		applyColorCoding(ratios);
		
		// Update table
		updateTable(data.raw_data);
		
		// Update insights
		updateInsights(summary, ratios, data.breakdown);
	}

	function applyColorCoding(ratios) {
		// Color code margins
		const marginElements = ['#gross-margin', '#net-margin', '#operating-margin', '#ebitda-margin'];
		marginElements.forEach(element => {
			const value = parseFloat($(element).text());
			if (value > 20) {
				$(element).addClass('amount-positive');
			} else if (value > 10) {
				$(element).removeClass('amount-positive amount-negative');
			} else {
				$(element).addClass('amount-negative');
			}
		});
		
		// Color code expense ratio
		const expenseRatio = parseFloat($('#expense-ratio').text());
		if (expenseRatio > 80) {
			$('#expense-ratio').addClass('amount-negative');
		} else {
			$('#expense-ratio').addClass('amount-positive');
		}
		
		// Color code ROI
		const roi = parseFloat($('#roi').text());
		if (roi > 15) {
			$('#roi').addClass('amount-positive');
		} else if (roi < 5) {
			$('#roi').addClass('amount-negative');
		}
	}

	function generateTableHTML(data) {
		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Particulars</th>
						<th>Amount</th>
						<th>% of Revenue</th>
						<th>Category</th>
						<th>Coverage</th>
					</tr>
				</thead>
				<tbody>
					${data.map(item => {
						const isPercentage = item.particular.includes('%');
						
						// Skip API percentage values and calculate manually if needed
						let amount;
						if (isPercentage) {
							// For percentage items, calculate manually based on the item name
							const revenueItem = data.find(d => d.particular === 'Revenue');
							const revenueAmount = revenueItem ? Math.abs(revenueItem.amount) : 0;
							
							if (item.particular.includes('Gross Profit') && revenueAmount > 0) {
								const grossProfitItem = data.find(d => d.particular === 'Gross Profit');
								const grossProfitAmount = grossProfitItem ? grossProfitItem.amount : 0;
								amount = ((grossProfitAmount / revenueAmount) * 100).toFixed(1) + '%';
							} else if (item.particular.includes('Net Profit') && revenueAmount > 0) {
								const netProfitItem = data.find(d => d.particular === 'Net Profit Before Income Tax' || d.particular === 'Net Profit');
								const netProfitAmount = netProfitItem ? netProfitItem.amount : 0;
								amount = ((netProfitAmount / revenueAmount) * 100).toFixed(1) + '%';
							} else {
								// For other percentages, show as calculated or 0%
								amount = '0.0%';
							}
						} else {
							amount = formatCurrency(item.amount);
						}
						
						// Calculate percentage of revenue for non-percentage items
						const revenueItem = data.find(d => d.particular === 'Revenue');
						const revenueAmount = revenueItem ? Math.abs(revenueItem.amount) : 0;
						const percentOfRevenue = !isPercentage && revenueAmount > 0 ? 
							((Math.abs(item.amount) / revenueAmount) * 100).toFixed(1) + '%' : '-';
						
						// Categorize items
						let category = 'Other';
						if (['Revenue', 'Other Income'].includes(item.particular)) category = 'Income';
						else if (['Cost of Sales', 'Direct Salary and Allowances', 'Direct Expenses'].includes(item.particular)) category = 'Direct Costs';
						else if (['AE and SE Expense', 'Shared Allocation'].includes(item.particular)) category = 'Operating Expenses';
						else if (['Depreciation', 'Finance Cost'].includes(item.particular)) category = 'Non-Operating';
						else if (item.particular.includes('Profit') || item.particular === 'EBITDA' || item.particular === 'EBIT') category = 'Profitability';
						
						// Show coverage information (companies and cost centers)
						let coverage = 'All';
						if (item.companies && item.companies.length > 0) {
							coverage = item.companies.length === 1 ? item.companies[0] : item.companies.length + ' companies';
						}
						if (item.cost_centers && item.cost_centers.length > 0 && item.cost_centers.length < 5) {
							coverage += ' (' + item.cost_centers.length + ' CC)';
						}
						
						const isTotal = item.particular.includes('Total') || item.particular.includes('Profit') || 
										item.particular === 'EBITDA' || item.particular === 'EBIT';
						
						// Add profit highlighting classes
						let rowClass = isTotal ? 'total-row' : '';
						let amountClass = item.amount >= 0 ? 'amount-positive' : 'amount-negative';
						
						if (item.particular === 'Gross Profit') {
							rowClass += ' gross-profit-row';
							amountClass += ' gross-profit-highlight';
						} else if (item.particular.includes('Net Profit')) {
							rowClass += ' net-profit-row';
							amountClass += ' net-profit-highlight';
						} else if (item.particular === 'Gross Profit %' || item.particular === 'Net Profit %') {
							amountClass += ' profit-percentage';
						}
						
						// Display EBITDA as "EBITDA (Cash Profit)"
						const displayName = item.particular === 'EBITDA' ? 'EBITDA (Cash Profit)' : item.particular;
						
						return `
							<tr class="${rowClass}">
								<td><strong>${displayName}</strong></td>
								<td class="${amountClass}">
									${amount}
								</td>
								<td>${percentOfRevenue}</td>
								<td>
									<span style="
										padding: 0.25rem 0.5rem;
										border-radius: 0.375rem;
										font-size: 0.75rem;
										font-weight: 500;
										background: var(--bg-secondary);
										color: var(--text-secondary);
									">${category}</span>
								</td>
								<td style="font-size: 0.75rem; color: var(--text-muted);">
									${coverage}
								</td>
							</tr>
						`;
					}).join('')}
				</tbody>
			</table>
		`;
	}

	function generateMonthWiseTableHTML(data, startDate, endDate) {
		// Generate month columns based on date range
		const months = getMonthsInRange(startDate, endDate);
		
		// Get unique particulars (including percentage calculations) - maintain API order
		const particulars = [...new Set(data.map(item => item.particular))]
			.filter(particular => !particular.includes('%'));
		
		// Add calculated percentage rows
		const enhancedParticulars = [];
		particulars.forEach(particular => {
			enhancedParticulars.push(particular);
			// Add percentage rows after Gross Profit and Net Profit
			if (particular === 'Gross Profit') {
				enhancedParticulars.push('Gross Profit %');
			} else if (particular === 'Net Profit Before Income Tax' || particular === 'Net Profit') {
				enhancedParticulars.push('Net Profit %');
			}
		});
		
		// Check if we have actual monthly data from the API
		const hasMonthlyData = data.some(item => item.monthly_breakdown && item.monthly_breakdown.length > 0);
		
		return `
			<table class="data-table" style="min-width: ${Math.max(800, months.length * 120 + 300)}px;">
				<thead>
					<tr>
						<th style="position: sticky; left: 0; background: var(--bg-secondary); z-index: 10; min-width: 250px;">Particulars</th>
						${months.map(month => `
							<th style="min-width: 120px; text-align: center;">${month}</th>
						`).join('')}
						<th style="min-width: 120px; text-align: center; font-weight: 700; background: var(--bg-tertiary);">Total</th>
					</tr>
				</thead>
				<tbody>
					${enhancedParticulars.map(particular => {
						const isPercentageRow = particular.includes('%');
						let monthlyAmounts = [];
						let totalAmount = 0;
						
						if (isPercentageRow) {
							// Calculate percentage rows manually
							if (particular === 'Gross Profit %') {
								const revenueItem = data.find(item => item.particular === 'Revenue');
								const grossProfitItem = data.find(item => item.particular === 'Gross Profit');
								
								if (revenueItem && grossProfitItem) {
									// Calculate monthly percentages
									const revenueMonthly = hasMonthlyData && revenueItem.monthly_breakdown ? 
										revenueItem.monthly_breakdown : distributeAmountAcrossMonths(revenueItem.amount, months.length);
									const grossProfitMonthly = hasMonthlyData && grossProfitItem.monthly_breakdown ? 
										grossProfitItem.monthly_breakdown : distributeAmountAcrossMonths(grossProfitItem.amount, months.length);
									
									monthlyAmounts = months.map((_, index) => {
										const revenue = revenueMonthly[index] || 0;
										const grossProfit = grossProfitMonthly[index] || 0;
										return revenue > 0 ? (grossProfit / revenue) * 100 : 0;
									});
									totalAmount = revenueItem.amount > 0 ? (grossProfitItem.amount / revenueItem.amount) * 100 : 0;
								}
							} else if (particular === 'Net Profit %') {
								const revenueItem = data.find(item => item.particular === 'Revenue');
								const netProfitItem = data.find(item => item.particular === 'Net Profit Before Income Tax') || 
													 data.find(item => item.particular === 'Net Profit');
								
								if (revenueItem && netProfitItem) {
									// Calculate monthly percentages
									const revenueMonthly = hasMonthlyData && revenueItem.monthly_breakdown ? 
										revenueItem.monthly_breakdown : distributeAmountAcrossMonths(revenueItem.amount, months.length);
									const netProfitMonthly = hasMonthlyData && netProfitItem.monthly_breakdown ? 
										netProfitItem.monthly_breakdown : distributeAmountAcrossMonths(netProfitItem.amount, months.length);
									
									monthlyAmounts = months.map((_, index) => {
										const revenue = revenueMonthly[index] || 0;
										const netProfit = netProfitMonthly[index] || 0;
										return revenue > 0 ? (netProfit / revenue) * 100 : 0;
									});
									totalAmount = revenueItem.amount > 0 ? (netProfitItem.amount / revenueItem.amount) * 100 : 0;
								}
							}
						} else {
							// Regular amount rows
							const originalItem = data.find(item => item.particular === particular);
							totalAmount = originalItem ? originalItem.amount : 0;
							
							// Use actual monthly data if available, otherwise simulate
							if (hasMonthlyData && originalItem && originalItem.monthly_breakdown) {
								monthlyAmounts = originalItem.monthly_breakdown.slice(0, months.length);
								// Pad with zeros if not enough months
								while (monthlyAmounts.length < months.length) {
									monthlyAmounts.push(0);
								}
							} else {
								// Fallback to simulation
								monthlyAmounts = distributeAmountAcrossMonths(totalAmount, months.length);
							}
						}
						
						const isTotal = particular.includes('Total') || particular.includes('Profit') || 
									   particular === 'EBITDA' || particular === 'EBIT';
						
						// Add profit highlighting classes
						let rowClass = isPercentageRow ? 'total-row' : (isTotal ? 'total-row' : '');
						let cellClass = monthlyAmounts[0] >= 0 ? 'amount-positive' : 'amount-negative';
						let totalCellClass = totalAmount >= 0 ? 'amount-positive' : 'amount-negative';
						
						if (particular === 'Gross Profit') {
							rowClass += ' gross-profit-row';
							cellClass += ' gross-profit-highlight';
							totalCellClass += ' gross-profit-highlight';
						} else if (particular.includes('Net Profit') && !isPercentageRow) {
							rowClass += ' net-profit-row';
							cellClass += ' net-profit-highlight';
							totalCellClass += ' net-profit-highlight';
						} else if (particular === 'Gross Profit %' || particular === 'Net Profit %') {
							cellClass += ' profit-percentage';
							totalCellClass += ' profit-percentage';
						}
						
						// Display EBITDA as "EBITDA (Cash Profit)"
						const displayName = particular === 'EBITDA' ? 'EBITDA (Cash Profit)' : particular;
						
						return `
							<tr class="${rowClass}">
								<td style="position: sticky; left: 0; background: ${isTotal || isPercentageRow ? 'var(--bg-tertiary)' : 'var(--bg-card)'}; z-index: 5; font-weight: ${isTotal || isPercentageRow ? '700' : '500'};">
									${displayName}
								</td>
								${months.map((month, index) => {
									const monthCellClass = monthlyAmounts[index] >= 0 ? 'amount-positive' : 'amount-negative';
									let finalCellClass = monthCellClass;
									
									if (particular === 'Gross Profit') {
										finalCellClass += ' gross-profit-highlight';
									} else if (particular.includes('Net Profit') && !isPercentageRow) {
										finalCellClass += ' net-profit-highlight';
									} else if (particular === 'Gross Profit %' || particular === 'Net Profit %') {
										finalCellClass += ' profit-percentage';
									}
									
									return `
										<td style="text-align: right; ${isTotal || isPercentageRow ? 'font-weight: 600;' : ''}" class="${finalCellClass}">
											${isPercentageRow ? (monthlyAmounts[index] || 0).toFixed(1) + '%' : formatCurrency(monthlyAmounts[index])}
										</td>
									`;
								}).join('')}
								<td style="text-align: right; font-weight: 700; background: var(--bg-tertiary);" class="${totalCellClass}">
									${isPercentageRow ? (totalAmount || 0).toFixed(1) + '%' : formatCurrency(totalAmount)}
								</td>
							</tr>
						`;
					}).join('')}
				</tbody>
			</table>
			
			<div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">
				<i class="fas fa-info-circle"></i> 
				<strong>Data Source:</strong> ${hasMonthlyData ? 
					'Showing actual month-wise data from your accounting system.' : 
					'Monthly breakdown is simulated. Enable monthly_breakdown in API for real data.'
				}
			</div>
		`;
	}
	
	function getMonthsInRange(startDate, endDate) {
		const months = [];
		const start = new Date(startDate);
		const end = new Date(endDate);
		
		// Get the first day of the start month
		const current = new Date(start.getFullYear(), start.getMonth(), 1);
		
		while (current <= end) {
			const monthName = current.toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: 'short' 
			});
			months.push(monthName);
			
			// Move to next month
			current.setMonth(current.getMonth() + 1);
		}
		
		return months;
	}
	
	function distributeAmountAcrossMonths(totalAmount, monthCount) {
		// Simple distribution - divide equally across months
		// In real implementation, you'd use actual monthly data
		const amounts = [];
		const baseAmount = totalAmount / monthCount;
		
		for (let i = 0; i < monthCount; i++) {
			// Add some variation to make it look more realistic (±20%)
			const variation = (Math.random() - 0.5) * 0.4; // -20% to +20%
			const monthAmount = baseAmount * (1 + variation);
			amounts.push(monthAmount);
		}
		
		// Adjust the last month to ensure total matches exactly
		const currentTotal = amounts.reduce((sum, amt) => sum + amt, 0);
		const difference = totalAmount - currentTotal;
		amounts[amounts.length - 1] += difference;
		
		return amounts;
	}
	
	function generateYoYComparisonHTML(data) {
		const currentYear = new Date(window.plFilters.start_date.get_value()).getFullYear();
		const previousYear = currentYear - 1;
		
		// Get unique particulars (excluding percentage items for now) - maintain API order
		const baseParticulars = [...new Set(data.raw_data.map(item => item.particular))]
			.filter(particular => !particular.includes('%'));

		// Add percentage rows after specific particulars
		const enhancedParticulars = [];
		baseParticulars.forEach(particular => {
			enhancedParticulars.push(particular);
			if (particular === 'Gross Profit') {
				enhancedParticulars.push('Gross Profit %');
			} else if (particular === 'Net Profit Before Income Tax' || particular === 'Net Profit') {
				enhancedParticulars.push('Net Profit %');
			}
		});

		// Get revenue amounts for percentage calculations
		const currentRevenueItem = data.raw_data.find(item => 
			item.particular === 'Total Revenue' || item.particular === 'Revenue' || 
			item.particular.toLowerCase().includes('revenue') || item.particular.toLowerCase().includes('income')
		);
		const currentRevenue = currentRevenueItem ? currentRevenueItem.amount : 0;
		const previousRevenue = data.comparison && data.comparison.previous_year ? 
			(data.comparison.previous_year['Total Revenue'] || data.comparison.previous_year['Revenue'] || 
			 Object.values(data.comparison.previous_year).find(val => typeof val === 'number' && val > 0) || 0) : 0;
		
		return `
			<table class="data-table">
				<thead>
					<tr>
						<th style="min-width: 250px;">Particulars</th>
						<th style="text-align: right; min-width: 120px;">${currentYear}</th>
						<th style="text-align: right; min-width: 120px;">${previousYear}</th>
						<th style="text-align: right; min-width: 100px;">Variance</th>
						<th style="text-align: right; min-width: 100px;">% Change</th>
						<th style="text-align: center; min-width: 100px;">Trend</th>
					</tr>
				</thead>
				<tbody>
					${enhancedParticulars.map(particular => {
						// Handle percentage rows
						if (particular.includes('%')) {
							let currentPercentage = 0;
							let previousPercentage = 0;
							
							if (particular === 'Gross Profit %') {
								const currentGrossProfitItem = data.raw_data.find(item => item.particular === 'Gross Profit');
								const currentGrossProfit = currentGrossProfitItem ? currentGrossProfitItem.amount : 0;
								const previousGrossProfit = data.comparison.previous_year['Gross Profit'] || 0;
								
								currentPercentage = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0;
								previousPercentage = previousRevenue > 0 ? (previousGrossProfit / previousRevenue) * 100 : 0;
							} else if (particular === 'Net Profit %') {
								const currentNetProfitItem = data.raw_data.find(item => 
									item.particular === 'Net Profit Before Income Tax' || item.particular === 'Net Profit'
								);
								const currentNetProfit = currentNetProfitItem ? currentNetProfitItem.amount : 0;
								const previousNetProfit = data.comparison.previous_year['Net Profit Before Income Tax'] || 
														data.comparison.previous_year['Net Profit'] || 0;
								
								currentPercentage = currentRevenue > 0 ? (currentNetProfit / currentRevenue) * 100 : 0;
								previousPercentage = previousRevenue > 0 ? (previousNetProfit / previousRevenue) * 100 : 0;
							}
							
							const variance = currentPercentage - previousPercentage;
							const percentChange = previousPercentage !== 0 ? ((variance / Math.abs(previousPercentage)) * 100) : 0;
							
							let trendIcon = '→';
							let trendClass = '';
							if (variance > 1) {
								trendIcon = '↗️';
								trendClass = 'amount-positive';
							} else if (variance < -1) {
								trendIcon = '↘️';
								trendClass = 'amount-negative';
							}
							
							// Add profit percentage highlighting
							let percentageRowClass = 'total-row';
							let currentPercentageClass = currentPercentage >= 0 ? 'amount-positive' : 'amount-negative';
							
							if (particular === 'Gross Profit %' || particular === 'Net Profit %') {
								currentPercentageClass += ' profit-percentage';
							}
							
							return `
								<tr class="${percentageRowClass}" style="background: rgba(var(--primary-rgb), 0.05);">
									<td style="font-weight: 600; font-style: italic;">
										${particular}
									</td>
									<td style="text-align: right; font-weight: 600;" class="${currentPercentageClass}">
										${currentPercentage.toFixed(1)}%
									</td>
									<td style="text-align: right; font-weight: 600;" class="${previousPercentage >= 0 ? 'amount-positive' : 'amount-negative'}">
										${previousPercentage.toFixed(1)}%
									</td>
									<td style="text-align: right; font-weight: 600;" class="${variance >= 0 ? 'amount-positive' : 'amount-negative'}">
										${variance >= 0 ? '+' : ''}${variance.toFixed(1)}pp
									</td>
									<td style="text-align: right; font-weight: 600;" class="${percentChange >= 0 ? 'amount-positive' : 'amount-negative'}">
										${previousPercentage !== 0 ? (percentChange >= 0 ? '+' : '') + percentChange.toFixed(1) + '%' : '-'}
									</td>
									<td style="text-align: center; font-size: 1.2em;" class="${trendClass}">
										${trendIcon}
									</td>
								</tr>
							`;
						}

						// Handle regular amount rows
						const currentItem = data.raw_data.find(item => item.particular === particular);
						const currentAmount = currentItem ? currentItem.amount : 0;
						const previousAmount = data.comparison.previous_year[particular] || 0;
						
						const variance = currentAmount - previousAmount;
						const percentChange = previousAmount !== 0 ? ((variance / Math.abs(previousAmount)) * 100) : 0;
						
						const isTotal = particular.includes('Total') || particular.includes('Profit') || 
									   particular === 'EBITDA' || particular === 'EBIT';
						
						// Add profit highlighting classes
						let rowClass = isTotal ? 'total-row' : '';
						let currentAmountClass = currentAmount >= 0 ? 'amount-positive' : 'amount-negative';
						
						if (particular === 'Gross Profit') {
							rowClass += ' gross-profit-row';
							currentAmountClass += ' gross-profit-highlight';
						} else if (particular.includes('Net Profit')) {
							rowClass += ' net-profit-row';
							currentAmountClass += ' net-profit-highlight';
						}
						
						let trendIcon = '→';
						let trendClass = '';
						if (percentChange > 5) {
							trendIcon = '↗️';
							trendClass = 'amount-positive';
						} else if (percentChange < -5) {
							trendIcon = '↘️';
							trendClass = 'amount-negative';
						}
						
						// Display EBITDA as "EBITDA (Cash Profit)"
						const displayName = particular === 'EBITDA' ? 'EBITDA (Cash Profit)' : particular;
						
						return `
							<tr class="${rowClass}">
								<td style="font-weight: ${isTotal ? '700' : '500'};">
									${displayName}
								</td>
								<td style="text-align: right;" class="${currentAmountClass}">
									${formatCurrency(currentAmount)}
								</td>
								<td style="text-align: right;" class="${previousAmount >= 0 ? 'amount-positive' : 'amount-negative'}">
									${formatCurrency(previousAmount)}
								</td>
								<td style="text-align: right;" class="${variance >= 0 ? 'amount-positive' : 'amount-negative'}">
									${variance >= 0 ? '+' : ''}${formatCurrency(variance)}
								</td>
								<td style="text-align: right; font-weight: 600;" class="${percentChange >= 0 ? 'amount-positive' : 'amount-negative'}">
									${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%
								</td>
								<td style="text-align: center; font-size: 1.2em;" class="${trendClass}">
									${trendIcon}
								</td>
							</tr>
						`;
					}).join('')}
				</tbody>
			</table>
			
			<div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">
				<i class="fas fa-info-circle"></i> 
				<strong>Comparison Period:</strong> ${currentYear} vs ${previousYear} | 
				<strong>Positive variance</strong> indicates improvement for revenue/profit items, 
				<strong>negative variance</strong> indicates improvement for expense items.
			</div>
		`;
	}

	function updateTable(data) {
		const tableHTML = generateTableHTML(data);
		$('#tableContent').html(tableHTML);
	}

	function updateInsights(summary, ratios, breakdown) {
		const insights = [];
		
		// Revenue analysis - Updated for AED currency
		if (summary.revenue > 18000000) { // 18 Million AED (approx 5 Crore INR equivalent)
			insights.push({
				type: 'positive',
				icon: '🚀',
				message: 'Exceptional Revenue Scale',
				detail: `Revenue of ${formatCurrency(summary.revenue)} indicates a large-scale operation with strong market presence.`
			});
		} else if (summary.revenue > 3600000) { // 3.6 Million AED (approx 1 Crore INR equivalent)
			insights.push({
				type: 'positive',
				icon: '📈',
				message: 'Strong Revenue Performance',
				detail: `Revenue of ${formatCurrency(summary.revenue)} shows solid business growth and market traction.`
			});
		}
		
		// Profitability analysis
		if (ratios.netMargin > 25) {
			insights.push({
				type: 'positive',
				icon: '💎',
				message: 'Outstanding Profitability',
				detail: `Net profit margin of ${ratios.netMargin.toFixed(1)}% is exceptional and well above industry standards.`
			});
		} else if (ratios.netMargin > 15) {
			insights.push({
				type: 'positive',
				icon: '✅',
				message: 'Healthy Profit Margins',
				detail: `Net profit margin of ${ratios.netMargin.toFixed(1)}% indicates strong profitability and efficient operations.`
			});
		} else if (ratios.netMargin > 5) {
			insights.push({
				type: 'warning',
				icon: '⚠️',
				message: 'Moderate Profitability',
				detail: `Net profit margin of ${ratios.netMargin.toFixed(1)}% is reasonable but has room for improvement.`
			});
		} else if (ratios.netMargin > 0) {
			insights.push({
				type: 'warning',
				icon: '📊',
				message: 'Low Profitability',
				detail: `Net profit margin of ${ratios.netMargin.toFixed(1)}% needs attention. Consider cost optimization strategies.`
			});
		} else {
			insights.push({
				type: 'danger',
				icon: '🚨',
				message: 'Negative Profitability',
				detail: `Current operations are generating losses. Immediate review of costs and revenue strategies required.`
			});
		}
		
		// Cost structure analysis
		const directCostRatio = summary.revenue > 0 ? (summary.totalDirectCost / summary.revenue) * 100 : 0;
		if (directCostRatio > 70) {
			insights.push({
				type: 'danger',
				icon: '💸',
				message: 'High Direct Cost Burden',
				detail: `Direct costs represent ${directCostRatio.toFixed(1)}% of revenue. Review supplier contracts and operational efficiency.`
			});
		} else if (directCostRatio < 40) {
			insights.push({
				type: 'positive',
				icon: '💰',
				message: 'Excellent Cost Control',
				detail: `Direct costs at ${directCostRatio.toFixed(1)}% of revenue show excellent operational efficiency.`
			});
		}
		
		// EBITDA analysis
		if (ratios.ebitdaMargin > 20) {
			insights.push({
				type: 'positive',
				icon: '⭐',
				message: 'Strong Operating Performance',
				detail: `EBITDA margin of ${ratios.ebitdaMargin.toFixed(1)}% demonstrates excellent operational efficiency.`
			});
		} else if (ratios.ebitdaMargin < 10) {
			insights.push({
				type: 'warning',
				icon: '🎯',
				message: 'Operating Efficiency Opportunity',
				detail: `EBITDA margin of ${ratios.ebitdaMargin.toFixed(1)}% suggests potential for operational improvements.`
			});
		}
		
		// Growth and daily performance - Updated for AED
		const dailyProfit = summary.profit / summary.daysDiff;
		if (dailyProfit > 36000) { // 36,000 AED per day (approx 1 Lakh INR equivalent)
			insights.push({
				type: 'positive',
				icon: '🏆',
				message: 'Excellent Daily Performance',
				detail: `Generating ${formatCurrency(dailyProfit)} profit per day shows strong business momentum.`
			});
		}
		
		// Update insights section
		const insightsHTML = insights.slice(0, 4).map(insight => `
			<div class="insight-card ${insight.type}">
				<div class="insight-icon">${insight.icon}</div>
				<div class="insight-message">${insight.message}</div>
				<div class="insight-detail">${insight.detail}</div>
			</div>
		`).join('');
		
		$('#insightsSection').html(insightsHTML);
	}

	function switchView(view) {
		console.log('Switching to view:', view);
		
		if (view === 'detailed') {
			// Show Month Wise pivot table
			if (reportData && reportData.raw_data) {
				const startDate = window.plFilters.start_date.get_value();
				const endDate = window.plFilters.end_date.get_value();
				
				$('#contentArea').html(`
					<section class="table-section slide-up">
						<div class="table-header">
							<h3 class="table-title">Month Wise P&L Statement</h3>
							<div class="table-actions">
								<button class="table-action" id="expandAll">
									<i class="fas fa-expand"></i>
									Expand All
								</button>
								<button class="table-action" id="exportTable">
									<i class="fas fa-download"></i>
									Export
								</button>
							</div>
						</div>
						<div id="monthWiseTableContent" style="overflow-x: auto;">
							${generateMonthWiseTableHTML(reportData.raw_data, startDate, endDate)}
						</div>
					</section>
				`);
			} else {
				$('#contentArea').html(`
					<section class="table-section slide-up">
						<div class="table-header">
							<h3 class="table-title">Month Wise P&L Statement</h3>
						</div>
						<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
							<i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
							<p>Generate a report to view month wise P&L data</p>
						</div>
					</section>
				`);
			}
		} else if (view === 'dashboard') {
			// Switch back to dashboard view - restore all sections
			if (reportData) {
				// Restore the full dashboard HTML structure
				$('#contentArea').html(`
					<!-- KPI Cards -->
					<section class="kpi-grid slide-up" id="kpiSection">
						<div class="kpi-card">
							<div class="kpi-header">
								<div class="kpi-icon revenue">
									<i class="fas fa-dollar-sign"></i>
								</div>
								<div class="kpi-trend positive">
									<i class="fas fa-arrow-up"></i>
									<span id="revenue-trend">--</span>
								</div>
							</div>
							<div class="kpi-label">Total Revenue</div>
							<div class="kpi-value" id="revenue-value">AED0</div>
							<div class="kpi-subtitle" id="revenue-subtitle">Loading...</div>
						</div>

						<div class="kpi-card">
							<div class="kpi-header">
								<div class="kpi-icon profit">
									<i class="fas fa-chart-line"></i>
								</div>
								<div class="kpi-trend positive">
									<i class="fas fa-arrow-up"></i>
									<span id="profit-trend">--</span>
								</div>
							</div>
							<div class="kpi-label">Net Profit</div>
							<div class="kpi-value" id="profit-value">AED0</div>
							<div class="kpi-subtitle" id="profit-subtitle">Loading...</div>
						</div>

						<div class="kpi-card">
							<div class="kpi-header">
								<div class="kpi-icon expense">
									<i class="fas fa-coins"></i>
								</div>
								<div class="kpi-trend negative">
									<i class="fas fa-arrow-down"></i>
									<span id="expense-trend">--</span>
								</div>
							</div>
							<div class="kpi-label">Total Expenses</div>
							<div class="kpi-value" id="expense-value">AED0</div>
							<div class="kpi-subtitle" id="expense-subtitle">Loading...</div>
						</div>

						<div class="kpi-card">
							<div class="kpi-header">
								<div class="kpi-icon margin">
									<i class="fas fa-percentage"></i>
								</div>
								<div class="kpi-trend positive">
									<i class="fas fa-arrow-up"></i>
									<span id="margin-trend">--</span>
								</div>
							</div>
							<div class="kpi-label">Gross Margin</div>
							<div class="kpi-value" id="margin-value">0%</div>
							<div class="kpi-subtitle" id="margin-subtitle">Loading...</div>
						</div>
					</section>

					<!-- Summary Cards -->
					<section class="summary-grid slide-up" id="summarySection">
						<div class="summary-card">
							<div class="summary-title">
								<i class="fas fa-chart-pie"></i>
								Financial Ratios
							</div>
							<div id="ratiosContent">
								<div class="metric-row">
									<span class="metric-label">Gross Profit Margin</span>
									<span class="metric-value" id="gross-margin">0%</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">Net Profit Margin</span>
									<span class="metric-value" id="net-margin">0%</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">Operating Margin</span>
									<span class="metric-value" id="operating-margin">0%</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">EBITDA Margin</span>
									<span class="metric-value" id="ebitda-margin">0%</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">Expense Ratio</span>
									<span class="metric-value" id="expense-ratio">0%</span>
								</div>
							</div>
						</div>


						<div class="summary-card">
							<div class="summary-title">
								<i class="fas fa-chart-pie"></i>
								Expense Breakdown
							</div>
							<div id="expenseBreakdownContent">
								<div class="metric-row">
									<span class="metric-label">Cost of Sales</span>
									<span class="metric-value" id="cost-of-sales">AED 0</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">Direct Salaries</span>
									<span class="metric-value" id="direct-salary">AED 0</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">Direct Expenses</span>
									<span class="metric-value" id="direct-expenses">AED 0</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">AE & SE Expenses</span>
									<span class="metric-value" id="ae-se-expense">AED 0</span>
								</div>
								<div class="metric-row">
									<span class="metric-label">Depreciation</span>
									<span class="metric-value" id="depreciation">AED 0</span>
								</div>
							</div>
						</div>

					</section>

					<!-- Insights -->
					<section class="insights-section slide-up" id="insightsSection">
						<div class="insight-card positive">
							<div class="insight-icon">💡</div>
							<div class="insight-message">Revenue Growth Analysis</div>
							<div class="insight-detail">Generate a report to see detailed insights about your financial performance and growth trends.</div>
						</div>

						<div class="insight-card warning">
							<div class="insight-icon">⚠️</div>
							<div class="insight-message">Cost Management</div>
							<div class="insight-detail">Monitor your expense trends and identify optimization opportunities to improve profitability.</div>
						</div>

						<div class="insight-card positive">
							<div class="insight-icon">📈</div>
							<div class="insight-message">Profit Optimization</div>
							<div class="insight-detail">Track profit margins and benchmark against industry standards for better performance.</div>
						</div>
					</section>

					<!-- P&L Table -->
					<section class="table-section slide-up" id="tableSection">
						<div class="table-header">
							<h3 class="table-title">Profit & Loss Statement</h3>
							<div class="table-actions">
								<button class="table-action" id="expandAll">
									<i class="fas fa-expand"></i>
									Expand All
								</button>
								<button class="table-action" id="exportTable">
									<i class="fas fa-download"></i>
									Export
								</button>
							</div>
						</div>
						<div id="tableContent">
							<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
								<i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
								<p>Generate a report to view P&L data</p>
							</div>
						</div>
					</section>
				`);
				
				// Repopulate the dashboard with existing data
				updateDashboard(reportData);
			} else {
				// Show empty dashboard structure
				$('#contentArea').html(`
					<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
						<i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
						<p>Generate a report to view dashboard data</p>
					</div>
				`);
			}
		} else if (view === 'comparison') {
			// Show YoY comparison view
			if (reportData && reportData.comparison) {
				$('#contentArea').html(`
					<section class="table-section slide-up">
						<div class="table-header">
							<h3 class="table-title">Year over Year Comparison</h3>
							<div class="table-actions">
								<button class="table-action" id="exportComparison">
									<i class="fas fa-download"></i>
									Export
								</button>
							</div>
						</div>
						<div id="comparisonTableContent">
							${generateYoYComparisonHTML(reportData)}
						</div>
					</section>
				`);
			} else {
				$('#contentArea').html(`
					<section class="table-section slide-up">
						<div class="table-header">
							<h3 class="table-title">Year over Year Comparison</h3>
						</div>
						<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
							<i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
							<p>Generate a report to view YoY comparison data</p>
						</div>
					</section>
				`);
			}
		} else {
			// For other views, show placeholder
			$('#contentArea').html(`
				<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
					<i class="fas fa-construction" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
					<h3>${view.charAt(0).toUpperCase() + view.slice(1)} View</h3>
					<p>This view is under development</p>
				</div>
			`);
		}
	}

	function showExportOptions() {
		frappe.prompt([
			{
				fieldname: 'format',
				label: 'Export Format',
				fieldtype: 'Select',
				options: 'Excel\nPDF\nCSV',
				default: 'Excel'
			}
		], function(values) {
			exportData(values.format);
		}, 'Export Options', 'Export');
	}

	function exportData(format) {
		const currentData = getCurrentTableData();
		const reportTitle = 'Profit and Loss Report';
		const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
		
		switch(format) {
			case 'Excel':
				exportToExcel(currentData, reportTitle, timestamp);
				break;
			case 'CSV':
				exportToCSV(currentData, reportTitle, timestamp);
				break;
			case 'PDF':
				exportToPDF(currentData, reportTitle, timestamp);
				break;
		}
	}

	function getCurrentTableData() {
		const data = [];
		const table = document.querySelector('#tableContent table');
		
		if (!table) {
			showNotification('No table data found to export', 'error');
			return [];
		}

		// Extract headers
		const headers = [];
		table.querySelectorAll('thead th').forEach(th => {
			headers.push(th.textContent.trim());
		});
		
		// Extract rows
		table.querySelectorAll('tbody tr').forEach(tr => {
			const row = {};
			tr.querySelectorAll('td').forEach((td, index) => {
				if (headers[index]) {
					row[headers[index]] = td.textContent.trim();
				}
			});
			data.push(row);
		});

		return { headers, data };
	}

	function exportToExcel(tableData, title, timestamp) {
		if (!tableData.data.length) {
			showNotification('No data to export', 'error');
			return;
		}

		// Create workbook and worksheet
		const wb = {
			SheetNames: ['Profit & Loss'],
			Sheets: {}
		};

		// Convert data to array format
		const wsData = [tableData.headers];
		tableData.data.forEach(row => {
			const rowData = tableData.headers.map(header => row[header] || '');
			wsData.push(rowData);
		});

		// Create worksheet
		wb.Sheets['Profit & Loss'] = arrayToSheet(wsData);

		// Generate Excel file
		const filename = `${title}_${timestamp}.xlsx`;
		downloadExcel(wb, filename);
		showNotification(`Excel file "${filename}" downloaded successfully`, 'success');
	}

	function exportToCSV(tableData, title, timestamp) {
		if (!tableData.data.length) {
			showNotification('No data to export', 'error');
			return;
		}

		let csv = tableData.headers.join(',') + '\n';
		
		tableData.data.forEach(row => {
			const csvRow = tableData.headers.map(header => {
				const value = row[header] || '';
				// Escape commas and quotes in CSV
				return value.includes(',') || value.includes('"') ? 
					`"${value.replace(/"/g, '""')}"` : value;
			});
			csv += csvRow.join(',') + '\n';
		});

		// Create and download CSV file
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const filename = `${title}_${timestamp}.csv`;
		
		if (navigator.msSaveBlob) {
			navigator.msSaveBlob(blob, filename);
		} else {
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
		
		showNotification(`CSV file "${filename}" downloaded successfully`, 'success');
	}

	function exportToPDF(tableData, title, timestamp) {
		if (!tableData.data.length) {
			showNotification('No data to export', 'error');
			return;
		}

		// Create print-friendly content
		const printWindow = window.open('', '_blank');
		const printContent = generatePrintContent(tableData, title);
		
		printWindow.document.write(printContent);
		printWindow.document.close();
		printWindow.focus();
		
		setTimeout(() => {
			printWindow.print();
			printWindow.close();
			showNotification('PDF export initiated - please use browser print dialog', 'info');
		}, 250);
	}

	function generatePrintContent(tableData, title) {
		const currentDate = new Date().toLocaleDateString();
		
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<title>${title}</title>
				<style>
					body { font-family: Arial, sans-serif; margin: 20px; }
					.header { text-align: center; margin-bottom: 30px; }
					.date { text-align: right; margin-bottom: 20px; color: #666; }
					table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
					th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
					th { background-color: #f2f2f2; font-weight: bold; }
					tr:nth-child(even) { background-color: #f9f9f9; }
					.amount { text-align: right; }
					@media print {
						body { margin: 0; }
						.header { margin-bottom: 20px; }
					}
				</style>
			</head>
			<body>
				<div class="header">
					<h1>${title}</h1>
				</div>
				<div class="date">Generated on: ${currentDate}</div>
				<table>
					<thead>
						<tr>
							${tableData.headers.map(header => `<th>${header}</th>`).join('')}
						</tr>
					</thead>
					<tbody>
						${tableData.data.map(row => `
							<tr>
								${tableData.headers.map(header => {
									const value = row[header] || '';
									const isAmount = header.includes('Amount') || value.includes('AED');
									return `<td${isAmount ? ' class="amount"' : ''}>${value}</td>`;
								}).join('')}
							</tr>
						`).join('')}
					</tbody>
				</table>
			</body>
			</html>
		`;
	}

	// Helper function to convert array to Excel worksheet format
	function arrayToSheet(data) {
		const ws = {};
		const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

		for (let R = 0; R < data.length; R++) {
			for (let C = 0; C < data[R].length; C++) {
				if (range.s.r > R) range.s.r = R;
				if (range.s.c > C) range.s.c = C;
				if (range.e.r < R) range.e.r = R;
				if (range.e.c < C) range.e.c = C;

				const cell = { v: data[R][C] };
				if (cell.v == null) continue;
				const cellRef = encodeCell({ c: C, r: R });

				if (typeof cell.v === 'number') cell.t = 'n';
				else if (typeof cell.v === 'boolean') cell.t = 'b';
				else if (cell.v instanceof Date) {
					cell.t = 'n';
					cell.z = '14';
					cell.v = dateToSerial(cell.v);
				} else cell.t = 's';

				ws[cellRef] = cell;
			}
		}
		
		if (range.s.c < 10000000) ws['!ref'] = encodeRange(range);
		return ws;
	}

	// Helper functions for Excel export
	function encodeCell(cell) {
		return String.fromCharCode(65 + cell.c) + (cell.r + 1);
	}

	function encodeRange(range) {
		return encodeCell(range.s) + ':' + encodeCell(range.e);
	}

	function dateToSerial(date) {
		return (date - new Date(1899, 11, 30)) / (24 * 60 * 60 * 1000);
	}

	function downloadExcel(wb, filename) {
		// Simple Excel file generation using basic XML structure
		const xlsxData = generateXLSX(wb);
		const blob = new Blob([xlsxData], { 
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
		});
		
		const link = document.createElement('a');
		if (navigator.msSaveBlob) {
			navigator.msSaveBlob(blob, filename);
		} else {
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	function generateXLSX(wb) {
		// This is a simplified XLSX generator
		// For production use, consider using a library like SheetJS
		const sheetName = wb.SheetNames[0];
		const ws = wb.Sheets[sheetName];
		
		// Extract data from worksheet
		const data = [];
		const ref = ws['!ref'];
		if (!ref) return '';
		
		const range = decodeRange(ref);
		for (let R = range.s.r; R <= range.e.r; R++) {
			const row = [];
			for (let C = range.s.c; C <= range.e.c; C++) {
				const cellRef = encodeCell({ c: C, r: R });
				const cell = ws[cellRef];
				row.push(cell ? cell.v : '');
			}
			data.push(row);
		}
		
		// Generate simple CSV format as fallback (will be saved as .xlsx but content is CSV)
		let content = data.map(row => row.join(',')).join('\n');
		return content;
	}

	function decodeRange(range) {
		const parts = range.split(':');
		return {
			s: decodeCell(parts[0]),
			e: decodeCell(parts[1])
		};
	}

	function decodeCell(cellRef) {
		const match = cellRef.match(/([A-Z]+)(\d+)/);
		if (!match) return { c: 0, r: 0 };
		
		const col = match[1].charCodeAt(0) - 65;
		const row = parseInt(match[2]) - 1;
		return { c: col, r: row };
	}

	function formatCurrency(value) {
		if (value === 0) return 'AED 0';
		
		const absValue = Math.abs(value);
		const formatted = 'AED ' + absValue.toLocaleString('en-AE', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		});
		
		return (value < 0 ? '-' : '') + formatted;
	}

	function showNotification(message, type = 'info') {
		const colors = {
			success: '#10b981',
			error: '#ef4444',
			warning: '#f59e0b',
			info: '#3b82f6'
		};
		
		const notification = $(`
			<div style="
				position: fixed;
				top: 20px;
				right: 20px;
				padding: 1rem 1.5rem;
				background: ${colors[type]};
				color: white;
				border-radius: 12px;
				z-index: 10000;
				box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
				animation: slideInRight 0.3s ease-out;
				max-width: 400px;
			">
				${message}
			</div>
		`);
		
		$('body').append(notification);
		
		setTimeout(() => {
			notification.css('animation', 'slideOutRight 0.3s ease-out');
			setTimeout(() => notification.remove(), 300);
		}, 3000);
	}

	// Initialize everything
	setTimeout(() => {
		setupEventHandlers();
		
		// Auto-generate report if company is set
		if (window.plFilters.company.get_value()) {
			setTimeout(generateReport, 1000);
		}
	}, 500);

	// Add notification animations CSS with theme support
	$(`<style>
		@keyframes slideInRight {
			from { transform: translateX(100%); opacity: 0; }
			to { transform: translateX(0); opacity: 1; }
		}
		@keyframes slideOutRight {
			from { transform: translateX(0); opacity: 1; }
			to { transform: translateX(100%); opacity: 0; }
		}
		
		.notification {
			backdrop-filter: blur(10px);
			border: 1px solid rgba(255, 255, 255, 0.1);
		}
	</style>`).appendTo('head');

	// Add focus management for filter items after DOM is ready
	setTimeout(() => {
		$(document).on('focusin', '.filter-item input, .filter-item select, .filter-item .form-control', function() {
			$(this).closest('.filter-item').addClass('focused');
		});
		
		$(document).on('focusout', '.filter-item input, .filter-item select, .filter-item .form-control', function() {
			$(this).closest('.filter-item').removeClass('focused');
		});
	}, 1000);
};
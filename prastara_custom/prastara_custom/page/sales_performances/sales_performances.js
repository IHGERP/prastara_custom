frappe.pages['sales-performances'].on_page_load = function(wrapper) {
		var page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Sales Performance Dashboard',
			single_column: true
		});
	
		// Load basic scripts first
		loadScripts().then(initializeDashboard);
	
		// Function to load external scripts
		function loadScripts() {
			return new Promise(function(resolve) {
				if (!window.Chart) {
					$.getScript('https://cdn.jsdelivr.net/npm/chart.js', function() {
						$.getScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels', function() {
							$.getScript('https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js', function() {
								resolve();
							});
						});
					});
				} else {
					resolve();
				}
			});
		}
	
		function initializeDashboard() {
			// First append an empty container to the page
			page.main.empty();
			page.main.append('<div class="sales-dashboard-container"></div>');
			
			var $container = page.main.find('.sales-dashboard-container');
			
			// Create HTML elements one by one to avoid syntax issues
			var $dashboardMain = $('<div class="sales-dashboard"></div>');
			$container.append($dashboardMain);
			
			// Add filters panel
			createFiltersPanel($dashboardMain);
			
			// Add loading container
			var $loadingContainer = $(
				'<div class="loading-container">' +
					'<div class="spinner-border text-primary" role="status"></div>' +
					'<div class="loading-text">Loading sales data...</div>' +
				'</div>'
			);
			$dashboardMain.append($loadingContainer);
			
			// Add dashboard content
			var $dashboardContent = $('<div class="dashboard-content" style="display:none;"></div>');
			$dashboardMain.append($dashboardContent);
			
			// Add KPI section
			createKPISection($dashboardContent);
			
			// Add charts section
			createChartsSection($dashboardContent);
			
			// Add team performance section
			createTeamPerformanceSection($dashboardContent);
			
			// Add CSS
			addStyles();
			addModernFiltersStyles();
			initializeQuickDateFilters();
			
			// Initialize variables
			var salesData = [];
			var filteredData = [];
			var charts = {};
			
			// Initialize date inputs with default values
			var today = new Date();
			var firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
			var fromDate = formatDate(firstDayOfMonth);
			var toDate = formatDate(today);
			
			console.log('Setting default dates:', fromDate, toDate);
			$('.from-date').val(fromDate);
			$('.to-date').val(toDate);
			
			// Initialize company field
	
			
			// Ensure company has a default value
			$('.company-field-readonly').val('PRASTARA DECORATION DESIGN L.L.C');
			
			// Add event handlers   
			setupEventHandlers();
			
			// Initial data load
			fetchSalesData();
			
			// Create filters panel
	
	function createFiltersPanel($parent) {
		var $filtersPanel = $(
			'<div class="filters-panel-modern">' +
				// Header Section
				'<div class="filters-header">' +
					'<div class="filters-title">' +
						'<h3><i class="fa fa-filter"></i> Dashboard Filters</h3>' +
						'<p>Customize your sales performance view</p>' +
					'</div>' +
					'<div class="filters-actions">' +
						'<button class="btn-modern btn-refresh refresh-btn">' +
							'<i class="fa fa-refresh"></i>' +
							'<span>Refresh</span>' +
						'</button>' +
					'</div>' +
				'</div>' +
				
				// Primary Filters Row
				'<div class="filters-primary">' +
					'<div class="filter-group filter-date">' +
						'<label class="filter-label">' +
							'<i class="fa fa-calendar"></i>' +
							'Date Range' +
							'<button class="quick-dates-toggle" type="button" title="Quick Date Filters">' +
								'<i class="fa fa-clock-o"></i>' +
							'</button>' +
						'</label>' +
						'<div class="date-range-container">' +
							'<input type="date" class="form-control-modern filter-input from-date" placeholder="From">' +
							'<span class="date-separator">to</span>' +
							'<input type="date" class="form-control-modern filter-input to-date" placeholder="To">' +
						'</div>' +
						'<div class="quick-dates-dropdown" style="display: none;">' +
							'<div class="quick-dates-grid">' +
								'<button class="quick-date-btn" data-range="today">' +
									'<i class="fa fa-sun-o"></i> Today' +
								'</button>' +
								'<button class="quick-date-btn" data-range="yesterday">' +
									'<i class="fa fa-history"></i> Yesterday' +
								'</button>' +
								'<button class="quick-date-btn" data-range="week">' +
									'<i class="fa fa-calendar-week-o"></i> This Week' +
								'</button>' +
								'<button class="quick-date-btn" data-range="last-week">' +
									'<i class="fa fa-step-backward"></i> Last Week' +
								'</button>' +
								'<button class="quick-date-btn" data-range="month">' +
									'<i class="fa fa-calendar"></i> This Month' +
								'</button>' +
								'<button class="quick-date-btn" data-range="last-month">' +
									'<i class="fa fa-chevron-left"></i> Last Month' +
								'</button>' +
								'<button class="quick-date-btn" data-range="quarter">' +
									'<i class="fa fa-pie-chart"></i> This Quarter' +
								'</button>' +
								'<button class="quick-date-btn" data-range="year">' +
									'<i class="fa fa-calendar-o"></i> This Year' +
								'</button>' +
								'<button class="quick-date-btn" data-range="last-year">' +
									'<i class="fa fa-arrow-left"></i> Last Year' +
								'</button>' +
								'<button class="quick-date-btn" data-range="ytd">' +
									'<i class="fa fa-chart-line"></i> Year to Date' +
								'</button>' +
								'<button class="quick-date-btn" data-range="last-30">' +
									'<i class="fa fa-calendar-minus-o"></i> Last 30 Days' +
								'</button>' +
								'<button class="quick-date-btn" data-range="last-90">' +
									'<i class="fa fa-calendar-times-o"></i> Last 90 Days' +
								'</button>' +
							'</div>' +
						'</div>' +
					'</div>' +
					
					'<div class="filter-group">' +
						'<label class="filter-label">' +
							'<i class="fa fa-users"></i>' +
							'Team' +
						'</label>' +
						'<select class="form-control-modern filter-input team-filter">' +
							'<option value="">All Teams</option>' +
						'</select>' +
					'</div>' +
					
					'<div class="filter-group">' +
						'<label class="filter-label">' +
							'<i class="fa fa-chart-line"></i>' +
							'Performance Level' +
						'</label>' +
						'<select class="form-control-modern filter-input performance-filter">' +
							'<option value="all">All Performance</option>' +
							'<option value="exceeded">🏆 Exceeded (>100%)</option>' +
							'<option value="on-track">✅ On Track (70-100%)</option>' +
							'<option value="at-risk">⚠️ At Risk (40-70%)</option>' +
							'<option value="poor">❌ Needs Attention (<40%)</option>' +
						'</select>' +
					'</div>' +
					
					'<div class="filter-group">' +
						'<label class="filter-label">' +
							'<i class="fa fa-bullseye"></i>' +
							'Target Type' +
						'</label>' +
						'<select class="form-control-modern filter-input target-category-filter">' +
							'<option value="standard">Standard Targets</option>' +
							'<option value="hod">HOD Targets</option>' +
							'<option value="company">Company Targets</option>' +
						'</select>' +
					'</div>' +
				'</div>' +
				
				// Secondary Controls Row
				'<div class="filters-secondary">' +
					'<div class="search-container">' +
						'<div class="search-input-wrapper">' +
							'<i class="fa fa-search search-icon"></i>' +
							'<input type="text" class="search-input-modern search-input" placeholder="Search by name, team, or company...">' +
							'<button class="clear-search-btn" type="button">' +
								'<i class="fa fa-times"></i>' +
							'</button>' +
						'</div>' +
					'</div>' +
					
					'<div class="controls-group">' +
						'<div class="sort-container">' +
							'<label class="control-label">Sort by:</label>' +
							'<select class="form-control-compact filter-input sort-by">' +
								'<option value="achievement-desc">🏆 Achievement (High to Low)</option>' +
								'<option value="achievement-asc">📈 Achievement (Low to High)</option>' +
								'<option value="team">👥 Team</option>' +
								'<option value="sales-desc">💰 Sales (High to Low)</option>' +
								'<option value="target-desc">🎯 Target (High to Low)</option>' +
							'</select>' +
						'</div>' +
						
						'<div class="view-toggle-container">' +
							'<label class="control-label">View:</label>' +
							'<div class="btn-group-modern view-toggle">' +
								'<button class="btn-toggle grid-view active" title="Grid View">' +
									'<i class="fa fa-th-large"></i>' +
								'</button>' +
								'<button class="btn-toggle table-view" title="Table View">' +
									'<i class="fa fa-table"></i>' +
								'</button>' +
							'</div>' +
						'</div>' +
						
						'<div class="results-info">' +
							'<span class="results-badge">' +
								'<span class="records-count">0</span> Results' +
							'</span>' +
						'</div>' +
					'</div>' +
				'</div>' +
				
				// Quick Filters (Optional - can be toggled)
				'<div class="quick-filters" style="display: none;">' +
					'<div class="quick-filters-header">' +
						'<span>Quick Filters:</span>' +
					'</div>' +
					'<div class="quick-filter-buttons">' +
						'<button class="quick-filter-btn" data-filter="top-performers">' +
							'<i class="fa fa-star"></i> Top Performers' +
						'</button>' +
						'<button class="quick-filter-btn" data-filter="underperformers">' +
							'<i class="fa fa-exclamation-triangle"></i> Needs Support' +
						'</button>' +
						'<button class="quick-filter-btn" data-filter="new-hires">' +
							'<i class="fa fa-user-plus"></i> New Team Members' +
						'</button>' +
						'<button class="quick-filter-btn" data-filter="clear-all">' +
							'<i class="fa fa-refresh"></i> Clear All' +
						'</button>' +
					'</div>' +
				'</div>' +
			'</div>'
		);
		
		$parent.append($filtersPanel);
	}
		  
	function addModernFiltersStyles() {
		var modernStyles = `
			/* Modern Filters Panel */
			.filters-panel-modern {
				background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
				border-radius: 16px;
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
				margin-bottom: 24px;
				overflow: hidden;
				border: 1px solid rgba(226, 232, 240, 0.8);
			}
			
			/* Header Section */
			.filters-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 20px 24px;
				background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%);
				color: white;
			}
			
			.filters-title h3 {
				margin: 0;
				font-size: 18px;
				font-weight: 700;
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.filters-title p {
				margin: 4px 0 0 0;
				font-size: 13px;
				opacity: 0.9;
			}
			
			.filters-actions .btn-modern {
				background: rgba(255, 255, 255, 0.2);
				color: white;
				border: 1px solid rgba(255, 255, 255, 0.3);
				padding: 8px 16px;
				border-radius: 8px;
				font-weight: 500;
				transition: all 0.3s ease;
				display: flex;
				align-items: center;
				gap: 6px;
			}
			
			.filters-actions .btn-modern:hover {
				background: rgba(255, 255, 255, 0.3);
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
			}
			
			/* Primary Filters */
			.filters-primary {
				display: grid;
				grid-template-columns: 2fr 1fr 1.5fr 1fr;
				gap: 20px;
				padding: 24px;
				background: white;
			}
			
			.filter-group {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			
			.filter-group.filter-date {
				min-width: 0; /* Prevents overflow in grid */
			}
			
			.filter-label {
				font-weight: 600;
				font-size: 13px;
				color: #374151;
				display: flex;
				align-items: center;
				gap: 6px;
				margin-bottom: 0;
			}
			
			.filter-label i {
				color: #6366f1;
				font-size: 12px;
			}
			
			/* Date Range Container */
			.date-range-container {
				display: flex;
				align-items: center;
				gap: 12px;
			}
			
			.date-separator {
				color: #6b7280;
				font-weight: 500;
				font-size: 13px;
				flex-shrink: 0;
			}
			
			/* Quick Date Filters */
			.quick-dates-toggle {
				background: none;
				border: none;
				color: #6366f1;
				cursor: pointer;
				padding: 2px 4px;
				border-radius: 4px;
				margin-left: 8px;
				transition: all 0.2s ease;
				font-size: 12px;
			}
			
			.quick-dates-toggle:hover {
				background: rgba(99, 102, 241, 0.1);
				color: #4f46e5;
			}
			
			.quick-dates-dropdown {
				position: absolute;
				top: calc(100% + 8px);
				left: 0;
				background: white;
				border: 2px solid #e5e7eb;
				border-radius: 12px;
				box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
				z-index: 9999;
				padding: 16px;
				animation: slideDown 0.3s ease;
				min-width: 320px;
				max-width: 400px;
				width: max-content;
			}
			
			@keyframes slideDown {
				from {
					opacity: 0;
					transform: translateY(-10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}
			
			.filter-group.filter-date {
				position: relative;
				z-index: 10000;
				overflow: visible;
			}
			
			/* Ensure parent containers don't interfere */
			.filters-panel-modern {
				position: relative;
				z-index: 100;
				overflow: visible;
			}
			
			.filters-primary {
				position: relative;
				z-index: 101;
				overflow: visible;
			}
			
			/* Prevent grid collapse */
			.filters-primary {
				display: grid;
				grid-template-columns: 2fr 1fr 1fr 1.5fr 1fr;
				gap: 20px;
				padding: 24px;
				background: white;
				align-items: start;
			}
			
			/* Add overlay backdrop for mobile */
			.quick-dates-overlay {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.3);
				z-index: 9998;
				display: none;
			}
			
			.quick-dates-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 8px;
			}
			
			.quick-date-btn {
				background: #f8fafc;
				border: 1px solid #e2e8f0;
				color: #475569;
				padding: 10px 12px;
				border-radius: 8px;
				font-size: 12px;
				font-weight: 500;
				cursor: pointer;
				transition: all 0.2s ease;
				display: flex;
				align-items: center;
				gap: 6px;
				white-space: nowrap;
				text-align: left;
				justify-content: flex-start;
			}
			
			.quick-date-btn:hover {
				background: #e2e8f0;
				border-color: #cbd5e1;
				color: #374151;
				transform: translateY(-1px);
			}
			
			.quick-date-btn.active {
				background: #6366f1;
				color: white;
				border-color: #6366f1;
			}
			
			.quick-date-btn i {
				font-size: 11px;
				opacity: 0.8;
				flex-shrink: 0;
			}
			
			/* Modern Form Controls */
			.form-control-modern {
				border: 2px solid #e5e7eb;
				border-radius: 10px;
				padding: 10px 14px;
				font-size: 14px;
				transition: all 0.3s ease;
				background: #f9fafb;
				color: #374151;
				flex: 1;
				min-width: 0;
			}
			
			.form-control-modern:focus {
				outline: none;
				border-color: #6366f1;
				background: white;
				box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
				transform: translateY(-1px);
			}
			
			.form-control-modern:hover {
				border-color: #d1d5db;
				background: white;
			}
			
			/* Secondary Controls */
			.filters-secondary {
				display: flex;
				align-items: center;
				gap: 20px;
				padding: 20px 24px;
				background: #f8fafc;
				border-top: 1px solid #e5e7eb;
			}
			
			.search-container {
				flex: 1;
				max-width: 400px;
			}
			
			.search-input-wrapper {
				position: relative;
				display: flex;
				align-items: center;
			}
			
			.search-icon {
				position: absolute;
				left: 14px;
				color: #9ca3af;
				font-size: 14px;
				z-index: 2;
			}
			
			.search-input-modern {
				width: 100%;
				padding: 12px 40px 12px 40px;
				border: 2px solid #e5e7eb;
				border-radius: 12px;
				background: white;
				font-size: 14px;
				transition: all 0.3s ease;
			}
			
			.search-input-modern:focus {
				outline: none;
				border-color: #6366f1;
				box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
			}
			
			.search-input-modern::placeholder {
				color: #9ca3af;
			}
			
			.clear-search-btn {
				position: absolute;
				right: 10px;
				background: none;
				border: none;
				color: #9ca3af;
				cursor: pointer;
				padding: 4px;
				border-radius: 4px;
				transition: all 0.2s ease;
			}
			
			.clear-search-btn:hover {
				color: #6b7280;
				background: #f3f4f6;
			}
			
			/* Controls Group */
			.controls-group {
				display: flex;
				align-items: center;
				gap: 24px;
			}
			
			.sort-container,
			.view-toggle-container {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.control-label {
				font-size: 13px;
				font-weight: 600;
				color: #6b7280;
				margin: 0;
				white-space: nowrap;
			}
			
			.form-control-compact {
				border: 2px solid #e5e7eb;
				border-radius: 8px;
				padding: 6px 12px;
				font-size: 13px;
				background: white;
				min-width: 180px;
				transition: all 0.3s ease;
			}
			
			.form-control-compact:focus {
				outline: none;
				border-color: #6366f1;
				box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
			}
			
			/* View Toggle */
			.btn-group-modern {
				display: flex;
				border-radius: 8px;
				overflow: hidden;
				border: 2px solid #e5e7eb;
				background: white;
			}
			
			.btn-toggle {
				background: white;
				border: none;
				padding: 8px 12px;
				color: #6b7280;
				cursor: pointer;
				transition: all 0.3s ease;
				border-right: 1px solid #e5e7eb;
			}
			
			.btn-toggle:last-child {
				border-right: none;
			}
			
			.btn-toggle.active {
				background: #6366f1;
				color: white;
			}
			
			.btn-toggle:hover:not(.active) {
				background: #f3f4f6;
				color: #374151;
			}
			
			/* Results Info */
			.results-info {
				margin-left: auto;
			}
			
			.results-badge {
				background: #6366f1;
				color: white;
				padding: 6px 12px;
				border-radius: 20px;
				font-size: 13px;
				font-weight: 600;
			}
			
			/* Quick Filters */
			.quick-filters {
				padding: 16px 24px;
				background: #f1f5f9;
				border-top: 1px solid #e2e8f0;
			}
			
			.quick-filters-header {
				margin-bottom: 12px;
			}
			
			.quick-filters-header span {
				font-size: 13px;
				font-weight: 600;
				color: #475569;
			}
			
			.quick-filter-buttons {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
			}
			
			.quick-filter-btn {
				background: white;
				border: 1px solid #cbd5e1;
				color: #475569;
				padding: 6px 12px;
				border-radius: 6px;
				font-size: 12px;
				cursor: pointer;
				transition: all 0.2s ease;
				display: flex;
				align-items: center;
				gap: 4px;
			}
			
			.quick-filter-btn:hover {
				background: #e2e8f0;
				border-color: #94a3b8;
			}
			
			.quick-filter-btn.active {
				background: #3b82f6;
				color: white;
				border-color: #3b82f6;
			}
			
			/* Responsive Design */
			@media (max-width: 1024px) {
				.filters-primary {
					grid-template-columns: 1fr 1fr;
					gap: 16px;
				}
				
				.controls-group {
					flex-wrap: wrap;
					gap: 16px;
				}
				
				.quick-dates-grid {
					grid-template-columns: repeat(2, 1fr);
				}
				
				.quick-dates-dropdown {
					min-width: 280px;
					max-width: 320px;
				}
			}
			
			@media (max-width: 768px) {
				.filters-header {
					flex-direction: column;
					gap: 12px;
					text-align: center;
				}
				
				.filters-primary {
					grid-template-columns: 1fr;
					gap: 16px;
				}
				
				.filters-secondary {
					flex-direction: column;
					gap: 16px;
					align-items: stretch;
				}
				
				.search-container {
					max-width: none;
				}
				
				.controls-group {
					justify-content: space-between;
				}
				
				.date-range-container {
					flex-direction: column;
					gap: 8px;
				}
				
				.date-separator {
					display: none;
				}
				
				.quick-dates-grid {
					grid-template-columns: 1fr;
					gap: 10px;
				}
				
				.quick-dates-dropdown {
					position: fixed !important;
					top: 50% !important;
					left: 50% !important;
					transform: translate(-50%, -50%) !important;
					width: 90vw !important;
					max-width: 350px !important;
					max-height: 70vh !important;
					overflow-y: auto !important;
					z-index: 10001 !important;
					margin-top: 0 !important;
				}
				
				.quick-dates-overlay.show {
					display: block !important;
				}
				
				.filter-group.filter-date {
					overflow: visible;
				}
			}
			
			@media (max-width: 480px) {
				.filters-panel-modern {
					margin: 0 -10px 20px;
					border-radius: 12px;
				}
				
				.filters-header,
				.filters-primary,
				.filters-secondary {
					padding: 16px;
				}
				
				.controls-group {
					flex-direction: column;
					align-items: stretch;
					gap: 12px;
				}
				
				.sort-container,
				.view-toggle-container {
					justify-content: space-between;
				}
				
				.quick-date-btn {
					padding: 12px;
					justify-content: center;
				}
			}
		`;
		
		// Add the modern styles to head
		$('<style>').html(modernStyles).appendTo('head');
	}
	
	
	function initializeQuickDateFilters() {
		// Add overlay element for better mobile experience
		if (!$('.quick-dates-overlay').length) {
			$('body').append('<div class="quick-dates-overlay"></div>');
		}
		
		// Quick dates toggle
		$('.quick-dates-toggle').on('click', function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			const $dropdown = $('.quick-dates-dropdown');
			const $overlay = $('.quick-dates-overlay');
			
			if ($dropdown.is(':visible')) {
				$dropdown.slideUp(200);
				$overlay.fadeOut(200);
			} else {
				// Close any other open dropdowns first
				$('.quick-dates-dropdown').slideUp(200);
				
				// Show this dropdown
				$dropdown.slideDown(200);
				
				// Show overlay on mobile
				if (window.innerWidth <= 768) {
					$overlay.fadeIn(200);
				}
			}
		});
		
		// Close dropdown when clicking overlay or outside
		$(document).on('click', function(e) {
			if (!$(e.target).closest('.filter-date').length) {
				$('.quick-dates-dropdown').slideUp(200);
				$('.quick-dates-overlay').fadeOut(200);
			}
		});
		
		// Close on overlay click
		$('.quick-dates-overlay').on('click', function() {
			$('.quick-dates-dropdown').slideUp(200);
			$(this).fadeOut(200);
		});
		
		// Prevent dropdown from closing when clicking inside it
		$('.quick-dates-dropdown').on('click', function(e) {
			e.stopPropagation();
		});
		
		// Quick date selection
		$('.quick-date-btn').on('click', function() {
			var range = $(this).data('range');
			var today = new Date();
			var fromDate, toDate;
			
			// Remove active class from all buttons
			$('.quick-date-btn').removeClass('active');
			// Add active class to clicked button
			$(this).addClass('active');
			
			switch(range) {
				case 'today':
					fromDate = toDate = formatDate(today);
					break;
					
				case 'yesterday':
					var yesterday = new Date(today);
					yesterday.setDate(yesterday.getDate() - 1);
					fromDate = toDate = formatDate(yesterday);
					break;
					
				case 'week':
					var startOfWeek = new Date(today);
					startOfWeek.setDate(today.getDate() - today.getDay());
					fromDate = formatDate(startOfWeek);
					toDate = formatDate(today);
					break;
					
				case 'last-week':
					var lastWeekEnd = new Date(today);
					lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
					var lastWeekStart = new Date(lastWeekEnd);
					lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
					fromDate = formatDate(lastWeekStart);
					toDate = formatDate(lastWeekEnd);
					break;
					
				case 'month':
					var startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
					fromDate = formatDate(startOfMonth);
					toDate = formatDate(today);
					break;
					
				case 'last-month':
					var lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
					var lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
					fromDate = formatDate(lastMonth);
					toDate = formatDate(lastMonthEnd);
					break;
					
				case 'quarter':
					var quarter = Math.floor(today.getMonth() / 3);
					var startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
					fromDate = formatDate(startOfQuarter);
					toDate = formatDate(today);
					break;
					
				case 'year':
					var startOfYear = new Date(today.getFullYear(), 0, 1);
					fromDate = formatDate(startOfYear);
					toDate = formatDate(today);
					break;
					
				case 'last-year':
					var lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
					var lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
					fromDate = formatDate(lastYearStart);
					toDate = formatDate(lastYearEnd);
					break;
					
				case 'ytd':
					var startOfYear = new Date(today.getFullYear(), 0, 1);
					fromDate = formatDate(startOfYear);
					toDate = formatDate(today);
					break;
					
				case 'last-30':
					var thirtyDaysAgo = new Date(today);
					thirtyDaysAgo.setDate(today.getDate() - 30);
					fromDate = formatDate(thirtyDaysAgo);
					toDate = formatDate(today);
					break;
					
				case 'last-90':
					var ninetyDaysAgo = new Date(today);
					ninetyDaysAgo.setDate(today.getDate() - 90);
					fromDate = formatDate(ninetyDaysAgo);
					toDate = formatDate(today);
					break;
			}
			
			// Set the date inputs
			$('.from-date').val(fromDate);
			$('.to-date').val(toDate);
			
			// Close dropdown
			$('.quick-dates-dropdown').slideUp(200);
			$('.quick-dates-overlay').fadeOut(200);
			
			// Trigger data fetch if fetchSalesData function exists
			if (typeof fetchSalesData === 'function') {
				fetchSalesData();
			}
		});
	}
	
	function formatDate(date) {
		return date.toISOString().split('T')[0];
	}
			
			function initializeFilterFunctionality($panel) {
				// Advanced filters toggle
				$panel.find('.advanced-toggle-btn').on('click', function() {
					var $advancedRow = $panel.find('.advanced-filters-row');
					var $icon = $(this).find('i');
					
					$advancedRow.slideToggle();
					$icon.toggleClass('fa-chevron-down fa-chevron-up');
					$(this).html($icon[0].outerHTML + ($icon.hasClass('fa-chevron-up') ? ' Hide Advanced' : ' Advanced Filters'));
				});
				
				// Quick date options
				$panel.find('.quick-date-btn').on('click', function() {
					$panel.find('.quick-dates-dropdown').slideToggle();
				});
				
				// Quick date selection
				$panel.find('.quick-date-option').on('click', function() {
					var range = $(this).data('range');
					var today = new Date();
					var fromDate, toDate;
					
					switch(range) {
						case 'today':
							fromDate = toDate = formatDate(today);
							break;
						case 'yesterday':
							var yesterday = new Date(today);
							yesterday.setDate(yesterday.getDate() - 1);
							fromDate = toDate = formatDate(yesterday);
							break;
						case 'week':
							var startOfWeek = new Date(today);
							startOfWeek.setDate(today.getDate() - today.getDay());
							fromDate = formatDate(startOfWeek);
							toDate = formatDate(today);
							break;
						case 'month':
							var startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
							fromDate = formatDate(startOfMonth);
							toDate = formatDate(today);
							break;
						case 'quarter':
							var quarter = Math.floor(today.getMonth() / 3);
							var startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
							fromDate = formatDate(startOfQuarter);
							toDate = formatDate(today);
							break;
						case 'year':
							var startOfYear = new Date(today.getFullYear(), 0, 1);
							fromDate = formatDate(startOfYear);
							toDate = formatDate(today);
							break;
					}
					
					$panel.find('.from-date').val(fromDate);
					$panel.find('.to-date').val(toDate);
					$panel.find('.quick-dates-dropdown').slideUp();
					updateFilterTags();
				});
				
				// Range sliders
				$panel.find('.achievement-min, .achievement-max').on('input', function() {
					var min = parseInt($panel.find('.achievement-min').val());
					var max = parseInt($panel.find('.achievement-max').val());
					
					if (min > max) {
						if ($(this).hasClass('achievement-min')) {
							max = min;
							$panel.find('.achievement-max').val(max);
						} else {
							min = max;
							$panel.find('.achievement-min').val(min);
						}
					}
					
					$panel.find('.min-value').text(min + '%');
					$panel.find('.max-value').text(max + '%');
					updateFilterTags();
				});
				
				// Clear search
				$panel.find('.clear-search-btn').on('click', function() {
					$panel.find('.search-input').val('').trigger('input');
				});
				
				// Clear all filters
				$panel.find('.clear-filters-btn').on('click', function() {
					$panel.find('input, select').each(function() {
						if ($(this).is('select')) {
							$(this).prop('selectedIndex', 0);
						} else if ($(this).is('input[type="range"]')) {
							if ($(this).hasClass('achievement-min')) $(this).val(0);
							if ($(this).hasClass('achievement-max')) $(this).val(200);
						} else {
							$(this).val('');
						}
					});
					updateFilterTags();
				});
				
				// Select all companies
				$panel.find('.select-all-companies').on('click', function() {
					// This would integrate with your company selection logic
					console.log('Select all companies clicked');
				});
				
				// Update filter tags when any filter changes
				$panel.find('.filter-input').on('change input', updateFilterTags);
				
				// Save current filter
				$panel.find('.save-current-filter').on('click', function() {
					var filterName = prompt('Enter filter name:');
					if (filterName) {
						saveCurrentFilter(filterName);
					}
				});
				
				// Load saved filter
				$panel.find('.saved-filter-item').on('click', function(e) {
					if (!$(e.target).hasClass('remove-saved-filter')) {
						var filterId = $(this).data('filter');
						loadSavedFilter(filterId);
					}
				});
				
				// Remove saved filter
				$panel.find('.remove-saved-filter').on('click', function(e) {
					e.stopPropagation();
					if (confirm('Remove this saved filter?')) {
						$(this).closest('.saved-filter-item').remove();
					}
				});
			}
			
			function formatDate(date) {
				return date.toISOString().split('T')[0];
			}
			
			
			function saveCurrentFilter(name) {
				// Collect current filter state
				var filterState = {};
				$('.filter-input').each(function() {
					var $input = $(this);
					if ($input.val()) {
						filterState[$input.attr('class')] = $input.val();
					}
				});
				
				// Save to localStorage or send to server
				var savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');
				savedFilters[name] = filterState;
				localStorage.setItem('savedFilters', JSON.stringify(savedFilters));
				
				// Add to UI
				var $newFilter = $('<button class="btn btn-sm btn-outline-secondary saved-filter-item" data-filter="' + name + '">' + 
								  name + ' <i class="fa fa-times remove-saved-filter"></i></button>');
				$('.saved-filters-list').append($newFilter);
			}
			
			function loadSavedFilter(filterId) {
				var savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');
				var filterState = savedFilters[filterId];
				
				if (filterState) {
					Object.keys(filterState).forEach(function(className) {
						$('.' + className).val(filterState[className]);
					});
					updateFilterTags();
				}
			}
			// Create KPI section
			function createKPISection($parent) {
				var $kpiSection = $(
					'<div class="kpi-section">' +
						'<div class="row">' +
							'<div class="col-md-3">' +
								'<div class="kpi-card total-sales">' +
									'<div class="kpi-icon">' +
										'<i class="fa fa-money"></i>' +
									'</div>' +
									'<div class="kpi-content">' +
										'<div class="kpi-value">0</div>' +
										'<div class="kpi-label">Total Sales</div>' +
										'<div class="kpi-progress">' +
											'<div class="progress">' +
												'<div class="progress-bar bg-primary" style="width: 0%"></div>' +
											'</div>' +
											'<div class="kpi-sub-value"><span>0%</span> of target</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</div>' +
							'<div class="col-md-3">' +
								'<div class="kpi-card total-target">' +
									'<div class="kpi-icon">' +
										'<i class="fa fa-bullseye"></i>' +
									'</div>' +
									'<div class="kpi-content">' +
										'<div class="kpi-value">0</div>' +
										'<div class="kpi-label">Total Target</div>' +
										'<div class="kpi-progress">' +
											'<div class="kpi-sub-label">Period</div>' +
											'<div class="kpi-sub-value period-range">-</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</div>' +
							'<div class="col-md-3">' +
								'<div class="kpi-card avg-achievement">' +
									'<div class="kpi-icon">' +
										'<i class="fa fa-trophy"></i>' +
									'</div>' +
									'<div class="kpi-content">' +
										'<div class="kpi-value">0%</div>' +
										'<div class="kpi-label">Avg. Achievement</div>' +
										'<div class="kpi-progress">' +
											'<div class="progress achievement-meter">' +
												'<div class="progress-bar bg-success" style="width: 0%"></div>' +
											'</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</div>' +
							'<div class="col-md-3">' +
								'<div class="kpi-card top-performer">' +
									'<div class="kpi-icon">' +
										'<i class="fa fa-star"></i>' +
									'</div>' +
									'<div class="kpi-content">' +
										'<div class="kpi-value">-</div>' +
										'<div class="kpi-label">Top Performer</div>' +
										'<div class="kpi-progress">' +
											'<div class="progress">' +
												'<div class="progress-bar bg-warning" style="width: 0%"></div>' +
											'</div>' +
											'<div class="kpi-sub-value top-achievement">0%</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>'
				);
				
				$parent.append($kpiSection);
			}
			
			// Create charts section
			function createChartsSection($parent) {
				var $chartsSection = $(
					'<div class="charts-section">' +
						'<div class="row">' +
							'<div class="col-md-8">' +
								'<div class="chart-card">' +
									'<div class="chart-header">' +
										'<h3 class="chart-title">Sales vs Target</h3>' +
										'<div class="chart-actions">' +
											'<select class="chart-view-toggle">' +
												'<option value="individual">By Individual</option>' +
												'<option value="team">By Team</option>' +
											'</select>' +
										'</div>' +
									'</div>' +
									'<div class="chart-body">' +
										'<canvas id="sales-target-chart" height="300"></canvas>' +
									'</div>' +
								'</div>' +
							'</div>' +
							'<div class="col-md-4">' +
								'<div class="chart-card">' +
									'<div class="chart-header">' +
										'<h3 class="chart-title">Achievement Distribution</h3>' +
									'</div>' +
									'<div class="chart-body">' +
										'<canvas id="achievement-distribution-chart" height="300"></canvas>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>' +
						'<div class="row">' +
							'<div class="col-md-6">' +
								'<div class="chart-card">' +
									'<div class="chart-header">' +
										'<h3 class="chart-title">Team Performance Comparison</h3>' +
									'</div>' +
									'<div class="chart-body">' +
										'<canvas id="team-performance-chart" height="270"></canvas>' +
									'</div>' +
								'</div>' +
							'</div>' +
							'<div class="col-md-6">' +
								'<div class="chart-card">' +
									'<div class="chart-header">' +
										'<h3 class="chart-title">Top 5 Performers</h3>' +
									'</div>' +
									'<div class="chart-body">' +
										'<canvas id="top-performers-chart" height="270"></canvas>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>'
				);
				
				$parent.append($chartsSection);
			}
			
			// Create team performance section
			function createTeamPerformanceSection($parent) {
				var $teamSection = $(
					'<div class="team-performance-section">' +
						'<div class="section-header">' +
							'<h3 class="section-title">Sales Team Performance Details</h3>' +
						'</div>' +
						'<div class="team-grid-view">' +
							'<div class="row team-grid"></div>' +
						'</div>' +
						'<div class="team-table-view" style="display: none;">' +
							'<table class="table table-hover">' +
								'<thead>' +
									'<tr>' +
										'<th>Sales Person</th>' +
										'<th>Team</th>' +
										'<th>Target</th>' +
										'<th>Sales</th>' +
										'<th>Achievement</th>' +
										'<th>Status</th>' +
									'</tr>' +
								'</thead>' +
								'<tbody class="team-table-body"></tbody>' +
							'</table>' +
						'</div>' +
					'</div>'
				);
				
				$parent.append($teamSection);
			}
			// Add styles
			function addStyles() {
				var styles = `
					.sales-dashboard {
						font-family: 'Inter', 'Roboto', sans-serif;
						background: #f9fafc;
						padding: 20px;
						border-radius: 10px;
					}
					
					/* Filters Panel */
					.filters-panel {
						background: #fff;
						padding: 20px;
						border-radius: 10px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.05);
						margin-bottom: 20px;
					}
	
					
					.filter-label {
						font-weight: 600;
						font-size: 12px;
						color: #555;
						margin-bottom: 6px;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					
					.filter-input {
						border-radius: 6px;
						border: 1px solid #e0e7ff;
						padding: 8px 12px;
						transition: all 0.3s;
					}
					
					.filter-input:focus {
						border-color: #4f46e5;
						box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
					}
					
					.data-info {
						font-size: 13px;
						color: #6b7280;
						padding-top: 10px;
					}
					
					.refresh-btn {
						padding: 8px 16px;
						background: #4f46e5;
						border-color: #4f46e5;
						font-weight: 500;
						transition: all 0.3s;
					}
					
					.refresh-btn:hover {
						background: #4338ca;
						border-color: #4338ca;
						transform: translateY(-2px);
						box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
					}
					
					.view-toggle .btn {
						padding: 8px 12px;
						border-radius: 6px;
					}
					
					.view-toggle .active {
						background: #f0f5ff;
						color: #4f46e5;
						border-color: #cad5f5;
					}
					
					/* Loading */
					.loading-container {
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						padding: 40px;
						background: #fff;
						border-radius: 10px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.05);
						margin-bottom: 20px;
					}
					
					.loading-text {
						margin-top: 15px;
						color: #6b7280;
						font-weight: 500;
					}
					
					/* KPI Cards */
					.kpi-section {
						margin-bottom: 20px;
					}
					
					.kpi-card {
						background: #fff;
						border-radius: 10px;
						padding: 20px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.05);
						height: 100%;
						display: flex;
						align-items: center;
						transition: all 0.3s;
					}
					
					.kpi-card:hover {
						transform: translateY(-5px);
						box-shadow: 0 10px 20px rgba(0,0,0,0.1);
					}
					
					.kpi-icon {
						width: 50px;
						height: 50px;
						border-radius: 10px;
						display: flex;
						align-items: center;
						justify-content: center;
						margin-right: 15px;
						flex-shrink: 0;
						font-size: 18px;
					}
					
					.total-sales .kpi-icon {
						background: rgba(79, 70, 229, 0.1);
						color: #4f46e5;
					}
					
					.total-target .kpi-icon {
						background: rgba(245, 158, 11, 0.1);
						color: #f59e0b;
					}
					
					.avg-achievement .kpi-icon {
						background: rgba(16, 185, 129, 0.1);
						color: #10b981;
					}
					
					.top-performer .kpi-icon {
						background: rgba(236, 72, 153, 0.1);
						color: #ec4899;
					}
					
					.kpi-content {
						flex-grow: 1;
					}
					
					.kpi-value {
						font-size: 24px;
						font-weight: 700;
						color: #111827;
						margin-bottom: 4px;
					}
					
					.kpi-label {
						font-size: 14px;
						color: #6b7280;
						margin-bottom: 12px;
					}
					
					.kpi-progress {
						margin-top: 5px;
					}
					
					.kpi-sub-label {
						font-size: 12px;
						color: #6b7280;
						margin-bottom: 4px;
					}
					
					.kpi-sub-value {
						font-size: 13px;
						font-weight: 600;
						color: #4b5563;
					}
					
					.progress {
						height: 6px;
						background: #e5e7eb;
						border-radius: 3px;
						margin-bottom: 5px;
					}
					
					/* Chart Cards */
					.chart-card {
						background: #fff;
						border-radius: 10px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.05);
						margin-bottom: 20px;
						height: 100%;
					}
					
					.chart-header {
						padding: 15px 20px;
						border-bottom: 1px solid #f3f4f6;
						display: flex;
						align-items: center;
						justify-content: space-between;
					}
					
					.chart-title {
						font-size: 16px;
						font-weight: 600;
						color: #374151;
						margin: 0;
					}
					
					.chart-body {
						padding: 20px;
					}
					
					.chart-view-toggle {
						font-size: 13px;
						padding: 5px 10px;
						border-radius: 6px;
						border: 1px solid #e5e7eb;
						background: #f9fafb;
						color: #4b5563;
					}
					
					/* Team Performance Section */
					.team-performance-section {
						background: #fff;
						border-radius: 10px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.05);
						padding: 20px;
						margin-top: 20px;
					}
					
					.section-header {
						margin-bottom: 20px;
						border-bottom: 1px solid #f3f4f6;
						padding-bottom: 15px;
					}
					
					.section-title {
						font-size: 18px;
						font-weight: 600;
						color: #111827;
						margin: 0;
					}
					
					/* Team Grid */
					.team-member-card {
						background: #fff;
						border-radius: 10px;
						box-shadow: 0 2px 8px rgba(0,0,0,0.05);
						margin-bottom: 20px;
						transition: all 0.3s;
						border: 1px solid #f3f4f6;
						overflow: hidden;
					}
					
					.team-member-card:hover {
						transform: translateY(-5px);
						box-shadow: 0 12px 20px rgba(0,0,0,0.1);
					}
					
					.member-header {
						padding: 20px;
						position: relative;
						background: linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);
					}
					
					.achievement-badge {
						position: absolute;
						top: 15px;
						right: 15px;
						padding: 5px 10px;
						border-radius: 20px;
						font-size: 12px;
						font-weight: 600;
						z-index: 2;
					}
					
					.badge-excellent {
						background: rgba(16, 185, 129, 0.1);
						color: #10b981;
						border: 1px solid rgba(16, 185, 129, 0.2);
					}
					
					.badge-good {
						background: rgba(59, 130, 246, 0.1);
						color: #3b82f6;
						border: 1px solid rgba(59, 130, 246, 0.2);
					}
					
					.badge-average {
						background: rgba(245, 158, 11, 0.1);
						color: #f59e0b;
						border: 1px solid rgba(245, 158, 11, 0.2);
					}
					
					.badge-poor {
						background: rgba(239, 68, 68, 0.1);
						color: #ef4444;
						border: 1px solid rgba(239, 68, 68, 0.2);
					}
					
					.member-profile {
						display: flex;
						align-items: center;
					}
					
					.member-avatar {
						width: 60px;
						height: 60px;
						border-radius: 30px;
						object-fit: cover;
						border: 3px solid #fff;
						box-shadow: 0 4px 10px rgba(0,0,0,0.1);
						margin-right: 15px;
					}
					
					.member-info {
						flex-grow: 1;
					}
					
					.member-name {
						font-size: 16px;
						font-weight: 600;
						color: #111827;
						margin: 0 0 4px 0;
					}
					
					.member-role {
						font-size: 13px;
						color: #6b7280;
						display: flex;
						align-items: center;
					}
					
					.member-company {
						font-size: 13px;
						color: #6b7280;
						margin-top: 4px;
					}
					
					.member-role i, .member-company i {
						font-size: 12px;
						margin-right: 6px;
						opacity: 0.7;
					}
					
					.member-stats {
						padding: 20px;
						background: #fff;
					}
					
					.stats-row {
						display: flex;
						margin-bottom: 20px;
					}
					
					.stat-item {
						flex: 1;
						text-align: center;
						border-right: 1px solid #f3f4f6;
						padding: 0 10px;
					}
					
					.stat-item:last-child {
						border-right: 0;
					}
					
					.stat-label {
						font-size: 12px;
						color: #6b7280;
						margin-bottom: 6px;
					}
					
					.stat-value {
						font-size: 18px;
						font-weight: 600;
						color: #374151;
					}
					
					.member-progress {
						padding: 0 20px 20px;
					}
					
					.progress-header {
						display: flex;
						justify-content: space-between;
						margin-bottom: 8px;
					}
					
					.progress-label {
						font-size: 13px;
						font-weight: 500;
						color: #4b5563;
					}
					
					.progress-value {
						font-size: 13px;
						font-weight: 600;
						color: #111827;
					}
					
					.progress-bar-container {
						height: 8px;
						background: #f3f4f6;
						border-radius: 4px;
						overflow: hidden;
					}
					
					.progress-fill {
						height: 100%;
						border-radius: 4px;
						transition: width 0.5s ease;
					}
					
					.progress-excellent {
						background: linear-gradient(90deg, #10b981, #059669);
					}
					
					.progress-good {
						background: linear-gradient(90deg, #3b82f6, #2563eb);
					}
					
					.progress-average {
						background: linear-gradient(90deg, #f59e0b, #d97706);
					}
					
					.progress-poor {
						background: linear-gradient(90deg, #ef4444, #dc2626);
					}
					
					/* Table View */
					.team-table-view table {
						border-radius: 8px;
						overflow: hidden;
					}
					
					.team-table-view th {
						background: #f9fafb;
						color: #374151;
						font-weight: 600;
						font-size: 14px;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					
					.team-table-view td {
						vertical-align: middle;
						font-size: 14px;
					}
					
					.table-member-profile {
						display: flex;
						align-items: center;
					}
					
					.table-member-avatar {
						width: 40px;
						height: 40px;
						border-radius: 20px;
						margin-right: 10px;
						object-fit: cover;
					}
					
					.table-member-info {
						line-height: 1.4;
					}
					
					.table-member-name {
						font-weight: 600;
						color: #111827;
					}
					
					.table-member-company {
						font-size: 12px;
						color: #6b7280;
					}
					
					.status-pill {
						display: inline-block;
						padding: 4px 10px;
						border-radius: 20px;
						font-size: 12px;
						font-weight: 600;
					}
					
					.pill-excellent {
						background: rgba(16, 185, 129, 0.1);
						color: #10b981;
					}
					
					.pill-good {
						background: rgba(59, 130, 246, 0.1);
						color: #3b82f6;
					}
					
					.pill-average {
						background: rgba(245, 158, 11, 0.1);
						color: #f59e0b;
					}
					
					.pill-poor {
						background: rgba(239, 68, 68, 0.1);
						color: #ef4444;
					}
					
					/* No Data State */
					.no-data-container {
						padding: 40px;
						text-align: center;
						background: #fff;
						border-radius: 10px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.05);
					}
					
					.no-data-icon {
						font-size: 48px;
						color: #e5e7eb;
						margin-bottom: 15px;
					}
					
					.no-data-message {
						font-size: 16px;
						color: #6b7280;
						margin-bottom: 20px;
					}
					
					@media (max-width: 991px) {
						.kpi-card {
							margin-bottom: 20px;
						}
					}
					
					@media (max-width: 767px) {
						.stats-row {
							flex-direction: column;
						}
						
						.stat-item {
							border-right: 0;
							border-bottom: 1px solid #f3f4f6;
							padding: 10px 0;
						}
						
						.stat-item:last-child {
							border-bottom: 0;
						}
					}
				`;
				
				// Add styles to head
				$('<style>').html(styles).appendTo('head');
			}
			
			// Setup event handlers
			function setupEventHandlers() {
				// Refresh button click
				$('.refresh-btn').on('click', function() {
					fetchSalesData();
				});
				
				// Date input changes
				$('.from-date, .to-date').on('change', function() {
					fetchSalesData();
				});
				
				// Company field change
			   
				
				// Target category filter change
				$('.target-category-filter').on('change', function() {
					filterAndRenderData();
				});
				
				// View toggle
				$('.grid-view').on('click', function() {
					$(this).addClass('active');
					$('.table-view').removeClass('active');
					$('.team-grid-view').show();
					$('.team-table-view').hide();
				});
				
				$('.table-view').on('click', function() {
					$(this).addClass('active');
					$('.grid-view').removeClass('active');
					$('.team-grid-view').hide();
					$('.team-table-view').show();
				});
				
				// Sort and filter changes
				$('.sort-by, .team-filter, .performance-filter').on('change', function() {
					filterAndRenderData();
				});
				
				// Search input
				$('.search-input').on('input', function() {
					filterAndRenderData();
				});
				
				// Chart view toggle
				$('.chart-view-toggle').on('change', function() {
					updateSalesTargetChart();
				});
			}
			
			function fetchSalesData() {
				// Show loading state
				$('.dashboard-content').hide();
				$('.loading-container').show();
				
				// Prepare filters
				let filters = {
					from_date: $('.from-date').val() || formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
					to_date: $('.to-date').val() || formatDate(new Date()),
					company: $('.company-field-readonly').val() || 'PRASTARA DECORATION DESIGN L.L.C'
				};
				
				console.log('Fetching sales data with filters:', filters);
				
				frappe.call({
					method: 'prastara_custom.controller.variant_pricing.get_sales_data',
					args: { filters: filters },
					freeze: false,
					callback: function(response) {
						console.log('API Response:', response);
						
						if (response && response.message && response.message.length > 0) {
							// Process sales data
							salesData = response.message;
							console.log('Received sales data:', salesData.length, 'records');
							
							// Update team filter options
							updateTeamFilter();
							
							// Update period range
							if (salesData[0] && salesData[0].period_start && salesData[0].period_end) {
								const startDate = moment(salesData[0].period_start).format('MMM D, YYYY');
								const endDate = moment(salesData[0].period_end).format('MMM D, YYYY');
								$('.period-range').text(`${startDate} - ${endDate}`);
							}
							
							// Filter and render data
							filterAndRenderData();
							
							// Hide loading, show dashboard
							$('.loading-container').hide();
							$('.dashboard-content').show();
						} else {
							console.warn('No data received from API or empty data array');
							tryAlternativeMethod(filters);
						}
					},
					error: function(error) {
						// Handle error
						console.error('API Error:', error);
						$('.loading-container').hide();
						frappe.msgprint(__('Error fetching data: ') + (error.message || 'Unknown error'));
						tryAlternativeMethod(filters);
					}
				});
			}
			
			// Try alternative method namespaces
			function tryAlternativeMethod(filters) {
				console.log('Trying alternative method...');
				
				frappe.call({
					method: 'prastara_custom.controller.variant_pricing.get_sales_data',
					args: { filters: filters },
					callback: function(response) {
						console.log('Alternative API Response:', response);
						
						if (response && response.message && response.message.length > 0) {
							salesData = response.message;
							updateTeamFilter();
							filterAndRenderData();
							$('.loading-container').hide();
							$('.dashboard-content').show();
						} else {
							$('.loading-container').hide();
							showNoDataMessage();
						}
					},
					error: function() {
						console.log('Trying another alternative method...');
						fetchTestData();
					}
				});
			}
			
			// Update team filter options
			function updateTeamFilter() {
				const teams = [...new Set(
					salesData
						.filter(row => row.sales_person !== 'Total' && row.sales_team)
						.map(row => row.sales_team)
				)];
				
				let $teamFilter = $('.team-filter');
				$teamFilter.find('option:not(:first)').remove();
				
				teams.forEach(team => {
					$teamFilter.append(`<option value="${team}">${team}</option>`);
				});
			}
			
			// Filter and render all data
			function filterAndRenderData() {
				const teamFilter = $('.team-filter').val();
				const performanceFilter = $('.performance-filter').val();
				const searchQuery = $('.search-input').val().toLowerCase();
				const sortBy = $('.sort-by').val();
				const targetCategory = $('.target-category-filter').val();
				
				// Filter data
				filteredData = salesData.filter(row => {
					if (row.sales_person === 'Total') return false;
					
					if (teamFilter && row.sales_team !== teamFilter) return false;
					
					// Apply performance filter based on target category
					const achievement = targetCategory === 'hod' ? (row.hod_achievement || 0) :
									  targetCategory === 'company' ? (row.company_achievement || 0) :
									  (row.achievement || 0);
					if (performanceFilter === 'exceeded' && achievement < 100) return false;
					if (performanceFilter === 'on-track' && (achievement < 70 || achievement >= 100)) return false;
					if (performanceFilter === 'at-risk' && (achievement < 40 || achievement >= 70)) return false;
					if (performanceFilter === 'poor' && achievement >= 40) return false;
					
					if (searchQuery) {
						const salesPerson = (row.sales_person || '').toLowerCase();
						const team = (row.sales_team || '').toLowerCase();
						const company = (row.company || '').toLowerCase();
						return salesPerson.includes(searchQuery) || 
							   team.includes(searchQuery) || 
							   company.includes(searchQuery);
					}
					
					return true;
				});
				
				// Sort filtered data
				if (sortBy === 'achievement-desc') {
					filteredData.sort((a, b) => {
						const aAchievement = targetCategory === 'hod' ? (a.hod_achievement || 0) :
											targetCategory === 'company' ? (a.company_achievement || 0) :
											(a.achievement || 0);
						const bAchievement = targetCategory === 'hod' ? (b.hod_achievement || 0) :
											targetCategory === 'company' ? (b.company_achievement || 0) :
											(b.achievement || 0);
						return bAchievement - aAchievement;
					});
				} else if (sortBy === 'achievement-asc') {
					filteredData.sort((a, b) => {
						const aAchievement = targetCategory === 'hod' ? (a.hod_achievement || 0) :
											targetCategory === 'company' ? (a.company_achievement || 0) :
											(a.achievement || 0);
						const bAchievement = targetCategory === 'hod' ? (b.hod_achievement || 0) :
											targetCategory === 'company' ? (b.company_achievement || 0) :
											(b.achievement || 0);
						return aAchievement - bAchievement;
					});
				} else if (sortBy === 'team') {
					filteredData.sort((a, b) => (a.sales_team || '').localeCompare(b.sales_team || ''));
				} else if (sortBy === 'sales-desc') {
					filteredData.sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0));
				} else if (sortBy === 'target-desc') {
					filteredData.sort((a, b) => {
						const aTarget = targetCategory === 'hod' ? (a.hod_total_target || 0) :
									   targetCategory === 'company' ? (a.company_total_target || 0) :
									   (a.total_target || 0);
						const bTarget = targetCategory === 'hod' ? (b.hod_total_target || 0) :
									   targetCategory === 'company' ? (b.company_total_target || 0) :
									   (b.total_target || 0);
						return bTarget - aTarget;
					});
				}
				
				// Update records count
				$('.records-count').text(filteredData.length);
				
				// Update dashboard components
				updateKPICards();
				updateCharts();
				renderTeamGrid();
				renderTeamTable();
			}
			
			// Update KPI cards
			function updateKPICards() {
				const teamFilter = $('.team-filter').val();
				const targetCategory = $('.target-category-filter').val();
				let totalSales = 0;
				let totalTarget = 0;
				let totalAchievement = 0;
				let topPerformer = null;
				let periodStart = null;
				let periodEnd = null;
			
				// If no team filter is applied, use the Total row if available
				if (!teamFilter) {
					const totalRow = salesData.find(row => row.sales_person === 'Total');
					if (totalRow) {
						totalSales = totalRow.total_sales || 0;
						totalTarget = targetCategory === 'hod' ? (totalRow.hod_total_target || 0) :
									 targetCategory === 'company' ? (totalRow.company_total_target || 0) :
									 (totalRow.total_target || 0);
						totalAchievement = targetCategory === 'hod' ? (totalRow.hod_achievement || 0) :
										  targetCategory === 'company' ? (totalRow.company_achievement || 0) :
										  (totalRow.achievement || 0);
						periodStart = totalRow.period_start;
						periodEnd = totalRow.period_end;
					}
				} else {
					// Calculate totals from filteredData when a team filter is applied
					filteredData.forEach(row => {
						totalSales += row.total_sales || 0;
						totalTarget += targetCategory === 'hod' ? (row.hod_total_target || 0) :
									  targetCategory === 'company' ? (row.company_total_target || 0) :
									  (row.total_target || 0);
						totalAchievement += targetCategory === 'hod' ? (row.hod_achievement || 0) :
										   targetCategory === 'company' ? (row.company_achievement || 0) :
										   (row.achievement || 0);
						// Update period dates from the first row
						if (!periodStart || !periodEnd) {
							periodStart = row.period_start;
							periodEnd = row.period_end;
						}
					});
			
					// Calculate average achievement
					totalAchievement = filteredData.length > 0 ? totalAchievement / filteredData.length : 0;
				}
			
				// Update Total Sales
				$('.total-sales .kpi-value').text('AED ' + formatNumber(totalSales));
			
				// Update Total Target
				$('.total-target .kpi-value').text('AED ' + formatNumber(totalTarget));
			
				// Update Average Achievement
				$('.avg-achievement .kpi-value').text(totalAchievement.toFixed(1) + '%');
				$('.achievement-meter .progress-bar').css('width', `${Math.min(totalAchievement, 100)}%`);
			
				// Update Sales vs Target progress
				const targetProgress = totalTarget > 0 ? (totalSales / totalTarget * 100) : 0;
				$('.total-sales .progress-bar').css('width', `${Math.min(targetProgress, 100)}%`);
				$('.total-sales .kpi-sub-value span').text(targetProgress.toFixed(1) + '%');
			
				// Update Top Performer
				if (filteredData.length > 0) {
					topPerformer = [...filteredData].sort((a, b) => {
						const aAchievement = targetCategory === 'hod' ? (a.hod_achievement || 0) :
											targetCategory === 'company' ? (a.company_achievement || 0) :
											(a.achievement || 0);
						const bAchievement = targetCategory === 'hod' ? (b.hod_achievement || 0) :
											targetCategory === 'company' ? (b.company_achievement || 0) :
											(b.achievement || 0);
						return bAchievement - aAchievement;
					})[0];
					$('.top-performer .kpi-value').text(topPerformer.sales_person);
					const topAchievement = targetCategory === 'hod' ? (topPerformer.hod_achievement || 0) :
										 targetCategory === 'company' ? (topPerformer.company_achievement || 0) :
										 (topPerformer.achievement || 0);
					$('.top-achievement').text(topAchievement.toFixed(1) + '%');
					$('.top-performer .progress-bar').css('width', `${Math.min(topAchievement, 100)}%`);
				} else {
					$('.top-performer .kpi-value').text('-');
					$('.top-achievement').text('0%');
					$('.top-performer .progress-bar').css('width', '0%');
				}
			
				// Update period date range
				if (periodStart && periodEnd) {
					const startDate = moment(periodStart).format('MMM D, YYYY');
					const endDate = moment(periodEnd).format('MMM D, YYYY');
					$('.period-range').text(`${startDate} - ${endDate}`);
				} else {
					const startYear = new Date($('.from-date').val()).getFullYear();
					const endYear = new Date($('.to-date').val()).getFullYear();
					$('.period-range').text(`Jan 1, ${startYear} - Dec 31, ${endYear}`);
				}
			}
			
			// Format number with commas
			function formatNumber(value) {
				return parseFloat(value).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
			}
			
			function formatCurrency(value) {
				return 'AED ' + formatNumber(value);
			}
			
			function formatCompactCurrency(value) {
				if (value >= 1000000000) {
					return 'AED ' + (value / 1000000000).toFixed(1) + 'B';
				}
				if (value >= 1000000) {
					return 'AED ' + (value / 1000000).toFixed(1) + 'M';
				}
				if (value >= 1000) {
					return 'AED ' + (value / 1000).toFixed(1) + 'K';
				}
				return 'AED ' + value.toFixed(0);
			}
			
			// Update all charts
			function updateCharts() {
				updateSalesTargetChart();
				updateAchievementDistributionChart();
				updateTeamPerformanceChart();
				updateTopPerformersChart();
			}
			
			// Update Sales vs Target chart
			function updateSalesTargetChart() {
				const ctx = document.getElementById('sales-target-chart').getContext('2d');
				const chartView = $('.chart-view-toggle').val();
				const targetCategory = $('.target-category-filter').val();
				
				let chartData;
				let labels;
				let salesValues;
				let targetValues;
				
				if (chartView === 'team') {
					// Group by team
					const teamData = {};
					
					salesData.forEach(row => {
						if (row.sales_person !== 'Total' && row.sales_team) {
							if (!teamData[row.sales_team]) {
								teamData[row.sales_team] = {
									sales: 0,
									target: 0
								};
							}
							teamData[row.sales_team].sales += (row.total_sales || 0);
							teamData[row.sales_team].target += targetCategory === 'hod' ? (row.hod_total_target || 0) :
															  targetCategory === 'company' ? (row.company_total_target || 0) :
															  (row.total_target || 0);
						}
					});
					
					labels = Object.keys(teamData);
					salesValues = labels.map(team => teamData[team].sales);
					targetValues = labels.map(team => teamData[team].target);
				} else {
					// Use individual data, limited to top 10
					chartData = [...filteredData].slice(0, 10);
					labels = chartData.map(row => row.sales_person);
					salesValues = chartData.map(row => row.total_sales || 0);
					targetValues = chartData.map(row => targetCategory === 'hod' ? (row.hod_total_target || 0) :
													  targetCategory === 'company' ? (row.company_total_target || 0) :
													  (row.total_target || 0));
				}
				
				if (charts.salesTarget) {
					charts.salesTarget.destroy();
				}
				
				charts.salesTarget = new Chart(ctx, {
					type: 'bar',
					data: {
						labels: labels,
						datasets: [
							{
								label: 'Sales',
								data: salesValues,
								backgroundColor: 'rgba(79, 70, 229, 0.8)',
								borderColor: '#4f46e5',
								borderWidth: 1,
								borderRadius: 4
							},
							{
								label: 'Target',
								data: targetValues,
								backgroundColor: 'rgba(245, 158, 11, 0.8)',
								borderColor: '#f59e0b',
								borderWidth: 1,
								borderRadius: 4
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								position: 'top',
								labels: {
									usePointStyle: true,
									font: {
										size: 12
									}
								}
							},
							tooltip: {
								mode: 'index',
								intersect: false,
								backgroundColor: 'rgba(17, 24, 39, 0.9)',
								padding: 12,
								cornerRadius: 8,
								callbacks: {
									label: function(context) {
										const label = context.dataset.label || '';
										const value = context.parsed.y;
										return `${label}: ${formatCurrency(value)}`;
									}
								}
							},
							datalabels: {
								display: false
							}
						},
						scales: {
							x: {
								grid: {
									display: false
								},
								ticks: {
									color: '#6b7280',
									font: {
										size: 11
									},
									maxRotation: 45,
									minRotation: 45
								}
							},
							y: {
								grid: {
									color: 'rgba(243, 244, 246, 0.7)'
								},
								ticks: {
									color: '#6b7280',
									font: {
										size: 11
									},
									callback: function(value) {
										return formatCompactCurrency(value);
									}
								}
							}
						}
					}
				});
			}
			
			// Update Achievement Distribution Chart
			function updateAchievementDistributionChart() {
				const ctx = document.getElementById('achievement-distribution-chart').getContext('2d');
				const targetCategory = $('.target-category-filter').val();
				
				// Count performances by category
				const achievementField = targetCategory === 'hod' ? 'hod_achievement' :
									   targetCategory === 'company' ? 'company_achievement' :
									   'achievement';
				const excellentCount = salesData.filter(r => r.sales_person !== 'Total' && r[achievementField] >= 100).length;
				const goodCount = salesData.filter(r => r.sales_person !== 'Total' && r[achievementField] >= 70 && r[achievementField] < 100).length;
				const averageCount = salesData.filter(r => r.sales_person !== 'Total' && r[achievementField] >= 40 && r[achievementField] < 70).length;
				const poorCount = salesData.filter(r => r.sales_person !== 'Total' && r[achievementField] < 40).length;
				
				if (charts.achievementDistribution) {
					charts.achievementDistribution.destroy();
				}
				
				charts.achievementDistribution = new Chart(ctx, {
					type: 'doughnut',
					data: {
						labels: ['Excellent (≥100%)', 'Good (70-99%)', 'Average (40-69%)', 'Poor (<40%)'],
						datasets: [{
							data: [excellentCount, goodCount, averageCount, poorCount],
							backgroundColor: [
								'#10b981', // green
								'#3b82f6', // blue
								'#f59e0b', // orange
								'#ef4444'  // red
							],
							borderColor: '#ffffff',
							borderWidth: 2
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						cutout: '60%',
						plugins: {
							legend: {
								position: 'bottom',
								labels: {
									usePointStyle: true,
									padding: 20,
									font: {
										size: 12
									}
								}
							},
							tooltip: {
								callbacks: {
									label: function(context) {
										const label = context.label || '';
										const value = context.parsed;
										const total = context.dataset.data.reduce((a, b) => a + b, 0);
										const percentage = Math.round((value / total) * 100);
										return `${label}: ${value} (${percentage}%)`;
									}
								}
							},
							datalabels: {
								color: '#fff',
								font: {
									weight: 'bold'
								},
								formatter: function(value, context) {
									if (value === 0) return '';
									const total = context.dataset.data.reduce((a, b) => a + b, 0);
									const percentage = Math.round((value / total) * 100);
									return percentage >= 10 ? `${percentage}%` : '';
								}
							}
						}
					}
				});
			}
			
			// Update Team Performance Chart
			function updateTeamPerformanceChart() {
				const ctx = document.getElementById('team-performance-chart').getContext('2d');
				const targetCategory = $('.target-category-filter').val();
				
				// Group data by teams
				const teamData = {};
				
				salesData.forEach(row => {
					if (row.sales_person !== 'Total' && row.sales_team) {
						if (!teamData[row.sales_team]) {
							teamData[row.sales_team] = {
								sales: 0,
								target: 0,
								teamMembers: 0
							};
						}
						teamData[row.sales_team].sales += (row.total_sales || 0);
						teamData[row.sales_team].target += targetCategory === 'hod' ? (row.hod_total_target || 0) :
														  targetCategory === 'company' ? (row.company_total_target || 0) :
														  (row.total_target || 0);
						teamData[row.sales_team].teamMembers++;
					}
				});
				
				// Calculate team achievements
				const teams = Object.keys(teamData);
				const achievements = teams.map(team => {
					const { sales, target } = teamData[team];
					return target > 0 ? (sales / target * 100) : 0;
				});
				
				// Sort by achievement
				const sortedIndices = achievements.map((achievement, index) => ({
					index,
					achievement
				})).sort((a, b) => b.achievement - a.achievement).map(item => item.index);
				
				const sortedTeams = sortedIndices.map(index => teams[index]);
				const sortedAchievements = sortedIndices.map(index => achievements[index]);
				const sortedMembers = sortedIndices.map(index => teamData[teams[index]].teamMembers);
				
				// Limit to top 5 teams
				const displayTeams = sortedTeams.slice(0, 5);
				const displayAchievements = sortedAchievements.slice(0, 5);
				const displayMembers = sortedMembers.slice(0, 5);
				
				if (charts.teamPerformance) {
					charts.teamPerformance.destroy();
				}
				
				charts.teamPerformance = new Chart(ctx, {
					type: 'bar',
					data: {
						labels: displayTeams,
						datasets: [
							{
								label: 'Achievement %',
								data: displayAchievements,
								backgroundColor: displayAchievements.map(value => {
									if (value >= 100) return 'rgba(16, 185, 129, 0.8)';
									if (value >= 70) return 'rgba(59, 130, 246, 0.8)';
									if (value >= 40) return 'rgba(245, 158, 11, 0.8)';
									return 'rgba(239, 68, 68, 0.8)';
								}),
								borderWidth: 0,
								borderRadius: 4,
								yAxisID: 'y',
								order: 1
							},
							{
								label: 'Team Members',
								data: displayMembers,
								type: 'line',
								borderColor: 'rgba(107, 114, 128, 0.8)',
								borderWidth: 2,
								pointBackgroundColor: '#fff',
								pointBorderColor: 'rgba(107, 114, 128, 0.8)',
								pointBorderWidth: 2,
								pointRadius: 4,
								fill: false,
								tension: 0.4,
								yAxisID: 'y1',
								order: 0
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								position: 'top',
								labels: {
									usePointStyle: true,
									font: {
										size: 12
									}
								}
							},
							tooltip: {
								mode: 'index',
								intersect: false
							},
							datalabels: {
								formatter: function(value, context) {
									return context.datasetIndex === 0 ? value.toFixed(1) + '%' : value;
								},
								color: function(context) {
									return context.datasetIndex === 0 ? '#fff' : '#374151';
								},
								font: {
									weight: 'bold',
									size: 11
								},
								anchor: function(context) {
									return context.datasetIndex === 0 ? 'center' : 'end';
								},
								align: function(context) {
									return context.datasetIndex === 0 ? 'center' : 'top';
								},
								offset: function(context) {
									return context.datasetIndex === 0 ? 0 : 5;
								}
							}
						},
						scales: {
							x: {
								grid: {
									display: false
								},
								ticks: {
									color: '#6b7280',
									font: {
										size: 11
									}
								}
							},
							y: {
								position: 'left',
								title: {
									display: true,
									text: 'Achievement %',
									color: '#6b7280',
									font: {
										size: 11,
										weight: 'normal'
									}
								},
								ticks: {
									color: '#6b7280',
									font: {
										size: 11
									},
									callback: function(value) {
										return value + '%';
									}
								},
								grid: {
									color: 'rgba(243, 244, 246, 0.7)'
								}
							},
							y1: {
								position: 'right',
								title: {
									display: true,
									text: 'Team Size',
									color: '#6b7280',
									font: {
										size: 11,
										weight: 'normal'
									}
								},
								ticks: {
									color: '#6b7280',
									font: {
										size: 11
									},
									stepSize: 1
								},
								grid: {
									display: false
								}
							}
						}
					}
				});
			}
			
			// Update Top Performers Chart
			function updateTopPerformersChart() {
				const ctx = document.getElementById('top-performers-chart').getContext('2d');
				const targetCategory = $('.target-category-filter').val();
				
				// Get top 5 performers by achievement
				const topPerformers = [...filteredData]
					.sort((a, b) => {
						const aAchievement = targetCategory === 'hod' ? (a.hod_achievement || 0) :
											targetCategory === 'company' ? (a.company_achievement || 0) :
											(a.achievement || 0);
						const bAchievement = targetCategory === 'hod' ? (b.hod_achievement || 0) :
											targetCategory === 'company' ? (b.company_achievement || 0) :
											(b.achievement || 0);
						return bAchievement - aAchievement;
					})
					.slice(0, 5);
				
				const labels = topPerformers.map(p => p.sales_person);
				const achievements = topPerformers.map(p => targetCategory === 'hod' ? (p.hod_achievement || 0) :
													  targetCategory === 'company' ? (p.company_achievement || 0) :
													  (p.achievement || 0));
				const salesValues = topPerformers.map(p => p.total_sales || 0);
				const targetValues = topPerformers.map(p => targetCategory === 'hod' ? (p.hod_total_target || 0) :
														   targetCategory === 'company' ? (p.company_total_target || 0) :
														   (p.total_target || 0));
				
				if (charts.topPerformers) {
					charts.topPerformers.destroy();
				}
				
				charts.topPerformers = new Chart(ctx, {
					type: 'bar',
					data: {
						labels: labels,
						datasets: [
							{
								label: 'Achievement %',
								data: achievements,
								backgroundColor: achievements.map(value => {
									if (value >= 100) return 'rgba(16, 185, 129, 0.8)';
									if (value >= 70) return 'rgba(59, 130, 246, 0.8)';
									if (value >= 40) return 'rgba(245, 158, 11, 0.8)';
									return 'rgba(239, 68, 68, 0.8)';
								}),
								borderWidth: 0,
								borderRadius: 4
							}
						]
					},
					options: {
						indexAxis: 'y',
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								display: false
							},
							tooltip: {
								callbacks: {
									afterLabel: function(context) {
										const index = context.dataIndex;
										return [
											`Sales: ${formatCurrency(salesValues[index])}`,
											`Target: ${formatCurrency(targetValues[index])}`
										];
									}
								}
							},
							datalabels: {
								formatter: function(value) {
									return value.toFixed(1) + '%';
								},
								color: '#fff',
								font: {
									weight: 'bold',
									size: 12
								},
								anchor: 'center',
								align: 'center'
							}
						},
						scales: {
							x: {
								grid: {
									color: 'rgba(243, 244, 246, 0.7)'
								},
								ticks: {
									color: '#6b7280',
									font: {
										size: 11
									},
									callback: function(value) {
										return value + '%';
									}
								}
							},
							y: {
								grid: {
									display: false
								},
								ticks: {
									color: '#374151',
									font: {
										size: 11,
										weight: 'bold'
									}
								}
							}
						}
					}
				});
			}
			
			// Render Team Grid
			function renderTeamGrid() {
				const $gridContainer = $('.team-grid');
				const targetCategory = $('.target-category-filter').val();
				$gridContainer.empty();
				
				if (filteredData.length === 0) {
					$gridContainer.html('<div class="col-12 text-center py-5"><p>No matching sales data found.</p></div>');
					return;
				}
				
				filteredData.forEach(member => {
					const achievement = targetCategory === 'hod' ? (member.hod_achievement || 0) :
									  targetCategory === 'company' ? (member.company_achievement || 0) :
									  (member.achievement || 0);
					const targetValue = targetCategory === 'hod' ? (member.hod_total_target || 0) :
									   targetCategory === 'company' ? (member.company_total_target || 0) :
									   (member.total_target || 0);
					const badgeClass = achievement >= 100 ? 'badge-excellent' : 
									  achievement >= 70 ? 'badge-good' : 
									  achievement >= 40 ? 'badge-average' : 
									  'badge-poor';
					const progressClass = achievement >= 100 ? 'progress-excellent' : 
										 achievement >= 70 ? 'progress-good' : 
										 achievement >= 40 ? 'progress-average' : 
										 'progress-poor';
					
					const formattedTarget = formatNumber(targetValue);
					const salesValue = formatNumber(member.total_sales || 0);
					const gapValue = formatNumber(Math.max(0, targetValue - (member.total_sales || 0)));
					
					const memberHtml = `
						<div class="col-md-4 col-lg-3">
							<div class="team-member-card">
								<div class="member-header">
									<span class="achievement-badge ${badgeClass}">${achievement.toFixed(1)}%</span>
									<div class="member-profile">
										<img src="${member.employee_image}" alt="${member.sales_person}" class="member-avatar" 
											 onerror="this.src='https://erp.ihgind.com/files/default-avatar.png'">
										<div class="member-info">
											<h4 class="member-name">${member.sales_person || 'Unknown'}</h4>
											<div class="member-role"><i class="fa fa-users"></i> ${member.sales_team || 'No Team'}</div>
											<div class="member-company"><i class="fa fa-building"></i> ${member.company || 'N/A'}</div>
										</div>
									</div>
								</div>
								<div class="member-stats">
									<div class="stats-row">
										<div class="stat-item">
											<div class="stat-label">Target</div>
											<div class="stat-value">AED ${formattedTarget}</div>
										</div>
										<div class="stat-item">
											<div class="stat-label">Sales</div>
											<div class="stat-value">AED ${salesValue}</div>
										</div>
										<div class="stat-item">
											<div class="stat-label">Gap</div>
											<div class="stat-value">AED ${gapValue}</div>
										</div>
									</div>
								</div>
								<div class="member-progress">
									<div class="progress-header">
										<div class="progress-label">Performance</div>
										<div class="progress-value">${achievement.toFixed(1)}%</div>
									</div>
									<div class="progress-bar-container">
										<div class="progress-fill ${progressClass}" style="width: ${Math.min(achievement, 100)}%;"></div>
									</div>
								</div>
							</div>
						</div>
					`;
					
					$gridContainer.append(memberHtml);
				});
			}
			
			// Render Team Table
			function renderTeamTable() {
				const $tableBody = $('.team-table-body');
				const targetCategory = $('.target-category-filter').val();
				$tableBody.empty();
				
				if (filteredData.length === 0) {
					$('.team-table-view').html('<div class="text-center py-5"><p>No matching sales data found.</p></div>');
					return;
				}
				
				filteredData.forEach(member => {
					const achievement = targetCategory === 'hod' ? (member.hod_achievement || 0) :
									  targetCategory === 'company' ? (member.company_achievement || 0) :
									  (member.achievement || 0);
					const targetValue = targetCategory === 'hod' ? (member.hod_total_target || 0) :
									   targetCategory === 'company' ? (member.company_total_target || 0) :
									   (member.total_target || 0);
					const statusClass = achievement >= 100 ? 'pill-excellent' : 
									   achievement >= 70 ? 'pill-good' : 
									   achievement >= 40 ? 'pill-average' : 
									   'pill-poor';
					const statusText = achievement >= 100 ? 'Excellent' : 
									  achievement >= 70 ? 'Good' : 
									  achievement >= 40 ? 'Average' : 
									  'Poor';
					
					const rowHtml = `
						<tr>
							<td>
								<div class="table-member-profile">
									<img src="${member.employee_image}" alt="${member.sales_person}" class="table-member-avatar" 
										 onerror="this.src='https://erp.ihgind.com/files/default-avatar.png'">
									<div class="table-member-info">
										<div class="table-member-name">${member.sales_person || 'Unknown'}</div>
										<div class="table-member-company">${member.company || 'N/A'}</div>
									</div>
								</div>
							</td>
							<td>${member.sales_team || 'No Team'}</td>
							<td>AED ${formatNumber(targetValue)}</td>
							<td>AED ${formatNumber(member.total_sales || 0)}</td>
							<td>${achievement.toFixed(1)}%</td>
							<td><span class="status-pill ${statusClass}">${statusText}</span></td>
						</tr>
					`;
					
					$tableBody.append(rowHtml);
				});
			}
			
			// Utility Functions
			function formatDate(date) {
				const d = new Date(date);
				const month = '' + (d.getMonth() + 1);
				const day = '' + d.getDate();
				const year = d.getFullYear();
				
				return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
			}
		}
	};
// Enhanced Modern Catalog Gallery - Dark Green Theme Version
frappe.pages['catalogs-gallery-prd'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Catalog Gallery',
        single_column: true,
    });

    // Initialize the catalog gallery
    window.catalogGallery = new EnhancedCatalogGallery(page);
};

class EnhancedCatalogGallery {
    constructor(page) {
        this.wrapper = page.body instanceof jQuery ? page.body[0] : page.body;
        this.currentFilters = { 
            search: '', 
            activeBrand: 'all',
            activeSubBrand: 'all',
            file_type: 'all' 
        };
        this.allCatalogs = [];
        this.filteredCatalogs = [];
        this.availableBrands = [];
        this.availableSubBrands = [];
        this.availableFileTypes = [];
        this.init();
    }

    init() {
        if (!this.wrapper || !(this.wrapper instanceof HTMLElement)) {
            console.error('Invalid wrapper: this.wrapper is not a DOM element', this.wrapper);
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: __('Failed to initialize Catalog Gallery due to invalid wrapper.')
            });
            return;
        }
        this.setupStyles();
        this.setupHTML();
        this.setupEventListeners();
        this.fetchCatalogs();
    }

    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Enhanced Modern Dark Green Catalog Gallery */
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
            
            .modern-catalog-gallery {
                background: linear-gradient(135deg, #152318 0%, #1F3629 50%, #2B4E3E 100%);
                min-height: 100vh;
                color: #ffffff;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 0;
                margin: 0;
                width: 100vw;
                overflow-x: hidden;
                position: relative;
            }

            .container {
                width: 100%;
                padding-right: 0px;
                padding-left: 0px;
                margin-right: 0px;
                margin-left: 0px;
            }

            .page-head.flex {
                display: none !important;
            }

            /* Animated background overlay */
            .modern-catalog-gallery::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: 
                    radial-gradient(circle at 25% 25%, rgba(43, 78, 62, 0.2) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(31, 54, 41, 0.15) 0%, transparent 50%),
                    radial-gradient(circle at 50% 50%, rgba(21, 35, 24, 0.1) 0%, transparent 50%);
                animation: backgroundFlow 20s ease-in-out infinite;
                pointer-events: none;
                z-index: 1;
            }

            .modern-catalog-gallery::after {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: 
                    radial-gradient(2px 2px at 20px 30px, rgba(52, 90, 72, 0.1), transparent),
                    radial-gradient(2px 2px at 40px 70px, rgba(43, 78, 62, 0.05), transparent),
                    radial-gradient(1px 1px at 90px 40px, rgba(31, 54, 41, 0.08), transparent),
                    radial-gradient(1px 1px at 130px 80px, rgba(21, 35, 24, 0.03), transparent);
                background-repeat: repeat;
                background-size: 150px 100px;
                animation: sparkle 15s linear infinite;
                pointer-events: none;
                z-index: 1;
                opacity: 0.6;
            }

            @keyframes sparkle {
                0% { transform: translateY(0); }
                100% { transform: translateY(-100px); }
            }

            @keyframes backgroundFlow {
                0%, 100% { 
                    transform: scale(1) rotate(0deg);
                    opacity: 1;
                }
                50% { 
                    transform: scale(1.1) rotate(180deg);
                    opacity: 0.7;
                }
            }

            /* Header Section */
            .gallery-header {
                background: rgba(21, 35, 24, 0.95);
                backdrop-filter: blur(20px) saturate(180%);
                border-bottom: 1px solid rgba(52, 90, 72, 0.3);
                padding: 4rem 0 2.5rem;
                text-align: center;
                position: relative;
                z-index: 10;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            }

            .gallery-title {
                font-size: clamp(2.5rem, 6vw, 4.5rem);
                font-weight: 900;
                letter-spacing: -0.025em;
                margin: 0 0 1rem 0;
                background: linear-gradient(135deg, #52916c 0%, #2B4E3E 50%, #1F3629 100%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: titleReveal 1.8s ease-out;
                line-height: 1.1;
            }

            @keyframes titleReveal {
                from {
                    opacity: 0;
                    transform: translateY(-30px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            /* Search Section */
            .search-container {
                max-width: 700px;
                margin: 0 auto;
                position: relative;
                animation: searchReveal 1.8s ease-out 0.6s both;
            }

            @keyframes searchReveal {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .search-wrapper {
                position: relative;
                background: rgba(43, 78, 62, 0.4);
                border: 2px solid rgba(52, 90, 72, 0.4);
                border-radius: 20px;
                overflow: hidden;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .search-wrapper:hover,
            .search-wrapper:focus-within {
                background: rgba(43, 78, 62, 0.6);
                border-color: rgba(52, 90, 72, 0.7);
                transform: translateY(-2px);
                box-shadow: 
                    0 20px 40px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(52, 90, 72, 0.4);
            }

            .search-input {
                width: 100%;
                padding: 20px 28px 20px 70px;
                background: transparent;
                border: none;
                color: #ffffff;
                font-size: 1.1rem;
                font-weight: 500;
                outline: none;
                letter-spacing: 0.01em;
            }

            .search-input::placeholder {
                color: #52916c;
            }

            .search-icon {
                position: absolute;
                left: 24px;
                top: 50%;
                transform: translateY(-50%);
                color: #52916c;
                font-size: 1.4rem;
                pointer-events: none;
                transition: all 0.3s ease;
            }

            .search-wrapper:focus-within .search-icon {
                color: #345a48;
                transform: translateY(-50%) scale(1.1);
            }

            /* Enhanced Filter Section */
            .filter-section {
                background: rgba(21, 35, 24, 0.9);
                backdrop-filter: blur(15px);
                padding: 2.5rem 0;
                position: sticky;
                top: 0;
                z-index: 100;
                border-bottom: 1px solid rgba(52, 90, 72, 0.3);
            }

            .filter-container {
                max-width: 1600px;
                margin: 0 auto;
                padding: 0 2rem;
            }

            /* Dropdown Filters */
            .dropdown-filters {
                display: flex;
                justify-content: center;
                gap: 3rem;
                flex-wrap: wrap;
                margin-bottom: 2rem;
            }

            .section-label {
                color: #52916c;
                font-weight: 600;
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                margin-bottom: 1rem;
                text-align: center;
            }

            .filter-count {
                background: rgba(52, 90, 72, 0.4);
                color: #d0dcd4;
                padding: 2px 6px;
                border-radius: 8px;
                font-size: 0.7rem;
                font-weight: 700;
                margin-left: 6px;
            }

            .dropdown-group {
                position: relative;
                min-width: 200px;
            }

            .dropdown-label {
                color: #52916c;
                font-weight: 600;
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                margin-bottom: 0.5rem;
                display: block;
                text-align: center;
            }

            .custom-dropdown {
                position: relative;
                background: rgba(43, 78, 62, 0.4);
                border: 1px solid rgba(52, 90, 72, 0.4);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .custom-dropdown:hover {
                background: rgba(43, 78, 62, 0.6);
                border-color: rgba(52, 90, 72, 0.6);
            }

            .dropdown-selected {
                padding: 12px 16px;
                color: #ffffff;
                font-size: 0.9rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .dropdown-arrow {
                transition: transform 0.3s ease;
                color: #52916c;
            }

            .custom-dropdown.open .dropdown-arrow {
                transform: rotate(180deg);
            }

            .dropdown-options {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: rgba(21, 35, 24, 0.95);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(52, 90, 72, 0.4);
                border-radius: 12px;
                margin-top: 4px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                pointer-events: none;
            }

            .custom-dropdown.open .dropdown-options {
                opacity: 1;
                transform: translateY(0);
                pointer-events: all;
            }

            .dropdown-option {
                padding: 10px 16px;
                color: #d0dcd4;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.2s ease;
                border-bottom: 1px solid rgba(52, 90, 72, 0.2);
            }

            .dropdown-option:last-child {
                border-bottom: none;
            }

            .dropdown-option:hover {
                background: rgba(52, 90, 72, 0.3);
                color: #ffffff;
            }

            .dropdown-option.selected {
                background: rgba(52, 90, 72, 0.5);
                color: #ffffff;
                font-weight: 600;
            }

            /* Sub-brand Pills */
            .subbrand-section {
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                max-height: 0;
                overflow: hidden;
                margin-bottom: 0;
            }

            .subbrand-section.show {
                opacity: 1;
                transform: translateY(0);
                max-height: 200px;
                margin-bottom: 2rem;
            }

            .subbrand-pills {
                display: flex;
                justify-content: center;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 1rem;
            }

            .subbrand-pill {
                padding: 8px 16px;
                background: rgba(43, 78, 62, 0.4);
                border: 1px solid rgba(52, 90, 72, 0.4);
                border-radius: 20px;
                color: #d0dcd4;
                font-size: 0.8rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                animation: pillAppear 0.5s ease-out forwards;
            }

            .subbrand-pill:nth-child(1) { animation-delay: 0.1s; }
            .subbrand-pill:nth-child(2) { animation-delay: 0.15s; }
            .subbrand-pill:nth-child(3) { animation-delay: 0.2s; }
            .subbrand-pill:nth-child(4) { animation-delay: 0.25s; }
            .subbrand-pill:nth-child(5) { animation-delay: 0.3s; }

            @keyframes pillAppear {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .subbrand-pill::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(52, 90, 72, 0.3), transparent);
                transition: left 0.5s;
            }

            .subbrand-pill:hover::before {
                left: 100%;
            }

            .subbrand-pill:hover {
                color: #ffffff;
                background: rgba(43, 78, 62, 0.7);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }

            .subbrand-pill.active {
                background: linear-gradient(135deg, #2B4E3E 0%, #52916c 100%);
                color: #ffffff;
                font-weight: 600;
                box-shadow: 
                    0 6px 20px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(52, 90, 72, 0.4);
                transform: translateY(-2px);
                border-color: rgba(52, 90, 72, 0.6);
            }

            /* Gallery Content */
            .gallery-content {
                padding: 1rem 0;
                position: relative;
                z-index: 10;
                max-width: 1600px;
                margin: 0 auto;
            }

            .navbar {
                background: rgba(21, 35, 24, 0.95);
            }

            .search-bar .awesomplete input {
                background: rgba(43, 78, 62, 0.4);
            }

            .results-counter {
                text-align: center;
                margin: 0 0 3rem;
                color: #52916c;
                font-size: 0.9rem;
                font-weight: 500;
                letter-spacing: 0.05em;
                text-transform: uppercase;
            }

            /* Catalog Grid */
            .catalog-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 1.5rem;
                padding: 0 2rem;
                align-items: start;
            }

            @media (min-width: 1200px) {
                .catalog-grid {
                    grid-template-columns: repeat(5, 1fr);
                }
            }

            @media (min-width: 1600px) {
                .catalog-grid {
                    grid-template-columns: repeat(6, 1fr);
                }
            }

            /* Catalog Card */
            .catalog-card {
                background: rgba(21, 35, 24, 0.8);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(52, 90, 72, 0.3);
                border-radius: 16px;
                overflow: hidden;
                cursor: pointer;
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                opacity: 0;
                animation: cardAppear 0.8s ease-out forwards;
                height: fit-content;
                min-height: 400px;
                aspect-ratio: 3/5;
                display: flex;
                flex-direction: column;
            }

            .catalog-card:nth-child(1) { animation-delay: 0.1s; }
            .catalog-card:nth-child(2) { animation-delay: 0.15s; }
            .catalog-card:nth-child(3) { animation-delay: 0.2s; }
            .catalog-card:nth-child(4) { animation-delay: 0.25s; }
            .catalog-card:nth-child(5) { animation-delay: 0.3s; }
            .catalog-card:nth-child(6) { animation-delay: 0.35s; }
            .catalog-card:nth-child(7) { animation-delay: 0.4s; }
            .catalog-card:nth-child(8) { animation-delay: 0.45s; }
            .catalog-card:nth-child(9) { animation-delay: 0.5s; }
            .catalog-card:nth-child(10) { animation-delay: 0.55s; }

            @keyframes cardAppear {
                from {
                    opacity: 0;
                    transform: translateY(40px) scale(0.9) rotateX(10deg);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1) rotateX(0deg);
                }
            }

            .catalog-card::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(52, 90, 72, 0.15), transparent);
                transform: rotate(-45deg);
                transition: all 0.6s ease;
                z-index: 1;
                opacity: 0;
            }

            .catalog-card:hover::before {
                animation: shimmer 1.5s ease-in-out;
            }

            @keyframes shimmer {
                0% {
                    transform: translateX(-100%) translateY(-100%) rotate(-45deg);
                    opacity: 0;
                }
                50% {
                    opacity: 1;
                }
                100% {
                    transform: translateX(100%) translateY(100%) rotate(-45deg);
                    opacity: 0;
                }
            }

            .catalog-card:hover {
                transform: translateY(-15px) scale(1.03);
                box-shadow: 
                    0 30px 60px rgba(0, 0, 0, 0.6),
                    0 0 0 1px rgba(52, 90, 72, 0.4),
                    0 0 80px rgba(52, 90, 72, 0.3),
                    inset 0 1px 0 rgba(52, 90, 72, 0.3);
                background: rgba(31, 54, 41, 0.95);
                border-color: rgba(52, 90, 72, 0.6);
            }

            .card-image-container {
                position: relative;
                height: 200px;
                background: linear-gradient(135deg, #2B4E3E 0%, #345a48 100%);
                overflow: hidden;
                flex-shrink: 0;
            }

            .card-image {
                width: 100%;
                height: 100%;
                object-fit: contain;
                object-position: center;
                transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                filter: brightness(0.9) contrast(1.1);
                background: #2B4E3E;
            }

            .catalog-card:hover .card-image {
                transform: scale(1.1);
                filter: brightness(1.1) contrast(1.2) saturate(1.1);
            }

            .image-fallback {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #2B4E3E 0%, #345a48 100%);
                color: #52916c;
                font-size: 2.5rem;
                animation: pulse 2s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 0.6;
                    transform: scale(1);
                }
                50% {
                    opacity: 0.8;
                    transform: scale(1.05);
                }
            }

            .card-overlay {
                position: absolute;
                inset: 0;
                background: linear-gradient(
                    to top, 
                    rgba(21, 35, 24, 0.95) 0%, 
                    rgba(21, 35, 24, 0.8) 40%,
                    rgba(21, 35, 24, 0.3) 70%,
                    transparent 100%
                );
                opacity: 0;
                transition: all 0.4s ease;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                align-items: flex-start;
                padding: 1rem;
                z-index: 2;
            }

            .catalog-card:hover .card-overlay {
                opacity: 1;
                animation: overlayGlow 0.6s ease-out;
            }

            @keyframes overlayGlow {
                0% {
                    box-shadow: inset 0 0 0 rgba(52, 90, 72, 0);
                }
                50% {
                    box-shadow: inset 0 0 30px rgba(52, 90, 72, 0.3);
                }
                100% {
                    box-shadow: inset 0 0 0 rgba(52, 90, 72, 0);
                }
            }

            .overlay-text {
                color: #ffffff;
                font-weight: 500;
                font-size: 0.7rem;
                line-height: 1.4;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
                animation: textFloat 2s ease-in-out infinite;
                margin-bottom: 0.5rem;
            }

            .overlay-preview {
                color: #52916c;
                font-weight: 700;
                font-size: 0.65rem;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                display: flex;
                align-items: center;
                gap: 0.25rem;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
            }

            @keyframes textFloat {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-2px);
                }
            }

            .card-content {
                padding: 1rem;
                display: flex;
                flex-direction: column;
                flex: 1;
                position: relative;
                z-index: 2;
                justify-content: space-between;
            }

            .card-title {
                font-size: 0.9rem;
                font-weight: 700;
                color: #ffffff;
                margin: 0 0 0.75rem 0;
                line-height: 1.3;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                flex-shrink: 0;
                transition: all 0.3s ease;
            }

            .catalog-card:hover .card-title {
                color: #d0dcd4;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                transform: translateY(-1px);
            }

            .card-info {
                margin: 0 0 0.75rem 0;
                flex-shrink: 0;
            }

            .info-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.35rem;
                padding: 0.15rem 0;
                border-bottom: 1px solid rgba(52, 90, 72, 0.2);
                transition: all 0.3s ease;
            }

            .info-row:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .info-label {
                font-size: 0.6rem;
                color: #52916c;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                flex-shrink: 0;
                min-width: 45px;
            }

            .info-value {
                font-size: 0.65rem;
                color: #d0dcd4;
                font-weight: 500;
                text-align: right;
                flex: 1;
                margin-left: 0.5rem;
                word-break: break-word;
                transition: all 0.3s ease;
            }

            .catalog-card:hover .info-row {
                border-bottom-color: rgba(52, 90, 72, 0.3);
                transform: translateX(2px);
            }

            .catalog-card:hover .info-label {
                color: #345a48;
            }

            .catalog-card:hover .info-value {
                color: #ffffff;
            }

            .preview-catalog-btn {
                width: 100%;
                padding: 8px 12px;
                background: linear-gradient(135deg, #2B4E3E 0%, #52916c 100%);
                border: none;
                border-radius: 8px;
                color: #ffffff;
                font-weight: 700;
                font-size: 0.7rem;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                position: relative;
                overflow: hidden;
                box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
                margin-top: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.3rem;
            }

            .preview-catalog-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.6s;
            }

            .preview-catalog-btn:hover::before {
                left: 100%;
            }

            .preview-catalog-btn:hover {
                transform: translateY(-3px);
                box-shadow: 
                    0 8px 25px rgba(0, 0, 0, 0.4),
                    0 0 0 1px rgba(52, 90, 72, 0.4);
                background: linear-gradient(135deg, #1F3629 0%, #2B4E3E 100%);
            }

            .eye-icon {
                font-size: 0.85rem;
                animation: blink 3s ease-in-out infinite;
            }

            @keyframes blink {
                0%, 90%, 100% {
                    transform: scaleY(1);
                }
                95% {
                    transform: scaleY(0.1);
                }
            }

            /* Floating Button */
            .floating-button {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #2B4E3E 0%, #52916c 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 1000;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 
                    0 8px 25px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(52, 90, 72, 0.4);
                animation: floatBounce 3s ease-in-out infinite;
            }

            @keyframes floatBounce {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-8px);
                }
            }

            .floating-button:hover {
                transform: translateY(-5px) scale(1.1);
                box-shadow: 
                    0 15px 35px rgba(0, 0, 0, 0.4),
                    0 0 0 1px rgba(52, 90, 72, 0.6);
                background: linear-gradient(135deg, #1F3629 0%, #2B4E3E 100%);
            }

            .floating-icon {
                font-size: 1.5rem;
                animation: iconPulse 2s ease-in-out infinite;
            }

            @keyframes iconPulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }

            /* Modal Styles */
           /* Simplified Modern Modal Design - Single Company */

/* Modal Overlay - Enhanced */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%);
    backdrop-filter: blur(12px) saturate(150%);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 20px;
}

.modal-overlay.show {
    opacity: 1;
    visibility: visible;
}

/* Modal Content - Redesigned */
.modal-content {
    background: linear-gradient(145deg, rgba(21, 35, 24, 0.98) 0%, rgba(31, 54, 41, 0.95) 100%);
    backdrop-filter: blur(25px) saturate(180%);
    border: 2px solid rgba(52, 90, 72, 0.4);
    border-radius: 24px;
    max-width: 800px;
    width: 95%;
    max-height: 85vh;
    overflow: hidden;
    transform: scale(0.8) translateY(40px) rotateX(15deg);
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 
        0 40px 80px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(52, 90, 72, 0.3),
        inset 0 1px 0 rgba(52, 90, 72, 0.2);
    position: relative;
    display: flex;
    flex-direction: column;
}

.modal-overlay.show .modal-content {
    transform: scale(1) translateY(0) rotateX(0deg);
}

/* Animated Background Pattern */
.modal-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: 
        radial-gradient(circle at 20% 50%, rgba(52, 90, 72, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 30%, rgba(43, 78, 62, 0.1) 0%, transparent 50%),
        linear-gradient(135deg, rgba(52, 90, 72, 0.05) 0%, transparent 100%);
    animation: modalBackgroundFlow 8s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
}

@keyframes modalBackgroundFlow {
    0%, 100% { 
        transform: translateX(0) scale(1);
        opacity: 0.7;
    }
    50% { 
        transform: translateX(20px) scale(1.05);
        opacity: 0.4;
    }
}

/* Modal Header - Redesigned */
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3rem 3rem 2rem;
    border-bottom: none;
    position: relative;
    z-index: 10;
    background: linear-gradient(135deg, rgba(52, 90, 72, 0.1) 0%, transparent 100%);
}

.modal-header h3 {
    margin: 0;
    color: #ffffff;
    font-size: clamp(1.8rem, 5vw, 2.5rem);
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #d0dcd4 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 1rem;
    animation: titleSlideIn 0.8s ease-out 0.2s both;
}

@keyframes titleSlideIn {
    from {
        opacity: 0;
        transform: translateX(-30px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Modal Close Button - Enhanced */
.modal-close {
    background: rgba(52, 90, 72, 0.2);
    border: 2px solid rgba(52, 90, 72, 0.3);
    color: #52916c;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    animation: closeButtonAppear 0.8s ease-out 0.4s both;
}

@keyframes closeButtonAppear {
    from {
        opacity: 0;
        transform: rotate(-90deg) scale(0.5);
    }
    to {
        opacity: 1;
        transform: rotate(0deg) scale(1);
    }
}

.modal-close::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, transparent, rgba(52, 90, 72, 0.3), transparent);
    transform: translateX(-100%);
    transition: transform 0.6s ease;
}

.modal-close:hover::before {
    transform: translateX(100%);
}

.modal-close:hover {
    color: #ffffff;
    background: rgba(52, 90, 72, 0.4);
    border-color: rgba(52, 90, 72, 0.6);
    transform: rotate(90deg) scale(1.1);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

/* Modal Body - Enhanced */
.modal-body {
    padding: 0 3rem 3rem;
    flex: 1;
    overflow-y: auto;
    position: relative;
    z-index: 10;
}

.modal-body::-webkit-scrollbar {
    width: 8px;
}

.modal-body::-webkit-scrollbar-track {
    background: rgba(52, 90, 72, 0.1);
    border-radius: 4px;
    margin: 8px;
}

.modal-body::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, rgba(52, 90, 72, 0.5), rgba(52, 90, 72, 0.3));
    border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, rgba(52, 90, 72, 0.7), rgba(52, 90, 72, 0.5));
}

/* Company Container - New Design for Single Company */
.company-container {
    animation: companySlideIn 0.8s ease-out 0.6s both;
}

@keyframes companySlideIn {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Company Card - Complete Redesign for Single Display */
.company-card {
    background: linear-gradient(145deg, rgba(21, 35, 24, 0.8) 0%, rgba(31, 54, 41, 0.6) 100%);
    backdrop-filter: blur(15px);
    border: 2px solid rgba(52, 90, 72, 0.3);
    border-radius: 20px;
    padding: 3rem;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
    text-align: center;
}

/* Floating Orb Effect */
.company-card::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(52, 90, 72, 0.1) 0%, transparent 70%);
    transform: rotate(0deg);
    transition: all 0.8s ease;
    opacity: 0;
}

.company-card:hover::before {
    animation: orbRotate 3s linear infinite;
    opacity: 1;
}

@keyframes orbRotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.company-card:hover {
    background: linear-gradient(145deg, rgba(31, 54, 41, 0.9) 0%, rgba(52, 90, 72, 0.4) 100%);
    border-color: rgba(52, 90, 72, 0.6);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(52, 90, 72, 0.5),
        inset 0 1px 0 rgba(52, 90, 72, 0.2);
}

/* Company Name - Enhanced */
.company-name {
    margin: 0 0 1.5rem 0;
    color: #ffffff;
    font-size: clamp(2rem, 6vw, 3rem);
    font-weight: 800;
    text-align: center;
    letter-spacing: -0.02em;
    position: relative;
    z-index: 2;
    background: linear-gradient(135deg, #ffffff 0%, #d0dcd4 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    transition: all 0.3s ease;
    animation: companyNameAppear 1s ease-out 0.8s both;
}

@keyframes companyNameAppear {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.company-card:hover .company-name {
    transform: translateY(-2px) scale(1.02);
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Social Count Badge - Redesigned */
.company-social-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #52916c;
    font-size: 1rem;
    font-weight: 700;
    margin: 0 auto 3rem auto;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, rgba(52, 90, 72, 0.3) 0%, rgba(52, 90, 72, 0.15) 100%);
    border-radius: 30px;
    border: 2px solid rgba(52, 90, 72, 0.4);
    width: fit-content;
    position: relative;
    z-index: 2;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    animation: badgeAppear 1s ease-out 1s both;
}

@keyframes badgeAppear {
    from {
        opacity: 0;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.company-card:hover .company-social-count {
    background: linear-gradient(135deg, rgba(52, 90, 72, 0.5) 0%, rgba(52, 90, 72, 0.3) 100%);
    border-color: rgba(52, 90, 72, 0.7);
    color: #ffffff;
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

/* Social Links Grid - Enhanced for Single Company */
.social-links {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1.5rem;
    position: relative;
    z-index: 2;
    max-width: 600px;
    margin: 0 auto;
}

/* Social Link - Complete Redesign */
.social-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 120px;
    background: linear-gradient(145deg, rgba(52, 90, 72, 0.2) 0%, rgba(21, 35, 24, 0.4) 100%);
    border: 2px solid rgba(52, 90, 72, 0.3);
    border-radius: 18px;
    color: #ffffff;
    text-decoration: none;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
    text-align: center;
    padding: 1.5rem 1rem;
    backdrop-filter: blur(10px);
    opacity: 0;
    transform: translateY(30px) scale(0.9);
    animation: socialLinkAppear 0.6s ease-out forwards;
}

.social-link:nth-child(1) { animation-delay: 1.2s; }
.social-link:nth-child(2) { animation-delay: 1.3s; }
.social-link:nth-child(3) { animation-delay: 1.4s; }
.social-link:nth-child(4) { animation-delay: 1.5s; }
.social-link:nth-child(5) { animation-delay: 1.6s; }
.social-link:nth-child(6) { animation-delay: 1.7s; }
.social-link:nth-child(7) { animation-delay: 1.8s; }
.social-link:nth-child(8) { animation-delay: 1.9s; }

@keyframes socialLinkAppear {
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* Floating Particle Effect */
.social-link::before {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    background: rgba(52, 90, 72, 0.6);
    border-radius: 50%;
    top: 20%;
    left: 20%;
    animation: floatingParticle 4s ease-in-out infinite;
}

.social-link::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(52, 90, 72, 0.4);
    border-radius: 50%;
    top: 70%;
    right: 25%;
    animation: floatingParticle 6s ease-in-out infinite reverse;
}

@keyframes floatingParticle {
    0%, 100% { 
        transform: translateY(0) scale(1); 
        opacity: 0.3; 
    }
    50% { 
        transform: translateY(-15px) scale(1.5); 
        opacity: 0.8; 
    }
}

.social-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 0.75rem;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
}

.icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: brightness(0.9) saturate(1.1);
    transition: all 0.4s ease;
}

.social-label {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.9;
    transition: all 0.4s ease;
    position: relative;
    z-index: 2;
}

/* Enhanced Hover Effects for Each Platform */
.social-link:hover {
    transform: translateY(-8px) scale(1.08);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    border-width: 3px;
}

.social-link:hover .icon-img {
    filter: brightness(1.2) saturate(1.3) contrast(1.1);
    transform: scale(1.2) rotate(8deg);
}

.social-link:hover .social-label {
    opacity: 1;
    transform: translateY(-3px);
}

/* Platform-specific hover styles with enhanced animations */
.social-link.website:hover {
    background: linear-gradient(145deg, #4a5568 0%, #2d3748 100%);
    border-color: #718096;
    box-shadow: 0 20px 50px rgba(74, 85, 104, 0.4);
}

.social-link.instagram:hover {
    background: linear-gradient(145deg, #e1306c 0%, #fd1d1d 25%, #fcb045 50%, #833ab4 75%, #5851db 100%);
    border-color: #e1306c;
    box-shadow: 0 20px 50px rgba(225, 48, 108, 0.5);
}

.social-link.facebook:hover {
    background: linear-gradient(145deg, #1877f2 0%, #42a5f5 100%);
    border-color: #1877f2;
    box-shadow: 0 20px 50px rgba(24, 119, 242, 0.5);
}

.social-link.linkedin:hover {
    background: linear-gradient(145deg, #0a66c2 0%, #0e76a8 100%);
    border-color: #0a66c2;
    box-shadow: 0 20px 50px rgba(10, 102, 194, 0.5);
}

.social-link.tiktok:hover {
    background: linear-gradient(145deg, #000000 0%, #fe2c55 50%, #25f4ee 100%);
    border-color: #25f4ee;
    box-shadow: 0 20px 50px rgba(37, 244, 238, 0.5);
}

.social-link.twitter:hover {
    background: linear-gradient(145deg, #1da1f2 0%, #0d8bd9 100%);
    border-color: #1da1f2;
    box-shadow: 0 20px 50px rgba(29, 161, 242, 0.5);
}

.social-link.youtube:hover {
    background: linear-gradient(145deg, #ff0000 0%, #cc0000 100%);
    border-color: #ff0000;
    box-shadow: 0 20px 50px rgba(255, 0, 0, 0.5);
}

.social-link.whatsapp:hover {
    background: linear-gradient(145deg, #25d366 0%, #128c7e 100%);
    border-color: #25d366;
    box-shadow: 0 20px 50px rgba(37, 211, 102, 0.5);
}

.social-link.telegram:hover {
    background: linear-gradient(145deg, #0088cc 0%, #005577 100%);
    border-color: #0088cc;
    box-shadow: 0 20px 50px rgba(0, 136, 204, 0.5);
}

/* No Social Links - Enhanced */
.no-social-links {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    background: linear-gradient(145deg, rgba(52, 90, 72, 0.15) 0%, rgba(21, 35, 24, 0.2) 100%);
    border: 2px dashed rgba(52, 90, 72, 0.4);
    border-radius: 18px;
    color: #52916c;
    text-align: center;
    position: relative;
    overflow: hidden;
}

.no-social-links::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(52, 90, 72, 0.1), transparent);
    animation: noSocialShimmer 2s ease-in-out infinite;
}

@keyframes noSocialShimmer {
    0% { left: -100%; }
    100% { left: 100%; }
}

.no-social-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    opacity: 0.6;
    animation: iconFloat 3s ease-in-out infinite;
}

@keyframes iconFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
}

.no-social-text {
    font-size: 1.1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
    position: relative;
    z-index: 2;
}

/* Responsive Design */
@media (max-width: 768px) {
    .modal-content {
        width: 98%;
        max-height: 95vh;
        border-radius: 20px;
    }

    .modal-header,
    .modal-body {
        padding: 2rem 1.5rem;
    }

    .modal-header h3 {
        font-size: 1.8rem;
    }

    .company-card {
        padding: 2rem 1.5rem;
    }

    .company-name {
        font-size: 2rem;
        margin-bottom: 1rem;
    }

    .company-social-count {
        font-size: 0.9rem;
        padding: 0.75rem 1.5rem;
        margin-bottom: 2rem;
    }

    .social-links {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        max-width: 100%;
    }

    .social-link {
        height: 100px;
        padding: 1rem 0.5rem;
    }

    .social-icon {
        width: 40px;
        height: 40px;
        margin-bottom: 0.5rem;
    }

    .social-label {
        font-size: 0.7rem;
    }
}

@media (max-width: 480px) {
    .modal-header,
    .modal-body {
        padding: 1.5rem 1rem;
    }

    .company-name {
        font-size: 1.8rem;
    }

    .social-links {
        grid-template-columns: 1fr;
        gap: 0.75rem;
    }

    .social-link {
        height: 80px;
    }

    .social-icon {
        width: 32px;
        height: 32px;
    }
}


            /* Loading State */
            .loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 500px;
                color: #52916c;
                grid-column: 1 / -1;
            }

            .loading-spinner {
                width: 60px;
                height: 60px;
                border: 4px solid rgba(52, 90, 72, 0.3);
                border-top: 4px solid #52916c;
                border-radius: 50%;
                animation: spin 1.2s linear infinite;
                margin-bottom: 2rem;
                position: relative;
            }

            .loading-spinner::before {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border: 2px solid transparent;
                border-top: 2px solid rgba(52, 90, 72, 0.5);
                border-radius: 50%;
                animation: spin 2s linear infinite reverse;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .loading-text {
                font-size: 1rem;
                font-weight: 600;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                animation: loadingPulse 1.5s ease-in-out infinite;
            }

            @keyframes loadingPulse {
                0%, 100% {
                    opacity: 0.6;
                    transform: scale(1);
                }
                50% {
                    opacity: 1;
                    transform: scale(1.02);
                }
            }

            /* No Results */
            .no-results {
                grid-column: 1 / -1;
                text-align: center;
                padding: 8rem 2rem;
                color: #52916c;
            }

            .no-results-icon {
                font-size: 5rem;
                margin-bottom: 2rem;
                opacity: 0.4;
            }

            .no-results h3 {
                font-size: 1.8rem;
                color: #ffffff;
                margin: 0 0 1rem 0;
                font-weight: 700;
            }

            .no-results p {
                font-size: 1.1rem;
                margin: 0;
                color: #52916c;
                max-width: 400px;
                margin: 0 auto;
                line-height: 1.6;
            }

            /* Responsive Design */
            @media (max-width: 1024px) {
                .filter-container {
                    padding: 0 1.5rem;
                }
                
                .dropdown-filters {
                    gap: 2rem;
                }
                
                .catalog-grid {
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.25rem;
                    padding: 0 1.5rem;
                }

                .card-image-container {
                    height: 180px;
                }

                .companies-grid {
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                }

                .floating-button {
                    width: 50px;
                    height: 50px;
                    bottom: 20px;
                    right: 20px;
                }

                .floating-icon {
                    font-size: 1.2rem;
                }
            }

            @media (max-width: 768px) {
                .gallery-title {
                    font-size: 2.5rem;
                }
                
                .search-container {
                    margin: 0 1rem;
                }
                
                .filter-container {
                    padding: 0 1rem;
                }
                
                .dropdown-filters {
                    flex-direction: column;
                    gap: 1.5rem;
                    align-items: stretch;
                }
                
                .dropdown-group {
                    width: 100%;
                }
                
                .catalog-grid {
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 1rem;
                    padding: 0 1rem;
                }
                
                .card-content {
                    padding: 0.75rem;
                }

                .card-image-container {
                    height: 160px;
                }

                .catalog-card {
                    aspect-ratio: 3/5;
                    min-height: 380px;
                }

                .modal-content {
                    width: 95%;
                    max-height: 90vh;
                }

                .modal-header,
                .modal-body {
                    padding: 1.5rem;
                }

                .modal-filter {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 0.5rem;
                }

                .companies-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                    max-height: 40vh;
                }

                .company-card {
                    padding: 1.5rem;
                }

                .company-name {
                    font-size: 1.1rem;
                    margin-bottom: 0.5rem;
                }

                .company-social-count {
                    font-size: 0.7rem;
                    margin-bottom: 0.75rem;
                    padding: 0.2rem 0.5rem;
                }

                .social-links {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5rem;
                }

                .social-link {
                    height: 60px;
                    border-radius: 8px;
                }

                .social-icon {
                    width: 24px;
                    height: 24px;
                    margin-bottom: 0.2rem;
                }

                .social-label {
                    font-size: 0.6rem;
                }

                .floating-button {
                    width: 45px;
                    height: 45px;
                    bottom: 15px;
                    right: 15px;
                }

                .floating-icon {
                    font-size: 1rem;
                }
            }

            /* Scrollbar Styling */
            ::-webkit-scrollbar {
                width: 8px;
            }

            ::-webkit-scrollbar-track {
                background: rgba(52, 90, 72, 0.2);
                border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb {
                background: rgba(52, 90, 72, 0.5);
                border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: rgba(52, 90, 72, 0.7);
            }
        `;
        document.head.appendChild(style);
    }

    setupHTML() {
        this.wrapper.innerHTML = `
            <div class="modern-catalog-gallery">
                <div class="gallery-header">
                    <h2 class="gallery-title">Digital Company Portfolio</h2>
                    
                    <div class="search-container">
                        <div class="search-wrapper">
                            <div class="search-icon">🔍</div>
                            <input type="text" class="search-input" id="searchInput" placeholder="Search catalogs, brands, or file types...">
                        </div>
                    </div>
                </div>

                <div class="filter-section">
                    <div class="filter-container">
                        <!-- Dropdown Filters (Company filter removed) -->
                        <div class="dropdown-filters">
                            <div class="dropdown-group">
                                <label class="dropdown-label">Brand</label>
                                <div class="custom-dropdown" id="brandDropdown">
                                    <div class="dropdown-selected">
                                        <span id="brandSelected">All Brands</span>
                                        <span class="dropdown-arrow">▼</span>
                                    </div>
                                    <div class="dropdown-options" id="brandOptions">
                                        <!-- Brand options will be populated here -->
                                    </div>
                                </div>
                            </div>

                            <div class="dropdown-group">
                                <label class="dropdown-label">File Type</label>
                                <div class="custom-dropdown" id="fileTypeDropdown">
                                    <div class="dropdown-selected">
                                        <span id="fileTypeSelected">All Types</span>
                                        <span class="dropdown-arrow">▼</span>
                                    </div>
                                    <div class="dropdown-options" id="fileTypeOptions">
                                        <!-- File type options will be populated here -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Sub-brand Pills -->
                        <div class="subbrand-section" id="subbrandSection">
                            <div class="section-label">Sub-brands</div>
                            <div class="subbrand-pills" id="subbrandPills">
                                <!-- Sub-brand pills will be populated here -->
                            </div>
                        </div>
                    </div>
                </div>

                <div class="gallery-content">
                    <div class="results-counter" id="resultsCounter">Loading catalogs...</div>
                    
                    <div class="catalog-grid" id="catalogGrid">
                        <div class="loading-container">
                            <div class="loading-spinner"></div>
                            <p class="loading-text">Loading catalog gallery</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Floating Button -->
            <div class="floating-button" id="floatingButton">
                <span class="floating-icon">🏢</span>
            </div>

            <!-- Company Links Modal -->
           <!-- Simplified Company Links Modal - Single Company -->
<div class="modal-overlay" id="modalOverlay">
    <div class="modal-content">
        <div class="modal-header">
            <h3>
                <span style="font-size: 2rem;">🌐</span>
                Connect With Us
            </h3>
            <button class="modal-close" id="modalClose" aria-label="Close modal">
                ✕
            </button>
        </div>
        
        <div class="modal-body">
            <div class="company-container" id="companyContainer">
                <!-- Company info will be populated here -->
            </div>
        </div>
    </div>
</div>
        `;
    }

    setupEventListeners() {
        if (!this.wrapper || !(this.wrapper instanceof HTMLElement)) {
            console.error('Cannot setup event listeners: Invalid wrapper', this.wrapper);
            return;
        }

        // Search functionality
        const searchInput = this.wrapper.querySelector('#searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentFilters.search = e.target.value;
                    this.applyFilters();
                }, 300);
            });
        }

        // Dropdown functionality (Company dropdown removed)
        this.setupDropdowns();

        // Floating button and modal
        this.setupModal();

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-dropdown')) {
                this.wrapper.querySelectorAll('.custom-dropdown').forEach(dropdown => {
                    dropdown.classList.remove('open');
                });
            }
        });
    }

    setupDropdowns() {
        const brandDropdown = this.wrapper.querySelector('#brandDropdown');
        const fileTypeDropdown = this.wrapper.querySelector('#fileTypeDropdown');

        if (brandDropdown) {
            brandDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('brandDropdown');
            });
        }

        if (fileTypeDropdown) {
            fileTypeDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown('fileTypeDropdown');
            });
        }
    }

    // Simplified Modal Methods for Single Company

// Replace setupModal() method with this simplified version:
setupModal() {
    const floatingButton = this.wrapper.querySelector('#floatingButton');
    const modalOverlay = this.wrapper.querySelector('#modalOverlay');
    const modalClose = this.wrapper.querySelector('#modalClose');

    if (floatingButton) {
        floatingButton.addEventListener('click', () => {
            console.log('Opening social media directory modal');
            modalOverlay.classList.add('show');
            // Add focus trap and accessibility
            modalOverlay.setAttribute('aria-hidden', 'false');
            modalClose.focus();
            document.body.style.overflow = 'hidden'; // Prevent background scroll
            this.populateCompanyModal();
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            this.closeModal();
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal();
            }
        });
    }

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (modalOverlay.classList.contains('show')) {
            if (e.key === 'Escape') {
                this.closeModal();
            }
            // Trap focus within modal
            if (e.key === 'Tab') {
                this.trapFocus(e, modalOverlay);
            }
        }
    });
}

// Replace populateModalCompanies() with this simplified version:
populateCompanyModal() {
    const companyContainer = this.wrapper.querySelector('#companyContainer');
    
    if (!companyContainer) return;

    // Show loading animation
    companyContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem;">
            <div style="width: 60px; height: 60px; border: 4px solid rgba(52, 90, 72, 0.3); border-top: 4px solid #52916c; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 2rem;"></div>
            <p style="color: #52916c; font-weight: 600; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1em;">Loading Company Info...</p>
        </div>
    `;

    // Simulate loading delay for better UX
    setTimeout(() => {
        this.displayCompanyInfo();
    }, 800);
}

// New method to display single company info:
displayCompanyInfo() {
    const companyContainer = this.wrapper.querySelector('#companyContainer');
    if (!companyContainer) return;

    const socialData = this.getCompanySocialData();
    const socialIcons = this.getSocialMediaIcons();
    
    // Get the first (and only) company from the data
    const companyName = Object.keys(socialData)[0];
    const social = socialData[companyName] || {};
    
    console.log(`Displaying social links for ${companyName}:`, social);
    
    // Build social links HTML
    const socialLinksHtml = Object.entries(socialIcons).map(([platform, iconData]) => {
        if (social[platform]) {
            return `
                <a href="${social[platform]}" 
                   target="_blank" 
                   class="social-link ${platform}" 
                   title="Visit ${companyName} on ${iconData.label}"
                   rel="noopener noreferrer">
                    <div class="social-icon">
                        <img src="${iconData.icon}" 
                             alt="${iconData.label}" 
                             class="icon-img"
                             loading="lazy">
                    </div>
                    <div class="social-label">${iconData.label}</div>
                </a>
            `;
        }
        return '';
    }).join('');

    // Count available social links
    const socialLinkCount = Object.keys(social).length;

    // Display company info
    const finalSocialLinks = socialLinkCount > 0 ? socialLinksHtml : `
        <div class="no-social-links">
            <div class="no-social-icon">🔗</div>
            <div class="no-social-text">Social media links coming soon!</div>
        </div>
    `;

    companyContainer.innerHTML = `
        <div class="company-card">
            <h4 class="company-name">${companyName}</h4>
            <div class="company-social-count">
                <span style="font-size: 1.2rem;">📱</span>
                ${socialLinkCount} Social Platform${socialLinkCount !== 1 ? 's' : ''}
            </div>
            <div class="social-links">
                ${finalSocialLinks}
            </div>
        </div>
    `;
}

// Keep these existing methods unchanged:
closeModal() {
    const modalOverlay = this.wrapper.querySelector('#modalOverlay');
    const floatingButton = this.wrapper.querySelector('#floatingButton');
    
    modalOverlay.classList.remove('show');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Restore background scroll
    
    // Return focus to floating button
    if (floatingButton) {
        floatingButton.focus();
    }
}

trapFocus(e, container) {
    const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
        }
    } else {
        if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
        }
    }
}
    toggleDropdown(dropdownId) {
        const dropdown = this.wrapper.querySelector(`#${dropdownId}`);
        const allDropdowns = this.wrapper.querySelectorAll('.custom-dropdown');
        
        // Close all other dropdowns
        allDropdowns.forEach(d => {
            if (d.id !== dropdownId) {
                d.classList.remove('open');
            }
        });
        
        // Toggle the clicked dropdown
        dropdown.classList.toggle('open');
    }

    setupBrandDropdown() {
        const brandOptions = this.wrapper.querySelector('#brandOptions');
        if (!brandOptions) return;

        // Get all brands (no company filtering needed)
        this.availableBrands = [...new Set(this.allCatalogs.map(cat => cat.brand).filter(Boolean))];
        const brandCounts = this.getFilterCounts('brand');

        brandOptions.innerHTML = `
            <div class="dropdown-option ${this.currentFilters.activeBrand === 'all' ? 'selected' : ''}" data-brand="all">
                All Brands <span class="filter-count">${this.allCatalogs.length}</span>
            </div>
            ${this.availableBrands.map(brand => 
                `<div class="dropdown-option ${this.currentFilters.activeBrand === brand ? 'selected' : ''}" data-brand="${brand}">
                    ${brand} <span class="filter-count">${brandCounts[brand] || 0}</span>
                </div>`
            ).join('')}
        `;

        // Add event listeners to brand options
        brandOptions.querySelectorAll('.dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleBrandClick(e));
        });
    }

    handleBrandClick(e) {
        const brandValue = e.target.dataset.brand;
        
        // Update selected brand
        this.currentFilters.activeBrand = brandValue;
        this.currentFilters.activeSubBrand = 'all'; // Reset sub-brand
        
        // Update UI
        this.wrapper.querySelector('#brandSelected').textContent = brandValue === 'all' ? 'All Brands' : brandValue;
        this.wrapper.querySelector('#brandDropdown').classList.remove('open');
        
        // Update dependent filters
        this.setupBrandDropdown();
        this.setupFileTypeDropdown();
        this.setupSubBrandPills();
        
        this.applyFilters();
    }

    setupFileTypeDropdown() {
        const fileTypeOptions = this.wrapper.querySelector('#fileTypeOptions');
        if (!fileTypeOptions) return;

        // Filter file types based on current filters
        const filteredCatalogs = this.getFilteredCatalogs();
        this.availableFileTypes = [...new Set(filteredCatalogs.map(cat => cat.file_type).filter(Boolean))];
        const fileTypeCounts = this.getFilterCounts('file_type', filteredCatalogs);

        fileTypeOptions.innerHTML = `
            <div class="dropdown-option ${this.currentFilters.file_type === 'all' ? 'selected' : ''}" data-filetype="all">
                All Types <span class="filter-count">${filteredCatalogs.length}</span>
            </div>
            ${this.availableFileTypes.map(type => 
                `<div class="dropdown-option ${this.currentFilters.file_type === type ? 'selected' : ''}" data-filetype="${type}">
                    ${type} <span class="filter-count">${fileTypeCounts[type] || 0}</span>
                </div>`
            ).join('')}
        `;

        // Add event listeners to file type options
        fileTypeOptions.querySelectorAll('.dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleFileTypeClick(e));
        });
    }

    handleFileTypeClick(e) {
        const fileTypeValue = e.target.dataset.filetype;
        
        // Update selected file type
        this.currentFilters.file_type = fileTypeValue;
        
        // Update UI
        this.wrapper.querySelector('#fileTypeSelected').textContent = fileTypeValue === 'all' ? 'All Types' : fileTypeValue;
        this.wrapper.querySelector('#fileTypeDropdown').classList.remove('open');
        
        // Update dependent filters
        this.setupFileTypeDropdown();
        
        this.applyFilters();
    }

    setupSubBrandPills() {
        const subbrandSection = this.wrapper.querySelector('#subbrandSection');
        const subbrandPills = this.wrapper.querySelector('#subbrandPills');
        
        if (!subbrandSection || !subbrandPills) return;

        // Show sub-brands only if a specific brand is selected
        if (this.currentFilters.activeBrand === 'all') {
            subbrandSection.classList.remove('show');
            return;
        }

        // Filter sub-brands based on selected brand
        const filteredCatalogs = this.getFilteredCatalogs();
        this.availableSubBrands = [...new Set(filteredCatalogs.map(cat => cat.sub_brand).filter(Boolean))];
        
        if (this.availableSubBrands.length === 0) {
            subbrandSection.classList.remove('show');
            return;
        }

        const subBrandCounts = this.getFilterCounts('sub_brand', filteredCatalogs);

        subbrandPills.innerHTML = `
            <div class="subbrand-pill ${this.currentFilters.activeSubBrand === 'all' ? 'active' : ''}" data-subbrand="all">
                All Sub-brands <span class="filter-count">${filteredCatalogs.length}</span>
            </div>
            ${this.availableSubBrands.map(subBrand => 
                `<div class="subbrand-pill ${this.currentFilters.activeSubBrand === subBrand ? 'active' : ''}" data-subbrand="${subBrand}">
                    ${subBrand} <span class="filter-count">${subBrandCounts[subBrand] || 0}</span>
                </div>`
            ).join('')}
        `;

        // Add event listeners to sub-brand pills
        subbrandPills.querySelectorAll('.subbrand-pill').forEach(pill => {
            pill.addEventListener('click', (e) => this.handleSubBrandClick(e));
        });

        subbrandSection.classList.add('show');
    }

    handleSubBrandClick(e) {
        const subBrandValue = e.target.dataset.subbrand;
        
        // Update active sub-brand pill
        this.wrapper.querySelectorAll('.subbrand-pill').forEach(pill => {
            pill.classList.remove('active');
        });
        e.target.classList.add('active');
        
        this.currentFilters.activeSubBrand = subBrandValue;
        this.applyFilters();
    }

    getFilterCounts(filterType, catalogs = this.allCatalogs) {
        const counts = {};
        catalogs.forEach(catalog => {
            const value = catalog[filterType];
            if (value) {
                counts[value] = (counts[value] || 0) + 1;
            }
        });
        return counts;
    }

    getFilteredCatalogs() {
        return this.allCatalogs.filter(catalog => {
            // Brand filter
            if (this.currentFilters.activeBrand !== 'all' && catalog.brand !== this.currentFilters.activeBrand) {
                return false;
            }

            // Sub-brand filter
            if (this.currentFilters.activeSubBrand !== 'all' && catalog.sub_brand !== this.currentFilters.activeSubBrand) {
                return false;
            }

            // File type filter
            if (this.currentFilters.file_type !== 'all' && catalog.file_type !== this.currentFilters.file_type) {
                return false;
            }

            return true;
        });
    }

    async fetchCatalogs() {
        try {
            console.log('Fetching catalogs...');
            const response = await frappe.call({
                method: 'prastara_custom.controller.variant_pricing.get_catalogs_and_profiles',
                callback: (result) => {
                    console.log('Callback received:', result);
                    if (result.message && result.message.status === 'success') {
                        this.allCatalogs = result.message.data;
                        console.log('Using API data:', this.allCatalogs.length, 'catalogs');
                    } else {
                        console.log('Using sample data');
                        this.allCatalogs = this.getSampleData();
                        console.log('Sample data loaded:', this.allCatalogs.length, 'catalogs');
                    }
                    
                    this.setupBrandDropdown();
                    this.setupFileTypeDropdown();
                    this.setupSubBrandPills();
                    this.applyFilters();
                }
            });
        } catch (error) {
            console.error('Error fetching catalogs:', error);
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: __('Failed to load catalogs. Using sample data.')
            });
            this.allCatalogs = this.getSampleData();
            console.log('Error fallback - sample data loaded:', this.allCatalogs.length, 'catalogs');
            
            this.setupBrandDropdown();
            this.setupFileTypeDropdown();
            this.setupSubBrandPills();
            this.applyFilters();
        }
    }

    getSampleData() {
        return [
            {
                name: "Premium LED Solutions 2024",
                creation: "2024-06-20 14:55:12.920598",
                modified: "2024-06-25 16:20:19.989995",
                file_name: "Premium LED Solutions Catalog",
                cover_image: "/files/led-premium.jpg",
                brand: "LUXLED",
                sub_brand: "Premium Series",
                company: "LED Innovations Inc.",
                description: "High-end LED lighting solutions for commercial and residential use.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Catalog"
            },
            {
                name: "Smart Lighting Systems",
                creation: "2024-06-15 18:21:40.701118",
                modified: "2024-06-18 15:16:11.105170",
                file_name: "Smart Home Lighting Guide",
                cover_image: "/files/smart-lighting.jpg",
                brand: "SMARTLUX",
                sub_brand: "IoT Connect",
                company: "Intelligent Lighting Corp.",
                description: "Intelligent lighting systems with IoT integration and mobile control.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Technical Guide"
            },
            {
                name: "Industrial Lighting Portfolio",
                creation: "2024-06-10 10:30:00.000000",
                modified: "2024-06-12 14:45:00.000000",
                file_name: "Heavy Duty Industrial Lighting",
                cover_image: "",
                brand: "INDUSTRIAL PRO",
                sub_brand: "Heavy Duty",
                company: "ProLight Manufacturing",
                description: "Robust industrial lighting solutions for harsh environments.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Portfolio"
            },
            {
                name: "Architectural Lighting Design",
                creation: "2024-06-05 09:15:00.000000",
                modified: "2024-06-08 11:30:00.000000",
                file_name: "Modern Architecture Lighting",
                cover_image: "/files/architectural.jpg",
                brand: "ARCHILUX",
                sub_brand: "Modern Design",
                company: "Design Lighting Studios",
                description: "Contemporary architectural lighting for modern buildings and spaces.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Catalog"
            },
            {
                name: "Outdoor Lighting Excellence",
                creation: "2024-06-01 16:20:00.000000",
                modified: "2024-06-03 18:45:00.000000",
                file_name: "Weatherproof Outdoor Solutions",
                cover_image: "",
                brand: "OUTDOOR MASTER",
                sub_brand: "Weatherproof",
                company: "Exterior Lighting Co.",
                description: "Durable outdoor lighting solutions resistant to all weather conditions.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Brochure"
            },
            {
                name: "Energy Efficient Solutions",
                creation: "2024-05-28 12:00:00.000000",
                modified: "2024-05-30 14:30:00.000000",
                file_name: "Green Energy LED Systems",
                cover_image: "/files/energy-efficient.jpg",
                brand: "ECOLIGHT",
                sub_brand: "Green Energy",
                company: "Sustainable Lighting Ltd.",
                description: "Eco-friendly LED lighting systems with maximum energy efficiency.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Catalog"
            },
            {
                name: "Commercial Office Solutions",
                creation: "2024-05-25 14:30:00.000000",
                modified: "2024-05-28 16:15:00.000000",
                file_name: "Professional Office Lighting",
                cover_image: "/files/office-lighting.jpg",
                brand: "OFFICELUX",
                sub_brand: "Professional",
                company: "Professional Lighting Corp.",
                description: "Professional office lighting solutions for enhanced productivity.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Portfolio"
            },
            {
                name: "Residential Lighting Collection",
                creation: "2024-05-20 11:45:00.000000",
                modified: "2024-05-23 13:20:00.000000",
                file_name: "Home Lighting Solutions",
                cover_image: "",
                brand: "HOMELUX",
                sub_brand: "Residential",
                company: "Residential Lighting Inc.",
                description: "Comprehensive home lighting solutions for all room types.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Brochure"
            },
            {
                name: "LUXLED Basic Series",
                creation: "2024-05-15 11:45:00.000000",
                modified: "2024-05-18 13:20:00.000000",
                file_name: "Basic LED Solutions",
                cover_image: "",
                brand: "LUXLED",
                sub_brand: "Basic Series",
                company: "LED Innovations Inc.",
                description: "Affordable LED lighting solutions for budget-conscious customers.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Catalog"
            },
            {
                name: "SMARTLUX Home Automation",
                creation: "2024-05-10 11:45:00.000000",
                modified: "2024-05-13 13:20:00.000000",
                file_name: "Home Automation Lighting",
                cover_image: "",
                brand: "SMARTLUX",
                sub_brand: "Home Auto",
                company: "Intelligent Lighting Corp.",
                description: "Complete home automation lighting systems with voice control.",
                data_6: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                file_type: "Technical Guide"
            }
        ];
    }

    applyFilters() {
        this.filteredCatalogs = this.allCatalogs.filter(catalog => {
            // Search filter
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                const searchMatch = 
                    catalog.file_name.toLowerCase().includes(searchTerm) ||
                    (catalog.brand && catalog.brand.toLowerCase().includes(searchTerm)) ||
                    (catalog.sub_brand && catalog.sub_brand.toLowerCase().includes(searchTerm)) ||
                    (catalog.company && catalog.company.toLowerCase().includes(searchTerm)) ||
                    (catalog.file_type && catalog.file_type.toLowerCase().includes(searchTerm)) ||
                    (catalog.description && catalog.description.toLowerCase().includes(searchTerm));
                
                if (!searchMatch) return false;
            }

            // Brand filter
            if (this.currentFilters.activeBrand !== 'all' && catalog.brand !== this.currentFilters.activeBrand) {
                return false;
            }

            // Sub-brand filter
            if (this.currentFilters.activeSubBrand !== 'all' && catalog.sub_brand !== this.currentFilters.activeSubBrand) {
                return false;
            }

            // File type filter
            if (this.currentFilters.file_type !== 'all' && catalog.file_type !== this.currentFilters.file_type) {
                return false;
            }

            return true;
        });

        this.renderCatalogs();
        this.updateResultsCounter();
    }

    updateResultsCounter() {
        const counter = this.wrapper.querySelector('#resultsCounter');
        if (!counter) return;

        const total = this.allCatalogs.length;
        const filtered = this.filteredCatalogs.length;

        if (filtered === total) {
            counter.textContent = `Showing all ${total} catalogs`;
        } else {
            counter.textContent = `Showing ${filtered} of ${total} catalogs`;
        }
    }

    renderCatalogs() {
        const grid = this.wrapper.querySelector('#catalogGrid');
        if (!grid) {
            console.error('Catalog grid not found');
            return;
        }

        if (this.filteredCatalogs.length === 0) {
            grid.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📚</div>
                    <h3>No Catalogs Found</h3>
                    <p>Try adjusting your search terms or filters to discover more catalogs</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.filteredCatalogs.map((catalog, index) => `
            <div class="catalog-card" onclick="window.catalogGallery.openCatalog('${catalog.data_6}')" style="animation-delay: ${Math.min(index * 0.05, 0.5)}s">
                <div class="card-image-container">
                    ${catalog.cover_image ? 
                        `<img src="${catalog.cover_image}" alt="${catalog.file_name}" class="card-image" onerror="this.style.display='none'">` : 
                        ''
                    }
                    <div class="image-fallback" style="${catalog.cover_image ? 'display: none;' : ''}">📄</div>
                    <div class="card-overlay">
                        ${catalog.description ? `<div class="overlay-text">${catalog.description}</div>` : ''}
                        <div class="overlay-preview">👁 Preview Catalog →</div>
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${catalog.file_name}</h3>
                    
                    <div class="card-info">
                        <div class="info-row">
                            <span class="info-label">Brand:</span>
                            <span class="info-value">${catalog.brand || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Type:</span>
                            <span class="info-value">${catalog.file_type || 'Catalog'}</span>
                        </div>
                    </div>
                    
                    <button class="preview-catalog-btn">
                        <span class="eye-icon">👁</span>
                        <span>Preview</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getCompanySocialData() {
        // Static social media data - only 3 companies
        return {
            "Prastara Decor": {
                website: "https://prastaradecor.com/",
                instagram: "https://www.instagram.com/prastaradecor/",
                facebook: "https://www.facebook.com/prastaradecors",
                linkedin: "https://ae.linkedin.com/company/prastaradecor",
                tiktok: "https://tiktok.com/",
                twitter: "https://twitter.com/",
                youtube: "https://youtube.com/",
                whatsapp: "https://wa.me/971501234567"
            }
            
        };
    }

    getSocialMediaIcons() {
        return {
            website: { 
                icon: "https://cdn-icons-png.flaticon.com/128/10453/10453141.png", 
                label: "Website" 
            },
            instagram: { 
                icon: "https://cdn-icons-png.flaticon.com/512/4138/4138124.png", 
                label: "Instagram" 
            },
            facebook: { 
                icon: "https://cdn-icons-png.flaticon.com/128/5968/5968764.png", 
                label: "Facebook" 
            },
            linkedin: { 
                icon: "https://cdn-icons-png.flaticon.com/128/4494/4494497.png", 
                label: "LinkedIn" 
            },
            tiktok: { 
                icon: "https://cdn-icons-png.flaticon.com/128/2504/2504942.png", 
                label: "TikTok" 
            },
            twitter: { 
                icon: "https://cdn-icons-png.flaticon.com/128/5968/5968830.png", 
                label: "Twitter" 
            },
            youtube: { 
                icon: "https://cdn-icons-png.flaticon.com/128/3670/3670147.png", 
                label: "YouTube" 
            },
            whatsapp: { 
                icon: "https://cdn-icons-png.flaticon.com/128/733/733585.png", 
                label: "WhatsApp" 
            }
        };
    }

    populateModalCompanies() {
        const modalCompanyFilter = this.wrapper.querySelector('#modalCompanyFilter');
        const companiesGrid = this.wrapper.querySelector('#companiesGrid');
        
        if (!modalCompanyFilter || !companiesGrid) return;

        // Get static social media companies (independent of API data)
        const staticCompanies = Object.keys(this.getCompanySocialData());
        
        console.log('Static Companies for Modal:', staticCompanies);

        // Populate filter dropdown with static companies
        modalCompanyFilter.innerHTML = `
            <option value="all">All Companies (${staticCompanies.length})</option>
            ${staticCompanies.map(company => 
                `<option value="${company}">${company}</option>`
            ).join('')}
        `;

        // Display all companies with their social media links
        this.filterModalCompanies('all');
    }

    filterModalCompanies(filterValue) {
        const companiesGrid = this.wrapper.querySelector('#companiesGrid');
        if (!companiesGrid) return;

        const socialData = this.getCompanySocialData();
        const socialIcons = this.getSocialMediaIcons();
        
        // Use static companies list (independent of API data)
        const staticCompanies = Object.keys(socialData);
        const companiesToShow = filterValue === 'all' ? staticCompanies : [filterValue];

        console.log('Social Data:', socialData);
        console.log('Companies to Show:', companiesToShow);

        companiesGrid.innerHTML = companiesToShow.map(company => {
            const social = socialData[company] || {};
            console.log(`Social links for ${company}:`, social);
            
            const socialLinksHtml = Object.entries(socialIcons).map(([platform, iconData]) => {
                if (social[platform]) {
                    return `
                        <a href="${social[platform]}" target="_blank" class="social-link ${platform}" title="${iconData.label}">
                            <div class="social-icon">
                                <img src="${iconData.icon}" alt="${iconData.label}" class="icon-img">
                            </div>
                            <div class="social-label">${iconData.label}</div>
                        </a>
                    `;
                }
                return '';
            }).join('');

            // Count available social links
            const socialLinkCount = Object.keys(social).length;

            // If no social links, show a placeholder
            const finalSocialLinks = socialLinkCount > 0 ? socialLinksHtml : `
                <div class="no-social-links">
                    <div class="no-social-icon">🔗</div>
                    <div class="no-social-text">No social media links available for this company</div>
                </div>
            `;

            return `
                <div class="company-card">
                    <h4 class="company-name">${company}</h4>
                    <div class="company-social-count">📊 ${socialLinkCount} social platform${socialLinkCount !== 1 ? 's' : ''}</div>
                    <div class="social-links">
                        ${finalSocialLinks}
                    </div>
                </div>
            `;
        }).join('');
    }

    openCatalog(pdfUrl) {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        } else {
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: __('Catalog URL not available.')
            });
        }
    }
}

// Make the gallery globally accessible for onclick handlers
window.catalogGallery = null;
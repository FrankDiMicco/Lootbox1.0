/**
 * Navigation Drawer Component
 * Mobile-first slide-out navigation with accessibility features
 */

class NavigationDrawer {
    constructor() {
        // Elements
        this.drawer = document.getElementById('navDrawer');
        this.overlay = document.querySelector('[data-drawer-overlay]');
        this.trigger = document.querySelector('[data-drawer-trigger]') || document.querySelector('.hamburger-menu');
        this.closeBtn = document.querySelector('[data-drawer-close]');
        this.navItems = document.querySelectorAll('.nav-item');
        
        // State
        this.isOpen = false;
        this.focusableElements = [];
        this.firstFocusableElement = null;
        this.lastFocusableElement = null;
        this.previousActiveElement = null;
        
        // Touch handling
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.touchStartTime = 0;
        
        // Initialize
        this.init();
    }
    
    init() {
        console.log('NavigationDrawer initializing...');
        console.log('Drawer element:', this.drawer);
        console.log('Trigger element:', this.trigger);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup focus trap elements
        this.setupFocusTrap();
        
        // Setup nav item active states
        this.setupNavItems();
        
        // Check for saved preferences
        this.restoreState();
        
        console.log('NavigationDrawer initialized');
    }
    
    setupEventListeners() {
        // Hamburger trigger
        if (this.trigger) {
            this.trigger.addEventListener('click', () => {
                console.log('Hamburger clicked');
                this.toggleDrawer();
            });
        } else {
            console.error('Trigger button not found');
        }
        
        // Close button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeDrawer());
        }
        
        // Overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeDrawer());
        }
        
        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDrawer();
            }
        });
        
        // Touch events for swipe
        if (this.drawer) {
            this.drawer.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
            this.drawer.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            this.drawer.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        }
        
        // Window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && this.isOpen) {
                // Optional: close drawer on desktop resize
                // this.closeDrawer();
            }
        });
    }
    
    setupFocusTrap() {
        if (!this.drawer) return;
        
        // Get all focusable elements
        const focusableSelectors = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ];
        
        this.focusableElements = this.drawer.querySelectorAll(focusableSelectors.join(','));
        
        if (this.focusableElements.length > 0) {
            this.firstFocusableElement = this.focusableElements[0];
            this.lastFocusableElement = this.focusableElements[this.focusableElements.length - 1];
        }
        
        // Setup focus trap
        this.drawer.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            
            if (e.key === 'Tab') {
                // Shift + Tab
                if (e.shiftKey) {
                    if (document.activeElement === this.firstFocusableElement) {
                        e.preventDefault();
                        this.lastFocusableElement.focus();
                    }
                }
                // Tab
                else {
                    if (document.activeElement === this.lastFocusableElement) {
                        e.preventDefault();
                        this.firstFocusableElement.focus();
                    }
                }
            }
        });
    }
    
    setupNavItems() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Remove active class from all items
                this.navItems.forEach(navItem => navItem.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Save state
                const page = item.dataset.page;
                if (page) {
                    localStorage.setItem('drawer-active-page', page);
                }
                
                // Optional: close drawer on mobile after selection
                if (window.innerWidth < 768) {
                    setTimeout(() => this.closeDrawer(), 300);
                }
            });
        });
    }
    
    // Touch handling for swipe gestures
    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartTime = Date.now();
    }
    
    handleTouchMove(e) {
        if (!this.isOpen) return;
        
        const currentX = e.touches[0].clientX;
        const diffX = currentX - this.touchStartX;
        
        // If swiping right (to close)
        if (diffX > 0) {
            // Prevent scrolling
            e.preventDefault();
            
            // Optional: show visual feedback
            const progress = Math.min(diffX / 100, 1);
            this.drawer.style.transform = `translateX(${-diffX}px)`;
            this.overlay.style.opacity = 1 - (progress * 0.5);
        }
    }
    
    handleTouchEnd(e) {
        if (!this.isOpen) return;
        
        this.touchEndX = e.changedTouches[0].clientX;
        const diffX = this.touchEndX - this.touchStartX;
        const timeDiff = Date.now() - this.touchStartTime;
        
        // Reset styles
        this.drawer.style.transform = '';
        this.overlay.style.opacity = '';
        
        // Check for swipe right (close gesture)
        // Require at least 50px swipe or fast swipe
        if (diffX > 50 || (diffX > 30 && timeDiff < 300)) {
            this.closeDrawer();
        }
    }
    
    // Public API methods
    openDrawer() {
        console.log('openDrawer called, isOpen:', this.isOpen);
        if (this.isOpen) return;
        
        this.isOpen = true;
        
        // Store previous focus
        this.previousActiveElement = document.activeElement;
        
        // Update UI
        console.log('Adding open class to drawer:', this.drawer);
        this.drawer?.classList.add('open');
        this.overlay?.classList.add('active');
        this.trigger?.setAttribute('aria-expanded', 'true');
        document.body.classList.add('drawer-open');
        
        // Set focus to first focusable element
        setTimeout(() => {
            if (this.firstFocusableElement) {
                this.firstFocusableElement.focus();
            }
        }, 100);
        
        // Announce to screen readers
        this.announceToScreenReader('Navigation menu opened');
        
        // Dispatch custom event
        this.drawer?.dispatchEvent(new CustomEvent('drawer:open'));
    }
    
    closeDrawer() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        // Update UI
        this.drawer?.classList.remove('open');
        this.overlay?.classList.remove('active');
        this.trigger?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        
        // Restore focus
        if (this.previousActiveElement) {
            this.previousActiveElement.focus();
        }
        
        // Announce to screen readers
        this.announceToScreenReader('Navigation menu closed');
        
        // Dispatch custom event
        this.drawer?.dispatchEvent(new CustomEvent('drawer:close'));
    }
    
    toggleDrawer() {
        if (this.isOpen) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }
    
    // Utility methods
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
    
    restoreState() {
        // Restore active page
        const activePage = localStorage.getItem('drawer-active-page');
        if (activePage) {
            const activeItem = document.querySelector(`[data-page="${activePage}"]`);
            if (activeItem) {
                this.navItems.forEach(item => item.classList.remove('active'));
                activeItem.classList.add('active');
            }
        }
    }
    
    // Public method to set active page programmatically
    setActivePage(pageName) {
        const item = document.querySelector(`[data-page="${pageName}"]`);
        if (item) {
            this.navItems.forEach(navItem => navItem.classList.remove('active'));
            item.classList.add('active');
            localStorage.setItem('drawer-active-page', pageName);
        }
    }
    
    // Clean up method
    destroy() {
        // Remove event listeners
        this.trigger?.removeEventListener('click', () => this.toggleDrawer());
        this.closeBtn?.removeEventListener('click', () => this.closeDrawer());
        this.overlay?.removeEventListener('click', () => this.closeDrawer());
        
        // Clean up state
        document.body.classList.remove('drawer-open');
        this.drawer?.classList.remove('open');
        this.overlay?.classList.remove('active');
    }
}

// Initialize drawer when DOM is ready
let navigationDrawer = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        navigationDrawer = new NavigationDrawer();
    });
} else {
    navigationDrawer = new NavigationDrawer();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationDrawer;
}

// Global API for integration
window.NavigationDrawerAPI = {
    open: () => navigationDrawer?.openDrawer(),
    close: () => navigationDrawer?.closeDrawer(),
    toggle: () => navigationDrawer?.toggleDrawer(),
    setActivePage: (page) => navigationDrawer?.setActivePage(page),
    isOpen: () => navigationDrawer?.isOpen || false,
    getInstance: () => navigationDrawer
};
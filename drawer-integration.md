# Navigation Drawer Integration Guide

## Quick Start

### 1. Add to your existing HTML (index.html)

Add this to your HTML file, replacing the existing hamburger button:

```html
<!-- Add drawer CSS in <head> -->
<link rel="stylesheet" href="drawer.css">

<!-- Replace existing hamburger with this structure -->
<!-- Navigation Drawer -->
<div class="nav-drawer-overlay" data-drawer-overlay></div>

<nav 
    id="navDrawer"
    class="nav-drawer"
    role="dialog"
    aria-modal="true"
    aria-label="Navigation menu">
    
    <!-- Copy drawer content from drawer.html -->
    <!-- ... drawer header, profile, sections, footer ... -->
</nav>

<!-- Add drawer JS before closing </body> -->
<script src="drawer.js"></script>
```

### 2. Integration with existing App.js

Add these methods to your App class:

```javascript
// In App.js constructor
constructor() {
    // ... existing code ...
    
    // Navigation drawer reference
    this.drawer = null;
}

// In App.js initialize method
async initialize() {
    // ... existing code ...
    
    // Initialize navigation drawer
    this.initializeDrawer();
}

// New method in App.js
initializeDrawer() {
    // Wait for drawer to be ready
    if (window.NavigationDrawerAPI) {
        this.drawer = window.NavigationDrawerAPI;
        
        // Update active page based on current view
        this.updateDrawerActivePage();
        
        // Listen for drawer navigation events
        document.getElementById('navDrawer')?.addEventListener('drawer:open', () => {
            console.log('Drawer opened');
        });
        
        document.getElementById('navDrawer')?.addEventListener('drawer:close', () => {
            console.log('Drawer closed');
        });
    }
}

// Update drawer when view changes
updateDrawerActivePage() {
    if (!this.drawer) return;
    
    // Map your app states to drawer pages
    const viewToPage = {
        'list': 'dashboard',
        'lootbox': 'lootboxes',
        'shared': 'shared',
        'create': 'create'
    };
    
    const currentPage = viewToPage[this.state.currentView] || 'dashboard';
    this.drawer.setActivePage(currentPage);
}

// Handle existing hamburger click (if keeping old button)
setupEventDelegation() {
    // ... existing code ...
    
    // Update hamburger menu handler
    const hamburger = document.querySelector('.hamburger-menu');
    if (hamburger) {
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.drawer) {
                this.drawer.toggle();
            }
        });
    }
}
```

### 3. Handle Navigation Actions

Add handlers for drawer navigation items:

```javascript
// In your handleAction method or setupEventDelegation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        switch(page) {
            case 'dashboard':
                this.controllers.ui.showListView();
                this.controllers.ui.setFilter('all');
                break;
            case 'lootboxes':
                this.controllers.ui.showListView();
                this.controllers.ui.setFilter('all');
                break;
            case 'shared':
                this.controllers.ui.showListView();
                this.controllers.ui.setFilter('shared');
                break;
            case 'create':
                this.controllers.ui.showCreateModal();
                break;
            case 'statistics':
                // Add statistics view handler
                break;
            case 'preferences':
                // Add preferences handler
                break;
            case 'account':
                // Add account handler
                break;
            case 'help':
                // Add help handler
                break;
        }
        
        // Close drawer on mobile after navigation
        if (window.innerWidth < 768) {
            this.drawer?.close();
        }
    });
});
```

## API Reference

### Global Methods

```javascript
// Open the drawer
window.NavigationDrawerAPI.open();

// Close the drawer
window.NavigationDrawerAPI.close();

// Toggle the drawer
window.NavigationDrawerAPI.toggle();

// Set active navigation item
window.NavigationDrawerAPI.setActivePage('dashboard');

// Check if drawer is open
const isOpen = window.NavigationDrawerAPI.isOpen();

// Get drawer instance
const drawer = window.NavigationDrawerAPI.getInstance();
```

### Custom Events

```javascript
// Listen for drawer open
document.getElementById('navDrawer').addEventListener('drawer:open', (e) => {
    console.log('Drawer opened');
});

// Listen for drawer close
document.getElementById('navDrawer').addEventListener('drawer:close', (e) => {
    console.log('Drawer closed');
});
```

## Customization

### Update User Info

```javascript
// Update profile section
document.querySelector('.profile-name').textContent = userName;
document.querySelector('.profile-status').textContent = userStatus;
document.querySelector('.profile-avatar img').src = userAvatar;

// Update footer user info
document.querySelector('.footer-name').textContent = userName;
document.querySelector('.footer-status').textContent = isSignedIn ? 'Signed in' : 'Not signed in';
```

### Add/Remove Navigation Items

```javascript
// Add a new navigation item
const navList = document.querySelector('.nav-section .nav-list');
const newItem = document.createElement('li');
newItem.innerHTML = `
    <a href="#" class="nav-item" data-page="custom">
        <svg class="nav-icon">...</svg>
        <span>Custom Page</span>
    </a>
`;
navList.appendChild(newItem);
```

### Update Badge Count

```javascript
// Update lootbox count badge
const lootboxItem = document.querySelector('[data-page="lootboxes"] .nav-badge');
if (lootboxItem) {
    lootboxItem.textContent = lootboxCount;
}
```

## Accessibility Features

- **Focus Management**: Automatically traps focus within drawer when open
- **Keyboard Navigation**: Full keyboard support with Tab/Shift+Tab cycling
- **Screen Reader Support**: Proper ARIA attributes and live announcements
- **ESC Key**: Closes drawer
- **Reduced Motion**: Respects user's motion preferences

## Mobile Features

- **Touch Gestures**: Swipe right to close
- **Responsive**: Adapts to screen size
- **Body Scroll Lock**: Prevents background scrolling when open
- **Smooth Animations**: Hardware-accelerated CSS transitions

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Graceful degradation for older browsers

## Troubleshooting

### Drawer not opening
- Check if `drawer.js` is loaded after the DOM
- Verify element IDs match (`navDrawer`, etc.)
- Check console for errors

### Focus trap not working
- Ensure focusable elements have proper attributes
- Check if elements are not disabled
- Verify tabindex values

### Swipe not working
- Touch events require `{ passive: true }` for performance
- Check if touch events are supported on device
- Verify no other touch handlers are interfering
import FirebaseService from '../services/FirebaseService.js';
import StorageService from '../services/StorageService.js';
import LootboxController from '../controllers/LootboxController.js';
import GroupBoxController from '../controllers/GroupBoxController.js';

/**
 * Main application coordinator
 * Handles initialization, service coordination, and high-level orchestration
 */
class App {
    constructor() {
        // Application state
        this.isInitialized = false;
        this.currentView = 'list';
        this.currentLootbox = null;
        this.currentFilter = 'all';
        this.isOnCooldown = false;
        
        // Services and controllers - will be initialized later
        this.firebaseService = null;
        this.storageService = null;
        this.lootboxController = null;
        this.groupBoxController = null;
        
        // UI state
        this.sessionHistory = [];
        this.isOrganizerReadonly = false;
        this.editingIndex = -1;
        this.selectedChestPath = null;
        this.popupTimeout = null;
        
        // Start initialization
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('Initializing Lootbox Creator...');
            
            // Wait for dependencies to be available
            await this.waitForDependencies();
            
            // Initialize services
            await this.initializeServices();
            
            // Initialize controllers
            await this.initializeControllers();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Set up URL handlers
            this.setupUrlHandlers();
            
            // Mark as initialized
            this.isInitialized = true;
            
            // Trigger initial render
            this.render();
            
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showErrorState(error.message);
        }
    }

    /**
     * Wait for required dependencies to be available
     */
    async waitForDependencies() {
        // Wait for UI extensions to load
        while (!window.UIRenderer || !window.GroupBoxExtension) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Extend this app instance with UI methods for backward compatibility
        Object.assign(this, window.UIRenderer);
        Object.assign(this, window.GroupBoxExtension);
    }

    /**
     * Initialize all services
     */
    async initializeServices() {
        console.log('Initializing services...');
        
        // Initialize storage service
        this.storageService = new StorageService('lootbox_');
        
        // Initialize Firebase service
        this.firebaseService = new FirebaseService();
        await this.firebaseService.initialize();
        
        console.log('Services initialized');
    }

    /**
     * Initialize all controllers
     */
    async initializeControllers() {
        console.log('Initializing controllers...');
        
        // Initialize controllers with their dependencies
        this.lootboxController = new LootboxController(this.firebaseService, this.storageService);
        this.groupBoxController = new GroupBoxController(this.firebaseService, this.storageService);
        
        // Initialize controllers
        await this.lootboxController.initialize();
        await this.groupBoxController.initialize();
        
        console.log('Controllers initialized');
    }

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Modal checkbox listeners
        const unlimitedTriesCheckbox = document.getElementById('unlimitedTries');
        if (unlimitedTriesCheckbox) {
            unlimitedTriesCheckbox.addEventListener('change', (e) => {
                const maxTriesGroup = document.getElementById('maxTriesGroup');
                if (maxTriesGroup) {
                    maxTriesGroup.style.display = e.target.checked ? 'none' : 'block';
                }
            });
        }

        // Modal close on backdrop click
        const editModal = document.getElementById('editModal');
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target.id === 'editModal') {
                    this.closeModal();
                }
            });
        }

        // Browser back/forward navigation
        window.addEventListener('popstate', () => {
            if (this.currentView !== 'list') {
                this.showListView();
            }
        });
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        console.log('Loading initial data...');
        
        // Controllers handle their own data loading during initialization
        // Just need to update the UI references for backward compatibility
        this.lootboxes = this.lootboxController.getAllLootboxes();
        this.participatedGroupBoxes = this.groupBoxController.getAllGroupBoxes();
        this.communityHistory = this.groupBoxController.getCommunityHistory();
        
        // Make community history globally accessible for GroupBoxCard
        if (window.modernApp) {
            window.modernApp.communityHistory = this.communityHistory;
        }
        
        console.log(`Loaded ${this.lootboxes.length} lootboxes and ${this.participatedGroupBoxes.length} group boxes`);
    }

    /**
     * Set up URL parameter handlers
     */
    setupUrlHandlers() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedData = urlParams.get('share');
        const groupBoxId = urlParams.get('groupbox');

        if (sharedData) {
            this.handleSharedLootbox(sharedData);
        }

        if (groupBoxId) {
            this.handleGroupBoxUrl(groupBoxId);
        }
    }

    /**
     * Handle shared lootbox URL
     */
    async handleSharedLootbox(sharedData) {
        try {
            const lootboxData = JSON.parse(decodeURIComponent(sharedData));
            const result = await this.lootboxController.importSharedLootbox(lootboxData);
            
            if (result.success) {
                this.showSuccessMessage(`Successfully imported "${result.lootbox.name}"`);
                this.refreshData();
            } else if (result.duplicate) {
                this.showSuccessMessage(result.errors[0], true);
            } else {
                this.showSuccessMessage('Error importing lootbox', true);
            }
        } catch (error) {
            console.error('Error handling shared lootbox:', error);
            this.showSuccessMessage('Error importing lootbox. Invalid share link.', true);
        }
        
        // Clean up URL
        this.cleanupUrl();
    }

    /**
     * Handle group box URL
     */
    async handleGroupBoxUrl(groupBoxId) {
        try {
            const result = await this.groupBoxController.joinGroupBox(groupBoxId);
            
            if (result.success) {
                if (result.alreadyJoined) {
                    // Open existing group box
                    this.openGroupBox(result.groupBox);
                } else {
                    // Show join success message
                    this.showSuccessMessage(`Joined "${result.groupBox.groupBoxName}"`);
                    this.refreshData();
                }
            } else {
                this.showSuccessMessage('Error joining group box', true);
            }
        } catch (error) {
            console.error('Error handling group box URL:', error);
            this.showSuccessMessage('Error joining group box', true);
        }
        
        // Clean up URL
        this.cleanupUrl();
    }

    /**
     * Set the current filter and refresh display
     */
    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    }

    /**
     * Show list view
     */
    showListView() {
        this.currentLootbox = null;
        this.currentView = 'list';
        document.getElementById('lootboxView').classList.add('hidden');
        document.getElementById('listView').classList.remove('hidden');
        this.render();
    }

    /**
     * Refresh data from controllers
     */
    async refreshData() {
        this.lootboxes = this.lootboxController.getAllLootboxes();
        this.participatedGroupBoxes = this.groupBoxController.getAllGroupBoxes();
        this.communityHistory = this.groupBoxController.getCommunityHistory();
        
        // Make community history globally accessible for GroupBoxCard
        if (window.modernApp) {
            window.modernApp.communityHistory = this.communityHistory;
        }
        
        this.render();
    }

    /**
     * Render the current view
     */
    render() {
        if (!this.isInitialized) {
            return;
        }

        // Always update community history reference for GroupBoxCard
        this.communityHistory = this.groupBoxController.getCommunityHistory();
        if (window.modernApp) {
            window.modernApp.communityHistory = this.communityHistory;
        }

        if (this.currentView === 'list') {
            this.renderLootboxes();
        } else if (this.currentView === 'lootbox') {
            this.renderLootboxView();
            this.updateSessionDisplay();
        }
    }

    /**
     * Open a group box
     */
    openGroupBox(groupBox) {
        this.currentLootbox = groupBox;
        this.currentView = 'lootbox';
        this.sessionHistory = [];
        this.isOrganizerReadonly = groupBox.isOrganizerOnly || false;
        
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('lootboxView').classList.remove('hidden');
        
        this.render();
    }

    /**
     * Clean up URL parameters
     */
    cleanupUrl() {
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }

    /**
     * Show error state
     */
    showErrorState(message) {
        const container = document.getElementById('lootboxGrid') || document.body;
        container.innerHTML = `
            <div class="error-state">
                <h2>Application Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()">Reload Application</button>
            </div>
        `;
    }

    /**
     * Get application statistics
     */
    getStatistics() {
        return {
            lootboxes: this.lootboxController.getStatistics(),
            groupBoxes: this.groupBoxController.getStatistics(),
            initialized: this.isInitialized,
            currentView: this.currentView,
            currentFilter: this.currentFilter
        };
    }
}

export default App;
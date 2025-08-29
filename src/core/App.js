// src/core/App.js
import FirebaseService from "../services/FirebaseService.js";
import StorageService from "../services/StorageService.js";
import LootboxController from "../controllers/LootboxController.js";
import GroupBoxController from "../controllers/GroupBoxController.js";
import UIController from "../controllers/UIController.js";
import Router from "./Router.js";

class App {
  constructor() {
    // Services
    this.services = {
      storage: null,
      firebase: null,
    };

    // Controllers
    this.controllers = {
      lootbox: null,
      groupBox: null,
      ui: null,
    };

    // Router
    this.router = null;

    // Application state
    this.state = {
      currentView: "list",
      currentFilter: "all",
      currentLootbox: null,
      currentLootboxIndex: -1,
      sessionHistory: [],
      communityHistory: [],
      isOnCooldown: false,
      popupTimeout: null,
      editingIndex: -1,
      selectedChestPath: null,
      isOrganizerReadonly: false,
      pendingDeleteIndex: undefined,
      pendingDeleteGroupBoxId: undefined,
      sharingLootboxIndex: undefined,
      currentEditGroupBoxId: undefined,
    };

    // Track initialization
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log("Initializing Lootbox Creator...");

      // Initialize services
      this.services.storage = new StorageService("lootbox_");
      this.services.firebase = new FirebaseService();
      await this.services.firebase.initialize();

      // Initialize controllers with dependency injection
      this.controllers.lootbox = new LootboxController(
        this.services.firebase,
        this.services.storage
      );

      this.controllers.groupBox = new GroupBoxController(
        this.services.firebase,
        this.services.storage
      );

      this.controllers.ui = new UIController(
        this.controllers.lootbox,
        this.controllers.groupBox,
        this.state
      );

      // Initialize router
      this.router = new Router(this);

      // Load initial data
      await this.loadInitialData();

      // Set up event delegation
      this.setupEventDelegation();

      // Handle URL parameters (share links, group box joins)
      await this.router.handleCurrentRoute();

      // Mark as initialized
      this.isInitialized = true;

      // Initial render
      this.controllers.ui.render();

      console.log("Application initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      this.showError(error.message);
    }
  }

  async loadInitialData() {
    console.log("Loading initial data...");

    // Initialize controllers (they load their own data)
    await Promise.all([
      this.controllers.lootbox.initialize(),
      this.controllers.groupBox.initialize(),
    ]);

    console.log("Initial data loaded");
  }

  setupEventDelegation() {
    // Single event listener at document level for all clicks
    document.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-action]");
      if (!action) return;

      e.preventDefault();
      e.stopPropagation();

      await this.handleAction(action.dataset.action, action.dataset);
    });

    // Form submissions
    document.addEventListener("submit", async (e) => {
      const form = e.target;
      if (form.dataset.action) {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        await this.handleAction(form.dataset.action, data);
      }
    });

    // Modal close on backdrop click
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("modal") &&
        e.target.classList.contains("show")
      ) {
        this.controllers.ui.closeModal(e.target.id);
      }
    });

    // Browser back/forward navigation
    window.addEventListener("popstate", () => {
      if (this.state.currentView !== "list") {
        this.controllers.ui.showListView();
      }
    });
  }

  async handleAction(action, data) {
    if (!this.isInitialized) return;

    console.log("Handling action:", action, data);

    try {
      switch (action) {
        // Lootbox actions
        case "open-lootbox":
          // Clear session history when opening a different lootbox
          const newIndex = parseInt(data.index);
          if (this.state.currentLootboxIndex !== newIndex) {
            this.state.sessionHistory = [];
          }
          await this.controllers.ui.openLootbox(newIndex);
          break;
        case "confirm-delete":
          if (
            data.type === "lootbox" &&
            this.state.pendingDeleteIndex !== undefined
          ) {
            const result = await this.controllers.lootbox.deleteLootbox(
              this.state.pendingDeleteIndex
            );
            if (result.success) {
              this.controllers.ui.showToast(
                `"${result.deletedName}" has been deleted`
              );
              this.controllers.ui.closeModal("deleteModal");
              this.controllers.ui.render();
            }
            this.state.pendingDeleteIndex = undefined;
          }
          break;

        case "create-lootbox":
          this.controllers.ui.showCreateModal();
          break;

        case "edit-lootbox":
          this.controllers.ui.showEditModal(parseInt(data.index));
          break;

        case "delete-lootbox":
          await this.handleDeleteLootbox(parseInt(data.index));
          break;

        case "share-lootbox":
          this.controllers.ui.showShareModal(parseInt(data.index));
          break;

        case "toggle-favorite":
          await this.controllers.lootbox.toggleFavorite(parseInt(data.index));
          this.controllers.ui.render();
          break;

        case "spin-lootbox":
          await this.handleSpinLootbox();
          break;

        case "save-lootbox":
          await this.handleSaveLootbox(data);
          break;

        // Group box actions
        case "open-group-box":
          await this.controllers.ui.openGroupBox(data.id);
          break;

        case "create-group-box":
          await this.handleCreateGroupBox(data);
          break;

        case "delete-group-box":
          await this.handleDeleteGroupBox(data.id);
          break;

        case "share-group-box":
          this.controllers.ui.showGroupBoxShareModal(data.id);
          break;

        case "toggle-group-favorite":
          await this.controllers.groupBox.toggleGroupBoxFavorite(data.id);
          this.controllers.ui.render();
          break;

        case "edit-group-box":
          this.controllers.ui.showEditGroupBoxModal(data.id);
          break;

        // Navigation
        case "show-list":
          this.controllers.ui.showListView();
          break;

        case "set-filter":
          this.controllers.ui.setFilter(data.filter);
          break;

        // Modal actions
        case "close-modal":
          this.controllers.ui.closeModal(data.modal);
          break;

        case "add-item-row":
          this.controllers.ui.addItemRow();
          break;

        case "remove-item":
          this.controllers.ui.removeItemRow(data.index);
          break;

        case "even-odds":
          this.controllers.ui.distributeOddsEvenly();
          break;

        case "random-odds":
          this.controllers.ui.randomizeOdds();
          break;

        // Utility
        case "clear-history":
          this.clearSessionHistory();
          break;

        case "copy-to-clipboard":
          await this.copyToClipboard(data.text);
          break;

        case "reload":
          window.location.reload();
          break;

        default:
          console.warn("Unknown action:", action);
      }
    } catch (error) {
      console.error(`Error handling action ${action}:`, error);
      this.controllers.ui.showToast(`Error: ${error.message}`, "error");
    }
  }

  async handleSpinLootbox() {
    if (this.state.isOnCooldown) return;

    const lootbox = this.state.currentLootbox;
    if (!lootbox) return;

    // Check if this is a group box spin
    if (lootbox.isGroupBox) {
      if (this.state.isOrganizerReadonly) {
        this.controllers.ui.showToast("Organizer view - opens disabled");
        return;
      }

      const result = await this.controllers.groupBox.spinGroupBox(
        lootbox.groupBoxId
      );
      if (result.success) {
        this.handleSpinResult(result.result);
      } else {
        this.controllers.ui.showToast(result.errors[0], "error");
      }
    } else {
      // Regular lootbox spin
      const result = await this.controllers.lootbox.spinLootbox(
        this.state.currentLootboxIndex
      );
      if (result.success) {
        this.handleSpinResult(result.result);
      } else {
        this.controllers.ui.showToast(result.errors[0], "error");
      }
    }
  }

  handleSpinResult(result) {
    // Set cooldown
    this.state.isOnCooldown = true;
    this.controllers.ui.updateLootboxInteractivity();

    // Add to history
    if (this.state.currentLootbox.isGroupBox) {
      this.state.communityHistory.unshift({
        userId: this.services.firebase.getCurrentUser()?.uid || "anonymous",
        userName: "You",
        item: result.item,
        timestamp: new Date(),
      });
    } else {
      this.state.sessionHistory.unshift({
        item: result.item,
        timestamp: new Date(),
        lootboxName: this.state.currentLootbox.name,
      });
    }

    // Show result popup
    this.controllers.ui.showResultPopup(result.item);

    // Update display
    this.controllers.ui.updateSessionDisplay();
    this.controllers.ui.renderLootboxView();

    // Clear cooldown after 1.5 seconds
    setTimeout(() => {
      this.state.isOnCooldown = false;
      this.controllers.ui.updateLootboxInteractivity();
    }, 1500);
  }

  async handleSaveLootbox(formData) {
    const lootboxData = this.controllers.ui.collectLootboxFormData(formData);

    if (this.state.editingIndex >= 0) {
      // Update existing
      const result = await this.controllers.lootbox.updateLootbox(
        this.state.editingIndex,
        lootboxData
      );

      if (result.success) {
        this.controllers.ui.closeModal("editModal");
        this.controllers.ui.showToast("Lootbox updated successfully");
        this.controllers.ui.render();
      } else {
        this.controllers.ui.showFormErrors(result.errors);
      }
    } else {
      // Create new
      const result = await this.controllers.lootbox.createLootbox(lootboxData);

      if (result.success) {
        this.controllers.ui.closeModal("editModal");
        this.controllers.ui.showToast("Lootbox created successfully");
        this.controllers.ui.render();
      } else {
        this.controllers.ui.showFormErrors(result.errors);
      }
    }
  }

  async handleCreateGroupBox(formData) {
    const settings = this.controllers.ui.collectGroupBoxFormData(formData);
    const lootboxData = this.state.sharingLootboxCopy;

    if (!lootboxData) {
      this.controllers.ui.showToast("No lootbox selected for sharing", "error");
      return;
    }

    const result = await this.controllers.groupBox.createGroupBox(
      lootboxData,
      settings
    );

    if (result.success) {
      this.controllers.ui.closeModal("groupBoxModal");
      const shareUrl = this.controllers.groupBox.generateGroupBoxShareUrl(
        result.groupBoxId
      );

      if (shareUrl.success) {
        await this.shareUrl(shareUrl.url, shareUrl.groupBoxName);
      }

      this.controllers.ui.render();
    } else {
      this.controllers.ui.showToast(result.errors[0], "error");
    }
  }

  async handleDeleteLootbox(index) {
    const lootbox = this.controllers.lootbox.getLootbox(index);
    if (!lootbox) return;

    this.state.pendingDeleteIndex = index;

    // Show the delete modal directly
    const modal = document.getElementById("deleteModal");
    const nameEl = document.getElementById("deleteLootboxName");
    if (modal && nameEl) {
      nameEl.textContent = lootbox.name;
      modal.classList.add("show");
    }
  }

  async handleDeleteGroupBox(groupBoxId) {
    const groupBox = this.controllers.groupBox.getGroupBox(groupBoxId);
    if (!groupBox) return;

    this.state.pendingDeleteGroupBoxId = groupBoxId;

    if (groupBox.isCreator) {
      this.controllers.ui.showCreatorDeleteModal(groupBox);
    } else {
      this.controllers.ui.showDeleteConfirmModal(
        groupBox.groupBoxName,
        "groupbox"
      );
    }
  }

  async confirmDelete(type, deleteForEveryone = false) {
    if (type === "lootbox" && this.state.pendingDeleteIndex !== undefined) {
      const result = await this.controllers.lootbox.deleteLootbox(
        this.state.pendingDeleteIndex
      );
      if (result.success) {
        this.controllers.ui.showToast(
          `"${result.deletedName}" has been deleted`
        );
        this.controllers.ui.render();
      }
      this.state.pendingDeleteIndex = undefined;
    } else if (type === "groupbox" && this.state.pendingDeleteGroupBoxId) {
      const result = await this.controllers.groupBox.deleteGroupBox(
        this.state.pendingDeleteGroupBoxId,
        deleteForEveryone
      );
      if (result.success) {
        const message = deleteForEveryone
          ? `"${result.groupBoxName}" deleted for everyone`
          : `Left "${result.groupBoxName}" Group Box`;
        this.controllers.ui.showToast(message);
        this.controllers.ui.render();
      }
      this.state.pendingDeleteGroupBoxId = undefined;
    }

    this.controllers.ui.closeDeleteModals();
  }

  clearSessionHistory() {
    if (this.state.currentLootbox?.isGroupBox) {
      this.state.communityHistory = [];
    } else {
      this.state.sessionHistory = [];
    }
    this.controllers.ui.updateSessionDisplay();
  }

  async shareUrl(url, name) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: name,
          url: url,
        });
        this.controllers.ui.showToast("Shared successfully");
      } catch (error) {
        if (error.name !== "AbortError") {
          await this.copyToClipboard(url);
        }
      }
    } else {
      await this.copyToClipboard(url);
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.controllers.ui.showToast("Copied to clipboard");
    } catch (error) {
      console.error("Failed to copy:", error);
      this.controllers.ui.showToast("Failed to copy to clipboard", "error");
    }
  }

  showError(message) {
    const appContainer = document.getElementById("app") || document.body;
    appContainer.innerHTML = `
            <div class="error-state">
                <h2>Application Error</h2>
                <p>${message}</p>
                <button data-action="reload" class="btn btn-primary">Reload Application</button>
            </div>
        `;
  }
}

// Create and export single instance
const app = new App();

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => app.initialize());
} else {
  app.initialize();
}

export default app;

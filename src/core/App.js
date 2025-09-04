// src/core/App.js
import FirebaseService from "../services/FirebaseService.js";
import StorageService from "../services/StorageService.js";
import LootboxController from "../controllers/LootboxController.js";
import GroupBoxController from "../controllers/GroupBoxController.js";
import UIController from "../controllers/UIController.js";
import Router from "./Router.js";
import AuthService from "../services/AuthService.js";

class App {
  constructor() {
    // Services
    this.services = {
      storage: null,
      firebase: null,
      auth: null,
    };

    // Flags
    this._delegationSetup = false; // prevent double listeners

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
      groupBoxHistories: new Map(), // Store per-group-box session histories
      historyRefreshTimer: null, // Timer for refreshing group box history
      isOnCooldown: false,
      popupTimeout: null,
      editingIndex: -1,
      selectedChestPath: null,
      isOrganizerReadonly: false,
      pendingDeleteIndex: undefined,
      pendingDeleteGroupBoxId: undefined,
      sharingLootboxIndex: undefined,
      currentEditGroupBoxId: undefined,
      isSpinning: false,
    };

    // Track initialization
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      console.log("Initializing Lootbox Creator...");

      // Initialize services
      this.services.storage = new StorageService("lootbox_");
      this.services.firebase = new FirebaseService();
      await this.services.firebase.initialize();

      // Initialize auth service AFTER Firebase
      this.services.auth = new AuthService(this.services.firebase.app);
      await this.services.auth.initializeAuth();

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
    if (this._delegationSetup) return;
    this._delegationSetup = true;
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

    // Custom expiration link handler - quick shortcut to select custom
    const customLink = document.getElementById("customExpirationLink");
    if (customLink) {
      customLink.addEventListener("click", (e) => {
        e.preventDefault();
        const expiresSelect = document.getElementById("expiresIn");
        const customInputs = document.getElementById("customExpirationInputs");

        // Select custom option and show inputs
        expiresSelect.value = "custom";
        customInputs.style.display = "block";

        // Set default custom values to 1 day if all are 0
        const days = document.getElementById("customDays");
        const hours = document.getElementById("customHours");
        const minutes = document.getElementById("customMinutes");
        if (days && hours && minutes) {
          if (
            days.value === "0" &&
            hours.value === "0" &&
            minutes.value === "0"
          ) {
            days.value = "1";
          }
        }
      });
    }

    // Expiration dropdown change handler
    const expiresSelect = document.getElementById("expiresIn");
    if (expiresSelect) {
      expiresSelect.addEventListener("change", (e) => {
        const customInputs = document.getElementById("customExpirationInputs");

        if (e.target.value === "custom") {
          customInputs.style.display = "block";

          // Set default custom values to 1 day if all are 0
          const days = document.getElementById("customDays");
          const hours = document.getElementById("customHours");
          const minutes = document.getElementById("customMinutes");
          if (days && hours && minutes) {
            if (
              days.value === "0" &&
              hours.value === "0" &&
              minutes.value === "0"
            ) {
              days.value = "1";
            }
          }
        } else {
          customInputs.style.display = "none";
        }
      });
    }

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
          // Mark as viewed immediately on click to remove "New" badge
          await this.controllers.lootbox.markAsViewed(newIndex);
          // Set lastInteracted timestamp so it appears at top on refresh
          await this.controllers.lootbox.setLastInteracted(newIndex);
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
          } else if (
            data.type === "groupbox" &&
            this.state.pendingDeleteGroupBoxId !== undefined
          ) {
            // Add console log to debug
            console.log(
              "Deleting group box:",
              this.state.pendingDeleteGroupBoxId
            );

            const result = await this.controllers.groupBox.deleteGroupBox(
              this.state.pendingDeleteGroupBoxId,
              false // deleteForEveryone = false (just leave the group)
            );

            console.log("Delete result:", result);

            if (result.success) {
              this.controllers.ui.showToast(`Left "${result.groupBoxName}"`);
              this.controllers.ui.closeModal("deleteModal");

              // Force a complete re-render after a small delay
              setTimeout(() => {
                this.controllers.ui.render();
              }, 100);
            } else {
              console.error("Delete failed:", result.errors);
              this.controllers.ui.showToast(
                result.errors?.[0] || "Failed to leave group box",
                "error"
              );
            }
            this.state.pendingDeleteGroupBoxId = undefined;
          }
          break;

        case "create-lootbox":
          await this.controllers.ui.showCreateModal();
          break;

        case "edit-lootbox":
          await this.controllers.ui.showEditModal(parseInt(data.index));
          break;

        case "delete-lootbox":
          await this.handleDeleteLootbox(parseInt(data.index));
          break;

        case "share-lootbox":
          // This keeps the modal for regular lootboxes
          const shareIndex = parseInt(data.index);
          const shareLootbox = this.controllers.lootbox.getLootbox(shareIndex);
          if (shareLootbox) {
            this.state.sharingLootboxIndex = shareIndex;
            this.state.sharingLootboxCopy = shareLootbox.toObject
              ? shareLootbox.toObject()
              : shareLootbox;

            // Show the modal for choosing share type
            const modal = document.getElementById("shareModal");
            const nameEl = document.getElementById("shareLootboxName");
            if (modal && nameEl) {
              nameEl.textContent = shareLootbox.name;
              modal.classList.add("show");
            }
          }
          break;

        case "share-as-lootbox": // ADD THIS
          if (this.state.sharingLootboxIndex !== undefined) {
            const result = this.controllers.lootbox.generateShareUrl(
              this.state.sharingLootboxIndex
            );
            if (result.success) {
              await this.shareUrl(result.url, result.lootboxName);
              this.controllers.ui.closeModal("shareModal");
            }
          }
          break;
        case "delete-group-everyone":
          if (this.state.pendingDeleteGroupBoxId) {
            const result = await this.controllers.groupBox.deleteGroupBox(
              this.state.pendingDeleteGroupBoxId,
              true // deleteForEveryone = true
            );
            if (result.success) {
              this.controllers.ui.showToast(
                `"${result.groupBoxName}" deleted for everyone`
              );
              this.controllers.ui.closeModal("creatorDeleteModal");
              this.controllers.ui.render();
            }
            this.state.pendingDeleteGroupBoxId = undefined;
          }
          break;

        case "delete-group-me":
          if (this.state.pendingDeleteGroupBoxId) {
            const result = await this.controllers.groupBox.deleteGroupBox(
              this.state.pendingDeleteGroupBoxId,
              false // deleteForEveryone = false
            );
            if (result.success) {
              this.controllers.ui.showToast(`Left "${result.groupBoxName}"`);
              this.controllers.ui.closeModal("creatorDeleteModal");
              this.controllers.ui.render();
            }
            this.state.pendingDeleteGroupBoxId = undefined;
          }
          break;
        case "share-as-groupbox": // ADD THIS
          // Show group box creation modal
          document.getElementById("shareModal").classList.remove("show");
          document.getElementById("groupBoxModal").classList.add("show");
          document.getElementById("groupBoxName").value =
            this.state.sharingLootboxCopy?.name || "";

          // Reset expiration to default 24 hours
          const expiresSelect = document.getElementById("expiresIn");
          const customInputs = document.getElementById(
            "customExpirationInputs"
          );
          if (expiresSelect) {
            expiresSelect.value = "24";
          }
          if (customInputs) {
            customInputs.style.display = "none";
          }
          // Reset custom input values
          const customDays = document.getElementById("customDays");
          const customHours = document.getElementById("customHours");
          const customMinutes = document.getElementById("customMinutes");
          if (customDays) customDays.value = "0";
          if (customHours) customHours.value = "0";
          if (customMinutes) customMinutes.value = "0";
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
          // Mark group box as viewed immediately on click to remove "New" badge
          await this.markGroupBoxAsViewed(data.id);
          // Set lastInteracted timestamp so it appears at top on refresh
          await this.setGroupBoxLastInteracted(data.id);
          await this.controllers.ui.openGroupBox(data.id);
          break;

        case "create-group-box":
          await this.handleCreateGroupBox(data);
          break;

        case "delete-group-box":
          await this.handleDeleteGroupBox(data.id);
          break;

        case "share-group-box":
          // This is for sharing an already-created group box
          const groupBoxId = data.id;
          const shareResult =
            this.controllers.groupBox.generateGroupBoxShareUrl(groupBoxId);

          if (shareResult.success) {
            await this.shareUrl(shareResult.url, shareResult.groupBoxName);
          } else {
            this.controllers.ui.showToast(
              "Failed to generate share link",
              "error"
            );
          }
          break;

        case "toggle-group-favorite":
          await this.controllers.groupBox.toggleGroupBoxFavorite(data.id);
          this.controllers.ui.render();
          break;

        case "edit-group-box":
          console.log("About to call showEditGroupBoxModal with:", data.id);
          await this.controllers.ui.showEditGroupBoxModal(data.id);
          console.log("After calling showEditGroupBoxModal");
          break;

        // Navigation
        case "show-list":
          this.controllers.ui.showListView();
          break;

        case "set-filter":
          this.controllers.ui.setFilter(data.filter);
          break;

        // Navigation
        case "show-list":
          this.controllers.ui.showListView();
          break;

        case "set-filter": // Add this case
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

        // Additional missing actions
        case "show-menu":
          console.log("Menu not implemented yet");
          break;

        case "add-edit-item":
          this.controllers.ui.addEditItem();
          break;

        case "delete-edit-item":
          this.controllers.ui.deleteEditItem(parseInt(data.index));
          break;

        case "even-edit-odds":
          this.controllers.ui.evenEditOdds();
          break;

        case "save-group-changes":
          console.log("Calling saveGroupBoxChanges...");
          await this.controllers.ui.saveGroupBoxChanges();
          break;

        case "random-edit-odds":
          this.controllers.ui.randomizeEditOdds();
          break;

        case "toggle-session-history":
          const content = document.getElementById("sessionContent");
          const button = document.getElementById("toggleButton");
          if (content && button) {
            if (content.classList.contains("collapsed")) {
              content.classList.remove("collapsed");
              button.textContent = "▼";
            } else {
              content.classList.add("collapsed");
              button.textContent = "▶";
            }
          }
          break;

        case "sign-in-google":
          await this.handleGoogleSignIn();
          break;

        case "sign-in-apple":
          await this.handleAppleSignIn();
          break;

        case "sign-out":
          await this.handleSignOut();
          break;

        case "show-sign-in":
          this.services.auth.showSignInModal();
          break;

        case "adjust-tries-display":
          // Adjust the grant amount display
          const input = document.getElementById(`tries-${data.userId}`);
          if (input) {
            const currentValue = parseInt(input.value) || 0;
            const delta = parseInt(data.delta) || 0;
            const newValue = currentValue + delta;
            input.value = newValue;

            // Update preview of what the final value will be
            const currentTries = parseInt(input.dataset.current) || 0;
            const finalTries = Math.max(0, currentTries + newValue);
            const previewEl = document.getElementById(`preview-${data.userId}`);

            if (previewEl) {
              if (newValue !== 0) {
                const sign = newValue > 0 ? "+" : "";
                previewEl.textContent = `→ ${finalTries} (${sign}${newValue})`;
                input.style.borderColor = "#10b981";
              } else {
                previewEl.textContent = "";
                input.style.borderColor = "";
              }
            }
          }
          break;

        default:
          console.warn("Unknown action:", action);
      }
    } catch (error) {
      console.error(`Error handling action ${action}:`, error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";
      this.controllers.ui.showToast(`Error: ${errorMessage}`, "error");
    }
  }

  // In App.js - Replace your handleSpinLootbox method with this:

  async handleSpinLootbox() {
    // Prevent double-clicks with a proper flag
    if (this.state.isSpinning) {
      console.log("Already spinning, ignoring click");
      return;
    }

    const lootbox = this.state.currentLootbox;
    if (!lootbox || this.state.isOnCooldown) return;

    // Set spinning flag immediately
    this.state.isSpinning = true;

    // Disable the button visually
    const buttonEl = document.getElementById("openButton");
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.style.cursor = "wait";
    }

    try {
      let result;

      if (lootbox.isGroupBox) {
        // For organizer-only mode
        if (this.state.isOrganizerReadonly) {
          this.controllers.ui.showToast("Organizer view - opens disabled");
          return;
        }

        // CRITICAL FIX: Temporarily disconnect realtime listeners during spin
        console.log("Disconnecting realtime listeners during spin...");
        if (this.state.groupBoxUnsub) {
          this.state.groupBoxUnsub();
          this.state.groupBoxUnsub = null;
        }
        if (this.state.historyUnsub) {
          this.state.historyUnsub();
          this.state.historyUnsub = null;
        }

        // Spin the group box
        result = await this.controllers.groupBox.spinGroupBox(
          lootbox.groupBoxId
        );

        if (result.success) {
          // Update the local state with the new tries count
          this.state.currentLootbox.userRemainingTries =
            this.controllers.groupBox.getGroupBox(lootbox.groupBoxId)
              ?.userRemainingTries || 0;

          // Update UI immediately with the new value
          const triesEl = document.getElementById("triesInfo");
          if (triesEl) {
            triesEl.textContent = `Tries remaining: ${this.state.currentLootbox.userRemainingTries}`;
          }

          // Handle the result display
          this.handleSpinResult(result.result);

          // Wait a bit for Firebase to fully propagate the update
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Reconnect realtime listeners AFTER the update is complete
          console.log("Reconnecting realtime listeners...");
          this.controllers.ui.setupGroupBoxRealtime(lootbox.groupBoxId);
        } else {
          // Handle errors
          if (result.errors[0].includes("expired")) {
            this.controllers.ui.showToast(
              "This group box has expired",
              "error"
            );
            this.controllers.ui.showListView();
          } else {
            this.controllers.ui.showToast(result.errors[0], "error");
          }

          // Reconnect listeners even on error
          this.controllers.ui.setupGroupBoxRealtime(lootbox.groupBoxId);
        }
      } else {
        // Regular lootbox spin (unchanged)
        result = await this.controllers.lootbox.spinLootbox(
          this.state.currentLootboxIndex
        );
        if (result.success) {
          this.handleSpinResult(result.result);
        } else {
          this.controllers.ui.showToast(result.errors[0], "error");
        }
      }
    } finally {
      // Always reset the spinning flag after a delay
      setTimeout(() => {
        this.state.isSpinning = false;

        // Re-enable the button
        const buttonEl = document.getElementById("openButton");
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.style.cursor = "pointer";
        }

        // Update interactivity
        this.controllers.ui.updateLootboxInteractivity();
      }, 500);
    }
  }

  // ALSO in UIController.js - Make setupGroupBoxRealtime accessible:
  // Add this check to prevent duplicate listeners

  setupGroupBoxRealtime(groupBoxId) {
    // Clean up any existing listeners first
    if (this.state.groupBoxUnsub) {
      console.log("Cleaning up existing group box listener");
      this.state.groupBoxUnsub();
      this.state.groupBoxUnsub = null;
    }
    if (this.state.historyUnsub) {
      console.log("Cleaning up existing history listener");
      this.state.historyUnsub();
      this.state.historyUnsub = null;
    }

    console.log("Setting up realtime listeners for group box:", groupBoxId);

    // 1) Live doc: tries/expiry/spins
    this.state.groupBoxUnsub =
      this.lootboxController.firebase.listenToGroupBoxDoc(
        groupBoxId,
        (docData) => {
          if (!docData) {
            this.showToast(
              "This group box was deleted by the creator",
              "error"
            );
            this.showListView();
            return;
          }

          // IMPORTANT: Don't update if we're in the middle of spinning
          if (this.state.isSpinning) {
            console.log("Ignoring realtime update during spin");
            return;
          }

          const currentUser = this.lootboxController.firebase.getCurrentUser();
          const me = currentUser?.uid
            ? docData.participants?.find((p) => p.userId === currentUser.uid)
            : null;

          if (this.state.currentLootbox?.isGroupBox) {
            if (me?.userRemainingTries !== undefined) {
              console.log("Realtime update - tries:", me.userRemainingTries);
              this.state.currentLootbox.userRemainingTries =
                me.userRemainingTries;
              const t = document.getElementById("triesInfo");
              if (t)
                t.textContent =
                  me.userRemainingTries === "unlimited"
                    ? "Tries remaining: unlimited"
                    : `Tries remaining: ${me.userRemainingTries}`;
            }
            if (docData.expiresAt !== undefined)
              this.state.currentLootbox.expiresAt = docData.expiresAt;
            if (docData.totalSpins !== undefined)
              this.state.currentLootbox.totalSpins = docData.totalSpins;
            this.updateLootboxInteractivity();
          }
        }
      );

    // 2) Live history (latest 50)
    this.state.historyUnsub =
      this.lootboxController.firebase.listenToSessionHistory(
        groupBoxId,
        (events) => {
          // Don't update history during spin either
          if (this.state.isSpinning) {
            console.log("Ignoring history update during spin");
            return;
          }

          this.state.groupBoxHistories.set(groupBoxId, events);
          this.state.communityHistory = events;

          if (this.state.currentLootbox?.isGroupBox) {
            const spins = events.filter((e) => e.type === "spin").length;
            const shown = Number(this.state.currentLootbox.totalSpins ?? 0);
            if (spins > shown) {
              this.state.currentLootbox.totalSpins = spins;
            }
          }

          this.updateSessionDisplay();
        }
      );
  }

  handleSpinResult(result) {
    // Set cooldown
    this.state.isOnCooldown = true;
    this.controllers.ui.updateLootboxInteractivity();

    // Add to history
    // Only add to local history for regular lootboxes
    if (!this.state.currentLootbox.isGroupBox) {
      this.state.sessionHistory.unshift({
        item: result.item,
        timestamp: new Date(),
        lootboxName: this.state.currentLootbox.name,
      });
    }
    // For group boxes, the Firebase refresh will handle history updates

    // Show result popup
    this.controllers.ui.showResultPopup(result.item);

    // Update display
    this.controllers.ui.updateSessionDisplay();
    // Update tries display for group boxes
    if (this.state.currentLootbox?.isGroupBox) {
      //this.state.currentLootbox.userRemainingTries--;
      const triesEl = document.getElementById("triesInfo");
      if (triesEl) {
        triesEl.textContent = `Tries remaining: ${this.state.currentLootbox.userRemainingTries}`;
      }
      this.controllers.ui.updateLootboxInteractivity();
    }

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

    // Check for validation errors
    if (settings.error) {
      this.controllers.ui.showToast(settings.message, "error");
      return;
    }

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
        // Force a small delay to ensure Firebase writes are complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
    const deleteBtn = modal?.querySelector('[data-action="confirm-delete"]');
    if (modal && nameEl && deleteBtn) {
      nameEl.textContent = lootbox.name;
      deleteBtn.setAttribute("data-type", "lootbox");
      modal.classList.add("show");
      this.controllers.ui.lockBodyScroll();
    }
  }

  async handleDeleteGroupBox(groupBoxId) {
    const groupBox = this.controllers.groupBox.getGroupBox(groupBoxId);
    if (!groupBox) return;

    this.state.pendingDeleteGroupBoxId = groupBoxId;

    // Check if creator AND if they're an organizer-only (didn't participate)
    if (groupBox.isCreator && groupBox.isOrganizerOnly) {
      // Show creator delete choice modal with both options
      const modal = document.getElementById("creatorDeleteModal");
      const nameEl = document.getElementById("creatorDeleteBoxName");
      if (modal && nameEl) {
        nameEl.textContent = groupBox.groupBoxName;
        modal.classList.add("show");
        this.controllers.ui.lockBodyScroll();
      }
    } else {
      // For creators who participated OR regular participants,
      // show regular delete modal (leave only)
      const modal = document.getElementById("deleteModal");
      const nameEl = document.getElementById("deleteLootboxName");
      const deleteBtn = modal?.querySelector('[data-action="confirm-delete"]');
      if (modal && nameEl && deleteBtn) {
        nameEl.textContent = groupBox.groupBoxName;
        deleteBtn.setAttribute("data-type", "groupbox");
        modal.classList.add("show");
        this.controllers.ui.lockBodyScroll();
      }
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
      // Also clear the persistent history for this group box
      const groupBoxId = this.state.currentLootbox.groupBoxId;
      if (groupBoxId) {
        this.state.groupBoxHistories.set(groupBoxId, []);
      }
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

  // Mark group box as viewed to remove "New" badge
  async markGroupBoxAsViewed(groupBoxId) {
    try {
      const groupBox = this.controllers.groupBox.getGroupBox(groupBoxId);
      if (groupBox && !groupBox.viewed) {
        // Mark it as viewed
        groupBox.viewed = true;

        // Save to Firebase if available
        if (
          this.controllers.groupBox.firebase &&
          this.controllers.groupBox.firebase.isReady
        ) {
          await this.controllers.groupBox.updateParticipantData(groupBoxId, {
            viewed: true,
          });
        }

        // Also save to local storage
        await this.controllers.groupBox.save();
        // Force re-render to update the UI
        this.controllers.ui.render();
      }
    } catch (error) {
      console.error("Error marking group box as viewed:", error);
    }
  }

  async handleGoogleSignIn() {
    try {
      let result;

      if (this.services.auth.isAnonymousUser()) {
        // Upgrade anonymous account
        result = await this.services.auth.upgradeAnonymousAccount("google");
      } else {
        // Regular sign-in
        result = await this.services.auth.signInWithGoogle();
      }

      if (result.success) {
        this.controllers.ui.closeModal("signInModal");
        this.controllers.ui.showToast(`Welcome ${result.user.displayName}!`);

        // Refresh data to sync with new account
        await this.loadInitialData();
        this.controllers.ui.render();
      } else {
        this.controllers.ui.showToast(result.error, "error");
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      this.controllers.ui.showToast("Sign-in failed", "error");
    }
  }

  async handleAppleSignIn() {
    try {
      let result;

      if (this.services.auth.isAnonymousUser()) {
        result = await this.services.auth.upgradeAnonymousAccount("apple");
      } else {
        result = await this.services.auth.signInWithApple();
      }

      if (result.success) {
        this.controllers.ui.closeModal("signInModal");
        this.controllers.ui.showToast(
          `Welcome ${result.user.displayName || "User"}!`
        );

        await this.loadInitialData();
        this.controllers.ui.render();
      } else {
        this.controllers.ui.showToast(result.error, "error");
      }
    } catch (error) {
      console.error("Apple sign-in error:", error);
      this.controllers.ui.showToast("Sign-in failed", "error");
    }
  }

  async handleSignOut() {
    const result = await this.services.auth.signOut();
    if (result.success) {
      this.controllers.ui.showToast("Signed out successfully");
      // Clear local data and reload
      await this.loadInitialData();
      this.controllers.ui.render();
    }
  }

  // Set lastInteracted timestamp for group box
  async setGroupBoxLastInteracted(groupBoxId) {
    try {
      const groupBox = this.controllers.groupBox.getGroupBox(groupBoxId);
      if (groupBox) {
        // Set lastInteracted timestamp
        groupBox.lastInteracted = new Date().toISOString();

        // Save to Firebase if available
        if (
          this.controllers.groupBox.firebase &&
          this.controllers.groupBox.firebase.isReady
        ) {
          await this.controllers.groupBox.updateParticipantData(groupBoxId, {
            lastInteracted: groupBox.lastInteracted,
          });
        }

        // Also save to local storage
        await this.controllers.groupBox.save();
      }
    } catch (error) {
      console.error("Error setting group box last interacted:", error);
    }
  }

  // Missing methods that are called from the codebase
  openGroupBoxFromList(groupBoxId) {
    return this.handleAction("open-group-box", { id: groupBoxId });
  }

  deleteGroupBox(groupBoxId) {
    return this.handleAction("delete-group-box", { id: groupBoxId });
  }

  favoriteGroupBox(groupBoxId) {
    return this.handleAction("toggle-group-favorite", { id: groupBoxId });
  }

  shareGroupBoxLink(groupBoxId) {
    return this.handleAction("share-group-box", { id: groupBoxId });
  }

  editGroupBox(groupBoxId) {
    return this.handleAction("edit-group-box", { id: groupBoxId });
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

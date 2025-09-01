// src/controllers/UIController.js
import LootboxCard from "../views/components/LootboxCard.js";
import GroupBoxCard from "../views/components/GroupBoxCard.js";

class UIController {
  constructor(lootboxController, groupBoxController, appState) {
    this.lootboxController = lootboxController;
    this.groupBoxController = groupBoxController;
    this.state = appState;
    this.scrollPosition = 0;
  }

  // Helper functions for scroll lock
  lockBodyScroll() {
    // Store scroll position
    this.scrollPosition =
      window.pageYOffset || document.documentElement.scrollTop;

    // Add class to prevent scrolling
    document.body.classList.add("modal-open");
    document.documentElement.style.overflow = "hidden";

    // Prevent scroll on iOS without changing position
    document.body.style.position = "relative";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";
  }

  unlockBodyScroll() {
    // Remove scroll lock
    document.body.classList.remove("modal-open");
    document.documentElement.style.overflow = "";
    document.body.style.position = "";
    document.body.style.overflow = "";
    document.body.style.height = "";

    // Restore scroll position if needed
    if (this.scrollPosition) {
      window.scrollTo(0, this.scrollPosition);
    }
  }

  render() {
    console.log("UIController rendering view:", this.state.currentView);

    if (this.state.currentView === "list") {
      this.renderListView();
    } else if (this.state.currentView === "lootbox") {
      this.renderLootboxView();
    }
  }

  renderListView() {
    console.log("Rendering list view");
    const grid = document.getElementById("lootboxGrid");
    const emptyState = document.getElementById("emptyState");
    if (!grid) {
      console.error("lootboxGrid element not found");
      return;
    }

    const lootboxes = this.lootboxController.getAllLootboxes();
    const allGroupBoxes = this.groupBoxController.getAllGroupBoxes();
    const groupBoxes = allGroupBoxes.filter((gb) => !gb.hasLeft);

    // helper: find the real index in the controller's backing array
    const getTrueIndex = (lb) => {
      const all = this.lootboxController.lootboxes || [];
      if (lb && lb.id) return all.findIndex((x) => x && x.id === lb.id);
      return all.indexOf(lb);
    };

    let allItems = [];

    if (this.state.currentFilter === "all") {
      allItems = [
        // LOOTBOXES (use true index)
        ...lootboxes.map((lb) => {
          let data;
          if (typeof lb.toObject === "function") {
            data = lb.toObject();
          } else {
            data = {
              id: lb.id,
              name: lb.name,
              items: lb.items,
              chestImage: lb.chestImage,
              revealContents: lb.revealContents,
              revealOdds: lb.revealOdds,
              maxTries: lb.maxTries,
              remainingTries: lb.remainingTries,
              spins: lb.spins,
              lastUsed: lb.lastUsed,
              favorite: lb.favorite,
              imported: lb.imported,
              importedAt: lb.importedAt,
              createdAt: lb.createdAt,
              updatedAt: lb.updatedAt,
            };
          }
          const trueIndex = getTrueIndex(lb);
          return { type: "lootbox", data, index: trueIndex };
        }),
        // GROUP BOXES (unchanged)
        ...groupBoxes.map((gb) => {
          let data;
          if (typeof gb.toObject === "function") {
            data = gb.toObject();
          } else {
            data = {
              id: gb.id,
              groupBoxId: gb.groupBoxId,
              groupBoxName: gb.groupBoxName,
              name: gb.name,
              items: gb.items,
              chestImage: gb.chestImage,
              lootboxData: gb.lootboxData,
              settings: gb.settings,
              createdBy: gb.createdBy,
              creatorName: gb.creatorName,
              isCreator: gb.isCreator,
              isOrganizerOnly: gb.isOrganizerOnly,
              userTotalOpens: gb.userTotalOpens,
              userRemainingTries: gb.userRemainingTries,
              totalOpens: gb.totalOpens,
              uniqueUsers: gb.uniqueUsers,
              favorite: gb.favorite,
              revealContents: gb.revealContents,
              revealOdds: gb.revealOdds,
            };
          }
          return { type: "groupbox", data };
        }),
      ];
    } else if (this.state.currentFilter === "shared") {
      allItems = groupBoxes.map((gb) => ({
        type: "groupbox",
        data: gb.toObject ? gb.toObject() : gb,
      }));
    } else if (this.state.currentFilter === "favorites") {
      allItems = [
        ...lootboxes
          .filter((lb) => lb.favorite)
          .map((lb) => ({
            type: "lootbox",
            data: lb.toObject ? lb.toObject() : lb,
            index: getTrueIndex(lb),
          })),
        ...groupBoxes
          .filter((gb) => gb.favorite)
          .map((gb) => ({
            type: "groupbox",
            data: gb.toObject ? gb.toObject() : gb,
          })),
      ];
    } else if (this.state.currentFilter === "new") {
      allItems = [
        ...lootboxes
          .filter((lb) => (lb.spins || 0) === 0)
          .map((lb) => ({
            type: "lootbox",
            data: lb.toObject ? lb.toObject() : lb,
            index: getTrueIndex(lb),
          })),
        ...groupBoxes
          .filter((gb) => (gb.userTotalOpens || 0) === 0 && !gb.isOrganizerOnly)
          .map((gb) => ({
            type: "groupbox",
            data: gb.toObject ? gb.toObject() : gb,
          })),
      ];
    }

    // Sort items
    allItems.sort(this.sortItemsByUsage);

    if (allItems.length === 0) {
      grid.style.display = "none";
      emptyState.classList.remove("hidden");
    } else {
      grid.style.display = "grid";
      emptyState.classList.add("hidden");
      grid.innerHTML = allItems
        .map((item) => {
          if (item.type === "groupbox") {
            return GroupBoxCard.render(item.data);
          } else {
            return LootboxCard.render(item.data, item.index);
          }
        })
        .join("");
    }

    const lootboxView = document.getElementById("lootboxView");
    const listView = document.getElementById("listView");
    if (lootboxView) lootboxView.classList.add("hidden");
    if (listView) listView.classList.remove("hidden");
  }

  renderLootboxView() {
    console.log("Rendering lootbox view");

    const lootbox = this.state.currentLootbox;
    if (!lootbox) {
      console.error("No current lootbox to display");
      this.showListView();
      return;
    }

    // Update title
    const titleEl = document.getElementById("lootboxTitle");
    if (titleEl) {
      titleEl.textContent = lootbox.groupBoxName || lootbox.name || "Lootbox";
    }

    // Update tries info
    const triesEl = document.getElementById("triesInfo");
    if (triesEl) {
      if (lootbox.isGroupBox) {
        triesEl.textContent =
          lootbox.userRemainingTries !== undefined
            ? `Tries remaining: ${lootbox.userRemainingTries}`
            : "Group Box";
      } else {
        triesEl.textContent =
          lootbox.maxTries === "unlimited"
            ? "Unlimited tries"
            : `Tries remaining: ${lootbox.remainingTries}`;
      }
    }

    // Update chest image
    const circleEl = document.getElementById("lootboxCircle");
    if (circleEl) {
      let chestImage = lootbox.chestImage || "chests/chest.png";
      if (chestImage.includes("chests/OwnedChests/")) {
        chestImage = chestImage.replace("chests/OwnedChests/", "chests/");
      }
      circleEl.style.backgroundImage = `url('${chestImage}')`;
    }

    // Update items list if revealed
    const itemsEl = document.getElementById("lootboxItems");
    if (itemsEl) {
      const items = lootbox.items || lootbox.lootboxData?.items || [];
      const revealContents = lootbox.revealContents !== false;
      const revealOdds = lootbox.revealOdds !== false;

      if (revealContents && items.length > 0) {
        itemsEl.innerHTML = items
          .map(
            (item) => `
          <div class="lootbox-item">
            <div class="item-name">${item.name}</div>
            ${
              revealOdds
                ? `<div class="item-odds">${(item.odds * 100).toFixed(
                    1
                  )}%</div>`
                : ""
            }
          </div>
        `
          )
          .join("");
      } else {
        itemsEl.innerHTML =
          '<div class="lootbox-item"><div class="item-name">Contents hidden</div></div>';
      }
    }

    // Update session display
    this.updateSessionDisplay();
    this.updateLootboxInteractivity();

    // Show lootbox view, hide list view
    const lootboxView = document.getElementById("lootboxView");
    const listView = document.getElementById("listView");

    if (listView) listView.classList.add("hidden");
    if (lootboxView) lootboxView.classList.remove("hidden");
  }

  showListView() {
    // Clean up any group box history refresh timer
    if (this.state.historyRefreshTimer) {
      clearInterval(this.state.historyRefreshTimer);
      this.state.historyRefreshTimer = null;
    }

    // Clear any stuck result popup
    const popup = document.getElementById("resultPopup");
    if (popup) {
      popup.classList.remove("show");
    }

    // Clear popup timeout if it exists
    if (this.state.popupTimeout) {
      clearTimeout(this.state.popupTimeout);
      this.state.popupTimeout = null;
    }

    this.state.currentView = "list";
    this.state.currentLootbox = null;
    this.render();
  }

  async openLootbox(controllerIndex) {
    console.log("Opening lootbox (controller index):", controllerIndex);
    const lootbox = this.lootboxController.getLootbox(controllerIndex);
    if (!lootbox) {
      console.error("No lootbox at index:", controllerIndex);
      return;
    }

    this.state.isOrganizerReadonly = false;

    // Mark viewed
    await this.lootboxController.markAsViewed(controllerIndex);

    // Show it
    this.state.currentView = "lootbox";
    this.state.currentLootbox = lootbox;
    this.state.currentLootboxIndex = controllerIndex;
    this.render();
  }

  async openGroupBox(groupBoxId) {
    console.log("Opening group box:", groupBoxId);

    if (this.lootboxController.firebase.isReady) {
      console.log("Firebase is ready, attempting refresh...");
      try {
        const freshData = await this.lootboxController.firebase.loadGroupBox(
          groupBoxId
        );
        console.log("Fresh data loaded:", freshData);

        const currentUser = this.lootboxController.firebase.getCurrentUser();
        console.log("Current user:", currentUser?.uid);

        if (freshData && currentUser) {
          console.log("Looking for participant in:", freshData.participants);
          const freshParticipant = freshData.participants?.find(
            (p) => p.userId === currentUser.uid
          );
          console.log("Found participant:", freshParticipant);

          if (freshParticipant) {
            const groupBox = this.groupBoxController.getGroupBox(groupBoxId);
            console.log("Local group box before update:", groupBox);

            if (groupBox) {
              console.log(
                "Updating from",
                groupBox.userRemainingTries,
                "to",
                freshParticipant.userRemainingTries
              );
              groupBox.userRemainingTries = freshParticipant.userRemainingTries;
              groupBox.userTotalOpens = freshParticipant.userTotalOpens || 0;
              console.log("After update:", groupBox.userRemainingTries);
            } else {
              console.log("ERROR: groupBox is null!");
            }
          } else {
            console.log("ERROR: freshParticipant not found!");
          }
        } else {
          console.log("ERROR: freshData or currentUser is null!");
        }
      } catch (error) {
        console.error("Error refreshing group box data:", error);
      }
    } else {
      console.log("Firebase not ready!");
    }

    const groupBox = this.groupBoxController.getGroupBox(groupBoxId);
    if (!groupBox) {
      // Try to check if it still exists in Firebase
      try {
        await this.lootboxController.firebase.loadGroupBox(groupBoxId);
      } catch (error) {
        this.showToast("This group box was deleted by the creator", "error");
        this.showListView();
        return;
      }
    }
    if (groupBox) {
      this.state.currentView = "lootbox";
      this.state.currentLootbox = groupBox;
      this.state.currentGroupBoxId = groupBoxId;
      this.state.isOrganizerReadonly = groupBox.isOrganizerOnly;

      // Always load fresh history from Firebase for group boxes
      if (this.lootboxController.firebase.isReady) {
        try {
          // Get the complete history from Firebase
          const sharedHistory =
            await this.lootboxController.firebase.getSessionHistory(groupBoxId);

          // Format properly
          const formattedHistory = sharedHistory.map((event) => ({
            ...event,
            timestamp:
              event.timestamp instanceof Date
                ? event.timestamp.toISOString()
                : event.timestamp,
          }));

          // Set as the authoritative history
          this.state.groupBoxHistories.set(groupBoxId, formattedHistory);
          this.state.communityHistory = formattedHistory;

          console.log(
            `Loaded ${formattedHistory.length} events from Firebase for group box ${groupBoxId}`
          );
        } catch (error) {
          console.error("Error loading shared session history:", error);
          // Fall back to empty history
          this.state.groupBoxHistories.set(groupBoxId, []);
          this.state.communityHistory = [];
        }
      } else {
        // No Firebase - use empty history
        this.state.groupBoxHistories.set(groupBoxId, []);
        this.state.communityHistory = [];
      }

      // Set up periodic refresh of session history for group boxes to see other users' activity
      this.setupGroupBoxHistoryRefresh(groupBoxId);

      this.render();
    } else {
      console.error("Group box not found:", groupBoxId);
    }
  }

  setupGroupBoxHistoryRefresh(groupBoxId) {
    // Clear any existing refresh timer
    if (this.state.historyRefreshTimer) {
      clearInterval(this.state.historyRefreshTimer);
    }

    // Only set up refresh if Firebase is ready and we're viewing a group box
    if (
      this.lootboxController.firebase.isReady &&
      this.state.currentLootbox?.isGroupBox
    ) {
      this.state.historyRefreshTimer = setInterval(async () => {
        // Only refresh if we're still viewing the same group box
        if (
          this.state.currentLootbox?.isGroupBox &&
          this.state.currentGroupBoxId === groupBoxId
        ) {
          try {
            await this.refreshGroupBoxHistory(groupBoxId);
          } catch (error) {
            console.error("Error refreshing group box history:", error);
          }
        } else {
          // Clear timer if we're no longer viewing this group box
          if (this.state.historyRefreshTimer) {
            clearInterval(this.state.historyRefreshTimer);
            this.state.historyRefreshTimer = null;
          }
        }
      }, 15000); // Refresh every 15 seconds for better responsiveness
    }
  }

  async refreshGroupBoxHistory(groupBoxId) {
    if (!this.lootboxController.firebase.isReady) return;

    try {
      const sharedHistory =
        await this.lootboxController.firebase.getSessionHistory(groupBoxId);

      // Check if there's a recent refresh_tries event for current user
      const currentUser = this.lootboxController.firebase.getCurrentUser();
      const recentRefresh = sharedHistory.find(
        (event) =>
          event.type === "refresh_tries" &&
          event.userId === currentUser?.uid &&
          new Date() - new Date(event.timestamp) < 20000 // Within last 20 seconds
      );

      if (
        recentRefresh ||
        sharedHistory.length !== this.state.communityHistory?.length
      ) {
        // Reload group box data to get fresh tries
        const freshData = await this.lootboxController.firebase.loadGroupBox(
          groupBoxId
        );
        const freshParticipant = freshData?.participants?.find(
          (p) => p.userId === currentUser?.uid
        );

        if (freshParticipant && this.state.currentLootbox) {
          this.state.currentLootbox.userRemainingTries =
            freshParticipant.userRemainingTries;

          // Update UI
          const triesEl = document.getElementById("triesInfo");
          if (triesEl) {
            triesEl.textContent = `Tries remaining: ${freshParticipant.userRemainingTries}`;
          }
          this.updateLootboxInteractivity();
        }
      }

      // Update history display
      this.state.groupBoxHistories.set(groupBoxId, sharedHistory);
      this.state.communityHistory = sharedHistory;
      this.updateSessionDisplay();
    } catch (error) {
      console.error("Error refreshing group box history:", error);
    }
  }

  setFilter(filter) {
    this.state.currentFilter = filter;
    // Update active button
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    this.render();
  }

  updateSessionDisplay() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;

    const history = this.state.currentLootbox?.isGroupBox
      ? this.state.communityHistory
      : this.state.sessionHistory;

    if (history.length === 0) {
      historyList.innerHTML =
        '<div class="no-history">No activity yet this session</div>';
    } else {
      historyList.innerHTML = history
        .slice(0, 50)
        .map((entry) => {
          const timeStr = new Date(entry.timestamp).toLocaleTimeString();

          // Handle different event types for group boxes
          if (this.state.currentLootbox?.isGroupBox && entry.type) {
            // Skip refresh_tries events - they're internal only
            if (entry.type === "refresh_tries") {
              return ""; // Return empty string to skip this entry
            }
            let displayText = entry.message || "";
            let cssClass = "history-item";

            // Ensure entry properties are not null
            const safeUserName = entry.userName || "Unknown User";
            const safeItem = entry.item || "unknown item";

            switch (entry.type) {
              case "join":
                cssClass += " history-join";
                displayText =
                  entry.message ||
                  `${safeUserName.substring(0, 5)} joined the box`;
                break;
              case "leave":
                cssClass += " history-leave";
                displayText =
                  entry.message ||
                  `${safeUserName.substring(0, 5)} left the box`;
                break;
              case "spin":
                cssClass += " history-spin";
                displayText =
                  entry.message ||
                  `${safeUserName.substring(0, 5)} got "${safeItem}"`;
                break;
              case "grant":
                cssClass += " history-grant";
                displayText =
                  entry.message ||
                  `Granted tries to ${safeUserName.substring(0, 5)}`;
                break;
              default:
                displayText = entry.message || safeItem;
            }

            return `
                    <div class="${cssClass}">
                        <div class="history-item-name">${displayText}</div>
                        <div class="history-item-time">${timeStr}</div>
                    </div>
                `;
          } else {
            // Regular lootbox session history
            return `
                    <div class="history-item">
                        <div class="history-item-name">${entry.item}</div>
                        <div class="history-item-time">${timeStr}</div>
                    </div>
                `;
          }
        })
        .join("");
    }

    // Update total pulls
    const totalPullsEl = document.getElementById("totalPulls");
    if (totalPullsEl) {
      if (this.state.currentLootbox?.isGroupBox) {
        // First try to use the totalSpins from the group box itself
        if (this.state.currentLootbox.totalSpins !== undefined) {
          totalPullsEl.textContent = this.state.currentLootbox.totalSpins;
        } else {
          // Fall back to counting from visible history
          const actualPulls = history.filter(
            (entry) => entry.type === "spin"
          ).length;
          totalPullsEl.textContent = actualPulls + "+"; // Add + to show there might be more
        }
      } else {
        // For regular lootboxes, all entries are pulls
        totalPullsEl.textContent = history.length;
      }
    }
  }

  updateLootboxInteractivity() {
    const circleEl = document.getElementById("lootboxCircle");
    const buttonEl = document.getElementById("openButton");

    if (!circleEl || !buttonEl) return;

    let canSpin = false;

    // Check if we're currently spinning
    if (this.state.isSpinning) {
      circleEl.classList.add("on-cooldown");
      buttonEl.disabled = true;
      buttonEl.style.cursor = "wait";
      return;
    }

    if (this.state.currentLootbox) {
      if (this.state.currentLootbox.isGroupBox) {
        // For group boxes, check userRemainingTries
        canSpin =
          !this.state.isOnCooldown &&
          !this.state.isOrganizerReadonly &&
          (this.state.currentLootbox.userRemainingTries > 0 ||
            this.state.currentLootbox.userRemainingTries === "unlimited");
      } else {
        // For regular lootboxes, check canSpin property
        canSpin = !this.state.isOnCooldown && this.state.currentLootbox.canSpin;
      }
    }

    if (this.state.isOrganizerReadonly) {
      circleEl.classList.add("organizer-readonly");
      buttonEl.disabled = true;
      buttonEl.style.cursor = "not-allowed";
    } else if (this.state.isOnCooldown || this.state.isSpinning) {
      circleEl.classList.add("on-cooldown");
      buttonEl.disabled = true;
      buttonEl.style.cursor = this.state.isSpinning ? "wait" : "not-allowed";
    } else if (!canSpin) {
      circleEl.classList.add("on-cooldown");
      buttonEl.disabled = true;
      buttonEl.style.cursor = "not-allowed";
    } else {
      circleEl.classList.remove("on-cooldown", "organizer-readonly");
      buttonEl.disabled = false;
      buttonEl.style.cursor = "pointer";
    }
  }

  showResultPopup(item) {
    const popup = document.getElementById("resultPopup");
    const itemEl = document.getElementById("resultItem");

    if (!popup || !itemEl) return;

    itemEl.textContent = item;
    popup.classList.add("show");

    // Clear any existing timeout
    if (this.state.popupTimeout) {
      clearTimeout(this.state.popupTimeout);
    }

    // Hide after 1.5 seconds
    this.state.popupTimeout = setTimeout(() => {
      popup.classList.remove("show");
    }, 1500);
  }

  showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    // Ensure message is a string and not null/undefined
    const safeMessage = message?.toString() || "Unknown message";

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = safeMessage;

    if (type === "error") {
      toast.style.background = "rgba(239, 68, 68, 0.9)";
    }

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add("show"), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      toast.classList.add("hide");
      setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
  }

  // Modal methods
  async showCreateModal() {
    this.state.editingIndex = -1;
    document.getElementById("modalTitle").textContent = "Create New Lootbox";
    document.getElementById("editModal").classList.add("show");
    this.lockBodyScroll();
    await this.initializeModalForm();
  }

  async showEditModal(index) {
    this.state.editingIndex = index;
    const lootbox = this.lootboxController.getLootbox(index);
    if (!lootbox) return;

    document.getElementById("modalTitle").textContent = "Edit Lootbox";
    document.getElementById("editModal").classList.add("show");
    this.lockBodyScroll();
    await this.populateModalForm(lootbox);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("show");
      this.unlockBodyScroll();
    }
  }

  async initializeModalForm() {
    // Clear form
    document.getElementById("lootboxName").value = "";
    document.getElementById("revealContents").checked = true;
    document.getElementById("revealOdds").checked = true;
    document.getElementById("unlimitedTries").checked = true;
    document.getElementById("maxTries").value = "10";

    // Clear items list
    const itemsList = document.getElementById("itemsList");
    if (itemsList) {
      itemsList.innerHTML = "";
    }

    // Load and populate chest selection
    await this.populateChestSelection();

    // Add initial item row with default values
    this.addItemRow("Default Item", "1");
  }

  async populateModalForm(lootbox) {
    // Populate form with lootbox data
    document.getElementById("lootboxName").value = lootbox.name || "";
    document.getElementById("revealContents").checked =
      lootbox.revealContents !== false;
    document.getElementById("revealOdds").checked =
      lootbox.revealOdds !== false;
    document.getElementById("unlimitedTries").checked =
      lootbox.maxTries === "unlimited";
    document.getElementById("maxTries").value =
      lootbox.maxTries === "unlimited" ? "10" : lootbox.maxTries;

    // Clear and populate items list
    const itemsList = document.getElementById("itemsList");
    if (itemsList) {
      itemsList.innerHTML = "";
      if (lootbox.items && lootbox.items.length > 0) {
        lootbox.items.forEach((item) => {
          this.addItemRow(item.name, item.odds);
        });
      } else {
        this.addItemRow();
      }
    }

    // Load and populate chest selection
    await this.populateChestSelection(lootbox.chestImage);

    this.updateTotalOdds();
  }

  async populateChestSelection(selectedChestImage = null) {
    const chestSelection = document.getElementById("chestSelection");
    if (!chestSelection) return;

    // Always use a local fallback list of chests since we have the images
    const defaultChests = [
      {
        file: "chest.png",
        name: "Default Chest",
        description: "Classic treasure chest",
      },
      {
        file: "metal.png",
        name: "Metal Chest",
        description: "Sturdy metal chest",
      },
      {
        file: "skull_bone.png",
        name: "Skull Chest",
        description: "Spooky bone chest",
      },
      {
        file: "wood_flower.png",
        name: "Flower Chest",
        description: "Wooden chest with flowers",
      },
      {
        file: "kid_happy.png",
        name: "Happy Kid Chest",
        description: "Cheerful kid-themed chest",
      },
      {
        file: "fruit_wood.png",
        name: "Fruity Chest",
        description: "Chest with fruit",
      },
      {
        file: "weapon_wood.png",
        name: "Weapon Chest",
        description: "Wooden chest with weapons",
      },
      {
        file: "orb_chest.png",
        name: "Orb Chest",
        description: "Chest with orbs",
      },
    ];

    let chests = defaultChests;

    try {
      // Try to get chests from Firebase, but use fallback if it fails
      const firebase = this.lootboxController.firebase;
      console.log("Firebase ready status:", firebase.isReady);

      if (firebase.isReady) {
        const firebaseChests = await firebase.loadAvailableChests();
        console.log("Loaded chests from Firebase:", firebaseChests);
        if (firebaseChests && firebaseChests.length > 0) {
          chests = firebaseChests;
        }
      }
    } catch (error) {
      console.error(
        "Error loading chests from Firebase, using defaults:",
        error
      );
    }

    console.log("Final chests to display:", chests);

    // Clear existing content
    chestSelection.innerHTML = "";

    // Create chest options
    chests.forEach((chest) => {
      const chestPath = `chests/${chest.file}`;
      const isSelected =
        selectedChestImage === chestPath ||
        (selectedChestImage === null && chest.file === "chest.png");

      const chestOption = document.createElement("div");
      chestOption.className = `chest-option${isSelected ? " selected" : ""}`;
      chestOption.dataset.image = chestPath;
      chestOption.innerHTML = `
        <img src="${chestPath}" alt="${chest.name}" onerror="console.error('Failed to load image: ${chestPath}')">
        <span>${chest.name}</span>
      `;

      // Add click handler
      chestOption.addEventListener("click", () => {
        // Remove selected class from all options
        document.querySelectorAll(".chest-option").forEach((opt) => {
          opt.classList.remove("selected");
        });
        // Add selected class to clicked option
        chestOption.classList.add("selected");
      });

      chestSelection.appendChild(chestOption);
    });
  }

  async showEditGroupBoxModal(groupBoxId) {
    console.log("showEditGroupBoxModal called with:", groupBoxId);

    const groupBox = this.groupBoxController.getGroupBox(groupBoxId);
    if (!groupBox || !groupBox.isCreator) {
      console.log("Not authorized to edit this group box");
      return;
    }

    // THIS IS THE CRITICAL LINE - SET THE STATE
    this.state.currentEditGroupBoxId = groupBoxId;
    console.log(
      "Set currentEditGroupBoxId to:",
      this.state.currentEditGroupBoxId
    );

    // Set the group box name
    const nameEl = document.getElementById("editGroupBoxName");
    if (nameEl) {
      nameEl.textContent = groupBox.groupBoxName;
    }

    // Populate items
    this.populateGroupBoxItems(groupBox);

    // Load and populate participants
    await this.loadGroupBoxParticipants(groupBoxId);

    // Show modal
    const modal = document.getElementById("groupBoxEditModal");
    if (modal) {
      modal.classList.add("show");
      this.lockBodyScroll();
    }
  }

  populateGroupBoxItems(groupBox) {
    const itemsList = document.getElementById("editItemsList");
    if (!itemsList) return;

    const items = groupBox.lootboxData?.items || groupBox.items || [];

    itemsList.innerHTML = "";

    items.forEach((item, index) => {
      const itemRow = document.createElement("div");
      itemRow.className = "edit-item-row";
      itemRow.innerHTML = `
            <input type="text" class="edit-item-name-input" value="${this.escapeHtml(
              item.name
            )}" data-index="${index}">
            <input type="number" class="edit-item-odds-input" value="${
              item.odds
            }" min="0" max="1" step="0.001" data-index="${index}">
            <button class="delete-item-btn" data-action="delete-edit-item" data-index="${index}">×</button>
        `;
      itemsList.appendChild(itemRow);
    });

    // Add event listeners for odds changes
    itemsList.querySelectorAll(".edit-item-odds-input").forEach((input) => {
      input.addEventListener("input", () => this.updateEditTotalOdds());
    });

    this.updateEditTotalOdds();
  }

  async loadGroupBoxParticipants(groupBoxId) {
    const usersList = document.getElementById("editUsersList");
    if (!usersList) return;

    usersList.innerHTML = '<div class="loading">Loading participants...</div>';

    try {
      if (!this.lootboxController.firebase.isReady) {
        usersList.innerHTML =
          '<div class="no-participants">Firebase not available</div>';
        return;
      }

      const groupBoxData = await this.lootboxController.firebase.loadGroupBox(
        groupBoxId
      );
      if (!groupBoxData) {
        usersList.innerHTML =
          '<div class="no-participants">Group box not found</div>';
        return;
      }

      const participants = groupBoxData.participants || [];

      if (participants.length === 0) {
        usersList.innerHTML = `
                <div class="edit-user-row">
                    <div class="edit-user-info">
                        <div class="edit-user-name">No participants yet</div>
                        <div class="edit-user-stats">
                            <span>Share the group box link to invite participants</span>
                        </div>
                    </div>
                </div>
            `;
        return;
      }

      // Render participants with interactive controls
      usersList.innerHTML = participants
        .map(
          (participant) => `
      <div class="edit-user-row" data-user-id="${participant.userId}">
        <div class="edit-user-info">
          <div class="edit-user-name">
            ${this.escapeHtml(participant.userName.substring(0, 5))}
            ${
              participant.userId === groupBoxData.createdBy
                ? '<span class="creator-badge">Creator</span>'
                : ""
            }
          </div>
          <div class="edit-user-stats">
            <span>Opens: ${participant.userTotalOpens || 0}</span>
            <span style="margin-left:12px;">
              Remaining: <strong id="remaining-${participant.userId}">
                ${participant.userRemainingTries ?? 0}
              </strong>
            </span>
          </div>
        </div>

<div class="tries-control">
    <button class="tries-btn minus"
            data-action="adjust-tries-display"
            data-user-id="${participant.userId}"
            data-delta="-1"
            type="button">−</button>

    <input type="number" 
           class="tries-input" 
           id="tries-${participant.userId}"
           value="${participant.userRemainingTries ?? 0}"
           min="0"
           max="999"
           data-original="${participant.userRemainingTries ?? 0}"
           data-user-id="${participant.userId}">

    <button class="tries-btn plus"
            data-action="adjust-tries-display"
            data-user-id="${participant.userId}"
            data-delta="1"
            type="button">+</button>
</div>
      </div>
    `
        )
        .join("");
      // Wire up +/− buttons (replace any old handler)
      usersList.onclick = null;

      usersList.onclick = async (e) => {
        const btn = e.target.closest('[data-action="adjust-tries"]');
        if (!btn || btn.disabled) return;

        console.log("UIController button click detected");
        e.preventDefault();
        e.stopPropagation();

        const userId = btn.dataset.userId;
        const delta = parseInt(btn.dataset.delta, 10);
        const gbId = this.state.currentEditGroupBoxId || groupBoxId;

        // Disable ALL adjust buttons immediately
        usersList
          .querySelectorAll('[data-action="adjust-tries"]')
          .forEach((b) => (b.disabled = true));

        try {
          await this.adjustUserTries(userId, gbId, delta);
        } finally {
          // Re-enable all buttons after a delay
          setTimeout(() => {
            usersList
              .querySelectorAll('[data-action="adjust-tries"]')
              .forEach((b) => (b.disabled = false));
          }, 500);
        }
      };
    } catch (error) {
      console.error("Error loading participants:", error);
      usersList.innerHTML =
        '<div class="no-participants">Error loading participants</div>';
    }
  }

  async adjustUserTries(userId, groupBoxId, delta) {
    try {
      const res = await this.groupBoxController.adjustUserTries(
        groupBoxId,
        userId,
        parseInt(delta, 10)
      );
      if (res.success) {
        // Update the number shown in the modal
        const disp = document.getElementById(`remaining-${userId}`);
        if (disp) disp.textContent = res.newTries;
        this.showToast(`Updated tries to ${res.newTries}`);
      } else {
        this.showToast(res.error || "Failed to adjust tries", "error");
      }
    } catch (error) {
      console.error("Error adjusting user tries:", error);
      this.showToast("Failed to adjust tries", "error");
    }
  }

  addEditItem() {
    const itemsList = document.getElementById("editItemsList");
    if (!itemsList) return;

    const itemRow = document.createElement("div");
    itemRow.className = "edit-item-row";
    const newIndex = itemsList.children.length;

    itemRow.innerHTML = `
        <input type="text" class="edit-item-name-input" placeholder="New item" data-index="${newIndex}">
        <input type="number" class="edit-item-odds-input" placeholder="0.000" min="0" max="1" step="0.001" value="0" data-index="${newIndex}">
        <button class="delete-item-btn" data-action="delete-edit-item" data-index="${newIndex}">×</button>
    `;

    itemsList.appendChild(itemRow);

    // Add event listener for the new odds input
    itemRow
      .querySelector(".edit-item-odds-input")
      .addEventListener("input", () => {
        this.updateEditTotalOdds();
      });

    this.updateEditTotalOdds();
  }

  deleteEditItem(index) {
    const itemsList = document.getElementById("editItemsList");
    if (!itemsList) return;

    const rows = itemsList.querySelectorAll(".edit-item-row");
    if (rows[index]) {
      rows[index].remove();

      // Re-index remaining items
      itemsList.querySelectorAll(".edit-item-row").forEach((row, idx) => {
        row.querySelectorAll("[data-index]").forEach((el) => {
          el.dataset.index = idx;
        });
      });

      this.updateEditTotalOdds();
    }
  }

  evenEditOdds() {
    const itemsList = document.getElementById("editItemsList");
    if (!itemsList) return;

    const oddsInputs = itemsList.querySelectorAll(".edit-item-odds-input");
    if (oddsInputs.length === 0) return;

    const baseOdds = 1 / oddsInputs.length;
    let runningTotal = 0;

    oddsInputs.forEach((input, index) => {
      if (index < oddsInputs.length - 1) {
        const value = parseFloat(baseOdds.toFixed(3));
        input.value = value;
        runningTotal += value;
      } else {
        // Last item absorbs the difference to make exactly 1
        input.value = (1 - runningTotal).toFixed(3);
      }
    });

    this.updateEditTotalOdds();
  }

  randomizeEditOdds() {
    const itemsList = document.getElementById("editItemsList");
    if (!itemsList) return;

    const oddsInputs = itemsList.querySelectorAll(".edit-item-odds-input");
    if (oddsInputs.length === 0) return;

    // Generate random weights
    const weights = Array.from({ length: oddsInputs.length }, () =>
      Math.random()
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let runningTotal = 0;

    // Normalize to sum to 1
    weights.forEach((weight, index) => {
      if (index < weights.length - 1) {
        const normalizedOdds = parseFloat((weight / totalWeight).toFixed(3));
        oddsInputs[index].value = normalizedOdds;
        runningTotal += normalizedOdds;
      } else {
        // Last item absorbs the difference to make exactly 1
        oddsInputs[index].value = (1 - runningTotal).toFixed(3);
      }
    });

    this.updateEditTotalOdds();
  }

  updateEditTotalOdds() {
    const itemsList = document.getElementById("editItemsList");
    const totalOddsEl = document.getElementById("editTotalOdds");
    if (!itemsList || !totalOddsEl) return;

    const oddsInputs = itemsList.querySelectorAll(".edit-item-odds-input");
    let total = 0;

    oddsInputs.forEach((input) => {
      const value = parseFloat(input.value) || 0;
      total += value;
    });

    totalOddsEl.textContent = total.toFixed(3);
    totalOddsEl.style.color =
      Math.abs(total - 1) < 0.001 ? "#10b981" : "#ef4444";
  }

  async saveGroupBoxChanges() {
    console.log("saveGroupBoxChanges called");

    const groupBoxId = this.state.currentEditGroupBoxId;
    console.log("currentEditGroupBoxId:", groupBoxId);

    if (!groupBoxId) {
      console.log("No groupBoxId found");
      this.showToast("No group box ID found", "error");
      return;
    }

    const groupBox = this.groupBoxController.getGroupBox(groupBoxId);
    console.log("Found groupBox:", groupBox);

    if (!groupBox) {
      console.log("GroupBox not found");
      this.showToast("Group box not found", "error");
      return;
    }

    // First, collect and apply tries changes
    const triesInputs = document.querySelectorAll(".tries-input");
    const triesUpdates = [];

    for (const input of triesInputs) {
      const userId = input.dataset.userId;
      const originalValue = parseInt(input.dataset.original) || 0;
      const newValue = parseInt(input.value) || 0;

      if (newValue !== originalValue) {
        const delta = newValue - originalValue;
        triesUpdates.push({ userId, delta, newValue });
      }
    }

    // Apply tries changes to Firebase
    if (triesUpdates.length > 0) {
      this.showToast("Updating tries for participants...");

      for (const update of triesUpdates) {
        try {
          await this.groupBoxController.adjustUserTries(
            groupBoxId,
            update.userId,
            update.delta
          );
          console.log(
            `Updated tries for user ${update.userId}: ${
              update.delta > 0 ? "+" : ""
            }${update.delta}`
          );
        } catch (error) {
          console.error(
            `Failed to update tries for user ${update.userId}:`,
            error
          );
          this.showToast(`Failed to update tries for a user`, "error");
        }
      }
    }

    // Now handle items changes (existing code)
    const itemsList = document.getElementById("editItemsList");
    const items = [];

    itemsList.querySelectorAll(".edit-item-row").forEach((row) => {
      const nameInput = row.querySelector(".edit-item-name-input");
      const oddsInput = row.querySelector(".edit-item-odds-input");

      if (nameInput && oddsInput && nameInput.value.trim()) {
        items.push({
          name: nameInput.value.trim(),
          odds: parseFloat(oddsInput.value) || 0,
        });
      }
    });

    console.log("Collected items:", items);

    // Validate odds sum to ~1
    const totalOdds = items.reduce((sum, item) => sum + item.odds, 0);
    console.log("Total odds:", totalOdds);

    if (Math.abs(totalOdds - 1) > 0.001) {
      this.showToast("Item odds must sum to 100%", "error");
      return;
    }

    // Update the group box items
    try {
      // Update local copy
      groupBox.items = items;
      groupBox.lootboxData.items = items;

      console.log("Saving to Firebase...");

      // Save to Firebase
      if (this.lootboxController.firebase.isReady) {
        const { updateDoc, doc } = window.firebaseFunctions;
        await updateDoc(
          doc(this.lootboxController.firebase.db, "group_boxes", groupBoxId),
          {
            "lootboxData.items": items,
            updatedAt: new Date().toISOString(),
          }
        );
        console.log("Firebase update successful");
      }

      this.showToast(
        `Group box updated successfully${
          triesUpdates.length > 0 ? " (including tries changes)" : ""
        }`
      );
      this.closeModal("groupBoxEditModal");
      this.render(); // Refresh the view
    } catch (error) {
      console.error("Error saving group box changes:", error);
      this.showToast("Failed to save changes", "error");
    }
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  // Modal management methods
  showDeleteConfirmModal() {
    const modal = document.getElementById("deleteModal");
    if (modal) {
      modal.classList.add("show");
      this.lockBodyScroll();
    }
  }

  showCreatorDeleteModal() {
    const modal = document.getElementById("creatorDeleteModal");
    if (modal) {
      modal.classList.add("show");
      this.lockBodyScroll();
    }
  }

  showShareModal() {
    const modal = document.getElementById("shareModal");
    if (modal) {
      modal.classList.add("show");
      this.lockBodyScroll();
    }
  }

  showGroupBoxShareModal(groupBoxId) {
    const modal = document.getElementById("shareModal");
    if (modal) {
      modal.classList.add("show");
      this.lockBodyScroll();
    }
  }

  closeDeleteModals() {
    const deleteModal = document.getElementById("deleteModal");
    const creatorDeleteModal = document.getElementById("creatorDeleteModal");
    if (deleteModal) deleteModal.classList.remove("show");
    if (creatorDeleteModal) creatorDeleteModal.classList.remove("show");
    this.unlockBodyScroll();
  }

  // Form management methods
  addItemRow(defaultName = "", defaultOdds = "") {
    const itemsList = document.getElementById("itemsList");
    if (!itemsList) return;

    const itemIndex = itemsList.children.length;
    const itemRow = document.createElement("div");
    itemRow.className = "item-row";
    itemRow.innerHTML = `
      <input type="text" class="form-input item-name" placeholder="Item name" value="${defaultName}">
      <input type="number" class="form-input item-odds" placeholder="0.000" min="0" max="1" step="0.001" value="${defaultOdds}">
      <button class="remove-item-btn" data-action="remove-item" data-index="${itemIndex}">×</button>
    `;
    itemsList.appendChild(itemRow);

    // Add event listener for the new odds input
    const oddsInput = itemRow.querySelector(".item-odds");
    if (oddsInput) {
      oddsInput.addEventListener("input", () => this.updateTotalOdds());
    }

    this.updateTotalOdds();
  }

  removeItemRow(index) {
    const itemsList = document.getElementById("itemsList");
    if (!itemsList || !itemsList.children[index]) return;

    itemsList.removeChild(itemsList.children[index]);

    // Update indices for remaining items
    Array.from(itemsList.children).forEach((row, idx) => {
      const removeBtn = row.querySelector('[data-action="remove-item"]');
      if (removeBtn) {
        removeBtn.dataset.index = idx;
      }
    });

    this.updateTotalOdds();
  }

  distributeOddsEvenly() {
    const itemsList = document.getElementById("itemsList");
    if (!itemsList) return;

    const oddsInputs = itemsList.querySelectorAll(".item-odds");
    if (oddsInputs.length === 0) return;

    const baseOdds = 1 / oddsInputs.length;
    let runningTotal = 0;

    oddsInputs.forEach((input, index) => {
      if (index < oddsInputs.length - 1) {
        const value = parseFloat(baseOdds.toFixed(3));
        input.value = value;
        runningTotal += value;
      } else {
        // Last item absorbs the difference to make exactly 1
        input.value = (1 - runningTotal).toFixed(3);
      }
    });

    this.updateTotalOdds();
  }

  randomizeOdds() {
    const itemsList = document.getElementById("itemsList");
    if (!itemsList) return;

    const oddsInputs = itemsList.querySelectorAll(".item-odds");
    if (oddsInputs.length === 0) return;

    // Generate random weights
    const weights = Array.from({ length: oddsInputs.length }, () =>
      Math.random()
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let runningTotal = 0;

    // Normalize to sum to 1
    weights.forEach((weight, index) => {
      if (index < weights.length - 1) {
        const normalizedOdds = parseFloat((weight / totalWeight).toFixed(3));
        oddsInputs[index].value = normalizedOdds;
        runningTotal += normalizedOdds;
      } else {
        // Last item absorbs the difference to make exactly 1
        oddsInputs[index].value = (1 - runningTotal).toFixed(3);
      }
    });

    this.updateTotalOdds();
  }

  updateTotalOdds() {
    const itemsList = document.getElementById("itemsList");
    const totalOddsEl = document.getElementById("totalOdds");
    if (!itemsList || !totalOddsEl) return;

    const oddsInputs = itemsList.querySelectorAll(".item-odds");
    let total = 0;

    oddsInputs.forEach((input) => {
      const value = parseFloat(input.value) || 0;
      total += value;
    });

    totalOddsEl.textContent = total.toFixed(3);

    // Update styling based on whether total is close to 1
    const isValid = Math.abs(total - 1) < 0.001;
    totalOddsEl.style.color = isValid ? "#10b981" : "#ef4444";
  }

  collectLootboxFormData(formData) {
    const name = document.getElementById("lootboxName")?.value || "";
    const revealContents =
      document.getElementById("revealContents")?.checked || false;
    const revealOdds = document.getElementById("revealOdds")?.checked || false;
    const unlimitedTries =
      document.getElementById("unlimitedTries")?.checked || false;
    const maxTries = unlimitedTries
      ? "unlimited"
      : parseInt(document.getElementById("maxTries")?.value) || 10;

    // Get selected chest image
    const selectedChest = document.querySelector(".chest-option.selected");
    const chestImage = selectedChest?.dataset.image || "chests/chest.png";

    // Collect items
    const itemsList = document.getElementById("itemsList");
    const items = [];
    if (itemsList) {
      const itemRows = itemsList.querySelectorAll(".item-row");
      itemRows.forEach((row) => {
        const name = row.querySelector(".item-name")?.value;
        const odds = parseFloat(row.querySelector(".item-odds")?.value) || 0;
        if (name && odds > 0) {
          items.push({ name: name.trim(), odds });
        }
      });
    }

    return {
      name: name.trim(),
      items,
      chestImage,
      revealContents,
      revealOdds,
      maxTries,
      remainingTries: maxTries,
      spins: 0,
      lastUsed: null,
      favorite: false,
      imported: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  collectGroupBoxFormData(formData) {
    const groupBoxName = document.getElementById("groupBoxName")?.value || "";
    const triesPerPerson =
      parseInt(document.getElementById("triesPerPerson")?.value) || 3;
    const unlimitedGroupTries =
      document.getElementById("unlimitedGroupTries")?.checked || false;
    const expiresIn = document.getElementById("expiresIn")?.value || "24";
    const creatorParticipates =
      document.getElementById("creatorParticipates")?.checked || false;
    const hideContents =
      document.getElementById("hideContents")?.checked || false;
    const hideOdds = document.getElementById("hideOdds")?.checked || false;

    return {
      groupBoxName: groupBoxName.trim(),
      triesPerPerson: unlimitedGroupTries ? "unlimited" : triesPerPerson,
      unlimitedGroupTries,
      expiresIn,
      creatorParticipates,
      hideContents,
      hideOdds,
    };
  }

  showFormErrors(errors) {
    // Clear previous errors
    document.querySelectorAll(".error-message").forEach((el) => {
      el.classList.add("hidden");
    });

    // Show new errors
    errors.forEach((error) => {
      // Ensure error is a string and not null/undefined
      const safeError = error?.toString() || "Unknown error";

      if (safeError.includes("name")) {
        const nameError = document.getElementById("nameError");
        if (nameError) {
          nameError.textContent = safeError;
          nameError.classList.remove("hidden");
        }
      } else if (safeError.includes("items")) {
        const itemsError = document.getElementById("itemsError");
        if (itemsError) {
          itemsError.textContent = safeError;
          itemsError.classList.remove("hidden");
        }
      } else {
        // Show general error as toast
        this.showToast(safeError, "error");
      }
    });
  }

  // Sorting helper method - pure chronological by most recent activity
  sortItemsByUsage(a, b) {
    const aData = a.data;
    const bData = b.data;

    // Get the most recent activity timestamp for each item
    // Priority: lastUsed/lastParticipated > createdAt/importedAt/firstParticipated
    const aMostRecent = new Date(
      aData.lastUsed ||
        aData.lastParticipated ||
        aData.createdAt ||
        aData.importedAt ||
        aData.firstParticipated ||
        aData.updatedAt ||
        0
    );

    const bMostRecent = new Date(
      bData.lastUsed ||
        bData.lastParticipated ||
        bData.createdAt ||
        bData.importedAt ||
        bData.firstParticipated ||
        bData.updatedAt ||
        0
    );

    // Debug logging
    console.log(
      `Chronological sort: ${aData.name || aData.groupBoxName} (${
        a.type
      }) mostRecent=${aMostRecent} vs ${bData.name || bData.groupBoxName} (${
        b.type
      }) mostRecent=${bMostRecent}`
    );

    // Most recent activity first
    return bMostRecent - aMostRecent;
  }

  // Add other UI methods as needed...
}

export default UIController;

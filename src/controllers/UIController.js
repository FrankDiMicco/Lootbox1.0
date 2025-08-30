// src/controllers/UIController.js
import LootboxCard from "../views/components/LootboxCard.js";
import GroupBoxCard from "../views/components/GroupBoxCard.js";

class UIController {
  constructor(lootboxController, groupBoxController, appState) {
    this.lootboxController = lootboxController;
    this.groupBoxController = groupBoxController;
    this.state = appState;
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
    const groupBoxes = this.groupBoxController.getAllGroupBoxes();

    console.log("Raw lootboxes from controller:", lootboxes);
    console.log("Raw groupBoxes from controller:", groupBoxes);

    // Log the first lootbox to see its structure
    if (lootboxes.length > 0) {
      console.log("First lootbox object:", lootboxes[0]);
      console.log("First lootbox properties:", {
        name: lootboxes[0].name,
        spins: lootboxes[0].spins,
        chestImage: lootboxes[0].chestImage,
        items: lootboxes[0].items,
        hasToObject: typeof lootboxes[0].toObject === "function",
      });
      if (typeof lootboxes[0].toObject === "function") {
        console.log("First lootbox toObject():", lootboxes[0].toObject());
      }
    }

    // Combine and filter
    let allItems = [];

    if (this.state.currentFilter === "all") {
      allItems = [
        ...lootboxes.map((lb, idx) => {
          // Get the data - if the model has toObject use it, otherwise use the object directly
          let data;
          if (typeof lb.toObject === "function") {
            data = lb.toObject();
          } else {
            // If no toObject method, use the instance properties directly
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
          console.log(`Lootbox ${idx} data:`, data);
          return {
            type: "lootbox",
            data: data,
            index: idx,
          };
        }),
        ...groupBoxes.map((gb) => {
          // Get the data - if the model has toObject use it, otherwise use the object directly
          let data;
          if (typeof gb.toObject === "function") {
            data = gb.toObject();
          } else {
            // If no toObject method, use the instance properties directly
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
          return {
            type: "groupbox",
            data: data,
          };
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
          .map((lb, idx) => ({
            type: "lootbox",
            data: lb.toObject ? lb.toObject() : lb,
            index: idx,
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
          .map((lb, idx) => ({
            type: "lootbox",
            data: lb.toObject ? lb.toObject() : lb,
            index: idx,
          })),
        ...groupBoxes
          .filter((gb) => (gb.userTotalOpens || 0) === 0 && !gb.isOrganizerOnly)
          .map((gb) => ({
            type: "groupbox",
            data: gb.toObject ? gb.toObject() : gb,
          })),
      ];
    }

    // Sort items: new boxes first (spins/opens = 0), then by recent usage
    allItems.sort(this.sortItemsByUsage);

    console.log("Sorted items to render:", allItems);

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

    // Make sure we're showing the list view
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
      titleEl.textContent = lootbox.name || lootbox.groupBoxName || "Lootbox";
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

    this.state.currentView = "list";
    this.state.currentLootbox = null;
    this.render();
  }

  async openLootbox(index) {
    console.log("Opening lootbox at index:", index);
    const lootbox = this.lootboxController.getLootbox(index);
    if (lootbox) {
      this.state.currentView = "lootbox";
      this.state.currentLootbox = lootbox;
      this.state.currentLootboxIndex = index;
      this.render();
    } else {
      console.error("Lootbox not found at index:", index);
    }
  }

  async openGroupBox(groupBoxId) {
    console.log("Opening group box:", groupBoxId);
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
      // Get the complete history from Firebase - this is the source of truth
      const sharedHistory =
        await this.lootboxController.firebase.getSessionHistory(groupBoxId);

      // Format the history properly
      const formattedHistory = sharedHistory.map((event) => ({
        ...event,
        timestamp:
          event.timestamp instanceof Date
            ? event.timestamp.toISOString()
            : event.timestamp,
      }));

      // REPLACE local history completely (don't merge) - this ensures everyone sees the same thing
      this.state.groupBoxHistories.set(groupBoxId, formattedHistory);
      this.state.communityHistory = formattedHistory;

      // Update the display
      this.updateSessionDisplay();

      console.log(
        `Refreshed group box ${groupBoxId} with ${formattedHistory.length} events from Firebase`
      );
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
            let displayText = entry.message || "";
            let cssClass = "history-item";

            // Ensure entry properties are not null
            const safeUserName = entry.userName || "Unknown User";
            const safeItem = entry.item || "unknown item";

            switch (entry.type) {
              case "join":
                cssClass += " history-join";
                displayText = entry.message || `${safeUserName} joined the box`;
                break;
              case "leave":
                cssClass += " history-leave";
                displayText = entry.message || `${safeUserName} left the box`;
                break;
              case "spin":
                cssClass += " history-spin";
                displayText =
                  entry.message || `${safeUserName} got "${safeItem}"`;
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

    // Update total pulls - ONLY count actual spins, not joins/leaves
    const totalPullsEl = document.getElementById("totalPulls");
    if (totalPullsEl) {
      if (this.state.currentLootbox?.isGroupBox) {
        // For group boxes, only count 'spin' events
        const actualPulls = history.filter(
          (entry) => entry.type === "spin"
        ).length;
        totalPullsEl.textContent = actualPulls;
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
    } else if (this.state.isOnCooldown) {
      circleEl.classList.add("on-cooldown");
      buttonEl.disabled = true;
    } else if (!canSpin) {
      circleEl.classList.add("on-cooldown");
      buttonEl.disabled = true;
    } else {
      circleEl.classList.remove("on-cooldown", "organizer-readonly");
      buttonEl.disabled = false;
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
    await this.initializeModalForm();
  }

  async showEditModal(index) {
    this.state.editingIndex = index;
    const lootbox = this.lootboxController.getLootbox(index);
    if (!lootbox) return;

    document.getElementById("modalTitle").textContent = "Edit Lootbox";
    document.getElementById("editModal").classList.add("show");
    await this.populateModalForm(lootbox);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("show");
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
          this.addItemRow();
          const lastRow = itemsList.lastElementChild;
          if (lastRow) {
            const nameInput = lastRow.querySelector(".item-name");
            const oddsInput = lastRow.querySelector(".item-odds");
            if (nameInput) nameInput.value = item.name;
            if (oddsInput) oddsInput.value = item.odds;
          }
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

  // Modal management methods
  showDeleteConfirmModal() {
    const modal = document.getElementById("deleteModal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  showCreatorDeleteModal() {
    const modal = document.getElementById("creatorDeleteModal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  showShareModal() {
    const modal = document.getElementById("shareModal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  showGroupBoxShareModal(groupBoxId) {
    const modal = document.getElementById("shareModal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  showEditGroupBoxModal(groupBoxId) {
    const modal = document.getElementById("groupBoxEditModal");
    if (modal) {
      modal.classList.add("show");
    }
  }

  closeDeleteModals() {
    const deleteModal = document.getElementById("deleteModal");
    const creatorDeleteModal = document.getElementById("creatorDeleteModal");
    if (deleteModal) deleteModal.classList.remove("show");
    if (creatorDeleteModal) creatorDeleteModal.classList.remove("show");
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

    const evenOdds = (1 / oddsInputs.length).toFixed(3);
    oddsInputs.forEach((input) => {
      input.value = evenOdds;
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

    // Normalize to sum to 1
    weights.forEach((weight, index) => {
      const normalizedOdds = (weight / totalWeight).toFixed(3);
      oddsInputs[index].value = normalizedOdds;
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

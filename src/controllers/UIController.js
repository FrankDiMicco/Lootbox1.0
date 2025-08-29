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

    console.log("Filtered items to render:", allItems);

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
    if (groupBox) {
      this.state.currentView = "lootbox";
      this.state.currentLootbox = groupBox;
      this.state.currentGroupBoxId = groupBoxId;
      this.state.isOrganizerReadonly = groupBox.isOrganizerOnly;
      this.render();
    } else {
      console.error("Group box not found:", groupBoxId);
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
        '<div class="no-history">No pulls yet this session</div>';
    } else {
      historyList.innerHTML = history
        .slice(0, 50)
        .map((entry) => {
          const timeStr = new Date(entry.timestamp).toLocaleTimeString();
          return `
          <div class="history-item">
            <div class="history-item-name">${entry.item}</div>
            <div class="history-item-time">${timeStr}</div>
          </div>
        `;
        })
        .join("");
    }

    // Update total pulls
    const totalPullsEl = document.getElementById("totalPulls");
    if (totalPullsEl) {
      totalPullsEl.textContent = history.length;
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

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

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
  showCreateModal() {
    this.state.editingIndex = -1;
    document.getElementById("modalTitle").textContent = "Create New Lootbox";
    document.getElementById("editModal").classList.add("show");
    this.initializeModalForm();
  }

  showEditModal(index) {
    this.state.editingIndex = index;
    const lootbox = this.lootboxController.getLootbox(index);
    if (!lootbox) return;

    document.getElementById("modalTitle").textContent = "Edit Lootbox";
    document.getElementById("editModal").classList.add("show");
    this.populateModalForm(lootbox);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("show");
    }
  }

  initializeModalForm() {
    // Implementation for initializing empty form
    console.log("Initialize modal form");
  }

  populateModalForm(lootbox) {
    // Implementation for populating form with lootbox data
    console.log("Populate modal form with:", lootbox.name);
  }

  // Add other UI methods as needed...
}

export default UIController;

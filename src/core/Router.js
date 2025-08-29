// src/core/Router.js
class Router {
  constructor(app) {
    this.app = app;
  }

  async handleCurrentRoute() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get("share");
    const groupBoxId = urlParams.get("groupbox");

    if (sharedData) {
      await this.handleSharedLootbox(sharedData);
    } else if (groupBoxId) {
      await this.handleGroupBoxJoin(groupBoxId);
    }

    // Clean URL after handling
    this.cleanUrl();
  }

  async handleSharedLootbox(sharedData) {
    try {
      const lootboxData = JSON.parse(decodeURIComponent(sharedData));
      const result = await this.app.controllers.lootbox.importSharedLootbox(
        lootboxData
      );

      if (result.success) {
        this.app.controllers.ui.showToast(result.message);
        this.app.controllers.ui.render();
      } else {
        this.app.controllers.ui.showToast(result.errors[0], "error");
      }
    } catch (error) {
      console.error("Error importing shared lootbox:", error);
      this.app.controllers.ui.showToast("Invalid share link", "error");
    }
  }

  async handleGroupBoxJoin(groupBoxId) {
    try {
      const result = await this.app.controllers.groupBox.joinGroupBox(
        groupBoxId
      );

      if (result.success) {
        if (result.alreadyJoined) {
          this.app.controllers.ui.openGroupBox(groupBoxId);
        } else {
          this.app.controllers.ui.showToast(
            `Joined "${result.groupBox.groupBoxName}"`
          );
        }
      } else {
        this.app.controllers.ui.showToast(result.errors[0], "error");
      }
    } catch (error) {
      console.error("Error joining group box:", error);
      this.app.controllers.ui.showToast("Error joining group box", "error");
    }
  }

  cleanUrl() {
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
}

export default Router;

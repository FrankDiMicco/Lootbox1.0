// src/models/Lootbox.js
// This file should contain the Lootbox MODEL, not the LootboxCard component

class Lootbox {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || "Unnamed Lootbox";
    this.items = data.items || [];
    this.chestImage = data.chestImage || "chests/chest.png";
    this.revealContents =
      data.revealContents !== undefined ? data.revealContents : true;
    this.revealOdds = data.revealOdds !== undefined ? data.revealOdds : true;
    this.maxTries = data.maxTries || "unlimited";
    this.remainingTries =
      data.remainingTries !== undefined ? data.remainingTries : "unlimited"; // Default to unlimited for regular lootboxes
    this.spins = data.spins || 0;
    this.viewed = data.viewed || false;
    this.lastUsed = data.lastUsed || null;
    this.favorite = data.favorite || false;
    this.imported = data.imported || false;
    this.importedAt = data.importedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Getter to check if lootbox can be spun
  get canSpin() {
    // Must have items
    if (!this.items || this.items.length === 0) {
      return false;
    }

    // Regular lootboxes have unlimited tries
    if (this.maxTries === "unlimited" || this.remainingTries === "unlimited") {
      return true;
    }

    // Check remaining tries for limited lootboxes
    return this.remainingTries > 0;
  }

  spin() {
    if (!this.canSpin) {
      throw new Error("Cannot spin: no remaining tries or no items");
    }

    // Calculate weighted random selection
    const totalOdds = this.items.reduce(
      (sum, item) => sum + (item.odds || 0),
      0
    );
    let random = Math.random() * totalOdds;

    let selectedItem = null;
    for (const item of this.items) {
      random -= item.odds || 0;
      if (random <= 0) {
        selectedItem = item;
        break;
      }
    }

    // Fallback to first item if something went wrong
    if (!selectedItem) {
      selectedItem = this.items[0];
    }

    // Update statistics
    this.spins++;
    this.lastUsed = new Date().toISOString();

    // Decrement tries if not unlimited
    if (
      this.maxTries !== "unlimited" &&
      this.remainingTries !== "unlimited" &&
      this.remainingTries > 0
    ) {
      this.remainingTries--;
    }

    return {
      item: selectedItem.name,
      timestamp: this.lastUsed,
    };
  }

  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === "") {
      errors.push("Lootbox name is required");
    }

    if (!this.items || this.items.length === 0) {
      errors.push("At least one item is required");
    } else {
      // Validate odds sum to approximately 1
      const totalOdds = this.items.reduce(
        (sum, item) => sum + (item.odds || 0),
        0
      );
      if (Math.abs(totalOdds - 1) > 0.01) {
        errors.push(
          `Item odds must sum to 100% (currently ${(totalOdds * 100).toFixed(
            1
          )}%)`
        );
      }
    }

    if (this.maxTries !== "unlimited") {
      const tries = parseInt(this.maxTries);
      if (isNaN(tries) || tries < 1) {
        errors.push("Max tries must be at least 1 or unlimited");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      items: this.items,
      chestImage: this.chestImage,
      revealContents: this.revealContents,
      revealOdds: this.revealOdds,
      maxTries: this.maxTries,
      remainingTries: this.remainingTries,
      spins: this.spins,
      viewed: this.viewed,
      lastUsed: this.lastUsed,
      favorite: this.favorite,
      imported: this.imported,
      importedAt: this.importedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export default Lootbox;

// src/controllers/LootboxController.js
import Lootbox from "../models/Lootbox.js";

class LootboxController {
  constructor(firebaseService, storageService) {
    this.firebase = firebaseService;
    this.storage = storageService;
    this.lootboxes = [];
  }

  async initialize() {
    try {
      console.log("Initializing LootboxController...");

      // Only use Firebase if available, otherwise use localStorage
      if (this.firebase.isReady) {
        console.log("Loading lootboxes from Firebase...");
        const firebaseLootboxes = await this.firebase.loadLootboxes();

        // Convert to Lootbox instances
        this.lootboxes = firebaseLootboxes.map((data) => {
          if (data instanceof Lootbox) {
            return data;
          }
          return new Lootbox(data);
        });

        console.log(`Loaded ${this.lootboxes.length} lootboxes from Firebase`);

        // Clear localStorage to prevent duplicates
        this.storage.remove("lootboxes");
      } else {
        console.log("Firebase not available, loading from localStorage...");
        const storageLootboxes = this.storage.loadLootboxes();

        // Convert to Lootbox instances
        this.lootboxes = storageLootboxes.map((data) => {
          if (data instanceof Lootbox) {
            return data;
          }
          return new Lootbox(data);
        });

        console.log(
          `Loaded ${this.lootboxes.length} lootboxes from localStorage`
        );
      }
    } catch (error) {
      console.error("Error initializing lootboxes:", error);
      this.lootboxes = [];
    }
  }

  async syncLocalToFirebase() {
    if (!this.firebase.isReady) return;

    const localBoxes = this.storage.loadLootboxes();
    const firebaseBoxes = await this.firebase.loadLootboxes();

    // Find boxes that exist locally but not in Firebase
    const firebaseIds = new Set(
      firebaseBoxes.map((b) => b.id).filter((id) => id)
    );

    for (const localBox of localBoxes) {
      if (!localBox.id || !firebaseIds.has(localBox.id)) {
        // This box doesn't exist in Firebase - upload it
        const id = await this.firebase.saveLootbox(localBox);
        localBox.id = id;
        console.log(`Synced local box "${localBox.name}" to Firebase`);
      }
    }
  }

  getAllLootboxes() {
    return this.lootboxes;
  }

  getLootbox(index) {
    return this.lootboxes[index] || null;
  }

  async createLootbox(data) {
    try {
      const lootbox = new Lootbox(data);
      const validation = lootbox.validate();

      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Save to Firebase and get the ID
      if (this.firebase.isReady) {
        const id = await this.firebase.saveLootbox(lootbox.toObject());
        lootbox.id = id;
      }

      // Add to local array
      this.lootboxes.push(lootbox);

      // Save to localStorage as backup
      this.saveToLocalStorage();

      return { success: true, lootbox, index: this.lootboxes.length - 1 };
    } catch (error) {
      console.error("Error creating lootbox:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async updateLootbox(index, data) {
    try {
      if (index < 0 || index >= this.lootboxes.length) {
        return { success: false, errors: ["Invalid lootbox index"] };
      }

      const existingLootbox = this.lootboxes[index];
      const updatedLootbox = new Lootbox({
        ...existingLootbox.toObject(),
        ...data,
        id: existingLootbox.id, // Preserve the ID
      });

      const validation = updatedLootbox.validate();
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Update in Firebase if it has an ID
      if (this.firebase.isReady && updatedLootbox.id) {
        await this.firebase.saveLootbox(updatedLootbox.toObject());
      }

      // Update local array
      this.lootboxes[index] = updatedLootbox;

      // Save to localStorage as backup
      this.saveToLocalStorage();

      return { success: true, lootbox: updatedLootbox };
    } catch (error) {
      console.error("Error updating lootbox:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async deleteLootbox(index) {
    try {
      if (index < 0 || index >= this.lootboxes.length) {
        return { success: false, errors: ["Invalid lootbox index"] };
      }

      const lootbox = this.lootboxes[index];
      const name = lootbox.name;

      // Delete from Firebase if it has an ID
      if (this.firebase.isReady && lootbox.id) {
        await this.firebase.deleteLootbox(lootbox.id);
      }

      // Remove from local array
      this.lootboxes.splice(index, 1);

      // Save to localStorage as backup
      this.saveToLocalStorage();

      return { success: true, deletedName: name };
    } catch (error) {
      console.error("Error deleting lootbox:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async toggleFavorite(index) {
    try {
      if (index < 0 || index >= this.lootboxes.length) {
        return { success: false };
      }

      const lootbox = this.lootboxes[index];
      lootbox.favorite = !lootbox.favorite;
      lootbox.updatedAt = new Date().toISOString();

      // Update in Firebase if it has an ID
      if (this.firebase.isReady && lootbox.id) {
        await this.firebase.saveLootbox(lootbox.toObject());
      }

      // Save to localStorage as backup
      this.saveToLocalStorage();

      return { success: true };
    } catch (error) {
      console.error("Error toggling favorite:", error);
      return { success: false };
    }
  }

  async spinLootbox(index) {
    try {
      if (index < 0 || index >= this.lootboxes.length) {
        return { success: false, errors: ["Invalid lootbox index"] };
      }

      const lootbox = this.lootboxes[index];

      if (!lootbox.canSpin) {
        return {
          success: false,
          errors: ["Cannot spin: no remaining tries or no items"],
        };
      }

      const result = lootbox.spin();

      // Record spin in Firebase if available
      if (this.firebase.isReady && lootbox.id) {
        await this.firebase.recordSpin(lootbox.id, result);
        // Update the lootbox in Firebase with new spin count
        await this.firebase.saveLootbox(lootbox.toObject());
      }

      // Save to localStorage as backup
      this.saveToLocalStorage();

      return { success: true, result };
    } catch (error) {
      console.error("Error spinning lootbox:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async importSharedLootbox(sharedData) {
    try {
      const importedLootbox = new Lootbox({
        ...sharedData,
        imported: true,
        importedAt: new Date().toISOString(),
        spins: 0,
        lastUsed: null,
        favorite: false,
        remainingTries: sharedData.maxTries || "unlimited",
      });

      const validation = importedLootbox.validate();
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Save to Firebase and get ID
      if (this.firebase.isReady) {
        const id = await this.firebase.saveLootbox(importedLootbox.toObject());
        importedLootbox.id = id;
      }

      // Add to local array
      this.lootboxes.push(importedLootbox);

      // Save to localStorage as backup
      this.saveToLocalStorage();

      return { success: true, message: `Imported "${importedLootbox.name}"` };
    } catch (error) {
      console.error("Error importing lootbox:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async markAsViewed(index) {
    try {
      if (index < 0 || index >= this.lootboxes.length) {
        return { success: false };
      }

      const lootbox = this.lootboxes[index];

      // Only mark as viewed if it hasn't been viewed yet
      if (!lootbox.viewed) {
        lootbox.viewed = true;
        lootbox.updatedAt = new Date().toISOString();

        // Save to Firebase if available
        if (this.firebase.isReady) {
          await this.firebase.saveLootbox(lootbox.toObject());
        } else {
          // Save to localStorage
          this.saveToLocalStorage();
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error marking lootbox as viewed:", error);
      return { success: false };
    }
  }

  generateShareUrl(index) {
    try {
      if (index < 0 || index >= this.lootboxes.length) {
        return { success: false };
      }

      const lootbox = this.lootboxes[index];
      const shareData = {
        name: lootbox.name,
        items: lootbox.items,
        chestImage: lootbox.chestImage,
        revealContents: lootbox.revealContents,
        revealOdds: lootbox.revealOdds,
        maxTries: lootbox.maxTries,
      };

      const encoded = encodeURIComponent(JSON.stringify(shareData));
      const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

      return { success: true, url, lootboxName: lootbox.name };
    } catch (error) {
      console.error("Error generating share URL:", error);
      return { success: false };
    }
  }

  // Private method to save to localStorage only (not Firebase)
  saveToLocalStorage() {
    try {
      const data = this.lootboxes.map((lb) => lb.toObject());
      this.storage.saveLootboxes(data);
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }

  // This method is no longer needed - we save to Firebase individually
  // when creating/updating/deleting
  async save() {
    // Just save to localStorage as backup
    this.saveToLocalStorage();
  }
}

export default LootboxController;

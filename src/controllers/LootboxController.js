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
      // Test if Lootbox class is imported correctly
      console.log("Lootbox class:", Lootbox);
      console.log("Lootbox prototype:", Lootbox.prototype);

      // Test creating a simple Lootbox
      const testLootbox = new Lootbox({ name: "Test", items: [] });
      console.log("Test Lootbox:", testLootbox);
      console.log("Test Lootbox name:", testLootbox.name);

      // Try to load from Firebase first
      if (this.firebase.isReady) {
        const firebaseLootboxes = await this.firebase.loadLootboxes();
        console.log("Raw Firebase lootbox data:", firebaseLootboxes);

        // Ensure we create Lootbox instances from the data
        this.lootboxes = firebaseLootboxes.map((data, index) => {
          console.log(`Processing Firebase lootbox ${index}:`, data);

          // Check if it's already a Lootbox instance
          if (data instanceof Lootbox) {
            return data;
          }

          // Try to create Lootbox directly with object spread to ensure properties are copied
          const lootbox = Object.assign(new Lootbox(), {
            id: data.id,
            name: data.name || "Unnamed Lootbox",
            items: data.items || [],
            chestImage: data.chestImage || "chests/chest.png",
            revealContents:
              data.revealContents !== undefined ? data.revealContents : true,
            revealOdds: data.revealOdds !== undefined ? data.revealOdds : true,
            maxTries: data.maxTries || "unlimited",
            remainingTries:
              data.remainingTries !== undefined
                ? data.remainingTries
                : data.maxTries || "unlimited",
            spins: data.spins || 0,
            lastUsed: data.lastUsed || null,
            favorite: data.favorite || false,
            imported: data.imported || false,
            importedAt: data.importedAt || null,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });

          console.log(`Created Lootbox ${index}:`, lootbox);
          console.log(`Lootbox ${index} name:`, lootbox.name);
          console.log(`Lootbox ${index} items:`, lootbox.items);
          return lootbox;
        });
        console.log(`Loaded ${this.lootboxes.length} lootboxes from Firebase`);
        console.log("Final lootboxes array:", this.lootboxes);
      }

      // Fall back to local storage if needed
      if (this.lootboxes.length === 0) {
        const storageLootboxes = this.storage.loadLootboxes();
        // Ensure we create Lootbox instances from the data
        this.lootboxes = storageLootboxes.map((data) => {
          // Check if it's already a Lootbox instance
          if (data instanceof Lootbox) {
            return data;
          }
          return new Lootbox(data);
        });
        console.log(
          `Loaded ${this.lootboxes.length} lootboxes from localStorage`
        );
      }

      // Verify all items are Lootbox instances
      const allAreLootboxes = this.lootboxes.every(
        (item) => item instanceof Lootbox
      );
      if (!allAreLootboxes) {
        console.error("Not all items are Lootbox instances!");
        // Convert any non-Lootbox items
        this.lootboxes = this.lootboxes.map((item) => {
          if (item instanceof Lootbox) {
            return item;
          }
          console.warn("Converting non-Lootbox item:", item);
          return new Lootbox(item);
        });
      }
    } catch (error) {
      console.error("Error initializing lootboxes:", error);
      // Ensure we have an empty array on error
      this.lootboxes = [];
    }
  }

  getAllLootboxes() {
    // Return the actual lootbox instances with all properties
    console.log("getAllLootboxes returning:", this.lootboxes);
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

      // Save to Firebase if available
      if (this.firebase.isReady) {
        const id = await this.firebase.saveLootbox(lootbox.toObject());
        lootbox.id = id;
      }

      this.lootboxes.push(lootbox);
      await this.save();

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

      const lootbox = new Lootbox({
        ...this.lootboxes[index].toObject(),
        ...data,
      });
      const validation = lootbox.validate();

      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Update in Firebase if available
      if (this.firebase.isReady && lootbox.id) {
        await this.firebase.saveLootbox(lootbox.toObject());
      }

      this.lootboxes[index] = lootbox;
      await this.save();

      return { success: true, lootbox };
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

      // Delete from Firebase if available
      if (this.firebase.isReady && lootbox.id) {
        await this.firebase.deleteLootbox(lootbox.id);
      }

      this.lootboxes.splice(index, 1);
      await this.save();

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

      await this.save();
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
      }

      await this.save();
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

      this.lootboxes.push(importedLootbox);
      await this.save();

      return { success: true, message: `Imported "${importedLootbox.name}"` };
    } catch (error) {
      console.error("Error importing lootbox:", error);
      return { success: false, errors: [error.message] };
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

  async save() {
    try {
      const data = this.lootboxes.map((lb) => lb.toObject());
      this.storage.saveLootboxes(data);

      // Also save to Firebase if available
      if (this.firebase.isReady) {
        for (const lootbox of this.lootboxes) {
          if (lootbox.id || this.firebase.getCurrentUser()) {
            await this.firebase.saveLootbox(lootbox.toObject());
          }
        }
      }
    } catch (error) {
      console.error("Error saving lootboxes:", error);
    }
  }
}

export default LootboxController;

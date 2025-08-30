// Add this helper class to a new file: ChestImageHelper.js

class ChestImageHelper {
  static validatedChests = new Set();
  static invalidChests = new Set();
  static defaultChest = "chests/chest.png";

  /**
   * Normalize and validate chest image path
   * @param {string} path - The chest image path to validate
   * @returns {string} Valid chest path or default
   */
  static async getValidChestPath(path) {
    if (!path) return this.defaultChest;

    // Normalize the path first
    let normalizedPath = path;

    // Fix old OwnedChests paths
    if (path.includes("chests/OwnedChests/")) {
      normalizedPath = path.replace("chests/OwnedChests/", "chests/");
    }

    // Ensure it starts with chests/
    if (
      !normalizedPath.startsWith("chests/") &&
      !normalizedPath.startsWith("assets/")
    ) {
      normalizedPath = "chests/" + normalizedPath;
    }

    // Remove any double slashes
    normalizedPath = normalizedPath.replace(/\/+/g, "/");

    // Check cache first
    if (this.validatedChests.has(normalizedPath)) {
      return normalizedPath;
    }
    if (this.invalidChests.has(normalizedPath)) {
      return this.defaultChest;
    }

    // Test if image exists
    const exists = await this.imageExists(normalizedPath);
    if (exists) {
      this.validatedChests.add(normalizedPath);
      return normalizedPath;
    } else {
      console.warn(`Chest image not found: ${normalizedPath}, using default`);
      this.invalidChests.add(normalizedPath);
      return this.defaultChest;
    }
  }

  /**
   * Check if an image exists by trying to load it
   * @param {string} url - Image URL to check
   * @returns {Promise<boolean>} True if image loads successfully
   */
  static imageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  /**
   * Batch validate and fix chest paths
   * @param {Array} lootboxes - Array of lootbox objects
   * @returns {Promise<number>} Number of paths fixed
   */
  static async fixAllChestPaths(lootboxes) {
    let fixedCount = 0;

    for (const lootbox of lootboxes) {
      const originalPath = lootbox.chestImage;
      const validPath = await this.getValidChestPath(originalPath);

      if (validPath !== originalPath) {
        lootbox.chestImage = validPath;
        lootbox.updatedAt = new Date().toISOString();
        fixedCount++;
        console.log(`Fixed chest path: ${originalPath} → ${validPath}`);
      }
    }

    return fixedCount;
  }
}

// Export for use in other files
export default ChestImageHelper;

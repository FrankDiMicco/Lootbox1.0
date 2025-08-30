/**
 * LootboxCard component for rendering regular lootbox cards
 */
class LootboxCard {
  /**
   * Normalize chest image path
   * @param {string} path - The chest image path
   * @returns {string} Normalized path
   */
  static normalizeChestPath(path) {
    if (!path) return "chests/chest.png";

    // Remove any leading slashes
    path = path.replace(/^\/+/, "");

    // Handle old OwnedChests paths
    if (path.includes("chests/OwnedChests/")) {
      path = path.replace("chests/OwnedChests/", "chests/");
    }

    // Ensure it starts with 'chests/' if it's just a filename
    if (!path.startsWith("chests/") && !path.startsWith("assets/")) {
      path = "chests/" + path;
    }

    return path;
  }

  /**
   * Generate HTML for a regular lootbox card
   * @param {Object} lootbox - The lootbox data object
   * @param {number} originalIndex - Original index in the lootboxes array
   * @param {Object} options - Additional rendering options
   * @returns {string} HTML string for the lootbox card
   */
  static render(lootbox, originalIndex, options = {}) {
    const {
      timeAgo = (date) => {
        if (!date) return "Never";
        const now = new Date();
        const then = new Date(date);
        const diff = now - then;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
        const mins = Math.floor(diff / (1000 * 60));
        return mins > 0 ? `${mins} min${mins > 1 ? "s" : ""} ago` : "Just now";
      },
      showNewBadge = true,
    } = options;

    // Debug logging
    console.log("Rendering lootbox card:", originalIndex, lootbox);

    // Ensure we have required properties
    const name = lootbox.name || "Unnamed Lootbox";
    const spins = lootbox.spins || 0;
    const viewed = lootbox.viewed || false;
    const lastUsed = lootbox.lastUsed || null;
    const favorite = lootbox.favorite || false;

    // Normalize chest image path
    const chestImage = this.normalizeChestPath(lootbox.chestImage);

    // Determine favorite icon
    const favoriteIcon = favorite
      ? "assets/graphics/favorite_star.png"
      : "assets/graphics/empty_favorite_star.png";

    // Check if this is a new lootbox (never opened and never viewed)
    const isNewBox = spins === 0 && !viewed;

    // Generate stats display
    let statsHTML = "";
    if (spins === 0) {
      // For boxes that have never been spun
      statsHTML = "<span>Never opened</span>";
    } else {
      // For used boxes, show stats
      statsHTML = `
                <span>Opens: ${spins}</span>
                <span>Used: ${timeAgo(lastUsed)}</span>
            `;
    }

    return `
            <div class="lootbox-card" data-action="open-lootbox" data-index="${originalIndex}">
                ${
                  showNewBadge && isNewBox
                    ? '<div class="new-box-badge"><span class="new-box-label">New Box</span></div>'
                    : ""
                }
                <div class="lootbox-preview" style="background-image: url('${chestImage}')"></div>
                <div class="lootbox-info">
                    <h3>${this.escapeHtml(name)}</h3>
                    <div class="lootbox-stats">
                        ${statsHTML}
                    </div>
                    <div class="lootbox-actions">
                        ${this.renderActions(originalIndex, favoriteIcon)}
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render the action buttons for a lootbox card
   * @param {number} originalIndex - Original index in the lootboxes array
   * @param {string} favoriteIcon - Path to the favorite icon
   * @returns {string} HTML string for the action buttons
   */
  static renderActions(originalIndex, favoriteIcon) {
    return `
            <button class="action-btn" data-action="edit-lootbox" data-index="${originalIndex}" title="Edit lootbox">
                <img src="assets/graphics/settings_cog.png" alt="Edit" class="action-icon">
            </button>
            <button class="action-btn" data-action="share-lootbox" data-index="${originalIndex}" title="Share lootbox">
                <img src="assets/graphics/share.png" alt="Share" class="action-icon">
            </button>
            <button class="action-btn" data-action="convert-group-box" data-index="${originalIndex}" title="Convert to Group Box">
                <img src="assets/graphics/groupBoxImage.png" alt="Group Box" class="action-icon">
            </button>
            <button class="action-btn" data-action="toggle-favorite" data-index="${originalIndex}" title="Toggle favorite">
                <img src="${favoriteIcon}" alt="Favorite" class="action-icon">
            </button>
            <button class="action-btn" data-action="delete-lootbox" data-index="${originalIndex}" title="Delete lootbox">
                <img src="assets/graphics/delete_x.png" alt="Delete" class="action-icon">
            </button>
        `;
  }

  /**
   * Escape HTML characters to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  static escapeHtml(str) {
    if (typeof str !== "string") {
      return "";
    }

    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Generate a placeholder/skeleton card for loading states
   * @returns {string} HTML string for a skeleton card
   */
  static renderSkeleton() {
    return `
            <div class="lootbox-card lootbox-card-skeleton">
                <div class="lootbox-preview skeleton-shimmer"></div>
                <div class="lootbox-info">
                    <div class="skeleton-text skeleton-shimmer" style="height: 20px; margin-bottom: 8px;"></div>
                    <div class="lootbox-stats">
                        <div class="skeleton-text skeleton-shimmer" style="height: 14px; width: 60%;"></div>
                    </div>
                    <div class="lootbox-actions">
                        <div class="skeleton-button skeleton-shimmer"></div>
                        <div class="skeleton-button skeleton-shimmer"></div>
                        <div class="skeleton-button skeleton-shimmer"></div>
                        <div class="skeleton-button skeleton-shimmer"></div>
                        <div class="skeleton-button skeleton-shimmer"></div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Generate an error card for when lootbox data is invalid
   * @param {string} errorMessage - The error message to display
   * @param {number} originalIndex - Original index if available
   * @returns {string} HTML string for an error card
   */
  static renderError(
    errorMessage = "Invalid lootbox data",
    originalIndex = -1
  ) {
    return `
            <div class="lootbox-card lootbox-card-error">
                <div class="lootbox-preview" style="background-color: #fee2e2; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #dc2626; font-size: 24px;">⚠️</span>
                </div>
                <div class="lootbox-info">
                    <h3 style="color: #dc2626;">Error</h3>
                    <div class="lootbox-stats">
                        <span style="color: #6b7280;">${this.escapeHtml(
                          errorMessage
                        )}</span>
                    </div>
                    <div class="lootbox-actions">
                        ${
                          originalIndex >= 0
                            ? `
                            <button class="action-btn" data-action="delete-lootbox" data-index="${originalIndex}" title="Remove invalid lootbox">
                                <img src="assets/graphics/delete_x.png" alt="Delete" class="action-icon">
                            </button>
                        `
                            : ""
                        }
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Generate multiple lootbox cards
   * @param {Array} lootboxes - Array of lootbox objects
   * @param {Object} options - Rendering options
   * @returns {string} HTML string for all cards
   */
  static renderMultiple(lootboxes, options = {}) {
    if (!Array.isArray(lootboxes)) {
      return "";
    }

    return lootboxes
      .map((lootbox, index) => {
        return this.render(lootbox, index, options);
      })
      .join("");
  }
}

export default LootboxCard;

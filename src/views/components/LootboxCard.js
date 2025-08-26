/**
 * LootboxCard component for rendering regular lootbox cards
 */
class LootboxCard {
    /**
     * Generate HTML for a regular lootbox card
     * @param {Object} lootbox - The lootbox data object
     * @param {number} originalIndex - Original index in the lootboxes array
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the lootbox card
     */
    static render(lootbox, originalIndex, options = {}) {
        const {
            timeAgo = (date) => date ? 'some time ago' : '',
            showNewBadge = true
        } = options;

        // Migrate old chest image paths
        let chestImage = lootbox.chestImage || 'chests/chest.png';
        if (chestImage.includes('chests/OwnedChests/')) {
            chestImage = chestImage.replace('chests/OwnedChests/', 'chests/');
        }

        // Determine favorite icon
        const favoriteIcon = lootbox.favorite 
            ? 'assets/graphics/favorite_star.png' 
            : 'assets/graphics/empty_favorite_star.png';

        // Check if this is a new lootbox (never spun)
        const isNewBox = (lootbox.spins || 0) === 0;

        // Generate stats display
        const statsHTML = isNewBox 
            ? '' 
            : `<span>Opens: ${lootbox.spins || 0}</span><span>Used: ${timeAgo(lootbox.lastUsed)}</span>`;

        return `
            <div class="lootbox-card" onclick="app.openLootbox(${originalIndex})">
                ${showNewBadge && isNewBox ? '<div class="new-box-badge"><span class="new-box-label">New Box</span></div>' : ''}
                <div class="lootbox-preview" style="background-image: url('${chestImage}')"></div>
                <div class="lootbox-info">
                    <h3>${this.escapeHtml(lootbox.name)}</h3>
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
            <button class="action-btn" onclick="event.stopPropagation(); app.editLootbox(${originalIndex})" title="Edit lootbox">
                <img src="assets/graphics/settings_cog.png" alt="Edit" class="action-icon">
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); app.shareLootbox(${originalIndex})" title="Share lootbox">
                <img src="assets/graphics/share.png" alt="Share" class="action-icon">
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); app.toggleGroupBox(${originalIndex})" title="Convert to Group Box">
                <img src="assets/graphics/groupBoxImage.png" alt="Group Box" class="action-icon">
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); app.favoriteLootbox(${originalIndex})" title="Toggle favorite">
                <img src="${favoriteIcon}" alt="Favorite" class="action-icon">
            </button>
            <button class="action-btn" onclick="event.stopPropagation(); app.deleteLootbox(${originalIndex})" title="Delete lootbox">
                <img src="assets/graphics/delete_x.png" alt="Delete" class="action-icon">
            </button>
        `;
    }

    /**
     * Render a lootbox card with additional data for debugging or special cases
     * @param {Object} lootbox - The lootbox data object
     * @param {number} originalIndex - Original index in the lootboxes array
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the lootbox card with debug info
     */
    static renderWithDebug(lootbox, originalIndex, options = {}) {
        const baseCard = this.render(lootbox, originalIndex, options);
        
        if (!options.showDebug) {
            return baseCard;
        }

        // Add debug information
        const debugInfo = `
            <div class="lootbox-debug-info" style="font-size: 10px; color: #666; padding: 4px; background: #f0f0f0; margin-top: 4px;">
                ID: ${lootbox.id || 'local'} | Index: ${originalIndex} | Spins: ${lootbox.spins || 0}
            </div>
        `;

        // Insert debug info before the closing card div
        return baseCard.replace('</div>\n        ', debugInfo + '</div>\n        ');
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
    static renderError(errorMessage = 'Invalid lootbox data', originalIndex = -1) {
        return `
            <div class="lootbox-card lootbox-card-error">
                <div class="lootbox-preview" style="background-color: #fee2e2; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #dc2626; font-size: 24px;">⚠️</span>
                </div>
                <div class="lootbox-info">
                    <h3 style="color: #dc2626;">Error</h3>
                    <div class="lootbox-stats">
                        <span style="color: #6b7280;">${this.escapeHtml(errorMessage)}</span>
                    </div>
                    <div class="lootbox-actions">
                        ${originalIndex >= 0 ? `
                            <button class="action-btn" onclick="event.stopPropagation(); app.deleteLootbox(${originalIndex})" title="Remove invalid lootbox">
                                <img src="assets/graphics/delete_x.png" alt="Delete" class="action-icon">
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Validate lootbox data before rendering
     * @param {Object} lootbox - The lootbox data object to validate
     * @returns {Object} Validation result with isValid boolean and error message
     */
    static validateLootbox(lootbox) {
        if (!lootbox) {
            return { isValid: false, error: 'Lootbox data is null or undefined' };
        }

        if (!lootbox.name || typeof lootbox.name !== 'string') {
            return { isValid: false, error: 'Lootbox name is required' };
        }

        if (!Array.isArray(lootbox.items)) {
            return { isValid: false, error: 'Lootbox items must be an array' };
        }

        if (lootbox.items.length === 0) {
            return { isValid: false, error: 'Lootbox must have at least one item' };
        }

        // Check for invalid item data
        for (let i = 0; i < lootbox.items.length; i++) {
            const item = lootbox.items[i];
            if (!item.name || typeof item.name !== 'string') {
                return { isValid: false, error: `Item ${i + 1} has invalid name` };
            }
            if (typeof item.odds !== 'number' || item.odds < 0 || item.odds > 1) {
                return { isValid: false, error: `Item ${i + 1} has invalid odds` };
            }
        }

        return { isValid: true, error: null };
    }

    /**
     * Render a lootbox card with validation
     * @param {Object} lootbox - The lootbox data object
     * @param {number} originalIndex - Original index in the lootboxes array
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the lootbox card or error card
     */
    static renderSafe(lootbox, originalIndex, options = {}) {
        const validation = this.validateLootbox(lootbox);
        
        if (!validation.isValid) {
            return this.renderError(validation.error, originalIndex);
        }

        return this.render(lootbox, originalIndex, options);
    }

    /**
     * Escape HTML characters to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    static escapeHtml(str) {
        if (typeof str !== 'string') {
            return '';
        }
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Generate multiple lootbox cards
     * @param {Array} lootboxes - Array of lootbox objects
     * @param {Object} options - Rendering options
     * @returns {string} HTML string for all cards
     */
    static renderMultiple(lootboxes, options = {}) {
        if (!Array.isArray(lootboxes)) {
            return '';
        }

        return lootboxes.map((lootbox, index) => {
            return this.renderSafe(lootbox, index, options);
        }).join('');
    }
}

export default LootboxCard;
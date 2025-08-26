/**
 * GroupBoxCard component for rendering group box cards
 */
class GroupBoxCard {
    /**
     * Generate HTML for a group box card
     * @param {Object} groupBox - The group box data object
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the group box card
     */
    static render(groupBox, options = {}) {
        const {
            showNewBadge = true,
            showDebugInfo = false
        } = options;

        // Migrate old chest image paths
        let chestImage = groupBox.lootboxData?.chestImage || 'chests/chest.png';
        if (chestImage.includes('chests/OwnedChests/')) {
            chestImage = chestImage.replace('chests/OwnedChests/', 'chests/');
        }

        // Check if this is a new group box for the user
        const isNewBox = (groupBox.userTotalOpens || 0) === 0 && !groupBox.isOrganizerOnly;

        // Get group box name
        const groupBoxName = groupBox.groupBoxName || groupBox.lootboxData?.name || 'Unnamed Group Box';

        // Determine card classes
        const cardClasses = [
            'lootbox-card',
            'group-box-card',
            groupBox.isOrganizerOnly ? 'organizer-only' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${cardClasses}" onclick="app.openGroupBoxFromList('${groupBox.groupBoxId}')">
                ${showNewBadge && isNewBox ? '<div class="new-box-badge"><span class="new-box-label">New Box</span></div>' : ''}
                ${this.renderGroupBoxBadge()}
                <div class="lootbox-preview" style="background-image: url('${chestImage}')"></div>
                <div class="lootbox-info">
                    <h3>${this.escapeHtml(groupBoxName)}</h3>
                    ${this.renderStats(groupBox)}
                    ${this.renderCommunityStats(groupBox)}
                    <div class="lootbox-actions">
                        ${this.renderActions(groupBox)}
                    </div>
                    ${showDebugInfo ? this.renderDebugInfo(groupBox) : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render the Group Box badge
     * @returns {string} HTML string for the group box badge
     */
    static renderGroupBoxBadge() {
        return `
            <div class="group-box-badge">
                <img src="assets/graphics/groupBoxImage.png" alt="Group Box" class="group-box-icon">
                Group Box
            </div>
        `;
    }

    /**
     * Render the user statistics section
     * @param {Object} groupBox - The group box data object
     * @returns {string} HTML string for the stats section
     */
    static renderStats(groupBox) {
        const userOpens = groupBox.userTotalOpens || 0;
        const triesLeft = groupBox.isOrganizerOnly 
            ? 'Status: Creator' 
            : `Tries Left: ${groupBox.userRemainingTries !== undefined ? groupBox.userRemainingTries : groupBox.settings?.triesPerPerson || 0}`;

        return `
            <div class="lootbox-stats">
                <span>Your Opens: ${userOpens}</span>
                <span>${triesLeft}</span>
            </div>
        `;
    }

    /**
     * Render the community statistics section
     * @param {Object} groupBox - The group box data object
     * @returns {string} HTML string for the community stats section
     */
    static renderCommunityStats(groupBox) {
        const stats = this.calculateCommunityStats(groupBox);

        return `
            <div class="group-box-community-stats">
                <span>👥 ${stats.uniqueUsers} users</span>
                <span>🎯 ${stats.totalOpens} total opens</span>
            </div>
        `;
    }

    /**
     * Calculate community statistics from session history
     * @param {Object} groupBox - The group box data object
     * @returns {Object} Calculated statistics
     */
    static calculateCommunityStats(groupBox) {
        // Get community history from the app
        const communityHistory = window.app?.communityHistory || window.modernApp?.communityHistory || 
                                 window.modernApp?.groupBoxController?.communityHistory || 
                                 window.modernApp?.groupBoxController?.getCommunityHistory?.() || [];
        
        // Count unique users who have spun/opened
        const uniqueUserIds = new Set();
        let totalOpens = 0;

        for (const entry of communityHistory) {
            if (entry.item && entry.userId) {
                uniqueUserIds.add(entry.userId);
                totalOpens++;
            }
        }

        return {
            uniqueUsers: uniqueUserIds.size,
            totalOpens
        };
    }

    /**
     * Render the action buttons for a group box card
     * @param {Object} groupBox - The group box data object
     * @returns {string} HTML string for the action buttons
     */
    static renderActions(groupBox) {
        const actions = [];

        // Edit button (only for organizer-only mode)
        if (groupBox.isOrganizerOnly) {
            actions.push(`
                <button class="action-btn" onclick="event.stopPropagation(); app.editGroupBox('${groupBox.groupBoxId}')" title="Edit Group Box">
                    <img src="assets/graphics/settings_cog.png" alt="Edit" class="action-icon">
                </button>
            `);
        }

        // Favorite button
        const favoriteIcon = groupBox.favorite 
            ? 'assets/graphics/favorite_star.png' 
            : 'assets/graphics/empty_favorite_star.png';
        
        actions.push(`
            <button class="action-btn" onclick="event.stopPropagation(); app.favoriteGroupBox('${groupBox.groupBoxId}')" title="Toggle favorite">
                <img src="${favoriteIcon}" alt="Favorite" class="action-icon">
            </button>
        `);

        // Share button (only for creators)
        if (groupBox.isCreator) {
            actions.push(`
                <button class="action-btn" onclick="event.stopPropagation(); app.shareGroupBoxLink('${groupBox.groupBoxId}')" title="Share Group Box">
                    <img src="assets/graphics/share.png" alt="Share" class="action-icon">
                </button>
            `);
        }

        // Delete button
        actions.push(`
            <button class="action-btn" onclick="event.stopPropagation(); app.deleteGroupBox('${groupBox.groupBoxId}')" title="Delete/Leave Group Box">
                <img src="assets/graphics/delete_x.png" alt="Delete" class="action-icon">
            </button>
        `);

        return actions.join('');
    }

    /**
     * Render debug information
     * @param {Object} groupBox - The group box data object
     * @returns {string} HTML string for debug info
     */
    static renderDebugInfo(groupBox) {
        return `
            <div class="group-box-debug-info" style="font-size: 10px; color: #666; padding: 4px; background: #f0f0f0; margin-top: 4px;">
                ID: ${groupBox.groupBoxId} | Creator: ${groupBox.isCreator ? 'Yes' : 'No'} | Organizer: ${groupBox.isOrganizerOnly ? 'Yes' : 'No'}
            </div>
        `;
    }

    /**
     * Generate a group box card with expiration warning if applicable
     * @param {Object} groupBox - The group box data object
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the group box card
     */
    static renderWithExpiration(groupBox, options = {}) {
        const baseCard = this.render(groupBox, options);
        
        // Check if group box is expired or expiring soon
        const expirationInfo = this.getExpirationInfo(groupBox);
        
        if (!expirationInfo.showWarning) {
            return baseCard;
        }

        // Add expiration warning
        const warningBadge = `
            <div class="expiration-warning-badge ${expirationInfo.isExpired ? 'expired' : 'expiring'}">
                <span class="expiration-warning-label">${expirationInfo.label}</span>
            </div>
        `;

        // Insert warning badge after the new-box-badge
        const newBadgeRegex = /(<div class="new-box-badge">.*?<\/div>)/;
        if (newBadgeRegex.test(baseCard)) {
            return baseCard.replace(newBadgeRegex, '$1' + warningBadge);
        } else {
            // Insert after the opening card div
            return baseCard.replace(
                /(<div class="[^"]*group-box-card[^"]*"[^>]*>)/,
                '$1' + warningBadge
            );
        }
    }

    /**
     * Get expiration information for a group box
     * @param {Object} groupBox - The group box data object
     * @returns {Object} Expiration info with warning details
     */
    static getExpirationInfo(groupBox) {
        if (!groupBox.expiresAt || groupBox.expiresIn === 'never') {
            return { showWarning: false, isExpired: false, label: '' };
        }

        const expiresAt = new Date(groupBox.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt - now;
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);

        if (timeUntilExpiry <= 0) {
            return { showWarning: true, isExpired: true, label: 'Expired' };
        } else if (hoursUntilExpiry <= 24) {
            const hours = Math.floor(hoursUntilExpiry);
            return { 
                showWarning: true, 
                isExpired: false, 
                label: hours <= 1 ? 'Expiring Soon' : `${hours}h left` 
            };
        }

        return { showWarning: false, isExpired: false, label: '' };
    }

    /**
     * Generate a placeholder/skeleton card for loading states
     * @returns {string} HTML string for a skeleton card
     */
    static renderSkeleton() {
        return `
            <div class="lootbox-card group-box-card lootbox-card-skeleton">
                ${this.renderGroupBoxBadge()}
                <div class="lootbox-preview skeleton-shimmer"></div>
                <div class="lootbox-info">
                    <div class="skeleton-text skeleton-shimmer" style="height: 20px; margin-bottom: 8px;"></div>
                    <div class="lootbox-stats">
                        <div class="skeleton-text skeleton-shimmer" style="height: 14px; width: 70%;"></div>
                        <div class="skeleton-text skeleton-shimmer" style="height: 14px; width: 50%;"></div>
                    </div>
                    <div class="group-box-community-stats">
                        <div class="skeleton-text skeleton-shimmer" style="height: 14px; width: 40%;"></div>
                        <div class="skeleton-text skeleton-shimmer" style="height: 14px; width: 60%;"></div>
                    </div>
                    <div class="lootbox-actions">
                        <div class="skeleton-button skeleton-shimmer"></div>
                        <div class="skeleton-button skeleton-shimmer"></div>
                        <div class="skeleton-button skeleton-shimmer"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate an error card for when group box data is invalid
     * @param {string} errorMessage - The error message to display
     * @param {string} groupBoxId - Group box ID if available
     * @returns {string} HTML string for an error card
     */
    static renderError(errorMessage = 'Invalid group box data', groupBoxId = null) {
        return `
            <div class="lootbox-card group-box-card lootbox-card-error">
                ${this.renderGroupBoxBadge()}
                <div class="lootbox-preview" style="background-color: #fee2e2; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #dc2626; font-size: 24px;">⚠️</span>
                </div>
                <div class="lootbox-info">
                    <h3 style="color: #dc2626;">Error</h3>
                    <div class="lootbox-stats">
                        <span style="color: #6b7280;">${this.escapeHtml(errorMessage)}</span>
                    </div>
                    <div class="group-box-community-stats">
                        <span style="color: #6b7280;">Unable to load data</span>
                    </div>
                    <div class="lootbox-actions">
                        ${groupBoxId ? `
                            <button class="action-btn" onclick="event.stopPropagation(); app.deleteGroupBox('${groupBoxId}')" title="Remove invalid group box">
                                <img src="assets/graphics/delete_x.png" alt="Delete" class="action-icon">
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Validate group box data before rendering
     * @param {Object} groupBox - The group box data object to validate
     * @returns {Object} Validation result with isValid boolean and error message
     */
    static validateGroupBox(groupBox) {
        if (!groupBox) {
            return { isValid: false, error: 'Group box data is null or undefined' };
        }

        if (!groupBox.groupBoxId) {
            return { isValid: false, error: 'Group box ID is required' };
        }

        const groupBoxName = groupBox.groupBoxName || groupBox.lootboxData?.name;
        if (!groupBoxName || typeof groupBoxName !== 'string') {
            return { isValid: false, error: 'Group box name is required' };
        }

        // Validate lootbox data if present
        if (groupBox.lootboxData) {
            if (!Array.isArray(groupBox.lootboxData.items) || groupBox.lootboxData.items.length === 0) {
                return { isValid: false, error: 'Group box must have lootbox items' };
            }
        }

        return { isValid: true, error: null };
    }

    /**
     * Render a group box card with validation
     * @param {Object} groupBox - The group box data object
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the group box card or error card
     */
    static renderSafe(groupBox, options = {}) {
        const validation = this.validateGroupBox(groupBox);
        
        if (!validation.isValid) {
            return this.renderError(validation.error, groupBox?.groupBoxId);
        }

        return this.render(groupBox, options);
    }

    /**
     * Render a group box card with all features (expiration, validation, etc.)
     * @param {Object} groupBox - The group box data object
     * @param {Object} options - Additional rendering options
     * @returns {string} HTML string for the group box card
     */
    static renderComplete(groupBox, options = {}) {
        const validation = this.validateGroupBox(groupBox);
        
        if (!validation.isValid) {
            return this.renderError(validation.error, groupBox?.groupBoxId);
        }

        return this.renderWithExpiration(groupBox, options);
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
     * Generate multiple group box cards
     * @param {Array} groupBoxes - Array of group box objects
     * @param {Object} options - Rendering options
     * @returns {string} HTML string for all cards
     */
    static renderMultiple(groupBoxes, options = {}) {
        if (!Array.isArray(groupBoxes)) {
            return '';
        }

        return groupBoxes.map((groupBox) => {
            return this.renderComplete(groupBox, options);
        }).join('');
    }

    /**
     * Render group box cards with special sorting and filtering
     * @param {Array} groupBoxes - Array of group box objects
     * @param {Object} options - Rendering and filtering options
     * @returns {string} HTML string for filtered/sorted cards
     */
    static renderFiltered(groupBoxes, options = {}) {
        const {
            filter = 'all', // 'all', 'active', 'created', 'participating'
            sortBy = 'recent', // 'recent', 'name', 'activity'
            showExpired = true
        } = options;

        if (!Array.isArray(groupBoxes)) {
            return '';
        }

        // Apply filters
        let filteredBoxes = [...groupBoxes];

        if (filter === 'active') {
            filteredBoxes = filteredBoxes.filter(gb => (gb.userRemainingTries || 0) > 0);
        } else if (filter === 'created') {
            filteredBoxes = filteredBoxes.filter(gb => gb.isCreator);
        } else if (filter === 'participating') {
            filteredBoxes = filteredBoxes.filter(gb => !gb.isCreator);
        }

        if (!showExpired) {
            filteredBoxes = filteredBoxes.filter(gb => {
                const expInfo = this.getExpirationInfo(gb);
                return !expInfo.isExpired;
            });
        }

        // Apply sorting
        if (sortBy === 'name') {
            filteredBoxes.sort((a, b) => {
                const nameA = (a.groupBoxName || a.lootboxData?.name || '').toLowerCase();
                const nameB = (b.groupBoxName || b.lootboxData?.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        } else if (sortBy === 'activity') {
            filteredBoxes.sort((a, b) => (b.totalOpens || 0) - (a.totalOpens || 0));
        } else {
            // Default: sort by recent activity
            filteredBoxes.sort((a, b) => {
                const dateA = new Date(a.lastParticipated || a.firstParticipated || 0);
                const dateB = new Date(b.lastParticipated || b.firstParticipated || 0);
                return dateB - dateA;
            });
        }

        return this.renderMultiple(filteredBoxes, options);
    }
}

export default GroupBoxCard;
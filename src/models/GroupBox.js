import Lootbox from './Lootbox.js';

class GroupBox extends Lootbox {
    constructor(data = {}) {
        // Initialize with lootbox data from nested structure if present
        const lootboxData = data.lootboxData || data;
        super(lootboxData);
        
        // Group-specific properties
        this.isGroupBox = true;
        this.groupBoxId = data.groupBoxId || data.id || null;
        this.groupBoxName = data.groupBoxName || this.name;
        
        // Creator information
        this.createdBy = data.createdBy || null;
        this.creatorName = data.creatorName || 'Unknown';
        this.isCreator = data.isCreator || false;
        
        // Organizer settings
        this.organizerOnly = data.organizerOnly || false;
        this.isOrganizerOnly = data.isOrganizerOnly || false;
        this.creatorParticipates = data.creatorParticipates !== undefined ? data.creatorParticipates : true;
        
        // Participant management
        this.participants = data.participants || [];
        this.maxParticipants = data.maxParticipants || null;
        
        // Group-specific settings
        this.triesPerPerson = data.triesPerPerson || 3;
        this.hideContents = data.hideContents || false;
        this.hideOdds = data.hideOdds || false;
        
        // Expiration
        this.expiresIn = data.expiresIn || 'never';
        this.expiresAt = data.expiresAt || null;
        
        // User-specific data
        this.userTotalOpens = data.userTotalOpens || 0;
        this.userRemainingTries = data.userRemainingTries !== undefined ? data.userRemainingTries : this.triesPerPerson;
        this.firstParticipated = data.firstParticipated || null;
        this.lastParticipated = data.lastParticipated || null;
        
        // Group statistics
        this.totalOpens = data.totalOpens || 0;
        this.uniqueUsers = data.uniqueUsers || 0;
        
        // Settings object for complex configurations
        this.settings = data.settings || {};
        
        // Override parent properties for group boxes
        this.revealContents = !this.hideContents;
        this.revealOdds = !this.hideOdds;
        this.maxTries = this.triesPerPerson;
        this.remainingTries = this.userRemainingTries;
    }

    /**
     * Check if the current user is the organizer only (can't participate)
     * @returns {boolean}
     */
    isOrganizerOnlyMode() {
        return this.organizerOnly && this.isCreator && !this.creatorParticipates;
    }

    /**
     * Check if a specific user can participate in this group box
     * @param {string} userId - User ID to check
     * @returns {boolean}
     */
    canUserParticipate(userId) {
        // If no userId provided, assume current user context
        if (!userId && this.isCreator) {
            // Creator can participate unless it's organizer-only mode
            return !this.isOrganizerOnlyMode();
        }
        
        // Check if user is in participants list
        const participant = this.participants.find(p => p.userId === userId);
        if (!participant) {
            return false; // User not a participant
        }
        
        // Check if user has remaining tries
        return participant.remainingTries > 0;
    }

    /**
     * Check if the group box has expired
     * @returns {boolean}
     */
    get isExpired() {
        if (this.expiresIn === 'never' || !this.expiresAt) {
            return false;
        }
        
        return new Date() > new Date(this.expiresAt);
    }

    /**
     * Check if the group box can be spun by the current user
     * @param {string} userId - Optional user ID
     * @returns {boolean}
     */
    canSpin(userId = null) {
        // Check basic lootbox requirements
        if (!super.canSpin) {
            return false;
        }
        
        // Check if expired
        if (this.isExpired) {
            return false;
        }
        
        // Check if organizer-only mode and user is creator
        if (this.isOrganizerOnlyMode()) {
            return false;
        }
        
        // Check user-specific participation rights
        if (userId) {
            return this.canUserParticipate(userId);
        }
        
        // Default check for current user context
        return this.userRemainingTries > 0;
    }

    /**
     * Get the number of active participants
     * @returns {number}
     */
    get activeParticipants() {
        return this.participants.filter(p => p.totalOpens > 0).length;
    }

    /**
     * Get the participation status summary
     * @returns {Object}
     */
    getParticipationStatus() {
        const total = this.participants.length;
        const active = this.activeParticipants;
        const pending = total - active;
        
        return {
            total,
            active,
            pending,
            maxParticipants: this.maxParticipants,
            isFull: this.maxParticipants ? total >= this.maxParticipants : false
        };
    }

    /**
     * Add a participant to the group box
     * @param {Object} participantData - Participant data
     */
    addParticipant(participantData) {
        const participant = {
            userId: participantData.userId,
            userName: participantData.userName || `User ${participantData.userId.substring(0, 8)}`,
            joinedAt: participantData.joinedAt || new Date().toISOString(),
            remainingTries: participantData.remainingTries !== undefined ? participantData.remainingTries : this.triesPerPerson,
            totalOpens: participantData.totalOpens || 0,
            lastOpened: participantData.lastOpened || null
        };
        
        // Check if user already exists
        const existingIndex = this.participants.findIndex(p => p.userId === participant.userId);
        if (existingIndex >= 0) {
            this.participants[existingIndex] = { ...this.participants[existingIndex], ...participant };
        } else {
            this.participants.push(participant);
        }
        
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Remove a participant from the group box
     * @param {string} userId - User ID to remove
     */
    removeParticipant(userId) {
        const index = this.participants.findIndex(p => p.userId === userId);
        if (index >= 0) {
            this.participants.splice(index, 1);
            this.updatedAt = new Date().toISOString();
        }
    }

    /**
     * Update participant data
     * @param {string} userId - User ID
     * @param {Object} updates - Updates to apply
     */
    updateParticipant(userId, updates) {
        const participant = this.participants.find(p => p.userId === userId);
        if (participant) {
            Object.assign(participant, updates);
            this.updatedAt = new Date().toISOString();
        }
    }

    /**
     * Record a spin for a specific user
     * @param {string} userId - User who performed the spin
     * @param {string} result - Spin result
     * @returns {Object} Spin result with user context
     */
    spinForUser(userId, random = Math.random()) {
        if (!this.canSpin(userId)) {
            throw new Error('User cannot spin this group box');
        }

        // Perform the spin using parent method
        const spinResult = this.spin(random);
        
        // Update user-specific data
        const participant = this.participants.find(p => p.userId === userId);
        if (participant) {
            participant.totalOpens++;
            participant.remainingTries--;
            participant.lastOpened = spinResult.timestamp;
        }
        
        // Update group statistics
        this.totalOpens++;
        this.uniqueUsers = new Set(this.participants.filter(p => p.totalOpens > 0).map(p => p.userId)).size;
        
        return {
            ...spinResult,
            userId,
            groupBoxId: this.groupBoxId,
            participantData: participant
        };
    }

    /**
     * Get expiration info
     * @returns {Object}
     */
    getExpirationInfo() {
        if (this.expiresIn === 'never') {
            return {
                expires: false,
                expiresAt: null,
                timeRemaining: null,
                isExpired: false
            };
        }
        
        const expiresAt = new Date(this.expiresAt);
        const now = new Date();
        const timeRemaining = expiresAt - now;
        const isExpired = timeRemaining <= 0;
        
        return {
            expires: true,
            expiresAt: this.expiresAt,
            timeRemaining: Math.max(0, timeRemaining),
            isExpired,
            formattedTimeRemaining: this.formatTimeRemaining(timeRemaining)
        };
    }

    /**
     * Format time remaining in a human-readable format
     * @param {number} milliseconds - Time remaining in milliseconds
     * @returns {string}
     */
    formatTimeRemaining(milliseconds) {
        if (milliseconds <= 0) {
            return 'Expired';
        }
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days !== 1 ? 's' : ''} remaining`;
        } else if (hours > 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
        } else {
            return `${seconds} second${seconds !== 1 ? 's' : ''} remaining`;
        }
    }

    /**
     * Override the copy method to create a proper GroupBox copy
     * @param {Object} overrides - Properties to override
     * @returns {GroupBox}
     */
    copy(overrides = {}) {
        const data = {
            ...this.toObject(),
            participants: [], // Reset participants for copy
            totalOpens: 0,
            uniqueUsers: 0,
            userTotalOpens: 0,
            userRemainingTries: this.triesPerPerson,
            createdAt: new Date().toISOString(),
            ...overrides
        };

        return new GroupBox(data);
    }

    /**
     * Convert to plain object for serialization
     * @returns {Object}
     */
    toObject() {
        const baseObject = super.toObject();
        return {
            ...baseObject,
            isGroupBox: this.isGroupBox,
            groupBoxId: this.groupBoxId,
            groupBoxName: this.groupBoxName,
            createdBy: this.createdBy,
            creatorName: this.creatorName,
            isCreator: this.isCreator,
            organizerOnly: this.organizerOnly,
            isOrganizerOnly: this.isOrganizerOnly,
            creatorParticipates: this.creatorParticipates,
            participants: this.participants,
            maxParticipants: this.maxParticipants,
            triesPerPerson: this.triesPerPerson,
            hideContents: this.hideContents,
            hideOdds: this.hideOdds,
            expiresIn: this.expiresIn,
            expiresAt: this.expiresAt,
            userTotalOpens: this.userTotalOpens,
            userRemainingTries: this.userRemainingTries,
            firstParticipated: this.firstParticipated,
            lastParticipated: this.lastParticipated,
            totalOpens: this.totalOpens,
            uniqueUsers: this.uniqueUsers,
            settings: this.settings
        };
    }

    /**
     * Create a GroupBox instance from a plain object
     * @param {Object} data - Plain object data
     * @returns {GroupBox}
     */
    static fromObject(data) {
        return new GroupBox(data);
    }

    /**
     * Override validation to include group-specific checks
     * @returns {Object} Validation result
     */
    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];
        const warnings = [...baseValidation.warnings];

        // Group-specific validation
        if (!this.createdBy) {
            errors.push('Group box must have a creator');
        }

        if (this.triesPerPerson < 1) {
            errors.push('Tries per person must be at least 1');
        }

        if (this.maxParticipants && this.maxParticipants < 1) {
            errors.push('Max participants must be at least 1 if specified');
        }

        // Check expiration
        if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
            warnings.push('Group box has expired');
        }

        // Check participant limits
        if (this.maxParticipants && this.participants.length > this.maxParticipants) {
            warnings.push('Group box has exceeded maximum participants');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            hasWarnings: warnings.length > 0
        };
    }
}

export default GroupBox;
class Lootbox {
    constructor(data = {}) {
        // Core properties
        this.id = data.id || null;
        this.name = data.name || 'Untitled Lootbox';
        this.items = data.items || [];
        this.chestImage = data.chestImage || 'chests/chest.png';
        
        // Settings
        this.revealContents = data.revealContents !== undefined ? data.revealContents : true;
        this.revealOdds = data.revealOdds !== undefined ? data.revealOdds : true;
        this.maxTries = data.maxTries || "unlimited";
        this.remainingTries = data.remainingTries !== undefined ? data.remainingTries : this.maxTries;
        
        // Statistics
        this.spins = data.spins || 0;
        this.lastUsed = data.lastUsed || null;
        this.favorite = data.favorite || false;
        
        // Import tracking
        this.imported = data.imported || false;
        this.importedAt = data.importedAt || null;
        
        // Timestamps
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    /**
     * Check if the lootbox can be spun by the user
     * @returns {boolean}
     */
    get canSpin() {
        if (this.items.length === 0) {
            return false;
        }
        
        if (this.maxTries === "unlimited") {
            return true;
        }
        
        return this.remainingTries > 0;
    }

    /**
     * Get the number of remaining tries
     * @returns {number|string}
     */
    get triesRemaining() {
        if (this.maxTries === "unlimited") {
            return "unlimited";
        }
        return Math.max(0, this.remainingTries);
    }

    /**
     * Check if the lootbox has unlimited tries
     * @returns {boolean}
     */
    get hasUnlimitedTries() {
        return this.maxTries === "unlimited";
    }

    /**
     * Get the total odds sum
     * @returns {number}
     */
    get totalOdds() {
        return this.items.reduce((sum, item) => sum + (item.odds || 0), 0);
    }

    /**
     * Check if the odds are valid (sum to approximately 1.0)
     * @param {number} tolerance - Allowed deviation from 1.0
     * @returns {boolean}
     */
    validateOdds(tolerance = 0.001) {
        if (this.items.length === 0) {
            return false;
        }
        
        const total = this.totalOdds;
        return Math.abs(total - 1.0) <= tolerance;
    }

    /**
     * Get odds validation details
     * @returns {Object}
     */
    getOddsValidation() {
        const total = this.totalOdds;
        const isValid = this.validateOdds();
        
        return {
            total,
            isValid,
            difference: Math.abs(total - 1.0),
            message: isValid ? 'Odds are valid' : `Odds sum to ${total.toFixed(3)} instead of 1.000`
        };
    }

    /**
     * Perform a spin and return the result
     * @param {number} random - Optional random number (0-1) for testing
     * @returns {Object}
     */
    spin(random = Math.random()) {
        if (!this.canSpin) {
            throw new Error('Cannot spin: lootbox has no remaining tries or no items');
        }

        if (this.items.length === 0) {
            throw new Error('Cannot spin: lootbox has no items');
        }

        // Find the winning item
        let cumulativeOdds = 0;
        let result = null;

        for (const item of this.items) {
            cumulativeOdds += item.odds;
            if (random <= cumulativeOdds) {
                result = item.name;
                break;
            }
        }

        // Fallback to last item if no match found
        if (!result) {
            result = this.items[this.items.length - 1]?.name || 'Nothing';
        }

        // Update statistics
        this.spins++;
        this.lastUsed = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        
        if (this.maxTries !== "unlimited") {
            this.remainingTries = Math.max(0, this.remainingTries - 1);
        }

        return {
            item: result,
            spin: this.spins,
            remainingTries: this.triesRemaining,
            timestamp: this.lastUsed
        };
    }

    /**
     * Reset the lootbox statistics
     */
    resetStats() {
        this.spins = 0;
        this.lastUsed = null;
        this.remainingTries = this.maxTries;
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Reset only the tries count
     */
    resetTries() {
        this.remainingTries = this.maxTries;
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Add an item to the lootbox
     * @param {string} name - Item name
     * @param {number} odds - Item odds (0-1)
     */
    addItem(name, odds) {
        if (!name || typeof name !== 'string') {
            throw new Error('Item name must be a non-empty string');
        }
        
        if (typeof odds !== 'number' || odds < 0 || odds > 1) {
            throw new Error('Item odds must be a number between 0 and 1');
        }

        this.items.push({ name: name.trim(), odds });
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Remove an item by index
     * @param {number} index - Item index to remove
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) {
            throw new Error('Invalid item index');
        }

        this.items.splice(index, 1);
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Update an item at a specific index
     * @param {number} index - Item index
     * @param {string} name - New item name
     * @param {number} odds - New item odds
     */
    updateItem(index, name, odds) {
        if (index < 0 || index >= this.items.length) {
            throw new Error('Invalid item index');
        }

        if (!name || typeof name !== 'string') {
            throw new Error('Item name must be a non-empty string');
        }
        
        if (typeof odds !== 'number' || odds < 0 || odds > 1) {
            throw new Error('Item odds must be a number between 0 and 1');
        }

        this.items[index] = { name: name.trim(), odds };
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Create a deep copy of this lootbox
     * @param {Object} overrides - Properties to override in the copy
     * @returns {Lootbox}
     */
    copy(overrides = {}) {
        const data = {
            name: this.name,
            items: this.items.map(item => ({ name: item.name, odds: item.odds })),
            chestImage: this.chestImage,
            revealContents: this.revealContents,
            revealOdds: this.revealOdds,
            maxTries: this.maxTries,
            remainingTries: this.maxTries, // Reset tries for copy
            spins: 0, // Reset stats for copy
            lastUsed: null,
            favorite: false,
            imported: false,
            importedAt: null,
            createdAt: new Date().toISOString(),
            ...overrides
        };

        return new Lootbox(data);
    }

    /**
     * Convert to plain object for serialization
     * @returns {Object}
     */
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
            lastUsed: this.lastUsed,
            favorite: this.favorite,
            imported: this.imported,
            importedAt: this.importedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Create a Lootbox instance from a plain object
     * @param {Object} data - Plain object data
     * @returns {Lootbox}
     */
    static fromObject(data) {
        return new Lootbox(data);
    }

    /**
     * Validate the lootbox data
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];
        const warnings = [];

        // Name validation
        if (!this.name || this.name.trim().length === 0) {
            errors.push('Lootbox name is required');
        }

        // Items validation
        if (this.items.length === 0) {
            errors.push('Lootbox must have at least one item');
        }

        // Individual item validation
        this.items.forEach((item, index) => {
            if (!item.name || item.name.trim().length === 0) {
                errors.push(`Item ${index + 1}: name is required`);
            }
            if (typeof item.odds !== 'number' || item.odds < 0 || item.odds > 1) {
                errors.push(`Item ${index + 1}: odds must be a number between 0 and 1`);
            }
        });

        // Odds validation
        const oddsValidation = this.getOddsValidation();
        if (!oddsValidation.isValid) {
            warnings.push(oddsValidation.message);
        }

        // Tries validation
        if (this.maxTries !== "unlimited") {
            if (typeof this.maxTries !== 'number' || this.maxTries < 1) {
                errors.push('Max tries must be "unlimited" or a positive number');
            }
            if (typeof this.remainingTries !== 'number' || this.remainingTries < 0) {
                errors.push('Remaining tries must be a non-negative number');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            hasWarnings: warnings.length > 0
        };
    }
}

export default Lootbox;
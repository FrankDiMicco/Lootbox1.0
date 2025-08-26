import Lootbox from '../models/Lootbox.js';

/**
 * Controller for managing lootbox business logic
 */
class LootboxController {
    constructor(firebaseService, storageService) {
        this.firebaseService = firebaseService;
        this.storageService = storageService;
        this.lootboxes = [];
    }

    /**
     * Initialize the controller
     */
    async initialize() {
        await this.loadLootboxes();
    }

    /**
     * Load lootboxes from Firebase or localStorage
     * @returns {Array} Array of lootbox objects
     */
    async loadLootboxes() {
        try {
            // Try Firebase first if available
            if (this.firebaseService && this.firebaseService.isReady) {
                this.lootboxes = await this.firebaseService.loadLootboxes();
                // Also save to localStorage as backup
                this.storageService.saveLootboxes(this.lootboxes);
            } else {
                // Fallback to localStorage
                this.lootboxes = this.storageService.loadLootboxes();
            }

            // Convert plain objects to Lootbox instances
            this.lootboxes = this.lootboxes.map(data => Lootbox.fromObject(data));
            
            // Migrate old chest paths if needed
            this.migrateChestPaths();

            console.log(`Loaded ${this.lootboxes.length} lootboxes`);
            return this.lootboxes;
        } catch (error) {
            console.error('Error loading lootboxes:', error);
            this.lootboxes = [];
            return [];
        }
    }

    /**
     * Save lootboxes to Firebase and localStorage
     * @returns {boolean} Success status
     */
    async saveLootboxes() {
        try {
            const lootboxData = this.lootboxes.map(lootbox => lootbox.toObject());

            // Save to Firebase if available
            if (this.firebaseService && this.firebaseService.isReady) {
                // Save each lootbox individually to maintain Firebase IDs
                for (let i = 0; i < this.lootboxes.length; i++) {
                    const lootbox = this.lootboxes[i];
                    const id = await this.firebaseService.saveLootbox(lootbox.toObject());
                    if (!lootbox.id) {
                        lootbox.id = id;
                    }
                }
            }

            // Always save to localStorage as backup
            this.storageService.saveLootboxes(lootboxData);
            
            console.log(`Saved ${this.lootboxes.length} lootboxes`);
            return true;
        } catch (error) {
            console.error('Error saving lootboxes:', error);
            return false;
        }
    }

    /**
     * Create a new lootbox
     * @param {Object} lootboxData - Data for the new lootbox
     * @returns {Object} Result with success status and lootbox/errors
     */
    async createLootbox(lootboxData) {
        try {
            // Create new lootbox instance
            const lootbox = new Lootbox(lootboxData);
            
            // Validate the lootbox
            const validation = lootbox.validate();
            if (!validation.isValid) {
                return {
                    success: false,
                    errors: validation.errors,
                    warnings: validation.warnings
                };
            }

            // Add to collection
            this.lootboxes.push(lootbox);
            
            // Save changes
            const saveSuccess = await this.saveLootboxes();
            if (!saveSuccess) {
                // Rollback on save failure
                this.lootboxes.pop();
                return {
                    success: false,
                    errors: ['Failed to save lootbox']
                };
            }

            return {
                success: true,
                lootbox: lootbox,
                index: this.lootboxes.length - 1,
                warnings: validation.warnings
            };
        } catch (error) {
            console.error('Error creating lootbox:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Update an existing lootbox
     * @param {number} index - Index of lootbox to update
     * @param {Object} lootboxData - Updated lootbox data
     * @returns {Object} Result with success status and lootbox/errors
     */
    async updateLootbox(index, lootboxData) {
        try {
            if (index < 0 || index >= this.lootboxes.length) {
                return {
                    success: false,
                    errors: ['Invalid lootbox index']
                };
            }

            const existingLootbox = this.lootboxes[index];
            
            // Preserve certain fields from existing lootbox
            const preservedData = {
                id: existingLootbox.id,
                spins: existingLootbox.spins,
                lastUsed: existingLootbox.lastUsed,
                createdAt: existingLootbox.createdAt,
                ...lootboxData,
                updatedAt: new Date().toISOString()
            };

            // Create updated lootbox instance
            const updatedLootbox = new Lootbox(preservedData);
            
            // Validate the updated lootbox
            const validation = updatedLootbox.validate();
            if (!validation.isValid) {
                return {
                    success: false,
                    errors: validation.errors,
                    warnings: validation.warnings
                };
            }

            // Update in collection
            this.lootboxes[index] = updatedLootbox;
            
            // Save changes
            const saveSuccess = await this.saveLootboxes();
            if (!saveSuccess) {
                // Rollback on save failure
                this.lootboxes[index] = existingLootbox;
                return {
                    success: false,
                    errors: ['Failed to save lootbox changes']
                };
            }

            return {
                success: true,
                lootbox: updatedLootbox,
                index: index,
                warnings: validation.warnings
            };
        } catch (error) {
            console.error('Error updating lootbox:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Delete a lootbox
     * @param {number} index - Index of lootbox to delete
     * @returns {Object} Result with success status
     */
    async deleteLootbox(index) {
        try {
            if (index < 0 || index >= this.lootboxes.length) {
                return {
                    success: false,
                    errors: ['Invalid lootbox index']
                };
            }

            const lootbox = this.lootboxes[index];
            const lootboxName = lootbox.name;

            // Delete from Firebase if it has an ID
            if (lootbox.id && this.firebaseService && this.firebaseService.isReady) {
                try {
                    await this.firebaseService.deleteLootbox(lootbox.id);
                } catch (error) {
                    console.error('Error deleting from Firebase:', error);
                    // Continue with local deletion even if Firebase fails
                }
            }

            // Remove from local collection
            this.lootboxes.splice(index, 1);
            
            // Save changes
            await this.saveLootboxes();

            return {
                success: true,
                deletedName: lootboxName,
                deletedId: lootbox.id
            };
        } catch (error) {
            console.error('Error deleting lootbox:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Spin a lootbox and get a result
     * @param {number} index - Index of lootbox to spin
     * @returns {Object} Spin result with item and updated stats
     */
    async spinLootbox(index) {
        try {
            if (index < 0 || index >= this.lootboxes.length) {
                return {
                    success: false,
                    errors: ['Invalid lootbox index']
                };
            }

            const lootbox = this.lootboxes[index];

            // Check if lootbox can be spun
            if (!lootbox.canSpin) {
                return {
                    success: false,
                    errors: ['Cannot spin: no tries remaining or no items']
                };
            }

            // Validate odds before spinning
            const oddsValidation = lootbox.getOddsValidation();
            if (!oddsValidation.isValid) {
                // Allow spin with warning for incorrect odds
                console.warn('Spinning with invalid odds:', oddsValidation.message);
            }

            // Perform the spin
            const spinResult = lootbox.spin();

            // Save the updated lootbox
            const saveSuccess = await this.saveLootboxes();
            if (!saveSuccess) {
                console.warn('Spin successful but failed to save changes');
            }

            return {
                success: true,
                result: spinResult,
                lootbox: lootbox,
                oddsWarning: !oddsValidation.isValid ? oddsValidation.message : null
            };
        } catch (error) {
            console.error('Error spinning lootbox:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Generate a shareable URL for a lootbox
     * @param {number} index - Index of lootbox to share
     * @returns {Object} Share result with URL and metadata
     */
    generateShareUrl(index) {
        try {
            if (index < 0 || index >= this.lootboxes.length) {
                return {
                    success: false,
                    errors: ['Invalid lootbox index']
                };
            }

            const lootbox = this.lootboxes[index];
            
            // Create a clean copy for sharing (remove stats and IDs)
            const shareData = lootbox.copy({
                id: undefined,
                spins: 0,
                lastUsed: null,
                favorite: false,
                imported: false,
                importedAt: null
            });

            const data = encodeURIComponent(JSON.stringify(shareData.toObject()));
            const url = `${window.location.origin}${window.location.pathname}?share=${data}`;

            return {
                success: true,
                url: url,
                lootboxName: lootbox.name,
                shareData: shareData.toObject()
            };
        } catch (error) {
            console.error('Error generating share URL:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Import a lootbox from shared data
     * @param {Object} sharedData - Shared lootbox data
     * @returns {Object} Import result
     */
    async importSharedLootbox(sharedData) {
        try {
            // Check if this lootbox already exists
            const exists = this.lootboxes.some(existing => 
                existing.name === sharedData.name && 
                JSON.stringify(existing.items) === JSON.stringify(sharedData.items)
            );

            if (exists) {
                return {
                    success: false,
                    errors: [`"${sharedData.name}" is already in your collection`],
                    duplicate: true
                };
            }

            // Clean up the shared data for import
            const cleanData = {
                name: sharedData.name,
                items: sharedData.items,
                chestImage: sharedData.chestImage || 'chests/chest.png',
                revealContents: sharedData.revealContents !== false, // Default to true
                revealOdds: sharedData.revealOdds !== false, // Default to true
                maxTries: sharedData.maxTries || "unlimited",
                remainingTries: sharedData.remainingTries || sharedData.maxTries || "unlimited",
                spins: 0, // Reset stats for imported lootbox
                lastUsed: null, // Reset usage
                favorite: false, // Not a favorite by default
                imported: true, // Mark as imported
                importedAt: new Date().toISOString()
            };

            // Create and import the lootbox
            const result = await this.createLootbox(cleanData);
            
            if (result.success) {
                return {
                    success: true,
                    lootbox: result.lootbox,
                    imported: true,
                    message: `Successfully imported "${cleanData.name}"`
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('Error importing shared lootbox:', error);
            return {
                success: false,
                errors: [error.message || 'Error importing lootbox']
            };
        }
    }

    /**
     * Toggle favorite status of a lootbox
     * @param {number} index - Index of lootbox
     * @returns {Object} Result with new favorite status
     */
    async toggleFavorite(index) {
        try {
            if (index < 0 || index >= this.lootboxes.length) {
                return {
                    success: false,
                    errors: ['Invalid lootbox index']
                };
            }

            const lootbox = this.lootboxes[index];
            lootbox.favorite = !lootbox.favorite;
            lootbox.updatedAt = new Date().toISOString();

            const saveSuccess = await this.saveLootboxes();
            
            return {
                success: saveSuccess,
                favorite: lootbox.favorite,
                errors: saveSuccess ? [] : ['Failed to save favorite status']
            };
        } catch (error) {
            console.error('Error toggling favorite:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Reset lootbox statistics
     * @param {number} index - Index of lootbox
     * @returns {Object} Result of reset operation
     */
    async resetStats(index) {
        try {
            if (index < 0 || index >= this.lootboxes.length) {
                return {
                    success: false,
                    errors: ['Invalid lootbox index']
                };
            }

            const lootbox = this.lootboxes[index];
            lootbox.resetStats();

            const saveSuccess = await this.saveLootboxes();
            
            return {
                success: saveSuccess,
                lootbox: lootbox,
                errors: saveSuccess ? [] : ['Failed to save reset']
            };
        } catch (error) {
            console.error('Error resetting stats:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Get a lootbox by index
     * @param {number} index - Index of lootbox
     * @returns {Lootbox|null} Lootbox instance or null
     */
    getLootbox(index) {
        if (index < 0 || index >= this.lootboxes.length) {
            return null;
        }
        return this.lootboxes[index];
    }

    /**
     * Get all lootboxes
     * @returns {Array} Array of lootbox instances
     */
    getAllLootboxes() {
        return [...this.lootboxes];
    }

    /**
     * Filter lootboxes by criteria
     * @param {Object} criteria - Filter criteria
     * @returns {Array} Filtered lootboxes with indices
     */
    filterLootboxes(criteria) {
        const { filter = 'all', showFavoritesFirst = false } = criteria;
        
        let filtered = this.lootboxes.map((lootbox, index) => ({ lootbox, index }));

        // Apply filter
        if (filter === 'favorites') {
            filtered = filtered.filter(item => item.lootbox.favorite);
        } else if (filter === 'imported') {
            filtered = filtered.filter(item => item.lootbox.imported);
        } else if (filter === 'new') {
            filtered = filtered.filter(item => item.lootbox.spins === 0);
        } else if (filter === 'active') {
            filtered = filtered.filter(item => item.lootbox.canSpin);
        }

        // Sort
        filtered.sort((a, b) => {
            // Favorites first if requested
            if (showFavoritesFirst) {
                if (a.lootbox.favorite && !b.lootbox.favorite) return -1;
                if (!a.lootbox.favorite && b.lootbox.favorite) return 1;
            }

            // Then by most recent usage
            const aLastUsed = a.lootbox.lastUsed ? new Date(a.lootbox.lastUsed) : new Date(0);
            const bLastUsed = b.lootbox.lastUsed ? new Date(b.lootbox.lastUsed) : new Date(0);
            return bLastUsed - aLastUsed;
        });

        return filtered;
    }

    /**
     * Migrate old chest image paths
     */
    migrateChestPaths() {
        let migrated = false;
        this.lootboxes.forEach(lootbox => {
            if (lootbox.chestImage && lootbox.chestImage.includes('chests/OwnedChests/')) {
                lootbox.chestImage = lootbox.chestImage.replace('chests/OwnedChests/', 'chests/');
                migrated = true;
            }
        });
        
        if (migrated) {
            console.log('Migrated chest paths from OwnedChests to chests folder');
            this.saveLootboxes(); // Save the migrated data
        }
    }

    /**
     * Get summary statistics for all lootboxes
     * @returns {Object} Statistics summary
     */
    getStatistics() {
        const stats = {
            total: this.lootboxes.length,
            favorites: 0,
            imported: 0,
            totalSpins: 0,
            newBoxes: 0,
            activeBoxes: 0,
            mostUsed: null,
            recentlyUsed: []
        };

        this.lootboxes.forEach(lootbox => {
            if (lootbox.favorite) stats.favorites++;
            if (lootbox.imported) stats.imported++;
            if (lootbox.spins === 0) stats.newBoxes++;
            if (lootbox.canSpin) stats.activeBoxes++;
            
            stats.totalSpins += lootbox.spins;
            
            if (!stats.mostUsed || lootbox.spins > stats.mostUsed.spins) {
                stats.mostUsed = { name: lootbox.name, spins: lootbox.spins };
            }
            
            if (lootbox.lastUsed) {
                stats.recentlyUsed.push({
                    name: lootbox.name,
                    lastUsed: lootbox.lastUsed,
                    spins: lootbox.spins
                });
            }
        });

        // Sort recently used by date
        stats.recentlyUsed.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
        stats.recentlyUsed = stats.recentlyUsed.slice(0, 5); // Top 5

        return stats;
    }
}

export default LootboxController;
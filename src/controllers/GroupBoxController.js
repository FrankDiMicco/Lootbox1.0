import GroupBox from '../models/GroupBox.js';

/**
 * Controller for managing group box business logic
 */
class GroupBoxController {
    constructor(firebaseService, storageService) {
        this.firebaseService = firebaseService;
        this.storageService = storageService;
        this.participatedGroupBoxes = [];
        this.communityHistory = [];
    }

    /**
     * Initialize the controller
     */
    async initialize() {
        await this.loadParticipatedGroupBoxes();
    }

    /**
     * Load participated group boxes from Firebase and localStorage
     * @returns {Array} Array of group box objects
     */
    async loadParticipatedGroupBoxes() {
        try {
            // Try Firebase first if available
            if (this.firebaseService && this.firebaseService.isReady) {
                this.participatedGroupBoxes = await this.firebaseService.loadParticipatedGroupBoxes();
                // Also save to localStorage as backup
                this.storageService.saveGroupBoxes(this.participatedGroupBoxes);
            } else {
                // Fallback to localStorage
                this.participatedGroupBoxes = this.storageService.loadGroupBoxes();
            }

            // Convert plain objects to GroupBox instances
            this.participatedGroupBoxes = this.participatedGroupBoxes.map(data => GroupBox.fromObject(data));

            console.log(`Loaded ${this.participatedGroupBoxes.length} participated group boxes`);
            return this.participatedGroupBoxes;
        } catch (error) {
            console.error('Error loading participated group boxes:', error);
            this.participatedGroupBoxes = [];
            return [];
        }
    }

    /**
     * Save participated group boxes to storage
     * @returns {boolean} Success status
     */
    async saveParticipatedGroupBoxes() {
        try {
            const groupBoxData = this.participatedGroupBoxes.map(groupBox => groupBox.toObject());
            
            // Always save to localStorage as backup
            this.storageService.saveGroupBoxes(groupBoxData);
            
            console.log(`Saved ${this.participatedGroupBoxes.length} participated group boxes`);
            return true;
        } catch (error) {
            console.error('Error saving participated group boxes:', error);
            return false;
        }
    }

    /**
     * Create a new group box
     * @param {Object} lootboxData - Source lootbox data
     * @param {Object} groupBoxSettings - Group box specific settings
     * @returns {Object} Creation result
     */
    async createGroupBox(lootboxData, groupBoxSettings) {
        try {
            if (!this.firebaseService || !this.firebaseService.isReady) {
                return {
                    success: false,
                    errors: ['Firebase service not available']
                };
            }

            const currentUser = this.firebaseService.getCurrentUser();
            if (!currentUser) {
                return {
                    success: false,
                    errors: ['User not authenticated']
                };
            }

            // Prepare group box data
            const groupBoxData = {
                lootboxData: lootboxData,
                createdBy: currentUser.uid,
                creatorName: `User ${currentUser.uid.substring(0, 8)}`,
                createdAt: new Date().toISOString(),
                settings: groupBoxSettings,
                participants: [],
                totalOpens: 0,
                uniqueUsers: 0,
                organizerOnly: !groupBoxSettings.creatorParticipates,
                status: 'active'
            };

            // Create in Firebase
            const groupBoxId = await this.firebaseService.saveGroupBox(groupBoxData);

            // Create local group box instance
            const groupBox = new GroupBox({
                ...groupBoxData,
                groupBoxId: groupBoxId,
                id: groupBoxId,
                groupBoxName: lootboxData.name,
                isCreator: true,
                isOrganizerOnly: !groupBoxSettings.creatorParticipates,
                userTotalOpens: 0,
                userRemainingTries: groupBoxSettings.creatorParticipates ? groupBoxSettings.triesPerPerson : 0,
                firstParticipated: new Date().toISOString(),
                lastParticipated: new Date().toISOString(),
                favorite: false,
                isGroupBox: true
            });

            // Add to local collection
            this.participatedGroupBoxes.push(groupBox);
            await this.saveParticipatedGroupBoxes();

            // Add join event for the creator
            if (groupBoxSettings.creatorParticipates) {
                this.addJoinEvent(currentUser.uid, lootboxData.name);
            }

            return {
                success: true,
                groupBox: groupBox,
                groupBoxId: groupBoxId
            };
        } catch (error) {
            console.error('Error creating group box:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Join an existing group box
     * @param {string} groupBoxId - ID of the group box to join
     * @returns {Object} Join result
     */
    async joinGroupBox(groupBoxId) {
        try {
            if (!this.firebaseService || !this.firebaseService.isReady) {
                return {
                    success: false,
                    errors: ['Firebase service not available']
                };
            }

            // Check if already participating
            const existingGroupBox = this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId);
            if (existingGroupBox) {
                return {
                    success: true,
                    groupBox: existingGroupBox,
                    alreadyJoined: true
                };
            }

            // Load group box data from Firebase
            const groupBoxData = await this.firebaseService.loadGroupBox(groupBoxId);
            if (!groupBoxData) {
                return {
                    success: false,
                    errors: ['Group box not found']
                };
            }

            const currentUser = this.firebaseService.getCurrentUser();
            if (!currentUser) {
                return {
                    success: false,
                    errors: ['User not authenticated']
                };
            }

            // Create local group box instance
            const groupBox = new GroupBox({
                ...groupBoxData,
                groupBoxId: groupBoxId,
                groupBoxName: groupBoxData.lootboxData?.name || groupBoxData.name,
                isCreator: groupBoxData.createdBy === currentUser.uid,
                isOrganizerOnly: false,
                userTotalOpens: 0,
                userRemainingTries: groupBoxData.settings?.triesPerPerson || 3,
                firstParticipated: new Date().toISOString(),
                lastParticipated: new Date().toISOString(),
                favorite: false,
                isGroupBox: true
            });

            // Add participant to Firebase
            await this.addParticipantToGroupBox(groupBoxId, currentUser.uid);

            // Add to local collection
            this.participatedGroupBoxes.push(groupBox);
            await this.saveParticipatedGroupBoxes();

            // Add join event to community history
            this.addJoinEvent(currentUser.uid, groupBox.groupBoxName);

            return {
                success: true,
                groupBox: groupBox,
                joined: true
            };
        } catch (error) {
            console.error('Error joining group box:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Leave a group box
     * @param {string} groupBoxId - ID of the group box to leave
     * @returns {Object} Leave result
     */
    async leaveGroupBox(groupBoxId) {
        try {
            // Find the group box locally
            const index = this.participatedGroupBoxes.findIndex(gb => gb.groupBoxId === groupBoxId);
            if (index === -1) {
                return {
                    success: false,
                    errors: ['Group box not found in participated list']
                };
            }

            const groupBox = this.participatedGroupBoxes[index];
            const groupBoxName = groupBox.groupBoxName;

            // Remove from Firebase participant list if not creator
            if (!groupBox.isCreator && this.firebaseService && this.firebaseService.isReady) {
                try {
                    await this.removeParticipantFromGroupBox(groupBoxId, this.firebaseService.getCurrentUser().uid);
                } catch (error) {
                    console.warn('Failed to remove participant from Firebase:', error);
                    // Continue with local removal even if Firebase fails
                }
            }

            // Add leave event to community history
            if (this.firebaseService && this.firebaseService.getCurrentUser()) {
                this.addLeaveEvent(this.firebaseService.getCurrentUser().uid, groupBoxName);
            }

            // Remove from local collection
            this.participatedGroupBoxes.splice(index, 1);
            await this.saveParticipatedGroupBoxes();

            return {
                success: true,
                leftGroupBoxName: groupBoxName,
                wasCreator: groupBox.isCreator
            };
        } catch (error) {
            console.error('Error leaving group box:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Delete a group box (creator only)
     * @param {string} groupBoxId - ID of the group box to delete
     * @param {boolean} deleteForEveryone - Whether to delete for all users
     * @returns {Object} Delete result
     */
    async deleteGroupBox(groupBoxId, deleteForEveryone = false) {
        try {
            const groupBox = this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId);
            if (!groupBox) {
                return {
                    success: false,
                    errors: ['Group box not found']
                };
            }

            if (deleteForEveryone && !groupBox.isCreator) {
                return {
                    success: false,
                    errors: ['Only creators can delete for everyone']
                };
            }

            if (deleteForEveryone) {
                // Delete the entire group box from Firebase
                if (this.firebaseService && this.firebaseService.isReady) {
                    try {
                        await this.firebaseService.deleteGroupBox(groupBoxId);
                    } catch (error) {
                        console.error('Error deleting group box from Firebase:', error);
                        return {
                            success: false,
                            errors: ['Failed to delete group box']
                        };
                    }
                }
            } else {
                // Just remove from user's participated list
                return await this.leaveGroupBox(groupBoxId);
            }

            // Remove from local collection
            const index = this.participatedGroupBoxes.findIndex(gb => gb.groupBoxId === groupBoxId);
            if (index >= 0) {
                this.participatedGroupBoxes.splice(index, 1);
                await this.saveParticipatedGroupBoxes();
            }

            return {
                success: true,
                deletedForEveryone: deleteForEveryone,
                groupBoxName: groupBox.groupBoxName
            };
        } catch (error) {
            console.error('Error deleting group box:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Spin a group box for the current user
     * @param {string} groupBoxId - ID of the group box
     * @returns {Object} Spin result
     */
    async spinGroupBox(groupBoxId) {
        try {
            const groupBox = this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId);
            if (!groupBox) {
                return {
                    success: false,
                    errors: ['Group box not found']
                };
            }

            const currentUser = this.firebaseService.getCurrentUser();
            if (!currentUser) {
                return {
                    success: false,
                    errors: ['User not authenticated']
                };
            }

            // Check if user can spin
            if (!groupBox.canSpin(currentUser.uid)) {
                return {
                    success: false,
                    errors: ['Cannot spin: no tries remaining or access denied']
                };
            }

            // Perform the spin
            const spinResult = groupBox.spinForUser(currentUser.uid);

            // Record the spin in Firebase
            if (this.firebaseService && this.firebaseService.isReady) {
                try {
                    await this.firebaseService.recordSpin(groupBoxId, spinResult.item);
                } catch (error) {
                    console.warn('Failed to record spin in Firebase:', error);
                }
            }

            // Update local data
            await this.saveParticipatedGroupBoxes();

            // Add to community history
            this.addToCommunityHistory(spinResult.item, currentUser.uid);

            return {
                success: true,
                result: spinResult,
                groupBox: groupBox
            };
        } catch (error) {
            console.error('Error spinning group box:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Toggle favorite status of a group box
     * @param {string} groupBoxId - ID of the group box
     * @returns {Object} Result with new favorite status
     */
    async toggleGroupBoxFavorite(groupBoxId) {
        try {
            const groupBox = this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId);
            if (!groupBox) {
                return {
                    success: false,
                    errors: ['Group box not found']
                };
            }

            groupBox.favorite = !groupBox.favorite;
            groupBox.updatedAt = new Date().toISOString();

            const saveSuccess = await this.saveParticipatedGroupBoxes();
            
            return {
                success: saveSuccess,
                favorite: groupBox.favorite,
                errors: saveSuccess ? [] : ['Failed to save favorite status']
            };
        } catch (error) {
            console.error('Error toggling group box favorite:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Generate a shareable URL for a group box
     * @param {string} groupBoxId - ID of the group box
     * @returns {Object} Share result with URL
     */
    generateGroupBoxShareUrl(groupBoxId) {
        try {
            const groupBox = this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId);
            if (!groupBox) {
                return {
                    success: false,
                    errors: ['Group box not found']
                };
            }

            if (!groupBox.isCreator) {
                return {
                    success: false,
                    errors: ['Only creators can share group boxes']
                };
            }

            const url = `${window.location.origin}${window.location.pathname}?groupbox=${groupBoxId}`;

            return {
                success: true,
                url: url,
                groupBoxName: groupBox.groupBoxName,
                groupBoxId: groupBoxId
            };
        } catch (error) {
            console.error('Error generating group box share URL:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Sync group box data from Firebase
     * @param {string} groupBoxId - ID of the group box to sync
     * @returns {Object} Sync result
     */
    async syncGroupBoxData(groupBoxId) {
        try {
            if (!this.firebaseService || !this.firebaseService.isReady) {
                return {
                    success: false,
                    errors: ['Firebase service not available']
                };
            }

            const groupBox = this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId);
            if (!groupBox) {
                return {
                    success: false,
                    errors: ['Group box not found in local data']
                };
            }

            // Load fresh data from Firebase
            const freshData = await this.firebaseService.loadGroupBox(groupBoxId);
            if (!freshData) {
                return {
                    success: false,
                    errors: ['Group box not found in Firebase']
                };
            }

            // Update local group box with fresh data
            Object.assign(groupBox, {
                totalOpens: freshData.totalOpens || 0,
                uniqueUsers: freshData.uniqueUsers || 0,
                participants: freshData.participants || [],
                settings: freshData.settings || groupBox.settings,
                lastParticipated: new Date().toISOString()
            });

            // Save updated data
            await this.saveParticipatedGroupBoxes();

            return {
                success: true,
                groupBox: groupBox,
                synced: true
            };
        } catch (error) {
            console.error('Error syncing group box data:', error);
            return {
                success: false,
                errors: [error.message || 'Unknown error occurred']
            };
        }
    }

    /**
     * Add an entry to community history
     * @param {string} item - Item that was won
     * @param {string} userId - User who won the item
     */
    addToCommunityHistory(item, userId) {
        const userName = userId === 'anonymous' ? 'Anonymous User' : `User ${userId.substring(0, 8)}`;
        
        const communityEntry = {
            userId: userId,
            userName: userName,
            item: item,
            timestamp: new Date(),
            sessionId: Date.now().toString()
        };
        
        // Add to local community history (will be at the top since it's most recent)
        this.communityHistory.unshift(communityEntry);
        
        // Keep only the most recent 50 entries
        if (this.communityHistory.length > 50) {
            this.communityHistory = this.communityHistory.slice(0, 50);
        }
    }

    /**
     * Add join event to community history
     * @param {string} userId - User who joined
     * @param {string} groupBoxName - Name of the group box
     */
    addJoinEvent(userId, groupBoxName) {
        const userName = userId === 'anonymous' ? 'Anonymous User' : `User ${userId.substring(0, 8)}`;
        
        const joinEntry = {
            userId: userId,
            userName: userName,
            item: null,
            action: 'join',
            timestamp: new Date(),
            sessionId: Date.now().toString()
        };
        
        this.communityHistory.unshift(joinEntry);
        
        if (this.communityHistory.length > 50) {
            this.communityHistory = this.communityHistory.slice(0, 50);
        }
    }

    /**
     * Add leave event to community history
     * @param {string} userId - User who left
     * @param {string} groupBoxName - Name of the group box
     */
    addLeaveEvent(userId, groupBoxName) {
        const userName = userId === 'anonymous' ? 'Anonymous User' : `User ${userId.substring(0, 8)}`;
        
        const leaveEntry = {
            userId: userId,
            userName: userName,
            item: null,
            action: 'leave',
            timestamp: new Date(),
            sessionId: Date.now().toString()
        };
        
        this.communityHistory.unshift(leaveEntry);
        
        if (this.communityHistory.length > 50) {
            this.communityHistory = this.communityHistory.slice(0, 50);
        }
    }

    /**
     * Clear community history (for debugging)
     */
    clearCommunityHistory() {
        this.communityHistory = [];
        console.log('Cleared community history (debug only - does not affect Firestore data)');
    }

    /**
     * Get community history
     * @returns {Array} Community history entries
     */
    getCommunityHistory() {
        return [...this.communityHistory];
    }

    /**
     * Get a group box by ID
     * @param {string} groupBoxId - Group box ID
     * @returns {GroupBox|null} Group box instance or null
     */
    getGroupBox(groupBoxId) {
        return this.participatedGroupBoxes.find(gb => gb.groupBoxId === groupBoxId) || null;
    }

    /**
     * Get all participated group boxes
     * @returns {Array} Array of group box instances
     */
    getAllGroupBoxes() {
        return [...this.participatedGroupBoxes];
    }

    /**
     * Filter group boxes by criteria
     * @param {Object} criteria - Filter criteria
     * @returns {Array} Filtered group boxes
     */
    filterGroupBoxes(criteria) {
        const { 
            filter = 'all', 
            showFavoritesFirst = false,
            includeExpired = true 
        } = criteria;
        
        let filtered = [...this.participatedGroupBoxes];

        // Apply filter
        if (filter === 'favorites') {
            filtered = filtered.filter(gb => gb.favorite);
        } else if (filter === 'created') {
            filtered = filtered.filter(gb => gb.isCreator);
        } else if (filter === 'participating') {
            filtered = filtered.filter(gb => !gb.isCreator);
        } else if (filter === 'active') {
            filtered = filtered.filter(gb => gb.userRemainingTries > 0);
        }

        if (!includeExpired) {
            filtered = filtered.filter(gb => !gb.isExpired);
        }

        // Sort
        filtered.sort((a, b) => {
            // Favorites first if requested
            if (showFavoritesFirst) {
                if (a.favorite && !b.favorite) return -1;
                if (!a.favorite && b.favorite) return 1;
            }

            // Then by most recent participation
            const aLastUsed = new Date(a.lastParticipated || a.firstParticipated || 0);
            const bLastUsed = new Date(b.lastParticipated || b.firstParticipated || 0);
            return bLastUsed - aLastUsed;
        });

        return filtered;
    }

    /**
     * Add participant to a group box in Firebase
     * @private
     */
    async addParticipantToGroupBox(groupBoxId, userId) {
        // This would need to be implemented in FirebaseService
        // For now, just log the action
        console.log(`Adding participant ${userId} to group box ${groupBoxId}`);
    }

    /**
     * Remove participant from a group box in Firebase
     * @private
     */
    async removeParticipantFromGroupBox(groupBoxId, userId) {
        // This would need to be implemented in FirebaseService
        // For now, just log the action
        console.log(`Removing participant ${userId} from group box ${groupBoxId}`);
    }

    /**
     * Merge local and remote group box data
     * This helps handle cases where data might be out of sync
     * @param {Array} remoteGroupBoxes - Group boxes from Firebase
     * @returns {Array} Merged group boxes
     */
    mergeGroupBoxData(remoteGroupBoxes) {
        const local = this.participatedGroupBoxes;
        const remote = remoteGroupBoxes || [];

        // Create a map of local group boxes by ID
        const byId = new Map(local.map(x => [x.groupBoxId, x]));
        
        // Merge remote data into local, preserving local data when remote is empty
        for (const remoteBox of remote) {
            const existingLocal = byId.get(remoteBox.groupBoxId);
            if (existingLocal) {
                // Update existing with remote data, but preserve important local fields
                byId.set(remoteBox.groupBoxId, { 
                    ...existingLocal.toObject(), 
                    ...remoteBox,
                    favorite: existingLocal.favorite // Preserve local favorite status
                });
            } else {
                // Add new remote group box
                byId.set(remoteBox.groupBoxId, remoteBox);
            }
        }

        // Convert back to GroupBox instances
        const merged = [...byId.values()].map(data => GroupBox.fromObject(data));
        
        this.participatedGroupBoxes = merged;
        return merged;
    }

    /**
     * Get statistics for all group boxes
     * @returns {Object} Statistics summary
     */
    getStatistics() {
        const stats = {
            total: this.participatedGroupBoxes.length,
            created: 0,
            participating: 0,
            favorites: 0,
            totalOpens: 0,
            totalTries: 0,
            activeBoxes: 0,
            expiredBoxes: 0,
            mostActive: null
        };

        this.participatedGroupBoxes.forEach(groupBox => {
            if (groupBox.isCreator) stats.created++;
            else stats.participating++;
            
            if (groupBox.favorite) stats.favorites++;
            if (groupBox.userRemainingTries > 0) stats.activeBoxes++;
            if (groupBox.isExpired) stats.expiredBoxes++;
            
            stats.totalOpens += groupBox.userTotalOpens || 0;
            stats.totalTries += (groupBox.triesPerPerson || 3) - (groupBox.userRemainingTries || 0);
            
            if (!stats.mostActive || (groupBox.totalOpens || 0) > (stats.mostActive.totalOpens || 0)) {
                stats.mostActive = {
                    name: groupBox.groupBoxName,
                    totalOpens: groupBox.totalOpens || 0,
                    uniqueUsers: groupBox.uniqueUsers || 0
                };
            }
        });

        return stats;
    }
}

export default GroupBoxController;
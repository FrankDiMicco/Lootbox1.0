class StorageService {
    constructor(prefix = 'lootbox_') {
        this.prefix = prefix;
    }

    /**
     * Get a prefixed key name
     * @param {string} key - The base key name
     * @returns {string} - The prefixed key name
     */
    getKey(key) {
        return `${this.prefix}${key}`;
    }

    /**
     * Generic get method with automatic JSON parsing
     * @param {string} key - The key to retrieve
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - The parsed value or default
     */
    get(key, defaultValue = null) {
        try {
            const prefixedKey = this.getKey(key);
            const item = localStorage.getItem(prefixedKey);
            
            if (item === null) {
                return defaultValue;
            }
            
            // Try to parse as JSON, return as string if parsing fails
            try {
                return JSON.parse(item);
            } catch (parseError) {
                console.warn(`Failed to parse JSON for key ${prefixedKey}:`, parseError);
                return item;
            }
        } catch (error) {
            console.error(`Error getting item from localStorage for key ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Generic set method with automatic JSON stringifying
     * @param {string} key - The key to store
     * @param {*} value - The value to store
     * @returns {boolean} - Success status
     */
    set(key, value) {
        try {
            const prefixedKey = this.getKey(key);
            let stringValue;
            
            if (typeof value === 'string') {
                stringValue = value;
            } else {
                stringValue = JSON.stringify(value);
            }
            
            localStorage.setItem(prefixedKey, stringValue);
            return true;
        } catch (error) {
            console.error(`Error setting item in localStorage for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Generic remove method
     * @param {string} key - The key to remove
     * @returns {boolean} - Success status
     */
    remove(key) {
        try {
            const prefixedKey = this.getKey(key);
            localStorage.removeItem(prefixedKey);
            return true;
        } catch (error) {
            console.error(`Error removing item from localStorage for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Clear all items with the service prefix
     * @returns {boolean} - Success status
     */
    clear() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log(`Cleared ${keysToRemove.length} items with prefix ${this.prefix}`);
            return true;
        } catch (error) {
            console.error('Error clearing localStorage items:', error);
            return false;
        }
    }

    /**
     * Check if a key exists
     * @param {string} key - The key to check
     * @returns {boolean} - Whether the key exists
     */
    exists(key) {
        const prefixedKey = this.getKey(key);
        return localStorage.getItem(prefixedKey) !== null;
    }

    /**
     * Save lootboxes to localStorage
     * @param {Array} lootboxes - Array of lootbox objects
     * @returns {boolean} - Success status
     */
    saveLootboxes(lootboxes) {
        try {
            const success = this.set('lootboxes', lootboxes);
            if (success) {
                console.log(`Saved ${lootboxes.length} lootboxes to localStorage`);
            }
            return success;
        } catch (error) {
            console.error('Error saving lootboxes to localStorage:', error);
            return false;
        }
    }

    /**
     * Load lootboxes from localStorage
     * @returns {Array} - Array of lootbox objects
     */
    loadLootboxes() {
        try {
            const lootboxes = this.get('lootboxes', []);
            console.log(`Loaded ${lootboxes.length} lootboxes from localStorage`);
            return lootboxes;
        } catch (error) {
            console.error('Error loading lootboxes from localStorage:', error);
            return [];
        }
    }

    /**
     * Save group boxes to localStorage
     * @param {Array} boxes - Array of group box objects
     * @returns {boolean} - Success status
     */
    saveGroupBoxes(boxes) {
        try {
            const success = this.set('participatedGroupBoxes', boxes);
            if (success) {
                console.log(`Saved ${boxes.length} group boxes to localStorage`);
            }
            return success;
        } catch (error) {
            console.error('Error saving group boxes to localStorage:', error);
            return false;
        }
    }

    /**
     * Load group boxes from localStorage
     * @returns {Array} - Array of group box objects
     */
    loadGroupBoxes() {
        try {
            const boxes = this.get('participatedGroupBoxes', []);
            console.log(`Loaded ${boxes.length} group boxes from localStorage`);
            return boxes;
        } catch (error) {
            console.error('Error loading group boxes from localStorage:', error);
            return [];
        }
    }

    /**
     * Get storage usage information
     * @returns {Object} - Storage usage stats
     */
    getStorageInfo() {
        try {
            let totalSize = 0;
            let prefixedItems = 0;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                
                if (key && key.startsWith(this.prefix)) {
                    prefixedItems++;
                    totalSize += key.length + (value ? value.length : 0);
                }
            }
            
            return {
                prefixedItems,
                totalSize,
                totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
                prefix: this.prefix
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return {
                prefixedItems: 0,
                totalSize: 0,
                totalSizeKB: 0,
                prefix: this.prefix,
                error: error.message
            };
        }
    }
}

export default StorageService;
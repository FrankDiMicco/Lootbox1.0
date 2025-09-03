// src/models/GroupBox.js
import Lootbox from "./Lootbox.js";

class GroupBox extends Lootbox {
  constructor(data = {}) {
    // Initialize base Lootbox properties
    super(data);

    // GroupBox specific properties
    this.isGroupBox = true;
    this.groupBoxId = data.groupBoxId || data.id;
    this.groupBoxName =
      data.groupBoxName || data.lootboxData?.name || data.name;
    this.lootboxData = data.lootboxData || {};
    this.settings = data.settings || {};
    this.createdBy = data.createdBy || null;
    this.creatorName = data.creatorName || "Anonymous";
    this.isCreator = data.isCreator || false;
    this.isOrganizerOnly = data.isOrganizerOnly || false;
    this.organizerOnly = data.organizerOnly || false;
    this.creatorParticipates =
      data.creatorParticipates !== undefined ? data.creatorParticipates : true;

    // User-specific data
    this.userTotalOpens = data.userTotalOpens || 0;
    this.viewed = data.viewed || false; // Track if user has clicked on this group box
    this.userRemainingTries =
      data.userRemainingTries !== undefined
        ? data.userRemainingTries
        : data.settings?.triesPerPerson || 3;
    this.firstParticipated = data.firstParticipated || null;
    this.lastParticipated = data.lastParticipated || null;
    this.lastInteracted = data.lastInteracted || null; // Track when user clicked on this group box

    // Group statistics
    this.totalOpens = data.totalOpens || 0;
    this.uniqueUsers = data.uniqueUsers || 0;

    // Other properties
    this.expiresIn = data.settings?.expiresIn || data.expiresIn || "never";
    this.expiresAt = data.expiresAt || null;
    this.participants = data.participants || [];
    this.maxParticipants = data.maxParticipants || null;
    this.triesPerPerson =
      data.settings?.triesPerPerson || data.triesPerPerson || 3;

    // Override items from lootboxData if present
    if (this.lootboxData?.items) {
      this.items = this.lootboxData.items;
    }

    // Override reveal settings from lootboxData if present
    if (this.lootboxData?.revealContents !== undefined) {
      this.revealContents = this.lootboxData.revealContents;
    }
    if (this.lootboxData?.revealOdds !== undefined) {
      this.revealOdds = this.lootboxData.revealOdds;
    }

    // Override chest image from lootboxData if present
    if (this.lootboxData?.chestImage) {
      this.chestImage = this.lootboxData.chestImage;
    }
  }

  canSpin(userId) {
    // Check if group box has items
    const items = this.items || this.lootboxData?.items || [];
    if (items.length === 0) {
      return false;
    }

    // Check if expired
    if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
      return false;
    }

    // Check if organizer-only (creator can't spin)
    if (this.isOrganizerOnly) {
      return false;
    }

    // Check user's remaining tries
    if (this.userRemainingTries === "unlimited") {
      return true;
    }

    return this.userRemainingTries > 0;
  }

  spinForUser(userId) {
    if (!this.canSpin(userId)) {
      throw new Error("Cannot spin: no remaining tries or group box expired");
    }

    // Get items from lootboxData or main items array
    const items = this.items || this.lootboxData?.items || [];

    // Calculate weighted random selection
    const totalOdds = items.reduce((sum, item) => sum + (item.odds || 0), 0);
    let random = Math.random() * totalOdds;

    let selectedItem = null;
    for (const item of items) {
      random -= item.odds || 0;
      if (random <= 0) {
        selectedItem = item;
        break;
      }
    }

    // Fallback to first item if something went wrong
    if (!selectedItem && items.length > 0) {
      selectedItem = items[0];
    }

    return {
      item: selectedItem.name,
      timestamp: new Date().toISOString(),
      userId: userId,
    };
  }

  toObject() {
    // Get base lootbox object
    const baseObject = super.toObject();

    // Add GroupBox specific properties
    return {
      ...baseObject,
      isGroupBox: this.isGroupBox,
      groupBoxId: this.groupBoxId,
      groupBoxName: this.groupBoxName,
      lootboxData: this.lootboxData,
      settings: this.settings,
      createdBy: this.createdBy,
      creatorName: this.creatorName,
      isCreator: this.isCreator,
      isOrganizerOnly: this.isOrganizerOnly,
      organizerOnly: this.organizerOnly,
      creatorParticipates: this.creatorParticipates,
      userTotalOpens: this.userTotalOpens,
      viewed: this.viewed,
      userRemainingTries: this.userRemainingTries,
      firstParticipated: this.firstParticipated,
      lastParticipated: this.lastParticipated,
      lastInteracted: this.lastInteracted,
      totalOpens: this.totalOpens,
      uniqueUsers: this.uniqueUsers,
      totalSpins: this.totalSpins,
      activeUsers: this.activeUsers,
      expiresIn: this.expiresIn,
      expiresAt: this.expiresAt,
      participants: this.participants,
      maxParticipants: this.maxParticipants,
      triesPerPerson: this.triesPerPerson,
    };
  }
}

export default GroupBox;

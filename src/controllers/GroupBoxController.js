// src/controllers/GroupBoxController.js
import GroupBox from "../models/GroupBox.js";

class GroupBoxController {
  constructor(firebaseService, storageService) {
    this.firebase = firebaseService;
    this.storage = storageService;
    this.groupBoxes = [];
    this.communityHistory = [];
  }

  async initialize() {
    try {
      // Test if GroupBox class is imported correctly
      console.log("GroupBox class:", GroupBox);

      // Load participated group boxes from Firebase
      if (this.firebase.isReady) {
        const firebaseGroupBoxes =
          await this.firebase.loadParticipatedGroupBoxes();
        console.log("Raw Firebase group box data:", firebaseGroupBoxes);

        // Ensure we create GroupBox instances from the data
        this.groupBoxes = firebaseGroupBoxes.map((data, index) => {
          console.log(`Processing Firebase group box ${index}:`, data);

          // Check if it's already a GroupBox instance
          if (data instanceof GroupBox) {
            return data;
          }

          // Create GroupBox with explicit property assignment
          const groupBox = Object.assign(new GroupBox(), {
            // Core lootbox properties (GroupBox extends Lootbox)
            id: data.id,
            name:
              data.lootboxData?.name ||
              data.groupBoxName ||
              "Unnamed Group Box",
            items: data.lootboxData?.items || [],
            chestImage: data.lootboxData?.chestImage || "chests/chest.png",
            revealContents:
              data.lootboxData?.revealContents !== undefined
                ? data.lootboxData.revealContents
                : true,
            revealOdds:
              data.lootboxData?.revealOdds !== undefined
                ? data.lootboxData.revealOdds
                : true,

            // Group box specific properties
            isGroupBox: true,
            groupBoxId: data.groupBoxId || data.id,
            groupBoxName:
              data.groupBoxName ||
              data.lootboxData?.name ||
              "Unnamed Group Box",
            lootboxData: data.lootboxData,
            settings: data.settings,
            createdBy: data.createdBy,
            creatorName: data.creatorName,
            isCreator: data.isCreator,
            isOrganizerOnly: data.isOrganizerOnly,
            organizerOnly: data.organizerOnly,
            creatorParticipates: data.creatorParticipates,

            // User-specific data
            userTotalOpens: data.userTotalOpens || 0,
            userRemainingTries:
              data.userRemainingTries !== undefined
                ? data.userRemainingTries
                : data.settings?.triesPerPerson || 3,
            firstParticipated: data.firstParticipated,
            lastParticipated: data.lastParticipated,

            // Group statistics
            totalOpens: data.totalOpens || 0,
            uniqueUsers: data.uniqueUsers || 0,

            // Other properties
            favorite: data.favorite || false,
            expiresIn: data.settings?.expiresIn || "never",
            expiresAt: data.expiresAt,
            participants: data.participants || [],
            maxParticipants: data.maxParticipants,
            triesPerPerson: data.settings?.triesPerPerson || 3,
          });

          console.log(`Created GroupBox ${index}:`, groupBox);
          console.log(`GroupBox ${index} name:`, groupBox.groupBoxName);
          return groupBox;
        });
        console.log(
          `Loaded ${this.groupBoxes.length} group boxes from Firebase`
        );
        console.log("Final groupBoxes array:", this.groupBoxes);
      }

      // Fall back to local storage if needed
      if (this.groupBoxes.length === 0) {
        const storageGroupBoxes = this.storage.loadGroupBoxes();
        // Ensure we create GroupBox instances from the data
        this.groupBoxes = storageGroupBoxes.map((data) => {
          // Check if it's already a GroupBox instance
          if (data instanceof GroupBox) {
            return data;
          }
          return new GroupBox(data);
        });
        console.log(
          `Loaded ${this.groupBoxes.length} group boxes from localStorage`
        );
      }

      // Verify all items are GroupBox instances
      const allAreGroupBoxes = this.groupBoxes.every(
        (item) => item instanceof GroupBox
      );
      if (!allAreGroupBoxes) {
        console.error("Not all items are GroupBox instances!");
        // Convert any non-GroupBox items
        this.groupBoxes = this.groupBoxes.map((item) => {
          if (item instanceof GroupBox) {
            return item;
          }
          console.warn("Converting non-GroupBox item:", item);
          return new GroupBox(item);
        });
      }
    } catch (error) {
      console.error("Error initializing group boxes:", error);
      this.groupBoxes = [];
    }
  }

  getAllGroupBoxes() {
    return this.groupBoxes;
  }

  getGroupBox(groupBoxId) {
    return this.groupBoxes.find((gb) => gb.groupBoxId === groupBoxId) || null;
  }

  getCommunityHistory() {
    return this.communityHistory;
  }

  async createGroupBox(lootboxData, settings) {
    try {
      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      const groupBoxData = {
        lootboxData: {
          ...lootboxData,
          revealContents: !settings.hideContents,
          revealOdds: !settings.hideOdds,
        },
        createdBy: currentUser.uid,
        creatorName: currentUser.displayName || "Anonymous",
        organizerOnly: !settings.creatorParticipates,
        settings: {
          triesPerPerson: settings.unlimitedGroupTries
            ? "unlimited"
            : settings.triesPerPerson,
          hideContents: settings.hideContents,
          hideOdds: settings.hideOdds,
          creatorParticipates: settings.creatorParticipates,
          expiresIn: settings.expiresIn,
        },
        participants: [],
        totalOpens: 0,
        uniqueUsers: 0,
        createdAt: new Date().toISOString(),
      };

      // Calculate expiration
      if (settings.expiresIn !== "never") {
        const expirationHours = parseInt(settings.expiresIn);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expirationHours);
        groupBoxData.expiresAt = expiresAt.toISOString();
      }

      // Save to Firebase
      const groupBoxId = await this.firebase.saveGroupBox(groupBoxData);
      if (!groupBoxId) {
        throw new Error("Failed to create group box ID");
      }

      const groupBox = new GroupBox({
        ...groupBoxData,
        id: groupBoxId, // ADD THIS
        groupBoxId: groupBoxId, // Make sure this is here
        groupBoxName: lootboxData.name,
        items: lootboxData.items,
        isCreator: true,
        isOrganizerOnly: !settings.creatorParticipates,
        userTotalOpens: 0,
        userRemainingTries: settings.creatorParticipates
          ? settings.unlimitedGroupTries
            ? "unlimited"
            : settings.triesPerPerson
          : 0,
      });

      this.groupBoxes.push(groupBox);
      await this.save();

      // If creator participates, record their join
      // If creator participates, also create a participant record for them
      if (settings.creatorParticipates) {
        const { collection, addDoc } = window.firebaseFunctions;
        const participantData = {
          groupBoxId,
          groupBoxName: lootboxData.name,
          lootboxData: groupBoxData.lootboxData,
          settings: groupBoxData.settings,
          createdBy: currentUser.uid,
          creatorName: currentUser.displayName || "Anonymous",
          totalOpens: 0,
          uniqueUsers: 0,
          firstParticipated: new Date().toISOString(),
          userTotalOpens: 0,
          userRemainingTries: settings.unlimitedGroupTries
            ? "unlimited"
            : settings.triesPerPerson,
          isCreator: true,
          isOrganizerOnly: false,
          favorite: false,
        };

        const docRef = await addDoc(
          collection(
            this.firebase.db,
            "users",
            currentUser.uid,
            "participated_group_boxes"
          ),
          participantData
        );

        // Update the local group box with the document ID
        groupBox.id = docRef.id;
        this.groupBoxes[this.groupBoxes.length - 1].id = docRef.id;
        // Update the GroupBox in the array with the correct id
        const index = this.groupBoxes.findIndex(
          (gb) => gb.groupBoxId === groupBoxId
        );
        if (index >= 0) {
          this.groupBoxes[index].id = docRef.id;
        }
        // Record join event for creator
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "join",
          userId: currentUser.uid,
          userName: currentUser.uid,
          message: `User ${currentUser.uid} joined the box`,
          timestamp: new Date().toISOString(),
        });
      }

      return { success: true, groupBoxId, groupBox };
    } catch (error) {
      console.error("Error creating group box:", error);
      return { success: false, errors: [error.message] };
    }
  }

  // Replace the joinGroupBox method in GroupBoxController.js with this fixed version:

  async joinGroupBox(groupBoxId) {
    try {
      // Check if already joined locally
      const existing = this.groupBoxes.find(
        (gb) => gb.groupBoxId === groupBoxId
      );
      if (existing) {
        return { success: true, alreadyJoined: true, groupBox: existing };
      }

      // Load from Firebase
      const groupBoxData = await this.firebase.loadGroupBox(groupBoxId);
      if (!groupBoxData) {
        return { success: false, errors: ["Group box not found"] };
      }

      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      // Check if expired
      if (
        groupBoxData.expiresAt &&
        new Date(groupBoxData.expiresAt) <= new Date()
      ) {
        return { success: false, errors: ["This group box has expired"] };
      }

      // Check if user already has a participation record in Firebase
      const { collection, query, where, getDocs } = window.firebaseFunctions;
      const participatedRef = collection(
        this.firebase.db,
        "users",
        currentUser.uid,
        "participated_group_boxes"
      );

      // Query for existing participation in this specific group box
      const q = query(participatedRef, where("groupBoxId", "==", groupBoxId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // User already participated before - restore their existing record
        const existingDoc = querySnapshot.docs[0];
        const existingData = existingDoc.data();

        console.log(
          `Restoring existing participation: ${existingData.userRemainingTries} tries left`
        );

        // Create GroupBox from existing data
        const groupBox = new GroupBox({
          ...existingData,
          id: existingDoc.id,
          isGroupBox: true,
        });

        this.groupBoxes.push(groupBox);
        await this.save();

        // Record rejoin event
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "join",
          userId: currentUser.uid,
          userName: currentUser.uid,
          message: `User ${currentUser.uid} rejoined the box`,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          alreadyJoined: false,
          groupBox,
          message: `Rejoined with ${existingData.userRemainingTries} tries remaining`,
        };
      }

      // New participant - create fresh participation record
      console.log(
        "Setting tries for new participant:",
        groupBoxData.settings?.triesPerPerson
      );

      const participantData = {
        groupBoxId,
        groupBoxName: groupBoxData.lootboxData?.name || "Unnamed Group Box",
        lootboxData: groupBoxData.lootboxData,
        settings: groupBoxData.settings,
        createdBy: groupBoxData.createdBy,
        creatorName: groupBoxData.creatorName,
        totalOpens: groupBoxData.totalOpens || 0,
        uniqueUsers: groupBoxData.uniqueUsers || 0,
        firstParticipated: new Date().toISOString(),
        userTotalOpens: 0,
        userRemainingTries: groupBoxData.settings?.triesPerPerson || 3,
        isCreator: groupBoxData.createdBy === currentUser.uid,
        isOrganizerOnly: false,
        favorite: false,
      };

      // Save to user's participated collection
      const { addDoc } = window.firebaseFunctions;
      const docRef = await addDoc(
        collection(
          this.firebase.db,
          "users",
          currentUser.uid,
          "participated_group_boxes"
        ),
        participantData
      );

      // Record join event in session history
      await this.firebase.addSessionHistoryEvent(groupBoxId, {
        type: "join",
        userId: currentUser.uid,
        userName: currentUser.uid,
        message: `User ${currentUser.uid} joined the box`,
        timestamp: new Date().toISOString(),
      });

      participantData.id = docRef.id;

      const groupBox = new GroupBox(participantData);
      this.groupBoxes.push(groupBox);
      await this.save();

      return { success: true, alreadyJoined: false, groupBox };
    } catch (error) {
      console.error("Error joining group box:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async spinGroupBox(groupBoxId) {
    try {
      const groupBox = this.getGroupBox(groupBoxId);
      if (!groupBox) {
        return { success: false, errors: ["Group box not found"] };
      }

      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      if (!groupBox.canSpin(currentUser.uid)) {
        return {
          success: false,
          errors: ["Cannot spin: no remaining tries or group box expired"],
        };
      }

      const result = groupBox.spinForUser(currentUser.uid);

      // Update local stats
      groupBox.userTotalOpens++;
      groupBox.userRemainingTries--;
      groupBox.lastParticipated = new Date().toISOString();

      // Record spin event in shared session history (local history is handled by App.handleSpinResult)
      const userName = currentUser.uid;
      await this.firebase.addSessionHistoryEvent(groupBoxId, {
        type: "spin",
        userId: currentUser.uid,
        userName: userName,
        item: result.item,
        message: `${userName} opened the box and got "${result.item}"`,
        timestamp: new Date().toISOString(),
      });

      // Save to Firebase
      // Save to Firebase
      if (this.firebase.isReady) {
        // Update participant record only if we have an id
        if (groupBox.id) {
          const { updateDoc, doc } = window.firebaseFunctions;
          await updateDoc(
            doc(
              this.firebase.db,
              "users",
              currentUser.uid,
              "participated_group_boxes",
              groupBox.id
            ),
            {
              userTotalOpens: groupBox.userTotalOpens,
              userRemainingTries: groupBox.userRemainingTries,
              lastParticipated: groupBox.lastParticipated,
            }
          );
        }

        // Record spin
        await this.firebase.recordSpin(groupBoxId, result);
      }

      await this.save();
      return { success: true, result };
    } catch (error) {
      console.error("Error spinning group box:", error);
      return { success: false, errors: [error.message] };
    }
  }

  // Replace the deleteGroupBox method in GroupBoxController.js with this:

  async deleteGroupBox(groupBoxId, deleteForEveryone = false) {
    try {
      const groupBox = this.getGroupBox(groupBoxId);
      if (!groupBox) {
        return { success: false, errors: ["Group box not found"] };
      }

      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      // Check if group box still exists in Firebase
      let existsInFirebase = true;
      try {
        await this.firebase.loadGroupBox(groupBoxId);
      } catch (error) {
        existsInFirebase = false;
      }

      const groupBoxName = groupBox.groupBoxName;

      // If it doesn't exist in Firebase, just remove it locally
      if (!existsInFirebase) {
        // Remove from user's participated collection if it has an id
        if (groupBox.id) {
          try {
            const { deleteDoc, doc } = window.firebaseFunctions;
            await deleteDoc(
              doc(
                this.firebase.db,
                "users",
                currentUser.uid,
                "participated_group_boxes",
                groupBox.id
              )
            );
          } catch (error) {
            console.log("Couldn't delete user participation record:", error);
          }
        }

        // Remove from local array
        const index = this.groupBoxes.findIndex(
          (gb) => gb.groupBoxId === groupBoxId
        );
        if (index >= 0) {
          this.groupBoxes.splice(index, 1);
        }

        await this.save();
        return {
          success: true,
          groupBoxName: groupBoxName + " (already deleted by creator)",
        };
      }

      // If we're here, the group box exists in Firebase
      if (deleteForEveryone && groupBox.isCreator) {
        // Delete the group box from Firebase (for everyone)
        const { deleteDoc, doc } = window.firebaseFunctions;
        await deleteDoc(doc(this.firebase.db, "group_boxes", groupBoxId));

        // Also delete the participation record
        if (groupBox.id) {
          await deleteDoc(
            doc(
              this.firebase.db,
              "users",
              currentUser.uid,
              "participated_group_boxes",
              groupBox.id
            )
          );
        }
      } else {
        // User is leaving but NOT deleting for everyone
        // DON'T delete the participation record - just mark as left
        if (groupBox.id) {
          const { updateDoc, doc } = window.firebaseFunctions;
          await updateDoc(
            doc(
              this.firebase.db,
              "users",
              currentUser.uid,
              "participated_group_boxes",
              groupBox.id
            ),
            {
              hasLeft: true,
              leftAt: new Date().toISOString(),
              // Preserve their tries count
              userRemainingTries: groupBox.userRemainingTries,
              userTotalOpens: groupBox.userTotalOpens,
            }
          );
          console.log(
            `Marked participation as left, preserving ${groupBox.userRemainingTries} remaining tries`
          );
        }

        // Record leave event
        const userName = currentUser.uid;
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "leave",
          userId: currentUser.uid,
          userName: userName,
          message: `${userName} has left the box`,
          timestamp: new Date().toISOString(),
        });
      }

      // Remove from local array
      const index = this.groupBoxes.findIndex(
        (gb) => gb.groupBoxId === groupBoxId
      );
      if (index >= 0) {
        this.groupBoxes.splice(index, 1);
      }

      await this.save();
      return { success: true, groupBoxName };
    } catch (error) {
      console.error("Error deleting group box:", error);
      return { success: false, errors: [error.message] };
    }
  }

  async toggleGroupBoxFavorite(groupBoxId) {
    try {
      const groupBox = this.getGroupBox(groupBoxId);
      if (!groupBox) {
        return { success: false };
      }

      groupBox.favorite = !groupBox.favorite;
      groupBox.updatedAt = new Date().toISOString();

      // Update in Firebase if we have a reference
      if (this.firebase.isReady && groupBox.id) {
        const currentUser = this.firebase.getCurrentUser();
        if (currentUser) {
          const { updateDoc, doc } = window.firebaseFunctions;
          await updateDoc(
            doc(
              this.firebase.db,
              "users",
              currentUser.uid,
              "participated_group_boxes",
              groupBox.id
            ),
            { favorite: groupBox.favorite }
          );
        }
      }

      await this.save();
      return { success: true };
    } catch (error) {
      console.error("Error toggling group box favorite:", error);
      return { success: false };
    }
  }

  generateGroupBoxShareUrl(groupBoxId) {
    try {
      const groupBox = this.getGroupBox(groupBoxId);
      if (!groupBox) {
        return { success: false };
      }

      const url = `${window.location.origin}${window.location.pathname}?groupbox=${groupBoxId}`;
      return { success: true, url, groupBoxName: groupBox.groupBoxName };
    } catch (error) {
      console.error("Error generating group box share URL:", error);
      return { success: false };
    }
  }

  async save() {
    try {
      const data = this.groupBoxes.map((gb) => gb.toObject());
      this.storage.saveGroupBoxes(data);
    } catch (error) {
      console.error("Error saving group boxes:", error);
    }
  }
}

export default GroupBoxController;

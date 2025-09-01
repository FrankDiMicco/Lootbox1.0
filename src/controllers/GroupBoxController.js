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
    // return unique, non-left boxes by groupBoxId
    const seen = new Set();
    return this.groupBoxes.filter((gb) => {
      if (gb.hasLeft) return false;
      if (!gb.groupBoxId) return false;
      if (seen.has(gb.groupBoxId)) return false;
      seen.add(gb.groupBoxId);
      return true;
    });
  }

  getGroupBoxIncludingLeft(groupBoxId) {
    // This method can find group boxes even if user has left them
    return this.groupBoxes.find((gb) => gb.groupBoxId === groupBoxId) || null;
  }

  getGroupBox(groupBoxId) {
    // For normal operations, only return non-left group boxes
    return (
      this.groupBoxes.find(
        (gb) => gb.groupBoxId === groupBoxId && !gb.hasLeft
      ) || null
    );
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
        const { setDoc, doc } = window.firebaseFunctions;

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
        console.log(
          "Trying to write to:",
          `users/${currentUser.uid}/participated_group_boxes/${groupBoxId}`
        );
        console.log("Current user:", currentUser.uid);
        console.log("About to setDoc with:");
        console.log("  User ID:", currentUser.uid);
        console.log("  Group Box ID:", groupBoxId);
        console.log(
          "  Path:",
          `users/${currentUser.uid}/participated_group_boxes/${groupBoxId}`
        );
        console.log("  Data:", participantData);

        await setDoc(
          doc(
            this.firebase.db,
            "users",
            currentUser.uid,
            "participated_group_boxes",
            groupBoxId
          ),
          participantData,
          { merge: true }
        );

        // Update the local group box with the document ID
        groupBox.id = groupBoxId;
        this.groupBoxes[this.groupBoxes.length - 1].id = groupBoxId;
        const index = this.groupBoxes.findIndex(
          (gb) => gb.groupBoxId === groupBoxId
        );
        if (index >= 0) {
          this.groupBoxes[index].id = groupBoxId;
        }
        // Record join event for creator
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "join",
          userId: currentUser.uid,
          userName: currentUser.uid,
          message: `${(currentUser.displayName || currentUser.uid).substring(
            0,
            5
          )} joined the box`,
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
      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      // First, check if we already have this group box in memory
      let existing = this.groupBoxes.find((gb) => gb.groupBoxId === groupBoxId);

      // Check Firebase for existing participation record
      const { collection, query, where, getDocs, updateDoc, doc, setDoc } =
        window.firebaseFunctions;
      const participationQuery = query(
        collection(
          this.firebase.db,
          "users",
          currentUser.uid,
          "participated_group_boxes"
        ),
        where("groupBoxId", "==", groupBoxId)
      );
      const participationSnapshot = await getDocs(participationQuery);

      if (!participationSnapshot.empty) {
        // User has participated before - update existing record
        const existingDoc = participationSnapshot.docs[0];
        const existingData = existingDoc.data();
        const wasLeft = existingData.hasLeft === true;

        // Update the participation record to mark as active
        await updateDoc(existingDoc.ref, {
          hasLeft: false,
          rejoinedAt: new Date().toISOString(),
        });

        // Load fresh group box data
        const groupBoxData = await this.firebase.loadGroupBox(groupBoxId);
        if (!groupBoxData) {
          return { success: false, errors: ["Group box not found"] };
        }

        // Create/update local GroupBox instance
        const groupBox = new GroupBox({
          id: existingDoc.id,
          ...existingData,
          ...groupBoxData,
          groupBoxId: groupBoxId,
          hasLeft: false,
          isGroupBox: true,
          userTotalOpens: existingData.userTotalOpens || 0,
          userRemainingTries: existingData.userRemainingTries,
        });

        if (existing) {
          // Update existing in array
          const index = this.groupBoxes.findIndex(
            (gb) => gb.groupBoxId === groupBoxId
          );
          if (index >= 0) {
            this.groupBoxes[index] = groupBox;
          }
        } else {
          // Add to array
          this.groupBoxes.push(groupBox);
        }

        // Record rejoin event
        if (wasLeft) {
          await this.firebase.addSessionHistoryEvent(groupBoxId, {
            type: "join",
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.uid,
            message: `${
              currentUser.displayName || currentUser.uid
            } joined the box`,
            timestamp: new Date().toISOString(),
          });
        }

        await this.save();
        return { success: true, alreadyJoined: true, groupBox };
      }

      // New participant - create new record
      const groupBoxData = await this.firebase.loadGroupBox(groupBoxId);
      if (!groupBoxData) {
        return { success: false, errors: ["Group box not found"] };
      }

      // Check if expired
      if (
        groupBoxData.expiresAt &&
        new Date(groupBoxData.expiresAt) <= new Date()
      ) {
        return { success: false, errors: ["This group box has expired"] };
      }

      // Add to participants array
      const newParticipant = {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.uid,
        userTotalOpens: 0,
        userRemainingTries: groupBoxData.settings?.triesPerPerson || 3,
        joinedAt: new Date().toISOString(),
      };

      await this.firebase.updateGroupBoxParticipant(groupBoxId, newParticipant);

      // Create participation record
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
        hasLeft: false,
        favorite: false,
      };

      await setDoc(
        doc(
          this.firebase.db,
          "users",
          currentUser.uid,
          "participated_group_boxes",
          groupBoxId // <- fixed, deterministic id
        ),
        participantData,
        { merge: true }
      );

      participantData.id = groupBoxId; // keep local id fixed

      // add or replace in memory (no duplicates)
      const existingIndex = this.groupBoxes.findIndex(
        (gb) => gb.groupBoxId === groupBoxId
      );
      const groupBox = new GroupBox(participantData);
      if (existingIndex >= 0) {
        this.groupBoxes[existingIndex] = groupBox;
      } else {
        this.groupBoxes.push(groupBox);
      }
      await this.save();

      // Record join event
      await this.firebase.addSessionHistoryEvent(groupBoxId, {
        type: "join",
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.uid,
        message: `${currentUser.displayName || currentUser.uid} joined the box`,
        timestamp: new Date().toISOString(),
      });

      return { success: true, alreadyJoined: false, groupBox };
    } catch (error) {
      console.error("Error joining group box:", error);
      return { success: false, errors: [error.message] };
    }
  }
  async adjustUserTries(groupBoxId, userId, delta) {
    try {
      if (!this.firebase.isReady) {
        return { success: false, error: "Firebase not available" };
      }

      const { getDoc, updateDoc, setDoc, doc } = window.firebaseFunctions;

      // Load the group box
      const gbRef = doc(this.firebase.db, "group_boxes", groupBoxId);
      const gbSnap = await getDoc(gbRef);
      if (!gbSnap.exists())
        return { success: false, error: "Group box not found" };

      const gbData = gbSnap.data();
      const participants = Array.isArray(gbData.participants)
        ? [...gbData.participants]
        : [];

      // Find participant
      const i = participants.findIndex((p) => p.userId === userId);
      if (i === -1) return { success: false, error: "Participant not found" };

      // Compute new tries
      const current = Number(participants[i].userRemainingTries || 0);
      const next = Math.max(0, current + (Number(delta) || 0));

      // Update participant in the shared array
      participants[i] = {
        ...participants[i],
        userRemainingTries: next,
      };

      console.log(
        "About to update main group_boxes document with new participants array"
      );
      console.log("Participant before:", gbData.participants[i]);
      console.log("Participant after:", participants[i]);

      try {
        await updateDoc(gbRef, {
          participants,
          updatedAt: new Date().toISOString(),
        });
        console.log(
          "SUCCESS: Main group_boxes document updated. New tries:",
          next
        );
        // If this is for another user (not the organizer), trigger a refresh for them
        const me = this.firebase.getCurrentUser();
        if (me && me.uid !== userId) {
          // Add a "refresh" event to session history that participants can listen for
          await this.firebase.addSessionHistoryEvent(groupBoxId, {
            type: "refresh_tries",
            userId: userId,
            message: `Refresh tries for ${userId}`,
            timestamp: new Date().toISOString(),
          });
        }
        // IMMEDIATELY verify the update worked
        const verifySnap = await getDoc(gbRef);
        const verifyData = verifySnap.data();
        const verifyParticipant = verifyData.participants.find(
          (p) => p.userId === userId
        );
        console.log(
          "VERIFY: After update, Firebase shows tries:",
          verifyParticipant?.userRemainingTries
        );
        if (verifyParticipant?.userRemainingTries !== next) {
          console.error("UPDATE FAILED! Firebase still shows old value!");
        }
      } catch (error) {
        console.error("FAILED to update main group_boxes document:", error);
        console.error(
          "This is the REAL problem - participants array not updating"
        );
        return { success: false, error: error.message };
      }
      // Try to update participant's personal record - use setDoc with merge instead
      try {
        const participantRef = doc(
          this.firebase.db,
          "users",
          userId,
          "participated_group_boxes",
          groupBoxId
        );

        // Use setDoc with merge:true to create if doesn't exist
        await setDoc(
          participantRef,
          {
            userRemainingTries: next,
            updatedAt: new Date().toISOString(),
            groupBoxId: groupBoxId, // ensure this field exists
          },
          { merge: true }
        );

        console.log(`Updated participant ${userId} tries to ${next}`);
      } catch (partError) {
        // Log but don't fail - the main record was updated
        console.warn(
          "Could not update participant's personal record:",
          partError
        );
      }

      //log a grant event
      await this.firebase.addSessionHistoryEvent(groupBoxId, {
        type: "grant",
        userId,
        userName: participants[i].userName || userId,
        message: `Organizer granted ${delta > 0 ? "+" : ""}${delta} open(s)`,
      });

      // Update locally if this is the current user in memory
      const me = this.firebase.getCurrentUser();
      if (me && me.uid === userId) {
        const local = this.groupBoxes.find(
          (gb) => gb.groupBoxId === groupBoxId
        );
        if (local) {
          local.userRemainingTries = next;
          await this.save();
        }
      }

      return { success: true, newTries: next };
    } catch (error) {
      console.error("Error adjusting user tries:", error);
      return { success: false, error: error.message };
    }
  }

  async spinGroupBox(groupBoxId) {
    try {
      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      console.log("SPIN: Starting spin for user", currentUser.uid);

      // FORCE RELOAD FROM FIREBASE TO GET LATEST TRIES
      const freshData = await this.firebase.loadGroupBox(groupBoxId);
      if (!freshData) {
        return { success: false, errors: ["Group box not found in Firebase"] };
      }

      console.log("SPIN: Fresh participants data:", freshData.participants);

      // Find this user's fresh participant data
      const freshParticipant = freshData.participants?.find(
        (p) => p.userId === currentUser.uid
      );

      if (!freshParticipant) {
        console.error("SPIN: User not found in participants!");
        return {
          success: false,
          errors: ["You are not a participant in this group box"],
        };
      }

      console.log(
        "SPIN: User's fresh tries from Firebase:",
        freshParticipant.userRemainingTries
      );

      // Get local group box
      const groupBox = this.getGroupBox(groupBoxId);
      if (!groupBox) {
        return { success: false, errors: ["Group box not found locally"] };
      }

      // UPDATE LOCAL WITH FRESH DATA FROM FIREBASE
      groupBox.userRemainingTries = freshParticipant.userRemainingTries;
      groupBox.userTotalOpens = freshParticipant.userTotalOpens || 0;

      console.log("SPIN: Updated local tries to:", groupBox.userRemainingTries);

      // Check if can spin with FRESH data
      if (
        groupBox.userRemainingTries === 0 ||
        groupBox.userRemainingTries === "0"
      ) {
        return {
          success: false,
          errors: [
            `No remaining tries (you have ${groupBox.userRemainingTries})`,
          ],
        };
      }

      if (!groupBox.canSpin(currentUser.uid)) {
        return {
          success: false,
          errors: ["Cannot spin: no remaining tries or group box expired"],
        };
      }

      // Do the spin
      const result = groupBox.spinForUser(currentUser.uid);

      // Update local stats
      groupBox.userTotalOpens++;
      groupBox.userRemainingTries =
        typeof groupBox.userRemainingTries === "number"
          ? groupBox.userRemainingTries - 1
          : parseInt(groupBox.userRemainingTries) - 1;
      groupBox.lastParticipated = new Date().toISOString();

      console.log("SPIN: After spin, tries left:", groupBox.userRemainingTries);

      const userName = currentUser.displayName || currentUser.uid;

      // Update the main document's participants array
      await this.firebase.updateGroupBoxParticipant(groupBoxId, {
        userId: currentUser.uid,
        userName: userName,
        userTotalOpens: groupBox.userTotalOpens,
        userRemainingTries: groupBox.userRemainingTries,
        joinedAt: groupBox.firstParticipated || new Date().toISOString(),
      });

      // Record spin event
      await this.firebase.addSessionHistoryEvent(groupBoxId, {
        type: "spin",
        userId: currentUser.uid,
        userName: userName,
        item: result.item,
        message: `${userName.substring(0, 5)} opened the box and got "${
          result.item
        }"`,
        timestamp: new Date().toISOString(),
      });

      // Update user's personal record
      if (this.firebase.isReady && groupBox.id) {
        try {
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
        } catch (e) {
          console.warn("Could not update personal record:", e);
        }
      }

      await this.firebase.recordSpin(groupBoxId, result);
      // Update the total spins counter in the main group box document
      try {
        const { updateDoc, doc, increment } = window.firebaseFunctions;
        await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
          totalSpins: increment(1),
        });
      } catch (e) {
        console.warn("Could not update spin counter:", e);
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

          groupBox.hasLeft = true;

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
          message: `${userName.substring(0, 5)} has left the box`,
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

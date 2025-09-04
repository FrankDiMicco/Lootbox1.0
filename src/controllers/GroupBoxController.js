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
            viewed: data.viewed || false,
            lastInteracted: data.lastInteracted || null,
            userRemainingTries:
              data.userRemainingTries !== undefined
                ? data.userRemainingTries
                : data.settings?.triesPerPerson || 3,
            firstParticipated: data.firstParticipated,
            lastParticipated: data.lastParticipated,

            // Group statistics
            totalOpens: data.totalOpens ?? data.totalSpins ?? 0, // legacy name kept
            uniqueUsers: data.uniqueUsers ?? 0,
            totalSpins: data.totalSpins ?? data.totalOpens ?? 0,
            activeUsers: Array.isArray(data.participants)
              ? data.participants.filter((p) => !p?.hasLeft).length
              : typeof data.activeUsers === "number"
              ? data.activeUsers
              : 0,

            // Other properties
            favorite: data.favorite || false,
            expiresIn: data.expiresIn || data.settings?.expiresIn || "never",
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
    // Clean up the array first - remove any duplicates or invalid entries
    const validBoxes = [];
    const seenIds = new Set();

    for (const gb of this.groupBoxes) {
      // Skip if user has left
      if (gb.hasLeft === true) {
        console.log("Skipping left box:", gb.groupBoxId);
        continue;
      }

      // Skip if no groupBoxId
      if (!gb.groupBoxId) {
        console.log("Skipping box with no ID");
        continue;
      }

      // Skip duplicates
      if (seenIds.has(gb.groupBoxId)) {
        console.log("Skipping duplicate:", gb.groupBoxId);
        continue;
      }

      seenIds.add(gb.groupBoxId);
      validBoxes.push(gb);
    }

    // Update the internal array to remove any cleaned items
    if (validBoxes.length !== this.groupBoxes.length) {
      console.log(
        "Cleaning group boxes array from",
        this.groupBoxes.length,
        "to",
        validBoxes.length
      );
      this.groupBoxes = validBoxes;
    }

    return validBoxes;
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

      // Build participants array with creator if they're participating
      const participants = [];
      if (settings.creatorParticipates) {
        participants.push({
          userId: currentUser.uid,
          userName: currentUser.displayName || "Anonymous",
          userTotalOpens: 0,
          userRemainingTries: settings.unlimitedGroupTries
            ? "unlimited"
            : settings.triesPerPerson,
          joinedAt: new Date().toISOString(),
        });
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
        participants: participants, // Use the array we built above
        settings: {
          triesPerPerson: settings.unlimitedGroupTries
            ? "unlimited"
            : settings.triesPerPerson,
          hideContents: settings.hideContents,
          hideOdds: settings.hideOdds,
          creatorParticipates: settings.creatorParticipates,
          expiresIn: settings.expiresIn,
        },
        totalOpens: 0,
        uniqueUsers: settings.creatorParticipates ? 1 : 0,
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
      console.log(
        "About to save group box with participants:",
        groupBoxData.participants
      );
      console.log(
        "Full groupBoxData being saved:",
        JSON.stringify(groupBoxData, null, 2)
      );
      const groupBoxId = await this.firebase.saveGroupBox(groupBoxData);
      if (!groupBoxId) {
        throw new Error("Failed to create group box ID");
      }

      const groupBox = new GroupBox({
        ...groupBoxData,
        id: groupBoxId,
        groupBoxId: groupBoxId,
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

      // If creator participates, also create their personal participation record
      if (settings.creatorParticipates) {
        const { setDoc, doc } = window.firebaseFunctions;

        const participantData = {
          groupBoxId,
          groupBoxName: lootboxData.name,
          lootboxData: groupBoxData.lootboxData,
          settings: groupBoxData.settings,
          expiresAt: groupBoxData.expiresAt || null,
          expiresIn: settings.expiresIn || "never",
          createdBy: currentUser.uid,
          creatorName: currentUser.displayName || "Anonymous",
          totalOpens: 0,
          uniqueUsers: 1,
          firstParticipated: new Date().toISOString(),
          userTotalOpens: 0,
          userRemainingTries: settings.unlimitedGroupTries
            ? "unlimited"
            : settings.triesPerPerson,
          isCreator: true,
          isOrganizerOnly: false,
          favorite: false,
        };

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

        // Record join event for creator
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "join",
          userId: currentUser.uid, // ensure present
          userName: currentUser.displayName || "", // let renderer mask if empty
          // message ignored for join/leave in FirebaseService
        });
      }

      return { success: true, groupBoxId, groupBox };
    } catch (error) {
      console.error("Error creating group box:", error);
      return { success: false, errors: [error.message] };
    }
  }

  // Replace the joinGroupBox method in GroupBoxController.js with this fixed version:

  // Simplified fix for uniqueUsers counter - only handling real scenarios

  // In GroupBoxController.js - Fix joinGroupBox to properly handle uniqueUsers

  async joinGroupBox(groupBoxId) {
    try {
      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      // Check Firebase for existing participation record
      const {
        collection,
        query,
        where,
        getDocs,
        updateDoc,
        doc,
        setDoc,
        increment,
      } = window.firebaseFunctions;
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
        // User has participated before - they're REJOINING after leaving
        const existingDoc = participationSnapshot.docs[0];
        const existingData = existingDoc.data();

        // Update the participation record to mark as active
        await updateDoc(existingDoc.ref, {
          hasLeft: false,
          rejoinedAt: new Date().toISOString(),
        });

        // INCREMENT uniqueUsers since they're rejoining (they were decremented when they left)
        await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
          uniqueUsers: increment(1),
          updatedAt: new Date().toISOString(),
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

        // Add to local array (it won't be there since they left)
        this.groupBoxes.push(groupBox);

        // Record rejoin event
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "join",
          userId: currentUser.uid,
          userName: currentUser.displayName || "",
        });

        await this.save();
        return { success: true, alreadyJoined: true, groupBox };
      }

      // NEW PARTICIPANT - first time joining
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

      // ADD THIS DEBUG CODE:
      console.log("=== PARTICIPANT ADD DEBUG ===");
      console.log("Time:", new Date().toISOString());
      console.log("Added participant:", newParticipant);
      
      // Start checking when the participant appears in Firebase
      let checkCount = 0;
      const maxChecks = 20; // Check for up to 20 seconds
      const checkInterval = setInterval(async () => {
        checkCount++;
        
        // Force fresh read (bypass cache)
        if (this.firebase.docCache) {
          this.firebase.docCache.delete(groupBoxId);
        }
        
        const checkData = await this.firebase.loadGroupBox(groupBoxId);
        const foundParticipant = checkData?.participants?.find(
          p => p.userId === currentUser.uid
        );
        
        console.log(`Check #${checkCount}:`, {
          found: !!foundParticipant,
          totalParticipants: checkData?.participants?.length || 0,
          participant: foundParticipant || "NOT FOUND"
        });
        
        if (foundParticipant || checkCount >= maxChecks) {
          clearInterval(checkInterval);
          if (foundParticipant) {
            console.log(`✓ Participant appeared after ${checkCount} checks`);
          } else {
            console.log(`✗ Participant NOT found after ${checkCount} checks`);
          }
          console.log("=== END DEBUG ===");
        }
      }, 1000); // Check every second

      // INCREMENT uniqueUsers for brand new participant
      await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
        uniqueUsers: increment(1),
        updatedAt: new Date().toISOString(),
      });

      // Create participation record
      const participantData = {
        groupBoxId,
        groupBoxName: groupBoxData.lootboxData?.name || "Unnamed Group Box",
        lootboxData: groupBoxData.lootboxData,
        settings: groupBoxData.settings,
        expiresAt: groupBoxData.expiresAt || null,
        createdBy: groupBoxData.createdBy,
        creatorName: groupBoxData.creatorName,
        totalOpens: groupBoxData.totalOpens || 0,
        uniqueUsers: (groupBoxData.uniqueUsers || 0) + 1,
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
          groupBoxId
        ),
        participantData,
        { merge: true }
      );

      participantData.id = groupBoxId;
      const groupBox = new GroupBox(participantData);
      this.groupBoxes.push(groupBox);

      await this.save();

      // Record join event
      await this.firebase.addSessionHistoryEvent(groupBoxId, {
        type: "join",
        userId: currentUser.uid,
        userName: currentUser.displayName || "",
      });

      return { success: true, alreadyJoined: false, groupBox };
    } catch (error) {
      console.error("Error joining group box:", error);
      return { success: false, errors: [error.message] };
    }
  }

  // In GroupBoxController.js - Fix deleteGroupBox to properly decrement uniqueUsers

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

      const groupBoxName = groupBox.groupBoxName;

      // User is leaving (they can only leave once - box disappears from their view)
      if (
        !deleteForEveryone ||
        (groupBox.isCreator && !groupBox.isOrganizerOnly)
      ) {
        // Mark as left in their participation record
        if (groupBox.id) {
          const { updateDoc, doc, increment } = window.firebaseFunctions;

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
              userRemainingTries: groupBox.userRemainingTries,
              userTotalOpens: groupBox.userTotalOpens,
            }
          );

          // DECREMENT uniqueUsers since they're leaving
          await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
            uniqueUsers: increment(-1),
            updatedAt: new Date().toISOString(),
          });
        }

        // Record leave event
        const userName = currentUser.displayName || currentUser.uid;
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "leave",
          userId: currentUser.uid,
          userName: userName,
          message: `${userName.substring(0, 5)} has left the box`,
          timestamp: new Date().toISOString(),
        });
      } else if (
        deleteForEveryone &&
        groupBox.isCreator &&
        groupBox.isOrganizerOnly
      ) {
        // Creator is deleting for everyone (organizer-only mode)
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
      }

      // Remove from local array (box disappears from their view)
      const index = this.groupBoxes.findIndex(
        (gb) => gb.groupBoxId === groupBoxId
      );
      if (index >= 0) {
        this.groupBoxes.splice(index, 1);
      }

      await this.save();
      this.getAllGroupBoxes(); // Cleanup

      return { success: true, groupBoxName };
    } catch (error) {
      console.error("Error deleting group box:", error);
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

  // In GroupBoxController.js - Replace the existing spinGroupBox method with this:

  async spinGroupBox(groupBoxId) {
    try {
      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        return { success: false, errors: ["User not authenticated"] };
      }

      console.log("=== SPIN DEBUG ===");
      console.log("Spin attempt at:", new Date().toISOString());
      console.log("User ID:", currentUser.uid);
      console.log("GroupBox ID:", groupBoxId);

      // Add retry logic for loading fresh data
      let freshData = null;
      let participantFound = false;
      let retries = 0;
      const maxRetries = 3;

      while (!participantFound && retries < maxRetries) {
        // Force fresh read
        if (this.firebase.docCache) {
          console.log("Clearing cache for fresh read");
          this.firebase.docCache.delete(groupBoxId);
        }

        freshData = await this.firebase.loadGroupBox(groupBoxId);

        if (!freshData) {
          console.log("ERROR: Group box not found");
          return { success: false, errors: ["Group box not found"] };
        }

        console.log("Participants in group box:", freshData.participants?.length || 0);
        console.log("Looking for user:", currentUser.uid);
        
        // List all participant IDs
        if (freshData.participants) {
          console.log("All participant IDs in group box:");
          freshData.participants.forEach((p, index) => {
            console.log(`  [${index}] ${p.userId} - ${p.userName}`);
          });
        } else {
          console.log("No participants array found!");
        }

        // Check if participant exists in the data
        const participant = freshData.participants?.find(
          (p) => p.userId === currentUser.uid
        );

        if (participant) {
          participantFound = true;
          console.log("✓ Participant FOUND:", participant);
        } else {
          retries++;
          if (retries < maxRetries) {
            console.log(
              `✗ Participant NOT found, retrying... (attempt ${
                retries + 1
              }/${maxRetries})`
            );
            // Wait a bit before retrying to allow Firebase to propagate
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            console.log("✗ Participant NOT found after all retries");
          }
        }
      }

      if (!participantFound) {
        return {
          success: false,
          errors: ["You are not a participant in this group box"],
        };
      }

      // Check expiration
      if (freshData.expiresAt && new Date(freshData.expiresAt) <= new Date()) {
        return { success: false, errors: ["This group box has expired"] };
      }

      // Find participant data
      const participantIndex = freshData.participants?.findIndex(
        (p) => p.userId === currentUser.uid
      );

      if (participantIndex === -1) {
        return { success: false, errors: ["You are not a participant"] };
      }

      const participant = freshData.participants[participantIndex];

      // Check tries BEFORE spinning
      if (
        participant.userRemainingTries <= 0 &&
        participant.userRemainingTries !== "unlimited"
      ) {
        return { success: false, errors: ["No remaining tries"] };
      }

      // STEP 2: Calculate the spin result
      const items = freshData.lootboxData?.items || [];
      if (items.length === 0) {
        return { success: false, errors: ["No items in group box"] };
      }

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

      if (!selectedItem) selectedItem = items[0];

      // STEP 3: Update Firebase FIRST with the new tries count
      const newTries =
        participant.userRemainingTries === "unlimited"
          ? "unlimited"
          : participant.userRemainingTries - 1;

      const newOpens = (participant.userTotalOpens || 0) + 1;

      // Update participants array
      const updatedParticipants = [...freshData.participants];
      updatedParticipants[participantIndex] = {
        ...participant,
        userRemainingTries: newTries,
        userTotalOpens: newOpens,
        lastOpen: new Date().toISOString(),
      };

      // CRITICAL: Update Firebase and wait for confirmation
      const { updateDoc, doc, increment } = window.firebaseFunctions;

      // Update the main document
      await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
        participants: updatedParticipants,
        totalSpins: increment(1),
        updatedAt: new Date().toISOString(),
      });

      // STEP 4: Update user's personal record (best effort, non-blocking)
      const updatePersonalRecord = async () => {
        try {
          const { setDoc } = window.firebaseFunctions;
          await setDoc(
            doc(
              this.firebase.db,
              "users",
              currentUser.uid,
              "participated_group_boxes",
              groupBoxId
            ),
            {
              userRemainingTries: newTries,
              userTotalOpens: newOpens,
              lastParticipated: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Could not update personal record:", e);
        }
      };

      // STEP 5: Record the spin event
      const recordSpinEvent = async () => {
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "spin",
          userId: currentUser.uid,
          userName: currentUser.displayName || "User",
          item: selectedItem.name,
          message: `${(currentUser.displayName || "User").substring(
            0,
            5
          )} got "${selectedItem.name}"`,
          timestamp: new Date().toISOString(),
        });
      };

      // STEP 6: Update local state ONLY after Firebase confirms
      const groupBox = this.getGroupBox(groupBoxId);
      if (groupBox) {
        groupBox.userRemainingTries = newTries;
        groupBox.userTotalOpens = newOpens;
        groupBox.lastParticipated = new Date().toISOString();

        // Save to local storage
        await this.save();
      }

      // STEP 7: Force UI update with the confirmed values
      if (typeof window.app !== "undefined" && window.app.state) {
        // Update the current lootbox in app state
        if (
          window.app.state.currentLootbox &&
          window.app.state.currentLootbox.groupBoxId === groupBoxId
        ) {
          window.app.state.currentLootbox.userRemainingTries = newTries;
          window.app.state.currentLootbox.userTotalOpens = newOpens;

          // Force UI refresh
          const triesEl = document.getElementById("triesInfo");
          if (triesEl) {
            triesEl.textContent =
              newTries === "unlimited"
                ? "Tries remaining: unlimited"
                : `Tries remaining: ${newTries}`;
          }

          // Update interactivity
          if (window.app.controllers?.ui) {
            window.app.controllers.ui.updateLootboxInteractivity();
          }
        }
      }

      // Execute non-blocking updates in parallel
      Promise.all([updatePersonalRecord(), recordSpinEvent()]).catch((e) =>
        console.warn("Non-critical update failed:", e)
      );

      return {
        success: true,
        result: {
          item: selectedItem.name,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Error spinning group box:", error);

      if (error.code === "permission-denied") {
        return { success: false, errors: ["This group box has expired"] };
      }

      return { success: false, errors: [error.message] };
    }
  }

  // Also in App.js - Replace the handleSpinLootbox method with this cleaner version:

  // In GroupBoxController.js - Replace the Firebase update section in spinGroupBox:

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

      // Check if expired
      if (freshData.expiresAt && new Date(freshData.expiresAt) <= new Date()) {
        console.log("Group box has expired");
        return {
          success: false,
          errors: ["This group box has expired - viewing only"],
        };
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
        "BEFORE SPIN - Participant tries:",
        freshParticipant.userRemainingTries
      );

      // Get local group box
      const groupBox = this.getGroupBox(groupBoxId);
      if (!groupBox) {
        return { success: false, errors: ["Group box not found locally"] };
      }

      console.log(
        "LOCAL GroupBox before update - tries:",
        groupBox.userRemainingTries
      );
      console.log(
        "LOCAL GroupBox before update - opens:",
        groupBox.userTotalOpens
      );

      // UPDATE LOCAL WITH FRESH DATA FROM FIREBASE
      groupBox.userRemainingTries = freshParticipant.userRemainingTries;
      groupBox.userTotalOpens = freshParticipant.userTotalOpens || 0;

      console.log("SPIN: Updated local tries to:", groupBox.userRemainingTries);

      // Debug: Check if canSpin method exists and works
      console.log(
        "Can spin check:",
        groupBox.canSpin
          ? groupBox.canSpin(currentUser.uid)
          : "canSpin method missing"
      );
      console.log("GroupBox object keys:", Object.keys(groupBox));
      console.log("GroupBox prototype:", Object.getPrototypeOf(groupBox));

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
      console.log("About to call spinForUser...");
      console.log("Does spinForUser exist?", typeof groupBox.spinForUser);

      let result;
      try {
        result = groupBox.spinForUser(currentUser.uid);
        console.log("spinForUser returned:", result);
      } catch (spinError) {
        console.error("spinForUser threw error:", spinError);
        console.error("Error stack:", spinError.stack);

        // Fallback: do the spin manually here
        console.log("Attempting manual spin...");
        const items = freshData.lootboxData?.items || [];
        if (items.length === 0) {
          return { success: false, errors: ["No items in group box"] };
        }

        const totalOdds = items.reduce(
          (sum, item) => sum + (item.odds || 0),
          0
        );
        let random = Math.random() * totalOdds;
        let selectedItem = null;

        for (const item of items) {
          random -= item.odds || 0;
          if (random <= 0) {
            selectedItem = item;
            break;
          }
        }

        if (!selectedItem) selectedItem = items[0];

        result = {
          item: selectedItem.name,
          timestamp: new Date().toISOString(),
          userId: currentUser.uid,
        };
        console.log("Manual spin result:", result);
      }

      // Calculate new values
      const newTries =
        typeof freshParticipant.userRemainingTries === "number"
          ? freshParticipant.userRemainingTries - 1
          : parseInt(freshParticipant.userRemainingTries) - 1;

      const newOpens = (freshParticipant.userTotalOpens || 0) + 1;

      // Create updated participants array
      const updatedParticipants = freshData.participants.map((p) => {
        if (p.userId === currentUser.uid) {
          return {
            ...p,
            userRemainingTries: newTries,
            userTotalOpens: newOpens,
            lastOpen: new Date().toISOString(),
          };
        }
        return p;
      });

      console.log("AFTER SPIN - New tries:", newTries);
      console.log(
        "Updated participants array:",
        JSON.stringify(updatedParticipants, null, 2)
      );

      // Log the exact update we're about to send
      console.log("=== FIREBASE UPDATE ATTEMPT ===");
      console.log("Document ID:", groupBoxId);
      console.log("New tries value:", newTries, "Type:", typeof newTries);
      console.log("New opens value:", newOpens, "Type:", typeof newOpens);

      // Update Firebase with better error handling
      const { updateDoc, doc, increment, getDoc } = window.firebaseFunctions;

      try {
        // First, let's verify the document exists and is writable
        const groupBoxRef = doc(this.firebase.db, "group_boxes", groupBoxId);
        const beforeUpdate = await getDoc(groupBoxRef);
        console.log("Document exists before update?", beforeUpdate.exists());
        console.log(
          "Current participants in Firebase:",
          beforeUpdate.data()?.participants
        );

        console.log("Attempting to update document:", groupBoxId);
        console.log(
          "Sending participants array with",
          updatedParticipants.length,
          "participants"
        );
        console.log(
          "Your updated participant data:",
          updatedParticipants.find((p) => p.userId === currentUser.uid)
        );

        // Try the update with just participants first
        const updateData = {
          participants: updatedParticipants,
          updatedAt: new Date().toISOString(),
        };

        console.log("Sending update:", JSON.stringify(updateData, null, 2));

        await updateDoc(groupBoxRef, updateData);

        console.log("Participants update completed successfully");

        // Clear the cache for this group box so verification gets fresh data
        this.firebase.docCache.delete(groupBoxId);

        // Immediately verify the update worked
        const afterUpdate = await getDoc(groupBoxRef);
        const updatedParticipant = afterUpdate
          .data()
          ?.participants?.find((p) => p.userId === currentUser.uid);
        console.log(
          "IMMEDIATE VERIFY - Tries after update:",
          updatedParticipant?.userRemainingTries
        );

        if (updatedParticipant?.userRemainingTries !== newTries) {
          console.error(
            "UPDATE NOT SAVED! Expected",
            newTries,
            "but Firebase has",
            updatedParticipant?.userRemainingTries
          );
        } else {
          console.log("SUCCESS - Update was saved correctly!");
        }

        // Now try updating totalSpins separately
        try {
          await updateDoc(groupBoxRef, {
            totalSpins: increment(1),
          });
          console.log("TotalSpins increment completed");
        } catch (spinError) {
          console.error("Failed to increment totalSpins:", spinError);
        }
      } catch (updateError) {
        console.error("Firebase update FAILED:", updateError);
        console.error("Error details:", {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
        });

        // Try an alternative update method
        console.log("Trying alternative update method...");

        try {
          // Try using setDoc with merge instead
          const { setDoc } = window.firebaseFunctions;
          await setDoc(
            doc(this.firebase.db, "group_boxes", groupBoxId),
            {
              participants: updatedParticipants,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          console.log("Alternative update (setDoc) succeeded!");
        } catch (altError) {
          console.error("Alternative update also failed:", altError);
          return { success: false, errors: ["Failed to update tries count"] };
        }
      }

      // Add a delay before verification to ensure write is complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify the update worked
      console.log("Verifying update...");
      const verifyData = await this.firebase.loadGroupBox(groupBoxId);
      const verifyParticipant = verifyData.participants?.find(
        (p) => p.userId === currentUser.uid
      );
      console.log(
        "VERIFY - Full participants array after update:",
        verifyData.participants
      );
      console.log("VERIFY - Your participant data:", verifyParticipant);
      console.log(
        "VERIFY - Your tries after update:",
        verifyParticipant?.userRemainingTries
      );

      if (verifyParticipant?.userRemainingTries !== newTries) {
        console.error("WARNING: Firebase didn't save the new tries count!");
        console.error(
          "Expected:",
          newTries,
          "but got:",
          verifyParticipant?.userRemainingTries
        );

        // One more attempt with a different approach
        console.log("Attempting direct participant update...");

        // Try updating just this participant
        const updatedParticipantData = {
          userId: currentUser.uid,
          userName: freshParticipant.userName || "Anonymous",
          userRemainingTries: newTries,
          userTotalOpens: newOpens,
          joinedAt: freshParticipant.joinedAt || new Date().toISOString(),
          lastOpen: new Date().toISOString(),
        };

        // Build new array with just the updated participant
        const finalParticipants = freshData.participants.map((p) =>
          p.userId === currentUser.uid ? updatedParticipantData : p
        );

        console.log(
          "Final attempt with clean participant object:",
          updatedParticipantData
        );

        try {
          await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
            participants: finalParticipants,
          });

          // Verify again
          const finalVerify = await this.firebase.loadGroupBox(groupBoxId);
          const finalParticipant = finalVerify.participants?.find(
            (p) => p.userId === currentUser.uid
          );
          console.log(
            "FINAL VERIFY - Tries:",
            finalParticipant?.userRemainingTries
          );

          if (finalParticipant?.userRemainingTries === newTries) {
            console.log("SUCCESS! Final attempt worked!");
          }
        } catch (finalError) {
          console.error("Final attempt failed:", finalError);
        }
      }

      // Update local stats
      groupBox.userTotalOpens = newOpens;
      groupBox.userRemainingTries = newTries;
      groupBox.lastParticipated = new Date().toISOString();

      const userName = currentUser.displayName || currentUser.uid;

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
          const { updateDoc } = window.firebaseFunctions;
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
      // try {
      //   const { updateDoc, doc, increment } = window.firebaseFunctions;
      //   await updateDoc(doc(this.firebase.db, "group_boxes", groupBoxId), {
      //     totalSpins: increment(1),
      //   });
      // } catch (e) {
      //   console.warn("Could not update spin counter:", e);
      // }

      await this.save();

      return { success: true, result };
    } catch (error) {
      console.error("Error spinning group box:", error);

      // Check for permission error (expired box)
      if (error.code === "permission-denied") {
        return {
          success: false,
          errors: ["This group box has expired and cannot be opened"],
        };
      }

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
        // Only actually delete from Firebase if creator is organizer-only
        // (didn't participate in their own box)
        if (groupBox.isOrganizerOnly) {
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
          // Creator participated - just hide it like leaving
          // Mark as left in their participation record but don't delete the main box
          if (groupBox.id) {
            console.log(
              "Creator leaving but not deleting group box:",
              groupBox.id
            );
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
                userRemainingTries: groupBox.userRemainingTries,
                userTotalOpens: groupBox.userTotalOpens,
              }
            );
          }

          // Record leave event
          const userName = currentUser.displayName || currentUser.uid;
          await this.firebase.addSessionHistoryEvent(groupBoxId, {
            type: "leave",
            userId: currentUser.uid,
            userName: userName,
            message: `${userName.substring(0, 5)} has left the box`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // User is leaving but NOT deleting for everyone
        // Mark as left in Firebase
        if (groupBox.id) {
          console.log("Marking group box as left in Firebase:", groupBox.id);
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
        }

        // Record leave event
        const userName = currentUser.displayName || currentUser.uid;
        await this.firebase.addSessionHistoryEvent(groupBoxId, {
          type: "leave",
          userId: currentUser.uid,
          userName: userName,
          message: `${userName.substring(0, 5)} has left the box`,
          timestamp: new Date().toISOString(),
        });
      }

      // IMPORTANT: Always remove from local array when user leaves
      console.log(
        "Removing from local array, current length:",
        this.groupBoxes.length
      );
      const index = this.groupBoxes.findIndex(
        (gb) => gb.groupBoxId === groupBoxId
      );
      console.log("Found at index:", index);
      if (index >= 0) {
        this.groupBoxes.splice(index, 1);
      }

      await this.save();

      // Also force a cleanup of the array
      this.getAllGroupBoxes(); // This will clean up any lingering entries

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

  async updateParticipantData(groupBoxId, updates) {
    try {
      if (!this.firebase || !this.firebase.isReady) {
        console.log("Firebase not ready, skipping participant data update");
        return { success: false };
      }

      const currentUser = this.firebase.getCurrentUser();
      if (!currentUser) {
        console.log("No current user, skipping participant data update");
        return { success: false };
      }

      const { setDoc, doc } = window.firebaseFunctions;

      // Update the participant record in Firebase
      await setDoc(
        doc(
          this.firebase.db,
          "users",
          currentUser.uid,
          "participated_group_boxes",
          groupBoxId
        ),
        {
          ...updates,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return { success: true };
    } catch (error) {
      console.error("Error updating participant data:", error);
      return { success: false, error: error.message };
    }
  }
}

export default GroupBoxController;

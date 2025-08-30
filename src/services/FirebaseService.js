import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.isReady = false;
  }

  async initialize() {
    try {
      // Firebase configuration
      const firebaseConfig = {
        apiKey: "AIzaSyDX_7gT2YHIQnJ9Svna0-t-skJ7qNnygWM",
        authDomain: "lootbox-creator.firebaseapp.com",
        projectId: "lootbox-creator",
        storageBucket: "lootbox-creator.firebasestorage.app",
        messagingSenderId: "222437059752",
        appId: "1:222437059752:web:f759d88598023b60c1a69d",
        measurementId: "G-2NQVKW2XP6",
      };

      // Initialize Firebase
      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      // Make Firebase instances globally available for backward compatibility
      window.firebaseAuth = this.auth;
      window.firebaseDb = this.db;
      window.firebaseFunctions = {
        collection,
        addDoc,
        getDocs,
        getDoc,
        query,
        where,
        doc,
        setDoc,
        updateDoc,
        deleteDoc,
        orderBy,
        limit,
        serverTimestamp,
      };

      // Sign in anonymously and perform smoke test
      const userCredential = await signInAnonymously(this.auth);
      const uid = userCredential.user.uid;
      console.log("Signed in anonymously with uid:", uid);

      // Firestore smoke test - write data
      const testData = {
        hello: "world",
        uid: uid,
        timestamp: new Date(),
      };

      const docRef = await addDoc(collection(this.db, "tests"), testData);
      console.log("Document written with ID:", docRef.id);

      // Firestore smoke test - read data back
      const querySnapshot = await getDocs(collection(this.db, "tests"));
      querySnapshot.forEach((doc) => {
        console.log("Read document:", doc.id, "=>", doc.data());
      });

      this.isReady = true;
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      throw error;
    }
  }

  getCurrentUser() {
    return this.auth?.currentUser || null;
  }

  async saveLootbox(lootbox) {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }

    const currentUser = this.getCurrentUser();
    const lootboxWithUid = { ...lootbox, uid: currentUser.uid };

    if (lootbox.id) {
      // Update existing
      delete lootboxWithUid.id; // Remove id from data before saving
      await setDoc(doc(this.db, "lootboxes", lootbox.id), lootboxWithUid);
      console.log("Updated lootbox in Firebase:", lootbox.id);
      return lootbox.id;
    } else {
      // Create new
      const docRef = await addDoc(
        collection(this.db, "lootboxes"),
        lootboxWithUid
      );
      console.log("Created new lootbox in Firebase:", docRef.id);
      return docRef.id;
    }
  }

  async loadLootboxes() {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }

    const currentUser = this.getCurrentUser();
    const q = query(
      collection(this.db, "lootboxes"),
      where("uid", "==", currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    const lootboxes = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Remove the uid field for local use and add document id
      delete data.uid;
      lootboxes.push({ id: doc.id, ...data });
    });

    console.log(`Loaded ${lootboxes.length} lootboxes from Firebase`);
    return lootboxes;
  }

  async deleteLootbox(id) {
    if (!this.isReady) {
      throw new Error("Firebase not ready");
    }

    await deleteDoc(doc(this.db, "lootboxes", id));
    console.log("Deleted lootbox from Firebase:", id);
  }

  async saveGroupBox(data) {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }

    const docRef = await addDoc(collection(this.db, "group_boxes"), data);
    console.log("Created group box in Firebase:", docRef.id);
    return docRef.id;
  }

  async loadGroupBox(id) {
    if (!this.isReady) {
      throw new Error("Firebase not ready");
    }

    const docRef = doc(this.db, "group_boxes", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("Group box not found");
    }
  }

  async recordSpin(lootboxId, result) {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }

    const currentUser = this.getCurrentUser();
    const spinData = {
      userId: currentUser.uid,
      lootboxId: lootboxId,
      result: result,
      timestamp: new Date(),
    };

    const docRef = await addDoc(collection(this.db, "spins"), spinData);
    console.log("Recorded spin in Firebase:", docRef.id);
    return docRef.id;
  }

  async loadParticipatedGroupBoxes() {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }

    const currentUser = this.getCurrentUser();

    // Query 1: Boxes where participants contains my uid
    const participatedRef = collection(
      this.db,
      "users",
      currentUser.uid,
      "participated_group_boxes"
    );
    const participatedSnapshot = await getDocs(participatedRef);
    const participatedBoxes = [];
    const toDelete = []; // Track participation records to delete

    for (const docSnap of participatedSnapshot.docs) {
      const data = docSnap.data();

      // Check if the group box still exists in the main collection
      let groupBoxExists = true;
      try {
        const groupBoxRef = doc(this.db, "group_boxes", data.groupBoxId);
        const groupBoxSnap = await getDoc(groupBoxRef);
        groupBoxExists = groupBoxSnap.exists();
      } catch (error) {
        groupBoxExists = false;
      }

      if (groupBoxExists) {
        // Only add if the group box still exists
        participatedBoxes.push({
          id: docSnap.id,
          ...data,
          isGroupBox: true,
        });
      } else {
        // Group box was deleted, so clean up this participation record
        console.log(
          `Group box ${data.groupBoxId} no longer exists, cleaning up participation record`
        );
        toDelete.push(docSnap.id);
      }
    }

    // Clean up orphaned participation records
    for (const docId of toDelete) {
      try {
        await deleteDoc(
          doc(
            this.db,
            "users",
            currentUser.uid,
            "participated_group_boxes",
            docId
          )
        );
        console.log(`Deleted orphaned participation record: ${docId}`);
      } catch (error) {
        console.error(`Failed to delete orphaned record ${docId}:`, error);
      }
    }

    console.log(`Loaded ${participatedBoxes.length} participated group boxes`);
    if (toDelete.length > 0) {
      console.log(
        `Cleaned up ${toDelete.length} orphaned participation records`
      );
    }

    // Query 2: Boxes where createdBy == my uid AND organizerOnly == true
    const organizerRef = collection(this.db, "group_boxes");
    const organizerQuery = query(
      organizerRef,
      where("createdBy", "==", currentUser.uid),
      where("organizerOnly", "==", true)
    );
    const organizerSnapshot = await getDocs(organizerQuery);
    const organizerBoxes = [];

    organizerSnapshot.forEach((doc) => {
      const data = doc.data();
      organizerBoxes.push({
        id: doc.id,
        groupBoxId: doc.id,
        groupBoxName: data.lootboxData?.name || data.name,
        lootboxData: data.lootboxData,
        settings: data.settings,
        createdBy: data.createdBy,
        creatorName: data.creatorName,
        totalOpens: data.totalOpens || 0,
        uniqueUsers: data.uniqueUsers || 0,
        firstParticipated: data.createdAt,
        lastParticipated: data.createdAt,
        userTotalOpens: 0, // Organizer hasn't opened any
        userRemainingTries: 0, // Organizer has no tries
        isCreator: true,
        isOrganizerOnly: true,
        favorite: false,
        isGroupBox: true,
      });
    });

    console.log(`Loaded ${organizerBoxes.length} organizer-only group boxes`);

    // Merge both result sets, avoiding duplicates
    const allGroupBoxes = [...participatedBoxes];
    organizerBoxes.forEach((organizerBox) => {
      // Check if this box is already in participated boxes
      const existingIndex = allGroupBoxes.findIndex(
        (pb) => pb.groupBoxId === organizerBox.groupBoxId
      );
      if (existingIndex === -1) {
        allGroupBoxes.push(organizerBox);
      } else {
        // Update existing entry to ensure it has organizer flags
        allGroupBoxes[existingIndex] = {
          ...allGroupBoxes[existingIndex],
          ...organizerBox,
        };
      }
    });

    console.log(`Total merged group boxes: ${allGroupBoxes.length}`);
    return allGroupBoxes;
  }
  async loadChestManifest() {
    if (!this.isReady) {
      throw new Error("Firebase not ready");
    }

    try {
      // Query the 'chests' collection, ordered by sortOrder
      const chestsRef = collection(this.db, "chests");
      const q = query(chestsRef, orderBy("sortOrder", "asc"));
      const querySnapshot = await getDocs(q);

      const chests = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Transform Firestore data to match existing structure and strip extra quotes
        chests.push({
          file: data.fileName.replace(/"/g, ""),
          name: data.name.replace(/"/g, ""),
          description: data.description.replace(/"/g, ""),
          tier: data.tier,
          sortOrder: data.sortOrder,
        });
      });

      console.log(`Loaded ${chests.length} chests from Firestore`);
      return chests;
    } catch (error) {
      console.error("Failed to load chests from Firestore:", error);

      // Hardcoded fallback: use default chest list
      console.log("Using hardcoded chest fallback");
      return [
        {
          file: "chest.png",
          name: "Default Chest",
          description: "Classic treasure chest",
        },
        {
          file: "metal.png",
          name: "Metal Chest",
          description: "Sturdy metal chest",
        },
        {
          file: "skull_bone.png",
          name: "Skull Chest",
          description: "Spooky bone chest",
        },
        {
          file: "wood_flower.png",
          name: "Flower Chest",
          description: "Wooden chest with flowers",
        },
        {
          file: "kid_happy.png",
          name: "Happy Kid Chest",
          description: "Cheerful kid-themed chest",
        },
        {
          file: "fruit_wood.png",
          name: "Fruity Chest",
          description: "Chest with fruit",
        },
        {
          file: "weapon_wood.png",
          name: "Weapon Chest",
          description: "Wooden chest with weapons",
        },
        {
          file: "orb_chest.png",
          name: "Orb Chest",
          description: "Chest with orbs",
        },
      ];
    }
  }

  // Shared session history methods for group boxes
  async addSessionHistoryEvent(groupBoxId, eventData) {
    if (!this.isReady) {
      console.warn("Firebase not ready, cannot add session history event");
      return false;
    }

    try {
      const { collection, addDoc, serverTimestamp } = window.firebaseFunctions;

      // Ensure all required fields are present
      const eventRecord = {
        type: eventData.type || "unknown",
        userId: eventData.userId || this.getCurrentUser()?.uid || "anonymous",
        userName: eventData.userName || "Unknown User",
        item: eventData.item || null,
        message: eventData.message || "",
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(
        collection(this.db, "group_boxes", groupBoxId, "session_history"),
        eventRecord
      );

      console.log(
        `Session history event added: ${eventRecord.type} for ${eventRecord.userName}, doc ID: ${docRef.id}`
      );
      return true;
    } catch (error) {
      console.error("Error adding session history event:", error);
      return false;
    }
  }

  async getSessionHistory(groupBoxId) {
    if (!this.isReady) {
      console.warn("Firebase not ready, cannot load session history");
      return [];
    }

    try {
      const { collection, query, orderBy, getDocs, limit } =
        window.firebaseFunctions;
      const historyRef = collection(
        this.db,
        "group_boxes",
        groupBoxId,
        "session_history"
      );
      // Get last 100 events, ordered by timestamp descending
      const q = query(historyRef, orderBy("timestamp", "desc"), limit(10));
      const querySnapshot = await getDocs(q);

      const history = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Ensure we have all required fields
        const event = {
          id: doc.id,
          type: data.type || "spin",
          userId: data.userId || "unknown",
          userName: data.userName || "Unknown User",
          item: data.item || null,
          message: data.message || "",
          // Handle both Firestore timestamps and ISO strings
          timestamp: data.timestamp?.toDate?.()
            ? data.timestamp.toDate().toISOString()
            : data.createdAt || new Date().toISOString(),
          createdAt: data.createdAt || new Date().toISOString(),
        };
        history.push(event);
      });

      console.log(
        `Loaded ${history.length} session history events for group box ${groupBoxId}`
      );
      return history;
    } catch (error) {
      console.error("Error loading session history:", error);
      return [];
    }
  }
}

export default FirebaseService;

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
  arrayUnion,
  increment,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.isReady = false;
    this.docCache = new Map(); // id -> { data, ts }
    this.pendingLoads = new Map(); // id -> Promise
    this.CACHE_TTL_MS = 10_000; // 10s TTL
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
        arrayUnion,
        increment,
        onSnapshot,
      };

      // Sign in anonymously and perform smoke test
      const userCredential = await signInAnonymously(this.auth);
      const uid = userCredential.user.uid;
      console.log("Signed in anonymously with uid:", uid);

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

    console.log("FirebaseService.saveGroupBox - Received data:", data);
    console.log(
      "FirebaseService.saveGroupBox - Participants:",
      data.participants
    );

    // Create a clean copy of the data to ensure it's saved properly
    const groupBoxToSave = {
      ...data,
      participants: data.participants || [],
      updatedAt: new Date().toISOString(),
    };

    console.log(
      "FirebaseService.saveGroupBox - About to save:",
      groupBoxToSave
    );

    const docRef = await addDoc(
      collection(this.db, "group_boxes"),
      groupBoxToSave
    );
    console.log("Created group box in Firebase with ID:", docRef.id);

    // Verify what was saved by reading it back
    const savedDoc = await getDoc(docRef);
    if (savedDoc.exists()) {
      console.log("Verification - What was actually saved:", savedDoc.data());
      console.log(
        "Verification - Participants in saved doc:",
        savedDoc.data().participants
      );
    }

    return docRef.id;
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

    const { doc, getDoc, collection, getDocs, query, where } =
      window.firebaseFunctions;
    const currentUser = this.getCurrentUser();

    // --- Participated boxes (from user's subcollection) ---
    const participatedRef = collection(
      this.db,
      "users",
      currentUser.uid,
      "participated_group_boxes"
    );
    const participatedSnapshot = await getDocs(participatedRef);

    const participatedBoxes = [];
    const toDelete = [];

    for (const docSnap of participatedSnapshot.docs) {
      const data = docSnap.data();

      // Skip if user hid/left
      if (data.hiddenByUser === true || data.hasLeft === true) continue;

      // Load canonical group box doc once
      let gbData = null;
      try {
        const gbRef = doc(this.db, "group_boxes", data.groupBoxId);
        const gbSnap = await getDoc(gbRef);
        if (!gbSnap.exists()) {
          toDelete.push(docSnap.id);
          continue;
        }
        gbData = gbSnap.data();
      } catch {
        toDelete.push(docSnap.id);
        continue;
      }

      const participants = Array.isArray(gbData?.participants)
        ? gbData.participants
        : [];
      const activeUsers = participants.filter((p) => !p?.hasLeft).length;
      const totalSpins =
        typeof gbData?.totalSpins === "number" ? gbData.totalSpins : 0;

      participatedBoxes.push({
        id: docSnap.id,
        ...data,
        isGroupBox: true,
        // enrich for cards
        participants,
        activeUsers,
        totalSpins,
        // legacy fallbacks if present
        totalOpens:
          typeof gbData?.totalOpens === "number"
            ? gbData.totalOpens
            : undefined,
        uniqueUsers:
          typeof gbData?.uniqueUsers === "number"
            ? gbData.uniqueUsers
            : undefined,
      });
    }

    // Clean up orphaned participation records
    for (const deadId of toDelete) {
      try {
        await window.firebaseFunctions.deleteDoc(
          doc(
            this.db,
            "users",
            currentUser.uid,
            "participated_group_boxes",
            deadId
          )
        );
        console.log(`Deleted orphaned participation record: ${deadId}`);
      } catch (e) {
        console.error(`Failed to delete orphaned record ${deadId}:`, e);
      }
    }

    // --- Organizer-only boxes created by me (show in list with counters) ---
    const organizerRef = collection(this.db, "group_boxes");
    const organizerQuery = query(
      organizerRef,
      where("createdBy", "==", currentUser.uid),
      where("organizerOnly", "==", true)
    );
    const organizerSnapshot = await getDocs(organizerQuery);

    const organizerBoxes = [];
    organizerSnapshot.forEach((d) => {
      const gb = d.data();
      const participants = Array.isArray(gb?.participants)
        ? gb.participants
        : [];
      const activeUsers = participants.filter((p) => !p?.hasLeft).length;
      const totalSpins = typeof gb?.totalSpins === "number" ? gb.totalSpins : 0;

      organizerBoxes.push({
        id: d.id,
        groupBoxId: d.id,
        groupBoxName: gb.lootboxData?.name || gb.name,
        lootboxData: gb.lootboxData,
        settings: gb.settings,
        createdBy: gb.createdBy,
        creatorName: gb.creatorName,
        isCreator: true,
        isOrganizerOnly: true,
        favorite: false,
        isGroupBox: true,
        // enrich for cards
        participants,
        activeUsers,
        totalSpins,
        // legacy fallbacks if present
        totalOpens: typeof gb?.totalOpens === "number" ? gb.totalOpens : 0,
        uniqueUsers: typeof gb?.uniqueUsers === "number" ? gb.uniqueUsers : 0,
        firstParticipated: gb.createdAt,
        lastParticipated: gb.createdAt,
        userTotalOpens: 0,
        userRemainingTries: 0,
      });
    });

    // Merge, avoiding duplicates by groupBoxId
    const all = [...participatedBoxes];
    organizerBoxes.forEach((o) => {
      const i = all.findIndex((x) => x.groupBoxId === o.groupBoxId);
      if (i === -1) all.push(o);
      else all[i] = { ...all[i], ...o };
    });

    console.log(`Total merged group boxes: ${all.length}`);
    return all;
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
  // Alias for UIController compatibility
  async loadAvailableChests() {
    return this.loadChestManifest();
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
  async updateGroupBoxParticipant(groupBoxId, participantData) {
    if (!this.isReady) throw new Error("Firebase not ready");

    const { getDoc, updateDoc, doc } = window.firebaseFunctions;

    // Get current participants
    const groupBoxRef = doc(this.db, "group_boxes", groupBoxId);
    const groupBoxSnap = await getDoc(groupBoxRef);
    const groupBoxData = groupBoxSnap.data();

    const participants = groupBoxData.participants || [];

    // Check if participant already exists
    const existingIndex = participants.findIndex(
      (p) => p.userId === participantData.userId
    );

    if (existingIndex >= 0) {
      // Update existing participant
      participants[existingIndex] = {
        ...participants[existingIndex],
        ...participantData,
      };
    } else {
      // Add new participant
      participants.push(participantData);
    }

    // Update the group box
    await updateDoc(groupBoxRef, {
      participants: participants,
      uniqueUsers: participants.length,
    });
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
      const q = query(historyRef, orderBy("timestamp", "desc"), limit(50));
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
  // Record a "join" event in a group box
  static async logGroupJoin(db, groupBoxId, uid, userName) {
    const colRef = collection(
      doc(db, "group_boxes", groupBoxId),
      "session_history"
    );
    await addDoc(colRef, {
      type: "join",
      userId: uid,
      userName: userName || "Unknown",
      timestamp: serverTimestamp(),
    });
  }
  // Hide a participated group box for the current user and log a "leave"
  async hideParticipatedGroupBox(groupBoxId) {
    if (!this.isReady || !this.getCurrentUser()) return false;

    try {
      const user = this.getCurrentUser();

      // 1) mark it hidden (and mark as left)
      await setDoc(
        doc(this.db, "users", user.uid, "participated_group_boxes", groupBoxId),
        {
          groupBoxId,
          hiddenByUser: true,
          hasLeft: true,
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) log a "leave" event in session_history (best effort)
      try {
        await addDoc(
          collection(this.db, "group_boxes", groupBoxId, "session_history"),
          {
            type: "leave",
            userId: user.uid,
            userName: user.displayName || "Unknown",
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString(),
          }
        );
      } catch (e) {
        console.warn("Could not write leave event (non-blocking):", e);
      }

      return true;
    } catch (e) {
      console.error("hideParticipatedGroupBox failed:", e);
      return false;
    }
  }
  async loadGroupBox(groupBoxId) {
    if (!this.isReady) return null;

    // 1) warm cache
    const cached = this.docCache.get(groupBoxId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS)
      return cached.data;

    // 2) collapse concurrent requests
    if (this.pendingLoads.has(groupBoxId))
      return this.pendingLoads.get(groupBoxId);

    const { doc, getDoc } = window.firebaseFunctions;
    const ref = doc(this.db, "group_boxes", groupBoxId);

    const p = (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = { id: groupBoxId, groupBoxId, ...snap.data() };
      this.docCache.set(groupBoxId, { data, ts: Date.now() });
      return data;
    })();

    this.pendingLoads.set(groupBoxId, p);
    try {
      return await p;
    } finally {
      this.pendingLoads.delete(groupBoxId);
    }
  }

  listenToGroupBoxDoc(groupBoxId, onData, onError) {
    if (!this.isReady) return () => {};
    const { doc, onSnapshot } = window.firebaseFunctions;
    const ref = doc(this.db, "group_boxes", groupBoxId);
    return onSnapshot(
      ref,
      (snap) =>
        onData(
          snap.exists()
            ? { id: snap.id, groupBoxId: snap.id, ...snap.data() }
            : null
        ),
      onError || ((e) => console.error("group box doc listener error:", e))
    );
  }

  listenToSessionHistory(groupBoxId, onData, onError) {
    if (!this.isReady) return () => {};
    const { collection, query, orderBy, limit, onSnapshot } =
      window.firebaseFunctions;
    const q = query(
      collection(this.db, "group_boxes", groupBoxId, "session_history"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(
      q,
      (qs) => {
        const arr = [];
        qs.forEach((d) => {
          const x = d.data();
          arr.push({
            id: d.id,
            type: x.type || "spin",
            userId: x.userId || "unknown",
            userName: x.userName || "Unknown User",
            item: x.item || null,
            message: x.message || "",
            timestamp: x.timestamp?.toDate?.()
              ? x.timestamp.toDate().toISOString()
              : x.createdAt || new Date().toISOString(),
            createdAt: x.createdAt || new Date().toISOString(),
          });
        });
        onData(arr);
      },
      onError || ((e) => console.error("history listener error:", e))
    );
  }
}

export default FirebaseService;

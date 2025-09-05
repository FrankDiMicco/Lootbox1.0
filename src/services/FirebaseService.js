// FirebaseService.js — FULL FILE (rewritten, keeps all features, adds atomic spin)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
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
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.isReady = false;

    this.docCache = new Map(); // id -> { data, ts }
    this.pendingLoads = new Map(); // id -> Promise
    this.CACHE_TTL_MS = 10_000;
  }

  async initialize() {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyDX_7gT2YHIQnJ9Svna0-t-skJ7qNnygWM",
        authDomain: "lootbox-creator.firebaseapp.com",
        projectId: "lootbox-creator",
        storageBucket: "lootbox-creator.firebasestorage.app",
        messagingSenderId: "222437059752",
        appId: "1:222437059752:web:f759d88598023b60c1a69d",
        measurementId: "G-2NQVKW2XP6",
      };

      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      // Wait for auth state to settle before proceeding
      const currentUser = await this.waitForAuth();
      
      if (currentUser) {
        console.log("Session restored for:", currentUser.email || currentUser.uid);
      } else {
        console.log("No session found, creating anonymous user");
        const userCredential = await signInAnonymously(this.auth);
        console.log("Signed in anonymously with uid:", userCredential.user.uid);
      }

      // Set up Firebase functions...
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
        runTransaction,
      };
      window.firebaseService = this;

      this.isReady = true;
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      throw error;
    }
  }

  // Helper method to wait for auth state with timeout
  async waitForAuth() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        // Give Firebase a moment to fully initialize the user
        setTimeout(() => {
          unsubscribe();
          resolve(user);
        }, 100);
      });
      
      // Timeout fallback - if no auth state after 3 seconds, proceed
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
    });
  }

  getCurrentUser() {
    return this.auth?.currentUser || null;
  }

  // ===== Lootboxes (personal) =====

  // In FirebaseService.js - Replace the saveLootbox method with this fixed version:

  async saveLootbox(lootbox) {
    if (!this.isReady) {
      throw new Error("Firebase not ready");
    }

    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error("User not authenticated - cannot save lootbox");
    }

    console.log("Saving lootbox for user:", currentUser.uid);
    console.log("Lootbox data:", lootbox);

    // Ensure we always have a UID in the payload
    const payload = {
      ...lootbox,
      uid: currentUser.uid,
      updatedAt: new Date().toISOString(),
    };

    // Verify the UID is actually in the payload
    if (!payload.uid) {
      throw new Error("Failed to add UID to lootbox payload");
    }

    console.log("Payload being saved:", payload);

    try {
      if (lootbox.id) {
        // Update existing lootbox
        const id = lootbox.id;
        const payloadToSave = { ...payload };
        delete payloadToSave.id; // Remove id from the data being saved

        await setDoc(doc(this.db, "lootboxes", id), payloadToSave);
        console.log(
          "Updated lootbox in Firebase:",
          id,
          "for user:",
          currentUser.uid
        );
        return id;
      } else {
        // Create new lootbox
        const docRef = await addDoc(collection(this.db, "lootboxes"), payload);
        console.log(
          "Created new lootbox in Firebase:",
          docRef.id,
          "for user:",
          currentUser.uid
        );
        return docRef.id;
      }
    } catch (error) {
      console.error("Error saving lootbox to Firebase:", error);
      console.error("User:", currentUser);
      console.error("Payload:", payload);
      throw error;
    }
  }

  async loadLootboxes() {
    if (!this.isReady) {
      throw new Error("Firebase not ready");
    }

    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    console.log("Loading lootboxes for user:", currentUser.uid);

    try {
      // Query for lootboxes that belong to this user
      const userQuery = query(
        collection(this.db, "lootboxes"),
        where("uid", "==", currentUser.uid)
      );
      const querySnapshot = await getDocs(userQuery);

      const lootboxes = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Remove uid from the returned data (we don't need it in the app)
        delete data.uid;
        // IMPORTANT: Spread data first, then override with doc.id
        lootboxes.push({ ...data, id: doc.id });
      });

      console.log(
        `Loaded ${lootboxes.length} lootboxes from Firebase for user ${currentUser.uid}`
      );

      // Optional: Log if there are orphaned lootboxes (for debugging)
      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        this.logOrphanedLootboxes();
      }

      return lootboxes;
    } catch (error) {
      console.error("Error loading lootboxes:", error);
      throw error;
    }
  }

  async deleteLootbox(id) {
    if (!this.isReady) throw new Error("Firebase not ready");
    await deleteDoc(doc(this.db, "lootboxes", id));
    console.log("Deleted lootbox from Firebase:", id);
  }
  async logOrphanedLootboxes() {
    try {
      // Query for lootboxes with no uid field
      const orphanQuery = query(
        collection(this.db, "lootboxes"),
        where("uid", "==", null)
      );
      const orphanSnapshot = await getDocs(orphanQuery);

      if (!orphanSnapshot.empty) {
        console.warn(
          `Found ${orphanSnapshot.size} orphaned lootboxes without UID:`,
          orphanSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
          }))
        );
      }
    } catch (error) {
      // Ignore errors in this debug helper
      console.log("Could not check for orphaned lootboxes:", error.message);
    }
  }
  async recordSpin(lootboxId, result) {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }
    const currentUser = this.getCurrentUser();
    const spinData = {
      userId: currentUser.uid,
      lootboxId,
      result,
      timestamp: new Date(),
    };
    const docRef = await addDoc(collection(this.db, "spins"), spinData);
    console.log("Recorded spin in Firebase:", docRef.id);
    return docRef.id;
  }

  // ===== Group Boxes =====

  async saveGroupBox(data) {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }

    const groupBoxToSave = {
      ...data,
      participants: data.participants || [],
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(
      collection(this.db, "group_boxes"),
      groupBoxToSave
    );
    console.log("Created group box in Firebase with ID:", docRef.id);

    // read-back verify (debug)
    const saved = await getDoc(docRef);
    if (saved.exists()) {
      console.log("Verification - What was actually saved:", saved.data());
      console.log(
        "Verification - Participants in saved doc:",
        saved.data().participants
      );
    }
    return docRef.id;
  }

  /**
   * ATOMIC SPIN for GROUP BOXES (prevents double-counts).
   * Decrements user_tries.remainingTries, increments totals, writes session_history (idempotent by key).
   */
  async finalizeSpinAtomic({
    groupBoxId,
    userId,
    idempotencyKey,
    spinPayload = {},
  }) {
    if (!this.isReady) throw new Error("Firebase not ready");

    const groupRef = doc(this.db, "group_boxes", groupBoxId);
    const triesRef = doc(
      this.db,
      "group_boxes",
      groupBoxId,
      "user_tries",
      userId
    );
    const histRef = doc(
      this.db,
      "group_boxes",
      groupBoxId,
      "session_history",
      idempotencyKey
    );

    return runTransaction(this.db, async (tx) => {
      const [g, t, h] = await Promise.all([
        tx.get(groupRef),
        tx.get(triesRef),
        tx.get(histRef),
      ]);

      // idempotent
      if (h.exists()) return { alreadyProcessed: true };

      if (!t.exists()) throw new Error("not-participant");
      const remaining = t.data().remainingTries ?? 0;
      if (remaining <= 0) throw new Error("no-tries-left");

      // user counters
      tx.update(triesRef, {
        remainingTries: increment(-1),
        totalOpens: increment(1),
        lastOpen: serverTimestamp(),
      });

      // group counters
      tx.update(groupRef, {
        totalOpens: increment(1),
        totalSpins: increment(1),
        updatedAt: serverTimestamp(),
      });

      // session_history entry (keyed)
      tx.set(histRef, {
        type: "spin",
        userId,
        createdAt: serverTimestamp(),
        key: idempotencyKey,
        ...spinPayload,
      });

      return { alreadyProcessed: false };
    });
  }

  async loadParticipatedGroupBoxes() {
    if (!this.isReady || !this.getCurrentUser()) {
      throw new Error("Firebase not ready or user not authenticated");
    }
    const currentUser = this.getCurrentUser();

    // participated
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

      if (data.hiddenByUser === true || data.hasLeft === true) continue;

      // canonical read
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
        participants,
        activeUsers,
        totalSpins,
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

    // clean orphans
    for (const deadId of toDelete) {
      try {
        await deleteDoc(
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

    // organizer-only (mine)
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
        participants,
        activeUsers,
        totalSpins,
        totalOpens: typeof gb?.totalOpens === "number" ? gb.totalOpens : 0,
        uniqueUsers: typeof gb?.uniqueUsers === "number" ? gb.uniqueUsers : 0,
        firstParticipated: gb.createdAt,
        lastParticipated: gb.createdAt,
        userTotalOpens: 0,
        userRemainingTries: 0,
      });
    });

    // merge
    const all = [...participatedBoxes];
    organizerBoxes.forEach((o) => {
      const i = all.findIndex((x) => x.groupBoxId === o.groupBoxId);
      if (i === -1) all.push(o);
      else all[i] = { ...all[i], ...o };
    });

    console.log(`Total merged group boxes: ${all.length}`);
    return all;
  }

  // ===== Chests =====

  async loadChestManifest() {
    if (!this.isReady) throw new Error("Firebase not ready");
    try {
      const chestsRef = collection(this.db, "chests");
      const qy = query(chestsRef, orderBy("sortOrder", "asc"));
      const qs = await getDocs(qy);

      const chests = [];
      qs.forEach((d) => {
        const data = d.data();
        chests.push({
          file: (data.fileName || "").replace(/"/g, ""),
          name: (data.name || "").replace(/"/g, ""),
          description: (data.description || "").replace(/"/g, ""),
          tier: data.tier,
          sortOrder: data.sortOrder,
        });
      });
      console.log(`Loaded ${chests.length} chests from Firestore`);
      return chests;
    } catch (error) {
      console.error("Failed to load chests from Firestore:", error);
      // fallback
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
  async loadAvailableChests() {
    return this.loadChestManifest();
  }

  // ===== Session history (shared helpers) =====

  async addSessionHistoryEvent(groupBoxId, eventData) {
    if (!this.isReady) {
      console.warn("Firebase not ready, cannot add session history event");
      return false;
    }
    try {
      const uid = eventData.userId || this.getCurrentUser()?.uid;
      if (!uid)
        throw new Error("No userId available for session history event");

      const eventRecord = {
        type: eventData.type || "unknown",
        userId: uid,
        userName: (
          eventData.userName ||
          this.getCurrentUser()?.displayName ||
          ""
        ).trim(),
        item: eventData.item || null,
        message:
          eventData.type === "join" || eventData.type === "leave"
            ? ""
            : eventData.message || "",
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

    const groupBoxRef = doc(this.db, "group_boxes", groupBoxId);
    const groupBoxSnap = await getDoc(groupBoxRef);
    const groupBoxData = groupBoxSnap.data();

    const participants = groupBoxData.participants || [];
    const idx = participants.findIndex(
      (p) => p.userId === participantData.userId
    );

    if (idx >= 0) {
      participants[idx] = { ...participants[idx], ...participantData };
    } else {
      participants.push(participantData);
    }

    await updateDoc(groupBoxRef, {
      participants,
      uniqueUsers: participants.length,
    });
  }

  async getSessionHistory(groupBoxId) {
    if (!this.isReady) {
      console.warn("Firebase not ready, cannot load session history");
      return [];
    }
    try {
      const historyRef = collection(
        this.db,
        "group_boxes",
        groupBoxId,
        "session_history"
      );
      const qy = query(historyRef, orderBy("timestamp", "desc"), limit(50));
      const qs = await getDocs(qy);

      const history = [];
      qs.forEach((d) => {
        const data = d.data();
        history.push({
          id: d.id,
          type: data.type || "spin",
          userId: data.userId || "unknown",
          userName: data.userName || "Unknown User",
          item: data.item || null,
          message: data.message || "",
          timestamp: data.timestamp?.toDate?.()
            ? data.timestamp.toDate().toISOString()
            : data.createdAt || new Date().toISOString(),
          createdAt: data.createdAt || new Date().toISOString(),
        });
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

  async hideParticipatedGroupBox(groupBoxId) {
    if (!this.isReady || !this.getCurrentUser()) return false;
    try {
      const user = this.getCurrentUser();

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

  // ===== Doc utilities =====

  async loadGroupBox(groupBoxId) {
    if (!this.isReady) return null;

    const cached = this.docCache.get(groupBoxId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS)
      return cached.data;

    if (this.pendingLoads.has(groupBoxId))
      return this.pendingLoads.get(groupBoxId);

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
    const qy = query(
      collection(this.db, "group_boxes", groupBoxId, "session_history"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(
      qy,
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

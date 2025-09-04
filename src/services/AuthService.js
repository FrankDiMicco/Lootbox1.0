// src/services/AuthService.js
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

class AuthService {
  constructor(firebaseApp) {
    this.auth = getAuth(firebaseApp);
    this.currentUser = null;
    this.isAnonymous = false;
    this.authStateListeners = [];

    // Initialize providers
    this.googleProvider = new GoogleAuthProvider();
    this.appleProvider = new OAuthProvider("apple.com");

    // Configure providers
    this.googleProvider.addScope("profile");
    this.googleProvider.addScope("email");

    this.appleProvider.addScope("email");
    this.appleProvider.addScope("name");

    // Listen for auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.handleAuthStateChange(user);
    });
  }

  handleAuthStateChange(user) {
    this.currentUser = user;
    this.isAnonymous = user?.isAnonymous || false;

    // Notify listeners
    this.authStateListeners.forEach((callback) => callback(user));

    // Update UI state
    this.updateUIForAuthState(user);
  }

  updateUIForAuthState(user) {
    // Update navigation drawer user info
    const profileName = document.querySelector(".profile-name");
    const profileStatus = document.querySelector(".profile-status");
    const footerName = document.querySelector(".footer-name");
    const footerStatus = document.querySelector(".footer-status");

    if (user) {
      const displayName = user.displayName || "User";
      const email = user.email || "";

      if (profileName) profileName.textContent = displayName;
      if (footerName) footerName.textContent = displayName;

      if (user.isAnonymous) {
        if (profileStatus)
          profileStatus.textContent = "Guest - Sign in to save";
        if (footerStatus) footerStatus.textContent = "Not signed in";
        this.showUpgradePrompts();
      } else {
        if (profileStatus) profileStatus.textContent = "Signed in";
        if (footerStatus) footerStatus.textContent = email || "Signed in";
        this.hideUpgradePrompts();
      }
    } else {
      if (profileName) profileName.textContent = "Lootbox Creator";
      if (profileStatus) profileStatus.textContent = "Not signed in";
      if (footerName) footerName.textContent = "Guest User";
      if (footerStatus) footerStatus.textContent = "Not signed in";
    }
  }

  showUpgradePrompts() {
    // Show subtle upgrade prompts for anonymous users
    // This could be a banner, modal after creating lootboxes, etc.
    setTimeout(() => {
      if (this.isAnonymous && window.app?.controllers?.ui) {
        window.app.controllers.ui.showToast(
          "Sign in to sync your lootboxes across devices"
        );
      }
    }, 30000); // Show after 30 seconds of use
  }

  hideUpgradePrompts() {
    // Remove any upgrade prompts
    document.querySelectorAll(".upgrade-prompt").forEach((el) => el.remove());
  }

  // Initialize with anonymous auth (current behavior)
  async initializeAuth() {
    try {
      if (!this.currentUser) {
        await signInAnonymously(this.auth);
        console.log("Signed in anonymously");
      }
      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error("Anonymous auth failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Sign in with Google
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      console.log("Google sign-in successful:", result.user.displayName);

      // Track the sign-in method
      this.trackAuthMethod("google");

      return { success: true, user: result.user };
    } catch (error) {
      console.error("Google sign-in failed:", error);
      return { success: false, error: this.getReadableError(error) };
    }
  }

  // Sign in with Apple (iOS/macOS)
  async signInWithApple() {
    try {
      const result = await signInWithPopup(this.auth, this.appleProvider);
      console.log("Apple sign-in successful:", result.user.displayName);

      this.trackAuthMethod("apple");

      return { success: true, user: result.user };
    } catch (error) {
      console.error("Apple sign-in failed:", error);
      return { success: false, error: this.getReadableError(error) };
    }
  }

  // Upgrade anonymous account to permanent account
  async upgradeAnonymousAccount(provider) {
    if (!this.currentUser || !this.currentUser.isAnonymous) {
      return { success: false, error: "No anonymous account to upgrade" };
    }

    try {
      const authProvider =
        provider === "google" ? this.googleProvider : this.appleProvider;
      const result = await linkWithPopup(this.currentUser, authProvider);

      console.log(
        "Successfully upgraded anonymous account:",
        result.user.displayName
      );
      this.trackAuthMethod(`upgrade_${provider}`);

      // Show success message
      if (window.app?.controllers?.ui) {
        window.app.controllers.ui.showToast(
          `Account linked! Your lootboxes are now saved to ${
            provider === "google" ? "Google" : "Apple"
          }`
        );
      }

      return { success: true, user: result.user };
    } catch (error) {
      console.error("Account upgrade failed:", error);

      // Handle account-exists error
      if (error.code === "auth/credential-already-in-use") {
        return {
          success: false,
          error: "This account is already in use. Try signing in normally.",
          code: "account-exists",
        };
      }

      return { success: false, error: this.getReadableError(error) };
    }
  }

  // Sign out
  async signOut() {
    try {
      await signOut(this.auth);
      console.log("User signed out");

      // Restart with anonymous auth
      await this.initializeAuth();

      return { success: true };
    } catch (error) {
      console.error("Sign out failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Check if user should be prompted to upgrade
  shouldPromptUpgrade() {
    if (!this.isAnonymous) return false;

    // Check if user has created lootboxes (indicating engagement)
    const lootboxCount =
      window.app?.controllers?.lootbox?.getAllLootboxes?.()?.length || 0;
    const groupBoxCount =
      window.app?.controllers?.groupBox?.getAllGroupBoxes?.()?.length || 0;

    return lootboxCount + groupBoxCount >= 2; // Prompt after 2+ items created
  }

  // Get current user info
  getCurrentUser() {
    return this.currentUser;
  }

  isSignedIn() {
    return this.currentUser && !this.currentUser.isAnonymous;
  }

  isAnonymousUser() {
    return this.currentUser?.isAnonymous || false;
  }

  // Add auth state listener
  onAuthStateChanged(callback) {
    this.authStateListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  // Helper methods
  getReadableError(error) {
    switch (error.code) {
      case "auth/popup-closed-by-user":
        return "Sign-in was cancelled";
      case "auth/network-request-failed":
        return "Network error. Please check your connection";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later";
      case "auth/user-disabled":
        return "This account has been disabled";
      default:
        return error.message || "Sign-in failed";
    }
  }

  trackAuthMethod(method) {
    // Track auth methods for analytics
    console.log(`Auth method used: ${method}`);
    // You could send this to analytics service
  }

  // Show sign-in modal
  showSignInModal() {
    // Create and show a sign-in modal
    this.createSignInModal();
  }

  createSignInModal() {
    // Remove existing modal if present
    const existing = document.getElementById("signInModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "signInModal";
    modal.className = "modal show";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Sign In</h3>
          <button class="close-btn" data-action="close-modal" data-modal="signInModal">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; color: #e2e8f0;">
            ${
              this.isAnonymous
                ? "Save your lootboxes and sync across devices"
                : "Sign in to access your account"
            }
          </p>
          
          <div class="auth-buttons">
            <button class="auth-btn google-btn" data-action="sign-in-google">
              <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style="width: 20px; height: 20px;">
              ${
                this.isAnonymous ? "Link Google Account" : "Sign in with Google"
              }
            </button>
            
            <button class="auth-btn apple-btn" data-action="sign-in-apple" style="margin-top: 10px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              ${this.isAnonymous ? "Link Apple ID" : "Sign in with Apple"}
            </button>
          </div>

          ${
            this.isAnonymous
              ? `
            <div style="margin-top: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; font-size: 14px; color: #cbd5e1;">
              <strong>Keep your data safe!</strong><br>
              Your lootboxes are currently stored locally. Link an account to sync across devices and never lose your creations.
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add CSS for auth buttons if not present
    if (!document.getElementById("authStyles")) {
      const styles = document.createElement("style");
      styles.id = "authStyles";
      styles.textContent = `
        .auth-buttons { display: flex; flex-direction: column; gap: 10px; }
        .auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 12px 20px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          background: rgba(71, 85, 105, 0.4);
          color: #e2e8f0;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .auth-btn:hover {
          background: rgba(71, 85, 105, 0.6);
          border-color: #8b5cf6;
          transform: translateY(-1px);
        }
        .google-btn:hover { border-color: #4285f4; }
        .apple-btn:hover { border-color: #000; }
      `;
      document.head.appendChild(styles);
    }
  }
}

export default AuthService;

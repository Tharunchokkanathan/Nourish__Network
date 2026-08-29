// ============================================================
// LOGICAL ROUTING STEERING DISPATCHER (STEP 3)
// Handles returning email verification signatures & role-based steering
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initialize routing dispatcher on load
document.addEventListener("DOMContentLoaded", async () => {
  const currentBrowserUrl = window.location.href;
  
  // 1. Capture user role context passed back through secure query parameters mapping
  const urlAddressParameters = new URLSearchParams(window.location.search);
  const accountTypeClassification = urlAddressParameters.get("role"); // Evaluates 'seller' or 'buyer'

  const authInstance = window.firebaseAuth || (typeof getAuth === 'function' ? getAuth() : null);

  // 2. Intercept native verification redirection tokens coming back from Google/Firebase
  if (authInstance && isSignInWithEmailLink(authInstance, currentBrowserUrl)) {
    let targetVerifiedEmail = window.localStorage.getItem("emailForSignIn");
    
    if (!targetVerifiedEmail) {
      targetVerifiedEmail = window.prompt("Please confirm your email address for verification security tracking metrics:");
    }
    
    try {
      // Process secure verification signature handshake processing window loops
      await signInWithEmailLink(authInstance, targetVerifiedEmail, currentBrowserUrl);
      window.localStorage.removeItem("emailForSignIn");

      // 3. SECURE REDIRECTION DISPATCHING SWITCH MATRIX
      if (accountTypeClassification === "seller" || accountTypeClassification === "restaurant" || accountTypeClassification === "vendor") {
        window.location.href = "./seller-dashboard.html";
      } else if (accountTypeClassification === "buyer" || accountTypeClassification === "ngo") {
        window.location.href = "./buyer-dashboard.html";
      } else {
        // Fallback default redirect configuration sequence
        window.location.href = "./dashboard.html";
      }
    } catch (authVerificationError) {
      console.error("Verification Token Processing Exception Error:", authVerificationError);
      window.location.href = "./index.html?error=verification_failed";
    }
  } else if (accountTypeClassification && (window.location.pathname.includes("/auth/handler") || window.location.search.includes("action="))) {
    // Direct role parameter routing execution
    if (accountTypeClassification === "seller" || accountTypeClassification === "restaurant" || accountTypeClassification === "vendor") {
      window.location.href = "./seller-dashboard.html";
    } else if (accountTypeClassification === "buyer" || accountTypeClassification === "ngo") {
      window.location.href = "./buyer-dashboard.html";
    } else {
      window.location.href = "./dashboard.html";
    }
  }
});

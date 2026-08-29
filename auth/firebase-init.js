// ============================================================
// FIREBASE WEB SDK INITIALIZATION LAYER
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    isSignInWithEmailLink, 
    signInWithEmailLink 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase credentials configuration
const firebaseConfig = {
    apiKey: "AIzaSyB1MFO5jS2JZUqR8uTxEDmzy7dewTQO7uQ",
    authDomain: "nourish-network-12a85.firebaseapp.com",
    projectId: "nourish-network-12a85",
    storageBucket: "nourish-network-12a85.firebasestorage.app",
    messagingSenderId: "263981659439",
    appId: "1:263981659439:web:7efe9566de67300bdd5dda"
};

// Initialize Firebase App & Auth Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Bind to global window scope for seamless frontend integration
window.firebaseApp = app;
window.firebaseAuth = auth;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.sendEmailVerification = sendEmailVerification;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;

export { 
    app, 
    auth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    isSignInWithEmailLink, 
    signInWithEmailLink 
};

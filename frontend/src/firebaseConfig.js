import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAHzueR-6HcFRD9gF_QdqD2XAhzu4FEZTc",
    authDomain: "ride-booking-26aed.firebaseapp.com",
    projectId: "ride-booking-26aed",
    storageBucket: "ride-booking-26aed.firebasestorage.app",
    messagingSenderId: "81266453341",
    appId: "1:81266453341:web:b32aefa8faff76858416b4",
    measurementId: "G-KTM87VPJM0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Connect to Auth Emulator only if explicitly enabled and running locally
// Set this to true only if you have Firebase emulators running
const USE_AUTH_EMULATOR = false; // Set to true if using Firebase Auth Emulator

if (USE_AUTH_EMULATOR && typeof window !== 'undefined' && window.location.hostname === "localhost") {
    try {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        console.log("Connected to Firebase Auth Emulator");
    } catch (error) {
        // Emulator already connected, ignore error
        console.log("Auth emulator connection skipped (may already be connected)");
    }
}

// Initialize Firestore
const db = getFirestore(app);

// Connect to Firestore Emulator only if explicitly enabled
// Set this to true only if you have Firebase emulators running
const USE_FIRESTORE_EMULATOR = false; // Set to true if using Firebase Firestore Emulator

if (USE_FIRESTORE_EMULATOR && typeof window !== 'undefined' && window.location.hostname === "localhost") {
    try {
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        console.log("Connected to Firebase Firestore Emulator");
    } catch (error) {
        // Emulator already connected, ignore error
        console.log("Firestore emulator connection skipped (may already be connected)");
    }
}

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account',
});

export { auth, db, googleProvider };
export default app;

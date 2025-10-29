import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let firebaseError: string | null = null;

try {
  // The FIREBASE_CONFIG environment variable should be set as a JSON string
  // containing your Firebase project's configuration.
  const firebaseConfigStr = process.env.FIREBASE_CONFIG;
  if (!firebaseConfigStr) {
    throw new Error("The `FIREBASE_CONFIG` environment variable is not set. Please provide it as a JSON string in your project's secrets.");
  }
  
  const firebaseConfig = JSON.parse(firebaseConfigStr);

  if (!firebaseConfig.apiKey) {
    throw new Error("The Firebase config object is missing the 'apiKey' property.");
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

} catch (error) {
  console.error("Failed to initialize Firebase:", error);
  if (error instanceof Error) {
    // Provide a helpful message for the common case of invalid JSON.
    if (error.message.includes('JSON')) {
       firebaseError = "Failed to parse `FIREBASE_CONFIG`. Please ensure it's a valid, single-line JSON string.";
    } else {
       firebaseError = error.message;
    }
  } else {
    firebaseError = "An unknown error occurred during Firebase initialization.";
  }
}

export const googleProvider = new GoogleAuthProvider();
export { app, auth, db, firebaseError };

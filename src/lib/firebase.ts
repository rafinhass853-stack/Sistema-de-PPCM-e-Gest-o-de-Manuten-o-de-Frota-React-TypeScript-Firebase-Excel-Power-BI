import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

// Firebase Web configuration is public client configuration. Environment
// variables are preferred in CI, with the project values as a safe fallback
// so the hosted app does not become a blank screen when a VITE secret is missing.
const config={
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY||"AIzaSyAEcx7itNuEDUQw9UqZHG2XNrFB7kNmrA",
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||"sistemppcmgestaofrota.firebaseapp.com",
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||"sistemppcmgestaofrota",
  storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET||"sistemppcmgestaofrota.firebasestorage.app",
  messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID||"469472530599",
  appId:import.meta.env.VITE_FIREBASE_APP_ID||"1:469472530599:web:163c7b75ae1c567cd6cb82",
  measurementId:import.meta.env.VITE_FIREBASE_MEASUREMENT_ID||"G-BNFTL5ZHKH"
};

const app=initializeApp(config);
export const auth=getAuth(app);
export const db=getFirestore(app);
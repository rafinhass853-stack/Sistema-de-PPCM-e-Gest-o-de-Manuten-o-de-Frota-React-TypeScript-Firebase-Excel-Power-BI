import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";
import {getStorage} from "firebase/storage";

// Firebase Web configuration for the SISTEMPPCMGESTAOFROTA web app.
// This is client-side configuration; the private Service Account credential
// remains only in GitHub Actions as FIREBASE_SERVICE_ACCOUNT.
const config={
  apiKey:"AIzaSyAEcx7itNuEDUQwqU9ZHG2XNrFRB7kNmrA",
  authDomain:"sistemppcmgestaofrota.firebaseapp.com",
  projectId:"sistemppcmgestaofrota",
  storageBucket:"sistemppcmgestaofrota.firebasestorage.app",
  messagingSenderId:"469472530599",
  appId:"1:469472530599:web:163c7b75ae1c567cd6cb82",
  measurementId:"G-BNFTL5ZHKH"
};

const app=initializeApp(config);

export const auth=getAuth(app);
export const db=getFirestore(app);
export const storage=getStorage(app);

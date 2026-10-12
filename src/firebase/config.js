import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import {initializeAppCheck,ReCaptchaV3Provider} from "firebase/app-check";
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const configured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
export const restaurantId = env.VITE_RESTAURANT_ID || "yash-bagbahara";
const app = configured ? initializeApp(config) : null;
if(app && env.VITE_FIREBASE_APP_CHECK_SITE_KEY && env.VITE_USE_EMULATORS !== "true")initializeAppCheck(app,{provider:new ReCaptchaV3Provider(env.VITE_FIREBASE_APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const functions = app ? getFunctions(app, "asia-south1") : null;
if (app && env.DEV && env.VITE_USE_EMULATORS === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

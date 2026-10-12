import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    env:
      process.env.QUICKDINE_LIVE_TEST === "true"
        ? {
            VITE_FIREBASE_API_KEY: "fake-key",
            VITE_FIREBASE_AUTH_DOMAIN: "demo-quickdine.firebaseapp.com",
            VITE_FIREBASE_PROJECT_ID: "demo-quickdine",
            VITE_FIREBASE_APP_ID: "demo-app",
            VITE_RESTAURANT_ID: "browser-restaurant",
            VITE_USE_EMULATORS: "true",
          }
        : {},
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
  reporter: "list",
});

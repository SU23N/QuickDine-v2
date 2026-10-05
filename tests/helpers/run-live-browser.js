import { spawn } from "node:child_process";
import { startCallableServer } from "./callable-server.js";
const server = await startCallableServer();
const child = spawn(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/live.spec.js",
  ],
  { stdio: "inherit", env: { ...process.env, QUICKDINE_LIVE_TEST: "true" } },
);
child.on("exit", (code) => {
  server.close(() => process.exit(code || 0));
});

import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const express = require("express");
export async function startCallableServer() {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
    throw Error("Only run this HTTP harness with emulators.");
  const operations = await import("../../functions/index.js");
  const app = express();
  app.use(express.json({verify:(req,res,buf)=>{req.rawBody=buf;}}));
  for(const [name,operation] of Object.entries(operations)) if(typeof operation === "function"&&operation.__endpoint)app.all(`/demo-quickdine/asia-south1/${name}`,operation);
  return await new Promise((resolve) => {
    const server = app.listen(5001, "127.0.0.1", () => resolve(server));
  });
}

import { existsSync } from "node:fs";
import { readConfig } from "./config.js";
import { createAppServer } from "./server.js";

// Reads .env, if there is one. Variables already set in the terminal win.
if (existsSync(".env")) process.loadEnvFile(".env");

const config = readConfig();
createAppServer(config).listen(config.port, () => {
  console.warn(`__APP_NAME__ is running at ${config.appUrl}`);
  if (!config.clientSecret) {
    console.warn(`Add it in Lintel (Build → Apps → Add an app): ${config.appUrl}/lintel-app.json`);
    console.warn("Then put LINTEL_CLIENT_ID and LINTEL_CLIENT_SECRET in .env and start it again.");
  }
});

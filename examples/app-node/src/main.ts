import { readConfig } from "./config.js";
import { createAppServer } from "./server.js";

const config = readConfig();
createAppServer(config).listen(config.port, () => {
  console.warn(`Publishing Log is running at ${config.appUrl}`);
  console.warn(`Add it in Lintel (Settings → Apps) from ${config.appUrl}/lintel-app.json`);
  if (!config.clientSecret) {
    console.warn("Then set LINTEL_CLIENT_ID and LINTEL_CLIENT_SECRET and start it again.");
  }
});

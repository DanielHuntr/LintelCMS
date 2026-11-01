// The Docker image's entry point. Lintel itself never runs as root.
//
// Hosting platforms (Railway, Render, Fly.io) mount their volumes owned by root, where the
// `node` user can't write. So the container starts as root just long enough to hand the
// data folder to `node`, then this same process becomes `node` and starts Lintel. Started
// as `node` already (`docker run --user node`), it skips straight to starting Lintel.
import { chownSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const NODE_USER_ID = 1000;
const NODE_GROUP_ID = 1000;
const dataFolder = process.env.LINTEL_FOLDER ?? "/data";

function giveToNodeUser(path) {
  chownSync(path, NODE_USER_ID, NODE_GROUP_ID);
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) giveToNodeUser(join(path, name));
  }
}

if (process.getuid?.() === 0) {
  mkdirSync(join(dataFolder, "uploads"), { recursive: true });
  // Only the first start of a new volume has anything to change.
  for (const folder of [dataFolder, join(dataFolder, "uploads")]) {
    if (statSync(folder).uid !== NODE_USER_ID) giveToNodeUser(folder);
  }
  process.setgroups?.([NODE_GROUP_ID]);
  process.setgid?.(NODE_GROUP_ID);
  process.setuid?.(NODE_USER_ID);
}

await import("./dist/main.js");

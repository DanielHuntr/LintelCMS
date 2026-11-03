// Copies the PHP companion beside the compiled code: Lintel uploads it as it is, so it
// isn't compiled, and `tsc` leaves files that aren't TypeScript behind.
import { copyFileSync, mkdirSync } from "node:fs";

const source = new URL("../src/bridge/lintel-bridge.php", import.meta.url);
const target = new URL("../dist/bridge/", import.meta.url);
mkdirSync(target, { recursive: true });
copyFileSync(source, new URL("lintel-bridge.php", target));

// The hosting checker too: `lintel check` and Settings → This server run it from dist.
const checker = new URL("../dist/hosting/files/", import.meta.url);
mkdirSync(checker, { recursive: true });
copyFileSync(
  new URL("../src/hosting/files/lintel-check.cjs", import.meta.url),
  new URL("lintel-check.cjs", checker),
);

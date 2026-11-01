// Copies the PHP companion beside the compiled code: Lintel uploads it as it is, so it
// isn't compiled, and `tsc` leaves files that aren't TypeScript behind.
import { copyFileSync, mkdirSync } from "node:fs";

const source = new URL("../src/bridge/lintel-bridge.php", import.meta.url);
const target = new URL("../dist/bridge/", import.meta.url);
mkdirSync(target, { recursive: true });
copyFileSync(source, new URL("lintel-bridge.php", target));

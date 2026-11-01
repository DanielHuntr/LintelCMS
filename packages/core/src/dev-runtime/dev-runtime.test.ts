import { execFile } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const CORE_FOLDER = fileURLToPath(new URL("../..", import.meta.url));
const TSX = join(CORE_FOLDER, "node_modules", ".bin", "tsx");

describe("running Lintel from source (pnpm dev)", () => {
  it("compiles the builder's JSX so designed pages can be drawn", async () => {
    // Without tsconfig.dev.json, tsx compiled the builder's .tsx files with the old
    // JSX transform and every designed page failed with "React is not defined".
    const { stdout } = await promisify(execFile)(
      TSX,
      [
        "--tsconfig",
        "tsconfig.dev.json",
        "--conditions=development",
        "src/dev-runtime/render-builder-page.fixture.ts",
      ],
      { cwd: CORE_FOLDER, env: { ...process.env, TSX_DISABLE_CACHE: "1" } },
    );
    expect(stdout).toBe("rendered");
  }, 60_000);
});

import { join } from "node:path";

/**
 * The files `lintel addons new` writes, keyed by path inside the new folder. Kept as plain
 * text so the template reads like the add-on it makes; addon-scaffold.test.ts checks the
 * result is an add-on Lintel accepts.
 */

export interface TemplateValues {
  /** The add-on's id, which is also its folder's name: "star-ratings". */
  id: string;
  lintelVersion: string;
  /** The Lintel checkout the add-on links to for its types and tests. */
  lintelRoot: string;
}

export function addonTemplateFiles(values: TemplateValues): Record<string, string> {
  const { id } = values;
  const prefix = `${id.replaceAll("-", "_")}_`;
  const title = id
    .split("-")
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
  const link = (name: string) =>
    `link:${join(values.lintelRoot, "packages", name).replaceAll("\\", "/")}`;
  const lintelRoot = values.lintelRoot.replaceAll("\\", "/").replace(/\/$/, "");

  const packageFile = {
    name: `lintel-addon-${id}`,
    version: "0.1.0",
    description: `${title}: an add-on for Lintel.`,
    type: "module",
    files: ["dist", "migrations"],
    keywords: ["lintel-addon"],
    "lintel-addon": {
      id,
      lintel: `>=${values.lintelVersion}`,
      server: "dist/server.js",
      admin: "dist/admin.js",
    },
    scripts: {
      build: "lintel addons build",
      dev: "lintel addons build --watch",
      test: "vitest run",
      typecheck: "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.admin.json",
    },
    devDependencies: {
      "@lintel/admin": link("admin"),
      "@lintel/cli": link("cli"),
      "@lintel/core": link("core"),
      "@tanstack/react-query": "^5.105.0",
      "@types/node": "^26.6.6",
      "@types/react": "^19.3.0",
      "lucide-react": "^1.66.0",
      react: "^19.3.1",
      typescript: "^6.0.3",
      vitest: "^5.0.5",
      zod: "^4.6.7",
    },
  };

  return {
    "package.json": `${JSON.stringify(packageFile, null, 2)}\n`,
    ".gitignore": "node_modules\ndist\n",
    "tsconfig.json": `${JSON.stringify(
      {
        extends: `${lintelRoot}/tsconfig.base.json`,
        compilerOptions: { rootDir: ".", noEmit: true, types: ["node"] },
        include: ["src/server", "vitest.config.ts"],
      },
      null,
      2,
    )}\n`,
    "tsconfig.admin.json": `${JSON.stringify(
      {
        extends: `${lintelRoot}/tsconfig.base.json`,
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          lib: ["ES2023", "DOM", "DOM.Iterable"],
          types: [],
          noEmit: true,
        },
        include: ["src/admin", `${lintelRoot}/packages/admin/src/vite-env.d.ts`],
      },
      null,
      2,
    )}\n`,
    "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // As in Lintel itself: GraphQL must load as one copy, the one Node uses.
    alias: [{ find: /^graphql$/, replacement: "graphql/index.js" }],
  },
  test: {
    include: ["src/server/**/*.test.ts"],
    // A Lintel server on a fresh built-in database takes a few seconds to start.
    hookTimeout: 120_000,
  },
});
`,
    "src/server/index.ts": `import { defineBlock, defineFieldtype, definePlugin, escapeHtml, text, textarea } from "@lintel/core/plugin";
import { z } from "zod";

/**
 * The server half of ${title}. \`npm run build\` bundles it into dist/server.js, which Lintel
 * loads when the add-on is installed. Each part below is an example to change or remove.
 */
export default definePlugin({
  id: "${id}",
  name: "${title}",
  description: "A rating field, a stars tag for templates and a callout for the builder.",
  version: "0.1.0",

  // Settings, with a form drawn for them on the Add-ons screen.
  settings: {
    schema: z.object({ symbol: z.string().min(1).max(2) }),
    defaults: { symbol: "★" },
  },

  // A kind of field for content types: a score from 1 to 5. Its editor is in src/admin.
  fieldtypes: [
    defineFieldtype({
      type: "${id}.rating",
      name: "Rating",
      description: "A score from 1 to 5, picked with stars.",
      category: "choices",
      optionsSchema: z.object({}),
      buildValueSchema: (_options, label) =>
        z
          .number({ error: \`\${label} should be a number\` })
          .int()
          .min(1, { error: \`\${label} should be at least 1\` })
          .max(5, { error: \`\${label} should be at most 5\` }),
      // What the delivery API, GraphQL and templates get for a stored 4.
      deliver: (value) => ({ score: value, outOf: 5 }),
    }),
  ],

  // {% ${prefix}stars 4 %} in a Liquid template, and {{ 4 | ${prefix}stars }}.
  liquid: {
    tags: [
      {
        name: "${prefix}stars",
        render: async ({ value }, { readSettings }) => {
          const { symbol } = await readSettings();
          const score = Math.max(0, Math.min(5, Math.round(Number(readScore(value)) || 0)));
          return \`<span class="${id}-stars" aria-label="\${score} out of 5">\${escapeHtml(symbol.repeat(score))}</span>\`;
        },
      },
    ],
    filters: [{ name: "${prefix}stars", apply: (value) => "★".repeat(Number(readScore(value)) || 0) }],
  },

  // An element for the builder's Insert menu, edited in the builder like any other.
  blocks: [
    defineBlock({
      handle: "${prefix}callout",
      name: "Callout",
      icon: "megaphone",
      category: "${title}",
      description: "A short message that stands out.",
      properties: { heading: text({ required: true }), message: textarea() },
      render: '<aside class="${id}-callout"><strong>{{heading}}</strong><p>{{message}}</p></aside>',
    }),
  ],

  // Things to do when something happens on the site, while the add-on is switched on.
  events: {
    "entry.published": (event, { log }) => {
      log.info(\`"\${event.data.entry.title}" was published\`);
    },
  },
});

/** A rating as stored (4) or as delivered ({ score: 4 }). */
function readScore(value: unknown): unknown {
  return typeof value === "object" && value !== null && "score" in value ? value.score : value;
}
`,
    "src/server/index.test.ts": `import { type PluginTestServer, startPluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import addon from "./index.js";

describe("${title}", () => {
  let lintel: PluginTestServer;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [addon] });
  });

  afterAll(() => lintel.close());

  it("draws stars with its Liquid tag and filter", async () => {
    expect(await lintel.renderLiquid("{% ${prefix}stars 3 %}")).toBe(
      '<span class="${id}-stars" aria-label="3 out of 5">★★★</span>',
    );
    expect(await lintel.renderLiquid("{{ 2 | ${prefix}stars }}")).toBe("★★");
  });

  it("offers the Callout in the builder", async () => {
    const asEditor = await lintel.signInWith(["entries:read"]);
    const response = await asEditor({ method: "GET", url: "/blocks" });
    const handles = response.json().blocks.map((block: { handle: string }) => block.handle);
    expect(handles).toContain("${prefix}callout");
  });

  it("offers the Rating field", async () => {
    const asAdmin = await lintel.signInWith(["blueprints:read"]);
    const response = await asAdmin({ method: "GET", url: "/fieldtypes" });
    const types = response.json().fieldtypes.map((fieldtype: { type: string }) => fieldtype.type);
    expect(types).toContain("${id}.rating");
  });
});
`,
    "src/admin/index.tsx": `import { defineAdminPlugin } from "@lintel/admin/plugin";
import { Star } from "lucide-react";
import { AboutWidget } from "./AboutWidget.js";
import { RatingEditor } from "./RatingEditor.js";
import { t } from "./strings.js";

/**
 * The admin half of ${title}: the Rating field's editor and a dashboard widget. Its id is
 * the server half's, and none of it shows while the add-on is switched off.
 */
export default defineAdminPlugin({
  id: "${id}",
  fieldEditors: [{ type: "${id}.rating", Editor: RatingEditor }],
  dashboardWidgets: [
    {
      id: "about",
      title: t("widget.title"),
      description: t("widget.description"),
      icon: Star,
      component: AboutWidget,
      defaultSize: "small",
    },
  ],
});
`,
    "src/admin/strings.ts": `import { createTranslator } from "@lintel/admin/plugin";

/** Every word ${title} shows in the admin, in one place so it can be translated. */
export const t = createTranslator({
  "rating.star": "{count} out of 5",
  "widget.title": "${title}",
  "widget.description": "A note from the ${title} add-on.",
  "widget.body": "${title} is switched on. Add a Rating field to a content type to try it.",
});
`,
    "src/admin/RatingEditor.tsx": `import type { FieldEditorProps } from "@lintel/admin/plugin";
import { t } from "./strings.js";

const SCORES = [1, 2, 3, 4, 5];

/** The Rating field: five stars, chosen like radio buttons, so arrow keys work too. */
export function RatingEditor({ field, value, onChange, controlId, describedBy }: FieldEditorProps) {
  const score = typeof value === "number" ? value : 0;
  return (
    <div id={controlId} role="radiogroup" aria-describedby={describedBy} style={{ display: "flex", gap: 4 }}>
      {SCORES.map((option) => (
        <label key={option} style={{ cursor: "pointer", fontSize: 24, lineHeight: 1 }}>
          <input
            type="radio"
            name={field.handle}
            value={option}
            checked={score === option}
            onChange={() => onChange(option)}
            style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
            aria-label={t("rating.star", { count: option })}
          />
          <span aria-hidden="true" style={{ color: option <= score ? "#f5a524" : "#c7c7cc" }}>
            ★
          </span>
        </label>
      ))}
    </div>
  );
}
`,
    "src/admin/AboutWidget.tsx": `import { t } from "./strings.js";

/** A dashboard widget people can add from the widget gallery. */
export function AboutWidget() {
  return <p className="text-body text-label-secondary">{t("widget.body")}</p>;
}
`,
    "README.md": `# ${title}

An add-on for Lintel, made with \`lintel addons new\`. It adds:

| Part | Where |
| --- | --- |
| A **Rating** field for content types, with its own editor | \`fieldtypes\` in src/server/index.ts, \`fieldEditors\` in src/admin |
| A Liquid tag \`{% ${prefix}stars 4 %}\` and filter \`{{ 4 \\| ${prefix}stars }}\` | \`liquid\` |
| A **Callout** element in the builder's Insert menu | \`blocks\` |
| A dashboard widget | \`dashboardWidgets\` in src/admin |
| Something done when a page is published | \`events\` |
| Settings, with a form on the Add-ons screen | \`settings\` |

## Working on it

\`\`\`bash
npm install
npm test                 # its tests, on a real Lintel with a database in memory
npm run dev              # rebuilds dist/ whenever you save
\`\`\`

Then, in your Lintel folder, \`pnpm lintel addons link ${"<this folder>"}\` and restart Lintel.
It is switched on at the next start. Restart Lintel after changing the server half; reload
the admin after changing the admin half.

Lintel's packages aren't on npm yet, so this one links to the copy of Lintel at
\`${lintelRoot}\` for its types and tests. Run \`pnpm build\` there first.

## Publishing it

\`npm run build\`, then \`npm publish\`. Sites install it with
\`lintel addons add lintel-addon-${id}\`. Set \`"lintel-addon".lintel\` in package.json to
the Lintel versions you have tried it with.

The guide is "Building add-ons" in Lintel's docs.
`,
  };
}

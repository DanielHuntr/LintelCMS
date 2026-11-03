import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { deliverValues } from "../delivery/delivered-values.js";
import { defineFieldtype } from "../fieldtypes/fieldtype.js";
import { escapeHtml } from "../liquid-templates/liquid-tags.js";
import { PluginCatalogue } from "./plugin-catalogue.js";
import { listPluginCommands } from "./plugin-commands.js";
import { definePlugin, type LintelPlugin } from "./plugin-definition.js";
import { startPluginTestServer, type PluginTestServer } from "./plugin-testing.js";
import { InvalidPluginError } from "./plugins.errors.js";

/**
 * What plugins add beyond routes and screens: Liquid tags and filters, event handlers,
 * timed jobs, terminal commands and how a fieldtype's values are delivered. Each works
 * only while the plugin is switched on.
 */
const published: string[] = [];
let jobRuns = 0;

const stampsPlugin = definePlugin({
  id: "rubber-stamps",
  name: "Rubber stamps",
  description: "Stamps words onto pages.",
  settings: {
    schema: z.object({ word: z.string() }),
    defaults: { word: "Approved" },
  },
  liquid: {
    tags: [
      {
        name: "rubber_stamps_stamp",
        render: async ({ value, options }, { readSettings }) => {
          const { word } = await readSettings();
          const text = typeof value === "string" ? value : word;
          const colour = typeof options.colour === "string" ? options.colour : "red";
          return `<span class="stamp stamp--${escapeHtml(colour)}">${escapeHtml(text)}</span>`;
        },
      },
      {
        name: "rubber_stamps_broken",
        render: () => {
          throw new Error("Out of ink");
        },
      },
    ],
    filters: [
      { name: "rubber_stamps_shout", apply: (value) => `${String(value).toUpperCase()}!` },
      {
        name: "rubber_stamps_bold",
        html: true,
        apply: (value) => `<b>${escapeHtml(String(value))}</b>`,
      },
    ],
  },
  events: {
    "entry.published": (event) => {
      published.push(event.data.entry.title);
    },
  },
  jobs: [
    {
      id: "count",
      name: "Counting",
      everyMinutes: 5,
      run: async () => {
        jobRuns += 1;
      },
    },
  ],
  commands: [
    {
      name: "say",
      description: "Says the stamp's word.",
      run: async ({ arguments: words, readSettings, say }) => {
        say(`${(await readSettings()).word} ${words.join(" ")}`.trim());
      },
    },
    {
      name: "fail",
      description: "Always fails.",
      run: async () => 3,
    },
  ],
  fieldtypes: [
    defineFieldtype({
      type: "rubber-stamps.ink",
      name: "Ink",
      description: "A colour of ink.",
      optionsSchema: z.object({ prefix: z.string().default("#") }),
      buildValueSchema: () => z.string(),
      deliver: (value, options) => ({ hex: `${options.prefix}${String(value)}`, name: "Red" }),
    }),
  ],
});

const sampleEntry = {
  id: "00000000-0000-4000-8000-000000000001",
  collection: "pages",
  slug: "hello",
  title: "Hello",
  url: "/hello",
  status: "published",
  publishedAt: "2026-11-01T09:00:00.000Z",
};

describe("what plugins add beyond routes", () => {
  let lintel: PluginTestServer;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [stampsPlugin] });
  });

  afterAll(() => lintel.close());

  beforeEach(async () => {
    published.length = 0;
    jobRuns = 0;
    await lintel.setEnabledPlugins(["rubber-stamps"]);
  });

  describe("Liquid", () => {
    it("draws a plugin's tag with a value, options and its settings", async () => {
      expect(await lintel.renderLiquid('{% rubber_stamps_stamp "Paid" colour: "blue" %}')).toBe(
        '<span class="stamp stamp--blue">Paid</span>',
      );
      expect(await lintel.renderLiquid("{% rubber_stamps_stamp %}")).toBe(
        '<span class="stamp stamp--red">Approved</span>',
      );
      expect(await lintel.renderLiquid('{% rubber_stamps_stamp colour: "green" %}')).toBe(
        '<span class="stamp stamp--green">Approved</span>',
      );
    });

    it("escapes a filter's result unless it says it gives HTML", async () => {
      expect(await lintel.renderLiquid('{{ "a<b" | rubber_stamps_shout }}')).toBe("A&lt;B!");
      expect(await lintel.renderLiquid('{{ "a<b" | rubber_stamps_bold }}')).toBe("<b>a&lt;b</b>");
    });

    it("leaves a gap rather than an error page when a tag fails", async () => {
      expect(await lintel.renderLiquid("before{% rubber_stamps_broken %}after")).toBe(
        "beforeafter",
      );
    });

    it("draws nothing and hands values back while the plugin is off", async () => {
      await lintel.setEnabledPlugins([]);
      expect(await lintel.renderLiquid("[{% rubber_stamps_stamp %}]")).toBe("[]");
      expect(await lintel.renderLiquid('{{ "quiet" | rubber_stamps_shout }}')).toBe("quiet");
    });
  });

  it("tells a plugin's handlers about events only while it is on", async () => {
    await lintel.server.events.publish("entry.published", { entry: sampleEntry });
    expect(published).toEqual(["Hello"]);

    await lintel.setEnabledPlugins([]);
    await lintel.server.events.publish("entry.published", { entry: sampleEntry });
    expect(published).toEqual(["Hello"]);
  });

  it("runs a plugin's jobs only while it is on", async () => {
    await lintel.runJob("rubber-stamps", "count");
    expect(jobRuns).toBe(1);

    await lintel.setEnabledPlugins([]);
    await lintel.runJob("rubber-stamps", "count");
    expect(jobRuns).toBe(1);
  });

  it("runs a plugin's commands by their full name, with its settings", async () => {
    expect(await lintel.runCommand("rubber-stamps:say", ["twice"])).toEqual({
      exitCode: 0,
      output: ["Approved twice"],
    });
    expect((await lintel.runCommand("rubber-stamps:fail")).exitCode).toBe(3);
    expect(listPluginCommands([stampsPlugin]).map(({ fullName }) => fullName)).toEqual([
      "rubber-stamps:say",
      "rubber-stamps:fail",
    ]);
  });

  it("delivers a plugin fieldtype's values its own way", () => {
    const fields = [
      { handle: "ink", label: "Ink", type: "rubber-stamps.ink", options: {}, required: false },
      { handle: "plain", label: "Plain", type: "text", options: {}, required: false },
    ];
    const delivered = deliverValues(
      fields as Parameters<typeof deliverValues>[0],
      { ink: "ff0000", plain: "words" },
      new Map(),
    );
    expect(delivered).toEqual({ ink: { hex: "#ff0000", name: "Red" }, plain: "words" });
  });
});

describe("checking what plugins add", () => {
  function problemWith(extra: Partial<LintelPlugin>): string | undefined {
    try {
      new PluginCatalogue([], [{ id: "stamps", name: "Stamps", description: "Stamps.", ...extra }]);
      return undefined;
    } catch (error) {
      return error instanceof InvalidPluginError ? error.message : String(error);
    }
  }

  it("wants Liquid names to start with the plugin id", () => {
    expect(problemWith({ liquid: { tags: [{ name: "stamp", render: () => "" }] } })).toContain(
      'should be lowercase and start with "stamps_"',
    );
    expect(
      problemWith({ liquid: { filters: [{ name: "stamps_ok", apply: (value) => value }] } }),
    ).toBeUndefined();
  });

  it("wants jobs to say how often they run, and commands to say what they do", () => {
    expect(
      problemWith({ jobs: [{ id: "tidy", name: "Tidy", everyMinutes: 0, run: async () => {} }] }),
    ).toContain("everyMinutes of 1 or more");
    expect(
      problemWith({ commands: [{ name: "Tidy Up", description: "", run: async () => {} }] }),
    ).toContain('its command "Tidy Up"');
  });
});

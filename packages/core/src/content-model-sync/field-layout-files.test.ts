import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sameUnit, unitKey } from "./content-model.schema.js";
import { ContentModelProblemsError } from "./content-model-sync.errors.js";
import * as contentModel from "./content-model.js";
import { modelFromDefinitions } from "./model-from-definitions.js";
import { newUnitPath, readModelFolder, writeUnitFile } from "./model-files.js";

const { defineContentType, defineFieldset, text, select, group, repeater, fieldset } = contentModel;

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "lintel-layout-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const seo = defineFieldset({
  handle: "seo",
  name: "SEO",
  fields: { meta_title: text({ validation: { maxLength: 60 } }) },
});

const event = defineContentType({
  handle: "event",
  name: "Event",
  fields: {
    title: text(),
    format: select({
      width: 50,
      choices: [
        { value: "online", label: "Online" },
        { value: "venue", label: "At a venue" },
      ],
    }),
    stream_url: text({
      width: 50,
      placeholder: "https://",
      conditions: { rules: [{ field: "format", operator: "is", value: "online" }] },
    }),
    details: contentModel.tab({ label: "Details" }),
    venue: group({
      conditions: { action: "hide", rules: [{ field: "format", operator: "is", value: "online" }] },
      fields: { town: text({ width: 50, default: "Leeds" }) },
    }),
    speakers: repeater({
      addLabel: "Add a speaker",
      fields: {
        name: text(),
        bio: text({ conditions: { rules: [{ field: "$root.format", operator: "isNotEmpty" }] } }),
      },
    }),
    search: fieldset({ fieldset: "seo" }),
  },
});

describe("blueprints as files", () => {
  it("reads widths, tabs, conditions, groups, repeaters and fieldsets into the stored shape", () => {
    const { model } = modelFromDefinitions([
      { source: "fieldsets/seo.ts", definition: seo },
      { source: "content-types/event.ts", definition: event },
    ]);
    const unit = model.get("contentType:event");
    if (unit?.kind !== "contentType") throw new Error("No event content type.");
    const [, format, streamUrl, details, venue, , search] = unit.fields;
    expect(format?.width).toBe(50);
    expect(streamUrl).toMatchObject({
      placeholder: "https://",
      conditions: {
        action: "show",
        match: "all",
        keepHiddenValues: false,
        rules: [{ field: "format", operator: "is", value: "online" }],
      },
    });
    expect(details?.type).toBe("tab");
    expect(venue?.options.fields).toEqual([
      expect.objectContaining({ handle: "town", width: 50, default: "Leeds" }),
    ]);
    // A fieldset field carries a copy of its fieldset's fields.
    expect(search?.options).toEqual({
      fieldset: "seo",
      fields: [expect.objectContaining({ handle: "meta_title", validation: { maxLength: 60 } })],
    });
  });

  it("writes them back as files, in both formats, and reads back the same model", async () => {
    const { model } = modelFromDefinitions([
      { source: "fieldsets/seo.ts", definition: seo },
      { source: "content-types/event.ts", definition: event },
    ]);
    const formats = ["typescript", "yaml"] as const;
    for (const [index, unit] of [...model.values()].entries()) {
      await writeUnitFile(folder, newUnitPath(folder, unit, formats[index % 2] ?? "yaml"), unit);
    }
    const read = await readModelFolder(folder);
    for (const unit of model.values()) {
      expect(sameUnit(unit, read.model.get(unitKey(unit))), unitKey(unit)).toBe(true);
    }
    const written = await readFile(join(folder, "content-types", "event.yaml"), "utf8");
    expect(written).toContain("width: 50");
    expect(written).not.toContain("meta_title");
  });

  it("names conditions on missing fields and fieldsets no file defines", () => {
    const broken = defineContentType({
      handle: "broken",
      name: "Broken",
      fields: {
        title: text(),
        url: text({ conditions: { rules: [{ field: "nowhere", operator: "isEmpty" }] } }),
        search: fieldset({ fieldset: "missing" }),
      },
    });
    try {
      modelFromDefinitions([{ source: "content-types/broken.ts", definition: broken }]);
      throw new Error("It should have refused the file.");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentModelProblemsError);
      expect((error as ContentModelProblemsError).problems).toEqual([
        'content-types/broken.ts: field "search": There is no fieldset with the handle "missing"',
      ]);
    }
  });
});

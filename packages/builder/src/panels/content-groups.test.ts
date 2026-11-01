import { createCountingNodeIds, createNode, standardCatalogue } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import { contentGroupSummary, groupContentFields } from "./content-groups.js";

describe("content groups", () => {
  it("puts a block's fields in groups, with a picture's description beside the picture", () => {
    const hero = standardCatalogue.find("heroBlock");
    const groups = groupContentFields(hero?.editableFields ?? []);
    expect(groups.map((group) => group.id)).toEqual(["words", "link", "picture", "options"]);
    expect(groups[2]?.fields.map((field) => field.prop)).toEqual(["src", "alt"]);
  });

  it("sums up a closed group with what's filled in", () => {
    const node = createNode(
      { type: "heroBlock", props: { heading: "Bread worth getting up for", src: "/bread.png" } },
      standardCatalogue,
      createCountingNodeIds(),
    );
    const groups = groupContentFields(standardCatalogue.find("heroBlock")?.editableFields ?? []);
    const summaries = groups.map((group) => contentGroupSummary(group, node, englishText));
    expect(summaries).toEqual([
      "Bread worth getting up for",
      "/contact",
      "Chosen",
      "This is the page’s main title: on",
    ]);
  });
});

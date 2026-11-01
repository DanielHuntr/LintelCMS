import { describe, expect, it } from "vitest";
import { useLogicalClasses } from "./logical-direction-classes.mjs";
import { mergePluralPairs, replaceCountCalls } from "./plural-messages.mjs";
import { useProductName } from "./product-name.mjs";

describe("the plural codemod", () => {
  it("merges .one and .other strings into one message", () => {
    const before = `  "entries.count.one": "{count} entry",\n  "entries.count.other": "{count} entries",\n`;
    expect(mergePluralPairs(before)).toBe(
      `  "entries.count": "{count, plural, one {# entry} other {# entries}}",\n`,
    );
  });

  it("turns tCount calls into t calls and tidies the import", () => {
    const before = `import { t, tCount } from "../i18n/strings.js";\nconst a = tCount(\n  { one: "x.count.one", other: "x.count.other" },\n  list.items.length,\n);\nconst b = total === 1 ? t("y.one") : t("y.other", { count: total });`;
    expect(replaceCountCalls(before)).toBe(
      `import { t } from "../i18n/strings.js";\nconst a = t("x.count", { count: list.items.length });\nconst b = t("y", { count: total });`,
    );
  });
});

describe("the product name codemod", () => {
  it("swaps Lintel for {product}, except in header names and Branding's own strings", () => {
    const before = `"signIn.title": "Sign in to Lintel",\n"webhooks.secret": "Checks the Lintel-Signature header",\n"branding.reset": "Reset to Lintel defaults",`;
    expect(useProductName(before)).toBe(
      `"signIn.title": "Sign in to {product}",\n"webhooks.secret": "Checks the Lintel-Signature header",\n"branding.reset": "Reset to Lintel defaults",`,
    );
  });
});

describe("the logical classes codemod", () => {
  it("swaps left and right for start and end", () => {
    expect(
      useLogicalClasses(
        `className="ml-2 -mr-1 pl-[264px] left-3 text-left hover:pr-4 rounded-r-full"`,
      ),
    ).toBe(`className="ms-2 -me-1 ps-[264px] inset-s-3 text-start hover:pe-4 rounded-e-full"`);
  });

  it("leaves centring and locale codes alone", () => {
    const source = `className="left-1/2 -translate-x-1/2" locales={["pl-PL"]}`;
    expect(useLogicalClasses(source)).toBe(source);
  });
});

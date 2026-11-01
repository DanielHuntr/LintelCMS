import { afterEach, describe, expect, it } from "vitest";
import { switchInterfaceLanguage } from "./activeLanguage.js";
import { formatMessage, MessageSyntaxError, parseMessage, placeholderNames } from "./icuMessage.js";
import { closestInterfaceLanguage, interfaceLanguages } from "./interfaceLanguages.js";
import { englishMessages, t } from "./strings.js";
import { setProductName } from "./translate.js";

const format = (message: string, values = {}, locale = "en") =>
  formatMessage(parseMessage(message), values, { locale });

afterEach(async () => {
  setProductName("Lintel");
  await switchInterfaceLanguage("en");
});

describe("ICU messages", () => {
  it("fill in placeholders and leave unknown ones as written", () => {
    expect(format("Hello {name}", { name: "Ana" })).toBe("Hello Ana");
    expect(format("?path={url}&token={token}")).toBe("?path={url}&token={token}");
  });

  it("pick plural forms with the language's own rules", () => {
    const message = "{count, plural, =0 {No files} one {# file} other {# files}}";
    expect(format(message, { count: 0 })).toBe("No files");
    expect(format(message, { count: 1 })).toBe("1 file");
    expect(format(message, { count: 1200 })).toBe("1,200 files");
    expect(format(message, { count: 1200 }, "de")).toBe("1.200 files");
    // Polish has a "few" form, which English doesn't.
    const polish = "{count, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}";
    expect(format(polish, { count: 3 }, "pl")).toBe("3 pliki");
    expect(format(polish, { count: 5 }, "pl")).toBe("5 plików");
  });

  it("supports select, ordinals, numbers, dates and quoting", () => {
    expect(format("{role, select, admin {Admins} other {Everyone}}", { role: "admin" })).toBe(
      "Admins",
    );
    expect(
      format("{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", { place: 22 }),
    ).toBe("22nd");
    expect(format("{total, number}", { total: 12345.5 })).toBe("12,345.5");
    expect(format("{when, date, long}", { when: new Date("2026-11-01T12:00:00Z") })).toBe(
      "November 1, 2026",
    );
    expect(format("Type '{'name'}' and it''s literal")).toBe("Type {name} and it's literal");
  });

  it("explain a mistake in a message", () => {
    expect(() => parseMessage("{count, plural, one {# file}}")).toThrow(MessageSyntaxError);
    expect(() => parseMessage("Unclosed {name")).toThrow(MessageSyntaxError);
  });

  it("can all be read, every English string included", () => {
    for (const [key, message] of Object.entries(englishMessages)) {
      expect(() => parseMessage(message), key).not.toThrow();
    }
  });

  it("list their placeholders, for checking translations", () => {
    expect([...placeholderNames(parseMessage("{count, plural, other {# in {place}}}"))]).toEqual([
      "count",
      "place",
    ]);
  });
});

describe("t()", () => {
  it("uses the branded product name", () => {
    expect(t("signIn.title")).toBe("Sign in to Lintel");
    setProductName("Acme Studio");
    expect(t("signIn.title")).toBe("Sign in to Acme Studio");
  });

  it("does plurals without separate keys", () => {
    expect(t("entries.count", { count: 1 })).toBe("1 entry");
    expect(t("entries.count", { count: 3 })).toBe("3 entries");
  });

  it("disguises words in the accented pseudo-language, but not the values put in", async () => {
    await switchInterfaceLanguage("en-XA");
    const text = t("search.noResults", { query: "cats" });
    expect(text.startsWith("[")).toBe(true);
    expect(text.endsWith("]")).toBe(true);
    expect(text).toContain("cats");
    expect(text).toContain("Ñöţĥîñĝ");
    expect(document.documentElement.lang).toBe("en-XA");
  });

  it("mirrors the page in the right-to-left pseudo-language", async () => {
    await switchInterfaceLanguage("ar-XB");
    expect(document.documentElement.dir).toBe("rtl");
    expect(t("nav.media")).toBe("‮Media‬");
    await switchInterfaceLanguage("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});

describe("choosing a language", () => {
  it("falls back to the closest one the admin speaks", () => {
    expect(closestInterfaceLanguage("EN-gb").code).toBe("en");
    expect(closestInterfaceLanguage("fr-CA").code).toBe("en");
    expect(closestInterfaceLanguage(null).code).toBe("en");
    expect(closestInterfaceLanguage("ar-XB").direction).toBe("rtl");
  });

  it("lists English first, as the source", () => {
    expect(interfaceLanguages[0]?.code).toBe("en");
  });
});

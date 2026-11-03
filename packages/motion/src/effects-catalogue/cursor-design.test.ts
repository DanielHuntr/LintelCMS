import { describe, expect, it } from "vitest";
import {
  cursorColourCss,
  cursorIsOn,
  cursorPictureAddress,
  cursorWordCss,
  cursorWordVariables,
  defaultCursorPicture,
  defaultCursorWordLook,
} from "../effects/kit/cursor-look.js";
import { effectRegistry } from "./effect-registry.js";
import { cleanProps } from "./effect-definition.js";
import { cursorOverEffectId, cursorWordEffectId } from "./catalogue/cursor-effects.js";
import { siteEffectSettingsSchema } from "./site-effects.js";

describe("cursor settings saved before the cursor could be designed", () => {
  it("read as the standard word look and no picture", () => {
    const older = siteEffectSettingsSchema.parse({
      cursor: { style: "ring", trail: "dots", colour: "brand", size: 40 },
    });
    expect(older.cursor).toEqual({
      style: "ring",
      trail: "dots",
      colour: "brand",
      size: 40,
      word: defaultCursorWordLook,
      picture: defaultCursorPicture,
    });
    // ...which write no extra CSS, so the page looks exactly as it did.
    expect(cursorWordCss(older.cursor.word)).toBe("");
  });

  it("start with no cursor at all", () => {
    const fresh = siteEffectSettingsSchema.parse({});
    expect(fresh.cursor.style).toBe("none");
    expect(fresh.cursor.picture).toEqual({
      assetId: "",
      src: "",
      size: 32,
      point: "centre",
      bytes: 0,
    });
  });
});

describe("the cursor's settings", () => {
  it("take the site's colours, a hex colour or automatic for the word", () => {
    const parsed = siteEffectSettingsSchema.parse({
      cursor: {
        style: "dot",
        word: {
          background: "var(--lintel-color-brand)",
          colour: "#ffffff",
          size: "large",
          shape: "circle",
        },
      },
    });
    expect(parsed.cursor.word).toEqual({
      background: "var(--lintel-color-brand)",
      colour: "#ffffff",
      size: "large",
      shape: "circle",
    });
    for (const background of ["red; background:url(x)", "expression(1)", "var(--a);x:y"]) {
      expect(siteEffectSettingsSchema.safeParse({ cursor: { word: { background } } }).success).toBe(
        false,
      );
    }
  });

  it("refuse script addresses for the picture, and keep it small", () => {
    for (const src of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "vbscript:x"]) {
      expect(
        siteEffectSettingsSchema.safeParse({ cursor: { style: "picture", picture: { src } } })
          .success,
      ).toBe(false);
    }
    expect(
      siteEffectSettingsSchema.safeParse({ cursor: { picture: { src: "/a.png", size: 400 } } })
        .success,
    ).toBe(false);
  });

  it("count a picture cursor as on only once it has a picture", () => {
    expect(cursorIsOn({ style: "picture", picture: { ...defaultCursorPicture } })).toBe(false);
    expect(
      cursorIsOn({ style: "picture", picture: { ...defaultCursorPicture, src: "/a.svg" } }),
    ).toBe(true);
    expect(cursorIsOn({ style: "ring" })).toBe(true);
    expect(cursorIsOn({ style: "none" })).toBe(false);
  });
});

describe("the cursor picture's address", () => {
  it("asks the media library for a copy at the size it's shown", () => {
    expect(cursorPictureAddress("https://cms.test/api/media/abc/file?v=12", 32)).toBe(
      "https://cms.test/api/media/abc/file?v=12&w=64&format=png",
    );
    expect(cursorPictureAddress("/media/abc/file", 40, 1)).toBe("/media/abc/file?w=40&format=png");
  });

  it("uses other web addresses as they are, and refuses scripts", () => {
    expect(cursorPictureAddress("https://example.com/arrow.svg", 32)).toBe(
      "https://example.com/arrow.svg",
    );
    expect(cursorPictureAddress("javascript:alert(1)", 32)).toBe("");
  });
});

describe("the word's look as CSS", () => {
  it("gives the theme's partner colour for the letters when they're automatic", () => {
    expect(
      cursorWordVariables({ background: "var(--lintel-color-brand)", colour: "auto" }),
    ).toEqual({
      "--lintel-cursor-word-background": "var(--lintel-color-brand, #111111)",
      "--lintel-cursor-word-colour": "var(--lintel-color-on-brand, #ffffff)",
    });
    expect(cursorWordVariables({ background: "#fafafa" })["--lintel-cursor-word-colour"]).toBe(
      "#111111",
    );
    // The site's own colour: the page works out the letters, where the colour is known.
    expect(cursorWordVariables({ background: "var(--site-sand)" })).toEqual({
      "--lintel-cursor-word-background": "var(--site-sand)",
    });
  });

  it("writes only what changed", () => {
    expect(cursorWordCss({ ...defaultCursorWordLook, shape: "square" })).toBe(
      ":root{--lintel-cursor-word-radius:var(--lintel-radius-small, 6px);--lintel-cursor-word-ratio:auto}",
    );
    expect(cursorColourCss("auto")).toBeUndefined();
    expect(cursorColourCss("}body{")).toBeUndefined();
  });
});

describe("what the pointer does over an element", () => {
  it("keeps an element's own word look, and drops anything unknown", () => {
    const definition = effectRegistry.find(cursorWordEffectId)!;
    expect(
      cleanProps(definition, {
        text: "View",
        background: "var(--lintel-color-accent)",
        shape: "blob",
      }),
    ).toEqual({
      text: "View",
      background: "var(--lintel-color-accent)",
      colour: "",
      size: "",
      shape: "",
    });
  });

  it("offers grow, a different picture, hide and the normal pointer", () => {
    const definition = effectRegistry.find(cursorOverEffectId)!;
    expect(definition.listed).toBe(false);
    expect(cleanProps(definition, { mode: "picture", src: "/hand.svg", size: 500 })).toMatchObject({
      mode: "picture",
      src: "/hand.svg",
      size: 96,
      point: "centre",
    });
    expect(cleanProps(definition, { mode: "explode" }).mode).toBe("grow");
  });
});

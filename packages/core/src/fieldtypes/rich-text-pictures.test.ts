import { pageLinkHref } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { InvalidFieldsError } from "../http/http-errors.js";
import { buildEntryDataValidator } from "./entry-data-validator.js";
import { type FieldDefinition, fieldDefinitionSchema } from "./field-definition.schema.js";
import type { DeliveredAsset } from "./image-assets.js";
import {
  renderRichTextHtml,
  type RichTextDocument,
  type RichTextLookups,
  resolveRichText,
} from "./rich-text.js";

const ABOUT_ID = "0b9d2c1e-5f3a-4c6b-8d7e-1a2b3c4d5e6f";
const GONE_ID = "9f8e7d6c-5b4a-4321-8765-0fedcba98765";
const PHOTO_ID = "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f";
const MISSING_PHOTO_ID = "11111111-2222-4333-8444-555555555555";

const photo: DeliveredAsset = {
  id: PHOTO_ID,
  url: "https://cms.example.com/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file",
  alt: "The library's own words",
  width: 1600,
  height: 900,
  focalPoint: null,
};

const lookups: RichTextLookups = {
  pageAddress: (entryId) => (entryId === ABOUT_ID ? "/about-us" : null),
  picture: (assetId) => (assetId === PHOTO_ID ? photo : null),
};

function paragraph(...content: object[]) {
  return { type: "paragraph", content };
}

function linked(text: string, href: string) {
  return { type: "text", text, marks: [{ type: "link", attrs: { href } }] };
}

function picture(attrs: Record<string, unknown>) {
  return { type: "image", attrs };
}

function doc(...content: object[]): RichTextDocument {
  return { type: "doc", content };
}

describe("links to pages in rich text", () => {
  it("draws a link to a page with the page's address now", () => {
    const document = doc(paragraph(linked("Meet us", pageLinkHref(ABOUT_ID))));
    expect(renderRichTextHtml(document, lookups)).toBe(
      '<p><a target="_blank" rel="noopener noreferrer nofollow" href="/about-us">Meet us</a></p>',
    );
    expect(renderRichTextHtml(document, { ...lookups, pageAddress: () => "/our-story" })).toContain(
      'href="/our-story"',
    );
  });

  it("draws a link to a page that is gone as plain words", () => {
    const document = doc(
      paragraph({ type: "text", text: "See " }, linked("old", pageLinkHref(GONE_ID))),
    );
    expect(renderRichTextHtml(document, lookups)).toBe("<p>See old</p>");
  });

  it("leaves typed addresses and old /about links as they were", () => {
    const document = doc(
      paragraph(linked("About", "/about"), linked("Elsewhere", "https://example.com")),
    );
    const html = renderRichTextHtml(document, lookups);
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="https://example.com"');
  });

  it("gives headless sites the address in the JSON, with the page's id beside it", () => {
    const document = doc(
      paragraph(linked("Meet us", pageLinkHref(ABOUT_ID)), linked("old", pageLinkHref(GONE_ID))),
    );
    expect(resolveRichText(document, lookups).content?.[0]?.content).toEqual([
      {
        type: "text",
        text: "Meet us",
        marks: [{ type: "link", attrs: { href: "/about-us", entryId: ABOUT_ID } }],
      },
      { type: "text", text: "old", marks: [] },
    ]);
    // The stored document is untouched.
    expect(document.content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(
      pageLinkHref(ABOUT_ID),
    );
  });
});

describe("pictures in rich text", () => {
  it("draws a responsive figure with its own description and caption", () => {
    const html = renderRichTextHtml(
      doc(
        paragraph({ type: "text", text: "Before" }),
        picture({
          assetId: PHOTO_ID,
          alt: "Our shop front",
          caption: "Open <daily>",
          align: "full",
        }),
        paragraph({ type: "text", text: "After" }),
      ),
      lookups,
    );
    expect(html).toMatch(
      /^<p>Before<\/p><figure class="lintel-picture lintel-picture--full"><img [^>]*alt="Our shop front"[^>]*\/?><figcaption>Open &lt;daily&gt;<\/figcaption><\/figure><p>After<\/p>$/,
    );
    expect(html).toContain("srcset=");
    expect(html).toContain('sizes="(max-width: 48rem) 100vw, 48rem"');
  });

  it("floats a picture beside the text when asked, at a smaller size", () => {
    const html = renderRichTextHtml(
      doc(picture({ assetId: PHOTO_ID, alt: "A", align: "left" })),
      lookups,
    );
    expect(html).toContain('<figure class="lintel-picture lintel-picture--left">');
    expect(html).toContain('sizes="(max-width: 40rem) 100vw, 20rem"');
    expect(html).not.toContain("figcaption");
  });

  it("leaves out a picture whose image has left the media library", () => {
    const html = renderRichTextHtml(
      doc(
        picture({ assetId: MISSING_PHOTO_ID, alt: "Gone" }),
        picture({ assetId: PHOTO_ID, alt: "Here" }),
      ),
      lookups,
    );
    expect(html.match(/<figure/g)).toHaveLength(1);
    expect(html).toContain('alt="Here"');
  });

  it("can't be faked by typing the placeholder", () => {
    const html = renderRichTextHtml(
      doc(paragraph({ type: "text", text: "<lintel-picture></lintel-picture>" })),
      lookups,
    );
    expect(html).toBe("<p>&lt;lintel-picture&gt;&lt;/lintel-picture&gt;</p>");
  });

  it("delivers each picture's image in the JSON, as image fields are", () => {
    const resolved = resolveRichText(
      doc(picture({ assetId: PHOTO_ID, alt: "A", caption: "", align: "right" })),
      lookups,
    );
    expect(resolved.content?.[0]).toEqual({
      type: "image",
      attrs: { assetId: PHOTO_ID, alt: "A", caption: "", align: "right", image: photo },
    });
  });
});

describe("saving rich text with pictures", () => {
  const fields = [
    fieldDefinitionSchema.parse({
      handle: "body",
      label: "Body",
      type: "richText",
    }) as FieldDefinition,
  ];

  async function messagesFor(body: unknown, inLibrary: readonly string[] = [PHOTO_ID]) {
    try {
      await buildEntryDataValidator(fields, {
        assetExists: async (assetId) => inLibrary.includes(assetId),
      })({ body });
      return {};
    } catch (error) {
      if (error instanceof InvalidFieldsError) return error.fields;
      throw error;
    }
  }

  it("accepts a picture from the media library, with a link to a page beside it", async () => {
    expect(
      await messagesFor(
        doc(
          picture({ assetId: PHOTO_ID, alt: "Shop", caption: "Hello", align: "left" }),
          paragraph(linked("About", pageLinkHref(ABOUT_ID))),
        ),
      ),
    ).toEqual({});
  });

  it("refuses a picture that isn't in the media library", async () => {
    expect(await messagesFor(doc(picture({ assetId: MISSING_PHOTO_ID, alt: "" })))).toEqual({
      body: "A picture in Body is no longer in the media library",
    });
  });

  it("refuses pictures without an image, or with settings the editor can't make", async () => {
    expect(await messagesFor(doc(picture({ alt: "No image" })))).toEqual({
      body: "Body: Each picture needs an image from the media library",
    });
    expect(await messagesFor(doc(picture({ assetId: PHOTO_ID, align: "centre" })))).toEqual({
      body: "Body: A picture can be full width, or on the left or right of the text",
    });
    expect(
      await messagesFor(doc(picture({ assetId: PHOTO_ID, caption: "x".repeat(501) }))),
    ).toEqual({
      body: "Body: A picture's caption can be at most 500 characters",
    });
  });
});

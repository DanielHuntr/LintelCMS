import { describe, expect, it } from "vitest";
import { readRuntimeSettings } from "./runtime-settings.js";

function pageWithSettings(content: string | undefined): Pick<Document, "querySelector"> {
  const page = document.implementation.createHTMLDocument("Lintel");
  if (content !== undefined) {
    const meta = page.createElement("meta");
    meta.name = "lintel-admin";
    meta.content = content;
    page.head.append(meta);
  }
  return page;
}

describe("readRuntimeSettings", () => {
  it("uses the local API at the root in development", () => {
    expect(
      readRuntimeSettings(pageWithSettings(undefined), "http://localhost:5173", undefined),
    ).toEqual({
      basePath: "/",
      apiUrl: "http://localhost:4000",
    });
  });

  it("uses the address and path the production server gives", () => {
    const page = pageWithSettings(JSON.stringify({ basePath: "/cms", apiUrl: "/api" }));

    expect(readRuntimeSettings(page, "https://example.com", undefined)).toEqual({
      basePath: "/cms",
      apiUrl: "https://example.com/api",
    });
  });

  it("keeps a full API address as it is", () => {
    const page = pageWithSettings(
      JSON.stringify({ basePath: "/admin", apiUrl: "https://api.example.com/" }),
    );

    expect(readRuntimeSettings(page, "https://example.com", undefined).apiUrl).toBe(
      "https://api.example.com",
    );
  });

  it("falls back to the build's settings when the tag can't be read", () => {
    const settings = readRuntimeSettings(
      pageWithSettings("not json"),
      "https://example.com",
      "https://cms.example.com",
    );

    expect(settings).toEqual({ basePath: "/", apiUrl: "https://cms.example.com" });
  });
});

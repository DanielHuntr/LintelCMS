import { describe, expect, it } from "vitest";
import { parseReleaseFeed, readReleaseNotes, UpdateFeedFormatError } from "./update-feed.js";

function githubRelease(overrides: Record<string, unknown>) {
  return {
    tag_name: "v1.1.0",
    name: "Lintel 1.1.0",
    body: "Faster image uploads and a tidier media library.",
    draft: false,
    prerelease: false,
    published_at: "2026-11-01T09:00:00Z",
    html_url: "https://github.com/DanielHuntr/LintelCMS/releases/tag/v1.1.0",
    assets: [
      {
        name: "SHA256SUMS",
        browser_download_url: "https://example.test/SHA256SUMS",
        size: 120,
      },
    ],
    ...overrides,
  };
}

describe("the update feed", () => {
  it("reads GitHub releases into versions, newest first, with betas from pre-releases", () => {
    const releases = parseReleaseFeed([
      githubRelease({}),
      githubRelease({ tag_name: "v1.2.0-beta.1", name: "1.2 beta", prerelease: true }),
      githubRelease({ tag_name: "v1.0.1" }),
      githubRelease({ tag_name: "v9.9.9", draft: true }),
      githubRelease({ tag_name: "nightly" }),
      { not: "a release" },
    ]);

    expect(releases.map((release) => [release.version, release.channel])).toEqual([
      ["1.2.0-beta.1", "beta"],
      ["1.1.0", "stable"],
      ["1.0.1", "stable"],
    ]);
    expect(releases[1]).toMatchObject({
      name: "Lintel 1.1.0",
      summary: "Faster image uploads and a tidier media library.",
      security: false,
      breaking: false,
      minimumVersion: null,
      pageUrl: "https://github.com/DanielHuntr/LintelCMS/releases/tag/v1.1.0",
      assets: [{ name: "SHA256SUMS", url: "https://example.test/SHA256SUMS", size: 120 }],
    });
  });

  it("finds the security, breaking change and minimum version markers, and hides them", () => {
    const [release] = parseReleaseFeed([
      githubRelease({
        body: [
          "Security: yes",
          "Minimum version: v1.0.0",
          "",
          "Fixes a problem with **password reset** links.",
          "",
          "## Breaking changes",
          "",
          "- The `/old` endpoint is gone.",
        ].join("\n"),
      }),
    ]);

    expect(release).toMatchObject({
      security: true,
      breaking: true,
      minimumVersion: "1.0.0",
      summary: "Fixes a problem with password reset links.",
    });
    expect(release?.notesHtml).toContain("<strong>password reset</strong>");
    expect(release?.notesHtml).not.toContain("Minimum version");
  });

  it("calls a release a security release when its name says so", () => {
    expect(readReleaseNotes("Small fixes.", "Lintel 1.0.2 (security)").security).toBe(true);
    expect(readReleaseNotes("## Security\n\nA fix.", "Lintel 1.0.2").security).toBe(true);
    expect(readReleaseNotes("Security: no", "Lintel 1.0.2").security).toBe(false);
  });

  it("turns the notes' Markdown into HTML that can't run anything", () => {
    const notes = readReleaseNotes(
      '<script>alert("hi")</script>\n\n[click](javascript:alert(1)) <img src=x onerror=alert(1)>',
      "Lintel 1.1.0",
    );
    expect(notes.html).not.toContain("<script");
    expect(notes.html).not.toContain("<img");
    expect(notes.html).not.toContain('href="javascript:');
  });

  it("reads an agency's own feed in Lintel's format", () => {
    const releases = parseReleaseFeed({
      releases: [
        {
          version: "1.3.0",
          notes: "Our build of 1.3.0.",
          security: true,
          minimumVersion: "1.1.0",
          assets: [{ name: "SHA256SUMS", url: "https://updates.agency.test/SHA256SUMS" }],
        },
        { version: "not a version" },
      ],
    });
    expect(releases).toEqual([
      expect.objectContaining({
        version: "1.3.0",
        name: "Lintel 1.3.0",
        channel: "stable",
        security: true,
        minimumVersion: "1.1.0",
        assets: [{ name: "SHA256SUMS", url: "https://updates.agency.test/SHA256SUMS", size: null }],
      }),
    ]);
  });

  it("says plainly when the feed isn't a list of releases", () => {
    expect(() => parseReleaseFeed({ message: "Not Found" })).toThrow(UpdateFeedFormatError);
  });
});

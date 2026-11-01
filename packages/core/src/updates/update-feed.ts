import { z } from "zod";
import { renderMarkdownHtml } from "../fieldtypes/markdown.js";
import { isPrerelease, isVersion, normaliseVersion, sortNewestFirst } from "./semantic-version.js";
import type { AvailableRelease, ReleaseAsset } from "./updates.schema.js";

/**
 * Reading the update feed. Two shapes are understood:
 *
 * - GitHub's releases API (`GET /repos/<owner>/<repo>/releases`), the default feed. The tag is
 *   the version, "pre-release" means the beta channel, and the notes are the release's
 *   Markdown body.
 * - A Lintel feed, `{ "releases": [...] }`, for agencies who host their own (UPDATE_FEED_URL),
 *   with the same fields spelled out (see the "Releases and the update feed" guide).
 *
 * In GitHub's notes, a few lines anywhere in the body say what the release is:
 *
 *   Security: yes                 also: "security" in the release's name, or a "## Security" heading
 *   Breaking: yes                 also: a "## Breaking changes" heading
 *   Minimum version: 1.1.0        the oldest version that may update straight to this one
 *
 * Those lines are taken out of the notes people read. Drafts, and tags that aren't version
 * numbers, are skipped.
 */

export const DEFAULT_UPDATE_FEED_URL =
  "https://api.github.com/repos/DanielHuntr/LintelCMS/releases";

const githubReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  published_at: z.string().nullable().optional(),
  html_url: z.string().optional(),
  assets: z
    .array(
      z.object({
        name: z.string(),
        browser_download_url: z.string(),
        size: z.number().optional(),
      }),
    )
    .optional(),
});

const lintelFeedReleaseSchema = z.object({
  version: z.string(),
  name: z.string().optional(),
  channel: z.enum(["stable", "beta"]).optional(),
  publishedAt: z.string().nullable().optional(),
  notes: z.string().optional(),
  security: z.boolean().optional(),
  breaking: z.boolean().optional(),
  minimumVersion: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(),
  assets: z
    .array(z.object({ name: z.string(), url: z.string(), size: z.number().optional() }))
    .optional(),
});

const lintelFeedSchema = z.object({ releases: z.array(z.unknown()) });

export class UpdateFeedFormatError extends Error {
  constructor() {
    super(
      "The update feed answered with something that isn't a list of releases. Check " +
        "UPDATE_FEED_URL, or leave it out to use Lintel's own releases.",
    );
    this.name = "UpdateFeedFormatError";
  }
}

/** Every release in the feed, newest first. Entries that can't be read are skipped. */
export function parseReleaseFeed(body: unknown): AvailableRelease[] {
  const releases = Array.isArray(body)
    ? body.flatMap((item) => {
        const parsed = githubReleaseSchema.safeParse(item);
        return parsed.success ? releaseFromGithub(parsed.data) : [];
      })
    : lintelFeedReleases(body);
  return sortNewestFirst(releases, (release) => release.version);
}

function lintelFeedReleases(body: unknown): AvailableRelease[] {
  const feed = lintelFeedSchema.safeParse(body);
  if (!feed.success) {
    throw new UpdateFeedFormatError();
  }
  return feed.data.releases.flatMap((item) => {
    const parsed = lintelFeedReleaseSchema.safeParse(item);
    if (!parsed.success || !isVersion(parsed.data.version)) {
      return [];
    }
    const release = parsed.data;
    const version = normaliseVersion(release.version);
    const notes = readReleaseNotes(release.notes ?? "", release.name ?? "");
    return [
      {
        version,
        name: release.name ?? `Lintel ${version}`,
        channel: release.channel ?? (isPrerelease(version) ? "beta" : "stable"),
        publishedAt: release.publishedAt ?? null,
        notesHtml: notes.html,
        summary: notes.summary,
        security: release.security ?? notes.security,
        breaking: release.breaking ?? notes.breaking,
        minimumVersion: validVersionOrNull(release.minimumVersion ?? notes.minimumVersion),
        pageUrl: release.pageUrl ?? null,
        assets: (release.assets ?? []).map((asset) => ({
          name: asset.name,
          url: asset.url,
          size: asset.size ?? null,
        })),
      },
    ];
  });
}

function releaseFromGithub(release: z.infer<typeof githubReleaseSchema>): AvailableRelease[] {
  if (release.draft || !isVersion(release.tag_name)) {
    return [];
  }
  const version = normaliseVersion(release.tag_name);
  const name = release.name?.trim() || `Lintel ${version}`;
  const notes = readReleaseNotes(release.body ?? "", name);
  const assets: ReleaseAsset[] = (release.assets ?? []).map((asset) => ({
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size ?? null,
  }));
  return [
    {
      version,
      name,
      // A pre-release tag (1.2.0-rc.1) is a beta even if it wasn't ticked as one.
      channel: release.prerelease || isPrerelease(version) ? "beta" : "stable",
      publishedAt: release.published_at ?? null,
      notesHtml: notes.html,
      summary: notes.summary,
      security: notes.security,
      breaking: notes.breaking,
      minimumVersion: validVersionOrNull(notes.minimumVersion),
      pageUrl: release.html_url ?? null,
      assets,
    },
  ];
}

interface ReleaseNotes {
  html: string;
  summary: string;
  security: boolean;
  breaking: boolean;
  minimumVersion: string | null;
}

const MARKER_LINE = /^\s*(security|breaking|minimum version)\s*:\s*(.+?)\s*$/i;
const YES = /^(yes|true)$/i;

/** The notes' marker lines, the notes without them as safe HTML, and a plain summary. */
export function readReleaseNotes(markdown: string, releaseName: string): ReleaseNotes {
  let security = /\bsecurity\b/i.test(releaseName);
  let breaking = false;
  let minimumVersion: string | null = null;
  const kept: string[] = [];

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const marker = MARKER_LINE.exec(line);
    if (!marker) {
      kept.push(line);
      if (/^#{1,6}\s+security\b/i.test(line)) security = true;
      if (/^#{1,6}\s+breaking\b/i.test(line)) breaking = true;
      continue;
    }
    const [, field = "", value = ""] = marker;
    const key = field.toLowerCase();
    if (key === "security") security = YES.test(value);
    else if (key === "breaking") breaking = YES.test(value);
    else minimumVersion = value;
  }

  const notes = kept.join("\n").trim();
  return {
    html: renderMarkdownHtml(notes),
    summary: firstParagraph(notes),
    security,
    breaking,
    minimumVersion,
  };
}

/** The first paragraph that isn't a heading, as plain text, at most 280 characters. */
function firstParagraph(markdown: string): string {
  const paragraph =
    markdown
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .find((block) => block.length > 0 && !block.startsWith("#")) ?? "";
  const plain = paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[`*_>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 280 ? `${plain.slice(0, 277).trimEnd()}…` : plain;
}

function validVersionOrNull(text: string | null): string | null {
  return text && isVersion(text) ? normaliseVersion(text) : null;
}

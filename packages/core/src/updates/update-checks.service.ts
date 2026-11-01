import type { DatabaseOrTransaction } from "../database/client.js";
import type { EmailSender } from "../email/index.js";
import { findActiveOwnerIds } from "../roles/roles.service.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { findUserById } from "../users/users.repository.js";
import { findPluginUpdates } from "./plugin-updates.js";
import { compareVersions, isNewerVersion, isPrerelease } from "./semantic-version.js";
import { parseReleaseFeed, UpdateFeedFormatError } from "./update-feed.js";
import type {
  AvailableRelease,
  ReleaseChannel,
  UpdateCheck,
  UpdatePreferences,
} from "./updates.schema.js";

/**
 * Looking for new versions: once a day from the scheduler, and when someone presses "Check
 * now". A check is one GET of the feed and one per installed npm plugin; nothing about the
 * site is sent (the only header is a plain User-Agent, which GitHub requires). What it finds
 * is kept in settings, and owners get one email about each new security release.
 */
export interface UpdateChecksContext {
  database: DatabaseOrTransaction;
  fetch: typeof fetch;
  feedUrl: string;
  currentVersion: string;
  /** Where lintel.config.ts and node_modules are, for plugin updates. */
  installFolder: string;
  email: EmailSender;
  /** The admin's address, for the link in emails. */
  adminUrl: string;
  log: { warn(details: object, message: string): void };
}

export const DAILY = 24 * 60 * 60 * 1000;

export async function checkForUpdates(
  context: UpdateChecksContext,
  now = new Date(),
): Promise<UpdateCheck> {
  const previous = await readSetting(context.database, "updateCheck");
  let releases = previous.releases;
  let problem: string | null = null;
  try {
    releases = (await fetchReleases(context)).filter((release) =>
      isNewerVersion(release.version, context.currentVersion),
    );
  } catch (error) {
    problem = describeCheckProblem(error);
    context.log.warn({ error: problem }, "Looking for Lintel updates didn't work");
  }
  const plugins = await findPluginUpdates(context.fetch, context.installFolder).catch(
    () => previous.plugins,
  );

  const check: UpdateCheck = {
    checkedAt: now.toISOString(),
    releases,
    plugins,
    problem,
    emailedSecurityVersions: previous.emailedSecurityVersions,
  };
  check.emailedSecurityVersions = await emailOwnersAboutSecurityReleases(context, check);
  await writeSetting(context.database, "updateCheck", check);
  return check;
}

/** Checks unless one was made in the last day; for the scheduler, so restarts don't add more. */
export async function checkForUpdatesIfDue(
  context: UpdateChecksContext,
  now = new Date(),
): Promise<boolean> {
  const { checkedAt } = await readSetting(context.database, "updateCheck");
  if (checkedAt && now.getTime() - new Date(checkedAt).getTime() < DAILY) {
    return false;
  }
  await checkForUpdates(context, now);
  return true;
}

async function fetchReleases(context: UpdateChecksContext): Promise<AvailableRelease[]> {
  const response = await context.fetch(context.feedUrl, {
    headers: { Accept: "application/vnd.github+json, application/json", "User-Agent": "Lintel" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`The update feed answered ${response.status}`);
  }
  return parseReleaseFeed(await response.json());
}

function describeCheckProblem(error: unknown): string {
  if (error instanceof UpdateFeedFormatError) {
    return error.message;
  }
  const reason = error instanceof Error ? error.message : String(error);
  return `Lintel couldn't reach the update feed (${reason}). It will try again tomorrow.`;
}

/**
 * The releases Settings → Updates lists for this channel, newest first. On "stable", betas
 * only show while a beta or release candidate is already running, so people testing one
 * hear about the next.
 */
export function releasesForChannel(
  releases: readonly AvailableRelease[],
  channel: ReleaseChannel,
  currentVersion: string,
): AvailableRelease[] {
  const showBetas = channel === "beta" || isPrerelease(currentVersion);
  return releases.filter((release) => release.channel === "stable" || showBetas);
}

/**
 * The version the Update button installs: the newest that can be reached straight from the
 * running one (a release may need an older update first, its `minimumVersion`).
 */
export function recommendedRelease(
  releases: readonly AvailableRelease[],
  currentVersion: string,
): AvailableRelease | null {
  return (
    releases.find(
      (release) =>
        release.minimumVersion === null ||
        compareVersions(currentVersion, release.minimumVersion) >= 0,
    ) ?? null
  );
}

export interface UpdateSummary {
  /** Lintel versions and plugin updates together, as the badge counts them. */
  count: number;
  securityCount: number;
}

export function summariseUpdates(
  check: UpdateCheck,
  preferences: UpdatePreferences,
  currentVersion: string,
): UpdateSummary {
  const releases = releasesForChannel(check.releases, preferences.channel, currentVersion);
  return {
    count: releases.length + check.plugins.length,
    securityCount: releases.filter((release) => release.security).length,
  };
}

async function emailOwnersAboutSecurityReleases(
  context: UpdateChecksContext,
  check: UpdateCheck,
): Promise<string[]> {
  const emailed = new Set(check.emailedSecurityVersions);
  const news = check.releases.filter(
    (release) => release.security && !emailed.has(release.version),
  );
  if (news.length === 0) {
    return [...emailed];
  }
  const owners = await Promise.all(
    (await findActiveOwnerIds(context.database)).map((id) => findUserById(context.database, id)),
  );
  for (const owner of owners) {
    if (!owner) continue;
    try {
      await context.email.send({
        to: owner.email,
        subject: `Security update for Lintel: ${news.map((release) => release.version).join(", ")}`,
        text: securityEmailText(owner.name, news, context),
      });
    } catch (error) {
      context.log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Emailing an owner about a security update didn't work",
      );
    }
  }
  for (const release of news) emailed.add(release.version);
  return [...emailed];
}

function securityEmailText(
  name: string,
  releases: readonly AvailableRelease[],
  context: UpdateChecksContext,
): string {
  const lines = releases.flatMap((release) => [
    `Lintel ${release.version}${release.summary ? `: ${release.summary}` : ""}`,
    "",
  ]);
  return [
    `Hello ${name},`,
    "",
    `A security update for Lintel is out. Your site runs Lintel ${context.currentVersion}.`,
    "",
    ...lines,
    `Update in Settings → Updates: ${context.adminUrl}/settings/updates`,
    "",
    "A backup is made before anything changes, and Lintel goes back by itself if the update doesn't work.",
    "",
    "You get this email because you are an owner of this site.",
  ].join("\n");
}

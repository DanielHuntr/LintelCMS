/**
 * The Lintel release these docs describe. Shown beside the site title, and compared with
 * the `since` of each page (see src/components/PageTitle.astro). Bump it when a release
 * ships, and give pages written for the new release `since: "<version>"`.
 */
export const docsVersion = "0.1";

/**
 * What a page's `since` may say: a release, "0.6", or a release candidate, "1.0.0-rc", for
 * what is in a release candidate before that release is out.
 */
export const SINCE_PATTERN = /^\d+\.\d+(\.0-rc)?$/;

/** "1.0.0-rc" as "the 1.0 release candidate"; a release as it is: "0.6". */
export function describeVersion(since: string): string {
  const candidate = /^(\d+\.\d+)\.0-rc$/.exec(since);
  return candidate ? `the ${candidate[1]} release candidate` : since;
}

/** The label beside a page's title: "Since 0.6", "New in 0.1", "Since the 1.0 release candidate". */
export function describeSince(since: string, currentVersion: string = docsVersion): string {
  return `${since === currentVersion ? "New in" : "Since"} ${describeVersion(since)}`;
}

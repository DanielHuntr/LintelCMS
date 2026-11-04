import { personalColumnsOf } from "../privacy/personal-data-declaration.js";
import type { AddonPackage } from "./addon-package.js";

/**
 * What `lintel addons add` prints once a package is installed: what it says it keeps and
 * does, in the same order as Build → Add-ons, so whoever installs it knows before it runs.
 * Lintel checks it against what it finds once it is running (see addon-details.service.ts).
 */
export function describeAddonForReview(addonPackage: AddonPackage): string[] {
  const { manifest, origin } = addonPackage;
  const lines: string[] = ["What it stores:"];
  const described = new Set(manifest.tables.map((table) => table.name));
  const onlyPersonal = (manifest.personalData?.tables ?? []).filter(
    (table) =>
      !described.has(table.name) && personalColumnsOf(manifest.personalData, table.name).length > 0,
  );
  if (manifest.tables.length === 0 && onlyPersonal.length === 0)
    lines.push("  Nothing of its own, as it says, besides settings.");
  for (const table of manifest.tables) {
    const personal = new Set([
      ...table.columns.filter((column) => column.personalData).map(({ name }) => name),
      ...personalColumnsOf(manifest.personalData, table.name),
    ]);
    lines.push(`  ${table.name}: ${table.purpose}`);
    if (personal.size > 0) lines.push(`    Personal data: ${[...personal].join(", ")}`);
  }
  for (const { name } of onlyPersonal) {
    lines.push(`  ${name}:`);
    lines.push(`    Personal data: ${personalColumnsOf(manifest.personalData, name).join(", ")}`);
  }
  lines.push("What it adds to your website:");
  if (manifest.publicRoutes.length === 0) lines.push("  No public addresses, as it says.");
  for (const route of manifest.publicRoutes) {
    lines.push(`  ${route.method} ${route.path}: ${route.purpose}`);
  }
  lines.push("What runs by itself:");
  if (manifest.jobs.length === 0 && manifest.events.length === 0) {
    lines.push("  Nothing, as it says.");
  }
  for (const job of manifest.jobs) lines.push(`  ${job.id}: ${job.purpose}`);
  for (const event of manifest.events) lines.push(`  On ${event.event}: ${event.purpose}`);
  lines.push("Who it talks to:");
  if (manifest.hosts.length === 0) lines.push("  Nobody outside your site, as it says.");
  for (const host of manifest.hosts) lines.push(`  ${host.host}: ${host.purpose}`);
  lines.push("Where it comes from:");
  lines.push(
    `  ${[
      `${addonPackage.packageName} ${addonPackage.version}`,
      origin.publisher && `by ${origin.publisher}`,
      origin.licence && `${origin.licence} licence`,
      origin.source,
    ]
      .filter(Boolean)
      .join(", ")}`,
  );
  lines.push("Build → Add-ons checks this against what it finds once it runs.");
  return lines;
}

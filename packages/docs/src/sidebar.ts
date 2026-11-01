/**
 * The sidebar, in reading order. Kept in its own file so the tests can check that every
 * page is listed and every listed page exists.
 */
export const usingPages = [
  "using",
  "using/setup",
  "using/getting-around",
  "using/writing",
  "using/publishing",
  "using/history",
  "using/media",
  "using/content-types",
  "using/users",
  "using/backups",
  "using/wordpress",
  "using/troubleshooting",
] as const;

export const buildingPages = [
  "building",
  "building/install",
  "building/command-line",
  "building/architecture",
  "building/feature-folders",
  "building/delivery-api",
  "building/images",
  "building/nextjs-starter",
  "building/plugins",
  "building/contributing",
] as const;

export const sidebar = [
  { label: "Using Lintel", items: usingPages.map((slug) => ({ slug })) },
  { label: "Building with Lintel", items: buildingPages.map((slug) => ({ slug })) },
];

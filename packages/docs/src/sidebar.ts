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
  "using/website",
  "using/designing-pages",
  "using/elements-reference",
  "using/collection-lists",
  "using/shop-on-the-website",
  "using/templates",
  "using/history",
  "using/media",
  "using/content-types",
  "using/animating",
  "using/animating-in-the-builder",
  "using/builder-skill-levels",
  "using/users",
  "using/troubleshooting",
] as const;

export const buildingPages = [
  "building",
  "building/install",
  "building/architecture",
  "building/feature-folders",
  "building/delivery-api",
  "building/images",
  "building/rendering",
  "building/animation-spec",
  "building/nextjs-starter",
  "building/plugins",
  "building/contributing",
] as const;

export const sidebar = [
  { label: "Using Lintel", items: usingPages.map((slug) => ({ slug })) },
  { label: "Building with Lintel", items: buildingPages.map((slug) => ({ slug })) },
];

// The documentation site. Pages live in src/content/docs as Markdown; this file only says
// how the site is put together. See README.md and docs/decisions/0010-docs-with-starlight.md.
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { sidebar } from "./src/sidebar.ts";

const repositoryUrl = "https://github.com/DanielHuntr/lintelcms";

export default defineConfig({
  // Set DOCS_SITE_URL when the docs are published, for canonical links and the sitemap.
  site: process.env.DOCS_SITE_URL,
  integrations: [
    starlight({
      title: "Lintel",
      description: "How to use Lintel, and how to build websites with it.",
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: repositoryUrl }],
      editLink: { baseUrl: `${repositoryUrl}/edit/main/packages/docs/` },
      customCss: ["./src/styles/lintel.css"],
      components: {
        PageTitle: "./src/components/PageTitle.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      sidebar,
    }),
  ],
});

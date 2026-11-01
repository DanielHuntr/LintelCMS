/**
 * Links from the admin's help to the full documentation site. Set VITE_DOCS_URL to where the
 * docs are published (such as https://docs.example.com). Without it, links go to the page's
 * Markdown on GitHub, which GitHub shows formatted, so they never lead nowhere.
 */
const repositoryDocsUrl =
  "https://github.com/DanielHuntr/lintelcms/blob/main/packages/docs/src/content/docs";

export function fullDocsUrl(
  slug: string,
  docsSiteUrl: string | undefined = import.meta.env.VITE_DOCS_URL,
): string {
  const [path = "", anchor] = slug.replace(/^\/+/, "").split("#");
  const trimmedPath = path.replace(/\/+$/, "");
  const hash = anchor ? `#${anchor}` : "";

  if (docsSiteUrl) {
    const base = docsSiteUrl.replace(/\/+$/, "");
    return trimmedPath === "" ? `${base}/${hash}` : `${base}/${trimmedPath}/${hash}`;
  }
  return `${repositoryDocsUrl}/${markdownFileFor(trimmedPath)}${hash}`;
}

/** "using" is using/index.md, "using/media" is using/media.md, the home page is index.mdx. */
function markdownFileFor(path: string): string {
  if (path === "") return "index.mdx";
  return path === "using" || path === "building" ? `${path}/index.md` : `${path}.md`;
}

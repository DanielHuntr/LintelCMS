/**
 * Turning a docs Markdown file into a help page the admin can show. Plain string work with
 * no imports, so it runs anywhere: in the admin's bundle, in tests and in Node.
 */

export interface HelpPage {
  /** The docs path without slashes at the ends, such as "using/media". */
  slug: string;
  title: string;
  description: string;
  /** The Lintel version that introduced the page, if the page says. */
  since: string | null;
  /** The page's Markdown, without its frontmatter. */
  markdown: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Reads the frontmatter's top-level `key: value` lines. Docs frontmatter is simple YAML;
 * nested keys (indented, such as `sidebar.label`) aren't needed by the help panel.
 */
export function readFrontmatter(source: string): {
  fields: Record<string, string>;
  body: string;
} {
  const match = FRONTMATTER.exec(source);
  if (!match) return { fields: {}, body: source };

  const fields: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (field?.[1] && field[2] !== undefined && field[2] !== "") {
      fields[field[1]] = unquote(field[2].trim());
    }
  }
  return { fields, body: source.slice(match[0].length) };
}

/**
 * The docs slug for a file path such as "../content/docs/using/media.md". An `index.md`
 * stands for its folder, as on the docs site: "using/index.md" is "using".
 */
export function slugFromPath(path: string): string {
  const relative = path.replace(/^.*?content\/docs\//, "").replace(/\.mdx?$/, "");
  return relative.replace(/(^|\/)index$/, "");
}

export function parseHelpPage(path: string, source: string): HelpPage {
  const { fields, body } = readFrontmatter(source);
  const slug = slugFromPath(path);
  return {
    slug,
    title: fields.title ?? slug,
    description: fields.description ?? "",
    since: fields.since ?? null,
    markdown: body.trim(),
  };
}

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted?.[2] ?? value;
}

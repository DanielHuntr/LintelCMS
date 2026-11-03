import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * The small working example `lintel templates init` writes into an empty templates folder:
 * a template for the "pages" collection, the layout it uses and a partial it renders. Each
 * file is a starting point to edit, so it says what it is for in a comment at the top.
 */
export const STARTER_TEMPLATE_FILES: Readonly<Record<string, string>> = {
  "templates/pages.liquid": `{% comment %}
  The template for every entry in the "pages" collection. A file named after another
  collection's handle (posts.liquid, recipes.liquid) is that collection's template.
{% endcomment %}
{% layout "main" %}

{% block content %}
  <article class="page">
    <h1>{{ entry.title }}</h1>

    {% if entry.data.body %}
      {{ entry.data.body | rich_text }}
    {% endif %}

    {% comment %} The page's visual design from the builder, if it has one. {% endcomment %}
    {% design %}

    {% render "card", heading: "Say hello", text: "We'd love to hear from you.", link: site.home_url %}
  </article>
{% endblock %}
`,
  "layouts/main.liquid": `{% comment %}
  The layout pages.liquid uses, with {% layout "main" %}. The page's own HTML goes where
  {% block content %} is.
{% endcomment %}
<!DOCTYPE html>
<html lang="{{ site.language }}">
  <head>
    {% comment %} The title, description, SEO tags and Lintel's styles. {% endcomment %}
    {% lintel_head %}
  </head>
  <body>
    {% site_header %}
    <main id="main-content">
      {% block content %}{% endblock %}
    </main>
    {% site_footer %}
  </body>
</html>
`,
  "partials/card.liquid": `{% comment %}
  A small card, used with {% render "card", heading: "...", text: "...", link: "/contact" %}.
  Partials see entry, site, menus and globals too, plus what is passed to them.
{% endcomment %}
<aside class="card">
  <h2>{{ heading }}</h2>
  {% if text %}<p>{{ text }}</p>{% endif %}
  {% if link %}<a href="{{ link }}">Find out more</a>{% endif %}
</aside>
`,
};

export interface StarterTemplatesResult {
  /** The files written, as full paths. */
  written: string[];
  /** The files that were already there and were left exactly as they were. */
  kept: string[];
}

/**
 * Writes the starter files into the templates folder, making the folder when it's missing.
 * A file that already exists is never replaced, so running it twice is harmless.
 */
export async function writeStarterTemplates(folder: string): Promise<StarterTemplatesResult> {
  const result: StarterTemplatesResult = { written: [], kept: [] };
  for (const [relativePath, content] of Object.entries(STARTER_TEMPLATE_FILES)) {
    const path = join(folder, relativePath);
    await mkdir(dirname(path), { recursive: true });
    try {
      // "wx" fails when the file exists, so a file written in the meantime is safe too.
      await writeFile(path, content, { flag: "wx" });
      result.written.push(path);
    } catch (error) {
      if (!isAlreadyThere(error)) throw error;
      result.kept.push(path);
    }
  }
  return result;
}

function isAlreadyThere(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

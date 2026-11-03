/**
 * VS Code snippets for Lintel's own Liquid tags and filters (see
 * src/liquid-templates/liquid-tags.ts), written to `.vscode/lintel-liquid.code-snippets`.
 * Each has a description and tab stops: `${1:main}` is the first place the cursor goes,
 * with "main" filled in, and `$0` is where it ends up.
 */

export interface EditorSnippet {
  /** The languages it's offered in: "liquid" (the Liquid extension's) and "html". */
  scope: string;
  /** What to type for it to be suggested. */
  prefix: string[];
  /** Its lines, in VS Code's snippet syntax. */
  body: string[];
  description: string;
}

/** Snippets by name, as a `.code-snippets` file holds them. */
export type EditorSnippets = Record<string, EditorSnippet>;

export const SNIPPET_SCOPE = "liquid,html";

/** Every snippet Lintel writes is named with this, so the developer's own are told apart. */
export const LINTEL_SNIPPET_NAME_START = "Lintel: ";

function snippet(prefix: string[], body: string[], description: string): EditorSnippet {
  return { scope: SNIPPET_SCOPE, prefix, body, description };
}

export const TAG_SNIPPETS: EditorSnippets = {
  "Lintel: image": snippet(
    ["image", "lintel-image"],
    ['{% image ${1:entry.data.image} width: ${2:800}${3:, ratio: "${4:16/9}"} %}$0'],
    "{% image %}: a picture field drawn in several sizes, cropped around its focal point, " +
      "with its alt text. Also takes sizes, class, alt and priority: true.",
  ),
  "Lintel: menu": snippet(
    ["menu", "lintel-menu"],
    ['{% menu "${1:main}" %}$0'],
    "{% menu %}: a menu by handle, as a <nav> with nested lists and the current page " +
      'marked. Add label: "Footer links" for its accessible name.',
  ),
  "Lintel: form": snippet(
    ["form", "lintel-form"],
    ['{% form "${1:contact}" %}$0'],
    "{% form %}: a form from Forms by handle, with its validation and spam protection. " +
      "Add show_title: true to show its title.",
  ),
  "Lintel: design": snippet(
    ["design", "lintel-design"],
    ["{% design %}$0"],
    "{% design %}: the page's visual design from the builder, so code and the designer " +
      "can share a page.",
  ),
  "Lintel: lintel_head": snippet(
    ["lintel_head", "lintel-head"],
    ["{% lintel_head %}$0"],
    "{% lintel_head %}: the page's <head> contents (title, SEO tags, Lintel's styles and " +
      "scripts). Put it inside <head> in a layout.",
  ),
  "Lintel: site_header": snippet(
    ["site_header", "lintel-site-header"],
    ["{% site_header %}$0"],
    "{% site_header %}: the site's own header, as on every other page.",
  ),
  "Lintel: site_footer": snippet(
    ["site_footer", "lintel-site-footer"],
    ["{% site_footer %}$0"],
    "{% site_footer %}: the site's own footer, as on every other page.",
  ),
  "Lintel: cookie_settings": snippet(
    ["cookie_settings", "lintel-cookie-settings"],
    ["{% cookie_settings %}$0"],
    "{% cookie_settings %}: a Cookie settings link that opens the cookie notice again. It " +
      "shows only on sites that ask visitors about cookies.",
  ),
  "Lintel: rich_text": snippet(
    ["rich_text", "lintel-rich-text"],
    ["{{ ${1:entry.data.body} | rich_text }}$0"],
    "| rich_text: a rich text or Markdown field's HTML, which Lintel cleaned when it was saved.",
  ),
  "Lintel: image_url": snippet(
    ["image_url", "lintel-image-url"],
    ['{{ ${1:entry.data.image} | image_url: ${2:800}${3:, "${4:1/1}"} }}$0'],
    "| image_url: the address of a resized copy of a picture, for a background image or " +
      'og:image. A second value such as "1/1" crops it.',
  ),
  "Lintel: layout document": snippet(
    ["lintel-layout"],
    [
      "<!DOCTYPE html>",
      '<html lang="{{ site.language }}">',
      "  <head>",
      "    {% lintel_head %}",
      "  </head>",
      "  <body>",
      "    {% site_header %}",
      '    <main id="main-content">',
      "      {% block content %}$0{% endblock %}",
      "    </main>",
      "    {% site_footer %}",
      "  </body>",
      "</html>",
    ],
    "A whole layout: the page's head, the site's header and footer, and a content block " +
      "for templates to fill.",
  ),
  "Lintel: template with a layout": snippet(
    ["lintel-template"],
    [
      '{% layout "${1:main}" %}',
      "",
      "{% block content %}",
      "  <h1>{{ entry.title }}</h1>",
      "  $0",
      "{% endblock %}",
    ],
    "A page template that uses a layout and fills its content block.",
  ),
};

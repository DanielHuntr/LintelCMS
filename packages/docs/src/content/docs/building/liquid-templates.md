---
title: Liquid templates
description: Write your website's page templates as Liquid files in your project, with layouts, partials and Lintel's own tags, instead of using the visual designer.
since: "1.0.0-rc"
---

If you'd rather write HTML than design pages in the builder, keep page templates as
[Liquid](https://liquidjs.com/) files in your project, much as Umbraco has Razor views and
Statamic has Antlers. The built-in website draws a page with its Liquid template when there
is one, and exactly as before when there isn't. Content, menus, SEO, preview and caching
all work the same; editors keep editing in the admin.

## The folder

Lintel looks for a `site/` folder at the root of your project (set `LINTEL_TEMPLATES` to use
another, relative to the project root or absolute):

```text
site/
  templates/
    pages.liquid          the template for every entry of the "pages" collection
    posts.liquid          ...and of "posts"
    landing.liquid        any other template, which a page can choose
    landing/wide.liquid   subfolders are fine: this one is "landing/wide"
  layouts/
    main.liquid           for {% layout "main" %}
  partials/
    card.liquid           for {% render "card" %}
```

A template is named after the **collection handle** (`pages`, `posts`, `recipes`), the same
handle as in your [content model files](/building/content-model-as-code/). Names use
lowercase letters, numbers, `-` and `_`.

Without the folder, or without a template for a collection, nothing changes: that
collection's pages use the built-in template and the visual designer.

## A worked example

A page template that uses a layout, a partial and Lintel's tags:

```liquid
{% comment %} site/templates/pages.liquid {% endcomment %}
{% layout "main" %}

{% block content %}
  <article class="page">
    <h1>{{ entry.title }}</h1>
    {% if entry.data.hero_image %}
      {% image entry.data.hero_image width: 1200, ratio: "16/9", priority: true %}
    {% endif %}

    {{ entry.data.body | rich_text }}

    {% design %}

    {% render "contact-card", email: globals.site_settings.contact_email %}
  </article>
{% endblock %}
```

The layout it uses. `{% lintel_head %}` is where Lintel puts the page's `<head>`: the title,
description, canonical address, Open Graph and `hreflang` tags from the SEO plugin, the site's
stylesheet, and the styles and scripts of any design or form on the page.

```liquid
{% comment %} site/layouts/main.liquid {% endcomment %}
<!DOCTYPE html>
<html lang="{{ site.language }}">
  <head>
    {% lintel_head %}
    <link rel="stylesheet" href="/my-site.css">
  </head>
  <body class="my-site">
    <header class="my-header">
      <a href="{{ site.home_url }}">{{ site.name }}</a>
      {% menu "main" %}
    </header>
    <main id="main-content">{% block content %}{% endblock %}</main>
    {% site_footer %}
  </body>
</html>
```

And the partial. Partials see the same `entry`, `site`, `menus` and `globals` as the page,
plus anything passed to them:

```liquid
{% comment %} site/partials/contact-card.liquid {% endcomment %}
{% if email %}
  <aside class="contact-card">
    <h2>Questions?</h2>
    <p>Write to <a href="mailto:{{ email }}">{{ email }}</a>.</p>
  </aside>
{% endif %}
```

### Without a layout

A template doesn't need a layout. When what it draws isn't a whole document (it doesn't
start with `<!DOCTYPE` or `<html`), Lintel puts it inside the shared document: the same
`<head>`, skip link, site header and footer every other page has, with your HTML in
`<main class="lintel-main lintel-liquid">`. This is the quickest way to start:

```liquid
{% comment %} site/templates/posts.liquid {% endcomment %}
<article class="lintel-container">
  <h1>{{ entry.title }}</h1>
  <p><time datetime="{{ entry.published_at }}">{{ entry.published_at | date: "%-d %B %Y" }}</time></p>
  {{ entry.data.body | rich_text }}
</article>
```

A layout that leaves out `{% lintel_head %}` still gets the head, at the top of its
`<head>`, so search engines and the stylesheet are never lost.

## What templates can read

| Variable  | What it holds                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entry`   | `title`, `slug`, `url`, `locale`, `collection`, `published_at`, `has_design`, `id` and `data`: every field by handle, as the [delivery API](/building/delivery-api/) gives it |
| `site`    | `name`, `address` (the public address), `language`, `home_url`, `logo` and `languages` (`code`, `name`, `url`, `current` for each)                                            |
| `menus`   | Every menu by handle (`menus.main`, `menus.footer`): a list of items with `label`, `url`, `new_tab`, `current` and `children`                                                 |
| `globals` | Every global set by handle, with its values: `globals.site_settings.contact_email`                                                                                            |
| `request` | `path` (the address shown) and `page` (`?page=`)                                                                                                                              |

Liquid's standard tags and filters all work (`for`, `if`, `assign`, `capture`, `date`,
`where`, `default`...). See the [LiquidJS reference](https://liquidjs.com/tags/overview.html).

## Lintel's tags and filters

| Tag or filter                             | Draws                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `{% image entry.data.hero width: 800 %}`  | The picture in several sizes, cropped around its focal point, with its width, height and alt text, exactly as the built-in components draw pictures          |
| `{% menu "main" %}`                       | A menu as `<nav class="lintel-menu">` with nested lists, the current page marked with `aria-current="page"`                                                  |
| `{% form "contact" %}`                    | A form from Forms, as the builder's Form element draws it, with its validation and spam protection                                                           |
| `{% design %}`                            | The page's visual design from the builder, so code and the designer can share a page                                                                         |
| `{% lintel_head %}`                       | The page's `<head>` contents, in a layout                                                                                                                    |
| `{% site_header %}`, `{% site_footer %}`  | The site's own header and footer                                                                                                                             |
| `{{ entry.data.body \| rich_text }}`      | A rich text or Markdown field's HTML, which Lintel has already cleaned, with pictures as `figure.lintel-picture` and links to pages at their current address |
| `{{ entry.data.hero \| image_url: 800 }}` | The address of a resized copy, for a background image or `og:image`. `image_url: 800, "1/1"` crops it square                                                 |

A Link field's `url` is always an address you can print, even when the editor chose a page
for it: `<a href="{{ entry.data.button.url }}">`. It follows the page if its address changes,
and the field is empty if the page is deleted. Pictures in rich text are
`<figure class="lintel-picture lintel-picture--full">` (or `--left`, `--right`); style
them in your own stylesheet.

`{% image %}` also takes `ratio` (`"16/9"`, `"4:5"` or a number), `sizes` (instead of the
one made from `width`), `class`, `alt` (instead of the picture's own) and `priority: true`
for the first picture on the page. When the photo's licence asks for a credit (CC BY, CC
BY-SA, or a credit typed in the media library), it is drawn under the picture as
`<figure><img><figcaption class="lintel-credit">`. `credit: false` leaves it off, for pages
that credit their photos somewhere else. Menus take `label: "Footer links"` for their accessible
name. Forms take `show_title: true`.

## Choosing a template per page

Each page can choose its template in the editor's side panel, under **Template**. The panel
only appears when the templates folder has templates. The choices are:

- **Standard for _collection_**, the default: the collection's template when there is one,
  else the built-in template;
- **Visual design**: the built-in template, which draws the page's design from the builder;
- any template in `templates/`.

The choice is kept with the page's content (as `_template` in its values), so it goes live
when the page is published, shows in preview straight away, and is kept in its history. A
chosen template that's been deleted falls back to the collection's.

## Safety

Templates are run strictly:

- Everything printed with `{{ }}` is **HTML-escaped**. Rich text goes through `| rich_text`,
  which prints the HTML Lintel cleaned when it was saved. `| raw` prints anything as it is;
  use it only for values you trust.
- Templates, layouts and partials are read only from their own folders. `../`, absolute
  paths and links that lead outside are refused, and `{% render %}` never looks next to the
  file doing the including.
- An unknown filter or variable is an error rather than empty text, so typos show up.
  An unknown variable in `{% if %}` or before `| default` is fine, so optional fields read
  naturally: `{{ entry.data.subtitle | default: entry.title }}`.
- Objects show only their own values, and a page that takes more than five seconds to draw
  is stopped.

## Editor support

### Start with an example

```bash
pnpm lintel templates init
```

makes the `site/` folder (or your `LINTEL_TEMPLATES`) with a small working example:
`templates/pages.liquid`, a layout `layouts/main.liquid` with `{% lintel_head %}`,
`{% site_header %}` and `{% site_footer %}`, and a partial `partials/card.liquid`. It never
replaces a file that's already there, so it's safe to run in a project that has templates.

### Highlighting

VS Code doesn't know Liquid on its own. Install the **Liquid** extension by Panoply
(`sissel.shopify-liquid` in the Extensions view), which highlights `.liquid` files and
handles the HTML in them. Shopify's own **Shopify Liquid** extension
(`Shopify.theme-check-vscode`) highlights them too, but its checks are written for Shopify
themes and may flag Lintel's tags as unknown.

### Snippets

`init` also writes two snippets files that VS Code picks up by itself:

- `.vscode/lintel-liquid.code-snippets`: every Lintel tag and filter. Type `image`,
  `menu`, `form`, `design`, `lintel_head`, `site_header`, `site_footer`, `rich_text` or
  `image_url`, choose the suggestion, and press Tab to move between the parts to fill in.
  `lintel-layout` and `lintel-template` write a whole layout and a page template.
- `.vscode/lintel-fields.code-snippets`: your own fields. Type `entry.data.` to see every
  content type's fields, each with its label and type (`Photo: image field of Recipe
(required)`). Pictures come wrapped in `{% image %}`, rich text and Markdown with
  `| rich_text`, lists in a `for` loop and dates with `| date`. Type `recipe.` to see only
  one content type's fields.

The snippets are offered in Liquid files and in HTML files. Lintel only ever rewrites the
entries it named `Lintel: ...`; snippets of your own, in these files or in a
`.code-snippets` file of your own, are kept.

### Keeping the field snippets up to date

While `pnpm dev` runs and the templates folder exists, Lintel rewrites the field snippets
whenever a content type changes, in the admin or in a
[content model file](/building/content-model-as-code/), and each time it starts. Otherwise,
after changing content types, run:

```bash
pnpm lintel templates sync
```

It reads your content model files when you have them, and the database when you don't (stop
`pnpm dev` first if you use the built-in database; it keeps them up to date anyway).

`.vscode/` is in Lintel's `.gitignore` apart from `extensions.json`, so the snippets stay on
each computer. Since `init` and `pnpm dev` write them, that's usually what you want.

### What isn't included

Snippets complete what you type; they don't understand the template. Hover help for
Lintel's tags, checks as you type (an unknown filter, a field that doesn't exist) and
completion that knows which entry a template draws would need a Liquid language server
that knows Lintel, and there isn't one yet. Mistakes show on the page instead, while
`pnpm dev` runs (see below).

## Development and production

While `pnpm dev` runs, Lintel watches the templates folder: save a file and reload the page,
with no restart. A template with a mistake shows what went wrong on the page itself.

In production, parsed templates and finished pages are kept in memory, the same
[cache](/building/rendering/#caching) every page uses; restart Lintel after deploying new
templates. A template with a mistake gives the visitor the usual "Something went wrong" page
and writes the error to the log.

## Not yet

- Templates for blog indexes, archives, search, the shop's pages and the 404 page. Those
  use the built-in template for now.
- Products in templates (`{% product %}`), and collection lists other than through
  `{% design %}`.

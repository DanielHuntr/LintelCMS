---
title: Liquid templates
description: Write your website's page templates as Liquid files in your project, with layouts, partials and Lintel's own tags, instead of using the visual designer.
since: "1.0"
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

| Tag or filter                             | Draws                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{% image entry.data.hero width: 800 %}`  | The picture in several sizes, cropped around its focal point, with its width, height and alt text, exactly as the built-in components draw pictures |
| `{% menu "main" %}`                       | A menu as `<nav class="lintel-menu">` with nested lists, the current page marked with `aria-current="page"`                                         |
| `{% form "contact" %}`                    | A form from Forms, as the builder's Form element draws it, with its validation and spam protection                                                  |
| `{% design %}`                            | The page's visual design from the builder, so code and the designer can share a page                                                                |
| `{% lintel_head %}`                       | The page's `<head>` contents, in a layout                                                                                                           |
| `{% site_header %}`, `{% site_footer %}`  | The site's own header and footer                                                                                                                    |
| `{{ entry.data.body \| rich_text }}`      | A rich text or Markdown field's HTML, which Lintel has already cleaned                                                                              |
| `{{ entry.data.hero \| image_url: 800 }}` | The address of a resized copy, for a background image or `og:image`. `image_url: 800, "1/1"` crops it square                                        |

`{% image %}` also takes `ratio` (`"16/9"`, `"4:5"` or a number), `sizes` (instead of the
one made from `width`), `class`, `alt` (instead of the picture's own) and `priority: true`
for the first picture on the page. Menus take `label: "Footer links"` for their accessible
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

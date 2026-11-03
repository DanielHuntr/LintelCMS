# 48. The site's navigation and footer wait for Publish

Date: 2026-11-03

## Decision

Changes to the site's shared navigation and footer (decision 39) no longer go live the
moment they are saved. Like a page's own changes, they wait until someone publishes.

- **A draft and a published version.** The builder saves changes into a draft
  (`siteSectionsDraft:<site id>` in the settings table). The website, Liquid's
  `{% site_header %}` and `{% site_footer %}` and everything visitors see draw the published
  sections (`siteSections:<site id>`). Sections stored before this change count as published,
  so no site looks different after updating.
- **Publish puts them live.** The page builder's Publish publishes the page and then any
  waiting navigation and footer changes (`POST /website/sections/publish`), for people who
  may both publish and change blocks. The top bar says "Navigation and footer changes not
  live yet" while there are some.
- **Nothing to publish when nothing changed.** A draft that ends up the same as the published
  sections is dropped, so the note goes away.
- **Starter templates still change the live site.** Applying a template's look replaces the
  published sections at once (the dialog says "Changes your live website now"), keeps the
  old ones to bring back (`POST /website/sections/restore-previous`) and drops any draft.

## Why

Before, dragging a link into the navigation of one page changed every page of the live site
straight away, even when that page was a draft nobody had published. People expect the site
to change when they press Publish, and nowhere else.

## Not done

Live preview of an unpublished page still shows the published navigation and footer.

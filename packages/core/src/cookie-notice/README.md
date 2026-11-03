# Cookie notice

The website's cookie notice: on by default whenever the published site uses something that
may set cookies or contact another company, and only then. Decision 0040 explains why.

What counts (`@lintel/builder-model`'s `consent/consent-services.ts`): YouTube and Vimeo
videos, maps (OpenStreetMap), Embed elements (named by their service, such as Calendly),
Adobe Fonts, and the services plugins declare with `consentServices` in `definePlugin`.
Embeds set to load without asking, and Code elements, are the site maker's own call.

- `cookie-notice.schema.ts`: the `cookieNotice` setting: Automatic (default), Always or Off,
  a bar or a corner card, the heading and message (`{services}` is replaced by the names),
  and the privacy page.
- `cookie-notice.service.ts`: reading and saving it; `findSiteConsentServices`, which reads
  the published designs of every collection with pages, the site's navigation and footer,
  the blocks they use, Adobe Fonts and the plugins that are on; and what a page tells the
  notice's script (`buildCookieNoticePage`). `website/site-context.service.ts` works it out
  once per cache life; pages carry it as JSON with the script
  (`/_lintel/cookie-notice-<fingerprint>.js`), which only sites with the notice load.
- `plugin-consent-services.ts`: plugins' declared services.
- `cookie-notice.routes.ts`: `GET` and `PUT /website/cookie-notice`
  (`settings:read`, `settings:update`), answering `{ settings, services, shown }`.
- `cookie-notice.repository.ts`: the settings row, and published designs.

While the notice shows, Adobe Fonts' stylesheet is not linked until a visitor allows it; the
theme's fonts show till then. The default footer, the Site footer element, the starter
footers, the Cookie settings element and `{% cookie_settings %}` reopen the choices.
The notice itself and the visitor's choice (localStorage, per site, six months) are in
`@lintel/builder`'s `site-behaviours/cookie-notice.ts` and `consent-choice.ts`.

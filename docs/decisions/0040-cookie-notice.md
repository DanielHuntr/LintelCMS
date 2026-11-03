# 0040: A cookie notice by default when the site needs one

## Context

Videos from YouTube and Vimeo, maps, embeds and Adobe Fonts contact other companies, which
may set cookies. Each embed already waited behind its own "Load" button, but there was no
site-wide way to ask once, and Adobe Fonts loaded without asking. Privacy laws in the UK,
the EU and elsewhere expect sites to ask first. Lintel's users are mostly not technical, so
the safe answer has to be the default.

## Decision

- A cookie notice is **on by default** (Automatic) and shows only while the published site
  uses something that may set cookies: the server reads the site's published designs, its
  navigation and footer, the blocks they use, its Adobe Fonts and the plugins that are on.
  Sites that use none of these show nothing and ship none of its code.
- It names what the site uses, offers "Accept all" and "Only necessary" with the same look,
  and "Choose" with a switch per service. No third-party script is ever involved.
- The choice is kept in localStorage (not a cookie), per site, for about six months, and
  only while the list of services is the same; a changed list asks again.
- Accepting loads the allowed embeds in place, without a reload, through the elements
  script's existing consent frames. "Only necessary" keeps each placeholder, which can still
  load just that one. Adobe Fonts' stylesheet waits for consent; the theme's fonts show.
- "Cookie settings" (default footer, Site footer element, starter footers, a small element
  and `{% cookie_settings %}`) reopens the choices.
- Settings → Your website → Cookie notice: Automatic, Always or Off, a bar or a corner card,
  wording and a privacy page. Off shows a plain warning that it is general guidance, not
  legal advice.
- Plugins declare services with `consentServices`; their scripts ask
  `window.lintelConsent.allows(id)` and listen for the `lintel:consent` event.

## Consequences

The notice is a non-modal region near the start of the page: it never takes focus or blocks
reading, keeps room at the end of the page, follows the theme and reduced motion. Embeds set
to "Load without asking" and Code elements are not detected; Always covers sites that need
the notice for those.

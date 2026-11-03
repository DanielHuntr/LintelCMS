---
title: Branding the admin for your clients
description: Show your agency's or your client's name, logo and colour instead of Lintel's.
since: "0.1"
---

When you build a site with Lintel for a client, the admin can carry your brand (or theirs)
instead of Lintel's. Your client signs in to "Acme Studio", sees your logo and colour, and
gets help from you.

## What you can change

| Setting                        | Where it shows                                                 |
| ------------------------------ | -------------------------------------------------------------- |
| Product name                   | Sidebar, sign-in and setup screens, browser tabs, emails       |
| Logo, and logo for dark mode   | Sidebar and sign-in screen, in place of the mark and name      |
| Small mark                     | Corners of the sign-in and setup screens, the welcome screen   |
| Browser tab icon               | The favicon                                                    |
| Accent colour                  | Buttons, links, toggles, the selected sidebar item, emails     |
| Sign-in message and background | The sign-in screen                                             |
| Support link and email         | The Help page and the bottom of emails                         |
| Your own guides                | The Help page                                                  |
| Hide Lintel's help             | Removes Lintel's help pages, docs links and the help button    |
| Hide "Built with Lintel"       | Removes the credit from the footer of the Next.js starter site |

## In the admin

Open **Settings**, then **Branding**. Only people who may change branding see it (a
Super admin can). Change what you like, then **Save branding**: everyone sees the new look
straight away, including on their next visit to the sign-in screen.

Pick the accent colour with the picker or type a code like `#0B1F4D`. Lintel works out a
deeper shade for links in light mode, a lighter one for dark mode and a hover shade for
buttons, so text stays readable (WCAG AA, 4.5:1). If neither white nor black text is easy
to read on your colour, the screen says so and suggests a darker or lighter shade.

**Reset** puts everything back: to Lintel's own look, or, if the server was deployed with
branding (below), to that.

## Baking it into a deployment

If you install Lintel for clients, put the branding in the deployment so it's there from
the very first setup screen. Either add a `lintel.config.json` next to the repository's
`package.json`:

```json
{
  "branding": {
    "productName": "Acme Studio",
    "accentColour": "#0B1F4D",
    "logo": "./brand/acme-logo.svg",
    "logoDark": "./brand/acme-logo-white.svg",
    "mark": "./brand/acme-mark.svg",
    "favicon": "./brand/acme-favicon.png",
    "signInMessage": "Stuck? Call Acme on 0123 456 789.",
    "supportEmail": "help@acme.example",
    "supportUrl": "https://acme.example/support",
    "docsUrl": "https://acme.example/guides",
    "hideBuiltWithLintel": true,
    "hideLintelHelp": true
  },
  "interfaceLanguage": "en"
}
```

Pictures can be paths relative to the file, web addresses, or `data:` URLs. Set
`LINTEL_CONFIG_FILE` to keep the file somewhere else.

Or use environment variables, which win over the file:

| Variable                                                                                   | Setting                    |
| ------------------------------------------------------------------------------------------ | -------------------------- |
| `LINTEL_BRAND_PRODUCT_NAME`                                                                | Product name               |
| `LINTEL_BRAND_ACCENT_COLOUR`                                                               | Accent colour              |
| `LINTEL_BRAND_LOGO`, `LINTEL_BRAND_LOGO_DARK`, `LINTEL_BRAND_MARK`, `LINTEL_BRAND_FAVICON` | Pictures (path or address) |
| `LINTEL_BRAND_SIGN_IN_MESSAGE`, `LINTEL_BRAND_SIGN_IN_BACKGROUND`                          | Sign-in screen             |
| `LINTEL_BRAND_SUPPORT_URL`, `LINTEL_BRAND_SUPPORT_EMAIL`, `LINTEL_BRAND_DOCS_URL`          | Help                       |
| `LINTEL_BRAND_HIDE_BUILT_WITH_LINTEL`, `LINTEL_BRAND_HIDE_LINTEL_HELP`                     | `true` or `false`          |

A mistake in either (a colour that isn't one, a missing logo file) stops the server at
start with a message saying which setting is wrong, rather than showing the wrong brand.

The deployment's branding is the starting point. Anything changed in Build → Admin branding
is kept on top of it, and only the settings that were changed: if you later update the
deployment's logo, clients who only changed the colour get the new logo.

## Your website

The [Next.js starter](/building/nextjs-starter/) shows "Built with Lintel" in its footer.
It reads `GET /branding` from the API and leaves the credit out when **Hide "Built with
Lintel"** is on. Your own front end can do the same: `GET /branding` is public and returns
every setting above, with pictures as addresses and the accent's shades worked out.

## Emails

Emails from the admin use the product name as the sender's name and in the subject, the
logo (when it's at a web address, since email apps can't show uploaded pictures inline),
the accent colour for buttons, and the support email at the bottom.

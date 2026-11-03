---
title: Visitors
description: Seeing how many people visit your site and what they read, counted without cookies and without identifying anyone.
since: "1.0.0-rc"
sidebar:
  label: Visitors
---

Lintel counts your website's visitors itself. There's no other company involved, no
cookies, and nothing that identifies a person. You see how many people came, which pages
they read, where they came from, and how many sent a form or paid for an order.

## Switching it on

**Visitors** is on for new sites. On a site you already had, go to **Build**, then
**Features**, and switch on **Visitors**. Counting starts with the next visit to a
published page.

## The Visitors screen

Open **Visitors** in the sidebar. Choose **Today**, **7 days**, **30 days** or **Custom** at
the top. You'll see:

- **Visitors**, **Page views**, **Average time** on a page and **Conversion rate** (goals
  reached per 100 visitors), each compared with the period before, in words: "Up 28% on
  the previous period".
- **Visitors each day**, as bars, or as a table with **Show as a table**.
- **Top pages**. The home page is called **Home page**.
- **Where people came from**: the websites that sent them, or **Typed in or bookmarked**.
- **Devices** (phone, tablet or computer) and **Countries**.
- **Goals**: forms sent and orders paid.
- **Campaigns**, **Links to other sites** and **Events**, only when there are some.

**Export** downloads the figures as a spreadsheet (CSV).

Countries come from the language a visitor's browser asks for (`en-GB` counts as the United
Kingdom), so treat them as a good guess.

You also see visitors in other places: a **Visitors** card on the dashboard, a **Visitors**
panel with the last 7 days in a page's editor, and "128 visitors this week" in the page
builder's top bar.

## Goals

Lintel records two goals by itself, with nothing to set up:

- **A form sent**, named after the form, on the page it was sent from;
- **An order paid**, when your shop is on.

## Privacy

- **No cookies, nothing stored in the browser.** Visitors don't need to agree to anything,
  so the counting doesn't need a [cookie notice](/using/cookie-notice/).
- **Nobody can be identified.** To tell visitors apart for one day, Lintel mixes their
  address and browser with a random value that is made each day and deleted at the end of
  it. The address and browser are never stored. So nobody can be followed from one day to
  the next, and someone who visits on two days counts twice in a week.
- **Not counted:** browsers that ask not to be tracked (Do Not Track or Global Privacy
  Control), search engines and other robots, the same page reloaded within ten seconds,
  and floods of requests.
- **Kept for a while:** single visits are kept for 30 days (you can choose from 7 to 365),
  then deleted. Daily totals are kept.

### Counting only people who accept

Some sites want to count only people who have agreed, whatever the law says. Press
**Settings** on the Visitors screen and tick **Count visitors only after they accept**. Your
cookie notice then lists visitor counting as a choice, and nobody is counted until they
accept it. The same window sets **Keep single visits for**.

## Who can see it

Owners, Admins and Editors can see visitors and export them. Authors and Viewers can't.
Changing the settings needs permission to change settings.

## For developers

Pages get a small script while the plugin is on. A site's own script can record named
events with `lintelAnalytics.track("signup")`, which show under **Events**. Days are UTC
days. See `docs/decisions/0042-built-in-visitor-counts.md`.

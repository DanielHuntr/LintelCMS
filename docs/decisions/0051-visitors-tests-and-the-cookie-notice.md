# 51. Visitors, A/B tests and the cookie notice working together

Date: 2026-11-03

## Context

Three plugins landed apart: the cookie notice (0040), Visitors (0042) and A/B testing (0044).
Each left a seam for the others: Visitors' "Count visitors only after they accept" waits for
`plugin:analytics`, but nothing listed that service in the notice; A/B testing has an
`ExperimentMeasurement` seam and a version marker meant for analytics; and nobody had
decided whether the A/B counting script's localStorage key needs consent.

## Decision

### The cookie notice lists what a plugin's settings ask for

Plugins can now name services from their settings with `consentServicesFromSettings` in
`definePlugin`, read each time the notice is worked out while the plugin is on. A service
without a handle stands for the plugin itself (`plugin:<id>`).

- **Visitors** lists "Visitor counts" (`plugin:analytics`) only while "Count visitors only
  after they accept" is on. Off (the default), counting is cookieless and the notice doesn't
  mention it, so a site with nothing else that needs asking still shows no notice.
- **A/B testing** lists "A/B test counts" (`plugin:experiments`) only while its own "Count
  test visitors only after they accept" is on (see below).

With the notice on Automatic, turning either setting on is enough to make the notice
appear. With the notice Off, a plugin waiting for consent counts nobody; the setting's hint
says it waits for the cookie notice.

### The A/B localStorage key doesn't need consent by default

The key `lintel-tests` holds only `{ "<test id>": { "v": "b", "c": 1 } }`: which version a
browser was counted for and whether it reached the goal. It is first-party, holds nothing
about the person, is never sent anywhere but the site itself, and entries go when their test
stops. It exists only so a browser is counted once; it identifies nobody and can't follow
anyone across sites. We treat it like the audience-measurement exemption European
regulators allow for first-party statistics that are strictly limited to that purpose, and
don't ask by default, which keeps tests useful on the many sites that show no notice at all.

That is a judgement on a grey area, so sites that want every visitor to agree first get the
same switch as Visitors: **Count test visitors only after they accept** (A/B tests →
Settings). With it on, the notice lists "A/B test counts", and the script stores and sends
nothing until a visitor allows `plugin:experiments`; a visitor who turns it down has any
earlier key removed. Which version a visitor sees is still chosen on the server, from
nothing stored, so everyone taking part sees a version either way; only counting waits.

### A/B tests and Visitors

- **Goals Visitors counts.** A test's goal can be `{ kind: "analytics", name }`: a particular
  form ("form:contact"), an order ("order") or an event the site sends with
  `lintelAnalytics.track("signup")`. It is offered while Visitors is on, listing the site's
  forms and the events counted in the last 30 days. The tested page's script spots each in
  the browser: the sent form's handle, the order confirmation page, or the `lintel:track`
  event the beacon now fires.
- **Page views carry the version.** The beacon reads the page's
  `<template data-lintel-test>` marker and tags its page view with `{ experiment, variant }`.
  The daily figures gain a `version` row per test version, and the Visitors screen shows
  "A/B tests running" (visitors per version of each running test) to people who can run
  tests. The tag adds no identifier: it is a test id and a letter on an event that was
  already anonymous.
- **A/B keeps its own counts, with or without Visitors.** The `ExperimentMeasurement` seam
  stays, but the built-in counts remain the results' source, because Visitors can't stand in
  for them: its single events are deleted after `retentionDays` (30 by default) while a test
  may run longer; its visitor hash changes every day, so someone who sees B on Monday and
  orders on Tuesday would be two people; and goals the server records (forms, orders) carry
  no visitor, so they can't be matched to a version. The per-browser counts are exact on all
  three. Visitors' version rows are a second view, not the verdict.

### Privacy holds on both sides

No cookies; nothing identifying stored. Do Not Track, Global Privacy Control and robots are
excluded by both scripts and both servers, so a version tag is never recorded for them.

## Consequences

- `plugin:analytics` and `plugin:experiments` join the notice's service ids; changing either
  setting changes the notice's version, so visitors are asked again.
- A goal named after an event only fires while Visitors is on (the event comes from its
  beacon). Switching Visitors off leaves the goal in place, reached by forms and orders only.

---
title: A/B testing
description: Trying another version of a page, or of one section, and seeing which one gets more people to act.
since: "1.0.0-rc"
sidebar:
  label: A/B testing
---

An A/B test shows some visitors your page as it is (the original) and others a different
version of it, then counts which one gets more people to do what you want: send a form,
place an order, click a button or reach a page. When one is clearly better, you keep it.

It's private by design: no other company is involved, nothing identifies a visitor, and no
cookie is set.

## Switching it on

Go to **Build**, then **Features**, and switch on **A/B testing**. While it's off, nothing
of it shows in the admin and your website is exactly as published.

You need permission to run A/B tests. Making a version the page also needs permission to
publish.

## Making a version to try

1. Open the page in the page builder.
2. Press **Try another version** in the top bar, then:
   - **Of the whole page**, to try a different page; or
   - **Of the selected section only**, to try one section (select it first). The rest of
     the page stays locked, so only that section changes.
3. **Version B** opens on the page, as a copy. Change it like any page: other words,
   another picture, a different button.

The top bar then switches between **Original** and **Version B**. **Add another version**
makes **Version C**, as a copy of the original or of Version B. Three versions is the most,
because every extra version needs as many visitors again before the result means anything.

Versions save as you work, like the page. The site's navigation and footer can't be tried on
their own.

## Setting up the test

Press **Test settings** in the top bar, or open **A/B tests** in the sidebar and choose the
test.

1. Under **What counts as success**, choose **Count a success when someone…** sends a form,
   places an order, clicks a button or link (and which one), or reaches a page (and which
   one).
2. Under **Versions**, each version gets an equal share of visitors. **Change how visitors
   are split** lets you give one more, in whole percent.
3. Press **Start test**.

**Pause** stops it for a while: everyone sees the original and nothing is counted. One test
can run on a page at a time.

## Reading the results

**Results** shows, for each version, how many visitors saw it, how many succeeded, its
success rate and how it compares with the original. One sentence sums up each version:

- "Version B is ahead, but it's too early to be sure."
- "Version B is better: about 98% sure."
- "Version B is worse: about 97% sure."
- "Version B and the original are about the same so far."

Lintel says "better" or "worse" only when it's at least 95% sure, and only once every
version has had at least 100 visitors and the test has at least 20 successes in all. Until
then it says it's too early, and why.

## Ending the test

- **Make Version B the page** puts Version B on your website in place of the original and
  ends the test. You can do this at any time; if the result isn't sure yet, Lintel says so
  first.
- **Keep the original** ends the test and leaves the page as it is.

## What visitors see

Each visitor gets one version, chosen by the server before the page is drawn, so nothing
flickers or jumps. The same browser on the same network keeps getting the same version
without anything being stored to remember it. Someone who switches from Wi-Fi to mobile
data may see the other version; that only blurs the result a little.

These visitors always see the original and are never counted:

- search engines, link previews and other robots;
- browsers that ask not to be tracked (Do Not Track or Global Privacy Control).

To count each visitor once, the page keeps one small note in the visitor's browser: which
version they were counted for, and whether they succeeded. It holds nothing about the
person and is only ever sent to your own site.

## For developers

Versions are kept with the test, not in the page, and a section version replaces just that
section in the page as it is now. Counts are daily totals per version. The statistics are
Bayesian (beta-binomial). See `docs/decisions/0044-ab-testing.md`.

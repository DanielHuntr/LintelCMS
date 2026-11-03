---
title: Privacy and personal data
description: Find, export and erase one person's data, choose how long data is kept, and get a starting point for your privacy policy.
since: "1.0.0-rc"
sidebar:
  label: Privacy and personal data
---

**Settings → Privacy** has the tools for looking after the personal data your site keeps, and
for answering people who ask about theirs. They're there for data protection laws such as
GDPR and UK GDPR.

Lintel gives you tools and sensible defaults. It can't make a site compliant on its own:
that also depends on what you collect, why, what your privacy page says and how you run
things. Nothing here is legal advice. If you're unsure, ask someone qualified.

You need the **Manage privacy** permission, which Owners and Admins have.

## Find a person

When someone asks what you hold about them, or asks you to delete it:

1. Type their email address and press **Find**. You can search by full name instead, but a
   name has to match in full, and two people can share one.
2. Open each kind of data to see what was found.
3. Choose **Download their data** for a copy, or **Erase…** to remove it.

The download is one .zip holding `personal-data.json`, with everything, and a spreadsheet for
each kind of data. It contains personal data, so send it to them securely.

Erasing asks first and can't be undone. What happens depends on the kind of data:

| Kind of data                   | What erasing does                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Form entries                   | Deleted, with the files they sent and your notes on them                                                                  |
| Shop customers                 | Deleted                                                                                                                   |
| Orders                         | Kept for your tax records, with the name, email, address and phone removed. What was bought, the amounts and country stay |
| Baskets                        | Deleted. Checkouts that weren't paid have the person's details removed                                                    |
| Security log                   | Kept as a record of what happened, with the email, name, IP address and browser removed                                   |
| Webhook and automation history | Deleted, except automations still running: erase again once they've finished                                              |
| Admin accounts                 | Left alone. Remove the person in [Users](/using/users/), so their work keeps an author                                    |
| Add-ons                        | Whatever the add-on does, if it can be searched                                                                           |

Three things erasing can't reach:

- **Backups.** Older backups keep their copy until they're replaced. If you
  [restore one](/using/backups/), what you erased comes back, so erase it again afterwards.
- **Outside companies.** Payment providers, email services and anything you sent data to by
  webhook keep their own records. Ask them too.
- **Emails.** Notifications you were sent stay in your mailbox.

Lintel also doesn't search messages an automation wrote into a notification, or text someone
typed into your pages.

Each download and erasure is listed under **Recent requests**: who on your team did it, and
when. It never says who it was for, so the record holds no personal data about them.

## Where personal data is kept

A list worked out from what your site uses: each kind of data in a sentence, with **Details**
for what happens when it's erased and which tables hold it. Features you've switched off are
listed too, because switching one off keeps its data.

An add-on marked **Can't be searched** hasn't given Lintel a way to look through its data, so
check it by hand when someone asks.

## How long data is kept

Keeping personal data only as long as you need it is good practice, and the law in many
places. Each rule shows what it will remove next, and Lintel checks every hour.

| Rule                          | Starts as    | What it does                                                                      |
| ----------------------------- | ------------ | --------------------------------------------------------------------------------- |
| Form entries                  | Off, 1 year  | Deletes entries, for forms without a setting of their own                         |
| Abandoned baskets             | On, 30 days  | Deletes baskets, and removes the person from expired checkouts                    |
| Activity logs                 | On, 90 days  | Deletes old security log entries, webhook deliveries and finished automation runs |
| Remove people from old orders | Off, 7 years | Removes the person's details; the order stays                                     |

What a person sent you or bought starts switched off, because deleting it without asking could
surprise you. Before you switch one on, the rule shows how many items are already past it. How
long you must keep orders depends on your country's tax rules.

Automation runs about a page, which is how its reviews are found, are kept.

## Consent records

When someone ticks a consent box on a [form](/using/forms/), Lintel keeps the exact words they
saw, when they ticked it and which page they were on. Changing the wording later doesn't change
what they agreed to. The record shows on the entry, in the form's spreadsheet export and in
**Download their data**.

## Privacy policy helper

A draft of a "What this site collects" section, written from what your site actually uses:
forms, the shop, Visitors, A/B tests, the services your cookie notice names, fonts, your email
service and add-ons. It's a starting point, not legal advice: read it, change it to fit how you
work, and add your contact details.

It also checks your privacy page, which is the one your
[cookie notice](/using/cookie-notice/) links to, or else a page with "privacy" in its address,
and warns about anything your site uses that the page doesn't seem to mention. It only looks for
the words, so it can miss things either way.

## Companies you share data with

A list for your records. Lintel fills in what it can find: connected payment providers, your
email service, spam checks, Adobe Fonts, embedded services and add-ons' services. Add the rest
yourself, starting with whoever hosts your site, then anything like a newsletter service or your
accountant.

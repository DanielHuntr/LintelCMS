---
title: Forms
description: Contact forms, sign-ups and bookings, the submissions inbox, emails and spam protection.
since: "0.1"
sidebar:
  label: Forms
---

**Forms** in the sidebar is where you make the forms people fill in on your website, such
as a contact form or a newsletter sign-up, and read what they send. It appears while the
Forms plugin is switched on.

## Making a form

1. Press **New form**.
2. Pick a starting point: **Contact**, **Newsletter sign-up**, **Quote request**,
   **Event booking**, or a **Blank form**.
3. Give it a name (only you and your team see it) and press **Create form**.

The form opens in the builder, with a live **Preview** beside it. Nothing changes on your
website until you press **Save**.

## Fields

Press **Add field** and choose what to ask:

| Field        | What visitors get                                 |
| ------------ | ------------------------------------------------- |
| Short text   | One line, such as a name                          |
| Long text    | A box for a message                               |
| Email        | An email address, checked as it's typed           |
| Phone        | A phone number                                    |
| Number       | A quantity, with a lowest and highest if you like |
| Choice       | Pick one from a short list                        |
| Checkboxes   | Tick any from a list                              |
| Dropdown     | Pick one from a longer list                       |
| Date         | A day, from a calendar                            |
| File upload  | Photos or documents, with a size limit            |
| Consent      | A box to tick, such as agreeing to be contacted   |
| Hidden value | Saved with every submission, never shown          |
| Step         | Starts a new page, for a multi-step form          |

Select a field to change its question, help text and whether it's **Required**. Choices go
one per line. Text and numbers can have a shortest and longest answer; dates an earliest
and latest day.

To change the order, drag a field by the handle on its left, or use its up and down
arrows. With the keyboard, focus the handle, press Space, move with the arrow keys and
press Space again.

### Multi-step forms

Add a **Step** field wherever a new page should start, and give it a title such as
"About you". Visitors see one step at a time, with **Next** and **Back**. The Quote request
template has two steps to start from.

### Files

Files people send go into your [media library](/using/media/), so the usual limits apply
(25 MB at most). Each file field chooses whether it takes images, documents or both, how
big each file can be and how many can be sent. Anyone with a file's link can open it, so
don't ask for anything sensitive, such as passport scans.

## After sending

On the **Settings** tab:

- **Show a message** shows your thank-you text in place of the form, or **Go to a page**
  sends people to a page such as `/thank-you`.
- **Button label** is the text on the send button.
- **Take submissions** off closes the form without deleting it.

## Emails

**Email me about new submissions** is on for every new form, sent to whoever made the form.
Add more addresses, separated by commas. Pressing **Reply** in your email program answers
the person who filled in the form.

**Send a confirmation to the person** emails them a copy of what they sent. It needs an
Email field, so Lintel knows where to send it.

In subjects and messages, `{form}` is the form's name and a field's handle in braces, such
as `{name}`, is that answer. "New message from {name}" becomes "New message from Ana Lima".

To tell Slack, a spreadsheet or another service, add a webhook in **Settings → Webhooks**
and tick **A form is sent**. Slack's incoming webhooks show a one-line summary with a link
to the submission.

## Putting a form on your site

The **Add to your site** tab shows the ways:

- **On a page:** open the page in Content, add a **Form** section and pick the form.
- **On any other website:** copy the one line of code and paste it where the form should
  go. The website's address must be listed in **Settings → API access**.

## The submissions inbox

Press **Submissions** on a form to read what people sent, newest first. New ones are in
bold, with a dot, and are marked as read when you open them.

- **Search** looks through every answer.
- **Unread** and **Starred** narrow the list. Star anything you want to come back to.
- **Notes** are for your team only, such as "Called back on Monday".
- **Export CSV** downloads every submission as a spreadsheet.
- **Delete** removes a submission, its notes and its files for good.

## Keeping data only as long as you need it

Under **Keep submissions**, choose **For a number of days** and Lintel deletes older
submissions (and their files) automatically, every hour.

When someone asks what you hold about them, or asks you to delete it, open **Forms → Spam
and privacy**, type the email address they used and press **Find**. **Download their data**
saves everything they sent as a file you can send them; **Delete everything** erases it from
every form.

## Spam

Every form has protection you don't need to set up: a hidden field only bots fill in, a check
that the form wasn't sent impossibly quickly, and a limit of 10 submissions a minute from one
address. Bots that fall for the first two are told their submission arrived, so they don't
try again, but nothing is saved or emailed.

For more, add free [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
keys in **Forms → Spam and privacy**. Visitors may then be asked to confirm they're human,
usually without having to click anything.

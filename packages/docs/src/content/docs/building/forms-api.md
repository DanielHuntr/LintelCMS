---
title: Forms API
description: Drawing a form from the delivery API, sending submissions, the embed script and webhooks.
since: "0.1"
---

Forms are part of the [delivery API](/building/delivery-api/): a website asks for a form's
fields, draws it however it likes, and posts the answers back. Lintel checks every answer
again on the server. The embed script does all of this for you on any site.

Forms are public even when the delivery API needs a token, because a form on a public page
can't keep a token secret. Browsers may call them from the websites listed in
**Build → API access**, as for the rest of `/delivery`.

## Endpoints

| Request                                    | Response                                            |
| ------------------------------------------ | --------------------------------------------------- |
| `GET /delivery/forms/:handle`              | The form to draw, or 404. Sent with `no-store`      |
| `POST /delivery/forms/:handle/submissions` | 201 `{ received: true, confirmation }`, or an error |
| `GET /delivery/forms.js`                   | The embed script                                    |

Every forms address answers 404 `PLUGIN_NOT_ENABLED` while the Forms plugin is off.

## The form

```json
{
  "handle": "contact",
  "name": "Contact",
  "submitLabel": "Send message",
  "acceptingSubmissions": true,
  "fields": [
    {
      "handle": "email",
      "type": "email",
      "label": "Email address",
      "helpText": "",
      "placeholder": "",
      "required": true,
      "options": {}
    }
  ],
  "steps": [{ "title": null, "fields": ["name", "email", "message", "consent"] }],
  "confirmation": { "type": "message", "message": "Thanks for getting in touch." },
  "spamProtection": {
    "honeypotField": "_website",
    "tokenField": "_token",
    "token": "1761987600000.Qm9...",
    "turnstileSiteKey": null,
    "turnstileField": "cf-turnstile-response"
  }
}
```

`steps` lists field handles in order: one step for an ordinary form, one per step for a
multi-step form. Field types and their `options`:

| `type`                  | Send                      | `options`                                  |
| ----------------------- | ------------------------- | ------------------------------------------ |
| `shortText`, `longText` | text                      | `minLength?`, `maxLength?`                 |
| `email`, `phone`        | text                      | none                                       |
| `number`                | a number, or its text     | `min?`, `max?`, `wholeNumber`              |
| `choice`, `dropdown`    | one of `choices`          | `choices`                                  |
| `checkboxes`            | a list of `choices`       | `choices`                                  |
| `date`                  | `YYYY-MM-DD`              | `earliest?`, `latest?`                     |
| `file`                  | files, multipart only     | `allowedKinds`, `maxMegabytes`, `maxFiles` |
| `consent`               | `true`, `"on"` or `"yes"` | none                                       |
| `hidden`                | text, or the default      | `defaultValue`                             |

## Sending a submission

Send the answers keyed by field handle, plus the `_token` from the form (and nothing in
`_website`). Any of these work:

- **JSON**, `content-type: application/json`, from your own code;
- **multipart/form-data**, needed for file fields, as `new FormData(form)` sends;
- **a plain HTML form post** (`application/x-www-form-urlencoded`). A browser that asks
  for HTML gets a small thank-you page back, a 303 redirect to the form's thank-you page,
  or a page listing what to fix.

```js
const form = await fetch(`${api}/delivery/forms/contact`).then((response) => response.json());

const response = await fetch(`${api}/delivery/forms/contact/submissions`, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({
    [form.spamProtection.tokenField]: form.spamProtection.token,
    name: "Ana Lima",
    email: "ana@example.com",
    message: "Hello!",
    consent: true,
  }),
});
```

Errors use the API's usual shape. A 400 `INVALID_REQUEST` has a message per field, ready to
show next to each input:

```json
{ "code": "INVALID_REQUEST", "fields": { "email": "Email address is required" } }
```

| Status | `code`                 | When                                                              |
| ------ | ---------------------- | ----------------------------------------------------------------- |
| 400    | `INVALID_REQUEST`      | Answers that don't pass; `fields` says which                      |
| 400    | `FORM_EXPIRED`         | `_token` missing, altered or over a day old: fetch the form again |
| 400    | `TURNSTILE_FAILED`     | Turnstile is on and its answer is missing or wrong                |
| 403    | `FORM_CLOSED`          | The form isn't taking submissions                                 |
| 404    | `NOT_FOUND`            | No form with that handle                                          |
| 413    | `FILE_TOO_LARGE`       | A file over 25 MB, or too many parts                              |
| 429    | `TOO_MANY_SUBMISSIONS` | More than 10 a minute from one address                            |

Submissions sent less than three seconds after the form was fetched, or with `_website`
filled in, get a normal 201 but are dropped: only scripts are that quick.

## The embed script

```html
<script src="https://cms.example.com/delivery/forms.js" data-form="contact" async></script>
```

It draws the form after the script tag, with labels, help text and errors tied to their
inputs, one step at a time for multi-step forms, and checks answers before sending. It needs
no framework.

| Attribute             | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `data-form`           | The form's handle (required)                              |
| `data-target`         | A CSS selector to draw into, instead of after the script  |
| `data-api`            | The API's address, if the script is served from elsewhere |
| `data-styles="none"`  | Leave out the small built-in stylesheet                   |
| `data-field-<handle>` | Fills in a field, such as `data-field-source="footer"`    |

The built-in styles inherit your site's font and colours; change
`--lintel-form-accent` on `.lintel-form` to match your brand. After a successful
submission the container fires a `lintel-form:submitted` event. For single-page apps,
`window.LintelForms.render(element, "contact", { apiUrl })` draws a form into an element.

## Forms on pages

Switching the Forms plugin on adds a **Form** section to pages. The delivery API serves it
like any other block, with the form's handle:

```json
{ "id": "…", "type": "form", "data": { "heading": "Get in touch", "form": "contact" } }
```

Render it with the embed script (`data-form` set to `data.form`), or fetch
`/delivery/forms/contact` and draw it yourself.

## Webhooks

Webhooks that ask for `form.submitted` are sent:

```json
{
  "event": "form.submitted",
  "text": "New Contact submission from ana@example.com: https://admin.example.com/forms/…",
  "data": {
    "form": { "id": "…", "handle": "contact", "name": "Contact" },
    "submission": {
      "id": "…",
      "createdAt": "2026-11-01T09:00:00.000Z",
      "values": { "name": "Ana Lima", "email": "ana@example.com" },
      "submitterEmail": "ana@example.com",
      "url": "https://admin.example.com/forms/…/submissions?submission=…"
    }
  }
}
```

`text` is what Slack's incoming webhooks show. Signing and retries are as for every
webhook (see `packages/core/src/webhooks/README.md`).

## Email

Notifications go through `server.email` (`packages/core/src/email`). Out of the box it is a
development outbox that writes each message to the server log and sends nothing; pass a real
sender to `buildServer({ email })` to deliver mail.

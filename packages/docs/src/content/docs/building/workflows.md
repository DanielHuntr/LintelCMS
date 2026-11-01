---
title: Workflows and custom code
description: Run your own code, in any language, when something happens in Lintel.
since: "0.1"
---

Automations (workflows in the code) are how Lintel runs custom backend logic without
plugins in its own language. A **Call a web address** step sends an HTTP request to your
server; your server can be written in anything that speaks HTTP. The editor-facing side is
described in [Automations](/using/automations/).

## The HTTP step

A step has an address, a method (`POST` by default; `PUT`, `PATCH`, `GET`, `DELETE`),
optional headers, an optional JSON body template, whether to sign, and a timeout (1 to 30
seconds, 10 by default). Addresses, header values and the body can use templates.

### What your server receives

```http
POST /lintel/content-changed HTTP/1.1
Content-Type: application/json
User-Agent: Lintel-Workflows/1
Lintel-Workflow: 6c1f…   (the workflow's id)
Lintel-Run: 0b9e…        (the run's id)
Idempotency-Key: 0b9e…:callServer
Lintel-Signature: t=1793500000,v1=5257a869e7ec…
Lintel-Test: true        (only in test runs)
```

With an empty body template, the body is everything the run knows:

```json
{
  "event": { "id": "…", "name": "entry.published", "occurredAt": "2026-11-01T09:00:00.000Z" },
  "entry": {
    "id": "…",
    "collection": "posts",
    "slug": "hello-world",
    "title": "Hello world",
    "url": "/blog/hello-world",
    "status": "published",
    "publishedAt": "2026-11-01T09:00:00.000Z",
    "fields": { "title": "Hello world", "summary": "…" }
  },
  "actor": { "id": "…", "name": "Ana", "email": "ana@example.com", "roles": ["editor"] },
  "workflow": { "id": "…", "name": "Call my server" },
  "steps": { "check1": { "status": "succeeded", "matched": true } }
}
```

Other events carry their own data instead of `entry`: `asset` for files, `form` and
`submission` for forms, `user` and `roles` for invitations. Events from plugins carry
whatever the plugin declared.

### Body templates

The body template must be valid JSON. Placeholders go inside strings and are filled in
safely, so a title with quotes in it can't break the JSON. A string that is only a
placeholder keeps the value's type:

```json
{
  "text": "New post: {{entry.title}}",
  "entry": "{{entry}}",
  "wordCount": "{{steps.call1.body.words}}"
}
```

Templates are dotted paths into the run, and nothing else: no expressions, function calls
or access to the server. Missing values become empty.

### Answering

- Any `2xx` counts as done. If you answer with JSON, later steps can read it:
  `{{steps.<step id>.status}}` and `{{steps.<step id>.body.<name>}}`, in messages or in a
  **Only continue if…** step with **A value is**.
- `5xx`, `429`, timeouts and connection errors are retried after 30 seconds, 2 minutes,
  10 minutes and an hour, then the run fails. Other answers fail the step at once.
- Retries carry the same `Idempotency-Key`, so store it and ignore repeats.
- Redirects are not followed, and private or local addresses are refused (as for
  webhooks). Set `WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true` to test against your own machine.

## Checking the signature

`Lintel-Signature` is `t=<unix seconds>,v1=<hex>`, where `v1` is the HMAC-SHA256 of
`"<t>.<raw body>"` keyed with the workflow's signing secret (shown in the builder under
**For developers**). It is the same scheme as webhooks. Check it against the raw body,
before parsing, in constant time, and refuse timestamps more than five minutes old.

### Node

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function isFromLintel(secret, rawBody, header) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest();
  const received = Buffer.from(parts.v1 ?? "", "hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && received.length === expected.length && timingSafeEqual(expected, received);
}
```

### Python

```python
import hashlib, hmac, time

def is_from_lintel(secret: str, raw_body: bytes, header: str) -> bool:
    parts = dict(part.split("=", 1) for part in header.split(","))
    signed = parts["t"].encode() + b"." + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    fresh = abs(time.time() - int(parts["t"])) < 300
    return fresh and hmac.compare_digest(expected, parts.get("v1", ""))
```

### PHP

```php
function is_from_lintel(string $secret, string $rawBody, string $header): bool {
    parse_str(str_replace(',', '&', $header), $parts);
    $expected = hash_hmac('sha256', $parts['t'] . '.' . $rawBody, $secret);
    $fresh = abs(time() - (int) $parts['t']) < 300;
    return $fresh && hash_equals($expected, $parts['v1'] ?? '');
}

// $rawBody = file_get_contents('php://input');
// $header  = $_SERVER['HTTP_LINTEL_SIGNATURE'] ?? '';
```

### C#

```csharp
using System.Security.Cryptography;
using System.Text;

static bool IsFromLintel(string secret, string rawBody, string header)
{
    var parts = header.Split(',').Select(part => part.Split('=', 2))
        .ToDictionary(pair => pair[0], pair => pair.Length > 1 ? pair[1] : "");
    var timestamp = long.Parse(parts["t"]);
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestamp}.{rawBody}"));
    var received = Convert.FromHexString(parts.GetValueOrDefault("v1", ""));
    var fresh = Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - timestamp) < 300;
    return fresh && CryptographicOperations.FixedTimeEquals(expected, received);
}
```

## Runs, retries and idempotency

Every run is stored, with the workflow's steps copied in and a log line per step, so a
server restart carries runs on where they stopped and a finished step is never repeated.
Runs started by an event are keyed by the event's id, scheduled runs by the minute they
are for, so nothing starts twice even with several servers. Runs that start other runs
(a child workflow, or a change that triggers another workflow) stop after five levels.

## The API

The admin's builder uses these endpoints. They need someone signed in with the
`workflows:read` and `workflows:update` permissions; API tokens don't include them, like
other settings.

| Method and path                     | What it does                                       |
| ----------------------------------- | -------------------------------------------------- |
| `GET /workflows`                    | Every workflow                                     |
| `GET /workflows/catalogue`          | The events that can start one, and the roles       |
| `POST /workflows`                   | `{ name, trigger, steps, description?, enabled? }` |
| `PATCH /workflows/:id`              | Any of those                                       |
| `DELETE /workflows/:id`             | Remove it and its history                          |
| `POST /workflows/:id/run`           | `{ test?, sampleData?, data?, idempotencyKey? }`   |
| `GET /workflows/:id/runs`           | The history, newest first                          |
| `GET /workflow-runs/:runId`         | One run with its step log                          |
| `POST /workflow-runs/:runId/cancel` | Stop a run that hasn't finished                    |

For a workflow with a **When I press Run** trigger, `POST /workflows/:id/run` with
`{ "data": { … } }` puts `data` in the run, so `{{orderId}}` in a template reads
`data.orderId`.

## Your own events

Features and plugins publish events on Lintel's event bus and declare them, so they
appear in the builder's list with sample data for test runs. See `src/events/README.md`
in `packages/core`, and [Plugins](/building/plugins/).

---
title: Building an app
description: Extend Lintel from your own server in any language, with a manifest, scoped credentials, webhooks and pages in the admin.
since: "0.1"
---

An **app** is a program on your own server, in any language, that works with a Lintel site
without changing Lintel's code: it reads and changes content through the API, hears about
events through webhooks, and shows its own pages inside the admin. Site owners install it
in **Build → Apps** (see [Apps](/using/apps/)).

Apps are not add-ons ([plugins](/building/plugins/)). An add-on is code that runs inside
Lintel, with full access, and is listed in **Build → Add-ons**. An app runs elsewhere, gets
only the access the owner approves, and its pages are shown in sandboxed frames; it is
listed beside add-ons, in **Build → Apps**. Build an app to connect a service or to write
it in another language; build an add-on for a new kind of field or builder element.

## Start one

```bash
pnpm lintel apps new stock-sync
cd stock-sync
npm install
npm test     # checks its session tokens, webhooks and pages
npm start    # http://localhost:3200
```

That makes a working app in plain Node, with nothing to build: its manifest
(`src/manifest.js`), a server (`src/server.js`), a page inside the admin using
`@lintel/app-bridge`, the session token and webhook checks, tests and a README. Then in
Lintel, turn on [development mode](#development-mode) in **Build → Apps**, press **Add an
app** and give `http://localhost:3200/lintel-app.json`. Put the client ID and secret Lintel
shows into the app's `.env` and start it again: its page is in the sidebar.

`examples/app-node` is a fuller app, "Publishing Log", with a widget, an editor panel and
a settings page. Read it beside this page; the same steps in C# and Python are
[at the end](#the-same-in-c-and-python).

## How it fits together

1. You publish a **manifest**, `lintel-app.json`, describing the app.
2. An admin adds it. Lintel shows what it asks for in plain English, and on approval
   creates a **client id** and a **client secret**, which the admin copies into your app.
3. Your server calls the **API** with the secret, receives **webhooks** signed with the
   secret, and checks the **session tokens** your pages are given, also with the secret.
4. Your pages run in frames in the admin and talk to it through **`@lintel/app-bridge`**.
5. Uninstalling revokes the secret, deletes the webhooks and removes the pages at once.

## The manifest

```json
{
  "name": "Publishing Log",
  "handle": "publishing-log",
  "description": "Keeps a log of everything published on your site.",
  "icon": "https://log.example.com/assets/icon.svg",
  "appUrl": "https://log.example.com",
  "developer": { "name": "Example Ltd", "url": "https://example.com" },
  "scopes": ["read_content"],
  "webhooks": [
    { "event": "entry.published", "url": "https://log.example.com/webhooks" },
    { "event": "entry.unpublished", "url": "https://log.example.com/webhooks" }
  ],
  "admin": {
    "page": { "label": "Publishing log", "url": "https://log.example.com/admin/log" },
    "dashboardWidgets": [
      {
        "id": "recently-published",
        "title": "Recently published",
        "description": "The last few things that went live",
        "url": "https://log.example.com/admin/widget",
        "size": "medium"
      }
    ],
    "editorPanels": [
      {
        "id": "history",
        "title": "Publishing log",
        "url": "https://log.example.com/admin/panel",
        "collections": ["pages", "posts"]
      }
    ],
    "settingsPage": { "url": "https://log.example.com/admin/settings" }
  }
}
```

| Field                    | Notes                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `name`, `description`    | Shown to the person installing. Up to 60 and 500 characters.                                    |
| `handle`                 | Lowercase letters, numbers and dashes. Unique on a site; the app's page is at `/apps/<handle>`. |
| `appUrl`                 | The app's origin. The icon and every admin page must be on it.                                  |
| `scopes`                 | What the app may do; see below. Ask for as little as you can.                                   |
| `webhooks`               | Events and where to send them; each event needs the scope that reads what it is about.          |
| `admin.page`             | A sidebar item and a full page.                                                                 |
| `admin.dashboardWidgets` | Widgets people can add to their dashboard: `small`, `medium` or `large`.                        |
| `admin.editorPanels`     | Sections beside the entry editor; `collections` limits them to some collections.                |
| `admin.settingsPage`     | A row in Settings, under Apps, for admins.                                                      |

Addresses must be `https://`, except `http://localhost` and `http://127.0.0.1` while you
develop. An app can't be on the same origin as Lintel's admin or API. Lintel keeps the copy
the owner approved: changing the file later changes nothing until the app is installed
again, and if it asks for different scopes between review and install, the install stops.

## Development mode

Lintel won't normally read a manifest from, or send webhooks to, an address on its own
computer. While you build an app there, open **Build → Apps** and turn on **Development
mode** at the bottom. Lintel shows a warning at the top of the page for as long as it's
on, and allows `localhost`, `127.0.0.1` and `[::1]` for apps only: the rest of the private
network stays closed, and other webhooks are unchanged. Turn it off when you've finished;
an app installed while it was on stops getting webhooks.

The switch is only offered where the server allows it, set by `APPS_DEVELOPMENT_MODE`:
left empty it is allowed when Lintel runs in development (`pnpm dev`) and not in
production; `true` or `false` decides. You no longer need
`WEBHOOKS_ALLOW_PRIVATE_ADDRESSES` for this, which opens every private address to every
webhook.

## Scopes

| Scope             | Permissions                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `read_content`    | Entries (with drafts), content types, collections, taxonomies, global sets, menus |
| `write_content`   | Create, edit and delete entries                                                   |
| `publish_content` | Publish and unpublish entries                                                     |
| `read_media`      | The media library                                                                 |
| `write_media`     | Upload, change and delete files                                                   |
| `read_forms`      | Forms and the entries people send through them                                    |
| `read_orders`     | The shop's orders and who placed them, not products or settings                   |
| `write_orders`    | Mark orders as sent and add notes; never refunds or cancelling                    |

`read_orders` and `write_orders` need the shop switched on, and `read_forms` needs forms:
an app that asks for them can't be installed until the feature is on in **Build →
Features**. The `form.submitted` webhook needs `read_forms`.

No scope reaches settings, users, roles, webhooks or apps, or a page's design
(`builder:design`): apps change content, like a content-only client, so on a site where
clients' changes wait for approval, publishing answers 403 `REVIEW_NEEDED` and the app
sends the entry for review (`POST /entries/:id/review`) instead. An app acts for the
person who installed it, and only gets its scopes' permissions **that they also have**,
checked on every request: if their role changes, the app's access changes with it, and if
their account is deactivated the app stops working. An app installed by an Owner is still
limited to its scopes.

## Calling the API

Send the client secret as a bearer token, exactly like an API token:

```bash
curl https://cms.example.com/collections/pages/entries \
  -H "Authorization: Bearer lintelapp_..."
```

Every REST endpoint, the delivery API and GraphQL accept it. Anything outside the app's
scopes answers 403. A secret that is wrong or uninstalled answers 401 `INVALID_API_TOKEN`.
Each app may make 240 requests a minute; past that Lintel answers 429 `APP_RATE_LIMITED`
with a `Retry-After` header in seconds. Entries the app changes show the installer's name.

Keep the secret on your server. It never belongs in a page's code.

## Webhooks

The events in the manifest are sent as `POST` requests with a JSON body:

```json
{
  "id": "delivery id",
  "event": "entry.published",
  "occurredAt": "2026-11-01T09:00:00.000Z",
  "data": { "entry": { "id": "…", "collection": "pages", "slug": "about", "title": "About" } }
}
```

They are signed with the client secret:

```text
Lintel-Signature: t=1793500000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

`v1` is the HMAC-SHA256, in hex, of `<t>.<raw body>`. Check it against the body exactly as
it arrived, before parsing, compare in constant time, and refuse a `t` more than five
minutes away. Answer with any 2xx; anything else is retried for a while.
`Lintel-Delivery` is the same on every retry, so you can skip one you've already handled.

## Pages in the admin

Your pages are loaded in a frame with
`?lintelOrigin=<the admin's origin>&extension=page|widget|panel|settings&extensionId=<id>`.
The frame is sandboxed: scripts, forms, popups and downloads work, and the page keeps its
own cookies, but it can't navigate the admin or use the camera, location and so on.

Use `@lintel/app-bridge` (no dependencies, no framework; serve its `dist` folder as plain
files if your app has no build step):

```js
import { createAppBridge } from "/assets/app-bridge/index.js";

const lintel = createAppBridge();
const { context } = await lintel.ready();
// context: { appId, extension, extensionId, user: { id, name }, theme, locale,
//            entry: { id, collection, slug, title } (panels), widgetSize (widgets) }

lintel.autoResize(); // the frame follows the page's height
const response = await lintel.fetch("/api/log"); // adds "Authorization: Bearer <session token>"
lintel.toast("Saved", { tone: "success" }); // shown as "Publishing Log: Saved"
lintel.navigate("/content/pages"); // opens an admin screen
```

The bridge only talks to the admin's origin and only listens to the window that embeds
the page. The admin only listens to your app's origin, from your frame.

### Session tokens

`ready()` and `lintel.fetch` give your page a **session token**, so your server knows who is
looking. It is a standard JWT, signed with HS256 using your client secret, and lasts five
minutes; the bridge fetches a fresh one when it runs low.

| Claim                      | What it is                                                            |
| -------------------------- | --------------------------------------------------------------------- |
| `aud`                      | Your client id: refuse tokens for anyone else                         |
| `sub`                      | The person's user id in Lintel                                        |
| `appId`                    | Your app's id on that site                                            |
| `permissions`              | What your app may do for this person (your scopes ∩ their role)       |
| `dest`                     | The admin's origin                                                    |
| `iss`                      | The Lintel API's address                                              |
| `iat`, `nbf`, `exp`, `jti` | When it was made, from when and until when it counts, and a unique id |

On your server, for every request: accept only `alg: HS256`, check the signature with the
client secret, check `exp` and `nbf` (a few seconds' leeway is fine) and that `aud` is your
client id. Only then trust `sub`. Any JWT library does this, for example
`jwt.decode(token, secret, algorithms=["HS256"], audience=client_id)` in PyJWT.

### Keeping your pages safe

- Send `Content-Security-Policy: frame-ancestors <the admin's origin>` with every admin
  page, so no other site can frame it and trick someone into clicking.
- Never trust anything from the page itself (the `context`, query parameters): only the
  verified session token.
- Pass `createAppBridge({ lintelOrigin })` yourself when your app serves one Lintel site.

## The same in C# and Python

### ASP.NET Core minimal API

```csharp
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var clientId = builder.Configuration["Lintel:ClientId"]!;
var secret = Encoding.UTF8.GetBytes(builder.Configuration["Lintel:ClientSecret"]!);

// Only the Lintel admin may frame the app's pages.
app.Use(async (context, next) =>
{
    context.Response.Headers.ContentSecurityPolicy = "frame-ancestors https://admin.example.com";
    await next();
});

app.MapGet("/api/log", (HttpRequest request) =>
{
    var authorization = request.Headers.Authorization.ToString();
    var claims = authorization.StartsWith("Bearer ") ? VerifySessionToken(authorization[7..]) : null;
    return claims is { } verified
        ? Results.Ok(new { user = verified.GetProperty("sub").GetString() })
        : Results.Unauthorized();
});

app.MapPost("/webhooks", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync(); // the raw body, before any parsing
    if (!VerifyWebhook(body, request.Headers["Lintel-Signature"].ToString()))
        return Results.Unauthorized();
    var payload = JsonDocument.Parse(body).RootElement; // payload.GetProperty("event")...
    return Results.NoContent();
});

app.Run();

JsonElement? VerifySessionToken(string token)
{
    var parts = token.Split('.');
    if (parts.Length != 3) return null;
    try
    {
        var header = JsonDocument.Parse(Base64UrlDecode(parts[0])).RootElement;
        if (header.GetProperty("alg").GetString() != "HS256") return null;
        var expected = HMACSHA256.HashData(secret, Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"));
        if (!CryptographicOperations.FixedTimeEquals(expected, Base64UrlDecode(parts[2]))) return null;
        var claims = JsonDocument.Parse(Base64UrlDecode(parts[1])).RootElement;
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (claims.GetProperty("exp").GetInt64() + 10 < now) return null;
        if (claims.GetProperty("nbf").GetInt64() - 10 > now) return null;
        return claims.GetProperty("aud").GetString() == clientId ? claims : null;
    }
    catch (Exception error) when (error is FormatException or JsonException or KeyNotFoundException)
    {
        return null;
    }
}

bool VerifyWebhook(string body, string signatureHeader)
{
    var parts = signatureHeader.Split(',')
        .Select(part => part.Split('=', 2))
        .Where(pair => pair.Length == 2)
        .ToDictionary(pair => pair[0].Trim(), pair => pair[1]);
    if (!parts.TryGetValue("t", out var t) || !long.TryParse(t, out var timestamp)) return false;
    if (Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - timestamp) > 300) return false;
    if (!parts.TryGetValue("v1", out var v1)) return false;
    var expected = HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes($"{timestamp}.{body}"));
    try { return CryptographicOperations.FixedTimeEquals(expected, Convert.FromHexString(v1)); }
    catch (FormatException) { return false; }
}

static byte[] Base64UrlDecode(string text) =>
    Convert.FromBase64String(text.Replace('-', '+').Replace('_', '/')
        .PadRight(text.Length + (4 - text.Length % 4) % 4, '='));
```

`Microsoft.IdentityModel.JsonWebTokens` can do the token check instead, with a
`SymmetricSecurityKey` of the secret, `ValidAlgorithms = ["HS256"]` and `ValidAudience` set
to your client id.

### Python with Flask

```python
import base64, hashlib, hmac, json, os, time
from flask import Flask, abort, request

app = Flask(__name__)
CLIENT_ID = os.environ["LINTEL_CLIENT_ID"]
SECRET = os.environ["LINTEL_CLIENT_SECRET"].encode()


@app.after_request
def only_lintel_may_frame(response):
    response.headers["Content-Security-Policy"] = "frame-ancestors https://admin.example.com"
    return response


def b64url(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def verify_session_token(token: str):
    try:
        header, payload, signature = token.split(".")
        if json.loads(b64url(header)).get("alg") != "HS256":
            return None
        expected = hmac.new(SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, b64url(signature)):
            return None
        claims = json.loads(b64url(payload))
        now = time.time()
        if claims["exp"] + 10 < now or claims["nbf"] - 10 > now or claims["aud"] != CLIENT_ID:
            return None
        return claims
    except (ValueError, KeyError):
        return None


def verify_webhook(body: bytes, header: str) -> bool:
    parts = dict(part.strip().split("=", 1) for part in header.split(",") if "=" in part)
    try:
        timestamp = int(parts["t"])
    except (KeyError, ValueError):
        return False
    if abs(time.time() - timestamp) > 300:
        return False
    expected = hmac.new(SECRET, f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))


@app.get("/api/log")
def log():
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    claims = verify_session_token(token)
    if claims is None:
        abort(401)
    return {"user": claims["sub"], "permissions": claims["permissions"]}


@app.post("/webhooks")
def webhooks():
    body = request.get_data()  # the raw bytes, before any parsing
    if not verify_webhook(body, request.headers.get("Lintel-Signature", "")):
        abort(401)
    event = json.loads(body)  # event["event"], event["data"]["entry"]...
    return "", 204
```

## Checklist before you share an app

- The manifest asks for the fewest scopes that work, and every address is `https://`.
- Admin pages send `frame-ancestors` with the admin's origin.
- Every request from your pages is checked with the session token; webhooks with the
  signature; both in constant time, on the raw data.
- The client secret lives only on your server, and you can replace it (the owner
  uninstalls and installs again).

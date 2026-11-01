---
title: Use Lintel with hosting that doesn't support Node.js
description: Keep the hosting you have (cPanel, PHP-only shared hosting, any FTP space) and let Lintel publish your website to it as files.
since: "0.6"
sidebar:
  label: Hosting without Node.js
---

Lots of hosting can't run Lintel itself: PHP-only shared hosting, cPanel without "Setup
Node.js App", or plain FTP web space. You can still use Lintel for your website.

Lintel's admin runs somewhere that can run it: your own computer, or a small cloud server.
When you're happy with your changes, Lintel **publishes your website as files** to the
hosting you already have. Visitors see an ordinary, fast website; you keep editing in Lintel.

## What you get, and what you don't

| Feature                                  | Lintel running live | Published as files                                    |
| ---------------------------------------- | ------------------- | ----------------------------------------------------- |
| Pages, blog posts, menus, pictures       | Yes                 | Yes, looking exactly the same                         |
| Blog lists, categories, tags, RSS        | Yes                 | Yes                                                   |
| Sitemap, robots.txt, redirects, 404 page | Yes                 | Yes                                                   |
| Search                                   | Yes                 | Yes, built into the site                              |
| Forms                                    | Yes                 | Yes, through a small PHP file (or straight to Lintel) |
| Shop: product pages                      | Yes                 | Yes                                                   |
| Shop: basket and checkout                | Yes                 | Yes, through the same PHP file, with Stripe or Mollie |
| Changes show straight away               | Yes                 | After you publish (or automatically, a minute later)  |
| Live preview of drafts                   | Yes                 | In Lintel's admin, as always                          |
| Member logins and members-only pages     | Yes                 | **No**: they need Lintel running live                 |

Lintel's admin tells you the same thing for each place you publish to, under **What works on
this hosting**.

## Step by step

### 1. Run Lintel

Either on your own computer:

```sh
pnpm install
pnpm build
pnpm start
```

Then open the address it prints and follow the setup screen. Lintel keeps its database in
the `.lintel` folder, so back that folder up like any important document.

Or on a small cloud server, so you can edit from anywhere (see
[Keep editing from anywhere](#keep-editing-from-anywhere)).

### 2. Find your hosting's details

In your hosting control panel (cPanel: **Files → FTP Accounts**), find:

- the **FTP server** (often `ftp.yourdomain.com`),
- a **username** and **password** (make an FTP account just for Lintel if you can),
- the **website folder** (usually `public_html`).

### 3. Connect them in Lintel

1. Open **Settings → Publishing** and choose **Add a destination**.
2. Choose **FTP or FTPS** (or **SFTP** if your host offers SSH).
3. Type the details from step 2 and your website's address, such as `https://www.example.com`.
4. Leave **Security** on **FTPS: encrypted** unless your host only offers plain FTP.
5. Save, then press **Test connection**. Lintel writes a tiny file and removes it again, so a
   wrong password or folder shows up now rather than later.

Passwords are stored encrypted and never shown again.

### 4. Publish

Press **Publish website**. The first time, everything is uploaded; after that only what
changed. You can see each publish in **Publishing history**: what was uploaded, what was
removed, and anything that went wrong, in plain words.

Turn on **Publish automatically** to publish about a minute after you publish a page or a
post, scheduled posts included.

Rather upload by hand? Choose **Download as ZIP**, then upload the `website` folder's
contents with your host's File Manager.

Lintel only removes files it uploaded itself, never ones you put there. If a publish would
remove more files than usual (50, unless you change it), it waits and asks you first.

### From the command line

The same works from a terminal or a scheduled task, while Lintel isn't running:

```sh
pnpm lintel publish                      # every destination
pnpm lintel publish --target "My cPanel" --dry-run   # only say what would change
pnpm lintel export --out ./site          # just write the files into a folder
```

## How forms work

Your forms are ordinary forms on your pages. They send answers to `lintel-bridge.php`, a
small PHP file Lintel uploads with your site (any PHP 7.4 or newer works, as on every cPanel
host). It:

- turns away spam (a hidden field bots fill in, and a check that the form wasn't sent
  impossibly fast),
- checks required answers and email addresses,
- keeps the answers safely in a private folder until Lintel collects them.

Lintel collects new submissions every five minutes while it is running, and each time you
publish. They then appear in **Forms** as usual, with the usual emails.

The PHP file's settings, including the key that signs everything between it and Lintel, go
in a `lintel-private` folder **beside** your website folder, where nobody can download
them. If your host doesn't allow that, Lintel puts the folder inside your website and
protects it so it can't be opened from a browser.

If Lintel's own address is reachable from the internet, you can choose **Straight to
Lintel** for forms instead, and the PHP file isn't needed for them.

## How the shop works

Product pages are published like any other page. The basket is kept in the shopper's
browser; when they pay, `lintel-bridge.php` works out the total from a price list Lintel
publishes and signs, so nobody can change a price by editing the page. It holds the stock
for half an hour so two people can't buy the last one, then sends the shopper to Stripe or
Mollie to pay. Paid orders appear in **Orders** when Lintel next collects, with the usual
order emails.

To use it:

1. Connect Stripe or Mollie in **Shop → Settings → Payments**.
2. For Stripe, add a webhook in Stripe's dashboard to
   `https://www.example.com/lintel-bridge.php?action=stripe-webhook` for the event
   `checkout.session.completed`, and paste its signing secret into your destination in
   **Settings → Publishing**. Mollie needs nothing extra.
3. Publish.

Stock levels and discount codes are brought up to date each time you publish and each time
Lintel collects orders. Buy-one-get-one and automatic discounts only work when Lintel runs
live; discount codes for a percentage, an amount or free delivery work everywhere.

## Keep editing from anywhere

Lintel doesn't have to stay on your computer. Run the admin on a small cloud host (see
[Hosting on a VPS with Docker](/hosting/vps-docker/) or [Railway](/hosting/railway/)), keep
your existing hosting for the website, and add it under **Settings → Publishing** there. You
can then edit from any browser, and visitors never touch the Lintel server.

## Web server settings

Lintel writes `.htaccess` for Apache (most shared hosting) and `web.config` for Windows
hosting (IIS). They give clean addresses (`/about` rather than `/about.html`), your 404 page,
your redirects, compression and sensible caching.

On nginx, add this to your site's `server` block:

```nginx
root /var/www/example;
index index.html;
error_page 404 /404.html;

location / {
  try_files $uri $uri/index.html $uri/ =404;
}

location ~ ^/(media/|_lintel/site-) {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~ ^/(\.lintel|lintel-private) {
  deny all;
}

location = /lintel-bridge.php {
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
  fastcgi_pass unix:/run/php/php-fpm.sock;
}

gzip on;
gzip_types text/css application/javascript application/json application/xml application/rss+xml image/svg+xml;
```

Redirects from Lintel's SEO settings also work without any of this: each old address gets a
small page that sends visitors on.

## Troubleshooting

**The connection test times out, or files never finish uploading.** Lintel uses passive FTP,
which nearly every host expects. If your host only allows connections from addresses you
list, add the address of the computer or server Lintel runs on in the control panel
(cPanel: **Remote FTP Access** or **IP Blocker**).

**"The secure connection failed".** Your host may want TLS from the start: choose **FTPS with
TLS from the start (port 990)**. If it offers no encryption at all, plain FTP works, but your
password travels unencrypted; ask your host about SFTP.

**Pages show "Forbidden" or don't update.** Files should be readable by the web server: 644
for files and 755 for folders is usual. Lintel uploads with your FTP account's defaults; your
host's File Manager can fix permissions for a whole folder.

**Forms say the website is still being set up.** The PHP file can't find its settings.
Publish again from Lintel; if your host doesn't let FTP accounts write outside the website
folder, Lintel says so in the publishing history and uses a protected folder inside it.

**Form emails from the host don't arrive.** PHP's `mail()` is often switched off or filtered
on shared hosting. Lintel sends the form emails itself when it collects submissions, through
the email settings in **Settings → Email**, so you don't need it.

**Forms or orders don't appear in Lintel.** Lintel collects them while it is running: if it
runs on your computer, start it and publish (or wait five minutes). Check that **Your
website's address** in the destination is the address visitors use.

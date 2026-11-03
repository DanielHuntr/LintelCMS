---
title: Install on cPanel hosting
description: Run Lintel on shared hosting with cPanel's Setup Node.js App, step by step.
since: "0.1"
sidebar:
  label: cPanel hosting
---

Many shared hosting plans can run Lintel, as long as cPanel has **Setup Node.js App** (the
CloudLinux Node.js Selector, in the **Software** section). This guide takes about twenty
minutes and needs no terminal: everything happens in cPanel's own screens.

:::caution[Only with Setup Node.js App]
Hosting that runs only PHP (no "Setup Node.js App" in cPanel) **can't run Lintel**. Ask
your host whether they offer it with Node.js 22; if not, see the other options in
[Choose where to host Lintel](/hosting/choose/), including publishing your site to PHP
hosting from a Lintel that runs elsewhere.
:::

## What you need

- cPanel hosting with **Setup Node.js App** offering **Node.js 22 or newer**.
- **1 GB of memory** for your account, for the built-in database. With 512 MB, use your
  host's PostgreSQL instead. See [Memory](#memory) for what we measured.
- Your domain, already pointing at the hosting.
- The hosting package, `lintel-hosting-<version>.zip`. Developers make it with
  `pnpm build:hosting`, which puts it in `dist-hosting/`.

Nothing else: Lintel brings its own database, so you don't need MySQL or PostgreSQL.

## 1. Check your hosting can run Lintel

Before installing, spend two minutes with the checker:

1. In cPanel, open **File Manager**, go to your home folder, click **+ Folder** and make
   a folder named `lintel-check`. Open it, click **Upload**, and upload `lintel-check.js`
   (it is beside the zip in `dist-hosting/`).
2. Open **Setup Node.js App** and click **Create Application**. Choose the newest
   **Node.js version**, set **Application root** to `lintel-check`, **Application URL**
   to your domain, and **Application startup file** to `lintel-check.js`. Click **Create**.
3. Open your domain in the browser. The page says **Lintel will run here**, lists any
   limits, or says exactly what to ask your host.
4. Delete that application in Setup Node.js App (the trash icon), and the folder.

If your hosting has no Setup Node.js App at all, upload `lintel-check.php` to
`public_html` instead and open `https://your-domain/lintel-check.php`.

## 2. Upload Lintel

1. In **File Manager**, go to your **home folder** (the top level, not `public_html`).
2. Click **Upload** and choose `lintel-hosting-<version>.zip`. Wait for the bar to finish.
3. Back in File Manager, select the zip and click **Extract**. Extract it into your home
   folder. You now have a folder named `lintel` with `app.js` and `README.txt` in it.
4. Delete the zip.

Keeping Lintel outside `public_html` means none of its files can be downloaded directly.

## 3. Create the Node.js app

Open **Setup Node.js App** and click **Create Application**:

| Field                        | What to enter                                      |
| ---------------------------- | -------------------------------------------------- |
| **Node.js version**          | 22 or newer (the newest in the list)               |
| **Application mode**         | Production                                         |
| **Application root**         | `lintel`                                           |
| **Application URL**          | your domain, with the path left empty              |
| **Application startup file** | `app.js`                                           |
| **Passenger log file**       | `lintel/stderr.log`, if your cPanel shows this box |

Click **Create**. cPanel prepares a place for Lintel's packages; that takes a minute.

## 4. Add the settings

Still on the app's page, under **Environment variables**, click **Add Variable**:

| Name         | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| `PUBLIC_URL` | your site's address with `https://`, such as `https://example.com` |

That is the only one you must set. Click **Save** at the top. (Every other setting is in
the [environment variables reference](/hosting/environment-variables/); email is the one
most people add next, see [step 9](#9-send-email).)

## 5. Install Lintel's packages

Click **Run NPM Install** and wait until it says it has finished (one to three minutes).
It downloads what Lintel needs from npm, including **sharp**, which resizes images.

If the button is missing, check that `package.json` is in the `lintel` folder (step 2).

## 6. Start Lintel and turn on HTTPS

1. Click **Restart** at the top of the app's page.
2. HTTPS: in cPanel, open **SSL/TLS Status** and, if your domain doesn't show a green
   padlock, click **Run AutoSSL**. Then open **Domains** and turn on
   **Force HTTPS Redirect** for it.
3. Open `https://your-domain/admin`. The first visit takes a few seconds while Lintel
   starts.

You'll see the setup wizard. Your website is at `https://your-domain/` and the admin at
`/admin`, both served by the same app.

## 7. Finish the setup wizard

The wizard asks for a **setup code**, because you are setting up from another computer.
To find it:

1. In **File Manager**, click **Settings** (top right), tick **Show Hidden Files** and save.
2. Open the folder `lintel/.lintel` and the file `setup-code.txt`. The code looks like
   `4821-0937`.

Then follow the [setup screens](/using/setup/). Choose **Built-in database** unless your
host gives you PostgreSQL (see [Using your host's PostgreSQL](#using-your-hosts-postgresql)).

## 8. Add the cron job

Shared hosting pauses an app when nobody visits, so Lintel can't rely on its own timers
for scheduled publishing, webhook retries and automations. A cron job wakes it every
five minutes:

1. In **Setup Node.js App**, open the app, click **Run JS script** and choose
   **cron-line**. It prints a line that starts with `*/5 * * * * curl`.
2. In cPanel, open **Cron Jobs**. Under **Add New Cron Job**, pick **Once Per Five
   Minutes** in **Common Settings**.
3. In **Command**, paste everything after the five schedule fields, from `curl` to the
   end. Click **Add New Cron Job**.

The line looks like this, with your own secret and address:

```bash
curl -fsS -X POST -H "X-Lintel-Cron-Secret: 3fX...k9Q" https://example.com/api/system/run-scheduled-jobs > /dev/null
```

Keep it private: the secret is what stops anyone else running your jobs. Lintel made it
for you and keeps it in `lintel/.lintel/cron-secret.txt`; to choose your own, set
`CRON_SECRET` (at least 24 characters) and run **cron-line** again.

## 9. Send email

Until you choose how, Lintel keeps emails in an outbox instead of sending them. Your
hosting's own email account works: in cPanel, open **Email Accounts**, create one such
as `hello@example.com`, then open **Connect Devices** for it to see the SMTP details. Add
these variables in Setup Node.js App and click **Restart**:

| Name            | Value                           |
| --------------- | ------------------------------- |
| `EMAIL_DRIVER`  | `smtp`                          |
| `EMAIL_FROM`    | `Your Site <hello@example.com>` |
| `SMTP_HOST`     | the "Outgoing Server" shown     |
| `SMTP_PORT`     | `465`                           |
| `SMTP_USER`     | `hello@example.com`             |
| `SMTP_PASSWORD` | the email account's password    |

## Restarting

After changing a variable, click **Restart** in Setup Node.js App. You can also restart
from File Manager: open `lintel/tmp/restart.txt` (create it if it's missing), change
anything, and save. Lintel restarts on the next visit.

## Updating Lintel

1. Upload and extract the new `lintel-hosting-<version>.zip` in your home folder, over the
   old one. Your content is safe: it is in `lintel/.lintel`, which the zip doesn't touch.
2. In Setup Node.js App, click **Run NPM Install**, then **Restart**.

Read [Keeping Lintel updated](/hosting/updating/) for what to check after an update.

## Backups

Everything Lintel keeps (the built-in database, uploads and settings) is in
`lintel/.lintel`. cPanel's **Backup** page includes it in a home folder backup. Download
one before every update.

## Using your host's PostgreSQL

The built-in database suits most sites. If your host offers **PostgreSQL Databases** in
cPanel and you prefer it (or the checker said the built-in database can't run here):

1. In **PostgreSQL Databases**, create a database and a user, and add the user to the
   database with all privileges.
2. In the setup wizard, choose **PostgreSQL** and enter `localhost`, port `5432`, and the
   database, user and password you made. cPanel puts your account name in front of both
   names, such as `ana_lintel`.

## Memory

Measured with the hosting package on Node.js 22 (Linux, x64), as resident memory:

| Moment                                                 | Built-in database |
| ------------------------------------------------------ | ----------------- |
| The very first start, while the database is created    | about 800 MB      |
| Every later start, setup wizard open                   | about 460 MB      |
| After opening the admin, the website and the API       | about 470 MB      |
| The same, with `NODE_OPTIONS=--max-old-space-size=192` | about 450 MB      |

About 200 MB of that is the built-in database itself, so with your host's PostgreSQL
Lintel needs roughly 250 to 300 MB. cPanel shows your account's limit under **Resource
Usage** ("Physical memory"):

- **1 GB or more:** the built-in database is fine.
- **512 MB to 1 GB:** choose PostgreSQL in the setup wizard (see
  [Using your host's PostgreSQL](#using-your-hosts-postgresql)).
- **Under 512 MB:** ask your host for more; Lintel won't run reliably.

Resizing a large photo takes more for a moment (a 6000 × 4000 photo needs about 100 MB),
so on a tight limit keep uploads under 20 megapixels.

## Upload sizes

Lintel accepts files up to 25 MB. Your hosting may stop smaller ones first: many cPanel
servers limit a request to 10 or 16 MB (ModSecurity or LiteSpeed's request body limit),
and the upload then fails with "Request Entity Too Large" before Lintel sees it. If large
uploads fail and small ones work, ask your host:
_"Please raise the maximum request body size for my Node.js app to 32 MB."_

## Images without sharp

If **sharp** can't run on your hosting, Lintel still works: images are shown at the size
they were uploaded instead of resized, and the media library says so at the top. Click
**Run NPM Install** again (sharp downloads a version for your server); if the notice stays,
ask your host to allow Node.js native modules, and upload images no wider than 2000 pixels.

## If something goes wrong

**The site shows "503 Service Unavailable" or "Web application could not be started".**
Lintel didn't start. Open `lintel/stderr.log` in File Manager; the last lines say why.
The usual reasons:

- **Run NPM Install wasn't run**, or failed: run it again and read its output.
- **The Node.js version is below 22**: edit the app and pick a newer one, then Run NPM
  Install and Restart.
- **The startup file isn't `app.js`**, or the application root isn't `lintel`.

**The page says "Lintel couldn't start"** and explains a problem, such as `PUBLIC_URL`
missing or a folder it can't write to. Fix what it says, then Restart.

**"Resource limit reached" (508), or the app stops during Run NPM Install.** Your account
hit its memory or process limit. cPanel's **Resource Usage** page shows which. Stop other
Node.js apps, or ask your host for at least 1 GB of memory.

**Scheduled posts aren't published on time.** Check the cron job (step 8): in **Cron
Jobs**, the line should be listed. Run **cron** with Run JS script to try it by hand: it
says which jobs ran, or why it couldn't reach Lintel.

**"Lintel can't save files in its data folder".** In File Manager, select the `lintel`
folder, click **Permissions** and set it to `755`, with the same for `lintel/.lintel`.

## What to ask your host

Copy what applies into a support ticket:

- "Please enable **Setup Node.js App** for my account, with **Node.js 22** or newer."
- "Please make sure my account has at least **1 GB of memory** (PMEM) for Node.js."
- "Please allow outgoing **HTTPS connections** from my Node.js app (for npm and email)."
- "Please raise the **maximum upload size** for my Node.js app to 32 MB."
- "Please allow **Node.js native modules** (the `sharp` package) for my account."

Or run the **doctor** script with Run JS script: it checks all of this from inside your
Lintel and prints the questions that apply.

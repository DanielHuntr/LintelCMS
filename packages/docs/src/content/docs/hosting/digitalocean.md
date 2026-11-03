---
title: Hosting on a DigitalOcean droplet
description: A droplet that installs Lintel, Postgres and HTTPS by itself when it starts.
since: "0.6"
sidebar:
  label: DigitalOcean
---

A [DigitalOcean](https://www.digitalocean.com) droplet is a small server of your own. Lintel
comes with a start-up script: paste it in when you create the droplet, and about ten minutes
later Lintel is running with Postgres and automatic HTTPS. Nothing to type on the server.

## 1. Choose your address

Decide on the address for your site, such as `cms.example.com`. You'll point it at the droplet
in step 3.

## 2. Create the droplet

1. In DigitalOcean, choose **Create → Droplets**.
2. **Image**: Ubuntu 24.04 (LTS).
3. **Size**: at least 2 GB of memory. The installer adds swap on smaller ones, but building
   Lintel is then slow.
4. Under **Advanced Options**, tick **Add Initialization scripts** and paste in
   `deploy/digitalocean/user-data.sh` from Lintel's repository.
5. Change the two lines near the top to your address and your email:

   ```bash
   LINTEL_DOMAIN="cms.example.com"
   LINTEL_EMAIL="you@example.com"
   ```

6. Add your SSH key and choose **Create Droplet**.

## 3. Point your address at it

At the company you bought your domain from, add an `A` record for your address with the
droplet's IP address. Do this straight away: HTTPS can't start until the address reaches the
droplet.

## 4. Finish in your browser

Sign in to the droplet and look at the end of the installer's log for the setup code:

```bash
ssh root@<droplet address>
tail /var/log/lintel-install.log
```

Then open `https://your-address/admin` and enter it.

## Afterwards

- To check everything is well, open **Settings → This server** or see
  [Check this server](/hosting/check-server/).
- To update, run the installer again, as [A VPS in one command](/hosting/one-command/) explains.
- Turn on the droplet's weekly backups, or set up **Settings → Backups**.

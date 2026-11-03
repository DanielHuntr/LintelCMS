#!/usr/bin/env bash
# DigitalOcean droplet "User data": paste this into Advanced Options → Add Initialization
# scripts when you create an Ubuntu droplet, after changing the two lines below. The
# droplet then installs Lintel with Postgres and automatic HTTPS (deploy/install.sh) by
# itself. Point your domain at the droplet's IP address first, so the certificate works.
#
# Progress is in /var/log/lintel-install.log. When it has finished (about ten minutes) the
# setup code is at the end of that file: `tail /var/log/lintel-install.log`.
set -euo pipefail

LINTEL_DOMAIN="cms.example.com"
LINTEL_EMAIL="you@example.com"

curl -fsSL https://raw.githubusercontent.com/DanielHuntr/lintelcms/main/deploy/install.sh \
  | bash -s -- --domain "$LINTEL_DOMAIN" --email "$LINTEL_EMAIL" --yes \
  >>/var/log/lintel-install.log 2>&1

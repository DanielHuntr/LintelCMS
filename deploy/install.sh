#!/usr/bin/env bash
# Installs Lintel on an Ubuntu or Debian server, with automatic HTTPS.
#
#   curl -fsSL https://raw.githubusercontent.com/DanielHuntr/lintelcms/main/deploy/install.sh | sudo bash
#
# It asks for your domain and an email address (for the HTTPS certificate), then:
#
#   with Docker (the default)   installs Docker if needed and runs Lintel, Postgres and Caddy
#                               with deploy/docker-compose.yml
#   with --method node          installs Node.js 22 and Caddy, builds Lintel, and runs it as a
#                               systemd service with the built-in database
#
# Safe to run again: settings and passwords you already have are kept, and it updates
# Lintel to the latest code. Passwords it makes are written to files only, never printed.
#
# Options:
#   --domain cms.example.com   the address people will visit (asked for if left out)
#   --email you@example.com    for Let's Encrypt's expiry notices (asked for if left out)
#   --method docker|node       how to run Lintel (default: docker)
#   --dir /opt/lintel          where Lintel's code goes (default: /opt/lintel)
#   --branch main              which branch of Lintel to install (default: main)
#   --dry-run                  print what would be done, change nothing
#   --yes                      don't ask to confirm (with --domain and --email)
#   --help                     show this

set -euo pipefail

REPOSITORY_URL="https://github.com/DanielHuntr/lintelcms.git"
DOMAIN=""
EMAIL=""
METHOD="docker"
INSTALL_DIR="/opt/lintel"
BRANCH="main"
DRY_RUN=false
ASSUME_YES=false

# Lintel's own service account and folders for the Node.js method.
SERVICE_USER="lintel"
DATA_DIR="/var/lib/lintel"
ENV_DIR="/etc/lintel"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
fail() {
  printf '\nLintel could not be installed: %s\n' "$*" >&2
  exit 1
}

# Runs a command, or only prints it with --dry-run.
run() {
  if [ "$DRY_RUN" = true ]; then
    printf '  would run: %s\n' "$*"
  else
    "$@"
  fi
}

# Writes standard input to a file with the given permissions. With --dry-run, only says so
# (the contents may hold passwords, so they aren't shown).
write_file() {
  local path="$1" mode="$2"
  if [ "$DRY_RUN" = true ]; then
    cat >/dev/null
    printf '  would write: %s\n' "$path"
    return
  fi
  mkdir -p "$(dirname "$path")"
  local temporary
  temporary="$(mktemp "${path}.XXXXXX")"
  cat >"$temporary"
  chmod "$mode" "$temporary"
  mv "$temporary" "$path"
}

show_help() {
  cat <<'HELP'
Installs Lintel on an Ubuntu or Debian server, with automatic HTTPS.

Usage: install.sh [options]

  --domain cms.example.com   the address people will visit (asked for if left out)
  --email you@example.com    for Let's Encrypt's expiry notices (asked for if left out)
  --method docker|node       Docker with Postgres (default), or Node.js + systemd + Caddy
  --dir /opt/lintel          where Lintel's code goes
  --branch main              which branch of Lintel to install
  --dry-run                  print what would be done, change nothing
  --yes                      don't ask to confirm (with --domain and --email)
HELP
}

read_options() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) DOMAIN="${2:-}"; shift 2 ;;
      --email) EMAIL="${2:-}"; shift 2 ;;
      --method) METHOD="${2:-}"; shift 2 ;;
      --dir) INSTALL_DIR="${2:-}"; shift 2 ;;
      --branch) BRANCH="${2:-}"; shift 2 ;;
      --dry-run) DRY_RUN=true; shift ;;
      --yes | -y) ASSUME_YES=true; shift ;;
      --help | -h) show_help; exit 0 ;;
      *) fail "unknown option $1 (see --help)" ;;
    esac
  done
  case "$METHOD" in
    docker | node) ;;
    *) fail "--method should be docker or node" ;;
  esac
}

# Questions go to the terminal, so this works when piped from curl too.
has_terminal() {
  (: </dev/tty) 2>/dev/null
}

ask() {
  local question="$1" answer=""
  printf '%s ' "$question" >/dev/tty
  read -r answer </dev/tty
  printf '%s' "$answer"
}

# Asks, unless there is nobody to ask: then stops, naming the option to use instead.
ask_or_stop() {
  local question="$1" option="$2"
  if [ "$ASSUME_YES" = true ] || ! has_terminal; then
    fail "pass $option (see --help)"
  fi
  ask "$question"
}

is_valid_domain() {
  [[ "$1" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]
}

is_valid_email() {
  [[ "$1" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]
}

ask_for_details() {
  while ! is_valid_domain "$DOMAIN"; do
    [ -n "$DOMAIN" ] && note "\"$DOMAIN\" doesn't look like a domain, such as cms.example.com."
    DOMAIN="$(ask_or_stop "Which domain will Lintel use (such as cms.example.com)?" "--domain")" ||
      exit 1
  done
  while ! is_valid_email "$EMAIL"; do
    [ -n "$EMAIL" ] && note "\"$EMAIL\" doesn't look like an email address."
    EMAIL="$(ask_or_stop "Your email address, for HTTPS certificate notices:" "--email")" ||
      exit 1
  done
  say "About to install Lintel"
  note "Domain:  https://$DOMAIN"
  note "Email:   $EMAIL"
  note "Method:  $METHOD"
  note "Folder:  $INSTALL_DIR"
  if [ "$ASSUME_YES" != true ] && [ "$DRY_RUN" != true ] && has_terminal; then
    local answer
    answer="$(ask "Continue? [Y/n]")"
    case "$answer" in
      "" | y | Y | yes | Yes) ;;
      *) fail "stopped, nothing was changed" ;;
    esac
  fi
}

check_system() {
  if [ "$DRY_RUN" != true ] && [ "$(id -u)" -ne 0 ]; then
    fail "run it as root, for example: curl -fsSL ... | sudo bash"
  fi
  # LINTEL_OS_RELEASE_FILE lets the tests plan a dry run on a computer that isn't Linux.
  local os_release="${LINTEL_OS_RELEASE_FILE:-/etc/os-release}"
  if [ ! -r "$os_release" ]; then
    fail "this installer is for Ubuntu and Debian; see the other hosting guides"
  fi
  # shellcheck disable=SC1090
  . "$os_release"
  case "${ID:-} ${ID_LIKE:-}" in
    *ubuntu* | *debian*) ;;
    *) fail "this installer is for Ubuntu and Debian, and this is ${PRETTY_NAME:-something else}" ;;
  esac
}

# Building the admin needs about 2 GB of memory; small servers get a swap file for it.
add_swap_if_small() {
  local memory_mb
  memory_mb="$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)"
  if [ "$memory_mb" -lt 1900 ] && ! swapon --show | grep -q .; then
    say "Adding 2 GB of swap (this server has ${memory_mb} MB of memory)"
    if [ ! -f /swapfile ]; then
      run fallocate -l 2G /swapfile
      run chmod 600 /swapfile
      run mkswap /swapfile
    fi
    run swapon /swapfile
    if ! grep -q '^/swapfile ' /etc/fstab; then
      if [ "$DRY_RUN" = true ]; then
        note "would add /swapfile to /etc/fstab"
      else
        echo '/swapfile none swap sw 0 0' >>/etc/fstab
      fi
    fi
  fi
}

install_packages() {
  local missing=()
  for command_name in "$@"; do
    command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    say "Installing ${missing[*]}"
    run apt-get update -qq
    run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}"
  fi
}

get_lintel() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    say "Updating Lintel in $INSTALL_DIR"
    run git -c safe.directory="$INSTALL_DIR" -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
    run git -c safe.directory="$INSTALL_DIR" -C "$INSTALL_DIR" checkout --quiet "$BRANCH"
    run git -c safe.directory="$INSTALL_DIR" -C "$INSTALL_DIR" merge --quiet --ff-only "origin/$BRANCH"
  else
    say "Downloading Lintel to $INSTALL_DIR"
    run git clone --quiet --branch "$BRANCH" "$REPOSITORY_URL" "$INSTALL_DIR"
  fi
}

# The value of NAME in a settings file, or nothing.
existing_setting() {
  local file="$1" name="$2"
  [ -f "$file" ] || return 0
  sed -n "s/^${name}=//p" "$file" | tail -n 1
}

new_password() {
  # Letters and numbers only, so it needs no escaping in a database address.
  openssl rand -hex 24
}

install_with_docker() {
  install_packages git curl openssl
  if ! command -v docker >/dev/null 2>&1; then
    say "Installing Docker"
    if [ "$DRY_RUN" = true ]; then
      note "would run: curl -fsSL https://get.docker.com | sh"
    else
      curl -fsSL https://get.docker.com | sh
    fi
  fi
  add_swap_if_small
  get_lintel

  local env_file="$INSTALL_DIR/deploy/.env"
  local password
  password="$(existing_setting "$env_file" POSTGRES_PASSWORD)"
  [ -n "$password" ] || password="$(new_password)"

  say "Writing the settings to $env_file"
  {
    echo "# Written by deploy/install.sh. Re-running it keeps POSTGRES_PASSWORD and anything"
    echo "# below the line it marks."
    echo "LINTEL_DOMAIN=$DOMAIN"
    echo "PUBLIC_URL=https://$DOMAIN"
    echo "POSTGRES_PASSWORD=$password"
    echo "LINTEL_CADDYFILE=./Caddyfile.installed"
    echo "# ---- Your own settings below this line are kept ----"
    if [ -f "$env_file" ]; then
      sed -n '/^# ---- Your own settings below this line are kept ----$/,$p' "$env_file" | tail -n +2
    fi
  } | write_file "$env_file" 600

  write_file "$INSTALL_DIR/deploy/Caddyfile.installed" 644 <<EOF
# Written by deploy/install.sh: deploy/Caddyfile, with the email for HTTPS certificates.
{
	email $EMAIL
}

{\$LINTEL_DOMAIN} {
	reverse_proxy lintel:4000 {
		header_up X-Request-Id {http.request.uuid}
	}
}
EOF

  say "Starting Lintel (the first build takes a few minutes)"
  run docker compose -f "$INSTALL_DIR/deploy/docker-compose.yml" --profile https up -d --build --remove-orphans
  wait_until_ready docker_lintel_is_healthy
  SETUP_CODE_COMMAND="docker compose -f $INSTALL_DIR/deploy/docker-compose.yml exec -T lintel cat /data/setup-code.txt"
}

install_with_node() {
  install_packages git curl openssl gpg
  add_swap_if_small

  if ! node --version 2>/dev/null | grep -Eq '^v(2[2-9]|[3-9][0-9])\.'; then
    say "Installing Node.js 22"
    if [ "$DRY_RUN" = true ]; then
      note "would run: curl -fsSL https://deb.nodesource.com/setup_22.x | bash"
    else
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash
    fi
    run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
  fi
  if ! command -v caddy >/dev/null 2>&1; then
    say "Installing Caddy"
    if [ "$DRY_RUN" = true ]; then
      note "would add Caddy's package repository and install caddy"
    else
      curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
        gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        >/etc/apt/sources.list.d/caddy-stable.list
      apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy
    fi
  fi

  if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    run useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
  fi
  run mkdir -p "$DATA_DIR"
  run chown "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"

  get_lintel
  say "Building Lintel (a few minutes)"
  run chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
  run runuser -u "$SERVICE_USER" -- env HOME="$DATA_DIR" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    bash -c "cd '$INSTALL_DIR' && corepack pnpm install --frozen-lockfile && corepack pnpm build"

  local env_file="$ENV_DIR/lintel.env"
  say "Writing the settings to $env_file"
  {
    echo "# Written by deploy/install.sh. Anything below the marked line is kept on re-runs."
    echo "NODE_ENV=production"
    echo "PUBLIC_URL=https://$DOMAIN"
    echo "HOST=127.0.0.1"
    echo "PORT=4000"
    echo "LINTEL_FOLDER=$DATA_DIR"
    echo "# ---- Your own settings below this line are kept ----"
    if [ -f "$env_file" ]; then
      sed -n '/^# ---- Your own settings below this line are kept ----$/,$p' "$env_file" | tail -n +2
    fi
  } | write_file "$env_file" 600

  write_file /etc/systemd/system/lintel.service 644 <<EOF
# Written by deploy/install.sh
[Unit]
Description=Lintel
After=network-online.target
Wants=network-online.target

[Service]
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$env_file
ExecStart=$(command -v node || echo /usr/bin/node) packages/core/dist/main.js
Restart=on-failure
RestartSec=5
# Lintel finishes the requests in progress before it stops.
KillSignal=SIGTERM
TimeoutStopSec=30
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

  write_file /etc/caddy/Caddyfile 644 <<EOF
# Written by deploy/install.sh. Caddy gets and renews the HTTPS certificate by itself.
{
	email $EMAIL
}

$DOMAIN {
	reverse_proxy 127.0.0.1:4000 {
		header_up X-Request-Id {http.request.uuid}
	}
}
EOF

  say "Starting Lintel"
  run systemctl daemon-reload
  run systemctl enable --now lintel
  run systemctl restart lintel
  run systemctl reload-or-restart caddy
  wait_until_ready node_lintel_is_ready
  SETUP_CODE_COMMAND="cat $DATA_DIR/setup-code.txt"
}

# The image's health check calls /health; Compose reports the result.
docker_lintel_is_healthy() {
  local container
  container="$(docker compose -f "$INSTALL_DIR/deploy/docker-compose.yml" ps -q lintel)"
  [ -n "$container" ] &&
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy ]
}

node_lintel_is_ready() {
  curl -fsS http://127.0.0.1:4000/ready
}

wait_until_ready() {
  local check="$1"
  if [ "$DRY_RUN" = true ]; then
    note "would wait for Lintel to answer"
    return
  fi
  for _ in $(seq 1 90); do
    if "$check" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  fail "Lintel didn't start within three minutes. See the log: $(log_command)"
}

log_command() {
  if [ "$METHOD" = docker ]; then
    echo "docker compose -f $INSTALL_DIR/deploy/docker-compose.yml logs lintel"
  else
    echo "journalctl -u lintel -n 50"
  fi
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    say "Opening ports 80 and 443 in the firewall"
    run ufw allow 80/tcp
    run ufw allow 443
  fi
}

print_next_steps() {
  say "Lintel is installed"
  note "Finish setting up at:  https://$DOMAIN/admin"
  if [ "$DRY_RUN" != true ]; then
    local code
    code="$(bash -c "$SETUP_CODE_COMMAND" 2>/dev/null || true)"
    if [ -n "$code" ]; then
      note "Setup code:            $code"
    fi
  fi
  note ""
  note "If the page doesn't load yet, check that your domain's DNS points at this server."
  note "Log:      $(log_command)"
  note "Update:   run this installer again"
}

main() {
  read_options "$@"
  if [ "$DRY_RUN" = true ]; then
    say "Dry run: nothing will be changed"
  fi
  check_system
  ask_for_details
  if [ "$METHOD" = docker ]; then
    install_with_docker
  else
    install_with_node
  fi
  open_firewall
  print_next_steps
}

SETUP_CODE_COMMAND=""
main "$@"

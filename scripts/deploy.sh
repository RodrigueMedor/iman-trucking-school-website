#!/usr/bin/env bash
set -euo pipefail

# deploy.sh
# Usage: ./deploy.sh [--env-file path/to/envfile] [--dir /absolute/remote/path] [--clone-url git@github.com:org/repo.git]
# Run this on the Hostinger server (SSH) in a shell where you have access to the target deploy directory.

print_usage() {
  cat <<EOF
Usage: $0 [--env-file <path>] [--dir <deploy_dir>] [--clone-url <git_clone_url>]

Options:
  --env-file   Optional path to a .env file which will be exported for the process
  --dir        Target application directory (default: /home/$USER/iman-trucking-school-website)
  --clone-url  Optional git clone URL to fetch the repo when the directory is empty

Example:
  ./deploy.sh --env-file /root/.deploy.env --dir /home/username/iman-trucking-school-website --clone-url git@github.com:RodrigueMedor/iman-trucking-school-website.git

Notes:
- Preferred: set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, APP_URL in Hostinger panel as environment variables.
- If using this script to set env, create an env file with key=value pairs (no exports) and pass --env-file.
EOF
}

# Defaults
ENV_FILE=""
APP_DIR="/home/$USER/iman-trucking-school-website"
CLONE_URL=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"; shift 2;;
    --dir)
      APP_DIR="$2"; shift 2;;
    --clone-url)
      CLONE_URL="$2"; shift 2;;
    -h|--help)
      print_usage; exit 0;;
    *)
      echo "Unknown arg: $1"; print_usage; exit 1;;
  esac
done

echo "Deploy script starting"
echo "Target directory: $APP_DIR"
[ -n "$ENV_FILE" ] && echo "Using env file: $ENV_FILE"
[ -n "$CLONE_URL" ] && echo "Clone URL: $CLONE_URL"

# Load env file if provided
if [ -n "$ENV_FILE" ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
  echo "Loading environment variables from $ENV_FILE"
  # shellcheck disable=SC1090
  set -a
  # support files with comments and blank lines
  awk '!/^\s*#/ && NF' "$ENV_FILE" > /tmp/.deploy_env
  source /tmp/.deploy_env
  set +a
fi

# Ensure directory exists
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# If not a git repo, optionally clone
if [ ! -d ".git" ]; then
  if [ -n "$CLONE_URL" ]; then
    echo "Cloning repository into $APP_DIR"
    rm -rf -- "$APP_DIR"/* || true
    git clone --depth 1 "$CLONE_URL" .
  else
    echo "Warning: Directory is not a git repo and no --clone-url provided. Assuming files are already present."
  fi
else
  echo "Updating repository"
  git fetch --all --prune
  git reset --hard origin/HEAD || git pull --rebase || true
fi

# Node version check
if command -v node >/dev/null 2>&1; then
  echo "Node version: $(node -v)"
else
  echo "Node is not installed or not in PATH. Install Node >=18 via Hostinger panel or nvm." >&2
fi

# Install dependencies and build
if [ -f package-lock.json ]; then
  echo "Installing dependencies (npm ci)"
  npm ci --omit=dev || npm ci || true
else
  echo "No package-lock.json found — running npm install"
  npm install --production || true
fi

if [ -f package.json ]; then
  echo "Building project"
  npm run build || echo "Build failed or not required"
fi

# Process manager: pm2 preferred
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found — installing pm2 globally"
  npm install -g pm2 || true
fi

# Start or restart the app
APP_ENTRY="server.js"
APP_NAME="iman"

# Use pm2 with update-env so new env vars are picked up
if command -v pm2 >/dev/null 2>&1; then
  echo "Starting/restarting with pm2"
  # Start if not running, otherwise reload with new env
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env || pm2 restart "$APP_ENTRY" --name "$APP_NAME" --update-env || true
  else
    pm2 start "$APP_ENTRY" --name "$APP_NAME" --update-env --time || true
  fi
  pm2 save || true
else
  echo "pm2 unavailable; fallback to nohup"
  pkill -f "node .*${APP_ENTRY}" || true
  nohup npm start > out.log 2>&1 &
fi

# Wait a moment for server to start
sleep 2

# Health check
HOST_URL="${APP_URL:-}">
if [ -n "${APP_URL:-}" ]; then
  echo "Checking public health endpoint: ${APP_URL}/api/health"
  curl -fsS "${APP_URL}/api/health" || true
else
  if [ -n "${PORT:-}" ]; then
    echo "Checking local health endpoint: http://localhost:${PORT}/api/health"
    curl -fsS "http://localhost:${PORT}/api/health" || true
  else
    echo "No APP_URL or PORT provided; skipping external health check"
  fi
fi

echo "Deployment finished. Tail logs with: pm2 logs $APP_NAME --lines 200 OR tail -f out.log"

#!/bin/zsh
set -euo pipefail

# Mac Mini 定时抓取入口。由 launchd 调用。
REPO="${TRIP_REPO:-$HOME/nextcloud/jimmiewang/trip.jimmiewang.com}"
LOG_DIR="${TRIP_SCRAPE_LOG_DIR:-$HOME/Library/Logs/trip-flight-scrape}"
mkdir -p "$LOG_DIR"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
LOG_FILE="$LOG_DIR/scrape-$STAMP.log"

{
  echo "=== trip flight scrape $STAMP ==="
  cd "$REPO"
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
    npm run scrape:remote -- --all
} >>"$LOG_FILE" 2>&1

echo "done -> $LOG_FILE"

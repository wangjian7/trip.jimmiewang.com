#!/bin/zsh
set -euo pipefail

# 安装 launchd 定时任务（北京 09:00 / 15:00，依赖 Mac 本地时区）
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_SRC="$REPO/scripts/macmini/com.jimmiewang.trip-flight-scrape.plist.template"
PLIST_DST="$HOME/Library/LaunchAgents/com.jimmiewang.trip-flight-scrape.plist"
RUN_SCRIPT="$REPO/scripts/macmini/run-scrape.sh"

chmod +x "$RUN_SCRIPT"

sed \
  -e "s|REPO_PATH|$REPO|g" \
  -e "s|HOME_PATH|$HOME|g" \
  "$PLIST_SRC" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/com.jimmiewang.trip-flight-scrape" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/com.jimmiewang.trip-flight-scrape"

echo "已安装: $PLIST_DST"
echo "查看: launchctl print gui/$(id -u)/com.jimmiewang.trip-flight-scrape"
echo "手动跑一次: $RUN_SCRIPT"

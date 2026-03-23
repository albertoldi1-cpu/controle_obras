#!/usr/bin/env bash
set -euo pipefail

AGENT_LABEL="com.obra-controle-web.daily-backup"
PLIST_PATH="$HOME/Library/LaunchAgents/$AGENT_LABEL.plist"

launchctl bootout "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1 || true
launchctl disable "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Backup diário removido."

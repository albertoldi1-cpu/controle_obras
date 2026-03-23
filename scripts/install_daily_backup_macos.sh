#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_LABEL="com.obra-controle-web.daily-backup"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$AGENT_LABEL.plist"
LOG_DIR="$ROOT_DIR/backups"
STDOUT_LOG="$LOG_DIR/daily-backup.log"
STDERR_LOG="$LOG_DIR/daily-backup-error.log"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$LOG_DIR"
chmod +x "$ROOT_DIR/scripts/run_daily_backup.sh"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$AGENT_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$ROOT_DIR/scripts/run_daily_backup.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>1</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$STDOUT_LOG</string>
  <key>StandardErrorPath</key>
  <string>$STDERR_LOG</string>
</dict>
</plist>
EOF

# Recarrega sem falhar se já estiver carregado.
launchctl bootout "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/$AGENT_LABEL"
launchctl kickstart -k "gui/$(id -u)/$AGENT_LABEL"

echo "Backup diário instalado."
echo "Horário: todos os dias às 01:00."
echo "PLIST: $PLIST_PATH"
echo "Logs: $STDOUT_LOG e $STDERR_LOG"

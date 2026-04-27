#!/bin/bash
# setup-cron.sh — Har roz subah 9 baje automatically run-daily.mjs chalao
# Usage: bash setup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="$(which node)"
LOG_PATH="$SCRIPT_DIR/cron.log"

CRON_JOB="0 9 * * * cd $SCRIPT_DIR && $NODE_PATH run-daily.mjs >> $LOG_PATH 2>&1"

# Check if already set
if crontab -l 2>/dev/null | grep -q "run-daily.mjs"; then
  echo "✅  Cron job already set!"
else
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "✅  Cron job added! Runs every day at 9:00 AM"
fi

echo ""
echo "Current crontab:"
crontab -l
echo ""
echo "To remove: crontab -e → delete the run-daily.mjs line"
echo "Logs: tail -f $LOG_PATH"

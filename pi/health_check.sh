#!/bin/bash
# health_check.sh — T-BTN Army Dog Wearable — Quick Status Check
# Run this via SSH from your laptop to verify everything is working.
#
# Usage:
#   bash ~/tbtn/health_check.sh
#
# Or from your Mac without SSHing in:
#   ssh pi@raspberrypi.local "bash ~/tbtn/health_check.sh"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        T-BTN Army Dog — Health Check                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Service status ─────────────────────────────────────────────────────────
echo "── 1. Service Status ──────────────────────────────────"
systemctl is-active --quiet tbtn.service \
  && echo "  ✅  tbtn.service is RUNNING" \
  || echo "  ❌  tbtn.service is STOPPED (run: sudo systemctl start tbtn.service)"
echo ""

# ── 2. Internet connectivity ──────────────────────────────────────────────────
echo "── 2. Internet Connectivity ───────────────────────────"
ping -c 1 -W 3 8.8.8.8 &>/dev/null \
  && echo "  ✅  Internet: ONLINE" \
  || echo "  ⚠️   Internet: OFFLINE (data is buffering locally)"

# Show which interface is active
ACTIVE_IF=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $5; exit}')
if [ -n "$ACTIVE_IF" ]; then
  echo "  📡  Active interface: $ACTIVE_IF"
fi
echo ""

# ── 3. Offline buffer status ──────────────────────────────────────────────────
echo "── 3. Offline Buffer (SQLite) ─────────────────────────"
BUFFER_PATH="$(dirname "$0")/buffer.db"
if [ -f "$BUFFER_PATH" ]; then
  PENDING=$(sqlite3 "$BUFFER_PATH" "SELECT COUNT(*) FROM readings WHERE synced=0;" 2>/dev/null)
  TOTAL=$(sqlite3   "$BUFFER_PATH" "SELECT COUNT(*) FROM readings;" 2>/dev/null)
  echo "  📦  Pending upload : $PENDING readings"
  echo "  📊  Total stored   : $TOTAL readings"
  if [ "$PENDING" -gt 0 ]; then
    echo "  ℹ️   These will auto-upload when internet is available."
  fi
else
  echo "  ℹ️   No buffer.db yet (script has not run a reading cycle yet)."
fi
echo ""

# ── 4. Recent log output ──────────────────────────────────────────────────────
echo "── 4. Recent Log (last 15 lines) ─────────────────────"
sudo journalctl -u tbtn.service -n 15 --no-pager 2>/dev/null \
  | sed 's/^/  /' \
  || echo "  (journald logs not available)"
echo ""

# ── 5. Powerbank / voltage check ─────────────────────────────────────────────
echo "── 5. Power Status ────────────────────────────────────"
THROTTLED=$(vcgencmd get_throttled 2>/dev/null)
if echo "$THROTTLED" | grep -q "throttled=0x0"; then
  echo "  ✅  No undervoltage detected (powerbank supply is OK)"
else
  echo "  ⚠️   Throttle flags: $THROTTLED"
  echo "      (0x50005 = undervoltage — use a higher-wattage powerbank)"
fi
echo ""

echo "══════════════════════════════════════════════════════"
echo "  Dashboard: https://your-project.vercel.app"
echo "  Tail live logs: sudo journalctl -u tbtn.service -f"
echo "══════════════════════════════════════════════════════"
echo ""

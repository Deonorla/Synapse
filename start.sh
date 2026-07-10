#!/usr/bin/env bash
set -uo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Helpers ──────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down…${NC}"
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  wait "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  echo -e "${GREEN}All processes stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Preflight checks ────────────────────────────────────────────────
if [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies…${NC}"
  (cd server && npm install)
  (cd client && npm install)
fi

# ─── Start server ─────────────────────────────────────────────────────
echo -e "${CYAN}Starting server…${NC}"
(cd server && npm run dev) &
SERVER_PID=$!
echo -e "${GREEN}  Server PID: $SERVER_PID${NC}"

# ─── Start client ─────────────────────────────────────────────────────
echo -e "${CYAN}Starting client…${NC}"
(cd client && npm run dev) &
CLIENT_PID=$!
echo -e "${GREEN}  Client PID: $CLIENT_PID${NC}"

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  Server: http://localhost:3002${NC}"
echo -e "${BOLD}  Client: http://localhost:5173${NC}"
echo -e "${BOLD}  Press Ctrl+C to stop both.${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo ""

# Wait for both background processes
wait "$SERVER_PID" "$CLIENT_PID"

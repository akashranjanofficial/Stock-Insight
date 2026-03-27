#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Stock-Insight — Local Development Start Script
# ═══════════════════════════════════════════════════════════════════
# Serves on BOTH HTTP and HTTPS:
#   HTTP  → http://localhost:5173
#   HTTPS → https://localhost:5174
#   API   → http://localhost:3001/api
#
# Usage:  ./start-local.sh
# Stops:  Press Ctrl+C (kills all servers)
# ═══════════════════════════════════════════════════════════════════

set -e

API_PORT="${API_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
HTTPS_PORT="${HTTPS_PORT:-5174}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="$PROJECT_DIR/.certs"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║        🚀 Stock-Insight Local Dev            ║"
echo "  ║           HTTP + HTTPS Hosting               ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── PID tracking ─────────────────────────────────────────────────
API_PID=""
FRONTEND_PID=""
HTTPS_PID=""

cleanup() {
  echo -e "\n${YELLOW}Shutting down servers...${NC}"
  [ -n "$HTTPS_PID" ]   && kill $HTTPS_PID 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
  [ -n "$API_PID" ]      && kill $API_PID 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}✓ All servers stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Check pnpm ───────────────────────────────────────────────────
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}pnpm not found. Installing...${NC}"
  npm install -g pnpm
fi

# ── Install dependencies ─────────────────────────────────────────
echo -e "${CYAN}[1/5] Installing dependencies...${NC}"
cd "$PROJECT_DIR"
if [ ! -d "node_modules" ]; then
  pnpm install
  echo -e "${GREEN}✓ Dependencies installed.${NC}"
else
  echo -e "${GREEN}✓ Dependencies already installed.${NC}"
fi

# ── Generate SSL certificates ────────────────────────────────────
echo -e "${CYAN}[2/5] Checking SSL certificates...${NC}"
if [ ! -f "$CERTS_DIR/localhost-key.pem" ] || [ ! -f "$CERTS_DIR/localhost-cert.pem" ]; then
  echo -e "${YELLOW}  Generating self-signed SSL certificate...${NC}"
  mkdir -p "$CERTS_DIR"

  # Check if mkcert is available (produces trusted certs)
  if command -v mkcert &> /dev/null; then
    echo -e "  Using mkcert for locally-trusted certificate..."
    mkcert -install 2>/dev/null || true
    mkcert -key-file "$CERTS_DIR/localhost-key.pem" \
           -cert-file "$CERTS_DIR/localhost-cert.pem" \
           localhost 127.0.0.1 ::1
  else
    # Fallback to OpenSSL self-signed cert
    echo -e "  Using OpenSSL for self-signed certificate..."
    echo -e "  ${YELLOW}(Install 'mkcert' for browser-trusted certs: brew install mkcert)${NC}"
    openssl req -x509 -newkey rsa:2048 \
      -keyout "$CERTS_DIR/localhost-key.pem" \
      -out "$CERTS_DIR/localhost-cert.pem" \
      -days 365 -nodes \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" \
      2>/dev/null
  fi

  # Add .certs to .gitignore if not already there
  if ! grep -q "^\.certs" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
    echo -e "\n# Local SSL certificates\n.certs/" >> "$PROJECT_DIR/.gitignore"
  fi

  echo -e "${GREEN}✓ SSL certificates generated in .certs/${NC}"
else
  echo -e "${GREEN}✓ SSL certificates already exist.${NC}"
fi

# ── Build API server ─────────────────────────────────────────────
echo -e "${CYAN}[3/5] Building API server...${NC}"
cd "$PROJECT_DIR"
pnpm --filter @workspace/api-server run build
echo -e "${GREEN}✓ API server built.${NC}"

# ── Start API server (background) ────────────────────────────────
echo -e "${CYAN}[4/5] Starting API server on port ${API_PORT}...${NC}"
PORT=$API_PORT NODE_ENV=development pnpm --filter @workspace/api-server run start &
API_PID=$!
sleep 2

if ! kill -0 $API_PID 2>/dev/null; then
  echo -e "${RED}✗ API server failed to start!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ API server running.${NC}"

# ── Start frontend + HTTPS proxy ─────────────────────────────────
echo -e "${CYAN}[5/5] Starting frontend servers...${NC}"

# HTTP frontend (Vite dev server)
API_PORT=$API_PORT pnpm --filter @workspace/indian-stock-analyzer run dev &
FRONTEND_PID=$!
sleep 2

# HTTPS proxy
HTTPS_PORT=$HTTPS_PORT HTTP_TARGET_PORT=$FRONTEND_PORT node "$PROJECT_DIR/scripts/https-proxy.mjs" &
HTTPS_PID=$!
sleep 1

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║                                                  ║"
echo "  ║   🌐 HTTP:   http://localhost:${FRONTEND_PORT}               ║"
echo "  ║   🔒 HTTPS:  https://localhost:${HTTPS_PORT}               ║"
echo "  ║   📡 API:    http://localhost:${API_PORT}/api            ║"
echo "  ║                                                  ║"
echo "  ║   Press Ctrl+C to stop all servers               ║"
echo "  ║                                                  ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Wait for all background processes
wait $API_PID $FRONTEND_PID $HTTPS_PID

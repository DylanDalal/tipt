#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ID=demo-project
LOG_DIR=.logs
mkdir -p "$LOG_DIR"

# ---- deps -------------------------------------------------------------
npm ci
command -v firebase >/dev/null || npm i -g firebase-tools@latest

# ---- emulators --------------------------------------------------------
echo "Starting Firebase Emulator Suite…"
npx firebase emulators:start \
  --project "$PROJECT_ID" \
  --only firestore,auth,storage,ui \
  >"$LOG_DIR/firebase.log" 2>&1 &
emu_pid=$!

# ---- vite -------------------------------------------------------------
echo "Starting Vite dev server…"
npm run dev -- --strictPort --port 5173 >"$LOG_DIR/vite.log" 2>&1 &
vite_pid=$!

# ---- health check (8080=Firestore, 4000=UI, 5173=Vite) ---------------
for port in 8080 4000 5173; do
  for i in {1..30}; do
    curl -fsS "http://localhost:$port" >/dev/null && break
    sleep 1
  done || { echo "Service on $port never came up"; cat "$LOG_DIR/firebase.log"; exit 1; }
done

echo "Local stack running:
   Firebase UI: http://localhost:4000/firestore/data?ns=$PROJECT_ID
   Vite site :  http://localhost:5173/signup"

# ---- open browser tabs (macOS/Linux) ---------------------------------
for url in \
  "http://localhost:4000/firestore/data?ns=$PROJECT_ID" \
  "http://localhost:5173/signup"; do
  { command -v xdg-open && xdg-open "$url"; } \
    || { command -v open && open "$url"; } || true
done

# ---- graceful shutdown + data export ---------------------------------
cleanup() {
  echo "Exporting latest emulator data…"
  firebase emulators:export ./seed-data --project "$PROJECT_ID" >/dev/null 2>&1 || true
  kill $emu_pid $vite_pid
}
trap cleanup INT TERM EXIT
wait $vite_pid

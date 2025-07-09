#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Install deps (<= 2-3 min on the stock container)
npm ci --prefer-offline --no-audit --progress=false

# Start Firebase emulators *in the background*.
#    They keep running after this script exits.
npx firebase emulators:start \
  --project demo-project \
  --only firestore,auth,storage \
  --import seed-data \
  --ui false \
  > .logs/firebase.log 2>&1 &
disown

npm run build

npx vite preview --port "$PORT" --strictPort &
disown  

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ID=demo-project

npm ci
command -v firebase >/dev/null || npm i -g firebase-tools@latest

# Start emulators, run the build, then quit
npx firebase emulators:exec \
  --project "$PROJECT_ID" \
  --only firestore,auth,storage \
  "npm run build"

# launch-ci.sh
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=demo-project
npm ci
command -v firebase >/dev/null || npm i -g firebase-tools@latest

# spin up emulators, run the build/tests, then exit
firebase emulators:exec \
  --project "$PROJECT_ID" \
  --only firestore,auth,storage \
  "npm run build && npm test"

# optional: serve the built site for preview
# (Codex will expose $PORT automatically)
npx vite preview --port "${PORT:-3000}" &

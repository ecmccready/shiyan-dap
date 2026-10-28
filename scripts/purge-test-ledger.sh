#!/usr/bin/env bash
# Note: these are legacy test ids from earlier testing (the "music" id is a historical test label, not a live feature).
# Purges the known test assets from the micro-ledger (permanent). Needs LEDGER_ADMIN_SECRET set on the
# server and exported here. Dry run by default; pass --yes to purge. Usage:
#   HOST=https://shiyan-dap.vercel.app LEDGER_ADMIN_SECRET=... scripts/purge-test-ledger.sh [--yes]
set -euo pipefail
HOST="${HOST:-https://shiyan-dap.vercel.app}"
IDS="live-test-20261025,trk_7bbda6ed,trk_654015ed,live-test-exec-20261025,live-test-music-20261025"
echo "Test assets: $IDS"
echo "Currently on the ledger:"
curl -s "$HOST/api/v1/ledger/commit?limit=100" | python3 -c "import json,sys;d=json.load(sys.stdin);[print(' ',e['assetId'],e['domain']) for e in d['events']]"
if [ "${1:-}" != "--yes" ]; then echo "Dry run. Re-run with --yes to purge."; exit 0; fi
: "${LEDGER_ADMIN_SECRET:?set LEDGER_ADMIN_SECRET}"
curl -s -X DELETE "$HOST/api/v1/ledger/commit?assetId=$IDS&purge=1" -H "x-admin-secret: $LEDGER_ADMIN_SECRET"
echo

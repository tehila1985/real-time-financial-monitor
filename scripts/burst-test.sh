#!/usr/bin/env bash
# Fires COUNT rapid POST requests at the ingestion API — the manual
# verification for NFR3 ("if 100 transactions arrive quickly, the browser
# should not freeze"). See docs/DESIGN.md §15 for why this lives here instead
# of a bulk-send button inside the /add page (that would be test tooling
# shipped as a product feature).
#
# Usage:
#   ./scripts/burst-test.sh [count]
#   BASE_URL=http://localhost:5225 ./scripts/burst-test.sh 200
#
# Run this while /monitor is open in a browser (or through docker-compose at
# http://localhost:5180) to see the UI stay responsive under the burst.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5225}"
COUNT="${1:-100}"

STATUSES=(Pending Completed Failed)
CURRENCIES=(USD EUR GBP)

new_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  else
    python -c "import uuid; print(uuid.uuid4())" 2>/dev/null \
      || python3 -c "import uuid; print(uuid.uuid4())"
  fi
}

echo "Firing $COUNT transactions at $BASE_URL/api/transactions ..."

for i in $(seq 1 "$COUNT"); do
  status=${STATUSES[$((RANDOM % ${#STATUSES[@]}))]}
  currency=${CURRENCIES[$((RANDOM % ${#CURRENCIES[@]}))]}
  amount="$((RANDOM % 10000)).$((RANDOM % 100))"
  id=$(new_uuid)
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  curl -s -o /dev/null -X POST "$BASE_URL/api/transactions" \
    -H "Content-Type: application/json" \
    -d "{\"transactionId\":\"$id\",\"amount\":$amount,\"currency\":\"$currency\",\"status\":\"$status\",\"timestamp\":\"$timestamp\"}" &
done

wait
echo "Done — sent $COUNT transactions."

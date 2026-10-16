#!/bin/bash
# Sync production Neon database → local PostgreSQL
# Usage: ./scripts/sync-from-prod.sh
#
# This creates a copy-on-write snapshot: production data is dumped and
# restored locally. Local changes do NOT affect production.

set -euo pipefail

PROD_URL="$(grep '^NEON_DATABASE_URL=' "$(dirname "$0")/../.env" | sed 's/^NEON_DATABASE_URL="//' | sed 's/"$//')"
if [ -z "$PROD_URL" ]; then
  echo "❌ NEON_DATABASE_URL not found in .env"; exit 1
fi
LOCAL_URL="postgresql://postgres@localhost:5432/overseeddb"
DUMP_FILE="/tmp/neon-prod-dump.sql"

echo "📥 Dumping production database..."
pg_dump "$PROD_URL" --no-owner --no-privileges --clean --if-exists -f "$DUMP_FILE"
echo "   Dump size: $(du -h "$DUMP_FILE" | cut -f1)"

echo "📦 Restoring to local database..."
psql "$LOCAL_URL" -f "$DUMP_FILE" > /dev/null 2>&1

echo "✅ Sync complete! Local database now mirrors production."
echo "   Run 'npx prisma generate' if you see schema mismatch errors."

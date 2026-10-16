#!/bin/bash
# Sync production Neon database → local PostgreSQL
# Usage: ./scripts/sync-from-prod.sh
#
# This creates a copy-on-write snapshot: production data is dumped and
# restored locally. Local changes do NOT affect production.

set -euo pipefail

PROD_URL="postgresql://neondb_owner:npg_CpOr5x9qGYcz@ep-bold-cake-aikj744w-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
LOCAL_URL="postgresql://postgres@localhost:5432/overseeddb"
DUMP_FILE="/tmp/neon-prod-dump.sql"

echo "📥 Dumping production database..."
pg_dump "$PROD_URL" --no-owner --no-privileges --clean --if-exists -f "$DUMP_FILE"
echo "   Dump size: $(du -h "$DUMP_FILE" | cut -f1)"

echo "📦 Restoring to local database..."
psql "$LOCAL_URL" -f "$DUMP_FILE" > /dev/null 2>&1

echo "✅ Sync complete! Local database now mirrors production."
echo "   Run 'npx prisma generate' if you see schema mismatch errors."

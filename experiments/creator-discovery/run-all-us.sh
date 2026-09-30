#!/bin/bash
# Run creator discovery for all 14 niches — US market
# Budget: ~2,500 Serper credits (~150 queries per niche)
# Expected: ~5,000-8,000 total unique candidates

set -e
cd "$(dirname "$0")"

NICHES=(
  beauty
  fashion
  fitness
  food
  travel
  lifestyle
  gaming
  technology
  parenting
  home
  wellness
  pets
  education
  finance
)

echo "═══════════════════════════════════════"
echo "  US Creator Discovery — All 14 Niches"
echo "═══════════════════════════════════════"
echo ""

for niche in "${NICHES[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Starting: $niche"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  npx tsx src/cli.ts discover \
    --niche "$niche" \
    --country US \
    --platform instagram \
    --platform tiktok \
    --target 200 \
    --max-queries 150 \
    --delay 300
  echo ""
done

echo "═══════════════════════════════════════"
echo "  All niches complete!"
echo "═══════════════════════════════════════"

# Export everything
npx tsx src/cli.ts export --output data/us-all-niches.csv
echo ""
npx tsx src/cli.ts stats

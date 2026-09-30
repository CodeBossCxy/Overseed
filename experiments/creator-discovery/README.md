# Creator Discovery Experiment

Isolated experiment to answer: **"Can Overseed cheaply discover a large number of useful creator profiles from public web search?"**

This is NOT integrated into the production Overseed application. It uses a local SQLite database and runs from the command line.

## Setup

```bash
cd experiments/creator-discovery
npm install

# Copy and configure API key
cp .env.example .env.discovery
# Edit .env.discovery and add your SERPER_API_KEY
```

### Search Provider

Uses [Serper.dev](https://serper.dev) (Google Search API):
- Cost: $0.001 per query (~2500 free credits on signup)
- 1000 candidates ≈ 150-200 queries ≈ $0.15-0.20

Without an API key, the mock provider is used automatically.

## Usage

### Discover creators

```bash
# Real discovery (requires SERPER_API_KEY in .env.discovery)
npm run discover -- --niche beauty --country US \
  --platform instagram --platform tiktok --platform youtube \
  --target 1000

# Test with mock provider (no API key needed)
npm run discover -- --niche beauty --country US \
  --platform instagram --target 100 --provider mock
```

### Export to CSV

```bash
npm run export -- --run-id 1 --output data/beauty-us.csv

# With filters
npm run export -- --run-id 1 --min-score 60 --platform instagram --output data/beauty-ig.csv
```

### View run stats

```bash
# List all runs
npm run stats

# Details for a specific run
npm run stats -- --run-id 1
```

## Architecture

```
INPUT (niche, country, platforms)
  |
  v
Query Generator ─── generates ~500 search queries from templates
  |
  v
Search Provider ─── executes queries via Serper.dev (or mock)
  |
  v
URL Normalizer ──── canonical URLs, strip tracking params
  |
  v
URL Classifier ──── instagram_profile / tiktok_profile / youtube_channel / ...
  |
  v
Noise Filter ────── remove login pages, homepages, search engines
  |
  v
Deduplication ───── same normalized URL = increment discovery count
  |
  v
Scorer ──────────── 0-100 confidence score based on URL type, terms, rank
  |
  v
SQLite DB ───────── persistent discovery queue with provenance
```

## Database

Local SQLite file at `data/discovery.db`. Three tables:

- `discovery_runs` — run metadata and stats
- `discovery_candidates` — discovered URLs with scores and status
- `discovery_sources` — which query found each URL (provenance)

## Tests

```bash
npm test
```

75 tests covering query generation, URL normalization, classification, filtering, scoring, and pipeline integration. All tests use the mock provider — no API credits consumed.

## Stage 2 (not yet built)

- Public page crawler for profile extraction
- Email extraction from bios and link-in-bio pages
- Cross-platform identity resolution
- Integration with Overseed CreatorProfile table

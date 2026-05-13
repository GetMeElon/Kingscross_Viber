# KingsCross Viber

Static hackathon demo for building a believable King's Cross night-out route from a small curated place graph.

## Pitch

Neo4j provides the graph structure, Tessl defines the behavior contract, and Kimchi adds the lightweight narration layer.

- **Neo4j**: venues, vibes, and short walks as explicit graph structure.
- **Tessl**: the contract for how a recommendation should behave: plausible route, good vibe fit, short transitions, one memorable fact.
- **Kimchi**: the concise reasoning and stage-friendly explanation layer on top of the chosen route.

## Demo-safe architecture

The app stays static and browser-only.

- Neo4j is used offline to generate recommendation snapshots ahead of the demo.
- The static app prefers those snapshots when they exist.
- If a snapshot is missing, invalid, or Aura is unavailable, the existing local route logic still works.
- Neo4j credentials stay local-only and uncommitted.

Current local data already in the repo:

- `data/places.json`
- `data/area-intel.json`

Expected snapshot output path for the Neo4j lane:

- `data/recommendations/<vibe>.json`

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Test

```bash
npm test
```

This runs `scripts/check-app.mjs`.

For the Neo4j lane without Aura access, you can still validate the contract locally:

```bash
npm run neo4j:validate
```

## Neo4j Export Flow

This repo does **not** expose Neo4j credentials to the browser and does **not** use a backend proxy.

Committed placeholder config:

- `.env.example`

Local-only config:

- `.env.local`

Main scripts:

- `scripts/seed-neo4j.mjs`
- `scripts/query-neo4j.mjs`
- `scripts/export-neo4j-snapshots.mjs`

Typical flow:

```bash
cp .env.example .env.local
npm run neo4j:seed
npm run neo4j:query -- creative
npm run neo4j:export
```

That writes `data/recommendations/<vibe>.json`, which the static app prefers automatically. If those files are absent or malformed, the UI falls back to the local route logic without breaking the demo.

If Aura is down, the static app should continue using the local graph fallback.

Offline snapshot generation for demo packaging is also available:

```bash
npm run neo4j:export:local
```

Those offline files keep the same route contract but carry `source: "local-snapshot"` so the UI does not pretend they came from Aura.

## What Judges Should Understand

- It is a static browser demo, not a live database client.
- Neo4j makes the route explainable.
- Tessl makes the behavior consistent.
- Kimchi makes the output easy to present.
- The fallback path keeps the demo reliable on stage.

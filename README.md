# KingsCross Viber

Route intelligence for a real night in KingsCross.

KingsCross Viber is an AI-powered night planner that turns nearby venues into a believable multi-stop micro-adventure. Instead of dumping a flat ranked list, it builds an explainable route around vibe, budget, time, and walking distance, then presents the result like a concierge.

## The pitch

Pick your vibe, budget, and time window, and KingsCross Viber turns that into a night-out route you can actually imagine following.

What makes it different is the structure behind it:

- **Neo4j** gives the recommendation a real graph shape. Venues, vibes, and short walking links are connected so the route is explainable, not a black-box ranking.
- **Kimchi** is the fast, lightweight explanation layer. It turns the graph result into concise concierge-style narration for the user.
- **Tessl** helped us build faster by surfacing the right tools and skills for the project, so we could move from idea to working demo inside hackathon time.

## One-line story

> Neo4j gives us the route logic, Kimchi gives us the explanation layer, and Tessl helped us assemble the right build workflow to ship it fast.

## Why it pops

- It feels like route intelligence, not venue search.
- The recommendation is explainable as a sequence of places, not just a score.
- The user gets a believable night out, not a pile of options.
- The demo stays stable even if the database lane is unavailable.

## What the user does

1. Pick a vibe, time window, budget, and walking preference.
2. Get a multi-stop route around KingsCross.
3. See why the route fits, including route reasoning and stop-by-stop context.
4. Explore the route on an open map with nearby area intel.

## Demo architecture

The shipped app is static and browser-first, which keeps the demo safe under hackathon conditions.

- `data/places.json` holds the local venue graph.
- `data/area-intel.json` holds the local area brief and fallback context.
- `MapLibre GL JS` renders the map.
- `OpenStreetMap` provides the base map tiles.
- The browser can enrich the experience with nearby `Wikipedia API` context.
- Neo4j-generated recommendation snapshots can be exported into `data/recommendations/<vibe>.json`.
- If a snapshot is missing or invalid, the app falls back to local route logic without breaking the experience.

## Stack

- Neo4j
- Kimchi
- Tessl
- HTML
- CSS
- JavaScript
- MapLibre GL JS
- OpenStreetMap
- Wikipedia API
- Local JSON data

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

For the Neo4j snapshot lane, local validation is available through:

```bash
npm run neo4j:validate
```

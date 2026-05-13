# KingsCross Viber

KingsCross Viber is a hackathon demo for planning a better night out around KingsCross. It turns nearby venues, vibes, and short walk connections into an explainable route, then presents the result as a concise concierge-style recommendation instead of a raw list of places.

## The idea

Most local recommendation products can suggest places, but they struggle to explain why a route makes sense as a sequence. KingsCross Viber treats the night as a graph problem:

- venues are places
- moods are vibes
- short walks are edges
- the output is a believable 3-stop micro-adventure

The user picks a vibe, time window, budget, and walking preference. The system then assembles a route that balances venue fit, route plausibility, and short transitions between stops.

## Sponsor story

The demo is intentionally shaped around three clear roles:

- **Neo4j** is the place graph that makes route reasoning explainable. Venues, vibes, and walk edges are first-class graph entities, so the route can be described as connected structure rather than a black-box ranking.
- **Tessl** is the behavior contract. It defines how recommendations should behave: balance vibe match, walking distance, plausibility, and one surprising fact, consistently.
- **Kimchi** is the lightweight reasoning and narration layer. It turns graph results into a cheap, fast concierge-style explanation instead of just dumping ranked venues.

## 60-second product line

> Neo4j finds the route structure, Tessl defines the recommendation behavior, and Kimchi turns the result into a cheap, fast explanation layer for the user.

## Current demo shape

The current repo ships a stable local-first version of that architecture:

- a curated local venue graph in `data/places.json`
- area brief and fallback context in `data/area-intel.json`
- an open map rendered with `MapLibre GL JS`
- base tiles from `OpenStreetMap`
- live nearby context from the `Wikipedia API`
- a browser UI built with HTML, CSS, and vanilla JavaScript

This lets the demo stay reliable on stage even before a live Neo4j-backed query path is wired in.

## What the user sees

1. Pick a vibe, time window, budget, and walking preference.
2. Get a multi-stop route around KingsCross.
3. See why the route fits, including route score and graph reasoning.
4. Explore the stops on an open map with nearby area context.

## Why this works for a hackathon

- It is easy to explain in one sentence.
- The graph model makes the recommendation legible to judges.
- The local fallback keeps the demo resilient.
- The sponsor technologies each have a distinct role in the story.

## Stack

- Tessl
- Kimchi
- Neo4j-shaped place graph
- HTML
- CSS
- JavaScript
- MapLibre GL JS
- OpenStreetMap
- Wikipedia API
- Local JSON data

## Run locally

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Test

```bash
npm test
```

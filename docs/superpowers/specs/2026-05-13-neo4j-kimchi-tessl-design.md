# Neo4j Snapshot + Kimchi + Tessl Design

Date: 2026-05-13

## Goal

Add a real Neo4j Aura workflow to the King's Cross demo without turning the static app into a browser-to-database client, and sharpen the sponsor story so Neo4j, Kimchi, and Tessl each have a clear role in the pitch.

## Constraints

- The app must remain static in the browser. No backend proxy will be added.
- Neo4j Aura credentials must stay local and must not be committed into the repo.
- The demo must remain stable if Aura is unavailable.
- The existing local graph logic is the fallback and cannot be removed.
- The UI should show whether the current recommendation came from a Neo4j-generated snapshot or from local scoring.

## Recommendation

Use a hybrid snapshot flow:

1. Seed Neo4j Aura from the local curated graph.
2. Query Aura offline or before the demo to generate recommendation snapshots per vibe.
3. Have the static app read those snapshots when present.
4. Fall back to the existing local route builder when no snapshot exists.

This keeps Neo4j real, visible, and useful, but avoids leaking credentials and avoids runtime failure in the browser.

## Architecture

### Data sources

- `data/places.json`
  - Source of truth for curated venues, summaries, graph layout coordinates, and map coordinates.
- `data/area-intel.json`
  - Source of truth for static area messaging and fallback wiki content.
- `data/recommendations/<vibe>.json`
  - Generated artifacts from Neo4j Aura queries.
  - One file per supported vibe.

### Scripts

- `scripts/seed-neo4j.mjs`
  - Reads local venue graph data.
  - Connects to Aura using env vars from a local untracked env file.
  - Creates:
    - `Place` nodes
    - `Vibe` nodes
    - `(:Place)-[:HAS_VIBE]->(:Vibe)` relationships
    - `(:Place)-[:WALKS_TO {walk}]->(:Place)` relationships
  - Clears and reseeds the demo graph in a predictable way.

- `scripts/query-neo4j.mjs`
  - Takes a vibe as input.
  - Runs one deterministic Cypher query for the top route shape.
  - Returns a stable JSON contract for the frontend.

- `scripts/export-neo4j-snapshots.mjs`
  - Runs the query script for the supported built-in vibes:
    - `creative`
    - `food`
    - `music`
    - `quiet`
  - Writes snapshot files to `data/recommendations/`.

### Frontend behavior

- On each route render, the app first checks for a matching snapshot file.
- If the snapshot exists and is valid, the app uses it as the recommendation source.
- If the snapshot is missing or invalid, the app uses the existing local scoring path.
- The UI exposes a small source badge such as:
  - `Source: Neo4j snapshot`
  - `Source: local fallback`

## Data contract

The snapshot format must be stable and simple:

```json
{
  "vibe": "creative",
  "source": "neo4j",
  "summary": "A canal-side creative loop with one quieter pause before food.",
  "stops": [
    {
      "id": "coal-drops",
      "name": "Coal Drops Yard",
      "category": "shops and restaurants",
      "area": "King's Cross",
      "walkMinutes": 0,
      "note": "Strong opener for browsing and orienting the route.",
      "fact": "This stop anchors the canal-side retail cluster."
    }
  ]
}
```

The frontend must not depend on any Aura-specific fields beyond this contract.

## Query shape

The query does not need to solve a general graph path problem for the hackathon. It needs to return one believable three-stop route per vibe.

Recommended behavior:

- Start from places that match the selected vibe.
- Prefer routes with shorter total walking time.
- Prefer central King's Cross and St Pancras stops before outliers like Camden.
- Return one interesting fact or note per stop.

The first version should stay deterministic. Avoid live LLM selection inside the seed or query path.

## Env and secret handling

Use a local untracked env file, for example `.env.local`, with:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE`

The repo should also include a committed `.env.example` with placeholders only.

The credential file the user shared should be treated as local-only input and must not be copied into the workspace or committed.

## UI changes

Keep the current route planner and map section intact, but add:

- A recommendation source label in the route panel.
- Snapshot-aware route rendering.
- A summary line from the snapshot when available.

The app should not become dependent on the snapshot-only shape for graph rendering; it still needs the underlying place graph for map markers and local fallback.

## Error handling

- If snapshot fetch returns 404:
  - Use local scoring silently.
- If snapshot JSON is malformed:
  - Log a console warning.
  - Use local scoring.
- If seed/query scripts cannot connect to Aura:
  - Exit with a useful error message.
  - Do not modify existing snapshot files.

## Testing

Add checks for:

- Seed input data integrity.
- Snapshot schema shape.
- Frontend fallback behavior when snapshot files are absent.
- Frontend source label correctness.

The existing `scripts/check-app.mjs` should be extended for file presence and schema validation where practical.

## Demo story

### Neo4j

Neo4j is the explicit place graph. It stores venues, vibes, and walk links as real graph entities so the recommendation path is explainable rather than opaque.

### Tessl

Tessl is the behavior contract. It defines how recommendation behavior should work:

- balance vibe fit and walking distance
- keep the route plausible
- include one surprising fact
- preserve a local fallback path

In the demo, Tessl is the visible rule layer that governs recommendation behavior rather than leaving it implicit in ad hoc code.

### Kimchi

Kimchi is the lightweight reasoning and narration layer. It does not replace the graph. It turns graph-backed results into a concise concierge-style explanation and stage-ready copy at low cost.

## Pitch line

"Neo4j gives us the route structure, Tessl defines how the recommendation should behave, and Kimchi turns that result into a fast, cheap explanation layer."

## Implementation boundaries

In scope:

- Aura seed/query/export scripts
- local env support
- generated recommendation snapshots
- snapshot-aware frontend fallback
- light UI copy for source visibility

Out of scope:

- live browser-to-Neo4j queries
- backend proxy
- authentication
- generalized route optimization
- production secrets management

## Risks

- Aura may not be ready or reachable during the demo.
  - Mitigation: generated snapshots plus local scoring fallback.
- Snapshot format may drift from frontend expectations.
  - Mitigation: keep a narrow contract and validate it.
- Sponsor story may blur if all three tools sound interchangeable.
  - Mitigation: keep strict role separation: graph, behavior, narration.

## Decision

Proceed with the Neo4j snapshot architecture and keep the app static.

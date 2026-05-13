# King's Cross Vibe Constellation - 30 Minute Build Plan

## Goal

Ship a projector-ready demo in 30 minutes:

- Full-screen beautiful React UI
- "What is your vibe tonight?" prompt
- Animated King's Cross graph / map view
- One generated micro-adventure with walking times, venue notes, and facts along the route
- Neo4j Aura visible and real
- Tessl visibly shaping recommendation behavior

## Hard Scope

Must have:

- One polished landing screen
- 3-5 vibe presets plus free text input
- 3-stop itinerary card
- Route timing and venue metadata
- Local graph fallback so the UI never blocks on backend work

Cut for now:

- Full map engine with real routing
- Large ingestion pipeline
- Authentication
- Multi-page flow
- Live external API dependency during the demo

## Build Shape

Frontend first.

The UI reads a local `graph.json` immediately. The backend returns the same shape from Neo4j when ready. This avoids the most common hackathon failure mode: a blank screen while infra is still moving.

## Parallel Workflows

### Lane 1: Frontend shell, critical path

Owner: primary builder

Time: minute 0-12

Deliverables:

- Vite React app scaffold
- Full-screen visual layout
- Background map / constellation layer
- Vibe input panel
- Itinerary results panel
- Motion for nodes, route lines, and panel transitions

Definition of done:

- App opens locally
- Dummy data renders beautifully
- One click produces a route without any backend

### Lane 2: Data model + local seed

Owner: parallel worker or second thread

Time: minute 0-10

Deliverables:

- `graph.json` with 20-30 nodes around King's Cross
- Node types:
  - `Place`
  - `Vibe`
  - `Fact`
  - `RouteStop`
  - `WalkEdge`
- Curated venues:
  - jazz / cocktail
  - champagne at St Pancras
  - canal walk
  - Coal Drops Yard / Granary Square / nearby cultural anchors

Definition of done:

- JSON supports one believable route for each vibe
- No network needed for the first demo

### Lane 3: Neo4j Aura wiring

Owner: parallel worker

Time: minute 5-18

Deliverables:

- Read Aura credentials from the Neo4j file into env vars
- Seed script with Cypher
- Minimal query path:
  - input vibe
  - current time bucket
  - return top 3 stops + facts + walking minutes
- Optional tiny API route in Node/Express or Vite server helper

Definition of done:

- Neo4j Browser shows the graph
- One query returns the same shape as `graph.json`

### Lane 4: Tessl behavior layer

Owner: parallel worker

Time: minute 10-20

Deliverables:

- Skill or rule doc that defines recommendation logic:
  - use current date/time
  - prefer plausible open-late venues
  - balance mood + walking distance
  - inject one surprising fact
  - provide one fallback stop

Definition of done:

- We can point to the Tessl artifact during demo
- Recommendation behavior is clearly governed, not improvised

### Lane 5: Integration + polish

Owner: primary builder

Time: minute 18-30

Deliverables:

- Swap local provider to Aura provider if ready
- Keep local fallback live
- Final copy polish
- Rehearsed demo path

Definition of done:

- One stable 60-second demo
- If Neo4j query fails, local route still works

## Recommended File Layout

```text
src/
  app/
  components/
    VibePrompt.tsx
    MapStage.tsx
    RoutePanel.tsx
    FactTicker.tsx
  data/
    graph.json
  lib/
    recommend.ts
    neo4j.ts
  styles/
    theme.css
scripts/
  seed-neo4j.mjs
docs/
  tessl-skill-notes.md
```

## Data Contract

Both local and Neo4j-backed providers should return:

```ts
type Recommendation = {
  vibe: string;
  summary: string;
  stops: Array<{
    id: string;
    name: string;
    category: string;
    walkMinutes: number;
    note: string;
    fact: string;
  }>;
};
```

This contract is the whole game. Keep it stable.

## Minute-by-Minute Runbook

### Minute 0-5

- Scaffold app
- Set theme, layout, and typography
- Create `graph.json`

### Minute 5-10

- Render animated stage
- Add sample route
- Read Neo4j credentials and prep env

### Minute 10-15

- Build vibe interaction
- Seed Neo4j Aura
- Write Tessl guide rules

### Minute 15-20

- Add recommendation provider abstraction
- Wire Neo4j query if ready
- Keep local fallback active

### Minute 20-25

- Add facts, walking times, venue notes
- Tighten motion and contrast
- Check mobile and projector view

### Minute 25-30

- Rehearse demo
- Open Neo4j Browser side by side
- Prepare one backup vibe flow

## Demo Script

1. Open the app.
2. Ask: "What's your vibe tonight?"
3. Enter something like "quiet magic and a glass of champagne".
4. Show the graph animate into a 3-stop route.
5. Highlight walking minutes, destination, and one local fact per stop.
6. Show Neo4j Browser with the same connected graph.
7. State clearly:
   - Codex built the experience
   - Neo4j powers the place graph
   - Tessl defines the recommendation behavior

## Failure Plan

If Aura is not wired in time:

- Keep the UI on local `graph.json`
- Open the seed Cypher and Neo4j Browser separately
- Demo the graph visually anyway

If animation work takes too long:

- Keep route-line draw animation
- Cut secondary motion

If data is thin:

- Shrink to 12 excellent nodes
- Better small and believable than wide and fake

## Decision

Do the frontend first, always.

The user's eyes decide whether this is real in the first 5 seconds. The backend only matters if the screen already earns attention.

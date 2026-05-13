import { readdir, readFile } from "node:fs/promises";
import { SUPPORTED_VIBES, validateSnapshot } from "./recommendation-engine.mjs";

const [index, appSource, envExample, gitignore, packageJsonText, readme, data] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("app.js", "utf8"),
  readFile(".env.example", "utf8"),
  readFile(".gitignore", "utf8"),
  readFile("package.json", "utf8"),
  readFile("README.md", "utf8"),
  readFile("data/places.json", "utf8")
]);

const packageJson = JSON.parse(packageJsonText);
const graph = JSON.parse(data);
const ids = new Set(graph.places.map((place) => place.id));
const missingEdges = graph.edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));
let validatedSnapshots = 0;

if (!index.includes("app.js") || !index.includes("styles.css")) {
  throw new Error("index.html is missing app or stylesheet references");
}

if (!index.includes("area-map") || !index.includes("wiki-list")) {
  throw new Error("index.html is missing the open map or wiki panels");
}

if (!index.includes("route-source") || !index.includes("route-summary")) {
  throw new Error("index.html is missing the route source or summary UI");
}

if (graph.places.length < 6) {
  throw new Error("place graph needs at least six places for the demo");
}

if (graph.places.some((place) => !Array.isArray(place.coordinates) || place.coordinates.length !== 2)) {
  throw new Error("every place needs map coordinates");
}

if (missingEdges.length > 0) {
  throw new Error(`place graph has invalid edges: ${JSON.stringify(missingEdges)}`);
}

if (!appSource.includes("fetchSnapshotRecommendation(") || !appSource.includes("Source: local fallback")) {
  throw new Error("app.js is missing snapshot fallback handling or source labels");
}

if (!appSource.includes('import { validateSnapshot } from "./snapshot-contract.mjs";')) {
  throw new Error("app.js should use the shared snapshot contract validator");
}

if (!appSource.includes("isSnapshotEligible(")) {
  throw new Error("app.js should only apply snapshots when the static snapshot profile matches the active controls");
}

if (appSource.includes("neo4j-driver") || appSource.includes("NEO4J_") || appSource.includes("neo4j+s://")) {
  throw new Error("app.js should not contain direct Neo4j credentials, driver imports, or browser Neo4j access");
}

if (!gitignore.includes("!.env.example")) {
  throw new Error(".gitignore must keep .env.example commit-visible");
}

for (const key of ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "NEO4J_DATABASE"]) {
  if (!envExample.includes(`${key}=`)) {
    throw new Error(`.env.example is missing ${key}`);
  }
}

if (!envExample.includes("<your-aura-instance>") || !envExample.includes("<your-password>")) {
  throw new Error(".env.example should keep placeholder-only Neo4j values");
}

const expectedScripts = {
  "neo4j:seed": "scripts/seed-neo4j.mjs",
  "neo4j:query": "scripts/query-neo4j.mjs",
  "neo4j:export": "scripts/export-neo4j-snapshots.mjs",
  "neo4j:export:local": "scripts/export-neo4j-snapshots.mjs --from-local",
  "neo4j:validate": "scripts/export-neo4j-snapshots.mjs --dry-run"
};

for (const [scriptName, scriptBody] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[scriptName] !== `node ${scriptBody}`) {
    throw new Error(`package.json is missing the expected ${scriptName} script`);
  }
}

for (const phrase of [
  "Neo4j provides the graph structure",
  "Tessl defines the behavior contract",
  "Kimchi adds the lightweight narration layer",
  "backend proxy"
]) {
  if (!readme.includes(phrase)) {
    throw new Error(`README.md is missing expected sponsor-story copy: ${phrase}`);
  }
}

try {
  const files = await readdir("data/recommendations");

  if (files.length > 0) {
    for (const vibe of SUPPORTED_VIBES) {
      const snapshot = JSON.parse(
        await readFile(`data/recommendations/${vibe}.json`, "utf8")
      );
      validateSnapshot(snapshot);

      if (snapshot.vibe !== vibe) {
        throw new Error(`snapshot file ${vibe}.json has mismatched vibe ${snapshot.vibe}`);
      }

      if (snapshot.stops.some((stop) => !ids.has(stop.id))) {
        throw new Error(`snapshot file ${vibe}.json references a place missing from data/places.json`);
      }

      validatedSnapshots += 1;
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

const snapshotSummary = validatedSnapshots
  ? `, ${validatedSnapshots} validated snapshots`
  : "";

console.log(`OK: ${graph.places.length} places and ${graph.edges.length} edges${snapshotSummary}`);

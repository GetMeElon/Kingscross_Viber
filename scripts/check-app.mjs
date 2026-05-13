import { readFile } from "node:fs/promises";

const [index, data] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("data/places.json", "utf8")
]);

const graph = JSON.parse(data);
const ids = new Set(graph.places.map((place) => place.id));
const missingEdges = graph.edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));

if (!index.includes("app.js") || !index.includes("styles.css")) {
  throw new Error("index.html is missing app or stylesheet references");
}

if (graph.places.length < 6) {
  throw new Error("place graph needs at least six places for the demo");
}

if (missingEdges.length > 0) {
  throw new Error(`place graph has invalid edges: ${JSON.stringify(missingEdges)}`);
}

console.log(`OK: ${graph.places.length} places and ${graph.edges.length} edges`);


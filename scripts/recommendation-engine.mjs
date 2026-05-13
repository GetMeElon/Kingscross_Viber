import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './env.mjs';
import {
  SUPPORTED_VIBES,
  normalizeVibe,
  validateSnapshot
} from '../snapshot-contract.mjs';

export { SUPPORTED_VIBES, normalizeVibe, validateSnapshot } from '../snapshot-contract.mjs';

const AREA_PRIORITY = {
  "King's Cross": 4,
  'St Pancras': 3,
  'Granary Square': 2,
  Camden: -3
};

function readJsonFile(filePath) {
  return fs.readFile(filePath, 'utf8').then((content) => JSON.parse(content));
}

export async function loadPlacesGraphFromFile(
  filePath = path.join(ROOT_DIR, 'data', 'places.json')
) {
  const graph = await readJsonFile(filePath);
  assertGraph(graph);
  return graph;
}

export function assertGraph(graph) {
  if (!graph || !Array.isArray(graph.places) || !Array.isArray(graph.edges)) {
    throw new Error('Expected a graph object with "places" and "edges" arrays.');
  }

  const placeIds = new Set();

  for (const place of graph.places) {
    if (!place?.id || !place?.name) {
      throw new Error('Each place requires at least an id and name.');
    }

    if (placeIds.has(place.id)) {
      throw new Error(`Duplicate place id "${place.id}" in graph data.`);
    }

    placeIds.add(place.id);

    for (const vibe of place.vibes || []) {
      normalizeVibe(vibe);
    }
  }

  for (const edge of graph.edges) {
    if (!placeIds.has(edge.from) || !placeIds.has(edge.to)) {
      throw new Error(
        `Edge "${edge.from}" -> "${edge.to}" references a place missing from graph data.`
      );
    }

    if (!Number.isFinite(edge.walk) || edge.walk < 0) {
      throw new Error(
        `Edge "${edge.from}" -> "${edge.to}" requires a non-negative numeric walk value.`
      );
    }
  }
}

function makePlaceIndex(graph) {
  return new Map(
    graph.places.map((place) => [
      place.id,
      {
        ...place,
        vibes: [...(place.vibes || [])].sort(),
        coordinates: Array.isArray(place.coordinates) ? [...place.coordinates] : []
      }
    ])
  );
}

function makeAdjacency(graph) {
  const adjacency = new Map();

  for (const place of graph.places) {
    adjacency.set(place.id, []);
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.from).push({ to: edge.to, walk: edge.walk });
    adjacency.get(edge.to).push({ to: edge.from, walk: edge.walk });
  }

  for (const entries of adjacency.values()) {
    entries.sort((left, right) => {
      if (left.walk !== right.walk) {
        return left.walk - right.walk;
      }

      return left.to.localeCompare(right.to);
    });
  }

  return adjacency;
}

function collectThreeStopRoutes(graph, vibe) {
  const adjacency = makeAdjacency(graph);
  const routes = new Map();

  for (const place of graph.places) {
    if (!place.vibes.includes(vibe)) {
      continue;
    }

    const start = place.id;

    for (const firstHop of adjacency.get(start) || []) {
      for (const secondHop of adjacency.get(firstHop.to) || []) {
        if (secondHop.to === start) {
          continue;
        }

        const route = [start, firstHop.to, secondHop.to];
        const key = route.join('>');
        routes.set(key, route);
      }
    }
  }

  return [...routes.values()];
}

function getWalkMinutes(route, adjacency) {
  const minutes = [0];

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const edge = (adjacency.get(previous) || []).find((entry) => entry.to === current);

    if (!edge) {
      throw new Error(`Missing walk edge between "${previous}" and "${current}".`);
    }

    minutes.push(edge.walk);
  }

  return minutes;
}

function areaPriority(area) {
  return AREA_PRIORITY[area] ?? 0;
}

function routeScore(route, vibe, placeIndex, adjacency) {
  const walkMinutes = getWalkMinutes(route, adjacency);
  const places = route.map((placeId) => placeIndex.get(placeId));
  const vibeMatches = places.reduce(
    (total, place) => total + (place.vibes.includes(vibe) ? 1 : 0),
    0
  );
  const centrality = places.reduce((total, place) => total + areaPriority(place.area), 0);
  const totalWalk = walkMinutes.slice(1).reduce((total, value) => total + value, 0);
  const outlierPenalty = places.some((place) => place.area === 'Camden') ? 4 : 0;
  const startPriority = areaPriority(places[0].area);

  return {
    vibeMatches,
    centrality,
    totalWalk,
    startPriority,
    score: vibeMatches * 100 + centrality * 3 - totalWalk * 2 - outlierPenalty
  };
}

function compareRoutes(left, right) {
  if (left.score.score !== right.score.score) {
    return right.score.score - left.score.score;
  }

  if (left.score.vibeMatches !== right.score.vibeMatches) {
    return right.score.vibeMatches - left.score.vibeMatches;
  }

  if (left.score.totalWalk !== right.score.totalWalk) {
    return left.score.totalWalk - right.score.totalWalk;
  }

  if (left.score.centrality !== right.score.centrality) {
    return right.score.centrality - left.score.centrality;
  }

  if (left.score.startPriority !== right.score.startPriority) {
    return right.score.startPriority - left.score.startPriority;
  }

  return left.route.join('>').localeCompare(right.route.join('>'));
}

function buildStop(place, walkMinutes) {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    area: place.area,
    walkMinutes,
    note: place.summary,
    fact: `${place.category} in ${place.area}; allow about ${place.minutes} minutes and expect ${place.cost} spend.`
  };
}

function buildSummary(vibe, places, score) {
  const areaList = [...new Set(places.map((place) => place.area))];
  const vibeCount = `${score.vibeMatches} of ${places.length}`;
  const totalWalk = score.totalWalk;
  return `A ${vibe} route across ${areaList.join(', ')} with ${vibeCount} vibe matches and ${totalWalk} total walking minutes between stops.`;
}

export function buildSnapshot(vibe, places, walkMinutes, score, source = 'neo4j') {
  const normalizedVibe = normalizeVibe(vibe);
  const snapshot = {
    vibe: normalizedVibe,
    source,
    summary: buildSummary(normalizedVibe, places, score),
    stops: places.map((place, index) => buildStop(place, walkMinutes[index] ?? 0))
  };

  validateSnapshot(snapshot);
  return snapshot;
}

export function buildRecommendationSnapshot(vibe, graph, source = 'local-snapshot') {
  const normalizedVibe = normalizeVibe(vibe);
  const placeIndex = makePlaceIndex(graph);
  const adjacency = makeAdjacency(graph);
  const rankedRoutes = collectThreeStopRoutes(graph, normalizedVibe)
    .map((route) => ({
      route,
      score: routeScore(route, normalizedVibe, placeIndex, adjacency)
    }))
    .sort(compareRoutes);

  const bestRoute = rankedRoutes[0];

  if (!bestRoute) {
    throw new Error(`No three-stop route found for vibe "${normalizedVibe}".`);
  }

  const walkMinutes = getWalkMinutes(bestRoute.route, adjacency);
  const places = bestRoute.route.map((placeId) => placeIndex.get(placeId));
  return buildSnapshot(normalizedVibe, places, walkMinutes, bestRoute.score, source);
}

export function buildSnapshotsForVibes(
  graph,
  vibes = SUPPORTED_VIBES,
  source = 'local-snapshot'
) {
  return vibes.map((vibe) => buildRecommendationSnapshot(vibe, graph, source));
}

export function serializeSnapshot(snapshot) {
  validateSnapshot(snapshot);
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

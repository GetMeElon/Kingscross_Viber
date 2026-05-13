import { validateSnapshot } from "./snapshot-contract.mjs";

const form = document.querySelector("#route-form");
const budgetOutput = document.querySelector("#budget-output");
const routeScore = document.querySelector("#route-score");
const routeSource = document.querySelector("#route-source");
const routeSummary = document.querySelector("#route-summary");
const routeList = document.querySelector("#route-list");
const reasonList = document.querySelector("#reason-list");
const graphSvg = document.querySelector("#graph-svg");
const areaSummary = document.querySelector("#area-summary");
const signalList = document.querySelector("#signal-list");
const focusName = document.querySelector("#focus-name");
const focusMeta = document.querySelector("#focus-meta");
const focusCopy = document.querySelector("#focus-copy");
const wikiStatus = document.querySelector("#wiki-status");
const wikiList = document.querySelector("#wiki-list");
const sourceList = document.querySelector("#source-list");
const mapStatus = document.querySelector("#map-status");

const [graphResponse, areaResponse] = await Promise.all([
  fetch("data/places.json"),
  fetch("data/area-intel.json")
]);
const graph = await graphResponse.json();
const areaIntel = await areaResponse.json();
const placesById = new Map(graph.places.map((place) => [place.id, place]));

const moneyByBudget = {
  low: 18,
  medium: 30,
  high: 45
};
const SNAPSHOT_PROFILE = {
  hours: 3,
  budget: 45,
  walkable: true
};

let currentRoute = [];
let focusedPlaceId = null;
let areaMap = null;
let mapPopup = null;
let mapReady = false;
let activeRouteRequest = 0;

populateAreaBrief();

function readPreferences() {
  const data = new FormData(form);
  return {
    vibe: data.get("vibe"),
    hours: Number(data.get("hours")),
    budget: Number(data.get("budget")),
    walkable: data.get("walkable") === "on"
  };
}

function stopCost(place) {
  return moneyByBudget[place.cost] ?? moneyByBudget.medium;
}

function scorePlace(place, preferences) {
  const vibeScore = place.vibes.includes(preferences.vibe) ? 44 : 0;
  const allRounderScore = place.vibes.length > 2 ? 8 : 0;
  const costScore = stopCost(place) <= preferences.budget / preferences.hours ? 24 : 8;
  const dwellScore = place.minutes <= 75 ? 12 : 5;
  const walkScore = preferences.walkable ? 6 : 0;
  return vibeScore + allRounderScore + costScore + dwellScore + walkScore;
}

function connectedScore(candidate, selectedIds) {
  if (selectedIds.length === 0) return 0;
  const directEdges = graph.edges.filter((edge) => {
    return selectedIds.includes(edge.from) && edge.to === candidate.id;
  });
  return directEdges.reduce((total, edge) => total + Math.max(0, 18 - edge.walk), 0);
}

function buildRoute(preferences) {
  const maxStops = Math.min(4, Math.max(2, preferences.hours + 1));
  const selected = [];
  const selectedIds = [];
  const candidates = [...graph.places];

  while (selected.length < maxStops && candidates.length) {
    candidates.sort((a, b) => {
      const bScore = scorePlace(b, preferences) + connectedScore(b, selectedIds);
      const aScore = scorePlace(a, preferences) + connectedScore(a, selectedIds);
      return bScore - aScore;
    });

    const next = candidates.shift();
    const projectedCost = selected.reduce((total, place) => total + stopCost(place), 0) + stopCost(next);
    const projectedTime = selected.reduce((total, place) => total + place.minutes, 0) + next.minutes;

    if (projectedCost <= preferences.budget + 12 && projectedTime <= preferences.hours * 60 + 45) {
      selected.push(next);
      selectedIds.push(next.id);
    }
  }

  return selected;
}

function routeEdges(route) {
  const ids = route.map((place) => place.id);
  return graph.edges.filter((edge) => ids.includes(edge.from) && ids.includes(edge.to));
}

function buildMatchScore(route, preferences) {
  const totalCost = route.reduce((total, place) => total + stopCost(place), 0);
  return Math.min(98, Math.round(64 + route.length * 7 + (preferences.budget >= totalCost ? 8 : 0)));
}

function buildLocalSummary(route, preferences) {
  if (route.length === 0) {
    return `Local fallback could not find a ${preferences.vibe} route, so the planner is holding on the area brief instead.`;
  }

  const areas = [...new Set(route.map((place) => place.area))];
  return `Local scoring still turns the ${preferences.vibe} brief into a believable route across ${areas.join(", ")} when no packaged snapshot is available.`;
}

function formatSnapshotSource(source) {
  if (source === "local-snapshot") {
    return "Local snapshot";
  }

  if (!source) return "Snapshot";
  return source
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((chunk) => {
      const lowered = chunk.toLowerCase();
      if (lowered === "neo4j") return "Neo4j";
      if (lowered === "api") return "API";
      return lowered.charAt(0).toUpperCase() + lowered.slice(1);
    })
    .join(" ");
}

function buildReasons(route, preferences, recommendation) {
  const edges = routeEdges(route);
  const totalCost = route.reduce((total, place) => total + stopCost(place), 0);
  const totalMinutes = route.reduce((total, place) => total + place.minutes, 0);
  let sourceReason = "Local fallback is active, so the browser is building the route from the curated place graph without calling Neo4j.";

  if (recommendation.mode === "snapshot") {
    sourceReason = recommendation.source === "neo4j"
      ? "Neo4j produced this route snapshot from connected venues, vibes, and short walking links."
      : "This packaged snapshot keeps the same route shape ready for demo mode when Aura is not available.";
  }

  return [
    `${route.length} stops fit into roughly ${Math.round(totalMinutes / 60)} hours with an estimated £${totalCost} spend.`,
    `${route.filter((place) => place.vibes.includes(preferences.vibe)).length} venues directly match the ${preferences.vibe} vibe.`,
    edges.length ? `Neo4j-style graph logic found ${edges.length} short venue-to-venue links, so the night reads as a route, not a list.` : "The planner found high-fit standalone stops, then keeps the fallback route stable for the live demo.",
    sourceReason,
    preferences.walkable ? "Kimchi turns the graph result into a short walk-aware concierge explanation." : "Kimchi keeps the explanation concise while vibe fit outranks walking distance.",
    "Tessl helped surface the project workflow and tool choices that got the static demo built quickly."
  ];
}

function applyRecommendation(preferences, recommendation) {
  currentRoute = recommendation.route;

  if (!currentRoute.some((place) => place.id === focusedPlaceId)) {
    focusedPlaceId = currentRoute[0]?.id ?? null;
  }

  routeScore.textContent = `${recommendation.match}%`;
  routeSource.textContent = recommendation.sourceLabel;
  routeSource.className = recommendation.sourceClass;
  routeSummary.textContent = recommendation.summary;
  renderRouteList(currentRoute);

  const reasons = buildReasons(currentRoute, preferences, recommendation);

  reasonList.replaceChildren(
    ...reasons.map((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      return item;
    })
  );

  renderGraph(currentRoute.map((place) => place.id));
  updateFocusCard();
  updateMap();
}

function renderRouteList(route) {
  routeList.replaceChildren(
    ...route.map((place, index) => {
      const item = document.createElement("li");
      item.className = "route-stop";
      const metaParts = [place.category, place.area];
      if (typeof place.walkMinutes === "number" && index > 0) {
        metaParts.push(`${place.walkMinutes} min walk`);
      } else {
        metaParts.push(place.vibes.join(", "));
      }
      const detailCopy = place.note ?? place.fact ?? place.summary;
      item.innerHTML = `
        <button class="route-stop-button${place.id === focusedPlaceId ? " is-focused" : ""}" type="button" data-place-id="${place.id}">
          <span class="stop-index">${index + 1}</span>
          <span class="stop-copy">
            <strong>${escapeHtml(place.name)}</strong>
            <span>${escapeHtml(metaParts.join(" · "))}</span>
            <span class="stop-detail">${escapeHtml(detailCopy)}</span>
          </span>
          <span class="cost">£${stopCost(place)}</span>
        </button>
      `;
      return item;
    })
  );
}

function isSnapshotEligible(preferences) {
  return preferences.hours === SNAPSHOT_PROFILE.hours
    && preferences.budget === SNAPSHOT_PROFILE.budget
    && preferences.walkable === SNAPSHOT_PROFILE.walkable;
}

function renderGraph(activeIds = []) {
  const width = 720;
  const height = 440;
  graphSvg.replaceChildren();

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("width", width);
  background.setAttribute("height", height);
  background.setAttribute("fill", "#f8f4e8");
  graphSvg.append(background);

  for (const edge of graph.edges) {
    const from = graph.places.find((place) => place.id === edge.from);
    const to = graph.places.find((place) => place.id === edge.to);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("stroke", activeIds.includes(from.id) && activeIds.includes(to.id) ? "#be5b52" : "#b7c3b6");
    line.setAttribute("stroke-width", activeIds.includes(from.id) && activeIds.includes(to.id) ? "5" : "2");
    line.setAttribute("stroke-linecap", "round");
    graphSvg.append(line);
  }

  for (const place of graph.places) {
    const active = activeIds.includes(place.id);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    circle.setAttribute("cx", place.x);
    circle.setAttribute("cy", place.y);
    circle.setAttribute("r", active ? "18" : "12");
    circle.setAttribute("fill", active ? "#246b50" : "#2f5f8f");
    circle.setAttribute("stroke", "#fff");
    circle.setAttribute("stroke-width", "4");
    label.setAttribute("x", place.x + 18);
    label.setAttribute("y", place.y + 5);
    label.setAttribute("fill", "#16201d");
    label.setAttribute("font-size", "13");
    label.setAttribute("font-weight", "800");
    label.textContent = place.name;
    group.append(circle, label);
    graphSvg.append(group);
  }
}

function populateAreaBrief() {
  areaSummary.textContent = areaIntel.summary;

  signalList.replaceChildren(
    ...areaIntel.signals.map((signal) => {
      const item = document.createElement("li");
      item.textContent = signal;
      return item;
    })
  );

  sourceList.replaceChildren(
    ...areaIntel.dataSources.map((source) => {
      const item = document.createElement("li");
      item.textContent = source;
      return item;
    })
  );
}

function updateFocusCard() {
  const place = currentRoute.find((entry) => entry.id === focusedPlaceId) ?? placesById.get(focusedPlaceId) ?? currentRoute[0];

  if (!place) {
    focusName.textContent = areaIntel.name;
    focusMeta.textContent = "Select a route stop to inspect the place on the map.";
    focusCopy.textContent = areaIntel.summary;
    return;
  }

  focusName.textContent = place.name;
  focusMeta.textContent = typeof place.walkMinutes === "number" && place.walkMinutes > 0
    ? `${place.category} · ${place.area} · ${place.walkMinutes} minute walk from the previous stop`
    : `${place.category} · ${place.area} · about ${place.minutes} minutes`;
  focusCopy.textContent = place.note ?? place.fact ?? place.summary;
}

function buildPlaceFeatures() {
  return {
    type: "FeatureCollection",
    features: graph.places.map((place) => ({
      type: "Feature",
      properties: {
        id: place.id,
        name: place.name,
        active: currentRoute.some((entry) => entry.id === place.id),
        focused: place.id === focusedPlaceId
      },
      geometry: {
        type: "Point",
        coordinates: place.coordinates
      }
    }))
  };
}

function buildRouteFeatures() {
  if (currentRoute.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: currentRoute.map((place) => place.coordinates)
        }
      }
    ]
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showPlacePopup(place, centerMap = false) {
  if (!mapReady || !place) return;

  if (!mapPopup) {
    mapPopup = new window.maplibregl.Popup({
      closeButton: false,
      offset: 18
    });
  }

  if (centerMap) {
    areaMap.flyTo({
      center: place.coordinates,
      zoom: 15.2,
      essential: true
    });
  }

  mapPopup
    .setLngLat(place.coordinates)
    .setHTML(
      `<strong>${escapeHtml(place.name)}</strong><p>${escapeHtml(place.category)} · ${escapeHtml(place.area)}</p><p>${escapeHtml(place.note ?? place.fact ?? place.summary)}</p>`
    )
    .addTo(areaMap);
}

function focusPlace(placeId, centerMap = false) {
  focusedPlaceId = placeId;
  renderRouteList(currentRoute);
  updateFocusCard();
  updateMap();

  const place = currentRoute.find((entry) => entry.id === placeId) ?? placesById.get(placeId);
  if (place) {
    showPlacePopup(place, centerMap);
  }
}

function updateMap() {
  if (!mapReady) return;

  areaMap.getSource("places").setData(buildPlaceFeatures());
  areaMap.getSource("route").setData(buildRouteFeatures());
}

function createMap() {
  if (!window.maplibregl) {
    mapStatus.textContent = "Map library unavailable";
    return;
  }

  areaMap = new window.maplibregl.Map({
    container: "area-map",
    center: [areaIntel.center.lon, areaIntel.center.lat],
    zoom: 14.5,
    pitch: 24,
    bearing: -18,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors"
        }
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm"
        }
      ]
    }
  });

  areaMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");

  areaMap.on("load", () => {
    mapReady = true;
    mapStatus.textContent = "Live";

    areaMap.addSource("route", {
      type: "geojson",
      data: buildRouteFeatures()
    });
    areaMap.addSource("places", {
      type: "geojson",
      data: buildPlaceFeatures()
    });

    areaMap.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#be5b52",
        "line-width": 4,
        "line-opacity": 0.8
      }
    });

    areaMap.addLayer({
      id: "place-circles",
      type: "circle",
      source: "places",
      paint: {
        "circle-color": [
          "case",
          ["boolean", ["get", "focused"], false],
          "#f1b84b",
          ["boolean", ["get", "active"], false],
          "#246b50",
          "#2f5f8f"
        ],
        "circle-radius": [
          "case",
          ["boolean", ["get", "focused"], false],
          10,
          ["boolean", ["get", "active"], false],
          8,
          6
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff"
      }
    });

    areaMap.addLayer({
      id: "place-labels",
      type: "symbol",
      source: "places",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-offset": [0, 1.4],
        "text-anchor": "top"
      },
      paint: {
        "text-color": "#16201d",
        "text-halo-color": "#fbfaf5",
        "text-halo-width": 1
      }
    });

    areaMap.on("click", "place-circles", (event) => {
      const feature = event.features?.[0];
      const placeId = feature?.properties?.id;
      if (!placeId) return;
      focusPlace(placeId, true);
    });

    areaMap.on("mouseenter", "place-circles", () => {
      areaMap.getCanvas().style.cursor = "pointer";
    });

    areaMap.on("mouseleave", "place-circles", () => {
      areaMap.getCanvas().style.cursor = "";
    });

    updateMap();

    if (focusedPlaceId) {
      const place = currentRoute.find((entry) => entry.id === focusedPlaceId) ?? placesById.get(focusedPlaceId);
      showPlacePopup(place);
    }
  });

  areaMap.on("error", () => {
    mapStatus.textContent = "Tile load issue";
  });
}

function parseSnapshotStop(stop, index) {
  const localPlace = placesById.get(stop.id);
  if (!localPlace) {
    throw new Error(`stop ${index + 1} references unknown place id ${stop.id}`);
  }

  return {
    ...localPlace,
    name: stop.name,
    category: stop.category,
    area: stop.area,
    walkMinutes: stop.walkMinutes,
    note: stop.note,
    fact: stop.fact
  };
}

function parseSnapshotData(snapshot, vibe) {
  validateSnapshot(snapshot);

  if (snapshot.vibe !== vibe) {
    throw new Error(`snapshot vibe mismatch: expected ${vibe}`);
  }

  return {
    vibe: snapshot.vibe,
    source: snapshot.source,
    summary: snapshot.summary.trim(),
    route: snapshot.stops.map(parseSnapshotStop)
  };
}

async function fetchSnapshotRecommendation(vibe) {
  try {
    const response = await fetch(`data/recommendations/${encodeURIComponent(vibe)}.json`, { cache: "no-store" });
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      console.warn(`Invalid ${vibe} snapshot JSON; using local fallback instead.`, error);
      return null;
    }

    try {
      return parseSnapshotData(payload, vibe);
    } catch (error) {
      console.warn(`Invalid ${vibe} snapshot data; using local fallback instead.`, error);
      return null;
    }
  } catch {
    return null;
  }
}

function buildLocalRecommendation(preferences) {
  const route = buildRoute(preferences);
  return {
    mode: "local",
    route,
    match: buildMatchScore(route, preferences),
    summary: buildLocalSummary(route, preferences),
    sourceLabel: "Source: local fallback",
    sourceClass: "route-source is-fallback"
  };
}

function buildSnapshotRecommendation(snapshot, preferences) {
  const sourceLabel = snapshot.source === "neo4j"
    ? "Source: Neo4j route snapshot"
    : "Source: packaged route snapshot";
  const sourceClass = snapshot.source === "neo4j"
    ? "route-source is-neo4j"
    : "route-source is-packaged";

  return {
    mode: "snapshot",
    source: snapshot.source,
    route: snapshot.route,
    match: buildMatchScore(snapshot.route, preferences),
    summary: snapshot.summary,
    sourceLabel,
    sourceClass
  };
}

async function renderRoute() {
  const requestId = ++activeRouteRequest;
  const preferences = readPreferences();
  budgetOutput.value = `£${preferences.budget}`;

  const localRecommendation = buildLocalRecommendation(preferences);
  applyRecommendation(preferences, localRecommendation);

  if (!isSnapshotEligible(preferences)) {
    return;
  }

  const snapshot = await fetchSnapshotRecommendation(preferences.vibe);
  if (requestId !== activeRouteRequest || !snapshot) return;

  applyRecommendation(preferences, buildSnapshotRecommendation(snapshot, preferences));
}

async function loadNearbyWiki() {
  wikiStatus.textContent = "Loading";

  try {
    const geosearchParams = new URLSearchParams({
      action: "query",
      list: "geosearch",
      gscoord: `${areaIntel.center.lat}|${areaIntel.center.lon}`,
      gsradius: String(areaIntel.wiki.radiusMeters),
      gslimit: String(areaIntel.wiki.limit),
      format: "json",
      origin: "*"
    });
    const geosearchResponse = await fetch(`https://en.wikipedia.org/w/api.php?${geosearchParams}`);
    const geosearch = await geosearchResponse.json();
    const pages = geosearch.query?.geosearch ?? [];

    if (pages.length === 0) {
      throw new Error("No wiki pages returned");
    }

    const extractParams = new URLSearchParams({
      action: "query",
      prop: "extracts|info",
      inprop: "url",
      pageids: pages.map((page) => page.pageid).join("|"),
      exintro: "1",
      exsentences: "2",
      explaintext: "1",
      format: "json",
      origin: "*"
    });
    const extractResponse = await fetch(`https://en.wikipedia.org/w/api.php?${extractParams}`);
    const extractData = await extractResponse.json();
    const pageMap = extractData.query?.pages ?? {};

    renderWikiList(
      pages.map((page) => ({
        title: page.title,
        url: pageMap[page.pageid]?.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        meta: `${Math.round(page.dist)}m away`,
        extract: pageMap[page.pageid]?.extract ?? "No summary returned for this page yet."
      }))
    );
    wikiStatus.textContent = "Live nearby pages";
  } catch (error) {
    renderWikiList(areaIntel.fallbackWiki);
    wikiStatus.textContent = "Using local fallback";
  }
}

function renderWikiList(entries) {
  wikiList.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement("li");
      item.className = "wiki-item";
      item.innerHTML = `
        <a href="${entry.url}" target="_blank" rel="noreferrer">${entry.title}</a>
        <span>${entry.meta}</span>
        <p>${entry.extract}</p>
      `;
      return item;
    })
  );
}

routeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-place-id]");
  if (!button) return;
  focusPlace(button.dataset.placeId, true);
});

form.addEventListener("input", renderRoute);
await renderRoute();
createMap();
loadNearbyWiki();

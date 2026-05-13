const form = document.querySelector("#route-form");
const budgetOutput = document.querySelector("#budget-output");
const routeScore = document.querySelector("#route-score");
const routeList = document.querySelector("#route-list");
const reasonList = document.querySelector("#reason-list");
const graphSvg = document.querySelector("#graph-svg");

const response = await fetch("data/places.json");
const graph = await response.json();

const moneyByBudget = {
  low: 18,
  medium: 30,
  high: 45
};

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

function renderRoute() {
  const preferences = readPreferences();
  budgetOutput.value = `£${preferences.budget}`;
  const route = buildRoute(preferences);
  const totalCost = route.reduce((total, place) => total + stopCost(place), 0);
  const totalMinutes = route.reduce((total, place) => total + place.minutes, 0);
  const match = Math.min(98, Math.round(64 + route.length * 7 + (preferences.budget >= totalCost ? 8 : 0)));

  routeScore.textContent = `${match}%`;
  routeList.replaceChildren(
    ...route.map((place, index) => {
      const item = document.createElement("li");
      item.className = "route-stop";
      item.innerHTML = `
        <span class="stop-index">${index + 1}</span>
        <div>
          <h4>${place.name}</h4>
          <p>${place.category} · ${place.area} · ${place.vibes.join(", ")}</p>
        </div>
        <span class="cost">£${stopCost(place)}</span>
      `;
      return item;
    })
  );

  const edges = routeEdges(route);
  const reasons = [
    `${route.length} stops fit inside roughly ${Math.round(totalMinutes / 60)} hours with an estimated £${totalCost} spend.`,
    `${route.filter((place) => place.vibes.includes(preferences.vibe)).length} venues directly match the ${preferences.vibe} mood.`,
    edges.length ? `The graph found ${edges.length} short venue-to-venue links for an easier route.` : "The route favours high-scoring standalone venues because direct graph links are sparse.",
    preferences.walkable ? "Short walks are weighted higher than raw venue popularity." : "Venue fit is weighted higher than walking distance."
  ];

  reasonList.replaceChildren(
    ...reasons.map((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      return item;
    })
  );

  renderGraph(route.map((place) => place.id));
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

form.addEventListener("input", renderRoute);
renderRoute();


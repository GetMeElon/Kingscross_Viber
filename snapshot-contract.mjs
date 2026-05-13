export const SUPPORTED_VIBES = ["creative", "food", "music", "quiet"];
export const SNAPSHOT_SOURCES = new Set(["neo4j", "local-snapshot"]);

export function normalizeVibe(vibe) {
  const normalized = `${vibe || ""}`.trim().toLowerCase();

  if (!SUPPORTED_VIBES.includes(normalized)) {
    throw new Error(
      `Unsupported vibe "${vibe}". Supported vibes: ${SUPPORTED_VIBES.join(", ")}.`
    );
  }

  return normalized;
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Snapshot must be an object.");
  }

  if (normalizeVibe(snapshot.vibe) !== snapshot.vibe) {
    throw new Error(`Snapshot vibe "${snapshot.vibe}" is not normalized.`);
  }

  if (!SNAPSHOT_SOURCES.has(snapshot.source)) {
    throw new Error(
      `Snapshot source must be one of ${[...SNAPSHOT_SOURCES].join(", ")}.`
    );
  }

  if (typeof snapshot.summary !== "string" || !snapshot.summary.trim()) {
    throw new Error("Snapshot summary must be a non-empty string.");
  }

  if (!Array.isArray(snapshot.stops) || snapshot.stops.length !== 3) {
    throw new Error("Snapshot must include exactly three stops.");
  }

  snapshot.stops.forEach((stop, index) => {
    if (!stop || typeof stop !== "object") {
      throw new Error(`Stop ${index + 1} must be an object.`);
    }

    for (const field of ["id", "name", "category", "area", "note", "fact"]) {
      if (typeof stop[field] !== "string" || stop[field].trim() === "") {
        throw new Error(`Stop ${index + 1} is missing a valid ${field}.`);
      }
    }

    if (!Number.isInteger(stop.walkMinutes) || stop.walkMinutes < 0) {
      throw new Error(`Stop ${index + 1} has an invalid walkMinutes value.`);
    }
  });
}

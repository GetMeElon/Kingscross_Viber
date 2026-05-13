import { getNeo4jConfig, loadLocalEnv } from './env.mjs';
import { queryRecommendationRouteInNeo4j, withNeo4jDriver } from './neo4j-client.mjs';
import {
  buildSnapshot,
  buildRecommendationSnapshot,
  loadPlacesGraphFromFile,
  normalizeVibe,
  serializeSnapshot
} from './recommendation-engine.mjs';

function parseArgs(argv) {
  const args = [...argv];
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((value) => !value.startsWith('--'));
  return {
    dryRun,
    vibe: normalizeVibe(positional[0])
  };
}

async function main() {
  const { dryRun, vibe } = parseArgs(process.argv.slice(2));
  let snapshot;

  if (dryRun) {
    const graph = await loadPlacesGraphFromFile();
    snapshot = buildRecommendationSnapshot(vibe, graph);
  } else {
    await loadLocalEnv();
    const config = getNeo4jConfig();
    snapshot = await withNeo4jDriver(config, async ({ neo4j, driver }) => {
      const route = await queryRecommendationRouteInNeo4j({
        neo4j,
        driver,
        database: config.database,
        vibe
      });
      return buildSnapshot(vibe, route.places, route.walkMinutes, route.score);
    });
  }

  process.stdout.write(serializeSnapshot(snapshot));
}

main().catch((error) => {
  console.error(`Neo4j query failed: ${error.message}`);
  console.error('Usage: node scripts/query-neo4j.mjs <creative|food|music|quiet> [--dry-run]');
  process.exitCode = 1;
});

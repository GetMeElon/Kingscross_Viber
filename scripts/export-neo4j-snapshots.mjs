import fs from 'node:fs/promises';
import path from 'node:path';
import { getNeo4jConfig, loadLocalEnv, ROOT_DIR } from './env.mjs';
import { queryRecommendationRouteInNeo4j, withNeo4jDriver } from './neo4j-client.mjs';
import {
  SUPPORTED_VIBES,
  buildSnapshot,
  buildSnapshotsForVibes,
  loadPlacesGraphFromFile,
  serializeSnapshot
} from './recommendation-engine.mjs';

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    fromLocal: argv.includes('--from-local')
  };
}

async function buildLiveSnapshots() {
  await loadLocalEnv();
  const config = getNeo4jConfig();
  return withNeo4jDriver(config, async ({ neo4j, driver }) => {
    const snapshots = [];

    for (const vibe of SUPPORTED_VIBES) {
      const route = await queryRecommendationRouteInNeo4j({
        neo4j,
        driver,
        database: config.database,
        vibe
      });
      snapshots.push(buildSnapshot(vibe, route.places, route.walkMinutes, route.score));
    }

    return snapshots;
  });
}

async function buildLocalSnapshots() {
  const graph = await loadPlacesGraphFromFile();
  return buildSnapshotsForVibes(graph, SUPPORTED_VIBES);
}

async function resolveSnapshots({ dryRun, fromLocal }) {
  if (dryRun || fromLocal) {
    return buildLocalSnapshots();
  }
  return buildLiveSnapshots();
}

async function writeSnapshots(snapshots) {
  const outDir = path.join(ROOT_DIR, 'data', 'recommendations');
  const stagingRoot = path.join(ROOT_DIR, 'data');
  const stageDir = await fs.mkdtemp(path.join(stagingRoot, '.recommendations-'));

  try {
    for (const snapshot of snapshots) {
      const fileName = `${snapshot.vibe}.json`;
      const stagePath = path.join(stageDir, fileName);
      await fs.writeFile(stagePath, serializeSnapshot(snapshot), 'utf8');
    }

    await fs.mkdir(outDir, { recursive: true });

    for (const snapshot of snapshots) {
      const fileName = `${snapshot.vibe}.json`;
      await fs.rename(path.join(stageDir, fileName), path.join(outDir, fileName));
    }
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
}

async function main() {
  const { dryRun, fromLocal } = parseArgs(process.argv.slice(2));
  const snapshots = await resolveSnapshots({ dryRun, fromLocal });

  if (dryRun) {
    console.log(
      `Validated ${snapshots.length} recommendation snapshots in dry-run mode (${SUPPORTED_VIBES.join(', ')}).`
    );
    return;
  }

  await writeSnapshots(snapshots);
  if (fromLocal) {
    console.log(
      `Exported ${snapshots.length} recommendation snapshots to data/recommendations/ from the local fallback graph.`
    );
    return;
  }

  console.log(`Exported ${snapshots.length} recommendation snapshots to data/recommendations/ from Neo4j.`);
}

main().catch((error) => {
  console.error(`Neo4j export failed: ${error.message}`);
  process.exitCode = 1;
});

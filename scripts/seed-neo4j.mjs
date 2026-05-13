import { getNeo4jConfig, loadLocalEnv } from './env.mjs';
import { withNeo4jDriver, seedGraphInNeo4j } from './neo4j-client.mjs';
import { SUPPORTED_VIBES, loadPlacesGraphFromFile } from './recommendation-engine.mjs';

async function main() {
  await loadLocalEnv();

  const graph = await loadPlacesGraphFromFile();
  const config = getNeo4jConfig();

  await withNeo4jDriver(config, async ({ neo4j, driver }) => {
    await seedGraphInNeo4j({
      neo4j,
      driver,
      database: config.database,
      graph
    });
  });

  console.log(
    `Seeded ${graph.places.length} places, ${SUPPORTED_VIBES.length} built-in vibes, and ${graph.edges.length} walk links into ${config.database}.`
  );
}

main().catch((error) => {
  console.error(`Neo4j seed failed: ${error.message}`);
  process.exitCode = 1;
});

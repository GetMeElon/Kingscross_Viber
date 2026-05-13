export async function importNeo4jDriver() {
  try {
    const module = await import('neo4j-driver');
    return module.default ?? module;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        'neo4j-driver is not installed. Run "npm install" before using live Neo4j scripts.'
      );
    }

    throw error;
  }
}

const DEMO_PLACE_LABEL = 'KXVibePlace';
const DEMO_VIBE_LABEL = 'KXVibeVibe';

function queryOptions(neo4j, database, routing) {
  return {
    database,
    routing,
    transactionConfig: {
      metadata: {
        app: 'kingscross-viber',
        source: 'scripts'
      }
    }
  };
}

export async function withNeo4jDriver(config, run) {
  const neo4j = await importNeo4jDriver();
  const driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
    {
      disableLosslessIntegers: true
    }
  );

  try {
    await driver.verifyConnectivity();
    return await run({ neo4j, driver });
  } finally {
    await driver.close();
  }
}

export async function seedGraphInNeo4j({ neo4j, driver, database, graph }) {
  const writeOptions = queryOptions(neo4j, database, neo4j.routing.WRITE);
  const placeIds = graph.places.map((place) => place.id);
  const vibeNames = [...new Set(graph.places.flatMap((place) => place.vibes))].sort();

  await driver.executeQuery(
    `CREATE CONSTRAINT place_id_unique IF NOT EXISTS FOR (place:${DEMO_PLACE_LABEL}) REQUIRE place.id IS UNIQUE`,
    {},
    writeOptions
  );
  await driver.executeQuery(
    `CREATE CONSTRAINT vibe_name_unique IF NOT EXISTS FOR (vibe:${DEMO_VIBE_LABEL}) REQUIRE vibe.name IS UNIQUE`,
    {},
    writeOptions
  );
  await driver.executeQuery(
    `MATCH (place:Place:${DEMO_PLACE_LABEL}) WHERE NOT place.id IN $placeIds DETACH DELETE place`,
    { placeIds },
    writeOptions
  );
  await driver.executeQuery(
    `MATCH (vibe:Vibe:${DEMO_VIBE_LABEL}) WHERE NOT vibe.name IN $vibeNames DETACH DELETE vibe`,
    { vibeNames },
    writeOptions
  );
  await driver.executeQuery(
    `
      UNWIND $places AS place
      MERGE (node:Place:${DEMO_PLACE_LABEL} { id: place.id })
      SET node.name = place.name,
          node.category = place.category,
          node.area = place.area,
          node.cost = place.cost,
          node.minutes = place.minutes,
          node.summary = place.summary,
          node.coordinates = place.coordinates,
          node.x = place.x,
          node.y = place.y
    `,
    { places: graph.places },
    writeOptions
  );
  await driver.executeQuery(
    `MATCH (:Place:${DEMO_PLACE_LABEL})-[relationship:HAS_VIBE]->(:Vibe:${DEMO_VIBE_LABEL}) DELETE relationship`,
    {},
    writeOptions
  );
  await driver.executeQuery(
    `
      UNWIND $places AS place
      MATCH (node:Place:${DEMO_PLACE_LABEL} { id: place.id })
      UNWIND place.vibes AS vibeName
      MERGE (vibe:Vibe:${DEMO_VIBE_LABEL} { name: vibeName })
      MERGE (node)-[:HAS_VIBE]->(vibe)
    `,
    { places: graph.places },
    writeOptions
  );
  await driver.executeQuery(
    `MATCH (:Place:${DEMO_PLACE_LABEL})-[relationship:WALKS_TO]->(:Place:${DEMO_PLACE_LABEL}) DELETE relationship`,
    {},
    writeOptions
  );
  await driver.executeQuery(
    `
      UNWIND $edges AS edge
      MATCH (from:Place:${DEMO_PLACE_LABEL} { id: edge.from })
      MATCH (to:Place:${DEMO_PLACE_LABEL} { id: edge.to })
      MERGE (from)-[forward:WALKS_TO]->(to)
      SET forward.minutes = edge.walk
      MERGE (to)-[backward:WALKS_TO]->(from)
      SET backward.minutes = edge.walk
    `,
    { edges: graph.edges },
    writeOptions
  );
}

export async function fetchGraphFromNeo4j({ neo4j, driver, database }) {
  const readOptions = queryOptions(neo4j, database, neo4j.routing.READ);
  const placeResult = await driver.executeQuery(
    `
      MATCH (place:Place:${DEMO_PLACE_LABEL})
      OPTIONAL MATCH (place)-[:HAS_VIBE]->(vibe:Vibe:${DEMO_VIBE_LABEL})
      WITH place, [name IN collect(vibe.name) WHERE name IS NOT NULL] AS vibes
      RETURN place.id AS id,
             place.name AS name,
             place.category AS category,
             place.area AS area,
             place.cost AS cost,
             place.minutes AS minutes,
             place.summary AS summary,
             place.coordinates AS coordinates,
             place.x AS x,
             place.y AS y,
             vibes
      ORDER BY id
    `,
    {},
    readOptions
  );
  const edgeResult = await driver.executeQuery(
    `
      MATCH (from:Place:${DEMO_PLACE_LABEL})-[walk:WALKS_TO]->(to:Place:${DEMO_PLACE_LABEL})
      WHERE from.id < to.id
      RETURN from.id AS from, to.id AS to, walk.minutes AS walk
      ORDER BY from, to
    `,
    {},
    readOptions
  );

  return {
    places: placeResult.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      category: record.get('category'),
      area: record.get('area'),
      cost: record.get('cost'),
      minutes: record.get('minutes'),
      summary: record.get('summary'),
      coordinates: record.get('coordinates') || [],
      x: record.get('x'),
      y: record.get('y'),
      vibes: [...(record.get('vibes') || [])].sort()
    })),
    edges: edgeResult.records.map((record) => ({
      from: record.get('from'),
      to: record.get('to'),
      walk: record.get('walk')
    }))
  };
}

export async function queryRecommendationRouteInNeo4j({
  neo4j,
  driver,
  database,
  vibe
}) {
  const readOptions = queryOptions(neo4j, database, neo4j.routing.READ);
  const result = await driver.executeQuery(
    `
      MATCH (start:Place:${DEMO_PLACE_LABEL})-[:HAS_VIBE]->(:Vibe:${DEMO_VIBE_LABEL} { name: $vibe })
      MATCH (start)-[first:WALKS_TO]->(middle:Place:${DEMO_PLACE_LABEL})-[second:WALKS_TO]->(finish:Place:${DEMO_PLACE_LABEL})
      WHERE start.id <> middle.id
        AND middle.id <> finish.id
        AND start.id <> finish.id
      WITH [start, middle, finish] AS route, first, second
      WITH route,
           first,
           second,
           reduce(
             vibeMatches = 0,
             place IN route |
             vibeMatches + CASE
               WHEN $vibe IN [(place)-[:HAS_VIBE]->(matched:Vibe:${DEMO_VIBE_LABEL}) | matched.name] THEN 1
               ELSE 0
             END
           ) AS vibeMatches,
           reduce(
             centrality = 0,
             place IN route |
             centrality + CASE place.area
               WHEN "King's Cross" THEN 4
               WHEN "St Pancras" THEN 3
               WHEN "Granary Square" THEN 2
               WHEN "Camden" THEN -3
               ELSE 0
             END
           ) AS centrality,
           coalesce(first.minutes, 0) + coalesce(second.minutes, 0) AS totalWalk,
           CASE WHEN any(place IN route WHERE place.area = 'Camden') THEN 4 ELSE 0 END AS outlierPenalty,
           CASE route[0].area
             WHEN "King's Cross" THEN 4
             WHEN "St Pancras" THEN 3
             WHEN "Granary Square" THEN 2
             WHEN "Camden" THEN -3
             ELSE 0
           END AS startPriority,
           route[0].id AS startId,
           route[1].id AS middleId,
           route[2].id AS finishId
      RETURN [place IN route | place {
        .id,
        .name,
        .category,
        .area,
        .cost,
        .minutes,
        .summary
      }] AS places,
      [0, toInteger(first.minutes), toInteger(second.minutes)] AS walkMinutes,
      vibeMatches,
      centrality,
      totalWalk,
      (vibeMatches * 100) + (centrality * 3) - (totalWalk * 2) - outlierPenalty AS score
      ORDER BY score DESC,
               vibeMatches DESC,
               totalWalk ASC,
               centrality DESC,
               startPriority DESC,
               startId ASC,
               middleId ASC,
               finishId ASC
      LIMIT 1
    `,
    { vibe },
    readOptions
  );

  const record = result.records[0];

  if (!record) {
    throw new Error(`No route found in Neo4j for vibe "${vibe}".`);
  }

  return {
    places: record.get('places').map((place) => ({ ...place })),
    walkMinutes: record.get('walkMinutes').map((value) => Number(value)),
    score: {
      vibeMatches: Number(record.get('vibeMatches')),
      centrality: Number(record.get('centrality')),
      totalWalk: Number(record.get('totalWalk')),
      score: Number(record.get('score'))
    }
  };
}

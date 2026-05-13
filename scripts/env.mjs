import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_ENV_FILES = ['.env', '.env.local'];

function parseEnv(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value.replace(/\\n/g, '\n');
  }

  return values;
}

export async function loadLocalEnv(envFiles = DEFAULT_ENV_FILES) {
  const merged = {};
  const loadedFiles = [];

  for (const envFile of envFiles) {
    const envPath = path.join(ROOT_DIR, envFile);

    try {
      const content = await fs.readFile(envPath, 'utf8');
      Object.assign(merged, parseEnv(content));
      loadedFiles.push(envFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return loadedFiles;
}

export function getNeo4jConfig() {
  const config = {
    uri: process.env.NEO4J_URI,
    username: process.env.NEO4J_USERNAME,
    password: process.env.NEO4J_PASSWORD,
    database: process.env.NEO4J_DATABASE || 'neo4j'
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'database' && !value)
    .map(([key]) => key.toUpperCase());

  if (missing.length > 0) {
    throw new Error(
      `Missing Neo4j configuration: ${missing.join(', ')}. Copy .env.example to .env.local and fill in local-only Aura credentials.`
    );
  }

  return config;
}

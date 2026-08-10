#!/usr/bin/env node
/**
 * Discovers and verifies the ArcGIS layers this deployment should use.
 *
 * Government services reorganise their layer indexes without notice, so the
 * exact URL is a deployment setting rather than a constant in the code. Run
 * this once per environment and paste the printed URLs into .env.local.
 *
 *   node scripts/probe-sources.mjs
 *   node scripts/probe-sources.mjs https://some-other-server/arcgis/rest/services
 */

const CANDIDATE_ROOTS = [
  {
    key: "INGEMMET_LAYER_URL",
    label: "INGEMMET — GEOCATMIN",
    root: "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services",
    match: /catastro|minero|derecho/i,
  },
  {
    key: "SERNANP_LAYER_URL",
    label: "SERNANP — Geo ANP",
    root: "https://geoservicios.sernanp.gob.pe/arcgis/rest/services",
    match: /anp|protegid|nacional/i,
  },
];

const TIMEOUT_MS = 20_000;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function listServices(root) {
  const catalog = await getJson(`${root}?f=json`);
  const services = catalog.services ?? [];
  const folders = catalog.folders ?? [];
  const nested = await Promise.all(
    folders.map(async (folder) => {
      try {
        const sub = await getJson(`${root}/${folder}?f=json`);
        return sub.services ?? [];
      } catch {
        return [];
      }
    }),
  );
  return [...services, ...nested.flat()];
}

async function describeService(root, service) {
  const url = `${root}/${service.name}/${service.type}`;
  try {
    const meta = await getJson(`${url}?f=json`);
    const layers = (meta.layers ?? []).map((layer) => ({
      id: layer.id,
      name: layer.name,
      url: `${url}/${layer.id}`,
    }));
    return { url, layers };
  } catch (error) {
    return { url, layers: [], error: error.message };
  }
}

async function probe(target) {
  process.stdout.write(`\n=== ${target.label}\n${target.root}\n`);
  let services;
  try {
    services = await listServices(target.root);
  } catch (error) {
    process.stdout.write(`  ! Could not list services: ${error.message}\n`);
    process.stdout.write("    The host may be unreachable from this network, or the root path changed.\n");
    return;
  }

  const interesting = services.filter((s) => target.match.test(s.name));
  const pool = interesting.length > 0 ? interesting : services.slice(0, 10);
  if (interesting.length === 0) {
    process.stdout.write(`  (no service name matched ${target.match}; showing the first ${pool.length})\n`);
  }

  for (const service of pool) {
    const described = await describeService(target.root, service);
    if (described.error) {
      process.stdout.write(`  - ${service.name}: ${described.error}\n`);
      continue;
    }
    process.stdout.write(`  - ${service.name} (${described.layers.length} layers)\n`);
    for (const layer of described.layers) {
      const flag = target.match.test(layer.name) ? " <-- candidate" : "";
      process.stdout.write(`      [${layer.id}] ${layer.name}${flag}\n`);
      if (flag) process.stdout.write(`          ${target.key}=${layer.url}\n`);
    }
  }
}

const override = process.argv[2];
const targets = override
  ? [{ key: "CUSTOM_LAYER_URL", label: "Custom root", root: override, match: /.*/ }]
  : CANDIDATE_ROOTS;

for (const target of targets) {
  await probe(target);
}

process.stdout.write(
  "\nCopy the chosen layer URLs into .env.local, then confirm with: curl -s localhost:3000/api/health/sources | jq\n",
);

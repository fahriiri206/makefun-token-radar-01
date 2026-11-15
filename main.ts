// FIELDNOTE token launch radar: sealed snapshot in, ranked board and static dashboard out.
//
// Input:  $MAKEFUN_INPUT_DIR/snapshot.json (default /input/snapshot.json), or --input <file|dir>.
// Output: $MAKEFUN_OUTPUT_DIR (default /output), or --output <dir>:
//   board.json      the ranked board (100..4000 rows, every watchlist slug covered)
//   data.js         the same data for the offline dashboard (window.FIELDNOTE)
//   dashboard/      index.html, app.css, app.js copied from this repository
//   screenshots/    the three actual browser captures copied from this repository
//   dossier.json    exactly buildDossier() from vendor/makefun-board.ts
//
// Node 22.18+ standard library only. No network is used at build or run time.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot, SnapshotError } from './lib/radar.ts';
import { buildDossier, DossierError } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((value) => value.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`FIELDNOTE: no snapshot at ${inputFile}. Set MAKEFUN_INPUT_DIR or pass --input <snapshot.json|directory>.\n`);
  process.exit(2);
}
if (!statSync(inputFile).isFile()) {
  process.stderr.write(`FIELDNOTE: ${inputFile} is not a regular file; pass the snapshot.json file or the directory that holds it.\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
if (resolve(out) === resolve(here) || resolve(out) === resolve(join(here, 'dashboard')) || resolve(out) === resolve(join(here, 'screenshots'))) {
  process.stderr.write(`FIELDNOTE: refusing to write output into the source tree at ${out}; choose another --output directory.\n`);
  process.exit(2);
}

let snapshot;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
} catch (error) {
  const message = error instanceof SnapshotError ? error.message : String(error);
  process.stderr.write(`FIELDNOTE: the snapshot cannot be read: ${message}\n`);
  process.exit(2);
}

const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`FIELDNOTE: the board fails its own gate: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

function copyTree(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const entry of readdirSync(from, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name.startsWith('.')) continue;
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyTree(source, target).map((name) => `${entry.name}/${name}`));
      continue;
    }
    if (!entry.isFile()) continue;
    copyFileSync(source, target);
    copied.push(entry.name);
  }
  return copied;
}

rmSync(join(out, 'dashboard'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });

const dashboardFiles = copyTree(join(here, 'dashboard'), join(out, 'dashboard'));
if (!dashboardFiles.includes('index.html') || !dashboardFiles.some((name) => name.endsWith('.css')) || !dashboardFiles.some((name) => name.endsWith('.js'))) {
  process.stderr.write('FIELDNOTE: dashboard/ must hold index.html, at least one .css and at least one .js file.\n');
  process.exit(1);
}

const shots = copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3 || shots.length > SCREENSHOT_CAPS.max) {
  process.stderr.write(`FIELDNOTE: screenshots/ holds ${shots.length} images; hand in 3 or 4 (board, detail, filtered view).\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`FIELDNOTE: screenshots/${name}: names are letters, digits, dot, underscore and dash, 1..128 characters.\n`);
    process.exit(1);
  }
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > SCREENSHOT_CAPS.max_bytes) {
    process.stderr.write(`FIELDNOTE: screenshots/${name} is ${size} bytes, over the ${SCREENSHOT_CAPS.max_bytes}-byte cap.\n`);
    process.exit(1);
  }
}

try {
  writeFileSync(
    join(out, 'dossier.json'),
    buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: DASHBOARD_CAPS }),
  );
} catch (error) {
  const message = error instanceof DossierError ? error.message : String(error);
  process.stderr.write(`FIELDNOTE: dossier.json was not written: ${message}\n`);
  process.exit(1);
}

const dossierBytes = statSync(join(out, 'dossier.json')).size;
process.stdout.write(
  `FIELDNOTE: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} watchlist, ` +
    `${radar.meta.board_size} ranked rows (${radar.meta.early_size} early), ${radar.meta.live_size} live-token records.\n` +
    `FIELDNOTE: snapshot ${snapshot.as_of}; model ${radar.meta.model.version}; ` +
    `wrote board.json, data.js, dashboard/ (${dashboardFiles.length} files), screenshots/ (${shots.length}), dossier.json (${dossierBytes} bytes).\n`,
);

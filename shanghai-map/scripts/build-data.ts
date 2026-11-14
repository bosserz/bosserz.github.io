/**
 * data/places.csv -> public/places.geojson + public/unplaced.json
 *
 *   npx tsx scripts/build-data.ts            # dev: report problems, keep going
 *   npx tsx scripts/build-data.ts --strict   # build: exit 1 on any error
 *
 * Runs automatically via `predev` / `prebuild`, and again inside `vite dev`
 * whenever the CSV changes (see vite.config.ts).
 *
 * Coordinates in the CSV must be GCJ-02 (from the AMap picker). They are written as-is.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = resolve(ROOT, 'data/places.csv');
const TEST_CSV = resolve(ROOT, 'data/test-places.csv');
const OUT_GEOJSON = resolve(ROOT, 'public/places.geojson');
const OUT_UNPLACED = resolve(ROOT, 'public/unplaced.json');

const CATEGORIES = ['food', 'cafe', 'sight'] as const;
const BOUNDS = { lng: [120.8, 122.2], lat: [30.6, 31.9] } as const;

type Row = Record<string, string | undefined>;
type Issue = { level: 'error' | 'warning'; id: string; line: number; message: string };

export interface BuildResult {
  placed: number;
  unplaced: { id: string; name_en: string; name_zh: string }[];
  issues: Issue[];
  usedTestRows: boolean;
  geojson: { type: string; crs_note: string; features: unknown[] };
}

function parse(path: string): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const { data, errors } = Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  for (const e of errors) throw new Error(`${path}: CSV parse error on row ${(e.row ?? 0) + 2}: ${e.message}`);
  return data;
}

const s = (v: string | undefined) => (v ?? '').trim();

export interface BuildOptions {
  csvPath?: string;
  testCsvPath?: string;
  /** Set to false in tests to skip writing files. */
  write?: boolean;
}

export function buildData({ csvPath = CSV, testCsvPath = TEST_CSV, write = true }: BuildOptions = {}): BuildResult {
  const rows = parse(csvPath);
  const issues: Issue[] = [];
  const seen = new Map<string, number>();
  const features: unknown[] = [];
  const unplaced: BuildResult['unplaced'] = [];

  const add = (row: Row, line: number) => {
    const id = s(row.id);
    const err = (message: string) => issues.push({ level: 'error', id: id || '(no id)', line, message });

    if (!id) return err('missing id');
    if (seen.has(id)) return err(`duplicate id (also on line ${seen.get(id)})`);
    seen.set(id, line);

    const category = s(row.category);
    if (!(CATEGORIES as readonly string[]).includes(category)) return err(`unknown category "${category}" (use ${CATEGORIES.join(' | ')})`);
    if (!s(row.name_en)) return err('missing name_en');

    const lngRaw = s(row.lng);
    const latRaw = s(row.lat);
    if (!lngRaw || !latRaw) {
      unplaced.push({ id, name_en: s(row.name_en), name_zh: s(row.name_zh) });
      return;
    }
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return err(`lng/lat not numbers: "${lngRaw}", "${latRaw}"`);
    if (lng < BOUNDS.lng[0] || lng > BOUNDS.lng[1] || lat < BOUNDS.lat[0] || lat > BOUNDS.lat[1]) {
      const swapped = lat >= BOUNDS.lng[0] && lat <= BOUNDS.lng[1] && lng >= BOUNDS.lat[0] && lng <= BOUNDS.lat[1];
      return err(`outside Shanghai (${lng}, ${lat})${swapped ? ' — lng and lat look swapped' : ''}`);
    }

    const dayRaw = s(row.day);
    const day = dayRaw ? Number(dayRaw) : null;
    if (dayRaw && !(Number.isInteger(day) && day! > 0)) return err(`day must be a whole number ≥ 1, got "${dayRaw}"`);
    const time = s(row.time);
    const hhmm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (time && !hhmm) return err(`time must be HH:MM (24h), got "${time}"`);
    if (time && !day) issues.push({ level: 'warning', id, line, message: 'has a time but no day — time ignored' });
    if (!s(row.name_zh)) issues.push({ level: 'warning', id, line, message: 'missing name_zh (shown to taxi drivers)' });

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id,
        category,
        subtype: s(row.subtype),
        name_en: s(row.name_en),
        name_zh: s(row.name_zh),
        address_zh: s(row.address_zh),
        notes: s(row.notes),
        day,
        // Zero-padded so string order = time order.
        time: day && hhmm ? `${hhmm[1].padStart(2, '0')}:${hhmm[2]}` : '',
        tip: s(row.tip),
      },
    });
  };

  rows.forEach((row, i) => add(row, i + 2)); // +2: header is line 1

  // Temporary test pins so the map isn't empty before any real coordinates exist.
  // They disappear automatically as soon as one real row has coordinates.
  let usedTestRows = false;
  if (features.length === 0) {
    try {
      const testRows = parse(testCsvPath);
      const before = issues.length;
      testRows.forEach((row, i) => add(row, i + 2));
      issues.splice(before); // test rows are not the user's problem
      usedTestRows = testRows.length > 0;
    } catch {
      /* no test file: fine */
    }
  }

  const geojson = { type: 'FeatureCollection', crs_note: 'GCJ-02', features };
  if (write) {
    writeFileSync(OUT_GEOJSON, JSON.stringify(geojson, null, 1) + '\n');
    writeFileSync(OUT_UNPLACED, JSON.stringify(unplaced, null, 1) + '\n');
  }
  return { placed: features.length, unplaced, issues, usedTestRows, geojson };
}

export function report(r: BuildResult, log: (s: string) => void = console.log): void {
  const errors = r.issues.filter((i) => i.level === 'error');
  log(`\nplaces.csv → ${r.placed} on map, ${r.unplaced.length} not yet placed, ${errors.length} error(s)`);
  if (r.issues.length) {
    const w = Math.max(...r.issues.map((i) => i.id.length), 2);
    log(`  ${'level'.padEnd(7)} ${'line'.padStart(4)}  ${'id'.padEnd(w)}  problem`);
    for (const i of r.issues) {
      log(`  ${(i.level === 'error' ? 'ERROR' : 'warn').padEnd(7)} ${String(i.line).padStart(4)}  ${i.id.padEnd(w)}  ${i.message}`);
    }
  }
  if (r.unplaced.length) {
    log(`  Not yet placed (${r.unplaced.length}): ${r.unplaced.map((u) => u.id).join(', ')}`);
  }
  if (r.usedTestRows) log('  ⚠️  No real coordinates yet: showing TEST pins from data/test-places.csv. Do not deploy like this.');
  log('');
}

// CLI entry point
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes('--strict');
  try {
    const result = buildData();
    report(result);
    if (strict && result.issues.some((i) => i.level === 'error')) {
      console.error('build-data: fix the errors above in data/places.csv.');
      process.exit(1);
    }
  } catch (e) {
    console.error(`build-data: ${(e as Error).message}`);
    process.exit(strict ? 1 : 0);
  }
}

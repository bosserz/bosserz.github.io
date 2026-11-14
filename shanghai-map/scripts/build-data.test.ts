import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildData } from './build-data';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe('build-data validation', () => {
  const r = buildData({ csvPath: fixture('bad.csv'), testCsvPath: fixture('missing.csv'), write: false });
  const errorsFor = (id: string) => r.issues.filter((i) => i.level === 'error' && i.id === id).map((i) => i.message);

  it('keeps valid rows, including quoted commas and day', () => {
    expect(r.placed).toBe(1);
    const props = (r.geojson.features[0] as any).properties;
    expect(props.address_zh).toBe('上海市, 黄浦区');
    expect(props.day).toBe(2);
    expect(props.time).toBe('09:05');
    expect(props.tip).toBe('Reserve ahead');
    expect(r.geojson.crs_note).toBe('GCJ-02');
  });
  it('rejects duplicate ids', () => expect(errorsFor('ok-one')[0]).toMatch(/duplicate id/));
  it('detects swapped lng/lat', () => expect(errorsFor('swapped')[0]).toMatch(/swapped/));
  it('rejects coordinates outside Shanghai', () => expect(errorsFor('far')[0]).toMatch(/outside Shanghai/));
  it('rejects unknown categories', () => expect(errorsFor('weird-cat')[0]).toMatch(/unknown category/));
  it('rejects a non-numeric day', () => expect(errorsFor('bad-day')[0]).toMatch(/day/));
  it('rejects an invalid time', () => expect(errorsFor('bad-time')[0]).toMatch(/HH:MM/));
  it('lists rows without coordinates as unplaced, not errors', () => {
    expect(r.unplaced.map((u) => u.id)).toEqual(['no-coords']);
    expect(errorsFor('no-coords')).toEqual([]);
  });
});

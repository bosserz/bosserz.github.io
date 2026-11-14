import { describe, expect, it } from 'vitest';
import { searchPlaces } from './search';
import type { Place } from './places';

const mk = (id: string, name_en: string, name_zh: string) => ({ id, name_en, name_zh }) as Place;
const places = [
  mk('tao-tao-ju', 'Tao Tao Ju', '陶陶居'),
  mk('long-time-ago', 'Long Time Ago', '很久以前羊肉串'),
  mk('shanghai-tower', 'Shanghai Tower', '上海中心大厦'),
  mk('ops-cafe', 'OPS Café', 'OPS Cafe 太原路'),
];

describe('searchPlaces', () => {
  it('matches English prefixes and substrings', () => {
    expect(searchPlaces('tao', places).map((p) => p.id)).toEqual(['tao-tao-ju']);
    expect(searchPlaces('tower', places)[0].id).toBe('shanghai-tower');
  });
  it('matches Chinese names', () => {
    expect(searchPlaces('上海中心', places)[0].id).toBe('shanghai-tower');
  });
  it('ignores accents and allows tight typos-by-omission', () => {
    expect(searchPlaces('cafe', places)[0].id).toBe('ops-cafe');
    expect(searchPlaces('shtower', places)[0].id).toBe('shanghai-tower');
  });
  it('returns nothing for an empty query', () => {
    expect(searchPlaces('  ', places)).toEqual([]);
  });
});

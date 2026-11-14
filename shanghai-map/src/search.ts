import type { Place } from './places';

const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Score how well `query` matches `text`: higher is better, 0 = no match. */
function score(query: string, text: string): number {
  const q = norm(query);
  const t = norm(text);
  if (!q || !t) return 0;
  if (t.startsWith(q)) return 100 - t.length * 0.1;
  const i = t.indexOf(q);
  if (i >= 0) return 80 - i;
  // Subsequence match with a penalty for gaps ("sht" -> "shanghaitower").
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    gaps += found - ti;
    ti = found + 1;
  }
  // Only accept tight subsequences, otherwise short queries match almost everything.
  if (q.length < 3 || gaps > q.length * 2) return 0;
  return 50 - gaps * 2;
}

export function searchPlaces(query: string, places: Place[]): Place[] {
  if (!norm(query)) return [];
  return places
    .map((p) => ({ p, s: Math.max(score(query, p.name_en), score(query, p.name_zh), score(query, p.id)) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.p);
}

import type { LngLat } from './coords';

export type Category = 'food' | 'cafe' | 'sight';

export interface Place {
  id: string;
  name_en: string;
  name_zh: string;
  category: Category;
  subtype: string;
  address_zh: string;
  notes: string;
  day: number | null;
  /** "HH:MM" visiting time on `day`, or "" */
  time: string;
  /** Itinerary tip for that visit, or "" */
  tip: string;
  /** Per-device, from localStorage (not part of the data). */
  visited: boolean;
  /** GCJ-02 [lng, lat] */
  gcj: LngLat;
}

export const CATEGORY_LABEL: Record<Category, string> = { food: 'Food', cafe: 'Café', sight: 'Sights' };

const VISITED_KEY = 'shanghai-map:visited';

function readVisited(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(VISITED_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function saveVisited(place: Place): void {
  try {
    const all = readVisited();
    all[place.id] = place.visited;
    localStorage.setItem(VISITED_KEY, JSON.stringify(all));
  } catch {
    /* private mode / storage blocked: the toggle still works for this session */
  }
}

export interface Unplaced {
  id: string;
  name_en: string;
  name_zh: string;
}

export async function loadUnplaced(): Promise<Unplaced[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}unplaced.json`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function loadPlaces(): Promise<Place[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}places.geojson`);
  if (!res.ok) throw new Error(`places.geojson: HTTP ${res.status}`);
  const geo = await res.json();
  const visited = readVisited();
  return geo.features.map((f: any): Place => {
    const p = f.properties;
    return {
      ...p,
      notes: p.notes ?? '',
      address_zh: p.address_zh ?? '',
      time: p.time ?? '',
      tip: p.tip ?? '',
      visited: Boolean(visited[p.id]),
      gcj: f.geometry.coordinates as LngLat,
    };
  });
}

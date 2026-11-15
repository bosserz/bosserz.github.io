import L from './leaflet';
import 'leaflet.markercluster';
import { gcjForBase, type Base } from './coords';
import type { Category, Place } from './places';
import { dayInfo } from './trip';

// Simple 24px glyphs (stroke icons) for each category.
const GLYPH: Record<Category, string> = {
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-2 1.5-2 5-2 8h2v10"/>',
  cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  sight: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
};

export type Filter = 'all' | Category;

export interface MarkerState {
  filter: Filter;
  notVisited: boolean;
  /** null = all days (clustered category pins); N = that day's numbered stops + route. */
  day: number | null;
  base: Base;
  /** All-days view only: true = cluster nearby pins into groups; false = draw every pin. */
  grouped: boolean;
}

function pinClass(place: Place): string {
  return ['pin', `pin--${place.category}`, place.visited ? 'pin--visited' : ''].join(' ');
}

function icon(place: Place, shiftX = 0): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="${pinClass(place)}"><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[place.category]}</svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18 - shiftX, 18],
  });
}

/** Pixel offsets that fan out pins sharing the exact same coordinate (0, 30, 60, …). */
function spotShifts(places: Place[], step: number): Map<Place, number> {
  const seen = new Map<string, number>();
  const shifts = new Map<Place, number>();
  for (const p of places) {
    const key = p.gcj.join(',');
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    shifts.set(p, k * step);
  }
  return shifts;
}

function numberIcon(place: Place, n: number, shiftX: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="${pinClass(place)} pin--num">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15 - shiftX, 15],
  });
}

export function matchesFilter(place: Place, state: Pick<MarkerState, 'filter' | 'notVisited' | 'day'>): boolean {
  if (state.filter !== 'all' && place.category !== state.filter) return false;
  if (state.notVisited && place.visited) return false;
  if (state.day !== null && place.day !== state.day) return false;
  return true;
}

/** A day's stops in visiting order (by time, then CSV order). */
export function dayStops(places: Place[], day: number): Place[] {
  return places
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.day === day)
    .sort((a, b) => (a.p.time || '99:99').localeCompare(b.p.time || '99:99') || a.i - b.i)
    .map(({ p }) => p);
}

export class PlaceMarkers {
  readonly cluster: L.MarkerClusterGroup;
  /** Unclustered markers: day-mode stops, or every pin when grouping is off. */
  private dayLayer = L.layerGroup();
  private markers = new Map<string, L.Marker>();
  private route: L.Polyline | null = null;

  constructor(private places: Place[], private onSelect: (p: Place) => void) {
    this.cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      // Keep clustering at every zoom (tight radius when zoomed in) so places that share
      // a building/coordinate stay tappable: tapping such a cluster fans the pins out.
      maxClusterRadius: (zoom: number) => (zoom >= 16 ? 16 : 40),
      spiderfyOnMaxZoom: true,
    });
    for (const p of places) {
      const m = L.marker([p.gcj[1], p.gcj[0]], { icon: icon(p), title: p.name_en, keyboard: true });
      m.on('click', () => onSelect(p));
      this.markers.set(p.id, m);
    }
  }

  addTo(map: L.Map): this {
    this.cluster.addTo(map);
    this.dayLayer.addTo(map);
    return this;
  }

  /** Re-place and re-filter all markers (call after basemap, filter or day changes). */
  render(state: MarkerState): void {
    const at = (p: Place): L.LatLngTuple => {
      const [lng, lat] = gcjForBase(p.gcj, state.base);
      return [lat, lng];
    };
    this.cluster.clearLayers();
    this.dayLayer.clearLayers();
    this.route = null;

    if (state.day === null) {
      const shown = this.places.filter((p) => matchesFilter(p, state));
      // Ungrouped: pins at the identical spot are fanned out sideways so each stays tappable.
      const shifts = state.grouped ? null : spotShifts(shown, 30);
      const visible: L.Marker[] = [];
      for (const p of shown) {
        const m = this.markers.get(p.id)!;
        m.setIcon(icon(p, shifts?.get(p) ?? 0));
        m.setLatLng(at(p));
        visible.push(m);
      }
      if (state.grouped) this.cluster.addLayers(visible);
      else for (const m of visible) m.addTo(this.dayLayer);
      return;
    }

    // Day mode: numbered stops in order, joined by a dashed route.
    const stops = dayStops(this.places, state.day);
    const info = dayInfo(state.day);
    if (stops.length > 1) {
      this.route = L.polyline(stops.map(at), {
        color: info?.color ?? '#333',
        weight: 4,
        opacity: 0.85,
        dashArray: '2 9',
        lineCap: 'round',
        interactive: false,
      }).addTo(this.dayLayer);
    }
    // Stops at the identical spot are fanned out sideways so each number is tappable.
    const shifts = spotShifts(stops.filter((p) => matchesFilter(p, state)), 26);
    stops.forEach((p, i) => {
      if (!matchesFilter(p, state)) return;
      const m = L.marker(at(p), {
        icon: numberIcon(p, i + 1, shifts.get(p)!),
        title: `${i + 1}. ${p.name_en}`,
        keyboard: true,
        zIndexOffset: (stops.length - i) * 1000, // earlier stops on top when pins overlap
      });
      m.on('click', () => this.onSelect(p));
      m.addTo(this.dayLayer);
    });
  }

  /** Bounds of the current day's route, for fitting the view. */
  dayBounds(): L.LatLngBounds | null {
    return this.route ? this.route.getBounds() : null;
  }
}

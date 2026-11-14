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
}

function pinClass(place: Place): string {
  return ['pin', `pin--${place.category}`, place.visited ? 'pin--visited' : ''].join(' ');
}

function icon(place: Place): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="${pinClass(place)}"><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[place.category]}</svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
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
      const visible: L.Marker[] = [];
      for (const p of this.places) {
        const m = this.markers.get(p.id)!;
        m.setIcon(icon(p));
        m.setLatLng(at(p));
        if (matchesFilter(p, state)) visible.push(m);
      }
      this.cluster.addLayers(visible);
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
    const sameSpot = new Map<string, number>();
    stops.forEach((p, i) => {
      if (!matchesFilter(p, state)) return;
      const key = p.gcj.join(',');
      const k = sameSpot.get(key) ?? 0;
      sameSpot.set(key, k + 1);
      const m = L.marker(at(p), {
        icon: numberIcon(p, i + 1, k * 26),
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

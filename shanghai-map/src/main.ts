import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './style.css';
import L from './leaflet';
import { registerSW } from 'virtual:pwa-register';
import { convertBetweenBases, distanceM, formatDistance, gcjForBase, wgsForBase, wgsToGcj, type Base, type LngLat } from './coords';
import { dayStops, matchesFilter, PlaceMarkers, type Filter, type MarkerState } from './markers';
import { CATEGORY_LABEL, loadPlaces, loadUnplaced, saveVisited, type Category, type Place } from './places';
import { searchPlaces } from './search';
import { Sheet } from './sheet';
import { DAYS, dateLabel, dayInfo, todayTripDay } from './trip';

registerSW({ immediate: true });

const SHANGHAI_GCJ: LngLat = [121.4800, 31.2300];
const BASE_KEY = 'shanghai-map:base';
const DAY_KEY = 'shanghai-map:day';
const GROUP_KEY = 'shanghai-map:grouped';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout((el as any)._t);
  (el as any)._t = setTimeout(() => (el.hidden = true), 3500);
}

// ---------- Map & basemaps ----------

const tiles: Record<Base, L.TileLayer> = {
  // Unofficial AMap endpoint, GCJ-02, English labels. Places are drawn as-is on it.
  amap: L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=en&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: '1234',
    maxNativeZoom: 18,
    maxZoom: 19,
    attribution: '&copy; AutoNavi',
  }),
  // WGS-84 fallback. Places are converted GCJ-02 -> WGS-84 for this layer.
  // (CARTO Voyager now needs an API key, so the standard OSM tiles are used.)
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19,
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }),
};

let savedBase: Base = 'amap';
try {
  if (localStorage.getItem(BASE_KEY) === 'osm') savedBase = 'osm';
} catch { /* ignore */ }

let savedGrouped = true;
try {
  if (localStorage.getItem(GROUP_KEY) === '0') savedGrouped = false;
} catch { /* ignore */ }
const state: MarkerState & { query: string } = { filter: 'all', notVisited: false, day: null, base: savedBase, grouped: savedGrouped, query: '' };
let userWgs: LngLat | null = null;

const start = gcjForBase(SHANGHAI_GCJ, state.base);
const map = L.map('map', { zoomControl: false, center: [start[1], start[0]], zoom: 13, attributionControl: true });
L.control.zoom({ position: 'bottomleft' }).addTo(map);
tiles[state.base].addTo(map);

// Auto-fallback: if AMap tiles keep failing before any loads, switch to OSM once.
let amapLoaded = false;
let amapErrors = 0;
tiles.amap.on('tileload', () => (amapLoaded = true));
tiles.amap.on('tileerror', () => {
  if (amapLoaded || state.base !== 'amap' || ++amapErrors < 6) return;
  setBase('osm');
  toast('AMap tiles unavailable — switched to OpenStreetMap');
});

const userMarker = L.circleMarker([0, 0], {
  radius: 8, weight: 3, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, interactive: false,
});

function setBase(next: Base): void {
  if (next === state.base) return;
  const c = map.getCenter();
  const [lng, lat] = convertBetweenBases([c.lng, c.lat], state.base, next);
  map.removeLayer(tiles[state.base]);
  tiles[next].addTo(map);
  state.base = next;
  map.setView([lat, lng], map.getZoom(), { animate: false });
  markers?.render(state);
  drawUser();
  $('btn-layer').textContent = next === 'amap' ? 'AMap' : 'OSM';
  $('btn-layer').setAttribute('aria-label', `Basemap: ${next === 'amap' ? 'AMap' : 'OpenStreetMap'}. Tap to switch.`);
  try { localStorage.setItem(BASE_KEY, next); } catch { /* ignore */ }
}

// ---------- Places ----------

let places: Place[] = [];
let markers: PlaceMarkers | undefined;
const sheet = new Sheet((p) => {
  saveVisited(p);
  markers?.render(state);
  renderList();
});

function distanceTo(p: Place): number | null {
  return userWgs ? distanceM(wgsToGcj(userWgs), p.gcj) : null;
}

function select(p: Place): void {
  closeList();
  closeResults();
  // Viewing another day? Switch to the place's day (or all days) so its pin is on the map.
  if (state.day !== null && p.day !== state.day) setDay(p.day, { fit: false });
  const d = distanceTo(p);
  const [lng, lat] = gcjForBase(p.gcj, state.base);
  // Open the sheet, then pan so the pin sits centred in the map area above it.
  const open = () => {
    sheet.open(p, d === null ? undefined : formatDistance(d));
    const sheetH = $('sheet').offsetHeight;
    const headerH = document.querySelector<HTMLElement>('.top')!.offsetHeight;
    const pt = map.latLngToContainerPoint([lat, lng]);
    // Centre of the strip of map still visible between the header and the sheet.
    const target = L.point(map.getSize().x / 2, Math.max(headerH + 30, (headerH + map.getSize().y - sheetH) / 2));
    map.panBy(pt.subtract(target), { animate: true });
  };
  map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: false });
  open();
}

map.on('click', () => sheet.close());

// ---------- Filters ----------

document.querySelectorAll<HTMLButtonElement>('.chip[data-filter]').forEach((chip) =>
  chip.addEventListener('click', () => {
    state.filter = chip.dataset.filter as Filter;
    document.querySelectorAll('.chip[data-filter]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    markers?.render(state);
    renderList();
  }),
);
$('chip-notvisited').addEventListener('click', (e) => {
  state.notVisited = !state.notVisited;
  (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(state.notVisited));
  markers?.render(state);
  renderList();
});

// ---------- Search ----------

const searchInput = $<HTMLInputElement>('search');
const results = $('results');

function closeResults(): void {
  results.hidden = true;
}

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  $('search-clear').hidden = !state.query;
  const hits = searchPlaces(state.query, places).slice(0, 8);
  results.innerHTML = hits.length
    ? hits.map((p) => `<li><button type="button" data-id="${p.id}"><span>${esc(p.name_en)}</span><span lang="zh-CN">${esc(p.name_zh)}</span></button></li>`).join('')
    : state.query ? '<li class="results__empty">No matches</li>' : '';
  results.hidden = !state.query;
  renderList();
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = searchPlaces(state.query, places)[0];
    if (first) { searchInput.blur(); select(first); }
  }
});
results.addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest('button')?.dataset.id;
  const p = places.find((x) => x.id === id);
  if (p) { searchInput.blur(); select(p); }
});
$('search-clear').addEventListener('click', () => {
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.focus();
});
map.on('movestart', closeResults);

// ---------- Locate me ----------

function drawUser(): void {
  if (!userWgs) return;
  const [lng, lat] = wgsForBase(userWgs, state.base); // GPS is WGS-84; AMap tiles need GCJ-02.
  userMarker.setLatLng([lat, lng]);
  if (!map.hasLayer(userMarker)) userMarker.addTo(map);
}

let watching = false;
$('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) return toast('Location is not available on this device');
  if (userWgs) {
    const [lng, lat] = wgsForBase(userWgs, state.base);
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }
  if (watching) return;
  watching = true;
  $('btn-locate').classList.add('fab--busy');
  let first = !userWgs;
  navigator.geolocation.watchPosition(
    (pos) => {
      userWgs = [pos.coords.longitude, pos.coords.latitude];
      $('btn-locate').classList.remove('fab--busy');
      $('btn-locate').classList.add('fab--on');
      drawUser();
      if (first) {
        first = false;
        const [lng, lat] = wgsForBase(userWgs, state.base);
        map.setView([lat, lng], Math.max(map.getZoom(), 16));
      }
      renderList();
    },
    (err) => {
      watching = false;
      $('btn-locate').classList.remove('fab--busy');
      toast(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location');
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
  );
});

// ---------- List view ----------

const listEl = $('list');

function distanceLabel(p: Place): string {
  const d = distanceTo(p);
  return p.visited ? '✓' : d !== null ? formatDistance(d) : '';
}

/** Day mode: the day's stops in order, numbered like the pins. */
function renderTimeline(day: number): void {
  const info = dayInfo(day)!;
  const query = state.query ? new Set(searchPlaces(state.query, places)) : null;
  const rows = dayStops(places, day)
    .map((p, i) => ({ p, n: i + 1 }))
    .filter(({ p }) => matchesFilter(p, state) && (!query || query.has(p)));
  $('list-hint').textContent = '';
  $('list-body').innerHTML = `
    <header class="dayhead" style="--day:${info.color}">
      <p class="dayhead__date">Day ${day} · ${dateLabel(day)}</p>
      <h2>${esc(info.title)}</h2>
      <p class="dayhead__base">Base: ${esc(info.base)}</p>
    </header>
    ${rows.length ? `<ol class="timeline" style="--day:${info.color}">${rows
      .map(({ p, n }) => `<li><button type="button" data-id="${p.id}" class="row row--stop${p.visited ? ' row--visited' : ''}">
          <span class="stop stop--${p.category}">${n}</span>
          <span class="row__text">
            <span class="row__time">${p.time || ''}</span>
            <span class="row__en">${esc(p.name_en)}</span>
            <span class="row__zh" lang="zh-CN">${esc(p.name_zh)}</span>
            ${p.tip ? `<span class="row__tip">${esc(p.tip)}</span>` : ''}
          </span>
          <span class="row__dist">${distanceLabel(p)}</span>
        </button></li>`)
      .join('')}</ol>` : '<p class="list__empty">Nothing matches these filters.</p>'}`;
}

function renderList(): void {
  if (listEl.hidden) return;
  if (state.day !== null) return renderTimeline(state.day);
  const pool = state.query ? searchPlaces(state.query, places) : places;
  const visible = pool.filter((p) => matchesFilter(p, state));
  const groups: Category[] = ['food', 'cafe', 'sight'];
  const html = groups
    .map((cat) => {
      const items = visible
        .filter((p) => p.category === cat)
        .map((p) => ({ p, d: distanceTo(p) }))
        .sort((a, b) => (a.d !== null && b.d !== null ? a.d - b.d : a.p.name_en.localeCompare(b.p.name_en)));
      if (!items.length) return '';
      return `<section><h2>${CATEGORY_LABEL[cat]} <span>${items.length}</span></h2><ul>${items
        .map(({ p, d }) => `<li><button type="button" data-id="${p.id}" class="row${p.visited ? ' row--visited' : ''}">
            <span class="dot dot--${p.category}"></span>
            <span class="row__text"><span class="row__en">${esc(p.name_en)}</span><span class="row__zh" lang="zh-CN">${esc(p.name_zh)}</span></span>
            <span class="row__dist">${distanceLabel(p)}</span>
          </button></li>`)
        .join('')}</ul></section>`;
    })
    .join('');
  $('list-body').innerHTML = html || '<p class="list__empty">Nothing matches these filters.</p>';
  $('list-hint').textContent = userWgs ? 'Sorted by distance from you' : 'Tap ◎ to sort by distance';
}

function openList(): void {
  sheet.close();
  listEl.hidden = false;
  listEl.style.paddingTop = `${document.querySelector<HTMLElement>('.top')!.offsetHeight + 8}px`;
  syncListButtons();
  renderList();
}

function closeList(): void {
  listEl.hidden = true;
  syncListButtons();
}

/** Both the list FAB and the day banner toggle the list; keep their labels in step. */
function syncListButtons(): void {
  const open = !listEl.hidden;
  $('btn-list').setAttribute('aria-pressed', String(open));
  $('daybanner').setAttribute('aria-expanded', String(open));
  $('daybanner-cta').textContent = open ? 'Map ✕' : 'Timeline ›';
}

$('list-close').addEventListener('click', closeList);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !listEl.hidden) closeList();
});

$('btn-list').addEventListener('click', () => {
  if (!listEl.hidden) return closeList();
  openList();
});

// ---------- Itinerary days ----------

const dayChips = $('days');
dayChips.innerHTML = [
  `<button class="chip chip--day" type="button" data-day="" aria-pressed="true">All days</button>`,
  ...DAYS.map((d) => `<button class="chip chip--day" type="button" data-day="${d.day}" aria-pressed="false" style="--day:${d.color}">
      <b>Day ${d.day}</b> ${dateLabel(d.day)}</button>`),
].join('');

function setDay(day: number | null, { fit = true } = {}): void {
  state.day = day;
  dayChips.querySelectorAll<HTMLElement>('[data-day]').forEach((c) => {
    const on = c.dataset.day === String(day ?? '');
    c.setAttribute('aria-pressed', String(on));
    if (on) dayChips.scrollTo({ left: c.offsetLeft - 12, behavior: 'smooth' });
  });
  try { localStorage.setItem(DAY_KEY, day === null ? '' : String(day)); } catch { /* ignore */ }

  const info = dayInfo(day);
  const banner = $('daybanner');
  banner.hidden = !info;
  // Every scheduled stop is placed, so the notice is noise while viewing a day.
  document.body.classList.toggle('day-mode', day !== null);
  if (info && day !== null) {
    const n = places.filter((p) => p.day === day).length;
    banner.style.setProperty('--day', info.color);
    $('daybanner-title').textContent = `${dateLabel(day)} · ${info.title}`;
    $('daybanner-meta').textContent = `${n} stops`;
  }

  markers?.render(state);
  if (listEl.hidden === false) {
    listEl.style.paddingTop = `${document.querySelector<HTMLElement>('.top')!.offsetHeight + 8}px`;
    renderList();
  }
  const bounds = markers?.dayBounds();
  if (fit && bounds) {
    const top = document.querySelector<HTMLElement>('.top')!.offsetHeight + 16;
    map.fitBounds(bounds, { paddingTopLeft: [24, top], paddingBottomRight: [72, 40], maxZoom: 16 });
  }
}

dayChips.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-day]');
  if (!chip) return;
  sheet.close();
  setDay(chip.dataset.day ? Number(chip.dataset.day) : null);
});
$('daybanner').addEventListener('click', () => (listEl.hidden ? openList() : closeList()));
$('list-body').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest('button')?.dataset.id;
  const p = places.find((x) => x.id === id);
  if (p) select(p);
});

$('btn-layer').addEventListener('click', () => setBase(state.base === 'amap' ? 'osm' : 'amap'));

// ---------- Group / individual pins ----------

function syncGroupButton(): void {
  const btn = $('btn-group');
  btn.setAttribute('aria-pressed', String(!state.grouped));
  btn.setAttribute('aria-label', state.grouped ? 'Pins are grouped. Tap to show every pin.' : 'Showing every pin. Tap to group nearby pins.');
  btn.title = state.grouped ? 'Show pins individually' : 'Group nearby pins';
}
function setGrouped(grouped: boolean): void {
  state.grouped = grouped;
  syncGroupButton();
  markers?.render(state);
  try { localStorage.setItem(GROUP_KEY, grouped ? '1' : '0'); } catch { /* ignore */ }
  toast(grouped ? 'Nearby pins grouped' : 'Showing every pin');
}
$('btn-group').addEventListener('click', () => setGrouped(!state.grouped));
syncGroupButton();

// ---------- Not-yet-placed notice ----------

loadUnplaced().then((unplaced) => {
  if (!unplaced.length) return;
  const n = unplaced.length;
  $('unplaced-toggle').textContent = `${n} place${n === 1 ? '' : 's'} not on map yet`;
  $('unplaced-list').innerHTML = unplaced
    .map((u) => `<li>${esc(u.name_en)} <span lang="zh-CN">${esc(u.name_zh)}</span></li>`)
    .join('');
  $('unplaced').hidden = false;
});
$('unplaced-toggle').addEventListener('click', () => {
  const list = $('unplaced-list');
  list.hidden = !list.hidden;
  $('unplaced-toggle').setAttribute('aria-expanded', String(!list.hidden));
});

// ---------- Boot ----------

loadPlaces()
  .then((loaded) => {
    places = loaded;
    markers = new PlaceMarkers(places, select).addTo(map);
    $('btn-layer').textContent = state.base === 'amap' ? 'AMap' : 'OSM';
    // During the trip, open on today's day; otherwise on the last day viewed.
    let saved: number | null = null;
    try { saved = Number(localStorage.getItem(DAY_KEY)) || null; } catch { /* ignore */ }
    const startDay = todayTripDay() ?? (dayInfo(saved) ? saved : null);
    if (startDay !== null) setDay(startDay);
    else markers.render(state);
  })
  .catch((err) => {
    console.error(err);
    toast('Could not load places. Check your connection and reload.');
  });

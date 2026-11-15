# Shanghai Trip Map

A mobile-first map of the places to visit in Shanghai. It uses AMap (Gaode) tiles with English labels, so pins have no China coordinate offset, and it can open Amap for directions with one tap. **No API keys are needed.** Built from `../SHANGHAI_MAP_SPEC.md`.

- **Stack:** Vite and vanilla TypeScript, Leaflet, Leaflet.markercluster, gcoord, papaparse, vite-plugin-pwa
- **Bundle:** about 62 KB of JS gzipped (the budget is 200 KB)

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (rebuilds the data first)
npm test           # coordinate, search and data-validation tests
npm run build      # validates the data strictly, type-checks, builds dist/
npm run preview    # serve dist/ with the service worker active
npm run data       # just regenerate public/places.geojson from the CSV
```

## Adding or editing a place

Edit **`data/places.csv`**. It is the only file you edit by hand; `public/places.geojson` and `public/unplaced.json` are generated from it.

```
id,category,subtype,name_en,name_zh,lng,lat,address_zh,notes,day,time,tip
the-bund,sight,area,The Bund,外滩,121.490317,31.239703,,,1,14:00,Best skyline photos from the promenade
```

| Column | Rules |
|---|---|
| `id` | Unique, kebab-case |
| `category` | `food`, `cafe` or `sight` |
| `name_zh` | Shown large in the app for taxi drivers; use the official name |
| `lng`, `lat` | **GCJ-02** from AMap (see below). Leave empty if you don't have them yet |
| `address_zh`, `notes` | Optional |
| `day`, `time`, `tip` | Itinerary (optional): trip day (1–4), visiting time `HH:MM`, and a tip shown on the place card |

Quote any field that contains a comma: `"上海市, 黄浦区"`.

While `npm run dev` is running, saving the CSV rebuilds the data and reloads the page. Problems are printed in the terminal, and a bad CSV never stops the dev server:

| Problem | Effect |
|---|---|
| No `lng`/`lat` yet | Left off the map and listed in the "N places not on map yet" notice |
| Duplicate `id`, unknown `category`, bad `day` | **Error**: that row is skipped |
| Outside Shanghai (lng 120.8–122.2, lat 30.6–31.9) | **Error**; also tells you if lng and lat look swapped |

`npm run build` **fails** on any error, so a broken CSV can't be deployed.

## Itinerary (Day 1–4 = Fri 1 – Mon 4 Jan 2027)

The plan from `../SHANGHAI_ITINERARY.md` lives in the `day`, `time` and `tip` columns of `data/places.csv`.

- **In the app:** the day chips under the filters (`All days`, `Day 1 · Fri 1 Jan`, …) switch to that day's view. Stops are numbered in visiting order (sorted by `time`) and joined by a dashed route. The banner's **Timeline** button opens the day as an ordered list with times and tips.
- **During the trip,** the app opens on today's day automatically; otherwise it opens on the last day you viewed.
- **To change the plan,** edit `day` and `time` in the CSV. Stops with the same time keep their CSV order.
- **To move the dates or rename a day,** edit `TRIP_START` and `DAYS` in `src/trip.ts`.
- **Not on the map:** "Pudong riverside promenade" (Day 2, ~19:00) isn't a place in the CSV, so it's mentioned in Shanghai Tower's tip instead. Malkonig is unscheduled until it has coordinates.

## Getting coordinates (GCJ-02)

1. Open **https://lbs.amap.com/tools/picker** (no login needed).
2. Search the Chinese name, then click the correct pin or branch.
3. Copy the `lng,lat` it shows into the row's `lng` and `lat` columns. It is already GCJ-02.
4. Optionally copy the address into `address_zh`.

You can also share a place from the Amap phone app: the share link contains its coordinates.

**Don't** take coordinates from Google Maps, from Apple Maps outside China, or from OpenStreetMap. Those are WGS-84 and will be 300–500 m off.

## Test pins

Until at least one row in `places.csv` has coordinates, the map shows 3 pins from `data/test-places.csv`, named "TEST …", at approximate locations. They disappear by themselves as soon as you add your first real coordinate, and the build prints a warning while they are in use. Delete `data/test-places.csv` whenever you like.

## Coordinates in the app

| Thing | System | Handling |
|---|---|---|
| CSV, GeoJSON, AMap tiles | GCJ-02 | Drawn as-is |
| OSM fallback tiles | WGS-84 | Pins are converted GCJ-02 → WGS-84 at render time |
| Browser GPS ("locate me") | WGS-84 | Converted to GCJ-02 before it is drawn on AMap tiles |
| Amap deep link | GCJ-02 | `coordinate=gaode` |
| Apple Maps link | WGS-84 | Searches by Chinese name, so `ll` only biases the search (see below) |

If AMap tiles fail to load six times before any tile succeeds, the app switches to OSM by itself. CARTO Voyager now requires an API key, so the fallback uses standard `tile.openstreetmap.org` tiles.

**Grouped vs individual pins:** in the All-days view, the round button above the list button (four dots) switches between grouping nearby pins into numbered clusters (default) and drawing every pin on its own. In individual mode, pins at exactly the same spot are fanned out side by side so each can be tapped. The choice is remembered on the device. The button is hidden in a day view, which always shows each stop.

"Mark visited" is saved per device in localStorage and is not part of the data.

## Deploy (Cloudflare Pages)

Use Cloudflare Pages: GitHub Pages and Vercel are often blocked in mainland China.

**Git integration:** create a Pages project from this repo with:
- Root directory: `shanghai-map`
- Build command: `npm run build`
- Output directory: `dist`

**Or a direct upload:**

```bash
npm run build
npx wrangler pages deploy dist --project-name shanghai-map
```

**Before the trip:**
1. Make sure the build no longer prints the TEST-pins warning or a "not yet placed" list.
2. Test the deployed URL from a China connection and confirm AMap tiles load.
3. Open the site once on the phone and pan around your neighbourhoods so those tiles get cached for offline use. Then "Add to Home Screen".

## Still to verify

- [ ] Every row has coordinates, and the "not on map yet" notice is gone.
- [ ] Spot-check: The Bund, Yuyuan Garden and Shanghai Tower sit on their buildings on AMap, and still line up after switching to OSM.
- [ ] "Navigate in Amap" opens the Amap app on iPhone.
- [ ] Apple Maps: the link sends WGS-84 `ll`. If the pin lands about 500 m off, switch `appleMapsUrl()` in `src/sheet.ts` to GCJ-02 and update the comment there.
- [ ] Lighthouse mobile performance ≥ 90 on the deployed URL.

Already verified: offline reload (app shell, data and viewed tiles); the basemap switch keeps pins on the same streets; the coordinate conversion unit tests.

## Layout

```
data/places.csv          you edit this
data/test-places.csv     temporary pins (used only while nothing is placed)
scripts/build-data.ts    CSV → GeoJSON + validation (+ build-data.test.ts, fixtures/)
public/places.geojson    generated
public/unplaced.json     generated
src/coords.ts            gcoord helpers (+ coords.test.ts)
src/markers.ts           icons, clustering, filters
src/sheet.ts             bottom sheet + Amap / Apple Maps deep links
src/search.ts            fuzzy search (+ search.test.ts)
src/places.ts            data loading, visited storage
src/main.ts              map, basemaps, locate me, list/timeline, day selector, unplaced notice
src/trip.ts              trip dates + day titles (+ trip.test.ts)
```

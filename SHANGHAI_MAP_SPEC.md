# Shanghai Trip Map — Build Spec

A mobile-first web map of the restaurants, cafés and sights I want to visit in Shanghai. It should open fast on my phone, show accurate pins (no China coordinate offset), and launch Amap for directions with one tap.

**No API keys needed.** I enter the coordinates by hand in `data/places.csv`; the app does everything else.

> **For Claude Code:** read this file top to bottom, then build the project in the order given in "Build steps". Ask me before you change the stack.

---

## 1. Why this exists (constraints)

- Google Maps pins in China sit 300–500 m from the real spot because of the **GCJ-02 vs WGS-84** coordinate offset, and its business data in China is sparse.
- AMap (Gaode) has accurate data, but its app is hard for me to search and read (Chinese UI).
- So: **use AMap's tiles and coordinates, with my own simple English UI on top.**

### Coordinate rule (most important)
- All coordinates in `places.csv` are **GCJ-02**, copied from the AMap coordinate picker (Section 5).
- AMap tiles are GCJ-02 → draw pins **as-is** on them.
- If the OSM fallback layer is active (WGS-84), convert pins with `gcoord.transform(coord, gcoord.GCJ02, gcoord.WGS84)` at render time.
- Never mix systems in one layer. Write a small unit test that checks the conversion (e.g. a point near The Bund moves roughly 0.005° in lng when converted).

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Build | **Vite** + vanilla TypeScript | No framework needed; keep it small |
| Map | **Leaflet** | Simple, works well with raster tiles |
| Basemap (default) | AMap raster tiles, English labels | `https://webrd0{s}.is.autonavi.com/appmaptile?lang=en&size=1&scale=1&style=8&x={x}&y={y}&z={z}`, subdomains `1-4`. No key needed. Unofficial endpoint → must have fallback |
| Basemap (fallback) | OpenStreetMap / CARTO Voyager | WGS-84 → convert pins with gcoord |
| Coord conversion | **gcoord** (npm) | |
| Clustering | **Leaflet.markercluster** | |
| Data source | `data/places.csv` | Hand-edited by me |
| Data build | `scripts/build-data.ts` (Node, runs before `vite build` and on `vite dev`) | CSV → `public/places.geojson`, with validation |
| Offline | **vite-plugin-pwa** | Cache app shell, GeoJSON and visited tiles |
| Hosting | Cloudflare Pages | Test from China before trip; GitHub Pages/Vercel are often blocked |

---

## 3. Places

`places.csv` (provided alongside this spec) already contains every place below with empty `lng`/`lat` columns for me to fill in. `zh_query` is what I type into the AMap picker. Rows marked ⚠️ are unconfirmed — I'll check them when I pick coordinates.

### 3a. Food (restaurants)

| id | name_en | zh_query | branch_hint / notes |
|---|---|---|---|
| xie-san-bao | Xie San Bao | 蟹叁寳 | Crab roe noodles / crab XLB |
| long-time-ago | Long Time Ago | 很久以前羊肉串 | Lamb skewers BBQ chain; prefer Nanjing East Rd / First Department Store branch |
| lai-lai-xiaolong | Lai Lai Xiaolong | 莱莱小笼 | Soup dumplings |
| yangs-dumpling | Yang's Dumpling | 小杨生煎 | Pan-fried buns, chain — pick branch on my route |
| fei-da-chu | Fei Da Chu | 费大厨辣椒炒肉 | ⚠️ Hunan chain (assumed); chain — pick branch on my route |
| tao-tao-ju | Tao Tao Ju | 陶陶居 | Cantonese dim sum; prefer New World (Nanjing East) branch |
| ding-te-le-zhou | Ding Te Le Zhou | 鼎特勒粥 | ⚠️ Congee; verify name |
| ren-he-guan | Ren He Guan | 人和馆 | Shanghainese |
| new-sukiyaki | New Sukiyaki | 牛New寿喜烧 | Prefer Nanjing East Rd (Mosaic) branch |
| weixiangzhai | Weixiangzhai | 味香斋 | Sesame paste noodles |
| canton-8 | Canton 8 | 喜粤8号 | Cantonese, Michelin |

### 3b. Cafés, bakeries & drinks

| id | name_en | zh_query | branch_hint / notes |
|---|---|---|---|
| heytea | Hey Tea | 喜茶 | Chain — any branch on my route |
| metal-hands | Metal Hands | 铁手咖啡 | Prefer Huaihai Rd branch |
| ops-cafe | OPS Café | OPS Cafe 太原路 | 177 Taiyuan Rd, Xuhui |
| malkonig | Malkonig | Mahlkönig 咖啡 | ⚠️ Unclear which venue — I'll confirm |
| matcha-wang | Matcha Wang | Matcha Wang HAI550 | L1, HAI550, 550 Middle Huaihai Rd |
| 13-de-marzo | 13 de Marzo | 13DE MARZO 安福路 | Flagship: 322 Anfu Rd (teddy bear café) |
| amam | AMAM LonBakery Town | AMAM 吴江路 | Corner of Wujiang Rd & Maoming Rd |
| butterful-xintiandi | Butterful & Creamorous (Xintiandi) | Butterful & Creamorous 新天地 | Xintiandi branch |
| butterful-wujiang | Butterful & Creamorous (Wujiang Rd) | Butterful & Creamorous 吴江路 | 289–291 Wujiang Rd |
| apoli | Apoli Itabakery | Apoli 兴国路 | 380 Xingguo Rd, Changning |

### 3c. Sights

| id | name_en | zh_query | subtype | notes |
|---|---|---|---|---|
| the-bund | The Bund | 外滩 | area | |
| north-bund | North Bund | 北外滩 | area | |
| rockbund | Rockbund | 外滩源 | area | |
| zhapu-rd-bridge | Zhapu Road Bridge | 乍浦路桥 | point | Night photo spot |
| gate-m | Gate M | 西岸梦中心 | point | ⚠️ Verify it's West Bund Dream Center |
| lujiazui | Lujiazui | 陆家嘴 | area | |
| zhongshuge | Zhongshuge Bookstore | 钟书阁 | point | ⚠️ Several branches — I'll pick one |
| shanghai-tower | Shanghai Tower | 上海中心大厦 | point | |
| anfu-road | Anfu Road | 安福路 | street | |
| huaihai-road | Huaihai Road | 淮海中路 | street | |
| xintiandi | Xintiandi | 新天地 | area | |
| yuyuan-garden | Yuyuan Garden | 豫园 | point | |

---

## 4. Data

### `data/places.csv` (source of truth, I edit this)

Columns:

```
id,category,subtype,name_en,name_zh,lng,lat,address_zh,notes,day
```

- `category`: `food` | `cafe` | `sight`
- `name_zh`: the Chinese name to show taxi drivers (pre-filled from `zh_query`; I'll correct it to the official name if needed)
- `lng`, `lat`: **GCJ-02**, decimal degrees, e.g. `121.490317,31.239703`
- `address_zh`, `notes`, `day`: optional
- UTF-8, header row required. Commas inside fields must be quoted.

### `public/places.geojson` (generated, don't edit)

```json
{
  "type": "FeatureCollection",
  "crs_note": "GCJ-02",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [121.4903, 31.2397] },
    "properties": {
      "id": "the-bund",
      "category": "sight",
      "subtype": "area",
      "name_en": "The Bund",
      "name_zh": "外滩",
      "address_zh": "",
      "notes": "",
      "day": null
    }
  }]
}
```

Coordinates in the sample are placeholders, not real data. `visited` is **not** in the data — it's stored per-device in localStorage.

---

## 5. Getting coordinates (manual, no API)

For each row in `places.csv`:
1. Open **https://lbs.amap.com/tools/picker** (AMap coordinate picker; no login needed).
2. Search the `zh_query` text, click the correct pin/branch.
3. Copy the `lng,lat` it shows (already GCJ-02) into the row.
4. Optionally copy the address into `address_zh`.

Alternative: share a place from the Amap phone app — the share link contains its coordinates.

**Don't** use coordinates from Google Maps, Apple Maps outside China, or OpenStreetMap — they're WGS-84 and will be offset.

---

## 6. Data build script (`scripts/build-data.ts`)

- Parse `data/places.csv` (use `papaparse`), write `public/places.geojson`.
- Run automatically via `predev` and `prebuild` npm scripts.
- **Validation** (print a clear table, don't crash the dev server):
  - Duplicate `id` → error, fail the build.
  - Missing `lng`/`lat` → warning; skip the row from the map but list it as "not yet placed".
  - Coordinates outside Shanghai bounds (lng 120.8–122.2, lat 30.6–31.9) → error (catches swapped lat/lng).
  - Unknown `category` → error.
- Also write `public/unplaced.json` listing rows without coordinates, so the app can show a small "3 places not on map yet" notice.

---

## 7. App features

**Must have**
1. Full-screen map centred on Shanghai, AMap English tiles, layer switcher to OSM fallback.
2. Pins coloured by category (food / café / sight) with simple icons; clustering at low zoom.
3. Filter chips at top: All · Food · Café · Sights · Not visited.
4. Search box: fuzzy match on `name_en` and `name_zh`.
5. Tap pin → bottom sheet with: English name, **large Chinese name** (to show taxi drivers), Chinese address, notes, and buttons:
   - **Navigate in Amap**: `https://uri.amap.com/marker?position={lng},{lat}&name={name_zh}&src=shanghai-trip&coordinate=gaode&callnative=1`
   - **Apple Maps**: `https://maps.apple.com/?q={name_zh}&ll={lat},{lng}`. Searching by Chinese name avoids coordinate problems. Test whether `ll` needs GCJ-02 or WGS-84 by checking one pin, then note the result in a code comment.
   - **Copy Chinese name / address**
   - **Mark visited** (saved in localStorage, wrapped in try/catch)
6. "Locate me" button. Browser GPS is WGS-84 → convert to GCJ-02 before drawing on AMap tiles.
7. List view toggle: places grouped by category, sorted by distance from me when location is available.
8. Small notice if `unplaced.json` is non-empty.

**Nice to have (later)**
- Filter by `day`, and draw the day's places in order.
- Dark mode.

**UI**
- Mobile-first, one-handed use: bottom sheet, large tap targets (≥44 px), no hover-only interactions.
- English UI; Chinese only for place names/addresses.
- Fast: no framework, total JS < 200 KB gzipped excluding tiles.

---

## 8. Project structure

```
shanghai-map/
├─ data/places.csv            # I edit this
├─ scripts/build-data.ts      # CSV → GeoJSON + validation
├─ public/places.geojson      # generated
├─ public/unplaced.json       # generated
├─ src/
│  ├─ main.ts                 # map init, layers
│  ├─ coords.ts               # gcoord helpers + tests
│  ├─ markers.ts              # icons, clustering, filters
│  ├─ sheet.ts                # bottom sheet + deep links
│  ├─ search.ts
│  └─ style.css
├─ index.html
├─ vite.config.ts             # + vite-plugin-pwa
└─ README.md
```

---

## 9. Build steps

1. Scaffold Vite + TS, add Leaflet, markercluster, gcoord, papaparse, vite-plugin-pwa.
2. Copy the provided `places.csv` into `data/`.
3. Write `scripts/build-data.ts` with validation; wire into `predev`/`prebuild`.
4. Map + tile layers + coordinate handling (`coords.ts` with a test). Until I fill in coordinates, add 3 temporary test rows so the map isn't empty — remove them before deploy.
5. Markers, filters, search, bottom sheet, deep links.
6. Locate-me + list view.
7. PWA/offline caching.
8. Deploy to Cloudflare Pages; write README covering: how to add/edit a place, how to get coordinates (Section 5), how to deploy.

## 10. Done when

- [ ] Every row in `places.csv` has coordinates and appears on the map; the "not placed" notice is gone.
- [ ] Spot-check: The Bund, Yuyuan Garden and Shanghai Tower pins sit exactly on the buildings on AMap tiles, and still line up after switching to the OSM layer.
- [ ] "Navigate in Amap" opens the Amap app on iPhone with the right destination.
- [ ] Works offline after one visit (app shell + GeoJSON + viewed tiles).
- [ ] Lighthouse mobile performance ≥ 90.

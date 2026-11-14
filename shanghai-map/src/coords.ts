import gcoord from 'gcoord';

/** [lng, lat] pair. Every place in places.geojson is GCJ-02. */
export type LngLat = [number, number];
export type Base = 'amap' | 'osm';

/** AMap tiles are GCJ-02, OSM/CARTO tiles are WGS-84. */
export const crsOf = (base: Base) => (base === 'amap' ? gcoord.GCJ02 : gcoord.WGS84);

export function gcjToWgs(p: LngLat): LngLat {
  return gcoord.transform(p, gcoord.GCJ02, gcoord.WGS84) as LngLat;
}

export function wgsToGcj(p: LngLat): LngLat {
  return gcoord.transform(p, gcoord.WGS84, gcoord.GCJ02) as LngLat;
}

/** Where a GCJ-02 place should be drawn on the given basemap. */
export function gcjForBase(p: LngLat, base: Base): LngLat {
  return base === 'amap' ? p : gcjToWgs(p);
}

/** Where a WGS-84 point (browser GPS) should be drawn on the given basemap. */
export function wgsForBase(p: LngLat, base: Base): LngLat {
  return base === 'amap' ? wgsToGcj(p) : p;
}

/** Re-express a map-view point when switching basemaps. */
export function convertBetweenBases(p: LngLat, from: Base, to: Base): LngLat {
  return from === to ? p : (gcoord.transform(p, crsOf(from), crsOf(to)) as LngLat);
}

/** Great-circle distance in metres. Both points must be in the same system. */
export function distanceM(a: LngLat, b: LngLat): number {
  const r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r;
  const dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

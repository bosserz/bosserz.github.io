import { describe, expect, it } from 'vitest';
import { convertBetweenBases, distanceM, gcjForBase, gcjToWgs, wgsForBase, wgsToGcj, type LngLat } from './coords';

const BUND_GCJ: LngLat = [121.4950, 31.2380];

describe('coordinate conversion', () => {
  it('leaves GCJ-02 pins untouched on AMap tiles', () => {
    expect(gcjForBase(BUND_GCJ, 'amap')).toEqual(BUND_GCJ);
  });

  it('moves The Bund ~0.005° west when converted to WGS-84 for OSM', () => {
    const [lng, lat] = gcjToWgs(BUND_GCJ);
    const dLng = BUND_GCJ[0] - lng;
    const dLat = BUND_GCJ[1] - lat;
    expect(dLng).toBeGreaterThan(0.003);
    expect(dLng).toBeLessThan(0.006);
    expect(Math.abs(dLat)).toBeLessThan(0.004);
    // The shift in Shanghai is a few hundred metres - the whole reason this app exists.
    const shift = distanceM(BUND_GCJ, [lng, lat]);
    expect(shift).toBeGreaterThan(300);
    expect(shift).toBeLessThan(700);
  });

  it('round-trips GCJ -> WGS -> GCJ to within a metre', () => {
    expect(distanceM(wgsToGcj(gcjToWgs(BUND_GCJ)), BUND_GCJ)).toBeLessThan(1);
  });

  it('converts browser GPS (WGS-84) to GCJ-02 only for AMap', () => {
    const gps: LngLat = [121.4906, 31.2400];
    expect(wgsForBase(gps, 'osm')).toEqual(gps);
    expect(distanceM(wgsForBase(gps, 'amap'), wgsToGcj(gps))).toBe(0);
  });

  it('treats AMap satellite as GCJ-02 like the AMap street map', () => {
    expect(gcjForBase(BUND_GCJ, 'sat')).toEqual(BUND_GCJ);
    expect(convertBetweenBases(BUND_GCJ, 'amap', 'sat')).toEqual(BUND_GCJ);
    expect(convertBetweenBases(BUND_GCJ, 'sat', 'osm')).toEqual(convertBetweenBases(BUND_GCJ, 'amap', 'osm'));
  });

  it('keeps the view on the same spot when switching basemaps', () => {
    const osmView = convertBetweenBases(BUND_GCJ, 'amap', 'osm');
    expect(distanceM(osmView, gcjToWgs(BUND_GCJ))).toBe(0);
    expect(convertBetweenBases(BUND_GCJ, 'amap', 'amap')).toEqual(BUND_GCJ);
  });
});

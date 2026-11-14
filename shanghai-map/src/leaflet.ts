// Leaflet.markercluster is a UMD plugin that extends the global `L`.
// Import Leaflet through this module (before the plugin) so the global is guaranteed.
import L from 'leaflet';
(window as unknown as { L: typeof L }).L = L;
export default L;

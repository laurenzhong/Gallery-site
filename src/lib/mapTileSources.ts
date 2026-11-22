const configuredUrl = import.meta.env.VITE_MAP_TILE_URL?.trim();
const configuredAttribution = import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim();
const configuredMaxNativeZoom = Number(import.meta.env.VITE_MAP_TILE_MAX_NATIVE_ZOOM);

const configuredSource = configuredUrl
  ? {
      url: configuredUrl,
      attribution: configuredAttribution || "Map tiles",
      maxNativeZoom: Number.isFinite(configuredMaxNativeZoom) ? configuredMaxNativeZoom : 18,
    }
  : undefined;

export const mapTileSources = [
  ...(configuredSource ? [configuredSource] : []),
  {
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 18,
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), NOSTRA, &copy; OpenStreetMap contributors, and the GIS User Community',
    maxNativeZoom: 19,
  },
] as const;

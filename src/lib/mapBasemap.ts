import L from "leaflet";
import { atlasTileSources, mapTileSources } from "./mapTileSources";

// Shared by the public maps and Studio. A stalled tile request may never emit
// tileerror, so also bound the wait before switching the entire basemap.
export function addMapBasemap(map: L.Map, { interactiveAtlas = false } = {}) {
  const sources = interactiveAtlas ? atlasTileSources : mapTileSources;
  const tileTimeout = interactiveAtlas ? 5500 : 10000;
  const pendingTiles = new Map<HTMLElement, number>();
  let sourceIndex = 0;
  let layer: L.TileLayer;
  let overview: L.TileLayer | undefined;
  let switchTimer: number | undefined;

  function clearTile(tile: HTMLElement) {
    window.clearTimeout(pendingTiles.get(tile));
    pendingTiles.delete(tile);
  }

  function clearPending() {
    pendingTiles.forEach((timer) => window.clearTimeout(timer));
    pendingTiles.clear();
    window.clearTimeout(switchTimer);
    switchTimer = undefined;
  }

  function scheduleFallback() {
    if (sourceIndex >= sources.length - 1 || switchTimer !== undefined) return;
    // Leaflet still uses the old layer inside its tileerror callback. Let that
    // callback finish before removing the layer and its internal map reference.
    switchTimer = window.setTimeout(() => {
      clearPending();
      overview?.remove();
      map.removeLayer(layer);
      // Leaflet's remove event unregisters the old layer's map zoom and move handlers.
      layer.off();
      sourceIndex += 1;
      addSource();
    }, 0);
  }

  function addSource() {
    const source = sources[sourceIndex];
    layer = L.tileLayer(source.url, {
      attribution: source.attribution,
      maxNativeZoom: source.maxNativeZoom,
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      updateWhenZooming: false,
      updateWhenIdle: !interactiveAtlas,
      updateInterval: interactiveAtlas ? 80 : 200,
      keepBuffer: interactiveAtlas ? 4 : 0,
    });
    if (sourceIndex < sources.length - 1) {
      layer.on("tileloadstart", (event: L.TileEvent) => {
        clearTile(event.tile);
        pendingTiles.set(event.tile, window.setTimeout(scheduleFallback, tileTimeout));
      });
      layer.on("tileload", (event: L.TileEvent) => clearTile(event.tile));
      // Zooming cancels requests for the old zoom level without a tileunload event.
      layer.on("tileabort", (event: L.TileEvent) => clearTile(event.tile));
      layer.on("tileunload", (event: L.TileEvent) => clearTile(event.tile));
      layer.on("tileerror", scheduleFallback);
    }
    layer.addTo(map);
    if (interactiveAtlas) {
      // One overview tile covers 4 × 4 detail tiles. Its already-drawn geography
      // stays under newly exposed streets while their full-resolution tiles arrive.
      overview = L.tileLayer(source.url, {
        className: "atlas-context-layer",
        tileSize: 1024,
        zoomOffset: -2,
        minZoom: 2,
        maxZoom: 19,
        maxNativeZoom: source.maxNativeZoom + 2,
        zIndex: 0,
        keepBuffer: 1,
        updateWhenIdle: false,
        updateWhenZooming: false,
        referrerPolicy: "strict-origin-when-cross-origin",
      }).addTo(map);
    }
  }

  map.once("unload", clearPending);
  addSource();
}

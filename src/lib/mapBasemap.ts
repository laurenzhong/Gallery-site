import L from "leaflet";
import { mapTileSources } from "./mapTileSources";

// Shared by the public maps and Studio. A stalled tile request may never emit
// tileerror, so also bound the wait before switching the entire basemap.
export function addMapBasemap(map: L.Map) {
  const pendingTiles = new Map<HTMLElement, number>();
  let sourceIndex = 0;
  let layer: L.TileLayer;
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
    if (sourceIndex >= mapTileSources.length - 1 || switchTimer !== undefined) return;
    // Leaflet still uses the old layer inside its tileerror callback. Let that
    // callback finish before removing the layer and its internal map reference.
    switchTimer = window.setTimeout(() => {
      clearPending();
      layer.off();
      map.removeLayer(layer);
      sourceIndex += 1;
      addSource();
    }, 0);
  }

  function addSource() {
    const source = mapTileSources[sourceIndex];
    layer = L.tileLayer(source.url, {
      attribution: source.attribution,
      maxNativeZoom: source.maxNativeZoom,
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 0,
    });
    if (sourceIndex < mapTileSources.length - 1) {
      layer.on("tileloadstart", (event: L.TileEvent) => {
        clearTile(event.tile);
        pendingTiles.set(event.tile, window.setTimeout(scheduleFallback, 10000));
      });
      layer.on("tileload", (event: L.TileEvent) => clearTile(event.tile));
      layer.on("tileunload", (event: L.TileEvent) => clearTile(event.tile));
      layer.on("tileerror", scheduleFallback);
    }
    layer.addTo(map);
  }

  map.once("unload", () => {
    clearPending();
    layer.off();
  });
  addSource();
}

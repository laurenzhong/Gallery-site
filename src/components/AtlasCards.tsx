import type { Photo } from "../data/photos";
import type { StoryRoute } from "../data/storyRoutes";
import { sizedImageUrl } from "../lib/imageUrl";
import { routeStoryHref } from "../lib/mapRoutes";
import type { PhotoStop } from "../lib/photoMapData";

function coordinateLabel(stop: PhotoStop) {
  if (stop.photo.coordinateVisibility === "approximate") return "Approximate location";
  if (stop.coordinateSource === "route") return stop.note;
  return `${Math.abs(stop.lat).toFixed(3)}° ${stop.lat < 0 ? "S" : "N"}   ${Math.abs(stop.lng).toFixed(3)}° ${stop.lng < 0 ? "W" : "E"}`;
}

export function AtlasPrint({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  return <button type="button" className="atlas-print" onClick={onOpen} aria-label={`Open photograph: ${photo.title}`}>
    <img src={photo.previewSrc ?? sizedImageUrl(photo.src, 800)} alt={photo.altText ?? photo.title} />
    <span aria-hidden="true">↗</span>
  </button>;
}

export function AtlasOverview({ photos, locatedCount }: { photos: Photo[]; locatedCount: number }) {
  return <aside className="map-hub-demo__sidebar" aria-label="Photo archive overview">
    <div className="map-hub-demo__sidebar-heading">
      <p className="map-hub-demo__eyebrow">Browse by place</p>
      <h2>Field notes<br /><em>in place.</em></h2>
    </div>
    <div className="map-hub-demo__stats">
      <div><strong>{photos.length}</strong><span>photos</span></div>
      <div><strong>{locatedCount}</strong><span>on map</span></div>
      <div><strong>{new Set(photos.map(photo => photo.category)).size}</strong><span>categories</span></div>
    </div>
    <p className="map-hub-demo__copy">Select a photograph to preview it, or select a numbered group to explore nearby photographs.</p>
    <a className="map-hub-demo__text-link" href="/archive">Open the full archive <span aria-hidden="true">↗</span></a>
  </aside>;
}

export function AtlasPhotoCard({ stop, index, count, onMove, onOpen, onClose }: {
  onClose: () => void; stop: PhotoStop; index: number; count: number; onMove: (delta: number) => void; onOpen: () => void;
}) {
  const photo = stop.photo;
  // Shitang is a named location in the original local folder archive.
  const place = photo.place || (photo.category === "石塘度假区" ? photo.category : undefined);
  const heading = photo.spot || place || photo.title;
  const caption = [...new Set([photo.spot && place, photo.title, photo.category])].filter(value => value && value !== heading);
  return <aside className="atlas-card" aria-label="Selected photograph">
    <div className="atlas-card__bar">
      <button type="button" onClick={onClose}>← Map index</button>
      <span>{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
    </div>
    <AtlasPrint photo={photo} onOpen={onOpen} />
    <div className="atlas-card__caption" aria-live="polite">
      <span className="atlas-card__meta">{coordinateLabel(stop)}</span>
      <h2>{heading}</h2>
      <p>{caption.join(" · ")}</p>
    </div>
    <div className="atlas-card__actions">
      <button type="button" onClick={onOpen}>View photograph <span aria-hidden="true">↗</span></button>
      {count > 1 && <div><button type="button" aria-label="Previous mapped photograph" onClick={() => onMove(-1)}>←</button><button type="button" aria-label="Next mapped photograph" onClick={() => onMove(1)}>→</button></div>}
    </div>
  </aside>;
}

export function AtlasRouteCard({ routes, route, stopIndex, stopPhotos, onRoute, onStop, onOpen }: {
  routes: StoryRoute[]; route?: StoryRoute; stopIndex: number; stopPhotos: Photo[];
  onRoute: (routeId: string | null) => void; onStop: (index: number) => void; onOpen: (photo: Photo) => void;
}) {
  const stop = route?.stops[stopIndex];
  if (!route) return <aside className="map-hub-demo__sidebar" aria-label="Walking routes">
    <div className="map-hub-demo__sidebar-heading">
      <p className="map-hub-demo__eyebrow">Follow a route</p>
      <h2>Walk the line<br /><em>between images.</em></h2>
    </div>
    <div className="map-hub-demo__route-list">
      {routes.map((walk, i) => <div className="map-hub-demo__route-row" key={walk.id}>
        <a className="map-hub-demo__route-card" href={routeStoryHref(walk.id)}>
          <span className="map-hub-demo__route-number">{String(i + 1).padStart(2, "0")}</span>
          <span className="map-hub-demo__route-copy"><strong>{walk.title} {walk.titleEmphasis}</strong>
            <small>{walk.stats.distance} km · {walk.stops.length} stops</small></span>
          <span aria-hidden="true">↗</span>
        </a>
        <button type="button" className="map-hub-demo__route-focus" aria-label={`Show ${walk.title} on map`} onClick={() => onRoute(walk.id)}>On map</button>
      </div>)}
    </div>
  </aside>;
  return <aside className="atlas-card atlas-route" aria-label="Walking route details">
    <div className="atlas-card__bar"><span>Walking routes</span><button type="button" onClick={() => onRoute(null)}>All walks ↩</button></div>
      <div className="atlas-card__caption"><span className="atlas-card__meta">{route.stats.distance} km · {route.stops.length} stops</span>
        <h2>{route.title} {route.titleEmphasis}</h2>
      </div>
      <div className="atlas-route__stops">{route.stops.map((s, i) =>
        <button type="button" aria-pressed={i === stopIndex} key={s.id} onClick={() => onStop(i)}><span>{String(i + 1).padStart(2, "0")}</span>{s.title}</button>
      )}</div>
      {stop && <div className="atlas-route__note" aria-live="polite">
        {stopPhotos[0] && <AtlasPrint photo={stopPhotos[0]} onOpen={() => onOpen(stopPhotos[0])} />}
        {stop.note && <p>{stop.note}</p>}
      </div>}
  </aside>;
}

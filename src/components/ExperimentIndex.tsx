export function ExperimentIndex() {
  return (
    <article className="experiment-index">
      <div className="experiment-index__intro">
        <p className="experiment-kicker">Interaction lab / 01</p>
        <h1>Two ways to enter the archive.</h1>
        <p>
          These pages are temporary prototypes for testing movement, place, and image order before
          any of the ideas move into the home page.
        </p>
      </div>
      <div className="experiment-index__cards">
        <a className="experiment-index__card experiment-index__card--journey" href="/experiments/journey-map">
          <span className="experiment-index__number">01</span>
          <div>
            <p className="experiment-kicker">Scroll narrative</p>
            <h2>Journey map</h2>
            <p>Scroll through image chapters while a route, trail, and active location follow along.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--metro" href="/experiments/metro">
          <span className="experiment-index__number">02</span>
          <div>
            <p className="experiment-kicker">Archive index</p>
            <h2>Archive in motion</h2>
            <p>Switch the same photographs between a fast list and an image-led grid.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--reference" href="/experiments/reference-archive">
          <span className="experiment-index__number">03</span>
          <div>
            <p className="experiment-kicker">MIT reference composition</p>
            <h2>Editorial archive</h2>
            <p>Chapter-led navigation, a contact sheet, and field notes based on open-source photography portfolio patterns.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--reference" href="/experiments/photography-archive">
          <span className="experiment-index__number">04</span>
          <div>
            <p className="experiment-kicker">Photography page / new study</p>
            <h2>Chapters and archive</h2>
            <p>A calmer Photography page with three visual chapters, a complete contact sheet, and a journal doorway.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--atlas" href="/experiments/agarun-atlas">
          <span className="experiment-index__number">05</span>
          <div>
            <p className="experiment-kicker">Agarun reference / atlas</p>
            <h2>Photographs in orbit.</h2>
            <p>Albums, tags, folders, and an interactive collection atlas adapted to the current archive.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--lookbut" href="/experiments/look-but-no-stopping">
          <span className="experiment-index__number">05</span>
          <div>
            <p className="experiment-kicker">MIT open-source reference</p>
            <h2>Look, keep moving.</h2>
            <p>Layered opening, scroll-linked route, and chapter photography adapted from a licensed journey narrative.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--photo-map" href="/experiments/photo-map">
          <span className="experiment-index__number">06</span>
          <div>
            <p className="experiment-kicker">Photo map / open-source research</p>
            <h2>Photographs in place.</h2>
            <p>Browse the archive as a map: thumbnail pins, place filters, and a direct route into the lightbox.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--lookbut-fvm" href="/experiments/look-but-no-stopping-fvm">
          <span className="experiment-index__number">06</span>
          <div>
            <p className="experiment-kicker">FreeVectorMaps comparison</p>
            <h2>Look, map study.</h2>
            <p>The same scroll route over a FreeVectorMaps Hong Kong plate, with required attribution.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--photo-map-maplibre" href="/experiments/photo-map-maplibre">
          <span className="experiment-index__number">07</span>
          <div>
            <p className="experiment-kicker">MapLibre comparison</p>
            <h2>Photographs in place / GL.</h2>
            <p>The same photo map rendered with MapLibre styling, pitch, bearing, and a different base-map texture.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--trail-route" href="/experiments/trail-route">
          <span className="experiment-index__number">08</span>
          <div>
            <p className="experiment-kicker">Leaflet route narrative</p>
            <h2>Keep the ridge in sight.</h2>
            <p>A tighter hiking-day story with a real route, active stops, elevation profile, and map-to-chapter navigation.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--trail-route" href="/experiments/trail-route-gpx-demo">
          <span className="experiment-index__number">09</span>
          <div>
            <p className="experiment-kicker">GPX route importer demo</p>
            <h2>Climb into the winter ridge.</h2>
            <p>A reusable route narrative generated from a personal GPX track, with six stops and bound archive photographs.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--sasha" href="/experiments/sasha-kurmaz">
          <span className="experiment-index__number">10</span>
          <div>
            <p className="experiment-kicker">Sasha Kurmaz reference</p>
            <h2>Images as a field note.</h2>
            <p>An image-first photography index with a fixed wordmark, soft pink paper, and an editorial masonry archive.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
        <a className="experiment-index__card experiment-index__card--year" href="/experiments/year-archive">
          <span className="experiment-index__number">11</span>
          <div>
            <p className="experiment-kicker">Photography / timeline study</p>
            <h2>Year archive</h2>
            <p>A date-led photo index with year filters, featured frames, and the existing lightbox.</p>
          </div>
          <span className="experiment-index__arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

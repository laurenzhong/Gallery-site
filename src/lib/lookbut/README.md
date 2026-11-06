# Look but no stopping reference code

This folder contains the core browser implementation copied from the MIT-licensed
[`jpvalery/newfoundland`](https://github.com/jpvalery/newfoundland) project:

- `canvas-map.ts` (originally `src/canvas-map.js`)
- `component.ts`
- `create-canvas.ts`
- `image-loader.ts`
- `math2.ts`
- `path.ts`
- `vector.ts`
- `ajax.ts`

The React experiment mounts `CanvasMap` directly and supplies a locally generated
Hong Kong SVG from OpenStreetMap boundary data, plus the gallery site's own
photos and text. A separate comparison route also uses the FreeVectorMaps Hong
Kong district plate as an unchanged background image and credits the source in
the page footer. Original photographs, writing, and Newfoundland map artwork
are not included. The copied source remains isolated under this experiment so
it can be removed or migrated separately later.


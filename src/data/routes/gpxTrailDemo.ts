import { GPX_TRAIL_DEMO_TRACK } from "../gpxTrailDemoTrack";
import type { StoryRoute } from "../storyRoutes";

const GPX_POINT_INDICES = [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1318];
const GPX_ROUTE_POINTS = GPX_POINT_INDICES.map((trackIndex, index) => ({
  id: `gpx-track-point-${String(index + 1).padStart(2, "0")}`,
  title: `Track point ${String(index + 1).padStart(2, "0")}`,
  coordinate: GPX_TRAIL_DEMO_TRACK[trackIndex],
  trackIndex,
}));

export const gpxTrailDemo: StoryRoute = {
  id: "gpx-trail-demo",
  kicker: "Personal GPX / 2025.12.31 route study",
  title: "Climb into",
  titleEmphasis: "the winter ridge.",
  subtitle: "A six-stop route narrative generated from the GPX track you provided.",
  introLabel: "06 field notes / personal GPX",
  stats: { distance: "7.2", duration: "09:09", durationLabel: "recorded time", ascent: "+1,014" },
  track: GPX_TRAIL_DEMO_TRACK,
  points: GPX_ROUTE_POINTS,
  bounds: [[28.925, 120.835], [28.961, 120.868]],
  focusZoom: 14.6,
  sourceLabel: "Local GPX · 2025-12-31+10+18+12.gpx",
  stops: [
    { id: "gpx-start", title: "Trailhead", localTitle: "起点", time: "10:18", elevationM: 129, distanceKm: 0, note: "The track begins at the lower trailhead, with the ridge still hidden beyond the first climb.", coordinate: [28.928739, 120.863301], trackIndex: 0, photoIds: ["photo-queenstown-dsc-3078", "photo-dsc_3132-snow-cheer"] },
    { id: "gpx-lower-slope", title: "Lower slope", localTitle: "林线以下", time: "11:15", elevationM: 258, distanceKm: 1.5, note: "The first steady rise leaves the valley floor and pulls the route into the forest.", coordinate: [28.93817, 120.856881], trackIndex: 264, photoIds: ["photo-dsc_3130-banner-summit"] },
    { id: "gpx-mid-slope", title: "Mid-slope", localTitle: "半山", time: "12:35", elevationM: 497, distanceKm: 2.9, note: "The gradient settles briefly before the next long section of climbing.", coordinate: [28.94461, 120.852043], trackIndex: 527, photoIds: ["photo-dsc_3151-foggy-ridge"] },
    { id: "gpx-ridge", title: "Ridge approach", localTitle: "接近山脊", time: "13:40", elevationM: 645, distanceKm: 4.3, note: "The route turns toward the ridge and the view begins to open through the trees.", coordinate: [28.949572, 120.850486], trackIndex: 791, photoIds: ["photo-starstax-4507-4706-trails"] },
    { id: "gpx-high-point", title: "High point", localTitle: "高点", time: "15:20", elevationM: 886, distanceKm: 5.8, note: "A long climb reaches the upper shoulder, where the winter light becomes clearer.", coordinate: [28.953862, 120.850907], trackIndex: 1054, photoIds: ["photo-dsc_3227-summit-3025"] },
    { id: "gpx-finish", title: "Ridge finish", localTitle: "山脊终点", time: "19:27", elevationM: 1186, distanceKm: 7.2, note: "The recorded track ends high on the ridge after the final push upward.", coordinate: [28.957134, 120.839885], trackIndex: 1318, photoIds: ["photo-dsc_3132-snow-cheer"] },
  ],
};

import { gpxTrailDemo } from "./gpxTrailDemo";
import { maclehoseSection2 } from "./maclehoseSection2";
import type { StoryRoute } from "../storyRoutes";

/**
 * The shared route registry. Add every new StoryRoute here so it appears in
 * both the route narrative pages and the archive photo map.
 */
export const storyRoutes: StoryRoute[] = [maclehoseSection2, gpxTrailDemo];

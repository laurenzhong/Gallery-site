import { MACLEHOSE_TRAIL_SECTION_2_TRACK } from "../maclehoseTrailSection2";
import type { StoryRoute } from "../storyRoutes";

export const maclehoseSection2: StoryRoute = {
  id: "maclehose-section-2",
  kicker: "MacLehose Trail / stage 02 route study",
  title: "Follow the coast",
  titleEmphasis: "back inland.",
  subtitle: "A six-stop field record from Long Ke Wan to Pak Tam Au.",
  introLabel: "06 field notes / MacLehose Trail",
  stats: { distance: "14.0", duration: "07:55", ascent: "+1,120" },
  track: MACLEHOSE_TRAIL_SECTION_2_TRACK,
  bounds: [[22.362, 114.325], [22.432, 114.39]],
  stops: [
    { id: "long-ke-wan", title: "Long Ke Wan", localTitle: "浪茄湾", time: "07:30", elevationM: 98, distanceKm: 0, note: "Section 02 begins where the path leaves Long Ke Wan and turns north toward Sai Wan.", coordinate: [22.371216, 114.373458], trackIndex: 0, photoIds: ["photo-001"] },
    { id: "sai-wan", title: "Sai Wan", localTitle: "西湾", time: "09:15", elevationM: 42, distanceKm: 5.7, note: "The trail drops through the headland to Sai Wan before climbing away from the shore again.", coordinate: [22.397835, 114.370989], trackIndex: 262, photoIds: ["photo-031"] },
    { id: "ham-tin-wan", title: "Ham Tin Wan", localTitle: "咸田湾", time: "10:20", elevationM: 24, distanceKm: 7.7, note: "A long beach crossing marks the quiet centre of the second stage.", coordinate: [22.408896, 114.374009], trackIndex: 408, photoIds: ["photo-024"] },
    { id: "tai-long-village", title: "Tai Long Village", localTitle: "大浪村", time: "11:40", elevationM: 72, distanceKm: 8.8, note: "The route threads past Tai Long Village before bending inland toward Chek Keng.", coordinate: [22.417044, 114.37199], trackIndex: 453, photoIds: ["photo-029"] },
    { id: "chek-keng", title: "Chek Keng", localTitle: "赤径", time: "13:00", elevationM: 36, distanceKm: 11.7, note: "At Chek Keng the path follows the inlet, with the final road crossing still ahead.", coordinate: [22.421484, 114.350215], trackIndex: 613, photoIds: ["photo-016"] },
    { id: "pak-tam-au", title: "Pak Tam Au", localTitle: "北潭凹", time: "14:30", elevationM: 155, distanceKm: 14, note: "Section 02 closes at Pak Tam Au, where the route meets the road and Section 03 begins.", coordinate: [22.420667, 114.33188], trackIndex: 740, photoIds: ["photo-073"] },
  ],
};

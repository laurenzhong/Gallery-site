import { defineCliConfig } from "sanity/cli";
import { loadSanityEnv } from "./sanity/env";

loadSanityEnv();

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? "yourprojectid";
const dataset = process.env.SANITY_STUDIO_DATASET ?? "production";

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  studioHost: "queenstown-cms",
});

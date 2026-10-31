import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./sanity/schemaTypes";
import { structure } from "./sanity/structure";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? "yourprojectid";
const dataset = process.env.SANITY_STUDIO_DATASET ?? "production";
const previewOrigin = process.env.SANITY_STUDIO_PREVIEW_URL ?? "http://localhost:5173";

export default defineConfig({
  name: "default",
  title: "Queenstown.top 内容管理",
  projectId,
  dataset,
  basePath: "/studio",
  // Env vars SANITY_STUDIO_PROJECT_ID + SANITY_STUDIO_DATASET must be present at build time
  plugins: [
    structureTool({ structure }),
    visionTool(),
    presentationTool({
      title: "网站预览",
      previewUrl: { initial: `${previewOrigin.replace(/\/$/, "")}/?preview=1` },
    }),
  ],
  schema: {
    types: schemaTypes,
  },
});

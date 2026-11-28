import { zhHansLocale } from "@sanity/locale-zh-hans";
import { IPhoneDevices } from "./sanity/components/IPhoneDevices";
import { route } from "sanity/router";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./sanity/schemaTypes";
import { galleryStructure } from "./sanity/structure";
import { contentPageKeys, contentPages } from "./src/lib/pageContentPages";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? "yourprojectid";
const dataset = process.env.SANITY_STUDIO_DATASET ?? "production";
// Local development can override this with SANITY_STUDIO_PREVIEW_URL. The
// deployed Studio must never fall back to localhost: localhost would refer to
// the editor's own machine and make Presentation appear unavailable.
const previewOrigin = process.env.SANITY_STUDIO_PREVIEW_URL ?? "https://www.queenstown.top";

export default defineConfig({
  name: "default",
  title: "Queenstown.top 内容管理",
  projectId,
  dataset,
  basePath: "/studio",
  // The pairing callback needs a project user token even on browsers that accept
  // Sanity cookies. Keep ordinary Studio sessions on the default dual login.
  auth: { loginMethod: typeof window !== "undefined" && /^\/studio\/iphone(?:\/|$)/.test(window.location.pathname) ? "token" : "dual" },
  tools: [{
    name: "iphone",
    title: "iPhone 上传",
    component: IPhoneDevices,
    router: route.create("/", [route.create("/:device")]),
  }],
  // Env vars SANITY_STUDIO_PROJECT_ID + SANITY_STUDIO_DATASET must be present at build time
  plugins: [
    zhHansLocale(),
    structureTool({ structure: galleryStructure(previewOrigin) }),
    visionTool(),
    presentationTool({
      title: "网站预览",
      previewUrl: { initial: `${previewOrigin.replace(/\/$/, "")}/?studio-preview=1` },
    }),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) => [
      ...templates.filter(({ schemaType }) => !["pageContent", "siteCopy", "pageLayout", "homepageLayout", "photobalconyLayout"].includes(schemaType)),
      ...contentPageKeys.map((key) => ({
        id: `pageContent-${key}`,
        title: contentPages[key].label,
        schemaType: "pageContent",
        value: { pageKey: key },
      })),
    ],
  },
  document: {
    newDocumentOptions: (options) => options.filter(({ templateId }) => !templateId.startsWith("pageContent-")),
    actions: (actions, { schemaType }) => schemaType === "pageContent"
      ? actions.filter(({ action }) => action !== "duplicate")
      : actions,
  },
});

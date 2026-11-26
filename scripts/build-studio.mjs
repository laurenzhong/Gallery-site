import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

// The Vercel project already has VITE_SANITY_PROJECT_ID and VITE_SANITY_DATASET
// set. Reuse them so we don't need duplicate SANITY_STUDIO_* env vars.
process.env.SANITY_STUDIO_PROJECT_ID = process.env.SANITY_STUDIO_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID || "yourprojectid";
process.env.SANITY_STUDIO_DATASET = process.env.SANITY_STUDIO_DATASET || process.env.VITE_SANITY_DATASET || "production";

rmSync("dist-studio", { recursive: true, force: true });
rmSync("public/studio", { recursive: true, force: true });

execSync("sanity build dist-studio --yes", {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});

// Browser translation can reparent text nodes that Studio's React renderer owns.
// Mark the Studio document before its JavaScript runs so the browser leaves those nodes alone.
const studioIndexPath = "dist-studio/index.html";
const studioIndex = readFileSync(studioIndexPath, "utf8")
  .replace(/<html\b[^>]*>/i, (tag) => tag
    .replace(/\s(?:lang|translate)="[^"]*"/gi, "")
    .replace(/>$/, ' lang="zh-Hans" translate="no">'))
  .replace(/<head\b[^>]*>/i, '$&<meta name="google" content="notranslate">');
writeFileSync(studioIndexPath, studioIndex);

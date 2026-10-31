import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

async function loadEnvFile(filename) {
  try {
    const content = await readFile(path.join(projectRoot, filename), "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadEnvFile(".env.local");
await loadEnvFile(".env");

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
const configuredToken = process.env.SANITY_WRITE_TOKEN;
const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

const webhookName = "Vercel production rebuild";
const webhookDescription =
  "Triggers a Vercel production rebuild whenever public site content documents are created, updated, or deleted. Refreshing sitemap.xml / static fallback data only.";

if (!projectId) {
  console.error("SANITY_STUDIO_PROJECT_ID (or VITE_SANITY_PROJECT_ID) is not set.");
  process.exit(1);
}
if (!configuredToken) {
  console.error("SANITY_WRITE_TOKEN is not set. Cannot create webhooks.");
  process.exit(1);
}
if (!deployHookUrl) {
  console.error("VERCEL_DEPLOY_HOOK_URL is not set. Nothing for the webhook to call.");
  process.exit(1);
}

const apiBase = "https://api.sanity.io/v2021-10-04";

async function powershellRequest(url, options) {
  const method = options.method ?? "GET";
  const body = options.body ?? "";
  const command = [
    "$headers = @{ Authorization = \"Bearer $env:SANITY_WEBHOOK_TOKEN\"; 'Content-Type' = 'application/json' }",
    "$params = @{ UseBasicParsing = $true; Uri = $env:SANITY_WEBHOOK_URL; Method = $env:SANITY_WEBHOOK_METHOD; Headers = $headers; TimeoutSec = 25 }",
    "if ($env:SANITY_WEBHOOK_BODY) { $params.Body = $env:SANITY_WEBHOOK_BODY }",
    "$response = Invoke-WebRequest @params",
    "$response.Content",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    env: {
      ...process.env,
      SANITY_WEBHOOK_URL: url,
      SANITY_WEBHOOK_METHOD: method,
      SANITY_WEBHOOK_BODY: body,
      SANITY_WEBHOOK_TOKEN: options.token,
    },
    timeout: 30000,
  });
  return stdout ? JSON.parse(stdout) : undefined;
}

async function requestJson(url, options) {
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  } catch (error) {
    if (process.platform !== "win32" || !options.token) throw error;
    console.log("Sanity management API request failed in Node; retrying with Windows web request.");
    return powershellRequest(url, options);
  }
}

async function readCliAuthToken() {
  try {
    const configPath = path.join(os.homedir(), ".config", "sanity", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    return config.authToken;
  } catch {
    return undefined;
  }
}

async function listExistingWebhooks(token) {
  const result = await requestJson(`${apiBase}/hooks/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    token,
  });
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.hooks)) return result.hooks;
  return result?.id ? [result] : [];
}

let apiToken = configuredToken;
let existing;
try {
  existing = await listExistingWebhooks(apiToken);
} catch (error) {
  const cliToken = await readCliAuthToken();
  if (!(error instanceof Error) || !cliToken || cliToken === apiToken) throw error;
  console.log("SANITY_WRITE_TOKEN cannot manage project webhooks; retrying with the authenticated Sanity CLI token.");
  apiToken = cliToken;
  existing = await listExistingWebhooks(apiToken);
}
const matches = existing.filter((hook) => hook.name === webhookName);

const body = {
  name: webhookName,
  description: webhookDescription,
  dataset,
  url: deployHookUrl,
  rule: {
    on: ["create", "update", "delete"],
    filter: '_type in ["photo", "story", "siteSettings", "category", "homepageLayout", "photobalconyLayout", "pageLayout", "pageContent", "siteCopy"]',
  },
  httpMethod: "POST",
  apiVersion: "v2025-02-19",
  type: "document",
};

for (const match of matches) {
  console.log(`Existing webhook "${webhookName}" found (id ${match.id}). Deleting before recreate...`);
  try {
    await requestJson(`${apiBase}/hooks/projects/${projectId}/${match.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      token: apiToken,
    });
  } catch (error) {
    console.error(`Sanity webhook delete failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const mode = matches.length ? "recreate" : "create";
if (!matches.length) {
  console.log(`No existing webhook named "${webhookName}". Creating...`);
}

let result;
try {
  result = await requestJson(`${apiBase}/hooks/projects/${projectId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    token: apiToken,
  });
} catch (error) {
  console.error(`Sanity webhook ${mode} failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
console.log(`Webhook ${mode}d successfully.`);
if (result?.id) console.log(`  id: ${result.id}`);
console.log(`  name: ${result?.name ?? body.name}`);
console.log(`  dataset: ${result?.dataset ?? body.dataset}`);
if (result?.url) console.log(`  url: ${result.url}`);
console.log(`  filter: ${result?.rule?.filter ?? body.rule.filter}`);
console.log("Verify deliveries at: https://www.sanity.io/manage/project/" + projectId + "/api/hooks");

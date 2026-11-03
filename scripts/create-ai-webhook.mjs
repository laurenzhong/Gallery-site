import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = path.resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  try {
    const text = await readFile(path.join(root, file), "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.VITE_SANITY_DATASET ?? "production";
const token = process.env.SANITY_WRITE_TOKEN;
const url = process.env.AI_WEBHOOK_URL;
const secret = process.env.AI_WEBHOOK_SECRET;
if (!projectId || !token || !url || !secret) {
  throw new Error("需要 SANITY_STUDIO_PROJECT_ID、SANITY_WRITE_TOKEN、AI_WEBHOOK_URL 和 AI_WEBHOOK_SECRET");
}

const apiBase = `https://api.sanity.io/v2021-10-04/hooks/projects/${projectId}`;

async function powershellRequest(url, options) {
  const method = options.method ?? "GET";
  const body = options.body ?? "";
  const command = [
    "$headers = @{ Authorization = \"Bearer $env:SANITY_WEBHOOK_TOKEN\"; 'Content-Type' = 'application/json' }",
    "$params = @{ UseBasicParsing = $true; Uri = $env:SANITY_WEBHOOK_URL; Method = $env:SANITY_WEBHOOK_METHOD; Headers = $headers; TimeoutSec = 30 }",
    "if ($env:SANITY_WEBHOOK_BODY) { $params.Body = $env:SANITY_WEBHOOK_BODY }",
    "$response = Invoke-WebRequest @params",
    "$response.Content",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    env: { ...process.env, SANITY_WEBHOOK_URL: url, SANITY_WEBHOOK_METHOD: method, SANITY_WEBHOOK_BODY: body, SANITY_WEBHOOK_TOKEN: options.token },
    timeout: 40000,
  });
  return stdout ? JSON.parse(stdout) : undefined;
}

async function requestJson(url, options) {
  try {
    const response = await fetch(url, { method: options.method ?? "GET", headers: options.headers, body: options.body });
    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text}`);
    return text ? JSON.parse(text) : undefined;
  } catch (error) {
    if (process.platform !== "win32" || !options.token) throw error;
    console.log("Sanity management API request failed in Node; retrying with Windows web request.");
    return powershellRequest(url, options);
  }
}

let apiToken = token;
try {
  const config = JSON.parse(await readFile(path.join(os.homedir(), ".config", "sanity", "config.json"), "utf8"));
  if (config.authToken) apiToken = config.authToken;
} catch {
  // Fall back to SANITY_WRITE_TOKEN when the Sanity CLI is not logged in.
}
let headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };
let listPayload;
try {
  listPayload = await requestJson(apiBase, { headers, token: apiToken });
} catch (error) {
  if (apiToken === token) throw new Error(`读取 Sanity webhooks 失败：${error instanceof Error ? error.message : String(error)}`);
  apiToken = token;
  headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };
  listPayload = await requestJson(apiBase, { headers, token: apiToken });
}
const hooks = Array.isArray(listPayload) ? listPayload : listPayload.hooks ?? [];
const name = "AI photo processing";
for (const hook of hooks.filter((item) => item.name === name)) {
  try {
    await requestJson(`${apiBase}/${hook.id}`, { method: "DELETE", headers, token: apiToken });
  } catch (error) {
    throw new Error(`删除旧 AI webhook 失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

const body = {
  name,
  description: "Processes queued photo AI tasks after a photo document is created.",
  dataset,
  url,
  rule: { on: ["create", "update"], filter: '_type == "photo" && aiClassification.status == "queued"', projection: "{_id, _type, aiClassification}" },
  httpMethod: "POST",
  apiVersion: "v2025-02-19",
  type: "document",
  headers: { "x-ai-webhook-secret": secret },
};
let result;
try {
  result = await requestJson(apiBase, { method: "POST", headers, body: JSON.stringify(body), token: apiToken });
} catch (error) {
  throw new Error(`创建 AI webhook 失败：${error instanceof Error ? error.message : String(error)}`);
}
console.log(`AI webhook 已创建：${result?.id ?? name}`);
console.log(`URL: ${url}`);
console.log(`Filter: ${body.rule.filter}`);

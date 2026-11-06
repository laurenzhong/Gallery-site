import { createClient, type SanityClient } from "@sanity/client";

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
const dataset = import.meta.env.VITE_SANITY_DATASET ?? "production";
const apiVersion = "2025-02-19";

export function isSanityConfigured() {
  return Boolean(projectId && dataset);
}

export function getSanityClient(): SanityClient | null {
  if (!isSanityConfigured()) {
    return null;
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    // Public browser reads use Sanity's read CDN in every environment. This
    // keeps local development on the same published content as production.
    useCdn: true,
  });
}

export async function fetchCms<T>(query: string): Promise<T> {
  const client = getSanityClient();
  if (!client || !projectId) {
    throw new Error("Sanity is not configured");
  }

  if (!import.meta.env.DEV) {
    return client.fetch<T>(query);
  }

  // Prefer the same-origin Vite proxy in development so local reads do not
  // depend on Sanity's browser CORS list. If that proxy is temporarily down,
  // retry through Sanity's read CDN instead of leaving the app on old static
  // content.
  const url = new URL(`/sanity/v${apiVersion}/data/query/${dataset}`, window.location.origin);
  url.searchParams.set("query", query);
  try {
    const response = await window.fetch(url);
    if (response.ok) {
      const payload = (await response.json()) as { result: T };
      return payload.result;
    }
  } catch {
    // Fall through to the CDN client below.
  }

  try {
    return await client.fetch<T>(query);
  } catch (error) {
    throw new Error(`Sanity request failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

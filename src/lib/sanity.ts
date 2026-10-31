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
    useCdn: false,
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

  // The Vite server forwards this same-origin request to the project API.
  // This keeps local development independent from Sanity's browser CORS list.
  const url = new URL(`/sanity/v${apiVersion}/data/query/${dataset}`, window.location.origin);
  url.searchParams.set("query", query);
  const response = await window.fetch(url);

  if (!response.ok) {
    throw new Error(`Sanity request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { result: T };
  return payload.result;
}

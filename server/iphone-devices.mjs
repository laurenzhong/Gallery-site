import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@sanity/client";

export const devicePattern = /^[0-9a-f]{64}$/;
const bearerPattern = /^Bearer (gd1_[0-9a-f]{64})$/;

export function serviceClient() {
  const token = process.env.SANITY_WRITE_TOKEN?.trim() || process.env.SANITY_AUTH_TOKEN?.trim();
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET || process.env.VITE_SANITY_DATASET || "production";
  if (!token || !projectId) return null;
  return createClient({ projectId, dataset, token, apiVersion: "2025-02-19", useCdn: false });
}

function documentIds(device) {
  return [`iphoneDevice.${device}`, `iphoneProof.${device}`];
}

// A dataset writer cannot issue a grant by creating a document. Recreating a
// deleted marker also invalidates its former proof, which covers its revision.
function signature(client, marker) {
  const { projectId, dataset, token } = client.config();
  const payload = JSON.stringify(["gallery-device-v1", projectId, dataset, marker._id, marker._rev, marker._updatedAt]);
  return createHmac("sha256", token).update(payload).digest("hex");
}

export async function deviceAuthorized(client, header = "") {
  const key = bearerPattern.exec(header)?.[1];
  if (!key) return false;
  const device = createHash("sha256").update(key).digest("hex");
  const [marker, proof] = await client.getDocuments(documentIds(device));
  return marker?._type === "iphoneDevice" && typeof proof?.signature === "string" &&
    devicePattern.test(proof.signature) && timingSafeEqual(Buffer.from(signature(client, marker)), Buffer.from(proof.signature));
}

export async function approveDevice(client, device) {
  const [markerId, proofId] = documentIds(device);
  // Concurrent approvals of the same phone share the marker revision.
  await client.createIfNotExists({ _id: markerId, _type: "iphoneDevice", device });
  const marker = await client.getDocument(markerId);
  if (!marker || marker._type !== "iphoneDevice") throw new Error("Missing device marker");
  await client.createOrReplace({ _id: proofId, _type: "iphoneDeviceProof", signature: signature(client, marker) });
}

export async function revokeDevice(client, device) {
  const [markerId, proofId] = documentIds(device);
  await client.transaction().delete(markerId).delete(proofId).commit();
}

export function send(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

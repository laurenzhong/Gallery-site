import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { approveDevice, deviceAuthorized, revokeDevice } from "./iphone-devices.mjs";

test("only an approved phone can publish and deleted grants cannot be replayed", async () => {
  const docs = new Map();
  const client = {
    config: () => ({ projectId: "example", dataset: "test", token: "test-only" }),
    getDocument: id => docs.get(id),
    getDocuments: ids => ids.map(id => docs.get(id)),
    createIfNotExists(doc) {
      if (!docs.has(doc._id)) docs.set(doc._id, { ...doc, _rev: randomUUID(), _updatedAt: new Date().toISOString() });
    },
    createOrReplace: doc => docs.set(doc._id, doc),
    transaction() {
      const ids = [];
      return {
        delete(id) { ids.push(id); return this; },
        commit() { ids.forEach(id => docs.delete(id)); },
      };
    },
  };
  const key = "gd1_" + "a".repeat(64);
  const device = createHash("sha256").update(key).digest("hex");
  const header = "Bearer " + key;
  assert.equal(await deviceAuthorized(client, header), false);
  await approveDevice(client, device);
  assert.equal(await deviceAuthorized(client, header), true);
  assert.equal(await deviceAuthorized(client, "Bearer gd1_" + device), false);
  assert.equal(await deviceAuthorized(client, "Bearer " + device), false);
  await approveDevice(client, device);
  assert.equal(await deviceAuthorized(client, header), true);
  const copy = Array.from(docs.values());
  await revokeDevice(client, device);
  assert.equal(await deviceAuthorized(client, header), false);
  copy.forEach(doc => client.createIfNotExists(doc));
  assert.equal(await deviceAuthorized(client, header), false);
});

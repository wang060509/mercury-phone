"use strict";

const assert = require("node:assert/strict");
const MercuryLocalDataVault = require("../system/local-data-vault.js");

class MemoryStorage {
  constructor(entries = [], options = {}) {
    this.values = new Map(entries);
    this.options = options;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) {
    if (this.options.failReads === true) throw Object.assign(new Error("read denied"), { name: "SecurityError" });
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    if (this.options.failProbeWrites === true && String(key).startsWith("__mercury_local_data_probe_")) {
      throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    }
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

const values = [
  ["mercury.app.shared.archive.v1", JSON.stringify({ runtimeProfiles: [{ id: "profile-1" }] })],
  ["mercury.app.shared.generation-profiles.v1", JSON.stringify({ profiles: [{ id: "preset-1" }] })],
  ["mercury.app.shared.chat-experience.v1", JSON.stringify({ contacts: {} })],
  ["mercury.app.mercury-chat.conversation.v1", JSON.stringify({ schemaVersion: 2, entries: [] })],
  ["mercury.app.mercury-chat.conversation.contact-b.v1", JSON.stringify({ schemaVersion: 2, entries: [] })],
  ["mercury.app.shared.relationship-records.v1", JSON.stringify([{ id: "event-1" }])],
  ["mercury.system.notifications", JSON.stringify([{ id: "note-1", body: "remember" }])],
  ["mercury.app.settings.connection", JSON.stringify({ baseUrl: "https://example.test/v1", model: "model-a", apiKey: "top-secret", rememberApiKey: true, lastTest: "success" })],
  ["mercury.system.lock", JSON.stringify({ enabled: true, passcode: "2468" })],
  ["mercury.future.unclassified", JSON.stringify({ value: "future" })],
  ["other.product.key", "leave-me-alone"],
];

(async () => {
  const storage = new MemoryStorage(values);
  const vault = new MercuryLocalDataVault({
    storage,
    storageInfo: async () => ({ usage: 4096, quota: 65536, persisted: false }),
    indexedDB: { open() {} },
    cacheStorage: { open() {} },
    now: () => new Date("2026-08-19T12:00:00.000Z"),
  });

  const snapshot = await vault.snapshot();
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.mode, "persistent");
  assert.equal(snapshot.writable, true);
  assert.equal(snapshot.usage, 4096);
  assert.equal(snapshot.quota, 65536);
  assert.equal(snapshot.persisted, false);
  assert.equal(snapshot.backup.includedRecords, 8, "all canonical durable records and redacted connection preferences are in scope");
  assert.equal(snapshot.sources.find((item) => item.id === "conversations").recordCount, 2, "dynamic conversation keys share one catalog source");
  assert.equal(snapshot.sources.find((item) => item.id === "device-lock").policy, "exclude");
  assert.equal(snapshot.sources.find((item) => item.id === "session-credentials").reason, "credential");
  assert.equal(snapshot.sources.find((item) => item.id === "vector-index").derived, true);
  assert.equal(snapshot.sources.find((item) => item.id === "vector-index").available, true);
  assert.equal(snapshot.sources.find((item) => item.id === "embedding-cache").available, true);
  assert.equal(snapshot.sources.find((item) => item.id === "unclassified").recordCount, 1);
  assert.equal(snapshot.warnings.some((item) => item.code === "unclassified-local-data"), true);
  assert.equal(storage.getItem("other.product.key"), "leave-me-alone", "inspection never touches unrelated same-origin data");
  assert.equal([...storage.values.keys()].some((key) => key.startsWith("__mercury_local_data_probe_")), false, "health probes are removed");

  const backup = vault.createBackup();
  const serialized = JSON.stringify(backup);
  const records = backup.datasets.flatMap((dataset) => dataset.records);
  const connection = records.find((record) => record.key === "mercury.app.settings.connection");
  assert.equal(backup.format, "mercury-phone-backup");
  assert.equal(backup.version, 1);
  assert.equal(backup.createdAt, "2026-08-19T12:00:00.000Z");
  assert.equal(backup.summary.records, 8);
  assert.equal(records.some((record) => record.key === "mercury.system.lock"), false, "device passcode never enters a backup");
  assert.equal(records.some((record) => record.key === "mercury.future.unclassified"), false, "unknown Mercury data is reported but not blindly exported");
  assert.equal(records.some((record) => record.key === "other.product.key"), false, "unrelated origin data never enters a Mercury backup");
  assert.equal(JSON.parse(connection.value).apiKey, "", "remembered API keys are redacted");
  assert.equal(JSON.parse(connection.value).rememberApiKey, false);
  assert.equal(JSON.parse(connection.value).lastTest, "idle");
  assert.equal(serialized.includes("top-secret"), false);
  assert.equal(serialized.includes("2468"), false);
  assert.equal(backup.exclusions.some((item) => item.id === "session-credentials"), true);
  assert.equal(backup.exclusions.some((item) => item.id === "vector-index" && item.reason === "rebuildable"), true);
  assert.equal(Object.isFrozen(backup), true);
  assert.equal(Object.isFrozen(backup.datasets[0].records), true);

  const volatile = new MercuryLocalDataVault({ storage: new MemoryStorage(), mode: "volatile", modeReason: "SecurityError", storageInfo: async () => ({}) });
  const volatileSnapshot = await volatile.snapshot();
  assert.equal(volatileSnapshot.status, "volatile");
  assert.equal(volatileSnapshot.modeReason, "SecurityError");
  assert.equal(volatileSnapshot.writable, true, "the in-memory fallback remains usable for the current page lifetime");

  const degraded = new MercuryLocalDataVault({ storage: new MemoryStorage([], { failProbeWrites: true }), storageInfo: async () => { throw new Error("estimate denied"); } });
  const degradedSnapshot = await degraded.snapshot();
  assert.equal(degradedSnapshot.status, "degraded");
  assert.equal(degradedSnapshot.writable, false);
  assert.equal(degradedSnapshot.warnings.some((item) => item.code === "storage-write-failed"), true);
  assert.equal(degradedSnapshot.warnings.some((item) => item.code === "storage-estimate-unavailable"), true);

  const corrupt = new MercuryLocalDataVault({ storage: new MemoryStorage([["mercury.app.settings.connection", "not-json-top-secret"]]), storageInfo: async () => ({}) });
  const corruptBackup = corrupt.createBackup();
  assert.equal(corruptBackup.summary.records, 0, "unredactable settings are omitted instead of leaking raw text");
  assert.equal(JSON.stringify(corruptBackup).includes("not-json-top-secret"), false);
  assert.equal(corruptBackup.warnings.some((item) => item.code === "backup-redaction-failed"), true);

  console.log("local-data-vault: interface assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });

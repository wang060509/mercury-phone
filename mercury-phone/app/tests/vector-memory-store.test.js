"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/vector-memory-contracts.js");
const { MercuryVectorMemoryStore, VectorMemoryStorageError } = require("../system/vector-memory-store.js");

(async () => {
  const store = new MercuryVectorMemoryStore({ indexedDB: null });
  assert.equal(store.isAvailable(), false);
  await assert.rejects(store.open(), VectorMemoryStorageError);
  assert.equal(new VectorMemoryStorageError("local storage unavailable").message, "local storage unavailable");
  console.log("vector-memory-store: availability assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });

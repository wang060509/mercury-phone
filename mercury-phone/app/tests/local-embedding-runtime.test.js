"use strict";

const assert = require("node:assert/strict");
const { LocalEmbeddingRuntime } = require("../core/local-embedding-runtime.js");

(async () => {
  const progress = [];
  const runtime = new LocalEmbeddingRuntime({
    modelSource: "test-model",
    modelId: "test-local-v1",
    loadModule: async () => ({
      env: {},
      pipeline: async (task, model, options) => {
        assert.equal(task, "feature-extraction");
        assert.equal(model, "test-model");
        options.progress_callback?.({ status: "ready" });
        return async () => ({ data: new Float32Array([0.5, 0.25, 0.25]) });
      },
    }),
  });
  assert.equal(runtime.snapshot().status, "idle");
  await runtime.prepare({ onProgress: (event) => progress.push(event.status) });
  assert.equal(runtime.snapshot().status, "ready");
  assert.deepEqual(progress, ["ready"]);
  assert.deepEqual(await runtime.embed("A local note"), { modelId: "test-local-v1", dimensions: 3, values: [0.5, 0.25, 0.25] });
  await runtime.close();
  assert.equal(runtime.snapshot().status, "idle");

const failed = new LocalEmbeddingRuntime({ loadModule: async () => ({}) });
  await assert.rejects(failed.prepare(), /unavailable/);
  assert.equal(failed.snapshot().status, "failed");

  const stalled = new LocalEmbeddingRuntime({
    prepareTimeoutMs: 1000,
    loadModule: async () => ({ env: {}, pipeline: async () => new Promise(() => {}) }),
  });
  await assert.rejects(stalled.prepare(), /timed out/);
  assert.equal(stalled.snapshot().status, "failed", "a stalled local model returns control to the caller");
  console.log("local-embedding-runtime: assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });

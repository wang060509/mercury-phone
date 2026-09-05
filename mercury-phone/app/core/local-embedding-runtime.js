(function exposeMercuryLocalEmbeddingRuntime(global) {
  "use strict";

  const DEFAULT_MODEL_SOURCE = "Xenova/bge-small-zh-v1.5";
  const DEFAULT_MODEL_ID = "mercury-local-semantic-zh-v1";
  const DEFAULT_IMPORT_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
  const DEFAULT_PREPARE_TIMEOUT_MS = 90000;

  const defaultModuleLoader = (url) => import(url);
  const boundedTimeout = (value, timeoutMs) => new Promise((resolve, reject) => {
    const timer = global.setTimeout(() => reject(new Error("Local semantic model preparation timed out.")), timeoutMs);
    Promise.resolve(value).then((result) => { global.clearTimeout(timer); resolve(result); }, (error) => { global.clearTimeout(timer); reject(error); });
  });

  class LocalEmbeddingRuntime {
    constructor(options = {}) {
      this.modelSource = options.modelSource || DEFAULT_MODEL_SOURCE;
      this.modelId = options.modelId || DEFAULT_MODEL_ID;
      this.importUrl = options.importUrl || DEFAULT_IMPORT_URL;
      this.loadModule = options.loadModule || (() => defaultModuleLoader(this.importUrl));
      this.status = "idle";
      this.extractor = null;
      this.error = null;
      this.dimensions = null;
      this.prepareTimeoutMs = Number.isInteger(options.prepareTimeoutMs) ? Math.max(1000, options.prepareTimeoutMs) : DEFAULT_PREPARE_TIMEOUT_MS;
    }

    snapshot() { return Object.freeze({ status: this.status, modelId: this.modelId, dimensions: this.dimensions, error: this.error?.message || null }); }

    async prepare(options = {}) {
      if (this.status === "ready" && this.extractor) return this.snapshot();
      if (this.status === "loading") return this.loading;
      this.status = "loading";
      this.error = null;
      const timeoutMs = Number.isInteger(options.timeoutMs) ? Math.max(1000, options.timeoutMs) : this.prepareTimeoutMs;
      this.loading = (async () => {
        try {
          const transformers = await boundedTimeout(this.loadModule(), timeoutMs);
          if (typeof transformers?.pipeline !== "function") throw new TypeError("The local semantic runtime is unavailable.");
          if (transformers.env) {
            transformers.env.allowLocalModels = false;
            transformers.env.useBrowserCache = true;
          }
          this.extractor = await boundedTimeout(transformers.pipeline("feature-extraction", this.modelSource, {
            pooling: "mean",
            normalize: true,
            progress_callback: typeof options.onProgress === "function" ? options.onProgress : undefined,
          }), timeoutMs);
          this.status = "ready";
          return this.snapshot();
        } catch (error) {
          this.status = "failed";
          this.extractor = null;
          this.error = error instanceof Error ? error : new Error(String(error));
          throw this.error;
        } finally {
          this.loading = null;
        }
      })();
      return this.loading;
    }

    async embed(text) {
      if (this.status !== "ready" || !this.extractor) throw new Error("The local semantic model is not ready.");
      const content = String(text || "").trim();
      if (!content) throw new TypeError("Semantic embedding requires text.");
      const output = await this.extractor(content, { pooling: "mean", normalize: true });
      const values = Array.from(output?.data || output || []);
      if (!values.length || !values.every(Number.isFinite)) throw new TypeError("The local semantic model returned an invalid vector.");
      this.dimensions = values.length;
      return Object.freeze({ modelId: this.modelId, dimensions: values.length, values });
    }

    async close() {
      const disposer = this.extractor?.dispose || this.extractor?.close;
      if (typeof disposer === "function") await disposer.call(this.extractor);
      this.extractor = null;
      this.status = "idle";
      this.dimensions = null;
    }
  }

  const api = { DEFAULT_MODEL_SOURCE, DEFAULT_MODEL_ID, DEFAULT_IMPORT_URL, DEFAULT_PREPARE_TIMEOUT_MS, LocalEmbeddingRuntime };
  global.MercuryLocalEmbeddingRuntime = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

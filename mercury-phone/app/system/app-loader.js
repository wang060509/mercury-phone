(function exposeMercuryAppLoader(global) {
  "use strict";

  const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

  const createError = (code, message, detail = {}) => {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, detail);
    return error;
  };

  const errorSnapshot = (error) => Object.freeze({
    code: typeof error?.code === "string" ? error.code : "APP_LOAD_FAILED",
    message: error instanceof Error ? error.message : String(error),
  });

  class MercuryDomAssetAdapter {
    constructor(options = {}) {
      this.document = options.document || global.document || null;
      this.styles = new Map();
      this.scripts = new Map();
    }

    loadStyle(href) {
      return this.#load({ kind: "style", url: href, cache: this.styles });
    }

    loadScript(src) {
      return this.#load({ kind: "script", url: src, cache: this.scripts });
    }

    #load({ kind, url, cache }) {
      if (typeof url !== "string" || !url.trim()) return Promise.reject(createError("ASSET_URL_INVALID", `${kind} assets require a URL.`));
      const normalizedUrl = url.trim();
      if (cache.has(normalizedUrl)) return cache.get(normalizedUrl);
      if (!this.document?.createElement || !this.document?.head) return Promise.reject(createError("ASSET_DOCUMENT_UNAVAILABLE", "The document cannot load app assets."));

      const attribute = kind === "style" ? "href" : "src";
      const tagName = kind === "style" ? "link" : "script";
      const existing = typeof this.document.querySelectorAll === "function"
        ? [...this.document.querySelectorAll(tagName)].find((node) => node.getAttribute?.(attribute) === normalizedUrl)
        : null;
      if (existing) {
        const ready = Promise.resolve(existing);
        cache.set(normalizedUrl, ready);
        return ready;
      }

      const node = this.document.createElement(tagName);
      if (kind === "style") node.setAttribute("rel", "stylesheet");
      else node.async = false;
      node.setAttribute(attribute, normalizedUrl);

      const pending = new Promise((resolve, reject) => {
        node.onload = () => resolve(node);
        node.onerror = () => {
          cache.delete(normalizedUrl);
          node.remove?.();
          reject(createError("ASSET_LOAD_FAILED", `Could not load ${normalizedUrl}.`, { asset: normalizedUrl, kind }));
        };
        if (typeof this.document.head.append === "function") this.document.head.append(node);
        else this.document.head.appendChild(node);
      });
      cache.set(normalizedUrl, pending);
      return pending;
    }
  }

  class MercuryAppLoader {
    constructor(options = {}) {
      if (!options.appEngine || typeof options.appEngine.getDefinition !== "function" || typeof options.appEngine.register !== "function") {
        throw new TypeError("MercuryAppLoader requires an App Engine registration boundary.");
      }
      if (typeof options.activate !== "function") throw new TypeError("MercuryAppLoader requires an activation adapter.");
      this.appEngine = options.appEngine;
      this.activate = options.activate;
      this.assets = options.assetAdapter || new MercuryDomAssetAdapter();
      this.manifests = new Map();
      this.states = new Map();
      this.listeners = new Set();
      this.launchSequence = 0;

      for (const source of options.manifests || []) {
        const manifest = this.#normalizeManifest(source);
        if (this.manifests.has(manifest.id)) throw new Error(`Duplicate app manifest: ${manifest.id}`);
        this.manifests.set(manifest.id, manifest);
        this.states.set(manifest.id, { status: "idle", attempt: 0, error: null, promise: null });
      }
    }

    snapshot(appId) {
      if (this.appEngine.getDefinition(appId)) return Object.freeze({ known: true, status: "ready", attempt: this.states.get(appId)?.attempt || 0, error: null });
      const state = this.states.get(appId);
      if (!state) return Object.freeze({ known: false, status: "unknown", attempt: 0, error: null });
      return Object.freeze({ known: true, status: state.status, attempt: state.attempt, error: state.error });
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("App Loader listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    async launch(appId, payload = null) {
      const ticket = ++this.launchSequence;
      if (!this.snapshot(appId).known) throw createError("APP_NOT_FOUND", `Unknown app: ${appId}`, { appId });
      if (!this.appEngine.getDefinition(appId)) await this.#ensure(appId);

      if (ticket !== this.launchSequence) {
        const result = Object.freeze({ appId, status: "superseded" });
        this.#emit("superseded", { appId, result });
        return result;
      }

      const accepted = this.activate(appId, payload);
      const result = Object.freeze({ appId, status: accepted === false ? "rejected" : "active" });
      this.#emit(result.status, { appId, result });
      return result;
    }

    async #ensure(appId) {
      const state = this.states.get(appId);
      const manifest = this.manifests.get(appId);
      if (!state || !manifest) throw createError("APP_NOT_FOUND", `Unknown app: ${appId}`, { appId });
      if (this.appEngine.getDefinition(appId)) return this.appEngine.getDefinition(appId);
      if (state.promise) return state.promise;

      state.status = "loading";
      state.attempt += 1;
      state.error = null;
      this.#emit("loading", { appId, attempt: state.attempt });

      state.promise = (async () => {
        try {
          for (const href of manifest.styles) await this.assets.loadStyle(href);
          for (const src of manifest.scripts) await this.assets.loadScript(src);
        } catch (cause) {
          throw createError("APP_ASSET_LOAD_FAILED", `Could not load resources for ${appId}.`, { appId, cause });
        }

        let definition;
        try {
          definition = manifest.createDefinition();
          if (!definition || definition.id !== appId) throw new Error(`Expected definition ${appId}.`);
          this.appEngine.register(definition);
        } catch (cause) {
          throw createError("APP_DEFINITION_INVALID", `Could not register ${appId}.`, { appId, cause });
        }

        state.status = "ready";
        state.error = null;
        this.#emit("ready", { appId, attempt: state.attempt });
        return definition;
      })().catch((error) => {
        state.status = "error";
        state.error = errorSnapshot(error);
        this.#emit("error", { appId, attempt: state.attempt, error: state.error });
        throw error;
      }).finally(() => {
        state.promise = null;
      });

      return state.promise;
    }

    #normalizeManifest(source) {
      if (!source || typeof source !== "object" || !APP_ID_PATTERN.test(source.id || "")) throw new TypeError("App manifests require a valid id.");
      if (typeof source.createDefinition !== "function") throw new TypeError(`App manifest ${source.id} requires a definition factory.`);
      const normalizeAssets = (value, label) => {
        if (value === undefined) return Object.freeze([]);
        if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new TypeError(`App manifest ${source.id} has invalid ${label}.`);
        return Object.freeze(value.map((item) => item.trim()));
      };
      return Object.freeze({
        id: source.id,
        styles: normalizeAssets(source.styles, "styles"),
        scripts: normalizeAssets(source.scripts, "scripts"),
        createDefinition: source.createDefinition,
      });
    }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((listener) => listener(event));
    }
  }

  global.MercuryDomAssetAdapter = MercuryDomAssetAdapter;
  global.MercuryAppLoader = MercuryAppLoader;
})(window);

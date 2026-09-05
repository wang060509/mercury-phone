(function exposeMercuryAppEngine(global) {
  "use strict";

  class MercuryAppEngine {
    constructor(options = {}) {
      if (!options.host) throw new Error("MercuryAppEngine requires an app host.");
      this.host = options.host;
      this.services = Object.freeze({ ...(options.services || {}) });
      this.serviceHub = options.serviceHub || null;
      this.i18n = options.i18n || null;
      this.widgetRegistry = options.widgetRegistry || null;
      this.apps = new Map();
      this.instances = new Map();
      this.activeAppId = null;
      this.listeners = new Set();
      this.instanceSequence = 0;
      this.createElement = options.createElement || ((tag) => document.createElement(tag));
    }

    register(definition) {
      global.MercuryContracts.validateAppDefinition(definition);
      if (this.apps.has(definition.id)) throw new Error(`App already registered: ${definition.id}`);
      const normalized = Object.freeze({ version: 1, capabilities: Object.freeze([]), widgets: Object.freeze([]), ...definition });
      this.apps.set(normalized.id, normalized);
      this.#emit("registered", { appId: normalized.id, version: normalized.version });
      return normalized;
    }

    unregister(appId) {
      if (this.instances.has(appId)) this.unmount(appId);
      const removed = this.apps.delete(appId);
      if (removed) this.#emit("unregistered", { appId });
      return removed;
    }

    list() {
      return Object.freeze([...this.apps.values()]);
    }

    getDefinition(appId) {
      return this.apps.get(appId) || null;
    }

    getInstance(appId) {
      return this.instances.get(appId) || null;
    }

    listInstances() {
      return Object.freeze([...this.instances.values()]);
    }

    launch(appId, launchPayload = null) {
      const definition = this.apps.get(appId);
      if (!definition) throw new Error(`Unknown app: ${appId}`);
      if (this.activeAppId === appId) return this.getInstance(appId);
      if (this.activeAppId) this.pause(this.activeAppId);

      let record = this.instances.get(appId);
      if (!record) record = this.#mount(definition, launchPayload);
      else this.#invoke(record, "onResume", launchPayload);

      this.host.hidden = false;
      record.root.hidden = false;
      record.status = record.error ? "error" : "active";
      this.activeAppId = appId;
      this.#emit("active", { appId, instanceId: record.instanceId });
      return record;
    }

    pause(appId = this.activeAppId) {
      const record = this.instances.get(appId);
      if (!record || record.status === "paused") return false;
      this.#invoke(record, "onPause");
      record.root.hidden = true;
      record.status = record.error ? "error" : "paused";
      if (this.activeAppId === appId) this.activeAppId = null;
      if (!this.activeAppId) this.host.hidden = true;
      this.#emit("paused", { appId, instanceId: record.instanceId });
      return true;
    }

    resume(appId) {
      return this.launch(appId);
    }

    unmount(appId) {
      const record = this.instances.get(appId);
      if (!record) return false;
      this.#invoke(record, "onUnmount");
      record.root.remove();
      this.instances.delete(appId);
      if (this.activeAppId === appId) this.activeAppId = null;
      if (!this.activeAppId) this.host.hidden = true;
      this.#emit("unmounted", { appId, instanceId: record.instanceId });
      return true;
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("App Engine listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    #mount(definition, launchPayload) {
      const root = this.createElement("section");
      const instanceId = `${definition.id}:${++this.instanceSequence}`;
      root.className = "app-instance";
      root.dataset.appId = definition.id;
      root.dataset.instanceId = instanceId;
      root.hidden = false;
      this.host.append(root);

      const app = typeof definition.create === "function" ? definition.create() : definition;
      const state = {};
      const appServices = this.serviceHub?.createAppServices(definition.id) || this.services;
      const context = Object.freeze({
        appId: definition.id,
        instanceId,
        version: definition.version,
        capabilities: definition.capabilities,
        services: appServices,
        i18n: this.i18n,
        state,
        widgets: Object.freeze({
          definitions: definition.widgets,
          register: (widget) => {
            if (!this.widgetRegistry) throw new Error("Widget Registry is not available yet.");
            return this.widgetRegistry.register(definition.id, widget);
          },
        }),
      });
      const record = { appId: definition.id, instanceId, definition, app, root, context, status: "mounting", error: null };
      this.instances.set(definition.id, record);

      if (typeof app.render === "function") {
        try {
          app.render(root, context, launchPayload);
        } catch (error) {
          this.#isolateError(record, "render", error);
        }
      }
      if (!record.error) this.#invoke(record, "onMount", launchPayload);
      if (!record.error) record.status = "active";
      this.#emit("mounted", { appId: definition.id, instanceId, status: record.status });
      return record;
    }

    #invoke(record, method, payload = null) {
      if (record.error && method !== "onUnmount") return false;
      const handler = record.app?.[method];
      if (typeof handler !== "function") return true;
      try {
        handler.call(record.app, record.context, payload);
        return true;
      } catch (error) {
        this.#isolateError(record, method, error);
        return false;
      }
    }

    #isolateError(record, phase, error) {
      record.error = Object.freeze({ phase, message: error instanceof Error ? error.message : String(error) });
      record.status = "error";
      record.root.replaceChildren();
      const fallback = this.createElement("div");
      fallback.className = "app-error";
      const content = this.createElement("div");
      const title = this.createElement("h2");
      const body = this.createElement("p");
      title.textContent = this.i18n?.t("app.errorTitle") || "This app paused unexpectedly";
      body.textContent = this.i18n?.t("app.errorBody") || "Mercury OS is still running.";
      content.append(title, body);
      fallback.append(content);
      record.root.append(fallback);
      this.#emit("error", { appId: record.appId, instanceId: record.instanceId, phase, error: record.error });
    }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((listener) => listener(event));
    }
  }

  global.MercuryAppEngine = MercuryAppEngine;
})(window);

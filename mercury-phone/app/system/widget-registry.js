(function exposeMercuryWidgetRegistry(global) {
  "use strict";

  class MercuryWidgetRegistry {
    constructor() { this.widgets = new Map(); this.listeners = new Set(); }

    register(appId, definition) {
      const widget = Object.freeze({ ...definition, appId });
      global.MercuryContracts.validateWidgetDefinition(widget);
      const key = `${appId}:${widget.id}`;
      if (this.widgets.has(key)) throw new Error(`Widget already registered: ${key}`);
      this.widgets.set(key, widget);
      this.#emit("registered", { key, widget });
      return widget;
    }

    unregister(appId, widgetId) {
      const key = `${appId}:${widgetId}`;
      const removed = this.widgets.delete(key);
      if (removed) this.#emit("unregistered", { key, appId, widgetId });
      return removed;
    }

    list(appId = null) {
      const values = [...this.widgets.values()];
      return Object.freeze(appId ? values.filter((widget) => widget.appId === appId) : values);
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Widget Registry listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((listener) => listener(event));
    }
  }

  global.MercuryWidgetRegistry = MercuryWidgetRegistry;
})(window);

(function exposeMercuryHomeBarController(global) {
  "use strict";

  class MercuryHomeBarController {
    constructor(options = {}) {
      const required = ["screen", "gestureTarget", "machine", "events", "gestureManager", "appEngine"];
      required.forEach((key) => { if (!options[key]) throw new Error(`HomeBarController requires ${key}.`); });
      this.screen = options.screen;
      this.gestureTarget = options.gestureTarget;
      this.machine = options.machine;
      this.events = options.events;
      this.gestureManager = options.gestureManager;
      this.appEngine = options.appEngine;
      this.unregister = this.gestureManager.registerEdgeSwipe(this.gestureTarget, {
        edge: "bottom",
        edgeSize: 58,
        threshold: 44,
        holdDelay: 240,
        canStart: (event) => this.#canStart(event),
        onStart: () => this.screen.classList.add("is-home-gesture-active"),
        onProgress: (distance) => this.#publish("progress", { distance }),
        onCommit: (detail) => this.#goHome(detail),
        onHoldCommit: (detail) => this.#requestSwitcher(detail),
        onEnd: () => this.screen.classList.remove("is-home-gesture-active"),
        onCancel: () => this.screen.classList.remove("is-home-gesture-active"),
      });
    }

    destroy() {
      this.unregister?.();
      this.unregister = null;
      this.screen.classList.remove("is-home-gesture-active");
    }

    #canStart(event) {
      if (event.target?.closest?.("[data-gesture-exclusion]")) return false;
      return this.machine.state === "home" || this.machine.state === "appOpen" || this.machine.state === "appSwitcher";
    }

    #goHome(detail) {
      if (this.machine.state === "home") return this.#requestSwitcher(detail);
      if (!this.machine.can(this.events.GO_HOME)) return false;
      const activeAppId = this.appEngine.activeAppId;
      const transition = this.machine.dispatch(this.events.GO_HOME, { source: "home-bar", ...detail });
      if (!transition.accepted) return false;
      if (activeAppId) this.appEngine.pause(activeAppId);
      this.#publish("home", { appId: activeAppId, ...detail });
      return true;
    }

    #requestSwitcher(detail) {
      if (this.machine.state !== "home" && this.machine.state !== "appOpen") return false;
      this.#publish("switcher", { appId: this.appEngine.activeAppId, ...detail });
      return true;
    }

    #publish(intent, detail) {
      this.screen.dispatchEvent(new CustomEvent("mercury:home-bar", {
        detail: Object.freeze({ intent, ...detail }),
      }));
    }
  }

  global.MercuryHomeBarController = MercuryHomeBarController;
})(window);

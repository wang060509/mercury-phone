(function exposeMercuryAppSwitcherController(global) {
  "use strict";

  class MercuryAppSwitcherController {
    constructor(options = {}) {
      const required = ["view", "screen", "machine", "events", "appEngine"];
      required.forEach((key) => { if (!options[key]) throw new Error(`AppSwitcherController requires ${key}.`); });
      this.view = options.view;
      this.screen = options.screen;
      this.machine = options.machine;
      this.events = options.events;
      this.appEngine = options.appEngine;
      this.onHomeBar = (event) => {
        if (event.detail?.intent === "switcher") this.open();
      };
      this.screen.addEventListener("mercury:home-bar", this.onHomeBar);
      this.unsubscribeState = this.machine.subscribe(() => {
        if (this.machine.state !== "appSwitcher") this.view.setVisible(false);
      });
      this.view.onSelect = (appId) => this.resume(appId);
      this.view.onDismiss = () => this.goHome();
      this.view.setVisible(false);
    }

    open() {
      if (this.machine.state !== "home" && this.machine.state !== "appOpen") return false;
      const activeAppId = this.appEngine.activeAppId;
      const transition = this.machine.dispatch(this.events.OPEN_APP_SWITCHER, { appId: activeAppId });
      if (!transition.accepted) return false;
      if (activeAppId) this.appEngine.pause(activeAppId);
      this.view.render(this.appEngine.listInstances(), activeAppId);
      this.view.setVisible(true);
      return true;
    }

    resume(appId) {
      if (this.machine.state !== "appSwitcher" || !this.appEngine.getInstance(appId)) return false;
      const transition = this.machine.dispatch(this.events.CLOSE_APP_SWITCHER, { appId });
      if (!transition.accepted) return false;
      this.appEngine.resume(appId);
      this.view.setVisible(false);
      return true;
    }

    goHome() {
      if (!this.machine.can(this.events.GO_HOME)) return false;
      const transition = this.machine.dispatch(this.events.GO_HOME, { source: "app-menu" });
      if (!transition.accepted) return false;
      this.view.setVisible(false);
      return true;
    }

    destroy() {
      this.screen.removeEventListener("mercury:home-bar", this.onHomeBar);
      this.unsubscribeState?.();
      this.unsubscribeState = null;
      this.view.destroy();
    }
  }

  global.MercuryAppSwitcherController = MercuryAppSwitcherController;
})(window);

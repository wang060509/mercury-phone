(function exposeMercuryContracts(global) {
  "use strict";

  const SYSTEM_STATES = Object.freeze({
    BOOTING: "booting",
    LOCKED: "locked",
    UNLOCKING: "unlocking",
    HOME: "home",
    APP_OPEN: "appOpen",
    OVERLAY_OPEN: "overlayOpen",
    APP_SWITCHER: "appSwitcher",
  });

  const APP_LIFECYCLE = Object.freeze(["onMount", "onPause", "onResume", "onUnmount"]);
  const WIDGET_SIZES = Object.freeze(["small", "medium", "large"]);

  function validateAppDefinition(app) {
    if (!app || typeof app !== "object") throw new TypeError("App definition must be an object.");
    if (!app.id || (!app.name && !app.nameKey) || (typeof app.render !== "function" && typeof app.create !== "function")) {
      throw new TypeError("App definitions require id, name or nameKey, and render(container, context) or create().");
    }
    return true;
  }

  function validateWidgetDefinition(widget) {
    if (!widget || typeof widget !== "object") throw new TypeError("Widget definition must be an object.");
    if (!widget.id || !widget.appId || !WIDGET_SIZES.includes(widget.size) || typeof widget.render !== "function") {
      throw new TypeError("Widget definitions require id, appId, a supported size, and render(container, context).");
    }
    return true;
  }

  global.MercuryContracts = Object.freeze({ SYSTEM_STATES, APP_LIFECYCLE, WIDGET_SIZES, validateAppDefinition, validateWidgetDefinition });
})(window);

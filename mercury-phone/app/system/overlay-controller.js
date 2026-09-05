(function exposeMercuryOverlayController(global) {
  "use strict";

  class MercuryOverlayController {
    constructor(options = {}) {
      const required = ["root", "screen", "machine", "events", "gestureManager", "notificationStore", "i18n", "brightnessLayer"];
      required.forEach((key) => { if (!options[key]) throw new Error(`OverlayController requires ${key}.`); });
      Object.assign(this, options);
      this.createElement = options.createElement || ((tag) => document.createElement(tag));
      this.controlPanel = this.root.querySelector("#controlCenter");
      this.notificationPanel = this.root.querySelector("#notificationCenter");
      this.brightness = this.root.querySelector("#brightnessControl");
      this.brightnessValue = this.root.querySelector("#brightnessValue");
      this.composer = this.root.querySelector("#notificationComposer");
      this.noteInput = this.root.querySelector("#notificationNote");
      this.list = this.root.querySelector("#notificationList");
      this.empty = this.root.querySelector("#notificationEmpty");
      this.clearButton = this.root.querySelector("#clearNotifications");
      this.activeType = null;
      this.storage = options.storage || null;
      this.brightnessStorageKey = "mercury.system.brightness";
      this.#bindControls();
      this.#bindGestures();
      this.unsubscribeState = this.machine.subscribe((transition, snapshot) => this.#syncState(transition, snapshot.state), { emitCurrent: true });
      this.unsubscribeNotifications = this.notificationStore.subscribe(() => this.#renderNotifications());
      this.unsubscribeLocale = this.i18n.subscribe(() => this.#renderNotifications());
      this.#restoreBrightness();
      this.#renderNotifications();
    }

    open(type) {
      if (!this.machine.can(this.events.OPEN_OVERLAY)) return false;
      return this.machine.dispatch(this.events.OPEN_OVERLAY, { type }).accepted;
    }

    close() {
      if (!this.machine.can(this.events.CLOSE_OVERLAY)) return false;
      return this.machine.dispatch(this.events.CLOSE_OVERLAY).accepted;
    }

    setBrightness(value) {
      const next = Math.max(20, Math.min(100, Number(value) || 100));
      this.brightness.value = String(next);
      this.brightnessValue.value = `${next}%`;
      this.brightnessValue.textContent = `${next}%`;
      this.brightnessLayer.style.opacity = String(((100 - next) / 100) * .62);
      try { this.storage?.setItem(this.brightnessStorageKey, String(next)); } catch {}
      return next;
    }

    destroy() {
      this.unregisterControl?.();
      this.unregisterNotifications?.();
      this.unregisterClose?.();
      this.unsubscribeState?.();
      this.unsubscribeNotifications?.();
      this.unsubscribeLocale?.();
      this.root.removeEventListener("keydown", this.onKeydown);
    }

    #bindControls() {
      this.brightness.addEventListener("input", (event) => this.setBrightness(event.target.value));
      this.composer.addEventListener("submit", (event) => {
        event.preventDefault();
        const body = this.noteInput.value.trim();
        if (!body) return;
        this.notificationStore.add({ kind: "note", title: this.i18n.t("notifications.noteTitle"), body });
        this.noteInput.value = "";
      });
      this.clearButton.addEventListener("click", () => this.notificationStore.clear());
      this.root.querySelectorAll("[data-overlay-close]").forEach((button) => button.addEventListener("click", () => this.close()));
      this.onKeydown = (event) => { if (event.key === "Escape") this.close(); };
      this.root.addEventListener("keydown", this.onKeydown);
    }

    #bindGestures() {
      const region = (event, side) => {
        if (event.target?.closest?.("[data-gesture-exclusion]")) return false;
        const bounds = this.screen.getBoundingClientRect();
        const localX = event.clientX - bounds.left;
        const localY = event.clientY - bounds.top;
        return localY <= 92 && (side === "right" ? localX >= bounds.width * .58 : localX < bounds.width * .58);
      };
      this.unregisterControl = this.gestureManager.registerSwipe(this.screen, { axis: "y", direction: "down", threshold: 44, canStart: (event) => region(event, "right"), onCommit: () => this.open("control") });
      this.unregisterNotifications = this.gestureManager.registerSwipe(this.screen, { axis: "y", direction: "down", threshold: 44, canStart: (event) => region(event, "left"), onCommit: () => this.open("notifications") });
      this.unregisterClose = this.gestureManager.registerSwipe(this.root, {
        axis: "y",
        direction: "up",
        threshold: 44,
        canStart: (event) => {
          const bounds = this.screen.getBoundingClientRect();
          return event.clientY - bounds.top >= bounds.height - 132;
        },
        onCommit: () => this.close(),
      });
    }

    #syncState(transition, state) {
      if (transition.event === this.events.OPEN_OVERLAY) this.activeType = transition.payload?.type || "notifications";
      const visible = state === "overlayOpen";
      this.root.setAttribute("aria-hidden", String(!visible));
      this.controlPanel.setAttribute("aria-hidden", String(!visible || this.activeType !== "control"));
      this.notificationPanel.setAttribute("aria-hidden", String(!visible || this.activeType !== "notifications"));
      if (!visible) this.activeType = null;
    }

    #renderNotifications() {
      this.list.replaceChildren();
      const items = this.notificationStore.list();
      this.empty.hidden = items.length > 0;
      this.clearButton.hidden = items.length === 0;
      items.forEach((item) => {
        const article = this.createElement("article");
        article.className = "notification-item mercury-glass";
        const icon = this.createElement("img");
        icon.src = `assets/icons/iconoir/${item.kind === "message" ? "chat-bubble" : "spark"}.svg`;
        icon.alt = "";
        const copy = this.createElement("span");
        const title = this.createElement("strong");
        const body = this.createElement("p");
        const time = this.createElement("time");
        title.textContent = item.title;
        body.textContent = item.body;
        time.textContent = new Intl.DateTimeFormat(this.i18n.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.createdAt));
        copy.append(title, body, time);
        const remove = this.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", this.i18n.t("notifications.remove"));
        remove.textContent = "×";
        remove.addEventListener("click", () => this.notificationStore.remove(item.id));
        article.append(icon, copy, remove);
        this.list.append(article);
      });
    }

    #restoreBrightness() {
      let value = 100;
      try { value = Number(this.storage?.getItem(this.brightnessStorageKey)) || 100; } catch {}
      this.setBrightness(value);
    }
  }

  global.MercuryOverlayController = MercuryOverlayController;
})(window);

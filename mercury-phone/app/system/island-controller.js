(function exposeMercuryIslandController(global) {
  "use strict";

  const ICONS = Object.freeze({ message: "chat-bubble", music: "music-double-note", timer: "timer", status: "spark" });

  class MercuryIslandController {
    constructor(options = {}) {
      if (!options.island || !options.systemServices || !options.i18n) throw new Error("IslandController requires island, systemServices, and i18n.");
      this.island = options.island;
      this.systemServices = options.systemServices;
      this.i18n = options.i18n;
      this.idle = this.island.querySelector("#islandIdle");
      this.compact = this.island.querySelector("#islandCompact");
      this.compactIcon = this.island.querySelector("#islandCompactIcon");
      this.compactText = this.island.querySelector("#islandCompactText");
      this.artIcon = this.island.querySelector("#islandArtIcon");
      this.title = this.island.querySelector("#islandTitle");
      this.detail = this.island.querySelector("#islandDetail");
      this.trailing = this.island.querySelector("#islandTrailing");
      this.activity = null;
      this.expanded = false;
      this.onClick = () => this.toggleExpanded();
      this.island.addEventListener("click", this.onClick);
      this.unsubscribeServices = this.systemServices.subscribe((event) => {
        if (event.type === "island:set" || event.type === "island:clear") this.refresh();
      });
      this.unsubscribeLocale = this.i18n.subscribe(() => this.refresh());
      this.refresh();
    }

    refresh() {
      this.activity = this.systemServices.getPreferredActivity();
      if (!this.activity) this.expanded = false;
      this.#render();
      return this.activity;
    }

    toggleExpanded(force = null) {
      this.expanded = force === null ? !this.expanded : Boolean(force);
      this.#render();
      return this.expanded;
    }

    destroy() {
      this.island.removeEventListener("click", this.onClick);
      this.unsubscribeServices?.();
      this.unsubscribeLocale?.();
    }

    #render() {
      const active = Boolean(this.activity);
      const kind = this.activity?.kind || "status";
      const icon = ICONS[kind] || ICONS.status;
      const title = active ? (this.activity.titleKey ? this.i18n.t(this.activity.titleKey) : this.activity.title) : "";
      const detail = active ? (this.activity.detailKey ? this.i18n.t(this.activity.detailKey) : this.activity.detail) : "";
      const compact = active ? (this.activity.compactKey ? this.i18n.t(this.activity.compactKey) : (this.activity.compact || title)) : "";
      this.island.dataset.state = active ? "active" : "idle";
      this.island.dataset.kind = kind;
      this.island.setAttribute("aria-expanded", String(this.expanded));
      this.island.setAttribute("aria-label", this.expanded
        ? this.i18n.t("island.collapse")
        : (active ? this.i18n.t("island.expand", { title }) : this.i18n.t("island.idle")));
      this.idle.hidden = active || this.expanded;
      this.compact.hidden = !active || this.expanded;
      if (!active) {
        if (this.expanded) {
          const idleIconPath = `assets/icons/iconoir/spark.svg`;
          this.artIcon.src = idleIconPath;
          this.title.textContent = this.i18n.t("system.name");
          this.detail.textContent = this.i18n.t("island.idleDetail");
          this.trailing.dataset.kind = "status";
        }
        return;
      }
      const iconPath = `assets/icons/iconoir/${icon}.svg`;
      this.compactIcon.src = iconPath;
      this.artIcon.src = iconPath;
      this.compactText.textContent = compact;
      this.title.textContent = title;
      this.detail.textContent = detail;
      this.trailing.dataset.kind = kind;
    }
  }

  global.MercuryIslandController = MercuryIslandController;
})(window);

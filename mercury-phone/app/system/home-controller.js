(function exposeMercuryHomeController(global) {
  "use strict";

  const DEFAULT_LAYOUT = Object.freeze({
    pages: Object.freeze([
      Object.freeze({
        id: "home",
        widgets: Object.freeze([
          Object.freeze({ id: "lumi", kind: "presence", icon: "flower", titleKey: "home.widgets.lumi.title", bodyKey: "home.widgets.lumi.body" }),
          Object.freeze({ id: "moments", kind: "photo", titleKey: "home.widgets.moments.title", bodyKey: "home.widgets.moments.body" }),
          Object.freeze({ id: "memory", kind: "memory", icon: "spark", titleKey: "home.widgets.memory.title", bodyKey: "home.widgets.memory.body" }),
        ]),
        apps: Object.freeze([
          Object.freeze({ id: "cinema", icon: "media-image", nameKey: "apps.cinema" }),
          Object.freeze({ id: "settings", icon: "settings", nameKey: "apps.settings" }),
          Object.freeze({ id: "archive", icon: "database", nameKey: "apps.archive" }),
        ]),
      }),
      Object.freeze({
        id: "personalize",
        widgets: Object.freeze([
          Object.freeze({ id: "customize", kind: "customize", icon: "view-grid", titleKey: "home.widgets.customize.title", bodyKey: "home.widgets.customize.body" }),
        ]),
        apps: Object.freeze([
          Object.freeze({ id: "calculator", icon: "calculator", nameKey: "apps.calculator" }),
          Object.freeze({ id: "timer", icon: "timer", nameKey: "apps.timer" }),
          Object.freeze({ id: "market", icon: "graph-up", nameKey: "apps.market", statusKey: "apps.comingSoon" }),
        ]),
      }),
    ]),
    dock: Object.freeze([
      Object.freeze({ id: "mercury-chat", icon: "chat-bubble", nameKey: "apps.mercuryChat" }),
      Object.freeze({ id: "camera", icon: "camera", nameKey: "apps.camera" }),
      Object.freeze({ id: "music", icon: "music-double-note", nameKey: "apps.music" }),
    ]),
  });

  class MercuryHomeController {
    constructor(options = {}) {
      const required = ["root", "machine", "gestureManager", "components", "i18n"];
      required.forEach((key) => { if (!options[key]) throw new Error(`HomeController requires ${key}.`); });
      this.root = options.root;
      this.machine = options.machine;
      this.gestureManager = options.gestureManager;
      this.components = options.components;
      this.i18n = options.i18n;
      this.layout = options.layout || DEFAULT_LAYOUT;
      this.onLaunch = options.onLaunch || (() => false);
      this.pageIndex = 0;
      this.#render();
      this.#bindInput();
      this.unsubscribeState = this.machine.subscribe((transition, snapshot) => this.#syncState(snapshot.state), { emitCurrent: true });
      this.unsubscribeLocale = this.i18n.subscribe(() => this.#render());
    }

    goToPage(index) {
      const next = Math.max(0, Math.min(Number(index), this.layout.pages.length - 1));
      if (next === this.pageIndex) return false;
      this.pageIndex = next;
      this.#syncPage();
      return true;
    }

    destroy() {
      this.unregisterLeft?.();
      this.unregisterRight?.();
      this.unsubscribeState?.();
      this.unsubscribeLocale?.();
      this.root.removeEventListener("keydown", this.onKeydown);
    }

    #render() {
      this.root.replaceChildren();
      const viewport = this.components.createElement("div");
      viewport.className = "home-pages";
      const track = this.components.createElement("div");
      track.className = "home-pages__track";
      this.layout.pages.forEach((page) => track.append(this.#renderPage(page)));
      viewport.append(track);
      this.track = track;

      const footer = this.components.createElement("div");
      footer.className = "home-footer";
      const indicator = this.components.createElement("div");
      indicator.className = "home-page-indicator";
      indicator.setAttribute("aria-label", this.i18n.t("home.pages"));
      this.layout.pages.forEach((page, index) => {
        const dot = this.components.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", this.i18n.t("home.page", { page: index + 1 }));
        dot.addEventListener("click", () => this.goToPage(index));
        indicator.append(dot);
      });
      this.indicator = indicator;
      footer.append(indicator, this.#renderDock());
      this.root.append(viewport, footer);
      this.#syncPage();
    }

    #renderPage(page) {
      const section = this.components.createElement("section");
      section.className = `home-page home-page--${page.id}`;
      section.dataset.pageId = page.id;
      const widgets = this.components.createElement("div");
      widgets.className = "home-widget-layout";
      page.widgets.forEach((widget) => widgets.append(this.#renderWidget(widget)));
      const apps = this.components.createElement("div");
      apps.className = "home-app-row";
      page.apps.forEach((app) => apps.append(this.components.appIcon({
        icon: app.icon,
        artwork: global.MercuryDesktopIconMap?.forApp(app.id) || "",
        name: this.i18n.t(app.nameKey),
        status: app.statusKey ? this.i18n.t(app.statusKey) : "",
        onLaunch: () => this.onLaunch(app.id),
      })));
      section.append(widgets, apps);
      return section;
    }

    #renderWidget(widget) {
      const button = this.components.createElement("button");
      button.type = "button";
      button.className = `home-widget home-widget--${widget.kind} mercury-glass`;
      button.setAttribute("aria-label", this.i18n.t(widget.titleKey));
      if (widget.kind === "photo") {
        const image = this.components.createElement("img");
        image.src = "assets/wallpapers/rain-window-leaves-v1.webp";
        image.alt = "";
        button.append(image);
      } else if (widget.icon) {
        const mark = this.components.createElement("span");
        mark.className = "home-widget__mark";
        mark.append(this.components.icon(widget.icon));
        button.append(mark);
      }
      const copy = this.components.createElement("span");
      copy.className = "home-widget__copy";
      const title = this.components.createElement("strong");
      title.textContent = this.i18n.t(widget.titleKey);
      const body = this.components.createElement("small");
      body.textContent = this.i18n.t(widget.bodyKey);
      copy.append(title, body);
      button.append(copy);
      return button;
    }

    #renderDock() {
      const dock = this.components.createElement("nav");
      dock.className = "home-dock mercury-glass";
      dock.setAttribute("aria-label", this.i18n.t("home.dock"));
      this.layout.dock.forEach((app) => dock.append(this.components.appIcon({
        icon: app.icon,
        artwork: global.MercuryDesktopIconMap?.forApp(app.id) || "",
        name: this.i18n.t(app.nameKey),
        onLaunch: () => this.onLaunch(app.id),
      })));
      return dock;
    }

    #bindInput() {
      this.unregisterLeft = this.gestureManager.registerSwipe(this.root, { axis: "x", direction: "left", threshold: 48, onCommit: () => this.goToPage(this.pageIndex + 1) });
      this.unregisterRight = this.gestureManager.registerSwipe(this.root, { axis: "x", direction: "right", threshold: 48, onCommit: () => this.goToPage(this.pageIndex - 1) });
      this.onKeydown = (event) => {
        if (event.key === "ArrowLeft") this.goToPage(this.pageIndex - 1);
        if (event.key === "ArrowRight") this.goToPage(this.pageIndex + 1);
      };
      this.root.addEventListener("keydown", this.onKeydown);
    }

    #syncPage() {
      if (!this.track || !this.indicator) return;
      this.track.style.transform = `translate3d(${-this.pageIndex * 100}%, 0, 0)`;
      [...this.indicator.children].forEach((dot, index) => dot.setAttribute("aria-current", index === this.pageIndex ? "page" : "false"));
    }

    #syncState(state) {
      const visible = state === "home";
      if (!visible && this.root.contains?.(global.document?.activeElement)) global.document.activeElement?.blur?.();
      this.root.inert = !visible;
      this.root.setAttribute("aria-hidden", String(!visible));
      this.root.tabIndex = visible ? 0 : -1;
    }
  }

  global.MercuryHomeController = MercuryHomeController;
  global.MercuryDefaultHomeLayout = DEFAULT_LAYOUT;
})(window);

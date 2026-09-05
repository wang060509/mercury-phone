(function exposeMercuryAppSwitcherView(global) {
  "use strict";

  class MercuryAppSwitcherView {
    constructor(options = {}) {
      const required = ["root", "i18n", "snapshotService"];
      required.forEach((key) => { if (!options[key]) throw new Error(`AppSwitcherView requires ${key}.`); });
      this.root = options.root;
      this.i18n = options.i18n;
      this.snapshotService = options.snapshotService;
      this.onSelect = options.onSelect || (() => {});
      this.onDismiss = options.onDismiss || (() => {});
      this.onBackgroundClick = (event) => {
        if (event.target === this.root) this.onDismiss();
      };
      this.root.addEventListener("click", this.onBackgroundClick);
    }

    render(instances, selectedAppId = null) {
      this.root.replaceChildren();
      const header = this.#element("header", "app-switcher__header");
      header.append(
        this.#element("span", "", this.i18n.t("switcher.eyebrow")),
        this.#element("h1", "", this.i18n.t("switcher.title")),
      );
      this.root.append(header);

      if (!instances.length) {
        const empty = this.#element("section", "app-switcher__empty mercury-glass");
        empty.append(
          this.#element("strong", "", this.i18n.t("switcher.emptyTitle")),
          this.#element("small", "", this.i18n.t("switcher.emptyBody")),
        );
        const home = this.#element("button", "app-switcher__home", this.i18n.t("switcher.goHome"));
        home.type = "button";
        home.addEventListener("click", this.onDismiss);
        empty.append(home);
        this.root.append(empty);
        return;
      }

      const deck = this.#element("div", "app-switcher__deck");
      const rail = this.#element("nav", "app-switcher__rail");
      rail.setAttribute("aria-label", this.i18n.t("switcher.tasks"));
      instances.forEach((record) => {
        const selected = record.appId === selectedAppId || (!selectedAppId && record === instances.at(-1));
        const card = this.#card(record, selected);
        deck.append(card);
        rail.append(this.#railItem(record, selected, card));
      });
      let selectionFrame = null;
      deck.addEventListener("scroll", () => {
        if (selectionFrame !== null) global.cancelAnimationFrame?.(selectionFrame);
        const update = () => {
          selectionFrame = null;
          const center = deck.scrollLeft + deck.clientWidth / 2;
          const cards = [...deck.children];
          const nearest = cards.reduce((best, card) => {
            const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
            return !best || distance < best.distance ? { card, distance } : best;
          }, null)?.card;
          if (nearest) this.#setSelected(nearest.dataset.appId, deck, rail);
        };
        selectionFrame = global.requestAnimationFrame ? global.requestAnimationFrame(update) : global.setTimeout(update, 0);
      }, { passive: true });
      this.root.append(deck, this.#element("p", "app-switcher__hint", this.i18n.t("switcher.hint")), rail);
    }

    setVisible(visible) {
      this.root.setAttribute("aria-hidden", String(!visible));
      this.root.inert = !visible;
    }

    destroy() {
      this.root.removeEventListener("click", this.onBackgroundClick);
      this.snapshotService.destroy();
    }

    #card(record, selected) {
      const card = this.#element("article", "app-switcher-card");
      card.dataset.appId = record.appId;
      if (selected) card.dataset.selected = "true";
      card.append(this.#element("h2", "app-switcher-card__name", this.#name(record)));
      const preview = this.#element("div", "app-switcher-card__preview mercury-glass");
      preview.setAttribute("role", "button");
      preview.tabIndex = 0;
      preview.setAttribute("aria-label", this.i18n.t("switcher.resumeApp", { app: this.#name(record) }));
      preview.append(this.snapshotService.create(record));
      preview.addEventListener("click", () => this.onSelect(record.appId));
      preview.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") this.onSelect(record.appId);
      });
      card.append(preview);
      return card;
    }

    #railItem(record, selected, card) {
      const button = this.#element("button", "app-switcher__rail-item");
      button.type = "button";
      button.dataset.appId = record.appId;
      if (selected) button.setAttribute("aria-current", "true");
      button.setAttribute("aria-label", this.i18n.t("switcher.showApp", { app: this.#name(record) }));
      const icon = this.#element("img", "");
      icon.src = global.MercuryDesktopIconMap?.forApp(record.appId) || `assets/icons/iconoir/${record.definition.icon || "spark"}.svg`;
      icon.alt = "";
      button.append(icon);
      button.addEventListener("click", () => {
        this.#setSelected(record.appId, card.parentElement, button.parentElement);
        card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      });
      return button;
    }

    #setSelected(appId, deck, rail) {
      [...deck.children].forEach((card) => {
        if (card.dataset.appId === appId) card.dataset.selected = "true";
        else delete card.dataset.selected;
      });
      [...rail.children].forEach((button) => {
        if (button.dataset.appId === appId) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
    }

    #name(record) {
      return this.i18n.t(record.definition.nameKey) || record.definition.name || record.appId;
    }

    #element(tag, className = "", text = "") {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }
  }

  global.MercuryAppSwitcherView = MercuryAppSwitcherView;
})(window);

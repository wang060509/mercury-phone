(function exposeMercurySystemComponents(global) {
  "use strict";

  class MercurySystemComponents {
    constructor(options = {}) {
      this.createElement = options.createElement || ((tag) => document.createElement(tag));
      this.iconBase = options.iconBase || "assets/icons/iconoir";
    }

    icon(name, label = "") {
      this.#assertIconName(name);
      const image = this.createElement("img");
      image.className = "sys-icon";
      image.src = `${this.iconBase}/${name}.svg`;
      image.alt = label;
      image.setAttribute("aria-hidden", label ? "false" : "true");
      return image;
    }

    iconButton({ icon, label, onPress, size = "regular" }) {
      if (!label) throw new TypeError("Icon buttons require an accessible label.");
      const button = this.createElement("button");
      button.type = "button";
      button.className = `sys-icon-button sys-icon-button--${size}`;
      button.setAttribute("aria-label", label);
      button.append(this.icon(icon));
      if (typeof onPress === "function") button.addEventListener("click", onPress);
      return button;
    }

    glassPanel({ className = "", label = "" } = {}) {
      const panel = this.createElement("section");
      panel.className = `sys-glass-panel mercury-glass ${className}`.trim();
      if (label) panel.setAttribute("aria-label", label);
      return panel;
    }

    list({ label, rows = [] }) {
      const list = this.createElement("div");
      list.className = "sys-list";
      if (label) list.setAttribute("aria-label", label);
      rows.forEach((row) => list.append(this.listRow(row)));
      return list;
    }

    listRow({ icon, label, detail = "", accessory = "chevron", onPress }) {
      if (!label) throw new TypeError("List rows require a label.");
      const interactive = typeof onPress === "function";
      const row = this.createElement(interactive ? "button" : "div");
      if (interactive) row.type = "button";
      row.className = "sys-list-row";
      if (icon) row.append(this.icon(icon));

      const copy = this.createElement("span");
      copy.className = "sys-list-row__copy";
      const title = this.createElement("span");
      title.className = "sys-list-row__label";
      title.textContent = label;
      copy.append(title);
      if (detail) {
        const secondary = this.createElement("small");
        secondary.textContent = detail;
        copy.append(secondary);
      }
      row.append(copy);
      if (accessory === "chevron") row.append(this.icon("nav-arrow-right"));
      if (interactive) row.addEventListener("click", onPress);
      return row;
    }

    toggle({ label, checked = false, onChange }) {
      if (!label) throw new TypeError("Toggles require an accessible label.");
      const button = this.createElement("button");
      button.type = "button";
      button.className = "sys-toggle";
      button.setAttribute("role", "switch");
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-checked", String(Boolean(checked)));
      const thumb = this.createElement("span");
      thumb.className = "sys-toggle__thumb";
      button.append(thumb);
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-checked") !== "true";
        button.setAttribute("aria-checked", String(next));
        if (typeof onChange === "function") onChange(next);
      });
      return button;
    }

    appIcon({ icon, artwork = "", name, badge = 0, status = "", onLaunch }) {
      if (!name) throw new TypeError("App icons require a name.");
      const button = this.createElement("button");
      button.type = "button";
      button.className = "sys-app-icon";
      button.setAttribute("aria-label", name);
      const tile = this.createElement("span");
      tile.className = "sys-app-icon__tile mercury-glass";
      if (artwork) {
        const image = this.createElement("img");
        image.className = "sys-app-icon__art";
        image.src = artwork;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        tile.append(image);
      } else {
        tile.append(this.icon(icon));
      }
      if (badge > 0) {
        const badgeNode = this.createElement("span");
        badgeNode.className = "sys-app-icon__badge";
        badgeNode.textContent = badge > 99 ? "99+" : String(badge);
        tile.append(badgeNode);
      }
      const caption = this.createElement("span");
      caption.className = "sys-app-icon__name";
      caption.textContent = name;
      button.append(tile, caption);
      if (status) {
        button.classList?.add("sys-app-icon--unavailable");
        button.setAttribute("aria-disabled", "true");
        button.setAttribute("aria-label", `${name} — ${status}`);
        const statusNode = this.createElement("small");
        statusNode.className = "sys-app-icon__status";
        statusNode.textContent = status;
        button.append(statusNode);
      } else if (typeof onLaunch === "function") button.addEventListener("click", onLaunch);
      return button;
    }

    keypadKey({ value, label = String(value), onPress }) {
      const button = this.createElement("button");
      button.type = "button";
      button.className = "sys-keypad-key";
      button.textContent = String(value);
      button.setAttribute("aria-label", label);
      if (typeof onPress === "function") button.addEventListener("click", () => onPress(value));
      return button;
    }

    #assertIconName(name) {
      if (typeof name !== "string" || !/^[a-z0-9-]+$/.test(name)) throw new TypeError("Invalid Iconoir icon name.");
    }
  }

  global.MercurySystemComponents = MercurySystemComponents;
})(window);

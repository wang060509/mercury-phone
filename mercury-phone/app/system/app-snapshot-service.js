(function exposeMercuryAppSnapshotService(global) {
  "use strict";

  class MercuryAppSnapshotService {
    constructor(options = {}) {
      this.sourceWidth = options.sourceWidth || 390;
      this.sourceHeight = options.sourceHeight || 786;
      this.resizeObserver = null;
    }

    create(record) {
      const viewport = document.createElement("div");
      viewport.className = "app-snapshot";
      const canvas = document.createElement("div");
      canvas.className = "app-snapshot__canvas";
      canvas.style.width = `${this.sourceWidth}px`;
      canvas.style.height = `${this.sourceHeight}px`;
      const clone = record.root.cloneNode(true);
      clone.hidden = false;
      clone.setAttribute("aria-hidden", "true");
      clone.inert = true;
      this.#sanitize(clone);
      canvas.append(clone);
      viewport.append(canvas);
      this.#observe(viewport, canvas);
      return viewport;
    }

    destroy() {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
    }

    #observe(viewport, canvas) {
      const update = () => {
        const width = viewport.clientWidth || viewport.getBoundingClientRect?.().width || 0;
        if (!width) return;
        const scale = Math.min(1, width / this.sourceWidth);
        canvas.style.transform = `translateX(-50%) scale(${scale})`;
        viewport.style.setProperty("--snapshot-height", `${this.sourceHeight * scale}px`);
      };
      if (typeof global.ResizeObserver === "function") {
        this.resizeObserver ||= new global.ResizeObserver((entries) => {
          entries.forEach((entry) => {
            const targetCanvas = entry.target.firstElementChild;
            if (!targetCanvas) return;
            const scale = Math.min(1, entry.contentRect.width / this.sourceWidth);
            targetCanvas.style.transform = `translateX(-50%) scale(${scale})`;
            entry.target.style.setProperty("--snapshot-height", `${this.sourceHeight * scale}px`);
          });
        });
        this.resizeObserver.observe(viewport);
      } else {
        global.setTimeout(update, 0);
      }
    }

    #sanitize(root) {
      const descendants = root.querySelectorAll ? [...root.querySelectorAll("*")] : [];
      const nodes = [root, ...descendants];
      nodes.forEach((node) => {
        node.removeAttribute?.("id");
        node.removeAttribute?.("for");
        node.removeAttribute?.("tabindex");
        if (node.matches?.("input, textarea, select")) {
          if (node.name === "apiKey" || node.type === "password") node.value = "";
          node.disabled = true;
          node.removeAttribute?.("name");
          node.setAttribute?.("aria-hidden", "true");
        }
        if (node.matches?.("button, a")) {
          node.setAttribute?.("tabindex", "-1");
          node.setAttribute?.("aria-hidden", "true");
        }
      });
    }
  }

  global.MercuryAppSnapshotService = MercuryAppSnapshotService;
})(window);

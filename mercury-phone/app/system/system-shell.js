(function exposeSystemShell(global) {
  "use strict";

  class SystemShell {
    constructor(root) {
      if (!root) throw new Error("SystemShell requires a screen root.");
      this.root = root;
      this.surface = root.querySelector("#systemSurface");
      this.sleeping = false;
    }

    mountSurface(node) {
      this.surface.replaceChildren(node);
    }

    setSleeping(nextValue) {
      this.sleeping = Boolean(nextValue);
      this.root.classList.toggle("is-sleeping", this.sleeping);
      return this.sleeping;
    }
  }

  global.MercurySystemShell = SystemShell;
})(window);

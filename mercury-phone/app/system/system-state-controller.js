(function exposeSystemStateController(global) {
  "use strict";

  class SystemStateController {
    constructor(machine, screen) {
      if (!machine || !screen) throw new Error("SystemStateController requires a state machine and screen.");
      this.machine = machine;
      this.screen = screen;
      this.unsubscribe = machine.subscribe((transition, snapshot) => {
        this.screen.dataset.systemState = snapshot.state;
        this.screen.dispatchEvent(new CustomEvent("mercury:system-state", { detail: transition }));
      }, { emitCurrent: true });
    }

    destroy() {
      this.unsubscribe?.();
      this.unsubscribe = null;
    }
  }

  global.MercurySystemStateController = SystemStateController;
})(window);

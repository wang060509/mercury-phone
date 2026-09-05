(function exposeMercuryLockController(global) {
  "use strict";

  class MercuryLockController {
    constructor(options = {}) {
      const required = ["machine", "events", "gestureManager", "components", "lockScreen", "passcodeScreen", "keypad", "dots", "message"];
      required.forEach((key) => { if (!options[key]) throw new Error(`LockController requires ${key}.`); });
      this.machine = options.machine;
      this.events = options.events;
      this.gestureManager = options.gestureManager;
      this.components = options.components;
      this.lockScreen = options.lockScreen;
      this.passcodeScreen = options.passcodeScreen;
      this.keypad = options.keypad;
      this.dots = options.dots;
      this.message = options.message;
      this.cancelButton = options.cancelButton || null;
      this.storage = options.storage || null;
      this.storageKey = options.storageKey || "mercury.system.lock";
      this.previewPasscode = options.previewPasscode || null;
      this.input = "";
      this.errorTimer = null;
      this.preferences = this.#loadPreferences();
      this.#renderKeypad();
      this.#renderDots();
      this.unregisterSwipe = this.gestureManager.registerSwipe(this.lockScreen, { direction: "up", threshold: 44, onCommit: () => this.requestUnlock() });
      this.onLockKeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowUp") return;
        event.preventDefault();
        this.requestUnlock();
      };
      this.lockScreen.addEventListener("keydown", this.onLockKeydown);
      this.cancelButton?.addEventListener("click", () => this.cancel());
      this.unsubscribe = this.machine.subscribe((transition, snapshot) => this.#sync(snapshot.state), { emitCurrent: true });
    }

    requestUnlock() {
      if (!this.machine.can(this.events.REQUEST_UNLOCK)) return false;
      this.machine.dispatch(this.events.REQUEST_UNLOCK);
      if (!this.preferences.enabled) this.machine.dispatch(this.events.UNLOCK_SUCCESS);
      return true;
    }

    cancel() {
      if (!this.machine.can(this.events.UNLOCK_CANCEL)) return false;
      this.#resetInput();
      this.machine.dispatch(this.events.UNLOCK_CANCEL);
      return true;
    }

    enterDigit(value) {
      if (this.machine.state !== "unlocking" || this.input.length >= 4 || !/^\d$/.test(String(value))) return false;
      this.input += String(value);
      this.#renderDots();
      if (this.input.length === 4) this.#verify();
      return true;
    }

    deleteDigit() {
      if (!this.input) return false;
      this.input = this.input.slice(0, -1);
      this.#renderDots();
      return true;
    }

    setPasscode(enabled, passcode = null) {
      if (enabled && !/^\d{4}$/.test(String(passcode))) throw new TypeError("Passcode must contain exactly four digits.");
      this.preferences = Object.freeze({ enabled: Boolean(enabled), passcode: enabled ? String(passcode) : null });
      this.#savePreferences();
      return this.preferences;
    }

    destroy() {
      global.clearTimeout(this.errorTimer);
      this.unregisterSwipe?.();
      this.lockScreen.removeEventListener("keydown", this.onLockKeydown);
      this.unsubscribe?.();
    }

    #verify() {
      if (this.input === this.preferences.passcode) {
        this.message.textContent = "";
        this.machine.dispatch(this.events.UNLOCK_SUCCESS);
        this.#resetInput();
        return;
      }
      this.passcodeScreen.classList.add("has-error");
      this.message.textContent = this.message.dataset.errorText || "Passcode not recognized";
      global.clearTimeout(this.errorTimer);
      this.errorTimer = global.setTimeout(() => {
        this.passcodeScreen.classList.remove("has-error");
        this.#resetInput();
      }, 460);
    }

    #renderKeypad() {
      const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      order.forEach((value) => this.keypad.append(this.components.keypadKey({ value, onPress: (digit) => this.enterDigit(digit) })));
      const spacer = this.components.createElement("span");
      spacer.setAttribute("aria-hidden", "true");
      this.keypad.append(spacer, this.components.keypadKey({ value: 0, onPress: (digit) => this.enterDigit(digit) }));
      const remove = this.components.iconButton({ icon: "nav-arrow-left", label: "Delete digit", size: "compact", onPress: () => this.deleteDigit() });
      remove.classList.add("passcode-delete");
      this.keypad.append(remove);
    }

    #renderDots() {
      [...this.dots.children].forEach((dot, index) => dot.classList.toggle("is-filled", index < this.input.length));
    }

    #resetInput() {
      this.input = "";
      this.message.textContent = "";
      this.#renderDots();
    }

    #sync(state) {
      const unlocking = state === "unlocking";
      this.lockScreen.setAttribute("aria-hidden", String(unlocking || state === "home"));
      this.lockScreen.tabIndex = state === "locked" ? 0 : -1;
      this.passcodeScreen.setAttribute("aria-hidden", String(!unlocking));
      if (!unlocking) this.#resetInput();
    }

    #loadPreferences() {
      if (/^\d{4}$/.test(String(this.previewPasscode || ""))) return Object.freeze({ enabled: true, passcode: String(this.previewPasscode) });
      try {
        const stored = JSON.parse(this.storage?.getItem(this.storageKey) || "null");
        if (stored?.enabled && /^\d{4}$/.test(String(stored.passcode))) return Object.freeze({ enabled: true, passcode: String(stored.passcode) });
      } catch {}
      return Object.freeze({ enabled: false, passcode: null });
    }

    #savePreferences() {
      try { this.storage?.setItem(this.storageKey, JSON.stringify(this.preferences)); } catch {}
    }
  }

  global.MercuryLockController = MercuryLockController;
})(window);

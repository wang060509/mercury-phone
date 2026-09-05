(function exposeMercuryStateMachine(global) {
  "use strict";

  const S = global.MercuryContracts.SYSTEM_STATES;
  const E = global.MercuryEvents;
  const RETURN_TO_ORIGIN = "__RETURN_TO_ORIGIN__";

  const TRANSITIONS = Object.freeze({
    [S.BOOTING]: Object.freeze({ [E.BOOT_COMPLETE]: S.LOCKED }),
    [S.LOCKED]: Object.freeze({ [E.REQUEST_UNLOCK]: S.UNLOCKING, [E.OPEN_OVERLAY]: S.OVERLAY_OPEN }),
    [S.UNLOCKING]: Object.freeze({ [E.UNLOCK_SUCCESS]: S.HOME, [E.UNLOCK_CANCEL]: S.LOCKED }),
    [S.HOME]: Object.freeze({ [E.OPEN_APP]: S.APP_OPEN, [E.OPEN_APP_SWITCHER]: S.APP_SWITCHER, [E.OPEN_OVERLAY]: S.OVERLAY_OPEN, [E.LOCK]: S.LOCKED }),
    [S.APP_OPEN]: Object.freeze({
      [E.OPEN_APP]: S.APP_OPEN,
      [E.GO_HOME]: S.HOME,
      [E.OPEN_OVERLAY]: S.OVERLAY_OPEN,
      [E.OPEN_APP_SWITCHER]: S.APP_SWITCHER,
      [E.LOCK]: S.LOCKED,
    }),
    [S.OVERLAY_OPEN]: Object.freeze({ [E.CLOSE_OVERLAY]: RETURN_TO_ORIGIN, [E.LOCK]: S.LOCKED }),
    [S.APP_SWITCHER]: Object.freeze({
      [E.CLOSE_APP_SWITCHER]: S.APP_OPEN,
      [E.GO_HOME]: S.HOME,
      [E.LOCK]: S.LOCKED,
    }),
  });

  class SystemStateMachine {
    constructor(initialState = S.BOOTING) {
      if (!TRANSITIONS[initialState]) throw new Error(`Unknown initial system state: ${initialState}`);
      this.state = initialState;
      this.listeners = new Set();
      this.overlayReturnState = null;
      this.history = Object.freeze([{ from: null, event: "INIT", to: initialState }]);
    }

    can(event) {
      return Boolean(TRANSITIONS[this.state]?.[event]);
    }

    dispatch(event, payload = null) {
      const transitionTarget = TRANSITIONS[this.state]?.[event];
      if (!transitionTarget) {
        return Object.freeze({ accepted: false, state: this.state, event, reason: "ILLEGAL_TRANSITION" });
      }

      const previousState = this.state;
      if (event === E.OPEN_OVERLAY) this.overlayReturnState = previousState;
      const nextState = transitionTarget === RETURN_TO_ORIGIN ? (this.overlayReturnState || S.HOME) : transitionTarget;
      if (event === E.CLOSE_OVERLAY || event === E.LOCK) this.overlayReturnState = null;
      this.state = nextState;
      const transition = Object.freeze({ accepted: true, from: previousState, to: nextState, event, payload });
      this.history = Object.freeze([...this.history, transition]);
      this.listeners.forEach((listener) => listener(transition, this.snapshot()));
      return transition;
    }

    subscribe(listener, options = {}) {
      if (typeof listener !== "function") throw new TypeError("State listeners must be functions.");
      this.listeners.add(listener);
      if (options.emitCurrent) listener(Object.freeze({ accepted: true, from: null, to: this.state, event: "SUBSCRIBE", payload: null }), this.snapshot());
      return () => this.listeners.delete(listener);
    }

    snapshot() {
      return Object.freeze({ state: this.state, history: this.history });
    }
  }

  global.MercurySystemStateMachine = SystemStateMachine;
  global.MercurySystemTransitions = TRANSITIONS;
})(window);

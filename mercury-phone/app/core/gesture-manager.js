(function exposeMercuryGestureManager(global) {
  "use strict";

  class MercuryGestureManager {
    constructor() { this.registrations = new Set(); }

    registerSwipe(element, options = {}) {
      if (!element) throw new Error("Swipe gestures require a target element.");
      const axis = options.axis || "y";
      const direction = options.direction || (axis === "y" ? "up" : "left");
      const threshold = options.threshold || 46;
      let start = null;

      const onStart = (event) => {
        if (event.isPrimary === false) return;
        if (typeof options.canStart === "function" && !options.canStart(event)) return;
        start = { x: event.clientX, y: event.clientY, id: event.pointerId, captured: false };
      };
      const onMove = (event) => {
        if (!start || start.captured || (start.id !== undefined && event.pointerId !== undefined && start.id !== event.pointerId)) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const primary = axis === "y" ? Math.abs(dy) : Math.abs(dx);
        const cross = axis === "y" ? Math.abs(dx) : Math.abs(dy);
        if (primary < 7 || cross > primary) return;
        if (event.pointerId !== undefined && typeof element.setPointerCapture === "function") {
          element.setPointerCapture(event.pointerId);
          start.captured = true;
        }
      };
      const onEnd = (event) => {
        if (!start || (start.id !== undefined && event.pointerId !== undefined && start.id !== event.pointerId)) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const primary = axis === "y" ? dy : dx;
        const cross = axis === "y" ? dx : dy;
        const signed = (direction === "up" || direction === "left") ? -primary : primary;
        if (event.pointerId !== undefined && typeof element.releasePointerCapture === "function" && element.hasPointerCapture?.(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
        start = null;
        if (signed < threshold || Math.abs(cross) > Math.abs(primary) * .72) return;
        options.onCommit?.(Object.freeze({ axis, direction, distance: signed }));
      };
      const onCancel = (event) => {
        if (event.pointerId !== undefined && typeof element.releasePointerCapture === "function" && element.hasPointerCapture?.(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
        start = null;
      };

      element.addEventListener("pointerdown", onStart);
      element.addEventListener("pointermove", onMove);
      element.addEventListener("pointerup", onEnd);
      element.addEventListener("pointercancel", onCancel);
      const unregister = () => {
        element.removeEventListener("pointerdown", onStart);
        element.removeEventListener("pointermove", onMove);
        element.removeEventListener("pointerup", onEnd);
        element.removeEventListener("pointercancel", onCancel);
        this.registrations.delete(unregister);
      };
      this.registrations.add(unregister);
      return unregister;
    }

    registerEdgeSwipe(element, options = {}) {
      if (!element) throw new Error("Edge gestures require a target element.");
      const edge = options.edge || "bottom";
      const edgeSize = options.edgeSize || 42;
      const threshold = options.threshold || 52;
      const holdDelay = options.holdDelay || 360;
      let start = null;
      let holdTimer = null;
      let generation = 0;

      const clearHold = () => {
        if (holdTimer !== null) global.clearTimeout(holdTimer);
        holdTimer = null;
      };
      const release = (pointerId) => {
        if (pointerId !== undefined && typeof element.releasePointerCapture === "function" && element.hasPointerCapture?.(pointerId)) {
          element.releasePointerCapture(pointerId);
        }
      };
      const reset = (notify = false) => {
        const pointerId = start?.id;
        clearHold();
        release(pointerId);
        start = null;
        generation += 1;
        if (notify) options.onCancel?.();
      };
      const withinEdge = (event) => {
        const bounds = element.getBoundingClientRect?.();
        if (!bounds) return true;
        if (edge === "bottom") return event.clientY >= bounds.bottom - edgeSize;
        if (edge === "top") return event.clientY <= bounds.top + edgeSize;
        if (edge === "left") return event.clientX <= bounds.left + edgeSize;
        return event.clientX >= bounds.right - edgeSize;
      };
      const distance = (event) => {
        if (!start) return 0;
        if (edge === "bottom") return start.y - event.clientY;
        if (edge === "top") return event.clientY - start.y;
        if (edge === "left") return event.clientX - start.x;
        return start.x - event.clientX;
      };

      const onStart = (event) => {
        if (event.isPrimary === false || !withinEdge(event)) return;
        if (typeof options.canStart === "function" && !options.canStart(event)) return;
        event.preventDefault?.();
        if (start) reset(true);
        const session = ++generation;
        start = { x: event.clientX, y: event.clientY, id: event.pointerId, armed: false, held: false, invalid: false, lastEvent: event, session };
        if (event.pointerId !== undefined && typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
        options.onStart?.();
      };
      const onMove = (event) => {
        if (!start || (start.id !== undefined && event.pointerId !== undefined && start.id !== event.pointerId)) return;
        event.preventDefault?.();
        start.lastEvent = event;
        const travelled = distance(event);
        const cross = (edge === "bottom" || edge === "top") ? Math.abs(event.clientX - start.x) : Math.abs(event.clientY - start.y);
        if (cross > Math.max(24, travelled * .72)) {
          start.invalid = true;
          clearHold();
          return;
        }
        if (start.invalid) return;
        options.onProgress?.(Math.max(0, travelled));
        if (travelled < threshold || start.armed) return;
        start.armed = true;
        const session = start.session;
        const pointerId = start.id;
        holdTimer = global.setTimeout(() => {
          holdTimer = null;
          if (!start || start.session !== session || start.id !== pointerId || start.held || start.invalid) return;
          start.held = true;
          options.onHoldCommit?.(Object.freeze({ edge, distance: distance(start.lastEvent) }));
        }, holdDelay);
      };
      const onEnd = (event) => {
        if (!start || (start.id !== undefined && event.pointerId !== undefined && start.id !== event.pointerId)) return;
        const travelled = distance(event);
        const held = start.held;
        const invalid = start.invalid;
        clearHold();
        release(start.id);
        start = null;
        generation += 1;
        if (!held && !invalid && travelled >= threshold) options.onCommit?.(Object.freeze({ edge, distance: travelled }));
        options.onEnd?.(Object.freeze({ edge, distance: Math.max(0, travelled), held }));
      };
      const onCancel = (event) => {
        if (!start || (event.pointerId !== undefined && start.id !== undefined && event.pointerId !== start.id)) return;
        reset(true);
      };
      const onLostCapture = (event) => {
        if (!start || (event.pointerId !== undefined && start.id !== undefined && event.pointerId !== start.id)) return;
        clearHold();
        start = null;
        generation += 1;
        options.onCancel?.();
      };
      const onBlur = () => { if (start) reset(true); };

      element.addEventListener("pointerdown", onStart);
      element.addEventListener("pointermove", onMove);
      element.addEventListener("pointerup", onEnd);
      element.addEventListener("pointercancel", onCancel);
      element.addEventListener("lostpointercapture", onLostCapture);
      global.addEventListener?.("blur", onBlur);
      const unregister = () => {
        reset(false);
        element.removeEventListener("pointerdown", onStart);
        element.removeEventListener("pointermove", onMove);
        element.removeEventListener("pointerup", onEnd);
        element.removeEventListener("pointercancel", onCancel);
        element.removeEventListener("lostpointercapture", onLostCapture);
        global.removeEventListener?.("blur", onBlur);
        this.registrations.delete(unregister);
      };
      this.registrations.add(unregister);
      return unregister;
    }

    destroy() {
      [...this.registrations].forEach((unregister) => unregister());
    }
  }

  global.MercuryGestureManager = MercuryGestureManager;
})(window);

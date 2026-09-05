(function exposeMercuryGenerationProfileFlow(global) {
  "use strict";

  const VIEWS = Object.freeze({ CABINET: "cabinet", DETAIL: "detail" });
  const OVERLAYS = Object.freeze({ ACTIONS: "actions", COVER_PREVIEW: "cover-preview" });
  const EVENTS = Object.freeze({
    OPEN_CABINET: "OPEN_CABINET",
    OPEN_DETAIL: "OPEN_DETAIL",
    OPEN_ACTIONS: "OPEN_ACTIONS",
    CLOSE_OVERLAY: "CLOSE_OVERLAY",
    PREVIEW_COVER: "PREVIEW_COVER",
    CANCEL_COVER: "CANCEL_COVER",
    SAVE_COVER: "SAVE_COVER",
    UPDATE_COVER: "UPDATE_COVER",
    RELOAD: "RELOAD",
  });

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const flowError = (code, message, cause) => Object.assign(new Error(message), { code, cause });

  class MercuryGenerationProfileFlow {
    constructor(options = {}) {
      if (!options.store || typeof options.store.get !== "function" || typeof options.store.list !== "function") {
        throw flowError("GENERATION_PROFILE_FLOW_INVALID_STORE", "Generation Profile Flow requires a Profile store.");
      }
      this.store = options.store;
      this.listeners = new Set();
      this.state = {
        view: VIEWS.CABINET,
        selectedProfileId: null,
        overlay: null,
        overlayProfileId: null,
        coverDraft: null,
      };
      if (options.selectedProfileId) this.dispatch({ type: EVENTS.OPEN_DETAIL, profileId: options.selectedProfileId });
    }

    snapshot() {
      const selectedProfile = this.state.selectedProfileId ? this.store.get(this.state.selectedProfileId) : null;
      const overlayProfile = this.state.overlayProfileId ? this.store.get(this.state.overlayProfileId) : null;
      return Object.freeze({
        view: this.state.view,
        selectedProfileId: this.state.selectedProfileId,
        selectedProfile,
        overlay: this.state.overlay,
        overlayProfileId: this.state.overlayProfileId,
        overlayProfile,
        coverDraft: this.state.coverDraft ? Object.freeze(clone(this.state.coverDraft)) : null,
      });
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Generation Profile Flow listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    dispatch(event = {}) {
      const type = String(event.type || "");
      let changed = false;
      switch (type) {
        case EVENTS.OPEN_CABINET:
          changed = this.#replaceState({ view: VIEWS.CABINET, selectedProfileId: null, overlay: null, overlayProfileId: null, coverDraft: null });
          break;
        case EVENTS.OPEN_DETAIL: {
          const profile = this.#profile(event.profileId);
          changed = this.#replaceState({ view: VIEWS.DETAIL, selectedProfileId: profile.id, overlay: null, overlayProfileId: null, coverDraft: null });
          break;
        }
        case EVENTS.OPEN_ACTIONS: {
          const profile = this.#profile(event.profileId);
          changed = this.#replaceState({ ...this.state, overlay: OVERLAYS.ACTIONS, overlayProfileId: profile.id, coverDraft: null });
          break;
        }
        case EVENTS.CLOSE_OVERLAY:
        case EVENTS.CANCEL_COVER:
          changed = this.#replaceState({ ...this.state, overlay: null, overlayProfileId: null, coverDraft: null });
          break;
        case EVENTS.PREVIEW_COVER: {
          const profile = this.#editableProfile(event.profileId);
          const dataUrl = String(event.dataUrl || "");
          if (!/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(dataUrl)) {
            throw flowError("GENERATION_PROFILE_FLOW_INVALID_COVER", "Generation Profile covers must be supported image Data URLs.");
          }
          changed = this.#replaceState({
            ...this.state,
            overlay: OVERLAYS.COVER_PREVIEW,
            overlayProfileId: profile.id,
            coverDraft: { profileId: profile.id, dataUrl },
          });
          break;
        }
        case EVENTS.SAVE_COVER: {
          const draft = this.state.coverDraft;
          if (!draft || this.state.overlay !== OVERLAYS.COVER_PREVIEW) {
            throw flowError("GENERATION_PROFILE_FLOW_NO_COVER_DRAFT", "There is no Generation Profile cover draft to save.");
          }
          this.#writeCover(draft.profileId, { kind: "data-url", value: draft.dataUrl });
          changed = this.#replaceState({ ...this.state, overlay: null, overlayProfileId: null, coverDraft: null });
          break;
        }
        case EVENTS.UPDATE_COVER:
          this.#writeCover(event.profileId, event.cover);
          changed = this.#replaceState({ ...this.state, overlay: null, overlayProfileId: null, coverDraft: null });
          break;
        case EVENTS.RELOAD:
          this.store.reload?.();
          changed = this.#reconcile();
          break;
        default:
          throw flowError("GENERATION_PROFILE_FLOW_UNKNOWN_EVENT", `Unknown Generation Profile Flow event: ${type || "(empty)"}.`);
      }
      const snapshot = this.snapshot();
      if (changed) this.listeners.forEach((listener) => listener(snapshot, Object.freeze({ ...event })));
      return snapshot;
    }

    openCabinet() { return this.dispatch({ type: EVENTS.OPEN_CABINET }); }
    openDetail(profileId) { return this.dispatch({ type: EVENTS.OPEN_DETAIL, profileId }); }
    back() { return this.state.view === VIEWS.DETAIL ? this.openCabinet() : this.snapshot(); }
    openActions(profileId) { return this.dispatch({ type: EVENTS.OPEN_ACTIONS, profileId }); }
    closeOverlay() { return this.dispatch({ type: EVENTS.CLOSE_OVERLAY }); }
    previewCover(profileId, dataUrl) { return this.dispatch({ type: EVENTS.PREVIEW_COVER, profileId, dataUrl }); }
    cancelCover() { return this.dispatch({ type: EVENTS.CANCEL_COVER }); }
    saveCover() { return this.dispatch({ type: EVENTS.SAVE_COVER }); }
    updateCover(profileId, cover) { return this.dispatch({ type: EVENTS.UPDATE_COVER, profileId, cover }); }
    reload() { return this.dispatch({ type: EVENTS.RELOAD }); }

    #profile(profileId) {
      const id = String(profileId || "").trim();
      const profile = id ? this.store.get(id) : null;
      if (!profile) throw flowError("GENERATION_PROFILE_FLOW_PROFILE_NOT_FOUND", `Generation Profile "${id}" was not found.`);
      return profile;
    }

    #editableProfile(profileId) {
      const profile = this.#profile(profileId);
      if (profile.readOnly) throw flowError("GENERATION_PROFILE_FLOW_READ_ONLY", `Generation Profile "${profile.id}" is read-only.`);
      return profile;
    }

    #writeCover(profileId, cover) {
      const profile = this.#editableProfile(profileId);
      return this.store.add({ ...profile, cover: clone(cover) });
    }

    #reconcile() {
      const selectedExists = !this.state.selectedProfileId || Boolean(this.store.get(this.state.selectedProfileId));
      const overlayExists = !this.state.overlayProfileId || Boolean(this.store.get(this.state.overlayProfileId));
      if (!selectedExists) return this.#replaceState({ view: VIEWS.CABINET, selectedProfileId: null, overlay: null, overlayProfileId: null, coverDraft: null });
      if (!overlayExists) return this.#replaceState({ ...this.state, overlay: null, overlayProfileId: null, coverDraft: null });
      return false;
    }

    #replaceState(next) {
      const changed = JSON.stringify(this.state) !== JSON.stringify(next);
      this.state = next;
      return changed;
    }
  }

  const api = Object.freeze({ MercuryGenerationProfileFlow, VIEWS, OVERLAYS, EVENTS });
  global.MercuryGenerationProfileFlow = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

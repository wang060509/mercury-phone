(function exposeMercuryCinemaApp(global) {
  "use strict";

  const ICON_ROOT = "assets/icons/iconoir";
  const iconPath = (name) => `${ICON_ROOT}/${name}.svg`;
  const pad = (value) => String(value).padStart(2, "0");
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const DEFAULT_HISTORY_PRESENTATION = Object.freeze({
    id: "mercury-history-default",
    paperTexture: "../assets/cinema/history-paper-fiber.webp",
    bodyTexture: "../assets/cinema/history-dark-textile.webp",
    transitionTexture: "../assets/cinema/history-transition-alpha.webp",
  });
  const briefText = (value, fallback = "角色档案", limit = 72) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) return fallback;
    return normalized.length > limit ? `${normalized.slice(0, limit).trim()}…` : normalized;
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GLYPH_SHAPES = Object.freeze({
    back: [["path", { d: "M15.5 4.5 6 12l9.5 7.5" }], ["path", { d: "M6 12h14" }]],
    ellipsis: [["circle", { cx: "12", cy: "5", r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: "12", cy: "12", r: ".9", fill: "currentColor", stroke: "none" }], ["circle", { cx: "12", cy: "19", r: ".9", fill: "currentColor", stroke: "none" }]],
    "arrow-east": [["path", { d: "M3 12h17" }], ["path", { d: "m14 6 6 6-6 6" }]],
    registration: [["path", { d: "M12 2v7M12 15v7M2 12h7M15 12h7" }]],
    diamond: [["path", { d: "M12 3c.9 5.1 3.9 8.1 9 9-5.1.9-8.1 3.9-9 9-.9-5.1-3.9-8.1-9-9 5.1-.9 8.1-3.9 9-9Z" }]],
    "star-axis": [["path", { d: "M12 1.5c.48 6.38 1.08 9.42 5.8 10.5-4.72 1.08-5.32 4.12-5.8 10.5-.48-6.38-1.08-9.42-5.8-10.5 4.72-1.08 5.32-4.12 5.8-10.5Z", fill: "currentColor", stroke: "none" }]],
    "star-small": [["path", { d: "M12 4.25c.38 4.55 1.2 6.82 5.55 7.75-4.35.93-5.17 3.2-5.55 7.75-.38-4.55-1.2-6.82-5.55-7.75 4.35-.93 5.17-3.2 5.55-7.75Z", fill: "currentColor", stroke: "none" }]],
    "registration-cross": [["path", { d: "M12 2v7M12 15v7M2 12h7M15 12h7" }], ["rect", { x: "10.35", y: "10.35", width: "3.3", height: "3.3", transform: "rotate(45 12 12)", fill: "currentColor", stroke: "none" }]],
    "diamond-point": [["path", { d: "M12 5.25c.54 3.83 2.92 6.21 6.75 6.75-3.83.54-6.21 2.92-6.75 6.75-.54-3.83-2.92-6.21-6.75-6.75 3.83-.54 6.21-2.92 6.75-6.75Z", fill: "currentColor", stroke: "none" }]],
    orbit: [["ellipse", { cx: "12", cy: "12", rx: "9", ry: "6.1", transform: "rotate(-24 12 12)" }], ["circle", { cx: "5.7", cy: "6.8", r: "1.15", fill: "currentColor", stroke: "none" }]],
    location: [["path", { d: "M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" }], ["circle", { cx: "12", cy: "10", r: "1.8" }]],
    edit: [["path", { d: "m5 16.5-.8 3.3 3.3-.8L18.4 8.1l-2.5-2.5L5 16.5Z" }], ["path", { d: "m14.4 7.1 2.5 2.5" }], ["path", { d: "M4 21h16" }]],
    warning: [["path", { d: "M12 3.6 21 20H3L12 3.6Z" }], ["path", { d: "M12 9v5" }], ["circle", { cx: "12", cy: "17", r: ".7", fill: "currentColor", stroke: "none" }]],
    close: [["path", { d: "m6 6 12 12M18 6 6 18" }]],
    worlds: [["circle", { cx: "10.5", cy: "12.5", r: "4.25" }], ["ellipse", { cx: "12", cy: "12", rx: "9", ry: "6.5", transform: "rotate(-24 12 12)" }], ["circle", { cx: "18.75", cy: "6.75", r: "1.125" }], ["path", { d: "m4.25 17.25-1.25.5M19.5 15.5l1.5.5" }]],
    programme: [["path", { d: "M6 19V5h9v14M9 19l-3.5-1.5M15 5l3.5 1.5V19M12 7l4 2v12.5l-4-2" }], ["path", { d: "M7 19h4M16.5 19H19" }]],
    cast: [["circle", { cx: "9", cy: "7", r: "2" }], ["path", { d: "M5.5 19.5V13c0-2.5 1.5-4 3.5-4s3.5 1.5 3.5 4v6.5h-7Z" }], ["path", { d: "M13.5 10.5c.7-.9 1.6-1.35 2.6-1.35 2 0 3.4 1.6 3.4 4v6.35H14" }], ["path", { d: "M13.75 5.75h4.5M17 4l1.5 1.75L17 7.5" }]],
  });

  function buildCharacterAdaptationModel(draft, stage) {
    const character = draft?.characterSnapshot || {};
    const variant = draft?.variant || {};
    const sources = [
      ["stableTraits", character.stableTraits],
      ["values", character.values],
      ["boundaries", character.boundaries],
      ["motivations", character.motivations],
    ];
    const seen = new Set();
    const coreItems = [];
    sources.forEach(([source, values]) => {
      (Array.isArray(values) ? values : []).forEach((value) => {
        const text = briefText(value, "", 34);
        const key = text.toLocaleLowerCase();
        if (!text || seen.has(key) || coreItems.length >= 3) return;
        seen.add(key);
        coreItems.push({ source, text });
      });
    });
    if (!coreItems.length) {
      const fallback = briefText(character.summary || character.identity, "角色档案尚未记录可列出的稳定核心。", 34);
      coreItems.push({ source: character.summary ? "summary" : character.identity ? "identity" : "missing", text: fallback });
    }
    const worldTitle = briefText(stage?.title, "当前世界", 16);
    const characterName = briefText(character.displayName, "未命名角色", 16);
    const interpretation = briefText(character.stableTraits?.[0] || character.summary || character.identity, "角色理解仍待补充。", 12);
    const correction = variant.expression
      ? "本场表达已校准。"
      : "本场表达仍待校准。";
    return {
      characterName,
      worldTitle,
      identityLine: `${characterName} × ${worldTitle}`,
      coreItems,
      fields: [
        { key: "worldIdentity", label: "身份", value: String(variant.worldIdentity || ""), source: "variant.worldIdentity" },
        { key: "contextBackground", label: "经历", value: String(variant.contextBackground || ""), source: "variant.contextBackground" },
        { key: "expression", label: "表现", value: String(variant.expression || ""), source: "variant.expression" },
      ],
      notes: [
        { className: "cinema-adaptation__hand-note--interpretation", source: character.stableTraits?.length ? "characterSnapshot.stableTraits" : character.summary ? "characterSnapshot.summary" : "characterSnapshot.identity", text: interpretation },
        { className: "cinema-adaptation__hand-note--world", source: "presentation-question", text: `进入${worldTitle}后，他如何行动？` },
        { className: "cinema-adaptation__hand-note--correction", source: "variant.expression", text: correction },
      ],
    };
  }

  function createSvgElement(tag) {
    return typeof document.createElementNS === "function" ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  }

  function programmeProjection() {
    return global.MercuryCinemaProgrammeProjection
      || (typeof require === "function" ? require("../core/cinema-programme-projection.js") : null);
  }

  function libraryProjection() {
    return global.MercuryCinemaLibraryProjection
      || (typeof require === "function" ? require("../core/cinema-library-projection.js") : null);
  }

  function intermissionProjection() {
    return global.MercuryCinemaIntermissionProjection
      || (typeof require === "function" ? require("../core/cinema-intermission-projection.js") : null);
  }

  function creditsProjection() {
    return global.MercuryCinemaCreditsProjection
      || (typeof require === "function" ? require("../core/cinema-credits-projection.js") : null);
  }

  function historyProjection() {
    return global.MercuryCinemaHistoryProjection
      || (typeof require === "function" ? require("../core/cinema-history-projection.js") : null);
  }

  function programmeArchiveProjection() {
    return global.MercuryCinemaProgrammeArchiveProjection
      || (typeof require === "function" ? require("../core/cinema-programme-archive-projection.js") : null);
  }

  function fontCoverage() {
    return global.MercuryCinemaFontCoverage
      || (typeof require === "function" ? require("../core/cinema-font-coverage.js") : null);
  }

  function buildStageDetailModel(catalog, stageId, scenarioId = "") {
    const stage = catalog?.getStage?.(stageId);
    if (!stage) return null;
    const scenario = catalog.getScenario(stage.id, scenarioId || stage.scenarios[0]?.id);
    if (!scenario) return null;
    return {
      stage,
      scenario,
      structuralLabel: stage.presentation.structuralLabel || `STAGE ${pad(stage.order)}`,
      material: stage.materials[0] || null,
      facts: [["场景", scenario.title], scenario.season ? ["进入时间", scenario.season] : null, ...(stage.presentation.facts || [])].filter(Boolean),
      specializations: stage.specializations.filter((name) => name !== stage.defaultSpecialization),
    };
  }

  function buildStagePreparationModel(catalog, stageId, scenarioId, relationshipDefaults = []) {
    const stage = catalog?.getStage?.(stageId);
    const scenario = stage && catalog.getScenario(stage.id, scenarioId || stage.scenarios[0]?.id);
    if (!stage || !scenario) return null;
    return {
      stage,
      scenario,
      roleConfiguration: stage.roleConfiguration || {},
      specializations: stage.specializations,
      relationshipOptions: stage.relationshipOptions.length ? stage.relationshipOptions : relationshipDefaults,
    };
  }

  function buildBeforeCurtainModel(catalog, draft, relationshipDefaults = []) {
    const stage = catalog?.getStage?.(draft?.stageId);
    const scenario = stage && catalog.getScenario(stage.id, draft?.scenarioId || stage.scenarios[0]?.id);
    if (!stage || !scenario || !draft?.characterSnapshot?.id) return null;
    const relationshipOptions = stage.relationshipOptions.length ? stage.relationshipOptions : relationshipDefaults;
    const relationshipStart = String(draft.relationshipStart || "").trim() || "尚未设定关系起点";
    const sharedHistory = String(draft.sharedHistory || "").trim();
    return {
      stage,
      scenario,
      characterName: String(draft.characterSnapshot.displayName || "").trim() || "未命名角色",
      scenarioOptions: stage.scenarios.map((item) => ({ id: item.id, title: item.title })),
      entryPeriods: scenario.entryPeriods || [],
      openingLabel: `经典开场 · ${scenario.title}`,
      openingDetail: String(draft.entryPeriod || scenario.season || "").trim(),
      relationshipOptions,
      relationshipStart,
      sharedHistory,
      historySummary: sharedHistory ? `${relationshipStart} · ${sharedHistory}` : relationshipStart,
      generationProfileName: draft.generationProfileSnapshot?.name || "默认预设",
    };
  }

  class MercuryCinemaAppController {
    constructor(options = {}) {
      this.catalog = options.catalog || global.MercuryCinemaStageCatalog.PRODUCTION_STAGE_CATALOG;
      this.route = "lobby";
      this.routeData = null;
      this.menuOpen = false;
      this.curtainMode = "entry";
      this.timers = new Set();
      this.worldGestureClickBlockUntil = 0;
      this.readingViewport = { instanceId: "", top: 0, atEnd: true, initialized: false };
      this.historyPresentation = Object.freeze({ ...DEFAULT_HISTORY_PRESENTATION, ...(options.historyPresentation || {}) });
    }

    render(root, context, launchPayload) {
      this.root = root;
      this.context = context;
      this.unmounted = false;
      this.initialized = false;
      this.pendingLaunchPayload = launchPayload || null;
      this.root.classList.add("cinema-host");
      this.store = new global.MercuryCinemaStore({ storage: context.services.storage, catalog: this.catalog });
      this.flushDraftForLifecycle = () => this.store?.flushDraftPersistence?.();
      this.flushDraftWhenHidden = () => {
        if (global.document?.visibilityState === "hidden") this.flushDraftForLifecycle();
      };
      global.addEventListener?.("pagehide", this.flushDraftForLifecycle);
      global.document?.addEventListener?.("visibilitychange", this.flushDraftWhenHidden);
      this.#renderHydrationState();
      this.initialization = this.#initialize();
    }

    async #initialize() {
      try {
        await this.store.ready;
        if (this.unmounted) return;
      } catch (error) {
        if (!this.unmounted) this.#renderPersistenceFailure(error);
        return;
      }
      this.archiveStore = global.MercuryArchiveContracts.createArchiveStore(this.context.services.sharedStorage);
      this.profileStore = new global.MercuryGenerationProfileStore({ storage: this.context.services.sharedStorage });
      this.workflow = new global.MercuryCinemaGenerationWorkflow({ store: this.store, transport: this.context.services.aiTransport });
      this.closureWorkflow = new global.MercuryCinemaClosureWorkflow({ store: this.store, generationWorkflow: this.workflow });
      this.unsubscribeWorkflow = this.workflow.subscribe(() => {
        if (this.route === "reading") this.#renderRoute();
      });
      this.unsubscribeClosureWorkflow = this.closureWorkflow.subscribe((state) => {
        if (state.phase !== "failed") return;
        this.route = "closure-failure";
        this.routeData = { instanceId: state.instanceId, operation: state.operation, error: state.error };
        this.menuOpen = false;
        this.#renderRoute();
      });
      this.unsubscribeStore = this.store.subscribe((event) => {
        if (event.type !== "persistence-error") return;
        const closureState = this.closureWorkflow?.snapshot?.();
        if (["persisting", "failed"].includes(closureState?.phase)) return;
        this.#renderPersistenceFailure(this.store.persistenceError);
      });
      const launchPayload = this.pendingLaunchPayload;
      this.pendingLaunchPayload = null;
      this.initialized = true;
      this.#applyLaunchPayload(launchPayload);
      if (!launchPayload?.route) this.route = this.store.snapshot().hasEntered ? "lobby" : "entrance";
      this.#renderRoute();
    }

    onResume(_context, launchPayload) {
      if (!this.initialized) {
        this.pendingLaunchPayload = launchPayload || this.pendingLaunchPayload;
        return;
      }
      this.#applyLaunchPayload(launchPayload);
      this.#renderRoute();
    }

    onPause() {
      this.store?.flushDraftPersistence?.();
      this.#clearTimers();
    }

    onUnmount() {
      this.unmounted = true;
      this.store?.flushDraftPersistence?.();
      this.#clearTimers();
      global.removeEventListener?.("pagehide", this.flushDraftForLifecycle);
      global.document?.removeEventListener?.("visibilitychange", this.flushDraftWhenHidden);
      this.unsubscribeWorkflow?.();
      this.unsubscribeClosureWorkflow?.();
      this.unsubscribeStore?.();
      this.root?.classList.remove("cinema-host");
    }

    #renderHydrationState() {
      const screen = this.#el("section", "cinema-screen cinema-loading-state");
      screen.append(this.#el("span", "cinema-loading-rule"), this.#el("p", "cinema-structural", "RESTORING PROGRAMME"));
      this.root.replaceChildren(screen);
    }

    #renderPersistenceFailure(error) {
      const screen = this.#el("section", "cinema-screen cinema-loading-state");
      screen.append(
        this.#el("span", "cinema-loading-rule"),
        this.#el("p", "cinema-structural", "PROGRAMME UNAVAILABLE"),
        this.#el("p", "cinema-empty-copy", error?.message || "Cinema 暂时无法安全读取本地放映。旧存档没有被替换。"),
      );
      this.root.replaceChildren(screen);
    }

    #applyLaunchPayload(payload) {
      const route = String(payload?.route || "");
      if (!route) return;
      if (route === "past" || route === "programme-archive") this.#go("programme-archive");
      else if (route.startsWith("history/")) this.#go("history", { instanceId: route.slice(8) });
      else if (route.startsWith("programme-entry/")) this.#go("programme-entry", { instanceId: route.slice(16) });
      else if (route === "programme") this.#go("programme");
      else if (route === "worlds") this.#go("worlds", { mode: "browse", returnRoute: "lobby" });
      else if (route === "cast") this.#go("cast", { mode: "browse", returnRoute: "lobby" });
      else if (route === "lobby") this.#go("lobby");
      else if (route === "active" && this.store.focused()) this.#go("reading");
      else if (route === "variant" && this.store.snapshot().draft?.characterSnapshot?.id) this.#go("variant");
      else if (route === "before-curtain" && this.store.snapshot().draft?.characterSnapshot?.id) this.#go("before-curtain");
    }

    #el(tag, className = "", text = "") {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== "") node.textContent = text;
      return node;
    }

    #icon(name, className = "") {
      const image = this.#el("img", `cinema-icon ${className}`.trim());
      image.src = iconPath(name);
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      return image;
    }

    #glyph(name, className = "") {
      const svg = createSvgElement("svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.25");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      const resolvedClassName = `cinema-glyph ${className}`.trim();
      svg.setAttribute("class", resolvedClassName);
      if (typeof svg.className === "string") svg.className = resolvedClassName;
      (GLYPH_SHAPES[name] || []).forEach(([tag, attributes]) => {
        const child = createSvgElement(tag);
        Object.entries(attributes).forEach(([key, value]) => child.setAttribute(key, value));
        svg.append(child);
      });
      return svg;
    }

    #dynamicText(tag, className, value, role = "display") {
      const node = this.#el(tag, className, value);
      fontCoverage()?.applyWholeStringFallback?.(node, role, value);
      return node;
    }

    #button(label, className, onClick, iconName = "") {
      const button = this.#el("button", className);
      button.type = "button";
      if (iconName) button.append(this.#icon(iconName));
      if (label) button.append(this.#el("span", "", label));
      if (onClick) button.addEventListener("click", onClick);
      return button;
    }

    #iconButton(name, label, onClick, className = "") {
      const button = this.#button("", `cinema-icon-button ${className}`.trim(), onClick, name);
      button.setAttribute("aria-label", label);
      return button;
    }

    #glyphButton(name, label, onClick, className = "") {
      const button = this.#button("", `cinema-glyph-button ${className}`.trim(), onClick);
      button.append(this.#glyph(name));
      button.setAttribute("aria-label", label);
      return button;
    }

    #ornament() {
      const wrap = this.#el("span", "cinema-ornament");
      wrap.append(this.#el("i"), this.#icon("spark"), this.#el("i"));
      return wrap;
    }

    #paper() {
      return this.#el("section", "cinema-paper");
    }

    #pageHeader(title, backRoute = "lobby", trailing = null, backData = null) {
      const header = this.#el("header", "cinema-page-header");
      header.append(this.#iconButton("nav-arrow-left", "返回", () => this.#go(backRoute, backData)));
      header.append(this.#el("h1", "cinema-page-header__title", title));
      header.append(trailing || this.#el("span", "cinema-page-header__spacer"));
      return header;
    }

    #sectionLabel(kicker, title, body = "") {
      const block = this.#el("header", "cinema-section-heading");
      block.append(this.#el("p", "cinema-structural", kicker), this.#el("h2", "cinema-display", title));
      if (body) block.append(this.#el("p", "cinema-section-heading__body", body));
      return block;
    }

    #field(label, control, hint = "") {
      const wrapper = this.#el("label", "cinema-field");
      wrapper.append(this.#el("span", "cinema-field__label", label), control);
      if (hint) wrapper.append(this.#el("small", "cinema-field__hint", hint));
      return wrapper;
    }

    #input(value, placeholder = "") {
      const input = this.#el("input", "cinema-input");
      input.value = value || "";
      input.placeholder = placeholder;
      input.autocomplete = "off";
      return input;
    }

    #textarea(value, placeholder = "", rows = 4) {
      const area = this.#el("textarea", "cinema-textarea");
      area.value = value || "";
      area.placeholder = placeholder;
      area.rows = rows;
      return area;
    }

    #select(options, value) {
      const select = this.#el("select", "cinema-select");
      options.forEach((optionValue) => {
        const option = this.#el("option", "", optionValue);
        option.value = optionValue;
        option.selected = optionValue === value;
        select.append(option);
      });
      return select;
    }

    #go(route, data = null) {
      this.store?.flushDraftPersistence?.();
      this.#clearTimers();
      this.route = route;
      this.routeData = data;
      this.menuOpen = false;
      this.#renderRoute();
    }

    #ensureDraftGenerationProfile() {
      const draft = this.store.snapshot().draft;
      if (!draft || draft.generationProfileSnapshot?.id) return draft;
      const profiles = this.profileStore.list();
      const selected = profiles.find((item) => item.id === draft.generationProfileId) || profiles[0];
      if (!selected) return draft;
      return this.store.updateDraft({ generationProfileId: selected.id, generationProfileSnapshot: clone(selected) });
    }

    #selectWorldForPreparation(world) {
      this.store.beginDraft(world.id);
      this.#go("cast", {
        mode: "prepare",
        returnRoute: "worlds",
        returnData: { ...this.routeData, worldId: world.id },
        stageId: world.id,
        worldReturnRoute: "worlds",
        worldReturnData: { ...this.routeData, worldId: world.id },
      });
    }

    #selectCharacterForPreparation(character) {
      const characterSnapshot = contracts().normalizeCharacterSnapshot(character.source);
      const current = this.store.snapshot().draft;
      const nextDraft = { ...current, characterId: character.id, characterSnapshot };
      const variant = contracts().buildCharacterVariant(characterSnapshot, nextDraft, this.catalog);
      this.store.updateDraft({ characterId: character.id, characterSnapshot, variant });
      this.#go("variant", {
        returnRoute: "cast",
        returnData: { ...this.routeData, selectedCharacterId: character.id },
      });
    }

    #returnToProgramme() {
      this.#go("programme");
    }

    #resumePreparationDraft() {
      const draft = this.store.snapshot().draft;
      const stage = draft && this.catalog.getStage(draft.stageId);
      if (!draft || !stage) {
        this.#go("worlds", { mode: "prepare", returnRoute: "programme" });
        return;
      }
      if (!draft.characterSnapshot?.id) {
        this.#go("cast", {
          mode: "prepare",
          returnRoute: "worlds",
          returnData: { mode: "prepare", returnRoute: "programme", worldId: stage.id },
          stageId: stage.id,
          worldReturnRoute: "worlds",
          worldReturnData: { mode: "prepare", returnRoute: "programme", worldId: stage.id },
        });
        return;
      }
      this.#go("variant", {
        returnRoute: "cast",
        returnData: { mode: "prepare", returnRoute: "programme", stageId: stage.id, selectedCharacterId: draft.characterSnapshot.id },
      });
    }

    #renderRoute() {
      if (!this.root) return;
      const routes = {
        entrance: () => this.#renderCurtain("entry"),
        lobby: () => this.#renderHome(),
        programme: () => this.#renderProgrammeBridge(),
        "programme-entry": () => this.#renderProgrammeEntry(),
        worlds: () => this.#renderWorldLibrary(),
        cast: () => this.#renderCinemaCast(),
        stage: () => this.#renderStage(),
        prep: () => this.#renderPreparation(),
        variant: () => this.#renderVariant(),
        profile: () => this.#renderProfilePicker(),
        "before-curtain": () => this.#renderBeforeCurtain(),
        confirm: () => this.#renderBeforeCurtain(),
        curtain: () => this.#renderCurtain(this.curtainMode),
        reading: () => this.#renderReading(),
        intermission: () => this.#renderIntermission(),
        ending: () => this.#renderEndingConfirmation(),
        credits: () => this.#renderCredits(),
        "closure-failure": () => this.#renderClosureFailure(),
        "programme-archive": () => this.#renderProgrammeArchive(),
        past: () => this.#redirectScreen("programme-archive"),
        history: () => this.#renderHistory(),
        settings: () => this.#renderReadingSettings(),
        notes: () => this.#renderNotes(),
        material: () => this.#renderMaterial(),
      };
      const screen = (routes[this.route] || routes.lobby)();
      this.root.replaceChildren(screen);
    }

    #renderCurtain(mode) {
      this.curtainMode = mode;
      const screen = this.#el("section", `cinema-screen cinema-curtain cinema-curtain--${mode}`);
      const left = this.#el(mode === "ending" ? "i" : "img", "cinema-curtain__panel cinema-curtain__panel--left");
      const right = this.#el(mode === "ending" ? "i" : "img", "cinema-curtain__panel cinema-curtain__panel--right");
      if (mode !== "ending") {
        left.src = "assets/cinema/curtain-left.webp";
        left.alt = "";
        right.src = "assets/cinema/curtain-right.webp";
        right.alt = "";
      } else {
        left.setAttribute("aria-hidden", "true");
        right.setAttribute("aria-hidden", "true");
        screen.append(this.#el("i", "cinema-curtain__ending-recess"), this.#el("i", "cinema-curtain__ending-seam"));
      }
      const field = this.#el("div", "cinema-curtain__field");
      const content = this.#el("div", "cinema-curtain__content");
      content.append(this.#el("p", "cinema-structural cinema-curtain__brand", "MERCURY CINEMA"), this.#ornament());
      const copy = {
        entry: ["CURTAIN", "入场", "今晚，从另一种人生开始。", "入场"],
        opening: ["OPENING", "开幕", "演员与舞台已经就位。", "拉开帷幕"],
        resume: ["INTERMISSION", "继续演出", "故事仍停在你离开的地方。", "继续"],
        ending: ["FINAL CURTAIN", "正在谢幕", "Mercury 正在安全封存这场演出。", ""],
      }[mode] || ["CURTAIN", "开幕", "", "继续"];
      content.append(this.#el("h1", "cinema-curtain__title", copy[0]), this.#el("p", "cinema-curtain__cn", copy[1]), this.#el("p", "cinema-curtain__line", copy[2]));
      if (copy[3]) {
        const action = this.#button(copy[3], "cinema-button cinema-button--light", () => this.#openCurtain(screen, mode));
        content.append(action);
        if (mode === "entry") content.append(this.#button("跳过动画", "cinema-link-button cinema-curtain__skip", () => this.#openCurtain(screen, mode, true)));
      }
      field.append(content);
      screen.append(field, left, right);
      if (mode === "ending") {
        const timer = global.setTimeout(() => {
          screen.classList.add("is-closing");
          screen.setAttribute("aria-busy", "true");
          const active = this.store.get(this.creditsInstanceId) || this.store.focused();
          if (!active) return;
          this.creditsInstanceId = active.id;
          const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          const minimumClose = new Promise((resolve) => {
            const nextTimer = global.setTimeout(resolve, reducedMotion ? 40 : 1050);
            this.timers.add(nextTimer);
          });
          Promise.all([this.closureWorkflow.finishEnding(active.id), minimumClose]).then(([result]) => {
            if (!result?.accepted || this.unmounted || this.route !== "curtain") return;
            this.#go("credits", { instanceId: active.id });
          }).catch(() => {});
        }, 120);
        this.timers.add(timer);
      }
      return screen;
    }

    #openCurtain(screen, mode, skip = false) {
      if (screen.classList.contains("is-opening")) return;
      screen.classList.add("is-opening");
      screen.setAttribute("aria-busy", "true");
      if (skip) screen.classList.add("is-skip");
      const delay = skip || global.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 40 : 1050;
      const timer = global.setTimeout(() => {
        if (mode === "entry") {
          this.store.markEntered();
          this.#go("lobby");
        } else if (mode === "opening") {
          try {
            this.store.openCurtain();
            this.#go("reading");
          } catch (error) {
            this.#go("before-curtain", { error: error.message });
          }
        } else if (mode === "resume") {
          const active = this.store.focused();
          if (active) this.store.resume(active.id);
          this.#go("reading");
        }
      }, delay);
      this.timers.add(timer);
    }

    #renderHome() {
      const screen = this.#el("section", "cinema-screen cinema-home");
      screen.dataset.cinemaView = "theater-home";

      const environment = this.#el("div", "cinema-home__environment");
      environment.setAttribute("aria-hidden", "true");
      const plate = this.#el("img", "cinema-home__plate");
      plate.src = "assets/cinema/theater-home-environment-v1.webp";
      plate.alt = "";
      environment.append(plate, this.#el("span", "cinema-home__scrim-light"), this.#el("span", "cinema-home__floor-light"));

      const brand = this.#el("header", "cinema-home__brand");
      brand.append(this.#el("strong", "", "MERCURY"), this.#el("small", "", "CINEMA"));

      const navigation = this.#el("nav", "cinema-home__navigation");
      navigation.setAttribute("aria-label", "Mercury Cinema");
      const destinations = [
        {
          className: "cinema-home__destination--worlds",
          glyph: "worlds",
          label: "世界",
          english: "WORLDS",
          action: () => this.#go("worlds", { mode: "browse", returnRoute: "lobby" }),
        },
        {
          className: "cinema-home__destination--programme",
          glyph: "programme",
          label: "节目单",
          english: "PROGRAMME",
          action: () => this.#go("programme"),
        },
        {
          className: "cinema-home__destination--cast",
          glyph: "cast",
          label: "角色",
          english: "CAST",
          action: () => this.#go("cast", { mode: "browse", returnRoute: "lobby" }),
        },
      ];
      destinations.forEach((destination) => {
        const action = this.#button("", `cinema-home__destination ${destination.className}`, destination.action);
        action.setAttribute("aria-label", destination.label);
        const copy = this.#el("span", "cinema-home__destination-copy");
        copy.append(this.#el("strong", "", destination.label), this.#el("small", "", destination.english));
        action.append(this.#glyph(destination.glyph), copy);
        navigation.append(action);
      });

      screen.append(environment, brand, navigation);
      if (!this.store.snapshot().tutorialSeen || this.forceTutorial) screen.append(this.#tutorialOverlay());
      return screen;
    }

    #cinemaIndexHeader(title, english, index, onBack) {
      const header = this.#el("header", "cinema-index-header");
      const back = this.#glyphButton("back", "返回", onBack, "cinema-index-header__back");
      const identity = this.#el("div", "cinema-index-header__identity");
      identity.append(this.#dynamicText("strong", "", title, "display"), this.#el("small", "", english));
      const folio = this.#el("p", "cinema-index-header__folio");
      folio.append(this.#el("span", "", "INDEX"), this.#el("b", "", index));
      header.append(back, identity, folio);
      return header;
    }

    #libraryOrnaments(host) {
      const orbit = this.#el("div", "cinema-library-orbit");
      orbit.setAttribute("aria-hidden", "true");
      orbit.append(this.#el("span"), this.#el("i"), this.#el("b"), this.#glyph("diamond"));
      host.append(orbit, this.#el("span", "cinema-library-tick cinema-library-tick--one"), this.#el("span", "cinema-library-tick cinema-library-tick--two"));
    }

    #worldLibraryBack() {
      this.#go(this.routeData?.returnRoute || "lobby", this.routeData?.returnData || null);
    }

    #renderWorldLibrary() {
      const projection = libraryProjection()?.buildWorldLibraryProjection?.(this.catalog, this.routeData?.worldId ?? this.routeData?.selectedIndex ?? 0);
      const mode = this.routeData?.mode === "prepare" ? "prepare" : "browse";
      const worldAction = (action) => () => {
        if (Date.now() < this.worldGestureClickBlockUntil) return;
        action();
      };
      const screen = this.#el("section", "cinema-screen cinema-world-library");
      screen.dataset.cinemaView = "world-library";
      screen.dataset.worldCount = String(projection?.total || 0);
      screen.dataset.mode = mode;
      screen.append(this.#cinemaIndexHeader("世界", "WORLD LIBRARY", projection?.indexLabel || "00 / 00", () => this.#worldLibraryBack()));

      const body = this.#el("div", "cinema-world-library__body");
      this.#libraryOrnaments(body);
      const intro = this.#el("div", "cinema-world-library__intro");
      intro.append(this.#el("p", "cinema-editorial-micro", "MERCURY CINEMA  /  REUSABLE WORLDS"), this.#dynamicText("h1", "", "世界档案", "display"), this.#el("span", "", "选择一处可以进入的人生"));
      body.append(intro);

      if (!projection?.selected) {
        const empty = this.#el("section", "cinema-world-library__empty");
        empty.append(this.#glyph("worlds"), this.#dynamicText("h2", "", "世界档案尚未开放", "display"), this.#el("p", "", "Cinema 当前没有可进入的 World。这里不会伪造可用世界或创建入口。"));
        body.append(empty);
        screen.append(body);
        return screen;
      }

      const deck = this.#el("div", "cinema-world-track");
      deck.dataset.railCount = String(Math.max(0, projection.visible.length - 1));
      deck.dataset.selectedIndex = String(projection.selectedIndex);
      deck.dataset.worldCount = String(projection.total);
      projection.visible.forEach((world) => {
        if (!world.selected) {
          const rail = this.#button("", `cinema-world-rail cinema-world-rail--${world.side}`, worldAction(() => this.#go("worlds", { ...this.routeData, worldId: world.id })));
          rail.setAttribute("aria-label", `切换到${world.title}`);
          rail.dataset.worldId = world.id;
          rail.append(this.#el("b", "", world.number), this.#dynamicText("span", "", world.shortTitle, "display"), this.#el("small", "", world.side === "past" ? "PREVIOUS WORLD" : "NEXT WORLD"));
          deck.append(rail);
          return;
        }

        const plane = this.#el("article", "cinema-world-plane");
        plane.dataset.worldId = world.id;
        plane.dataset.fallback = world.material?.asset ? "false" : "true";
        const scroll = this.#el("div", "cinema-world-plane__scroll");
        const media = this.#el("div", "cinema-world-plane__media");
        if (world.material?.asset) {
          const image = this.#el("img");
          image.src = world.material.asset;
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          image.addEventListener("error", () => { image.remove(); plane.dataset.fallback = "true"; }, { once: true });
          media.append(image);
        }
        media.append(this.#el("span", "cinema-world-plane__media-shade"), this.#el("span", "cinema-world-plane__coordinates", `CATALOG  /  ${world.id.toUpperCase()}`));
        const number = this.#el("p", "cinema-world-plane__number");
        number.append(this.#el("span", "", "WORLD"), this.#el("b", "", world.number));
        const copy = this.#el("div", "cinema-world-plane__copy");
        copy.append(
          this.#el("p", "cinema-world-plane__region", world.region),
          this.#dynamicText("h2", "", world.title, "display"),
          this.#el("p", "cinema-world-plane__latin", world.latinTitle),
          this.#dynamicText("p", "cinema-world-plane__tagline", world.tagline, "reading"),
        );
        const actions = this.#el("div", `cinema-world-plane__actions cinema-world-plane__actions--${mode}`);
        const open = this.#button("", "cinema-world-plane__action cinema-world-plane__action--inspect", worldAction(() => this.#go("stage", {
          stageId: world.id,
          returnRoute: "worlds",
          returnData: { ...this.routeData, worldId: world.id },
        })));
        open.setAttribute("aria-label", `查看${world.title}世界档案`);
        open.append(this.#el("span", "", "查看世界档案"), this.#glyph("arrow-east"));
        actions.append(open);
        if (mode === "prepare") {
          const select = this.#button("", "cinema-world-plane__action cinema-world-plane__action--select", worldAction(() => this.#selectWorldForPreparation(world)));
          select.setAttribute("aria-label", `选择${world.title}作为本场世界`);
          select.append(this.#el("span", "", "选择这个世界"), this.#glyph("arrow-east"));
          actions.append(select);
        }
        copy.append(actions);
        scroll.append(media, number, copy, this.#glyph("registration", "cinema-world-plane__registration"));
        plane.append(scroll);
        deck.append(plane);
      });
      this.#bindWorldTrackGesture(deck, projection);
      body.append(deck);

      const footer = this.#el("footer", "cinema-world-library__footer");
      footer.append(this.#el("span", "", "CATALOG-BACKED WORLDS"), this.#el("i"), this.#el("span", "", `${projection.total} AVAILABLE`));
      body.append(footer);
      screen.append(body);
      return screen;
    }

    #bindWorldTrackGesture(deck, projection) {
      const arbiter = libraryProjection()?.createDirectionalGestureArbiter?.();
      if (!arbiter) return;
      let pointerId = null;
      let horizontal = false;
      let suppressClick = false;
      const isInteractiveStart = (target) => {
        for (let node = target; node && node !== deck; node = node.parentElement) {
          const tag = String(node.tagName || "").toLowerCase();
          if (["button", "a", "input", "select", "textarea"].includes(tag) || node.hasAttribute?.("data-world-gesture-exclusion")) return true;
        }
        return false;
      };
      const blockSyntheticClick = () => {
        suppressClick = true;
        this.worldGestureClickBlockUntil = Date.now() + 360;
      };
      const reset = () => {
        pointerId = null;
        horizontal = false;
        deck.classList.remove("is-dragging");
        deck.style.setProperty("--cinema-world-drag-x", "0px");
      };
      deck.addEventListener("pointerdown", (event) => {
        if (event.isPrimary === false || event.button > 0) return;
        if (isInteractiveStart(event.target)) {
          this.worldGestureClickBlockUntil = 0;
          suppressClick = false;
          return;
        }
        pointerId = event.pointerId;
        horizontal = false;
        suppressClick = false;
        arbiter.start(event.clientX, event.clientY);
      });
      deck.addEventListener("pointermove", (event) => {
        if (pointerId === null || event.pointerId !== pointerId) return;
        const state = arbiter.move(event.clientX, event.clientY);
        if (state.intent !== "horizontal") return;
        horizontal = true;
        event.preventDefault();
        deck.setPointerCapture?.(pointerId);
        deck.classList.add("is-dragging");
        deck.style.setProperty("--cinema-world-drag-x", `${Math.max(-64, Math.min(64, state.deltaX * .34))}px`);
      });
      deck.addEventListener("pointerup", (event) => {
        if (pointerId === null || event.pointerId !== pointerId) return;
        const result = arbiter.end(event.clientX, event.clientY);
        if (horizontal) {
          blockSyntheticClick();
          event.preventDefault();
        }
        deck.releasePointerCapture?.(pointerId);
        reset();
        if (!result.commit) return;
        const nextIndex = result.direction === "next" ? projection.selectedIndex + 1 : projection.selectedIndex - 1;
        if (nextIndex < 0 || nextIndex >= projection.total) return;
        this.#go("worlds", { ...this.routeData, selectedIndex: nextIndex, worldId: projection.worlds[nextIndex].id });
      });
      deck.addEventListener("pointercancel", () => {
        arbiter.cancel();
        if (horizontal) blockSyntheticClick();
        reset();
      });
      deck.addEventListener("click", (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }

    #castBack(mode, draft) {
      if (mode === "prepare" && this.routeData?.returnRoute === "stage" && draft?.stageId) {
        this.#go("stage", {
          stageId: draft.stageId,
          returnRoute: this.routeData?.worldReturnRoute || "worlds",
          returnData: this.routeData?.worldReturnData || null,
        });
        return;
      }
      this.#go(this.routeData?.returnRoute || "lobby", this.routeData?.returnData || null);
    }

    #renderCinemaCast() {
      const mode = this.routeData?.mode === "prepare" ? "prepare" : "browse";
      const archive = this.archiveStore.load();
      const cinemaState = this.store.snapshot();
      const projection = libraryProjection()?.buildCinemaCastProjection?.(archive, cinemaState);
      const draft = cinemaState.draft;
      const selectedId = this.routeData?.selectedCharacterId || (mode === "prepare" ? draft?.characterId : "") || projection?.entries?.[0]?.id || "";
      const selected = projection?.entries?.find((entry) => entry.id === selectedId) || projection?.entries?.[0] || null;
      const stage = mode === "prepare" ? this.catalog.getStage(draft?.stageId) : null;

      const screen = this.#el("section", "cinema-screen cinema-cast-index");
      screen.dataset.cinemaView = "cinema-cast";
      screen.dataset.mode = mode;
      screen.append(this.#cinemaIndexHeader("角色", "CINEMA CAST", "02", () => this.#castBack(mode, draft)));
      const body = this.#el("div", "cinema-cast-index__body");
      this.#libraryOrnaments(body);

      const intro = this.#el("div", "cinema-cast-index__intro");
      intro.append(this.#el("p", "cinema-editorial-micro", mode === "prepare" ? `CASTING FOR  /  ${stage?.latinTitle || stage?.title || "CURRENT WORLD"}` : "MERCURY CINEMA  /  CAST RECORDS"));
      const heading = this.#dynamicText("h1", "", "这次想和谁\n走进另一种人生？", "display");
      intro.append(heading);
      const context = this.#el("p", "cinema-cast-index__context");
      context.append(this.#el("span", "", mode === "prepare" ? "当前世界" : "浏览模式"), this.#dynamicText("b", "", mode === "prepare" ? stage?.title || "尚未选择世界" : "独立查看剧场记录", "ui"));
      intro.append(context);
      body.append(intro);

      const stack = this.#el("div", "cinema-cast-sheet-stack");
      stack.append(this.#el("div", "cinema-cast-sheet cinema-cast-sheet--underlay"));
      const sheet = this.#el("section", "cinema-cast-sheet cinema-cast-sheet--main");
      const sheetHead = this.#el("header", "cinema-cast-sheet__head");
      const headCopy = this.#el("div");
      headCopy.append(this.#el("p", "cinema-editorial-micro", "CASTING SHEET  /  ORIGINAL CHARACTER SOURCE"), this.#dynamicText("h2", "", "选角册", "display"));
      const count = this.#el("p", "cinema-cast-sheet__count");
      count.append(this.#el("b", "", pad(projection?.total || 0)), this.#el("span", "", "AVAILABLE"));
      sheetHead.append(headCopy, this.#glyph("cast"), count);
      sheet.append(this.#glyph("registration", "cinema-cast-sheet__registration cinema-cast-sheet__registration--left"), this.#glyph("registration", "cinema-cast-sheet__registration cinema-cast-sheet__registration--right"), sheetHead);

      const rows = this.#el("div", "cinema-cast-sheet__list");
      if (!projection?.entries?.length) {
        const empty = this.#el("div", "cinema-cast-sheet__empty");
        empty.append(this.#glyph("cast"), this.#dynamicText("h3", "", "选角册尚未登记角色", "display"), this.#el("p", "", "请先在档案馆创建或导入原始角色。Cinema 不会在这里改写角色本体。"));
        empty.append(this.#button("前往档案馆", "cinema-cast-sheet__archive-link", () => this.context.services.launchApp?.("archive", "characters")));
        rows.append(empty);
      } else {
        projection.entries.forEach((character) => {
          const active = character.id === selected?.id;
          const row = this.#button("", `cinema-cast-row${active ? " is-selected" : ""}`, () => {
            if (mode === "prepare") {
              this.#selectCharacterForPreparation(character);
              return;
            }
            this.#go("cast", { ...this.routeData, selectedCharacterId: character.id, castScrollTop: sheet.scrollTop });
          });
          row.dataset.characterId = character.id;
          row.setAttribute("aria-label", `选择角色${character.displayName}`);
          row.setAttribute("aria-pressed", String(active));
          const portrait = this.#el("span", "cinema-cast-row__portrait");
          portrait.append(this.#dynamicText("span", "cinema-cast-row__monogram", character.visual.textFallback, "display"));
          const image = this.#el("img", "cinema-cast-row__image");
          image.src = character.visual.src;
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          image.dataset.visualKind = character.visual.kind;
          let neutralAttempted = character.visual.kind === "mercury-neutral";
          image.addEventListener("error", () => {
            if (!neutralAttempted && character.visual.neutralFallbackSrc) {
              neutralAttempted = true;
              image.dataset.visualKind = "mercury-neutral";
              image.src = character.visual.neutralFallbackSrc;
              return;
            }
            image.remove();
            portrait.dataset.fallback = "surname";
          });
          portrait.append(image);
          const copy = this.#el("span", "cinema-cast-row__copy");
          copy.append(this.#dynamicText("strong", "", character.displayName, "display"), this.#dynamicText("small", "", character.description, "reading"));
          const history = this.#el("span", "cinema-cast-row__history");
          history.append(this.#el("b", "", `${character.performanceCount} 场`), this.#el("small", "", `${character.worldCount} 个世界`));
          row.append(this.#el("b", "cinema-cast-row__number", character.number), portrait, copy, history, this.#glyph("arrow-east"), this.#el("i", "cinema-cast-row__selection"));
          rows.append(row);
        });
      }
      sheet.append(rows);

      const foot = this.#el("footer", "cinema-cast-sheet__foot");
      const source = this.#el("p");
      source.append(this.#el("span", "", "SOURCE"), this.#el("b", "", "PRIMARY ARCHIVE  /  READ ONLY"));
      let actionLabel = mode === "prepare" ? "进入角色适配" : selected?.latestInstanceId ? "查看最近演出" : "尚无剧场记录";
      const proceed = this.#button("", "cinema-cast-sheet__proceed", () => {
        if (!selected) return;
        if (mode === "prepare") {
          this.#selectCharacterForPreparation(selected);
        } else if (selected.latestInstanceId) this.#go("programme-entry", { instanceId: selected.latestInstanceId });
      });
      proceed.disabled = !selected || (mode === "browse" && !selected.latestInstanceId);
      proceed.append(this.#dynamicText("span", "", actionLabel, "reading"), this.#glyph("arrow-east"));
      foot.append(source, proceed);
      sheet.append(foot);
      stack.append(sheet);
      body.append(stack);
      screen.append(body);
      const requestedScrollTop = Number(this.routeData?.castScrollTop);
      if (mode === "browse" && Number.isFinite(requestedScrollTop) && requestedScrollTop > 0) {
        global.requestAnimationFrame?.(() => { sheet.scrollTop = requestedScrollTop; });
      }
      return screen;
    }

    #renderProgrammeBridge() {
      const state = this.store.snapshot();
      const projection = programmeProjection()?.buildCinemaProgrammeProjection?.(state);
      const primary = projection?.primary || null;
      const unfinished = projection?.unfinished || [];
      const past = projection?.past || [];
      const screen = this.#el("section", "cinema-screen cinema-programme-hub");
      screen.dataset.cinemaView = "programme-hub";
      screen.dataset.programmeState = primary ? "active" : projection?.groups?.length ? "idle" : "empty";

      const environment = this.#el("div", "cinema-programme-hub__environment");
      environment.setAttribute("aria-hidden", "true");
      const environmentPlate = this.#el("img");
      environmentPlate.src = "assets/cinema/theater-home-environment-v1.webp";
      environmentPlate.alt = "";
      environment.append(environmentPlate, this.#el("span"));

      const header = this.#el("header", "cinema-programme-hub__header");
      const identity = this.#el("div", "cinema-programme-hub__header-identity");
      identity.append(this.#dynamicText("strong", "", "节目单", "display"), this.#el("small", "", "PROGRAMME"));
      const index = this.#el("p", "cinema-programme-hub__header-index");
      index.append(this.#el("span", "", "INDEX"), this.#el("b", "", "01"));
      header.append(
        this.#glyphButton("back", "返回剧场", () => this.#go("lobby"), "cinema-programme-hub__back"),
        identity,
        index,
      );

      const paper = this.#el("main", "cinema-programme-hub__paper");
      paper.append(
        this.#el("span", "cinema-programme-hub__edge"),
        this.#el("span", "cinema-programme-hub__fold"),
        this.#glyph("registration", "cinema-programme-hub__registration cinema-programme-hub__registration--left"),
        this.#glyph("registration", "cinema-programme-hub__registration cinema-programme-hub__registration--right"),
      );

      const masthead = this.#el("div", "cinema-programme-hub__masthead");
      masthead.append(
        this.#el("p", "cinema-editorial-micro", "MERCURY CINEMA\nLIVES IN PARALLEL"),
        this.#glyph("diamond"),
        this.#el("p", "cinema-editorial-micro", "PERFORMANCE INDEX\nPROGRAMME 001"),
      );
      paper.append(masthead);

      const title = this.#el("header", "cinema-programme-hub__title");
      const titleCopy = this.#el("div");
      titleCopy.append(this.#dynamicText("h1", "", "演出索引", "display"), this.#el("p", "", "节目单"));
      title.append(titleCopy, this.#el("span", "", "01"));
      paper.append(title);

      if (primary) {
        const current = this.#el("article", "cinema-programme-hub__current cinema-current-ticket");
        current.append(this.#programmeIndexHeading("正在进行", "01", true));
        const currentEntry = this.#button("", "cinema-programme-hub__current-entry", () => this.#go("programme-entry", { instanceId: primary.id }));
        currentEntry.setAttribute("aria-label", `打开${primary.title}节目`);
        const pair = this.#dynamicText("p", "cinema-programme-hub__pair", `${primary.characterName} × ${primary.worldTitle}`, "reading");
        const currentTitle = this.#dynamicText("h2", "", primary.title, "display");
        const position = this.#el("p", "cinema-programme-hub__position");
        position.append(this.#glyph("location"), this.#dynamicText("span", "", primary.position, "reading"));
        currentEntry.append(pair, currentTitle, position);
        current.append(currentEntry);
        const continueAction = this.#button("", "cinema-programme-hub__continue", () => this.#continueInstance(primary.source));
        continueAction.append(this.#dynamicText("span", "", primary.actionLabel, "display"), this.#glyph("arrow-east"));
        current.append(continueAction);
        paper.append(current);

        const otherUnfinished = unfinished.filter((instance) => instance.id !== primary.id);
        if (otherUnfinished.length) {
          const ongoing = this.#el("section", "cinema-programme-hub__unfinished");
          ongoing.append(this.#programmeIndexHeading("其他未完人生", pad(otherUnfinished.length)));
          otherUnfinished.forEach((instance, itemIndex) => {
            const action = this.#button("", `cinema-programme-hub__life-row${instance.pending ? " is-pending" : ""}`, () => this.#go("programme-entry", { instanceId: instance.id }));
            action.setAttribute("aria-label", `打开${instance.title}节目`);
            action.append(this.#el("b", "", pad(itemIndex + 2)));
            const copy = this.#el("span", "cinema-programme-hub__life-copy");
            copy.append(
              this.#dynamicText("strong", "", instance.title, "display"),
              this.#dynamicText("small", "", `${instance.characterName} × ${instance.worldTitle}　${instance.position}`, "ui"),
            );
            action.append(copy);
            if (instance.pending) action.append(this.#el("em", "", "待恢复"));
            else action.append(this.#glyph("arrow-east"));
            ongoing.append(action);
          });
          paper.append(ongoing);
        }
      } else {
        const empty = this.#el("section", "cinema-programme-hub__empty");
        const orbit = this.#el("div", "cinema-programme-hub__empty-orbit");
        orbit.append(this.#el("span", ""), this.#el("i"), this.#glyph("diamond"), this.#el("b"), this.#el("em"));
        const copy = this.#el("div", "cinema-programme-hub__empty-copy");
        copy.append(
          this.#el("p", "", past.length ? "当前没有未完成的演出" : "节目册尚未写下"),
          this.#dynamicText("h2", "", past.length ? "下一场人生" : "第一场人生", "display"),
          this.#el("small", "", "从一个世界与角色开始"),
        );
        empty.append(orbit, copy);
        paper.append(empty);
      }

      const archive = this.#el("section", `cinema-programme-hub__past${past.length ? "" : " is-empty"}`);
      archive.append(this.#programmeIndexHeading("往期演出", pad(past.length)));
      past.slice(0, 2).forEach((instance) => {
        const row = this.#button("", "cinema-programme-hub__past-row", () => this.#go("history", { instanceId: instance.id }));
        row.setAttribute("aria-label", `阅读${instance.title}归档`);
        row.append(
          this.#dynamicText("span", "", instance.title, "reading"),
          this.#el("small", "", `${instance.characterName} × ${instance.worldTitle}`),
          this.#glyph("arrow-east"),
        );
        archive.append(row);
      });
      if (!past.length) archive.append(this.#el("p", "", "尚无谢幕归档"));
      if (past.length > 2) archive.append(this.#button("查看全部往期", "cinema-programme-hub__past-all", () => this.#go("programme-archive")));
      paper.append(archive);

      const hasWorlds = this.catalog.listStages().length > 0;
      const draft = state.draft;
      const resumableDraft = Boolean(draft && this.catalog.getStage(draft.stageId));
      const start = this.#button("", "cinema-programme-hub__start", () => hasWorlds && (resumableDraft
        ? this.#resumePreparationDraft()
        : this.#go("worlds", { mode: "prepare", returnRoute: "programme" })));
      start.disabled = !hasWorlds;
      start.append(
        this.#el("span", "cinema-programme-hub__start-mark"),
        this.#dynamicText("strong", "", resumableDraft ? "继续准备这场人生" : primary || past.length ? "开始另一场演出" : "开始一段人生", "display"),
        this.#glyph("arrow-east"),
      );
      paper.append(start);

      const footer = this.#el("footer", "cinema-programme-hub__footer");
      footer.append(
        this.#el("p", "cinema-editorial-micro", "MERCURY CINEMA\nBLACK-BOX SERIES"),
        this.#glyph("registration"),
        this.#el("p", "cinema-editorial-micro", "PROGRAMME HUB\n001.01"),
      );
      paper.append(footer);
      screen.append(environment, header, paper);
      if (!state.tutorialSeen || this.forceTutorial) screen.append(this.#tutorialOverlay());
      return screen;
    }

    #programmeIndexHeading(label, number, current = false) {
      const heading = this.#el("div", `cinema-programme-hub__section-index${current ? " is-current" : ""}`);
      heading.append(this.#el("span", "", label), this.#el("i"), this.#el("b", "", number));
      return heading;
    }

    #continueInstance(instance) {
      if (!this.store.focusInstance(instance.id)) return;
      if (instance.status === "intermission") { this.curtainMode = "resume"; this.#go("curtain"); }
      else if (instance.status === "ending") { this.curtainMode = "ending"; this.#go("curtain"); }
      else this.#go("reading");
    }

    #renderProgrammeEntry() {
      const projection = programmeProjection()?.buildCinemaProgrammeProjection?.(this.store.snapshot(), this.routeData?.instanceId);
      const entry = projection?.selectedGroup;
      if (!entry?.selected) return this.#redirectScreen("programme");

      const selected = entry.selected;
      const screen = this.#el("section", "cinema-screen cinema-programme-entry");
      const header = this.#el("header", "cinema-programme-entry__header");
      const identity = this.#el("div", "cinema-programme-entry__header-identity");
      identity.append(
        this.#dynamicText("h1", "cinema-programme-entry__world", entry.worldTitle, "display"),
        this.#el("p", "cinema-editorial-micro", "PROGRAMME ENTRY"),
      );
      header.append(
        this.#glyphButton("back", "返回节目单", () => this.#returnToProgramme(), "cinema-programme-entry__back"),
        identity,
        this.#glyphButton("ellipsis", "剧场说明", () => this.#showTutorial(true), "cinema-programme-entry__more"),
      );

      const paper = this.#el("main", "cinema-programme-entry__paper");
      paper.append(this.#glyph("registration", "cinema-programme-entry__registration cinema-programme-entry__registration--left"));
      paper.append(this.#glyph("registration", "cinema-programme-entry__registration cinema-programme-entry__registration--right"));

      const orbit = this.#el("div", "cinema-programme-entry__orbit");
      orbit.append(this.#el("span", "cinema-programme-entry__orbit-ring"), this.#el("i"), this.#el("span", "cinema-programme-entry__orbit-axis"));
      paper.append(orbit);

      const identityBlock = this.#el("section", "cinema-programme-entry__identity");
      const character = this.#el("div", "cinema-programme-entry__identity-row");
      character.append(this.#el("p", "cinema-entry-label", "角色"), this.#dynamicText("h2", "cinema-entry-identity-title", entry.characterName, "display"));
      const world = this.#el("div", "cinema-programme-entry__identity-row");
      world.append(this.#el("p", "cinema-entry-label", "世界"), this.#dynamicText("h2", "cinema-entry-identity-title", entry.worldTitle, "display"));
      identityBlock.append(character, world);
      if (entry.sharedHistory) identityBlock.append(this.#dynamicText("p", "cinema-programme-entry__history", entry.sharedHistory, "reading"));
      paper.append(identityBlock);

      if (entry.unfinished.length) {
        const current = this.#el("section", "cinema-programme-entry__current");
        current.append(
          this.#el("p", "cinema-entry-kicker", "正在上演"),
          this.#dynamicText("h2", "cinema-programme-entry__performance-title", selected.title, "display"),
        );
        const currentRule = this.#el("div", "cinema-programme-entry__current-rule");
        currentRule.append(this.#el("i"), this.#glyph("diamond"), this.#el("i"));
        current.append(currentRule);
        const position = this.#el("div", "cinema-programme-entry__fact");
        position.append(this.#el("p", "cinema-entry-label", "位置"), this.#dynamicText("p", "cinema-programme-entry__position", selected.position, "reading"));
        current.append(position);
        const continueAction = this.#button("", "cinema-programme-entry__continue", () => this.#continueInstance(selected.source));
        continueAction.append(this.#el("span", "cinema-entry-label", "行动"));
        const continueLine = this.#el("strong");
        continueLine.append(this.#glyph("arrow-east"), this.#dynamicText("span", "", selected.actionLabel, "display"));
        continueAction.append(continueLine);
        current.append(continueAction);

        const otherUnfinished = entry.unfinished.filter((instance) => instance.id !== selected.id);
        if (otherUnfinished.length) {
          const other = this.#el("section", "cinema-programme-entry__other");
          other.append(this.#el("p", "cinema-entry-label", "同组未完演出"));
          otherUnfinished.forEach((instance) => {
            const action = this.#button("", "cinema-programme-entry__compact-row", () => this.#continueInstance(instance.source));
            action.append(this.#dynamicText("span", "", instance.title, "reading"), this.#glyph("arrow-east"));
            other.append(action);
          });
          current.append(other);
        }
        paper.append(current);
      }

      const history = this.#el("section", "cinema-programme-entry__past");
      const historyHead = this.#el("header", "cinema-programme-entry__past-head");
      historyHead.append(this.#el("h2", "cinema-entry-section-title", "过往演出"), this.#el("i"), this.#glyph("arrow-east"));
      history.append(historyHead);
      if (entry.past.length) {
        entry.past.forEach((instance) => {
          const row = this.#button("", "cinema-programme-entry__past-row", () => this.#go("history", { instanceId: instance.id }));
          row.append(this.#dynamicText("span", "", instance.title, "reading"), this.#el("small", "", "已演出"));
          history.append(row);
        });
      } else history.append(this.#el("p", "cinema-programme-entry__past-empty", "这组角色与世界还没有谢幕归档。"));
      paper.append(history);

      const liveStage = this.catalog.getStage(entry.stageId);
      if (liveStage) {
        const start = this.#button("", "cinema-programme-entry__start", () => this.#go("worlds", { mode: "prepare", returnRoute: "programme-entry", returnData: { instanceId: entry.selected?.id || this.routeData?.instanceId } }));
        start.append(this.#glyph("arrow-east"), this.#dynamicText("span", "", "开始另一场演出", "display"));
        paper.append(start);
      }

      const footer = this.#el("footer", "cinema-programme-entry__footer");
      footer.append(
        this.#el("p", "cinema-editorial-micro", "MERCURY CINEMA\nBLACK-BOX SERIES"),
        this.#glyph("registration"),
        this.#el("p", "cinema-editorial-micro", "PROGRAMME ENTRY\n001.11"),
      );
      paper.append(footer);
      screen.append(header, paper);
      if (this.forceTutorial) screen.append(this.#tutorialOverlay());
      return screen;
    }

    #tutorialOverlay() {
      const overlay = this.#el("section", "cinema-modal-layer");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "剧场新手说明");
      const foldout = this.#el("article", "cinema-foldout");
      foldout.append(this.#el("p", "cinema-structural", "YOUR FIRST PROGRAMME"), this.#el("h2", "cinema-display", "第一次入场"), this.#el("p", "cinema-foldout__intro", "这不是聊天页的皮肤，而是一场可暂停、可续写、会留下完整归档的长篇共同演出。"));
      const terms = [
        ["Stage · 舞台", "固定世界与可持续生活空间。"],
        ["Scenario · 场景", "本场故事从哪个时间点开始。"],
        ["Variant · 角色变体", "只属于本场，不改写档案馆里的核心角色。"],
        ["Intermission · 中场", "安全暂停，之后从同一场故事继续。"],
      ];
      terms.forEach(([title, body]) => {
        const row = this.#el("div", "cinema-foldout__term");
        row.append(this.#el("strong", "", title), this.#el("small", "", body));
        foldout.append(row);
      });
      foldout.append(this.#button("收好节目单", "cinema-button cinema-button--crimson", () => {
        this.store.markTutorialSeen();
        this.forceTutorial = false;
        this.#renderRoute();
      }));
      overlay.append(foldout);
      return overlay;
    }

    #showTutorial(force) {
      this.forceTutorial = force;
      this.#renderRoute();
    }

    #renderStage() {
      const model = buildStageDetailModel(this.catalog, this.routeData?.stageId, this.routeData?.scenarioId);
      if (!model) return this.#redirectScreen("lobby");
      const { stage, scenario, material } = model;
      const mode = this.routeData?.returnData?.mode === "prepare" ? "prepare" : "browse";
      const screen = this.#el("section", "cinema-screen cinema-paper-screen");
      screen.dataset.mode = mode;
      screen.append(this.#pageHeader("舞台说明", this.routeData?.returnRoute || "programme", null, this.routeData?.returnData || null));
      const paper = this.#paper();
      const lead = this.#el("article", "cinema-stage-detail");
      lead.append(this.#el("p", "cinema-structural", model.structuralLabel), this.#el("h1", "cinema-stage-detail__title", stage.title));
      if (stage.latinTitle) lead.append(this.#el("p", "cinema-stage-detail__latin", stage.latinTitle));
      lead.append(this.#ornament());
      if (material?.asset) {
        const mapButton = this.#button("", "cinema-stage-map", () => this.#go("material", {
          stageId: stage.id,
          materialId: material.id,
          stageReturnRoute: this.routeData?.returnRoute || "worlds",
          stageReturnData: this.routeData?.returnData || null,
        }));
        const image = this.#el("img");
        image.src = material.asset;
        image.alt = material.alt || material.title;
        const mapCaption = this.#el("span", "cinema-stage-map__caption");
        mapCaption.append(this.#el("strong", "", material.title), this.#el("small", "", material.caption || "点击查看资料"));
        mapButton.append(image, mapCaption);
        lead.append(mapButton);
      }
      const intro = this.#el("section", "cinema-editorial-copy");
      if (stage.premise) intro.append(this.#el("p", "cinema-dropcap", stage.premise));
      if (stage.summary) intro.append(this.#el("p", "", stage.summary));
      lead.append(intro);
      const facts = this.#el("dl", "cinema-fact-list");
      model.facts.forEach(([term, value]) => {
        facts.append(this.#el("dt", "cinema-structural", term), this.#el("dd", "", value));
      });
      lead.append(facts);
      if (stage.specializations.length) {
        const fields = this.#el("section", "cinema-stage-fields");
        fields.append(this.#sectionLabel(stage.presentation.fieldKicker || "STAGE FIELDS", stage.presentation.fieldTitle || "可选方向"));
        model.specializations.forEach((name, index) => {
          const row = this.#el("div", "cinema-stage-field-row");
          row.append(this.#el("span", "cinema-structural", pad(index + 1)), this.#el("span", "", name));
          fields.append(row);
        });
        lead.append(fields);
      }
      if (mode === "prepare") {
        lead.append(this.#button("选择这一场", "cinema-button cinema-button--crimson cinema-sticky-action", () => {
          this.store.beginDraft(stage.id);
          this.#go("cast", {
            mode: "prepare",
            returnRoute: "stage",
            stageId: stage.id,
            worldReturnRoute: this.routeData?.returnRoute || "worlds",
            worldReturnData: this.routeData?.returnData || null,
          });
        }));
      }
      paper.append(lead);
      screen.append(paper);
      return screen;
    }

    #renderMaterial() {
      const stage = this.catalog.getStage(this.routeData?.stageId);
      const material = stage?.materials.find((item) => item.id === this.routeData?.materialId) || stage?.materials[0];
      if (!stage || !material?.asset) return this.#redirectScreen("stage");
      const screen = this.#el("section", "cinema-screen cinema-material-viewer");
      const header = this.#pageHeader(material.title, "stage", null, {
        stageId: stage.id,
        returnRoute: this.routeData?.stageReturnRoute || "worlds",
        returnData: this.routeData?.stageReturnData || null,
      });
      const pan = this.#el("div", "cinema-material-viewer__pan");
      const image = this.#el("img", "cinema-material-viewer__image");
      image.src = material.asset;
      image.alt = material.title;
      pan.append(image);
      const caption = this.#el("footer", "cinema-material-viewer__caption");
      caption.append(this.#el("p", "cinema-structural", stage.presentation.materialKicker || "WORLD EXTRA"));
      if (material.caption) caption.append(this.#el("p", "", material.caption));
      if (stage.presentation.materialHint) caption.append(this.#el("small", "", stage.presentation.materialHint));
      screen.append(header, pan, caption);
      return screen;
    }

    #renderPreparation() {
      let draft = this.store.snapshot().draft || this.store.beginDraft();
      const model = buildStagePreparationModel(this.catalog, draft.stageId, draft.scenarioId, contracts().RELATIONSHIP_STARTS);
      if (!model) return this.#redirectScreen("lobby");
      const { stage, scenario, roleConfiguration } = model;
      const archive = this.archiveStore.load();
      const screen = this.#el("section", "cinema-screen cinema-paper-screen");
      screen.append(this.#pageHeader("放映筹备", "cast", null, {
        mode: "prepare",
        returnRoute: "stage",
        stageId: draft.stageId,
        selectedCharacterId: draft.characterId,
        worldReturnRoute: "worlds",
      }));
      const paper = this.#paper();
      const content = this.#el("form", "cinema-preparation");
      content.addEventListener("submit", (event) => event.preventDefault());
      content.append(this.#sectionLabel("PRODUCTION PROGRAMME", "填写本场节目单", "这里决定本场从哪里开始。核心角色仍归档案馆所有，Cinema 只保存这一场的世界变体。"));

      const sceneSection = this.#el("section", "cinema-prep-section");
      sceneSection.append(this.#el("p", "cinema-structural", "I · STAGE AND SCENARIO"), this.#el("h3", "cinema-display", `${stage.title} · ${scenario.title}`));
      if (scenario.entryPeriods.length) {
        const period = this.#select(scenario.entryPeriods, draft.entryPeriod);
        period.addEventListener("change", () => this.store.updateDraft({ entryPeriod: period.value }));
        sceneSection.append(this.#field("进入时间", period, "只决定开场位置，不锁死后续道路。"));
      }
      content.append(sceneSection);

      const castSection = this.#el("section", "cinema-prep-section");
      castSection.append(this.#el("p", "cinema-structural", "II · CAST"), this.#el("h3", "cinema-display", "本场演员"));
      const selectedProfile = archive.runtimeProfiles.find((profile) => profile.id === draft.characterId);
      if (selectedProfile) {
        const selectedCast = this.#el("div", "cinema-preparation-cast");
        const selectedCopy = this.#el("span", "cinema-preparation-cast__copy");
        selectedCopy.append(this.#el("small", "cinema-structural", "ORIGINAL CHARACTER  /  READ ONLY"), this.#dynamicText("strong", "", selectedProfile.displayName, "display"), this.#dynamicText("span", "", briefText(selectedProfile.summary || selectedProfile.identity), "reading"));
        const change = this.#button("更换角色", "cinema-preparation-cast__change", () => this.#go("cast", { mode: "prepare", returnRoute: "prep", selectedCharacterId: selectedProfile.id }));
        selectedCast.append(selectedCopy, change);
        castSection.append(selectedCast);
      } else if (archive.runtimeProfiles.length) {
        castSection.append(this.#button("打开选角册", "cinema-button cinema-button--outline cinema-preparation-cast__open", () => this.#go("cast", { mode: "prepare", returnRoute: "prep" })));
      } else {
        const empty = this.#el("div", "cinema-inline-empty");
        empty.append(this.#icon("database"), this.#el("strong", "", "档案馆里还没有角色"), this.#el("p", "", "Cinema 不在这里复制或新建核心角色。先把角色放进档案馆，再回来选角。"));
        empty.append(this.#button("前往档案馆", "cinema-button cinema-button--outline", () => this.context.services.launchApp?.("archive", "characters")));
        castSection.append(empty);
      }
      const playerName = this.#input(draft.playerName, "你希望节目单如何署名");
      const playerRole = this.#input(draft.playerRole, roleConfiguration.playerRolePlaceholder || "描述你在本场故事中的身份");
      playerName.addEventListener("input", () => this.store.updateDraft({ playerName: playerName.value }));
      playerRole.addEventListener("input", () => this.store.updateDraft({ playerRole: playerRole.value }));
      castSection.append(this.#field("你的署名", playerName), this.#field(roleConfiguration.playerRoleLabel || "你的身份", playerRole, roleConfiguration.playerRoleHint || "身份可以普通、具体，也可以仍未决定。"));
      content.append(castSection);

      const directionSection = this.#el("section", "cinema-prep-section");
      directionSection.append(this.#el("p", "cinema-structural", stage.presentation.preparationKicker || "III · RELATIONSHIP AND HISTORY"), this.#el("h3", "cinema-display", stage.presentation.preparationTitle || "关系与共同经历"));
      const relation = this.#select(model.relationshipOptions, draft.relationshipStart);
      const history = this.#textarea(draft.sharedHistory, roleConfiguration.sharedHistoryPlaceholder || "写下故事开始前已经共同经历的事；也可以留空。", 4);
      relation.addEventListener("change", () => this.store.updateDraft({ relationshipStart: relation.value }));
      history.addEventListener("input", () => this.store.updateDraft({ sharedHistory: history.value }));
      if (model.specializations.length) {
        const playerSpec = this.#select(model.specializations, draft.playerSpecialization);
        const charSpec = this.#select(model.specializations, draft.characterSpecialization);
        playerSpec.addEventListener("change", () => this.store.updateDraft({ playerSpecialization: playerSpec.value }));
        charSpec.addEventListener("change", () => this.store.updateDraft({ characterSpecialization: charSpec.value }));
        directionSection.append(this.#field("你的方向", playerSpec), this.#field("角色的方向", charSpec));
      }
      directionSection.append(this.#field("关系起点", relation), this.#field("共同经历", history, "留空也可以，故事会从当前关系自然开始。"));
      content.append(directionSection);
      const next = this.#button("审阅角色变体", "cinema-button cinema-button--crimson cinema-sticky-action", () => {
        const current = this.store.snapshot().draft;
        if (!current?.characterSnapshot?.id) return this.#showInlineNotice(content, "请先从档案馆选择一位核心角色。", "character-required");
        this.store.updateDraft({ variant: contracts().buildCharacterVariant(current.characterSnapshot, current, this.catalog) });
        this.#go("variant");
      });
      if (!archive.runtimeProfiles.length) next.disabled = true;
      content.append(next);
      paper.append(content);
      screen.append(paper);
      return screen;
    }

    #renderVariant() {
      let draft = this.store.snapshot().draft;
      if (!draft?.characterSnapshot?.id) return this.#redirectScreen("prep");
      const stage = this.catalog.getStage(draft.stageId);
      if (!stage) return this.#redirectScreen("lobby");
      if (!draft.variant) draft = this.store.updateDraft({ variant: contracts().buildCharacterVariant(draft.characterSnapshot, draft, this.catalog) });
      const variant = draft.variant;
      const model = buildCharacterAdaptationModel(draft, stage);
      const screen = this.#el("section", "cinema-screen cinema-adaptation");
      screen.dataset.cinemaView = "character-adaptation";

      const environment = this.#el("div", "cinema-adaptation__environment");
      environment.setAttribute("aria-hidden", "true");
      environment.append(this.#el("span", "cinema-adaptation__light"), this.#el("span", "cinema-adaptation__axis"));
      screen.append(environment);

      const header = this.#el("header", "cinema-adaptation__header");
      const titleBlock = this.#el("div", "cinema-adaptation__title");
      titleBlock.append(this.#el("strong", "", "角色适配"), this.#el("small", "", "ADAPTATION"));
      header.append(
        this.#glyphButton("back", "返回选角册", () => this.#go(this.routeData?.returnRoute || "cast", this.routeData?.returnData || { mode: "prepare" }), "cinema-adaptation__back"),
        titleBlock,
        this.#el("span", "cinema-adaptation__title-tick"),
      );
      screen.append(header);

      const identityLine = this.#dynamicText("p", "cinema-adaptation__identity", model.identityLine, "display");
      identityLine.dataset.source = "characterSnapshot.displayName+stage.title";
      identityLine.classList.add(model.identityLine.length > 18 ? "is-long" : model.identityLine.length > 12 ? "is-medium" : "is-short");
      screen.append(identityLine);

      const rail = this.#el("aside", "cinema-adaptation__rail");
      rail.setAttribute("aria-hidden", "true");
      [["排演笔记", "REHEARSAL NOTE"], ["人物内核", "CORE"], ["世界适配", "ADAPT"], ["导演批注", "DIRECTOR NOTE"]].forEach(([title, label]) => {
        const item = this.#el("span", "cinema-adaptation__rail-item");
        item.append(this.#el("i"), this.#el("b", "", title), this.#el("small", "", label));
        rail.append(item);
      });
      screen.append(rail);

      const coreBack = this.#el("div", "cinema-adaptation__sheet cinema-adaptation__sheet--core-back");
      coreBack.setAttribute("aria-hidden", "true");
      const coreSheet = this.#el("section", "cinema-adaptation__sheet cinema-adaptation__sheet--core");
      coreSheet.append(this.#el("span", "cinema-adaptation__paper-index", "I · CORE"));
      coreSheet.append(this.#dynamicText("h1", "", "必须保留", "display"));
      const coreRule = this.#el("span", "cinema-adaptation__sheet-rule");
      coreRule.append(this.#el("i"), this.#el("b"));
      coreSheet.append(coreRule);
      const coreList = this.#el("ul", "cinema-adaptation__core-list");
      model.coreItems.forEach((item) => {
        const row = this.#dynamicText("li", "", item.text, "reading");
        row.dataset.source = `characterSnapshot.${item.source}`;
        coreList.append(row);
      });
      coreSheet.append(coreList);
      screen.append(coreBack, coreSheet);

      const fieldControls = {};
      const worldBack = this.#el("div", "cinema-adaptation__sheet cinema-adaptation__sheet--world-back");
      worldBack.setAttribute("aria-hidden", "true");
      const worldSheet = this.#el("section", "cinema-adaptation__sheet cinema-adaptation__sheet--world");
      worldSheet.append(this.#el("span", "cinema-adaptation__paper-index", "II · ADAPT"));
      worldSheet.append(this.#dynamicText("h2", "", "在这个世界", "display"));
      const worldRule = this.#el("span", "cinema-adaptation__sheet-rule");
      worldRule.append(this.#el("i"), this.#el("b"));
      worldSheet.append(worldRule);
      const fields = this.#el("div", "cinema-adaptation__fields");
      model.fields.forEach((field, index) => {
        const row = this.#el("label", "cinema-adaptation__field");
        const label = this.#el("span", "cinema-adaptation__field-label", field.label);
        const control = index === 0 ? this.#input(field.value, stage.roleConfiguration.characterRolePlaceholder || "描述角色在本场世界中的身份") : this.#textarea(field.value, index === 1 ? "角色在这个世界的成长和经历" : stage.roleConfiguration.expressionPlaceholder || "核心人格在当前环境中的具体表现", 2);
        control.className = "cinema-adaptation__control";
        control.setAttribute("aria-label", field.label);
        control.dataset.source = field.source;
        fieldControls[field.key] = control;
        const edit = this.#glyphButton("edit", `编辑${field.label}`, () => control.focus(), "cinema-adaptation__edit");
        row.append(label, control, edit);
        fields.append(row);
      });
      const persistVariant = () => {
        const nextVariant = {
          ...variant,
          worldIdentity: fieldControls.worldIdentity.value,
          contextBackground: fieldControls.contextBackground.value,
          expression: fieldControls.expression.value,
          userEdited: true,
        };
        this.store.updateDraft({ characterWorldIdentity: fieldControls.worldIdentity.value, variant: nextVariant });
      };
      Object.values(fieldControls).forEach((control) => control.addEventListener("input", persistVariant));
      worldSheet.append(fields);
      screen.append(worldBack, worldSheet);

      const notes = this.#el("aside", "cinema-adaptation__notes");
      notes.setAttribute("aria-label", "排演批注");
      model.notes.forEach((note) => {
        const text = this.#dynamicText("p", `cinema-adaptation__hand-note ${note.className}`, note.text, "handwriting");
        text.dataset.source = note.source;
        text.append(this.#el("i"));
        notes.append(text);
      });
      screen.append(notes);

      const warning = this.#el("p", "cinema-adaptation__warning");
      warning.append(this.#glyph("warning"), this.#el("span", "", "仅写入本场角色变体，不改写原始角色。"));
      screen.append(warning);

      const actions = this.#el("footer", "cinema-adaptation__actions");
      actions.append(
        this.#button("修改理解", "cinema-adaptation__action cinema-adaptation__action--revise", () => fieldControls.worldIdentity.focus()),
        this.#button("确认适配", "cinema-adaptation__action cinema-adaptation__action--confirm", () => {
          try {
            this.#ensureDraftGenerationProfile();
            this.#go("before-curtain", { variantReturnData: this.routeData || null });
          } catch (error) {
            this.#showInlineNotice(screen, error?.message || "暂时无法保存本场筹备。", "before-curtain-route");
          }
        }),
      );
      screen.append(actions);
      return screen;
    }

    #renderProfilePicker() {
      const draft = this.store.snapshot().draft;
      if (!draft) return this.#redirectScreen("prep");
      const profiles = this.profileStore.list();
      const returnRoute = this.routeData?.returnRoute || "variant";
      const returnData = this.routeData?.returnData || null;
      const screen = this.#el("section", "cinema-screen cinema-paper-screen");
      screen.append(this.#pageHeader("演绎方式", returnRoute, null, returnData));
      const paper = this.#paper();
      const content = this.#el("article", "cinema-profile-picker");
      content.append(this.#sectionLabel("GENERATION PROFILE", "这一场怎样被写出来", "演绎方式约束节奏、文风与互动倾向，不负责改写角色是谁。"));
      profiles.forEach((profile) => {
        const selected = draft.generationProfileId === profile.id;
        const summary = this.#profileSummary(profile);
        const button = this.#button("", `cinema-profile-option${selected ? " is-selected" : ""}`, () => {
          this.store.updateDraft({ generationProfileId: profile.id, generationProfileSnapshot: clone(profile) });
          this.#renderRoute();
        });
        const copy = this.#el("span", "cinema-profile-option__copy");
        copy.append(this.#el("strong", "", profile.name), this.#el("small", "", summary));
        button.append(copy, this.#icon(selected ? "check-circle" : "nav-arrow-right"));
        content.append(button);
      });
      const current = profiles.find((profile) => profile.id === draft.generationProfileId) || profiles[0];
      if (!draft.generationProfileSnapshot && current) this.store.updateDraft({ generationProfileId: current.id, generationProfileSnapshot: clone(current) });
      content.append(this.#el("p", "cinema-footnote", "放映中切换演绎方式，只会影响下一次续写。已经生成的正文不会改变。"), this.#button("保存演绎方式", "cinema-button cinema-button--crimson cinema-sticky-action", () => this.#go(returnRoute, returnData)));
      paper.append(content);
      screen.append(paper);
      return screen;
    }

    #profileSummary(profile) {
      if (profile.id === "preset-default") return "平衡节奏 · 尊重角色档案 · 常规主动性";
      if (profile.description) return profile.description;
      const blocks = Array.isArray(profile.instructionBlocks) ? profile.instructionBlocks.filter((item) => item.enabled && item.runtimeEligible !== false).length : 0;
      return blocks ? `${blocks} 条已启用演绎约束` : "自定义的节奏与文风安排";
    }

    #renderBeforeCurtain() {
      let draft = this.#ensureDraftGenerationProfile();
      const model = buildBeforeCurtainModel(this.catalog, draft, contracts().RELATIONSHIP_STARTS);
      if (!model) return this.#redirectScreen(draft?.characterSnapshot?.id ? "lobby" : "cast");
      draft = this.store.snapshot().draft;

      const screen = this.#el("section", "cinema-screen cinema-before-curtain");
      screen.dataset.cinemaView = "before-curtain";
      const environment = this.#el("div", "cinema-before-curtain__environment");
      environment.setAttribute("aria-hidden", "true");
      environment.append(
        this.#el("span", "cinema-before-curtain__wing cinema-before-curtain__wing--left"),
        this.#el("span", "cinema-before-curtain__wing cinema-before-curtain__wing--right"),
        this.#el("span", "cinema-before-curtain__seam"),
        this.#el("span", "cinema-before-curtain__threshold"),
      );

      const header = this.#el("header", "cinema-before-curtain__header");
      const identity = this.#el("div", "cinema-before-curtain__identity");
      identity.append(this.#dynamicText("strong", "", "开幕之前", "display"), this.#el("small", "", "BEFORE THE CURTAIN"));
      header.append(
        this.#glyphButton("back", "返回角色适配", () => this.#go("variant", this.routeData?.variantReturnData || null), "cinema-before-curtain__back"),
        identity,
        this.#el("span", "cinema-before-curtain__header-mark"),
      );

      const scroller = this.#el("main", "cinema-before-curtain__scroll");
      const context = this.#el("p", "cinema-before-curtain__context");
      context.append(
        this.#el("span", "", model.stage.title),
        this.#el("i"),
        this.#el("span", "", model.characterName),
      );
      scroller.append(context);

      const opening = this.#el("section", "cinema-before-curtain__question cinema-before-curtain__question--opening");
      opening.append(this.#el("p", "cinema-editorial-micro", "I  /  OPENING SETUP"), this.#dynamicText("h1", "", "这一生从哪里开始？", "display"));
      const openingRule = this.#el("span", "cinema-before-curtain__rule");
      openingRule.append(this.#el("i"), this.#el("b"));
      const openingValue = this.#dynamicText("p", "cinema-before-curtain__value", model.openingLabel, "reading");
      opening.append(openingRule, openingValue);
      const openingDetail = model.openingDetail ? this.#dynamicText("p", "cinema-before-curtain__detail", model.openingDetail, "ui") : null;
      if (openingDetail) opening.append(openingDetail);

      const openingEditor = this.#el("div", "cinema-before-curtain__editor");
      openingEditor.hidden = true;
      if (model.scenarioOptions.length > 1) {
        const scenarioSelect = this.#el("select", "cinema-before-curtain__control");
        scenarioSelect.setAttribute("aria-label", "开场方案");
        model.scenarioOptions.forEach((item) => {
          const option = this.#el("option", "", item.title);
          option.value = item.id;
          option.selected = item.id === model.scenario.id;
          scenarioSelect.append(option);
        });
        scenarioSelect.addEventListener("change", () => {
          const nextScenario = this.catalog.getScenario(model.stage.id, scenarioSelect.value);
          this.store.updateDraft({ scenarioId: scenarioSelect.value, entryPeriod: nextScenario?.defaultEntryPeriod || nextScenario?.entryPeriods?.[0] || "" });
          this.#renderRoute();
        });
        openingEditor.append(this.#el("label", "cinema-before-curtain__control-label", "开场方案"), scenarioSelect);
      }
      if (model.entryPeriods.length) {
        const entryPeriod = this.#select(model.entryPeriods, draft.entryPeriod);
        entryPeriod.className = "cinema-before-curtain__control";
        entryPeriod.setAttribute("aria-label", "进入时间");
        entryPeriod.addEventListener("change", () => {
          this.store.updateDraft({ entryPeriod: entryPeriod.value });
          if (openingDetail) openingDetail.textContent = entryPeriod.value;
        });
        openingEditor.append(this.#el("label", "cinema-before-curtain__control-label", "进入时间"), entryPeriod);
      }
      if (openingEditor.children.length) {
        const editOpening = this.#button("", "cinema-before-curtain__edit", () => {
          openingEditor.hidden = !openingEditor.hidden;
          opening.classList.toggle("is-editing", !openingEditor.hidden);
          editOpening.setAttribute("aria-expanded", String(!openingEditor.hidden));
        });
        editOpening.setAttribute("aria-expanded", "false");
        editOpening.append(this.#el("span", "", "调整开场"), this.#glyph("arrow-east"));
        opening.append(editOpening, openingEditor);
      } else {
        opening.append(this.#el("p", "cinema-before-curtain__fixed-note", "当前世界仅提供这一种开场。"));
      }
      scroller.append(opening);

      const historySection = this.#el("section", "cinema-before-curtain__question cinema-before-curtain__question--history");
      historySection.append(this.#el("p", "cinema-editorial-micro", "II  /  SHARED HISTORY"), this.#dynamicText("h2", "", "幕启时，我们是谁？", "display"));
      const historyRule = this.#el("span", "cinema-before-curtain__rule");
      historyRule.append(this.#el("i"), this.#el("b"));
      const historyValue = this.#dynamicText("p", "cinema-before-curtain__value", model.historySummary, "reading");
      historySection.append(historyRule, historyValue);
      const historyEditor = this.#el("div", "cinema-before-curtain__editor");
      historyEditor.hidden = true;
      const relationship = this.#select(model.relationshipOptions, draft.relationshipStart);
      relationship.className = "cinema-before-curtain__control";
      relationship.setAttribute("aria-label", "关系起点");
      const sharedHistory = this.#textarea(draft.sharedHistory, model.stage.roleConfiguration.sharedHistoryPlaceholder || "写下幕启之前已经共同经历的事；也可以留空。", 4);
      sharedHistory.className = "cinema-before-curtain__control cinema-before-curtain__control--history";
      sharedHistory.setAttribute("aria-label", "共同经历");
      const syncHistory = () => {
        this.store.updateDraft({ relationshipStart: relationship.value, sharedHistory: sharedHistory.value });
        historyValue.textContent = sharedHistory.value.trim() ? `${relationship.value} · ${sharedHistory.value.trim()}` : relationship.value;
      };
      relationship.addEventListener("change", syncHistory);
      sharedHistory.addEventListener("input", syncHistory);
      historyEditor.append(
        this.#el("label", "cinema-before-curtain__control-label", "关系起点"), relationship,
        this.#el("label", "cinema-before-curtain__control-label", "共同经历"), sharedHistory,
      );
      const editHistory = this.#button("", "cinema-before-curtain__edit", () => {
        historyEditor.hidden = !historyEditor.hidden;
        historySection.classList.toggle("is-editing", !historyEditor.hidden);
        editHistory.setAttribute("aria-expanded", String(!historyEditor.hidden));
      });
      editHistory.setAttribute("aria-expanded", "false");
      editHistory.append(this.#el("span", "", "改写共同经历"), this.#glyph("arrow-east"));
      historySection.append(editHistory, historyEditor);
      scroller.append(historySection);

      const profile = this.#button("", "cinema-before-curtain__profile", () => this.#go("profile", { returnRoute: "before-curtain", returnData: this.routeData || null }));
      profile.append(this.#el("span", "", "演绎方式"), this.#el("b", "", model.generationProfileName), this.#glyph("arrow-east"));
      scroller.append(profile);
      if (this.routeData?.error) scroller.append(this.#el("p", "cinema-before-curtain__error", this.routeData.error));

      const actions = this.#el("footer", "cinema-before-curtain__actions");
      const open = this.#button("", "cinema-before-curtain__open", () => {
        const ready = this.#ensureDraftGenerationProfile();
        if (!ready?.generationProfileSnapshot?.id) {
          this.#go("profile", { returnRoute: "before-curtain", returnData: this.routeData || null });
          return;
        }
        this.#openCurtain(screen, "opening");
      });
      open.setAttribute("aria-label", "开幕");
      open.append(this.#el("i"), this.#el("b"), this.#dynamicText("span", "", "开幕", "display"), this.#el("b"), this.#el("i"));
      actions.append(open);

      screen.append(environment, header, scroller, actions);
      return screen;
    }

    #renderReading() {
      const instance = this.store.focused();
      if (!instance) return this.#redirectScreen("lobby");
      if (instance.status === "intermission") return this.#redirectScreen("intermission");
      if (instance.status === "ending") { this.curtainMode = "ending"; return this.#redirectScreen("curtain"); }
      const settings = this.store.snapshot().readingSettings;
      const screen = this.#el("section", `cinema-screen cinema-reading cinema-reading--${settings.theme}`);
      screen.style.setProperty("--cinema-reader-scale", String(settings.fontScale));
      screen.dataset.lineHeight = settings.lineHeight;
      const currentScene = instance.scenes.find((scene) => scene.id === instance.currentSceneId) || instance.scenes.at(-1);
      const savedViewport = this.readingViewport.instanceId === instance.id
        ? { ...this.readingViewport }
        : { instanceId: instance.id, top: 0, atEnd: true, initialized: false };
      this.readingViewport = savedViewport;

      const stage = this.#el("div", "cinema-reading__stage");
      stage.setAttribute("aria-hidden", "true");
      stage.append(this.#el("i", "cinema-reading__wing cinema-reading__wing--left"), this.#el("i", "cinema-reading__wing cinema-reading__wing--right"), this.#el("i", "cinema-reading__threshold"));
      const header = this.#el("header", "cinema-reading__header");
      const programmeExit = this.#button("", "cinema-reading__programme-exit", () => this.#returnToProgramme());
      programmeExit.setAttribute("aria-label", "返回节目单");
      programmeExit.append(this.#glyph("back"), this.#el("span", "", "节目单"));
      header.append(programmeExit, this.#el("span", "cinema-reading__header-rule"), this.#glyphButton("ellipsis", "放映菜单", () => { this.menuOpen = true; this.#renderRoute(); }, "cinema-reading__menu-trigger"));
      const scroller = this.#el("main", "cinema-reading__scroll");
      instance.scenes.forEach((scene) => {
        const section = this.#el("section", `cinema-reading__scene${scene.id === currentScene?.id ? " is-current" : ""}`);
        const heading = this.#el("header", "cinema-scene-heading");
        const act = this.#el("div", "cinema-scene-heading__act");
        act.append(
          this.#dynamicText("p", "cinema-scene-heading__act-zh", `第${this.#chineseNumber(scene.actNumber)}幕`, "display"),
          this.#el("p", "cinema-structural cinema-scene-heading__act-en", `ACT ${this.#roman(scene.actNumber)}`),
        );
        const register = this.#el("span", "cinema-scene-heading__register");
        register.setAttribute("aria-hidden", "true");
        heading.append(
          register,
          act,
          this.#dynamicText("h2", "cinema-scene-heading__title", scene.title, "display"),
          this.#el("p", "cinema-scene-heading__meta", `${instance.stageSnapshot.shortTitle || instance.stageSnapshot.title}  ·  SCENE ${pad(scene.sceneNumber)}`),
        );
        section.append(heading);
        instance.segments.filter((segment) => segment.sceneId === scene.id).forEach((segment, index, sceneSegments) => section.append(this.#renderSegment(segment, index === sceneSegments.length - 1)));
        scroller.append(section);
      });
      const workflowState = this.workflow.snapshot();
      if (workflowState.phase === "running") {
        const generating = this.#el("section", "cinema-generating");
        generating.setAttribute("role", "status");
        generating.setAttribute("aria-live", "polite");
        generating.setAttribute("aria-busy", "true");
        generating.append(this.#el("p", "cinema-structural", "PERFORMANCE IN PROGRESS"), this.#dynamicText("p", "cinema-generating__title", "演出仍在继续", "display"));
        for (let index = 0; index < 3; index += 1) generating.append(this.#el("span", "cinema-generating__line"));
        let cancelRequested = false;
        const cancelLabel = this.#el("span", "", "中止本次演绎");
        const cancel = this.#button("", "cinema-generating__cancel", () => {
          if (cancelRequested) return;
          cancelRequested = true;
          cancel.disabled = true;
          cancel.setAttribute("aria-busy", "true");
          cancelLabel.textContent = "正在中止";
          if (this.workflow.cancel() !== false) return;
          cancelRequested = false;
          cancel.disabled = false;
          cancel.setAttribute("aria-busy", "false");
          cancelLabel.textContent = "中止本次演绎";
        });
        cancel.append(cancelLabel, this.#glyph("arrow-east"));
        generating.append(cancel);
        scroller.append(generating);
      }
      const generationError = instance.pendingContinuation && instance.lastError?.code !== "CINEMA_PENDING_CONTINUATION_INVALID"
        ? {
            ...(instance.lastError || {}),
            code: instance.lastError?.code || "CINEMA_PENDING_CONTINUATION_RECOVERABLE",
            message: instance.lastError?.message || "上次续写在完成保存前中断。原始文字仍在，只有你明确重试时才会再次请求。",
            retryable: true,
            recovery: instance.lastError?.recovery || "cinema-pending",
          }
        : instance.lastError;
      if (generationError) scroller.append(this.#generationError(generationError));
      screen.append(stage, header, scroller);
      if (workflowState.phase !== "running" && !instance.pendingContinuation) {
        const composer = this.#el("form", "cinema-composer");
        composer.setAttribute("aria-label", "续写演出");
        const area = this.#textarea("", "你要怎么做？", 1);
        area.classList.add("cinema-composer__input");
        area.setAttribute("aria-label", "写下接下来发生的事或你的行动");
        area.maxLength = 16000;
        let commitInFlight = false;
        let send;
        const resizeWritingArea = () => {
          const hasText = Boolean(area.value.trim());
          const isWriting = hasText || document.activeElement === area;
          composer.classList.toggle("has-text", hasText);
          composer.classList.toggle("is-expanded", isWriting);
          screen.classList.toggle("is-writing", isWriting);
          area.style.height = "auto";
          const writingHeight = Math.min(area.scrollHeight, 252);
          area.style.height = `${writingHeight}px`;
          area.classList.toggle("is-overflowing", area.scrollHeight > writingHeight);
          screen.style.setProperty("--cinema-writing-clearance", `${Math.max(writingHeight, 78) + 82}px`);
          if (send) send.disabled = !hasText || commitInFlight;
          if (isWriting && this.readingViewport.atEnd) {
            global.requestAnimationFrame(() => {
              if (this.readingViewport.instanceId === instance.id && this.readingViewport.atEnd) {
                this.#setReadingScroll(scroller, instance.id, scroller.scrollHeight, true);
              }
            });
          }
        };
        area.addEventListener("focus", () => {
          const shouldFollow = this.readingViewport.instanceId !== instance.id || this.readingViewport.atEnd;
          resizeWritingArea();
          if (shouldFollow) {
            const settleTimer = global.setTimeout(() => {
              if (this.readingViewport.instanceId === instance.id && this.readingViewport.atEnd) {
                this.#setReadingScroll(scroller, instance.id, scroller.scrollHeight, true);
              }
            }, 420);
            this.timers.add(settleTimer);
          }
        });
        area.addEventListener("blur", resizeWritingArea);
        area.addEventListener("input", resizeWritingArea);
        scroller.addEventListener("pointerdown", () => {
          if (document.activeElement === area) area.blur();
        });
        const commitPassage = async () => {
          const value = area.value.trim();
          if (!value || commitInFlight || this.workflow.snapshot().phase === "running") return;
          commitInFlight = true;
          send.disabled = true;
          send.setAttribute("aria-busy", "true");
          area.disabled = true;
          area.value = "";
          area.blur();
          composer.hidden = true;
          try {
            await this.workflow.continueWith(value);
          } finally {
            if (!this.unmounted && this.route === "reading") this.#renderRoute();
          }
        };
        send = this.#glyphButton("arrow-east", "将这段文字写入故事", commitPassage, "cinema-composer__send");
        send.disabled = true;
        composer.append(area, send);
        composer.addEventListener("submit", (event) => {
          event.preventDefault();
          commitPassage();
        });
        screen.append(composer);
      }
      if (this.menuOpen) screen.append(this.#readingMenu());
      scroller.addEventListener("scroll", () => this.#rememberReadingScroll(scroller, instance.id));
      const timer = global.setTimeout(() => {
        const shouldFollow = !savedViewport.initialized || savedViewport.atEnd;
        const target = shouldFollow ? scroller.scrollHeight : savedViewport.top;
        this.#setReadingScroll(scroller, instance.id, target, shouldFollow);
      }, 0);
      this.timers.add(timer);
      const fontsReady = document.fonts?.ready;
      if (fontsReady?.then) fontsReady.then(() => {
        if (this.unmounted || screen.parentElement !== this.root) return;
        if (this.readingViewport.instanceId !== instance.id || !this.readingViewport.atEnd) return;
        global.requestAnimationFrame(() => this.#setReadingScroll(scroller, instance.id, scroller.scrollHeight, true));
      });
      return screen;
    }

    #renderSegment(segment, isLatest) {
      if (segment.role === "user") {
        const block = this.#el("blockquote", "cinema-user-passage");
        block.append(this.#el("span", "cinema-user-passage__mark"), this.#dynamicText("p", "", segment.text, "reading"));
        return block;
      }
      const article = this.#el("article", `cinema-prose${isLatest ? " cinema-prose--latest" : ""}`);
      segment.text.split(/\n\s*\n|\n/).map((part) => part.trim()).filter(Boolean).forEach((paragraph) => article.append(this.#dynamicText("p", "", paragraph, "reading")));
      return article;
    }

    #generationError(error) {
      const callout = this.#el("section", "cinema-generation-error");
      const cancelled = error.code === "CINEMA_GENERATION_CANCELLED";
      callout.dataset.state = cancelled ? "cancelled" : error.recovery === "cinema-pending" ? "pending" : "failed";
      callout.setAttribute("role", "status");
      callout.setAttribute("aria-live", "polite");
      callout.append(
        this.#el("span", "cinema-generation-error__register"),
        this.#el("p", "cinema-structural", cancelled ? "PERFORMANCE HELD" : "THE PERFORMANCE PAUSED"),
        this.#dynamicText("h3", "cinema-generation-error__title", cancelled ? "演出停在这里" : "刚才的文字已经保留", "display"),
        this.#dynamicText("p", "cinema-generation-error__body", error.message || "演绎暂时无法继续。", "reading"),
      );
      const actions = this.#el("div", "cinema-generation-error__actions");
      if (error.retryable !== false) {
        let retryRequested = false;
        const retryLabel = this.#el("span", "", "重试续写");
        const retry = this.#button("", "cinema-generation-error__action", async () => {
          if (retryRequested) return;
          retryRequested = true;
          retry.disabled = true;
          retry.setAttribute("aria-busy", "true");
          retryLabel.textContent = "正在重试";
          try {
            await this.workflow.retry();
          } finally {
            if (!this.unmounted && this.route === "reading") this.#renderRoute();
          }
        });
        retry.append(retryLabel, this.#glyph("arrow-east"));
        actions.append(retry);
      }
      if (error.recovery === "ai-connection") {
        const settings = this.#button("", "cinema-generation-error__action cinema-generation-error__action--quiet", () => this.context.services.launchApp?.("settings", "ai-connection"));
        settings.append(this.#el("span", "", "检查 AI 连接"), this.#glyph("arrow-east"));
        actions.append(settings);
      }
      callout.append(actions);
      return callout;
    }

    #readingMenu() {
      const layer = this.#el("section", "cinema-menu-layer");
      layer.addEventListener("click", (event) => { if (event.target === layer) { this.menuOpen = false; this.#renderRoute(); } });
      const menu = this.#el("article", "cinema-reading-menu");
      const head = this.#el("header", "cinema-reading-menu__head");
      head.append(this.#dynamicText("h2", "cinema-reading-menu__title", "放映菜单", "display"), this.#glyphButton("close", "关闭", () => { this.menuOpen = false; this.#renderRoute(); }));
      menu.append(head);
      const rows = [
        ["registration", "场记", "查看本场连续性与重要信息", () => this.#go("notes")],
        ["edit", "阅读设置", "字号、行距与阅读明度", () => this.#go("settings")],
        ["diamond", "中场休息", "安全暂停，稍后继续", () => { const active = this.store.focused(); if (active) this.store.intermission(active.id); this.#go("intermission"); }],
        ["orbit", "结束本场演出", "确认后谢幕并归档", () => this.#go("ending")],
      ];
      rows.forEach(([glyph, title, body, action]) => {
        const button = this.#button("", "cinema-menu-row", action);
        const copy = this.#el("span");
        copy.append(this.#dynamicText("strong", "", title, "ui"), this.#dynamicText("small", "", body, "ui"));
        button.append(this.#glyph(glyph), copy, this.#glyph("arrow-east"));
        menu.append(button);
      });
      layer.append(menu);
      return layer;
    }

    #rememberReadingScroll(scroller, instanceId) {
      const top = Math.max(0, Number(scroller.scrollTop) || 0);
      const height = Math.max(0, Number(scroller.scrollHeight) || 0);
      const viewport = Math.max(0, Number(scroller.clientHeight) || 0);
      this.readingViewport = {
        instanceId,
        top,
        atEnd: height - viewport - top <= 72,
        initialized: true,
      };
    }

    #setReadingScroll(scroller, instanceId, requestedTop, atEnd) {
      const height = Math.max(0, Number(scroller.scrollHeight) || 0);
      const viewport = Math.max(0, Number(scroller.clientHeight) || 0);
      const top = Math.max(0, Math.min(Number(requestedTop) || 0, Math.max(0, height - viewport)));
      scroller.scrollTop = top;
      this.readingViewport = { instanceId, top, atEnd: Boolean(atEnd), initialized: true };
    }

    #renderIntermission() {
      const instance = this.store.focused();
      if (!instance) return this.#redirectScreen("lobby");
      const model = intermissionProjection()?.buildCinemaIntermissionProjection?.(instance, this.workflow?.snapshot?.());
      if (!model) return this.#redirectScreen("reading");
      const screen = this.#el("section", `cinema-screen cinema-intermission cinema-intermission--${model.mode}`);
      screen.dataset.intermissionMode = model.mode;
      screen.dataset.structureProvenance = model.structureProvenance;
      screen.dataset.recapReliable = String(model.recapReliable);

      const stage = this.#el("div", "cinema-intermission__stage");
      stage.setAttribute("aria-hidden", "true");
      stage.append(
        this.#el("i", "cinema-intermission__oxblood"),
        this.#el("i", "cinema-intermission__curtain cinema-intermission__curtain--left"),
        this.#el("i", "cinema-intermission__curtain cinema-intermission__curtain--right"),
        this.#el("i", "cinema-intermission__seam"),
        this.#el("i", "cinema-intermission__floor"),
      );

      const brand = this.#el("header", "cinema-intermission__brand");
      const brandAxis = this.#el("span", "cinema-intermission__brand-axis");
      brandAxis.append(this.#glyph("star-axis"));
      brand.append(brandAxis, this.#el("span", "", "MERCURY CINEMA"));

      const identity = this.#el("section", "cinema-intermission__identity");
      identity.append(
        this.#dynamicText("h1", "", "中场休息", "display"),
        this.#el("p", "cinema-editorial-micro", "INTERMISSION"),
      );

      const pause = this.#el("section", "cinema-intermission__pause");
      const pauseRule = this.#el("span", "cinema-intermission__section-rule");
      pauseRule.setAttribute("aria-hidden", "true");
      pauseRule.append(this.#glyph("star-small"), this.#el("i"));
      pause.append(pauseRule, this.#dynamicText("p", "", model.stateCopy, "reading"));

      const detail = this.#el("section", "cinema-intermission__detail");
      if (model.position) {
        detail.append(
          this.#dynamicText("p", "cinema-intermission__position", model.position.label, "reading"),
          this.#dynamicText("h2", "cinema-intermission__location", model.position.location, "display"),
        );
      } else {
        detail.append(this.#el("p", "cinema-editorial-micro cinema-intermission__neutral-label", "PERFORMANCE HELD"));
      }
      const detailRule = this.#el("span", "cinema-intermission__detail-rule");
      detailRule.setAttribute("aria-hidden", "true");
      detailRule.append(this.#el("i"), this.#glyph("diamond-point"), this.#el("i"));
      const recap = this.#dynamicText("p", "cinema-intermission__recap", model.mode === "paused" ? model.recap : model.stateCopy, "reading");
      const notes = this.#button("", "cinema-intermission__notes", () => this.#go("notes"));
      notes.append(this.#dynamicText("span", "", model.notesAction.label, "reading"), this.#glyph("star-small"));
      detail.append(detailRule, recap, notes);

      const actions = this.#el("footer", "cinema-intermission__actions");
      let actionStarted = false;
      const primary = this.#button("", "cinema-intermission__primary", () => {
        if (actionStarted) return;
        actionStarted = true;
        primary.disabled = true;
        primary.setAttribute("aria-busy", "true");
        if (model.primaryAction.kind === "resume") {
          this.#continueInstance(instance);
          return;
        }
        if (instance.status === "intermission") this.store.resume(instance.id);
        this.#go("reading");
      });
      primary.dataset.actionKind = model.primaryAction.kind;
      primary.append(
        this.#el("i"),
        this.#glyph("star-small"),
        this.#dynamicText("span", "", model.primaryAction.label, "display"),
        this.#glyph("star-small"),
        this.#el("i"),
      );
      const actionRule = this.#el("span", "cinema-intermission__action-rule");
      actionRule.setAttribute("aria-hidden", "true");
      actionRule.append(this.#el("i"), this.#glyph("diamond-point"), this.#el("i"));
      const programme = this.#button(model.programmeAction.label, "cinema-intermission__programme", () => this.#returnToProgramme());
      actions.append(primary, actionRule, programme);

      screen.append(stage, brand, identity, pause, detail, actions, this.#glyph("registration-cross", "cinema-intermission__registration"));
      return screen;
    }

    #renderEndingConfirmation() {
      const instance = this.store.focused();
      if (!instance) return this.#redirectScreen("lobby");
      const generationState = this.workflow?.snapshot?.() || { phase: "idle" };
      const pending = instance.pendingContinuation;
      const pendingConfirm = Boolean(pending && this.routeData?.pendingConfirm && this.routeData?.expectedRequestId === pending.requestId);
      const mode = generationState.phase === "running" ? "in-flight" : pending ? pendingConfirm ? "pending-confirm" : "pending" : "normal";
      const screen = this.#el("section", `cinema-screen cinema-ending-confirmation cinema-ending-confirmation--${mode}`);
      screen.dataset.endingState = mode;
      const stage = this.#closureStage("confirmation");
      const content = this.#el("article", "cinema-ending-confirm");
      content.setAttribute("role", "dialog");
      content.setAttribute("aria-modal", "true");
      content.setAttribute("aria-labelledby", "cinemaEndingTitle");
      content.append(this.#el("p", "cinema-editorial-micro cinema-ending-confirm__kicker", mode === "in-flight" ? "REQUEST IN PROGRESS" : mode.startsWith("pending") ? "PENDING CONTINUATION" : "FINAL CALL"));
      const title = this.#dynamicText("h1", "cinema-ending-confirm__title", mode === "in-flight" ? "先结束本次续写" : mode === "pending-confirm" ? "确认放弃待续写？" : mode === "pending" ? "这次续写仍未完成" : "确认结束这场演出？", "display");
      title.id = "cinemaEndingTitle";
      content.append(title, this.#endingRule());
      const copy = mode === "in-flight"
        ? "当前续写请求仍在进行。请返回演出并明确取消，等待请求结束后再谢幕。"
        : mode === "pending-confirm"
          ? "确认后，尚未收到回应的续写会被放弃。你已经写下的段落仍会保留在这场演出中，然后演出会结束并移入节目单往期。"
          : mode === "pending"
            ? "普通谢幕不会清除或重试待续写。若决定结束，必须明确放弃这次未完成的回应；你已经写下的段落仍会保留。"
            : "确认后，这场演出会结束并移入节目单往期，此后不能继续续写。已经保存的正文与演出快照会保留。";
      content.append(this.#dynamicText("p", "cinema-ending-confirm__copy", copy, "reading"));
      const actions = this.#el("footer", "cinema-ending-confirm__actions");
      if (mode === "in-flight") {
        actions.append(this.#button("返回演出并取消续写", "cinema-ending-confirm__primary", () => this.#go("reading")));
      } else if (mode === "pending" || mode === "pending-confirm") {
        if (mode === "pending") {
          actions.append(this.#button("放弃这次待续写并谢幕", "cinema-ending-confirm__primary cinema-ending-confirm__primary--destructive", () => this.#go("ending", { pendingConfirm: true, expectedRequestId: pending.requestId })));
        } else {
          let actionStarted = false;
          const confirm = this.#button("确认放弃并谢幕", "cinema-ending-confirm__primary cinema-ending-confirm__primary--destructive", async () => {
            if (actionStarted) return;
            actionStarted = true;
            confirm.disabled = true;
            confirm.setAttribute("aria-busy", "true");
            try {
              const result = await this.closureWorkflow.abandonPendingAndBeginEnding(instance.id, pending.requestId);
              if (!result?.accepted || this.unmounted) return;
              this.creditsInstanceId = instance.id;
              this.curtainMode = "ending";
              this.#go("curtain");
            } catch (_error) {}
          });
          actions.append(confirm);
        }
      } else {
        let actionStarted = false;
        const confirm = this.#button("确认谢幕", "cinema-ending-confirm__primary", async () => {
          if (actionStarted) return;
          actionStarted = true;
          confirm.disabled = true;
          confirm.setAttribute("aria-busy", "true");
          try {
            const result = await this.closureWorkflow.beginEnding(instance.id);
            if (!result?.accepted || this.unmounted) return;
            this.creditsInstanceId = instance.id;
            this.curtainMode = "ending";
            this.#go("curtain");
          } catch (_error) {}
        });
        actions.append(confirm);
      }
      actions.append(this.#button("取消", "cinema-ending-confirm__cancel", () => this.#go("reading")));
      content.append(actions);
      screen.append(stage, content);
      return screen;
    }

    #renderCredits() {
      const instanceId = this.routeData?.instanceId || this.creditsInstanceId;
      const instance = this.store.get(instanceId);
      const credits = creditsProjection()?.buildCinemaCreditsProjection?.(instance);
      if (!credits) return this.#redirectScreen("programme");
      const screen = this.#el("section", "cinema-screen cinema-credits");
      screen.dataset.structureProvenance = credits.structureProvenance;
      const stage = this.#closureStage("credits");
      const roll = this.#el("main", "cinema-credits__composition");
      const brand = this.#el("header", "cinema-credits__brand");
      brand.append(this.#glyph("star-axis"), this.#el("span", "", "MERCURY CINEMA"));
      const identity = this.#el("section", "cinema-credits__identity");
      identity.append(this.#dynamicText("h1", "", "谢幕", "display"), this.#el("p", "cinema-editorial-micro", "THE END"));
      const title = this.#dynamicText("h2", "cinema-credits__performance", credits.title, "display");
      if (credits.title.length > 12) title.classList.add("is-long");
      const titleRule = this.#endingRule("cinema-credits__title-rule");
      const facts = this.#el("dl", "cinema-credits__facts");
      credits.metadata.forEach((entry) => {
        const row = this.#el("div", "cinema-credits__fact");
        row.dataset.fact = entry.key;
        row.append(this.#dynamicText("dt", "", entry.label, "reading"), this.#dynamicText("dd", "", entry.value, entry.key === "character" || entry.key === "world" || entry.key === "player" ? "display" : "reading"));
        facts.append(row);
      });
      const closing = this.#dynamicText("p", "cinema-credits__closing", credits.closingLine, "reading");
      const actions = this.#el("footer", "cinema-credits__actions");
      const history = this.#button(credits.primaryAction.label, "cinema-credits__primary", credits.historyAvailable ? () => this.#go("history", { instanceId: instance.id }) : null);
      history.disabled = !credits.historyAvailable;
      if (!credits.historyAvailable) {
        history.setAttribute("aria-label", "阅读完整节目册，暂未开放");
        history.title = "完整节目册将在下一阶段开放";
      }
      const programme = this.#button(credits.secondaryAction.label, "cinema-credits__programme", () => this.#go("programme"));
      actions.append(history, this.#endingRule("cinema-credits__action-rule"), programme);
      roll.append(brand, identity, titleRule, title, facts, this.#endingRule("cinema-credits__closing-rule"), closing, actions);
      screen.append(stage, roll);
      return screen;
    }

    #renderClosureFailure() {
      const closureState = this.closureWorkflow?.snapshot?.() || {};
      const error = this.routeData?.error || closureState.error || {};
      const operation = this.routeData?.operation || closureState.operation;
      const screen = this.#el("section", "cinema-screen cinema-closure-failure");
      screen.dataset.closureOperation = operation || "unknown";
      const content = this.#el("article", "cinema-closure-failure__content");
      content.setAttribute("role", "alert");
      content.append(
        this.#el("p", "cinema-editorial-micro", "STORAGE RECOVERY"),
        this.#dynamicText("h1", "", "谢幕尚未保存", "display"),
        this.#endingRule(),
        this.#dynamicText("p", "", error.message || "Mercury 无法确认本次谢幕已经安全保存，因此不会显示 Credits。", "reading"),
        this.#dynamicText("p", "cinema-closure-failure__assurance", "你的演出正文仍保留在最后一次成功保存的状态。重新载入后，可以从该状态继续处理。", "reading"),
      );
      const reload = this.#button("重新载入并恢复", "cinema-closure-failure__reload", () => global.location?.reload?.());
      content.append(reload);
      screen.append(this.#closureStage("failure"), content);
      return screen;
    }

    #closureStage(kind) {
      const stage = this.#el("div", `cinema-closure-stage cinema-closure-stage--${kind}`);
      stage.setAttribute("aria-hidden", "true");
      stage.append(
        this.#el("i", "cinema-closure-stage__recess"),
        this.#el("i", "cinema-closure-stage__curtain cinema-closure-stage__curtain--left"),
        this.#el("i", "cinema-closure-stage__curtain cinema-closure-stage__curtain--right"),
        this.#el("i", "cinema-closure-stage__seam"),
        this.#el("i", "cinema-closure-stage__floor"),
      );
      return stage;
    }

    #endingRule(className = "") {
      const rule = this.#el("span", `cinema-ending-rule ${className}`.trim());
      rule.setAttribute("aria-hidden", "true");
      rule.append(this.#el("i"), this.#glyph("diamond-point"), this.#el("i"));
      return rule;
    }

    #renderProgrammeArchive() {
      const model = programmeArchiveProjection()?.buildCinemaProgrammeArchiveProjection?.(this.store.snapshot());
      const screen = this.#el("section", "cinema-screen cinema-programme-archive");
      screen.dataset.cinemaView = "programme-archive-index";
      screen.dataset.archiveState = model?.empty ? "empty" : "populated";

      const environment = this.#el("div", "cinema-programme-archive__environment");
      environment.setAttribute("aria-hidden", "true");
      const environmentPlate = this.#el("img");
      environmentPlate.src = "assets/cinema/theater-home-environment-v1.webp";
      environmentPlate.alt = "";
      environment.append(environmentPlate, this.#el("span"));

      const header = this.#el("header", "cinema-programme-archive__header");
      const identity = this.#el("div", "cinema-programme-archive__header-identity");
      identity.append(this.#dynamicText("strong", "", "节目单", "display"), this.#el("small", "", "PROGRAMME"));
      const index = this.#el("p", "cinema-programme-archive__header-index");
      index.append(this.#el("span", "", "ARCHIVE"), this.#el("b", "", "02"));
      header.append(
        this.#glyphButton("back", "返回节目单", () => this.#go("programme"), "cinema-programme-archive__back"),
        identity,
        index,
      );

      const paper = this.#el("main", "cinema-programme-archive__paper");
      const sheet = this.#el("div", "cinema-programme-archive__sheet");
      sheet.append(
        this.#el("span", "cinema-programme-archive__edge"),
        this.#el("span", "cinema-programme-archive__fold"),
        this.#glyph("registration", "cinema-programme-archive__registration cinema-programme-archive__registration--left"),
        this.#glyph("registration", "cinema-programme-archive__registration cinema-programme-archive__registration--right"),
      );

      const masthead = this.#el("div", "cinema-programme-archive__masthead");
      masthead.append(
        this.#el("p", "cinema-editorial-micro", "MERCURY CINEMA\nLIVES IN PARALLEL"),
        this.#glyph("diamond"),
        this.#el("p", "cinema-editorial-micro", "COMPLETE PERFORMANCE\nINDEX 002"),
      );
      sheet.append(masthead);

      const title = this.#el("header", "cinema-programme-archive__title");
      const titleCopy = this.#el("div");
      titleCopy.append(this.#dynamicText("h1", "", "全部往期", "display"), this.#el("p", "", "演出存档"));
      const count = this.#el("span", "cinema-programme-archive__total");
      count.append(this.#el("b", "", model?.countLabel || "00"), this.#el("small", "", "PERFORMANCES"));
      title.append(titleCopy, count);
      sheet.append(title);

      if (model?.empty) sheet.append(this.#renderProgrammeArchiveEmpty());
      else {
        const content = this.#el("section", "cinema-programme-archive__content");
        content.setAttribute("aria-label", "全部往期演出索引");
        const groupNodes = new Map();
        model.groups.forEach((group) => groupNodes.set(group.anchor, this.#renderProgrammeArchiveGroup(group)));

        const jump = this.#el("nav", "cinema-programme-archive__jump");
        jump.setAttribute("aria-label", "角色与世界分组快速索引");
        const jumpHeading = this.#el("div", "cinema-programme-archive__section-index");
        jumpHeading.append(this.#el("span", "", "角色 × 世界"), this.#el("i"), this.#el("b", "", "JUMP INDEX"));
        jump.append(jumpHeading);
        model.groups.forEach((group) => {
          const action = this.#button("", "cinema-programme-archive__jump-row", () => this.#scrollDocumentTarget(paper, groupNodes.get(group.anchor)));
          action.setAttribute("aria-label", `前往${group.characterName}与${group.worldTitle}分组`);
          const copy = this.#el("span");
          copy.append(
            this.#dynamicText("strong", "", `${group.characterName} × ${group.worldTitle}`, "reading"),
            this.#el("small", "", `${group.performances.length} 场演出`),
          );
          action.append(this.#el("b", "", group.number), copy, this.#glyph("arrow-east"));
          jump.append(action);
        });
        content.append(jump, ...model.groups.map((group) => groupNodes.get(group.anchor)), this.#programmeArchiveFooter("002.01"));
        sheet.append(content);
      }

      paper.append(sheet);
      screen.append(environment, header, paper);
      return screen;
    }

    #renderProgrammeArchiveGroup(group) {
      const section = this.#el("section", "cinema-programme-archive__group");
      section.id = group.anchor;
      const titleId = `${group.anchor}-title`;
      section.setAttribute("aria-labelledby", titleId);
      const heading = this.#el("header", "cinema-programme-archive__group-heading");
      const headingCopy = this.#el("div");
      const groupTitle = this.#dynamicText("h2", "", `${group.characterName} × ${group.worldTitle}`, "display");
      groupTitle.id = titleId;
      headingCopy.append(this.#el("p", "cinema-editorial-micro", "CHARACTER × WORLD"), groupTitle);
      heading.append(this.#el("span", "", group.number), headingCopy, this.#el("small", "", group.countLabel));
      section.append(heading);

      group.performances.forEach((performance) => {
        const row = this.#button("", "cinema-programme-archive__performance", () => this.#go("history", { instanceId: performance.id, returnRoute: "programme-archive" }));
        row.setAttribute("aria-label", `阅读${performance.title}完整节目册`);
        row.dataset.instanceId = performance.id;
        const copy = this.#el("span", "cinema-programme-archive__performance-copy");
        copy.append(this.#dynamicText("strong", "", performance.title, "display"));
        if (performance.metadataLine) copy.append(this.#dynamicText("small", "", performance.metadataLine, "ui"));
        const date = this.#el("time", "", performance.endingDate);
        if (performance.endedAt) date.dateTime = performance.endedAt;
        row.append(this.#el("b", "", performance.number), copy, date, this.#glyph("arrow-east"));
        section.append(row);
      });
      return section;
    }

    #renderProgrammeArchiveEmpty() {
      const empty = this.#el("section", "cinema-programme-archive__empty");
      empty.setAttribute("aria-label", "没有往期演出");
      const mark = this.#el("div", "cinema-programme-archive__empty-mark");
      mark.setAttribute("aria-hidden", "true");
      mark.append(this.#el("span"), this.#el("i"), this.#glyph("diamond"));
      const copy = this.#el("div", "cinema-programme-archive__empty-copy");
      copy.append(
        this.#el("p", "", "往期节目册尚未写下"),
        this.#dynamicText("h2", "", "还没有谢幕的演出", "display"),
        this.#el("small", "", "演出谢幕后，完整作品会在这里归档。"),
      );
      const action = this.#button("", "cinema-programme-archive__return", () => this.#go("programme"));
      action.append(this.#dynamicText("span", "", "返回节目单", "display"), this.#glyph("arrow-east"));
      empty.append(mark, copy, action, this.#programmeArchiveFooter("EMPTY", true));
      return empty;
    }

    #programmeArchiveFooter(index, empty = false) {
      const footer = this.#el("footer", `cinema-programme-archive__footer${empty ? " cinema-programme-archive__footer--empty" : ""}`);
      footer.append(
        this.#el("p", "cinema-editorial-micro", "MERCURY CINEMA\nBLACK-BOX SERIES"),
        this.#glyph("registration"),
        this.#el("p", "cinema-editorial-micro", `PROGRAMME ARCHIVE\n${index}`),
      );
      return footer;
    }

    #renderHistory() {
      const instance = this.store.get(this.routeData?.instanceId);
      const model = historyProjection()?.buildCinemaHistoryProjection?.(instance);
      if (!model) return this.#redirectScreen("programme");
      const returnsToArchive = this.routeData?.returnRoute === "programme-archive";
      const historyBackRoute = returnsToArchive ? "programme-archive" : "programme";
      const historyBackLabel = returnsToArchive ? "返回往期索引" : "返回节目单";
      const screen = this.#el("section", "cinema-screen cinema-history-reader");
      screen.dataset.cinemaView = "performance-history";
      screen.dataset.structureProvenance = model.structureProvenance;
      screen.dataset.material = this.historyPresentation.id;
      screen.style.setProperty("--cinema-history-paper-texture", `url("${this.historyPresentation.paperTexture}")`);
      screen.style.setProperty("--cinema-history-body-texture", `url("${this.historyPresentation.bodyTexture}")`);
      screen.style.setProperty("--cinema-history-transition-texture", `url("${this.historyPresentation.transitionTexture}")`);
      const scroll = this.#el("main", "cinema-history-reader__scroll");
      scroll.id = "cinemaHistoryScroll";

      const sectionNodes = new Map();
      const body = this.#el("article", "cinema-history-reader__body");
      body.setAttribute("aria-label", "完整演出正文");
      const bodyLead = this.#el("header", "cinema-history-reader__body-lead");
      bodyLead.append(
        this.#glyph("diamond-point"),
        this.#el("p", "cinema-editorial-micro", "COMPLETE PERFORMANCE"),
        this.#dynamicText("p", "cinema-history-reader__body-title", model.structureProvenance === "runtime" ? "演出正文" : "完整正文", "display"),
      );
      body.append(bodyLead);
      model.sections.forEach((section, index) => {
        const sceneSection = this.#el("section", `cinema-history-section${section.actNumber ? "" : " cinema-history-section--unstructured"}`);
        sceneSection.id = section.id;
        sceneSection.dataset.sectionIndex = String(index + 1);
        if (section.sourceSceneId) sceneSection.dataset.sceneId = section.sourceSceneId;
        const heading = this.#el("header", "cinema-history-section__heading");
        heading.append(this.#el("span", "cinema-history-section__tick"));
        const headingCopy = this.#el("div", "cinema-history-section__heading-copy");
        if (section.structuralLabel) headingCopy.append(this.#dynamicText("p", "cinema-history-section__structure", section.structuralLabel, "reading"));
        headingCopy.append(
          this.#el("p", "cinema-editorial-micro", section.editorialLabel),
          this.#dynamicText("h2", "cinema-history-section__title", section.title, "display"),
        );
        heading.append(headingCopy, this.#glyph("registration-cross"));
        sceneSection.append(heading);
        section.segments.forEach((segment) => sceneSection.append(this.#renderHistorySegment(segment)));
        body.append(sceneSection);
        sectionNodes.set(section.id, sceneSection);
      });

      const colophon = this.#el("footer", "cinema-history-reader__colophon");
      const colophonHeading = this.#el("div", "cinema-history-reader__colophon-heading");
      colophonHeading.append(this.#glyph("star-small"), this.#el("p", "cinema-editorial-micro", "PROGRAMME COLOPHON"), this.#dynamicText("h2", "", "演出记录", "display"));
      const facts = this.#el("dl", "cinema-history-reader__facts");
      model.colophon.forEach((entry) => {
        const row = this.#el("div", "cinema-history-reader__fact");
        row.dataset.fact = entry.key;
        row.append(this.#dynamicText("dt", "", entry.label, "reading"), this.#dynamicText("dd", "", entry.value, "reading"));
        facts.append(row);
      });
      const actions = this.#el("div", "cinema-history-reader__actions");
      actions.append(
        this.#button("返回目录顶部", "cinema-history-reader__top-action", () => this.#scrollHistoryTarget(scroll, null)),
        this.#button("返回节目单", "cinema-history-reader__programme-action", () => this.#go("programme")),
      );
      colophon.append(colophonHeading, facts, this.#el("p", "cinema-history-reader__archive-note", "正文按演出发生顺序完整封存。"), actions, this.#el("p", "cinema-editorial-micro cinema-history-reader__footer-mark", "MERCURY CINEMA  /  PERFORMANCE ARCHIVE"));
      body.append(colophon);

      const front = this.#el("section", "cinema-history-reader__front");
      front.id = "cinemaHistoryTop";
      const navigation = this.#el("header", "cinema-history-reader__navigation");
      const back = this.#button("", "cinema-history-reader__back", () => this.#go(historyBackRoute));
      back.setAttribute("aria-label", historyBackLabel);
      back.append(this.#glyph("back"), this.#el("span", "", historyBackLabel));
      const brand = this.#el("p", "cinema-history-reader__nav-brand", "MERCURY CINEMA");
      navigation.append(back, brand, this.#glyph("registration", "cinema-history-reader__nav-mark"));

      const cover = this.#el("header", "cinema-history-reader__cover");
      cover.append(
        this.#glyph("star-axis", "cinema-history-reader__cover-star"),
        this.#el("p", "cinema-editorial-micro", "PERFORMANCE ARCHIVE"),
      );
      const title = this.#dynamicText("h1", "cinema-history-reader__title", model.title, "display");
      if (model.title.length > 8) title.classList.add("is-long");
      cover.append(
        title,
        this.#el("span", "cinema-history-reader__title-rule"),
        this.#dynamicText("p", "cinema-history-reader__identity", model.identityLine, "reading"),
        this.#el("p", "cinema-history-reader__dates", model.dateRange),
        this.#glyph("registration-cross", "cinema-history-reader__cover-register"),
      );

      const contents = this.#el("nav", "cinema-history-reader__contents");
      contents.setAttribute("aria-labelledby", "cinemaHistoryContentsTitle");
      const contentsHeading = this.#el("header", "cinema-history-reader__contents-heading");
      const contentsTitle = this.#dynamicText("h2", "", "目录", "display");
      contentsTitle.id = "cinemaHistoryContentsTitle";
      contentsHeading.append(contentsTitle, this.#el("p", "cinema-editorial-micro", "CONTENTS"), this.#glyph("diamond-point"));
      const contentsList = this.#el("ol", "cinema-history-reader__contents-list");
      model.contents.forEach((entry, index) => {
        const item = this.#el("li", "cinema-history-reader__contents-item");
        const target = sectionNodes.get(entry.id);
        const action = this.#button("", "cinema-history-reader__contents-action", () => this.#scrollHistoryTarget(scroll, target));
        action.append(
          this.#el("span", "cinema-history-reader__contents-index", pad(index + 1)),
          this.#dynamicText("span", "cinema-history-reader__contents-label", entry.label, "reading"),
          this.#dynamicText("strong", "cinema-history-reader__contents-title", entry.title, "display"),
          this.#glyph("arrow-east"),
        );
        item.append(action);
        contentsList.append(item);
      });
      contents.append(contentsHeading, contentsList);
      front.append(navigation, cover, contents);

      const transition = this.#el("div", "cinema-history-reader__transition");
      transition.setAttribute("aria-hidden", "true");
      transition.append(this.#el("span", "cinema-history-reader__transition-light"), this.#el("span", "cinema-history-reader__transition-fibre"));
      scroll.append(front, transition, body);
      screen.append(scroll);
      return screen;
    }

    #renderHistorySegment(segment) {
      if (segment.role === "user") {
        const passage = this.#el("section", "cinema-history-segment cinema-history-segment--user");
        passage.dataset.provenance = "user";
        if (segment.id) passage.dataset.segmentId = segment.id;
        if (segment.abandonedPending) passage.dataset.abandonedPending = "true";
        const marker = this.#el("span", "cinema-history-segment__user-rule");
        const copy = this.#el("div", "cinema-history-segment__copy");
        copy.append(this.#el("p", "cinema-editorial-micro cinema-history-segment__provenance", segment.abandonedPending ? "YOUR PASSAGE  /  NO RESPONSE BEFORE CURTAIN" : "YOUR PASSAGE"));
        segment.text.split(/\n\s*\n|\n/).map((part) => part.trim()).filter(Boolean).forEach((paragraph) => copy.append(this.#dynamicText("p", "", paragraph, "reading")));
        passage.append(marker, copy);
        return passage;
      }
      const prose = this.#el("div", "cinema-history-segment cinema-history-segment--assistant");
      prose.dataset.provenance = "assistant";
      if (segment.id) prose.dataset.segmentId = segment.id;
      segment.text.split(/\n\s*\n|\n/).map((part) => part.trim()).filter(Boolean).forEach((paragraph) => prose.append(this.#dynamicText("p", "", paragraph, "reading")));
      return prose;
    }

    #scrollDocumentTarget(scroller, target) {
      const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        return;
      }
      if (typeof scroller?.scrollTo === "function") scroller.scrollTo({ top: target?.offsetTop || 0, behavior: reducedMotion ? "auto" : "smooth" });
      else if (scroller) scroller.scrollTop = target?.offsetTop || 0;
    }

    #scrollHistoryTarget(scroller, target) {
      this.#scrollDocumentTarget(scroller, target);
    }

    #renderNotes() {
      const instance = this.store.focused();
      if (!instance) return this.#redirectScreen("lobby");
      const screen = this.#el("section", "cinema-screen cinema-paper-screen");
      screen.append(this.#pageHeader("场记", instance.status === "intermission" ? "intermission" : "reading"));
      const paper = this.#paper();
      const content = this.#el("article", "cinema-notes");
      const scene = instance.scenes.find((item) => item.id === instance.currentSceneId) || instance.scenes.at(-1);
      content.append(this.#sectionLabel("STORY NOTES", `SCENE ${pad(scene.sceneNumber)} · ${scene.title}`, "场记只整理已经发生的内容，不提前透露潜在线索。"));
      const sections = [
        ["概览", instance.notes.overview],
        ["人物", [instance.characterSnapshot.displayName, instance.player.name].filter(Boolean).join("、")],
        ["地点", Array.from(new Set(instance.notes.places.concat(instance.stageSnapshot.places.slice(0, 3)))).join("、")],
        ["本场已写", instance.segments.filter((item) => item.role === "user").slice(-4).map((item) => item.text).join("\n") || "尚未落笔。"],
      ];
      sections.forEach(([title, body]) => {
        const section = this.#el("section", "cinema-note-section");
        section.append(this.#el("p", "cinema-structural", title), this.#el("p", "", body || "尚无记录。"));
        content.append(section);
      });
      content.append(this.#el("p", "cinema-footnote", "MVP 场记基于已经保存的正文生成基础索引。更复杂的自动摘要与记忆提取会在后续版本评估。"));
      paper.append(content);
      screen.append(paper);
      return screen;
    }

    #renderReadingSettings() {
      const settings = this.store.snapshot().readingSettings;
      const back = this.store.focused()?.status === "intermission" ? "intermission" : "reading";
      const screen = this.#el("section", "cinema-screen cinema-paper-screen");
      screen.append(this.#pageHeader("阅读设置", back));
      const paper = this.#paper();
      const content = this.#el("article", "cinema-settings");
      content.append(this.#sectionLabel("READING SETTINGS", "让暗场适合这一次阅读", "设置只影响阅读呈现，不进入提示词，也不改动正文。"));
      const fontGroup = this.#el("div", "cinema-setting-row");
      fontGroup.append(this.#el("span", "", "字号"));
      const fontControls = this.#el("div", "cinema-segmented");
      [["A−", .92], ["A", 1], ["A+", 1.12]].forEach(([label, value]) => {
        const button = this.#button(label, Math.abs(settings.fontScale - value) < .03 ? "is-selected" : "", () => { this.store.updateReadingSettings({ fontScale: value }); this.#renderRoute(); });
        fontControls.append(button);
      });
      fontGroup.append(fontControls);
      content.append(fontGroup);
      const lineGroup = this.#el("div", "cinema-setting-row");
      lineGroup.append(this.#el("span", "", "行距"));
      const lineControls = this.#el("div", "cinema-segmented");
      [["紧凑", "compact"], ["舒展", "relaxed"], ["宽松", "airy"]].forEach(([label, value]) => lineControls.append(this.#button(label, settings.lineHeight === value ? "is-selected" : "", () => { this.store.updateReadingSettings({ lineHeight: value }); this.#renderRoute(); })));
      lineGroup.append(lineControls);
      content.append(lineGroup);
      const themeGroup = this.#el("div", "cinema-setting-stack");
      themeGroup.append(this.#el("p", "", "阅读明度"));
      const themeControls = this.#el("div", "cinema-theme-options");
      [["暖黑", "paper"], ["柔黑", "pale"], ["深黑", "dark"], ["夜幕", "night"]].forEach(([label, value]) => themeControls.append(this.#button(label, `cinema-theme-chip cinema-theme-chip--${value}${settings.theme === value ? " is-selected" : ""}`, () => { this.store.updateReadingSettings({ theme: value }); this.#renderRoute(); })));
      themeGroup.append(themeControls);
      content.append(themeGroup);
      [["正文渐显", "完整回复返回后柔和显现，不伪装实时流式", "progressiveReveal"], ["幕间卡片", "进入新一幕时保留低频过场", "actCards"]].forEach(([title, body, key]) => {
        const row = this.#el("label", "cinema-toggle-row");
        const copy = this.#el("span"); copy.append(this.#el("strong", "", title), this.#el("small", "", body));
        const input = this.#el("input"); input.type = "checkbox"; input.checked = settings[key] !== false;
        input.addEventListener("change", () => this.store.updateReadingSettings({ [key]: input.checked }));
        row.append(copy, input);
        content.append(row);
      });
      paper.append(content);
      screen.append(paper);
      return screen;
    }

    #notice(message, kind = "quiet") {
      const notice = this.#el("div", `cinema-notice cinema-notice--${kind}`);
      notice.append(this.#icon(kind === "error" ? "cancel" : "spark"), this.#el("p", "", message));
      return notice;
    }

    #showInlineNotice(parent, message, id) {
      parent.querySelector(`[data-notice-id="${id}"]`)?.remove();
      const notice = this.#notice(message, "error");
      notice.dataset.noticeId = id;
      parent.append(notice);
      notice.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    #redirectScreen(route) {
      const screen = this.#el("section", "cinema-screen cinema-loading-state");
      screen.append(this.#el("span", "cinema-loading-rule"), this.#el("p", "cinema-structural", "RELOADING PROGRAMME"));
      const timer = global.setTimeout(() => this.#go(route), 0);
      this.timers.add(timer);
      return screen;
    }

    #roman(value) {
      const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      return numerals[Math.max(1, Number(value) || 1) - 1] || String(value);
    }

    #chineseNumber(value) {
      const numerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
      return numerals[Math.max(1, Number(value) || 1) - 1] || String(value);
    }

    #clearTimers() {
      this.timers.forEach((timer) => global.clearTimeout(timer));
      this.timers.clear();
    }
  }

  function contracts() { return global.MercuryCinemaContracts; }

  function createDefinition() {
    return Object.freeze({
      id: "cinema",
      nameKey: "apps.cinema",
      icon: "media-image",
      version: 1,
      capabilities: Object.freeze(["storage", "ai", "archive-read", "generation-profile-read"]),
      widgets: Object.freeze([]),
      create: () => new MercuryCinemaAppController(),
    });
  }

  global.MercuryCinemaAppController = MercuryCinemaAppController;
  global.MercuryCreateCinemaDefinition = createDefinition;
  if (typeof module !== "undefined" && module.exports) module.exports = { MercuryCinemaAppController, buildBeforeCurtainModel, buildCharacterAdaptationModel, buildStageDetailModel, buildStagePreparationModel, createDefinition };
})(typeof window !== "undefined" ? window : globalThis);

(function exposeMercurySettingsApp(global) {
  "use strict";

  const DEFAULT_CONNECTION = Object.freeze({
    provider: "openai-compatible",
    baseUrl: "",
    apiKey: "",
    rememberApiKey: false,
    model: "gpt-4.1-mini",
    stream: false,
    lastTest: "idle",
  });

  const GROUPS = Object.freeze([
    Object.freeze({ labelKey: "settings.groups.connection", rows: Object.freeze([
      Object.freeze({ id: "ai-connection", icon: "network", labelKey: "settings.rows.aiConnection" }),
      Object.freeze({ id: "usage-costs", icon: "database", labelKey: "settings.rows.usageCosts" }),
    ]) }),
    Object.freeze({ labelKey: "settings.groups.phone", rows: Object.freeze([
      Object.freeze({ id: "appearance", icon: "palette", labelKey: "settings.rows.appearance" }),
      Object.freeze({ id: "home-widgets", icon: "view-grid", labelKey: "settings.rows.homeWidgets" }),
      Object.freeze({ id: "lock-screen", icon: "lock", labelKey: "settings.rows.lockScreen" }),
      Object.freeze({ id: "notifications", icon: "bell-notification", labelKey: "settings.rows.notifications" }),
    ]) }),
    Object.freeze({ labelKey: "settings.groups.system", rows: Object.freeze([
      Object.freeze({ id: "sound-feedback", icon: "sound-high", labelKey: "settings.rows.soundFeedback" }),
      Object.freeze({ id: "data-privacy", icon: "shield-check", labelKey: "settings.rows.dataPrivacy" }),
      Object.freeze({ id: "general", icon: "settings", labelKey: "settings.rows.general" }),
    ]) }),
  ]);

  function normalizeConnection(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...DEFAULT_CONNECTION,
      provider: "openai-compatible",
      baseUrl: typeof source.baseUrl === "string" ? source.baseUrl.trim() : "",
      apiKey: typeof source.apiKey === "string" ? source.apiKey : "",
      rememberApiKey: source.rememberApiKey === true,
      model: typeof source.model === "string" && source.model.trim() ? source.model.trim() : DEFAULT_CONNECTION.model,
      // v1.1 transport is deliberately non-streaming. Keep the field for
      // stored-connection compatibility, but never expose a false-on-the-wire
      // capability as enabled UI state.
      stream: false,
      lastTest: ["idle", "success", "error"].includes(source.lastTest) ? source.lastTest : "idle",
    };
  }

  class SettingsAppController {
    constructor() {
      this.root = null;
      this.context = null;
      this.route = "home";
      this.scrollPositions = new Map();
      this.connection = { ...DEFAULT_CONNECTION };
      this.testAbortController = null;
      this.dataSnapshot = null;
      this.dataError = null;
      this.dataLoading = false;
      this.dataRequestId = 0;
    }

    render(root, context, payload = null) {
      this.root = root;
      this.context = context;
      this.root.classList.add("settings-app");
      // A launch payload may request a deep secondary route (e.g. opening
      // directly into AI Connection from another app). Fall back to home for
      // anything that is not a navigable detail route.
      this.route = ["ai-connection", "usage-costs", "data-privacy"].includes(payload?.route) ? payload.route : "home";
      const storedConnection = context.services.storage.get("connection", DEFAULT_CONNECTION);
      const sessionConnection = context.services.sessionCredentials?.get?.() || null;
      this.connection = normalizeConnection({
        ...storedConnection,
        ...(sessionConnection && typeof sessionConnection === "object" ? sessionConnection : {}),
        rememberApiKey: storedConnection?.rememberApiKey === true,
      });
      if (!this.connection.rememberApiKey && !sessionConnection) this.connection.apiKey = "";
      // A connection result describes one request, not durable configuration.
      // Keep it during the current app session, but never revive stale success
      // or failure feedback after a browser reload or app reconstruction.
      this.connection.lastTest = "idle";
      if (storedConnection?.apiKey && !this.connection.rememberApiKey) {
        this.#syncSessionCredentials();
        this.#persistConnection();
      }
      this.#renderRoute();
    }

    onMount() {
      this.root.dataset.lifecycle = "mounted";
    }

    onPause() {
      this.#rememberScroll();
      this.testAbortController?.abort();
      this.root.dataset.lifecycle = "paused";
    }

    onResume(_, payload = null) {
      this.root.dataset.lifecycle = "resumed";
      if (["ai-connection", "usage-costs", "data-privacy"].includes(payload?.route)) {
        this.route = payload.route;
        this.#renderRoute();
      } else {
        this.#restoreScroll();
      }
    }

    onUnmount() {
      this.testAbortController?.abort();
      this.dataRequestId += 1;
      this.root = null;
      this.context = null;
    }

    #renderRoute() {
      this.root.replaceChildren();
      this.root.dataset.route = this.route;
      if (this.route === "ai-connection") this.#renderConnection();
      else if (this.route === "usage-costs") this.#renderUsageCosts();
      else if (this.route === "data-privacy") this.#renderDataPrivacy();
      else this.#renderHome();
      this.#restoreScroll();
    }

    #renderHome() {
      const scroll = this.#element("div", "settings-scroll settings-home");
      const heading = this.#element("h1", "settings-home__title", this.#t("settings.title"));
      const summary = this.#element("section", "settings-summary mercury-glass");
      summary.setAttribute("aria-label", "Mercury");
      const mark = this.#element("span", "settings-summary__mark");
      mark.append(this.#icon("flower"));
      const copy = this.#element("span", "settings-summary__copy");
      copy.append(
        this.#element("strong", "", "Mercury"),
        this.#element("span", "", "Here, quietly."),
      );
      summary.append(mark, copy);
      scroll.append(heading, summary);

      GROUPS.forEach((group) => {
        const section = this.#element("section", "settings-group");
        section.append(this.#element("h2", "settings-group__label", this.#t(group.labelKey)));
        const panel = this.#element("div", "settings-group__panel mercury-glass");
        group.rows.forEach((definition) => panel.append(this.#homeRow(definition)));
        section.append(panel);
        scroll.append(section);
      });
      scroll.append(this.#element("div", "settings-scroll-end"));
      this.root.append(scroll, this.#toastRegion());
      this.scroll = scroll;
    }

    #homeRow(definition) {
      const button = this.#element("button", "settings-row");
      button.type = "button";
      const detail = typeof definition.detail === "function" ? definition.detail(this.connection) : "";
      const iconWrap = this.#element("span", "settings-row__icon");
      iconWrap.append(this.#icon(definition.icon));
      const label = this.#element("span", "settings-row__label", this.#t(definition.labelKey));
      const accessory = this.#element("span", "settings-row__accessory");
      if (detail) accessory.append(this.#element("small", "", detail));
      accessory.append(this.#icon("nav-arrow-right"));
      button.append(iconWrap, label, accessory);
      button.addEventListener("click", () => {
        if (["ai-connection", "usage-costs", "data-privacy"].includes(definition.id)) this.#navigate(definition.id);
        else this.#showToast(this.#t("settings.comingSoon"));
      });
      return button;
    }

    #renderConnection() {
      const page = this.#element("div", "settings-detail");
      const navigation = this.#element("header", "settings-navigation");
      const back = this.#element("button", "settings-back");
      back.type = "button";
      back.setAttribute("aria-label", this.#t("settings.back"));
      back.append(this.#icon("nav-arrow-left"));
      back.addEventListener("click", () => this.#navigate("home"));
      navigation.append(back, this.#element("h1", "", this.#t("settings.ai.title")), this.#element("span", "settings-navigation__balance"));

      const scroll = this.#element("div", "settings-scroll settings-detail__scroll");
      scroll.append(this.#sectionLabel(this.#t("settings.ai.provider")));
      const provider = this.#element("button", "settings-provider mercury-glass");
      provider.type = "button";
      const providerIcon = this.#element("span", "settings-row__icon");
      providerIcon.append(this.#icon("network"));
      provider.append(providerIcon, this.#element("span", "", this.#t("settings.ai.providerName")), this.#icon("nav-arrow-right"));
      provider.addEventListener("click", () => this.#showToast(this.#t("settings.ai.providerOnly")));
      scroll.append(provider, this.#element("p", "settings-provider-note", this.#t("settings.ai.compatibilityNote")));

      const form = this.#element("form", "settings-connection-form mercury-glass");
      form.noValidate = true;
      form.addEventListener("submit", (event) => event.preventDefault());
      const baseUrl = this.#field({ label: this.#t("settings.ai.baseUrl"), name: "baseUrl", value: this.connection.baseUrl, placeholder: "https://api.example.com/v1", inputMode: "url" });
      const apiKey = this.#field({ label: this.#t("settings.ai.apiKey"), name: "apiKey", value: this.connection.apiKey, placeholder: "sk-...", type: "password", reveal: true, autocomplete: "off" });
      const model = this.#field({ label: this.#t("settings.ai.defaultModel"), name: "model", value: this.connection.model, placeholder: "gpt-4.1-mini" });
      const rememberKey = this.#element("div", "settings-key-memory");
      const rememberKeyCopy = this.#element("span", "settings-key-memory__copy");
      rememberKeyCopy.append(
        this.#element("span", "", this.#t("settings.ai.rememberKey")),
        this.#element("small", "", this.#t("settings.ai.rememberKeyNote")),
      );
      rememberKey.append(rememberKeyCopy, this.#toggle(this.connection.rememberApiKey, (checked) => {
        this.connection.rememberApiKey = checked;
        this.#syncSessionCredentials();
        this.#persistConnection();
      }, this.#t("settings.ai.rememberKey")));
      form.append(baseUrl.wrap, apiKey.wrap, model.wrap, rememberKey);
      form.addEventListener("input", () => {
        this.connection = normalizeConnection({ ...this.connection, baseUrl: baseUrl.input.value, apiKey: apiKey.input.value, model: model.input.value, lastTest: "idle" });
        this.#syncSessionCredentials();
        this.#persistConnection();
        this.#setTestState("idle");
      });
      scroll.append(form);

      const testButton = this.#element("button", "settings-test-button", this.#t("settings.ai.test"));
      testButton.type = "button";
      testButton.addEventListener("click", () => this.#testConnection(testButton));
      const result = this.#element("div", "settings-test-result");
      result.setAttribute("role", "status");
      result.setAttribute("aria-live", "polite");
      this.testResult = result;
      scroll.append(testButton, result, this.#sectionLabel(this.#t("settings.ai.responses")));

      const responsePanel = this.#element("div", "settings-response-panel mercury-glass");
      const streamRow = this.#element("div", "settings-control-row");
      const streamCopy = this.#element("span", "settings-stream-copy");
      streamCopy.append(this.#element("span", "", this.#t("settings.ai.stream")), this.#element("small", "", this.#t("settings.ai.nonStreaming")));
      const streamSwitch = this.#toggle(false, () => {}, this.#t("settings.ai.nonStreaming"));
      streamSwitch.disabled = true;
      streamSwitch.setAttribute("aria-disabled", "true");
      streamRow.append(streamCopy, streamSwitch);
      responsePanel.append(streamRow);
      const responseNote = this.#element("p", "settings-response-note", this.#t("settings.ai.nonStreamingNote"));
      const note = this.#element("p", "settings-local-note");
      note.append(this.#icon("lock"), this.#element("span", "", this.#t("settings.ai.localNote")));
      scroll.append(responsePanel, responseNote, note, this.#element("div", "settings-scroll-end"));
      page.append(navigation, scroll);
      this.root.append(page, this.#toastRegion());
      this.scroll = scroll;
      this.#setTestState(this.connection.lastTest);
    }

    #renderUsageCosts() {
      const page = this.#element("div", "settings-detail");
      const navigation = this.#detailNavigation(this.#t("settings.usage.title"));
      const scroll = this.#element("div", "settings-scroll settings-detail__scroll");
      const empty = this.#element("section", "settings-usage-empty mercury-glass");
      const mark = this.#element("span", "settings-usage-empty__mark");
      mark.append(this.#icon("database"));
      empty.append(
        mark,
        this.#element("h2", "", this.#t("settings.usage.emptyTitle")),
        this.#element("p", "", this.#t("settings.usage.emptyBody")),
        this.#element("small", "", this.#t("settings.usage.truthNote")),
      );
      scroll.append(empty, this.#element("div", "settings-scroll-end"));
      page.append(navigation, scroll);
      this.root.append(page, this.#toastRegion());
      this.scroll = scroll;
    }

    #renderDataPrivacy() {
      const page = this.#element("div", "settings-detail");
      const navigation = this.#detailNavigation(this.#t("settings.data.title"));
      const scroll = this.#element("div", "settings-scroll settings-detail__scroll settings-data");
      const status = this.#element("section", "settings-data-status mercury-glass");
      const mark = this.#element("span", "settings-data-status__mark");
      mark.append(this.#icon(this.dataSnapshot?.status === "healthy" ? "check-circle" : "database"));
      const copy = this.#element("span", "settings-data-status__copy");
      const statusKey = this.dataError
        ? "error"
        : this.dataSnapshot?.status || "loading";
      copy.append(
        this.#element("strong", "", this.#t(`settings.data.status.${statusKey}`)),
        this.#element("small", "", this.#dataStatusDetail()),
      );
      status.append(mark, copy);
      scroll.append(status);

      if (this.dataSnapshot) {
        scroll.append(this.#sectionLabel(this.#t("settings.data.localData")));
        const facts = this.#element("div", "settings-data-facts mercury-glass");
        facts.append(
          this.#dataFact(this.#t("settings.data.mode"), this.#t(`settings.data.modeValue.${this.dataSnapshot.mode}`)),
          this.#dataFact(this.#t("settings.data.backupScope"), this.#t("settings.data.recordCount", { count: this.dataSnapshot.backup.includedRecords })),
          this.#dataFact(this.#t("settings.data.browserUsage"), this.#storageUsageText(this.dataSnapshot)),
        );
        scroll.append(facts);
      }

      const backup = this.#element("button", "settings-test-button", this.#t("settings.data.download"));
      backup.type = "button";
      backup.disabled = !this.context?.services?.localData || this.dataLoading || !this.dataSnapshot;
      backup.addEventListener("click", () => this.#downloadLocalBackup(backup));
      const note = this.#element("p", "settings-data-note", this.#t("settings.data.exclusions"));
      const restore = this.#element("p", "settings-data-note settings-data-note--secondary", this.#t("settings.data.restoreLater"));
      scroll.append(backup, note, restore, this.#element("div", "settings-scroll-end"));
      page.append(navigation, scroll);
      this.root.append(page, this.#toastRegion());
      this.scroll = scroll;
      if (!this.dataSnapshot && !this.dataError && !this.dataLoading) this.#refreshDataSnapshot();
    }

    #dataFact(label, value) {
      const row = this.#element("div", "settings-control-row settings-data-fact");
      row.append(this.#element("span", "", label), this.#element("strong", "", value));
      return row;
    }

    #dataStatusDetail() {
      if (this.dataError) return this.#t("settings.data.errorDetail");
      if (!this.dataSnapshot) return this.#t("settings.data.loadingDetail");
      if (this.dataSnapshot.status === "volatile") return this.#t("settings.data.volatileDetail");
      if (this.dataSnapshot.status === "degraded") return this.#t("settings.data.degradedDetail");
      return this.dataSnapshot.persisted === false ? this.#t("settings.data.evictableDetail") : this.#t("settings.data.healthyDetail");
    }

    #storageUsageText(snapshot) {
      if (!Number.isFinite(snapshot.usage) || !Number.isFinite(snapshot.quota)) return this.#t("settings.data.unavailable");
      return `${this.#formatBytes(snapshot.usage)} / ${this.#formatBytes(snapshot.quota)}`;
    }

    #formatBytes(value) {
      const bytes = Math.max(0, Number(value) || 0);
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
    }

    async #refreshDataSnapshot() {
      const localData = this.context?.services?.localData;
      if (!localData || typeof localData.snapshot !== "function") {
        this.dataError = new Error("Local data diagnostics are unavailable.");
        if (this.route === "data-privacy") this.#renderRoute();
        return;
      }
      const requestId = ++this.dataRequestId;
      this.dataLoading = true;
      try {
        const snapshot = await localData.snapshot();
        if (requestId !== this.dataRequestId) return;
        this.dataSnapshot = snapshot;
        this.dataError = null;
      } catch (error) {
        if (requestId !== this.dataRequestId) return;
        this.dataError = error instanceof Error ? error : new Error(String(error));
      } finally {
        if (requestId !== this.dataRequestId) return;
        this.dataLoading = false;
        if (this.root && this.route === "data-privacy") this.#renderRoute();
      }
    }

    async #downloadLocalBackup(button) {
      const localData = this.context?.services?.localData;
      if (!localData || typeof localData.createBackup !== "function") return false;
      button.disabled = true;
      try {
        const backup = await localData.createBackup();
        const json = JSON.stringify(backup, null, 2);
        if (typeof global.Blob === "function" && typeof global.URL?.createObjectURL === "function" && typeof document !== "undefined") {
          const link = document.createElement("a");
          const url = global.URL.createObjectURL(new global.Blob([json], { type: "application/json" }));
          link.href = url;
          link.download = `mercury-phone-backup-${String(backup.createdAt || new Date().toISOString()).slice(0, 10)}.json`;
          link.hidden = true;
          (document.body || document.documentElement)?.append?.(link);
          link.click?.();
          link.remove?.();
          global.setTimeout?.(() => global.URL.revokeObjectURL(url), 0);
        }
        this.#showToast(this.#t("settings.data.downloaded"));
        return backup;
      } catch (_) {
        this.#showToast(this.#t("settings.data.downloadFailed"));
        return false;
      } finally {
        button.disabled = false;
      }
    }

    #detailNavigation(title) {
      const navigation = this.#element("header", "settings-navigation");
      const back = this.#element("button", "settings-back");
      back.type = "button";
      back.setAttribute("aria-label", this.#t("settings.back"));
      back.append(this.#icon("nav-arrow-left"));
      back.addEventListener("click", () => this.#navigate("home"));
      navigation.append(back, this.#element("h1", "", title), this.#element("span", "settings-navigation__balance"));
      return navigation;
    }

    #field(options) {
      const wrap = this.#element("label", "settings-field");
      wrap.append(this.#element("span", "settings-field__label", options.label));
      const control = this.#element("span", "settings-field__control");
      const input = this.#element("input", "");
      input.name = options.name;
      input.type = options.type || "text";
      input.value = options.value;
      input.placeholder = options.placeholder || "";
      input.inputMode = options.inputMode || "text";
      if (options.autocomplete) input.autocomplete = options.autocomplete;
      control.append(input);
      if (options.reveal) {
        const reveal = this.#element("button", "settings-field__reveal");
        reveal.type = "button";
        reveal.setAttribute("aria-label", this.#t("settings.ai.showKey"));
        reveal.setAttribute("aria-pressed", "false");
        const visibilityIcon = this.#icon("eye");
        reveal.append(visibilityIcon);
        reveal.addEventListener("click", () => {
          const visible = input.type === "text";
          input.type = visible ? "password" : "text";
          reveal.setAttribute("aria-pressed", String(!visible));
          reveal.setAttribute("aria-label", this.#t(visible ? "settings.ai.showKey" : "settings.ai.hideKey"));
          visibilityIcon.src = `assets/icons/iconoir/${visible ? "eye" : "eye-closed"}.svg`;
        });
        control.append(reveal);
      }
      wrap.append(control);
      return { wrap, input };
    }

    async #testConnection(button) {
      this.testAbortController?.abort();
      try {
        if (!this.connection.baseUrl.trim()) throw new TypeError(this.#t("settings.ai.baseUrlRequired"));
        if (!this.connection.apiKey.trim()) throw new TypeError(this.#t("settings.ai.keyRequired"));
      } catch (error) {
        this.connection.lastTest = "error";
        this.#persistConnection();
        this.#setTestState("error", error.message);
        return;
      }
      this.#setTestState("testing");
      button.disabled = true;
      const controller = new AbortController();
      this.testAbortController = controller;
      try {
        const transport = this.context.services.aiTransport;
        if (!transport || typeof transport.testConnection !== "function") throw new Error(this.#t("settings.ai.transportUnavailable"));
        // Connection testing and Chat deliberately share the same transport,
        // session credential resolver, local relay and provider adapter.
        await transport.testConnection({ signal: controller.signal });
        this.connection.lastTest = "success";
        this.#persistConnection();
        this.#setTestState("success");
      } catch (error) {
        this.connection.lastTest = "error";
        this.#persistConnection();
        if (error.name === "AbortError") this.#setTestState("error", this.#t("settings.ai.timeout"));
        else this.#setTestState("error", error.message || this.#t("settings.ai.failed"));
      } finally {
        if (this.testAbortController === controller) this.testAbortController = null;
        button.disabled = false;
      }
    }

    #setTestState(state, message = "") {
      if (!this.testResult) return;
      this.testResult.className = `settings-test-result settings-test-result--${state}`;
      this.testResult.replaceChildren();
      if (state === "idle") return;
      if (state === "testing") this.testResult.textContent = this.#t("settings.ai.testing");
      else if (state === "success") this.testResult.append(this.#icon("check-circle"), this.#element("span", "", this.#t("settings.ai.success")));
      else this.testResult.textContent = message || this.#t("settings.ai.failed");
    }

    #toggle(checked, onChange, label) {
      const button = this.#element("button", "settings-switch");
      button.type = "button";
      button.setAttribute("role", "switch");
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-checked", String(Boolean(checked)));
      button.append(this.#element("span", "settings-switch__thumb"));
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-checked") !== "true";
        button.setAttribute("aria-checked", String(next));
        onChange(next);
      });
      return button;
    }

    #navigate(route) {
      this.#rememberScroll();
      this.route = route;
      this.#renderRoute();
    }

    #rememberScroll() {
      if (this.scroll) this.scrollPositions.set(this.route, this.scroll.scrollTop || 0);
    }

    #restoreScroll() {
      if (!this.scroll) return;
      this.scroll.scrollTop = this.scrollPositions.get(this.route) || 0;
    }

    #persistConnection() {
      this.context.services.storage.set("connection", {
        ...this.connection,
        apiKey: this.connection.rememberApiKey ? this.connection.apiKey : "",
        lastTest: "idle",
      });
    }

    #syncSessionCredentials() {
      this.context.services.sessionCredentials?.set?.({
        provider: this.connection.provider,
        baseUrl: this.connection.baseUrl,
        apiKey: this.connection.apiKey,
        model: this.connection.model,
      });
    }

    #showToast(message) {
      if (!this.toast) return;
      this.toast.textContent = message;
      this.toast.hidden = false;
      global.clearTimeout(this.toastTimer);
      this.toastTimer = global.setTimeout(() => { if (this.toast) this.toast.hidden = true; }, 1700);
    }

    #toastRegion() {
      this.toast = this.#element("div", "settings-toast mercury-glass");
      this.toast.hidden = true;
      this.toast.setAttribute("role", "status");
      return this.toast;
    }

    #sectionLabel(text) { return this.#element("h2", "settings-group__label", text); }
    #t(key, params) { return this.context.i18n?.t(key, params) || key; }
    #icon(name) {
      const image = this.#element("img", "settings-icon");
      image.src = `assets/icons/iconoir/${name}.svg`;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      return image;
    }
    #element(tag, className = "", text = "") {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }
  }

  function createDefinition() {
    return Object.freeze({
      id: "settings",
      nameKey: "apps.settings",
      icon: "settings",
      version: 1,
      capabilities: Object.freeze(["storage", "network"]),
      create: () => new SettingsAppController(),
    });
  }

  global.MercurySettingsConfig = Object.freeze({ DEFAULT_CONNECTION, normalizeConnection });
  global.MercuryCreateSettingsDefinition = createDefinition;
})(window);

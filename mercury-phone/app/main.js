(function bootShell() {
  "use strict";

  const screen = document.querySelector("#screen");
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.slice(window.location.hash.indexOf("?") + 1) : "";
  const previewParams = new URLSearchParams([window.location.search.slice(1), hashQuery].filter(Boolean).join("&"));
  const preferredLocale = previewParams.get("lang") || "zh-CN";
  const i18n = new window.MercuryI18n({ locale: preferredLocale, fallbackLocale: "en-US" });
  const shell = new window.MercurySystemShell(screen);
  const stateMachine = new window.MercurySystemStateMachine();
  const stateController = new window.MercurySystemStateController(stateMachine, screen);
  let requestAppLaunch = () => false;
  const systemServices = new window.MercurySystemServices({
    launchBridge: (targetAppId, route) => requestAppLaunch(targetAppId, route),
  });
  systemServices.aiTransport = new window.MercuryAITransport({ storage: systemServices.storageBackend, sessionCredentials: systemServices.sessionCredentials, storagePrefix: systemServices.prefix });
  const components = new window.MercurySystemComponents();
  const gestureManager = new window.MercuryGestureManager();
  const widgetRegistry = new window.MercuryWidgetRegistry();
  const notificationStore = new window.MercuryNotificationStore({ storage: systemServices.storageBackend });
  const appEngine = new window.MercuryAppEngine({ host: document.querySelector("#appLayer"), i18n, serviceHub: systemServices, widgetRegistry });
  systemServices.homeBridge = (fromAppId) => {
    if (!stateMachine.can(window.MercuryEvents.GO_HOME)) return false;
    const transition = stateMachine.dispatch(window.MercuryEvents.GO_HOME, { source: "app", appId: fromAppId });
    if (!transition.accepted) return false;
    appEngine.pause(fromAppId);
    return true;
  };
  appEngine.register(window.MercuryCreateSettingsDefinition());
  appEngine.register(window.MercuryCreateChatDefinition());
  const appLoader = new window.MercuryAppLoader({
    appEngine,
    manifests: [{
      id: "archive",
      styles: ["styles/archive-app.css"],
      scripts: ["apps/archive-app.js"],
      createDefinition: () => window.MercuryCreateArchiveDefinition?.(),
    }, {
      id: "cinema",
      styles: ["styles/cinema-app.css", "styles/cinema-library.css"],
      scripts: ["core/cinema-stage-catalog.js", "core/cinema-contracts.js", "core/cinema-programme-projection.js", "core/cinema-library-projection.js", "core/cinema-intermission-projection.js", "core/cinema-credits-projection.js", "core/cinema-history-projection.js", "core/cinema-programme-archive-projection.js", "core/cinema-font-coverage.js", "system/cinema-repository.js", "system/cinema-store.js", "use-cases/cinema-continuity-ledger.js", "use-cases/cinema-context-compiler.js", "use-cases/cinema-generation-workflow.js", "use-cases/cinema-closure-workflow.js", "apps/cinema-app.js"],
      createDefinition: () => window.MercuryCreateCinemaDefinition?.(),
    }],
    activate: (appId, payload) => {
      const transition = stateMachine.dispatch(window.MercuryEvents.OPEN_APP, { appId, route: payload?.route || null });
      if (!transition.accepted) return false;
      appEngine.launch(appId, payload);
      return true;
    },
  });
  requestAppLaunch = (appId, route = null) => {
    if (!appLoader.snapshot(appId).known) return false;
    void appLoader.launch(appId, route ? { route } : null).catch(() => {});
    return true;
  };
  const appLoaderServices = systemServices.createAppServices("app-loader");
  let loadingAppId = null;
  appLoader.subscribe((event) => {
    const appName = i18n.t(`apps.${event.appId}`);
    if (event.type === "loading") {
      loadingAppId = event.appId;
      appLoaderServices.dynamicIsland.set({
        kind: "status",
        title: i18n.t("app.loadingTitle", { app: appName }),
        detail: i18n.t("app.loadingDetail"),
        priority: 20,
      });
      return;
    }
    if (loadingAppId === event.appId && ["ready", "error", "superseded", "rejected", "active"].includes(event.type)) {
      loadingAppId = null;
      appLoaderServices.dynamicIsland.clear();
    }
    if (event.type === "error") {
      appLoaderServices.notify({
        id: `app-loader:${event.appId}:error:${event.attempt}`,
        title: i18n.t("app.loadErrorTitle", { app: appName }),
        body: i18n.t("app.loadErrorBody"),
      });
    }
  });
  const island = document.querySelector("#dynamicIsland");
  const sideButton = document.querySelector("#sideButton");
  const statusTime = document.querySelector("#statusTime");
  const lockTime = document.querySelector("#lockTime");
  const lockDate = document.querySelector("#lockDate");
  const controlTime = document.querySelector("#controlTime");
  const previewPasscode = previewParams.get("passcode");
  const lockController = new window.MercuryLockController({
    machine: stateMachine,
    events: window.MercuryEvents,
    gestureManager,
    components,
    lockScreen: document.querySelector("#lockScreen"),
    passcodeScreen: document.querySelector("#passcodeScreen"),
    keypad: document.querySelector("#passcodeKeypad"),
    dots: document.querySelector("#passcodeDots"),
    message: document.querySelector("#passcodeMessage"),
    cancelButton: document.querySelector("#passcodeCancel"),
    storage: systemServices.storageBackend,
    previewPasscode,
  });
  const homeController = new window.MercuryHomeController({
    root: document.querySelector("#homeScreen"),
    machine: stateMachine,
    gestureManager,
    components,
    i18n,
    onLaunch: (appId) => requestAppLaunch(appId),
  });
  const snapshotService = new window.MercuryAppSnapshotService();
  const appSwitcherView = new window.MercuryAppSwitcherView({
    root: document.querySelector("#appSwitcher"),
    i18n,
    snapshotService,
  });
  const appSwitcherController = new window.MercuryAppSwitcherController({
    view: appSwitcherView,
    screen,
    machine: stateMachine,
    events: window.MercuryEvents,
    appEngine,
  });
  const homeBarController = new window.MercuryHomeBarController({
    screen,
    gestureTarget: document.querySelector("#homeGestureZone"),
    machine: stateMachine,
    events: window.MercuryEvents,
    gestureManager,
    appEngine,
  });
  const overlayController = new window.MercuryOverlayController({
    root: document.querySelector("#systemOverlay"),
    screen,
    machine: stateMachine,
    events: window.MercuryEvents,
    gestureManager,
    notificationStore,
    i18n,
    brightnessLayer: document.querySelector("#brightnessLayer"),
    storage: systemServices.storageBackend,
  });
  const islandController = new window.MercuryIslandController({ island, systemServices, i18n });

  sideButton.addEventListener("click", () => {
    islandController.toggleExpanded(false);
    if (!shell.sleeping && stateMachine.can(window.MercuryEvents.LOCK)) stateMachine.dispatch(window.MercuryEvents.LOCK);
    shell.setSleeping(!shell.sleeping);
    sideButton.setAttribute("aria-label", shell.sleeping ? "唤醒设备" : "锁定设备");
  });

  const updateClock = () => {
    const now = new Date();
    const time = new Intl.DateTimeFormat(i18n.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    statusTime.textContent = time;
    statusTime.dateTime = time;
    lockTime.textContent = time;
    lockTime.dateTime = time;
    controlTime.textContent = time;
    lockDate.textContent = i18n.formatDate(now, { weekday: "long", month: "long", day: "numeric" });
  };
  updateClock();
  window.setInterval(updateClock, 15000);
  i18n.translate();
  document.querySelector("#passcodeMessage").dataset.errorText = i18n.t("lock.error");
  document.querySelector("#lockScreen").setAttribute("aria-label", i18n.t("lock.unlock"));
  i18n.subscribe(() => {
    i18n.translate();
    updateClock();
    document.querySelector("#passcodeMessage").dataset.errorText = i18n.t("lock.error");
    document.querySelector("#lockScreen").setAttribute("aria-label", i18n.t("lock.unlock"));
  });

  systemServices.subscribe((event) => {
    if (event.type === "theme:requested") screen.dataset.theme = event.theme;
    if (event.type === "notification:requested") notificationStore.add({ ...event.notification, kind: "message" });
  });

  window.setTimeout(() => {
    stateMachine.dispatch(window.MercuryEvents.BOOT_COMPLETE);
  }, 420);

  window.MercuryRuntime = Object.freeze({ shell, stateMachine, stateController, systemServices, components, gestureManager, widgetRegistry, notificationStore, lockController, homeController, homeBarController, snapshotService, appSwitcherView, appSwitcherController, overlayController, islandController, appEngine, appLoader, i18n });
})();

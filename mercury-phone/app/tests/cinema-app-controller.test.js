"use strict";

const assert = require("node:assert/strict");
global.window = global;

const stageCatalogModule = require("../core/cinema-stage-catalog.js");
const contracts = require("../core/cinema-contracts.js");
const RealCinemaStore = require("../system/cinema-store.js");
require("../use-cases/cinema-closure-workflow.js");
const quietStation = require("./fixtures/quiet-station-stage.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
const quietCatalog = stageCatalogModule.createStageCatalog([quietStation]);
const profile = { id: "profile-controller", name: "Controller Safety", description: "Controller boundary fixture." };
const archiveCharacter = {
  id: "character-controller",
  displayName: "Safety Character",
  identity: "A patient traveler",
  summary: "Keeps controller tests source-neutral.",
  stableTraits: ["patient"],
  values: ["clarity"],
  boundaries: ["no coercion"],
};

class FakeTextNode {
  constructor(value) {
    this.tagName = "#text";
    this.textContent = String(value);
    this.children = [];
    this.parentElement = null;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.hidden = false;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.style = {
      values: {},
      setProperty: (name, value) => { this.style.values[name] = String(value); },
    };
    this.classList = {
      add: (...names) => {
        const values = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => values.add(name));
        this.className = Array.from(values).join(" ");
      },
      remove: (...names) => {
        this.className = this.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(" ");
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const present = this.className.split(/\s+/).includes(name);
        const enabled = force === undefined ? !present : Boolean(force);
        if (enabled) this.classList.add(name);
        else this.classList.remove(name);
        return enabled;
      },
    };
  }

  append(...nodes) {
    nodes.filter((node) => node !== null && node !== undefined).forEach((node) => {
      const child = typeof node === "string" ? new FakeTextNode(node) : node;
      child.parentElement = this;
      this.children.push(child);
    });
  }

  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }

  addEventListener(name, listener) {
    if (!this.listeners[name]) this.listeners[name] = [];
    this.listeners[name].push(listener);
  }

  querySelector(selector) {
    const notice = String(selector).match(/^\[data-notice-id="(.+)"\]$/);
    if (!notice) return null;
    return walk(this).find((node) => node.dataset?.noticeId === notice[1]) || null;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  scrollIntoView() {}
  focus() { global.document.activeElement = this; }
  blur() { if (global.document.activeElement === this) global.document.activeElement = null; }
}

global.document = {
  activeElement: null,
  createElement: (tagName) => new FakeElement(tagName),
  createTextNode: (value) => new FakeTextNode(value),
};
global.requestAnimationFrame = (callback) => { callback(); return 1; };
global.matchMedia = () => ({ matches: true });

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
let scheduledTimers = [];
let nextTimerId = 1;

global.setTimeout = (callback, delay = 0) => {
  const timer = { id: nextTimerId++, callback, delay: Number(delay) || 0, cleared: false, ran: false };
  scheduledTimers.push(timer);
  return timer.id;
};

global.clearTimeout = (id) => {
  const timer = scheduledTimers.find((item) => item.id === id);
  if (timer) timer.cleared = true;
};

function resetTimers() {
  scheduledTimers = [];
  nextTimerId = 1;
}

function runNextTimer() {
  const timer = scheduledTimers
    .filter((item) => !item.cleared && !item.ran)
    .sort((left, right) => left.delay - right.delay || left.id - right.id)[0];
  if (!timer) return null;
  timer.ran = true;
  timer.callback();
  return timer.delay;
}

function walk(node) {
  if (!node) return [];
  return [node, ...(node.children || []).flatMap(walk)];
}

function nodesByTag(root, tagName) {
  return walk(root).filter((node) => node.tagName === String(tagName).toLowerCase());
}

function containsExactText(node, value) {
  return walk(node).some((item) => item.textContent === value);
}

function containsTextFragment(node, value) {
  return walk(node).some((item) => String(item.textContent || "").includes(value));
}

function buttonContaining(root, value) {
  return nodesByTag(root, "button").find((button) => containsExactText(button, value)) || null;
}

function containerContaining(root, tagName, value) {
  return nodesByTag(root, tagName).find((node) => containsExactText(node, value)) || null;
}

function findClass(root, value) {
  return walk(root).find((node) => String(node.className || "").split(/\s+/).includes(value)) || null;
}

function lastButtonWithin(node) {
  return nodesByTag(node, "button").at(-1) || null;
}

function recoveryAction(root) {
  const readingMain = nodesByTag(root, "main").at(-1);
  if (!readingMain) return null;
  const recoverySection = nodesByTag(readingMain, "section").find((section) => nodesByTag(section, "button").length > 0);
  return recoverySection ? nodesByTag(recoverySection, "button")[0] : null;
}

async function click(node) {
  assert.ok(node, "expected an interactive controller element");
  const event = { target: node, preventDefault() {}, stopPropagation() {} };
  for (const listener of node.listeners.click || []) await listener(event);
  await Promise.resolve();
}

async function fire(node, eventName, extra = {}) {
  assert.ok(node, `expected an element for ${eventName}`);
  const event = { target: node, currentTarget: node, preventDefault() {}, stopPropagation() {}, ...extra };
  for (const listener of node.listeners[eventName] || []) await listener(event);
  await Promise.resolve();
}

async function openProgrammeEntryAndContinue(harness, title) {
  await openProgramme(harness);
  await click(buttonContaining(harness.root, title));
  assert.ok(containsExactText(harness.root, "PROGRAMME ENTRY"), `${title} opens its Programme Entry before continuation`);
  assert.deepEqual(harness.store.calls.focusInstance, [], "opening Programme Entry is presentation-only");
  await click(findClass(harness.root, "cinema-programme-entry__continue"));
}

async function openProgramme(harness) {
  const programmeEntrance = nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "节目单");
  if (programmeEntrance) await click(programmeEntrance);
}

async function openEndingFromReading(harness) {
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "放映菜单"));
  await click(buttonContaining(harness.root, "结束本场演出"));
  assert.ok(findClass(harness.root, "cinema-ending-confirmation"), "Reading reaches the dedicated ending confirmation");
}

async function finishCurtainAndReachCredits(harness) {
  assert.ok(findClass(harness.root, "cinema-curtain--ending"), "durable begin-ending enters the ending curtain");
  assert.equal(runNextTimer(), 120, "ending persistence starts from the owned curtain callback");
  assert.equal(harness.store.focused(), null, "atomic finish clears ended focus in the same in-memory transition");
  assert.equal(findClass(harness.root, "cinema-credits"), null, "Credits remain withheld while the close duration is unsettled");
  await harness.store.flush();
  assert.equal(runNextTimer(), 40, "reduced motion retains one deterministic minimum close boundary");
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(findClass(harness.root, "cinema-credits"), "Credits appear only after durable ended persistence and curtain settlement");
}

let activeConfiguration = null;

class InstrumentedCinemaStore extends RealCinemaStore {
  constructor(options = {}) {
    const configuration = activeConfiguration;
    if (!configuration) throw new Error("Controller test Store was created without a configuration.");
    const repository = {
      async load(fallback) { return clone(configuration.initialState || fallback); },
      async save(value) {
        configuration.saveAttempts += 1;
        if (configuration.failSaveAt === configuration.saveAttempts) throw new Error("simulated closure storage failure");
        configuration.persistedState = clone(value);
        configuration.persistedStates.push(clone(value));
      },
    };
    super({ repository, catalog: options.catalog, clock: configuration.clock });
    this.calls = {
      markEntered: [],
      beginDraft: [],
      flushDraftPersistence: [],
      openCurtain: [],
      focusInstance: [],
      resume: [],
      beginEnding: [],
      abandonPendingAndBeginEnding: [],
      finish: [],
    };
    configuration.store = this;
  }

  markEntered() {
    this.calls.markEntered.push(true);
    return super.markEntered();
  }

  beginDraft(stageId) {
    this.calls.beginDraft.push(stageId);
    return super.beginDraft(stageId);
  }

  flushDraftPersistence() {
    this.calls.flushDraftPersistence.push(true);
    return super.flushDraftPersistence();
  }

  openCurtain() {
    this.calls.openCurtain.push(true);
    return super.openCurtain();
  }

  focusInstance(instanceId) {
    this.calls.focusInstance.push(instanceId);
    return super.focusInstance(instanceId);
  }

  resume(instanceId) {
    this.calls.resume.push(instanceId);
    return super.resume(instanceId);
  }

  beginEnding(instanceId) {
    this.calls.beginEnding.push(instanceId);
    return super.beginEnding(instanceId);
  }

  abandonPendingAndBeginEnding(instanceId, expectedRequestId) {
    this.calls.abandonPendingAndBeginEnding.push([instanceId, expectedRequestId]);
    return super.abandonPendingAndBeginEnding(instanceId, expectedRequestId);
  }

  finish(instanceId) {
    this.calls.finish.push(instanceId);
    return super.finish(instanceId);
  }
}

class SpyWorkflow {
  constructor(options = {}) {
    this.store = options.store;
    this.transport = options.transport;
    this.retryCalls = 0;
    this.continueCalls = [];
    this.cancelCalls = 0;
    this.state = clone(activeConfiguration?.workflowState || { phase: "idle", requestId: null, error: null });
    this.listener = null;
    SpyWorkflow.latest = this;
  }

  subscribe(listener) { this.listener = listener; return () => { this.listener = null; }; }
  snapshot() { return clone(this.state); }
  setState(state) { this.state = clone(state); this.listener?.(this.snapshot()); }
  async retry() { this.retryCalls += 1; return { accepted: true }; }
  async continueWith(value) { this.continueCalls.push(value); return { accepted: true }; }
  cancel() { this.cancelCalls += 1; return true; }
}

global.MercuryCinemaStore = InstrumentedCinemaStore;
global.MercuryArchiveContracts = {
  createArchiveStore() {
    return { load: () => ({ runtimeProfiles: [clone(archiveCharacter)], characters: [clone(archiveCharacter)] }) };
  },
};
global.MercuryGenerationProfileStore = class {
  list() { return [clone(profile)]; }
};
global.MercuryCinemaGenerationWorkflow = SpyWorkflow;

const { MercuryCinemaAppController, buildBeforeCurtainModel, buildCharacterAdaptationModel } = require("../apps/cinema-app.js");

let instanceOrdinal = 0;

function makeInstance({
  id,
  title,
  status = "active",
  catalog = quietCatalog,
  stageId = quietStation.id,
  scenarioId = quietStation.scenarios[0].id,
  pending = false,
  malformedPending = false,
} = {}) {
  instanceOrdinal += 1;
  const stage = catalog.getStage(stageId);
  const scenario = stage && catalog.getScenario(stageId, scenarioId);
  const sceneId = `${id}-scene`;
  const openingId = `${id}-opening`;
  const pendingUserId = `${id}-pending-user`;
  const createdAt = `2026-08-20T08:${String(instanceOrdinal).padStart(2, "0")}:00.000Z`;
  const segments = [{
    id: openingId,
    sceneId,
    role: "assistant",
    text: `${title} opening prose.`,
    status: "complete",
    createdAt,
    generationProfileId: profile.id,
  }];
  if (pending) {
    segments.push({
      id: pendingUserId,
      sceneId,
      role: "user",
      text: `${title} unresolved user prose.`,
      status: "complete",
      createdAt,
      generationProfileId: profile.id,
    });
  }
  return {
    id,
    title,
    programmeSubtitle: "Controller fixture",
    status,
    stageId,
    stageSnapshot: stage ? contracts.createStageSnapshot(stage) : contracts.createStageSnapshot({ id: stageId, title: "Removed Stage", shortTitle: "Removed", unavailable: true }),
    scenarioId,
    scenarioSnapshot: scenario ? contracts.createScenarioSnapshot(scenario) : contracts.createScenarioSnapshot({ id: scenarioId, title: "Retained Scenario", unavailable: true }),
    characterSnapshot: clone(archiveCharacter),
    player: { name: "Controller Player", role: "traveler", specialization: "" },
    variant: {},
    generationProfileId: profile.id,
    generationProfileSnapshot: clone(profile),
    runtimeProfileHistory: [{ profileId: profile.id, snapshot: clone(profile), appliedAt: createdAt }],
    scenes: [{ id: sceneId, actNumber: 1, sceneNumber: 1, title: `${title} scene`, createdAt }],
    currentSceneId: sceneId,
    segments,
    notes: { overview: `${title} notes` },
    pendingContinuation: malformedPending
      ? { requestId: `${id}-malformed-request` }
      : pending
        ? { requestId: `${id}-request`, userSegmentId: pendingUserId, startedAt: createdAt, generationProfileId: profile.id }
        : null,
    createdAt,
    updatedAt: createdAt,
    endedAt: status === "ended" ? createdAt : "",
  };
}

function makeState(instances, focusedInstanceId, options = {}) {
  return {
    ...contracts.createState(),
    hasEntered: options.hasEntered !== false,
    tutorialSeen: true,
    focusedInstanceId: focusedInstanceId || null,
    draft: options.draft || null,
    instances: clone(instances),
  };
}

function narrativeProjection(instance) {
  return {
    status: instance.status,
    updatedAt: instance.updatedAt,
    scenes: instance.scenes,
    currentSceneId: instance.currentSceneId,
    segments: instance.segments,
    notes: instance.notes,
    pendingContinuation: instance.pendingContinuation,
  };
}

async function mount(initialState, options = {}) {
  resetTimers();
  let now = Date.parse("2026-08-20T12:00:00.000Z");
  const configuration = {
    initialState: clone(initialState),
    persistedState: null,
    persistedStates: [],
    saveAttempts: 0,
    failSaveAt: Number(options.failSaveAt) || 0,
    clock: () => { now += 1000; return now; },
    store: null,
    workflowState: options.workflowState || null,
  };
  activeConfiguration = configuration;
  let transportCalls = 0;
  const launchCalls = [];
  const context = {
    services: {
      storage: {},
      sharedStorage: {},
      requestHome() {},
      launchApp(...args) { launchCalls.push(args); return true; },
      aiTransport: {
        connectionStatus: () => ({ ready: true }),
        async generateCinema() { transportCalls += 1; return null; },
      },
    },
  };
  const root = new FakeElement("main");
  const app = new MercuryCinemaAppController({ catalog: options.catalog || quietCatalog });
  app.render(root, context, options.launchPayload);
  await app.initialization;
  return {
    app,
    root,
    context,
    store: activeConfiguration.store,
    workflow: SpyWorkflow.latest,
    configuration,
    launchCalls,
    transportCalls: () => transportCalls,
    close: async () => {
      try { await configuration.store.flush(); } catch (_error) {}
      app.onUnmount();
      resetTimers();
    },
  };
}

async function testContinueInstancePolicy() {
  const anchor = makeInstance({ id: "continue-anchor", title: "Continue Anchor" });
  const active = makeInstance({ id: "continue-active", title: "Selectable Active" });
  const intermission = makeInstance({ id: "continue-intermission", title: "Selectable Intermission", status: "intermission" });
  const ending = makeInstance({ id: "continue-ending", title: "Selectable Ending", status: "ending" });
  const ended = makeInstance({ id: "continue-ended", title: "Archived Ending", status: "ended" });
  const instances = [anchor, active, intermission, ending, ended];

  let harness = await mount(makeState(instances, anchor.id));
  const activeBefore = harness.store.get(active.id);
  const anchorBefore = narrativeProjection(harness.store.get(anchor.id));
  await openProgrammeEntryAndContinue(harness, active.title);
  await harness.store.flush();
  assert.deepEqual(harness.store.calls.focusInstance, [active.id], "active selection focuses the exact Instance id");
  assert.deepEqual(harness.store.calls.resume, [], "active selection never calls resume");
  assert.equal(harness.store.focused().id, active.id);
  assert.deepEqual(harness.store.get(active.id), activeBefore, "focus does not mutate active lifecycle or narrative state");
  assert.deepEqual(narrativeProjection(harness.store.get(anchor.id)), anchorBefore, "selecting active does not mutate another Instance");
  assert.ok(containsExactText(harness.root, active.segments[0].text), "active selection reaches the Instance reading surface");
  await harness.close();

  harness = await mount(makeState(instances, anchor.id));
  const intermissionBefore = harness.store.get(intermission.id);
  const unrelatedBefore = narrativeProjection(harness.store.get(active.id));
  await openProgrammeEntryAndContinue(harness, intermission.title);
  assert.deepEqual(harness.store.calls.focusInstance, [intermission.id], "intermission selection focuses the exact Instance id");
  assert.deepEqual(harness.store.calls.resume, [], "selecting intermission does not resume immediately");
  assert.equal(harness.store.get(intermission.id).status, "intermission");
  const resumeAction = nodesByTag(harness.root, "button")[0];
  await click(resumeAction);
  assert.deepEqual(harness.store.calls.resume, [], "resume remains behind the explicit curtain action timer");
  assert.equal(runNextTimer(), 40, "reduced-motion controller timing makes the curtain callback test-controlled");
  await harness.store.flush();
  assert.deepEqual(harness.store.calls.resume, [intermission.id]);
  assert.equal(harness.store.get(intermission.id).status, "active");
  assert.deepEqual(harness.store.get(intermission.id).scenes, intermissionBefore.scenes, "resume does not advance Scenes");
  assert.deepEqual(harness.store.get(intermission.id).segments, intermissionBefore.segments, "resume does not append Segments");
  assert.deepEqual(narrativeProjection(harness.store.get(active.id)), unrelatedBefore, "resuming one Instance does not affect another");
  await harness.close();

  harness = await mount(makeState(instances, anchor.id));
  await openProgrammeEntryAndContinue(harness, ending.title);
  assert.deepEqual(harness.store.calls.focusInstance, [ending.id], "ending selection focuses the exact Instance id");
  assert.deepEqual(harness.store.calls.beginEnding, [], "an already-ending Instance does not invent a second begin-ending path");
  assert.deepEqual(harness.store.calls.finish, [], "ending selection enters the curtain before completion");
  assert.equal(runNextTimer(), 120, "the existing ending-curtain callback performs completion");
  await harness.store.flush();
  assert.deepEqual(harness.store.calls.finish, [ending.id]);
  assert.equal(harness.store.get(ending.id).status, "ended");
  await harness.close();

  harness = await mount(makeState(instances, anchor.id));
  await openProgramme(harness);
  await click(buttonContaining(harness.root, ended.title));
  assert.deepEqual(harness.store.calls.focusInstance, [], "ended archive selection never enters unfinished continuation focus");
  assert.equal(harness.store.focused().id, anchor.id);
  assert.ok(containsExactText(harness.root, ended.segments[0].text), "ended selection remains a read-only history action");
  await harness.close();
}

async function testIntermissionProjectionAndRecoveryBoundary() {
  const normal = makeInstance({ id: "intermission-normal", title: "Intermission Normal", status: "intermission" });
  normal.structureProvenance = { scenes: "compatibility-unknown" };
  let harness = await mount(makeState([normal], normal.id), { launchPayload: { route: "active" } });
  runNextTimer();
  assert.ok(findClass(harness.root, "cinema-intermission"));
  assert.equal(findClass(harness.root, "cinema-intermission").dataset.structureProvenance, "compatibility-unknown", "explicit compatibility provenance fails closed in production state");
  assert.equal(containsTextFragment(harness.root, "ACT 1"), false, "compatibility Scene arrays do not leak as canonical structure");
  assert.equal(containsTextFragment(harness.root, "分钟"), false);
  assert.equal(containsTextFragment(harness.root, "已演出"), false);
  assert.equal(containsTextFragment(harness.root, "场次"), false);
  const primary = buttonContaining(harness.root, "继续演出");
  await click(primary);
  await click(primary);
  assert.ok(findClass(harness.root, "cinema-curtain--resume"), "normal pause enters the existing resume curtain");
  assert.deepEqual(harness.store.calls.focusInstance, [normal.id], "repeated activation cannot re-enter the transition");
  assert.equal(harness.workflow.retryCalls, 0);
  await harness.close();

  const pending = makeInstance({ id: "intermission-pending", title: "Intermission Pending", status: "intermission", pending: true });
  harness = await mount(makeState([pending], pending.id), { launchPayload: { route: "active" } });
  runNextTimer();
  const pendingBefore = clone(harness.store.focused().pendingContinuation);
  assert.ok(containsExactText(harness.root, "处理待续写"));
  assert.ok(containsTextFragment(harness.root, "明确重试"));
  assert.equal(harness.workflow.retryCalls, 0);
  await click(buttonContaining(harness.root, "处理待续写"));
  assert.ok(findClass(harness.root, "cinema-reading"), "pending action returns to Reading so the existing recovery delegate remains visible");
  assert.deepEqual(harness.store.calls.resume, [pending.id]);
  assert.deepEqual(harness.store.focused().pendingContinuation, pendingBefore, "opening pending recovery does not clear durable request identity");
  assert.equal(harness.workflow.retryCalls, 0, "Intermission never retries pending work implicitly");
  const retry = recoveryAction(harness.root);
  assert.ok(retry && containsExactText(retry, "重试续写"));
  await click(retry);
  assert.equal(harness.workflow.retryCalls, 1, "only the existing explicit Reading recovery action retries");
  await harness.close();

  const notesTarget = makeInstance({ id: "intermission-notes", title: "Intermission Notes", status: "intermission" });
  harness = await mount(makeState([notesTarget], notesTarget.id), { launchPayload: { route: "active" } });
  runNextTimer();
  await click(buttonContaining(harness.root, "查看场记"));
  assert.ok(findClass(harness.root, "cinema-notes"), "read-only notes remain reachable from Intermission");
  assert.equal(harness.store.calls.resume.length, 0);
  assert.equal(harness.workflow.retryCalls, 0);
  await harness.close();
}

async function testProgrammeNavigationClosure() {
  const active = makeInstance({ id: "navigation-active", title: "Navigation Active" });
  let harness = await mount(makeState([active], active.id));
  const original = narrativeProjection(harness.store.get(active.id));

  await openProgramme(harness);
  await click(findClass(containerContaining(harness.root, "article", active.title), "cinema-programme-hub__current-entry"));
  const entryBack = findClass(harness.root, "cinema-programme-entry__back");
  assert.equal(entryBack.attributes["aria-label"], "返回节目单");
  await click(entryBack);
  assert.ok(containerContaining(harness.root, "article", active.title), "Programme Entry back returns to the current Programme hub");
  assert.deepEqual(narrativeProjection(harness.store.get(active.id)), original, "Programme Entry back is narrative-neutral");
  assert.deepEqual(harness.store.calls.focusInstance, [], "Programme Entry back does not refocus or resume an Instance");
  assert.equal(harness.transportCalls(), 0, "Programme Entry back never starts generation");

  await click(findClass(containerContaining(harness.root, "article", active.title), "cinema-programme-hub__current-entry"));
  assert.ok(containsExactText(harness.root, "PROGRAMME ENTRY"), "current Programme ticket reopens Programme Entry");
  await click(findClass(harness.root, "cinema-programme-entry__continue"));
  const readingBeforeExit = narrativeProjection(harness.store.get(active.id));
  const readingExit = findClass(harness.root, "cinema-reading__programme-exit");
  assert.ok(containsExactText(readingExit, "节目单"), "Reading exposes a visible Programme safe exit");
  assert.equal(readingExit.attributes["aria-label"], "返回节目单");
  await click(readingExit);
  assert.ok(containerContaining(harness.root, "article", active.title), "Reading safe exit returns to Programme instead of browser history");
  assert.deepEqual(narrativeProjection(harness.store.get(active.id)), readingBeforeExit, "Reading safe exit preserves lifecycle, prose, and continuity");
  assert.deepEqual(harness.store.calls.resume, [], "Reading safe exit never resumes implicitly");
  assert.deepEqual(harness.store.calls.beginEnding, [], "Reading safe exit never ends the Performance");
  assert.equal(harness.transportCalls(), 0, "Reading safe exit never starts generation");
  await harness.close();

  const pending = makeInstance({ id: "navigation-pending", title: "Navigation Pending", pending: true });
  harness = await mount(makeState([pending], pending.id), { launchPayload: { route: "active" } });
  const pendingIdentity = clone(harness.store.focused().pendingContinuation);
  await click(findClass(harness.root, "cinema-reading__programme-exit"));
  assert.deepEqual(harness.store.focused().pendingContinuation, pendingIdentity, "Reading safe exit preserves durable pending identity");
  assert.equal(harness.workflow.retryCalls, 0, "Reading safe exit never retries pending generation");
  assert.equal(harness.transportCalls(), 0, "Reading safe exit never auto-resends pending generation");
  await harness.close();

  harness = await mount(makeState([active], active.id));
  await openProgramme(harness);
  await click(findClass(containerContaining(harness.root, "article", active.title), "cinema-programme-hub__current-entry"));
  const instancesBeforeStart = clone(harness.store.snapshot().instances);
  await click(findClass(harness.root, "cinema-programme-entry__start"));
  assert.ok(findClass(harness.root, "cinema-world-library"), "start-another enters World Library before a World detail");
  assert.equal(walk(harness.root).filter((node) => String(node.className || "").split(/\s+/).includes("cinema-world-rail")).length, 0, "one-World production Catalog does not render fake neighbors");
  await click(findClass(harness.root, "cinema-world-plane__action"));
  assert.ok(containsExactText(harness.root, quietStation.premise), "start-another action enters the existing Stage preparation path");
  assert.deepEqual(harness.store.calls.beginDraft, [], "browsing from start-another does not create a draft yet");
  assert.deepEqual(harness.store.calls.focusInstance, [], "start-another never delegates to Continue");
  assert.deepEqual(harness.store.snapshot().instances, instancesBeforeStart, "start-another does not clone or create an Instance");
  await harness.close();
}

async function testProgrammeArchiveIndexNavigation() {
  const ongoing = makeInstance({ id: "archive-ongoing", title: "仍在演出的节目" });
  const endedA = makeInstance({ id: "archive-ended-a", title: "静默子午线", status: "ended" });
  const endedB = makeInstance({ id: "archive-ended-b", title: "潮汐退去以前，那封仍未寄出的第三封信", status: "ended" });
  const endedOther = makeInstance({ id: "archive-ended-other", title: "无昼之后", status: "ended" });
  endedOther.characterSnapshot = { ...endedOther.characterSnapshot, id: "character-other", displayName: "叶知栖" };
  endedOther.stageId = "world-other";
  endedOther.stageSnapshot = { ...endedOther.stageSnapshot, id: "world-other", title: "无昼城", shortTitle: "无昼城" };
  const initialState = makeState([ongoing, endedA, endedB, endedOther], ongoing.id);
  let harness = await mount(initialState);

  await openProgramme(harness);
  await click(buttonContaining(harness.root, "查看全部往期"));
  assert.ok(findClass(harness.root, "cinema-programme-archive"), "Programme owns the complete archive subview");
  assert.equal(findClass(harness.root, "cinema-programme-archive").dataset.archiveState, "populated");
  assert.equal(walk(harness.root).filter((node) => String(node.className || "").split(/\s+/).includes("cinema-programme-archive__group")).length, 2);
  assert.equal(walk(harness.root).filter((node) => String(node.className || "").split(/\s+/).includes("cinema-programme-archive__performance")).length, 3);
  assert.equal(containsExactText(harness.root, ongoing.title), false, "unfinished Performances never leak into the archive index");

  const beforeHistory = clone(harness.store.snapshot());
  const historyEntry = walk(harness.root).find((node) => node.dataset?.instanceId === endedA.id);
  await click(historyEntry);
  assert.ok(findClass(harness.root, "cinema-history-reader"), "ended archive selection opens immutable History");
  assert.deepEqual(harness.store.calls.focusInstance, [], "archive selection never focuses or resumes an ended Performance");
  assert.deepEqual(harness.store.calls.resume, []);
  assert.deepEqual(harness.store.snapshot(), beforeHistory, "Archive to History navigation is presentation-only");
  const archiveBack = findClass(harness.root, "cinema-history-reader__back");
  assert.equal(archiveBack.attributes["aria-label"], "返回往期索引");
  await click(archiveBack);
  assert.ok(findClass(harness.root, "cinema-programme-archive"), "History returns to its Archive origin");
  await click(findClass(harness.root, "cinema-programme-archive__back"));
  assert.ok(findClass(harness.root, "cinema-programme-hub"), "Archive remains a Programme subview");
  await harness.close();

  harness = await mount(initialState, { launchPayload: { route: "past" } });
  assert.ok(findClass(harness.root, "cinema-programme-archive"), "legacy Past launch redirects to the single Archive presentation");
  assert.equal(findClass(harness.root, "cinema-past"), null);
  await harness.close();

  harness = await mount(makeState([ongoing], ongoing.id), { launchPayload: { route: "programme-archive" } });
  assert.equal(findClass(harness.root, "cinema-programme-archive").dataset.archiveState, "empty");
  assert.ok(containsExactText(harness.root, "还没有谢幕的演出"));
  assert.equal(findClass(harness.root, "cinema-programme-archive__performance"), null, "empty Archive never invents sample history");
  await harness.close();
}

async function testPendingSelectionFromHome() {
  const anchor = makeInstance({ id: "pending-anchor", title: "Pending Anchor" });
  const activePending = makeInstance({ id: "pending-active", title: "Active Pending", pending: true });
  const intermissionPending = makeInstance({ id: "pending-intermission", title: "Intermission Pending", status: "intermission", pending: true });
  const instances = [anchor, activePending, intermissionPending];

  let harness = await mount(makeState(instances, anchor.id));
  await openProgrammeEntryAndContinue(harness, activePending.title);
  assert.deepEqual(harness.store.calls.focusInstance, [activePending.id]);
  assert.ok(recoveryAction(harness.root), "active pending selection exposes an explicit recovery action");
  assert.equal(nodesByTag(harness.root, "form").length, 0, "active pending selection suppresses the composer");
  assert.equal(harness.transportCalls(), 0, "selecting active pending never starts model transport");
  assert.equal(harness.workflow.retryCalls, 0);
  await click(recoveryAction(harness.root));
  assert.equal(harness.workflow.retryCalls, 1, "retry remains an explicit user action delegated to Workflow");
  await harness.close();

  harness = await mount(makeState(instances, anchor.id));
  const pendingBefore = clone(harness.store.get(intermissionPending.id).pendingContinuation);
  await openProgrammeEntryAndContinue(harness, intermissionPending.title);
  assert.deepEqual(harness.store.calls.focusInstance, [intermissionPending.id]);
  assert.deepEqual(harness.store.calls.resume, [], "intermission pending selection stops at the resume curtain");
  assert.equal(harness.transportCalls(), 0);
  await click(nodesByTag(harness.root, "button")[0]);
  runNextTimer();
  await harness.store.flush();
  assert.equal(harness.store.get(intermissionPending.id).status, "active");
  assert.deepEqual(harness.store.get(intermissionPending.id).pendingContinuation, pendingBefore, "resume preserves pending identity");
  assert.ok(recoveryAction(harness.root), "resumed pending Instance still exposes explicit recovery");
  assert.equal(nodesByTag(harness.root, "form").length, 0, "resumed pending Instance still suppresses composer");
  assert.equal(harness.transportCalls(), 0, "resume does not automatically retry pending generation");
  await harness.close();
}

async function testMultipleAndOrphanedReachability() {
  const anchor = makeInstance({ id: "reach-anchor", title: "Reachability Anchor" });
  const sharedOne = makeInstance({ id: "reach-shared-one", title: "Shared Stage One" });
  const sharedTwo = makeInstance({ id: "reach-shared-two", title: "Shared Stage Two", status: "intermission" });
  const orphan = makeInstance({
    id: "reach-orphan",
    title: "Removed Stage Performance",
    stageId: "removed-stage",
    scenarioId: "removed-scenario",
  });
  const instances = [anchor, sharedOne, sharedTwo, orphan];

  let harness = await mount(makeState(instances, anchor.id));
  await openProgramme(harness);
  assert.equal(sharedOne.stageId, sharedTwo.stageId);
  assert.equal(sharedOne.scenarioId, sharedTwo.scenarioId);
  assert.ok(buttonContaining(harness.root, sharedOne.title), "first same-Stage/Scenario Instance remains individually reachable");
  assert.ok(buttonContaining(harness.root, sharedTwo.title), "second same-Stage/Scenario Instance remains individually reachable");
  assert.ok(buttonContaining(harness.root, orphan.title), "orphaned Stage snapshot Instance remains reachable from Home");
  const sharedOneBefore = narrativeProjection(harness.store.get(sharedOne.id));
  await openProgrammeEntryAndContinue(harness, sharedTwo.title);
  assert.deepEqual(harness.store.calls.focusInstance, [sharedTwo.id], "selection uses exact Instance id instead of Stage/Scenario identity");
  assert.equal(harness.store.get(sharedTwo.id).status, "intermission", "focus does not resume the selected Instance");
  assert.deepEqual(narrativeProjection(harness.store.get(sharedOne.id)), sharedOneBefore, "selecting one same-Stage Instance leaves the other unchanged");
  await harness.close();

  harness = await mount(makeState(instances, anchor.id));
  await openProgrammeEntryAndContinue(harness, sharedOne.title);
  assert.deepEqual(harness.store.calls.focusInstance, [sharedOne.id], "the other same-Stage/Scenario Instance is independently selectable by id");
  assert.equal(harness.store.focused().id, sharedOne.id);
  await harness.close();

  harness = await mount(makeState(instances, anchor.id));
  assert.equal(quietCatalog.getStage(orphan.stageId), null, "the orphan's Stage is absent from the current Catalog");
  await openProgrammeEntryAndContinue(harness, orphan.title);
  assert.deepEqual(harness.store.calls.focusInstance, [orphan.id]);
  assert.equal(harness.store.focused().id, orphan.id);
  assert.ok(containsExactText(harness.root, orphan.segments[0].text), "orphaned Instance reaches Reading from retained snapshots");
  await harness.close();
}

async function testStageAndCurtainBoundaries() {
  const anchor = makeInstance({ id: "stage-anchor", title: "Stage Boundary Anchor" });
  let harness = await mount(makeState([anchor], anchor.id));
  const beforeBrowse = harness.store.snapshot();
  const worldsEntrance = nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "世界");
  await click(worldsEntrance);
  assert.deepEqual(harness.store.snapshot(), beforeBrowse, "Stage presentation browsing is non-narrative and Store-neutral");
  assert.deepEqual(harness.store.calls.beginDraft, []);
  assert.deepEqual(harness.store.calls.openCurtain, []);
  assert.equal("route" in harness.store.snapshot(), false, "controller route is not persisted in Cinema state");
  assert.equal("routeData" in harness.store.snapshot(), false, "controller route data is not persisted in Cinema state");
  assert.ok(findClass(harness.root, "cinema-world-library"), "Worlds first reaches the dedicated World Library");
  assert.equal(findClass(harness.root, "cinema-world-plane__action--select"), null, "browse mode exposes no preparation action");
  await click(findClass(harness.root, "cinema-world-plane__action--inspect"));
  assert.ok(containsExactText(harness.root, quietStation.premise), "Stage action reaches Catalog-backed Stage detail");
  assert.equal(buttonContaining(harness.root, "选择这一场"), null, "browse-mode World Detail cannot begin a draft");
  assert.deepEqual(harness.store.snapshot(), beforeBrowse, "deep World browsing remains Store-neutral");
  await harness.close();

  const reloadDraft = contracts.createDraft({ stageId: quietStation.id }, () => Date.parse("2026-08-20T12:00:00.000Z"), quietCatalog);
  harness = await mount(makeState([], null, { draft: reloadDraft }));
  await openProgramme(harness);
  const resumeDraft = findClass(harness.root, "cinema-programme-hub__start");
  assert.ok(containsExactText(resumeDraft, "继续准备这场人生"), "a durable preparation Draft remains visibly recoverable after reload");
  await click(resumeDraft);
  assert.ok(findClass(harness.root, "cinema-cast-index"), "a World-only Draft resumes at Character selection");
  assert.deepEqual(harness.store.calls.beginDraft, [], "resuming a durable Draft never replaces it with a new Draft");
  assert.equal(harness.store.snapshot().draft.id, reloadDraft.id);
  await harness.close();

  const adaptedDraft = {
    ...reloadDraft,
    characterId: archiveCharacter.id,
    characterSnapshot: clone(archiveCharacter),
  };
  adaptedDraft.variant = contracts.buildCharacterVariant(adaptedDraft.characterSnapshot, adaptedDraft, quietCatalog);
  harness = await mount(makeState([], null, { draft: adaptedDraft }));
  await openProgramme(harness);
  await click(findClass(harness.root, "cinema-programme-hub__start"));
  assert.ok(findClass(harness.root, "cinema-adaptation"), "a Character-bound Draft resumes at Adaptation without inventing a later confirmation state");
  assert.equal(harness.store.snapshot().draft.id, adaptedDraft.id);
  await harness.close();

  harness = await mount(makeState([anchor], anchor.id));
  await openProgramme(harness);
  await click(findClass(harness.root, "cinema-programme-hub__start"));
  assert.equal(findClass(harness.root, "cinema-world-library").dataset.mode, "prepare", "Programme start enters World Library preparation mode");
  assert.equal(harness.store.snapshot().draft, null, "opening the preparation selector does not create a draft before World choice");
  await click(findClass(harness.root, "cinema-world-plane__action--select"));
  assert.deepEqual(harness.store.calls.beginDraft, [quietStation.id], "explicit World choice delegates to beginDraft");
  assert.equal(harness.store.listUnfinished().length, 1, "beginDraft does not create an Instance");
  assert.equal(harness.store.get(anchor.id).segments.length, anchor.segments.length, "beginDraft does not append Segments");
  assert.equal(harness.store.snapshot().draft.stageId, quietStation.id);
  assert.ok(findClass(harness.root, "cinema-cast-index"), "Stage selection enters the dedicated Cinema Cast");
  assert.equal(findClass(harness.root, "cinema-cast-index").dataset.mode, "prepare");

  const flushesBeforeCharacterNavigation = harness.store.calls.flushDraftPersistence.length;
  await click(buttonContaining(harness.root, archiveCharacter.displayName));
  assert.ok(findClass(harness.root, "cinema-adaptation"), "preparation-mode Character choice advances directly to Adaptation");
  assert.ok(harness.store.calls.flushDraftPersistence.length > flushesBeforeCharacterNavigation, "Draft-dependent navigation forces the coalesced snapshot into the persistence queue");
  assert.equal(harness.store.snapshot().draft.characterId, archiveCharacter.id);
  assert.ok(harness.store.snapshot().draft.characterSnapshot?.id, "Character choice stores a read-only Character snapshot in the draft");
  assert.ok(harness.store.snapshot().draft.variant, "Character choice derives the existing draft-owned adaptation variant");
  assert.equal(harness.store.listUnfinished().length, 1, "Character and adaptation preparation create no Instance");

  await click(buttonContaining(harness.root, "确认适配"));
  assert.ok(findClass(harness.root, "cinema-before-curtain"), "confirming Adaptation advances to Before the Curtain");
  assert.ok(containsExactText(harness.root, "这一生从哪里开始？"));
  assert.ok(containsExactText(harness.root, "幕启时，我们是谁？"));
  assert.ok(containsExactText(harness.root, `经典开场 · ${quietStation.scenarios[0].title}`));
  assert.ok(containsExactText(harness.root, harness.store.snapshot().draft.relationshipStart));
  assert.deepEqual(harness.store.calls.openCurtain, [], "Before the Curtain navigation still does not create the Instance");
  assert.equal(harness.store.listUnfinished().length, 1);

  await click(findClass(harness.root, "cinema-before-curtain__open"));
  assert.deepEqual(harness.store.calls.openCurtain, [], "opening remains behind the explicit curtain callback");
  assert.ok(findClass(harness.root, "cinema-before-curtain").classList.contains("is-opening"), "the visual curtain starts opening before the lifecycle callback");
  await click(findClass(harness.root, "cinema-before-curtain__open"));
  assert.equal(scheduledTimers.filter((timer) => !timer.cleared && !timer.ran).length, 1, "an opening transition owns exactly one lifecycle callback");
  runNextTimer();
  await harness.store.flush();
  assert.equal(harness.store.calls.openCurtain.length, 1);
  assert.equal(harness.store.listUnfinished().length, 2, "opening curtain creates one new Instance");
  const opened = harness.store.focused();
  assert.notEqual(opened.id, anchor.id);
  assert.equal(opened.status, "active");
  assert.equal(opened.scenes.length, 1);
  assert.equal(opened.segments.length, 1);
  assert.equal(opened.segments[0].role, "assistant");
  await harness.close();

  harness = await mount(makeState([], null, { hasEntered: false }));
  assert.deepEqual(harness.store.calls.markEntered, []);
  await click(nodesByTag(harness.root, "button")[0]);
  assert.deepEqual(harness.store.calls.markEntered, [], "entry acknowledgement waits for its explicit curtain callback");
  runNextTimer();
  await harness.store.flush();
  assert.equal(harness.store.calls.markEntered.length, 1);
  assert.equal(harness.store.snapshot().hasEntered, true);
  assert.equal(harness.store.listUnfinished().length, 0);
  await harness.close();

  harness = await mount(makeState([anchor], anchor.id));
  await openProgramme(harness);
  const currentTicket = containerContaining(harness.root, "article", anchor.title);
  await click(findClass(currentTicket, "cinema-programme-hub__current-entry"));
  assert.ok(containsExactText(harness.root, "PROGRAMME ENTRY"), "current Programme ticket opens Programme Entry");
  await click(findClass(harness.root, "cinema-programme-entry__continue"));
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "放映菜单"));
  const menu = nodesByTag(harness.root, "article")
    .map((article) => ({ article, buttons: nodesByTag(article, "button") }))
    .sort((left, right) => right.buttons.length - left.buttons.length)[0];
  await click(menu.buttons.at(-1));
  assert.deepEqual(harness.store.calls.beginEnding, [], "ending navigation alone does not mutate lifecycle");
  const endingConfirmation = nodesByTag(harness.root, "article").find((article) => nodesByTag(article, "button").length === 2);
  await click(nodesByTag(endingConfirmation, "button")[0]);
  assert.deepEqual(harness.store.calls.beginEnding, [anchor.id]);
  assert.equal(harness.store.get(anchor.id).status, "ending");
  assert.deepEqual(harness.store.calls.finish, [], "beginEnding and finish remain separate boundaries");
  runNextTimer();
  await harness.store.flush();
  assert.deepEqual(harness.store.calls.finish, [anchor.id]);
  assert.equal(harness.store.get(anchor.id).status, "ended");
  await harness.close();
}

async function testTheaterHomeNavigation() {
  const active = makeInstance({ id: "home-active", title: "Home Must Not Preview This Performance" });
  let harness = await mount(makeState([active], active.id));
  assert.ok(findClass(harness.root, "cinema-home"), "entered Cinema opens the stable Theater Home");
  assert.ok(containsExactText(harness.root, "MERCURY"));
  assert.ok(containsExactText(harness.root, "CINEMA"));
  assert.equal(containsExactText(harness.root, active.title), false, "Home never previews the focused Performance");
  assert.deepEqual(nodesByTag(harness.root, "button").map((button) => button.attributes["aria-label"]).filter(Boolean), ["世界", "节目单", "角色"]);
  const beforeProgramme = narrativeProjection(harness.store.get(active.id));
  await openProgramme(harness);
  assert.ok(containerContaining(harness.root, "article", active.title), "Programme entrance reaches the existing truthful Programme surface");
  assert.deepEqual(narrativeProjection(harness.store.get(active.id)), beforeProgramme, "opening Programme is narrative-neutral");
  await harness.close();

  harness = await mount(makeState([active], active.id));
  const beforeWorld = narrativeProjection(harness.store.get(active.id));
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "世界"));
  assert.ok(findClass(harness.root, "cinema-world-library"), "Worlds opens the dedicated Catalog-backed World Library");
  assert.equal(walk(harness.root).filter((node) => String(node.className || "").split(/\s+/).includes("cinema-world-rail")).length, 0, "the one-World state has no decorative World spines");
  await click(findClass(harness.root, "cinema-world-plane__action"));
  assert.ok(containsExactText(harness.root, quietStation.premise), "a World Library selection opens the existing World detail");
  assert.deepEqual(narrativeProjection(harness.store.get(active.id)), beforeWorld, "World browsing is narrative-neutral");
  await harness.close();

  harness = await mount(makeState([active], active.id));
  const beforeCast = narrativeProjection(harness.store.get(active.id));
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "角色"));
  assert.ok(findClass(harness.root, "cinema-cast-index"), "Cast opens the dedicated Cinema roster");
  assert.ok(containsExactText(harness.root, "PRIMARY ARCHIVE  /  READ ONLY"));
  assert.deepEqual(harness.launchCalls, [], "Cast browsing does not launch or edit Primary Archive");
  await click(findClass(harness.root, "cinema-cast-sheet__proceed"));
  assert.ok(containsExactText(harness.root, "PROGRAMME ENTRY"), "Cast record action opens the latest truthful Performance for the Character");
  assert.deepEqual(narrativeProjection(harness.store.get(active.id)), beforeCast, "opening Cast is narrative-neutral");
  await harness.close();
}

function catalogWithWorldCount(count) {
  return stageCatalogModule.createStageCatalog(Array.from({ length: count }, (_, index) => ({
    ...clone(quietStation),
    id: `world-scale-${index + 1}`,
    order: index + 1,
    title: `世界 ${index + 1}`,
    shortTitle: `世界${index + 1}`,
    latinTitle: `WORLD ${index + 1}`,
    scenarios: quietStation.scenarios.map((scenario) => ({ ...scenario, id: `scenario-scale-${index + 1}` })),
  })));
}

async function testWorldLibraryScalingAndCastVisualFallback() {
  for (const count of [1, 3, 8]) {
    const catalog = catalogWithWorldCount(count);
    const harness = await mount(makeState([], null), { catalog });
    await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "世界"));
    const track = findClass(harness.root, "cinema-world-track");
    const rails = walk(harness.root).filter((node) => String(node.className || "").split(/\s+/).includes("cinema-world-rail"));
    assert.equal(track.dataset.worldCount, String(count), "the scenery track receives the truthful collection size");
    assert.equal(rails.length, count === 1 ? 0 : Math.min(2, count - 1), `${count} World layout exposes only truthful adjacent planes`);
    assert.ok(containsExactText(harness.root, `01 / ${String(count).padStart(2, "0")}`));
    assert.equal(containsExactText(harness.root, quietStation.summary), false, "World Library does not duplicate full World Detail prose");
    assert.ok(containsExactText(harness.root, quietStation.tagline), "World Library keeps one concise selection teaser");
    if (count === 1) {
      await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "查看世界 1世界档案"));
      assert.ok(containsExactText(harness.root, quietStation.summary), "World Detail retains the complete World description");
    }
    if (count === 8) {
      await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "切换到世界 3"));
      assert.ok(containsExactText(harness.root, "03 / 08"), "a large collection can jump directly to a visible adjacent World");
      assert.ok(containsExactText(harness.root, "世界 3"));
    }
    await harness.close();
  }

  archiveCharacter.avatarAssetId = "data:image/webp;base64,AAAA";
  const harness = await mount(makeState([], null));
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "角色"));
  const image = findClass(harness.root, "cinema-cast-row__image");
  const portrait = findClass(harness.root, "cinema-cast-row__portrait");
  assert.equal(image.dataset.visualKind, "user", "an existing direct Character image reference has first priority");
  await fire(image, "error");
  assert.equal(image.dataset.visualKind, "mercury-neutral", "a failed user image falls back to the stable Mercury neutral visual");
  assert.match(image.src, /cast-neutral-0[1-6]\.webp$/);
  await fire(image, "error");
  assert.equal(image.parentElement, null, "a failed neutral visual is removed");
  assert.equal(portrait.dataset.fallback, "surname", "surname typography remains the final no-image fallback");
  assert.deepEqual(harness.launchCalls, [], "visual fallback never opens or writes Primary Archive");
  await harness.close();
  delete archiveCharacter.avatarAssetId;
}

async function testCinemaInteractionOwnership() {
  let harness = await mount(makeState([], null), { catalog: catalogWithWorldCount(3) });
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "世界"));
  let track = findClass(harness.root, "cinema-world-track");
  let prevented = 0;
  await fire(track, "pointerdown", { pointerId: 71, button: 0, isPrimary: true, clientX: 220, clientY: 420 });
  await fire(track, "pointermove", { pointerId: 71, clientX: 150, clientY: 424, preventDefault() { prevented += 1; } });
  await fire(track, "pointerup", { pointerId: 71, clientX: 134, clientY: 424, preventDefault() { prevented += 1; } });
  assert.equal(findClass(harness.root, "cinema-world-track").dataset.selectedIndex, "1", "one horizontal drag changes exactly one World");
  assert.ok(prevented >= 2, "committed horizontal ownership suppresses browser compatibility activation");
  await click(findClass(harness.root, "cinema-world-plane__action--inspect"));
  assert.ok(findClass(harness.root, "cinema-world-library"), "the synthetic click immediately following a World swipe is ignored");

  track = findClass(harness.root, "cinema-world-track");
  const inspect = findClass(harness.root, "cinema-world-plane__action--inspect");
  await fire(track, "pointerdown", { pointerId: 72, button: 0, isPrimary: true, clientX: 92, clientY: 710, target: inspect.children[0] });
  await fire(track, "pointermove", { pointerId: 72, clientX: 35, clientY: 712, target: inspect.children[0] });
  await fire(track, "pointerup", { pointerId: 72, clientX: 35, clientY: 712, target: inspect.children[0] });
  await click(inspect);
  assert.ok(containsExactText(harness.root, "世界 2"), "a tap beginning inside the inspect control is not swallowed by World gesture arbitration");
  await harness.close();

  harness = await mount(makeState([], null), { catalog: catalogWithWorldCount(3) });
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "世界"));
  track = findClass(harness.root, "cinema-world-track");
  await fire(track, "pointerdown", { pointerId: 73, button: 0, isPrimary: true, clientX: 210, clientY: 420 });
  await fire(track, "pointermove", { pointerId: 73, clientX: 155, clientY: 422 });
  await fire(track, "pointercancel", { pointerId: 73 });
  await click(findClass(harness.root, "cinema-world-plane__action--inspect"));
  assert.ok(findClass(harness.root, "cinema-world-library"), "pointercancel cleanup blocks the gesture's trailing synthetic click");
  track = findClass(harness.root, "cinema-world-track");
  const cancelledInspect = findClass(harness.root, "cinema-world-plane__action--inspect");
  await fire(track, "pointerdown", { pointerId: 74, button: 0, isPrimary: true, clientX: 92, clientY: 710, target: cancelledInspect });
  await click(cancelledInspect);
  assert.ok(containsExactText(harness.root, "世界 1"), "a fresh intentional control press clears only the World synthetic-click guard");
  await harness.close();

  harness = await mount(makeState([], null), { catalog: catalogWithWorldCount(1) });
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "世界"));
  track = findClass(harness.root, "cinema-world-track");
  await fire(track, "pointerdown", { pointerId: 75, button: 0, isPrimary: true, clientX: 210, clientY: 420 });
  await fire(track, "pointermove", { pointerId: 75, clientX: 145, clientY: 422 });
  await fire(track, "pointerup", { pointerId: 75, clientX: 128, clientY: 423 });
  const boundaryInspect = findClass(harness.root, "cinema-world-plane__action--inspect");
  await fire(track, "click", { target: boundaryInspect });
  assert.ok(findClass(harness.root, "cinema-world-library"), "a boundary swipe consumes its trailing synthetic click without opening World Detail");
  await fire(track, "pointerdown", { pointerId: 76, button: 0, isPrimary: true, clientX: 92, clientY: 710, target: boundaryInspect });
  let intentionalPrevented = 0;
  await fire(track, "click", { target: boundaryInspect, preventDefault() { intentionalPrevented += 1; } });
  assert.equal(intentionalPrevented, 0, "a fresh button pointerdown clears the one-shot track click gate after a boundary swipe");
  await click(boundaryInspect);
  assert.ok(containsExactText(harness.root, "世界 1"), "the first intentional tap after a boundary swipe opens World Detail");
  await harness.close();

  const active = makeInstance({ id: "cast-scroll-active", title: "Cast Scroll Active" });
  harness = await mount(makeState([active], active.id));
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "角色"));
  const castSheet = findClass(harness.root, "cinema-cast-sheet--main");
  castSheet.scrollTop = 217;
  await click(findClass(harness.root, "cinema-cast-row"));
  assert.equal(findClass(harness.root, "cinema-cast-sheet--main").scrollTop, 217, "Cast selection preserves the visible sheet position so pressed feedback remains in context");
  await harness.close();
}

async function testCharacterAdaptationBoundary() {
  const stage = quietCatalog.listStages()[0];
  const baseDraft = {
    ...contracts.createDraft({ stageId: stage.id }, () => Date.parse("2026-08-20T09:00:00.000Z"), quietCatalog),
    characterId: archiveCharacter.id,
    characterSnapshot: contracts.normalizeCharacterSnapshot(archiveCharacter),
    playerName: "Controller Player",
    playerRole: "traveler",
    relationshipStart: "old friends",
  };
  const draft = { ...baseDraft, variant: contracts.buildCharacterVariant(baseDraft.characterSnapshot, baseDraft, quietCatalog) };
  const model = buildCharacterAdaptationModel(draft, stage);
  assert.deepEqual(model.coreItems.map((item) => item.source), ["stableTraits", "values", "boundaries"], "must-keep presentation is derived from existing Character snapshot fields");
  assert.deepEqual(model.fields.map((field) => field.source), ["variant.worldIdentity", "variant.contextBackground", "variant.expression"], "World adaptation fields remain existing draft variant fields");
  assert.equal(model.notes[1].source, "presentation-question", "World note is marked as a question rather than canonical Character truth");

  let harness = await mount(makeState([], null, { draft }), { launchPayload: { route: "variant" } });
  assert.ok(containsExactText(harness.root, "角色适配"));
  assert.ok(containsExactText(harness.root, "必须保留"));
  assert.ok(containsExactText(harness.root, "在这个世界"));
  assert.equal(harness.store.snapshot().instances.length, 0, "opening Adaptation does not create an Instance");
  const originalCharacter = clone(harness.store.snapshot().draft.characterSnapshot);
  const identity = nodesByTag(harness.root, "input").find((node) => node.attributes["aria-label"] === "身份");
  await click(buttonContaining(harness.root, "修改理解"));
  assert.equal(global.document.activeElement, identity, "Modify interpretation focuses the existing editable adaptation field");
  assert.equal(harness.store.snapshot().draft.variant.userEdited, false, "focusing edit mode does not mutate the draft");
  identity.value = "signal keeper";
  for (const listener of identity.listeners.input || []) await listener({ target: identity });
  assert.equal(harness.store.snapshot().draft.variant.worldIdentity, "signal keeper");
  assert.equal(harness.store.snapshot().draft.variant.userEdited, true);
  assert.deepEqual(harness.store.snapshot().draft.characterSnapshot, originalCharacter, "adaptation edits never write back to the Character snapshot");
  assert.equal(harness.store.snapshot().instances.length, 0, "editing Adaptation stays before the curtain boundary");
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "返回选角册"));
  assert.ok(findClass(harness.root, "cinema-cast-index"), "Adaptation back returns to the preparation-mode Cast selector");
  assert.equal(findClass(harness.root, "cinema-cast-index").dataset.mode, "prepare");
  assert.equal(harness.store.snapshot().instances.length, 0);
  await harness.close();

  harness = await mount(makeState([], null, { draft }), { launchPayload: { route: "variant" } });
  await click(buttonContaining(harness.root, "确认适配"));
  assert.ok(findClass(harness.root, "cinema-before-curtain"), "Confirm Adaptation continues to the new Before the Curtain surface");
  assert.equal(harness.store.snapshot().draft.generationProfileId, profile.id, "Before the Curtain preserves the existing Generation Profile contract");
  assert.deepEqual(harness.store.snapshot().draft.generationProfileSnapshot, profile, "the required Generation Profile snapshot remains draft-owned");
  assert.deepEqual(harness.store.snapshot().draft.characterSnapshot, originalCharacter);
  assert.equal(harness.store.snapshot().instances.length, 0, "confirming Adaptation still does not create an Instance");
  await harness.close();
}

async function testBeforeCurtainDynamicTemplate() {
  const longStage = {
    ...clone(quietStation),
    id: "long-before-curtain-world",
    title: "沿海潮汐观测局与第七码头之间的漫长夜班世界",
    shortTitle: "潮汐观测局",
    scenarios: [
      {
        ...clone(quietStation.scenarios[0]),
        id: "archive-transfer",
        title: "在所有航标熄灭以前完成最后一批旧档案移交",
        season: "深冬风暴季的第十七个凌晨",
        entryPeriods: ["交接清单刚被送到值班室时", "最后一班巡检船离港以后"],
        defaultEntryPeriod: "最后一班巡检船离港以后",
      },
      {
        ...clone(quietStation.scenarios[0]),
        id: "return-observatory",
        title: "多年以后第一次共同返回废弃观测塔",
      },
    ],
    relationshipOptions: ["曾经共同值守、后来失去联系的旧搭档", "初次相识", "自定义"],
  };
  const catalog = stageCatalogModule.createStageCatalog([longStage]);
  const character = {
    ...clone(archiveCharacter),
    id: "long-before-curtain-character",
    displayName: "林雾岚与她没有写完的第七码头巡检记录",
  };
  const sharedHistory = "十二年前，我们在同一场风暴里值守到天亮；之后那份关于失踪航标的报告被封存，我们也再没有谈过那一夜。如今旧档案必须在潮水漫过地下库房前完成移交。";
  const baseDraft = contracts.createDraft({ stageId: longStage.id, scenarioId: "archive-transfer" }, () => Date.parse("2026-08-20T09:30:00.000Z"), catalog);
  const draft = {
    ...baseDraft,
    characterId: character.id,
    characterSnapshot: contracts.normalizeCharacterSnapshot(character),
    relationshipStart: longStage.relationshipOptions[0],
    sharedHistory,
    generationProfileId: profile.id,
    generationProfileSnapshot: clone(profile),
  };
  draft.variant = contracts.buildCharacterVariant(draft.characterSnapshot, draft, catalog);

  const model = buildBeforeCurtainModel(catalog, draft, contracts.RELATIONSHIP_STARTS);
  assert.equal(model.stage.title, longStage.title);
  assert.equal(model.characterName, character.displayName);
  assert.equal(model.scenarioOptions.length, 2, "the presentation exposes only real Catalog scenarios");
  assert.equal(model.historySummary, `${longStage.relationshipOptions[0]} · ${sharedHistory}`);

  const harness = await mount(makeState([], null, { draft }), { catalog, launchPayload: { route: "before-curtain" } });
  assert.ok(findClass(harness.root, "cinema-before-curtain__scroll"), "the dynamic template retains a dedicated vertical scroller");
  assert.ok(containsExactText(harness.root, longStage.title), "long World names remain dynamic");
  assert.ok(containsExactText(harness.root, character.displayName), "long Character names remain dynamic");
  assert.ok(containsExactText(harness.root, `经典开场 · ${longStage.scenarios[0].title}`), "long Scenario names remain dynamic");
  assert.ok(containsExactText(harness.root, model.historySummary), "long Shared History remains intact instead of being truncated into mockup copy");
  assert.equal(nodesByTag(harness.root, "select").find((node) => node.attributes["aria-label"] === "开场方案").children.length, 2);
  assert.equal(harness.store.snapshot().instances.length, 0);

  await click(buttonContaining(harness.root, "改写共同经历"));
  const history = nodesByTag(harness.root, "textarea").find((node) => node.attributes["aria-label"] === "共同经历");
  history.value = `${sharedHistory} 我们决定先核对彼此保存的两份手写日志。`;
  await fire(history, "input");
  assert.equal(harness.store.snapshot().draft.sharedHistory, history.value, "Shared History edits stay in the existing draft");
  assert.equal(harness.store.snapshot().instances.length, 0, "editing the long fixture never crosses the Instance boundary");

  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "返回角色适配"));
  assert.ok(findClass(harness.root, "cinema-adaptation"), "Before the Curtain back returns to Adaptation");
  assert.equal(harness.store.snapshot().instances.length, 0, "back navigation preserves the draft without creating an Instance");
  assert.equal(harness.transportCalls(), 0, "Before the Curtain never invokes generation transport");
  await harness.close();
}

async function testPerformanceReadingPresentationAndStates() {
  const reading = makeInstance({ id: "reading-gate", title: "长篇阅读验收" });
  reading.scenes[0].actNumber = 2;
  reading.scenes[0].sceneNumber = 3;
  reading.scenes[0].title = "北方长廊与未熄的信号灯";
  reading.segments[0].text = "雨沿着长廊尽头的玻璃缓慢落下。她没有回头，只把那封写着 Mercury 的旧信放在灯下。\n\n“你终于来了。”她说。——这句话很轻，却让整条长廊都安静下来。";
  reading.segments.push({
    id: "reading-user",
    sceneId: reading.scenes[0].id,
    role: "user",
    text: "我停在门槛外，先问她是否还记得那一夜。",
    status: "complete",
    createdAt: reading.createdAt,
    generationProfileId: profile.id,
  });

  let harness = await mount(makeState([reading], reading.id), { launchPayload: { route: "active" } });
  assert.ok(findClass(harness.root, "cinema-reading__stage"), "Reading owns a deterministic dark-stage environment");
  assert.ok(containsExactText(harness.root, "第二幕"), "the Chinese Act label comes from the runtime Scene");
  assert.ok(containsExactText(harness.root, "ACT II"), "the editorial Act label uses the same runtime Act number");
  assert.ok(containsExactText(harness.root, reading.scenes[0].title), "the Scene title is runtime-owned and untruncated");
  assert.ok(containsTextFragment(harness.root, "Mercury"), "mixed-language narrative remains present");
  assert.ok(containsTextFragment(harness.root, "——"), "Chinese literary punctuation remains present");
  assert.equal(nodesByTag(harness.root, "img").length, 0, "the complete no-image Reading uses no legacy raster nodes");
  assert.equal(containsTextFragment(harness.root, "呼出思绪"), false, "the fixture-only thought affordance is not shipped");

  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "放映菜单"));
  assert.ok(findClass(harness.root, "cinema-reading-menu"));
  assert.equal(nodesByTag(harness.root, "img").length, 0, "Reading menu symbols are deterministic SVG glyphs");
  await click(nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "关闭"));

  const area = findClass(harness.root, "cinema-composer__input");
  assert.equal(area.placeholder, "你要怎么做？");
  area.value = "我向前一步，把旧信推回她面前。";
  await fire(area, "input");
  const send = nodesByTag(harness.root, "button").find((button) => button.attributes["aria-label"] === "将这段文字写入故事");
  assert.equal(send.disabled, false, "composer enables Send only after meaningful text exists");
  await click(send);
  await click(send);
  assert.deepEqual(harness.workflow.continueCalls, ["我向前一步，把旧信推回她面前。"], "composer delegates exact text to the existing Workflow");
  assert.equal(send.disabled, true, "the first submission synchronously locks its stale control against a second action");
  await harness.close();

  harness = await mount(makeState([reading], reading.id), {
    launchPayload: { route: "active" },
    workflowState: { phase: "running", requestId: "reading-request", error: null },
  });
  assert.ok(findClass(harness.root, "cinema-generating"), "running generation has a restrained in-performance state");
  assert.equal(nodesByTag(harness.root, "form").length, 0, "running generation suppresses duplicate composer submission");
  const cancel = buttonContaining(harness.root, "中止本次演绎");
  await click(cancel);
  await click(cancel);
  assert.equal(harness.workflow.cancelCalls, 1, "running cancel remains delegated to Workflow");
  assert.equal(cancel.disabled, true, "the running cancel action locks synchronously after acceptance");
  await harness.close();

  const cancelled = makeInstance({ id: "reading-cancelled", title: "中止状态验收", pending: true });
  cancelled.lastError = {
    code: "CINEMA_GENERATION_CANCELLED",
    message: "本次演绎已中止，刚才写下的内容仍然保留。",
    retryable: true,
    recovery: null,
  };
  harness = await mount(makeState([cancelled], cancelled.id), { launchPayload: { route: "active" } });
  assert.ok(containsExactText(harness.root, "演出停在这里"), "cancelled Reading has a distinct human-readable state");
  const retry = recoveryAction(harness.root);
  await click(retry);
  await click(retry);
  assert.equal(harness.workflow.retryCalls, 1, "explicit recovery delegates once even under repeated activation");
  assert.equal(retry.disabled, true, "explicit recovery locks while the accepted retry is in flight");
  await harness.close();
}

async function testPerformanceReadingScrollRetention() {
  const reading = makeInstance({ id: "reading-scroll", title: "滚动保持验收" });
  const harness = await mount(makeState([reading], reading.id), { launchPayload: { route: "active" } });
  const initialScroller = findClass(harness.root, "cinema-reading__scroll");
  initialScroller.scrollHeight = 2400;
  initialScroller.clientHeight = 600;
  while (runNextTimer() === 0) {}
  assert.equal(initialScroller.scrollTop, 1800);

  initialScroller.scrollTop = 680;
  await fire(initialScroller, "scroll");
  const area = findClass(harness.root, "cinema-composer__input");
  global.document.activeElement = area;
  await fire(area, "focus");
  assert.equal(initialScroller.scrollTop, 680, "focusing the composer does not dislodge a reader inspecting older prose");
  await fire(initialScroller, "pointerdown");
  assert.equal(global.document.activeElement, null, "pointer interaction with prose dismisses the writing focus without changing scroll ownership");
  harness.workflow.setState({ phase: "running", requestId: "scroll-request", error: null });
  const runningScroller = findClass(harness.root, "cinema-reading__scroll");
  runningScroller.scrollHeight = 2500;
  runningScroller.clientHeight = 600;
  assert.equal(runNextTimer(), 0);
  assert.equal(runningScroller.scrollTop, 680, "generation rerender preserves an intentional older-prose reading position");

  runningScroller.scrollTop = 1900;
  await fire(runningScroller, "scroll");
  harness.workflow.setState({ phase: "idle", requestId: null, error: null });
  const completedScroller = findClass(harness.root, "cinema-reading__scroll");
  completedScroller.scrollHeight = 2700;
  completedScroller.clientHeight = 600;
  assert.equal(runNextTimer(), 0);
  assert.equal(completedScroller.scrollTop, 2100, "a reader already at the end follows newly completed prose");
  await harness.close();
}

async function probeNavigationAndMalformedPending() {
  const productionCatalog = stageCatalogModule.PRODUCTION_STAGE_CATALOG;
  const productionStage = productionCatalog.listStages()[0];
  const materialAnchor = makeInstance({
    id: "material-anchor",
    title: "Material Navigation Anchor",
    catalog: productionCatalog,
    stageId: productionStage.id,
    scenarioId: productionStage.scenarios[0].id,
  });
  let harness = await mount(makeState([materialAnchor], materialAnchor.id), { catalog: productionCatalog });
  const beforeMaterialNavigation = narrativeProjection(harness.store.get(materialAnchor.id));
  await openProgramme(harness);
  await click(findClass(harness.root, "cinema-programme-hub__start"));
  await click(findClass(harness.root, "cinema-world-plane__action"));
  await click(buttonContaining(harness.root, productionStage.materials[0].title));
  await click(nodesByTag(harness.root, "button")[0]);
  runNextTimer();
  const materialBackLostStage = nodesByTag(harness.root, "time").length === 1;
  assert.deepEqual(narrativeProjection(harness.store.get(materialAnchor.id)), beforeMaterialNavigation, "material navigation and back fallback remain narrative-neutral");
  assert.equal("route" in harness.store.snapshot(), false);
  await harness.close();

  const malformed = makeInstance({ id: "malformed-pending", title: "Malformed Pending", malformedPending: true });
  harness = await mount(makeState([malformed], malformed.id), { launchPayload: { route: "active" } });
  const normalized = harness.store.focused();
  assert.equal(normalized.pendingContinuation, null);
  assert.equal(normalized.lastError.code, "CINEMA_PENDING_CONTINUATION_INVALID");
  assert.equal(harness.transportCalls(), 0, "malformed pending presentation never starts transport automatically");
  const malformedComposerVisible = nodesByTag(harness.root, "form").length > 0;
  const malformedErrorVisible = containsTextFragment(harness.root, normalized.lastError.message);
  const malformedRetryVisible = Boolean(recoveryAction(harness.root));
  await harness.close();

  return { materialBackLostStage, malformedComposerVisible, malformedErrorVisible, malformedRetryVisible };
}

async function testCreditsLifecycleGate() {
  const normal = makeInstance({ id: "closure-normal", title: "北方长廊" });
  normal.structureProvenance = { scenes: "runtime" };
  let harness = await mount(makeState([normal], normal.id), { launchPayload: { route: "active" } });
  await openEndingFromReading(harness);
  assert.equal(findClass(harness.root, "cinema-ending-confirmation").dataset.endingState, "normal");
  assert.ok(containsExactText(harness.root, "确认结束这场演出？"));
  const confirm = buttonContaining(harness.root, "确认谢幕");
  await click(confirm);
  await click(confirm);
  assert.deepEqual(harness.store.calls.beginEnding, [normal.id], "duplicate confirmation invokes begin-ending exactly once");
  assert.equal(harness.store.get(normal.id).status, "ending");
  assert.equal(harness.store.get(normal.id).closureRecord.pendingDisposition, null);
  assert.equal(harness.configuration.persistedState.instances[0].status, "ending", "the curtain is entered only after ending state is durable");
  await finishCurtainAndReachCredits(harness);
  const ended = harness.store.get(normal.id);
  assert.equal(ended.status, "ended");
  assert.ok(ended.endedAt);
  assert.equal(harness.configuration.persistedState.focusedInstanceId, null);
  assert.equal(harness.configuration.persistedState.instances[0].status, "ended", "ended status and focus removal share the final durable snapshot");
  assert.equal(findClass(harness.root, "cinema-credits").dataset.structureProvenance, "runtime");
  assert.ok(containsExactText(harness.root, "谢幕"));
  assert.ok(containsExactText(harness.root, normal.title));
  assert.ok(containsTextFragment(harness.root, "1 幕 · 1 场"));
  assert.equal(containsTextFragment(harness.root, "分钟"), false);
  assert.equal(containsTextFragment(harness.root, "关系"), false);
  assert.equal(containsTextFragment(harness.root, "保存到我的影院"), false);
  assert.equal(containsTextFragment(harness.root, "开始新的故事"), false);
  const history = buttonContaining(harness.root, "阅读完整节目册");
  assert.equal(history.disabled, false, "History is enabled only after the complete archive destination exists");
  await click(history);
  assert.equal(findClass(harness.root, "cinema-history-reader").dataset.structureProvenance, "runtime");
  assert.ok(containsExactText(harness.root, normal.title));
  assert.equal(containsTextFragment(harness.root, "分钟"), false);
  assert.equal(findClass(harness.root, "cinema-reading__scene"), null, "History does not mount live Reading runtime UI");
  await click(buttonContaining(harness.root, "返回节目单"));
  assert.ok(findClass(harness.root, "cinema-programme-hub"));
  await harness.close();

  const pending = makeInstance({ id: "closure-pending", title: "待续写的长廊", pending: true });
  const pendingIdentity = clone(pending.pendingContinuation);
  const pendingSegments = clone(pending.segments);
  harness = await mount(makeState([pending], pending.id), { launchPayload: { route: "active" } });
  await openEndingFromReading(harness);
  assert.equal(findClass(harness.root, "cinema-ending-confirmation").dataset.endingState, "pending");
  assert.ok(containsExactText(harness.root, "放弃这次待续写并谢幕"));
  assert.deepEqual(harness.store.focused().pendingContinuation, pendingIdentity, "first pending screen is presentation-only");
  await click(buttonContaining(harness.root, "放弃这次待续写并谢幕"));
  assert.equal(findClass(harness.root, "cinema-ending-confirmation").dataset.endingState, "pending-confirm");
  const abandon = buttonContaining(harness.root, "确认放弃并谢幕");
  await click(abandon);
  await click(abandon);
  assert.deepEqual(harness.store.calls.abandonPendingAndBeginEnding, [[pending.id, pendingIdentity.requestId]], "pending abandonment is identity-bound and single-shot");
  const abandoned = harness.store.get(pending.id);
  assert.equal(abandoned.pendingContinuation, null);
  assert.deepEqual(abandoned.segments, pendingSegments, "pending abandonment preserves every written Segment and its provenance");
  assert.deepEqual(abandoned.closureRecord.pendingDisposition, {
    kind: "abandoned-by-user",
    requestId: pendingIdentity.requestId,
    userSegmentId: pendingIdentity.userSegmentId,
    startedAt: pendingIdentity.startedAt,
    settledAt: abandoned.closureRecord.pendingDisposition.settledAt,
  });
  await finishCurtainAndReachCredits(harness);
  assert.equal(harness.store.get(pending.id).segments.length, pendingSegments.length);
  await harness.close();

  const running = makeInstance({ id: "closure-running", title: "仍在续写" });
  harness = await mount(makeState([running], running.id), { launchPayload: { route: "active" }, workflowState: { phase: "running", requestId: "request-running", error: null } });
  await openEndingFromReading(harness);
  assert.equal(findClass(harness.root, "cinema-ending-confirmation").dataset.endingState, "in-flight");
  assert.ok(containsExactText(harness.root, "先结束本次续写"));
  assert.equal(buttonContaining(harness.root, "确认谢幕"), null);
  await click(buttonContaining(harness.root, "返回演出并取消续写"));
  assert.equal(harness.workflow.cancelCalls, 0, "closure confirmation never cancels generation implicitly");
  assert.equal(harness.store.get(running.id).status, "active");
  await harness.close();

  const reloadEnding = makeInstance({ id: "closure-reload", title: "结构未明的演出", status: "ending" });
  reloadEnding.structureProvenance = { scenes: "compatibility-unknown" };
  reloadEnding.closureRecord = { version: 1, initiatedAt: reloadEnding.updatedAt, pendingDisposition: null };
  harness = await mount(makeState([reloadEnding], reloadEnding.id), { launchPayload: { route: "active" } });
  assert.equal(runNextTimer(), 0, "ending reload follows the existing redirect boundary");
  assert.ok(findClass(harness.root, "cinema-curtain--ending"), "reload of a durably ending Performance resumes only the finish curtain");
  await finishCurtainAndReachCredits(harness);
  assert.equal(findClass(harness.root, "cinema-credits").dataset.structureProvenance, "compatibility-unknown");
  assert.equal(containsExactText(harness.root, "结构"), false, "unreliable Act and Scene structure is omitted rather than fabricated");
  await harness.close();

  const failing = makeInstance({ id: "closure-failing", title: "未能保存的谢幕" });
  harness = await mount(makeState([failing], failing.id), { launchPayload: { route: "active" }, failSaveAt: 1 });
  await openEndingFromReading(harness);
  await click(buttonContaining(harness.root, "确认谢幕"));
  assert.ok(findClass(harness.root, "cinema-closure-failure"), "storage failure owns a recoverable closure screen");
  assert.ok(containsExactText(harness.root, "谢幕尚未保存"));
  assert.equal(findClass(harness.root, "cinema-credits"), null, "storage failure never exposes Credits");
  assert.equal(harness.configuration.persistedState, null, "failed begin-ending did not claim a durable closure snapshot");
  assert.equal(harness.configuration.saveAttempts, 1);
  await harness.close();
}

async function run() {
  try {
    await testContinueInstancePolicy();
    await testIntermissionProjectionAndRecoveryBoundary();
    await testProgrammeNavigationClosure();
    await testProgrammeArchiveIndexNavigation();
    await testPendingSelectionFromHome();
    await testMultipleAndOrphanedReachability();
    await testStageAndCurtainBoundaries();
    await testTheaterHomeNavigation();
    await testWorldLibraryScalingAndCastVisualFallback();
    await testCinemaInteractionOwnership();
    await testCharacterAdaptationBoundary();
    await testBeforeCurtainDynamicTemplate();
    await testPerformanceReadingPresentationAndStates();
    await testPerformanceReadingScrollRetention();
    await testCreditsLifecycleGate();
    const probes = await probeNavigationAndMalformedPending();
    console.log(`cinema-app-controller: delegate safety assertions passed; material-back-lost-stage=${probes.materialBackLostStage}; malformed-error=${probes.malformedErrorVisible}; malformed-composer=${probes.malformedComposerVisible}; malformed-retry=${probes.malformedRetryVisible}`);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
}

run().catch((error) => {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
  console.error(error);
  process.exitCode = 1;
});

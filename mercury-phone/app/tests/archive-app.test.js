const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
global.document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
};

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.classList = { add: (...names) => { this.className = `${this.className} ${names.join(" ")}`.trim(); } };
    this.disabled = false;
  }
  append(...items) { this.children.push(...items.filter(Boolean)); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  click() { this.listeners.click?.({ target: this }); }
}

require("../core/archive-contracts.js");
require("../core/resource-contracts.js");
require("../core/role-analysis-contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/preset-content.js");
require("../core/preset-assemble.js");
require("../core/generation-profile-contracts.js");
require("../system/generation-profile-store.js");
require("../use-cases/generation-profile-flow.js");
require("../use-cases/resource-intake-workflow.js");
require("../apps/archive-app.js");

function storage() {
  const values = new Map();
  return {
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    set(key, value) { values.set(key, value); },
    remove(key) { values.delete(key); },
  };
}

function findByClass(node, className) {
  if (!node) return null;
  if (String(node.className || "").split(/\s+/).includes(className)) return node;
  for (const child of node.children || []) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

function findAllByClass(node, className, matches = []) {
  if (!node) return matches;
  if (String(node.className || "").split(/\s+/).includes(className)) matches.push(node);
  for (const child of node.children || []) findAllByClass(child, className, matches);
  return matches;
}

function findByAriaLabel(node, label) {
  if (!node) return null;
  if (node.attributes?.["aria-label"] === label) return node;
  for (const child of node.children || []) {
    const match = findByAriaLabel(child, label);
    if (match) return match;
  }
  return null;
}

function findByText(node, value) {
  if (!node) return null;
  if (node.textContent === value) return node;
  for (const child of node.children || []) {
    const match = findByText(child, value);
    if (match) return match;
  }
  return null;
}

const definition = global.MercuryCreateArchiveDefinition();
assert.equal(definition.id, "archive");
assert.equal(definition.capabilities.includes("storage"), true);

const root = new FakeElement("section");
const app = definition.create();
app.render(root, { services: { storage: storage() } });
assert.equal(root.className.includes("mercury-archive-app"), true);
assert.equal(root.children.some((child) => child.className === "status-bar"), false);

// Generation Profiles render as one scrollable Record Cabinet grouped by
// provenance. The cover is persisted in the shared Profile store and remains
// a display-only field.
const cabinetStorage = storage();
const cabinetRoot = new FakeElement("section");
const cabinetApp = definition.create();
cabinetApp.render(cabinetRoot, { services: { storage: cabinetStorage } });
cabinetApp.profileStore.add({ id: "profile-mine", name: "我的慢热", origin: "user", modules: { order: [], enabled: {} }, cover: { kind: "asset", value: "archive:water-starlight-v1" } });
cabinetApp.profileStore.add({ id: "profile-imported", name: "Imported Profile", origin: "imported", creationMode: "import", modules: { order: [], enabled: {} } });
cabinetApp.openArchiveSection("presets");
assert.equal(Boolean(findByClass(cabinetRoot, "record-cabinet-page")), true);
assert.equal(findAllByClass(cabinetRoot, "record-cabinet-shelf").length, 3, "all provenance shelves stay on one scrolling page");
assert.equal(findAllByClass(cabinetRoot, "generation-record").length, 3, "builtin, user, and imported Profiles are rendered as record objects");
assert.equal(findAllByClass(cabinetRoot, "generation-record-action").length, 2, "mine and imported shelves keep dedicated square action sleeves");
assert.equal(Boolean(findByAriaLabel(cabinetRoot, "制作新唱片")), true);
assert.equal(cabinetApp.updateGenerationProfileCover("preset-default", { kind: "data-url", value: "data:image/png;base64,AA==" }), null, "builtin covers stay read-only");
assert.ok(cabinetApp.updateGenerationProfileCover("profile-mine", { kind: "data-url", value: "data:image/png;base64,AA==" }));
cabinetApp.paint();
const mineSurface = findByAriaLabel(cabinetRoot, "查看生成档案 我的慢热");
assert.equal(findByClass(mineSurface, "generation-record__image").src, "data:image/png;base64,AA==", "saved user cover is used by the sleeve");
const builtinSurface = findByAriaLabel(cabinetRoot, "查看生成档案 默认预设");
assert.equal(builtinSurface.attributes["aria-description"], "轻触查看，长按管理", "record gestures remain discoverable without a floating CRUD control");
assert.equal(findByClass(builtinSurface, "generation-record__disc"), builtinSurface.children[0], "the vinyl remains an independent image layer behind the sleeve");
assert.equal(findByClass(builtinSurface, "generation-record__sleeve"), builtinSurface.children[1], "the square sleeve remains a separate foreground layer");
const motionRecord = new FakeElement("article");
cabinetApp.openGenerationProfileWithMotion("preset-default", motionRecord);
assert.equal(motionRecord.className.includes("is-opening"), true, "opening a record starts the extraction transition before routing");
clearTimeout(cabinetApp.profileOpenTimer);
cabinetApp.profileOpenTimer = null;
builtinSurface.listeners.contextmenu({ preventDefault() {} });
  assert.equal(Boolean(findByClass(cabinetRoot, "record-profile-menu")), true);
  assert.equal(Boolean(findByText(findByClass(cabinetRoot, "record-profile-menu"), "导出生成档案")), true, "Generation Profile actions expose portable export");
assert.equal(Boolean(findByText(findByClass(cabinetRoot, "record-profile-menu"), "删除")), false, "builtin Profile menu never exposes destructive editing");
assert.equal(findByClass(cabinetRoot, "record-profile-menu").attributes["data-gesture-exclusion"], "true", "bottom-sheet actions stay outside the shell home gesture");
cabinetApp.profileMenuId = null;
cabinetApp.coverDraft = { profileId: "profile-mine", dataUrl: "data:image/png;base64,AA==" };
cabinetApp.paint();
assert.equal(findByClass(cabinetRoot, "record-cover-preview").attributes["data-gesture-exclusion"], "true", "cover preview actions stay outside the shell home gesture");
cabinetApp.coverDraft = null;

cabinetApp.openGenerationProfile("preset-default");
assert.equal(cabinetApp.route, "profile-detail", "Generation Profile detail uses the formal UI-02 route");
assert.equal(Boolean(findByClass(cabinetRoot, "archive-generation-profile-detail")), true);
assert.equal(Boolean(findByClass(cabinetRoot, "generation-profile-detail-hero")), true, "detail opens with the record and sleeve hero");
assert.equal(findAllByClass(cabinetRoot, "generation-profile-detail-stat").length, 3, "detail statistics are derived from runtime and usage state");
assert.equal(findAllByClass(cabinetRoot, "generation-profile-detail-track").length > 0, true, "built-in runtime modules appear as a read-only track preview");
assert.equal(Boolean(findByClass(cabinetRoot, "archive-editor-card")), false, "formal detail no longer renders the temporary edit form");
assert.equal(Boolean(findByAriaLabel(cabinetRoot, "创建 默认预设 的 Remix")), true, "read-only detail exposes the existing Remix action without editing the original");
cabinetApp.returnToGenerationProfileCabinet();

const cabinetReloadRoot = new FakeElement("section");
const cabinetReloadApp = definition.create();
cabinetReloadApp.render(cabinetReloadRoot, { services: { storage: cabinetStorage } });
cabinetReloadApp.openArchiveSection("presets");
const reloadedMineSurface = findByAriaLabel(cabinetReloadRoot, "查看生成档案 我的慢热");
assert.equal(findByClass(reloadedMineSurface, "generation-record__image").src, "data:image/png;base64,AA==", "custom cover survives a fresh controller/store load");

// The archive home uses the same visible creation entry point as the browser UI.
// It must create durable records instead of only changing a visual state.
const archiveEntryApp = definition.create();
const archiveEntryRoot = new FakeElement("section");
archiveEntryApp.render(archiveEntryRoot, { services: { storage: storage() } });
const archiveHomeEntry = findByClass(archiveEntryRoot, "archive-home-hero__add");
assert.equal(Boolean(archiveHomeEntry), true);
assert.equal(Boolean(findByClass(archiveEntryRoot, "archive-section-link")), false, "empty Recent does not expose a misleading character-only 'View all' action");
archiveHomeEntry.click();
assert.equal(archiveEntryApp.menuOpen, true);
assert.equal(Boolean(findByClass(archiveEntryRoot, "archive-create-menu")), true);
const newPresetAction = findByAriaLabel(archiveEntryRoot, "新建生成档案");
assert.equal(Boolean(newPresetAction), true);
newPresetAction.click();
assert.equal(archiveEntryApp.route, "profile-detail");
assert.equal(archiveEntryApp.store.load().promptModules.length, 0);
assert.equal(archiveEntryApp.profileStore.listPersisted().length, 1);
assert.equal(Boolean(findByClass(archiveEntryRoot, "archive-generation-profile-detail")), true);

archiveEntryApp.route = "home";
archiveEntryApp.paint();
findByClass(archiveEntryRoot, "archive-home-hero__add").click();
const newCharacterAction = findByAriaLabel(archiveEntryRoot, "从零创建");
assert.equal(Boolean(newCharacterAction), true);
newCharacterAction.click();
assert.equal(archiveEntryApp.route, "profile");
assert.equal(archiveEntryApp.store.load().runtimeProfiles.length, 1);
assert.equal(Boolean(findByClass(archiveEntryRoot, "archive-profile-page-v2")), true);

app.prepareImport({ filename: "neutral-source.json", mimeType: "application/json", fileSize: 42, rawText: JSON.stringify({ name: "Neutral Contact" }) });
assert.equal(app.route, "import-review");
app.cancelImport();
assert.equal(app.route, "home");
assert.equal(app.store.load().sourceAssets.length, 0);

app.prepareImport({ filename: "neutral-mixed.json", mimeType: "application/json", fileSize: 100, rawText: JSON.stringify({ name: "Neutral Contact", description: "A neutral contact used by Mercury tests.", rules: ["Keep replies clear"] }) });
assert.equal(app.confirmImport(), true);
const imported = app.store.load();
assert.equal(app.route, "imports");
assert.equal(imported.sourceAssets.length, 1);
assert.equal(imported.runtimeProfiles.length, 1);
assert.equal(imported.promptModules.length, 0);
assert.equal(app.profileStore.listPersisted().some((profile) => profile.name === "迁移指令"), false, "valid role imports do not create a fallback Profile");
assert.equal(Boolean(findByClass(root, "archive-import-row")), true);
assert.equal(Boolean(findByClass(root, "archive-list-row")), true);

const invalidImportStorage = storage();
const invalidImportRoot = new FakeElement("section");
const invalidImportApp = definition.create();
invalidImportApp.render(invalidImportRoot, { services: { storage: invalidImportStorage } });
invalidImportApp.prepareImport({ filename: "broken.json", mimeType: "application/json", fileSize: 8, rawText: "not json" });
assert.equal(Boolean(findByClass(invalidImportRoot, "archive-import-diagnostics--invalid")), true, "invalid imports show a visible diagnostic state");
assert.equal(Boolean(findByClass(invalidImportRoot, "archive-import-diagnostics__group--error")), true, "fatal parser errors are visible before import");
const invalidConfirm = findByClass(invalidImportRoot, "archive-form-actions").children[1];
assert.equal(invalidConfirm.disabled, true, "fatal imports disable the confirmation action");
assert.equal(invalidImportApp.confirmImport(), false, "fatal imports cannot be confirmed programmatically");
assert.equal(invalidImportApp.store.load().sourceAssets.length, 0, "fatal imports do not persist a source asset");

app.store.createManualWorld();
app.state = app.store.load();
app.route = "worlds";
app.paint();
assert.equal(Boolean(findByClass(root, "worldbook-card")), true);
assert.equal(Boolean(findByClass(root, "worldbook-shelf-section")), true);
const worldShelfBack = findByAriaLabel(root, "返回档案馆");
assert.equal(Boolean(worldShelfBack), true, "the world shelf has a return path to the archive home");
worldShelfBack.click();
assert.equal(app.route, "home", "the world shelf return control restores the archive home");
app.route = "worlds";
app.paint();
const storedWorld = app.store.load().worlds[0];
app.openWorldBookEditor(storedWorld.id);
findByAriaLabel(root, "世界书更多操作").click();
assert.equal(Boolean(findByText(root, "导出世界书")), true, "WorldBook overview exposes portable export");
app.worldOverviewMenuOpen = false;
app.paint();
const worldOverviewBack = findByAriaLabel(root, "返回世界书架");
assert.equal(Boolean(worldOverviewBack), true, "the world overview has a return path to the shelf");
worldOverviewBack.click();
assert.equal(app.route, "worlds", "the world overview return control restores the shelf");
app.selectedId = app.store.load().runtimeProfiles[0].id;
app.route = "profile";
app.paint();
assert.equal(Boolean(findByAriaLabel(root, "分析并填充档案")), true, "imported role cards expose the analysis action in their profile header");
assert.equal(Boolean(findByClass(root, "archive-analysis-guide")), true, "role cards explain what the analysis action changes");
app.route = "worlds";
app.paint();
app.worldFilter = "favorites";
app.paint();
assert.equal(Boolean(findByText(root, "当前筛选条件下没有世界书。")), true);
app.worldFilter = "all";
app.paint();

const worldsBeforeDraft = app.store.load().worlds.length;
app.startWorldBookCreate();
assert.equal(app.route, "world-settings");
assert.equal(app.store.load().worlds.length, worldsBeforeDraft, "create starts in the shared editor without a persisted temporary card");
assert.equal(Boolean(findByClass(root, "archive-worldbook-editor")), true);
assert.equal(Boolean(findByClass(root, "worldbook-editor-identity")), true);
app.worldDraft = null;
app.route = "worlds";
app.paint();

const worldImportApp = definition.create();
const worldImportRoot = new FakeElement("section");
worldImportApp.render(worldImportRoot, { services: { storage: storage() } });
worldImportApp.prepareImport({ filename: "knowledge-book.json", mimeType: "application/json", fileSize: 100, rawText: JSON.stringify({ world: { name: "Voice notes", entries: [{ title: "Greeting", type: "rule", content: "Keep it calm." }] } }) });
assert.equal(worldImportApp.confirmImport(), true);
assert.equal(worldImportApp.route, "world-editor", "a pure WorldBook import enters the same editor");
assert.equal(Boolean(findByClass(worldImportRoot, "archive-worldbook-overview")), true);
assert.equal(Boolean(findByClass(worldImportRoot, "worldbook-open-index")), true);
worldImportApp.route = "world-index";
worldImportApp.paint();
assert.equal(Boolean(findByClass(worldImportRoot, "archive-worldbook-index")), true);
assert.equal(Boolean(findByClass(worldImportRoot, "worldbook-index-row")), true);

const mappedWorldImportApp = definition.create();
const mappedWorldImportRoot = new FakeElement("section");
mappedWorldImportApp.render(mappedWorldImportRoot, { services: { storage: storage() } });
mappedWorldImportApp.prepareImport({ filename: "harbor-notes.json", mimeType: "application/json", fileSize: 100, rawText: JSON.stringify({ entries: { alpha: { uid: "alpha", key: ["harbor"], keysecondary: ["dock"], comment: "Pier", content: "The ferry leaves at dusk.", constant: true, disable: false, order: 4 }, empty: { uid: "empty", comment: "Empty row" } } }) });
assert.equal(Boolean(findByClass(mappedWorldImportRoot, "archive-import-diagnostics__group--warning")), true, "WorldBook warnings are visible but non-blocking");
assert.equal(Boolean(findByClass(mappedWorldImportRoot, "archive-import-diagnostics__group--migration")), true, "WorldBook compatibility normalization is visible");
assert.equal(findByText(mappedWorldImportRoot, "确认导入").disabled, false, "warning-only WorldBooks remain confirmable");
assert.equal(mappedWorldImportApp.confirmImport(), true);
const mappedWorld = mappedWorldImportApp.store.load().worlds[0];
assert.equal(mappedWorld.name, "harbor-notes", "filename supplies a durable local world name");
assert.equal(mappedWorld.entries.length, 1, "object-keyed world entries persist in the archive");
assert.deepEqual(mappedWorld.entries[0].aliases, ["harbor", "dock"], "world entry keywords persist as archive aliases");
assert.equal(mappedWorld.entries[0].alwaysActive, true, "world entry active state persists");

const v3RoleImportApp = definition.create();
const v3RoleImportRoot = new FakeElement("section");
v3RoleImportApp.render(v3RoleImportRoot, { services: { storage: storage() } });
v3RoleImportApp.prepareImport({ filename: "nested-role.json", mimeType: "application/json", fileSize: 100, rawText: JSON.stringify({ spec: "chara_card_v3", name: "", description: "", data: { name: "Nested role", description: "A precise character background.", personality: "Patient.", scenario: "An evening archive." } }) });
assert.equal(Boolean(findByClass(v3RoleImportRoot, "archive-import-diagnostics__group--migration")), true, "Character Card conversion is visible before confirmation");
assert.equal(v3RoleImportApp.confirmImport(), true);
const v3RoleProfile = v3RoleImportApp.store.load().runtimeProfiles[0];
assert.equal(v3RoleProfile.displayName, "Nested role", "archive uses the same nested role-card parser");
assert.equal(v3RoleProfile.background, "A precise character background.", "archive stores extracted role background rather than raw JSON");
assert.equal(v3RoleProfile.scenePresentation, "An evening archive.", "archive preserves the role scenario as scene presentation");

const profileImportStorage = storage();
const profileImportRoot = new FakeElement("section");
const profileImportApp = definition.create();
profileImportApp.render(profileImportRoot, { services: { storage: profileImportStorage } });
profileImportApp.prepareImport({ filename: "measured-profile.json", mimeType: "application/json", fileSize: 120, rawText: JSON.stringify({ name: "Measured profile", messages: [{ role: "system", content: "Keep descriptions concrete." }, { role: "assistant", content: "Preserve this prefill without injecting it." }] }) });
assert.equal(Boolean(findByClass(profileImportRoot, "archive-import-diagnostics__group--warning")), true, "Generation Profile compatibility warnings are visible");
assert.equal(Boolean(findByClass(profileImportRoot, "archive-import-diagnostics__group--migration")), true, "Generation Profile conversion is visible");
assert.equal(findByText(profileImportRoot, "确认导入").disabled, false, "warning-only Generation Profiles remain confirmable");
assert.equal(profileImportApp.confirmImport(), true);
assert.equal(profileImportApp.profileStore.listPersisted()[0].name, "Measured profile");

v3RoleImportApp.route = "worlds";
v3RoleImportApp.onResume(null, { route: "home" });
assert.equal(v3RoleImportApp.route, "home", "archive home launch restores the character archive route");
v3RoleImportApp.onResume(null, { route: `character:${encodeURIComponent(v3RoleProfile.id)}` });
assert.equal(v3RoleImportApp.route, "profile", "character launch route opens the archive profile directly");
assert.equal(v3RoleImportApp.selectedId, v3RoleProfile.id, "character launch route targets the requested profile");

const buildSource = fs.readFileSync(path.join(__dirname, "../../../tools/build-production.cjs"), "utf8");
assert.equal(buildSource.includes("design-prototypes"), false);
const archiveAppSource = fs.readFileSync(path.join(__dirname, "../apps/archive-app.js"), "utf8");
assert.equal(archiveAppSource.includes("archive-bottom-nav"), false);
assert.equal(archiveAppSource.includes("renderModuleEditor"), false, "the temporary Generation Profile form renderer is retired");
const archiveCssSource = fs.readFileSync(path.join(__dirname, "../styles/archive-app.css"), "utf8");
assert.equal(archiveCssSource.includes(".archive-editor-card"), true);
assert.equal(archiveCssSource.includes(".archive-import-row.archive-list-row"), true);
assert.equal(archiveCssSource.includes(".worldbook-shelf-grid"), true);
assert.equal(archiveCssSource.includes(".archive-import-diagnostics--invalid"), true);
assert.match(archiveCssSource, /\.archive-search\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s, "archive search exposes a full-height editable target");
assert.match(archiveCssSource, /\.archive-home-segments \.archive-segment\s*\{[^}]*min-height:\s*44px;/s, "archive category segments meet the phone touch target baseline");

const brokenStorage = { get: () => null, set: () => { throw new Error("Storage full"); } };
const brokenApp = definition.create();
const brokenRoot = new FakeElement("section");
brokenApp.render(brokenRoot, { services: { storage: brokenStorage } });
brokenApp.prepareImport({ filename: "fail.json", mimeType: "application/json", fileSize: 10, rawText: JSON.stringify({ name: "Fail", description: "A valid role used to exercise storage failure." }) });
assert.equal(brokenApp.confirmImport(), false);
assert.equal(brokenApp.errorText.includes("存储可能不可用"), true);
assert.equal(brokenApp.route, "import-review");

// Retry success: first write fails, then succeeds
let callCount = 0;
const retryStorage = { get: () => null, set: (key, value) => { callCount++; if (callCount <= 2) throw new Error("Storage full"); }, values: new Map() };
const retryApp = definition.create();
const retryRoot = new FakeElement("section");
retryApp.render(retryRoot, { services: { storage: retryStorage } });
retryApp.prepareImport({ filename: "retry.json", mimeType: "application/json", fileSize: 10, rawText: JSON.stringify({ name: "Retry", description: "A valid role used to exercise retry." }) });
assert.equal(retryApp.confirmImport(), false);
assert.equal(retryApp.errorText.length > 0, true);
assert.equal(retryApp.route, "import-review");
// Fix storage so second attempt succeeds
retryStorage.set = (key, value) => { retryStorage.values.set(key, value); };
assert.equal(retryApp.confirmImport(), true);
assert.equal(retryApp.errorText, "", "errorText must be cleared after successful retry");
assert.equal(retryApp.route, "imports");

// Export serialization: produces a portable card without instance/asset/lifecycle fields.
const exportProfile = app.store.load().runtimeProfiles[0];
const exported = global.MercuryArchiveContracts.serializeForExport(exportProfile);
assert.equal(exported.kind, "runtime-profile");
assert.equal(exported.schemaVersion, 1);
assert.equal(exported.displayName, exportProfile.displayName);
assert.equal(exported.identity, exportProfile.identity);
assert.equal(exported.id, undefined, "instance id must not be exported");
assert.equal(exported.sourceAssetId, undefined, "source asset id must not be exported");
assert.equal(exported.status, undefined, "lifecycle status must not be exported");
assert.equal(exported.imageAssetId, undefined, "default asset ref must not be exported");
assert.equal(exported.avatarAssetId, undefined, "default avatar ref must not be exported");
assert.equal(exported.coverAssetId, undefined, "default cover ref must not be exported");
assert.deepEqual(exported.stableTraits, []);
assert.deepEqual(exported.motivations, []);

// Export JSON string round-trips deterministically.
const exportedJson = JSON.stringify(global.MercuryArchiveContracts.serializeForExport(exportProfile));
assert.equal(JSON.parse(exportedJson).kind, "runtime-profile");
assert.equal(JSON.parse(exportedJson).displayName, exportProfile.displayName);

const exportableWorld = worldImportApp.store.load().worlds[0];
worldImportApp.store.updateWorld({
  ...exportableWorld,
  entries: exportableWorld.entries.map((entry) => ({ ...entry, aliases: ["calm"], priority: 7, visibility: "restricted", timelineId: "timeline-neutral" })),
});
worldImportApp.state = worldImportApp.store.load();
const worldExport = worldImportApp.exportWorldBook(exportableWorld.id);
assert.equal(worldExport.filename, "Voice notes.json");
const worldExportReport = global.MercuryResourceContracts.preflightMercuryResourceImport(worldExport.json);
assert.equal(worldExportReport.ok, true, "Archive WorldBook export passes the shared import contract");
assert.equal(worldExportReport.resource.entries[0].content, "Keep it calm.", "WorldBook export keeps entry content");
assert.deepEqual(worldExportReport.resource.entries[0].keys, ["calm"], "WorldBook export keeps search keys");
assert.equal(worldExportReport.resource.entries[0].priority, 7, "WorldBook export keeps priority");
assert.equal(worldExportReport.resource.entries[0].visibility, "restricted", "WorldBook export keeps visibility");
assert.equal(worldExportReport.resource.entries[0].timelineId, "timeline-neutral", "WorldBook export keeps timeline scope");
const worldRoundTripApp = definition.create();
const worldRoundTripRoot = new FakeElement("section");
worldRoundTripApp.render(worldRoundTripRoot, { services: { storage: storage() } });
worldRoundTripApp.prepareImport({ filename: worldExport.filename, mimeType: "application/json", fileSize: worldExport.json.length, rawText: worldExport.json });
assert.equal(worldRoundTripApp.confirmImport(), true, "Archive WorldBook export re-imports through the UI workflow");
assert.equal(worldRoundTripApp.store.load().worlds[0].entries[0].content, "Keep it calm.");

const measuredProfile = profileImportApp.profileStore.listPersisted()[0];
const profileExport = profileImportApp.exportGenerationProfile(measuredProfile.id);
assert.equal(profileExport.filename, "Measured profile.json");
const profileExportReport = global.MercuryResourceContracts.preflightMercuryResourceImport(profileExport.json);
assert.equal(profileExportReport.ok, true, "Archive Generation Profile export passes the shared import contract");
assert.equal(profileExportReport.resource.data.name, "Measured profile");
assert.equal(profileExportReport.resource.data.instructionBlocks.some((block) => block.content === "Keep descriptions concrete."), true, "Generation Profile export keeps active instruction content");
assert.equal(profileExportReport.resource.data.compatibility.rawSource.messages.length, 2, "Generation Profile export keeps preserved compatibility source");
const profileRoundTripApp = definition.create();
const profileRoundTripRoot = new FakeElement("section");
profileRoundTripApp.render(profileRoundTripRoot, { services: { storage: storage() } });
profileRoundTripApp.prepareImport({ filename: profileExport.filename, mimeType: "application/json", fileSize: profileExport.json.length, rawText: profileExport.json });
assert.equal(profileRoundTripApp.confirmImport(), true, "Archive Generation Profile export re-imports through the UI workflow");
assert.equal(profileRoundTripApp.profileStore.listPersisted()[0].name, "Measured profile");
assert.equal(profileRoundTripApp.profileStore.listPersisted()[0].instructionBlocks.some((block) => block.content === "Keep descriptions concrete."), true);

// A profile with array fields carries them through untouched, dropping metadata.
const arrayProfile = { displayName: "Ao", identity: "X", stableTraits: ["calm", "stern"], motivations: ["guard"], values: ["honesty"], status: "ready", id: "p1" };
const arrayExport = global.MercuryArchiveContracts.serializeForExport(arrayProfile);
assert.deepEqual(arrayExport.stableTraits, ["calm", "stern"]);
assert.deepEqual(arrayExport.motivations, ["guard"]);
assert.deepEqual(arrayExport.values, ["honesty"]);
assert.equal(arrayExport.id, undefined);
assert.equal(arrayExport.status, undefined);
assert.equal(arrayExport.identity, "X", "string fields stay strings, not arrays");

// Archive → Chat bridge: creating a contact instance from a runtime profile
// must seed that character into the shared chat experience, so it appears in Chat.
const bridgeStorage = storage();
const bridgeRoot = new FakeElement("section");
const bridgeApp = definition.create();
bridgeApp.render(bridgeRoot, { services: { storage: bridgeStorage } });
bridgeApp.prepareImport({ filename: "bridge-char.json", mimeType: "application/json", fileSize: 60, rawText: JSON.stringify({ name: "Ao", identity: "A quiet keeper", stableTraits: ["calm"] }) });
bridgeApp.confirmImport();
const bridgedProfile = bridgeApp.store.load().runtimeProfiles[0];
assert.equal(typeof bridgedProfile, "object");
assert.equal(bridgeApp.bridgeProfileToChat(bridgedProfile), true, "bridge writes the profile into chat experience");
let chatExperience = global.MercuryChatExperienceContracts.normalize(bridgeStorage.get("chat-experience.v1", null));
assert.equal(Object.keys(chatExperience.contacts).length >= 2, true, "contact-a plus the bridged character");
const bridgedContact = Object.values(chatExperience.contacts).find((c) => c.sourceKind === "runtime-profile");
assert.equal(Boolean(bridgedContact), true, "bridged contact carried a persona-source marker");
assert.equal(bridgedContact.name, "Ao");
assert.equal(bridgedContact.persona.identity, "A quiet keeper");
assert.deepEqual(bridgedContact.persona.stableTraits, ["calm"]);
const bridgedInstance = bridgeApp.store.load().contactInstances.find((item) => item.runtimeProfileId === bridgedProfile.id);
assert.equal(bridgedInstance.chatContactId, bridgedContact.id, "archive contact instance points to the chat contact");
// Idempotent: bridging the same profile again doesn't duplicate.
const preCount = Object.keys(chatExperience.contacts).length;
assert.equal(bridgeApp.bridgeProfileToChat(bridgedProfile), true);
chatExperience = global.MercuryChatExperienceContracts.normalize(bridgeStorage.get("chat-experience.v1", null));
assert.equal(Object.keys(chatExperience.contacts).length, preCount, "re-bridging stays idempotent");

// Analysis suggestions never overwrite imported source fields and refresh any
// existing contact mapped to the same runtime profile.
void (async () => {
  const analysisProfile = bridgeApp.store.load().runtimeProfiles[0];
  const analysisRoot = new FakeElement("section");
  const analysisApp = definition.create();
  analysisApp.render(analysisRoot, { services: { storage: bridgeStorage, aiTransport: { analyzeRole: async () => ({ schemaVersion: 1, analysis: { identity: "A revised keeper", summary: "Keeps the harbor calm.", stableTraits: ["patient"], voiceStyle: "Measured and concise." }, warnings: [], sourceTruncated: false }) } } });
  await analysisApp.analyzeProfile(analysisProfile);
  const analyzedProfile = analysisApp.store.load().runtimeProfiles.find((item) => item.id === analysisProfile.id);
  assert.equal(analyzedProfile.identity, "A quiet keeper", "analysis preserves a source identity");
  assert.equal(analyzedProfile.summary, "Keeps the harbor calm.", "analysis fills a missing summary");
  assert.deepEqual(analyzedProfile.stableTraits, ["calm"], "analysis preserves source traits");
  assert.equal(analyzedProfile.voiceStyle, "Measured and concise.", "analysis fills a missing voice style");
  assert.equal(analyzedProfile.analysis.reviewRequired, true, "analysis creates a review marker");
  console.log("archive-app: assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });

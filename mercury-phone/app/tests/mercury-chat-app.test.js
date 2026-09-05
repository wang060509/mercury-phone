"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = global;
require("../core/contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/conversation-transfer-contracts.js");
require("../core/resource-contracts.js");
require("../core/worldbook-runtime.js");
require("../core/archive-contracts.js");
require("../use-cases/resource-intake-workflow.js");
require("../core/relationship-records.js");
require("../core/app-engine.js");
require("../apps/mercury-chat-data.js");
require("../system/conversation-store.js");
require("../use-cases/conversation-transfer-workflow.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");

class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.className = ""; this.style = {}; this.scrollHeight = 37; this.classList = { add: (name) => { this.className += ` ${name}`; } }; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
global.document = { createElement: (tagName) => new FakeElement(tagName) };

const definition = global.MercuryCreateChatDefinition();
assert.equal(definition.id, "mercury-chat");
assert.equal(definition.nameKey, "apps.mercuryChat");
assert.equal(definition.icon, "chat-bubble");
assert.deepEqual(definition.capabilities, ["storage", "notifications"]);
assert.notEqual(definition.create(), definition.create());

const classes = new Set();
const root = {
  dataset: {},
  classList: { add: (name) => classes.add(name) },
  setAttribute(name, value) { this[name] = String(value); },
};
const app = definition.create();
app.render(root, { i18n: { t: (key) => key } });
assert.equal(classes.has("mercury-chat-app"), true);
assert.equal(root.dataset.chatStage, "conversation-shell");
assert.equal(root["aria-label"], "apps.mercuryChat");
app.onMount();
assert.equal(root.dataset.lifecycle, "mounted");
app.onPause();
assert.equal(root.dataset.lifecycle, "paused");
app.onResume();
assert.equal(root.dataset.lifecycle, "resumed");
app.onUnmount();

const visualRoot = new FakeElement("main");
const visualApp = definition.create();
const stored = new Map();
const visualContext = { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value) } } };
visualApp.render(visualRoot, visualContext);
assert.equal(visualRoot.children[0].className, "mercury-chat-list");
assert.equal(visualApp.experience.contacts["contact-a"].avatar, "assets/visual/mercury-contact-avatar.png", "default contact uses the approved visual asset avatar");
assert.equal(visualApp.experience.contacts["contact-a"].profileBackground, "assets/visual/mercury-contact-background.png", "default contact uses the approved visual asset background");
assert.equal(visualApp.experience.user.profileBackground, "assets/archive/archive-water-starlight-v1.png", "default user background remains unchanged");
const primaryNavigation = visualRoot.children[0].children.find((child) => child.className === "mercury-chat-primary-nav");
assert.equal(primaryNavigation.children.length, 3, "chat, contacts, and me remain reachable from the list");
assert.equal(nodesWithClass(visualRoot.children[0], "mercury-chat-list__filter").length, 0, "chat list keeps state controls out of the main visual hierarchy");
primaryNavigation.children[1].listeners.click();
assert.equal(visualApp.ui.route, "contacts", "contacts tab is reachable from the chat list");
const contactsNavigation = nodesWithClass(visualRoot.children[0], "mercury-chat-primary-nav")[0];
assert.equal(Boolean(contactsNavigation), true, "contacts keeps the same persistent primary navigation");
contactsNavigation.children[2].listeners.click();
assert.equal(visualApp.ui.route, "me", "me tab is reachable from contacts");
visualApp.ui.route = "me";
visualApp.paint();
const mePage = visualRoot.children[0];
assert.equal(mePage.className, "mercury-chat-me");
const meContent = mePage.children[0];
const meHero = meContent.children[0];
assert.equal(meHero.className, "mercury-chat-me__hero");
assert.equal(meHero.children[0].textContent, "Me");
assert.equal(meHero.children.some((child) => child.className === "mercury-chat-me__actions"), false);
const meFeatures = meContent.children[1];
assert.equal(meFeatures.children.length, 3, "me page groups self, services, and data without chat-runtime settings");
assert.equal(meFeatures.children[0].children[1].children[1].children[0].textContent, "我的身份");
assert.equal(meFeatures.children[0].children[2].children[1].children[0].textContent, "美化");
assert.equal(meFeatures.children[1].children[1].children[1].children[0].textContent, "朋友圈");
assert.equal(meFeatures.children[1].children[1].disabled, true, "unavailable moments entry is visibly disabled instead of pretending to work");
assert.equal(mePage.children[1].className, "mercury-chat-primary-nav");

// Profile & Appearance is a real editor: preview, grouped rows, background panel,
// and an explicit draft/save boundary are all present before persistence.
visualApp.ui.route = "profileAppearance";
visualApp.paint();
const profilePage = visualRoot.children[0];
assert.equal(profilePage.className, "mercury-chat-page mercury-chat-profile-editor-page");
assert.equal(profilePage.children[0].children[1].textContent, "个人资料与外观");
const profileEditor = profilePage.children[1];
assert.equal(profileEditor.className, "mercury-chat-profile-editor");
assert.equal(profileEditor.children[0].className.includes("mercury-chat-profile-editor__preview"), true);
assert.equal(profileEditor.children[1].children.length, 3, "material group has heading plus two rows");
const backgroundRow = profileEditor.children[1].children[2];
backgroundRow.listeners.click();
assert.equal(visualApp.ui.profileAppearancePanel, "background");
visualApp.paint();
const backgroundPage = visualRoot.children[0];
assert.equal(backgroundPage.children[0].children[1].textContent, "主页背景");
assert.equal(backgroundPage.children[1].className.includes("mercury-chat-profile-editor--background"), true);
visualApp.ui.profileAppearancePanel = null;
visualApp.paint();
const profileEditorAgain = visualRoot.children[0].children[1];
const nameRow = profileEditorAgain.children[2].children[1];
nameRow.listeners.click();
assert.equal(visualApp.ui.profileAppearanceEditing, "name");
visualApp.paint();
assert.equal(visualRoot.children[0].children[1].children[2].children[1].tagName, "div");
visualApp.ui.profileAppearanceDraft.name = "Mina";
visualApp.ui.profileAppearanceDraft.dirty = true;
visualApp.commitProfileAppearance();
assert.equal(stored.get("chat-experience.v1").user.name, "Mina");

global.MercuryPresentationAdapter = {
  initialRoute: null,
  meEntries: [{ slot: "moments", route: "extension-moments", label: "朋友圈", subtitle: "In-memory only", icon: "camera" }],
  renderRoute: () => null,
};
const demoVisualApp = definition.create();
const demoVisualRoot = new FakeElement("main");
demoVisualApp.render(demoVisualRoot, visualContext);
demoVisualApp.ui.route = "me";
demoVisualApp.paint();
const demoFeatures = demoVisualRoot.children[0].children[0].children[1];
assert.equal(demoFeatures.children[1].children[1].children[1].children[0].textContent, "朋友圈");
assert.equal(demoFeatures.children[1].children[1].disabled, false, "installed moments adapter enables the real entry");
delete global.MercuryPresentationAdapter;

// Me data boundary: data management opens Settings; unavailable services stay disabled.
const launchCalls = [];
const launchAppContext = { state: {}, i18n: { t: (key) => key }, services: { storage: visualContext.services.storage, launchApp: (appId, route) => { launchCalls.push({ appId, route }); return true; } } };
const launchVisualApp = definition.create();
const launchVisualRoot = new FakeElement("main");
launchVisualApp.render(launchVisualRoot, launchAppContext);
launchVisualApp.ui.route = "me";
launchVisualApp.paint();
const launchMeFeatures = launchVisualRoot.children[0].children[0].children[1];
const launchLabels = launchMeFeatures.children.flatMap((group) => group.children.slice(1).map((row) => row.children[1].children[0].textContent));
assert.deepEqual(launchLabels, ["我的身份", "美化", "朋友圈", "钱包", "数据管理"]);
launchMeFeatures.children[2].children[1].listeners.click();
assert.deepEqual(launchCalls, [{ appId: "settings", route: "home" }]);
assert.equal(launchMeFeatures.children[1].children[1].listeners.click, undefined, "unavailable moments has no fake click action");
assert.equal(launchMeFeatures.children[1].children[2].listeners.click, undefined, "unavailable wallet has no fake click action");
visualApp.ui.route = "chats";
visualApp.paint();
const addConversation = nodesWithClass(visualRoot.children[0], "mercury-chat-list__add")[0];
assert.equal(addConversation.className, "mercury-chat-list__add");
assert.equal(addConversation.disabled, undefined);
const threadList = nodesWithClass(visualRoot.children[0], "mercury-chat-list__threads")[0];
assert.equal(threadList.className, "mercury-chat-list__threads");
assert.equal(threadList.children.length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length, "starter roster renders as a compact normal-message list");
const thread = threadList.children[0];
thread.listeners.click();
assert.equal(visualRoot.children[0].className, "mercury-chat-conversation");
const messages = visualRoot.children[0].children[1];
assert.equal(messages.children.length, 5);
const headerAvatar = nodesWithClass(visualRoot.children[0], "mercury-chat-header__avatar")[0];
headerAvatar.src = "assets/missing-avatar.png";
headerAvatar.listeners.error();
assert.equal(headerAvatar.src, "assets/visual/mercury-avatar-fallback.png", "conversation header avatar falls back when the configured asset is missing");
const quotedBubble = nodesWithClass(messages.children[4], "mercury-chat-bubble")[0];
assert.equal(quotedBubble.children[0].children[1].textContent, "Then we can let it be quiet for a while. I’ll stay here.");
const longToken = "https://example.test/" + "a".repeat(160);
const longTextRow = visualApp.messageView({ id: "long-token", role: "assistant", content: longToken, createdAt: "2026-08-02T00:05:30.000Z", delivery: "complete" }, { content: longToken });
assert.equal(nodesWithClass(longTextRow, "mercury-chat-bubble__content")[0].textContent, longToken, "long unbroken message text remains intact for CSS wrapping");
assert.equal(nodesWithClass(longTextRow, "mercury-chat-bubble__quote-preview")[0].textContent, longToken, "long quoted text remains intact for CSS wrapping");
const chatCss = fs.readFileSync(path.join(__dirname, "../styles/mercury-chat-app.css"), "utf8");
assert.match(chatCss, /\.mercury-chat-conversation \.mercury-chat-bubble__content[\s\S]*overflow-wrap: anywhere/, "active chat bubble content CSS forces long tokens to wrap");
assert.match(chatCss, /\.mercury-chat-conversation \.mercury-chat-bubble,[\s\S]*\.mercury-chat-bubble__quote-preview[\s\S]*word-break: break-word/, "active chat bubble and quote CSS prevent unbroken text from widening the viewport");
const composer = visualRoot.children[0].children[2];
const draftInput = composer.children[1];
assert.equal(draftInput.tagName, "textarea");
assert.equal(composer.children[2].type, "submit", "send button submits the composer form on click");
assert.match(composer.children[2].children[0].src, /send\.svg$/, "the composer consistently uses a send icon instead of a microphone");
draftInput.value = "A local message\nwith a second line";
draftInput.listeners.input();
assert.equal(composer.children[2].disabled, false);
composer.listeners.submit({ preventDefault() {} });
assert.equal(stored.get("conversation.v1").schemaVersion, 2);
assert.equal(stored.get("conversation.v1").entries.at(-1).text, "A local message\nwith a second line");
assert.equal(visualRoot.children[0].children[1].children.length, 6);
const firstBubbleRow = messages.children[1];
const firstBubble = nodesWithClass(firstBubbleRow, "mercury-chat-bubble")[0];
firstBubble.listeners.click();
assert.equal(visualRoot.children[0].children[1].children[1].children.length, 2, "selected-message actions do not create a third column beside an assistant bubble");
assert.equal(nodesWithClass(visualRoot.children[0].children[1].children[1], "mercury-chat-message__stack")[0].children.length, 3, "selected-message actions stay inside the message stack after the sender label");

// Per-conversation beautification changes the real transcript, not only its
// settings preview. Hiding avatar/time removes those elements structurally.
const visualAppearance = visualApp.experienceFor("contact-a").appearance;
Object.assign(visualAppearance, { background: "assets/visual/mercury-chat-background.png", cropPosition: "50% 24%", bubbleStyle: "light-glass", chatFont: "rounded", chatFontSize: "large", messageSpacing: "compact", showAvatar: false, showTime: false });
visualApp.ui.route = "conversation";
visualApp.paint();
const beautifiedConversation = visualRoot.children[0];
assert.equal(beautifiedConversation.dataset.bubbleStyle, "light-glass", "selected bubble style reaches the live conversation");
assert.equal(beautifiedConversation.dataset.chatFont, "rounded", "selected chat font reaches the live conversation");
assert.equal(beautifiedConversation.dataset.messageSpacing, "compact", "selected message spacing reaches the live conversation");
assert.equal(beautifiedConversation.style.backgroundPosition, "50% 24%", "selected background position reaches the live conversation");
assert.equal(nodesWithClass(beautifiedConversation.children[1], "mercury-chat-message__avatar").length, 0, "disabled chat avatars are not rendered in the transcript");
assert.equal(nodesWithClass(beautifiedConversation.children[1], "mercury-chat-bubble__meta").some((meta) => meta.children.some((child) => child.tagName === "time")), false, "disabled chat times are not rendered in the transcript");

// P1 drafts are durable per timeline: leaving or refreshing never leaks a
// draft into another conversation, and sending/deleting removes only its own.
const draftStored = new Map();
const draftApp = definition.create();
const draftRoot = new FakeElement("main");
const draftStorage = { get: (key, fallback) => draftStored.get(key) ?? fallback, set: (key, value) => draftStored.set(key, value) };
draftApp.render(draftRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: draftStorage } });
draftApp.openConversation("contact-a");
let draftComposer = draftRoot.children[0].children[2];
draftComposer.children[1].value = "Keep this exact draft\nfor later.";
draftComposer.children[1].listeners.input();
assert.deepEqual(draftStored.get("chat-experience.v1").drafts["contact-a:default"].text, "Keep this exact draft\nfor later.", "draft text persists under the active contact and timeline");
draftApp.startNewConversation("contact-a");
const draftTimelineId = draftApp.activeTimelineId();
assert.equal(draftApp.ui.draft, "", "a new timeline starts with no inherited draft");
draftComposer = draftRoot.children[0].children[2];
draftComposer.children[1].value = "Only the new timeline has this.";
draftComposer.children[1].listeners.input();
draftApp.openConversation("contact-a", "default");
assert.equal(draftApp.ui.draft, "Keep this exact draft\nfor later.", "switching back restores the original timeline draft");
draftApp.openConversation("contact-a", draftTimelineId);
assert.equal(draftApp.ui.draft, "Only the new timeline has this.", "switching forward restores the independent timeline draft");
const draftReloaded = definition.create();
const draftReloadedRoot = new FakeElement("main");
draftReloaded.render(draftReloadedRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: draftStorage } });
draftReloaded.openConversation("contact-a", draftTimelineId);
assert.equal(draftReloaded.ui.draft, "Only the new timeline has this.", "a fresh app instance restores the persisted draft");
assert.equal(draftReloaded.submitDraft(), true, "a saved draft can still submit normally");
assert.equal(draftStored.get("chat-experience.v1").drafts[`contact-a:${draftTimelineId}`], undefined, "submitting clears the stored draft only after the message is queued");
draftReloaded.openConversation("contact-a", "default");
draftComposer = draftReloadedRoot.children[0].children[2];
draftComposer.children[1].value = "Remove with this conversation.";
draftComposer.children[1].listeners.input();
draftReloaded.deleteActiveConversation();
assert.equal(draftStored.get("chat-experience.v1").drafts["contact-a:default"], undefined, "deleting a conversation removes its associated draft");

// Malformed stored conversation data recovers into a usable transcript without
// overwriting the damaged record until the user performs a real chat action.
const corruptStored = new Map([["conversation.v1", { schemaVersion: 99, unexpected: true }]]);
const corruptWrites = [];
const corruptStorage = { get: (key, fallback) => corruptStored.has(key) ? corruptStored.get(key) : fallback, set: (key, value) => { corruptWrites.push({ key, value }); corruptStored.set(key, value); } };
const corruptApp = definition.create();
const corruptRoot = new FakeElement("main");
corruptApp.render(corruptRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: corruptStorage } });
corruptApp.openConversation("contact-a");
assert.equal(corruptApp.messages.length, global.MercuryChatData.contactAStaticMessages().length, "corrupted stored data hydrates to the starter transcript");
assert.equal(corruptWrites.some((write) => write.key === "conversation.v1"), false, "corrupt hydration does not silently overwrite the damaged stored value");
const corruptComposer = corruptRoot.children[0].children[2];
corruptComposer.children[1].value = "Recovered send.";
corruptComposer.children[1].listeners.input();
corruptComposer.listeners.submit({ preventDefault() {} });
assert.equal(corruptStored.get("conversation.v1").schemaVersion, 2, "the next accepted send persists a valid recovered conversation");
assert.equal(corruptStored.get("conversation.v1").entries.at(-1).text, "Recovered send.", "the recovery path remains usable after malformed storage");

// P1 long timelines retain the full transcript but render a compact tail first.
// Search works across the complete local history and expands only enough history
// to put the chosen result back in view.
const historyStored = new Map();
const historyApp = definition.create();
const historyRoot = new FakeElement("main");
historyApp.render(historyRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => historyStored.get(key) ?? fallback, set: (key, value) => historyStored.set(key, value) } } });
const longEntries = Array.from({ length: 96 }, (_, index) => ({ id: `history-${index + 1}`, role: "user", text: `Historical message ${index + 1}`, createdAt: `2026-08-10T10:${String(index % 60).padStart(2, "0")}:00.000Z`, delivery: "complete", replyToId: null }));
historyApp.conversation = { ...historyApp.conversation, id: "contact-a:history", entries: longEntries };
historyApp.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(historyApp.conversation));
historyApp.ui.route = "conversation";
historyApp.resetHistoryWindow();
historyApp.paint();
let historyMessages = historyRoot.children[0].children[1];
assert.equal(nodesWithClass(historyMessages, "mercury-chat-message").length, 40, "a long timeline initially renders only the latest forty entries");
assert.equal(nodesWithClass(historyMessages, "mercury-chat-message").at(-1).dataset.messageId, "history-96", "the initial window ends at the latest message");
let loadEarlier = nodesWithClass(historyMessages, "mercury-chat-history-load")[0];
assert.equal(Boolean(loadEarlier), true, "older records are reached through an explicit load control");
loadEarlier.listeners.click();
historyMessages = historyRoot.children[0].children[1];
assert.equal(nodesWithClass(historyMessages, "mercury-chat-message").length, 80, "loading earlier expands the visible window by one page");
historyApp.ui.route = "settings";
historyApp.paint();
const historyRow = nodesWithClass(historyRoot.children[0], "mercury-chat-settings-row").find((row) => row.children[0]?.textContent === "搜索聊天记录");
assert.equal(Boolean(historyRow), true, "conversation settings exposes history search without adding a fourth chat-header control");
historyRow.listeners.click();
let historySearchInput = nodesWithClass(historyRoot.children[0], "mercury-chat-history-search__input")[0];
historySearchInput.value = "historical message 10";
historySearchInput.listeners.input();
let historyResults = nodesWithClass(historyRoot.children[0], "mercury-chat-history-search__result");
assert.equal(historyResults.length, 1, "history search finds an older message outside the initial tail window");
historyResults[0].listeners.click();
assert.equal(historyApp.ui.route, "conversation", "selecting a history result returns to the chat timeline");
assert.equal(historyApp.historyEntryLimit(), 87, "jumping to an old result expands only enough entries to include it");
historyMessages = historyRoot.children[0].children[1];
assert.equal(nodesWithClass(historyMessages, "mercury-chat-message").some((row) => row.dataset.messageId === "history-10"), true, "the matched message is included in the expanded timeline window");

// Time formatting: always local, not raw UTC offset
const formatterCalls = [];
class ControlledDateTimeFormat {
  constructor(locale, options) { this.options = options; formatterCalls.push({ locale, options }); }
  format(date) { assert.equal(date.toISOString(), utc2024); return this.options.month ? "local-date" : "local-clock"; }
}
const utc2024 = "2024-01-15T12:30:00.000Z";
const timeApp = definition.create({ dateTimeFormat: ControlledDateTimeFormat, now: () => Date.parse("2024-01-16T12:30:00.000Z") });
timeApp.render({ dataset: {}, classList: { add() {} }, setAttribute() {}, replaceChildren() {} }, { i18n: { locale: "zh-CN", t: (key) => key } });
const formatted = timeApp.formatMessageTime(utc2024);
const formatted2 = timeApp.formatMessageTime(utc2024);
const threadFormatted = timeApp.formatThreadTime(utc2024);
assert.equal(formatted, "local-clock");
assert.equal(formatted2, "local-clock");
assert.equal(threadFormatted, "local-date", "older conversation previews show a date instead of looking like today's messages");
const todayTimeApp = definition.create({ dateTimeFormat: ControlledDateTimeFormat, now: () => Date.parse("2024-01-15T14:30:00.000Z") });
todayTimeApp.render({ dataset: {}, classList: { add() {} }, setAttribute() {}, replaceChildren() {} }, { i18n: { locale: "zh-CN", t: (key) => key } });
assert.equal(todayTimeApp.formatThreadTime(utc2024), "local-clock", "same-day conversation previews retain the useful local time");
assert.equal(formatterCalls.length >= 3, true);
assert.equal(formatterCalls.filter((call) => call.options.hour).every((call) => call.options.hour12 === false), true);
assert.equal(formatterCalls.every((call) => call.locale === "zh-CN"), true, "message dates follow the active Mercury locale");

const host = { hidden: true, append(node) { this.node = node; } };
const instanceRoot = {
  dataset: {},
  hidden: false,
  classList: { add() {} },
  setAttribute() {},
  remove() {},
};
const engine = new global.MercuryAppEngine({ host, i18n: { t: (key) => key }, createElement: () => instanceRoot });
engine.register(definition);
const instance = engine.launch("mercury-chat");
assert.equal(instance.status, "active");
assert.equal(instance.root.dataset.chatStage, "conversation-shell");
assert.equal(instance.root.dataset.lifecycle, "mounted");
engine.pause("mercury-chat");
assert.equal(instance.root.dataset.lifecycle, "paused");
engine.resume("mercury-chat");
assert.equal(instance.root.dataset.lifecycle, "resumed");

// Import a character card (JSON handshake): creates a new contact with an attached persona.
const importStored = new Map();
let importTransportCalls = 0;
const importContext = { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => importStored.get(key) ?? fallback, set: (key, value) => importStored.set(key, value) }, aiTransport: { chat: async () => { importTransportCalls += 1; return {}; } } } };
const importApp = definition.create();
const importRoot = new FakeElement("main");
importApp.render(importRoot, importContext);
const cardJson = JSON.stringify({ kind: "runtime-profile", schemaVersion: 1, displayName: "Ao", identity: "A quiet keeper", summary: "Keeps the threshold", stableTraits: ["calm", "stern"], values: ["honesty"], voiceStyle: "low, even" });
const created = importApp.importCharacterFromJson(cardJson);
assert.equal(Boolean(created), true);
assert.equal(created.name, "Ao");
assert.equal(created.identity, "A quiet keeper");
assert.equal(created.relationship, "Imported character");
assert.equal(created.persona.displayName, "Ao");
assert.deepEqual(created.persona.stableTraits, ["calm", "stern"]);
assert.equal(created.persona.identity, "A quiet keeper");
assert.equal(created.sourceKind, "mercury.roleCard");
assert.equal(Object.keys(importStored.get("chat-experience.v1").contacts).length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length + 1, "starter roster plus the imported contact");
const pngChunk = (type, data) => {
  const body = Buffer.from(data, "latin1");
  const chunk = Buffer.alloc(body.length + 12);
  chunk.writeUInt32BE(body.length, 0);
  chunk.write(type, 4, 4, "latin1");
  body.copy(chunk, 8);
  return chunk;
};
const pngPayload = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Image Contact", description: "A complete profile extracted from image metadata.", personality: "Careful." } };
const pngBytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("tEXt", `chara\0${Buffer.from(JSON.stringify(pngPayload), "utf8").toString("base64")}`), pngChunk("IEND", "")]);
const pngPreflight = global.MercuryResourceContracts.preflightMercuryResourceBinary(pngBytes, { filename: "image-contact.png" });
const imageContact = importApp.importCharacterFromPreflight(pngPreflight, pngPreflight.sourceText, { filename: "image-contact.png", mimeType: "image/png" });
assert.equal(imageContact.name, "Image Contact", "PNG role-card metadata creates a normal contact");
assert.equal(importStored.get(global.MercuryArchiveContracts.STORAGE_KEY).sourceAssets.some((asset) => asset.filename === "image-contact.png"), true, "PNG imports keep their source filename in the archive");
// Invalid JSON is a safe no-op.
assert.equal(importApp.importCharacterFromJson("not json"), null);
assert.equal(Object.keys(importStored.get("chat-experience.v1").contacts).length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length + 2, "a rejected import does not add another contact after JSON and PNG imports");
// A UTF-8 BOM (often written by Notepad / PowerShell) must not break the parse.
const bomCard = `﻿${JSON.stringify({ kind: "runtime-profile", displayName: "Bom", identity: "with a BOM" })}`;
const bomContact = importApp.importCharacterFromJson(bomCard);
assert.equal(Boolean(bomContact), true);
assert.equal(importApp.importCharacterFromJson("  ﻿  "), null);
assert.equal(importStored.get("chat-experience.v1").contacts[bomContact.id].persona.displayName, "Bom");

// SillyTavern v2 character cards (chara_card_v2) are recognized: name + description
// map onto the persona so imported tavern cards become real, readable contacts.
const tavernJson = JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  name: "Card One",
  description: "A long persona body describing the character's world and manner.",
  personality: "Calm and deliberate.",
  scenario: "A quiet study in the rain.",
  first_mes: "It is raining. We can stay here a while.",
  mes_example: "<START>\nThey greet you quietly.\nThey wait for you to speak.",
  data: { name: "Card One", description: "A long persona body describing the character's world and manner.", personality: "Calm and deliberate.", scenario: "A quiet study in the rain.", mes_example: "<START>\nThey greet you quietly.", first_mes: "It is raining. We can stay here a while." },
});
const tavernContact = importApp.importCharacterFromJson(tavernJson, { filename: "card-one.json" });
assert.equal(Boolean(tavernContact), true);
assert.equal(tavernContact.name, "Card One");
assert.equal(tavernContact.sourceKind, "mercury.roleCard");
assert.equal(importStored.get("chat-experience.v1").contacts[tavernContact.id].persona.displayName, "Card One");
assert.equal(importStored.get("chat-experience.v1").contacts[tavernContact.id].persona.background, "A long persona body describing the character's world and manner.");
assert.equal(importStored.get("chat-experience.v1").contacts[tavernContact.id].persona.voiceStyle.includes("greet you quietly"), true, "example dialogue maps onto voice style");
// Imported openings are scene sources, not auto-inserted text messages. This
// keeps a phone conversation empty until the user chooses a concrete scene.
importApp.openConversation(tavernContact.id);
assert.equal(importApp.messages.length, 0, "an ordinary imported-card conversation starts without a fabricated opening bubble");
assert.equal(importStored.has(`conversation.${tavernContact.id}.v1`), false, "opening an empty ordinary conversation does not create a transcript");
assert.equal(importApp.hasConversationContent(tavernContact.id), false, "an empty direct chat is still a new conversation");
assert.equal(importTransportCalls, 0, "opening a scene source never calls the AI transport");
const cardScenes = importApp.roleSceneCandidates(tavernContact.id);
assert.equal(cardScenes.length, 1, "the imported opening is available as one scene source");
assert.equal(cardScenes[0].content, "It is raining. We can stay here a while.", "the original opening remains intact in the scene source");
assert.equal(importApp.startSceneConversation(tavernContact.id, cardScenes[0]), true, "a selected scene creates an isolated conversation");
assert.equal(importApp.messages.length, 0, "scene context is not rendered as an AI message");
assert.equal(importApp.hasConversationContent(tavernContact.id), true, "a selected scene counts as a conversation the user can continue");
assert.equal(importApp.activeSceneContext().content, "It is raining. We can stay here a while.");
const sceneRuntime = importApp.buildRuntimeInput();
assert.match(sceneRuntime.compiledSystemText, /当前场景上下文/, "selected scene content is injected into the real runtime context");
assert.match(sceneRuntime.compiledSystemText, /It is raining\. We can stay here a while\./);
assert.equal(sceneRuntime.resourceTrace.binding.sceneContext.contentLength, "It is raining. We can stay here a while.".length, "trace exposes the actual scene binding without leaking its full text");
importApp.openConversation(tavernContact.id);
assert.equal(importApp.activeTimelineId(), "default", "returning to ordinary chat selects the normal conversation");
assert.equal(importApp.activeSceneContext(), null, "ordinary chat does not inherit a scene context");
importApp.ui.newConversationQuery = "a stale search that hides the new role";
const duplicateTavernContact = importApp.importCharacterFromJson(JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Card One",
    description: "A second local copy with a different source file.",
    first_mes: "作者：Example\n卡名：Card One\n右划开场白：请从目录选择。",
    alternate_greetings: ["A safe alternate opening."],
  },
}), { filename: "card-one-alternate.json" });
const duplicateOpeningState = importApp.roleSceneState(duplicateTavernContact.id);
assert.equal(duplicateOpeningState.candidates.length, 1, "a safe alternate remains playable when the primary greeting is source metadata");
assert.equal(duplicateOpeningState.rejected.length, 1, "filtered source metadata remains observable instead of disappearing silently");
assert.equal(importApp.ui.importReceipt.sameNameContactCount, 2, "the visible receipt knows that this import created a same-name contact");
assert.equal(importApp.ui.importReceipt.filename, "card-one-alternate.json", "the visible receipt uses Mercury source-asset provenance");
assert.equal(importApp.ui.newConversationQuery, "", "a successful import clears a stale chooser query so the highlighted role cannot stay hidden");
importApp.ui.route = "newConversation";
importApp.paint();
const duplicateReceipt = nodesWithClass(importRoot.children[0], "mercury-chat-import-receipt")[0];
assert.equal(Boolean(duplicateReceipt), true, "a successful import remains visible as an actionable receipt");
assert.match(duplicateReceipt.children[1].textContent, /同名角色 2 个/, "the receipt explains how the same-name import is distinguished");
assert.equal(nodesWithClass(duplicateReceipt, "mercury-chat-import-receipt__primary")[0].children.at(-1).textContent, "选择开场", "receipt actions include visible text instead of relying on aria-labels");
const recentDuplicateCard = nodesWithClass(importRoot.children[0], "mercury-chat-new-conversation__contact")[0];
assert.equal(recentDuplicateCard.dataset.contactId, duplicateTavernContact.id, "the just-imported contact is moved to the top of the chooser");
assert.equal(recentDuplicateCard.className.includes("is-recently-imported"), true, "the just-imported contact is visibly highlighted");
const duplicateNameCards = nodesWithClass(importRoot.children[0], "mercury-chat-new-conversation__contact").filter((row) => row.children[1]?.children?.[0]?.textContent === "Card One");
assert.deepEqual(duplicateNameCards.map((row) => row.children[1].children[2].textContent).sort(), ["本地导入 · card-one-alternate.json", "本地导入 · card-one.json"], "same-name contacts expose distinct Mercury-owned source markers");
const sameSourceDuplicate = importApp.importCharacterFromJson(JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name: "Card One", description: "A third copy from the same local source filename.", alternate_greetings: ["Another safe opening."] },
}), { filename: "card-one-alternate.json" });
importApp.ui.route = "newConversation";
importApp.paint();
const sameSourceCards = nodesWithClass(importRoot.children[0], "mercury-chat-new-conversation__contact").filter((row) => row.children[1]?.children?.[0]?.textContent === "Card One");
assert.equal(sameSourceCards[0].dataset.contactId, sameSourceDuplicate.id, "the newest same-source copy remains the highlighted first result");
assert.deepEqual(sameSourceCards.map((row) => row.children[1].children[2].textContent).sort(), ["本地导入 · card-one-alternate.json · 副本 1", "本地导入 · card-one-alternate.json · 副本 2", "本地导入 · card-one.json"], "same-file duplicates gain stable Mercury copy markers");
const metadataOpeningContact = importApp.importCharacterFromJson(JSON.stringify({ kind: "runtime-profile", displayName: "Metadata Card", identity: "A character", openingMessage: "作者：Example\n卡名：Metadata Card\n右划开场白：请从目录选择。" }));
assert.equal(importApp.roleSceneCandidates(metadataOpeningContact.id).length, 0, "author notes and scenario catalogues are excluded from scene selection");
assert.equal(importApp.roleSceneState(metadataOpeningContact.id).rejected.length, 1, "a no-opening state records why the imported source was skipped");
importApp.ui.route = "newConversation";
importApp.paint();
const emptyOpeningReceipt = nodesWithClass(importRoot.children[0], "mercury-chat-import-receipt")[0];
assert.match(emptyOpeningReceipt.children[1].textContent, /未找到可用开场/, "the import receipt explicitly reports a missing usable opening");
const blankFromReceipt = nodesWithClass(emptyOpeningReceipt, "mercury-chat-import-receipt__primary")[0];
assert.equal(blankFromReceipt.children.at(-1).textContent, "开始空白聊天", "the no-opening recovery action has a visible label");
blankFromReceipt.listeners.click();
assert.equal(importApp.ui.route, "conversation", "a no-opening receipt continues directly into a blank chat");
assert.equal(importApp.messages.length, 0, "the blank-chat fallback never fabricates an assistant greeting");
importApp.ui.selectedContactId = metadataOpeningContact.id;
importApp.ui.route = "sceneLibrary";
importApp.paint();
assert.equal(nodesWithClass(importRoot.children[0], "mercury-chat-scene-library__empty-title")[0].textContent, "未找到可用开场", "the scene library names the no-opening state clearly");
const blankFromSceneLibrary = nodesWithClass(importRoot.children[0], "mercury-chat-scene-library__blank")[0];
assert.equal(Boolean(blankFromSceneLibrary), true, "the empty scene library offers a continuous blank-chat path");
assert.equal(blankFromSceneLibrary.children.at(-1).textContent, "开始空白聊天", "the scene-library recovery action has a visible label");

// Contacts list iterates all contacts (contact-a + imported).
function contactRowsOf(node) {
  const tokens = (c) => String(c.className || "").split(/\s+/).filter(Boolean);
  const out = [];
  (function walk(n) { (n.children || []).forEach((c) => { if (tokens(c).includes("mercury-chat-contact-row")) out.push(c); walk(c); }); })(node);
  return out;
}
function nodesWithClass(node, className) {
  const out = [];
  (function walk(n) { (n.children || []).forEach((c) => { if (String(c.className || "").split(/\s+/).includes(className)) out.push(c); walk(c); }); })(node);
  return out;
}
function controlledTimers() {
  let sequence = 0;
  const tasks = new Map();
  return {
    schedule(callback, delay) { const id = ++sequence; tasks.set(id, { callback, delay }); return id; },
    cancel(id) { tasks.delete(id); },
    fireNext() { const next = tasks.entries().next().value; if (!next) return false; const [id, task] = next; tasks.delete(id); task.callback(); return true; },
    fireAll() { while (this.fireNext()) {} },
    pending() { return tasks.size; },
  };
}
importApp.ui.route = "contacts";
importApp.paint();
assert.equal(contactRowsOf(importRoot.children[0]).length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length + 7, "contacts list shows the starter roster plus imported JSON and PNG cards");
assert.equal(nodesWithClass(importRoot.children[0], "mercury-chat-contacts__import").length, 0, "import stays out of the main contacts list");
assert.equal(nodesWithClass(importRoot.children[0], "mercury-chat-contacts__import-header").length, 0, "contact import never competes with the contacts title");
const contactsMenuToggle = nodesWithClass(importRoot.children[0], "mercury-chat-page__more")[0];
assert.equal(Boolean(contactsMenuToggle), true, "contact import is available from the compact header menu");
contactsMenuToggle.listeners.click();
assert.equal(nodesWithClass(importRoot.children[0], "mercury-chat-contacts__menu-item").length, 1, "the header menu exposes the real role-card import action");
assert.equal(nodesWithClass(importRoot.children[0], "mercury-chat-contact-card__start").length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length + 7, "contact cards expose a contact-home affordance");

// Contact cards open the contact homepage; chat remains an explicit action there.
const clickedRow = contactRowsOf(importRoot.children[0]).find((row) => row.dataset.contactId === created.id);
assert.equal(Boolean(clickedRow), true);
clickedRow.listeners.click();
assert.equal(importApp.ui.selectedContactId, created.id);
assert.equal(importApp.ui.route, "contact");

// The role home remains available from the conversation settings contact card.
importApp.ui.route = "contact";
importApp.paint();

// Contact profile renders the selected contact's identity in the hero.
const roleHomeContent = importRoot.children[0].children[1];
assert.equal(roleHomeContent.className.includes("mercury-chat-contact-profile"), true);
assert.equal(roleHomeContent.className.includes("mercury-chat-contact-profile--space"), true);
const heroName = roleHomeContent.children[0].children[2];
assert.equal(heroName.textContent, "Ao");

// Profile actions stay light: chat is primary, the heart is a local relationship marker.
const profileActions = roleHomeContent.children[1];
assert.equal(profileActions.className, "mercury-chat-contact-profile__actions mercury-chat-contact-profile__actions--light");
assert.equal(profileActions.children.length, 2);
profileActions.children[1].listeners.click();
assert.equal(importApp.ui.route, "contact");
assert.equal(importStored.get("chat-experience.v1").contacts[created.id].favorite, true);

// Full role data is delegated to the archive instead of opening a chat-local view.
const contactMore = importRoot.children[0].children[0].children[2];
contactMore.listeners.click();
const contactMenu = nodesWithClass(importRoot.children[0].children[1], "mercury-chat-contact-profile__menu")[0];
assert.equal(Boolean(contactMenu), true);
contactMenu.children[0].listeners.click();
assert.equal(importApp.ui.route, "contact", "archive handoff does not open a chat-local persona page");

// API memory candidates enter a pending state and only become timeline records
// after the user confirms them on the contact space.
const queuedRecords = importApp.queueMemoryCandidates([{ id: "candidate-shared-1", kind: "shared_event", content: "A confirmed shared event.", evidence: { sourceTurnIds: ["user-memory"], certainty: "explicit" } }], { requestId: "request-memory-1", userMessageId: "user-memory", assistantTurnId: "turn-memory" });
assert.equal(queuedRecords.length, 1);
importApp.ui.route = "contact";
importApp.paint();
const pendingSection = nodesWithClass(importRoot.children[0], "mercury-chat-contact-profile__pending")[0];
assert.equal(Boolean(pendingSection), true, "pending memory appears on the contact space");
const pendingInput = nodesWithClass(pendingSection, "mercury-chat-contact-profile__pending-input")[0];
assert.equal(Boolean(pendingInput), true, "pending memory can be edited before confirmation");
pendingInput.value = "A refined shared event.";
pendingInput.listeners.input();
const pendingRetain = nodesWithClass(pendingSection, "mercury-chat-contact-profile__record-action--retain")[0];
assert.equal(Boolean(pendingRetain), true, "the user must explicitly choose durable event retention");
pendingRetain.listeners.click();
assert.equal(global.MercuryRelationshipRecords.list(importStored.services?.storage || importContext.services.storage, created.id, "confirmed").length, 1, "confirmed memory is stored");
assert.equal(global.MercuryRelationshipRecords.list(importStored.services?.storage || importContext.services.storage, created.id, "confirmed")[0].memory.retention, "durable");
const recordedRuntime = importApp.buildRuntimeInput();
assert.equal(recordedRuntime.compiledSystemText.includes("A refined shared event"), false, "events enter runtime only through bounded retrieval, never as an all-record fallback");

// Per-contact conversation: an imported contact's chat lives under its own storage key,
// and the default contact-a conversation stays untouched.
const multiContext = { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => multiStored.get(key) ?? fallback, set: (key, value) => multiStored.set(key, value) } } };
const multiStored = new Map();
const multiApp = definition.create();
const multiRoot = new FakeElement("main");
multiApp.render(multiRoot, multiContext);
const multiContact = multiApp.importCharacterFromJson(JSON.stringify({ kind: "runtime-profile", displayName: "Lu", identity: "A cultured heir" }));
// Open that contact's conversation and send a message.
multiApp.openConversation(multiContact.id);
const getComposer = () => multiRoot.children[0].children[2];
const draft = getComposer().children[1];
draft.value = "How do you read the classics?";
draft.listeners.input();
getComposer().listeners.submit({ preventDefault() {} });
const importedKey = `conversation.${multiContact.id}.v1`;
assert.equal(multiStored.has(importedKey), true, "imported contact conversation persisted under its own key");
assert.equal(multiStored.get(importedKey).entries.at(-1).text, "How do you read the classics?");
assert.equal(multiStored.has("conversation.v1"), false, "contact-a's original conversation key untouched when chatting with another contact");
const portableChat = multiApp.conversationTransfer.export(multiApp.conversationTransferInput());
assert.equal(portableChat.filename, "Lu-chat.mercury.json", "Chat exposes the portable export workflow with a user-facing filename");
const importedChat = multiApp.importConversationFromJson(portableChat.text);
assert.ok(importedChat, "a Chat-exported conversation can be imported through the same app boundary");
assert.notEqual(importedChat.timelineId, "default", "re-import creates an independent timeline");
assert.equal(importedChat.conversation.entries.at(-1).text, "How do you read the classics?", "the app round trip keeps the transcript intact");
assert.equal(multiStored.get(importedKey).entries.at(-1).text, "How do you read the classics?", "re-import never overwrites the source timeline");
assert.equal(multiApp.ui.conversationTransferReceipt.entryCount, importedChat.entryCount, "a successful round trip records a persistent import receipt for the new timeline");
const roundTripReceipt = nodesWithClass(multiRoot.children[0], "mercury-chat-conversation-transfer-receipt")[0];
assert.equal(Boolean(roundTripReceipt), true, "the imported timeline visibly confirms completion inside the conversation");
assert.match(roundTripReceipt.children[1].textContent, /已新建独立会话/, "the receipt explains that the source timeline was not overwritten");

const degradedEnvelope = JSON.parse(portableChat.text);
degradedEnvelope.session.resourceBindings = {
  runtimeProfileId: "foreign-role",
  worldVariantId: "foreign-variant",
  worldBookMode: "explicit",
  worldBookIds: ["world-not-on-this-device"],
  presetId: "preset-not-on-this-device",
};
degradedEnvelope.session.settings.userPresetId = "preset-not-on-this-device";
const degradedStored = new Map();
const degradedApp = definition.create();
const degradedRoot = new FakeElement("main");
degradedApp.render(degradedRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => degradedStored.get(key) ?? fallback, set: (key, value) => degradedStored.set(key, value) } } });
const degradedImport = degradedApp.importConversationFromJson(JSON.stringify(degradedEnvelope));
assert.ok(degradedImport, "a transcript remains usable when optional source resources are absent locally");
assert.deepEqual(degradedImport.unresolvedBindings.worldBookIds, ["world-not-on-this-device"], "the workflow reports missing world resources instead of silently widening scope");
assert.equal(degradedImport.unresolvedBindings.presetId, "preset-not-on-this-device", "the workflow reports a missing Generation Profile while falling back safely");
const degradedReceipt = nodesWithClass(degradedRoot.children[0], "mercury-chat-conversation-transfer-receipt")[0];
assert.match(degradedReceipt.children[2].textContent, /1 本世界书未在本地找到/, "the visible receipt reports world-book degradation");
assert.match(degradedReceipt.children[2].textContent, /已使用默认预设/, "the visible receipt reports the working Profile fallback");
const inspectImportedResources = nodesWithClass(degradedReceipt, "mercury-chat-import-receipt__primary")[0];
assert.equal(inspectImportedResources.children.at(-1).textContent, "检查资源", "degraded import offers a visible recovery action");
inspectImportedResources.listeners.click();
assert.equal(degradedApp.ui.route, "conversationResources", "the recovery action opens the imported timeline's real resource settings");
multiApp.ui.route = "settings";
multiApp.paint();
const transferRows = nodesWithClass(multiRoot.children[0], "mercury-chat-settings-row");
assert.equal(transferRows.some((row) => row.children[0]?.textContent === "导出聊天文件" && row.children[1]?.textContent === "可再次导入"), true, "conversation settings distinguishes portable export");
assert.equal(transferRows.some((row) => row.children[0]?.textContent === "导出可读文本" && row.children[1]?.textContent === "仅供阅读"), true, "conversation settings labels text export as non-portable");
assert.equal(transferRows.some((row) => row.children[0]?.textContent === "导入聊天文件" && row.children[1]?.textContent === "新建会话"), true, "conversation settings promises conflict-safe import semantics");
// Header shows the imported contact's name, not contact-a.
multiApp.openConversation(multiContact.id);
const headerName = multiRoot.children[0].children[0].children[1].children[1].children[0];
assert.equal(headerName.textContent, "Lu", "conversation header names the active contact");
const contactHeaderControl = nodesWithClass(multiRoot.children[0], "mercury-chat-header__contact")[0];
assert.equal(Boolean(contactHeaderControl), true, "conversation header exposes the contact homepage entry");
contactHeaderControl.listeners.click();
assert.equal(multiApp.ui.route, "contact", "contact identity opens its homepage from the conversation");
multiApp.openConversation(multiContact.id);
const settingsHeaderControl = nodesWithClass(multiRoot.children[0], "mercury-chat-header__settings")[0];
assert.equal(Boolean(settingsHeaderControl), true, "conversation header exposes the current conversation settings entry");
settingsHeaderControl.listeners.click();
assert.equal(multiApp.ui.route, "settings", "header more action opens current conversation settings");
multiApp.openConversation(multiContact.id);
const historyHeaderControl = nodesWithClass(multiRoot.children[0], "mercury-chat-header__search")[0];
assert.equal(Boolean(historyHeaderControl), true, "conversation header exposes a direct chat-history search entry");
historyHeaderControl.listeners.click();
assert.equal(multiApp.ui.route, "historySearch", "header search opens the real history-search page");
multiApp.openConversation(multiContact.id);
assert.equal(nodesWithClass(multiRoot.children[0], "mercury-chat-header__attachments").length, 0, "conversation header does not duplicate composer attachments");
const attachmentComposerControl = nodesWithClass(multiRoot.children[0], "mercury-chat-composer__attachments-trigger")[0];
assert.equal(Boolean(attachmentComposerControl), true, "composer exposes the single attachment entry");
attachmentComposerControl.listeners.click();
assert.equal(multiApp.ui.panelOpen, true, "composer attachment entry opens the real content panel");
assert.equal(nodesWithClass(multiRoot.children[0], "mercury-chat-plus-panel__action").length, 2, "attachment panel contains only available image and emoji actions");
multiApp.ui.panelOpen = false;
multiApp.paint();

// A full legacy role card must survive the entire usable path: preflight,
// local contact binding, its own conversation, and runtime request assembly.
const fullCardRaw = fs.readFileSync(path.join(__dirname, "fixtures", "mercury-owned-complex-role-card.json"), "utf8");
const fullCardStored = new Map();
const fullCardApp = definition.create();
fullCardApp.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => fullCardStored.get(key) ?? fallback, set: (key, value) => fullCardStored.set(key, value) } } });
const fullCardReport = fullCardApp.preflightCharacterImport(fullCardRaw);
assert.equal(fullCardReport.ok, true, "full role card passes preflight");
assert.equal(fullCardReport.resourceKind, "roleCard", "full role card is recognized as a role card");
assert.equal(fullCardReport.migrations[0]?.code, "role_card_migrated", "full legacy role card reports its migration");
const fullCardContact = fullCardApp.importCharacterFromJson(fullCardRaw);
assert.equal(fullCardContact.name, "Avery Lane", "full role card becomes a named contact");
assert.equal(fullCardContact.persona.stableTraits.length, 5, "full role card preserves structured traits");
assert.equal(Object.keys(fullCardContact.persona.lore).length, 3, "full role card preserves structured domain material");
fullCardApp.openConversation(fullCardContact.id);
assert.equal(fullCardStored.has(`conversation.${fullCardContact.id}.v1`), false, "opening an imported contact does not create a transcript before a message is sent");
const fullCardRequest = fullCardApp.buildAssistantRequest({ id: "full-card-message", text: "Tell me about book repair." }, [], "full-card-request");
assert.match(fullCardRequest.systemPrompt, /emotionally steady/, "full role card traits reach the runtime request");
assert.match(fullCardRequest.systemPrompt, /support independent choices/, "full role card inner conflict reaches the runtime request");
assert.match(fullCardRequest.systemPrompt, /book repair/, "full role card domain material reaches the runtime request");

// Existing imports may have been saved before structured YAML extraction was
// available. Startup repair fills only missing/fallback fields from the saved
// source asset, preserving any user-edited values.
const repairRaw = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", name: "Repair Card", description: "```yaml\nCharacter:\n  identity:\n    - A formal office holder\n  personality:\n    default:\n      traits:\n        - Reserved\n  writing_rule: |\n    Keep distance appropriate for an early conversation.\n</info>" });
const repairStored = new Map();
const repairArchive = global.MercuryArchiveContracts.createArchiveState();
repairArchive.sourceAssets.push(global.MercuryArchiveContracts.createSourceAsset({ id: "repair-source", filename: "repair-card.json", mimeType: "application/json", rawText: repairRaw, userConfirmed: true }));
const repairProfile = global.MercuryArchiveContracts.createRuntimeProfile({ sourceAssetId: "repair-source", displayName: "Repair Card", data: { identity: "Imported character" } });
repairProfile.id = "repair-profile";
repairProfile.status = "ready";
repairArchive.runtimeProfiles.push(repairProfile);
repairArchive.contactInstances.push({ id: "repair-instance", runtimeProfileId: repairProfile.id, chatContactId: "repair-contact", displayName: repairProfile.displayName, relationshipState: "new", timelineId: "default", active: true });
repairStored.set(global.MercuryArchiveContracts.STORAGE_KEY, repairArchive);
const repairExperience = global.MercuryChatExperienceContracts.normalize(null);
repairExperience.contacts["repair-contact"] = { id: "repair-contact", name: "Repair Card", identity: "Imported character", relationship: "Imported character", avatar: "fallback.png", profileBackground: "fallback.png", runtimeProfileId: repairProfile.id, persona: { displayName: "Repair Card" }, sourceKind: "compatible-character-card" };
repairStored.set(global.MercuryChatExperienceContracts.STORAGE_KEY, repairExperience);
const repairApp = definition.create();
repairApp.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => repairStored.get(key) ?? fallback, set: (key, value) => repairStored.set(key, value) } } });
const repairedArchive = global.MercuryArchiveContracts.normalizeArchiveState(repairStored.get(global.MercuryArchiveContracts.STORAGE_KEY, null));
assert.equal(repairedArchive.runtimeProfiles[0].identity, "A formal office holder", "startup repair replaces an imported identity fallback from source data");
assert.deepEqual(repairedArchive.runtimeProfiles[0].stableTraits, ["Reserved"], "startup repair restores missing structured traits");
assert.match(repairedArchive.runtimeProfiles[0].voiceStyle, /Keep distance/, "startup repair restores missing structured voice guidance");
assert.equal(repairApp.experience.contacts["repair-contact"].identity, "A formal office holder", "startup repair updates the linked contact label without a re-import");
const chatSource = fs.readFileSync(path.join(__dirname, "..", "apps", "mercury-chat-app.js"), "utf8");
const repairBoundary = chatSource.match(/repairImportedRoleProfiles\(\) \{([\s\S]*?)\n    experienceFor\(/)?.[1] || "";
assert.match(repairBoundary, /archiveStore\.repairImportedRoleProfiles/, "Chat requests imported-role repair through the Archive Store interface");
assert.doesNotMatch(repairBoundary, /STORAGE_KEY|storage\.set|experienceStorage\.set/, "Chat does not directly persist canonical Archive state during repair");

// An embedded world book is stored as an independent archive world and bound
// to the imported role before this contact's runtime is compiled.
const embeddedWorldStored = new Map();
const embeddedWorldApp = definition.create();
embeddedWorldApp.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => embeddedWorldStored.get(key) ?? fallback, set: (key, value) => embeddedWorldStored.set(key, value) } } });
const embeddedWorldContact = embeddedWorldApp.importCharacterFromJson(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", name: "Card Three", description: "A person whose setting is local to this card.", data: { name: "Card Three", description: "A person whose setting is local to this card.", character_book: { name: "Card Three setting", entries: [{ id: "entry-gate", keys: ["gate"], comment: "Gate", content: "The gate is painted green.", constant: true, enabled: true }, { id: "entry-hidden", keys: ["gate"], comment: "Hidden", content: "This entry must stay disabled.", enabled: false }] } } }));
const embeddedArchive = global.MercuryArchiveContracts.normalizeArchiveState(embeddedWorldStored.get(global.MercuryArchiveContracts.STORAGE_KEY, null));
assert.equal(embeddedArchive.runtimeProfiles.some((profile) => profile.id === embeddedWorldContact.runtimeProfileId), true, "imported contact maps to a durable role profile");
assert.equal(embeddedArchive.worlds.length, 1, "embedded world is saved in the archive world system");
assert.equal(embeddedArchive.worlds[0].relatedProfileIds.includes(embeddedWorldContact.runtimeProfileId), true, "saved world links back to the imported role");
  assert.equal(embeddedWorldContact.worldBookIds.includes(embeddedArchive.worlds[0].id), true, "contact retains the linked world id");
  embeddedWorldApp.openConversation(embeddedWorldContact.id);
  assert.match(embeddedWorldApp.buildRuntimeInput().compiledSystemText, /The gate is painted green\./, "only the imported contact resolves its linked world into runtime context");
  assert.doesNotMatch(embeddedWorldApp.buildRuntimeInput().compiledSystemText, /This entry must stay disabled\./, "disabled linked world entries stay out of runtime context");
  const embeddedRequest = embeddedWorldApp.buildAssistantRequest({ id: "worldbook-runtime-check", text: "Should we meet at the gate?" }, [], "worldbook-runtime-check");
  assert.match(embeddedRequest.systemPrompt, /The gate is painted green\./, "the actual assistant request contains the active world-book entry");
  assert.equal(embeddedWorldApp.currentResourceRuntimeTrace().selectedEntries.some((entry) => entry.title === "Gate"), true, "the resource diagnostic reads the latest actual runtime trace");
  embeddedWorldApp.ui.route = "conversationResources";
  embeddedWorldApp.paint();
  let resourceWorldRows = nodesWithClass(embeddedWorldApp.root.children[0], "mercury-chat-resource-world");
  assert.equal(resourceWorldRows.length, 1, "conversation resources exposes each available archived world book");
  assert.equal(nodesWithClass(embeddedWorldApp.root.children[0], "mercury-chat-resource-worlds__mode").length, 2, "conversation resources offers inherited and session-only binding modes");
  const runtimeDiagnostics = nodesWithClass(embeddedWorldApp.root.children[0], "mercury-chat-resource-diagnostics");
  assert.equal(runtimeDiagnostics.length, 1, "conversation resources shows one scoped runtime diagnostic group");
  assert.equal(nodesWithClass(runtimeDiagnostics[0], "mercury-chat-settings-row--readonly").some((row) => row.children[0].textContent === "世界书命中" && /已进入运行时/.test(row.children[1].textContent)), true, "the diagnostic distinguishes actual world-book injection from a mere binding");
  resourceWorldRows[0].listeners.click();
  assert.deepEqual(embeddedWorldApp.experienceFor(embeddedWorldContact.id).resourceBindings.worldBookIds, [], "world-book switch writes an explicit empty session binding");
  resourceWorldRows = nodesWithClass(embeddedWorldApp.root.children[0], "mercury-chat-resource-world");
  resourceWorldRows[0].listeners.click();
  assert.deepEqual(embeddedWorldApp.experienceFor(embeddedWorldContact.id).resourceBindings.worldBookIds, [embeddedArchive.worlds[0].id], "world-book switch restores the selected resource for this session");

// Chat list iterates all contacts; clicking an imported thread opens that conversation.
multiApp.ui.route = "chats";
multiApp.paint();
const multiThreads = nodesWithClass(multiRoot.children[0], "mercury-chat-list__threads")[0];
assert.equal(multiThreads.children.length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length + 2, "chat list shows the imported contact's source and re-imported timelines without collapsing them");
const luThread = Array.prototype.find.call(multiThreads.children, (t) => t.dataset.contactId === multiContact.id && t.dataset.timelineId === "default");
assert.equal(Boolean(luThread), true);
luThread.listeners.click();
assert.equal(multiApp.ui.selectedContactId, multiContact.id);
assert.equal(multiApp.ui.route, "conversation");
assert.equal(headerName.textContent, "Lu", "header follows the opened thread");

// Delete (single message): removing an assistant turn drops that turn's entry
// from the conversation and clears the selected-message highlight.
const fakeTurnId = "assistant-regen-test-turn";
multiApp.conversation = { ...multiApp.conversation, entries: [...multiApp.conversation.entries, { id: fakeTurnId, role: "assistant", parts: [{ id: "part-regen-1", text: "A reply.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:00:00.000Z", usage: null, unspokenAside: null, legacyMessageId: fakeTurnId }] };
const delMessageId = fakeTurnId;
multiApp.ui.selectedMessageId = delMessageId;
multiApp.deleteMessage({ id: delMessageId });
assert.equal(multiApp.conversation.entries.some((entry) => entry.id === fakeTurnId), false, "assistant turn removed from conversation");
assert.equal(multiApp.conversation.entries.some((entry) => entry.role === "user"), true, "user message retained after deleting one reply");
assert.equal(multiApp.ui.selectedMessageId, null, "selected message highlight cleared after delete");

// Delete a user message by its own id.
multiApp.deleteMessage({ id: multiStored.get(importedKey).entries[0].id });
assert.equal(multiApp.conversation.entries.some((entry) => entry.role === "user" && entry.text === "How do you read the classics?"), false, "user message removed by id");

// Regenerate keeps a versioned replacement on the same assistant turn. Later
// records remain intact and the user can switch back to the original version.
const regenStored = new Map();
const regenTransport = { chat: async (payload) => ({ assistantTurn: { id: "turn-regen-2", role: "assistant", parts: [{ id: "part-regen-2", text: "A regenerated reply.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:01:00.000Z", usage: null, unspokenAside: null }, memoryCandidates: [], warnings: [] }) };
const regenApp = definition.create();
regenApp.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => regenStored.get(key) ?? fallback, set: (key, value) => regenStored.set(key, value) }, aiTransport: regenTransport } });
regenApp.ui.selectedContactId = "contact-a";
regenApp.conversation = { ...regenApp.conversation, entries: [ { id: "user-regen-1", role: "user", text: "Ask again.", createdAt: "2026-08-02T00:02:00.000Z", delivery: "complete", replyToId: null }, { id: "turn-regen-old", role: "assistant", parts: [{ id: "part-regen-old", text: "Old reply.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:03:00.000Z", usage: null, unspokenAside: null, legacyMessageId: "turn-regen-old" }, { id: "user-after-regen", role: "user", text: "Keep this later message.", createdAt: "2026-08-02T00:04:00.000Z", delivery: "complete", replyToId: null } ] };
regenApp.conversation = { ...regenApp.conversation, settings: { ...global.MercuryChatContracts.DEFAULT_SETTINGS } };
regenApp.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(regenApp.conversation));
regenApp.persistMessages();
(async () => {
  await regenApp.regenerateMessage({ id: "turn-regen-old" });
  const regeneratedEntry = regenApp.conversation.entries.find((entry) => entry.id === "turn-regen-old");
  assert.equal(regenApp.conversation.entries.length, 3, "regeneration never truncates records after the selected reply");
  assert.equal(regenApp.conversation.entries.at(-1).id, "user-after-regen", "later timeline entries stay in place");
  assert.equal(regeneratedEntry.parts.some((part) => part.text.includes("regenerated")), true, "the active reply updates to regenerated text");
  assert.equal(regeneratedEntry.versions.length, 2, "the original reply and regenerated reply are persisted as versions");
  assert.equal(regeneratedEntry.activeVersionId, "turn-regen-2", "the new reply becomes the active version");
  assert.equal(regeneratedEntry.versions[0].parts[0].text, "Old reply.", "the original reply remains recoverable");
  assert.equal(regenApp.selectAssistantVersion({ id: "turn-regen-2", turnId: "turn-regen-old" }, "turn-regen-old"), true, "a stored version can be selected again");
  assert.equal(regenApp.conversation.entries.find((entry) => entry.id === "turn-regen-old").parts[0].text, "Old reply.", "switching version restores the original content");

  // Copy uses an actual clipboard write path, while quote stores a source snapshot
  // on the new user entry so the quote survives deletion of its source message.
  const actionStored = new Map();
  const copiedTexts = [];
  const actionApp = definition.create();
  const actionRoot = new FakeElement("main");
  actionApp.render(actionRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => actionStored.get(key) ?? fallback, set: (key, value) => actionStored.set(key, value) }, clipboard: { writeText: async (text) => { copiedTexts.push(text); } } } });
  actionApp.conversation = { ...actionApp.conversation, entries: [{ id: "quoted-assistant", role: "assistant", parts: [{ id: "quoted-assistant-part", text: "Please keep this sentence.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:06:00.000Z", usage: null, unspokenAside: null, legacyMessageId: "quoted-assistant" }] };
  actionApp.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(actionApp.conversation));
  actionApp.ui.route = "conversation";
  actionApp.paint();
  assert.equal(await actionApp.copyMessage(actionApp.messages[0]), true, "copy reports success only after the clipboard path completes");
  assert.deepEqual(copiedTexts, ["Please keep this sentence."], "copy writes the message text to the clipboard service");
  assert.equal(actionApp.quoteMessage(actionApp.messages[0]), true, "quote opens a persisted reply draft");
  assert.equal(actionRoot.children[0].children[2].children[0].className, "mercury-chat-composer__quote", "the composer displays the selected quote before sending");
  actionApp.saveDraft("I want to respond to this.");
  assert.equal(actionApp.submitDraft(), true, "a quoted draft queues like an ordinary user message");
  const quotedUser = actionApp.conversation.entries.at(-1);
  assert.deepEqual(quotedUser.quote, { messageId: "quoted-assistant", author: "assistant", content: "Please keep this sentence." }, "quote source snapshot is stored with the outgoing message");
  assert.equal(quotedUser.replyToId, "quoted-assistant", "quote keeps the source id for in-timeline navigation");
  assert.equal(actionApp.deleteMessage({ id: "quoted-assistant" }), true, "the quoted source can be deleted independently");
  assert.deepEqual(actionApp.conversation.entries[0].quote, quotedUser.quote, "deleting a source does not erase its persisted quote preview");

  // Mobile message actions reuse the same commands as the existing inline
  // toolbar. Gesture tests control the clock directly so timing assertions do
  // not depend on a slow or heavily loaded test runner.
  const gestureTimers = controlledTimers();
  let gestureNow = 1000;
  const gestureStored = new Map();
  const gestureApp = definition.create({
    scheduleTimeout: (callback, delay) => gestureTimers.schedule(callback, delay),
    cancelTimeout: (id) => gestureTimers.cancel(id),
    now: () => gestureNow,
  });
  const gestureRoot = new FakeElement("main");
  gestureApp.render(gestureRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => gestureStored.get(key) ?? fallback, set: (key, value) => gestureStored.set(key, value) }, clipboard: { writeText: async () => {} } } });
  gestureApp.conversation = { ...gestureApp.conversation, entries: [
    { id: "gesture-user-complete", role: "user", text: "A complete message.", createdAt: "2026-08-02T00:06:00.000Z", delivery: "complete", replyToId: null },
    { id: "gesture-assistant", role: "assistant", parts: [{ id: "gesture-assistant-part", text: "A reply target.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:06:01.000Z", usage: null, unspokenAside: null, legacyMessageId: "gesture-assistant" },
    { id: "gesture-user-failed", role: "user", text: "A failed message.", createdAt: "2026-08-02T00:06:02.000Z", delivery: "failed", replyToId: null },
  ], settings: { ...global.MercuryChatContracts.DEFAULT_SETTINGS } };
  gestureApp.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(gestureApp.conversation));
  gestureApp.ui.route = "conversation";
  gestureApp.paint();

  let gestureBubbles = nodesWithClass(gestureRoot.children[0], "mercury-chat-bubble");
  const shortTapBubble = gestureBubbles[0];
  shortTapBubble.listeners.pointerdown({ pointerId: 1, button: 0, clientX: 20, clientY: 20 });
  shortTapBubble.listeners.pointerup({ pointerId: 1, clientX: 20, clientY: 20 });
  shortTapBubble.listeners.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(gestureApp.ui.selectedMessageId, "gesture-user-complete", "short tap retains the existing inline-toolbar selection behavior");
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 0, "short tap does not open the mobile action sheet");

  gestureApp.ui.selectedMessageId = null;
  gestureApp.paint();
  gestureBubbles = nodesWithClass(gestureRoot.children[0], "mercury-chat-bubble");
  const heldBubble = gestureBubbles[0];
  heldBubble.listeners.pointerdown({ pointerId: 2, button: 0, clientX: 24, clientY: 30 });
  assert.equal(gestureTimers.pending(), 1, "pointerdown arms exactly one long-press timer");
  gestureTimers.fireNext();
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 1, "a stationary intentional long press opens one action sheet");
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet__action--retry").length, 0, "complete user messages do not expose Retry");
  gestureTimers.fireAll();
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 1, "the same hold cannot open the sheet twice");
  heldBubble.listeners.click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(gestureApp.ui.selectedMessageId, null, "the synthetic click after a completed long press does not toggle the inline toolbar");
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 1, "synthetic-click suppression leaves the opened sheet in place");
  nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet__backdrop")[0].listeners.click();
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 0, "tapping outside dismisses the action sheet");

  gestureNow += 1000;
  let expiredContextMenuPrevented = false;
  heldBubble.listeners.contextmenu({ preventDefault() { expiredContextMenuPrevented = true; } });
  assert.equal(expiredContextMenuPrevented, false, "expired click suppression does not disable later desktop context-menu behavior");

  gestureBubbles = nodesWithClass(gestureRoot.children[0], "mercury-chat-bubble");
  const movedBubble = gestureBubbles[0];
  movedBubble.listeners.pointerdown({ pointerId: 3, button: 0, clientX: 10, clientY: 10 });
  movedBubble.listeners.pointermove({ pointerId: 3, clientX: 23, clientY: 10 });
  gestureTimers.fireAll();
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 0, "movement beyond the threshold cancels long press");

  movedBubble.listeners.pointerdown({ pointerId: 4, button: 0, clientX: 10, clientY: 10 });
  nodesWithClass(gestureRoot.children[0], "mercury-chat-messages")[0].listeners.scroll();
  gestureTimers.fireAll();
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 0, "vertical conversation scrolling cancels long press");

  movedBubble.listeners.pointerdown({ pointerId: 5, button: 0, clientX: 10, clientY: 10 });
  assert.equal(movedBubble.dataset.longPress, "pending", "pending hold suppresses selection only on its own bubble");
  movedBubble.listeners.pointercancel({ pointerId: 5 });
  assert.equal(gestureApp.messagePress, null, "pointercancel clears controller gesture state");
  assert.equal(movedBubble.dataset.longPress, undefined, "pointercancel removes the temporary pressed marker");

  gestureBubbles = nodesWithClass(gestureRoot.children[0], "mercury-chat-bubble");
  const assistantBubble = gestureBubbles[1];
  assistantBubble.listeners.pointerdown({ pointerId: 6, button: 0, clientX: 18, clientY: 18 });
  gestureTimers.fireNext();
  let sheetActions = nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet__action");
  assert.equal(sheetActions.some((node) => String(node.className).includes("--regenerate")), true, "assistant sheet exposes Regenerate through the existing permission");
  assert.equal(sheetActions.some((node) => String(node.className).includes("--retry")), false, "assistant sheet does not invent a Retry permission");
  nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet__action--quote")[0].listeners.click();
  assert.equal(gestureApp.ui.replyingTo.messageId, "gesture-assistant", "Quote from long press reaches the existing quote command");
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-composer__quote").length, 1, "long-press Quote opens the existing composer quote preview");
  gestureApp.clearQuote();

  gestureBubbles = nodesWithClass(gestureRoot.children[0], "mercury-chat-bubble");
  const failedBubble = gestureBubbles[2];
  failedBubble.listeners.pointerdown({ pointerId: 7, button: 0, clientX: 18, clientY: 18 });
  gestureTimers.fireNext();
  sheetActions = nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet__action");
  assert.equal(sheetActions.some((node) => String(node.className).includes("--retry")), true, "failed user sheet exposes Retry through the existing permission");
  assert.equal(sheetActions.some((node) => String(node.className).includes("--regenerate")), false, "failed user sheet does not expose Regenerate");
  nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet-overlay")[0].listeners.keydown({ key: "Escape", preventDefault() {} });
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 0, "Escape dismisses the phone action sheet");

  gestureNow += 1000;
  gestureBubbles = nodesWithClass(gestureRoot.children[0], "mercury-chat-bubble");
  const deletableBubble = gestureBubbles[0];
  deletableBubble.listeners.pointerdown({ pointerId: 8, button: 0, clientX: 18, clientY: 18 });
  gestureTimers.fireNext();
  nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet__action--delete")[0].listeners.click();
  assert.equal(gestureApp.conversation.entries.some((entry) => entry.id === "gesture-user-complete"), false, "Delete from the sheet retains the existing delete semantics");
  assert.equal(nodesWithClass(gestureRoot.children[0], "mercury-chat-action-sheet").length, 0, "choosing an action dismisses the sheet");

  // P1 rich messages use explicit local parts. Emoji contributes text for the
  // normal provider request; an image-only entry persists and renders locally
  // without claiming that a text-only provider has seen the image.
  const imagePart = { id: "image-part-1", type: "image", src: "data:image/png;base64,iVBORw0KGgo=", mimeType: "image/png", size: 8, alt: "Local test image" };
  assert.equal(actionApp.stageComposerPart(imagePart), true, "a supported local image can be staged in the composer");
  assert.equal(actionApp.addEmojiPart("✨"), true, "an emoji is staged as a distinct rich part");
  assert.equal(nodesWithClass(actionRoot.children[0], "mercury-chat-composer__attachment").length, 2, "the composer previews staged image and emoji parts before sending");
  assert.equal(actionApp.submitDraft(), true, "rich parts can be submitted without an additional text draft");
  const richUser = actionApp.conversation.entries.at(-1);
  assert.equal(richUser.text, "✨", "emoji contributes the text fallback sent to the provider");
  assert.deepEqual(richUser.parts.map((part) => part.type), ["image", "emoji"], "rich user entries persist typed parts in order");
  const richRow = nodesWithClass(actionRoot.children[0], "mercury-chat-message").at(-1);
  assert.equal(nodesWithClass(richRow, "mercury-chat-bubble__image").length, 1, "a sent image part renders as an image bubble element");
  assert.equal(nodesWithClass(richRow, "mercury-chat-bubble__emoji").length, 1, "a sent emoji part renders as an emoji bubble element");
  const imageOnlyStored = new Map();
  let imageOnlyTransportCalls = 0;
  const imageOnlyApp = definition.create();
  imageOnlyApp.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => imageOnlyStored.get(key) ?? fallback, set: (key, value) => imageOnlyStored.set(key, value) }, aiTransport: { chat: async () => { imageOnlyTransportCalls += 1; return null; } } } });
  assert.equal(imageOnlyApp.stageComposerPart({ ...imagePart, id: "image-only-part" }), true);
  assert.equal(imageOnlyApp.submitDraft(), true, "an image-only message is retained locally");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(imageOnlyTransportCalls, 0, "an image-only message does not trigger a fabricated text-only AI request");
  assert.equal(imageOnlyApp.conversation.entries.at(-1).text, "", "image-only entries may intentionally have no provider text fallback");

  // Inner voice renders as its own OS bubble when the assistant turn has one.
  const asideStored = new Map();
  const asideTransport = { chat: async (payload) => ({ assistantTurn: { id: "turn-aside-1", role: "assistant", parts: [{ id: "part-aside-1", text: "说出口的话。", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:05:00.000Z", usage: null, unspokenAside: "这是没出口的心里话。" }, memoryCandidates: [], warnings: [] }) };
  const asideApp = definition.create();
  const asideRoot = new FakeElement("main");
  asideApp.render(asideRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => asideStored.get(key) ?? fallback, set: (key, value) => asideStored.set(key, value) }, aiTransport: asideTransport } });
  asideApp.ui.selectedContactId = "contact-a";
  asideApp.ui.route = "conversation";
  asideApp.paint();
  const asideComposer = asideRoot.children[0].children[2];
  const asideDraft = asideComposer.children[1];
  asideDraft.value = "说句话";
  asideDraft.listeners.input();
  asideComposer.listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  asideApp.paint();
  const asideNodes = (function collect(n, acc) { (n.children || []).forEach((c) => { if (String(c.className).includes("mercury-chat-aside")) acc.push(c); collect(c, acc); }); return acc; })(asideRoot.children[0], []);
  assert.equal(asideNodes.length >= 1, true, "inner voice renders its own OS bubble");
  assert.ok(asideNodes.some((n) => String(n.textContent || "").includes("这是没出口的心里话。")), "OS bubble carries the aside text");
  assert.equal(asideNodes.some((n) => String(n.textContent || "").includes("说出口的话。")), false, "aside bubble holds only the inner thought");
  assert.equal(nodesWithClass(asideRoot.children[0], "mercury-chat-message__stack").length >= 1, true, "assistant bubble and inner voice share one content stack");
  const groupedAssistantRow = asideApp.messageView({ id: "grouped-assistant", role: "assistant", content: "Grouped reply.", createdAt: "2026-08-02T00:05:30.000Z", delivery: "complete" }, null, false);
  assert.equal(nodesWithClass(groupedAssistantRow, "mercury-chat-message__avatar--placeholder").length, 1, "grouped assistant turns reserve the avatar column");
  asideApp.ui.selectedMessageId = "grouped-assistant";
  const selectedAssistantRow = asideApp.messageView({ id: "grouped-assistant", role: "assistant", content: "Grouped reply.", createdAt: "2026-08-02T00:05:30.000Z", delivery: "complete" }, null, false);
  const selectedStack = nodesWithClass(selectedAssistantRow, "mercury-chat-message__stack")[0];
  const selectedActions = nodesWithClass(selectedAssistantRow, "mercury-chat-message__actions")[0];
  assert.equal(Boolean(selectedActions), true, "a selected message exposes its real operations");
  assert.equal(selectedStack.children.includes(selectedActions), true, "message operations remain below the bubble inside its stack");
  assert.equal(selectedAssistantRow.children.includes(selectedActions), false, "message operations never occupy a sibling grid column beside the text");
  assert.equal(nodesWithClass(selectedActions, "mercury-chat-icon").length, 4, "selected assistant operations use compact semantic icons instead of overflowing text buttons");
  const actionIconSources = nodesWithClass(selectedActions, "mercury-chat-icon").map((icon) => icon.src).join(" ");
  assert.match(actionIconSources, /quote-message\.svg/, "the quote operation resolves through the shared semantic icon map");
  assert.match(actionIconSources, /refresh-double\.svg/, "regeneration resolves through the shared semantic icon map");
  const composerIconNames = Array.from(asideComposer.children).map((child) => child.children?.[0]?.src || "").join(" ");
  assert.match(composerIconNames, /attachment\.svg/, "composer exposes its real attachment action with the attachment icon");
  assert.match(composerIconNames, /send\.svg/, "composer uses a send icon rather than a microphone or generic airplane icon");

  // Runtime request snapshot: visible conversation settings alter the real
  // aiTransport payload, including context windowing and compiled behavior rules.
  const runtimeStored = new Map();
  runtimeStored.set("chat-experience.v1", { schemaVersion: 1, user: {}, contacts: { "contact-a": global.MercuryChatExperienceContracts.DEFAULT_CONTACT }, conversations: { "contact-a:default": { settings: { contextScope: "compact", memoryHandling: "confirm", timeFlow: "narrative", initiative: "high", relationshipPace: "slow", dramaticIntensity: "daily", unspokenAside: "off" } } } });
  const capturedPayloads = [];
  const runtimeTransport = { chat: async (payload) => { capturedPayloads.push(payload); return { assistantTurn: { id: "turn-runtime-1", role: "assistant", parts: [{ id: "part-runtime-1", text: "Runtime reply.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:06:00.000Z", usage: null, unspokenAside: null }, memoryCandidates: [], warnings: [] }; } };
  const runtimeApp = definition.create();
  const runtimeRoot = new FakeElement("main");
  const runtimeStorage = { get: (key, fallback) => runtimeStored.get(key) ?? fallback, set: (key, value) => runtimeStored.set(key, value) };
  runtimeApp.render(runtimeRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: runtimeStorage, aiTransport: runtimeTransport } });
  const manyEntries = Array.from({ length: 12 }, (_, index) => ({ id: `old-user-${index + 1}`, role: "user", text: `Old ${index + 1}`, createdAt: "2026-08-02T00:00:00.000Z", delivery: "complete", replyToId: null }));
  runtimeApp.conversation = { ...runtimeApp.conversation, entries: manyEntries, settings: { ...global.MercuryChatContracts.DEFAULT_SETTINGS } };
  runtimeApp.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(runtimeApp.conversation));
  runtimeApp.ui.route = "conversation";
  runtimeApp.paint();
  const runtimeComposer = runtimeRoot.children[0].children[2];
  runtimeComposer.children[1].value = "Use the current settings.";
  runtimeComposer.children[1].listeners.input();
  runtimeComposer.listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const runtimePayload = capturedPayloads[0];
  assert.equal(runtimePayload.recentMessages.length, 6, "compact context sends only the compact window");
  assert.equal(runtimePayload.recentMessages[0].id, "old-user-7", "compact context excludes older history from the pre-send snapshot");
  assert.equal(runtimePayload.userMessage.text, "Use the current settings.", "current user message is sent outside the history window");
  assert.deepEqual(runtimePayload.experienceSettings, { timeFlow: "narrative", initiative: "high", relationshipPace: "slow", dramaticIntensity: "daily", unspokenAside: "off", contextScope: "compact", memoryHandling: "confirm", userPresetId: "preset-default" }, "normalized experience settings are part of the real request contract");
  assert.match(runtimePayload.systemPrompt, /Context scope: compact/);
  assert.match(runtimePayload.systemPrompt, /Memory handling: do not use historical event data/);
  assert.match(runtimePayload.systemPrompt, /Time flow: treat time as narrative scene time/);
  assert.match(runtimePayload.systemPrompt, /Unspoken aside: do not output inner voice content/);

  // Missing current-tab credentials are rejected before persistence. The
  // composer draft stays intact and the visible recovery panel can deep-link
  // to Settings or retry after the same-tab credential becomes available.
  const preflightStored = new Map();
  const preflightLaunchCalls = [];
  let preflightReady = false;
  let preflightChatCalls = 0;
  const preflightTransport = {
    connectionStatus: () => preflightReady
      ? { ready: true }
      : { ready: false, code: "AI_CONNECTION_API_KEY_REQUIRED", message: "当前标签页缺少 API Key，请在 AI 连接中重新填写。", retryable: false, recovery: "ai-connection" },
    chat: async () => {
      preflightChatCalls += 1;
      return { assistantTurn: { id: "turn-preflight-ui", role: "assistant", parts: [{ id: "turn-preflight-ui-part", text: "Same-tab connection works.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:07:00.000Z", usage: null, unspokenAside: null }, memoryCandidates: [], warnings: [] };
    },
  };
  const preflightApp = definition.create();
  const preflightRoot = new FakeElement("main");
  preflightApp.render(preflightRoot, { state: {}, i18n: { t: (key) => key }, services: {
    storage: { get: (key, fallback) => preflightStored.get(key) ?? fallback, set: (key, value) => preflightStored.set(key, value) },
    aiTransport: preflightTransport,
    launchApp: (appId, route) => { preflightLaunchCalls.push({ appId, route }); return true; },
  } });
  preflightApp.ui.route = "conversation";
  preflightApp.paint();
  const preflightComposer = preflightRoot.children[0].children[2];
  preflightComposer.children[1].value = "Keep this unsent draft.";
  preflightComposer.children[1].listeners.input();
  preflightComposer.listeners.submit({ preventDefault() {} });
  assert.equal(preflightChatCalls, 0, "missing current-tab credentials never reach the provider");
  assert.equal(preflightApp.conversation.entries.some((entry) => entry.text === "Keep this unsent draft."), false, "preflight failure never persists a phantom user turn");
  assert.equal(preflightApp.ui.draft, "Keep this unsent draft.", "preflight failure preserves the exact composer draft");
  const preflightPanel = nodesWithClass(preflightRoot, "mercury-chat-generation-error")[0];
  assert.equal(Boolean(preflightPanel), true, "configuration failure is visible inside the conversation");
  assert.equal(preflightPanel.children[0].children[0].textContent, "需要检查 AI 连接");
  assert.match(preflightPanel.children[0].children[1].textContent, /API Key/);
  const preflightActions = preflightPanel.children[1].children;
  assert.equal(preflightActions[0].children.at(-1).textContent, "前往 AI 连接", "the Settings recovery action has a visible text label");
  assert.equal(preflightActions[1].children.at(-1).textContent, "重新发送", "the retry action has a visible text label");
  preflightActions[0].listeners.click();
  assert.deepEqual(preflightLaunchCalls, [{ appId: "settings", route: "ai-connection" }], "the recovery action opens the exact Settings route");
  preflightReady = true;
  preflightActions[1].listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(preflightChatCalls, 1, "retry performs exactly one provider request after configuration is ready");
  assert.equal(preflightApp.ui.draft, "", "a retry clears the draft only after the send is accepted");
  assert.equal(preflightApp.conversation.entries.at(-1).id, "turn-preflight-ui");

  // P0 send lifecycle: one active request per conversation, explicit cancel,
  // and a failed/cancelled user turn can be retried without duplicating it.
  const responseForLifecycle = (id, text) => ({ assistantTurn: { id, role: "assistant", parts: [{ id: `${id}-part`, text, order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-02T00:07:00.000Z", usage: null, unspokenAside: null }, memoryCandidates: [], warnings: [] });

  const failureStored = new Map();
  let failureCalls = 0;
  let failureOptions = null;
  const failureTransport = { chat: async (payload, options) => { failureCalls += 1; failureOptions = options; if (failureCalls === 1) throw new Error("Provider unavailable."); return responseForLifecycle("turn-retry-1", "Retry succeeded."); } };
  const failureApp = definition.create();
  const failureRoot = new FakeElement("main");
  failureApp.render(failureRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => failureStored.get(key) ?? fallback, set: (key, value) => failureStored.set(key, value) }, aiTransport: failureTransport } });
  failureApp.ui.route = "conversation";
  failureApp.paint();
  const failureComposer = failureRoot.children[0].children[2];
  failureComposer.children[1].value = "This should retry.";
  failureComposer.children[1].listeners.input();
  failureComposer.listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(failureCalls, 1, "first send creates one provider request");
  assert.equal(Boolean(failureOptions?.signal), true, "send passes an abort signal to the transport");
  assert.equal(failureApp.conversation.entries.at(-1).delivery, "failed", "provider failure is persisted on the user turn");
  assert.equal(nodesWithClass(failureRoot, "mercury-chat-delivery-label--failed")[0].textContent, "发送失败，可重试", "failed delivery is explained with a visible retry cue");
  assert.equal(nodesWithClass(failureRoot, "mercury-chat-generation-error__copy")[0].children[0].textContent, "角色回复失败", "provider failure uses product language instead of workflow terminology");
  const userCountBeforeRetry = failureApp.conversation.entries.filter((entry) => entry.role === "user").length;
  const retryAction = nodesWithClass(failureRoot, "mercury-chat-message__action").find((node) => String(node.className).includes("--retry"));
  assert.equal(Boolean(retryAction), true, "failed user turns expose a retry action");
  retryAction.listeners.click({ stopPropagation() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(failureCalls, 2, "retry creates exactly one new provider request");
  assert.equal(failureApp.conversation.entries.filter((entry) => entry.role === "user").length, userCountBeforeRetry, "retry does not duplicate the user turn");
  assert.equal(failureApp.conversation.entries.at(-1).role, "assistant", "successful retry appends one assistant turn");

  let resolvePending = null;
  let pendingCalls = 0;
  let pendingOptions = null;
  const pendingTransport = { chat: async (_payload, options) => { pendingCalls += 1; pendingOptions = options; return new Promise((resolve) => { resolvePending = resolve; }); } };
  const pendingApp = definition.create();
  const pendingRoot = new FakeElement("main");
  const pendingStored = new Map();
  pendingApp.render(pendingRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => pendingStored.get(key) ?? fallback, set: (key, value) => pendingStored.set(key, value) }, aiTransport: pendingTransport } });
  pendingApp.ui.route = "conversation";
  pendingApp.paint();
  assert.deepEqual(pendingApp.messageDeliveryPresentation({ id: "queued-preview", delivery: "queued" }), { label: "正在发送", tone: "pending", visible: true, showMark: true }, "queued delivery maps to the waiting-to-begin presentation before generation starts");
  const pendingComposer = pendingRoot.children[0].children[2];
  pendingComposer.children[1].value = "Cancel this request.";
  pendingComposer.children[1].listeners.input();
  pendingComposer.listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pendingApp.ui.pending, true, "pending state stays active while provider is unresolved");
  assert.equal(nodesWithClass(pendingRoot, "mercury-chat-delivery-label--pending").length, 0, "the waiting label becomes quiet once the Character generation phase is active");
  assert.equal(nodesWithClass(pendingRoot, "mercury-chat-typing__label")[0].textContent, `${pendingApp.activeContact().name}正在回复`, "active generation is labeled as the Character replying");
  const cancelButton = pendingRoot.children[0].children[2].children[2];
  assert.equal(cancelButton.type, "button", "pending composer replaces send with a cancel button");
  assert.equal(cancelButton.getAttribute?.("aria-label") || cancelButton["aria-label"], "停止回复");
  pendingApp.ui.draft = "Duplicate attempt";
  assert.equal(pendingApp.submitDraft(), false, "duplicate submit is ignored while a request is active");
  assert.equal(pendingCalls, 1, "duplicate submit does not call the provider twice");
  cancelButton.listeners.click();
  assert.equal(pendingOptions.signal.aborted, true, "cancel aborts the active transport signal");
  assert.equal(pendingApp.ui.pending, false, "cancel immediately clears pending state");
  assert.equal(pendingApp.conversation.entries.at(-1).delivery, "cancelled", "cancel persists a distinct cancelled delivery state");
  assert.equal(nodesWithClass(pendingRoot, "mercury-chat-delivery-label--cancelled")[0].textContent, "已取消，可重试", "cancelled delivery remains visibly retryable");
  assert.equal(nodesWithClass(pendingRoot, "mercury-chat-message__action--retry").length, 1, "cancelled presentation does not change existing retry eligibility");
  resolvePending(responseForLifecycle("turn-cancelled-late", "Late response ignored."));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(pendingApp.conversation.entries.some((entry) => entry.id === "turn-cancelled-late"), false, "late response after cancel is ignored");

  // P0 conversation list: the plus action opens a contact chooser, starting a
  // chat creates an independent empty timeline, and thread state is reflected
  // in sorting, visibility, and accessible status labels.
  const listStored = new Map();
  const listApp = definition.create();
  const listRoot = new FakeElement("main");
  listApp.render(listRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => listStored.get(key) ?? fallback, set: (key, value) => listStored.set(key, value) } } });
  const initialFilters = nodesWithClass(listRoot.children[0], "mercury-chat-list__filter");
  assert.equal(initialFilters.length, 0, "chat list does not render a redundant status filter row");
  assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-list__filters").length, 0, "chat list has no filter navigation container");
  const initialThread = nodesWithClass(listRoot.children[0], "mercury-chat-thread")[0];
  const moreButton = nodesWithClass(initialThread, "mercury-chat-thread__more")[0];
  moreButton.listeners.click();
  assert.equal(String(nodesWithClass(listRoot.children[0], "mercury-chat-thread")[0].className).includes("mercury-chat-thread--menu-open"), true, "the opened thread is raised above neighboring rows so every menu action can receive a tap");
assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-thread__menu")[0].children.length, 4, "thread more menu exposes list controls and a contact-home entry");
  nodesWithClass(listRoot.children[0], "mercury-chat-thread__more")[0].listeners.click();
  nodesWithClass(listRoot.children[0], "mercury-chat-list__add")[0].listeners.click();
  assert.equal(listApp.ui.route, "newConversation", "new conversation opens the contact chooser");
  assert.equal(listRoot.children[0].className.includes("mercury-chat-new-conversation-page"), true, "contact chooser is a real page");
  const chooserRows = nodesWithClass(listRoot.children[0], "mercury-chat-new-conversation__contact");
  assert.equal(chooserRows.length, global.MercuryChatExperienceContracts.DEFAULT_CONTACTS.length, "contact chooser lists the starter roster");
  assert.equal(chooserRows[0].children.length, 3, "contact chooser card has avatar, copy, and start action without a redundant icon column");
  chooserRows[0].listeners.click();
  assert.equal(listApp.ui.route, "conversation", "starting a conversation opens the empty chat");
  assert.notEqual(listApp.activeTimelineId(), "default", "new chat gets an independent timeline");
  assert.equal(listApp.messages.length, 0, "new chat starts empty");
  const newTimelineKey = listApp.conversationKeyFor(listApp.activeContactId(), listApp.activeTimelineId());
  assert.equal(listStored.has(newTimelineKey), true, "new empty conversation is persisted");
  const newTimelineState = listApp.experienceFor(listApp.activeContactId(), listApp.activeTimelineId());
  newTimelineState.pinned = true;
  newTimelineState.muted = true;
  newTimelineState.unread = true;
  listApp.saveExperience();
  listApp.ui.route = "chats";
  listApp.paint();
  const orderedThreads = nodesWithClass(listRoot.children[0], "mercury-chat-list__threads")[0];
  const firstThread = nodesWithClass(orderedThreads, "mercury-chat-thread")[0];
  assert.equal(firstThread.dataset.timelineId, listApp.activeTimelineId(), "pinned thread sorts before the default thread");
  assert.equal(String(firstThread.className).includes("mercury-chat-thread--pinned"), true, "pinned state is visible on the thread");
  assert.equal(String(firstThread.className).includes("mercury-chat-thread--muted"), true, "muted state is visible on the thread");
  listApp.ui.showHidden = true;
  assert.equal(listApp.setConversationListState("contact-a", listApp.activeTimelineId(), "hidden", true), true, "thread actions persist a hidden state");
  assert.equal(listApp.ui.showHidden, false, "hiding a thread returns to the ordinary list instead of leaving the hidden item visible");
  listApp.paint();
  const hiddenToggle = nodesWithClass(listRoot.children[0], "mercury-chat-list__hidden-button")[0];
  assert.equal(Boolean(hiddenToggle), true, "hidden conversations are reached from the compact eye control");
  hiddenToggle.listeners.click();
  const revealedHidden = Array.from(nodesWithClass(listRoot.children[0], "mercury-chat-list__threads")[0].children).find((node) => node.dataset.timelineId === listApp.activeTimelineId());
  assert.equal(Boolean(revealedHidden), true, "hidden conversation can be revealed");
  revealedHidden.listeners.click();
  assert.equal(newTimelineState.unread, false, "opening a conversation clears its unread state");

  // Current conversation settings retain only current-chat controls. Mute and
  // hide remain available from the list overflow rather than this page.
  listApp.openConversation("contact-a");
  listApp.ui.route = "settings";
  listApp.paint();
  assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-settings__contact-card").length, 1, "conversation settings has a contact summary card");
  assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-settings-toggle-row").length, 1, "conversation settings keeps only the pin switch");
  assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-settings-row").some((row) => row.children[0]?.textContent === "资源与上下文"), true, "conversation settings keeps one resource entry");
  assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-settings-row").some((row) => row.children[0]?.textContent === "玩法预设"), false, "conversation settings does not duplicate the preset entry");
  assert.equal(nodesWithClass(listRoot.children[0], "mercury-chat-settings-row").some((row) => row.children[0]?.textContent === "聊天美化"), true, "conversation settings exposes current-chat beautification");
  let settingRows = nodesWithClass(listRoot.children[0], "mercury-chat-settings-toggle-row");
  settingRows[0].listeners.click();
  assert.equal(listApp.experienceFor("contact-a").pinned, true, "settings can pin the active conversation");

  // A reply received after leaving the message view marks only that timeline
  // unread; reopening it clears the marker.
  let resolveUnread = null;
  const unreadTransport = { chat: async () => new Promise((resolve) => { resolveUnread = resolve; }) };
  const unreadStored = new Map();
  const unreadNotifications = [];
  const unreadApp = definition.create();
  const unreadRoot = new FakeElement("main");
  unreadApp.render(unreadRoot, { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => unreadStored.get(key) ?? fallback, set: (key, value) => unreadStored.set(key, value) }, aiTransport: unreadTransport, notify: (notification) => unreadNotifications.push(notification) } });
  unreadApp.ui.route = "conversation";
  unreadApp.paint();
  unreadRoot.children[0].children[2].children[1].value = "Leave this view.";
  unreadRoot.children[0].children[2].children[1].listeners.input();
  unreadRoot.children[0].children[2].listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  unreadApp.ui.route = "chats";
  unreadApp.paint();
  resolveUnread(responseForLifecycle("turn-unread-1", "A reply arrived while away."));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(unreadApp.experienceFor("contact-a").unread, true, "reply received outside the conversation marks it unread");
  assert.equal(unreadNotifications.length, 1, "unmuted reply received outside the conversation requests a system notification");
  const unreadThreadList = nodesWithClass(unreadRoot.children[0], "mercury-chat-list__threads")[0];
  const unreadThread = Array.from(unreadThreadList.children).find((node) => node.dataset.contactId === "contact-a" && node.dataset.timelineId === "default");
  assert.equal(String(unreadThread.className).includes("mercury-chat-thread--unread"), true, "unread marker reaches the chat list");
  unreadThread.listeners.click();
  assert.equal(unreadApp.experienceFor("contact-a").unread, false, "opening the thread clears unread");
  const unreadState = unreadApp.experienceFor("contact-a");
  unreadState.muted = true;
  unreadApp.ui.route = "chats";
  unreadApp.markAssistantActivity({ contactId: "contact-a", timelineId: "default", requestId: "muted-reply" }, { id: "muted-reply", parts: [{ text: "Muted reply." }] });
  assert.equal(unreadNotifications.length, 1, "muted reply does not request a system notification");
  unreadState.hidden = true;
  unreadApp.markAssistantActivity({ contactId: "contact-a", timelineId: "default", requestId: "hidden-reply" }, { id: "hidden-reply", parts: [{ text: "Hidden reply." }] });
  assert.equal(unreadNotifications.length, 1, "hidden reply does not request a system notification");

  console.log("mercury-chat-app: lifecycle assertions passed");})().catch((error) => { console.error(error); process.exitCode = 1; });

// ---- 预设接线（userPreset 槽装配进 compileRuntime）----
{
  require("../core/preset-content.js");
  require("../core/generation-profile-contracts.js");
  require("../core/preset-assemble.js");
  require("../system/generation-profile-store.js");
  const PStore = global.MercuryGenerationProfileStore;

  // 默认路径：不设 userPresetId → 命中 preset-default，指令非空且含骨架标记。
  const defStored = new Map();
  const presetDef = definition.create();
  presetDef.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => defStored.get(key) ?? fallback, set: (key, value) => defStored.set(key, value) } } });
  presetDef.ui.selectedContactId = "contact-a";
  const defInput = presetDef.buildRuntimeInput();
  const defText = String(defInput.compiledSystemText || "");
  assert.equal(defInput.presetId, "preset-default", "默认回退到内置默认预设");
  assert.ok(defText.includes("玩法层"), "默认预设装配出非空指令（含骨架段）");

  // 用户预设 + pref.* 占位符：装配时应把用户填的偏好文本替换进 {initialFocus}/{address}。
  const focus = "聊今天的黄昏";
  const customPreset = {
    id: "preset-lovers",
    name: "恋人开局",
    version: 1,
    preferences: { initialFocus: focus, address: "阿彩" },
    modules: {
      order: ["skeleton.preserve-role", "group.rel.lovers", "pref.focus", "pref.address"],
      enabled: { "skeleton.preserve-role": true, "group.rel.lovers": true, "pref.focus": true, "pref.address": true },
    },
    custom: { instructions: null },
  };
  const presetStore = new PStore({ storage: { get: (k, fallback) => defStored.get(k) ?? fallback, set: (k, v) => defStored.set(k, v) } });
  presetStore.add(customPreset);

  // 第二实例用独立 storage；把用户预设预置进它的「预设柜」→ 命中 preset-lovers。
  const custStored = new Map();
  new PStore({ storage: { get: (k, fallback) => custStored.get(k) ?? fallback, set: (k, v) => custStored.set(k, v) } }).add(customPreset);
  custStored.set("chat-experience.v1", { schemaVersion: 1, user: {}, contacts: { "contact-a": global.MercuryChatExperienceContracts.DEFAULT_CONTACT }, conversations: { "contact-a:default": { settings: { userPresetId: "preset-lovers" } } } });
  const presetCust = definition.create();
  presetCust.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: { get: (key, fallback) => custStored.get(key) ?? fallback, set: (key, value) => custStored.set(key, value) } } });
  presetCust.ui.selectedContactId = "contact-a";
  const custInput = presetCust.buildRuntimeInput();
  assert.equal(custInput.presetId, "preset-lovers", "命中用户预设");
  const custText = String(custInput.compiledSystemText || "");
  assert.ok(custText.includes(focus), "pref.* 占位符替换为用户的初始话题");
  assert.ok(custText.includes("阿彩"), "pref.address 占位符也替换");
  assert.ok(custText.includes("恋人"), "互斥组取到恋人候选");

  // 接线不破坏 persona 槽（人设文本仍在编译系统文本里）。
  assert.ok(custText.length > 0, "编译系统文本非空");
  assert.equal(custInput.presetId, "preset-lovers", "presetId 记录当前预设");

  const importedPreset = presetDef.importPresetFromJson(JSON.stringify({
    name: "Portable blocks",
    prompts: [
      { name: "Primary", identifier: "primary", role: "system", content: "Respond with focused continuity." },
      { name: "Deferred", identifier: "deferred", role: "assistant", content: "Do not inject this role.", injection_position: "chat", injection_depth: 3 },
    ],
    prompt_order: [{ character_id: 100000, order: [{ identifier: "primary", enabled: true }, { identifier: "deferred", enabled: true }] }],
    future_setting: { preserve: true },
  }));
  assert.ok(importedPreset, "compatible preset imports into the user preset store");
  assert.equal(importedPreset.compatibility.runtime.activeCount, 1, "only equivalent prompt blocks are active");
  assert.equal(importedPreset.compatibility.runtime.preservedCount, 1, "non-equivalent prompt blocks are preserved inactive");
  presetDef.experienceFor("contact-a").settings.userPresetId = importedPreset.id;
  presetDef.experienceFor("contact-a").resourceBindings.presetId = importedPreset.id;
  const importedInput = presetDef.buildRuntimeInput();
  assert.ok(importedInput.compiledSystemText.includes("Respond with focused continuity."), "active compatible block reaches runtime assembly");
  assert.equal(importedInput.compiledSystemText.includes("Do not inject this role."), false, "preserved inactive block does not claim runtime injection");
  assert.equal(presetDef.presetStore.get(importedPreset.id).compatibility.rawSource.future_setting.preserve, true, "unknown import fields survive app storage");

  console.log("mercury-chat-app preset-wiring assertions passed");
}

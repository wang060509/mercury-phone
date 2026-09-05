"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/chat-experience-contracts.js");
require("../core/runtime-core.js");
require("../core/worldbook-runtime.js");
require("../core/archive-contracts.js");
require("../apps/mercury-chat-data.js");
require("../system/conversation-store.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");

class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.style = {}; this.className = ""; this.classList = { add: (name) => { this.className += ` ${name}`; } }; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}

global.document = { createElement: (tagName) => new FakeElement(tagName) };

const definition = global.MercuryCreateChatDefinition();
const archive = global.MercuryArchiveContracts;
const profile = archive.createRuntimeProfile({ displayName: "River", data: { identity: "A careful guide", stableTraits: ["calm"] } });
profile.status = "ready";
const world = archive.createWorldProfile({ name: "Harbor", data: { summary: "A quiet coastal town.", entries: [{ title: "The pier", content: "The last ferry leaves at dusk.", visibility: "public", alwaysActive: true }, { title: "Gate signal", content: "A blue lantern at the north gate means the courier is expected.", aliases: ["north gate", "blue lantern"], visibility: "public", enabled: true }] } });
const unrelatedWorld = archive.createWorldProfile({ name: "Elsewhere", data: { entries: [{ title: "A private detail", content: "This must not cross the session binding.", visibility: "public", alwaysActive: true }] } });
world.relatedProfileIds = [profile.id];
world.entries.push(
  archive.createWorldEntry({ id: "restricted-river", title: "River restriction", content: "Only River may use this restricted route.", visibility: "restricted", alwaysActive: true }),
  archive.createWorldEntry({ id: "character-river", title: "River detail", content: "River keeps a blue notebook.", visibility: "character-specific", runtimeProfileId: profile.id, alwaysActive: true }),
  archive.createWorldEntry({ id: "character-other", title: "Other detail", content: "This belongs to another character.", visibility: "character-specific", runtimeProfileId: "profile-other", alwaysActive: true }),
  archive.createWorldEntry({ id: "variant-harbor", title: "Harbor variant", content: "The harbor variant uses a midnight bell.", worldVariantId: "harbor", alwaysActive: true }),
  archive.createWorldEntry({ id: "timeline-other", title: "Other timeline", content: "This belongs to a different timeline.", timelineId: "timeline-other", alwaysActive: true }),
);
profile.worldBindings = [world.id];
const archiveState = archive.createArchiveState();
archiveState.runtimeProfiles.push(profile);
archiveState.worlds.push(world);
unrelatedWorld.relatedProfileIds = [profile.id];
archiveState.worlds.push(unrelatedWorld);
archiveState.contactInstances.push({ id: "instance-1", runtimeProfileId: profile.id, displayName: profile.displayName, relationshipState: "familiar", timelineId: "timeline-1", active: true });

const shared = new Map([
  [archive.STORAGE_KEY, archiveState],
]);
const experience = global.MercuryChatExperienceContracts.normalize(null);
const contact = global.MercuryChatExperienceContracts.contactFromProfile(profile);
experience.contacts[contact.id] = contact;
archiveState.contactInstances[0].chatContactId = contact.id;
shared.set(global.MercuryChatExperienceContracts.STORAGE_KEY, experience);

const app = definition.create();
app.render(new FakeElement("main"), {
  state: {},
  i18n: { t: (key) => key },
  services: {
    storage: { get: () => null, set() {} },
    sharedStorage: { get: (key, fallback) => shared.has(key) ? shared.get(key) : fallback, set: (key, value) => shared.set(key, value) },
  },
});
app.ui.selectedContactId = contact.id;
const runtime = app.buildRuntimeInput();
assert.match(runtime.compiledSystemText, /River/);
assert.match(runtime.compiledSystemText, /当前关系状态：familiar/);
assert.match(runtime.compiledSystemText, /世界资料：Harbor/);
assert.match(runtime.compiledSystemText, /The last ferry leaves at dusk/);
assert.match(runtime.compiledSystemText, /Only River may use this restricted route/);
assert.match(runtime.compiledSystemText, /River keeps a blue notebook/);
assert.doesNotMatch(runtime.compiledSystemText, /This belongs to another character/);
assert.doesNotMatch(runtime.compiledSystemText, /midnight bell/);
assert.doesNotMatch(runtime.compiledSystemText, /different timeline/);
assert.doesNotMatch(runtime.compiledSystemText, /This must not cross the session binding/);
assert.match(runtime.compiledSystemText, /retain its material commitments/, "the runtime preserves agreed event constraints against casual reversal");
assert.match(runtime.compiledSystemText, /only a claim until it is supported/, "the runtime does not turn a user's alleged memory into a fact");
assert.equal(runtime.resourceTrace.binding.runtimeProfileId, profile.id, "session trace identifies the bound runtime profile");
assert.deepEqual(runtime.resourceTrace.binding.worldBookIds, [world.id], "session trace identifies the bound world book");
assert.equal(runtime.resourceTrace.binding.presetId, "preset-default", "session trace identifies the bound preset");
assert.equal(runtime.resourceTrace.scope.worldVariantId, "default", "runtime trace records the selected world variant");
assert.equal(runtime.resourceTrace.scope.timelineId, "default", "runtime trace records the currently selected timeline");

const keywordRuntime = app.buildRuntimeInput({ currentMessage: "Should I wait at the north gate for the blue lantern?" });
assert.match(keywordRuntime.compiledSystemText, /A blue lantern at the north gate means the courier is expected\./, "a bound world-book entry enters the real runtime only after its keyword matches");
const keywordTrace = keywordRuntime.resourceTrace.selectedEntries.find((entry) => entry.title === "Gate signal");
assert.equal(keywordTrace.reason, "current_message", "the runtime trace records why the world-book entry was selected");

const session = app.experienceFor(contact.id);
const resolved = app.resolveArchiveRuntime({}, session.resourceBindings);
assert.equal(resolved.profile.id, profile.id, "archive resolution follows the session profile binding");
app.openConversation(contact.id);
assert.equal(app.activeTimelineId(), "timeline-1", "contact opens its mapped archive timeline instead of default");
app.setSessionWorldBookBindings([]);
const isolated = app.buildRuntimeInput();
assert.equal(isolated.resourceTrace.binding.worldBookMode, "explicit", "trace identifies an explicit world-book mapping");
assert.deepEqual(isolated.resourceTrace.binding.worldBookIds, [], "an explicit empty mapping remains empty");
assert.doesNotMatch(isolated.compiledSystemText, /The last ferry leaves at dusk/);
assert.doesNotMatch(isolated.compiledSystemText, /A blue lantern at the north gate means the courier is expected/);
app.setSessionWorldBookMode("inherit");
const inherited = app.buildRuntimeInput();
assert.equal(inherited.resourceTrace.binding.worldBookMode, "inherit", "session can explicitly restore role-card world bindings");
assert.match(inherited.compiledSystemText, /The last ferry leaves at dusk/);
assert.doesNotMatch(inherited.compiledSystemText, /This must not cross the session binding/);
assert.equal(inherited.resourceTrace.scope.timelineId, "timeline-1", "the request trace follows the mapped contact timeline");

// A session can switch the active world variant without widening timeline scope.
app.experienceFor(contact.id, app.activeTimelineId()).resourceBindings.worldVariantId = "harbor";
const harborVariant = app.buildRuntimeInput();
assert.match(harborVariant.compiledSystemText, /midnight bell/, "the selected world variant reaches the real prompt");
assert.doesNotMatch(harborVariant.compiledSystemText, /different timeline/, "variant selection does not widen the timeline scope");
assert.equal(harborVariant.resourceTrace.scope.worldVariantId, "harbor", "the request trace follows the selected world variant");

// Explicit world mapping is usable for a normal contact without an archive profile;
// restricted/character-specific entries still remain gated by their own rules.
app.openConversation("contact-a", "default");
app.setSessionWorldBookBindings([world.id]);
const explicitWithoutProfile = app.buildRuntimeInput();
assert.match(explicitWithoutProfile.compiledSystemText, /The last ferry leaves at dusk/, "explicit world mapping reaches a contact without a profile");
assert.doesNotMatch(explicitWithoutProfile.compiledSystemText, /Only River may use this restricted route/, "restricted world content does not widen to an unlinked contact");

console.log("runtime-context: 18 assertions passed");

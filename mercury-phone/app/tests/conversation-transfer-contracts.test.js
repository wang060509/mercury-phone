"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/chat-contracts.js");
require("../core/chat-experience-contracts.js");
const transfer = require("../core/conversation-transfer-contracts.js");

const conversation = {
  schemaVersion: 2,
  id: "contact-a:default",
  settings: JSON.parse(JSON.stringify(global.MercuryChatContracts.DEFAULT_SETTINGS)),
  entries: [
    { id: "user-1", role: "user", text: "Are you there?", parts: [{ id: "text-1", type: "text", text: "Are you there?" }, { id: "emoji-1", type: "emoji", value: "🌧️" }], createdAt: "2026-08-19T01:00:00.000Z", delivery: "processing", replyToId: null },
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ id: "assistant-1:part-1", text: "Always.", order: 0, pauseAfter: "none", deliveryStatus: "pending" }],
      status: "delivering",
      createdAt: "2026-08-19T01:00:01.000Z",
      usage: null,
      unspokenAside: "I had been waiting.",
      versions: [
        { id: "version-1", parts: [{ id: "version-1:part-1", text: "Yes.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-08-19T01:00:01.000Z", usage: null, unspokenAside: null },
        { id: "version-2", parts: [{ id: "version-2:part-1", text: "Always.", order: 0, pauseAfter: "none", deliveryStatus: "pending" }], status: "delivering", createdAt: "2026-08-19T01:00:02.000Z", usage: null, unspokenAside: "I had been waiting." },
      ],
      activeVersionId: "version-2",
    },
  ],
};

const input = {
  contact: { name: "Mercury / One", identity: "Photographer" },
  userName: "Mina",
  exportedAt: "2026-08-19T02:00:00.000Z",
  conversation,
  session: {
    settings: { timeFlow: "narrative", initiative: "high", relationshipPace: "slow", dramaticIntensity: "balanced", unspokenAside: "often", contextScope: "deep", memoryHandling: "confirm", userPresetId: "preset-local" },
    resourceBindings: { runtimeProfileId: "role-mercury", worldVariantId: "variant-rain", worldBookMode: "explicit", worldBookIds: ["world-rain"], presetId: "preset-local" },
    sceneContext: { id: "scene-rain", title: "Rain room", content: "Rain is falling outside.", source: "local", selectedAt: "2026-08-19T00:00:00.000Z" },
  },
};

const portable = transfer.exportConversation(input);
assert.equal(portable.format, "portable");
assert.equal(portable.filename, "Mercury-One-chat.mercury.json");
assert.equal(portable.entryCount, 2);
assert.equal(portable.envelope.kind, transfer.KIND);
assert.equal(portable.envelope.schemaVersion, 1);
assert.equal(portable.envelope.conversation.entries[0].delivery, "complete", "transient user delivery becomes a stable transcript state");
assert.equal(portable.envelope.conversation.entries[1].status, "complete", "an in-flight assistant turn is made portable");
assert.equal(portable.envelope.conversation.entries[1].parts[0].deliveryStatus, "delivered");
assert.equal(portable.envelope.conversation.entries[1].versions[1].status, "complete", "version history also loses transient runtime state");
assert.equal(conversation.entries[0].delivery, "processing", "export never mutates the live conversation");

const staged = transfer.inspect(portable.text);
assert.equal(staged.entryCount, 2);
assert.equal(staged.source.contactName, "Mercury / One");
assert.equal(staged.session.resourceBindings.worldBookIds[0], "world-rain");
assert.equal(staged.session.sceneContext.content, "Rain is falling outside.");
assert.deepEqual(staged.conversation, portable.envelope.conversation, "portable export passes a lossless ConversationV2 round trip after transient-state normalization");

const readable = transfer.exportConversation(input, transfer.FORMATS.TEXT);
assert.equal(readable.filename, "Mercury-One-chat.txt");
assert.match(readable.text, /Mina · 2026-08-19T01:00:00.000Z\nAre you there\?/);
assert.match(readable.text, /Mercury \/ One · 2026-08-19T01:00:01.000Z\nAlways\./);
assert.match(readable.text, /Unspoken aside: I had been waiting\./);
assert.throws(() => transfer.inspect(readable.text), (error) => error.code === "CONVERSATION_TRANSFER_INVALID_JSON", "readable text is intentionally not accepted as a portable chat");

assert.throws(() => transfer.inspect("{}"), (error) => error.code === "CONVERSATION_TRANSFER_WRONG_KIND");
assert.throws(() => transfer.inspect(JSON.stringify({ ...portable.envelope, schemaVersion: 99 })), (error) => error.code === "CONVERSATION_TRANSFER_UNSUPPORTED_VERSION");
assert.throws(() => transfer.inspect(JSON.stringify({ ...portable.envelope, conversation: { ...portable.envelope.conversation, entries: "broken" } })), (error) => error.code === "CONVERSATION_TRANSFER_INVALID_CONVERSATION");
assert.throws(() => transfer.inspect(JSON.stringify({ ...portable.envelope, conversation: { ...portable.envelope.conversation, entries: [portable.envelope.conversation.entries[0], portable.envelope.conversation.entries[0]] } })), (error) => error.code === "CONVERSATION_TRANSFER_DUPLICATE_ENTRY");
assert.throws(() => transfer.inspect(JSON.stringify({ ...portable.envelope, session: { ...portable.envelope.session, settings: { ...portable.envelope.session.settings, timeFlow: "unknown" } } })), (error) => error.code === "CONVERSATION_TRANSFER_INVALID_SESSION");

const rebound = transfer.withConversationId(staged.conversation, "contact-b:imported-1");
assert.equal(rebound.id, "contact-b:imported-1");
assert.equal(staged.conversation.id, "contact-a:default", "rebinding does not mutate the inspected stage");

console.log("conversation-transfer-contracts: contract assertions passed");

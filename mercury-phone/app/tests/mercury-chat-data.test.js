"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../apps/mercury-chat-data.js");

const chat = global.MercuryChatData;
assert.deepEqual(chat.ROLES, ["user", "assistant"]);
assert.deepEqual(chat.DELIVERY_STATES, ["sending", "queued", "processing", "complete", "failed", "cancelled"]);
assert.deepEqual(chat.GENERATION_STATES, ["idle", "typing", "streaming", "complete", "stopped", "failed"]);
assert.equal(chat.CONTACT_A.id, "contact-a");
assert.equal(chat.CONTACT_A.avatarAsset, null);
assert.equal(chat.CONTACT_A_CONVERSATION.contactId, "contact-a");

const user = chat.createUserMessage({ id: "message-1", turnId: "turn-1", content: "  Are you here?  ", createdAt: "2026-07-24T12:00:00.000Z" });
assert.equal(user.content, "Are you here?");
assert.equal(user.delivery, "sending");
assert.equal(user.generation, "idle");
assert.equal(Object.isFrozen(user), true);
chat.validateMessage({ ...user, delivery: "processing" });
chat.validateMessage({ ...user, delivery: "cancelled" });
assert.throws(() => chat.createUserMessage({ id: "message-2", turnId: "turn-2", content: " " }), /cannot be empty/);
assert.throws(() => chat.validateMessage({ ...user, delivery: "read" }), /delivery state/);
const quotedUser = chat.createUserMessage({ id: "message-quote", turnId: "turn-quote", content: "I mean this one.", createdAt: "2026-07-24T12:00:00.500Z", quote: { messageId: "message-1", author: "user", content: "Are you here?" } });
assert.deepEqual(quotedUser.quote, { messageId: "message-1", author: "user", content: "Are you here?" });

const assistant = chat.createAssistantMessage({ id: "message-3", turnId: "turn-1", content: "I am here.", generation: "streaming", replyToId: user.id, createdAt: "2026-07-24T12:00:01.000Z" });
assert.equal(assistant.role, "assistant");
assert.equal(assistant.delivery, "complete");
assert.equal(assistant.generation, "streaming");
assert.equal(assistant.replyToId, "message-1");
assert.throws(() => chat.validateMessage({ ...assistant, generation: "pending" }), /generation state/);

const initial = chat.initialConversation();
assert.equal(initial.contact, chat.CONTACT_A);
assert.equal(initial.conversation, chat.CONTACT_A_CONVERSATION);
assert.equal(initial.messages.length, 0);
assert.equal(initial.activeTurnId, null);
assert.equal(Object.isFrozen(initial), true);

const storedConversation = chat.createStoredConversation([user, assistant]);
assert.equal(storedConversation.schemaVersion, 2);
assert.equal(storedConversation.entries.length, 2);
assert.equal(Object.isFrozen(storedConversation.entries), true);
const quotedStoredConversation = chat.createStoredConversation([quotedUser]);
assert.deepEqual(quotedStoredConversation.entries[0].quote, quotedUser.quote, "legacy message migration preserves a valid quote snapshot");
assert.equal(chat.hydrateMessages({ messages: [{ invalid: true }] }, [user]).length, 1);

console.log("mercury-chat-data: 26 assertions passed");

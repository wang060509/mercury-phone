(function exposeMercuryChatData(global) {
  "use strict";

  if (!global.MercuryChatContracts && typeof require === "function") {
    global.MercuryChatContracts = require("../core/chat-contracts.js");
  }

  const ROLES = Object.freeze(["user", "assistant"]);
  const DELIVERY_STATES = Object.freeze(["sending", "queued", "processing", "complete", "failed", "cancelled"]);
  const GENERATION_STATES = Object.freeze(["idle", "typing", "streaming", "complete", "stopped", "failed"]);
  const CHAT_SCHEMA_VERSION = 1;

  const CONTACT_A = Object.freeze({
    id: "contact-a",
    nameKey: "contacts.a",
    presenceKey: "chat.presence.quiet",
    avatarAsset: null,
  });

  const CONTACT_A_CONVERSATION = Object.freeze({
    id: "contact-a:direct",
    kind: "direct",
    contactId: CONTACT_A.id,
  });

  function validateMessage(message) {
    if (!message || typeof message !== "object") throw new TypeError("Chat messages must be objects.");
    if (!message.id || !message.conversationId || !message.turnId || !ROLES.includes(message.role)) {
      throw new TypeError("Chat messages require id, conversationId, turnId, and a supported role.");
    }
    if (typeof message.content !== "string") throw new TypeError("Chat message content must be text.");
    if (message.role === "user" && !DELIVERY_STATES.includes(message.delivery)) {
      throw new TypeError("User messages require a supported delivery state.");
    }
    if (message.role === "assistant" && !GENERATION_STATES.includes(message.generation)) {
      throw new TypeError("Assistant messages require a supported generation state.");
    }
    return true;
  }

  function createUserMessage(input = {}) {
    const message = {
      id: input.id,
      conversationId: input.conversationId || CONTACT_A_CONVERSATION.id,
      turnId: input.turnId,
      role: "user",
      content: String(input.content || "").trim(),
      createdAt: input.createdAt || new Date().toISOString(),
      delivery: input.delivery || "sending",
      generation: "idle",
      replyToId: input.replyToId || null,
      quote: input.quote || null,
      parts: Array.isArray(input.parts) ? input.parts.map((part) => ({ ...part })) : null,
    };
    validateMessage(message);
    if (!message.content && !message.parts?.length) throw new TypeError("User messages cannot be empty.");
    return Object.freeze(message);
  }

  function createAssistantMessage(input = {}) {
    const message = {
      id: input.id,
      conversationId: input.conversationId || CONTACT_A_CONVERSATION.id,
      turnId: input.turnId,
      role: "assistant",
      content: typeof input.content === "string" ? input.content : "",
      createdAt: input.createdAt || new Date().toISOString(),
      delivery: "complete",
      generation: input.generation || "typing",
      replyToId: input.replyToId || null,
    };
    validateMessage(message);
    return Object.freeze(message);
  }

  function initialConversation() {
    return Object.freeze({
      contact: CONTACT_A,
      conversation: CONTACT_A_CONVERSATION,
      messages: Object.freeze([]),
      activeTurnId: null,
    });
  }

  function contactAStaticMessages() {
    return Object.freeze([
      createAssistantMessage({
        id: "contact-a-1",
        turnId: "turn-1",
        content: "The rain has made the whole afternoon feel a little softer.",
        createdAt: "2026-07-24T12:01:00.000Z",
        generation: "complete",
      }),
      createUserMessage({
        id: "contact-a-2",
        turnId: "turn-1",
        content: "I think I needed that kind of afternoon.",
        createdAt: "2026-07-24T12:02:00.000Z",
        delivery: "complete",
      }),
      createAssistantMessage({
        id: "contact-a-3",
        turnId: "turn-2",
        content: "Then we can let it be quiet for a while. I’ll stay here.",
        createdAt: "2026-07-24T12:03:00.000Z",
        generation: "complete",
      }),
      createUserMessage({
        id: "contact-a-4",
        turnId: "turn-3",
        content: "That sounds nice.",
        createdAt: "2026-07-24T12:04:00.000Z",
        delivery: "processing",
        replyToId: "contact-a-3",
      }),
    ]);
  }

  function hydrateMessages(value, fallback = []) {
    const candidates = Array.isArray(value?.messages) ? value.messages : fallback;
    try {
      return Object.freeze(candidates.map((message) => {
        validateMessage(message);
        return Object.freeze({ ...message });
      }));
    } catch { return Object.freeze([...fallback]); }
  }

  function createStoredConversation(messages) {
    const safeMessages = hydrateMessages({ messages }, []);
    return global.MercuryChatContracts.migrateV1({ schemaVersion: CHAT_SCHEMA_VERSION, id: CONTACT_A_CONVERSATION.id, messages: safeMessages });
  }

  global.MercuryChatData = Object.freeze({
    ROLES,
    DELIVERY_STATES,
    GENERATION_STATES,
    CHAT_SCHEMA_VERSION,
    CONTACT_A,
    CONTACT_A_CONVERSATION,
    validateMessage,
    createUserMessage,
    createAssistantMessage,
    initialConversation,
    contactAStaticMessages,
    hydrateMessages,
    createStoredConversation,
  });
})(window);

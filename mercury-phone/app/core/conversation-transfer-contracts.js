(function exposeMercuryConversationTransferContracts(global) {
  "use strict";

  const KIND = "mercury-chat-conversation";
  const SCHEMA_VERSION = 1;
  const FORMATS = Object.freeze({ PORTABLE: "portable", TEXT: "text" });
  const MAX_TRANSFER_BYTES = 16 * 1024 * 1024;
  const MAX_ENTRIES = 10000;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const nonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
  const transferError = (code, message, cause, detail = {}) => Object.assign(new Error(message), { code, cause, ...detail });
  const freezeDeep = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeDeep);
    return Object.freeze(value);
  };

  function byteLength(value) {
    const text = String(value || "");
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).byteLength;
    return Buffer.byteLength(text, "utf8");
  }

  function safeFilename(value, fallback = "mercury-chat") {
    const result = String(value || "").trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    return result || fallback;
  }

  function requireDependencies(options = {}) {
    const chat = options.chatContracts || global.MercuryChatContracts;
    const experience = options.experienceContracts || global.MercuryChatExperienceContracts;
    if (!chat || typeof chat.validateConversationV2 !== "function") throw transferError("CONVERSATION_TRANSFER_CHAT_CONTRACTS_UNAVAILABLE", "Chat contracts are unavailable.");
    if (!experience || typeof experience.normalizeResourceBindings !== "function" || typeof experience.normalizeSceneContext !== "function") throw transferError("CONVERSATION_TRANSFER_EXPERIENCE_CONTRACTS_UNAVAILABLE", "Chat experience contracts are unavailable.");
    return { chat, experience };
  }

  function normalizeParts(parts) {
    return parts.map((part) => ({ ...clone(part), deliveryStatus: part.deliveryStatus === "pending" ? "delivered" : part.deliveryStatus }));
  }

  function normalizeConversation(conversation, chat) {
    const next = clone(conversation);
    next.entries = next.entries.map((entry) => {
      if (entry.role === "user") {
        return { ...entry, delivery: ["sending", "queued", "processing"].includes(entry.delivery) ? "complete" : (entry.delivery || "complete") };
      }
      const normalized = {
        ...entry,
        status: ["queued", "processing", "delivering"].includes(entry.status) ? "complete" : entry.status,
        parts: normalizeParts(entry.parts),
      };
      if (Array.isArray(entry.versions)) {
        normalized.versions = entry.versions.map((version) => ({
          ...version,
          status: ["queued", "processing", "delivering"].includes(version.status) ? "complete" : version.status,
          parts: normalizeParts(version.parts),
        }));
      }
      return normalized;
    });
    chat.validateConversationV2(next);
    return next;
  }

  function validatePortableIdentity(conversation) {
    if (conversation.entries.length > MAX_ENTRIES) throw transferError("CONVERSATION_TRANSFER_TOO_MANY_ENTRIES", `A chat transfer can contain at most ${MAX_ENTRIES} entries.`);
    const entryIds = new Set();
    conversation.entries.forEach((entry) => {
      if (entryIds.has(entry.id)) throw transferError("CONVERSATION_TRANSFER_DUPLICATE_ENTRY", `Duplicate chat entry id: ${entry.id}.`);
      entryIds.add(entry.id);
      if (entry.role === "assistant") {
        const orders = new Set();
        entry.parts.forEach((part) => {
          if (orders.has(part.order)) throw transferError("CONVERSATION_TRANSFER_DUPLICATE_PART_ORDER", `Duplicate assistant part order in ${entry.id}.`);
          orders.add(part.order);
        });
      }
      if (Array.isArray(entry.versions)) {
        const versionIds = new Set();
        entry.versions.forEach((version) => {
          if (versionIds.has(version.id)) throw transferError("CONVERSATION_TRANSFER_DUPLICATE_VERSION", `Duplicate assistant version id in ${entry.id}.`);
          versionIds.add(version.id);
        });
      }
    });
  }

  function normalizeResourceSnapshot(value, experience) {
    const source = isObject(value) ? value : {};
    const fallback = experience.DEFAULT_RESOURCE_BINDINGS || {};
    const worldBookMode = source.worldBookMode === "explicit" ? "explicit" : "inherit";
    const worldBookIds = Array.isArray(source.worldBookIds)
      ? Array.from(new Set(source.worldBookIds.filter(nonEmptyText).map((id) => id.trim()))).slice(0, 256)
      : [];
    return {
      runtimeProfileId: nonEmptyText(source.runtimeProfileId) ? source.runtimeProfileId.trim() : fallback.runtimeProfileId || null,
      worldVariantId: nonEmptyText(source.worldVariantId) ? source.worldVariantId.trim() : fallback.worldVariantId || "default",
      worldBookMode,
      worldBookIds,
      presetId: nonEmptyText(source.presetId) ? source.presetId.trim() : fallback.presetId || "preset-default",
    };
  }

  function normalizeSession(value, dependencies) {
    const source = isObject(value) ? value : {};
    try { dependencies.chat.validateExperienceSettings(source.settings); }
    catch (cause) { throw transferError("CONVERSATION_TRANSFER_INVALID_SESSION", "The chat transfer contains invalid session settings.", cause); }
    const settings = dependencies.chat.normalizeExperienceSettings(source.settings || {});
    const resourceBindings = normalizeResourceSnapshot(source.resourceBindings, dependencies.experience);
    const sceneContext = source.sceneContext == null ? null : dependencies.experience.normalizeSceneContext(source.sceneContext);
    if (source.sceneContext != null && !sceneContext) throw transferError("CONVERSATION_TRANSFER_INVALID_SCENE", "The chat transfer contains an invalid scene context.");
    return { settings: clone(settings), resourceBindings, sceneContext: clone(sceneContext) };
  }

  function portableEnvelope(input, options = {}) {
    const dependencies = requireDependencies(options);
    const sourceConversation = clone(input?.conversation);
    try { dependencies.chat.validateConversationV2(sourceConversation); }
    catch (cause) { throw transferError("CONVERSATION_TRANSFER_INVALID_CONVERSATION", "The conversation cannot be exported because it is invalid.", cause); }
    validatePortableIdentity(sourceConversation);
    const conversation = normalizeConversation(sourceConversation, dependencies.chat);
    const contactName = String(input?.contact?.name || input?.contactName || "Conversation").trim() || "Conversation";
    const contactIdentity = String(input?.contact?.identity || input?.contactIdentity || "").trim();
    const exportedAt = nonEmptyText(input?.exportedAt) ? input.exportedAt : new Date().toISOString();
    const envelope = {
      kind: KIND,
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      title: String(input?.title || `${contactName} chat`).trim().slice(0, 160),
      source: { contactName, contactIdentity },
      conversation,
      session: normalizeSession(input?.session, dependencies),
    };
    return freezeDeep(envelope);
  }

  function plainText(input, options = {}) {
    const envelope = portableEnvelope(input, options);
    const userName = String(input?.userName || "Me").trim() || "Me";
    const lines = ["Mercury Phone chat", `Contact: ${envelope.source.contactName}`, `Exported: ${envelope.exportedAt}`, ""];
    envelope.conversation.entries.forEach((entry) => {
      const name = entry.role === "user" ? userName : envelope.source.contactName;
      lines.push(`${name} · ${entry.createdAt}`);
      if (entry.role === "user") {
        if (entry.text) lines.push(entry.text);
        (entry.parts || []).filter((part) => part.type !== "text").forEach((part) => {
          if (part.type === "emoji") lines.push(`[Emoji: ${part.value}]`);
          if (part.type === "image") lines.push(`[Image: ${part.alt || part.mimeType}]`);
        });
      } else {
        entry.parts.forEach((part) => lines.push(part.text));
        if (entry.unspokenAside) lines.push(`[Unspoken aside: ${entry.unspokenAside}]`);
      }
      lines.push("");
    });
    return lines.join("\n").trimEnd() + "\n";
  }

  function exportConversation(input, format = FORMATS.PORTABLE, options = {}) {
    if (!Object.values(FORMATS).includes(format)) throw transferError("CONVERSATION_TRANSFER_UNSUPPORTED_FORMAT", `Unsupported chat export format: ${format}.`);
    const base = safeFilename(input?.contact?.name || input?.contactName || "mercury-chat");
    if (format === FORMATS.TEXT) {
      const text = plainText(input, options);
      return Object.freeze({ format, filename: `${base}-chat.txt`, mimeType: "text/plain;charset=utf-8", text, entryCount: input.conversation.entries.length });
    }
    const envelope = portableEnvelope(input, options);
    const text = JSON.stringify(envelope, null, 2);
    if (byteLength(text) > MAX_TRANSFER_BYTES) throw transferError("CONVERSATION_TRANSFER_TOO_LARGE", "The chat transfer is too large to export safely.");
    return Object.freeze({ format, filename: `${base}-chat.mercury.json`, mimeType: "application/json", text, entryCount: envelope.conversation.entries.length, envelope });
  }

  function inspect(rawText, options = {}) {
    const dependencies = requireDependencies(options);
    if (typeof rawText !== "string" || !rawText.trim()) throw transferError("CONVERSATION_TRANSFER_EMPTY", "Choose a Mercury chat JSON file.");
    if (byteLength(rawText) > MAX_TRANSFER_BYTES) throw transferError("CONVERSATION_TRANSFER_TOO_LARGE", "The chat transfer is too large to inspect safely.");
    let parsed;
    try { parsed = JSON.parse(rawText.replace(/^\uFEFF/, "")); }
    catch (cause) { throw transferError("CONVERSATION_TRANSFER_INVALID_JSON", "The selected file is not valid JSON.", cause); }
    if (!isObject(parsed) || parsed.kind !== KIND) throw transferError("CONVERSATION_TRANSFER_WRONG_KIND", "The selected JSON is not a Mercury chat transfer.");
    if (parsed.schemaVersion !== SCHEMA_VERSION) throw transferError("CONVERSATION_TRANSFER_UNSUPPORTED_VERSION", `Unsupported Mercury chat transfer version: ${String(parsed.schemaVersion)}.`);
    if (!nonEmptyText(parsed.exportedAt) || !isObject(parsed.source) || !nonEmptyText(parsed.source.contactName) || !isObject(parsed.session)) throw transferError("CONVERSATION_TRANSFER_INVALID_ENVELOPE", "The Mercury chat transfer metadata is incomplete.");
    let conversation;
    try {
      dependencies.chat.validateConversationV2(parsed.conversation);
      validatePortableIdentity(parsed.conversation);
      conversation = normalizeConversation(parsed.conversation, dependencies.chat);
    } catch (cause) {
      if (cause?.code?.startsWith?.("CONVERSATION_TRANSFER_")) throw cause;
      throw transferError("CONVERSATION_TRANSFER_INVALID_CONVERSATION", "The Mercury chat transfer contains invalid conversation data.", cause);
    }
    const session = normalizeSession(parsed.session, dependencies);
    return freezeDeep({
      kind: KIND,
      schemaVersion: SCHEMA_VERSION,
      inspectedAt: new Date().toISOString(),
      source: { contactName: parsed.source.contactName.trim(), contactIdentity: String(parsed.source.contactIdentity || "").trim() },
      title: String(parsed.title || `${parsed.source.contactName} chat`).trim().slice(0, 160),
      exportedAt: parsed.exportedAt,
      conversation,
      session,
      entryCount: conversation.entries.length,
    });
  }

  function withConversationId(conversation, id, options = {}) {
    const dependencies = requireDependencies(options);
    const next = normalizeConversation(conversation, dependencies.chat);
    next.id = String(id || "conversation-imported");
    dependencies.chat.validateConversationV2(next);
    return freezeDeep(next);
  }

  const api = { KIND, SCHEMA_VERSION, FORMATS, MAX_TRANSFER_BYTES, MAX_ENTRIES, exportConversation, inspect, withConversationId, portableEnvelope, plainText };
  global.MercuryConversationTransferContracts = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

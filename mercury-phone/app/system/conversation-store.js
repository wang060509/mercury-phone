(function exposeMercuryConversationStore(global) {
  "use strict";

  const contracts = global.MercuryChatContracts
    || (typeof require === "function" ? require("../core/chat-contracts.js") : null);
  const DEFAULT_KEY = "conversation.v1";

  function storageError(message, code, cause) {
    return Object.assign(new Error(message), { code, cause });
  }

  class MercuryConversationStore {
    constructor(options = {}) {
      if (!contracts) throw new Error("Chat contracts are unavailable.");
      if (options.storage != null && (typeof options.storage.get !== "function" || typeof options.storage.set !== "function")) {
        throw new TypeError("Conversation storage requires get and set functions.");
      }
      this.storage = options.storage || null;
      this.lastWriteError = null;
    }

    keyFor(contactId, timelineId = "default") {
      const contact = String(contactId || "").trim();
      const timeline = String(timelineId || "default").trim() || "default";
      if (!contact) throw new TypeError("Conversation storage requires a contact id.");
      if (timeline === "default") return contact === "contact-a" ? DEFAULT_KEY : `conversation.${contact}.v1`;
      return `conversation.${contact}.${timeline}.v1`;
    }

    load(contactId, timelineId = "default", options = {}) {
      const key = this.keyFor(contactId, timelineId);
      let stored = null;
      let readError = null;
      let writeError = null;
      try {
        stored = this.storage?.get(key, null) ?? null;
      } catch (error) {
        readError = storageError("Failed to read conversation data.", "CONVERSATION_STORAGE_READ_FAILED", error);
      }
      const hadStoredValue = stored !== null && stored !== undefined;
      const loaded = contracts.loadConversation(stored);
      const sourceStatus = readError
        ? "unavailable"
        : !hadStoredValue
          ? "missing"
          : loaded.corrupted
            ? "corrupted"
            : loaded.migrated
              ? "migrated"
              : "ready";
      const fallbackMessages = Array.isArray(options.fallbackMessages) ? options.fallbackMessages : [];
      const conversation = loaded.corrupted
        ? contracts.migrateV1({ schemaVersion: 1, id: `${contactId}:${timelineId}`, messages: fallbackMessages })
        : loaded.conversation;
      let migrationPersisted = false;

      if (loaded.migrated && !loaded.corrupted && this.storage) {
        try {
          this.storage.set(key, conversation);
          this.lastWriteError = null;
          migrationPersisted = true;
        } catch (error) {
          // The normalized value remains usable for this session. A failed
          // compatibility write must not make otherwise valid chat data unreadable.
          writeError = storageError("Failed to persist migrated conversation data.", "CONVERSATION_MIGRATION_WRITE_FAILED", error);
          this.lastWriteError = writeError;
        }
      }

      return Object.freeze({
        key,
        conversation,
        messages: Object.freeze(contracts.entriesToLegacyMessages(conversation)),
        hadStoredValue,
        migrated: loaded.migrated,
        corrupted: sourceStatus === "corrupted",
        sourceStatus,
        migrationPersisted,
        readError,
        writeError,
      });
    }

    save(contactId, timelineId = "default", conversation) {
      const key = this.keyFor(contactId, timelineId);
      const loaded = contracts.loadConversation(conversation);
      if (loaded.corrupted) throw storageError("Cannot persist invalid conversation data.", "CONVERSATION_INVALID", null);
      try {
        this.storage?.set(key, loaded.conversation);
        this.lastWriteError = null;
      } catch (error) {
        this.lastWriteError = storageError("Failed to persist conversation data.", "CONVERSATION_STORAGE_WRITE_FAILED", error);
        throw this.lastWriteError;
      }
      return loaded.conversation;
    }
  }

  MercuryConversationStore.DEFAULT_KEY = DEFAULT_KEY;
  global.MercuryConversationStore = MercuryConversationStore;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryConversationStore;
})(typeof window !== "undefined" ? window : globalThis);

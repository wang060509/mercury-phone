(function exposeMercuryConversationTransferWorkflow(global) {
  "use strict";

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const nonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
  const transferError = (code, message, cause, detail = {}) => Object.assign(new Error(message), { code, cause, ...detail });

  class MercuryConversationTransferWorkflow {
    constructor(options = {}) {
      this.conversationStorage = options.conversationStorage || options.storage || null;
      this.experienceStorage = options.experienceStorage || options.storage || null;
      this.conversationStore = options.conversationStore || null;
      this.contracts = options.transferContracts || global.MercuryConversationTransferContracts || null;
      this.chat = options.chatContracts || global.MercuryChatContracts || null;
      this.experience = options.experienceContracts || global.MercuryChatExperienceContracts || null;
      this.now = typeof options.now === "function" ? options.now : () => Date.now();
      this.random = typeof options.random === "function" ? options.random : () => Math.random().toString(36).slice(2, 8);
      if (!this.conversationStorage || typeof this.conversationStorage.get !== "function" || typeof this.conversationStorage.set !== "function") throw transferError("CONVERSATION_TRANSFER_INVALID_STORAGE", "Conversation Transfer requires conversation storage operations.");
      if (!this.experienceStorage || typeof this.experienceStorage.get !== "function" || typeof this.experienceStorage.set !== "function") throw transferError("CONVERSATION_TRANSFER_INVALID_EXPERIENCE_STORAGE", "Conversation Transfer requires experience storage operations.");
      if (!this.conversationStore || typeof this.conversationStore.keyFor !== "function" || typeof this.conversationStore.save !== "function") throw transferError("CONVERSATION_TRANSFER_INVALID_STORE", "Conversation Transfer requires a Conversation Store.");
      if (!this.contracts || typeof this.contracts.inspect !== "function" || typeof this.contracts.exportConversation !== "function") throw transferError("CONVERSATION_TRANSFER_CONTRACTS_UNAVAILABLE", "Conversation Transfer contracts are unavailable.");
      if (!this.experience || typeof this.experience.normalize !== "function") throw transferError("CONVERSATION_TRANSFER_EXPERIENCE_UNAVAILABLE", "Chat experience contracts are unavailable.");
    }

    export(input, format = this.contracts.FORMATS.PORTABLE) {
      return this.contracts.exportConversation(input, format, { chatContracts: this.chat, experienceContracts: this.experience });
    }

    inspect(rawText) {
      return this.contracts.inspect(rawText, { chatContracts: this.chat, experienceContracts: this.experience });
    }

    commit(stage, options = {}) {
      if (!stage || stage.kind !== this.contracts.KIND || stage.schemaVersion !== this.contracts.SCHEMA_VERSION || !stage.conversation || !stage.session) {
        throw transferError("CONVERSATION_TRANSFER_INVALID_STAGE", "Inspect a Mercury chat transfer before importing it.");
      }
      const contactId = String(options.contactId || "").trim();
      const current = this.experience.normalize(options.experience || this.experienceStorage.get(this.experience.STORAGE_KEY, null));
      const contact = current.contacts[contactId];
      if (!contactId || !contact) throw transferError("CONVERSATION_TRANSFER_TARGET_MISSING", "Choose an existing contact for the imported chat.");

      const timelineId = this.#allocateTimeline(contactId, current);
      const conversationId = `${contactId}:${timelineId}`;
      const conversation = this.contracts.withConversationId(stage.conversation, conversationId, { chatContracts: this.chat, experienceContracts: this.experience });
      const reconciliation = this.#reconcileSession(stage.session, contact, options);
      const conversationKey = this.experience.keyFor(contactId, timelineId);
      const nextExperience = clone(current);
      nextExperience.conversations[conversationKey] = {
        settings: reconciliation.settings,
        appearance: clone(this.experience.DEFAULT_APPEARANCE),
        resourceBindings: reconciliation.resourceBindings,
        sceneContext: reconciliation.sceneContext,
        pinned: false,
        hidden: false,
        muted: false,
        unread: false,
        deleted: false,
      };

      const before = this.#capture([
        { storage: this.conversationStorage, key: this.conversationStore.keyFor(contactId, timelineId) },
        { storage: this.experienceStorage, key: this.experience.STORAGE_KEY },
      ]);
      try {
        const savedConversation = this.conversationStore.save(contactId, timelineId, conversation);
        this.experienceStorage.set(this.experience.STORAGE_KEY, nextExperience);
        return Object.freeze({
          contactId,
          timelineId,
          conversation: savedConversation,
          experience: nextExperience,
          entryCount: savedConversation.entries.length,
          source: clone(stage.source),
          unresolvedBindings: Object.freeze(reconciliation.unresolvedBindings),
        });
      } catch (cause) {
        this.#rollback(before, cause);
      }
    }

    #allocateTimeline(contactId, experience) {
      const token = String(this.random() || "local").replace(/[^a-z0-9_-]+/gi, "").slice(0, 20) || "local";
      const base = `imported-${this.now()}-${token}`;
      const missing = {};
      const occupiedSessions = new Set(Object.keys(experience?.conversations || {}));
      let timelineId = base;
      let suffix = 2;
      while (
        this.conversationStorage.get(this.conversationStore.keyFor(contactId, timelineId), missing) !== missing
        || occupiedSessions.has(this.experience.keyFor(contactId, timelineId))
      ) {
        timelineId = `${base}-${suffix++}`;
      }
      return timelineId;
    }

    #reconcileSession(session, contact, options) {
      const availableWorlds = new Set((Array.isArray(options.availableWorldBookIds) ? options.availableWorldBookIds : []).filter(nonEmptyText));
      const availablePresets = new Set(["preset-default", ...(Array.isArray(options.availablePresetIds) ? options.availablePresetIds : []).filter(nonEmptyText)]);
      const sourceBindings = session.resourceBindings || {};
      const requestedWorlds = sourceBindings.worldBookMode === "explicit" && Array.isArray(sourceBindings.worldBookIds) ? sourceBindings.worldBookIds : [];
      const worldBookIds = requestedWorlds.filter((id) => availableWorlds.has(id));
      const unresolvedWorldBookIds = requestedWorlds.filter((id) => !availableWorlds.has(id));
      const requestedPresetId = nonEmptyText(sourceBindings.presetId) ? sourceBindings.presetId : "preset-default";
      const presetId = availablePresets.has(requestedPresetId) ? requestedPresetId : "preset-default";
      const settings = clone(this.chat.normalizeExperienceSettings({ ...session.settings, userPresetId: presetId }));
      const resourceBindings = {
        runtimeProfileId: nonEmptyText(contact.runtimeProfileId) ? contact.runtimeProfileId : null,
        worldVariantId: nonEmptyText(contact.worldVariantId) ? contact.worldVariantId : "default",
        worldBookMode: sourceBindings.worldBookMode === "explicit" ? "explicit" : "inherit",
        worldBookIds,
        presetId,
      };
      return {
        settings,
        resourceBindings,
        sceneContext: clone(this.experience.normalizeSceneContext(session.sceneContext)),
        unresolvedBindings: {
          worldBookIds: unresolvedWorldBookIds,
          presetId: presetId === requestedPresetId ? null : requestedPresetId,
          runtimeProfileRebound: Boolean(sourceBindings.runtimeProfileId && sourceBindings.runtimeProfileId !== resourceBindings.runtimeProfileId),
        },
      };
    }

    #capture(entries) {
      const missing = {};
      return entries.map(({ storage, key }) => {
        const value = storage.get(key, missing);
        return { storage, key, exists: value !== missing, value: value === missing ? undefined : clone(value) };
      });
    }

    #rollback(before, cause) {
      const rollbackErrors = [];
      [...before].reverse().forEach((entry) => {
        try {
          if (entry.exists) entry.storage.set(entry.key, clone(entry.value));
          else if (typeof entry.storage.remove === "function") entry.storage.remove(entry.key);
          else entry.storage.set(entry.key, null);
        } catch (error) { rollbackErrors.push({ key: entry.key, error }); }
      });
      if (rollbackErrors.length) throw transferError("CONVERSATION_TRANSFER_ROLLBACK_FAILED", "Chat import failed and local rollback was incomplete.", cause, { rollbackErrors });
      throw transferError("CONVERSATION_TRANSFER_COMMIT_FAILED", "Chat import was not saved; previous local data was restored.", cause);
    }
  }

  global.MercuryConversationTransferWorkflow = MercuryConversationTransferWorkflow;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryConversationTransferWorkflow;
})(typeof window !== "undefined" ? window : globalThis);

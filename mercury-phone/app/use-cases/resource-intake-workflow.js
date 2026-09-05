(function exposeMercuryResourceIntakeWorkflow(global) {
  "use strict";

  const DESTINATIONS = Object.freeze({ LIBRARY: "library", CHAT: "chat" });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const intakeError = (code, message, cause, detail = {}) => Object.assign(new Error(message), { code, cause, ...detail });

  function allocateId(requested, occupied, fallback) {
    const base = String(requested || fallback || "resource").trim() || String(fallback || "resource");
    if (!occupied.has(base)) {
      occupied.add(base);
      return base;
    }
    let suffix = 2;
    while (occupied.has(`${base}-${suffix}`)) suffix += 1;
    const id = `${base}-${suffix}`;
    occupied.add(id);
    return id;
  }

  function replaceIds(values, remap) {
    return Array.isArray(values) ? Array.from(new Set(values.map((value) => remap.get(String(value)) || String(value)).filter(Boolean))) : [];
  }

  function sameDisplayNameCount(contacts, displayName) {
    const normalized = String(displayName || "").trim().toLocaleLowerCase();
    if (!normalized || !contacts || typeof contacts !== "object") return 0;
    return Object.values(contacts).filter((contact) => String(contact?.name || "").trim().toLocaleLowerCase() === normalized).length;
  }

  function commitOutcome({ destination, resourceKind, sourceAsset, runtimeProfiles = [], worlds = [], profiles = [], contact = null, experience = null }) {
    return Object.freeze({
      status: "committed",
      destination,
      resourceKind,
      sourceAssetId: sourceAsset?.id || null,
      filename: sourceAsset?.filename || null,
      contactId: contact?.id || null,
      runtimeProfileIds: runtimeProfiles.map((profile) => profile.id),
      worldIds: worlds.map((world) => world.id),
      generationProfileIds: profiles.map((profile) => profile.id),
      displayName: contact?.name || runtimeProfiles[0]?.displayName || profiles[0]?.name || null,
      sameNameContactCount: contact ? sameDisplayNameCount(experience?.contacts, contact.name) : 0,
    });
  }

  class MercuryResourceIntakeWorkflow {
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.archiveStore = options.archiveStore || null;
      this.profileStore = options.profileStore || null;
      this.resources = options.resourceContracts || global.MercuryResourceContracts || null;
      this.archive = options.archiveContracts || global.MercuryArchiveContracts || null;
      this.profiles = options.profileContracts || global.MercuryGenerationProfileContracts || null;
      this.chat = options.chatContracts || global.MercuryChatExperienceContracts || null;
      this.now = typeof options.now === "function" ? options.now : () => Date.now();
      this.random = typeof options.random === "function" ? options.random : () => Math.random().toString(36).slice(2, 8);
      if (!this.storage || typeof this.storage.get !== "function" || typeof this.storage.set !== "function") {
        throw intakeError("RESOURCE_INTAKE_INVALID_STORAGE", "Resource Intake requires get and set storage operations.");
      }
      if (!this.archive || typeof this.archive.createSourceAsset !== "function" || typeof this.archive.resourceFromImport !== "function") {
        throw intakeError("RESOURCE_INTAKE_INVALID_ARCHIVE", "Resource Intake requires Archive contracts.");
      }
      if (!this.archiveStore || typeof this.archiveStore.load !== "function" || typeof this.archiveStore.save !== "function") {
        throw intakeError("RESOURCE_INTAKE_INVALID_ARCHIVE_STORE", "Resource Intake requires an Archive store.");
      }
      if (!this.resources || typeof this.resources.preflightMercuryResourceImport !== "function") {
        throw intakeError("RESOURCE_INTAKE_INVALID_RESOURCE_CONTRACTS", "Resource Intake requires Resource contracts.");
      }
    }

    inspect(input = {}) {
      const filename = String(input.filename || "local-import.json");
      let report;
      let rawText = typeof input.rawText === "string" ? input.rawText : "";
      if (input.bytes !== undefined) {
        if (typeof this.resources.preflightMercuryResourceBinary !== "function") {
          throw intakeError("RESOURCE_INTAKE_BINARY_UNAVAILABLE", "Binary resource inspection is unavailable.");
        }
        report = this.resources.preflightMercuryResourceBinary(input.bytes, { filename });
        if (typeof report?.sourceText === "string") rawText = report.sourceText;
      } else {
        report = this.resources.preflightMercuryResourceImport(rawText, { filename });
      }
      const sourceAsset = this.archive.createSourceAsset({
        ...input,
        filename,
        rawText,
        mimeType: input.mimeType || (input.bytes !== undefined ? "image/png" : "application/json"),
      });
      return { sourceAsset, report, inspectedAt: new Date(this.now()).toISOString() };
    }

    commit(stage, options = {}) {
      if (!isObject(stage?.sourceAsset) || !isObject(stage?.report)) {
        throw intakeError("RESOURCE_INTAKE_INVALID_STAGE", "Inspect a resource before committing it.");
      }
      const destination = options.destination || DESTINATIONS.LIBRARY;
      if (!Object.values(DESTINATIONS).includes(destination)) {
        throw intakeError("RESOURCE_INTAKE_INVALID_DESTINATION", `Unsupported Resource Intake destination: ${destination}.`);
      }
      if (destination === DESTINATIONS.CHAT && (!stage.report.ok || stage.report.resourceKind !== "roleCard")) {
        throw intakeError("RESOURCE_INTAKE_CHAT_REQUIRES_ROLE", "Only a valid role card can create a Chat contact.");
      }
      if (stage.report.ok && stage.report.resourceKind === "preset") return this.#commitPreset(stage);
      return this.#commitArchive(stage, destination, options);
    }

    #commitPreset(stage) {
      if (!this.profileStore || typeof (this.profileStore.importProfile || this.profileStore.add) !== "function") {
        throw intakeError("RESOURCE_INTAKE_PROFILE_STORE_UNAVAILABLE", "Generation Profile storage is unavailable.");
      }
      const keys = [this.profiles?.STORAGE_KEY].filter(Boolean);
      const before = this.#capture(keys);
      try {
        const profile = (this.profileStore.importProfile || this.profileStore.add).call(this.profileStore, {
          ...stage.report.resource.data,
          origin: "imported",
          creationMode: "import",
          provenance: {
            kind: "file-import",
            filename: stage.sourceAsset.filename,
            format: stage.report.format,
          },
        });
        const sourceAsset = clone(stage.sourceAsset);
        const profiles = [clone(profile)];
        return Object.freeze({
          resourceKind: "preset",
          sourceAsset,
          profile,
          runtimeProfiles: [],
          worlds: [],
          contact: null,
          experience: null,
          outcome: commitOutcome({ destination: DESTINATIONS.LIBRARY, resourceKind: "preset", sourceAsset, profiles }),
        });
      } catch (cause) {
        this.#rollback(before, cause);
      }
    }

    #commitArchive(stage, destination, options) {
      const report = stage.report;
      const sourceAsset = {
        ...this.archive.createSourceAsset({ ...stage.sourceAsset, userConfirmed: true }),
        assetType: stage.sourceAsset.assetType,
        detectedBlocks: clone(stage.sourceAsset.detectedBlocks),
        userConfirmed: true,
      };
      const parsed = sourceAsset.parseStatus === "parsed" ? this.#parse(sourceAsset.rawText) : {};
      const resources = this.archive.resourceFromImport(sourceAsset, parsed);
      const meaningful = resources.runtimeProfiles.length || resources.worlds.length || resources.promptModules.length;
      if (!meaningful && !report.ok) {
        throw intakeError("RESOURCE_INTAKE_UNSUPPORTED_RESOURCE", "The file does not contain a supported Mercury resource.");
      }

      const currentArchive = this.archiveStore.load();
      const prepared = this.#prepareArchiveResources(sourceAsset, resources, currentArchive);
      const nextArchive = this.archive.normalizeArchiveState({
        ...currentArchive,
        sourceAssets: [...currentArchive.sourceAssets, prepared.sourceAsset],
        runtimeProfiles: [...currentArchive.runtimeProfiles, ...prepared.runtimeProfiles],
        worlds: [...currentArchive.worlds, ...prepared.worlds],
      });
      const importedProfiles = this.#legacyProfiles(prepared);
      let contact = null;
      let experience = null;
      if (destination === DESTINATIONS.CHAT) {
        if (!this.chat || typeof this.chat.normalize !== "function") {
          throw intakeError("RESOURCE_INTAKE_CHAT_UNAVAILABLE", "Chat resource binding is unavailable.");
        }
        const profile = prepared.runtimeProfiles[0];
        experience = this.chat.normalize(this.storage.get(this.chat.STORAGE_KEY, null));
        contact = this.#createChatContact(report.resource, profile, prepared.worlds, experience, options.contactDefaults || {});
        experience.contacts[contact.id] = contact;
        nextArchive.contactInstances.push({
          id: allocateId(`contact-${profile.id}`, new Set(nextArchive.contactInstances.map((item) => item.id)), `contact-${this.now()}`),
          runtimeProfileId: profile.id,
          chatContactId: contact.id,
          displayName: profile.displayName,
          createdAt: new Date(this.now()).toISOString(),
          relationshipState: "new",
          timelineId: String(options.timelineId || "default"),
          active: true,
        });
      }

      const keys = [
        this.archive.STORAGE_KEY,
        destination === DESTINATIONS.CHAT ? this.chat?.STORAGE_KEY : null,
        importedProfiles.length ? this.profiles?.STORAGE_KEY : null,
      ].filter(Boolean);
      const before = this.#capture(keys);
      try {
        this.archiveStore.save(nextArchive);
        const savedProfiles = importedProfiles.map((profile) => {
          if (!this.profileStore || typeof (this.profileStore.importProfile || this.profileStore.add) !== "function") {
            throw intakeError("RESOURCE_INTAKE_PROFILE_STORE_UNAVAILABLE", "Generation Profile storage is unavailable.");
          }
          return (this.profileStore.importProfile || this.profileStore.add).call(this.profileStore, { ...profile, origin: "imported", creationMode: "import" });
        });
        if (experience) this.storage.set(this.chat.STORAGE_KEY, experience);
        const resourceKind = report.ok ? report.resourceKind : "classified-source";
        const committedSource = clone(prepared.sourceAsset);
        const committedRuntimeProfiles = clone(prepared.runtimeProfiles);
        const committedWorlds = clone(prepared.worlds);
        const committedProfiles = clone(savedProfiles);
        const committedContact = clone(contact);
        const committedExperience = clone(experience);
        return Object.freeze({
          resourceKind,
          sourceAsset: committedSource,
          runtimeProfiles: committedRuntimeProfiles,
          worlds: committedWorlds,
          profiles: committedProfiles,
          contact: committedContact,
          experience: committedExperience,
          outcome: commitOutcome({
            destination,
            resourceKind,
            sourceAsset: committedSource,
            runtimeProfiles: committedRuntimeProfiles,
            worlds: committedWorlds,
            profiles: committedProfiles,
            contact: committedContact,
            experience: committedExperience,
          }),
        });
      } catch (cause) {
        this.#rollback(before, cause);
      }
    }

    #prepareArchiveResources(sourceAsset, resources, state) {
      const sourceIds = new Set(state.sourceAssets.map((item) => item.id));
      const profileIds = new Set(state.runtimeProfiles.map((item) => item.id));
      const worldIds = new Set(state.worlds.map((item) => item.id));
      const preparedSource = clone(sourceAsset);
      preparedSource.id = allocateId(preparedSource.id, sourceIds, `asset-${this.now()}-${this.random()}`);
      preparedSource.userConfirmed = true;

      const profileRemap = new Map();
      const runtimeProfiles = resources.runtimeProfiles.map((profile) => {
        const next = clone(profile);
        const previousId = String(next.id || "");
        next.id = allocateId(previousId, profileIds, `runtime-${this.now()}-${this.random()}`);
        next.sourceAssetId = preparedSource.id;
        if (previousId) profileRemap.set(previousId, next.id);
        return next;
      });
      const worldRemap = new Map();
      const worlds = resources.worlds.map((world) => {
        const next = clone(world);
        const previousId = String(next.id || "");
        next.id = allocateId(previousId, worldIds, `world-${this.now()}-${this.random()}`);
        next.sourceAssetId = preparedSource.id;
        if (previousId) worldRemap.set(previousId, next.id);
        return next;
      });
      runtimeProfiles.forEach((profile) => { profile.worldBindings = replaceIds(profile.worldBindings, worldRemap); });
      worlds.forEach((world) => {
        world.relatedProfileIds = replaceIds(world.relatedProfileIds, profileRemap);
        world.entries = (world.entries || []).map((entry) => ({
          ...entry,
          runtimeProfileId: profileRemap.get(String(entry.runtimeProfileId || "")) || entry.runtimeProfileId,
          runtimeProfileIds: replaceIds(entry.runtimeProfileIds, profileRemap),
          relatedProfileIds: replaceIds(entry.relatedProfileIds, profileRemap),
        }));
      });
      const promptModules = resources.promptModules.map((module) => ({ ...clone(module), sourceAssetId: preparedSource.id }));
      return { sourceAsset: preparedSource, runtimeProfiles, worlds, promptModules };
    }

    #legacyProfiles(prepared) {
      if (!prepared.promptModules.length || !this.profiles?.migrateLegacySources) return [];
      const migrated = this.profiles.migrateLegacySources({
        legacyUserPresets: [],
        archiveState: {
          sourceAssets: [prepared.sourceAsset],
          runtimeProfiles: prepared.runtimeProfiles,
          worlds: prepared.worlds,
          promptModules: prepared.promptModules,
        },
        now: this.now(),
      });
      return Array.isArray(migrated?.profiles) ? migrated.profiles : [];
    }

    #createChatContact(role, profile, worlds, experience, defaults) {
      const occupied = new Set(Object.keys(experience.contacts));
      const requested = defaults.id || `import-${this.now()}-${this.random()}`;
      const id = allocateId(requested, occupied, `import-${this.now()}-${this.random()}`);
      const contact = this.resources.contactFromRoleCard(role, { ...defaults, id });
      contact.runtimeProfileId = profile.id;
      contact.worldBookIds = worlds.map((world) => world.id);
      contact.persona = {
        ...(contact.persona || {}),
        worldBindings: Array.from(new Set([...(Array.isArray(contact.persona?.worldBindings) ? contact.persona.worldBindings : []), ...contact.worldBookIds])),
      };
      return contact;
    }

    #parse(rawText) {
      try { return JSON.parse(String(rawText || "").replace(/^\uFEFF/, "").trim()); }
      catch { return {}; }
    }

    #capture(keys) {
      const missing = {};
      return keys.map((key) => {
        const value = this.storage.get(key, missing);
        return { key, exists: value !== missing, value: value === missing ? undefined : clone(value) };
      });
    }

    #rollback(before, cause) {
      const rollbackErrors = [];
      [...before].reverse().forEach((entry) => {
        try {
          if (entry.exists) this.storage.set(entry.key, clone(entry.value));
          else if (typeof this.storage.remove === "function") this.storage.remove(entry.key);
          else this.storage.set(entry.key, null);
        } catch (error) { rollbackErrors.push({ key: entry.key, error }); }
      });
      try { this.profileStore?.reload?.(); } catch (error) { rollbackErrors.push({ key: this.profiles?.STORAGE_KEY || "generation-profile", error }); }
      if (rollbackErrors.length) {
        throw intakeError("RESOURCE_INTAKE_ROLLBACK_FAILED", "Resource import failed and local rollback was incomplete.", cause, { rollbackErrors });
      }
      throw intakeError("RESOURCE_INTAKE_COMMIT_FAILED", "Resource import was not saved; previous local data was restored.", cause);
    }
  }

  MercuryResourceIntakeWorkflow.DESTINATIONS = DESTINATIONS;
  global.MercuryResourceIntakeWorkflow = MercuryResourceIntakeWorkflow;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryResourceIntakeWorkflow;
})(typeof window !== "undefined" ? window : globalThis);

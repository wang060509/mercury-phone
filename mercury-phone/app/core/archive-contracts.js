(function exposeMercuryArchiveContracts(global) {
  "use strict";

  const STORAGE_KEY = "archive.v1";
  const SOURCE_ASSET_TYPES = Object.freeze(["character-source", "world-source", "prompt-source", "mixed-source", "unknown-source"]);
  const RESOURCE_STATUSES = Object.freeze(["draft", "needs-review", "ready"]);
  const BLOCK_TYPES = Object.freeze(["character", "world", "prompt-module", "format-extension", "metadata", "unknown"]);
  const PROMPT_CATEGORIES = Object.freeze(["character-behavior", "relationship", "world-rule", "output-style", "format-extension", "unknown"]);
  const PROMPT_SCOPES = Object.freeze(["global", "character", "world", "conversation"]);
  const WORLD_ENTRY_TYPES = Object.freeze(["rule", "place", "group", "person", "history", "event", "object", "culture", "other"]);
  const WORLD_VISIBILITIES = Object.freeze(["objective", "public", "restricted", "character-specific"]);
  const WORLD_COVER_KEYS = Object.freeze(["glass-water", "water-starlight", "wind-chimes", "mercury-orb", "quill", "knowledge", "dialogue"]);

  const freeze = (value) => Object.freeze(value);
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const stringValue = (value, fallback = "") => typeof value === "string" ? value : fallback;
  const arrayValue = (value) => Array.isArray(value) ? value : [];
  const entryValues = (value) => Array.isArray(value) ? value : isObject(value) ? Object.values(value) : [];
  const uniqueId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const firstString = (...values) => values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
  const previewText = (value, limit = 180) => stringValue(value).replace(/\s+/g, " ").trim().slice(0, limit);
  const safeList = (value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).map((item) => stringValue(item)).filter(Boolean).slice(0, 24);
  const mergedList = (...values) => Array.from(new Set(values.flatMap(safeList))).slice(0, 24);
  const isoNow = () => new Date().toISOString();
  const firstObject = (...values) => values.find(isObject) || {};

  function pathValue(value, path, fallback = "") {
    return path.reduce((current, key) => current?.[key], value) ?? fallback;
  }

  function createDetectedBlock({ blockType, label, confidence, sourcePath, preview }) {
    return {
      id: uniqueId("block"),
      blockType: BLOCK_TYPES.includes(blockType) ? blockType : "unknown",
      label: stringValue(label, "Unclassified content"),
      confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "low",
      sourcePath: stringValue(sourcePath, "$"),
      preview: previewText(preview),
    };
  }

  function looksLikeMarkupOrCode(text) {
    return /<\/?(?:html|body|style|script|div|section|template)\b|(?:^|\s)(?:function|const|let|var)\s+\w+|javascript\s*:/i.test(text);
  }

  function classifySourceText({ rawText, filename = "local-import.json" } = {}) {
    const raw = stringValue(rawText);
    const blocks = [];
    let parsed = null;
    let parseStatus = "parsed";
    try { parsed = JSON.parse(raw); } catch { parseStatus = "invalid-json"; }

    if (parseStatus === "invalid-json") {
      blocks.push(createDetectedBlock({ blockType: looksLikeMarkupOrCode(raw) ? "format-extension" : "unknown", label: looksLikeMarkupOrCode(raw) ? "Markup or code text" : "Unparsed text", confidence: "high", sourcePath: "$", preview: raw }));
    } else {
      const source = isObject(parsed) ? parsed : { value: parsed };
      const keys = Object.keys(source).map((key) => key.toLowerCase());
      const resourceKind = firstString(source.resourceKind, source.resourceType, source.kind, source.type).toLowerCase();
      const isCinemaAu = ["cinema-au", "cinema_au", "parallel-world-script", "parallel_world_script"].includes(resourceKind);
      const characterValue = firstObject(source.character, source.profile, source.persona);
      const characterHit = !isCinemaAu && Boolean(characterValue.name || characterValue.displayName || source.name || source.identity || source.personality || source.traits || keys.some((key) => ["character", "persona", "personality", "identity", "traits"].includes(key)));
      const worldValue = firstObject(source.world, source.worldProfile, source.world_info, source.lorebook, source.character_book, source.data?.character_book);
      const worldEntries = source.entries || source.worlds || worldValue.entries;
      const worldHit = !isCinemaAu && Boolean(worldValue.name || worldValue.summary || worldEntries && typeof worldEntries === "object" || keys.some((key) => ["world", "worlds", "lore", "entries", "locations"].includes(key)));
      const promptHit = keys.some((key) => ["prompt", "prompts", "instruction", "instructions", "rules", "behaviorRules", "writingRules"].includes(key)) || Boolean(source.systemPrompt);
      const metadataHit = keys.some((key) => ["author", "creator", "version", "metadata", "description", "source"].includes(key));
      const serialized = JSON.stringify(parsed);
      const formatHit = looksLikeMarkupOrCode(serialized);
      if (characterHit) blocks.push(createDetectedBlock({ blockType: "character", label: "Character material", confidence: "high", sourcePath: characterValue.name ? "$.character" : "$.", preview: firstString(characterValue.summary, characterValue.description, source.summary, source.description, characterValue.name, source.name) }));
      if (worldHit) blocks.push(createDetectedBlock({ blockType: "world", label: "World material", confidence: Array.isArray(worldEntries) ? "high" : "medium", sourcePath: source.world ? "$.world" : (source.worlds ? "$.worlds" : "$."), preview: firstString(worldValue.summary, source.summary, Array.isArray(worldEntries) ? `${worldEntries.length} world entries` : "World-related fields detected") }));
      if (promptHit) blocks.push(createDetectedBlock({ blockType: "prompt-module", label: "Behavior or writing rules", confidence: "medium", sourcePath: source.prompt ? "$.prompt" : "$.", preview: firstString(source.prompt, source.instruction, source.instructions, source.rules, source.systemPrompt, "Rule-like text detected") }));
      if (formatHit) blocks.push(createDetectedBlock({ blockType: "format-extension", label: "Markup or code-like text", confidence: "high", sourcePath: "$.", preview: "Markup or code-like strings detected. They remain inactive text." }));
      if (metadataHit) blocks.push(createDetectedBlock({ blockType: "metadata", label: "Metadata", confidence: "low", sourcePath: "$.", preview: firstString(source.description, source.author, source.version, "Metadata fields detected") }));
      if (!blocks.length) blocks.push(createDetectedBlock({ blockType: "unknown", label: "Unclassified JSON", confidence: "low", sourcePath: "$", preview: serialized }));
    }

    const detectedTypes = new Set(blocks.map((block) => block.blockType));
    const assetType = detectedTypes.has("character") && detectedTypes.size === 1 ? "character-source" : detectedTypes.has("world") && detectedTypes.size === 1 ? "world-source" : detectedTypes.has("prompt-module") && detectedTypes.size === 1 ? "prompt-source" : detectedTypes.size > 1 ? "mixed-source" : "unknown-source";
    return { filename: stringValue(filename, "local-import.json"), rawText: raw, parseStatus, assetType, detectedBlocks: blocks, parsed };
  }

  function createSourceAsset(input = {}) {
    const result = classifySourceText(input);
    return {
      id: stringValue(input.id, uniqueId("asset")),
      assetType: SOURCE_ASSET_TYPES.includes(result.assetType) ? result.assetType : "unknown-source",
      filename: result.filename,
      mimeType: stringValue(input.mimeType, "application/json"),
      fileSize: Number.isFinite(input.fileSize) ? Number(input.fileSize) : null,
      importedAt: stringValue(input.importedAt, new Date().toISOString()),
      rawText: result.rawText,
      parseStatus: result.parseStatus,
      detectedBlocks: result.detectedBlocks,
      userConfirmed: Boolean(input.userConfirmed),
    };
  }

  function normalizeSourceAsset(asset) {
    if (!isObject(asset)) return null;
    const fallback = createSourceAsset({ id: asset.id, filename: asset.filename, mimeType: asset.mimeType, rawText: asset.rawText, fileSize: asset.fileSize, importedAt: asset.importedAt, userConfirmed: asset.userConfirmed });
    return { ...fallback, ...asset, assetType: SOURCE_ASSET_TYPES.includes(asset.assetType) ? asset.assetType : fallback.assetType, detectedBlocks: arrayValue(asset.detectedBlocks).map((block) => ({ ...createDetectedBlock(block), ...block, blockType: BLOCK_TYPES.includes(block.blockType) ? block.blockType : "unknown" })) };
  }

  function createRuntimeProfile({ sourceAssetId, data = {}, displayName = "Untitled character" } = {}) {
    const character = firstObject(data.character, data.profile, data.persona, data);
    return {
      id: uniqueId("runtime"),
      sourceAssetId: stringValue(sourceAssetId),
      displayName: firstString(displayName, character.displayName, character.name, "Untitled character"),
      identity: firstString(character.identity, character.role, character.description),
      summary: firstString(character.summary, character.description, data.summary),
      stableTraits: safeList(character.stableTraits || character.traits || character.personality),
      motivations: safeList(character.motivations || character.goals),
      fears: safeList(character.fears),
      values: safeList(character.values),
      boundaries: safeList(character.boundaries),
      careStyle: firstString(character.careStyle),
      conflictStyle: firstString(character.conflictStyle),
      defenseStyle: firstString(character.defenseStyle),
      voiceStyle: firstString(character.voiceStyle || character.voice),
      cognitionLimits: safeList(character.cognitionLimits),
      changeThresholds: safeList(character.changeThresholds),
      worldBindings: safeList(character.worldBindings || character.worlds),
      background: firstString(character.background, character.backstory, character.history),
      relationshipSummary: firstString(character.relationshipSummary, character.relationship, character.relationships),
      openingMessage: firstString(character.openingMessage, character.first_mes, character.firstMessage),
      alternateGreetings: safeList(character.alternateGreetings || character.alternate_greetings),
      exampleDialogues: safeList(character.exampleDialogues || character.mes_example || character.examples),
      scenePresentation: firstString(character.scenePresentation, character.scenario, character.scene),
      creatorNotes: firstString(character.creatorNotes, character.creator_notes, character.notes),
      inner_conflict: firstString(character.inner_conflict),
      politics: firstString(character.politics),
      signature_details: safeList(character.signature_details),
      lore: isObject(character.lore) ? { ...character.lore } : {},
      tags: safeList(character.tags),
      imageAssetId: stringValue(character.imageAssetId, "archive:glass-water-v1"),
      avatarAssetId: stringValue(character.avatarAssetId, "archive:wind-chimes-v1"),
      coverAssetId: stringValue(character.coverAssetId, "archive:glass-water-v1"),
      status: "needs-review",
    };
  }

  function normalizeRuntimeProfile(profile) {
    if (!isObject(profile)) return null;
    const normalized = createRuntimeProfile({ sourceAssetId: profile.sourceAssetId, data: profile, displayName: profile.displayName });
    return { ...normalized, ...profile, status: RESOURCE_STATUSES.includes(profile.status) ? profile.status : "needs-review" };
  }

  function createWorldEntry(input = {}) {
    return {
      id: stringValue(input.id || input.uid, uniqueId("entry")),
      type: WORLD_ENTRY_TYPES.includes(input.type) ? input.type : "other",
      title: firstString(input.title, input.name, input.comment, "Untitled entry"),
      summary: stringValue(input.summary),
      content: stringValue(input.content),
      aliases: mergedList(input.aliases || input.keys || input.key, input.secondary_keys || input.keysecondary),
      tags: safeList(input.tags),
      alwaysActive: Boolean(input.alwaysActive || input.constant),
      enabled: input.enabled !== false && input.disable !== true,
      priority: Number.isFinite(input.priority) ? Number(input.priority) : Number.isFinite(input.insertion_order) ? Number(input.insertion_order) : Number.isFinite(input.order) ? Number(input.order) : 0,
      visibility: WORLD_VISIBILITIES.includes(input.visibility) ? input.visibility : "public",
      relatedEntryIds: safeList(input.relatedEntryIds),
      activationMode: ["keyword", "title-fallback", "unkeyed-universal"].includes(input.activationMode) ? input.activationMode : "title-fallback",
      worldVariantId: stringValue(input.worldVariantId || input.variantId),
      worldVariantIds: safeList(input.worldVariantIds || input.variantIds),
      timelineId: stringValue(input.timelineId),
      timelineIds: safeList(input.timelineIds),
      runtimeProfileId: stringValue(input.runtimeProfileId || input.profileId || input.characterId),
      runtimeProfileIds: safeList(input.runtimeProfileIds || input.profileIds || input.characterIds),
      relatedProfileIds: safeList(input.relatedProfileIds || input.relatedProfiles),
      scope: isObject(input.scope) ? { ...input.scope } : undefined,
    };
  }

  function createWorldProfile({ sourceAssetId = "", data = {}, name = "" } = {}) {
    const world = firstObject(data.world, data.worldProfile, data);
    const rawEntries = entryValues(world.entries || data.entries || data.worlds);
    const createdAt = stringValue(world.createdAt, isoNow());
    return {
      id: uniqueId("world"),
      sourceAssetId,
      resourceKind: "knowledge-book",
      name: firstString(name, world.name, "Untitled world"),
      summary: firstString(world.summary, world.description),
      foundations: safeList(world.foundations || world.rules),
      entries: rawEntries.map(createWorldEntry),
      tags: safeList(world.tags),
      relatedProfileIds: safeList(world.relatedProfileIds || world.relatedProfiles),
      worldVariantId: stringValue(world.worldVariantId || world.variantId),
      worldVariantIds: safeList(world.worldVariantIds || world.variantIds),
      timelineId: stringValue(world.timelineId),
      timelineIds: safeList(world.timelineIds),
      scope: isObject(world.scope) ? { ...world.scope } : undefined,
      coverKey: WORLD_COVER_KEYS.includes(world.coverKey) ? world.coverKey : "",
      favorite: Boolean(world.favorite),
      createdAt,
      updatedAt: stringValue(world.updatedAt, createdAt),
      lastOpenedAt: stringValue(world.lastOpenedAt),
      status: "needs-review",
    };
  }

  function normalizeWorldProfile(world) {
    if (!isObject(world)) return null;
    const normalized = createWorldProfile({ sourceAssetId: world.sourceAssetId, data: world, name: world.name });
    return {
      ...normalized,
      ...world,
      resourceKind: "knowledge-book",
      entries: entryValues(world.entries).map(createWorldEntry),
      tags: safeList(world.tags),
      relatedProfileIds: safeList(world.relatedProfileIds || world.relatedProfiles),
      worldVariantId: stringValue(world.worldVariantId || world.variantId),
      worldVariantIds: safeList(world.worldVariantIds || world.variantIds),
      timelineId: stringValue(world.timelineId),
      timelineIds: safeList(world.timelineIds),
      scope: isObject(world.scope) ? { ...world.scope } : undefined,
      coverKey: WORLD_COVER_KEYS.includes(world.coverKey) ? world.coverKey : "",
      favorite: Boolean(world.favorite),
      createdAt: stringValue(world.createdAt, normalized.createdAt),
      updatedAt: stringValue(world.updatedAt, normalized.updatedAt),
      lastOpenedAt: stringValue(world.lastOpenedAt),
      status: RESOURCE_STATUSES.includes(world.status) ? world.status : "needs-review",
    };
  }

  function createPromptModule({ sourceAssetId = "", category = "unknown", scope = "conversation", title = "Imported rule", content = "" } = {}) {
    return { id: uniqueId("module"), sourceAssetId, category: PROMPT_CATEGORIES.includes(category) ? category : "unknown", title: firstString(title, "Imported rule"), content: stringValue(content), enabled: false, scope: PROMPT_SCOPES.includes(scope) ? scope : "conversation", priority: 0, source: "imported" };
  }

  function createArchiveState() { return { schemaVersion: 1, sourceAssets: [], runtimeProfiles: [], worlds: [], promptModules: [], contactInstances: [] }; }

  function normalizeArchiveState(value) {
    const source = isObject(value) ? value : {};
    return { schemaVersion: 1, sourceAssets: arrayValue(source.sourceAssets).map(normalizeSourceAsset).filter(Boolean), runtimeProfiles: arrayValue(source.runtimeProfiles).map(normalizeRuntimeProfile).filter(Boolean), worlds: arrayValue(source.worlds).map(normalizeWorldProfile).filter(Boolean), promptModules: arrayValue(source.promptModules).filter(isObject).map((module) => ({ ...createPromptModule(module), ...module, category: PROMPT_CATEGORIES.includes(module.category) ? module.category : "unknown", scope: PROMPT_SCOPES.includes(module.scope) ? module.scope : "conversation", enabled: Boolean(module.enabled) })), contactInstances: arrayValue(source.contactInstances).filter(isObject).map((contact) => ({ id: stringValue(contact.id, uniqueId("contact")), runtimeProfileId: stringValue(contact.runtimeProfileId), chatContactId: stringValue(contact.chatContactId), displayName: firstString(contact.displayName, "Untitled contact"), createdAt: stringValue(contact.createdAt, new Date().toISOString()), relationshipState: stringValue(contact.relationshipState, "new"), timelineId: stringValue(contact.timelineId, uniqueId("timeline")), active: contact.active !== false })) };
  }

  function createManualCharacter() {
    const asset = createSourceAsset({ filename: "manual-character", mimeType: "application/x-mercury-source", rawText: "", userConfirmed: true });
    asset.assetType = "character-source";
    asset.parseStatus = "manual";
    const profile = createRuntimeProfile({ sourceAssetId: asset.id, data: {}, displayName: "Untitled character" });
    profile.status = "draft";
    return { asset, profile };
  }

  function createManualWorld(input = {}) {
    const asset = createSourceAsset({ filename: "manual-world", mimeType: "application/x-mercury-source", rawText: "", userConfirmed: true });
    asset.assetType = "world-source";
    asset.parseStatus = "manual";
    return { asset, world: createWorldProfile({ sourceAssetId: asset.id, data: input, name: firstString(input.name, "Untitled world") }) };
  }

  function resourceFromImport(asset, parsed) {
    const resourceContracts = global.MercuryResourceContracts;
    const normalized = resourceContracts?.preflightMercuryResourceImport?.(asset.rawText, { filename: asset.filename });
    if (normalized?.ok && normalized.resourceKind === "roleCard") {
      const role = normalized.resource;
      const profile = createRuntimeProfile({ sourceAssetId: asset.id, displayName: role.displayName, data: { ...role.profile, displayName: role.displayName, identity: role.identity, summary: role.summary, openingMessage: role.openingMessage, tags: role.tags } });
      profile.id = role.id;
      profile.status = "ready";
      const worlds = (normalized.relatedResources || []).map((worldResource) => {
        const world = createWorldProfile({ sourceAssetId: asset.id, name: worldResource.name, data: { ...worldResource, entries: worldResource.entries.map((entry) => ({ ...entry, aliases: entry.keys })) } });
        world.id = worldResource.id;
        world.relatedProfileIds = [profile.id];
        return world;
      });
      profile.worldBindings = worlds.map((world) => world.id);
      return { runtimeProfiles: [profile], worlds, promptModules: [] };
    }
    if (normalized?.ok && normalized.resourceKind === "worldBook") {
      const resource = normalized.resource;
      const world = createWorldProfile({ sourceAssetId: asset.id, name: resource.name, data: { ...resource, entries: resource.entries.map((entry) => ({ ...entry, aliases: entry.keys })) } });
      world.id = resource.id;
      return { runtimeProfiles: [], worlds: [world], promptModules: [] };
    }
    const source = isObject(parsed) ? parsed : {};
    const blocks = arrayValue(asset.detectedBlocks);
    const hasCharacter = blocks.some((block) => block.blockType === "character");
    const hasWorld = blocks.some((block) => block.blockType === "world");
    const hasPrompt = blocks.some((block) => block.blockType === "prompt-module");
    const embeddedBook = firstObject(source.character_book, source.data?.character_book);
    const runtimeProfiles = hasCharacter ? [createRuntimeProfile({ sourceAssetId: asset.id, data: source.data || source, displayName: firstString(source.name, source.data?.name, source.character?.name, source.profile?.name) })] : [];
    const worldData = Object.keys(embeddedBook).length ? embeddedBook : source;
    const filename = stringValue(asset.filename, "").replace(/\.[^.]+$/, "");
    const worlds = hasWorld ? [createWorldProfile({ sourceAssetId: asset.id, data: worldData, name: firstString(worldData.name, source.world?.name, source.worldProfile?.name, source.name, filename) })] : [];
    if (runtimeProfiles[0] && worlds[0]) {
      runtimeProfiles[0].worldBindings = [worlds[0].id];
      worlds[0].relatedProfileIds = [runtimeProfiles[0].id];
    }
    return {
      runtimeProfiles,
      worlds,
      promptModules: hasPrompt ? [createPromptModule({ sourceAssetId: asset.id, title: "Imported behavior rules", content: firstString(source.prompt, source.instructions, source.rules, source.systemPrompt, "Rule-like content detected") })] : [],
    };
  }

  function repairImportedRoleProfileState(state, resourceContracts, runtimeProfileIds = []) {
    if (!resourceContracts || typeof resourceContracts.preflightMercuryResourceImport !== "function") {
      throw new TypeError("Imported role repair requires Resource contracts.");
    }
    const normalized = normalizeArchiveState(state);
    const selectedIds = new Set(arrayValue(runtimeProfileIds).map((id) => stringValue(id)).filter(Boolean));
    const assets = new Map(normalized.sourceAssets.map((asset) => [asset.id, asset]));
    const profileFields = ["summary", "stableTraits", "motivations", "fears", "values", "boundaries", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "inner_conflict", "politics", "signature_details", "lore"];
    const missing = (value) => value === undefined || value === null || value === "" || Array.isArray(value) && value.length === 0;
    const repairs = [];
    let changed = false;

    normalized.runtimeProfiles.forEach((profile) => {
      if (selectedIds.size && !selectedIds.has(profile.id)) return;
      const asset = assets.get(profile.sourceAssetId);
      if (!asset?.rawText) return;
      const report = resourceContracts.preflightMercuryResourceImport(asset.rawText, { filename: asset.filename });
      if (!report.ok || report.resourceKind !== "roleCard") return;
      const role = report.resource;
      let profileChanged = false;
      if (missing(profile.identity) || profile.identity === "Imported character") {
        profile.identity = role.identity;
        profileChanged = true;
      }
      profileFields.forEach((key) => {
        if (missing(profile[key]) && !missing(role.profile?.[key])) {
          profile[key] = role.profile[key];
          profileChanged = true;
        }
      });
      changed ||= profileChanged;
      repairs.push(Object.freeze({ profileId: profile.id, role, changed: profileChanged }));
    });
    return Object.freeze({ state: normalized, changed, repairs: Object.freeze(repairs) });
  }

  function createArchiveStore(storage) {
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") throw new TypeError("ArchiveStore requires scoped storage.");
    const load = () => normalizeArchiveState(storage.get(STORAGE_KEY, createArchiveState()));
    const save = (state) => {
      const normalized = normalizeArchiveState(state);
      // Legacy promptModules remain readable for migration, but archive.v1 is
      // no longer allowed to create, update, or delete them.
      normalized.promptModules = normalizeArchiveState(storage.get(STORAGE_KEY, createArchiveState())).promptModules;
      try { storage.set(STORAGE_KEY, normalized); } catch (err) { throw Object.assign(new Error("Failed to write Archive data."), { code: "ARCHIVE_STORAGE_WRITE_FAILED", cause: err }); }
      return normalized;
    };
    return Object.freeze({
      load,
      save,
      repairImportedRoleProfiles(options = {}) {
        const result = repairImportedRoleProfileState(load(), options.resourceContracts, options.runtimeProfileIds);
        const state = result.changed ? save(result.state) : result.state;
        const profiles = new Map(state.runtimeProfiles.map((profile) => [profile.id, profile]));
        return Object.freeze({
          changed: result.changed,
          repairs: Object.freeze(result.repairs.map((repair) => Object.freeze({ ...repair, profile: profiles.get(repair.profileId) || null }))),
        });
      },
      confirmImport(candidate) {
        const sourceAsset = normalizeSourceAsset({ ...candidate, userConfirmed: true, id: candidate.id || uniqueId("asset") });
        const parsed = sourceAsset.parseStatus === "parsed" ? (() => { try { return JSON.parse(sourceAsset.rawText); } catch { return {}; } })() : {};
        const resources = resourceFromImport(sourceAsset, parsed);
        const state = load();
        state.sourceAssets.push(sourceAsset);
        state.runtimeProfiles.push(...resources.runtimeProfiles);
        state.worlds.push(...resources.worlds);
        // promptModules are retained only as a legacy import shape. New prompt
        // content is promoted by Archive into the shared Generation Profile
        // store and must not create fresh archive.v1 promptModules records.
        save(state);
        return { sourceAsset, ...resources };
      },
      createManualCharacter() { const state = load(); const result = createManualCharacter(); state.sourceAssets.push(result.asset); state.runtimeProfiles.push(result.profile); save(state); return result.profile; },
      createManualWorld(input = {}) { const state = load(); const result = createManualWorld(input); state.sourceAssets.push(result.asset); state.worlds.push(result.world); save(state); return result.world; },
      updateRuntimeProfile(profile) { const state = load(); const index = state.runtimeProfiles.findIndex((item) => item.id === profile.id); if (index < 0) return null; state.runtimeProfiles[index] = normalizeRuntimeProfile(profile); save(state); return state.runtimeProfiles[index]; },
      updateWorld(world) { const state = load(); const index = state.worlds.findIndex((item) => item.id === world.id); if (index < 0) return null; state.worlds[index] = normalizeWorldProfile({ ...world, updatedAt: isoNow() }); save(state); return state.worlds[index]; },
      createContactInstance(runtimeProfileId, options = {}) { const state = load(); const profile = state.runtimeProfiles.find((item) => item.id === runtimeProfileId); if (!profile) throw new Error("Runtime profile not found."); const contact = { id: uniqueId("contact"), runtimeProfileId, chatContactId: stringValue(options.chatContactId), displayName: profile.displayName, createdAt: new Date().toISOString(), relationshipState: "new", timelineId: stringValue(options.timelineId, uniqueId("timeline")), active: true }; state.contactInstances.push(contact); save(state); return contact; },
      linkContactInstance(runtimeProfileId, chatContactId) { const state = load(); const index = state.contactInstances.findIndex((item) => item.runtimeProfileId === runtimeProfileId && item.active !== false); if (index < 0) return null; state.contactInstances[index] = { ...state.contactInstances[index], chatContactId: stringValue(chatContactId) }; save(state); return state.contactInstances[index]; },
      deleteCharacter(runtimeProfileId) { const state = load(); const before = state.runtimeProfiles.length; state.runtimeProfiles = state.runtimeProfiles.filter((profile) => profile.id !== runtimeProfileId); state.contactInstances = state.contactInstances.filter((contact) => contact.runtimeProfileId !== runtimeProfileId); save(state); return state.runtimeProfiles.length !== before; },
      duplicateWorld(worldId) {
        const state = load();
        const original = state.worlds.find((item) => item.id === worldId);
        if (!original) return null;
        const copiedEntries = original.entries.map(({ id, ...entry }) => entry);
        const result = createManualWorld({
          ...original,
          name: `${original.name || "Untitled world"} copy`,
          entries: copiedEntries,
          favorite: false,
          createdAt: isoNow(),
          updatedAt: isoNow(),
          lastOpenedAt: "",
        });
        state.sourceAssets.push(result.asset);
        state.worlds.push(result.world);
        save(state);
        return result.world;
      },
      touchWorld(worldId) {
        const state = load();
        const world = state.worlds.find((item) => item.id === worldId);
        if (!world) return null;
        world.lastOpenedAt = isoNow();
        save(state);
        return world;
      },
      updateWorldEntry(worldId, entry) { const state = load(); const world = state.worlds.find((item) => item.id === worldId); if (!world) return null; const normalized = createWorldEntry(entry); const index = world.entries.findIndex((item) => item.id === normalized.id); if (index < 0) world.entries.push(normalized); else world.entries[index] = normalized; world.updatedAt = isoNow(); save(state); return normalized; },
    });
  }

  const ARCHIVE_STORAGE_WRITE_FAILED = "ARCHIVE_STORAGE_WRITE_FAILED";
  const EXPORT_PROFILE_FIELDS = Object.freeze(["displayName", "identity", "summary", "stableTraits", "motivations", "fears", "values", "boundaries", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "cognitionLimits", "changeThresholds", "worldBindings", "background", "relationshipSummary", "openingMessage", "alternateGreetings", "exampleDialogues", "scenePresentation", "creatorNotes", "tags"]);

  function serializeForExport(profile) {
    const source = isObject(profile) ? profile : {};
    const card = { kind: "runtime-profile", schemaVersion: 1 };
    EXPORT_PROFILE_FIELDS.forEach((key) => {
      const value = source[key];
      if (value === undefined || value === null) return;
      card[key] = typeof value === "string" ? value : arrayValue(value);
    });
    return card;
  }

  global.MercuryArchiveContracts = Object.freeze({ STORAGE_KEY, SOURCE_ASSET_TYPES, RESOURCE_STATUSES, BLOCK_TYPES, PROMPT_CATEGORIES, PROMPT_SCOPES, WORLD_ENTRY_TYPES, WORLD_VISIBILITIES, WORLD_COVER_KEYS, ARCHIVE_STORAGE_WRITE_FAILED, EXPORT_PROFILE_FIELDS, serializeForExport, classifySourceText, createSourceAsset, normalizeArchiveState, createRuntimeProfile, createWorldProfile, createWorldEntry, createPromptModule, createArchiveState, resourceFromImport, createArchiveStore });
})(window);

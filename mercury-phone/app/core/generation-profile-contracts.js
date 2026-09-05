(function exposeMercuryGenerationProfileContracts(global) {
  "use strict";

  const STORAGE_KEY = "generation-profiles.v1";
  const LEGACY_USER_PRESET_KEY = "mercury.apps.chats.userPresets";
  const ARCHIVE_STORAGE_KEY = "archive.v1";
  const RESOURCE_KIND = "mercury.generation-profile";
  const SCHEMA_VERSION = 1;
  const DEFAULT_PROFILE_ID = "preset-default";
  const MIGRATION_REVISION = 1;
  const COMPATIBILITY_ADAPTER_REVISION = 2;
  const DEFAULT_COVER = Object.freeze({ kind: "asset", value: "archive:glass-water-v1" });

  const content = global.MercuryPresetContent || null;
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => typeof value === "string" ? value : fallback;
  const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
  const list = (value) => Array.isArray(value) ? value : [];
  const slug = (value, fallback = "item") => String(value || fallback).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || fallback;
  const stableHash = (value) => {
    const source = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };
  const now = () => Date.now();
  const knownModule = (id) => Boolean(content?.MODULE_TEXTS && Object.prototype.hasOwnProperty.call(content.MODULE_TEXTS, id));

  function normalizeModules(value) {
    const source = isObject(value) ? value : {};
    const rawEnabled = isObject(source.enabled) ? source.enabled : {};
    const enabled = {};
    Object.entries(rawEnabled).forEach(([id, state]) => { if (knownModule(String(id))) enabled[String(id)] = state === true; });
    const order = [];
    list(source.order).map(String).forEach((id) => { if (knownModule(id) && !order.includes(id)) order.push(id); });
    Object.keys(enabled).forEach((id) => { if (!order.includes(id)) order.push(id); });
    return { order, enabled };
  }

  function normalizePreferences(value) {
    const source = isObject(value) ? value : {};
    const preferences = {};
    Object.entries(source).forEach(([key, item]) => { if (nonEmpty(item)) preferences[String(key)] = item.trim(); });
    return preferences;
  }

  function normalizeInstructionBlock(value, index = 0) {
    if (!isObject(value)) return null;
    const blockId = nonEmpty(value.id) ? value.id.trim() : `block-${index + 1}`;
    return {
      id: blockId,
      title: nonEmpty(value.title) ? value.title.trim() : blockId,
      content: text(value.content),
      enabled: value.enabled === true,
      order: Number.isFinite(value.order) ? Number(value.order) : index,
      category: nonEmpty(value.category) ? value.category.trim() : "user-instruction",
      scope: nonEmpty(value.scope) ? value.scope.trim() : "conversation",
      source: nonEmpty(value.source) ? value.source.trim() : "user",
      runtimeEligible: value.runtimeEligible !== false,
      legacyModuleId: nonEmpty(value.legacyModuleId) ? value.legacyModuleId.trim() : undefined,
      compatibility: isObject(value.compatibility) ? clone(value.compatibility) : undefined,
      provenance: isObject(value.provenance) ? clone(value.provenance) : undefined,
    };
  }

  function ensureCustomBlock(blocks, custom) {
    const instructions = isObject(custom) && nonEmpty(custom.instructions) ? custom.instructions.trim() : "";
    if (!instructions) return blocks;
    const existing = blocks.findIndex((block) => block.id === "block-custom");
    const block = normalizeInstructionBlock({ id: "block-custom", title: "用户指令", content: instructions, enabled: true, order: blocks.length, category: "user-instruction", source: "user", runtimeEligible: true }, blocks.length);
    if (existing >= 0) blocks[existing] = { ...blocks[existing], ...block, order: blocks[existing].order };
    else blocks.push(block);
    return blocks;
  }

  function normalizeCover(value) {
    if (!isObject(value)) return clone(DEFAULT_COVER);
    if (value.kind === "data-url" && nonEmpty(value.value) && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(value.value)) return { kind: "data-url", value: value.value };
    if (value.kind === "asset" && nonEmpty(value.value)) return { kind: "asset", value: value.value.trim() };
    return clone(DEFAULT_COVER);
  }

  function externalCompatibility(value) {
    return isObject(value) && (
      value.format === "external-chat-preset"
      || value.capabilities?.textVariables === true
      || /^external-(?:prompt|message|instruction|generation)/.test(text(value.format))
    );
  }

  function normalizeCompatibility(value) {
    if (!isObject(value)) return undefined;
    const compatibility = clone(value);
    if (!externalCompatibility(compatibility)) return compatibility;
    const blocks = list(compatibility.blocks).filter(isObject).map((block, index) => {
      const copy = clone(block);
      const position = copy.injection?.position ?? copy.injection_position ?? copy.position ?? null;
      const role = text(copy.role).trim();
      const relative = position === null || position === 0 || position === "0" || position === "system" || position === "relative";
      const completeSourceBlock = typeof copy.enabled === "boolean" && typeof copy.content === "string";
      copy.enabled = completeSourceBlock ? copy.enabled === true : copy.runtimeActive === true;
      copy.runtimeActive = completeSourceBlock
        ? Boolean(copy.enabled && nonEmpty(copy.content) && (!role || role === "system") && relative)
        : copy.runtimeActive === true;
      if (!isObject(copy.injection)) copy.injection = { position, depth: copy.injection_depth ?? copy.depth ?? null, order: copy.injection_order ?? copy.order ?? index };
      return copy;
    });
    const preservedSettingsCount = Number.isFinite(compatibility.runtime?.preservedSettingsCount)
      ? Number(compatibility.runtime.preservedSettingsCount)
      : list(compatibility.preservedSettings).length;
    return {
      ...compatibility,
      adapterRevision: COMPATIBILITY_ADAPTER_REVISION,
      capabilities: { ...(isObject(compatibility.capabilities) ? compatibility.capabilities : {}), textVariables: true },
      blocks,
      runtime: {
        ...(isObject(compatibility.runtime) ? compatibility.runtime : {}),
        activeCount: blocks.filter((block) => block.runtimeActive).length,
        preservedCount: blocks.filter((block) => block.enabled && !block.runtimeActive).length,
        preservedSettingsCount,
      },
    };
  }

  function needsCompatibilityUpgrade(value) {
    return list(value?.profiles).some((profile) => externalCompatibility(profile?.compatibility) && Number(profile.compatibility.adapterRevision) !== COMPATIBILITY_ADAPTER_REVISION);
  }

  function normalizeProfile(value, options = {}) {
    if (!isObject(value) || !nonEmpty(value.id)) return null;
    const createdAt = Number(value.createdAt) || Number(options.now) || now();
    const compatibility = normalizeCompatibility(value.compatibility);
    const blocks = list(value.instructionBlocks).map(normalizeInstructionBlock).filter(Boolean);
    ensureCustomBlock(blocks, value.custom);
    const seenBlocks = new Set();
    const compatibilityBlocks = new Map(list(compatibility?.blocks).map((block) => [`compat.block.${slug(block?.id, "block")}`, block]));
    const instructionBlocks = blocks.filter((block) => {
      if (seenBlocks.has(block.id)) return false;
      seenBlocks.add(block.id);
      return true;
    }).sort((a, b) => a.order - b.order).map((block, index) => {
      const sourceBlock = compatibilityBlocks.get(block.legacyModuleId);
      return sourceBlock
        ? { ...block, enabled: sourceBlock.enabled === true, runtimeEligible: sourceBlock.runtimeActive === true, compatibility: clone(sourceBlock), order: index }
        : { ...block, order: index };
    });
    return {
      id: value.id.trim(),
      kind: RESOURCE_KIND,
      schemaVersion: SCHEMA_VERSION,
      name: nonEmpty(value.name) ? value.name.trim() : value.id.trim(),
      description: text(value.description).trim(),
      origin: value.origin === "imported" ? "imported" : "user",
      creationMode: ["blank", "remix", "import", "legacy-user-preset", "legacy-archive-module"].includes(value.creationMode) ? value.creationMode : "blank",
      remixOf: nonEmpty(value.remixOf) ? value.remixOf.trim() : null,
      readOnly: false,
      cover: normalizeCover(value.cover),
      modules: normalizeModules(value.modules),
      preferences: normalizePreferences(value.preferences),
      instructionBlocks,
      // Kept as a compatibility mirror while the existing editor is still in
      // Chat. Runtime assembly de-duplicates it against block-custom.
      custom: { instructions: isObject(value.custom) && nonEmpty(value.custom.instructions) ? value.custom.instructions.trim() : null },
      acceptedConflicts: list(value.acceptedConflicts).map(String).filter(Boolean),
      compatibility,
      provenance: isObject(value.provenance) ? clone(value.provenance) : undefined,
      createdAt,
      updatedAt: Number(value.updatedAt) || createdAt,
    };
  }

  function builtinDefault() {
    const preset = content?.DEFAULT_PRESET || { id: DEFAULT_PROFILE_ID, name: "默认预设", modules: { order: [], enabled: {} }, custom: { instructions: null } };
    return Object.freeze({
      ...clone(preset),
      kind: RESOURCE_KIND,
      schemaVersion: SCHEMA_VERSION,
      description: "Mercury 默认生成体验",
      origin: "mercury",
      creationMode: "builtin",
      remixOf: null,
      readOnly: true,
      cover: clone(DEFAULT_COVER),
      preferences: clone(preset.preferences || {}),
      instructionBlocks: [],
      acceptedConflicts: clone(preset.acceptedConflicts || []),
      createdAt: 0,
      updatedAt: 0,
    });
  }

  const BUILTIN_PROFILES = Object.freeze([builtinDefault()]);
  const RESERVED_IDS = Object.freeze(BUILTIN_PROFILES.map((profile) => profile.id));
  const isReservedId = (id) => RESERVED_IDS.includes(String(id));

  function emptyStore() {
    return { schemaVersion: SCHEMA_VERSION, profiles: [], migration: null };
  }

  function normalizeStore(value) {
    const source = isObject(value) ? value : {};
    const ids = new Set();
    const profiles = list(source.profiles).map((profile) => normalizeProfile(profile)).filter((profile) => {
      if (!profile || isReservedId(profile.id) || ids.has(profile.id)) return false;
      ids.add(profile.id);
      return true;
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      profiles,
      migration: isObject(source.migration) ? clone(source.migration) : null,
    };
  }

  function parseLegacyPresetList(value, warnings) {
    if (typeof value === "string") {
      try { return parseLegacyPresetList(JSON.parse(value), warnings); }
      catch { warnings.push({ code: "legacy_user_presets_invalid_json" }); return []; }
    }
    if (!Array.isArray(value)) return [];
    return value.filter(isObject);
  }

  function compatibilityBlockFor(moduleId, compatibility) {
    const blocks = list(compatibility?.blocks);
    return blocks.find((block) => `compat.block.${slug(block?.id, "block")}` === moduleId) || null;
  }

  function splitLegacyModules(preset, warnings) {
    const source = isObject(preset.modules) ? preset.modules : {};
    const rawEnabled = isObject(source.enabled) ? source.enabled : {};
    const rawTexts = isObject(source.texts) ? source.texts : {};
    const ordered = list(source.order).map(String);
    Object.keys(rawEnabled).forEach((id) => { if (!ordered.includes(id)) ordered.push(id); });
    Object.keys(rawTexts).forEach((id) => { if (!ordered.includes(id)) ordered.push(id); });
    const modules = { order: [], enabled: {} };
    const instructionBlocks = [];
    ordered.forEach((id, index) => {
      if (knownModule(id)) {
        modules.order.push(id);
        modules.enabled[id] = rawEnabled[id] === true;
        if (nonEmpty(rawTexts[id])) {
          instructionBlocks.push(normalizeInstructionBlock({
            id: `block-override-${slug(id)}-${stableHash(id)}`,
            title: `保留的模块文本：${id}`,
            content: rawTexts[id],
            enabled: false,
            order: instructionBlocks.length,
            category: "compatibility",
            source: "legacy-user-preset",
            runtimeEligible: false,
            legacyModuleId: id,
            compatibility: { reason: "known_module_text_was_not_runtime_active" },
          }, instructionBlocks.length));
        }
        return;
      }
      const carried = nonEmpty(rawTexts[id]) ? rawTexts[id].trim() : "";
      const compatible = compatibilityBlockFor(id, preset.compatibility);
      const runtimeEligible = compatible ? compatible.runtimeActive === true : Boolean(carried);
      instructionBlocks.push(normalizeInstructionBlock({
        id: `block-${slug(id)}-${stableHash(id)}`,
        title: nonEmpty(compatible?.name) ? compatible.name : id,
        content: carried,
        enabled: typeof compatible?.enabled === "boolean" ? compatible.enabled : rawEnabled[id] === true,
        order: instructionBlocks.length,
        category: "imported-instruction",
        source: "legacy-user-preset",
        runtimeEligible,
        legacyModuleId: id,
        compatibility: compatible ? clone(compatible) : carried ? undefined : { reason: "missing_text" },
      }, instructionBlocks.length));
      if (!carried) warnings.push({ code: "legacy_module_without_text", profileId: preset.id, moduleId: id });
    });
    return { modules, instructionBlocks };
  }

  function allocateId(requested, occupied) {
    let candidate = requested;
    let suffix = 2;
    while (occupied.has(candidate) || isReservedId(candidate)) candidate = `${requested}-${suffix++}`;
    occupied.add(candidate);
    return candidate;
  }

  function profileFromLegacyPreset(preset, occupied, idRemap, warnings, timestamp) {
    if (!nonEmpty(preset.id)) { warnings.push({ code: "legacy_preset_missing_id" }); return null; }
    const oldId = preset.id.trim();
    const requested = isReservedId(oldId) ? `profile-migrated-${slug(oldId)}-${stableHash(JSON.stringify(preset))}` : oldId;
    const id = allocateId(requested, occupied);
    if (id !== oldId && !Object.prototype.hasOwnProperty.call(idRemap, oldId)) idRemap[oldId] = id;
    const split = splitLegacyModules(preset, warnings);
    const blocks = split.instructionBlocks;
    ensureCustomBlock(blocks, preset.custom);
    return normalizeProfile({
      ...preset,
      id,
      origin: isObject(preset.compatibility) ? "imported" : "user",
      creationMode: "legacy-user-preset",
      cover: DEFAULT_COVER,
      modules: split.modules,
      instructionBlocks: blocks,
      provenance: { kind: "legacy-user-preset", sourceKey: LEGACY_USER_PRESET_KEY, legacyId: oldId },
      createdAt: Number(preset.createdAt) || timestamp,
      updatedAt: Number(preset.updatedAt) || Number(preset.createdAt) || timestamp,
    }, { now: timestamp });
  }

  function archiveModuleBlock(module, index) {
    const scope = nonEmpty(module.scope) ? module.scope.trim() : "conversation";
    return normalizeInstructionBlock({
      id: nonEmpty(module.id) ? module.id.trim() : `legacy-module-${index + 1}`,
      title: nonEmpty(module.title) ? module.title.trim() : `迁移指令 ${index + 1}`,
      content: text(module.content),
      enabled: module.enabled === true,
      order: index,
      category: nonEmpty(module.category) ? module.category.trim() : "unknown",
      scope,
      source: nonEmpty(module.source) ? module.source.trim() : "legacy-archive",
      runtimeEligible: scope === "conversation" || scope === "runtime",
      legacyModuleId: nonEmpty(module.id) ? module.id.trim() : undefined,
      compatibility: (scope === "conversation" || scope === "runtime") ? undefined : { reason: "legacy_scope_was_not_runtime_active" },
      provenance: { kind: "archive-prompt-module", sourceAssetId: text(module.sourceAssetId) },
    }, index);
  }

  function archiveGroups(archiveState) {
    const state = isObject(archiveState) ? archiveState : {};
    const assets = new Map(list(state.sourceAssets).filter(isObject).map((asset) => [String(asset.id || ""), asset]));
    const siblingIds = new Set([
      ...list(state.runtimeProfiles).map((item) => String(item?.sourceAssetId || "")),
      ...list(state.worlds).map((item) => String(item?.sourceAssetId || "")),
    ].filter(Boolean));
    const bySource = new Map();
    list(state.promptModules).filter(isObject).forEach((module, index) => {
      const sourceAssetId = nonEmpty(module.sourceAssetId) ? module.sourceAssetId.trim() : "";
      const key = sourceAssetId || "__ambiguous__";
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push({ module, index });
    });
    const independent = [];
    const ambiguous = [];
    bySource.forEach((items, sourceAssetId) => {
      const asset = assets.get(sourceAssetId);
      const standalonePromptSource = sourceAssetId !== "__ambiguous__" && asset?.assetType === "prompt-source" && !siblingIds.has(sourceAssetId);
      const manualPromptSource = sourceAssetId !== "__ambiguous__" && items.every(({ module }) => module.source === "manual") && !siblingIds.has(sourceAssetId);
      if (standalonePromptSource || manualPromptSource) independent.push({ sourceAssetId, asset, items });
      else ambiguous.push(...items.map((item) => ({ ...item, sourceAssetId, asset })));
    });
    return { independent, ambiguous };
  }

  function profilesFromArchive(archiveState, occupied, warnings, timestamp) {
    const groups = archiveGroups(archiveState);
    const profiles = [];
    groups.independent.forEach((group) => {
      const first = group.items[0]?.module || {};
      const baseName = nonEmpty(first.title) && first.title !== "Imported behavior rules" ? first.title.trim() : text(group.asset?.filename).replace(/\.[^.]+$/, "").trim();
      const id = allocateId(`profile-legacy-${stableHash(group.sourceAssetId)}`, occupied);
      profiles.push(normalizeProfile({
        id,
        name: baseName || "迁移生成档案",
        description: "从旧 Archive 预设资源迁移",
        origin: group.items.every(({ module }) => module.source === "manual") ? "user" : "imported",
        creationMode: "legacy-archive-module",
        modules: { order: [], enabled: {} },
        instructionBlocks: group.items.map(({ module }, index) => archiveModuleBlock(module, index)),
        provenance: { kind: "legacy-archive-prompt-source", sourceAssetId: group.sourceAssetId },
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { now: timestamp }));
    });
    if (groups.ambiguous.length) {
      const id = allocateId("profile-legacy-instructions", occupied);
      profiles.push(normalizeProfile({
        id,
        name: "迁移指令",
        description: "从旧 Archive 混合来源中保留的指令块",
        origin: "imported",
        creationMode: "legacy-archive-module",
        modules: { order: [], enabled: {} },
        instructionBlocks: groups.ambiguous.map(({ module }, index) => archiveModuleBlock(module, index)),
        provenance: { kind: "legacy-archive-mixed-sources", sourceAssetIds: Array.from(new Set(groups.ambiguous.map((item) => item.sourceAssetId).filter((id) => id && id !== "__ambiguous__"))) },
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { now: timestamp }));
    }
    const activeLegacyBlocks = profiles.flatMap((profile) => profile.instructionBlocks).filter((block) => block.enabled && block.runtimeEligible);
    if (activeLegacyBlocks.length) warnings.push({ code: "legacy_archive_blocks_require_profile_selection", blockIds: activeLegacyBlocks.map((block) => block.id) });
    return profiles;
  }

  function migrateLegacySources(input = {}) {
    const timestamp = Number(input.now) || now();
    const warnings = [];
    const occupied = new Set();
    const idRemap = {};
    const profiles = [];
    const legacyPresets = parseLegacyPresetList(input.legacyUserPresets, warnings);
    legacyPresets.forEach((preset) => {
      const profile = profileFromLegacyPreset(preset, occupied, idRemap, warnings, timestamp);
      if (profile) profiles.push(profile);
    });
    profiles.push(...profilesFromArchive(input.archiveState, occupied, warnings, timestamp).filter(Boolean));
    return normalizeStore({
      schemaVersion: SCHEMA_VERSION,
      profiles,
      migration: {
        revision: MIGRATION_REVISION,
        completedAt: timestamp,
        sources: {
          legacyUserPresets: { key: LEGACY_USER_PRESET_KEY, inputCount: legacyPresets.length },
          archivePromptModules: { key: `${ARCHIVE_STORAGE_KEY}.promptModules`, inputCount: list(input.archiveState?.promptModules).length },
        },
        importedIds: profiles.map((profile) => profile.id),
        remappedIds: idRemap,
        warnings,
      },
    });
  }

  const api = {
    STORAGE_KEY,
    LEGACY_USER_PRESET_KEY,
    ARCHIVE_STORAGE_KEY,
    RESOURCE_KIND,
    SCHEMA_VERSION,
    DEFAULT_PROFILE_ID,
    MIGRATION_REVISION,
    COMPATIBILITY_ADAPTER_REVISION,
    DEFAULT_COVER,
    BUILTIN_PROFILES,
    RESERVED_IDS,
    isReservedId,
    emptyStore,
    normalizeInstructionBlock,
    normalizeCompatibility,
    needsCompatibilityUpgrade,
    normalizeProfile,
    normalizeStore,
    migrateLegacySources,
  };

  global.MercuryGenerationProfileContracts = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

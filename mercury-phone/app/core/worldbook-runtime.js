(function exposeMercuryWorldBookRuntime(global) {
  "use strict";

  const DEFAULT_LIMITS = Object.freeze({ maxEntries: 8, maxCharacters: 5000, maxEntryCharacters: 1200, historyMessages: 6, minimumRemainingCharacters: 120 });
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const list = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : [];
  const unique = (values) => Array.from(new Set(values));
  const normalizeText = (value) => text(value).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");

  function scopeValues(source, keys) {
    const object = isObject(source) ? source : {};
    return unique(keys.flatMap((key) => list(object[key])).map((value) => text(value)).filter(Boolean));
  }

  function normalizedScope(input = {}) {
    const source = isObject(input.scope) ? input.scope : input;
    return {
      contactId: text(source.contactId),
      runtimeProfileId: text(source.runtimeProfileId || source.profileId || source.characterId),
      worldVariantId: text(source.worldVariantId || source.variantId) || "default",
      timelineId: text(source.timelineId) || "default",
      profileWorldBindings: scopeValues(source, ["profileWorldBindings"]),
    };
  }

  function dimensionMatches(source, scope, singularKeys, pluralKeys, nestedKey) {
    const nested = isObject(source?.scope) ? source.scope : {};
    const values = scopeValues(source, [...singularKeys, ...pluralKeys]).concat(scopeValues(nested, [nestedKey, `${nestedKey}s`]));
    return !values.length || values.includes(scope);
  }

  function worldMatchesScope(world, scope) {
    return dimensionMatches(world, scope.worldVariantId, ["worldVariantId", "variantId"], ["worldVariantIds", "variantIds"], "worldVariantId")
      && dimensionMatches(world, scope.timelineId, ["timelineId"], ["timelineIds"], "timelineId");
  }

  function entryMatchesScope(entry, scope) {
    return dimensionMatches(entry, scope.worldVariantId, ["worldVariantId", "variantId"], ["worldVariantIds", "variantIds"], "worldVariantId")
      && dimensionMatches(entry, scope.timelineId, ["timelineId"], ["timelineIds"], "timelineId");
  }

  function worldLinkedToProfile(world, scope) {
    const linkedProfiles = scopeValues(world, ["relatedProfileIds", "runtimeProfileIds", "profileIds", "characterIds"]);
    if (linkedProfiles.length) return Boolean(scope.runtimeProfileId) && linkedProfiles.includes(scope.runtimeProfileId);
    return scope.profileWorldBindings.includes(text(world?.id)) || scope.profileWorldBindings.includes(text(world?.name));
  }

  function entryTargetsScope(entry, scope) {
    const targetIds = scopeValues(entry, ["runtimeProfileId", "profileId", "characterId"])
      .concat(scopeValues(entry, ["runtimeProfileIds", "profileIds", "characterIds", "relatedProfileIds"]));
    return Boolean(scope.runtimeProfileId) && targetIds.includes(scope.runtimeProfileId);
  }

  function visibilityAllows(world, entry, scope) {
    const visibility = text(entry?.visibility) || "public";
    if (visibility === "objective" || visibility === "public") return true;
    if (visibility === "restricted") return worldLinkedToProfile(world, scope);
    if (visibility === "character-specific") return entryTargetsScope(entry, scope);
    return false;
  }

  function normalizedLimits(input = {}) {
    const source = isObject(input) ? input : {};
    const bounded = (key, minimum, fallback) => Number.isFinite(source[key]) ? Math.max(minimum, Math.floor(source[key])) : fallback;
    return {
      maxEntries: bounded("maxEntries", 1, DEFAULT_LIMITS.maxEntries),
      maxCharacters: bounded("maxCharacters", 1, DEFAULT_LIMITS.maxCharacters),
      maxEntryCharacters: bounded("maxEntryCharacters", 1, DEFAULT_LIMITS.maxEntryCharacters),
      historyMessages: bounded("historyMessages", 0, DEFAULT_LIMITS.historyMessages),
      minimumRemainingCharacters: bounded("minimumRemainingCharacters", 1, DEFAULT_LIMITS.minimumRemainingCharacters),
    };
  }

  function keyMatches(haystack, key) {
    if (!haystack || !key) return false;
    if (!/[a-z0-9_]/i.test(key)) return haystack.includes(key);
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try { return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(haystack); }
    catch (_) { return haystack.includes(key); }
  }

  function entryKeys(entry) {
    const explicit = unique([...list(entry?.aliases), ...list(entry?.keys), ...list(entry?.key), ...list(entry?.secondaryKeys), ...list(entry?.secondary_keys)])
      .map(normalizeText)
      .filter(Boolean);
    if (explicit.length || entry?.activationMode === "unkeyed-universal") return explicit;
    return unique([...list(entry?.title), ...list(entry?.name), ...list(entry?.tags)])
      .map(normalizeText)
      .filter(Boolean);
  }

  function messageText(message) {
    if (typeof message === "string") return text(message);
    if (!isObject(message)) return "";
    return text(message.text || message.content);
  }

  function selectedWorlds(candidates) {
    const byWorld = new Map();
    candidates.forEach((candidate) => {
      if (!byWorld.has(candidate.world.id)) byWorld.set(candidate.world.id, { ...candidate.world, entries: [] });
      byWorld.get(candidate.world.id).entries.push(candidate.entry);
    });
    return Array.from(byWorld.values());
  }

  function resolve(worlds, input = {}, limitsInput = {}) {
    const limits = normalizedLimits(limitsInput);
    const sourceWorlds = (Array.isArray(worlds) ? worlds : []).filter(isObject);
    const scope = normalizedScope(input);
    const currentText = normalizeText(messageText(input.currentMessage));
    const history = (Array.isArray(input.recentMessages) ? input.recentMessages : []).slice(-limits.historyMessages).map(messageText).filter(Boolean);
    const historyText = normalizeText(history.join("\n"));
    const warnings = [];
    const candidates = [];
    const eligibleWorlds = sourceWorlds.filter((world) => worldMatchesScope(world, scope));

    eligibleWorlds.forEach((world, worldIndex) => {
      const entries = Array.isArray(world.entries) ? world.entries : [];
      entries.forEach((entry, entryIndex) => {
        if (!isObject(entry) || entry.enabled === false || !entryMatchesScope(entry, scope) || !visibilityAllows(world, entry, scope)) return;
        const content = text(entry.content || entry.summary);
        if (!content) return;
        const keys = entryKeys(entry);
        const matchedCurrent = keys.filter((key) => keyMatches(currentText, key));
        const matchedHistory = keys.filter((key) => keyMatches(historyText, key));
        const alwaysActive = entry.alwaysActive === true || entry.constant === true;
        if (!alwaysActive && !matchedCurrent.length && !matchedHistory.length) return;
        candidates.push({
          world,
          entry,
          content,
          worldIndex,
          entryIndex,
          priority: Number.isFinite(entry.priority) ? Number(entry.priority) : 0,
          alwaysActive,
          matchedCurrent,
          matchedHistory,
        });
      });
    });

    candidates.sort((left, right) => {
      const activationRank = (candidate) => candidate.matchedCurrent.length ? 3 : candidate.alwaysActive ? 2 : 1;
      const activation = activationRank(right) - activationRank(left);
      if (activation) return activation;
      const priority = right.priority - left.priority;
      if (priority) return priority;
      const matched = (right.matchedCurrent.length + right.matchedHistory.length) - (left.matchedCurrent.length + left.matchedHistory.length);
      if (matched) return matched;
      return left.worldIndex - right.worldIndex || left.entryIndex - right.entryIndex;
    });

    // Imported books can contain the same entry more than once (for example
    // after merging an embedded book with an explicit binding). Keep the
    // highest-ranked occurrence so duplicate lore cannot consume the budget
    // twice. Entries without a stable id remain distinct because their
    // position may carry authorial intent.
    const seenEntryKeys = new Set();
    const dedupedCandidates = [];
    candidates.forEach((candidate) => {
      const worldId = text(candidate.world.id);
      const entryId = text(candidate.entry.id);
      const dedupeKey = worldId && entryId ? `${worldId}:${entryId}` : "";
      if (dedupeKey && seenEntryKeys.has(dedupeKey)) return;
      if (dedupeKey) seenEntryKeys.add(dedupeKey);
      dedupedCandidates.push(candidate);
    });

    const selected = [];
    let usedCharacters = 0;
    dedupedCandidates.forEach((candidate) => {
      if (selected.length >= limits.maxEntries) return;
      const remaining = limits.maxCharacters - usedCharacters;
      if (remaining <= 0) return;
      const permitted = Math.min(candidate.content.length, limits.maxEntryCharacters, remaining);
      if (permitted < candidate.content.length && permitted < limits.minimumRemainingCharacters) {
        warnings.push({ code: "world_entry_skipped_by_budget", worldId: text(candidate.world.id), entryId: text(candidate.entry.id) });
        return;
      }
      const truncated = permitted < candidate.content.length;
      if (truncated) warnings.push({ code: "world_entry_truncated", worldId: text(candidate.world.id), entryId: text(candidate.entry.id), retainedCharacters: permitted });
      const selectedEntry = { ...candidate.entry, content: candidate.content.slice(0, permitted) };
      selected.push({ ...candidate, entry: selectedEntry, truncated, characters: permitted });
      usedCharacters += permitted;
    });

    const trace = {
      version: 1,
      sourceWorldCount: sourceWorlds.length,
      eligibleWorldCount: eligibleWorlds.length,
      rawCandidateCount: candidates.length,
      candidateCount: dedupedCandidates.length,
      duplicateCount: candidates.length - dedupedCandidates.length,
      selectedCount: selected.length,
      usedCharacters,
      scope: { ...scope },
      limits,
      selectedEntries: selected.map((candidate) => ({
        worldId: text(candidate.world.id),
        worldName: text(candidate.world.name),
        entryId: text(candidate.entry.id),
        title: text(candidate.entry.title),
        visibility: text(candidate.entry.visibility) || "public",
        reason: candidate.alwaysActive ? "always_active" : candidate.matchedCurrent.length ? "current_message" : "recent_history",
        matchedKeys: unique([...candidate.matchedCurrent, ...candidate.matchedHistory]),
        truncated: candidate.truncated,
        characters: candidate.characters,
      })),
      warnings: warnings.map((warning) => ({ ...warning })),
    };
    return Object.freeze({ worlds: selectedWorlds(selected), trace: Object.freeze(trace), warnings: Object.freeze(warnings.map((warning) => Object.freeze({ ...warning }))) });
  }

  const api = Object.freeze({ DEFAULT_LIMITS, resolve, normalizedLimits, keyMatches, entryKeys });
  global.MercuryWorldBookRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

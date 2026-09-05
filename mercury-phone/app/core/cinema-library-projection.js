(function exposeMercuryCinemaLibraryProjection(global) {
  "use strict";

  const DEFAULT_PLACEHOLDER_COUNT = 6;
  const DEFAULT_GESTURE_THRESHOLD = 12;
  const DEFAULT_COMMIT_THRESHOLD = 42;
  const DEFAULT_DIRECTION_RATIO = 1.18;

  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const list = (value) => Array.isArray(value) ? value : [];
  const timestamp = (value) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const clamp = (value, minimum, maximum) => Math.min(Math.max(Number(value) || 0, minimum), maximum);
  const pad = (value) => String(value).padStart(2, "0");

  function stableHash(value) {
    let hash = 2166136261;
    const source = String(value || "");
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function placeholderPathFor(characterId, count = DEFAULT_PLACEHOLDER_COUNT) {
    const boundedCount = Math.max(1, Math.floor(Number(count) || DEFAULT_PLACEHOLDER_COUNT));
    return `assets/cinema/cast-neutral-${pad((stableHash(characterId) % boundedCount) + 1)}.webp`;
  }

  function directCharacterImage(profile = {}) {
    const candidate = text(profile.avatarAssetId) || text(profile.imageAssetId);
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(candidate)) return candidate;
    if (/^blob:/i.test(candidate)) return candidate;
    if (/^assets\/[a-z0-9_./-]+\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(candidate)) return candidate;
    return "";
  }

  function resolveCinemaCharacterVisual(profile = {}, placeholderCount = DEFAULT_PLACEHOLDER_COUNT) {
    const characterId = text(profile.id, text(profile.displayName, "unidentified-character"));
    const userImage = directCharacterImage(profile);
    return Object.freeze({
      kind: userImage ? "user" : "mercury-neutral",
      src: userImage || placeholderPathFor(characterId, placeholderCount),
      neutralFallbackSrc: placeholderPathFor(characterId, placeholderCount),
      textFallback: text(profile.displayName, "?").slice(0, 1),
    });
  }

  function summarizeWorldTeaser(stage = {}, maximumLength = 64) {
    const source = text(stage.tagline, text(stage.summary, "世界档案尚待补充。"));
    const normalized = source.replace(/\s+/g, " ").trim();
    const limit = Math.max(24, Math.floor(Number(maximumLength) || 64));
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 1).trimEnd()}…`;
  }

  function summarizeCharacterDescription(profile = {}, maximumLength = 96) {
    const source = text(profile.identity, text(profile.summary, "原始角色档案尚未填写简介。"));
    const normalized = source
      .replace(/<[^>]{1,48}>/g, " ")
      .replace(/```(?:yaml|json|text|txt|markdown)?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const limit = Math.max(24, Math.floor(Number(maximumLength) || 96));
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 1).trimEnd()}…`;
  }

  function projectWorld(stage, index) {
    const materials = list(stage?.materials);
    const material = materials.find((item) => text(item?.asset)) || null;
    return Object.freeze({
      id: text(stage?.id),
      index,
      number: pad(index + 1),
      title: text(stage?.title, "未命名世界"),
      shortTitle: text(stage?.shortTitle, text(stage?.title, "未命名")),
      latinTitle: text(stage?.latinTitle, "UNTITLED WORLD"),
      region: text(stage?.region, "MERCURY WORLD"),
      tagline: summarizeWorldTeaser(stage),
      summary: text(stage?.summary),
      premise: text(stage?.premise),
      material,
      source: stage,
    });
  }

  function visibleWorldIndices(count, selectedIndex) {
    if (count <= 3) return Array.from({ length: count }, (_, index) => index);
    if (selectedIndex <= 1) return [0, 1, 2];
    if (selectedIndex >= count - 2) return [count - 3, count - 2, count - 1];
    return [selectedIndex - 1, selectedIndex, selectedIndex + 1];
  }

  function buildWorldLibraryProjection(catalog, selectedValue = 0) {
    const stages = typeof catalog?.listStages === "function" ? catalog.listStages() : [];
    const worlds = stages.map(projectWorld);
    const requestedIndex = typeof selectedValue === "string"
      ? worlds.findIndex((world) => world.id === selectedValue)
      : Number(selectedValue);
    const selectedIndex = worlds.length ? clamp(requestedIndex < 0 ? 0 : requestedIndex, 0, worlds.length - 1) : -1;
    const visible = selectedIndex < 0 ? [] : visibleWorldIndices(worlds.length, selectedIndex).map((index) => Object.freeze({
      ...worlds[index],
      selected: index === selectedIndex,
      side: index < selectedIndex ? "past" : index > selectedIndex ? "future" : "current",
    }));
    return Object.freeze({
      worlds: Object.freeze(worlds),
      visible: Object.freeze(visible),
      selected: selectedIndex >= 0 ? worlds[selectedIndex] : null,
      selectedIndex,
      total: worlds.length,
      indexLabel: worlds.length ? `${pad(selectedIndex + 1)} / ${pad(worlds.length)}` : "00 / 00",
      hasPrevious: selectedIndex > 0,
      hasNext: selectedIndex >= 0 && selectedIndex < worlds.length - 1,
    });
  }

  function buildCinemaCastProjection(archiveState = {}, cinemaState = {}, placeholderCount = DEFAULT_PLACEHOLDER_COUNT) {
    const instances = list(cinemaState.instances);
    const entries = list(archiveState.runtimeProfiles).filter((profile) => text(profile?.id)).map((profile, index) => {
      const performances = instances
        .filter((instance) => text(instance?.characterSnapshot?.id) === text(profile.id))
        .sort((left, right) => timestamp(right.updatedAt || right.endedAt) - timestamp(left.updatedAt || left.endedAt));
      const worldIds = new Set(performances.map((instance) => text(instance?.stageSnapshot?.id, text(instance?.stageId))).filter(Boolean));
      return Object.freeze({
        id: text(profile.id),
        index,
        number: pad(index + 1),
        displayName: text(profile.displayName, "未命名角色"),
        description: summarizeCharacterDescription(profile),
        visual: resolveCinemaCharacterVisual(profile, placeholderCount),
        performanceCount: performances.length,
        worldCount: worldIds.size,
        latestInstanceId: text(performances[0]?.id),
        source: profile,
      });
    });
    return Object.freeze({ entries: Object.freeze(entries), total: entries.length });
  }

  function createDirectionalGestureArbiter(options = {}) {
    const threshold = Math.max(4, Number(options.threshold) || DEFAULT_GESTURE_THRESHOLD);
    const commitThreshold = Math.max(threshold, Number(options.commitThreshold) || DEFAULT_COMMIT_THRESHOLD);
    const directionRatio = Math.max(1, Number(options.directionRatio) || DEFAULT_DIRECTION_RATIO);
    let startX = 0;
    let startY = 0;
    let active = false;
    let intent = "pending";

    function snapshot(x = startX, y = startY) {
      const deltaX = Number(x) - startX;
      const deltaY = Number(y) - startY;
      const horizontal = Math.abs(deltaX);
      const vertical = Math.abs(deltaY);
      if (active && intent === "pending" && Math.hypot(deltaX, deltaY) >= threshold) {
        if (horizontal > vertical * directionRatio) intent = "horizontal";
        else if (vertical > horizontal * directionRatio) intent = "vertical";
      }
      return Object.freeze({ active, intent, deltaX, deltaY });
    }

    return Object.freeze({
      start(x, y) {
        startX = Number(x) || 0;
        startY = Number(y) || 0;
        active = true;
        intent = "pending";
        return snapshot();
      },
      move(x, y) { return snapshot(x, y); },
      end(x, y) {
        const state = snapshot(x, y);
        const result = Object.freeze({
          ...state,
          commit: state.intent === "horizontal" && Math.abs(state.deltaX) >= commitThreshold,
          direction: state.intent === "horizontal" ? (state.deltaX < 0 ? "next" : "previous") : "none",
          activate: state.intent === "pending" && Math.hypot(state.deltaX, state.deltaY) < threshold,
        });
        active = false;
        intent = "pending";
        return result;
      },
      cancel() {
        active = false;
        intent = "pending";
        return Object.freeze({ active, intent, deltaX: 0, deltaY: 0, commit: false, direction: "none", activate: false });
      },
    });
  }

  const api = Object.freeze({
    DEFAULT_PLACEHOLDER_COUNT,
    buildWorldLibraryProjection,
    buildCinemaCastProjection,
    createDirectionalGestureArbiter,
    directCharacterImage,
    placeholderPathFor,
    resolveCinemaCharacterVisual,
    stableHash,
    summarizeCharacterDescription,
    summarizeWorldTeaser,
  });
  global.MercuryCinemaLibraryProjection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

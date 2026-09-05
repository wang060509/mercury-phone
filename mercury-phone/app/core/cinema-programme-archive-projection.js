(function exposeMercuryCinemaProgrammeArchiveProjection(global) {
  "use strict";

  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const list = (value) => Array.isArray(value) ? value : [];
  const timestamp = (value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const pad = (value) => String(value).padStart(2, "0");

  function dateLabel(value) {
    const parsed = timestamp(value);
    if (!parsed) return "";
    const date = new Date(parsed);
    return [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join(".");
  }

  function identityFor(instance) {
    const characterId = text(instance?.characterSnapshot?.id);
    const worldId = text(instance?.stageSnapshot?.id, text(instance?.stageId));
    return Object.freeze({
      characterId,
      worldId,
      key: characterId && worldId
        ? `character:${characterId}|world:${worldId}`
        : `legacy:${text(instance?.id, "unknown")}`,
    });
  }

  function stableAnchor(value) {
    const source = text(value, "unknown");
    const ascii = source.toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (ascii) return `programme-archive-${ascii}`;
    let hash = 2166136261;
    for (const character of source) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `programme-archive-${(hash >>> 0).toString(36)}`;
  }

  function historyTruth() {
    return global.MercuryCinemaHistoryProjection
      || (typeof require === "function" ? require("./cinema-history-projection.js") : null);
  }

  function reliableStructureLabel(instance) {
    const scenes = historyTruth()?.reliableScenes?.(instance);
    if (!scenes) return "";
    const acts = new Set(scenes.map((scene) => Number(scene.actNumber))).size;
    return `${acts} 幕 ${scenes.length} 场`;
  }

  function projectPerformance(instance) {
    const opening = text(instance?.scenarioSnapshot?.title);
    const structure = reliableStructureLabel(instance);
    return Object.freeze({
      id: text(instance?.id),
      title: text(instance?.title, "未命名演出"),
      endedAt: text(instance?.endedAt),
      endingDate: dateLabel(instance?.endedAt),
      openingLabel: opening ? `开场：${opening}` : "",
      structureLabel: structure,
      metadataLine: [opening ? `开场：${opening}` : "", structure].filter(Boolean).join(" · "),
    });
  }

  function buildCinemaProgrammeArchiveProjection(stateValue) {
    const state = stateValue && typeof stateValue === "object" ? stateValue : {};
    const ended = list(state.instances)
      .filter((instance) => instance && instance.status === "ended" && text(instance.id));
    const grouped = new Map();

    ended.forEach((instance) => {
      const identity = identityFor(instance);
      if (!grouped.has(identity.key)) grouped.set(identity.key, { identity, instances: [] });
      grouped.get(identity.key).instances.push(instance);
    });

    const groups = Array.from(grouped.values()).map(({ identity, instances }) => {
      const ordered = instances.slice().sort((left, right) => timestamp(right.endedAt) - timestamp(left.endedAt) || text(left.id).localeCompare(text(right.id)));
      const identitySource = ordered[0] || {};
      return {
        key: identity.key,
        anchor: stableAnchor(identity.key),
        characterId: identity.characterId,
        worldId: identity.worldId,
        characterName: text(identitySource.characterSnapshot?.displayName, "未命名角色"),
        worldTitle: text(identitySource.stageSnapshot?.shortTitle, text(identitySource.stageSnapshot?.title, "已归档世界")),
        latestEndedAt: text(identitySource.endedAt),
        performances: ordered.map(projectPerformance),
      };
    }).sort((left, right) => timestamp(right.latestEndedAt) - timestamp(left.latestEndedAt) || left.key.localeCompare(right.key));

    const projectedGroups = groups.map((group, groupIndex) => Object.freeze({
      ...group,
      number: pad(groupIndex + 1),
      countLabel: pad(group.performances.length),
      performances: Object.freeze(group.performances.map((performance, performanceIndex) => Object.freeze({
        ...performance,
        number: `${pad(groupIndex + 1)}.${pad(performanceIndex + 1)}`,
      }))),
    }));

    return Object.freeze({
      count: ended.length,
      countLabel: pad(ended.length),
      empty: ended.length === 0,
      groups: Object.freeze(projectedGroups),
    });
  }

  const api = Object.freeze({ buildCinemaProgrammeArchiveProjection, dateLabel, identityFor, stableAnchor });
  global.MercuryCinemaProgrammeArchiveProjection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

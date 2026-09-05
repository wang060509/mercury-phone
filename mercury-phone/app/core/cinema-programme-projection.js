(function exposeMercuryCinemaProgrammeProjection(global) {
  "use strict";

  const text = (value, fallback = "") => String(value || fallback).trim();
  const timestamp = (value) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const chineseNumber = (value) => ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][Number(value)] || String(value || 1);

  function sceneFor(instance) {
    const scenes = Array.isArray(instance?.scenes) ? instance.scenes : [];
    return scenes.find((scene) => scene.id === instance.currentSceneId) || scenes.at(-1) || null;
  }

  function neutralPosition(status) {
    if (status === "intermission") return "演出暂时停在这里";
    if (status === "ending") return "正在谢幕";
    if (status === "ended") return "已谢幕";
    return "演出进行中";
  }

  function projectInstance(instance) {
    const scene = sceneFor(instance);
    const status = text(instance?.status, "active");
    return Object.freeze({
      id: text(instance?.id),
      status,
      title: text(instance?.title, "未命名演出"),
      subtitle: text(instance?.programmeSubtitle),
      position: instance?.structureProvenance?.scenes === "runtime" && scene
        ? `第${chineseNumber(scene.actNumber)}幕 · ${text(scene.title, "未命名场景")}`
        : neutralPosition(status),
      updatedAt: text(instance?.updatedAt),
      endedAt: text(instance?.endedAt),
      pending: Boolean(instance?.pendingContinuation),
      actionLabel: status === "intermission" ? "从中场继续" : status === "ending" ? "继续谢幕" : instance?.pendingContinuation ? "处理待续写" : "继续演出",
      source: instance,
    });
  }

  function identityFor(instance) {
    const characterId = text(instance?.characterSnapshot?.id);
    const stageId = text(instance?.stageSnapshot?.id, text(instance?.stageId));
    return {
      characterId,
      stageId,
      key: characterId && stageId ? `character:${characterId}|stage:${stageId}` : `legacy:${text(instance?.id, "unknown")}`,
    };
  }

  function programmeIndexItem(instance, group) {
    return Object.freeze({
      ...instance,
      groupKey: group.key,
      characterId: group.characterId,
      stageId: group.stageId,
      characterName: group.characterName,
      worldTitle: group.worldTitle,
      worldLongTitle: group.worldLongTitle,
    });
  }

  function buildCinemaProgrammeProjection(stateValue, selectedInstanceId = "") {
    const state = stateValue && typeof stateValue === "object" ? stateValue : {};
    const instances = Array.isArray(state.instances) ? state.instances.filter((instance) => instance?.id) : [];
    const groups = new Map();

    instances.forEach((instance) => {
      const identity = identityFor(instance);
      if (!groups.has(identity.key)) {
        groups.set(identity.key, {
          key: identity.key,
          characterId: identity.characterId,
          stageId: identity.stageId,
          characterName: text(instance.characterSnapshot?.displayName, "未命名角色"),
          worldTitle: text(instance.stageSnapshot?.shortTitle, text(instance.stageSnapshot?.title, "已归档世界")),
          worldLongTitle: text(instance.stageSnapshot?.title, "已归档世界"),
          sharedHistory: "",
          instances: [],
        });
      }
      const group = groups.get(identity.key);
      group.instances.push(instance);
      if (!group.sharedHistory && text(instance.variant?.sharedHistory)) group.sharedHistory = text(instance.variant.sharedHistory);
    });

    const projectedGroups = Array.from(groups.values()).map((group) => {
      const ordered = group.instances.slice().sort((left, right) => timestamp(right.updatedAt || right.endedAt) - timestamp(left.updatedAt || left.endedAt));
      const unfinished = ordered.filter((instance) => instance.status !== "ended").map(projectInstance);
      const past = ordered.filter((instance) => instance.status === "ended")
        .sort((left, right) => timestamp(right.endedAt || right.updatedAt) - timestamp(left.endedAt || left.updatedAt))
        .map(projectInstance);
      const selected = unfinished.find((instance) => instance.id === selectedInstanceId)
        || unfinished.find((instance) => instance.id === state.focusedInstanceId)
        || unfinished[0]
        || past.find((instance) => instance.id === selectedInstanceId)
        || past[0]
        || null;
      const updatedAt = Math.max(...ordered.map((instance) => timestamp(instance.updatedAt || instance.endedAt)), 0);
      return Object.freeze({
        key: group.key,
        characterId: group.characterId,
        stageId: group.stageId,
        characterName: group.characterName,
        worldTitle: group.worldTitle,
        worldLongTitle: group.worldLongTitle,
        sharedHistory: group.sharedHistory,
        selected,
        unfinished: Object.freeze(unfinished),
        past: Object.freeze(past),
        updatedAt,
      });
    }).sort((left, right) => right.updatedAt - left.updatedAt || left.key.localeCompare(right.key));

    const selectedGroup = projectedGroups.find((group) => group.unfinished.some((instance) => instance.id === selectedInstanceId)
      || group.past.some((instance) => instance.id === selectedInstanceId)) || null;
    const unfinished = projectedGroups.flatMap((group) => group.unfinished.map((instance) => programmeIndexItem(instance, group)))
      .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt) || left.id.localeCompare(right.id));
    const past = projectedGroups.flatMap((group) => group.past.map((instance) => programmeIndexItem(instance, group)))
      .sort((left, right) => timestamp(right.endedAt || right.updatedAt) - timestamp(left.endedAt || left.updatedAt) || left.id.localeCompare(right.id));
    const primary = unfinished.find((instance) => instance.id === state.focusedInstanceId) || unfinished[0] || null;
    return Object.freeze({
      groups: Object.freeze(projectedGroups),
      selectedGroup,
      primary,
      unfinished: Object.freeze(unfinished),
      past: Object.freeze(past),
    });
  }

  const api = Object.freeze({ buildCinemaProgrammeProjection, projectInstance });
  global.MercuryCinemaProgrammeProjection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

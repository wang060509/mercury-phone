(function exposeMercuryCinemaHistoryProjection(global) {
  "use strict";

  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const list = (value) => Array.isArray(value) ? value : [];
  const pad = (value) => String(value).padStart(2, "0");

  function dateLabel(value) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "";
    const date = new Date(timestamp);
    return [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join(".");
  }

  function narrativeWordCount(instance) {
    return list(instance?.segments).reduce((total, segment) => total + text(segment?.text).replace(/\s+/g, "").length, 0);
  }

  function safeAnchor(value, fallback) {
    const normalized = text(value).toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return `history-${normalized || fallback}`;
  }

  function projectSegment(segment, abandonedUserSegmentId) {
    const value = text(segment?.text);
    if (!value) return null;
    const id = text(segment?.id);
    return Object.freeze({
      id,
      role: segment?.role === "user" ? "user" : "assistant",
      text: value,
      createdAt: text(segment?.createdAt),
      abandonedPending: Boolean(id && id === abandonedUserSegmentId),
    });
  }

  function reliableScenes(instance) {
    if (instance?.structureProvenance?.scenes !== "runtime") return null;
    const scenes = list(instance.scenes);
    if (!scenes.length) return null;
    const ids = scenes.map((scene) => text(scene?.id));
    const uniqueIds = new Set(ids);
    const valid = ids.every(Boolean)
      && uniqueIds.size === ids.length
      && scenes.every((scene) => Number.isInteger(Number(scene?.actNumber)) && Number(scene.actNumber) > 0
        && Number.isInteger(Number(scene?.sceneNumber)) && Number(scene.sceneNumber) > 0)
      && list(instance.segments).every((segment) => uniqueIds.has(text(segment?.sceneId)));
    return valid ? scenes : null;
  }

  function buildStructuredBody(instance, scenes, abandonedUserSegmentId) {
    const segments = list(instance.segments);
    return scenes.map((scene, index) => {
      const actNumber = Number(scene.actNumber);
      const sceneNumber = Number(scene.sceneNumber);
      const projectedSegments = segments
        .filter((segment) => text(segment?.sceneId) === text(scene.id))
        .map((segment) => projectSegment(segment, abandonedUserSegmentId))
        .filter(Boolean);
      return Object.freeze({
        id: safeAnchor(scene.id, `scene-${index + 1}`),
        sourceSceneId: text(scene.id),
        actNumber,
        sceneNumber,
        structuralLabel: `第 ${actNumber} 幕 · 第 ${sceneNumber} 场`,
        editorialLabel: `ACT ${pad(actNumber)} / SCENE ${pad(sceneNumber)}`,
        title: text(scene.title, `第 ${sceneNumber} 场`),
        segments: Object.freeze(projectedSegments),
      });
    });
  }

  function buildFallbackBody(instance, abandonedUserSegmentId) {
    const segments = list(instance.segments).map((segment) => projectSegment(segment, abandonedUserSegmentId)).filter(Boolean);
    return [Object.freeze({
      id: "history-performance-body",
      sourceSceneId: "",
      actNumber: null,
      sceneNumber: null,
      structuralLabel: "",
      editorialLabel: "COMPLETE PERFORMANCE",
      title: "正文",
      segments: Object.freeze(segments),
    })];
  }

  function buildCinemaHistoryProjection(instanceValue) {
    if (!instanceValue || typeof instanceValue !== "object" || instanceValue.status !== "ended" || !text(instanceValue.endedAt)) return null;
    const instance = instanceValue;
    const scenes = reliableScenes(instance);
    const pendingDisposition = instance.closureRecord?.pendingDisposition;
    const abandonedUserSegmentId = pendingDisposition?.kind === "abandoned-by-user" ? text(pendingDisposition.userSegmentId) : "";
    const sections = scenes
      ? buildStructuredBody(instance, scenes, abandonedUserSegmentId)
      : buildFallbackBody(instance, abandonedUserSegmentId);
    const actCount = scenes ? new Set(scenes.map((scene) => Number(scene.actNumber))).size : null;
    const characterName = text(instance.characterSnapshot?.displayName, "未命名角色");
    const worldTitle = text(instance.stageSnapshot?.title, "未知世界");
    const openedAt = dateLabel(instance.createdAt);
    const endedAt = dateLabel(instance.endedAt);
    const wordCount = narrativeWordCount(instance);
    const contents = sections.map((section) => Object.freeze({
      id: section.id,
      label: scenes ? section.structuralLabel : "正文",
      title: scenes ? section.title : "完整演出",
    }));
    const colophon = [
      openedAt ? { key: "opened", label: "开演", value: openedAt } : null,
      endedAt ? { key: "ended", label: "谢幕", value: endedAt } : null,
      { key: "words", label: "正文字数", value: `${wordCount.toLocaleString("zh-CN")} 字` },
      scenes ? { key: "structure", label: "作品结构", value: `${actCount} 幕 · ${scenes.length} 场` } : null,
    ].filter(Boolean).map((entry) => Object.freeze(entry));

    return Object.freeze({
      instanceId: text(instance.id),
      title: text(instance.title, "未命名演出"),
      characterName,
      worldTitle,
      identityLine: `${characterName} × ${worldTitle}`,
      openedAt,
      endedAt,
      dateRange: openedAt && endedAt ? `${openedAt}  /  ${endedAt}` : openedAt || endedAt,
      structureProvenance: scenes ? "runtime" : "compatibility-unknown",
      contents: Object.freeze(contents),
      sections: Object.freeze(sections),
      colophon: Object.freeze(colophon),
      wordCount,
      hasAbandonedPending: Boolean(abandonedUserSegmentId),
    });
  }

  const api = Object.freeze({ buildCinemaHistoryProjection, dateLabel, narrativeWordCount, reliableScenes });
  global.MercuryCinemaHistoryProjection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

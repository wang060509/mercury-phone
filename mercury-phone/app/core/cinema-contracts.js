(function exposeMercuryCinemaContracts(global) {
  "use strict";

  const STORAGE_KEY = "cinema.v1";
  const SCHEMA_VERSION = 4;
  const INSTANCE_STATUSES = Object.freeze(["preparing", "active", "intermission", "ending", "ended"]);
  const READING_THEMES = Object.freeze(["paper", "pale", "dark", "night"]);
  const RELATIONSHIP_STARTS = Object.freeze(["初次相识", "熟识同学", "多年好友", "青梅竹马", "恋人", "自定义"]);
  const stageCatalogModule = global.MercuryCinemaStageCatalog
    || (typeof require === "function" ? require("./cinema-stage-catalog.js") : null);
  const PRODUCTION_STAGE_CATALOG = stageCatalogModule.PRODUCTION_STAGE_CATALOG;

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value, fallback = "") => typeof value === "string" ? value : fallback;
  const cleanText = (value, fallback = "") => text(value, fallback).trim();
  const list = (value) => Array.isArray(value) ? value : [];
  const nowIso = (clock = Date.now) => new Date(clock()).toISOString();
  const uniqueId = (prefix, clock = Date.now) => `${prefix}-${clock()}-${Math.random().toString(36).slice(2, 8)}`;

  function resolveCatalog(catalog) {
    const resolved = catalog || PRODUCTION_STAGE_CATALOG;
    if (!resolved || typeof resolved.listStages !== "function" || typeof resolved.getStage !== "function" || typeof resolved.getScenario !== "function") throw new TypeError("Cinema requires a StageCatalog.");
    return resolved;
  }

  function getStage(stageId, catalog) { return resolveCatalog(catalog).getStage(stageId); }
  function getScenario(stageId, scenarioId, catalog) { return resolveCatalog(catalog).getScenario(stageId, scenarioId); }

  function createStageSnapshot(stageValue = {}) {
    const stage = isObject(stageValue) ? stageValue : {};
    return {
      id: cleanText(stage.id),
      version: Math.max(1, Number(stage.version) || 1),
      title: cleanText(stage.title, "Unknown / unavailable Stage"),
      shortTitle: cleanText(stage.shortTitle, cleanText(stage.title, "Unknown Stage")),
      latinTitle: cleanText(stage.latinTitle),
      programmeTitle: cleanText(stage.programmeTitle),
      region: cleanText(stage.region),
      tagline: cleanText(stage.tagline),
      summary: cleanText(stage.summary),
      premise: cleanText(stage.premise),
      roleConfiguration: isObject(stage.roleConfiguration) ? clone(stage.roleConfiguration) : {},
      specializations: list(stage.specializations).map(String).filter(Boolean),
      defaultSpecialization: cleanText(stage.defaultSpecialization),
      relationshipOptions: list(stage.relationshipOptions).map(String).filter(Boolean),
      places: list(stage.places).map(String).filter(Boolean),
      worldRules: list(stage.worldRules).map(String).filter(Boolean),
      unavailable: stage.unavailable === true,
    };
  }

  function createScenarioSnapshot(scenarioValue = {}) {
    const scenario = isObject(scenarioValue) ? scenarioValue : {};
    return {
      id: cleanText(scenario.id),
      title: cleanText(scenario.title, "Unknown / unavailable Scenario"),
      season: cleanText(scenario.season),
      summary: cleanText(scenario.summary),
      entryPeriods: list(scenario.entryPeriods).map(String).filter(Boolean),
      defaultEntryPeriod: cleanText(scenario.defaultEntryPeriod),
      opening: cleanText(scenario.opening),
      unavailable: scenario.unavailable === true,
    };
  }

  function compatibilityStageSnapshot(stageId, catalog) {
    const stage = getStage(stageId, catalog);
    return stage ? createStageSnapshot(stage) : createStageSnapshot({ id: stageId, unavailable: true });
  }

  function compatibilityScenarioSnapshot(stageId, scenarioId, catalog) {
    const scenario = getScenario(stageId, scenarioId, catalog);
    return scenario ? createScenarioSnapshot(scenario) : createScenarioSnapshot({ id: scenarioId, unavailable: true });
  }

  function defaultReadingSettings() {
    return {
      fontScale: 1,
      lineHeight: "relaxed",
      theme: "paper",
      progressiveReveal: true,
      actCards: true,
    };
  }

  function createState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      hasEntered: false,
      tutorialSeen: false,
      focusedInstanceId: null,
      draft: null,
      instances: [],
      readingSettings: defaultReadingSettings(),
    };
  }

  function normalizeCharacterSnapshot(value = {}) {
    const source = isObject(value) ? value : {};
    return {
      id: cleanText(source.id),
      displayName: cleanText(source.displayName, "未命名角色"),
      identity: cleanText(source.identity),
      summary: cleanText(source.summary),
      stableTraits: list(source.stableTraits).map(String).filter(Boolean).slice(0, 16),
      motivations: list(source.motivations).map(String).filter(Boolean).slice(0, 12),
      values: list(source.values).map(String).filter(Boolean).slice(0, 12),
      boundaries: list(source.boundaries).map(String).filter(Boolean).slice(0, 12),
      voiceStyle: cleanText(source.voiceStyle),
      background: cleanText(source.background),
      relationshipSummary: cleanText(source.relationshipSummary),
      sourceRevision: Number(source.updatedAt) || 0,
    };
  }

  function buildCharacterVariant(character, draft = {}, catalogValue) {
    const core = normalizeCharacterSnapshot(character);
    const stage = getStage(draft.stageId, catalogValue);
    const roleConfiguration = stage?.roleConfiguration || {};
    const specialization = cleanText(draft.characterSpecialization);
    const relationship = cleanText(draft.relationshipStart, "熟识同学");
    const sharedHistory = cleanText(draft.sharedHistory);
    const coreTraits = core.stableTraits.length ? core.stableTraits.join("、") : "角色档案中的核心人格与价值观";
    const worldIdentity = cleanText(draft.characterWorldIdentity) || cleanText(roleConfiguration.defaultCharacterRole) || (specialization ? `${specialization}方向角色` : "本场故事中的角色");
    const stageTitle = cleanText(stage?.title, "当前舞台");
    const contextBackground = cleanText(draft.variant?.contextBackground) || `${core.displayName}在${stageTitle}中以${worldIdentity}生活。环境会改变其知识、习惯与应对压力的方式，但不会把核心人格改写成相反的人。`;
    const expression = cleanText(draft.variant?.expression) || `保留${coreTraits}；在当下处境、共同生活与现实压力中，让既有特质发展出符合环境的新表现。`;
    return {
      coreProfileId: core.id,
      coreRevision: core.sourceRevision,
      stableCore: coreTraits,
      worldIdentity,
      contextBackground,
      expression,
      relationshipStart: relationship,
      sharedHistory,
      userEdited: Boolean(draft.variant?.userEdited),
    };
  }

  function createDraft(input = {}, clock = Date.now, catalogValue) {
    const catalog = resolveCatalog(catalogValue);
    const stageId = cleanText(input.stageId) || catalog.listStages()[0]?.id;
    const stage = catalog.getStage(stageId);
    if (!stage) throw new TypeError(`Unknown Cinema Stage: ${stageId || "(missing)"}`);
    const scenarioId = cleanText(input.scenarioId) || stage.scenarios[0]?.id;
    const scenario = catalog.getScenario(stage.id, scenarioId);
    if (!scenario) throw new TypeError(`Unknown Cinema Scenario: ${scenarioId || "(missing)"}`);
    const relationshipOptions = stage.relationshipOptions.length ? stage.relationshipOptions : RELATIONSHIP_STARTS;
    return {
      id: uniqueId("cinema-draft", clock),
      stageId: stage.id,
      scenarioId: scenario.id,
      entryPeriod: scenario.defaultEntryPeriod || scenario.entryPeriods[0] || "",
      characterId: "",
      characterSnapshot: null,
      playerName: "你",
      playerRole: cleanText(stage.roleConfiguration.defaultPlayerRole),
      playerSpecialization: stage.defaultSpecialization,
      characterSpecialization: stage.defaultSpecialization,
      characterWorldIdentity: "",
      relationshipStart: relationshipOptions.includes("熟识同学") ? "熟识同学" : relationshipOptions[0] || "自定义",
      sharedHistory: "",
      variant: null,
      generationProfileId: "preset-default",
      generationProfileSnapshot: null,
      createdAt: nowIso(clock),
      updatedAt: nowIso(clock),
      ...clone(input),
    };
  }

  function normalizeDraft(value, clock = Date.now, catalogValue) {
    if (!isObject(value)) return null;
    const catalog = resolveCatalog(catalogValue);
    const stage = catalog.getStage(cleanText(value.stageId));
    const scenario = stage ? catalog.getScenario(stage.id, cleanText(value.scenarioId) || stage.scenarios[0]?.id) : null;
    const relationshipOptions = stage?.relationshipOptions?.length ? stage.relationshipOptions : RELATIONSHIP_STARTS;
    const base = stage && scenario ? createDraft({ stageId: stage.id, scenarioId: scenario.id }, clock, catalog) : {
      id: uniqueId("cinema-draft", clock), stageId: cleanText(value.stageId), scenarioId: cleanText(value.scenarioId), entryPeriod: "", characterId: "", characterSnapshot: null,
      playerName: "你", playerRole: "", playerSpecialization: "", characterSpecialization: "", characterWorldIdentity: "", relationshipStart: "自定义", sharedHistory: "", variant: null,
      generationProfileId: "preset-default", generationProfileSnapshot: null, createdAt: nowIso(clock), updatedAt: nowIso(clock),
    };
    const draft = { ...base, ...clone(value) };
    draft.characterSnapshot = value.characterSnapshot ? normalizeCharacterSnapshot(value.characterSnapshot) : null;
    draft.variant = value.variant && isObject(value.variant) ? { ...value.variant } : null;
    draft.generationProfileSnapshot = value.generationProfileSnapshot && isObject(value.generationProfileSnapshot) ? clone(value.generationProfileSnapshot) : null;
    draft.relationshipStart = relationshipOptions.includes(value.relationshipStart) || RELATIONSHIP_STARTS.includes(value.relationshipStart) ? value.relationshipStart : "自定义";
    return draft;
  }

  function normalizeScene(value = {}, index = 0) {
    return {
      id: cleanText(value.id, `scene-${index + 1}`),
      actNumber: Math.max(1, Number(value.actNumber) || 1),
      sceneNumber: Math.max(1, Number(value.sceneNumber) || index + 1),
      title: cleanText(value.title, "故事开始的地方"),
      createdAt: cleanText(value.createdAt, new Date().toISOString()),
    };
  }

  function normalizeSegment(value = {}, index = 0) {
    return {
      id: cleanText(value.id, `segment-${index + 1}`),
      sceneId: cleanText(value.sceneId, "scene-1"),
      role: value.role === "user" ? "user" : "assistant",
      text: text(value.text),
      createdAt: cleanText(value.createdAt, new Date().toISOString()),
      status: ["complete", "pending", "failed"].includes(value.status) ? value.status : "complete",
      generationProfileId: cleanText(value.generationProfileId),
    };
  }

  function normalizeNotes(value = {}, clock = Date.now) {
    const source = isObject(value) ? value : {};
    const summary = isObject(source.summary) ? source.summary : {};
    const covered = Number(summary.coveredThroughOrdinal ?? source.coveredThroughOrdinal ?? -1);
    const recordList = (items) => list(items).map((item) => isObject(item) ? clone(item) : { description: String(item) }).filter((item) => cleanText(item.description, cleanText(item.what)));
    return {
      overview: cleanText(source.overview, cleanText(summary.text)),
      summary: {
        text: cleanText(summary.text, cleanText(source.overview)),
        coveredThroughOrdinal: Number.isInteger(covered) ? Math.max(-1, covered) : -1,
      },
      timeline: recordList(source.timeline),
      people: recordList(source.people),
      places: recordList(source.places),
      threads: recordList(source.threads),
      commitments: recordList(source.commitments),
      importantFacts: recordList(source.importantFacts),
      coverage: { coveredThroughOrdinal: Number.isInteger(covered) ? Math.max(-1, covered) : -1 },
      lastFailure: isObject(source.lastFailure) ? clone(source.lastFailure) : null,
      updatedAt: cleanText(source.updatedAt, nowIso(clock)),
    };
  }

  function normalizePendingContinuation(value = null) {
    if (!isObject(value)) return null;
    const requestId = cleanText(value.requestId);
    const userSegmentId = cleanText(value.userSegmentId);
    if (!requestId || !userSegmentId) return null;
    return {
      requestId,
      userSegmentId,
      startedAt: cleanText(value.startedAt, new Date().toISOString()),
      generationProfileId: cleanText(value.generationProfileId),
    };
  }

  function validIsoTimestamp(value) {
    const normalized = cleanText(value);
    return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : "";
  }

  function normalizeClosureRecord(value = null) {
    if (!isObject(value) || Number(value.version) !== 1) return null;
    const initiatedAt = validIsoTimestamp(value.initiatedAt);
    if (!initiatedAt) return null;
    if (value.pendingDisposition === null || value.pendingDisposition === undefined) {
      return Object.freeze({ version: 1, initiatedAt, pendingDisposition: null });
    }
    const disposition = value.pendingDisposition;
    if (!isObject(disposition) || disposition.kind !== "abandoned-by-user") return null;
    const requestId = cleanText(disposition.requestId);
    const userSegmentId = cleanText(disposition.userSegmentId);
    const startedAt = validIsoTimestamp(disposition.startedAt);
    const settledAt = validIsoTimestamp(disposition.settledAt);
    if (!requestId || !userSegmentId || !startedAt || !settledAt) return null;
    return Object.freeze({
      version: 1,
      initiatedAt,
      pendingDisposition: Object.freeze({ kind: "abandoned-by-user", requestId, userSegmentId, startedAt, settledAt }),
    });
  }

  function normalizeStructureProvenance(source, normalizedScenes, normalizedSegments) {
    if (source?.structureProvenance?.scenes === "runtime") return Object.freeze({ scenes: "runtime" });
    if (source?.structureProvenance?.scenes === "compatibility-unknown") return Object.freeze({ scenes: "compatibility-unknown" });
    const rawScenes = list(source?.scenes);
    if (!rawScenes.length) return Object.freeze({ scenes: "compatibility-unknown" });
    const sceneIds = rawScenes.map((scene) => cleanText(scene?.id));
    const uniqueIds = new Set(sceneIds);
    const currentSceneId = cleanText(source?.currentSceneId);
    const internallyConsistent = sceneIds.every(Boolean)
      && uniqueIds.size === sceneIds.length
      && rawScenes.every((scene) => Number.isInteger(Number(scene?.actNumber)) && Number(scene.actNumber) > 0 && Number.isInteger(Number(scene?.sceneNumber)) && Number(scene.sceneNumber) > 0)
      && (!currentSceneId || uniqueIds.has(currentSceneId))
      && normalizedSegments.every((segment) => uniqueIds.has(segment.sceneId));
    const distinguishableFromFallback = rawScenes.length > 1 || sceneIds.some((id) => id !== "scene-1") || (currentSceneId && currentSceneId !== "scene-1");
    const normalizedIdsAgree = normalizedScenes.length === rawScenes.length && normalizedScenes.every((scene, index) => scene.id === sceneIds[index]);
    return Object.freeze({ scenes: internallyConsistent && distinguishableFromFallback && normalizedIdsAgree ? "runtime" : "compatibility-unknown" });
  }

  function normalizeInstance(value = {}, catalogValue) {
    const source = isObject(value) ? value : {};
    const stageId = cleanText(source.stageId, cleanText(source.stageSnapshot?.id));
    const scenarioId = cleanText(source.scenarioId, cleanText(source.scenarioSnapshot?.id));
    const stageSnapshot = isObject(source.stageSnapshot) ? createStageSnapshot({ ...source.stageSnapshot, id: cleanText(source.stageSnapshot.id, stageId) }) : compatibilityStageSnapshot(stageId, catalogValue);
    const scenarioSnapshot = isObject(source.scenarioSnapshot) ? createScenarioSnapshot({ ...source.scenarioSnapshot, id: cleanText(source.scenarioSnapshot.id, scenarioId) }) : compatibilityScenarioSnapshot(stageId, scenarioId, catalogValue);
    const status = INSTANCE_STATUSES.includes(source.status) ? source.status : "preparing";
    const scenes = list(source.scenes).map(normalizeScene);
    const normalizedScenes = scenes.length ? scenes : [normalizeScene({ id: "scene-1", title: scenarioSnapshot.title }, 0)];
    const normalizedSegments = list(source.segments).map(normalizeSegment);
    const structureProvenance = normalizeStructureProvenance(source, normalizedScenes, normalizedSegments);
    const pendingContinuation = normalizePendingContinuation(source.pendingContinuation);
    const malformedPending = source.pendingContinuation !== null && source.pendingContinuation !== undefined && !pendingContinuation;
    const missingPendingSegment = pendingContinuation && !normalizedSegments.some((segment) => segment.id === pendingContinuation.userSegmentId && segment.role === "user");
    const pendingError = malformedPending || missingPendingSegment ? {
      code: "CINEMA_PENDING_CONTINUATION_INVALID",
      message: malformedPending
        ? "存档中的待续写身份不完整；Mercury 不会自动重发或猜测替代消息。"
        : "存档中的待续写身份指向不存在的用户段落；Mercury 不会自动重发或猜测替代消息。",
      retryable: false,
      recovery: "cinema-pending",
    } : null;
    return {
      id: cleanText(source.id, uniqueId("cinema-instance")),
      status,
      stageId: cleanText(stageId, stageSnapshot.id),
      stageSnapshot,
      scenarioId: cleanText(scenarioId, scenarioSnapshot.id),
      scenarioSnapshot,
      title: cleanText(source.title, `${stageSnapshot.title}：${scenarioSnapshot.title}`),
      programmeSubtitle: cleanText(source.programmeSubtitle, "第一场"),
      entryPeriod: cleanText(source.entryPeriod),
      characterSnapshot: normalizeCharacterSnapshot(source.characterSnapshot),
      player: isObject(source.player) ? { name: cleanText(source.player.name, "你"), role: cleanText(source.player.role), specialization: cleanText(source.player.specialization) } : { name: "你", role: "", specialization: "" },
      characterSpecialization: cleanText(source.characterSpecialization),
      variant: isObject(source.variant) ? { ...source.variant } : {},
      generationProfileId: cleanText(source.generationProfileId, "preset-default"),
      generationProfileSnapshot: isObject(source.generationProfileSnapshot) ? clone(source.generationProfileSnapshot) : null,
      runtimeProfileHistory: list(source.runtimeProfileHistory).map((entry) => clone(entry)),
      scenes: normalizedScenes,
      structureProvenance,
      currentSceneId: cleanText(source.currentSceneId, normalizedScenes[normalizedScenes.length - 1].id),
      segments: normalizedSegments,
      notes: normalizeNotes(source.notes),
      pendingContinuation,
      closureRecord: normalizeClosureRecord(source.closureRecord),
      createdAt: cleanText(source.createdAt, new Date().toISOString()),
      updatedAt: cleanText(source.updatedAt, new Date().toISOString()),
      endedAt: cleanText(source.endedAt),
      lastError: pendingError || (isObject(source.lastError) ? clone(source.lastError) : null),
    };
  }

  function normalizeState(value, catalogValue) {
    const source = isObject(value) ? value : {};
    const instances = list(source.instances).map((instance) => normalizeInstance(instance, catalogValue));
    const legacyOrCurrentFocus = cleanText(source.focusedInstanceId) || cleanText(source.activeInstanceId);
    const focusedInstanceId = instances.some((item) => item.id === legacyOrCurrentFocus && item.status !== "ended") ? legacyOrCurrentFocus : null;
    const settings = { ...defaultReadingSettings(), ...(isObject(source.readingSettings) ? source.readingSettings : {}) };
    settings.fontScale = Math.min(1.18, Math.max(.9, Number(settings.fontScale) || 1));
    settings.lineHeight = ["compact", "relaxed", "airy"].includes(settings.lineHeight) ? settings.lineHeight : "relaxed";
    settings.theme = READING_THEMES.includes(settings.theme) ? settings.theme : "paper";
    settings.progressiveReveal = settings.progressiveReveal !== false;
    settings.actCards = settings.actCards !== false;
    return {
      schemaVersion: SCHEMA_VERSION,
      hasEntered: source.hasEntered === true,
      tutorialSeen: source.tutorialSeen === true,
      focusedInstanceId,
      draft: normalizeDraft(source.draft, Date.now, catalogValue),
      instances,
      readingSettings: settings,
    };
  }

  function createInstanceFromDraft(draftValue, clock = Date.now, catalogValue) {
    const catalog = resolveCatalog(catalogValue);
    const draft = normalizeDraft(draftValue, clock, catalog);
    if (!draft?.characterSnapshot?.id) throw new TypeError("Cinema requires one Archive character before opening curtain.");
    if (!draft.generationProfileSnapshot) throw new TypeError("Cinema requires a Generation Profile snapshot.");
    const stage = catalog.getStage(draft.stageId);
    const scenario = catalog.getScenario(draft.stageId, draft.scenarioId);
    if (!stage || !scenario) throw new TypeError("Cinema cannot open an unavailable Stage or Scenario.");
    const stageSnapshot = createStageSnapshot(stage);
    const scenarioSnapshot = createScenarioSnapshot(scenario);
    const createdAt = nowIso(clock);
    const scene = normalizeScene({ id: uniqueId("scene", clock), actNumber: 1, sceneNumber: 1, title: scenarioSnapshot.title, createdAt });
    const opening = normalizeSegment({
      id: uniqueId("segment", clock),
      sceneId: scene.id,
      role: "assistant",
      text: scenarioSnapshot.opening || "故事从这里开始。",
      createdAt,
      generationProfileId: draft.generationProfileId,
    });
    return normalizeInstance({
      id: uniqueId("cinema-instance", clock),
      status: "active",
      stageId: stage.id,
      stageSnapshot,
      scenarioId: draft.scenarioId,
      scenarioSnapshot,
      title: `${stageSnapshot.title}：${scenarioSnapshot.title}`,
      programmeSubtitle: `${draft.entryPeriod ? `${draft.entryPeriod} · ` : ""}第一场`,
      entryPeriod: draft.entryPeriod,
      characterSnapshot: draft.characterSnapshot,
      player: { name: draft.playerName || "你", role: draft.playerRole, specialization: draft.playerSpecialization },
      characterSpecialization: draft.characterSpecialization,
      variant: buildCharacterVariant(draft.characterSnapshot, draft, catalog),
      generationProfileId: draft.generationProfileId,
      generationProfileSnapshot: draft.generationProfileSnapshot,
      runtimeProfileHistory: [{ profileId: draft.generationProfileId, snapshot: clone(draft.generationProfileSnapshot), appliedAt: createdAt }],
      scenes: [scene],
      structureProvenance: { scenes: "runtime" },
      currentSceneId: scene.id,
      segments: [opening],
      notes: normalizeNotes({ overview: `${draft.playerName || "你"}与${draft.characterSnapshot.displayName}在${stageSnapshot.title}进入${scenarioSnapshot.title}。`, timeline: [], people: [draft.characterSnapshot.displayName], places: [stageSnapshot.title], threads: [] }, clock),
      createdAt,
      updatedAt: createdAt,
    }, catalog);
  }

  function assistantText(instance) {
    return list(instance?.segments).filter((entry) => entry.role === "assistant").map((entry) => entry.text).join("\n\n");
  }

  function profileInstructionText(profile) {
    const assembler = global.MercuryPresetAssemble;
    if (assembler?.assemblePresetInstructions) return assembler.assemblePresetInstructions(profile || {});
    return cleanText(profile?.description);
  }

  function buildSystemPrompt(instanceValue, profileOverride = null) {
    const instance = normalizeInstance(instanceValue);
    const stage = instance.stageSnapshot;
    const scenario = instance.scenarioSnapshot;
    const character = instance.characterSnapshot;
    const variant = instance.variant || {};
    const profile = profileOverride || instance.generationProfileSnapshot || {};
    const profileText = profileInstructionText(profile);
    const stageContext = [stage.premise, stage.summary].filter(Boolean).join(" ");
    const playerIdentity = [instance.player.role, instance.player.specialization].filter(Boolean).join("，");
    return [
      "你正在为 Mercury Cinema 续写一部由用户与角色共同创作的纯文字长篇故事。输出是小说正文，不是聊天消息。",
      "只输出连续正文，不要解释规则，不要列清单，不要使用 Markdown 标题，不要写进度、数值、任务或选项菜单。",
      "自然承接用户刚写下的行动、语言或叙述。不要替用户决定内心、价值判断或关键选择；可以描写环境反馈与角色的可观察反应。",
      "保持节奏克制、感官具体、人物有分寸。一次推进一个自然段落群，并留下可继续书写的空间。",
      `舞台：${stage.title}${stageContext ? `。${stageContext}` : ""}`,
      `当前场景：${scenario.title}${scenario.summary ? `。${scenario.summary}` : ""}`,
      ...stage.worldRules.map((rule) => `世界约束：${rule}`),
      `角色核心：${character.displayName}。身份：${character.identity || "以角色档案为准"}。概要：${character.summary || "以角色档案为准"}。稳定特质：${variant.stableCore || character.stableTraits.join("、") || "以角色档案为准"}。`,
      `世界变体：${variant.worldIdentity || "本场故事中的角色"}。经历：${variant.contextBackground || ""}。当下表达：${variant.expression || ""}。`,
      `关系起点：${variant.relationshipStart || "熟识同学"}。共同经历：${variant.sharedHistory || "尚未补充"}。`,
      `用户身份：${instance.player.name || "你"}${playerIdentity ? `，${playerIdentity}` : ""}。`,
      profileText ? `演绎方式：${profileText}` : "演绎方式：平衡、尊重角色档案与当前故事节奏。",
      "使用简体中文，建议约 700 至 1200 个汉字。保持当前舞台的社会感与生活细节，避免套用任何既有作品的专有名词、人物或情节。",
    ].join("\n\n");
  }

  function validateGenerationRequest(value) {
    if (!isObject(value) || !cleanText(value.requestId) || !cleanText(value.instanceId) || !cleanText(value.userText) || !cleanText(value.systemPrompt)) throw new TypeError("Invalid CinemaGenerationRequest.");
    if (value.userText.length > 16000 || value.systemPrompt.length > 32000) throw new TypeError("CinemaGenerationRequest text is too long.");
    if (!Array.isArray(value.history) || value.history.length > 30) throw new TypeError("CinemaGenerationRequest history is invalid.");
    value.history.forEach((entry) => {
      if (!isObject(entry) || !["user", "assistant"].includes(entry.role) || !cleanText(entry.text) || entry.text.length > 16000) throw new TypeError("CinemaGenerationRequest history entry is invalid.");
    });
    return true;
  }

  function validateGenerationResponse(value) {
    if (!isObject(value) || !cleanText(value.requestId) || !cleanText(value.text)) throw new TypeError("Invalid CinemaGenerationResponse.");
    return true;
  }

  const api = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    INSTANCE_STATUSES,
    READING_THEMES,
    RELATIONSHIP_STARTS,
    defaultReadingSettings,
    createState,
    normalizeCharacterSnapshot,
    buildCharacterVariant,
    createDraft,
    normalizeDraft,
    normalizeInstance,
    normalizeNotes,
    normalizePendingContinuation,
    normalizeClosureRecord,
    normalizeStructureProvenance,
    normalizeState,
    createStageSnapshot,
    createScenarioSnapshot,
    createInstanceFromDraft,
    getStage,
    getScenario,
    assistantText,
    buildSystemPrompt,
    validateGenerationRequest,
    validateGenerationResponse,
  };

  global.MercuryCinemaContracts = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

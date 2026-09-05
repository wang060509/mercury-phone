(function exposeMercuryCinemaStageCatalog(global) {
  "use strict";

  const AEVORIA_STAGE_ID = "aevoria-academy";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => typeof value === "string" ? value.trim() : fallback;
  const list = (value) => Array.isArray(value) ? value : [];

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function normalizeScenario(value = {}, index = 0) {
    const id = text(value.id, `scenario-${index + 1}`);
    return {
      id,
      title: text(value.title, "Untitled Scenario"),
      season: text(value.season),
      summary: text(value.summary),
      entryPeriods: list(value.entryPeriods).map(String).map((item) => item.trim()).filter(Boolean),
      defaultEntryPeriod: text(value.defaultEntryPeriod),
      opening: text(value.opening),
    };
  }

  function normalizeStage(value = {}, index = 0) {
    const id = text(value.id);
    const title = text(value.title);
    if (!id || !title) throw new TypeError("Cinema Stage requires id and title.");
    const scenarios = list(value.scenarios).map(normalizeScenario);
    if (!scenarios.length) throw new TypeError(`Cinema Stage ${id} requires at least one Scenario.`);
    const presentation = value.presentation && typeof value.presentation === "object" ? clone(value.presentation) : {};
    const roleConfiguration = value.roleConfiguration && typeof value.roleConfiguration === "object" ? clone(value.roleConfiguration) : {};
    return {
      id,
      version: Math.max(1, Number(value.version) || 1),
      order: Math.max(1, Number(value.order) || index + 1),
      title,
      shortTitle: text(value.shortTitle, title),
      latinTitle: text(value.latinTitle),
      programmeTitle: text(value.programmeTitle, scenarios[0].title),
      region: text(value.region),
      tagline: text(value.tagline),
      summary: text(value.summary),
      premise: text(value.premise),
      presentation,
      roleConfiguration,
      scenarios,
      specializations: list(value.specializations).map(String).map((item) => item.trim()).filter(Boolean),
      defaultSpecialization: text(value.defaultSpecialization),
      relationshipOptions: list(value.relationshipOptions).map(String).map((item) => item.trim()).filter(Boolean),
      places: list(value.places).map(String).map((item) => item.trim()).filter(Boolean),
      worldRules: list(value.worldRules).map(String).map((item) => item.trim()).filter(Boolean),
      materials: list(value.materials).filter((item) => item && typeof item === "object").map(clone),
    };
  }

  function createStageCatalog(definitions = []) {
    const stages = list(definitions).map(normalizeStage);
    const ids = new Set();
    stages.forEach((stage) => {
      if (ids.has(stage.id)) throw new TypeError(`Duplicate Cinema Stage id: ${stage.id}`);
      ids.add(stage.id);
      deepFreeze(stage);
    });
    return Object.freeze({
      listStages() { return clone(stages); },
      getStage(stageId) {
        const stage = stages.find((item) => item.id === stageId);
        return stage ? clone(stage) : null;
      },
      getScenario(stageId, scenarioId) {
        const stage = stages.find((item) => item.id === stageId);
        const scenario = stage?.scenarios.find((item) => item.id === scenarioId);
        return scenario ? clone(scenario) : null;
      },
    });
  }

  const AEVORIA_STAGE = deepFreeze(normalizeStage({
    id: AEVORIA_STAGE_ID,
    version: 1,
    order: 1,
    title: "埃沃利亚学院",
    shortTitle: "埃沃利亚",
    latinTitle: "AEVORIA ACADEMY",
    programmeTitle: "专业分流确认期",
    region: "文达尔大陆 · 罗文地区",
    tagline: "在决定道路以前，先认真看看自己愿意把人生放在哪里。",
    summary: "一所历史悠久、声誉良好的综合魔法大学。古老学院、现代研究设施、低密度校园与大片自然研究地带共同组成学生的日常。魔法是成熟文明的基础设施，而不是血统或道德的奖赏。",
    premise: "十五岁后，学生开始进入专业教育并可跨地区申请学校。埃沃利亚以魔法工程、环境与大尺度魔法、语言史与古代魔法见长，但学院并非世界唯一中心。这里允许学术、友情、恋爱、普通生活与远行并存。",
    presentation: {
      structuralLabel: "STAGE 01 · VENDAR",
      programmeRoleCopy: "自定义学院身份",
      materialKicker: "WORLD EXTRA · CAMPUS MAP",
      materialHint: "在图上拖动，查看完整校园与交通说明。",
      facts: [
        ["校园", "低密度郊区校园 · 成熟公共交通"],
        ["故事范围", "校园生活、友情、恋爱、研究、工作与远行"],
      ],
      fieldKicker: "REPRESENTATIVE FIELDS",
      fieldTitle: "代表方向",
      preparationKicker: "III · STUDIES AND HISTORY",
      preparationTitle: "方向与共同经历",
    },
    roleConfiguration: {
      playerRoleLabel: "你的学院身份",
      playerRolePlaceholder: "例如：空间交通方向交换生",
      playerRoleHint: "身份可以普通、具体，也可以仍未决定。",
      defaultPlayerRole: "埃沃利亚学生",
      defaultCharacterRole: "埃沃利亚学生",
      characterRolePlaceholder: "例如：环境魔法方向学生",
      sharedHistoryPlaceholder: "例如：从基础教育阶段就认识；去年一起做过交通节点课程项目；今天才第一次在导师门外说话。",
      expressionPlaceholder: "核心人格在学院环境中的具体表现",
    },
    scenarios: [{
      id: "specialization-placement",
      title: "专业分流确认期",
      season: "秋季学期 · 第一周",
      summary: "课程确认、导师面谈与社团招新同时开始。你和角色可以从初识、长期同学、青梅竹马或既有恋人关系进入，不强制发生危机。",
      entryPeriods: ["十五岁后的专业教育第一年", "高年级专业确认期", "跨地区交换学期", "成年后的返校研究期", "自定义时间点"],
      defaultEntryPeriod: "高年级专业确认期",
      opening: "秋季的第一阵凉风掠过长草坡时，北门交通厅的铜钟刚刚敲过九点。新学期的课程确认表被风吹得轻响，学生们沿着白阶向不同学院散去。远处的温室原反射着浅绿的光，公共传送节点仍在吐出一批批刚抵达校园的人。\n\n你在老庭院外停了一会儿。今天之后，许多人的课程、导师与日常路线都会改变，但这不等于命运已经被写好。那个人正从图书馆方向走来，怀里夹着还没有拆封的课程册。",
    }],
    specializations: ["术式理论与结构", "魔法工程与器物", "生命、医疗与共生", "环境、地理与大尺度魔法", "空间、交通与远行", "语言、历史与古代魔法", "社会魔法与公共治理", "表达、感知与幻术艺术", "暂未决定"],
    defaultSpecialization: "暂未决定",
    places: ["老庭院", "维尔图书馆", "工造馆", "温室原", "长草坡", "北门交通厅", "白阶", "莱斯水域"],
    worldRules: [
      "魔法属于成熟多种族文明的科学、工程、医疗、交通、教育与日常基础设施。能力不由血统或道德决定。",
      "户外不是等待刷怪的地图。学院不是世界唯一中心。",
      "潜在线索只能低频出现为学术或基础设施异常，不得主动揭示隐藏主线，不得突然制造魔王、末日或强制危机。校园生活、友情、恋爱、毕业与普通职业本身都可成为完整故事。",
    ],
    materials: [{ id: "aevoria-campus-map", kind: "map", title: "校园与周边区域图", caption: "制图与空间研究课程组 · 1543 年修订", alt: "埃沃利亚学院校园与周边地图", asset: "assets/cinema/aevoria-campus-map.webp" }],
  }));

  const PRODUCTION_STAGE_CATALOG = createStageCatalog([AEVORIA_STAGE]);
  const api = { AEVORIA_STAGE_ID, AEVORIA_STAGE, createStageCatalog, normalizeStage, PRODUCTION_STAGE_CATALOG };

  global.MercuryCinemaStageCatalog = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

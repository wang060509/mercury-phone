(function exposeMercuryPresetContent(global) {
  "use strict";

  // 预设契约的共享事实源：模块库（id → 中文生成文本）、互斥组分区、默认预设数据。
  // 三个产物（store / assemble / validate）都从这里取，避免组定义与文本在不同文件漂移。
  // 文本全部为 Mercury 自研，无任何参考作品专有名词（过 banlist 零命中）。

  // 骨架段（必开，编译顺序最前）。来源 preset-control-v1 §3.0（主段给 preserve-role）+ §2 表对 mode 的描述。
  const SKELETON_TEXT = Object.freeze({
    "skeleton.preserve-role":
      "这是“玩法层”设定，用来调“你想怎么对话”，不是改写角色本质。角色是谁、它的价值观、动机、边界、知识范围，仍以角色档案为准。下面的设定只在玩法/关系/偏好的维度生效。",
    "skeleton.mode":
      "这是玩法层面的设定，与角色档案、与聊天界面的呈现设置是分开的，各自独立生效。",
  });

  // 关系起点组（互斥，四选一）。§3.1。
  const REL_TEXT = Object.freeze({
    "group.rel.respect-card":
      "这段对话的关系起点，尊重角色卡上写好的设定。如果卡上定了关系（比如熟人/恋人/初识），就照它来，不要因时间长短自动升温。",
    "group.rel.stranger":
      "这段对话从“陌生人初见”开始。角色和你素不相识，彼此都还没建立信任、没有共同过往。角色不会一开始就熟络、付托或袒露太多。",
    "group.rel.familiar":
      "这段对话从“熟识”开始。角色和你有一定交情、能自然接话，但仍保有各自的分寸，不必无话不说。",
    "group.rel.lovers":
      "这段对话从“恋人”开始。角色与你的关系已在亲密状态，信任和亲近是被认可的。但亲密不代表失去自我——角色的性格、原则、在乎的东西依然成立。",
  });

  // 戏剧强度组（互斥，三选一）。§3.2。
  const INT_TEXT = Object.freeze({
    "group.int.balanced":
      "戏剧强度平衡：有来有往，不刻意制造冲突，也不刻意回避波折。顺着角色和情境自然发展。",
    "group.int.slow":
      "戏剧强度舒缓：少一点猛烈的推进，多留白和日常感。让关系、冲突、情绪都慢一点、质感更绵长。",
    "group.int.high":
      "戏剧强度偏高：可以有更强的拉扯、悬念和情绪起伏。但在角色性格与身份允许的范围内用力，不为了戏剧性背叛角色。",
  });

  // 主动性组（互斥，三选一）。§3.3。
  const PRO_TEXT = Object.freeze({
    "group.pro.standard":
      "主动性常规：角色主要回应你，但遇到在意的话题、没解决的事或合适时机，也会自然地提起或追问。不刻意找话说。",
    "group.pro.initiative":
      "角色偏主动：会主动带起话题、推进关系、追问被回避的事、分享自己最近的生活。主动来自角色自己的动机和性格，不是每轮机械开场。",
    "group.pro.reactive":
      "角色偏回应：以你的发话为中心，主要接着你的话题走，不主动转移或挑起新话题。但这不等于干答或只接不动——在对方的话题内，角色仍会带一点自然的推进（追问一句、把话递回、留一个由你接住的口子），只是不做话题主导者。",
  });

  // 偏好模块是非互斥可叠加组，id 不带 group. 前缀（preset-control-v1 §1.2/§3.4）。
  // 含运行时占位，未填不生成对应段。§3.4。
  const PREF_TEXT = Object.freeze({
    "pref.focus":
      "这段对话的话题，优先朝{initialFocus}展开。角色谈到相关处自然靠拢，但不必每一步都硬拽回来。",
    "pref.address":
      "你希望被用{address}称呼。角色会按这个称呼与你交流。",
    "pref.hard-off":
      "这段对话尽量避开这些：{hardOff}。除非你主动提起，否则角色不往这些方向带。",
  });

  // 全部生成文本的查找表：模块 id → 中文文本。assemble 只从这取。
  const MODULE_TEXTS = Object.freeze({
    ...SKELETON_TEXT,
    ...REL_TEXT,
    ...INT_TEXT,
    ...PRO_TEXT,
    ...PREF_TEXT,
  });

  // 互斥组分区：组 id → 该组的候选模块 id 数组（组内最多启用一个）。
  const EXCLUSIVE_GROUPS = Object.freeze({
    "group.rel": Object.freeze(["group.rel.respect-card", "group.rel.stranger", "group.rel.familiar", "group.rel.lovers"]),
    "group.int": Object.freeze(["group.int.balanced", "group.int.slow", "group.int.high"]),
    "group.pro": Object.freeze(["group.pro.standard", "group.pro.initiative", "group.pro.reactive"]),
  });

  // 骨架模块 id 集合：必开、不可关，编译顺序最前。
  const SKELETON_MODULES = Object.freeze(["skeleton.preserve-role", "skeleton.mode"]);

  // 内置默认预设（preset-control-v1 §5.1）：骨架 + 每类互斥组各选一个中性候选。
  // 未显式启用 / list() 恒含的兜底。
  const DEFAULT_PRESET = Object.freeze({
    id: "preset-default",
    name: "默认预设",
    version: 1,
    modules: Object.freeze({
      order: Object.freeze([
        "skeleton.preserve-role",
        "skeleton.mode",
        "group.rel.respect-card",
        "group.int.balanced",
        "group.pro.standard",
      ]),
      enabled: Object.freeze({
        "skeleton.preserve-role": true,
        "skeleton.mode": true,
        "group.rel.respect-card": true,
        "group.int.balanced": true,
        "group.pro.standard": true,
      }),
    }),
    custom: Object.freeze({ instructions: null }),
  });

  // 运行时占位符：生成时用 preset.preferences 里的同名键替换；未填则整个模块段不生成。
  // 字段名已定（08-04 用户拍板）：pref * 的取值存顶层 preset.preferences，key 即下面的占位符名。
  const PREF_PLACEHOLDERS = Object.freeze({
    "pref.focus": "initialFocus",
    "pref.address": "address",
    "pref.hard-off": "hardOff",
  });

  function hasConflictGroupValue(group) {
    return Object.prototype.hasOwnProperty.call(EXCLUSIVE_GROUPS, group);
  }

  function moduleText(moduleId) {
    return MODULE_TEXTS[moduleId] || null;
  }

  const api = {
    SKELETON_TEXT,
    REL_TEXT,
    INT_TEXT,
    PRO_TEXT,
    PREF_TEXT,
    MODULE_TEXTS,
    EXCLUSIVE_GROUPS,
    SKELETON_MODULES,
    DEFAULT_PRESET,
    PREF_PLACEHOLDERS,
    hasConflictGroupValue,
    moduleText,
  };
  global.MercuryPresetContent = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

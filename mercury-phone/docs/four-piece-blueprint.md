# Mercury 四件套对标开发蓝图

日期：2026-08-02
性质：**开发蓝图（规划文档，暂不写代码）**。把「角色卡 / 预设 / 世界书 / 美化」四件套，每件对标成熟目标产品相应环节的成熟度，给出一条可执行的开发路径。解决「东做一点西做一点自己脑补」的问题。

关联：`dev-targets.md`（目标语义与 Roadmap）、`runtime-core-v1.md`（编译优先级两轴 / 6 输入槽 / 缺口表）、`dev-progress.md`（跨会话现状）、`FUNCTION_AUDIT.md`。

> ⚠️ 红线：本文任何「对标」只借鉴**抽象结构 / 框架 / 交互范式**。不出现任何参考作品的名称、角色、剧情、专有名词、设定名。已随看随弃原来源，不留原文。

---

## 0. 蓝图的总思路

**不做「移植」，做「对成熟环节的成熟度建模」。** 四件套每一件，先讲清它到底该由哪几个环节构成、每个环节要达到什么成熟度，再落到 Mercury 现有代码上判断「已有什么 / 缺什么 / 第一步叫什么」。做法与 `dev-targets.md §4a` 的「阅后即焚·抽象框架」一致：只借范式，内核自研。

全局锚点（来自 `runtime-core-v1.md §0.2` 的两轴，蓝图所有件都遵守）：

| 轴 | 语义 | 决定 |
|---|---|---|
| 编译优先级 | Core > 安全 > 会话 > 用户预设 > 角色档案 > 世界/模块 > 临时 | 文本顺序 |
| 权威边界（分维度） | 用户预设调玩法/关系/偏好（优先），但不改写角色本质 | 谁能改「角色是谁」 |

四件套与这两轴的关系：
- **角色卡** 承载「角色档案」→ 演谁（权威边界的高位）。
- **世界书** 承载「世界/模块」（模块按 scope/enabled）→ 背景与规则。
- **预设** 承载「用户预设」玩法层 → 用户想怎么玩（优先级在角色档案之上，但不得改写本质）。
- **美化** 承载呈现层（气泡/主题/排版）→ 呈现，**不得改变角色选择/动机/知识**。

每件的成熟度都分三阶：**可用**（能读写、能进链路）→ **够用**（语义完整、边界正确）→ **成熟**（多实例、自动、回环）。当前代码大部分停在「可用」。

---

## 第一件：角色卡

### 对标环节（成熟目标产品的成熟度）
1. **卡片模型**：一张卡是一个结构化角色定义（身份/历史/价值观/动机/限制/声音），可编辑、可版本化、可套用。
2. **卡片库/资产层**：全局存多张卡，支持搜索、归类、导出/导入。
3. **对话实例层**：每个对话是卡的一份实例，可在实例上覆盖显示名/头像/若干人设，全局卡不变。
4. **卡→编译**：卡的角色信息作为「演谁」进编译输入；卡的状态把关（draft/needs-review/ready）决定是否自动生效。

### Mercury 现状（实测）
| 环节 | 现状 | 缺口 |
|---|---|---|
| 1 卡片模型 | `archive-contracts.js:98 createRuntimeProfile()` 有全部角色向字段（identity/stableTraits/motivations/fears/values/boundaries/careStyle/conflictStyle/defenseStyle/voiceStyle/…）；`serializeForExport()` 已能导出 | **卡模型基本齐**。缺「版本化 / 模板套用」 |
| 2 卡片库 | `archive.v1.runtimeProfiles[]` 全量向量；Archive UI 有 home/profile 路由 | **够用**。缺搜索/归类排序 |
| 3 实例层 | `archive.v1.contactInstances[]`（id/runtimeProfileId/displayName/relationshipState/timelineId/active）就是实例层 | **缺 per-chat 覆盖字段**（R1：显示名/人设覆盖，同一卡开多对话互不污染） |
| 4 卡→编译 | **未接**。`compileRuntime()`（`chat-contracts.js:180`）只收 runtimeCore/runtimeModules/userPreset，不收 RuntimeProfile；接线缝 `requestAssistant` 也未喂卡数据 | **这是首期垂直切片**（`dev-targets.md 目标C`） |

### 开发路径
- 阶段一（可用，`dev-targets.md 目标C` 本期）：把 approved/ready 的 RuntimeProfile 读进编译输入 → 建 `buildRuntimeInput(state)` 装配函数 → `requestAssistant` 加 runtime 字段 → 卡真正进对话。验收见 `dev-targets.md §7` 握手链路。
- 阶段二（够用）：给 `contactInstance` 加 per-chat override（displayName/voice/可选人设覆盖），同一卡多对话实例互不污染（采纳 R1）。
- 阶段三（成熟）：模板套用（新卡从现存卡复制结构）、搜索/归类、卡版本与回滚。

---

## 第二件：预设

### 对标环节（成熟目标产品的成熟度）
1. **玩法模型**：预设是一组「用户想怎么玩」的显式设定（关系起点 / 戏剧强度 / 主动性 / 话题偏好），与呈现层、与角色本质分层。
2. **预设编辑器**：可视化编辑玩法字段，存成一份可启用/切换的预设。
3. **预设→指令**：把玩法字段压缩翻译成一段 `instructions` 文本，喂进编译产物。
4. **两轴正确**：优先级上，预设排在角色档案之前（用户偏好先生效）；权威边界上，预设不得改写角色本质。

### Mercury 现状（实测）
| 环节 | 现状 | 缺口 |
|---|---|---|
| 1 玩法模型 | **无独立结构**。⚠️ 现有 `DEFAULT_SETTINGS`（`chat-contracts.js:12`）是**呈现层**（presentation/context/memory），不是玩法层 | 需独立 `UserPreset` 契约（`dev-targets.md 目标B`），**不并入 DEFAULT_SETTINGS** |
| 2 预设编辑器 | 无 UI | 需新增（属 UI 范畴，交 UI 负责人；Claude 只定契约） |
| 3 预设→指令 | `compileRuntime()`：`userPreset.instructions` + `presetId` 槽已预留（L183/185/188） | 契约是空壳，无生成器、无存储 |
| 4 两轴正确 | 语义在 `runtime-core-v1.md §0.1` 冻结 | **无数据/代码依据**（权威边界纯语义），未落校验 |

### 开发路径
- 阶段一（可用）：定义独立 `UserPreset` 契约（relationshipStart/intensity/proactivity/preferences），独立命名空间存储（`mercury.app.<appId>.<key>`），生成器把玩法字段翻成 `instructions` 喂 `compileRuntime` 的 `userPreset` 槽。
- 阶段二（够用）：编辑器 UI + 启用/切换预设；编译时优先级落码（预设排在角色档案前，但只过玩法层字段）。
- 阶段三（成熟）：预设一键导出/分享、预设冲突校验（与角色档案冲突时以档案为准）、关系起点对 `ChatExperience` timeline 的联动。

---

## 第三件：世界书

### 对标环节（成熟目标产品的成熟度）
1. **世界模型**：一组有条理的设定条目（人物/地点/历史/规则/事件…），有可见性（公开/限知/角色专属）、触发条件、优先级。
2. **生效过滤**：每个条目按触发条件决定是否进上下文——不是全量塞入，而是按需装配。
3. **世界绑定**：条目可绑定到角色/对话/全局，决定何时生效。
4. **世界→编译**：生效条目按 scope 组装进编译输入，作为「背景与规则」。

### Mercury 现状（实测）
| 环节 | 现状 | 缺口 |
|---|---|---|
| 1 世界模型 | `archive-contracts.js:131 createWorldEntry()`（type/title/summary/content/aliases/tags/alwaysActive/priority/visibility）→ `createWorldProfile()`（foundations + entries）。**模型已建成、字段全** | **够用**。缺「触发条件」维度（目前靠 priority/alwaysActive，无按上下文动态触发的条目标记） |
| 2 生效过滤 | **无**。`compileRuntime` 未收 WorldProfile/WorldEntry | 需按 scope + enabled + priority 装配生效条目的函数 |
| 3 世界绑定 | `runtimeProfile.worldBindings` 字段存在；Archive 有 `worldBindings` 概念 | 绑定语义未用于编译过滤 |
| 4 世界→编译 | **未接**（同角色卡，缺口表 `runtime-core-v1.md §4`） | `buildRuntimeInput` 里一并组装生效世界条目 |

### 开发路径
- 阶段一（可用）：在 `buildRuntimeInput` 里按 **scope（global/character/world/conversation）+ visibility（public/restricted…）+ priority** 装配生效 WorldEntry -> 喂编译。首期建议**仅手动启用**的世界条目（`runtime-core-v1.md §5` 待决策，倾向是）。
- 阶段二（够用）：加**触发条件**（关键词/上下文命中才进上下文）——这是世界书从「全量」走向「按需」的关键一阶，区别于角色卡。
- 阶段三（成熟）：触发条件自动评估 + 条目间 relatedEntryIds 关联展开 + 与角色卡绑定联动。

---

## 第四件：美化 / 主题

### 对标环节（成熟目标产品的成熟度）
1. **可换肤变量层**：主题就是一组 CSS 变量覆盖，不写死在一处 `:root`。
2. **主题包格式**：一份主题 = 壳 + 变量块（可选自定义 CSS 扩展），可导入/导出。
3. **主题作用域**：`[data-theme]` 作用域，运行时切换即时生效；系统级 light/dark 或配色方案可配置。
4. **只做引用不改设计**：主题只换呈现，不改角色选择/知识/动机（对齐 Core §17 运行时媒介中立）。

### Mercury 现状（实测）
| 环节 | 现状 | 缺口 |
|---|---|---|
| 1 可换肤变量层 | `app/styles/tokens.css` `:root` 定义 `--color-*`/`--radius-*`/毛玻璃等，**写死**（`color-scheme: light` + 一套值） | 需把 `:root` 改造成 `[data-theme]` 作用域变量覆盖 |
| 2 主题包格式 | 无。仓库根落了两个**主题预设文件**（JSON 壳 + custom_css + `:root` 变量块），**已读完未应用** | 需定义 Mercury 自己的主题包格式（壳 + 变量覆盖 + 可选扩展），**不照搬原文件的 `:root` 结构**，只借「壳 + 变量 + 扩展」的框架 |
| 3 主题作用域 | `app/main.js:129` 已有 `theme:requested` 事件 → `screen.dataset.theme` 接缝；`app/locales` 补了 `switcher/settings` 命名空间 | **接缝已存在，未动手** |
| 4 只做引用 | 记忆 `design_principles.md`：低饱和粉/通透/玻璃，杜绝暖黄/木色/深色赛博朋克；**只做引用不做设计** | 主题落色须守着这套美学校准，不用「按描述生成配色」 |

### 开发路径
- 阶段一（可用）：`tokens.css` 改为 `[data-theme=light]` 默认 + 变量覆盖组；接 `screen.dataset.theme` 接缝做**运行时切换**；把仓库那两份主题各转成**第一步自研主题**（米色复古纸 / 深空夜）做实验——转译时只提取「壳+变量覆盖」框架，重写变量为 Mercury 的 `--color-*`/`--radius-*` 命名，**不复用原文件任何专有内容**。
- 阶段二（够用）：定义主题包数据结构（themeId/name/变量覆盖/可选 CSS 扩展），支持导入/导出/多主题并存。
- 阶段三（成熟）：主题市场入口、跟随系统 light/dark、主题与壁纸/图标解耦（沿用 `theme_system.md` 的壁纸/图标独立原则）。

---

## 总排序建议（贴合 `dev-targets.md §5` Roadmap）

1. **角色卡垂直切片**（本期待做，`目标C`）：读卡 → 编译 → 进对话。打通整条线，四件套共用的**装配函数 `buildRuntimeInput` 在此诞生**。
2. **世界书接入**：与角色卡共用 `buildRuntimeInput`，在同一条垂直切片里一并把「生效世界条目」装进来（缺口最接近，边际成本最低）。
3. **美化换肤基建**：`tokens.css` → `[data-theme]` + 运行时切换（`main.js` 接缝已在，最易先落地出可见效果）。
4. **预设契约**：定义 `UserPreset` + 生成器（独立于 DEFAULT_SETTINGS），接 `compileRuntime` 空壳槽。
5. **两轴落码**：编译可靠性 / 权威边界校验（多档解析、scope/enabled/priority 消化、预设 vs 档案冲突裁决）。

> 每一步都是「可用」先行，不一次做完优先级系统（对齐 `dev-targets.md 目标C` 的推进纪律）。

---

## 附：本文没有做的

- 未写任何代码。所有改动标注为「阶段一/二/三」路径与待实现位置。
- 未引入任何第三方角色卡/剧情原文；未在数据里写任何酒馆字段、未改 schema。
- 未拍板 pending 项（预设编辑器 UI、世界书是否仅手动启用、主题语汇具体落什么色）——留待对应要件实现时按流程讨论。

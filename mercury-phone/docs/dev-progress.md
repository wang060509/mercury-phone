# Mercury 开发进度存档（跨会话断点）

> 作用：记录「已完成的工作现状」与「待决定的未决问题」，供任何新会话直接恢复，不依赖上一个对话的记忆。
> 性质：**事实记录**。不包含任何「已完成✓/未完成」的拍板判断，只写代码当前处于什么状态、哪些方向还没定。
> 更新方式：每次会话有实质改动后，据此文件刷新「现状」一节；「未决」一节保持最新。
> 关联：`docs/dev-targets.md`（目标语义）、`memory/` 下的设计原则与开发流程。

---

## 0. 遇 Bug 优先查这两份（新会话必读）

- **`docs/feature-store-layer.md`** —— 数据/存储层的 5 个返工坑 + 加固模板。**任何"存不住/重启丢/数据坏/坏了静默变空"这类 bug，先来这里对坑，看是不是 storage 层的问题，再往别处排查。**
- **`docs/reference-phone-architecture.md`** —— 完整"小手机"架构对标（人设/活人感/呈现分层、防油腻、心声、记忆、世界书）。聊天体验类问题先看它。

## ⚠ 阅后即焚红线执行（用户最在意，勿违）

参考作品**只借结构/框架，绝不复现名字/剧情/角色/专有名词**（用户担忧：被懂行的人看出原型 = 抄袭铁证 = 身败名裂）。机制见 `docs/redline-cleanup-policy.md`：
- 参考源码一律放 `reference-sources/`（`.gitignore`，永不进 commit）。
- **所有落地预设/世界书/角色卡文本，入库前必须过 `reference-sources/banlist.md` 专有名词词表查重，零命中才可。**
- **公开发布前必做**：①删除本地 `reference-sources/`（含 banlist.md）②源码/文档 grep 专有名词零命中 ③确认 `.gitignore` 隔离规则持续生效 ④确认提炼文档已脱敏。2026-09-06 recovery baseline 准备已确认该目录不进入首个 commit；这不等同于允许公开仓库。

---

## 权威进度源（按可信任度排序）

`.git` 目录是空的（已 `git init` 但无提交），**没有可查的 commit 历史**。进度只能靠：

1. `docs/`（dev-targets.md / runtime-core-v1.md / 各 phase）
2. 本文件（跨会话断点）
3. 文件修改时间（`app/` 下的 mtime 可判断最近动过哪些）
4. 代码本身

---

## 1. 最近一个会话（2026-08-02）实际改动过的文件

以下均按文件修改时间确认，非推断。mtime 集中在 08-02 15:17–19:09。

### 代码（在磁盘上的现状）

| 文件 | 现状 |
|---|---|
| `app/core/chat-experience-contracts.js` | 新增 `contactFromProfile(card)`、`isTavernCard(source)`、`contactFromTavernCard(source)`，并导出 `contactFromProfile`。`contactFromProfile` 检测到 `chara_card_v2`（`spec`/`spec_version`/`character_book`）时走 tavern 映射，否则走 runtime-profile 映射。**这只识别形状，不写任何酒馆特有字段，不改 schema。** 另：`DEFAULT_CONVERSATION_SETTINGS.unspokenAside` 由 `off` 改为 `occasional`（心声默认开启为「偶尔」，见本会话「心声」改动）。 |
| `app/apps/mercury-chat-app.js` | `contactFromImportedCard(card)` 委托给共享的 `contactFromProfile`；导入 JSON 卡 → 生成联系人（带 persona）。含导入 JSON/typo 防御。UI 文案已译为中文。 |
| `app/apps/archive-app.js` | 新增 `bridgeProfileToChat(profile)`（把档案角色写进 `chat-experience.v1` 成为联系人，幂等）；「添加到聊天」按钮接入它。`render` 用 `safeStore` 包 `store.load()`。UI 文案译为中文。 |
| `app/core/runtime-core.js` | **新增 4 条活人感基线规则到全局核心**：[Core 23] Avoid exam-answer delivery（反答题腔＝不接力科普/不按背景历史原理结论铺开/说完就停）、[Core 24] Balance speaking, feeling, and moving（平衡三动作＝回应+情绪态度+推进点，不连续猛答/猛问）、[Core 25] Convey experience, not a knowledge dump（走体验不走知识＝讲感受经历，不搬运定义/条目）、[Core 26] End without summarizing（反总结收尾＝不用总之/所以整体要）。**并入核心＝全局必开不可关（用户拍板路A）**，所有角色与预设无条件继承，不设开关、不属预设 UI。核心版本 core-v0.1 → core-v0.2（version 1→2）。rules 现共 30 条。**后又加 [Core 27] Ground discipline（防油腻纪律，置末不可被预设覆盖），升 core-v0.3，rules 31 条。** |
| `app/system/notification-store.js` | **已按 `feature-store-layer.md` 加固（bug 修复，非仅文档）**：坑1 坏数据不再静默清空→留存 `corrupt` 原文 + 整表坏不覆盖写回；坑3 三路径统一 `_commit`（不入新数组不扔、不吞写失败，`lastWriteError` 可见）；坑4 新增 `#normalizeOne/#normalizeAll` schema（坏条目丢弃但整表不因一处坏全丢）。**保持行为兼容**：`main.js:25` 及测试的同步 `list()`/`items` 用法不变，未引入 IndexedDB 异步（坑2/5 留后续）。测试 `notification-store` 15 / `overlay-controller` 19 / `chat-contracts` 42 全绿。 |
| `app/styles/tokens.css` | `:root` 设计 token 系统：Manrope 字体栈 + PingFang/雅黑回退、颜色（`--color-*`）、圆角（`--radius-*`）、毛玻璃 `.mercury-glass`、阴影、动效、安全区、设备 390×844。 |
| `app/styles/mercury-chat-app.css`、`system-shell.css` | 玻璃/渐变/细字重质感；`body { font-weight: 300 }`。 |
| `app/main.js` | 默认 locale `"zh-CN"`（L7），`fallbackLocale: "en-US"`；已有 `theme:requested` 事件 → `screen.dataset.theme`（L129，换肤接缝已存在）。 |
| `app/locales/en-US.js`、`zh-CN.js` | 补了 `switcher` 与 `settings` 命名空间（此前后台设置渲染成英文的根因）。 |
| `app/tests/mercury-chat-app.test.js` | 加 tavern 卡导入测试、联系人计数改为 4。 |
| `app/tests/archive-app.test.js` | 加 bridgeProfileToChat 幂等测试、errorText 断言更新。 |

### 规划文档（本会话新增）
| 文件 | 内容 |
|---|---|
| `docs/four-piece-blueprint.md` | **新文档**：四件套（角色卡/预设/世界书/美化）对标成熟环节的开发蓝图。每件分「可用→够用→成熟」三阶 + 对照 `compileRuntime` 两轴 / archive-contracts / tokens.css 的现状与缺口。全程阅后即焚，不落任何参考作品专有内容。总排序：角色卡垂直切片 → 世界书接入 → 换肤基建 → 预设契约 → 两轴落码。 |
| `docs/preset-control-v1.md` | **新文档（契约稿，未写代码）**：预设「玩法控制层 v1」。契约 = 独立 `UserPreset`，**只存一个模块列表**（骨架必开 + 互斥组多选一 + 选择可叠加），**不设固定玩法字段、不可并入 `DEFAULT_SETTINGS`**（那是呈现层）。含生成器中文文本（§3）、基础层行为基线（§7 反答题腔/体验非知识/知识边界）、用户上传便携格式（§8,`kind: mercury.user-preset`）。**UI 定稿 = 瀑布卡片式（§6.3）：一卡一模块、随条数自适应**。UI 方向已写、交 codex 做，见 `docs/preset-control-v1.md` §6/§8。 |
| `docs/reference-phone-architecture.md` | **新文档（架构对标，持续参考非印后即焚）**：深读一个开源浏览器端"小手机"应用后复盘其**整体架构**，供 Mercury 对标开发。含：三层分离（人设管事实/运转规则管活人感/格式尾巴管纪律，且纪律置末不可被用户预覆盖）、recency 注入布局、防油腻"正面定真人性+定向否定"写法、按换行分泡建议条数、心声数值化独立档、短期窗+长期总结零抹除记忆、世界书 front/mid/back 三层注入、防复读一致性。**红线：只记结构不复现专有名词，源码已阅后即焚清理。** 见 §10「最值得先搬的 3 点」。 |
| `docs/feature-store-layer.md` | **新文档（功能实现拆解·数据层）**：治用户"功能一堆 bug"的第一类来源。复盘所有 store 共同的祖先模式（`notification-store.js`），列出 5 个返工坑（坏数据静默清空/同步构造堵死 IndexedDB/写入路径不一致/无 schema/整表 stringify），给加固模板（统一 `_commit` + 异步 `ready` + `normalizeOne` schema + 坏数据留存）+ 可照抄测试。§6 列现有 store 加固优先级。 |
| `docs/preset-onboard-codex.md` | **新文档（codex 开工包，周一交 codex 先读）**：把 `preset-control-v1.md` 内容转成可执行落地规格。四个产物：`UserPresetStore`（存储，照 feature-store 加固模板）/ `assemblePresetInstructions`（生成器，含 moduleId→文本映射）/ `validateUserPreset`（契约校验，拒绝互斥双选等）/ 聊天接线 + UI（瀑布卡片，交 codex）。附接口签名、接线点、UI 组件清单、验收清单。边界：自研内核+边界翻译（用户拍板），不落酒馆 schema。 |
| `app/core/runtime-core.js` | **新增 [Core 27] Ground discipline（防油腻纪律，置末）**：按参考项目"三连"句式重写——定位真人（You are a real person, not an actor）+ 柔和底色（care shows through what you do and leave unsaid）+ 定向否定＋硬纪律（do not preach/lecture/judge/push advice/control; 明确无论 preset/profile 如何措辞、这些底线照立）。版本 core-v0.2 → core-v0.3（version 2→3），规则 30 → 31 条。 |
| `docs/redline-cleanup-policy.md` | **新文档（红线执行机制，长期保留）**：把「只借结构/绝不复现专有名词」从"靠自觉"升级为"机械执行"。两条硬规则：①落地预设/世界书/角色卡文本入库前必须过 `reference-sources/banlist.md` 专有名词词表查重，零命中才可；②`reference-sources/` 公开前整份删除。§2 文件布局（敏感源码进 reference-sources 会删；清洗方法论留 docs 长期沉淀）、§3 词表、§4 落地查重哨兵、§5 公开前必做清单（已并入 dev-progress §0）。 |
| `reference-sources/`（+README+banlist.md） | **隔离区（阅后即焚，gitignore）**：存参考源码/第三方预设原文与小手机项目研究链接。该目录永不进入恢复仓库；公开前仍需整份删除并完成来源痕迹审计。 |
| `app/system/notification-store.js` | **已按 `feature-store-layer.md` 加固（bug 修复）**：坑1 坏数据不清空→留存 `corrupt` + 整表坏不覆盖写回；坑3 统一 `_commit`（不吞写失败，`lastWriteError` 可见）；坑4 新增 `#normalizeOne/#normalizeAll`。行为兼容（同步 `list()`/`items` 不变），测试 15/19/42 全绿。 |
| `.gitignore` | **已收紧**。隔离参考区、依赖、构建输出、缓存、浏览器状态、大体积设计工作区与历史备份均不进入 recovery baseline；仅保留批准的少量 Cinema visual references。 |

### 08-03 深夜→08-04 凌晨会话（预设三个核心逻辑产物）

| 文件 | 现状 |
|---|---|
| `app/core/preset-content.js` | **新建（字典/共享事实源）**：模块库（各选项中文生成文本，取自 `preset-control-v1 §2/§3`）、互斥组分区（group.rel / group.int / group.pro）、骨架模块（skeleton.* 必开）、内置默认预设 `preset-default`（§5.1）、`pref.*` 运行时占位符表。文本过 banlist 零命中（红线）。 |
| `app/system/user-preset-store.js` | **新建（柜子）**：照已加固 notification-store 同步风格。`list()` 恒含 `preset-default` 打头；`get(null/id)` 回退默认不崩；`add` 同 id 覆盖；`remove/clear/subscribe`；`normalizeOne/All` + `corrupt` 留存 + 统一 `_commit`（坑1/3/4）。含 `acceptedConflicts`（用户「不更改继续」授权组）透传。仅做结构/类型强转，**不重复 validate 语义校验**。 |
| `app/core/preset-assemble.js` | **新建（翻译机）** `assemblePresetInstructions(preset, {withWarnings})`：按 `modules.order` 依序只拼 `enabled` 模块；互斥组内取 order 第一个 enabled 候选、其余跳过 + warning；骨架最前；`custom.instructions` 最后；`pref.*` 占位符注入（未填不生成该段）；未知模块从 `preset.modules.texts[id]` 取或跳过 + warning；空返回 `""`。默认返回 string，`withWarnings` 返回 `{text, warnings}`。不碰活人感（防油腻在核心 core-v0.3）。 |
| `app/core/preset-validate.js` | **新建（门卫）** `validateUserPreset(preset)` → `{ok, errors, warnings}` 不 throw。error：缺 id/name、缺 modules 形状、**互斥组多选（精确列 `conflictModules` 供弹窗点名）**、order 引用未定义模块；warning：`acceptedConflicts` 授权的多选降级、未知模块无文本、order 含未启用项。**宽松为先**（借鉴小手机：只拦真得拦的）。 |
| `app/tests/preset-content.test.js` / `user-preset-store.test.js` / `preset-assemble.test.js` / `preset-validate.test.js` | **新建 4 测试，全绿**：34 / 23 / 19 / 21 断言。沿用 `FakeStorage`/FakeElement + `N assertions passed` 手动计数。沿用 require preset-content 前置（各文件 IIFE 挂 `globalThis`）。 |

> **注意（文本引号坑）**：预设中文文本里的引号必须用 Unicode 中文引号 `“”`（U+201C/U+201D），**不能**用 ASCII `"`——落进 JS 字符串会提前闭合报 SyntaxError。

### 08-04 傍晚会话：预设「装车」——把 userPreset 槽接进聊天

**触发**：用户看测试全绿后追问「现在聊天体验会不会改善」。诚实答复：预设产物一行都没进聊天（`buildRuntimeInput()` 原硬编码 `userPreset: null`、`runtimeModules: []`），4 个产物只是零件未装车。用户拍板「先写吧，codex 复工还得等；情况坏到一定程度会接一个带视觉的 API 做前端」。

**改动（全绿，无回归）：**
| 文件 | 现状 |
|---|---|
| `app/core/chat-experience-contracts.js` | `DEFAULT_CONVERSATION_SETTINGS` 新增 `userPresetId: "preset-default"`（每对话绑定用哪个预设，随 experience 持久化）。normalize 时 `...DEFAULT_CONVERSATION_SETTINGS` 展开自动带上默认。 |
| `app/system/user-preset-store.js` | `normalizeOne` 补 `preferences` 往返保留（pref.* 占位符取值此前被丢弃：add→get 即丢失）。顶层 `preferences`，`pref.focus/address/hardOff` 对应 `initialFocus/address/hardOff`。 |
| `app/apps/mercury-chat-app.js` | `render()` 新增 `#initPresetLayer()`：fail-soft 装配预设层，把 chat-app 的 `{get,set}` 存储**转接**成 store 要的 `getItem/setItem`；缺 `MercuryPresetContent/Assemble/UserPresetStore` 任一或 storage 缺失 → `presetStore/presetAssemble` 置 null，**旧行为不炸**。`buildRuntimeInput()` 改调 `#resolveUserPreset()`：从 `experienceFor(activeContactId).settings.userPresetId` 取 id → `store.get` → `assemble` → 喂 `compileRuntime.userPreset {id, instructions}`；违约/缺件回退 null。预设文本最终落入 `compiledSystemText`（**compileRuntime 返回**的字段没有 `userPreset`，只有 `presetId` + `compiledSystemText`，测试断言据此改——这是排查时发现的关键点）。 |
| `app/index.html` | 在 `mercury-chat-app.js` 前注入 3 个 script：`core/preset-content.js`、`core/preset-assemble.js`、`system/user-preset-store.js`（生产端才拿得到 global）。 |
| `app/tests/user-preset-store.test.js` | 加 `preferences` 往返测试（26 断言）。 |
| `app/tests/mercury-chat-app.test.js` | 追加接线断言块：默认回退 preset-default（含骨架「玩法层」文本）→ 用户预设命中（`presetId`==`preset-lovers`）→ `pref.*` 占位符替换（`initialFocus`/`address` 进 compiledSystemText）→ 互斥组取恋人候选。`**pref.address 模块也必须出现在 order/enabled 里才会渲染**（只填 preferences 但 order 没启用该模块，不出现）。 |

**调试中踩到的点（写测试/接线者必看）：**
- `compileRuntime()` 的**返回对象没有 `userPreset` 字段**，预设指令被合并进 `compiledSystemText`；`presetId` 字段能反映当前命中的预设 id。测试一律对 `compiledSystemText` / `presetId` 断言。
- chat-app 的 storage 是 `{get(key,fallback), set(key,value)}`；`MercuryUserPresetStore` 期待 `getItem/setItem`。`#initPresetLayer` 里做了形状探测转接。

**测试最终全绿**：preset-content 34 / user-preset-store 26 / assemble 19 / validate 21 / notification 15 / chat-contracts 42 / chat-app 54+接线 / archive 49。



### 记忆文件（本会话新增，见 `memory/`）
- `feedback_reference-fire-and-forget.md` — 阅后即焚红线（长期约束）
- `project_benchmark-blueprint.md` — 对标落点 = 四件套开发蓝图
- `MEMORY.md` — 记忆索引（新建）

### 测试可运行（建议新会话先跑一次确认绿）

```bash
cd /d/candy-phone-prototype/mercury-phone
node app/tests/chat-contracts.test.js
node app/tests/mercury-chat-app.test.js
node app/tests/archive-app.test.js
```

测试约定：`FakeElement` + `t:key=>key` + 改 `ui.route` 后 `paint()` + `.children[n]` 断言 + 尾部 `console.log("…: N assertions passed")` 字面量计数（**手动维护**）。

---

## 1.6 给明天（2026-08-03 下班）新会话的接手说明

**用户上一条（08-02 睡前）**：去上班了，明天下班接着开发。参考素材已搬进 `reference-sources/`（13 份 JSON + 教材级开源小手机链接已存）。**这是用户说的"教材一样重要、以后经常学"的长期参考。**

**明天 default 接手顺序（用户当晚拍板）：**
1. **先 `cd /d/candy-phone-prototype/mercury-phone && node app/tests/notification-store.test.js` 等确认绿**（store 已加固）。
2. **预设优先**——用户明确"先写预设"，且 codex 周一起复工。**明天第一件事：按 `docs/preset-onboard-codex.md` 写预设三个不带 UI 的核心逻辑产物**：`UserPresetStore`（照 feature-store 加固模板）、`assemblePresetInstructions`（生成器）、`validateUserPreset`（契约校验）。这些纯逻辑不依赖 UI，codex 来了只补瀑布卡片 UI + 接线。**用户此轮已明确"先把逻辑写了吧"。**
3. 之后才推进：聊天闭环核心链路（角色卡/世界书导入→喂编译）、沉浸感小功能、全局美化。**用户优先级：聊天完整闭环 > 沉浸感小功能 > 全局美化/装饰桌面 > 其余。**

**重要约束（勿忘）：**
- **红线**：参考素材在 `reference-sources/`（gitignore），写预设必须过 `banlist.md` 词表零命中；公开前整删 reference-sources。见 `dev-progress` §0 顶部 + `docs/redline-cleanup-policy.md`。
- **边界**：自研内核 + 边界翻译（用户拍板），不直接存酒馆 schema。
- **工作流**：先讨论 → 计划 → 改 → 验收；禁止一次性大重构；Claude/Codex 分工（UI 交 codex，见 §1.6 + preset-onboard-codex）。
- 若拿不准方向，多看 `docs/reference-phone-architecture.md`（教材级参考的架构提炼）。

---

## 1.7 给明天（2026-08-04 下班后）新会话的接手说明

**用户今晚（08-03 深夜→08-04 凌晨）拍板与改动：**
1. **预设三个核心逻辑产物已写完**：`preset-content.js`（字典）`user-preset-store.js`（柜子）`preset-assemble.js`（翻译机）`preset-validate.js`（门卫）+ 4 个测试，**全绿**（34/23/19/21）。详见上表「08-03→08-04 会话」。这批**纯逻辑、不带 UI**。
2. **用户明确允许研究成熟小手机项目的装配骨架**：对其规则装配与运行时边界做了只读研究，得到「按 enabled 过滤 → 编号 → 前缀+正文+系统尾**置末不可覆盖**」「每对话绑定 preset + 丢失回退不崩」「空预设返回 null」「校验只拦截必要错误」等中性结论。**只借机械骨架，套 Mercury 自研玩法内容结构；不搬来源命名、角色或剧情**。临时源码副本不进入仓库，只保留脱敏结论。
3. **冲突温和处理（用户定案）**：「互斥冲突 → 弹窗点名哪几条撞了 → 用户可『不更改继续 / 更改』」。「继续」后打 `acceptedConflicts` 标记，**下次不再弹**。弹窗内直接改暂不实现（难度/易 bug），先提示版，留 codex 增强。

**下一步 default 接手顺序：**
1. 先跑新测试确认绿 + 原有 4 个测试无回归（`node app/tests/preset-content.test.js` 等 + notification/chat-contracts/mercury-chat-app/archive）。
2. **待用户确认的两点**（写代码时我留的决策缺口，别擅自定）：
   - **`pref.*` 占位符字段名**：合同档没定义存哪，我暂用 `preset.preferences`（翻译机从 `preset.preferences` 或 `preset.modules.values` 取），**等用户或代码x拍板正式字段**。
   - **校验风格**：validate 用返回 `{ok, errors, warnings}`（宽松，生成器可读 warning），**未走** chat-contracts 的 throw 风格——已向用户交代，等确认。
3. **接下来给 codex 的缝**（04 号 codex 若复工则照 `preset-control-v1 §6` 做瀑布卡片 UI）：`buildRuntimeInput()`（mercury-chat-app.js:456）接 `userPreset` 槽 + `DEFAULT_CONVERSATION_SETTINGS` 加 `userPresetId`（preset-onboard §5）；UI 用 `store.get(id)` / `assemblePresetInstructions` / `validateUserPreset`。
4. 之后推进：聊天闭环核心链路（角色卡/世界书导入→喂编译）> 沉浸感小功能 > 全局美化。<用户优先级>

**重要约束（勿忘）：**
- **红线**：写预设/世界书/角色卡入库前过 `reference-sources/banlist.md` 词表查重**零命中**；公开前整删 reference-sources（含 banlist.md）+ 源码文档 grep 专有名词零命中 + 确认 `.gitignore` 首行在。本次 4 个新文件已 grep 零命中。
- **边界**：自研内核 + 边界翻译，不直接存酒馆 schema；不碰活人感（防油腻纪律在核心 core-v0.3，预设只带玩法）。
- **文本引号**：预设中文文本内嵌引号用 Unicode 中文引号 `“”`，忌用 ASCII `"`（SyntaxError，本会话踩过）。

---

## 1.8 给明天（2026-08-05 下班后）新会话的接手说明

**08-04 傍晚会话（用户拍板「先写吧」）：**
1. **预设已「装车」**：`userPreset` 槽接进 `buildRuntimeInput()`，聊天现在**默认就带玩法层**（preset-default 骨架 + 关系尊重卡 + 平衡戏剧 + 标准主动性 编译进系统提示）。详见上表「08-04 傍晚会话」。
2. **两点决策用户已定**：①`pref.*` 占位符字段名 → **顶层 `preset.preferences`**（assemble 已 `preferences || modules.values` 双通道，store 已保留往返）；②校验风格 → **保留宽松 `{ok,errors,warnings}`**（validate 是给 UI/门卫的，与 compile 前 throw 的 chat-contracts 职责不同，不强套一种风格）。
3. **Codex 未复工**（用户说恢复还得等）；用户给了备路：**「若情况坏到一定地步，会接一个带视觉的 API 做前端」**——即 codex 的 UI 活可能由用户接视觉 API 顶替，未必等 codex。

**下一步 default 接手顺序：**
1. 先跑新测试确认绿 + 原有无回归（同 §1.7 第 1 条命令）。
2. **UI 缺口**（当前最明显）：现在每个对话**默认绑 preset-default**，但没有 UI 能「选其他预设 / 填 pref.* 偏好」——用户切到「恋人开局」「舒缓节奏」只能靠改 `settings.userPresetId` 或 codex 做瀑布卡片。此活原本交 codex（`preset-control-v1 §6`），现等 codex 或用户接视觉 API。
3. `pref.*` 字段名注释**已落地**（08-04 晚：`preset-content.js` PREF_PLACEHOLDERS 注释改为 `preset.preferences`，代码本就走此路径，无行为变化）。
4. 之后推进：聊天闭环核心链路（角色卡/世界书导入→喂编译）> 沉浸感小功能 > 全局美化。<用户优先级>

**重要约束（勿忘）：**
- **红线**：写预设/世界书/角色卡入库前过 `reference-sources/banlist.md` 词表查重**零命中**；公开前整删 reference-sources（含 banlist.md）+ 源码文档 grep 专有名词零命中 + 确认 `.gitignore` 首行在。本会话新增文件未动参考作品专有内容。
- **边界**：自研内核 + 边界翻译，不直接存酒馆 schema；不碰活人感（防油腻纪律在核心 core-v0.3，预设只带玩法）。
- **文本引号**：预设中文文本内嵌引号用 Unicode 中文引号 `“”`，忌用 ASCII `"`（SyntaxError）。

---

## 1.9 给明天（2026-08-06 下班后）新会话的接手说明

> 08-06 会话：预设「瀑布卡片」编辑器 UI（临时版）落地。核心逻辑此前已全绿，本会话补齐了「选其他预设 / 填 pref.* 偏好」的无 UI 缺口。

**用户拍板（清晰）**：预设 UI「纯 UI 先做（临时版）」——不等 codex/视觉 API，先把瀑布卡片选择器 + 编辑器做出来可立即用；样式是盲做，将来视觉路径/codex 回来可能重做这块。前提确认：预设**文案工作早已完成**（`preset-content.js` 全量生成文本 + `preset-control-v1.md §3` 权威文本），本 UI 不涉任何参考素材、无红线暴露。

**改动（全绿，无回归）：**
| 文件 | 现状 |
|---|---|
| `app/apps/mercury-chat-app.js` | `paint()` views map 加 `presetList`/`presetEditor` 两条路由（L152）。`conversationSettingsView()` 最上方加独立「玩法」组 + 行「玩法预设」入口（`presetEntryRow()`，与 表现/上下文 组分开，§6.4 呈现层分离）。新增一整套方法：`presetLayerReady/presetContent/presetDisplayNameById/presetListView/presetSummary/moduleLabel/openPresetEditor/newPresetEditor/presetEditorView/buildPresetCards/renderCard/renderGroupCard/renderSkeletonCard/renderFreeTextCard/renderUnknownCard/renderCustomCard/renderPreviewCard/presetLivePreviewText/bindPresetToConversation/savePresetDraftAsNew/savePresetDraft/#commitPresetDraft`。核心：draft 深拷贝（`DEFAULT_PRESET`/store.get/list 都返回 frozen，原地点改会炸）、组卡互斥单选、骨架只读标必开、free-text pref 输入框、live 预览（`assemblePresetInstructions`）、两种保存 id 策略（asNew 铸新 id 不 clobber / 同 id upsert）、启用绑定独立于 draft（`bindPresetToConversation` 写 `experienceFor().settings.userPresetId`）。组内切换会把 `order` 里的旧候选**原位替换**为新选中（否则装配输出不反映当前选择）。保存后停留新预设编辑器，**不静默改绑当前对话**。 |
| `app/styles/mercury-chat-app.css` | 末尾追加 `/* 玩法预设（瀑布卡片，临时版）*/` 块，~20 条 `mercury-chat-preset-*` 规则，复用 `--color-cyan/--chat-surface/--chat-border/--chat-muted/--chat-text` token，随 `.mercury-chat-settings__group` 玻璃质感。 |
| `app/tests/preset-ui.test.js` | **新建（自计数）**：40 断言。FakeElement + `let n` 自计数（末尾 `preset-ui: ${n} assertions passed`，避免手写字面量漂移）。覆盖：入口行→presetList；列表按 `store.list()` 渲 2 个 pick + 启用绑定 userPresetId 且写存储；编辑器按 order 渲 7 模块卡 + 自定义 + 预览（共 9 卡）；组卡单选恰好一个 + 切换后唯一 true + order 原位替换；骨架只读无控件 + 必开 pill；free-text 填称呼回写 draft.preferences + 预览含陌生/阿彩/黄昏；保存为新预设入库 + 来源未 clobber + 不改绑定 + 停留新编辑器。 |

**踩到的点（写者必看）：**
- `simplePage` 返回 `page > [header, body]`，测试在 `root.children[0].children[1]` 断言 body。
- FakeElement 的 `append(...nodes)` 不摊平数组——`body.append(this.buildPresetCards(draft))`（返回数组）会被当成**单个节点**塞进去，必须 `body.append(...this.buildPresetCards(draft))`。真实 DOM 同样要求摊平（传数组会抛错），所以这是真 bug 不是测试局限。
- 组卡切换只改 `enabled` 不够：`assemblePresetInstructions` 按 `order` 迭代，非 order 内模块不生成。切换必须同步把新候选**写进 `order`（旧候选原位）**，否则预览/编译输出不含新选。
- 「保存为新预设」用 `store.add`（同 id 会 upsert 覆盖），所以必须铸新 id（`preset-<slug>-<ts>`），且**不**顺带改绑当前对话（启用是列表独立动作，避免「存个副本结果聊天忽然切过去了」怪）。

**下一步 default 接手顺序：**
1. 跑 `node app/tests/preset-ui.test.js` + 原全部 preset/chat 测试确认绿（本会话已 34/26/19/21/54/40 + preset-wiring 全绿）。
2. 本 UI 为**临时版**，从简：未做拖拽排序 / 导入导出 / 互斥冲突弹窗（acceptedConflicts 交互流）——这些留视觉路径/codex 重做。若视觉 API 回来，这部分会被替换，别在其上堆积。
3. 之后优先：聊天闭环核心链路（角色卡/世界书导入→喂编译）> 沉浸感小功能 > 全局美化。<用户优先级>

**重要约束（勿忘）：**
- **红线**：本会话新增文件已过 banlist 零命中（grep 验证）。公开前仍照 §0：删 reference-sources + grep 零命中 + 确认 .gitignore。
- **边界**：预设 UI 只调玩法层，绝不动呈现层（`appearance.*`）；不碰活人感（防油腻在核心 core-v0.3）。
- **文本引号**：预设中文文本内嵌引号用 Unicode 中文引号 `“”`，忌 ASCII `"`（SyntaxError）。

---

## 2. 「对标酒馆」这个大方向的现状与未决

> 用户在 08-02 会话反复确认：开发希望**对标 SillyTavern** 作为成熟目标，解决「东做一点西做一点自己脑补」的问题。以下按概念逐项记真实状态，**不含任何我给的✓**。

| 概念 | 真实状态 |
|---|---|
| 角色卡 | 只做了「读两个 tavern 样例 → 结构判断 + 加形状识别函数」。**没有把任何酒馆格式写进数据、没有改 schema。** |
| 预设 | 编译槽已预留（`chat-contracts.js compileRuntime().userPreset`），但无 UI、无数据。`dev-targets.md 目标B` 标注「暂缓」，并警告**格式陷阱**：预设是玩法层，不能塞进现存 `DEFAULT_SETTINGS`（呈现层）。 |
| 世界书 | Archive 已建 `WorldProfile` 模型 + 生效条目 + `worldBindings`，但 `requestAssistant` 现在**不**把 Archive 数据喂给编译（`dev-targets.md 目标C` 的接线缝未合）。 |
| 美化 / 主题 | 用户传了两个**酒馆主题文件**到仓库根目录：`Titania_复古色系主题美化_0321_1.0.3.json`、`寰宇独奏v1.5.json`。两者都是 SillyTavern 主题预设（JSON 壳 + `custom_css` + `:root` 变量块），**无角色/剧情内容**。已读完，**未应用**。 |

### 未决问题（待用户拍板，别替他定）

1. ~「对标酒馆」的落点~ → **已拍板**（08-02）：做完整的 **Mercury 四件套（角色卡/预设/世界书/美化）对标成熟环节的开发蓝图**，见 `docs/four-piece-blueprint.md`。✓
2. **换肤基建**：已并入美化件，蓝图定为阶段一（`tokens.css` → `[data-theme]` 作用域 + 运行时切换，把仓库两份主题转成自研 `--color-*/--radius-*` 主题）。**尚未动手**，等排序第 3 步。
3. **共用边界**：蓝图确认 —— 角色卡与美化**可借格式框架**（导入/导出边缘转译，内部内核自研，不落专有内容）；预设与世界书**按语义对标、独立实现**（不读原文件 `preset.json`、不兼容其插件生态）。已写入蓝图附则，实现时才逐件兑现。
4. **阅后即焚红线**：用户明确要求——任何参考作品只借结构/框架，**绝不复现名字、剧情、角色、专有名词**（「你不希望我身败名裂吧」）。已存记忆 `feedback_reference-fire-and-forget.md`，后续每件实现都要自查。

### 已在交流中发生的判断（备忘，非已实现）
- 用户明确**反对**「把酒馆格式直接塞进内部存储」；倾向「边界翻译」（导入/导出边缘转译，内部数据内核保持自研）。
- 用户明确**反对**「按描述词生成配色」（记忆 `design_principles.md`）；要求只做「引用」不做「设计」。
- 用户对角色主页：**不要**把整段人设糊在主页，用 hero + 卡片栏（聊天/人设/背景美化入口）。这已在之前的计划里体现。

---

## 3. 记忆系统现状

`C:/Users/王/.claude/projects/D--candy-phone-prototype/memory/` 现有 6 份 + 索引：

- `MEMORY.md` — **新建的索引**，维护所有记忆的 one-line hook。
- `product_vision.md` — Candy Phone 产品方向（手机即产品体验，两柱平等 Home/Chat）
- `dev_workflow.md` — 开发流程（先讨论→写计划→改→启动→验收→下一阶段；禁止一次性重构；Claude 管代码、Gemini 管视觉、ChatGPT 管产品）
- `theme_system.md` — `--theme-*` CSS 变量体系（注意：描述的是更早的 index.html `:root` 体系，与当前 `tokens.css` 的 `--color-*`/`--radius-*` 是不同阶段，别混淆）
- `design_principles.md` — 视觉关键词（低饱和粉、通透、玻璃；杜绝暖黄/木色/深色赛博朋克）；只做引用不做设计
- `feedback_reference-fire-and-forget.md` — **NEW**：参考作品阅后即焚红线（长期）
- `project_benchmark-blueprint.md` — **NEW**：对标落点 = 四件套开发蓝图


---

## 4. 下一步建议（供新会话接手，非指示）

下一会话默认从「四件套蓝图」接手，第一件事读 `docs/four-piece-blueprint.md`。接手时可先：

1. 跑一次 `npm test`（package.json 在 `mercury-phone/` 与仓库根各有一份，注意路径）确认现有测试。
2. 读本文件 + `docs/dev-targets.md` + `docs/four-piece-blueprint.md` 对齐语义。
3. 按蓝图总排序（角色卡垂直切片 → 世界书接入 → 换肤基建 → 预设契约 → 两轴落码）挑**第一个具体要件**向用户确认再动手；**不要**一次性做多件、不要越界写代码。全程守阅后即焚红线。

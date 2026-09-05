# Generation Profile UI Checkpoint Handoff

更新日期：2026-08-20。

本文件是 Mercury Phone 的 Generation Profile 产品、UI 与代码专项交接。它记录的是当前仓库真实状态和用户最新确认的产品边界。若旧聊天、旧截图说明、早期 QA 记录或当前临时实现与本文件冲突，以用户最新确认的设计稿和本文件为准。

## 0. 当前结论

- **Generation Profile Checkpoint 1 已完成**：事实源、迁移、内置只读隔离与 Chat Runtime 接线已经收口。
- **Generation Profile UI Checkpoint 尚未全部完成**：UI-01 与 UI-02 的实现、自动/浏览器 QA 和用户视觉确认均已完成；UI-02 于 2026-08-19 正式通过。UI-03、UI-04 与 Playback 尚未开始。
- 当前 Record Cabinet 已按确认方向重做为 1:1 LP sleeve + 独立圆形唱片，并于 2026-08-18 获用户视觉确认，现作为后续 Archive UI 的已确认基线。
- Chat 消费入口已收口：不展示唱片、不重复资源管理，只保留当前会话摘要、单一 Profile 选择列表与 Archive 跳转。
- 当前已完成并确认 Cabinet / Detail workflow、overlay、cover draft 失败恢复和正式只读 Detail。下一候选阶段是 UI-03 Pressing Room，但没有新的明确指令不得开始；Profile Workbench、继承系统、Model Parameters、Playback 与其他 App 继续暂停。

## 1. 产品归属

Generation Profile 不是 Chat 专用 preset，而是 Mercury 的共享生成资产，归属 `Archive`。

Archive 的产品结构是：

```text
Archive
  ├─ Characters
  ├─ World Books
  └─ Generation Profiles
```

Chat、Diary、Moments、Offline、Cinema、Character Phone、Forum 等现在或未来的玩法只负责消费 Generation Profile，不拥有 Profile，也不能建立各自的顶层预设事实源。

## 2. 数据层：唯一事实源已经完成

系统服务实际持久化键：

```text
mercury.app.shared.generation-profiles.v1
```

契约与 Store 内使用的共享逻辑键为：

```text
generation-profiles.v1
```

两者描述的是同一份共享数据；前者包含 `MercurySystemServices` 的共享命名空间前缀。

旧来源：

```text
mercury.apps.chats.userPresets
archive.v1.promptModules
```

旧来源只作为一次性、幂等、只读迁移来源，不再是长期事实源，也不得继续写入。旧 prompt module 不应机械地一项变成一个 Profile：只有确实具有独立 Profile 身份的来源才生成独立 Profile；同源模块优先聚合为一个迁移 Profile 的 Instruction Blocks，混合或身份不清的模块进入兼容迁移 Profile。

相关实现：

- `app/core/generation-profile-contracts.js`
- `app/system/generation-profile-store.js`
- `app/apps/archive-app.js`
- `app/apps/mercury-chat-app.js`

## 3. Runtime：保持现有协议

已经确认：

- Chat 已读取共享 Generation Profile Store。
- `compileRuntime()` 没有被重写，输出协议没有变化。
- Generation Profile 最终仍通过既有 `userPreset` / preset runtime 槽进入当前运行时装配。
- Cover 是纯展示资产，永远不能进入 prompt。
- Instruction Blocks 中 `runtimeEligible: false` 的内容不能进入 prompt。
- 旧 Archive module 不再隐形全局注入。
- 迁移内容只有在对应迁移 Profile 被显式选择时才重新生效。
- 角色、世界书、事件记忆、聊天逻辑和 App contract 边界没有因 Generation Profile consolidation 被合并或删除。

任何未来 UI 都不能把“已保存”“已导入”误写成“已进入 runtime”。运行时是否生效必须能从选中绑定、`buildRuntimeInput()`、请求 trace 或测试中追到。

## 4. Built-in Profile 边界

- Built-in Profile 永久只读。
- 当前保留 ID 是 `preset-default`。
- Built-in 由代码内注册表提供，不进入用户持久化 `profiles` 数组。
- 用户不能用导入、保存或迁移覆盖保留 ID。
- 用户对 Built-in 只能 Use / Remix；需要修改时必须先产生新的可编辑 Profile。
- 不得为了匹配设计稿中的演示数量而虚构额外 Built-in Profile。

## 5. 已确认但尚未实现的产品边界

### 5.1 绑定与继承

最终目标：

```text
Global → Contact → Session
```

优先级：

```text
Session > Contact > Global
```

**当前尚未实现 Global / Contact / Session inheritance。** 当前只保留已有 session-level binding。UI 不得暗示全局默认、联系人覆盖或继承已经生效。

### 5.2 Model Parameters

最终允许 Generation Profile 拥有 provider-agnostic generation parameters，例如少量真正连续的生成参数。

以下内容始终属于 Settings，不属于 Profile：

- Provider
- Model
- API URL
- API Key

当前尚未实现高级 Model Parameters。

### 5.3 Advanced Instructions

普通模式未来编辑：

- structured playstyle
- preferences

Advanced 模式未来编辑：

- user instruction blocks

永远不可编辑：

- Character Core
- Character Facts
- World Facts
- Memory Facts
- Relationship Evidence
- Mercury Core Rules
- App Contracts
- output schema
- writeback rules

当前 Advanced 编辑 UI 尚未实现。

## 6. 当前 Record Cabinet 的真实代码状态

当前 `app/apps/archive-app.js` 已将 Archive 的预设入口切换为一个可运行的 Record Cabinet 页面，具备：

- MERCURY / MINE / IMPORTED 三个同页来源分区。
- 真实共享 Store 数据读取，不用假数据填满设计稿。
- 92 × 92 px 方形封套与独立 86 × 86 px 黑胶唱片层。
- 点击抽取过渡、`prefers-reduced-motion` 回退，以及长按 / context menu / Shift+F10 管理入口。
- Mine 与 Imported 各自保留专用方形 `制作新唱片` / `导入档案` 操作位。
- 内置 Profile 只读菜单与 Remix 边界。
- 用户 Profile 的查看、Remix、重命名、删除和封面管理入口。
- 自定义 Cover 的本地选择、预览、保存、更换和恢复默认。
- Cover 以 Data URL 持久化；当前实现会把选择的图片规范化为最大 768 px 的 WebP 展示数据，以降低本地存储压力。
- Cover 在 Runtime 测试中保持不可见。
- 页面使用真实手机滚动、状态栏、Home Indicator 与安全区。

当前代码还存在这些临时接缝：

- 顶部“新建”仍直接创建 Blank Profile 并进入正式只读详情，没有进入 Pressing Room。
- 正式详情已使用 `profile-detail` route；旧 `module-editor` 只保留为内部兼容渲染别名，不再显示旧表单。
- Pressing Room、Tracklist / Workbench、Playback 没有实现。
- Imported 为空时仍显示真实空集合，但保留调用既有资源识别流程的导入操作位；Pressing Room 尚未实现。

### 6.1 Chat 消费入口的真实代码状态

`app/apps/mercury-chat-app.js` 的公开 Profile 页面只服务当前会话：

- 顶部显示当前 Profile、来源与真实运行时状态。
- 下方只有一份“为当前会话选择”列表，不再重复“我的预设”、导入、导出或编辑管理区。
- 用户选择后继续写入既有 session `userPresetId` / `resourceBindings.presetId`，没有新增事实源或绑定层级。
- 唯一管理入口“在档案馆管理”直接打开 Archive 的 Generation Profiles 页面。
- Chat 不使用唱片和封套隐喻；该视觉只属于 Archive 资产管理空间。
- 外部档案存在未解析变量或兼容保留块时显示“部分接入”；只有无兼容缺口时才显示“已生效”。
- `inspectPresetInstructions()` 只读派生状态；安全兼容适配器会展开 outgoing assembled prompt 中可证明的纯文本变量，但不改写导入内容或共享 Store。

### 6.2 UI-02 workflow 与正式详情的真实代码状态

`app/use-cases/generation-profile-flow.js` 已作为无 DOM 的 use-case module 接到 Archive：

- 只允许 `cabinet` 与 `detail` 两个当前 checkpoint 合法 view；未知的未来事件会被拒绝。
- 管理 action sheet 与 cover preview overlay，不再让这些状态只存在于页面 controller 的零散字段中。
- Profile 不存在或内置只读时拒绝无效转换/写入，并保留最后一个合法状态。
- cover draft 只有确认后才进入现有 Generation Profile Store；存储写入失败时 preview 与 draft 保留，用户可重试。
- reload 时若选中的 Profile 已在别处删除，flow 会安全回到 Cabinet。
- 正式 Profile Detail 已实现并映射为 `profile-detail`：唱片 Hero、来源与运行状态、真实统计、Core Profile 摘要、最多六项 Tracklist 只读预览、Chat 引用、基础信息和既有 Actions 均来自当前 Store/运行时派生数据。
- 详情页没有 input、textarea、select、滑杆、模型参数或 Playback 控件；它是查看页，不是 Workbench。
- 自动测试和手机截图 QA 已通过，并于 2026-08-19 获用户视觉确认；UI-02 已完成。
- Pressing Room、Workbench、Playback、继承和 Model Parameters 没有进入该状态机。

## 7. 当前 UI 视觉状态：UI-01 已通过

前一版纵向卡片式视觉已被用户否决。本轮已完成 UI-01 重做，并通过自动测试、真实手机浏览器检查、参考图对照 QA 与 2026-08-18 用户视觉确认。UI-02 正式详情也已完成自动与手机截图 QA，并于 2026-08-19 获用户视觉确认。整个 Generation Profile UI Checkpoint 仍未完成，Pressing Room、Workbench 与 Playback 也尚未实现。

本轮实现已修正：

- 封套改为确认的 1:1 LP sleeve。
- 唱片改为独立圆形 PNG 图层并收纳在封套后方。
- 移除 Cover 右上角悬浮 `...`，改用长按与键盘 context menu。
- 每个来源仍是连续唱片柜书架，不回退为普通 CRUD Card Grid。
- Cover 不再强制套冷蓝滤镜，便于未来主题与用户美化解耦。

UI-01 点击后现在进入已确认的正式只读 Profile Detail，不再进入临时编辑表单。下一候选产品动作是 UI-03 Pressing Room；只有收到新的明确指令才可开始，Workbench 继续等待 UI-03 完成与确认。

## 8. 已明确作废、不得恢复的 UI 方向

### 8.1 普通 Card Grid

不采用“圆角卡片 + 图片 + 右上角省略号”的普通 AI / SaaS 卡片墙。

### 8.2 纵向长条 Cover

Generation Profile 的封套主视觉已确定为 **1:1 方形**，对应经典 LP sleeve。

### 8.3 Card + 半圆唱片装饰

正确结构是：

```text
Square Sleeve / Cover
+
Independent Circular Record
```

唱片与封套需要形成真实的收纳、抽取和层级关系，不能只在普通 Card 右边追加一张黑色圆盘图片。

### 8.4 Cover 上的悬浮省略号

当前 Cover 右上角的 `...` 已经否决。操作可在 Detail、context menu、长按或下一版明确的交互中解决，但不得直接恢复普通 CRUD card menu。

### 8.5 审核语义

Generation Profile 是用户自己的本地私人资产。禁止使用：

- 审核
- 审核中
- 等待审核
- 提交审核
- 审核通过

导入技术状态应使用：已导入、已转换、可用、部分内容未启用、兼容性信息。

### 8.6 Slider-first UI

Expression、Initiative、Drama、Relationship Pace 等玩法维度不应全部变成 0–100 slider。优先使用离散选项、文字选项、少量结构化选择和 Preferences；只有真正连续的模型参数才使用参数控件。

### 8.7 普通表单式 Remix

不得继续使用“提示条 + 名称输入框 + 说明 textarea + 两个按钮”作为 Profile Detail、Remix 或 Pressing Room 的主界面。

## 9. 已确认的视觉隐喻

```text
Generation Profile       → 一张唱片 / 唱片封套
Profile Library          → 唱片柜
Profile Detail           → 取出一张唱片
Blank / Remix / Import   → Pressing Room
Profile components       → Tracklist
App usage                → Playback
User cover               → Custom Sleeve
```

唱片只是 Archive asset metaphor，不能把整个界面做成音乐播放器。禁止 EQ、音量旋钮、时间轴、Neon music UI、DJ console、大量播放控件和复古酒吧风。

## 10. Archive 设计基准

当前 Archive 的 World Book UI 已被用户认可，是下一版 Generation Profile 的设计基准。它已经形成：

- Shelf / Book metaphor
- Hero asset
- 大标题
- 数据统计
- Index
- Linked information
- Runtime / Updated information
- 水银玻璃 / 冷蓝 / editorial typography

Profile Detail 应与 World Book Detail 属于同一套 Archive design system，不能另造一套后台或音乐应用语言。重做前先阅读 `renderWorldBook*` 相关实现与 `archive-app.css` 中的 World Book 样式。

## 11. 下一阶段页面优先级

### UI-01：Record Cabinet / 唱片柜

**状态：已完成并于 2026-08-18 通过用户视觉确认。** 当前已确认：

- 1:1 sleeve
- independent circular record
- shelf / cabinet structure
- MERCURY / MINE / IMPORTED 来源层次
- currently used 状态
- user-created / imported Profile
- cover customization

### UI-02：Profile Detail / 唱片详情

参考 World Book Detail。当前已确认的信息结构：

- Hero Cover / Record
- Name / Source / Status
- Short description
- Stats
- Core Profile summary
- Tracklist
- Affected apps（当前只展示真实 Chat 引用，不实现 Playback）
- Base information
- Actions

当前布局已经完成：旧 `module-editor` 表单被移除，详情只读显示真实派生数据，并于 2026-08-19 获用户视觉确认。未来若无新的用户方向，应保持这一基线。

### UI-03：Pressing Room

Blank / Remix / Import 的入口，不是普通 form。UI-01 与 UI-02 的前置确认均已满足，但仍须收到新的明确开始指令后再设计与实现。

### UI-04：Tracklist / Profile Workbench

高频大型编辑页面，尚未开始最终设计。不得提前实现。

## 12. Cover 资产边界

用户可以上传自定义 Profile Cover、更换 Cover、恢复默认 Cover。Cover 是纯展示资产：

- 不能进入 prompt。
- 应复用 Mercury 已有本地图片 / Data URL 持久化能力。
- 用户 Cover 流程不能依赖图片生成服务。
- 不得把参考项目的 Cover、UI 资产或私有图片复制进产品。

## 13. 手机复刻原则

- 每个页面保持真实手机竖屏 viewport。
- 保留顶部状态栏与底部 Home Indicator。
- 使用现有手机安全边距和 Mercury Archive tokens。
- 不把手机页面拉成长条网页。
- 不把横向设计板比例误认为手机页面比例。
- 设计稿周围的页码、标注、说明框和引导线不是产品 UI。
- 先复刻空间关系，再用现有 Mercury tokens 实现；不要为了单张截图写死大量页面级绝对定位。
- UI 内只使用简短、稳定、不会制造错误承诺的文案。

## 14. 测试与 Checkpoint 状态

Checkpoint 1 完成时的记录基线：

```text
npm test
46 files
1316 assertions
0 failures
0 skipped
```

UI-01、Chat 紧凑选择器和安全兼容适配完成时的结果是：

```text
npm test
48 files
1398 assertions
0 failures
0 skipped
```

API provider 修复完成后的当前最新结果是：

```text
npm test
49 files
1429 assertions
0 failures
0 skipped
```

UI-02 workflow foundation 接入后的历史结果是：

```text
npm test
50 files
1460 assertions
0 failures
0 skipped
```

UI-02 正式详情接入后的当前最新结果是：

```text
npm test
50 files
1471 assertions
0 failures
0 skipped
```

2026-08-20 随后的非 UI 架构收紧新增 Conversation Store、生命周期合同、Release Module、Chat Generation Workflow（含 Connection Readiness）、Local Data Vault、Resource Intake Workflow、Chat Conversation Transfer、角色导入连续性、完整聊天纵向 round-trip 矩阵、首个 Archive lazy slice、角色/世界/Profile/事件的真实请求准入矩阵，以及 API-01 AITransport Interface 收口；工作区最新全量结果为 `64 files / 1974 assertions / 0 failures / 0 skipped`，生产审计通过。真实角色/世界/Profile 的导入、会话绑定、刷新、portable 聊天回导与 Chat→Archive 首次深链继续有效；本轮浏览器另确认 Chat、Runtime Verification 会话与资源页，0 console warnings/errors。上述 UI-02 截图与视觉确认基线没有改变。

手机截图检查：132 × 132 方形封套、独立唱片、3 项真实统计、5 项内置运行 Track、0 个编辑字段、0 个 Playback 控件。顶部与滚动底部截图均已检查。

因此：

- **Checkpoint 1 已完成，可由新 agent 直接依赖。**
- **Chat Profile 消费入口已完成实现与真实手机 QA。**
- **UI Checkpoint 尚未全部完成；UI-01 与 UI-02 均已完成实现、QA 与用户视觉确认。UI-03、UI-04 与 Playback 尚未开始。**

## 15. 下一位 coding agent 的接手顺序

1. 阅读本文件，以及 `README_AI.md`、`PROJECT_STATE.md`、`AI_HANDOFF.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`NEXT_STEPS.md`。
2. 不要恢复 Chat 内的第二套预设管理器；外部预设已有显式、安全、fixture 驱动的识别与变量适配层，继续工作不得加入文件名或单一样例特判。
3. 查看 `design-qa.md` 与 `artifacts/record-cabinet-ui01-comparison.png`，将已通过的 UI-01 和刻意差异作为视觉基线。
4. UI-02 Profile Detail 已于 2026-08-19 获用户视觉确认；下一候选产品阶段是 UI-03 Pressing Room，但只有收到新的明确指令才可开始。
5. Pressing Room 继续排在 Workbench 之前；不得在同一阶段顺带启动 Workbench 或 Playback。

不要自行扩展产品，不要越级开始 Pressing Room、Workbench、Global / Contact / Session inheritance、Model Parameters、Playback 或其他 App。

## 16. 当前工作区与文件地图

当前目录未检测到 `.git` 元数据，因此不能从仓库内生成可靠的 staged / unstaged 或基于提交的 diff。接手者应把以下文件视为当前 Checkpoint 的主要工作面：

Checkpoint 1 数据与 Runtime：

- `app/core/generation-profile-contracts.js`
- `app/system/generation-profile-store.js`
- `app/core/preset-assemble.js`
- `app/apps/mercury-chat-app.js`
- `app/tests/generation-profile-store.test.js`
- `app/tests/generation-profile-runtime.test.js`

当前 UI-01 已确认基线：

- `app/apps/archive-app.js`
- `app/styles/archive-app.css`
- `app/tests/archive-app.test.js`
- `app/tests/archive-css-structure.test.js`
- `app/assets/archive/archive-vinyl-disc-v1.png`

Chat 消费入口与兼容诊断：

- `app/apps/mercury-chat-app.js`
- `app/core/preset-assemble.js`
- `app/core/preset-compatibility.js`
- `app/styles/mercury-chat-app.css`
- `app/styles/mercury-chat-refresh.css`
- `app/tests/preset-ui.test.js`
- `app/tests/preset-assemble.test.js`
- `app/tests/preset-compatibility.test.js`
- `app/tests/external-preset-compat-runtime.test.js`

当前 QA / 截图材料：

- `design-qa.md`
- `artifacts/record-cabinet-ui01.png`
- `artifacts/record-cabinet-ui01-stage.png`
- `artifacts/record-cabinet-ui01-comparison.png`
- `design-prototypes/social-shell/generation-profile-detail/formal-capture.png`
- `design-prototypes/social-shell/generation-profile-detail/bottom.png`

本轮在既有 Store 与 session binding 边界内收口了 Chat 消费入口，并新增只读兼容诊断；`compileRuntime()` 输出协议、角色、世界书、记忆和 Chat Runtime 边界未改。

## 给未来 coding agent 的第一句话

“你现在接手的是 Mercury Generation Profile UI，而不是重新设计 Mercury 预设系统。数据源、迁移、runtime consolidation 与 Chat 紧凑消费入口已经完成；外部预设仍只是部分兼容。UI-01 Record Cabinet 与 UI-02 Profile Detail 已完成实现、QA 和用户视觉确认。下一候选阶段是 UI-03 Pressing Room，但只有收到新的明确指令才可开始；Workbench 不得越级启动。”

# Mercury Phone 产品讨论临时审查

> 状态：临时 review，等待用户确认；不是正式产品决定，不应被当作 `DECISIONS.md`、`NEXT_STEPS.md` 或实现指令。
>
> 日期：2026-08-18
>
> 范围：审查今天提供的产品讨论，并纳入用户随后给出的 Chat / Offline Encounter / Cinema 边界纠正。本文件没有批准任何实现，也没有修改现有正式文档、代码、测试或配置。

## 0. 边界纠正（取代上一版中的歧义）

上一版 review 正确判断了 Cinema 是独立 App，但没有充分区分“主世界线下相遇”和“Cinema 场景”，并在关系 / 记忆写回问题上留下了可能把两者都理解成 Cinema 的歧义。该解释现已被用户明确纠正并取代。

**修正后的原则：Chat 覆盖角色的正常生活与关系，包括线上聊天和线下相遇；Cinema 只用于平行世界、AU 或剧本式体验，并拥有隔离状态。**

```text
Primary World / Chat scope
  └─ Contact + Relationship + Primary Timeline
       ├─ Online Chat
       └─ Offline Encounter（临时离开短信界面，但没有离开主世界关系）

Cinema scope
  └─ Stage + Character Variant + Player Role + Scenario
       └─ CinemaInstance + isolated StoryState
```

因此：

- 普通邀约、吃饭、散步、购物、旅行、约会等线下相遇属于 Chat 的主世界联系 / 关系 / 时间线。
- 主世界线下相遇结束后回到 Chat，不是跨 App 或跨世界“写回”；它本来就在同一事实域中。
- Cinema 不拥有通用 Scene 概念；它只拥有 AU / alternate-world / scripted scenario 的实例状态。
- 普通世界不是默认 Stage；普通 Chat 不应被改造成 Cinema。
- Cinema 的状态不得自动进入主世界关系、主世界记忆或原始 Character Core。

## 1. 审查结论

### 1.1 Cinema 能否在 Chat 收口后成为另一个完整玩法软件

**可以，方向成立，但应被定义为 Mercury Phone 内的独立 App / 独立资源域，而不是 Chat 的 `mode = theater`，也不是覆盖整部手机的上层框架。**

当前正式架构已经为这个结论留下了清楚边界：

- Mercury 的系统壳和 App Engine 是产品上层；深入玩法应作为独立应用接入，而不是继续堆进 Chat。见 [overall-implementation-outline.md](mercury-phone/docs/overall-implementation-outline.md) 与 [architecture.md](mercury-phone/docs/architecture.md)。
- Generation Profile 已明确是 Archive 的共享资产，Cinema 与 Chat 都只能消费，不能各自建立顶层预设事实源。见 [PROJECT_STATE.md](mercury-phone/docs/PROJECT_STATE.md) 与 [GENERATION_PROFILE_UI_HANDOFF.md](mercury-phone/docs/GENERATION_PROFILE_UI_HANDOFF.md)。
- `cinema-au` / `parallel-world-script` 已被代码和正式 World Book 文档明确排除在普通 WorldBook 之外，等待独立资源域。见 [worldbook-v1.3-handoff-2026-08-12.md](mercury-phone/docs/worldbook-v1.3-handoff-2026-08-12.md)。

讨论提出的 `Stage + Character Variant + Player Role + Scenario` 足以形成一个有独立价值的产品方向，但目前仍是**产品蓝图**，不是可直接开工的规格。Cinema 与主世界状态隔离已经明确；仍缺少的关键决定包括 Cinema 实例身份、角色 AU 覆盖边界、输出合同、退出 / 恢复行为和最小验收。

建议的首个完整闭环应压缩为：

```text
选择一个手工制作的 Stage
→ 绑定 Character / Character Variant
→ 创建 Player Role
→ 选择 Scenario
→ 创建独立 CinemaInstance
→ 进行纯文字互动
→ 受控更新 StoryState
→ 保存 / 退出 / 恢复
```

地图、主动通知、TXT 导入、RAG、知识图谱都不是这个闭环成立的前提。普通邀约和日历属于主世界 Chat / Offline Encounter 产品链路，而不是 Cinema 前置能力。

### 1.2 讨论中的技术能否用于全局预设、世界书和角色卡

**能复用的是能力与基础设施，不是把三类资产合并成一个 schema 或一个 Store。**

- Generation Profile 继续只表达“用户想怎么玩 / 如何生成”，不能承载世界事实、角色动态状态或剧情存档。
- WorldBook 继续承载有 scope、visibility、触发和预算的知识条目；它可以使用分块、来源追踪与未来的独立语义检索，但不能被塞进现有事件记忆索引。
- Role Card 继续承载稳定角色核心；主世界动态状态属于联系人 / 主时间线，Cinema 动态状态属于隔离的 CinemaInstance / Cinema timeline，二者都不得回写角色卡本体。
- Structured Output、来源追踪、预算、trace、状态变更提案、校验器可以成为共享能力；任何脚本执行、任意 tool call 或模型直接改状态都不符合当前安全边界。

一句话概括：**共享 Runtime 能力，保留资源权威边界；共享检索框架，隔离事实源和索引；共享角色资产，不共享动态实例状态。**

### 1.3 是否应在当前立即实现

**不应。** 当前正式任务图仍要求先完成 Generation Profile 当前 checkpoint、扩大装配后的输出回归、四类资源运行时验收、世界变体 / 时间线身份问题与生产边界。`NEXT_STEPS.md` 也明确不建议此时启动新大型 App。

另外，“Chat 已结束”目前还不能直接成立：

- Chat 的用户发起式文本闭环、资源装配、事件记忆和通知展示已经存在。
- 当前“场景库”位于 Chat 内，只是给一个新时间线绑定静态 `sceneContext` 文本。它可以成为主世界 Offline Encounter 的相邻基础，但还不是具有邀请、进入 / 退出、地点、事件、状态和结果的 Encounter Engine。
- 当前通知能显示系统请求和用户发起请求的迟到回复，但没有主动消息调度器、后台生成、离线队列或闭 App 后运行能力。
- 默认 API Key 只存在当前标签页会话；关闭标签页后清除。按当前浏览器本地架构，真正的离线主动消息没有可靠执行与凭据基础。

因此开始 Cinema 前，需要先由用户定义“Chat v1 收口”是否包含真正的主动消息；不能把现有通知管道误称为主动消息已完成。

## 2. 与当前架构逐项对照

| 讨论项 | 当前 Mercury 事实 | 分类 | 审查判断 |
| --- | --- | --- | --- |
| Virtual Phone 是上层，Cinema 只是一个 App | 系统壳、App Engine 与独立应用边界已存在 | 已有决定的补充 | 方向正确；“虚拟手机”并非今天讨论才出现，但本次明确纠正了 Cinema 权重过高的问题。 |
| Cinema 消费全局角色、世界书、Generation Profile | Generation Profile 已明确供 Chat、Cinema 等消费者共享；角色与世界也是 Archive 资产 | 已有决定 | 保留；消费不等于 Cinema 可以修改这些资产。 |
| Cinema AU 是独立资源域 | 普通 WorldBook 导入已显式排除 `cinema-au` / `parallel-world-script` | 已有决定 | 必须保持。Stage 可以引用 WorldBook，但 Stage 不能被伪装成普通 WorldBook。 |
| 模块化 Context Builder | Chat 已有 `buildRuntimeInput()`、`compileRuntime()`、worldbook resolver、事件召回和 trace | 已有决定的补充 | 不要重写一套。第二个消费者出现时再提取可共享的纯装配层；当前函数仍在 Chat controller 内。 |
| 一个 Conversation 加 `mode = chat / scene / theater` | Chat 与主世界 Offline Encounter 属于同一联系人 / 主时间线；Cinema 是独立资源域 | 部分可用、部分冲突 | `chat / offline-encounter` 可以在同一主世界 scope 下关联；`theater` 不能塞进同一 Conversation。Cinema 应有独立 `CinemaInstance` / turn contract。 |
| Character Core + Character State | Role Card / RuntimeProfile 已承载稳定角色核心；联系人实例和关系 scope 已分离，但没有完整 CharacterState | 补充 + 新想法 | 拆分原则正确；State 必须属于实例域，不能新增回角色卡。第一版不应先做一个可被模型任意改写的大状态对象。 |
| 同一 Character 在多个 Stage 中变成完全不同职业 / 身份 | 当前 Core 规定角色身份、历史、价值与能力由角色档案主导；世界变体存在，但深度 AU 覆盖未定义 | 需要价值判断；潜在冲突 | 轻量情境角色可做显式 overlay；如果身份、历史、能力都改变，应是版本化 Character Variant，而不是 Scenario 静默覆盖核心。 |
| 多维 Relationship（trust / affection / tension 等） | 当前有手动 `relationshipState`、关系证据记录和 durable event；不自动推进关系 | 真正新想法 | 值得未来设计，但不能让模型直接增减数值。先定义证据、裁决、可见性和回滚，再决定是否需要数值。 |
| 模型输出 relationship event，由程序落库 | 当前模型候选必须进入 pending，由用户确认；durable 与 confirmed 也是两个决定 | 与现有边界冲突，需改写 | “程序落库”仍不够安全。应为“模型提出 → schema 校验 → 用户确认 / 确定性规则裁决 → 写入”。 |
| 邀约 → Calendar → Offline Encounter → 返回 Chat | 当前没有 Invitation、CalendarEvent 或 Encounter Engine | 真正新产品想法 | 明确属于主世界 Chat。它在同一联系人 / 关系 / 主时间线内推进，不经过 Cinema，也不存在跨域写回。 |
| Function Calling / Tool Calling 改手机状态 | 当前外部预设脚本、状态命令和未知宏明确不执行 | 潜在冲突 | 只能做 allowlist action proposal；模型不能获得任意 Store、通知、关系、记忆或世界写权限。 |
| 程序管事实，LLM 管表达 | 事件记忆、世界书检索、导入预检、安全 preset adapter 已体现该原则 | 已有决定的补充 | 这是本次讨论最值得保留的跨域原则，但要继续落实为 schema、validator、trace 和 writeback gate。 |
| 两类 Scene / Scenario | 当前只有 Chat 静态 sceneContext；Cinema 尚不存在 | 必须明确区分 | 主世界 Offline Encounter 属于 Chat；Cinema Scenario 属于 Cinema。可以共享 turn / validation 能力，但不能共享状态所有权。 |
| 主世界相遇结束后更新 Memory / Relationship | 当前只允许用户确认的 scene conclusion / relationship record 成为长期事件 | 已有边界的补充 | 不属于跨域写回；结果就在同一主世界 scope。session outcome 可直接留在该时间线，durable memory 仍按当前规则由用户确认。 |
| Cinema 结果进入主世界 | 当前没有 Cinema；现有事件记忆有严格 scope | 已明确禁止自动发生 | Cinema 结果保持在 CinemaInstance。未来若设计跨宇宙引用，必须是新的显式产品机制，不能沿用普通相遇的自然记忆更新。 |
| Graph Map、双箭头、路线和节点 Hook | 无对应正式能力 | 真正新想法；延期 | 产品辨识度高，但属于任一 Scene / Scenario 闭环之后的空间表现层。 |
| Notification 是全局基础设施 | 系统已有共享 NotificationStore、App notify bridge、sender/conversation 元数据 | 已有决定 | 可复用；但现有能力只是通知存储与展示，不含调度或主动生成。 |
| 主动消息 / 世界主动找用户 | 没有 scheduler、离线队列、后台凭据或关闭页面后的运行时 | 真正新想法；延期 | 先决定 foreground-on-open、定时本地提醒、还是服务端后台消息。三者成本和隐私边界完全不同。 |
| Stage + Player Role + Scenario + Story State | 尚无正式合同或 Store | 真正新产品想法 | 这是 Cinema 的合理核心，不属于 Role Card、WorldBook 或 Generation Profile 任一现有资产。 |
| “常世也是默认 Stage” | 当前产品与 WorldBook 文档刻意把 Cinema 放在独立域；手机和 Chat 不以 Stage 为上层 | 与现有架构冲突；已被用户否决 | 不采用。主世界由 Chat 的联系人 / 关系 / 主时间线拥有；普通线下相遇仍留在这个 scope。 |
| TXT → Stage Draft | 现有导入边界支持结构预检与来源保留，但没有长文分块 / Stage 抽取 | 真正新产品想法 | 产品价值成立，但应在手工 Stage MVP 之后；AI 产物必须是可审查 Draft，原文是来源，不是运行时自动事实。 |
| Chunking、实体抽取、provenance、自动 QA | 角色分析 / 导入预检已有少量相邻能力，未形成通用 ETL | 补充 + 新基础设施 | 可用于 WorldBook 与 Cinema source pipeline；角色卡只用于辅助整理，不得让抽取结果自动改写 ready 角色。 |
| 关键词 + 向量 + Hybrid Search + rerank | WorldBook 已有关键词 / 标题回退；事件记忆有独立关键词 / 可选语义索引；没有 WorldBook 语义索引或 reranker | 新想法；大部分延期 | 可以复用检索接口思想，但必须建立独立知识索引；不能把世界书、角色卡、预设塞进事件记忆数据库。 |
| 全局 `KnowledgeItem` 统一所有内容 | 当前明确不建立包揽一切的全局 Store，且角色 / 世界 / 预设 / 事件各有权威合同 | 与现有架构冲突 | 不可作为事实源。最多做带 provenance 的派生搜索文档 / read model，删除后可从各权威资源重建。 |
| Rolling Summary | 当前保留完整消息、有限历史窗口和事件记忆，没有长期剧情滚动摘要 | 真正新想法；延期 | 应属于具体 Session / CinemaInstance 的派生状态，不能替代原消息，也不能自动成为角色事实。 |
| 简单 Story State Machine / Trigger | 系统壳有 UI 状态机，但没有剧情状态机；两者不是同一领域 | 真正新想法 | 适合 Cinema 第二阶段。第一版只需少量显式状态和合法 transition，不需通用规则引擎。 |
| Event System 驱动 Chat / News / Forum / Moments / Wallet | 当前只有系统事件、通知请求和关系事件等局部机制，没有统一领域事件总线 | 真正新架构想法；延期 | 不应先做“万能 Event System”。先在第二个真实消费者中证明一个具体 typed event，再抽象。 |
| Group Chat、Wallet、Shop、Forum、News、Diary 等 | 正式任务图明确把群聊、钱包和新大型 App 放在后面 | scope 扩张；延期 | 仅作为远期产品地图保留，不因全局蓝图出现就进入近期实施。 |
| Multi-Agent 提取 / QA | 当前单模型、结构化合同和本地检索尚未完成真实质量验收 | 延期 | 没有单模型失败证据前不引入。 |

## 3. Chat、Cinema 与共享 Runtime 的正确边界

讨论里“共享底层”的方向成立，但当前实现还不能直接被称为真正的多玩法 Runtime：

1. `buildRuntimeInput()` 当前是 `mercury-chat-app.js` 的方法，不是独立跨 App 服务。
2. `compileRuntime()` 虽然能接收 Core、Profile、World、Memory、Scene Context 和 Generation Profile，但输出纪律仍围绕 Chat 的 AssistantTurn。
3. 当前 Runtime Core 同时包含“媒介中立”规则和硬编码的“像真人发短信”规则；Chat presentation 也明确写死短信输出。Cinema 若原样复用，会被要求不写叙述、只发短信，与互动剧场目标直接冲突。

因此在 Cinema 开始时，合理的最小重构不是“统一所有 Conversation”，而是拆成：

```text
Shared Runtime Inputs
  ├─ universal character continuity / knowledge / scope rules
  ├─ Archive asset resolution
  ├─ bounded worldbook retrieval
  ├─ bounded event retrieval
  └─ selected Generation Profile capability

Mode Adapter
  ├─ Chat online: SMS AssistantTurn / bubbles / inner voice
  ├─ Chat offline encounter: scene turn / encounter outcome（仍在主世界 scope）
  └─ Cinema: AU narrative turn / player action / isolated state delta
```

这一步只应在 Cinema 成为第二个真实消费者时进行，并以不改变 Chat 现有输出合同为验收条件。

Cinema 还需要独立识别 Generation Profile 的适用能力。共享 Profile 不代表每个 Profile 都适合每种 App：包含短信分泡、In-Chat 注入或 Chat 专用输出规则的 Profile，在 Cinema 中应显示不兼容或只应用可证明通用的玩法块，不能强行全量播放。

## 4. 技术机制在不同资产中的可用范围

| 技术机制 | Generation Profile | WorldBook | Role Card | Cinema / Stage | 结论 |
| --- | --- | --- | --- | --- | --- |
| JSON Schema / 结构化输出 | 适合导入、编辑与兼容诊断 | 适合条目和抽取 Draft | 适合角色分析 Draft | 适合 Stage Draft、action proposal、state delta | 推荐作为共享合同能力。 |
| Chunking | 通常不需要；保留来源块即可 | 适合长原始知识源 | 仅在超长来源分析时辅助，不拆散权威角色核心 | 适合 TXT / Lore Source | 不做一个全局分块 Store。 |
| Provenance | 保留来源与兼容状态 | 强烈适合 fact → source chunk | 适合分析来源与版本 | Stage fact / entity / rule 必须可追溯 | 可上提为通用元数据约定。 |
| Keyword retrieval | 不应用于选择预设内部指令 | 已实现并继续保留 | 角色核心应稳定进入，不靠检索碰运气 | 适合 Stage Lore | 角色核心和预设不能变成“召回到才生效”。 |
| Semantic / Hybrid retrieval | 不建议 | 可作为独立派生索引的未来增强 | 只适合附属长资料，不适合决定角色是谁 | 适合大型 Lore Source | 与事件记忆索引严格分库 / 分 contract。 |
| Context budgeting / packing | 约束 Profile 指令预算 | 已有 8 条 / 5000 字符预算 | 需要角色核心最低保留策略 | 需要 Stage / state / recent turns 配额 | 推荐共享策略与 trace，不共享数据记录。 |
| Character Core / State | 不能存角色状态 | 不能存角色状态 | Core 在这里；State 不在这里 | 主世界 State 属于 contact / primary timeline；AU State 属于 CinemaInstance | 必须按权威边界拆分。 |
| State Machine / Trigger | 不属于预设事实 | 可提供只读规则资料，但不执行 | 不属于角色卡 | Encounter 与 Cinema 可共享 transition 校验，但分别拥有状态 | 不要把可执行状态命令藏进资源文本。 |
| Tool / Function Calling | Profile 可限制风格，不能授予权限 | 世界书不能触发任意代码 | 角色卡不能携带可执行能力 | 只允许 action proposal + allowlist validator | 继续禁止任意脚本和直接写 Store。 |
| Rolling Summary | 不属于 Profile | 不属于世界事实 | 不属于角色核心 | 分别属于主世界时间线 / encounter 或 CinemaInstance 的派生状态 | 原始 turn 必须保留，不得跨 scope 混用。 |
| Knowledge Graph | 不适用 | 可做派生关系视图 | 可引用稳定 entity ID | 可辅助 Stage cast / faction / location | 中后期；图不是事实源。 |

## 5. 值得近期考虑、但尚未决定的事项

这些事项值得成为后续独立决策，不代表现在开始实现：

1. **主世界 Offline Encounter 产品合同**：定义 invitation、进入 / 退出、与主时间线的关系、outcome 和 durable memory gate；它属于 Chat，不新建 Cinema scope。
2. **Cinema MVP 产品合同**：只定义 Stage、Character Variant、PlayerRole、Scenario、CinemaInstance、CinemaTurn、StoryState 与保存 / 恢复，不含 TXT、地图或通知。
3. **Cinema identity**：Cinema 不应复用当前 Chat 的 `contactId + timelineId` 消息键；需决定实例的命名、并行数量和恢复入口。
4. **Character Variant 合同**：明确哪些字段可作为 Stage overlay，哪些变化必须创建可追踪变体；禁止修改原 RuntimeProfile。
5. **Typed action proposal**：主世界可先支持一个低风险 `propose_invitation`；Cinema 可另有 `propose_story_transition`。二者分别经过 schema、权限、确认和幂等检查。
6. **共享 assembler 的提取时机**：等 Offline Encounter 或 Cinema 成为第二种真实输出模式时再提取 universal 层，并保持 Chat 现有输出协议和测试不变。
7. **Chat v1 对主动消息的定义**：决定真正的后台主动消息是否属于 Chat v1，或作为以后需要部署 / 调度基础的共享能力。当前不能标记为已实现。

## 6. 应延期的事项

- TXT 自动生成 Stage、语义分块、实体图谱、自动世界观 QA。
- WorldBook / Stage Lore 的新向量库、Hybrid Search、reranker。
- 通用剧情规则引擎、复杂 Trigger DSL、模型任意 tool calling。
- 地图随机生成、Graph Map、双箭头移动、交通与地点事件。
- 主动消息后台服务、离线推送、世界自主运转模拟。
- 多角色群聊、Moments 正式化、Forum、News、Mail、Wallet、Shop、Economy。
- 多 Agent 抽取和多模型裁判。
- 把所有领域统一成一个 KnowledgeItem / Global State / Conversation Store 的重构。

## 7. 仍需通过产品访谈确认的问题

Cinema 与主世界 Offline Encounter 的归属边界已经由用户确认，不再作为问题重复询问。仍需确认的是具体产品行为：

1. 主世界关系通过什么入口进入 Offline Encounter，用户怎样退出、取消和回到 Chat？
2. Encounter 的哪些 outcome 可立即更新主时间线，哪些只能成为待确认 / durable event？
3. Character Variant 何时是轻量 overlay，何时必须成为独立可追踪变体？
4. CinemaInstance 如何命名、区分、保存和恢复；同一 Stage / Scenario 是否允许多个并行实例？
5. Archive 的哪些资产只读共享给 Cinema，哪些主世界状态必须永远不可见？
6. UI 如何让用户明确感知“Chat 的主世界生活”和“Cinema 的 AU / 剧本体验”属于不同体验层？

这些问题应一次只确认一个；仓库已经回答的资源边界不再询问。

## 8. 最终建议

保留 Cinema 蓝图，但把产品分成两条明确路径：**Chat 主世界 = 线上聊天 + 同一关系中的 Offline Encounter；Cinema = 独立 AU / 剧本 App + 独立实例状态。** 两者可以共享受限 Runtime 能力，但不共享世界状态。保留 TXT → Stage、RAG、状态机、事件、地图作为可扩展方向，但不要把它们当作首版 Cinema 的组成清单。

对全局角色卡、世界书和 Generation Profile，采用“**能力复用、合同分离**”的原则：结构化导入、provenance、预算、trace、受控 action proposal 可以共享；角色核心、世界事实、玩法指令、关系证据、事件记忆和 Cinema 状态继续各自拥有权威来源。

在产品访谈完成并由用户确认 decision brief 之前，不建议把本次讨论写入 `DECISIONS.md`，也不建议创建 Cinema、Encounter Engine、Event System 或全局 KnowledgeItem 的实现任务。

## 9. 已被取代的假设

- **已取代**：所有完整场景都应归入 Cinema。
- **已取代**：普通邀约 / 线下相遇结束后需要跨域写回 Chat。
- **已取代**：Cinema 应拥有通用 Scene Engine。
- **已取代**：主世界 / 常世应建模为默认 Stage。
- **当前有效**：主世界 Offline Encounter 属于 Chat 的联系人、关系与主时间线；Cinema 只承载隔离的 AU / alternate-world / scripted experience。

# Mercury Phone — Cinema / Offline Encounter 产品简报（草案）

> 状态：产品讨论整理稿，等待用户最终确认；不是 `DECISIONS.md`，也不是实现授权。
>
> 日期：2026-08-18
>
> 范围：主世界 Chat 的线下相遇，以及独立 Cinema App 的平行世界玩法。本文不修改现有正式决定，不代表可以跳过当前 `NEXT_STEPS.md` 开始开发。

> 地图架构修订：2026-08-21。本修订替换此前“为 Aevoria 地点准备独立概念 CG、以静态地图图片承载功能地图”的候选方案；不改变 Cinema UI 视觉方向，也不构成当前地图实现授权。

## 1. 结论摘要

### 1.1 产品边界

**Chat 负责正常世界中的完整关系；Cinema 负责隔离的平行世界故事。**

```text
Primary World / Chat
  └─ Contact + Primary Relationship + Primary Timeline
       ├─ Online Chat
       └─ Offline Encounter

Cinema
  └─ Stage + Player Role + Character Variant + optional Scenario
       └─ CinemaInstance + isolated StoryState
```

- Chat 的线上聊天和线下相遇属于同一联系人、同一关系和同一主时间线。
- Cinema 是 Mercury Phone 中另一个完整玩法 App，不是 Chat 的皮肤、模式或默认 Stage。
- Cinema 可以消费 Archive 中的角色卡、世界书和 Generation Profile，但不得成为这些资产的新事实源。
- CinemaInstance 的身份、关系、记忆、场记和剧情状态不得自动写回主世界 Chat。
- 两个玩法可以共享 Runtime 能力，但必须保持状态所有权和输出合同分离。

### 1.2 实施顺序

Cinema 的产品方向成立，但**不应在当前 Chat 与 Generation Profile 主线之前实现**。当前正式状态与顺序仍以 [PROJECT_STATE.md](PROJECT_STATE.md)、[AI_HANDOFF.md](AI_HANDOFF.md) 和 [NEXT_STEPS.md](NEXT_STEPS.md) 为准。

推荐顺序：

1. 完成当前正式主线与 Chat 闭环。
2. 定义并实现属于 Chat 的 Offline Encounter 最小闭环。
3. 以一个手工整理的 Stage 验证纯文本 CinemaInstance。
4. 只有闭环稳定后，再考虑 TXT 自动转换、生图视觉小说、多人主演等扩展。

## 2. 不可破坏的资源职责

| 资源 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| Character Card / Runtime Profile | 角色核心人格、价值、稳定身份事实、行为边界和说话习惯 | 主世界动态关系、Cinema AU 身份、剧情存档 |
| Contact / Primary Timeline | 正常世界中的联系人实例、关系证据、线上聊天与线下共同经历 | AU 故事状态 |
| World Book | 可复用的世界事实、规则、地点、势力与知识条目 | 一次具体剧情、角色动态状态、自动执行命令 |
| Generation Profile | 文风、叙述视角、篇幅、节奏、情节主动性等“如何生成” | 角色是谁、世界中什么是真的、关系事实 |
| Stage | Cinema 中可重复游玩的自洽世界容器 | 原始角色核心、主世界关系、一次故事的全部进度 |
| Scenario | 可选的开场处境或一次性剧情种子 | 替代 Stage 的稳定世界规则 |
| Character Variant | 原角色在特定 Stage 与本次选角中的身份表达 | 覆盖或修改原角色卡 |
| CinemaInstance | 本场放映的 Player Role、Variant、关系、场记、StoryState 与历史 | 修改 Archive 原始资产或 Chat 主时间线 |

Generation Profile 已是 Archive 的共享资产，Chat、Offline、Cinema 等玩法只应消费它，不能建立各自的顶层 Profile Store，见 [GENERATION_PROFILE_UI_HANDOFF.md](GENERATION_PROFILE_UI_HANDOFF.md)。

## 3. Chat Offline Encounter

### 3.1 定位

Offline Encounter 是 Chat 内的主世界线下相遇，不是 Cinema，也不是跨域剧情。

典型流程：

```text
线上邀请
→ 用户接受
→ 简短过场动画
→ 进入独立全屏的线下相遇子空间
→ 正常结束 / 自然提前结束 / 技术暂停
→ 生成纪念物并确认记忆
→ 返回 Chat
→ 后续关系和主动消息继续发生
```

它虽然在视觉上暂时离开短信界面，但仍属于同一个 Contact、Primary Relationship 和 Primary Timeline，所以结束后不存在“从 Cinema 写回 Chat”。

### 3.2 页面与并行使用

- 线下相遇采用独立全屏 Chat 子空间，UI 与普通线上聊天明显不同，可以更接近约会或共同出行体验。
- 用户可以返回 Chat 列表，与其他角色正常聊天；正在进行的相遇保持可恢复。
- 返回列表、锁屏、切后台、刷新或崩溃只算暂停，不得自动解释为用户抛下角色。
- 相遇期间时间可以继续，但关键互动和重大剧情选择应等待用户，不在后台自主演完。

### 3.3 “约会时回复别人”的可见性

用户在线下相遇中切去回复其他角色，可以被理解为现实中的“约会时看手机”，但角色知道多少必须由物理条件与人设共同决定：

- 距离较远时，角色最多知道用户在看手机。
- 距离很近且角色符合跳脱、亲昵或好奇的人设时，才可能凑近查看。
- 未看到屏幕时，角色不得知道聊天对象或内容。
- Runtime 提供可观察事实；角色卡决定角色如何反应。不能设置一个全局“吃醋/偷看”开关替代人设。

该规则复用 Mercury 已有的知识边界原则，不需要另建一套全知叙事规则。

### 3.4 三种离场语义

#### 正常结束

- 一次线下事件正式完成。
- 生成票根或明信片式纪念物。
- 提取本次出行摘要和重要信息点，进入用户确认环节。
- 已确认的重要事件留在主时间线，可在后续聊天和邀请中自然使用。

#### 用户主动提前结束

- 不使用惩罚式弹窗或机械扣分。
- 系统按当前情境和角色人格自然收束，并优先照顾用户感受。
- 例如用户不舒服时，角色可以关心、送用户到住处或设定中的休息点，并在稍后主动询问是否安全到达。
- 关系变化必须来自可解释的互动证据，不使用无来源的数值惩罚。

#### 技术中断

- 锁屏、切后台、关闭页面、刷新或异常退出仅保存进度。
- 技术中断不产生关系事件，也不触发“被冷落”剧情。

### 3.5 纪念物与记忆确认

正常结束后生成的票根或明信片承担两种职责，但两者不能混为一谈：

1. **收藏呈现**：图片、版式和用户留言，可以简单编辑。
2. **事实确认**：本次发生了什么、哪些信息值得记住，由用户检查和修正。

更换图片或修改装饰留言不能自动改写事实记忆。

记忆提取要区分观察事实与推断。例如：

- “用户这次吃了火锅”是观察事实。
- “用户喜欢火锅”是尚未确认的推断。

角色可以在之后自然询问、推荐或再次邀请，由新证据确认偏好，不能因为一次行为直接生成永久喜好。

### 3.6 主动消息

主动消息是 Offline Encounter 闭环的重要部分，尤其用于：

- 询问用户是否安全到达；
- 回顾本次出行；
- 根据已确认的兴趣提出下一次邀请；
- 延续同一主世界关系，而不是只在用户主动打开聊天时存在。

但当前 Mercury 只有通知存储与显示能力，没有完整的后台调度、离线队列和闭 App 后生成凭据。主动消息不能被描述为已解决能力，具体执行模型仍需单独决策。

## 4. Cinema 产品合同

### 4.1 核心定位

Cinema 是 Chat 收口后可以独立成立的完整玩法 App，用于：

- 平行世界 / AU；
- 角色的舞台化身份变体；
- 用户自定义身份；
- 可选 Scenario 开场；
- 长期、可暂停恢复的纯文字互动故事。

Cinema 第一版以自由游玩为核心，不要求开放世界地图，也不要求变量角色卡。

### 4.2 Stage 与 Scenario

#### Stage

Stage 是主体，是可重复进入、自洽且能支撑多种身份与剧情的世界容器。它应至少说明：

- 时代、技术或超自然规则；
- 地点与稳定环境；
- 势力、制度和社会常识；
- 允许的用户身份空间；
- 不能被剧情随意改写的硬事实。

Stage 可以选择提供结构化 `geography`。它是地点、区域和连接关系的叙事空间图，不要求 GIS、经纬度或真实比例；没有 `geography` 的 Stage 不显示功能地图入口，也不影响纯文本放映。

同一个星际未来 Stage 中，用户可以成为敌对阵营军官、边境行商、海盗、和平地区大学生，甚至联邦环卫机器人，只要不破坏 Stage 的硬规则。

#### Scenario

Scenario 是一次性的开场处境或强剧情种子。若更换背景后核心剧情仍基本成立，它更接近 Scenario，而不是 Stage。

第一版 Scenario 可选：用户既可以使用开场种子，也可以只选择 Stage、身份和角色后自由开始。

### 4.3 TXT 导入

“导入 TXT 生成 Stage”技术上可行，但不进入第一版。合理流程是：

```text
导入 TXT
→ AI 提取并判断 Stage / Scenario / 混合内容
→ 生成可编辑草稿
→ 用户检查、修正与确认
→ 保存为可用 Stage
```

原文是来源，不是自动生效的世界事实。任意世界书或 TXT 也不能未经整理直接被当成可玩的 Stage。

未来 Stage Draft 可以从 TXT 生成 `geography` 草稿，但必须经过地点、别名、连接和不确定关系的用户确认。第一版只要求 Stage schema 与 renderer 能消费结构化 geography，不实现复杂 NLP 抽取。

### 4.4 Player Role 与 Character Variant

每次创建 CinemaInstance 时，用户在“放映筹备”中完成：

- 选择一个核心 Char；
- 选择或自由填写本世界中的用户身份；
- 由 AI 草拟角色在 Stage 中的身份、阵营、经历、目标与压力反应；
- 展示必须保留的原角色人格锚点；
- 用户检查并修改后才开始放映。

Variant 的原则是“环境改变表达，不凭空反转人格”。阳光、忠诚、外向的角色成为海盗后，可以在高压环境中表现出无畏、冒险或生存警觉，但不能无因变成与核心人格相反的阴暗病娇角色。

第一版 Character Variant 仅属于当前 CinemaInstance：

- 不写回原角色卡；
- 不建立可复用 Variant 库；
- 故事档案中保留完整快照，以便恢复和审计；
- 若未来用户反馈强烈，再考虑“从本次选角复制到新故事”。

### 4.5 单角色范围

第一版每场放映只允许一个核心 Char。Stage 可以生成配角、路人和阵营人物，但：

- 临时 NPC 由 Stage 事实与 Cinema 叙事层共同约束；
- NPC 只属于当前 CinemaInstance；
- NPC 不能修改角色卡或进入 Chat 联系人层；
- 不支持多张角色卡与用户共同主演。

多人核心角色依赖群聊式发言调度、多人关系与上下文竞争，明确延期。

### 4.6 交互形式

第一版优先单模态纯文本：

- 用户自由输入台词、行动、观察或意图；
- AI 依据 Stage、角色卡、Variant 和当前 StoryState 继续演绎；
- 可偶尔提供可忽略的行动建议，但不使用固定选项树限制剧情；
- “预设选项为主＋生图”的视觉小说创作模式留到未来，作为独立扩展，不塞入当前闭环。

### 4.7 关系状态

- Cinema 不自动继承 Chat 中的关系。
- 放映筹备时，用户可以选择陌生人、同伴、敌对者、恋人等关系起点，也可以自由填写。
- 关系发展仅属于当前 CinemaInstance。
- 不显示“好感度 73%”或爱心进度条。
- 系统以有证据的定性状态维护信任、戒备、亲密、冲突与承诺，并通过行为、场记和剧情后果表达。

### 4.8 锁定与修正

故事开场后：

- Player Role 与 Character Variant 的核心设定默认锁定；
- 允许补充细节或纠正模型误解，并保留变更记录；
- 根本改变身份时应新建 CinemaInstance；
- 全局世界书、角色卡或 Generation Profile 后续被编辑，不自动改变已开始的故事。

### 4.9 并行实例

同一个 Stage 可以同时保留多个未完成的 CinemaInstance。每个实例拥有独立的：

- 副标题与最近剧照；
- Player Role；
- Character Variant；
- 初始和当前关系；
- StoryState、场记与历史；
- 资源版本快照。

影院大厅可以按 Stage 归组，但不同场次不能覆盖彼此。

### 4.10 暂停与谢幕

- 离开银幕永远只算“中场休息”。
- CinemaInstance 暂停后，时间、剧情和角色全部静止。
- 暂停期间不以角色身份发送主动消息，也不向 Chat 串线。
- Cinema App 可以显示普通的“有一场未完成放映”入口，但不能伪装成角色来信。
- 只有用户明确选择“结束本场故事”并再次确认，实例才进入谢幕和只读归档。
- AI 可以在自然结局处建议谢幕，但不能擅自结束。

结束后的故事默认只读回看；第一版不提供同步最新版角色卡、复用 Variant 或从片尾继续改写原实例。

## 5. 长故事与“场记”系统

### 5.1 自动分场

Cinema 在时间、地点或叙事阶段明显变化时自动划分场景。分场不频繁弹窗，也不要求用户逐次确认。

### 5.2 命名体系

产品采用“影院为主、戏剧结构为辅”的语言：

| 名称 | 产品职责 |
| --- | --- |
| 场景 | 底层最小叙事单位；通常由系统自动识别 |
| 幕 | 用户可见的章节单位，可包含多个场景 |
| 场记 | 场景连续性记录：人物、地点、事件、道具、状态变化与未解决线索 |
| 转场 | 明显时间或地点变化时的短过渡 |
| 幕间 | 两幕之间的自然停顿 |
| 前情提要 | 用户隔一段时间回来时，根据场记生成的续演回顾 |
| 中场休息 | 实例未结束时离开放映界面 |
| 片尾 / 谢幕 | 用户确认结束后的结局总结 |
| 往期放映 | 已完成实例的只读档案 |

“间章”不作为自动摘要名称。它保留给未来真正的特殊叙事，例如梦境、回忆、书信或配角视角。

### 5.3 场记的状态职责

场记是可审查的派生状态，不是装饰文案：

- 自动生成并用于后续上下文维护；
- 中场休息或谢幕时允许用户查看和纠正；
- 不删除原始 turn；
- 用户修正后，从后续回合起参与 Runtime；
- 不得跨 CinemaInstance 或写入主世界记忆。

## 6. Cinema 信息架构与视觉隐喻

当前只确认页面职责，不确认具体视觉稿、颜色、字体、动效或图片风格。

```text
影院大厅
→ Stage 海报详情
→ 放映筹备
→ 开场过渡
→ 银幕 / 正片
→ 中场休息与续演
→ 片尾 / 谢幕
→ 往期放映
```

### 6.1 页面职责

#### 影院大厅

- “正在放映”：未完成 CinemaInstance。
- “舞台海报墙”：可进入的 Stage。
- “往期放映”：已完成实例。

#### Stage 海报详情

- 展示世界简介、硬规则、主要势力和可用身份空间。
- 提供“开始新放映”，不表现为打开普通聊天。

#### 放映筹备

- 选择核心 Char、Player Role、关系起点和可选 Scenario。
- 展示 AI 草拟的 Character Variant 与人格锚点，供用户确认。

#### 银幕 / 正片

- 是 Cinema 的主体，不只是换皮聊天框。
- 承载场景、角色行动、自由文本输入和必要的状态提示。
- 第一版仍是纯文字，不承诺视频或生图。

#### 中场与续演

- 以 Stage 主海报、本场副标题、最近剧照、角色身份和当前幕识别实例。
- 继续放映时可展示前情提要。

#### 谢幕与档案

- 保存结局、角色与用户身份、重要幕、关键选择和代表剧照。
- 使用海报、剧照、片尾页、谢幕册等 Cinema 收藏语言。

### 6.2 两套收藏语言不能混淆

- Chat Offline Encounter：票根、明信片、约会纪念物，代表主世界共同经历。
- Cinema：海报、剧照、片尾页、谢幕册，代表隔离的平行世界作品。

Stage 使用稳定主海报；CinemaInstance 第一版使用“主海报＋本场副标题＋最近剧照”区分，不要求每次故事都生成全新海报。

### 6.3 Cinema Map Architecture（地图方案修订）

Cinema 的功能地图不再以 Aevoria 的静态图片或地点概念 CG 为实现前提。统一方向是：

```text
Stage Geography
  ↓
Structured Spatial Graph
  ↓
Data-driven schematic map
  ↓
SVG / DOM renderer
```

地图是 Stage 世界结构的一种视觉投影，不是另一套世界事实，也不是每次由 AI 重新生成的 raster 资产。Stage 没有任何地图图片时，也必须能从结构化 geography 得到有效的简图；玩家自定义 Stage、未来其他 Cinema Stage 和后续 TXT 导入 Stage 共用同一个 renderer。

#### Stage Geography 的最小数据面

第一版只需要表达叙事空间关系，不实现 GIS、经纬度、真实地图投影、路径规划或导航：

```js
geography: {
  schemaVersion: 1,
  regions: [{ id, name, type, metadata }],
  locations: [{ id, name, type, regionId?, position?, metadata? }],
  connections: [{ id, from, to, kind, metadata? }]
}
```

`position` 是可选的归一化 `x/y` 视觉提示，不是地理真相。`connections.kind` 第一版支持：`road`、`path`、`rail`、`river`、`transit`、`teleport`、`flight`、`unknown`。

位置、方向或连接信息不足时，数据仍然有效。renderer 可以使用 approximate position、approximate relation，或保留 unknown / unresolved relation；不能为了填满地图而让 AI 编造精确距离。无法可靠布局时，允许退化为清晰的拓扑式地点与路线图。

#### Stage 静态事实与 CinemaInstance 动态状态分离

地点和连接属于 Stage Geography；`discovered`、`visited`、`current` 等状态属于 CinemaInstance 的空间投影，不写回 Stage：

```js
spatialState: {
  currentLocationId: null,
  mentionedLocationIds: [],
  knownLocationIds: [],
  visitedLocationIds: [],
  revealedConnectionIds: []
}
```

`reachable` 和 `important` 可以由 Stage 事实、连接条件和地点 metadata 派生。第一版不显示 RPG 数值、进度百分比、好感度、任务、等级或 XP。

最低限度要区分：`mentioned`、`known`、`visited`、`current`。AI 在正文中提到地点不能自动把它标记为 visited；只有用户明确行动、故事确认的实际到达，或用户确认的事件，才可以更新访问状态。

#### 默认功能地图与 Atlas

默认手机地图继续采用已经批准的 Cinema 方向：暖象牙纸面、硬墨线、克制的编辑/制图排版、有限色板、低装饰密度、小型结构化标签和谨慎的猩红强调。它应该像“旧式校园制图与现代信息地图的结合”，不是奇幻藏宝图、水彩插画、Google Maps、RPG 小地图、开发者 node graph 或 glossy game UI。

地图入口属于 optional World Extra：

- 有 Stage Geography 时显示地图入口；
- 没有 Stage Geography 时隐藏入口；
- Reading Screen 不显示常驻地图 HUD；
- 地图页面只回答“我现在在哪里、知道哪些地方、去过哪些地方”。

Aevoria 的高保真 Campus Atlas 继续保留，定位为 `illustrated atlas / presentation asset`。它不是功能地图的数据源，也不是功能地图的唯一实现方式。Atlas 与简图可以共用地点 ID、路线 ID 和标签数据，但不能要求每个 Stage 都有 Atlas。

#### 地点视觉与 Map-derived Location Plate

取消此前“Old Court、Forge Hall、North Gate Transit Hall 必须各自生成独立建筑 CG”的要求。点击地点时，默认只显示：

- 地图局部放大或强调；
- 地点名称与类型；
- 简短说明；
- 与当前 CinemaInstance 相关的已知信息；
- 当前 / 已访问状态。

地点可选提供 `location.image`。存在时作为 presentation asset 展示；不存在时完全退化到 map-derived presentation，不显示空白图片区块，也不显示 broken image placeholder。

Map-derived Location Plate 只需复用同一份 SVG/DOM 地图，通过简单 viewport 或 focused region 放大地图局部。目标是“刚才地图上的这个地方被放大”，而不是再生成一张不同画风的建筑概念图。第一版不要求复杂自动裁切算法。

#### Aevoria 的首批 geography

Aevoria 使用与其他 Stage 完全相同的 renderer。首批地点至少包括：

`Old Court`、`Veyr Library`、`Forge Hall`、`Glasshouse Reach`、`The Long Meadow`、`Lethwater`、`North Gate Transit Hall`、`The Pale Steps`、`Cairn`。

其地点之间的合理连接关系由 Stage Geography 数据提供；高保真 Campus Atlas 只作为可选收藏资产保留。没有地点 CG 时，Aevoria 简图仍必须完整可用。

#### 未来 TXT / Stage Import 的兼容方式

TXT 导入只需要面向结构化 geography 设计消费接口，不在本阶段实现复杂 NLP：

```text
TXT 原文
  → Stage Draft
  → locations / connections / regions 草稿
  → 未解析关系与置信度提示
  → 用户确认
  → Stage Geography
```

自然语言中的“北边”“东边”“通往”“附近”“坐车”“瞬移”等未来可以映射为基础空间关系和 connection kind。原文、解析版本和未解决术语必须保留，不能把推断直接写成不可审计的世界事实。

#### 明确不做

本地图能力第一版不实现：

- GIS、真实世界投影、复杂路径规划或 turn-by-turn 导航；
- pathfinding、动态世界模拟、3D、WebGL 或 procedural terrain；
- AI 每次重新生成地图图片；
- 地图任务、等级、数值、进度或常驻剧情 HUD；
- 复杂 NLP extraction、Multi-Agent 抽取和自动 QA。

### 6.4 Aevoria 资产调整

保留：

- Aevoria Campus Atlas 高保真地图；
- Cinema Curtain production assets；
- 已生成并确认的 Stage Hero。

暂时不要求：

- Old Court standalone CG；
- Forge Hall standalone CG；
- North Gate standalone CG。

如果未来确实需要地点视觉，优先从 map-derived visual system 生成或使用用户/Stage author 提供的可选图片，不引入与 Cinema 地图不同的独立画风。

## 7. 折页式新手引导

Cinema 第一次打开时展示一份折页场刊式的“放映指南”。它不是独立服务台页面，也不应长期占据竖屏首屏空间。

第一版建议三折：

1. **如何开始放映**：Stage 海报、新建场次、继续未完成放映。
2. **故事怎样进行**：幕、场景、场记、幕间和前情提要。
3. **怎样离场**：中场、谢幕、往期放映，以及 Cinema 不写回 Chat 的边界。

行为要求：

- 首次自动出现，但可以立即跳过；
- 只自动出现一次；
- 后续可从 Cinema 首页再次打开；
- 入口复用最终首页导航或二级操作，不新增独立“服务台”区块；
- 第一次真正遇到场记或谢幕时，可以提供一次简短上下文提示；
- 支持减少动态效果，折页动画不能成为理解教程的前提。

具体入口位置等待首页正式 UI 设计，不在本简报锁定。

## 8. Generation Profile 与实例快照

### 8.1 分层

Cinema 使用：

```text
Mercury Runtime Core
+ selected Generation Profile
+ Cinema narrative adapter
+ Character Core / Variant
+ Stage / Scenario
+ current StoryState / Scene Notes
```

- Generation Profile 控制文风、视角、篇幅、节奏与主动性。
- Cinema narrative adapter 控制场景推进、NPC 调度、暂停与谢幕规则。
- Character Card 决定角色是谁。
- Stage 决定世界中什么是真的。
- Profile 和 Cinema adapter 都不能覆盖角色核心或 Stage 硬事实。

### 8.2 快照原则

CinemaInstance 创建时保存所用 Stage、Character Core、Character Variant 与 Generation Profile 的版本快照。现有 Chat 仅按 `presetId` 读取共享 Store 最新版本，Cinema 的稳定快照需要新增实例合同，不能假装现成已有。

Generation Profile 快照只保存运行相关内容，例如：

- 来源 ID、更新时间与 schema 版本；
- 当时实际生效的指令与偏好；
- 兼容状态和未解析警告；
- Cinema adapter 版本。

不复制封面、原始导入文件和无关展示数据。用户在故事中主动更换 Profile 时，应从该回合起追加新快照，不改写旧回合。

只冻结用户选择的资源内容，不冻结 Mercury Runtime Core、安全规则或缺陷修复。

该能力实现难度为中低：主要成本是 CinemaInstance schema、快照迁移和版本追踪，明显低于主动消息、群聊调度或多人主演。

## 9. 与当前架构的对照分类

### 9.1 已经存在的决定

- Mercury System / App Engine 在上，深度玩法应作为独立 App。
- Archive 拥有 Character、World Book 与 Generation Profile 原始资产。
- Chat 只消费选中的 Generation Profile，不拥有第二套顶层预设库。
- Character Core 与 Contact / Timeline 动态状态分离。
- 世界书、预设、角色、记忆和关系证据不能相互越权。
- 关系记忆需要可追溯证据；长期事件受用户确认与 scope 限制。
- NotificationStore 是共享基础设施，但不是主动生成调度器。

### 9.2 对已有决定的补充

- Chat 的主世界范围明确包含线上聊天和线下相遇。
- 技术中断与角色感知事件分离。
- Generation Profile 成为 Cinema 消费者的共享资产，但需要 Cinema 专用 adapter。
- 角色在 AU 中通过实例 Variant 表达，不能静默改写 Character Core。
- 世界书可以成为 Stage 的素材来源，但 Stage 仍需显式可玩结构。
- Runtime 可共享结构化输出、预算、来源追踪与校验能力，但不共享实例状态。
- Cinema 功能地图与 Stage 的图片资产分离；Stage Geography 是可选结构化能力，Atlas 和地点图片只是展示增强。

### 9.3 真正的新产品想法

- Chat Offline Encounter 全屏子空间。
- 自然提前结束、关怀收束和后续主动询问。
- 票根 / 明信片纪念物与记忆确认门。
- Stage-first 的 Cinema App、并行 CinemaInstance 与放映档案。
- Player Role、Character Variant、实例关系与临时 NPC。
- 幕、场记、前情提要、中场和谢幕组成的长故事系统。
- 折页场刊式新手引导。

### 9.4 与现有边界冲突或已被取代的想法

- 把所有完整场景都归 Cinema。
- 把正常世界设为默认 Stage。
- 把 Offline Encounter 当成 Cinema 结果写回 Chat。
- 在同一个 Chat Conversation 上增加 `theater` 模式。
- 让 Cinema 自动改写主世界关系、记忆或角色卡。
- 把任意世界书或 TXT 未经检查直接变成 Stage。
- 让 Generation Profile 承担角色人格或世界事实。
- 让模型直接写 Store、执行任意脚本或生成无证据关系数值。

### 9.5 值得在 Chat 收口后实现

1. Offline Encounter 最小产品合同与暂停 / 结束语义。
2. 纪念物、事实确认和主世界事件记忆接线。
3. 主动消息的可控调度方案。
4. 单 Stage、单核心 Char、纯文字 CinemaInstance。
5. 场记、前情提要、暂停恢复与谢幕归档。
6. Archive 资产消费与运行快照。
7. 在纯文字 CinemaInstance 闭环稳定后，补充可复用的 Stage Geography 与 SVG/DOM schematic map；它是 optional World Extra，不是 Cinema MVP 的放映门槛。

这些项目已有产品价值，但仍不得越过当前正式 `NEXT_STEPS.md`。

### 9.6 明确延期

- TXT 自动转换 Stage。
- 生图与选项主导的视觉小说模式。
- 多张角色卡共同主演。
- Character Variant 复用库。
- GIS、真实地图投影、复杂路线规划、pathfinding、动态世界模拟与 3D/WebGL 地图。
- World Book 大规模语义 / Hybrid Search、reranker 和知识图谱。
- Multi-Agent 抽取或自动 QA。
- Cinema 暂停期间自动推进或角色主动消息。
- 通用脚本执行器、万能 Event System 和全资源统一 Store。

## 10. 第一版闭环建议

### 10.1 Offline Encounter MVP

```text
一个联系人发起或接受一次邀请
→ 简短过场
→ 纯文字线下相遇
→ 可暂停并返回 Chat 列表
→ 正常结束或自然提前结束
→ 生成一张可编辑纪念物
→ 用户确认重要事实
→ 后续 Chat 可使用已确认事件
```

第一版不要求真实地图、复杂日历、图像生成或后台全天候运行。

### 10.2 Cinema MVP

```text
选择一个手工 Stage
→ 选择一个核心 Char
→ 创建 Player Role 与关系起点
→ 确认一次性 Character Variant
→ 可选 Scenario
→ 创建 CinemaInstance 与资源快照
→ 自由文本互动、自动分场和场记
→ 中场暂停 / 恢复
→ 用户确认谢幕
→ 只读往期放映
```

成功标准是：同一 Stage 的多个实例能独立恢复，角色人格与世界事实稳定，长故事不会因 Profile 或原资产后来被编辑而突变，Cinema 状态不会进入 Chat。

地图不属于 Cinema MVP 的必需闭环。未来有 Stage Geography 的 Stage 才显示地图 World Extra；功能地图必须由同一套 structured spatial graph renderer 消费，没有 Atlas 或地点图片时仍然成立。

## 11. 仍需用户价值判断的少量问题

这些问题不阻塞本简报成立，但在对应实现前必须单独确认：

1. **主动消息执行模型**：仅在下次打开 Mercury 时补发、前台定时，还是未来依赖服务端后台调度；三者在隐私、凭据和可靠性上差异很大。
2. **首个 Cinema Stage**：用哪一个手工世界作为 MVP 验收样例；它需要足够自洽，又不能大到逼迫团队先做开放世界。
3. **正式 UI 视觉方向**：影院大厅、海报、银幕、折页场刊和谢幕册的具体布局与图像资产，留到单独的 UI / 生图阶段确认。

## 12. 本简报不授权的事项

- 不授权现在开始实现 Cinema、Offline Encounter 或主动消息。
- 不授权修改 `DECISIONS.md`、`NEXT_STEPS.md` 或其他正式状态文档。
- 不授权把本简报中的候选字段直接固化为 schema。
- 不授权重写当前 Chat Runtime 或建立第二条平行 prompt lane。
- 不授权导入或复制外部作品的受保护设定、角色、文本或视觉资产。

进一步的逐项架构审查见 [PRODUCT_DISCUSSION_REVIEW.md](../../PRODUCT_DISCUSSION_REVIEW.md)。

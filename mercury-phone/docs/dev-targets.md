# Mercury 开发目标 — 用户侧两块 + 首期接角色卡

日期：2026-08-02
性质：**资源规划与目标文档**（不修改任何代码）。当后续实现者照此执行。
关联：`docs/runtime-core-v1.md`（Core 草案）、`FUNCTION_AUDIT.md`、`# Mercury Runtime Core v0.1.txt`

---

## 0. 本期目标一览

| # | 目标 | 用户侧还是角色侧 | UI 现状 | 数据层现状 | 本期动作 |
|---|---|---|---|---|---|
| A | **用户人设（玩家是谁）** | 用户侧 | ❌ 无 | ❌ 无 | 列为目标，**暂缓实现** |
| B | **用户预设（玩家怎么玩）** | 用户侧 | ❌ 无 | ⚠️ 契约空壳 | 列为目标，**暂缓实现** |
| C | **接角色卡（首期，有 UI）** | 角色侧 | ✅ 全齐 | ✅ 全齐但未连 | **本期落地** |

> 用户拍板：「先把用户侧的两个写进开发目标，我们先做有 UI 的吧」→ 本期做 C，A+B 只写目标不实现。

---

## 1. 目标 A — 用户人设（User Persona）

**定义**：关于「玩家 / 对话主人」的持久设定——用户作为一个存在是谁。区别于角色卡（角色是谁），也区别于预设（用户怎么玩）。

**当前现状（实测）**：
- 聊天数据层 `mercury-chat-data.js`：消息只建模 `role: "user" | "assistant"`，**没有「这个 user 是谁」的字段**。`user` 只是对话里人类那一侧的占位，连固定 `CONTACT_A` 都是唯一联系对象，用户侧没有独立数据结构。
- 档案契约 `archive-contracts.js`：`RuntimeProfile` 全部字段是角色向（identity/summary/stableTraits/motivations/fears/values/boundaries/voiceStyle…），**没有任何字段承载用户人设**。Archive UI 的 route 全集（home/profile/profile-section/imports/modules/worlds/world-detail/world-entry）也**全是角色/世界向**。
- 聊天 UI（`mercury-chat-app.js`）的 `Me` 页 `profileAppearanceView()`（约 L281）：有「Avatar、profile background、name、status」——这是**用户自己的展示外观**（头像/背景/名字/状态），是用户人设的**最薄弱雏形**，但它只存外观字段，不含身份/性格/偏好。

**待落地（后续 P1/P2）**：定义 `UserPersona` 数据结构（字段建议：displayName、summary、identity、values、communicationPrefs、knowledgeBoundary），进编译时作为独立一层，遵守 Core 的权威边界（见 §3 优先级）。

---

## 2. 目标 B — 用户预设（User Preset）

**定义**：用户显式启用的「玩法层」设定——关系起点、戏剧强度、主动性、话题偏好。对应 Runtime Core §0.1「用户能做什么」那张表，**压缩进编译产物（presetId + 一段 instructions）**。

**当前现状（实测）**：
- `chat-contracts.js:180 compileRuntime()` 已预留 `userPreset.instructions` + `userPreset.id`（L183、185、188），`presetId` 已在输出里。
- **但没有**：可存取的 `UserPreset` 结构、编辑器 UI、任何 App 层读数。契约接口是空壳。
- ⚠️ **格式陷阱（你问的「格式对不对」要害）**：现存 `DEFAULT_SETTINGS`（`chat-contracts.js:12-16`）是**呈现层**——`presentation`（replyLength/bubbleMode/maxBubbles/deliveryPacing/actionText/unspokenAside）+ `context`（depth/summaryEnabled）+ `memory`。这与预设该管的**玩法层**是**两个维度**。**不能把预设塞进 `DEFAULT_SETTINGS`**，否则呈现场和玩法庭混在一起，就是「格式不对」。

**待落地（后续）**：定义独立 `UserPreset` 契约——
- 玩法字段：`relationshipStart`（关系起点）、`intensity`（戏剧强度）、`proactivity`（主动性档位，对齐 Core §16）、`preferences`（话题/称呼偏好）
- 生成器：把玩法字段翻译成一段 `instructions` 文本，喂给 `compileRuntime` 的 `userPreset` 槽
- 存储：独立命名空间（沿用 `mercury.app.<appId>.<key>` 模式），不并入 `DEFAULT_SETTINGS`
- UI：预设编辑器（属 UI 范畴，交 UI 负责人）

---

## 3. 目标 C — 接角色卡（本期首期实现）

**范围**：把已有 UI、已有存储的**角色卡 / 世界书 / 规则模块**接进 `compileRuntime()`，让它们真正进入聊天请求的编译产物。**纯代码连接，不新增 UI、不改现有 UI。**

**当前接线缝（实测，`mercury-chat-app.js:308-318`）**：
```js
async requestAssistant(message, previousEntries) {
  ...
  const response = await this.context.services.aiTransport.chat({
    requestId: `request-${message.id}`,
    conversationId: this.conversation.id,
    userMessage: { id: message.id, text: message.content },
    settings: this.conversation.settings,
    recentMessages: previousEntries.slice(-20),
  });
```
**`chat()` 目前完全不接收 Archive 数据。** `compileRuntime`（`chat-contracts.js:180`）也只收 `runtimeCore + runtimeModules + userPreset`，**没有把 `archive.v1` 的角色卡/世界书/模块读进编译输入的地方。**

### C.1 建「编译输入装配函数」
新增一个装配层（例如 `buildRuntimeInput(state)`），它做的事：
1. 从 Archive 拉 **approved/ready 状态**的 `runtimeProfiles[]`（当前 status 字段有 `draft / needs-review / ready`，见 `archive-contracts.js`，`RESOURCE_STATUSES`）
2. 拉关联的 `worlds[]` 的生效条目（按 scope 过滤，`worldBindings` 关联）
3. 拉 `enabled:true` 的 `promptModules[]`（当前默认 `enabled:false`，`compileRuntime` 的 `appliedModuleIds` 尚未接 enabled/scope/priority 语义）
4. 产出 `{ runtimeCore, runtimeModules, userPreset }` 形状，正是 `compileRuntime` 的入参

### C.2 接进 `requestAssistant`
在 `aiTransport.chat({ ... })` 的请求里加一个 `runtime` 字段（或等效），承载 `compileRuntime(...).compiledSystemText + appliedModuleIds + presetId`。`aiTransport` 是否透传、放请求体内哪一层，实现时按 `ai-transport.js` 的现有契约定。

### C.3 状态把关
- 但 status 非 `ready` 的 profile 不自动进编译；`status` 从 `draft/needs-review` 提升到 `ready` 需要用户在 UI 里操作（`resolveStatus`，现有 `renderProfileSection` 保存后置 `needs-review`，见 L382）
- `enabled` 的模块才参与（避免导入的原始规则自动生效 —— 这是安全语义，`renderModules` L439「Saved only, not active in Chat yet」文案应随实现更新）
- ⚠️ 契约仍是 `core_first` 单层优先。**多 profile / 世界书 scope / enabled 语义属于目标 C 的推进项**，首期先打通「单角色 + 手动启用模块」，不一次做完优先级系统。

### C.4 已知缺口（本期不做，记入 Roadmap）
- Archive 与 chat 之间没有「当前激活角色」的指针（哪个 profile 是对话的这个角色）；首期用「最近/首个 ready 角色」或让 chat 持有 activeProfileId
- `chat-experience.v1`（timeline/relationship）尚未进编译（这就是 Core 的 §1「current timeline」槽）
- 内存（`conversation.v1` entries → recentMessages）已作请求上下文，但**不进 compiledSystemText**（对齐 Core §0.2 优先级第 3 位「会话上下文」）

---

## 4. 与 Core 草案对齐（优先级 & 权威边界）

本期 C 落地后，`compiledSystemText` 的节序应贴合 Runtime Core §0.2 两轴：

| 层 | 来源 | 本期后状态 |
|---|---|---|
| Runtime Core（恒顶） | 本文档 §0-§22 常量化 → `runtimeCore.rules` | ⚠️ 尚未常量化（Roadmap） |
| 安全/产品规则 | 系统隐藏 | 未涉及 |
| 会话上下文 | chat recentMessages | ✅ 已是请求上下文 |
| **用户预设（玩法层）** | `UserPreset` | **目标 B，本期不做** |
| **角色档案** | `RuntimeProfile`（C.1） | **本期接通** |
| 世界/模块 | `WorldProfile` + `enabled PromptModule`（C.1） | **本期接通** |
| 临时请求提示 | 一次性 | 未涉及 |

**权威边界（§0.1）本期不触碰**：接角色卡只是「把角色/世界/模块读进来」，不改任何权限语义。用户预设能改玩法、不能改角色本质——这条等目标 B 实现时再落成代码校验。

---

## 4a. 参考沉淀（阅后即焚·仅抽象框架）

> 下方仅保留**可复用的结构 / 交互范式**。已随看随弃原来源，未留任何原文、专有名词、角色名、设定名或剧情。本节只描述「该要」，不含受版权内容。

对接 Mercury 现状，三条有用地参考（已核对，非照搬）：

**R1 — 角色卡两层化：全局档案库 + 每对话实例**
- 范式：一个角色库里存全局卡片；每个对话是一层实例，可在该实例上覆盖名字 / 人设 / 头像，全局卡不变。
- Mercury 现状：`archive.v1.runtimeProfiles[]` 是全局卡层；`contactInstances[]`（带 `relationshipState` / `timelineId`）**本来就是实例层**，但目前没挂「per-chat 覆盖」字段。
- 采纳建议：C 的一个可选推进项——给 `contactInstance` 加 per-chat override（displayName/voice 覆盖），同一角色卡可开多条对话而互不污染。

**R2 — 记忆三层化：短期上下文 + 可挂载记忆 + 自动长期总结**
- 范式：短期上下文长度可配；可从别的对话「挂载」记忆进来；长期记忆自动按间隔总结（可用独立后台通道）。
- Mercury 现状：`conversation.v1` entries 作 `recentMessages` 是「短期」这一层；无「跨对话挂载」「自动长期总结」。
- 采纳建议：对齐 Core §1 memory 槽。**不在本轮实现**，记作未来设计方向；`chat-experience.v1` 与 memoryCandidates 是承接点。

**R3 — 显式「响应模式」开关：聊天 vs 叙事/角色扮演**
- 范式：一个全局开关切换两种响应格式，而非在正文里藏权限。
- Mercury 现状：呈现层有 `unspokenAside`/`actionText` 开关（`DEFAULT_SETTINGS.presentation`），但分散在设置里，不是页面级模式开关。
- 采纳建议：可作为目标 B（用户预设玩法层）的**交互范式**——用显式模式开关承载「内心声/动作」呈现偏好。不照搬它方实现。

**R4 — 不采用**：周期后台行为循环（AI 主动动态/群自动评论等作品集花哨项）与本轮「先做基本聊天、不开花哨」冲突，明确搁置。

---

## 5. Roadmap 顺序建议

1. **C（本期）**：接角色卡 → 打通 `archive.v1 → buildRuntimeInput → compileRuntime → aiTransport.chat` 垂直切片，让角色卡/世界书/模块第一次真正进入对话。
2. **Runtime Core 常量化**：把 Core 文档 §0-§22 固化成 `runtimeCore.rules[]` 数据文件，作为最高优先级固定层。
3. **A（用户人设）**：定 `UserPersona` 契约 + UI。
4. **B（用户预设）**：定 `UserPreset` 玩法契约（独立于 DEFAULT_SETTINGS）+ UI + 生成器。
5. **优先级/权威边界落码**：`compileRuntime` 消化多 profile、scope、enabled、两轴语义。

---

## 6. 用户侧两块已在文档承接（前文 §1-§2）
用户人设（A）、用户预设（B）：字段方向与编译接入已铺垫，见本文 §1、§2。实现挂 Roadmap。

---

## 7. 目标 C 验收标准 —— 档案室 ⇄ 聊天「JSON 握手」链路

> 用户拍板：**同步机制 = JSON 文件握手**（不共享 store、不强耦合）；**入口 = 联系人头像进角色主页、人设进二级页**。验收以下链路端到端**真实可用**，用你自己构思的角色卡测，不用临时手写假角色。

### 7.0 两 App 各自独立存储
- 档案室写 `archive.v1`（角色卡原始数据 + 状态）；聊天写 `chat-experience.v1`（联系人 + 对话外观/设置）。
- **两者不互写、不共享对象**。唯一握手介质是一份角色卡 JSON。

### 7.1 档案室侧（创作 / 导入 → 导出）
- **创作**：现有 `createManualCharacter()` → `runtimeProfiles[]` 里出现一个 `status:"draft"` 的角色卡；`renderProfile[Section]` 可编辑字段。
- **导入**：现有 `openFilePicker()` + `confirmImport()` → JSON 解析、块检测、可确认成角色卡。
- **导出（新增目标）**：把一张角色卡序列化成一份可下载 / 可复制的 JSON 文件。形状对齐 `RuntimeProfile` 的真实字段：
  ```
  { schemaVersion, kind:"runtime-profile", id, displayName, identity, summary,
    stableTraits[], motivations[], fears[], values[], boundaries[],
    careStyle, conflictStyle, defenseStyle, voiceStyle,
    cognitionLimits[], changeThresholds[], worldBindings[] }
  ```
  （字段名以 `archive-contracts.js createRuntimeProfile()` 为准，导出不得凭空造字段。）

### 7.2 聊天侧（导入联系人）
- **联系人页 ➕** → 「导入角色卡(JSON)」→ 读 JSON → 在 `chat-experience.v1.contacts[<newId>]` 创建联系人，并**随联系人挂一份角色人设副本**（用 `DEFAULT_CONTACT` 形状：`name/identity/relationship/avatar/profileBackground` + 新增 per-contact 人设槽）。
- 导入后立即可见：出现新联系人、默认头像、身份一行。

### 7.3 分层主页（社交呈现）
- 联系人列表 **点头像 → 角色主页**（接近现实社交软件的个人页：大头像、名字、状态、关系、仅展示人设里可公开的简要项）。
- **人设 → 二级页**：从主页进入，才见/编辑全量人设字段（identity/values/…）。**不把全量人设平铺在主页。**

### 7.4 闭环 & 同步预期
- 档案室改卡：**不**自动改动已在聊天导入的联系人副本（各自维护，文件握手即「快照式同步」）。
- 想更新联系人：重新导出 → 聊天侧导入覆盖（或按 per-contact 更新按钮，细节实现时定）。
- 导入的联系人一旦被选为当前对话角色，其副本进入 `requestAssistant` 的编译输入（对齐 §3「角色档案从 archive.v1 或联系人副本读」——实测谁存储谁供给）。

### 7.5 验收动作（实现完成后，用你构思的角色做）
1. 档案室创作/导入一张角色卡 → 导出 JSON ✅
2. 聊天联系人页 ➕ 导入该 JSON → 出现新联系人 ✅
3. 点头像 → 角色主页（呈现场景，非编辑页）✅
4. 主页进入人设二级页 → 全量字段可读/可编辑 ✅
5. 用该联系人开一对话 → 角色人设进编译输入（chats 侧供数）✅

---

## 8. 安全与防抄袭备忘（阅后即焚）

- 本项目**不引入任何第三方角色卡原文**。角色卡/世界书素材均由用户自己提供或在本应用内创建/导入。
- 若参考外部作品：**只借鉴抽象的框架**（字段组织、关系深度分级、交互流程），**不出现专有名词、角色名、设定名、相似剧情与桥段**。参考后不留原文副本，随看随弃。
- 本文件仅描述框架与目标，不含任何受版权保护的角色内容。

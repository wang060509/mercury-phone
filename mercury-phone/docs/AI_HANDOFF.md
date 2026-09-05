# Mercury Phone 架构交接

更新日期：2026-09-06。新接手者应先阅读 `README_AI.md`、`PROJECT_STATE.md` 与根目录 `CONTEXT.md`，再看这里。

Generation Profile UI 接手前必须继续阅读 `GENERATION_PROFILE_UI_HANDOFF.md`。该文件记录 UI-01 已确认基线、已否决方向与下一阶段硬边界。

Cinema 或 Customization 接手前必须阅读 `../CINEMA_ALPHA_BASELINE.md`。Cinema Closure 与 Final Safe Cleanup 已冻结，不得重新设计或重做 Phase 2D、Intermission、Credits、History 或 Programme Archive；新工作从 Customization 模式审计开始，尚未授权实现。

API、Provider、连接设置或真实生成链路接手前必须继续阅读 `API_PROVIDER_HANDOFF_2026-08-18.md`。该文件记录 `/models` 假阳性事故、统一 adapter 边界、真实回归证据和“Reference Before Reinvention”纪律。

## 产品

Mercury 正在成为一部可本地保存数据的角色聊天手机。重点不是堆叠聊天装饰，而是让角色档案、会话实例、世界书、玩法预设和确认后的关系事件以可追溯方式进入一次真实聊天请求。

## 当前架构

```text
浏览器系统壳
  ├─ 应用引擎：Chat / Archive / Settings
  ├─ Use Cases：无 DOM 的产品流程与合法状态转换
  ├─ Local Data Vault：数据源清单、健康/易失模式与脱敏备份
  ├─ localStorage：应用私有与共享状态
  ├─ IndexedDB：派生的事件检索索引
  └─ Chat controller
       ├─ Conversation Store：兼容键、迁移、持久化与损坏恢复
       ├─ Chat Generation Workflow：发送、取消、失败、重试与非破坏式重新生成
       ├─ Conversation Transfer：portable/text 导出、预检、新 timeline 与跨 storage 回滚
       ├─ 会话 hydration、用户意图与消息呈现
       ├─ 资源绑定与运行时装配
       ├─ 事件检索
       └─ AITransport
            └─ 同源 Relay Interface
                 ├─ 开发：本地 Node Adapter
                 └─ 生产目标：Stateless Relay Adapter（未实现）
                      └─ 兼容聊天服务
```

### 关键路径

1. 档案馆预检并确认本地资源，保存来源资产与规范化的角色/世界数据；生成档案写入共享 `generation-profiles.v1`。
2. 聊天创建或绑定联系人与运行时角色档案，并为当前联系人、世界变体、时间线保持会话资源绑定。
3. 用户发送需要真实生成的消息时，Chat Generation Workflow 先通过 production Adapter 同步检查当前标签页的 Connection Readiness；失败则保留草稿且不写消息，通过后才持久化用户 turn、召回受限长期事件并调用 `buildRuntimeInput()`。
4. `compileRuntime()` 组装核心规则、Generation Profile、角色档案、世界、场景、事件和会话体验，得到 `compiledSystemText`；用户可导入的 Profile/角色先经过 16000/12000 字符有序准入，世界书与事件沿用 8/5000、Top-3/560，实际入场量写入不含正文的 `resourceTrace.assembly`。
5. AITransport 从本地连接设置读取地址、模型和凭据，经同源 `/api/*` Relay Interface 请求上游，返回结构化 AssistantTurn 与可选关系记录候选；当前由本地 Node Adapter 承接，生产 Stateless Relay 尚未实现。
6. Workflow 在每次异步返回后验证 request 与会话 scope，经 Conversation Store 保存回复、处理失败/取消/重试/重新生成；Chat controller 渲染状态并让用户确认或保留关系事件。

## 已实现的设计决定

| 决定 | 当前实现 |
| --- | --- |
| 角色资产与联系人实例分开 | `archive.v1.runtimeProfiles` 与 `contactInstances`，聊天体验另存联系人资料 |
| 会话资源绑定 | `chat-experience.v1` 的 `resourceBindings` 含角色、世界书模式/ID、世界变体与预设 ID |
| Generation Profile 与呈现设置分开 | `userPresetId/presetId` 暂为会话引用；Profile 在共享 `generation-profiles.v1`；气泡等外观不写入 Profile |
| Archive 管理、Chat 消费 | Archive 是 Profile 的唯一管理入口；Chat 只显示当前会话摘要、单一选择列表与“在档案馆管理”跳转 |
| 旧预设只读迁移 | Chat 私有 UserPreset 与 `archive.v1.promptModules` 不再写入；独立来源聚合为 Profile，混合内容成为 Instruction Blocks |
| 世界书按需检索 | 导入保留世界/条目 scope 与 visibility；运行时先按会话绑定、世界变体、时间线和角色授权筛选，再由关键词/常驻/历史和预算选择进入 runtime |
| 输出模式分离 | AssistantTurn 支持多气泡与未说出口的内容，后者不作为普通可见正文 |
| 关系记忆受控 | 关系记录为证据源，长期事件要用户选择 durable，索引可删除并重建 |
| 多 scope 事件隔离 | 事件索引合同强制联系人、世界变体、时间线三维 scope |
| 模型抽象 | UI 不绑定某一家聊天模型；relay 使用兼容 `chat/completions` 与 `models` 端点 |
| API Key 会话边界 | 默认写入当前标签页 session credential store，Chat 与连接测试共用；只有明确开启“记住 API Key”才写长期 storage |
| API 连接判定 | `/models` 只做可选发现；Settings 通过 AITransport 调用当前模型的最小真实生成，Chat/角色分析/Cinema/测试共用 `server/provider-adapter.js`；Cinema 只消费 `generateCinema()` 高层 Interface |
| Relay 凭据防泄漏 | 只检查请求对象中的凭据形状字段名，不扫描角色、世界书、记忆、消息或 Profile 正文 |
| Web/PWA 主交付 | 用户通过 HTTPS 链接打开并可安装到手机主屏；数据留在浏览器，用户自带 AI Connection，生产请求走同源 Stateless Relay；账户/同步与原生双核心不随上线引入 |
| Generation Profile 流程 ownership | `app/use-cases/generation-profile-flow.js` 管 Cabinet / Detail 转换、overlay、cover draft、只读检查与失败恢复；Archive controller 负责 DOM |
| 会话持久化 ownership | `app/system/conversation-store.js` 管 key、V1→V2 规范化写回、损坏回退与读写错误分类；Chat controller 不再直接读取会话 storage |
| Chat 生成生命周期 ownership | `app/use-cases/chat-generation-workflow.js` 通过 `start(command) / cancel() / snapshot()` 管同步 Connection Readiness、单飞、request id、Abort、迟到响应隔离、用户 delivery、助手提交与非破坏式重新生成；controller 只提供 Adapter 与 UI |
| 资源导入事务 ownership | `app/use-cases/resource-intake-workflow.js` 通过 `inspect(input) / commit(stage, options)` 管预检交接、重复 ID、Archive/Profile/Chat 写入顺序与补偿回滚；Archive/Chat controller 只负责文件、审核、目的地和导航 |
| 会话传输 ownership | `app/core/conversation-transfer-contracts.js` 管 portable JSON / readable text 合同、完整预检和瞬态归一化；`app/use-cases/conversation-transfer-workflow.js` 通过 `export / inspect / commit` 管新 timeline、目标联系人重绑定、可用资源交集与 Chat 私有/shared storage 补偿回滚 |
| 会话导入冲突与降级 | timeline 分配同时检查 Chat 私有正文键和 shared 会话键；Chat 在目标会话显示独立导入回执，缺失世界书/Profile 与角色重绑定不会静默发生，并可进入资源检查 |
| 本地数据治理 ownership | `app/system/local-data-vault.js` 通过 `snapshot() / createBackup()` 管数据清单、健康/易失模式、配额与备份规则；Settings 只消费 facade，secret/派生/未知数据不越过备份 Seam |
| App 生命周期参数 | `render(root, context, payload)`；其余生命周期统一 `(context, payload)`，Archive resume 深链路与 App Engine 测试已对齐 |
| App 启动/loading ownership | `app/system/app-loader.js` 管资源顺序、并发去重、失败重试、definition 注册前校验与最新启动意图；App Engine 仍独占实例/lifecycle，state machine 仍独占前台转换 |

## 尚未完全落地的设计决定

- Generation Profile UI：UI-01 Record Cabinet 已完成 1:1 sleeve、独立圆形唱片、来源书架、专用新建/导入入口、长按管理与抽取过渡，自动/浏览器 QA 已通过，并于 2026-08-18 获用户视觉确认。UI-02 正式 Profile Detail 已替换旧表单并接入现有 workflow，自动/手机截图 QA 已通过，并于 2026-08-19 获用户视觉确认；Pressing Room、Tracklist / Workbench 与 Playback 尚未实现。
- 外部预设兼容：导入已按结构与能力识别常见 prompt collection、message list、instruction block、简单指令字段和参数型 JSON，不依赖文件名或单一样例。纯文本变量适配层只解释启用块中的 `set/get var` 和 Chat 明确提供的 `user`、`char`、`newline`；不执行脚本、状态命令、禁用块或未知宏。当前真实档案为 32 项运行、47 个变量已适配、6 个模板项待处理、33 项保留，因此仍为“部分接入”。
- Generation Profile inheritance：最终为 Global → Contact → Session（Session > Contact > Global），当前只有既有 session-level binding。
- Generation Profile 的 provider-agnostic Model Parameters 与 Advanced user instruction blocks 尚未实现；Provider、Model、API URL、API Key 仍归 Settings。
- 多世界变体的完整会话产品流程、可见性语义和隔离验收。
- 语义模型的真实下载、持久化、升级和质量基准验收。
- Web/PWA 的 manifest、Service Worker 安装/更新合同、HTTPS 托管、生产 Stateless Relay、凭据/滥用保护和真实 `/api/*` 连通性；交付方向已经确认，不再等待“网页还是安装包”的选择。当前本地数据方案不包含账户或同步。脱敏备份导出已实现，但全局 restore/clear 仍等待事务与回滚合同。
- API 架构审计确认的 API-01 已解决：Cinema 改用 `generateCinema()`，credential resolution 与 relay POST 已降为 AITransport 私有 Implementation，四条高层操作均有预取消 0 fetch 合同。剩余生产 P1 是 Provider URL 只做字面主机拦截、上游响应上限在完整缓冲后才检查，以及生产部署 Adapter 的滥用/日志策略；下一步进入 API-02，不先扩张 Provider/参数 UI。
- 角色版本化、世界书权限策略、主题包及主题发布流程。

## 开发规则

- 先读相关测试和当前源码，再决定是否需要改契约。
- 资源导入只能在边界识别并翻译；内部数据、UI 文案、文件名和运行时文本必须是 Mercury 自己的。
- 角色、世界、预设、外观、关系记录和事件索引不能相互越权。
- 任何“已生效”状态必须能在 `buildRuntimeInput()`、请求对象或测试中追到；否则显示为已保留或暂未接入。
- 连接设置不能只验 `/models` 或 Settings 的视觉状态；必须同时验当前模型的真实 Test Message 与至少一个 Chat/角色分析消费者。Settings 不得绕开 AITransport 自建请求；关闭长期记忆时，Key 仍须在当前标签页会话内可用。新标签页没有 session Key 是预期边界，Chat 必须在落库前显示可恢复错误并提供 AI 连接深链路，不能静默失败或跨标签页复制凭据。
- 安全校验必须按数据结构与字段边界判断；禁止对完整 prompt/JSON 值做 `secret`、`credential`、`authorization` 等宽泛关键词拦截。
- 对 UI 改动先做设计阅读，沿用现有图标体系和手机安全边距；不破坏已工作的发送、滚动、导航与本地保存行为。
- 未经明确需求，不重构整个 IIFE 架构、不更换依赖、不迁移存储键。
- 参考项目只可用于抽象结构学习；不得复制代码、命名、字段、文案、资产或独特交互。

## 安全继续路径

1. Chat、Archive 与 Cinema Alpha 主线均已冻结。Batch A 与 Final Safe Cleanup 完成，最新 `release:check` 为 86 files / 3052 assertions / 0 failures；`dist/` 为 162 files / 22.61 MiB。Cinema production cold-open 为 64 requests，source module seams 保持不变。私有 recovery baseline 与清理后 checkpoint 均已建立；不要继续清理或自动开始 Customization 实现。
2. Chat 的 Profile 消费入口已收口为紧凑单列表；完整管理继续归 Archive，不要把导入/编辑操作重新塞回 Chat，也不要让 controller 重新拥有生成请求状态机。
3. 下一产品阶段是 Customization，但必须先做成熟同类产品研究、明确资产/override/default/recovery 边界，并沿用“生成视觉 reference → 390x844 原型/production reconstruction → 逐屏 Gate”的方法。不要把旧 UI-03 候选或 Closure 页面当作当前授权。
4. 外部预设兼容已有通用识别与安全适配闭环；扩大装配后的 32 个运行块已通过三条真实 API 质量回归。下一步分类剩余 6 个模板项与 33 个保留项；只有能映射到 Mercury 现有合同的语义才可进入运行时，不得引入脚本执行器、按样例特判或平行 prompt lane。
5. Local Data Vault 已把数据源清单、易失诊断与脱敏导出闭环；Resource Intake 已把单资源导入事务收口；Chat portable export/import 对也已完成，但不等于全局恢复。全局 restore 仍必须另建格式预检、分域事务、受保护键、回滚与 reload 合同。Release Module 继续维护 `release:check`；公开链接按已确认的 Web/PWA + Stateless Relay 边界补 HTTPS、安装/更新、生产安全与真实 `/api/*` 连通性。

## 恢复开发第一小时

1. 在仓库根目录运行 `npm --prefix mercury-phone ci`。
2. 运行 `npm run release:check`，任何失败先作为环境或基线异常处理，不带病施工。
3. 依次阅读 `mercury-phone/docs/PROJECT_STATE.md`、`mercury-phone/CINEMA_ALPHA_BASELINE.md`、`mercury-phone/docs/KNOWN_ISSUES.md` 与 `mercury-phone/docs/NEXT_STEPS.md`。
4. 不重新打开 Phase 2D、Cinema Closure 或已冻结的视觉方向。
5. 当前只开始 **Customization Pattern Audit — no implementation yet**：先研究成熟产品的 Character authoring、World authoring、Visual customization、Performance-level customization 模式，再冻结 Mercury 的 domain/authority 边界。

## Generation Profile UI 禁区

- 不恢复普通 Card Grid、纵向长条 Cover、Card + 半圆唱片装饰或 Cover 悬浮省略号。
- 不使用审核语义，不把私人本地资产描述为等待人工审核。
- 不把玩法维度全部做成 slider，也不沿用普通表单作为 Remix / Detail / Pressing Room 主界面。
- 唱片是 Archive asset metaphor，不是音乐播放器；禁止 EQ、音量旋钮、时间轴、DJ console 或 Neon music UI。
- 下一版沿用已获认可的 World Book Archive design system：Shelf、Hero、Index、Linked/Runtime/Updated 信息、水银玻璃、冷蓝和 editorial typography。

## 危险区域

- `app/core/chat-contracts.js` 与 `app/core/runtime-core.js`：改变编译顺序或输出协议会直接影响模型行为。
- `app/apps/mercury-chat-app.js`：一个控制器承载会话、导入、运行时、记忆和大量页面；修改时必须限定到目标路径并补测试。
- `app/core/chat-experience-contracts.js`：迁移/默认值会影响既有本地用户数据。
- `app/core/vector-memory-contracts.js` 与 `app/system/vector-memory-store.js`：scope、生命周期和可重建边界不能被弱化。
- `app/system/local-data-vault.js` 与 `app/system/system-services.js`：清单、脱敏、secret/派生排除和 persistent/volatile 判定是数据安全 Interface；新增 storage key 必须同步审计 catalog。
- `server/provider-adapter.js`、`server/upstream-client.js` 与 `server/server-contracts.js`：涉及唯一 provider 协议边界、用户凭据、上游地址验证、超时和错误脱敏。
- `app/index.html`：脚本加载顺序是实际模块依赖图，不可随意排序或删减。

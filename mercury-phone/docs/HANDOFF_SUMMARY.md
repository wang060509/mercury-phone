# Mercury Phone 交接摘要

更新日期：2026-08-20。

## Mercury 是什么？

一个本地优先的角色聊天手机原型。它将角色、世界、玩法、会话与关系事件分开管理，并在真实聊天请求前进行受控装配。

## 已经工作什么？

- 手机系统壳、Chat、Archive、Settings 和本地演示入口。
- 角色卡、世界书和兼容生成资源的预检、导入、迁移与部分导出；Generation Profile 不使用审核语义。
- 联系人与角色档案、会话与预设/世界书的绑定。
- 运行时组装：核心规则、角色、世界条目、预设、场景、会话体验和事件记忆。
- 非流式真实聊天中转、取消、失败、重试、重新生成、消息版本和关系记录候选。
- 关键词事件检索与可选本地语义检索基础设施。
- Generation Profile Checkpoint 1：唯一共享事实源、旧来源只读迁移、Built-in 永久只读隔离与 Chat Runtime 接线。
- Record Cabinet UI-01：三来源书架、1:1 sleeve + 独立唱片、内置只读/Remix、长按管理、抽取过渡和本地 Cover 流程；自动与浏览器 QA 已通过，并于 2026-08-18 获用户视觉确认。
- Generation Profile UI-02：独立 use-case flow 已接管 Cabinet / Detail 合法转换、操作菜单、封面 preview/confirm/cancel、只读保护、reload 修复与存储失败草稿保留；正式只读 Detail 已替换旧表单，自动与手机截图 QA 已通过，并于 2026-08-19 获用户视觉确认。
- Chat Profile 消费入口已收口为当前会话摘要、单一选择列表和 Archive 管理跳转。
- 架构审计首个切片：`MercuryConversationStore` 已接管兼容键、会话迁移写回、损坏回退和写错误分类；Archive resume 深链路已与 App Engine 的 `(context, payload)` 合同对齐。
- Chat Generation Workflow：`start(command) / cancel() / snapshot()` 已统一发送、重试、取消、失败和非破坏式重新生成；controller 只提供运行时/存储 Adapter、翻译意图和渲染状态。
- Chat Connection Readiness：需要真实生成的 send/retry/regenerate 在任何会话写入前同步检查当前标签页连接；配置失败保留草稿或原失败 turn，页内显示安全原因、“前往 AI 连接”和可见重试，不复制跨标签页 Key。
- Resource Intake Workflow：`inspect(input) / commit(stage, options)` 已统一 Archive 与 Chat 的资源预检交接、重复 ID、Archive/Profile/Chat 写入顺序和补偿回滚；Chat 角色导入不再维护第二套持久化实现。
- AppLoader：Home 与跨 App 启动统一经过 `launch/snapshot/subscribe`；Archive CSS/JS 已移出首屏，失败不注册且再次点击可重试，latest-intent-wins 防止慢加载 App 覆盖后来启动，AppEngine lifecycle 未改变。
- 角色导入连续性：commit outcome 现在驱动不自动消失的成功回执；联系人选择页置顶/高亮刚导入角色，重名按 SourceAsset 文件来源及同源“副本 N”区分。元数据型首条不会伪装成剧情，安全备选继续可选；无可用开场可直接进入 0 消息空白会话。
- Chat Conversation Transfer：portable JSON 与只读文本已分流；`export / inspect / commit` 统一 ConversationV2 预检、稳定状态归一化、新 timeline、目标联系人/可用资源重绑定，以及 Chat 私有正文与 shared 会话状态的跨 Adapter 回滚。
- 聊天纵向闭环矩阵：自有 fixtures 已贯通角色/世界/Profile 导入、绑定、request/trace 装配、可控生成、会话保存、portable 导出/回导与 fresh reload。timeline 冲突同时检查私有正文和 shared session；导入回执会明确缺失资源/default fallback 与角色重绑定。
- 运行时资源准入矩阵：实际 `buildAssistantRequest()` 已覆盖角色、世界书、Generation Profile 与事件记忆的正向、禁用/仅保留、越 scope、预算与 memory disabled。`compileRuntime()` 对 Profile/角色实行 16000/12000 字符有序准入，世界/事件沿用 8/5000、Top-3/560；统一 assembly trace 不保存正文。
- Local Data Vault：`snapshot() / createBackup()` 已统一 Mercury 数据源清单、持久/易失状态、写探针、配额、备份包含/脱敏/排除和未知键报警；Settings 的“数据与隐私”已有真实诊断与备份下载闭环。
- Release checkpoint：`build:production`、`audit:production`、`release:check` 与双级体积预算已接通；未引用的 37.65 MiB 本地字体不再进入发布产物，源码资产未删除。
- 外部 Profile 已按结构与能力贯通通用识别、Store、Instruction Blocks、兼容升级与原 `userPreset` 槽；当前真实样例为 32 项运行、47 个变量已适配、6 个模板项待处理、33 个保留项，继续显示为“部分接入”。

## 当前 Checkpoint

- Generation Profile Checkpoint 1 已完成，可直接作为下一位 agent 的数据与 Runtime 基线。
- UI Checkpoint 尚未全部完成；UI-01 与 UI-02 已完成实现、自动/手机截图 QA 和用户视觉确认，UI-03、UI-04 与 Playback 仍未开始。
- 最新门禁为 64 files / 1974 assertions / 0 failures / 0 skipped，生产审计通过。当前 `dist/` 是 155 files / 20.74 MiB；eager local entrypoint 为 62 requests、981.1 KiB raw、239.7 KiB gzip、198.2 KiB Brotli。硬预算通过，output-size 与 request-count warning 保留。真实浏览器确认 Chat、Runtime Verification 会话与资源设置页正常，0 console warnings/errors；既有首屏 lazy、真实资源导入、会话绑定、刷新、portable 聊天导出/回导和本地资源恢复证据继续有效。2026-08-19 的 Settings Test、真实资源 Chat 与三条 Profile API 质量回归仍是最新真实模型成功证据，本轮没有重发真实模型请求。当前仍有 6 个模板项待处理、33 项保留，因此 Profile 状态继续为“部分接入”。
- API 事故与修复详见 `API_PROVIDER_HANDOFF_2026-08-18.md`。后续基础设施工作必须执行“Reference Before Reinvention”：先审计成熟项目的结构原则和失败模式、补合同测试，再实现 Mercury 自有 adapter；不得复制代码、UI、资产、文案或私有字段。
- Web/PWA 已确认为主要交付形态：HTTPS 链接打开、可安装到手机主屏、业务数据留在浏览器、用户自带 AI Connection、生产请求经同源 Stateless Relay。账户、云数据库、同步和原生双核心不随上线进入范围；PWA 壳与生产 relay 仍未实现。
- 2026-08-20 API 架构审计结论：当前 OpenAI-compatible 广度简单，但 Chat 主链的真实 Test、会话凭据、超时/取消、错误分类/脱敏和失败恢复并不简陋。API-01 已完成：Cinema 不再调用 `readCredential/postLocal`，AITransport 只暴露 readiness 与四项业务能力，并覆盖预取消 0 fetch。上线前剩余 P1 是把 Provider 网络安全从字面主机检查深化到 DNS/IP/流式响应上限，并由生产 Adapter 承担滥用保护；不是先增加原生 Anthropic/Gemini、自动主备、流式或参数面板。

## 还未完成什么？

- UI-01 Record Cabinet 与 UI-02 Profile Detail 均已完成用户视觉确认；Pressing Room、Tracklist / Workbench 与 Playback 尚未开始。
- 剩余 6 个模板项与 33 个保留项的逐类兼容判断；扩大装配后的外部 Profile API 输出回归已经完成。不得执行任意脚本或建立平行 prompt lane。
- Global → Contact → Session inheritance、高级 Model Parameters 和 Advanced user instruction blocks。
- 本地语义模型真实设备与角色体验验收。
- 公开托管、HTTPS、安全 relay、凭据保护与真实生产连通性；构建产物同步已经完成。账户/同步不在当前链接式本地数据方案内。
- 主题包、角色版本化与大型扩展应用。

## 五项最重要约束

1. 导入只在边界识别，内部格式必须是 Mercury 自己的。
2. 角色、世界、预设、呈现和记忆彼此分层，不能互相越权。
3. 长期记忆是用户确认的事件，不是完整聊天记录；所有事件操作带三维 scope。
4. 只宣传真实接入的能力；静态资源和未接入模块不能被称为已影响模型。
5. 隔离参考目录不可公开，且不得复制其代码、命名、字段、文案、资产或交互。

## 下一步做什么？

先阅读 `architecture.md`、`reference-architecture-review.md`、根目录 `CONTEXT.md` 和 `NEXT_STEPS.md`。API 对照审计与 API-01 AITransport Interface 收口已完成，按 API-02 Provider Network Policy → API-03 生产部署 Adapter → PWA-01 安装/更新的顺序继续；每步先补合同测试。第二个 lazy slice 暂缓，Settings 保持 eager。全局 restore 不得借用窄补偿事务直接开放；UI-01/UI-02 继续作为已确认视觉基线，只有用户明确恢复 UI 主线才从 UI-03 开始。

## 不要碰什么？

不要随意改 `compileRuntime()`、runtime core、聊天体验存储、事件 scope、provider adapter/relay 上游地址检查、`index.html` 脚本顺序；不要让 Chat 绕开 `MercuryConversationStore`、Settings 绕开 AITransport/Local Data Vault，或用 `/models` 成功代替真实生成；不要把 API Key、设备密码、派生索引或未知键加入备份，也不要在无回滚时实现全局恢复；不要回退到旧 promptModules / Chat-owned preset Store；不要启动 Pressing Room、Workbench、inheritance、Model Parameters、群聊、语音、钱包、主题市场或同步服务。

## 首先读哪些文件？

`docs/README_AI.md`、`docs/PROJECT_STATE.md`、`docs/AI_HANDOFF.md`、`docs/HANDOFF_2026-08-20.md`、`CONTEXT.md`、`docs/GENERATION_PROFILE_UI_HANDOFF.md`、`docs/DECISIONS.md`、`docs/KNOWN_ISSUES.md`、`docs/NEXT_STEPS.md`，然后根据任务阅读相关源码与测试。

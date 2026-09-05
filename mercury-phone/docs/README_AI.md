# Mercury Phone AI Entry Point

更新日期：2026-09-06。本文是新接手者的入口，不替代源码。

请按此顺序阅读：

1. [PROJECT_STATE.md](PROJECT_STATE.md)
2. [AI_HANDOFF.md](AI_HANDOFF.md)
3. [../CINEMA_ALPHA_BASELINE.md](../CINEMA_ALPHA_BASELINE.md)
4. [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
5. [NEXT_STEPS.md](NEXT_STEPS.md)
6. [DECISIONS.md](DECISIONS.md)
7. [HANDOFF_2026-08-20.md](HANDOFF_2026-08-20.md)（历史背景，不是当前状态）
8. [../CONTEXT.md](../CONTEXT.md)
9. 与本次任务有关的源码与测试。

规则：

- 当前代码和测试优先于任何旧文档或对话记录。
- 先确认范围，再改数据模型、运行时或 UI；不要把计划当成已实现功能。
- 不复制隔离参考目录中的代码、命名、字段、文案、资产或交互；公开交付前必须移除整个隔离目录并完成名称清查。
- 只显示和宣传真实接入的功能。未接入项目应禁用或不显示，不能伪装为已生效。
- 每个聊天相关改动先核对成熟小手机项目的抽象结构，再以 Mercury 自己的命名、数据模型和 UI 重做。

当前 Alpha 已闭合 Chat、Archive 与 Cinema 主线。Cinema 生命周期已贯通 Home、Programme、准备、Reading、Intermission、Ending、Credits、完整 History 与 Programme Archive Index；不需要新增 Closure 页面或语义。Batch A 工程加固已完成：Cinema production 合包、Playwright 纳入依赖和 `release:check`、Chat→Archive 写入 ownership、Draft 持久化合并、可复现字体构建与第三方许可均已落地。最新完整门禁为 86 files / 3055 assertions / 0 failures，`dist/` 为 169 files / 22.63 MiB；shell 为 62 requests / 201.1 KiB Brotli，Cinema cold-open 为 64 requests / 284.0 KiB Brotli，硬预算通过且三项 warning 保留。当前工作顺序是：私有 GitHub recovery baseline → 安全清理 → Customization 研究/设计与逐 Gate 实施。不要重新打开 Phase 2D 或 Cinema Closure，不要把旧任务地图中的 API/UI 候选误当作当前授权。

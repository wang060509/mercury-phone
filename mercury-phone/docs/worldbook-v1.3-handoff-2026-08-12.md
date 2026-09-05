# Mercury WorldBook v1.3 交接：概览、目录与封面

## 本轮范围

在既有档案馆与 WorldBook v1.2 书架之上，补齐「点开一本世界书」后的正式使用主链路。实现遵循现有冰蓝水银玻璃与 editorial magazine 语言，没有新增独立产品或普通 CRUD 页面。

## 用户可见闭环

1. 从世界书架点击正式 WorldBook Card，进入世界书概览页。
2. 概览页展示编号、名称、摘要、实际封面、条目数、关联角色数、启用条目数、关联角色和更新时间。
3. 点击 `OPEN INDEX` 进入目录页；点击目录页返回键回到概览。
4. 目录支持本地搜索与「全部 / 常驻 / 触发 / 禁用」筛选。
5. 每个条目保留标题、摘要、触发类型和启用开关；开关会即时写回对应世界书条目。
6. `NEW ENTRY` 打开既有的统一条目编辑器，保存后回到同一本世界书目录。
7. 概览右上角省略号提供「编辑知识书 / 更换世界书封面 / 复制并编辑 / 收藏」。
8. 「更换世界书封面」只从右上角省略号进入，选择封面会立即保存并回到概览；取消不会改动资源。

## 数据与边界

- `createWorldEntry()` 现在显式保存 `enabled`，默认 `true`。目录开关使用同一字段，不创建展示层副本。
- 世界书仍是本地可管理资源；不宣称已自动注入聊天请求或 AI 上下文。
- Cinema AU / 平行世界剧本仍是独立资源域，不会被普通 WorldBook 的目录、卡片或检索流程误分类。
- 目录的空状态来自真实数据。当前浏览器本地只有一份零条目的测试世界书，因此没有为了视觉效果伪造条目行。

## 主要文件

- `app/apps/archive-app.js`：概览路由、目录路由、右上角菜单、封面选择层、条目筛选与启用开关。
- `app/core/archive-contracts.js`：WorldBook 条目的 `enabled` 持久化默认值。
- `app/styles/archive-app.css`：概览、目录、封面选择层与条目编辑补充样式。
- `app/tests/archive-app.test.js`、`app/tests/archive-contracts.test.js`、`app/tests/archive-css-structure.test.js`：路由、条目状态与 CSS 结构回归。

## 验证记录

- 自动化：`npm test` 通过，33 个测试文件、966 条断言、0 失败。
- 浏览器：概览打开、右上角更多菜单、封面选择层 7 个候选、取消返回、目录打开、空状态和新建条目入口均已走通。
- 控制台：`error` / `warn` 为 0。
- 视觉 QA：
  - `artifacts/worldbook-v1.3-qa/worldbook-overview-comparison.png`
  - `artifacts/worldbook-v1.3-qa/worldbook-index-comparison.png`

## 下一步建议

在角色资源与世界书内容方案确认后，再定义运行时检索和聊天请求注入的可测试契约。该阶段需要明确触发优先级、条目预算、角色关联、请求可观测性与失败降级，避免把静态资源管理误标成已生效的 AI 能力。

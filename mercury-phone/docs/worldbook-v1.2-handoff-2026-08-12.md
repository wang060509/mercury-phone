# Mercury 世界书 v1.2 交接

## 本轮交付

- 档案馆的“世界书”成为独立的二维书架式资源页：搜索、全部/最近使用/已关联/未关联/收藏筛选与更新时间、最近使用、条目数、关联角色数排序均可使用。
- 书架仅是可无限向下扩展的 CSS Grid + Shelf Section 视觉隐喻；数据增长到几十本时仍按普通文档流纵向滚动。
- 新建、编辑、单一世界书 JSON 导入、复制统一进入 `WorldBook Editor`。新建只保存编辑器内存草稿，点击创建后才写入档案并显示为正式卡片；取消不会产生临时卡。
- 世界书资源包含 `resourceKind: "knowledge-book"`、封面键、标题、摘要、知识范围、条目、标签、关联角色、收藏、创建/更新/最近打开时间等显示层所需数据；卡片只消费数据，不承担存储。
- 普通世界书的 UI 统一使用“知识 / 补充 / 条目”用语。`cinema-au` / `parallel-world-script` 导入会被排除在普通世界书分类外，等待 Cinema 独立资源域接入。
- 新增原创封面资产：`app/assets/archive/worldbook-quill-v1.png`、`worldbook-knowledge-v1.png`、`worldbook-dialogue-v1.png`。

## 关键文件

- `app/core/archive-contracts.js`：世界书数据、复制、打开时间、更新时间、Cinema AU 分类保护。
- `app/apps/archive-app.js`：书架、筛选/排序、统一编辑器、编辑中输入保留。
- `app/styles/archive-app.css`：冰蓝水银玻璃书架与编辑器样式。
- `app/tests/archive-contracts.test.js`、`app/tests/archive-app.test.js`、`app/tests/archive-css-structure.test.js`：契约、路由、空筛选态和结构回归。

## 验收

- `npm test`：33 个测试文件、961 条断言、0 失败。
- 浏览器：书架、筛选空态、新建草稿、封面切换、知识条目保存、取消回退均已走通；console 无 error/warn。
- 视觉对照：`artifacts/worldbook-v1.2-qa/worldbook-shelf-comparison.png`；最终书架：`artifacts/worldbook-v1.2-qa/worldbook-shelf-final.jpg`。

## 后置边界

- 世界书目前是可管理、可导入、可关联的资源，并未自动注入聊天请求。
- 运行时检索、条目触发、角色关系的深度编译、世界书与预设的优先级仍需在聊天运行时接入阶段实现；不要在 UI 中标记为已生效。

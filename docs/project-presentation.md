# 项目展示与栏目置顶

## 数据与编辑

- 项目继续使用原有中文内容及 Markdown 正文。项目正文承担产品概览、设计思路、技术实现和进展说明。
- `metadata.projectModules` 保存模块名称、说明、功能要点，最多 24 个模块，每个最多 15 条功能。后台项目编辑页可维护。
- `metadata.projectScreenshots` 保存已上传图片的媒体 ID 与说明，最多 20 张；顺序按数组顺序展示。后台支持上传与移除。
- 没有模块或截图时显示对应空状态，不补虚构内容；项目封面与真实截图分开保存。
- 截图纳入 `revision_media`，采用现有图片权限规则：草稿图片不公开，发布后可读取，归档后收回公开读取权限。
- 项目模块参与全站项目搜索。

## 置顶

- `004_content_pins.sql` 新增置顶关系表，项目、博客、手记各一条。内容本身与中英文翻译共用置顶状态。
- 管理员在内容列表点击“置顶”或“取消置顶”，通过 `PUT /api/admin/content/:id/pin` 写入 `{ pinned: boolean }`。
- 新置顶替换同栏目的旧置顶。取消旧条目不会误取消另一条新置顶。
- 仅已发布且未归档的内容可被置顶。保存草稿不会隐式发布内容，置顶也不会发布草稿。
- 公开列表、标签结果、搜索和导航预览按置顶优先，其余内容仍按发布时间排序；筛选和分页在服务端完成。
- `metadata.flagship` 只控制“主打项目”标记，与通用置顶独立。

## 本次真实内容

- PicAgent 根据本地客户端、服务端源代码整理成 13 个模块。未读取 PicAgent README。
- 源码路径与 SHA-256 记录在 `docs/projects/picagent-source-evidence.json`。
- 封面原图：`docs/projects/covers/picagent.png`；由本次图像生成工具创作，上传到站点媒体库。
- 真实截图暂为空。
- 项目数据：`docs/projects/picagent.json`；概览正文：`docs/projects/picagent.md`。
- 关于页：`database/about-profile.mjs`，中英文资料按作者提供的信息编写。仅更新关于正文和本次相关文案；原值备份在 `.runtime/about-profile/`。

## 验证入口

- `nuxt typecheck` 与 `nuxt build`。
- `scripts/check-integration.mjs` 使用独立 `onion_test`，包含各类置顶、语言切换、替换取消、草稿隔离、鉴权、模块搜索及截图公开权限用例。
- 浏览器检查实际本地数据库内容，覆盖项目首屏、功能模块、截图空状态、关于页及桌面/手机、中英文界面和深浅色主题。

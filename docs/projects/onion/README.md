# 洋葱小站项目截图

这些 PNG 是 2026-09-28 从本地运行的小站浏览器直接截取的真实页面，保留原图，没有绘制或拼接界面。`home.png` 同时用作项目封面，其余说明与展示顺序见 `screenshots.json`。

后台截图只包含已经发布的内容和管理控件，不包含登录凭据或站点私密设置。

项目初次创建使用 `node --env-file=.env scripts/publish-onion-project.mjs`，再运行 `node --env-file=.env scripts/publish-onion-screenshots.mjs` 上传并关联截图。脚本仅允许当前本地 Onion 数据库，保留正文和其他项目设置，发现未发布修改时会停止。

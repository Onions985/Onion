# PicAgent 架构与需求设计文章

2026-09-22 整理，共 12 篇，补充原有 10 篇文章。正文来自锁定的 PicAgent 历史提交，涵盖技术架构、数据一致性、共享层、需求设计与产品思考。未修改 PicAgent 源码或连接其数据库。

- `manifest.json`：标题、摘要、标签、文章文件和源码依据。
- `source-evidence.json`：导入时验证的完整提交 SHA、原提交时间、源码与正文 SHA-256。
- 文章归档日期取主来源提交的当地自然日；正文注明实际整理时间，数据库创建时间保持真实入库时间。
- 作者使用 Onion `.env` 中配置的现有管理员 ID；前台署名为数据库站点资料中的 Onion。没有英文正文时沿用网站中文回退。
- 本目录用于编辑与追溯；网站内容实际读取本地 MySQL。

```sh
node --env-file=.env scripts/import-article-batch.mjs --batch=picagent-architecture --check
node --env-file=.env scripts/import-article-batch.mjs --batch=picagent-architecture --apply
```

导入仅允许 `127.0.0.1:3317/onion`，先备份内容和 UI 文案，再以事务写入新文章。已有同 slug 内容若被编辑或撤下则拒绝覆盖，不改变其他文章的发布状态，也不创建项目或生活内容。备份与结果位于 `.runtime/picagent-architecture/`。

引用代码对应指定提交，不表示当前 HEAD 未变化。设计分析和个人观点不作为运行时证据；各篇明确没有重新执行的设备、云服务或生产验收边界。

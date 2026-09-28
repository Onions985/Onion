# Onion 本地完整备份

备份时间：2026-09-28_18-53-14（北京时间）。

- database.sql：全部 16 张表的结构和数据，包括管理员账号、内容版本、评论、站点设置和中英文文案。
- uploads/：16 个原始上传文件。
- manifest.json：SQL 与图片文件的大小、SHA-256，以及表清单。

## 恢复

1. 新建一个空的 MySQL 8 数据库，字符集使用 utf8mb4。
2. 使用 MySQL 客户端将 database.sql 导入该空库（文件不包含 CREATE DATABASE / USE，可选择目标库）。例如在 mysql 客户端选中目标数据库后运行 SOURCE D:/完整路径/database.sql;。
3. 将 uploads/ 内的内容复制到网站 UPLOAD_DIR 指定的目录，保留相对路径。
4. 在部署环境单独配置 DATABASE_URL 和原来的站点环境变量，再启动网站。

此备份没有执行恢复，也没有修改正在运行的数据库。数据库服务账号及 .env 未打包；网站管理员账号的密码哈希包含在 SQL 中。此快照按要求纳入本地 Git，仍排除 Docker 构建；没有推送远程。

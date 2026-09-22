# Onion — 个人网站

Nuxt 4 + Vue 3 + Nitro API + MySQL 8。前台、管理后台、服务端 API 在**同一个 Node 应用、同一个端口**运行，不需要单独部署前端。

## 已实现

- 首页、博客、项目、生活、关于、全文搜索、分页、响应式布局。
- 网站文案与博客支持中英文；**博客没有已发布英文版本时，英文页面直接显示中文原文**。项目、生活内容保持原文，不要求双语维护。浅色、深色及跟随系统；访客语言和主题偏好入库。
- 登录管理后台，创建、编辑、保存草稿、发布、取消发布、归档博客 / 项目 / 生活记录。
- Markdown 分栏编辑与预览，标题、列表、表格、代码、图片、部分安全 HTML（如 `<u>`、`<mark>`、`<details>`）。服务端过滤脚本、事件属性与危险链接。
- **不可变内容版本 + 已发布版本指针**。修改标题、路径、正文、图片和项目字段后保存草稿，公开版本保持原样，重新发布后才更新。博客中英文分别发布，缺少译文时回退原文。
- PNG / JPEG / WebP / GIF 上传，8 MB 上限，检查真实文件类型及尺寸。图片在 `data/uploads/YYYY-MM/`，元数据与内容引用在 MySQL；尚未公开引用的图片仅管理员可读取。
- 中英文个人信息、关于、首页随想、头像、导航、点缀色、默认语言 / 主题可在后台修改。初始界面文案也保存在 MySQL。
- 管理员密码 scrypt 哈希，数据库会话，HttpOnly Cookie，同源写请求校验，登录尝试限制，保存冲突检测。
- **只有站主可以创作和发布**，没有开放注册或访客写作接口。访客可对博客、项目、生活动态填写昵称并评论，无需账号；评论默认待审核，作者可审核、隐藏和回复。评论、回复与审核状态全部入库，内容按纯文本显示并限制提交频率。

## 本地运行

需要 Node.js 22.12+（推荐 24）、MySQL 8.0+。

```sh
npm ci
cp .env.example .env
# 修改 .env 内的数据库连接和管理员信息
npm run db:init
npm run dev
```

前台：<http://127.0.0.1:3000/>，后台：<http://127.0.0.1:3000/admin>。

`ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 仅用于**首次创建**管理员，不会在重复初始化时重设密码。密码至少 12 个字符。`.env` 不进入版本控制。默认 `SEED_EXAMPLES=false`，不会自动生成文章、项目或生活记录，没有已发布内容的栏目显示空状态。`SEED_EXAMPLES=true` 仅用于显式演示或独立测试数据库，在首次初始化时创建示例内容。

本项目提供 Windows 独立开发数据库脚本：

```sh
npm run dev:db
npm run db:init
npm run dev
```

`dev:db` 使用已安装的 `C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe`（可用 `MYSQLD_PATH` 覆盖），在 **127.0.0.1:3317** 启动项目专用实例，数据在 `.runtime/mysql/`。它不会连接、修改或停止其他 MySQL 服务；首次运行创建本地 `.env` 和随机凭据，已有 `.env` 时不会覆盖。再次运行可启动已有项目实例。

开发服务器停止后，可用 `npm run dev:db:stop` 停止**本项目**的数据库，不删除数据。

## 单应用部署

有 Docker Compose 的服务器上：

```sh
cp .env.docker.example .env
# 填写随机密码、管理员邮箱、SITE_URL
docker compose up -d --build
```

Compose 包含 MySQL、一次性初始化任务、一个 Nuxt 应用。应用端口默认只绑定主机 `127.0.0.1:3000`，通过 Nginx / Caddy 代理到域名。HTTPS 部署设置 `SITE_URL=https://你的域名` 和 `COOKIE_SECURE=true`。数据库不暴露主机端口；图片和 MySQL 分别用持久卷保存。MySQL 密码请使用随机十六进制字符串，避免连接 URL 中的特殊字符。

不使用 Docker：配置服务器环境变量后，`npm ci` → `npm run db:init` → `npm run build` → `npm start`。生产启动不会自动读 `.env`，由进程管理器注入环境变量，或使用 `node --env-file=.env .output/server/index.mjs`。将 `UPLOAD_DIR` 指向持久目录。

备份必须同时包含 MySQL 和上传目录（或 `mysql_data` / `uploads` 两个卷）。单独备份数据库无法恢复图片。初始化脚本按文件名顺序执行 SQL 并校验已执行迁移的 SHA-256，不应修改已执行的 SQL；后续结构变更应新增迁移。当前包含初始结构、评论系统、语言回退说明三个迁移。

本机可以运行 `npm run db:backup`，将 3317 端口的 Onion 数据库与上传图片备份到项目内的 `backups/onion-时间/`。备份使用 MySQL 一致性快照，不需要停止网站，包含 SQL、图片、校验清单和恢复说明。新备份默认被 Git 忽略，指定快照可通过 `.gitignore` 的例外规则纳入版本管理；所有备份均排除 Docker 构建。默认使用本机 MySQL 8 的 `mysqldump.exe`，可通过 `MYSQLDUMP_PATH` 指定位置。

反向代理应覆盖 `X-Real-IP`，然后设置 `TRUST_PROXY=true`，登录和评论限流才会按真实访客 IP 区分；未配置时使用直接连接 IP。Nginx 对应 `proxy_set_header X-Real-IP $remote_addr;`，并将 `client_max_body_size` 设为 `9m` 或更高。不要把接收伪造转发头的应用端口直接暴露到公网。

## 目录

```text
app/                  Vue 页面、组件、样式、管理后台
server/api/           同应用 API
server/utils/         MySQL、认证、版本发布、Markdown、图片处理
shared/               数据类型与 Zod 校验
database/migrations/  MySQL 建表 SQL
database/seed.mjs     初始网站内容和中英文文案
scripts/              初始化及本地数据库 / 集成测试工具
data/uploads/         上传文件（不入 Git）
```

业务数据由接口读取 MySQL，页面没有使用本地数组模拟内容。CSS 插画与图标属于代码内视觉资源；图片文件按需求存于项目目录，数据库保存其元数据及引用。Cookie 仅缓存偏好与匿名标识，不是内容数据源。

## 验证

```sh
npm run typecheck
npm test
npm run build
npm run test:integration
```

集成测试需要单独的 `onion_test` 数据库和访问权限；`dev:db` 会为本地创建它。也可用 `TEST_DATABASE_URL` 指定以 `_test` 结尾的独立数据库。测试启动 3001 端口的生产构建，验证认证、双语发布、草稿隔离、路径切换、版本冲突、上传与图片访问、取消发布、偏好持久化，结束后关闭测试应用。测试数据库与图片在本地保留供排查。

当前后台内容列表最多显示最近 200 条、图片库最多显示最近 200 张；前台及评论支持分页。暂未实现多人作者、自动翻译、历史版本回滚和图片回收。归档保留数据库内容；本版没有恢复归档的 UI。上线前替换示例个人信息与内容。

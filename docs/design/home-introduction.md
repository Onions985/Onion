# 首页介绍与头像

- 生成方式：内置 imagegen，使用既有男生立绘作为角色参考。
- 项目资产：`data/uploads/site/onion-avatar-20260922.png`
- 数据库：媒体记录 `32443977-cc53-439a-b55a-f9c654412e3a`，`site_settings.config.avatarId` 指向该记录。
- 替换入口：管理后台 → 网站设置 → 头像 → 上传 → 保存设置。首页和导航预览共用该头像。
- 联系方式：同页编辑微信和邮箱；值存储在 `site_settings.config.contact`，中英文共用。
- 首页标题和描述、关于页 Markdown 仍按语言分别在数据库中保存。
- 全身立绘仅用于关于页，原始资源保持不变。

## 最终生成提示词

Use case: identity-preserve. Asset type: a polished square anime profile avatar for the personal website onion. Use the supplied existing standing character only as identity and illustration style reference. Create a new close-up head-and-shoulders portrait of this same young adult male: tousled silver-gray hair, violet eyes, warm subtle smile, charcoal jacket and light gray hoodie, silver headphones around neck. Face looking toward viewer. Soft pale lavender background, clean and simple, refined Japanese anime illustration and delicate shading. Center head and shoulders within a circle-safe square composition, leave margin above hair, face large and legible at 100px. No text, no logo, no watermark, no border, no full body. Keep his gender, face identity, hair color and clothes consistent. Output a square 1024x1024 image.

生成器实际返回 1254 × 1254 PNG，原样保存在项目目录。数据库变更前备份位于 `.runtime/home-introduction-before-*.json`。

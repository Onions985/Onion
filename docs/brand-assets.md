# Onion 品牌素材

## Logo

- `public/brand/onion-mark.svg`：矢量标记，洋葱切面 / O / 嫩芽，适合导航、头像和 favicon。
- `public/brand/onion-logo.svg`：带 Onion 字标的完整横版 SVG，透明背景，文字为深色。
- 网站通过 `OnionLogo.vue` 复用标记，旁边站名仍读取数据库；文字颜色跟随深浅主题。

## 人物立绘

- `public/images/onion-character.png`：1024 × 1536 RGBA，透明背景，保留生成的 alpha；用于首页及关于页。
- 使用内置 image_gen 工具生成；没有使用 CLI / API fallback。原始文件已复制到项目，部署不依赖用户目录。
- 生成提示词：

```text
Use case: stylized-concept.
Asset type: premium original anime male full-body standing character cutout for the personal introduction on a developer's personal website named Onion.
Primary request: one handsome adult young man, about 24, soft layered silver ash hair with charcoal roots, expressive muted violet eyes, relaxed friendly slight smile. Slender natural adult proportions, mature refined anime face. Wearing a contemporary charcoal oversized technical zip jacket with a soft light gray hood, tiny muted lilac seam accents, ivory t-shirt, straight charcoal trousers, clean gray sneakers. Small silver over-ear headphones rest around his neck. One hand casually in a pocket, the other relaxed holding a thin closed notebook at his side. Slight three-quarter body angle facing toward the viewer's left, face looks at viewer. Refined Japanese editorial anime illustration with crisp delicate line art, nuanced cel shading, subtle fabric folds, beautiful face and natural hands. Subtle cool lavender rim light, soft studio illumination.
Composition: entire figure from hair to shoes fully visible with generous transparent margin, centered, tall portrait canvas. Character must feel like an approachable creative developer, not a game fighter or fantasy character. Make silhouette elegant and coherent when displayed 500px tall on a website.
Background: true transparent alpha, isolated cutout, no scenery, no floor, no backdrop, no shadow rectangle, no checkerboard drawn into image.
Avoid: text, watermark, logo, UI, armor, weapons, sci-fi props, neon cyberpunk, chibi, childish proportions, exaggerated posing, extra people, extra fingers.
```

素材作为站点设计资源随项目部署；文章、介绍文案、导航及评论数据继续由 MySQL 提供。

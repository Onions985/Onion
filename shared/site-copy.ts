import type { Locale } from './types'

const copy = {
  'comments.search': ['搜索评论内容、昵称或文章标题', 'Search comments, names or article titles'],
  'comments.total': ['共 {total} 条评论 · 每页 {size} 条', '{total} comments · {size} per page'],
  'comments.pagination': ['评论分页', 'Comment pages'],
  'comments.loadFailed': ['评论加载失败，请重试。', 'Could not load comments. Please try again.'],
  'comments.noMatches': [
    '没有符合条件的评论，试试其他关键词或审核状态。',
    'No matching comments. Try another keyword or moderation status.',
  ],
  'admin.contentTotal': ['共 {total} 条内容 · 每页 {size} 条', '{total} items · {size} per page'],
  'admin.contentPagination': ['内容分页', 'Content pages'],
  'admin.loadFailed': ['内容加载失败，请重试。', 'Could not load content. Please try again.'],
  'admin.retry': ['重试', 'Retry'],
  'admin.contentSearch': ['搜索标题、正文或标签', 'Search titles, content or tags'],
  'admin.search': ['搜索', 'Search'],
  'admin.clearSearch': ['清除搜索', 'Clear search'],
  'admin.noContent': [
    '没有符合条件的内容，试试其他关键词或类型。',
    'No matching content. Try another keyword or type.',
  ],
  'about.qq': ['QQ', 'QQ'],
  'contact.openQq': ['打开 QQ 名片', 'Open QQ profile'],
  'contact.addWechat': ['添加微信', 'Add on WeChat'],
  'contact.writeEmail': ['写邮件', 'Write an email'],
  'contact.copyQq': ['复制 QQ 号', 'Copy QQ number'],
  'contact.copyWechat': ['复制微信号', 'Copy WeChat ID'],
  'contact.copyEmail': ['复制邮箱', 'Copy email address'],
  'contact.copied': ['已复制', 'Copied'],
  'contact.copyFailed': [
    '未能复制，请选中号码或邮箱手动复制。',
    'Could not copy. Select the number or email address and copy it manually.',
  ],
  'contact.wechatHint': [
    '复制微信号，在微信「添加朋友」中搜索。',
    'Copy this WeChat ID and search for it in WeChat’s Add Contacts.',
  ],
  'contact.wechatScan': [
    '用微信扫一扫添加；同一部手机可保存二维码后，在微信扫一扫中从相册选择。',
    'Scan with WeChat to add. On the same phone, save the QR code and select it from the scanner’s photo album.',
  ],
  'contact.wechatQr': ['微信个人二维码', 'Personal WeChat QR code'],
  'contact.saveQr': ['保存二维码', 'Save QR code'],
  'contact.qrHint': [
    '上传微信「我 → 二维码名片」保存的图片，保存设置后公开展示。',
    'Upload the image saved from your personal WeChat QR card. It becomes public after saving settings.',
  ],
  'contact.removeQr': ['移除二维码', 'Remove QR code'],
  'start.title': ['第一次来，从这里开始', 'A good place to start'],
  'start.subtitle': ['挑一些想与你分享的内容，慢慢看。', 'A few things I’d like to share. Take your time.'],
  'start.works': ['我的作品', 'My work'],
  'now.title': ['最近在做什么', 'What I’m doing now'],
  'now.updated': ['更新于', 'Updated'],
  'follow.title': ['保持联系', 'Stay connected'],
  'follow.rss': ['RSS 订阅', 'RSS feed'],
  'follow.hint': [
    '用你喜欢的 RSS 阅读器，订阅这里的新文章。',
    'Follow new posts in your favorite RSS reader.',
  ],
  'reading.contents': ['文章目录', 'On this page'],
  'reading.copy': ['复制代码', 'Copy code'],
  'reading.copied': ['已复制', 'Copied'],
  'reading.copyFailed': [
    '复制失败，请选中代码手动复制',
    'Could not copy. Select the code and copy it manually.',
  ],
  'reading.related': ['接着读', 'Keep reading'],
  'reading.series': ['系列文章', 'In this series'],
  'reading.previous': ['上一篇', 'Previous in series'],
  'reading.next': ['下一篇', 'Next in series'],
  'project.demo': ['观看演示', 'Watch demo'],
  'project.decision': ['一个关键取舍', 'A key decision'],
  'project.outcome': ['进展与成果', 'Progress and outcomes'],
  'admin.discovery': ['首页精选与近况', 'Homepage selections and updates'],
  'admin.discoveryHint': [
    '选择已发布内容；留空时沿用该栏目现有的置顶或精选。已下线内容不会展示。',
    'Choose published content. Empty selections use existing pinned or featured content. Unpublished items stay hidden.',
  ],
  'admin.automatic': ['沿用置顶／精选', 'Use pinned / featured'],
  'admin.firstRead': ['精选文章 1', 'Selected article 1'],
  'admin.secondRead': ['精选文章 2', 'Selected article 2'],
  'admin.selectedProject': ['精选作品', 'Selected project'],
  'admin.nowHint': [
    '填写真实近况，留空时隐藏。英文未填写时显示中文。',
    'Share a real update, or leave blank to hide. English falls back to Chinese.',
  ],
  'admin.socialLabel': ['名称', 'Label'],
  'admin.socialUrl': ['公开链接', 'Public URL'],
  'admin.addSocial': ['添加公开账号', 'Add public profile'],
  'admin.remove': ['移除', 'Remove'],
  'admin.seriesName': ['系列名称', 'Series name'],
  'admin.seriesOrder': ['系列中的顺序', 'Position in series'],
  'admin.seriesHint': [
    '相同系列名称按顺序连接。留空则不加入系列。',
    'Posts with the same series name are ordered by position. Leave the name empty for a standalone post.',
  ],
  'admin.storyHint': [
    '填写实际的设计取舍、反馈或阶段成果。没有内容的部分不会展示。演示支持外部视频或演示页面链接。',
    'Describe actual decisions, feedback or milestones. Empty sections stay hidden. Link to an external video or demo page.',
  ],
} as const

export function siteCopy(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    Object.entries(copy).map(([key, values]) => [key, values[locale === 'en' ? 1 : 0]]),
  )
}

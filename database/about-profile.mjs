export const aboutProfiles = {
  zh: `## 你好，我是 Onion

一名在上海生活和工作的 **AI 全栈开发工程师**。我目前在职，也是一名独立开发者，在日常工作之外持续做自己的产品。

从大学开始写代码，2015 年走上开发这条路，至今积累了约十年的开发经验。这里是我的洋葱小站，记录做产品的过程、开发中的思考，以及代码之外的生活。

## 从移动端，走向 AI 全栈

我的技术经历覆盖 **Android、Java、iOS 和 Web**。从客户端到服务端，再到网页，不同方向的实践让我能从更完整的视角理解一个产品。

现在，我已经转型为 AI 全栈开发工程师，工作的范围也延伸到了产品、设计、开发和测试。对我来说，把一个想法做成真正可以使用的产品，是这些能力汇聚的地方。

## 把一个产品完整做出来

本站项目区展示的产品，均由我独立研发。我会参与从最初的需求到最终交付的整个过程：

- **产品**：明确要解决的问题，梳理需求与使用流程。
- **设计**：组织信息、设计界面，打磨实际使用的体验。
- **开发**：把客户端、服务端、Web 与 AI 应用连接起来。
- **测试**：检查功能、验证流程，在使用和反馈中继续改进。

博客里会写下这些过程中的技术实践、架构取舍和产品想法。已经做出来的作品，也可以在下方的项目里继续了解。

## 代码之外，也有很多喜欢的事

我喜欢旅游、看电影，也打篮球。跑步和马拉松是我生活里的另一部分。

游戏也没有落下，平时会玩 **Dota 和 CS2**。技术之外，如果你也喜欢旅行、电影、运动或游戏，同样欢迎来聊聊。

在这里，我会继续分享技术、记录生活，也认识一些有共同兴趣的朋友。`,
  en: `## Hi, I’m Onion

I’m an **AI full-stack engineer** living and working in Shanghai. Alongside my day job, I’m an independent developer building products of my own.

I started coding at university and began my development journey in 2015, with around a decade of experience along the way. Onion is my personal space for the things I build, the decisions behind them, and life beyond the screen.

## From mobile development to AI full stack

My background spans **Android, Java, iOS, and Web development**. Working across clients, backend services, and the web has given me a broader perspective on how a product fits together.

I’ve since moved into AI full-stack development, extending my work into product planning, design, development, and testing. Bringing an idea to life as something people can use is where those skills come together.

## Building a product from beginning to end

I independently developed all the products featured on this site. My work covers the whole process, from the first requirements to delivery:

- **Product**: Define the problem, understand the requirements, and work through user flows.
- **Design**: Organize information, shape interfaces, and refine the experience.
- **Development**: Bring client apps, backend services, the web, and AI applications together.
- **Testing**: Check features and workflows, then improve them through use and feedback.

On the blog, I share technical practice, architecture decisions, and product ideas from that process. You can explore the resulting work in the projects below.

## Away from the keyboard

I enjoy traveling, watching movies, and playing basketball. Running and marathons are part of my life, too.

I also play **Dota and CS2**. If you share an interest in travel, films, sports, or games, there’s plenty for us to talk about beyond technology.

This is a place to keep sharing what I learn, record everyday life, and meet people with interests in common.`,
}

const rows = [
  ['close', '关闭', 'Close'],
  ['content.pinned', '置顶', 'Pinned'],
  ['admin.pin', '置顶', 'Pin'],
  ['admin.unpin', '取消置顶', 'Unpin'],
  [
    'admin.pinHint',
    '项目、博客和手记各可置顶一条已发布内容；更换时自动替换原置顶，中英文共用。',
    'Pin one published item per section. A new pin replaces the previous one and applies to both languages.',
  ],
  ['error.PIN_REQUIRES_PUBLISHED', '请先发布内容，再设置置顶。', 'Publish this content before pinning it.'],
  ['project.contents', '项目目录', 'Project sections'],
  ['project.overview', '项目概览', 'Overview'],
  ['project.modules', '功能模块', 'Feature modules'],
  ['project.screenshots', '项目截图', 'Screenshots'],
  ['project.noModules', '暂无模块介绍', 'No module descriptions yet'],
  ['project.noScreenshots', '暂无项目截图', 'No screenshots yet'],
  ['project.viewScreenshot', '查看截图', 'View screenshot'],
  [
    'admin.modulesHint',
    '按功能划分模块，可填写说明和功能要点。没有资料时保持为空，最多 24 个模块。',
    'Describe each feature module and its capabilities. Leave empty when unavailable. Up to 24 modules.',
  ],
  ['admin.moduleTitle', '模块名称', 'Module name'],
  ['admin.moduleDescription', '模块说明', 'Module description'],
  ['admin.moduleFeatures', '功能要点（每行一条，最多 15 条）', 'Capabilities (one per line, up to 15)'],
  ['admin.removeModule', '移除模块', 'Remove module'],
  ['admin.addModule', '添加模块', 'Add module'],
  [
    'admin.screenshotsHint',
    '上传真实项目截图，按上传顺序展示，最多 20 张。没有截图时保持为空。',
    'Upload real screenshots in display order, up to 20. Leave empty when unavailable.',
  ],
  ['admin.screenshotCaption', '截图说明', 'Screenshot caption'],
  ['admin.removeScreenshot', '移除截图', 'Remove screenshot'],
  ['admin.uploadScreenshots', '上传项目截图', 'Upload screenshots'],
  ['admin.screenshotUploading', '正在上传截图…', 'Uploading screenshots…'],
  ['about.subtitle', '在上海工作，也独立做产品。', 'Based in Shanghai. Building at work, and independently.'],
  ['about.locationLabel', '所在城市', 'Based in'],
  ['about.locationValue', '上海', 'Shanghai'],
  ['about.sinceLabel', '开发起点', 'Building since'],
  ['about.sinceValue', '2015', '2015'],
  ['about.workLabel', '现在的状态', 'These days'],
  ['about.workValue', '在职 · 独立开发', 'Employed · Independent developer'],
  ['about.projectsTitle', '我独立做的产品', 'Products I’ve built'],
  [
    'about.projectsIntro',
    '从产品、设计，到开发与测试，把想法一步步做成作品。',
    'From product planning and design to development and testing, turning ideas into working products.',
  ],
  ['about.projectDetails', '了解项目', 'Explore project'],
  [
    'about.contactHint',
    '技术交流、项目合作、开发需求，或者单纯交个朋友，都欢迎。',
    'Technical conversations, project collaborations, development work, or simply making a new friend — all are welcome.',
  ],
  ['about.talkTech', '技术交流', 'Talk technology'],
  ['about.collaborate', '项目合作', 'Collaborate'],
  ['about.development', '开发需求', 'Development work'],
  ['about.makeFriends', '交个朋友', 'Say hello'],
  ['project.flagship', '主打项目', 'Flagship project'],
  ['admin.flagship', '主打项目标识', 'Flagship project badge'],
]
export const aboutMessages = rows.flatMap(([key, zh, en]) => [
  { locale: 'zh', key, value: zh },
  { locale: 'en', key, value: en },
])

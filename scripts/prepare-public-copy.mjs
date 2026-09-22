import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const snapshot = JSON.parse(await readFile('.runtime/copy-review/public-before.json', 'utf8'))
const changes = []
const summaries = {
 picagent: '创造拥有独立人格、声音与记忆的 AI 智能体，进入它们的世界，在对话、故事和社交中建立持续的连接。',
 tanxiaoer: '为摆摊商家提供商品管理、库存、开单收款与经营统计，让备货、出摊到收摊的日常工作更有条理。',
 'talking-rounds': '邀请朋友与 AI 智能体加入同一场讨论，用文字、图片和语音分享想法，围绕感兴趣的话题聊下去。',
 'opc-devops': '面向个人开发者与一人公司的研发工作台，集中管理项目、开发环境、构建部署、Git 与数据库，让 AI 参与分析和问题诊断。',
}
const picagentBody = `PicAgent 是一款 **智能体创作与互动应用**。在这里，你可以创造一个拥有独立形象、声音与人格的智能体，与它交谈，进入它的世界，阅读它的记忆与故事，也可以认识其他创作者和他们的作品。

## 从一个想法，创造一个智能体

创建从星工坊里的一场对话开始。描述你想象中的角色，逐步确定设定、选择形象与音色，再为它创建世界、安装应用、安排桌面布局。

智能体的世界把不同体验连接在一起：对话让交流发生，相册、文章和 FM 承载表达，记忆线记录值得回看的内容，故事线则展开连续的叙事。每一个入口都与同一个角色相连。

## 探索世界，也认识彼此

通过广场、搜索或朋友的推荐，发现感兴趣的智能体。关注它、参与对话、浏览内容，或者进入已经解锁的世界应用。

创作者也可以用角色身份发布动态，与访客交流；朋友与智能体还可以围绕话题加入同一场讨论。创作、陪伴和社交，是 PicAgent 相互连接的三部分体验。

## 设计与开发

PicAgent 由 Onion 独立设计与开发，覆盖产品、交互设计、客户端、服务端、管理后台与测试。项目持续探索如何降低智能体创作的门槛，以及如何让角色、内容和互动形成可以长期延续的体验。

## 技术实现

| 层次 | 实现方式 | 主要职责 |
| --- | --- | --- |
| Android | Kotlin / Jetpack Compose | 原生客户端、世界桌面、会话与内容交互 |
| iOS | Swift / SwiftUI | 原生界面、世界与内容阅读体验 |
| 鸿蒙 | ArkTS / ArkUI | 独立原生客户端、世界与业务页面 |
| 共享层 | Kotlin Multiplatform | 共享模型、常量、Repository 与部分业务能力 |
| 服务端 | Kotlin / Spring Boot / MySQL | 身份、世界、内容、关系、任务、权限与业务状态 |
| 管理后台 | React / TypeScript | 内容管理、审核、权限与运营配置 |

生成任务在后台异步执行。离开创作页面后，仍可以从任务中心查看进度与结果；失败任务保留必要的重试信息。世界布局和应用访问权限由服务端统一维护，各客户端据此呈现内容，并保留各自的平台交互方式。

项目持续迭代，各客户端的功能开放进度可能有所不同。充值到账与官方日记正文阅读尚未开放。
`
const moduleFeatures = [
 [
  '对话式创作：通过文字、语音、开场提示和快捷动作，逐步描述角色的身份与设定，边交流边完善想法。',
  '素材选择：从候选素材中选择形象，试听音色，确定角色最终的表达方式。',
  '草稿保存：未完成的创建过程可以继续编辑，确认后再提交，不必一次填完所有信息。',
  '角色管理：编辑资料、媒体和标签，提交公开审核，查看审核记录，也可以撤回申请或下架已发布的角色。',
 ],
 [
  '创建世界：为智能体生成独立空间，查看生成进度，并在失败后重新尝试。',
  '世界桌面：通过场景背景、Dock 和分页应用区域探索角色空间，查看时间、天气与地点等世界信息。',
  '自定义布局：创作者可以调整应用的位置和排列方式，访客进入后看到相同的世界布局。',
  '内容入口：从桌面打开人格、相册、文章、FM、礼物、技能、记忆线和故事线，深入了解角色。',
 ],
 [
  '多种交流方式：发送文字与多模态消息，也可以向智能体推荐其他角色。',
  '角色声音：通过角色音色呈现语音回复，让交流具有更鲜明的个性。',
  '灵感回复：不知道如何接话时，可以从结合角色设定和最近对话生成的建议中选择。',
  '继续上次的对话：查看最近会话、历史消息与已读位置，返回页面后继续交流，失败的回复也可以重试。',
  '会话设置：调整与角色的聊天设置，按需清空自己的聊天记录。',
 ],
 [
  '基础资料：为角色填写年龄和生日，并查看关联的星座信息。',
  'MBTI 人格：生成人格候选与相关星绘，选择适合角色的方案，也可以回看历史候选。',
  '人格阅读：通过世界里的 MBTI 应用，了解角色已经开放的人格内容。',
  '亲密度与奖励：查看互动带来的关系进度；官方智能体还提供等级轨道和对应的奖励解锁状态。',
 ],
 [
  '记忆时间线：按时间浏览智能体当前保留的长期记忆，打开详情回看具体内容。',
  '连续故事：通过章节和场景目录阅读故事正文，查看阅读前的人物资料。',
  '接着阅读：记录上次主动进入的场景，返回时可以继续探索；预加载的内容不会被当作已经读过。',
  '故事订阅：按应用授权和订阅范围进入故事，查看已经发布的场景。',
  '官方日记：可查看日记条目与锁定状态，正文阅读暂未开放。',
 ],
 [
  '浏览应用：查看当前世界的应用清单、市场介绍、桌面预览和可开通的能力。',
  '安装与整理：创作者可以为世界安装应用，并调整桌面布局。',
  '解锁访问：访客可为相应应用开通永久访问，或订阅故事线内容。',
  '查看权益：开通前了解报价，进入世界后区分已安装、已解锁和仍需开通的应用。',
 ],
 [
  '世界相册：浏览角色相册；创作者可批量上传图片，并管理自己上传的照片。',
  '角色文章：查看文章列表与正文，创作者可借助脚本提示组织角色的文字表达。',
  '角色 FM：浏览和收听节目，创建节目内容并上传或更新音频。',
  '媒体素材：管理角色使用的图片、音频与视频，为后续创作积累素材。',
 ],
 [
  '图片与视频生成：通过文字或参考图片创作图像，使用文字生成视频，选择比例、模型与提示词。',
  '音色创作：通过描述设计音色，或以音频素材发起复刻；管理自己的音色名称、资源与背景音乐。',
  '角色表情：用预设短词创作表情，浏览角色表情和自己的表情资源。',
  '星绘：创作和浏览角色衍生图像，查看关联的智能体、持有者与作品详情。',
  '作品空间：浏览广场与热门作品，管理自己的创作，回看点赞过的内容。',
 ],
 [
  '发现角色：通过广场、类型、标签、搜索和热度排行寻找智能体，了解创作者与互动情况。',
  '关注与收藏：关注喜欢的用户和智能体，收藏角色，查看关注列表与粉丝；角色之间也可以建立关注关系。',
  '分享动态：发布自己的动态，或以自己创建的角色身份分享内容，浏览用户与角色的动态。',
  '评论交流：在角色和动态下评论、回复与点赞；角色创作者可以置顶一条顶级评论。',
  '朋友私聊：发送消息与智能体推荐卡片，查看历史会话、未读提醒和已读状态。',
 ],
 [
  '组织讨论：创建话题房间，查看详情，开始或结束讨论，也可以离开房间。',
  '邀请朋友：从符合关注关系的候选中邀请参与者，查看邀请并接受或拒绝。',
  '持续交流：发送消息、查看讨论轮次和聊天历史，网络恢复后继续读取会话。',
  '参与范围：房间内容面向有访问权限的成员；退出或到期后，相应的参与权限随之结束。',
 ],
 [
  '礼物表达：选择并送出礼物，浏览礼物墙、排行和自己的赠送记录。',
  '角色技能：了解可学习的技能，查看已学技能，并按需要学习或移除。',
  '市场展示：浏览商品和详情，管理自己的上架内容，支持更新或下架。',
  '定价参考：查看智能体身价与星绘上架区间，为展示和定价提供参考。',
 ],
 [
  '个人账号：注册、使用密码或短信验证码登录，维护头像、昵称和简介，管理密码与登录状态。',
  '灵感值与签到：查看余额、收支记录、消耗说明和价格，进行日常签到或周期内补签。',
  '充值订单：查看充值档位、创建待支付订单并查询状态；支付到账功能尚未开放。',
  '生成任务中心：离开原来的页面后，仍可集中查看图片、视频、音色等任务的进度和结果。',
  '记录与帮助：管理浏览历史，搜索常见问题，提交文字或图片反馈并查看处理回复。',
 ],
 [
  '发布审核：管理智能体与故事内容的审核，分别处理创作、审核通过和公开展示。',
  '内容运营：维护角色内容、话题目录与运营配置，统一各客户端展示的数据。',
  '后台管理：管理账号、角色权限、操作审计和 AI 运行配置。',
  '多端产品：Android、iOS、鸿蒙和管理 Web 围绕同一套业务规则协作，KMP 复用模型与部分业务能力。',
 ],
]
const articleReplacements = [
 ['这些问题比“现在有几个服务”更能衡量拆分结果。历史记录中的隔离探针、替身数据库与路由验证也有范围，不能据此宣称生产 MySQL、Redis、完整登录和移动端已经全部验收。','这些问题比“现在有几个服务”更能衡量拆分结果。隔离测试之后，还需要连接实际数据库、Redis、登录服务和移动端，验证完整的调用链。'],
 ['当然，返回订阅目标不等于完成全部 Broker 权限验收。真正部署还需要核对凭证在传输服务中的验证方式，以及凭证过期后的恢复行为。','部署时还需要核对凭证在 Broker 中的验证方式，以及凭证过期后的恢复行为。'],
 ['供应商、具体模型和实际请求仍需要真实验收。这里讨论的是该历史版本如何表达契约，不是对当前任何型号能力的推荐或保证。','接入具体供应商和模型时，仍需通过实际请求验证其契约支持情况。'],
 ['这些不属于本文件已证明的范围。不能仅凭存在审核表，就宣布整个审核发布闭环已经验证完成。','审核表承担快照存储，批准与发布流程还需要分别验证。'],
 ['本文不引用历史金额作为当前供应商价格。','实际费用应以使用时的供应商价格和账单为准。'],
 ['历史模块编译记录可查，本次没有补做真机切后台、改系统时间或无障碍验收。','验证时还应覆盖切换后台、修改系统时间和无障碍使用场景。'],
 ['本文是源码与 SQL 阅读，未执行迁移、未进行钱包交易，也未把历史报价作为当前对外价格发布。','实施时应验证迁移结果、钱包扣款与权益发放的一致性；文中历史报价仅用于解释数据设计。'],
 ['这是由后端状态推导出的界面建议，不是声称当前客户端已经采用了这些文案。','这些界面建议来自后端状态的差异。'],
 ['文中的界面文案、进度表达和恢复建议是本文的设计观点，不是线上功能或效果数据。','文中的界面文案、进度表达和恢复方式是基于这套实现提出的设计建议。'],
 ['这张表是从代码回顾中提出的工作方法，不是声称 PicAgent 的所有端已经逐项完成这套验收。','这张表可以作为跨端接入时的验证清单。'],
 ['## 这次修复的验证边界','## 如何验证滚动行为'],
 ['该提交的实现记录写明，`feature:home:compileDebugKotlin` 已通过；真实登录态下的设备聊天场景没有在当次完成手动验收。本文复核了 diff 和这些记录，没有补造“线上已完全解决”或性能提升数据。','该版本通过了 `feature:home:compileDebugKotlin` 编译。滚动体验还需要在实际登录后的聊天页面中验证，重点检查浏览历史、接收新消息和主动回到底部这几种操作。'],
 ['这是对历史实现的边界分析，不是声称该提交已经做了这些增强。','这些入口校验在该版本中仍需补充。'],
 ['本文讨论的是共享导航和已连接分支，不能把它扩大为所有创作流程都已完成。','未连接的分支仍需继续完成对应的创作流程。'],
 ['这只是评价函数示例，没有虚构实验结果。','这个函数演示了评价指标的计算方式。'],
 ['本文在此基础上给出工程中的请求代次方案，并未声称示例覆盖所有 actor 使用方式。','请求代次是处理这类状态竞争的一种方法。'],
 ['这里的 42 是演示参数，没有对应真实用户，也没有虚构执行时间。','这里的 42 是演示参数，使用时应替换为实际测试条件。'],
 ['源码按提交读取，未使用工作区未提交修改；完整校验信息保存在本批次的 source-evidence.json。',''],
 ['本文根据该版本说明技术设计，没有执行真实 OSS 上传、ACL/CORS 或完整应用验收，也没有启用直传开关。',''],
 ['历史隔离验证不等于生产容量、集中采集或告警已经验收；本文没有执行这些运行操作。','生产环境还需要结合容量、集中采集和告警验证日志方案。'],
 ['路径位于 PicAgent Java 对应提交。本文未对实际业务库执行对账，也没有进行并发压测。',''],
 ['以上路径均来自本篇标注的提交。本文未执行新的服务部署或数据库迁移。',''],
 ['本文未读取用户聊天数据库，也未进行设备备份、切号或断网联调。',''],
 ['本文没有执行 Broker、设备或网络故障联调；接口分析不等于端到端送达证明。','端到端的送达行为仍需通过 Broker、设备和网络故障场景验证。'],
 ['该能力提交时默认关闭；代码存在不代表 V126 已执行或 OSS/CORS/权限已经部署，本次整理未操作 PicAgent 的数据库和云资源。','该版本的直传能力默认关闭。启用前需完成 V126 迁移，并配置 OSS、CORS 与访问权限。'],
 ['本文只核对该版本算法与返回模型，未向真实角色执行安装，也没有进行桌面布局的设备验收。',''],
 ['路径位于该提交的 `agent-user-service` 或 OpenSpec 目录。本文没有调用模型供应商或执行线上生成任务。','路径位于该提交的 `agent-user-service` 或 OpenSpec 目录。'],
 ['本文未重新发布 KMP 产物，也未执行 Android 或 Swift 消费验证。',''],
 ['本文没有操作真实安装或付款，也没有将源码核对描述为设备端验收。',''],
 ['本文未执行用户实验或设备交互测试，也不宣称该版本具备“只弹一次”的持久化策略。','这个版本尚未引入“只弹一次”的持久化策略。'],
 ['本文未请求实际图片、修改存储对象或执行传输性能测量；引用仅针对该历史版本。',''],
 ['这里是依据索引形状作出的用途分析，不声称本次已经运行了 Worker 的执行计划或压力测试。','具体查询效率需要结合执行计划与压力测试判断。'],
 ['本文只分析迁移与 Mapper 的固定版本，没有修改或执行 PicAgent 的数据库迁移。',''],
 ['这些是基于该文件的静态分析，没有声称实际设备上已经复现，也没有在此次写文章时修改 PicAgent 源码。','这些竞态风险来自调用顺序分析，是否出现仍需通过可控制时序的测试验证。'],
 ['本次文章整理核对了修改前后的查询；语法验证与真实业务库的执行计划、性能验收是不同层次的证据。','应用到业务库时，还需检查执行计划并测量查询性能。'],
 ['本文只回顾有代码支撑的持久任务设计，没有声称本次完成了云端模型、OSS 或消息投递的真实验收。',''],
 ['本文只阅读了主题入口实现，没有声称完成所有设备外观验证。',''],
 ['提交记录载明 Xcode 通用 iOS 构建通过，模拟器与真实签到路径未在当次验收；本文没有重新进行设备验证。','该版本通过了 Xcode 通用 iOS 构建；完整签到流程仍需结合模拟器与实际服务验证。'],
 ['本文没有虚构压缩率或设备耗时，只从实际实现分析它承诺做什么，以及哪些决策仍属于上层。','压缩率与处理耗时会随素材和设备变化，需要分别测量。'],
 ['本文是提交级代码回顾，未重新执行失效令牌的端到端联调。',''],
 ['本文核对了历史代码，未重新进行鸿蒙构建或真机导航验收。',''],
 ['本文示例采用稳定的 StateFlow 与生命周期收集思路，不把整理时文档里的最新依赖版本冒充为 2024 年的项目配置。','示例关注 StateFlow 与生命周期收集，接入时需要按项目版本选择依赖。'],
 ['本文按 2024 年前端性能专题归档，兼容性信息在整理时重新核对。',''],
 ['本文讨论的是应用侧设计，不声称示例已经实现跨节点线性一致性；','这套缓存策略不提供跨节点线性一致性；'],
 ['本文没有附虚构性能数字，实际收益取决于索引、页深和数据分布。','实际收益取决于索引、页深和数据分布。'],
 ['本文示例采用 MySQL 8.0 已有能力，本次整理使用 8.4 手册核对通用索引规则。','示例使用 MySQL 8.0 已有能力，参考资料采用 8.4 手册。'],
]
const codeBlocks = text => text.match(/^```[^\n]*\n[\s\S]*?^```/gm) || []
for (const item of snapshot.content) {
 if(item.kind === 'life') continue
 const next = structuredClone(item)
 if(item.kind === 'blog') {
  const opening = item.markdown.split('\n')[0]
  assert(opening.startsWith('> '), `Review opening: ${item.slug}`)
  const dates = opening.match(/\d{4}-\d{2}-\d{2}/g)
  assert(dates?.length >= 2, `Date provenance missing: ${item.slug}`)
  const independent = opening.includes('专题归档')
  const provenance = `${independent ? '专题归档' : '代码版本日期'}：${dates[0]} · 整理日期：${dates[1]}。`
  const commits = [...opening.matchAll(/`([a-f0-9]{7,40})`/g)].map(match=>match[0])
  const notes = provenance + (commits.length ? ` 参考提交：${commits.join('、')}。` : '')
  let markdown=item.markdown.slice(opening.length).trim()
  for(const [before,after] of articleReplacements) markdown=markdown.replaceAll(before,after)
  markdown=markdown.replace(/以下官方文档或原始论文于 \d{4}-\d{2}-\d{2} 核对，示例与工程分析为本文整理：/g,'')
  markdown=markdown.replace(/^##?#+ 源码依据/gm,'## 参考代码')
  const marker=markdown.indexOf('<!-- publication-sources -->')
  if(marker>=0) {
   const tail=markdown.slice(marker).replace('<!-- publication-sources -->','').trim().replace(/^## (参考代码|参考资料)\s*/, '')
   markdown=markdown.slice(0,marker).trim()+`\n\n<!-- publication-sources -->\n<details>\n<summary>${independent?'参考资料与整理日期':'参考代码与版本'}</summary>\n\n${notes}\n\n${tail}\n\n</details>`
  } else {
   // 早期文章的参考路径格式各异，保留原文并在文末集中补充版本信息。
   markdown += `\n\n_${notes}_`
  }
  next.markdown=markdown.replace(/\n{3,}/g,'\n\n').trim()+'\n'
  assert.deepEqual(codeBlocks(next.markdown),codeBlocks(item.markdown),`Code samples must remain unchanged: ${item.slug}`)
  for(const url of item.markdown.match(/https?:\/\/[^\s)<>]+/g)||[]) assert(next.markdown.includes(url),`Reference removed: ${item.slug}`)
 } else {
  next.summary=summaries[item.slug]
  if(item.slug==='picagent') {
   next.markdown=picagentBody
   next.metadata.projectModules.forEach((module,index)=>{module.features=moduleFeatures[index]})
   next.metadata.projectModules[0].description='从一句想法开始，逐步塑造一个有身份、有形象、有声音的智能体。创建过程中的设定和选择会保存在草稿中，随时可以继续。'
   next.metadata.projectModules[3].description='基础资料、MBTI 人格与互动关系，让角色拥有可以了解和感受的个性。'
   next.metadata.projectModules[9].description='和朋友、智能体围绕一个主题展开讨论，在共同的房间里分享观点、延续话题。'
   next.metadata.projectModules[11].description='在个人中心管理资料、灵感值与生成任务，也可以回看浏览记录、寻找帮助。'
  } else {
   const replace={
    tanxiaoer:[
     ['从理货、备货，到开单、收款和收摊，我希望用一个轻量的应用，把每天容易遗漏的细节记录清楚，让经营者把更多注意力留给眼前的生意。','从理货、备货到开单、收款和收摊，把容易遗漏的细节记录清楚，让经营者把注意力留给眼前的生意。'],
     ['会员开通与下载入口以应用和官方后续发布信息为准。',''],
     ['项目持续迭代中。目前该组织没有对外公开的仓库，具体功能范围以相应客户端版本为准。','项目持续迭代，Android 与 iOS 的功能范围有所不同。'],
    ],
    'talking-rounds':[
     ['是一个让真人与 AI 智能体围绕同一话题展开讨论的聊天项目。比起把对话限制在一个人与一个助手之间，我想尝试一种更接近小组交流的形式：邀请朋友，选择参与讨论的智能体，然后一起聊下去。','是一款让朋友与 AI 智能体一起参与讨论的聊天应用。邀请朋友，选择参与的智能体，在同一个房间分享观点，围绕感兴趣的话题聊下去。'],
     ['源码已接入选图、录音、上传、重试、大图查看和语音播放，相关真实服务配置与运行验收仍在推进。','支持选图、录音、发送重试、大图查看和语音播放，媒体体验仍在开发完善中。'],
     ['当前处于开发阶段，已经形成客户端与服务端的源码链路；媒体服务配置、设备体验和真实服务联调仍需继续验收。官网尚未配置正式下载入口。','应用仍在开发中，暂未开放正式下载。'],
     ['目前该组织没有对外公开的仓库。这里展示项目方向与已记录的开发进展，后续随项目迭代更新。',''],
    ],
    'opc-devops':[
     ['AI DevOps 是我为个人开发者和一人公司打造的研发工作台。一个产品往往包含 Android、服务端、Web 等多个工程，我希望把项目、开发环境、构建与交付放在同一个清晰的工作区里。','AI DevOps 是面向个人开发者和一人公司的研发工作台。一个产品中的 Android、服务端与 Web 工程可以集中管理，开发环境、构建任务和交付记录也能在同一个工作区里查看。'],
     ['我更在意的是每一步发生了什么：构建、上传、部署分别记录结果，失败可以定位，项目环境能够追溯。AI 提供辅助，实际执行仍然经过明确的参数和能力边界。','构建、上传和部署分别记录执行结果，方便定位失败环节、追溯项目环境。AI 可以辅助分析和诊断，执行过程保留明确的参数与操作记录。'],
     ['目前该组织没有对外公开的仓库，主页作为项目入口；本文介绍依据现有项目文档整理。',''],
    ],
   }[item.slug]
   for(const [before,after] of replace) {assert(next.markdown.includes(before),`${item.slug}: missing exact copy`);next.markdown=next.markdown.replace(before,after)}
   next.markdown=next.markdown.replace(/\n{3,}/g,'\n\n').trim()+'\n'
  }
 }
 changes.push({id:item.id,kind:item.kind,locale:item.locale,slug:item.slug,before:item,after:next})
}
await writeFile('.runtime/copy-review/changes.json',JSON.stringify(changes,null,2))
console.log(JSON.stringify({projects:changes.filter(c=>c.kind==='project').length,blogs:changes.filter(c=>c.kind==='blog').length,codeSamples:'unchanged',references:'preserved'}))
if(process.argv.includes('--sources')) {
 const files=new Map()
 for(const batch of ['picagent','picagent-architecture','picagent-engineering','engineering-notes']) {
  const manifest=JSON.parse(await readFile(`docs/articles/${batch}/manifest.json`,'utf8'))
  for(const article of Array.isArray(manifest)?manifest:manifest.articles)files.set(article.slug,`docs/articles/${batch}/${article.file}`)
 }
 for(const change of changes) {
  const path=change.kind==='project'?`docs/projects/${change.slug}.md`:files.get(change.slug)
  assert(path,`Missing source: ${change.slug}`)
  await writeFile(path,change.after.markdown)
 }
 const picagent=JSON.parse(await readFile('docs/projects/picagent.json','utf8'))
 const picChange=changes.find(c=>c.slug==='picagent')
 picagent.summary=picChange.after.summary
 picagent.metadata.projectModules=picChange.after.metadata.projectModules
 await writeFile('docs/projects/picagent.json',JSON.stringify(picagent,null,2)+'\n')
 const manifest=JSON.parse(await readFile('docs/projects/manifest.json','utf8'))
 for(const project of manifest.projects)project.summary=summaries[project.slug]
 await writeFile('docs/projects/manifest.json',JSON.stringify(manifest,null,2)+'\n')
 console.log('Source Markdown and project manifests synchronized.')
}

import { readFile, writeFile } from 'node:fs/promises'

// Editorial catalog for the September expansion. No database writes.
const compiledOn = '2026-09-22'
const projectSources = JSON.parse(await readFile(new URL('../docs/articles/picagent-engineering/source-selection.json', import.meta.url), 'utf8'))
const project = [
  ['java-cost','ai-cost-snapshot','AI 成本调试：为什么一次估算必须绑定配置快照','Java,SpringBoot,AI,架构设计'],
  ['java-video','video-processing-budget','视频压缩链路：把并发、截止时间与质量门禁放在一起','Java,SpringBoot,音视频,架构设计'],
  ['java-review','human-review-snapshot','人工审核的交接边界：冻结候选内容，再等待裁决','Java,SpringBoot,AI,需求设计'],
  ['java-claim','worker-claim-indexes','任务队列的两条索引：领取工作与回收租约','MySQL,SQL,Java,架构设计'],
  ['java-subscription','immutable-subscription-offer','订阅报价为什么要不可变：从 SQL 约束看交易设计','MySQL,SQL,Java,需求设计'],
  ['kmp-layout-cache','validated-layout-cache','最后一份有效布局：KMP 缓存为什么还要做语义校验','KMP,Kotlin,缓存,架构设计'],
  ['kmp-preview','preview-flight-coordination','多个卡片一起刷新：KMP 预览请求的合并与账号清理','KMP,Kotlin,并发,缓存'],
  ['kmp-wire','server-owned-price-contract','价格不由客户端提交：KMP 购买协议的边界','KMP,Kotlin,接口设计,需求设计'],
  ['kmp-generation','composite-task-identity','统一任务列表之后，为什么 taskId 不再足够','KMP,Kotlin,接口设计,架构设计'],
  ['android-refresh','atomic-refresh-owner','账号切换的一瞬间：刷新事件怎样原子地核验归属','Android,Kotlin,并发,架构设计'],
  ['android-authority','desktop-action-authority','卡片能显示，不代表现在能打开：Android 点击权限的复核','Android,Kotlin,需求设计,架构设计'],
  ['android-memory','memory-timeline-generations','列表、详情与账号：Android 时间线的三层请求代次','Android,Kotlin,并发,分页'],
  ['android-push','terminal-push-validation','收到推送就算成功吗：生成任务终态的组合校验','Android,Kotlin,接口设计,AI'],
  ['ios-theme','swiftui-effective-appearance','SwiftUI 深浅主题：色板和系统外观必须成对传递','iOS,Swift,UI,架构设计'],
  ['ios-generation','generation-coordinator-lifetime','暂停查询不等于取消生成：iOS 异步任务的生命周期','iOS,Swift,AI,并发'],
  ['ios-pagination','follow-pagination-review','从关注列表看分页设计：加载标记之外还缺什么','iOS,Swift,分页,架构设计'],
  ['ios-compression','jpeg-quality-boundary','保持尺寸的图片压缩：iOS JPEG 质量阶梯的取舍','iOS,Swift,图片处理,需求设计'],
  ['harmony-invalidation','session-invalidation-registry','鸿蒙退出登录：用失效注册表拆开认证与业务依赖','鸿蒙,ArkTS,架构设计,会话管理'],
  ['harmony-window','task-window-reducer','刷新头部、保留尾部：鸿蒙任务列表的窗口合并规则','鸿蒙,ArkTS,分页,架构设计'],
  ['harmony-upload','upload-attempt-identity','上传成功后的 URL 能复用吗：鸿蒙编辑会话的精确身份','鸿蒙,ArkTS,图片处理,并发'],
]
const refs = {
  virtual: ['Oracle Java 21 Virtual Threads','https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html'],
  future: ['Java 21 CompletableFuture API','https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html'],
  spring: ['Spring Transactional documentation','https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html'],
  outbox: ['Debezium Outbox Event Router','https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html'],
  index: ['MySQL Multiple-Column Indexes','https://dev.mysql.com/doc/refman/8.4/en/multiple-column-indexes.html'],
  mvcc: ['MySQL Consistent Nonlocking Reads','https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html'],
  limit: ['MySQL LIMIT Query Optimization','https://dev.mysql.com/doc/refman/8.4/en/limit-optimization.html'],
  redis: ['Redis SET command','https://redis.io/docs/latest/commands/set/'],
  lock: ['Redis Distributed Locks','https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/'],
  http: ['RFC 9111 HTTP Caching','https://www.rfc-editor.org/rfc/rfc9111.html'],
  async: ['Python 3.11 Coroutines and Tasks','https://docs.python.org/3.11/library/asyncio-task.html'],
  queue: ['Python 3.11 Queues','https://docs.python.org/3.11/library/asyncio-queue.html'],
  generator: ['Python Functional Programming HOWTO','https://docs.python.org/3.11/howto/functional.html'],
  json: ['Python 3.11 JSON documentation','https://docs.python.org/3.11/library/json.html'],
  ts: ['TypeScript Narrowing','https://www.typescriptlang.org/docs/handbook/2/narrowing.html'],
  css: ['MDN content-visibility','https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility'],
  compose: ['Android State and Jetpack Compose','https://developer.android.com/develop/ui/compose/state'],
  flow: ['Android StateFlow and SharedFlow','https://developer.android.com/kotlin/flow/stateflow-and-sharedflow'],
  swift: ['Swift SE-0306 Actors','https://github.com/swiftlang/swift-evolution/blob/main/proposals/0306-actors.md'],
  kmp: ['Kotlin Expected and Actual Declarations','https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html'],
  rag: ['Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks','https://arxiv.org/abs/2005.11401'],
}
const independent = [
  ['java-virtual-threads-resource-budget','虚拟线程之后，系统仍然需要资源预算','2024-01-18','Java,并发,架构设计','virtual'],
  ['java-completablefuture-deadlines','CompletableFuture 超时了，后台工作真的停了吗','2023-11-09','Java,并发,接口设计','future'],
  ['spring-transaction-proxy-boundaries','Spring 事务边界：从自调用到远程副作用','2023-10-21','Java,SpringBoot,数据库,架构设计','spring'],
  ['transactional-outbox-delivery','Transactional Outbox：数据库提交之后，消息怎样可靠到达','2025-05-16','Java,SpringBoot,MySQL,分布式系统','outbox'],
  ['mysql-composite-index-design','MySQL 联合索引：从查询形状推导字段顺序','2022-12-11','MySQL,SQL,数据库,性能优化','index'],
  ['mysql-mvcc-snapshot-current-read','MySQL MVCC：读到的快照与真正执行的更新','2023-02-26','MySQL,SQL,数据库,并发','mvcc'],
  ['mysql-keyset-pagination','游标分页怎么设计：稳定排序、过滤条件与数据变化','2023-06-18','MySQL,SQL,分页,接口设计','limit,index'],
  ['redis-cache-consistency','Redis 缓存一致性：从一次旧值回填说起','2024-03-12','Redis,缓存,分布式系统,架构设计','redis'],
  ['redis-lock-lease-fencing','Redis 分布式锁：租约过期之后谁还有写入权','2024-05-25','Redis,并发,分布式系统,SQL','lock,redis'],
  ['http-cache-etag-design','HTTP 缓存设计：Cache-Control、ETag 与内容版本','2022-09-24','HTTP,前端,缓存,接口设计','http'],
  ['python-asyncio-taskgroup','Python TaskGroup：让并发任务有边界、有背压','2024-07-14','Python,并发,架构设计','async,queue'],
  ['python-streaming-data-pipelines','Python 流式数据处理：省内存之外，还要能恢复','2024-08-10','Python,数据处理,架构设计','generator,json'],
  ['typescript-discriminated-unions','用 TypeScript 判别联合把页面状态写清楚','2024-09-22','TypeScript,前端,架构设计','ts'],
  ['css-content-visibility-long-pages','长页面性能优化：content-visibility 的作用与边界','2024-10-13','CSS,前端,性能优化,UI','css'],
  ['compose-stateflow-lifecycle','Compose 与 StateFlow：状态更新和生命周期要一起设计','2024-11-17','Android,Kotlin,Compose,架构设计','compose,flow'],
  ['swift-actor-reentrancy','Swift Actor 可重入性：每个 await 都值得重新检查状态','2025-01-12','iOS,Swift,并发,架构设计','swift'],
  ['kmp-platform-boundaries','KMP 共享边界：接口、expect/actual 与平台责任','2025-03-08','KMP,Kotlin,Android,iOS,架构设计','kmp'],
  ['rag-retrieval-evaluation','RAG 怎么评估：把检索、证据和回答分开看','2025-08-23','AI,RAG,Python,架构设计','rag'],
]

async function prepare(batch, items, isIndependent) {
  const base = new URL(`../docs/articles/${batch}/`, import.meta.url)
  const articles = []
  for (const item of items) {
    const [key, second, third, fourth, fifth] = item
    const source = isIndependent ? null : projectSources.find(s => s.key === key)
    const slug = isIndependent ? key : `picagent-${second}`
    const file = `${isIndependent ? key : second}.md`
    const title = isIndependent ? second : third
    const archiveDate = isIndependent ? third : source.date.slice(0,10)
    const tags = fourth.split(',')
    const sources = isIndependent
      ? fifth.split(',').map(id => ({ title: refs[id][0], url: refs[id][1], verifiedOn: compiledOn }))
      : [{ repo: source.repo, commit: source.commit, files: [source.file] }]
    if (key === 'java-claim') sources[0].files.push('agent-user/agent-user-service/src/main/resources/mapper/StoryTaskMapper.xml')
    let body = await readFile(new URL(file, base), 'utf8')
    // Keep provenance at the end so readers enter the topic immediately.
    body = body.replace(/^> 归档说明：[\s\S]*?\n\n/, '').split('\n\n<!-- publication-sources -->')[0].trim()
    const summary = body.split('\n\n')[0]
    const provenance = `${isIndependent ? '专题归档' : '代码版本日期'}：${archiveDate} · 整理日期：${compiledOn}。`
    const references = isIndependent
      ? sources.map(s => `- [${s.title}](${s.url})`).join('\n')
      : `- 仓库：\`${source.repo}\`\n- 固定提交：\`${source.commit}\`\n${sources[0].files.map(f => `- 文件：\`${f}\``).join('\n')}`
    const footer = `<details>\n<summary>${isIndependent ? '参考资料与整理日期' : '参考代码与版本'}</summary>\n\n${provenance}\n\n${references}\n\n</details>`
    await writeFile(new URL(file, base), `${body}\n\n<!-- publication-sources -->\n${footer}\n`)
    articles.push({ slug, file, title, summary, category: isIndependent ? '技术笔记' : '项目复盘', tags, ...(isIndependent ? {archiveDate} : {}), sources })
  }
  await writeFile(new URL('manifest.json', base), JSON.stringify({ compiledOn, sourceType: isIndependent ? 'independent' : 'project', articles }, null, 2) + '\n')
  await writeFile(new URL('README.md', base), `# ${isIndependent ? '独立技术笔记' : 'PicAgent 工程复盘'}\n\n共 ${articles.length} 篇，整理日期 ${compiledOn}。正文使用 Markdown，作者沿用站点管理员。\n\n版本、归档日期与参考来源在文末说明；不包含虚构项目、用户数据或性能测量。\n\n先运行 scripts/import-article-batch.mjs --batch=${batch} --check，再使用 --apply 发布。导入只允许本机 3317 端口的 onion 数据库，先备份，遇到已有文章被编辑则停止。\n`)
  console.log(`${batch}: ${articles.length} articles prepared`)
}
const target = process.argv[2]
if (!target || target === 'independent') await prepare('engineering-notes', independent, true)
if (!target || target === 'project') await prepare('picagent-engineering', project, false)

桌面上的多个卡片可能同时需要预览内容，页面重复进入也可能再次刷新。简单地给每张卡片发请求，会产生重复网络工作；简单地全局缓存一个请求，又会碰到账号切换后的旧结果回填。PicAgent 在 KMP 预览层同时处理了这两个边界。

## 合并单位是角色与 App 身份

同步协调器以 FlightKey(characterId,appKey) 记录正在进行的工作。一次刷新找出已有 flight 与新 key，只为新 key 创建批量请求，再让多个调用者等待相应 Deferred。

```kotlin
private data class FlightKey(val characterId: Long, val appKey: String)

private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
private val mutex = Mutex()
private val flights = mutableMapOf<FlightKey, Deferred<ApiState<Unit>>>()
```

这是每个数据库实例共享的协调器，不是无条件进程全局缓存。独立 scope 拥有实际请求，一个等待者取消不会自动取消其他等待者仍在使用的工作。由谁拥有请求，就由谁负责它的清理。

## 刷新策略也需要尊重服务端退避

Provider 先筛选可预览的 App，再检查本地记录是否匹配当前身份。FORCE_REFRESH 可以跳过普通复用判断，但在 retryAfterUntilMillis 尚未到达时仍然不发请求。

这个顺序使“强制刷新”不是“无视服务端限流”。IF_ABSENT 则结合是否有可复用终态和 nextAttemptAtMillis 决定是否需要重试，避免失败后每次重组都再次打网络。

请求携带 knownRevision 的前提是本地记录身份一致且可以复用。若服务端返回未修改，但本地没有对应缓存，源码将其作为协议错误，而不是展示空白成功。

## 账号清理必须和写入竞争出先后

关键写入都经过 generation 与 accepting 检查：

```kotlin
if (generation != expectedGeneration || !accepting) {
    CharacterWorldPreviewGenerationWrite(executed = false)
} else {
    CharacterWorldPreviewGenerationWrite(executed = true, value = block())
}
```

这段发生在协调器互斥锁内。清理时先关闭接纳门，取消并等待旧 flight，然后推进 generation、执行清理，最后重新开放。它避免“账号数据刚清完，旧网络结果又写回来”的窗口。

旧 flight 在 finally 删除自身映射时还比较对象身份，避免删掉后来替换的新 flight。共享任务表的清理也需要身份检查，不能只按 key 无条件移除。

## 取消不能变成普通失败缓存

Provider 会重新抛出 CancellationException，并检查被自定义仓储包装进错误状态的取消。否则账号清理触发的取消可能被写成一次网络失败，留下错误的退避或展示状态。

这一点对跨层 ApiState 很有价值：结果包装方便统一展示，但不能让控制流语义在包装时丢失。取消、协议错误、临时网络错误各自需要不同处置。

## 合并请求之后还剩哪些边界

这份代码解决的是单数据库实例内的预览协调，不代表服务器没有重复请求，也不代表所有业务接口都自动共享该规则。批量请求大小、缓存容量和长期 scope 释放仍需结合周边实现评估。

验证时最有价值的是可控交错：两个页面请求同一 key、一个等待者取消、清理账号时请求刚完成、强制刷新遇到 Retry-After。它们能说明设计是否真正保护共享工作，而不仅是减少了一次 HTTP 调用。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-09-01 · 整理日期：2026-09-22。

- 仓库：`pic-agent-kmp`
- 固定提交：`689110266dd4a529edb4f80748186c501f537198`
- 文件：`shared-character/src/commonMain/kotlin/com/onion/picagent/kmp/character/preview/CharacterWorldAppPreviewProvider.kt`

</details>

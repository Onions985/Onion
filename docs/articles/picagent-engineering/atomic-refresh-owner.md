生成任务结束后，客户端通常需要刷新任务列表和音色列表。若事件属于旧账号，而用户刚刚切换账号，刷新就不应该继续被新会话接纳。PicAgent 的 GenerationRefreshBatchStore 用一个很小的临界区，把归属核验和事件提交连在一起。

## 两次独立操作之间有一个窗口

设想先执行 `isCurrent(owner)` 返回 true，然后切换账号调用 fence，最后旧代码仍然发送刷新事件。即使 owner 字段是 volatile，也只能保证读取可见性，无法把检查和使用合并成原子动作。

源码把这两步放进同一个锁：

```kotlin
fun submit(owner: RefreshOwnerToken, effects: List<RefreshEffect>): Boolean =
    synchronized(ownerLock) {
        if (this.owner != owner || effects.isEmpty()) return@synchronized false
        if (effects.any { !it.type.isGenerationRefreshType() }) return@synchronized false
        tryEmit(
            RefreshBatchData(
                sourceAccountId = owner.userId,
                ownerToken = owner,
                effects = effects.distinct(),
            ),
        )
    }
```

setOwner 与 fence 也使用 ownerLock，因此它们与 submit 能明确决出先后。旧事件要么在失效之前被接纳，要么在失效之后被拒绝，而不会在检查之后悄悄跨过边界。

## 接纳顺序不等于消费时永远有效

如果事件在切号前已经进入队列，消费者稍后才处理，它仍然需要依据事件携带的 ownerToken 和 sourceAccountId 判断归属。这个 Store 证明的是入口接纳原子性，不是清空所有已经排队的副作用。

这也是为什么事件本身要带身份，而不是只有一个 `RefreshTasks` 枚举。异步传播时间越长，越不能依赖“发送时大家还在同一个账号”这个隐含假设。

## 批量刷新也要限制语义范围

这份 Store 只允许 GenerationTasks 和 Timbre 两类刷新，空列表或混入其他类型会被拒绝，重复 effect 会去重。它不是一个任意事件总线，而是生成终态触发刷新的专用边界。

一次批量提交可以让多个相关刷新共享同一个 owner 事实，但它没有实现时间上的 debounce，也没有承诺多次 submit 一定合并成一次网络请求。不要把 effects.distinct() 误读成跨事件防抖。

tryEmit 的布尔返回值直接传出，意味着缓冲无法接纳时调用者有机会知道失败。是否重试、合并或依靠下次页面刷新恢复，需要在更外层决定，不能把 false 忽略后宣称消息必达。

## 锁内工作应保持短小

这里注入的是同步 tryEmit 回调，设计意图是快速提交。如果以后把耗时 I/O 或可阻塞业务塞进这个回调，就会拉长账号失效等待，也可能产生重入风险。小型并发工具的安全性依赖接口使用约定，不能只看 synchronized 这个关键词。

验证时可以让 submit 与 fence 在受控线程上交错，检查两种合法顺序；再验证混合类型、重复 effect 和提交失败。它们分别验证归属、领域范围和传递结果。

这段只有几十行代码，却比单独的 `if (currentUser == user)` 更准确地表达了需求：账号失效与旧事件接纳之间必须有一个确定的边界。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-01 · 整理日期：2026-09-22。

- 仓库：`pic-agent-android`
- 固定提交：`b613be7298741e152326527e81c16769465511ce`
- 文件：`domain/center/src/main/java/com/onion/picagent/center/datastore/GenerationRefreshBatchStore.kt`

</details>

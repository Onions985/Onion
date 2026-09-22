一个记忆时间线同时有账号、角色、分页列表和详情页。只保存一个 loading 标记，很难处理刷新与翻页交错、详情切换以及账号失效。PicAgent 的 Android MemoryViewModel 用多个代次表达不同范围的请求归属。

## 不同变化影响不同范围

源码维护 ownerGeneration、listGeneration、detailGeneration 和 eventGeneration。打开新的 authority 时会取消请求、推进代次并建立 binding；刷新首屏推进列表代次；打开详情则有独立的详情代次。

这种拆分避免一次详情切换无谓地让整个列表失效，也避免列表刷新后旧分页继续追加。代次不是为了计数，而是给异步结果一个可比较的出生上下文。

## 返回结果以后重新检查

```kotlin
private suspend fun isListOwner(
    expected: MemoryTimelineBinding,
    expectedOwnerGeneration: Long,
    expectedListGeneration: Long,
): Boolean = listGeneration == expectedListGeneration &&
    isCurrent(expected, expectedOwnerGeneration)
```

isCurrent 继续检查 ownerGeneration、binding 与当前账号。详情还比较 detailMemoryId。于是即使底层请求未能及时取消，迟到结果也没有资格更新新的页面。

成功、失败和提示事件都需要类似门禁。只保护成功路径，会留下旧请求错误覆盖新页面或旧账号 toast 弹出的窗口。

## 服务端游标不由客户端猜测

loadMore 使用服务端 nextCursorMemoryId。响应校验包括角色匹配、条目 ID 合法、页内去重、严格降序，以及下一页条目必须比请求游标更旧。

```kotlin
if (items.map { it.memoryId }.toSet().size != items.size) return null
if (items.zipWithNext().any { (left, right) -> left.memoryId <= right.memoryId }) return null
if (requestedCursor != null && items.any { it.memoryId >= requestedCursor }) return null
```

追加前还检查是否与现有条目重复。协议偏差时保留 last-good，而不是自行排序、去重后把损坏响应伪装成成功。这个选择让服务端问题能被发现，也避免客户端随意改变 cursor 语义。

## 刷新和翻页不能同时拥有写入权

首屏刷新会取消 firstPageJob 与 pageJob，推进 listGeneration，并重置分页中的标记。旧分页即使晚到，代次已经不匹配。新的首屏成功后替换整个列表与游标，分页则只在当前代次上追加。

这比让两个协程分别写 items 更有确定性。状态容器是线程安全的，也不代表两次业务写入的先后就是正确的；请求身份仍然需要单独表达。

## 权限变化要先失效，再退出

Host 每次发布外层世界状态时复核完整 binding。失配后清空 binding、推进代次、清理 UI，再发出退出事件。先取消旧归属，可以避免导航退出尚未完成时旧结果继续写入。

退出事件自身也携带 eventGeneration，外层消费时可以识别已经过期的事件。导航是异步副作用，同样可能迟到，不应该被视为即时函数调用。

适合验证的交错包括刷新期间翻页返回、A 详情晚于 B 详情、同账号重新登录、角色布局变化与权限重新校验失败。本文依据固定源码分析这些机制，没有在设备上执行这些场景；它展示的是把复杂页面拆成多个明确寿命范围的方法。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-09-01 · 整理日期：2026-09-22。

- 仓库：`pic-agent-android`
- 固定提交：`2598bcf823e83078335f2c3521a21dcc641d293b`
- 文件：`feature/characterworld/src/main/java/com/onion/picagent/characterworld/engine/memory/CharacterWorldMemoryViewModel.kt`

</details>

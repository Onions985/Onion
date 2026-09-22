Compose 页面“拿到了数据却不刷新”，经常不是重组机制神秘，而是状态没有通过可观察的方式变化。另一个常见问题是页面离开前台后仍在做不必要的收集。不可变 UI 状态、Flow 的共享策略和界面生命周期，需要放在一起设计。

## 让一次更新成为完整的新值

```kotlin
data class FeedState(
    val items: List<Article> = emptyList(),
    val refreshing: Boolean = false,
    val error: String? = null,
)

private val _state = MutableStateFlow(FeedState())
val state: StateFlow<FeedState> = _state.asStateFlow()

fun replaceArticles(articles: List<Article>) {
    _state.update { old ->
        old.copy(items = articles.toList(), refreshing = false, error = null)
    }
}
```

不要在一个普通 mutableList 上原地 add，然后期待所有订阅者自动知道变化。列表容器与列表元素都应有清晰的可变性约定。`toList()` 复制容器，并不会递归冻结每个 Article；元素本身如果可变，仍然可能出现共享修改。

状态应只表达页面需要的事实。格式化时间、按钮颜色等可推导值可以在合适层计算，避免多个字段分别更新后短时间冲突。刷新失败时是否保留旧列表，也应通过状态明确表达。

## Android 界面按生命周期收集

```kotlin
@Composable
fun FeedRoute(viewModel: FeedViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    FeedScreen(
        state = state,
        onRefresh = viewModel::refresh,
    )
}
```

这是 Android 平台的收集入口，需要相应生命周期 Compose 依赖。跨平台公共 UI 应选择适合所在平台的收集方式，不能把 Android 生命周期类型不加区分地传进所有共享模块。

把无状态的 FeedScreen 与持有 ViewModel 的入口分开，便于预览和验证。页面事件向上走，状态向下传，避免多个子组件各自重新请求同一数据，也让刷新入口保持唯一。

## 停止收集不一定停止上游工作

如果数据源在进程级 scope 中无条件轮询，界面停止收集也不会自动取消那个独立任务。需要看 Flow 如何创建、在哪个 scope 共享以及使用什么启动策略。

```kotlin
val state = repository.observeArticles()
    .map { articles -> FeedState(items = articles) }
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = FeedState(),
    )
```

5 秒是示例中的短暂离开宽限期，不是所有应用的推荐常量。WhileSubscribed 管理的是这条共享流的订阅关系；仓储如果另外启动了一个不受它控制的 Job，仍要单独处理归属。仓储是冷流、热流还是缓存快照，不能只看它返回 Flow 类型就判断。

## 一次性效果不要伪装成永久状态

保存成功后导航、弹出提示等效果，需要讨论重建页面后是否重放。用一个一直为 true 的 `saved` 字段触发导航，可能在重新订阅后重复执行；用无缓冲事件流，又可能在界面停止收集期间丢失。

对于必须让用户确认的结果，可以保存带 ID 的待处理状态，消费成功后由所有者确认；对于允许丢失的短提示，可以使用生命周期明确的事件通道。没有一种 Flow 配置能替代这项产品选择。

列表请求同样需要处理乱序返回。刷新 A 尚未结束时发起 B，最终是否允许 A 覆盖 B，要用请求代次或查询身份表达。取消 A 能节约资源，但不应成为唯一的结果接纳条件。

## 验证真实的生命周期交错

我会检查首屏加载、旋转或重建、进入后台、返回前台、刷新失败保留旧数据和账号切换。尤其要确认没有订阅者时上游是否仍然请求网络，以及回来后使用的是缓存、重新请求还是两者组合。

示例关注 StateFlow 与生命周期收集，接入时需要按项目版本选择依赖。状态模型、任务归属和生命周期边界先明确，重组才能成为可靠的展示机制，而不是需要不断猜测的黑盒。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2024-11-17 · 整理日期：2026-09-22。

- [Android State and Jetpack Compose](https://developer.android.com/develop/ui/compose/state)
- [Android StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)

</details>

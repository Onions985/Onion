一个关注列表看起来只需要首次加载、加载更多和关注按钮，但这些动作会互相交错。PicAgent 这个历史版本的 FollowListPageViewModel 提供了一个很适合复盘的例子：基础分页状态清楚，同时也能看到加载标记尚未覆盖的竞态边界。

## 已经明确的页面行为

ViewModel 在 MainActor 上维护 items、isLoading、isLoadingMore、noMoreData 和 pendingUserIDs。加载更多要求当前没有加载、还有后续数据，并且触发项就是列表最后一项。

```swift
guard !isLoading, !isLoadingMore, !noMoreData else {
    return
}

guard currentItem.id == items.last?.id else {
    return
}
```

这能避免用户滚动时对多个可见项重复发起翻页。关注按钮则按 userId 放入 pendingUserIDs，防止同一用户的关注操作并发提交；不同用户仍可以独立操作。

列表请求同时携带页码、lastId 和 lastTime，成功后首屏替换 items，后续页追加。关注同步通过 publisher 更新已加载项目的 isFollow，不必每点一次按钮都重新拉整个列表。

## 空页才结束，会多一次确认请求

当前代码以 fetched.isEmpty 判断 noMoreData。这意味着最后一页即使不足 30 条，只要非空，仍允许再请求一次，以空页确认结束。

这是可以成立的协议选择，但应与服务端约定一致。不能只凭页面大小就擅自把短页当作末页；过滤或服务端策略可能导致短页但仍有后续。若服务端提供权威 hasMore，应优先明确使用它。

## 加载标记不能防住所有交错

在这个固定提交里，reload 会直接进入 fetch，未看到用于绑定结果的 request generation，也未保存所有请求 Task 以便取消。考虑：旧的加载更多正在等待，用户触发 reload，新首屏先返回，旧分页随后再追加。旧结果可能把不同轮次的数据拼在一起。

另一个风险是两个请求都在 defer 中重置 isLoading/isLoadingMore。较早请求结束时，可能把仍在运行的新请求标记清掉。MainActor 可以串行化每次状态访问，却不会自动让远程响应按业务顺序到达。

这些竞态风险来自调用顺序分析，是否出现仍需通过可控制时序的测试验证。

## 可以怎样补齐请求归属

一个改进方向是每次首屏刷新推进列表代次，分页捕获当前代次与游标，所有成功、失败和 defer 清理都先检查自己仍属于当前请求。以下是设计示意，不是现有源码：

```swift
let captured = generation
let response = await provider.load(cursor)
guard captured == generation else { return }
// 在当前代次内合并结果并清理对应 loading 状态
```

仅在成功分支加 guard 还不够，旧错误文案和旧清理同样可能影响新页面。若加入取消，还应保留身份比较，防止依赖不及时响应取消。

## 分页体验需要一组交错用例

我会覆盖快速重复刷新、翻页中刷新、刷新失败保留旧内容、关注状态同步与分页同时返回，以及末页确认。对已加载列表还应根据服务端协议决定跨页重复 ID 是去重、更新还是协议错误，不能无条件追加后交给 UI 消化。

这份复盘的价值不在于把一个页面评成好或坏，而是看到基础防重复与完整请求归属之间的距离。真实代码的边界往往比抽象的分页模板更能帮助我们改进设计。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-07-28 · 整理日期：2026-09-22。

- 仓库：`pic-agent-ios`
- 固定提交：`dbf284d0cf8a6648d95b9b210bc1cc9c9ddcc8e2`
- 文件：`Sources/FeatureHome/Follow/FollowListPageViewModel.swift`

</details>

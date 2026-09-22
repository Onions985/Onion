签到页看起来只是一个按钮和七天奖励格子，真正麻烦的是它同时影响补签、重置确认、余额和其他页面刷新。PicAgent iOS 这次接入把服务调用收在 Provider 后面，把交互过程收在 ViewModel 中，签到规则则继续由服务端状态提供。

## Feature 面向三个业务动作

当时的 `CheckinProviding` 协议只有查询状态、签到和补签三个方法：

```swift
@MainActor
public protocol CheckinProviding {
    func fetchCheckinStatus() async -> PicAgentApiState<PicAgentCheckinStatusResponse>
    func checkin() async -> PicAgentApiState<PicAgentCheckinResultResponse>
    func makeup(dayNumber: Int32) async -> PicAgentApiState<PicAgentMakeupCheckinResponse>
}
```

`KMPCheckinProvider` 位于 `DomainCenter`，通过 KMP Repository 发起请求；`FeatureHome` 的签到页面依赖协议，不自行创建底层网络客户端。

需要准确描述当时的边界：响应类型有 KMP typealias 桥接，这并不等于该版本已经把全部底层模型彻底转换成纯 Swift 值类型。协议隔离首先解决了调用职责，而不是自动消除所有模型耦合。

## 服务端告诉客户端“今天能做什么”

页面读取的关键字段包括 `checkedInToday`、`todayDayNumber`、`directCheckinWillReset`、`makeupQuota`、`makeupAvailableDayNumbers` 和 `weekStatus`。

这些字段直接影响按钮行为。用户点击今天，若会重置连续签到，先展示确认；点击允许补签的日期且有补签额度，打开补签 Sheet；已经签到、未来日期或不满足条件的日期，则给出对应提示。

客户端会组织这些分支，但不根据手机日期重新计算一套奖励规则。否则跨时区、服务端规则调整或漏签状态变化时，两端很容易产生不同答案。

## 加载失败与操作失败不是同一种状态

`CheckinRootViewModel` 分开保存 `isLoading`、`isStatusError`、`isCheckinProcessing`、`isMakeupProcessing` 和 `processingDayNumber`。

这允许页面在首次状态加载失败时显示重试入口，在签到操作失败时保留已加载的奖励信息；也能让某一天显示处理中，而不是把整个页面恢复到空白 loading。

签到和补签共享 `isProcessing` 判断，避免用户在一个操作未结束时继续触发另一个操作。这个前端保护用于交互收敛，服务端仍然需要自己的业务和并发约束。

## 成功后的余额来自响应

签到或补签成功后，`applySuccess` 的顺序是先同步会话余额，再更新页面显示、创建庆祝状态，最后发布钱包刷新事件：

```swift
syncSessionPoint(balanceAfter)
optimisticBalance = balanceAfter
celebration = CheckinCelebration(
    dayNumber: dayNumber,
    reward: reward,
    isMakeup: isMakeup
)
refreshCenter.publish(.wallet)
```

虽然变量名叫 `optimisticBalance`，这里的值已经来自成功响应中的 `balanceAfter`，并不是客户端自行把奖励加到余额上。随后页面静默重新请求签到状态。

历史实现会在新状态的余额达到该值时清除这个临时覆盖值。这个条件适配了签到奖励场景，但不能直接套用到同时存在消费、退款等变化的钱包系统；更广泛的余额同步需要另外定义版本和刷新语义。

## 把页面反馈和跨页面刷新分开

庆祝动画服务于当前页面，`.wallet` 事件用于通知其他消费余额的页面。它们来自同一个成功结果，但职责不同。Provider 还抑制了自动全局错误 Toast，让签到 ViewModel 负责这条流程的提示，避免失败一次出现两条消息。

源码依据：`pic-agent-ios@1710e0d` 的 `Sources/DomainCenterProtocol/CheckinProviding.swift`、`Sources/FeatureHome/Checkin/CheckinRootViewModel.swift` 和 `project/checkin.md`。该版本通过了 Xcode 通用 iOS 构建；完整签到流程仍需结合模拟器与实际服务验证。

_代码版本日期：2026-06-25 · 整理日期：2026-09-21。 参考提交：`1710e0d`。_

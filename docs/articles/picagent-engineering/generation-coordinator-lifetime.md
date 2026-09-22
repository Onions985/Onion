AI 生成可能持续数十秒，用户会切后台、返回页面或选择稍后再看。若把页面消失直接理解为取消服务端任务，体验和实际执行就会脱节。PicAgent 的 iOS GenerationCoordinator 把提交、查询、暂停和脱离页面分成不同阶段。

## 阶段表达真实事实

源码的 phase 包括 idle、submitting、polling、paused、succeeded 和 failed，没有凭时间捏造百分比。paused 仍属于 isRunning，因为暂停的是客户端查询，不是服务端生成。

进入后台时，如果正在提交，只设置暂停查询标记，让 ACK 返回后停在 paused；如果已经轮询，则取消当前查询 worker 并保留 taskID。返回前台后使用既有 taskID 恢复详情查询。

## ACK 前后，重试含义发生变化

提交时冻结 requestID、预期操作类型和提交闭包。ACK 必须匹配 requestID、operationType、mediaType，且 taskID 为正，才被接纳。

```swift
self.taskID = ack.taskID
// ACK 已确认后重试只查 detail，及时释放 clone WAV 等提交负载。
self.submitOperation = nil
```

ACK 前响应不确定时可以复用原始请求身份重试；ACK 后已经知道任务存在，重试应查询该任务，而不是重新创建一次生成。及时释放提交闭包，也避免大音频或图片负载被整个轮询阶段一直持有。

## 两秒是查询间隔，不是固定节拍

轮询会等待一次详情响应，若仍在队列或处理中，再 sleep 两秒后发起下一次。这是 fixed-delay，不会因为单次接口变慢而按固定频率不断堆叠查询。

详情响应同样核对 requestID、taskID、操作类型与媒体类型。成功状态还要求存在 output；未知状态进入失败，不会根据缺失字段自行推断成功。

## 所有结果都要仍然属于当前尝试

```swift
private func owns(epoch: UInt64) -> Bool {
    ownerEpoch == epoch && attemptOwner != nil && currentOwner() == attemptOwner
}
```

网络调用前后都会检查归属。detach 先推进 ownerEpoch，再取消 worker、释放快照并执行脱离回调。先失效后取消，可以让已经在返回途中的旧响应失去写入资格。

这份协调器不会因为页面离开就调用服务端取消接口。它管理的是本地观察和尝试快照；任务是否在后台继续，由服务端任务协议决定。也不能从这里推断所有任务都已持久化到本地，它不是完整任务仓库。

## 失败也有不同恢复路径

提交失败和详情失败分别保留不同重试入口。用户修改输入会放弃失败快照，下次才创建新意图。对全局已经处理的 toast 错误，协调器收敛当前尝试，避免重复提示。

这比一个统一“重试”按钮更诚实：用户需要知道是在重新确认旧任务，还是创建新的任务。网络失败不应自动等价于生成失败，更不应该导致重复扣费或重复提交。

验证可以围绕 ACK 丢失、ACK 到达时应用在后台、查询超时、切号、detach 后迟到成功等场景展开。状态机的意义是把这些边界写清楚，让页面显示与后台事实一致，而不是用连续动画掩盖不确定状态。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-07-21 · 整理日期：2026-09-22。

- 仓库：`pic-agent-ios`
- 固定提交：`bbdd51d574c87e3c7319c0ce68c7f7e6e1d3c4bf`
- 文件：`Sources/Base/Generation/PicAgentGenerationCoordinator.swift`

</details>

Actor 可以隔离可变状态，却不会把一个包含 `await` 的方法变成不可打断的事务。方法挂起时，其他调用可能进入同一个 actor 修改状态；恢复后，挂起前成立的条件可能已经失效。这是写 Swift 并发代码时很值得单独检查的地方。

## 从一个搜索页面的乱序结果开始

用户输入 A，触发远程搜索；随后输入 B，再触发搜索。B 先完成，A 后完成。即使 ViewModel 标记了 `@MainActor`，两个结果也仍然可能依次写回，最终页面显示 A。

MainActor 保证相关状态访问在其隔离规则下执行，不保证远程响应按发起顺序到达。因此需要保存当前请求身份，并在恢复后重新比较。

```swift
@MainActor
final class SearchModel: ObservableObject {
    @Published private(set) var results: [String] = []
    @Published private(set) var errorMessage: String?
    private var generation: UInt64 = 0

    func search(
        query: String,
        fetch: @Sendable (String) async throws -> [String]
    ) async {
        generation &+= 1
        let captured = generation
        errorMessage = nil
        do {
            let values = try await fetch(query)
            try Task.checkCancellation()
            guard generation == captured else { return }
            results = values
        } catch is CancellationError {
            return
        } catch {
            guard generation == captured else { return }
            errorMessage = "搜索失败，请重试"
        }
    }

    func invalidate() {
        generation &+= 1
        results = []
        errorMessage = nil
    }
}
```

这是用于说明接纳条件的片段，调用方仍负责保存和取消 Task。每次请求捕获一个代次，成功与失败都必须属于当前代次。否则迟到的旧错误也可能把新结果页面盖住。代次理论上会回绕，实际长寿命协议若对此敏感，应使用不可复用的请求身份。

## 取消和身份检查保护不同东西

取消请求可以减少不必要的工作，但取消是协作式的。某个依赖可能在取消前已经完成，也可能把错误包装后延迟返回。身份检查负责决定结果有没有权更新当前页面，因此即使已经调用 cancel，仍值得保留接纳门禁。

用户退出账号时，只清空当前数组不够。如果旧账号的网络结果随后返回，还可能重新填入页面。失效入口应推进请求身份，同时关闭旧任务和清理缓存；结果接纳还可以比较账号与会话代次，而不是只比较搜索字符串。

## Actor 内部也要重新验证不变量

设想库存 actor 在 await 支付前检查剩余数量，挂起期间另一个调用也通过检查。恢复后两个调用都扣减，就可能破坏库存约束。actor 避免了同时访问内存的数据竞争，却不自动避免跨挂起点的逻辑竞态。

可以把“检查并预留”放在同一个不含挂起点的隔离片段里，再执行外部步骤；失败时释放预留。或者把最终裁决交给数据库条件更新。选哪种方案取决于进程重启、跨实例和外部副作用的要求。

不要为了阻止重入，在 actor 里使用阻塞等待网络返回。这样可能损害执行器资源并制造死锁风险，问题应通过状态和归属表达。

## 缓存加载还有共享工作的选择

多个调用同时请求同一个缓存键时，可以记录正在进行的 Task，让后来者等待同一份工作。但共享任务的取消权应该属于缓存所有者，而不是任意一个等待页面。一个页面离开，不一定意味着其他等待者也不需要结果。

失败后是否移除任务、账号变化如何清空、旧任务完成能否重新填入缓存，都要有明确规则。只加一个 `[Key: Task]` 字典，通常还没有完成这些设计。

Swift 的 actor 提案明确讨论了可重入执行。请求代次是处理这类状态竞争的一种方法。审查时逐个圈出 await，再问“恢复后哪些假设需要重查”，往往比笼统地检查有没有 actor 更有效。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2025-01-12 · 整理日期：2026-09-22。

- [Swift SE-0306 Actors](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0306-actors.md)

</details>

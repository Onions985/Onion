`CompletableFuture` 很容易把多个调用拼起来，也很容易制造“接口已经超时，后台任务还在继续”的错觉。设计聚合接口时，我更关心三个时间：调用方何时停止等待、工作何时停止、资源何时释放。这三个时间往往并不相同。

## 超时改变的是哪一个对象

`orTimeout` 会让目标 future 在到期后以超时异常完成，但不能据此认定底层 HTTP、JDBC 或文件操作已经终止。`CompletableFuture.cancel` 也不能被理解成通用的线程中断开关。任务由谁创建、底层调用支持什么取消机制，决定了停止工作是否可实现。

还有一个细节：`orTimeout` 返回的是同一个 future。如果多个消费者共享它，其中一个消费者直接设置短超时，就可能影响其他消费者。Java 9 及以上可以使用 `copy()` 隔离消费者看到的完成状态，再在副本上设置自己的等待预算；原始工作是否取消仍由所有者决定。

```java
CompletableFuture<Product> shared = loader.load(productId);
CompletableFuture<Product> forCard = shared.copy()
    .orTimeout(180, TimeUnit.MILLISECONDS);
CompletableFuture<Product> forDetail = shared.copy()
    .orTimeout(700, TimeUnit.MILLISECONDS);
```

这是消费者超时隔离示例，不是完整的共享任务管理器。真正的共享加载还需要淘汰失败项、控制缓存大小，并防止同一键永久保存异常 future。

## 整体截止时间比每层固定超时更容易解释

一个接口总预算 800 毫秒，如果先查用户花了 500 毫秒，再给商品查询完整的 800 毫秒，就已经违反最外层承诺。可以在入口生成单调时钟截止点，每次调用前计算剩余预算。

```java
record Deadline(long endNanos) {
    static Deadline after(Duration duration) {
        return new Deadline(System.nanoTime() + duration.toNanos());
    }
    long remainingMillis() {
        long remaining = endNanos - System.nanoTime();
        if (remaining <= 0) throw new CompletionException(
            new TimeoutException("request deadline exceeded"));
        return Math.max(1, TimeUnit.NANOSECONDS.toMillis(remaining));
    }
}
```

示例适用于有限、合理的请求时长，生产代码还应限制可接受的 `Duration`，避免极端输入造成加法溢出。这个截止时间应传给底层客户端的调用预算，而不是只放在最外层 future 上。连接超时、读取超时、排队超时的含义也要分开记录。

## 并行聚合需要业务失败策略

假设页面由用户信息、价格和推荐组成。用户信息失败可能意味着整个页面不可用；推荐失败则可以显示空推荐。把三个调用都接到 `allOf` 后面，并不会自动表达这些规则。

可以先给可选分支定义可解释的降级：只有明确允许的网络失败转成带原因的空推荐，认证错误和协议解析错误应保留。不要用一个兜底 `exceptionally(e -> null)` 吃掉所有故障，否则“没有推荐”和“接口返回了破损数据”会失去区别。

`allOf` 返回的 future 需要等参与者都完成，并不会替你取消其他工作。若要求关键分支失败后尽快停止其余分支，应让聚合器持有这些任务的取消句柄，并明确谁负责清理。不能把 `allOf` 当成结构化并发的完整替代品。

## 线程池也是依赖隔离的一部分

未指定执行器的异步阶段通常使用公共线程池。对于阻塞远程调用，直接占用这个池会让其他无关计算一起变慢。可以为不同依赖提供受控执行器，或者在合适版本上使用虚拟线程配合资源许可。

反过来，非异步的 `thenApply` 可能在完成上游的线程中运行。把一个昂贵 JSON 转换放进去，有机会拖住网络回调线程。因此阶段命名之外，还需要知道计算实际在哪个线程执行。

我会为聚合接口记录四类指标：入口总耗时、每个分支耗时、超时后仍在运行的任务数、取消到资源释放的延迟。测试可以使用可控制完成顺序的假依赖，验证推荐晚到不会覆盖已经返回的结果，关键失败不会被空值掩盖。这样才能看见组合 API 背后的真实工作寿命。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2023-11-09 · 整理日期：2026-09-22。

- [Java 21 CompletableFuture API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html)

</details>

PicAgent 的角色世界使用 24 倍速时间。这个时钟并不是把手机当前时间乘以 24：它先接受服务端给出的世界时间，再用设备的单调时钟计算已经流逝了多久。

## 把时间事实与流逝时长分开

共享协议提供 `serverNowMillis`、`worldNowMillis`、`rate` 和 `zoneOffsetMinutes`。Android 这版只接受有效正时间、倍率 24 和时区偏移 480 分钟的锚点。

建立会话锚点时，保存服务端的 `worldNowMillis`，以及当时的 `SystemClock.elapsedRealtime()`。之后的基本关系是：

```text
当前世界时间 = 同步时的世界时间
             + (当前 elapsedRealtime - 同步时 elapsedRealtime) × 24
```

`serverNowMillis` 是协议校验的一部分，但这个客户端公式并没有用手机 wall clock 与服务端时间做差，也没有实现往返延迟补偿。明确这一点，可以避免把简单锚点推进描述成完整的网络校时协议。

Android 的 [SystemClock 文档](https://developer.android.com/reference/android/os/SystemClock) 区分了墙上时间和单调时钟；`elapsedRealtime` 包含设备深度休眠期间的时间，适合在同一次开机周期内计算经过的时长。

## 乘加也需要失败路径

原实现没有直接做 Long 乘加，而是检查负时间差和整数溢出：

```kotlin
val elapsed = Math.subtractExact(elapsedRealtimeNow, elapsedRealtimeAtSync)
if (elapsed < 0L) return null
Math.addExact(worldTimeAtSync, Math.multiplyExact(elapsed, WORLD_RATE.toLong()))
    .takeIf { it > 0L }
```

这段代码位于 `deriveWorldNow` 的 try/catch 中，`ArithmeticException` 同样返回 null。非法结果进入降级流程，不会继续格式化为一个看起来正常的日期。

## 页面进入时只决定一次锚点

`CharacterWorldClockCoordinator` 由一次外层 World 页面会话持有。首个当前账号、当前角色、已经通过访问授权的 detail 会消费校时决定；即便这次锚点为空或非法，后续生成轮询也不会替换它。

这是该功能明确选择的会话规则，目的是让同一次页面会话的时间推进来源稳定。它不是所有时钟都应遵循的通用方案；需要连续校时的产品，应另外设计漂移修正和显示跳变策略。

异步提交还会比较包含 generation 的 binding。页面关闭、切换账号或角色后，旧请求不能再把锚点写给新页面。

## 停止唤醒，不等于停止时间

页面进入后台时取消 ticker，重新进入前台时仍然使用原锚点重新计算。因此后台不需要一直定时刷新 UI，返回时也不需要把后台停留时间丢掉。

界面显示到分钟，完整一个世界分钟对应现实 2500 毫秒。实际等待并非每次固定 2500 毫秒，而是先计算距离下一个世界分钟还差多少，再除以 24 并向上取整，以对齐分钟边界。

## 缓存失败时保持诚实

last-good 按 `accountId + characterId` 隔离，恢复时先显示冻结的旧值。没有有效服务端锚点就不启动推进；既没有可用缓存，也没有有效锚点时显示占位。

单调时钟基准不能跨设备重启直接复用。这份实现把会话锚点留在内存中，持久化的是服务端时间记录，而不是把上次开机的 elapsedRealtime 当作下一次的连续时间。

源码依据：`pic-agent-android@ec9e2adc` 中 `engine/clock/CharacterWorldClockCoordinator.kt`、`CharacterWorldClockContract.kt` 及对应实现记录。验证时还应覆盖切换后台、修改系统时间和无障碍使用场景。

_代码版本日期：2026-08-06 · 整理日期：2026-09-21。 参考提交：`ec9e2adc`。_

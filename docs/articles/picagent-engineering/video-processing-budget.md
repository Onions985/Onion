视频压缩并不是调用一次转码命令就完成了。生成文件需要下载、探测、转码、质量比较、上传和验证，任何一步失控都可能占满磁盘或拖住工作线程。PicAgent 的 GeneratedVideoProcessingService 把这些步骤放进同一预算与清理边界中。

## 接纳工作时就开始计时

源码使用节点内的公平 Semaphore 限制处理并发，共享截止时间在获取许可前建立。等待许可使用许可超时与剩余总时间中的较小值，意味着排队也消耗本次处理预算。

这比每一步重新给一份完整超时更容易解释。若排队已经耗尽预算，就不应继续下载一个大视频。许可是节点内限制，不能据此推断多个服务实例共享一个全局并发上限。

获取许可之后先检查磁盘余量，再创建工作目录。清理工作目录和释放许可分别放在嵌套 finally 中，让正常返回与异常出口都经过对应释放路径。

## 候选文件要通过多个门禁

实际流程先探测源视频，只对符合条件的源生成候选；随后验证结构、测量质量，再决定候选是否值得使用。仅仅“文件更小”不足以证明可以替换源文件。

```kotlin
commandService.verifyStructure(sourceProbe, candidateProbe)
val quality = commandService.measureQuality(
    source.path, candidate, sourceProbe.frames.size, workingDirectory, deadline,
)
commandService.selectCandidate(source.sizeBytes, Files.size(candidate), quality)
```

这些是服务中的连续源码。实际阈值属于被调用服务和配置，不应在没有检查它们时随意补出所谓压缩率。本文也没有运行 FFmpeg 或测量真实视频效果。

## 回退和中止不是同一种失败

候选处理的一般异常会回退源文件，记录 PROCESSING_FAILED；但 GeneratedVideoAbortException 会继续抛出。这种区分允许“优化失败仍可交付原始资产”，同时避免总预算耗尽后继续假装可以处理。

最终是否发布候选还取决于模式：

```kotlin
val publishCandidate = properties.mode == GeneratedVideoCompressionMode.ENFORCE && candidateDecision.useCandidate
val selectedPath = if (publishCandidate) candidate else source.path
```

因此测到了候选质量，不等于已经把它发布给用户。日志需要同时记录模式、选择与原因，才能区分观察阶段和真正替换阶段。

## 上传成功以后还要验证交付物

服务为选中的文件计算校验信息，以稳定业务身份推导对象键，然后上传并检查元数据与公开可读性。长度、内容类型和摘要的验证，把“调用存储 SDK 没抛异常”进一步收敛成可交付结果。

稳定对象键便于关联同一个业务任务，但清理时必须小心。`cleanupUnreferenced` 自身只是执行删除；它的前置约定要求调用方先在新的、带所有权检查的事务中确认没有引用。不能把函数名当成内部已经查过引用的证据。

## 我会如何验证这条链路

故障用例应覆盖许可等待超时、磁盘不足、转码失败、质量不达标、上传失败和验证不一致，并确认临时目录与许可都能释放。对于中途退出的进程，还应另外考虑启动清理和遗留文件策略。

从这份实现可以得到的设计经验是：优化应有可放弃的边界，资源预算应贯穿全程，交付结果应经过验证。只有同时满足这些条件，压缩功能才不会反过来降低生成链路的可靠性。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-09-21 · 整理日期：2026-09-22。

- 仓库：`pic-agent-java`
- 固定提交：`5f0ad078668c4332a4c098003201aa3a7785710f`
- 文件：`agent-user/agent-user-service/src/main/kotlin/com/onion/picagent/service/media/video/GeneratedVideoProcessingService.kt`

</details>

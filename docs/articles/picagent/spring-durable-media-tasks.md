图像和视频生成不适合一直占用一个 HTTP 请求等待。客户端可能断线，服务可能重启，供应商也可能已经收到了任务，却没有把响应完整送回来。PicAgent 这次统一异步媒体生成，围绕的正是这些中间状态。

## 受理成功与生成成功分开

`MediaGenerationAcceptanceService` 验证用户和请求后，创建持久任务并返回 ACK。任务表以 `(user_id, request_id)` 建立唯一约束，同一用户重发相同请求时可以查到已有任务。

但只有 requestId 相同还不够：`replay` 还会比较 `clientPayloadHash`。

```kotlin
private fun replay(task: MediaGenerationTask, payloadHash: String): HttpWrapper<MediaGenerationAccepted> {
    if (task.clientPayloadHash != payloadHash) {
        return HttpWrapper.businessError(HttpCode.CONFLICT, "requestId已用于其它媒体请求")
    }
    return HttpWrapper.success(ack(task))
}
```

同一个 ID 携带不同生成参数，不应该悄悄返回旧结果。这是业务意图冲突，不是普通网络重试。

受理时还保存了请求快照、路由快照和费用。后续执行读取这些快照，避免排队期间配置变化导致同一任务的模型选择或费用语义漂移。

## 为什么需要“提交结果未知”

V61 迁移为任务定义了六种内部状态：

| 状态 | 在这条流程中的含义 |
| --- | --- |
| QUEUED | 已受理，等待提交 |
| SUBMITTING_UNKNOWN | 已准备向外部提交，结果尚未可靠落库 |
| POLLING | 已持有供应商任务 ID，等待查询结果 |
| PUBLISHING | 已获得持久媒体结果，等待业务发布 |
| SUCCEEDED | 业务结果已经提交 |
| FAILED | 任务进入失败处理 |

`prepareSubmit` 在事务内锁定任务，检查状态和下一次运行时间，先写入 `SUBMITTING_UNKNOWN`，再返回外部提交命令。得到供应商任务 ID 后才转到 `POLLING`。

这样，进程在外部调用前后中断时，数据库仍然留下阶段记录。它并没有神奇地让数据库与供应商共享事务；遇到不确定结果，仍然要按阶段规则恢复，不能把超时一律理解为“对方没有收到”。

`MediaGenerationProcessor.submit` 对此还有一个重要限制：只有供应商明确返回 `NOT_SUBMITTED`，才会考虑切换目标或安排重试；抛异常或返回不确定受理结果时，不继续盲目提交。停留在未知阶段并到期后，处理器按 `SUBMIT_OUTCOME_UNKNOWN` 进入失败处理。这并不代表它查询出了供应商的真实结果，而是选择停止自动重复提交。

```kotlin
is MediaModelCallResult.Failure -> {
    if (result.submissionState != MediaSubmissionState.NOT_SUBMITTED) return
    if (!result.type.retryable) {
        fail(taskId, MediaGenerationInternalStatus.SUBMITTING_UNKNOWN,
            MediaGenerationFailureCode.SUBMIT_NOT_ACCEPTED, false, null)
        return
    }
}
```

上面摘录的是提交循环中的失败分支，仅调整了换行。区分“明确没提交”和“无法确认有没有提交”，比对所有异常统一重试更符合有成本的外部任务。

## Spring 事务保护哪一段

代码使用 `TransactionTemplate` 把本地阶段变更组织成显式事务。受理阶段在事务中创建任务并调用钱包扣费流程；发布阶段则将生成资源、私有作品、任务成功状态和 Outbox 成功事件放在本地事务中提交。

Spring 的 [编程式事务文档](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html) 说明了 `TransactionTemplate.execute` 的回调模型。这里更重要的项目选择是事务的边界：外部任务通过命令和检查点衔接，而不是假设 HTTP、对象存储和 MySQL 可以一次性原子成功。

## 有租约，还要识别当前执行者

轮询和发布阶段使用 `run_owner`、`run_until`。领取执行权时生成新的 owner，后续提交必须带着匹配的 owner；`markPublishing` 还会核对当前任务状态。

```kotlin
val task = taskMapper.selectByIdForUpdate(taskId)
    ?.takeIf { it.status == MediaGenerationInternalStatus.POLLING && it.runOwner == runOwner }
    ?: return@execute false
taskMapper.markPublishing(taskId, runOwner, result, now()) == 1
```

这是原方法的局部摘录。它让迟到的旧执行者无法仅凭 taskId 覆盖新一轮执行结果。租约负责恢复推进，owner 校验负责拒绝过期提交，两者解决不同问题。

## Outbox 是通知意图，不是投递成功证明

公开媒体发布事务会调用 `enqueueSuccess`。这意味着业务成功和“需要发送成功通知”共同落库。之后的 MQTT 投递仍由独立 dispatcher 处理，客户端也仍然需要状态查询与重复事件处理。

源码依据：`pic-agent-java@d8bdd7a` 中的 `MediaGenerationAcceptanceService.kt`、`MediaGenerationWorkflowService.kt`、`MediaGenerationPublicationService.kt` 和 `V61__Create_async_media_generation.sql`。

_代码版本日期：2026-07-17 · 整理日期：2026-09-21。 参考提交：`d8bdd7a`。_

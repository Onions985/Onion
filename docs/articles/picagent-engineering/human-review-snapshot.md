AI 生成内容进入人工审核时，最重要的问题不是加一个待审核状态，而是审核者究竟在审哪一份内容。如果候选还在变化，批准按钮就可能放行一份从未被看过的结果。PicAgent 的人审提交服务通过冻结快照，把生成和正式发布之间的交接点固定下来。

## 候选内容先有自己的身份

提交章节时，服务先由 snapshotCodec 生成快照，记录 targetType、schemaVersion、JSON 和 contentHash。随后在独立事务里写入审核记录，并把任务转成待审状态。

```kotlin
val snapshot = snapshotCodec.chapter(request, steps)
requireNotNull(transaction.execute {
    val task = requireNotNull(taskMapper.selectOwnedForUpdate(lease.taskId, lease.owner)) {
        "Chapter人审提交owner fence失效"
    }
```

片段展示了先生成候选表达，再在事务中重新取得当前任务归属的顺序。快照计算成功并不代表任务仍由这个 Worker 拥有；租约可能在计算期间变化，所以写入入口还要复核。

## 待审提交也要检查业务前提

章节提交分支会核对任务类型、故事线身份、是否已有结果和同类审核记录，还会锁定故事线，检查角色、前章、暂停状态、活动章节以及章节序号。

这些检查保证候选仍然处于它原本的上下文。例如原先准备“第六章”，但当前故事线已经推进或暂停，就不能因为生成已经花了成本而继续提交旧候选。沉没成本不应该变成绕过状态约束的理由。

对于耗尽草稿分支，服务还比较当前滚动计划，以及已发布场景的 ID、内容摘要和正文是否与冻结请求一致。这说明“审核对象”不只有新文本，还包含文本依赖的上下文版本。

## 审核记录与任务状态必须一起成立

```kotlin
check(taskMapper.markReviewPendingOwned(request.taskId, lease.owner, KJson.encode(steps)) == 1) {
    "Chapter任务转待审失败"
}
```

审核记录插入和任务状态变更都要求影响一行，并位于同一事务内。如果插入成功但任务转态失败，事务不能只留下一个孤立审核项。独立事务使用 REQUIRES_NEW，这是明确的提交边界，也意味着调用链需要考虑它与外层事务的独立性。

服务的待审日志在事务返回后记录，避免把一次最终回滚的尝试记录成已经完成交接。日志可用于观察流程，但真正事实仍然是数据库记录。

## 待审不是正式内容

这份文件的职责明确：提交候选，不写正式 Chapter、Scene 或 Album。这样审核等待期间，读者不会提前看到候选内容，后续审核拒绝也不需要把已经公开的正文再撤回。

完整发布链还需要在批准时重新检查快照身份和业务前提，并决定失败后的恢复方式；审核表承担快照存储，批准与发布流程还需要分别验证。

我认为这项设计最值得复用的地方，是把“生成成功”“等待人审”“正式可见”作为不同事实。它让产品可以解释当前停在哪一步，也让恢复过程能够围绕不可变候选进行，而不是重新猜测某次模型输出是什么。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-09-03 · 整理日期：2026-09-22。

- 仓库：`pic-agent-java`
- 固定提交：`d709d1169eb70e2f5f4531fd03e63ad2ad86197f`
- 文件：`agent-user/agent-user-service/src/main/kotlin/com/onion/picagent/service/character/storyline/humanreview/StorylineHumanReviewSubmissionService.kt`

</details>

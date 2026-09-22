推送消息到达客户端，并不等于它能直接变成一张成功卡片。任务类型、操作类型、事件类型和任务状态之间需要互相一致。PicAgent 的 GenerationTaskTerminalValidator 把这项判断集中在 Center 边界，减少各个页面自行解释协议的差异。

## 先确认消息可以关联到任务

媒体与音色终态要求 eventId、taskId 为正，requestId 非空。世界任务则额外要求 characterId。没有可关联身份的消息不能安全更新某个任务，也不应凭借一段文案猜测属于谁。

这些只是本地协议合法性条件，不等于验证消息签名或当前账号归属。传输可信性、会话隔离和去重需要其他边界承担，不能因为函数返回非空就省略它们。

## 事件类型必须与状态配对

```kotlin
private fun isMatchingTerminal(eventType: Int, taskStatus: Int): Boolean = when (eventType) {
    EVENT_SUCCEEDED -> taskStatus == TASK_STATUS_SUCCEEDED
    EVENT_FAILED -> taskStatus == TASK_STATUS_FAILED
    else -> false
}
```

成功事件配失败状态、处理中状态配终态事件，都会被拒绝。这样客户端不会只看一个字段就把协议矛盾解释成用户可见事实。

媒体任务还核对 operationType 与 mediaType：图片与图片编辑要求图像媒体类型，视频操作要求视频媒体类型。未知或内部操作保持关闭，不生成公开卡片，也不触发公开任务时间线失效。

## 世界状态构成更严格的组合

世界任务成功要求 eventType 成功、taskStatus 成功且 worldStatus 已启用；失败则要求对应的失败组合。它没有把“任务执行结束”直接等价成“世界现在可以进入”。

这反映了业务状态和执行状态的区别。一个任务可能完成某个内部阶段，但业务实体还未达到可见条件。客户端应遵循服务端定义的公开组合，不能自己补齐缺失状态。

## 类型转换集中在一个边界

MediaTaskKind 与 TimbreTaskKind 各自映射到统一 GenerationTaskType。把这项转换放在 Center，可以让推送、列表刷新与用户卡片共享同一套公开类型解释。

如果每个页面各自维护 operationType 到任务类型的 switch，新类型上线时很容易只更新一处，造成推送显示为视频、任务列表却按图片更新。集中映射并不消除版本兼容问题，但让支持范围有一个明确位置。

## 合法终态之后还需要幂等消费

同一条推送可能重复到达，连接恢复也可能重放。验证器只判断“能否解释”，没有在这里保存已消费 eventId。因此消费层仍要防止重复弹卡片、重复刷新或重复导航。

对于需要最终正确状态的页面，可以把推送作为刷新信号，再查询权威任务详情。是否允许直接展示推送携带内容，取决于协议完整性与时效要求，不能让校验函数替代整个同步策略。

测试可以用表格列出身份缺失、未知操作、媒体类型不匹配、事件状态矛盾和两个合法终态。比起只写“成功推送能显示”，这些反例更能说明边界是否可靠。协议支持范围明确后，用户界面才能对未知消息保持保守，而不是制造虚假的完成感。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-07-24 · 整理日期：2026-09-22。

- 仓库：`pic-agent-android`
- 固定提交：`abb6a7a4ab5e3f557d73ac5ea6d6f2a14314c342`
- 文件：`domain/center/src/main/java/com/onion/picagent/center/ui/push/GenerationTaskTerminalValidator.kt`

</details>

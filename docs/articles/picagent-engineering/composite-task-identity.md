把图片、视频、音色和角色世界任务放进同一个列表之后，一个看似简单的字段会暴露问题：不同任务命名空间里可能有相同的数字 ID。PicAgent 的 KMP 统一任务模型用复合身份明确区分它们，同时保留协议向前兼容空间。

## taskId 需要和类型一起理解

```kotlin
@Serializable
data class GenerationTaskRef(
    val taskType: Int,
    val taskId: Long,
)
```

列表 key、状态查询、局部更新和去重都应该基于完整身份。如果只用 taskId=12，图片任务与世界任务就可能互相覆盖。这种问题通常在单业务列表里不明显，聚合后才出现。

游标同样包含 createTimeMillis、taskId 和可空 taskType。第三个字段为旧协议保留兼容空间，意味着消费方需要认真处理旧游标缺少平局裁决项的情形，不能随便把 null 当成一个真实任务类型。

## 公共 DTO 保留原始判别值

GenerationTaskItem 的 taskType、publicStatus、taskStage 和 refundStatus 使用整数，KMP 不在 DTO 层推断终态、重试策略或平台导航。这样服务端增加未知值时，协议数据仍然可以保留，由上层明确决定如何展示或拒绝。

这并不意味着未知值都应该正常展示。相反，各平台应有集中、可审查的支持范围，不能在不同页面把同一个未知状态分别当作成功、处理中或失败。

模型还直接提供 canRetry。客户端应把它当作服务端能力信号，而不是看到失败状态就自动显示重试按钮。退款状态与任务失败也分开保存，因为它们不是同一个生命周期。

## 构造成功与请求合法分开

列表请求中的 pageSize 默认 20，并通过 EncodeDefault(ALWAYS) 明确序列化默认值。批量状态请求保留旧 taskIds，同时增加 taskRefs，注释要求两者恰好一个非空，校验放在仓储预检查中。

```kotlin
data class GenerationTaskStatusReq(
    val taskIds: List<Long> = emptyList(),
    val taskRefs: List<GenerationTaskRef> = emptyList(),
)
```

这里省略了源码上的 Serializable 注解。公开构造不抛异常，方便 Kotlin 与 Swift 使用一致的入口；参数是否合法则由仓储返回可处理结果。保持旧参数位置，也是在减少跨平台调用迁移成本。

## 统一列表不意味着统一结果形状

结果对象包含媒体、音色与人格预览等可空字段。统一的是任务外壳与身份，不是强行让所有任务都拥有一个视频 URL。平台展示时仍需根据支持的任务类型解释相应字段，并给缺失预览提供合理回退。

可空字段很多时，更需要协议校验，而不是随便选第一个非空 URL。某个任务声明成功却缺少必要结果，应该被识别为异常状态，不能跳转到错误页面。

设计聚合模型时，我会先列出所有原命名空间，再检查主键、游标、去重和更新路径是否都使用完整身份。只有 DTO 改成复合 key，而 UI 仍按裸 ID 更新，问题并没有真正解决。这也是跨端共享协议最有价值的部分：把容易被各平台忽略的身份规则先写清楚。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-07-27 · 整理日期：2026-09-22。

- 仓库：`pic-agent-kmp`
- 固定提交：`8b2df63ff462aa4108fd4c3a5c1890fd44374264`
- 文件：`shared-home/src/commonMain/kotlin/com/onion/picagent/kmp/home/model/generationtask/GenerationTaskModels.kt`

</details>

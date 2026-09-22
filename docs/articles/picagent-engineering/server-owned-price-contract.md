购买协议如果让客户端直接提交金额，会把界面展示值和交易裁决混在一起。PicAgent 的 KMP App 商业模型采用另一种边界：客户端提交所选方案的身份，服务端返回实际成本、钱包与完整布局快照。

## 请求里故意没有价格

源码中的安装/解锁请求包含 requestId、appKey 和 planType；订阅请求则使用不可变报价身份 planCode：

```kotlin
@Serializable
data class CharacterWorldAppSubscriptionReq(
    val requestId: String,
    val appKey: String,
    val planCode: String,
)
```

用户选择的是某个服务端报价版本，而不是一个本地算出来的金额。客户端仍然需要展示价格并让用户确认，但这份展示不能成为最终扣款依据。

requestId 负责同一尝试的幂等身份，planCode 负责报价身份，appKey 负责购买对象。三者解决不同问题，不能用其中一个代替另外两个。

## nullable 字段不应自动补成免费

市场摘要包含 canInstallForCharacter、installPlanType 和 installPriceInspiration。模型注释明确，只有允许安装时，相关方案字段才构成可提交报价；禁用项目可能保留部分信息，KMP 不提供默认价格。

这对 UI 很重要。`null` 可能表示没有可购买报价，并不等于 0。若客户端为了让按钮工作而补一个默认价，会把协议不完整变成错误购买入口。更合理的是保持不可提交状态，并等待新的权威目录。

同理，展示“已安装”和展示“可安装”也不是一个布尔值的正反面。一个 App 可能尚未安装，但当前不允许购买，界面需要能够表达这个组合。

## 返回值负责更新事实

```kotlin
@Serializable
data class CharacterWorldAppMutationResp(
    val characterId: Long,
    val appKey: String,
    val costAmount: Long,
    val walletBalance: WalletBalanceResp,
    val apps: CharacterWorldAppListResp,
)
```

交易响应同时提供实际成本、钱包与完整 App 布局。消费方因此可以基于同一次结果更新界面，而不是先自己减去展示价格，再猜一个已安装状态。

这不意味着前端可以完全省略校验。返回对象应匹配当前角色、App 和请求归属；账号或页面已经变化时，旧响应不能写进新页面。DTO 只表达契约形状，具体接纳规则在消费层。

## 报价变化应该成为可理解的分支

模型定义了 SUBSCRIPTION_OFFER_CHANGED 业务码。它表达用户选择的版本已经不可购买，需要重新获取报价和确认，而不是静默改成最新价格继续提交。

当用户修改选择时，应开始新的尝试身份；响应丢失但用户意图未变时，则需要按服务端幂等协议重试或查询原尝试。这是接口设计建议，单看模型文件不能证明服务端重放流程已经正确实现。

这种协议把产品承诺拆得很清楚：客户端负责表达选择，服务端负责裁决与返回事实，报价版本负责连接两者。它比在各端复制价格计算逻辑更容易保持一致，也更容易解释一次交易为什么被拒绝。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-10 · 整理日期：2026-09-22。

- 仓库：`pic-agent-kmp`
- 固定提交：`87d30e6da8247bf1930570038d90db27eba89955`
- 文件：`shared-character/src/commonMain/kotlin/com/onion/picagent/kmp/character/model/world/CharacterWorldAppCommerceModels.kt`

</details>

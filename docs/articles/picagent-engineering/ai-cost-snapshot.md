AI 功能的成本页面如果只展示一个金额，很难解释这个数字从哪里来。模型选择、成本档位和价格资料都会变化。PicAgent 的 DebugAiCostService 把当前运行配置投影成一个只读快照，让一次估算具有可追溯的上下文。

## 先读一份配置，再计算展示

源码先取得 runtimeSnapshot，再从其中读取 selection；响应中的 revisionId、source、costLevel 和模型身份都来自这次读取。下面是实际片段：

```kotlin
val runtimeSnapshot = aiRuntimeConfigService.current()
val selection = runtimeSnapshot.selection
return DebugAiCostSnapshotResp(
    revisionId = runtimeSnapshot.revisionId,
    source = runtimeSnapshot.source.name,
    costLevel = selection.costLevel.name,
```

这段是响应构造的开头。意义在于避免一次响应里混入两次读取的配置：例如页面写着经济档，成本目录却按刚刚切换的高质量档计算。配置有版本，调试结果才有解释基础。

响应后续还包含币种、地区、价格快照日期、计价依据和说明。这些字段告诉阅读者数字的适用条件，而不是把估算伪装成实时账单。实际费用应以使用时的供应商价格和账单为准。

## 调试能力应先经过开关

```kotlin
require(userId > 0) { "用户未登录" }
if (!debugControlService.isEnabled()) {
    throw ResponseStatusException(HttpStatus.NOT_FOUND, "调试成本核算未开启")
}
```

顺序很重要：开关关闭时，在读取运行快照之前退出。它让“功能不可用”成为明确的服务边界，而不是先读完内部配置，再依赖前端隐藏卡片。

这里只能证明该服务要求传入已解析的正数用户 ID；完整认证仍然依赖上游入口，不能因为出现 `require(userId > 0)` 就声称它能验证任意身份。服务注释也明确，用户 ID 不进入响应或差异化成本目录。

## 成本估算、业务扣费和实际支出应分开

一个生成动作可能包含文本、图像和视频多个阶段。页面估算回答“按当前配置大概需要怎样的资源”，业务扣费回答“产品向用户收取什么”，供应商结算回答“实际发生了多少费用”。三者的时间、单位和失败处理都不同。

如果把三者压成同一个数字，退款、重试和模型降级就很难解释。我的设计建议是让估算保留版本与假设，让结算记录绑定真实请求与用量，让用户钱包遵循稳定的业务规则。这是从当前快照接口延伸出的建议，不代表本文件已经实现结算系统。

## 信息足够解释，但不暴露完整配置

这个服务返回 providerId 和 model 等必要目标信息，未把完整 endpoint、secret、Prompt 或路由目录直接放进响应。调试页面的职责是帮助理解成本，不是成为运行配置下载入口。

评估一个类似接口时，可以检查同一次响应中的版本是否一致、关闭开关后是否提前退出、价格日期是否可见，以及前端是否明确区分估算与实付。对于未知配置，宁可显示无法估算，也不要补一个看起来合理的默认数字。

这份代码比较短，却体现了一个有用的产品判断：解释型页面的核心不是数字多，而是读者能知道每个数字依赖哪些前提。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-25 · 整理日期：2026-09-22。

- 仓库：`pic-agent-java`
- 固定提交：`44485d372b1dab973f56d1aef603201d778f9940`
- 文件：`agent-user/agent-user-service/src/main/kotlin/com/onion/picagent/service/debug/aicost/DebugAiCostService.kt`

</details>

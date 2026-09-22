## Repository 变大之后，问题不只是文件长

一个世界页面会逐渐拥有创建、详情、布局、商城、订阅、相册和预览。把它们放在一个 Repository 里，调用入口看起来统一，依赖却会越来越宽：只需要保存布局的 Store，也能看到所有付费和生命周期操作。

这次调整之前，相关文件同时承载公开操作、Ktor 实现、协议异常、校验、Preview 元数据和布局解码。真正需要解决的是这些行为由谁负责，而不只是把文件切成几段。

## 按业务边界拆，调用方才会变简单

最终公开能力分为 Lifecycle、Layout、Commerce 和 Album；Memory 与 Storyline 保持独立。Layout 的接口很小：

```kotlin
interface KmpCharacterWorldLayoutRepository {
    suspend fun apps(characterId: Long): ApiState<CharacterWorldAppListResp?>

    suspend fun saveLayout(
        characterId: Long,
        req: CharacterWorldLayoutSaveReq,
    ): ApiState<CharacterWorldAppListResp?>
}
```

这里省略了源码注释。布局 Store 现在只依赖这两个能力，不再持有整个 World Repository。接口因此不只是给实现起了名字，还在编译层面缩小了调用方能做的事。

相对地，安装、解锁、订阅保留在 Commerce，避免把同一付款边界拆散成多个看似通用的小助手。好的拆分不是方法越少越好，而是一起变化、一起承担结果的行为能留在一起。

## 装配集中，不等于继续暴露全能门面

`CharacterRepositories` 保留统一工厂入口，让各能力使用同一个认证客户端与全局处理器。原始 Preview remote 则作为内部细节，由工厂装配到 Provider，不通过强制转换从一个公开 Repository 偷取。

这区分了两种“统一”：创建依赖可以集中，消费能力仍然可以收窄。若为了接线方便又把所有方法包回一个兼容门面，调用方就很容易继续依赖旧的宽接口，实际收益会被抵消。

这一历史版本选择明确打断旧公开形态，没有保留 deprecated facade。它是一次需要消费方迁移的变更，不能只看到共享模块编译成功，就宣称所有平台已经兼容。特别是 Apple 侧导出和采用需要单独证据。

## 错误文字不能同时担任协议和 UI

另一个很有价值的调整，是让本地协议失败拥有明确的 operation 与 violation。调用方根据类型、错误码和数据判断，而不解析某句英文 message。

原因很直接：一句诊断文字可能被润色、翻译或改写，不应因此改变支付恢复逻辑。服务端已经提供的信息也不能被一刀切清空；设计区分了远端原始失败和本地合成失败。

这让我更倾向于把错误拆成三件事：程序可以依赖的身份、排查需要的诊断，以及用户应该看到的反馈。它们可以关联，但没有必要强行塞进同一个字符串。

## “付费已提交但布局有问题”尤其不能自动重提

共享层保留了付款身份和费用验证后的结果边界。如果业务提交已经被确认，随后布局结构不合法，正确的恢复方向是重新获取权威 Apps，而不是再次提交安装。

这个状态用特定异常子类型表达。否则平台只看到一个普通失败，很容易套用通用重试按钮，再次发起付费动作。

同样，Preview 的静默失败、Retry-After、取消传播和 last-good 都有自己的归属。不能因为拆分 Repository，就把它们顺手改成统一 Toast 或把协程取消转换为普通错误。

## 我会怎样判断拆分是否完成

比目录结构更值得检查的是依赖签名：Store 真的只接收 Layout 吗？Preview 还有没有 cast 或旧门面回退？完整布局规则是否仍然只有一个权威实现？平台是否还在解析 message？

架构边界最终要落在这些调用关系上。文件名只是提示，类型和实际依赖才决定维护时能否少想几件事。

## 参考代码

- `shared-character/.../data/KmpCharacterWorldLayoutRepository.kt`
- `openspec/changes/refactor-character-world-data-boundaries-kmp/design.md`

_代码版本日期：2026-09-01 · 整理日期：2026-09-22。 参考提交：`6891102`。_

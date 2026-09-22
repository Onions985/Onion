跨平台共享最容易陷入两个极端：只共享几个数据类，收益有限；或者把文件、导航、权限和界面状态全部塞进公共模块，最后每个平台都充满条件分支。更稳妥的做法是按业务语义共享，把平台能力收敛成窄接口。

## 先找不会随平台改变的规则

例如离线笔记的标题不能为空、远程响应需要校验、分页游标不能倒退，这些规则在 Android 和 iOS 上通常一致。相机权限提示、系统分享面板和页面返回行为则直接依赖平台体验。

公共模块不必知道 Android Context 或 UIKit 控制器。它可以依赖一个描述业务能力的接口，让平台提供实现：

```kotlin
data class StoredAttachment(
    val id: String,
    val mimeType: String,
    val byteCount: Long,
)

interface AttachmentStore {
    suspend fun save(bytes: ByteArray, mimeType: String): StoredAttachment
    suspend fun read(id: String): ByteArray?
    suspend fun remove(id: String)
}

class SaveAttachment(private val store: AttachmentStore) {
    suspend operator fun invoke(bytes: ByteArray, mimeType: String): StoredAttachment {
        require(bytes.isNotEmpty())
        require(bytes.size <= 2 * 1024 * 1024)
        require(mimeType in setOf("image/jpeg", "image/png"))
        return store.save(bytes, mimeType)
    }
}
```

这是小附件教学接口。MIME 字符串校验不能验证实际文件内容，生产实现还应检查文件签名、解码能力和用途。大文件不适合整份 ByteArray，应使用流或受控文件句柄，但平台句柄如何跨边界需要重新设计。

## expect/actual 应该有明确的用途

对于少量确实按编译目标变化的能力，可以用 expect/actual 声明平台实现。它不是所有依赖都必须经过的入口。普通接口可以在同一个平台提供多个实现，也方便注入测试版本。

例如生产环境使用磁盘，测试使用内存，预览使用只读样例，这些是运行配置差异，并不等同于 Android 与 iOS 的编译目标差异。使用接口表达更自然；如果需要平台工厂，再让 expect/actual 负责那一小段装配即可。

Kotlin 官方文档也建议优先考虑标准接口与工厂。具体语言特性的稳定性随版本变化，迁移时应核对项目实际 Kotlin 版本，而不是照抄当前网页的编译开关。

## 数据边界应对平台友好

公共 API 如果返回 ORM 实体、复杂数据库游标或平台异常，会把内部实现传给所有消费者。更好的边界是稳定值对象和可解释的错误类型。Swift 调用方不应为了展示一个空列表，理解底层 SQL 异常的字符串。

同时，不要因为共享代码可以抛异常，就把所有构造校验都放在公开 DTO 初始化中。平台间桥接的错误处理体验不同，参数校验可以放在仓储入口，返回一致的失败结果。选择抛异常还是结果类型，应保持整个模块的一致约定。

日期、金额、ID 也要明确单位与精度。`Long` 表示毫秒还是秒，不应该靠调用方猜。服务端大整数经过 Web 或 JSON 中间层时，还需要考虑精度边界，类型共享不能代替协议设计。

## 共享模块不拥有所有生命周期

页面关闭时取消的请求，可以由页面作用域拥有；多个页面共用的缓存刷新，应由仓储或数据库实例拥有。账号清理则是更高层的会话边界。把所有协程都放到一个全局 scope，会让平台侧很难判断何时可以释放资源。

接口文档最好说明：取消是否会传播、结果是否可能来自缓存、同一个请求是否合并、清理操作是否等待旧工作退出。它们比“这个方法是 suspend”更能帮助使用者正确集成。

## 以替换成本判断边界质量

一个实用检查是：把磁盘实现替换成内存实现，是否需要修改业务用例？把 Android 页面换成 iOS 页面，是否需要把 UI 类型塞回公共层？如果每次平台变化都触及公共业务规则，边界可能过宽。

测试应覆盖共享不变量，再在各平台验证真实文件、权限和生命周期。共享测试通过，不等于已经验证 iOS 文件保护或 Android 进程恢复。KMP 的目标是让一致的规则只维护一次，同时保留平台对真实运行环境的责任。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2025-03-08 · 整理日期：2026-09-22。

- [Kotlin Expected and Actual Declarations](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html)

</details>

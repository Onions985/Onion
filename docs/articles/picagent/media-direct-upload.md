把文件直接上传到对象存储，可以减少业务服务转发文件的职责，但“客户端说上传好了”不能成为业务绑定的依据。PicAgent 这次媒体直传把流程拆成 prepare、PUT、complete 和业务绑定四步，每一步承认的事实都不同。

## 上传完成之前，先有上传身份

认证后的 prepare 接口为文件创建 `uploadId`，记录用户、用途、类型、长度、内容摘要和对象 key。`user + clientRequestId` 在有效生命周期内用作幂等身份。

客户端重试 prepare 时，如果这些文件属性改变，服务端会拒绝复用同一个请求 ID；已经 READY 或 BOUND 的记录可以返回相同 uploadId，但不再返回新的 PUT 地址。

因此，uploadId 不只是一个图片 URL。它让服务端可以判断“谁上传的、准备做什么、是否已经被使用”。

## PUT 使用独立的匿名客户端

KMP 的 `KmpDirectUploadRepository` 对文件字节做一次有界复制，让 prepare 计算摘要与实际 PUT 使用同一份数据。业务 API 使用原有认证客户端，签名 PUT 使用 `createAnonymousUploadHttpClient` 创建的独立客户端。

这避免把业务 Authorization、Cookie 等请求头附带到对象存储地址上。代码还会验证返回的上传地址和必需请求头，并禁止把这些认证 header 当成上传 header 接受。

网络超时也不立即意味着文件没有落盘。该实现对部分不确定 PUT 结果继续调用 complete，由服务端核验对象；协程取消则继续抛出取消异常，不伪装为一次成功上传。

## READY 与 BOUND 是两个事实

| 状态 | 代表什么 |
| --- | --- |
| PREPARED | 上传身份已创建，可以在期限内发送文件 |
| READY | 服务端确认对象满足本次上传约束 |
| BOUND | 已在业务事务中绑定到真实业务记录 |
| DELETING | 已进入清理流程，不能再作为新业务输入 |

complete 不只检查“URL 能打开”。项目实现核对对象类型、内容摘要、长度和 Content-Type；图片还会验证实际格式。只有通过这些校验才转为 READY。

READY 仍然不等于已经发布头像、消息或音色。最终业务操作还必须验证归属和用途，并在自己的事务中消费这份资源。

## 业务失败不能消耗上传

`ClientUploadBindingService` 把资源锁定和绑定放入业务事务。多文件先排序加锁，但返回时保持调用方原来的顺序；获得真实业务 ID 后，才写入绑定引用。

一个容易遗漏的细节是，业务可能返回失败包装对象而不抛异常。原实现专门处理了这种情况：

```kotlin
fun <T> write(block: () -> HttpWrapper<T>): HttpWrapper<T> =
    requireNotNull(transactionTemplate.execute { status ->
        block().also {
            if (it.code != HttpCode.SUCCESS) status.setRollbackOnly()
        }
    })
```

这避免出现“业务拒绝了，上传却已经变为已消费”的半成功状态。它只解决本地事务中的原子性，对象存储上的 PUT 本身仍然是独立外部操作。

## 回收必须只处理自己的资源

这个能力只管理专用 `client-upload/` 前缀，不迁移生成媒体、故事线素材或旧 multipart 对象。PREPARED 和未绑定 READY 有有效期；普通永久 BOUND 与临时私有音频源采用不同回收规则。

清理不是一条“删掉所有旧文件”的命令，而是依赖数据库状态、截止时间和租约推进的流程。迟到 PUT、业务消费、资源删除需要各自保留可判断的身份。

源码依据：Java 提交中的 `service/upload/ClientUploadService.kt`、`ClientUploadBindingService.kt` 和 `project/client_media_upload.md`，以及 KMP 提交中的 `shared-core/.../upload/KmpDirectUploadRepository.kt`。该版本的直传能力默认关闭。启用前需完成 V126 迁移，并配置 OSS、CORS 与访问权限。

_代码版本日期：2026-09-07 · 整理日期：2026-09-21。 参考提交：`09d33142`、`9f64ab8`。_

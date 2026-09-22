访问令牌过期时，每个业务 Repository 都自己处理 401，会把刷新、重试和退出登录散落到整个工程里。PicAgent 的这次改动把“识别 401 并重放请求”收进 `shared-core`，同时没有让网络基础层反向依赖登录模块。

## 网络层只依赖一个刷新契约

`NetworkAuthRefreshHandler` 接受失败请求使用的访问令牌，返回是否成功恢复；它还可以判断当前 URL 是否应该进入刷新流程。

```kotlin
interface NetworkAuthRefreshHandler {
    suspend fun refreshAccessToken(failedAccessToken: String?): Boolean

    fun shouldHandleUnauthorized(url: String): Boolean {
        return PicAgentAuthUrls.shouldHandleUnauthorized(url)
    }
}
```

这个接口解决的是依赖方向。`shared-core` 知道什么时候需要恢复认证，平台层知道令牌存在哪里、怎样调用刷新接口，以及什么情况下退出登录。接口本身没有实现并发合并刷新，不能仅凭这段定义就宣称多个 401 一定只发出一次刷新请求。

## 一次原请求，最多一次认证重试

`PicAgentHttpClientPlugins.kt` 使用 Ktor 的 `HttpSend` 拦截发送过程，配置 `maxSendCount = 2`。第一次请求结束后，它同时检查 HTTP 状态、重试标记和 URL 范围。

```kotlin
val alreadyRetried = request.attributes.contains(authRetryAttribute)
val shouldRefresh = call.response.status == HttpStatusCode.Unauthorized &&
    !alreadyRetried &&
    authRefreshHandler.shouldHandleUnauthorized(request.url.toString())

if (!shouldRefresh || !authRefreshHandler.refreshAccessToken(failedAccessToken)) {
    return@intercept call
}
```

上面是原拦截器中的局部摘录。恢复成功后，代码重新读取 `requestContextProvider.current().accessToken`，删除旧的 Authorization 请求头，写入新值，并在请求 attributes 中标记已重试，然后再次 `execute(request)`。

这里不能只刷新存储里的令牌却原样重发旧请求：原请求对象可能仍然携带旧 header。重新读取并替换 header，才把“认证状态更新”落实到这一次网络发送。

Ktor 官方的 [HttpSend 文档](https://ktor.io/docs/client-http-send.html) 展示了拦截发送并调用 `execute` 的机制；本文的重试次数和判断条件则来自 PicAgent 当时的代码。

## 刷新请求自己不能再触发刷新

`PicAgentAuthUrls` 排除了登录、验证码、刷新令牌等接口路径。`createLoginRepository` 创建客户端时也没有注入 `authRefreshHandler`。

这形成两道边界：业务请求可以恢复认证；负责恢复认证的请求不能递归进入同一流程。否则刷新接口自身返回 401 时，容易变成“刷新失败 → 再刷新”的循环。

历史实现用 URL 字符串包含关系识别这些认证路径。它是该版本的实际做法，不是一个适用于任意 URL 结构的精确路由匹配器；后续扩展认证入口时，需要同步检查这个范围。

## 返回最终调用，而不是包装一个假成功

刷新失败、拿不到非空新令牌，或者请求不在处理范围内，拦截器都返回原调用。成功重试则返回第二次调用，由 Repository 继续按照既有响应结构解码。

| 情况 | 拦截器行为 |
| --- | --- |
| 非 401 | 返回原调用 |
| 认证接口自身 401 | 不进入自动刷新 |
| 刷新失败或新令牌为空 | 返回原调用 |
| 业务请求 401 且恢复成功 | 替换令牌后重试一次 |

这次改动的价值是把恢复认证放在一个可追踪的位置。它没有把所有请求错误变成成功，也没有把网络基础模块变成登录业务模块。

源码依据：`pic-agent-kmp@be0ad66` 的 `shared-core/.../network/NetworkAuthRefreshHandler.kt`、`PicAgentHttpClientPlugins.kt` 和 `shared-login/.../data/LoginRepository.kt`。

_代码版本日期：2026-04-28 · 整理日期：2026-09-21。 参考提交：`be0ad66`。_

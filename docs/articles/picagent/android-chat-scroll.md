聊天页里，用户正在翻看历史消息，列表却突然回到最新一条。这类问题常被归结为“Compose 重组导致跳动”，但在 PicAgent 的这次修复中，更直接的原因是自动滚动的触发条件过宽。

修复集中在 `UserChatRoute.kt`：收窄谁可以请求滚动，并移除 ViewModel 中缓存的页面可见性判断。

## 列表位置是现场状态，不是长期业务事实

旧逻辑通过 `snapshotFlow` 观察最新消息是否可见，再把结果写入 ViewModel 的 `latestMessageVisible`。收到消息刷新时，如果这个缓存值为 true，就请求滚动到底部。

问题在于，消息更新与列表布局并不是同一时刻完成的。一个曾经为 true 的可见性值，不能持续代表用户现在愿意被带回最新消息。把这个值跨层保存后，ViewModel 就开始根据可能过时的 UI 信息决定导航式行为。

这次提交删除了 `latestMessageVisible` 及对应回调。收到对方新消息后，仅累计提示数量：

```kotlin
if (incomingCount > 0) {
    _newMessageCount.value = _newMessageCount.value + incomingCount
}
```

数据刷新仍然发生，只是不再由收到消息这件事直接发出“滚动到最新”的命令。

## 哪些动作仍然允许自动滚动

修复没有彻底禁止滚动，而是保留了能解释用户意图的入口。

| 触发场景 | 该提交的行为 |
| --- | --- |
| 首次加载历史消息 | 定位到最新消息 |
| 本人发送消息并加入待发送记录 | 请求滚动到最新 |
| 点击新消息提示 | 请求滚动到最新 |
| 收到对方新消息并刷新历史 | 累计提示，不直接请求底部滚动 |
| 打开键盘 | 只有满足额外条件才跟随 |

这张表比“减少重组”更接近实际产品规则。重组负责更新 UI，是否改变阅读位置则应有单独、明确的触发来源。

## 键盘跟随要识别状态变化

原来只要键盘处于可见状态，并满足底部判断，就可能触发跟随。修复增加了 `previousKeyboardVisible`，要求这一次真的是从隐藏变成显示：

```kotlin
LaunchedEffect(isKeyboardVisible) {
    val openedFromHidden = isKeyboardVisible && !previousKeyboardVisible
    previousKeyboardVisible = isKeyboardVisible
    if (openedFromHidden && wasAtBottomBeforeKeyboard && messages.isNotEmpty()) {
        delay(200)
        listState.animateScrollToItem(0)
    }
}
```

这是提交中的原片段。它同时要求：键盘刚打开、打开前位于最新位置、列表非空。200 毫秒是这份实现的等待值，并不是所有聊天应用都应该使用的通用参数。

`LaunchedEffect` 在进入组合时启动，key 变化时取消旧协程并重新启动，具体机制见 [Compose 副作用文档](https://developer.android.com/develop/ui/compose/side-effects)。因此，仅仅“把滚动放进 LaunchedEffect”还不够，key 和内部业务条件都要表达真正的触发意图。

## 如何验证滚动行为

该版本通过了 `feature:home:compileDebugKotlin` 编译。滚动体验还需要在实际登录后的聊天页面中验证，重点检查浏览历史、接收新消息和主动回到底部这几种操作。

源码依据：`pic-agent-android@c3c2dca0` 的 `feature/home/.../engine/message/UserChatRoute.kt`，以及 `openspec/changes/p0-user-chat-preserve-scroll/`。可复用的经验是：先列出允许改变阅读位置的动作，再检查每个滚动调用是否真的由这些动作触发。

_代码版本日期：2026-06-17 · 整理日期：2026-09-21。 参考提交：`c3c2dca0`。_

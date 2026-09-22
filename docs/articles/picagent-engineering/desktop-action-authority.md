桌面卡片显示得快，通常依赖缓存与预览；点击入口是否可执行，却需要当前账号和最新业务状态。PicAgent 的 Android AppActionAuthority 把两件事分开，避免一个还留在屏幕上的旧卡片继续打开已经失效的功能。

## 点击先生成带上下文的请求

WorldDesktopAppActionRequest 不只包含 action，还带 characterId、layoutVersion、appKey、appCode、accessState 和报价等信息。请求从当前 content 里的 canonical item 生成，不直接信任 UI 传来的旧对象。

这让点击成为一次可检查的意图：“我要在这个角色、这个布局版本上打开这个 App”。如果布局刷新或身份变化，后续层可以判断它是否还有效。

## 总开关之后还有逐项核验

```kotlin
internal val CharacterWorldUiState.appActionsEnabled: Boolean
    get() =
        authorityState == CharacterWorldAuthorityState.CONFIRMED &&
            content is CharacterWorldContentState.Enabled &&
            !layoutEditState.isEditing
```

这是源码中的公共门禁。接下来 allowsDesktopAppAction 还比较角色 ID 和 layoutVersion，再按 AppMarket 或 Grid 的不同入口检查当前项目是否唯一匹配。

所以“页面已经启用”不是所有卡片都能点击的充分条件。App 的动态身份、renderer 和 footprint 还要属于明确支持的组合。未知组合不会因为看起来像一个熟悉图标就获得原生导航能力。

## 预览内容不能成为授权来源

源码在 final resolver 中强调，预览只影响卡片和页内展示，不参与 route authority。MBTI、故事订阅与内容入口会根据 owner、accessState 和具体 authority 分别解析。

例如锁定项目对访问者可能打开解锁流程，对角色所有者却不一定适用同一动作；已解锁项目也可能区分 owner 与访客只读入口。把这些差异留给统一 resolver，比在每张卡片的 onClick 里重复写条件更容易审查。

这仍然只是客户端体验门禁。服务端必须独立检查访问权限，不能因为 Android 已经校验过就省略。客户端检查可以避免错误导航和过期界面操作，但不能作为安全边界的唯一实现。

## 为什么路由执行前还要再看一次

点击、ViewModel 处理和 HostRoute 执行之间可能发生状态更新。如果只在最早的 onClick 判断，队列中的旧动作仍可能晚到。请求携带版本，各层以最新快照复核，就能在最后的可见副作用之前拒绝过期意图。

这不意味着每层都重新发网络请求。源码利用最新 UiState 与 canonical wire 做检查；什么时候刷新权威数据属于外层流程。要避免把“多层校验”误实现成每次点击重复调用多个接口。

## 产品上的反馈也应区分原因

布局变更导致旧点击被拒绝时，合理行为可能是等待新布局或请用户重试；权限失效可能需要退出子页面；报价变化则需要重新确认。虽然都可以归为 rejected，外层仍需要提供符合上下文的体验。

验证可以模拟卡片渲染后布局版本更新、账号变化、进入编辑模式和未知 renderer。重点看最终是否发生导航，而不是按钮颜色有没有变灰。这个设计表达了一条可复用的原则：展示快照可以稍旧，操作资格必须在发生副作用时仍然成立。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-23 · 整理日期：2026-09-22。

- 仓库：`pic-agent-android`
- 固定提交：`4043cd569cece11f58b611182d9d79a021feb5ca`
- 文件：`feature/characterworld/src/main/java/com/onion/picagent/characterworld/engine/world/CharacterWorldAppActionAuthority.kt`

</details>

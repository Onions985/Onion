一个 App 使用自己的颜色表，又允许用户选择跟随系统、浅色或深色时，容易出现局部界面与系统控件外观不一致。PicAgent 的 AppThemeBox 把最终生效外观单独建模，并通过 SwiftUI Environment 与色板一起传递。

## 用户选择和最终外观是两层事实

preferredColorScheme 可以为空，表示跟随系统；最终生效外观则总是 light 或 dark。解析规则在源码里很直接：

```swift
switch preferredColorScheme ?? systemColorScheme {
case .light:
    return .light
case .dark:
    return .dark
@unknown default:
    return .dark
}
```

显式选择优先，系统外观只在用户没有覆盖时参与。把最终值独立出来，可以让不同承载树使用同一个已解析事实，而不是每个组件重新猜测当前模式。

默认色板与默认 appearance 都是深色，避免预览或测试脱离完整 AppThemeBox 时出现混合默认值。这不是说所有产品都应该默认深色，而是默认环境的各个字段应该相互一致。

## 色板与系统外观要一起注入

```swift
content
    .environment(\.picAgentThemeColors, colors)
    .environment(\.picAgentThemeAppearance, appearance)
    .preferredColorScheme(preferredColorScheme)
```

ThemeColors 负责产品自定义颜色，appearance 负责传递已经解析的明暗事实，preferredColorScheme 则表达用户偏好。只替换自定义背景色，系统输入控件或其他标准组件仍可能使用另一套外观。

需要注意，这份组件接收 colors，而不是在内部根据 appearance 自动生成色板。调用方仍有责任提供匹配的颜色集合，不能仅凭三个修饰器就断言永远不会出现不一致。

## UIKit hosting 边界需要显式关注

源码注释强调，UIKit 隔离承载的 SwiftUI 子树需要继续注入已解析的主题环境。新建 hosting controller 往往意味着建立了新的环境边界，不应该默认它能够继承原 SwiftUI 树里的全部自定义值。

集成时应检查弹窗、导航包装、系统分享预览以及独立窗口等路径。主页面切换正确，不能证明所有通过 UIKit 创建的子树也正确。

这一点还影响预览与测试：如果只提供自定义颜色，却没有相应 colorScheme，系统控件的对比度与材质表现可能与真实页面不同。测试环境应尽量成对提供主题事实。

## 主题状态不要散落在组件里

如果每个组件都直接读取持久化配置，跟随系统时就容易出现更新时间不一致；如果每个页面保存一份 isDark，又会增加同步成本。更好的方向是在应用边界解析偏好，再通过环境传递展示所需数据。

业务组件可以依赖语义颜色，例如正文、次要文本和分隔线，而不是自己根据 dark 布尔值硬编码两个十六进制颜色。这样调色板更新时不需要逐页查找条件分支。

验证矩阵可以包含显式浅色配深色系统、显式深色配浅色系统、跟随系统切换，以及跨 hosting 边界打开页面。它提供的关键思路是：偏好、有效外观与颜色表分别有职责，但交付到界面时必须保持一致。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-07-12 · 整理日期：2026-09-22。

- 仓库：`pic-agent-ios`
- 固定提交：`4fe649e34eea51069237265286ffe223b6a65c4c`
- 文件：`Sources/Resource/Theme/AppThemeBox.swift`

</details>

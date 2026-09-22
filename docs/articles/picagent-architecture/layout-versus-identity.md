## 一个位置字段，可能偷偷承担两份责任

Character World 的 App 有服务端 canonical 布局，也有 owner 调整后的共享布局。安装新 App 时，用户希望它出现在当前桌面可用的位置；系统还需要保持 canonical binding 的有效锚点。

两者看起来都是 page、row、column，却不是同一份事实。如果把当前桌面的空位直接当作 canonical 锚点保存，可能在另一套布局中发生冲突。

这次修复把两个规划结果明确分开。对我来说，它也是一个很典型的建模提醒：字段类型相同，不代表字段含义相同。

## 返回值先把差异说清楚

`CharacterAppInstallLayoutPolicy` 的成功结果定义为：

```kotlin
data class Planned(
    val items: List<CharacterWorldUserLayoutItem>,
    val bindingAnchor: CharacterWorldGridFootprint,
) : Result
```

`items` 保存 owner 实际布局，`bindingAnchor` 用于 canonical binding。调用方不必从同一份坐标猜测它现在代表哪一种用途。

一个清楚的返回类型经常比更多注释有效：如果两个事实确实会不同，就让它们成为两个明确值。相反，长期要求所有调用方记住“这个字段在某种情况下另有含义”，维护成本会随入口数量增加。

## 先理解当前有效布局，再找位置

规划不是简单扫描已有数据库行。没有启用 override 时，使用 canonical 布局；启用后，需要检查 header、指纹和保存的 items，必要时执行既有 reconciliation。

这一步的目的，是确保后续找空位依赖的是一份有效、可解释的布局，而不是已经过期的坐标集合。若前提不成立，返回 InvalidLayout，比在坏数据上继续安装更容易恢复。

候选 App 自身也要检查尺寸枚举与列、行跨度一致。尺寸元数据若互相矛盾，“找到了一个空格”并不能证明组件可以放进去。

## first-fit 要检查完整矩形

源码按 page、row、column 的顺序寻找第一个满足规则的 footprint。这里的 footprint 包含位置和 columnSpan、rowSpan。

不能只检查左上角是否空闲。一个 2×2 组件的起点没有占用，右下角仍可能与已有组件重叠，或者超出页面边界。完整矩形校验把这些条件集中到已有布局策略里。

这个算法的目标是确定性的首个可用位置，不是全局最优排列，也不会为了安装一个新 App 就重排用户已有组件。它兑现的是有限但清楚的产品行为：保留现有有效位置，在规则内寻找空位。

## 两次寻找，对应两套坐标事实

该版本先在 owner 有效布局上计算 `ownerLayoutAnchor`；再把 canonical App 位置转换为 placements，单独计算 `bindingAnchor`。

新 App 以 owner 锚点加入实际布局，完整的新列表再次通过布局验证，最后才返回成功。返回值携带的 canonical 锚点则供绑定使用。

这里没有因为两次计算看起来相似就强行复用结果。可以复用的是 first-fit 算法，不能合并的是两套输入代表的业务事实。

## NoSpace 和 InvalidLayout 也值得分开

当前有效桌面确实没有空间，是一种正常业务结果；布局本身不能被可信解释，则是另一类问题。代码将两者区分，调用方才能选择合适反馈和恢复方式。

如果全部返回“安装失败”，用户不知道是需要整理桌面，还是需要重新加载。反过来，如果坏布局被当成普通空间不足，系统错误就被转嫁成用户操作问题。

## 这件事让我重新看待“展示状态”

展示位置并不总是无关紧要的 UI 数据。当它被持久化、跨用户共享，或者参与安装事务时，就已经是产品模型的一部分。

我会追问每个状态的来源、拥有者和恢复方式：谁有权改变它？它能否从另一份事实推导？当两份状态不一致时，以哪一份为准？这些问题往往能在需求阶段暴露“同一个字段承担两种意义”的风险。

## 参考代码

- `agent-user/agent-user-service/.../entity/character/app/CharacterAppInstallLayoutPolicy.kt`

_代码版本日期：2026-09-04 · 整理日期：2026-09-22。 参考提交：`96ccad05`。_

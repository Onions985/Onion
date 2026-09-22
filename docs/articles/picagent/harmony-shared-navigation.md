一个页面能跳到另一个页面，并不意味着跨模块导航已经整理清楚。随着角色广场、文章、FM 和创作入口增加，路由名称、参数结构和导航栈很容易分别落在调用方和目标页里。

PicAgent 鸿蒙端这次“打通路由”的提交，值得记录的是三个分工：`RouterManager` 管理入口名称和跳转，`model` 提供参数载体，具体业务页负责解释参数、加载业务数据。

## 先把共享参数从页面中拿出来

提交把 `RouterModel.ets` 放到了 `model/src/main/ets/`，路由模块和业务页面都可以引用它。参数载体包含 `routerName`、`param` 和 `finish`，其中 `finish` 表示跳转前先弹出当前页面。

该版本的统一跳转入口很小，下面是原实现：

```typescript
static push(nav: NavPathStack, model: RouterModel) {
  if (model.finish) {
    nav.pop()
  }
  nav.pushPathByName(model.routerName, model)
}
```

这样，调用方只需要提供目标和参数。`finish` 的语义也集中在一处，不需要每个入口重新写一遍“返回再前进”。但它本质上仍是两个栈操作，不能把它描述成系统提供的原子 replace。

## 从选择角色页看参数如何流动

`CharacterSelectedPage.ets` 是一个明确的消费方。页面在 `NavDestination.onReady` 中获取当前 `pathStack` 和 `pathInfo.param`，取出 `AppConstant.TYPE`，再交给 ViewModel 初始化。

```typescript
.onReady((ctx) => {
  this.pageInfos = ctx.pathStack
  const routerModel = ctx.pathInfo.param as RouterModel
  const type = (routerModel.param?.[AppConstant.TYPE] ?? 0) as number
  this.vm.init(type)
})
```

用户选中角色后，FM 入口把角色对象放入共享参数，再进入创建 FM 页：

```typescript
RouterConstant.push(this.pageInfos, new RouterModel(
  RouterConstant.CharacterCreateFm,
  RouterParams.create().put(AppConstant.Character, ri.item).build()
))
```

这里有两层信息：`TYPE` 决定选择角色后的去向，`Character` 携带已经选中的业务对象。把它们留在页面的业务分支里，能够避免基础路由模块依赖角色创建的具体逻辑。

## 路由协议统一了，类型验证仍要单独考虑

这次实现使用 `Record<string, Object | undefined>` 承载参数，扩展起来方便，但 `as RouterModel`、`as number` 是类型断言，不会自动验证运行时数据。

因此，如果后续让同一入口接受外部链接、恢复数据或不可信参数，还需要在入口检查类型与必填字段。不能因为 TypeScript 风格的类型名称看起来完整，就认为输入验证已经完成。这些入口校验在该版本中仍需补充。

另一个需要保留的事实是：该提交中，选择页的动态和故事分支仍然标有 TODO；FM 和文章分支已经接上路由。未连接的分支仍需继续完成对应的创作流程。

## 可以复用的分工

| 层次 | 本次实际职责 |
| --- | --- |
| `RouterManager` | 路由名称、统一 push、可选的先 pop 行为 |
| `model` | 共享参数载体及参数构建器 |
| 业务页面 | 读取业务参数、选择目标、调用 ViewModel |
| `NavPathStack` | 承载实际页面栈 |

源码依据：`pic-agent-harmony@4091ef1` 中的 `RouterManager/src/main/ets/RouterConstant.ets`、`model/src/main/ets/RouterModel.ets`、`character/src/main/ets/pages/select/CharacterSelectedPage.ets`。

_代码版本日期：2026-03-10 · 整理日期：2026-09-21。 参考提交：`4091ef1`。_

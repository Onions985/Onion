一个页面同时拥有 `loading`、`error`、`data` 三个字段时，很容易出现彼此冲突的组合：正在加载却又显示旧错误，成功状态却没有数据。判别联合可以把业务允许的状态列出来，让编译器参与检查，而不是让每个组件自行猜测字段关系。

## 从独立布尔值改成互斥状态

```typescript
type Article = { id: string; title: string }
type ArticleState =
  | { kind: 'idle' }
  | { kind: 'loading'; requestId: number }
  | { kind: 'ready'; article: Article; refreshing: boolean }
  | { kind: 'failed'; message: string }

function assertNever(value: never): never {
  throw new Error('Unhandled article state')
}

function heading(state: ArticleState): string {
  switch (state.kind) {
    case 'idle': return '尚未打开文章'
    case 'loading': return '正在加载'
    case 'ready': return state.article.title
    case 'failed': return state.message
    default: return assertNever(state)
  }
}
```

`kind` 是判别字段。进入 ready 分支以后，`article` 必然存在，不再需要层层可选链。新增一种状态时，遗漏的分支会在 `never` 检查处暴露。这里使用 `refreshing` 是因为已有内容时刷新属于 ready 内部状态；首次加载则没有可展示文章。

类型定义应跟产品行为一起设计。如果失败时需要保留旧内容，可以加入 `stale` 状态或者在 ready 内表达刷新错误，不能为了维持类型“漂亮”而强迫页面清空内容。

## 状态合法还不等于转移合法

即使每个状态单独合法，旧请求仍可能覆盖新请求。用户先打开 A，再打开 B，A 最后返回，就需要请求身份保护。

```typescript
type LoadEvent =
  | { type: 'start'; requestId: number }
  | { type: 'success'; requestId: number; article: Article }
  | { type: 'failure'; requestId: number; message: string }

function reduce(state: ArticleState, event: LoadEvent): ArticleState {
  if (event.type === 'start') {
    return { kind: 'loading', requestId: event.requestId }
  }
  if (state.kind !== 'loading' || state.requestId !== event.requestId) {
    return state
  }
  return event.type === 'success'
    ? { kind: 'ready', article: event.article, refreshing: false }
    : { kind: 'failed', message: event.message }
}
```

这是首次加载流程的精简 reducer，刷新已有内容可以另加事件。每次新请求分配新 ID；取消网络调用可以节省资源，reducer 的身份检查则决定结果是否仍有资格进入页面。两者职责不同。

## 网络输入必须经过运行时校验

`response.json() as Article` 只是在告诉编译器相信自己，并没有验证服务器真的返回了字符串 ID 和标题。建议先把输入视为 unknown，再进入解码边界。

```typescript
function decodeArticle(value: unknown): Article {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Article object required')
  }
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || row.id.length === 0 ||
      typeof row.title !== 'string' || row.title.trim().length === 0) {
    throw new Error('Invalid article fields')
  }
  return { id: row.id, title: row.title }
}
```

更复杂的数据可以使用统一 schema 工具，但边界原则相同。协议错误应和普通业务空结果分开，否则字段缺失会被渲染成一张“暂无文章”的正常页面，问题更难发现。

## 类型应该帮助维护，而不是制造仪式

适合判别联合的场景包括网络加载、支付阶段、编辑器保存和上传任务。对于真正互相独立的开关，例如侧栏是否展开和主题是否深色，没必要组合成巨大枚举。

过度细分也会产生状态爆炸。可以把局部状态放进各自组件，公共状态只保留跨组件需要共同理解的事实。错误文案、展示颜色等派生信息尽量由状态计算，避免重复存储后互相不一致。

验证时可以直接对 reducer 输入事件序列：A 开始、B 开始、A 成功、B 失败。预期 A 的迟到成功被忽略，最终显示 B 的失败。这样的测试验证了真实竞态，比给每个 switch 分支机械写一条镜像断言更有意义。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2024-09-22 · 整理日期：2026-09-22。

- [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

</details>

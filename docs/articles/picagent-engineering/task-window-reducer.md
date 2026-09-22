任务列表既要不断更新最新状态，又要保留用户已经翻到的旧任务。每次刷新都替换全列表会让阅读位置丢失，简单把新旧数组拼起来又会重复。PicAgent 鸿蒙端把合并规则放进纯粹的 GenerationTaskWindowReducer，区分不同来源的数据。

## 窗口不只是一组 items

GenerationTaskWindow 保存 headBoundary、tailCursor、hasMore 和 loadedBeyondHead。头部边界描述最新一页覆盖到哪里，尾部游标描述已经加载到哪里，两者在翻页之后不再相同。

fullRefresh 重建整个窗口；reconcileHead 更新头部并尝试保留严格更旧的尾部；loadMore 更新已有身份并追加新身份；status 只更新已加载位置。不同操作有不同语义，不能共用一个无条件 concat。

## 头部刷新必须知道哪些尾部仍然合法

源码先对新 head 过滤公开类型并去重，再保留旧窗口中不与 head 重复、且严格早于新边界的项目。如果新页已经没有后续或没有游标，就只保留新 head。

严格更旧的判断使用三个排序字段：

```typescript
static strictlyOlder(item: GenerationTaskItem, cursor: GenerationTaskCursor): boolean {
  if (item.createTime !== cursor.createTimeMillis) return item.createTime < cursor.createTimeMillis
  if (item.taskId !== cursor.taskId) return item.taskId < cursor.taskId
  return cursor.taskType !== undefined && item.taskType < cursor.taskType
}
```

旧协议没有 taskType 时，不把相同时间和 ID 的记录擅自判成更旧。这是保守处理不完整比较信息，而不是给缺失字段补一个猜测值。

## 翻页重复身份应该原位更新

loadMore 先建立本页更新 Map，再遍历当前 items，把相同 refKey 的项目原位替换；未出现过的新身份按原始页顺序追加。这样一个已经显示的任务状态变化，不会被当作第二条任务插到末尾。

完整 refKey 很关键。多个任务命名空间可能共享数字 ID，若按裸 taskId 合并，会让不同类型互相覆盖。列表排序和身份判断不能混为一谈。

分页结果更新 tailCursor 与 hasMore，同时保留原 headBoundary。若用户已经加载超出头部，再刷新 head 时还要保留尾部进度，否则下一次翻页会突然回到第一页边界。

## 状态查询不负责发现新任务

status 只按完整身份更新已加载位置，不会把响应里额外出现的任务插入列表，也不会因为没有返回某个裸 ID 就推断它应该删除。新任务发现属于头部刷新，删除语义需要单独的权威协议。

这种职责划分让批量状态接口可以专注更新状态，不必同时承担分页和列表重建。少一个隐含副作用，合并规则就更容易验证。

## 纯 reducer 不承担请求归属

源码注释明确 loading 和 owner 不进入纯窗口层。账号切换、请求取消和响应先后，应由调用方在调用 reducer 前判断。一个正确的数组合并函数，无法阻止旧账号响应被错误送进来。

纯函数适合用具体序列验证：头部新增、翻页包含重复 ref、旧任务状态更新、同时间同 ID 不同类型、服务器确认无更多数据。每一步都可以检查窗口内容与两个边界，而无需启动 UI。

这个设计的启发是，分页不仅是向数组追加元素，还要保存“这段数据覆盖了哪一片范围”。范围和身份明确后，刷新与连续阅读才能同时成立。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-31 · 整理日期：2026-09-22。

- 仓库：`pic-agent-harmony`
- 固定提交：`94641d6822129663d7255e490b2128bd172a3258`
- 文件：`home/src/main/ets/pages/mine/generationtask/GenerationTaskWindowReducer.ets`

</details>

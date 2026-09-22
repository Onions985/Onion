用户选图上传成功，但后续业务提交失败，再点一次提交时是否可以复用已经上传的 URL？如果复用条件只看文件数量，很容易把旧账号、旧目标或旧顺序的结果用到新内容上。PicAgent 鸿蒙端把上传尝试的完整归属显式保存下来。

## URL 复用绑定一份不可变选择

ClientImageUploadAttemptOwner 包含 accountId、authSessionEpoch、targetIdentity、源文件身份有序数组、本地身份有序数组、editSessionId 和 generation。构造时复制数组，调用方随后修改自己的数组不会悄悄改变 owner。

equals 逐字段、逐元素比较，而不是把数组 join 成字符串。这样既避免分隔符碰撞，也保留图片顺序语义。两张图调换位置后，虽然集合相同，业务提交顺序已经变化，不能无条件复用旧结果排列。

## 同账号重新登录也是新会话

```typescript
isCurrent(owner: ClientImageUploadAttemptOwner): boolean {
  return owner.authSessionEpoch === AuthSessionManager.currentSessionEpoch() && owner.equals(this.currentOwner)
}
```

只比较账号 ID 不能区分退出后重新登录。会话 epoch 变化可以立即使旧尝试失效，即使用户仍然登录同一个账号，也不能让旧异步结果自动进入新会话。

新 owner 与当前不同会同步清空旧 URL；remember 只有在 owner 仍然有效且 URL 数量匹配本地身份数量时才保存。reusableImageUrls 返回副本，避免外部修改内部缓存。

## 选择改变以后，迟到成功也应被丢弃

```typescript
invalidate(): void {
  this.generation++
  this.currentOwner = undefined
  this.cachedImageUrls = []
}
```

选择、目标、账号或路由销毁等边界可以调用 invalidate。先推进代次并清空 owner，旧上传即使随后成功，也无法通过 remember 的接纳检查。

取消上传可以减少浪费，但不能替代这个门禁。底层请求可能已经上传完成，取消通知也可能晚于响应；业务层仍然需要决定结果是否属于当前意图。

## 这个对象没有管理文件生命周期

源码明确说明它不持有文件，也不扩展到服务端资产生命周期或用途语义。它缓存的是页面编辑会话内的 canonical URL，不能据此推断本地临时文件已经删除，或服务端未引用对象一定会自动回收。

同样，数量相同与 owner 匹配只是该缓存的复用条件，URL 是否可读、是否符合目标用途、服务端提交是否接受，仍由其他层负责。不要让一个名字带 Session 的工具承担所有媒体流程。

## 重试要区分输入未变和输入已变

业务提交失败但完整 owner 未变时，复用上传 URL 可以避免重复传输；用户换图、改顺序或切换目标后，应创建新 owner 并重新判断。按钮看起来都是“重试”，背后可能是同一意图重放，也可能是新的提交。

接口设计还应明确业务 requestId 是否复用。上传 URL 复用和业务幂等是两个层次：文件已存在不意味着业务记录已创建，业务响应丢失也不意味着可以新建第二条记录。

验证可以覆盖数组外部修改、同集合不同顺序、同账号新 epoch、页面销毁后上传成功、URL 数量不匹配和连续 invalidate。这个实现值得借鉴的地方，是把“看起来还是这几张图”转化成一组精确、可比较的身份条件。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-31 · 整理日期：2026-09-22。

- 仓库：`pic-agent-harmony`
- 固定提交：`94641d6822129663d7255e490b2128bd172a3258`
- 文件：`base/src/main/ets/media/ClientImageUploadAttemptSession.ets`

</details>

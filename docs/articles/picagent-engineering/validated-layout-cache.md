把接口响应存成 JSON，下一次打开时直接读出来，是缓存布局最容易想到的方案。但 JSON 可以成功反序列化，不代表布局仍然合法。PicAgent 的 KMP 布局缓存把“最后一份有效数据”作为边界，读写两端都检查业务语义。

## 缓存只承担展示加速

CharacterWorldAppLayoutCache 暴露 read、save、remove 三个方法，Room 实体与 DAO 保持模块内部。接口注释要求调用方先通过服务端角色详情的可访问 ENABLED 门禁，再按读缓存、刷新网络的顺序消费。

这项前提意味着缓存不是授权来源。离线看到一个图标，不等于当前账号仍能进入它。网络、权益和页面状态归调用方负责，缓存专注保存最后有效布局。

## 保存前校验，避免覆盖好数据

```kotlin
val normalized = layout.normalizeCharacterWorldAppSubscriptions()
if (!normalized.isValidCharacterWorldAppLayout(expectedCharacterId = normalized.characterId)) {
    return false
}
```

校验发生在 upsert 之前。收到一份损坏的网络数据时，返回 false，不会先把旧缓存删除。读取时则检查 schemaVersion、反序列化结果与角色身份；不兼容或明确损坏的记录会尝试清理。

取消异常单独重新抛出，不被转成“缓存不存在”。这让上层仍然能够依赖协程取消语义，而不是页面已经退出，缓存层却继续把取消当作普通读取失败处理。

## 语义校验到底在检查什么

源码检查 Dock 槽位集合、组内 App key 去重、Dock 与 Grid 的共享身份和元数据一致性，还检查布局版本、访问状态和特定 App 的 renderer/尺寸组合。

网格占用按每个单元格加入集合，一旦发现重复占用就拒绝。这比只检查左上角坐标是否不同更严格：两个不同锚点的 2×2 卡片仍然可能重叠。

边界判断也有一个细节：

```kotlin
rowSpan <= CHARACTER_WORLD_GRID_ROWS - row &&
    columnSpan <= CHARACTER_WORLD_GRID_COLUMNS - column
```

先限制锚点与跨度，再使用剩余空间比较，避免把异常大整数直接参与坐标加法。布局协议即使主要由服务端产生，客户端也不应把每个数字都当作天然可信。

## 结构校验不等于外部事实验证

图标 URL 检查只验证 HTTPS、主机和 PNG 路径形状，没有联网验证图片存在，也没有因为 URL 合法就赋予 App 新权限。把不同层的校验能力写清楚，可以避免调用者过度依赖一个“valid”布尔值。

同样，schemaVersion 不只是数据库表版本。即使表结构没有变化，布局语义发生不兼容变化，也可能需要使旧缓存失效。缓存恢复成本通常低于长期保留无法解释的数据成本。

## 最值得验证的失败场景

可以构造重复 App key、重叠网格、错误角色、缺少 Dock 槽位、未知访问状态和旧 schemaVersion，确认读取拒绝且保存不覆盖已有有效值。再模拟 SQLite 错误与取消，检查两者是否保持不同语义。

这份实现提供了一种实用取舍：允许界面尽快显示已知有效内容，同时把错误数据挡在缓存入口。它不承诺离线授权，也不把 JSON 能解析当作整个协议已经正确。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-14 · 整理日期：2026-09-22。

- 仓库：`pic-agent-kmp`
- 固定提交：`2c5e368568ef8d58391ea02741c44a2092a087df`
- 文件：`shared-character/src/commonMain/kotlin/com/onion/picagent/kmp/character/db/CharacterWorldAppLayoutCache.kt`

</details>

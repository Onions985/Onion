订单写入数据库以后发送一条消息，看起来只有两步，却存在两种无法靠调整顺序消除的失败。先提交数据库，进程可能在发消息前退出；先发消息，数据库又可能回滚。Outbox 的思路是把“业务事实”和“待传播的事实”先存到同一数据库事务中。

## 最小数据模型表达哪些承诺

以下是教学模型，不对应任何线上订单系统。事件 ID 标识一次事实，聚合 ID 标识业务对象，版本号用于判断同一对象上的先后关系。

```sql
CREATE TABLE outbox_event (
  event_id CHAR(36) CHARACTER SET ascii PRIMARY KEY,
  aggregate_id BIGINT NOT NULL,
  aggregate_version BIGINT NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_aggregate_version (aggregate_id, aggregate_version)
);
```

在同一个事务中更新业务表并插入事件。若一个聚合版本允许产生多类事件，就需要重新设计唯一键，例如加入事件序号，不能原样使用上面的约束。数据模型应服从业务事实数量。

发布器只消费已经提交的 outbox 记录。可以使用日志捕获，也可以自己实现轮询与租约。Debezium 提供专门的 Outbox Event Router，把 outbox 表字段映射到消息；使用它时应遵循其字段约定或配置映射，不能认为任意表结构开箱即用。

## 原子写入并不等于恰好投递一次

发布器发送成功后、确认进度前崩溃，下次仍然可能再次发送同一事件。Outbox 解决的是业务提交与事件记录之间的裂缝，不能自动消除数据库、发布器、消息系统和消费者之间所有重试。

因此事件 ID 必须跨重试保持不变。消费者在处理业务副作用的同一个本地事务中登记已处理事件：

```sql
START TRANSACTION;
INSERT INTO consumed_event (consumer_name, event_id)
VALUES ('inventory_projection', :event_id);
-- 首次插入成功后才更新本消费者的投影表
UPDATE inventory_projection
SET reserved = reserved + :quantity
WHERE product_id = :product_id;
COMMIT;
```

`consumed_event` 需要 `(consumer_name,event_id)` 唯一约束。重复键应被识别为已处理并结束，不应把所有数据库异常都当作重复。若业务更新失败，登记行也必须回滚。投影记录不存在时如何处理，也要明确成插入、重试或人工检查，不能默默吞掉零行更新。

## 顺序属于业务对象

如果同一订单的“创建”和“取消”可以被不同消费者并行处理，取消先到并不罕见。把 `aggregate_id` 作为消息分区键有助于维持局部顺序，但重新投递、系统迁移和错误恢复仍需考虑。

我会给投影保存最后应用的业务版本：旧版本忽略；期望的下一版应用；出现版本缺口时进入等待或回源重建。注意有些事件是增量，有些是完整快照，两者面对缺失事件的恢复方法不同。快照可以覆盖旧状态，扣库存这样的增量不能随意跳过。

不要为追求顺序给所有订单共用一把全局锁。大多数业务需要的是每个订单或每个账户的有序性，而不是全系统只有一个写入序列。

## 清理、演进与观测

Outbox 表不是永久垃圾箱。清理要依据可靠的消费进度和恢复窗口，不能单凭“记录已经存在一天”就删除。消费者去重记录的保留期也要覆盖可能的重放范围，否则几个月前的事件再次导入会重新产生副作用。

事件应包含 schema 版本，尽量使用业务语言而不是直接复制内部 ORM 实体。字段删除和语义变化要考虑旧事件回放；敏感信息不要因为是内部消息就完整塞进 payload。

观测重点包括最老未传播事件年龄、发布失败次数、重复事件率、消费者版本缺口和死信数量。它们比单纯的“消息队列连接正常”更接近用户能否看到完整结果。

最后，Outbox 更适合允许短暂传播延迟的跨服务协作。如果一个响应必须立即反映同一数据库内两个表的变化，直接使用本地事务通常更简单。架构复杂度应由真实故障边界驱动，而不是为了引入消息系统而制造流程。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2025-05-16 · 整理日期：2026-09-22。

- [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)

</details>

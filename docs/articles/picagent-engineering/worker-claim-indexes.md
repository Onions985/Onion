后台任务表通常有两类访问：找到等待执行的任务，以及找到运行中但租约已经过期的任务。两者过滤条件和排序目的不同，硬塞进一条索引，往往无法同时服务好。PicAgent 的 V105 迁移把这两条路径分别表达出来。

## 两条索引分别描述两种工作

这是迁移文件的完整索引定义：

```sql
ALTER TABLE `story_task`
  ADD KEY `idx_story_task_claim_queue` (`task_type`, `status`, `create_time`, `task_id`),
  ADD KEY `idx_story_task_running_lease` (`status`, `lease_expire_time`, `task_id`);
```

从字段顺序可以看出第一条面向按任务类型和状态筛选、按创建时间定位的队列；第二条面向状态与租约到期时间。具体查询效率需要结合执行计划与压力测试判断。

为什么都保留 task_id？时间可能相同，稳定身份可以提供明确的定位顺序，也方便后续针对具体任务执行条件更新。索引并不决定任务必须严格按创建时间全局串行执行，那是调度策略。

## 找到任务和拥有任务是两件事

同一提交里的 StoryTaskMapper 提供了归属检查。`selectOwnedForUpdate` 除 task_id 外，还要求运行状态、lease_owner 匹配以及租约尚未过期，并使用 FOR UPDATE。续租和检查点更新也包含相同的关键条件。

```sql
WHERE task_id = #{taskId}
  AND status = 1
  AND lease_owner = #{leaseOwner}
  AND lease_expire_time > NOW(3)
```

上面把 XML 中的比较转义还原成 SQL，保留实际条件。它保护的是写入资格：一个进程过去领取过任务，不意味着它现在仍然能保存结果。过期以后，即使线程还活着，也需要让条件更新失败。

因此，索引解决定位成本，事务和条件解决所有权。不能把“加了领取索引”当成解决重复执行的证明，也不能因为有 owner 字段就忽略所有更新语句是否真正使用它。

## 租约恢复需要保守地判断可重跑性

该 Mapper 的未启动恢复分支并非简单地把所有过期任务改回待执行。相关更新还检查任务类型、章节与结果字段，以及 request/steps 的形状；部分分支检查是否已经有成本记录。

这个方向值得注意：任务没有完成，不代表它完全没有发生副作用。若已经向外部模型发出请求，盲目重新执行可能重复花费。恢复流程应区分尚未开始、已经受理但结果未知、可以幂等查询和需要人工处理的情况。

## 怎样验证索引是否值得保留

应使用真实的领取和回收 SQL，在包含待执行、运行、完成等状态分布的数据上观察计划。重点记录扫描行数、排序、锁等待和每轮返回数量，不能只看表总行数。

每个新增索引也会增加任务写入与状态更新成本。尤其 status 和 lease_expire_time 会频繁变化，续租频率、Worker 数量与索引维护成本需要一起测量。

一个可靠任务队列，需要定位路径、接纳协议、写入门禁和恢复策略共同成立。四者拆开讨论，才能知道一次优化究竟改善了哪一部分。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-10 · 整理日期：2026-09-22。

- 仓库：`pic-agent-java`
- 固定提交：`ea031b297260c884734fdf71b2ab38efd4a248f5`
- 文件：`agent-user/agent-user-service/src/main/resources/db/migration/V105__Add_story_task_worker_claim_indexes.sql`
- 文件：`agent-user/agent-user-service/src/main/resources/mapper/StoryTaskMapper.xml`

</details>

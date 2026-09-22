在一个事务里，两次普通查询看见相同的值，并不意味着后面的更新一定基于那个旧值。理解 InnoDB 的一致性读和锁定读，可以解释很多“明明读到有库存，扣减却失败”的现象，也能帮助设计正确的并发写入。

## 快照解决的是读取视角

在常见的 REPEATABLE READ 隔离级别下，同一事务的一致性读通常沿用第一次这类读取建立的快照；READ COMMITTED 则每次一致性读建立新的视角。事务自己的修改仍然可以被自己看见，因此不能把事务想成一张完全冻结的照片。

一个可手工复现的时间线是：A 开启事务并读到数量 10；B 把数量改成 9 并提交；A 再做普通查询仍可能看到 10。此时 A 的下一条 `UPDATE` 不能简单按“它只会操作数量为 10 的旧版本”理解。写操作和锁定读有自己的并发语义。

以下例子用于理解流程，不建议直接在业务库里试验：

```sql
-- 连接 A：先建立一致性读视角
START TRANSACTION;
SELECT quantity FROM stock WHERE sku_id = 7;

-- 连接 B：修改并提交
UPDATE stock SET quantity = quantity - 1 WHERE sku_id = 7;

-- 连接 A：普通 SELECT 与 FOR UPDATE 应分别观察
SELECT quantity FROM stock WHERE sku_id = 7;
SELECT quantity FROM stock WHERE sku_id = 7 FOR UPDATE;
ROLLBACK;
```

连接 B 的示例假设 autocommit 开启。复现实验时应明确两个连接的隔离级别、自动提交状态以及语句执行顺序，否则同一段 SQL 可能得到不同现象。

## 防止超卖更适合表达为条件写入

如果业务只是“库存足够才扣一件”，可以把判断放进原子更新，而不是先读到 Java 内存里，再计算一个覆盖值。

```sql
UPDATE stock
SET quantity = quantity - :count
WHERE sku_id = :sku_id
  AND quantity >= :count;
```

调用方必须验证 `count > 0`，并检查受影响行数。成功更新一行才表示扣减成立；零行可能是库存不足，也可能 SKU 不存在，需要根据产品语义决定是否进一步区分。不能执行后无条件返回成功。

如果还要写订单，扣减和订单记录应放在同一个事务里，并通过请求号唯一约束抵御同一业务请求重复提交。库存非负和请求幂等是两个不同约束，只有条件更新还不够防止重复扣减。

## 多字段编辑适合使用版本比较

对于用户编辑文章标题和正文，两个编辑器同时打开后提交，后到的请求可能覆盖先到的修改。可以返回版本号，让更新显式要求“我仍在编辑刚才看到的版本”。

```sql
UPDATE article
SET title = :title,
    body = :body,
    version = version + 1
WHERE id = :id AND version = :expected_version;
```

零行更新应转成冲突提示，保留用户输入并提供重新加载或对比，不能悄悄重读最新版本后把旧正文重新写上去。盲目重试会破坏乐观锁试图保护的用户意图。

对计数器加一这种可合并操作，数据库表达式往往更直接；对整篇正文覆盖，版本冲突更重要。并发策略应由操作语义决定。

## MVCC 不能包办所有不变量

如果约束跨越多行，例如同一个账户最多保留三个活动任务，分别读取数量后插入可能并发穿透。需要选择能够串行化该约束的锚点、唯一性模型或其他事务设计，不能因为开启事务就认为逻辑判断天然原子。

长事务还会延长旧版本的保留需求。一个导出任务长时间持有事务快照，可能给系统带来与查询本身不同的维护成本。对于很长的导出，应先讨论是否真正要求一个全程一致快照，再决定分批读取、固定截止边界或专门快照方案。

本文关注 MySQL 8.0/8.4 的常见 InnoDB 行为。验证并发问题时，我会保留完整的双连接时间线，记录每次查询结果和受影响行数。只截取最后一个异常，往往看不到真正破坏约束的那次交错。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2023-02-26 · 整理日期：2026-09-22。

- [MySQL Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)

</details>

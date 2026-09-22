PicAgent 的会话列表需要为一个用户挑出最近若干个角色，并取出每个角色的一条代表消息。`CharacterMessageMapper.selectLatestMessagesBest` 原来用 `IN` 包裹一个带 `LIMIT` 的分组子查询，在 MySQL 中遇到了语法支持边界。

## 原查询为什么会失败

原实现的核心结构如下，参数仍保留 MyBatis 绑定形式：

```sql
SELECT * FROM character_message
WHERE id IN (
    SELECT MAX(id)
    FROM character_message
    WHERE user_id = #{userId}
      AND character_id IS NOT NULL
    GROUP BY character_id
    ORDER BY MAX(create_time) DESC
    LIMIT #{limit}
)
ORDER BY create_time DESC
```

MySQL 8.0 对部分子查询组合有明确限制：`LIMIT` 不能直接用于这种 `IN / ALL / ANY / SOME` 子查询。官方列出了相应限制与错误示例，见 [Restrictions on Subqueries](https://dev.mysql.com/doc/refman/8.0/en/subquery-restrictions.html)。因此，这次问题首先是查询结构兼容性，不是给字段补一个索引就能解决。

## 把已限量的结果集作为派生表连接

该提交把选取 ID 的过程移到 `FROM` 后的派生表，通过主键连接回原表：

```sql
SELECT message.*
FROM character_message message
INNER JOIN (
    SELECT MAX(id) AS id
    FROM character_message
    WHERE user_id = #{userId}
      AND character_id IS NOT NULL
    GROUP BY character_id
    ORDER BY MAX(create_time) DESC
    LIMIT #{limit}
) latest ON latest.id = message.id
ORDER BY message.create_time DESC
```

这就是 `92770379` 提交后的查询。用户过滤、排除空角色、按角色分组、限量、外层排序都保留了；改变的是使用中间结果的方式。

这里的 `LIMIT` 限制的是分组后的角色数量。把它随手移到外层，或者先限制原始消息再分组，都可能改变“每个角色选一条，再挑最近若干角色”的语义。

## 兼容性修复没有重新定义“最新”

这次修改保留了 `MAX(id)` 选取消息的规则，同时按 `MAX(create_time)` 排序角色分组。两者只有在相关数据满足顺序假设时，才自然对应到同一条“最新消息”。

如果业务允许回填历史时间、导入记录或非时间顺序的 ID，就需要重新定义最新消息究竟按 ID 还是时间选。相同时间的稳定排序也需要单独考虑。这些是后续数据语义问题，不能把当前 JOIN 改写说成已经一并解决。

同样，消除语法限制不意味着性能一定提升。是否需要组合索引、执行计划是否合理，应结合实际数据量和 `EXPLAIN` 判断；这篇笔记没有编造耗时对比或扫描行数。

## 参数仍然交给 MyBatis 绑定

Mapper 方法通过 `@Param("userId")` 和 `@Param("limit")` 传入值，默认 limit 为 10。这里应继续使用 `#{...}`，不把用户值拼成 SQL 文本。示例摘录保持了原绑定形式，复制到数据库客户端时需要使用对应的绑定参数机制。

源码依据：`pic-agent-java@92770379` 的 `agent-user/agent-user-service/src/main/kotlin/com/onion/picagent/mapper/chatacter/CharacterMessageMapper.kt`。应用到业务库时，还需检查执行计划并测量查询性能。

_代码版本日期：2026-07-23 · 整理日期：2026-09-21。 参考提交：`92770379`。_

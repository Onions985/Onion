给方法加上 `@Transactional`，只是表达事务意图。代码真正执行时有没有经过事务拦截、异常有没有离开边界、数据库连接是否属于同一个事务，才决定数据是否一起提交。很多事务问题不是注解少了，而是边界画错了。

## 同一个对象里的调用为什么容易误判

Spring 默认代理模式在调用经过代理时施加事务行为。对象内部通过 `this` 调另一个方法，不会因为被调用方法上多了一层注解就重新经过代理。

```java
@Service
class ImportService {
    public void importOne(Command command) {
        save(command); // 同对象调用，不触发 save 上的代理拦截
    }

    @Transactional
    public void save(Command command) {
        // 两次数据库写入
    }
}
```

若外层已经有事务，内部数据库操作可能仍然加入那个事务；问题在于不能指望内部方法的传播级别、只读设置或新事务要求自动生效。因此“自调用导致所有 SQL 永远没有事务”也是过度概括。

更清楚的结构是让编排层与原子写入层分开，调用通过注入的 Spring Bean 进入事务边界。

```java
@Service
class ImportWorkflow {
    private final RecordWriter writer;
    ImportWorkflow(RecordWriter writer) { this.writer = writer; }

    public void importOne(Command command) throws IOException {
        ValidatedRecord record = validate(command);
        writer.persist(record);
    }
}

@Service
class RecordWriter {
    @Transactional(rollbackFor = IOException.class)
    public void persist(ValidatedRecord record) throws IOException {
        insertRecord(record);
        insertAudit(record);
    }
}
```

这里的仓储调用是领域占位接口，重点是调用方向。拆分后不能在编排层 `new RecordWriter()`；对象仍然需要由容器管理。若不值得拆服务，也可以用 `TransactionTemplate` 显式表达一段短事务。

## 异常被捕获以后发生什么

在默认规则下，运行时异常和 `Error` 通常触发回滚，受检异常需要按业务约定配置。后续 Spring 版本允许改变全局默认，项目升级时应核对配置，不能只凭印象判断。

假设第二次写入失败，方法内部捕获异常后返回 `false`，外层代理可能只看到一次正常返回。如果事务已经被底层标记为 rollback-only，又可能在提交时抛出另一种异常。两种行为取决于实际失败位置，不能用 `catch` 当成事务控制语言。

我更倾向让领域失败从事务方法抛出，在边界外转成 API 结果。确实需要内部捕获时，明确决定是回滚整个原子单元，还是允许某个可选操作失败，并为这个选择写验证用例。

## 短事务应该包含什么

事务内部适合放必须共同成立的数据库事实，例如库存条件扣减、订单写入和业务幂等记录。远程支付、邮件发送和图片生成不应因为“也属于一个业务”就被长时间包在数据库事务里。

设想远程支付完成后数据库提交失败：数据库回滚无法把外部支付回滚。反过来，数据库锁等待了几秒，远程请求超时也可能只是响应丢失。应把跨系统部分设计成明确状态机，用幂等请求号、查询确认和补偿处理不确定结果。

`REQUIRES_NEW` 不是免费的保险箱。外层事务挂起期间仍可能占用连接，内层再申请连接；并发量接近连接池上限时会出现额外压力。只有确实希望内外提交结果独立时才使用，并说明失败语义。

## 怎样验证边界确实存在

最有价值的验证是让第二个写入确定失败，再从一个独立事务或连接读取第一条记录是否存在。只在一个被测试框架包住的回滚事务里断言，可能看不出生产调用绕过代理的问题。

还可以通过事务同步信息和 SQL 日志确认连接边界，但日志不应包含敏感参数。至少覆盖正常提交、第二步失败、受检异常、自调用入口以及重试入口五种路径。事务设计最终要回答的是：哪些事实一起成立，失败后调用方能依赖什么，而不是一个类里贴了多少注解。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2023-10-21 · 整理日期：2026-09-22。

- [Spring Transactional documentation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)

</details>

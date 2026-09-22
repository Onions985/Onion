用户在确认页看到一个订阅价格，点击购买时后台配置可能已经变化。设计交易协议时，需要决定用户提交的是一个随时变化的商品，还是一个明确版本的报价。PicAgent 的 V97 迁移把报价版本、订单和分成分别建模，并用数据库约束限制不合法组合。

## 报价发布之后，身份不能被偷换

订阅计划拥有 plan_code、period_type、price_inspiration、enabled、is_current 和 ever_published。已发布的价格或周期变化需要新 plan_code，不能直接修改旧报价的含义。

触发器里有这样一段实际条件：

```sql
IF OLD.ever_published=1 AND (NOT(NEW.plan_code<=>OLD.plan_code) OR NOT(NEW.period_type<=>OLD.period_type) OR NOT(NEW.price_inspiration<=>OLD.price_inspiration)) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='published subscription offer requires new plan code';
END IF;
```

这里使用空值安全比较，避免 nullable 价格在比较时出现三值逻辑漏洞。`ever_published` 也不能倒退，已退休报价不可重新随意修改。发布过的事实因此不会被一次后台编辑抹去。

## 当前版本与历史版本可以共存

表中生成列 current_period_key 在当前报价时等于 period_type，否则为 NULL，再与 definition_id 构成唯一键。这样每个周期可以有一个当前报价，同时保留多个历史记录。

这个技巧服务于明确业务规则，不是万能的软删除模板。使用类似方案时，要同时检查退休时间、启用状态和当前标记之间的约束，否则可能出现“不是当前却仍可购买”的组合。

## 订单要冻结实际选择

订单包含 buyer_user_id 与 request_id 的唯一键，让同一买家的重复请求有稳定落点。成功状态还约束周期、价格、钱包变化、权益与完成时间的组合；报价变化和余额不足则有不同的失败字段要求。

这些约束把模糊的 status 数字变成可检查的状态结构。成功订单不能只有一个 status=1，却没有对应权益或实际扣减信息。服务层仍需负责正确的业务流程，数据库约束作为最后一道一致性检查。

唯一键本身只阻止重复行，不会自动把重复请求转成正确响应。上层还要读取原订单并比较请求语义，返回同一结果，而不是捕获所有数据库异常后假装购买成功。

## 整数分成必须守恒

该历史版本的分成规则固定 share_bps=5000，owner_share_amount 使用 gross_amount DIV 2，平台部分用总额减去作者部分。这让奇数金额的余数归属明确，并保证两者相加等于总额。

这是这一提交里的具体商业规则，不代表任何后续版本永远按一半分成。若未来变更比例，应保留订单实际采用的规则版本，避免用当前配置重新解释旧交易。

## 从数据库模型反推产品体验

报价变更应让用户看到新的确认信息，而不是静默按新价扣款。历史订单应展示当时价格与周期，不能关联当前计划后覆盖。权益有效期则要与购买结果对应，尤其永久权益和有限周期的空值语义不同。

这份迁移的价值在于让价格、订单和权益各有身份，并把关键不变量放进数据库。实施时应验证迁移结果、钱包扣款与权益发放的一致性；文中历史报价仅用于解释数据设计。

<!-- publication-sources -->
<details>
<summary>参考代码与版本</summary>

代码版本日期：2026-08-05 · 整理日期：2026-09-22。

- 仓库：`pic-agent-java`
- 固定提交：`33fa54d13b7140c2eee3bf9fdeef350e3ba4f59a`
- 文件：`agent-user/agent-user-service/src/main/resources/db/migration/V97__Add_storyline_subscription_commerce.sql`

</details>

## 能解析成 JSON，还远远不够

当模型输出进入业务流程，失败不只发生在缺一个逗号的时候。一个语法正确的对象，可能缺少必须字段、引用不存在的角色，或者提出当前阶段不允许的操作。

PicAgent 的 Storyline 原本已经有服务端严格解析与业务校验。这次调整又把 JSON Schema 和 strict function 变成模型请求的显式契约。它增加了生成阶段的约束，但没有取代原来的服务端权威判断。

## 先让请求类型表达真实要求

`ChatRequest` 增加 `structuredOutput`，旧的 `responseAsJson` 仍然保留给其他调用方。两者不能同时启用：

```kotlin
require(!responseAsJson || structuredOutput == null) {
    "JSON Object mode与strict JSON Schema不能同时启用"
}
```

这不是两个可以随便叠加的开关。一个只要求 JSON 对象，另一个要求符合指定 Schema；若同时打开，适配器究竟提交什么就变得含糊。

显式拒绝矛盾配置，让问题尽早出现在请求构造阶段，比等到某个供应商忽略一个字段后再排查容易得多。

## 能力路由必须跟着语义一起升级

请求现在会根据内容声明所需能力。源码中有这些判断：

```kotlin
if (responseAsJson) add(TextModelCapability.JSON_MODE)
if (structuredOutput != null) add(TextModelCapability.JSON_SCHEMA)
if (tools.isNotEmpty()) add(TextModelCapability.TOOLS)
if (tools.any(ChatTool::strict)) add(TextModelCapability.STRICT_TOOLS)
```

这样，备用目标不能仅仅因为“支持文本”就接过一个要求 strict tools 的请求。否则主目标正常时有保证，故障切换后却悄悄降级，最难发现的问题恰好会出现在系统已经不稳定的时候。

声明能力只能排除已知不匹配，不能证明配置永远正确。接入具体供应商和模型时，仍需通过实际请求验证其契约支持情况。

## Schema 更严格，不代表业务判断可以更宽松

这一轮把部分分支对象整理为固定字段集合，用明确的 null 表示不适用字段，保留 `additionalProperties=false`，并按实际变化推进 Prompt、Schema 和 parser 身份。

固定形状更容易被约束，但也可能允许“形状正确、组合错误”的结果。例如字段全部齐全，某个操作却携带了不应存在的数据。服务端仍然必须检查操作与字段组合、证据、角色身份、历史和世界时间规则。

可以分成三层理解：

1. 输出是否能完整解析。
2. 结构是否符合当前 Schema。
3. 内容是否符合这次业务上下文与发布规则。

前两层通过，第三层依然可能失败。把“模型返回结构化结果”直接写成“可以自动入库发布”，会跳过最重要的业务判断。

## 协议版本是恢复过程的一部分

对于已经持久化、可能重放的生成任务，Prompt 与 parser 版本不能只是注释。旧任务按照哪种字段形状生成，新代码应该用哪种规则解释，需要能对应起来。

这次调整对发生 wire 形状变化的 profiles、summary、world-state 推进相关身份；没有改变接受形状的路径则不机械修改所有版本号。

我更看重版本号背后能解释的变化，而不是版本增加得有多频繁。它应该帮助定位“这份结果在什么合同下产生”，而不是制造更多看不懂的数字。

## 拒绝、截断和业务不合法都应该有出口

严格输出并不能保证每次都获得可发布结果。供应商拒绝、输出不完整、结构非法、结构合法但业务非法，都需要进入已有的失败、重试或人工处理路径。

这里没有把部分 JSON 当作成功候选保存，也没有为了提高表面的成功率静默降级为宽松模式。这是一个需求层面的选择：宁可明确缺少可信结果，也不让下游把不完整内容误当成有效事实。

## 参考代码

- `entity/model/ChatRequest.kt`
- `openspec/changes/upgrade-storyline-to-strict-structured-outputs/design.md`

路径位于该提交的 `agent-user-service` 或 OpenSpec 目录。

_代码版本日期：2026-09-04 · 整理日期：2026-09-22。 参考提交：`cdfb2e42`。_

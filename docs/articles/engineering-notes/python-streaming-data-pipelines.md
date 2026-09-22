处理几 GB 的日志时，第一步就 `read()` 再 `json.loads()` 往往把整份输入搬进内存。流式处理的价值不仅是节约内存，也在于明确每条记录在哪里校验、失败后从哪里恢复，以及输出什么时候才算完整。

## 选择适合流的输入格式

JSON Lines 让每行是一条独立 JSON 记录，适合逐条解析。一个巨大的 JSON 数组则不能仅靠逐行读取正确解析，因为记录可能跨行，也可能全部挤在一行。格式不同，需要的解析器和恢复能力也不同。

下面的教学代码限定每条输入最多 256 KiB，并保留行号。它选择遇错停止，适合不允许静默跳过的数据导入。

```python
import json
from pathlib import Path

def records(path: Path, max_bytes: int = 256 * 1024):
    if max_bytes < 1:
        raise ValueError("max_bytes must be positive")
    with path.open("rb") as stream:
        line_number = 0
        while True:
            raw = stream.readline(max_bytes + 1)
            if not raw:
                return
            line_number += 1
            if len(raw) > max_bytes:
                raise ValueError(f"line {line_number}: too large")
            if not raw.strip():
                continue
            try:
                row = json.loads(raw)
            except (ValueError, UnicodeError) as error:
                raise ValueError(f"line {line_number}: invalid JSON") from error
            if not isinstance(row, dict):
                raise ValueError(f"line {line_number}: object required")
            yield line_number, row
```

长度限制包含换行符，是这个示例的明确约定。错误信息不回显整条输入，避免日志泄露内容。对于不可信输入，还应考虑嵌套深度、解析 CPU 和字段数量；一个字节上限只能约束部分风险。

## 生成器的资源寿命也需要管理

生成器里的 `with` 在迭代进行时保持文件打开。完整消费会自然关闭；如果中途提前退出，调用方应显式关闭，而不是依赖垃圾回收时间。

```python
from contextlib import closing

with closing(records(Path("events.jsonl"))) as rows:
    for line_number, row in rows:
        if row.get("kind") == "target":
            print(line_number)
            break
```

另一种方式是由调用方管理文件，把已经打开的流传给解析函数。关键在于归属清晰，不是生成器一定比普通循环高级。

## 分批写入，避免第二次全量聚合

很多脚本读取时使用生成器，接着却 `list(records(...))` 或按用户把所有记录累积到字典里，内存优势立刻消失。若只需要写数据库，可以按有限批次提交；若需要全局排序，应考虑外部排序或数据库能力。

```python
def batches(rows, size=200):
    if size < 1:
        raise ValueError("size must be positive")
    batch = []
    for row in rows:
        batch.append(row)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
```

调用方每次消费完一批就释放引用。数据库失败时，应明确这一批整体回滚，还是按单条隔离。批次越大，往返越少，但事务时间、失败重试成本和内存占用也越大，需要按记录体积测量。

## 检查点必须和输出事实一致

如果先记录“已经处理到第 1000 行”，再写数据库，崩溃后可能跳过未写入数据；反过来先写数据库再更新检查点，又可能重放。可以让写入具备业务幂等性，或在同一个数据库事务中保存结果与检查点。

仅保存行号还不够，输入文件被替换或插入新行后，同一个行号已经不是同一条数据。检查点应绑定输入身份，例如受控对象版本或内容摘要；对可追加文件还要明确截断与轮转行为。

若输出文件，先写临时结果，校验成功后再以适合所在文件系统的发布方式切换最终名称。不要让消费者读到一半的“成功文件”。实际原子性要考虑同一文件系统、平台语义以及崩溃恢复需求。

我会把流式任务的成功定义为：输入身份确定、每条记录有处置结果、失败可定位、重跑不会重复产生副作用、输出完整可识别。省内存只是第一步，剩下这些约定才决定它能否可靠运行。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2024-08-10 · 整理日期：2026-09-22。

- [Python Functional Programming HOWTO](https://docs.python.org/3.11/howto/functional.html)
- [Python 3.11 JSON documentation](https://docs.python.org/3.11/library/json.html)

</details>

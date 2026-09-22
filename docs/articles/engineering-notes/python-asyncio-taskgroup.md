并发脚本经常从 `create_task` 开始，却没有回答任务在哪里结束。主流程退出后还在运行的协程、被吞掉的取消异常、一次创建几十万个任务，都会让简单脚本变得难以预测。Python 3.11 的 TaskGroup 提供了更清楚的任务归属边界。

## 先让任务有一个共同的寿命

TaskGroup 退出时会等待组内任务完成；普通子任务失败时，会取消相关兄弟任务并汇总异常。它适合表达“这些并发工作属于同一次操作”。这种行为需要被业务接受：如果希望每个文件独立成功或失败，就应在单个文件的边界内捕获预期错误并记录结果。

```python
import asyncio

async def load_part(name: str) -> str:
    await asyncio.sleep(0.02)
    return name.upper()

async def load_page():
    async with asyncio.timeout(1.0):
        async with asyncio.TaskGroup() as group:
            title = group.create_task(load_part("title"))
            body = group.create_task(load_part("body"))
    return title.result(), body.result()

if __name__ == "__main__":
    print(asyncio.run(load_page()))
```

这段示例只使用标准库，延迟是为了演示调度，不是网络性能数据。真实 HTTP 调用还要配置客户端连接池和请求超时。外层总超时用于约束整个操作，不能保证不配合取消的底层阻塞函数会立刻停止。

## 限制并发不等于限制任务数量

给每个协程套 Semaphore 可以限制同时进入某段代码的数量，但若先为一百万个输入创建一百万个任务，等待许可的任务本身仍会占用内存。对于长输入流，可以使用有界队列和固定数量 worker。

```python
async def process_stream(source, save, workers=4):
    if workers < 1:
        raise ValueError("workers must be positive")
    queue = asyncio.Queue(maxsize=32)
    stop = object()

    async def produce():
        async for item in source:
            await queue.put(item)
        for _ in range(workers):
            await queue.put(stop)

    async def consume():
        while True:
            item = await queue.get()
            if item is stop:
                return
            await save(item)

    async with asyncio.TaskGroup() as group:
        group.create_task(produce())
        for _ in range(workers):
            group.create_task(consume())
```

这里没有使用 `queue.join()`，完成条件由生产者的结束标记与 TaskGroup 共同承担，因此没有 `task_done()` 配对问题。FIFO 保证结束标记在已有输入之后；组退出还会等待所有消费者实际完成。若改用 `join()`，则每次取出都需要严格配对 `task_done()`。

队列最多缓存 32 条等待项，除此之外还有正在处理的项目和上游自己的缓冲。条目大小如果没有限制，队列有界也不意味着字节内存有界。生产者在队列满时等待，把处理速度反馈给输入端，这才是背压的意义。

## 取消是控制流

协程收到取消后，应在 `finally` 中关闭自己拥有的资源，再把取消向上传递。不要为了“脚本不中断”用宽泛捕获把取消变成普通成功结果。网络会话、临时文件和数据库连接分别由哪个作用域创建，就应由那个作用域关闭。

阻塞 I/O 直接放在 async 函数里仍会阻塞事件循环。必要时使用合适的线程调用边界；但停止等待线程结果，不等于线程中的函数被强制终止。CPU 密集计算也需要单独评估进程或专门执行资源。

## 从失败路径检查并发设计

可以让第一个 worker 在保存时失败，确认生产者不会永久卡在满队列上；让上游中途失败，确认消费者全部退出；在总截止时间到达时，确认临时文件没有被发布成完整结果。

这些验证比“运行一次能打印所有结果”更有意义。并发数量、输入缓冲和失败策略应分别配置。TaskGroup 提供生命周期结构，队列提供流量约束，幂等写入则处理重跑；把三者分清，脚本才有机会从一次性工具成长为可靠的数据任务。

<!-- publication-sources -->
<details>
<summary>参考资料与整理日期</summary>

专题归档：2024-07-14 · 整理日期：2026-09-22。

- [Python 3.11 Coroutines and Tasks](https://docs.python.org/3.11/library/asyncio-task.html)
- [Python 3.11 Queues](https://docs.python.org/3.11/library/asyncio-queue.html)

</details>

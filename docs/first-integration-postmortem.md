# NovelCraft Roaming — 首次联调 Post-Mortem

**Date**: 2026-07-23  
**Duration**: ~6 hours, ~40 build-round  
**Goal**: 让 Workshop agent 跑通端到端（用户选中章节段落 → LLM 出题拷问 → 用户回答 → 讨论 → 修订）  

**结局**: Workshop 拷问阶段通了，消息送达修了 5 轮，讨论/修订 UI 还是空白。

---

## 根因溯源

### 1. RPC 消息通道从未建成（耗费 >60% 时间）

Electrobun 的 Main→Renderer 消息（`streamChunk`, `streamDone`, `workshopStateChanged`）使用 `BrowserWindow` 的 RPC 桥。但我们犯了四个错：

| 尝试 | API | 结果 | 为什么失败 |
|---|---|---|---|
| 1 | `mainWindow.sendMessage?.(channel, payload)` | 静默丢弃 | `BrowserWindow.sendMessage` 不存在，`?.` 吞掉错误 |
| 2 | `mainWindow.rpc.send(channel, payload)` | `undefined is not an object` | `BrowserWindow.rpc` 不存在 |
| 3 | `novelcraftRPC.send(channel, payload)` | 无错误但无效果 | `BrowserView.defineRPC` 没声明 `messages` handler |
| 4 | `setSendMessage` 在 `loadAll` 之后调用 | 无错误但无效果 | 插件加载时 `ctx.sendMessage` 捕获的是初始空函数 `() => {}` |

**最终正确组合**：
- `BrowserView.defineRPC` 中显式声明 `messages` handler（即使 stub 也行）
- 在 `pluginManager.loadAll()` **之前**调用 `setSendMessage`，通过可变引用 `rpcSend` 占位
- `BrowserWindow` 创建后再赋 `rpcSend` 真实实现 → `novelcraftRPC.send(channel, payload)`

**教训**：RPC 桥是最先应验证的东西。用一个简单的 ping/pong 消息在 main 和 renderer 之间发个往返，确认通道通了再写业务逻辑。我们写了一整天 agent 代码，最后发现消息根本没送到。

---

### 2. Build 缓存 / 路径混乱

用户在 `C:\Coding\mindscape-roaming\novelcraft-roaming\` 开发，但手动 copy `src` + `build` 到 `C:\Coding\novelcraft-roaming\` 测试。Agent 一直对着错误目录 build 和读 bundle，产生"源码改了但 bundle 没变"的幻觉。

根因是 agent 收到了 `DEBUG loadViewsFile: ... C:\Coding\novelcraft-roaming\build\...` 的日志但没注意到路径名与 workspace 不同。

**教训**：Session 开始时确认 build → deploy → test 路径链。如果测试和生产路径不同，写到 AGENTS.md。

---

### 3. `@preact/signals` 在独立 `render()` root 下不自动追踪

四个 renderer 插件通过 `render(Component, container)` 创建独立 Preact root。在这些 root 里，signal 值变化不会自动触发组件重渲染。Agent 误以为移除手动 `store.state.subscribe()` 后 signal 会自动工作——结果工具栏按钮完全不动。

**正确模式**：每个 root 组件内部使用 `useState` + `store.state.subscribe()` 强制重渲染：

```ts
const [, forceUpdate] = useState(0);
useEffect(() => store.state.subscribe(() => forceUpdate(n => n + 1)), []);
```

**教训**：根级 `render()` 和组件树内的 `render()` 行为不同。对于显式创建的 root，不要假设 signal 自动追踪机制开箱即用。

---

### 4. `clearStream()` 连带销毁了 `workshopState`

`store.clearStream()` 的原实现设了 `workshopState: null`。`streamDone` handler 调用 `clearStream()` → 刚写入的拷问状态被清空 → UI 显示空白。

这是典型的"函数语义过载"——`clearStream` 只应该清流式文本状态，但它顺手把 workshop 状态也灭了。写成 `clearStreamAndWorkshop()` 就不会被误用。

**教训**：函数名应精确反映副作用。如果 `clearStream` 还清别的东西，要么叫 `clearStreamAndWorkshop`，要么拆分。

---

### 5. 默认值没理由

- `maxTokens: 4096` — agent 随口写的，没依据
- `model: "gpt-4o"` / `baseUrl: "https://api.openai.com"` — 用户用 DeepSeek
- `temperature: 0.8` — 写作工具常见默认，但 workshop 分析场景该用 0.3

用户反复追问默认值依据时，agent 承认没有。这些值应该是用户配置的，硬编码默认只能是自己熟悉的工具链的反射。

**教训**：默认值指向你常用的 provider。如果用户换了 provider，所有默认值都要重新验证。不如让用户首次启动时配好。

---

### 6. LLM 日志包装器引入新 bug

为了给用户提供"下载 LLM Logs"功能，写了一个 `streamLLMWithLog` 包装函数。这个包装器的 `onError` 处理有问题（保存的 `onError` 引用可能为 `undefined`），导致了新的崩溃。更糟的是 bundler 缓存让修复后的代码迟迟未生效，agent 反复确认"源码正确但 bundle 有旧代码"。

**教训**：日志/观测代码本身不应改变被观测对象的行为。包装器拦截回调 → 改变执行流程 → 引入新 bug。更好的方式是在调用点原地记录，不动原回调链。

---

### 7. Workshop 模式的 UX 多次返工

| 版本 | 设计 | 用户反馈 |
|---|---|---|
| V1 | 单轮分析 | "敷衍了事的'多轮研讨'" |
| V2 | 问题表单 → 聊天 | "没地儿看到和切换" |
| V3 | 独立回答框 + 聊天混合 | "你让我手动拷贝到回答框？" |
| V4 | Copilot 聊天 | "回答框应该紧挨着 output" |
| V5 | 问题表单（首轮）+ 聊天（后续） | 当前版本 |

每次都是"实现 → 用户说不对 → 推翻重做"。如果一开始问清楚"你理想的 workshop 交互长什么样"或让用户画个示意图，省掉 3-4 轮重写。

**教训**：多步骤交互（agent 拷问→用户回答→讨论→修订）的 UI 不能用"先做一个看看"策略。先确认交互流程再写组件。

---

## 什么应该保留

1. **Copilot 聊天布局的 CSS 结构** — 消息列表 + 粘性输入框的 flex 链是对的，只需要把 workshop 的问答阶段接上
2. **LLM Logs 下载功能** — `getLlmLogs` RPC + blob 下载，虽然包装器有问题但思路对，后续改成原地记录即可
3. **Project 切换下拉** — 工具栏上的 project selector 解决了"多 project 共存"的基础设施
4. **forceUpdate 模式** — 在 root-rendered 组件中是正确且必要的
5. **RPC 消息通道的最终架构** — `BrowserView.defineRPC` 声明 messages → `rpcSend` 可变引用 → `sendMessage` 在 `loadAll` 之前

---

## 下次怎么做

1. **先验证 RPC 消息通道** — 写一个 ping/pong 测试，确认 `streamChunk` 能从 main 送到 renderer 并显示，再写任何 agent 逻辑
2. **确认 deploy 路径** — session 开始时确认 source dir / build dir / test dir 三段路径
3. **先问交互流程** — 多步骤 UI 先画低保真流程，用户点头再写代码
4. **默认值问用户** — "maxTokens 你设多少？temperature 分析阶段用多少？"
5. **日志不拦截回调** — 观测代码在调用点原地记录，不动原回调链
6. **函数语义精确** — `clearStream` 不清 workshop state，不清的就别写在里面

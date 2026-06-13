# Agent Backend

这个目录是独立于现有页面的 agent 后端实现，目标是把“单个大师 agent”与“多大师委员会”做成统一可调用的服务层。

其中 `agent-backend/skills/investor-personas/` 下保存的是从 GitHub `vibe-investing` 仓库搬进来的完整 `SKILL.md` 原文，运行时直接读取，不再使用压缩版摘要替代。

第三方来源与许可证说明见：

- `agent-backend/skills/THIRD_PARTY_NOTICES.md`
- `agent-backend/skills/VIBE_INVESTING_LICENSE`

## 功能

- `GET /masters`
  - 返回全部大师席位，包含完整 `skillMarkdown`，供前端渲染 agent 卡片或详情抽屉。
- `POST /discussions`
  - `mode: "single"` 时运行单个大师。
  - `mode: "council"` 时运行多大师委员会。
  - 支持 `feedbackNotes`、`previousTranscript`、`previousProposal`，供用户不满意时重开讨论。

## 目录内入口

- `http.ts`
  - 纯函数式请求处理器，方便你以后接任意框架。
- `server.ts`
  - 独立 Node HTTP 服务入口，不依赖 `src/` 里的 Next route。

## 讨论返回

无论单聊还是委员会，都会返回：

- `transcript`
  - 前端聊天框直接渲染这一组消息。
- `opinions`
  - 每位大师的结构化观点。
- `proposal`
  - 仅委员会模式返回最终方案。
- `satisfiedPrompt`
  - 前端可直接展示“是否满意，不满意请重开”的提示语。

## 设计原则

1. 每位大师单独调用，避免多人共用上下文导致串味。
2. 委员会先独立分析，再围绕结构化分歧做第二轮回应。
3. 用户不满意时，通过 `feedbackNotes` 把修改要求带回下一轮。
4. DeepSeek 不可用时自动退回 demo 模式，确保前端流程能继续走通。
5. 每位大师的分析依据来自完整 skill 文件，而不是手写摘要。

## 请求示例

### 1. 单个大师

```json
{
  "mode": "single",
  "masterId": "taleb",
  "question": "现在适合加仓 ETH 吗？"
}
```

### 2. 委员会

```json
{
  "mode": "council",
  "masterIds": ["buffett", "taleb", "druckenmiller"],
  "question": "请给我一个 ETH 现货和 DeFi 的三个月配置方案"
}
```

### 3. 用户不满意后重开

```json
{
  "mode": "council",
  "masterIds": ["buffett", "taleb", "druckenmiller"],
  "question": "请给我一个 ETH 现货和 DeFi 的三个月配置方案",
  "feedbackNotes": "上一轮太保守了，请明确试探仓比例，并把最大回撤讲清楚",
  "previousTranscript": [],
  "previousProposal": null
}
```

## 前端接法

1. 启动 `agent-backend/server.ts` 后，先调用 `GET /masters` 渲染大师席位列表。
2. 用户单选时，调 `POST /discussions`，`mode` 传 `single`。
3. 用户多选时，调 `POST /discussions`，`mode` 传 `council`。
4. 把返回的 `transcript` 直接渲染进聊天框。
5. 若 `proposal` 不为空，则把它渲染成最终方案卡。
6. 用户点击“不满意”时，把 `feedbackNotes` 连同上一轮 `previousTranscript` 和 `previousProposal` 再发一次。

## 启动方式

如果你用 `tsx`、`ts-node` 或自己的 Node 构建链，都可以直接以 `agent-backend/server.ts` 作为服务入口。

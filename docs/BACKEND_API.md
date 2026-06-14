# 后端接口与生产需求

更新日期：2026-06-12

## 当前线上接口

### `POST /api/chat`

- 默认使用服务端 `DEEPSEEK_API_KEY`。
- 可随单次请求传入用户自定义的 OpenAI Chat Completions 兼容配置；凭据只用于该次请求，不持久化。
- 自定义地址必须为公网 HTTPS，禁止私网、本地地址、非 443 端口、URL 凭据和重定向。
- 响应使用 `Cache-Control: no-store`，错误日志会对 API Key 脱敏。

请求：

```json
{
  "question": "用户问题",
  "masters": [
    {
      "id": "buffett",
      "name": "沃伦·巴菲特",
      "school": "价值投资",
      "quote": "角色语录",
      "risk": "稳健"
    }
  ],
  "history": [
    { "role": "user", "content": "最近消息" }
  ]
}
```

规则：

- 要求问题和至少一位人物。
- 最多 8 位人物。
- DeepSeek 模型：`deepseek-chat`。
- `temperature=0.75`，`max_tokens=2600`。
- 45 秒超时。
- 要求严格 JSON。
- 只保留已选择人物的回复。
- 置信度裁剪到 0-100。
- 配置最多 6 项并归一化为 100%。
- 彩蛋只替换对应人物文本。

响应：

```json
{
  "replies": [
    {
      "masterId": "buffett",
      "content": "人物观点",
      "vote": "approve",
      "confidence": 78
    }
  ],
  "synthesis": "委员会综合结论",
  "decision": {
    "title": "动态方案名",
    "thesis": "核心逻辑",
    "allocations": [],
    "riskLevel": "均衡",
    "expectedReturn": "不承诺精确收益",
    "maxDrawdown": "压力情景",
    "dissent": "主要分歧",
    "steps": [],
    "consensusRate": 100,
    "voteCounts": {
      "approve": 1,
      "abstain": 0,
      "reject": 0
    }
  }
}
```

### `GET /api/market`

- CoinGecko：优先读取 BTC、ETH、SOL、BNB、XRP、DOGE 的完整市场行情。
- DefiLlama Coins：提供即时价格和 168 小时历史价格回退，用于计算 24h/7d 涨跌、日内区间和 7 日走势。
- DefiLlama Chains：Ethereum、BSC、Solana TVL，约 300 秒缓存。
- 市值、成交量等字段在上游未返回时为 `null`，不使用静态假数据。
- 返回 `updatedAt` 和数据源列表。

### `GET /api/portfolio`

参数：

- `address=公开钱包地址`
- `chain=ethereum|bsc|solana`

索引策略：

- 配置 `ALCHEMY_API_KEY` 时，优先使用 Alchemy Portfolio API 返回原生币、ERC-20、SPL Token、元数据和美元价格。
- 未配置或 Alchemy 暂不可用时，Ethereum/BSC 使用 Blockscout Indexer 枚举 Token，并通过公共 RPC 补充原生币。
- Solana 降级模式通过 `getTokenAccountsByOwner` 枚举全部 SPL Token 账户，并通过公共 RPC 读取 SOL。
- 返回 `source`、`indexed`、`updatedAt`，前端可切换 Ethereum、BNB Chain、Solana 主链。
- EVM 地址只能读取 Ethereum/BNB Chain，Solana 地址只能读取 Solana。

## 环境变量

```bash
DEEPSEEK_API_KEY=...
ALCHEMY_API_KEY=...
```

密钥不得提交 GitHub。生产环境通过 Vercel 环境变量配置。

## 当前没有服务端接口的功能

- 用户账户。
- 历史对话同步。
- 模拟盘账本。
- 人物点赞评论。
- 社区上传发布。
- 真实交易构建和广播。

这些功能目前使用 LocalStorage。

## 生产后端建议

- Next.js BFF：会话、限流、前端聚合。
- FastAPI/Node 服务：AI 编排、策略、风控、交易路由。
- PostgreSQL：用户、会话、人物、评论、交易、审计索引。
- Redis：缓存、限流、任务和分布式锁。
- 对象存储/IPFS：加密对话和人物资源。

## 规划接口

### 身份

- `POST /v1/auth/wallet/challenge`
- `POST /v1/auth/wallet/verify`
- `GET /v1/users/me`

### 社区

- `GET /v1/masters`
- `POST /v1/masters`
- `POST /v1/masters/{id}/like`
- `GET /v1/masters/{id}/comments`
- `POST /v1/masters/{id}/comments`
- `POST /v1/masters/{id}/report`

### 会话

- `POST /v1/conversations`
- `GET /v1/conversations`
- `GET /v1/conversations/{id}`
- `POST /v1/conversations/{id}/messages`

### 资产与交易

- `GET /v1/portfolio`
- `POST /v1/trades/quote`
- `POST /v1/trades/simulate`
- `POST /v1/trades/build`
- `POST /v1/trades/{id}/submit`

## 风控要求

- 大模型输出不得直接成为交易参数。
- 使用确定性 schema 与规则引擎。
- 校验风险档、仓位、杠杆、协议白名单、滑点、余额、网络和授权。
- 保存模型、提示词版本、数据时间、规则版本和 trace ID。
- 区分演示、测试网和主网。
- 真实资金通道必须经过合约审计和完整审计日志。

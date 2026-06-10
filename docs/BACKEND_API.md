# 后端接口需求

## 架构边界

- Next.js BFF：鉴权会话、前端聚合、限流、流式响应代理。
- FastAPI：多模型路由、大师编排、策略、风控、数据归一化。
- PostgreSQL：用户、策略、任务、审计索引。
- Redis：会话状态、行情缓存、流式任务、分布式锁。
- IPFS/Filecoin：客户端加密后的对话与策略正文（后续阶段）。

## 核心接口

### 身份与画像

- `POST /v1/auth/wallet/challenge`
- `POST /v1/auth/wallet/verify`
- `GET /v1/users/me`
- `PUT /v1/users/me/risk-profile`
- `POST /v1/compliance/check`

### 资产

- `GET /v1/portfolio?addresses=&chains=ethereum,bsc,solana`
- `GET /v1/portfolio/history?range=30d`
- `POST /v1/watch-addresses`

### 对话与委员会

- `POST /v1/conversations`
- `GET /v1/conversations`
- `GET /v1/conversations/{id}`
- `POST /v1/conversations/{id}/messages`，SSE 返回增量消息。
- `POST /v1/councils`，参数含大师、议题、上下文和主持人。
- `POST /v1/councils/{id}/pause`
- `POST /v1/councils/{id}/resume`
- `POST /v1/councils/{id}/revise-topic`
- `GET /v1/councils/{id}/events`，SSE 事件：`stage`、`master_delta`、`vote`、`summary`、`proposal`。

### 策略与交易

- `POST /v1/strategies/evaluate`
- `POST /v1/trades/quote`
- `POST /v1/trades/simulate`
- `POST /v1/trades/build`，只返回待签名交易，不托管私钥。
- `POST /v1/trades/{id}/submit`
- `GET /v1/trades/{id}`
- `GET /v1/protocols/allowlist`

## 交易报价请求最小字段

```json
{
  "chain": "ethereum",
  "network": "mainnet",
  "protocolPreference": "best_allowlisted",
  "fromToken": "ETH",
  "toToken": "USDT",
  "amount": "0.05",
  "maxSlippageBps": 50,
  "walletAddress": "0x..."
}
```

响应须含：报价过期时间、路径、Gas、价格影响、授权需求、协议风险等级、模拟可用性和不可突破滑点上限。

## 风控要求

- 大模型输出不得直接成为交易参数，必须通过确定性 schema 与规则引擎。
- 校验风险档、单仓比例、杠杆、协议白名单、滑点、余额、网络、授权额度。
- 每个 AI 结论保存模型、提示词版本、数据时间、规则版本和 trace ID。
- 演示数据响应必须包含 `demo: true`，前端明确显示。

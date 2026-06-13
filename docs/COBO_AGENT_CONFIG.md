# Cobo Agent Config

用于前端输入“配置路径”后，后端读取并连接 Hermes 上的 Cobo Agent。

## 示例

```json
{
  "name": "Cobo Hermes",
  "baseUrl": "http://127.0.0.1:8787",
  "apiKey": "optional-token",
  "walletId": "main-wallet",
  "timeoutMs": 12000,
  "headers": {
    "X-Client": "oracle-capital"
  },
  "endpoints": {
    "connect": { "path": "/health", "method": "GET" },
    "balance": { "path": "/wallet/balance", "method": "POST" },
    "authorize": { "path": "/wallet/authorize", "method": "POST" },
    "execute": { "path": "/wallet/execute", "method": "POST" }
  }
}
```

## 字段说明

- `baseUrl`: Hermes 上 Cobo Agent 的服务地址（必填）
- `apiKey`: 可选，若提供将自动带 `Authorization: Bearer ...`
- `walletId`: 可选，调用余额/授权/执行时会透传
- `headers`: 可选，自定义请求头
- `endpoints`: 可选，自定义每个能力的路径与方法

## 默认端点

如果 `endpoints` 未配置，系统会使用：

- `connect`: `GET /health`
- `balance`: `POST /balance`
- `authorize`: `POST /authorize`
- `execute`: `POST /execute`

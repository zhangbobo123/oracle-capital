# 追光者 / Oracle Capital

AI 投资委员会黑客松 MVP，支持多位投资思想角色、DeepSeek 对话、模拟钱包连接、方案编辑和模拟交易确认。

## 本地运行

创建 `.env.local`：

```bash
DEEPSEEK_API_KEY=your_key_here
```

启动：

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 部署

- Node 服务部署保留 `/api/chat`，并配置 `DEEPSEEK_API_KEY`。
- GitHub Pages 构建静态演示版，AI 接口不可用时会自动显示本地演示回复。
- 钱包与交易当前均为模拟流程，不读取私钥、不广播交易。

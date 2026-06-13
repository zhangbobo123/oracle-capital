# 追光者 / Oracle Capital

多agent 链上投资委员会黑客松项目。。

生产网站：[https://oracle-capital.vercel.app](https://oracle-capital.vercel.app)

## 当前功能

- 13 位 AI 投资思想人物
- 人物搜索、拖拽、惯性运动和碰撞
- 社区人物点赞、评论
- 单人物对话与多人委员会
- 投票机制、共识率和最终方案
- 历史会话与人物组合恢复
- 人物社区排行榜、人物JSON 上传与下载
- BTC、ETH、SOL、BNB、XRP、DOGE 实时行情、原创资产视觉和多链 TVL
- MetaMask/EVM、Phantom/Solana 钱包连接
- 链上原生资产余额
- Ethereum USDC 模拟账户、AI 方案持仓联动和资产分析
- 模拟充值、提现和 0.01% 模拟提现手续费
- 中英文和日夜主题
- 热度排序人物星图与浏览器端加密的自定义 AI API

## 文档

- [完整 PRD](docs/PRD.md)
- [前端实现](docs/FRONTEND_PLAN.md)
- [后端接口](docs/BACKEND_API.md)
- 站内文档：`/docs`

## 本地运行

创建 `.env.local`：

```bash
DEEPSEEK_API_KEY=your_key_here
```

运行：

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 安全边界

- 不提交或暴露 DeepSeek API Key。
- 不读取私钥或助记词。
- 当前交易执行为模拟，不广播链上交易。
- 模拟盘费用不作用于真实资产。
- 真实资产保持在用户钱包中。
- 现实人物均为思想框架模拟，无本人授权或背书。

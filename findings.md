# Findings

## 2026-06-13

- Existing app is mostly in `src/app/page.tsx`.
- Current wallet support is browser extension based (`window.ethereum`, `window.solana`), plus `/api/portfolio` for public on-chain balances.
- Need to add a new wallet path: local Cobo agent via backend interaction.
- Existing backend patterns:
  - Next API routes under `src/app/api/*` and proxy routes under `src/app/discussions/*`.
  - Independent node backend under `agent-backend/*` currently for AI discussions.
- No existing Cobo/Hermes integration code in repository yet.
- Implemented Cobo config-driven bridge (`src/lib/cobo-agent.ts`):
  - Loads local config file path on server side.
  - Supports configurable `baseUrl`, optional `apiKey`, `walletId`, custom headers and endpoint paths.
  - Exposes connect, balance, authorize, execute helpers.
- Frontend Cobo flow now:
  1. User inputs config path in wallet modal.
  2. `POST /api/cobo/connect` validates + connects.
  3. Wallet mode loads balances from `POST /api/cobo/balance`.
  4. User submits operation JSON, then does authorize -> execute in two steps.
- Updated for demo UX:
  - Preferred connect flow is now direct web form input (Hermes URL + optional key/id), then auto connect.
  - Config-path flow remains as fallback for advanced users.
  - Runtime Cobo config is kept in-memory in frontend state (not persisted), while wallet display info can still persist.

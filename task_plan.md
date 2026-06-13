# Task Plan

## Goal
Connect Oracle Capital to a local Cobo wallet agent (running on Hermes) so users can input a Cobo config path, connect, view balance, and execute operations with explicit authorization confirmation.

## Phases
| Phase | Status | Notes |
|---|---|---|
| 1. Discover current wallet architecture and backend capabilities | complete | Extension-wallet flow in `src/app/page.tsx`; Next API + `agent-backend` available |
| 2. Design Cobo agent integration API and UI flow | complete | Config-path based backend bridge + frontend cobo wallet mode |
| 3. Implement backend API routes for Cobo connect/balance/execute | complete | Added `/api/cobo/connect|balance|authorize|execute` |
| 4. Implement frontend UI for config-path connect and actions | complete | Added config-path input, Cobo connect, balance load, authorize+execute UI |
| 5. Validate behavior and polish | complete | ESLint passes |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| None yet | - | - |

# Agent Brief 01: View Model / Local API

## 담당 범위

- packages/view-model
- packages/local-api
- secret-safe response schema
- local API endpoint

## 금지

- React import 금지
- provider connector 직접 UI payload로 노출 금지
- raw payload 저장/반환 금지
- secret 반환 금지

## 산출물

- `readNotificationDigest`
- `readTrayMenuModel`
- `startLocalApiServer`
- runtime lock
- endpoint tests

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

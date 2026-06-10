# StackSpend Tray Skeleton

This package is the EPIC-08 desktop tray thin-client skeleton. It is intentionally local-first and calls only sanitized StackSpend local API endpoints.

Allowed local API reads:

- `GET /api/local/health`
- `GET /api/local/tray-menu`
- `GET /api/local/notification-digest`

The tray package must not collect, display, or persist provider credentials, prompt text, account IDs, project IDs, emails, webhook URLs, raw provider payloads, or raw SQLite rows. It does not import provider connectors, credential storage, or database modules.

## Contents

- `src/actions.ts`: the EPIC-08 tray action model.
- `src/local-api.ts`: loopback-only API client functions for the allowed endpoints.
- `src/notifications.ts`: pure TypeScript notification polling and suppression decisions.
- `src-tauri/`: minimal Tauri-ready scaffold.

## Current Runtime Boundary

This is not a native tray implementation yet. OS tray menu wiring, toast delivery, notification permissions, start-at-login integration, and installer packaging are left as Tauri integration work. The current TypeScript model returns delivery decisions that a future Tauri command layer can map to native tray and notification APIs.

No Tauri or Electron dependency is added in this slice.

## Validation

```bash
pnpm --filter @stackspend/tray test
pnpm --filter @stackspend/tray typecheck
```

# StackSpend

Local-first cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

## Status

StackSpend is in initial v0.1 bootstrap. The first implementation slice is a TypeScript pnpm monorepo skeleton.

## v0.1 Direction

- TypeScript + pnpm workspace
- CLI-first workflow
- Local SQLite storage
- Local Next.js dashboard
- Read-only provider connectors
- Korean daily reports
- Slack webhook delivery
- No telemetry by default
- Env-only secrets for v0.1

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```

CLI smoke check:

```bash
pnpm --filter @stackspend/cli dev -- --help
pnpm --filter @stackspend/cli dev -- --version
```

## Security Posture

StackSpend should never persist raw provider payloads or secrets. Provider data must be normalized and redacted before storage.

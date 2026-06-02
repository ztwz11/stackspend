# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M3`
- Current slice: `S3-cli-mock-pipeline`
- Canonical source: `docs/product/execution-plan.md`, section `M3 — CLI with mock provider`

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` is the current approved slice.

## M3/S3 Summary

Prove the local sync/report pipeline without external provider APIs:

- CLI commands: `init`, `doctor`, `sync --provider mock`, `report daily --lang ko`
- read-only mock connector
- Korean daily report renderer
- normalized local persistence only

Do not persist raw provider payloads.
Do not implement external provider API calls in M3/S3.
Do not create `.env`.
Do not add real credentials.
Do not add telemetry.

## Validation Commands For M3/S3 Review

```bash
pnpm test
pnpm typecheck
git diff --check
```

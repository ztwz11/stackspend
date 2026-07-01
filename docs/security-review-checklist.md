# Security Review Checklist

Use this checklist for MoneySiren changes that touch provider data, local AI CLI data, persistence, dashboard output, reports, notifications, screenshots, or release automation.

## Secret handling

- [ ] No `.env` files are committed.
- [ ] No API keys are committed.
- [ ] No OAuth tokens are committed.
- [ ] No webhook URLs are committed.
- [ ] No private keys or certificates are committed.
- [ ] No local Codex or Claude auth files are committed.
- [ ] Secret scan passes.
- [ ] Full history secret scan passes before public release.

## Provider data

- [ ] Provider connector is read-only.
- [ ] Minimum required auth scope is documented.
- [ ] Raw provider payloads are not persisted.
- [ ] Credential material is not stored in SQLite.
- [ ] Normalized snapshots contain only expected fields.
- [ ] Dashboard JSON does not contain sensitive provider data.
- [ ] Reports do not contain sensitive provider data.
- [ ] Notification payloads do not contain sensitive provider data.

## Local AI CLI data

- [ ] Local AI CLI logs are treated as sensitive.
- [ ] Prompt text is not persisted or displayed.
- [ ] Shell command context is not persisted or displayed unless explicitly safe and synthetic.
- [ ] Auth file paths are not exposed in browser output.
- [ ] Tokens and refresh tokens are never logged.
- [ ] Dashboard only displays sanitized usage metadata.

## Fixtures and screenshots

- [ ] Fixtures use fake or synthetic data.
- [ ] Fake values are clearly labeled.
- [ ] Screenshots are generated from fake fixtures.
- [ ] Screenshots do not show real account identifiers, organization IDs, project refs, invoices, emails, or webhook URLs.

## Release automation

- [ ] Release scripts do not print secrets.
- [ ] Signing material is handled through secrets or local private files only.
- [ ] Release verification checks hashes and signatures where applicable.
- [ ] Public release assets do not include local databases, runtime files, logs, or auth files.

## Review summary template

```text
Security-sensitive files changed:
- [list files or write "None"]

Risk areas:
- [list provider data, local AI CLI data, persistence, dashboard output, release automation, or "None"]

Validation run:
- pnpm test: [pass/fail/not run]
- pnpm typecheck: [pass/fail/not run]
- npm run secret:scan: [pass/fail/not run]
- npm run secret:scan:all: [pass/fail/not run]

Known limitations:
- [list limitations or write "None"]
```

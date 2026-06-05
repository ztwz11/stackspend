# StackSpend CLI

Public alpha packaging metadata for `@stackspend/cli`.

StackSpend is local-first. The CLI reads configuration and secrets from the process environment only, writes normalized data to local SQLite, and does not enable telemetry by default.

## Requirements

- Node.js 20.11 or newer.
- `sqlite3` CLI on `PATH`; Linux/Docker defaults to `/usr/bin/sqlite3`, and Windows can use `sqlite3.exe`.
- `STACKSPEND_SQLITE_BIN` can point to a local SQLite CLI path when it is not on `PATH`.
- No live provider credentials are required for `stackspend --version`, `stackspend doctor`, or `stackspend sync --provider mock`.

## Published Alpha Usage

The package is prepared for a public npm alpha, but this repository task does not publish it.

After an alpha is published:

```bash
npm install -g @stackspend/cli@alpha
stackspend
stackspend --version
stackspend /version
stackspend doctor
stackspend /doctor
stackspend dashboard check
```

One-off execution:

```bash
npx --package @stackspend/cli@alpha stackspend
npx --package @stackspend/cli@alpha stackspend --version
npx --package @stackspend/cli@alpha stackspend /version
npx --package @stackspend/cli@alpha stackspend doctor
npx --package @stackspend/cli@alpha stackspend /doctor
npx --package @stackspend/cli@alpha stackspend dashboard check
```

## Local Tarball Review

From the repository root:

```bash
pnpm --filter @stackspend/cli build
cd apps/cli
npm pack
```

Install the generated tarball into a temporary project:

```bash
mkdir -p /tmp/stackspend-alpha-review
cd /tmp/stackspend-alpha-review
npm init -y
npm install /path/to/stackspend-cli-0.1.0-alpha.0.tgz
npm exec stackspend
npm exec stackspend -- --version
npm exec stackspend -- /version
npm exec stackspend -- doctor
npm exec stackspend -- /doctor
npm exec stackspend -- dashboard check
```

PowerShell equivalent for the temporary project:

```powershell
New-Item -ItemType Directory -Force -Path $env:TEMP\stackspend-alpha-review
Set-Location $env:TEMP\stackspend-alpha-review
npm init -y
npm install C:\path\to\stackspend-cli-0.1.0-alpha.0.tgz
npm exec stackspend
npm exec stackspend -- --version
npm exec stackspend -- /doctor
```

Do not create `.env`, paste real API keys, or write Slack webhook URLs into local project files. Fixture mode and `mock` sync are the intended no-credentials review paths.

Live provider sync is read-only and env-only. Use fixture mode for no-credentials review; export live credentials only in the shell for one run.

## Slash Home

Running `stackspend` without subcommands prints a readable slash-command home guide. In a TTY it may enter a minimal line-based slash prompt; in CI or non-TTY package review it prints the guide and exits `0`.

Supported slash aliases:

```bash
stackspend /help
stackspend /version
stackspend /doctor
stackspend /init
stackspend /dashboard
stackspend /dashboard check
stackspend /sync mock
stackspend /sync aws
stackspend /sync openai
stackspend /sync supabase
stackspend /sync cloudflare
stackspend /report ko
stackspend /quit
```

Slash aliases are thin wrappers around the existing CLI commands. Home/help does not call provider APIs, read secret values, create `.env`, or enable telemetry. ANSI color respects `NO_COLOR`, `FORCE_COLOR`, and `TERM=dumb`.

## Dashboard Check

`stackspend dashboard check` probes `http://localhost:3000/api/dashboard` by default and reports the sanitized dashboard URL, API status, local DB path/existence, payload source, provider count, and generated time.

Use `--url` only for a local dashboard origin:

```bash
stackspend dashboard check --url http://localhost:3000
```

Path, query, and hash values are ignored before printing or probing, and URLs with credentials are rejected. The command does not package, start, or serve the Next.js dashboard; from this repository, start it with `pnpm --filter @stackspend/web dev`.

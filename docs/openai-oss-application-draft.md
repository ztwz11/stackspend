# OpenAI OSS Support Application Draft

This draft is intended to help complete an open-source maintainer support application. Edit it to match the final application form and current repository state.

Do not overclaim adoption. If public metrics are limited, say the project is early and actively maintained.

## Project description

MoneySiren is a MIT-licensed local-first observability dashboard for AI coding agent, cloud, and SaaS usage. It helps open-source maintainers, indie developers, and small teams monitor OpenAI/Codex, Claude CLI, AWS, Supabase, and Cloudflare usage/cost risk without sending credentials, raw billing payloads, or local AI logs to a hosted service.

The project stores normalized snapshots in local SQLite, keeps provider connectors read-only, and keeps telemetry off by default. It includes a CLI, local Next.js dashboard, Tauri tray/HUD, fake fixtures for safe review, and release/secret-scan workflows for public OSS maintenance.

## Why this matters

AI coding agents are becoming part of everyday open-source maintenance, but they introduce new operational risks: usage limits, fragmented provider costs, sensitive local AI logs, and accidental secret exposure. Many small maintainers need visibility before they can safely automate PR review, triage, release notes, and provider workflows.

MoneySiren is intended to be a local-first reference implementation for that visibility.

## How Codex would be used

I would use Codex for core OSS maintenance work:

1. maintaining provider connectors with fixture-backed tests;
2. reviewing PRs that touch provider auth, billing normalization, local AI CLI parsing, and notification payloads;
3. hardening release workflows and GitHub Actions;
4. improving install docs for Windows and macOS;
5. generating and reviewing redaction tests to prevent secret or raw payload leakage.

I would publish the resulting `AGENTS.md`, connector testing patterns, and release workflow notes so other small OSS maintainers can reuse them.

## Benefit request

My primary request is six months of ChatGPT Pro with Codex for day-to-day coding, triage, review, documentation, and release workflow maintenance.

If appropriate, API credits would be used for limited maintainer automation experiments, especially PR review and release workflow checks against fake fixture data.

I would also welcome Codex Security access if OpenAI considers the repository's provider connector and local-first secret-handling surface suitable for deeper review.

## Public outputs

With support, I plan to publish:

- reusable `AGENTS.md` instructions for local-first AI/cloud observability repositories;
- fixture-based provider connector testing patterns;
- secret-safety regression examples;
- documented Codex-assisted maintenance workflows;
- release workflow hardening notes for small OSS maintainers.

## Honest status language

Use this if the form asks about maturity:

> MoneySiren is early and actively maintained. It is not yet being presented as a widely used OSS project. The application is based on the project's relevance to AI coding agent usage/cost observability, local-first safety model, and the public maintainer workflows that would be produced with Codex support.

## Avoid saying

Do not say:

> I want Pro because I personally need it for development.

Say instead:

> Codex support would directly improve the maintenance quality, security review, documentation, and release workflow of a public MIT-licensed local-first OSS tool for AI/cloud usage observability.

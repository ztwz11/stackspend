# Experimental Integrations

This document describes optional local-only MoneySiren integrations that are not required for the core MoneySiren workflow.

The core MoneySiren workflow is:

- read-only provider sync;
- fake or redacted fixtures for review;
- normalized local SQLite snapshots;
- local dashboard/HUD views;
- telemetry off by default;
- no persistence of credential material;
- no persistence of raw provider payloads.

Experimental integrations must not weaken those rules.

## Policy for experimental integrations

Experimental integrations must be:

- optional;
- local-first;
- clearly marked as experimental;
- isolated from hosted demo paths;
- documented with upstream stability risks;
- safe when provider behavior changes;
- conservative about logging and persistence.

They must not:

- upload local auth files to remote services;
- expose local tokens through browser inputs, URLs, logs, screenshots, reports, or issue templates;
- persist raw upstream responses;
- become required for the main dashboard to function;
- be used as the primary application story for OSS support.

## Current experimental integrations

- [Codex reset-credit expiry](./codex-reset-credits.md)

## Application positioning note

When describing MoneySiren for open-source support, focus on:

- official OpenAI organization usage/cost sync;
- local-first AI/cloud usage observability;
- read-only provider connectors;
- fake fixture-based tests;
- secret scanning;
- Codex-assisted maintenance workflows.

Do not foreground unofficial or undocumented integrations in the main application narrative.

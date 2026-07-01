# Provider Connector Test Harness

MoneySiren provider connectors should be safe, fixture-backed, and reviewable without live credentials.

## Connector pipeline

A provider connector should follow this pipeline:

```text
provider response
  -> redaction boundary
  -> normalized model
  -> local SQLite snapshot
  -> dashboard/report view model
  -> notification/HUD payload
```

Raw provider responses should not be persisted after normalization.

## Required connector properties

Each connector should document:

- provider name;
- provider area, such as cost, usage, health, or local AI CLI;
- auth mechanism;
- minimum read-only scope;
- fixture file location;
- normalized output schema;
- redaction rules;
- persistence behavior;
- dashboard/report exposure behavior;
- known limitations.

## Fixture rules

Fixtures must:

- use fake or synthetic data only;
- label fake values clearly;
- avoid real account IDs, organization IDs, project refs, invoice IDs, emails, webhook URLs, tokens, and raw auth files;
- be small enough for review;
- cover empty, normal, and high-risk states when possible.

Fixtures must not:

- contain real provider responses copied from a live account;
- contain deleted or commented-out secrets;
- contain local prompt text;
- contain raw Codex or Claude auth JSON.

## Test expectations

Provider connector tests should verify:

- parser accepts expected fixture shape;
- parser rejects or safely handles malformed input;
- normalized model contains only expected fields;
- credential material is not persisted;
- raw provider payload is not persisted;
- dashboard JSON does not contain sensitive fields;
- report and notification payloads are sanitized.

## Codex-friendly tasks

Good tasks for Codex:

- add fixture-backed parser tests;
- add redaction regression tests;
- update connector docs;
- improve error messages for missing credentials;
- improve empty-state UI copy;
- identify missing test coverage.

Tasks requiring human review:

- changing provider auth flows;
- changing credential lookup behavior;
- changing local AI CLI auth file access;
- changing database persistence boundaries;
- changing notification payloads;
- changing release signing or upload behavior.

## Review checklist

Before merging connector changes:

- [ ] The connector is read-only.
- [ ] The fixture is fake or synthetic.
- [ ] No credential material is stored in SQLite.
- [ ] No raw provider payload is persisted.
- [ ] Dashboard JSON is sanitized.
- [ ] Reports are sanitized.
- [ ] Notification payloads are sanitized.
- [ ] Secret scan passes.

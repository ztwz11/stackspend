# Provider Connectors

Provider connectors are read-only adapters that collect cloud, SaaS, and AI usage data and normalize it for local storage.

## Contract

Connectors should follow this shape conceptually:

```ts
interface ProviderConnector {
  id: string;
  displayName: string;
  checkConnection(input: unknown): Promise<unknown>;
  collectCanonicalSnapshots(input: unknown): Promise<unknown[]>;
  refreshLiveToday?(input: unknown): Promise<unknown>;
}
```

## Rules

- Use read-only APIs only.
- Normalize data before storage.
- Do not persist raw provider responses.
- Redact sensitive identifiers before writing snapshots.
- Provide fixture mode with synthetic data.
- Handle rate limits and partial failures.
- Mark today/live values as provisional.
- Consider Windows local execution.

## Provider Write Actions

Provider write actions such as stopping instances, revoking API keys, disabling workers, or changing cloud resources are out of scope for the current build.

Local writes, such as saving `AWS_PROFILE` to the Windows user environment, must be labeled as local environment changes and must not be described as provider write actions.

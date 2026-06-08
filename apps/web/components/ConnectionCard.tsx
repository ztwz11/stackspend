"use client";

import { ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Messages } from "../lib/i18n";
import type { OperationsProvider } from "../lib/operations-data";
import { CredentialControls } from "./CredentialControls";
import { ProviderIcon } from "./ProviderIcon";

export function ConnectionCard({
  messages,
  provider,
}: {
  messages: Messages;
  provider: OperationsProvider;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <article className={expanded ? "connection-card" : "connection-card connection-card-collapsed"} id={provider.providerKey}>
      <header className="connection-card-header">
        <div className="provider-title-block">
          <ProviderIcon
            className={`provider-mark provider-mark-${provider.providerKey}`}
            providerKey={provider.providerKey}
          />
          <div>
            <div className="connection-title-line">
              <h2 className="connection-card-title">{provider.displayName}</h2>
              <SetupGuideLink provider={provider} messages={messages} />
            </div>
            <div className="metric-meta">{provider.authMethod}</div>
          </div>
        </div>
        <div className="badge-row">
          <StatusBadge messages={messages} state={provider.connectionState} />
          <StatusBadge messages={messages} state={provider.readOnlyTestState} />
          <button
            aria-controls={`${provider.providerKey}-connection-body`}
            aria-expanded={expanded}
            aria-label={expanded ? messages.app.closeMenu : messages.app.menu}
            className="connection-collapse-button"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <ChevronUp aria-hidden="true" className="collapse-icon" size={16} />
          </button>
        </div>
      </header>
      <div className="connection-card-body" hidden={!expanded} id={`${provider.providerKey}-connection-body`}>
        <div className="connection-action-panel">
          <CredentialControls
            providerKey={provider.providerKey}
            connections={provider.connections}
            labels={{
              savedConnections: messages.settings.savedConnections,
              connectionLabel: messages.settings.connectionLabel,
              connectionId: messages.settings.connectionId,
              credentialSecret: messages.settings.credentialSecret,
              accountIds: messages.settings.accountIds,
              openAiAdminKeyHint: messages.settings.openAiAdminKeyHint,
              credentialSaveError: messages.settings.credentialSaveError,
              credentialDeleteError: messages.settings.credentialDeleteError,
              saveCredential: messages.settings.saveCredential,
              removeCredential: messages.settings.removeCredential,
              startOAuth: messages.settings.startOAuth,
              awsManaged: messages.settings.awsManaged,
            }}
          />
        </div>
        <div className="connection-requirements">
          <span className="metric-label">{messages.settings.requiredEnv}</span>
          <RequirementLinks provider={provider} messages={messages} />
        </div>
      </div>
    </article>
  );
}

function SetupGuideLink({ provider, messages }: { provider: OperationsProvider; messages: Messages }) {
  const link = provider.setupLinks[0];

  if (link === undefined) {
    return null;
  }

  return (
    <a className="connection-guide-link" href={link.href} rel="noreferrer" target="_blank">
      <span>{messages.settings.setupLinks}</span>
      <ExternalLink aria-hidden="true" size={12} strokeWidth={1.9} />
    </a>
  );
}

function RequirementLinks({ provider, messages }: { provider: OperationsProvider; messages: Messages }) {
  return (
    <div className="requirements-cell" aria-label={messages.settings.requiredValueLinks}>
      <div>{provider.requiredEnvKeys.join(", ")}</div>
      {provider.setupLinks.length === 0 ? null : (
        <div className="setup-link-list">
          <div className="metric-label">{messages.settings.setupLinks}</div>
          {provider.setupLinks.map((link) => (
            <a className="inline-link" href={link.href} key={link.href} rel="noreferrer" target="_blank">
              <span>{link.label}</span>
              <span className="metric-meta">{link.valueHints.join(", ")}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ messages, state }: { messages: Messages; state: string }) {
  return <span className={`badge ${badgeClassFor(state)}`}>{messages.states[state] ?? state}</span>;
}

function badgeClassFor(state: string): string {
  if (state === "ok" || state === "fresh" || state === "live" || state === "low" || state === "read_only_ready") {
    return "badge-ok";
  }

  if (state === "critical" || state === "down" || state === "error" || state === "invalid") {
    return "badge-critical";
  }

  if (
    state === "warning" ||
    state === "stale" ||
    state === "missing" ||
    state === "not_configured" ||
    state === "locked" ||
    state === "expired" ||
    state === "emergency_planned"
  ) {
    return "badge-warn";
  }

  if (state === "provisional" || state === "daily_bucket" || state === "month_to_date" || state === "current_period") {
    return "badge-live";
  }

  return "badge-neutral";
}

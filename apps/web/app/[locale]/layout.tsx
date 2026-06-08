import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, type ServiceNavItem } from "../../components/AppShell";
import { getMessages, isLocale, type Locale } from "../../lib/i18n";
import { readConnectionsStatus } from "../../lib/connection-status";
import { resolveDashboardTimezone } from "../../lib/operations-data";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export function generateStaticParams() {
  return [{ locale: "ko" }, { locale: "en" }, { locale: "ja" }];
}

export const dynamic = "force-dynamic";

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale as Locale;
  const messages = getMessages(locale);
  const timezone = resolveDashboardTimezone();
  const serviceNavItems = await readSavedServiceNavItems();

  return (
    <AppShell locale={locale} messages={messages} serviceNavItems={serviceNavItems} timezone={timezone}>
      {children}
    </AppShell>
  );
}

async function readSavedServiceNavItems(): Promise<ServiceNavItem[]> {
  try {
    const status = await readConnectionsStatus();

    return status.providers
      .filter((provider) => provider.connectionState !== "not_configured")
      .map((provider) => ({
        providerKey: provider.providerKey,
        label: provider.displayName,
      }));
  } catch {
    return [];
  }
}

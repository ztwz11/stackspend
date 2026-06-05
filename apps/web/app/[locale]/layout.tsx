import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "../../components/AppShell";
import { getMessages, isLocale, type Locale } from "../../lib/i18n";
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

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale as Locale;
  const messages = getMessages(locale);
  const timezone = resolveDashboardTimezone();

  return (
    <AppShell locale={locale} messages={messages} timezone={timezone}>
      {children}
    </AppShell>
  );
}

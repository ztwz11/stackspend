import { AsyncDashboardView } from "../../../../components/AsyncDashboardView";
import type { DashboardGrouping } from "../../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../../lib/i18n";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    group?: string | string[];
  }>;
}

export const dynamic = "force-dynamic";

export default async function RisksPage({ params, searchParams }: PageProps) {
  const locale = await readLocale(params);
  const grouping = await readGrouping(searchParams);
  const messages = getMessages(locale);

  return (
    <AsyncDashboardView
      locale={locale}
      messages={messages}
      screen="risks"
      grouping={grouping}
      groupingBasePath={`/${locale}/dashboard/risks`}
    />
  );
}

async function readLocale(params: PageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  return isLocale(locale) ? locale : "en";
}

async function readGrouping(searchParams: PageProps["searchParams"]): Promise<DashboardGrouping> {
  const group = (await searchParams)?.group;
  const value = Array.isArray(group) ? group[0] : group;

  return value === "connection" ? "connection" : "service";
}

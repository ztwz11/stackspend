import {
  PageHeader,
  ServicesOverview,
  type DashboardGrouping,
} from "../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../lib/i18n";
import { readOperationsDashboard } from "../../../lib/operations-data";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    group?: string | string[];
  }>;
}

export const dynamic = "force-dynamic";

export default async function ServicesPage({ params, searchParams }: PageProps) {
  const locale = await readLocale(params);
  const grouping = await readGrouping(searchParams);
  const messages = getMessages(locale);
  const dashboard = await readOperationsDashboard();

  return (
    <>
      <PageHeader title={messages.services.title} subtitle={messages.services.subtitle} />
      <ServicesOverview
        dashboard={dashboard}
        locale={locale}
        messages={messages}
        grouping={grouping}
        groupingBasePath={`/${locale}/services`}
      />
    </>
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

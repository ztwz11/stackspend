import {
  DashboardTabs,
  PageHeader,
  RisksView,
} from "../../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../../lib/i18n";
import { readOperationsDashboard } from "../../../../lib/operations-data";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function RisksPage({ params }: PageProps) {
  const locale = await readLocale(params);
  const messages = getMessages(locale);
  const dashboard = await readOperationsDashboard();

  return (
    <>
      <PageHeader title={messages.dashboard.risksTitle} subtitle={messages.dashboard.risksSubtitle} />
      <DashboardTabs locale={locale} messages={messages} active="risks" />
      <RisksView dashboard={dashboard} locale={locale} messages={messages} />
    </>
  );
}

async function readLocale(params: PageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  return isLocale(locale) ? locale : "en";
}

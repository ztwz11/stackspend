import Link from "next/link";
import {
  ConnectionsView,
  PageHeader,
} from "../../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../../lib/i18n";
import { readOperationsDashboard } from "../../../../lib/operations-data";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({ params }: PageProps) {
  const locale = await readLocale(params);
  const messages = getMessages(locale);
  const dashboard = await readOperationsDashboard();

  return (
    <>
      <PageHeader
        title={messages.settings.connectionsTitle}
        subtitle={messages.settings.connectionsSubtitle}
        meta={
          <Link className="ghost-button header-control" href={`/${locale}/providers`}>
            {messages.catalog.addProvider}
          </Link>
        }
      />
      <ConnectionsView dashboard={dashboard} locale={locale} messages={messages} />
    </>
  );
}

async function readLocale(params: PageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  return isLocale(locale) ? locale : "en";
}

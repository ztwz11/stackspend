import { NotificationSettingsPanel } from "../../../../components/NotificationSettings";
import { PageHeader } from "../../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../../lib/i18n";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ params }: PageProps) {
  const locale = await readLocale(params);
  const messages = getMessages(locale);

  return (
    <>
      <PageHeader title={messages.settings.notificationsTitle} subtitle={messages.settings.notificationsSubtitle} />
      <NotificationSettingsPanel locale={locale} messages={messages} />
    </>
  );
}

async function readLocale(params: PageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  return isLocale(locale) ? locale : "en";
}

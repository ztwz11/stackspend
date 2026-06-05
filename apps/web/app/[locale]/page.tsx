import { redirect } from "next/navigation";
import { isLocale } from "../../lib/i18n";

interface LocaleIndexPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleIndexPage({ params }: LocaleIndexPageProps) {
  const { locale } = await params;

  redirect(`/${isLocale(locale) ? locale : "en"}/dashboard/overview`);
}

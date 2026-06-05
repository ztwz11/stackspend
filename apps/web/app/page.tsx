import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { detectLocale } from "../lib/i18n";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const headerList = await headers();
  const locale = detectLocale(headerList.get("accept-language"));

  redirect(`/${locale}/dashboard/overview`);
}

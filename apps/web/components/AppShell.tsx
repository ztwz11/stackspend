"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LOCALES,
  replaceLocale,
  type Locale,
  type Messages,
} from "../lib/i18n";

interface AppShellProps {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
  timezone: string;
}

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

export function AppShell({ children, locale, messages, timezone }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navGroups = buildNavGroups(locale, messages);

  return (
    <div className="app-shell" lang={locale}>
      <div className="mobile-bar">
        <button
          aria-label={messages.app.menu}
          className="menu-button"
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          <span>{messages.app.menu}</span>
        </button>
        <strong>{messages.app.title}</strong>
        <span className="muted">{locale.toUpperCase()}</span>
      </div>

      {drawerOpen ? (
        <>
          <button
            aria-label={messages.app.closeMenu}
            className="drawer-backdrop"
            type="button"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="drawer">
            <div className="drawer-header">
              <strong>{messages.app.title}</strong>
              <button className="ghost-button" type="button" onClick={() => setDrawerOpen(false)}>
                {messages.app.closeMenu}
              </button>
            </div>
            <Navigation groups={navGroups} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <ShellFooter locale={locale} messages={messages} pathname={pathname} timezone={timezone} />
          </aside>
        </>
      ) : null}

      <div className="layout-grid">
        <aside className="sidebar">
          <div>
            <div className="brand">
              <p className="brand-title">{messages.app.title}</p>
              <p className="brand-subtitle">{messages.app.subtitle}</p>
            </div>
            <Navigation groups={navGroups} pathname={pathname} />
          </div>
          <ShellFooter locale={locale} messages={messages} pathname={pathname} timezone={timezone} />
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function Navigation({
  groups,
  pathname,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="nav-groups">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="nav-group-title">{group.label}</p>
          {group.items.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                className={active ? "nav-link nav-link-active" : "nav-link"}
                href={item.href}
                key={item.href}
                {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ShellFooter({
  locale,
  messages,
  pathname,
  timezone,
}: {
  locale: Locale;
  messages: Messages;
  pathname: string;
  timezone: string;
}) {
  return (
    <div className="sidebar-footer">
      <div>
        <div className="muted">{messages.app.locale}</div>
        <div className="locale-switcher" aria-label={messages.app.locale}>
          {LOCALES.map((nextLocale) => (
            <Link
              className={nextLocale === locale ? "locale-link locale-link-active" : "locale-link"}
              href={replaceLocale(pathname, nextLocale)}
              key={nextLocale}
            >
              {nextLocale.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <div className="muted">{messages.app.timezone}</div>
        <strong>{timezone}</strong>
      </div>
    </div>
  );
}

function buildNavGroups(locale: Locale, messages: Messages): readonly NavGroup[] {
  const base = `/${locale}`;

  return [
    {
      label: messages.nav.dashboard,
      items: [
        { href: `${base}/dashboard/overview`, label: messages.nav.overview },
        { href: `${base}/dashboard/today`, label: messages.nav.today },
        { href: `${base}/dashboard/forecast`, label: messages.nav.forecast },
        { href: `${base}/dashboard/risks`, label: messages.nav.risks },
      ],
    },
    {
      label: messages.nav.services,
      items: [
        { href: `${base}/services`, label: messages.nav.allServices },
        { href: `${base}/services/aws`, label: "AWS" },
        { href: `${base}/services/openai`, label: "OpenAI" },
        { href: `${base}/services/supabase`, label: "Supabase" },
        { href: `${base}/services/cloudflare`, label: "Cloudflare" },
      ],
    },
    {
      label: messages.nav.settings,
      items: [
        { href: `${base}/settings/connections`, label: messages.nav.connections },
        { href: `${base}/settings/preferences`, label: messages.nav.preferences },
        { href: `${base}/providers`, label: messages.nav.providers },
      ],
    },
  ];
}

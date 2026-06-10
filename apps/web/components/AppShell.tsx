"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BellRing,
  ChevronsLeft,
  CircleHelp,
  Cloud,
  FileText,
  Home,
  KeyRound,
  Link2,
  Share2,
  Settings,
  SlidersHorizontal,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
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
  serviceNavItems: readonly ServiceNavItem[];
  timezone: string;
}

export interface ServiceNavItem {
  providerKey: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

export function AppShell({ children, locale, messages, serviceNavItems, timezone }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navGroups = buildNavGroups(locale, messages, serviceNavItems);

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

      <div className={sidebarCollapsed ? "layout-grid layout-grid-collapsed" : "layout-grid"}>
        <aside className={sidebarCollapsed ? "sidebar sidebar-collapsed" : "sidebar"}>
          <div>
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                <Share2 size={19} strokeWidth={2.5} />
              </span>
              <p className="brand-title">{messages.app.title}</p>
            </div>
            <Navigation groups={navGroups} pathname={pathname} />
          </div>
          <ShellFooter
            collapsed={sidebarCollapsed}
            locale={locale}
            messages={messages}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            pathname={pathname}
            timezone={timezone}
          />
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
          {group.items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                className={active ? "nav-link nav-link-active" : "nav-link"}
                href={item.href}
                key={item.href}
                {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
              >
                <span className="nav-link-body">
                  <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                  <span className="nav-link-label">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ShellFooter({
  collapsed = false,
  locale,
  messages,
  onToggleCollapsed,
  pathname,
  timezone,
}: {
  collapsed?: boolean;
  locale: Locale;
  messages: Messages;
  onToggleCollapsed?: () => void;
  pathname: string;
  timezone: string;
}) {
  const preferencesHref = `/${locale}/settings/preferences`;

  return (
    <div className="sidebar-footer">
      <div>
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
        <Link className="footer-link" href={preferencesHref} title={messages.nav.preferences}>
          <Settings aria-hidden="true" size={15} />
          <span className="footer-link-label">{messages.nav.preferences}</span>
        </Link>
        <Link
          className="footer-link"
          href={`${preferencesHref}#timezone`}
          title={`${messages.app.timezone}: ${timezone}`}
        >
          <CircleHelp aria-hidden="true" size={15} />
          <span className="footer-link-label">{messages.app.timezone}: {timezone}</span>
        </Link>
        {onToggleCollapsed === undefined ? null : (
          <button
            aria-pressed={collapsed}
            className="footer-link footer-button"
            onClick={onToggleCollapsed}
            title={collapsed ? messages.app.menu : messages.app.closeMenu}
            type="button"
          >
            <ChevronsLeft aria-hidden="true" className="footer-toggle-icon" size={15} />
            <span className="footer-link-label">{collapsed ? messages.app.menu : messages.app.closeMenu}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function buildNavGroups(
  locale: Locale,
  messages: Messages,
  serviceNavItems: readonly ServiceNavItem[],
): readonly NavGroup[] {
  const base = `/${locale}`;

  return [
    {
      label: messages.nav.dashboard,
      items: [
        { href: `${base}/dashboard/overview`, label: messages.nav.overview, icon: Home },
        { href: `${base}/dashboard/today`, label: messages.nav.today, icon: BarChart3 },
        { href: `${base}/dashboard/forecast`, label: messages.nav.forecast, icon: WalletCards },
        { href: `${base}/dashboard/risks`, label: messages.nav.risks, icon: Bell },
      ],
    },
    {
      label: messages.nav.services,
      items: [
        { href: `${base}/services`, label: messages.nav.allServices, icon: FileText },
        ...serviceNavItems.map((item) => ({
          href: `${base}/services/${item.providerKey}`,
          label: item.label,
          icon: Cloud,
        })),
      ],
    },
    {
      label: messages.nav.settings,
      items: [
        { href: `${base}/settings/connections`, label: messages.nav.connections, icon: Link2 },
        { href: `${base}/settings/notifications`, label: messages.nav.notifications, icon: BellRing },
        { href: `${base}/settings/preferences`, label: messages.nav.preferences, icon: SlidersHorizontal },
        { href: `${base}/providers`, label: messages.nav.providers, icon: KeyRound },
      ],
    },
  ];
}

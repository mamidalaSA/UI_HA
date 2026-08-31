import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";
import { THEME_TOKENS, type ThemeKey } from "@/lib/theme";
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconMail,
  IconMenu,
  IconUser,
} from "@/components/icons";

export interface NavItem {
  label: string;
  to: string;
  icon: (p: { className?: string }) => ReactNode;
  end?: boolean;
}

interface AppShellProps {
  theme: ThemeKey;
  brandTitle?: string;
  brandSubtitle?: string;
  navSectionLabel?: string;
  navItems: NavItem[];
  pageTitle: string;
  headerRight?: ReactNode;
  notificationCount?: number;
  messageCount?: number;
  children: ReactNode;
}

export function AppShell({
  theme,
  brandTitle = "City Hospital",
  brandSubtitle = "Care with Compassion",
  navSectionLabel,
  navItems,
  pageTitle,
  headerRight,
  notificationCount = 0,
  messageCount = 0,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const t = THEME_TOKENS[theme];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100">
      <aside
        className={`${t.sidebarBg} ${t.sidebarText} flex h-full flex-col transition-all duration-200 ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <span className="text-lg font-bold">+</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight">{brandTitle}</p>
              <p className={`truncate text-[11px] ${t.sidebarTextMuted}`}>{brandSubtitle}</p>
            </div>
          )}
        </div>

        {navSectionLabel && !collapsed && (
          <p className={`px-5 pb-2 text-[11px] font-semibold tracking-wider ${t.sidebarTextMuted}`}>
            {navSectionLabel}
          </p>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? `${t.sidebarBgActive} text-white`
                    : `${t.sidebarTextMuted} hover:bg-white/10 hover:text-white`
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className={`mx-3 mb-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${t.sidebarTextMuted} hover:bg-white/10 hover:text-white`}
        >
          <IconLogout className="h-[18px] w-[18px]" />
          {!collapsed && <span>Logout</span>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Toggle sidebar"
            >
              <IconMenu />
            </button>
            <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            {headerRight}
            <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <IconBell />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notificationCount}
                </span>
              )}
            </button>
            <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <IconMail />
              {messageCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {messageCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 hover:bg-slate-100"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${t.accentBg} text-white`}>
                  <IconUser className="h-4 w-4" />
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-slate-800">
                    {user?.full_name}
                  </span>
                  <span className="block text-xs capitalize leading-tight text-slate-500">
                    {user?.role.replace("_", " ")}
                  </span>
                </span>
                <IconChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <IconLogout className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

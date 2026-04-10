"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  CreditCard,
  Calendar,
  Settings,
  Briefcase,
  Shield,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function AppShell(props: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  headerRight?: React.ReactNode;
}) {
  const { title, children, actions, backHref, headerRight } = props;
  const pathname = usePathname();
  const router = useRouter();

  // ALL hooks at top - STRICT ORDER
  const [lang, setLang] = useState<Language>("en");
  const [open, setOpen] = useState(false);
  const t = getTranslation(lang || "en");
  
  // Guard: Don't render if translation object is not ready
  if (!t) {
    return null;
  }

  const [role, setRole] = useState<"super_admin" | "co_admin" | "staff" | "editor" | null>(null);
  const [permissions, setPermissions] = useState<{
    accounts?: boolean;
    events?: boolean;
    members?: boolean;
    subscriptions_collect?: boolean;
    subscriptions_approve?: boolean;
  } | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ctx = await getTenantContext();
        if (!ctx) return;
        setRole(ctx.role || null);
        setPermissions((ctx.permissions || null) as any);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items: NavItem[] = useMemo(() => {
    const isSuper = role === "super_admin" || role === "co_admin" || !role;
    const perms = permissions || {};
    const canAccounts = isSuper || perms.accounts !== false;
    const canEvents = isSuper || perms.events !== false;
    const canMembers = isSuper || perms.members !== false;
    const canSubCollect = isSuper || perms.subscriptions_collect === true;
    const canSubApprove = isSuper || perms.subscriptions_approve === true;

    const base: NavItem[] = [
      { href: "/", label: t.dashboard, icon: <Home className="w-5 h-5" /> },
    ];

    if (canMembers) {
      base.push({ href: "/families", label: t.families, icon: <Users className="w-5 h-5" /> });
    }
    if (canAccounts) {
      base.push({ href: "/accounts", label: t.accounts, icon: <CreditCard className="w-5 h-5" /> });
    }
    if (canEvents) {
      base.push({ href: "/events", label: t.events || "Events", icon: <Calendar className="w-5 h-5" /> });
    }

    if (canSubCollect) {
      base.push({ href: "/collections", label: "Collections", icon: <Wallet className="w-5 h-5" /> });
    }
    if (canSubApprove) {
      base.push({ href: "/subscriptions/pending", label: "Pending Collections", icon: <Shield className="w-5 h-5" /> });
    }

    // Staff & admin only for masjid admins
    if (isSuper) {
      base.push({
        href: "/staff",
        label: (t as any).staff_management || t.staff,
        icon: <Briefcase className="w-5 h-5" />,
      });
      base.push({
        href: "/admin",
        label: (t as any).admin_settings || "Admin",
        icon: <Shield className="w-5 h-5" />,
      });
    }

    base.push({ href: "/settings", label: t.settings, icon: <Settings className="w-5 h-5" /> });
    return base;
  }, [t, role, permissions]);

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return `flex items-center gap-3 px-4 py-3 rounded-3xl font-bold transition-all ${
      active
        ? "bg-emerald-50 text-emerald-700"
        : "text-neutral-600 hover:bg-neutral-50"
    }`;
  };

  const bottomItemClass = (href: string) => {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return `${
      active
        ? "app-bottom-nav-item app-bottom-nav-item-active"
        : "app-bottom-nav-item hover:bg-white/60"
    }`;
  };

  const handleLogout = async () => {
    console.log("APP_SHELL_LOGOUT_CLICKED");
    try {
      console.log("APP_SHELL_BEFORE_SIGNOUT");
      await supabase.auth.signOut();
      console.log("APP_SHELL_AFTER_SIGNOUT");
      router.push('/login');
    } catch (error) {
      console.log("APP_SHELL_CATCH_ERROR", error);
      console.error('Logout error:', error);
      router.push('/login'); // Still redirect even if sign out fails
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-neutral-200 shadow-2xl transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:shadow-none`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Smart Masjeedh
              </p>
              <p className="text-lg font-black text-emerald-700 truncate">
                {t.dashboard}
              </p>
            </div>
            <button
              className="md:hidden p-2 hover:bg-neutral-50 rounded-3xl"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className={linkClass(it.href)}>
                <span className="text-emerald-600">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </Link>
            ))}
          </nav>

          {/* Logout button - always at bottom */}
          <div className="mt-auto pt-4 border-t border-neutral-200">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 rounded-3xl bg-red-50 text-red-700 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="pl-0 md:pl-72">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200">
          <div className="px-4 py-4 md:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden p-2 rounded-3xl hover:bg-neutral-100 transition-colors"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-slate-700" />
              </button>
              {backHref ? (
                <Link
                  href={backHref}
                  className="hidden sm:inline-flex px-3 py-2 rounded-3xl bg-neutral-50 text-neutral-900 font-black text-xs uppercase tracking-widest hover:bg-neutral-100 transition-all"
                >
                  Back
                </Link>
              ) : null}
              <h1 className="text-lg md:text-xl font-black text-neutral-900 truncate">
                {title}
              </h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {actions}
              {headerRight}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 pb-28 md:pb-8">
          <div className="w-full max-w-none sm:max-w-md lg:max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Floating bottom navigation (mobile) */}
        <nav className="md:hidden app-bottom-nav z-20">
          <div className="flex items-center gap-2">
            {items
              .filter((it) => it.href !== "/admin")
              .slice(0, 5)
              .map((it) => {
                const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
                return (
                  <Link key={it.href} href={it.href} className={bottomItemClass(it.href)}>
                    <span className={active ? "text-emerald-700" : "text-neutral-600"}>{it.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{it.label}</span>
                  </Link>
                );
              })}
          </div>
        </nav>
      </div>
    </div>
  );
}


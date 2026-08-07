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
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";

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

  // ALL HOOKS AT TOP
  const { requiresOnboarding, user, tenantContext } = useSupabaseAuth();
  const [lang, setLang] = useState<Language>("en");
  const [open, setOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const t = getTranslation(lang || "en");
  const [role, setRole] = useState<"super_admin" | "co_admin" | "staff" | "editor" | null>(null);
  const [permissions, setPermissions] = useState<{
    accounts?: boolean;
    events?: boolean;
    families?: boolean;
    subscriptions_collect?: boolean;
    subscriptions_approve?: boolean;
  } | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  // Use tenantContext from auth provider instead of loading separately
  useEffect(() => {
    if (tenantContext) {
      setRole(tenantContext.role || null);
      setPermissions((tenantContext.permissions || null) as any);
      console.log("[AppShell] Tenant context updated:", {
        role: tenantContext.role,
        permissions: tenantContext.permissions,
      });
    } else {
      console.log("[AppShell] No tenant context available");
    }
  }, [tenantContext]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Show onboarding modal if required
  useEffect(() => {
    if (requiresOnboarding && user) {
      setShowOnboarding(true);
    }
  }, [requiresOnboarding, user]);

  // Nav Items
  const items: NavItem[] = useMemo(() => {
    const isSuper = role === "super_admin" || role === "co_admin";
    const perms = permissions || {};
    
    console.log("[AppShell] Navigation check:", { role, isSuper, permissions: perms });
    
    // Super admins get UNCONDITIONAL access to everything
    const canAccounts = isSuper;
    const canEvents = isSuper;
    const canFamilies = isSuper;
    const canSubCollect = isSuper;
    const canSubApprove = isSuper;
    const canStaff = isSuper;
    const canAdmin = isSuper;

    const base: NavItem[] = [
      { href: "/", label: t.dashboard, icon: <Home className="w-5 h-5" /> },
    ];

    if (canFamilies) {
      base.push({ href: "/families", label: t.families, icon: <Users className="w-5 h-5" /> });
    }
    if (canAccounts) {
      base.push({ href: "/accounts", label: t.accounts, icon: <CreditCard className="w-5 h-5" /> });
    }
    if (canEvents) {
      base.push({ href: "/events", label: t.events, icon: <Calendar className="w-5 h-5" /> });
    }
    if (canSubCollect) {
      base.push({ href: "/collections", label: t.collections, icon: <Wallet className="w-5 h-5" /> });
    }
    if (canSubApprove) {
      base.push({
        href: "/subscriptions/pending",
        label: t.pending_collections,
        icon: <Shield className="w-5 h-5" />,
      });
    }

    if (isSuper) {
      base.push({
        href: "/staff",
        label: t.staff_management,
        icon: <Briefcase className="w-5 h-5" />,
      });
      base.push({
        href: "/admin",
        label: t.admin_settings,
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
        ? "bg-white/20 text-white backdrop-blur-sm border border-white/20"
        : "text-emerald-100 hover:bg-white/10"
    }`;
  };

  const bottomItemClass = (href: string) => {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return `${
      active
        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 -translate-y-0.5"
        : "text-emerald-600 hover:bg-emerald-50"
    } flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-full transition-all`;
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 text-neutral-900 font-sans">
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => {
          setShowOnboarding(false);
          // Refresh tenant context to get updated onboarding status
          window.location.reload();
        }}
      />
      {open && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-72 bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-900 border-r border-emerald-600/30 shadow-2xl transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:shadow-none`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">{t.brand_name}</p>
              <p className="text-lg font-black text-white truncate">{t.dashboard}</p>
            </div>
            <button className="md:hidden p-2 hover:bg-emerald-600/30 rounded-3xl" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="w-5 h-5 text-emerald-200" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className={linkClass(it.href)}>
                <span className={pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href)) ? "text-emerald-200" : "text-emerald-300"}>{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-emerald-600/30">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 rounded-3xl bg-red-500/20 text-red-200 font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all border border-red-500/30"
            >
              {t.logout}
            </button>
          </div>
        </div>
      </aside>

      <div className="pl-0 md:pl-72">
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-emerald-200/50">
          <div className="px-4 py-4 md:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button className="md:hidden p-2 rounded-3xl hover:bg-emerald-100 transition-colors" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu className="w-6 h-6 text-emerald-700" />
              </button>
              {backHref && (
                <Link href={backHref} className="hidden sm:inline-flex px-3 py-2 rounded-3xl bg-emerald-50 text-emerald-900 font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-200">
                  {t.back}
                </Link>
              )}
              <h1 className="text-lg md:text-xl font-black text-emerald-900 truncate">{title}</h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <PWAInstallButton />
              {actions}{headerRight}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 pb-28 md:pb-8">
          <div className="w-full max-w-none sm:max-w-md lg:max-w-6xl mx-auto">{children}</div>
        </main>

        <nav className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-xl border border-emerald-200/50 shadow-2xl rounded-full px-2 py-2">
          <div className="flex items-center gap-2">
            {items.filter((it) => it.href !== "/admin").slice(0, 5).map((it) => {
              const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
              return (
                <Link key={it.href} href={it.href} className={bottomItemClass(it.href)}>
                  <span className={active ? "text-white" : "text-emerald-600"}>{it.icon}</span>
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
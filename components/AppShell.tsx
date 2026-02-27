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
  Menu,
  X,
} from "lucide-react";
import { translations, Language } from "@/lib/i18n/translations";

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
}) {
  const { title, children, actions, backHref } = props;
  const pathname = usePathname();
  const router = useRouter();

  const [lang, setLang] = useState<Language>("en");
  const [open, setOpen] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items: NavItem[] = useMemo(
    () => [
      { href: "/", label: t.dashboard, icon: <Home className="w-5 h-5" /> },
      { href: "/families", label: t.families, icon: <Users className="w-5 h-5" /> },
      { href: "/accounts", label: t.accounts, icon: <CreditCard className="w-5 h-5" /> },
      { href: "/events", label: t.events || "Events", icon: <Calendar className="w-5 h-5" /> },
      {
        href: "/staff",
        label: (t as any).staff_management || t.staff,
        icon: <Briefcase className="w-5 h-5" />,
      },
      { href: "/settings", label: t.settings, icon: <Settings className="w-5 h-5" /> },
    ],
    [t]
  );

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
      active
        ? "bg-emerald-50 text-emerald-700"
        : "text-slate-600 hover:bg-slate-50"
    }`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-100 shadow-2xl transform transition-transform duration-300 ease-in-out
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
              className="md:hidden p-2 hover:bg-slate-50 rounded-2xl"
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

          <button
            onClick={() => router.push("/")}
            className="mt-6 w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Home
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="md:pl-72">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="px-4 py-4 md:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden p-2 rounded-2xl hover:bg-slate-100 transition-colors"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-slate-700" />
              </button>
              {backHref ? (
                <Link
                  href={backHref}
                  className="hidden sm:inline-flex px-3 py-2 rounded-2xl bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Back
                </Link>
              ) : null}
              <h1 className="text-lg md:text-xl font-black text-slate-900 truncate">
                {title}
              </h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
          </div>
        </header>

        <main className="p-4 md:p-8">
          <div className="w-full max-w-md md:max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}


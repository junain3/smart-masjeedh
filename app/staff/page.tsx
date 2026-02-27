"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Briefcase, Building2, Phone, MapPin, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { AppShell } from "@/components/AppShell";

type BoardMember = {
  id: string;
  masjid_id: string;
  full_name: string;
  designation: string;
  photo_url?: string | null;
};

type Employee = {
  id: string;
  masjid_id: string;
  name: string;
  role: string;
  address: string;
  phone: string;
  photo_url?: string | null;
};

const demoBoard: BoardMember[] = [
  {
    id: "demo-president",
    masjid_id: "demo",
    full_name: "அப்துல் ரஹ்மான்",
    designation: "President",
    photo_url: null,
  },
  {
    id: "demo-vp-1",
    masjid_id: "demo",
    full_name: "முஹம்மது சலீம்",
    designation: "Vice President",
    photo_url: null,
  },
  {
    id: "demo-secretary",
    masjid_id: "demo",
    full_name: "இப்ராஹிம்",
    designation: "Secretary",
    photo_url: null,
  },
  {
    id: "demo-treasurer",
    masjid_id: "demo",
    full_name: "ஜுனைன்",
    designation: "Treasurer",
    photo_url: null,
  },
  {
    id: "demo-member-1",
    masjid_id: "demo",
    full_name: "அஹ்மத்",
    designation: "Member",
    photo_url: null,
  },
];

const demoEmployees: Employee[] = [
  {
    id: "demo-emp-1",
    masjid_id: "demo",
    name: "இமாம் அப்துல்லாஹ்",
    role: "Imam",
    address: "மஸ்ஜித் வீதி, ஊர் பெயர்",
    phone: "0770000000",
    photo_url: null,
  },
  {
    id: "demo-emp-2",
    masjid_id: "demo",
    name: "முஅத்தின் யூசுப்",
    role: "Muazzin",
    address: "மஸ்ஜித் வீதி, ஊர் பெயர்",
    phone: "0710000000",
    photo_url: null,
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function roleKey(designation: string): "president" | "vice" | "secretary" | "treasurer" | "member" {
  const s = (designation || "").toLowerCase().trim();
  if (/(president|தலைவர்)/.test(s)) return "president";
  if (/(vice|உப)/.test(s)) return "vice";
  if (/(secretary|செயலாளர்)/.test(s)) return "secretary";
  if (/(treasurer|பொருளாளர்)/.test(s)) return "treasurer";
  return "member";
}

export default function StaffManagementPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [tab, setTab] = useState<"board" | "employees">("board");
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const [board, setBoard] = useState<BoardMember[]>(demoBoard);
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    async function fetchAll() {
      if (!supabase) return;
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Board members (optional table)
        const { data: boardData, error: boardErr } = await supabase
          .from("board_members")
          .select("id, masjid_id, full_name, designation, photo_url")
          .eq("masjid_id", session.user.id);

        if (!boardErr && boardData) {
          setBoard(boardData as any);
          setIsLive(true);
        }

        // Employees (optional table)
        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("id, masjid_id, name, role, address, phone, photo_url")
          .eq("masjid_id", session.user.id)
          .order("name", { ascending: true });

        if (!empErr && empData) {
          setEmployees(empData as any);
          setIsLive(true);
        }
      } catch (_e) {
        // keep demo mode
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [router]);

  const grouped = useMemo(() => {
    const g = {
      president: [] as BoardMember[],
      vice: [] as BoardMember[],
      secretary: [] as BoardMember[],
      treasurer: [] as BoardMember[],
      member: [] as BoardMember[],
    };
    for (const m of board) g[roleKey(m.designation)].push(m);
    return g;
  }, [board]);

  return (
    <AppShell title={t.staff_management}>
      <div className="space-y-6">
        <div className="app-card p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isLive ? t.live_data : t.demo_mode}
          </p>
        </div>
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setTab("board")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === "board" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.board_members}
          </button>
          <button
            onClick={() => setTab("employees")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === "employees" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.employees}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center app-card">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t.loading}</p>
          </div>
        ) : tab === "board" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Building2 className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-black uppercase tracking-widest">{t.board_members}</h2>
            </div>

            {/* Hierarchical card chart (clean, card-based) */}
            <div className="space-y-4">
              <RoleSection title={t.president} items={grouped.president} />
              <RoleSection title={t.vice_presidents} items={grouped.vice} />
              <RoleSection title={t.secretary} items={grouped.secretary} />
              <RoleSection title={t.treasurer} items={grouped.treasurer} />
              <RoleSection title={t.members_list} items={grouped.member} grid />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-black uppercase tracking-widest">{t.employees}</h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {employees.map((e) => (
                <Link
                  key={e.id}
                  href={`/staff/employees/${e.id}`}
                  className="app-card p-4 hover:border-emerald-200 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center text-slate-500 font-black">
                        {e.photo_url ? (
                          <img src={e.photo_url} alt={e.name} className="w-full h-full object-cover" />
                        ) : (
                          initials(e.name)
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-800 truncate">{e.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.role}</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-300" />
                            <span className="truncate">{e.address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-300" />
                            <span className="truncate">{e.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RoleSection(props: { title: string; items: BoardMember[]; grid?: boolean }) {
  const { title, items, grid } = props;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{title}</p>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-4 border border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          —
        </div>
      ) : (
        <div className={grid ? "grid grid-cols-2 gap-3" : "space-y-3"}>
          {items.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl p-4 border border-slate-50 shadow-sm hover:border-amber-100 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center text-slate-500 font-black shrink-0">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.full_name} className="w-full h-full object-cover" />
                  ) : (
                    initials(m.full_name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{m.full_name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                    {m.designation}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


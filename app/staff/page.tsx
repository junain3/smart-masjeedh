"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Briefcase, Building2, Phone, MapPin, ChevronRight, Plus, Edit2, Trash2, Shield, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { AppShell } from "@/components/AppShell";
import { getTenantContext } from "@/lib/tenant";
import { EmptyState } from "@/components/EmptyState";
import { useAppToast } from "@/components/ToastProvider";

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
  address?: string;
  phone?: string;
  photo_url?: string | null;
  monthly_salary?: number | null;
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
  const { toast, confirm } = useAppToast();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [tab, setTab] = useState<"board" | "employees">("board");
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [boardTableAvailable, setBoardTableAvailable] = useState(false);
  const [employeesTableAvailable, setEmployeesTableAvailable] = useState(false);

  const [admins, setAdmins] = useState<BoardMember[]>([]);
  const [employeesSource, setEmployeesSource] = useState<"employees" | "user_roles" | "demo">("demo");

  const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardMember | null>(null);
  const [boardFullName, setBoardFullName] = useState("");
  const [boardDesignation, setBoardDesignation] = useState("");
  const [boardPhotoUrl, setBoardPhotoUrl] = useState("");

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empAddress, setEmpAddress] = useState("");
  const [empPhotoUrl, setEmpPhotoUrl] = useState("");
  const [empMonthlySalary, setEmpMonthlySalary] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        const ctx = await getTenantContext();
        if (!ctx) {
          router.push("/login");
          return;
        }

        setCanManage(ctx.role === "super_admin" || ctx.role === "co_admin");
        setBoardTableAvailable(false);
        setEmployeesTableAvailable(false);

        // Super admin / co-admin should appear under board members
        try {
          const { data: adminRoles, error: adminErr } = await supabase
            .from("user_roles")
            .select("user_id, masjid_id, role, email")
            .eq("masjid_id", ctx.masjidId)
            .in("role", ["super_admin", "co_admin"] as any);

          if (!adminErr && adminRoles) {
            const mapped = (adminRoles as any[]).map((r) => {
              const email = (r as any).email as string | null;
              const display = email ? email.split("@")[0] : (r as any).user_id;
              const role = ((r as any).role || "").toString();
              return {
                id: `${(r as any).user_id}-${role}`,
                masjid_id: (r as any).masjid_id,
                full_name: display,
                designation: role === "super_admin" ? "Super Admin" : "Co Admin",
                photo_url: null,
              } as BoardMember;
            });
            setAdmins(mapped);
          }
        } catch {
          // ignore
        }

        // Board members (optional table)
        const { data: boardData, error: boardErr } = await supabase
          .from("board_members")
          .select("id, masjid_id, full_name, designation, photo_url")
          .eq("masjid_id", ctx.masjidId);

        if (!boardErr && boardData) {
          setBoard(boardData as any);
          setBoardTableAvailable(true);
          setIsLive(true);
        } else if (boardErr) {
          const msg = (boardErr as any)?.message || "";
          if (msg.includes("Could not find the table") || msg.includes("schema cache") || (boardErr as any)?.code === "PGRST205") {
            setBoardTableAvailable(false);
          }
        }

        // Employees: prefer employees table (full details) if available; fallback to user_roles.
        let didSetEmployees = false;
        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("id, masjid_id, name, role, address, phone, photo_url, monthly_salary")
          .eq("masjid_id", ctx.masjidId)
          .order("created_at", { ascending: true } as any);

        if (!empErr && empData) {
          setEmployees((empData as any) || []);
          setEmployeesSource("employees");
          setEmployeesTableAvailable(true);
          setIsLive(true);
          didSetEmployees = true;
        } else if (empErr) {
          const msg = (empErr as any)?.message || "";
          if (msg.includes("Could not find the table") || msg.includes("schema cache") || (empErr as any)?.code === "PGRST205") {
            setEmployeesTableAvailable(false);
          }
        }

        if (!didSetEmployees) {
          const { data: staffData, error: staffErr } = await supabase
            .from("user_roles")
            .select("user_id, masjid_id, role, email")
            .eq("masjid_id", ctx.masjidId)
            .order("created_at", { ascending: true });

          if (!staffErr && staffData) {
            const mapped = (staffData as any[])
              .filter((r) => {
                const role = ((r as any).role || "").toString();
                return role !== "super_admin" && role !== "co_admin";
              })
              .map((r) => {
                const email = (r as any).email as string | null;
                const display = email ? email.split("@")[0] : (r as any).user_id;
                return {
                  id: (r as any).user_id,
                  masjid_id: (r as any).masjid_id,
                  name: display,
                  role: (r as any).role || "staff",
                  address: "",
                  phone: "",
                  photo_url: null,
                } as Employee;
              });
            setEmployees(mapped);
            setEmployeesSource("user_roles");
            setIsLive(true);
          } else {
            setEmployeesSource("demo");
          }
        }
      } catch (_e) {
        // keep demo mode
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [router]);

  const formatSupabaseError = (e: any) => {
    if (!e) return "Unknown error";
    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
    return parts.join(" • ");
  };

  const isMissingTableError = (e: any) => {
    const msg = (e as any)?.message || "";
    const code = (e as any)?.code;
    return code === "PGRST205" || msg.includes("Could not find the table") || msg.includes("schema cache");
  };

  const openBoardCreate = () => {
    setEditingBoard(null);
    setBoardFullName("");
    setBoardDesignation("");
    setBoardPhotoUrl("");
    setIsBoardModalOpen(true);
  };

  const openBoardEdit = (m: BoardMember) => {
    setEditingBoard(m);
    setBoardFullName(m.full_name || "");
    setBoardDesignation(m.designation || "");
    setBoardPhotoUrl((m.photo_url as any) || "");
    setIsBoardModalOpen(true);
  };

  const saveBoardMember = async () => {
    if (!supabase) return;
    setSubmitting(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;
      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      if (!isAdmin) {
        toast({ kind: "error", title: "Access denied", message: "Admin only" });
        return;
      }

      const payload = {
        masjid_id: ctx.masjidId,
        full_name: boardFullName.trim(),
        designation: boardDesignation.trim(),
        photo_url: boardPhotoUrl.trim() || null,
      } as any;

      if (!payload.full_name || !payload.designation) {
        toast({ kind: "error", title: "Missing", message: "Enter name and designation" });
        return;
      }

      const q = editingBoard
        ? supabase.from("board_members").update(payload).eq("id", editingBoard.id).eq("masjid_id", ctx.masjidId)
        : supabase.from("board_members").insert([payload]);

      const { error } = await q;
      if (error) throw error;
      setIsBoardModalOpen(false);
      setEditingBoard(null);
      toast({ kind: "success", title: "Saved", message: "Board member updated" });
      router.refresh();
      // refetch without full reload
      const { data: boardData } = await supabase
        .from("board_members")
        .select("id, masjid_id, full_name, designation, photo_url")
        .eq("masjid_id", ctx.masjidId);
      if (boardData) setBoard(boardData as any);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        toast({ kind: "error", title: "Database", message: "board_members table not found in Supabase. Create the table to enable Add/Edit/Delete." });
        setBoardTableAvailable(false);
      } else {
        toast({ kind: "error", title: "Error", message: formatSupabaseError(e) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBoardMember = async (m: BoardMember) => {
    if (!supabase) return;
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;
      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      if (!isAdmin) {
        toast({ kind: "error", title: "Access denied", message: "Admin only" });
        return;
      }

      const ok = await confirm({
        title: t.confirm_delete,
        message: t.confirm_delete,
        confirmText: t.remove || "Remove",
        cancelText: t.cancel || "Cancel",
      });
      if (!ok) return;

      const { error } = await supabase
        .from("board_members")
        .delete()
        .eq("id", m.id)
        .eq("masjid_id", ctx.masjidId);
      if (error) throw error;
      setBoard((prev) => prev.filter((x) => x.id !== m.id));
      toast({ kind: "success", title: "Deleted", message: "Removed" });
    } catch (e: any) {
      if (isMissingTableError(e)) {
        toast({ kind: "error", title: "Database", message: "board_members table not found in Supabase. Create the table to enable Remove." });
        setBoardTableAvailable(false);
      } else {
        toast({ kind: "error", title: "Error", message: formatSupabaseError(e) });
      }
    }
  };

  const openEmployeeCreate = () => {
    setEditingEmployee(null);
    setEmpName("");
    setEmpRole("");
    setEmpPhone("");
    setEmpAddress("");
    setEmpPhotoUrl("");
    setEmpMonthlySalary("");
    setIsEmployeeModalOpen(true);
  };

  const openEmployeeEdit = (e: Employee) => {
    setEditingEmployee(e);
    setEmpName(e.name || "");
    setEmpRole(e.role || "");
    setEmpPhone(e.phone || "");
    setEmpAddress(e.address || "");
    setEmpPhotoUrl((e.photo_url as any) || "");
    setEmpMonthlySalary(
      typeof (e as any).monthly_salary === "number" && Number.isFinite((e as any).monthly_salary)
        ? String((e as any).monthly_salary)
        : ""
    );
    setIsEmployeeModalOpen(true);
  };

  const saveEmployee = async () => {
    if (!supabase) return;
    setSubmitting(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;
      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      if (!isAdmin) {
        toast({ kind: "error", title: "Access denied", message: "Admin only" });
        return;
      }
      if (employeesSource !== "employees") {
        toast({ kind: "error", title: "Not supported", message: "Employees table not available" });
        return;
      }

      const payload = {
        masjid_id: ctx.masjidId,
        name: empName.trim(),
        role: empRole.trim(),
        phone: empPhone.trim() || null,
        address: empAddress.trim() || null,
        photo_url: empPhotoUrl.trim() || null,
        monthly_salary: empMonthlySalary.trim() ? Number(empMonthlySalary) : null,
      } as any;

      if (!payload.name || !payload.role) {
        toast({ kind: "error", title: "Missing", message: "Enter name and role" });
        return;
      }

      if (payload.monthly_salary !== null && (!Number.isFinite(payload.monthly_salary) || payload.monthly_salary < 0)) {
        toast({ kind: "error", title: "Invalid", message: "Enter a valid monthly salary" });
        return;
      }

      const q = editingEmployee
        ? supabase.from("employees").update(payload).eq("id", editingEmployee.id).eq("masjid_id", ctx.masjidId)
        : supabase.from("employees").insert([payload]);

      const { error } = await q;
      if (error) throw error;

      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      toast({ kind: "success", title: "Saved", message: "Employee updated" });

      const { data: empData } = await supabase
        .from("employees")
        .select("id, masjid_id, name, role, address, phone, photo_url, monthly_salary")
        .eq("masjid_id", ctx.masjidId)
        .order("created_at", { ascending: true } as any);
      if (empData) setEmployees((empData as any) || []);
    } catch (e: any) {
      if (isMissingTableError(e)) {
        toast({ kind: "error", title: "Database", message: "employees table not found in Supabase. Create the table to enable Add/Edit/Delete." });
        setEmployeesTableAvailable(false);
      } else {
        toast({ kind: "error", title: "Error", message: formatSupabaseError(e) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEmployee = async (e: Employee) => {
    if (!supabase) return;
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;
      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      if (!isAdmin) {
        toast({ kind: "error", title: "Access denied", message: "Admin only" });
        return;
      }
      if (employeesSource !== "employees") {
        toast({ kind: "error", title: "Not supported", message: "Employees table not available" });
        return;
      }

      const ok = await confirm({
        title: t.confirm_delete,
        message: t.confirm_delete,
        confirmText: t.remove || "Remove",
        cancelText: t.cancel || "Cancel",
      });
      if (!ok) return;

      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", e.id)
        .eq("masjid_id", ctx.masjidId);
      if (error) throw error;
      setEmployees((prev) => prev.filter((x) => x.id !== e.id));
      toast({ kind: "success", title: "Deleted", message: "Removed" });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        toast({ kind: "error", title: "Database", message: "employees table not found in Supabase. Create the table to enable Remove." });
        setEmployeesTableAvailable(false);
      } else {
        toast({ kind: "error", title: "Error", message: formatSupabaseError(err) });
      }
    }
  };

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
          <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
            {isLive ? t.live_data : t.demo_mode}
          </p>
        </div>
        <div className="flex p-1 bg-neutral-50 border border-neutral-200 rounded-3xl">
          <button
            onClick={() => setTab("board")}
            className={`flex-1 py-3 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === "board" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-600"
            }`}
          >
            {t.board_members}
          </button>
          <button
            onClick={() => setTab("employees")}
            className={`flex-1 py-3 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === "employees" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-600"
            }`}
          >
            {t.employees}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center app-card">
            <p className="text-neutral-600 font-bold uppercase tracking-widest text-xs">{t.loading}</p>
          </div>
        ) : tab === "board" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-neutral-600">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-black uppercase tracking-widest">{t.board_members}</h2>
              </div>
              {canManage && boardTableAvailable ? (
                <button
                  onClick={openBoardCreate}
                  className="px-4 py-3 rounded-[999px] bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-700/25 active:scale-[0.98] transition-all"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    {t.add || "Add"}
                  </span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  <Shield className="w-4 h-4" />
                  {canManage ? "Setup required" : "Admin only"}
                </div>
              )}
            </div>

            {/* Hierarchical card chart (clean, card-based) */}
            <div className="space-y-4">
              {admins.length ? (
                <RoleSection title={(t as any).admin_settings || "Admins"} items={admins} grid />
              ) : null}
              <RoleSection title={t.president} items={grouped.president} onEdit={canManage && boardTableAvailable ? openBoardEdit : undefined} onDelete={canManage && boardTableAvailable ? deleteBoardMember : undefined} />
              <RoleSection title={t.vice_presidents} items={grouped.vice} onEdit={canManage && boardTableAvailable ? openBoardEdit : undefined} onDelete={canManage && boardTableAvailable ? deleteBoardMember : undefined} />
              <RoleSection title={t.secretary} items={grouped.secretary} onEdit={canManage && boardTableAvailable ? openBoardEdit : undefined} onDelete={canManage && boardTableAvailable ? deleteBoardMember : undefined} />
              <RoleSection title={t.treasurer} items={grouped.treasurer} onEdit={canManage && boardTableAvailable ? openBoardEdit : undefined} onDelete={canManage && boardTableAvailable ? deleteBoardMember : undefined} />
              <RoleSection title={t.members_list} items={grouped.member} grid onEdit={canManage && boardTableAvailable ? openBoardEdit : undefined} onDelete={canManage && boardTableAvailable ? deleteBoardMember : undefined} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-neutral-600">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-black uppercase tracking-widest">{t.employees}</h2>
              </div>
              {employeesSource === "employees" && canManage && employeesTableAvailable ? (
                <button
                  onClick={openEmployeeCreate}
                  className="px-4 py-3 rounded-[999px] bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-700/25 active:scale-[0.98] transition-all"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    {t.add || "Add"}
                  </span>
                </button>
              ) : (
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  {employeesSource === "user_roles" ? "Limited" : "Demo"}
                </div>
              )}
            </div>

            {employees.length === 0 ? (
              <EmptyState
                title={lang === "tm" ? "பணியாளர்கள் இல்லை" : "No staff yet"}
                description={
                  lang === "tm"
                    ? "Admin பக்கம் மூலம் புதிய staff-ஐ invite செய்யுங்கள்"
                    : "Invite staff members from Admin to get started."
                }
                icon={<Briefcase className="w-8 h-8" />}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {employees.map((e) => (
                  <div
                    key={e.id}
                    className="app-card p-4 hover:border-emerald-200 transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-3xl bg-neutral-50 border border-neutral-200 overflow-hidden flex items-center justify-center text-neutral-600 font-black">
                          {e.photo_url ? (
                            <img src={e.photo_url} alt={e.name} className="w-full h-full object-cover" />
                          ) : (
                            initials(e.name)
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-neutral-900 truncate">{e.name}</h4>
                          <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{e.role}</p>
                          <div className="mt-2 space-y-1">
                            {e.address ? (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-600">
                                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="truncate">{e.address}</span>
                              </div>
                            ) : null}
                            {e.phone ? (
                              <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-600">
                                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="truncate">{e.phone}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/staff/employees/${e.id}`}
                          className="p-2 rounded-3xl hover:bg-neutral-50 text-neutral-600 transition-all"
                          title={t.profile}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                        {employeesSource === "employees" && canManage && employeesTableAvailable ? (
                          <>
                            <button
                              onClick={() => openEmployeeEdit(e)}
                              className="p-2 rounded-3xl hover:bg-neutral-50 text-neutral-600 transition-all"
                              title={t.edit || "Edit"}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteEmployee(e)}
                              className="p-2 rounded-3xl hover:bg-rose-50 text-rose-700 transition-all"
                              title={t.remove || "Remove"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isBoardModalOpen && (
          <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
              <div className="p-8 pb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-neutral-900">
                  {editingBoard ? (t.edit || "Edit") : (t.add || "Add")}
                </h2>
                <button onClick={() => setIsBoardModalOpen(false)} className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>

              <div className="px-8 pb-8 overflow-y-auto flex-1">
                <div className="space-y-5">
                  <div className="app-field">
                    <label className="app-label">{t.name}</label>
                    <input value={boardFullName} onChange={(e) => setBoardFullName(e.target.value)} className="app-input font-bold" />
                  </div>
                  <div className="app-field">
                    <label className="app-label">{t.role}</label>
                    <input value={boardDesignation} onChange={(e) => setBoardDesignation(e.target.value)} className="app-input font-bold" placeholder="President / Secretary" />
                  </div>
                  <div className="app-field">
                    <label className="app-label">Photo URL</label>
                    <input value={boardPhotoUrl} onChange={(e) => setBoardPhotoUrl(e.target.value)} className="app-input font-bold text-xs" placeholder="https://..." />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur border-t border-neutral-100 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <button onClick={saveBoardMember} disabled={submitting} className="w-full app-btn-primary py-5 text-lg">
                  {submitting ? (t.saving || "SAVING...") : t.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {isEmployeeModalOpen && (
          <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
              <div className="p-8 pb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-neutral-900">
                  {editingEmployee ? (t.edit || "Edit") : (t.add || "Add")}
                </h2>
                <button onClick={() => setIsEmployeeModalOpen(false)} className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>

              <div className="px-8 pb-8 overflow-y-auto flex-1">
                <div className="space-y-5">
                  <div className="app-field">
                    <label className="app-label">{t.name}</label>
                    <input value={empName} onChange={(e) => setEmpName(e.target.value)} className="app-input font-bold" />
                  </div>
                  <div className="app-field">
                    <label className="app-label">{t.role}</label>
                    <input value={empRole} onChange={(e) => setEmpRole(e.target.value)} className="app-input font-bold" placeholder="Imam / Muazzin" />
                  </div>
                  <div className="app-field">
                    <label className="app-label">Phone</label>
                    <input value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} className="app-input font-bold" />
                  </div>
                  <div className="app-field">
                    <label className="app-label">Address</label>
                    <input value={empAddress} onChange={(e) => setEmpAddress(e.target.value)} className="app-input font-bold" />
                  </div>
                  <div className="app-field">
                    <label className="app-label">Monthly Salary</label>
                    <input
                      type="number"
                      value={empMonthlySalary}
                      onChange={(e) => setEmpMonthlySalary(e.target.value)}
                      className="app-input font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div className="app-field">
                    <label className="app-label">Photo URL</label>
                    <input value={empPhotoUrl} onChange={(e) => setEmpPhotoUrl(e.target.value)} className="app-input font-bold text-xs" placeholder="https://..." />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur border-t border-neutral-100 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <button onClick={saveEmployee} disabled={submitting} className="w-full app-btn-primary py-5 text-lg">
                  {submitting ? (t.saving || "SAVING...") : t.save}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RoleSection(props: {
  title: string;
  items: BoardMember[];
  grid?: boolean;
  onEdit?: (m: BoardMember) => void;
  onDelete?: (m: BoardMember) => void;
}) {
  const { title, items, grid, onEdit, onDelete } = props;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">{title}</p>
      {items.length === 0 ? (
        <div className="app-card p-4 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          —
        </div>
      ) : (
        <div className={grid ? "grid grid-cols-2 gap-3" : "space-y-3"}>
          {items.map((m) => (
            <div
              key={m.id}
              className="app-card p-4 hover:border-amber-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-3xl bg-neutral-50 border border-neutral-200 overflow-hidden flex items-center justify-center text-neutral-600 font-black shrink-0">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.full_name} className="w-full h-full object-cover" />
                  ) : (
                    initials(m.full_name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-neutral-900 truncate">{m.full_name}</p>
                  <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest truncate">
                    {m.designation}
                  </p>
                </div>
                {onEdit || onDelete ? (
                  <div className="ml-auto flex items-center gap-1">
                    {onEdit ? (
                      <button
                        onClick={() => onEdit(m)}
                        className="p-2 rounded-3xl hover:bg-neutral-50 text-neutral-600 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        onClick={() => onDelete(m)}
                        className="p-2 rounded-3xl hover:bg-rose-50 text-rose-700 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


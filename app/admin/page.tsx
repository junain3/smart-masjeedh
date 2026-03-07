"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translations, Language } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";
import { Shield, Mail, Trash2 } from "lucide-react";

type EmployeeRow = {
  id: string;
  masjid_id: string;
  name: string;
};

type CollectorProfileRow = {
  id: string;
  masjid_id: string;
  user_id: string;
  collector_employee_id: string | null;
  default_commission_percent: number;
};

type RoleRow = {
  id: string;
  masjid_id: string;
  user_id: string;
  email: string | null;
  role: "super_admin" | "co_admin" | "staff" | "editor";
  permissions?: {
    accounts?: boolean;
    events?: boolean;
    members?: boolean;
    subscriptions_collect?: boolean;
    subscriptions_approve?: boolean;
  } | null;
};

type InviteRow = {
  id: string;
  masjid_id: string;
  email: string;
  role: "staff" | "editor";
  status: "pending" | "accepted" | "revoked";
  created_at: string;
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [masjidId, setMasjidId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [selfRole, setSelfRole] = useState<"super_admin" | "co_admin" | "staff" | "editor" | null>(null);
  const [error, setError] = useState<string>("");

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [collectorProfiles, setCollectorProfiles] = useState<Record<string, CollectorProfileRow>>({});
  const [savingCollectorForUserId, setSavingCollectorForUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "editor">("staff");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const ctx = await getTenantContext();
        if (!ctx) {
          router.push("/login");
          return;
        }

        setMasjidId(ctx.masjidId);

        // Bootstrap owner role row if missing (only when masjid owner is logged in)
        if (ctx.masjidId === ctx.userId) {
          const { data: existing, error: roleErr } = await supabase
            .from("user_roles")
            .select("*")
            .eq("masjid_id", ctx.masjidId)
            .eq("user_id", ctx.userId)
            .maybeSingle();
          if (roleErr && !roleErr.message?.includes("No rows")) throw roleErr;
          if (!existing) {
            const { data: inserted, error: insErr } = await supabase
              .from("user_roles")
              .insert([
                {
                  masjid_id: ctx.masjidId,
                  user_id: ctx.userId,
                  email: ctx.email,
                  role: "super_admin",
                },
              ])
              .select("*")
              .single();
            if (insErr) throw insErr;
            setSelfRole((inserted as any)?.role || ctx.role || null);
          } else {
            setSelfRole((existing as any)?.role || ctx.role || null);
          }
        } else {
          setSelfRole(ctx.role || null);
        }

        if (!(ctx.role === "super_admin" || ctx.role === "co_admin")) {
          setError("Access denied. Only Masjid Admin can manage users.");
          setRoles([]);
          setInvites([]);
          return;
        }

        const { data: allRoles } = await supabase
          .from("user_roles")
          .select("*")
          .eq("masjid_id", ctx.masjidId)
          .order("created_at", { ascending: true });
        setRoles((allRoles as any) || []);

        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("id,masjid_id,name")
          .eq("masjid_id", ctx.masjidId)
          .order("name", { ascending: true });
        if (!empErr) setEmployees(((empData as any) || []) as EmployeeRow[]);

        const collectorUserIds = (((allRoles as any) || []) as RoleRow[])
          .filter((r) => ((r.permissions as any) || {})?.subscriptions_collect === true)
          .map((r) => r.user_id);
        if (collectorUserIds.length > 0) {
          const { data: profData, error: profErr } = await supabase
            .from("subscription_collector_profiles")
            .select("id,masjid_id,user_id,collector_employee_id,default_commission_percent")
            .eq("masjid_id", ctx.masjidId)
            .in("user_id", collectorUserIds);
          if (!profErr) {
            const map: Record<string, CollectorProfileRow> = {};
            (((profData as any) || []) as any[]).forEach((p) => {
              map[p.user_id] = p as any;
            });
            setCollectorProfiles(map);
          }
        } else {
          setCollectorProfiles({});
        }

        const { data: allInvites } = await supabase
          .from("role_invitations")
          .select("*")
          .eq("masjid_id", ctx.masjidId)
          .order("created_at", { ascending: false });
        setInvites((allInvites as any) || []);
      } catch (e: any) {
        setError(e.message || "Failed to load admin settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const upsertCollectorProfile = async (userId: string, next: { collector_employee_id?: string | null; default_commission_percent?: number }) => {
    if (!supabase || !masjidId || !canManage) return;
    try {
      setSavingCollectorForUserId(userId);
      const current = collectorProfiles[userId];
      const payload: any = {
        masjid_id: masjidId,
        user_id: userId,
        collector_employee_id:
          typeof next.collector_employee_id !== "undefined" ? next.collector_employee_id : current?.collector_employee_id ?? null,
        default_commission_percent:
          typeof next.default_commission_percent !== "undefined"
            ? next.default_commission_percent
            : current?.default_commission_percent ?? 0,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("subscription_collector_profiles")
        .upsert([payload], { onConflict: "masjid_id,user_id" })
        .select("id,masjid_id,user_id,collector_employee_id,default_commission_percent")
        .single();
      if (error) throw error;

      setCollectorProfiles((prev) => ({ ...prev, [userId]: data as any }));
      toast({ kind: "success", title: "Saved", message: "Collector settings updated" });
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to save collector settings" });
    } finally {
      setSavingCollectorForUserId(null);
    }
  };

  const removeCollectorProfile = async (userId: string) => {
    if (!supabase || !masjidId || !canManage) return;
    const ok = await confirm({
      title: "Remove collector profile?",
      message: "This will remove linked employee and commission settings for this collector.",
      confirmText: "Remove",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      setSavingCollectorForUserId(userId);
      const { error } = await supabase
        .from("subscription_collector_profiles")
        .delete()
        .eq("masjid_id", masjidId)
        .eq("user_id", userId);
      if (error) throw error;

      setCollectorProfiles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast({ kind: "success", title: "Removed", message: "Collector profile removed" });
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to remove collector profile" });
    } finally {
      setSavingCollectorForUserId(null);
    }
  };

  const roleLabel = (r: RoleRow["role"]) => {
    if (r === "super_admin") return t.super_admin;
    if (r === "co_admin") return "Co Admin";
    if (r === "staff") return t.staff_role;
    return t.editor_role;
  };

  const inviteRoleLabel = (r: InviteRow["role"]) => {
    if (r === "staff") return t.staff_role;
    return t.editor_role;
  };

  const canManage = selfRole === "super_admin" || selfRole === "co_admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canManage) return;
    setInviting(true);
    setError("");
    try {
      if (!masjidId) return;

      if (!email.trim()) {
        setError("Email is required.");
        return;
      }

      const { error: insErr } = await supabase.from("role_invitations").insert([
        {
          masjid_id: masjidId,
          email: email.trim(),
          role,
          status: "pending",
        },
      ]);
      if (insErr) throw insErr;

      setEmail("");
      setRole("staff");

      const { data: allInvites } = await supabase
        .from("role_invitations")
        .select("*")
        .eq("masjid_id", masjidId)
        .order("created_at", { ascending: false });
      setInvites((allInvites as any) || []);
    } catch (e: any) {
      setError(e.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveRole = async (row: RoleRow) => {
    if (!supabase || !canManage) return;
    if (row.role === "super_admin") return;
    const ok = await confirm({
      title: t.confirm_delete,
      message: t.confirm_delete,
      confirmText: t.remove || "Remove",
      cancelText: t.cancel || "Cancel",
    });
    if (!ok) return;
    try {
      if (!masjidId) return;
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", row.id)
        .eq("masjid_id", masjidId);
      if (error) throw error;
      setRoles((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to remove user" });
    }
  };

  const staffRows = useMemo(
    () => roles.filter((r) => r.role !== "super_admin"),
    [roles]
  );

  const updateRole = async (row: RoleRow, nextRole: RoleRow["role"]) => {
    if (!supabase || !canManage) return;
    if (row.role === "super_admin") return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: nextRole })
        .eq("id", row.id)
        .eq("masjid_id", row.masjid_id);
      if (error) throw error;
      setRoles((prev) => prev.map((r) => (r.id === row.id ? { ...r, role: nextRole } : r)));
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to update role" });
    }
  };

  const togglePermission = async (
    row: RoleRow,
    key: "accounts" | "events" | "members" | "subscriptions_collect" | "subscriptions_approve"
  ) => {
    if (!supabase || !canManage) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const current = (row.permissions as any) || {};
      const nextValue = !(current[key] ?? true);
      const next = { ...current, [key]: nextValue };

      const { error } = await supabase
        .from("user_roles")
        .update({ permissions: next })
        .eq("id", row.id)
        .eq("masjid_id", row.masjid_id);
      if (error) throw error;

      setRoles((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, permissions: next as any } : r
        )
      );
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to update permission" });
    }
  };

  return (
    <AppShell
      title={t.admin_settings}
      actions={
        <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-neutral-600">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>{canManage ? t.super_admin : ""}</span>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="app-card p-4 border-amber-200 bg-amber-50/60 text-amber-800 text-[11px] font-bold">
            {error}
          </div>
        )}

        {canManage && (
          <div className="app-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-black uppercase tracking-widest">
                {t.invite_user}
              </h2>
            </div>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="app-field">
                <label className="app-label">{t.email}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="app-input pl-12 font-bold"
                    placeholder="user@example.com"
                    required
                  />
                </div>
              </div>
              <div className="app-field">
                <label className="app-label">{t.role}</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="app-select font-bold"
                >
                  <option value="staff">{t.staff_role}</option>
                  <option value="editor">{t.editor_role}</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="w-full app-btn-primary py-5"
              >
                {inviting ? t.loading : t.invite_user}
              </button>
              <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                Invitations are stored in Supabase (`role_invitations`) for audit;
                you can send email links using your own mail service.
              </p>
            </form>
          </div>
        )}

        {loading ? (
          <div className="app-card p-6 text-center text-[11px] font-bold text-neutral-600">
            {t.loading}
          </div>
        ) : canManage ? (
          <>
            <div className="app-card p-5 space-y-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-neutral-600">
                {t.staff_management}
              </h2>
              <div className="hidden md:grid grid-cols-4 gap-3 text-[11px] font-bold text-neutral-600 uppercase tracking-widest border-b border-neutral-200 pb-2">
                <span>{t.email}</span>
                <span>{t.role}</span>
                <span>Permissions</span>
                <span className="text-right">{t.remove}</span>
              </div>
              <div className="space-y-2">
                {staffRows.length === 0 ? (
                  <p className="text-[11px] font-bold text-neutral-600">
                    {t.no_matches}
                  </p>
                ) : (
                  staffRows.map((r) => {
                    const perms = (r.permissions as any) || {};
                    const accountsOn = perms.accounts ?? true;
                    const eventsOn = perms.events ?? true;
                    const membersOn = perms.members ?? true;
                    const subCollectOn = perms.subscriptions_collect ?? false;
                    const subApproveOn = perms.subscriptions_approve ?? false;
                    const profile = collectorProfiles[r.user_id];
                    const isSavingCollector = savingCollectorForUserId === r.user_id;
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col md:grid md:grid-cols-4 gap-3 items-start md:items-center border border-neutral-200 rounded-3xl px-4 py-4 text-sm bg-white"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-neutral-900 break-all">
                            {r.email || "—"}
                          </span>
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                          <select
                            value={r.role}
                            onChange={(e) => updateRole(r, e.target.value as any)}
                            className="bg-transparent text-emerald-600 font-black text-[11px] uppercase tracking-widest outline-none"
                          >
                            <option value="staff">{t.staff_role}</option>
                            <option value="editor">{t.editor_role}</option>
                            <option value="co_admin">Co Admin</option>
                          </select>
                        </span>
                        <div className="flex flex-col gap-1 text-[10px] font-bold text-neutral-600">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-emerald-600"
                              checked={accountsOn}
                              onChange={() => togglePermission(r, "accounts")}
                            />
                            <span>Accounts</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-emerald-600"
                              checked={eventsOn}
                              onChange={() => togglePermission(r, "events")}
                            />
                            <span>Event Marking</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-emerald-600"
                              checked={membersOn}
                              onChange={() => togglePermission(r, "members")}
                            />
                            <span>Members</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-emerald-600"
                              checked={subCollectOn}
                              onChange={() => togglePermission(r, "subscriptions_collect")}
                            />
                            <span>Subscription Collect</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-emerald-600"
                              checked={subApproveOn}
                              onChange={() => togglePermission(r, "subscriptions_approve")}
                            />
                            <span>Subscription Approve</span>
                          </label>

                          {subCollectOn && (
                            <div className="mt-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Collector Settings
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</div>
                                  <select
                                    value={profile?.collector_employee_id || ""}
                                    onChange={(e) =>
                                      upsertCollectorProfile(r.user_id, {
                                        collector_employee_id: e.target.value || null,
                                      })
                                    }
                                    className="w-full bg-white border border-slate-100 rounded-2xl px-3 py-2 text-[11px] font-bold outline-none"
                                    disabled={isSavingCollector}
                                  >
                                    <option value="">Select employee</option>
                                    {employees.map((emp) => (
                                      <option key={emp.id} value={emp.id}>
                                        {emp.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commission %</div>
                                  <input
                                    type="number"
                                    defaultValue={String(profile?.default_commission_percent ?? 0)}
                                    onBlur={(e) => {
                                      const v = parseFloat(e.target.value);
                                      if (!Number.isFinite(v) || v < 0) return;
                                      upsertCollectorProfile(r.user_id, { default_commission_percent: v });
                                    }}
                                    className="w-full bg-white border border-slate-100 rounded-2xl px-3 py-2 text-[11px] font-bold outline-none"
                                    placeholder="0"
                                    disabled={isSavingCollector}
                                  />
                                </div>
                              </div>
                              <div className="text-[10px] font-bold text-slate-500">
                                {profile?.collector_employee_id ? "Configured" : "Not configured"}
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    upsertCollectorProfile(r.user_id, {
                                      collector_employee_id: null,
                                      default_commission_percent: 0,
                                    })
                                  }
                                  disabled={isSavingCollector}
                                  className="px-3 py-2 rounded-2xl bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Clear
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeCollectorProfile(r.user_id)}
                                  disabled={isSavingCollector}
                                  className="px-3 py-2 rounded-2xl bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="w-full flex justify-end">
                          <button
                            onClick={() => handleRemoveRole(r)}
                            className="px-4 py-2 rounded-3xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            {t.remove}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {invites.length > 0 && (
              <div className="app-card p-5 space-y-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-neutral-600">
                  Pending Invitations
                </h2>
                <div className="space-y-2">
                  {invites.map((i) => (
                    <div
                      key={i.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-dashed border-neutral-200 rounded-3xl px-4 py-3 bg-neutral-50"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900 break-all">
                          {i.email}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                          {inviteRoleLabel(i.role)} • {t.role_pending}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                        {new Date(i.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

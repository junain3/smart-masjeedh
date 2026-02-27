"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translations, Language } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Shield, Mail, Trash2 } from "lucide-react";

type RoleRow = {
  id: string;
  masjid_id: string;
  user_id: string;
  email: string | null;
  role: "super_admin" | "staff" | "editor";
  permissions?: {
    accounts?: boolean;
    events?: boolean;
    members?: boolean;
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
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [selfRole, setSelfRole] = useState<"super_admin" | "staff" | "editor" | null>(null);
  const [error, setError] = useState<string>("");

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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const masjidId = session.user.id;

        // Ensure current user has a role; default to super_admin for owner
        let currentRole: RoleRow | null = null;
        const { data: existing, error: roleErr } = await supabase
          .from("user_roles")
          .select("*")
          .eq("masjid_id", masjidId)
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (roleErr && !roleErr.message?.includes("No rows")) {
          throw roleErr;
        }

        if (!existing) {
          const { data: inserted, error: insErr } = await supabase
            .from("user_roles")
            .insert([
              {
                masjid_id: masjidId,
                user_id: session.user.id,
                email: session.user.email,
                role: "super_admin",
              },
            ])
            .select("*")
            .single();
          if (insErr) throw insErr;
          currentRole = inserted as any;
        } else {
          currentRole = existing as any;
        }

        setSelfRole(currentRole?.role || null);
        if (currentRole?.role !== "super_admin") {
          setError("Access denied. Only Super Admin can manage users.");
          setRoles([]);
          setInvites([]);
          return;
        }

        const { data: allRoles } = await supabase
          .from("user_roles")
          .select("*")
          .eq("masjid_id", masjidId)
          .order("created_at", { ascending: true });
        setRoles((allRoles as any) || []);

        const { data: allInvites } = await supabase
          .from("role_invitations")
          .select("*")
          .eq("masjid_id", masjidId)
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

  const roleLabel = (r: RoleRow["role"]) => {
    if (r === "super_admin") return t.super_admin;
    if (r === "staff") return t.staff_role;
    return t.editor_role;
  };

  const inviteRoleLabel = (r: InviteRow["role"]) => {
    if (r === "staff") return t.staff_role;
    return t.editor_role;
  };

  const canManage = selfRole === "super_admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canManage) return;
    setInviting(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const masjidId = session.user.id;

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
    if (!confirm(t.confirm_delete)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const masjidId = session.user.id;
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", row.id)
        .eq("masjid_id", masjidId);
      if (error) throw error;
      setRoles((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      alert(e.message || "Failed to remove user");
    }
  };

  const staffRows = useMemo(
    () => roles.filter((r) => r.role !== "super_admin"),
    [roles]
  );

  const togglePermission = async (
    row: RoleRow,
    key: "accounts" | "events" | "members"
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
      alert(e.message || "Failed to update permissions");
    }
  };

  return (
    <AppShell
      title={t.admin_settings}
      actions={
        <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-slate-500">
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
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {t.email}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                    placeholder="user@example.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {t.role}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                >
                  <option value="staff">{t.staff_role}</option>
                  <option value="editor">{t.editor_role}</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="w-full app-btn-primary py-3"
              >
                {inviting ? t.loading : t.invite_user}
              </button>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Invitations are stored in Supabase (`role_invitations`) for audit;
                you can send email links using your own mail service.
              </p>
            </form>
          </div>
        )}

        {loading ? (
          <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
            {t.loading}
          </div>
        ) : canManage ? (
          <>
            <div className="app-card p-5 space-y-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
                {t.staff_management}
              </h2>
              <div className="hidden md:grid grid-cols-4 gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                <span>{t.email}</span>
                <span>{t.role}</span>
                <span>Permissions</span>
                <span className="text-right">{t.remove}</span>
              </div>
              <div className="space-y-2">
                {staffRows.length === 0 ? (
                  <p className="text-[11px] font-bold text-slate-400">
                    {t.no_matches}
                  </p>
                ) : (
                  staffRows.map((r) => {
                    const perms = (r.permissions as any) || {};
                    const accountsOn = perms.accounts ?? true;
                    const eventsOn = perms.events ?? true;
                    const membersOn = perms.members ?? true;
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col md:grid md:grid-cols-4 gap-3 items-start md:items-center border border-slate-100 rounded-2xl px-3 py-3 text-sm bg-white"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-800 break-all">
                            {r.email || "—"}
                          </span>
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                          {roleLabel(r.role)}
                        </span>
                        <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500"
                              checked={accountsOn}
                              onChange={() => togglePermission(r, "accounts")}
                            />
                            <span>Accounts</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500"
                              checked={eventsOn}
                              onChange={() => togglePermission(r, "events")}
                            />
                            <span>Event Marking</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500"
                              checked={membersOn}
                              onChange={() => togglePermission(r, "members")}
                            />
                            <span>Members</span>
                          </label>
                        </div>
                        <div className="w-full flex justify-end">
                          <button
                            onClick={() => handleRemoveRole(r)}
                            className="px-3 py-1.5 rounded-2xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 flex items-center gap-1"
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
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
                  Pending Invitations
                </h2>
                <div className="space-y-2">
                  {invites.map((i) => (
                    <div
                      key={i.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-dashed border-slate-100 rounded-2xl px-3 py-2 bg-slate-50/60"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 break-all">
                          {i.email}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {inviteRoleLabel(i.role)} • {t.role_pending}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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


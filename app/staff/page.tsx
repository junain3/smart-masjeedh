"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit2, Trash2, X, Users, DollarSign, Calendar, Mail, Phone, Briefcase, Shield, Home as HomeIcon, CreditCard, Menu, LogOut, Settings, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { useMockAuth } from "@/components/MockAuthProvider";

export const dynamic = 'force-dynamic';

type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "super_admin" | "co_admin" | "staff" | "editor";
  basic_salary: number;
  status: "active" | "inactive";
  created_at: string;
  masjid_id: string;
};

export default function StaffPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const { user, loading: authLoading, tenantContext, signOut } = useMockAuth();
  const [lang, setLang] = useState<Language>("en");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"super_admin" | "co_admin" | "staff" | "editor">("staff");
  const [basicSalary, setBasicSalary] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [submitting, setSubmitting] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchStaff();
  }, [user]);

  async function fetchStaff() {
    if (!supabase) return;
    setLoading(true);
    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      // Mock staff data for now
      const mockStaff: Staff[] = [
        {
          id: "1",
          name: "Ahmed Mohamed",
          email: "ahmed@mjm.com",
          phone: "+94 77 123 4567",
          role: "co_admin",
          basic_salary: 50000,
          status: "active",
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId
        },
        {
          id: "2",
          name: "Fatima Rahman",
          email: "fatima@mjm.com",
          phone: "+94 76 234 5678",
          role: "staff",
          basic_salary: 35000,
          status: "active",
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId
        },
        {
          id: "3",
          name: "Mohammed Ali",
          email: "mohammed@mjm.com",
          phone: "+94 71 345 6789",
          role: "staff",
          basic_salary: 30000,
          status: "active",
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId
        },
        {
          id: "4",
          name: "Aisha Khan",
          email: "aisha@mjm.com",
          phone: "+94 77 456 7890",
          role: "editor",
          basic_salary: 25000,
          status: "inactive",
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId
        }
      ];
      
      setStaff(mockStaff);
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast({ kind: "error", title: "Error", message: err.message || "Failed to fetch staff" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);

    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      if (editingStaff) {
        // Mock update
        setStaff(prev => prev.map(s => 
          s.id === editingStaff.id 
            ? { 
                ...s, 
                name, 
                email, 
                phone, 
                role, 
                basic_salary: parseFloat(basicSalary), 
                status 
              }
            : s
        ));
      } else {
        // Mock create
        const newStaff: Staff = {
          id: Date.now().toString(),
          name,
          email,
          phone,
          role,
          basic_salary: parseFloat(basicSalary),
          status,
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId
        };
        setStaff(prev => [...prev, newStaff]);
      }

      setIsModalOpen(false);
      resetForm();
      toast({ kind: "success", title: "Success", message: `Staff ${editingStaff ? "updated" : "added"} successfully` });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to save staff" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStaff(id: string) {
    const ok = await confirm({
      title: "Delete Staff",
      message: "Are you sure you want to delete this staff member?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      // Mock delete
      setStaff(prev => prev.filter(s => s.id !== id));
      toast({ kind: "success", title: "Success", message: "Staff deleted successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to delete staff" });
    }
  }

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setRole("staff");
    setBasicSalary("");
    setStatus("active");
    setEditingStaff(null);
  };

  const filteredStaff = staff.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (q === "") return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-purple-100 text-purple-800";
      case "co_admin": return "bg-blue-100 text-blue-800";
      case "staff": return "bg-green-100 text-green-800";
      case "editor": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.loading || "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-neutral-200 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-neutral-200">
            <h1 className="text-2xl font-black text-neutral-900">MJM</h1>
            <p className="text-sm text-neutral-600">Mubeen Jummah Masjid</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <HomeIcon className="w-5 h-5" />
              <span>{t.dashboard}</span>
            </Link>
            <Link href="/families" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Users className="w-5 h-5" />
              <span>{t.families}</span>
            </Link>
            <Link href="/accounts" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <CreditCard className="w-5 h-5" />
              <span>{t.accounts}</span>
            </Link>
            <Link href="/staff" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold transition-all border-2 border-emerald-200">
              <Briefcase className="w-5 h-5" />
              <span>{t.staff_management || "Staff Management"}</span>
            </Link>
            <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Settings className="w-5 h-5" />
              <span>{t.settings}</span>
            </Link>
            <Link href="/events" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>{t.events || "Events"}</span>
            </Link>
            <div className="flex items-center gap-4 p-4 opacity-40 text-neutral-600 rounded-3xl font-bold cursor-not-allowed">
              <HelpCircle className="w-5 h-5" />
              <span>Help & Support</span>
            </div>
          </nav>

          <button 
            onClick={handleLogout}
            className="m-4 flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 rounded-3xl font-bold transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20 border-b border-neutral-200">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-neutral-600 hover:bg-neutral-50 rounded-3xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-neutral-900">{t.staff_management || "Staff Management"}</h1>
          <div className="w-10"></div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Total Staff</p>
                  <p className="text-2xl font-black text-neutral-900">{staff.length}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Active Staff</p>
                  <p className="text-2xl font-black text-emerald-600">{staff.filter(s => s.status === "active").length}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Total Salary</p>
                  <p className="text-2xl font-black text-neutral-900">
                    Rs. {staff.reduce((sum, s) => sum + s.basic_salary, 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Add Staff Button */}
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Add Staff Member
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search staff members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-black text-neutral-900">Staff Members</h2>
            </div>
            
            {filteredStaff.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {searchQuery ? "No staff found" : "No staff members"}
                </h3>
                <p className="text-sm text-neutral-600">
                  {searchQuery ? "Try a different search term" : "Add your first staff member to get started"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Staff Member</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Basic Salary</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredStaff.map((staffMember) => (
                      <tr key={staffMember.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-neutral-900">{staffMember.name}</div>
                              <div className="text-xs text-neutral-500">ID: {staffMember.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-neutral-900">{staffMember.email}</div>
                          <div className="text-xs text-neutral-500">{staffMember.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(staffMember.role)}`}>
                            {staffMember.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          Rs. {staffMember.basic_salary.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(staffMember.status)}`}>
                            {staffMember.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingStaff(staffMember);
                                setName(staffMember.name);
                                setEmail(staffMember.email);
                                setPhone(staffMember.phone);
                                setRole(staffMember.role);
                                setBasicSalary(staffMember.basic_salary.toString());
                                setStatus(staffMember.status);
                                setIsModalOpen(true);
                              }}
                              className="text-emerald-600 hover:text-emerald-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteStaff(staffMember.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Add/Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-neutral-900">
                {editingStaff ? "Edit Staff" : "Add Staff Member"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter staff name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="staff">Staff</option>
                  <option value="editor">Editor</option>
                  <option value="co_admin">Co Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Basic Salary
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter basic salary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {submitting ? "Saving..." : (editingStaff ? "Update" : "Add Staff")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

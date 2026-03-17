"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  Users, 
  Calendar, 
  CreditCard, 
  Briefcase, 
  QrCode, 
  FileText, 
  Search,
  Home,
  ArrowLeft,
  LogOut,
  Menu,
  Settings,
  HelpCircle
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [familyCount, setFamilyCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>("en");

  const t = translations[lang];

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push("/login");
        return;
      }
      setUser(user);
      fetchData();
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  const fetchData = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      console.log("📊 DASHBOARD: Fetching data for user:", user.id);

      // Fetch family count
      const { count: familyCount } = await supabase
        .from("families")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Fetch member count
      const { count: memberCount } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      setFamilyCount(familyCount || 0);
      setMemberCount(memberCount || 0);
      
      console.log("📊 DASHBOARD: Data fetched successfully", {
        familyCount,
        memberCount
      });
    } catch (err) {
      console.error("📊 DASHBOARD: Error fetching data:", err);
      setFamilyCount(0);
      setMemberCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Users, label: "Families", href: "/families" },
    { icon: Calendar, label: "Events", href: "/events" },
    { icon: CreditCard, label: "Accounts", href: "/accounts" },
    { icon: Briefcase, label: "Staff", href: "/staff" },
    { icon: QrCode, label: "QR Scanner", href: "/scanner" },
    { icon: FileText, label: "Reports", href: "/reports" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Smart Masjeedh</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <nav className="mt-8">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex-1 max-w-lg mx-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {/* Centered Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mb-4">
              <Home className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Smart Masjeedh</h1>
            <p className="text-gray-600">Mubeen Jummah Masjid Management System</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 text-center">
              <Users className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wider mb-2">Total Members</h3>
              <p className="text-3xl font-black text-gray-900">{memberCount}</p>
            </div>
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 text-center">
              <Users className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wider mb-2">Total Members</h3>
              <p className="text-3xl font-black text-gray-900">{memberCount}</p>
            </div>
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {menuItems.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
              >
                <item.icon className="w-8 h-8 text-emerald-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{item.label}</h3>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

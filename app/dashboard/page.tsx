"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
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
  Filter,
  X,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user: authUser, tenantContext, signOut, loading: authLoading } = useSupabaseAuth();
  
  // RBAC Permission Guard
 
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [familyCount, setFamilyCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>("en");
  
  // Search state
  const [searchFilters, setSearchFilters] = useState({
    gender: [] as string[],
    ageRange: { min: '', max: '' },
    birthYear: { min: '', max: '' },
    civilStatus: [] as string[],
    isMoulavi: false,
    isNewMuslim: false,
    isForeignResident: false,
    hasSpecialNeeds: false,
    hasHealthIssue: false,
    familyIsWidowHead: false,
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);

  const t = getTranslation(lang);

  useEffect(() => {
  if (authLoading) return;

  if (!authUser) {
    router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
    return;
  }

  console.log("Tenant loaded:", tenantContext);

  setUser(authUser);
  fetchData(tenantContext.masjidId);

}, [authUser, tenantContext, authLoading, router]);
  const fetchData = async (masjidId: string) => {
    if (!supabase || !masjidId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { count: familiesTotal, error: familyError } = await supabase
        .from("families")
        .select("id", { count: "exact", head: true })
        .eq("masjid_id", masjidId);

      if (familyError) throw familyError;

      const { count: membersTotal, error: memberError } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("masjid_id", masjidId);

      if (memberError) throw memberError;

      setFamilyCount(familiesTotal || 0);
      setMemberCount(membersTotal || 0);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setFamilyCount(0);
      setMemberCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (signOut) {
        await signOut();
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.push("/login");
    }
  };

  const handleSearch = async () => {
    if (!authUser) return;
    
    setSearchLoading(true);
    setSearchResults([]);
    setSearchCount(0);
    setSearchPage(1);
    
    try {
      // Build filters object for API
      const filters: any = {};
      
      if (searchFilters.gender.length > 0) {
        filters.gender = searchFilters.gender;
      }
      
      if (searchFilters.ageRange.min || searchFilters.ageRange.max) {
        filters.ageRange = {
          min: searchFilters.ageRange.min ? parseInt(searchFilters.ageRange.min) : undefined,
          max: searchFilters.ageRange.max ? parseInt(searchFilters.ageRange.max) : undefined,
        };
      }
      
      if (searchFilters.birthYear.min || searchFilters.birthYear.max) {
        filters.birthYear = {
          min: searchFilters.birthYear.min ? parseInt(searchFilters.birthYear.min) : undefined,
          max: searchFilters.birthYear.max ? parseInt(searchFilters.birthYear.max) : undefined,
        };
      }
      
      if (searchFilters.civilStatus.length > 0) {
        filters.civilStatus = searchFilters.civilStatus;
      }
      
      if (searchFilters.isMoulavi) filters.isMoulavi = true;
      if (searchFilters.isNewMuslim) filters.isNewMuslim = true;
      if (searchFilters.isForeignResident) filters.isForeignResident = true;
      if (searchFilters.hasSpecialNeeds) filters.hasSpecialNeeds = true;
      if (searchFilters.hasHealthIssue) filters.hasHealthIssue = true;
      if (searchFilters.familyIsWidowHead) filters.familyIsWidowHead = true;
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authUser.session?.access_token}`,
        },
        body: JSON.stringify({
          filters,
          pagination: { page: 1, limit: 20 },
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSearchResults(result.data.members);
        setSearchCount(result.data.count);
        setSearchTotalPages(result.pagination.totalPages);
      } else {
        console.error('Search error:', result.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchFilters({
      gender: [] as string[],
      ageRange: { min: '', max: '' },
      birthYear: { min: '', max: '' },
      civilStatus: [] as string[],
      isMoulavi: false,
      isNewMuslim: false,
      isForeignResident: false,
      hasSpecialNeeds: false,
      hasHealthIssue: false,
      familyIsWidowHead: false,
    });
    setSearchResults([]);
    setSearchCount(0);
    setSearchPage(1);
    setSearchTotalPages(1);
  };

  const updateFilter = (key: string, value: any) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };

  const menuItems = [
    { icon: Home, label: t.home, href: "/dashboard", alwaysVisible: true },
    { icon: Users, label: t.families, href: "/families", permission: "members" },
    { icon: Calendar, label: t.events, href: "/events", alwaysVisible: true },
    { icon: CreditCard, label: t.accounts, href: "/accounts", permission: ["accounts", "subscriptions_collect", "subscriptions_approve"] },
    { icon: Briefcase, label: t.staff, href: "/staff", permission: "staff_management" },
    { icon: QrCode, label: t.qr_scanner, href: "/scanner", alwaysVisible: true },
    { icon: FileText, label: t.reports, href: "/reports", permission: "reports" },
    { icon: Settings, label: t.settings, href: "/settings", permission: "settings" },
  ].filter(item => {
    if (item.alwaysVisible) return true;
    if (!item.permission) return true;
    if (!tenantContext?.permissions) return false;
    
    if (Array.isArray(item.permission)) {
      return item.permission.some(perm => tenantContext.permissions[perm]);
    }
    
    return tenantContext.permissions[item.permission];
  });

  if (authLoading || !tenantContext?.masjidId) {
  return <div>Loading...</div>;
}
return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{t.brand_name}</h2>
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
            {t.logout}
          </button>
        </div>
      </div>

      <div className="lg:ml-64">
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
                    placeholder={t.search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-3xl p-8 text-white text-center mb-8 shadow-xl">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border-4 border-white/30">
              <Home className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              {t.brand_name}
            </h1>
            <p className="text-emerald-100 font-medium">{t.smart_masjid_management_system}</p>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t.search_placeholder}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 text-center">
              <Users className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wider mb-2">
                {t.total_families}
              </h3>
              <p className="text-3xl font-black text-gray-900">{familyCount}</p>
            </div>

            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 text-center">
              <Users className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-emerald-700 uppercase tracking-wider mb-2">
                {t.total_members}
              </h3>
              <p className="text-3xl font-black text-gray-900">{memberCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {menuItems.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
              >
                <item.icon className="w-8 h-8 text-emerald-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  {item.label}
                </h3>
              </Link>
            ))}
          </div>

          {/* Search & Reports Section */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Member Search & Reports</h2>
              <Filter className="w-5 h-5 text-slate-400" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Filters Column */}
              <div className="lg:col-span-1 space-y-4">
                {/* Gender Filters */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Gender</h3>
                  <div className="space-y-2">
                    {['Male', 'Female'].map(gender => (
                      <label key={gender} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={searchFilters.gender.includes(gender)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateFilter('gender', [...searchFilters.gender, gender]);
                            } else {
                              updateFilter('gender', searchFilters.gender.filter((g: string) => g !== gender));
                            }
                          }}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span className="text-sm text-slate-700">{gender}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Age Range */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Age Range</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={searchFilters.ageRange.min}
                      onChange={(e) => updateFilter('ageRange', { ...searchFilters.ageRange, min: e.target.value })}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                    />
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={searchFilters.ageRange.max}
                      onChange={(e) => updateFilter('ageRange', { ...searchFilters.ageRange, max: e.target.value })}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                    />
                  </div>
                </div>
                
                {/* Birth Year */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Birth Year</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number" 
                      placeholder="From" 
                      value={searchFilters.birthYear.min}
                      onChange={(e) => updateFilter('birthYear', { ...searchFilters.birthYear, min: e.target.value })}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                    />
                    <input 
                      type="number" 
                      placeholder="To" 
                      value={searchFilters.birthYear.max}
                      onChange={(e) => updateFilter('birthYear', { ...searchFilters.birthYear, max: e.target.value })}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                    />
                  </div>
                </div>
                
                {/* Civil Status */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Civil Status</h3>
                  <div className="space-y-2">
                    {['Single', 'Married', 'Divorced', 'Widowed', 'Other'].map(status => (
                      <label key={status} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={searchFilters.civilStatus.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateFilter('civilStatus', [...searchFilters.civilStatus, status]);
                            } else {
                              updateFilter('civilStatus', searchFilters.civilStatus.filter((s: string) => s !== status));
                            }
                          }}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span className="text-sm text-slate-700">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Boolean Filters */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Special Categories</h3>
                  <div className="space-y-2">
                    {[
                      { id: 'isMoulavi', label: 'Moulavi' },
                      { id: 'isNewMuslim', label: 'New Muslim' },
                      { id: 'isForeignResident', label: 'Foreign Resident' },
                      { id: 'hasSpecialNeeds', label: 'Has Special Needs' },
                      { id: 'hasHealthIssue', label: 'Has Health Issue' },
                      { id: 'familyIsWidowHead', label: 'Family Widow Head' }
                    ].map(filter => (
                      <label key={filter.id} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={searchFilters[filter.id as keyof typeof searchFilters] as boolean}
                          onChange={(e) => updateFilter(filter.id, e.target.checked)}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span className="text-sm text-slate-700">{filter.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <button 
                    onClick={handleSearch}
                    disabled={searchLoading}
                    className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
                  >
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                  <button 
                    onClick={clearFilters}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              {/* Results Column */}
              <div className="lg:col-span-3">
                {/* Results Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-600">
                    Found <span className="font-black text-slate-900">{searchCount}</span> members
                  </div>
                  {searchTotalPages > 1 && (
                    <div className="text-sm text-slate-600">
                      Page <span className="font-black text-slate-900">{searchPage}</span> of <span className="font-black text-slate-900">{searchTotalPages}</span>
                    </div>
                  )}
                </div>
                
                {/* Results Table */}
                <div className="bg-slate-50 rounded-xl overflow-hidden">
                  {searchLoading ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm font-bold uppercase tracking-widest">Searching...</p>
                    </div>
                  ) : searchResults.length === 0 && searchCount === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-sm font-bold uppercase tracking-widest">No search performed yet</p>
                      <p className="text-xs mt-2">Apply filters and click Search to see results</p>
                    </div>
                  ) : searchResults.length === 0 && searchCount > 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm font-bold uppercase tracking-widest">No results found</p>
                      <p className="text-xs mt-2">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Family</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Gender</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Age</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Phone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {searchResults.map((member: any) => (
                            <tr key={member.id} className="hover:bg-white transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">{member.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{member.family_code}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{member.gender}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {member.dob ? new Date().getFullYear() - new Date(member.dob).getFullYear() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{member.civil_status || '-'}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{member.phone || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
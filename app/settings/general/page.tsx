"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, Upload, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";

export const dynamic = 'force-dynamic';

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, tenantContext } = useSupabaseAuth();
  const [lang, setLang] = useState<Language>("en");
  const [loading, setLoading] = useState(true);
  const [masjidName, setMasjidName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const t = getTranslation(lang);
  const { toast } = useAppToast();

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchMasjidSettings = async () => {
    if (!supabase || !tenantContext?.masjidId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("masjids")
        .select("id, masjid_name, tagline, logo_url, preferred_language")
        .eq("id", tenantContext.masjidId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setMasjidName(data.masjid_name || "");
        setLogoUrl(data.logo_url || "");
        setTagline(data.tagline || "");
        setPreferredLanguage(data.preferred_language || "en");
        setAddress("");
        setPhone("");
        setEmail("");
      }
    } catch (e: any) {
      console.error("Failed to load masjid settings:", e);
    } finally {
      setLoading(false);
    }
  };

  // Login redirect effect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const savedLang = localStorage.getItem("preferred_language") as Language;
    if (savedLang) setLang(savedLang);
    fetchMasjidSettings();
  }, [tenantContext?.masjidId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError("Please select an image file");
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File size must be less than 5MB");
        return;
      }
      
      setSelectedFile(file);
      setUploadError("");
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!selectedFile || !supabase || !tenantContext?.masjidId) return null;
    
    setUploading(true);
    setUploadError("");
    
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${tenantContext.masjidId}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('masjid-logos')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('masjid-logos')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError(error.message || "Failed to upload logo");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!supabase || !tenantContext?.masjidId) return;
    
    try {
      let finalLogoUrl = logoUrl;
      
      // Upload new logo if selected
      if (selectedFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          finalLogoUrl = uploadedUrl;
        } else if (uploadError) {
          // Don't fail save if upload fails, but show error
          console.error('Logo upload failed, saving other settings');
        }
      }
      
      const { error } = await supabase
        .from("masjids")
        .update({
          masjid_name: masjidName,
          logo_url: finalLogoUrl,
          tagline: tagline,
          preferred_language: preferredLanguage,
        })
        .eq("id", tenantContext.masjidId);
      
      if (error) throw error;
      
      // Also save to localStorage for immediate UI update
      localStorage.setItem("app_lang", preferredLanguage);
      
      // Show success message
      alert("Settings saved successfully!");
      
      // Reset file selection
      setSelectedFile(null);
      
    } catch (e: any) {
      console.error("Failed to save settings:", e);
      alert("Failed to save settings");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE MY ACCOUNT") {
      try {
        toast({
          kind: "error",
          title: "Invalid Confirmation",
          message: 'Please type exactly "DELETE MY ACCOUNT" to confirm.',
        });
      } catch (toastError) {
        console.error("Toast error:", toastError);
      }
      return;
    }

    setDeleting(true);

    try {
      // Get current session to send access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        try {
          toast({
            kind: "error",
            title: "Authentication Error",
            message: "No active session found. Please log in again.",
          });
        } catch (toastError) {
          console.error("Toast error:", toastError);
        }
        setDeleting(false);
        return;
      }

      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          confirmationText: deleteConfirmation,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete account");
      }

      try {
        toast({
          kind: "success",
          title: "Account Deleted",
          message: "Your account has been deleted successfully.",
        });
      } catch (toastError) {
        console.error("Toast error:", toastError);
      }

      // Redirect to login after successful deletion
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      console.error("Delete account error:", error);
      try {
        toast({
          kind: "error",
          title: "Deletion Failed",
          message: error.message || "Failed to delete account. Please try again.",
        });
      } catch (toastError) {
        console.error("Toast error:", toastError);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!authLoading && !user) return null;
  if (authLoading) return <div>Loading...</div>;
  
  // Super admins and co admins always have access
  const isSuperAdmin = tenantContext?.role === 'super_admin' || tenantContext?.role === 'co_admin';
  const hasSettingsPermission = tenantContext?.permissions?.settings === true;
  
  if (!isSuperAdmin && !hasSettingsPermission) {
    return <div>No access</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">General Settings</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">General Settings</h2>
          <p className="text-sm text-gray-600 mb-6">Configure your masjid settings and preferences.</p>
          
          {/* Settings Form */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">Masjid Name</label>
              <input
                type="text"
                value={masjidName}
                onChange={(e) => setMasjidName(e.target.value)}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter masjid name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              
              {/* Current Logo Preview */}
              {logoUrl && (
                <div className="mb-4">
                  <img 
                    src={logoUrl} 
                    alt="Current Logo" 
                    className="h-20 w-20 rounded-lg object-cover border border-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">Current logo</p>
                </div>
              )}
              
              {/* File Upload */}
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                
                {selectedFile && (
                  <div className="text-sm text-gray-600">
                    Selected: {selectedFile.name}
                  </div>
                )}
                
                {uploadError && (
                  <div className="text-sm text-red-600">
                    {uploadError}
                  </div>
                )}
                
                {uploading && (
                  <div className="text-sm text-emerald-600">
                    Uploading logo...
                  </div>
                )}
              </div>
              
              {/* Optional: Manual URL field */}
              <div className="mt-4">
                <label className="block text-xs text-gray-500 mb-1">Or enter logo URL manually:</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter tagline"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="Enter masjid address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
                <option value="si">සිංහල</option>
              </select>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-colors text-base"
              >
                Save Settings
              </button>
            </div>

            {/* Delete Account Section - Super Admin Only */}
            {tenantContext?.role === 'super_admin' && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Permanently delete your account and all masjid data. This action cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Account</h3>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                This action will soft-delete your account and masjid. Your data will be retained for 3 months and can be restored by contacting support.
              </p>

              {tenantContext?.role === 'super_admin' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-900 mb-1">
                        ⚠️ SOFT DELETE - 3 MONTH GRACE PERIOD
                      </p>
                      <p className="text-sm text-amber-800">
                        Only the oldest super admin can delete the account. This will:
                      </p>
                      <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                        <li>Mark your account and masjid as deleted</li>
                        <li>Prevent access to all masjid data</li>
                        <li>Retain data for 3 months for restoration</li>
                        <li>Contact support to restore within 3 months</li>
                        <li>Data permanently deleted after 3 months</li>
                      </ul>
                      <p className="text-sm text-amber-800 mt-2 font-semibold">
                        Note: Only the oldest super admin can initiate deletion.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">DELETE MY ACCOUNT</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="DELETE MY ACCOUNT"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation("");
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmation !== "DELETE MY ACCOUNT"}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

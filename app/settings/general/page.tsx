"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { translations, Language } from "@/lib/i18n/translations";

export const dynamic = 'force-dynamic';

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, tenantContext } = useSupabaseAuth();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  // Login redirect effect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Return null if redirecting
  if (!authLoading && !user) return null;

  // Page-level access control (after all hooks)
  if (authLoading) return <div>Loading...</div>;
  if (!tenantContext?.permissions?.settings && tenantContext?.role !== 'super_admin') {
    return <div>No access</div>;
  }

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

  useEffect(() => {
    const savedLang = localStorage.getItem("preferred_language") as Language;
    if (savedLang) setLang(savedLang);
    fetchMasjidSettings();
  }, []);

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
        setAddress(""); // Not confirmed in DB
        setPhone(""); // Not confirmed in DB
        setEmail(""); // Not confirmed in DB
      }
    } catch (e: any) {
      console.error("Failed to load masjid settings:", e);
    } finally {
      setLoading(false);
    }
  };

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
      localStorage.setItem("preferred_language", preferredLanguage);
      
      // Show success message
      alert("Settings saved successfully!");
      
      // Reset file selection
      setSelectedFile(null);
      
    } catch (e: any) {
      console.error("Failed to save settings:", e);
      alert("Failed to save settings");
    }
  };

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
          </div>
        </div>
      </div>
    </div>
  );
}

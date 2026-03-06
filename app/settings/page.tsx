"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Globe, Camera, Tag, Home, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useAppToast();
  const [lang, setLang] = useState<Language>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const t = translations[lang];

  useEffect(() => {
    async function loadSettings() {
      if (!supabase) return;
      
      const ctx = await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      // Load language from localStorage
      const savedLang = localStorage.getItem("app_lang") as Language;
      if (savedLang) setLang(savedLang);

      // Load masjid profile
      try {
        const { data, error } = await supabase
          .from("masjids")
          .select("id, masjid_name, tagline, logo_url")
          .eq("id", ctx.masjidId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setName((data as any).masjid_name || "");
          setTagline((data as any).tagline || "");
          setLogoUrl((data as any).logo_url || "");
        }
      } catch (e: any) {
        // If table exists but schema cache is stale or columns don't exist, keep defaults.
        // The user should run the Supabase SQL migration to add the required columns.
        const msg = e?.message || "";
        if (msg.includes("schema cache") || msg.includes("column") || msg.includes("Could not find")) {
          // ignore - allow settings screen to render
        } else {
          throw e;
        }
      }
      setLoading(false);
    }
    loadSettings();
  }, [router]);

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("app_lang", newLang);
    // Force a re-render or just let the state handle it locally
    router.refresh(); 
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, we'll convert to Base64 to show a preview
    // In a real app, you'd upload this to Supabase Storage
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);

    const ctx = await getTenantContext();
    if (!ctx) {
      setSaving(false);
      return;
    }

    try {
      // Save profile
      const { error } = await supabase
        .from("masjids")
        .upsert({
          id: ctx.masjidId,
          masjid_name: name,
          tagline,
          logo_url: logoUrl
        });

      if (error) {
        const msg = error.message || "";
        if (msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("column")) {
          throw new Error(
            "Supabase schema cache error. Please run this once in Supabase SQL Editor: NOTIFY pgrst, 'reload schema'; and verify Vercel is using the same Supabase project URL where you ran the migration."
          );
        }
        if (msg.includes("logo_url")) {
          throw new Error("உங்கள் டேட்டாபேஸில் 'logo_url' என்ற காலம் (Column) இல்லை. தயவுசெய்து நான் கொடுத்த SQL குறியீட்டை Supabase-இல் இயக்கவும்.");
        }
        if (msg.includes("name")) {
          throw new Error(
            "உங்கள் Supabase-ல் 'masjids.name' column கிடைக்கவில்லை / schema cache update ஆகவில்லை. SQL Editor-ல் NOTIFY pgrst, 'reload schema'; run பண்ணி, Vercel-ல் சரியான Supabase URL set பண்ணியிருக்கீங்களா check பண்ணுங்க."
          );
        }
        throw error;
      }

      toast({
        kind: "success",
        title: "Saved",
        message: lang === "tm" ? "சேமிக்கப்பட்டது" : lang === "si" ? "සුරකින ලදී" : "Saved successfully",
      });
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center p-6">
        <div className="app-card p-6 w-full max-w-md text-center">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-600">Loading</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans pb-10">
      <header className="bg-white px-4 py-4 border-b border-neutral-200 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/" className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-emerald-600" />
        </Link>
        <h1 className="text-xl font-black">{t.settings}</h1>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        {/* Language Selection - Instant Change */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-black text-neutral-600 uppercase tracking-widest">{t.language}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["en", "tm", "si"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLangChange(l)}
                className={`py-3 rounded-3xl font-bold transition-all ${
                  lang === l 
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.02]" 
                    : "bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-50"
                }`}
              >
                {l === "en" ? "English" : l === "tm" ? "தமிழ்" : "සිංහල"}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-center text-neutral-600 font-bold uppercase tracking-wider">
            {lang === "en" ? "Language changes immediately" : lang === "tm" ? "மொழி உடனடியாக மாறும்" : "භාෂාව වහාම වෙනස් වේ"}
          </p>
        </section>

        {/* Profile Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-black text-neutral-600 uppercase tracking-widest">{t.profile}</h2>
          </div>
          
          <div className="app-card p-6 space-y-6">
            <div className="app-field">
              <label className="app-label">{t.name}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="app-input font-bold"
                placeholder="Masjid Name"
              />
            </div>

            <div className="app-field">
              <label className="app-label">{t.tagline}</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="app-input font-bold"
                placeholder="Tagline / Motto"
              />
            </div>

            <div className="app-field">
              <label className="app-label">{t.logo_url}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="app-input font-bold text-xs"
                  placeholder="https://image-url.com"
                />

                <label className="w-14 h-14 bg-emerald-50 rounded-3xl flex items-center justify-center overflow-hidden border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors shrink-0">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload}
                  />
                  {logoUrl ? (
                    <img src={logoUrl} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <Camera className="w-6 h-6 text-emerald-500" />
                  )}
                </label>
              </div>
              <p className="text-[9px] text-neutral-600 font-bold ml-1 italic uppercase tracking-tighter">
                Click camera to open camera or upload file
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full app-btn-primary py-5 text-lg flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? (lang === "en" ? "SAVING..." : lang === "tm" ? "சேமிக்கப்படுகிறது..." : "සුරකිමින් පවතී...") : t.save}
        </button>
      </main>
    </div>
  );
}

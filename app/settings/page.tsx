"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Globe, Camera, Tag, Home, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";

export default function SettingsPage() {
  const router = useRouter();
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
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Load language from localStorage
      const savedLang = localStorage.getItem("app_lang") as Language;
      if (savedLang) setLang(savedLang);

      // Load masjid profile
      const { data, error } = await supabase
        .from("masjids")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setName(data.name || "");
        setTagline(data.tagline || "");
        setLogoUrl(data.logo_url || "");
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Save profile
      const { error } = await supabase
        .from("masjids")
        .upsert({
          id: session.user.id,
          name,
          tagline,
          logo_url: logoUrl
        });

      if (error) {
        if (error.message.includes("logo_url")) {
          throw new Error("உங்கள் டேட்டாபேஸில் 'logo_url' என்ற காலம் (Column) இல்லை. தயவுசெய்து நான் கொடுத்த SQL குறியீட்டை Supabase-இல் இயக்கவும்.");
        }
        throw error;
      }
      
      alert(lang === "en" ? "Profile saved!" : lang === "tm" ? "விபரங்கள் சேமிக்கப்பட்டன!" : "විස්තර සුරකින ලදී!");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans pb-10">
      <header className="bg-white px-4 py-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-emerald-600" />
        </Link>
        <h1 className="text-xl font-black">{t.settings}</h1>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        {/* Language Selection - Instant Change */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">{t.language}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["en", "tm", "si"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLangChange(l)}
                className={`py-3 rounded-2xl font-bold transition-all ${
                  lang === l 
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-[1.02]" 
                    : "bg-white border border-slate-100 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {l === "en" ? "English" : l === "tm" ? "தமிழ்" : "සිංහල"}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">
            {lang === "en" ? "Language changes immediately" : lang === "tm" ? "மொழி உடனடியாக மாறும்" : "භාෂාව වහාම වෙනස් වේ"}
          </p>
        </section>

        {/* Profile Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">{t.profile}</h2>
          </div>
          
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.name}</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-500/10 transition-all font-bold"
                placeholder="Masjid Name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.tagline}</label>
              <input 
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-500/10 transition-all font-bold"
                placeholder="Tagline / Motto"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.logo_url}</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-500/10 transition-all font-bold text-xs"
                  placeholder="https://image-url.com"
                />
                
                <label className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center overflow-hidden border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors shrink-0">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
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
              <p className="text-[9px] text-slate-400 font-bold ml-1 italic uppercase tracking-tighter">
                Click camera to open camera or upload file
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-500 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? (lang === "en" ? "SAVING..." : lang === "tm" ? "சேமிக்கப்படுகிறது..." : "සුරකිමින් පවතී...") : t.save}
        </button>
      </main>
    </div>
  );
}

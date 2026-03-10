"use client";

import React, { useState } from 'react'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; 

export default function MasjidRegisterPage() { 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [masjidName, setMasjidName] = useState('');
  const [tagline, setTagline] = useState('');
  const [loading, setLoading] = useState(false); 
  const [step, setStep] = useState(1); // 1: form, 2: success
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    
    console.log('DEBUG: Starting masjid registration for:', email);
    
    if (!supabase) {
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up the user in Supabase Auth
      console.log('DEBUG: Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password, 
      }); 

      console.log('DEBUG: Auth result:', { 
        hasUser: !!authData.user, 
        userId: authData.user?.id,
        error: authError?.message 
      });

      if (authError) { 
        alert("பதிவு தோல்வி: " + authError.message); 
        setLoading(false);
        return;
      }

      if (authData.user && supabase) {
        console.log('DEBUG: Creating masjid profile...');
        
        // 2. Create the masjid profile in the 'masjids' table
        const { data: masjidData, error: profileError } = await supabase
          .from('masjids')
          .insert([
            { 
              masjid_name: masjidName, 
              tagline: tagline,
              created_by: authData.user.id
            }
          ])
          .select('id')
          .single();

        console.log('DEBUG: Masjid creation result:', { 
          data: masjidData, 
          error: profileError?.message 
        });

        if (profileError) { 
          alert("மஸ்ஜித் உருவாக்கம் தோல்வி: " + profileError.message); 
          setLoading(false);
          return;
        }

        if (masjidData?.id) {
          console.log('DEBUG: Creating super admin role...');
          
          // 3. Create super admin role for the user
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([
              {
                masjid_id: masjidData.id,
                user_id: authData.user.id,
                auth_user_id: authData.user.id,
                email: email,
                role: 'super_admin',
                permissions: {
                  accounts: true,
                  events: true,
                  members: true,
                  subscriptions_collect: true,
                  subscriptions_approve: true,
                  staff_management: true,
                  reports: true,
                  settings: true
                }
              }
            ]);

          console.log('DEBUG: Role creation result:', { error: roleError?.message });

          if (roleError) {
            alert("பங்கு உருவாக்கம் தோல்வி: " + roleError.message);
            setLoading(false);
            return;
          }

          console.log('DEBUG: Registration successful!');
          
          // 4. Show success message
          setStep(2);
          setLoading(false);
        }
      }
    } catch (error: any) {
      console.error('DEBUG: Registration error:', error);
      alert("பதிவு பிழை: " + error.message);
      setLoading(false);
    }
  }; 

  return ( 
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center p-6 font-sans"> 
      <div className="max-w-md mx-auto w-full bg-white rounded-[2.5rem] shadow-2xl p-8 border border-emerald-50"> 
        <div className="text-center mb-10"> 
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"> 
            <span className="text-5xl">🕌</span> 
          </div> 
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Smart Masjeedh</h1> 
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
            புதிய மஸ்ஜித் பதிவு
          </p> 
        </div> 

        {step === 1 && (
          <form onSubmit={handleRegister} className="space-y-6"> 
            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">மஸ்ஜித் பெயர்</label> 
              <input 
                type="text" 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
                placeholder="மஸ்ஜித் பெயர்" 
                value={masjidName}
                onChange={(e) => setMasjidName(e.target.value)}
                required 
              /> 
            </div>

            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">டேக்லைன்</label> 
              <input 
                type="text" 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
                placeholder="மஸ்ஜித் டேக்லைன்" 
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              /> 
            </div>

            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">மின்னஞ்சல் முகவரி</label> 
              <input 
                type="email" 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
                placeholder="admin@masjid.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              /> 
            </div> 

            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">கடவுச்சொல்</label> 
              <input 
                type="password" 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              /> 
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            > 
              {loading ? "பதிவு செய்கிறது..." : "மஸ்ஜித் பதிவு செய்ய"} 
            </button> 
          </form>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">பதிவு வெற்றி!</h2>
              <p className="text-slate-600 mb-4">
                உங்கள் மஸ்ஜித் &quot;{masjidName}&quot; வெற்றிகரமாக உருவாக்கப்பட்டது
              </p>
              <p className="text-slate-500 text-sm">
                தயவுசெய்து உங்கள் மின்னஞ்சலை சரிபார்க்கவும். உறுதிப்படுத்தல் இணைப்பு அனுப்பப்பட்டுள்ளது.
              </p>
            </div>
            <button 
              onClick={() => router.push('/login')}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold hover:bg-emerald-700 transition-colors"
            >
              உள்நுழைய செல்ல
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/login" className="text-emerald-600 hover:text-emerald-700 text-sm font-bold">
            ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைய
          </Link>
        </div>
      </div> 
    </div> 
  ); 
}

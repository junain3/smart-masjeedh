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
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    
    if (!supabase) {
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    if (!supabase) return;

    // 1. Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password, 
    }); 

    if (authError) { 
      alert("பதிவு தோல்வி: " + authError.message); 
      setLoading(false);
      return;
    }

    if (authData.user && supabase) {
      // 2. Create the masjid profile in the 'masjids' table
      const { error: profileError } = await supabase
        .from('masjids')
        .insert([
          { 
            id: authData.user.id, 
            name: masjidName, 
            tagline: tagline 
          }
        ]);

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // We don't alert here as the user is already created, 
        // they can update profile later
      }

      alert("பதிவு வெற்றி! இப்போது நீங்கள் உள்நுழையலாம்.");
      router.push('/login'); 
    }
    
    setLoading(false); 
  }; 

  return ( 
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center p-6 font-sans"> 
      <div className="max-w-md mx-auto w-full bg-white rounded-[2.5rem] shadow-2xl p-8 border border-emerald-50"> 
        <div className="text-center mb-8"> 
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4"> 
            <span className="text-4xl">🕌</span> 
          </div> 
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Account</h1> 
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Masjid Registration</p> 
        </div> 
 
        <form onSubmit={handleRegister} className="space-y-4"> 
          <div className="space-y-1.5"> 
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Masjid Name</label> 
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
              placeholder="E.g. Mubeen Jummah Masjid" 
              value={masjidName} 
              onChange={(e) => setMasjidName(e.target.value)} 
              required 
            /> 
          </div>

          <div className="space-y-1.5"> 
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tagline / Motto</label> 
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
              placeholder="E.g. Peace and Guidance" 
              value={tagline} 
              onChange={(e) => setTagline(e.target.value)} 
            /> 
          </div>
 
          <div className="space-y-1.5"> 
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Admin Email</label> 
            <input 
              type="email" 
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
              placeholder="admin@masjid.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            /> 
          </div> 
 
          <div className="space-y-1.5"> 
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label> 
            <input 
              type="password" 
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            /> 
          </div> 
 
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50 mt-4" 
          > 
            {loading ? 'CREATING ACCOUNT...' : 'REGISTER MASJID'} 
          </button> 
        </form> 
 
        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest"> 
            Already have an account?
          </p>
          <Link href="/login" className="text-emerald-500 font-black text-sm mt-2 block hover:underline"> 
            LOGIN HERE 
          </Link> 
        </div>
      </div> 
    </div> 
  ); 
}

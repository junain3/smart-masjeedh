"use client";

import React, { useState } from 'react'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; 

export default function MasjidLoginPage() { 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    
    console.log('DEBUG before signIn', { file: 'app/login/page.tsx' });
    
    if (!supabase) {
      console.error('DEBUG: Supabase connection not found');
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    if (!supabase) return;

    try {
      // Add 15s timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login timeout after 15s')), 15000);
      });

      const signInPromise = supabase.auth.signInWithPassword({ 
        email, 
        password, 
      });

      const { data, error } = await Promise.race([signInPromise, timeoutPromise]) as any;
      
      console.log('DEBUG after signIn result', { data, error });
      console.error('DEBUG signIn error', error);

      // After signIn, also call and log session and user
      const sessionRes = await supabase.auth.getSession();
      console.log('DEBUG getSession', sessionRes);
      
      const userRes = await supabase.auth.getUser();
      console.log('DEBUG getUser', userRes);

      if (error) { 
        console.error('DEBUG: Login failed', error);
        alert("லாகின் தோல்வி: " + error.message); 
      } else { 
        console.log('DEBUG: Login successful, checking role...');
        
        // Only redirect if session exists
        if (sessionRes.data.session) {
          // லாகின் வெற்றி - role check செய்து redirect
          const { data: userRole } = await supabase
            .from("user_roles")
            .select("role, permissions")
            .eq("user_id", data.user?.id)
            .single();
          
          if (userRole) {
            const role = userRole.role;
            const permissions = userRole.permissions as any || {};
            
            // Staff users with only collection permissions
            if (role === "staff" && !permissions.accounts && !permissions.events && !permissions.members && permissions.subscriptions_collect) {
              console.log('DEBUG: Redirecting staff user to /collections');
              router.push('/collections');
            } else {
              console.log('DEBUG: Redirecting admin user to dashboard');
              router.push('/'); // Admin users go to dashboard
            }
          } else {
            console.log('DEBUG: No user role found, redirecting to dashboard');
            router.push('/'); // Default to dashboard
          }
        } else {
          console.error('DEBUG: No session found after login');
          alert("Login successful but no session created. Please try again.");
        }
      } 
    } catch (err) {
      console.error('DEBUG: Login exception', err);
      alert("Login error: " + (err as Error).message);
    }
    
    setLoading(false); 
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
            Multi‑tenant Masjid Management
          </p> 
        </div> 
 
        <form onSubmit={handleLogin} className="space-y-6"> 
          <div className="space-y-2"> 
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Address</label> 
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
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label> 
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
            className="w-full app-btn-primary py-5 mt-4 text-lg" 
          > 
            {loading ? 'LOGGING IN...' : 'LOGIN NOW'} 
          </button> 
        </form> 
 
        <div className="mt-10 pt-8 border-t border-slate-50 space-y-3 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest"> 
            New to Smart Masjeedh?
          </p>
          <Link 
            href="/register" 
            className="inline-flex items-center justify-center w-full app-btn-soft py-4 text-emerald-700"
          > 
            Register your Masjid 
          </Link> 
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
            Your Masjid space will be created and awaits Super‑Admin approval.
          </p>
        </div>
      </div> 
    </div> 
  ); 
}

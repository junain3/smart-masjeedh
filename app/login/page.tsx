"use client";

import React, { useState } from 'react'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; 
import { useMinimalAuth } from '@/components/MinimalAuthProvider';

export default function MasjidLoginPage() { 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const router = useRouter();
  const { user } = useMinimalAuth();

  // If user is already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      console.log('DEBUG: User already logged in, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    
    console.log('DEBUG: Login attempt started');
    
    if (!supabase) {
      console.error('DEBUG: Supabase connection not found');
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    console.log('DEBUG: Supabase client exists');

    try {
      console.log('DEBUG: Attempting signInWithPassword');
      
      // Add 10 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login timeout after 10 seconds')), 10000);
      });
      
      const signInPromise = supabase.auth.signInWithPassword({ 
        email, 
        password, 
      });
      
      const { data, error } = await Promise.race([signInPromise, timeoutPromise]) as any;
      
      console.log('DEBUG: signIn result', { data: !!data, error: !!error, errorMessage: error?.message });

      if (error) { 
        console.error('DEBUG: Login failed', error);
        alert("லாகின் தோல்வி: " + error.message); 
      } else { 
        console.log('DEBUG: Login successful, checking session');
        
        // Simple redirect to dashboard
        console.log('DEBUG: Redirecting to dashboard');
        router.push('/'); 
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
            href="/signup" 
            className="inline-flex items-center justify-center w-full app-btn-soft py-4 text-emerald-700"
          > 
            Register your Masjid 
          </Link> 
          
          <div className="pt-4 border-t border-slate-50">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
              Quick Login Options
            </p>
            <div className="space-y-2">
              <Link 
                href="/easy-login" 
                className="inline-flex items-center justify-center w-full app-btn-soft py-3 text-blue-700"
              > 
                📧 Login with Email Code
              </Link> 
            </div>
          </div>
          
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
            Your Masjid space will be created and awaits Super‑Admin approval.
          </p>
        </div>
      </div> 
    </div> 
  ); 
}

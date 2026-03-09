// Debug Login - Replace login/page.tsx with this temporarily

"use client";

import React, { useState } from 'react'; 
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; 

export default function MasjidLoginPage() { 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const [debug, setDebug] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    setDebug('Starting login...');
    
    // Debug supabase connection
    if (!supabase) {
      setDebug('ERROR: Supabase connection not found');
      setLoading(false);
      return;
    }
    
    setDebug('Supabase connected, attempting login...');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password, 
      }); 

      setDebug(`Login result: ${JSON.stringify({error, data: data?.user?.email})}`);

      if (error) { 
        setDebug(`ERROR: ${error.message}`);
        alert("லாகின் தோல்வி: " + error.message); 
      } else { 
        setDebug('Login successful, checking role...');
        
        // Simple redirect first
        router.push('/'); 
      } 
    } catch (err) {
      setDebug(`CATCH ERROR: ${err}`);
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

        {/* Debug Info */}
        {debug && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-xs text-red-600 font-mono break-all">
              DEBUG: {debug}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6"> 
          <div> 
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2"> 
              Email 
            </label> 
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" 
              placeholder="your@email.com" 
              required 
            /> 
          </div> 

          <div> 
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2"> 
              Password 
            </label> 
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" 
              placeholder="••••••••" 
              required 
            /> 
          </div> 

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50" 
          > 
            {loading ? 'Loading...' : 'Sign In'} 
          </button> 
        </form> 
      </div> 
    </div> 
  );
}

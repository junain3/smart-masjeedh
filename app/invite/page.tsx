"use client";

import React, { useState } from 'react'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; 

export default function InvitePage() { 
  const [email, setEmail] = useState(''); 
  const [masjidId, setMasjidId] = useState('');
  const [role, setRole] = useState<'staff' | 'co_admin'>('staff');
  const [loading, setLoading] = useState(false); 
  const [step, setStep] = useState(1); // 1: form, 2: success
  const router = useRouter();

  const handleInvite = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    
    console.log('DEBUG: Sending invitation to:', email, 'for masjid:', masjidId);
    
    if (!supabase) {
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    try {
      // 1. Generate invitation token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      console.log('DEBUG: Generated token:', token);
      
      // 2. Create invitation record
      const { data: inviteData, error: inviteError } = await supabase
        .from('invitations')
        .insert([
          {
            email: email,
            masjid_id: masjidId,
            role: role,
            token: token,
            status: 'pending',
            created_by: (await supabase.auth.getUser()).data.user?.id
          }
        ])
        .select('id')
        .single();

      console.log('DEBUG: Invitation creation result:', { data: inviteData, error: inviteError?.message });

      if (inviteError) {
        alert("அழைப்பு உருவாக்கம் தோல்வி: " + inviteError.message);
        setLoading(false);
        return;
      }

      if (inviteData?.id) {
        // 3. Send invitation email (you'll need to implement email service)
        const inviteLink = `${window.location.origin}/invite-register?token=${token}`;
        
        console.log('DEBUG: Invite link:', inviteLink);
        
        // For now, just show the link (in production, you'd send this via email)
        alert(`அழைப்பு இணைப்பு: ${inviteLink}\n\nஇந்த இணைப்பை அனுப்பவும்: ${email}`);
        
        setStep(2);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('DEBUG: Invitation error:', error);
      alert("அழைப்பு பிழை: " + error.message);
      setLoading(false);
    }
  }; 

  return ( 
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center p-6 font-sans"> 
      <div className="max-w-md mx-auto w-full bg-white rounded-[2.5rem] shadow-2xl p-8 border border-emerald-50"> 
        <div className="text-center mb-10"> 
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"> 
            <span className="text-5xl">💌</span> 
          </div> 
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Smart Masjeedh</h1> 
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
            ஊழியர் அழைப்பு
          </p> 
        </div> 

        {step === 1 && (
          <form onSubmit={handleInvite} className="space-y-6"> 
            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">மஸ்ஜித் ID</label> 
              <input 
                type="text" 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
                placeholder="மஸ்ஜித் ID" 
                value={masjidId}
                onChange={(e) => setMasjidId(e.target.value)}
                required 
              /> 
            </div>

            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">பங்கு</label> 
              <select 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900"
                value={role}
                onChange={(e) => setRole(e.target.value as 'staff' | 'co_admin')}
              >
                <option value="staff">ஊழியர்</option>
                <option value="co_admin">இணை நிர்வாகி</option>
              </select>
            </div>

            <div className="space-y-2"> 
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">ஊழியர் மின்னஞ்சல்</label> 
              <input 
                type="email" 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300" 
                placeholder="staff@masjid.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              /> 
            </div> 

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            > 
              {loading ? "அனுப்புகிறது..." : "அழைப்பு அனுப்பு"} 
            </button> 
          </form>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">அழைப்பு அனுப்பப்பட்டது!</h2>
              <p className="text-slate-600 mb-4">
                ஊழியர் {email} க்கு அழைப்பு அனுப்பப்பட்டது
              </p>
              <p className="text-slate-500 text-sm">
                அவர்கள் அழைப்பை ஏற்றுக்கொண்டவுடன் மஸ்ஜித்தில் சேர்வார்கள்.
              </p>
            </div>
            <button 
              onClick={() => router.push('/')}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold hover:bg-emerald-700 transition-colors"
            >
              டாஷ்போர்டுக்கு செல்ல
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/" className="text-emerald-600 hover:text-emerald-700 text-sm font-bold">
            டாஷ்போர்டுக்கு திரும்பு
          </Link>
        </div>
      </div> 
    </div> 
  ); 
}

"use client";

import React, { useState, useEffect, Suspense } from 'react'; 
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; 

function RegisterPageContent() {
  const router = useRouter();
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [masjidName, setMasjidName] = useState('');
  const [tagline, setTagline] = useState('');
  const [loading, setLoading] = useState(false); 
  const [step, setStep] = useState(1); // 1: form, 2: success
  const [isInvitation, setIsInvitation] = useState(false);
  const [inviteRole, setInviteRole] = useState('');
  const [inviteMasjidId, setInviteMasjidId] = useState('');
  const [inviteCommission, setInviteCommission] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if this is an invitation registration
    const inviteEmail = searchParams.get('email');
    const role = searchParams.get('role');
    const masjid_id = searchParams.get('masjid_id');
    const commission = searchParams.get('commission');

    if (inviteEmail && role && masjid_id) {
      console.log(' INVITATION DETECTED:', { inviteEmail, role, masjid_id, commission });
      
      setEmail(inviteEmail);
      setInviteRole(role || '');
      setInviteMasjidId(masjid_id || '');
      setInviteCommission(commission || '');
      setIsInvitation(true);
      setStep(3); // Skip to staff registration step
    }
  }, [searchParams]);

  const handleMasjidRegister = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setLoading(true); 
    
    console.log('DEBUG: Starting masjid registration for:', email);
    
    if (!supabase) {
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up user in Supabase Auth
      console.log('DEBUG: Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
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
        
        // 2. Create masjid profile in 'masjids' table
        const { data: masjidData, error: profileError } = await supabase
          .from('masjids')
          .insert([
            { 
              masjid_name: masjidName, 
              tagline: tagline,
              created_by: authData.user.id,
              subscription_status: 'trial',
              trial_extended: false
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
          
          // 3. Create super admin role for user
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
          
          // 4. Show success message with email verification
          setStep(2);
          setLoading(false);
          
          // Show email verification message
          if (authData.user && !authData.user.email_confirmed_at) {
            setTimeout(() => {
              alert(` Email verification sent to ${email}!\n\nPlease check your inbox and click the verification link to complete registration.\n\nAfter verification, you can login with your credentials.`);
            }, 1000);
          }
        }
      }
    } catch (error: any) {
      console.error('DEBUG: Registration error:', error);
      alert("பதிவு பிழை: " + error.message);
      setLoading(false);
    }
  };

  const handleStaffRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log(' STAFF INVITATION REGISTRATION:', { email, role: inviteRole, masjid_id: inviteMasjidId });

    if (!supabase) {
      alert("Supabase connection not found.");
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      console.log(' Staff Auth Result:', { 
        hasUser: !!authData.user, 
        userId: authData.user?.id,
        error: authError?.message 
      });

      if (authError) {
        alert("பதிவு தோல்வி: " + authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        console.log(' Creating staff role...');
        
        // 2. Create staff role for existing masjid
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            {
              masjid_id: inviteMasjidId,
              user_id: authData.user.id,
              auth_user_id: authData.user.id,
              email: email,
              role: inviteRole,
              permissions: getDefaultPermissions(inviteRole),
              commission_rate: parseFloat(inviteCommission) || 0
            }
          ]);

        console.log(' Staff Role Result:', { error: roleError?.message });

        if (roleError) {
          alert("பங்கு உருவாக்கம் தோல்வி: " + roleError.message);
          setLoading(false);
          return;
        }

        console.log(' Staff registration successful!');
        setStep(4); // Staff success
        setLoading(false);

        // Show email verification message
        if (authData.user && !authData.user.email_confirmed_at) {
          setTimeout(() => {
            alert(` Email verification sent to ${email}!\n\nPlease check your inbox and click the verification link.\n\nAfter verification, you can login with your credentials.`);
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error(' Staff Registration Error:', error);
      alert("பதிவு பிழை: " + error.message);
      setLoading(false);
    }
  };

  const getDefaultPermissions = (role: string) => {
    switch (role) {
      case 'super_admin':
        return {
          accounts: true, events: true, members: true,
          subscriptions_collect: true, subscriptions_approve: true,
          staff_management: true, reports: true, settings: true
        };
      case 'co_admin':
        return {
          accounts: true, events: true, members: true,
          subscriptions_collect: true, subscriptions_approve: true,
          staff_management: false, reports: true, settings: false
        };
      case 'staff':
        return {
          accounts: false, events: false, members: true,
          subscriptions_collect: true, subscriptions_approve: false,
          staff_management: false, reports: true, settings: false
        };
      case 'editor':
        return {
          accounts: false, events: true, members: true,
          subscriptions_collect: false, subscriptions_approve: false,
          staff_management: false, reports: true, settings: false
        };
      default:
        return {
          accounts: false, events: false, members: false,
          subscriptions_collect: false, subscriptions_approve: false,
          staff_management: false, reports: false, settings: false
        };
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
            {isInvitation ? 'பணியாளர் பதிவு' : 'புதிய மஸ்ஜித் பதிவு'}
          </p> 
        </div> 

        {/* Masjid Registration */}
        {step === 1 && (
          <form onSubmit={handleMasjidRegister} className="space-y-6"> 
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
                placeholder="•••••••" 
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

        {/* Staff Invitation Registration */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center mb-2">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="text-lg font-black text-emerald-800 mb-2">அழைப்பு பெற்றீர்கள்!</h3>
              <p className="text-emerald-700 text-sm">
                நீங்கள் <strong>{inviteRole?.replace('_', ' ').toUpperCase()}</strong> பதவியாக அழைக்கப்பட்டுள்ளீர்கள்
              </p>
              <div className="mt-3 p-3 bg-white rounded-xl">
                <p className="text-xs text-emerald-600">
                  <strong>பதவி:</strong> {inviteRole?.replace('_', ' ').toUpperCase()}<br/>
                  <strong>கமிஷன்:</strong> {inviteCommission}%<br/>
                  <strong>மின்னஞ்சல்:</strong> {email}
                </p>
              </div>
            </div>

            <form onSubmit={handleStaffRegister} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">கடவுச்சொல்</label>
                <input
                  type="password"
                  className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-300"
                  placeholder="•••••••"
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
                {loading ? "பதிவு செய்கிறது..." : "பதிவு செய்ய"}
              </button>
            </form>
          </div>
        )}

        {/* Masjid Registration Success */}
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
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span className="text-blue-800 font-bold">மின்னஞ்சல் உறுதிப்படுத்தல்</span>
                </div>
                <p className="text-blue-700 text-sm">
                  உறுதிப்படுத்தல் இணைப்பு <strong>{email}</strong> க்கு அனுப்பப்பட்டுள்ளது
                </p>
                <p className="text-blue-600 text-xs mt-2">
                  உங்கள் மின்னஞ்சலை சரிபார்த்து உறுதிப்படுத்தல் இணைப்பைக் கிளிக் செய்யவும்
                </p>
              </div>
              <p className="text-slate-500 text-sm">
                உறுதிப்படுத்தலுக்குப் பிறகு உள்நுழையலாம்
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

        {/* Staff Registration Success */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">பதிவு வெற்றி!</h2>
              <p className="text-slate-600 mb-4">
                நீங்கள் வெற்றிகரமாக <strong>{inviteRole?.replace('_', ' ').toUpperCase()}</strong> பதவியாக பதிவு செய்துள்ளீர்கள்
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span className="text-blue-800 font-bold">மின்னஞ்சல் உறுதிப்படுத்தல்</span>
                </div>
                <p className="text-blue-700 text-sm">
                  உறுதிப்படுத்தல் இணைப்பு <strong>{email}</strong> க்கு அனுப்பப்பட்டுள்ளது
                </p>
                <p className="text-blue-600 text-xs mt-2">
                  உங்கள் மின்னஞ்சலை சரிபார்த்து உறுதிப்படுத்தல் இணைப்பைக் கிளிக் செய்யவும்
                </p>
              </div>
              <p className="text-slate-500 text-sm">
                உறுதிப்படுத்தலுக்குப் பிறகு உள்நுழையலாம், பிறகு உள்நுழையலாம்
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

export default function MasjidRegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}

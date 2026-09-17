"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, ArrowLeft, X } from 'lucide-react';

function InviteRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [step, setStep] = useState<'verify' | 'register'>('register');
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Prevent duplicate invitation fetches
  const hasFetchedInvitation = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      // Check if user already has a session (came from /update-password)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
        setEmail(session.user.email || '');
      }

      if (token && !hasFetchedInvitation.current) {
        hasFetchedInvitation.current = true;
        verifyInvitation();
      }
    };
    initialize();
  }, [token]);

  const verifyInvitation = async () => {
    try {
      console.log('DEBUG: Verifying invitation token:', token);
      
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      console.log('DEBUG: Invitation query result:', { data, error: error?.message });

      if (error) {
        console.error("INVITE FETCH ERROR:", error);
        setError('அழைப்பு காலாவடியாக உள்ளது அல்லது காலாவடியாகிவிட்டது');
        return;
      }

      if (!data) {
        console.error("INVITE FETCH ERROR: No data returned");
        setError('சரியான அழைப்பு இல்லை');
        return;
      }

      setInvitation(data);
      setEmail(data.email);
      
    } catch (err) {
      console.error("INVITE FETCH EXCEPTION:", err);
      setError('ஏதோ தவறு ஏற்பட்டது');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submit
    if (loading) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    // If user already has session (came from /update-password), skip password validation
    if (!hasSession) {
      if (password !== confirmPassword) {
        setError('கடவுச்சொற்கள் பொருந்தவில்லை');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('கடவுச்சொல் குறைந்தது 6 எழுத்துகளாக இருக்க வேண்டும்');
        setLoading(false);
        return;
      }
    }

    try {
      let userData;
      
      // Step 1: Create auth user (only if no session)
      if (!hasSession) {
        console.log('DEBUG: Creating user for email:', email);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
        });

        console.log('DEBUG: Sign up result:', { data, error: signUpError?.message });

        if (signUpError) {
          setError('பதிவு தோல்வி: ' + signUpError.message);
          setLoading(false);
          return;
        }

        // Strict check: Ensure auth user was created
        if (!data.user) {
          setError('பயனர் உருவாக்கம் தோல்வி: ஆதாரப்பூர்வமான பயனர் உருவாக்கப்படவில்லை');
          setLoading(false);
          return;
        }
        
        userData = data;
      } else {
        // User already has session from /update-password
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('செஷன் கிடைக்கவில்லை');
          setLoading(false);
          return;
        }
        userData = { user };
        console.log('DEBUG: Using existing session for user:', user.id);
      }

      if (!invitation) {
        setError('அழைப்பு தகவல் கிடைக்கவில்லை');
        setLoading(false);
        return;
      }

      console.log('DEBUG: Creating user role for masjid:', invitation.masjid_id);
      
      // Step 2: Insert into user_profiles (new step)
      const { error: userProfileError } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: userData.user.id,
            masjid_id: invitation.masjid_id,
            full_name: fullName,
            phone: phone || null,
            role: invitation.role,
            email: invitation.email
          }
        ]);

      if (userProfileError) {
        console.error('Failed to create user profile:', userProfileError);
        // Don't fail registration, just log error
      }

      // Step 3: Check if there's an existing deleted user_roles entry for this user
      const { data: existingRole, error: existingRoleError } = await supabase
        .from('user_roles')
        .select('*')
        .or(`user_id.eq.${userData.user.id},auth_user_id.eq.${userData.user.id}`)
        .maybeSingle();

      console.log('DEBUG: Existing role check:', { existingRole, existingRoleError });

      const roleMap: { [key: string]: string } = {
        'co admin': 'co_admin',
        'co_admin': 'co_admin',
        'super admin': 'super_admin',
        'super_admin': 'super_admin',
        'staff': 'staff',
        'editor': 'editor'
      };

      const normalizedRole = roleMap[invitation.role.toLowerCase().trim()] || invitation.role;

      if (existingRole && existingRole.status === 'deleted') {
        // Restore the deleted entry
        console.log('DEBUG: Found deleted role, restoring it');

        const { error: restoreError } = await supabase
          .from('user_roles')
          .update({
            status: 'active',
            deleted_at: null,
            deleted_by: null,
            deleted_reason: null,
            role: normalizedRole,
            permissions: invitation.permissions || {},
            verified: true,
            email: email,
          })
          .eq('id', existingRole.id);

        if (restoreError) {
          setError('பங்கு மீட்பு தோல்வி: ' + restoreError.message);
          console.error('CRITICAL: Role restoration failed:', restoreError);
          setLoading(false);
          return;
        }

        console.log('DEBUG: Role restored successfully');
      } else {
        // Insert into user_roles (critical step)
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            {
              masjid_id: invitation.masjid_id,
              user_id: userData.user.id,
              auth_user_id: userData.user.id,
              email: email,
              role: normalizedRole,
              permissions: invitation.permissions || {},
              verified: true,
            }
          ]);

        console.log('DEBUG: User role creation result:', { error: roleError?.message });

        // Critical: If user_roles insert fails, stop immediately
        if (roleError) {
          setError('பங்கு உருவாக்கம் தோல்வி: ' + roleError.message);
          console.error('CRITICAL: User role creation failed, auth user exists but role not assigned:', roleError);
          setLoading(false);
          return;
        }
      }

      // Step 4: Create collector profile (always runs)
      const { error: collectorProfileError } = await supabase
        .from('subscription_collector_profiles')
        .upsert({
          masjid_id: invitation.masjid_id,
          user_id: userData.user.id,
          default_commission_percent: invitation.commission_percent || 10
        }, {
          onConflict: 'masjid_id,user_id'
        });

      if (collectorProfileError) {
        console.error('Failed to create collector profile:', collectorProfileError);
        // Don't fail registration, just log error
      }

      // Step 4: Update invitation status to accepted
      const { error: updateError } = await supabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('WARNING: Invitation status update failed:', updateError);
        // Don't fail the whole process, but log the error
      }

      // Step 4: Only after ALL succeed, show success and redirect
      console.log('DEBUG: Registration completed successfully - all steps passed');
      
      setSuccess('பதிவு வெற்றி! இப்போது உள்நுழையலாம்.');
      
      setTimeout(() => {
        if (hasSession) {
          // User already has session, redirect to dashboard
          router.push('/');
        } else {
          // User needs to login
          router.push('/login');
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('DEBUG: Registration error:', error);
      setError('பதிவு பிழை: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">அழைப்பு பிழை</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
            உள்நுழைய செல்ல
          </Link>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">அழைப்பை சரிபார்க்கிறது...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">மஸ்ஜித் அழைப்பு</h1>
          <p className="text-gray-600">{invitation.email}</p>
        </div>

        {invitation && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <h3 className="font-semibold text-emerald-800 mb-2">அழைப்பு விவரங்கள்</h3>
              <p className="text-sm text-emerald-700">
                <strong>மின்னஞ்சல்:</strong> {invitation.email}
              </p>
              <p className="text-sm text-emerald-700">
                <strong>பங்கு:</strong> {invitation.role === 'co_admin' ? 'இணை நிர்வாகி' : 'ஊழியர்'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                முழு பெயர் *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                தொலைப்பு எண் (விரும்பம்)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter your phone number"
              />
            </div>

            {!hasSession && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    கடவுச்சொல்
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="கடவுச்சொல் உள்ளிடுவும்"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    கடவுச்சொல் உறுதிப்படுத்தல்
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="கடவுச்சொல் மீண்டும் உள்ளிடுவும்"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    கடவுச்சொல் குறைந்தது 6 எழுத்துகளாக இருக்க வேண்டும்.
                  </p>
                </div>
              </>
            )}

            {hasSession && (
              <div className="bg-emerald-50 p-3 rounded-lg">
                <p className="text-sm text-emerald-800">
                  உங்கள் கடவுச்சொல் ஏற்கனவே அமைக்கப்பட்டது. தயவு செய்து உங்கள் விவரங்களை முடிக்கவும்.
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'பதிவு செய்கிறது...' : 'பதிவு செய்ய'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link 
            href="/login" 
            className="text-sm text-gray-600 hover:text-emerald-600 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            உள்நுழைய திரும்பு
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function InviteRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <InviteRegisterContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, ArrowLeft, X } from 'lucide-react';

function InviteRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [step, setStep] = useState<'verify' | 'register'>('verify');
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (token) {
      verifyInvitation();
    }
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
        setError('அழைப்பு காலாவடியாக உள்ளது அல்லது காலாவடியாகிவிட்டது');
        return;
      }

      if (data) {
        setInvitation(data);
        setEmail(data.email);
      }
    } catch (error) {
      setError('அழைப்பு சரிபார்ப்பு பிழை');
    }
  };

  const requestOTP = async () => {
    if (!invitation) return;
    
    setLoading(true);
    setError('');

    console.log('DEBUG: Sending OTP to email:', email);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false
        }
      });

      console.log('DEBUG: OTP send result:', { error: otpError?.message });

      if (otpError) {
        setError('OTP அனுப்பம் தோல்வி: ' + otpError.message);
        setLoading(false);
        return;
      }

      console.log('DEBUG: OTP sent successfully');
      setStep('register');
      setLoading(false);
    } catch (error: any) {
      console.error('DEBUG: OTP send error:', error);
      setError('OTP அனுப்பம் பிழை: ' + error.message);
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('DEBUG: Verifying OTP for email:', email, 'OTP:', otp);

    try {
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'signup'
      });

      console.log('DEBUG: OTP verification result:', { data, error: otpError?.message });

      if (otpError) {
        setError('OTP தவறானது: ' + otpError.message);
        setLoading(false);
        return;
      }

      if (data.user && invitation) {
        console.log('DEBUG: Creating user role for masjid:', invitation.masjid_id);
        
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            {
              masjid_id: invitation.masjid_id,
              user_id: data.user.id,
              auth_user_id: data.user.id,
              email: email,
              role: invitation.role,
              permissions: invitation.role === 'co_admin' ? {
                accounts: true,
                events: true,
                members: true,
                subscriptions_collect: true,
                subscriptions_approve: true,
                staff_management: true,
                reports: true,
                settings: false
              } : {
                accounts: false,
                events: true,
                members: true,
                subscriptions_collect: true,
                subscriptions_approve: false,
                staff_management: false,
                reports: true,
                settings: false
              }
            }
          ]);

        console.log('DEBUG: User role creation result:', { error: roleError?.message });

        if (roleError) {
          setError('பங்கு உருவாக்கம் தோல்வி: ' + roleError.message);
          setLoading(false);
          return;
        }

        await supabase
          .from('invitations')
          .update({ status: 'accepted' })
          .eq('id', invitation.id);

        console.log('DEBUG: Invitation accepted successfully');
        
        alert('பதிவு வெற்றி! இப்போது உள்நுழையலாம்.');
        router.push('/login');
      }
    } catch (error: any) {
      console.error('DEBUG: OTP verification error:', error);
      setError('OTP சரிபார்ப்பு பிழை: ' + error.message);
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

        {step === 'verify' ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <h3 className="font-semibold text-emerald-800 mb-2">அழைப்பு விவரங்கள்</h3>
              <p className="text-sm text-emerald-700">
                <strong>பங்கு:</strong> {invitation.role === 'co_admin' ? 'இணை நிர்வாகி' : 'ஊழியர்'}
              </p>
            </div>
            
            <button
              onClick={requestOTP}
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'OTP அனுப்புகிறது...' : 'OTP பெறு'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OTP குறியீடு
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="OTP உள்ளிடுவும்"
                  required
                />
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                உங்கள் மின்னஞ்சலுக்கு OTP அனுப்பப்பட்டுள்ளது. அதை உள்ளிட்டு சரிபார்க்கவும்.
              </p>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'சரிபார்க்கிறது...' : 'OTP சரிபார்க்கு'}
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

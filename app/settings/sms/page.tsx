"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, Send, Clock, Check, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";

export const dynamic = 'force-dynamic';

// Define types
interface SmsSettings {
  id: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_provider_url: string;
  sms_updated_at: string;
}

interface SmsLog {
  id: string;
  masjid_id: string;
  phone_number: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  provider_response: string | null;
  created_at: string;
  updated_at: string;
}

export default function SmsSettingsPage() {
  const router = useRouter();
  const { user, tenantContext, loading: authLoading, requiresOnboarding } = useSupabaseAuth();

  const lastMasjidIdRef = useRef<string | null>(null);
  
  // Settings form state
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    sms_api_key: "",
    sms_sender_id: "",
    sms_provider_url: ""
  });
  
  // Send SMS form state
  const [sendingSms, setSendingSms] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  
  // Logs state
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Login and onboarding redirect effect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && requiresOnboarding) {
      router.push('/setup');
    }
  }, [authLoading, user, requiresOnboarding, router]);

  // Fetch SMS settings
  useEffect(() => {
    async function fetchSmsSettings() {
      if (!tenantContext?.masjidId) {
        return;
      }
      
      try {
        setSettingsError(null);
        const { data, error: fetchError } = await supabase
          .from('masjids')
          .select('id, sms_api_key, sms_sender_id, sms_provider_url, sms_updated_at')
          .eq('id', tenantContext.masjidId)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (data) {
          setFormData({
            sms_api_key: data.sms_api_key || "",
            sms_sender_id: data.sms_sender_id || "",
            sms_provider_url: data.sms_provider_url || ""
          });
        }
      } catch (err: any) {
        setSettingsError(err.message || "Failed to load SMS settings");
        console.error("Error fetching SMS settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    }
    
    const currentMasjidId = tenantContext?.masjidId;
    
    if (currentMasjidId) {
      if (currentMasjidId !== lastMasjidIdRef.current) {
        lastMasjidIdRef.current = currentMasjidId;
        setLoadingSettings(true);
        setSettingsError(null);
        fetchSmsSettings();
        fetchSmsLogs();
      } else {
        // If we already have the masjidId, just clear any lingering error
        setSettingsError(null);
        setLoadingSettings(false);
      }
    } else if (!authLoading && !tenantContext) {
      lastMasjidIdRef.current = null;
      setLoadingSettings(false);
      setSettingsError("Masjid context not found. Please set up your masjid first.");
    }
  }, [tenantContext?.masjidId, authLoading]);
  
  // Fetch SMS logs
  async function fetchSmsLogs() {
    if (!tenantContext?.masjidId) return;
    
    setLoadingLogs(true);
    setLogsError(null);
    
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('masjid_id', tenantContext.masjidId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      setLogsError(err.message || "Failed to load SMS logs");
      console.error("Error fetching SMS logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }

  // Handle settings save
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    
    if (!tenantContext?.masjidId) {
      setSettingsError("Masjid context not found");
      return;
    }
    
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);
    
    try {
      const { error: updateError } = await supabase
        .from('masjids')
        .update({
          sms_api_key: formData.sms_api_key || null,
          sms_sender_id: formData.sms_sender_id || null,
          sms_provider_url: formData.sms_provider_url || null,
          sms_updated_at: new Date().toISOString()
        })
        .eq('id', tenantContext.masjidId);
      
      if (updateError) throw updateError;
      
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 5000);
    } catch (err: any) {
      setSettingsError(err.message || "Failed to save SMS settings");
      console.error("Error saving SMS settings:", err);
    } finally {
      setSavingSettings(false);
    }
  }
  
  // Handle send SMS
  async function handleSendSms(e: React.FormEvent) {
    e.preventDefault();
    
    if (!tenantContext?.masjidId || !tenantContext?.userId) {
      setSendError("Masjid context not found");
      return;
    }
    
    if (!phoneNumber.trim() || !smsMessage.trim()) {
      setSendError("Phone number and message are required");
      return;
    }
    
    setSendingSms(true);
    setSendError(null);
    setSendSuccess(false);
    
    try {
      // Step 1: Insert into sms_logs with status = "pending"
      const { data: insertedLog, error: insertError } = await supabase
        .from('sms_logs')
        .insert({
          masjid_id: tenantContext.masjidId,
          phone_number: phoneNumber.trim(),
          message: smsMessage.trim(),
          status: 'pending',
          created_by: tenantContext.userId
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      
      // Step 2: Call Edge Function to process the log
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            log_id: insertedLog.id
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to send SMS (status: ${response.status})`);
      }
      
      // Success!
      setSendSuccess(true);
      setPhoneNumber("");
      setSmsMessage("");
      
      // Refresh logs
      setTimeout(fetchSmsLogs, 500);
      
      setTimeout(() => setSendSuccess(false), 5000);
    } catch (err: any) {
      setSendError(err.message || "Failed to send SMS");
      console.error("Error sending SMS:", err);
    } finally {
      setSendingSms(false);
    }
  }

  // Early return if redirecting
  if (!authLoading && !user) return null;
  
  // Page-level access control
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mr-3" />
      <span className="text-gray-600">Loading...</span>
    </div>
  );
  
  // Super admins and co admins always have access
  const isSuperAdmin = tenantContext?.role === 'super_admin' || tenantContext?.role === 'co_admin';
  const hasSettingsPermission = tenantContext?.permissions?.settings === true;
  
  if (!isSuperAdmin && !hasSettingsPermission) {
    return <div className="min-h-screen flex items-center justify-center">No access</div>;
  }

  // Status badge component
  function StatusBadge({ status }: { status: string }) {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      sent: "bg-emerald-100 text-emerald-800 border-emerald-200",
      failed: "bg-red-100 text-red-800 border-red-200"
    };
    
    const icons = {
      pending: <Clock className="w-4 h-4 mr-1" />,
      sent: <Check className="w-4 h-4 mr-1" />,
      failed: <XCircle className="w-4 h-4 mr-1" />
    };
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/settings" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Settings
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">SMS Gateway</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Configuration & Send SMS */}
          <div className="space-y-8">
            {/* Configuration Card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Configuration</h2>
                <p className="text-gray-600 mt-1">Set up your SMS provider credentials</p>
              </div>
              
              <div className="p-6">
                {loadingSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mr-3" />
                    <span className="text-gray-600">Loading settings...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    {/* Success/Error messages */}
                    {settingsSuccess && (
                      <div className="flex items-center p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-3" />
                        <span className="text-emerald-800 font-medium">Settings saved successfully!</span>
                      </div>
                    )}
                    
                    {settingsError && (
                      <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                        <span className="text-red-800 font-medium">{settingsError}</span>
                      </div>
                    )}
                    
                    {/* API Key */}
                    <div>
                      <label htmlFor="sms_api_key" className="block text-sm font-medium text-gray-700 mb-2">
                        SMS Provider API Key
                      </label>
                      <input
                        type="password"
                        id="sms_api_key"
                        value={formData.sms_api_key}
                        onChange={(e) => setFormData({ ...formData, sms_api_key: e.target.value })}
                        placeholder="For TextIt.biz: username:password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      {formData.sms_provider_url?.includes('textit.biz') && (
                        <p className="text-sm text-gray-500 mt-1">
                          Format: your_username:your_password
                        </p>
                      )}
                    </div>
                    
                    {/* Sender ID */}
                    <div>
                      <label htmlFor="sms_sender_id" className="block text-sm font-medium text-gray-700 mb-2">
                        Sender ID / Name
                      </label>
                      <input
                        type="text"
                        id="sms_sender_id"
                        value={formData.sms_sender_id}
                        onChange={(e) => setFormData({ ...formData, sms_sender_id: e.target.value })}
                        placeholder="Your Masjid Name or Number"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    
                    {/* Provider URL */}
                    <div>
                      <label htmlFor="sms_provider_url" className="block text-sm font-medium text-gray-700 mb-2">
                        SMS Provider API URL
                      </label>
                      <input
                        type="url"
                        id="sms_provider_url"
                        value={formData.sms_provider_url}
                        onChange={(e) => setFormData({ ...formData, sms_provider_url: e.target.value })}
                        placeholder="https://textit.biz/sendmsg/"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        For TextIt.biz use: https://textit.biz/sendmsg/
                      </p>
                    </div>
                    
                    {/* Save Button */}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {savingSettings ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Settings
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
            
            {/* Send SMS Card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Send SMS</h2>
                <p className="text-gray-600 mt-1">Send a test or broadcast SMS</p>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSendSms} className="space-y-6">
                  {/* Success/Error messages */}
                  {sendSuccess && (
                    <div className="flex items-center p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-3" />
                      <span className="text-emerald-800 font-medium">SMS sent successfully!</span>
                    </div>
                  )}
                  
                  {sendError && (
                    <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                      <span className="text-red-800 font-medium">{sendError}</span>
                    </div>
                  )}
                  
                  {/* Phone Number */}
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  
                  {/* Message */}
                  <div>
                    <label htmlFor="smsMessage" className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      id="smsMessage"
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="Type your message here..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <p className="mt-2 text-sm text-gray-500">{smsMessage.length} characters</p>
                  </div>
                  
                  {/* Send Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingSms || !formData.sms_api_key || !formData.sms_provider_url}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingSms ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send SMS
                        </>
                      )}
                    </button>
                  </div>
                  
                  {(!formData.sms_api_key || !formData.sms_provider_url) && (
                    <p className="text-sm text-amber-600">
                      Please configure your SMS provider first before sending.
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
          
          {/* Right Column: SMS Logs */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">SMS Logs</h2>
                <p className="text-gray-600 mt-1">Recent SMS activity</p>
              </div>
              <button
                onClick={fetchSmsLogs}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Refresh
              </button>
            </div>
            
            <div className="divide-y divide-gray-200 max-h-[800px] overflow-y-auto">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mr-3" />
                  <span className="text-gray-600">Loading logs...</span>
                </div>
              ) : logsError ? (
                <div className="p-8 text-center text-red-600">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
                  <p>{logsError}</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No SMS logs yet. Send your first SMS above!</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-gray-900">{log.phone_number}</span>
                          <StatusBadge status={log.status} />
                        </div>
                        <p className="text-gray-700 text-sm mb-2">{log.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                        {log.provider_response && log.status === 'failed' && (
                          <div className="mt-2 p-3 bg-red-50 rounded">
                            <p className="text-xs text-red-700">Error: {log.provider_response}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

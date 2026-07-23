import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function sendSms(
  masjidId: string,
  phoneNumber: string,
  message: string,
  createdBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.info('[sms-utils] sendSms start', {
      masjidId,
      phoneNumberPresent: Boolean(phoneNumber),
      phoneNumberLength: phoneNumber?.length || 0,
      messageLength: message?.length || 0,
      createdByPresent: Boolean(createdBy),
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });

    // First, get the masjid SMS configuration
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: masjidConfig, error: configError } = await supabase
      .from('masjids')
      .select('sms_api_key, sms_sender_id, sms_provider_url')
      .eq('id', masjidId)
      .single();

    if (configError) {
      console.error('Error fetching masjid SMS config:', configError);
      return { success: false, error: 'Failed to fetch SMS configuration' };
    }

    const { sms_api_key, sms_sender_id, sms_provider_url } = masjidConfig;
    console.info('[sms-utils] masjid SMS config loaded', {
      masjidId,
      hasApiKey: Boolean(sms_api_key),
      hasSenderId: Boolean(sms_sender_id),
      hasProviderUrl: Boolean(sms_provider_url),
      providerUrlPreview: sms_provider_url ? String(sms_provider_url).slice(0, 60) : null,
    });

    if (!sms_api_key || !sms_provider_url) {
      console.error('[sms-utils] SMS provider not configured', {
        masjidId,
        hasApiKey: Boolean(sms_api_key),
        hasProviderUrl: Boolean(sms_provider_url),
      });
      return { success: false, error: 'SMS provider not configured' };
    }

    // First, insert a pending entry in sms_logs
    const { data: smsLog, error: logError } = await supabase
      .from('sms_logs')
      .insert({
        masjid_id: masjidId,
        phone_number: phoneNumber,
        message: message,
        status: 'pending',
        created_by: createdBy || null,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Error creating SMS log entry:', logError);
      return { success: false, error: 'Failed to create SMS log' };
    }

    console.info('[sms-utils] sms_logs entry created', {
      masjidId,
      smsLogId: smsLog.id,
      phoneNumberLength: phoneNumber?.length || 0,
    });

    // Now, call the send-sms edge function
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[sms-utils] SUPABASE_SERVICE_ROLE_KEY is missing — auto-SMS cannot authenticate with edge function', {
        masjidId,
        smsLogId: smsLog.id,
      });
      return { success: false, error: 'Server SMS configuration missing (service role key)' };
    }

    const functionUrl = `${SUPABASE_URL}/functions/v1/send-sms`;
    console.info('[sms-utils] calling send-sms edge function', {
      masjidId,
      smsLogId: smsLog.id,
      functionUrl,
      authHeaderMode: 'service_role',
    });

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ log_id: smsLog.id }),
    });

    const responseData = await response.json().catch(() => null);
    console.info('[sms-utils] send-sms edge function response', {
      masjidId,
      smsLogId: smsLog.id,
      ok: response.ok,
      status: response.status,
      responseData,
    });

    if (!response.ok) {
      console.error('[sms-utils] send-sms edge function failed', {
        masjidId,
        smsLogId: smsLog.id,
        phoneNumberPresent: Boolean(phoneNumber),
        status: response.status,
        responseData,
      });
      return {
        success: false,
        error: responseData?.error || `Failed to send SMS (${response.status})`,
      };
    }

    console.info('[sms-utils] sendSms success', {
      masjidId,
      smsLogId: smsLog.id,
    });
    return { success: true };
  } catch (error: any) {
    console.error('[sms-utils] sendSms unexpected error', {
      masjidId,
      phoneNumberPresent: Boolean(phoneNumber),
      messageLength: message?.length || 0,
      error,
    });
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

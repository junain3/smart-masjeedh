export interface WhatsAppSendResult {
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com/v18.0';

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!phone?.trim()) {
    return {
      success: false,
      error: 'Phone number is required.',
    };
  }

  if (!message?.trim()) {
    return {
      success: false,
      error: 'Message is required.',
    };
  }

  if (!token || !phoneId) {
    return {
      success: false,
      error: 'WhatsApp credentials are not configured.',
    };
  }

  try {
    const response = await fetch(`${WHATSAPP_API_BASE_URL}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: {
          body: message,
        },
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error:
          typeof data?.error?.message === 'string'
            ? data.error.message
            : 'Failed to send WhatsApp message.',
        data,
      };
    }

    return {
      success: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown WhatsApp error.',
    };
  }
}

/**
 * Example usage (comment only, not wired into business logic):
 *
 * import { sendWhatsAppMessage } from '@/lib/whatsapp';
 *
 * await sendWhatsAppMessage('+966500000000', 'Hello from Smart Masjeedh');
 */

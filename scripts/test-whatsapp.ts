import { sendWhatsAppMessage } from '../lib/whatsapp';

async function main() {
  const testPhone = '+15551234567';
  const testMessage = 'Hello from Smart Masjeedh WhatsApp test.';

  console.log('Sending WhatsApp test message...');

  const result = await sendWhatsAppMessage(testPhone, testMessage);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Unexpected WhatsApp test error:', error);
  process.exitCode = 1;
});

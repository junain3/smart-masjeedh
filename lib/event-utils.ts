const EVENT_SMS_SIGN_OFF = "Nirvaha Safai";

/** SMS when a family receives event distribution items. Lines separated with \n for providers. */
export function buildEventReceivedSms(headName: string, eventTitle: string): string {
  return `Assalamu Alaikkum!

${headName}, Ungalukku ${eventTitle} Valangappattullathu.

          ~Nirvaha Safai~`;
}

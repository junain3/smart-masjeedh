const EVENT_SMS_SIGN_OFF = "Nirvaga Sabai";

/** SMS when a family receives event distribution items. Lines separated with \n for providers. */
export function buildEventReceivedSms(headName: string, eventTitle: string): string {
  return `Assalamu Alaikum! ${headName}, ungalukku ${eventTitle} vaangappaduthu. Nirvaga Sabai`;
}

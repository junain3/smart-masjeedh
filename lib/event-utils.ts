const EVENT_SMS_SIGN_OFF = "நிர்வாக சபை";

/** SMS when a family receives event distribution items. Lines separated with \n for providers. */
export function buildEventReceivedSms(headName: string, eventTitle: string): string {
  return [
    "அஸ்ஸலாமு அலைக்கும்!",
    `${headName}, உங்களுக்கு ${eventTitle} வழங்கப்பட்டுள்ளது என்பதை மகிழ்ச்சியுடன் தெரிவித்துக் கொள்கிறோம்.`,
    EVENT_SMS_SIGN_OFF,
  ].join("\n");
}

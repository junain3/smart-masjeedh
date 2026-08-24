export const ACTIVE_RECORD_STATUS = "Active";
export const ACTIVE_RECORD_STATUS_FILTER = "status.is.null,status.eq.Active";
export const HARD_DELETE_CONFIRM_TEXT = "DELETE";

// Family-specific soft delete status options
export const FAMILY_SOFT_DELETE_STATUS_OPTIONS = [
  "Moved Out",
  "Inactive",
] as const;

export type FamilySoftDeleteStatus = (typeof FAMILY_SOFT_DELETE_STATUS_OPTIONS)[number];

// Member-specific soft delete status options
export const MEMBER_SOFT_DELETE_STATUS_OPTIONS = [
  "Deceased",
  "Transferred",
] as const;

export type MemberSoftDeleteStatus = (typeof MEMBER_SOFT_DELETE_STATUS_OPTIONS)[number];

// Combined type for backward compatibility
export const SOFT_DELETE_STATUS_OPTIONS = [
  "Moved Out",
  "Left",
  "Deceased",
  "Inactive",
  "Transferred",
] as const;

export type SoftDeleteStatus = (typeof SOFT_DELETE_STATUS_OPTIONS)[number];

// Helper text for family status options
export const FAMILY_STATUS_HELPER_TEXT: Record<FamilySoftDeleteStatus, string> = {
  "Moved Out": "முழு குடும்பமும் ஊரை விட்டு அல்லது மஸ்ஜித் எல்லையை விட்டு இடம்பெயர்ந்துள்ளது. (Family has permanently moved out of the masjid area).",
  "Inactive": "மஸ்ஜித் பதிவிலிருந்து விலகியுள்ளனர். (Family is no longer active in the registry).",
};

// Helper text for member status options
export const MEMBER_STATUS_HELPER_TEXT: Record<MemberSoftDeleteStatus, string> = {
  "Deceased": "வபாத் (மரணம்). (Member has passed away).",
  "Transferred": "திருமணம் அல்லது வேறு காரணங்களால் வேறு குடும்பத்திற்கு மாறியுள்ளனர். (Married or moved to another family/location).",
};

export const normalizeNicValue = (value?: string | null): string =>
  (value || "").replace(/\s+/g, "").trim().toUpperCase();

export const normalizeLooseText = (value?: string | null): string =>
  (value || "").trim().replace(/\s+/g, " ");

export const buildSoftDeletePayload = (
  status: string,
  reason: string,
  userId?: string | null
) => ({
  status,
  status_reason: normalizeLooseText(reason),
  status_changed_at: new Date().toISOString(),
  status_changed_by: userId || null,
});

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Extract email prefix for cleaner display (e.g., "john.doe" from "john.doe@example.com")
 */
function extractEmailPrefix(email: string): string {
  if (!email || !email.includes('@')) return email;
  return email.split('@')[0];
}

/**
 * Get a display name with graceful fallbacks for historical records
 * Priority: full_name > email_prefix > "Previous Admin" > "Unknown"
 */
function getDisplayName(user: any): string {
  if (user.full_name) return user.full_name;
  if (user.email) return extractEmailPrefix(user.email);
  return "Previous Admin";
}

/**
 * Fetch user names by their user IDs from user_roles table
 * Returns a map of user_id -> display name with backwards-compatible fallbacks
 */
export async function fetchUserNames(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, auth_user_id, full_name, email")
    .or(`user_id.in.(${userIds.join(',')}),auth_user_id.in.(${userIds.join(',')})`);

  if (error || !data) {
    console.error("Error fetching user names:", error);
    // Return fallback map for all IDs to prevent errors
    return userIds.reduce((acc, id) => ({ ...acc, [id]: "Previous Admin" }), {});
  }

  const nameMap: Record<string, string> = {};
  data.forEach((user) => {
    const userId = user.user_id || user.auth_user_id;
    if (userId) {
      nameMap[userId] = getDisplayName(user);
    }
  });

  // Fill in any missing IDs with "Previous Admin" for backwards compatibility
  userIds.forEach((id) => {
    if (!nameMap[id]) {
      nameMap[id] = "Previous Admin";
    }
  });

  return nameMap;
}

/**
 * Fetch a single user name by user ID with backwards-compatible fallbacks
 */
export async function fetchUserName(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  if (!userId) return "Unknown";

  const { data, error } = await supabase
    .from("user_roles")
    .select("full_name, email")
    .or(`user_id.eq.${userId},auth_user_id.eq.${userId}`)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching user name:", error);
    return "Previous Admin";
  }

  return getDisplayName(data);
}

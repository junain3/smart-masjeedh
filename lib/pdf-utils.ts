import { getTenantContext } from "@/lib/tenant";

export async function getPdfMasjidName(supabase: any, masjidId?: string | null) {
  let resolvedMasjidId = masjidId || null;

  try {
    if (!resolvedMasjidId) {
      const ctx = await getTenantContext();
      resolvedMasjidId = ctx?.masjidId || null;
    }

    if (!resolvedMasjidId) return "MASJID";

    const { data } = await supabase
      .from("masjids")
      .select("masjid_name")
      .eq("id", resolvedMasjidId)
      .maybeSingle();

    const rawName = data?.masjid_name;
    return typeof rawName === 'string' ? rawName : "MASJID";
  } catch (error) {
    console.error("Failed to load Masjeedh name for PDF:", error);
    return "MASJID";
  }
}

export function escapePdfHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
